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
const BEGIN = '1970-01-01T00:00:00.000Z';
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

/* ---------- Task 2: who may ask, what is listed, privacy, the screening reply, identity checks ---------- */
const SHARED = 'shared-test-token-0123456789';
const ADMIN = 'admin-test-token-0123456789';
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const account = async (base, workspace) => (await post(`${base}/v1/admin/accounts`, { workspace, name: `${workspace} capital` }, bearer(ADMIN))).json();
const screen = async (base, workspace, names, token = SHARED) => (await post(`${base}/v1/screenings`, { provider: 'idcheck', investor: { id: `INV-${workspace}`, workspace }, names }, bearer(token))).json();

test('changed who: an account lists only its own workspace whatever the query says, the shared token must name one, an invitation token is refused', async () => {
  const f = mockFetch([['POST', AML, () => reply('aml-clear')]]);
  await withServer({ env: Object.assign({ API_TOKEN: SHARED, ADMIN_TOKEN: ADMIN }, ENV), fetch: f, providers }, async (base, server) => {
    const alpha = await account(base, 'alpha');
    const beta = await account(base, 'beta');
    assert.ok(alpha.token && beta.token);
    // The package provider is the operator's (shared token); each record is stored in the workspace it names.
    const a = await screen(base, 'alpha', ['Ann Marie Lee']);
    const b = await screen(base, 'beta', ['Bo Lindqvist']);
    assert.equal(server.store.get('screenings', a.id).workspace, 'alpha');
    assert.equal(server.store.get('screenings', b.id).workspace, 'beta');
    const ids = (r) => r.body.checks.map((c) => c.id);
    for (const q of ['', '&workspace=beta', '&workspace=']) {
      const mine = await changed(base, BEGIN, q, bearer(alpha.token));
      assert.equal(mine.status, 200, q);
      assert.deepEqual(ids(mine), [a.id], `alpha's token${q}: alpha's record only`);
      const theirs = await changed(base, BEGIN, q.replace('beta', 'alpha'), bearer(beta.token));
      assert.deepEqual(ids(theirs), [b.id], `beta's token: beta's record only`);
    }
    const none = await changed(base, BEGIN, '', bearer(SHARED));
    assert.equal(none.status, 400, 'the shared token without a workspace');
    assert.equal(none.body.error, 'workspace is required');
    assert.deepEqual(ids(await changed(base, BEGIN, '&workspace=beta', bearer(SHARED))), [b.id], 'the shared token lists the workspace it names');
    assert.deepEqual(ids(await changed(base, BEGIN, '&workspace=gamma', bearer(SHARED))), []);
    // An invitation's token is not an investor's path here; a wrong token and no token are refused too.
    assert.equal((await changed(base, BEGIN, '&workspace=alpha', { 'X-Invite-Token': 'any-invitation-token' })).status, 401);
    assert.equal((await changed(base, BEGIN, '&workspace=alpha', bearer('not-a-token'))).status, 401);
    assert.equal((await changed(base, BEGIN, '&workspace=alpha')).status, 401);
    // Whatever shape the sponsor's authorization takes, a workspace it carries is the one listed (a signed-in session too).
    const { changedChecks } = await import('../lib/changed.mjs');
    const url = new URL(`http://verify.test/v1/checks/changed?since=${BEGIN}&workspace=beta`);
    const [st, body] = changedChecks(server.store, url, { account: { id: 'acct_x', workspace: 'alpha' }, session: 'ses_x', person: 'per_x', role: 'admin', via: 'session' });
    assert.equal(st, 200);
    assert.deepEqual(body.checks.map((c) => c.id), [a.id], 'a session carrying an account lists its workspace, not the query\'s');
    assert.equal(changedChecks(server.store, url, null)[0], 401);
    assert.equal((await changed(base, 'yesterday', '&workspace=alpha', bearer(SHARED))).status, 400, 'a since that is not a time');
  });
});

test('changed rules: pending records are not listed, 501 changes come 500 at a time oldest first, a second new hit is listed again, a repeat is not', async () => {
  const f = mockFetch([
    ['POST', SESSIONS, () => ({ status: 201, body: reply('session-created') })],
    ['POST', AML, () => reply('aml-clear')]
  ]);
  const now = clock('2026-11-03T09:00:00.000Z');
  await withServer({ env: ENV, fetch: f, providers, now }, async (base, server) => {
    // A pending identity check: never listed.
    const v = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'idcheck', investor: { id: 'INV-1', name: 'Ann Marie Lee', workspace: 'w1' } })).json();
    assert.equal(v.status, 'pending');
    assert.equal(server.store.get('verifications', v.id).status, 'pending');
    assert.deepEqual((await changed(base, BEGIN, '&workspace=w1')).body.checks, [], 'a pending check is not listed');
    server.store.put('verifications', { id: v.id, changedAt: now.iso() }); // even with a changedAt of its own
    assert.deepEqual((await changed(base, BEGIN, '&workspace=w1')).body.checks, [], 'a pending check is not listed, whatever its changedAt');

    // 501 changed records, written in no order: the oldest 500 first, then the rest from the time given back.
    const t0 = Date.parse('2026-10-01T00:00:00.000Z');
    const order = Array.from({ length: 501 }, (_, i) => i).sort((x, y) => ((x * 7919) % 501) - ((y * 7919) % 501));
    for (const i of order) server.store.put('screenings', { id: `scr_many${String(i).padStart(3, '0')}`, kind: 'aml', provider: 'idcheck', investorId: `INV-${i}`, workspace: 'w9', status: 'clear', hits: [], changedAt: new Date(t0 + i * 1000).toISOString() });
    const first = await changed(base, BEGIN, '&workspace=w9');
    assert.equal(first.body.checks.length, 500, 'cut at 500');
    assert.deepEqual(first.body.checks.map((c) => c.id), Array.from({ length: 500 }, (_, i) => `scr_many${String(i).padStart(3, '0')}`), 'the oldest 500, oldest first');
    const rest = await changed(base, first.body.now, '&workspace=w9');
    assert.ok(rest.body.checks.map((c) => c.id).includes('scr_many500'), 'the 501st comes with the next call');
    assert.ok(rest.body.checks.length <= 2, 'and nothing older than the last one listed');

    // A cleared screening, then a new hit, then a second new hit: listed each time; the same result again moves nothing.
    const s = await (await post(`${base}/v1/screenings`, { provider: 'idcheck', investor: { id: 'INV-2', workspace: 'w1' }, names: ['Bo Lindqvist'] })).json();
    now.add(1000);
    let since = (await changed(base, BEGIN, '&workspace=w1')).body.now;
    const hitA = { match_score: 91, risk_score: 60, caption: 'LINDQVIST, Bo' };
    const hitB = { match_score: 95, risk_score: 80, caption: 'LINDQVIST, Bo Erik' };
    const alertWith = (hits) => newHit({ vendor_data: s.id, decision: { aml_screenings: [{ status: 'In Review', hits }] } });
    assert.equal((await alertHook(base, alertWith([hitA]))).status, 200);
    const firstHit = server.store.get('screenings', s.id).changedAt;
    now.add(1000);
    let r = await changed(base, since, '&workspace=w1');
    assert.deepEqual(r.body.checks.map((c) => [c.id, c.status, c.hits.length]), [[s.id, 'potential_match', 1]]);
    since = r.body.now;
    assert.deepEqual((await changed(base, since, '&workspace=w1')).body.checks, [], 'nothing new');
    assert.equal((await alertHook(base, alertWith([hitA, hitB]))).status, 200);
    const secondHit = server.store.get('screenings', s.id).changedAt;
    assert.ok(secondHit > firstHit, 'a second new hit on a record already potential_match moves changedAt');
    now.add(1000);
    r = await changed(base, since, '&workspace=w1');
    assert.deepEqual(r.body.checks.map((c) => [c.id, c.status, c.hits.map((h) => h.listed)]), [[s.id, 'potential_match', ['LINDQVIST, Bo', 'LINDQVIST, Bo Erik']]], 'listed again with both hits');
    since = r.body.now;
    // The same result delivered again (a new delivery id, the same hits): changedAt stays, nothing is listed.
    assert.equal((await alertHook(base, alertWith([hitA, hitB]))).status, 200);
    assert.equal(server.store.get('screenings', s.id).changedAt, secondHit, 'the same result twice does not move changedAt');
    now.add(1000);
    assert.deepEqual((await changed(base, since, '&workspace=w1')).body.checks, []);
  });
});

test('changed private: no investor name, email, address, phone or screened name in the reply', async () => {
  const ofac = await import('../providers/ofac.mjs');
  ofac._setList([{ ent: '30001', name: 'LEE, Ann Marie', type: 'individual', program: 'SDGT', remarks: 'DOB 02 Feb 1971', names: ['LEE, Ann Marie'], list: 'OFAC SDN' }]);
  const f = mockFetch([
    ['POST', SESSIONS, () => ({ status: 201, body: reply('session-created') })],
    ['GET', DECISION, () => reply('decision-in-review')],
    ['POST', AML, () => reply('aml-hit')]
  ]);
  const PERSON = { id: 'INV-9', workspace: 'w1', name: 'Ann Marie Lee', email: 'ann.lee@investor.example', address: '41 Quillon Street, Portland, OR 97201', phone: '(503) 555-0188', account: 'Lee Family Trust', type: 'trust' };
  try {
    await withServer({ env: ENV, fetch: f, providers }, async (base) => {
      const o = await (await post(`${base}/v1/screenings`, { provider: 'ofac', investor: PERSON, names: ['Ann Marie Lee', 'Lee Family Trust'] })).json();
      assert.equal(o.status, 'potential_match');
      assert.ok(o.hits.some((h) => h.name === 'Ann Marie Lee'), 'the screening reply itself names the name screened');
      const d = await (await post(`${base}/v1/screenings`, { provider: 'idcheck', investor: PERSON, names: ['Ann Marie Lee', 'Lee Family Trust'] })).json();
      assert.equal(d.status, 'potential_match');
      assert.ok(d.hits.some((h) => h.name === 'Ann Marie Lee'));
      const v = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'idcheck', investor: PERSON })).json();
      await fetch(`${base}/v1/verifications/${v.id}`); // read back: the decision moves it to review
      const r = await changed(base, BEGIN, '&workspace=w1');
      assert.equal(r.body.checks.length, 3, 'both screenings and the identity check');
      const text = JSON.stringify(r.body);
      for (const x of ['Ann Marie Lee', 'Lee Family Trust', PERSON.email, 'investor.example', PERSON.address, 'Quillon', PERSON.phone, '555-0188']) assert.ok(!text.includes(x), `the reply holds no "${x}"`);
      for (const c of r.body.checks) {
        assert.deepEqual(Object.keys(c).sort(), ['changedAt', 'hits', 'id', 'investorId', 'kind', 'monitoring', 'screening', 'status', 'table']);
        for (const h of c.hits.concat((c.screening && c.screening.hits) || [])) assert.deepEqual(Object.keys(h).sort(), ['detail', 'list', 'listed', 'score']);
      }
      assert.ok(r.body.checks.some((c) => c.hits.some((h) => h.listed === 'LEE, Ann Marie')), 'the name as the list holds it is kept for the reviewer');
    });
  } finally {
    ofac._setList(null);
  }
});

test('changed reply: POST /v1/screenings answers monitoring true for a monitored screening and false otherwise', async () => {
  const ofac = await import('../providers/ofac.mjs');
  ofac._setList([{ ent: '1', name: 'OCEANIC TRADING LLC', type: 'entity', program: 'SDGT', remarks: '', names: ['OCEANIC TRADING LLC'], list: 'OFAC SDN' }]);
  const f = mockFetch([['POST', AML, () => reply('aml-clear')]]);
  try {
    await withServer({ env: ENV, fetch: f, providers }, async (base) => {
      const d = await (await post(`${base}/v1/screenings`, { provider: 'idcheck', investor: { id: 'INV-3', workspace: 'w1' }, names: ['Cora Abernathy'] })).json();
      assert.deepEqual([d.status, d.monitoring, d.screened], ['clear', true, 1], 'the identity check provider enrolls every name it screens');
      const o = await (await post(`${base}/v1/screenings`, { provider: 'ofac', investor: { id: 'INV-3', workspace: 'w1' }, names: ['Cora Abernathy'] })).json();
      assert.deepEqual([o.status, o.monitoring, o.screened], ['clear', false, 1], 'the free Treasury lists monitor nobody');
      assert.deepEqual(Object.keys(o).sort(), ['hits', 'id', 'monitoring', 'screened', 'status']);
    });
  } finally {
    ofac._setList(null);
  }
});

test('changed verifications: an identity check moved to review by an alert is listed with table verifications and its screening', async () => {
  const f = mockFetch([
    ['POST', SESSIONS, () => ({ status: 201, body: reply('session-created') })],
    ['GET', DECISION, () => reply('decision-approved')]
  ]);
  const now = clock('2026-11-04T08:00:00.000Z');
  await withServer({ env: ENV, fetch: f, providers, now }, async (base) => {
    const v = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'idcheck', investor: { id: 'INV-4', name: 'Cora Abernathy', workspace: 'w1' } })).json();
    assert.equal((await (await fetch(`${base}/v1/verifications/${v.id}`)).json()).status, 'passed');
    now.add(1000);
    const since = (await changed(base, BEGIN, '&workspace=w1')).body.now;
    // The alert names the provider's session (no reference of ours), as a monitoring alert on an identity check can.
    const body = newHit({ decision: { aml_screenings: [{ status: 'In Review', hits: [{ match_score: 90, risk_score: 70, caption: 'ABERNATHY, Cora' }] }] } });
    delete body.vendor_data;
    assert.equal((await alertHook(base, body)).status, 200);
    now.add(1000);
    const r = await changed(base, since, '&workspace=w1');
    assert.equal(r.status, 200);
    assert.equal(r.body.checks.length, 1);
    const c = r.body.checks[0];
    assert.deepEqual([c.id, c.table, c.kind, c.investorId, c.status, c.monitoring], [v.id, 'verifications', 'identity', 'INV-4', 'review', false]);
    assert.deepEqual(c.screening, { status: 'potential_match', hits: [{ list: '', listed: 'ABERNATHY, Cora', score: 0.9, detail: 'Risk score 70' }] });
    assert.deepEqual(c.hits, [], 'an identity check carries its hits in its screening');
  });
});
