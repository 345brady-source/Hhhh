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
 *   GET  /health                  which providers are configured
 *
 * Investor invitations (lib/invitations.mjs; see README.md):
 *   POST /v1/invitations          the console invites an investor; this server emails the link
 *   GET  /v1/invitations          their statuses; GET/DELETE /v1/invitations/:id/submission, POST …/resend, …/cancel
 *   GET  /v1/outbox               messages kept here when no SMTP server is set
 *   GET  /v1/invite               the investor's browser loads its onboarding (X-Invite-Token)
 *   PUT  /v1/invite/progress      …reports the step it is on
 *   POST /v1/invite/complete      …sends back the finished paperwork; the sponsor is emailed
 *
 * No verification vendor is built in: sponsors plug in the services they use
 * (declarative connectors, code plug-ins, or hosted links plus the results
 * API; see README.md), as many per check as they like.
 *
 * Node 18 or later, no dependencies. Configure with environment variables
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

/** A small per-client limit on the calls that can cost money or create records. */
function rateLimiter(env) {
  const max = Number(env.RATE_LIMIT_PER_MIN === undefined ? 60 : env.RATE_LIMIT_PER_MIN);
  const hits = new Map();
  return (req) => {
    if (!max) return false;
    const fwd = env.TRUST_PROXY === '1' ? String(header(req.headers, 'x-forwarded-for') || '').split(',')[0].trim() : '';
    const who = fwd || req.socket.remoteAddress || 'unknown';
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

  const invites = createInvitations({ env, store, publicUrl, returnTo: (u) => returnTo(u), limited, now, mailTls: opts.mailTls });
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


  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    // This server's own pages (the sandbox stand-in and the pages it hosts for provider flows) post their forms back to
    // themselves. Browsers send this server's own origin with those posts, or "null" (these pages are served with
    // Referrer-Policy: no-referrer), never the portal's, so PORTAL_ORIGIN would refuse them. Those routes take no token and
    // are reached only through unguessable check ids (a client without a browser can simply leave Origin out), so the Origin
    // check adds nothing there and is skipped; every other route, the API included, still answers PORTAL_ORIGIN only.
    const ownPage = /^\/(sandbox|hosted)\//.test(path);
    if (!ownPage && !cors(req, res, env.PORTAL_ORIGIN)) return send(res, 403, { error: 'Origin not allowed' });
    if (req.method === 'OPTIONS') return send(res, 204, '');

    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true, providers: configured(env, PROVIDERS) });

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

    if (path.startsWith('/v1/') && !scope && !authorize(req, env)) return send(res, 401, { error: 'Not authorized' });
    if (path.startsWith('/v1/') && ['POST', 'PUT', 'DELETE'].includes(req.method) && limited(req)) return send(res, 429, { error: 'Too many requests' });

    if (req.method === 'GET' && path === '/v1/connectors') return send(res, 200, { connectors: describe(env, PROVIDERS) });

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
      if (scope) investor.workspace = scope.workspace;
      const vid = id('ver');
      // createdAt is on the same clock as invitations: a submission counts only checks created once its invitation existed.
      const rec = store.put('verifications', { id: vid, kind: body.kind, provider: body.provider, investorId: investor.id, workspace: investor.workspace, invitationId: scope ? scope.id : undefined, status: 'pending', settings: cleanSettings(body.settings), investor: sealPersonal('verifications', vid, 'investor', investor), returnUrl: returnTo(body.returnUrl), createdAt: new Date(now()).toISOString() });
      const r = (await p.createSession(ctx(body.provider, rec))) || {};
      const saved = apply('verifications', rec, Object.assign({}, r, { status: r.status || 'pending' }));
      store.event({ type: 'verification_started', provider: body.provider, id: rec.id, ref: saved.ref || '' });
      return send(res, 200, { id: saved.id, status: saved.status, url: saved.url || '' });
    }

    const ver = path.match(/^\/v1\/verifications\/(ver_[\w-]+)$/);
    if (req.method === 'GET' && ver) {
      const rec = store.get('verifications', ver[1]);
      if (!rec) return send(res, 404, { error: 'Not found' });
      if (scope && !ownCheck(rec, scope)) return send(res, 403, { error: 'This invitation can only see its own investor’s checks' });
      return send(res, 200, view(await refresh(rec)));
    }

    // Evidence such as a verification letter, fetched from the provider with the server's credentials.
    const evd = path.match(/^\/v1\/verifications\/(ver_[\w-]+)\/evidence\/(\d{1,2})$/);
    if (req.method === 'GET' && evd) {
      const rec = store.get('verifications', evd[1]);
      const item = rec && (rec.evidence || [])[Number(evd[2])];
      const p = rec && PROVIDERS[rec.provider];
      if (!rec || !item || !p || !p.fetchEvidence) return send(res, 404, { error: 'Not found' });
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
      const names = Array.from(new Set((rules ? rules.names : []).concat(body.names || []).map((n) => String(n || '').trim()).filter(Boolean))).slice(0, 25);
      if (!names.length) return send(res, 400, { error: 'names are required' });
      const inv = cleanInvestor(body.investor);
      if (scope && inv.id !== scope.investorId) return send(res, 403, { error: 'This invitation can only screen its own investor' });
      if (scope) inv.workspace = scope.workspace;
      const sid = id('scr');
      const rec = store.put('screenings', { id: sid, kind: 'aml', provider: body.provider, investorId: inv.id, workspace: inv.workspace, invitationId: scope ? scope.id : undefined, names: sealPersonal('screenings', sid, 'names', names), settings: cleanSettings(body.settings), investor: sealPersonal('screenings', sid, 'investor', inv), status: 'pending', createdAt: new Date(now()).toISOString() });
      const r = (await p.screen(ctx(body.provider, rec, { names }))) || {};
      const saved = apply('screenings', rec, Object.assign({ hits: r.hits || [] }, r, { ref: r.ref || rec.id }));
      if (r.monitoring) store.put('screenings', { id: rec.id, monitoring: true });
      store.event({ type: 'screening', provider: body.provider, id: rec.id, hits: (saved.hits || []).length });
      return send(res, 200, { id: saved.id, status: saved.status, hits: saved.hits || [] });
    }

    const scr = path.match(/^\/v1\/screenings\/(scr_[\w-]+)$/);
    if (req.method === 'GET' && scr) {
      const rec = store.get('screenings', scr[1]);
      if (!rec) return send(res, 404, { error: 'Not found' });
      if (scope && !ownCheck(rec, scope)) return send(res, 403, { error: 'This invitation can only see its own investor’s checks' });
      return send(res, 200, screeningView(rec.status === 'pending' ? await refreshScreening(rec) : rec));
    }

    if (await invites.sponsor(req, res, url)) return;

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
