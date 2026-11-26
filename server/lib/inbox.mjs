// The server's message record (plan 14-03; MS-01, MS-02, MS-06, MS-07, MS-09). In server mode an investor on their
// own phone and the sponsor in the console are on different devices, so this server keeps the workspace's threads,
// messages, read events and notice events. Records are append-only: nothing is ever removed or changed (a thread,
// message, read, notice or client record is written once). Bodies, authors, attachment names, names and emails are
// sealed with the vault (lib/vault.mjs) bound to 'inbox:<record id>:sealed'; attachments are sealed blobs
// 'ixa-<attachment id>' bound to their key. Messages are hash-chained per workspace on the browser's recipe
// (NS.inbox.chainText, plan 14-01), so verify() names the first altered entry.
//
// Access: this module reads no token, cookie or header to decide who is calling. The mount (plan 14-08) resolves the
// caller from the phase 15 session and role guard and passes an authorized context: a sponsor context
// { workspace, actor: { id, name } } or an investor context { workspace, party: { kind: 'investor', id } }. Every
// query is pinned to that context; another party's or workspace's id answers 404.
//
// Notices are asked for through an injected notify() with ids and the recipient only, never a body, an author's
// text, an attachment name or an offering name. Nothing is logged: errors carry a status and a sentence for the
// caller only.
import { readRaw, parseJson, send } from './http.mjs';
import { id as newId, sha256 } from './crypto.mjs';

const KB = 1024;
const MB = 1024 * KB;
export const LIMITS = Object.freeze({ body: 4000, files: 5, file: 10 * MB, total: 25 * MB, request: Math.ceil((25 * MB * 4) / 3) + 256 * KB, small: 16 * KB });
export const GENESIS = '0'.repeat(64);
/** The four expressions of 13-01's emails.js PATTERNS (server/lib/help.mjs NUMBERS plus the password one), copied. */
export const PATTERNS = Object.freeze([/\b\d{2}-\d{7}\b/, /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, /\d{8,}/, /\bpass(word|code)?\s*[:=]/i]);
export const TYPES = Object.freeze({ party: Object.freeze(['pdf', 'png', 'jpeg']), firm: Object.freeze(['pdf', 'png', 'jpeg', 'xlsx', 'csv', 'docx']) });
const CONTENT_TYPES = { pdf: 'application/pdf', png: 'image/png', jpeg: 'image/jpeg', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', csv: 'text/csv; charset=utf-8' };
const MAX_RECIPIENTS = 500;
const PAGE = 500;
const HOUR = 36e5;

/**
 * The text a message's hash is computed over, exactly as NS.inbox.chainText (plan 14-01) builds it:
 * [prev, seq, at, threadId, from, author, body, attachment sha256 list joined by ',', broadcastId, correctionOf]
 * joined by '|'. The hash is sha256(chainText(prev, m)) as hex of the UTF-8 text. Read and notice events are outside it.
 */
export function chainText(prev, m) {
  return [prev, m.seq, m.at, m.threadId, m.from, m.author, m.body, (m.attachments || []).map((a) => a.sha256).join(','), m.broadcastId || '', m.correctionOf || ''].join('|');
}
const hashOf = (prev, m) => sha256(chainText(prev, m));

/** The kind read from a file's first bytes (plan 14-01 NS.inbox.fileKind): 'pdf' | 'png' | 'jpeg' | 'xlsx' | 'docx' | 'csv' | ''. */
export function fileKind(name, bytes) {
  const b = Buffer.from(bytes || []);
  if (b.length >= 5 && b.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  return '';
}

const fail = (status, message, extra) => Object.assign(new Error(message), { status, extra: extra || null });
const reply = (res, status, body, headers) => (send(res, status, body, headers), true);
const clip = (v, n) => (v === undefined || v === null ? '' : String(v).slice(0, n));
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
const fileName = (s) => clip(String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim(), 120) || 'attachment';
const PARTY_ID = /^[\w.:@-]{1,80}$/;
const ATTACHMENT_ID = /^ixa_[\w-]{1,64}$/;
const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return '';
  }
};
const hashId = (...parts) => sha256(parts.map((p) => String(p)).join('\n')).slice(0, 32);

function parseObject(raw) {
  const body = parseJson(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'The request body must be a JSON object');
  return body;
}
function decode64(s) {
  if (typeof s !== 'string') throw fail(400, 'An attachment must be base64.', { field: 'attachments' });
  const b64 = s.replace(/^data:[\w.+/-]+;base64,/, '').replace(/\s+/g, '');
  return Buffer.from(b64, 'base64');
}

export function createInbox({ env = {}, store, vault, now = () => Date.now(), limited = () => false, notify = null } = {}) {
  void env;
  if (!store || !vault) throw new Error('createInbox needs a store and a vault');
  const iso = (ms = now()) => new Date(ms).toISOString();

  /* ---------- records ---------- */
  const aad = (rec) => `inbox:${rec.id}:sealed`;
  const seal = (rec, value) => vault.seal(value, aad(rec));
  const unseal = (rec) => (rec && rec.sealed ? vault.open(rec.sealed, aad(rec)) : null);
  const blobKey = (attId) => `ixa-${attId.replace(/^ixa_/, '')}`;
  const all = (workspace) => store.list('inbox').filter((r) => r && r.workspace === workspace);
  const ofType = (workspace, type) => all(workspace).filter((r) => r.type === type);
  const nextOrder = (workspace) => all(workspace).reduce((m, r) => (typeof r.order === 'number' && r.order > m ? r.order : m), 0) + 1;
  const sameParty = (a, b) => !!a && !!b && a.kind === b.kind && a.id === b.id;
  const requireVault = () => {
    if (!vault.allowed) throw fail(503, 'Messages are not available on this server until it is set up to encrypt them.');
  };

  const partyRecId = (workspace, party) => `ixp_${hashId(workspace, party.kind, party.id)}`;
  const firmRecId = (workspace) => `ixf_${hashId(workspace)}`;
  const partyRec = (workspace, party) => store.get('inbox', partyRecId(workspace, party));
  const partyInfo = (workspace, party) => {
    const r = partyRec(workspace, party);
    const s = (r && unseal(r)) || {};
    return { prefs: Object.assign({ notices: true }, (r && r.prefs) || {}), name: s.name || '', email: s.email || '', offerings: Array.isArray(s.offerings) ? s.offerings : [] };
  };
  function writeParty(workspace, party, { name, email, offerings }) {
    const was = partyRec(workspace, party);
    const rec = { id: partyRecId(workspace, party), type: 'party', workspace, party: { kind: party.kind, id: party.id }, prefs: Object.assign({ notices: true }, (was && was.prefs) || {}) };
    rec.sealed = seal(rec, { name: clip(name, 200), email: clip(email, 254), offerings: (offerings || []).map((o) => ({ id: clip(o.id, 80), name: clip(o.name, 200) })) });
    store.put('inbox', rec);
  }
  function writeFirm(workspace, firm) {
    const rec = { id: firmRecId(workspace), type: 'firm', workspace };
    rec.sealed = seal(rec, { name: clip(firm.name, 200), notifyEmail: clip(firm.notifyEmail, 254), supportEmail: clip(firm.supportEmail, 254) });
    store.put('inbox', rec);
  }
  const firmInfo = (workspace) => unseal(store.get('inbox', firmRecId(workspace))) || { name: '', notifyEmail: '', supportEmail: '' };

  function findThread(workspace, party, offeringId, roomId) {
    return ofType(workspace, 'thread').find((t) => sameParty(t.party, party) && t.offeringId === offeringId && t.roomId === roomId) || null;
  }
  /** The thread for this party and offering (and room), created when it does not exist yet. */
  function threadOf(workspace, party, offeringId = '', roomId = '') {
    const p = cleanParty(party);
    const off = clip(offeringId, 80);
    const room = clip(roomId, 80);
    const found = findThread(workspace, p, off, room);
    if (found) return found;
    const rec = { id: newId('ixt'), type: 'thread', workspace, party: p, offeringId: off, roomId: room, createdAt: iso() };
    store.put('inbox', rec);
    return rec;
  }
  function cleanParty(party) {
    const p = obj(party);
    if (!p || !['investor', 'prospect'].includes(p.kind) || !PARTY_ID.test(String(p.id || ''))) throw fail(400, 'A recipient must be an investor with an id.', { field: 'recipients' });
    return { kind: p.kind, id: String(p.id) };
  }

  /* ---------- content rules (the same as the browser's) ---------- */
  /** files: [{ name, bytes }] → [{ name, bytes, kind, size, sha256 }]; throws a 4xx with one sentence. */
  function checkContent({ side, author, body, files }) {
    const text = typeof body === 'string' ? body : body === undefined || body === null ? '' : null;
    if (text === null) throw fail(400, 'The message must be text.', { field: 'body' });
    if (side === 'firm' && !clip(author, 120).trim()) throw fail(422, 'Name the person sending.', { field: 'author' });
    const list = (files || []).map((f) => {
      const bytes = Buffer.from(f.bytes || []);
      const name = fileName(f.name);
      return { name, bytes, kind: fileKind(name, bytes), size: bytes.length, sha256: sha256(bytes) };
    });
    if (!text.trim() && !list.length) throw fail(422, 'Write a message or attach a file.', { field: 'body' });
    return { author: clip(author, 120).trim(), body: text, files: list };
  }

  /* ---------- writing ---------- */
  /** Synchronous: the blobs, then the message record with its place in the chain and in the update order. */
  function writeMessage(workspace, thread, { from, author, body, files, broadcastId = '', correctionOf = '', actor = '' }) {
    requireVault();
    const attachments = files.map((f) => {
      const attId = newId('ixa');
      const key = blobKey(attId);
      store.putBlob(key, vault.sealBytes(f.bytes, key));
      return { id: attId, size: f.size, sha256: f.sha256, kind: f.kind };
    });
    const msgs = ofType(workspace, 'message').sort((a, b) => a.seq - b.seq);
    const last = msgs[msgs.length - 1];
    const rec = { id: newId('ixm'), type: 'message', workspace, order: nextOrder(workspace), seq: last ? last.seq + 1 : 1, threadId: thread.id, from, at: iso(), broadcastId, correctionOf, actor: clip(actor, 80), attachments };
    rec.sealed = seal(rec, { author, body, names: files.map((f) => f.name) });
    rec.prev = last ? last.hash : GENESIS;
    rec.hash = hashOf(rec.prev, Object.assign({}, rec, { author, body }));
    store.put('inbox', rec);
    return rec;
  }
  const eventId = (prefix, messageId) => `ixe_${prefix}-${messageId.replace(/^ixm_/, '')}`;
  function writeEvent(workspace, type, messageId, extra) {
    const rec = Object.assign({ id: eventId(type === 'read' ? 'r' : 'n', messageId), type, workspace, order: nextOrder(workspace), messageId, at: iso() }, extra || {});
    store.put('inbox', rec);
    return rec;
  }
  const eventOf = (workspace, type, messageId) => store.get('inbox', eventId(type === 'read' ? 'r' : 'n', messageId));

  /** The notice for a stored message (C-06). Always one notice event per message. */
  async function noticeFor(workspace, rec, thread) {
    const party = thread.party;
    let status;
    if (rec.from === 'firm') {
      const info = partyInfo(workspace, party);
      if (info.prefs.notices === false) status = 'off';
      else if (coalesced(workspace, rec, thread)) status = 'coalesced';
      else if (!notify || !info.email) status = 'none';
      else status = await ask({ kind: 'message_notice', workspace, messageId: rec.id, threadId: thread.id, party: { kind: party.kind, id: party.id }, to: { name: info.name, email: info.email } });
    } else {
      const firm = firmInfo(workspace);
      const info = partyInfo(workspace, party);
      if (coalesced(workspace, rec, thread)) status = 'coalesced';
      else if (!notify) status = 'none';
      else status = await ask({ kind: 'message_received', workspace, messageId: rec.id, threadId: thread.id, party: { kind: party.kind, id: party.id }, from: { name: info.name, kind: party.kind }, to: { name: firm.name, email: firm.notifyEmail } });
    }
    const ev = writeEvent(workspace, 'notice', rec.id, { status });
    return { status: ev.status };
  }
  async function ask(n) {
    try {
      const r = await notify(n);
      return r && typeof r.status === 'string' && r.status ? clip(r.status, 40) : 'unknown';
    } catch {
      return 'failed';
    }
  }
  /** An earlier message from the same side in this thread had a notice asked for, is unread, and is less than an hour older. */
  const NOT_NOTICED = ['off', 'coalesced', 'failed', 'none'];
  function coalesced(workspace, rec, thread) {
    const at = Date.parse(rec.at);
    return ofType(workspace, 'message').some((m) => {
      if (m.id === rec.id || m.threadId !== thread.id || m.from !== rec.from || m.seq > rec.seq) return false;
      const ev = eventOf(workspace, 'notice', m.id);
      if (!ev || NOT_NOTICED.includes(ev.status)) return false;
      if (eventOf(workspace, 'read', m.id)) return false;
      return at - Date.parse(m.at) < HOUR;
    });
  }

  /* ---------- views ---------- */
  function openMessage(rec) {
    const s = unseal(rec) || {};
    const names = Array.isArray(s.names) ? s.names : [];
    return { author: s.author || '', body: s.body || '', attachments: (rec.attachments || []).map((a, i) => ({ id: a.id, name: names[i] || 'attachment', size: a.size, sha256: a.sha256, kind: a.kind })) };
  }
  function view(workspace, rec, thread) {
    const t = thread || store.get('inbox', rec.threadId);
    const o = openMessage(rec);
    const read = eventOf(workspace, 'read', rec.id);
    return { id: rec.id, seq: rec.seq, order: rec.order, threadId: rec.threadId, party: t ? t.party : null, offeringId: t ? t.offeringId : '', roomId: t ? t.roomId : '', from: rec.from, at: rec.at, author: o.author, body: o.body, attachments: o.attachments, broadcastId: rec.broadcastId || '', correctionOf: rec.correctionOf || '', readAt: read ? read.at : '' };
  }
  const threadView = (t) => ({ id: t.id, party: t.party, offeringId: t.offeringId, roomId: t.roomId, createdAt: t.createdAt });

  /** Every thread and message of one party in one workspace, opened. */
  function list(workspace, party) {
    const threads = ofType(workspace, 'thread').filter((t) => sameParty(t.party, party));
    const ids = new Set(threads.map((t) => t.id));
    const byId = new Map(threads.map((t) => [t.id, t]));
    const messages = ofType(workspace, 'message').filter((m) => ids.has(m.threadId)).sort((a, b) => a.seq - b.seq).map((m) => view(workspace, m, byId.get(m.threadId)));
    return { threads: threads.map(threadView), messages };
  }

  /** Recomputes every hash of the workspace's chain from GENESIS; seq must run 1..n. */
  function verify(workspace) {
    const msgs = ofType(workspace, 'message').sort((a, b) => a.seq - b.seq);
    let prev = GENESIS;
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.seq !== i + 1) return { ok: false, brokenAt: i + 1 };
      let o;
      try {
        o = openMessage(m);
      } catch {
        return { ok: false, brokenAt: m.seq };
      }
      const want = hashOf(prev, Object.assign({}, m, { author: o.author, body: o.body }));
      if (m.prev !== prev || m.hash !== want) return { ok: false, brokenAt: m.seq };
      prev = m.hash;
    }
    return { ok: true, count: msgs.length };
  }

  /**
   * One message on the same rules as the routes (used by the data room for a prospect's questions, plan 14-05).
   * attachments: [{ name, bytes }]. Returns the opened message view with its notice.
   */
  async function post(workspace, { party, offeringId = '', roomId = '', from, author = '', body = '', attachments = [], anyway = false, correctionOf = '', broadcastId = '', actor = '' } = {}) {
    if (!workspace) throw fail(400, 'workspace is required');
    if (from !== 'firm' && from !== 'party') throw fail(400, "from must be 'firm' or 'party'");
    requireVault();
    const p = cleanParty(party);
    const c = checkContent({ side: from, author, body, files: attachments, anyway });
    const thread = threadOf(workspace, p, offeringId, roomId);
    const rec = writeMessage(workspace, thread, { from, author: from === 'party' && !c.author ? partyInfo(workspace, p).name : c.author, body: c.body, files: c.files, broadcastId: clip(broadcastId, 80), correctionOf: clip(correctionOf, 80), actor });
    const notice = await noticeFor(workspace, rec, thread);
    return Object.assign(view(workspace, rec, thread), { notice });
  }

  /* ---------- the sponsor's routes ---------- */
  const SPONSOR_PATHS = [/^\/v1\/inbox\/messages$/, /^\/v1\/inbox\/updates$/, /^\/v1\/inbox\/read$/, /^\/v1\/inbox\/attachments\/[^/]+$/];
  const PARTY_PATHS = [/^\/v1\/my-inbox$/, /^\/v1\/my-inbox\/messages$/, /^\/v1\/my-inbox\/read$/, /^\/v1\/my-inbox\/prefs$/, /^\/v1\/my-inbox\/attachments\/[^/]+$/];
  /** True for every method on the sponsor's paths (the module itself answers a method it does not serve). */
  const sponsorPath = (method, path) => SPONSOR_PATHS.some((re) => re.test(String(path || '')));
  const partyPath = (method, path) => PARTY_PATHS.some((re) => re.test(String(path || '')));

  async function readBody(req, limit) {
    return parseObject(await readRaw(req, limit));
  }
  function failReply(res, e) {
    const status = e && Number.isInteger(e.status) ? e.status : 500;
    if (status >= 500 && status !== 503) return reply(res, 500, { error: 'The message could not be handled.' });
    return reply(res, status, Object.assign({ error: e.message }, (e && e.extra) || {}));
  }
  function sponsorCtx(ctx) {
    const c = obj(ctx);
    if (!c || typeof c.workspace !== 'string' || !c.workspace) throw fail(403, 'Not signed in.');
    const actor = obj(c.actor) || {};
    return { workspace: c.workspace, actor: { id: clip(actor.id, 80), name: clip(actor.name, 120) } };
  }
  function partyCtx(ctx) {
    const c = obj(ctx);
    const p = c && obj(c.party);
    if (!c || typeof c.workspace !== 'string' || !c.workspace || !p || p.kind !== 'investor' || !PARTY_ID.test(String(p.id || ''))) throw fail(403, 'Not signed in.');
    return { workspace: c.workspace, party: { kind: 'investor', id: String(p.id) } };
  }
  function decodeFiles(list) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list)) throw fail(400, 'attachments must be a list.', { field: 'attachments' });
    return list.map((a) => {
      const o = obj(a);
      if (!o) throw fail(400, 'An attachment must have a name and base64 bytes.', { field: 'attachments' });
      return { name: o.name, bytes: decode64(o.base64) };
    });
  }

  async function sponsorSend(req, res, c) {
    const body = await readBody(req, LIMITS.request);
    requireVault();
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];
    if (!recipients.length) throw fail(400, 'Choose at least one recipient.', { field: 'recipients' });
    if (recipients.length > MAX_RECIPIENTS) throw fail(400, `A message can go to at most ${MAX_RECIPIENTS} investors.`, { field: 'recipients' });
    const list = recipients.map((r) => {
      const o = obj(r) || {};
      const party = obj(o.party);
      if (!party || party.kind !== 'investor') throw fail(400, 'A recipient must be an investor with an id.', { field: 'recipients' });
      const offerings = Array.isArray(o.offerings) ? o.offerings.map(obj).filter(Boolean) : [];
      return { party: cleanParty(party), name: o.name, email: o.email, offeringId: clip(o.offeringId, 80), offerings };
    });
    const c2 = checkContent({ side: 'firm', author: body.author || c.actor.name, body: body.body, files: decodeFiles(body.attachments) });
    const firm = obj(body.firm);
    if (firm) writeFirm(c.workspace, firm);
    const broadcastId = list.length > 1 ? newId('bc') : '';
    const written = [];
    for (const r of list) {
      writeParty(c.workspace, r.party, r);
      const thread = threadOf(c.workspace, r.party, r.offeringId, '');
      written.push({ thread, rec: writeMessage(c.workspace, thread, { from: 'firm', author: c2.author, body: c2.body, files: c2.files, broadcastId, correctionOf: clip(body.correctionOf, 80), actor: c.actor.id }) });
    }
    const messages = [];
    for (const { thread, rec } of written) {
      const notice = await noticeFor(c.workspace, rec, thread);
      messages.push({ id: rec.id, seq: rec.seq, threadId: rec.threadId, party: thread.party, at: rec.at, attachments: rec.attachments.map((a) => ({ id: a.id, size: a.size, sha256: a.sha256, kind: a.kind })), notice });
    }
    return reply(res, 201, { broadcastId, messages });
  }

  function updates(res, c, url) {
    const raw = url.searchParams.get('since');
    const since = raw === null || raw === '' ? 0 : Number(raw);
    if (!Number.isInteger(since) || since < 0) throw fail(400, 'since must be a whole number.');
    const records = all(c.workspace);
    const byId = new Map(records.map((r) => [r.id, r]));
    let max = since;
    const picked = [];
    for (const r of records) {
      if (typeof r.order !== 'number') continue;
      if (r.order > max) max = r.order;
      if (r.order <= since) continue;
      if (r.type === 'message' && r.from === 'party') picked.push(r);
      else if (r.type === 'read' || r.type === 'notice') {
        const m = byId.get(r.messageId);
        if (m && m.from === 'firm') picked.push(r);
      }
    }
    picked.sort((a, b) => a.order - b.order);
    const items = picked.map((r) => {
      if (r.type === 'message') return Object.assign({ type: 'message' }, view(c.workspace, r, byId.get(r.threadId)));
      if (r.type === 'read') return { type: 'read', order: r.order, messageId: r.messageId, at: r.at };
      return { type: 'notice', order: r.order, messageId: r.messageId, status: r.status, at: r.at };
    });
    return reply(res, 200, { order: max, items, more: false });
  }

  function attachment(res, workspace, attId, allowedThread) {
    if (!ATTACHMENT_ID.test(attId)) throw fail(404, 'Not found');
    for (const m of ofType(workspace, 'message')) {
      const i = (m.attachments || []).findIndex((a) => a.id === attId);
      if (i < 0) continue;
      if (allowedThread && !allowedThread(m.threadId)) break;
      const sealed = store.getBlob(blobKey(attId));
      if (!sealed) break;
      const bytes = vault.openBytes(sealed, blobKey(attId));
      const name = openMessage(m).attachments[i].name;
      const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[m.attachments[i].kind] || 'application/octet-stream', 'Content-Length': bytes.length, 'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(bytes);
      return true;
    }
    throw fail(404, 'Not found');
  }

  /** Marks the messages of the other side in this thread that have no read event yet. */
  function markRead(workspace, thread, side) {
    const other = side === 'firm' ? 'party' : 'firm';
    let marked = 0;
    for (const m of ofType(workspace, 'message').filter((x) => x.threadId === thread.id && x.from === other).sort((a, b) => a.seq - b.seq)) {
      if (eventOf(workspace, 'read', m.id)) continue;
      writeEvent(workspace, 'read', m.id);
      marked++;
    }
    return marked;
  }
  const threadIn = (workspace, threadId) => {
    const t = typeof threadId === 'string' ? store.get('inbox', threadId) : null;
    return t && t.type === 'thread' && t.workspace === workspace ? t : null;
  };

  async function sponsor(req, res, url, ctx) {
    const path = url.pathname;
    if (!sponsorPath(req.method, path)) return false;
    try {
      const c = sponsorCtx(ctx);
      const m = req.method;
      if (path === '/v1/inbox/messages' && m === 'POST') return await sponsorSend(req, res, c);
      if (path === '/v1/inbox/updates' && m === 'GET') return updates(res, c, url);
      if (path === '/v1/inbox/read' && m === 'POST') {
        const body = await readBody(req, LIMITS.small);
        const t = threadIn(c.workspace, body.threadId);
        if (!t) throw fail(404, 'Not found');
        return reply(res, 200, { marked: markRead(c.workspace, t, 'firm') });
      }
      if (path.startsWith('/v1/inbox/attachments/') && m === 'GET') return attachment(res, c.workspace, safeDecode(path.slice('/v1/inbox/attachments/'.length)), null);
      return reply(res, 405, { error: 'Method not allowed' }, { Allow: path === '/v1/inbox/messages' || path === '/v1/inbox/read' ? 'POST' : 'GET' });
    } catch (e) {
      return failReply(res, e);
    }
  }

  /* ---------- the investor's routes ---------- */
  async function partySend(req, res, c) {
    const body = await readBody(req, LIMITS.request);
    requireVault();
    let thread = null;
    if (body.threadId !== undefined && body.threadId !== '') {
      const t = threadIn(c.workspace, body.threadId);
      if (!t || !sameParty(t.party, c.party)) throw fail(404, 'Not found');
      thread = t;
    }
    const info = partyInfo(c.workspace, c.party);
    const offeringId = thread ? thread.offeringId : clip(body.offeringId, 80);
    if (!thread && offeringId && !info.offerings.some((o) => o.id === offeringId)) throw fail(422, 'Choose one of your offerings.', { field: 'offeringId' });
    const content = checkContent({ side: 'party', author: '', body: body.body, files: decodeFiles(body.attachments), anyway: body.anyway === true });
    if (!thread) thread = threadOf(c.workspace, c.party, offeringId, '');
    const rec = writeMessage(c.workspace, thread, { from: 'party', author: info.name, body: content.body, files: content.files });
    const notice = await noticeFor(c.workspace, rec, thread);
    return reply(res, 201, { message: Object.assign(view(c.workspace, rec, thread), { notice }) });
  }

  async function party(req, res, path, ctx) {
    const p = String(path || '');
    if (!partyPath(req.method, p)) return false;
    try {
      const c = partyCtx(ctx);
      const m = req.method;
      const own = (threadId) => {
        const t = store.get('inbox', threadId);
        return !!t && t.workspace === c.workspace && sameParty(t.party, c.party);
      };
      if (p === '/v1/my-inbox' && m === 'GET') {
        const info = partyInfo(c.workspace, c.party);
        const l = list(c.workspace, c.party);
        return reply(res, 200, { firm: { name: firmInfo(c.workspace).name || '' }, prefs: info.prefs, offerings: info.offerings, threads: l.threads, messages: l.messages });
      }
      if (p === '/v1/my-inbox/messages' && m === 'POST') return await partySend(req, res, c);
      if (p === '/v1/my-inbox/read' && m === 'POST') {
        const body = await readBody(req, LIMITS.small);
        const t = threadIn(c.workspace, body.threadId);
        if (!t || !sameParty(t.party, c.party)) throw fail(404, 'Not found');
        return reply(res, 200, { marked: markRead(c.workspace, t, 'party') });
      }
      if (p.startsWith('/v1/my-inbox/attachments/') && m === 'GET') return attachment(res, c.workspace, safeDecode(p.slice('/v1/my-inbox/attachments/'.length)), own);
      return reply(res, 405, { error: 'Method not allowed' }, { Allow: p === '/v1/my-inbox' || p.startsWith('/v1/my-inbox/attachments/') ? 'GET' : 'POST' });
    } catch (e) {
      return failReply(res, e);
    }
  }

  return { sponsorPath, partyPath, sponsor, party, post, threadOf, list, verify, LIMITS, PATTERNS, TYPES, GENESIS, chainText, fileKind };
}
