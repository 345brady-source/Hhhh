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

/** A six-digit code that is none of the codes of the steps around the time (so it can only be a wrong guess). */
async function wrongCode(typedKey, time) {
  const near = new Set([await codeAt(typedKey, time - STEP), await codeAt(typedKey, time), await codeAt(typedKey, time + STEP)]);
  for (let n = 0; ; n++) {
    const c = String((Number(await codeAt(typedKey, time)) + 1 + n) % 1e6).padStart(6, '0');
    if (!near.has(c)) return c;
  }
}

test('replay and window', async () => {
  const c = clock();
  await withServer({ env: env(), now: c.now }, async (base) => {
    const o = await ownerWithTwoStep(base, c);
    const accepted = c.t; // confirm accepted this step
    c.add(STEP);
    const a = await signin(base, OWNER, o.password);
    assert.equal(a.body.stage, 'code');
    const now1 = await codeAt(o.key, c.t);
    const full = await post(base, '/v1/auth/code', { code: now1 }, a.cookie);
    assert.equal(full.status, 200, full.text);
    await post(base, '/v1/auth/signout', {}, full.cookie);

    const b = await signin(base, OWNER, o.password);
    const replay = await post(base, '/v1/auth/code', { code: now1 }, b.cookie);
    assert.equal(replay.status, 401, 'the code just accepted is refused a second time');
    assert.equal(replay.body.error, 'That code is not right. Check the time on your phone and try the newest code.');
    assert.equal(replay.setCookie.length, 0);
    assert.equal((await post(base, '/v1/auth/code', { code: await codeAt(o.key, accepted) }, b.cookie)).status, 401, 'the step before an accepted one is refused');
    assert.equal((await post(base, '/v1/auth/code', { code: await codeAt(o.key, c.t + 2 * STEP) }, b.cookie)).status, 401, 'two steps ahead is outside the window');
    // Three wrong guesses so far; six malformed codes more would end the sign-in if they counted.
    for (const bad of ['12345', 'abcdef', '12345', 'abcdef', '1234567', '']) {
      const r = await post(base, '/v1/auth/code', { code: bad }, b.cookie);
      assert.equal(r.status, 400, `a malformed code is refused: ${JSON.stringify(bad.length)}`);
      assert.equal(r.setCookie.length, 0);
    }
    c.add(STEP);
    const ok = await post(base, '/v1/auth/code', { code: await codeAt(o.key, c.t + STEP) }, b.cookie);
    assert.equal(ok.status, 200, 'one step ahead is inside the window, and the malformed codes did not count');
    assert.equal(ok.body.stage, 'full');
  });
});

test('wrong codes', async () => {
  const c = clock();
  await withServer({ env: env(), now: c.now }, async (base) => {
    const o = await ownerWithTwoStep(base, c);
    c.add(STEP);
    const s = await signin(base, OWNER, o.password);
    const bad = await wrongCode(o.key, c.t);
    for (let i = 1; i <= 4; i++) {
      const r = await post(base, '/v1/auth/code', { code: bad }, s.cookie);
      assert.equal(r.status, 401);
      assert.equal(r.body.error, 'That code is not right. Check the time on your phone and try the newest code.');
      const me = await get(base, '/v1/auth/me', s.cookie);
      assert.equal(me.status, 200, `the half-done sign-in is still there after ${i} wrong codes`);
      assert.equal(me.body.stage, 'code');
    }
    const fifth = await post(base, '/v1/auth/code', { code: bad }, s.cookie);
    assert.equal(fifth.status, 401);
    assert.equal(fifth.body.error, 'Too many wrong codes. Sign in again.');
    assert.equal((await get(base, '/v1/auth/me', s.cookie)).status, 401, 'the 5th wrong code ends the sign-in');
    assert.equal((await post(base, '/v1/auth/code', { code: await codeAt(o.key, c.t) }, s.cookie)).status, 401, 'even the right code no longer helps');
    assert.equal((await get(base, '/v1/invitations', s.cookie)).status, 401);
    const again = await signin(base, OWNER, o.password);
    assert.equal(again.body.stage, 'code', 'signing in again starts a new half-done sign-in');
  });
});

test('recovery', async () => {
  const c = clock();
  await withServer({ env: env(), now: c.now }, async (base) => {
    const o = await ownerWithTwoStep(base, c);
    c.add(STEP);
    const s = await signin(base, OWNER, o.password);
    const typed = o.codes[0].toUpperCase().replace('-', '');
    const r = await post(base, '/v1/auth/code', { code: typed }, s.cookie);
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { stage: 'full', recoveryLeft: 9 });
    assert.equal((await get(base, '/v1/auth/me', r.cookie)).body.recoveryLeft, 9);
    await post(base, '/v1/auth/signout', {}, r.cookie);

    const s2 = await signin(base, OWNER, o.password);
    assert.equal((await post(base, '/v1/auth/code', { code: o.codes[0] }, s2.cookie)).status, 401, 'a recovery code works once');
    const f = await post(base, '/v1/auth/code', { code: await codeAt(o.key, c.t) }, s2.cookie);
    assert.equal(f.status, 200, f.text);

    // New codes need a current app code; they replace all ten.
    assert.equal((await post(base, '/v1/auth/recovery-codes', {}, f.cookie)).status, 401);
    assert.equal((await post(base, '/v1/auth/recovery-codes', { code: await wrongCode(o.key, c.t) }, f.cookie)).status, 401);
    assert.equal((await post(base, '/v1/auth/recovery-codes', { code: o.codes[1] }, f.cookie)).status, 401, 'a recovery code does not make new ones');
    c.add(STEP);
    const n = await post(base, '/v1/auth/recovery-codes', { code: await codeAt(o.key, c.t) }, f.cookie);
    assert.equal(n.status, 200, n.text);
    assert.equal(n.body.recoveryCodes.length, 10);
    assert.ok(n.body.recoveryCodes.every((x) => !o.codes.includes(x)));
    assert.equal((await get(base, '/v1/auth/me', f.cookie)).body.recoveryLeft, 10);
    await post(base, '/v1/auth/signout', {}, f.cookie);

    const s3 = await signin(base, OWNER, o.password);
    for (const old of o.codes.slice(1, 4)) assert.equal((await post(base, '/v1/auth/code', { code: old }, s3.cookie)).status, 401, 'every old code stopped working');
    const g = await post(base, '/v1/auth/code', { code: n.body.recoveryCodes[0] }, s3.cookie);
    assert.equal(g.status, 200, g.text);
    assert.equal(g.body.recoveryLeft, 9);
  });
});

test('side doors', async () => {
  const c = clock();
  await withServer({ env: env(), now: c.now }, async (base) => {
    const password = letters(16);
    const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password });
    const pid = up.body.person.id;
    const doors = [
      ['GET', '/v1/invitations'],
      ['POST', '/v1/auth/password', { password: letters(16), next: letters(16) }],
      ['GET', '/v1/auth/sessions'],
      ['POST', '/v1/auth/sessions/end-others', {}],
      ['POST', '/v1/auth/recovery-codes', { code: '123456' }],
      ['POST', `/v1/auth/people/${pid}/two-step/reset`, {}],
      ['POST', '/v1/auth/firm/investor-two-step', { required: true }],
      ['POST', '/v1/auth/two-step/off', {}],
      ['POST', '/v1/auth/confirm-password', { password }]
    ];
    const shut = async (cookie, stage) => {
      for (const [method, path, body] of doors) {
        const r = await call(base, method, path, { body, cookie });
        assert.equal(r.status, 401, `${method} ${path} from a '${stage}' sign-in: ${r.text}`);
        if (path.startsWith('/v1/auth/')) assert.equal(r.body.code, 'stage', `${method} ${path} names the stage`);
        assert.equal(r.setCookie.length, 0, `${method} ${path} sets no cookie`);
      }
    };
    await shut(up.cookie, 'setup');
    assert.equal((await get(base, '/v1/auth/me', up.cookie)).body.stage, 'setup');

    // A pending key 11 minutes old cannot be confirmed (the half-done sign-in has ended by then too).
    const st = await post(base, '/v1/auth/two-step/start', {}, up.cookie);
    c.add(11 * MIN);
    assert.equal((await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(st.body.key, c.t) }, up.cookie)).status, 401);
    const si = await signin(base, OWNER, password);
    assert.equal(si.body.stage, 'setup', 'two-step is still not on');

    // Set up; the cookie from before confirm is dead after it.
    const st2 = await post(base, '/v1/auth/two-step/start', {}, si.cookie);
    const cf = await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(st2.body.key, c.t) }, si.cookie);
    assert.equal(cf.status, 200, cf.text);
    assert.equal((await get(base, '/v1/auth/me', si.cookie)).status, 401, 'the cookie from before confirm is dead');
    assert.equal((await get(base, '/v1/auth/me', up.cookie)).status, 401);

    // From a full session, a pending key 11 minutes old cannot be confirmed either; the key in use stays.
    const st3 = await post(base, '/v1/auth/two-step/start', {}, cf.cookie);
    assert.equal(st3.status, 200, st3.text);
    c.add(11 * MIN);
    const late = await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(st3.body.key, c.t) }, cf.cookie);
    assert.equal(late.status, 400, late.text);
    assert.equal(late.setCookie.length, 0);
    assert.equal((await post(base, '/v1/auth/two-step/start', {}, cf.cookie)).body.code, 'fresh', 'replacing the set-up needs the password again');
    await post(base, '/v1/auth/signout', {}, cf.cookie);

    // A 'code' sign-in reaches none of the doors, and cannot start or confirm a new set-up.
    const code = await signin(base, OWNER, password);
    assert.equal(code.body.stage, 'code');
    await shut(code.cookie, 'code');
    for (const path of ['/v1/auth/two-step/start', '/v1/auth/two-step/confirm']) {
      const r = await post(base, path, { code: await codeAt(st2.body.key, c.t) }, code.cookie);
      assert.equal(r.status, 401, `${path} from a 'code' sign-in`);
      assert.equal(r.setCookie.length, 0);
    }
    const ok = await post(base, '/v1/auth/code', { code: await codeAt(st2.body.key, c.t) }, code.cookie);
    assert.equal(ok.status, 200, 'the key set up before is the one in use');
  });
});

test('investors', async () => {
  const c = clock();
  await withServer({ env: env(), now: c.now }, async (base, server) => {
    const o = await ownerWithTwoStep(base, c);
    const ipw = letters(16);
    const IVY = 'ivy@investor.example';
    await server.signin.people.create({ workspace: o.workspace, kind: 'investor', role: 'investor', investorId: 'HRC-0001', email: IVY, name: 'Ivy Investor', password: ipw });

    // Off by default: the password alone signs in.
    const a = await signin(base, IVY, ipw);
    assert.equal(a.body.stage, 'full', 'an investor needs no code');
    assert.equal((await get(base, '/v1/auth/me', a.cookie)).body.twoStep, false);
    // Turned on from a fresh full session; the next sign-in asks for the code.
    const st = await post(base, '/v1/auth/two-step/start', {}, a.cookie);
    assert.equal(st.status, 200, st.text);
    assert.equal(new URL(st.body.otpauth).searchParams.get('issuer'), FIRM);
    const cf = await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(st.body.key, c.t) }, a.cookie);
    assert.equal(cf.status, 200, cf.text);
    await post(base, '/v1/auth/signout', {}, cf.cookie);
    c.add(STEP);
    const b = await signin(base, IVY, ipw);
    assert.equal(b.body.stage, 'code');
    const bf = await post(base, '/v1/auth/code', { code: await codeAt(st.body.key, c.t) }, b.cookie);
    assert.equal(bf.status, 200, bf.text);
    // Turning it off needs a fresh sign-in.
    c.add(11 * MIN);
    const stale = await post(base, '/v1/auth/two-step/off', {}, bf.cookie);
    assert.equal(stale.status, 401);
    assert.deepEqual(stale.body, { error: 'Enter your password again to do this.', code: 'fresh' });
    const b2 = await signin(base, IVY, ipw);
    const b2f = await post(base, '/v1/auth/code', { code: await codeAt(st.body.key, c.t) }, b2.cookie);
    assert.equal(b2f.status, 200, b2f.text);
    const off = await post(base, '/v1/auth/two-step/off', {}, b2f.cookie);
    assert.equal(off.status, 200, off.text);
    assert.deepEqual(off.body, { ok: true });
    const me = await get(base, '/v1/auth/me', b2f.cookie);
    assert.equal(me.body.twoStep, false);
    assert.equal(me.body.recoveryLeft, 0);
    assert.equal((await signin(base, IVY, ipw)).body.stage, 'full', 'off again: the password alone signs in');

    // A console person cannot turn it off.
    const os = await signin(base, OWNER, o.password);
    const of = await post(base, '/v1/auth/code', { code: await codeAt(o.key, c.t) }, os.cookie);
    assert.equal(of.status, 200, of.text);
    const teamOff = await post(base, '/v1/auth/two-step/off', {}, of.cookie);
    assert.equal(teamOff.status, 403);
    assert.equal(teamOff.body.error, 'Two-step sign-in is required for everyone who uses the console.');

    // Staff cannot change the firm's rule; the Owner can.
    const spw = letters(12);
    await server.signin.people.create({ workspace: o.workspace, kind: 'team', role: 'team', email: 'sky@harborridge.example', name: 'Sky Staff', password: spw });
    const ss = await signin(base, 'sky@harborridge.example', spw);
    assert.equal(ss.body.stage, 'setup');
    const sst = await post(base, '/v1/auth/two-step/start', {}, ss.cookie);
    const ssf = await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(sst.body.key, c.t) }, ss.cookie);
    assert.equal(ssf.status, 200, ssf.text);
    const staffRule = await post(base, '/v1/auth/firm/investor-two-step', { required: true }, ssf.cookie);
    assert.equal(staffRule.status, 403);
    assert.equal(staffRule.body.error, 'Only the Owner can do this.');
    const rule = await post(base, '/v1/auth/firm/investor-two-step', { required: true }, of.cookie);
    assert.equal(rule.status, 200, rule.text);
    assert.deepEqual(rule.body, { required: true });

    // With the firm's rule on, the investor sets two-step up at sign-in and cannot turn it off.
    const d = await signin(base, IVY, ipw);
    assert.equal(d.body.stage, 'setup');
    const dm = await get(base, '/v1/auth/me', d.cookie);
    assert.deepEqual(dm.body.firm, { investorTwoStep: true });
    assert.equal(server.signin.investor({ headers: { cookie: d.cookie }, method: 'GET' }), null, 'a set-up sign-in is not an investor session yet');
    const dst = await post(base, '/v1/auth/two-step/start', {}, d.cookie);
    const dcf = await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(dst.body.key, c.t) }, d.cookie);
    assert.equal(dcf.status, 200, dcf.text);
    const held = await post(base, '/v1/auth/two-step/off', {}, dcf.cookie);
    assert.equal(held.status, 403);
    assert.equal(held.body.error, 'Your firm requires two-step sign-in.');
  });
});
