// Regression tests for the hardening done after review: safe signature patterns, signed delivery ids,
// dot segments from provider ids, no redirect to portal-supplied links, and plain-object request bodies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
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
