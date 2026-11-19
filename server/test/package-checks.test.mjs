// Who may start a paid check, and what happens to a package when its invitation ends (plan 08-15, D-01, C-05, C-08).
// A package check (the package's identity and screening provider, or its accreditation provider) starts only from the
// invitation that holds its own paid package; sponsor accounts never reach those providers directly; an unused package
// comes back as credit wherever an invitation ends, and never once its check started. The payment provider and the
// check provider are fetch stand-ins answering recorded fixtures: no provider is called and no key exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { withServer, mockFetch } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { createBilling } from '../lib/billing.mjs';
import { loadProviders } from '../providers/index.mjs';

const ADMIN = 'operator-admin-token-0123456789';
const SECRET = 'sk_test_fixtureSecretKey0123456789';
const PUBKEY = 'pk_test_fixturePublishableKey01';
const PUBLIC = 'https://verify.example';
const ORIGIN = 'https://portal.example';
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';
const API = 'shared-api-token-0123456789';
const OPERATOR = 'operator@carrow.example';
const KEY = randomBytes(32).toString('base64');
const T0 = Date.parse('2026-11-19T12:00:00Z');
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const FIRM = 'Harbor Ridge Capital';
const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/billing/${name}.json`, import.meta.url), 'utf8'));
const idfx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/idcheck/${name}.json`, import.meta.url), 'utf8'));
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
// The check provider's name, read from a fixture's source line so this file holds none.
const VENDOR = new URL(idfx('session-created')._source).hostname.split('.').slice(-2)[0];
const vendorWord = new RegExp(VENDOR, 'i');

const REFUSED = 'This check is not part of this invitation';
const ACCOUNT_SAYS = 'This check runs only from an invitation with the verification package.';
const COULD_NOT_START = 'This check could not start. Please try again later.';
const RETURNED = "This invitation's package was returned. Send a new invitation.";
const LIMIT = 'This check was already started.';

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

/** The default registry (with the real identity check plug-in) plus a stand-in accreditation provider that records its calls. */
const accreditCalls = [];
const PROVIDERS = Object.assign({}, await loadProviders({ env: {} }), {
  accredit: {
    name: 'Accreditation check',
    kinds: ['accreditation'],
    env: ['ACCREDIT_API_KEY'],
    createSession: (ctx) => {
      accreditCalls.push(ctx);
      return { status: 'pending', url: '' };
    }
  }
});

const SESSIONS = /\/v3\/session\/$/;
const AML = /\/v3\/aml\/$/;
/**
 * One fetch stand-in for both providers: the payment provider's routes answer their fixtures, the identity check's session
 * and screening routes answer theirs. ctl.session and ctl.aml may be replaced by a test (a status and body, or a promise).
 */
function standIn() {
  let n = 0;
  const ok = (call) => Object.assign({}, fx('charge-succeeded').reply, { id: `pi_fixture_${++n}`, amount: Number(call.body.amount) });
  const ctl = {
    session: () => ({ status: 201, body: idfx('session-created').reply }),
    aml: () => idfx('aml-clear').reply
  };
  const f = mockFetch([
    ['POST', /\/v1\/customers$/, () => fx('customer-created').reply],
    ['POST', /\/v1\/setup_intents$/, () => fx('setup-created').reply],
    ['GET', /\/v1\/setup_intents\/[^/]+$/, () => fx('setup-succeeded').reply],
    ['GET', /\/v1\/payment_methods\/[^/]+$/, () => fx('payment-method').reply],
    ['POST', /\/v1\/payment_methods\/[^/]+\/detach$/, () => Object.assign({}, fx('payment-method').reply, { customer: null })],
    ['POST', /\/v1\/payment_intents$/, (call) => ok(call)],
    ['POST', SESSIONS, (call) => ctl.session(call)],
    ['POST', AML, (call) => ctl.aml(call)]
  ]);
  f.ctl = ctl;
  f.charges = () => f.calls.filter((c) => c.method === 'POST' && /\/payment_intents$/.test(c.url)).length;
  f.sessions = () => f.calls.filter((c) => c.method === 'POST' && SESSIONS.test(c.url)).length;
  f.screens = () => f.calls.filter((c) => c.method === 'POST' && AML.test(c.url)).length;
  f.checks = () => f.sessions() + f.screens();
  return f;
}
/** A provider answer with a vendor word in its detail (as the real refusals carry): it must never reach a reply. */
const providerSays = (status) => ({ status, body: { detail: `${VENDOR} refused: status ${status}` } });

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

function payload(inv = {}, over = {}) {
  return Object.assign(
    {
      sendEmail: true,
      portalUrl: PORTAL,
      notifyEmail: 'ops@harborridge.example',
      firm: { name: FIRM, supportEmail: 'ir@harborridge.example' },
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', exemption: 'Rule 506(b)', currency: 'USD' },
      invitation: Object.assign({ cents: 25000000, note: 'Welcome aboard' }, inv),
      verification: { accreditationRequired: false, connections: [], use: {} }
    },
    over
  );
}
const SUBMISSION = {
  investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', email: 'zelda@investor.example', type: 'individual', onboarding: { status: 'complete' } },
  request: { id: 'req-1', type: 'subscription', offeringId: 'hr-fund-ii', investorId: 'HRC-0007', cents: 25000000, status: 'pending', envelopeId: 'env-1' },
  envelope: { id: 'env-1', status: 'sent', requestId: 'req-1', docId: 'tpl-doc-1', workDocId: 'env-1-work' },
  files: { 'env-1-work': pdf('SIGNEDMARKER').toString('base64') },
  docs: [{ id: 'env-1-work', title: 'Subscription agreement (signed by the investor)' }],
  audit: [],
  notifications: []
};
const INVESTOR = { id: 'HRC-0007', name: 'Zelda Quixote' };

/**
 * A server with every package setting, a stand-in for both providers, an injected clock and an account named alpha with
 * a card saved through the real card routes. opts.env adds settings.
 */
async function shop(opts, fn) {
  const store = openStore(null);
  const f = standIn();
  const clock = { t: T0 };
  const env = Object.assign({}, ENV, opts.env);
  await withServer({ env, fetch: f, store, providers: PROVIDERS, now: () => clock.t }, async (base, server) => {
    const a = await account(base, 'alpha');
    await saveCard(base, a.token);
    const billing = createBilling({ env, store, fetch: f, now: () => clock.t, providers: PROVIDERS });
    const h = {
      base,
      server,
      store,
      f,
      clock,
      a,
      billing,
      /** A package invitation sent by alpha: its id, token and entitlement. */
      async send(clientId, inv = {}, over = {}) {
        const r = await j(base, 'POST', '/v1/invitations', { bearer: a.token, body: payload(Object.assign({ package: true, clientId }, inv), over) });
        assert.equal(r.status, 200, r.text);
        return { id: r.body.id, token: r.body.token, entitlement: store.get('invitations', r.body.id).package.entitlement };
      },
      identity: (token, settings) => j(base, 'POST', '/v1/verifications', { invite: token, body: Object.assign({ kind: 'identity', provider: 'idcheck', investor: INVESTOR }, settings ? { settings } : {}) }),
      accreditation: (token) => j(base, 'POST', '/v1/verifications', { invite: token, body: { kind: 'accreditation', provider: 'accredit', investor: INVESTOR } }),
      screening: (token) => j(base, 'POST', '/v1/screenings', { invite: token, body: { provider: 'idcheck', investor: { id: 'HRC-0007' } } }),
      row: async (id) => (await j(base, 'GET', `/v1/invitations/${id}`, { bearer: a.token })).body.package,
      ent: (id) => store.get('entitlements', id),
      credit: () => (store.get('billing', a.id) || {}).creditCents || 0,
      creditLines: (entitlement) => store.list('ledger').filter((l) => l.type === 'credit' && (entitlement === undefined || l.entitlement === entitlement)).length,
      outbox: () => store.list('outbox').length
    };
    await fn(h);
  });
}

test('tracer: the paid invitation’s investor starts the package’s identity check with only the firm’s name as settings; an unpaid invitation’s investor is refused that provider', async () => {
  await shop({ env: { API_TOKEN: API } }, async (h) => {
    const p = await h.send('c1');
    const r = await h.identity(p.token, { level: 'x', firm: 'Someone Else' });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.url, idfx('session-created').reply.url, 'the investor is sent to the session the provider answered');
    assert.equal(h.f.sessions(), 1, 'exactly one session call');
    const ver = h.store.get('verifications', r.body.id);
    assert.deepEqual(ver.settings, { firm: FIRM }, 'the invitation’s own firm name is the only setting');
    assert.deepEqual(await h.row(p.id), { tier: 'identity', status: 'started' });
    assert.ok(h.ent(p.entitlement).startedAt, 'the package is marked started once the provider accepted the start');

    // The operator's shared token sends an invitation whose snapshot names the package provider itself: no package, no check.
    const shared = await j(h.base, 'POST', '/v1/invitations', {
      bearer: API,
      body: payload({}, { workspace: 'w1', verification: { accreditationRequired: false, connections: [{ id: 'own-id', name: 'ID', type: 'server', connector: 'idcheck', checks: ['identity', 'aml'] }], use: { identity: ['own-id'], aml: ['own-id'] } } })
    });
    assert.equal(shared.status, 200, shared.text);
    const before = h.f.calls.length;
    const refused = await h.identity(shared.body.token);
    assert.equal(refused.status, 403, refused.text);
    assert.deepEqual(refused.body, { error: REFUSED });
    assert.equal(h.f.calls.length, before, 'no provider call');
  });
});
