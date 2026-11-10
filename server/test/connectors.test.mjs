// Declarative connectors, code plug-ins and the built-in link provider, all against a mocked fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTINS, PROVIDERS, loadProviders, describe, validateConnector, makeConnector } from '../providers/index.mjs';
import { fill, fillBody, fillUrl, varsFrom, get } from '../lib/template.mjs';
import { withServer, post, getJson, mockFetch } from './helpers.mjs';

const EXAMPLE = fileURLToPath(new URL('../connectors.example.json', import.meta.url));
const INVESTOR = { id: 'INV-7', name: 'Ann Marie Lee', email: 'ann+test@investor.example', account: 'Lee Family Trust', workspace: 'w1' };
const SECRETS = { ACME_API_KEY: 'key-live-0123456789', ACME_WEBHOOK_SECRET: 'whk-secret-abcdef', ACME_TOKEN: 'url-token-987654', ACME_CLIENT_ID: 'client-1', ACME_CLIENT_SECRET: 'client-secret-xyz', ACME_STD_SECRET: 'whsec_' + Buffer.from('standard-secret-bytes-123').toString('base64'), ACME_ALG_SECRET: 'alg-secret-4567' };

/** A full identity + aml connector with an API start, polling, screening and an HMAC webhook. */
const acmeid = () => ({
  id: 'acmeid',
  name: 'Acme Verify',
  description: 'Government ID and selfie check.',
  checks: ['identity', 'aml'],
  env: ['ACME_API_KEY', 'ACME_WEBHOOK_SECRET'],
  auth: { type: 'bearer', token: '${env.ACME_API_KEY}' },
  start: {
    request: { method: 'POST', url: 'https://api.acme.example/v1/sessions', headers: { 'X-Ref': '{reference}' }, body: { reference: '{reference}', name: '{investor.name}', first: '{investor.firstName}', last: '{investor.lastName}', email: '{investor.email}', level: '{settings.level}', redirect_url: '{returnUrl}', callback_url: '{webhookUrl}', note: 'Investor {investor.firstName} in {investor.workspace}' } },
    response: { ref: 'data.id', url: 'data.url', status: 'data.status' }
  },
  result: { request: { method: 'GET', url: 'https://api.acme.example/v1/sessions/{ref}' }, response: { status: 'data.status', detail: 'data.reason', method: 'data.method', expiresAt: 'data.expires_at', screeningStatus: 'data.watchlist.status', screeningHits: 'data.watchlist.matches' } },
  screen: { request: { method: 'POST', url: 'https://api.acme.example/v1/screenings', body: { names: '{names}', reference: '{reference}' } }, response: { ref: 'id', status: 'status', hits: 'matches', hit: { name: 'query', listed: 'matched_name', list: 'list', score: 'score', detail: 'notes' } }, monitoring: true },
  screenResult: { request: { url: 'https://api.acme.example/v1/screenings/{ref}' }, response: { status: 'status', hits: 'matches' } },
  webhook: { verify: { type: 'hmac', header: 'X-Acme-Signature', algorithm: 'sha256', encoding: 'hex', prefix: 'sha256=', secret: '${env.ACME_WEBHOOK_SECRET}' }, id: 'id', event: 'type', ref: 'data.session_id', status: 'data.status', detail: 'data.reason', hits: 'data.matches' },
  statuses: { identity: { approved: 'passed', declined: 'failed', needs_review: 'review' }, aml: { no_match: 'clear', match: 'potential_match', processing: 'pending' } }
});

const registry = (...defs) => Object.assign({}, BUILTINS, Object.fromEntries(defs.map((d) => [d.id, makeConnector(d, {})])));
const sign = (alg, secret, data, enc = 'hex') => createHmac(alg, secret).update(data).digest(enc);

/* ---------------- Definition validation ---------------- */

test('the example connectors are valid and load', async () => {
  const reg = await loadProviders({ env: {}, connectorsFile: EXAMPLE, pluginsDir: mkdtempSync(join(tmpdir(), 'plug-')) });
  assert.ok(reg.acmeid && reg.acmeaccredit && reg.acmewatch);
  assert.equal(reg.sandbox, BUILTINS.sandbox);
  assert.deepEqual(validateConnector(acmeid()), []);
});

test('validation: every rule names its problem', () => {
  const problems = (patch, env) => validateConnector(Object.assign(acmeid(), patch), env).join(' | ');
  assert.match(problems({ id: 'Acme!' }), /id must be 2 to 32 lower-case/);
  assert.match(problems({ id: 'a' }), /id must be/);
  assert.match(problems({ name: '' }), /name is required/);
  assert.match(problems({ checks: ['kyc'] }), /checks must list/);
  assert.match(problems({ checks: [] }), /checks must list/);
  assert.match(problems({ env: ['bad name'] }), /env must be a list/);
  assert.match(problems({ surprise: 1 }), /unknown field "surprise"/);
  assert.deepEqual(validateConnector(Object.assign(acmeid(), { _notes: 'fine', $comment: 'fine' })), []);
  // SSRF guard: https only, literal scheme + host + port, no credentials.
  const url = (u) => problems({ result: { request: { url: u }, response: { status: 's' } } });
  assert.match(url('http://api.acme.example/x'), /must start with https/);
  assert.match(url('ftp://api.acme.example/x'), /must start with https/);
  assert.match(url('https://{settings.host}/x'), /spell out its scheme, host and port/);
  assert.match(url('https://api.acme.example.{settings.tld}/x'), /spell out its scheme, host and port/);
  assert.match(url('https://api.acme.example:{settings.port}/x'), /spell out/);
  assert.match(url('https://${env.ACME_API_KEY}.acme.example/x'), /spell out/);
  assert.match(url('https://user@api.acme.example/x'), /spell out/);
  assert.match(url('{settings.base}/x'), /must start with https/);
  assert.match(url('http://localhost:9999/x'), /only allowed for local tests/);
  assert.deepEqual(validateConnector(Object.assign(acmeid(), { result: { request: { url: 'http://127.0.0.1:9999/x/{ref}' }, response: { status: 's' } } }), { ALLOW_HTTP_CONNECTORS: '1' }), []);
  assert.match(problems({ result: { request: { url: 'http://evil.example/x' }, response: { status: 's' } } }, { ALLOW_HTTP_CONNECTORS: '1' }), /must start with https/);
  // Placeholders: known names only, and every ${env.X} listed in env.
  assert.match(url('https://api.acme.example/x/{investor.ssn}'), /unknown placeholder \{investor\.ssn\}/);
  assert.match(url('https://api.acme.example/x?k=${env.OTHER_SECRET}'), /OTHER_SECRET is not listed in "env"/);
  assert.match(problems({ start: { request: { url: 'https://api.acme.example/s', body: { x: '{nope}' } }, response: { url: 'u' } } }), /unknown placeholder \{nope\}/);
  assert.match(problems({ start: { request: { url: 'https://api.acme.example/s', headers: { 'Bad Header': 'x' } }, response: { url: 'u' } } }), /invalid header name/);
  // Start, result, screen.
  assert.match(problems({ start: undefined }), /start is required/);
  assert.match(problems({ start: { link: 'https://a.acme.example/{reference}', request: { url: 'https://a.acme.example/' } } }), /either a "link" or a "request"/);
  assert.match(problems({ start: { request: { url: 'https://api.acme.example/s' }, response: { ref: 'id' } } }), /start\.response\.url is required/);
  assert.match(problems({ start: { request: { url: 'https://api.acme.example/s', method: 'TRACE' }, response: { url: 'u' } } }), /method must be one of/);
  assert.match(problems({ result: { request: { url: 'https://api.acme.example/s' }, response: { status: 'data..status' } } }), /dot path/);
  assert.match(problems({ result: { request: { url: 'https://api.acme.example/s' }, response: { colour: 'x' } } }), /unknown field "colour"/);
  assert.match(problems({ screen: undefined }), /screen is required for aml/);
  assert.match(validateConnector({ id: 'acmeaml', name: 'A', checks: ['aml'], screen: acmeid().screen, start: { link: 'https://a.acme.example/' } }).join(), /start only applies to identity and accreditation/);
  // Statuses must map to normalized values of a listed check.
  assert.match(problems({ statuses: { identity: { approved: 'ok' } } }), /statuses\.identity\.approved must be one of pending, passed, review, failed/);
  assert.match(problems({ statuses: { accreditation: { approved: 'verified' } } }), /statuses\.accreditation does not match a check/);
  // Auth: secrets only from the environment.
  assert.match(problems({ auth: { type: 'bearer', token: 'hard-coded-token' } }), /auth\.token must come from the environment/);
  assert.match(problems({ auth: { type: 'magic' } }), /auth\.type must be one of/);
  assert.match(problems({ auth: { type: 'basic', username: 'u' } }), /auth\.password is required/);
  assert.match(problems({ env: ['ACME_CLIENT_SECRET'], auth: { type: 'oauth2', tokenUrl: 'http://auth.acme.example/t', clientId: 'id', clientSecret: '${env.ACME_CLIENT_SECRET}' } }), /auth\.tokenUrl must start with https/);
  // Webhooks: unsigned is refused; signatures need their pieces.
  const hook = (verify) => problems({ webhook: Object.assign(acmeid().webhook, { verify }) });
  assert.match(hook({ type: 'none' }), /"none" is refused/);
  assert.match(problems({ webhook: { ref: 'id' } }), /webhook\.verify is required/);
  assert.match(hook({ type: 'hmac', header: 'X-Sig', secret: 'literal' }), /secret must be "\$\{env\.NAME\}"/);
  assert.match(hook({ type: 'hmac', header: 'X-Sig', secret: '${env.ACME_WEBHOOK_SECRET}', signed: '{timestamp}' }), /signed must include \{body\}/);
  assert.match(hook({ type: 'hmac', header: 'X-Sig', secret: '${env.ACME_WEBHOOK_SECRET}', signed: '{timestamp}.{body}' }), /timestampHeader or timestampPattern is required/);
  assert.match(hook({ type: 'hmac', header: 'X-Sig', secret: '${env.ACME_WEBHOOK_SECRET}', signed: '{id}.{body}' }), /idHeader is required/);
  assert.match(hook({ type: 'hmac', header: 'X-Sig', secret: '${env.ACME_WEBHOOK_SECRET}', pattern: 'v1=(' }), /not a valid regular expression/);
  assert.match(hook({ type: 'hmac', header: 'X-Sig', secret: '${env.ACME_WEBHOOK_SECRET}', pattern: 'v1=[0-9a-f]+' }), /capture group/);
  assert.match(hook({ type: 'hmac', header: 'X-Sig', secret: '${env.ACME_WEBHOOK_SECRET}', algorithm: 'md5' }), /algorithm must be one of sha1, sha256, sha512/);
  assert.match(hook({ type: 'hmac', header: 'X-Sig', secret: '${env.ACME_WEBHOOK_SECRET}', signed: '{body}{settings.x}' }), /unknown placeholder \{settings\.x\}/);
  assert.match(problems({ env: ['ACME_TOKEN'], result: undefined, webhook: { ref: 'id', verify: { type: 'token', param: 'token', secret: '${env.ACME_TOKEN}' } } }), /"result" is required/);
});

test('loader: invalid definitions and duplicate ids stop startup with every problem named', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'conn-'));
  const empty = mkdtempSync(join(tmpdir(), 'plug-'));
  try {
    const file = join(dir, 'connectors.json');
    writeFileSync(file, JSON.stringify({ connectors: [acmeid(), Object.assign(acmeid(), { name: 'Copy' }), Object.assign(acmeid(), { id: 'sandbox' }), Object.assign(acmeid(), { id: 'acmebad', checks: ['kyc'], webhook: { ref: 'x', verify: { type: 'none' } } })] }));
    await assert.rejects(loadProviders({ env: {}, connectorsFile: file, pluginsDir: empty }), (e) => {
      assert.equal(e.config, true);
      assert.match(e.message, /cannot start/);
      assert.match(e.message, /Connector "acmeid": the id "acmeid" is already used/);
      assert.match(e.message, /Connector "sandbox": the id "sandbox" is already used by a built-in provider/);
      assert.match(e.message, /Connector "acmebad": .*checks must list.*"none" is refused/);
      assert.ok(!e.message.includes(SECRETS.ACME_API_KEY));
      return true;
    });
    writeFileSync(file, '{ not json');
    await assert.rejects(loadProviders({ env: {}, connectorsFile: file, pluginsDir: empty }), /not valid JSON/);
    writeFileSync(file, JSON.stringify({ items: [] }));
    await assert.rejects(loadProviders({ env: {}, connectorsFile: file, pluginsDir: empty }), /must be \{ "connectors"/);
    await assert.rejects(loadProviders({ env: { CONNECTORS_FILE: join(dir, 'missing.json') }, pluginsDir: empty }), /was not found/);
    // The registry the server uses has no vendor built in.
    assert.deepEqual(Object.keys(BUILTINS).sort(), ['link', 'ofac', 'sandbox']);
    assert.ok(Object.keys(PROVIDERS).includes('link'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------------- Templates ---------------- */

test('placeholders: URL encoding, refusals in URLs, body templates and dot paths', () => {
  const vars = varsFrom({ reference: 'ver_1', kind: 'identity', returnUrl: 'http://verify.test/return/x/ver_1?a=1&b=2', investor: INVESTOR, settings: { level: 'basic', path: '../admin', n: 3, obj: { x: 1 } }, env: { ACME_API_KEY: 'k y' } }, { names: ['Ann Lee', 'Lee Trust'] });
  assert.equal(vars.investor.firstName, 'Ann Marie');
  assert.equal(vars.investor.lastName, 'Lee');
  assert.equal(vars.settings.obj, undefined, 'settings are plain values only');
  assert.equal(fillUrl('https://a.acme.example/s?r={reference}&back={returnUrl}&k=${env.ACME_API_KEY}&e={investor.email}', vars), 'https://a.acme.example/s?r=ver_1&back=http%3A%2F%2Fverify.test%2Freturn%2Fx%2Fver_1%3Fa%3D1%26b%3D2&k=k%20y&e=ann%2Btest%40investor.example');
  assert.throws(() => fillUrl('https://a.acme.example/{settings.path}', vars), /cannot be used in a URL/);
  assert.throws(() => fillUrl('https://a.acme.example/u/{investor.name}', vars), /cannot be used in a URL/);
  assert.equal(fill('Hi {investor.firstName} ({settings.n}) {unknown}', vars), 'Hi Ann Marie (3) ');
  assert.deepEqual(fillBody({ names: '{names}', list: ['{reference}', 'x-{kind}'], n: '{settings.n}', nested: { e: '{investor.email}' }, keep: 5, flag: true }, vars), { names: ['Ann Lee', 'Lee Trust'], list: ['ver_1', 'x-identity'], n: '3', nested: { e: 'ann+test@investor.example' }, keep: 5, flag: true });
  const data = { data: { attributes: { status: 'ok' } }, items: [{ id: 'a' }, { id: 'b' }] };
  assert.equal(get(data, 'data.attributes.status'), 'ok');
  assert.equal(get(data, 'items.1.id'), 'b');
  assert.equal(get(data, 'items.9.id'), undefined);
  assert.equal(get(data, 'constructor'), undefined);
  assert.equal(get(data, '$'), data);
});

/* ---------------- Auth ---------------- */

test('auth: bearer, basic, header and query credentials come from the environment', async () => {
  const base = { id: 'acmeauth', name: 'Acme Auth', checks: ['identity'], env: ['ACME_API_KEY'], start: { request: { url: 'https://api.acme.example/s?x=1', body: { r: '{reference}' } }, response: { url: 'url' } } };
  const cases = [
    [{ type: 'bearer', token: '${env.ACME_API_KEY}' }, (c) => c.headers.Authorization === `Bearer ${SECRETS.ACME_API_KEY}`],
    [{ type: 'basic', username: 'acct', password: '${env.ACME_API_KEY}' }, (c) => c.headers.Authorization === `Basic ${Buffer.from(`acct:${SECRETS.ACME_API_KEY}`).toString('base64')}`],
    [{ type: 'header', name: 'X-Api-Key', value: '${env.ACME_API_KEY}' }, (c) => c.headers['X-Api-Key'] === SECRETS.ACME_API_KEY && !c.headers.Authorization],
    [{ type: 'query', name: 'api_key', value: '${env.ACME_API_KEY}' }, (c) => c.url === `https://api.acme.example/s?x=1&api_key=${SECRETS.ACME_API_KEY}`]
  ];
  for (const [auth, check] of cases) {
    const f = mockFetch([['POST', 'https://api.acme.example/s', () => ({ url: 'https://verify.acme.example/go/1' })]]);
    const c = makeConnector(Object.assign({}, base, { auth }), {});
    const r = await c.createSession({ env: SECRETS, fetch: f, reference: 'ver_a', kind: 'identity', investor: INVESTOR, settings: {} });
    assert.equal(r.url, 'https://verify.acme.example/go/1');
    assert.equal(r.ref, 'ver_a', 'the reference stands in when the provider returns no id');
    assert.ok(check(f.calls[0]), `${auth.type} credentials sent`);
    assert.equal(f.calls[0].redirect, 'manual', 'redirects are not followed');
  }
});

test('auth: oauth2 client credentials are cached until shortly before they expire, and renewed on 401', async () => {
  const def = (style, scope) => ({ id: 'acmeoauth', name: 'Acme OAuth', checks: ['accreditation'], env: ['ACME_CLIENT_ID', 'ACME_CLIENT_SECRET'], auth: Object.assign({ type: 'oauth2', tokenUrl: 'https://auth.acme.example/oauth/token', clientId: '${env.ACME_CLIENT_ID}', clientSecret: '${env.ACME_CLIENT_SECRET}', style }, scope ? { scope, audience: 'https://api.acme.example' } : {}), start: { link: 'https://accredit.acme.example/{reference}' }, result: { request: { url: 'https://api.acme.example/r/{ref}' }, response: { status: 'state' } } });
  let issued = 0;
  let life = 3600;
  let reject = '';
  const f = mockFetch([
    ['POST', 'https://auth.acme.example/oauth/token', () => ({ access_token: `tok-${++issued}`, token_type: 'Bearer', expires_in: life })],
    ['GET', 'https://api.acme.example/r/', (c) => (c.headers.Authorization === reject ? { status: 401, body: { error: 'expired' } } : { state: 'verified' })]
  ]);
  const ctx = { env: SECRETS, fetch: f, reference: 'ver_o', ref: 'ver_o', kind: 'accreditation', investor: INVESTOR, settings: {} };
  const c = makeConnector(def('form', 'verifications'), {});
  assert.equal((await c.fetchResult(ctx)).status, 'verified');
  assert.equal((await c.fetchResult(ctx)).status, 'verified');
  const tokenCalls = f.calls.filter((x) => x.url.includes('/oauth/token'));
  assert.equal(tokenCalls.length, 1, 'the token is cached');
  assert.deepEqual(tokenCalls[0].body, { grant_type: 'client_credentials', client_id: 'client-1', client_secret: 'client-secret-xyz', scope: 'verifications', audience: 'https://api.acme.example' });
  assert.ok(f.calls.filter((x) => x.url.includes('/r/')).every((x) => x.headers.Authorization === 'Bearer tok-1'));
  // A revoked token: one 401, a new token, one retry.
  reject = 'Bearer tok-1';
  assert.equal((await c.fetchResult(ctx)).status, 'verified');
  assert.equal(issued, 2);
  // A short-lived token is renewed once it is close to expiring.
  life = 1;
  const short = makeConnector(def('json'), {});
  const before = issued;
  await short.fetchResult(ctx);
  await new Promise((r) => setTimeout(r, 650));
  await short.fetchResult(ctx);
  assert.equal(issued - before, 2, 'an expiring token is fetched again');
  const jsonCall = f.calls.filter((x) => x.url.includes('/oauth/token')).pop();
  assert.equal(jsonCall.headers['Content-Type'], 'application/json');
  assert.equal(jsonCall.body.client_secret, 'client-secret-xyz');
  // Basic style: client id and secret in the Authorization header.
  const basic = makeConnector(def('basic'), {});
  await basic.fetchResult(ctx);
  const basicCall = f.calls.filter((x) => x.url.includes('/oauth/token')).pop();
  assert.equal(basicCall.headers.Authorization, `Basic ${Buffer.from('client-1:client-secret-xyz').toString('base64')}`);
  assert.equal(basicCall.body.client_secret, undefined);
});

/* ---------------- Starting checks, polling and status mapping ---------------- */

test('API start through the server: placeholders filled, private ids kept, secrets never returned', async () => {
  const f = mockFetch([['POST', 'https://api.acme.example/v1/sessions', () => ({ data: { id: 'ses_42', url: 'https://verify.acme.example/flow/ses_42', status: 'created' } })]]);
  await withServer({ env: SECRETS, fetch: f, providers: registry(acmeid()) }, async (base, server) => {
    const res = await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'acmeid', settings: { level: 'enhanced', secret: { nested: 'dropped' } }, investor: INVESTOR, returnUrl: 'https://portal.example/diy.html' });
    const text = await res.text();
    assert.equal(res.status, 200, text);
    const created = JSON.parse(text);
    assert.equal(created.url, 'https://verify.acme.example/flow/ses_42');
    assert.equal(created.status, 'pending', 'an unmapped start status stays pending');
    const call = f.calls[0];
    assert.equal(call.headers.Authorization, `Bearer ${SECRETS.ACME_API_KEY}`);
    assert.equal(call.headers['X-Ref'], created.id);
    assert.deepEqual(call.body, { reference: created.id, name: 'Ann Marie Lee', first: 'Ann Marie', last: 'Lee', email: INVESTOR.email, level: 'enhanced', redirect_url: `http://verify.test/return/acmeid/${created.id}`, callback_url: 'http://verify.test/webhooks/acmeid', note: 'Investor Ann Marie in w1' });
    assert.equal(server.store.get('verifications', created.id).ref, 'ses_42');
    assert.ok(!text.includes(SECRETS.ACME_API_KEY));
    // A provider link that is not https is refused.
    const bad = makeConnector(acmeid(), {});
    const f2 = mockFetch([['POST', 'https://api.acme.example/v1/sessions', () => ({ data: { id: 's', url: 'javascript:alert(1)' } })]]);
    await assert.rejects(bad.createSession({ env: SECRETS, fetch: f2, reference: 'ver_b', kind: 'identity', investor: INVESTOR, settings: {} }), /did not return a usable link/);
    // Missing environment variables are named, never their values.
    await withServer({ env: { ACME_API_KEY: 'x' }, fetch: f, providers: registry(acmeid()) }, async (b2) => {
      const r = await post(`${b2}/v1/verifications`, { kind: 'identity', provider: 'acmeid', investor: INVESTOR });
      assert.equal(r.status, 400);
      assert.match((await r.json()).error, /Set ACME_WEBHOOK_SECRET on the integration server/);
    });
  });
});

test('link start: no API call, encoded placeholders, our reference as the provider ref', async () => {
  const def = { id: 'acmelink', name: 'Acme Link', checks: ['accreditation'], start: { link: 'https://accredit.acme.example/start?ref={reference}&email={investor.email}&return={returnUrl}' } };
  const f = mockFetch([]);
  await withServer({ fetch: f, providers: registry(def) }, async (base) => {
    const created = await (await post(`${base}/v1/verifications`, { kind: 'accreditation', provider: 'acmelink', investor: INVESTOR })).json();
    assert.equal(created.url, `https://accredit.acme.example/start?ref=${created.id}&email=ann%2Btest%40investor.example&return=${encodeURIComponent(`http://verify.test/return/acmelink/${created.id}`)}`);
    assert.equal(f.calls.length, 0);
    // A {investor.*} value that does not look like an id is refused in a URL.
    const bad = makeConnector({ id: 'acmelink', name: 'Acme Link', checks: ['identity'], start: { link: 'https://a.acme.example/{investor.name}' } }, {});
    await assert.rejects(bad.createSession({ env: {}, reference: 'ver_x', investor: INVESTOR, settings: {} }), (e) => e.status === 400 && /cannot be used in a URL/.test(e.message));
  });
});

test('polling: case-insensitive mapping, "*" default, unmapped statuses exposed as providerStatus', async () => {
  let reply = { data: { status: 'needs_review' } };
  const f = mockFetch([
    ['POST', 'https://api.acme.example/v1/sessions', () => ({ data: { id: 'ses_9', url: 'https://verify.acme.example/flow/ses_9' } })],
    ['GET', 'https://api.acme.example/v1/sessions/ses_9', () => reply]
  ]);
  await withServer({ env: SECRETS, fetch: f, providers: registry(acmeid()) }, async (base, server) => {
    const { id } = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'acmeid', investor: INVESTOR })).json();
    const poll = async () => {
      server.store.put('verifications', { id, checkedAt: '' });
      return getJson(`${base}/v1/verifications/${id}`);
    };
    reply = { data: { status: 'Under_Investigation' } };
    let st = await poll();
    assert.equal(st.status, 'pending', 'an unmapped value leaves the status unchanged');
    assert.equal(st.providerStatus, 'Under_Investigation');
    assert.ok(server.store.data().events.some((e) => e.type === 'unmapped_status' && e.status === 'Under_Investigation'));
    reply = { data: { status: 'APPROVED', method: 'Passport', reason: 'Document and selfie match', watchlist: { status: 'MATCH', matches: [{ query: 'Ann Marie Lee', matched_name: 'LEE, Anne Marie', list: 'Example PEP list', score: 0.93 }] } } };
    st = await poll();
    assert.equal(st.status, 'passed');
    assert.equal(st.providerStatus, '', 'a mapped value clears providerStatus');
    assert.equal(st.method, 'Passport');
    assert.equal(st.detail, 'Document and selfie match');
    assert.deepEqual(st.screening, { status: 'potential_match', hits: [{ name: 'Ann Marie Lee', listed: 'LEE, Anne Marie', list: 'Example PEP list', score: 0.93, detail: '' }] }, 'the screening run inside the identity check comes back with it');
    assert.equal(f.calls.filter((c) => c.url.endsWith('/ses_9')).length, 2);
    // Not polled again once final.
    await poll();
    assert.equal(f.calls.filter((c) => c.url.endsWith('/ses_9')).length, 2);
  });
  // "*" catches everything that is not mapped; a value that is already normalized passes through.
  const c = makeConnector(Object.assign(acmeid(), { statuses: { identity: { approved: 'passed', '*': 'review' } } }), {});
  assert.equal(c.mapStatus('identity', 'Approved'), 'passed');
  assert.equal(c.mapStatus('identity', 'FAILED'), 'failed');
  assert.equal(c.mapStatus('identity', 'whatever'), 'review');
  const d = makeConnector(acmeid(), {});
  assert.equal(d.mapStatus('identity', 'whatever'), 'whatever');
  assert.equal(d.mapStatus('aml', 'No_Match'), 'clear');
});

test('accreditation results: expiry dates normalized from ISO, date-times and epoch values', async () => {
  const def = { id: 'acmeacc', name: 'Acme Accreditation', checks: ['accreditation'], start: { link: 'https://a.acme.example/{reference}' }, result: { request: { url: 'https://api.acme.example/v/{ref}' }, response: { status: 's', expiresAt: 'e', method: 'm' } }, statuses: { accreditation: { accredited: 'verified' } } };
  const c = makeConnector(def, {});
  for (const [e, want] of [['2027-03-01', '2027-03-01'], ['2027-03-01T12:00:00Z', '2027-03-01'], [1803859200, '2027-03-01'], [1803859200000, '2027-03-01'], ['soon', undefined]]) {
    const f = mockFetch([['GET', 'https://api.acme.example/v/', () => ({ s: 'accredited', e, m: 'Net worth' })]]);
    const r = await c.fetchResult({ env: {}, fetch: f, ref: 'ver_1', kind: 'accreditation', investor: {}, settings: {} });
    assert.equal(r.status, 'verified');
    assert.equal(r.expiresAt, want);
    assert.equal(r.method, 'Net worth');
  }
});

/* ---------------- Webhooks ---------------- */

async function startAcme(base) {
  return (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'acmeid', investor: INVESTOR })).json();
}
const acmeStart = () => mockFetch([['POST', 'https://api.acme.example/v1/sessions', () => ({ data: { id: 'ses_w', url: 'https://verify.acme.example/flow/ses_w' } })]]);

test('webhook scheme 1: hex HMAC of the raw body with a prefix (valid, tampered, duplicate)', async () => {
  await withServer({ env: SECRETS, fetch: acmeStart(), providers: registry(acmeid()) }, async (base, server) => {
    const { id } = await startAcme(base);
    const raw = JSON.stringify({ id: 'evt_1', type: 'session.updated', data: { session_id: 'ses_w', status: 'declined', reason: 'Document expired' } });
    const sig = `sha256=${sign('sha256', SECRETS.ACME_WEBHOOK_SECRET, raw)}`;
    assert.equal((await post(`${base}/webhooks/acmeid`, raw.replace('declined', 'approved'), { 'X-Acme-Signature': sig })).status, 401, 'tampered body');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'X-Acme-Signature': sig.replace('sha256=', '') })).status, 401, 'missing prefix');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw)).status, 401, 'unsigned');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'X-Acme-Signature': sig.toUpperCase().replace('SHA256=', 'sha256=') })).status, 200, 'hex is compared case-insensitively');
    let st = await getJson(`${base}/v1/verifications/${id}`);
    assert.equal(st.status, 'failed');
    assert.equal(st.detail, 'Document expired');
    const dup = await (await post(`${base}/webhooks/acmeid`, raw, { 'X-Acme-Signature': sig })).json();
    assert.equal(dup.duplicate, true);
    assert.ok(server.store.data().events.some((e) => e.type === 'webhook_rejected' && e.provider === 'acmeid'));
    // The payload may name our reference instead of the provider id.
    const raw2 = JSON.stringify({ id: 'evt_2', data: { session_id: id, status: 'approved' } });
    assert.equal((await post(`${base}/webhooks/acmeid`, raw2, { 'X-Acme-Signature': `sha256=${sign('sha256', SECRETS.ACME_WEBHOOK_SECRET, raw2)}` })).status, 200);
    st = await getJson(`${base}/v1/verifications/${id}`);
    assert.equal(st.status, 'passed');
  });
  // base64 encoding with sha512 and no prefix.
  const def = Object.assign(acmeid(), { webhook: Object.assign(acmeid().webhook, { verify: { type: 'hmac', header: 'X-Sig', algorithm: 'sha512', encoding: 'base64', secret: '${env.ACME_WEBHOOK_SECRET}' } }) });
  await withServer({ env: SECRETS, fetch: acmeStart(), providers: registry(def) }, async (base) => {
    const { id } = await startAcme(base);
    const raw = JSON.stringify({ id: 'evt_b', data: { session_id: 'ses_w', status: 'needs_review' } });
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'X-Sig': sign('sha256', SECRETS.ACME_WEBHOOK_SECRET, raw, 'base64') })).status, 401, 'wrong algorithm');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'X-Sig': sign('sha512', SECRETS.ACME_WEBHOOK_SECRET, raw, 'base64') })).status, 200);
    assert.equal((await getJson(`${base}/v1/verifications/${id}`)).status, 'review');
  });
});

test('webhook scheme 2: "t=<ts>,v1=<hex>" header signing "{timestamp}.{body}", secret rotation, stale timestamps', async () => {
  const def = Object.assign(acmeid(), { webhook: Object.assign(acmeid().webhook, { verify: { type: 'hmac', header: 'Acme-Signature', pattern: 'v1=([0-9a-f]+)', timestampPattern: 't=(\\d+)', signed: '{timestamp}.{body}', secret: '${env.ACME_WEBHOOK_SECRET}', tolerance: 300 } }) });
  await withServer({ env: SECRETS, fetch: acmeStart(), providers: registry(def) }, async (base) => {
    const { id } = await startAcme(base);
    const raw = JSON.stringify({ id: 'evt_t1', data: { session_id: 'ses_w', status: 'approved' } });
    const now = Math.floor(Date.now() / 1000);
    const good = sign('sha256', SECRETS.ACME_WEBHOOK_SECRET, `${now}.${raw}`);
    const old = sign('sha256', 'previous-secret', `${now}.${raw}`);
    const stale = now - 3600;
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'Acme-Signature': `t=${stale},v1=${sign('sha256', SECRETS.ACME_WEBHOOK_SECRET, `${stale}.${raw}`)}` })).status, 401, 'stale');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'Acme-Signature': `t=${now + 1},v1=${good}` })).status, 401, 'timestamp is signed');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'Acme-Signature': `v1=${good}` })).status, 401, 'no timestamp');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'Acme-Signature': `t=${now},v1=${old}` })).status, 401, 'old secret only');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'Acme-Signature': `t=${now},v1=${old},v1=${good}` })).status, 200, 'several v1 values during rotation');
    assert.equal((await getJson(`${base}/v1/verifications/${id}`)).status, 'passed');
    assert.equal((await (await post(`${base}/webhooks/acmeid`, raw, { 'Acme-Signature': `t=${now},v1=${good}` })).json()).duplicate, true);
  });
});

test('webhook scheme 3: Standard Webhooks headers with a whsec_ base64 secret', async () => {
  const def = Object.assign(acmeid(), {
    env: ['ACME_API_KEY', 'ACME_STD_SECRET'],
    webhook: Object.assign(acmeid().webhook, { id: undefined, verify: { type: 'hmac', header: 'webhook-signature', pattern: 'v1,([A-Za-z0-9+/=]+)', encoding: 'base64', secret: '${env.ACME_STD_SECRET}', secretEncoding: 'base64', idHeader: 'webhook-id', timestampHeader: 'webhook-timestamp', signed: '{id}.{timestamp}.{body}' } })
  });
  delete def.webhook.id;
  const key = Buffer.from(SECRETS.ACME_STD_SECRET.slice(6), 'base64');
  await withServer({ env: SECRETS, fetch: acmeStart(), providers: registry(def) }, async (base) => {
    const { id } = await startAcme(base);
    const raw = JSON.stringify({ type: 'session.updated', data: { session_id: 'ses_w', status: 'approved' } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sigFor = (msgId, t, body) => createHmac('sha256', key).update(`${msgId}.${t}.${body}`).digest('base64');
    const headers = (msgId, t, sig) => ({ 'webhook-id': msgId, 'webhook-timestamp': t, 'webhook-signature': sig });
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, headers('msg_1', ts, `v1,${sigFor('msg_2', ts, raw)}`))).status, 401, 'the id is signed');
    const staleTs = String(Number(ts) - 1000);
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, headers('msg_1', staleTs, `v1,${sigFor('msg_1', staleTs, raw)}`))).status, 401, 'stale');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw + ' ', headers('msg_1', ts, `v1,${sigFor('msg_1', ts, raw)}`))).status, 401, 'exact bytes');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, headers('msg_1', ts, `v1,AAAA v1,${sigFor('msg_1', ts, raw)}`))).status, 200, 'space-separated list');
    assert.equal((await getJson(`${base}/v1/verifications/${id}`)).status, 'passed');
    const dup = await (await post(`${base}/webhooks/acmeid`, raw, headers('msg_1', ts, `v1,${sigFor('msg_1', ts, raw)}`))).json();
    assert.equal(dup.duplicate, true, 'de-duplicated by webhook-id');
  });
});

test('webhook scheme 4: the algorithm named in another header', async () => {
  const def = Object.assign(acmeid(), { env: ['ACME_API_KEY', 'ACME_ALG_SECRET'], webhook: Object.assign(acmeid().webhook, { verify: { type: 'hmac', header: 'X-Signature', algorithmHeader: 'X-Signature-Algorithm', secret: '${env.ACME_ALG_SECRET}' } }) });
  await withServer({ env: SECRETS, fetch: acmeStart(), providers: registry(def) }, async (base) => {
    const { id } = await startAcme(base);
    const raw = JSON.stringify({ id: 'evt_a1', data: { session_id: 'ses_w', status: 'approved' } });
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'X-Signature': createHmac('md5', SECRETS.ACME_ALG_SECRET).update(raw).digest('hex'), 'X-Signature-Algorithm': 'md5' })).status, 401, 'unsupported algorithms are refused');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'X-Signature': sign('sha512', SECRETS.ACME_ALG_SECRET, raw), 'X-Signature-Algorithm': 'sha256' })).status, 401, 'algorithm mismatch');
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'X-Signature': sign('sha512', SECRETS.ACME_ALG_SECRET, raw), 'X-Signature-Algorithm': 'HMAC-SHA512' })).status, 200);
    assert.equal((await getJson(`${base}/v1/verifications/${id}`)).status, 'passed');
  });
});

test('webhook scheme 5: a secret token in the URL never trusts the payload and re-reads the result', async () => {
  const def = Object.assign(acmeid(), { env: ['ACME_API_KEY', 'ACME_TOKEN'], webhook: { verify: { type: 'token', param: 'token', secret: '${env.ACME_TOKEN}' }, ref: 'session', status: 'status' } });
  const f = mockFetch([
    ['POST', 'https://api.acme.example/v1/sessions', () => ({ data: { id: 'ses_t', url: 'https://verify.acme.example/flow/ses_t' } })],
    ['GET', 'https://api.acme.example/v1/sessions/ses_t', () => ({ data: { status: 'declined', reason: 'From the API' } })]
  ]);
  await withServer({ env: SECRETS, fetch: f, providers: registry(def) }, async (base) => {
    const { id } = await startAcme(base);
    const raw = JSON.stringify({ session: 'ses_t', status: 'approved' });
    assert.equal((await post(`${base}/webhooks/acmeid`, raw)).status, 401);
    assert.equal((await post(`${base}/webhooks/acmeid?token=wrong`, raw)).status, 401);
    assert.equal((await post(`${base}/webhooks/acmeid?token=${SECRETS.ACME_TOKEN}`, raw)).status, 200);
    const st = await getJson(`${base}/v1/verifications/${id}`);
    assert.equal(st.status, 'failed', 'the result came from the API, not the payload');
    assert.equal(st.detail, 'From the API');
  });
});

/* ---------------- Screening ---------------- */

test('screening: synchronous hits, asynchronous results and monitoring webhooks', async () => {
  let async = false;
  let later = { status: 'processing' };
  const f = mockFetch([
    ['POST', 'https://api.acme.example/v1/screenings', (c) => (async ? { id: 'scr_p_2', status: 'processing' } : { id: 'scr_p_1', status: 'match', matches: c.body.names.filter((n) => n.includes('Volkov')).map((n) => ({ query: n, matched_name: 'VOLKOV, Dmitri', list: 'Example sanctions list', score: '0.97', notes: 'DOB 1970' })) })],
    ['GET', 'https://api.acme.example/v1/screenings/scr_p_2', () => later]
  ]);
  await withServer({ env: SECRETS, fetch: f, providers: registry(acmeid()) }, async (base, server) => {
    const r = await (await post(`${base}/v1/screenings`, { provider: 'acmeid', investor: { id: 'INV-7' }, names: ['Dmitry Volkov', 'Ann Lee'] })).json();
    assert.equal(r.status, 'potential_match');
    assert.deepEqual(r.hits, [{ name: 'Dmitry Volkov', listed: 'VOLKOV, Dmitri', list: 'Example sanctions list', score: 0.97, detail: 'DOB 1970' }]);
    assert.deepEqual(f.calls[0].body, { names: ['Dmitry Volkov', 'Ann Lee'], reference: r.id }, '{names} is sent as an array');
    assert.equal((await getJson(`${base}/v1/screenings/${r.id}`)).monitoring, true);
    async = true;
    const p = await (await post(`${base}/v1/screenings`, { provider: 'acmeid', names: ['Ann Lee'] })).json();
    assert.equal(p.status, 'pending');
    server.store.put('screenings', { id: p.id, checkedAt: '' });
    assert.equal((await getJson(`${base}/v1/screenings/${p.id}`)).status, 'pending');
    later = { status: 'no_match', matches: [] };
    server.store.put('screenings', { id: p.id, checkedAt: '' });
    const done = await getJson(`${base}/v1/screenings/${p.id}`);
    assert.equal(done.status, 'clear');
    // Ongoing monitoring: a signed alert turns a clear screening into a potential match.
    const raw = JSON.stringify({ id: 'evt_m1', type: 'monitoring.alert', data: { session_id: 'scr_p_2', status: 'match', matches: [{ query: 'Ann Lee', matched_name: 'LEE, Ann', list: 'Example PEP list', score: 0.91 }] } });
    assert.equal((await post(`${base}/webhooks/acmeid`, raw, { 'X-Acme-Signature': `sha256=${sign('sha256', SECRETS.ACME_WEBHOOK_SECRET, raw)}` })).status, 200);
    const alert = await getJson(`${base}/v1/screenings/${p.id}`);
    assert.equal(alert.status, 'potential_match');
    assert.equal(alert.hits[0].listed, 'LEE, Ann');
    // A status-only alert keeps the hits on record; an unmapped status is shown, not applied.
    const def2 = Object.assign(acmeid(), { webhook: Object.assign(acmeid().webhook, { hits: undefined }) });
    delete def2.webhook.hits;
    const raw3 = JSON.stringify({ id: 'evt_m3', data: { session_id: 'scr_p_2', status: 'escalated', matches: [] } });
    assert.equal((await post(`${base}/webhooks/acmeid`, raw3, { 'X-Acme-Signature': `sha256=${sign('sha256', SECRETS.ACME_WEBHOOK_SECRET, raw3)}` })).status, 200);
    const un = await getJson(`${base}/v1/screenings/${p.id}`);
    assert.equal(un.status, 'potential_match', 'an unmapped status is not applied');
    assert.equal(un.providerStatus, 'escalated');
    assert.equal(un.hits.length, 1, 'and neither are the hits that came with it');
    const c = makeConnector(def2, {});
    const kept = c.webhookResult('aml', c.parseWebhook({ body: { data: { session_id: 'x', status: 'match' } }, headers: {} }));
    assert.deepEqual(kept, { status: 'potential_match' }, 'no hits key, so the stored hits stay');
  });
});

/* ---------------- Secrets ---------------- */

test('secrets never appear in responses, error messages or the connector list', async () => {
  const f = mockFetch([['POST', 'https://api.acme.example/v1/sessions', (c) => ({ status: 401, body: { error: { message: `Invalid key ${c.headers.Authorization.slice(7)} for this account` } } })]]);
  await withServer({ env: Object.assign({ ACME_ENDPOINT_NOTE: 'x' }, SECRETS), fetch: f, providers: registry(acmeid()) }, async (base) => {
    const res = await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'acmeid', investor: INVESTOR });
    const text = await res.text();
    assert.equal(res.status, 502);
    assert.match(text, /Acme Verify answered 401: Invalid key \[redacted\] for this account/);
    assert.ok(!text.includes(SECRETS.ACME_API_KEY));
    const list = await (await fetch(`${base}/v1/connectors`)).text();
    for (const v of Object.values(SECRETS)) assert.ok(!list.includes(v), 'no secret values');
    assert.ok(!/acme\.example|Bearer|X-Acme|https?:/.test(list), 'no URLs or headers');
    const acme = JSON.parse(list).connectors.find((c) => c.id === 'acmeid');
    assert.deepEqual(acme, { id: 'acmeid', name: 'Acme Verify', description: 'Government ID and selfie check.', checks: ['identity', 'aml'], start: 'api', builtin: false, configured: true, missing: [] });
  });
  await withServer({ env: { API_TOKEN: 'tok-portal' }, providers: registry(acmeid()) }, async (base) => {
    assert.equal((await fetch(`${base}/v1/connectors`)).status, 401, 'behind the API token');
    const r = await getJson(`${base}/v1/connectors`, { Authorization: 'Bearer tok-portal' });
    const acme = r.connectors.find((c) => c.id === 'acmeid');
    assert.equal(acme.configured, false);
    assert.deepEqual(acme.missing, ['ACME_API_KEY', 'ACME_WEBHOOK_SECRET']);
    const ids = r.connectors.map((c) => [c.id, c.start, c.builtin]);
    assert.deepEqual(ids.slice(0, 3), [['sandbox', 'simulated', true], ['link', 'portal-link', true], ['ofac', 'none', true]]);
  });
  const d = describe({}, registry(acmeid()));
  assert.ok(d.every((c) => Object.keys(c).sort().join() === 'builtin,checks,configured,description,id,missing,name,start'));
});

/* ---------------- Code plug-ins ---------------- */

test('code plug-ins load from a folder, skipping "_" and "." files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'plugins-'));
  try {
    writeFileSync(
      join(dir, 'acmeplug.mjs'),
      `export const name = 'Acme Plug';
export const kinds = ['accreditation'];
export const env = ['ACME_API_KEY'];
export async function createSession(ctx) {
  const r = await ctx.fetch('https://api.acme.example/plug', { method: 'POST', headers: { 'X-Key': ctx.env.ACME_API_KEY }, body: JSON.stringify({ ref: ctx.reference }) });
  const data = JSON.parse(await r.text());
  return { ref: data.id, url: data.url, data: { privateToken: 'plug-private-1' } };
}
export async function fetchResult() { return { status: 'verified', expiresAt: '2027-05-01' }; }
`
    );
    writeFileSync(join(dir, '_draft.mjs'), 'throw new Error("must not load");');
    writeFileSync(join(dir, '.hidden.mjs'), 'throw new Error("must not load");');
    writeFileSync(join(dir, 'notes.txt'), 'ignored');
    const none = join(dir, 'connectors.json');
    writeFileSync(none, '{ "connectors": [] }');
    const providers = await loadProviders({ env: {}, connectorsFile: none, pluginsDir: dir }).catch((e) => e);
    assert.ok(!(providers instanceof Error), String(providers && providers.message));
    assert.ok(providers.acmeplug && !providers._draft);
    const f = mockFetch([['POST', 'https://api.acme.example/plug', () => ({ id: 'pl_1', url: 'https://plug.acme.example/go' })]]);
    await withServer({ env: { ACME_API_KEY: 'plug-key-1' }, fetch: f, providers }, async (base) => {
      const r = await (await post(`${base}/v1/verifications`, { kind: 'accreditation', provider: 'acmeplug', investor: INVESTOR })).json();
      assert.equal(r.url, 'https://plug.acme.example/go');
      assert.equal(f.calls[0].headers['X-Key'], 'plug-key-1');
      const st = await (await fetch(`${base}/v1/verifications/${r.id}`)).text();
      assert.match(st, /"status":"verified"/);
      assert.ok(!st.includes('plug-private-1'));
      const list = await getJson(`${base}/v1/connectors`);
      assert.deepEqual(list.connectors.find((c) => c.id === 'acmeplug'), { id: 'acmeplug', name: 'Acme Plug', description: '', checks: ['accreditation'], start: 'api', builtin: false, configured: true, missing: [] });
    });
    // A broken plug-in stops startup with its file named.
    const bad = join(dir, 'bad');
    mkdirSync(bad);
    writeFileSync(join(bad, 'acmebroken.mjs'), "export const kind = 'identity';");
    writeFileSync(join(bad, 'Bad-Name.mjs'), "export const kind = 'aml'; export const screen = async () => ({ hits: [] });");
    writeFileSync(join(bad, 'sandbox.mjs'), "export const kind = 'aml'; export const screen = async () => ({ hits: [] });");
    await assert.rejects(loadProviders({ env: {}, connectorsFile: none, pluginsDir: bad }), (e) => {
      assert.match(e.message, /Plug-in acmebroken\.mjs: createSession\(ctx\) is required/);
      assert.match(e.message, /Plug-in Bad-Name\.mjs: its id "Bad-Name" must be/);
      assert.match(e.message, /Plug-in sandbox\.mjs: the id "sandbox" is already used by a built-in provider/);
      return true;
    });
    // The template that ships in plugins/ is skipped by the default loader.
    assert.ok(!Object.keys(PROVIDERS).includes('_template') && !Object.keys(PROVIDERS).includes('template'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------------- The built-in link provider ---------------- */

test('link provider: fills a sponsor-entered https link without fetching it, refuses anything else', async () => {
  const f = mockFetch([]);
  await withServer({ fetch: f, env: { ACME_API_KEY: 'never-leaks-1' } }, async (base) => {
    const start = (link, kind = 'identity') => post(`${base}/v1/verifications`, { kind, provider: 'link', settings: { link }, investor: INVESTOR, returnUrl: 'https://portal.example/diy.html' });
    const ok = await (await start('https://verify.acme.example/start?ref={reference}&name={investor.name}&email={investor.email}&back={returnUrl}')).json();
    assert.match(ok.id, /^ver_/);
    assert.equal(ok.url, `https://verify.acme.example/start?ref=${ok.id}&name=Ann%20Marie%20Lee&email=ann%2Btest%40investor.example&back=${encodeURIComponent(`http://verify.test/return/link/${ok.id}`)}`);
    assert.equal(f.calls.length, 0, 'the link is never fetched');
    assert.equal((await getJson(`${base}/v1/verifications/${ok.id}`)).status, 'pending');
    assert.equal((await start('https://accredit.acme.example/a/{investor.id}', 'accreditation')).status, 200);
    const refused = async (link, re) => {
      const r = await start(link);
      assert.equal(r.status, 400, link);
      assert.match((await r.json()).error, re);
    };
    await refused('', /Add the provider's link/);
    await refused('http://verify.acme.example/start', /must start with https/);
    await refused('javascript:alert(1)', /must start with https/);
    await refused('https://{investor.email}/x', /spell out its scheme, host and port/);
    await refused('https://verify.acme.example/x?k=${env.ACME_API_KEY}', /cannot use \$\{env\.ACME_API_KEY\}/);
    await refused('https://verify.acme.example/x?w={webhookUrl}', /cannot use \{webhookUrl\}/);
    await refused('http://localhost:9000/x', /only allowed for local tests/);
    // The investor comes back to the server and is linked back to the portal.
    const back = await (await fetch(`${base}/return/link/${ok.id}`)).text();
    assert.match(back, /https:\/\/portal\.example\/diy\.html/);
  });
  await withServer({ fetch: f, env: { ALLOW_HTTP_CONNECTORS: '1' } }, async (base) => {
    const r = await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'link', settings: { link: 'http://localhost:9000/x/{reference}' }, investor: INVESTOR });
    assert.equal(r.status, 200);
  });
});
