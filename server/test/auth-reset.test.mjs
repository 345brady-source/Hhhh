// gate: tests 6
// "Forgot your password?" on the server (plan 15-14, SE-04, Pitfall 2): one answer for every address, a 30-minute
// single-use link emailed with phase 13's password_reset message (only the SHA-256 of its token kept), the app code or a
// recovery code still needed when the person has two-step, and no link ever kept readable: with no way to send email the
// request is refused for every address alike. Mail goes only to the local SMTP stand-in (smtp-fake.mjs). Every password,
// key and token here is made by the test; codes are computed with assets/js/totp.js at the test's own clock, and none is
// printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { withServer } from './helpers.mjs';
import { fakeSmtp, parts } from './smtp-fake.mjs';

const totp = createRequire(import.meta.url)('../../assets/js/totp.js');
const hmac = (k, m) => createHmac('sha1', Buffer.from(k)).update(Buffer.from(m)).digest();
const ORIGIN = 'http://127.0.0.1';
const T0 = Date.parse('2026-11-27T12:00:05Z');
const STEP = 30 * 1000;
const MIN = 60 * 1000;
const key = () => randomBytes(32).toString('base64');
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from(randomBytes(n), (b) => ABC[b % 52]).join('');
const PLATFORM_FROM = 'notices@platform-mail.example';
const OWNER = 'pat@harborridge.example';
const FIRM = 'Harbor Ridge Capital';
const SENT = 'If an account uses that address, we emailed a link to choose a new password. It works for 30 minutes.';
const NOT_SET = 'Email is not set up on this server; contact the people who run it.';
const BAD_LINK = 'This link is not valid or has expired. Ask for a new one.';
const NEED_CODE = 'Enter the code from your authenticator app or a recovery code.';

/** The server's settings: the SMTP stand-in when given (the platform's address for a team person's mail, 13-03). */
const env = (relay, over = {}) =>
  Object.assign({ NODE_ENV: 'test', DATA_KEY: key(), PUBLIC_URL: ORIGIN, AUTH_SIGNIN_PER_15MIN: '1000', MAIL_FROM: PLATFORM_FROM }, relay ? { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(relay.port), SMTP_ALLOW_PLAIN: '1' } : {}, over);
function clock(t = T0) {
  const c = { t, now: () => c.t, add: (ms) => (c.t += ms) };
  return c;
}
const codeAt = (typedKey, time) => totp.totp({ key: totp.base32Decode(typedKey), time, hmac });

async function call(base, method, path, { body, cookie, origin = ORIGIN, headers = {} } = {}) {
  const h = Object.assign({}, headers);
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (origin) h.Origin = origin;
  if (cookie) h.Cookie = cookie;
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
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

/** A firm signs up; its Owner sets up two-step at the clock's time. */
async function ownerWithTwoStep(base, c, password = letters(16)) {
  const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password });
  assert.equal(up.status, 201, up.text);
  const st = await post(base, '/v1/auth/two-step/start', {}, up.cookie);
  assert.equal(st.status, 200, st.text);
  const cf = await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(st.body.key, c.t) }, up.cookie);
  assert.equal(cf.status, 200, cf.text);
  return { password, cookie: cf.cookie, key: st.body.key, codes: cf.body.recoveryCodes, personId: up.body.person.id, workspace: up.body.workspace.id };
}
/** A message the stand-in received: its recipients, subject and decoded parts. */
function mail(m) {
  const head = m.data.split('\r\n\r\n')[0].replace(/\r\n[ \t]+/g, ' ');
  const p = parts(m.data);
  return { to: m.to, subject: (/^Subject: (.*)$/m.exec(head) || [])[1], text: p.text || '', html: p.html || '' };
}
const resetToken = (m) => (/#reset-([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(mail(m).text) || [])[1] || '';
async function waitFor(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return !!fn();
}

test('reset by email', async () => {
  const relay = await fakeSmtp({});
  const c = clock();
  try {
    await withServer({ env: env(relay), now: c.now }, async (base) => {
      const o = await ownerWithTwoStep(base, c);
      const r = await post(base, '/v1/auth/reset/request', { email: OWNER });
      assert.equal(r.status, 200, r.text);
      assert.deepEqual(r.body, { ok: true, message: SENT });
      assert.ok(await waitFor(() => relay.messages.length >= 1), 'the reset email reached the stand-in');
      assert.equal(relay.messages.length, 1);
      const m = mail(relay.messages[0]);
      assert.deepEqual(m.to, [OWNER]);
      assert.equal(m.subject, `${FIRM}: reset your password`);
      const token = resetToken(relay.messages[0]);
      assert.ok(token, 'a #reset- link in the text');

      const ck = await post(base, '/v1/auth/reset/check', { token });
      assert.equal(ck.status, 200, ck.text);
      assert.deepEqual(ck.body, { firm: FIRM, twoStep: true });

      c.add(STEP);
      const next = letters(16);
      const cf = await post(base, '/v1/auth/reset/confirm', { token, password: next, code: await codeAt(o.key, c.t) });
      assert.equal(cf.status, 200, cf.text);
      assert.deepEqual(cf.body, { ok: true });
      assert.equal((await signin(base, OWNER, o.password)).status, 401, 'the old password no longer signs in');
      const s = await signin(base, OWNER, next);
      assert.equal(s.status, 200, s.text);
      assert.equal(s.body.stage, 'code', 'two-step still follows the new password');
      assert.equal((await get(base, '/v1/auth/me', o.cookie)).status, 401, 'the earlier session ended');
    });
  } finally {
    await relay.close();
  }
});
