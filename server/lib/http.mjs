// Small HTTP helpers: raw bodies (webhook signatures are computed over the exact bytes), JSON replies and CORS.

/** The request body exactly as received. */
export function readRaw(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function parseJson(raw) {
  if (!raw || !raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Body is not valid JSON'), { status: 400 });
  }
}

export function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json', 'Cache-Control': 'no-store' }, headers));
  res.end(data);
}

/** Allow the portal's origin(s) to call the API from the browser. */
export function cors(req, res, allowed) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const list = String(allowed || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = !list.length || list.includes('*') || list.includes(origin);
  if (ok) {
    res.setHeader('Access-Control-Allow-Origin', list.includes('*') || !list.length ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  return ok;
}

/** Lower-cased header lookup that tolerates arrays. */
export function header(headers, name) {
  const v = headers[String(name).toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}
