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

const sha = (t) => createHash('sha256').update(String(t)).digest('hex');
const resend = (h, id) => j(h.base, 'POST', `/v1/invitations/${id}/resend`, { bearer: h.a.token, body: {} });

test('N3 expired then resent: a package returned after its invitation expired cannot be resent or used, even with a fresh link', async () => {
  await shop({}, async (h) => {
    const p = await h.send('e1');
    h.clock.t = Date.parse(h.store.get('invitations', p.id).expiresAt) + 1000;
    h.server.invitations.purge();
    // Billing's own release over the server's store (a no-op once the invitation code has credited it at expiry).
    h.billing.release(p.entitlement);
    assert.equal(h.ent(p.entitlement).status, 'credited');
    const mails = h.outbox();
    const r = await resend(h, p.id);
    assert.equal(r.status, 409, r.text);
    assert.deepEqual(r.body, { error: RETURNED });
    assert.equal(h.outbox(), mails, 'nothing is sent');
    // What a resend would have done: a new token and a new expiry, written directly.
    const token = randomBytes(32).toString('base64url');
    h.store.put('invitations', { id: p.id, tokenHash: sha(token), expiresAt: new Date(h.clock.t + 10 * DAY).toISOString() });
    const calls = h.f.checks();
    const s = await h.identity(token);
    assert.equal(s.status, 403, s.text);
    assert.deepEqual(s.body, { error: REFUSED });
    assert.equal(h.f.checks(), calls, 'no provider call');
  });
});

test('N3 refunded: a refunded, disputed or refunding package starts no check of either kind, and the row reads refunded', async () => {
  await shop({}, async (h) => {
    const p = await h.send('r1');
    for (const status of ['refunded', 'disputed', 'refunding']) {
      h.store.put('entitlements', { id: p.entitlement, status });
      const s = await h.identity(p.token);
      assert.equal(s.status, 403, `${status}: ${s.text}`);
      assert.deepEqual(s.body, { error: REFUSED });
      const sc = await h.screening(p.token);
      assert.equal(sc.status, 403, `${status}: ${sc.text}`);
      assert.deepEqual(sc.body, { error: REFUSED });
      assert.equal(h.f.checks(), 0, `${status}: no provider call`);
      assert.deepEqual(await h.row(p.id), { tier: 'identity', status: 'refunded' });
    }
  });
});

test('N3 credited: a package returned to credit while its invitation is open starts nothing; the new invitation paid from that credit does', async () => {
  await shop({}, async (h) => {
    const p = await h.send('k1');
    assert.equal(h.billing.release(p.entitlement), true);
    assert.equal(h.credit(), 1900);
    const s = await h.identity(p.token);
    assert.equal(s.status, 403, s.text);
    assert.deepEqual(s.body, { error: REFUSED });
    assert.equal(h.f.checks(), 0, 'no provider call');
    // The same client id again: a new package paid from the credit, no charge.
    const q = await h.send('k1');
    assert.equal(h.f.charges(), 1, 'paid from the credit');
    assert.notEqual(q.entitlement, p.entitlement);
    const old = await h.identity(p.token);
    assert.equal(old.status, 403, 'the newest entitlement is not the old invitation’s own');
    assert.deepEqual(old.body, { error: REFUSED });
    assert.equal(h.f.checks(), 0);
    const fresh = await h.identity(q.token);
    assert.equal(fresh.status, 200, fresh.text);
    assert.equal(h.f.sessions(), 1);
  });
});

test('N3 resend: a returned package is never resent; a paid, unstarted one is resent with no payment and its new link starts the check', async () => {
  await shop({}, async (h) => {
    const credited = await h.send('s1');
    h.billing.release(credited.entitlement);
    const refunded = await h.send('s2');
    h.store.put('entitlements', { id: refunded.entitlement, status: 'refunded' });
    const disputed = await h.send('s3');
    h.store.put('entitlements', { id: disputed.entitlement, status: 'disputed' });
    const mails = h.outbox();
    for (const p of [credited, refunded, disputed]) {
      const r = await resend(h, p.id);
      assert.equal(r.status, 409, r.text);
      assert.deepEqual(r.body, { error: RETURNED });
      assert.equal(h.outbox(), mails, 'nothing is sent');
    }
    const paid = await h.send('s4');
    const charges = h.f.charges();
    const before = h.outbox();
    const r = await resend(h, paid.id);
    assert.equal(r.status, 200, r.text);
    assert.equal(h.outbox(), before + 1, 'one new message');
    assert.equal(h.f.charges(), charges, 'no payment call');
    const s = await h.identity(r.body.token);
    assert.equal(s.status, 200, s.text);
    assert.equal(h.f.sessions(), 1);
  });
});

test('N1 account calls: a sponsor account cannot start a package provider directly and does not see them listed', async () => {
  await shop({}, async (h) => {
    const acc = accreditCalls.length;
    const v = await j(h.base, 'POST', '/v1/verifications', { bearer: h.a.token, body: { kind: 'identity', provider: 'idcheck', investor: INVESTOR } });
    assert.equal(v.status, 403, v.text);
    assert.deepEqual(v.body, { error: ACCOUNT_SAYS });
    const s = await j(h.base, 'POST', '/v1/screenings', { bearer: h.a.token, body: { provider: 'idcheck', investor: { id: 'HRC-0007' }, names: ['Zelda Quixote'] } });
    assert.equal(s.status, 403, s.text);
    assert.deepEqual(s.body, { error: ACCOUNT_SAYS });
    const ac = await j(h.base, 'POST', '/v1/verifications', { bearer: h.a.token, body: { kind: 'accreditation', provider: 'accredit', investor: INVESTOR } });
    assert.equal(ac.status, 403, ac.text);
    assert.deepEqual(ac.body, { error: ACCOUNT_SAYS });
    assert.equal(h.f.checks(), 0, 'no provider call');
    assert.equal(accreditCalls.length, acc, 'no accreditation call');
    const list = await j(h.base, 'GET', '/v1/connectors', { bearer: h.a.token });
    assert.equal(list.status, 200, list.text);
    const ids = list.body.connectors.map((c) => c.id);
    for (const want of ['sandbox', 'link', 'ofac']) assert.ok(ids.includes(want), `${want} is listed`);
    assert.ok(!ids.includes('idcheck') && !ids.includes('accredit'), ids.join(','));
  });
});

// Recorded trade-off (N1): the shared API_TOKEN and an open server are the operator's own, so they reach the package
// providers exactly as before this plan. An operator who hands the shared token to a sponsor gives that sponsor the
// providers for free.
test('N1 shared token: the shared token and an open server still start and list the identity check', async () => {
  await shop({ env: { API_TOKEN: API } }, async (h) => {
    const v = await j(h.base, 'POST', '/v1/verifications', { bearer: API, body: { kind: 'identity', provider: 'idcheck', investor: INVESTOR } });
    assert.equal(v.status, 200, v.text);
    assert.equal(h.f.sessions(), 1, 'one session call');
    const s = await j(h.base, 'POST', '/v1/screenings', { bearer: API, body: { provider: 'idcheck', investor: { id: 'HRC-0007' }, names: ['Zelda Quixote'] } });
    assert.equal(s.status, 200, s.text);
    assert.equal(h.f.screens(), 1, 'one screening call');
    const list = await j(h.base, 'GET', '/v1/connectors', { bearer: API });
    assert.ok(list.body.connectors.some((c) => c.id === 'idcheck'), 'listed for the shared token');
  });
  const f = standIn();
  const open = { IDCHECK_API_KEY: ENV.IDCHECK_API_KEY, IDCHECK_WORKFLOW: ENV.IDCHECK_WORKFLOW, IDCHECK_WEBHOOK_SECRET: ENV.IDCHECK_WEBHOOK_SECRET, RATE_LIMIT_PER_MIN: '0' };
  await withServer({ env: open, fetch: f, providers: PROVIDERS }, async (base) => {
    const v = await j(base, 'POST', '/v1/verifications', { body: { kind: 'identity', provider: 'idcheck', investor: INVESTOR } });
    assert.equal(v.status, 200, v.text);
    assert.equal(f.sessions(), 1);
    const s = await j(base, 'POST', '/v1/screenings', { body: { provider: 'idcheck', investor: { id: 'HRC-0007' }, names: ['Zelda Quixote'] } });
    assert.equal(s.status, 200, s.text);
    assert.equal(f.screens(), 1);
    const list = await j(base, 'GET', '/v1/connectors');
    assert.ok(list.body.connectors.some((c) => c.id === 'idcheck'), 'listed on an open server');
  });
});

test('full tier: the full package starts identity, screening and accreditation, the first start marks it; an identity package cannot start accreditation', async () => {
  await shop({}, async (h) => {
    const p = await h.send('f1', {}, { verification: { accreditationRequired: true, connections: [], use: {} } });
    assert.equal((await h.row(p.id)).tier, 'full');
    const acc = accreditCalls.length;
    const i = await h.identity(p.token);
    assert.equal(i.status, 200, i.text);
    const first = h.ent(p.entitlement).startedAt;
    assert.ok(first, 'the first start marks the package');
    h.clock.t += 5 * 60 * 1000;
    const s = await h.screening(p.token);
    assert.equal(s.status, 200, s.text);
    const ac = await h.accreditation(p.token);
    assert.equal(ac.status, 200, ac.text);
    assert.equal(accreditCalls.length, acc + 1, 'one accreditation call');
    assert.deepEqual(h.store.get('verifications', ac.body.id).settings, { firm: FIRM }, 'the firm’s name is the only setting');
    assert.equal(h.ent(p.entitlement).startedAt, first, 'later starts leave it as it was');
    assert.deepEqual(await h.row(p.id), { tier: 'full', status: 'started' });

    const q = await h.send('f2');
    const refused = await h.accreditation(q.token);
    assert.equal(refused.status, 403, refused.text);
    assert.equal(accreditCalls.length, acc + 1, 'no call to the accreditation stand-in');
  });
});
