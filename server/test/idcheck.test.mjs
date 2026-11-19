// The identity and screening plug-in (plugins/idcheck.mjs) through the real server, against recorded
// replies and an injected fetch. No provider is called here and no key exists: every reply shape is
// documentation quoted by search (each fixture names its source and says unconfirmed). Plan 08-12
// proves the shapes against the live service before anything is called working.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadProviders } from '../providers/index.mjs';
import { withServer, post, getJson, mockFetch } from './helpers.mjs';

const DIR = fileURLToPath(new URL('./fixtures/idcheck/', import.meta.url));
const fixture = (n) => JSON.parse(readFileSync(`${DIR}${n}.json`, 'utf8'));
const reply = (n, patch) => Object.assign(structuredClone(fixture(n).reply), patch);
const without = (o, ...keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
// The provider's web domain and name, read from a fixture's source line so this file holds neither.
const DOMAIN = new URL(fixture('session-created')._source).hostname.split('.').slice(-2).join('.');
const VENDOR = DOMAIN.split('.')[0];
const vendorWord = new RegExp(VENDOR, 'i');

const ENV = { IDCHECK_API_KEY: 'key-test-0123456789', IDCHECK_WORKFLOW: 'wf-test-1', IDCHECK_WEBHOOK_SECRET: 'whk-test-secret-abcdef' };
const INVESTOR = { id: 'INV-7', name: 'Ann Marie Lee', email: 'ann+test@investor.example', workspace: 'w1' };
const SESSION = fixture('session-created').reply.session_id;
// The real plug-in from the default plug-ins folder, as every server loads it.
const providers = await loadProviders({ env: {} });
const plugin = providers.idcheck;
// The details the documentation left open, as the plug-in holds them: when plan 08-12 corrects one, these tests follow.
const A = plugin.ASSUMED;

const SESSIONS = /\/v3\/session\/$/;
const DECISION = /\/v3\/session\/[^/]+\/decision\/$/;
const AML = /\/v3\/aml\/$/;
const sign = (data, secret = ENV.IDCHECK_WEBHOOK_SECRET) => createHmac('sha256', secret).update(data).digest('hex');
const seconds = () => Math.floor(Date.now() / 1000);
let serial = 0;
const eventId = () => `evt-test-${++serial}`;
/**
 * A session delivery: the exact bytes signed in the first signature header; its timestamp is inside those
 * bytes. Real deliveries also carry the second signature header (over a re-ordered copy of the body), which
 * this scheme never reads.
 */
const sessionHook = (base, body, headers) => {
  const raw = JSON.stringify(body);
  return post(`${base}/webhooks/idcheck`, raw, Object.assign({ 'X-Signature': sign(raw), 'X-Signature-V2': sign(`sorted:${raw}`), 'X-Timestamp': String(body.timestamp) }, headers));
};
/** A monitoring alert: "<timestamp header>.<raw body>" signed in the second signature header; no first signature header. */
const alertHook = (base, body, ts = seconds(), headers) => {
  const raw = JSON.stringify(body);
  return post(`${base}/webhooks/idcheck`, raw, Object.assign({ 'X-Timestamp': String(ts), 'X-Signature-V2': sign(`${ts}.${raw}`) }, headers));
};
const statusUpdated = (id, patch) => reply('webhook-status-updated', Object.assign({ event_id: eventId(), timestamp: seconds(), vendor_data: id }, patch));
const newHit = (patch) => reply('webhook-new-hit', Object.assign({ event_id: eventId(), timestamp: seconds() }, patch));
const start = async (base) => (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'idcheck', investor: INVESTOR })).json();
const screenNames = (base, names, investor = { id: 'INV-7' }) => post(`${base}/v1/screenings`, { provider: 'idcheck', investor, names });
const events = (server, type) => server.store.data().events.filter((e) => e.type === type);
const sessionRoutes = (decision) => [
  ['POST', SESSIONS, () => ({ status: 201, body: reply('session-created') })],
  ['GET', DECISION, () => decision()]
];

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

test('statuses: each documented session status is mapped; an unknown one leaves the check pending and is logged', async () => {
  let decision = null;
  const f = mockFetch(sessionRoutes(() => decision));
  await withServer({ env: ENV, fetch: f, providers }, async (base, server) => {
    const read = async (d) => {
      decision = d;
      const r = await start(base);
      return getJson(`${base}/v1/verifications/${r.id}`);
    };
    const cases = [
      ['Approved', reply('decision-approved'), 'passed'],
      ['Declined', reply('decision-approved', { status: 'Declined', id_verifications: [{ [A.partStatusField]: 'Declined' }] }), 'failed'],
      ['In Review', reply('decision-in-review'), 'review']
    ].concat(['Expired', 'Kyc Expired', 'Abandoned', 'Not Started', 'In Progress', 'Awaiting User', 'Resubmitted'].map((s) => [s, { status: s }, 'pending']));
    assert.equal(cases.length, 10);
    for (const [raw, d, want] of cases) {
      const st = await read(d);
      assert.equal(st.status, want, raw);
      assert.equal(st.providerStatus, '', `${raw} is mapped, not left as a raw value`);
      if (want === 'pending') assert.equal(st.screening, null, `${raw}: no screening result for an unfinished check`);
    }
    assert.equal(events(server, 'unmapped_status').length, 0);
    const un = await read(reply('decision-approved', { status: 'Paused By Agent' }));
    assert.equal(un.status, 'pending');
    assert.equal(un.providerStatus, 'Paused By Agent');
    assert.equal(un.screening, null, 'nothing else from a decision whose status is not understood');
    assert.deepEqual(events(server, 'unmapped_status').map((e) => [e.provider, e.status]), [['idcheck', 'Paused By Agent']]);
  });
});

test('statuses: each documented screening status is mapped; a reply with hits is a potential match, none is clear', async () => {
  let aml = null;
  const f = mockFetch([['POST', AML, () => aml]]);
  await withServer({ env: ENV, fetch: f, providers }, async (base, server) => {
    const run = async (a) => {
      aml = a;
      const r = await (await screenNames(base, ['Ann Marie Lee'])).json();
      return Object.assign(await getJson(`${base}/v1/screenings/${r.id}`), { answered: r.status });
    };
    for (const [raw, want] of [['Approved', 'clear'], ['Declined', 'potential_match'], ['In Review', 'potential_match'], ['Not Finished', 'pending']]) {
      const st = await run(reply('aml-clear', { aml: { status: raw, hits: [] } }));
      assert.equal(st.status, want, raw);
      assert.equal(st.answered, want, raw);
      assert.equal(st.providerStatus, '', `${raw} is mapped, not left as a raw value`);
    }
    const clear = await run(reply('aml-clear'));
    assert.equal(clear.status, 'clear');
    assert.deepEqual(clear.hits, []);
    const hit = await run(reply('aml-hit'));
    assert.equal(hit.status, 'potential_match');
    assert.deepEqual(hit.hits, [{ name: 'Ann Marie Lee', list: '', listed: '', score: 0.96, detail: 'Risk score 80' }]);
    // A hit the provider itself let through is still shown to a person: the plug-in never clears a name that has hits.
    const approvedWithHit = await run(reply('aml-hit', { aml: { status: 'Approved', hits: fixture('aml-hit').reply.aml.hits } }));
    assert.equal(approvedWithHit.status, 'potential_match');
    assert.equal(approvedWithHit.hits.length, 1);
    assert.equal(events(server, 'unmapped_status').length, 0);
    const un = await run(reply('aml-clear', { aml: { status: 'Queued', hits: [] } }));
    assert.equal(un.status, 'pending');
    assert.equal(un.providerStatus, 'Queued');
    assert.deepEqual(events(server, 'unmapped_status').map((e) => [e.provider, e.status]), [['idcheck', 'Queued']]);
  });
});

test('declined by screening only: a passed check reads review with a potential match, never failed', async () => {
  let decision = reply('decision-approved');
  const f = mockFetch(sessionRoutes(() => decision));
  await withServer({ env: ENV, fetch: f, providers }, async (base) => {
    const r = await start(base);
    const view = () => getJson(`${base}/v1/verifications/${r.id}`);
    assert.equal((await view()).status, 'passed');
    const after = async (d, status) => {
      decision = d;
      assert.equal((await sessionHook(base, statusUpdated(r.id, { status }))).status, 200);
      return view();
    };

    // The provider's monitoring found a name on a list and declined the whole session: a person reviews, nobody is rejected.
    const held = await after(reply('decision-declined-screening'), 'Declined');
    assert.notEqual(held.status, 'failed');
    assert.equal(held.status, 'review');
    assert.equal(held.screening.status, 'potential_match');
    assert.deepEqual(held.screening.hits, [{ name: INVESTOR.name, list: '', listed: '', score: 0.97, detail: 'Risk score 88' }]);
    assert.equal(held.providerStatus, '');

    const inReview = await after(reply('decision-declined-screening', { status: 'In Review', aml_screenings: [{ [A.partStatusField]: 'In Review', hits: [] }] }), 'In Review');
    assert.equal(inReview.status, 'review');
    assert.deepEqual(inReview.screening, { status: 'potential_match', hits: [] });

    // Declined with no part saying why (a reviewer's decision, or a part this plug-in cannot read) is a person's call too.
    const unexplained = await after(reply('decision-approved', { status: 'Declined' }), 'Declined');
    assert.equal(unexplained.status, 'review');
    assert.deepEqual(unexplained.screening, { status: 'clear', hits: [] });

    // Failed only when the ID, the liveness check or the face match itself was declined.
    for (const part of ['id_verifications', 'liveness_checks', 'face_matches']) {
      const st = await after(reply('decision-approved', { status: 'Declined', [part]: [{ [A.partStatusField]: 'Declined' }] }), 'Declined');
      assert.equal(st.status, 'failed', part);
    }
    const both = await after(reply('decision-declined-screening', { face_matches: [{ [A.partStatusField]: 'Declined' }] }), 'Declined');
    assert.equal(both.status, 'failed');
    assert.equal(both.screening.status, 'potential_match', 'the match is still shown beside a failed ID');

    // And back: the provider's own reviewer cleared the name; the decision, re-read, passes the investor again.
    const cleared = await after(reply('decision-approved'), 'Approved');
    assert.equal(cleared.status, 'passed');
    assert.deepEqual(cleared.screening, { status: 'clear', hits: [] });
  });
});

test('names: three names are screened one call each with a 60 second limit, enrolled in monitoring, hits merged', async () => {
  const investor = { id: 'INV-9', name: 'Dmitri Volkov', account: 'Volkov Holdings LLC', type: 'entity', workspace: 'w1' };
  const names = ['Dmitri Volkov', 'Ann Marie Lee', 'Volkov Holdings LLC'];
  const listed = { 'Dmitri Volkov': 'VOLKOV, Dmitri', 'Volkov Holdings LLC': 'VOLKOV HOLDINGS' };
  const f = mockFetch([
    [
      'POST',
      AML,
      (c) => {
        const n = c.body[A.screen.name];
        if (!listed[n]) return reply('aml-clear', { request_id: `req-${names.indexOf(n)}` });
        // The matched name and the list are not in the documentation quoted: built from the plug-in's own assumptions.
        const hit = Object.assign({}, fixture('aml-hit').reply.aml.hits[0], { [A.hit.listed]: listed[n], [A.hit.list]: ['Example sanctions list', 'Example PEP list'] });
        return reply('aml-hit', { request_id: `req-${names.indexOf(n)}`, aml: { status: 'In Review', hits: [hit] } });
      }
    ]
  ]);
  await withServer({ env: ENV, fetch: f, providers }, async (base, server) => {
    // The limit each provider call runs under is the timer requestJson sets: watched, never waited for.
    const real = globalThis.setTimeout;
    const delays = [];
    globalThis.setTimeout = function (fn, ms, ...rest) {
      delays.push(ms);
      return real(fn, ms, ...rest);
    };
    let r;
    try {
      r = await (await screenNames(base, names, investor)).json();
    } finally {
      globalThis.setTimeout = real;
    }
    assert.equal(delays.filter((d) => d === 60000).length, 3, 'three provider calls, each with a 60 second limit');
    assert.equal(delays.filter((d) => d === 15000).length, 0, 'none left on the 15 second default');

    assert.equal(f.calls.length, 3, 'one provider call per name');
    assert.deepEqual(
      f.calls.map((c) => c.body),
      names.map((n) => ({ [A.screen.name]: n, [A.screen.entityType]: n === 'Volkov Holdings LLC' ? A.screen.company : A.screen.person, [A.screen.reference]: r.id, include_ongoing_monitoring: true, save_api_request: true }))
    );
    for (const c of f.calls) {
      assert.equal(new URL(c.url).pathname, '/v3/aml/');
      assert.equal(c.headers['x-api-key'], ENV.IDCHECK_API_KEY);
      assert.equal(c.redirect, 'manual');
    }
    assert.match(r.id, /^scr_/);
    assert.equal(r.status, 'potential_match');
    const merged = [
      { name: 'Dmitri Volkov', list: 'Example sanctions list, Example PEP list', listed: 'VOLKOV, Dmitri', score: 0.96, detail: 'Risk score 80' },
      { name: 'Volkov Holdings LLC', list: 'Example sanctions list, Example PEP list', listed: 'VOLKOV HOLDINGS', score: 0.96, detail: 'Risk score 80' }
    ];
    assert.deepEqual(r.hits, merged);
    const view = await getJson(`${base}/v1/screenings/${r.id}`);
    assert.equal(view.monitoring, true, 'every name was enrolled in ongoing monitoring');
    assert.deepEqual(view.hits, merged);
    // The provider's request ids stay on the server, one per name, with no name beside them (names are sealed elsewhere).
    const rec = server.store.get('screenings', r.id);
    assert.deepEqual(rec.data, { requests: ['req-0', 'req-1', 'req-2'] });
    assert.equal(rec.ref, r.id, 'alerts find the screening by our own id');
    assert.ok(!JSON.stringify(view).includes('req-'));

    // An individual whose account carries their own name is a person, not a company.
    await screenNames(base, ['Ann Marie Lee'], { id: 'INV-7', name: 'Ann Marie Lee', account: 'Ann Marie Lee', type: 'individual' });
    assert.equal(f.calls[3].body[A.screen.entityType], A.screen.person);
    // A trust's account name is a company-type subject; its trustee is a person.
    await screenNames(base, ['Lee Family Trust', 'Ann Marie Lee'], { id: 'INV-8', name: 'Ann Marie Lee', account: 'Lee Family Trust', type: 'trust' });
    assert.deepEqual([f.calls[4].body[A.screen.entityType], f.calls[5].body[A.screen.entityType]], [A.screen.company, A.screen.person]);
  });
});

test('alert: a signed monitoring alert holds the screening it names and the identity check it names', async () => {
  const f = mockFetch(sessionRoutes(() => reply('decision-approved')).concat([['POST', AML, () => reply('aml-clear')]]));
  await withServer({ env: ENV, fetch: f, providers }, async (base, server) => {
    const s = await (await screenNames(base, ['Ann Marie Lee'])).json();
    assert.equal(s.status, 'clear');
    const v = await start(base);
    assert.equal((await getJson(`${base}/v1/verifications/${v.id}`)).status, 'passed');
    const callsBefore = f.calls.length;
    const alertHits = [{ name: '', list: '', listed: '', score: 0.93, detail: 'Risk score 75' }];

    // The screening, named by our own id.
    const a1 = await alertHook(base, newHit({ vendor_data: s.id }));
    assert.equal(a1.status, 200);
    assert.deepEqual(await a1.json(), { received: true });
    const scr = await getJson(`${base}/v1/screenings/${s.id}`);
    assert.equal(scr.status, 'potential_match');
    assert.deepEqual(scr.hits, alertHits);
    assert.equal((await getJson(`${base}/v1/verifications/${v.id}`)).status, 'passed', 'only the record the alert names is held');

    // The identity check, named by the provider's session id.
    const a2 = await alertHook(base, without(newHit(), 'vendor_data'));
    assert.equal(a2.status, 200);
    const ver = await getJson(`${base}/v1/verifications/${v.id}`);
    assert.equal(ver.status, 'review');
    assert.deepEqual(ver.screening, { status: 'potential_match', hits: alertHits });

    assert.equal(f.calls.length, callsBefore, 'an alert is applied as a hold from its signed body: no provider call');
    assert.equal(events(server, 'webhook_rejected').length, 0);
    assert.deepEqual(events(server, 'webhook').map((e) => e.event), ['aml.new_hit', 'aml.new_hit']);

    // A new-hit alert whose detail cannot be read still holds: the stored hits stay and a person looks.
    const s2 = await (await screenNames(base, ['Ann Marie Lee'])).json();
    assert.equal((await alertHook(base, without(newHit({ vendor_data: s2.id }), 'status', 'decision'))).status, 200);
    const bare = await getJson(`${base}/v1/screenings/${s2.id}`);
    assert.equal(bare.status, 'potential_match');
    assert.deepEqual(bare.hits, []);
  });
});

test('hold only: an alert that says the person is clear changes nothing', async () => {
  const f = mockFetch(sessionRoutes(() => reply('decision-approved')).concat([['POST', AML, (c) => (c.body[A.screen.name] === 'Dmitri Volkov' ? reply('aml-hit') : reply('aml-clear'))]]));
  const clearAlert = (patch) => newHit(Object.assign({ status: 'Approved', decision: { aml_screenings: [{ [A.partStatusField]: 'Approved', hits: [] }] } }, patch));
  await withServer({ env: ENV, fetch: f, providers }, async (base, server) => {
    const flagged = await (await screenNames(base, ['Dmitri Volkov'])).json();
    assert.equal(flagged.status, 'potential_match');
    const v = await start(base);
    assert.equal((await getJson(`${base}/v1/verifications/${v.id}`)).status, 'passed');
    const held = await start(base);
    await getJson(`${base}/v1/verifications/${held.id}`);
    assert.equal((await alertHook(base, newHit({ vendor_data: held.id }))).status, 200);
    assert.equal(server.store.get('verifications', held.id).status, 'review');

    const snapshot = () => JSON.stringify([server.store.get('screenings', flagged.id), server.store.get('verifications', v.id), server.store.get('verifications', held.id)]);
    const before = snapshot();
    const calls = f.calls.length;
    for (const id of [flagged.id, v.id, held.id]) {
      const res = await alertHook(base, clearAlert({ vendor_data: id }));
      assert.equal(res.status, 200, 'a signed delivery is acknowledged');
    }
    // The same by the provider's session id, and for an alert of a type this plug-in does not know.
    assert.equal((await alertHook(base, without(clearAlert(), 'vendor_data'))).status, 200);
    assert.equal((await alertHook(base, without(clearAlert({ vendor_data: flagged.id, webhook_type: 'aml.cleared' }), 'status', 'decision'))).status, 200);
    assert.equal(snapshot(), before, 'no record changed: not its status, its hits or its dates');
    assert.equal(f.calls.length, calls);
    assert.equal(server.store.get('screenings', flagged.id).status, 'potential_match', 'a held screening is never cleared by an alert');
    assert.equal(server.store.get('verifications', held.id).status, 'review', 'a held identity check is never cleared by an alert');

    // Whatever an alert says, the result the plug-in hands the server can only be a hold.
    const bodies = [newHit(), clearAlert(), without(newHit(), 'status', 'decision'), newHit({ status: 'Approved' }), newHit({ status: 'Declined' })];
    for (const body of bodies) {
      const rawBody = Buffer.from(JSON.stringify(body));
      const ev = plugin.parseWebhook({ body, rawBody, headers: { 'x-signature-v2': 'x', 'x-timestamp': String(seconds()) }, env: ENV });
      assert.equal(ev.refetch, false);
      for (const kind of ['identity', 'aml', 'accreditation']) {
        const r = plugin.webhookResult(kind, ev);
        assert.ok(r.status === undefined || r.status === (kind === 'aml' ? 'potential_match' : 'review'), `${kind}: ${r.status}`);
        assert.ok(!r.screening || r.screening.status === 'potential_match');
        if (kind === 'accreditation') assert.deepEqual(r, {});
      }
    }
  });
});

test('forged: a wrong signature, a stale or unsigned time, or no secret changes nothing; a repeat is dropped', async () => {
  const f = mockFetch(sessionRoutes(() => reply('decision-approved')).concat([['POST', AML, () => reply('aml-clear')]]));
  await withServer({ env: ENV, fetch: f, providers }, async (base, server) => {
    const v = await start(base);
    const s = await (await screenNames(base, ['Ann Marie Lee'])).json();
    const snapshot = () => JSON.stringify([server.store.get('verifications', v.id), server.store.get('screenings', s.id)]);
    const before = snapshot();
    const calls = f.calls.length;
    const sent = (body, headers) => post(`${base}/webhooks/idcheck`, JSON.stringify(body), headers);
    const now = seconds();

    const good = statusUpdated(v.id);
    const raw = JSON.stringify(good);
    const alert = newHit({ vendor_data: s.id });
    const rawAlert = JSON.stringify(alert);
    const forged = [
      ['session: signed with another secret', good, { 'X-Signature': sign(raw, 'another-secret') }],
      ['session: no signature at all', good, { 'X-Timestamp': String(now) }],
      ['session: body changed after signing', Object.assign({}, good, { status: 'Declined' }), { 'X-Signature': sign(raw) }],
      ['session: signed body is 301 seconds old, under a fresh timestamp header', statusUpdated(v.id, { timestamp: now - 301 }), null],
      // 360 s, not 301: `now` is taken before the loop, and a slow machine can start the loop more than a second later.
      ['session: signed body is 360 seconds ahead', statusUpdated(v.id, { timestamp: now + 360 }), null],
      ['session: signed body has no timestamp', without(statusUpdated(v.id), 'timestamp'), null],
      ['alert: signed with another secret', alert, { 'X-Timestamp': String(now), 'X-Signature-V2': sign(`${now}.${rawAlert}`, 'another-secret') }],
      ['alert: timestamp header 301 seconds old', alert, { 'X-Timestamp': String(now - 301), 'X-Signature-V2': sign(`${now - 301}.${rawAlert}`) }],
      ['alert: timestamp header is not the signed one', alert, { 'X-Timestamp': String(now), 'X-Signature-V2': sign(`${now - 1}.${rawAlert}`) }],
      ['alert: no timestamp header', alert, { 'X-Signature-V2': sign(`.${rawAlert}`) }],
      ['alert: the body alone signed, as a session delivery would be', alert, { 'X-Timestamp': String(now), 'X-Signature-V2': sign(rawAlert) }],
      ['alert: body changed after signing', Object.assign({}, alert, { vendor_data: v.id }), { 'X-Timestamp': String(now), 'X-Signature-V2': sign(`${now}.${rawAlert}`) }]
    ];
    for (const [what, body, headers] of forged) {
      const res = headers ? await sent(body, headers) : await sessionHook(base, body, { 'X-Timestamp': String(now) });
      assert.equal(res.status, 401, what);
      assert.equal(snapshot(), before, what);
    }
    assert.equal(f.calls.length, calls, 'no forged delivery made the server read a decision');
    assert.equal(events(server, 'webhook_rejected').length, forged.length);
    assert.equal(events(server, 'webhook').length, 0);

    // A real delivery works once; the same event again is dropped.
    const first = await sessionHook(base, good);
    assert.deepEqual([first.status, await first.json()], [200, { received: true }]);
    assert.equal(server.store.get('verifications', v.id).status, 'passed');
    const passed = snapshot();
    const again = await sessionHook(base, good);
    assert.deepEqual([again.status, await again.json()], [200, { received: true, duplicate: true }]);
    assert.equal(f.calls.length, calls + 1, 'the repeat did not read the decision again');
    assert.equal(snapshot(), passed);

    // An alert that carries no event id is known by its bytes, so its repeat is dropped as well.
    const anonymous = without(alert, 'event_id');
    const a1 = await alertHook(base, anonymous, now);
    assert.deepEqual([a1.status, await a1.json()], [200, { received: true }]);
    assert.equal(server.store.get('screenings', s.id).status, 'potential_match');
    const heldAt = snapshot();
    const a2 = await alertHook(base, anonymous, now);
    assert.deepEqual([a2.status, await a2.json()], [200, { received: true, duplicate: true }]);
    assert.equal(snapshot(), heldAt);
    const digest = createHash('sha256').update(JSON.stringify(anonymous)).digest('hex');
    assert.equal(plugin.parseWebhook({ body: anonymous, rawBody: Buffer.from(JSON.stringify(anonymous)), headers: { 'x-signature-v2': 'x' }, env: ENV }).id, digest);
  });

  // No secret on the server: the route does not exist for anyone, and the plug-in itself refuses a delivery signed with an empty key.
  await withServer({ env: Object.assign({}, ENV, { IDCHECK_WEBHOOK_SECRET: '' }), fetch: f, providers }, async (base) => {
    const body = statusUpdated('ver_none');
    const raw = JSON.stringify(body);
    const now = seconds();
    assert.equal((await post(`${base}/webhooks/idcheck`, raw, { 'X-Signature': sign(raw, '') })).status, 404);
    assert.equal((await post(`${base}/webhooks/idcheck`, raw, { 'X-Timestamp': String(now), 'X-Signature-V2': sign(`${now}.${raw}`, '') })).status, 404);
    const rawBody = Buffer.from(raw);
    assert.equal(plugin.verifyWebhook({ rawBody, headers: { 'x-signature': sign(raw, '') }, env: { IDCHECK_WEBHOOK_SECRET: '' } }), false);
    assert.equal(plugin.verifyWebhook({ rawBody, headers: { 'x-timestamp': String(now), 'x-signature-v2': sign(`${now}.${raw}`, '') }, env: {} }), false);
    assert.equal(plugin.verifyWebhook({ rawBody, headers: { 'x-signature': sign(raw) }, env: ENV }), true, 'the same delivery with the real secret is accepted');
  });
});

test('provider errors: a refused key or an empty balance reaches the caller as a neutral 502', async () => {
  let failing = 0;
  let unreachable = false;
  let page;
  const named = `${VENDOR[0].toUpperCase()}${VENDOR.slice(1)}`;
  const refusal = () => ({ status: failing, body: { detail: `${named} could not authenticate this request. See https://docs.${DOMAIN}/errors or write to support@${DOMAIN}.` } });
  const answer = (ok) => () => {
    if (unreachable) throw new Error(`getaddrinfo ENOTFOUND verification.${DOMAIN}`);
    return failing ? refusal() : ok();
  };
  const f = mockFetch([
    ['POST', SESSIONS, answer(() => ({ status: 201, body: page === undefined ? reply('session-created') : Object.assign(without(reply('session-created'), 'url'), page) }))],
    ['GET', DECISION, answer(() => reply('decision-approved'))],
    ['POST', AML, answer(() => reply('aml-clear'))]
  ]);
  const neutral = async (res, want) => {
    const text = await res.text();
    assert.equal(res.status, 502);
    assert.deepEqual(JSON.parse(text), { error: want });
    assert.ok(!text.includes(ENV.IDCHECK_API_KEY) && !vendorWord.test(text), text);
  };
  await withServer({ env: ENV, fetch: f, providers }, async (base, server) => {
    const v = await start(base);
    // 403 is the provider's answer to a missing or wrong key; 402 to an empty balance.
    for (const status of [403, 402]) {
      failing = status;
      await neutral(await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'idcheck', investor: INVESTOR }), `Identity check answered ${status}`);
      await neutral(await screenNames(base, ['Ann Marie Lee']), `Identity check answered ${status}`);
      server.store.put('verifications', { id: v.id, checkedAt: '' });
      await neutral(await fetch(`${base}/v1/verifications/${v.id}`), `Identity check answered ${status}`);
      // A signed delivery whose re-read fails is acknowledged and logged, still with no provider text.
      assert.equal((await sessionHook(base, statusUpdated(v.id))).status, 200);
    }
    assert.deepEqual(events(server, 'refresh_failed').map((e) => [e.provider, e.id, e.error]), [['idcheck', v.id, 'Identity check answered 403'], ['idcheck', v.id, 'Identity check answered 402']]);
    failing = 0;
    unreachable = true;
    await neutral(await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'idcheck', investor: INVESTOR }), 'Identity check could not be reached');
    await neutral(await screenNames(base, ['Ann Marie Lee']), 'Identity check could not be reached');
    assert.equal((await sessionHook(base, statusUpdated(v.id))).status, 200);
    assert.equal(events(server, 'refresh_failed').length, 3);
    const log = JSON.stringify(server.store.data().events);
    assert.ok(!vendorWord.test(log) && !log.includes(ENV.IDCHECK_API_KEY), 'no provider name, address or key in any event');
    assert.equal(server.store.get('verifications', v.id).status, 'pending', 'a failed read leaves the check as it was');
    // A reply with no page to open, or one that is not https, starts nothing: the investor is never sent to it.
    unreachable = false;
    for (page of [{}, { url: `http://verify.${DOMAIN}/session/x` }, { url: 'javascript:alert(1)' }]) {
      await neutral(await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'idcheck', investor: INVESTOR }), 'Identity check did not start the check');
    }
  });
});

test('connector list: the default registry lists the plug-in with no provider name anywhere a sponsor can read', async () => {
  // No providers option: the registry every server starts with.
  await withServer({ env: {} }, async (base) => {
    const list = await getJson(`${base}/v1/connectors`);
    assert.deepEqual(list.connectors.find((c) => c.id === 'idcheck'), {
      id: 'idcheck',
      name: 'Identity check',
      description: 'Photo ID, selfie and sanctions screening.',
      checks: ['identity', 'aml'],
      start: 'api',
      builtin: false,
      configured: false,
      missing: ['IDCHECK_API_KEY', 'IDCHECK_WORKFLOW', 'IDCHECK_WEBHOOK_SECRET']
    });
    assert.ok(!vendorWord.test(JSON.stringify(list)));
  });
  for (const k of ['createSession', 'fetchResult', 'screen', 'verifyWebhook', 'parseWebhook', 'webhookResult']) assert.equal(typeof plugin[k], 'function', k);
  assert.equal(plugin.fetchScreening, undefined, 'the screening call answers at once: nothing to poll');
  // In the plug-in the provider's address is one constant; this test file holds no provider word at all.
  const named = (file) => readFileSync(file, 'utf8').split('\n').filter((line) => vendorWord.test(line));
  const inPlugin = named(fileURLToPath(new URL('../plugins/idcheck.mjs', import.meta.url)));
  assert.equal(inPlugin.length, 1);
  assert.match(inPlugin[0], /^const API = 'https:\/\/[a-z.]+\/v3';$/);
  assert.deepEqual(named(fileURLToPath(import.meta.url)), []);
});

test('fixtures: every recorded reply names its documentation source and says it is unconfirmed', () => {
  const files = readdirSync(DIR).filter((n) => n.endsWith('.json')).sort();
  assert.deepEqual(files, ['aml-clear.json', 'aml-hit.json', 'decision-approved.json', 'decision-declined-screening.json', 'decision-in-review.json', 'session-created.json', 'webhook-new-hit.json', 'webhook-status-updated.json']);
  for (const n of files) {
    const fx = fixture(n.replace(/\.json$/, ''));
    assert.match(fx._source, /^https:\/\//, n);
    assert.match(fx._status, /^unconfirmed: /, n);
    assert.ok(fx.reply && typeof fx.reply === 'object', n);
  }
});
