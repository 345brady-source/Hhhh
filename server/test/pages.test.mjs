// gate: tests 7
// The server serves the portal's own pages (plan 15-13, C-07, W-07, W-20): one origin for the pages, the API and the session
// cookie; a fixed list of files built at start-up, so no request path reaches another file; a content security policy that
// names every inline script by its SHA-256 and exactly the outside hosts the pages load from; security.txt built from the
// server's settings (RFC 9116). Each test runs a small node:http server of its own around createPages.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createPages } from '../lib/pages.mjs';

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
