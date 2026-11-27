// gate: tests 3
// The server serves the portal's own pages and security.txt (plan 15-06 mounting 15-13's lib/pages.mjs; C-07, W-07,
// W-20): with SERVE_PORTAL=1 the listed pages and assets come from this server before any API route, with the injected
// configuration and the content security policy; nothing else of the checkout is reachable; /.well-known/security.txt is
// built from the server's settings; /health lists the warnings about both.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { withServer } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = 'https://portal.harborridge.example';
const CONTACT = 'mailto:security@harborridge.example';
const INJECTED = 'window.CVPortalConfig=Object.assign({},window.CVPortalConfig||{},{signInServer:true,demo:false,integrationServers:[location.origin]});';
const NOT_SERVED = 'security.txt is not served: set SECURITY_CONTACT and SECURITY_TXT_EXPIRES.';
const HTTPS = 'Sign-in needs HTTPS: set PUBLIC_URL to the https address of this server.';
const isoZ = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

async function get(base, path) {
  const res = await fetch(base + path);
  return { status: res.status, headers: res.headers, buf: Buffer.from(await res.arrayBuffer()) };
}

test('served page', async () => {
  await withServer({ env: { SERVE_PORTAL: '1', PUBLIC_URL: PUBLIC } }, async (base) => {
    const page = await get(base, '/');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /^text\/html/);
    const html = page.buf.toString('utf8');
    assert.ok(html.includes(`<script>${INJECTED}</script>`), 'the configuration is injected before the first script');
    assert.ok(html.includes(readFileSync(join(ROOT, 'portal.html'), 'utf8').slice(0, 200)), 'it is portal.html');
    const csp = page.headers.get('content-security-policy') || '';
    assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/);
    assert.ok(!/'unsafe-eval'/.test(csp), 'never unsafe-eval');
    assert.match(csp, /frame-ancestors 'none'/);

    const js = await get(base, '/assets/js/app.js');
    assert.equal(js.status, 200);
    assert.ok(js.buf.equals(readFileSync(join(ROOT, 'assets/js/app.js'))), 'the file as it is');
    for (const p of ['/diy.html', '/server/index.mjs', '/server/data/store.json', '/.planning/STATE.md', '/assets/../server/index.mjs']) assert.equal((await get(base, p)).status, 404, p);
    assert.equal((await get(base, '/v1/workspace')).status, 401, 'the API still answers behind its own checks');
  });
  await withServer({ env: { PUBLIC_URL: PUBLIC } }, async (base) => {
    assert.equal((await get(base, '/')).status, 404, 'SERVE_PORTAL unset: no page is served');
    assert.equal((await get(base, '/assets/js/app.js')).status, 404);
  });
});

test('security.txt route', async () => {
  const expires = isoZ(Date.now() + 180 * 24 * 60 * 60 * 1000);
  await withServer({ env: { PUBLIC_URL: PUBLIC, SECURITY_CONTACT: CONTACT, SECURITY_TXT_EXPIRES: expires } }, async (base) => {
    const r = await get(base, '/.well-known/security.txt');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^text\/plain/);
    assert.deepEqual(r.buf.toString('utf8').split('\n'), [`Contact: ${CONTACT}`, `Expires: ${expires}`, `Policy: ${PUBLIC}/disclosure.html`, 'Preferred-Languages: en', `Canonical: ${PUBLIC}/.well-known/security.txt`, '']);
  });
  await withServer({ env: { PUBLIC_URL: PUBLIC } }, async (base) => {
    assert.equal((await get(base, '/.well-known/security.txt')).status, 404, 'unset: not served');
  });
});

test('health warnings', async () => {
  await withServer({ env: { PUBLIC_URL: PUBLIC } }, async (base) => {
    const h = JSON.parse((await get(base, '/health')).buf.toString('utf8'));
    assert.equal(h.ok, true);
    assert.ok(Array.isArray(h.providers));
    assert.equal(typeof h.reader, 'boolean');
    assert.deepEqual(h.warnings, [NOT_SERVED]);
  });
  await withServer({ env: { SERVE_PORTAL: '1', PUBLIC_URL: 'http://portal.harborridge.example' } }, async (base) => {
    const h = JSON.parse((await get(base, '/health')).buf.toString('utf8'));
    assert.deepEqual(h.warnings, [HTTPS, NOT_SERVED]);
  });
  const expires = isoZ(Date.now() + 180 * 24 * 60 * 60 * 1000);
  await withServer({ env: { PUBLIC_URL: PUBLIC, SECURITY_CONTACT: CONTACT, SECURITY_TXT_EXPIRES: expires } }, async (base) => {
    const h = JSON.parse((await get(base, '/health')).buf.toString('utf8'));
    assert.deepEqual(h.warnings, [], 'nothing to warn about');
  });
});
