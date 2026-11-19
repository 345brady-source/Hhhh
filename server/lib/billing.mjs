// Card payments for the verification package: a sponsor keeps one card on file and pays for packages before an
// invitation carries one. The card is typed into the payment provider's own field on a page this server hosts, so a card
// number never reaches the portal's pages or this server; only the brand, the last four digits and the expiry are kept.
// The price of a package is this server's setting, by tier, never a figure from a request. The investor never pays.
//
// The money rules, each with a test in test/billing.test.mjs:
//   - a payment is written to the store file, pending, before the provider is called, and its outcome right after;
//   - a call whose outcome is not known (a timeout, an outage) is repeated with the same key and the same form on the
//     next try, so the card is charged once; after 23 hours it is never repeated and is left for a person (unresolved);
//   - a refused charge records no package and leaves the credit alone; the next try is a new payment with a new key;
//   - credit pays whole packages first, the card is charged once for the rest;
//   - a key paid at one level is never accepted at another; a paid package nobody used in 24 hours returns as credit.
import { randomBytes } from 'node:crypto';
import { readRaw, parseJson, send, header } from './http.mjs';
import { requestJson } from './request.mjs';
import { sha256, id } from './crypto.mjs';
import { verify } from '../providers/connector.mjs';

// The payment provider. Its name and addresses stay in these two lines and the card page's own script tag: no JSON
// reply, event, log line or visible text carries them.
const API = 'https://api.stripe.com/v1';
const SCRIPT = 'https://js.stripe.com/v3/';

/**
 * ASSUMED. None of the provider's reference pages could be opened while this was built, so every header, path, field
 * and value the code depends on is in this one block, written from the research's quotes and general knowledge of the
 * interface. Plan 08-12 proves each line against the provider's test mode before a real card is charged.
 */
export const ASSUMED = Object.freeze({
  // Request headers: the secret key as a bearer token; a key that makes a repeated call answer with the first result.
  authorization: (secretKey) => `Bearer ${secretKey}`,
  idempotencyHeader: 'Idempotency-Key',
  // How long the provider remembers a key. REPEAT_MS below stops an hour short of it. Also taken on trust: a repeat
  // with the same key and the same form answers with the first call's saved result (a refusal included) and charges
  // nothing more; a repeat with a different form is an error; a call that never reached the provider runs as new.
  idempotencyKeyHours: 24,
  // Paths under the API base. Bodies are form-encoded; replies are JSON.
  customers: '/customers', // POST → { id }
  setups: '/setup_intents', // POST → { id, client_secret }; GET /:id → { id, status, customer, payment_method }
  methods: '/payment_methods', // GET /:id → { id, card: { brand, last4, exp_month, exp_year } }
  detach: (method) => `/payment_methods/${encodeURIComponent(method)}/detach`, // POST, no body: the card can no longer be charged
  charges: '/payment_intents', // POST → { id, status }
  customerForm: (account) => ({ 'metadata[account]': account }),
  setupForm: (customer) => ({ customer, usage: 'off_session', 'payment_method_types[]': 'card' }),
  // off_session and confirm: charge the saved card now, with nobody at the screen; the call errors when the bank wants
  // the cardholder. metadata[payment] is this server's payment id, so a charge can be matched to its record by hand.
  chargeForm: ({ cents, customer, method, payment }) => ({ amount: String(cents), currency: 'usd', customer, payment_method: method, off_session: 'true', confirm: 'true', 'payment_method_types[]': 'card', 'metadata[payment]': payment }),
  // The status both a finished card setup and a finished charge carry.
  succeeded: 'succeeded',
  // A 2xx charge reply with one of these was not charged and will not be without the cardholder.
  notCharged: ['requires_payment_method', 'requires_action', 'requires_confirmation', 'canceled'],
  // HTTP statuses that mean the provider refused the call and charged nothing. 402 is the card's refusal; its body is
  // { error: { code } } and this code means the bank wants the cardholder to confirm. Every other answer (no answer,
  // 409, 429, 5xx) is "not known".
  refusedStatuses: [400, 401, 402, 403, 404],
  cardRefusedStatus: 402,
  errorCode: (data) => (data && data.error && data.error.code) || '',
  authenticationRequired: 'authentication_required',
  // The card page's browser calls, in this order: the script's global function with the publishable key; elements();
  // create('card', { disableLink: true }) for a card-only field with no wallet or one-click button; mount; then
  // confirmCardSetup(clientSecret, { payment_method: { card } }) → { error } or { setupIntent }.
  page: 'see cardPage()',

  // The provider's deliveries (plan 08-14). Every line below is unconfirmed: no page of the provider could be read.
  // Unconfirmed: the signature header and its form "t=<unix seconds>,v1=<hex HMAC-SHA256>" (several v1 values while a
  // secret is rotated), signed over "<t>.<the exact bytes>" with the endpoint's signing secret used as plain text.
  webhook: { type: 'hmac', header: 'Stripe-Signature', pattern: 'v1=([0-9a-f]+)', timestampPattern: 't=(\\d+)', signed: '{timestamp}.{body}', secret: '${env.BILLING_WEBHOOK_SECRET}', tolerance: 300 },
  signatureValue: (ts, hex) => `t=${ts},v1=${hex}`,
  // Unconfirmed: the event names. A refund (full or partial) is reported on the charge; an opened dispute names its
  // charge. The two payment events are for plan 08-16 (settling unresolved payments); nothing here acts on them yet.
  events: { refunded: 'charge.refunded', disputed: 'charge.dispute.created', paymentSucceeded: 'payment_intent.succeeded', paymentFailed: 'payment_intent.payment_failed' },
  // Unconfirmed: where an event keeps its id and its object, and where that object names the charge (a refund event's
  // object is the charge itself; a dispute's object names it in "charge"). A payment event's object is the payment.
  eventId: (ev) => ev && ev.id,
  eventObject: (ev) => (ev && ev.data && ev.data.object) || null,
  chargeOf: { refunded: (obj) => obj.id, disputed: (obj) => obj.charge },
  paymentOf: (obj) => obj.id,
  // Unconfirmed: reading a charge back with the secret key, asking for its refunds list to be included; the reply's
  // fields: id, payment_intent (the payment it belongs to, which this server keeps as chargeRef), amount,
  // amount_refunded, refunded, disputed, and refunds.data[] with id, amount, status and metadata.entitlement (the
  // operator's refund sets metadata[entitlement], plan 08-16). A refund with one of the statuses in refundNotGone did
  // not return the money.
  chargeRead: (charge) => `/charges/${encodeURIComponent(charge)}?${new URLSearchParams({ 'expand[]': 'refunds' })}`,
  chargePayment: (c) => c.payment_intent,
  fullyRefunded: (c) => c.refunded === true || (Number(c.amount) > 0 && Number(c.amount_refunded) >= Number(c.amount)),
  disputed: (c) => c.disputed === true,
  refundsOf: (c) => (c.refunds && Array.isArray(c.refunds.data) ? c.refunds.data : []),
  refundEntitlement: (r) => (r.metadata && r.metadata.entitlement) || '',
  refundNotGone: ['failed', 'canceled'],
  // Unconfirmed, for plan 08-16: reading a payment back; its fields status, amount and metadata.payment.
  paymentRead: (payment) => `/payment_intents/${encodeURIComponent(payment)}`
});

const SENTENCES = {
  account_required: [403, 'Card payments need a sponsor account.'],
  billing_unavailable: [409, 'Card payments are not available right now. Nothing was charged.'],
  no_card: [402, 'Add a card on the Integrations page first.'],
  card_declined: [402, 'The card was declined. Nothing was charged.'],
  authentication_required: [402, "The card's bank asks for confirmation. Replace the card on the Integrations page, then try again."],
  tier_mismatch: [409, "This invitation's package was paid at another level. Nothing was charged."]
};
/** A refusal with one of the fixed sentences: these, and nothing from the provider, are what a caller reads. */
class BillingError extends Error {
  constructor(code, status, message) {
    super(message || SENTENCES[code][1]);
    this.code = code;
    this.status = status || SENTENCES[code][0];
  }
}
const refuse = (code) => new BillingError(code);
const bad = (message) => new BillingError('', 400, message);
/** The charge's outcome is not known, so the sentence does not say that nothing was charged. Same code and status. */
const unconfirmed = () => new BillingError('billing_unavailable', 409, 'The payment could not be confirmed. Try again in a few minutes.');
/** A delivery whose charge could not be read back: nothing is recorded, so the provider's retry is acted on. */
const unchecked = () => new BillingError('', 503, 'The payment could not be checked. Try again later.');

const TIERS = ['identity', 'full', 'reverify'];
const KEY = /^[A-Za-z0-9_-]{1,80}$/;
const PROVIDER_ID = /^[A-Za-z0-9_]{1,120}$/;
const MAX_ITEMS = 200;
const MIN_PRICE_CENTS = 50;
const SESSION_MS = 15 * 60 * 1000;
const REPEAT_MS = (ASSUMED.idempotencyKeyHours - 1) * 3600 * 1000;
const UNUSED_MS = 24 * 3600 * 1000;
const ACTIVE = ['paid', 'consumed'];
const DELIVERY_ID = /^[A-Za-z0-9_-]{1,120}$/;
const DELIVERY_BODY = 256 * 1024;
const sum = (list) => list.reduce((n, it) => n + it.cents, 0);

function parseObject(raw) {
  const body = parseJson(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('The request body must be a JSON object');
  return body;
}
/** A browser's Origin header, when it is one plain origin (it goes into a response header and the card page). */
function cleanOrigin(value) {
  try {
    const u = new URL(String(value));
    return /^https?:$/.test(u.protocol) && u.origin === value ? u.origin : '';
  } catch {
    return '';
  }
}

/**
 * createBilling({ env, store, fetch, now, providers, publicUrl, origins }) → {
 *   ready()                 both payment keys are set and every price is a whole number of cents of at least 50,
 *   prices()                { identity, full, reverify } in cents, from this server's settings (null for a bad one),
 *   available()             which tiers can be sold: payments ready and that tier's check providers set up,
 *   view(account)           what GET /v1/billing answers,
 *   entitle(account, items) pay for packages: items [{ key, tier }] → { paid: [key], chargedCents, creditUsedCents };
 *                           throws an Error with .status, .code and one of this file's sentences when it cannot,
 *   find(account, key)      the newest entitlement for a key (a copy), or null,
 *   consume(entitlementId, invitationId)  tie a paid package to its one invitation; throws 409 for a second one,
 *   started(entitlementId)  the package's check has begun: from now on it is never credited; true the first time,
 *   release(entitlementId)  return an unused package as credit; true when it was credited, false when nothing changed,
 *   hold(entitlementId)     a check's start is in flight: returns finish(ok); release waits for the last finish,
 *   handle(req, res, url, auth)  the routes under /billing/ (the hosted card page and the payment provider's signed
 *                           deliveries, env BILLING_WEBHOOK_SECRET) and /v1/billing (a sponsor account)
 * }
 * account is { id, workspace } as index.mjs sponsorAuth gives it.
 */
export function createBilling({ env, store, fetch: fetchFn, now = () => Date.now(), providers = {}, publicUrl = '', origins = [] }) {
  const iso = () => new Date(now()).toISOString();
  const portals = origins.filter((o) => o !== '*');
  const call = (method, path, { form, key } = {}) =>
    requestJson({ fetch: fetchFn }, API + path, { method, form, label: 'Card payment', redirect: 'manual', headers: Object.assign({ Authorization: ASSUMED.authorization(env.BILLING_SECRET_KEY) }, key ? { [ASSUMED.idempotencyHeader]: key } : {}) });

  function price(name, fallback) {
    const raw = env[name] === undefined || env[name] === null ? '' : String(env[name]).trim();
    if (!raw) return fallback;
    const n = /^\d{1,9}$/.test(raw) ? Number(raw) : NaN;
    return n >= MIN_PRICE_CENTS ? n : null;
  }
  function prices() {
    const full = price('PACKAGE_PRICE_FULL_CENTS', 9900);
    return { identity: price('PACKAGE_PRICE_IDENTITY_CENTS', 1900), full, reverify: price('PACKAGE_PRICE_REVERIFY_CENTS', full) };
  }
  const ready = () => !!(env.BILLING_SECRET_KEY && env.BILLING_PUBLISHABLE_KEY) && Object.values(prices()).every((n) => n !== null);
  /** A check provider is set up when it is plugged in and every setting it names is filled. */
  const providerOn = (name) => !!providers[name] && !(providers[name].env || []).some((k) => !env[k]);
  function available() {
    const on = ready();
    const identity = on && providerOn(env.PACKAGE_IDENTITY_PROVIDER || 'idcheck');
    const accreditation = on && providerOn(env.PACKAGE_ACCREDITATION_PROVIDER || 'accredit');
    return { identity, full: identity && accreditation, reverify: accreditation };
  }

  /** An account's billing record (customer, card, credit); not stored until there is something to keep. */
  const record = (accountId) => store.get('billing', accountId) || { id: accountId, customer: '', card: null, creditCents: 0 };
  const entitlementsOf = (accountId) => store.list('entitlements').filter((e) => e.account === accountId);
  const newest = (accountId, key) => entitlementsOf(accountId).filter((e) => e.key === key).pop() || null;
  function find(account, key) {
    const e = newest(account && account.id ? account.id : account, key);
    return e ? Object.assign({}, e) : null;
  }

  /** Calls for one account run one after another, so a double click sees the first call's result. */
  const queues = new Map();
  function serial(accountId, fn) {
    const run = (queues.get(accountId) || Promise.resolve()).then(() => fn());
    const tail = run.catch(() => {});
    queues.set(accountId, tail);
    tail.then(() => queues.get(accountId) === tail && queues.delete(accountId));
    return run;
  }

  /** Return a package's price to the account's credit: one ledger line, and the package can never be credited again. */
  function credit(e) {
    const at = iso();
    store.put('billing', { id: e.account, creditCents: (record(e.account).creditCents || 0) + e.cents });
    store.put('ledger', { id: id('led'), account: e.account, at, type: 'credit', by: 'credit', cents: e.cents, tier: e.tier, entitlement: e.id, invitationId: e.invitationId || null, chargeRef: e.chargeRef || '' });
    store.put('entitlements', { id: e.id, status: 'credited', creditedAt: at });
  }
  /**
   * A check's start call is waiting on its provider: a cancel that lands meanwhile must not credit a package whose check
   * then runs. hold(entitlementId) → finish(ok). While any hold is open, release answers false and remembers it was
   * asked; finish(true) records the start; when the last hold finishes and nothing started, a remembered release is
   * done then. Kept in memory, like the card sessions (one server process).
   */
  const holds = new Map();
  function hold(entitlementId) {
    const k = String(entitlementId);
    const h = holds.get(k) || { count: 0, asked: false };
    h.count += 1;
    holds.set(k, h);
    let open = true;
    return function finish(ok) {
      if (!open) return false;
      open = false;
      if (ok) started(k);
      h.count -= 1;
      if (h.count > 0) return false;
      holds.delete(k);
      return h.asked ? release(k) : false;
    };
  }
  function release(entitlementId) {
    const held = holds.get(String(entitlementId));
    if (held) {
      held.asked = true;
      return false;
    }
    const e = store.get('entitlements', String(entitlementId));
    if (!e || !ACTIVE.includes(e.status) || e.startedAt) return false;
    credit(e);
    store.flush();
    return true;
  }
  /** A paid package nobody put on an invitation within 24 hours goes back to credit. Runs when the account pays or reads; no timer. */
  function sweep(accountId) {
    const stale = entitlementsOf(accountId).filter((e) => e.status === 'paid' && !e.startedAt && !holds.has(e.id) && now() - Date.parse(e.paidAt) > UNUSED_MS);
    stale.forEach(credit);
    if (stale.length) store.flush();
  }
  function consume(entitlementId, invitationId) {
    const inv = typeof invitationId === 'string' ? invitationId : '';
    if (!inv || inv.length > 120) throw bad('An invitation id is required');
    const e = store.get('entitlements', String(entitlementId));
    if (!e) throw new BillingError('', 404, 'No package payment with that id');
    if (e.status === 'consumed' && e.invitationId === inv) return Object.assign({}, e);
    if (e.status !== 'paid') throw new BillingError('package_used', 409, e.status === 'consumed' ? 'This package belongs to another invitation.' : e.status === 'credited' ? 'This package was returned as credit.' : 'This package can no longer be used.');
    const saved = store.put('entitlements', { id: e.id, status: 'consumed', invitationId: inv });
    store.flush();
    return Object.assign({}, saved);
  }
  function started(entitlementId) {
    const e = store.get('entitlements', String(entitlementId));
    if (!e || !ACTIVE.includes(e.status) || e.startedAt) return false;
    store.put('entitlements', { id: e.id, startedAt: iso() });
    store.flush();
    return true;
  }

  function view(account) {
    sweep(account.id);
    const rec = record(account.id);
    const card = rec.card ? { brand: rec.card.brand, last4: rec.card.last4, expMonth: rec.card.expMonth, expYear: rec.card.expYear } : null;
    const charges = store
      .list('ledger')
      .filter((l) => l.account === account.id)
      .reverse()
      .slice(0, 50)
      .map((l) => ({ at: l.at, type: l.type, by: l.by, cents: l.cents, tier: l.tier, invitationId: (l.entitlement && (store.get('entitlements', l.entitlement) || {}).invitationId) || null }));
    return { ready: ready(), available: available(), card, currency: 'usd', prices: prices(), creditCents: rec.creditCents || 0, charges };
  }

  /** Record paid packages: one entitlement and one ledger line each. */
  function commit(account, items, chargeRef) {
    const at = iso();
    for (const it of items) {
      const by = it.by || 'card';
      const ref = by === 'card' ? chargeRef : '';
      const ent = store.put('entitlements', { id: id('ent'), account: account.id, workspace: account.workspace || '', key: it.key, tier: it.tier, cents: it.cents, by, status: 'paid', chargeRef: ref, invitationId: null, paidAt: at, startedAt: null, creditedAt: null });
      store.put('ledger', { id: id('led'), account: account.id, at, type: 'package', by, cents: it.cents, tier: it.tier, entitlement: ent.id, invitationId: null, chargeRef: ref });
      // Cannot happen while every payment goes through the account's queue; if a key is somehow paid twice, the second
      // price goes straight back as credit instead of being kept.
      const twin = entitlementsOf(account.id).find((e) => e.key === it.key && e.id !== ent.id && ACTIVE.includes(e.status));
      if (twin) credit(ent);
    }
  }

  /**
   * Send a recorded payment to the provider. Only a definite answer changes anything:
   * { paid, ref } the card was charged; { refused, code } nothing was charged; { unknown } nobody knows yet.
   */
  async function charge(pay) {
    let reply;
    try {
      reply = await call('POST', ASSUMED.charges, { form: pay.form, key: pay.idempotencyKey });
    } catch (e) {
      const status = Number(e && e.providerStatus) || 0;
      if (!ASSUMED.refusedStatuses.includes(status)) return { unknown: true };
      if (status !== ASSUMED.cardRefusedStatus) return { refused: true, code: 'billing_unavailable', status };
      return { refused: true, code: ASSUMED.errorCode(e.data) === ASSUMED.authenticationRequired ? 'authentication_required' : 'card_declined', status };
    }
    if (reply && reply.status === ASSUMED.succeeded && PROVIDER_ID.test(String(reply.id))) return { paid: true, ref: reply.id };
    if (reply && ASSUMED.notCharged.includes(reply.status)) return { refused: true, code: 'authentication_required', status: 200 };
    return { unknown: true };
  }
  /** Close a payment the provider refused: nothing was charged, and the next try is a new payment with a new key. */
  function closeRefused(pay, out) {
    store.put('payments', { id: pay.id, status: 'failed' });
    if (out.code === 'billing_unavailable') store.event({ type: 'payment_refused', account: pay.account, payment: pay.id, status: out.status });
    store.flush();
  }
  function closePaid(account, pay, ref) {
    store.put('payments', { id: pay.id, status: 'succeeded', chargeRef: ref });
    commit(account, pay.items, ref);
  }

  /**
   * Before any new payment: settle the account's pending one. Younger than 23 hours, the stored call is repeated with
   * its own key and form, and its packages are recorded when it succeeded. Older, the provider may have forgotten the
   * key, so a repeat could charge a second time: it is marked unresolved for a person and never sent again.
   * Returns the cents this confirmed on the card.
   */
  async function settle(account) {
    let confirmed = 0;
    for (const pay of store.list('payments').filter((p) => p.account === account.id && p.status === 'pending')) {
      if (now() - Date.parse(pay.at) >= REPEAT_MS) {
        store.put('payments', { id: pay.id, status: 'unresolved' });
        store.event({ type: 'payment_unresolved', account: account.id, payment: pay.id });
        store.flush();
        continue;
      }
      const out = await charge(pay);
      if (out.unknown) throw unconfirmed();
      if (out.refused) {
        closeRefused(pay, out);
        continue;
      }
      closePaid(account, pay, out.ref);
      store.flush();
      confirmed += pay.cardCents;
    }
    return confirmed;
  }

  function cleanItems(items) {
    if (!Array.isArray(items) || !items.length) throw bad('items must be a list of { key, tier }');
    if (items.length > MAX_ITEMS) throw bad(`At most ${MAX_ITEMS} packages in one payment`);
    const seen = new Map();
    for (const it of items) {
      if (!it || typeof it !== 'object' || typeof it.key !== 'string' || !KEY.test(it.key)) throw bad('Each key is 1 to 80 letters, digits, underscores or hyphens');
      if (!TIERS.includes(it.tier)) throw bad(`Each tier is one of ${TIERS.join(', ')}`);
      if (seen.has(it.key) && seen.get(it.key) !== it.tier) throw bad('A key appears twice with different tiers');
      seen.set(it.key, it.tier);
    }
    return [...seen].map(([key, tier]) => ({ key, tier }));
  }
  /** A key that already holds a paid or used package of another tier is refused before anything is charged. */
  function sameTier(accountId, list) {
    for (const it of list) {
      const e = newest(accountId, it.key);
      if (e && ACTIVE.includes(e.status) && e.tier !== it.tier) throw refuse('tier_mismatch');
    }
  }

  async function pay(account, items) {
    if (!account || !account.id) throw refuse('account_required');
    if (!ready()) throw refuse('billing_unavailable');
    const list = cleanItems(items);
    sweep(account.id);
    sameTier(account.id, list);
    const confirmed = await settle(account);
    sameTier(account.id, list);

    // The whole payment is worked out first: what is already paid, what the credit covers in full, what goes to the card.
    const p = prices();
    const rec = record(account.id);
    let left = rec.creditCents || 0;
    const fresh = [];
    for (const it of list) {
      const e = newest(account.id, it.key);
      if (e && ACTIVE.includes(e.status)) continue;
      const cents = p[it.tier];
      const by = left >= cents ? 'credit' : 'card';
      if (by === 'credit') left -= cents;
      fresh.push({ key: it.key, tier: it.tier, cents, by });
    }
    const onCard = fresh.filter((it) => it.by === 'card').map(({ key, tier, cents }) => ({ key, tier, cents }));
    const creditUsed = sum(fresh.filter((it) => it.by === 'credit'));
    const cardCents = sum(onCard);
    let ref = '';
    let payment = null;
    if (onCard.length) {
      if (!rec.card || !rec.customer) throw refuse('no_card');
      // The payment goes to the store file, pending, before the provider hears of it. Its key is made of the account,
      // the keys paid by card, the card and the number of earlier payments for those keys that are closed: a repeat
      // of this payment carries the same key, and no later payment for the same keys ever does.
      const keys = onCard.map((it) => it.key).sort();
      const attempt = store.list('payments').filter((x) => x.account === account.id && x.keys === keys.join(',') && x.status !== 'pending').length;
      const pid = id('pay');
      payment = store.put('payments', {
        id: pid,
        account: account.id,
        items: onCard,
        keys: keys.join(','),
        cardCents,
        method: rec.card.method,
        attempt,
        idempotencyKey: sha256(JSON.stringify([account.id, keys, rec.card.method, attempt])),
        form: ASSUMED.chargeForm({ cents: cardCents, customer: rec.customer, method: rec.card.method, payment: pid }),
        status: 'pending',
        chargeRef: '',
        at: iso()
      });
      store.flush();
      const out = await charge(payment);
      if (out.unknown) throw unconfirmed();
      if (out.refused) {
        closeRefused(payment, out);
        throw refuse(out.code);
      }
      ref = out.ref;
    }
    // Only now, with the charge known to have succeeded (or none needed), is anything recorded: in one step, then to the file.
    if (payment) store.put('payments', { id: payment.id, status: 'succeeded', chargeRef: ref });
    commit(account, fresh, ref);
    if (creditUsed) store.put('billing', { id: account.id, creditCents: (record(account.id).creditCents || 0) - creditUsed });
    store.flush();
    return { paid: list.map((it) => it.key), chargedCents: cardCents + confirmed, creditUsedCents: creditUsed };
  }
  const entitle = (account, items) => serial(account && account.id, () => pay(account, items));

  // Card sessions: one hosted card page each, kept in memory for 15 minutes (a restart only means asking again).
  const sessions = new Map();
  function session(sid) {
    const s = sessions.get(sid);
    if (!s || s.used || now() > s.expires) return null;
    return s;
  }

  async function setup(account, origin) {
    if (!ready()) throw refuse('billing_unavailable');
    let rec = record(account.id);
    if (!rec.customer) {
      // The same key on a repeat, so two clicks never make two customers.
      const made = await call('POST', ASSUMED.customers, { form: ASSUMED.customerForm(account.id), key: sha256(`customer:${account.id}`) });
      if (!made || !PROVIDER_ID.test(String(made.id))) throw refuse('billing_unavailable');
      rec = store.put('billing', { id: account.id, customer: made.id, card: rec.card, creditCents: rec.creditCents || 0 });
      store.flush();
    }
    const made = await call('POST', ASSUMED.setups, { form: ASSUMED.setupForm(rec.customer) });
    if (!made || !PROVIDER_ID.test(String(made.id)) || typeof made.client_secret !== 'string') throw refuse('billing_unavailable');
    for (const [k, s] of sessions) if (now() > s.expires || sessions.size > 1000) sessions.delete(k);
    const sid = randomBytes(24).toString('base64url');
    // The page may be framed by the portal origin that asked (it has passed the server's Origin check), and tells only it.
    sessions.set(sid, { account: account.id, setup: made.id, secret: made.client_secret, origin: cleanOrigin(origin), expires: now() + SESSION_MS, used: false });
    return { url: `${publicUrl}/billing/card/${sid}` };
  }

  /** The hosted card page. Visible text: "Card", the provider's card field, the button, one line for an error. */
  function cardPage(s) {
    const cfg = JSON.stringify({ key: env.BILLING_PUBLISHABLE_KEY, secret: s.secret, origin: s.origin || portals[0] || '' }).replace(/</g, '\\u003c');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:16px;color:#1b1b1b;background:#fff}h1{font-size:18px;margin:0 0 12px}#card{border:1px solid #bbb;border-radius:6px;padding:12px;min-height:20px}#err{color:#a11;min-height:24px;margin:8px 0}button{font:inherit;font-weight:700;padding:10px 18px;border:0;border-radius:6px;background:#0f2742;color:#fff}button:disabled{opacity:.5}</style></head><body><form id="f"><h1>Card</h1><div id="card"></div><p id="err" role="alert"></p><button id="save" type="submit">Save card</button></form><script src="${SCRIPT}"></script><script>(function(){var c=${cfg},err=document.getElementById('err'),btn=document.getElementById('save');function say(t){err.textContent=t}if(typeof Stripe!=='function'){btn.disabled=true;say('The card field could not be loaded. Close this and try again.');return}var api=Stripe(c.key),card=api.elements().create('card',{disableLink:true});card.mount('#card');document.getElementById('f').addEventListener('submit',function(e){e.preventDefault();btn.disabled=true;say('');api.confirmCardSetup(c.secret,{payment_method:{card:card}}).then(function(r){if(r.error)throw new Error('refused');return fetch(location.pathname+'/done',{method:'POST'})}).then(function(r){if(!r.ok)throw new Error('not saved');if(c.origin&&window.parent!==window)window.parent.postMessage({type:'cv-card-saved'},c.origin)}).catch(function(){btn.disabled=false;say('The card could not be saved. Check the details and try again.')})})})();</script></body></html>`;
  }
  const pageHeaders = (s) => ({ 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': `frame-ancestors ${s.origin || portals.join(' ') || "'self'"}` });

  /** The card page says it is finished. Nothing it says is believed: the setup is read back from the provider. */
  async function done(s) {
    const rec = record(s.account);
    const read = await call('GET', `${ASSUMED.setups}/${encodeURIComponent(s.setup)}`);
    if (!read || read.status !== ASSUMED.succeeded || !rec.customer || read.customer !== rec.customer || !PROVIDER_ID.test(String(read.payment_method))) throw new BillingError('card_not_saved', 409, 'The card was not saved.');
    const pm = await call('GET', `${ASSUMED.methods}/${encodeURIComponent(read.payment_method)}`);
    const c = (pm && pm.card) || {};
    const card = { brand: String(c.brand || '').replace(/[^A-Za-z _-]/g, '').slice(0, 20), last4: String(c.last4 || ''), expMonth: Number(c.exp_month), expYear: Number(c.exp_year), method: String(read.payment_method) };
    if (!/^\d{4}$/.test(card.last4) || !(card.expMonth >= 1 && card.expMonth <= 12) || !(card.expYear >= 2000 && card.expYear <= 2200)) throw refuse('billing_unavailable');
    const old = rec.card && rec.card.method !== card.method ? rec.card.method : '';
    store.put('billing', { id: s.account, card });
    store.flush();
    s.used = true;
    // The card this one replaces can no longer be charged. The new card is already saved if the provider cannot be told now.
    if (old) await call('POST', ASSUMED.detach(old)).catch(() => store.event({ type: 'card_detach_failed', account: s.account }));
    return { ok: true, card: { brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear } };
  }
  /** Remove the card: the provider lets it go first, then it is cleared here. */
  async function removeCard(account) {
    const rec = record(account.id);
    if (!rec.card) return { card: null };
    if (!ready()) throw refuse('billing_unavailable');
    await call('POST', ASSUMED.detach(rec.card.method));
    store.put('billing', { id: account.id, card: null });
    store.flush();
    return { card: null };
  }

  // The provider's deliveries. Carrow & Vale receives the funds (D-01), so it must see refunds and disputes. A delivery
  // is believed only when its signature over the exact bytes is good and its signed time is fresh, and then only for
  // which charge to read: what changes a package or the ledger is the provider's own record, read back with the secret key.

  /** One ledger line tied to a package (or to none, for a refund nobody can match). */
  function line(e, type, by, cents, extra = {}) {
    store.put('ledger', Object.assign({ id: id('led'), account: e.account, at: iso(), type, by, cents, tier: e.tier || null, entitlement: e.id || null, invitationId: e.invitationId || null, chargeRef: e.chargeRef || '' }, extra));
  }
  /**
   * A credited package whose money is gone or contested: the credit it gave is taken back, read from the account's
   * record at this moment and never below 0 (part of it may already be spent), with one line for what was removed.
   */
  function takeCredit(e, type, extra) {
    const removed = Math.min(e.cents, Math.max(0, record(e.account).creditCents || 0));
    if (!removed) return;
    store.put('billing', { id: e.account, creditCents: (record(e.account).creditCents || 0) - removed });
    line(e, type, 'credit', removed, extra);
  }
  /** The money for a package went back to the card. Writes nothing for a package already refunded. */
  function refundOne(e, refundRef, cents) {
    const cur = store.get('entitlements', e.id);
    if (!cur || cur.status === 'refunded') return;
    line(cur, 'refund', 'card', cents === undefined ? cur.cents : cents, { refundRef });
    if (cur.status === 'credited') takeCredit(cur, 'refund', { refundRef });
    store.put('entitlements', { id: cur.id, status: 'refunded', refundedAt: iso() });
  }
  /** A refund delivery, acted on from the charge as read back. */
  function refunds(accountId, ref, read) {
    const on = entitlementsOf(accountId).filter((e) => e.chargeRef === ref);
    const list = ASSUMED.refundsOf(read).filter((r) => r && PROVIDER_ID.test(String(r.id)) && !ASSUMED.refundNotGone.includes(r.status));
    if (ASSUMED.fullyRefunded(read)) {
      // The whole charge went back: every package on it, started ones included (the money is gone).
      for (const e of on) {
        const own = list.find((r) => ASSUMED.refundEntitlement(r) === e.id) || list[list.length - 1];
        refundOne(e, own ? String(own.id) : '');
      }
      return;
    }
    // Part of the charge went back: each refund is matched to its package by the entitlement it names (the operator's
    // refund sets it). One nobody can match is recorded once, by its refund id, for a person to look at.
    for (const r of list) {
      const e = on.find((x) => x.id === ASSUMED.refundEntitlement(r));
      const cents = Number.isSafeInteger(Number(r.amount)) && Number(r.amount) > 0 ? Number(r.amount) : 0;
      if (e) {
        refundOne(e, String(r.id), cents || undefined);
        continue;
      }
      if (store.list('ledger').some((l) => l.account === accountId && l.refundRef === String(r.id))) continue;
      line({ account: accountId, chargeRef: ref }, 'refund', 'card', cents, { refundRef: String(r.id) });
      store.event({ type: 'refund_unmatched', account: accountId });
    }
  }
  /**
   * A dispute delivery: every package on the charge whose check has not started is disputed. It is never active and
   * never credited again, and credit it gave is taken back. A person restores it by hand if the dispute is won.
   */
  function dispute(accountId, ref, read) {
    if (!ASSUMED.disputed(read)) return;
    const hit = entitlementsOf(accountId).filter((e) => e.chargeRef === ref && !e.startedAt && e.status !== 'disputed' && e.status !== 'refunded');
    for (const e of hit) {
      line(e, 'dispute', 'card', e.cents);
      if (e.status === 'credited') takeCredit(e, 'dispute');
      store.put('entitlements', { id: e.id, status: 'disputed', disputedAt: iso() });
    }
    if (hit.length) store.event({ type: 'payment_disputed', account: accountId, entitlements: hit.length });
  }

  /**
   * True only for a delivery signed with the delivery secret over its signed time and its exact bytes, with that time
   * fresh. The header is split here with this file's own two fixed patterns: the connector's matcher runs a sponsor's
   * patterns in a time-limited sandbox (50 ms, retried once at 500 ms since the fix of 2026-11-19), which this route has
   * no need for: its two patterns are fixed. The signature itself, the freshness and the constant-time comparison are the connector's.
   */
  function signedByProvider(raw, headers) {
    const v = ASSUMED.webhook;
    const value = String(header(headers, v.header) || '');
    if (!value || value.length > 4096) return false;
    const ts = (value.match(new RegExp(v.timestampPattern)) || [])[1] || '';
    const sigs = Array.from(value.matchAll(new RegExp(v.pattern, 'g')), (m) => m[1]).filter(Boolean).slice(0, 20);
    const one = { type: 'hmac', header: 'x-signature', timestampHeader: 'x-signed-at', signed: v.signed, secret: v.secret, tolerance: v.tolerance };
    return !!ts && sigs.some((sig) => verify(one, raw, { 'x-signature': sig, 'x-signed-at': ts }, env, {}));
  }

  async function delivery(req, res) {
    if (!env.BILLING_WEBHOOK_SECRET) return send(res, 404, { error: 'Not found' });
    const raw = await readRaw(req, DELIVERY_BODY);
    if (!signedByProvider(raw, req.headers)) {
      store.event({ type: 'webhook_rejected', provider: 'billing' });
      return send(res, 401, { error: 'Bad signature' });
    }
    const ev = parseObject(raw);
    const evId = ASSUMED.eventId(ev);
    const seenKey = `billing:${typeof evId === 'string' && DELIVERY_ID.test(evId) ? evId : sha256(raw)}`;
    // A duplicate is found by reading the seen list, which records nothing: a delivery is recorded only once it is acted on.
    if (store.data().seen.includes(seenKey)) return send(res, 200, { received: true, duplicate: true });
    const kind = Object.keys(ASSUMED.chargeOf).find((k) => ASSUMED.events[k] === ev.type);
    const obj = ASSUMED.eventObject(ev);
    const chargeId = kind && obj ? String(ASSUMED.chargeOf[kind](obj) || '') : '';
    // An event this module does not act on, or one naming no charge, changes nothing and is not recorded.
    if (!kind || !PROVIDER_ID.test(chargeId)) return send(res, 200, { received: true });
    let read = null;
    try {
      read = await call('GET', ASSUMED.chargeRead(chargeId));
    } catch {
      read = null;
    }
    if (!read || typeof read !== 'object' || read.id !== chargeId) throw unchecked();
    const ref = String(ASSUMED.chargePayment(read) || '');
    const owner = PROVIDER_ID.test(ref) ? store.list('entitlements').find((e) => e.chargeRef === ref) : null;
    // Inside the account's queue, so it never interleaves with a payment; each action writes nothing a second time.
    if (owner) await serial(owner.account, () => (kind === 'disputed' ? dispute : refunds)(owner.account, ref, read));
    store.flush();
    store.seen(seenKey);
    return send(res, 200, { received: true });
  }

  async function routes(req, res, url, auth) {
    const path = url.pathname;
    const own = path.match(/^\/billing\/card\/([\w-]{20,64})(\/done)?$/);
    if (path === '/billing/webhook' && req.method === 'POST') return delivery(req, res);
    if (path.startsWith('/billing/')) {
      const s = own ? session(own[1]) : null;
      if (!s) return send(res, 404, { error: 'Not found' });
      if (!own[2] && req.method === 'GET') return send(res, 200, cardPage(s), pageHeaders(s));
      if (own[2] && req.method === 'POST') return send(res, 200, await serial(s.account, () => (session(own[1]) ? done(s) : Promise.reject(new BillingError('', 404, 'Not found')))));
      return send(res, 405, { error: 'Not allowed' });
    }
    // Only a sponsor's own account reaches its card, credit and payments; the account is never taken from the request.
    const account = auth && auth.account;
    if (!account) throw refuse('account_required');
    if (path === '/v1/billing' && req.method === 'GET') return send(res, 200, view(account));
    if (path === '/v1/billing/card/setup' && req.method === 'POST') return send(res, 200, await setup(account, req.headers.origin));
    if (path === '/v1/billing/card' && req.method === 'DELETE') return send(res, 200, await serial(account.id, () => removeCard(account)));
    if (path === '/v1/billing/entitlements' && req.method === 'POST') return send(res, 200, await entitle(account, parseObject(await readRaw(req, 64 * 1024)).items));
    return send(res, 404, { error: 'Not found' });
  }
  /** Every refusal a caller reads is one of this file's own sentences; whatever the provider said stays here. */
  async function handle(req, res, url, auth) {
    try {
      return await routes(req, res, url, auth);
    } catch (e) {
      if (e instanceof BillingError) return send(res, e.status, e.code ? { error: e.message, code: e.code } : { error: e.message });
      if (e && (e.status === 400 || e.status === 413) && !e.providerStatus) return send(res, e.status, { error: e.message });
      store.event({ type: 'billing_error', status: Number(e && e.providerStatus) || 0 });
      return send(res, 409, { error: SENTENCES.billing_unavailable[1], code: 'billing_unavailable' });
    }
  }

  return { ready, prices, available, view, entitle, find, consume, started, release, hold, handle };
}
