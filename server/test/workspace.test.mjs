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
