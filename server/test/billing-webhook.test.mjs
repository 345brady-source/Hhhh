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
function event(name, { id, noId, charge = 'ch_fixture1', payment, type } = {}) {
  const ev = copy(fx(name).reply);
  if (id !== undefined) ev.id = id;
  if (noId) delete ev.id;
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
/** The money alone: packages, ledger and billing records. */
const held = (store) => JSON.stringify({ e: store.list('entitlements'), l: store.list('ledger'), b: store.list('billing') });
/** A server, an account with a card on file, and the packages it bought (one card charge for the list). */
async function shop(items, fn, { env, gw = gateway(), store = openStore(null) } = {}) {
  await start({ fetch: gw, store, env, now: () => T0 }, async (base) => {
    const a = await account(base, 'alpha');
    await saveCard(base, a.token);
    let ents = [];
    if (items.length) {
      const r = await buy(base, a.token, items);
      assert.equal(r.status, 200, r.text);
      ents = items.map((it) => mine(store, 'entitlements', a).find((e) => e.key === it.key));
    }
    await fn({ base, a, gw, store, ents, b: tools(store, { now: () => T0 }) });
  });
}
const lines = (store, a, pred = () => true) => mine(store, 'ledger', a).filter(pred);
const pick = (l) => ({ type: l.type, by: l.by, cents: l.cents, entitlement: l.entitlement });
const eventsOf = (store, type) => store.data().events.filter((e) => e.type === type);

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

const ONE = [{ key: 'k1', tier: 'identity' }];
/** The charge read back as wholly refunded. */
const fullRead = (payment, cents) => charge(payment, { amount: cents, amount_refunded: cents, refunded: true });

test('N5 forged: a wrong signature, a stale time, a changed byte and no signature answer 401 and change nothing; without the secret the route is 404', async () => {
  await shop(ONE, async ({ base, gw, store, ents: [e] }) => {
    gw.read = () => fullRead(e.chargeRef, 1900);
    const raw = event('webhook-refunded', { payment: e.chargeRef });
    const before = money(store);
    const eventsBefore = store.data().events.length;
    const tries = [
      ['wrong signature', raw, signed(raw, { secret: 'whsec_someoneElse0123456789' })],
      ['signed 400 seconds ago', raw, signed(raw, { ts: nowSeconds() - 400 })],
      ['one byte changed after signing', raw.replace('evt_fixture_refund1', 'evt_fixture_refund2'), signed(raw)],
      ['no signature header', raw, {}]
    ];
    for (const [why, body, headers] of tries) {
      const r = await deliver(base, body, headers);
      assert.equal(r.status, 401, `${why}: ${r.text}`);
      assert.deepEqual(r.body, { error: 'Bad signature' }, why);
    }
    const added = store.data().events.slice(eventsBefore);
    assert.equal(added.length, 4);
    for (const ev of added) {
      assert.deepEqual(Object.keys(ev).sort(), ['at', 'provider', 'type']);
      assert.deepEqual({ type: ev.type, provider: ev.provider }, { type: 'webhook_rejected', provider: 'billing' });
    }
    assert.equal(money(store), before, 'packages, ledger, billing and the seen list are unchanged');
    assert.equal(gw.reads().length, 0, 'nothing was read back');
    assert.equal(store.get('entitlements', e.id).status, 'paid');
  });
  const gw = gateway();
  const store = openStore(null);
  await start({ fetch: gw, store, env: { BILLING_WEBHOOK_SECRET: '' } }, async (base) => {
    const raw = event('webhook-refunded', { payment: 'pi_fixture_1' });
    const r = await deliver(base, raw);
    assert.equal(r.status, 404, r.text);
    assert.equal(gw.reads().length, 0);
    assert.equal(store.data().seen.length, 0);
  });
});

test('N5 replay: the same delivery twice is acted on once; a delivery with no event id is known by the SHA-256 of its bytes', async () => {
  await shop(ONE, async ({ base, a, gw, store, ents: [e1] }) => {
    gw.read = () => fullRead(e1.chargeRef, 1900);
    const raw = event('webhook-refunded', { payment: e1.chargeRef });
    assert.deepEqual((await deliver(base, raw)).body, { received: true });
    const again = await deliver(base, raw);
    assert.equal(again.status, 200);
    assert.deepEqual(again.body, { received: true, duplicate: true });
    assert.equal(gw.reads().length, 1, 'the repeat was not read back');
    assert.equal(lines(store, a, (l) => l.type === 'refund').length, 1);

    // A second package on its own charge, refunded by a delivery that carries no event id.
    assert.equal((await buy(base, a.token, [{ key: 'k2', tier: 'identity' }])).status, 200);
    const e2 = mine(store, 'entitlements', a).find((e) => e.key === 'k2');
    gw.read = () => fullRead(e2.chargeRef, 1900);
    const bare = event('webhook-refunded', { payment: e2.chargeRef, noId: true });
    assert.deepEqual((await deliver(base, bare)).body, { received: true });
    assert.ok(store.data().seen.includes(`billing:${createHash('sha256').update(bare).digest('hex')}`), 'recorded by the hash of its bytes');
    assert.deepEqual((await deliver(base, bare)).body, { received: true, duplicate: true });
    assert.equal(gw.reads().length, 2);
    assert.equal(lines(store, a, (l) => l.type === 'refund').length, 2);
    assert.equal(store.get('entitlements', e2.id).status, 'refunded');
  });
});

test('N5 read-back fails: a read-back that times out answers 503 and records nothing; the provider’s retry is acted on once', async () => {
  await shop(ONE, async ({ base, a, gw, store, ents: [e] }) => {
    gw.read = () => {
      throw new Error('timed out');
    };
    const raw = event('webhook-refunded', { payment: e.chargeRef });
    const before = money(store);
    const r = await deliver(base, raw);
    assert.equal(r.status, 503, r.text);
    assert.deepEqual(r.body, UNCHECKED);
    assert.equal(money(store), before, 'packages, ledger, billing and the seen list are unchanged');
    assert.equal(store.data().seen.length, 0);

    gw.read = () => fullRead(e.chargeRef, 1900);
    const retry = await deliver(base, raw);
    assert.equal(retry.status, 200, retry.text);
    assert.deepEqual(retry.body, { received: true });
    assert.equal(lines(store, a, (l) => l.type === 'refund').length, 1);
    assert.equal(store.get('entitlements', e.id).status, 'refunded');
    assert.deepEqual((await deliver(base, raw)).body, { received: true, duplicate: true });
    assert.equal(lines(store, a, (l) => l.type === 'refund').length, 1);
  });
});

test('N5 body not trusted: only the read-back changes money; an event type not acted on and a charge this server never made change nothing', async () => {
  await shop(ONE, async ({ base, gw, store, ents: [e] }) => {
    const before = held(store);
    // The body says refunded; the provider's own record says it is not.
    gw.read = () => charge(e.chargeRef, { amount: 1900, amount_refunded: 0, refunded: false });
    const r = await deliver(base, event('webhook-refunded', { id: 'evt_body_lies', payment: e.chargeRef }));
    assert.equal(r.status, 200, r.text);
    assert.equal(gw.reads().length, 1);
    assert.equal(held(store), before);
    assert.equal(store.get('entitlements', e.id).status, 'paid');

    // An event of a type this module does not act on: not read back, nothing written.
    const other = await deliver(base, event('webhook-refunded', { id: 'evt_other_type', payment: e.chargeRef, type: 'something.else' }));
    assert.equal(other.status, 200, other.text);
    assert.equal(gw.reads().length, 1);
    assert.equal(held(store), before);

    // A charge no package of this server carries, read back as wholly refunded: nothing written.
    gw.read = () => fullRead('pi_someoneElse9', 1900);
    const stranger = await deliver(base, event('webhook-refunded', { id: 'evt_stranger', payment: 'pi_someoneElse9' }));
    assert.equal(stranger.status, 200, stranger.text);
    assert.equal(gw.reads().length, 2);
    assert.equal(held(store), before);
    assert.equal(eventsOf(store, 'refund_unmatched').length, 0);
  });
});

test('N6 full refund: every package on a wholly refunded charge is refunded, a credited one loses its credit, and a second delivery writes nothing', async () => {
  const items = [{ key: 'k1', tier: 'identity' }, { key: 'k2', tier: 'identity' }, { key: 'k3', tier: 'identity' }];
  await shop(items, async ({ base, a, gw, store, ents: [paid, used, back], b }) => {
    assert.equal(new Set([paid.chargeRef, used.chargeRef, back.chargeRef]).size, 1, 'one card charge for the three');
    b.consume(used.id, 'inv_used');
    assert.equal(b.release(back.id), true);
    assert.equal(creditOf(store, a), 1900);

    gw.read = () => fullRead(paid.chargeRef, 5700);
    assert.deepEqual((await deliver(base, event('webhook-refunded', { payment: paid.chargeRef }))).body, { received: true });
    for (const e of [paid, used, back]) {
      assert.equal(store.get('entitlements', e.id).status, 'refunded', e.key);
      assert.deepEqual(lines(store, a, (l) => l.type === 'refund' && l.by === 'card' && l.entitlement === e.id).map(pick), [{ type: 'refund', by: 'card', cents: 1900, entitlement: e.id }], e.key);
    }
    assert.deepEqual(lines(store, a, (l) => l.type === 'refund' && l.by === 'credit').map(pick), [{ type: 'refund', by: 'credit', cents: 1900, entitlement: back.id }]);
    assert.equal(creditOf(store, a), 0);
    assert.equal(b.release(back.id), false);
    assert.equal(eventsOf(store, 'refund_unmatched').length, 0);

    const count = mine(store, 'ledger', a).length;
    const before = held(store);
    assert.deepEqual((await deliver(base, event('webhook-refunded', { id: 'evt_fixture_refund_again', payment: paid.chargeRef }))).body, { received: true });
    assert.equal(mine(store, 'ledger', a).length, count);
    assert.equal(held(store), before);
  });
});

test('N6 partial refund: a refund naming its package refunds that one only; an unmatched refund is one line and refund_unmatched; the same refunds again write nothing', async () => {
  const items = [{ key: 'k1', tier: 'identity' }, { key: 'k2', tier: 'identity' }];
  await shop(items, async ({ base, a, gw, store, ents: [e1, e2] }) => {
    const matched = { id: 're_fixture1', amount: 1900, status: 'succeeded', metadata: { entitlement: e1.id } };
    gw.read = () => charge(e1.chargeRef, { amount: 3800, amount_refunded: 1900, refunded: false, refunds: { object: 'list', data: [matched] } });
    assert.deepEqual((await deliver(base, event('webhook-refunded', { id: 'evt_partial1', payment: e1.chargeRef }))).body, { received: true });
    assert.equal(store.get('entitlements', e1.id).status, 'refunded');
    assert.equal(store.get('entitlements', e2.id).status, 'paid');
    const first = lines(store, a, (l) => l.type === 'refund');
    assert.deepEqual(first.map((l) => [l.by, l.cents, l.entitlement, l.refundRef]), [['card', 1900, e1.id, 're_fixture1']]);

    const unmatched = { id: 're_fixture2', amount: 500, status: 'succeeded', metadata: {} };
    const failed = { id: 're_fixture3', amount: 700, status: 'failed', metadata: { entitlement: e2.id } };
    gw.read = () => charge(e1.chargeRef, { amount: 3800, amount_refunded: 2400, refunded: false, refunds: { object: 'list', data: [unmatched, matched, failed] } });
    assert.deepEqual((await deliver(base, event('webhook-refunded', { id: 'evt_partial2', payment: e1.chargeRef }))).body, { received: true });
    const second = lines(store, a, (l) => l.type === 'refund');
    assert.equal(second.length, 2);
    const loose = second.find((l) => l.refundRef === 're_fixture2');
    assert.deepEqual([loose.by, loose.cents, loose.entitlement, loose.type], ['card', 500, null, 'refund']);
    assert.equal(store.get('entitlements', e2.id).status, 'paid', 'an unmatched or failed refund changes no package');
    assert.deepEqual(eventsOf(store, 'refund_unmatched').map((ev) => Object.keys(ev).sort()), [['account', 'at', 'type']]);
    assert.equal(eventsOf(store, 'refund_unmatched')[0].account, a.id);

    const before = held(store);
    assert.deepEqual((await deliver(base, event('webhook-refunded', { id: 'evt_partial3', payment: e1.chargeRef }))).body, { received: true });
    assert.equal(held(store), before);
    assert.equal(eventsOf(store, 'refund_unmatched').length, 1);
  });
});

test('N6 dispute: every package on a disputed charge whose check has not started is disputed, credit from it goes (never below 0), and none of it can be used', async () => {
  // One card charge: k1 goes on an invitation, k2's check starts, k3 (full) is returned as credit and part of that
  // credit pays k4, k5 stays paid and on no invitation.
  const items = [{ key: 'k1', tier: 'identity' }, { key: 'k2', tier: 'identity' }, { key: 'k3', tier: 'full' }, { key: 'k5', tier: 'identity' }];
  await shop(items, async ({ base, a, gw, store, ents: [used, begun, back, idle], b }) => {
    assert.equal(new Set([used, begun, back, idle].map((e) => e.chargeRef)).size, 1);
    b.consume(used.id, 'inv_used');
    b.consume(begun.id, 'inv_begun');
    assert.equal(b.started(begun.id), true);
    assert.equal(b.release(back.id), true);
    assert.equal(creditOf(store, a), 9900);
    assert.deepEqual((await buy(base, a.token, [{ key: 'k4', tier: 'identity' }])).body, { paid: ['k4'], chargedCents: 0, creditUsedCents: 1900 });
    assert.equal(creditOf(store, a), 8000, 'the balance is below the credited package’s price');
    const k4 = mine(store, 'entitlements', a).find((e) => e.key === 'k4');

    // The body says a dispute; the provider's own record does not: nothing.
    gw.read = () => charge(used.chargeRef, { amount: 15600, disputed: false });
    const before = held(store);
    assert.equal((await deliver(base, event('webhook-dispute', { id: 'evt_dispute_unconfirmed', payment: used.chargeRef }))).status, 200);
    assert.equal(held(store), before);

    gw.read = () => charge(used.chargeRef, { amount: 15600, disputed: true });
    assert.deepEqual((await deliver(base, event('webhook-dispute', { payment: used.chargeRef }))).body, { received: true });
    assert.equal(store.get('entitlements', used.id).status, 'disputed');
    assert.equal(store.get('entitlements', back.id).status, 'disputed');
    assert.equal(store.get('entitlements', idle.id).status, 'disputed', 'a paid package on no invitation is disputed too');
    assert.equal(store.get('entitlements', begun.id).status, 'consumed', 'a started check is left alone');
    assert.equal(store.get('entitlements', k4.id).status, 'paid', 'a package paid from credit is not on the disputed charge');
    for (const e of [used, back, idle]) assert.deepEqual(lines(store, a, (l) => l.type === 'dispute' && l.by === 'card' && l.entitlement === e.id).map(pick), [{ type: 'dispute', by: 'card', cents: e.cents, entitlement: e.id }], e.key);
    assert.equal(lines(store, a, (l) => l.entitlement === begun.id && l.type === 'dispute').length, 0);
    assert.deepEqual(lines(store, a, (l) => l.type === 'dispute' && l.by === 'credit').map(pick), [{ type: 'dispute', by: 'credit', cents: 8000, entitlement: back.id }]);
    assert.equal(creditOf(store, a), 0, 'the balance goes to 0 and never below');
    const ev = eventsOf(store, 'payment_disputed');
    assert.equal(ev.length, 1);
    assert.deepEqual({ type: ev[0].type, account: ev[0].account, entitlements: ev[0].entitlements }, { type: 'payment_disputed', account: a.id, entitlements: 3 });
    assert.deepEqual(Object.keys(ev[0]).sort(), ['account', 'at', 'entitlements', 'type']);

    // Nothing disputed can be used or credited.
    assert.equal(b.find(a.id, 'k1').status, 'disputed');
    for (const e of [used, back, idle]) assert.equal(b.release(e.id), false, e.key);
    assert.throws(() => b.consume(idle.id, 'inv_new'), (err) => err.status === 409 && err.code === 'package_used');
    assert.equal(creditOf(store, a), 0);
    const view = await j(base, 'GET', '/v1/billing', { bearer: a.token });
    assert.equal(view.body.creditCents, 0);
    assert.equal(view.body.charges.filter((c) => c.type === 'dispute').length, 4);

    const after = held(store);
    assert.deepEqual((await deliver(base, event('webhook-dispute', { id: 'evt_dispute_again', payment: used.chargeRef }))).body, { received: true });
    assert.equal(held(store), after);
    assert.equal(eventsOf(store, 'payment_disputed').length, 1);
  });
});
