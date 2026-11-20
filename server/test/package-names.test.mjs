// R12 (plan 08-19): a package screening started from the investor's link screens the invitation's own names plus the role
// names the investor's own onboarding stored on the server (an entity's beneficial owners and control person, a joint
// account's second holder), at most 5; names sent in the screening call's body stay ignored (R11). The reply says how
// many names were screened. The payment provider and the check provider are fetch stand-ins answering recorded fixtures:
// no provider is called and no key exists. Helpers are copied from package-checks.test.mjs (importing a test file runs
// its tests).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { withServer, mockFetch } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { loadProviders } from '../providers/index.mjs';

const ADMIN = 'operator-admin-token-0123456789';
const SECRET = 'sk_test_fixtureSecretKey0123456789';
const PUBKEY = 'pk_test_fixturePublishableKey01';
const PUBLIC = 'https://verify.example';
const ORIGIN = 'https://portal.example';
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';
const API = 'shared-api-token-0123456789';
const KEY = randomBytes(32).toString('base64');
const T0 = Date.parse('2026-11-19T12:00:00Z');
const FIRM = 'Harbor Ridge Capital';
const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/billing/${name}.json`, import.meta.url), 'utf8'));
const idfx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/idcheck/${name}.json`, import.meta.url), 'utf8'));
const LIMIT = 'This check was already started.';
const ACCOUNT_SAYS = 'This check runs only from an invitation with the verification package.';

const ENV = {
  ADMIN_TOKEN: ADMIN,
  PUBLIC_URL: PUBLIC,
  PORTAL_ORIGIN: ORIGIN,
  BILLING_SECRET_KEY: SECRET,
  BILLING_PUBLISHABLE_KEY: PUBKEY,
  RATE_LIMIT_PER_MIN: '0',
  DATA_KEY: KEY,
  IDCHECK_API_KEY: 'key-test-0123456789',
  IDCHECK_WORKFLOW: 'wf-test-1',
  IDCHECK_WEBHOOK_SECRET: 'whk-test-secret-abcdef',
  ACCREDIT_API_KEY: 'acc-test-0123456789'
};

const ownSeen = [];
/** The default registry (with the real identity check plug-in), a stand-in accreditation provider and a screening outside the package. */
const PROVIDERS = Object.assign({}, await loadProviders({ env: {} }), {
  accredit: { name: 'Accreditation check', kinds: ['accreditation'], env: ['ACCREDIT_API_KEY'], createSession: () => ({ status: 'pending', url: '' }) },
  // A screening provider outside the package (the firm's own), recording the names of each call.
  ownscreen: { name: 'Own screening', kinds: ['aml'], env: [], screen: (ctx) => (ownSeen.push(ctx.names.slice()), { status: 'clear', hits: [] }) }
});

const SESSIONS = /\/v3\/session\/$/;
const AML = /\/v3\/aml\/$/;
/** One fetch stand-in for both providers: the payment provider's routes and the identity check's session and screening routes answer their fixtures. */
function standIn() {
  let n = 0;
  const ok = (call) => Object.assign({}, fx('charge-succeeded').reply, { id: `pi_fixture_${++n}`, amount: Number(call.body.amount) });
  const f = mockFetch([
    ['POST', /\/v1\/customers$/, () => fx('customer-created').reply],
    ['POST', /\/v1\/setup_intents$/, () => fx('setup-created').reply],
    ['GET', /\/v1\/setup_intents\/[^/]+$/, () => fx('setup-succeeded').reply],
    ['GET', /\/v1\/payment_methods\/[^/]+$/, () => fx('payment-method').reply],
    ['POST', /\/v1\/payment_methods\/[^/]+\/detach$/, () => Object.assign({}, fx('payment-method').reply, { customer: null })],
    ['POST', /\/v1\/payment_intents$/, (call) => ok(call)],
    ['POST', SESSIONS, () => ({ status: 201, body: idfx('session-created').reply })],
    ['POST', AML, () => idfx('aml-clear').reply]
  ]);
  /** The names the stand-in screening provider was asked to screen, in order (one call per name). */
  f.screened = () => f.calls.filter((c) => c.method === 'POST' && AML.test(c.url)).map((c) => (c.body && c.body.full_name) || '');
  return f;
}

async function j(base, method, path, { bearer, invite, body, origin } = {}) {
  const headers = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, bearer !== undefined ? { Authorization: `Bearer ${bearer}` } : {}, invite !== undefined ? { 'X-Invite-Token': invite } : {}, origin ? { Origin: origin } : {});
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed, text };
}
const account = async (base, workspace) => (await j(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace, name: workspace } })).body;
async function saveCard(base, token) {
  const setup = await j(base, 'POST', '/v1/billing/card/setup', { bearer: token, origin: ORIGIN });
  assert.equal(setup.status, 200, setup.text);
  const done = await j(base, 'POST', `${setup.body.url.slice(PUBLIC.length)}/done`);
  assert.equal(done.status, 200, done.text);
}

const ENTITY = { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Quixote Holdings LLC', type: 'entity', email: 'zelda@investor.example' };
const OWN = [ENTITY.contact, ENTITY.title];
function payload(inv = {}, over = {}) {
  return Object.assign(
    {
      sendEmail: true,
      portalUrl: PORTAL,
      notifyEmail: 'ops@harborridge.example',
      firm: { name: FIRM, supportEmail: 'ir@harborridge.example' },
      investor: ENTITY,
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', exemption: 'Rule 506(b)', currency: 'USD' },
      invitation: Object.assign({ cents: 25000000, note: 'Welcome aboard' }, inv),
      verification: { accreditationRequired: false, connections: [], use: {} }
    },
    over
  );
}
// Seven role names: the contact in other letter case (dropped: it is one of the invitation's own names), then six other
// people. Only the first five of the six are ever kept.
const OTHERS = ['Amelia Oakhurst', 'Bastian Pellow', 'Corin Vashti', 'Delphine Marsh', 'Emrys Tolland', 'Fenella Sixth'];
const ROLES = ['zelda QUIXOTE'].concat(OTHERS);
const KEPT = OTHERS.slice(0, 5);
const BODY_ONLY = 'Body Only Name';

/** A server with every package setting, a stand-in for both providers and an account named alpha with a card saved. */
async function shop(opts, fn) {
  const store = opts.store || openStore(null);
  const f = standIn();
  const env = Object.assign({}, ENV, opts.env);
  await withServer({ env, fetch: f, store, providers: PROVIDERS, now: () => T0 }, async (base, server) => {
    const a = await account(base, 'alpha');
    await saveCard(base, a.token);
    const h = {
      base,
      server,
      store,
      f,
      a,
      /** A package invitation sent by alpha (an entity investor unless over says otherwise): its id and token. */
      async send(clientId, inv = {}, over = {}) {
        const r = await j(base, 'POST', '/v1/invitations', { bearer: a.token, body: payload(Object.assign({ package: true, clientId }, inv), over) });
        assert.equal(r.status, 200, r.text);
        return { id: r.body.id, token: r.body.token };
      },
      roles: (token, roles) => j(base, 'PUT', '/v1/invite/progress', { invite: token, body: { roles } }),
      step: (token) => j(base, 'PUT', '/v1/invite/progress', { invite: token, body: { stepKey: 'profile', stepLabel: 'Profile', stepIndex: 2, stepCount: 6 } }),
      screening: (token, names) => j(base, 'POST', '/v1/screenings', { invite: token, body: Object.assign({ provider: 'idcheck', investor: { id: 'HRC-0007' } }, names ? { names } : {}) })
    };
    await fn(h);
  });
}

test('R12 names: a package screening from the link screens the invitation’s names plus at most 5 stored role names, never a name from the call’s body', async () => {
  await shop({}, async (h) => {
    const p = await h.send('r1');
    const stored = await h.roles(p.token, ROLES);
    assert.equal(stored.status, 200, stored.text);
    assert.deepEqual(stored.body, { ok: true });
    const r = await h.screening(p.token, [BODY_ONLY]);
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(h.f.screened(), OWN.concat(KEPT), 'the invitation’s two names, then the first five other people, in order');
    assert.ok(!h.f.screened().includes(OTHERS[5]), 'a sixth role name is never screened');
    assert.ok(!h.f.screened().includes(BODY_ONLY), 'a name sent in the call’s body is never screened');
    assert.equal(h.f.screened().filter((n) => n.toLowerCase() === ENTITY.contact.toLowerCase()).length, 1, 'the contact is screened once');
  });
});

test('screened: the screening reply says how many names the server screened', async () => {
  await shop({}, async (h) => {
    const p = await h.send('s1');
    assert.equal((await h.roles(p.token, ROLES)).status, 200);
    const r = await h.screening(p.token, [BODY_ONLY]);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.screened, h.f.screened().length);
    assert.equal(r.body.screened, 7);
    const q = await h.send('s2');
    const before = h.f.screened().length;
    const r2 = await h.screening(q.token, [BODY_ONLY]);
    assert.equal(r2.status, 200, r2.text);
    assert.equal(r2.body.screened, h.f.screened().length - before);
    assert.equal(r2.body.screened, 2, 'with no role names stored, the invitation’s two names');
  });
});

const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const SUBMISSION = {
  investor: { id: ENTITY.id, contact: ENTITY.contact, title: ENTITY.title, email: ENTITY.email, type: 'entity', onboarding: { status: 'complete' } },
  request: { id: 'req-1', type: 'subscription', offeringId: 'hr-fund-ii', investorId: ENTITY.id, cents: 25000000, status: 'pending', envelopeId: 'env-1' },
  envelope: { id: 'env-1', status: 'sent', requestId: 'req-1', docId: 'tpl-doc-1', workDocId: 'env-1-work' },
  files: { 'env-1-work': pdf('SIGNEDMARKER').toString('base64') },
  docs: [{ id: 'env-1-work', title: 'Subscription agreement (signed by the investor)' }],
  audit: [],
  notifications: []
};
/** True when text holds any of the role names (in any letter case). */
const holdsRole = (text) => OTHERS.concat(['Gideon Latecomer']).some((n) => String(text).toLowerCase().includes(n.toLowerCase()));

test('R12 roles: role names are stored sealed, only for a package invitation, replaced by a later report, refused when not a list, never after completion', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'r12-'));
  const file = join(dir, 'store.json');
  try {
    const store = openStore(file);
    await shop({ store }, async (h) => {
      const names = (id) => h.server.invitations.roleNames(h.store.get('invitations', id));
      const p = await h.send('o1');
      assert.equal((await h.roles(p.token, ROLES)).status, 200);
      assert.deepEqual(names(p.id), KEPT, 'the first five other people are stored');
      assert.ok(h.store.get('invitations', p.id).roleNames, 'stored on the invitation');
      h.store.flush();
      const disk = readFileSync(file, 'utf8');
      assert.ok(disk.includes(p.id), 'the store file holds the invitation');
      assert.ok(!holdsRole(disk), 'no role name in plain text in the store file');

      // A later report replaces the names.
      assert.equal((await h.roles(p.token, ['Gideon Latecomer'])).status, 200);
      assert.deepEqual(names(p.id), ['Gideon Latecomer']);
      // Not a list: refused, nothing stored.
      const bad = await h.roles(p.token, 'x');
      assert.equal(bad.status, 400, bad.text);
      assert.deepEqual(bad.body, { error: 'roles must be a list' });
      assert.deepEqual(names(p.id), ['Gideon Latecomer'], 'a refused report leaves the stored names');
      // A step report without roles leaves the stored names as they were.
      const step = await h.step(p.token);
      assert.equal(step.status, 200, step.text);
      assert.equal(h.store.get('invitations', p.id).stepKey, 'profile');
      assert.deepEqual(names(p.id), ['Gideon Latecomer']);

      // An invitation without the package: 200, nothing stored.
      const plain = await j(h.base, 'POST', '/v1/invitations', { bearer: h.a.token, body: payload({ clientId: 'o2' }) });
      assert.equal(plain.status, 200, plain.text);
      assert.ok(!h.store.get('invitations', plain.body.id).package, 'no package on it');
      const none = await h.roles(plain.body.token, ROLES);
      assert.equal(none.status, 200, none.text);
      assert.deepEqual(none.body, { ok: true });
      assert.equal(h.store.get('invitations', plain.body.id).roleNames, undefined, 'nothing stored outside the package');
      assert.deepEqual(names(plain.body.id), []);

      // A completed invitation: 409 as before, nothing stored.
      const q = await h.send('o3');
      const done = await j(h.base, 'POST', '/v1/invite/complete', { invite: q.token, body: SUBMISSION });
      assert.equal(done.status, 200, done.text);
      const late = await h.roles(q.token, ROLES);
      assert.equal(late.status, 409, late.text);
      assert.deepEqual(late.body, { error: 'This onboarding is already complete' });
      assert.equal(h.store.get('invitations', q.id).roleNames, undefined);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('R12 outside the package: the shared token and a screening provider outside the package screen as before and never add role names; a sponsor account still cannot call the package provider', async () => {
  const invented = Array.from({ length: 25 }, (_, i) => `Invented Person ${i + 1}`);
  await shop({ env: { API_TOKEN: API } }, async (h) => {
    // A package invitation with role names stored.
    const p = await h.send('x1');
    assert.equal((await h.roles(p.token, ROLES)).status, 200);
    assert.deepEqual(h.server.invitations.roleNames(h.store.get('invitations', p.id)), KEPT);

    // An invitation (shared token, no package) whose firm screens with its own provider. Its report stores nothing; role
    // names are planted on its record anyway, sealed as the server seals them, to prove the screening never adds them.
    const verification = { accreditationRequired: false, connections: [{ id: 'own-aml', name: 'Own screening', type: 'server', connector: 'ownscreen', checks: ['aml'] }], use: { aml: ['own-aml'] } };
    const inv = await j(h.base, 'POST', '/v1/invitations', { bearer: API, body: payload({}, { workspace: 'w1', verification }) });
    assert.equal(inv.status, 200, inv.text);
    assert.equal((await h.roles(inv.body.token, ROLES)).status, 200);
    h.store.put('invitations', { id: inv.body.id, roleNames: h.server.invitations.vault.seal(KEPT, `${inv.body.id}:roleNames`) });
    assert.deepEqual(h.server.invitations.roleNames(h.store.get('invitations', inv.body.id)), KEPT, 'planted');

    // The firm's own provider from the link: the invitation's names plus the body's, cut to 25, no role name.
    ownSeen.length = 0;
    const own = await j(h.base, 'POST', '/v1/screenings', { invite: inv.body.token, body: { provider: 'ownscreen', investor: { id: ENTITY.id }, names: invented } });
    assert.equal(own.status, 200, own.text);
    assert.deepEqual(ownSeen, [OWN.concat(invented).slice(0, 25)], 'outside the package the link’s names are screened as before');
    assert.equal(own.body.screened, 25);

    // The shared token: exactly the names it sends.
    const before = h.f.screened().length;
    const s = await j(h.base, 'POST', '/v1/screenings', { bearer: API, body: { provider: 'idcheck', investor: { id: ENTITY.id }, names: ['Shared One', 'Shared Two'] } });
    assert.equal(s.status, 200, s.text);
    assert.deepEqual(h.f.screened().slice(before), ['Shared One', 'Shared Two'], 'the shared token screens the names it sends, as before');
    assert.equal(s.body.screened, 2);
    assert.ok(!h.f.screened().some((n) => KEPT.includes(n)), 'no role name screened');

    // A sponsor account calling the package provider directly: 403, no provider call (pkg.gate).
    const calls = h.f.screened().length;
    const acc = await j(h.base, 'POST', '/v1/screenings', { bearer: h.a.token, body: { provider: 'idcheck', investor: { id: ENTITY.id }, names: [ENTITY.contact] } });
    assert.equal(acc.status, 403, acc.text);
    assert.deepEqual(acc.body, { error: ACCOUNT_SAYS });
    assert.equal(h.f.screened().length, calls, 'no provider call');
  });
});

test('R12 no leak: no role name in any event, log line, invitation row, GET /v1/invite or the outbox; three starts cost at most 3 x 7 calls, a fourth is refused with none', async () => {
  const captured = [];
  const keep = {};
  for (const m of ['log', 'error', 'warn', 'info']) {
    keep[m] = console[m];
    console[m] = (...args) => {
      captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      return keep[m].apply(console, args);
    };
  }
  try {
    await shop({}, async (h) => {
      const p = await h.send('l1');
      const r = await h.roles(p.token, ROLES);
      assert.equal(r.status, 200, r.text);
      assert.ok(!holdsRole(r.text), 'not in the progress reply');
      for (let i = 1; i <= 3; i++) {
        const s = await h.screening(p.token, [BODY_ONLY]);
        assert.equal(s.status, 200, `start ${i}: ${s.text}`);
        assert.equal(s.body.screened, 7);
        assert.ok(!holdsRole(s.text), 'not in a screening reply');
      }
      assert.equal(h.f.screened().length, 3 * 7, 'three starts, at most the invitation’s names plus 5 each');
      const fourth = await h.screening(p.token, [BODY_ONLY]);
      assert.equal(fourth.status, 409, fourth.text);
      assert.deepEqual(fourth.body, { error: LIMIT });
      assert.equal(h.f.screened().length, 3 * 7, 'no provider call for the fourth start');

      const rows = await j(h.base, 'GET', '/v1/invitations', { bearer: h.a.token });
      assert.equal(rows.status, 200, rows.text);
      assert.ok(rows.text.includes(p.id), 'the list holds the invitation');
      assert.ok(!holdsRole(rows.text), 'not in GET /v1/invitations');
      const row = await j(h.base, 'GET', `/v1/invitations/${p.id}`, { bearer: h.a.token });
      assert.equal(row.status, 200, row.text);
      assert.ok(!holdsRole(row.text), 'not in the invitation row');
      const view = await j(h.base, 'GET', '/v1/invite', { invite: p.token });
      assert.equal(view.status, 200, view.text);
      assert.ok(!holdsRole(view.text), 'not in GET /v1/invite');
      assert.ok(!holdsRole(JSON.stringify(h.store.list('events'))), 'not in the store’s events');
      assert.ok(!holdsRole(JSON.stringify(h.store.get('invitations', p.id).events || [])), 'not in the invitation’s events');
      assert.ok(!holdsRole(JSON.stringify(h.store.list('outbox'))), 'not in the outbox');
      assert.ok(!holdsRole(JSON.stringify(h.server.invitations.mailer.outbox())), 'not in the mailer’s outbox');
      assert.ok(!holdsRole(JSON.stringify(h.store.list('screenings'))), 'sealed in the screening records');
    });
  } finally {
    Object.assign(console, keep);
  }
  assert.ok(!holdsRole(captured.join('\n')), 'not in any log line');
});
