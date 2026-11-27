// Shared test helpers: a server on a random port and a fetch mock that records every outbound call.
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';

/** Run fn against a fresh server, always closing it (a failing assertion must not leave it open). */
export async function withServer({ env = {}, fetch: fetchImpl, providers, now, store, mailTls } = {}, fn) {
  const server = createServer({ env: Object.assign({ NODE_ENV: 'test', PUBLIC_URL: 'http://verify.test' }, env), store: store || openStore(null), fetch: fetchImpl, providers, now, mailTls });
  await new Promise((r) => server.listen(0, r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`, server);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

export const post = (url, body, headers = {}) => fetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body) });
export const getJson = async (url, headers = {}) => (await fetch(url, { headers })).json();

/**
 * A fetch stand-in. routes: [[method, urlPrefixOrRegExp, handler(call) → { status?, body } or a plain body]].
 * Every call is recorded in .calls with its url, method, headers and parsed body. No network is used.
 */
export function mockFetch(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    const headers = Object.assign({}, init.headers || {});
    let body = init.body;
    if (typeof body === 'string' && String(headers['Content-Type'] || '').includes('json')) body = JSON.parse(body);
    else if (typeof body === 'string' && String(headers['Content-Type'] || '').includes('urlencoded')) body = Object.fromEntries(new URLSearchParams(body));
    const call = { url: String(url), method: init.method || 'GET', headers, body, redirect: init.redirect };
    calls.push(call);
    for (const [method, match, handler] of routes) {
      if (method !== call.method) continue;
      if (match instanceof RegExp ? !match.test(call.url) : !call.url.startsWith(match)) continue;
      let out = await handler(call);
      if (!out || out.body === undefined || typeof out.status !== 'number') out = { status: 200, body: out };
      const text = typeof out.body === 'string' ? out.body : JSON.stringify(out.body);
      return { ok: out.status >= 200 && out.status < 300, status: out.status, text: async () => text };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({ error: 'no route in the test mock' }) };
  };
  f.calls = calls;
  return f;
}

/*
 * White-label leak scans of emails: the random token parts of links taken out first, so a vendor word that a random
 * token holds by chance ("...9DiyTq...", "...iRoNnXN...") is not reported as a leak. Every other character stays in the
 * text the scan sees, the link's host and its path words included. Taken out, each replaced with "~":
 *   - the token or path segment after an invite or sign-in link prefix (#invite-, #room-, #taxdoc-, /invite/, /signin/);
 *   - the values of the query keys token=, t=, sig=, signature= (also after "&amp;" in HTML);
 *   - after the host, any run of 16 or more base64url characters that mixes capitals, small letters and digits, as a
 *     random token does (a lower-case path word such as "powered-by-carrow-2026" stays and is still scanned).
 * Only the vendor-name regexes run over this; the "basic" and taxpayer-number checks keep the raw text.
 * The phase 6 browser checks hold the same rules in their lib.js (stripLinkTokens), kept the same as here.
 */
const LINK_RE = /\bhttps?:\/\/[^\s"'<>()]+/gi;
const PREFIX_TOKEN_RE = /([#/](?:invite|sign-?in|room|taxdoc)[-/=])[A-Za-z0-9_-]+/gi;
const QUERY_TOKEN_RE = /([?&;#](?:token|t|sig|signature)=)[^&;#\s"'<>]*/gi;
const RANDOM_RUN_RE = /[A-Za-z0-9_-]{16,}/g;
export function stripLinkTokens(text) {
  return String(text === undefined || text === null ? '' : text).replace(LINK_RE, (url) => {
    const start = url.indexOf('//') + 2;
    const at = url.slice(start).search(/[/?#]/);
    if (at < 0) return url; // only a host: all of it is scanned
    const cut = start + at;
    const rest = url
      .slice(cut)
      .replace(PREFIX_TOKEN_RE, '$1~')
      .replace(QUERY_TOKEN_RE, '$1~')
      .replace(RANDOM_RUN_RE, (run) => (/[A-Z]/.test(run) && /[a-z]/.test(run) && /\d/.test(run) ? '~' : run));
    return url.slice(0, cut) + rest;
  });
}
