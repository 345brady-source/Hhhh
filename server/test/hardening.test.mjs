// Regression tests for the hardening done after review: safe signature patterns, signed delivery ids,
// dot segments from provider ids, no redirect to portal-supplied links, and plain-object request bodies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BUILTINS, validateConnector, makeConnector } from '../providers/index.mjs';
import { verify } from '../providers/connector.mjs';
import { withServer, post, getJson, mockFetch } from './helpers.mjs';

const INVESTOR = { id: 'INV-9', name: 'Ann Lee', email: 'ann@investor.example' };
const sign = (secret, data) => createHmac('sha256', secret).update(data).digest('hex');
const registry = (...defs) => Object.assign({}, BUILTINS, Object.fromEntries(defs.map((d) => [d.id, makeConnector(d, {})])));
const hookDef = (verifyBlock, extra = {}) =>
  Object.assign(
    { id: 'acmehook', name: 'Acme Verify', checks: ['identity'], env: ['S'], start: { link: 'https://verify.acme.example/{reference}' }, webhook: { verify: Object.assign({ type: 'hmac', header: 'X-Sig', secret: '${env.S}' }, verifyBlock), ref: 'ref', status: 'status' }, statuses: { identity: { approved: 'passed' } } },
    extra
  );

test('signature patterns: common ones load, slow or tricky ones are refused at load time', () => {
  for (const pattern of ['v1=([0-9a-f]+)', 'v1,([A-Za-z0-9+/=]+)', 'sha256=([0-9a-fA-F]{64})']) assert.deepEqual(validateConnector(hookDef({ pattern })), [], pattern);
  for (const pattern of ['^v1=((a+)+)$', 'v1=(\\w+)*', '(a|b)+x(\\d)', 'v1=(\\w+)\\1', 'v1=(?=x)(\\w+)', '(a*)(b*)(c*)(d*)(e*)']) {
    assert.ok(validateConnector(hookDef({ pattern })).some((p) => /too complex/.test(p)), pattern);
  }
  // A quantifier inside a character class is not a repeated group.
  assert.deepEqual(validateConnector(hookDef({ pattern: 'v1=([a-f0-9)+]+)' })), []);
});

test('signature headers over 2 KB are refused before any pattern runs', () => {
  const v = { type: 'hmac', header: 'X-Sig', secret: '${env.S}', pattern: 'v1=([0-9a-f]+)' };
  const body = Buffer.from('{}');
  const good = `v1=${sign('secret-1234', body)}`;
  assert.equal(verify(v, body, { 'x-sig': good }, { S: 'secret-1234' }, {}), true);
  assert.equal(verify(v, body, { 'x-sig': `${good},${'x'.repeat(2100)}` }, { S: 'secret-1234' }, {}), false);
});

/** A pattern whose first use holds the thread until the matcher's time limit stops it, as a busy machine does; later uses are instant. */
const busyOnce = (src) => {
  const p = { uses: 0, toString() {
    p.uses += 1;
    if (p.uses === 1) for (const end = Date.now() + 5000; Date.now() < end; );
    return src;
  } };
  return p;
};

test('a correctly signed delivery is accepted when the machine is busy through the pattern time limit', () => {
  const body = Buffer.from('{"id":"evt_busy"}');
  const ts = String(Math.floor(Date.now() / 1000));
  const header = `t=${ts},v1=${sign('secret-1234', `${ts}.${body}`)}`;
  const pattern = busyOnce('v1=([0-9a-f]+)');
  const timestampPattern = busyOnce('t=(\\d+)');
  const v = { type: 'hmac', header: 'X-Sig', secret: '${env.S}', pattern, timestampPattern, signed: '{timestamp}.{body}' };
  assert.equal(verify(v, body, { 'x-sig': header }, { S: 'secret-1234' }, {}), true, 'a genuine delivery was refused after the first time limit was missed');
  assert.deepEqual([pattern.uses, timestampPattern.uses], [2, 2], 'each first attempt was stopped by the time limit and tried again');
});

/* The patterns below pass the load-time check, yet take seconds on 200 characters and days on 2,048; only the time limit stops them. */
test('a slow pattern on a 2,048-character attacker header is cut off in bounded time', () => {
  const connector = fileURLToPath(new URL('../providers/connector.mjs', import.meta.url));
  const script = `
    import { validateConnector, makeConnector } from ${JSON.stringify(connector)};
    const def = (verify) => ({ id: 'acmeslow', name: 'Acme Verify', checks: ['identity'], env: ['S'], start: { link: 'https://verify.acme.example/{reference}' },
      webhook: { verify: Object.assign({ type: 'hmac', header: 'X-Sig', secret: '\${env.S}' }, verify), ref: 'ref' } });
    const slow = '\\\\w*\\\\w*\\\\w*\\\\w*(z)';
    const cases = [
      [def({ pattern: slow }), 'a'.repeat(2048)],
      [def({ pattern: 'v1=([0-9a-f]+)', timestampPattern: slow, signed: '{timestamp}.{body}' }), 'v1=' + 'f'.repeat(64) + ',' + 'a'.repeat(2048 - 68)]
    ];
    const out = cases.map(([d, h]) => {
      const problems = validateConnector(d);
      const t = Date.now();
      const ok = makeConnector(d, {}).verifyWebhook({ rawBody: Buffer.from('{}'), headers: { 'x-sig': h }, env: { S: 'secret-1234' }, query: {} });
      return { problems, ok, ms: Date.now() - t, len: h.length };
    });
    console.log(JSON.stringify(out));
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { timeout: 6000, encoding: 'utf8' });
  assert.notEqual(r.signal, 'SIGTERM', 'a slow pattern was still running after 6 seconds');
  const out = JSON.parse(r.stdout);
  for (const c of out) {
    assert.deepEqual(c.problems, [], 'the load-time check accepts the pattern, so only the time limit protects');
    assert.equal(c.len, 2048);
    assert.equal(c.ok, false);
    assert.ok(c.ms < 2000, `the slow pattern held the server for ${c.ms} ms`);
  }
});

test('an unsigned id header with no body id de-duplicates by the exact body instead', async () => {
  const def = hookDef({ idHeader: 'X-Delivery' });
  const secret = 'whk-secret-abcdef';
  await withServer({ env: { S: secret }, providers: registry(def) }, async (base) => {
    const ver = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'acmehook', investor: INVESTOR })).json();
    const body = JSON.stringify({ ref: ver.id, status: 'approved' });
    const send = (d) => post(`${base}/webhooks/acmehook`, body, { 'X-Sig': sign(secret, body), 'X-Delivery': d });
    assert.equal((await (await send('d1')).json()).duplicate, undefined);
    assert.equal((await (await send('d2')).json()).duplicate, true);
    assert.equal((await getJson(`${base}/v1/verifications/${ver.id}`)).status, 'passed');
  });
});

test('a provider id of ".." cannot move a polling call to another path', async () => {
  const def = {
    id: 'acmepoll',
    name: 'Acme Verify',
    checks: ['identity'],
    env: ['K'],
    auth: { type: 'bearer', token: '${env.K}' },
    start: { request: { method: 'POST', url: 'https://api.acme.example/v1/sessions', body: { ref: '{reference}' } }, response: { ref: 'id', url: 'url' } },
    result: { request: { url: 'https://api.acme.example/v1/sessions/{ref}/result' }, response: { status: 'status' } }
  };
  const f = mockFetch([
    ['POST', 'https://api.acme.example/v1/sessions', () => ({ id: '..', url: 'https://verify.acme.example/s/1' })],
    ['GET', 'https://api.acme.example/', () => ({ status: 'passed' })]
  ]);
  await withServer({ env: { K: 'key-123456' }, fetch: f, providers: registry(def) }, async (base) => {
    const ver = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'acmepoll', investor: INVESTOR })).json();
    const res = await fetch(`${base}/v1/verifications/${ver.id}`);
    assert.notEqual(res.status, 200);
    assert.equal(f.calls.filter((c) => c.method === 'GET').length, 0);
    assert.ok(!JSON.stringify(await res.json()).includes('key-123456'));
  });
});

test('/hosted/:id still redirects to a connector start link from the server configuration', async () => {
  const def = { id: 'acmelink', name: 'Acme Verify', checks: ['identity'], start: { link: 'https://verify.acme.example/start?ref={reference}' } };
  await withServer({ providers: registry(def) }, async (base) => {
    const ver = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'acmelink', investor: INVESTOR })).json();
    const res = await fetch(`${base}/hosted/${ver.id}`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), `https://verify.acme.example/start?ref=${ver.id}`);
    const linked = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'link', settings: { link: 'https://verify.acme.example/go?ref={reference}' }, investor: INVESTOR })).json();
    assert.equal((await fetch(`${base}/hosted/${linked.id}`, { redirect: 'manual' })).status, 404);
  });
});

test('request bodies that are not JSON objects answer 400, not a provider error', () =>
  withServer({}, async (base) => {
    for (const [path, body] of [['/v1/verifications', 'null'], ['/v1/verifications', '[1]'], ['/v1/screenings', '"x"'], ['/v1/screenings', JSON.stringify({ provider: 'ofac', names: 'Ann Lee' })]]) {
      const res = await post(`${base}${path}`, body);
      assert.equal(res.status, 400, `${path} ${body}`);
      assert.ok(!/Cannot read|Provider request failed/.test((await res.json()).error));
    }
  }));
