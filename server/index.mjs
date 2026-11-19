#!/usr/bin/env node
/*
 * Integration server for automated investor verification (the Carrow & Vale
 * self-serve edition).
 *
 * The portal runs in the browser and must never hold provider API keys, so
 * this small server does the provider work:
 *   POST /v1/verifications        start an identity or accreditation check; returns { id, status, url }
 *   GET  /v1/verifications/:id    its latest status (refreshed from the provider while pending)
 *   POST /v1/screenings           sanctions / PEP screening of names; returns { id, status, hits }
 *   GET  /v1/screenings/:id       a screening's latest result (monitoring alerts update it)
 *   GET  /v1/connectors           the providers plugged in (built-ins, connectors, plug-ins); no secrets
 *   POST /v1/results              a provider or the sponsor's automation reports a result (RESULTS_TOKEN)
 *   POST /webhooks/:provider      provider callbacks, signature-checked, update the records above
 *   GET  /v1/verifications/:id/evidence/:n  a verification letter or certificate, fetched from the provider
 *   GET  /return/:provider[/:id]  where a provider sends the investor back (OAuth codes, account links)
 *   GET  /hosted/:id              a page this server hosts for a provider flow (for example a provider's JS SDK)
 *   POST /hosted/:id              that page's form or SDK result
 *   GET  /sandbox/:ref            a stand-in hosted page for the "sandbox" provider (testing without accounts)
 *   POST /v1/intake               read an offering's documents for the intake screen (lib/intake.mjs; ndjson stream)
 *   POST /v1/read                 read an uploaded subscription agreement's places (lib/read.mjs)
 *   POST /v1/help                 answer a question about using the portal (lib/help.mjs)
 *   GET  /health                  which providers are configured, and whether reading is available
 *
 * Investor invitations (lib/invitations.mjs; see README.md):
 *   POST /v1/invitations          the console invites an investor; this server emails the link
 *   GET  /v1/invitations          their statuses; GET/DELETE /v1/invitations/:id/submission, POST …/resend, …/cancel
 *   GET  /v1/outbox               messages kept here when no SMTP server is set
 *   POST /v1/admin/accounts       the operator makes a sponsor account with its own token (ADMIN_TOKEN; lib/accounts.mjs)
 *   GET  /v1/admin/accounts       the accounts; POST /v1/admin/accounts/:id/token replaces an account's token
 *   GET  /v1/invite               the investor's browser loads its onboarding (X-Invite-Token)
 *   PUT  /v1/invite/progress      …reports the step it is on
 *   POST /v1/invite/complete      …sends back the finished paperwork; the sponsor is emailed
 *
 * No verification vendor is built in: sponsors plug in the services they use
 * (declarative connectors, code plug-ins, or hosted links plus the results
 * API; see README.md), as many per check as they like.
 *
 * Node 18 or later. One dependency, the reading service's official client (pinned in package.json), needed only for
 * reading; every other route works without it. Configure with environment variables
 * (see README.md). Statuses are normalized for the portal: identity
 * pending | passed | review | failed; accreditation pending | verified |
 * review | rejected; screening pending | clear | potential_match. A provider
 * status that maps to none of these is shown as providerStatus.
 */
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { readRaw, parseJson, send, cors, header } from './lib/http.mjs';
import { openStore } from './lib/store.mjs';
import { id, safeEqual } from './lib/crypto.mjs';
import { STATUSES } from './lib/statuses.mjs';
import { createInvitations } from './lib/invitations.mjs';
import { createAccounts } from './lib/accounts.mjs';
import { createBilling } from './lib/billing.mjs';
import { createFilings } from './lib/filings.mjs';
import { createIntake } from './lib/intake.mjs';
import { createReader, IMAGE_MAX, IMAGE_BYTES } from './lib/read.mjs';
import { createHelp } from './lib/help.mjs';
import { costOf, logLine } from './lib/model.mjs';
import { PROVIDERS as PROVIDERS_DEFAULT, configured, missingEnv, describe } from './providers/index.mjs';

export { STATUSES };
/** Normalized result fields adapters may return; anything else they need goes in `data`, which never leaves the server. */
const RESULT_FIELDS = ['method', 'detail', 'expiresAt', 'screening', 'evidence'];
const REF_ID = /^(ver|scr)_[\w-]{1,64}$/;
const REFRESH_MS = 20000;

/** An invitation token sees only its own investor's checks: the same investor id in the same workspace (ids are per-workspace sequences). */
const ownCheck = (rec, scope) => rec.investorId === scope.investorId && (rec.workspace || '') === (scope.workspace || '');

/** In production, verify the portal session here (for example a signed session token); API_TOKEN suits server-to-server use. */
function authorize(req, env) {
  if (!env.API_TOKEN) return true;
  const got = String(header(req.headers, 'authorization') || '').replace(/^Bearer\s+/i, '');
  return safeEqual(got, env.API_TOKEN);
}

/** The results API is off unless RESULTS_TOKEN is set; then it needs that token, compared in constant time. */
function resultsAuthorized(req, env) {
  const got = String(header(req.headers, 'authorization') || '').replace(/^Bearer\s+/i, '');
  return safeEqual(got, String(env.RESULTS_TOKEN));
}

/** A JSON request body that must be an object ({ ... }); anything else is a 400, not a crash. */
function parseObject(raw) {
  const body = parseJson(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('The request body must be a JSON object'), { status: 400 });
  return body;
}

/** Clean up a pushed result: only the documented fields, in the documented shapes. */
const clip = (v, n) => (v === undefined || v === null ? '' : String(v).slice(0, n));
/** Settings from the portal are non-secret plain values (a link, a level, a threshold). */
function cleanSettings(x) {
  const out = {};
  if (!x || typeof x !== 'object' || Array.isArray(x)) return out;
  for (const [k, v] of Object.entries(x).slice(0, 40)) if (/^[\w-]{1,40}$/.test(k) && ['string', 'number', 'boolean'].includes(typeof v)) out[k] = typeof v === 'string' ? v.slice(0, 2000) : v;
  return out;
}
/** The investor details a check may use: plain text fields only. */
const INVESTOR_KEYS = ['id', 'name', 'account', 'email', 'type', 'address', 'phone', 'workspace', 'offering'];
function cleanInvestor(x) {
  const o = x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  const out = {};
  for (const k of INVESTOR_KEYS) out[k] = ['string', 'number'].includes(typeof o[k]) ? clip(o[k], 300) : '';
  return out;
}
function cleanHits(list) {
  if (!Array.isArray(list)) return null;
  return list.slice(0, 100).map((x) => {
    const o = x && typeof x === 'object' ? x : {};
    const score = Number(o.score);
    return { name: clip(o.name, 200), listed: clip(o.listed, 200), list: clip(o.list, 200), score: Number.isFinite(score) ? score : null, detail: clip(o.detail, 300) };
  });
}
function cleanEvidence(list) {
  if (!Array.isArray(list)) return null;
  return list.slice(0, 20).map((x) => {
    const o = x && typeof x === 'object' ? x : {};
    const e = { type: clip(o.type || 'document', 40), label: clip(o.label || 'Document', 120) };
    if (typeof o.url === 'string' && /^https:\/\//i.test(o.url)) e.url = o.url.slice(0, 1000);
    return e;
  });
}

/** The client's address: the first X-Forwarded-For entry behind a trusted proxy (TRUST_PROXY=1), else the socket's. */
const clientOf = (req, env) => (env.TRUST_PROXY === '1' ? String(header(req.headers, 'x-forwarded-for') || '').split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';

/** A small per-client limit on the calls that can cost money or create records. */
function rateLimiter(env) {
  const max = Number(env.RATE_LIMIT_PER_MIN === undefined ? 60 : env.RATE_LIMIT_PER_MIN);
  const hits = new Map();
  return (req) => {
    if (!max) return false;
    const who = clientOf(req, env);
    const now = Date.now();
    const h = hits.get(who);
    if (!h || now > h.reset) {
      hits.set(who, { count: 1, reset: now + 60000 });
      if (hits.size > 10000) hits.clear();
      return false;
    }
    h.count += 1;
    return h.count > max;
  };
}

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function donePage(rec, message) {
  const back = rec && rec.returnUrl ? `<p><a href="${esc(rec.returnUrl)}" style="color:#0f2742;font-weight:700">Return to the portal</a></p>` : '<p>You can close this tab and return to the portal.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Done</title></head><body style="font:16px/1.5 system-ui,sans-serif;margin:0;padding:32px 16px;background:#f6f6f6;color:#1b1b1b"><main style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:6px;padding:24px"><h1 style="font-size:22px;margin-top:0">${esc(message || 'Thank you')}</h1>${back}</main></body></html>`;
}
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };

export function createServer(opts = {}) {
  const env = opts.env || process.env;
  const store = opts.store || openStore(env.STORE_FILE || new URL('./data/store.json', import.meta.url).pathname);
  const fetchFn = opts.fetch || globalThis.fetch;
  const PROVIDERS = opts.providers || PROVIDERS_DEFAULT;
  const publicUrl = String(env.PUBLIC_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/+$/, '');
  const origins = String(env.PORTAL_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const limited = rateLimiter(env);
  const now = opts.now || (() => Date.now());
  const intake = opts.intake || createIntake({ env, fetch: opts.fetch });
  // The agreement reader shares the intake's spend cap, so the cap counts every reading call this server makes.
  const reader = opts.reader || createReader({ env, fetch: opts.fetch, budget: intake.budget || undefined });
  // Help shares that cap too, and has its own daily cap (lib/help.mjs).
  const help = opts.help || createHelp({ env, fetch: opts.fetch, budget: intake.budget || undefined, now });

  const invites = createInvitations({ env, store, publicUrl, returnTo: (u) => returnTo(u), limited, now, mailTls: opts.mailTls });
  const accounts = createAccounts({ store, now });
  const billing = createBilling({ env, store, fetch: fetchFn, now, providers: PROVIDERS, publicUrl, origins }); // card payments for the verification package
  const filings = createFilings({ env, store, vault: invites.vault, mailer: invites.mailer, limited, now, accounts, transport: opts.edgarTransport });
  const pkg = invites.usePackages({ billing, providers: PROVIDERS, identity: env.PACKAGE_IDENTITY_PROVIDER || 'idcheck', accreditation: env.PACKAGE_ACCREDITATION_PROVIDER || 'accredit' }); // the package on invitations (08-05); 08-15 adds its route helpers
  /**
   * Who is calling a sponsor route: null (refuse), { shared: true } (the shared API_TOKEN, or an open server: no API_TOKEN
   * and no account), or { account } (a sponsor's own token; the call then acts on that account's workspace only).
   */
  function sponsorAuth(req) {
    if (env.API_TOKEN && authorize(req, env)) return { shared: true };
    const account = accounts.find(String(header(req.headers, 'authorization') || '').replace(/^Bearer\s+/i, ''));
    if (account) return { account };
    return !env.API_TOKEN && !store.list('accounts').length ? { shared: true } : null;
  }
  /** The operator's routes for sponsor accounts. Off unless ADMIN_TOKEN is set; then they need that token, compared in constant time. */
  async function admin(req, res, path) {
    if (!env.ADMIN_TOKEN) return send(res, 404, { error: 'Not found' });
    if (limited(req)) return send(res, 429, { error: 'Too many requests' });
    if (!safeEqual(String(header(req.headers, 'authorization') || '').replace(/^Bearer\s+/i, ''), String(env.ADMIN_TOKEN))) return send(res, 401, { error: 'Not authorized' });
    if (path === '/v1/admin/accounts') {
      if (req.method === 'GET') return send(res, 200, { accounts: accounts.list() });
      if (req.method !== 'POST') return send(res, 405, { error: 'Use GET or POST' });
      return send(res, 200, accounts.create(parseObject(await readRaw(req, 16 * 1024))));
    }
    const m = path.match(/^\/v1\/admin\/accounts\/(acct_[\w-]+)\/token$/);
    if (!m) return send(res, 404, { error: 'Not found' });
    if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
    return send(res, 200, accounts.rotate(m[1]));
  }
  /**
   * Investors' details on verification and screening records (name, email, address, phone, the names
   * screened) are sealed with DATA_KEY like invitations (lib/vault.mjs); providers get them in memory.
   */
  const sealPersonal = (table, rid, field, value) => invites.vault.seal(value, `${table}:${rid}:${field}`);
  function openPersonal(rec, field) {
    const box = rec[field];
    if (!box || typeof box !== 'object' || Array.isArray(box) || (box.v === undefined && !Object.prototype.hasOwnProperty.call(box, 'plain'))) return box; // stored before sealing
    return invites.vault.open(box, `${rec.id.startsWith('scr_') ? 'screenings' : 'verifications'}:${rec.id}:${field}`);
  }

  const ctx = (provider, rec, extra) =>
    Object.assign(
      {
        env,
        fetch: fetchFn,
        publicUrl,
        webhookUrl: `${publicUrl}/webhooks/${provider}`,
        returnUrl: rec ? `${publicUrl}/return/${provider}/${rec.id}` : '',
        returnBase: `${publicUrl}/return/${provider}`,
        hostedUrl: rec ? `${publicUrl}/hosted/${rec.id}` : '',
        reference: rec ? rec.id : '',
        kind: rec ? rec.kind : '',
        ref: rec ? rec.ref || '' : '',
        data: rec ? Object.assign({}, rec.data) : {},
        settings: rec ? rec.settings || {} : {},
        investor: rec ? openPersonal(rec, 'investor') || {} : {},
        names: rec && rec.names ? openPersonal(rec, 'names') || [] : undefined
      },
      extra
    );

  /** Merge an adapter's normalized result into a record, ignoring statuses the portal would not understand. */
  function apply(table, rec, r) {
    if (!r || typeof r !== 'object') return rec;
    const patch = { id: rec.id };
    const kind = table === 'screenings' ? 'aml' : rec.kind;
    if (r.status) {
      if (STATUSES[kind].includes(r.status)) {
        patch.status = r.status;
        patch.providerStatus = '';
      } else {
        // Leave the status as it is and show the provider's value so an admin can fix the mapping.
        patch.providerStatus = String(r.status).slice(0, 60);
        store.event({ type: 'unmapped_status', provider: rec.provider, id: rec.id, status: patch.providerStatus });
      }
    }
    for (const k of RESULT_FIELDS) if (r[k] !== undefined && r[k] !== null && r[k] !== '') patch[k] = r[k];
    if (r.ref) patch.ref = String(r.ref);
    if (r.url) patch.url = String(r.url);
    // Hits that came with a status we do not understand are not applied either.
    if (r.hits && !(r.status && !patch.status)) {
      patch.hits = r.hits;
      if (!r.status) {
        patch.status = r.hits.length ? 'potential_match' : 'clear';
        patch.providerStatus = '';
      }
    }
    // When the result arrived: an invitation's submission dates a verification or screening from it (lib/invitations.mjs
    // confirmChecks), never from the investor's browser. Set only when the status changes, so a repeated webhook cannot
    // make an old result look new; cleared while the check is pending again.
    if (patch.status && patch.status !== rec.status) patch.completedAt = patch.status === 'pending' ? '' : new Date(now()).toISOString();
    if (r.data && typeof r.data === 'object') patch.data = Object.assign({}, rec.data, r.data);
    return store.put(table, patch);
  }

  /** What the portal may see: never `data` (tokens, provider-private ids) or the investor's details. */
  const view = (rec) => ({ id: rec.id, kind: rec.kind, provider: rec.provider, status: rec.status, method: rec.method || '', detail: rec.detail || '', expiresAt: rec.expiresAt || '', screening: rec.screening || null, evidence: rec.evidence || [], url: rec.url || '', providerStatus: rec.providerStatus || '', completedAt: rec.completedAt || '', updatedAt: rec.updatedAt || '' });
  const screeningView = (rec) => ({ id: rec.id, provider: rec.provider, status: rec.status, hits: rec.hits || [], monitoring: !!rec.monitoring, providerStatus: rec.providerStatus || '', completedAt: rec.completedAt || '', updatedAt: rec.updatedAt || '' });

  async function refresh(rec, force) {
    const p = PROVIDERS[rec.provider];
    if (!p || !p.fetchResult || rec.status !== 'pending' || !rec.ref) return rec;
    if (!force && rec.checkedAt && Date.now() - Date.parse(rec.checkedAt) < REFRESH_MS) return rec;
    store.put('verifications', { id: rec.id, checkedAt: new Date().toISOString() });
    const r = await p.fetchResult(ctx(rec.provider, rec));
    return apply('verifications', store.get('verifications', rec.id), r);
  }
  async function refreshScreening(rec, force) {
    const p = PROVIDERS[rec.provider];
    if (!p || !p.fetchScreening || !rec.ref) return rec;
    if (!force && rec.checkedAt && Date.now() - Date.parse(rec.checkedAt) < REFRESH_MS) return rec;
    store.put('screenings', { id: rec.id, checkedAt: new Date().toISOString() });
    const r = await p.fetchScreening(ctx(rec.provider, rec));
    return apply('screenings', store.get('screenings', rec.id), r);
  }

  /** Redirects to provider pages must be https (or back to this server). */
  const safeRedirect = (u) => typeof u === 'string' && (/^https:\/\//i.test(u) || u.startsWith(publicUrl + '/'));
  /** The portal may ask to be linked back to after a hosted flow; only its own origins are accepted. */
  function returnTo(raw) {
    if (typeof raw !== 'string' || !/^https?:\/\//i.test(raw)) return '';
    const u = raw.slice(0, 500);
    // A valid web address only (a link built from it must parse too).
    try {
      const p = new URL(u);
      if (!/^https?:$/.test(p.protocol) || !p.hostname) return '';
    } catch {
      return '';
    }
    if (!origins.length || origins.includes('*')) return u;
    return origins.some((o) => u === o || u.startsWith(o + '/') || u.startsWith(o + '?') || u.startsWith(o + '#')) ? u : '';
  }
  /** Reply to a hosted page or return URL with whatever the adapter asked for. */
  function hostedReply(res, rec, r, fallback) {
    if (r && r.redirect && safeRedirect(r.redirect)) {
      res.writeHead(302, { Location: r.redirect, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      return res.end();
    }
    if (r && r.html) return send(res, 200, r.html, HTML);
    return send(res, 200, donePage(rec, (r && r.message) || fallback), HTML);
  }

  /** Whether reading is available (the key's value is never read out). */
  async function readerOn() {
    try {
      return !!(await intake.available());
    } catch {
      return false;
    }
  }

  /**
   * POST /v1/intake: the intake screen's prompt, sent to the reading service as it is. 503 before the body is read when
   * reading is not available; 400 or 413 for a bad or oversized prompt; 402 when the spend cap could be passed (before any
   * call); otherwise a 200 ndjson stream: { t } for each piece of the reply's text, { h: 1 } every 15 s while nothing else
   * is sent, then one last line { ok: true, json } or { ok: false, reason }. Its own errors never reach the global handler,
   * so no exception text, model or provider name is ever sent; the browser closing the connection stops the call.
   *
   * pdfs (optional, D-37): [{ name, data, pages, of }], the PDFs whose text layer could not be read, sent as documents
   * before the prompt. At most 5; each data base64 whose bytes start with %PDF-; 600 pages in all; a 32 MB body. With PDFs
   * the input is always counted (free) first: over 900000 tokens is 413, a failed count is 402 with a cap and 502 without.
   * D-38: the prompt has no character limit of its own (the whole text of the documents is sent); a prompt over 200000
   * characters is always counted the same way, so one past the reading service's input limit is refused before any call.
   */
  const INTAKE_COUNT_CHARS = 200000;
  const INTAKE_BODY = 32 * 1024 * 1024;
  const INTAKE_PDFS = 5;
  const INTAKE_PAGES = 600;
  const INTAKE_TOKENS = 900000;
  /** The request's PDFs: [] when there are none, null when malformed, 'too_large' past the count or page limits. */
  function intakePdfs(list) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list)) return null;
    if (!list.length) return [];
    if (list.length > INTAKE_PDFS) return 'too_large';
    let pages = 0;
    for (const p of list) {
      if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
      if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 300) return null;
      if (typeof p.data !== 'string' || !p.data.length || p.data.length % 4 !== 0 || !B64.test(p.data)) return null;
      if (!Buffer.from(p.data.slice(0, 12), 'base64').subarray(0, 5).equals(Buffer.from('%PDF-'))) return null;
      if (!Number.isInteger(p.pages) || p.pages < 1 || !Number.isInteger(p.of) || p.of < p.pages) return null;
      pages += p.pages;
    }
    if (pages > INTAKE_PAGES) return 'too_large';
    return list.map((p) => ({ name: p.name, data: p.data, pages: p.pages, of: p.of }));
  }
  const REASONS = ['declined', 'incomplete', 'invalid', 'timeout', 'failed'];
  async function readIntake(req, res) {
    const t0 = Date.now();
    const record = (o) => logLine(env, Object.assign({ at: new Date().toISOString(), route: 'intake', ms: Date.now() - t0, chars: 0, counted: null, outcome: '', stopReason: '', model: '', usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, cost: 0 }, o));
    try {
      if (!(await readerOn())) return send(res, 503, { ok: false, reason: 'unavailable' });
      let raw;
      try {
        raw = await readRaw(req, INTAKE_BODY);
      } catch (e) {
        return send(res, e && e.status === 413 ? 413 : 400, { ok: false, reason: e && e.status === 413 ? 'too_large' : 'invalid' });
      }
      let body = null;
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        body = null;
      }
      raw = null;
      const obj = body && typeof body === 'object' && !Array.isArray(body) ? body : null;
      body = null;
      const prompt = obj ? obj.prompt : undefined;
      if (typeof prompt !== 'string' || !prompt.length) return send(res, 400, { ok: false, reason: 'invalid' });
      const pdfs = intakePdfs(obj.pdfs);
      if (pdfs === null) return send(res, 400, { ok: false, reason: 'invalid' });
      if (pdfs === 'too_large') return send(res, 413, { ok: false, reason: 'too_large' });
      // The read log counts the PDFs and their pages (numbers only), and only when there are some.
      const sent = pdfs.length ? { pdfs: pdfs.length, pdfPages: pdfs.reduce((a, p) => a + p.pages, 0) } : {};

      // The spend cap: the request counted (free) and the worst case of this call checked before anything is spent. With
      // PDFs or a long prompt the request is always counted, so one past the reading service's input limit is refused
      // before any call.
      let counted = null;
      const budget = intake.budget;
      const capped = !!(budget && budget.on);
      const large = pdfs.length > 0 || prompt.length > INTAKE_COUNT_CHARS;
      if (capped || large) {
        try {
          counted = pdfs.length ? await intake.count(prompt, pdfs) : await intake.count(prompt);
        } catch {
          counted = null;
        }
        if (large && counted !== null && counted > INTAKE_TOKENS) {
          record(Object.assign({ chars: prompt.length, counted, outcome: 'too_large' }, sent));
          return send(res, 413, { ok: false, reason: 'too_large' });
        }
        if (capped && (counted === null || !budget.allow(counted, intake.maxTokens()))) {
          record(Object.assign({ chars: prompt.length, counted, outcome: 'spend_cap' }, sent));
          console.error('intake: spend_cap 402');
          return send(res, 402, { ok: false, reason: 'spend_cap' });
        }
        if (counted === null) {
          record(Object.assign({ chars: prompt.length, counted, outcome: 'failed' }, sent));
          console.error('intake: failed 502');
          return send(res, 502, { ok: false, reason: 'failed' });
        }
      }

      const ctl = new AbortController();
      const onClose = () => {
        if (!res.writableFinished) ctl.abort();
      };
      res.on('close', onClose);
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      let last = Date.now();
      const write = (o) => {
        if (res.writableEnded || res.destroyed) return;
        res.write(JSON.stringify(o) + '\n');
        last = Date.now();
      };
      const beat = setInterval(() => {
        if (Date.now() - last >= 15000) write({ h: 1 });
      }, 1000);
      if (beat.unref) beat.unref();
      let r;
      try {
        r = await intake.run(prompt, Object.assign({ signal: ctl.signal, onText: (t) => write({ t: String(t) }) }, pdfs.length ? { pdfs } : {}));
      } catch {
        r = null;
      } finally {
        clearInterval(beat);
      }
      r = r || { ok: false, reason: 'failed' };
      const ok = !!(r.ok && r.json && typeof r.json === 'object' && !Array.isArray(r.json));
      const reason = ok ? '' : ctl.signal.aborted ? 'cancelled' : REASONS.includes(r.reason) ? r.reason : 'failed';
      write(ok ? { ok: true, json: r.json } : { ok: false, reason: reason === 'cancelled' ? 'failed' : reason });
      res.off('close', onClose);
      if (!res.writableEnded) res.end();
      const usage = r.usage || {};
      const cost = costOf(usage, r.model);
      if (budget && budget.add) budget.add(usage, r.model);
      record(Object.assign({ ms: Number(r.ms) || Date.now() - t0, chars: prompt.length, counted, outcome: ok ? 'read' : reason, stopReason: String(r.stopReason || ''), model: String(r.model || ''), usage: { input_tokens: Number(usage.input_tokens) || 0, output_tokens: Number(usage.output_tokens) || 0, cache_creation_input_tokens: Number(usage.cache_creation_input_tokens) || 0, cache_read_input_tokens: Number(usage.cache_read_input_tokens) || 0 }, cost: cost.usd }, sent));
      if (!ok) console.error(`intake: ${reason}${r.status ? ' ' + Number(r.status) : ''}`);
    } catch {
      if (!res.headersSent) return send(res, 500, { ok: false, reason: 'failed' });
      if (!res.writableEnded) {
        res.write(JSON.stringify({ ok: false, reason: 'failed' }) + '\n');
        res.end();
      }
    }
  }

  /**
   * POST /v1/read: an uploaded agreement and the numbered places the browser measured on it, read by the reading service.
   * 503 before the body is read when reading is not available; 400 for a malformed request, 413 for one over the limits
   * (32 MB body, 600 pages, 4 MB of text, 20000 places); 402 when the spend cap could be passed (before any call);
   * otherwise 200 { ok: true, fields, missing, ms } or a failure { ok: false, reason } (504 timeout; 502 declined,
   * incomplete, invalid or failed). Its own errors never reach the global handler, so no exception text, model or
   * provider name is ever sent; the browser closing the connection stops the call. The PDF is never stored.
   *
   * D-38, both optional: images [{ page, data, marks }], a picture of each page with numbered places (picture pages, pages
   * whose text layer cannot be read, and since D-43 every text page with a place) with the candidates drawn and numbered on it (data base64 JPEG or PNG, at most IMAGE_BYTES each and IMAGE_MAX in
   * all, one per page; marks the numbers drawn on it); range [first, last, of], when the PDF holds only pages first..last
   * of a longer agreement: the list's pages are then the agreement's own, inside the range, and its numbers are the
   * agreement's (increasing, not from 1). With images, or a PDF of more than 100 pages or 8 MB, the request is always
   * counted (free) first: over 900000 tokens is 413 too_large (the browser then sends smaller ranges), a failed count is
   * 402 with a cap and 502 without. Without either, the request is plan 64's exactly.
   */
  const READ_BODY = 32 * 1024 * 1024;
  const READ_TEXT = 4 * 1024 * 1024;
  const READ_PLACES = 20000;
  const READ_PAGES = 600;
  const READ_TOKENS = 900000;
  const READ_COUNT_PAGES = 100;
  const READ_COUNT_CHARS = 8 * 1024 * 1024;
  /** An image's type from its first bytes: JPEG or PNG, else ''. */
  const imageType = (data) => {
    const head = Buffer.from(data.slice(0, 12), 'base64');
    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
    if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    return '';
  };
  const READ_STATUS = { unavailable: 503, timeout: 504, declined: 502, incomplete: 502, invalid: 502, failed: 502 };
  const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
  async function readAgreement(req, res) {
    const t0 = Date.now();
    const zero = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
    const record = (o) => logLine(env, Object.assign({ at: new Date().toISOString(), route: 'read', ms: Date.now() - t0, pages: 0, candidates: 0, outcome: '', stopReason: '', model: '', usage: zero, cost: 0 }, o));
    const fail = (status, reason) => send(res, status, { ok: false, reason });
    try {
      let on = false;
      try {
        on = !!(await reader.available());
      } catch {
        on = false;
      }
      if (!on) return fail(503, 'unavailable');
      let raw;
      try {
        raw = await readRaw(req, READ_BODY);
      } catch (e) {
        return e && e.status === 413 ? fail(413, 'too_large') : fail(400, 'invalid');
      }
      let body = null;
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        body = null;
      }
      raw = null;
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'invalid');
      const { pdf, pages, text, list } = body;
      if (typeof pdf !== 'string' || !pdf.length || pdf.length % 4 !== 0 || !B64.test(pdf)) return fail(400, 'invalid');
      if (!Number.isInteger(pages) || pages < 1) return fail(400, 'invalid');
      if (pages > READ_PAGES) return fail(413, 'too_large');
      if (typeof text !== 'string' || !text.trim()) return fail(400, 'invalid');
      if (text.length > READ_TEXT) return fail(413, 'too_large');
      if (!Array.isArray(list) || !list.length) return fail(400, 'invalid');
      if (list.length > READ_PLACES) return fail(413, 'too_large');
      // A page range of a longer agreement (D-38): the list's pages are the agreement's own, inside the range.
      const range = body.range === undefined || body.range === null ? null : body.range;
      if (range !== null && !(Array.isArray(range) && range.length === 3 && range.every((n) => Number.isInteger(n)) && range[0] >= 1 && range[1] >= range[0] && range[2] >= range[1] && range[1] - range[0] + 1 === pages)) return fail(400, 'invalid');
      const first = range ? range[0] : 1;
      const last = range ? range[1] : pages;
      const place = (e, i) => Array.isArray(e) && e.length === 7 && (range ? Number.isInteger(e[0]) && e[0] >= 1 && (i === 0 || e[0] > list[i - 1][0]) : e[0] === i + 1) && Number.isInteger(e[1]) && e[1] >= first && e[1] <= last && e.slice(2, 6).every((n) => typeof n === 'number' && Number.isFinite(n)) && typeof e[6] === 'string' && e[6].length <= 16;
      if (!list.every(place)) return fail(400, 'invalid');
      const count = list.length;
      // Page images (D-38): at most one per page of the range, JPEG or PNG, within the published limits.
      let images = null;
      if (body.images !== undefined && body.images !== null) {
        if (!Array.isArray(body.images)) return fail(400, 'invalid');
        if (body.images.length > IMAGE_MAX) return fail(413, 'too_large');
        const seenPages = new Set();
        images = [];
        for (const im of body.images) {
          if (!im || typeof im !== 'object' || Array.isArray(im)) return fail(400, 'invalid');
          if (!Number.isInteger(im.page) || im.page < first || im.page > last || seenPages.has(im.page)) return fail(400, 'invalid');
          if (typeof im.data !== 'string' || !im.data.length || im.data.length % 4 !== 0 || !B64.test(im.data)) return fail(400, 'invalid');
          if (im.data.length > IMAGE_BYTES) return fail(413, 'too_large');
          const media = imageType(im.data);
          if (!media) return fail(400, 'invalid');
          if (im.marks !== undefined && !(Array.isArray(im.marks) && im.marks.length <= READ_PLACES && im.marks.every((n) => Number.isInteger(n) && n >= 1))) return fail(400, 'invalid');
          seenPages.add(im.page);
          images.push(Object.assign({ page: im.page, media_type: media, data: im.data }, im.marks ? { marks: im.marks.slice() } : {}));
        }
        if (!images.length) images = null;
      }

      // The spend cap: the request counted (free) and the worst case of this call checked before anything is spent. With
      // images or a large PDF the request is always counted, so one past the reading service's input limit is refused
      // before any call (the browser then reads smaller page ranges).
      let counted = null;
      const budget = reader.budget;
      const capped = !!(budget && budget.on);
      const large = !!images || pages > READ_COUNT_PAGES || pdf.length > READ_COUNT_CHARS;
      const sent = images ? { images: images.length } : {};
      if (capped || large) {
        try {
          counted = images ? await reader.count({ pdf, text, images }) : await reader.count({ pdf, text });
        } catch {
          counted = null;
        }
        if (large && counted !== null && counted > READ_TOKENS) {
          record(Object.assign({ pages, candidates: count, counted, outcome: 'too_large' }, sent));
          return fail(413, 'too_large');
        }
        if (capped && (counted === null || !budget.allow(counted, reader.maxTokens()))) {
          record(Object.assign({ pages, candidates: count, outcome: 'spend_cap' }, sent));
          console.error('read: spend_cap 402');
          return fail(402, 'spend_cap');
        }
        if (counted === null) {
          record(Object.assign({ pages, candidates: count, counted, outcome: 'failed' }, sent));
          console.error('read: failed 502');
          return fail(502, 'failed');
        }
      }

      const ctl = new AbortController();
      const onClose = () => {
        if (!res.writableFinished) ctl.abort();
      };
      res.on('close', onClose);
      let r;
      try {
        const req = { pdf, pages, text, count, list };
        if (range) Object.assign(req, { ids: list.map((e) => e[0]), first, last, range });
        if (images) req.images = images;
        r = await reader.read(req, { signal: ctl.signal });
      } catch {
        r = null;
      }
      res.off('close', onClose);
      r = r || { ok: false, reason: 'failed' };
      const ok = !!(r.ok && Array.isArray(r.fields) && Array.isArray(r.missing));
      const reason = ok ? '' : READ_STATUS[r.reason] ? r.reason : 'failed';
      const status = ok ? 200 : READ_STATUS[reason];
      if (!res.writableEnded && !res.destroyed) {
        if (ok) send(res, 200, { ok: true, fields: r.fields, missing: r.missing, ms: Number(r.ms) || Date.now() - t0 });
        else fail(status, reason);
      }
      const usage = r.usage || {};
      const cost = costOf(usage, r.model);
      if (budget && budget.add) budget.add(usage, r.model);
      record(Object.assign({ ms: Number(r.ms) || Date.now() - t0, pages, candidates: count, counted, outcome: ok ? 'read' : ctl.signal.aborted ? 'cancelled' : reason, stopReason: String(r.stopReason || ''), model: String(r.model || ''), usage: { input_tokens: Number(usage.input_tokens) || 0, output_tokens: Number(usage.output_tokens) || 0, cache_creation_input_tokens: Number(usage.cache_creation_input_tokens) || 0, cache_read_input_tokens: Number(usage.cache_read_input_tokens) || 0 }, cost: cost.usd }, sent));
      if (!ok) console.error(`read: ${reason} ${status}`);
    } catch {
      if (!res.headersSent) fail(502, 'failed');
      console.error('read: failed 502');
    }
  }

  /** The largest help request body: one question of at most 500 characters and a few short keys. */
  const HELP_BODY = 8 * 1024;
  /**
   * Who a help session belongs to: the invitation for an investor's link, one shared owner for the console's token.
   * This is the one place to change when callers have accounts: the owner becomes the account's id.
   */
  const helpOwner = (scope, auth) => (scope ? `inv:${scope.id}` : auth && auth.account ? `acct:${auth.account.id}` : 'sponsor');
  async function answerHelp(req, res, scope, auth) {
    const fail = (status, reason) => send(res, status, { ok: false, reason });
    try {
      let on = false;
      try {
        on = !!(await help.available());
      } catch {
        on = false;
      }
      if (!on) return fail(503, 'unavailable');
      let raw;
      try {
        raw = await readRaw(req, HELP_BODY);
      } catch (e) {
        return e && e.status === 413 ? fail(413, 'too_large') : fail(400, 'invalid');
      }
      let body = null;
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        body = null;
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'invalid');
      const ctl = new AbortController();
      const onClose = () => {
        if (!res.writableFinished) ctl.abort();
      };
      res.on('close', onClose);
      let r;
      try {
        // Only these five fields of the body are read; who is asking comes from the credential, never from the body.
        r = await help.ask({ message: body.message, session: body.session, page: body.page, step: body.step, role: body.role, investor: !!scope, owner: helpOwner(scope, auth), client: clientOf(req, env) }, { signal: ctl.signal });
      } catch {
        r = null;
      }
      res.off('close', onClose);
      const sound = !!(r && r.body && Number.isInteger(r.status));
      if (!sound) r = { status: 502, body: { ok: false, reason: 'failed' }, row: null };
      if (!res.writableEnded && !res.destroyed) send(res, r.status, r.body);
      if (!sound) console.error('help: failed 502');
      if (r.row) {
        // What the question used counts against the shared cap, and its numbers (never its words) go to the read log.
        if (help.budget && help.budget.add) help.budget.add(r.row.usage, r.row.model);
        logLine(env, Object.assign({ at: new Date(now()).toISOString(), route: 'help' }, r.row));
        if (r.status !== 200) console.error(`help: ${r.body.reason} ${r.status}`);
      }
    } catch {
      if (!res.headersSent) fail(502, 'failed');
      console.error('help: failed 502');
    }
  }

  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    // This server's own pages (the sandbox stand-in and the pages it hosts for provider flows) post their forms back to
    // themselves. Browsers send this server's own origin with those posts, or "null" (these pages are served with
    // Referrer-Policy: no-referrer), never the portal's, so PORTAL_ORIGIN would refuse them. Those routes take no token and
    // are reached only through unguessable check ids (a client without a browser can simply leave Origin out), so the Origin
    // check adds nothing there and is skipped; every other route, the API included, still answers PORTAL_ORIGIN only.
    const ownPage = /^\/(sandbox|hosted|billing)\//.test(path);
    if (!ownPage && !cors(req, res, env.PORTAL_ORIGIN)) return send(res, 403, { error: 'Origin not allowed' });
    if (req.method === 'OPTIONS') return send(res, 204, '');

    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true, providers: configured(env, PROVIDERS), reader: await readerOn() });

    // Provider callbacks: verify the signature over the exact bytes received, then update the record.
    const hook = path.match(/^\/webhooks\/([a-z0-9]+)$/);
    if (req.method === 'POST' && hook) {
      const name = hook[1];
      const p = PROVIDERS[name];
      if (!p || !p.verifyWebhook) return send(res, 404, { error: 'Unknown provider' });
      // A provider whose settings are not all set (an empty webhook secret, say) cannot accept deliveries.
      if (missingEnv(p, env).length) {
        store.event({ type: 'webhook_rejected', provider: name, reason: 'not_configured' });
        return send(res, 404, { error: 'Unknown provider' });
      }
      const raw = await readRaw(req);
      const ok = await p.verifyWebhook({ rawBody: raw, headers: req.headers, env, fetch: fetchFn, query: Object.fromEntries(url.searchParams) });
      if (!ok) {
        store.event({ type: 'webhook_rejected', provider: name });
        return send(res, 401, { error: 'Bad signature' });
      }
      const body = parseJson(raw);
      const ev = (await p.parseWebhook({ body, headers: req.headers, rawBody: raw, env })) || {};
      if (ev.id && store.seen(`${name}:${ev.id}`)) return send(res, 200, { received: true, duplicate: true });
      store.event({ type: 'webhook', provider: name, event: ev.event || '', ref: ev.ref || '' });
      const refs = [].concat(ev.ref || []).filter(Boolean).map(String);
      // A provider's payload may name our reference (ver_…/scr_…) instead of its own id.
      const own = (table, ref) => {
        const rec = REF_ID.test(ref) ? store.get(table, ref) : null;
        return rec && rec.provider === name ? rec : null;
      };
      const result = (kind) => Object.assign({}, p.webhookResult ? p.webhookResult(kind, ev) : ev, { ref: undefined, url: undefined, data: undefined, id: undefined });
      for (const ref of refs) {
        const ver = store.byRef('verifications', name, ref) || own('verifications', ref);
        const scr = ver ? null : store.byRef('screenings', name, ref) || own('screenings', ref);
        if (ver) {
          if (ev.refetch) {
            if (p.fetchResult) await refresh(Object.assign({}, ver, { status: 'pending', ref: ver.ref || ver.id }), true).catch((e) => store.event({ type: 'refresh_failed', provider: name, id: ver.id, error: e.message }));
          } else apply('verifications', ver, result(ver.kind));
        } else if (scr) {
          if (ev.refetch) {
            if (p.fetchScreening) await refreshScreening(scr, true).catch((e) => store.event({ type: 'refresh_failed', provider: name, id: scr.id, error: e.message }));
          } else apply('screenings', scr, result('aml'));
        }
      }
      return send(res, 200, { received: true });
    }

    // Where providers send the investor back (OAuth codes, account links). Our record id is in the
    // path (ctx.returnUrl) or, for providers that only accept one registered redirect URL
    // (ctx.returnBase), in a query parameter the adapter names (state, identifier or reference by default).
    const back = path.match(/^\/return\/([a-z0-9]+)(?:\/(ver_[\w-]+))?$/);
    if (req.method === 'GET' && back) {
      const p = PROVIDERS[back[1]];
      const q = Object.fromEntries(url.searchParams);
      const rid = back[2] || (p && p.returnRecordId ? p.returnRecordId(q) : q.state || q.identifier || q.reference) || '';
      const rec = /^ver_[\w-]+$/.test(rid) ? store.get('verifications', rid) : null;
      if (!p || !rec || rec.provider !== back[1]) return send(res, 404, 'Unknown verification');
      if (!p.handleReturn) return hostedReply(res, rec, null, 'Thank you. Your information was sent.');
      const r = (await p.handleReturn(ctx(rec.provider, rec, { query: q }))) || {};
      const cur = apply('verifications', rec, r);
      store.event({ type: 'return', provider: rec.provider, id: rec.id });
      return hostedReply(res, cur, r, cur.status === 'pending' ? 'Thank you. Your information was submitted for review.' : 'Thank you. You can return to the portal.');
    }

    // Pages this server hosts for a provider flow (for example to run a provider's JS SDK the portal cannot load).
    const hosted = path.match(/^\/hosted\/(ver_[\w-]+)$/);
    if (hosted && (req.method === 'GET' || req.method === 'POST')) {
      const rec = store.get('verifications', hosted[1]);
      const p = rec && PROVIDERS[rec.provider];
      if (!rec || !p) return send(res, 404, 'Unknown verification');
      if (req.method === 'GET') {
        if (p.page) {
          const c = ctx(rec.provider, rec);
          return send(res, 200, await p.page(Object.assign({}, rec, { investor: c.investor }), c), HTML);
        }
        // Links the portal supplied (the "link" provider) are never redirected to from this server's
        // domain: that would make it an open redirect. The portal already has the link.
        const portalLink = p.start === 'portal-link';
        if (!portalLink && rec.url && safeRedirect(rec.url) && rec.url !== `${publicUrl}/hosted/${rec.id}`) return hostedReply(res, rec, { redirect: rec.url });
        return send(res, 404, 'Nothing to show');
      }
      if (limited(req)) return send(res, 429, { error: 'Too many requests' });
      if (!p.hostedPost) return send(res, 405, 'Not allowed');
      const raw = await readRaw(req, 256 * 1024);
      const type = String(header(req.headers, 'content-type') || '');
      const form = type.includes('application/json') ? parseObject(raw) : Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
      const r = (await p.hostedPost(ctx(rec.provider, rec, { form }))) || {};
      const cur = apply('verifications', rec, r);
      if (type.includes('application/json')) return send(res, 200, { ok: true, status: cur.status, redirect: r.redirect && safeRedirect(r.redirect) ? r.redirect : '' });
      return hostedReply(res, cur, r, 'Thank you. You can return to the portal.');
    }

    // Sandbox provider: a stand-in hosted page so the live flow can be tried without provider accounts.
    const sbx = path.match(/^\/sandbox\/(sbx_[\w-]+)$/);
    if (sbx && PROVIDERS.sandbox) {
      const rec = store.byRef('verifications', 'sandbox', sbx[1]);
      if (!rec) return send(res, 404, 'Unknown sandbox session');
      if (req.method === 'POST') {
        const form = new URLSearchParams((await readRaw(req)).toString('utf8'));
        const outcome = form.get('outcome');
        const allowed = rec.kind === 'identity' ? ['passed', 'review', 'failed'] : ['verified', 'review', 'rejected'];
        if (!allowed.includes(outcome)) return send(res, 400, 'Unknown outcome');
        const extra = rec.kind === 'accreditation' && outcome === 'verified' ? { expiresAt: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10) } : {};
        apply('verifications', rec, Object.assign({ status: outcome, method: form.get('method') || '' }, extra));
        return send(res, 200, donePage(rec, 'Done'), HTML);
      }
      return send(res, 200, PROVIDERS.sandbox.page(rec), HTML);
    }
    if (path.startsWith('/billing/')) return req.method === 'POST' && limited(req) ? send(res, 429, { error: 'Too many requests' }) : billing.handle(req, res, url, null); // the hosted card page (lib/billing.mjs); no token reaches it

    // Results pushed by a provider or the sponsor's own automation (for "link" checks, or any provider
    // that reports outcomes this way). Off unless RESULTS_TOKEN is set; it has its own token, not API_TOKEN.
    if (path === '/v1/results') {
      if (!env.RESULTS_TOKEN) return send(res, 404, { error: 'Not found' });
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
      if (limited(req)) return send(res, 429, { error: 'Too many requests' });
      if (!resultsAuthorized(req, env)) return send(res, 401, { error: 'Not authorized' });
      const body = parseObject(await readRaw(req, 256 * 1024));
      const ref = String(body.reference || '');
      const table = ref.startsWith('scr_') ? 'screenings' : 'verifications';
      const rec = REF_ID.test(ref) ? store.get(table, ref) : null;
      if (!rec) return send(res, 404, { error: 'No check with that reference' });
      const kind = table === 'screenings' ? 'aml' : rec.kind;
      if (!STATUSES[kind].includes(body.status)) return send(res, 400, { error: `status must be one of ${STATUSES[kind].join(', ')}` });
      const r = { status: body.status };
      if (table === 'verifications') {
        if (body.method !== undefined) r.method = clip(body.method, 120);
        if (body.detail !== undefined) r.detail = clip(body.detail, 300);
        if (body.expiresAt !== undefined) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.expiresAt))) return send(res, 400, { error: 'expiresAt must be YYYY-MM-DD' });
          r.expiresAt = body.expiresAt;
        }
        if (body.evidence !== undefined) {
          if (!(r.evidence = cleanEvidence(body.evidence))) return send(res, 400, { error: 'evidence must be a list' });
        }
        if (body.screening !== undefined && body.screening !== null) {
          const sc = body.screening;
          if (!sc || !['clear', 'potential_match'].includes(sc.status)) return send(res, 400, { error: 'screening.status must be clear or potential_match' });
          r.screening = { status: sc.status, hits: cleanHits(sc.hits) || [] };
        }
      } else if (body.hits !== undefined) {
        if (!(r.hits = cleanHits(body.hits))) return send(res, 400, { error: 'hits must be a list' });
      }
      const saved = apply(table, rec, r);
      store.event({ type: 'result_pushed', provider: rec.provider, id: rec.id, status: saved.status });
      return send(res, 200, { ok: true, id: saved.id, status: saved.status });
    }

    // An invitation link's token (X-Invite-Token) authorizes the investor's own browser for its
    // onboarding and its own verification and screening calls, never the sponsor's routes.
    const inviteToken = header(req.headers, 'x-invite-token');
    let scope = null;
    if (path.startsWith('/v1/') && inviteToken !== undefined) {
      if (!invites.investorPath(req.method, path)) return send(res, 401, { error: 'Not authorized' });
      scope = invites.authenticate(req, inviteToken);
    }
    if (/^\/v1\/invite(\/|$)/.test(path)) {
      if (['PUT', 'POST'].includes(req.method) && limited(req)) return send(res, 429, { error: 'Too many requests' });
      return invites.investor(req, res, path, scope);
    }

    // Sponsor accounts (ADMIN_TOKEN): below the invitation token's refusal above, so an investor's link never reaches them.
    if (/^\/v1\/admin(\/|$)/.test(path)) return admin(req, res, path);
    if (/^\/v1\/filings\/staff(\/|$)/.test(path)) return filings.staff(req, res, url);

    const auth = path.startsWith('/v1/') && !scope ? sponsorAuth(req) : null;
    if (path.startsWith('/v1/') && !scope && !auth) return send(res, 401, { error: 'Not authorized' });
    // A sponsor account's calls are pinned to its workspace: what it writes is stored there whatever the request says, and
    // another workspace's record answers 404 (never 403, which would confirm the record exists).
    const pin = auth && auth.account ? auth.account.workspace : null;
    const foreign = (rec) => pin !== null && (rec.workspace || '') !== pin;
    if (path.startsWith('/v1/') && ['POST', 'PUT', 'DELETE'].includes(req.method) && limited(req)) return send(res, 429, { error: 'Too many requests' });
    if (/^\/v1\/billing(\/|$)/.test(path)) return billing.handle(req, res, url, auth); // the sponsor's card, credit and package payments; the account comes from auth only

    if (req.method === 'GET' && path === '/v1/connectors' && auth && auth.account) return send(res, 200, { connectors: pkg.connectors(describe(env, PROVIDERS)) }); // a sponsor account never sees the package providers (08-15)
    if (req.method === 'GET' && path === '/v1/connectors') return send(res, 200, { connectors: describe(env, PROVIDERS) });

    if (path === '/v1/intake') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
      return readIntake(req, res);
    }

    if (path === '/v1/read') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
      return readAgreement(req, res);
    }

    if (path === '/v1/help') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
      return answerHelp(req, res, scope, auth);
    }

    if (req.method === 'POST' && path === '/v1/verifications') {
      const body = parseObject(await readRaw(req));
      const p = PROVIDERS[body.provider];
      if (!p || !(p.kinds || [p.kind]).includes(body.kind) || body.kind === 'aml' || !p.createSession) return send(res, 400, { error: `No ${body.kind || ''} provider named "${body.provider || ''}"` });
      const missing = missingEnv(p, env);
      if (missing.length) return send(res, 400, { error: `Set ${missing.join(', ')} on the integration server` });
      const investor = cleanInvestor(body.investor);
      if (!investor.id || !investor.name) return send(res, 400, { error: 'investor.id and investor.name are required' });
      if (scope && investor.id !== scope.investorId) return send(res, 403, { error: 'This invitation can only verify its own investor' });
      // An invitation's token runs only the checks the firm's settings use (never the test sandbox, which runs in the browser).
      if (scope && !(invites.scopeRules(scope).providers[body.kind] || []).includes(body.provider)) return send(res, 403, { error: 'This check is not one the firm uses' });
      pkg.gate(scope, auth, body.provider, body.kind); // a package provider: only from the invitation holding its own paid package (08-15)
      if (scope) investor.workspace = scope.workspace;
      if (pin !== null) investor.workspace = pin;
      const vid = id('ver');
      body.settings = pkg.settings(scope, body.provider, body.settings); // a package check runs with the invitation's firm name only
      // createdAt is on the same clock as invitations: a submission counts only checks created once its invitation existed.
      const rec = store.put('verifications', { id: vid, kind: body.kind, provider: body.provider, investorId: investor.id, workspace: investor.workspace, invitationId: scope ? scope.id : undefined, status: 'pending', settings: cleanSettings(body.settings), investor: sealPersonal('verifications', vid, 'investor', investor), returnUrl: returnTo(body.returnUrl), createdAt: new Date(now()).toISOString() });
      const r = (await pkg.start(scope, body.provider, () => p.createSession(ctx(body.provider, rec)), body.kind)) || {};
      const saved = apply('verifications', rec, Object.assign({}, r, { status: r.status || 'pending' }));
      store.event({ type: 'verification_started', provider: body.provider, id: rec.id, ref: saved.ref || '' });
      return send(res, 200, { id: saved.id, status: saved.status, url: saved.url || '' });
    }

    const ver = path.match(/^\/v1\/verifications\/(ver_[\w-]+)$/);
    if (req.method === 'GET' && ver) {
      const rec = store.get('verifications', ver[1]);
      if (!rec || foreign(rec)) return send(res, 404, { error: 'Not found' });
      if (scope && !ownCheck(rec, scope)) return send(res, 403, { error: 'This invitation can only see its own investor’s checks' });
      return send(res, 200, view(await refresh(rec)));
    }

    // Evidence such as a verification letter, fetched from the provider with the server's credentials.
    const evd = path.match(/^\/v1\/verifications\/(ver_[\w-]+)\/evidence\/(\d{1,2})$/);
    if (req.method === 'GET' && evd) {
      const rec = store.get('verifications', evd[1]);
      const item = rec && (rec.evidence || [])[Number(evd[2])];
      const p = rec && PROVIDERS[rec.provider];
      if (!rec || foreign(rec) || !item || !p || !p.fetchEvidence) return send(res, 404, { error: 'Not found' });
      const file = await p.fetchEvidence(ctx(rec.provider, rec, { item }));
      if (!file || !file.body) return send(res, 404, { error: 'Not found' });
      res.writeHead(200, { 'Content-Type': file.contentType || 'application/pdf', 'Content-Disposition': `attachment; filename="${String(file.fileName || 'evidence.pdf').replace(/[^\w.-]+/g, '_')}"`, 'Cache-Control': 'no-store' });
      return res.end(Buffer.from(file.body));
    }

    if (req.method === 'POST' && path === '/v1/screenings') {
      const body = parseObject(await readRaw(req));
      const p = PROVIDERS[body.provider];
      if (!p || !(p.kinds || [p.kind]).includes('aml') || !p.screen) return send(res, 400, { error: `No screening provider named "${body.provider || ''}"` });
      const missing = missingEnv(p, env);
      if (missing.length) return send(res, 400, { error: `Set ${missing.join(', ')} on the integration server` });
      if (body.names !== undefined && !Array.isArray(body.names)) return send(res, 400, { error: 'names must be a list' });
      // From an invitation's link: only the screenings the firm uses, and always the investor's names as the sponsor entered them.
      const rules = scope ? invites.scopeRules(scope) : null;
      if (rules && !rules.providers.aml.includes(body.provider)) return send(res, 403, { error: 'This screening is not one the firm uses' });
      pkg.gate(scope, auth, body.provider, 'aml'); // a package provider: only from the invitation holding its own paid package (08-15)
      const names = Array.from(new Set((rules ? rules.names : []).concat(body.names || []).map((n) => String(n || '').trim()).filter(Boolean))).slice(0, 25);
      if (!names.length) return send(res, 400, { error: 'names are required' });
      const inv = cleanInvestor(body.investor);
      if (scope && inv.id !== scope.investorId) return send(res, 403, { error: 'This invitation can only screen its own investor' });
      if (scope) inv.workspace = scope.workspace;
      if (pin !== null) inv.workspace = pin;
      const sid = id('scr');
      body.settings = pkg.settings(scope, body.provider, body.settings); // a package check runs with the invitation's firm name only
      const rec = store.put('screenings', { id: sid, kind: 'aml', provider: body.provider, investorId: inv.id, workspace: inv.workspace, invitationId: scope ? scope.id : undefined, names: sealPersonal('screenings', sid, 'names', names), settings: cleanSettings(body.settings), investor: sealPersonal('screenings', sid, 'investor', inv), status: 'pending', createdAt: new Date(now()).toISOString() });
      const r = (await pkg.start(scope, body.provider, () => p.screen(ctx(body.provider, rec, { names })), 'aml')) || {};
      const saved = apply('screenings', rec, Object.assign({ hits: r.hits || [] }, r, { ref: r.ref || rec.id }));
      if (r.monitoring) store.put('screenings', { id: rec.id, monitoring: true });
      store.event({ type: 'screening', provider: body.provider, id: rec.id, hits: (saved.hits || []).length });
      return send(res, 200, { id: saved.id, status: saved.status, hits: saved.hits || [] });
    }

    const scr = path.match(/^\/v1\/screenings\/(scr_[\w-]+)$/);
    if (req.method === 'GET' && scr) {
      const rec = store.get('screenings', scr[1]);
      if (!rec || foreign(rec)) return send(res, 404, { error: 'Not found' });
      if (scope && !ownCheck(rec, scope)) return send(res, 403, { error: 'This invitation can only see its own investor’s checks' });
      return send(res, 200, screeningView(rec.status === 'pending' ? await refreshScreening(rec) : rec));
    }

    if (/^\/v1\/filings(\/|$)/.test(path)) return filings.handle(req, res, url, auth);
    if (await invites.sponsor(req, res, url, auth)) return;

    return send(res, 404, { error: 'Not found' });
  }

  const server = http.createServer((req, res) =>
    route(req, res).catch((e) => {
      if (!e.status && env.NODE_ENV !== 'test') console.error(e);
      if (!res.headersSent) send(res, e.status || 502, { error: e.status ? e.message : `Provider request failed: ${e.message}` });
    })
  );
  server.store = store;
  server.invitations = invites;
  server.on('close', () => invites.stop());
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, () => console.log(`Integration server on http://localhost:${port} (providers: ${configured(process.env).join(', ')})`));
}
