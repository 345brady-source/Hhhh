// The identity and screening plug-in (plugins/idcheck.mjs) through the real server, against recorded
// replies and an injected fetch. No provider is called here and no key exists: every reply shape is
// documentation quoted by search (each fixture names its source and says unconfirmed). Plan 08-12
// proves the shapes against the live service before anything is called working.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadProviders } from '../providers/index.mjs';
import { withServer, post, getJson, mockFetch } from './helpers.mjs';

const DIR = fileURLToPath(new URL('./fixtures/idcheck/', import.meta.url));
const fixture = (n) => JSON.parse(readFileSync(`${DIR}${n}.json`, 'utf8'));
const reply = (n, patch) => Object.assign(structuredClone(fixture(n).reply), patch);
// The provider's web domain and name, read from a fixture's source line so this file holds neither.
const DOMAIN = new URL(fixture('session-created')._source).hostname.split('.').slice(-2).join('.');
const VENDOR = DOMAIN.split('.')[0];

const ENV = { IDCHECK_API_KEY: 'key-test-0123456789', IDCHECK_WORKFLOW: 'wf-test-1', IDCHECK_WEBHOOK_SECRET: 'whk-test-secret-abcdef' };
const INVESTOR = { id: 'INV-7', name: 'Ann Marie Lee', email: 'ann+test@investor.example', workspace: 'w1' };
const SESSION = fixture('session-created').reply.session_id;
// The real plug-in from the default plug-ins folder, as every server loads it.
const providers = await loadProviders({ env: {} });

const SESSIONS = /\/v3\/session\/$/;
const DECISION = /\/v3\/session\/[^/]+\/decision\/$/;
const sign = (data, secret = ENV.IDCHECK_WEBHOOK_SECRET) => createHmac('sha256', secret).update(data).digest('hex');
const seconds = () => Math.floor(Date.now() / 1000);
/** A session delivery: the exact bytes signed in the first signature header; its timestamp is inside those bytes. */
const sessionHook = (base, body, headers) => {
  const raw = JSON.stringify(body);
  return post(`${base}/webhooks/idcheck`, raw, Object.assign({ 'X-Signature': sign(raw), 'X-Timestamp': String(body.timestamp) }, headers));
};
const start = async (base) => (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'idcheck', investor: INVESTOR })).json();

test('tracer: a session starts, a signed status delivery arrives, the decision is re-read and the check reads passed', async () => {
  const f = mockFetch([
    ['POST', SESSIONS, () => ({ status: 201, body: reply('session-created') })],
    ['GET', DECISION, () => reply('decision-approved')]
  ]);
  await withServer({ env: ENV, fetch: f, providers }, async (base) => {
    const r = await start(base);
    assert.equal(f.calls.length, 1, 'exactly one provider call starts a session');
    const c = f.calls[0];
    const u = new URL(c.url);
    assert.equal(c.method, 'POST');
    assert.equal(u.protocol, 'https:');
    assert.ok(u.hostname.endsWith(`.${DOMAIN}`), 'the documented API host');
    assert.equal(u.pathname, '/v3/session/');
    assert.equal(c.headers['x-api-key'], ENV.IDCHECK_API_KEY);
    assert.equal(c.redirect, 'manual');
    assert.deepEqual(c.body, { workflow_id: ENV.IDCHECK_WORKFLOW, vendor_data: r.id, callback: `http://verify.test/return/idcheck/${r.id}` });
    assert.match(r.id, /^ver_/);
    assert.equal(r.status, 'pending');
    assert.equal(r.url, fixture('session-created').reply.url, 'the investor is sent to the page the provider answered');

    const hook = await sessionHook(base, reply('webhook-status-updated', { timestamp: seconds(), vendor_data: r.id }));
    assert.equal(hook.status, 200);
    assert.deepEqual(await hook.json(), { received: true });
    const reads = f.calls.filter((x) => x.method === 'GET');
    assert.equal(reads.length, 1, 'the delivery is not trusted: the decision is read once from the provider');
    assert.equal(new URL(reads[0].url).pathname, `/v3/session/${SESSION}/decision/`);
    assert.equal(reads[0].headers['x-api-key'], ENV.IDCHECK_API_KEY);

    const st = await getJson(`${base}/v1/verifications/${r.id}`);
    assert.equal(st.status, 'passed');
    assert.deepEqual(st.screening, { status: 'clear', hits: [] });
    assert.equal(st.providerStatus, '');
    assert.equal(f.calls.length, 2, 'a finished check is not read again');
  });
});
