// The payment provider's deliveries (plan 08-14): refunds and disputes reach the sponsor's packages only when the
// delivery's signature over the exact bytes is good, its signed time is fresh, and the provider's own record of the
// charge, read back with the secret key, says so. A refunded or contested package and any credit from it can no longer
// be used. The hold keeps a cancel from crediting a package whose check is starting. Every reply from the provider is a
// recorded fixture answered by a fetch stand-in: no payment account exists and none is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac, createHash } from 'node:crypto';
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
const UNCHECKED = { error: 'The payment could not be checked. Try again later.' };

// The delivery's signature header, exactly as ASSUMED describes it (never a header name written here).
const WEBHOOK = ASSUMED.webhook || { header: 'x-not-built-yet' };
const sigValue = ASSUMED.signatureValue || ((ts, hex) => `t=${ts},v1=${hex}`);
const nowSeconds = () => Math.floor(Date.now() / 1000);
function signed(raw, { ts = nowSeconds(), secret = WHSEC } = {}) {
  return { [WEBHOOK.header]: sigValue(ts, createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex')) };
}

/**
 * The payment provider's stand-in: the routes 08-04's code calls, plus the read-back of a charge. read(call) answers the
 * read-back; a handler that throws stands for a call whose outcome is unknown (a timeout or a dropped connection).
 */
function gateway(over = {}) {
  let n = 0;
  const ok = (call) => Object.assign({}, fx('charge-succeeded').reply, { id: `pi_fixture_${++n}`, amount: Number(call.body.amount) });
  const f = mockFetch([
    ['POST', /\/v1\/customers$/, () => fx('customer-created').reply],
    ['POST', /\/v1\/setup_intents$/, () => fx('setup-created').reply],
    ['GET', /\/v1\/setup_intents\/[^/]+$/, () => fx('setup-succeeded').reply],
    ['GET', /\/v1\/payment_methods\/[^/]+$/, () => fx('payment-method').reply],
    ['POST', /\/v1\/payment_intents$/, over.charge ? (call) => over.charge(call, ok) : ok],
    ['GET', /\/v1\/charges\/[^/?]+(\?.*)?$/, (call) => f.read(call)]
  ]);
  f.read = over.read || (() => fx('charge-read').reply);
  f.reads = () => f.calls.filter((c) => c.method === 'GET' && /\/v1\/charges\//.test(c.url));
  return f;
}

/** A server with ADMIN_TOKEN, both payment keys, the delivery secret, one portal origin and no rate limit. */
const start = ({ env, fetch: fetchImpl, now, store } = {}, fn) =>
  withServer({ env: Object.assign({ ADMIN_TOKEN: ADMIN, PUBLIC_URL: PUBLIC, PORTAL_ORIGIN: PORTAL, BILLING_SECRET_KEY: SECRET, BILLING_PUBLISHABLE_KEY: PUBKEY, BILLING_WEBHOOK_SECRET: WHSEC, RATE_LIMIT_PER_MIN: '0' }, env), fetch: fetchImpl, now, store }, fn);
/** This module's own functions on a server's store (what the invitation code calls). */
const tools = (store, { now, env, fetch: fetchImpl } = {}) =>
  createBilling({ env: Object.assign({ BILLING_SECRET_KEY: SECRET, BILLING_PUBLISHABLE_KEY: PUBKEY, BILLING_WEBHOOK_SECRET: WHSEC }, env), store, fetch: fetchImpl || gateway(), now: now || (() => T0), providers: {}, publicUrl: PUBLIC, origins: [PORTAL] });

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

/** Post raw bytes to the delivery route, exactly as given. */
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
/** A delivery from a recorded one: its event id, and the charge and payment its object names. */
function event(name, { id, charge = 'ch_fixture1', payment, type } = {}) {
  const ev = copy(fx(name).reply);
  if (id !== undefined) ev.id = id;
  if (type) ev.type = type;
  const obj = ev.data.object;
  if (obj.object === 'dispute') obj.charge = charge;
  else obj.id = charge;
  if (payment) obj.payment_intent = payment;
  return JSON.stringify(ev);
}
/** The charge as the provider reads it back. */
function charge(payment, patch = {}) {
  return Object.assign(copy(fx('charge-read').reply), { payment_intent: payment }, patch);
}
const mine = (store, table, a) => store.list(table).filter((x) => x.account === a.id);
const creditOf = (store, a) => (store.get('billing', a.id) || {}).creditCents || 0;
/** Everything a delivery could change: packages, ledger, billing records and the seen list. */
const money = (store) => JSON.stringify({ e: store.list('entitlements'), l: store.list('ledger'), b: store.list('billing'), s: store.data().seen });

test('tracer: a signed full-refund delivery is verified, the charge is read back, and the refund reaches the sponsor’s charges', async () => {
  const gw = gateway();
  const store = openStore(null);
  const refundLinesAtRead = [];
  await start({ fetch: gw, store, now: () => T0 }, async (base) => {
    const a = await account(base, 'alpha');
    await saveCard(base, a.token);
    assert.equal((await buy(base, a.token, [{ key: 'k1', tier: 'identity' }])).status, 200);
    const e = mine(store, 'entitlements', a)[0];
    assert.equal(e.status, 'paid');
    assert.match(e.chargeRef, /^pi_/);

    gw.read = (call) => {
      refundLinesAtRead.push(store.list('ledger').filter((l) => l.type === 'refund').length);
      return charge(e.chargeRef, { id: new URL(call.url).pathname.split('/').pop(), amount: 1900, amount_refunded: 1900, refunded: true });
    };
    const raw = event('webhook-refunded', { payment: e.chargeRef });
    const r = await deliver(base, raw);
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { received: true });

    // The provider's own record was read once, with the secret key, before any refund line existed.
    assert.equal(gw.reads().length, 1);
    assert.deepEqual(refundLinesAtRead, [0]);
    assert.equal(gw.reads()[0].headers.Authorization, `Bearer ${SECRET}`);
    assert.match(new URL(gw.reads()[0].url).pathname, /\/charges\/ch_fixture1$/);

    assert.equal(store.get('entitlements', e.id).status, 'refunded');
    const refunds = mine(store, 'ledger', a).filter((l) => l.type === 'refund');
    assert.equal(refunds.length, 1);
    assert.deepEqual({ type: refunds[0].type, by: refunds[0].by, cents: refunds[0].cents, entitlement: refunds[0].entitlement }, { type: 'refund', by: 'card', cents: 1900, entitlement: e.id });

    const view = await j(base, 'GET', '/v1/billing', { bearer: a.token });
    assert.equal(view.status, 200, view.text);
    assert.ok(view.body.charges.some((c) => c.type === 'refund' && c.by === 'card' && c.cents === 1900 && c.tier === 'identity'), view.text);

    const b = tools(store, { now: () => T0 });
    assert.equal(b.find(a.id, 'k1').status, 'refunded');
    assert.equal(b.release(e.id), false, 'a refunded package is never credited');
    assert.equal(creditOf(store, a), 0);
  });
});
