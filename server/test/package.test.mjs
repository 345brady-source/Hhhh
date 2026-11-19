// The verification package attached when an invitation is created (plan 08-05, D-01): a sponsor account ticks the
// package for an investor, the server works out the tier and its price, the account's card (or credit) pays, and only
// then is the invitation stored, the package tied to it, and the investor's email prepared. A refusal at any step leaves
// nothing behind. The payment provider is a fetch stand-in answering recorded fixtures: no payment account exists and
// none is called.
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
const HOUR = 3600 * 1000;
const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/billing/${name}.json`, import.meta.url), 'utf8'));
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);

/** Every setting a package needs: both payment keys, the identity check's settings, the accreditation stand-in's key. */
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

/**
 * The payment provider's stand-in (as in billing.test.mjs): every route answers its fixture; a test may replace the
 * charge handler (it gets the call and the default answer).
 */
function gateway(over = {}) {
  let n = 0;
  const ok = (call) => Object.assign({}, fx('charge-succeeded').reply, { id: `pi_fixture_${++n}`, amount: Number(call.body.amount) });
  const f = mockFetch([
    ['POST', /\/v1\/customers$/, () => fx('customer-created').reply],
    ['POST', /\/v1\/setup_intents$/, () => fx('setup-created').reply],
    ['GET', /\/v1\/setup_intents\/[^/]+$/, () => fx('setup-succeeded').reply],
    ['GET', /\/v1\/payment_methods\/[^/]+$/, () => fx('payment-method').reply],
    ['POST', /\/v1\/payment_methods\/[^/]+\/detach$/, () => Object.assign({}, fx('payment-method').reply, { customer: null })],
    ['POST', /\/v1\/payment_intents$/, (call) => (over.charge ? over.charge(call, ok) : ok(call))]
  ]);
  f.charges = () => f.calls.filter((c) => c.method === 'POST' && /\/payment_intents$/.test(c.url));
  return f;
}
const refusal = (name) => ({ status: fx(name)._httpStatus, body: fx(name).reply });

/** A store that logs every write and removal in order and knows which blob keys exist. */
function watched() {
  const s = openStore(null);
  const log = [];
  const blobs = new Set();
  const { put, remove, putBlob, removeBlob } = s;
  s.put = (kind, rec) => {
    const out = put(kind, rec);
    log.push({ kind, op: 'put', rec: Object.assign({}, out) });
    return out;
  };
  s.remove = (kind, id) => {
    log.push({ kind, op: 'remove', rec: { id } });
    return remove(kind, id);
  };
  s.putBlob = (key, buf) => {
    putBlob(key, buf);
    blobs.add(key);
  };
  s.removeBlob = (key) => {
    blobs.delete(key);
    return removeBlob(key);
  };
  s.log = log;
  s.blobs = () => [...blobs].sort();
  return s;
}
/** The named tables, the blob keys and the outbox as plain data, to compare before and after a call. */
const tables = (store) => JSON.parse(JSON.stringify({ invitations: store.list('invitations'), entitlements: store.list('entitlements'), ledger: store.list('ledger'), payments: store.list('payments'), billing: store.list('billing'), outbox: store.list('outbox'), blobs: store.blobs() }));

/** One call: bearer is the Authorization token, invite the X-Invite-Token, origin the browser's Origin header. */
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
/** The sponsor's card dialog: ask for a card session, then the hosted page reports it is finished. */
async function saveCard(base, token) {
  const setup = await j(base, 'POST', '/v1/billing/card/setup', { bearer: token, origin: ORIGIN });
  assert.equal(setup.status, 200, setup.text);
  const done = await j(base, 'POST', `${setup.body.url.slice(PUBLIC.length)}/done`);
  assert.equal(done.status, 200, done.text);
}
const buy = (base, token, items) => j(base, 'POST', '/v1/billing/entitlements', { bearer: token, body: { items } });

/** What the console sends: inv goes into body.invitation, over replaces top-level fields. No commitment or value here holds a price or the word "tier". */
function payload(inv = {}, over = {}) {
  return Object.assign(
    {
      sendEmail: true,
      portalUrl: PORTAL,
      notifyEmail: 'ops@harborridge.example',
      firm: { name: 'Harbor Ridge Capital', supportEmail: 'ir@harborridge.example' },
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', exemption: 'Rule 506(b)', currency: 'USD' },
      invitation: Object.assign({ cents: 25000000, note: 'Welcome aboard' }, inv),
      verification: { accreditationRequired: false, connections: [], use: {} }
    },
    over
  );
}
const withDoc = { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', exemption: 'Rule 506(b)', currency: 'USD', documents: [{ id: 'ppm', title: 'Memorandum', fileName: 'ppm.pdf', base64: pdf('PPM').toString('base64') }] };
const invite = (base, token, inv, over) => j(base, 'POST', '/v1/invitations', { bearer: token, body: payload(inv, over) });
const snapshot = (server, rec) => server.invitations.vault.open(rec.snapshot, `${rec.id}:snapshot`);
const entitlementsOf = (store, a, key) => store.list('entitlements').filter((e) => e.account === a.id && (key === undefined || e.key === key));

/**
 * A server on the store given (a watched one by default) and an account named alpha with a card saved through the real
 * card routes (unless card is false). charge replaces the stand-in's charge handler: (call, ok, store).
 */
async function shop(opts, fn) {
  const store = opts.store || watched();
  const gw = gateway({ charge: opts.charge && ((call, ok) => opts.charge(call, ok, store)) });
  const clock = { t: T0 };
  await withServer({ env: Object.assign({}, ENV, opts.env), fetch: gw, store, providers: PROVIDERS, now: () => clock.t }, async (base, server) => {
    const a = await account(base, 'alpha');
    if (opts.card !== false) await saveCard(base, a.token);
    await fn({ base, server, store, gw, clock, a });
  });
}

test('tracer: a sponsor account’s package invitation is paid before it is stored and emailed, and its row shows the paid package', async () => {
  const seen = [];
  const charge = (call, ok, store) => {
    seen.push({ invitations: store.list('invitations').length, outbox: store.list('outbox').length });
    return ok(call);
  };
  await shop({ charge }, async ({ base, server, store, gw, a }) => {
    const r = await invite(base, a.token, { package: true, clientId: 'c1' });
    assert.equal(r.status, 200, r.text);
    // One charge at the server's price for the identity tier, made while nothing was stored and no email prepared.
    assert.equal(gw.charges().length, 1);
    assert.equal(gw.charges()[0].body.amount, '1900');
    assert.deepEqual(seen, [{ invitations: 0, outbox: 0 }]);
    assert.equal(store.list('outbox').length, 1, 'then exactly one email');

    const rec = store.get('invitations', r.body.id);
    const ents = entitlementsOf(store, a, 'c1');
    assert.equal(ents.length, 1);
    assert.deepEqual(rec.package, { entitlement: ents[ents.length - 1].id, tier: 'identity', account: a.id, key: 'c1' });

    const rows = await j(base, 'GET', '/v1/invitations', { bearer: a.token });
    assert.equal(rows.status, 200, rows.text);
    assert.deepEqual(rows.body.find((x) => x.id === rec.id).package, { tier: 'identity', status: 'paid' });

    const snap = snapshot(server, rec);
    assert.deepEqual(snap.verification.use.identity, ['package-id']);
    assert.deepEqual(snap.verification.use.aml, ['package-id']);
    assert.deepEqual(
      snap.verification.connections.find((c) => c.id === 'package-id'),
      { id: 'package-id', name: 'Identity check', type: 'server', connector: 'idcheck', checks: ['identity', 'aml'], package: true }
    );
    assert.ok(!('package' in snap.invitation) && !('clientId' in snap.invitation), 'neither value is written into the snapshot’s invitation');
  });
});
