// Core server behavior: health, CORS, auth, the sandbox provider round trip and OFAC screening.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';
import * as ofac from '../providers/ofac.mjs';

/** Run fn against a fresh server, always closing it (a failing assertion must not leave it open). */
async function withServer(env, fetchImpl, fn) {
  const server = createServer({ env: Object.assign({ NODE_ENV: 'test', PUBLIC_URL: 'http://verify.test' }, env), store: openStore(null), fetch: fetchImpl });
  await new Promise((r) => server.listen(0, r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`, server);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
const post = (url, body, headers = {}) => fetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: typeof body === 'string' ? body : JSON.stringify(body) });

test('health lists configured providers', () =>
  withServer({}, undefined, async (base) => {
    const r = await (await fetch(`${base}/health`)).json();
    assert.equal(r.ok, true);
    assert.ok(r.providers.includes('sandbox') && r.providers.includes('ofac'));
  }));

test('CORS: allowed origin gets headers, others are refused', () =>
  withServer({ PORTAL_ORIGIN: 'https://portal.example' }, undefined, async (base) => {
    const ok = await fetch(`${base}/health`, { headers: { Origin: 'https://portal.example' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://portal.example');
    const bad = await fetch(`${base}/health`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(bad.status, 403);
  }));

test('API_TOKEN protects the API', () =>
  withServer({ API_TOKEN: 'secret-token-123' }, undefined, async (base) => {
    const body = { kind: 'identity', provider: 'sandbox', investor: { id: 'A-1', name: 'Ann Lee' } };
    assert.equal((await post(`${base}/v1/verifications`, body)).status, 401);
    assert.equal((await post(`${base}/v1/verifications`, body, { Authorization: 'Bearer secret-token-123' })).status, 200);
    assert.equal((await post(`${base}/v1/verifications`, body, { Authorization: 'Bearer wrong' })).status, 401);
  }));

test('sandbox round trip: start, pending, hosted page result, passed', () =>
  withServer({}, undefined, async (base) => {
    const created = await (await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'sandbox', investor: { id: 'A-1', name: 'Ann Lee', workspace: 'w1' } })).json();
    assert.match(created.id, /^ver_/);
    assert.match(created.url, /^http:\/\/verify\.test\/sandbox\/sbx_/);
    let st = await (await fetch(`${base}/v1/verifications/${created.id}`)).json();
    assert.equal(st.status, 'pending');
    const ref = created.url.split('/').pop();
    assert.match(await (await fetch(`${base}/sandbox/${ref}`)).text(), /Sandbox identity check/);
    const bad = await fetch(`${base}/sandbox/${ref}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'outcome=verified' });
    assert.equal(bad.status, 400);
    const done = await fetch(`${base}/sandbox/${ref}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'outcome=passed' });
    assert.equal(done.status, 200);
    st = await (await fetch(`${base}/v1/verifications/${created.id}`)).json();
    assert.equal(st.status, 'passed');
    const acc = await (await post(`${base}/v1/verifications`, { kind: 'accreditation', provider: 'sandbox', investor: { id: 'A-1', name: 'Ann Lee' } })).json();
    assert.match(acc.id, /^ver_/);
  }));

test('rejects unknown providers, bad input and unknown webhook providers', () =>
  withServer({}, undefined, async (base) => {
    assert.equal((await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'nope', investor: { id: 'A', name: 'B' } })).status, 400);
    assert.equal((await post(`${base}/v1/verifications`, { kind: 'identity', provider: 'sandbox', investor: {} })).status, 400);
    assert.equal((await post(`${base}/v1/verifications`, { kind: 'aml', provider: 'sandbox', investor: { id: 'A', name: 'B' } })).status, 400);
    assert.equal((await post(`${base}/webhooks/nope`, '{}')).status, 404);
    assert.equal((await post(`${base}/v1/verifications`, 'not json')).status, 400);
    assert.equal((await fetch(`${base}/v1/verifications/ver_missing`)).status, 404);
    assert.equal((await post(`${base}/v1/screenings`, { provider: 'ofac', names: [] })).status, 400);
  }));

test('OFAC: name matching handles order, accents, suffixes, typos and near misses', () => {
  assert.ok(ofac.nameScore('Maria Garcia', 'GARCIA, Maria') > 0.97);
  assert.ok(ofac.nameScore('José Álvarez', 'ALVAREZ, Jose') > 0.97);
  assert.ok(ofac.nameScore('Banco Nacional de Cuba S.A.', 'BANCO NACIONAL DE CUBA') > 0.97);
  assert.ok(ofac.nameScore('Oceanic Trading, L.L.C.', 'OCEANIC TRADING LLC') > 0.97);
  assert.ok(ofac.nameScore('Dmitri Volkov', 'VOLKOV, Dmitri Sergeyevich') >= 0.9);
  assert.ok(ofac.nameScore('Mohammad Rahimi', 'RAHIMI, Mohammed') >= 0.9);
  assert.ok(ofac.nameScore('Robert Marsh', 'MARSHALL, Roberta') < 0.9);
  assert.ok(ofac.nameScore('John Smith', 'Jane Doe') < 0.7);
  const rows = ofac.parseCsv('36,"AEROCARIBBEAN AIRLINES","-0-","CUBA",-0-,-0-,-0-,-0-,-0-,-0-,-0-,"Havana, Cuba."\r\n173,"ANGLO-CARIBBEAN CO., LTD.","-0-","CUBA",-0-,-0-,-0-,-0-,-0-,-0-,-0-,-0-\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], 'ANGLO-CARIBBEAN CO., LTD.');
  assert.equal(rows[0][11], 'Havana, Cuba.');
});

test('OFAC screening through the API with a downloaded list and alternate names', () => {
  ofac._setList(null);
  const sdn = '10001,"VOLKOV, Dmitri Sergeyevich","individual","RUSSIA-EO14024",-0-,-0-,-0-,-0-,-0-,-0-,-0-,"DOB 01 Jan 1970"\r\n10002,"OCEANIC TRADING LLC","-0-","SDGT",-0-,-0-,-0-,-0-,-0-,-0-,-0-,-0-\r\n';
  const alt = '10001,501,"aka","VOLKOV, Dmitry",-0-\r\n';
  const fetchImpl = async (url) => ({ ok: true, status: 200, text: async () => (String(url).includes('ALT') ? alt : sdn) });
  return withServer({}, fetchImpl, async (base) => {
    try {
      const r = await (await post(`${base}/v1/screenings`, { provider: 'ofac', investor: { id: 'B-2' }, names: ['Dmitry Volkov', 'Ellen Marsh', 'Oceanic Trading, L.L.C.'] })).json();
      assert.equal(r.status, 'potential_match');
      assert.deepEqual(r.hits.map((x) => x.name).sort(), ['Dmitry Volkov', 'Oceanic Trading, L.L.C.']);
      assert.ok(r.hits.every((x) => x.list === 'OFAC SDN' && x.score >= 0.9));
      const clear = await (await post(`${base}/v1/screenings`, { provider: 'ofac', names: ['Ellen Marsh'] })).json();
      assert.equal(clear.status, 'clear');
    } finally {
      ofac._setList(null);
    }
  });
});
