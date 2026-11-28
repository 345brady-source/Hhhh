// gate: tests 8
// Sessions at the sponsor gate (plan 15-01): once anyone has signed up the open server is closed; a full console session
// acts on its own workspace only, as an account token does; half-done sign-ins and investors never reach a sponsor route;
// a cookie write must be JSON from the server's own origin (or one listed in PORTAL_ORIGIN); token callers are unchanged;
// the operator lists people and lifts a lock. Every password and token here is made by the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { withServer, keysDeep } from './helpers.mjs';

/** A field the operator's people list must never carry, matched against field names at any depth (never the values). */
const SECRET_FIELD = /pw|emailIndex|salt|hash|session/i;
const secretFields = (body) => keysDeep(body).filter((k) => SECRET_FIELD.test(k));

const ORIGIN = 'http://127.0.0.1';
const key = () => randomBytes(32).toString('base64');
const token = () => randomBytes(24).toString('base64url');
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from(randomBytes(n), (b) => ABC[b % 52]).join('');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const DAY = 24 * 60 * 60 * 1000;

async function call(base, method, path, { body, cookie, origin = ORIGIN, type = 'application/json', bearer, headers = {} } = {}) {
  const h = Object.assign({}, headers);
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
  return { status: res.status, body: json, text, setCookie: set, cookie: set.length ? set[0].split(';')[0] : '' };
}
const firm = (n) => ({ firm: `Harbor Ridge Capital ${n}`, name: 'Pat Owner', email: `pat${n}@harborridge.example`, password: letters(16) });
const signup = (base, b) => call(base, 'POST', '/v1/auth/signup', { body: b });
const signin = (base, b) => call(base, 'POST', '/v1/auth/signin', { body: b });
/** Stand in for 15-04's code step: the test writes its own session's stage and mfaAt. */
const promote = (server, cookie) => server.store.put('sessions', { id: sha(cookie.split('=')[1]), stage: 'full', mfaAt: new Date().toISOString() });
/** An invitation record as the invitations module keeps it (no snapshot needed for the list). */
const invitation = (server, id, workspace) =>
  server.store.put('invitations', { id, workspace, investorId: `INV-${id}`, status: 'sent', emailStatus: 'kept', sentAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * DAY).toISOString() });

test('open server closes', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base) => {
    assert.equal((await call(base, 'GET', '/v1/connectors')).status, 200, 'open while nobody exists');
    assert.notEqual((await call(base, 'GET', '/v1/invitations?workspace=x')).status, 401, 'the open server reaches the invitations module');
    assert.equal((await signup(base, firm('A'))).status, 201);
    for (const p of ['/v1/connectors', '/v1/invitations?workspace=x', '/v1/outbox']) {
      const r = await call(base, 'GET', p);
      assert.equal(r.status, 401, p);
      assert.deepEqual(r.body, { error: 'Not authorized' });
    }
  });
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN, AUTH_REQUIRED: '1' } }, async (base) => {
    assert.equal((await call(base, 'GET', '/v1/connectors')).status, 401, 'AUTH_REQUIRED=1 closes it with nobody signed up');
    assert.equal((await call(base, 'GET', '/v1/invitations?workspace=x')).status, 401);
  });
});

test('session pin', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const a = await signup(base, firm('A'));
    const b = await signup(base, firm('B'));
    const wa = a.body.workspace.id;
    const wb = b.body.workspace.id;
    invitation(server, 'ivt_a1', wa);
    invitation(server, 'ivt_b1', wb);
    promote(server, a.cookie);
    for (const q of ['', `?workspace=${wb}`, '?workspace=']) {
      const r = await call(base, 'GET', `/v1/invitations${q}`, { cookie: a.cookie });
      assert.equal(r.status, 200, r.text);
      assert.deepEqual(r.body.map((x) => x.id), ['ivt_a1'], `pinned whatever ?workspace says (${q})`);
    }
    assert.equal((await call(base, 'GET', '/v1/invitations/ivt_a1', { cookie: a.cookie })).status, 200);
    const other = await call(base, 'GET', '/v1/invitations/ivt_b1', { cookie: a.cookie });
    assert.equal(other.status, 404, 'another workspace answers as if it did not exist');
    const outbox = await call(base, 'GET', `/v1/outbox?workspace=${wb}`, { cookie: a.cookie });
    assert.equal(outbox.status, 200, outbox.text);
  });
});

test('stage gates', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const a = await signup(base, firm('A'));
    const ws = a.body.workspace.id;
    const setup = await call(base, 'GET', '/v1/invitations', { cookie: a.cookie });
    assert.equal(setup.status, 401);
    assert.deepEqual(setup.body, { error: 'Finish signing in first.', code: 'stage' });

    const tpw = letters(16);
    const p = await server.signin.people.create({ workspace: ws, kind: 'team', role: 'admin', email: 'sam@harborridge.example', name: 'Sam Admin', password: tpw });
    server.signin.people.update(p.id, { twoStep: { on: true } });
    const code = await signin(base, { email: 'sam@harborridge.example', password: tpw });
    assert.equal(code.body.stage, 'code');
    const half = await call(base, 'GET', '/v1/invitations', { cookie: code.cookie });
    assert.equal(half.status, 401);
    assert.equal(half.body.code, 'stage');

    const ipw = letters(16);
    await server.signin.people.create({ workspace: ws, kind: 'investor', role: 'investor', investorId: 'HRC-0001', email: 'ivy@investor.example', name: 'Ivy Investor', password: ipw });
    const inv = await signin(base, { email: 'ivy@investor.example', password: ipw });
    assert.equal(inv.body.stage, 'full');
    for (const path of ['/v1/invitations', '/v1/outbox', '/v1/billing', '/v1/filings', '/v1/taxdocs']) {
      const r = await call(base, 'GET', path, { cookie: inv.cookie });
      assert.equal(r.status, 401, `${path} ${r.text}`);
      assert.deepEqual(r.body, { error: 'Not authorized' });
    }
    assert.ok(server.signin.investor({ headers: { cookie: inv.cookie }, method: 'GET' }), 'the investor session itself is live');
  });
});

test('csrf', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const a = await signup(base, firm('A'));
    promote(server, a.cookie);
    server.store.put('workspaces', { id: a.body.workspace.id, confirmedAt: new Date().toISOString() }); // C-16 (15-14): the Owner's email confirmed
    const refused = { error: 'This request was refused.' };
    for (const [type, body] of [
      ['application/x-www-form-urlencoded', 'investorId=X'],
      ['text/plain', '{"investorId":"X"}'],
      ['multipart/form-data; boundary=x', '--x\r\nContent-Disposition: form-data; name="a"\r\n\r\nb\r\n--x--\r\n']
    ]) {
      const r = await call(base, 'POST', '/v1/invitations', { cookie: a.cookie, type, body });
      assert.equal(r.status, 403, type);
      assert.deepEqual(r.body, refused);
    }
    const evil = await call(base, 'POST', '/v1/invitations', { cookie: a.cookie, body: {}, origin: 'https://evil.example' });
    assert.equal(evil.status, 403);
    assert.deepEqual(evil.body, refused);
    const none = await call(base, 'POST', '/v1/invitations', { cookie: a.cookie, body: {}, origin: '' });
    assert.equal(none.status, 403);
    assert.deepEqual(none.body, refused);
    const own = await call(base, 'POST', '/v1/invitations', { cookie: a.cookie, body: {} });
    assert.ok(![401, 403].includes(own.status), `JSON from the server's own origin reaches the route (${own.status} ${own.text})`);

    // Sign-in and sign-up from another site are refused too, cookie or not, and set no cookie.
    const o = firm('B');
    await signup(base, o);
    for (const [origin, type] of [['https://evil.example', 'text/plain'], ['https://evil.example', 'application/json'], ['', 'application/json'], [ORIGIN, 'text/plain']]) {
      const r = await call(base, 'POST', '/v1/auth/signin', { body: JSON.stringify({ email: o.email, password: o.password }), origin, type });
      assert.equal(r.status, 403, `${origin} ${type}`);
      assert.deepEqual(r.body, refused);
      assert.equal(r.setCookie.length, 0);
    }
    const up = await call(base, 'POST', '/v1/auth/signup', { body: JSON.stringify(firm('C')), origin: 'https://evil.example', type: 'text/plain' });
    assert.equal(up.status, 403);
    assert.equal(up.setCookie.length, 0);
    assert.equal((await signin(base, { email: o.email, password: o.password })).status, 200);
  });
  // An origin listed in PORTAL_ORIGIN may write with the cookie.
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN, PORTAL_ORIGIN: 'https://portal.example' } }, async (base, server) => {
    const a = await call(base, 'POST', '/v1/auth/signup', { body: firm('A'), origin: 'https://portal.example' });
    assert.equal(a.status, 201, a.text);
    promote(server, a.cookie);
    server.store.put('workspaces', { id: a.body.workspace.id, confirmedAt: new Date().toISOString() }); // C-16 (15-14)
    const r = await call(base, 'POST', '/v1/invitations', { cookie: a.cookie, body: {}, origin: 'https://portal.example' });
    assert.ok(![401, 403].includes(r.status), `${r.status} ${r.text}`);
  });
});

test('tokens unchanged', async () => {
  const API = token();
  const ADMIN = token();
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN, API_TOKEN: API, ADMIN_TOKEN: ADMIN } }, async (base, server) => {
    assert.equal((await signup(base, firm('A'))).status, 201);
    invitation(server, 'ivt_x1', 'acme');
    const shared = await call(base, 'GET', '/v1/invitations?workspace=acme', { bearer: API, origin: '' });
    assert.equal(shared.status, 200, shared.text);
    assert.deepEqual(shared.body.map((x) => x.id), ['ivt_x1']);
    const made = await call(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, origin: '', body: { workspace: 'acme', name: 'Acme' } });
    assert.equal(made.status, 200, made.text);
    const own = await call(base, 'GET', '/v1/invitations', { bearer: made.body.token, origin: '' });
    assert.equal(own.status, 200, own.text);
    assert.deepEqual(own.body.map((x) => x.id), ['ivt_x1']);
    // A token's write needs no Origin and no JSON rule (the cookie rule is for browsers).
    const w = await call(base, 'POST', '/v1/invitations', { bearer: made.body.token, origin: '', body: {} });
    assert.ok(![401, 403].includes(w.status), `${w.status} ${w.text}`);
    assert.equal((await call(base, 'GET', '/v1/invitations', { origin: '' })).status, 401, 'nothing at all is still refused');
  });
});

test('status', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base) => {
    const before = await call(base, 'GET', '/v1/auth/status', { origin: '' });
    assert.equal(before.status, 200);
    assert.deepEqual(before.body, { signIn: false });
    await signup(base, firm('A'));
    assert.deepEqual((await call(base, 'GET', '/v1/auth/status', { origin: '' })).body, { signIn: true });
  });
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN, AUTH_REQUIRED: '1' } }, async (base) => {
    assert.deepEqual((await call(base, 'GET', '/v1/auth/status', { origin: '' })).body, { signIn: true });
  });
});

test('operator', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base) => {
    assert.equal((await call(base, 'GET', '/v1/admin/people?workspace=x', { bearer: token(), origin: '' })).status, 404, 'off without ADMIN_TOKEN');
  });
  const ADMIN = token();
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN, ADMIN_TOKEN: ADMIN } }, async (base, server) => {
    const o = firm('A');
    const a = await signup(base, o);
    await signup(base, firm('B'));
    const ws = a.body.workspace.id;
    assert.equal((await call(base, 'GET', `/v1/admin/people?workspace=${ws}`, { bearer: token(), origin: '' })).status, 401);
    assert.equal((await call(base, 'GET', `/v1/admin/people?workspace=${ws}`, { cookie: a.cookie })).status, 401, 'a session is not the operator');
    server.signin.people.update(a.body.person.id, { fails: { count: 10, first: Date.now(), waitUntil: 0, lockedUntil: Date.now() + 15 * 60 * 1000, hour: [] } });
    assert.equal((await signin(base, { email: o.email, password: o.password })).status, 423);
    const list = await call(base, 'GET', `/v1/admin/people?workspace=${ws}`, { bearer: ADMIN, origin: '' });
    assert.equal(list.status, 200, list.text);
    assert.deepEqual(list.body, [{ id: a.body.person.id, name: 'Pat Owner', email: o.email, kind: 'team', role: 'owner', status: 'active', locked: true, twoStep: false }]);
    // Field names only: the reply text also holds the random person id, which can hold "pw" or "Hash" by chance.
    assert.deepEqual(secretFields(list.body), [], 'no secret field at any depth');
    assert.equal((await call(base, 'POST', '/v1/admin/people/per_nobody/unlock', { bearer: ADMIN, origin: '', body: {} })).status, 404);
    const un = await call(base, 'POST', `/v1/admin/people/${a.body.person.id}/unlock`, { bearer: ADMIN, origin: '', body: {} });
    assert.equal(un.status, 200, un.text);
    assert.deepEqual(un.body, { ok: true });
    assert.equal((await call(base, 'GET', `/v1/admin/people?workspace=${ws}`, { bearer: ADMIN, origin: '' })).body[0].locked, false);
    assert.equal((await signin(base, { email: o.email, password: o.password })).status, 200, 'the next right password signs in');
  });
});

test('operator scan: a random person id holding "pw" is no secret field; a pwHash or session field at any depth is', () => {
  // The exact shape of a row of the operator's list, with an id as crypto.id('per') makes it (12 base64url characters).
  const row = { id: 'per_Q3pwX9aK_rHL', name: 'Pat Owner', email: 'patA@harborridge.example', kind: 'team', role: 'owner', status: 'active', locked: true, twoStep: false };
  const clean = JSON.parse(JSON.stringify([row]));
  assert.ok(SECRET_FIELD.test(JSON.stringify(clean)), 'the whole reply text does match: the random id holds "pw" (the old check failed here)');
  assert.deepEqual(secretFields(clean), [], 'its field names hold no secret');
  assert.deepEqual(secretFields([Object.assign({}, row, { pwHash: 'x' })]), ['pwHash'], 'a pwHash field is still caught');
  assert.deepEqual(secretFields([Object.assign({}, row, { signIn: { session: 'x', parts: [{ salt: 'y' }] } })]), ['session', 'salt'], 'nested fields are caught at any depth');
  assert.deepEqual(secretFields([Object.assign({}, row, { emailIndex: 'z' })]), ['emailIndex']);
});
