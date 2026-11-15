// The results API: a provider (or the sponsor's own automation) reports the outcome of a check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withServer, post, getJson } from './helpers.mjs';

const TOKEN = 'results-token-1234567890';
const AUTH = { Authorization: `Bearer ${TOKEN}` };
const INVESTOR = { id: 'INV-3', name: 'Ann Lee', email: 'ann@investor.example' };
const startLink = async (base, kind = 'identity', headers = {}) => (await post(`${base}/v1/verifications`, { kind, provider: 'link', settings: { link: 'https://verify.acme.example/start?ref={reference}' }, investor: INVESTOR }, headers)).json();

test('results API is off (404) unless RESULTS_TOKEN is set', () =>
  withServer({}, async (base) => {
    const ver = await startLink(base);
    const r = await post(`${base}/v1/results`, { reference: ver.id, status: 'passed' }, AUTH);
    assert.equal(r.status, 404);
    assert.equal((await getJson(`${base}/v1/verifications/${ver.id}`)).status, 'pending');
  }));

test('results API: token required and compared exactly; API_TOKEN is not accepted', () =>
  withServer({ env: { RESULTS_TOKEN: TOKEN, API_TOKEN: 'portal-token-1' } }, async (base) => {
    const ver = await startLink(base, 'identity', { Authorization: 'Bearer portal-token-1' });
    assert.match(ver.id, /^ver_/);
    const body = { reference: ver.id, status: 'passed' };
    assert.equal((await post(`${base}/v1/results`, body)).status, 401, 'no token');
    assert.equal((await post(`${base}/v1/results`, body, { Authorization: `Bearer ${TOKEN}x` })).status, 401, 'wrong token');
    assert.equal((await post(`${base}/v1/results`, body, { Authorization: 'Bearer portal-token-1' })).status, 401, 'the portal token cannot push results');
    assert.equal((await fetch(`${base}/v1/results`, { headers: AUTH })).status, 405);
    const ok = await (await post(`${base}/v1/results`, body, AUTH)).json();
    assert.deepEqual(ok, { ok: true, id: ver.id, status: 'passed' });
    const st = await getJson(`${base}/v1/verifications/${ver.id}`, { Authorization: 'Bearer portal-token-1' });
    assert.equal(st.status, 'passed');
    assert.equal(st.provider, 'link');
  }));

test('results API: identity results with detail and a bundled screening; statuses checked against the kind', () =>
  withServer({ env: { RESULTS_TOKEN: TOKEN } }, async (base, server) => {
    const ver = await startLink(base);
    const bad = await post(`${base}/v1/results`, { reference: ver.id, status: 'verified' }, AUTH);
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /status must be one of pending, passed, review, failed/);
    assert.equal((await post(`${base}/v1/results`, { reference: ver.id, status: 'passed', screening: { status: 'maybe' } }, AUTH)).status, 400);
    assert.equal((await post(`${base}/v1/results`, { reference: 'ver_doesnotexist', status: 'passed' }, AUTH)).status, 404);
    assert.equal((await post(`${base}/v1/results`, { reference: '../etc', status: 'passed' }, AUTH)).status, 404);
    assert.equal((await post(`${base}/v1/results`, 'not json', AUTH)).status, 400);
    const r = await post(`${base}/v1/results`, { reference: ver.id, status: 'review', method: 'Passport', detail: 'Name differs from the subscription', screening: { status: 'potential_match', hits: [{ name: 'Ann Lee', listed: 'LEE, Anne', list: 'Example PEP list', score: 0.92, extra: 'dropped' }] }, data: { private: 'ignored' } }, AUTH);
    assert.equal(r.status, 200);
    const st = await getJson(`${base}/v1/verifications/${ver.id}`);
    assert.equal(st.status, 'review');
    assert.equal(st.method, 'Passport');
    assert.equal(st.detail, 'Name differs from the subscription');
    assert.deepEqual(st.screening, { status: 'potential_match', hits: [{ name: 'Ann Lee', listed: 'LEE, Anne', list: 'Example PEP list', score: 0.92, detail: '' }] });
    assert.equal(server.store.get('verifications', ver.id).data, undefined, 'pushed results cannot write private data');
    assert.ok(server.store.data().events.some((e) => e.type === 'result_pushed' && e.id === ver.id && e.status === 'review'));
  }));

test('results API: accreditation with an expiry date and evidence', () =>
  withServer({ env: { RESULTS_TOKEN: TOKEN } }, async (base) => {
    const ver = await startLink(base, 'accreditation');
    assert.equal((await post(`${base}/v1/results`, { reference: ver.id, status: 'passed' }, AUTH)).status, 400, 'identity status on an accreditation check');
    assert.equal((await post(`${base}/v1/results`, { reference: ver.id, status: 'verified', expiresAt: 'next year' }, AUTH)).status, 400);
    assert.equal((await post(`${base}/v1/results`, { reference: ver.id, status: 'verified', evidence: 'letter' }, AUTH)).status, 400);
    const r = await post(`${base}/v1/results`, { reference: ver.id, status: 'verified', method: 'Income', expiresAt: '2027-02-01', evidence: [{ type: 'letter', label: 'Verification letter', url: 'https://files.acme.example/l/1.pdf' }, { label: 'Unsafe link', url: 'javascript:alert(1)' }] }, AUTH);
    assert.equal(r.status, 200);
    const st = await getJson(`${base}/v1/verifications/${ver.id}`);
    assert.equal(st.status, 'verified');
    assert.equal(st.expiresAt, '2027-02-01');
    assert.deepEqual(st.evidence, [{ type: 'letter', label: 'Verification letter', url: 'https://files.acme.example/l/1.pdf' }, { type: 'document', label: 'Unsafe link' }]);
  }));

test('results API: screenings (scr_ references) with hits', () => {
  const ofacFiles = async () => ({ ok: true, status: 200, text: async () => '1,"SOMEONE ELSE","individual","X",-0-,-0-,-0-,-0-,-0-,-0-,-0-,-0-\r\n' });
  return withServer({ env: { RESULTS_TOKEN: TOKEN }, fetch: ofacFiles }, async (base) => {
    const scr = await (await post(`${base}/v1/screenings`, { provider: 'ofac', names: ['Ann Lee'] })).json();
    assert.match(scr.id, /^scr_/);
    assert.equal(scr.status, 'clear');
    assert.equal((await post(`${base}/v1/results`, { reference: scr.id, status: 'passed' }, AUTH)).status, 400);
    assert.equal((await post(`${base}/v1/results`, { reference: scr.id, status: 'potential_match', hits: 'many' }, AUTH)).status, 400);
    const r = await (await post(`${base}/v1/results`, { reference: scr.id, status: 'potential_match', hits: [{ name: 'Ann Lee', listed: 'LEE, Ann', list: 'Example adverse media', score: 0.9 }] }, AUTH)).json();
    assert.deepEqual(r, { ok: true, id: scr.id, status: 'potential_match' });
    const st = await getJson(`${base}/v1/screenings/${scr.id}`);
    assert.equal(st.status, 'potential_match');
    assert.equal(st.hits[0].list, 'Example adverse media');
    await post(`${base}/v1/results`, { reference: scr.id, status: 'clear', hits: [] }, AUTH);
    assert.equal((await getJson(`${base}/v1/screenings/${scr.id}`)).status, 'clear');
  });
});

test('results API is rate-limited like other calls that change records', () =>
  withServer({ env: { RESULTS_TOKEN: TOKEN, RATE_LIMIT_PER_MIN: '2' } }, async (base) => {
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await post(`${base}/v1/results`, { reference: 'ver_x', status: 'passed' }, AUTH)).status);
    assert.deepEqual(codes, [404, 404, 429, 429]);
  }));
