// gate: tests 2
// Two items carried into plan 15-14 (15-CONTEXT "After 15-04", "After 15-06" and wave 3 W3): an investor sign-in made from
// an invitation the shared token created, for a workspace no one signed up for, gets a workspace record (the firm's name
// for its two-step issuer, the firm rule's place, and no sign-up can take that workspace); and a firm that signed up before
// confirmations existed (no link ever sent, confirmedAt '') is offered the link again at sign-in and in me, confirms, and
// can then invite investors. Mail goes only to the local SMTP stand-in. Every password, key and token is made by the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { withServer } from './helpers.mjs';
import { fakeSmtp, parts } from './smtp-fake.mjs';

const ORIGIN = 'http://127.0.0.1';
const key = () => randomBytes(32).toString('base64');
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from(randomBytes(n), (b) => ABC[b % 52]).join('');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const FIRM = 'Harbor Ridge Capital';
const OWNER = 'pat@harborridge.example';
const CONFIRM_FIRST = 'Confirm your email address first: use the link we sent when you signed up.';

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
  return { status: res.status, body: json, text, cookie: set.length ? set[0].split(';')[0] : '' };
}
const post = (base, path, body, cookie) => call(base, 'POST', path, { body, cookie });
const promote = (server, cookie) => server.store.put('sessions', { id: sha(cookie.split('=')[1]), stage: 'full', mfaAt: new Date().toISOString() });
const invitationBody = (ws, firm, id = 'HRC-0101', email = 'anita@investor.example') => ({ workspace: ws, sendEmail: false, portalUrl: `${ORIGIN}/portal.html`, firm: { name: firm, supportEmail: 'ir@harborridge.example' }, investor: { id, contact: 'Shah, Anita', title: 'Anita Shah', type: 'individual', email }, offering: null, invitation: { cents: 0 } });

test('invite login workspace record', async () => {
  const API = letters(40);
  await withServer({ env: { NODE_ENV: 'test', DATA_KEY: key(), PUBLIC_URL: ORIGIN, API_TOKEN: API } }, async (base, server) => {
    const made = await call(base, 'POST', '/v1/invitations', { body: invitationBody('solo-ridge', 'Solo Ridge Capital'), origin: '', headers: { Authorization: `Bearer ${API}` } });
    assert.equal(made.status, 200, made.text);
    assert.equal(server.store.get('workspaces', 'solo-ridge'), null, 'no one signed up for this workspace');
    const login = await call(base, 'POST', '/v1/invite/login', { body: { password: letters(16) }, headers: { 'X-Invite-Token': made.body.token } });
    assert.equal(login.status, 201, login.text);
    const w = server.store.get('workspaces', 'solo-ridge');
    assert.ok(w, 'the sign-in made the workspace record');
    assert.equal(w.name, 'Solo Ridge Capital');
    assert.equal(w.investorTwoStep, false, 'the firm rule has its place, off by default (C-03)');
    const me = await call(base, 'GET', '/v1/auth/me', { cookie: login.cookie });
    assert.deepEqual(me.body.workspace, { id: 'solo-ridge', name: 'Solo Ridge Capital' });
    const st = await post(base, '/v1/auth/two-step/start', {}, login.cookie);
    assert.equal(st.status, 200, st.text);
    assert.equal(new URL(st.body.otpauth).searchParams.get('issuer'), 'Solo Ridge Capital', 'the issuer is the firm, never empty');
    // A sign-up with that firm's name gets a workspace of its own, never the one its investors are in.
    const up = await post(base, '/v1/auth/signup', { firm: 'Solo Ridge', name: 'Sam Stranger', email: 'sam@elsewhere.example', password: letters(16) });
    assert.equal(up.status, 201, up.text);
    assert.notEqual(up.body.workspace.id, 'solo-ridge');
  });
});

test('confirm a firm made before confirmations', async () => {
  const relay = await fakeSmtp({});
  try {
    const env = { NODE_ENV: 'test', DATA_KEY: key(), PUBLIC_URL: ORIGIN, MAIL_FROM: 'notices@platform-mail.example', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(relay.port), SMTP_ALLOW_PLAIN: '1' };
    await withServer({ env }, async (base, server) => {
      const password = letters(16);
      const up = await post(base, '/v1/auth/signup', { firm: FIRM, name: 'Pat Owner', email: OWNER, password });
      assert.equal(up.status, 201, up.text);
      const ws = up.body.workspace.id;
      await server.signin.settled();
      // As a firm signed up before 15-14 is stored: no link was ever made, the workspace not confirmed.
      server.store.put('people', { id: up.body.person.id, confirm: null, confirmedAt: '' });
      server.store.put('workspaces', { id: ws, confirmedAt: '' });
      const from = relay.messages.length;

      const si = await post(base, '/v1/auth/signin', { email: OWNER, password });
      assert.equal(si.status, 200, si.text);
      assert.equal(si.body.confirmEmail, 'resend', 'sign-in offers the link');
      promote(server, si.cookie);
      const me = (await call(base, 'GET', '/v1/auth/me', { cookie: si.cookie })).body;
      assert.equal(me.emailConfirmed, false);
      assert.deepEqual(me.emailConfirm, { resend: true, reason: '' }, 'me offers it too');
      const refused = await post(base, '/v1/invitations', invitationBody(ws, FIRM), si.cookie);
      assert.deepEqual([refused.status, refused.body], [403, { error: CONFIRM_FIRST }]);

      const again = await post(base, '/v1/auth/confirm-email/resend', {}, si.cookie);
      assert.deepEqual([again.status, again.body], [200, { ok: true }]);
      await server.signin.settled();
      const m = relay.messages.slice(from).map((x) => parts(x.data).text || '').find((t) => /#confirm-/.test(t));
      const token = (/#confirm-([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(m || '') || [])[1];
      assert.ok(token, 'the link was emailed');
      assert.deepEqual((await post(base, '/v1/auth/confirm-email', { token })).body, { ok: true });
      assert.equal((await call(base, 'GET', '/v1/auth/me', { cookie: si.cookie })).body.emailConfirmed, true);
      const ok = await post(base, '/v1/invitations', invitationBody(ws, FIRM), si.cookie);
      assert.equal(ok.status, 200, ok.text);
      const s2 = await post(base, '/v1/auth/signin', { email: OWNER, password });
      assert.ok(!('confirmEmail' in s2.body), 'no offer once confirmed');
    });
  } finally {
    await relay.close();
  }
});
