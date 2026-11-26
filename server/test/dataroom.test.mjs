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
