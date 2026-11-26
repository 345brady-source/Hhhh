/*
 * Messages between the firm and its investors (self-serve edition, D-01): threads, messages, read times and the hash
 * chain that proves nothing was changed, as pure functions over the workspace with no screen. The pages that show them
 * are their own scripts beside this one (PARTS), loaded after the page in their order.
 *
 * Kept for the record: no function here edits, deletes or unsends a message. A correction is a new message linked to
 * the original. Every message carries seq, prev and hash on the change log's recipe (audit.js entryText) on its own
 * chain, so a message changed later is found by verify(). Read times are written once and are outside the hash.
 *
 * Storage: ws.inbox = { v: 1, threads: [Thread], messages: [Message] }. File bytes are never in the workspace: the caller
 * keeps them under the attachment id and the record keeps name, type, size and SHA-256 only. The change log gets ids
 * and counts, never a message body or a file name (the change log goes into audit packages).
 * The managed edition does not have NS.inbox.
 */
(function (NS) {
  'use strict';
  if (!NS || !NS.EDITION || !NS.EDITION.diy) return;

  const GENESIS = '0'.repeat(64);
  const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const sha256 = (x) => NS.audit.sha256(x);

  /** ws.inbox, made when missing; only missing keys are filled. */
  function ensure(ws) {
    if (!ws.inbox || typeof ws.inbox !== 'object') ws.inbox = { v: 1, threads: [], messages: [] };
    const b = ws.inbox;
    if (b.v === undefined) b.v = 1;
    if (!Array.isArray(b.threads)) b.threads = [];
    if (!Array.isArray(b.messages)) b.messages = [];
    return b;
  }

  /** The text a message's hash is taken over: the change log's recipe with the message's own fields. */
  function chainText(prev, m) {
    return [prev, m.seq, m.at, m.threadId, m.from, m.author, m.body, (m.attachments || []).map((a) => a.sha256).join(','), m.broadcastId || '', m.correctionOf || ''].join('|');
  }

  /* ---------- threads ---------- */
  const fail = (sentence, extra) => Object.assign(new Error(sentence), extra || {});
  const samePair = (t, party, offeringId) => t.party.kind === party.kind && t.party.id === party.id && t.offeringId === offeringId;
  const investorOf = (ws, id) => (ws.investors || []).find((i) => i.id === id) || null;
  function roomOfProspect(ws, id) {
    return (ws.rooms || []).find((r) => (r.prospects || []).some((p) => p.id === id)) || null;
  }
  /** The party's own record: an investor of ws.investors, or a prospect of a room (with that room). */
  function partyOf(ws, party) {
    if (!party || (party.kind !== 'investor' && party.kind !== 'prospect')) return null;
    if (party.kind === 'investor') {
      const inv = investorOf(ws, party.id);
      return inv ? { kind: 'investor', id: inv.id, name: inv.title, record: inv, room: null } : null;
    }
    const room = roomOfProspect(ws, party.id);
    if (!room) return null;
    const p = room.prospects.find((x) => x.id === party.id);
    return { kind: 'prospect', id: p.id, name: p.name, record: p, room };
  }
  /** The thread for (party, offering), or a new one; refused for a party that is not in the workspace. */
  function threadFor(ws, party, offeringId, at) {
    const b = ensure(ws);
    const off = String(offeringId || '');
    const P = partyOf(ws, party);
    if (!P) throw fail('This person is not an investor or prospect of the firm.');
    const found = b.threads.find((t) => samePair(t, P, off));
    if (found) return found;
    if (off) {
      if (!(ws.offerings || []).some((o) => o.id === off)) throw fail('This offering is not in the workspace.');
      if (P.kind === 'investor' && !P.record.positions.some((p) => p.offeringId === off)) throw fail('This investor holds no position in this offering.');
      if (P.kind === 'prospect' && P.room.offeringId !== off) throw fail("This offering is not the prospect's data room offering.");
    }
    const t = { id: `th-${b.threads.length + 1}`, party: { kind: P.kind, id: P.id }, offeringId: off, roomId: P.room ? P.room.id : '', createdAt: String(at || nowIso()) };
    b.threads.push(t);
    return t;
  }
  const threadById = (ws, id) => ensure(ws).threads.find((t) => t.id === id) || null;
  const lastOf = (ws, t) => {
    const ms = messagesOf(ws, t.id);
    return ms.length ? ms[ms.length - 1] : null;
  };
  /** Every thread, newest activity first (its last message, else when it was made). */
  function threadsOf(ws) {
    const b = ensure(ws);
    const key = (t) => {
      const m = lastOf(ws, t);
      return { at: m ? m.at : t.createdAt, seq: m ? m.seq : 0 };
    };
    return b.threads
      .map((t, i) => ({ t, i, k: key(t) }))
      .sort((x, y) => (x.k.at < y.k.at ? 1 : x.k.at > y.k.at ? -1 : y.k.seq - x.k.seq || y.i - x.i))
      .map((x) => x.t);
  }
  /** One party's threads only, newest activity first. */
  function threadsFor(ws, party) {
    return threadsOf(ws).filter((t) => party && t.party.kind === party.kind && t.party.id === party.id);
  }
  /** A thread's messages in seq order. */
  function messagesOf(ws, threadId) {
    return ensure(ws)
      .messages.filter((m) => m.threadId === threadId)
      .sort((a, b) => a.seq - b.seq);
  }

  /* ---------- attachments (C-17) ---------- */
  const LIMITS = Object.freeze({ body: 4000, files: 5, each: 10485760, total: 26214400, held: 52428800 });
  const TYPES = Object.freeze({ party: Object.freeze(['pdf', 'png', 'jpeg']), firm: Object.freeze(['pdf', 'png', 'jpeg', 'xlsx', 'csv', 'docx']) });
  const TYPE_WORDS = { party: 'PDF, PNG or JPEG', firm: 'PDF, PNG, JPEG, XLSX, CSV or DOCX' };
  /** Bytes as a Uint8Array view (an ArrayBuffer is wrapped); null for anything else. */
  function u8(x) {
    if (!x) return null;
    if (typeof x.length === 'number' && typeof x.byteLength === 'number') return x;
    if (typeof x.byteLength === 'number' && typeof x.slice === 'function') return new Uint8Array(x);
    return null;
  }
  const ascii = (b, at, n) => {
    let s = '';
    for (let i = 0; i < n && at + i < b.length; i++) s += String.fromCharCode(b[at + i]);
    return s;
  };
  const le16 = (b, p) => b[p] | (b[p + 1] << 8);
  const le32 = (b, p) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
  const utf8Name = (b, p, n) => {
    try {
      return new TextDecoder('utf-8').decode(b.subarray ? b.subarray(p, p + n) : b.slice(p, p + n));
    } catch (e) {
      return ascii(b, p, n);
    }
  };
  /** The part names a zip's local file headers give (walked from the start), and its central directory's. */
  function zipNames(b) {
    const names = new Set();
    let p = 0;
    for (let k = 0; k < 10000 && p + 30 <= b.length && le32(b, p) === 0x04034b50; k++) {
      const flags = le16(b, p + 6);
      const size = le32(b, p + 18);
      const n = le16(b, p + 26);
      const e = le16(b, p + 28);
      names.add(utf8Name(b, p + 30, n));
      if (flags & 8) break; // sizes follow the data: the walk stops; the central directory below names the rest
      p += 30 + n + e + size;
    }
    // The end record (in the last 65,557 bytes) points at the central directory.
    for (let q = b.length - 22; q >= 0 && q >= b.length - 65557; q--) {
      if (le32(b, q) !== 0x06054b50) continue;
      let c = le32(b, q + 16);
      const count = le16(b, q + 10);
      for (let k = 0; k < count && c + 46 <= b.length && le32(b, c) === 0x02014b50; k++) {
        const n = le16(b, c + 28);
        names.add(utf8Name(b, c + 46, n));
        c += 46 + n + le16(b, c + 30) + le16(b, c + 32);
      }
      break;
    }
    return names;
  }
  function plainText(b) {
    for (let i = 0; i < b.length; i++) {
      const c = b[i];
      if (c < 0x20 && c !== 9 && c !== 10 && c !== 13) return false;
      if (c === 0x7f) return false;
    }
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(b);
      return true;
    } catch (e) {
      return false;
    }
  }
  /** What a file is, read from its first bytes (never from its name alone): pdf, png, jpeg, xlsx, docx, csv or ''. */
  function fileKind(name, bytes) {
    const b = u8(bytes);
    if (!b || !b.length) return '';
    if (ascii(b, 0, 5) === '%PDF-') return 'pdf';
    if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return 'png';
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) {
      const parts = zipNames(b);
      if (!parts.has('[Content_Types].xml')) return '';
      if (parts.has('xl/workbook.xml')) return 'xlsx';
      if (parts.has('word/document.xml')) return 'docx';
      return '';
    }
    if (/\.csv$/i.test(String(name || '')) && plainText(b)) return 'csv';
    return '';
  }
  /** One file as checked: name, size and kind (from the bytes when they are given). */
  function fileOf(f) {
    const b = u8(f && f.bytes);
    const name = String((f && f.name) || '');
    if (b) return { name, size: b.length, type: fileKind(name, b) };
    return { name, size: Number(f && f.size) || 0, type: String((f && (f.type || f.kind)) || '') };
  }
  /** null when the files may be sent by that side, else one sentence. */
  function checkFiles(list, side) {
    const s = side === 'firm' ? 'firm' : 'party';
    const files = (Array.isArray(list) ? list : []).map(fileOf);
    if (files.length > LIMITS.files) return 'A message can carry at most 5 files.';
    const big = files.find((f) => f.size > LIMITS.each);
    if (big) return `${big.name} is larger than 10 MB.`;
    if (files.reduce((a, f) => a + f.size, 0) > LIMITS.total) return 'The files together are larger than 25 MB.';
    const wrong = files.find((f) => TYPES[s].indexOf(f.type) < 0);
    if (wrong) return `${wrong.name} is not a file type messages accept: ${TYPE_WORDS[s]}.`;
    return null;
  }

  /* ---------- screening (C-11) ---------- */
  // The four expressions of the email screen (emails.js PATTERNS: the server's help.mjs NUMBERS plus the password one).
  const PATTERNS = Object.freeze([/\b\d{2}-\d{7}\b/, /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, /\d{8,}/, /\bpass(word|code)?\s*[:=]/i]);
  const BANK = 'Bank and taxpayer numbers are not sent in messages. Payment instructions are on the capital call.';
  const PASSWORD = 'Passwords are never sent in messages.';
  const WARN = 'Do not send taxpayer or bank numbers in a message; your Account page is the place for them.';
  /** null when clean; the firm's message is refused, an investor's is warned. */
  function screen(text, side) {
    const t = String(text == null ? '' : text);
    const number = PATTERNS.slice(0, 3).some((r) => r.test(t));
    const password = PATTERNS[3].test(t);
    if (!number && !password) return null;
    if (side === 'firm') return { refuse: true, reason: number ? BANK : PASSWORD };
    return { warn: true, reason: WARN };
  }

  /* ---------- sending ---------- */
  const HEX64 = /^[0-9a-f]{64}$/;
  const ATTACH_ID = /^[\w.-]{1,120}$/;
  /** The rules on the content of a message (author, body, files, screening), for one thread or a broadcast. */
  function content(o, side, partyName) {
    let author = String(o.author == null ? '' : o.author).trim();
    if (side === 'firm' && !author) throw fail('Name the person sending.');
    if (side === 'party' && !author) author = partyName || '';
    const body = String(o.body == null ? '' : o.body);
    const given = Array.isArray(o.attachments) ? o.attachments : [];
    if (!body.trim() && !given.length) throw fail('Write a message or attach a file.');
    if (body.length > LIMITS.body) throw fail('A message can be at most 4,000 characters.');
    const sentence = checkFiles(given, side);
    if (sentence) throw fail(sentence);
    const attachments = given.map((f, k) => {
      const b = u8(f.bytes);
      const id = String(f.id || '');
      const a = { id, name: String(f.name || ''), type: fileOf(f).type, size: b ? b.length : Number(f.size) || 0, sha256: b ? sha256(b) : String(f.sha256 || '') };
      if (!ATTACH_ID.test(id) || !HEX64.test(a.sha256) || !a.name) throw fail(`${a.name || `File ${k + 1}`} could not be read. Attach it again.`);
      return a;
    });
    for (const text of [body].concat(attachments.map((a) => a.name))) {
      const s = screen(text, side);
      if (!s) continue;
      if (s.refuse) throw fail(s.reason);
      if (!o.anyway) throw fail(s.reason, { warn: true });
    }
    return { author, body, attachments };
  }
  /** Every rule a message must meet; returns the message to append, or throws one sentence. Nothing is written. */
  function draft(ws, o) {
    const b = ensure(ws);
    const t = threadById(ws, o.threadId);
    if (!t) throw fail('This conversation does not exist.');
    if (o.from !== 'firm' && o.from !== 'party') throw fail('A message is from the firm or from the investor.');
    const P = partyOf(ws, t.party);
    const { author, body, attachments } = content(o, o.from, P ? P.name : '');
    const correctionOf = String(o.correctionOf || '');
    if (correctionOf) {
      const orig = b.messages.find((m) => m.id === correctionOf);
      if (!orig || orig.threadId !== t.id || orig.from !== o.from) throw fail('A correction names an earlier message of the same conversation and the same side.');
    }
    const seq = b.messages.length + 1;
    const prev = b.messages.length ? b.messages[b.messages.length - 1].hash : GENESIS;
    const m = {
      id: `m-${seq}`,
      seq,
      threadId: t.id,
      from: o.from,
      author,
      at: String(o.at || nowIso()),
      body,
      attachments,
      broadcastId: String(o.broadcastId || ''),
      correctionOf,
      readAt: '',
      notice: null,
      prev,
      hash: ''
    };
    return { t, P, m };
  }
  /** Append a drafted message to the chain (never splice, never write into an earlier message's chained fields). */
  function append(ws, m) {
    const b = ensure(ws);
    m.seq = b.messages.length + 1;
    m.id = `m-${m.seq}`;
    m.prev = b.messages.length ? b.messages[b.messages.length - 1].hash : GENESIS;
    m.hash = sha256(chainText(m.prev, m));
    b.messages.push(m);
    return m;
  }
  const offeringName = (ws, id) => {
    const o = (ws.offerings || []).find((x) => x.id === id);
    return o ? o.name : '';
  };
  /** Send one message to a thread. Refused with one sentence (nothing written) when a rule is not met. */
  function send(ws, o) {
    const { t, P, m } = draft(ws, o || {});
    append(ws, m);
    NS.audit.log(ws, { action: m.from === 'firm' ? 'Message sent' : 'Message received', fund: t.offeringId || '', record: m.id, actor: m.author, at: m.at, detail: `thread ${t.id}; ${m.attachments.length} attachment(s)` });
    if (m.from === 'party' && NS.invitations && typeof NS.invitations.notify === 'function') {
      NS.invitations.notify(ws, 'message_received', `${P ? P.name : 'An investor'} sent a message`, offeringName(ws, t.offeringId) || 'General', 'console-messages');
    }
    return m;
  }

  /* ---------- read times ---------- */
  /** Mark the other side's unread messages in a thread as read; returns how many. A read time is never changed. */
  function markRead(ws, threadId, side, at) {
    const other = side === 'firm' ? 'party' : side === 'party' ? 'firm' : '';
    if (!other) return 0;
    const when = String(at || nowIso());
    let n = 0;
    messagesOf(ws, threadId).forEach((m) => {
      if (m.from === other && !m.readAt) {
        m.readAt = when;
        n++;
      }
    });
    return n;
  }
  /** Unread messages: for the firm, every party message not read; for a party, the firm's messages in their threads. */
  function unread(ws, side, partyId) {
    const b = ensure(ws);
    if (side === 'firm') return b.messages.filter((m) => m.from === 'party' && !m.readAt).length;
    if (side !== 'party') return 0;
    const mine = new Set(b.threads.filter((t) => t.party.id === partyId).map((t) => t.id));
    return b.messages.filter((m) => m.from === 'firm' && !m.readAt && mine.has(m.threadId)).length;
  }

  /* ---------- corrections and broadcasts ---------- */
  /** A correction: a new firm message in the same thread linked by correctionOf; the original is never touched. */
  function correct(ws, messageId, o) {
    const orig = ensure(ws).messages.find((m) => m.id === messageId);
    if (!orig) throw fail('This message does not exist.');
    const x = o || {};
    return send(ws, { threadId: orig.threadId, from: 'firm', author: x.author, body: x.body, attachments: x.attachments, at: x.at, correctionOf: messageId });
  }
  /**
   * One message per recipient's thread with one broadcastId (the audience object of the Documents and Notices pages).
   * Replies land in each investor's own thread. One change-log entry for the whole broadcast.
   */
  function broadcast(ws, o) {
    const x = o || {};
    const b = ensure(ws);
    const aud = x.audience;
    if (aud !== 'all' && aud !== 'offering' && aud !== 'investors') throw fail('Choose who receives the message.');
    const off = aud === 'offering' ? String(x.offeringId || '') : '';
    if (aud === 'offering' && !(ws.offerings || []).some((f) => f.id === off)) throw fail('Choose an offering.');
    const c = content(x, 'firm', '');
    const to = NS.ops.recipientsOf(ws, { audience: aud === 'investors' ? 'investors' : 'all', offeringId: off, investors: Array.isArray(x.investors) ? x.investors : [] });
    if (!to.length) throw fail('No investors match this audience.');
    const broadcastId = `bc-${new Set(b.messages.map((m) => m.broadcastId).filter(Boolean)).size + 1}`;
    const at = String(x.at || nowIso());
    const messages = to.map((inv) => {
      const t = threadFor(ws, { kind: 'investor', id: inv.id }, off, at);
      const m = { id: '', seq: 0, threadId: t.id, from: 'firm', author: c.author, at, body: c.body, attachments: c.attachments.map((a) => Object.assign({}, a)), broadcastId, correctionOf: '', readAt: '', notice: null, prev: '', hash: '' };
      return append(ws, m);
    });
    NS.audit.log(ws, { action: 'Broadcast sent', fund: off, record: broadcastId, actor: c.author, at, detail: `${messages.length} investors; ${c.attachments.length} attachment(s)` });
    return { broadcastId, messages };
  }
  /** How many recipients of a broadcast have read it. */
  function readBy(ws, broadcastId) {
    const list = ensure(ws).messages.filter((m) => broadcastId && m.broadcastId === broadcastId);
    return { read: list.filter((m) => m.readAt).length, total: list.length };
  }

  /* ---------- email notices (C-06): at most one per unread thread per hour ---------- */
  const NOTICE = ['simulated', 'sent', 'outbox', 'held', 'failed', 'suppressed', 'off'];
  const HOUR = 3600000;
  /** True unless an earlier message of the same thread and side got a notice, is unread, and is under an hour older. */
  function noticeDue(ws, message, at) {
    if (!message) return false;
    const when = Date.parse(at || message.at);
    return !ensure(ws).messages.some((m) => m.threadId === message.threadId && m.from === message.from && m.seq < message.seq && m.notice && m.notice.status !== 'off' && !m.readAt && when - Date.parse(m.at) < HOUR);
  }
  /** The notice's status and time on a message (outside the hash). */
  function setNotice(ws, messageId, o) {
    const m = ensure(ws).messages.find((x) => x.id === messageId);
    if (!m) throw fail('This message does not exist.');
    const status = o && o.status;
    if (NOTICE.indexOf(status) < 0) throw fail('This notice status is not known.');
    m.notice = { status, at: String((o && o.at) || nowIso()) };
    return m;
  }

  /* ---------- the chain ---------- */
  /** Every hash recomputed from GENESIS; seq must run 1..n. The first altered entry is named. */
  function verify(ws) {
    const list = ensure(ws).messages;
    let prev = GENESIS;
    for (let n = 0; n < list.length; n++) {
      const m = list[n];
      if (m.seq !== n + 1 || m.prev !== prev || sha256(chainText(prev, m)) !== m.hash) return { ok: false, brokenAt: n + 1 };
      prev = m.hash;
    }
    return { ok: true, count: list.length };
  }

  /* ---------- the record export (MS-08) ---------- */
  const COLUMNS = ['seq', 'time_utc', 'thread', 'offering', 'from', 'author', 'to', 'body', 'attachment_names', 'attachment_sha256', 'broadcast', 'correction_of', 'read_at', 'notice_status', 'previous_hash', 'hash'];
  const RECORD_SENTENCE = 'Messages and data room activity are kept unchanged and can be downloaded with a check that nothing was altered.';
  /** One CSV cell (RFC 4180): a cell a spreadsheet would run as a formula, or one starting with ', gets one ' in front. */
  function cell(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r']/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const slug = (s) =>
    String(s || '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  /** A file name safe as one zip path part. */
  function safeName(s) {
    const n = String(s || '')
      .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '_')
      .replace(/^[.\s]+/, '')
      .slice(0, 150)
      .trim();
    return n || 'file';
  }
  /** The messages a scope covers, in seq order; refused for an unknown scope, investor or offering. */
  function scoped(ws, scope) {
    const b = ensure(ws);
    const s = (scope && scope.scope) || 'all';
    const id = String((scope && scope.id) || '');
    let keep;
    if (s === 'all') keep = () => true;
    else if (s === 'investor') {
      if (!investorOf(ws, id)) throw fail('Choose an investor.');
      keep = (t) => t.party.kind === 'investor' && t.party.id === id;
    } else if (s === 'offering') {
      if (!(ws.offerings || []).some((o) => o.id === id)) throw fail('Choose an offering.');
      keep = (t) => t.offeringId === id;
    } else throw fail('Choose all messages, one investor or one offering.');
    const threads = new Set(b.threads.filter(keep).map((t) => t.id));
    return { s, id, list: b.messages.filter((m) => threads.has(m.threadId)) };
  }
  function readme(ws, o) {
    const firm = ws.tenant.name;
    const lines = [
      `Message record: ${firm}`,
      `Scope: ${o.scopeText}`,
      `Built: ${o.built} UTC`,
      `Messages in this file: ${o.rows}`,
      '',
      o.chain.ok ? `Chain verified (${o.chain.count} messages).` : `Chain broken at entry ${o.chain.brokenAt}.`,
      '(The chain is checked over every message of the workspace, not only the ones in this file.)',
      '',
      RECORD_SENTENCE,
      '',
      'messages.csv: one row per message, in the order sent. Columns:',
      '  seq                the message number in the workspace, from 1 with no gap',
      '  time_utc           when it was sent (UTC)',
      '  thread             the conversation it belongs to (one per investor and offering, and one general per investor)',
      '  offering           the offering the conversation is about (empty: general)',
      '  from               firm, or party (the investor or prospect)',
      '  author             the person who sent it',
      '  to                 the other side of the conversation',
      '  body               the text as sent',
      '  attachment_names   the files sent with it, joined by " | "',
      '  attachment_sha256  the SHA-256 of each file, in the same order, joined by " | "',
      '  broadcast          the broadcast it was part of (one message per recipient, the same broadcast id)',
      '  correction_of      the earlier message this one corrects (a message is never changed; a correction is a new message)',
      '  read_at            when the other side first opened it (empty: not read); not part of the hash',
      '  notice_status      what happened to the email saying a message is waiting; not part of the hash',
      '  previous_hash      the hash of the message before it (64 zeros for the first)',
      '  hash               this message\'s hash',
      "A cell that begins with = + - @ ', a tab or a carriage return has one ' added in front, so a spreadsheet shows it",
      'rather than running it;',
      'remove that one character before checking a hash.',
      '',
      'How to check the chain: for each message, join these values with "|" in this order: previous_hash, seq, time_utc,',
      'thread, from, author, body, the attachment SHA-256 values joined by "," (not " | "), broadcast, correction_of.',
      'The SHA-256 of that text (UTF-8, as lowercase hex) is the message\'s hash, and it is the next message\'s',
      'previous_hash. A message changed after it was sent no longer gives its hash.',
      '',
      'attachments/<message id>/<file name>: the files. A file sent to several investors at once is kept once, under the',
      'first message that carries it; the other messages name the same SHA-256.',
      'MANIFEST.sha256: the SHA-256 of every other file in this zip.'
    ];
    if (o.missing.length) {
      lines.push('', 'Files not held in this browser (only their recorded SHA-256 is known):');
      o.missing.forEach((x) => lines.push(`  ${x.mid} ${x.name} ${x.sha256}`));
    }
    if (o.differ.length) {
      lines.push('', 'Files whose bytes here do not match the SHA-256 recorded when they were sent:');
      o.differ.forEach((x) => lines.push(`  ${x.mid} ${x.name} recorded ${x.sha256}`));
    }
    return lines.join('\r\n') + '\r\n';
  }
  /** The record as one zip: messages.csv, the attachments, README.txt with the chain line, MANIFEST.sha256. Logged. */
  async function exportRecord(ws, scope, getBytes) {
    const { s, id, list } = scoped(ws, scope);
    const b = ensure(ws);
    const chain = verify(ws);
    const threads = new Map(b.threads.map((t) => [t.id, t]));
    const toOf = (m) => {
      if (m.from === 'party') return ws.tenant.name;
      const P = partyOf(ws, threads.get(m.threadId).party);
      return P ? P.name : '';
    };
    const csv = [COLUMNS.join(',')]
      .concat(
        list.map((m) => {
          const t = threads.get(m.threadId);
          return [m.seq, m.at, m.threadId, offeringName(ws, t.offeringId), m.from, m.author, toOf(m), m.body, m.attachments.map((a) => a.name).join(' | '), m.attachments.map((a) => a.sha256).join(' | '), m.broadcastId, m.correctionOf, m.readAt, m.notice ? m.notice.status : '', m.prev, m.hash]
            .map(cell)
            .join(',');
        })
      )
      .join('\r\n');
    const files = [];
    const missing = [];
    const differ = [];
    const done = new Set();
    for (const m of list) {
      const used = new Set();
      for (const a of m.attachments) {
        const key = `${a.id}|${a.sha256}`;
        if (done.has(key)) continue;
        done.add(key);
        const got = u8(typeof getBytes === 'function' ? await getBytes(a.id) : null);
        if (!got) {
          missing.push({ mid: m.id, name: a.name, sha256: a.sha256 });
          continue;
        }
        let n = safeName(a.name);
        for (let k = 2; used.has(n); k++) n = `${k}-${safeName(a.name)}`;
        used.add(n);
        if (sha256(got) !== a.sha256) differ.push({ mid: m.id, name: a.name, sha256: a.sha256 });
        files.push({ name: `attachments/${m.id}/${n}`, data: got });
      }
    }
    const day = new Date().toISOString().slice(0, 10);
    const built = new Date().toISOString().replace(/\.\d{3}Z$/, '').replace('T', ' ');
    const scopeText = s === 'all' ? 'all messages' : s === 'investor' ? `one investor (${id})` : `one offering (${offeringName(ws, id)})`;
    const enc = new TextEncoder();
    files.unshift({ name: 'README.txt', data: enc.encode(readme(ws, { scopeText, built, rows: list.length, chain, missing, differ })) });
    files.unshift({ name: 'messages.csv', data: enc.encode('﻿' + csv + '\r\n') });
    const manifest = files.map((f) => `${sha256(f.data)}  ${f.name}`).join('\n') + '\n';
    files.push({ name: 'MANIFEST.sha256', data: enc.encode(manifest) });
    const bytes = NS.audit.zip(files, new Date());
    const hash = sha256(bytes);
    const name = `${slug(ws.tenant.shortName || ws.tenant.name)}_messages_${s === 'all' ? 'all' : `${s}_${slug(id)}`}_${day}.zip`;
    NS.audit.log(ws, { action: 'Message record exported', fund: s === 'offering' ? id : '', record: name, detail: `${s}${id ? ` ${id}` : ''}; ${list.length} rows; ${files.length} files; SHA-256 ${hash}` });
    return { name, bytes, hash, files: files.map((f) => ({ name: f.name, size: f.data.length })), chain };
  }

  /* ---------- the pages' scripts (PARTS), loaded after the page ---------- */
  const HERE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  // Only files that are shipped, in their order. A part that does not load is skipped for that visit.
  const PARTS = Object.freeze([]);
  /** One script from beside this file; resolves to whether it loaded. */
  function script(name) {
    return new Promise((resolve) => {
      let src = '';
      try {
        src = HERE ? new URL(name, HERE).href : new URL(`assets/js/${name}`, document.baseURI).href;
      } catch (e) {
        return resolve(false);
      }
      const el = document.createElement('script');
      el.src = src;
      el.async = false;
      el.onload = () => resolve(true);
      el.onerror = () => {
        el.remove();
        resolve(false);
      };
      document.head.appendChild(el);
    });
  }
  /** Load the parts in order; when one of them registered the view on screen, draw the page once. */
  function loadParts() {
    return new Promise((resolve) => {
      const go = async () => {
        const before = new Set(Object.keys(NS.views || {}));
        for (const name of PARTS) await script(name);
        const added = Object.keys(NS.views || {}).filter((k) => !before.has(k));
        const raw = String((typeof location !== 'undefined' && location.hash) || '').replace(/^#/, '').split('?')[0];
        const route = NS.state && NS.state.route;
        if (added.length && (added.indexOf(route) >= 0 || added.some((k) => raw === k || raw.indexOf(`${k}-`) === 0)) && NS.app && typeof NS.app.render === 'function') NS.app.render();
        resolve();
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => go(), { once: true });
      else go();
    });
  }

  NS.inbox = {
    ensure,
    GENESIS,
    LIMITS,
    TYPES,
    PATTERNS,
    chainText,
    fileKind,
    checkFiles,
    screen,
    threadFor,
    threadsOf,
    threadsFor,
    messagesOf,
    send,
    correct,
    broadcast,
    readBy,
    markRead,
    unread,
    noticeDue,
    setNotice,
    verify,
    exportRecord,
    PARTS,
    ready: null
  };
  NS.inbox.ready = loadParts();
})(window.CVPortal);
