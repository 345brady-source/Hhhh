// gate: tests 15
// The server's data room (plan 14-05; MS-11 to MS-15): rooms, NDA versions, documents, prospects, assents, views and
// indications kept sealed and written once, the 506(b) rules enforced on the server, and every document a prospect opens
// stamped with their name on the server. The mount (plan 14-08) builds the sponsor's context from the phase 15 session;
// here a test-only header carries it. Prospects use their room link's token (X-Room-Token). Every name, address and
// number is invented (addresses at example.invalid, numbers never issued); fixture PDFs are drawn here with the shipped
// writer, with invented text only.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDataRoom } from '../lib/dataroom.mjs';
import { createInbox } from '../lib/inbox.mjs';
import { openVault } from '../lib/vault.mjs';

/* ---------- the module may never write to the console: every call during this file is counted ---------- */
const consoleCalls = [];
for (const k of ['log', 'error', 'warn', 'info', 'debug']) {
  const orig = console[k].bind(console);
  console[k] = (...a) => {
    consoleCalls.push(k);
    orig(...a);
  };
}

const require = createRequire(import.meta.url);
const L = require(fileURLToPath(new URL('../../assets/vendor/pdfwrite/write.js', import.meta.url)));
const WM = require(fileURLToPath(new URL('../../assets/js/watermark.js', import.meta.url)));
const MODULE_FILE = fileURLToPath(new URL('../lib/dataroom.mjs', import.meta.url));

const KEY = randomBytes(32).toString('base64');
const T0 = Date.parse('2027-01-20T15:00:00Z');
const DAY = 864e5;
const MB = 1048576;
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const FIRM = { name: 'Kestrel Bay Capital', notifyEmail: 'ir@kestrel.example.invalid', supportEmail: 'help@kestrel.example.invalid', postalAddress: '100 Example Street, Suite 0, Nowhere, ZZ 00000' };
const SPONSOR = { workspace: 'ws-kb', actor: { id: 'u-1', name: 'Dana Admin' } };
const OTHER_WS = { workspace: 'ws-other', actor: { id: 'u-9', name: 'Other Admin' } };
const ONE = { name: 'Prospect One', email: 'prospect.one@example.invalid' };
const TWO = { name: 'Prospect Two', email: 'prospect.two@example.invalid' };
const NDA_TEXT = 'The recipient keeps the documents in this room confidential and uses them only to consider the offering.';
const NDA_TEXT_2 = 'The recipient keeps the documents in this room confidential, uses them only to consider the offering and returns them on request.';
const LEGEND = 'Confidential. For the named recipient only.';
const BASIS = { kind: 'investor', since: '2025-03-01', introducedBy: '', note: 'Invested with the firm in its first fund', enough: true };
const PORTAL = 'https://portal.example.invalid/portal.html?tenant=ws-kb&server=https://old.example.invalid';
const PUBLIC = 'https://api.example.invalid';
const offering = (exemption, id = 'off-2') => ({ id, name: 'Harbor Fund II', exemption });

/* ---------- fixture PDFs, drawn with the shipped writer (invented text only) ---------- */
const FIXED = new Date(Date.UTC(2026, 0, 15, 0, 0, 0));
const PARAS = [
  'This memorandum describes an invented offering prepared only to test the data room. It is not an offer to sell or a solicitation of an offer to buy any security.',
  'The fund will invest in a small number of private companies over a period of about four years and hold each investment for five to seven years.',
  'Investors should read the whole memorandum, the limited partnership agreement and the subscription documents before deciding whether to invest.',
  'An investment in the fund is speculative, involves a high degree of risk and is suitable only for persons who can bear the loss of their entire investment.'
];
function wrap(text, font, size, max) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
async function textDoc(pages, label) {
  const doc = await L.PDFDocument.create();
  const font = await doc.embedFont(L.StandardFonts.Helvetica);
  for (let n = 1; n <= pages; n++) {
    const page = doc.addPage([612, 792]);
    let y = 730;
    page.drawText(`Private placement memorandum (sample): ${label}`, { x: 56, y, size: 14, font });
    y -= 30;
    for (let k = 0; k < 4; k++) {
      for (const l of wrap(PARAS[(n + k) % PARAS.length], font, 11, 500)) {
        page.drawText(l, { x: 56, y, size: 11, font });
        y -= 16;
      }
      y -= 10;
    }
    page.drawText(`Page ${n} of ${pages}`, { x: 56, y: 40, size: 9, font });
  }
  doc.setTitle(`Private placement memorandum (sample): ${label}`);
  doc.setCreationDate(FIXED);
  doc.setModificationDate(FIXED);
  return doc;
}
/** An invented memorandum; the writer's own default metadata is left on it (the stamp must replace it). */
const memo = async (pages = 2, label = 'Harbor Fund II') => Buffer.from(await (await textDoc(pages, label)).save({ useObjectStreams: false }));
/** About `bytes` bytes: 40 text pages and one page holding one generated image (used only to measure). */
async function big(bytes) {
  const doc = await textDoc(40, 'Large sample');
  const base = (await doc.save({ useObjectStreams: false })).length;
  const width = 2000;
  const height = Math.max(1, Math.floor((bytes - base - 4096) / (width * 3)));
  const pixels = Buffer.alloc(width * height * 3);
  let s = 0x2545f491;
  for (let i = 0; i + 4 <= pixels.length; i += 4) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    pixels.writeUInt32LE(s >>> 0, i);
  }
  const data = zlib.deflateSync(pixels, { level: 1 });
  const image = doc.context.stream(data, { Type: 'XObject', Subtype: 'Image', Width: width, Height: height, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'FlateDecode' });
  const ref = doc.context.register(image);
  const page = doc.addPage([612, 792]);
  const name = page.node.newXObject('Im', ref);
  page.pushOperators(L.pushGraphicsState(), L.concatTransformationMatrix(500, 0, 0, 600, 56, 96), L.drawObject(name), L.popGraphicsState());
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
/** The hex form the writer gives a standard-font text (one byte per character), lower case. */
const hexOf = (s) => Array.from(s, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
/** Every page's content streams, inflated, as one lower-case text per page. */
async function pageTexts(bytes) {
  const doc = await L.PDFDocument.load(bytes, { updateMetadata: false });
  return doc.getPages().map((page) => {
    const c = page.node.Contents();
    const refs = c instanceof L.PDFArray ? c.asArray() : [c];
    return refs
      .map((r) => {
        const st = r instanceof L.PDFRef ? doc.context.lookup(r) : r;
        const raw = Buffer.from(st.getContents ? st.getContents() : st.contents);
        const filter = st.dict.get(L.PDFName.of('Filter'));
        return (filter && String(filter) === '/FlateDecode' ? zlib.inflateSync(raw) : raw).toString('latin1');
      })
      .join('\n')
      .toLowerCase();
  });
}
/** The writer library's names wherever they could be: plain, hex of Latin-1, hex of UTF-16. */
function libraryNames(bytes) {
  const t = Buffer.from(bytes).toString('latin1').toLowerCase();
  const u16 = (s) => Array.from(s, (c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  return ['pdf-lib', 'hopding'].filter((w) => t.includes(w) || t.includes(hexOf(w)) || t.includes(u16(w)) || t.includes(u16(w.replace(/./, (c) => c.toUpperCase()))));
}

/* ---------- the store stand-in (14-03's, W4): store.mjs's signatures and blob-key rule; every id written once ---------- */
const BLOB_KEY = /^[\w-]{1,120}$/;
const allStores = [];
function standInStore() {
  const data = { rooms: {}, inbox: {} };
  const blobs = new Map();
  const violations = [];
  const counts = [];
  const count = () => Object.keys(data.rooms).length + Object.keys(data.inbox).length + blobs.size;
  const s = {
    get: (kind, id) => data[kind][id] || null,
    put(kind, rec) {
      const was = data[kind][rec.id];
      if (was) {
        violations.push(`second write of ${kind} ${rec.id}`);
        throw new Error(`second write of ${kind} ${rec.id}`);
      }
      data[kind][rec.id] = Object.assign({}, rec, { updatedAt: new Date().toISOString() });
      counts.push(count());
      return data[kind][rec.id];
    },
    list: (kind) => Object.values(data[kind] || {}),
    remove(kind, id) {
      violations.push(`remove ${kind} ${id}`);
      throw new Error('remove is not allowed');
    },
    putBlob(key, buf) {
      if (!BLOB_KEY.test(String(key))) throw new Error('Bad blob key');
      if (blobs.has(key)) {
        violations.push(`second write of blob ${key}`);
        throw new Error(`second write of blob ${key}`);
      }
      blobs.set(key, Buffer.from(buf));
      counts.push(count());
    },
    getBlob: (key) => (blobs.has(key) ? blobs.get(key) : null),
    removeBlob(key) {
      violations.push(`removeBlob ${key}`);
      throw new Error('removeBlob is not allowed');
    },
    data: () => data,
    blobs,
    violations,
    counts
  };
  allStores.push(s);
  return s;
}
/** Every test: nothing was refused by the store and the record count only grew. */
test.afterEach(() => {
  for (const s of allStores) {
    assert.deepEqual(s.violations, []);
    for (let i = 1; i < s.counts.length; i++) assert.ok(s.counts[i] >= s.counts[i - 1], 'the record count only grows');
  }
});

/**
 * A test server: /v1/rooms* to room.sponsor, /v1/room* to room.prospect with the X-Room-Token header, /v1/inbox* to a real
 * inbox.sponsor on the same store (W5). The sponsor's context comes from a test-only header.
 */
async function withRoom(fn, opts = {}) {
  const store = opts.store || standInStore();
  const vault = openVault({ DATA_KEY: KEY });
  const clock = { t: opts.t0 || T0 };
  const calls = [];
  const notify = async (n) => {
    calls.push(JSON.parse(JSON.stringify(n)));
    return { status: 'sent' };
  };
  const limit = { on: false };
  const inbox = createInbox({ env: {}, store, vault, now: () => clock.t, limited: () => limit.on, notify });
  const room = createDataRoom({ env: opts.env || {}, store, vault, now: () => clock.t, limited: () => limit.on, notify, inbox, publicUrl: PUBLIC });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://room.test');
    const ctx = JSON.parse(req.headers['x-test-ctx'] || '{}');
    let handled = false;
    const p = url.pathname;
    if (p === '/v1/rooms' || p.startsWith('/v1/rooms/')) handled = await room.sponsor(req, res, url, ctx);
    else if (p === '/v1/room' || p.startsWith('/v1/room/')) handled = await room.prospect(req, res, p, req.headers['x-room-token']);
    else if (p.startsWith('/v1/inbox/')) handled = await inbox.sponsor(req, res, url, ctx);
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"Not found"}');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(method, path, o = {}) {
    const headers = Object.assign({}, o.headers || {});
    if (o.ctx) headers['x-test-ctx'] = JSON.stringify(o.ctx);
    if (o.token !== undefined) headers['x-room-token'] = o.token;
    const hasBody = o.body !== undefined || o.raw !== undefined;
    if (hasBody) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, { method, headers, body: o.raw !== undefined ? o.raw : hasBody ? JSON.stringify(o.body) : undefined });
    const buf = Buffer.from(await res.arrayBuffer());
    let parsed = null;
    try {
      parsed = JSON.parse(buf.toString('utf8'));
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed, bytes: buf, headers: res.headers };
  }
  const t = { room, inbox, store, vault, clock, calls, limit, call, base };
  t.sponsor = (method, path, body, ctx = SPONSOR) => call(method, path, { ctx, body });
  t.as = (token, method, path, body, headers) => call(method, path, { token, body, headers });
  /** Opens a room; returns its id. */
  t.open = async (over = {}) => {
    const r = await t.sponsor('POST', '/v1/rooms', Object.assign({ offering: offering('Rule 506(b)'), firm: FIRM, nda: { title: 'Confidentiality agreement', text: NDA_TEXT }, download: 'off', legend: LEGEND }, over));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.id;
  };
  t.addDoc = async (roomId, bytes, title = 'Private placement memorandum', fileName = 'Harbor_Fund_II_PPM.pdf') => t.sponsor('POST', `/v1/rooms/${roomId}/documents`, { title, fileName, pdf: Buffer.from(bytes).toString('base64') });
  t.invite = async (roomId, who = ONE, over = {}) => t.sponsor('POST', `/v1/rooms/${roomId}/prospects`, Object.assign({ name: who.name, email: who.email, basis: BASIS, portalUrl: PORTAL }, over));
  /** Invites and returns { prospectId, token, link, expiresAt }. */
  t.invited = async (roomId, who = ONE, over = {}) => {
    const r = await t.invite(roomId, who, over);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return Object.assign({ token: r.body.link.split('#room-')[1] }, r.body);
  };
  t.agree = async (token, name = ONE.name) => {
    const g = await t.as(token, 'GET', '/v1/room');
    return t.as(token, 'POST', '/v1/room/nda', { name, ticked: true, version: g.body.nda.version });
  };
  t.activity = async (roomId, since = 0) => (await t.sponsor('GET', `/v1/rooms/${roomId}/activity?since=${since}`)).body;
  try {
    await fn(t);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

/* ---------- 1. tracer ---------- */
test('tracer: a 506(b) room, one prospect invited with their basis, the NDA agreed, a stamped document served, the activity has the assent and the view', async () => {
  await withRoom(async (t) => {
    const roomId = await t.open();
    assert.match(roomId, /^rm_/);
    const original = await memo(2);
    const d = await t.addDoc(roomId, original);
    assert.equal(d.status, 201, JSON.stringify(d.body));
    assert.equal(d.body.pages, 2);
    assert.equal(d.body.sha256, sha(original));
    const docId = d.body.id;

    const inv = await t.invite(roomId);
    assert.equal(inv.status, 201, JSON.stringify(inv.body));
    assert.ok(inv.body.link.includes('#room-'), inv.body.link);
    const token = inv.body.link.split('#room-')[1];
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(inv.body.link.startsWith('https://portal.example.invalid/portal.html?tenant=ws-kb&server=' + encodeURIComponent(PUBLIC)), inv.body.link);
    assert.equal(inv.body.expiresAt, new Date(T0 + 90 * DAY).toISOString());
    assert.equal(inv.body.warning, '');
    const invite = t.calls.find((c) => c.kind === 'room_invite');
    assert.ok(invite, 'notify was asked for the invitation');
    assert.equal(invite.variant, 'personal');
    assert.equal(invite.to.email, ONE.email);
    const inviteJson = JSON.stringify(invite);
    for (const secret of [NDA_TEXT, BASIS.note, '2025-03-01']) assert.ok(!inviteJson.includes(secret), `the notice holds ${secret}`);

    const before = await t.as(token, 'GET', '/v1/room');
    assert.equal(before.status, 200, JSON.stringify(before.body));
    assert.equal(before.body.nda.text, NDA_TEXT);
    assert.equal(before.body.agreed, false);
    assert.deepEqual(before.body.documents, []);
    assert.equal(before.body.firm.name, FIRM.name);
    assert.equal(before.body.privacy, `Your views of these documents are recorded for ${FIRM.name}.`);

    const early = await t.as(token, 'GET', `/v1/room/documents/${docId}`);
    assert.equal(early.status, 403);
    assert.equal(early.body.error, 'Agree to the NDA to open the documents.');

    const agree = await t.as(token, 'POST', '/v1/room/nda', { name: 'Prospect One', ticked: true, version: before.body.nda.version }, { 'User-Agent': 'Test browser 1.0' });
    assert.equal(agree.status, 200, JSON.stringify(agree.body));

    const after = await t.as(token, 'GET', '/v1/room');
    assert.equal(after.body.agreed, true);
    assert.deepEqual(after.body.documents.map((x) => x.id), [docId]);

    const got = await t.as(token, 'GET', `/v1/room/documents/${docId}`);
    assert.equal(got.status, 200, got.bytes.toString('utf8').slice(0, 200));
    assert.equal(got.headers.get('content-type'), 'application/pdf');
    assert.match(got.headers.get('content-disposition'), /^inline/);
    assert.equal(got.headers.get('cache-control'), 'no-store');
    assert.ok(!got.bytes.equals(original), 'the served copy differs from the clean file');
    const pages = await pageTexts(got.bytes);
    assert.equal(pages.length, 2);
    for (const p of pages) {
      assert.ok(p.includes(hexOf(ONE.name)), 'the name is on every page');
      assert.ok(p.includes(hexOf(ONE.email)), 'the email is on every page');
    }

    const act = await t.activity(roomId);
    const assent = act.items.filter((i) => i.kind === 'assent');
    assert.equal(assent.length, 1);
    assert.equal(assent[0].data.name, 'Prospect One');
    assert.equal(assent[0].data.email, ONE.email);
    assert.equal(assent[0].data.version, before.body.nda.version);
    assert.equal(assent[0].data.ip, '127.0.0.1');
    assert.equal(assent[0].data.agent, 'Test browser 1.0');
    assert.equal(assent[0].at, new Date(T0).toISOString());
    const views = act.items.filter((i) => i.kind === 'view');
    assert.equal(views.length, 1);
    assert.equal(views[0].data.how, 'served');
    assert.equal(views[0].docId, docId);
    assert.equal(views[0].prospectId, inv.body.prospectId);
    assert.equal(views[0].data.viewId, got.headers.get('x-view-id'));

    const v = t.room.verify(roomId);
    assert.equal(v.ok, true, JSON.stringify(v));
  });
});

/* ---------- 2. basis ---------- */
test('basis: a 506(b) room refuses a prospect without the full relationship basis and stores nothing; a basis dated on the opening day warns', async () => {
  await withRoom(async (t) => {
    const roomId = await t.open();
    const S506B = 'Record how you know this person before inviting them (Rule 506(b)).';
    const before = t.store.list('rooms').length;
    const bad = [
      { basis: null },
      { basis: Object.assign({}, BASIS, { enough: false }) },
      { basis: { kind: 'introduced', since: '2025-03-01', introducedBy: '', note: '', enough: true } },
      { basis: { kind: 'other', since: '2025-03-01', introducedBy: '', note: '', enough: true } },
      { basis: Object.assign({}, BASIS, { since: 'last spring' }) },
      { basis: Object.assign({}, BASIS, { kind: 'friend' }) }
    ];
    for (const over of bad) {
      const r = await t.invite(roomId, ONE, over);
      assert.equal(r.status, 422, JSON.stringify(over));
      assert.equal(r.body.error, S506B);
    }
    assert.equal(t.store.list('rooms').length, before, 'nothing was stored');
    assert.equal(t.calls.filter((c) => c.kind === 'room_invite').length, 0, 'notify was not called');
    const late = await t.invite(roomId, ONE, { basis: Object.assign({}, BASIS, { since: '2027-01-20' }) });
    assert.equal(late.status, 201, JSON.stringify(late.body));
    assert.equal(late.body.warning, 'A relationship that began with this offering is not pre-existing.');
    const introduced = await t.invite(roomId, TWO, { basis: { kind: 'introduced', since: '2024-06-01', introducedBy: 'A partner of the firm', note: '', enough: true } });
    assert.equal(introduced.status, 201);
    assert.equal(introduced.body.warning, '');
    const rec = (await t.sponsor('GET', `/v1/rooms/${roomId}/record`)).body;
    assert.deepEqual(rec.prospects.map((p) => p.basis.kind), ['investor', 'introduced']);
    assert.equal(rec.prospects[0].basis.recordedBy, SPONSOR.actor.name);
  });
});

/* ---------- 3. exempt ---------- */
test('exempt: Regulation A and an empty exemption are refused, a second room on the offering is 409, a 506(c) room needs no basis', async () => {
  await withRoom(async (t) => {
    const regA = await t.sponsor('POST', '/v1/rooms', { offering: offering('Regulation A Tier 2', 'off-a'), firm: FIRM, nda: { text: NDA_TEXT } });
    assert.equal(regA.status, 422);
    assert.equal(regA.body.error, 'Data rooms are not offered for Regulation A offerings.');
    const none = await t.sponsor('POST', '/v1/rooms', { offering: offering('', 'off-b'), firm: FIRM, nda: { text: NDA_TEXT } });
    assert.equal(none.status, 422);
    assert.equal(none.body.error, "Choose the offering's exemption first.");
    assert.equal(t.store.list('rooms').length, 0);
    const first = await t.open();
    const again = await t.sponsor('POST', '/v1/rooms', { offering: offering('Rule 506(b)'), firm: FIRM, nda: { text: NDA_TEXT } });
    assert.equal(again.status, 409);
    assert.equal(again.body.error, 'This offering already has a data room.');
    assert.equal(again.body.id, first);
    const other = await t.sponsor('POST', '/v1/rooms', { offering: offering('Rule 506(b)'), firm: FIRM, nda: { text: NDA_TEXT } }, OTHER_WS);
    assert.equal(other.status, 201, 'another workspace may open a room on its own offering of the same id');
    const c = await t.open({ offering: offering('Rule 506(c)', 'off-c') });
    const open = await t.invite(c, ONE, { basis: undefined });
    assert.equal(open.status, 201, JSON.stringify(open.body));
    const foreign = await t.sponsor('POST', `/v1/rooms/${c}/prospects`, { name: TWO.name, email: TWO.email, portalUrl: PORTAL }, OTHER_WS);
    assert.equal(foreign.status, 404, "another workspace's room is not found");
  });
});

/* ---------- 4. openlink ---------- */
test('openlink: refused in a 506(b) room; in a 506(c) room a shared link lets a prospect join and get a personal link; it opens nothing else and stops when turned off', async () => {
  await withRoom(async (t) => {
    const b = await t.open();
    const refused = await t.sponsor('POST', `/v1/rooms/${b}/open-link`, { on: true, portalUrl: PORTAL });
    assert.equal(refused.status, 422);
    assert.equal(refused.body.error, 'A 506(b) room has personal links only.');
    const c = await t.open({ offering: offering('Rule 506(c)', 'off-c') });
    const on = await t.sponsor('POST', `/v1/rooms/${c}/open-link`, { on: true, portalUrl: PORTAL });
    assert.equal(on.status, 200, JSON.stringify(on.body));
    const openToken = on.body.link.split('#room-')[1];
    assert.match(openToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal((await t.as(openToken, 'GET', '/v1/room')).status, 401, 'the shared link opens nothing but join');
    const joined = await t.as(openToken, 'POST', '/v1/room/join', { name: ONE.name, email: ONE.email });
    assert.equal(joined.status, 201, JSON.stringify(joined.body));
    const personal = joined.body.link.split('#room-')[1];
    assert.notEqual(personal, openToken);
    assert.equal(joined.body.expiresAt, new Date(T0 + 90 * DAY).toISOString());
    assert.equal((await t.as(personal, 'GET', '/v1/room')).status, 200);
    const n = t.calls.find((x) => x.kind === 'room_invite' && x.variant === 'open');
    assert.ok(n, 'the personal link is also sent');
    assert.equal(n.to.email, ONE.email);
    const rec = (await t.sponsor('GET', `/v1/rooms/${c}/record`)).body;
    assert.equal(rec.prospects.length, 1);
    assert.equal(rec.prospects[0].basis.kind, 'open');
    const off = await t.sponsor('POST', `/v1/rooms/${c}/open-link`, { on: false });
    assert.equal(off.status, 200);
    assert.deepEqual(off.body, {});
    const late = await t.as(openToken, 'POST', '/v1/room/join', { name: TWO.name, email: TWO.email });
    assert.equal(late.status, 401);
    assert.equal(late.body.error, 'This link is no longer active.');
    assert.equal((await t.as(personal, 'GET', '/v1/room')).status, 200, 'a joined prospect keeps their personal link');
    const kinds = (await t.activity(c)).items.filter((i) => i.kind === 'link').map((i) => i.data.on);
    assert.deepEqual(kinds, [true, false]);
    assert.equal(t.room.verify(c).ok, true);
  });
});

/* ---------- 5. tokens ---------- */
test('tokens: only hashes are stored; a new link stops the old one; ending and expiry stop it; one prospect never reaches another', async () => {
  await withRoom(async (t) => {
    const roomId = await t.open();
    const d = await t.addDoc(roomId, await memo(2));
    const a = await t.invited(roomId, ONE);
    const b = await t.invited(roomId, TWO);
    assert.equal(a.expiresAt, new Date(T0 + 90 * DAY).toISOString(), '90 days by default');
    const long = await t.invite(roomId, { name: 'Prospect Three', email: 'prospect.three@example.invalid' }, { days: 91 });
    assert.equal(long.status, 422, 'more than 90 days is refused');
    const renewed = await t.sponsor('POST', `/v1/rooms/${roomId}/prospects/${a.prospectId}/link`, { portalUrl: PORTAL });
    assert.equal(renewed.status, 201, JSON.stringify(renewed.body));
    const a2 = renewed.body.link.split('#room-')[1];
    assert.equal(renewed.body.expiresAt, a.expiresAt);
    const old = await t.as(a.token, 'GET', '/v1/room');
    assert.equal(old.status, 401);
    assert.equal(old.body.error, 'This link is no longer active.');
    assert.equal((await t.as(a2, 'GET', '/v1/room')).status, 200);
    const json = JSON.stringify(t.store.data());
    for (const tok of [a.token, a2, b.token]) {
      assert.ok(!json.includes(tok), 'no token is stored');
      assert.ok(json.includes(createHash('sha256').update(tok).digest('hex')), 'its hash is');
    }
    assert.equal((await t.agree(a2, ONE.name)).status, 200);
    assert.equal((await t.agree(b.token, TWO.name)).status, 200);
    const bCopy = await t.as(b.token, 'GET', `/v1/room/documents/${d.body.id}`);
    assert.equal(bCopy.status, 200);
    const aCopy = await t.as(a2, 'GET', `/v1/room/documents/${d.body.id}`);
    assert.equal(aCopy.status, 200);
    const aText = (await pageTexts(aCopy.bytes)).join('\n');
    assert.ok(aText.includes(hexOf(ONE.email)) && !aText.includes(hexOf(TWO.email)), "A's copy is A's");
    assert.notEqual(aCopy.headers.get('x-view-id'), bCopy.headers.get('x-view-id'));
    const view = await t.as(a2, 'POST', '/v1/room/views', { docId: d.body.id, viewId: bCopy.headers.get('x-view-id'), seconds: 5, pages: 1 });
    assert.notEqual(view.status, 200, "A cannot report B's view");
    const aRoom = JSON.stringify((await t.as(a2, 'GET', '/v1/room')).body);
    assert.ok(!aRoom.includes(TWO.email) && !aRoom.includes(TWO.name), "A's room answer holds nothing of B");
    const end = await t.sponsor('POST', `/v1/rooms/${roomId}/prospects/${a.prospectId}/end`, {});
    assert.equal(end.status, 200, JSON.stringify(end.body));
    assert.equal((await t.as(a2, 'GET', '/v1/room')).status, 401, 'end stops the link');
    assert.equal((await t.sponsor('POST', `/v1/rooms/${roomId}/prospects/${a.prospectId}/end`, {})).status, 409);
    assert.equal((await t.sponsor('POST', `/v1/rooms/${roomId}/prospects/${a.prospectId}/link`, { portalUrl: PORTAL })).status, 409, 'an ended access gets no new link');
    const short = await t.invited(roomId, { name: 'Prospect Four', email: 'prospect.four@example.invalid' }, { days: 1 });
    assert.equal((await t.as(short.token, 'GET', '/v1/room')).status, 200);
    t.clock.t = T0 + DAY;
    assert.equal((await t.as(short.token, 'GET', '/v1/room')).status, 401, 'expiry stops the link');
    assert.equal((await t.as(b.token, 'GET', '/v1/room')).status, 200, 'B still opens the room');
    assert.equal((await t.as('x'.repeat(43), 'GET', '/v1/room')).status, 401);
    assert.equal((await t.as('', 'GET', '/v1/room')).status, 401);
    const rec = (await t.sponsor('GET', `/v1/rooms/${roomId}/record`)).body;
    assert.ok(rec.prospects.find((p) => p.id === a.prospectId).endedAt, 'the end is in the record');
    assert.equal(t.room.verify(roomId).ok, true);
  });
});

/* ---------- 6. nda ---------- */
test('nda: the box and a typed name are required, an old version is 409, a new NDA text asks again; the address is the socket unless a proxy is trusted', async () => {
  await withRoom(async (t) => {
    const roomId = await t.open();
    const d = await t.addDoc(roomId, await memo(2));
    const a = await t.invited(roomId, ONE);
    const v1 = (await t.as(a.token, 'GET', '/v1/room')).body.nda.version;
    assert.equal(v1, sha(NDA_TEXT));
    const unticked = await t.as(a.token, 'POST', '/v1/room/nda', { name: ONE.name, ticked: false, version: v1 });
    assert.equal(unticked.status, 422);
    assert.equal(unticked.body.error, 'Tick the box to agree.');
    const noName = await t.as(a.token, 'POST', '/v1/room/nda', { name: '  ', ticked: true, version: v1 });
    assert.equal(noName.status, 422);
    assert.equal(noName.body.error, 'Type your full name.');
    const spoofed = await t.as(a.token, 'POST', '/v1/room/nda', { name: ONE.name, ticked: true, version: v1 }, { 'X-Forwarded-For': '203.0.113.9' });
    assert.equal(spoofed.status, 200);
    let assents = (await t.activity(roomId)).items.filter((i) => i.kind === 'assent');
    assert.equal(assents[0].data.ip, '127.0.0.1', 'a spoofed X-Forwarded-For is not recorded without TRUST_PROXY');
    const nda = t.calls.filter((c) => c.kind === 'room_activity' && c.variant === 'nda');
    assert.equal(nda.length, 1);
    assert.ok(!JSON.stringify(nda[0]).includes(NDA_TEXT));
    const changed = await t.sponsor('POST', `/v1/rooms/${roomId}/nda`, { title: 'Confidentiality agreement (2)', text: NDA_TEXT_2 });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal(changed.body.version, sha(NDA_TEXT_2));
    assert.equal((await t.sponsor('POST', `/v1/rooms/${roomId}/nda`, { text: NDA_TEXT_2 })).status, 409, 'the same text again is refused');
    const g = (await t.as(a.token, 'GET', '/v1/room')).body;
    assert.equal(g.agreed, false);
    assert.deepEqual(g.documents, []);
    assert.equal(g.nda.text, NDA_TEXT_2);
    assert.equal((await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`)).status, 403);
    const old = await t.as(a.token, 'POST', '/v1/room/nda', { name: ONE.name, ticked: true, version: v1 });
    assert.equal(old.status, 409);
    assert.equal((await t.as(a.token, 'POST', '/v1/room/nda', { name: ONE.name, ticked: true, version: changed.body.version })).status, 200);
    assert.equal((await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`)).status, 200);
    const rec = (await t.sponsor('GET', `/v1/rooms/${roomId}/record`)).body;
    assert.deepEqual(rec.ndaVersions.map((n) => n.text), [NDA_TEXT, NDA_TEXT_2]);
    assents = (await t.activity(roomId)).items.filter((i) => i.kind === 'assent');
    assert.deepEqual(assents.map((x) => x.data.version), [v1, changed.body.version]);
    assert.equal(t.room.verify(roomId).ok, true);
  });
  await withRoom(
    async (t) => {
      const roomId = await t.open();
      const a = await t.invited(roomId, ONE);
      const v = (await t.as(a.token, 'GET', '/v1/room')).body.nda.version;
      assert.equal((await t.as(a.token, 'POST', '/v1/room/nda', { name: ONE.name, ticked: true, version: v }, { 'X-Forwarded-For': '203.0.113.9, 198.51.100.7' })).status, 200);
      const assent = (await t.activity(roomId)).items.find((i) => i.kind === 'assent');
      assert.equal(assent.data.ip, '198.51.100.7', 'behind a trusted proxy the rightmost entry is the address');
    },
    { env: { TRUST_PROXY: '1' } }
  );
});

/* ---------- 7. docs ---------- */
test('docs: PDF only, 25 MB, 30 shown; a hidden document is gone for prospects and kept in the record with its file', async () => {
  await withRoom(async (t) => {
    const roomId = await t.open();
    const notPdf = await t.addDoc(roomId, Buffer.from('PK\u0003\u0004 not a pdf'), 'Spreadsheet', 'model.xlsx');
    assert.equal(notPdf.status, 422);
    assert.equal(notPdf.body.error, 'Data room documents are PDF files.');
    const huge = Buffer.alloc(25 * MB + 1, 32);
    huge.write('%PDF-1.7\n', 0, 'latin1');
    const tooBig = await t.addDoc(roomId, huge, 'Huge', 'huge.pdf');
    assert.equal(tooBig.status, 413);
    assert.equal(tooBig.body.error, 'huge.pdf is larger than 25 MB.');
    const one = await memo(1, 'Short note');
    const ids = [];
    for (let i = 0; i < 30; i++) {
      const r = await t.addDoc(roomId, one, `Note ${i + 1}`, `note-${i + 1}.pdf`);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      ids.push(r.body.id);
    }
    const over = await t.addDoc(roomId, one, 'Note 31', 'note-31.pdf');
    assert.equal(over.status, 422);
    assert.equal(over.body.error, 'A data room shows at most 30 documents.');
    const hide = await t.sponsor('POST', `/v1/rooms/${roomId}/documents/${ids[0]}/hide`, { why: 'Replaced by a newer version' });
    assert.equal(hide.status, 200, JSON.stringify(hide.body));
    assert.equal((await t.sponsor('POST', `/v1/rooms/${roomId}/documents/${ids[0]}/hide`, { why: 'again' })).status, 409);
    const now31 = await t.addDoc(roomId, one, 'Note 31', 'note-31.pdf');
    assert.equal(now31.status, 201, 'after a hide the 31st is accepted');
    const a = await t.invited(roomId, ONE);
    assert.equal((await t.agree(a.token)).status, 200);
    const g = (await t.as(a.token, 'GET', '/v1/room')).body;
    assert.equal(g.documents.length, 30);
    assert.ok(!g.documents.some((x) => x.id === ids[0]), 'the hidden document is not listed');
    assert.equal((await t.as(a.token, 'GET', `/v1/room/documents/${ids[0]}`)).status, 404);
    const otherRoom = await t.open({ offering: offering('Rule 506(c)', 'off-c') });
    const elsewhere = await t.addDoc(otherRoom, one, 'Elsewhere', 'elsewhere.pdf');
    assert.equal((await t.as(a.token, 'GET', `/v1/room/documents/${elsewhere.body.id}`)).status, 404, "another room's document is 404");
    const rec = (await t.sponsor('GET', `/v1/rooms/${roomId}/record`)).body;
    const kept = rec.documents.find((x) => x.id === ids[0]);
    assert.ok(kept && kept.hiddenAt, 'the hidden document stays in the record with hiddenAt');
    assert.equal(kept.hiddenWhy, 'Replaced by a newer version');
    assert.ok(t.store.blobs.has(`rmd-${ids[0].slice(3)}`), 'its file is still stored');
    assert.equal(rec.documents.length, 31);
    assert.equal(t.room.verify(roomId).ok, true);
  });
});

/* ---------- 8. stamp ---------- */
test('stamp: each prospect gets a copy with only their own name, stamped once and then served from the sealed cache; the firm is the Producer; download only when allowed', async () => {
  const orig = WM.stamp;
  let stamps = 0;
  WM.stamp = async (...args) => {
    stamps++;
    return orig(...args);
  };
  try {
    await withRoom(async (t) => {
      const roomId = await t.open();
      const original = await memo(2);
      const d = await t.addDoc(roomId, original);
      const a = await t.invited(roomId, ONE);
      const b = await t.invited(roomId, TWO);
      await t.agree(a.token, ONE.name);
      await t.agree(b.token, TWO.name);
      const one = await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}?download=1`);
      const two = await t.as(b.token, 'GET', `/v1/room/documents/${d.body.id}`);
      assert.equal(one.status, 200);
      assert.equal(two.status, 200);
      assert.match(one.headers.get('content-disposition'), /^inline/, "with download 'off', ?download=1 still answers inline");
      assert.ok(!one.bytes.equals(two.bytes), 'the two copies differ');
      const t1 = (await pageTexts(one.bytes)).join('\n');
      const t2 = (await pageTexts(two.bytes)).join('\n');
      assert.ok(t1.includes(hexOf(ONE.name)) && t1.includes(hexOf(ONE.email)) && !t1.includes(hexOf(TWO.name)) && !t1.includes(hexOf(TWO.email)));
      assert.ok(t2.includes(hexOf(TWO.name)) && t2.includes(hexOf(TWO.email)) && !t2.includes(hexOf(ONE.name)) && !t2.includes(hexOf(ONE.email)));
      assert.equal(stamps, 2);
      const again = await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`);
      assert.equal(again.status, 200);
      assert.equal(stamps, 2, 'the second serve comes from the sealed cache');
      assert.ok(again.bytes.equals(one.bytes));
      assert.notEqual(again.headers.get('x-view-id'), one.headers.get('x-view-id'), 'each serve has its own view id');
      const cached = t.store.getBlob(`rms-${a.prospectId.slice(3)}-${d.body.id.slice(3)}`);
      assert.ok(cached && !cached.equals(one.bytes), 'the cached copy is sealed');
      const back = await L.PDFDocument.load(one.bytes, { updateMetadata: false });
      assert.equal(back.getProducer(), FIRM.name);
      assert.equal(back.getCreator(), FIRM.name);
      assert.deepEqual(libraryNames(one.bytes), []);
      assert.ok(libraryNames(original).length > 0, 'the fixture carried the library name before the stamp');
      const served = (await t.activity(roomId)).items.filter((i) => i.kind === 'view' && i.data.how === 'served');
      assert.equal(served.length, 3, 'each serve counts as a view');
      assert.equal(served[2].data.copy, served[0].data.viewId, "a cached copy keeps the first serve's view id");
    });
    await withRoom(async (t) => {
      const roomId = await t.open({ download: 'watermarked' });
      const d = await t.addDoc(roomId, await memo(2));
      const a = await t.invited(roomId, ONE);
      await t.agree(a.token);
      const before = stamps;
      const [x, y] = await Promise.all([t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`), t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`)]);
      assert.deepEqual([x.status, y.status], [200, 200]);
      assert.ok(x.bytes.equals(y.bytes), 'two first serves at once share one stamp');
      assert.equal(stamps - before, 1);
      const dl = await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}?download=1`);
      assert.equal(dl.status, 200);
      assert.match(dl.headers.get('content-disposition'), /^attachment/);
      const inline = await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`);
      assert.match(inline.headers.get('content-disposition'), /^inline/);
    });
  } finally {
    WM.stamp = orig;
  }
});

/* ---------- 9. esign ---------- */
test('esign: an e-signed NDA room serves the form and its template, keeps the signed copy and certificate sealed as the assent, and refuses what is not a PDF', async () => {
  await withRoom(async (t) => {
    const form = await memo(1, 'NDA form');
    const template = { title: 'Confidentiality agreement', roles: [{ id: 'prospect', label: 'Prospect' }], fields: [{ id: 'f1', role: 'prospect', type: 'signature', page: 1, x: 56, y: 100, w: 200, h: 40 }], pages: 1, pageSizes: [{ w: 612, h: 792 }], sha256: sha(form) };
    const mismatch = await t.sponsor('POST', '/v1/rooms', { offering: offering('Rule 506(c)', 'off-e'), firm: FIRM, nda: { mode: 'esign', title: 'NDA', template: Object.assign({}, template, { sha256: 'f'.repeat(64) }), pdf: form.toString('base64') } });
    assert.equal(mismatch.status, 422, 'the form must match its template');
    const roomId = await t.open({ offering: offering('Rule 506(c)', 'off-e'), nda: { mode: 'esign', title: 'Confidentiality agreement', template, pdf: form.toString('base64') } });
    const d = await t.addDoc(roomId, await memo(2));
    const a = await t.invited(roomId, ONE);
    const g = (await t.as(a.token, 'GET', '/v1/room')).body;
    assert.equal(g.nda.mode, 'esign');
    assert.equal(g.nda.text, undefined);
    assert.equal(g.nda.template.title, template.title);
    assert.equal(g.nda.template.sha256, g.nda.version);
    const pdf = await t.as(a.token, 'GET', '/v1/room/nda.pdf');
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(sha(pdf.bytes), g.nda.version, "the form served is the template's file");
    assert.deepEqual(libraryNames(pdf.bytes), [], 'the form names the firm, not the writer');
    assert.equal((await L.PDFDocument.load(pdf.bytes, { updateMetadata: false })).getProducer(), FIRM.name);
    const signed = await memo(1, 'NDA signed by Prospect One');
    const cert = await memo(1, 'Signing certificate');
    const notPdf = await t.as(a.token, 'POST', '/v1/room/nda', { mode: 'esign', name: ONE.name, version: g.nda.version, signed: Buffer.from('not a pdf').toString('base64'), certificate: cert.toString('base64') });
    assert.equal(notPdf.status, 422);
    const big10 = Buffer.alloc(10 * MB + 1, 32);
    big10.write('%PDF-1.7\n', 0, 'latin1');
    const tooBig = await t.as(a.token, 'POST', '/v1/room/nda', { mode: 'esign', name: ONE.name, version: g.nda.version, signed: big10.toString('base64'), certificate: cert.toString('base64') });
    assert.equal(tooBig.status, 413);
    const click = await t.as(a.token, 'POST', '/v1/room/nda', { name: ONE.name, ticked: true, version: g.nda.version });
    assert.equal(click.status, 422, 'an e-sign room is not agreed with a tick');
    assert.equal((await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`)).status, 403);
    const ok = await t.as(a.token, 'POST', '/v1/room/nda', { mode: 'esign', name: ONE.name, version: g.nda.version, signed: signed.toString('base64'), certificate: cert.toString('base64') });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const assent = (await t.activity(roomId)).items.find((i) => i.kind === 'assent');
    assert.equal(assent.data.mode, 'esign');
    assert.equal(assent.data.signed.sha256, sha(signed));
    assert.equal(assent.data.certificate.sha256, sha(cert));
    const keys = [...t.store.blobs.keys()].filter((k) => k.startsWith('rma-'));
    assert.equal(keys.length, 2);
    for (const k of keys) {
      const raw = t.store.getBlob(k);
      assert.ok(!raw.equals(signed) && !raw.equals(cert), 'both blobs are sealed');
    }
    const sKey = keys.find((k) => k.endsWith('-s'));
    assert.ok(t.vault.openBytes(t.store.getBlob(sKey), sKey).equals(signed));
    assert.equal((await t.as(a.token, 'GET', '/v1/room')).body.agreed, true);
    assert.equal((await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`)).status, 200, 'the documents open');
    const v = t.room.verify(roomId);
    assert.equal(v.ok, true, JSON.stringify(v));
    const clickRoom = await t.open();
    const p = await t.invited(clickRoom, TWO);
    assert.equal((await t.as(p.token, 'GET', '/v1/room/nda.pdf')).status, 404, 'a click room has no form');
  });
});

/* ---------- 10. views ---------- */
test('views: the room page reports pages and seconds against a view id the server issued to this prospect; served and page views come back apart', async () => {
  await withRoom(async (t) => {
    const roomId = await t.open();
    const d = await t.addDoc(roomId, await memo(3));
    const a = await t.invited(roomId, ONE);
    const b = await t.invited(roomId, TWO);
    await t.agree(a.token, ONE.name);
    await t.agree(b.token, TWO.name);
    const got = await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`);
    assert.equal(got.headers.get('x-pages'), '3');
    const viewId = got.headers.get('x-view-id');
    const bView = (await t.as(b.token, 'GET', `/v1/room/documents/${d.body.id}`)).headers.get('x-view-id');
    const ok = await t.as(a.token, 'POST', '/v1/room/views', { docId: d.body.id, viewId, seconds: 41, pages: 3 });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    for (const bad of [
      { docId: d.body.id, viewId: 'unknownid1', seconds: 5, pages: 1 },
      { docId: d.body.id, viewId: bView, seconds: 5, pages: 1 },
      { docId: d.body.id, viewId, seconds: -1, pages: 1 },
      { docId: d.body.id, viewId, seconds: 5, pages: -2 },
      { docId: d.body.id, viewId, seconds: 2.5, pages: 1 },
      { docId: d.body.id, viewId, seconds: 5, pages: 4 }
    ]) {
      const r = await t.as(a.token, 'POST', '/v1/room/views', bad);
      assert.equal(r.status, 422, JSON.stringify(bad));
    }
    const views = (await t.activity(roomId)).items.filter((i) => i.kind === 'view' && i.prospectId === a.prospectId);
    assert.deepEqual(views.map((v) => v.data.how), ['served', 'page']);
    assert.deepEqual([views[1].data.seconds, views[1].data.pages, views[1].data.viewId], [41, 3, viewId]);
    assert.equal(t.calls.filter((c) => c.kind === 'room_activity' && c.variant === 'view').length, 0, 'views are not emailed');
  });
});

/* ---------- 11. interest ---------- */
test('interest: indicated, changed and withdrawn are three entries in order; only an amount, a class and a note; no bank or taxpayer numbers; the notice has no amount', async () => {
  await withRoom(async (t) => {
    const roomId = await t.open();
    const a = await t.invited(roomId, ONE);
    const early = await t.as(a.token, 'POST', '/v1/room/interest', { kind: 'indicated' });
    assert.equal(early.status, 403, 'an indication needs the NDA first');
    await t.agree(a.token);
    const first = await t.as(a.token, 'POST', '/v1/room/interest', { kind: 'indicated' });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.interest.kind, 'indicated');
    assert.equal(first.body.interest.cents, null);
    const changed = await t.as(a.token, 'POST', '/v1/room/interest', { kind: 'changed', cents: 25000000, cls: 'A', note: 'Prefers the A class' });
    assert.equal(changed.status, 200);
    assert.equal((await t.as(a.token, 'GET', '/v1/room')).body.interest.cents, 25000000);
    const gone = await t.as(a.token, 'POST', '/v1/room/interest', { kind: 'withdrawn' });
    assert.equal(gone.status, 200);
    assert.equal(gone.body.interest, null);
    const extra = await t.as(a.token, 'POST', '/v1/room/interest', { kind: 'indicated', bank: 'anything' });
    assert.equal(extra.status, 422);
    assert.equal(extra.body.error, 'Only an amount, a class and a note are recorded.');
    const routing = await t.as(a.token, 'POST', '/v1/room/interest', { kind: 'indicated', note: 'routing 190000018' });
    assert.equal(routing.status, 422);
    assert.equal(routing.body.error, 'Bank and taxpayer numbers are not asked for here.');
    assert.equal((await t.as(a.token, 'POST', '/v1/room/interest', { kind: 'indicated', cents: 12.5 })).status, 422);
    assert.equal((await t.as(a.token, 'POST', '/v1/room/interest', { kind: 'promised' })).status, 422);
    const items = (await t.activity(roomId)).items.filter((i) => i.kind === 'interest');
    assert.deepEqual(items.map((i) => i.data.kind), ['indicated', 'changed', 'withdrawn']);
    assert.deepEqual(items[0].data, { kind: 'indicated', cents: null, cls: '', note: '' }, 'the earlier entry is unchanged');
    assert.deepEqual(items[1].data, { kind: 'changed', cents: 25000000, cls: 'A', note: 'Prefers the A class' });
    const notices = t.calls.filter((c) => c.kind === 'room_activity' && c.variant === 'interest');
    assert.equal(notices.length, 3);
    for (const n of notices) assert.ok(!JSON.stringify(n).includes('25000000') && !JSON.stringify(n).includes('Prefers'), 'no amount or note in the notice');
  });
});

/* ---------- 12. questions ---------- */
test("questions: a prospect's question goes to the firm through the inbox as the prospect's own thread; the prospect sees only their own", async () => {
  await withRoom(async (t) => {
    const roomId = await t.open();
    const a = await t.invited(roomId, ONE);
    const b = await t.invited(roomId, TWO);
    const q = await t.as(a.token, 'POST', '/v1/room/messages', { body: 'What is the minimum investment?' });
    assert.equal(q.status, 201, JSON.stringify(q.body));
    assert.equal((await t.as(b.token, 'POST', '/v1/room/messages', { body: 'When does the offering close?' })).status, 201);
    const warned = await t.as(a.token, 'POST', '/v1/room/messages', { body: 'My account is 190000018' });
    assert.equal(warned.status, 422, 'a number shape warns first');
    assert.equal(warned.body.warn, true);
    assert.equal((await t.as(a.token, 'POST', '/v1/room/messages', { body: 'Reference 190000018 is from your letter', anyway: true })).status, 201);
    const firm = await t.sponsor('GET', '/v1/inbox/updates?since=0');
    assert.equal(firm.status, 200);
    const msgs = firm.body.items.filter((i) => i.type === 'message');
    assert.equal(msgs.length, 3);
    assert.deepEqual(msgs[0].party, { kind: 'prospect', id: a.prospectId });
    assert.equal(msgs[0].roomId, roomId);
    assert.equal(msgs[0].author, ONE.name);
    assert.equal(msgs[0].body, 'What is the minimum investment?');
    const mine = await t.as(a.token, 'GET', '/v1/room/messages');
    assert.equal(mine.status, 200);
    assert.equal(mine.body.threads.length, 1);
    assert.equal(mine.body.threads[0].roomId, roomId);
    assert.deepEqual(mine.body.messages.map((m) => m.body), ['What is the minimum investment?', 'Reference 190000018 is from your letter']);
    assert.ok(!JSON.stringify(mine.body).includes('When does the offering close?'));
  });
});

/* ---------- 13. sealed ---------- */
test('sealed: the store holds no name, email, basis note, NDA text, typed name, address, browser, title or file name; every blob differs from its file', async () => {
  await withRoom(
    async (t) => {
      const roomId = await t.open();
      const original = await memo(2);
      const d = await t.addDoc(roomId, original, 'Harbor Fund II memorandum', 'Harbor_Fund_II_PPM.pdf');
      const a = await t.invited(roomId, ONE);
      const v = (await t.as(a.token, 'GET', '/v1/room')).body.nda.version;
      assert.equal((await t.as(a.token, 'POST', '/v1/room/nda', { name: 'Prospect One Typed', ticked: true, version: v }, { 'User-Agent': 'Distinct Test Browser/9.9', 'X-Forwarded-For': '198.51.100.23' })).status, 200);
      const copy = await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`);
      assert.equal(copy.status, 200);
      assert.equal((await t.as(a.token, 'POST', '/v1/room/interest', { kind: 'indicated', cents: 5000000, cls: 'A', note: 'Interested in the second close' })).status, 200);
      assert.equal((await t.as(a.token, 'POST', '/v1/room/messages', { body: 'Is the memorandum final?' })).status, 201);
      const assent = (await t.activity(roomId)).items.find((i) => i.kind === 'assent');
      assert.equal(assent.data.ip, '198.51.100.23');
      const json = JSON.stringify(t.store.data());
      for (const s of [ONE.name, ONE.email, BASIS.note, NDA_TEXT, 'Prospect One Typed', '198.51.100.23', 'Distinct Test Browser', 'Harbor Fund II memorandum', 'Harbor_Fund_II_PPM.pdf', 'Harbor Fund II', FIRM.postalAddress, FIRM.notifyEmail, LEGEND, 'Interested in the second close', 'Is the memorandum final?']) {
        assert.ok(!json.includes(s), `the store holds ${s}`);
      }
      assert.ok(t.store.blobs.size >= 2);
      for (const [key, buf] of t.store.blobs) {
        assert.equal(buf.subarray(0, 4).toString('latin1'), 'CVV1', `${key} is sealed`);
        assert.ok(!buf.equals(original) && !buf.equals(copy.bytes), `${key} differs from its file`);
        assert.ok(!buf.includes(Buffer.from('%PDF-')), `${key} holds no PDF in the clear`);
      }
    },
    { env: { TRUST_PROXY: '1' } }
  );
});

/* ---------- 14. nodelete and limits ---------- */
test('nodelete and limits: no route removes or rewrites; verify names a changed event and a changed record; 429, 413 and 405 everywhere; nothing on the console', async () => {
  const src = readFileSync(MODULE_FILE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
  assert.ok(!/\.remove\s*\(/.test(src) && !/removeBlob/.test(src), 'the module never calls a store removal');
  await withRoom(async (t) => {
    const roomId = await t.open({ offering: offering('Rule 506(c)', 'off-c') });
    const d = await t.addDoc(roomId, await memo(2));
    const a = await t.invited(roomId, ONE);
    await t.agree(a.token);
    const got = await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`);
    const pid = a.prospectId;
    const SP = ['/v1/rooms', `/v1/rooms/${roomId}/nda`, `/v1/rooms/${roomId}/documents`, `/v1/rooms/${roomId}/documents/${d.body.id}/hide`, `/v1/rooms/${roomId}/prospects`, `/v1/rooms/${roomId}/prospects/${pid}/link`, `/v1/rooms/${roomId}/prospects/${pid}/end`, `/v1/rooms/${roomId}/open-link`, `/v1/rooms/${roomId}/activity`, `/v1/rooms/${roomId}/record`];
    const PP = ['/v1/room', '/v1/room/nda', '/v1/room/nda.pdf', `/v1/room/documents/${d.body.id}`, '/v1/room/views', '/v1/room/interest', '/v1/room/messages', '/v1/room/join'];
    for (const m of ['DELETE', 'PUT', 'PATCH']) {
      for (const p of SP) assert.equal((await t.call(m, p, { ctx: SPONSOR, body: {} })).status, 405, `${m} ${p}`);
      for (const p of PP) assert.equal((await t.call(m, p, { token: a.token, body: {} })).status, 405, `${m} ${p}`);
    }
    t.limit.on = true;
    for (const p of SP.filter((x) => !/activity|record/.test(x))) assert.equal((await t.call('POST', p, { ctx: SPONSOR, body: {} })).status, 429, `POST ${p}`);
    for (const p of ['/v1/room/nda', '/v1/room/views', '/v1/room/interest', '/v1/room/messages', '/v1/room/join']) assert.equal((await t.call('POST', p, { token: a.token, body: {} })).status, 429, `POST ${p}`);
    t.limit.on = false;
    const pad = 'x'.repeat(17 * 1024);
    for (const [p, body] of [
      [`/v1/rooms/${roomId}/prospects`, { name: pad, email: TWO.email, portalUrl: PORTAL }],
      [`/v1/rooms/${roomId}/documents/${d.body.id}/hide`, { why: pad }],
      [`/v1/rooms/${roomId}/open-link`, { on: true, portalUrl: PORTAL, pad }]
    ])
      assert.equal((await t.sponsor('POST', p, body)).status, 413, `small call ${p}`);
    for (const [p, body] of [
      ['/v1/room/nda', { name: pad, ticked: true, version: 'x' }],
      ['/v1/room/views', { docId: d.body.id, viewId: got.headers.get('x-view-id'), seconds: 1, pages: 1, pad }],
      ['/v1/room/interest', { kind: 'indicated', note: pad }],
      ['/v1/room/messages', { body: pad }]
    ])
      assert.equal((await t.as(a.token, 'POST', p, body)).status, 413, `small call ${p}`);

    const before = t.room.verify(roomId);
    assert.equal(before.ok, true, JSON.stringify(before));
    const data = t.store.data().rooms;
    const ev = Object.values(data).find((r) => r.type === 'event' && r.kind === 'assent');
    const saved = ev.sealed;
    ev.sealed = t.vault.seal({ data: Object.assign({}, t.vault.open(saved, `rooms:${ev.id}:sealed`).data, { name: 'Somebody Else' }) }, `rooms:${ev.id}:sealed`);
    assert.deepEqual(t.room.verify(roomId), { ok: false, brokenAt: ev.seq, reason: `Entry ${ev.seq} of the room's record does not match its hash.` });
    ev.sealed = saved;
    const doc = data[d.body.id];
    doc.size += 1;
    const field = t.room.verify(roomId);
    assert.equal(field.ok, false);
    assert.equal(field.brokenAt, 0);
    assert.ok(field.reason.includes(d.body.id), field.reason);
    doc.size -= 1;
    const pro = data[pid];
    const was = pro.expiresAt;
    pro.expiresAt = new Date(T0 + 400 * DAY).toISOString();
    const p2 = t.room.verify(roomId);
    assert.deepEqual([p2.ok, p2.brokenAt], [false, 0]);
    assert.ok(p2.reason.includes(pid), p2.reason);
    pro.expiresAt = was;
    assert.equal(t.room.verify(roomId).ok, true, 'verify ok again once restored');
  });
  assert.deepEqual(consoleCalls, [], 'nothing was written to the console');
});

/* ---------- 15. measure ---------- */
test('measure: a PDF of about 25 MB is uploaded and served stamped on every page; the time is printed', async (tc) => {
  await withRoom(async (t) => {
    const input = await big(25600000);
    assert.ok(input.length >= 25000000 && input.length <= 26214400, `input ${input.length} bytes`);
    tc.diagnostic(`room stamp input: ${input.length} bytes`);
    const roomId = await t.open();
    const d = await t.addDoc(roomId, input, 'Large sample', 'large.pdf');
    assert.equal(d.status, 201, JSON.stringify(d.body));
    const a = await t.invited(roomId, ONE);
    await t.agree(a.token);
    const started = process.hrtime.bigint();
    const got = await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`);
    const ms = Number((process.hrtime.bigint() - started) / 1000000n);
    assert.equal(got.status, 200);
    tc.diagnostic(`room stamp 25 MB: ${ms} ms`);
    const pages = await pageTexts(got.bytes);
    assert.equal(pages.length, d.body.pages);
    assert.equal(pages.length, 41);
    assert.ok(pages.every((p) => p.includes(hexOf(ONE.name)) && p.includes(hexOf(ONE.email))), 'every page is stamped');
    const startedCached = process.hrtime.bigint();
    assert.equal((await t.as(a.token, 'GET', `/v1/room/documents/${d.body.id}`)).status, 200);
    tc.diagnostic(`room stamp 25 MB from the cache: ${Number((process.hrtime.bigint() - startedCached) / 1000000n)} ms`);
  });
});
