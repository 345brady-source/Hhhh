// R12 (plan 08-19): a package screening started from the investor's link screens the invitation's own names plus the role
// names the investor's own onboarding stored on the server (an entity's beneficial owners and control person, a joint
// account's second holder), at most 5; names sent in the screening call's body stay ignored (R11). The reply says how
// many names were screened. The payment provider and the check provider are fetch stand-ins answering recorded fixtures:
// no provider is called and no key exists. Helpers are copied from package-checks.test.mjs (importing a test file runs
// its tests).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

/** The default registry (with the real identity check plug-in) plus a stand-in accreditation provider. */
const PROVIDERS = Object.assign({}, await loadProviders({ env: {} }), {
  accredit: { name: 'Accreditation check', kinds: ['accreditation'], env: ['ACCREDIT_API_KEY'], createSession: () => ({ status: 'pending', url: '' }) }
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
  const store = openStore(null);
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
