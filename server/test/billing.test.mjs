// Charging the sponsor's card (plan 08-04): a card on file entered on this server's hosted card page, packages paid at
// the server's own price, credit first, one charge for a list, a durable record before every charge, no double charge,
// nothing recorded when a charge is refused, unused packages returned as credit. Every reply from the payment provider
// is a recorded fixture answered by a fetch stand-in: no payment account exists and none is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withServer, mockFetch } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';

const ADMIN = 'operator-admin-token-0123456789';
const SECRET = 'sk_test_fixtureSecretKey0123456789';
const PUBKEY = 'pk_test_fixturePublishableKey01';
const PUBLIC = 'https://verify.example';
const PORTAL = 'https://portal.example';
const T0 = Date.parse('2026-11-19T12:00:00Z');
const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/billing/${name}.json`, import.meta.url), 'utf8'));
const CARD = { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 };

/**
 * The payment provider's stand-in: every route answers its fixture unless a test replaces it. A handler that throws
 * stands for a call whose outcome is unknown (a timeout or a dropped connection).
 */
function gateway(over = {}) {
  let n = 0;
  const f = mockFetch([
    ['POST', /\/v1\/customers$/, over.customer || (() => fx('customer-created').reply)],
    ['POST', /\/v1\/setup_intents$/, over.setup || (() => fx('setup-created').reply)],
    ['GET', /\/v1\/setup_intents\/[^/]+$/, over.setupRead || (() => fx('setup-succeeded').reply)],
    ['GET', /\/v1\/payment_methods\/[^/]+$/, over.method || (() => fx('payment-method').reply)],
    ['POST', /\/v1\/payment_methods\/[^/]+\/detach$/, over.detach || (() => Object.assign({}, fx('payment-method').reply, { customer: null }))],
    ['POST', /\/v1\/payment_intents$/, over.charge || ((call) => Object.assign({}, fx('charge-succeeded').reply, { id: `pi_fixture_${++n}`, amount: Number(call.body.amount) }))]
  ]);
  f.charges = () => f.calls.filter((c) => c.method === 'POST' && /\/payment_intents$/.test(c.url));
  return f;
}

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
    assert.deepEqual(Object.keys(view.body), ['ready', 'available', 'card', 'currency', 'prices', 'creditCents', 'charges']);
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
    for (const s of strings([data.billing, data.entitlements, data.ledger, data.payments])) assert.ok(!/^\d{5,}$/.test(s), `no stored field is a run of digits longer than the last four: ${s}`);
    const all = JSON.stringify(data);
    assert.ok(!all.includes(SECRET) && !all.includes(fx('setup-created').reply.client_secret), 'neither the secret key nor the setup’s secret is stored');
  });
});
