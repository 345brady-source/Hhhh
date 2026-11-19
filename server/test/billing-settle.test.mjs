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
