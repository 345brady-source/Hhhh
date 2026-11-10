#!/usr/bin/env node
/*
 * Integration server for automated investor verification (Shareholder Desk,
 * the DIY edition of the portal).
 *
 * The portal runs in the browser and must never hold provider API keys, so
 * this small server does the provider work:
 *   POST /v1/verifications      start an identity or accreditation check; returns { id, status, url }
 *   GET  /v1/verifications/:id  its latest status (refreshed from the provider while pending)
 *   POST /v1/screenings         sanctions / PEP screening of names; returns { id, status, hits }
 *   POST /webhooks/:provider    provider callbacks, signature-checked, update the records above
 *   GET  /health                which providers are configured
 *   GET  /sandbox/:ref          a stand-in hosted page for the "sandbox" provider (testing without accounts)
 *
 * Node 18 or later, no dependencies. Configure with environment variables
 * (see README.md). Statuses are normalized for the portal: identity
 * pending | passed | review | failed; accreditation pending | verified |
 * review | rejected; screening clear | potential_match.
 */
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { readRaw, parseJson, send, cors, header } from './lib/http.mjs';
import { openStore } from './lib/store.mjs';
import { id, safeEqual } from './lib/crypto.mjs';
import { PROVIDERS, configured, missingEnv } from './providers/index.mjs';

/** In production, verify the portal session here (for example a signed session token); API_TOKEN suits server-to-server use. */
function authorize(req, env) {
  if (!env.API_TOKEN) return true;
  const got = String(header(req.headers, 'authorization') || '').replace(/^Bearer\s+/i, '');
  return safeEqual(got, env.API_TOKEN);
}

const REFRESH_MS = 20000;

export function createServer(opts = {}) {
  const env = opts.env || process.env;
  const store = opts.store || openStore(env.STORE_FILE || new URL('./data/store.json', import.meta.url).pathname);
  const fetchFn = opts.fetch || globalThis.fetch;
  const publicUrl = String(env.PUBLIC_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/+$/, '');
  const ctx = (provider, extra) => Object.assign({ env, fetch: fetchFn, publicUrl, webhookUrl: `${publicUrl}/webhooks/${provider}` }, extra);

  async function refresh(rec) {
    const p = PROVIDERS[rec.provider];
    if (!p || !p.fetchResult || rec.status !== 'pending' || !rec.ref) return rec;
    if (rec.checkedAt && Date.now() - Date.parse(rec.checkedAt) < REFRESH_MS) return rec;
    const r = await p.fetchResult(ctx(rec.provider, { ref: rec.ref, kind: rec.kind }));
    return store.put('verifications', Object.assign({ id: rec.id, checkedAt: new Date().toISOString() }, r && r.status ? { status: r.status, method: r.method || rec.method || '', detail: r.detail || '' } : {}));
  }

  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (!cors(req, res, env.PORTAL_ORIGIN)) return send(res, 403, { error: 'Origin not allowed' });
    if (req.method === 'OPTIONS') return send(res, 204, '');

    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true, providers: configured(env) });

    // Provider callbacks: verify the signature over the exact bytes received, then update the record.
    const hook = path.match(/^\/webhooks\/([a-z0-9]+)$/);
    if (req.method === 'POST' && hook) {
      const name = hook[1];
      const p = PROVIDERS[name];
      if (!p || !p.verifyWebhook) return send(res, 404, { error: 'Unknown provider' });
      const raw = await readRaw(req);
      if (!p.verifyWebhook({ rawBody: raw, headers: req.headers, env })) {
        store.event({ type: 'webhook_rejected', provider: name });
        return send(res, 401, { error: 'Bad signature' });
      }
      const body = parseJson(raw);
      const ev = p.parseWebhook({ body, headers: req.headers, rawBody: raw }) || {};
      store.event({ type: 'webhook', provider: name, event: ev.event || '', ref: ev.ref || '' });
      const rec = ev.ref ? store.byRef('verifications', name, ev.ref) || store.byRef('screenings', name, ev.ref) : null;
      if (rec) {
        if (ev.status) store.put(rec.kind === 'aml' ? 'screenings' : 'verifications', { id: rec.id, status: ev.status, method: ev.method || rec.method || '', detail: ev.detail || '' });
        else if (ev.refetch && p.fetchResult) await refresh(Object.assign({}, rec, { checkedAt: '' }));
        if (ev.hits) store.put('screenings', { id: rec.id, hits: ev.hits, status: ev.hits.length ? 'potential_match' : 'clear' });
      }
      return send(res, 200, { received: true });
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
        store.put('verifications', { id: rec.id, status: outcome, method: form.get('method') || '' });
        return send(res, 200, '<!doctype html><meta charset="utf-8"><title>Done</title><p style="font:16px system-ui;padding:24px">Done. You can close this tab and return to the portal.</p>', { 'Content-Type': 'text/html; charset=utf-8' });
      }
      return send(res, 200, PROVIDERS.sandbox.page(rec), { 'Content-Type': 'text/html; charset=utf-8' });
    }

    if (path.startsWith('/v1/') && !authorize(req, env)) return send(res, 401, { error: 'Not authorized' });

    if (req.method === 'POST' && path === '/v1/verifications') {
      const body = parseJson(await readRaw(req));
      const p = PROVIDERS[body.provider];
      if (!p || !(p.kinds || [p.kind]).includes(body.kind) || !p.createSession) return send(res, 400, { error: `No ${body.kind || ''} provider named "${body.provider || ''}"` });
      const missing = missingEnv(p, env);
      if (missing.length) return send(res, 400, { error: `Set ${missing.join(', ')} on the integration server` });
      const inv = body.investor || {};
      if (!inv.id || !inv.name) return send(res, 400, { error: 'investor.id and investor.name are required' });
      const rec = { id: id('ver'), kind: body.kind, provider: body.provider, investorId: inv.id, workspace: inv.workspace || '', status: 'pending', createdAt: new Date().toISOString() };
      const r = await p.createSession(ctx(body.provider, { investor: inv, settings: body.settings || {}, reference: rec.id, kind: body.kind }));
      const saved = store.put('verifications', Object.assign(rec, { ref: r.ref, url: r.url || '', status: r.status || 'pending' }));
      store.event({ type: 'verification_started', provider: body.provider, id: rec.id, ref: r.ref });
      return send(res, 200, { id: saved.id, status: saved.status, url: saved.url });
    }

    const ver = path.match(/^\/v1\/verifications\/(ver_[\w-]+)$/);
    if (req.method === 'GET' && ver) {
      const rec = store.get('verifications', ver[1]);
      if (!rec) return send(res, 404, { error: 'Not found' });
      const cur = await refresh(rec);
      return send(res, 200, { id: cur.id, kind: cur.kind, provider: cur.provider, status: cur.status, method: cur.method || '', detail: cur.detail || '' });
    }

    if (req.method === 'POST' && path === '/v1/screenings') {
      const body = parseJson(await readRaw(req));
      const p = PROVIDERS[body.provider];
      if (!p || p.kind !== 'aml' || !p.screen) return send(res, 400, { error: `No screening provider named "${body.provider || ''}"` });
      const missing = missingEnv(p, env);
      if (missing.length) return send(res, 400, { error: `Set ${missing.join(', ')} on the integration server` });
      const names = Array.from(new Set((body.names || []).map((n) => String(n || '').trim()).filter(Boolean))).slice(0, 25);
      if (!names.length) return send(res, 400, { error: 'names are required' });
      const rec = { id: id('scr'), kind: 'aml', provider: body.provider, investorId: (body.investor || {}).id || '', createdAt: new Date().toISOString() };
      const r = await p.screen(ctx(body.provider, { investor: body.investor || {}, names, settings: body.settings || {}, reference: rec.id }));
      const hits = r.hits || [];
      store.put('screenings', Object.assign(rec, { ref: r.ref || rec.id, hits, status: hits.length ? 'potential_match' : 'clear' }));
      store.event({ type: 'screening', provider: body.provider, id: rec.id, hits: hits.length });
      return send(res, 200, { id: rec.id, status: hits.length ? 'potential_match' : 'clear', hits });
    }

    return send(res, 404, { error: 'Not found' });
  }

  const server = http.createServer((req, res) =>
    route(req, res).catch((e) => {
      if (!e.status && env.NODE_ENV !== 'test') console.error(e);
      send(res, e.status || 502, { error: e.status ? e.message : `Provider request failed: ${e.message}` });
    })
  );
  server.store = store;
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, () => console.log(`Integration server on http://localhost:${port} (providers: ${configured(process.env).join(', ')})`));
}
