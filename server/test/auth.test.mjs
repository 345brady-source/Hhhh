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
