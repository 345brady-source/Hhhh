// gate: tests 5
// Account notices and invitations by email (plan 15-14, SE-01, SE-02, SE-05, C-16): the password change, the Owner's email
// confirmation before investors can be invited, a notice for a new console device and for a lock (one per lock), team
// and investor access invitations emailed when the server can send them, and an Accountant whose access ended told so at
// sign-in. Mail goes only to the local SMTP stand-in (smtp-fake.mjs). Every password, key and token here is made by the
// test; codes are computed with assets/js/totp.js at the test's own clock, and none is printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { withServer } from './helpers.mjs';
import { fakeSmtp, parts } from './smtp-fake.mjs';

const totp = createRequire(import.meta.url)('../../assets/js/totp.js');
const hmac = (k, m) => createHmac('sha1', Buffer.from(k)).update(Buffer.from(m)).digest();
const ORIGIN = 'http://127.0.0.1';
const T0 = Date.parse('2026-11-27T12:00:05Z');
const STEP = 30 * 1000;
const key = () => randomBytes(32).toString('base64');
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from(randomBytes(n), (b) => ABC[b % 52]).join('');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const PLATFORM_FROM = 'notices@platform-mail.example';
const OWNER = 'pat@harborridge.example';
const FIRM = 'Harbor Ridge Capital';
const CONFIRM_FIRST = 'Confirm your email address first: use the link we sent when you signed up.';
const S = (s) => `${FIRM}: ${s}`;

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
  return { status: res.status, body: json, text, setCookie: set, cookie: set.length ? set[0].split(';')[0] : '', device: (set.find((x) => /^device=/.test(x)) || '').split(';')[0] };
}
const post = (base, path, body, cookie, headers) => call(base, 'POST', path, { body, cookie, headers });
const get = (base, path, cookie) => call(base, 'GET', path, { cookie });
const signin = (base, email, password, cookie, headers) => post(base, '/v1/auth/signin', { email, password }, cookie, headers);
const promote = (server, cookie) => server.store.put('sessions', { id: sha(cookie.split('=')[1]), stage: 'full', mfaAt: new Date().toISOString() });
function mail(m) {
  const head = m.data.split('\r\n\r\n')[0].replace(/\r\n[ \t]+/g, ' ');
  const p = parts(m.data);
  return { to: m.to, subject: (/^Subject: (.*)$/m.exec(head) || [])[1], text: p.text || '', html: p.html || '' };
}
/** The messages the stand-in received after `from`, read, once every message the server started has gone out. */
async function received(server, relay, from = 0) {
  await server.signin.settled();
  return relay.messages.slice(from).map(mail);
}
async function ownerWithTwoStep(base, c, password = letters(16)) {
  const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password });
  assert.equal(up.status, 201, up.text);
  const st = await post(base, '/v1/auth/two-step/start', {}, up.cookie);
  assert.equal(st.status, 200, st.text);
  const cf = await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(st.body.key, c.t) }, up.cookie);
  assert.equal(cf.status, 200, cf.text);
  return { password, cookie: cf.cookie, device: cf.device, key: st.body.key, codes: cf.body.recoveryCodes, personId: up.body.person.id, workspace: up.body.workspace.id };
}
/** A full console sign-in with the next app code; extra cookies (the device's) and headers as given. */
async function fullSignin(base, c, email, password, typedKey, { device = '', headers = {} } = {}) {
  c.add(STEP);
  const s = await signin(base, email, password, device || undefined, headers);
  assert.equal(s.body && s.body.stage, 'code', s.text);
  const r = await post(base, '/v1/auth/code', { code: await codeAt(typedKey, c.t) }, [s.cookie, device].filter(Boolean).join('; '), headers);
  assert.equal(r.status, 200, r.text);
  return r;
}
const invitationBody = (ws) => ({ workspace: ws, sendEmail: false, portalUrl: `${ORIGIN}/portal.html`, firm: { name: FIRM, supportEmail: 'ir@harborridge.example' }, investor: { id: 'HRC-0101', contact: 'Shah, Anita', title: 'Anita Shah', type: 'individual', email: 'anita@investor.example' }, offering: null, invitation: { cents: 0 } });
const confirmLink = (msgs) => (/#confirm-([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec((msgs.filter((m) => m.subject === S('confirm your email address')).pop() || { text: '' }).text) || [])[1] || '';

test('password change', async () => {
  const relay = await fakeSmtp({});
  const c = clock();
  try {
    await withServer({ env: env(relay), now: c.now }, async (base, server) => {
      const o = await ownerWithTwoStep(base, c);
      let msgs = await received(server, relay);
      assert.deepEqual(msgs.filter((m) => m.subject === S('two-step sign-in changed')).map((m) => m.to), [[OWNER]], 'two-step turned on: one notice');
      const other1 = await fullSignin(base, c, OWNER, o.password, o.key, { device: o.device });
      const other2 = await fullSignin(base, c, OWNER, o.password, o.key, { device: o.device });
      let from = relay.messages.length;

      const next = letters(16);
      const wrong = await post(base, '/v1/auth/password', { current: letters(16), next }, o.cookie);
      assert.deepEqual([wrong.status, wrong.body], [401, { error: 'The email or password is not right.' }]);
      assert.equal(server.store.get('people', o.personId).fails.count, 1, 'a wrong current password is counted');
      const ok = await post(base, '/v1/auth/password', { current: o.password, next }, o.cookie);
      assert.deepEqual([ok.status, ok.body], [200, { ok: true }]);
      assert.equal((await get(base, '/v1/auth/me', o.cookie)).status, 200, 'this session stays');
      for (const s of [other1, other2]) assert.equal((await get(base, '/v1/auth/me', s.cookie)).status, 401, 'every other session ends');
      assert.equal((await signin(base, OWNER, o.password)).status, 401);
      msgs = await received(server, relay, from);
      const changed = msgs.filter((m) => m.subject === S('your password was changed'));
      assert.equal(changed.length, 1);
      assert.deepEqual(changed[0].to, [OWNER]);
      assert.ok(changed[0].text.includes('The password for your Harbor Ridge Capital console account was changed on November 27, 2026'), changed[0].text.slice(0, 200));
      assert.ok(!changed[0].text.includes(next), 'no password in the notice');
      assert.ok(server.audit.exportAll(o.workspace).entries.some((e) => e.action === 'Password changed'));

      // 15-04's reset of someone's two-step sends that person twoStepChanged; a recovery code used at sign-in says how many are left.
      const adminPw = letters(16);
      const admin = await server.signin.people.create({ workspace: o.workspace, kind: 'team', role: 'admin', email: 'sam@harborridge.example', name: 'Sam Admin', password: adminPw });
      server.signin.people.update(admin.id, { twoStep: { on: true } });
      from = relay.messages.length;
      assert.equal((await post(base, `/v1/auth/people/${admin.id}/two-step/reset`, {}, o.cookie)).status, 200);
      msgs = await received(server, relay, from);
      const reset = msgs.filter((m) => m.subject === S('two-step sign-in changed'));
      assert.deepEqual(reset.map((m) => m.to), [['sam@harborridge.example']]);
      assert.ok(reset[0].text.includes('was reset by your firm'), reset[0].text.slice(0, 200));

      from = relay.messages.length;
      const s = await signin(base, OWNER, next, o.device);
      const r = await post(base, '/v1/auth/code', { code: o.codes[0] }, `${s.cookie}; ${o.device}`);
      assert.equal(r.status, 200, r.text);
      msgs = await received(server, relay, from);
      const used = msgs.filter((m) => m.subject === S('a recovery code was used'));
      assert.equal(used.length, 1);
      assert.ok(used[0].text.includes('You have 9 codes left'), used[0].text.slice(0, 300));
      assert.ok(!used[0].text.includes(o.codes[0]), 'no code in the notice');
    });
  } finally {
    await relay.close();
  }
});

test('confirmation', async () => {
  const relay = await fakeSmtp({});
  const API = letters(40);
  try {
    await withServer({ env: env(relay, { API_TOKEN: API }) }, async (base, server) => {
      const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password: letters(16) });
      assert.equal(up.status, 201, up.text);
      const ws = up.body.workspace.id;
      promote(server, up.cookie);
      const msgs = await received(server, relay);
      const token = confirmLink(msgs);
      assert.ok(token, 'sign-up emails a #confirm- link');
      assert.deepEqual(msgs.find((m) => m.subject === S('confirm your email address')).to, [OWNER]);

      const before = server.store.list('invitations').length;
      const refused = await post(base, '/v1/invitations', invitationBody(ws), up.cookie);
      assert.deepEqual([refused.status, refused.body], [403, { error: CONFIRM_FIRST }]);
      assert.equal(server.store.list('invitations').length, before, 'nothing stored');
      assert.equal((await get(base, '/v1/auth/me', up.cookie)).body.emailConfirmed, false);
      // An API_TOKEN caller is not affected.
      const token1 = await call(base, 'POST', '/v1/invitations', { body: invitationBody(ws), origin: '', headers: { Authorization: `Bearer ${API}` } });
      assert.equal(token1.status, 200, token1.text);

      const cf = await post(base, '/v1/auth/confirm-email', { token });
      assert.deepEqual([cf.status, cf.body], [200, { ok: true }]);
      assert.equal((await post(base, '/v1/auth/confirm-email', { token })).status, 404, 'the link works once');
      assert.equal((await get(base, '/v1/auth/me', up.cookie)).body.emailConfirmed, true);
      assert.ok(server.store.get('workspaces', ws).confirmedAt, 'the workspace record is confirmed');
      const passes = await post(base, '/v1/invitations', Object.assign(invitationBody(ws), { investor: Object.assign(invitationBody(ws).investor, { id: 'HRC-0102', email: 'ravi@investor.example' }) }), up.cookie);
      assert.equal(passes.status, 200, passes.text);
    });
  } finally {
    await relay.close();
  }
});

test('new device', async () => {
  const relay = await fakeSmtp({});
  const c = clock();
  try {
    await withServer({ env: env(relay), now: c.now }, async (base, server) => {
      const o = await ownerWithTwoStep(base, c);
      assert.match(o.device, /^device=[A-Za-z0-9_-]{43}$/, 'the first full sign-in sets the device cookie');
      const set = (await received(server, relay)).filter((m) => m.subject === S('a new sign-in to your console'));
      assert.equal(set.length, 0, 'and sends nothing');
      assert.equal(server.store.get('people', o.personId).devices.length, 1);
      assert.ok(!JSON.stringify(server.store.data()).includes(o.device.split('=')[1]), 'only the device cookie’s hash is kept');

      let from = relay.messages.length;
      await fullSignin(base, c, OWNER, o.password, o.key, { device: o.device });
      assert.equal((await received(server, relay, from)).filter((m) => m.subject === S('a new sign-in to your console')).length, 0, 'a known device: nothing');

      from = relay.messages.length;
      const phone = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' };
      const r = await fullSignin(base, c, OWNER, o.password, o.key, { headers: phone });
      assert.match(r.device, /^device=[A-Za-z0-9_-]{43}$/);
      const fresh = (await received(server, relay, from)).filter((m) => m.subject === S('a new sign-in to your console'));
      assert.equal(fresh.length, 1, 'a new device: one notice');
      assert.ok(fresh[0].text.includes('from a new phone on November 27, 2026'), fresh[0].text.slice(0, 200));
      assert.ok(!/Mozilla|iPhone OS|Mobile\/15E148/.test(fresh[0].text + fresh[0].html), 'the device type only');
    });
  } finally {
    await relay.close();
  }
});

test('lock', async () => {
  const relay = await fakeSmtp({});
  const c = clock();
  try {
    await withServer({ env: env(relay), now: c.now }, async (base, server) => {
      assert.equal((await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password: letters(16) })).status, 201);
      const from = (await received(server, relay)).length;
      let last = null;
      for (let i = 0; i < 12; i++) {
        last = await signin(base, OWNER, letters(16));
        c.add(70 * 1000);
      }
      assert.equal(last.status, 423, last.text);
      const msgs = await received(server, relay, from);
      const locked = msgs.filter((m) => m.subject === S('your account is locked for 15 minutes'));
      assert.equal(locked.length, 1, 'one notice for the lock, not one per try');
      assert.deepEqual(locked[0].to, [OWNER]);
      // The person resets during the lock and signs in.
      assert.equal((await post(base, '/v1/auth/reset/request', { email: OWNER })).status, 200);
      const reset = (await received(server, relay, from)).filter((m) => m.subject === S('reset your password')).pop();
      const token = (/#reset-([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(reset ? reset.text : '') || [])[1];
      assert.ok(token);
      const next = letters(16);
      assert.equal((await post(base, '/v1/auth/reset/confirm', { token, password: next })).status, 200);
      assert.equal((await signin(base, OWNER, next)).status, 200);
    });
  } finally {
    await relay.close();
  }
});

test('invitations emailed and ended access', async () => {
  const relay = await fakeSmtp({});
  const c = clock();
  try {
    await withServer({ env: env(relay), now: c.now }, async (base, server) => {
      const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password: letters(16) });
      const ws = up.body.workspace.id;
      promote(server, up.cookie);
      const token = confirmLink(await received(server, relay));
      assert.equal((await post(base, '/v1/auth/confirm-email', { token })).status, 200);
      // The firm's own sending address is ready (13-03's senders record, as its check leaves it).
      server.store.put('senders', { id: ws, workspace: ws, address: 'notices@harborridge.example', domain: 'harborridge.example', status: 'ready', records: [] });

      let from = relay.messages.length;
      const team = await post(base, '/v1/team/invite', { kind: 'team', role: 'team', name: 'Sam Staff', email: 'sam@harborridge.example' }, up.cookie);
      assert.equal(team.status, 201, team.text);
      assert.equal(team.body.sent, true);
      assert.ok(!('link' in team.body) && !/#accept-/.test(team.text), 'no link in the answer');
      let msgs = await received(server, relay, from);
      const invited = msgs.filter((m) => m.subject === S('you are invited to the console'));
      assert.deepEqual(invited.map((m) => m.to), [['sam@harborridge.example']]);
      const accept = (/#accept-([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(invited[0].text) || [])[1];
      assert.ok(accept, 'the message holds an #accept- link');
      assert.equal((await call(base, 'GET', `/v1/team/accept?token=${accept}`, { origin: '' })).status, 200, 'and it opens the invitation');

      from = relay.messages.length;
      const inv = await post(base, '/v1/team/invite', { kind: 'investor', investorId: 'HRC-0101', name: 'Anita Shah', email: 'anita@investor.example' }, up.cookie);
      assert.equal(inv.status, 201, inv.text);
      assert.equal(inv.body.sent, true);
      msgs = await received(server, relay, from);
      const access = msgs.filter((m) => m.subject === S('set up your sign-in to the investor portal'));
      assert.deepEqual(access.map((m) => m.to), [['anita@investor.example']]);
      assert.ok(/#accept-[A-Za-z0-9_-]{43}/.test(access[0].text));

      // An Accountant whose access ended: told so after the right password; a wrong one is the usual answer.
      const pw = letters(16);
      await server.signin.people.create({ workspace: ws, kind: 'team', role: 'accountant', email: 'cal@cpa.example', name: 'Cal Accountant', password: pw, endsOn: '2026-11-26' });
      const ended = await signin(base, 'cal@cpa.example', pw);
      assert.deepEqual([ended.status, ended.body.error, ended.setCookie.length], [403, 'Your access ended on November 26, 2026. Ask the firm to renew it.', 0]);
      const wrong = await signin(base, 'cal@cpa.example', letters(16));
      assert.deepEqual([wrong.status, wrong.body], [401, { error: 'The email or password is not right.' }]);
    });
    // With no mail server both invitations answer the link once, as before.
    await withServer({ env: env(null), now: c.now }, async (base, server) => {
      const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password: letters(16) });
      promote(server, up.cookie);
      server.store.put('workspaces', { id: up.body.workspace.id, confirmedAt: new Date(c.t).toISOString() });
      for (const b of [{ kind: 'team', role: 'team', name: 'Sam Staff', email: 'sam@harborridge.example' }, { kind: 'investor', investorId: 'HRC-0101', name: 'Anita Shah', email: 'anita@investor.example' }]) {
        const r = await post(base, '/v1/team/invite', b, up.cookie);
        assert.equal(r.status, 201, r.text);
        assert.equal(r.body.sent, false, b.kind);
        assert.match(r.body.link, /^http:\/\/127\.0\.0\.1\/#accept-[A-Za-z0-9_-]{43}$/, b.kind);
      }
      assert.equal(server.store.list('outbox').length, 0);
    });
  } finally {
    await relay.close();
  }
});
