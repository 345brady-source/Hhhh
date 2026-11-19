// Card payments for the verification package: a sponsor keeps one card on file and pays for packages before an
// invitation carries one. The card is typed into the payment provider's own field on a page this server hosts, so a card
// number never reaches the portal's pages or this server; only the brand, the last four digits and the expiry are kept.
// The price of a package is this server's setting, by tier, never a figure from a request. The investor never pays.
import { randomBytes } from 'node:crypto';
import { readRaw, parseJson, send } from './http.mjs';
import { requestJson } from './request.mjs';
import { sha256, id } from './crypto.mjs';

// The payment provider. Its name and addresses stay in these two lines and the card page's own script tag: no reply,
// event, log line or visible text carries them.
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
  // Paths under the API base. Bodies are form-encoded; replies are JSON.
  customers: '/customers', // POST → { id }
  setups: '/setup_intents', // POST → { id, client_secret }; GET /:id → { id, status, customer, payment_method }
  methods: '/payment_methods', // GET /:id → { id, card: { brand, last4, exp_month, exp_year } }
  charges: '/payment_intents', // POST → { id, status }
  customerForm: (account) => ({ 'metadata[account]': account }),
  setupForm: (customer) => ({ customer, usage: 'off_session', 'payment_method_types[]': 'card' }),
  chargeForm: ({ cents, customer, method }) => ({ amount: String(cents), currency: 'usd', customer, payment_method: method, off_session: 'true', confirm: 'true', 'payment_method_types[]': 'card' }),
  // The status both a finished card setup and a finished charge carry.
  succeeded: 'succeeded',
  // The card page's browser calls, in this order: the script's global function with the publishable key; elements();
  // create('card', { disableLink: true }) for a card-only field with no wallet or one-click button; mount; then
  // confirmCardSetup(clientSecret, { payment_method: { card } }) → { error } or { setupIntent }.
  page: 'see cardPage()'
});

const SENTENCES = {
  account_required: [403, 'Card payments need a sponsor account.'],
  billing_unavailable: [409, 'Card payments are not available right now. Nothing was charged.'],
  no_card: [402, 'Add a card on the Integrations page first.']
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

const TIERS = ['identity', 'full', 'reverify'];
const KEY = /^[A-Za-z0-9_-]{1,80}$/;
const PROVIDER_ID = /^[A-Za-z0-9_]{1,120}$/;
const SESSION_MS = 15 * 60 * 1000;
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function parseObject(raw) {
  const body = parseJson(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('The request body must be a JSON object');
  return body;
}

/**
 * createBilling({ env, store, fetch, now, providers, publicUrl, origins }) → {
 *   ready()                 both payment keys are set,
 *   prices()                { identity, full, reverify } in cents, from this server's settings,
 *   available()             which tiers can be sold: payments ready and that tier's check providers set up,
 *   view(account)           what GET /v1/billing answers,
 *   entitle(account, items) pay for packages: items [{ key, tier }] → { paid: [key], chargedCents, creditUsedCents },
 *   find(account, key)      the newest entitlement for a key, or null,
 *   handle(req, res, url, auth)  the routes under /billing/ (the hosted card page) and /v1/billing (a sponsor account)
 * }
 */
export function createBilling({ env, store, fetch: fetchFn, now = () => Date.now(), providers = {}, publicUrl = '', origins = [] }) {
  const iso = () => new Date(now()).toISOString();
  const call = (method, path, { form, key } = {}) =>
    requestJson({ fetch: fetchFn }, API + path, { method, form, label: 'Card payment', redirect: 'manual', headers: Object.assign({ Authorization: ASSUMED.authorization(env.BILLING_SECRET_KEY) }, key ? { [ASSUMED.idempotencyHeader]: key } : {}) });

  const price = (name, fallback) => Number(env[name]) || fallback;
  function prices() {
    const full = price('PACKAGE_PRICE_FULL_CENTS', 9900);
    return { identity: price('PACKAGE_PRICE_IDENTITY_CENTS', 1900), full, reverify: price('PACKAGE_PRICE_REVERIFY_CENTS', full) };
  }
  const ready = () => !!(env.BILLING_SECRET_KEY && env.BILLING_PUBLISHABLE_KEY);
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
  function find(account, key) {
    const all = entitlementsOf(account && account.id ? account.id : account).filter((e) => e.key === key);
    return all.length ? all[all.length - 1] : null;
  }

  function view(account) {
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
  function commit(account, items, by, chargeRef) {
    const at = iso();
    for (const it of items) {
      const ent = store.put('entitlements', { id: id('ent'), account: account.id, workspace: account.workspace || '', key: it.key, tier: it.tier, cents: it.cents, by, status: 'paid', chargeRef: chargeRef || '', invitationId: null, paidAt: at, startedAt: null, creditedAt: null });
      store.put('ledger', { id: id('led'), account: account.id, at, type: 'package', by, cents: it.cents, tier: it.tier, entitlement: ent.id, invitationId: null, chargeRef: chargeRef || '' });
    }
  }

  async function entitle(account, items) {
    if (!Array.isArray(items) || !items.length) throw bad('items must be a list of { key, tier }');
    const p = prices();
    const list = items.map((it) => {
      if (!it || !KEY.test(String(it.key)) || !TIERS.includes(it.tier)) throw bad('Each item needs a key and a tier');
      return { key: String(it.key), tier: it.tier, cents: p[it.tier] };
    });
    const rec = record(account.id);
    if (!rec.card || !rec.customer) throw refuse('no_card');
    const cents = list.reduce((n, it) => n + it.cents, 0);
    const key = sha256(JSON.stringify([account.id, list.map((it) => it.key).sort(), rec.card.method]));
    const reply = await call('POST', ASSUMED.charges, { form: ASSUMED.chargeForm({ cents, customer: rec.customer, method: rec.card.method }), key });
    if (!reply || reply.status !== ASSUMED.succeeded) throw refuse('billing_unavailable');
    commit(account, list, 'card', String(reply.id || ''));
    return { paid: list.map((it) => it.key), chargedCents: cents, creditUsedCents: 0 };
  }

  // Card sessions: one hosted card page each, kept in memory for 15 minutes (a restart only means asking again).
  const sessions = new Map();
  function session(sid) {
    const s = sessions.get(sid);
    if (!s || s.used || now() > s.expires) return null;
    return s;
  }

  async function setup(account) {
    if (!ready()) throw refuse('billing_unavailable');
    let rec = record(account.id);
    if (!rec.customer) {
      // The same key on a repeat, so two clicks never make two customers.
      const made = await call('POST', ASSUMED.customers, { form: ASSUMED.customerForm(account.id), key: sha256(`customer:${account.id}`) });
      if (!made || !PROVIDER_ID.test(String(made.id))) throw refuse('billing_unavailable');
      rec = store.put('billing', { id: account.id, customer: made.id, card: rec.card, creditCents: rec.creditCents || 0 });
    }
    const made = await call('POST', ASSUMED.setups, { form: ASSUMED.setupForm(rec.customer) });
    if (!made || !PROVIDER_ID.test(String(made.id)) || typeof made.client_secret !== 'string') throw refuse('billing_unavailable');
    for (const [k, s] of sessions) if (now() > s.expires || sessions.size > 1000) sessions.delete(k);
    const sid = randomBytes(24).toString('base64url');
    sessions.set(sid, { account: account.id, setup: made.id, secret: made.client_secret, expires: now() + SESSION_MS, used: false });
    return { url: `${publicUrl}/billing/card/${sid}` };
  }

  /** The hosted card page. Visible text: "Card", the provider's card field, the button, one line for an error. */
  function cardPage(s) {
    const target = origins.find((o) => o !== '*') || '';
    const cfg = JSON.stringify({ key: env.BILLING_PUBLISHABLE_KEY, secret: s.secret, origin: target }).replace(/</g, '\\u003c');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:16px;color:#1b1b1b;background:#fff}h1{font-size:18px;margin:0 0 12px}#card{border:1px solid #bbb;border-radius:6px;padding:12px;min-height:20px}#err{color:#a11;min-height:24px;margin:8px 0}button{font:inherit;font-weight:700;padding:10px 18px;border:0;border-radius:6px;background:#0f2742;color:#fff}button:disabled{opacity:.5}</style></head><body><form id="f"><h1>${esc('Card')}</h1><div id="card"></div><p id="err" role="alert"></p><button id="save" type="submit">Save card</button></form><script src="${SCRIPT}"></script><script>(function(){var c=${cfg},err=document.getElementById('err'),btn=document.getElementById('save');function say(t){err.textContent=t}if(typeof Stripe!=='function'){btn.disabled=true;say('The card field could not be loaded. Close this and try again.');return}var api=Stripe(c.key),card=api.elements().create('card',{disableLink:true});card.mount('#card');document.getElementById('f').addEventListener('submit',function(e){e.preventDefault();btn.disabled=true;say('');api.confirmCardSetup(c.secret,{payment_method:{card:card}}).then(function(r){if(r.error)throw new Error('refused');return fetch(location.pathname+'/done',{method:'POST'})}).then(function(r){if(!r.ok)throw new Error('not saved');if(c.origin&&window.parent!==window)window.parent.postMessage({type:'cv-card-saved'},c.origin)}).catch(function(){btn.disabled=false;say('The card could not be saved. Check the details and try again.')})})})();</script></body></html>`;
  }
  const pageHeaders = () => ({ 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': `frame-ancestors ${origins.filter((o) => o !== '*').join(' ') || "'self'"}` });

  /** The card page says it is finished. Nothing it says is believed: the setup is read back from the provider. */
  async function done(s) {
    const rec = record(s.account);
    const read = await call('GET', `${ASSUMED.setups}/${encodeURIComponent(s.setup)}`);
    if (!read || read.status !== ASSUMED.succeeded || !rec.customer || read.customer !== rec.customer || !PROVIDER_ID.test(String(read.payment_method))) throw new BillingError('card_not_saved', 409, 'The card was not saved.');
    const pm = await call('GET', `${ASSUMED.methods}/${encodeURIComponent(read.payment_method)}`);
    const c = (pm && pm.card) || {};
    const card = { brand: String(c.brand || '').replace(/[^A-Za-z _-]/g, '').slice(0, 20), last4: String(c.last4 || ''), expMonth: Number(c.exp_month), expYear: Number(c.exp_year), method: String(read.payment_method) };
    if (!/^\d{4}$/.test(card.last4) || !(card.expMonth >= 1 && card.expMonth <= 12) || !(card.expYear >= 2000 && card.expYear <= 2200)) throw refuse('billing_unavailable');
    store.put('billing', { id: s.account, card });
    s.used = true;
    return { ok: true, card: { brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear } };
  }

  async function routes(req, res, url, auth) {
    const path = url.pathname;
    const own = path.match(/^\/billing\/card\/([\w-]{20,64})(\/done)?$/);
    if (path.startsWith('/billing/')) {
      const s = own ? session(own[1]) : null;
      if (!s) return send(res, 404, { error: 'Not found' });
      if (!own[2] && req.method === 'GET') return send(res, 200, cardPage(s), pageHeaders());
      if (own[2] && req.method === 'POST') return send(res, 200, await done(s));
      return send(res, 405, { error: 'Not allowed' });
    }
    const account = auth && auth.account;
    if (!account) throw refuse('account_required');
    if (path === '/v1/billing' && req.method === 'GET') return send(res, 200, view(account));
    if (path === '/v1/billing/card/setup' && req.method === 'POST') return send(res, 200, await setup(account));
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

  return { ready, prices, available, view, entitle, find, handle };
}
