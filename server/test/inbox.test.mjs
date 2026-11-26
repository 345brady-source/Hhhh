// gate: tests 14
// The server's message record (plan 14-03; MS-01, MS-02, MS-06, MS-07, MS-09): threads, messages, read and notice
// events kept sealed and append-only, scoped to the authorized context the mount gives the module. The mount (plan
// 14-08) builds that context from the phase 15 session; here a test-only header carries it. Every name, address and
// number is invented (addresses at example.invalid, numbers never issued).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

const KEY = randomBytes(32).toString('base64');
const T0 = Date.parse('2027-01-20T15:00:00Z');
const MIN = 60e3;
const HOUR_MS = 60 * MIN;
const MB = 1048576;
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const FIRM = { name: 'Kestrel Bay Capital', notifyEmail: 'ir@kestrel.example.invalid', supportEmail: 'help@kestrel.example.invalid' };
const ONE = { party: { kind: 'investor', id: 'KB-1001' }, name: 'Investor One', email: 'one@example.invalid', offeringId: 'off-1', offerings: [{ id: 'off-1', name: 'Harbor Fund I' }] };
const TWO = { party: { kind: 'investor', id: 'KB-1002' }, name: 'Investor Two', email: 'two@example.invalid', offeringId: 'off-1', offerings: [{ id: 'off-1', name: 'Harbor Fund I' }] };
const THREE = { party: { kind: 'investor', id: 'KB-1003' }, name: 'Investor Three', email: 'three@example.invalid', offeringId: 'off-1', offerings: [{ id: 'off-1', name: 'Harbor Fund I' }] };
const SPONSOR = { workspace: 'ws-kb', actor: { id: 'u-1', name: 'Dana Admin' } };
const inv = (id, workspace = 'ws-kb') => ({ workspace, party: { kind: 'investor', id } });

/* ---------- file stand-ins built from their first bytes ---------- */
const pdf = (marker, size = 0) => {
  const head = Buffer.from(`%PDF-1.7\n% ${marker}\n1 0 obj << >> endobj\n`);
  const tail = Buffer.from('trailer << >>\n%%EOF\n');
  const pad = Math.max(0, size - head.length - tail.length);
  return Buffer.concat([head, Buffer.alloc(pad, 32), tail]);
};
const png = (marker) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`IHDR ${marker}`)]);
const jpeg = (marker) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`JFIF ${marker}`)]);
/** A stored zip (no compression) holding the named parts, with local headers, a central directory and its end record. */
function zip(parts) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of parts) {
    const n = Buffer.from(name);
    const data = Buffer.from(text);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(n.length, 26);
    locals.push(lh, n, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(n.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
const xlsx = () => zip([['[Content_Types].xml', '<Types/>'], ['xl/workbook.xml', '<workbook/>']]);
const docx = () => zip([['[Content_Types].xml', '<Types/>'], ['word/document.xml', '<document/>']]);
const att = (name, bytes) => ({ name, base64: bytes.toString('base64') });

/* ---------- the store stand-in: store.mjs's method signatures and blob-key rule; nothing can be removed ---------- */
const BLOB_KEY = /^[\w-]{1,120}$/;
const ONCE = ['thread', 'message', 'read', 'notice', 'client'];
const allStores = [];
function standInStore() {
  const data = { inbox: {} };
  const blobs = new Map();
  const violations = [];
  const counts = [];
  const count = () => Object.keys(data.inbox).length + blobs.size;
  const s = {
    get: (kind, id) => data[kind][id] || null,
    put(kind, rec) {
      const was = data[kind][rec.id];
      if (was && ONCE.includes(was.type)) {
        violations.push(`second write of ${was.type} ${rec.id}`);
        throw new Error(`second write of ${was.type} ${rec.id}`);
      }
      data[kind][rec.id] = Object.assign({}, was, rec, { updatedAt: new Date().toISOString() });
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
/** Every test: no put, remove or removeBlob was refused, and the record count only grew. */
test.afterEach(() => {
  for (const s of allStores) {
    assert.deepEqual(s.violations, []);
    for (let i = 1; i < s.counts.length; i++) assert.ok(s.counts[i] >= s.counts[i - 1], 'the record count only grows');
  }
});

/** A test server: /v1/inbox/* to inbox.sponsor, /v1/my-inbox* to inbox.party; the context comes from a test-only header. */
async function withInbox(fn, opts = {}) {
  const store = opts.store || standInStore();
  const vault = openVault({ DATA_KEY: KEY });
  const clock = { t: opts.t0 || T0 };
  const calls = [];
  const notifyMode = { status: 'sent', throws: false };
  const notify = async (n) => {
    calls.push(JSON.parse(JSON.stringify(n)));
    if (notifyMode.throws) throw new Error('mail down');
    return { status: notifyMode.status };
  };
  const limit = { on: false };
  const inbox = createInbox({ env: {}, store, vault, now: () => clock.t, limited: () => limit.on, notify: opts.noNotify ? null : notify });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://inbox.test');
    const ctx = JSON.parse(req.headers['x-test-ctx'] || '{}');
    let handled = false;
    if (url.pathname.startsWith('/v1/inbox/')) handled = await inbox.sponsor(req, res, url, ctx);
    else if (url.pathname === '/v1/my-inbox' || url.pathname.startsWith('/v1/my-inbox/')) handled = await inbox.party(req, res, url.pathname, ctx);
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"Not found"}');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(method, path, ctx, body, raw) {
    const headers = { 'x-test-ctx': JSON.stringify(ctx) };
    if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, { method, headers, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined });
    const buf = Buffer.from(await res.arrayBuffer());
    let parsed = null;
    try {
      parsed = JSON.parse(buf.toString('utf8'));
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed, bytes: buf, headers: res.headers };
  }
  const t = { inbox, store, vault, clock, calls, notifyMode, limit, call, base };
  /** The sponsor sends one message; returns the 201 body. */
  t.send = async (recipients, over = {}, ctx = SPONSOR) => {
    const r = await call('POST', '/v1/inbox/messages', ctx, Object.assign({ firm: FIRM, author: 'Dana Admin', body: 'Your capital account statement is ready.', attachments: [], recipients }, over));
    return r;
  };
  try {
    await fn(t);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

/* ---------- 1. tracer ---------- */
test('tracer: the firm sends, the investor reads and replies with a PDF, the console gets the read and the reply once each', async () => {
  await withInbox(async (t) => {
    const FIRM_BODY = 'Welcome to Harbor Fund I. Your first statement is attached soon.';
    const REPLY_BODY = 'Thank you, my signed side letter is attached.';
    const FILE_NAME = 'Side letter signed.pdf';
    const file = pdf('SIDELETTERMARK', 2000);

    const sent = await t.send([ONE], { clientId: 'c-tracer-1', body: FIRM_BODY });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    assert.equal(sent.body.broadcastId, '');
    assert.equal(sent.body.messages.length, 1);
    const fm = sent.body.messages[0];
    assert.equal(fm.seq, 1);
    assert.deepEqual(fm.party, ONE.party);
    assert.equal(fm.notice.status, 'sent');

    const mine = await t.call('GET', '/v1/my-inbox', inv('KB-1001'));
    assert.equal(mine.status, 200);
    assert.equal(mine.body.firm.name, FIRM.name);
    assert.deepEqual(mine.body.offerings, ONE.offerings);
    assert.equal(mine.body.prefs.notices, true);
    assert.equal(mine.body.threads.length, 1);
    assert.equal(mine.body.threads[0].id, fm.threadId);
    assert.equal(mine.body.threads[0].offeringId, 'off-1');
    assert.equal(mine.body.messages.length, 1);
    assert.equal(mine.body.messages[0].body, FIRM_BODY);
    assert.equal(mine.body.messages[0].author, 'Dana Admin');
    assert.equal(mine.body.messages[0].readAt, '');

    t.clock.t += 5 * MIN;
    const read = await t.call('POST', '/v1/my-inbox/read', inv('KB-1001'), { threadId: fm.threadId });
    assert.equal(read.status, 200);
    assert.equal(read.body.marked, 1);

    t.clock.t += MIN;
    const reply = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId: fm.threadId, body: REPLY_BODY, attachments: [att(FILE_NAME, file)] });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.equal(reply.body.message.seq, 2);
    assert.equal(reply.body.message.from, 'party');
    assert.equal(reply.body.message.attachments[0].kind, 'pdf');
    assert.equal(reply.body.message.attachments[0].sha256, sha(file));

    const up = await t.call('GET', '/v1/inbox/updates?since=0', SPONSOR);
    assert.equal(up.status, 200);
    // The firm message's notice event, the investor's read event and the investor's message, each once and in order.
    assert.deepEqual(up.body.items.map((i) => i.type), ['notice', 'read', 'message']);
    const [notice, rd, msg] = up.body.items;
    assert.equal(notice.messageId, fm.id);
    assert.equal(notice.status, 'sent');
    assert.equal(rd.messageId, fm.id);
    assert.equal(rd.at, new Date(T0 + 5 * MIN).toISOString());
    assert.equal(msg.id, reply.body.message.id);
    assert.equal(msg.body, REPLY_BODY);
    assert.equal(msg.author, 'Investor One');
    assert.equal(msg.threadId, fm.threadId);
    assert.deepEqual(msg.party, ONE.party);
    assert.equal(msg.attachments.length, 1);
    assert.equal(msg.attachments[0].name, FILE_NAME);
    assert.equal(msg.attachments[0].sha256, sha(file));
    assert.equal(up.body.more, false);
    const again = await t.call('GET', `/v1/inbox/updates?since=${up.body.order}`, SPONSOR);
    assert.equal(again.status, 200);
    assert.deepEqual(again.body.items, []);

    const got = await t.call('GET', `/v1/inbox/attachments/${msg.attachments[0].id}`, SPONSOR);
    assert.equal(got.status, 200);
    assert.ok(got.bytes.equals(file));
    assert.equal(got.headers.get('content-type'), 'application/pdf');
    assert.match(got.headers.get('content-disposition'), /^attachment;/);
    assert.equal(got.headers.get('cache-control'), 'no-store');

    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: true, count: 2 });

    assert.deepEqual(t.calls.map((c) => c.kind), ['message_notice', 'message_received']);
    assert.equal(t.calls[0].messageId, fm.id);
    assert.deepEqual(t.calls[0].to, { name: 'Investor One', email: 'one@example.invalid' });
    assert.equal(t.calls[1].messageId, reply.body.message.id);
    for (const c of t.calls) {
      const j = JSON.stringify(c);
      for (const secret of [FIRM_BODY, REPLY_BODY, FILE_NAME, 'Harbor Fund I']) assert.ok(!j.includes(secret), `notify got ${secret}`);
    }
  });
});

/* ---------- helpers for the later tests ---------- */
const recordCount = (t) => Object.keys(t.store.data().inbox).length + t.store.blobs.size;
const BANK = 'Bank and taxpayer numbers are not sent in messages. Payment instructions are on the capital call.';
const PASSWORD = 'Passwords are never sent in messages.';
const PARTY_WARN = 'Do not send taxpayer or bank numbers in a message; your Account page is the place for them.';

/* ---------- 2. scope ---------- */
test('scope: an investor sees only their own threads, messages and files; a prospect is kept apart from investors', async () => {
  await withInbox(async (t) => {
    const a = await t.send([ONE], { body: 'Only for Investor One.', attachments: [att('One only.pdf', pdf('ONEONLY'))] });
    assert.equal(a.status, 201);
    const b = await t.send([TWO], { body: 'Only for Investor Two.' });
    assert.equal(b.status, 201);
    const oneThread = a.body.messages[0].threadId;
    const oneFile = a.body.messages[0].attachments[0].id;

    const two = await t.call('GET', '/v1/my-inbox', inv('KB-1002'));
    assert.equal(two.status, 200);
    assert.deepEqual(two.body.threads.map((x) => x.id), [b.body.messages[0].threadId]);
    assert.deepEqual(two.body.messages.map((x) => x.body), ['Only for Investor Two.']);
    assert.ok(!JSON.stringify(two.body).includes(oneThread));
    assert.ok(!JSON.stringify(two.body).includes('Only for Investor One.'));

    assert.equal((await t.call('GET', `/v1/my-inbox/attachments/${oneFile}`, inv('KB-1002'))).status, 404);
    assert.equal((await t.call('GET', `/v1/my-inbox/attachments/${oneFile}`, inv('KB-1001'))).status, 200);
    const into = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1002'), { threadId: oneThread, body: 'Writing into another thread.' });
    assert.equal(into.status, 404);
    assert.equal((await t.call('POST', '/v1/my-inbox/read', inv('KB-1002'), { threadId: oneThread })).status, 404);
    const off = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1002'), { offeringId: 'off-9', body: 'About an offering I am not in.' });
    assert.equal(off.status, 422);
    assert.equal(off.body.field, 'offeringId');

    // A prospect's question through post() (plan 14-05): stored on its own thread, seen by the sponsor, never by an investor,
    // not even an investor whose id is the same as the prospect's.
    const q = await t.inbox.post('ws-kb', { party: { kind: 'prospect', id: 'pr-1' }, roomId: 'rm-1', from: 'party', author: 'Prospect One', body: 'Is the room still open for questions?' });
    assert.equal(q.from, 'party');
    assert.deepEqual(q.party, { kind: 'prospect', id: 'pr-1' });
    assert.equal(q.roomId, 'rm-1');
    const twin = await t.inbox.post('ws-kb', { party: { kind: 'prospect', id: 'KB-1001' }, roomId: 'rm-1', from: 'party', author: 'Prospect Twin', body: 'A prospect sharing an id with an investor.' });
    assert.notEqual(twin.threadId, oneThread);
    const up = await t.call('GET', '/v1/inbox/updates?since=0', SPONSOR);
    const msgs = up.body.items.filter((i) => i.type === 'message');
    assert.deepEqual(msgs.map((m) => m.id), [q.id, twin.id]);
    assert.equal(msgs[0].body, 'Is the room still open for questions?');
    for (const id of ['KB-1001', 'KB-1002']) {
      const mine = await t.call('GET', '/v1/my-inbox', inv(id));
      const j = JSON.stringify(mine.body);
      for (const x of [q.id, twin.id, q.threadId, twin.threadId, 'Is the room still open', 'sharing an id']) assert.ok(!j.includes(x), `${id} saw ${x}`);
    }
    assert.equal(t.inbox.list('ws-kb', { kind: 'investor', id: 'KB-1001' }).messages.length, 1);
    assert.equal(t.inbox.list('ws-kb', { kind: 'prospect', id: 'pr-1' }).messages.length, 1);
  });
});

/* ---------- 3. workspaces ---------- */
test('workspaces: every query is pinned to the context workspace; a workspace or party in a query or body changes nothing', async () => {
  await withInbox(async (t) => {
    const a = await t.send([ONE], { body: 'Kestrel Bay only.', attachments: [att('Kestrel.pdf', pdf('KESTRELONLY'))] });
    assert.equal(a.status, 201);
    const fileId = a.body.messages[0].attachments[0].id;
    const threadId = a.body.messages[0].threadId;
    const r = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId, body: 'A reply inside Kestrel Bay.' });
    assert.equal(r.status, 201);
    const other = { workspace: 'ws-other', actor: { id: 'u-9', name: 'Other Admin' } };

    const up = await t.call('GET', '/v1/inbox/updates?since=0&workspace=ws-kb', other);
    assert.equal(up.status, 200);
    assert.deepEqual(up.body.items, []);
    assert.equal((await t.call('GET', `/v1/inbox/attachments/${fileId}`, other)).status, 404);
    assert.equal((await t.call('POST', '/v1/inbox/read', other, { threadId })).status, 404);

    // The same investor id in another workspace sees nothing of ws-kb.
    const elsewhere = await t.call('GET', '/v1/my-inbox', inv('KB-1001', 'ws-other'));
    assert.equal(elsewhere.status, 200);
    assert.deepEqual(elsewhere.body.threads, []);
    assert.deepEqual(elsewhere.body.messages, []);
    assert.equal((await t.call('GET', `/v1/my-inbox/attachments/${fileId}`, inv('KB-1001', 'ws-other'))).status, 404);
    assert.equal((await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001', 'ws-other'), { threadId, body: 'Across workspaces.' })).status, 404);

    // A workspace named in the body is ignored: the message lands in the context's workspace.
    const s = await t.send([ONE], { workspace: 'ws-kb', body: 'Sent from the other firm.' }, other);
    assert.equal(s.status, 201);
    assert.equal(s.body.messages[0].seq, 1);
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: true, count: 2 });
    assert.deepEqual(t.inbox.verify('ws-other'), { ok: true, count: 1 });
    const one = await t.call('GET', '/v1/my-inbox', inv('KB-1001'));
    assert.ok(!JSON.stringify(one.body).includes('Sent from the other firm.'));

    // A party named in the investor's body is ignored: KB-1002's message lands in KB-1002's thread.
    const p = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1002'), { party: { kind: 'investor', id: 'KB-1001' }, workspace: 'ws-other', body: 'Pretending to be someone else.' });
    assert.equal(p.status, 201);
    assert.deepEqual(p.body.message.party, { kind: 'investor', id: 'KB-1002' });
    const mineOne = await t.call('GET', '/v1/my-inbox', inv('KB-1001'));
    assert.ok(!JSON.stringify(mineOne.body).includes('Pretending'));
    const two = await t.call('GET', '/v1/my-inbox', inv('KB-1002'));
    assert.deepEqual(two.body.messages.map((m) => m.body), ['Pretending to be someone else.']);
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: true, count: 3 });
  });
});

/* ---------- 4. sealed ---------- */
test('sealed: the store and its blobs hold no body, author, file name, name, email or firm address', async () => {
  await withInbox(async (t) => {
    const BODY1 = 'The first distribution is scheduled for March.';
    const BODY2 = 'Please confirm my mailing address change.';
    const f1 = pdf('SEALEDPDFMARK', 4000);
    const f2 = png('SEALEDPNGMARK');
    const a = await t.send([ONE], { body: BODY1, attachments: [att('Distribution schedule March.pdf', f1)] });
    assert.equal(a.status, 201);
    assert.equal((await t.send([TWO], { body: BODY1 })).status, 201);
    const r = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId: a.body.messages[0].threadId, body: BODY2, attachments: [att('Address proof photo.png', f2)] });
    assert.equal(r.status, 201);
    const json = JSON.stringify(t.store.data());
    for (const s of [BODY1, BODY2, 'Dana Admin', 'Distribution schedule March', 'Address proof photo', 'Investor One', 'Investor Two', 'one@example.invalid', 'two@example.invalid', FIRM.name, FIRM.notifyEmail, FIRM.supportEmail, 'Harbor Fund I']) {
      assert.ok(!json.includes(s), `the store holds ${s}`);
    }
    assert.equal(t.store.blobs.size, 2);
    for (const [key, blob] of t.store.blobs) {
      assert.match(key, /^ixa-[\w-]+$/);
      assert.ok(!blob.equals(f1) && !blob.equals(f2));
      const text = blob.toString('latin1');
      for (const s of ['SEALEDPDFMARK', 'SEALEDPNGMARK', '%PDF-']) assert.ok(!text.includes(s), `a blob holds ${s}`);
    }
    // Sealed values are bound to their record: a sealed body moved to another record does not open.
    const msgs = Object.values(t.store.data().inbox).filter((x) => x.type === 'message');
    assert.throws(() => t.vault.open(msgs[0].sealed, `inbox:${msgs[1].id}:sealed`));
  });
});

/* ---------- 5. attachments ---------- */
test('attachments: 10 MB each, 5 files, 25 MB together, strict base64; a refusal stores nothing', async () => {
  await withInbox(async (t) => {
    const ok = await t.send([ONE], { attachments: [att('Exactly ten.pdf', pdf('TEN', 10485760))] });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.messages[0].attachments[0].size, 10485760);
    const before = recordCount(t);
    const big = await t.send([ONE], { attachments: [att('One byte over.pdf', pdf('OVER', 10485761))] });
    assert.equal(big.status, 413);
    assert.equal(big.body.error, 'One byte over.pdf is larger than 10 MB.');
    const six = await t.send([ONE], { attachments: [1, 2, 3, 4, 5, 6].map((i) => att(`File ${i}.pdf`, pdf(`SIX${i}`))) });
    assert.equal(six.status, 422);
    assert.equal(six.body.error, 'A message can carry at most 5 files.');
    const three = await t.send([ONE], { attachments: [1, 2, 3].map((i) => att(`Part ${i}.pdf`, pdf(`PART${i}`, 8750000))) });
    assert.equal(three.status, 422);
    assert.equal(three.body.error, 'The files together are larger than 25 MB.');
    await assert.rejects(t.inbox.post('ws-kb', { party: ONE.party, from: 'firm', author: 'Dana Admin', body: 'Three files of 9 MB.', attachments: [1, 2, 3].map((i) => ({ name: `Nine ${i}.pdf`, bytes: pdf(`NINE${i}`, 9 * MB) })) }), (e) => e.status === 422 && e.message === 'The files together are larger than 25 MB.');
    const bad = await t.send([ONE], { attachments: [{ name: 'Broken.pdf', base64: 'not*base64!' }] });
    assert.equal(bad.status, 400);
    const noBytes = await t.send([ONE], { attachments: [{ name: 'Missing.pdf' }] });
    assert.equal(noBytes.status, 400);
    assert.equal(recordCount(t), before);
  });
});

/* ---------- 6. types ---------- */
test('types: the kind is read from the first bytes; investors send PDF, PNG or JPEG, the firm also XLSX, CSV or DOCX', async () => {
  await withInbox(async (t) => {
    const first = await t.send([ONE], { body: 'Workbook attached.', attachments: [att('Capital accounts.xlsx', xlsx()), att('Side letter.docx', docx()), att('Holdings.csv', Buffer.from('id,units\nKB-1001,10\n'))] });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.deepEqual(first.body.messages[0].attachments.map((a) => a.kind), ['xlsx', 'docx', 'csv']);
    const threadId = first.body.messages[0].threadId;
    const before = recordCount(t);
    const invXlsx = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId, body: 'My workbook.', attachments: [att('Mine.xlsx', xlsx())] });
    assert.equal(invXlsx.status, 422);
    assert.equal(invXlsx.body.error, 'Mine.xlsx is not a file type messages accept: PDF, PNG or JPEG.');
    const fake = await t.send([ONE], { attachments: [att('Not really.pdf', Buffer.from('plain text pretending'))] });
    assert.equal(fake.status, 422);
    assert.equal(fake.body.error, 'Not really.pdf is not a file type messages accept: PDF, PNG, JPEG, XLSX, CSV or DOCX.');
    const renamed = await t.send([ONE], { attachments: [att('Renamed.xlsx', zip([['readme.txt', 'hello']]))] });
    assert.equal(renamed.status, 422);
    assert.equal(renamed.body.error, 'Renamed.xlsx is not a file type messages accept: PDF, PNG, JPEG, XLSX, CSV or DOCX.');
    const nul = await t.send([ONE], { attachments: [att('Nul.csv', Buffer.from('a,b\n\u0000,1\n'))] });
    assert.equal(nul.status, 422);
    assert.equal(recordCount(t), before);
    const pics = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId, body: 'Photos of the signed page.', attachments: [att('Page one.png', png('PAGEONE')), att('Page two.jpg', jpeg('PAGETWO')), att('Scan.pdf', png('SCANNEDPNG'))] });
    assert.equal(pics.status, 201, JSON.stringify(pics.body));
    assert.deepEqual(pics.body.message.attachments.map((a) => a.kind), ['png', 'jpeg', 'png']);
    const got = await t.call('GET', `/v1/inbox/attachments/${pics.body.message.attachments[2].id}`, SPONSOR);
    assert.equal(got.status, 200);
    assert.equal(got.headers.get('content-type'), 'image/png');
    assert.ok(got.bytes.equals(png('SCANNEDPNG')));
  });
});

/* ---------- 7. screen ---------- */
test('screen: the firm is refused bank, taxpayer and password shapes; an investor is warned and may send anyway', async () => {
  await withInbox(async (t) => {
    assert.equal((await t.send([ONE], { body: 'Call us at 212-555-0100 with questions.' })).status, 201);
    const threadId = (await t.call('GET', '/v1/my-inbox', inv('KB-1001'))).body.threads[0].id;
    const before = recordCount(t);
    const calls = t.calls.length;
    const bank = await t.send([ONE], { body: 'Wire to routing 190000017 account 99001234567 by Friday.', attachments: [att('Wire.pdf', pdf('WIRE'))] });
    assert.equal(bank.status, 422);
    assert.deepEqual(bank.body, { error: BANK, field: 'body' });
    const pw = await t.send([ONE], { body: 'Your portal password: example' });
    assert.equal(pw.status, 422);
    assert.deepEqual(pw.body, { error: PASSWORD, field: 'body' });
    const named = await t.send([ONE], { body: 'Your statement.', attachments: [att('Statement 000-12-3456.pdf', pdf('STATEMENT'))] });
    assert.equal(named.status, 422);
    assert.deepEqual(named.body, { error: BANK, field: 'attachments' });
    const ein = await t.send([ONE], { body: 'Our employer number is 00-1234567.' });
    assert.equal(ein.status, 422);
    assert.equal(recordCount(t), before);
    assert.equal(t.calls.length, calls);

    const warned = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId, body: 'My taxpayer number is 000-12-3456.' });
    assert.equal(warned.status, 422);
    assert.deepEqual(warned.body, { error: PARTY_WARN, field: 'body', warn: true });
    const warnedName = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId, body: 'Attached.', attachments: [att('W-9 000-12-3456.pdf', pdf('W9'))] });
    assert.equal(warnedName.status, 422);
    assert.equal(warnedName.body.warn, true);
    assert.equal(recordCount(t), before);
    const sent = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId, body: 'My taxpayer number is 000-12-3456.', anyway: true });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.message.body, 'My taxpayer number is 000-12-3456.');
    assert.ok(!JSON.stringify(t.store.data()).includes('000-12-3456'));
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: true, count: 2 });
  });
});

/* ---------- 8. broadcast ---------- */
test('broadcast: one send to three investors, one copy each with its own files; a repeated clientId stores nothing new', async () => {
  await withInbox(async (t) => {
    const earlier = await t.send([ONE], { body: 'Before the quarterly letter.' });
    assert.equal(earlier.status, 201);
    const file = pdf('QUARTERLYMARK', 3000);
    const blobsBefore = t.store.blobs.size;
    const bc = await t.send([ONE, TWO, THREE], { clientId: 'c-bc-1', body: 'The quarterly letter is attached.', attachments: [att('Quarterly letter.pdf', file)] });
    assert.equal(bc.status, 201, JSON.stringify(bc.body));
    assert.match(bc.body.broadcastId, /^bc_[\w-]+$/);
    assert.equal(bc.body.messages.length, 3);
    assert.deepEqual(bc.body.messages.map((m) => m.party.id), ['KB-1001', 'KB-1002', 'KB-1003']);
    assert.equal(bc.body.messages[0].threadId, earlier.body.messages[0].threadId);
    assert.equal(new Set(bc.body.messages.map((m) => m.threadId)).size, 3);
    const fileIds = bc.body.messages.map((m) => m.attachments[0].id);
    assert.equal(new Set(fileIds).size, 3);
    assert.equal(t.store.blobs.size, blobsBefore + 3);
    for (const m of bc.body.messages) assert.equal(m.attachments[0].sha256, sha(file));
    const recs = Object.values(t.store.data().inbox).filter((r) => r.type === 'message' && r.broadcastId === bc.body.broadcastId);
    assert.equal(recs.length, 3);

    for (const [i, id] of ['KB-1001', 'KB-1002', 'KB-1003'].entries()) {
      const mine = await t.call('GET', '/v1/my-inbox', inv(id));
      const copies = mine.body.messages.filter((m) => m.broadcastId === bc.body.broadcastId);
      assert.deepEqual(copies.map((m) => m.id), [bc.body.messages[i].id]);
      assert.equal(copies[0].attachments[0].name, 'Quarterly letter.pdf');
      for (const [j, fid] of fileIds.entries()) {
        const got = await t.call('GET', `/v1/my-inbox/attachments/${fid}`, inv(id));
        assert.equal(got.status, i === j ? 200 : 404);
        if (i === j) assert.ok(got.bytes.equals(file));
      }
    }
    const r = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1002'), { threadId: bc.body.messages[1].threadId, body: 'Investor Two answers the letter.' });
    assert.equal(r.status, 201);
    assert.equal(r.body.message.threadId, bc.body.messages[1].threadId);
    for (const id of ['KB-1001', 'KB-1003']) assert.ok(!JSON.stringify((await t.call('GET', '/v1/my-inbox', inv(id))).body).includes('Investor Two answers'));

    const count = recordCount(t);
    const calls = t.calls.length;
    const again = await t.send([ONE, TWO, THREE], { clientId: 'c-bc-1', body: 'The quarterly letter is attached.', attachments: [att('Quarterly letter.pdf', file)] });
    assert.equal(again.status, 201);
    assert.deepEqual(again.body, bc.body);
    const twice = await Promise.all([t.send([ONE], { clientId: 'c-bc-2', body: 'Sent twice at once.' }), t.send([ONE], { clientId: 'c-bc-2', body: 'Sent twice at once.' })]);
    assert.deepEqual(twice[0].body, twice[1].body);
    assert.equal(Object.values(t.store.data().inbox).filter((x) => x.type === 'message').length, 6);
    assert.equal(recordCount(t), count + 3); // one message, its notice event and its client record
    assert.equal(t.calls.length, calls); // the investor already has an unread noticed message less than an hour old

    assert.equal((await t.send([])).status, 400);
    assert.equal((await t.send([{ party: { kind: 'prospect', id: 'pr-1' }, name: 'A prospect', email: 'p@example.invalid' }])).status, 400);
    const many = Array.from({ length: 501 }, (_, i) => ({ party: { kind: 'investor', id: `KB-${2000 + i}` }, name: `Investor ${i}`, email: `i${i}@example.invalid`, offeringId: '' }));
    assert.equal((await t.send(many)).status, 400);
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: true, count: 6 });
  });
});

/* ---------- 9. updates ---------- */
test('updates: every investor message, read and notice comes back once, in order, across since values; more when cut at 500', async () => {
  await withInbox(async (t) => {
    const seen = [];
    let since = 0;
    const pull = async () => {
      const up = await t.call('GET', `/v1/inbox/updates?since=${since}`, SPONSOR);
      assert.equal(up.status, 200);
      seen.push(...up.body.items);
      since = up.body.order;
    };
    let threadId = '';
    for (let i = 0; i < 10; i++) {
      t.clock.t += 2 * HOUR_MS;
      const s = await t.send([ONE], { body: `Firm message ${i}.` });
      threadId = s.body.messages[0].threadId;
      if (i % 3 === 0) await pull();
      t.clock.t += MIN;
      assert.equal((await t.call('POST', '/v1/my-inbox/read', inv('KB-1001'), { threadId })).body.marked, 1);
      if (i % 4 === 1) await pull();
      t.clock.t += MIN;
      assert.equal((await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId, body: `Investor reply ${i}.` })).status, 201);
      assert.equal((await t.call('POST', '/v1/inbox/read', SPONSOR, { threadId })).body.marked, 1);
    }
    await pull();
    await pull();
    const full = await t.call('GET', '/v1/inbox/updates?since=0', SPONSOR);
    assert.deepEqual(seen, full.body.items);
    assert.equal(full.body.items.length, 30);
    assert.deepEqual(full.body.items.filter((i) => i.type === 'message').map((i) => i.body), Array.from({ length: 10 }, (_, i) => `Investor reply ${i}.`));
    assert.equal(full.body.items.filter((i) => i.type === 'read').length, 10);
    assert.equal(full.body.items.filter((i) => i.type === 'notice').length, 10);
    const keys = full.body.items.map((i) => `${i.type}:${i.type === 'message' ? i.id : i.messageId}`);
    assert.equal(new Set(keys).size, 30);
    for (let i = 1; i < full.body.items.length; i++) assert.ok(full.body.items[i].order > full.body.items[i - 1].order);
    const beyond = await t.call('GET', `/v1/inbox/updates?since=${full.body.order + 50}`, SPONSOR);
    assert.deepEqual(beyond.body.items, []);
    assert.equal(beyond.body.more, false);
    assert.equal((await t.call('GET', '/v1/inbox/updates?since=abc', SPONSOR)).status, 400);
    assert.equal((await t.call('GET', '/v1/inbox/updates?since=-1', SPONSOR)).status, 400);
  });
  await withInbox(async (t) => {
    for (let i = 0; i < 501; i++) await t.inbox.post('ws-kb', { party: ONE.party, from: 'party', body: `Short note ${i}.` });
    const first = await t.call('GET', '/v1/inbox/updates?since=0', SPONSOR);
    assert.equal(first.body.items.length, 500);
    assert.equal(first.body.more, true);
    assert.equal(first.body.order, first.body.items[499].order);
    const rest = await t.call('GET', `/v1/inbox/updates?since=${first.body.order}`, SPONSOR);
    assert.deepEqual(rest.body.items.map((i) => i.body), ['Short note 500.']);
    assert.equal(rest.body.more, false);
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: true, count: 501 });
  });
});

/* ---------- 10. chain ---------- */
test('chain: the browser recipe; a re-sealed body or a changed time names that message', async () => {
  await withInbox(async (t) => {
    const a = await t.send([ONE], { body: 'First in the chain.', attachments: [att('Chain one.pdf', pdf('CHAINONE'))] });
    t.clock.t += MIN;
    await t.send([TWO], { body: 'Second in the chain.' });
    t.clock.t += MIN;
    await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId: a.body.messages[0].threadId, body: 'Third, from the investor.' });
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: true, count: 3 });
    const recs = Object.values(t.store.data().inbox).filter((r) => r.type === 'message').sort((x, y) => x.seq - y.seq);
    assert.deepEqual(recs.map((r) => r.seq), [1, 2, 3]);
    // chainText returns the joined text exactly as NS.inbox.chainText; the hash is SHA-256 hex of its UTF-8.
    const r1 = recs[0];
    const text = t.inbox.chainText(t.inbox.GENESIS, { seq: 1, at: r1.at, threadId: r1.threadId, from: 'firm', author: 'Dana Admin', body: 'First in the chain.', attachments: [{ sha256: sha(pdf('CHAINONE')) }], broadcastId: '', correctionOf: '' });
    assert.equal(text, ['0'.repeat(64), 1, r1.at, r1.threadId, 'firm', 'Dana Admin', 'First in the chain.', sha(pdf('CHAINONE')), '', ''].join('|'));
    assert.equal(r1.prev, '0'.repeat(64));
    assert.equal(r1.hash, sha(Buffer.from(text, 'utf8')));
    assert.equal(recs[1].prev, r1.hash);

    const original = recs[1].sealed;
    recs[1].sealed = t.vault.seal({ author: 'Dana Admin', body: 'Another text.', names: [] }, `inbox:${recs[1].id}:sealed`);
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: false, brokenAt: 2 });
    recs[1].sealed = original;
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: true, count: 3 });
    const at = r1.at;
    r1.at = new Date(Date.parse(at) + 1000).toISOString();
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: false, brokenAt: 1 });
    r1.at = at;
    recs[2].sealed = recs[1].sealed;
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: false, brokenAt: 3 });
  });
});

/* ---------- 11. notices ---------- */
test('notices: one per unread thread per hour; again after a read or after an hour; a failing notify still stores', async () => {
  await withInbox(async (t) => {
    const statuses = [];
    const firm = async (who = ONE) => {
      const r = await t.send([who], { body: 'A new message is waiting.' });
      assert.equal(r.status, 201);
      statuses.push(r.body.messages[0].notice.status);
      return r.body.messages[0];
    };
    const m1 = await firm();
    t.clock.t += 10 * MIN;
    await firm();
    t.clock.t += 10 * MIN;
    await firm();
    assert.deepEqual(statuses, ['sent', 'coalesced', 'coalesced']);
    assert.equal(t.calls.filter((c) => c.kind === 'message_notice').length, 1);
    await t.call('POST', '/v1/my-inbox/read', inv('KB-1001'), { threadId: m1.threadId });
    t.clock.t += 10 * MIN;
    await firm();
    t.clock.t += 30 * MIN;
    await firm();
    t.clock.t += 31 * MIN; // one hour and one minute after the last noticed message, which is still unread
    await firm();
    assert.deepEqual(statuses, ['sent', 'coalesced', 'coalesced', 'sent', 'coalesced', 'sent']);
    assert.equal(t.calls.filter((c) => c.kind === 'message_notice').length, 3);
    for (const c of t.calls) {
      assert.deepEqual(Object.keys(c).sort(), ['kind', 'messageId', 'party', 'threadId', 'to', 'workspace']);
      assert.ok(!JSON.stringify(c).includes('A new message is waiting.'));
    }
    const up = await t.call('GET', '/v1/inbox/updates?since=0', SPONSOR);
    assert.deepEqual(up.body.items.filter((i) => i.type === 'notice').map((i) => i.status), statuses);

    t.notifyMode.throws = true;
    const failed = await firm(TWO);
    assert.equal(statuses[6], 'failed');
    const two = await t.call('GET', '/v1/my-inbox', inv('KB-1002'));
    assert.deepEqual(two.body.messages.map((m) => m.id), [failed.id]);
    t.notifyMode.throws = false;
    await firm(TWO); // a failed notice does not hold back the next one
    assert.equal(statuses[7], 'sent');

    // An investor's message asks for the firm's notice, to the firm's notify address, without its text.
    const before = t.calls.length;
    await t.call('POST', '/v1/my-inbox/messages', inv('KB-1002'), { threadId: failed.threadId, body: 'A question about the letter.' });
    assert.equal(t.calls.length, before + 1);
    assert.equal(t.calls[before].kind, 'message_received');
    assert.deepEqual(t.calls[before].to, { name: FIRM.name, email: FIRM.notifyEmail });
    assert.deepEqual(t.calls[before].from, { name: 'Investor Two', kind: 'investor' });
    assert.ok(!JSON.stringify(t.calls[before]).includes('A question about the letter.'));
    assert.deepEqual(t.inbox.verify('ws-kb'), { ok: true, count: 9 });
  });
  await withInbox(async (t) => {
    const r = await t.send([ONE]);
    assert.equal(r.body.messages[0].notice.status, 'none');
  }, { noNotify: true });
});

/* ---------- 12. prefs ---------- */
test('prefs: an investor turns notices off and on; the sponsor sending again keeps the choice', async () => {
  await withInbox(async (t) => {
    await t.send([ONE]);
    const calls = t.calls.length;
    const off = await t.call('POST', '/v1/my-inbox/prefs', inv('KB-1001'), { notices: false });
    assert.equal(off.status, 200);
    assert.deepEqual(off.body, { prefs: { notices: false } });
    assert.equal((await t.call('GET', '/v1/my-inbox', inv('KB-1001'))).body.prefs.notices, false);
    t.clock.t += 2 * HOUR_MS;
    const quiet = await t.send([ONE]);
    assert.equal(quiet.body.messages[0].notice.status, 'off');
    assert.equal(t.calls.length, calls);
    assert.equal((await t.call('POST', '/v1/my-inbox/prefs', inv('KB-1001'), { notices: 'no' })).status, 400);
    const on = await t.call('POST', '/v1/my-inbox/prefs', inv('KB-1001'), { notices: true });
    assert.deepEqual(on.body, { prefs: { notices: true } });
    const loud = await t.send([ONE]);
    assert.equal(loud.body.messages[0].notice.status, 'sent');
    assert.equal(t.calls.length, calls + 1);
    // An investor the sponsor has not written to yet can set the choice first; the sponsor's send keeps it.
    assert.deepEqual((await t.call('POST', '/v1/my-inbox/prefs', inv('KB-1002'), { notices: false })).body, { prefs: { notices: false } });
    assert.equal((await t.send([TWO])).body.messages[0].notice.status, 'off');
    assert.equal((await t.call('GET', '/v1/my-inbox', inv('KB-1002'))).body.messages.length, 1);
  });
});

/* ---------- 13. nodelete ---------- */
test('nodelete: no route removes or changes a record; the module never calls a store removal', async () => {
  await withInbox(async (t) => {
    const s = await t.send([ONE], { attachments: [att('Kept.pdf', pdf('KEPT'))] });
    const fid = s.body.messages[0].attachments[0].id;
    const before = recordCount(t);
    const sponsorPaths = ['/v1/inbox/messages', '/v1/inbox/updates', '/v1/inbox/read', `/v1/inbox/attachments/${fid}`];
    const partyPaths = ['/v1/my-inbox', '/v1/my-inbox/messages', '/v1/my-inbox/read', '/v1/my-inbox/prefs', `/v1/my-inbox/attachments/${fid}`];
    for (const method of ['DELETE', 'PUT', 'PATCH']) {
      for (const p of sponsorPaths) assert.equal((await t.call(method, p, SPONSOR, {})).status, 405, `${method} ${p}`);
      for (const p of partyPaths) assert.equal((await t.call(method, p, inv('KB-1001'), {})).status, 405, `${method} ${p}`);
    }
    assert.equal((await t.call('GET', '/v1/inbox/messages', SPONSOR)).status, 405);
    assert.equal((await t.call('POST', '/v1/inbox/updates', SPONSOR, {})).status, 405);
    assert.equal(recordCount(t), before);
    for (const p of [...sponsorPaths]) assert.equal(t.inbox.sponsorPath('DELETE', p), true);
    for (const p of [...partyPaths]) assert.equal(t.inbox.partyPath('DELETE', p), true);
    assert.equal(t.inbox.sponsorPath('GET', '/v1/inbox/other'), false);
  });
  const src = readFileSync(fileURLToPath(new URL('../lib/inbox.mjs', import.meta.url)), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
  assert.equal((code.match(/\.remove\s*\(|\.removeBlob\s*\(|\bremoveBlob\b|\bremove\s*:/g) || []).length, 0);
  assert.ok(allStores.length >= 1);
  for (const st of allStores) {
    assert.deepEqual(st.violations, []);
    for (let i = 1; i < st.counts.length; i++) assert.ok(st.counts[i] >= st.counts[i - 1]);
  }
});

/* ---------- 14. limits ---------- */
test('limits: 4,000 characters, request and small-call caps, the rate limit on every POST; nothing written to the console', async () => {
  await withInbox(async (t) => {
    const s = await t.send([ONE], { body: 'x'.repeat(4000) });
    assert.equal(s.status, 201);
    const threadId = s.body.messages[0].threadId;
    const long = await t.send([ONE], { body: 'x'.repeat(4001) });
    assert.equal(long.status, 422);
    assert.deepEqual(long.body, { error: 'A message can be at most 4,000 characters.', field: 'body' });
    const longParty = await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), { threadId, body: 'y'.repeat(4001) });
    assert.equal(longParty.status, 422);
    assert.equal(longParty.body.error, 'A message can be at most 4,000 characters.');

    const huge = `{"body":"${'z'.repeat(t.inbox.LIMITS.request + 10)}"}`;
    assert.equal((await t.call('POST', '/v1/inbox/messages', SPONSOR, undefined, huge)).status, 413);
    assert.equal((await t.call('POST', '/v1/my-inbox/messages', inv('KB-1001'), undefined, huge)).status, 413);
    const small = JSON.stringify({ threadId, pad: 'p'.repeat(16 * 1024) });
    assert.equal((await t.call('POST', '/v1/inbox/read', SPONSOR, undefined, small)).status, 413);
    assert.equal((await t.call('POST', '/v1/my-inbox/read', inv('KB-1001'), undefined, small)).status, 413);
    assert.equal((await t.call('POST', '/v1/my-inbox/prefs', inv('KB-1001'), undefined, JSON.stringify({ notices: true, pad: 'p'.repeat(16 * 1024) }))).status, 413);

    const before = recordCount(t);
    t.limit.on = true;
    for (const [p, ctx, body] of [['/v1/inbox/messages', SPONSOR, { firm: FIRM, author: 'Dana Admin', body: 'Limited.', recipients: [ONE] }], ['/v1/inbox/read', SPONSOR, { threadId }], ['/v1/my-inbox/messages', inv('KB-1001'), { threadId, body: 'Limited.' }], ['/v1/my-inbox/read', inv('KB-1001'), { threadId }], ['/v1/my-inbox/prefs', inv('KB-1001'), { notices: false }]]) {
      assert.equal((await t.call('POST', p, ctx, body)).status, 429, p);
    }
    assert.equal((await t.call('GET', '/v1/my-inbox', inv('KB-1001'))).status, 200);
    assert.equal((await t.call('GET', '/v1/inbox/updates?since=0', SPONSOR)).status, 200);
    t.limit.on = false;
    assert.equal(recordCount(t), before);
  });
  assert.deepEqual(consoleCalls, []);
});
