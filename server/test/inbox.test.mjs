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
