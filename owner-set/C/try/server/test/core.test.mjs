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

test('OFAC screening through the API: SDN and Consolidated lists, alternate names, User-Agent', () => {
  ofac._setList(null);
  const files = {
    'SDN.CSV': '10001,"VOLKOV, Dmitri Sergeyevich","individual","RUSSIA-EO14024",-0-,-0-,-0-,-0-,-0-,-0-,-0-,"DOB 01 Jan 1970"\r\n10002,"OCEANIC TRADING LLC","-0-","SDGT",-0-,-0-,-0-,-0-,-0-,-0-,-0-,-0-\r\n',
    'ALT.CSV': '10001,501,"aka","VOLKOV, Dmitry",-0-\r\n',
    'CONS_PRIM.CSV': '20001,"KASPIAN SHIPPING COMPANY","-0-","SSI",-0-,-0-,-0-,-0-,-0-,-0-,-0-,-0-\r\n',
    'CONS_ALT.CSV': ''
  };
  const agents = [];
  const fetchImpl = async (url, init) => {
    agents.push(((init || {}).headers || {})['User-Agent']);
    const f = String(url).split('/').pop();
    return f in files ? { ok: true, status: 200, text: async () => files[f] } : { ok: false, status: 404, text: async () => '' };
  };
  return withServer({}, fetchImpl, async (base) => {
    try {
      const r = await (await post(`${base}/v1/screenings`, { provider: 'ofac', investor: { id: 'B-2' }, names: ['Dmitry Volkov', 'Ellen Marsh', 'Oceanic Trading, L.L.C.', 'Kaspian Shipping Co.'] })).json();
      assert.equal(r.status, 'potential_match');
      assert.deepEqual(r.hits.map((x) => x.name).sort(), ['Dmitry Volkov', 'Kaspian Shipping Co.', 'Oceanic Trading, L.L.C.']);
      assert.equal(r.hits.find((x) => x.name === 'Kaspian Shipping Co.').list, 'OFAC Consolidated (non-SDN)');
      assert.ok(r.hits.filter((x) => x.name !== 'Kaspian Shipping Co.').every((x) => x.list === 'OFAC SDN' && x.score >= 0.9));
      assert.ok(agents.length >= 2 && agents.every((a) => typeof a === 'string' && a.length > 3), 'every list download sends a User-Agent');
      const clear = await (await post(`${base}/v1/screenings`, { provider: 'ofac', names: ['Ellen Marsh'] })).json();
      assert.equal(clear.status, 'clear');
      const again = await (await fetch(`${base}/v1/screenings/${clear.id}`)).json();
      assert.equal(again.status, 'clear');
    } finally {
      ofac._setList(null);
    }
  });
});

/* ---------- The generic adapter hooks, exercised with a fake provider ---------- */
function fakeProvider(calls) {
  return {
    kind: 'accreditation',
    env: [],
    async createSession(ctx) {
      calls.push(['create', ctx.returnUrl, ctx.hostedUrl, ctx.reference]);
      return { ref: 'fk_1', url: ctx.hostedUrl, data: { secretToken: 'tok-123' } };
    },
    async fetchResult(ctx) {
      calls.push(['fetch', ctx.ref, ctx.data.secretToken]);
      return ctx.data.reviewed ? { status: 'verified', method: 'Income', expiresAt: '2027-02-01', evidence: [{ type: 'letter', label: 'Verification letter' }] } : { status: 'pending' };
    },
    page: (rec) => `<!doctype html><title>Fake</title><p>Hosted ${rec.id}</p>`,
    async hostedPost(ctx) {
      calls.push(['post', ctx.form.answer]);
      return ctx.form.answer === 'go' ? { redirect: 'https://provider.example/flow/abc', data: { started: true } } : { status: 'banana' };
    },
    async handleReturn(ctx) {
      calls.push(['return', ctx.query.code]);
      return { data: { reviewed: ctx.query.code === 'ok' }, message: 'Back from the provider' };
    },
    fetchEvidence: async (ctx) => ({ body: Buffer.from(`%PDF-1.4 ${ctx.item.label}`), contentType: 'application/pdf', fileName: 'letter.pdf' }),
    verifyWebhook: ({ headers }) => headers['x-fake-sig'] === 'good',
    parseWebhook: ({ body }) => ({ id: body.delivery, ref: body.ref, event: body.event, refetch: body.event === 'changed', status: body.status })
  };
}

test('adapter hooks: hosted page, return URL, private data, refetch webhooks, de-duplication', async () => {
  const { PROVIDERS } = await import('../providers/index.mjs');
  const calls = [];
  PROVIDERS.fake = fakeProvider(calls);
  try {
    await withServer({ PORTAL_ORIGIN: 'https://portal.example' }, undefined, async (base) => {
      const created = await (await post(`${base}/v1/verifications`, { kind: 'accreditation', provider: 'fake', investor: { id: 'A-9', name: 'Ann Lee' }, returnUrl: 'https://portal.example/diy.html#account' })).json();
      assert.equal(created.url, `http://verify.test/hosted/${created.id}`);
      assert.equal(calls[0][1], `http://verify.test/return/fake/${created.id}`);
      // The portal never sees adapter-private data.
      const st = await (await fetch(`${base}/v1/verifications/${created.id}`)).json();
      assert.equal(st.status, 'pending');
      assert.ok(!JSON.stringify(st).includes('tok-123'));
      assert.ok(calls.some((c) => c[0] === 'fetch' && c[2] === 'tok-123'), 'fetchResult receives the private data');
      // The hosted page and its form.
      assert.match(await (await fetch(`${base}/hosted/${created.id}`)).text(), new RegExp(`Hosted ${created.id}`));
      const go = await fetch(`${base}/hosted/${created.id}`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'answer=go' });
      assert.equal(go.status, 302);
      assert.equal(go.headers.get('location'), 'https://provider.example/flow/abc');
      // A status the portal would not understand is ignored.
      await fetch(`${base}/hosted/${created.id}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'answer=x' });
      assert.equal((await (await fetch(`${base}/v1/verifications/${created.id}`)).json()).status, 'pending');
      // The investor comes back from the provider; the done page links back to the portal.
      const back = await fetch(`${base}/return/fake/${created.id}?code=ok`);
      const html = await back.text();
      assert.match(html, /Back from the provider/);
      assert.match(html, /href="https:\/\/portal\.example\/diy\.html#account"/);
      assert.equal((await fetch(`${base}/return/sandbox/${created.id}`)).status, 404, 'a return URL only works for its own provider');
      // An unsigned webhook is refused; a signed "changed" webhook re-reads the result through the API.
      assert.equal((await post(`${base}/webhooks/fake`, { delivery: 'd1', ref: 'fk_1', event: 'changed' })).status, 401);
      assert.equal((await post(`${base}/webhooks/fake`, { delivery: 'd1', ref: 'fk_1', event: 'changed' }, { 'x-fake-sig': 'good' })).status, 200);
      const done = await (await fetch(`${base}/v1/verifications/${created.id}`)).json();
      assert.equal(done.status, 'verified');
      assert.equal(done.expiresAt, '2027-02-01');
      assert.equal(done.method, 'Income');
      assert.equal(done.evidence[0].label, 'Verification letter');
      // Evidence is fetched through the server, which holds the provider credentials.
      const pdf = await fetch(`${base}/v1/verifications/${created.id}/evidence/0`);
      assert.equal(pdf.headers.get('content-type'), 'application/pdf');
      assert.equal(await pdf.text(), '%PDF-1.4 Verification letter');
      assert.equal((await fetch(`${base}/v1/verifications/${created.id}/evidence/5`)).status, 404);
      // A repeated delivery is acknowledged and ignored.
      const dup = await (await post(`${base}/webhooks/fake`, { delivery: 'd1', ref: 'fk_1', event: 'status', status: 'rejected' }, { 'x-fake-sig': 'good' })).json();
      assert.equal(dup.duplicate, true);
      assert.equal((await (await fetch(`${base}/v1/verifications/${created.id}`)).json()).status, 'verified');
      // Providers that accept only one registered redirect URL send our id back in "state".
      const fixed = await (await post(`${base}/v1/verifications`, { kind: 'accreditation', provider: 'fake', investor: { id: 'A-9', name: 'Ann Lee' } })).json();
      assert.match(await (await fetch(`${base}/return/fake?state=${fixed.id}&code=ok`)).text(), /Back from the provider/);
      assert.equal((await fetch(`${base}/return/fake?state=nope`)).status, 404);
      // A return URL outside the portal's origin is dropped.
      const other = await (await post(`${base}/v1/verifications`, { kind: 'accreditation', provider: 'fake', investor: { id: 'A-9', name: 'Ann Lee' }, returnUrl: 'https://evil.example/' })).json();
      const html2 = await (await fetch(`${base}/return/fake/${other.id}?code=no`)).text();
      assert.ok(!html2.includes('evil.example'));
    });
  } finally {
    delete PROVIDERS.fake;
  }
});

test('rate limit on calls that start checks', () =>
  withServer({ RATE_LIMIT_PER_MIN: '3' }, undefined, async (base) => {
    const body = { kind: 'identity', provider: 'sandbox', investor: { id: 'A-1', name: 'Ann Lee' } };
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await post(`${base}/v1/verifications`, body)).status);
    assert.deepEqual(codes, [200, 200, 200, 429, 429]);
    assert.equal((await fetch(`${base}/health`)).status, 200, 'reads are not limited');
  }));
