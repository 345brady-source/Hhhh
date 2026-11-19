// Settling payments nobody could confirm, and the operator's card refund (plan 08-16). A payment whose outcome stayed
// unknown is settled only from the provider's own record of it, read back with the secret key after a signed delivery;
// the sponsor sees it in GET /v1/billing until then. Money refunded or contested leaves nothing bought with it usable,
// and credit already spent becomes an amount owed. The operator refunds an unused package to the card behind
// ADMIN_TOKEN only, with the refund written to the store before the provider hears of it. Every reply from the provider
// is a recorded fixture answered by a fetch stand-in: no payment account exists and none is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { withServer, mockFetch } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { createBilling, ASSUMED } from '../lib/billing.mjs';

const ADMIN = 'operator-admin-token-0123456789';
const SECRET = 'sk_test_fixtureSecretKey0123456789';
const PUBKEY = 'pk_test_fixturePublishableKey01';
const WHSEC = 'whsec_fixtureWebhookSecret0123456789';
const PUBLIC = 'https://verify.example';
const PORTAL = 'https://portal.example';
const T0 = Date.parse('2026-11-19T12:00:00Z');
const HOUR = 3600 * 1000;
const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/billing/${name}.json`, import.meta.url), 'utf8'));
const copy = (x) => JSON.parse(JSON.stringify(x));
/** The payment vendor's name, taken from a fixture's source line so that it is written nowhere in this file. */
const VENDOR = new URL(fx('customer-created')._source).hostname.split('.').slice(-2)[0];
const UNCONFIRMED = { error: 'The payment could not be confirmed. Try again in a few minutes.', code: 'billing_unavailable' };

// The delivery's signature header, exactly as ASSUMED describes it (never a header name written here).
const nowSeconds = () => Math.floor(Date.now() / 1000);
function signed(raw, { ts = nowSeconds(), secret = WHSEC } = {}) {
  return { [ASSUMED.webhook.header]: ASSUMED.signatureValue(ts, createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex')) };
}

/**
 * The payment provider's stand-in: the routes 08-04's code calls, the read-back of a charge, the read-back of a payment
 * and the refund call. A handler that throws stands for a call whose outcome is unknown (a timeout or a dropped
 * connection). down: charges throw while it is true.
 */
function gateway(over = {}) {
  let n = 0;
  const ok = (call) => Object.assign({}, fx('charge-succeeded').reply, { id: `pi_fixture_${++n}`, amount: Number(call.body.amount) });
  const f = mockFetch([
    ['POST', /\/v1\/customers$/, () => fx('customer-created').reply],
    ['POST', /\/v1\/setup_intents$/, () => fx('setup-created').reply],
    ['GET', /\/v1\/setup_intents\/[^/]+$/, () => fx('setup-succeeded').reply],
    ['GET', /\/v1\/payment_methods\/[^/]+$/, () => fx('payment-method').reply],
    ['POST', /\/v1\/payment_intents$/, (call) => (f.down ? Promise.reject(new Error('timed out')) : over.charge ? over.charge(call, ok) : ok(call))],
    ['GET', /\/v1\/payment_intents\/[^/?]+(\?.*)?$/, (call) => f.payRead(call)],
    ['GET', /\/v1\/charges\/[^/?]+(\?.*)?$/, (call) => f.read(call)],
    ['POST', /\/v1\/refunds$/, (call) => f.refund(call)]
  ]);
  f.down = false;
  f.read = () => fx('charge-read').reply;
  f.payRead = () => ({ status: 404, body: { error: { message: 'not stood in' } } });
  f.refund = () => ({ status: 404, body: { error: { message: 'not stood in' } } });
  f.charges = () => f.calls.filter((c) => c.method === 'POST' && /\/payment_intents$/.test(c.url));
  f.payReads = () => f.calls.filter((c) => c.method === 'GET' && /\/payment_intents\//.test(c.url));
  f.refunds = () => f.calls.filter((c) => c.method === 'POST' && /\/refunds$/.test(c.url));
  return f;
}

/** A server with ADMIN_TOKEN, both payment keys, the delivery secret, one portal origin and no rate limit. */
const start = ({ env, fetch: fetchImpl, now, store } = {}, fn) =>
  withServer({ env: Object.assign({ ADMIN_TOKEN: ADMIN, PUBLIC_URL: PUBLIC, PORTAL_ORIGIN: PORTAL, BILLING_SECRET_KEY: SECRET, BILLING_PUBLISHABLE_KEY: PUBKEY, BILLING_WEBHOOK_SECRET: WHSEC, RATE_LIMIT_PER_MIN: '0' }, env), fetch: fetchImpl, now, store }, fn);
/** This module's own functions on a server's store (what the invitation code calls). */
const tools = (store, { now, fetch: fetchImpl } = {}) =>
  createBilling({ env: { BILLING_SECRET_KEY: SECRET, BILLING_PUBLISHABLE_KEY: PUBKEY, BILLING_WEBHOOK_SECRET: WHSEC }, store, fetch: fetchImpl || gateway(), now: now || (() => T0), providers: {}, publicUrl: PUBLIC, origins: [PORTAL] });

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
  const setup = await j(base, 'POST', '/v1/billing/card/setup', { bearer: token, origin: PORTAL });
  assert.equal(setup.status, 200, setup.text);
  const done = await j(base, 'POST', `${setup.body.url.slice(PUBLIC.length)}/done`);
  assert.equal(done.status, 200, done.text);
}
const buy = (base, token, items) => j(base, 'POST', '/v1/billing/entitlements', { bearer: token, body: { items } });
const view = async (base, token) => (await j(base, 'GET', '/v1/billing', { bearer: token })).body;

/** Post raw bytes to the delivery route, signed unless headers are given. */
async function deliver(base, raw, headers = signed(raw)) {
  const res = await fetch(`${base}/billing/webhook`, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: raw });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: res.status, body, text };
}
/** A payment delivery from a recorded one: its event id, its type and the provider's id for the payment it names. */
function paymentEvent(name, { id, payment = 'pi_lost1' } = {}) {
  const ev = copy(fx(name).reply);
  if (id !== undefined) ev.id = id;
  ev.data.object.id = payment;
  return JSON.stringify(ev);
}
/** A payment as the provider reads it back: succeeded for this server's payment record, with its latest charge. */
function paymentRead(pay, patch = {}, charge = {}) {
  const obj = copy(fx('webhook-payment-succeeded').reply.data.object);
  const ref = patch.id || 'pi_lost1';
  Object.assign(obj, { id: ref, amount: pay.cardCents, metadata: { payment: pay.id } }, patch);
  obj.latest_charge = Object.assign(obj.latest_charge, { id: `ch_${ref.replace(/^pi_/, '')}`, payment_intent: ref, amount: pay.cardCents }, charge);
  return obj;
}
const mine = (store, table, a) => store.list(table).filter((x) => x.account === a.id);
const creditOf = (store, a) => (store.get('billing', a.id) || {}).creditCents || 0;
const held = (store) => JSON.stringify({ e: store.list('entitlements'), l: store.list('ledger'), b: store.list('billing'), p: store.list('payments') });

/**
 * A server, an account with a card on file, and one payment for k1 left unresolved by 08-04's own rules: its charge
 * times out at T0, and at T0 + 24 hours the next payment marks it unresolved and is paid itself (k2 unless given).
 */
async function lost(fn, { next = [{ key: 'k2', tier: 'identity' }], first = [{ key: 'k1', tier: 'identity' }], store = openStore(null), gw = gateway() } = {}) {
  const clock = { t: T0 };
  await start({ fetch: gw, store, now: () => clock.t }, async (base) => {
    const a = await account(base, 'alpha');
    await saveCard(base, a.token);
    gw.down = true;
    const r1 = await buy(base, a.token, first);
    assert.equal(r1.status, 409, r1.text);
    assert.deepEqual(r1.body, UNCONFIRMED);
    gw.down = false;
    const pay = mine(store, 'payments', a)[0];
    assert.equal(pay.status, 'pending');
    clock.t = T0 + 24 * HOUR;
    if (next.length) {
      const r2 = await buy(base, a.token, next);
      assert.equal(r2.status, 200, r2.text);
      assert.equal(store.get('payments', pay.id).status, 'unresolved');
    }
    await fn({ base, a, gw, store, clock, pay, b: tools(store, { now: () => clock.t }) });
  });
}

test('tracer: an unresolved payment shows in the sponsor’s billing view and is settled into a recorded package by the provider’s payment delivery', async () => {
  await lost(async ({ base, a, gw, store, pay }) => {
    assert.equal(gw.charges().length, 2, 'the lost charge once, the next payment once: the lost one is never sent again');
    const before = await view(base, a.token);
    assert.deepEqual(before.unresolved, [{ at: new Date(T0).toISOString(), cents: 1900 }]);

    gw.payRead = () => paymentRead(pay);
    const r = await deliver(base, paymentEvent('webhook-payment-succeeded'));
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { received: true });
    assert.equal(gw.payReads().length, 1, 'the provider’s own record was read once');
    assert.equal(gw.payReads()[0].headers.Authorization, `Bearer ${SECRET}`);
    assert.match(new URL(gw.payReads()[0].url).pathname, /\/payment_intents\/pi_lost1$/);
    assert.equal(gw.charges().length, 2, 'nothing was charged again');

    const settled = store.get('payments', pay.id);
    assert.equal(settled.status, 'succeeded');
    assert.equal(settled.chargeRef, 'pi_lost1');
    const k1 = mine(store, 'entitlements', a).filter((e) => e.key === 'k1');
    assert.deepEqual(k1.map((e) => [e.status, e.by, e.cents, e.chargeRef]), [['paid', 'card', 1900, 'pi_lost1']]);
    assert.deepEqual(mine(store, 'ledger', a).filter((l) => l.entitlement === k1[0].id).map((l) => [l.type, l.by, l.cents]), [['package', 'card', 1900]]);
    assert.deepEqual((await view(base, a.token)).unresolved, []);
  });
});

/** A payment read back as not charged (the failed delivery's own object), for this server's payment record. */
function failedRead(pay, patch = {}) {
  return Object.assign(copy(fx('webhook-payment-failed').reply.data.object), { id: 'pi_lost1', amount: pay.cardCents, metadata: { payment: pay.id } }, patch);
}
const TWO = [{ key: 'k1', tier: 'identity' }, { key: 'k3', tier: 'full' }];

test('N7 unresolved then reported succeeded: the payment ends as recorded packages, once; a key bought again meanwhile goes straight back as credit', async () => {
  await lost(async ({ base, a, gw, store, pay, b }) => {
    assert.equal(pay.cardCents, 11800);
    gw.payRead = () => paymentRead(pay);
    assert.deepEqual((await deliver(base, paymentEvent('webhook-payment-succeeded'))).body, { received: true });
    assert.equal(store.get('payments', pay.id).status, 'succeeded');
    for (const it of TWO) {
      const es = mine(store, 'entitlements', a).filter((e) => e.key === it.key);
      assert.deepEqual(es.map((e) => [e.status, e.tier, e.chargeRef]), [['paid', it.tier, 'pi_lost1']], it.key);
      assert.deepEqual(mine(store, 'ledger', a).filter((l) => l.entitlement === es[0].id).map((l) => [l.type, l.by]), [['package', 'card']], it.key);
    }
    // The same payment reported again under another event id: nothing changes.
    const before = held(store);
    assert.deepEqual((await deliver(base, paymentEvent('webhook-payment-succeeded', { id: 'evt_paid_again' }))).body, { received: true });
    assert.equal(held(store), before);
    assert.equal(gw.payReads().length, 2);
    assert.equal(b.find(a.id, 'k3').status, 'paid');
  }, { first: TWO });

  // The sponsor bought k1 again by card while its first payment was unresolved: the settled duplicate is credited.
  await lost(async ({ base, a, gw, store, pay, b }) => {
    const again = b.find(a.id, 'k1');
    assert.equal(again.status, 'paid');
    assert.notEqual(again.chargeRef, 'pi_lost1');
    assert.equal(creditOf(store, a), 0);
    gw.payRead = () => paymentRead(pay);
    assert.deepEqual((await deliver(base, paymentEvent('webhook-payment-succeeded'))).body, { received: true });
    assert.equal(store.get('payments', pay.id).status, 'succeeded');
    const es = mine(store, 'entitlements', a).filter((e) => e.key === 'k1');
    assert.deepEqual(es.map((e) => [e.status, e.chargeRef]), [['paid', again.chargeRef], ['credited', 'pi_lost1']]);
    assert.deepEqual(mine(store, 'ledger', a).filter((l) => l.type === 'credit').map((l) => [l.cents, l.entitlement]), [[1900, es[1].id]]);
    assert.equal(creditOf(store, a), 1900, 'the price of the duplicate, as credit');
    assert.equal(b.find(a.id, 'k1').id, again.id, 'find still returns the one active package');
    assert.deepEqual((await view(base, a.token)).unresolved, []);
  }, { next: [{ key: 'k1', tier: 'identity' }] });

  // R8: the payment succeeded, but its money has already gone back (or is contested) by the time it is settled: the
  // packages are recorded with it and are never usable.
  for (const [how, charge, status] of [['refunded', { amount_refunded: 11800, refunded: true }, 'refunded'], ['disputed', { disputed: true }, 'disputed']]) {
    await lost(async ({ base, a, gw, store, pay, b }) => {
      gw.payRead = () => paymentRead(pay, {}, charge);
      assert.deepEqual((await deliver(base, paymentEvent('webhook-payment-succeeded'))).body, { received: true }, how);
      assert.equal(store.get('payments', pay.id).status, 'succeeded', how);
      for (const it of TWO) {
        assert.equal(b.find(a.id, it.key).status, status, `${how}: ${it.key}`);
        assert.equal(b.release(b.find(a.id, it.key).id), false, `${how}: never credited`);
        assert.throws(() => b.consume(b.find(a.id, it.key).id, 'invt_x'), (err) => err.status === 409, `${how}: never consumed`);
      }
      assert.equal(creditOf(store, a), 0, how);
    }, { first: TWO });
  }
});

test('N7 unresolved then reported failed: the payment ends closed with nothing owed and nothing recorded', async () => {
  await lost(async ({ base, a, gw, store, pay }) => {
    const ledger = mine(store, 'ledger', a).length;
    const ents = mine(store, 'entitlements', a).length;
    gw.payRead = () => failedRead(pay);
    const r = await deliver(base, paymentEvent('webhook-payment-failed'));
    assert.equal(r.status, 200, r.text);
    assert.equal(store.get('payments', pay.id).status, 'failed');
    assert.equal(mine(store, 'entitlements', a).filter((e) => e.key === 'k1').length, 0);
    assert.equal(mine(store, 'entitlements', a).length, ents);
    assert.equal(mine(store, 'ledger', a).length, ledger);
    assert.equal(creditOf(store, a), 0);
    const v = await view(base, a.token);
    assert.deepEqual(v.unresolved, []);
    assert.equal(v.creditCents, 0);
    assert.equal(gw.charges().length, 2, 'nothing was charged');
  });
});

test('N7 mismatch: another account’s payment, a different amount or customer, a closed payment read the other way: nothing changes and nothing throws', async () => {
  await lost(async ({ base, a, gw, store, pay }) => {
    // A second account with a payment of its own left pending, under its own customer.
    const beta = await account(base, 'beta');
    await saveCard(base, beta.token);
    store.put('billing', { id: beta.id, customer: 'cus_beta1' });
    gw.down = true;
    assert.equal((await buy(base, beta.token, [{ key: 'b1', tier: 'identity' }])).status, 409);
    gw.down = false;
    const betaPay = mine(store, 'payments', beta)[0];
    const okPay = mine(store, 'payments', a).find((p) => p.status === 'succeeded');
    const k2 = mine(store, 'entitlements', a).find((e) => e.key === 'k2');
    const tries = [
      ['alpha’s customer naming beta’s payment', () => paymentRead(betaPay)],
      ['a different amount', () => paymentRead(pay, { amount: 1800 })],
      ['a different customer', () => paymentRead(pay, { customer: 'cus_someoneElse' })],
      ['no payment named', () => paymentRead(pay, { metadata: {} })],
      ['a payment this server never made', () => paymentRead(pay, { metadata: { payment: 'pay_unknown1' } })],
      ['a succeeded payment read back as failed', () => failedRead(okPay)]
    ];
    let n = 0;
    for (const [why, read] of tries) {
      const before = held(store);
      gw.payRead = read;
      const r = await deliver(base, paymentEvent(why.includes('failed') ? 'webhook-payment-failed' : 'webhook-payment-succeeded', { id: `evt_mismatch_${++n}` }));
      assert.equal(r.status, 200, `${why}: ${r.text}`);
      assert.deepEqual(r.body, { received: true }, why);
      assert.equal(held(store), before, why);
    }
    assert.equal(store.get('payments', okPay.id).status, 'succeeded');
    assert.equal(store.get('entitlements', k2.id).status, 'paid');
    assert.equal(store.get('payments', betaPay.id).status, 'pending');
    assert.equal(store.get('payments', pay.id).status, 'unresolved');

    // A failed payment read back as succeeded stays failed.
    gw.payRead = () => failedRead(pay);
    assert.equal((await deliver(base, paymentEvent('webhook-payment-failed', { id: 'evt_fail_first' }))).status, 200);
    assert.equal(store.get('payments', pay.id).status, 'failed');
    const before = held(store);
    gw.payRead = () => paymentRead(pay);
    const r = await deliver(base, paymentEvent('webhook-payment-succeeded', { id: 'evt_then_paid' }));
    assert.equal(r.status, 200, r.text);
    assert.equal(held(store), before);
    assert.equal(mine(store, 'entitlements', a).filter((e) => e.key === 'k1').length, 0);
  });
});

test('N7 pending reported succeeded: a pending payment younger than 23 hours is recorded once, and the next payment never repeats its charge', async () => {
  await lost(async ({ base, a, gw, store, clock, pay }) => {
    clock.t = T0 + HOUR;
    assert.equal(gw.charges().length, 1);
    gw.payRead = () => paymentRead(pay);
    assert.deepEqual((await deliver(base, paymentEvent('webhook-payment-succeeded'))).body, { received: true });
    assert.equal(store.get('payments', pay.id).status, 'succeeded');
    assert.deepEqual(mine(store, 'entitlements', a).map((e) => [e.key, e.status, e.chargeRef]), [['k1', 'paid', 'pi_lost1']]);

    const r = await buy(base, a.token, [{ key: 'k1', tier: 'identity' }, { key: 'k2', tier: 'identity' }]);
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { paid: ['k1', 'k2'], chargedCents: 1900, creditUsedCents: 0 });
    assert.equal(gw.charges().length, 2, 'one new charge, for k2; the settled one was not repeated');
    assert.equal(gw.charges()[1].body.amount, '1900');
    assert.deepEqual(mine(store, 'entitlements', a).map((e) => e.key), ['k1', 'k2']);
    assert.equal(mine(store, 'ledger', a).length, 2);
  }, { next: [] });
});

test('N7 wording: a charge confirmed in the same call that is then refused for its level never says "Nothing was charged"', async () => {
  const SHORT = { error: "This invitation's package was paid at another level.", code: 'tier_mismatch' };
  const LONG = { error: "This invitation's package was paid at another level. Nothing was charged.", code: 'tier_mismatch' };
  const gw = gateway();
  const store = openStore(null);
  await start({ fetch: gw, store, now: () => T0 }, async (base) => {
    const a = await account(base, 'alpha');
    await saveCard(base, a.token);
    gw.down = true;
    assert.deepEqual((await buy(base, a.token, [{ key: 'k1', tier: 'identity' }])).body, UNCONFIRMED);
    gw.down = false;
    const r = await buy(base, a.token, [{ key: 'k1', tier: 'full' }]);
    assert.equal(r.status, 409, r.text);
    assert.deepEqual(r.body, SHORT);
    assert.ok(!r.text.includes('Nothing was charged'), r.text);
    assert.equal(gw.charges().length, 2, 'the stored call was repeated and succeeded');
    assert.equal(mine(store, 'payments', a)[0].status, 'succeeded');
    assert.equal(mine(store, 'entitlements', a)[0].tier, 'identity');
    // A plain mismatch, with no charge confirmed in that call, keeps the full sentence.
    const plain = await buy(base, a.token, [{ key: 'k1', tier: 'full' }]);
    assert.equal(plain.status, 409);
    assert.deepEqual(plain.body, LONG);
    assert.equal(gw.charges().length, 2);
  });
});
