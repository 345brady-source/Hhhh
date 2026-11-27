// gate: tests 6
// Roles on the server (plan 15-05, SE-05 and SE-08): one route table (lib/roles.mjs ROUTES) checked by one guard for every
// signed-in person; a refusal answers 403 with the table's sentence and is written to the server change log with the person
// from the session. Every password, key and token here is made by the test; full sessions are made by writing the stage
// and mfaAt of the test's own session record (15-04's code step is tested there).
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { withServer } from './helpers.mjs';
import { REFUSALS } from '../lib/roles.mjs';

const ORIGIN = 'http://127.0.0.1';
const key = () => randomBytes(32).toString('base64');
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from(randomBytes(n), (b) => ABC[b % 52]).join('');
const sha = (x) => createHash('sha256').update(x).digest('hex');

async function call(base, method, path, { body, cookie, origin = ORIGIN, type = 'application/json', bearer } = {}) {
  const h = {};
  if (body !== undefined) h['Content-Type'] = type;
  if (origin) h.Origin = origin;
  if (cookie) h.Cookie = cookie;
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  const set = res.headers.getSetCookie();
  return { status: res.status, body: json, text, headers: res.headers, cookie: set.length ? set[0].split(';')[0] : '' };
}
const firm = (n) => ({ firm: `Harbor Ridge Capital ${n}`, name: `Pat Owner ${n}`, email: `pat${n}@harborridge.example`, password: letters(16) });
/** Stand in for 15-04's code step: the test writes its own session's stage and mfaAt. */
const promote = (server, cookie) => server.store.put('sessions', { id: sha(cookie.split('=')[1]), stage: 'full', mfaAt: new Date().toISOString() });

/** A firm signed up through the route, its Owner's session made full. */
async function signedUp(base, server, n = 'A') {
  const f = firm(n);
  const r = await call(base, 'POST', '/v1/auth/signup', { body: f });
  assert.equal(r.status, 201, r.text);
  promote(server, r.cookie);
  return { ws: r.body.workspace.id, cookie: r.cookie, person: r.body.person, firm: f };
}
/** A team person made in the workspace, signed in through the route and made full. */
async function member(base, server, ws, role, extra = {}) {
  const pw = letters(16);
  const email = `${role}.${letters(6).toLowerCase()}@harborridge.example`;
  const name = `${role[0].toUpperCase()}${role.slice(1)} Person`;
  const p = await server.signin.people.create(Object.assign({ workspace: ws, kind: 'team', role, email, name, password: pw }, extra));
  const s = await call(base, 'POST', '/v1/auth/signin', { body: { email, password: pw } });
  assert.equal(s.status, 200, s.text);
  promote(server, s.cookie);
  return { id: p.id, name, email, cookie: s.cookie };
}

test('tracer', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN, FILINGS: '1' } }, async (base, server) => {
    const owner = await signedUp(base, server);
    const staff = await member(base, server, owner.ws, 'team');
    const r = await call(base, 'POST', '/v1/filings/orders', { cookie: staff.cookie, body: { kind: 'formd' } });
    assert.equal(r.status, 403, r.text);
    assert.deepEqual(r.body, { error: REFUSALS.spend, code: 'role' });

    const log = await call(base, 'GET', '/v1/audit', { cookie: owner.cookie });
    assert.equal(log.status, 200, log.text);
    const refused = log.body.entries.filter((e) => e.action === 'Refused');
    assert.equal(refused.length, 1, log.text);
    assert.equal(refused[0].personName, staff.name);
    assert.equal(refused[0].personId, staff.id);
    assert.equal(refused[0].detail, 'POST /v1/filings/orders: spend');

    const v = await call(base, 'GET', '/v1/audit/verify', { cookie: owner.cookie });
    assert.equal(v.status, 200, v.text);
    assert.equal(v.body.ok, true);
    assert.ok(v.body.count >= 1);
  });
});
