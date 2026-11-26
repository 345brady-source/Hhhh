// Plan 08-08 (D-04): GET /v1/checks/changed, the console's way to learn that a check changed after it last asked (a
// monitoring alert that holds a cleared screening, an identity check moved to review). Through the real server with the
// real identity check plug-in, against the recorded replies in test/fixtures/idcheck (each marked unconfirmed there) and an
// injected fetch: no provider is called and no key exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadProviders } from '../providers/index.mjs';
import { withServer, post, mockFetch } from './helpers.mjs';

const DIR = fileURLToPath(new URL('./fixtures/idcheck/', import.meta.url));
const reply = (n, patch) => Object.assign(structuredClone(JSON.parse(readFileSync(`${DIR}${n}.json`, 'utf8')).reply), patch);

const ENV = { IDCHECK_API_KEY: 'key-test-0123456789', IDCHECK_WORKFLOW: 'wf-test-1', IDCHECK_WEBHOOK_SECRET: 'whk-test-secret-abcdef' };
const providers = await loadProviders({ env: {} });
const AML = /\/v3\/aml\/$/;
const SESSIONS = /\/v3\/session\/$/;
const DECISION = /\/v3\/session\/[^/]+\/decision\/$/;
const sign = (data) => createHmac('sha256', ENV.IDCHECK_WEBHOOK_SECRET).update(data).digest('hex');
const seconds = () => Math.floor(Date.now() / 1000);
let serial = 0;
/** A monitoring alert, signed as server/test/idcheck.test.mjs signs one: "<timestamp header>.<raw body>" in the second header. */
const alertHook = (base, body) => {
  const raw = JSON.stringify(body);
  const ts = seconds();
  return post(`${base}/webhooks/idcheck`, raw, { 'X-Timestamp': String(ts), 'X-Signature-V2': sign(`${ts}.${raw}`) });
};
const newHit = (patch) => reply('webhook-new-hit', Object.assign({ event_id: `evt-changed-${++serial}`, timestamp: seconds() }, patch));
/** A clock the test moves by hand: every changedAt the server writes reads it. */
function clock(start) {
  let t = Date.parse(start);
  const now = () => t;
  now.add = (ms) => (t += ms);
  now.iso = (d = 0) => new Date(t + d).toISOString();
  return now;
}
const changed = async (base, since, query = '', headers = {}) => {
  const res = await fetch(`${base}/v1/checks/changed?since=${encodeURIComponent(since)}${query}`, { headers });
  return { status: res.status, body: await res.json() };
};

test('changed tracer: a signed monitoring alert on a clear screening is listed once, after the time asked from, with its hits and monitoring', async () => {
  const f = mockFetch([['POST', AML, () => reply('aml-clear')]]);
  const now = clock('2026-11-02T10:00:00.000Z');
  await withServer({ env: ENV, fetch: f, providers, now }, async (base) => {
    const s = await (await post(`${base}/v1/screenings`, { provider: 'idcheck', investor: { id: 'INV-7', workspace: 'w1' }, names: ['Ann Marie Lee'] })).json();
    assert.equal(s.status, 'clear');
    now.add(60000);
    const before = now.iso();
    now.add(60000);
    const hit = { match_score: 93, risk_score: 75, caption: 'LEE, Anne Marie' };
    assert.equal((await alertHook(base, newHit({ vendor_data: s.id, decision: { aml_screenings: [{ status: 'In Review', hits: [hit] }] } }))).status, 200);
    const at = now.iso();
    now.add(60000);

    const r = await changed(base, before, '&workspace=w1');
    assert.equal(r.status, 200);
    assert.equal(r.body.checks.length, 1, 'the one record that changed after the time asked from');
    const c = r.body.checks[0];
    assert.equal(c.id, s.id);
    assert.equal(c.table, 'screenings');
    assert.equal(c.investorId, 'INV-7');
    assert.equal(c.kind, 'aml');
    assert.equal(c.status, 'potential_match');
    assert.deepEqual(c.hits, [{ list: '', listed: 'LEE, Anne Marie', score: 0.93, detail: 'Risk score 75' }]);
    assert.equal(c.monitoring, true, 'the screening was enrolled in monitoring');
    assert.equal(c.changedAt, at, 'changedAt is the server\'s time of the alert');
    assert.ok(typeof r.body.now === 'string' && r.body.now > at, 'the time to ask from next');

    const later = await changed(base, r.body.now, '&workspace=w1');
    assert.equal(later.status, 200);
    assert.deepEqual(later.body.checks, [], 'asked from after the alert: nothing');
  });
});
