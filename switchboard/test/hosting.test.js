// Hosted mode: a password login in front of everything, signed session cookies, and sign-in redirects on the public URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import '../src/quiet.js';

const PORT = 4612;
process.env.SWITCHBOARD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-host-'));
process.env.SWITCHBOARD_PORT = String(PORT);
process.env.SWITCHBOARD_PASSWORD = 'correct horse battery staple';
process.env.SWITCHBOARD_PUBLIC_URL = 'https://mail.example.com';

const { startApp } = await import('../src/server.js');
const { apiToken } = await import('../src/config.js');
const oauth = await import('../src/oauth.js');

test('hosted mode requires signing in, and keeps the API token and MCP bearer checks', async (t) => {
  const app = await startApp({ quiet: true, scheduler: false });
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${PORT}`;
  const H = { Host: 'mail.example.com' };
  const get = (p, headers = {}) => fetch(base + p, { headers: { ...H, ...headers }, redirect: 'manual' });
  const login = (password) => fetch(`${base}/login`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password }), redirect: 'manual' });

  assert.equal(app.url, 'https://mail.example.com/');
  assert.equal(oauth.redirectUri('google'), 'https://mail.example.com/oauth/google/callback');
  assert.equal(oauth.redirectUri('microsoft'), 'https://mail.example.com/oauth/microsoft/callback');

  const page = await get('/');
  assert.equal(page.status, 302);
  assert.equal(page.headers.get('location'), '/login');
  assert.equal((await get('/api/bootstrap', { 'X-Switchboard-Token': apiToken() })).status, 401, 'the token alone is not enough');
  assert.match(await (await get('/login')).text(), /type="password"/);

  const bad = await login('nope');
  assert.equal(bad.status, 401);
  const ok = await login('correct horse battery staple');
  assert.equal(ok.status, 303);
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  const session = cookie.split(';')[0];

  const app2 = await get('/', { Cookie: session });
  assert.equal(app2.status, 200);
  assert.match(await app2.text(), new RegExp(`content="${apiToken()}"`));
  assert.equal((await get('/api/bootstrap', { Cookie: session })).status, 401, 'session without the token is refused (CSRF)');
  const boot = await get('/api/bootstrap', { Cookie: session, 'X-Switchboard-Token': apiToken() });
  assert.equal(boot.status, 200);
  assert.deepEqual((await boot.json()).hosted, { login: true, publicUrl: 'https://mail.example.com' });

  const forged = session.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
  assert.equal((await get('/', { Cookie: forged })).status, 302);
  const mcp = await fetch(`${base}/mcp`, { method: 'POST', headers: { ...H, Authorization: `Bearer ${apiToken()}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  assert.equal(mcp.status, 200, 'MCP clients use the bearer token, not the login');
  const net = await import('node:net');
  const raw = await new Promise((resolve) => {
    const sock = net.connect(PORT, '127.0.0.1', () => sock.write('GET / HTTP/1.1\r\nHost: evil.example\r\nConnection: close\r\n\r\n'));
    let d = '';
    sock.on('data', (c) => (d += c));
    sock.on('end', () => resolve(d));
  });
  assert.match(raw, /^HTTP\/1\.1 421/, 'other host names are refused (DNS rebinding)');
  for (let i = 0; i < 5; i++) await login('wrong');
  assert.match(await (await login('correct horse battery staple')).text(), /Too many attempts/);
});
