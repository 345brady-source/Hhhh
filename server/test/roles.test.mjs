// gate: tests 6
// Roles on the server (plan 15-05, SE-05 and SE-08): one route table (lib/roles.mjs ROUTES) checked by one guard for every
// signed-in person; a refusal answers 403 with the table's sentence and is written to the server change log with the person
// from the session. Every password, key and token here is made by the test; full sessions are made by writing the stage
// and mfaAt of the test's own session record (15-04's code step is tested there).
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { withServer, mockFetch } from './helpers.mjs';
import { REFUSALS, ROUTES, PERMISSIONS, ROLES, lineMatches, createGuards } from '../lib/roles.mjs';

const ORIGIN = 'http://127.0.0.1';
const key = () => randomBytes(32).toString('base64');
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letters = (n) => Array.from(randomBytes(n), (b) => ABC[b % 52]).join('');
const sha = (x) => createHash('sha256').update(x).digest('hex');

async function call(base, method, path, { body, cookie, origin = ORIGIN, type = 'application/json', bearer } = {}) {
  const h = {};
  if (body !== undefined) h['Content-Type'] = type;
  if (origin) h.Origin = origin;
  if (cookie) h.Cookie = cookie;
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  const set = res.headers.getSetCookie();
  return { status: res.status, body: json, text, headers: res.headers, cookie: set.length ? set[0].split(';')[0] : '' };
}
const firm = (n) => ({ firm: `Harbor Ridge Capital ${n}`, name: `Pat Owner ${n}`, email: `pat${n}@harborridge.example`, password: letters(16) });
/** Stand in for 15-04's code step: the test writes its own session's stage and mfaAt. */
const promote = (server, cookie) => server.store.put('sessions', { id: sha(cookie.split('=')[1]), stage: 'full', mfaAt: new Date().toISOString() });

/** A firm signed up through the route, its Owner's session made full. */
async function signedUp(base, server, n = 'A') {
  const f = firm(n);
  const r = await call(base, 'POST', '/v1/auth/signup', { body: f });
  assert.equal(r.status, 201, r.text);
  promote(server, r.cookie);
  return { ws: r.body.workspace.id, cookie: r.cookie, person: r.body.person, firm: f };
}
/** A team person made in the workspace, signed in through the route and made full. */
async function member(base, server, ws, role, extra = {}) {
  const pw = letters(16);
  const email = `${role}.${letters(6).toLowerCase()}@harborridge.example`;
  const name = `${role[0].toUpperCase()}${role.slice(1)} Person`;
  const p = await server.signin.people.create(Object.assign({ workspace: ws, kind: 'team', role, email, name, password: pw }, extra));
  const s = await call(base, 'POST', '/v1/auth/signin', { body: { email, password: pw } });
  assert.equal(s.status, 200, s.text);
  promote(server, s.cookie);
  return { id: p.id, name, email, cookie: s.cookie };
}

test('tracer', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN, FILINGS: '1' } }, async (base, server) => {
    const owner = await signedUp(base, server);
    const staff = await member(base, server, owner.ws, 'team');
    const r = await call(base, 'POST', '/v1/filings/orders', { cookie: staff.cookie, body: { kind: 'formd' } });
    assert.equal(r.status, 403, r.text);
    assert.deepEqual(r.body, { error: REFUSALS.spend, code: 'role' });

    const log = await call(base, 'GET', '/v1/audit', { cookie: owner.cookie });
    assert.equal(log.status, 200, log.text);
    const refused = log.body.entries.filter((e) => e.action === 'Refused');
    assert.equal(refused.length, 1, log.text);
    assert.equal(refused[0].personName, staff.name);
    assert.equal(refused[0].personId, staff.id);
    assert.equal(refused[0].detail, 'POST /v1/filings/orders: spend');

    const v = await call(base, 'GET', '/v1/audit/verify', { cookie: owner.cookie });
    assert.equal(v.status, 200, v.text);
    assert.equal(v.body.ok, true);
    assert.ok(v.body.count >= 1);
  });
});

/* ---------- the route walk ---------- */

/** Every string literal starting '/v1/' and every regular-expression literal whose source holds '\/v1\/' in a source text. */
function literals(text) {
  const out = { strings: [], regexes: [] };
  const n = text.length;
  let i = 0;
  let prev = '';
  const regexOk = () => prev === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /^(return|typeof|case|do|else|in|of|void|delete|throw|new|yield|await)$/.test(prev);
  while (i < n) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2);
      i = e < 0 ? n : e + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let str = '';
      while (j < n && text[j] !== c && (c === '`' || text[j] !== '\n')) {
        if (text[j] === '\\') {
          str += text[j + 1];
          j += 2;
        } else if (c === '`' && text[j] === '$' && text[j + 1] === '{') {
          let d = 1;
          j += 2;
          while (j < n && d) {
            if (text[j] === '{') d++;
            else if (text[j] === '}') d--;
            j++;
          }
          str += 'x'; // an interpolated id
        } else str += text[j++];
      }
      if (str.startsWith('/v1/')) out.strings.push(str);
      i = j + 1;
      prev = 'x';
      continue;
    }
    if (c === '/' && regexOk()) {
      let j = i + 1;
      let src = '';
      let cls = false;
      while (j < n && text[j] !== '\n') {
        const d = text[j];
        if (d === '\\') {
          src += d + text[j + 1];
          j += 2;
          continue;
        }
        if (d === '[') cls = true;
        else if (d === ']') cls = false;
        else if (d === '/' && !cls) break;
        src += d;
        j++;
      }
      j++;
      while (j < n && /[dgimsuyv]/.test(text[j])) j++;
      if (src.includes('\\/v1\\/')) out.regexes.push(src);
      i = j;
      prev = 'x';
      continue;
    }
    if (!/\s/.test(c)) prev = /\w/.test(c) ? (/^\w+$/.test(prev) ? prev : '') + c : c;
    i++;
  }
  return out;
}
const unescape = (src) => src.replace(/\\\//g, '/');
const escapeOf = (path) => path.replace(/\//g, '\\/');
/** The routes in a text that no line covers (a string by a path, prefix or source; a regular expression as below). */
function uncovered(text, routes) {
  const { strings, regexes } = literals(text);
  const lost = [];
  const any = (p) => routes.some((l) => lineMatches(l, p));
  for (const raw of new Set(strings)) {
    if (raw === '/v1/') continue; // the API's root, used only as a prefix test
    if (!any(raw.endsWith('/') ? `${raw}x` : raw)) lost.push(raw);
  }
  const outside = routes.filter((l) => typeof l.prefix === 'string');
  for (const src of new Set(regexes)) {
    if (routes.some((l) => l.source === src)) continue; // the identical source
    const plain = src.match(/^\^((?:\\\/|[\w.-])+)\$$/); // an anchored plain path
    if (plain && any(unescape(plain[1]))) continue;
    // under a link, public or operator prefix: that line owns everything below it
    if (outside.some((l) => src.startsWith(`^${escapeOf(l.prefix)}`) && /^(\\\/|\$|\()/.test(src.slice(1 + escapeOf(l.prefix).length)))) continue;
    // a module's dispatch test (^X(\/|$)): covered when lines name routes under X
    const disp = src.match(/^\^((?:\\\/|[\w.-])+)\(\\\/\|\$\)$/);
    if (disp) {
      const x = unescape(disp[1]);
      if (routes.some((l) => (typeof l.path === 'string' && (l.path === x || l.path.startsWith(`${x}/`))) || (typeof l.source === 'string' && l.source.startsWith(`^${escapeOf(x)}\\/`)))) continue;
    }
    lost.push(`/${src}/`);
  }
  return lost;
}
const SERVER_DIR = new URL('../', import.meta.url);
/** index.mjs and every lib module whose text holds '/v1/' (found by listing, so a module added later is walked too). */
const sources = () =>
  ['index.mjs']
    .concat(readdirSync(new URL('lib/', SERVER_DIR)).filter((f) => f.endsWith('.mjs') && f !== 'roles.mjs').map((f) => `lib/${f}`))
    .map((f) => ({ f, text: readFileSync(new URL(f, SERVER_DIR), 'utf8') }))
    .filter((x) => x.text.includes('/v1/'));

test('walk', async () => {
  const files = sources();
  assert.ok(files.some((x) => x.f === 'lib/invitations.mjs') && files.some((x) => x.f === 'lib/billing.mjs'), 'the routing modules are walked');
  for (const { f, text } of files) assert.deepEqual(uncovered(text, ROUTES), [], `${f}: routes with no line in lib/roles.mjs ROUTES`);

  // The table's own shape: one of path, prefix or source; a prefix only outside the team and investor routes; reasons.
  for (const l of ROUTES) {
    const at = ['path', 'prefix', 'source'].filter((k) => typeof l[k] === 'string');
    assert.equal(at.length, 1, JSON.stringify(l));
    assert.ok(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', '*'].includes(l.method), JSON.stringify(l));
    assert.equal(typeof l.tokens, 'boolean', JSON.stringify(l));
    if (l.who === 'team') assert.ok(PERMISSIONS.includes(l.permission) || l.permission === 'person', JSON.stringify(l));
    else if (l.who === 'investor') assert.equal(l.permission, 'portal');
    else {
      assert.ok(['link', 'public', 'operator'].includes(l.who), JSON.stringify(l));
      assert.ok(typeof l.reason === 'string' && l.reason.length > 10, `a reason for ${JSON.stringify(l)}`);
    }
    if (l.prefix !== undefined) assert.ok(!['team', 'investor'].includes(l.who), `no prefix on a ${l.who} line`);
    if (l.source !== undefined) assert.doesNotThrow(() => new RegExp(l.source));
  }
  assert.ok(Object.isFrozen(ROUTES) && Array.isArray(ROUTES), 'a flat frozen array, extended by adding lines');

  // The walker itself: a stand-in text with one route nobody listed reports exactly that route; a prefix line covers only
  // its own path or what follows it after a '/', so '/v1/invite' never stands in for '/v1/invitations/zzz' (W1).
  const stand = `if (path === '/v1/invite/progress') x(); if (path === '/v1/invitations/zzz') y(); const m = path.match(/^\\/v1\\/invite(\\/|$)/);`;
  assert.deepEqual(uncovered(stand, [{ method: '*', prefix: '/v1/invite', who: 'link', permission: '', tokens: false, reason: 'a stand-in link line' }]), ['/v1/invitations/zzz']);
  const real = readFileSync(new URL('lib/billing.mjs', SERVER_DIR), 'utf8') + `\nif (path === '/v1/zzz-nobody-listed') z();\nconst q = path.match(/^\\/v1\\/zzz\\/([^/]+)$/);`;
  assert.deepEqual(uncovered(real, ROUTES), ['/v1/zzz-nobody-listed', '/^\\/v1\\/zzz\\/([^/]+)$/']);

  // guardInvestor with a stand-in 'investor' line: only a full investor session passes, with its investorId.
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await signedUp(base, server);
    const line = { method: 'GET', path: '/v1/stand-in', who: 'investor', permission: 'portal', tokens: false };
    const { guardInvestor } = createGuards({ signin: server.signin, store: server.store, routes: [line] });
    const ask = (cookie) => guardInvestor({ method: 'GET', headers: cookie ? { cookie } : {} }, '/v1/stand-in');
    const ipw = letters(16);
    await server.signin.people.create({ workspace: owner.ws, kind: 'investor', role: 'investor', investorId: 'HRC-0001', email: 'ivy@investor.example', name: 'Ivy Investor', password: ipw });
    const ivy = await call(base, 'POST', '/v1/auth/signin', { body: { email: 'ivy@investor.example', password: ipw } });
    assert.equal(ivy.body.stage, 'full');
    const ok = ask(ivy.cookie);
    assert.equal(ok.investor.investorId, 'HRC-0001');
    const cpw = letters(16);
    const coded = await server.signin.people.create({ workspace: owner.ws, kind: 'investor', role: 'investor', investorId: 'HRC-0002', email: 'cal@investor.example', name: 'Cal Investor', password: cpw });
    server.signin.people.update(coded.id, { twoStep: { on: true } });
    const cal = await call(base, 'POST', '/v1/auth/signin', { body: { email: 'cal@investor.example', password: cpw } });
    assert.equal(cal.body.stage, 'code');
    for (const [label, cookie] of [['a team session', owner.cookie], ['a code investor session', cal.cookie], ['no cookie', '']]) assert.deepEqual(ask(cookie), { status: 401, error: 'Sign in to your portal first.', code: 'investor' }, label);
  });
});

/* ---------- each role ---------- */

// 15-RESEARCH 4.2, one line per role (the expected table, written here and not read from roles.js).
const EXPECT = {
  owner: ['view', 'operate', 'pay', 'spend', 'configure', 'team', 'account', 'personal', 'audit', 'reports'],
  admin: ['view', 'operate', 'pay', 'spend', 'configure', 'team', 'personal', 'audit', 'reports'],
  team: ['view', 'operate', 'personal', 'audit', 'reports'],
  readonly: ['view', 'personal', 'audit', 'reports'],
  accountant: ['view', 'audit', 'reports']
};
const has = (role, p) => EXPECT[role].includes(p);
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const plainDay = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
const PORTAL = `${ORIGIN}/diy.html`;
const packageBody = () => ({
  sendEmail: false,
  portalUrl: PORTAL,
  firm: { name: 'Harbor Ridge Capital', supportEmail: 'ir@harborridge.example' },
  investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
  offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', exemption: 'Rule 506(b)', currency: 'USD' },
  invitation: { cents: 25000000, package: true, clientId: 'c1' },
  verification: { accreditationRequired: false, connections: [], use: {} }
});

/** Sessions for all five roles in one firm (the Accountant's access ends in 30 days). */
async function everyRole(base, server) {
  const owner = await signedUp(base, server);
  const out = { owner: { cookie: owner.cookie, id: owner.person.id, name: owner.firm.name } };
  for (const role of ['admin', 'team', 'readonly']) out[role] = await member(base, server, owner.ws, role);
  out.accountant = await member(base, server, owner.ws, 'accountant', { endsOn: isoDay(Date.now() + 30 * 86400000) });
  return { ws: owner.ws, people: out };
}

test('each role', async () => {
  assert.deepEqual(ROLES, Object.keys(EXPECT));
  const gw = mockFetch([]);
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN, FILINGS: '1', RATE_LIMIT_PER_MIN: '0' }, fetch: gw }, async (base, server) => {
    const { people } = await everyRole(base, server);
    const routes = [
      ['GET', '/v1/invitations', 'view'],
      ['POST', '/v1/invitations', 'operate', {}],
      ['GET', '/v1/outbox', 'operate'],
      ['POST', '/v1/billing/card/setup', 'account', {}],
      ['POST', '/v1/billing/entitlements', 'spend', { items: [] }],
      ['POST', '/v1/taxdocs', 'operate', {}],
      ['GET', '/v1/audit', 'audit'],
      ['POST', '/v1/filings/orders', 'spend', {}]
    ];
    for (const role of ROLES) {
      const { cookie } = people[role];
      for (const [method, path, permission, body] of routes) {
        const r = await call(base, method, path, { cookie, body });
        if (has(role, permission)) assert.notEqual(r.status, 403, `${role} ${method} ${path} is allowed: ${r.text}`);
        else assert.deepEqual([r.status, r.body], [403, { error: REFUSALS[permission], code: 'role' }], `${role} ${method} ${path}`);
      }
      // A paid package on an invitation: refused before any payment for everyone without spend.
      if (!has(role, 'spend')) {
        const r = await call(base, 'POST', '/v1/invitations', { cookie, body: packageBody() });
        const why = has(role, 'operate') ? 'spend' : 'operate';
        assert.equal(r.status, 403, `${role} package ${r.text}`);
        assert.equal(r.body.error, REFUSALS[why], `${role} package`);
      }
    }
    assert.equal(gw.calls.length, 0, 'the payment provider was never called');
    assert.equal(server.store.list('invitations').length, 0, 'no refused package left an invitation behind');
  });
});

/* ---------- tokens once people exist (C-09) ---------- */

test('tokens once people exist', async () => {
  const API = letters(32);
  const ADMIN = letters(32);
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN, API_TOKEN: API, ADMIN_TOKEN: ADMIN, RATE_LIMIT_PER_MIN: '0' } }, async (base, server) => {
    const beta = await call(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, origin: '', body: { workspace: 'beta', name: 'Beta Partners' } });
    assert.equal(beta.status, 200, beta.text);
    assert.equal((await call(base, 'GET', '/v1/billing', { bearer: beta.body.token, origin: '' })).status, 200, 'with no person, an account token reaches billing as today');

    const owner = await signedUp(base, server);
    const list = await call(base, 'GET', '/v1/admin/accounts', { bearer: ADMIN, origin: '' });
    const acct = list.body.accounts.find((a) => a.workspace === owner.ws);
    const rot = await call(base, 'POST', `/v1/admin/accounts/${acct.id}/token`, { bearer: ADMIN, origin: '', body: {} });
    assert.equal(rot.status, 200, rot.text);
    const mine = rot.body.token;

    for (const [label, bearer, q] of [['the firm’s account token', mine, ''], ['the shared API_TOKEN', API, `?workspace=${owner.ws}`]]) {
      const inv = await call(base, 'GET', `/v1/invitations${q}`, { bearer, origin: '' });
      assert.equal(inv.status, 200, `${label}: the automation routes stay open (${inv.text})`);
      for (const path of ['/v1/billing', '/v1/audit', '/v1/outbox']) {
        const r = await call(base, 'GET', path + q, { bearer, origin: '' });
        assert.deepEqual([r.status, r.body], [403, { error: 'This needs a person signed in.', code: 'person' }], `${label} ${path}`);
      }
    }
    const still = await call(base, 'GET', '/v1/billing', { bearer: beta.body.token, origin: '' });
    assert.equal(still.status, 200, `another firm with no people keeps its token on billing (${still.text})`);
    assert.equal((await call(base, 'GET', '/v1/billing', { cookie: owner.cookie })).status, 200, 'the Owner signed in reaches billing');
  });
});

/* ---------- the Accountant's end date (C-11) ---------- */

test('accountant ends', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await signedUp(base, server);
    const yesterday = isoDay(Date.now() - 86400000);
    const old = await member(base, server, owner.ws, 'accountant', { endsOn: yesterday });
    const r = await call(base, 'GET', '/v1/audit', { cookie: old.cookie });
    assert.deepEqual([r.status, r.body], [401, { error: `Your access ended on ${plainDay(yesterday)}. Ask the firm to renew it.`, code: 'ended' }]);
    assert.ok(server.store.get('sessions', sha(old.cookie.split('=')[1])).endedAt, 'the session is ended');
    assert.deepEqual((await call(base, 'GET', '/v1/audit', { cookie: old.cookie })).body, { error: 'Not authorized' }, 'that cookie is dead afterwards');

    const today = await member(base, server, owner.ws, 'accountant', { endsOn: isoDay(Date.now()) });
    assert.equal((await call(base, 'GET', '/v1/audit', { cookie: today.cookie })).status, 200, 'the last day still opens');
    const w = await call(base, 'POST', '/v1/invitations', { cookie: today.cookie, body: {} });
    assert.deepEqual([w.status, w.body], [403, { error: REFUSALS.operate, code: 'role' }]);
  });
});

/* ---------- the change log's routes (SE-08) ---------- */

test('audit routes', async () => {
  await withServer({ env: { DATA_KEY: key(), PUBLIC_URL: ORIGIN } }, async (base, server) => {
    const owner = await signedUp(base, server);
    const staff = await member(base, server, owner.ws, 'team');
    const ro = await member(base, server, owner.ws, 'readonly');
    assert.equal((await call(base, 'POST', '/v1/billing/card/setup', { cookie: staff.cookie, body: {} })).status, 403);
    assert.equal((await call(base, 'POST', '/v1/invitations', { cookie: ro.cookie, body: {} })).status, 403);
    const ex = await call(base, 'GET', '/v1/audit/export', { cookie: owner.cookie });
    assert.equal(ex.status, 200, ex.text);
    assert.match(ex.headers.get('content-disposition'), /^attachment; filename="change-log-[\w-]+\.json"$/);
    assert.equal(ex.body.verified, true);
    assert.ok(ex.body.entries.some((e) => e.action === 'Signed in'));

    const log = await call(base, 'GET', '/v1/audit', { cookie: staff.cookie });
    assert.equal(log.status, 200, `Staff has the audit permission (${log.text})`);
    const seqs = log.body.entries.map((e) => e.seq);
    assert.deepEqual(seqs, seqs.slice().sort((a, b) => b - a), 'newest first');
    assert.equal(log.body.entries[0].action, 'Change log exported', 'the export is itself on the log');
    assert.equal(log.body.entries[0].personName, owner.firm.name);
    assert.deepEqual(log.body.entries.filter((e) => e.action === 'Refused').map((e) => [e.personName, e.detail]), [
      [ro.name, 'POST /v1/invitations: operate'],
      [staff.name, 'POST /v1/billing/card/setup: account']
    ]);
    assert.ok(log.body.entries.some((e) => e.action === 'Signed in' && e.personName === staff.name));
    const v = await call(base, 'GET', '/v1/audit/verify', { cookie: staff.cookie });
    assert.deepEqual(v.body, { ok: true, count: seqs.length, brokenAt: 0 });
    assert.ok(!/password|"pw"|token/i.test(ex.text), 'no password or token in the export');

    const ipw = letters(16);
    await server.signin.people.create({ workspace: owner.ws, kind: 'investor', role: 'investor', investorId: 'HRC-0001', email: 'ivy@investor.example', name: 'Ivy Investor', password: ipw });
    const ivy = await call(base, 'POST', '/v1/auth/signin', { body: { email: 'ivy@investor.example', password: ipw } });
    for (const path of ['/v1/audit', '/v1/audit/verify', '/v1/audit/export']) assert.equal((await call(base, 'GET', path, { cookie: ivy.cookie })).status, 401, `an investor session: ${path}`);
  });
});
