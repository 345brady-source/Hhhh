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
