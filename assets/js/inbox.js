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

  /* ---------- sending ---------- */
  /** Every rule a message must meet; returns the message to append, or throws one sentence. Nothing is written. */
  function draft(ws, o) {
    const b = ensure(ws);
    const t = threadById(ws, o.threadId);
    if (!t) throw fail('This conversation does not exist.');
    if (o.from !== 'firm' && o.from !== 'party') throw fail('A message is from the firm or from the investor.');
    const P = partyOf(ws, t.party);
    let author = String(o.author == null ? '' : o.author).trim();
    if (o.from === 'firm' && !author) throw fail('Name the person sending.');
    if (o.from === 'party' && !author) author = P ? P.name : '';
    const body = String(o.body == null ? '' : o.body);
    const files = Array.isArray(o.attachments) ? o.attachments : [];
    if (!body.trim() && !files.length) throw fail('Write a message or attach a file.');
    if (body.length > LIMITS.body) throw fail('A message can be at most 4,000 characters.');
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
      attachments: [],
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

  const LIMITS = Object.freeze({ body: 4000, files: 5, each: 10485760, total: 26214400, held: 52428800 });

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
    chainText,
    threadFor,
    threadsOf,
    threadsFor,
    messagesOf,
    send,
    markRead,
    unread,
    verify,
    PARTS,
    ready: null
  };
  NS.inbox.ready = loadParts();
})(window.CVPortal);
