// The portal's own pages served by this server (plan 15-13, C-07): with SERVE_PORTAL=1 the self-serve page, its public
// pages and the files under assets/ come from the same origin as the API, so the session cookie is first-party and
// SameSite=Strict holds (Safari drops cross-site cookies). The list of files is fixed when the server starts: exact paths
// only, regular files only (no symlink is followed), assets/ only by extension, never rebuilt while the server runs, so no
// request path can reach the store, the keys or the code. Served pages carry a content security policy (W-07) that names
// every inline script by its SHA-256 and exactly the outside hosts the pages load scripts, workers, stylesheets and fonts
// from, found by reading the files at start-up (nothing typed by hand).
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readdirSync, readFileSync, readSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKOUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Content types by extension; a file under assets/ with any other extension is not served. */
const TYPES = {
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  pdf: 'application/pdf',
  ttf: 'font/ttf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
  html: 'text/html; charset=utf-8'
};
const ASSET_EXT = new Set(['js', 'css', 'pdf', 'ttf', 'woff', 'woff2', 'png', 'jpg', 'jpeg', 'svg', 'webp', 'ico']);

/** The pages: request path -> file under the checkout. The public pages are listed only when their files exist. */
const PAGES = [
  ['/', 'portal.html'],
  ['/portal.html', 'portal.html'],
  ['/security.html', 'security.html'],
  ['/disclosure.html', 'disclosure.html']
];

/** Told to every served page before its first script: it has a sign-in server, here, and no demo control. */
export const INJECTED_SCRIPT =
  'window.CVPortalConfig=Object.assign({},window.CVPortalConfig||{},{signInServer:true,demo:false,integrationServers:[location.origin]});';

/** Some style hosts serve their font files from a second host named in the stylesheets they return. */
const FONT_HOST_OF_STYLE_HOST = { 'https://fonts.googleapis.com': ['https://fonts.gstatic.com'] };

const sha256 = (buf) => createHash('sha256').update(buf).digest();
const isRegular = (p) => {
  try {
    return lstatSync(p).isFile();
  } catch {
    return false;
  }
};

/** Every regular file under dir (symlinks, to files or folders, are skipped). */
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** The request path of a file under root, each segment percent-encoded as a browser asks for it. */
const urlPathOf = (root, abs) => '/' + relative(root, abs).split(sep).map(encodeURIComponent).join('/');

/** The inline scripts of a page (a <script> with no src), as their exact text. */
function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html))) if (!/\bsrc\s*=/i.test(m[1])) out.push(m[2]);
  return out;
}

/** The page as served: the config script right before its first <script (or unchanged when it has none). */
function inject(html) {
  const i = html.indexOf('<script');
  return i < 0 ? html : html.slice(0, i) + `<script>${INJECTED_SCRIPT}</script>` + html.slice(i);
}

/** What an https address in a script or stylesheet is used for, by its path: script, worker, style, font or nothing. */
function kindsOfUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return [];
  }
  if (u.protocol !== 'https:' || !u.hostname.includes('.')) return [];
  const p = u.pathname.toLowerCase();
  if (/\.m?js$/.test(p)) return /worker[^/]*\.m?js$/.test(p) ? ['script', 'worker'] : ['script'];
  if (/\.(woff2?|ttf|otf)$/.test(p)) return ['font'];
  if (/\.css$/.test(p) || (u.hostname === 'fonts.googleapis.com' && /^\/css2?$/.test(p))) return ['style'];
  return [];
}

/**
 * The outside origins the files load from, by use. Pages: <script src>, <link rel=stylesheet href>, <link rel=preload
 * as=font|script|style href>; scripts: string literals that are https addresses of a script, worker, stylesheet or font;
 * stylesheets: @import and url(...). A link in page text (an address that is none of these) is not a source.
 */
export function outsideOrigins({ pages = [], scripts = [], styles = [] }) {
  const found = { script: new Set(), worker: new Set(), style: new Set(), font: new Set() };
  const add = (kind, url) => {
    try {
      const u = new URL(url.replace(/&amp;/g, '&'));
      if (u.protocol === 'https:') found[kind].add(u.origin);
    } catch {
      /* not an address */
    }
  };
  for (const html of pages) {
    for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'](https:\/\/[^"']+)["']/gi)) add('script', m[1]);
    for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
      const tag = m[0];
      const rel = (tag.match(/\brel\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
      const href = (tag.match(/\bhref\s*=\s*["'](https:\/\/[^"']+)["']/i) || [])[1];
      const as = (tag.match(/\bas\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
      if (!href) continue;
      if (/\bstylesheet\b/i.test(rel)) add('style', href);
      else if (/\b(preload|modulepreload)\b/i.test(rel) && /^(font|script|style)$/i.test(as)) add(as.toLowerCase() === 'font' ? 'font' : as.toLowerCase() === 'style' ? 'style' : 'script', href);
    }
  }
  for (const js of scripts)
    for (const m of js.matchAll(/(["'`])(https:\/\/[^"'`\s]+?)\1/g)) for (const kind of kindsOfUrl(m[2])) add(kind, m[2]);
  for (const css of styles) {
    for (const m of css.matchAll(/@import\s+(?:url\(\s*)?["']?(https:\/\/[^"')\s]+)/gi)) add('style', m[1]);
    for (const m of css.matchAll(/url\(\s*["']?(https:\/\/[^"')\s]+)["']?\s*\)/gi)) for (const kind of kindsOfUrl(m[1])) add(kind, m[1]);
  }
  for (const origin of found.style) for (const f of FONT_HOST_OF_STYLE_HOST[origin] || []) found.font.add(f);
  const sorted = (s) => [...s].sort();
  return { script: sorted(new Set([...found.script, ...found.worker])), worker: sorted(found.worker), style: sorted(found.style), font: sorted(found.font) };
}

/** Reads a listed file without following a symlink put in its place after start-up; null when it is gone or not a file. */
function readListed(abs) {
  let fd;
  try {
    fd = openSync(abs, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const st = fstatSync(fd);
    if (!st.isFile()) return null;
    const buf = Buffer.alloc(st.size);
    let off = 0;
    while (off < st.size) {
      const n = readSync(fd, buf, off, st.size - off, off);
      if (!n) break;
      off += n;
    }
    return off === st.size ? buf : buf.subarray(0, off);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

const DAY = 86400000;
/** An Expires setting as a time in ms, or NaN; a date with no time is midnight UTC. */
const expiresAt = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/.test(s.trim()) ? Date.parse(s.trim()) : NaN);
const isoZ = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
/** A Contact field: a mailto: or https: address on one line. */
const contactOk = (c) => typeof c === 'string' && !/[\u0000-\u001f\u007f\s]/.test(c) && (/^mailto:[^@]+@[^@]+\.[^@]+$/i.test(c) || /^https:\/\/[^/]+\.[^/]+/i.test(c));
/** An https PUBLIC_URL with no trailing slash, or ''. */
function httpsBase(url) {
  const s = String(url || '').trim().replace(/\/+$/, '');
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && !u.search && !u.hash && !/\s/.test(s) ? s : '';
  } catch {
    return '';
  }
}

/**
 * The body of /.well-known/security.txt (RFC 9116) from the security contact, the Expires date and the server's https
 * address; '' when a field is missing or invalid or the date is not in the future (a stale file is never produced).
 */
export function buildSecurityTxt({ contact, expires, publicUrl, now = Date.now() } = {}) {
  const at = expiresAt(expires);
  const base = httpsBase(publicUrl);
  if (!contactOk(contact) || !base || !Number.isFinite(at) || at <= now) return '';
  return [`Contact: ${contact}`, `Expires: ${isoZ(at)}`, `Policy: ${base}/disclosure.html`, 'Preferred-Languages: en', `Canonical: ${base}/.well-known/security.txt`].join('\n') + '\n';
}

/** The ETags an If-None-Match header names (a list, weak or strong, or *). */
const etagsOf = (h) =>
  String(Array.isArray(h) ? h.join(',') : h || '')
    .split(',')
    .map((s) => s.trim().replace(/^W\//, ''))
    .filter(Boolean);

export function createPages({ env = process.env, root = CHECKOUT, now = Date.now } = {}) {
  const enabled = env.SERVE_PORTAL === '1';
  const publicUrl = String(env.PUBLIC_URL || '').replace(/\/+$/, '');
  /** request path -> { abs, ext, html } */
  const list = new Map();
  if (enabled) {
    for (const [path, file] of PAGES) {
      const abs = join(root, file);
      if (isRegular(abs)) list.set(path, { abs, ext: 'html', html: true });
    }
    for (const abs of walk(join(root, 'assets'))) {
      const ext = extname(abs).slice(1).toLowerCase();
      if (ASSET_EXT.has(ext)) list.set(urlPathOf(root, abs), { abs, ext, html: false });
    }
  }

  // The policy, from the files as they are at start-up.
  const pageTexts = [...new Set([...list.values()].filter((f) => f.html).map((f) => f.abs))].map((abs) => readFileSync(abs, 'utf8'));
  const readAll = (dir, ext) =>
    walk(join(root, dir))
      .filter((p) => dirname(p) === join(root, dir) && extname(p).toLowerCase() === ext)
      .map((p) => readFileSync(p, 'utf8'));
  const origins = enabled ? outsideOrigins({ pages: pageTexts, scripts: readAll('assets/js', '.js'), styles: readAll('assets/css', '.css') }) : { script: [], worker: [], style: [], font: [] };
  const hashes = [...new Set(pageTexts.flatMap((html) => inlineScripts(inject(html))))].map((s) => `'sha256-${sha256(Buffer.from(s, 'utf8')).toString('base64')}'`);
  const join1 = (...parts) => parts.flat().filter(Boolean).join(' ');
  const POLICY = [
    `default-src 'self'`,
    join1('script-src', `'self'`, `'wasm-unsafe-eval'`, hashes, origins.script),
    join1('style-src', `'self'`, `'unsafe-inline'`, origins.style),
    join1('font-src', `'self'`, 'data:', origins.font),
    `img-src 'self' data: blob:`,
    `connect-src 'self'`,
    join1('worker-src', `'self'`, 'blob:', origins.worker),
    `frame-src 'self' blob:`,
    `frame-ancestors 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    `object-src 'none'`
  ].join('; ');

  const https = /^https:\/\//i.test(publicUrl);
  function headersFor(file, etag) {
    const h = {
      'Content-Type': TYPES[file.ext],
      'Cache-Control': 'no-cache',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-site'
    };
    if (https) h['Strict-Transport-Security'] = 'max-age=31536000';
    if (file.html) h['Content-Security-Policy'] = POLICY;
    return h;
  }

  return {
    enabled,
    has(method, path) {
      return enabled && method === 'GET' && typeof path === 'string' && list.has(path);
    },
    /** Answers a listed path; false (nothing written) when the path is not listed. */
    serve(req, res, path) {
      if (!enabled || !list.has(path)) return false;
      const file = list.get(path);
      const raw = readListed(file.abs);
      if (!raw) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end('Not found');
        return true;
      }
      const body = file.html ? Buffer.from(inject(raw.toString('utf8')), 'utf8') : raw;
      const etag = `"${sha256(body).toString('hex').slice(0, 16)}"`;
      const headers = headersFor(file, etag);
      const asked = etagsOf(req.headers['if-none-match']);
      if (asked.includes(etag) || asked.includes('*')) {
        delete headers['Content-Type'];
        res.writeHead(304, headers);
        res.end();
        return true;
      }
      headers['Content-Length'] = body.length;
      res.writeHead(200, headers);
      res.end(body);
      return true;
    },
    policy() {
      return POLICY;
    },
    /** The outside origins the policy names, by use (for the summary and the tests). */
    origins() {
      return origins;
    },
    /** /.well-known/security.txt, built from the settings on each call (so it stops the moment its date passes). */
    securityTxt() {
      const body = buildSecurityTxt({ contact: env.SECURITY_CONTACT, expires: env.SECURITY_TXT_EXPIRES, publicUrl: env.PUBLIC_URL, now: now() });
      return body ? { status: 200, type: 'text/plain; charset=utf-8', body } : { status: 404 };
    },
    /** Warnings for /health about serving the pages and security.txt. */
    health() {
      const warnings = [];
      if (enabled && !httpsBase(env.PUBLIC_URL)) warnings.push('Sign-in needs HTTPS: set PUBLIC_URL to the https address of this server.');
      const at = expiresAt(env.SECURITY_TXT_EXPIRES);
      const t = now();
      if (!contactOk(env.SECURITY_CONTACT) || !Number.isFinite(at) || at <= t) warnings.push('security.txt is not served: set SECURITY_CONTACT and SECURITY_TXT_EXPIRES.');
      else if (at - t <= 30 * DAY) warnings.push(`security.txt expires on ${isoZ(at).slice(0, 10)}: review it and set a new SECURITY_TXT_EXPIRES.`);
      else if (at - t > 366 * DAY) warnings.push('SECURITY_TXT_EXPIRES is more than a year away; RFC 9116 asks for less than a year.');
      return { warnings };
    }
  };
}
