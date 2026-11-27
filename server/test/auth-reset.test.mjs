// gate: tests 6
// "Forgot your password?" on the server (plan 15-14, SE-04, Pitfall 2): one answer for every address, a 30-minute
// single-use link emailed with phase 13's password_reset message (only the SHA-256 of its token kept), the app code or a
// recovery code still needed when the person has two-step, and no link ever kept readable: with no way to send email the
// request is refused for every address alike. Mail goes only to the local SMTP stand-in (smtp-fake.mjs). Every password,
// key and token here is made by the test; codes are computed with assets/js/totp.js at the test's own clock, and none is
// printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withServer } from './helpers.mjs';
import { fakeSmtp, parts } from './smtp-fake.mjs';
import { openStore } from '../lib/store.mjs';

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
const NOT_SET = 'Email is not set up on this server; contact its operator.';
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
const sha = (x) => createHash('sha256').update(x).digest('hex');
/** A full session without two-step, written on the test's own session record (lib/team.mjs's tests do the same). */
const promote = (server, cookie) => server.store.put('sessions', { id: sha(cookie.split('=')[1]), stage: 'full', mfaAt: new Date().toISOString() });
/** The token of the newest reset email to an address, after every message the server started has gone out. */
async function lastReset(server, relay, email) {
  await server.signin.settled();
  const m = relay.messages.filter((x) => x.to.includes(email) && /#reset-/.test(mail(x).text)).pop();
  return m ? resetToken(m) : '';
}
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
    await withServer({ env: env(relay), now: c.now }, async (base, server) => {
      const o = await ownerWithTwoStep(base, c);
      if (server.signin.settled) await server.signin.settled(); // the sign-up's and two-step's own notices (Task 3) first
      const before = relay.messages.length;
      const r = await post(base, '/v1/auth/reset/request', { email: OWNER });
      assert.equal(r.status, 200, r.text);
      assert.deepEqual(r.body, { ok: true, message: SENT });
      assert.ok(await waitFor(() => relay.messages.length >= before + 1), 'the reset email reached the stand-in');
      assert.equal(relay.messages.length, before + 1);
      const m = mail(relay.messages[before]);
      assert.deepEqual(m.to, [OWNER]);
      assert.equal(m.subject, `${FIRM}: reset your password`);
      const token = resetToken(relay.messages[before]);
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

test('same answer', async () => {
  const relay = await fakeSmtp({});
  try {
    await withServer({ env: env(relay) }, async (base, server) => {
      const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password: letters(16) });
      assert.equal(up.status, 201, up.text);
      promote(server, up.cookie);
      const gone = 'gone.person@harborridge.example';
      const p = await server.signin.people.create({ workspace: up.body.workspace.id, kind: 'team', role: 'team', email: gone, name: 'Gone Person', password: letters(16) });
      const rm = await post(base, `/v1/team/${p.id}/remove`, {}, up.cookie);
      assert.equal(rm.status, 200, rm.text);
      await server.signin.settled();
      const before = relay.messages.length;
      const answers = [];
      for (const email of ['nobody@harborridge.example', gone, OWNER]) answers.push(await post(base, '/v1/auth/reset/request', { email }));
      for (const a of answers) {
        assert.equal(a.status, 200, a.text);
        assert.equal(a.text, answers[0].text, 'byte for byte the same answer');
        assert.equal(a.setCookie.length, 0);
      }
      assert.deepEqual(answers[0].body, { ok: true, message: SENT });
      await server.signin.settled();
      const got = relay.messages.slice(before);
      assert.equal(got.length, 1, 'only the real address gets a message');
      assert.deepEqual(got[0].to, [OWNER]);
    });
  } finally {
    await relay.close();
  }
});

test('two-step not skipped', async () => {
  const relay = await fakeSmtp({});
  const c = clock();
  try {
    await withServer({ env: env(relay), now: c.now }, async (base, server) => {
      const o = await ownerWithTwoStep(base, c);
      // One recovery code is used at a sign-in first.
      const si = await signin(base, OWNER, o.password);
      assert.equal(si.body.stage, 'code');
      assert.equal((await post(base, '/v1/auth/code', { code: o.codes[0] }, si.cookie)).status, 200);

      assert.equal((await post(base, '/v1/auth/reset/request', { email: OWNER })).status, 200);
      const token = await lastReset(server, relay, OWNER);
      assert.ok(token);
      const next = letters(16);
      c.add(STEP);
      const right = await codeAt(o.key, c.t);
      const wrong = String((Number(right) + 500000) % 1000000).padStart(6, '0');
      for (const code of [undefined, wrong, o.codes[0]]) {
        const r = await post(base, '/v1/auth/reset/confirm', code === undefined ? { token, password: next } : { token, password: next, code });
        assert.equal(r.status, 401, `${code === undefined ? 'no code' : code === wrong ? 'a wrong code' : 'a used recovery code'}: ${r.text}`);
        assert.deepEqual(r.body, { error: NEED_CODE, code: 'code' });
      }
      assert.equal((await signin(base, OWNER, o.password)).status, 200, 'the password is unchanged');
      assert.equal((await signin(base, OWNER, next)).status, 401);

      const ok = await post(base, '/v1/auth/reset/confirm', { token, password: next, code: o.codes[1] });
      assert.equal(ok.status, 200, ok.text);
      const again = await signin(base, OWNER, next);
      assert.equal(again.body.stage, 'code');
      assert.equal((await post(base, '/v1/auth/code', { code: o.codes[1] }, again.cookie)).status, 401, 'that recovery code is now used');
    });
  } finally {
    await relay.close();
  }
});

test('single use and expiry', async () => {
  const relay = await fakeSmtp({});
  const c = clock();
  try {
    await withServer({ env: env(relay), now: c.now }, async (base, server) => {
      assert.equal((await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password: letters(16) })).status, 201);
      const ask = async () => {
        assert.equal((await post(base, '/v1/auth/reset/request', { email: OWNER })).status, 200);
        return lastReset(server, relay, OWNER);
      };
      const gone = async (token, what) => {
        for (const path of ['/v1/auth/reset/check', '/v1/auth/reset/confirm']) {
          const r = await post(base, path, { token, password: letters(16) });
          assert.deepEqual([r.status, r.body], [404, { error: BAD_LINK }], `${what}: ${path}`);
        }
      };
      const t1 = await ask();
      assert.equal((await post(base, '/v1/auth/reset/confirm', { token: t1, password: letters(16) })).status, 200);
      await gone(t1, 'a link used once');

      const t2 = await ask();
      assert.ok(t2 && t2 !== t1);
      c.add(31 * MIN);
      await gone(t2, 'a link 31 minutes old');

      c.add(61 * MIN); // a new hour for the address's three requests
      const t3 = await ask();
      const t4 = await ask();
      assert.ok(t3 && t4 && t3 !== t4);
      await gone(t3, 'a link replaced by a newer request');
      assert.equal((await post(base, '/v1/auth/reset/check', { token: t4 })).status, 200);
      const rec = server.store.get('people', server.signin.people.byEmail(OWNER)[0].id);
      assert.equal(rec.reset.hash, sha(t4), 'only the newest link’s hash is kept');
    });
  } finally {
    await relay.close();
  }
});

test('limits', async () => {
  const relay = await fakeSmtp({});
  const c = clock();
  const SECOND = 'lee@secondfirm.example';
  try {
    await withServer({ env: env(relay), now: c.now }, async (base, server) => {
      assert.equal((await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password: letters(16) })).status, 201);
      assert.equal((await post(base, '/v1/auth/signup', { firm: 'Second Firm Partners', name: 'Lee Second', email: SECOND, password: letters(16) })).status, 201);
      await server.signin.settled();
      const before = relay.messages.length;
      const to = (email) => relay.messages.slice(before).filter((m) => m.to.includes(email) && /#reset-/.test(mail(m).text)).length;
      const answers = [];
      for (let i = 0; i < 4; i++) answers.push(await post(base, '/v1/auth/reset/request', { email: OWNER }));
      for (let i = 0; i < 6; i++) answers.push(await post(base, '/v1/auth/reset/request', { email: `nobody${i}@nowhere.example` }));
      answers.push(await post(base, '/v1/auth/reset/request', { email: SECOND })); // the 11th from this network address
      for (const a of answers) assert.deepEqual([a.status, a.text], [answers[0].status, answers[0].text], 'the same answer over the limits');
      await server.signin.settled();
      assert.equal(to(OWNER), 3, 'three per hour for one address');
      assert.equal(to(SECOND), 0, 'nothing beyond ten per hour from one network address');

      // A locked person can still reset; the lock ends with the reset (Pitfall 8).
      c.add(61 * MIN);
      let last = null;
      for (let i = 0; i < 10; i++) {
        last = await signin(base, SECOND, letters(16));
        c.add(70 * 1000);
      }
      assert.equal(last.status, 423, last.text);
      assert.equal((await post(base, '/v1/auth/reset/request', { email: SECOND })).status, 200);
      const token = await lastReset(server, relay, SECOND);
      assert.ok(token, 'the locked person got the reset email');
      const next = letters(16);
      assert.equal((await post(base, '/v1/auth/reset/confirm', { token, password: next })).status, 200);
      const s = await signin(base, SECOND, next);
      assert.equal(s.status, 200, s.text);
      assert.equal(server.signin.people.byEmail(SECOND)[0].fails.lockedUntil, 0);
    });
  } finally {
    await relay.close();
  }
});

test('no readable link', async () => {
  // No mail server: refused for a real and an unknown address alike, and nothing is kept.
  await withServer({ env: env(null) }, async (base, server) => {
    assert.equal((await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password: letters(16) })).status, 201);
    const real = await post(base, '/v1/auth/reset/request', { email: OWNER });
    const unknown = await post(base, '/v1/auth/reset/request', { email: 'nobody@harborridge.example' });
    assert.deepEqual([real.status, real.body], [503, { error: NOT_SET, code: 'mail' }]);
    assert.deepEqual([unknown.status, unknown.text], [real.status, real.text]);
    await server.signin.settled();
    assert.equal(server.store.list('outbox').length, 0, 'the outbox stays empty');
    assert.ok(!server.signin.people.byEmail(OWNER)[0].reset, 'no link was made');
  });

  // With the stand-in: after a reset and a team invitation, no store, log or output holds either token.
  const relay = await fakeSmtp({});
  const dir = mkdtempSync(join(tmpdir(), 'cv-reset-'));
  const file = join(dir, 'store.json');
  const store = openStore(file);
  const lines = [];
  const kept = {};
  for (const k of ['log', 'info', 'warn', 'error']) {
    kept[k] = console[k];
    console[k] = (...a) => lines.push(a.map(String).join(' '));
  }
  try {
    await withServer({ env: env(relay), store }, async (base, server) => {
      const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password: letters(16) });
      assert.equal(up.status, 201, up.text);
      const ws = up.body.workspace.id;
      assert.equal((await post(base, '/v1/auth/reset/request', { email: OWNER })).status, 200);
      const tokenA = await lastReset(server, relay, OWNER);
      const pw = letters(16);
      assert.equal((await post(base, '/v1/auth/reset/confirm', { token: tokenA, password: pw })).status, 200);
      const si = await signin(base, OWNER, pw);
      assert.equal(si.status, 200, si.text);
      promote(server, si.cookie);
      const inv = await post(base, '/v1/team/invite', { kind: 'team', role: 'team', name: 'Sam Staff', email: 'sam@harborridge.example' }, si.cookie);
      assert.equal(inv.status, 201, inv.text);
      await server.signin.settled();
      const acceptMail = relay.messages.map(mail).filter((m) => /#accept-/.test(m.text)).pop();
      const tokenB = inv.body.link ? inv.body.link.split('#accept-')[1] : (/#accept-([A-Za-z0-9_-]{43})/.exec(acceptMail ? acceptMail.text : '') || [])[1];
      for (const t of [tokenA, tokenB]) assert.match(String(t), /^[A-Za-z0-9_-]{43}$/);
      store.flush();
      const places = {
        outbox: JSON.stringify(server.invitations.mailer.outbox()),
        'sent log': JSON.stringify(server.invitations.mailLog.list(ws, { limit: 1000 })) + JSON.stringify(server.invitations.mailLog.list('', { limit: 1000 })),
        events: JSON.stringify(server.store.data().events),
        'change log': JSON.stringify(server.audit.exportAll(ws)),
        'store file': readFileSync(file, 'utf8'),
        output: lines.join('\n')
      };
      assert.ok(places['sent log'].includes('[personal link]'), 'the reset email is in the sent log, its link taken out');
      assert.ok(places['change log'].includes('Password reset'), 'the reset is in the change log');
      for (const [where, text] of Object.entries(places)) for (const t of [tokenA, tokenB]) assert.ok(!text.includes(t), `${where} holds a token`);
    });
  } finally {
    for (const k of Object.keys(kept)) console[k] = kept[k];
    store.close();
    rmSync(dir, { recursive: true, force: true });
    await relay.close();
  }
});
