// Charging the sponsor's card (plan 08-04): a card on file entered on this server's hosted card page, packages paid at
// the server's own price, credit first, one charge for a list, a durable record before every charge, no double charge,
// nothing recorded when a charge is refused, unused packages returned as credit. Every reply from the payment provider
// is a recorded fixture answered by a fetch stand-in: no payment account exists and none is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withServer, mockFetch } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { createBilling } from '../lib/billing.mjs';

const ADMIN = 'operator-admin-token-0123456789';
const SECRET = 'sk_test_fixtureSecretKey0123456789';
const PUBKEY = 'pk_test_fixturePublishableKey01';
const PUBLIC = 'https://verify.example';
const PORTAL = 'https://portal.example';
const API = 'shared-api-token-0123456789';
const T0 = Date.parse('2026-11-19T12:00:00Z');
const HOUR = 3600 * 1000;
const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/billing/${name}.json`, import.meta.url), 'utf8'));
const CARD = { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 };
/** The payment vendor's name, taken from a fixture's source line so that it is written nowhere in this file. */
const VENDOR = new URL(fx('customer-created')._source).hostname.split('.').slice(-2)[0];
const UNAVAILABLE = { error: 'Card payments are not available right now. Nothing was charged.', code: 'billing_unavailable' };
const UNCONFIRMED = { error: 'The payment could not be confirmed. Try again in a few minutes.', code: 'billing_unavailable' };
const DECLINED = { error: 'The card was declined. Nothing was charged.', code: 'card_declined' };

/**
 * The payment provider's stand-in: every route answers its fixture unless a test replaces it. A handler that throws
 * stands for a call whose outcome is unknown (a timeout or a dropped connection).
 */
function gateway(over = {}) {
  let n = 0;
  const ok = (call) => Object.assign({}, fx('charge-succeeded').reply, { id: `pi_fixture_${++n}`, amount: Number(call.body.amount) });
  const f = mockFetch([
    ['POST', /\/v1\/customers$/, over.customer || (() => fx('customer-created').reply)],
    ['POST', /\/v1\/setup_intents$/, over.setup || (() => fx('setup-created').reply)],
    ['GET', /\/v1\/setup_intents\/[^/]+$/, over.setupRead || (() => fx('setup-succeeded').reply)],
    ['GET', /\/v1\/payment_methods\/[^/]+$/, over.method || (() => fx('payment-method').reply)],
    ['POST', /\/v1\/payment_methods\/[^/]+\/detach$/, over.detach || (() => Object.assign({}, fx('payment-method').reply, { customer: null }))],
    ['POST', /\/v1\/payment_intents$/, over.charge ? (call) => over.charge(call, ok) : ok]
  ]);
  f.charges = () => f.calls.filter((c) => c.method === 'POST' && /\/payment_intents$/.test(c.url));
  f.paths = (from = 0) => f.calls.slice(from).map((c) => `${c.method} ${new URL(c.url).pathname}`);
  return f;
}
/** A recorded refusal (its HTTP status and body). */
const refusal = (name) => ({ status: fx(name)._httpStatus, body: fx(name).reply });
/** A second card for the tests that replace one: the setup read back names it, and its own brand and digits follow. */
const secondCard = (on) => ({
  setupRead: () => Object.assign({}, fx('setup-succeeded').reply, on() ? { payment_method: 'pm_fixture2' } : {}),
  method: (call) => (/pm_fixture2$/.test(call.url) ? { id: 'pm_fixture2', object: 'payment_method', type: 'card', customer: 'cus_fixture1', card: { brand: 'mastercard', last4: '1881', exp_month: 3, exp_year: 2031 } } : fx('payment-method').reply)
});
/** This module's own functions on a server's store (what plan 08-05 calls from the invitation code). */
const tools = (store, { now, env, providers, fetch: fetchImpl } = {}) =>
  createBilling({ env: Object.assign({ BILLING_SECRET_KEY: SECRET, BILLING_PUBLISHABLE_KEY: PUBKEY }, env), store, fetch: fetchImpl || gateway(), now: now || (() => T0), providers: providers || {}, publicUrl: PUBLIC, origins: [PORTAL] });
const ids = (n, tier = 'identity', prefix = 'k') => Array.from({ length: n }, (_, i) => ({ key: `${prefix}${i + 1}`, tier }));

/** A server with ADMIN_TOKEN, both payment keys, one portal origin and no rate limit (a test sets its own when it needs one). */
const start = ({ env, fetch: fetchImpl, now, store, providers } = {}, fn) =>
  withServer({ env: Object.assign({ ADMIN_TOKEN: ADMIN, PUBLIC_URL: PUBLIC, PORTAL_ORIGIN: PORTAL, BILLING_SECRET_KEY: SECRET, BILLING_PUBLISHABLE_KEY: PUBKEY, RATE_LIMIT_PER_MIN: '0' }, env), fetch: fetchImpl, now, store, providers }, fn);

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
  return { status: res.status, body: parsed, text, headers: res.headers };
}
const account = async (base, workspace) => (await j(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace, name: workspace } })).body;
/** The sponsor's card dialog: ask for a card session, then the hosted page reports it is finished. */
async function saveCard(base, token, origin = PORTAL) {
  const setup = await j(base, 'POST', '/v1/billing/card/setup', { bearer: token, origin });
  assert.equal(setup.status, 200, setup.text);
  const path = setup.body.url.slice(PUBLIC.length);
  const done = await j(base, 'POST', `${path}/done`);
  assert.equal(done.status, 200, done.text);
  return { path, card: done.body.card };
}
const buy = (base, token, items) => j(base, 'POST', '/v1/billing/entitlements', { bearer: token, body: { items } });
const idem = (call) => call.headers['Idempotency-Key'];
/** Every string anywhere inside a value. */
function strings(x, out = []) {
  if (typeof x === 'string') out.push(x);
  else if (x && typeof x === 'object') for (const v of Object.values(x)) strings(v, out);
  return out;
}

test('tracer: a sponsor saves a card through the hosted card page and pays for one package; GET /v1/billing shows the card and the charge', async () => {
  const gw = gateway();
  const store = openStore(null);
  await start({ fetch: gw, store, now: () => T0 }, async (base) => {
    const a = await account(base, 'alpha');

    const setup = await j(base, 'POST', '/v1/billing/card/setup', { bearer: a.token, origin: PORTAL });
    assert.equal(setup.status, 200, setup.text);
    assert.deepEqual(Object.keys(setup.body), ['url']);
    assert.match(setup.body.url, /^https:\/\/verify\.example\/billing\/card\/[\w-]{20,}$/);
    const path = setup.body.url.slice(PUBLIC.length);
    // The provider was asked for a customer, then for a card setup for later charges: form-encoded, the secret key only
    // in the Authorization header, redirects not followed.
    assert.deepEqual(gw.calls.map((c) => `${c.method} ${new URL(c.url).pathname}`), ['POST /v1/customers', 'POST /v1/setup_intents']);
    for (const c of gw.calls) {
      assert.equal(c.headers.Authorization, `Bearer ${SECRET}`);
      assert.equal(c.redirect, 'manual');
      assert.match(c.headers['Content-Type'], /urlencoded/);
      assert.ok(!JSON.stringify(c.body).includes(SECRET) && !c.url.includes(SECRET));
    }
    assert.equal(gw.calls[1].body.customer, 'cus_fixture1');
    assert.equal(gw.calls[1].body.usage, 'off_session');

    const page = await fetch(base + path);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const html = await page.text();
    assert.ok(html.includes(PUBKEY) && html.includes(fx('setup-created').reply.client_secret), 'the page holds the publishable key and this setup’s secret');
    assert.ok(!html.includes(SECRET), 'never the secret key');

    // The page's word is not trusted: the server reads the setup back by id with the secret key, then the card's brand,
    // last four digits and expiry.
    const done = await j(base, 'POST', `${path}/done`);
    assert.equal(done.status, 200, done.text);
    assert.deepEqual(done.body, { ok: true, card: CARD });
    assert.deepEqual(gw.calls.slice(2).map((c) => `${c.method} ${new URL(c.url).pathname}`), ['GET /v1/setup_intents/seti_fixture1', 'GET /v1/payment_methods/pm_fixture1']);

    const paid = await buy(base, a.token, [{ key: 'k1', tier: 'identity' }]);
    assert.equal(paid.status, 200, paid.text);
    assert.deepEqual(paid.body, { paid: ['k1'], chargedCents: 1900, creditUsedCents: 0 });
    const charges = gw.charges();
    assert.equal(charges.length, 1, 'exactly one charge call');
    const c = charges[0];
    assert.equal(c.body.amount, '1900', 'the amount is the server’s price for the tier');
    assert.equal(c.body.currency, 'usd');
    assert.equal(c.body.customer, 'cus_fixture1');
    assert.equal(c.body.payment_method, 'pm_fixture1');
    assert.equal(c.body.off_session, 'true');
    assert.equal(c.body.confirm, 'true');
    assert.match(idem(c), /^[0-9a-f]{64}$/, 'an idempotency key header was sent');
    assert.equal(c.headers.Authorization, `Bearer ${SECRET}`);
    assert.equal(c.redirect, 'manual');

    const view = await j(base, 'GET', '/v1/billing', { bearer: a.token });
    assert.equal(view.status, 200, view.text);
    assert.deepEqual(Object.keys(view.body), ['ready', 'available', 'card', 'currency', 'prices', 'creditCents', 'charges', 'unresolved']);
    assert.equal(view.body.ready, true);
    assert.deepEqual(Object.keys(view.body.available), ['identity', 'full', 'reverify']);
    assert.deepEqual(view.body.card, CARD);
    assert.equal(view.body.currency, 'usd');
    assert.deepEqual(view.body.prices, { identity: 1900, full: 9900, reverify: 9900 });
    assert.equal(view.body.creditCents, 0);
    assert.deepEqual(view.body.charges, [{ at: new Date(T0).toISOString(), type: 'package', by: 'card', cents: 1900, tier: 'identity', invitationId: null }]);

    // What is kept about the card: brand, last four digits, expiry, and the provider's ids for the customer and the card.
    const rec = store.get('billing', a.id);
    assert.deepEqual(Object.keys(rec).sort(), ['card', 'creditCents', 'customer', 'id', 'updatedAt']);
    assert.deepEqual(rec.card, Object.assign({}, CARD, { method: 'pm_fixture1' }));
    assert.equal(rec.customer, 'cus_fixture1');
    const data = store.data();
    // The longest run of digits a field may hold is an amount in cents (seven digits for 200 full packages).
    for (const s of strings([data.billing, data.entitlements, data.ledger, data.payments])) assert.ok(!/^\d{8,}$/.test(s), `no stored field is a long run of digits: ${s}`);
    const all = JSON.stringify(data);
    assert.ok(!all.includes(SECRET) && !all.includes(fx('setup-created').reply.client_secret), 'neither the secret key nor the setup’s secret is stored');
  });
});

/** A server, one account with a saved card, and the store behind it. */
async function shop({ gw = gateway(), env, now = () => T0, store = openStore(null), providers } = {}, fn) {
  await start({ fetch: gw, store, env, now, providers }, async (base) => {
    const a = await account(base, 'alpha');
    await saveCard(base, a.token);
    await fn({ base, a, gw, store, b: tools(store, { now }) });
  });
}
const credit = (store, a) => (store.get('billing', a.id) || {}).creditCents || 0;
const mine = (store, table, a) => store.list(table).filter((x) => x.account === a.id);

test('server price: a figure in the request is ignored; an unknown tier, a bad key, an empty or an over-long list answer 400 and charge nothing', async () => {
  await shop({}, async ({ base, a, gw, store }) => {
    const r = await buy(base, a.token, [{ key: 'k1', tier: 'full', cents: 1, amount: 1, price: 1 }]);
    assert.deepEqual(r.body, { paid: ['k1'], chargedCents: 9900, creditUsedCents: 0 });
    assert.equal(gw.charges()[0].body.amount, '9900');
    assert.equal(store.list('entitlements')[0].cents, 9900);
    const lists = [[{ key: 'k2', tier: 'gold' }], [{ key: 'bad key', tier: 'full' }], [{ key: '', tier: 'full' }], [{ key: 'x'.repeat(81), tier: 'full' }], [{ tier: 'full' }], [null], [], 'k2', [{ key: 'k2', tier: 'full' }, { key: 'k2', tier: 'identity' }], ids(201)];
    for (const items of lists) {
      const bad = await buy(base, a.token, items);
      assert.equal(bad.status, 400, JSON.stringify(items).slice(0, 60));
      assert.ok(bad.body.error);
    }
    assert.equal(gw.charges().length, 1);
    assert.equal(store.list('entitlements').length, 1);
    assert.equal(store.list('payments').length, 1);
  });
  // The prices are the server's settings; the re-check price is the full price unless it has its own.
  await shop({ env: { PACKAGE_PRICE_IDENTITY_CENTS: '2500', PACKAGE_PRICE_FULL_CENTS: '12000' } }, async ({ base, a, gw }) => {
    assert.deepEqual((await j(base, 'GET', '/v1/billing', { bearer: a.token })).body.prices, { identity: 2500, full: 12000, reverify: 12000 });
    assert.deepEqual((await buy(base, a.token, [{ key: 'k1', tier: 'identity' }, { key: 'k2', tier: 'reverify' }])).body, { paid: ['k1', 'k2'], chargedCents: 14500, creditUsedCents: 0 });
    assert.equal(gw.charges()[0].body.amount, '14500');
  });
  await shop({ env: { PACKAGE_PRICE_REVERIFY_CENTS: '4900' } }, async ({ base, a }) => {
    assert.deepEqual((await j(base, 'GET', '/v1/billing', { bearer: a.token })).body.prices, { identity: 1900, full: 9900, reverify: 4900 });
  });
});

test('list: forty packages are one charge of 76000 with one entitlement and one ledger line each', async () => {
  await shop({}, async ({ base, a, gw, store }) => {
    const r = await buy(base, a.token, ids(40));
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.chargedCents, 76000);
    assert.equal(r.body.paid.length, 40);
    assert.equal(gw.charges().length, 1);
    assert.equal(gw.charges()[0].body.amount, '76000');
    const lines = store.list('ledger');
    assert.equal(lines.length, 40);
    assert.ok(lines.every((l) => l.type === 'package' && l.by === 'card' && l.cents === 1900 && l.tier === 'identity' && l.chargeRef === 'pi_fixture_1' && l.account === a.id));
    assert.equal(new Set(lines.map((l) => l.entitlement)).size, 40);
    assert.equal(store.list('entitlements').length, 40);
    assert.equal((await j(base, 'GET', '/v1/billing', { bearer: a.token })).body.charges.length, 40);
  });
});

test('credit first: whole packages are paid from credit, the rest is one charge; credit is never split across part of a package', async () => {
  await shop({}, async ({ base, a, gw, store, b }) => {
    store.put('billing', { id: a.id, creditCents: 9900 });
    const r = await buy(base, a.token, [{ key: 'k1', tier: 'full' }, { key: 'k2', tier: 'full' }]);
    assert.deepEqual(r.body, { paid: ['k1', 'k2'], chargedCents: 9900, creditUsedCents: 9900 });
    assert.equal(gw.charges().length, 1);
    assert.equal(gw.charges()[0].body.amount, '9900');
    assert.equal(b.find(a, 'k1').by, 'credit');
    assert.equal(b.find(a, 'k2').by, 'card');
    assert.equal(credit(store, a), 0);
    assert.deepEqual(store.list('ledger').map((l) => [l.type, l.by, l.cents]), [['package', 'credit', 9900], ['package', 'card', 9900]]);

    // 5000 of credit does not pay half of a 9900 package: the card pays all of it and the credit stays.
    store.put('billing', { id: a.id, creditCents: 5000 });
    assert.deepEqual((await buy(base, a.token, [{ key: 'k3', tier: 'full' }])).body, { paid: ['k3'], chargedCents: 9900, creditUsedCents: 0 });
    assert.equal(credit(store, a), 5000);
    // …and it does pay a whole smaller one further down the list.
    assert.deepEqual((await buy(base, a.token, [{ key: 'k4', tier: 'full' }, { key: 'k5', tier: 'identity' }])).body, { paid: ['k4', 'k5'], chargedCents: 9900, creditUsedCents: 1900 });
    assert.equal(credit(store, a), 3100);

    // Credit alone needs no card and makes no call to the provider.
    const c = await account(base, 'gamma');
    store.put('billing', { id: c.id, customer: '', card: null, creditCents: 1900 });
    const before = gw.calls.length;
    assert.deepEqual((await buy(base, c.token, [{ key: 'k1', tier: 'identity' }])).body, { paid: ['k1'], chargedCents: 0, creditUsedCents: 1900 });
    assert.equal(gw.calls.length, before);
    assert.equal(credit(store, c), 0);
  });
});

test('idempotent: the same key sent again charges nothing; two calls for one key at the same moment make one charge', async () => {
  const gw = gateway({ charge: async (call, ok) => (await new Promise((r) => setTimeout(r, 40)), ok(call)) });
  await shop({ gw }, async ({ base, a, store }) => {
    assert.deepEqual((await buy(base, a.token, ids(1))).body, { paid: ['k1'], chargedCents: 1900, creditUsedCents: 0 });
    const again = await buy(base, a.token, ids(1));
    assert.equal(again.status, 200);
    assert.deepEqual(again.body, { paid: ['k1'], chargedCents: 0, creditUsedCents: 0 });
    assert.equal(gw.charges().length, 1);

    const [x, y] = await Promise.all([buy(base, a.token, [{ key: 'k2', tier: 'full' }]), buy(base, a.token, [{ key: 'k2', tier: 'full' }])]);
    assert.equal(x.status, 200, x.text);
    assert.equal(y.status, 200, y.text);
    assert.deepEqual([x.body.chargedCents, y.body.chargedCents].sort(), [0, 9900]);
    assert.equal(gw.charges().length, 2, 'one charge for the double click');
    assert.equal(store.list('entitlements').length, 2);
    assert.equal(store.list('ledger').length, 2);
  });
});

test('declined: a declined card, a bank asking for confirmation and no card answer 402 with a plain sentence and record no package', async () => {
  let name = 'error-card-declined';
  const gw = gateway({ charge: () => refusal(name) });
  await shop({ gw }, async ({ base, a, store }) => {
    store.put('billing', { id: a.id, creditCents: 1900 });
    const items = [{ key: 'k1', tier: 'identity' }, { key: 'k2', tier: 'full' }];
    const r = await buy(base, a.token, items);
    assert.equal(r.status, 402);
    assert.deepEqual(r.body, DECLINED);
    assert.equal(gw.charges().length, 1);
    assert.equal(gw.charges()[0].body.amount, '9900', 'only the package the credit did not cover went to the card');
    assert.deepEqual(store.list('entitlements'), []);
    assert.deepEqual(store.list('ledger'), []);
    assert.equal(credit(store, a), 1900, 'the credit is untouched');

    name = 'error-authentication-required';
    const r2 = await buy(base, a.token, items);
    assert.equal(r2.status, 402);
    assert.deepEqual(r2.body, { error: "The card's bank asks for confirmation. Replace the card on the Integrations page, then try again.", code: 'authentication_required' });
    assert.deepEqual(store.list('entitlements'), []);
    assert.deepEqual(store.list('ledger'), []);
    assert.equal(credit(store, a), 1900);
    assert.deepEqual(store.list('payments').map((p) => p.status), ['failed', 'failed']);

    const c = await account(base, 'gamma');
    const before = gw.calls.length;
    const r3 = await buy(base, c.token, ids(1));
    assert.equal(r3.status, 402);
    assert.deepEqual(r3.body, { error: 'Add a card on the Integrations page first.', code: 'no_card' });
    assert.equal(gw.calls.length, before, 'no call to the provider without a card');
    assert.deepEqual(mine(store, 'payments', c), []);
  });
});

test('unavailable: without the secret key nothing is offered; a provider outage answers 409 and records no package', async () => {
  const off = gateway();
  await start({ fetch: off, env: { BILLING_SECRET_KEY: '' } }, async (base) => {
    const a = await account(base, 'alpha');
    const v = await j(base, 'GET', '/v1/billing', { bearer: a.token });
    assert.equal(v.status, 200);
    assert.equal(v.body.ready, false);
    assert.deepEqual(v.body.available, { identity: false, full: false, reverify: false });
    for (const [path, body] of [['/v1/billing/card/setup', undefined], ['/v1/billing/entitlements', { items: ids(1) }]]) {
      const r = await j(base, 'POST', path, { bearer: a.token, body, origin: PORTAL });
      assert.equal(r.status, 409, path);
      assert.deepEqual(r.body, UNAVAILABLE);
    }
    assert.equal(off.calls.length, 0);
  });
  const gw = gateway({ charge: () => ({ status: 503, body: { error: { message: 'Service unavailable' } } }) });
  await shop({ gw }, async ({ base, a, store }) => {
    const r = await buy(base, a.token, ids(2));
    assert.equal(r.status, 409);
    assert.deepEqual(r.body, UNCONFIRMED, 'an outage is not known to have charged nothing, so the sentence does not say so');
    assert.deepEqual(store.list('entitlements'), []);
    assert.deepEqual(store.list('ledger'), []);
    assert.equal(credit(store, a), 0);
  });
  // The provider refusing this server's own request (a wrong key, say) charged nothing: the attempt is closed.
  const refused = gateway({ charge: () => ({ status: 401, body: { error: { message: 'Invalid key' } } }), customer: () => ({ status: 500, body: {} }) });
  await start({ fetch: refused }, async (base) => {
    const a = await account(base, 'alpha');
    const s = await j(base, 'POST', '/v1/billing/card/setup', { bearer: a.token, origin: PORTAL });
    assert.equal(s.status, 409);
    assert.deepEqual(s.body, UNAVAILABLE);
  });
  await shop({ gw: gateway({ charge: () => ({ status: 401, body: { error: { message: 'Invalid key' } } }) }) }, async ({ base, a, store }) => {
    const r = await buy(base, a.token, ids(1));
    assert.equal(r.status, 409);
    assert.deepEqual(r.body, UNAVAILABLE);
    assert.deepEqual(store.list('payments').map((p) => p.status), ['failed']);
    assert.deepEqual(store.list('entitlements'), []);
  });
});

test('prices: a price that is not a whole number of cents of at least 50 switches card payments off', async () => {
  for (const bad of ['49', '99.5', 'abc', '-100', '0', '1e4']) {
    for (const name of ['PACKAGE_PRICE_FULL_CENTS', 'PACKAGE_PRICE_IDENTITY_CENTS', 'PACKAGE_PRICE_REVERIFY_CENTS']) assert.equal(tools(openStore(null), { env: { [name]: bad } }).ready(), false, `${name}=${bad}`);
  }
  assert.equal(tools(openStore(null), { env: { PACKAGE_PRICE_FULL_CENTS: '50' } }).ready(), true);
  assert.equal(tools(openStore(null)).ready(), true);
  const gw = gateway();
  const store = openStore(null);
  await start({ fetch: gw, store, env: { PACKAGE_PRICE_FULL_CENTS: '99.5' } }, async (base) => {
    const a = await account(base, 'alpha');
    store.put('billing', { id: a.id, customer: 'cus_fixture1', card: Object.assign({ method: 'pm_fixture1' }, CARD), creditCents: 9900 });
    assert.equal((await j(base, 'GET', '/v1/billing', { bearer: a.token })).body.ready, false);
    for (const [path, body] of [['/v1/billing/card/setup', undefined], ['/v1/billing/entitlements', { items: ids(1) }]]) {
      const r = await j(base, 'POST', path, { bearer: a.token, body, origin: PORTAL });
      assert.equal(r.status, 409, path);
      assert.deepEqual(r.body, UNAVAILABLE);
    }
    assert.equal(gw.calls.length, 0);
    assert.deepEqual(store.list('entitlements'), []);
    assert.equal(credit(store, a), 9900);
  });
});

test('M1 a: a timeout, then the same list: two provider calls with one key and one set of packages', async () => {
  let down = true;
  const gw = gateway({ charge: (call, ok) => { if (down) throw new Error('socket hang up'); return ok(call); } });
  await shop({ gw }, async ({ base, a, store }) => {
    const r1 = await buy(base, a.token, ids(2));
    assert.equal(r1.status, 409);
    assert.deepEqual(r1.body, UNCONFIRMED);
    assert.deepEqual(store.list('entitlements'), []);
    assert.deepEqual(store.list('payments').map((p) => p.status), ['pending']);

    down = false;
    const r2 = await buy(base, a.token, ids(2));
    assert.equal(r2.status, 200, r2.text);
    assert.deepEqual(r2.body, { paid: ['k1', 'k2'], chargedCents: 3800, creditUsedCents: 0 });
    const [c1, c2] = gw.charges();
    assert.equal(gw.charges().length, 2);
    assert.equal(idem(c2), idem(c1), 'the repeat carries the first call’s key');
    assert.deepEqual(c2.body, c1.body, 'and exactly its form');
    assert.deepEqual(store.list('entitlements').map((e) => [e.key, e.status, e.by, e.cents]), [['k1', 'paid', 'card', 1900], ['k2', 'paid', 'card', 1900]]);
    assert.equal(store.list('ledger').length, 2);
    assert.deepEqual(store.list('payments').map((p) => [p.status, p.chargeRef]), [['succeeded', 'pi_fixture_1']]);

    assert.deepEqual((await buy(base, a.token, ids(2))).body, { paid: ['k1', 'k2'], chargedCents: 0, creditUsedCents: 0 });
    assert.equal(gw.charges().length, 2);
  });
});

test('M1 b: a timeout, then a longer list: the stored call is repeated first, then one charge for the added keys only', async () => {
  let down = true;
  const gw = gateway({ charge: (call, ok) => { if (down) throw new Error('timed out'); return ok(call); } });
  await shop({ gw }, async ({ base, a, store }) => {
    assert.equal((await buy(base, a.token, ids(1))).status, 409);
    down = false;
    const r = await buy(base, a.token, ids(3));
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { paid: ['k1', 'k2', 'k3'], chargedCents: 5700, creditUsedCents: 0 });
    const [c1, c2, c3] = gw.charges();
    assert.equal(gw.charges().length, 3);
    assert.equal(idem(c2), idem(c1));
    assert.deepEqual(c2.body, c1.body);
    assert.equal(c2.body.amount, '1900');
    assert.notEqual(idem(c3), idem(c1));
    assert.equal(c3.body.amount, '3800', 'the added keys only');
    assert.deepEqual(store.list('payments').map((p) => [p.status, p.items.map((i) => i.key).join()]), [['succeeded', 'k1'], ['succeeded', 'k2,k3']]);
    assert.deepEqual(store.list('entitlements').map((e) => [e.key, e.chargeRef]), [['k1', 'pi_fixture_1'], ['k2', 'pi_fixture_2'], ['k3', 'pi_fixture_2']]);
    assert.equal(store.list('ledger').length, 3);
  });
});

test('M1 c: declined, the card replaced, a retry: a different key, and the charge is recorded', async () => {
  let declined = true;
  let down = false;
  let second = false;
  const gw = gateway(Object.assign({ charge: (call, ok) => { if (down) throw new Error('timed out'); return declined ? refusal('error-card-declined') : ok(call); } }, secondCard(() => second)));
  await shop({ gw }, async ({ base, a, store }) => {
    assert.deepEqual((await buy(base, a.token, ids(1))).body, DECLINED);
    assert.deepEqual((await buy(base, a.token, ids(1))).body, DECLINED);
    const [c1, c2] = gw.charges();
    assert.notEqual(idem(c2), idem(c1), 'a refused attempt is closed: the next try is a new payment, not a replay of the refusal');
    assert.deepEqual(store.list('payments').map((p) => [p.status, p.attempt]), [['failed', 0], ['failed', 1]]);

    second = true;
    assert.deepEqual((await saveCard(base, a.token)).card, { brand: 'mastercard', last4: '1881', expMonth: 3, expYear: 2031 });
    declined = false;
    const r = await buy(base, a.token, ids(1));
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { paid: ['k1'], chargedCents: 1900, creditUsedCents: 0 });
    const c3 = gw.charges()[2];
    assert.ok(![idem(c1), idem(c2)].includes(idem(c3)));
    assert.equal(c3.body.payment_method, 'pm_fixture2');
    const e = store.list('entitlements');
    assert.deepEqual(e.map((x) => [x.key, x.status, x.chargeRef]), [['k1', 'paid', 'pi_fixture_1']]);
    assert.deepEqual(store.list('ledger').map((l) => [l.type, l.by, l.cents, l.chargeRef, l.entitlement]), [['package', 'card', 1900, 'pi_fixture_1', e[0].id]]);
    assert.deepEqual(store.list('payments').map((p) => p.status), ['failed', 'failed', 'succeeded']);

    // A call whose outcome was not known, and which the provider refuses when it is repeated, is closed the same way:
    // the repeat carries the old key, the payment worked out after it a new one, and nothing is recorded for either.
    down = true;
    assert.deepEqual((await buy(base, a.token, [{ key: 'k9', tier: 'full' }])).body, UNCONFIRMED);
    down = false;
    declined = true;
    assert.deepEqual((await buy(base, a.token, [{ key: 'k9', tier: 'full' }])).body, DECLINED);
    const [c4, c5, c6] = gw.charges().slice(3);
    assert.equal(gw.charges().length, 6);
    assert.equal(idem(c5), idem(c4), 'the repeat of the unknown call');
    assert.notEqual(idem(c6), idem(c4), 'then a new payment');
    assert.deepEqual(store.list('payments').slice(3).map((p) => [p.status, p.attempt]), [['failed', 0], ['failed', 1]]);
    assert.equal(store.list('entitlements').length, 1);
    declined = false;
    assert.deepEqual((await buy(base, a.token, [{ key: 'k9', tier: 'full' }])).body, { paid: ['k9'], chargedCents: 9900, creditUsedCents: 0 });
    assert.equal(gw.charges().length, 7);
    assert.ok(![idem(c4), idem(c6)].includes(idem(gw.charges()[6])));
  });
});

test('M1 d: a package released and then paid for again comes from the credit, with no provider call', async () => {
  await shop({}, async ({ base, a, gw, store, b }) => {
    await buy(base, a.token, ids(1));
    const first = b.find(a, 'k1');
    assert.equal(b.release(first.id), true);
    assert.equal(credit(store, a), 1900);
    const before = gw.calls.length;
    const r = await buy(base, a.token, ids(1));
    assert.deepEqual(r.body, { paid: ['k1'], chargedCents: 0, creditUsedCents: 1900 });
    assert.equal(gw.calls.length, before, 'no provider call');
    assert.equal(credit(store, a), 0, 'the credit is back to 0');
    const newest = b.find(a, 'k1');
    assert.notEqual(newest.id, first.id);
    assert.deepEqual([newest.status, newest.by, newest.cents], ['paid', 'credit', 1900]);
    assert.equal(store.get('entitlements', first.id).status, 'credited');
    assert.equal(b.find(a.id, 'k1').id, newest.id, 'find takes the account or its id');
    assert.equal(b.find(a, 'nothing'), null);
  });
});

test('M1 e: the payment is in the store file, pending, before the provider is called', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'billing-')), 'store.json');
  const disk = () => JSON.parse(readFileSync(file, 'utf8'));
  let seen = null;
  const gw = gateway({ charge: (call, ok) => ((seen = { data: disk(), key: idem(call), form: call.body }), ok(call)) });
  await shop({ gw, store: openStore(file) }, async ({ base, a }) => {
    const r = await buy(base, a.token, [{ key: 'k1', tier: 'identity' }, { key: 'k2', tier: 'full' }]);
    assert.equal(r.status, 200, r.text);
    const pending = Object.values(seen.data.payments);
    assert.equal(pending.length, 1);
    const p = pending[0];
    assert.match(p.id, /^pay_/);
    assert.equal(p.status, 'pending');
    assert.equal(p.account, a.id);
    assert.deepEqual(p.items, [{ key: 'k1', tier: 'identity', cents: 1900 }, { key: 'k2', tier: 'full', cents: 9900 }]);
    assert.equal(p.cardCents, 11800);
    assert.equal(p.method, 'pm_fixture1');
    assert.equal(p.attempt, 0);
    assert.equal(p.idempotencyKey, seen.key, 'the key that was sent is the key on file');
    assert.deepEqual(p.form, seen.form, 'and so is the form');
    assert.equal(p.chargeRef, '');
    assert.equal(p.at, new Date(T0).toISOString());
    assert.deepEqual(Object.values(seen.data.entitlements), [], 'no package is recorded before the charge is known');
    // Once the charge is known the file holds the outcome, without waiting for the store's timer.
    const after = disk();
    assert.deepEqual(Object.values(after.payments).map((x) => [x.status, x.chargeRef]), [['succeeded', 'pi_fixture_1']]);
    assert.equal(Object.values(after.entitlements).length, 2);
    assert.equal(Object.values(after.ledger).length, 2);
  });
});

test('M1: a pending payment is repeated while it is younger than 23 hours; older, it is marked unresolved and never repeated', async () => {
  const clock = { t: T0 };
  let down = true;
  const gw = gateway({ charge: (call, ok) => { if (down) throw new Error('timed out'); return ok(call); } });
  await shop({ gw, now: () => clock.t }, async ({ base, a, store }) => {
    assert.equal((await buy(base, a.token, ids(1))).status, 409);
    clock.t = T0 + 23 * HOUR - 60000;
    assert.deepEqual((await buy(base, a.token, ids(1))).body, UNCONFIRMED);
    assert.equal(gw.charges().length, 2);
    assert.equal(idem(gw.charges()[1]), idem(gw.charges()[0]), 'younger than 23 hours: the same call again');
    assert.deepEqual(store.list('payments').map((p) => p.status), ['pending']);

    clock.t = T0 + 23 * HOUR + 60000;
    down = false;
    const r = await buy(base, a.token, ids(1));
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { paid: ['k1'], chargedCents: 1900, creditUsedCents: 0 });
    assert.equal(gw.charges().length, 3);
    assert.notEqual(idem(gw.charges()[2]), idem(gw.charges()[0]), 'the old key is never sent again');
    const [old, fresh] = store.list('payments');
    assert.deepEqual([old.status, fresh.status], ['unresolved', 'succeeded']);
    const events = store.data().events.filter((e) => e.type === 'payment_unresolved');
    assert.equal(events.length, 1);
    assert.deepEqual(Object.keys(events[0]).sort(), ['account', 'at', 'payment', 'type']);
    assert.deepEqual([events[0].account, events[0].payment], [a.id, old.id]);
    assert.equal(store.list('entitlements').length, 1);
  });
});

test('M1: a key paid by card, released and paid by card again is a new payment with a new key, never a replay of the first', async () => {
  await shop({}, async ({ base, a, gw, store, b }) => {
    await buy(base, a.token, ids(1));
    assert.equal(b.release(b.find(a, 'k1').id), true);
    assert.deepEqual((await buy(base, a.token, [{ key: 'k2', tier: 'identity' }])).body, { paid: ['k2'], chargedCents: 0, creditUsedCents: 1900 });
    const r = await buy(base, a.token, ids(1));
    assert.deepEqual(r.body, { paid: ['k1'], chargedCents: 1900, creditUsedCents: 0 });
    assert.equal(gw.charges().length, 2);
    assert.notEqual(idem(gw.charges()[1]), idem(gw.charges()[0]));
    assert.deepEqual(store.list('payments').map((p) => [p.status, p.attempt]), [['succeeded', 0], ['succeeded', 1]]);
  });
});

test('M2: a key already paid at one level is refused at another, with no provider call', async () => {
  const MISMATCH = { error: "This invitation's package was paid at another level. Nothing was charged.", code: 'tier_mismatch' };
  await shop({}, async ({ base, a, gw, store, b }) => {
    await buy(base, a.token, ids(1));
    const before = gw.calls.length;
    const r = await buy(base, a.token, [{ key: 'k1', tier: 'full' }]);
    assert.equal(r.status, 409);
    assert.deepEqual(r.body, MISMATCH);
    // One mismatched key refuses the whole list: nothing is charged for the others either.
    const r2 = await buy(base, a.token, [{ key: 'k2', tier: 'identity' }, { key: 'k1', tier: 'full' }]);
    assert.equal(r2.status, 409);
    assert.deepEqual(r2.body, MISMATCH);
    b.consume(b.find(a, 'k1').id, 'invt_1');
    assert.deepEqual((await buy(base, a.token, [{ key: 'k1', tier: 'full' }])).body, MISMATCH, 'a consumed package too');
    assert.equal(gw.calls.length, before, 'no provider call');
    assert.equal(store.list('entitlements').length, 1);
    assert.equal(store.list('payments').length, 1);
    // Once that package went back to credit, the key is free for a new purchase at any level.
    assert.equal(b.release(b.find(a, 'k1').id), true);
    assert.deepEqual((await buy(base, a.token, [{ key: 'k1', tier: 'full' }])).body, { paid: ['k1'], chargedCents: 9900, creditUsedCents: 0 });
    assert.equal(b.find(a, 'k1').tier, 'full');
    assert.equal(credit(store, a), 1900);
  });
});

test('M3: a paid package nobody used within 24 hours comes back as credit, once; a used one is untouched', async () => {
  const clock = { t: T0 };
  await shop({ now: () => clock.t }, async ({ base, a, gw, store, b }) => {
    await buy(base, a.token, ids(2));
    clock.t = T0 + HOUR;
    b.consume(b.find(a, 'k2').id, 'invt_2');
    clock.t = T0 + 24 * HOUR;
    assert.equal((await j(base, 'GET', '/v1/billing', { bearer: a.token })).body.creditCents, 0, 'not before the 24 hours are over');
    clock.t = T0 + 25 * HOUR;
    const v = await j(base, 'GET', '/v1/billing', { bearer: a.token });
    assert.equal(v.body.creditCents, 1900);
    assert.deepEqual(v.body.charges[0], { at: new Date(clock.t).toISOString(), type: 'credit', by: 'credit', cents: 1900, tier: 'identity', invitationId: null });
    const creditLines = () => store.list('ledger').filter((l) => l.type === 'credit');
    assert.equal(creditLines().length, 1);
    const v2 = await j(base, 'GET', '/v1/billing', { bearer: a.token });
    assert.equal(v2.body.creditCents, 1900, 'a second read adds nothing');
    assert.equal(creditLines().length, 1);
    assert.deepEqual([b.find(a, 'k1').status, b.find(a, 'k1').creditedAt], ['credited', new Date(clock.t).toISOString()]);
    assert.deepEqual([b.find(a, 'k2').status, b.find(a, 'k2').invitationId], ['consumed', 'invt_2'], 'consumed within the 24 hours: untouched');

    // Paying runs the same rule: k3 is paid from that credit, sits unused, and pays for k4 a day later.
    assert.deepEqual((await buy(base, a.token, [{ key: 'k3', tier: 'identity' }])).body, { paid: ['k3'], chargedCents: 0, creditUsedCents: 1900 });
    clock.t = T0 + 50 * HOUR;
    assert.deepEqual((await buy(base, a.token, [{ key: 'k4', tier: 'identity' }])).body, { paid: ['k4'], chargedCents: 0, creditUsedCents: 1900 });
    assert.equal(b.find(a, 'k3').status, 'credited');
    assert.equal(credit(store, a), 0);
    assert.equal(creditLines().length, 2);
    assert.equal(gw.charges().length, 1, 'the card was charged once, for the first two');
  });
});

test('release: an unused package goes back to credit exactly once; one whose check has started never does', async () => {
  await shop({}, async ({ base, a, store, b }) => {
    await buy(base, a.token, ids(3));
    const [e1, e2, e3] = ['k1', 'k2', 'k3'].map((k) => b.find(a, k));
    assert.equal(b.release(e1.id), true);
    assert.equal(credit(store, a), 1900);
    const lines = store.list('ledger').filter((l) => l.type === 'credit');
    assert.deepEqual(lines.map((l) => [l.account, l.by, l.cents, l.tier, l.entitlement, l.chargeRef]), [[a.id, 'credit', 1900, 'identity', e1.id, 'pi_fixture_1']]);
    assert.equal(b.find(a, 'k1').status, 'credited');
    assert.equal(b.release(e1.id), false, 'a second release changes nothing');
    assert.equal(credit(store, a), 1900);

    b.consume(e2.id, 'invt_2');
    assert.equal(b.started(e2.id), true);
    assert.equal(b.started(e2.id), false);
    assert.ok(b.find(a, 'k2').startedAt);
    assert.equal(b.release(e2.id), false, 'started: never credited');
    assert.equal(b.find(a, 'k2').status, 'consumed');
    assert.equal(credit(store, a), 1900);

    b.consume(e3.id, 'invt_3');
    assert.equal(b.release(e3.id), true, 'consumed and not started: credited');
    assert.equal(credit(store, a), 3800);
    assert.equal(store.list('ledger').filter((l) => l.type === 'credit').length, 2);
    assert.equal(b.release('ent_unknown'), false);
    assert.equal(b.started('ent_unknown'), false);
  });
});

test('consume: a paid package belongs to one invitation; GET /v1/billing shows that invitation on its charge', async () => {
  await shop({}, async ({ base, a, b }) => {
    await buy(base, a.token, ids(2));
    const e = b.find(a, 'k1');
    const got = b.consume(e.id, 'invt_A');
    assert.deepEqual([got.status, got.invitationId], ['consumed', 'invt_A']);
    assert.equal(b.consume(e.id, 'invt_A').invitationId, 'invt_A', 'the same invitation again is fine');
    assert.throws(() => b.consume(e.id, 'invt_B'), (err) => err.status === 409);
    assert.equal(b.find(a, 'k1').invitationId, 'invt_A');
    assert.throws(() => b.consume('ent_unknown', 'invt_A'), (err) => err.status === 404);
    assert.throws(() => b.consume(e.id, ''), (err) => err.status === 400);
    const other = b.find(a, 'k2');
    b.release(other.id);
    assert.throws(() => b.consume(other.id, 'invt_C'), (err) => err.status === 409, 'a package that went back to credit cannot be used');
    const v = await j(base, 'GET', '/v1/billing', { bearer: a.token });
    assert.deepEqual(v.body.charges.filter((c) => c.type === 'package').map((c) => c.invitationId).sort(), ['invt_A', null].sort());
  });
});

test('available: a tier is offered only when payments are ready and that tier’s check providers are set up', () => {
  const providers = { idcheck: { env: ['IDCHECK_API_KEY'] }, accredit: { env: ['ACCREDIT_API_KEY', 'ACCREDIT_SECRET'] }, other: { env: [] } };
  const av = (env) => tools(openStore(null), { env, providers }).available();
  assert.deepEqual(av({}), { identity: false, full: false, reverify: false });
  assert.deepEqual(av({ IDCHECK_API_KEY: 'x' }), { identity: true, full: false, reverify: false });
  assert.deepEqual(av({ IDCHECK_API_KEY: 'x', ACCREDIT_API_KEY: 'y' }), { identity: true, full: false, reverify: false });
  assert.deepEqual(av({ IDCHECK_API_KEY: 'x', ACCREDIT_API_KEY: 'y', ACCREDIT_SECRET: 'z' }), { identity: true, full: true, reverify: true });
  assert.deepEqual(av({ ACCREDIT_API_KEY: 'y', ACCREDIT_SECRET: 'z' }), { identity: false, full: false, reverify: true });
  assert.deepEqual(av({ IDCHECK_API_KEY: 'x', ACCREDIT_API_KEY: 'y', ACCREDIT_SECRET: 'z', BILLING_SECRET_KEY: '' }), { identity: false, full: false, reverify: false });
  assert.deepEqual(av({ IDCHECK_API_KEY: 'x', ACCREDIT_API_KEY: 'y', ACCREDIT_SECRET: 'z', PACKAGE_PRICE_FULL_CENTS: '12.5' }), { identity: false, full: false, reverify: false });
  assert.deepEqual(av({ PACKAGE_IDENTITY_PROVIDER: 'other' }), { identity: true, full: false, reverify: false });
  assert.deepEqual(av({ IDCHECK_API_KEY: 'x', PACKAGE_IDENTITY_PROVIDER: 'missing' }), { identity: false, full: false, reverify: false });
  assert.deepEqual(av({ IDCHECK_API_KEY: 'x', PACKAGE_ACCREDITATION_PROVIDER: 'other' }), { identity: true, full: true, reverify: true });
});

test('who: the shared token answers 403 on every billing route, an investor’s link 401, and another account sees nothing of this one', async () => {
  const store = openStore(null);
  const gw = gateway();
  await start({ fetch: gw, store, env: { API_TOKEN: API } }, async (base) => {
    const a = await account(base, 'alpha');
    const other = await account(base, 'beta');
    await saveCard(base, a.token);
    await buy(base, a.token, ids(1));
    store.put('billing', { id: a.id, creditCents: 500 });
    const before = { calls: gw.calls.length, data: JSON.stringify(store.data()) };
    const all = [['GET', '/v1/billing'], ['POST', '/v1/billing/card/setup'], ['DELETE', '/v1/billing/card'], ['POST', '/v1/billing/entitlements', { items: ids(1, 'identity', 'z') }], ['GET', '/v1/billing/anything']];
    for (const [method, path, body] of all) {
      const shared = await j(base, method, path, { bearer: API, body, origin: PORTAL });
      assert.equal(shared.status, 403, `${method} ${path}`);
      assert.deepEqual(shared.body, { error: 'Card payments need a sponsor account.', code: 'account_required' });
      const investor = await j(base, method, path, { bearer: a.token, invite: 'x'.repeat(43), body });
      assert.equal(investor.status, 401, `${method} ${path} with an invitation token`);
      assert.equal((await j(base, method, path, { body })).status, 401, `${method} ${path} with no token`);
      assert.equal((await j(base, method, path, { bearer: 'y'.repeat(43), body })).status, 401, `${method} ${path} with an unknown token`);
    }
    assert.equal(gw.calls.length, before.calls);
    assert.equal(JSON.stringify(store.data()), before.data, 'nothing changed');

    const v = await j(base, 'GET', '/v1/billing', { bearer: other.token });
    assert.deepEqual([v.body.card, v.body.creditCents, v.body.charges], [null, 0, []]);
    const r = await buy(base, other.token, ids(1));
    assert.equal(r.status, 402, 'the same key under another account is not paid, and this account’s card is not used');
    assert.equal(r.body.code, 'no_card');
    assert.equal(gw.calls.length, before.calls);
    assert.equal(tools(store).find(other, 'k1'), null);
    assert.equal((await j(base, 'GET', '/v1/billing', { bearer: a.token })).body.creditCents, 500);
  });
});

test('card page: one short-lived session each, framed only by the portal that asked, believed only after the provider confirms', async () => {
  const SECOND = 'https://second.example';
  const clock = { t: T0 };
  let read = fx('setup-succeeded').reply;
  const gw = gateway({ setupRead: () => read });
  const store = openStore(null);
  const visible = (html) => html.replace(/<head>[\s\S]*?<\/head>/, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  await start({ fetch: gw, store, now: () => clock.t, env: { PORTAL_ORIGIN: `${PORTAL},${SECOND}` } }, async (base) => {
    const a = await account(base, 'alpha');
    const open = async (origin) => {
      const s = await j(base, 'POST', '/v1/billing/card/setup', { bearer: a.token, origin });
      assert.equal(s.status, 200, s.text);
      return s.body.url.slice(PUBLIC.length);
    };
    for (const path of [`/billing/card/${'x'.repeat(32)}`, '/billing/card/short', '/billing/other']) {
      assert.equal((await j(base, 'GET', path)).status, 404, path);
      assert.equal((await j(base, 'POST', `${path}/done`)).status, 404, path);
    }
    assert.equal((await j(base, 'POST', '/v1/billing/card/setup', { bearer: a.token, origin: 'https://elsewhere.example' })).status, 403, 'an origin that is not the portal’s gets no session');

    // The page may be framed by the portal origin that asked for it, and tells only that origin when it is finished.
    for (const origin of [SECOND, PORTAL]) {
      const page = await fetch(base + (await open(origin)));
      assert.equal(page.status, 200);
      assert.equal(page.headers.get('content-security-policy'), `frame-ancestors ${origin}`);
      assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(page.headers.get('cache-control'), 'no-store');
      const html = await page.text();
      assert.ok(html.includes(`"origin":"${origin}"`), 'the finished message goes to that origin');
      assert.ok(html.includes("postMessage({type:'cv-card-saved'},c.origin)"));
      assert.equal(visible(html), 'Card Save card', 'the visible text is the heading and the button');
      assert.ok(!visible(html).toLowerCase().includes(VENDOR));
      assert.equal(html.match(/<script src="https:\/\/[^"]+"><\/script>/g).length, 1, 'one outside script: the provider’s card field');
      assert.ok(html.includes('disableLink:true') && !/paymentRequest|wallet/i.test(html), 'a card-only field: no wallet or one-click button');
    }
    // A caller that sends no Origin (not a browser) gets a page any configured portal origin may frame.
    const plain = await fetch(base + (await open(undefined)));
    assert.equal(plain.headers.get('content-security-policy'), `frame-ancestors ${PORTAL} ${SECOND}`);

    // Not confirmed by the provider, or confirmed for another customer: nothing is saved and the session stays open.
    const path = await open(PORTAL);
    for (const reply of [Object.assign({}, read, { status: 'requires_payment_method', payment_method: null }), Object.assign({}, read, { customer: 'cus_someone_else' })]) {
      read = reply;
      const r = await j(base, 'POST', `${path}/done`);
      assert.equal(r.status, 409);
      assert.deepEqual(r.body, { error: 'The card was not saved.', code: 'card_not_saved' });
      assert.equal(store.get('billing', a.id).card, null);
    }
    read = fx('setup-succeeded').reply;
    assert.deepEqual((await j(base, 'POST', `${path}/done`)).body, { ok: true, card: CARD });
    // A used session is finished: its page and its /done are gone.
    assert.equal((await j(base, 'POST', `${path}/done`)).status, 404);
    assert.equal((await j(base, 'GET', path)).status, 404);

    const late = await open(PORTAL);
    clock.t = T0 + 15 * 60 * 1000 - 1000;
    assert.equal((await j(base, 'GET', late)).status, 200);
    clock.t = T0 + 15 * 60 * 1000 + 1000;
    assert.equal((await j(base, 'GET', late)).status, 404, 'expired after 15 minutes');
    assert.equal((await j(base, 'POST', `${late}/done`)).status, 404);
  });
  // POST /done is rate limited like the other calls that can cost money (three a minute here: the account, the setup, one more).
  await start({ fetch: gateway(), env: { RATE_LIMIT_PER_MIN: '3' } }, async (base) => {
    const a = await account(base, 'alpha');
    const s = await j(base, 'POST', '/v1/billing/card/setup', { bearer: a.token, origin: PORTAL });
    const path = s.body.url.slice(PUBLIC.length);
    assert.equal((await j(base, 'POST', `/billing/card/${'x'.repeat(32)}/done`)).status, 404);
    assert.equal((await j(base, 'POST', `${path}/done`)).status, 429);
    assert.equal((await j(base, 'GET', path)).status, 200, 'reading the page is not limited');
  });
});

test('remove and replace: DELETE /v1/billing/card detaches the card at the provider and clears it; a new card detaches the old one', async () => {
  let second = false;
  let detachDown = false;
  const gw = gateway(Object.assign({ detach: () => (detachDown ? { status: 503, body: {} } : Object.assign({}, fx('payment-method').reply, { customer: null })) }, secondCard(() => second)));
  await shop({ gw }, async ({ base, a, store }) => {
    // Saving the same card again detaches nothing.
    let from = gw.calls.length;
    await saveCard(base, a.token);
    assert.ok(!gw.paths(from).some((p) => p.endsWith('/detach')));
    // A new card: the old one is detached at the provider.
    second = true;
    from = gw.calls.length;
    assert.equal((await saveCard(base, a.token)).card.last4, '1881');
    assert.ok(gw.paths(from).includes('POST /v1/payment_methods/pm_fixture1/detach'));
    assert.equal(store.get('billing', a.id).card.method, 'pm_fixture2');

    detachDown = true;
    const no = await j(base, 'DELETE', '/v1/billing/card', { bearer: a.token });
    assert.equal(no.status, 409);
    assert.deepEqual(no.body, UNAVAILABLE);
    assert.equal(store.get('billing', a.id).card.method, 'pm_fixture2', 'the card stays on file until the provider has let it go');

    detachDown = false;
    from = gw.calls.length;
    const r = await j(base, 'DELETE', '/v1/billing/card', { bearer: a.token });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { card: null });
    assert.deepEqual(gw.paths(from), ['POST /v1/payment_methods/pm_fixture2/detach']);
    assert.equal(gw.calls[from].headers.Authorization, `Bearer ${SECRET}`);
    assert.equal(store.get('billing', a.id).card, null);
    assert.equal((await j(base, 'GET', '/v1/billing', { bearer: a.token })).body.card, null);
    assert.equal((await buy(base, a.token, ids(1))).body.code, 'no_card');
    from = gw.calls.length;
    assert.deepEqual((await j(base, 'DELETE', '/v1/billing/card', { bearer: a.token })).body, { card: null });
    assert.equal(gw.calls.length, from, 'nothing to detach the second time');
  });
});

test('errors: no reply, event or log line holds the secret key or the payment vendor’s name or domain', async () => {
  const loud = (status) => ({ status, body: { error: { type: 'api_error', message: `${VENDOR} says no: key ${SECRET} at https://api.${VENDOR}.com/v1`, doc_url: `https://${VENDOR}.com/docs` } } });
  assert.ok(JSON.stringify(fx('error-card-declined').reply).toLowerCase().includes(VENDOR), 'the recorded refusals do name the vendor');
  let charge = () => refusal('error-card-declined');
  let over = {};
  const gw = gateway({ charge: (call, ok) => charge(call, ok), customer: (c) => (over.customer ? over.customer(c) : fx('customer-created').reply), setup: (c) => (over.setup ? over.setup(c) : fx('setup-created').reply), setupRead: (c) => (over.setupRead ? over.setupRead(c) : fx('setup-succeeded').reply), detach: (c) => (over.detach ? over.detach(c) : {}) });
  const store = openStore(null);
  const replies = [];
  const lines = [];
  const real = { error: console.error, log: console.log, warn: console.warn };
  for (const k of Object.keys(real)) console[k] = (...args) => lines.push(args.map(String).join(' '));
  try {
    await start({ fetch: gw, store }, async (base) => {
      const a = await account(base, 'alpha');
      const say = async (method, path, opts) => replies.push((await j(base, method, path, Object.assign({ bearer: a.token, origin: PORTAL }, opts))).text);
      over.customer = () => loud(401);
      await say('POST', '/v1/billing/card/setup');
      over.customer = null;
      over.setup = () => loud(500);
      await say('POST', '/v1/billing/card/setup');
      over.setup = null;
      const s = await j(base, 'POST', '/v1/billing/card/setup', { bearer: a.token, origin: PORTAL });
      const path = s.body.url.slice(PUBLIC.length);
      over.setupRead = () => loud(404);
      replies.push((await j(base, 'POST', `${path}/done`)).text);
      over.setupRead = null;
      replies.push((await j(base, 'POST', `${path}/done`)).text);
      for (const next of [() => refusal('error-card-declined'), () => refusal('error-authentication-required'), () => loud(400), () => loud(500), () => { throw new Error(`connect to api.${VENDOR}.com refused`); }, (call, ok) => ok(call)]) {
        charge = next;
        await say('POST', '/v1/billing/entitlements', { body: { items: ids(1) } });
      }
      over.detach = () => loud(500);
      await say('DELETE', '/v1/billing/card');
      await say('GET', '/v1/billing');
      await say('POST', '/v1/billing/entitlements', { body: { items: 'no' } });
      replies.push((await j(base, 'GET', '/v1/billing', { bearer: API })).text);
    });
  } finally {
    Object.assign(console, real);
  }
  assert.equal(replies.length, 14);
  const events = JSON.stringify(store.data().events);
  for (const text of [...replies, events, ...lines]) {
    const low = text.toLowerCase();
    assert.ok(!low.includes(VENDOR), `the vendor is named in: ${text.slice(0, 200)}`);
    assert.ok(!text.includes(SECRET) && !low.includes('sk_test'), `the key is in: ${text.slice(0, 200)}`);
  }
  assert.ok(/billing_error|payment_refused/.test(events), 'what went wrong is on record for the operator, as a status number only');
});

test('fixtures and older stores: every recorded reply names its source and says how far it is confirmed; a store file from before these tables still works', async () => {
  for (const name of ['customer-created', 'setup-created', 'setup-succeeded', 'payment-method', 'charge-succeeded', 'error-card-declined', 'error-authentication-required']) {
    const f = fx(name);
    assert.match(f._source, /^https:\/\//, name);
    assert.match(f._status, /^unconfirmed/, `${name}: no reference page was read in this build`);
    assert.ok(f.reply && typeof f.reply === 'object');
  }
  const file = join(mkdtempSync(join(tmpdir(), 'billing-old-')), 'store.json');
  writeFileSync(file, JSON.stringify({ verifications: {}, screenings: {}, invitations: {}, outbox: {}, accounts: {}, events: [], seen: [] }));
  await shop({ store: openStore(file) }, async ({ base, a, store }) => {
    assert.deepEqual((await buy(base, a.token, ids(1))).body, { paid: ['k1'], chargedCents: 1900, creditUsedCents: 0 });
    assert.deepEqual(['billing', 'entitlements', 'ledger', 'payments'].map((t) => store.list(t).length), [1, 1, 1, 1]);
  });
});
