// One way for adapters to call provider APIs: a timeout, JSON in and out, and
// errors that name the provider and its message (never the request headers,
// which carry secrets).

/** Pull a human-readable message out of the error bodies providers return. */
export function providerMessage(data) {
  if (!data || typeof data !== 'object') return '';
  const first = (x) => (Array.isArray(x) ? x[0] : x);
  const e = first(data.errors) || data.error || data;
  if (typeof e === 'string') return e.slice(0, 200);
  const m = (e && (e.detail || e.title || e.message || e.description || e.error_message || e.display_message)) || data.message || data.description || '';
  return String(m).slice(0, 200);
}

/**
 * Call a provider and return the parsed JSON (or the text when the reply is
 * not JSON). Throws an Error with status 502 on network errors, timeouts and
 * non-2xx replies; err.providerStatus and err.data carry the provider's reply.
 * opts.redirect 'manual' stops the call from following a redirect to another
 * host (the redirect then fails like any other non-2xx reply).
 */
export async function requestJson(ctx, url, opts = {}) {
  const { method = 'GET', headers = {}, body, form, timeoutMs = 15000, label = 'The provider', redirect } = opts;
  const h = Object.assign({ Accept: 'application/json' }, headers);
  let payload;
  if (form) {
    payload = new URLSearchParams(form).toString();
    h['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (body !== undefined) {
    payload = typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body);
    if (!h['Content-Type']) h['Content-Type'] = 'application/json';
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let res;
  try {
    res = await ctx.fetch(url, Object.assign({ method, headers: h, body: payload, signal: ac.signal }, redirect ? { redirect } : {}));
  } catch (e) {
    throw Object.assign(new Error(`${label} could not be reached (${e && e.name === 'AbortError' ? 'timed out' : (e && e.message) || 'network error'})`), { status: 502 });
  } finally {
    clearTimeout(timer);
  }
  const text = typeof res.text === 'function' ? await res.text() : '';
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = providerMessage(data) || (data ? '' : String(text || '').slice(0, 200));
    throw Object.assign(new Error(`${label} answered ${res.status}${msg ? `: ${msg}` : ''}`), { status: 502, providerStatus: res.status, data });
  }
  return data !== null ? data : text;
}

/** Split a full name into first and last for providers that want both. */
export function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || '', last: parts[0] || '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}
