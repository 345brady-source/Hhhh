// gate: tests 5
// A person's own account on the server (plan 15-04, SE-02, SE-03, SE-09): resets of another person's two-step by the firm
// and by the operator, the sessions list, the sealed two-step key and hashed recovery codes at rest, sign-in after a
// DATA_KEY change, and the investor's own sign-in made from the invitation at the onboarding's login step. Every password
// and key here is made by the test; codes are computed with assets/js/totp.js at the test's own clock, and none is printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withServer } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { REFUSALS } from '../lib/roles.mjs';

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
const ALREADY = 'You already have a sign-in for this portal. Sign in instead.';

function clock(t = T0) {
  const c = { t, now: () => c.t, add: (ms) => (c.t += ms) };
  return c;
}
function tmpStore() {
  const file = join(mkdtempSync(join(tmpdir(), 'auth-acct-')), 'store.json');
  return { file, store: openStore(file) };
}
const codeAt = (typedKey, time) => totp.totp({ key: totp.base32Decode(typedKey), time, hmac });

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
const post = (base, path, body, cookie, headers) => call(base, 'POST', path, { body, cookie, headers });
const get = (base, path, cookie) => call(base, 'GET', path, { cookie });
const signin = (base, email, password, headers) => call(base, 'POST', '/v1/auth/signin', { body: { email, password }, headers });

/** Sets up two-step from a 'setup' cookie at the clock's time; the full cookie, the typed key and the codes. */
async function setUp(base, c, cookie) {
  const st = await post(base, '/v1/auth/two-step/start', {}, cookie);
  assert.equal(st.status, 200, st.text);
  const cf = await post(base, '/v1/auth/two-step/confirm', { code: await codeAt(st.body.key, c.t) }, cookie);
  assert.equal(cf.status, 200, cf.text);
  return { cookie: cf.cookie, key: st.body.key, codes: cf.body.recoveryCodes, otpauth: st.body.otpauth };
}
async function owner(base, c, firm = FIRM, email = OWNER) {
  const password = letters(16);
  const up = await post(base, '/v1/auth/signup', { firm, name: 'Pat Owner', email, password });
  assert.equal(up.status, 201, up.text);
  return Object.assign({ password, id: up.body.person.id, workspace: up.body.workspace.id, email }, await setUp(base, c, up.cookie));
}
/** A console person made with people.create in the workspace, signed in and set up. */
async function teamPerson(base, c, server, workspace, role, email) {
  const password = letters(12);
  const p = await server.signin.people.create({ workspace, kind: 'team', role, email, name: `${role} person`, password });
  const s = await signin(base, email, password);
  assert.equal(s.body.stage, 'setup');
  return Object.assign({ password, id: p.id, email }, await setUp(base, c, s.cookie));
}
/** Password and code: a full, fresh session. */
async function fullSignIn(base, c, p, headers) {
  c.add(STEP);
  const s = await signin(base, p.email, p.password, headers);
  assert.equal(s.body.stage, 'code', s.text);
  const f = await post(base, '/v1/auth/code', { code: await codeAt(p.key, c.t) }, s.cookie, headers);
  assert.equal(f.status, 200, f.text);
  return f.cookie;
}

test('resets', async () => {
  const c = clock();
  const ADMIN = letters(40);
  await withServer({ env: env({ ADMIN_TOKEN: ADMIN }), now: c.now }, async (base, server) => {
    const o = await owner(base, c);
    const admin = await teamPerson(base, c, server, o.workspace, 'admin', 'sam@harborridge.example');
    const staff = await teamPerson(base, c, server, o.workspace, 'team', 'sky@harborridge.example');
    const other = await owner(base, c, 'Lantern Point Partners', 'lee@lanternpoint.example');

    const reset = (pid, cookie) => post(base, `/v1/auth/people/${pid}/two-step/reset`, {}, cookie);
    const r1 = await reset(staff.id, admin.cookie);
    assert.equal(r1.status, 200, r1.text);
    assert.deepEqual(r1.body, { ok: true });
    assert.equal((await get(base, '/v1/auth/me', staff.cookie)).status, 401, 'the person’s sessions end');
    const again = await signin(base, staff.email, staff.password);
    assert.equal(again.body.stage, 'setup', 'the person sets two-step up again');

    const r2 = await reset(o.id, admin.cookie);
    assert.equal(r2.status, 403);
    assert.equal(r2.body.error, 'Only the Owner or the operator can reset the Owner’s two-step sign-in.');
    Object.assign(staff, await setUp(base, c, again.cookie));
    const r3 = await reset(admin.id, staff.cookie);
    assert.equal(r3.status, 403);
    assert.equal(r3.body.error, REFUSALS.team);
    assert.equal((await reset(other.id, admin.cookie)).status, 404, 'another workspace’s person answers as if absent');

    // An investor's two-step: the firm's people who operate reset it.
    const ipw = letters(16);
    const ivy = await server.signin.people.create({ workspace: o.workspace, kind: 'investor', role: 'investor', investorId: 'HRC-0001', email: 'ivy@investor.example', name: 'Ivy Investor', password: ipw });
    server.signin.people.update(ivy.id, { twoStep: { on: true } });
    assert.equal((await signin(base, 'ivy@investor.example', ipw)).body.stage, 'code');
    assert.equal((await reset(ivy.id, staff.cookie)).status, 200);
    assert.equal((await signin(base, 'ivy@investor.example', ipw)).body.stage, 'full');

    // Without a fresh sign-in the reset asks for the password; confirm-password renews it.
    c.add(11 * MIN);
    const stale = await reset(staff.id, admin.cookie);
    assert.equal(stale.status, 401);
    assert.deepEqual(stale.body, { error: 'Enter your password again to do this.', code: 'fresh' });
    assert.equal((await post(base, '/v1/auth/confirm-password', { password: letters(12) }, admin.cookie)).status, 401, 'a wrong password does not renew it');
    const cp = await post(base, '/v1/auth/confirm-password', { password: admin.password }, admin.cookie);
    assert.equal(cp.status, 200, cp.text);
    assert.deepEqual(cp.body, { ok: true });
    assert.equal((await reset(staff.id, admin.cookie)).status, 200);

    // The operator (ADMIN_TOKEN) resets the Owner's.
    const op = (token) => call(base, 'POST', `/v1/admin/people/${o.id}/two-step/reset`, { body: {}, origin: '', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    assert.equal((await op('')).status, 401);
    assert.equal((await op(letters(40))).status, 401);
    const byOp = await op(ADMIN);
    assert.equal(byOp.status, 200, byOp.text);
    assert.equal((await get(base, '/v1/auth/me', o.cookie)).status, 401);
    assert.equal((await signin(base, o.email, o.password)).body.stage, 'setup');
    const rows = (await call(base, 'GET', `/v1/admin/people?workspace=${o.workspace}`, { origin: '', headers: { Authorization: `Bearer ${ADMIN}` } })).body;
    assert.equal(rows.find((r) => r.id === o.id).twoStep, false);
  });
});

test('sessions', async () => {
  const c = clock();
  await withServer({ env: env(), now: c.now }, async (base) => {
    const o = await owner(base, c);
    const phone = await fullSignIn(base, c, o, { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' });
    const tablet = await fullSignIn(base, c, o, { 'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)' });
    const l = await get(base, '/v1/auth/sessions', tablet);
    assert.equal(l.status, 200, l.text);
    assert.equal(l.body.length, 3);
    for (const row of l.body) {
      assert.deepEqual(Object.keys(row).sort(), ['createdAt', 'current', 'device', 'handle', 'seenAt']);
      assert.match(row.handle, /^[0-9a-f]{12}$/);
      assert.ok(!Number.isNaN(Date.parse(row.createdAt)) && !Number.isNaN(Date.parse(row.seenAt)));
    }
    assert.deepEqual(l.body.map((r) => r.device).sort(), ['Computer', 'Phone', 'Tablet']);
    assert.deepEqual(l.body.filter((r) => r.current).map((r) => r.device), ['Tablet']);
    assert.ok(!/iPhone|iPad|Mozilla|127\.0\.0\.1|node/i.test(l.text), 'no address and no browser text');

    const e = await post(base, '/v1/auth/sessions/end-others', {}, tablet);
    assert.equal(e.status, 200, e.text);
    assert.deepEqual(e.body, { ended: 2 });
    const after = await get(base, '/v1/auth/sessions', tablet);
    assert.equal(after.body.length, 1);
    assert.equal(after.body[0].current, true);
    assert.equal((await get(base, '/v1/auth/me', phone)).status, 401);
    assert.equal((await get(base, '/v1/auth/me', o.cookie)).status, 401);
    assert.equal((await get(base, '/v1/auth/me', tablet)).status, 200);
  });
});

test('secrets', async () => {
  const c = clock();
  const { file, store } = tmpStore();
  await withServer({ env: env(), now: c.now, store }, async (base, server) => {
    const o = await owner(base, c);
    // A pending key from a later start is sealed too.
    const st = await post(base, '/v1/auth/two-step/start', {}, o.cookie);
    assert.equal(st.status, 200, st.text);
    const me = await get(base, '/v1/auth/me', o.cookie);
    const bare = (k) => k.replace(/ /g, '');
    for (const k of [o.key, st.body.key]) {
      assert.ok(!me.text.includes(bare(k)) && !me.text.includes(k), 'me never returns a key');
    }
    server.store.flush();
    const text = readFileSync(file, 'utf8');
    for (const k of [o.key, st.body.key]) {
      assert.ok(!text.includes(bare(k)) && !text.includes(k) && !text.includes(bare(k).toLowerCase()), 'the store holds no two-step key');
    }
    for (const code of o.codes) {
      assert.ok(!text.includes(code) && !text.includes(code.replace('-', '')), 'the store holds no recovery code');
    }
    const person = JSON.parse(text).people[o.id];
    assert.equal(person.recovery.length, 10);
    for (const r of person.recovery) assert.match(r.hash, /^[0-9a-f]{64}$/);
    assert.equal(typeof person.twoStep.key, 'object', 'the key is a sealed value');
    assert.equal(typeof person.twoStepPending.key, 'object');

    // The set-up address: the email as label (percent-encoded), the firm's name as issuer, no platform name.
    assert.ok(o.otpauth.startsWith(`otpauth://totp/${encodeURIComponent(FIRM)}:${encodeURIComponent(OWNER)}?`), 'label');
    const u = new URL(o.otpauth);
    assert.equal(u.searchParams.get('issuer'), FIRM);
    assert.doesNotMatch(o.otpauth, /carrow|vale/i);
    assert.doesNotMatch(u.searchParams.get('issuer'), /carrow|vale/i);
  });
});

test('key change', async () => {
  const c = clock();
  // A new DATA_KEY with the old one second in DATA_KEY_PREVIOUS ('X,A', spaces or not), before any re-seal: the person
  // indexed under A still signs in.
  for (const previous of [(A) => `${key()},${A}`, (A) => ` ${key()} , ${A} `]) {
    const { file, store } = tmpStore();
    const A = key();
    let o;
    await withServer({ env: env({ DATA_KEY: A }), now: c.now, store }, async (base, server) => {
      o = await owner(base, c);
      server.store.flush();
    });
    await withServer({ env: env({ DATA_KEY: key(), DATA_KEY_PREVIOUS: previous(A) }), now: c.now, store: openStore(file) }, async (base, server) => {
      const s = await signin(base, OWNER, o.password);
      assert.equal(s.status, 200, s.text);
      assert.equal(s.body.stage, 'code');
      c.add(STEP);
      const f = await post(base, '/v1/auth/code', { code: await codeAt(o.key, c.t) }, s.cookie);
      assert.equal(f.status, 200, f.text);
      assert.equal((await get(base, '/v1/auth/me', f.cookie)).body.person.email, OWNER);
      const wrong = await signin(base, OWNER, letters(16));
      assert.equal(wrong.status, 401, 'a wrong password is still refused');
    });
  }
});

test('invite login', async () => {
  const c = clock();
  const API = letters(40);
  const { file, store } = tmpStore();
  await withServer({ env: env({ API_TOKEN: API }), now: c.now, store }, async (base, server) => {
    const o = await owner(base, c);
    const sponsor = (method, path, body) => call(base, method, path, { body, headers: { Authorization: `Bearer ${API}` } });
    const invite = async (over = {}) => {
      const r = await sponsor('POST', '/v1/invitations', Object.assign({ workspace: o.workspace, sendEmail: false, portalUrl: `${ORIGIN}/portal.html`, firm: { name: FIRM, supportEmail: 'ir@harborridge.example' }, investor: { id: 'HRC-0042', contact: 'Rowan Hale', title: 'Rowan Hale', type: 'individual', email: 'investor@harborridge.example' }, offering: null, invitation: { cents: 0 } }, over));
      assert.equal(r.status, 200, r.text);
      return r.body;
    };
    const login = (token, body, opts = {}) => call(base, 'POST', '/v1/invite/login', Object.assign({ body, headers: { 'X-Invite-Token': token } }, opts));
    const inv = await invite();
    const password = letters(16);

    // The JSON + own-Origin write rule: a form post from another site is refused and sets no cookie.
    for (const opts of [{ origin: 'https://elsewhere.example', type: 'text/plain' }, { type: 'text/plain' }, { origin: 'https://elsewhere.example' }]) {
      const r = await login(inv.token, JSON.stringify({ password }), opts);
      assert.equal(r.status, 403, JSON.stringify(opts));
      assert.equal(r.setCookie.length, 0);
    }
    const short = await login(inv.token, { password: letters(14) });
    assert.equal(short.status, 400);
    assert.equal(short.body.error, 'Use at least 15 characters.');
    const bad = await login(letters(43), { password });
    assert.equal(bad.status, 401);
    assert.equal(bad.setCookie.length, 0);

    // The investor's own sign-in: the email and investor from the invitation, never from the request.
    const r = await login(inv.token, { password, email: 'someone@elsewhere.example', investorId: 'HRC-9999' });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.body.stage, 'full');
    assert.ok(r.cookie);
    const me = await get(base, '/v1/auth/me', r.cookie);
    assert.equal(me.status, 200, me.text);
    assert.deepEqual(me.body.person, { id: me.body.person.id, name: 'Rowan Hale', email: 'investor@harborridge.example', kind: 'investor', role: 'investor', investorId: 'HRC-0042' });
    assert.equal(me.body.workspace.id, o.workspace);
    const stored = server.signin.people.get(me.body.person.id);
    assert.equal(server.signin.people.open(stored).email, 'investor@harborridge.example');
    assert.ok(server.signin.investor({ headers: { cookie: r.cookie }, method: 'GET' }), 'an investor session');
    assert.equal((await signin(base, 'investor@harborridge.example', password)).body.stage, 'full', 'the password signs in from now on');

    const second = await login(inv.token, { password: letters(16) });
    assert.equal(second.status, 409);
    assert.equal(second.body.error, ALREADY);
    assert.equal(second.setCookie.length, 0);
    const sameEmail = await invite();
    assert.equal((await login(sameEmail.token, { password: letters(16) })).body.error, ALREADY, 'one investor sign-in per email in the firm');

    const cancelled = await invite({ investor: { id: 'HRC-0043', contact: 'Quinn Hale', title: 'Quinn Hale', type: 'individual', email: 'quinn@investor.example' } });
    assert.equal((await sponsor('POST', `/v1/invitations/${cancelled.id}/cancel`)).status, 200);
    const gone = await login(cancelled.token, { password: letters(16) });
    assert.equal(gone.status, 410);
    assert.equal(gone.body.error, `This invitation was cancelled. Contact ${FIRM} if you think this is a mistake.`);

    // With the firm's rule on, a new investor sign-in starts at set-up.
    const rule = await post(base, '/v1/auth/firm/investor-two-step', { required: true }, o.cookie);
    assert.equal(rule.status, 200, rule.text);
    const third = await invite({ investor: { id: 'HRC-0044', contact: 'Drew Hale', title: 'Drew Hale', type: 'individual', email: 'drew@investor.example' } });
    const t = await login(third.token, { password: letters(16) });
    assert.equal(t.status, 201, t.text);
    assert.equal(t.body.stage, 'setup');

    // A co-investor's invitation makes the co-investor's own sign-in on the account (the co-investor's email, co set).
    const pdf = Buffer.from('%PDF-1.4\n% WORK COPY\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n').toString('base64');
    const signers = [
      { id: 'sg-1', role: 'investor', investorId: 'HRC-0042', name: 'Rowan Hale', email: 'investor@harborridge.example', status: 'signed', signedAt: '2026-11-26T15:00:00Z', signature: { kind: 'typed', text: 'Rowan Hale' } },
      { id: 'sg-2', role: 'investor', co: true, investorId: 'HRC-0042', name: 'Morgan Hale', email: 'morgan@coinvestor.example', status: 'waiting', signedAt: null, signature: null }
    ];
    const coInv = await invite({
      investor: { id: 'HRC-0042', contact: 'Morgan Hale', title: 'Rowan and Morgan Hale', type: 'joint', email: 'morgan@coinvestor.example' },
      invitation: { cents: 0, existing: true, coSign: true, envelopeId: 'env-h1' },
      esign: { template: { id: 'env-h1', title: 'Subscription agreement', status: 'sent', signers, fields: [{ id: 'fd-1', signerId: 'sg-2', type: 'signature', page: 1, x: 0.1, y: 0.7, w: 0.3, h: 0.03, value: null }] }, pdf }
    });
    const co = await login(coInv.token, { password: letters(16) });
    assert.equal(co.status, 201, co.text);
    const coMe = await get(base, '/v1/auth/me', co.cookie);
    assert.equal(coMe.body.person.email, 'morgan@coinvestor.example');
    assert.equal(coMe.body.person.investorId, 'HRC-0042');
    assert.equal(server.signin.people.get(coMe.body.person.id).co, true);
    assert.equal(server.signin.people.get(me.body.person.id).co, false);

    // The password reaches no invitation record, event or the store.
    server.store.flush();
    const text = readFileSync(file, 'utf8');
    assert.ok(!text.includes(password), 'the store never holds the password');
    for (const id of [inv.id, sameEmail.id, cancelled.id, third.id]) assert.ok(!JSON.stringify(server.store.get('invitations', id)).includes(password));
    assert.ok(!JSON.stringify(server.store.data().events || []).includes(password));
  });
});
