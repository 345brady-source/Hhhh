// The server's data room (plan 14-05; MS-11 to MS-15). Prospects open the room on their own devices, so this server
// keeps each room and everything prospects do in it: the NDA versions, the documents, the prospects and how the firm
// knows them, the assents, the views and the indications of interest. It applies the room's legal rules itself (the
// browser is not trusted), and serves each prospect a copy of a document stamped with their name, email, the date and a
// view id (assets/js/watermark.js, run here); the clean file never leaves the server.
//
// Nothing is rewritten or removed. Room, NDA version, document, prospect, link and event records are each written once
// (collection 'rooms'); a new NDA, a hidden document, an ended access, a new personal link and the open link are new
// events or new write-once records, and the current state is read back from them. Every change is an event in the
// room's own hash chain on the browser's recipe (assets/js/dataroom.js eventText, plan 14-02), so verify() names the
// first altered entry, or (brokenAt 0) a record that no longer matches the chain.
//
// Sealed with the vault (lib/vault.mjs) and bound to 'rooms:<record id>:sealed': names, emails, relationship bases, NDA
// texts and templates, document titles and file names, firm details and every event's data (typed names, addresses,
// browsers, notes, amounts). Blobs are sealed and bound to their key: 'rmd-<doc>' (the clean file), 'rms-<prospect>-<doc>'
// (that prospect's stamped copy, kept so it is stamped once), 'rmn-<nda>' (an e-signed NDA's form), 'rma-<event>-s' and
// 'rma-<event>-c' (a signed NDA and its certificate).
//
// Access: the sponsor's routes take an authorized context { workspace, actor: { id, name } } from the mount (plan 14-08
// builds it from phase 15's session and role guard). A prospect opens the room with a personal link: 32 random bytes,
// only its SHA-256 stored, scoped to one prospect of one room, 90 days at most, revocable (a new link stops the old one;
// ending the access stops it). Nothing is logged: errors carry a status and a sentence for the caller only, and notify()
// gets ids, the recipient and the link only, never an NDA text, a basis, a note or an amount.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readRaw, parseJson, send } from './http.mjs';
import { id as newId, sha256 } from './crypto.mjs';

const KB = 1024;
const MB = 1024 * KB;
export const LIMITS = Object.freeze({
  pdf: 25 * MB,
  docs: 30,
  create: Math.ceil((25 * MB * 4) / 3) + 256 * KB,
  small: 16 * KB,
  note: 500,
  days: 90,
  nda: Math.ceil((20 * MB * 4) / 3) + 256 * KB,
  ndaFile: 10 * MB
});
export const GENESIS = '0'.repeat(64);
const PAGE = 500;
const C = 'rooms';
const KINDS = ['investor', 'relationship', 'introduced', 'other'];
const S506B = 'Record how you know this person before inviting them (Rule 506(b)).';
const LATE = 'A relationship that began with this offering is not pre-existing.';
const GONE = 'This link is no longer active.';
const NOT_AGREED = 'Agree to the NDA to open the documents.';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const REC_ID = /^r[mdpvle]_[\w-]{1,40}$/;

/**
 * The kind of exemption an offering names, with the rule of assets/js/eligibility.js regime() (copied): '506c', '506b',
 * 'regA1', 'regA2listed', 'regA2', 'other' or '' (not set). Called as regime({ structure: { exemption } }).
 */
export function regime(o) {
  const ex = String(((o && o.structure) || {}).exemption || '').trim();
  if (!ex) return '';
  if (/506\(c\)/.test(ex)) return '506c';
  if (/506\(b\)/.test(ex)) return '506b';
  if (/\bRegulation A\b|\bReg\.? A\b/i.test(ex)) {
    if (/\bTier\s*(?:1|I|one)\b/i.test(ex)) return 'regA1';
    if (/exchange-listed|listed on a national securities exchange/i.test(ex)) return 'regA2listed';
    return 'regA2';
  }
  return 'other';
}

/** The text an event's hash is computed over, exactly as NS.dataroom.eventText (plan 14-02). */
export function eventText(prev, e) {
  return [prev, e.seq, e.at, e.kind, e.prospectId || '', e.docId || '', JSON.stringify(e.data)].join('|');
}

const fail = (status, message, extra) => Object.assign(new Error(message), { status, extra: extra || null });
const reply = (res, status, body, headers) => (send(res, status, body, headers), true);
const clip = (v, n) => (v === undefined || v === null ? '' : String(v).slice(0, n));
const str = (v, n = 200) => clip(v, n).trim();
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
const whole = (n) => Number.isSafeInteger(n) && n >= 0;
const isEmail = (s) => /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]{2,}$/.test(String(s || '')) && String(s).length <= 254;
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const isPdf = (b) => !!b && b.length >= 5 && b.subarray(0, 5).toString('latin1') === '%PDF-';
const hashToken = (t) => createHash('sha256').update(String(t)).digest();
const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return '';
  }
};
function parseObject(raw) {
  const body = parseJson(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'The request body must be a JSON object');
  return body;
}
/** Strict base64 decoded; 413 with the sentence when the file is over max (checked before and after decoding). */
function decode64(s, max, tooBig, field) {
  if (typeof s !== 'string' || !s) throw fail(400, 'The file must be base64.', { field });
  const b64 = s.replace(/^data:[\w.+/-]+;base64,/, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(b64) || b64.length % 4 === 1) throw fail(400, 'The file must be base64.', { field });
  if (Math.floor((b64.length * 3) / 4) > max + 3) throw fail(413, tooBig, { field });
  const buf = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (buf.length > max) throw fail(413, tooBig, { field });
  return buf;
}
/** The portal page's address without its own server parameter, then ?server=<this server>#room-<token> (taxdocs.mjs link()). */
function portalAddress(portalUrl) {
  let u;
  try {
    u = new URL(String(portalUrl || '').split('#')[0]);
  } catch {
    throw fail(400, 'portalUrl must be an http(s) address.', { field: 'portalUrl' });
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw fail(400, 'portalUrl must be an http(s) address.', { field: 'portalUrl' });
  u.searchParams.delete('server');
  return u.toString();
}

export function createDataRoom({ env = {}, store, vault, now = () => Date.now(), limited = () => false, notify = null, inbox = null, publicUrl = '', assetsDir = '' } = {}) {
  if (!store || !vault) throw new Error('createDataRoom needs a store and a vault');
  const iso = (ms = now()) => new Date(ms).toISOString();

  /* ---------- the stamp and the PDF writer, loaded from the repository as filings.mjs loads browser modules ---------- */
  let kit = null;
  function tools() {
    if (kit) return kit;
    try {
      const dir = assetsDir || fileURLToPath(new URL('../../assets/', import.meta.url));
      const req = createRequire(import.meta.url);
      kit = { L: req(join(dir, 'vendor/pdfwrite/write.js')), W: req(join(dir, 'js/watermark.js')) };
    } catch {
      throw fail(503, 'Documents cannot be prepared on this server: the PDF writer is not beside it.');
    }
    return kit;
  }
  async function pageCount(bytes) {
    const { L } = tools();
    try {
      const doc = await L.PDFDocument.load(bytes, { updateMetadata: false });
      const n = doc.getPageCount();
      if (n > 0) return n;
    } catch {
      /* refused below */
    }
    throw fail(422, 'This PDF could not be stamped.', { field: 'pdf' });
  }

  /* ---------- records: each id written once ---------- */
  const aad = (id) => `rooms:${id}:sealed`;
  const seal = (id, value) => vault.seal(value, aad(id));
  const unseal = (rec) => (rec && rec.sealed ? vault.open(rec.sealed, aad(rec.id)) : null);
  const sealBlob = (key, buf) => store.putBlob(key, vault.sealBytes(buf, key));
  const openBlob = (key) => {
    const b = store.getBlob(key);
    return b ? vault.openBytes(b, key) : null;
  };
  function putOnce(rec) {
    if (store.get(C, rec.id)) throw fail(500, 'A record id was used twice.');
    store.put(C, rec);
    return rec;
  }
  const requireVault = () => {
    if (!vault.allowed) throw fail(503, 'The data room is not available on this server until it is set up to encrypt its records.');
  };
  const short = (id) => String(id).slice(3);
  const docBlob = (docId) => `rmd-${short(docId)}`;
  const copyBlob = (prospectId, docId) => `rms-${short(prospectId)}-${short(docId)}`;

  /** Opened event data, kept in memory by event id (an event is written once); verify() always reads the store. */
  const opened = new Map();
  function dataOf(ev) {
    if (opened.has(ev.id)) return opened.get(ev.id);
    const s = unseal(ev);
    const d = s && Object.prototype.hasOwnProperty.call(s, 'data') ? s.data : null;
    opened.set(ev.id, d);
    return d;
  }
  const roomIn = (workspace, roomId) => {
    const r = REC_ID.test(String(roomId || '')) ? store.get(C, roomId) : null;
    return r && r.type === 'room' && r.workspace === workspace ? r : null;
  };
  const recordsOf = (room) => store.list(C).filter((r) => r && r.roomId === room.id && r.workspace === room.workspace);
  const bySeq = (a, b) => a.seq - b.seq;
  const nextOrder = (workspace) => store.list(C).reduce((m, r) => (r && r.type === 'event' && r.workspace === workspace && r.order > m ? r.order : m), 0) + 1;

  /** One event at the end of the room's chain, written synchronously (no other write can come between). */
  function addEvent(room, kind, { prospectId = '', docId = '', data = {}, id = '' } = {}) {
    const events = recordsOf(room).filter((r) => r.type === 'event').sort(bySeq);
    const last = events[events.length - 1];
    const rec = { id: id || newId('re'), type: 'event', workspace: room.workspace, roomId: room.id, order: nextOrder(room.workspace), seq: last ? last.seq + 1 : 1, at: iso(), kind, prospectId, docId };
    rec.sealed = seal(rec.id, { data });
    rec.prev = last ? last.hash : GENESIS;
    rec.hash = sha256(eventText(rec.prev, Object.assign({}, rec, { data })));
    putOnce(rec);
    opened.set(rec.id, data);
    return rec;
  }

  /** The room's current state, read back from its write-once records and its events. */
  function stateOf(room) {
    const recs = recordsOf(room);
    const events = recs.filter((r) => r.type === 'event').sort(bySeq);
    const st = {
      room,
      events,
      ndas: recs.filter((r) => r.type === 'nda').sort(bySeq),
      docs: recs.filter((r) => r.type === 'doc').sort(bySeq),
      prospects: recs.filter((r) => r.type === 'prospect').sort(bySeq),
      links: recs.filter((r) => r.type === 'link'),
      hidden: new Map(),
      ended: new Map(),
      assents: new Map(),
      served: new Map(),
      interest: new Map()
    };
    const push = (m, k, v) => (m.has(k) ? m.get(k).push(v) : m.set(k, [v]));
    for (const e of events) {
      if (e.kind === 'doc_hidden') st.hidden.set(e.docId, e);
      else if (e.kind === 'prospect_ended') st.ended.set(e.prospectId, e);
      else if (e.kind === 'assent') push(st.assents, e.prospectId, e);
      else if (e.kind === 'view' && (dataOf(e) || {}).how === 'served') push(st.served, e.prospectId, e);
      else if (e.kind === 'interest') push(st.interest, e.prospectId, e);
    }
    st.nda = st.ndas[st.ndas.length - 1] || null;
    return st;
  }
  const shownDocs = (st) => st.docs.filter((d) => !st.hidden.has(d.id));
  function agreedNow(st, prospectId) {
    const list = st.assents.get(prospectId) || [];
    const last = list[list.length - 1];
    return !!(last && st.nda && (dataOf(last) || {}).version === st.nda.version);
  }
  const newestLink = (st, prospectId) => st.links.filter((l) => !l.open && l.prospectId === prospectId).reduce((m, l) => (!m || l.n > m.n ? l : m), null);

  /** The room and prospect a link token opens, or null. Every link record is compared in constant time; the loop never exits early. */
  function findByToken(token) {
    if (!TOKEN.test(String(token || ''))) return null;
    const want = hashToken(token);
    let found = null;
    for (const rec of store.list(C)) {
      const have = Buffer.from(String((rec && rec.type === 'link' && rec.tokenHash) || ''), 'hex');
      if (have.length === want.length && timingSafeEqual(have, want) && !found) found = rec;
    }
    if (!found) return null;
    const room = store.get(C, found.roomId);
    if (!room || room.type !== 'room' || room.workspace !== found.workspace) return null;
    const st = stateOf(room);
    if (found.open) return null;
    const prospect = st.prospects.find((p) => p.id === found.prospectId);
    if (!prospect) return null;
    const newest = newestLink(st, prospect.id);
    if (!newest || newest.id !== found.id) return null;
    if (st.ended.has(prospect.id) || now() >= Date.parse(prospect.expiresAt)) return null;
    return { room, prospect, state: st };
  }
  /** A new personal link record for a prospect (the newest one is the only one that opens the room). */
  function issueLink(room, prospect, by) {
    const token = randomBytes(32).toString('base64url');
    const n = store.list(C).filter((r) => r && r.type === 'link' && r.prospectId === prospect.id).length + 1;
    putOnce({ id: newId('rl'), type: 'link', workspace: room.workspace, roomId: room.id, prospectId: prospect.id, open: false, n, at: iso(), expiresAt: prospect.expiresAt, by: clip(by, 80), tokenHash: hashToken(token).toString('hex') });
    return token;
  }
  const linkFor = (portalUrl, token) => {
    const base = portalAddress(portalUrl);
    return `${base}${base.includes('?') ? '&' : '?'}server=${encodeURIComponent(publicUrl)}#room-${token}`;
  };

  /* ---------- notices: ids, the recipient and the link only ---------- */
  async function ask(n) {
    if (!notify) return 'none';
    try {
      const r = await notify(n);
      return r && typeof r.status === 'string' && r.status ? clip(r.status, 40) : 'unknown';
    } catch {
      return 'failed';
    }
  }
  const firmOf = (room) => (unseal(room) || {}).firm || { name: '', notifyEmail: '', supportEmail: '', postalAddress: '' };

  /** The request's address: the rightmost X-Forwarded-For entry only behind a trusted proxy (TRUST_PROXY=1), else the socket's. */
  function addressOf(req) {
    if (env.TRUST_PROXY === '1') {
      const xf = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (xf.length) return clip(xf[xf.length - 1], 64);
    }
    return clip((req.socket && req.socket.remoteAddress) || '', 64);
  }

  /* ---------- the sponsor's routes ---------- */
  const SPONSOR_PATHS = [/^\/v1\/rooms$/, /^\/v1\/rooms\/[^/]+\/(nda|documents|prospects|open-link|activity|record)$/, /^\/v1\/rooms\/[^/]+\/documents\/[^/]+\/hide$/, /^\/v1\/rooms\/[^/]+\/prospects\/[^/]+\/(link|end)$/];
  const PROSPECT_PATHS = [/^\/v1\/room$/, /^\/v1\/room\/(nda|nda\.pdf|views|interest|messages|join)$/, /^\/v1\/room\/documents\/[^/]+$/];
  /** True for every method on the sponsor's paths (the module itself answers a method it does not serve). */
  const sponsorPath = (method, path) => SPONSOR_PATHS.some((re) => re.test(String(path || '')));
  const prospectPath = (method, path) => PROSPECT_PATHS.some((re) => re.test(String(path || '')));

  async function readBody(req, limit) {
    return parseObject(await readRaw(req, limit));
  }
  function failReply(res, e) {
    const status = e && Number.isInteger(e.status) ? e.status : 500;
    if (status >= 500 && status !== 503) return reply(res, 500, { error: 'The request could not be handled.' });
    return reply(res, status, Object.assign({ error: e.message }, (e && e.extra) || {}));
  }
  function sponsorCtx(ctx) {
    const c = obj(ctx);
    if (!c || typeof c.workspace !== 'string' || !c.workspace) throw fail(403, 'Not signed in.');
    const actor = obj(c.actor) || {};
    return { workspace: c.workspace, actor: { id: clip(actor.id, 80), name: str(actor.name, 120) } };
  }

  /** An NDA as posted: { title, text } (click-through). */
  async function ndaInput(n) {
    const o = obj(n) || {};
    const text = typeof o.text === 'string' ? o.text : '';
    if (!text.trim()) throw fail(422, 'Add the NDA text.', { field: 'nda' });
    if (text.length > 100000) throw fail(422, 'The NDA text is longer than 100,000 characters.', { field: 'nda' });
    return { mode: 'click', title: str(o.title) || 'Confidentiality agreement', text, version: sha256(text) };
  }
  function writeNda(room, nda, seq) {
    const rec = { id: newId('rv'), type: 'nda', workspace: room.workspace, roomId: room.id, seq, version: nda.version, mode: nda.mode, at: iso() };
    rec.sealed = seal(rec.id, { title: nda.title, text: nda.text });
    putOnce(rec);
    return rec;
  }

  async function createRoom(req, res, c) {
    const body = await readBody(req, LIMITS.create);
    requireVault();
    const off = obj(body.offering) || {};
    const offeringId = str(off.id, 80);
    if (!/^[\w.:@-]{1,80}$/.test(offeringId)) throw fail(400, 'Name the offering (its id).', { field: 'offering' });
    const r = regime({ structure: { exemption: off.exemption } });
    if (!r) throw fail(422, "Choose the offering's exemption first.", { field: 'offering' });
    if (r !== '506b' && r !== '506c' && r !== 'other') throw fail(422, 'Data rooms are not offered for Regulation A offerings.', { field: 'offering' });
    const firm = obj(body.firm) || {};
    if (!str(firm.name)) throw fail(422, "Add the firm's name.", { field: 'firm' });
    const download = body.download === undefined || body.download === null || body.download === '' ? 'off' : body.download;
    if (download !== 'off' && download !== 'watermarked') throw fail(422, 'Choose whether documents can be downloaded: off or watermarked.', { field: 'download' });
    const nda = await ndaInput(body.nda);
    const room = { id: newId('rm'), type: 'room', workspace: c.workspace, offeringId, regime: r, openedAt: iso(), download, ndaMode: nda.mode, seq: 1 };
    room.sealed = seal(room.id, {
      offeringName: str(off.name),
      firm: { name: str(firm.name), notifyEmail: str(firm.notifyEmail, 254), supportEmail: str(firm.supportEmail, 254), postalAddress: str(firm.postalAddress, 400) },
      legend: clip(body.legend, 2000)
    });
    putOnce(room);
    writeNda(room, nda, 1);
    addEvent(room, 'opened', { data: { offeringId, regime: r, download, mode: nda.mode, version: nda.version, title: nda.title, by: c.actor.name } });
    return reply(res, 201, { id: room.id, regime: r, version: nda.version });
  }

  async function addDocument(req, res, c, room) {
    const body = await readBody(req, LIMITS.create);
    requireVault();
    const fileName = str(String(body.fileName || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_'), 120);
    if (!fileName) throw fail(422, 'Choose the document file.', { field: 'fileName' });
    const bytes = decode64(body.pdf, LIMITS.pdf, `${fileName} is larger than 25 MB.`, 'pdf');
    if (!isPdf(bytes)) throw fail(422, 'Data room documents are PDF files.', { field: 'pdf' });
    const pages = await pageCount(bytes);
    const digest = sha256(bytes);
    const title = str(body.title) || fileName;
    const id = newId('rd');
    const key = docBlob(id);
    sealBlob(key, bytes);
    const ev = addEvent(room, 'doc_added', { docId: id, data: { title, fileName, size: bytes.length, sha256: digest, pages, by: c.actor.name } });
    const rec = { id, type: 'doc', workspace: room.workspace, roomId: room.id, seq: ev.seq, size: bytes.length, sha256: digest, pages, addedAt: ev.at };
    rec.sealed = seal(id, { title, fileName });
    putOnce(rec);
    return reply(res, 201, { id, sha256: digest, pages });
  }

  function cleanBasis(room, b, by) {
    const x = obj(b);
    if (room.regime === '506b') {
      const kind = x && x.kind;
      const bad = !x || !KINDS.includes(kind) || !isDay(x.since) || x.enough !== true || (kind === 'introduced' && !str(x.introducedBy)) || (kind === 'other' && !str(x.note));
      if (bad) throw fail(422, S506B, { field: 'basis' });
    }
    if (!x) return null;
    return { kind: str(x.kind, 40) || 'other', since: str(x.since, 10), introducedBy: str(x.introducedBy), note: str(x.note, LIMITS.note), enough: x.enough === true, recordedBy: by, at: iso() };
  }
  function checkPerson(st, name, email) {
    if (!name) throw fail(422, "Type the prospect's name.", { field: 'name' });
    if (!isEmail(email)) throw fail(422, 'Enter a valid email address.', { field: 'email' });
    const lower = email.toLowerCase();
    const live = st.prospects.some((p) => !st.ended.has(p.id) && now() < Date.parse(p.expiresAt) && String((unseal(p) || {}).email || '').toLowerCase() === lower);
    if (live) throw fail(409, 'This email already has access to this data room.', { field: 'email' });
  }
  /** A prospect record, their first personal link and the prospect_invited event, written synchronously. */
  function writeProspect(room, { name, email, basis, days, by }) {
    const id = newId('rp');
    const expiresAt = iso(now() + days * 864e5);
    const ev = addEvent(room, 'prospect_invited', { prospectId: id, data: { name, email, basis, expiresAt, by } });
    const rec = { id, type: 'prospect', workspace: room.workspace, roomId: room.id, seq: ev.seq, invitedAt: ev.at, expiresAt };
    rec.sealed = seal(id, { name, email, basis });
    putOnce(rec);
    return rec;
  }
  async function invite(req, res, c, room) {
    const body = await readBody(req, LIMITS.small);
    requireVault();
    const st = stateOf(room);
    const name = str(body.name);
    const email = str(body.email, 254);
    const days = body.days === undefined || body.days === null || body.days === '' ? LIMITS.days : body.days;
    if (!(Number.isInteger(days) && days >= 1 && days <= LIMITS.days)) throw fail(422, 'Access lasts a whole number of days, from 1 to 90.', { field: 'days' });
    const base = portalAddress(body.portalUrl);
    void base;
    const basis = cleanBasis(room, body.basis, c.actor.name);
    checkPerson(st, name, email);
    const warning = room.regime === '506b' && basis && basis.since >= room.openedAt.slice(0, 10) ? LATE : '';
    const p = writeProspect(room, { name, email, basis, days, by: c.actor.name });
    const token = issueLink(room, p, c.actor.id);
    const link = linkFor(body.portalUrl, token);
    const notice = await ask({ kind: 'room_invite', variant: 'personal', workspace: room.workspace, roomId: room.id, prospectId: p.id, to: { name, email }, link, expiresAt: p.expiresAt, firm: firmOf(room) });
    return reply(res, 201, { prospectId: p.id, link, expiresAt: p.expiresAt, warning, notice });
  }

  /** Every event of the room strictly after since, in order, opened; at most PAGE per answer. */
  function activity(res, room, url) {
    const raw = url.searchParams.get('since');
    const since = raw === null || raw === '' ? 0 : Number(raw);
    if (!Number.isInteger(since) || since < 0) throw fail(400, 'since must be a whole number.');
    const all = recordsOf(room).filter((r) => r.type === 'event');
    let order = all.reduce((m, r) => (r.order > m ? r.order : m), since);
    const picked = all.filter((r) => r.order > since).sort((a, b) => a.order - b.order);
    const more = picked.length > PAGE;
    if (more) {
      picked.length = PAGE;
      order = picked[PAGE - 1].order;
    }
    return reply(res, 200, { order, more, items: picked.map(eventItem) });
  }
  const eventItem = (e) => ({ type: 'event', order: e.order, seq: e.seq, kind: e.kind, prospectId: e.prospectId, docId: e.docId, at: e.at, data: dataOf(e) });

  /** The room's records opened, for the console's merge after a restore. */
  function record(res, room) {
    const st = stateOf(room);
    const s = unseal(room) || {};
    const ndaVersions = st.ndas.map((n) => Object.assign({ version: n.version, mode: n.mode, at: n.at }, unseal(n) || {}));
    const documents = st.docs.map((d) => {
      const o = unseal(d) || {};
      const h = st.hidden.get(d.id);
      return { id: d.id, title: o.title || '', fileName: o.fileName || '', size: d.size, sha256: d.sha256, pages: d.pages, addedAt: d.addedAt, hiddenAt: h ? h.at : '', hiddenWhy: h ? (dataOf(h) || {}).why || '' : '', stored: !!store.getBlob(docBlob(d.id)) };
    });
    const prospects = st.prospects.map((p) => {
      const o = unseal(p) || {};
      const e = st.ended.get(p.id);
      return { id: p.id, name: o.name || '', email: o.email || '', basis: o.basis || null, invitedAt: p.invitedAt, expiresAt: p.expiresAt, endedAt: e ? e.at : '', links: st.links.filter((l) => !l.open && l.prospectId === p.id).length };
    });
    return reply(res, 200, {
      room: { id: room.id, offeringId: room.offeringId, offeringName: s.offeringName || '', regime: room.regime, openedAt: room.openedAt, download: room.download, ndaMode: room.ndaMode, firm: s.firm || null, legend: s.legend || '' },
      ndaVersions,
      documents,
      prospects,
      events: st.events.map(eventItem),
      chain: verify(room.id)
    });
  }

  async function sponsor(req, res, url, ctx) {
    const path = url.pathname;
    if (!sponsorPath(req.method, path)) return false;
    try {
      const m = req.method;
      if (m === 'POST' && limited(req)) throw fail(429, 'Too many requests. Wait a minute and try again.');
      const c = sponsorCtx(ctx);
      if (path === '/v1/rooms') {
        if (m === 'POST') return await createRoom(req, res, c);
        return reply(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
      }
      const parts = path.split('/').map(safeDecode); // ['', 'v1', 'rooms', id, ...]
      const room = roomIn(c.workspace, parts[3]);
      const what = parts.slice(4).join('/');
      const isGet = what === 'activity' || what === 'record';
      if (isGet ? m !== 'GET' : m !== 'POST') return reply(res, 405, { error: 'Method not allowed' }, { Allow: isGet ? 'GET' : 'POST' });
      if (!room) throw fail(404, 'Not found');
      if (what === 'documents') return await addDocument(req, res, c, room);
      if (what === 'prospects') return await invite(req, res, c, room);
      if (what === 'activity') return activity(res, room, url);
      if (what === 'record') return record(res, room);
      throw fail(404, 'Not found');
    } catch (e) {
      return failReply(res, e);
    }
  }

  /* ---------- the prospect's routes (X-Room-Token) ---------- */
  function roomView(st, p) {
    const s = unseal(st.room) || {};
    const firm = s.firm || {};
    const n = unseal(st.nda) || {};
    const agreed = agreedNow(st, p.id);
    return {
      firm: { name: firm.name || '' },
      offering: { name: s.offeringName || '' },
      legend: s.legend || '',
      nda: { mode: st.nda.mode, title: n.title || '', text: n.text || '', version: st.nda.version },
      agreed,
      documents: agreed ? shownDocs(st).map((d) => ({ id: d.id, title: (unseal(d) || {}).title || '', pages: d.pages, size: d.size })) : [],
      download: st.room.download,
      expiresAt: p.expiresAt,
      privacy: `Your views of these documents are recorded for ${firm.name || 'the firm'}.`
    };
  }
  async function agree(req, res, a) {
    const body = await readBody(req, LIMITS.nda);
    requireVault();
    const st = a.state;
    if (body.ticked !== true) throw fail(422, 'Tick the box to agree.', { field: 'ticked' });
    const name = str(body.name);
    if (!name) throw fail(422, 'Type your full name.', { field: 'name' });
    if (body.version !== st.nda.version) throw fail(409, 'The NDA has changed. Read the current version and agree again.', { field: 'version' });
    const email = (unseal(a.prospect) || {}).email || '';
    const ev = addEvent(a.room, 'assent', { prospectId: a.prospect.id, data: { version: st.nda.version, mode: 'click', name, email, ip: addressOf(req), agent: clip(req.headers['user-agent'], 300), envelopeId: '' } });
    const firm = firmOf(a.room);
    const notice = await ask({ kind: 'room_activity', variant: 'nda', workspace: a.room.workspace, roomId: a.room.id, prospectId: a.prospect.id, from: { name }, to: { name: firm.name, email: firm.notifyEmail } });
    return reply(res, 200, { agreed: true, version: st.nda.version, at: ev.at, notice });
  }

  /** The stamped copy for this prospect: from the sealed cache, or stamped once (concurrent first serves share one stamp). */
  const stamping = new Map();
  async function stampedCopy(a, doc, viewId) {
    const key = copyBlob(a.prospect.id, doc.id);
    const have = openBlob(key);
    if (have) return have;
    if (stamping.has(key)) return stamping.get(key);
    const job = (async () => {
      const { L, W } = tools();
      const clean = openBlob(docBlob(doc.id));
      if (!clean) throw fail(404, 'Not found');
      const s = unseal(a.room) || {};
      const p = unseal(a.prospect) || {};
      let out;
      try {
        out = await W.stamp(L, clean, { name: p.name, email: p.email, day: iso().slice(0, 10), viewId, room: `${s.offeringName || 'Offering'} data room`, firm: (s.firm || {}).name || '' });
      } catch {
        throw fail(422, 'This PDF could not be stamped.');
      }
      const bytes = Buffer.from(out.bytes);
      if (!store.getBlob(key)) sealBlob(key, bytes);
      return bytes;
    })();
    stamping.set(key, job);
    try {
      return await job;
    } finally {
      stamping.delete(key);
    }
  }
  async function serveDoc(req, res, a, docId) {
    const st = a.state;
    if (!agreedNow(st, a.prospect.id)) throw fail(403, NOT_AGREED);
    const doc = st.docs.find((d) => d.id === docId);
    if (!doc || st.hidden.has(doc.id)) throw fail(404, 'Not found');
    const served = (st.served.get(a.prospect.id) || []).filter((e) => e.docId === doc.id);
    const viewId = randomBytes(6).toString('base64url');
    const copyId = served.length ? (dataOf(served[0]) || {}).viewId : viewId;
    const bytes = await stampedCopy(a, doc, copyId);
    addEvent(a.room, 'view', { prospectId: a.prospect.id, docId: doc.id, data: { seconds: 0, pages: doc.pages, viewId, how: 'served', copy: copyId } });
    const fileName = (unseal(doc) || {}).fileName || 'document.pdf';
    const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    const query = new URL(req.url, 'http://room.invalid').searchParams;
    const attach = st.room.download === 'watermarked' && query.get('download') === '1';
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': bytes.length,
      'Content-Disposition': `${attach ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-View-Id': viewId,
      'X-Pages': String(doc.pages)
    });
    res.end(bytes);
    return true;
  }

  async function prospect(req, res, path, token) {
    const p = String(path || '');
    if (!prospectPath(req.method, p)) return false;
    try {
      const m = req.method;
      if (m === 'POST' && limited(req)) throw fail(429, 'Too many requests. Wait a minute and try again.');
      const gets = p === '/v1/room' || p === '/v1/room/nda.pdf' || p.startsWith('/v1/room/documents/');
      const both = p === '/v1/room/messages';
      if (!(both ? m === 'GET' || m === 'POST' : gets ? m === 'GET' : m === 'POST')) return reply(res, 405, { error: 'Method not allowed' }, { Allow: both ? 'GET, POST' : gets ? 'GET' : 'POST' });
      const a = findByToken(token);
      if (!a) throw fail(401, GONE);
      if (p === '/v1/room') return reply(res, 200, roomView(a.state, a.prospect));
      if (p === '/v1/room/nda') return await agree(req, res, a);
      if (p.startsWith('/v1/room/documents/')) return await serveDoc(req, res, a, safeDecode(p.slice('/v1/room/documents/'.length)));
      throw fail(404, 'Not found');
    } catch (e) {
      return failReply(res, e);
    }
  }

  /* ---------- the record check ---------- */
  /**
   * { ok: true, events } | { ok: false, brokenAt: seq, reason } when an entry's hash or place is wrong |
   * { ok: false, brokenAt: 0, reason } when a record beside the chain no longer matches what the chain recorded.
   */
  function verify(roomId) {
    const room = REC_ID.test(String(roomId || '')) ? store.get(C, roomId) : null;
    if (!room || room.type !== 'room') return { ok: false, brokenAt: 0, reason: 'No such data room.' };
    const recs = recordsOf(room);
    const events = recs.filter((r) => r.type === 'event').sort(bySeq);
    const datas = [];
    let prev = GENESIS;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const broken = { ok: false, brokenAt: i + 1, reason: `Entry ${i + 1} of the room's record does not match its hash.` };
      if (e.seq !== i + 1) return broken;
      let data;
      try {
        const s = unseal(e);
        data = s ? s.data : undefined;
      } catch {
        return broken;
      }
      if (e.prev !== prev || sha256(eventText(prev, Object.assign({}, e, { data }))) !== e.hash) return broken;
      datas.push(data || {});
      prev = e.hash;
    }
    const bad = (reason) => ({ ok: false, brokenAt: 0, reason });
    const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
    if (!events.length || events[0].kind !== 'opened') return bad("The room's record does not start with its opening.");
    const o = datas[0];
    if (room.offeringId !== o.offeringId || room.regime !== o.regime || room.openedAt !== events[0].at || room.download !== o.download || room.ndaMode !== o.mode) return bad("The room's opening details differ from the record.");
    const ndas = recs.filter((r) => r.type === 'nda').sort(bySeq);
    const ndaEvents = events.filter((e) => e.kind === 'opened' || e.kind === 'nda_text');
    if (ndas.length !== ndaEvents.length) return bad('The NDA versions differ from the record.');
    for (let i = 0; i < ndas.length; i++) {
      const n = ndas[i];
      const e = ndaEvents[i];
      const d = datas[e.seq - 1];
      let s;
      try {
        s = unseal(n) || {};
      } catch {
        return bad('The NDA versions differ from the record.');
      }
      const textOk = n.mode === 'esign' ? !!s.template && s.template.sha256 === n.version : sha256(String(s.text || '')) === n.version;
      if (n.seq !== e.seq || n.version !== d.version || n.mode !== (d.mode || room.ndaMode) || s.title !== d.title || !textOk) return bad('The NDA versions differ from the record.');
    }
    const docs = recs.filter((r) => r.type === 'doc');
    const docEvents = events.filter((e) => e.kind === 'doc_added');
    if (docs.length !== docEvents.length) return bad('The documents differ from the record.');
    for (const e of docEvents) {
      const d = docs.find((x) => x.id === e.docId);
      const v = datas[e.seq - 1];
      let s;
      try {
        s = d ? unseal(d) || {} : null;
      } catch {
        s = null;
      }
      if (!d || !s || d.seq !== e.seq || d.size !== v.size || d.sha256 !== v.sha256 || d.pages !== v.pages || d.addedAt !== e.at || s.title !== v.title || s.fileName !== v.fileName) return bad(`Document ${e.docId} differs from the record.`);
    }
    const pros = recs.filter((r) => r.type === 'prospect');
    const proEvents = events.filter((e) => e.kind === 'prospect_invited');
    if (pros.length !== proEvents.length) return bad('The prospects differ from the record.');
    for (const e of proEvents) {
      const p = pros.find((x) => x.id === e.prospectId);
      const v = datas[e.seq - 1];
      let s;
      try {
        s = p ? unseal(p) || {} : null;
      } catch {
        s = null;
      }
      if (!p || !s || p.seq !== e.seq || p.invitedAt !== e.at || p.expiresAt !== v.expiresAt || s.name !== v.name || s.email !== v.email || !same(s.basis, v.basis)) return bad(`Prospect ${e.prospectId} differs from the record.`);
    }
    const docIds = new Set(docEvents.map((e) => e.docId));
    const proIds = new Set(proEvents.map((e) => e.prospectId));
    const hiddenSeen = new Set();
    const endedSeen = new Set();
    for (const e of events) {
      switch (e.kind) {
        case 'opened':
        case 'nda_text':
        case 'doc_added':
        case 'prospect_invited':
          break;
        case 'link':
          if (e.prospectId) return bad(`Entry ${e.seq} of the room's record is not valid.`);
          break;
        case 'doc_hidden':
          if (!docIds.has(e.docId) || hiddenSeen.has(e.docId)) return bad(`Entry ${e.seq} of the room's record is not valid.`);
          hiddenSeen.add(e.docId);
          break;
        case 'prospect_ended':
          if (!proIds.has(e.prospectId) || endedSeen.has(e.prospectId)) return bad(`Entry ${e.seq} of the room's record is not valid.`);
          endedSeen.add(e.prospectId);
          break;
        case 'assent':
        case 'interest':
          if (!proIds.has(e.prospectId)) return bad(`Entry ${e.seq} of the room's record is not valid.`);
          break;
        case 'view':
          if (!proIds.has(e.prospectId) || !docIds.has(e.docId)) return bad(`Entry ${e.seq} of the room's record is not valid.`);
          break;
        default:
          return bad(`Entry ${e.seq} of the room's record is of an unknown kind.`);
      }
    }
    return { ok: true, events: events.length };
  }

  return { sponsorPath, prospectPath, sponsor, prospect, findByToken, verify, LIMITS, GENESIS, eventText, regime };
}
