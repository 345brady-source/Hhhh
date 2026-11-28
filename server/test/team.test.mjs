// gate: tests 6
// The firm's team on the server (plan 15-05, SE-05, C-11): invitations shown once with only the token's hash kept for 7
// days, acceptance with a password, role changes (never the Owner's), removal (sessions ended, email and two-step deleted,
// name kept), an Accountant's end date and its renewal, and the transfer of ownership. Every password, key and token here
// is made by the test; full sessions are made by writing the stage and mfaAt of the test's own session record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withServer } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { REFUSALS } from '../lib/roles.mjs';

const ORIGIN = 'http://127.0.0.1';
const key = () => randomBytes(32).toString('base64');
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from(randomBytes(n), (b) => ABC[b % 52]).join('');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const DAY = 24 * 60 * 60 * 1000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const LINK = 'This invitation link is not valid or has expired. Ask the firm for a new one.';

async function call(base, method, path, { body, cookie, origin = ORIGIN, type = 'application/json' } = {}) {
  const h = {};
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
const promote = (server, cookie) => server.store.put('sessions', { id: sha(cookie.split('=')[1]), stage: 'full', mfaAt: new Date().toISOString() });
async function signedUp(base, server) {
  const f = { firm: 'Harbor Ridge Capital', name: 'Pat Owner', email: 'pat@harborridge.example', password: letters(16) };
  const r = await call(base, 'POST', '/v1/auth/signup', { body: f });
  assert.equal(r.status, 201, r.text);
  promote(server, r.cookie);
  return { ws: r.body.workspace.id, cookie: r.cookie, id: r.body.person.id };
}
async function member(base, server, ws, role, extra = {}) {
  const password = letters(16);
  const email = `${role}.${letters(6).toLowerCase()}@harborridge.example`;
  const name = `${role[0].toUpperCase()}${role.slice(1)} Person`;
  const p = await server.signin.people.create(Object.assign({ workspace: ws, kind: 'team', role, email, name, password }, extra));
  const s = await call(base, 'POST', '/v1/auth/signin', { body: { email, password } });
  assert.equal(s.status, 200, s.text);
  promote(server, s.cookie);
  return { id: p.id, name, email, password, cookie: s.cookie };
}
const tokenOf = (link) => link.split('#accept-')[1];

test('invite and accept', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await signedUp(base, server);
    const inv = await call(base, 'POST', '/v1/team/invite', { cookie: owner.cookie, body: { kind: 'team', name: 'Sam Admin', email: 'sam@harborridge.example', role: 'admin' } });
    assert.equal(inv.status, 201, inv.text);
    assert.match(inv.body.link, /^http:\/\/127\.0\.0\.1\/#accept-[A-Za-z0-9_-]{43}$/);
    const token = tokenOf(inv.body.link);
    assert.equal(token.length, 43);
    const rec = server.store.get('people', inv.body.person.id);
    assert.equal(rec.invite.hash, sha(token), 'only the token’s SHA-256 is kept');
    assert.ok(!JSON.stringify(server.store.data()).includes(token), 'the token itself is nowhere in the store');
    assert.equal(inv.body.person.status, 'invited');

    const look = await call(base, 'GET', `/v1/team/accept?token=${token}`, { origin: '' });
    assert.equal(look.status, 200, look.text);
    assert.deepEqual(look.body, { firm: 'Harbor Ridge Capital', name: 'Sam Admin', email: 'sam@harborridge.example', role: 'admin', kind: 'team' });

    // W3: an account is made only from the portal's own page, as JSON.
    const password = letters(12);
    for (const [origin, type] of [['https://evil.example', 'text/plain'], ['https://evil.example', 'application/json'], [ORIGIN, 'text/plain']]) {
      const r = await call(base, 'POST', '/v1/team/accept', { body: JSON.stringify({ token, password }), origin, type });
      assert.equal(r.status, 403, `${origin} ${type}`);
      assert.equal(r.setCookie.length, 0);
    }
    assert.equal((await call(base, 'POST', '/v1/team/accept', { body: { token, password: 'short' } })).status, 400);
    const ok = await call(base, 'POST', '/v1/team/accept', { body: { token, password } });
    assert.equal(ok.status, 200, ok.text);
    assert.deepEqual(ok.body, { stage: 'setup' });
    assert.ok(ok.cookie, 'a session cookie is set');
    assert.equal((await call(base, 'GET', '/v1/invitations', { cookie: ok.cookie })).status, 401, 'two-step first: the session is at setup');

    const list = await call(base, 'GET', '/v1/team', { cookie: owner.cookie });
    assert.equal(list.status, 200, list.text);
    const sam = list.body.find((p) => p.email === 'sam@harborridge.example');
    assert.deepEqual([sam.status, sam.role, sam.owner, sam.twoStep], ['active', 'admin', false, false]);
    assert.ok(list.body.find((p) => p.id === owner.id).owner);

    for (const r of [await call(base, 'GET', `/v1/team/accept?token=${token}`, { origin: '' }), await call(base, 'POST', '/v1/team/accept', { body: { token, password: letters(12) } })]) assert.deepEqual([r.status, r.body], [404, { error: LINK }], 'one use');
    assert.equal((await call(base, 'POST', '/v1/team/invite', { cookie: owner.cookie, body: { kind: 'team', name: 'Sam Again', email: 'SAM@harborridge.example', role: 'team' } })).body.error, 'That person is already on the team.');
    const actions = server.audit.list(owner.ws).map((e) => e.action);
    assert.ok(actions.includes('Team member invited') && actions.includes('Invitation accepted'), actions.join(', '));
  });
});

test('roles', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await signedUp(base, server);
    const staff = await member(base, server, owner.ws, 'team');
    const admin = await member(base, server, owner.ws, 'admin');
    for (const role of ['readonly', 'team']) {
      const r = await call(base, 'POST', `/v1/team/${staff.id}/role`, { cookie: owner.cookie, body: { role } });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.body.role, role);
      assert.equal(server.store.get('people', staff.id).role, role);
    }
    const own = await call(base, 'POST', `/v1/team/${owner.id}/role`, { cookie: admin.cookie, body: { role: 'team' } });
    assert.equal(own.status, 403, 'an Admin never changes the Owner’s role');
    assert.equal(server.store.get('people', owner.id).role, 'owner');
    assert.equal((await call(base, 'POST', '/v1/team/invite', { cookie: owner.cookie, body: { kind: 'team', name: 'New Owner', email: 'no@harborridge.example', role: 'owner' } })).status, 400);
    const si = await call(base, 'POST', '/v1/team/invite', { cookie: staff.cookie, body: { kind: 'team', name: 'Lee Staff', email: 'lee@harborridge.example', role: 'team' } });
    assert.deepEqual([si.status, si.body], [403, { error: REFUSALS.team, code: 'role' }]);
    server.store.put('workspaces', { id: owner.ws, confirmedAt: new Date().toISOString() }); // C-16 (15-14): investors are invited once the Owner's email is confirmed
    const iv = await call(base, 'POST', '/v1/team/invite', { cookie: staff.cookie, body: { kind: 'investor', name: 'Ivy Investor', email: 'ivy@investor.example', investorId: 'HRC-0001' } });
    assert.equal(iv.status, 201, `Staff sends an investor’s access invitation (operate): ${iv.text}`);
    assert.deepEqual([iv.body.person.kind, iv.body.person.investorId, iv.body.person.role], ['investor', 'HRC-0001', 'investor']);
    assert.equal((await call(base, 'POST', '/v1/team/invite', { cookie: staff.cookie, body: { kind: 'investor', name: 'Ivy Two', email: 'ivy2@investor.example', investorId: 'HRC-0001' } })).status, 400, 'one sign-in per investor');
    const ivList = await call(base, 'GET', '/v1/team?kind=investor', { cookie: staff.cookie });
    assert.equal(ivList.status, 200, ivList.text);
    assert.deepEqual(ivList.body.map((p) => p.investorId), ['HRC-0001']);
    assert.deepEqual((await call(base, 'GET', '/v1/team', { cookie: staff.cookie })).body, { error: REFUSALS.team, code: 'role' });
    // The investor accepts with a 15-character password and gets their own sign-in.
    const acc = await call(base, 'POST', '/v1/team/accept', { body: { token: tokenOf(iv.body.link), password: letters(15) } });
    assert.equal(acc.status, 200, acc.text);
    assert.equal(acc.body.stage, 'full');
    assert.equal(server.signin.investor({ method: 'GET', headers: { cookie: acc.cookie } }).investorId, 'HRC-0001');
    const log = server.audit.list(owner.ws);
    assert.equal(log.filter((e) => e.action === 'Role changed').length, 2);
    assert.ok(log.some((e) => e.action === 'Refused' && e.personName === admin.name), 'the in-module refusal is on the log too');
  });
});

test('remove', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await signedUp(base, server);
    const staff = await member(base, server, owner.ws, 'team');
    const admin = await member(base, server, owner.ws, 'admin');
    server.signin.people.update(staff.id, { twoStep: { on: true }, recovery: ['x'] });
    assert.equal((await call(base, 'GET', '/v1/invitations', { cookie: staff.cookie })).status, 200);
    const r = await call(base, 'POST', `/v1/team/${staff.id}/remove`, { cookie: owner.cookie, body: {} });
    assert.deepEqual([r.status, r.body], [200, { ok: true }]);
    assert.equal((await call(base, 'GET', '/v1/invitations', { cookie: staff.cookie })).status, 401, 'Staff’s sessions ended at once');
    const rec = server.store.get('people', staff.id);
    assert.equal(rec.status, 'removed');
    assert.equal(server.signin.people.open(rec).name, staff.name, 'the name is kept for the change log');
    assert.ok(!rec.email && !rec.twoStep && !rec.pw && !rec.emailIndex && !(rec.recovery || []).length, 'no sealed email, password or two-step remains');
    const signin = await call(base, 'POST', '/v1/auth/signin', { body: { email: staff.email, password: staff.password } });
    const wrong = await call(base, 'POST', '/v1/auth/signin', { body: { email: 'nobody@harborridge.example', password: letters(16) } });
    assert.deepEqual([signin.status, signin.body], [wrong.status, wrong.body]);
    assert.deepEqual(signin.body, { error: 'The email or password is not right.' });
    const listed = (await call(base, 'GET', '/v1/team', { cookie: owner.cookie })).body.find((p) => p.id === staff.id);
    assert.deepEqual([listed.status, listed.email, listed.name], ['removed', '', staff.name]);
    for (const [who, target] of [[owner, owner.id], [admin, owner.id], [admin, admin.id]]) assert.equal((await call(base, 'POST', `/v1/team/${target}/remove`, { cookie: who.cookie, body: {} })).status, 403, `${who.id} removing ${target}`);
    assert.ok(server.audit.list(owner.ws).some((e) => e.action === 'Team member removed'));
  });
});

test('accountant', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await signedUp(base, server);
    const admin = await member(base, server, owner.ws, 'admin');
    const a = await call(base, 'POST', '/v1/team/invite', { cookie: owner.cookie, body: { kind: 'team', name: 'Cora Accountant', email: 'cora@cpa.example', role: 'accountant' } });
    assert.equal(a.status, 201, a.text);
    assert.equal(a.body.person.endsOn, isoDay(Date.parse(`${isoDay(Date.now())}T00:00:00Z`) + 90 * DAY), 'today + 90 by default');
    const id = a.body.person.id;
    const later = isoDay(Date.parse(`${isoDay(Date.now())}T00:00:00Z`) + 200 * DAY);
    const r = await call(base, 'POST', `/v1/team/${id}/renew`, { cookie: owner.cookie, body: { endsOn: later } });
    assert.equal(r.status, 200, r.text);
    assert.equal(server.store.get('people', id).endsOn, later);
    const far = isoDay(Date.parse(`${isoDay(Date.now())}T00:00:00Z`) + 400 * DAY);
    assert.equal((await call(base, 'POST', `/v1/team/${id}/renew`, { cookie: owner.cookie, body: { endsOn: far } })).status, 400);
    assert.equal(server.store.get('people', id).endsOn, later, 'unchanged by the refused renewal');
    assert.equal((await call(base, 'POST', `/v1/team/${admin.id}/renew`, { cookie: owner.cookie, body: { endsOn: later } })).status, 400, 'only an Accountant has an end date');
    assert.ok(server.audit.list(owner.ws).some((e) => e.action === 'Access renewed'));
  });
});

test('transfer', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await signedUp(base, server);
    const staff = await member(base, server, owner.ws, 'team', { twoStep: { on: true } });
    const bare = await member(base, server, owner.ws, 'admin');
    const admin = await member(base, server, owner.ws, 'admin', { twoStep: { on: true } });
    assert.equal((await call(base, 'POST', '/v1/team/transfer', { cookie: owner.cookie, body: { to: staff.id } })).status, 400, 'to Staff');
    assert.equal((await call(base, 'POST', '/v1/team/transfer', { cookie: owner.cookie, body: { to: bare.id } })).status, 400, 'to an Admin without two-step');
    const byAdmin = await call(base, 'POST', '/v1/team/transfer', { cookie: admin.cookie, body: { to: bare.id } });
    assert.deepEqual([byAdmin.status, byAdmin.body], [403, { error: REFUSALS.account, code: 'role' }]);
    const sid = sha(owner.cookie.split('=')[1]);
    const authAt = server.store.get('sessions', sid).authAt;
    server.store.put('sessions', { id: sid, authAt: new Date(Date.now() - 11 * 60 * 1000).toISOString() });
    const stale = await call(base, 'POST', '/v1/team/transfer', { cookie: owner.cookie, body: { to: admin.id } });
    assert.deepEqual([stale.status, stale.body.code], [401, 'fresh']);
    server.store.put('sessions', { id: sid, authAt });
    const t = await call(base, 'POST', '/v1/team/transfer', { cookie: owner.cookie, body: { to: admin.id } });
    assert.equal(t.status, 200, t.text);
    assert.deepEqual([t.body.owner.id, t.body.owner.role, t.body.admin.id, t.body.admin.role], [admin.id, 'owner', owner.id, 'admin']);
    assert.equal(server.store.get('workspaces', owner.ws).ownerId, admin.id);
    assert.equal((await call(base, 'POST', '/v1/billing/card/setup', { cookie: owner.cookie, body: {} })).status, 403, 'the old Owner is an Admin now');
    assert.ok(server.audit.list(owner.ws).some((e) => e.action === 'Ownership transferred'));
  });
});

test('tokens', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'team-'));
  const file = join(dir, 'store.json');
  let t = Date.now();
  const printed = [];
  const keep = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  for (const k of Object.keys(keep)) console[k] = (...a) => printed.push(a.map(String).join(' '));
  const links = [];
  try {
    await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN }, store: openStore(file), now: () => t }, async (base, server) => {
      const owner = await signedUp(base, server);
      // resend: a new link, and the old one stops working
      const a = await call(base, 'POST', '/v1/team/invite', { cookie: owner.cookie, body: { kind: 'team', name: 'Ada Staff', email: 'ada@harborridge.example', role: 'team' } });
      assert.equal(a.status, 201, a.text);
      const again = await call(base, 'POST', `/v1/team/${a.body.person.id}/resend`, { cookie: owner.cookie, body: {} });
      assert.equal(again.status, 200, again.text);
      links.push(a.body.link, again.body.link);
      assert.notEqual(again.body.link, a.body.link);
      assert.deepEqual((await call(base, 'GET', `/v1/team/accept?token=${tokenOf(a.body.link)}`, { origin: '' })).body, { error: LINK });
      assert.equal((await call(base, 'GET', `/v1/team/accept?token=${tokenOf(again.body.link)}`, { origin: '' })).status, 200);
      // 7 days and one minute later the link is gone
      const b = await call(base, 'POST', '/v1/team/invite', { cookie: owner.cookie, body: { kind: 'team', name: 'Bo Staff', email: 'bo@harborridge.example', role: 'readonly' } });
      links.push(b.body.link);
      t += 7 * DAY + 60 * 1000;
      assert.deepEqual((await call(base, 'GET', `/v1/team/accept?token=${tokenOf(b.body.link)}`, { origin: '' })).body, { error: LINK });
      const late = await call(base, 'POST', '/v1/team/accept', { body: { token: tokenOf(b.body.link), password: letters(12) } });
      assert.deepEqual([late.status, late.body, late.setCookie.length], [404, { error: LINK }, 0]);

      server.store.flush();
      const saved = readFileSync(file, 'utf8');
      const opened = JSON.stringify(server.audit.exportAll(owner.ws));
      const events = JSON.stringify(server.store.data().events || []);
      for (const l of links) {
        for (const [where, text] of [['the store file', saved], ['the events', events], ['the change log', opened], ['console output', printed.join('\n')]]) {
          assert.ok(!text.includes(tokenOf(l)), `no token in ${where}`);
          assert.ok(!text.includes('#accept-'), `no link in ${where}`);
        }
      }
      assert.ok(opened.includes('Invitation sent again'));
      server.store.close();
    });
  } finally {
    Object.assign(console, keep);
    rmSync(dir, { recursive: true, force: true });
  }
});
