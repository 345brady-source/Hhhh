// gate: tests 9
// The server's own sign-in (plan 15-01): a firm signs up and gets its workspace, its account record and its Owner; people
// sign in with their own email and password; one session cookie; waits, locks and limits on wrong passwords; timeouts;
// nothing personal stored in plain text. Every password and key here is made by the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withServer } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';

const ORIGIN = 'http://127.0.0.1';
const key = () => randomBytes(32).toString('base64');
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from(randomBytes(n), (b) => ABC[b % 52]).join('');
const sha = (x) => createHash('sha256').update(x).digest('hex');
function tmpStore() {
  const file = join(mkdtempSync(join(tmpdir(), 'auth-')), 'store.json');
  return { file, store: openStore(file) };
}

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
  return { status: res.status, body: json, text, setCookie: set, cookie: set.length ? set[0].split(';')[0] : '', headers: res.headers };
}
const signup = (base, b) => call(base, 'POST', '/v1/auth/signup', { body: b });

test('sign-up to me', async () => {
  const { file, store } = tmpStore();
  const password = letters(16);
  const email = 'pat@harborridge.example';
  await withServer({ env: { NODE_ENV: 'test', DATA_KEY: key(), PUBLIC_URL: ORIGIN }, store }, async (base) => {
    const r = await signup(base, { firm: 'Harbor Ridge Capital', name: 'Pat Owner', email, password });
    assert.equal(r.status, 201, r.text);
    assert.deepEqual(r.body.workspace, { id: 'harbor-ridge-capital', name: 'Harbor Ridge Capital' });
    assert.equal(r.body.person.role, 'owner');
    assert.equal(r.body.person.kind, 'team');
    assert.equal(r.body.person.name, 'Pat Owner');
    assert.equal(r.body.person.email, email);
    assert.equal(r.body.stage, 'setup');
    assert.equal(r.setCookie.length, 1);
    assert.match(r.setCookie[0], /^session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=43200$/);
    assert.doesNotMatch(r.setCookie[0], /Secure|Domain/i);

    const me = await call(base, 'GET', '/v1/auth/me', { cookie: r.cookie });
    assert.equal(me.status, 200, me.text);
    assert.deepEqual(me.body.person, { id: r.body.person.id, name: 'Pat Owner', email, kind: 'team', role: 'owner', investorId: '' });
    assert.deepEqual(me.body.workspace, { id: 'harbor-ridge-capital', name: 'Harbor Ridge Capital' });
    assert.equal(me.body.stage, 'setup');
    assert.equal(me.body.twoStep, false);
    assert.equal((await call(base, 'GET', '/v1/auth/me')).status, 401);

    store.flush();
    const text = readFileSync(file, 'utf8');
    const sid = r.cookie.split('=')[1];
    for (const s of [email, 'harborridge.example', 'Pat Owner', password, sid]) assert.ok(!text.includes(s), 'the store holds a plain value');
    const data = JSON.parse(text);
    const people = Object.values(data.people);
    assert.equal(people.length, 1);
    assert.match(people[0].emailIndex, /^[0-9a-f]{64}$/);
    const { v, N, r: rr, p } = people[0].pw;
    assert.deepEqual({ v, N, r: rr, p }, { v: 1, N: 32768, r: 8, p: 3 });
    assert.ok(Object.values(data.accounts).some((a) => a.workspace === 'harbor-ridge-capital'));
    assert.ok(data.sessions[sha(sid)], 'the session is stored under the hash of its cookie');
  });
});

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const START = Date.parse('2026-11-26T10:00:00Z');
const signin = (base, b, opts = {}) => call(base, 'POST', '/v1/auth/signin', Object.assign({ body: b }, opts));
const sidOf = (cookie) => cookie.split('=')[1];
/** Stand in for 15-04's code step: the test writes its own session's stage. */
const promote = (server, cookie) => server.store.put('sessions', { id: sha(sidOf(cookie)), stage: 'full', mfaAt: new Date().toISOString() });
const owner = (n = '') => ({ firm: `Harbor Ridge Capital${n}`, name: 'Pat Owner', email: 'pat@harborridge.example', password: letters(16) });

test('https cookie', async () => {
  const env = { DATA_KEY: key(), PUBLIC_URL: 'https://portal.example' };
  await withServer({ env }, async (base) => {
    const r = await call(base, 'POST', '/v1/auth/signup', { body: owner(), origin: 'https://portal.example' });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.setCookie.length, 1);
    assert.match(r.setCookie[0], /^__Host-session=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=43200$/);
    assert.doesNotMatch(r.setCookie[0], /Domain/i);
    assert.equal((await call(base, 'GET', '/v1/auth/me', { cookie: r.cookie })).status, 200);
    // Only the cookie's own name counts: the http name, or two of ours, is no session.
    assert.equal((await call(base, 'GET', '/v1/auth/me', { cookie: `session=${sidOf(r.cookie)}` })).status, 401);
    assert.equal((await call(base, 'GET', '/v1/auth/me', { cookie: `${r.cookie}; ${r.cookie}` })).status, 401);
  });
});

test('password rules', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const refused = async (pw, sentence) => {
      const r = await signup(base, Object.assign(owner(), { password: pw }));
      assert.equal(r.status, 400, r.text);
      assert.equal(r.body.error, sentence);
      assert.equal(r.setCookie.length, 0);
    };
    await refused(letters(9), 'Use at least 10 characters.');
    await refused(letters(129), 'Use at most 128 characters.');
    await refused('1234567890', 'That password is too common. Choose another.');
    await refused('QWERTYUIOP', 'That password is too common. Choose another.');
    assert.equal(server.signin.password.problem(letters(14), 'investor'), 'Use at least 15 characters.');
    assert.equal(server.signin.password.problem(letters(15), 'investor'), '');
    assert.equal(server.signin.password.problem(letters(10), 'team'), '');
    const investor = await server.signin.people.create({ workspace: 'w', kind: 'investor', role: 'investor', investorId: 'HRC-0001', email: 'ivy@investor.example', name: 'Ivy Investor', password: letters(15) });
    assert.equal(server.signin.password.problem(letters(14), investor.kind), 'Use at least 15 characters.');
    assert.equal((await signup(base, Object.assign(owner(' 128'), { password: letters(128) }))).status, 201);
    // A compatibility character (U+FB01) and the two letters it stands for are the same password (NFKC).
    const tail = letters(14);
    const s = await signup(base, Object.assign(owner(' Ligature'), { email: 'lig@harborridge.example', password: `ﬁ${tail}` }));
    assert.equal(s.status, 201, s.text);
    const r = await signin(base, { email: 'lig@harborridge.example', password: `fi${tail}` });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.stage, 'setup');
  });
});

test('sign-in stages', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const o = owner();
    const up = await signup(base, o);
    const ws = up.body.workspace.id;
    const r = await signin(base, { email: o.email, password: o.password });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { stage: 'setup' });
    assert.equal(r.setCookie.length, 1);
    assert.notEqual(r.cookie, up.cookie, 'a new session id at every sign-in');
    assert.equal((await call(base, 'GET', '/v1/auth/me', { cookie: r.cookie })).body.stage, 'setup');
    // The same email in capitals and with spaces is the same person.
    assert.equal((await signin(base, { email: ' PAT@HarborRidge.example ', password: o.password })).status, 200);

    const wrong = await signin(base, { email: o.email, password: letters(16) });
    const unknown = await signin(base, { email: 'nobody@harborridge.example', password: letters(16) });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, { error: 'The email or password is not right.' });
    assert.deepEqual(unknown.body, wrong.body);
    assert.equal(wrong.setCookie.length + unknown.setCookie.length, 0);

    const ipw = letters(16);
    await server.signin.people.create({ workspace: ws, kind: 'investor', role: 'investor', investorId: 'HRC-0001', email: 'ivy@investor.example', name: 'Ivy Investor', password: ipw });
    const inv = await signin(base, { email: 'ivy@investor.example', password: ipw });
    assert.equal(inv.status, 200, inv.text);
    assert.deepEqual(inv.body, { stage: 'full' });
    const im = await call(base, 'GET', '/v1/auth/me', { cookie: inv.cookie });
    assert.equal(im.body.person.kind, 'investor');
    assert.equal(im.body.person.investorId, 'HRC-0001');

    const tpw = letters(16);
    const teamer = await server.signin.people.create({ workspace: ws, kind: 'team', role: 'admin', email: 'sam@harborridge.example', name: 'Sam Admin', password: tpw });
    server.signin.people.update(teamer.id, { twoStep: { on: true } });
    const code = await signin(base, { email: 'sam@harborridge.example', password: tpw });
    assert.deepEqual(code.body, { stage: 'code' });
  });
});

test('choose firm', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base) => {
    const a = owner(' One');
    const b = Object.assign(owner(' Two'), { password: a.password });
    const ua = await signup(base, a);
    const ub = await signup(base, b);
    assert.equal(ub.status, 201, ub.text);
    const r = await signin(base, { email: a.email, password: a.password });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.stage, 'choose');
    assert.deepEqual(r.body.firms.map((f) => f.id).sort(), [ua.body.workspace.id, ub.body.workspace.id].sort());
    assert.deepEqual(r.body.firms.find((f) => f.id === ub.body.workspace.id), { id: ub.body.workspace.id, name: 'Harbor Ridge Capital Two' });
    assert.equal(r.setCookie.length, 0, 'no session before a firm is chosen');
    const two = await signin(base, { email: a.email, password: a.password, workspace: ub.body.workspace.id });
    assert.deepEqual(two.body, { stage: 'setup' });
    const me = await call(base, 'GET', '/v1/auth/me', { cookie: two.cookie });
    assert.equal(me.body.workspace.id, ub.body.workspace.id);
    assert.equal(me.body.person.id, ub.body.person.id);
    // Tries sent at once for one email are checked one at a time; the other waits.
    const both = await Promise.all([signin(base, { email: a.email, password: letters(16) }), signin(base, { email: a.email, password: letters(16) })]);
    assert.deepEqual(both.map((x) => x.status).sort(), [401, 429]);
    assert.equal(both.find((x) => x.status === 429).body.error, 'Too many tries. Wait 1 second and try again.');
  });
});

test('lockout', async () => {
  const { file, store } = tmpStore();
  let t = START;
  const now = () => t;
  const env = { DATA_KEY: key(), PUBLIC_URL: ORIGIN };
  await withServer({ env, store, now }, async (base, server) => {
    const o = owner();
    await signup(base, o);
    const bad = () => signin(base, { email: o.email, password: letters(16) });
    const good = () => signin(base, { email: o.email, password: o.password });
    for (let i = 0; i < 5; i++) assert.equal((await bad()).status, 401);
    const waits = async (n) => {
      const r = await good();
      assert.equal(r.status, 429, r.text);
      assert.equal(r.body.error, `Too many tries. Wait ${n} ${n === 1 ? 'second' : 'seconds'} and try again.`);
      assert.equal(r.headers.get('retry-after'), String(n));
      assert.equal(r.setCookie.length, 0);
    };
    await waits(1);
    assert.equal((await good()).body.error, 'Too many tries. Wait 1 second and try again.');
    for (const n of [2, 4, 8, 16]) {
      t += (n / 2) * 1000;
      assert.equal((await bad()).status, 401);
      await waits(n);
    }
    t += 16 * 1000;
    const locked = await bad(); // the 10th wrong password within an hour
    const LOCKED = 'This account is locked for 15 minutes after too many tries. You can still reset your password.';
    assert.equal(locked.status, 423, locked.text);
    assert.equal(locked.body.error, LOCKED);
    const still = await good();
    assert.equal(still.status, 423);
    assert.equal(still.body.error, LOCKED);
    // The lock is on the person's record: a restarted server refuses too.
    server.store.flush();
    await withServer({ env, store: openStore(file), now }, async (base2) => {
      const r = await signin(base2, { email: o.email, password: o.password });
      assert.equal(r.status, 423, r.text);
    });
    t += 15 * MIN;
    const ok = await good();
    assert.equal(ok.status, 200, ok.text);
    const rec = server.store.list('people')[0];
    assert.equal(rec.fails.count, 0);
    assert.equal(rec.fails.lockedUntil, 0);

    // The waits double up to 900 seconds (tries an hour apart, so no lock).
    const qpw = letters(16);
    await server.signin.people.create({ workspace: rec.workspace, kind: 'team', role: 'team', email: 'quinn@harborridge.example', name: 'Quinn Team', password: qpw });
    const qbad = () => signin(base, { email: 'quinn@harborridge.example', password: letters(16) });
    for (let i = 0; i < 5; i++) assert.equal((await qbad()).status, 401);
    for (let n = 6; n <= 15; n++) {
      t += HOUR + 1000;
      assert.equal((await qbad()).status, 401, `try ${n}`);
      const r = await signin(base, { email: 'quinn@harborridge.example', password: qpw });
      const want = Math.min(900, 2 ** (n - 5));
      assert.equal(r.status, 429);
      assert.equal(r.headers.get('retry-after'), String(want));
    }
  });
});

test('per address', async () => {
  const env = { DATA_KEY: key(), PUBLIC_URL: ORIGIN, TRUST_PROXY: '1' };
  const from = (ip) => ({ headers: { 'X-Forwarded-For': ip } });
  await withServer({ env }, async (base) => {
    for (let i = 1; i <= 20; i++) assert.equal((await signin(base, { email: `n${i}@nowhere.example`, password: letters(16) }, from('203.0.113.7'))).status, 401, `try ${i}`);
    const r = await signin(base, { email: 'n21@nowhere.example', password: letters(16) }, from('203.0.113.7'));
    assert.equal(r.status, 429);
    assert.equal(r.body.error, 'Too many requests');
    assert.equal((await signin(base, { email: 'n22@nowhere.example', password: letters(16) }, from('203.0.113.8'))).status, 401, 'another address is not held');
  });
  await withServer({ env: Object.assign({}, env, { AUTH_COUNTER_MAX: '3', AUTH_SIGNIN_PER_15MIN: '2' }) }, async (base, server) => {
    const tryFrom = async (ip) => (await signin(base, { email: `${ip.replace(/\./g, '-')}@nowhere.example`, password: letters(16) }, from(ip))).status;
    for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) for (let i = 0; i < 2; i++) assert.equal(await tryFrom(ip), 401);
    assert.equal(await tryFrom('198.51.100.4'), 401); // the fourth address evicts the oldest (the first)
    assert.equal(server.signin.limits.keys().length, 3);
    assert.equal(await tryFrom('198.51.100.2'), 429, 'the second keeps its count');
    assert.equal(await tryFrom('198.51.100.3'), 429, 'the third keeps its count');
    assert.equal(await tryFrom('198.51.100.4'), 401);
    assert.equal(await tryFrom('198.51.100.1'), 401, 'the first was evicted, so it starts again');
  });
});

test('timeouts', async () => {
  let t = START;
  const now = () => t;
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN }, now }, async (base, server) => {
    const o = owner();
    const me = async (cookie) => (await call(base, 'GET', '/v1/auth/me', { cookie })).status;
    const up = await signup(base, o);
    assert.equal(await me(up.cookie), 200);
    t += 11 * MIN;
    assert.equal(await me(up.cookie), 401, 'a half-done sign-in ends after 10 minutes');

    const idle = await signin(base, { email: o.email, password: o.password });
    promote(server, idle.cookie);
    assert.equal(await me(idle.cookie), 200);
    t += 61 * MIN;
    assert.equal(await me(idle.cookie), 401, '61 idle minutes');

    const long = await signin(base, { email: o.email, password: o.password });
    promote(server, long.cookie);
    const began = t;
    while (t + 50 * MIN < began + 12 * HOUR) {
      t += 50 * MIN;
      assert.equal(await me(long.cookie), 200, `active at ${(t - began) / MIN} minutes`);
    }
    t += 50 * MIN;
    assert.equal(await me(long.cookie), 401, 'past 12 hours');

    const last = await signin(base, { email: o.email, password: o.password });
    promote(server, last.cookie);
    const out = await call(base, 'POST', '/v1/auth/signout', { body: {}, cookie: last.cookie });
    assert.equal(out.status, 200, out.text);
    assert.deepEqual(out.body, { ok: true });
    assert.match(out.setCookie[0], /^session=; Path=\/; HttpOnly; SameSite=Strict; Max-Age=0$/);
    assert.equal(await me(last.cookie), 401);
    assert.equal(server.store.list('sessions').length, 4);
    server.signin.purge(t + 1000);
    assert.ok(server.store.get('sessions', sha(sidOf(last.cookie))), 'kept until a day after it ended');
    server.signin.purge(t + DAY + 1000);
    assert.equal(server.store.list('sessions').length, 0);
  });
});

test('sealed and minimal', async () => {
  const { file, store } = tmpStore();
  const seen = [];
  const keep = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(keep)) console[k] = (...a) => seen.push(a.map(String).join(' '));
  const ip = '198.51.100.23';
  const o = owner();
  const first = key();
  try {
    await withServer({ env: { DATA_KEY: first, PUBLIC_URL: ORIGIN, TRUST_PROXY: '1' }, store }, async (base, server) => {
      const h = { headers: { 'X-Forwarded-For': ip } };
      const up = await call(base, 'POST', '/v1/auth/signup', Object.assign({ body: o }, h));
      assert.equal(up.status, 201);
      await signin(base, { email: o.email, password: letters(16) }, h);
      await signin(base, { email: 'nobody@harborridge.example', password: letters(16) }, h);
      const r = await signin(base, { email: o.email, password: o.password }, h);
      await call(base, 'GET', '/v1/auth/me', Object.assign({ cookie: r.cookie }, h));
      await call(base, 'POST', '/v1/auth/signout', Object.assign({ body: {}, cookie: r.cookie }, h));
      await call(base, 'GET', '/v1/auth/status', h);
      for (const k of server.signin.limits.keys()) assert.match(k, /^(signin|signup):[0-9a-f]{64}$/, 'counters are keyed by an HMAC of the address');
      assert.ok(server.signin.limits.keys().length >= 2);
      server.store.flush();
    });
  } finally {
    Object.assign(console, keep);
  }
  const text = readFileSync(file, 'utf8') + '\n' + seen.join('\n');
  for (const s of [o.email, 'harborridge.example', 'nobody@', o.name, o.password, ip, '127.0.0.1']) assert.ok(!text.includes(s), `a plain value in the store or the log: ${s.slice(0, 3)}...`);
  const events = JSON.parse(readFileSync(file, 'utf8')).events.filter((e) => e.type === 'auth');
  assert.ok(events.length >= 3);
  for (const e of events) assert.deepEqual(Object.keys(e).sort(), ['action', 'at', 'type', 'workspace']);

  // After DATA_KEY is replaced (the old one kept as DATA_KEY_PREVIOUS), the Owner still signs in and is re-indexed.
  const before = Object.values(JSON.parse(readFileSync(file, 'utf8')).people)[0].emailIndex;
  await withServer({ env: { DATA_KEY: key(), DATA_KEY_PREVIOUS: first, PUBLIC_URL: ORIGIN }, store: openStore(file) }, async (base, server) => {
    const r = await signin(base, { email: o.email, password: o.password });
    assert.equal(r.status, 200, r.text);
    const me = await call(base, 'GET', '/v1/auth/me', { cookie: r.cookie });
    assert.equal(me.body.person.email, o.email);
    assert.notEqual(server.store.list('people')[0].emailIndex, before);
  });
});
