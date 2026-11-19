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

// ---------- The operator's card refund (N6's admin part, W7), credit owed (R9), refunds counted once (R10) ----------

const NOT_ALLOWED = { error: 'This package cannot be refunded to the card.', code: 'refund_not_allowed' };
const REFUSED = { error: 'The refund was refused. Nothing was refunded.', code: 'refund_refused' };
const UNSURE = { error: 'The refund could not be confirmed. Try again in a few minutes.', code: 'refund_unconfirmed' };
const OWED = { error: 'A refunded payment left an amount owed. Settle it before adding packages.', code: 'credit_owed' };
const refundIt = (base, entitlement, { bearer = ADMIN, invite } = {}) => j(base, 'POST', '/billing/admin/refund', { bearer, invite, body: { entitlement } });
let refundN = 0;
/** The provider's answer to a refund that went through: its own id and status. */
const refundDone = (call) => Object.assign(copy(fx('refund-created').reply), { id: `re_admin_${++refundN}`, amount: Number(call.body.amount), metadata: { entitlement: call.body['metadata[entitlement]'] } });
/** A refund delivery: the event names the charge; the read-back lists the given refunds. */
function refundEvent(id, charge = 'ch_fixture1') {
  const ev = copy(fx('webhook-refunded').reply);
  ev.id = id;
  ev.data.object.id = charge;
  return JSON.stringify(ev);
}
const chargeRead = (ref, patch) => Object.assign(copy(fx('charge-read').reply), { payment_intent: ref }, patch);
/** A server, an account with a card, and the packages it bought in one card charge. */
async function shop(items, fn, { gw = gateway(), store = openStore(null), env } = {}) {
  await start({ fetch: gw, store, env, now: () => T0 }, async (base) => {
    const a = await account(base, 'alpha');
    await saveCard(base, a.token);
    const r = await buy(base, a.token, items);
    assert.equal(r.status, 200, r.text);
    const ents = items.map((it) => mine(store, 'entitlements', a).find((e) => e.key === it.key));
    await fn({ base, a, gw, store, ents, b: tools(store, { fetch: gw }) });
  });
}
const refundLines = (store, a, e) => mine(store, 'ledger', a).filter((l) => l.type === 'refund' && l.entitlement === e.id);

test('N6 admin refund: an unused card-paid package is refunded to the card, written as refunding before the provider is called; every other package is refused with no provider call', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'billing-settle-')), 'store.json');
  const disk = () => JSON.parse(readFileSync(file, 'utf8'));
  const atCall = [];
  const gw = gateway();
  gw.refund = (call) => {
    const e = disk().entitlements[call.body['metadata[entitlement]']];
    atCall.push({ status: e && e.status, key: call.headers['Idempotency-Key'], form: call.body });
    return refundDone(call);
  };
  const items = ['k1', 'k2', 'k3', 'k6', 'k7', 'k8'].map((key) => ({ key, tier: key === 'k6' ? 'full' : 'identity' }));
  await shop(items, async ({ base, a, store, ents: [paid, used, back, big, begun, gone], b }) => {
    b.consume(used.id, 'invt_used');
    // k1 (paid) and k2 (consumed, not started): refunded to the card.
    for (const e of [paid, used]) {
      const r = await refundIt(base, e.id);
      assert.equal(r.status, 200, r.text);
      assert.deepEqual(r.body, { refunded: true, cents: 1900 });
      const seen = atCall[atCall.length - 1];
      assert.equal(seen.status, 'refunding', 'the stored file held refunding when the provider was called');
      assert.deepEqual([seen.form.payment_intent, seen.form.amount, seen.form['metadata[entitlement]']], [e.chargeRef, '1900', e.id]);
      assert.match(String(seen.key), /^[0-9a-f]{64}$/, 'an idempotency key was sent');
      assert.equal(store.get('entitlements', e.id).status, 'refunded');
      assert.deepEqual(refundLines(store, a, e).map((l) => [l.type, l.by, l.cents, l.refundRef]), [['refund', 'card', 1900, `re_admin_${refundN}`]]);
    }
    assert.notEqual(atCall[0].key, atCall[1].key);
    // k3 returned as credit, its credit still in the balance: refunded, and its credit removed with one line.
    assert.equal(b.release(back.id), true);
    assert.equal(creditOf(store, a), 1900);
    const r3 = await refundIt(base, back.id);
    assert.equal(r3.status, 200, r3.text);
    assert.equal(atCall[atCall.length - 1].status, 'refunding');
    assert.equal(store.get('entitlements', back.id).status, 'refunded');
    assert.deepEqual(refundLines(store, a, back).map((l) => [l.by, l.cents]), [['card', 1900], ['credit', 1900]]);
    assert.equal(creditOf(store, a), 0);

    // Refused, each with no provider call: one paid by credit, a credited one whose credit was spent, one started, one
    // refunded by the provider's own delivery, one disputed, and one whose check is starting.
    assert.equal(b.release(big.id), true);
    assert.equal((await buy(base, a.token, [{ key: 'k4', tier: 'identity' }])).status, 200);
    const byCredit = b.find(a.id, 'k4');
    assert.equal(byCredit.by, 'credit');
    assert.equal(creditOf(store, a), 8000, 'part of the credited full package was spent');
    b.consume(begun.id, 'invt_begun');
    assert.equal(b.started(begun.id), true);
    gw.read = () => chargeRead(gone.chargeRef, { amount: 19400, amount_refunded: 1900, refunds: { object: 'list', data: [{ id: 're_dash1', amount: 1900, status: 'succeeded', metadata: { entitlement: gone.id } }] } });
    assert.equal((await deliver(base, refundEvent('evt_dash_refund'))).status, 200);
    assert.equal(store.get('entitlements', gone.id).status, 'refunded');
    // A full package costs more than the credit left, so it goes to the card, on a charge of its own.
    assert.equal((await buy(base, a.token, [{ key: 'k9', tier: 'full' }])).status, 200);
    const contested = b.find(a.id, 'k9');
    assert.equal(contested.by, 'card');
    gw.read = () => chargeRead(contested.chargeRef, { id: 'ch_k9', amount: 9900, disputed: true });
    assert.equal((await deliver(base, JSON.stringify(Object.assign(copy(fx('webhook-dispute').reply), { id: 'evt_k9_dispute', data: { object: Object.assign(copy(fx('webhook-dispute').reply.data.object), { charge: 'ch_k9' }) } })))).status, 200);
    assert.equal(store.get('entitlements', contested.id).status, 'disputed');
    const calls = gw.refunds().length;
    for (const [why, e] of [['paid by credit', byCredit], ['credit spent', big], ['started', begun], ['refunded by the provider', gone], ['disputed', contested]]) {
      const before = held(store);
      const r = await refundIt(base, e.id);
      assert.equal(r.status, 409, `${why}: ${r.text}`);
      assert.deepEqual(r.body, NOT_ALLOWED, why);
      assert.equal(held(store), before, why);
    }
    assert.equal(gw.refunds().length, calls, 'no provider call for any of them');
    // A check starting on a package (a hold, on the module's own functions): refused too.
    const k10 = (await buy(base, a.token, [{ key: 'k10', tier: 'identity' }]), b.find(a.id, 'k10'));
    b.consume(k10.id, 'invt_k10');
    const finish = b.hold(k10.id);
    await assert.rejects(b.refund(k10.id), (err) => err.status === 409 && err.code === 'refund_not_allowed');
    finish(false);
    assert.equal(gw.refunds().length, calls);
    const unknown = await refundIt(base, 'ent_doesNotExist1');
    assert.equal(unknown.status, 404, unknown.text);
  }, { gw, store: openStore(file) });
});

test('N6 admin refund refused and unknown: a refusal puts the package back and the next try uses a new key; an unknown outcome stays refunding and is repeated with the same key', async () => {
  const gw = gateway();
  const answers = [];
  gw.refund = (call) => answers.shift()(call);
  await shop([{ key: 'k1', tier: 'identity' }, { key: 'k2', tier: 'identity' }], async ({ base, a, store, ents: [e1, e2], b }) => {
    const keys = () => gw.refunds().map((c) => c.headers['Idempotency-Key']);
    // Refusals: the card's refusal (402), a request refused (400), a refund answered as failed.
    for (const [why, answer] of [['402', () => ({ status: 402, body: { error: { code: 'charge_disputed' } } })], ['400', () => ({ status: 400, body: { error: { code: 'charge_already_refunded' } } })], ['failed', (call) => Object.assign(refundDone(call), { status: 'failed' })]]) {
      answers.push(answer);
      const r = await refundIt(base, e1.id);
      assert.equal(r.status, 409, `${why}: ${r.text}`);
      assert.deepEqual(r.body, REFUSED, why);
      assert.equal(store.get('entitlements', e1.id).status, 'paid', why);
      assert.equal(refundLines(store, a, e1).length, 0, why);
    }
    assert.equal(new Set(keys()).size, 3, 'each try after a refusal carries a new key');

    // Unknown outcomes: no answer, a 500, a refund still pending. The package stays refunding: never usable.
    for (const [why, answer] of [['thrown', () => Promise.reject(new Error('timed out'))], ['500', () => ({ status: 500, body: { error: {} } })], ['pending', (call) => Object.assign(refundDone(call), { status: 'pending' })]]) {
      answers.push(answer);
      const r = await refundIt(base, e1.id);
      assert.equal(r.status, 409, `${why}: ${r.text}`);
      assert.deepEqual(r.body, UNSURE, why);
      assert.equal(b.find(a.id, 'k1').status, 'refunding', why);
      assert.equal(b.release(e1.id), false, why);
      assert.throws(() => b.consume(e1.id, 'invt_1'), (err) => err.status === 409, why);
    }
    const k = keys();
    assert.equal(k[3], k[4], 'the repeat after an unknown outcome carries the same key');
    assert.equal(k[4], k[5]);
    assert.notEqual(k[3], k[2]);
    answers.push(refundDone);
    const ok = await refundIt(base, e1.id);
    assert.equal(ok.status, 200, ok.text);
    assert.equal(keys()[6], k[3]);
    assert.equal(store.get('entitlements', e1.id).status, 'refunded');
    assert.equal(refundLines(store, a, e1).length, 1);

    // A credited package refused: its credit is put back.
    assert.equal(b.release(e2.id), true);
    answers.push(() => ({ status: 402, body: { error: {} } }));
    assert.deepEqual((await refundIt(base, e2.id)).body, REFUSED);
    assert.equal(store.get('entitlements', e2.id).status, 'credited');
    assert.equal(creditOf(store, a), 1900);
    assert.equal(refundLines(store, a, e2).length, 0);
  }, { gw });
});

test('N6 admin refund then delivery: the provider’s delivery of the operator’s own refund adds no second line; one confirmed only by the delivery is refunded once', async () => {
  const gw = gateway();
  await shop([{ key: 'k1', tier: 'identity' }, { key: 'k2', tier: 'identity' }], async ({ base, a, store, ents: [e1, e2], b }) => {
    gw.refund = refundDone;
    assert.equal((await refundIt(base, e1.id)).status, 200);
    const ref1 = refundLines(store, a, e1)[0].refundRef;
    const listed = [{ id: ref1, amount: 1900, status: 'succeeded', metadata: { entitlement: e1.id } }];
    gw.read = () => chargeRead(e1.chargeRef, { amount: 3800, amount_refunded: 1900, refunds: { object: 'list', data: listed } });
    assert.equal((await deliver(base, refundEvent('evt_admin_refund1'))).status, 200);
    assert.equal(refundLines(store, a, e1).length, 1, 'one refund line, not two');

    // The second refund's outcome is unknown; the provider's delivery then lists it: refunded once, and the operator's
    // repeat changes nothing and calls nobody.
    gw.refund = () => Promise.reject(new Error('timed out'));
    assert.deepEqual((await refundIt(base, e2.id)).body, UNSURE);
    listed.push({ id: 're_late2', amount: 1900, status: 'succeeded', metadata: { entitlement: e2.id } });
    gw.read = () => chargeRead(e1.chargeRef, { amount: 3800, amount_refunded: 3800, refunded: true, refunds: { object: 'list', data: listed } });
    assert.equal((await deliver(base, refundEvent('evt_admin_refund2'))).status, 200);
    assert.equal(store.get('entitlements', e2.id).status, 'refunded');
    assert.deepEqual(refundLines(store, a, e2).map((l) => [l.by, l.cents, l.refundRef]), [['card', 1900, 're_late2']]);
    const calls = gw.refunds().length;
    const before = held(store);
    const again = await refundIt(base, e2.id);
    assert.equal(again.status, 200, again.text);
    assert.deepEqual(again.body, { refunded: true, cents: 1900 });
    assert.equal(gw.refunds().length, calls);
    assert.equal(held(store), before);
    assert.equal(mine(store, 'ledger', a).filter((l) => l.type === 'refund').length, 2);
    assert.equal(b.find(a.id, 'k2').status, 'refunded');
  }, { gw });
});

test('W7 admin only: the refund route is off without ADMIN_TOKEN and answers 401 to every other token and to any invitation token header', async () => {
  const off = gateway();
  await start({ fetch: off, env: { ADMIN_TOKEN: '' } }, async (base) => {
    const r = await refundIt(base, 'ent_x', { bearer: 'anything' });
    assert.equal(r.status, 404, r.text);
  });
  const gw = gateway();
  gw.refund = refundDone;
  await shop([{ key: 'k1', tier: 'identity' }], async ({ base, a, store, ents: [e] }) => {
    const tables = () => JSON.stringify({ e: store.list('entitlements'), l: store.list('ledger'), b: store.list('billing') });
    const before = tables();
    for (const [why, opts] of [['a wrong token', { bearer: 'operator-admin-token-wrong-000000' }], ['the account’s own token', { bearer: a.token }], ['an invitation token', { bearer: 'invite-token-0123456789abcdef', invite: 'invite-token-0123456789abcdef' }], ['ADMIN_TOKEN beside an invitation token', { bearer: ADMIN, invite: 'invite-token-0123456789abcdef' }], ['no token', { bearer: '' }]]) {
      const r = await refundIt(base, e.id, opts);
      assert.equal(r.status, 401, `${why}: ${r.text}`);
      assert.equal(tables(), before, why);
    }
    assert.equal(gw.refunds().length, 0);
    const get = await j(base, 'GET', '/billing/admin/refund', { bearer: ADMIN });
    assert.equal(get.status, 405, get.text);
    assert.equal(tables(), before);
    assert.equal((await refundIt(base, e.id)).status, 200, 'with ADMIN_TOKEN alone it is refunded');
  }, { gw });
});

test('W6 no vendor text: refund and payment read-back replies holding the vendor’s name, domain and secrets reach no reply, event or log line', async () => {
  const loudText = `${VENDOR} says no: key ${SECRET} signing ${WHSEC} at https://api.${VENDOR}.com/v1`;
  const loud = (status) => ({ status, body: { error: { type: 'api_error', code: 'x', message: loudText, doc_url: `https://${VENDOR}.com/docs` } } });
  const noisy = { description: loudText, receipt_url: `https://pay.${VENDOR}.com/receipts/x`, failure_message: loudText, last_payment_error: { message: loudText } };
  const replies = [];
  const lines = [];
  const real = { error: console.error, log: console.log, warn: console.warn };
  for (const k of Object.keys(real)) console[k] = (...args) => lines.push(args.map(String).join(' '));
  let store;
  try {
    await lost(async ({ base, a, gw, store: s, pay }) => {
      store = s;
      const k2 = mine(s, 'entitlements', a).find((e) => e.key === 'k2');
      const answers = [() => loud(402), () => loud(500), () => Promise.reject(new Error(`connect to api.${VENDOR}.com refused (${SECRET})`)), (call) => Object.assign(refundDone(call), noisy, { status: 'failed' }), (call) => Object.assign(refundDone(call), noisy)];
      gw.refund = (call) => answers.shift()(call);
      for (let i = 0; i < 5; i++) replies.push((await refundIt(base, k2.id)).text);
      const reads = [() => loud(500), () => Promise.reject(new Error(`read from api.${VENDOR}.com refused (${SECRET})`)), () => Object.assign(failedRead(pay), noisy), () => Object.assign(paymentRead(pay), noisy)];
      for (let i = 0; i < reads.length; i++) {
        gw.payRead = reads[i];
        const ev = JSON.parse(paymentEvent('webhook-payment-succeeded', { id: `evt_loud_${i}` }));
        Object.assign(ev.data.object, noisy);
        replies.push((await deliver(base, JSON.stringify(ev))).text);
      }
      assert.equal(s.get('payments', pay.id).status, 'failed');
      assert.equal(s.get('entitlements', k2.id).status, 'refunded');
    });
  } finally {
    Object.assign(console, real);
  }
  assert.deepEqual(replies.slice(0, 5).map((t) => JSON.parse(t)), [REFUSED, UNSURE, UNSURE, REFUSED, { refunded: true, cents: 1900 }]);
  assert.deepEqual(replies.slice(5, 7).map((t) => JSON.parse(t)), [{ error: 'The payment could not be checked. Try again later.' }, { error: 'The payment could not be checked. Try again later.' }]);
  for (const text of [...replies, JSON.stringify(store.data().events), ...lines]) {
    const low = text.toLowerCase();
    assert.ok(!low.includes(VENDOR), `the vendor is named in: ${text.slice(0, 200)}`);
    assert.ok(!text.includes(SECRET) && !low.includes('sk_test'), `the secret key is in: ${text.slice(0, 200)}`);
    assert.ok(!text.includes(WHSEC) && !low.includes('whsec'), `the delivery secret is in: ${text.slice(0, 200)}`);
  }
});

test('credit owed: credit already spent and then refunded or disputed is owed; while owed, no new package is paid; returned credit settles it first', async () => {
  for (const how of ['refund', 'dispute']) {
    await shop([{ key: 'k1', tier: 'identity' }], async ({ base, a, gw, store, ents: [e1], b }) => {
      assert.equal(b.release(e1.id), true);
      assert.deepEqual((await buy(base, a.token, [{ key: 'k2', tier: 'identity' }])).body, { paid: ['k2'], chargedCents: 0, creditUsedCents: 1900 }, how);
      assert.equal(creditOf(store, a), 0);
      // The first charge's money goes back (or is contested): the credit it gave was already spent on k2.
      gw.read = () => chargeRead(e1.chargeRef, how === 'refund' ? { amount: 1900, amount_refunded: 1900, refunded: true } : { amount: 1900, disputed: true });
      const raw = how === 'refund' ? refundEvent('evt_owed_refund') : JSON.stringify(Object.assign(copy(fx('webhook-dispute').reply), { id: 'evt_owed_dispute' }));
      assert.equal((await deliver(base, raw)).status, 200, how);
      const v = await view(base, a.token);
      assert.equal(v.creditCents, 0, how);
      assert.equal(v.owedCents, 1900, `${how}: the spent credit is owed`);
      const charges = gw.charges().length;
      const r = await buy(base, a.token, [{ key: 'k3', tier: 'identity' }]);
      assert.equal(r.status, 409, `${how}: ${r.text}`);
      assert.deepEqual(r.body, OWED, how);
      assert.equal(gw.charges().length, charges, `${how}: no provider call`);
      assert.equal(b.find(a.id, 'k3'), null, how);
      // A key already paid is not a new package: asking for it again still answers, with nothing charged.
      assert.deepEqual((await buy(base, a.token, [{ key: 'k2', tier: 'identity' }])).body, { paid: ['k2'], chargedCents: 0, creditUsedCents: 0 }, how);
      // Credit that comes back pays what is owed first; then packages can be paid again.
      assert.equal(b.release(b.find(a.id, 'k2').id), true);
      const after = await view(base, a.token);
      assert.deepEqual([after.creditCents, after.owedCents], [0, 0], how);
      const ok = await buy(base, a.token, [{ key: 'k3', tier: 'identity' }]);
      assert.equal(ok.status, 200, `${how}: ${ok.text}`);
      assert.equal(ok.body.chargedCents, 1900, how);
    });
  }
});

test('R10 refund counted once: a charge partly refunded with an unmatched refund and later wholly refunded counts the refunded total once', async () => {
  await shop([{ key: 'k1', tier: 'identity' }, { key: 'k2', tier: 'identity' }], async ({ base, a, gw, store, ents: [e1, e2] }) => {
    const loose = { id: 're_loose1', amount: 500, status: 'succeeded', metadata: {} };
    gw.read = () => chargeRead(e1.chargeRef, { amount: 3800, amount_refunded: 500, refunds: { object: 'list', data: [loose] } });
    assert.equal((await deliver(base, refundEvent('evt_r10_partial'))).status, 200);
    gw.read = () => chargeRead(e1.chargeRef, { amount: 3800, amount_refunded: 3800, refunded: true, refunds: { object: 'list', data: [loose, { id: 're_rest1', amount: 3300, status: 'succeeded', metadata: {} }] } });
    assert.equal((await deliver(base, refundEvent('evt_r10_full'))).status, 200);
    assert.equal(store.get('entitlements', e1.id).status, 'refunded');
    assert.equal(store.get('entitlements', e2.id).status, 'refunded');
    const card = mine(store, 'ledger', a).filter((l) => l.type === 'refund' && l.by === 'card');
    assert.equal(card.reduce((n, l) => n + l.cents, 0), 3800, `the charge's 3800 once: ${JSON.stringify(card.map((l) => l.cents))}`);
  });
});
