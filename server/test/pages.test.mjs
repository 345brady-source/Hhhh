// gate: tests 7
// The server serves the portal's own pages (plan 15-13, C-07, W-07, W-20): one origin for the pages, the API and the session
// cookie; a fixed list of files built at start-up, so no request path reaches another file; a content security policy that
// names every inline script by its SHA-256 and exactly the outside hosts the pages load from; security.txt built from the
// server's settings (RFC 9116). Each test runs a small node:http server of its own around createPages.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildSecurityTxt, createPages } from '../lib/pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = 'https://portal.harborridge.example';
const INJECTED = 'window.CVPortalConfig=Object.assign({},window.CVPortalConfig||{},{signInServer:true,demo:false,integrationServers:[location.origin]});';
const b64sha = (s) => createHash('sha256').update(s, 'utf8').digest('base64');
const directive = (csp, name) => {
  const part = String(csp || '').split(';').map((s) => s.trim()).find((s) => s.split(/\s+/)[0] === name);
  return part ? part.split(/\s+/).slice(1) : null;
};

/** A test server: a GET the pages list holds is answered by pages.serve, anything else 404. */
async function withPages(pages, fn) {
  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (pages.has(req.method, path) && pages.serve(req, res, path)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('tracer: portal.html and one of its scripts come from the server with the sign-in config and a policy naming both inline scripts', async () => {
  const pages = createPages({ env: { SERVE_PORTAL: '1', PUBLIC_URL: PUBLIC } });
  assert.equal(pages.enabled, true);
  await withPages(pages, async (base) => {
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
    const html = await page.text();
    const original = readFileSync(join(ROOT, 'portal.html'), 'utf8');
    const first = original.indexOf('<script');
    assert.ok(first > 0, 'portal.html has a script');
    assert.equal(html, original.slice(0, first) + `<script>${INJECTED}</script>` + original.slice(first), 'the config script sits right before the first <script');
    const own = original.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(own, 'portal.html has an inline script of its own');
    const csp = page.headers.get('content-security-policy');
    const scriptSrc = directive(csp, 'script-src');
    assert.ok(scriptSrc, 'script-src is set');
    assert.ok(scriptSrc.includes(`'sha256-${b64sha(INJECTED)}'`), 'the injected script is allowed by its hash');
    assert.ok(scriptSrc.includes(`'sha256-${b64sha(own[1])}'`), "portal.html's own inline script is allowed by its hash");
    assert.equal((await fetch(base + '/portal.html')).status, 200);

    const js = await fetch(base + '/assets/js/app.js');
    assert.equal(js.status, 200);
    assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.ok(Buffer.from(await js.arrayBuffer()).equals(readFileSync(join(ROOT, 'assets/js/app.js'))), 'the exact bytes of the file');
  });
});

/** A GET sent with the path exactly as given (no client-side normalising of '..' or '%2e'). */
const rawGet = (base, path, headers = {}) =>
  new Promise((resolve, reject) => {
    const u = new URL(base);
    const req = http.request({ host: u.hostname, port: u.port, path, method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });

test('fixed list: traversal, encoded dots, folders, files added later, symlinks, diy.html and index.html all answer 404', async () => {
  const pages = createPages({ env: { SERVE_PORTAL: '1', PUBLIC_URL: PUBLIC } });
  const refused = ['/../server/index.mjs', '/assets/../server/index.mjs', '/assets/%2e%2e/server/index.mjs', '/assets/js/app.js%00', '/server/index.mjs', '/diy.html', '/index.html', '/.git/config', '/assets/js/', '/assets/js', '/assets', '/assets/', '/server/data/store.json', '/assets/vendor/pdfview/SHA256SUMS', '/portal.html/', '//portal.html'];
  for (const p of refused) assert.equal(pages.has('GET', p), false, `not listed: ${p}`);
  assert.equal(pages.has('POST', '/'), false, 'GET only');
  assert.equal(pages.has('HEAD', '/portal.html'), false, 'GET only');
  await withPages(pages, async (base) => {
    for (const p of refused) {
      const r = await rawGet(base, p);
      assert.equal(r.status, 404, `404 for ${p}`);
      assert.ok(!r.body.includes('createServer'), `no server code through ${p}`);
    }
    assert.equal((await rawGet(base, '/assets/js/app.js?v=1')).status, 200, 'the query string is not part of the path');
  });

  // A root of the test's own: a symlink under assets/ (to a file or a folder outside) is never listed, a file added after
  // start-up is never served, and a listed file replaced by a symlink after start-up is refused.
  const root = mkdtempSync(join(tmpdir(), 'pages-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'pages-outside-'));
  try {
    writeFileSync(join(outside, 'secret.js'), 'const key = "outside";\n');
    mkdirSync(join(root, 'assets', 'js'), { recursive: true });
    writeFileSync(join(root, 'portal.html'), '<!doctype html><html><head></head><body><script>window.A=1;</script><script src="assets/js/a.js"></script></body></html>');
    writeFileSync(join(root, 'diy.html'), '<!doctype html><p>development page</p>');
    writeFileSync(join(root, 'index.html'), '<!doctype html><p>managed edition</p>');
    writeFileSync(join(root, 'assets', 'js', 'a.js'), 'window.B = 2;\n');
    writeFileSync(join(root, 'assets', 'js', 'b.js'), 'window.C = 3;\n');
    writeFileSync(join(root, 'assets', 'notes.txt'), 'not a listed extension\n');
    symlinkSync(join(outside, 'secret.js'), join(root, 'assets', 'js', 'link.js'));
    symlinkSync(outside, join(root, 'assets', 'linked'));
    const own = createPages({ env: { SERVE_PORTAL: '1', PUBLIC_URL: PUBLIC }, root });
    writeFileSync(join(root, 'assets', 'js', 'later.js'), 'window.D = 4;\n');
    assert.equal(own.has('GET', '/assets/js/a.js'), true);
    for (const p of ['/assets/js/link.js', '/assets/linked/secret.js', '/assets/js/later.js', '/assets/notes.txt', '/diy.html', '/index.html', '/security.html', '/disclosure.html'])
      assert.equal(own.has('GET', p), false, `not listed: ${p}`);
    await withPages(own, async (base) => {
      assert.equal((await rawGet(base, '/assets/js/a.js')).status, 200);
      for (const p of ['/assets/js/link.js', '/assets/linked/secret.js', '/assets/js/later.js']) assert.equal((await rawGet(base, p)).status, 404, `404 for ${p}`);
      rmSync(join(root, 'assets', 'js', 'b.js'));
      symlinkSync(join(outside, 'secret.js'), join(root, 'assets', 'js', 'b.js'));
      const swapped = await rawGet(base, '/assets/js/b.js');
      assert.equal(swapped.status, 404, 'a listed file replaced by a symlink is refused');
      assert.ok(!swapped.body.includes('outside'));
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("headers: nosniff, no-referrer, no-cache and an ETag on every answer, 304 on a match, and the page policy's fixed parts", async () => {
  const pages = createPages({ env: { SERVE_PORTAL: '1', PUBLIC_URL: PUBLIC } });
  await withPages(pages, async (base) => {
    for (const p of ['/', '/portal.html', '/assets/js/app.js', '/assets/css/base.css', '/assets/forms/fw9-2024-03.pdf', '/assets/vendor/textfont/DejaVuSans.ttf']) {
      const r = await rawGet(base, p);
      assert.equal(r.status, 200, p);
      assert.equal(r.headers['x-content-type-options'], 'nosniff', p);
      assert.equal(r.headers['referrer-policy'], 'no-referrer', p);
      assert.equal(r.headers['cache-control'], 'no-cache', p);
      assert.equal(r.headers['strict-transport-security'], 'max-age=31536000', p);
      assert.match(r.headers.etag, /^"[0-9a-f]{16}"$/, p);
      assert.equal(r.headers.etag, `"${createHash('sha256').update(r.body).digest('hex').slice(0, 16)}"`, `the ETag is the start of the SHA-256 of ${p}`);
      const again = await rawGet(base, p, { 'If-None-Match': `W/"0000000000000000", ${r.headers.etag}` });
      assert.equal(again.status, 304, `304 for a matching If-None-Match on ${p}`);
      assert.equal(again.body.length, 0, 'no body with 304');
      assert.equal(again.headers.etag, r.headers.etag);
      assert.equal((await rawGet(base, p, { 'If-None-Match': '"0000000000000000"' })).status, 200, 'another ETag gets the file');
    }
    assert.equal((await rawGet(base, '/assets/forms/fw9-2024-03.pdf')).headers['content-type'], 'application/pdf');
    assert.equal((await rawGet(base, '/assets/css/base.css')).headers['content-type'], 'text/css; charset=utf-8');
    assert.equal((await rawGet(base, '/assets/vendor/textfont/DejaVuSans.ttf')).headers['content-type'], 'font/ttf');
    const page = await rawGet(base, '/');
    const csp = page.headers['content-security-policy'];
    assert.equal(csp, pages.policy(), 'the page carries policy()');
    assert.deepEqual(directive(csp, 'frame-ancestors'), ["'none'"]);
    assert.deepEqual(directive(csp, 'object-src'), ["'none'"]);
    assert.deepEqual(directive(csp, 'base-uri'), ["'none'"]);
    assert.deepEqual(directive(csp, 'connect-src'), ["'self'"]);
    assert.deepEqual(directive(csp, 'default-src'), ["'self'"]);
    const scriptSrc = directive(csp, 'script-src');
    assert.ok(!scriptSrc.includes("'unsafe-inline'"), "no 'unsafe-inline' for scripts");
    assert.ok(!scriptSrc.includes("'unsafe-eval'"), "no 'unsafe-eval' for scripts");
    assert.ok(scriptSrc.includes("'wasm-unsafe-eval'"), "'wasm-unsafe-eval' so the document readers' WebAssembly runs");
    assert.ok(!/(^|\s)'unsafe-eval'/.test(csp), "the token 'unsafe-eval' appears nowhere in the policy");
    assert.ok(directive(csp, 'worker-src').includes('blob:'), 'workers from blob: (the PDF reader wraps its worker)');
    assert.equal((await rawGet(base, '/assets/js/app.js')).headers['content-security-policy'], undefined, 'the policy is for pages');
  });
  const local = createPages({ env: { SERVE_PORTAL: '1', PUBLIC_URL: 'http://localhost:8787' } });
  await withPages(local, async (base) => assert.equal((await rawGet(base, '/')).headers['strict-transport-security'], undefined, 'no HSTS without https'));
});

test('outside hosts: the policy names exactly the origins the pages, scripts and stylesheets load from, and no page link', () => {
  const pages = createPages({ env: { SERVE_PORTAL: '1', PUBLIC_URL: PUBLIC } });
  // The test's own scan: every https address in portal.html, assets/js/*.js and assets/css/*.css, classed by its path.
  const want = { script: new Set(), worker: new Set(), style: new Set(), font: new Set() };
  const texts = [readFileSync(join(ROOT, 'portal.html'), 'utf8')];
  for (const dir of ['assets/js', 'assets/css'])
    for (const f of readdirSync(join(ROOT, dir))) if (/\.(js|css)$/.test(f) && lstatSync(join(ROOT, dir, f)).isFile()) texts.push(readFileSync(join(ROOT, dir, f), 'utf8'));
  const URLS = /https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)(\/[^\s'"`<>()]*)?/gi;
  let seen = 0;
  for (const text of texts)
    for (const m of text.matchAll(URLS)) {
      seen += 1;
      const origin = 'https://' + m[1].toLowerCase();
      const path = (m[2] || '').split(/[?#]/)[0].toLowerCase();
      if (/\.m?js$/.test(path)) want.script.add(origin);
      if (/worker[^/]*\.m?js$/.test(path)) want.worker.add(origin);
      if (/\.(woff2?|ttf|otf)$/.test(path)) want.font.add(origin);
      if (/\.css$/.test(path) || (origin === 'https://fonts.googleapis.com' && /^\/css2?$/.test(path))) want.style.add(origin);
    }
  assert.ok(seen > 10, 'the scan found addresses');
  // Google's stylesheets name their font files on fonts.gstatic.com.
  if (want.style.has('https://fonts.googleapis.com')) want.font.add('https://fonts.gstatic.com');
  for (const w of want.worker) want.script.add(w);
  const hosts = (csp, name) => directive(csp, name).filter((t) => t.startsWith('https://')).sort();
  const csp = pages.policy();
  assert.deepEqual(hosts(csp, 'script-src'), [...want.script].sort(), 'script-src');
  assert.deepEqual(hosts(csp, 'worker-src'), [...want.worker].sort(), 'worker-src');
  assert.deepEqual(hosts(csp, 'style-src'), [...want.style].sort(), 'style-src');
  assert.deepEqual(hosts(csp, 'font-src'), [...want.font].sort(), 'font-src');
  for (const name of ['script-src', 'style-src', 'font-src', 'worker-src', 'connect-src', 'img-src', 'frame-src', 'default-src'])
    assert.ok(!directive(csp, name).some((t) => /irs\.gov|example/.test(t)), `no page link in ${name}`);
  // Outside hosts the phase allows: the two library hosts the research names and Google Fonts. A new one fails here, so
  // adding one is a decision, not an accident.
  const allowed = new Set(['https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com']);
  const named = csp.split(/[\s;]+/).filter((t) => /^https?:\/\//.test(t));
  for (const h of named) assert.ok(allowed.has(h), `outside host ${h} is one the phase allows`);
  assert.ok(named.includes('https://cdnjs.cloudflare.com') && named.includes('https://fonts.googleapis.com'), 'the hosts the pages load from today are named');
});

test('off: with SERVE_PORTAL unset or 0 nothing is served', () => {
  const assets = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name));
      else if (e.isFile()) assets.push('/' + join(dir, e.name).split('\\').join('/'));
    }
  };
  walk('assets');
  assert.ok(assets.length > 50, 'the assets were listed');
  for (const env of [{}, { SERVE_PORTAL: '0' }, { SERVE_PORTAL: '' }, { SERVE_PORTAL: 'true' }, { PUBLIC_URL: PUBLIC }]) {
    const pages = createPages({ env });
    assert.equal(pages.enabled, false, JSON.stringify(env));
    for (const p of ['/', '/portal.html', ...assets]) assert.equal(pages.has('GET', p), false, `${JSON.stringify(env)} ${p}`);
    let wrote = false;
    const res = { writeHead: () => (wrote = true), end: () => (wrote = true), setHeader: () => (wrote = true) };
    assert.equal(pages.serve({ headers: {} }, res, '/'), false);
    assert.equal(wrote, false, 'nothing written when off');
  }
});

const DAY = 86400000;
const CLOCK = Date.parse('2026-11-26T12:00:00Z');
const isoZ = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const CONTACT = 'mailto:security@harborridge.example';

test('security.txt: built from the settings in RFC 9116 order, or 404 when a field is missing, invalid or past', () => {
  const expires = isoZ(CLOCK + 200 * DAY);
  const env = { SECURITY_CONTACT: CONTACT, SECURITY_TXT_EXPIRES: expires, PUBLIC_URL: PUBLIC + '/' };
  const r = createPages({ env, now: () => CLOCK }).securityTxt();
  assert.equal(r.status, 200);
  assert.equal(r.type, 'text/plain; charset=utf-8');
  const body = [`Contact: ${CONTACT}`, `Expires: ${expires}`, `Policy: ${PUBLIC}/disclosure.html`, 'Preferred-Languages: en', `Canonical: ${PUBLIC}/.well-known/security.txt`].join('\n') + '\n';
  assert.equal(r.body, body);
  assert.equal(buildSecurityTxt({ contact: CONTACT, expires, publicUrl: PUBLIC, now: CLOCK }), body, 'buildSecurityTxt gives the same body');
  // a date without a time is read as midnight UTC and written with Z
  const dateOnly = createPages({ env: { ...env, SECURITY_TXT_EXPIRES: '2027-06-14' }, now: () => CLOCK }).securityTxt();
  assert.equal(dateOnly.status, 200);
  assert.ok(dateOnly.body.includes('\nExpires: 2027-06-14T00:00:00Z\n'));
  assert.equal(createPages({ env: { ...env, SECURITY_CONTACT: 'https://portal.harborridge.example/report' }, now: () => CLOCK }).securityTxt().status, 200, 'an https contact');
  const refused = {
    'contact unset': { ...env, SECURITY_CONTACT: undefined },
    'contact with no scheme': { ...env, SECURITY_CONTACT: 'security@harborridge.example' },
    'contact with a line break': { ...env, SECURITY_CONTACT: CONTACT + '\nPolicy: https://evil.example' },
    'PUBLIC_URL http': { ...env, PUBLIC_URL: 'http://portal.harborridge.example' },
    'PUBLIC_URL unset': { ...env, PUBLIC_URL: undefined },
    expired: { ...env, SECURITY_TXT_EXPIRES: isoZ(CLOCK - DAY) },
    'invalid date': { ...env, SECURITY_TXT_EXPIRES: 'next spring' },
    'expires unset': { ...env, SECURITY_TXT_EXPIRES: undefined }
  };
  for (const [why, e] of Object.entries(refused)) {
    assert.deepEqual(createPages({ env: e, now: () => CLOCK }).securityTxt(), { status: 404 }, why);
    assert.equal(buildSecurityTxt({ contact: e.SECURITY_CONTACT, expires: e.SECURITY_TXT_EXPIRES, publicUrl: e.PUBLIC_URL, now: CLOCK }), '', why);
  }
});

test('health: each warning exactly when its condition holds, none on a correct set-up, and no vendor name anywhere', async () => {
  const W = {
    https: 'Sign-in needs HTTPS: set PUBLIC_URL to the https address of this server.',
    unset: 'security.txt is not served: set SECURITY_CONTACT and SECURITY_TXT_EXPIRES.',
    soon: 'security.txt expires on 2027-06-14: review it and set a new SECURITY_TXT_EXPIRES.',
    year: 'SECURITY_TXT_EXPIRES is more than a year away; RFC 9116 asks for less than a year.'
  };
  const expires = Date.parse('2027-06-14T00:00:00Z');
  const good = { SERVE_PORTAL: '1', PUBLIC_URL: PUBLIC, SECURITY_CONTACT: CONTACT, SECURITY_TXT_EXPIRES: '2027-06-14T00:00:00Z' };
  const at = (env, ms) => createPages({ env, now: () => ms }).health().warnings;
  assert.deepEqual(at(good, expires - 200 * DAY), [], 'none on a correct https set-up');
  assert.deepEqual(at({ ...good, PUBLIC_URL: 'http://portal.harborridge.example' }, expires - 200 * DAY), [W.https]);
  assert.deepEqual(at({ ...good, PUBLIC_URL: undefined }, expires - 200 * DAY), [W.https], 'PUBLIC_URL unset is not https');
  assert.deepEqual(at({ ...good, SECURITY_CONTACT: undefined }, expires - 200 * DAY), [W.unset]);
  assert.deepEqual(at({ ...good, SECURITY_TXT_EXPIRES: undefined }, expires - 200 * DAY), [W.unset]);
  assert.deepEqual(at(good, expires - 20 * DAY), [W.soon], '20 days before');
  assert.deepEqual(at(good, expires - 31 * DAY), [], '31 days before');
  assert.deepEqual(at(good, expires - 400 * DAY), [W.year], '400 days before');
  assert.deepEqual(at(good, expires - 366 * DAY), [], '366 days before');
  assert.deepEqual(at(good, expires + DAY), [W.unset], 'past its date it is not served');
  assert.deepEqual(at({ ...good, SERVE_PORTAL: undefined }, expires - 200 * DAY), [], 'pages off and security.txt correct');

  const NAMES = /carrow|vale|anthropic|claude/i;
  const pages = createPages({ env: good, now: () => expires - 20 * DAY });
  assert.ok(!NAMES.test(INJECTED), 'the injected script');
  assert.ok(!NAMES.test(pages.policy()), 'the policy');
  for (const w of [...pages.health().warnings, ...Object.values(W)]) assert.ok(!NAMES.test(w), w);
  await withPages(pages, async (base) => {
    for (const p of ['/', '/portal.html', '/assets/js/app.js', '/assets/css/base.css']) {
      const r = await rawGet(base, p);
      assert.equal(r.status, 200, p);
      for (const [k, v] of Object.entries(r.headers)) assert.ok(!NAMES.test(`${k}: ${v}`), `${p} ${k}`);
      if (p === '/') assert.ok(r.body.toString('utf8').includes(`<script>${INJECTED}</script>`), 'the injected script is the one checked');
    }
  });
});
