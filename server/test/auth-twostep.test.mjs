// gate: tests 6
// Two-step sign-in on the server (plan 15-04, SE-02, SE-03): set-up with the key or its set-up address, the code at every
// console sign-in, ten one-time recovery codes, no side door to a full session, and investors' optional two-step with the
// Owner's rule. Every password and key here is made by the test; codes are computed with assets/js/totp.js and node:crypto
// at the test's own clock, and none is printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { withServer } from './helpers.mjs';
import { permissionsOf } from '../lib/roles.mjs';

const totp = createRequire(import.meta.url)('../../assets/js/totp.js');
const hmac = (k, m) => createHmac('sha1', Buffer.from(k)).update(Buffer.from(m)).digest();
const ORIGIN = 'http://127.0.0.1';
const T0 = Date.parse('2026-11-27T12:00:05Z');
const STEP = 30 * 1000;
const MIN = 60 * 1000;
const key = () => randomBytes(32).toString('base64');
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from(randomBytes(n), (b) => ABC[b % 52]).join('');
const env = (over = {}) => Object.assign({ NODE_ENV: 'test', DATA_KEY: key(), PUBLIC_URL: ORIGIN, AUTH_SIGNIN_PER_15MIN: '1000' }, over);
const OWNER = 'pat@harborridge.example';
const FIRM = 'Harbor Ridge Capital';

/** The test's clock: every route reads it through createServer's now. */
function clock(t = T0) {
  const c = { t, now: () => c.t, add: (ms) => (c.t += ms) };
  return c;
}
/** The app's code for a typed key at a time. */
const codeAt = (typedKey, time) => totp.totp({ key: totp.base32Decode(typedKey), time, hmac });

/** One call to the server, as the portal's own page makes it: JSON, the server's Origin, the cookie when given. */
async function call(base, method, path, { body, cookie, origin = ORIGIN, type = 'application/json', headers = {} } = {}) {
  const h = Object.assign({}, headers);
  if (body !== undefined) h['Content-Type'] = type;
  if (origin) h.Origin = origin;
  if (cookie) h.Cookie = cookie;
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
const post = (base, path, body, cookie) => call(base, 'POST', path, { body, cookie });
const get = (base, path, cookie) => call(base, 'GET', path, { cookie });
const signin = (base, email, password) => post(base, '/v1/auth/signin', { email, password });

/** A firm signs up; its Owner sets up two-step at the clock's time. Returns the Owner's full cookie, key and codes. */
async function ownerWithTwoStep(base, c, password = letters(16)) {
  const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password });
  assert.equal(up.status, 201, up.text);
  const st = await post(base, '/v1/auth/two-step/start', {}, up.cookie);
  assert.equal(st.status, 200, st.text);
  const cf = await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(st.body.key, c.t) }, up.cookie);
  assert.equal(cf.status, 200, cf.text);
  return { password, setupCookie: up.cookie, cookie: cf.cookie, key: st.body.key, codes: cf.body.recoveryCodes, personId: up.body.person.id, workspace: up.body.workspace.id };
}

test('set up and sign in', async () => {
  const c = clock();
  await withServer({ env: env(), now: c.now }, async (base) => {
    const password = letters(16);
    const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password });
    assert.equal(up.status, 201, up.text);
    assert.equal(up.body.stage, 'setup');

    // The key shown once: 32 base32 characters in 8 groups of four, and the set-up address an app reads.
    const st = await post(base, '/v1/auth/two-step/start', {}, up.cookie);
    assert.equal(st.status, 200, st.text);
    assert.match(st.body.key, /^[A-Z2-7]{4}( [A-Z2-7]{4}){7}$/);
    const addr = new URL(st.body.otpauth);
    assert.equal(addr.protocol, 'otpauth:');
    assert.equal(addr.searchParams.get('issuer'), FIRM, 'the firm’s name is the issuer');
    assert.equal(addr.searchParams.get('secret'), st.body.key.replace(/ /g, ''));
    assert.equal(decodeURIComponent(addr.pathname.replace(/^\/+/, '')), `${FIRM}:${OWNER}`, 'the person’s email is the label');

    // Confirmed with the app's code: ten recovery codes, shown once, and a new cookie (the old one is dead).
    const cf = await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(st.body.key, c.t) }, up.cookie);
    assert.equal(cf.status, 200, cf.text);
    assert.equal(cf.body.recoveryCodes.length, 10);
    for (const code of cf.body.recoveryCodes) assert.match(code, /^[2-9a-hjkmnp-z]{5}-[2-9a-hjkmnp-z]{5}$/);
    assert.equal(new Set(cf.body.recoveryCodes).size, 10);
    assert.ok(cf.cookie && cf.cookie !== up.cookie, 'the session is issued under a new id');
    assert.equal((await get(base, '/v1/invitations', cf.cookie)).status, 200, 'the console opens only now');

    // Signed out and in again: the password gives a half-done sign-in; the next step's code makes it full.
    assert.equal((await post(base, '/v1/auth/signout', {}, cf.cookie)).status, 200);
    c.add(STEP);
    const si = await signin(base, OWNER, password);
    assert.equal(si.status, 200, si.text);
    assert.equal(si.body.stage, 'code');
    assert.equal((await get(base, '/v1/invitations', si.cookie)).status, 401, 'a half-done sign-in does not open the console');
    const cd = await post(base, '/v1/auth/code', { code: await codeAt(st.body.key, c.t) }, si.cookie);
    assert.equal(cd.status, 200, cd.text);
    assert.equal(cd.body.stage, 'full');
    assert.ok(cd.cookie && cd.cookie !== si.cookie);
    const me = await get(base, '/v1/auth/me', cd.cookie);
    assert.equal(me.status, 200, me.text);
    assert.equal(me.body.stage, 'full');
    assert.equal(me.body.twoStep, true);
    assert.equal(me.body.recoveryLeft, 10);
    assert.deepEqual(me.body.permissions, permissionsOf('owner'));
    assert.deepEqual(me.body.firm, { investorTwoStep: false });
    assert.equal(me.body.idleMinutes, 60);
    assert.ok(!JSON.stringify(me.body).includes(st.body.key.replace(/ /g, '')), 'the key is never returned after set-up');
    assert.equal((await get(base, '/v1/invitations', cd.cookie)).status, 200);
  });
});
