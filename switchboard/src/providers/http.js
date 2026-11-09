import { sleep } from '../mailutil.js';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * fetch() with OAuth bearer token, one forced token refresh on 401, and backoff on 429/5xx.
 * getToken(force) must return an access token.
 */
export async function apiFetch(getToken, url, { method = 'GET', headers = {}, body, raw = false, json: jsonBody } = {}) {
  let forced = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = await getToken(forced);
    const h = { Authorization: `Bearer ${token}`, ...headers };
    let payload = body;
    if (jsonBody !== undefined) {
      h['Content-Type'] = 'application/json';
      payload = JSON.stringify(jsonBody);
    }
    let res;
    try {
      res = await fetch(url, { method, headers: h, body: payload });
    } catch (err) {
      if (attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new ApiError(`Network error: ${err.message}`, 0);
    }
    if (res.status === 401 && !forced) {
      forced = true;
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get('retry-after'));
      if (attempt < 4) {
        await sleep(ra > 0 ? Math.min(ra, 60) * 1000 : 1000 * 2 ** attempt);
        continue;
      }
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = text;
      try {
        const j = JSON.parse(text);
        msg = j.error?.message || j.error_description || j.error?.code || j.message || text;
        if (typeof msg !== 'string') msg = JSON.stringify(msg);
      } catch {}
      throw new ApiError(`${res.status} ${msg}`.trim(), res.status, text);
    }
    if (raw) return Buffer.from(await res.arrayBuffer());
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  throw new ApiError('Request failed after retries', 0);
}
