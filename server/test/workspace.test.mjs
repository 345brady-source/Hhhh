// gate: tests 9
// The firm's workspace held on the server (plan 15-06, SE-07, SE-08, SE-11; C-04, C-10, W-12, W-14, Pitfall 5): stored
// only sealed with the vault, one blob per version with the last 10 kept; a save from an older version refused; every
// save checked section by section against the person's role (lib/workspace.mjs SECTIONS); bank accounts changed only by
// a role with pay and a fresh sign-in, logged without the numbers; bank numbers masked for the other roles and a masked
// value sent back kept as stored; the Accountant reads no contact details or identity documents; the change log only
// grows; files sealed; no full taxpayer number stored. Every password and key here is made by the test; full sessions
// are made by writing the stage and mfaAt (and, for a stale sign-in, authAt) of the test's own session record.
// Fixtures hold no real numbers: routing 190000004 (prefix 19 is not issued), accounts starting 99, a taxpayer value
// 000-12-3456 (area 000 is never issued) only where a test proves it is refused. Nothing opened from the store is printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withServer } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { REFUSALS } from '../lib/roles.mjs';

const ORIGIN = 'http://127.0.0.1';
const key = () => randomBytes(32).toString('base64');
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from(randomBytes(n), (b) => ABC[b % 52]).join('');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const clone = (x) => JSON.parse(JSON.stringify(x));
const DAY = 24 * 60 * 60 * 1000;
const ROUTING = '190000004';
const ACCOUNT_ONE = '990012346789';
const ACCOUNT_TWO = '990098764321';

async function call(base, method, path, { body, cookie, origin = ORIGIN, type = 'application/json' } = {}) {
  const h = {};
  if (body !== undefined) h['Content-Type'] = type;
  if (origin) h.Origin = origin;
  if (cookie) h.Cookie = cookie;
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString('utf8');
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  const set = res.headers.getSetCookie();
  return { status: res.status, body: json, text, buf, type: res.headers.get('content-type'), cookie: set.length ? set[0].split(';')[0] : '' };
}
const promote = (server, cookie, extra = {}) => server.store.put('sessions', Object.assign({ id: sha(cookie.split('=')[1]), stage: 'full', mfaAt: new Date().toISOString() }, extra));
/** A sign-in more than 10 minutes old: the session still works, but it is not fresh. */
const stale = (server, cookie) => promote(server, cookie, { authAt: new Date(Date.now() - 11 * 60 * 1000).toISOString() });
async function signedUp(base, server, firm = 'Harbor Ridge Capital', email = 'pat@harborridge.example') {
  const r = await call(base, 'POST', '/v1/auth/signup', { body: { firm, name: 'Pat Owner', email, password: letters(16) } });
  assert.equal(r.status, 201, r.text);
  promote(server, r.cookie);
  return { ws: r.body.workspace.id, cookie: r.cookie, id: r.body.person.id };
}
async function member(base, server, ws, role) {
  const password = letters(16);
  const email = `${role}.${letters(6).toLowerCase()}@harborridge.example`;
  const name = `${role[0].toUpperCase()}${role.slice(1)} Person`;
  const extra = role === 'accountant' ? { endsOn: new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10) } : {};
  const p = await server.signin.people.create(Object.assign({ workspace: ws, kind: 'team', role, email, name, password }, extra));
  const s = await call(base, 'POST', '/v1/auth/signin', { body: { email, password } });
  assert.equal(s.status, 200, s.text);
  promote(server, s.cookie);
  return { id: p.id, name, cookie: s.cookie };
}
const investor = (id, name, account) => ({
  id,
  title: name,
  contact: name,
  type: 'individual',
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@investor.example`,
  phone: '(212) 555-0100',
  address: '1 Example Street, New York, NY 10001',
  tinLast4: '3456',
  payment: { method: 'ach', bank: { holder: name, routing: ROUTING, account, type: 'checking' } }
});
/** A workspace as the console holds one: the firm, an offering and two investors with their bank accounts. */
const WORKSPACE = () => ({
  v: 4,
  tenant: { id: 'harbor-ridge-capital', name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', ach: { odfiName: 'First Example Bank', odfiRouting: ROUTING, destinationRouting: ROUTING, companyName: 'HARBOR RIDGE', entryDescription: 'DISTRIB', offset: { routing: ROUTING, account: '990055501234', type: 'checking' } } },
  offerings: [{ id: 'HRC-F1', name: 'Harbor Ridge Fund I', type: 'Fund' }],
  investors: [investor('HRC-1001', 'Investor One', ACCOUNT_ONE), investor('HRC-1002', 'Investor Two', ACCOUNT_TWO)]
});
const withoutTeam = (ws) => {
  const o = clone(ws);
  delete o.team;
  return o;
};
/** Every file of a file store and its blob folder, as bytes. */
function filesOf(file) {
  const out = [readFileSync(file)];
  const dir = `${file}.blobs`;
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    /* no blob folder */
  }
  for (const n of names) out.push(readFileSync(join(dir, n)));
  return out;
}

test('tracer', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-tracer-'));
  const file = join(dir, 'store.json');
  const store = openStore(file);
  try {
    await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN }, store }, async (base, server) => {
      const owner = await signedUp(base, server);
      const none = await call(base, 'GET', '/v1/workspace', { cookie: owner.cookie });
      assert.equal(none.status, 404, none.text);
      assert.equal(none.body.code, 'empty');

      const ws = WORKSPACE();
      const put = await call(base, 'PUT', '/v1/workspace', { cookie: owner.cookie, body: { version: 0, ws } });
      assert.equal(put.status, 200, put.text);
      assert.deepEqual(put.body, { version: 1 });

      const got = await call(base, 'GET', '/v1/workspace', { cookie: owner.cookie });
      assert.equal(got.status, 200, got.text);
      assert.equal(got.body.version, 1);
      assert.deepEqual(withoutTeam(got.body.ws), ws, 'the same workspace comes back');
      assert.ok(Array.isArray(got.body.ws.team), 'the team is the server’s own people');
      assert.deepEqual(
        got.body.ws.team.map((p) => [p.id, p.name, p.role, p.owner, p.status]),
        [[owner.id, 'Pat Owner', 'owner', true, 'active']]
      );

      server.store.flush();
      const bytes = filesOf(file);
      assert.ok(bytes.length >= 2, 'the store file and at least one blob');
      for (const b of bytes) {
        assert.ok(!b.includes(Buffer.from('Investor One')), 'no investor name in plain text at rest');
        assert.ok(!b.includes(Buffer.from(ACCOUNT_ONE)), 'no bank number in plain text at rest');
      }
    });
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

/** The Owner's first save; returns the owner. */
async function seeded(base, server, ws = WORKSPACE()) {
  const owner = await signedUp(base, server);
  const r = await call(base, 'PUT', '/v1/workspace', { cookie: owner.cookie, body: { version: 0, ws } });
  assert.equal(r.status, 200, r.text);
  return owner;
}
const read = async (base, who) => {
  const r = await call(base, 'GET', '/v1/workspace', { cookie: who.cookie });
  assert.equal(r.status, 200, r.text);
  return r.body;
};
const save = (base, who, version, ws) => call(base, 'PUT', '/v1/workspace', { cookie: who.cookie, body: { version, ws } });
const versionBlobs = (file, ws) => readdirSync(`${file}.blobs`).filter((n) => n.startsWith(`wsv-${ws}-`));

test('versions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-versions-'));
  const file = join(dir, 'store.json');
  const store = openStore(file);
  try {
    await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN }, store }, async (base, server) => {
      const owner = await seeded(base, server);
      const ws = WORKSPACE();
      const old = await save(base, owner, 0, Object.assign(clone(ws), { notices: [{ id: 'n-old' }] }));
      assert.equal(old.status, 409, old.text);
      assert.deepEqual(old.body, { error: 'Someone else saved changes. Reload to see them.', code: 'version' });
      const after = await read(base, owner);
      assert.equal(after.version, 1, 'a refused save changes nothing');
      assert.equal(after.ws.notices, undefined);

      for (let n = 1; n <= 12; n++) {
        const r = await save(base, owner, n, Object.assign(clone(ws), { notices: [{ id: `n-${n}` }] }));
        assert.equal(r.status, 200, r.text);
        assert.equal(r.body.version, n + 1);
      }
      const head = await read(base, owner);
      assert.equal(head.version, 13);
      assert.deepEqual(head.ws.notices, [{ id: 'n-12' }]);
      const kept = versionBlobs(file, owner.ws).map((n) => Number(n.split('-').pop())).sort((a, b) => a - b);
      assert.deepEqual(kept, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 'exactly the last ten versions are kept');
      assert.deepEqual(server.store.get('workspaces', owner.ws).versions, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    });
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sections by role', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await seeded(base, server);
    const staff = await member(base, server, owner.ws, 'team');
    const ro = await member(base, server, owner.ws, 'readonly');
    const acct = await member(base, server, owner.ws, 'accountant');

    // Staff works from its own read (bank numbers masked, the team listed) and sends it back changed.
    let cur = await read(base, staff);
    const offer = clone(cur.ws);
    offer.offerings[0].name = 'Harbor Ridge Fund II';
    const no = await save(base, staff, cur.version, offer);
    assert.deepEqual([no.status, no.body], [403, { error: REFUSALS.configure, code: 'section' }]);
    assert.ok(!no.text.includes('offerings'), 'the section is named in the change log, never in the answer');
    const refused = server.audit.list(owner.ws).find((e) => e.action === 'Refused');
    assert.ok(refused && refused.detail.includes('offerings') && refused.personName === 'Team Person', JSON.stringify(refused && refused.detail));

    const named = clone(cur.ws);
    named.investors[0].title = 'Investor One Trust';
    const ok = await save(base, staff, cur.version, named);
    assert.equal(ok.status, 200, ok.text);
    cur = await read(base, owner);
    assert.equal(cur.ws.investors[0].title, 'Investor One Trust');
    assert.equal(cur.ws.investors[0].payment.bank.account, ACCOUNT_ONE, 'the masked values Staff sent back kept the stored numbers');

    for (const who of [ro, acct]) {
      const mine = await read(base, who);
      for (const change of [(w) => (w.investors[0].title = 'Changed'), (w) => (w.offerings[0].name = 'Changed'), (w) => (w.notices = [{ id: 'n-1' }])]) {
        const w = clone(mine.ws);
        change(w);
        const r = await save(base, who, mine.version, w);
        assert.deepEqual([r.status, r.body], [403, { error: REFUSALS.operate, code: 'section' }], who.name);
      }
    }

    cur = await read(base, owner);
    const odd = await save(base, owner, cur.version, Object.assign(clone(cur.ws), { somethingElse: [1] }));
    assert.deepEqual([odd.status, odd.body], [403, { error: REFUSALS.never, code: 'section' }]);

    const invented = clone(cur.ws);
    invented.team = [{ id: 'per_invented', name: 'Invented Person', email: 'x@harborridge.example', role: 'owner', status: 'active', owner: true }];
    invented.notices = [{ id: 'n-1' }];
    const t = await save(base, owner, cur.version, invented);
    assert.equal(t.status, 200, t.text);
    const after = await read(base, owner);
    assert.ok(!after.ws.team.some((p) => p.id === 'per_invented'), 'a saved team is ignored');
    assert.deepEqual(after.ws.team.map((p) => p.id).sort(), [owner.id, staff.id, ro.id, acct.id].sort());
  });
});

test('bank rule', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await seeded(base, server);
    const staff = await member(base, server, owner.ws, 'team');
    const admin = await member(base, server, owner.ws, 'admin');
    const NEW_ROUTING = '190000017';
    const NEW_ACCOUNT = '990011112222';

    const s = await read(base, staff);
    const byStaff = clone(s.ws);
    byStaff.investors[0].payment.bank.routing = NEW_ROUTING;
    const no = await save(base, staff, s.version, byStaff);
    assert.deepEqual([no.status, no.body], [403, { error: REFUSALS.pay, code: 'section' }]);

    stale(server, admin.cookie);
    const a = await read(base, admin);
    const byAdmin = clone(a.ws);
    byAdmin.investors[0].payment.bank.routing = NEW_ROUTING;
    byAdmin.investors[0].payment.bank.account = NEW_ACCOUNT;
    const later = await save(base, admin, a.version, byAdmin);
    assert.deepEqual([later.status, later.body.code], [401, 'fresh'], later.text);
    assert.equal((await read(base, owner)).ws.investors[0].payment.bank.account, ACCOUNT_ONE, 'nothing changed');

    promote(server, admin.cookie, { authAt: new Date().toISOString() }); // the password again (a fresh sign-in)
    const done = await save(base, admin, a.version, byAdmin);
    assert.equal(done.status, 200, done.text);
    const now = await read(base, owner);
    assert.equal(now.ws.investors[0].payment.bank.account, NEW_ACCOUNT);
    assert.equal(now.ws.investors[1].payment.bank.account, ACCOUNT_TWO, 'the other investor is untouched');

    const log = await call(base, 'GET', '/v1/audit', { cookie: owner.cookie });
    assert.equal(log.status, 200, log.text);
    const bank = log.body.entries.filter((e) => e.action === 'Bank account changed');
    assert.equal(bank.length, 1, JSON.stringify(log.body.entries.map((e) => e.action)));
    assert.equal(bank[0].detail, 'HRC-1001');
    assert.equal(bank[0].personName, 'Admin Person');
    for (const n of [ACCOUNT_ONE, NEW_ACCOUNT, NEW_ROUTING, ROUTING, '6789', '2222']) assert.ok(!log.text.includes(n), 'the change log holds no bank digits');

    const t = await read(base, staff);
    const ach = clone(t.ws);
    ach.tenant.ach.companyName = 'HARBOR RIDGE CAP';
    const r = await save(base, staff, t.version, ach);
    assert.deepEqual([r.status, r.body], [403, { error: REFUSALS.pay, code: 'section' }], 'the firm’s own bank details too');
  });
});

test('masking', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await seeded(base, server);
    const staff = await member(base, server, owner.ws, 'team');
    const s = await read(base, staff);
    assert.deepEqual(s.ws.investors.map((i) => [i.payment.bank.routing, i.payment.bank.account]), [['****0004', '****6789'], ['****0004', '****4321']]);
    assert.deepEqual([s.ws.tenant.ach.odfiRouting, s.ws.tenant.ach.destinationRouting, s.ws.tenant.ach.offset.routing, s.ws.tenant.ach.offset.account], ['****0004', '****0004', '****0004', '****1234']);
    assert.ok(!/\d{5}/.test(JSON.stringify(s.ws.investors.map((i) => i.payment))), 'no bank number reaches a role without pay');

    const w = clone(s.ws);
    w.investors[0].phone = '(212) 555-0199';
    const r = await save(base, staff, s.version, w);
    assert.equal(r.status, 200, r.text);
    const o = await read(base, owner);
    assert.equal(o.ws.investors[0].phone, '(212) 555-0199');
    assert.deepEqual(o.ws.investors.map((i) => [i.payment.bank.routing, i.payment.bank.account]), [[ROUTING, ACCOUNT_ONE], [ROUTING, ACCOUNT_TWO]], 'the full numbers are unchanged');
    assert.deepEqual(o.ws.tenant.ach, WORKSPACE().tenant.ach);
  });
});

test('accountant', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const ws = WORKSPACE();
    ws.docs = [
      { id: 'doc-id-1', title: 'Driver license', cat: 'Identity', investors: ['HRC-1001'] },
      { id: 'doc-ver-1', title: 'Accreditation letter', cat: 'Verification', investors: ['HRC-1001'] },
      { id: 'doc-rep-1', title: 'Q3 Investor Update', cat: 'Reports', investors: [] }
    ];
    const owner = await seeded(base, server, ws);
    const acct = await member(base, server, owner.ws, 'accountant');
    const a = await read(base, acct);
    for (const i of a.ws.investors) for (const f of ['email', 'phone', 'address', 'contact']) assert.ok(!(f in i), `no ${f} for the Accountant`);
    assert.deepEqual(a.ws.docs.map((d) => d.id), ['doc-rep-1'], 'no identity or verification documents');
    assert.equal(a.ws.investors[0].payment.bank.account, '****6789');
    const o = await read(base, owner);
    for (const i of o.ws.investors) for (const f of ['email', 'phone', 'address', 'contact']) assert.ok(i[f], `the Owner reads ${f}`);
    assert.deepEqual(o.ws.docs.map((d) => d.id), ['doc-id-1', 'doc-ver-1', 'doc-rep-1']);
  });
});

test('log only grows', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const ws = WORKSPACE();
    ws.audit = [
      { id: 'a1', at: '2026-11-01T10:00:00.000Z', action: 'Portal created', detail: '' },
      { id: 'a2', at: '2026-11-02T10:00:00.000Z', action: 'Offering added', detail: 'Harbor Ridge Fund I' }
    ];
    const owner = await seeded(base, server, ws);
    let cur = await read(base, owner);
    const grown = clone(cur.ws);
    grown.audit.push({ id: 'a3', at: '2026-11-03T10:00:00.000Z', action: 'Investor added', detail: 'HRC-1002' });
    const ok = await save(base, owner, cur.version, grown);
    assert.equal(ok.status, 200, ok.text);
    cur = await read(base, owner);
    const dropped = clone(cur.ws);
    dropped.audit.shift();
    const edited = clone(cur.ws);
    edited.audit[1].detail = 'Another fund';
    const gone = clone(cur.ws);
    delete gone.audit;
    for (const w of [dropped, edited, gone]) {
      const r = await save(base, owner, cur.version, w);
      assert.deepEqual([r.status, r.body], [403, { error: 'The change log can only grow.', code: 'grow' }]);
    }
    assert.equal((await read(base, owner)).ws.audit.length, 3);
  });
});

test('files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-files-'));
  const file = join(dir, 'store.json');
  const store = openStore(file);
  try {
    await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN }, store }, async (base, server) => {
      const ws = WORKSPACE();
      ws.docs = [
        { id: 'taxform-HRC-1001.pdf', title: 'Form W-9', cat: 'Tax', envelopeId: 'env-tax-1', audience: 'investors', investors: ['HRC-1001'] },
        { id: 'update-q3.pdf', title: 'Q3 Investor Update', cat: 'Reports', audience: 'fund', investors: [] }
      ];
      ws.envelopes = [{ id: 'env-tax-1', kind: 'tax', signedDocId: 'taxform-HRC-1001.pdf', signers: [{ investorId: 'HRC-1001' }] }];
      const owner = await seeded(base, server, ws);
      const staff = await member(base, server, owner.ws, 'team');
      const acct = await member(base, server, owner.ws, 'accountant');
      const bytes = Buffer.concat([Buffer.from('%PDF-1.7 Investor One W-9 page with a recognizable first line'), randomBytes(3 * 1024)]);
      const first = bytes.subarray(0, 64);

      for (const id of ['taxform-HRC-1001.pdf', 'update-q3.pdf']) {
        const up = await call(base, 'PUT', `/v1/workspace/files/${id}`, { cookie: owner.cookie, body: { name: `Investor One ${id}`, type: 'application/pdf', base64: bytes.toString('base64') } });
        assert.equal(up.status, 200, up.text);
        assert.deepEqual(up.body, { id, size: bytes.length, sha256: sha(bytes) });
      }
      const got = await call(base, 'GET', '/v1/workspace/files/update-q3.pdf', { cookie: owner.cookie });
      assert.equal(got.status, 200);
      assert.ok(got.buf.equals(bytes), 'the same bytes');
      assert.equal(got.type, 'application/pdf');

      server.store.flush();
      for (const b of filesOf(file)) {
        assert.ok(!b.includes(first), 'the file is sealed at rest');
        assert.ok(!b.includes(Buffer.from('Investor One')), 'its name too');
      }

      const a = await call(base, 'GET', '/v1/workspace/files/taxform-HRC-1001.pdf', { cookie: acct.cookie });
      assert.deepEqual([a.status, a.body], [403, { error: REFUSALS.personal, code: 'section' }], 'a signed tax form needs personal');
      assert.equal((await call(base, 'GET', '/v1/workspace/files/update-q3.pdf', { cookie: acct.cookie })).status, 200, 'a report does not');
      const s = await call(base, 'GET', '/v1/workspace/files/taxform-HRC-1001.pdf', { cookie: staff.cookie });
      assert.equal(s.status, 200);
      assert.ok(s.buf.equals(bytes));

      const other = await signedUp(base, server, 'Kestrel Point Partners', 'lee@kestrelpoint.example');
      assert.equal((await call(base, 'GET', '/v1/workspace/files/update-q3.pdf', { cookie: other.cookie })).status, 404, 'another firm’s file');
      assert.equal((await call(base, 'DELETE', '/v1/workspace/files/update-q3.pdf', { cookie: other.cookie, body: {} })).status, 404);
      assert.equal((await call(base, 'PUT', '/v1/workspace/files/update-q3.pdf', { cookie: acct.cookie, body: { name: 'x.pdf', type: 'application/pdf', base64: 'AAAA' } })).status, 403);

      const big = await call(base, 'PUT', '/v1/workspace/files/big.pdf', { cookie: owner.cookie, body: { name: 'big.pdf', type: 'application/pdf', base64: Buffer.alloc(26 * 1024 * 1024, 7).toString('base64') } });
      assert.deepEqual([big.status, big.body && big.body.error], [413, 'This file is over 25 MB.']);
      assert.equal((await call(base, 'GET', '/v1/workspace/files/big.pdf', { cookie: owner.cookie })).status, 404);

      const del = await call(base, 'DELETE', '/v1/workspace/files/update-q3.pdf', { cookie: staff.cookie, body: {} });
      assert.deepEqual([del.status, del.body], [200, { ok: true }]);
      assert.equal((await call(base, 'GET', '/v1/workspace/files/update-q3.pdf', { cookie: owner.cookie })).status, 404);
    });
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('minimization', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await seeded(base, server);
    const cur = await read(base, owner);
    const cases = [(w) => (w.investors[0].tin = '000-12-3456'), (w) => (w.investors[1].taxCert = { form: 'W-8BEN-E', owners: [{ ownerTin: '00-1234567' }] }), (w) => (w.investors[0].ssn = '000123456')];
    for (const change of cases) {
      const w = clone(cur.ws);
      change(w);
      const r = await save(base, owner, cur.version, w);
      assert.deepEqual([r.status, r.body], [400, { error: 'A full taxpayer number cannot be saved in the workspace.', code: 'tin' }]);
      assert.ok(!/123456/.test(r.text), 'the number is not echoed');
    }
    assert.equal((await read(base, owner)).version, cur.version, 'nothing stored');
    const w = clone(cur.ws);
    w.investors[0].tinLast4 = '3456';
    w.investors[1].taxCert = { form: 'W-9', tinLast4: '4567' };
    const ok = await save(base, owner, cur.version, w);
    assert.equal(ok.status, 200, ok.text);
  });
});
