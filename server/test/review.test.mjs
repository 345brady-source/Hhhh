// Security and correctness review of the connector framework. Each test demonstrates one defect
// found in review and passes once it is fixed. No network is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTINS, loadProviders, validateConnector, makeConnector } from '../providers/index.mjs';
import { verify } from '../providers/connector.mjs';
import { withServer, post, getJson, mockFetch } from './helpers.mjs';

const INVESTOR = { id: 'INV-9', name: 'Ann Lee', email: 'ann@investor.example' };
const sign = (alg, secret, data, enc = 'hex') => createHmac(alg, secret).update(data).digest(enc);
const registry = (...defs) => Object.assign({}, BUILTINS, Object.fromEntries(defs.map((d) => [d.id, makeConnector(d, {})])));

/* 1. A ${env.*} value in a start "link" is sent to the portal. */
test('review: a start link cannot carry ${env.*} secrets to the portal', async () => {
  const def = { id: 'acmelink', name: 'Acme Verify', checks: ['identity'], env: ['ACME_KEY'], start: { link: 'https://verify.acme.example/start?key=${env.ACME_KEY}&ref={reference}' } };
  const problems = validateConnector(def);
  if (problems.length) return; // refused at load time: fixed
  await withServer({ env: { ACME_KEY: 'sekrit-key-123456' }, providers: registry(def) }, async (base) => {
    const r = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'acmelink', investor: INVESTOR })).json();
    assert.ok(!JSON.stringify(r).includes('sekrit-key-123456'), `the secret reached the portal: ${r.url}`);
    const st = await getJson(`${base}/v1/verifications/${r.id}`);
    assert.ok(!JSON.stringify(st).includes('sekrit-key-123456'), 'the secret reached the portal through GET');
  });
});

/* 2. Dot segments in {investor.*}, {settings.*} or {names} move a call to another path on the provider's API. */
test('review: placeholder values cannot add dot segments to a provider URL path', async () => {
  const def = {
    id: 'acmepath',
    name: 'Acme Verify',
    checks: ['identity'],
    env: ['ACME_KEY'],
    auth: { type: 'bearer', token: '${env.ACME_KEY}' },
    start: { request: { method: 'POST', url: 'https://api.acme.example/v1/investors/{investor.id}/sessions', body: { ref: '{reference}' } }, response: { url: 'url' } }
  };
  const f = mockFetch([['POST', 'https://api.acme.example/', () => ({ url: 'https://verify.acme.example/s/1' })]]);
  await withServer({ env: { ACME_KEY: 'k-123456' }, fetch: f, providers: registry(def) }, async (base) => {
    await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'acmepath', investor: { id: '..', name: 'Ann Lee' } });
    for (const c of f.calls) assert.ok(new URL(c.url).pathname.startsWith('/v1/investors/'), `the call left the templated path: ${new URL(c.url).pathname}`);
  });
});

/* 3. An empty authority ("https:///{settings.host}/...") passes the load-time literal-host check. */
test('review: a URL with an empty host and a placeholder after it is refused at load time', () => {
  const def = { id: 'acmehost', name: 'Acme Verify', checks: ['identity'], start: { request: { url: 'https:///{settings.host}/v1/sessions' }, response: { url: 'url' } } };
  assert.ok(validateConnector(def).some((p) => /start\.request\.url/.test(p)), 'expected a problem naming start.request.url');
});

/* 4. OAuth2 client-credentials: concurrent calls with an empty cache each fetch their own token. */
test('review: concurrent calls share one oauth2 token request', async () => {
  let tokens = 0;
  const def = {
    id: 'acmeoauth',
    name: 'Acme Verify',
    checks: ['identity'],
    env: ['ACME_CLIENT_ID', 'ACME_CLIENT_SECRET'],
    auth: { type: 'oauth2', tokenUrl: 'https://auth.acme.example/token', clientId: '${env.ACME_CLIENT_ID}', clientSecret: '${env.ACME_CLIENT_SECRET}' },
    start: { request: { method: 'POST', url: 'https://api.acme.example/v1/sessions', body: { ref: '{reference}' } }, response: { url: 'url' } }
  };
  const a = makeConnector(def, {});
  const fetchFn = async (url) => {
    if (String(url).includes('/token')) {
      tokens += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: `tok-${tokens}`, expires_in: 3600 }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ url: 'https://verify.acme.example/s/1' }) };
  };
  const ctx = { env: { ACME_CLIENT_ID: 'cid-1', ACME_CLIENT_SECRET: 'cs-secret-1' }, fetch: fetchFn, reference: 'ver_1', kind: 'identity', investor: {}, settings: {} };
  await Promise.all([1, 2, 3, 4, 5].map(() => a.createSession(ctx)));
  assert.equal(tokens, 1, `${tokens} token requests for 5 concurrent calls`);
});

/* 5. Basic auth: a provider echoing the Authorization header leaks the password (base64 of "user:password" is not redacted). */
test('review: error messages never carry a basic-auth password, even base64-encoded with the username', async () => {
  const def = { id: 'acmebasic', name: 'Acme Verify', checks: ['identity'], env: ['ACME_USER', 'ACME_PASS'], auth: { type: 'basic', username: '${env.ACME_USER}', password: '${env.ACME_PASS}' }, start: { request: { method: 'POST', url: 'https://api.acme.example/v1/sessions', body: { a: 1 } }, response: { url: 'url' } } };
  const a = makeConnector(def, {});
  const fetchFn = async (url, init) => ({ ok: false, status: 401, text: async () => JSON.stringify({ message: `Rejected ${init.headers.Authorization}` }) });
  const err = await a.createSession({ env: { ACME_USER: 'acct-user', ACME_PASS: 'pw-secret-99' }, fetch: fetchFn, reference: 'ver_1', kind: 'identity', investor: {}, settings: {} }).catch((e) => e);
  const leaked = (err.message.match(/[A-Za-z0-9+/=]{8,}/g) || []).some((s) => Buffer.from(s, 'base64').toString('latin1').includes('pw-secret-99'));
  assert.ok(!err.message.includes('pw-secret-99') && !leaked, `the password can be decoded from: ${err.message}`);
});

/* 6. The "link" provider turns /hosted/:id into an open redirect to any https site the caller names. */
test('review: /hosted/:id is not an open redirect for portal-supplied links', () =>
  withServer({}, async (base) => {
    const r = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'link', settings: { link: 'https://phish.attacker.example/login?r={reference}' }, investor: INVESTOR })).json();
    if (!r.id) return; // refused: fixed
    const res = await fetch(`${base}/hosted/${r.id}`, { redirect: 'manual' });
    assert.ok(!(res.status >= 300 && res.status < 400 && /attacker\.example/.test(res.headers.get('location') || '')), `redirected to ${res.headers.get('location')}`);
  }));

/* 7. Link templates with control characters (CR/LF) are accepted and stored. */
test('review: link templates with line breaks or other control characters are refused', () =>
  withServer({}, async (base) => {
    const res = await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'link', settings: { link: 'https://verify.acme.example/start?ref={reference}\r\nSet-Cookie: a=b' }, investor: INVESTOR });
    assert.equal(res.status, 400, 'a link with CR/LF was accepted');
  }));

/* 8. The results API answers 502 with an internal error message for a JSON body that is not an object. */
test('review: results API answers 400 for a body that is not a JSON object', () =>
  withServer({ env: { RESULTS_TOKEN: 'results-token-1234567890' } }, async (base) => {
    const res = await post(`${base}/v1/results`, 'null', { Authorization: 'Bearer results-token-1234567890' });
    assert.equal(res.status, 400);
    assert.ok(!/Cannot read properties|Provider request failed/.test((await res.json()).error));
  }));

/* 9. A timestamp header that is not part of the signed string gives no replay protection. */
test('review: an unsigned timestamp cannot make a captured delivery look fresh', () => {
  const v = { type: 'hmac', header: 'X-Acme-Signature', secret: '${env.ACME_WEBHOOK_SECRET}', timestampHeader: 'X-Acme-Timestamp', tolerance: 300 };
  const def = { id: 'acmets', name: 'Acme Verify', checks: ['identity'], env: ['ACME_WEBHOOK_SECRET'], start: { link: 'https://verify.acme.example/{reference}' }, webhook: { verify: v, ref: 'ref', status: 'status' } };
  if (validateConnector(def).length) return; // refused at load time: fixed
  const env = { ACME_WEBHOOK_SECRET: 'whk-secret-abcdef' };
  const body = Buffer.from('{"ref":"ver_1","status":"approved"}');
  const sig = sign('sha256', env.ACME_WEBHOOK_SECRET, body);
  // Captured an hour ago; replayed now with the timestamp header simply rewritten.
  const now = String(Math.floor(Date.now() / 1000));
  assert.equal(verify(v, body, { 'x-acme-signature': sig, 'x-acme-timestamp': now }, env, {}), false, 'a replay with a rewritten unsigned timestamp was accepted');
});

/* 10. An unsigned delivery-id header takes priority over the signed body id, so replays bypass de-duplication. */
test('review: a replay cannot dodge de-duplication by changing an unsigned id header', async () => {
  const def = {
    id: 'acmedup',
    name: 'Acme Verify',
    checks: ['identity'],
    env: ['ACME_WEBHOOK_SECRET'],
    start: { link: 'https://verify.acme.example/{reference}' },
    webhook: { verify: { type: 'hmac', header: 'X-Acme-Signature', secret: '${env.ACME_WEBHOOK_SECRET}', idHeader: 'X-Acme-Delivery' }, id: 'id', ref: 'ref', status: 'status' },
    statuses: { identity: { approved: 'passed', declined: 'failed' } }
  };
  if (validateConnector(def).length) return; // refused at load time: fixed
  const secret = 'whk-secret-abcdef';
  await withServer({ env: { ACME_WEBHOOK_SECRET: secret }, providers: registry(def) }, async (base) => {
    const ver = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'acmedup', investor: INVESTOR })).json();
    const body = JSON.stringify({ id: 'evt_1', ref: ver.id, status: 'approved' });
    const hdr = (d) => ({ 'X-Acme-Signature': sign('sha256', secret, body), 'X-Acme-Delivery': d });
    assert.equal((await (await post(`${base}/webhooks/acmedup`, body, hdr('d1'))).json()).duplicate, undefined);
    const again = await (await post(`${base}/webhooks/acmedup`, body, hdr('d2-attacker'))).json();
    assert.equal(again.duplicate, true, 'the same signed delivery was processed twice');
  });
});

/* 11. A catastrophic "pattern" runs on an unauthenticated header before the signature is checked. */
test('review: a slow "pattern" cannot hang the server on an unauthenticated webhook header', () => {
  const connector = fileURLToPath(new URL('../providers/connector.mjs', import.meta.url));
  const script = `
    import { makeConnector } from ${JSON.stringify(connector)};
    const def = { id: 'acmeredos', name: 'Acme Verify', checks: ['identity'], env: ['S'], start: { link: 'https://verify.acme.example/{reference}' },
      webhook: { verify: { type: 'hmac', header: 'X-Sig', secret: '\${env.S}', pattern: '^v1=((a+)+)$' }, ref: 'ref' } };
    let a;
    try { a = makeConnector(def, {}); } catch { process.exit(0); }
    a.verifyWebhook({ rawBody: Buffer.from('{}'), headers: { 'x-sig': 'v1=' + 'a'.repeat(40) + '!' }, env: { S: 'secret-1234' }, query: {} });
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { timeout: 3000 });
  assert.notEqual(r.signal, 'SIGTERM', 'verifyWebhook was still running after 3 seconds');
});

/* 12. The plug-in template forges-open with an empty webhook secret, and the webhook route ignores missing env. */
test('review: webhooks are refused for a plug-in whose environment is not configured (empty secret)', async () => {
  // A sibling of plugins/ so the template's '../lib/...' imports resolve; removed afterwards.
  const dir = mkdtempSync(fileURLToPath(new URL('../.review-plugins-', import.meta.url)));
  try {
    copyFileSync(fileURLToPath(new URL('../plugins/_template.mjs', import.meta.url)), join(dir, 'acmeverify.mjs'));
    writeFileSync(join(dir, 'connectors.json'), '{ "connectors": [] }');
    const env = { ACME_API_KEY: 'k-123456', ACME_API_SECRET: 's-123456', ACME_WEBHOOK_SECRET: '' };
    const providers = await loadProviders({ env, connectorsFile: join(dir, 'connectors.json'), pluginsDir: dir });
    await withServer({ env, providers, fetch: mockFetch([]) }, async (base) => {
      const ts = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ delivery_id: 'd1', session_id: 'ses_1', type: 'x' });
      const sig = createHmac('sha256', '').update(`${ts}.${body}`).digest('hex');
      const res = await post(`${base}/webhooks/acmeverify`, body, { 'X-Acme-Timestamp': ts, 'X-Acme-Signature': sig });
      assert.notEqual(res.status, 200, 'a delivery signed with an empty key was accepted');
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
