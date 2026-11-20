// gate: tests 16
// The EDGAR side of filing (plan 09-05): the file staff upload, one CCC per issuer, the guard that refuses LIVE, TEST
// before LIVE, EDGAR's hours, and the proof that a CCC leaves the server in exactly one place. No filing is made: the
// transport is the staff one (nothing is sent) or a recorded stand-in passed in by code, and the replies in
// fixtures/edgar are hand-made from the SEC's overview and marked unconfirmed. Every CCC here is invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { start, call, raw, seen, formd, realDraft, sampleDraft, issuersOf, orderBody, newKey, recordIssuers, recorded, holdsCode, API, STAFF, KEY, CCCS, EDGAR_FIX, SCHEMA, TODAY } from './filings-kit.mjs';

const DIR = fileURLToPath(EDGAR_FIX);
const ACCESSION = '0009999999-26-000001';
const LIVE_ON = { NODE_ENV: 'production', EDGAR_ALLOW_LIVE: '1' };
const edgarLib = () => import('../filing/edgar.mjs');
const fileOf = (base, id, mode, more = {}) => raw(base, 'GET', `/v1/filings/staff/orders/${id}/file?mode=${mode}`, Object.assign({ token: STAFF, keep: false }, more));
const staffPost = (base, id, what, body) => call(base, 'POST', `/v1/filings/staff/orders/${id}/${what}`, { token: STAFF, body });
const portalStatus = (base, id, key) => call(base, 'POST', `/v1/filings/orders/${id}/status`, { token: API, body: { key } });

/** An order placed and its issuers' CCCs recorded → { id, key, draft }. */
async function ready(base, draft = realDraft(), codes = CCCS, names) {
  const key = newKey();
  const placed = await call(base, 'POST', '/v1/filings/orders', { token: API, body: orderBody({ key, draft }) });
  assert.equal(placed.status, 201);
  await recordIssuers(base, draft, codes, names);
  return { id: placed.json.id, key, draft };
}
/** xmllint with the pinned SEC schema; the test fails, not skips, when xmllint is missing. */
function schemaValid(xml) {
  const dir = mkdtempSync(join(tmpdir(), 'formd-'));
  try {
    const file = join(dir, 'notice.xml');
    writeFileSync(file, xml);
    const r = spawnSync('xmllint', ['--noout', '--schema', fileURLToPath(SCHEMA), file], { encoding: 'utf8' });
    assert.ok(!r.error, 'xmllint is not installed: the staff file cannot be proven against the SEC schema');
    return r.status === 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
/** The CCC written under each CIK of a file: { cik: code }. */
function codesIn(xml) {
  const out = {};
  for (const m of xml.matchAll(/<cik>(\d+)<\/cik>\s*<ccc>([^<]*)<\/ccc>/g)) out[m[1]] = m[2].replace(/&amp;/g, '&');
  return out;
}

test('recorded: every recorded reply says it is hand-made and unconfirmed, and reads as the SEC’s overview draws it', async () => {
  const { readSubmission, readStatus, readOperational } = await edgarLib();
  const names = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
  assert.deepEqual(names, ['operational-closed', 'operational-open', 'status-accepted', 'status-disseminated', 'status-suspended', 'submission-accepted', 'submission-rejected']);
  for (const n of names) {
    const f = recorded(n);
    assert.match(f._source, /Hand-made on \d{4}-\d\d-\d\d from the SEC's Overview of EDGAR APIs/, n);
    assert.match(f._source, /Not recorded from EDGAR/, n);
    assert.equal(f.unconfirmed, true, n);
  }
  assert.deepEqual(readSubmission(recorded('submission-accepted').reply), { ok: true, accession: ACCESSION });
  assert.deepEqual(readSubmission(recorded('submission-rejected').reply), { ok: false, rejected: true, messages: [{ type: 'error', code: '', message: 'not authorized' }] });
  assert.equal(readStatus(recorded('status-accepted').reply).status, 'accepted');
  assert.equal(readStatus(recorded('status-disseminated').reply).status, 'disseminated');
  const suspended = readStatus(recorded('status-suspended').reply);
  assert.equal(suspended.status, 'suspended');
  assert.deepEqual(suspended.messages.map((m) => [m.type, m.code]), [['error', '4'], ['warning', '364']]);
  assert.equal(readOperational(recorded('operational-open').reply).open, true);
  assert.equal(readOperational(recorded('operational-closed').reply).open, false);
  // Anything else is not read as a success.
  assert.deepEqual(readSubmission({ response: 'submitted' }), { ok: false, error: true });
  assert.deepEqual(readStatus({ status: 'filed' }), { error: true });
  assert.equal(readOperational({ status: 'DOWN' }).open, false);
});

test('recorded: a rejected submission and a suspended status store their messages and set suspended; EDGAR closed sends nothing', async () => {
  const { recordedTransport } = await edgarLib();
  const transport = recordedTransport({ submit: ['submission-rejected', 'submission-accepted'], status: 'status-suspended', operational: ['operational-open', 'operational-open', 'operational-closed'] }, DIR);
  await start({ transport }, async (base, server, fetchFn) => {
    const { id, key } = await ready(base);
    const rejected = await staffPost(base, id, 'submit', { mode: 'TEST' });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.json.ok, false);
    assert.equal(rejected.json.rejected, true);
    let st = await portalStatus(base, id, key);
    assert.equal(st.json.formD.status, 'suspended');
    assert.deepEqual(st.json.formD.messages, [{ type: 'error', code: '', message: 'not authorized' }]);

    const suspended = await staffPost(base, id, 'submit', { mode: 'TEST' });
    assert.equal(suspended.status, 200);
    assert.equal(suspended.json.accession, ACCESSION);
    st = await portalStatus(base, id, key);
    assert.equal(st.json.formD.status, 'suspended');
    assert.deepEqual(st.json.formD.messages.map((m) => [m.type, m.code, m.message]), [['error', '4', 'No filer number provided for CIK...'], ['warning', '364', 'Warning only # of securities is...']]);
    assert.ok(!JSON.stringify(server.store.data()).includes('No filer number'), 'EDGAR’s messages are sealed at rest');

    // EDGAR reports itself closed: nothing is handed over, and staff are told when it opens.
    const before = transport.calls.filter((c) => c.op === 'submit').length;
    const closed = await staffPost(base, id, 'submit', { mode: 'TEST' });
    assert.equal(closed.status, 409);
    assert.match(closed.json.error, /not accepting/i);
    assert.equal(transport.calls.filter((c) => c.op === 'submit').length, before);
    assert.equal(fetchFn.calls.length, 0);
  });
  // Outside EDGAR's hours (22:30 Eastern) the recorded route is not even asked.
  const night = recordedTransport({ submit: 'submission-accepted', status: 'status-accepted', operational: 'operational-open' }, DIR);
  await start({ transport: night, now: () => Date.parse('2026-11-20T03:30:00Z') }, async (base) => {
    const { id } = await ready(base);
    const r = await staffPost(base, id, 'submit', { mode: 'TEST' });
    assert.equal(r.status, 409);
    assert.equal(r.json.nextOpen, '2026-11-20T11:00:00.000Z');
    assert.equal(night.calls.length, 0);
  });
});

test('staff file: the TEST file is the stored notice rebuilt on the server with the CCC, the filer contact and EDGAR’s name, and the SEC schema accepts it', async () => {
  await start({}, async (base, server, fetchFn) => {
    const { id, draft } = await ready(base, realDraft(), CCCS, ['MASKED ENTITY 01, L.P.']);
    const cik = draft.primaryIssuer.cik;
    const file = await fileOf(base, id, 'TEST');
    assert.equal(file.status, 200);
    assert.match(file.headers['content-type'], /^application\/xml/);
    assert.match(file.headers['content-disposition'], /^attachment; filename="[\w.-]+\.xml"$/);
    assert.equal(file.headers['cache-control'], 'no-store');
    const xml = file.text;
    assert.ok(xml.startsWith('<?xml version="1.0"?>'));
    assert.ok(xml.includes('<testOrLive>TEST</testOrLive>'));
    assert.deepEqual(codesIn(xml), { [cik]: CCCS[0] });
    for (const part of ['<contactName>Filing Desk</contactName>', '<contactPhoneNumber>212-555-0100</contactPhoneNumber>', '<contactEmailAddress>desk@agent.example</contactEmailAddress>', '<issuerName>MASKED ENTITY 01, L.P.</issuerName>']) assert.ok(xml.includes(part), part);
    for (const tag of ['schemaVersion', 'entityName', 'jurisdictionOfInc', 'edgarPreviousNameList', 'stateOrCountryDescription']) assert.ok(!xml.includes(`<${tag}>`), `${tag} is EDGAR’s to fill`);
    assert.equal(schemaValid(xml), true, 'the SEC schema accepts the file');
    // It is the stored notice, with only the signature's issuer name taken from EDGAR's record.
    const back = formd.fromXml(xml);
    const want = JSON.parse(JSON.stringify(draft));
    want.offeringData.signatureBlock.signature[0].issuerName = 'MASKED ENTITY 01, L.P.';
    assert.deepEqual(back, want);

    const events = server.store.data().events.filter((e) => e.type === 'filing_file_downloaded');
    assert.deepEqual(events.map((e) => [e.order, e.mode]), [[id, 'TEST']]);
    assert.equal(holdsCode(JSON.stringify(server.store.data().events)), -1);

    assert.equal((await fileOf(base, id, 'DRAFT', { keep: true })).status, 400);
    assert.equal((await raw(base, 'GET', '/v1/filings/staff/orders/fil_unknown/file?mode=TEST', { token: STAFF })).status, 404);

    // The staff route sends nothing: the submit call says the file is staff's to upload, and staff record the outcome.
    const sub = await staffPost(base, id, 'submit', { mode: 'TEST' });
    assert.deepEqual(sub.json, { ok: true, pending: 'staff' });
    let opened = await call(base, 'GET', `/v1/filings/staff/orders/${id}`, { token: STAFF });
    assert.equal(opened.json.formD.status, 'in_review');
    assert.deepEqual(opened.json.edgar, { open: true, nextOpen: '' });
    assert.deepEqual(opened.json.issuers, [{ cik, name: 'MASKED ENTITY 01, L.P.', cccOnFile: true }]);
    const out = await staffPost(base, id, 'outcome', { step: 'test', result: 'accepted' });
    assert.equal(out.status, 200);
    opened = await call(base, 'GET', `/v1/filings/staff/orders/${id}`, { token: STAFF });
    assert.equal(opened.json.formD.status, 'test_passed');
    assert.equal(fetchFn.calls.length, 0);
  });
  // With no filer contact in the settings the file is refused: a notice sent without one is suspended.
  await start({ env: { FILINGS_CONTACT_NAME: undefined, FILINGS_CONTACT_PHONE: undefined, FILINGS_CONTACT_EMAIL: undefined } }, async (base) => {
    const { id } = await ready(base);
    const file = await fileOf(base, id, 'TEST', { keep: true });
    assert.equal(file.status, 409);
    assert.ok(file.json.messages.some((m) => /filer contact is missing/.test(m)));
  });
});

test('issuers: one CCC per issuer: a missing one answers 409 naming its CIK, each code sits under its own CIK, and replacing one changes only that element', async () => {
  await start({}, async (base, server, fetchFn) => {
    const draft = sampleDraft();
    const ciks = issuersOf(draft);
    assert.equal(ciks.length, 4);
    assert.deepEqual(formd.validate(draft, { today: TODAY, submission: true }).filter((m) => m.level === 'error'), []);
    const names = ['PRIMARY ISSUER LP', 'FIRST ADDITIONAL LP', 'SECOND ADDITIONAL LP', 'THIRD ADDITIONAL LP'];
    const { id } = await ready(base, draft, [CCCS[0], CCCS[1], null, CCCS[3]], names);

    // One issuer has no CCC on file: the file and the submit call both answer 409 naming that CIK, and no code.
    for (const r of [await fileOf(base, id, 'TEST', { keep: true }), await staffPost(base, id, 'submit', { mode: 'TEST' })]) {
      assert.equal(r.status, 409);
      assert.deepEqual(r.json.missing, [ciks[2]]);
      assert.ok(r.json.error.includes(ciks[2]));
      for (const other of [ciks[0], ciks[1], ciks[3]]) assert.ok(!r.json.error.includes(other));
      assert.equal(holdsCode(r.text), -1);
    }
    const two = await call(base, 'PUT', `/v1/filings/staff/issuers/${ciks[2]}`, { token: STAFF, body: { ccc: CCCS[2], name: names[2] } });
    assert.equal(two.status, 200);

    const first = await fileOf(base, id, 'TEST');
    assert.equal(first.status, 200);
    assert.equal(schemaValid(first.text), true, 'the SEC schema accepts the file');
    assert.deepEqual(codesIn(first.text), { [ciks[0]]: CCCS[0], [ciks[1]]: CCCS[1], [ciks[2]]: CCCS[2], [ciks[3]]: CCCS[3] });
    assert.equal(new Set(Object.values(codesIn(first.text))).size, 4, 'four issuers, four different codes');
    // The signature block names each issuer from that issuer's own staff record.
    assert.deepEqual(Array.from(first.text.matchAll(/<issuerName>([^<]*)<\/issuerName>/g), (m) => m[1]), names);

    // Replacing one issuer's CCC changes that issuer's element and nothing else.
    const fresh = 'Hq2#Zr8$';
    assert.equal((await call(base, 'PUT', `/v1/filings/staff/issuers/${ciks[1]}`, { token: STAFF, body: { ccc: fresh } })).status, 200);
    const second = await fileOf(base, id, 'TEST');
    const a = first.text.split('\n');
    const b = second.text.split('\n');
    assert.equal(a.length, b.length);
    const changed = a.map((line, k) => (line === b[k] ? -1 : k)).filter((k) => k >= 0);
    assert.equal(changed.length, 1);
    assert.equal(b[changed[0]].trim(), `<ccc>${fresh}</ccc>`);
    assert.equal(b[changed[0] - 1].trim(), `<cik>${ciks[1]}</cik>`);
    for (const s of seen) assert.equal(holdsCode(s.text, CCCS.concat(fresh)), -1, `no CCC in the answer of ${s.method} ${s.path}`);
    assert.equal(fetchFn.calls.length, 0);
  });
});

test('guard: LIVE is refused while EDGAR_ALLOW_LIVE is unset, although a test of the notice was accepted', async () => {
  const { recordedTransport } = await edgarLib();
  const transport = recordedTransport({ submit: 'submission-accepted', status: 'status-accepted', operational: 'operational-open' }, DIR);
  await start({ transport, env: { NODE_ENV: 'production' } }, async (base, server, fetchFn) => {
    const { id } = await ready(base);
    assert.equal((await staffPost(base, id, 'submit', { mode: 'TEST' })).json.formD.status, 'test_passed');
    assert.deepEqual((await call(base, 'GET', '/v1/filings', { token: API })).json, { on: true, live: false });
    const file = await fileOf(base, id, 'LIVE', { keep: true });
    assert.equal(file.status, 403);
    assert.match(file.json.error, /EDGAR_ALLOW_LIVE/);
    const sub = await staffPost(base, id, 'submit', { mode: 'LIVE' });
    assert.equal(sub.status, 403);
    assert.match(sub.json.error, /EDGAR_ALLOW_LIVE/);
    assert.deepEqual(transport.calls.filter((c) => c.op === 'submit').map((c) => c.mode), ['TEST']);
    assert.equal(fetchFn.calls.length, 0);
  });
});

test('guard: LIVE is refused when the server runs as a test, even with EDGAR_ALLOW_LIVE=1', async () => {
  const { recordedTransport } = await edgarLib();
  const transport = recordedTransport({ submit: 'submission-accepted', status: 'status-accepted', operational: 'operational-open' }, DIR);
  await start({ transport, env: { NODE_ENV: 'test', EDGAR_ALLOW_LIVE: '1' } }, async (base, server, fetchFn) => {
    const { id } = await ready(base);
    assert.equal((await staffPost(base, id, 'submit', { mode: 'TEST' })).json.formD.status, 'test_passed');
    assert.deepEqual((await call(base, 'GET', '/v1/filings', { token: API })).json, { on: true, live: false });
    const file = await fileOf(base, id, 'LIVE', { keep: true });
    assert.equal(file.status, 403);
    assert.match(file.json.error, /runs as a test/);
    const sub = await staffPost(base, id, 'submit', { mode: 'LIVE' });
    assert.equal(sub.status, 403);
    assert.match(sub.json.error, /runs as a test/);
    assert.deepEqual(transport.calls.filter((c) => c.op === 'submit').map((c) => c.mode), ['TEST']);
    assert.equal(fetchFn.calls.length, 0);
  });
});

test('guard: with EDGAR_ALLOW_LIVE=1 outside tests a LIVE submission goes through the recorded route: submitted, then accepted with its accession number and filed date', async () => {
  const { recordedTransport } = await edgarLib();
  // The status replies, in order: the TEST read, the LIVE read right after submitting (in progress), the later read (complete).
  const transport = recordedTransport({ submit: 'submission-accepted', status: ['status-accepted', 'status-accepted', 'status-disseminated'], operational: 'operational-open' }, DIR);
  await start({ transport, env: LIVE_ON }, async (base, server, fetchFn) => {
    const { id, key } = await ready(base);
    assert.deepEqual((await call(base, 'GET', '/v1/filings', { token: API })).json, { on: true, live: true });
    assert.equal((await staffPost(base, id, 'submit', { mode: 'TEST' })).json.formD.status, 'test_passed');
    const live = await staffPost(base, id, 'submit', { mode: 'LIVE' });
    assert.equal(live.status, 200);
    assert.equal(live.json.formD.status, 'submitted');
    assert.equal(live.json.formD.accession, ACCESSION);
    const sent = transport.calls.filter((c) => c.op === 'submit');
    assert.deepEqual(sent.map((c) => c.mode), ['TEST', 'LIVE']);
    assert.ok(sent[1].xml.includes('<testOrLive>LIVE</testOrLive>'));
    // A second LIVE submission of a notice already with EDGAR is refused.
    assert.equal((await staffPost(base, id, 'submit', { mode: 'LIVE' })).status, 409);

    const opened = await call(base, 'GET', `/v1/filings/staff/orders/${id}`, { token: STAFF });
    assert.equal(opened.json.formD.status, 'accepted');
    assert.equal(opened.json.status, 'done');
    const st = await portalStatus(base, id, key);
    assert.deepEqual([st.json.status, st.json.formD.status, st.json.formD.accession, st.json.formD.filedOn], ['done', 'accepted', ACCESSION, TODAY]);
    assert.equal(transport.calls.filter((c) => c.op === 'submit').length, 2);
    assert.equal(fetchFn.calls.length, 0, 'no outside call was made');
  });
});

test('guard: TEST comes before LIVE: refused until a test of the notice is accepted, and a suspended test keeps it refused', async () => {
  await start({ env: LIVE_ON }, async (base, server, fetchFn) => {
    const { id, key } = await ready(base);
    for (const r of [await fileOf(base, id, 'LIVE', { keep: true }), await staffPost(base, id, 'submit', { mode: 'LIVE' })]) {
      assert.equal(r.status, 409);
      assert.match(r.json.error, /test/i);
    }
    const messages = [{ type: 'error', code: '4', message: 'No filer number provided for CIK' }];
    assert.equal((await staffPost(base, id, 'outcome', { step: 'test', result: 'suspended', messages })).status, 200);
    const st = await portalStatus(base, id, key);
    assert.equal(st.json.formD.status, 'suspended');
    assert.deepEqual(st.json.formD.messages, messages);
    assert.equal((await fileOf(base, id, 'LIVE', { keep: true })).status, 409);
    assert.equal((await staffPost(base, id, 'submit', { mode: 'LIVE' })).status, 409);

    assert.equal((await staffPost(base, id, 'outcome', { step: 'test', result: 'accepted' })).status, 200);
    const file = await fileOf(base, id, 'LIVE');
    assert.equal(file.status, 200);
    assert.ok(file.text.includes('<testOrLive>LIVE</testOrLive>'));
    assert.match(file.headers['content-disposition'], /LIVE\.xml"$/);
    assert.deepEqual(server.store.data().events.filter((e) => e.type === 'filing_file_downloaded').map((e) => e.mode), ['LIVE']);
    assert.equal(fetchFn.calls.length, 0);
  });
});

test('guard: an outcome of live is refused unless a test outcome of accepted is on record and live filing is allowed', async () => {
  const good = { step: 'live', result: 'accepted', accession: ACCESSION, filedOn: TODAY };
  // Live filing allowed, but no accepted test.
  await start({ env: LIVE_ON }, async (base) => {
    const { id, key } = await ready(base);
    assert.equal((await staffPost(base, id, 'outcome', good)).status, 409);
    await staffPost(base, id, 'outcome', { step: 'test', result: 'suspended' });
    const r = await staffPost(base, id, 'outcome', good);
    assert.equal(r.status, 409);
    assert.match(r.json.error, /test/i);
    assert.equal((await portalStatus(base, id, key)).json.formD.status, 'suspended');
  });
  // An accepted test, but live filing not allowed: the setting unset, and a server that runs as a test.
  for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'test', EDGAR_ALLOW_LIVE: '1' }]) {
    await start({ env }, async (base) => {
      const { id, key } = await ready(base);
      assert.equal((await staffPost(base, id, 'outcome', { step: 'test', result: 'accepted' })).status, 200);
      const r = await staffPost(base, id, 'outcome', good);
      assert.equal(r.status, 409);
      const st = (await portalStatus(base, id, key)).json;
      assert.deepEqual([st.status, st.formD.status, st.formD.accession], ['received', 'test_passed', '']);
    });
  }
});

test('guard: an accepted live outcome needs an accession number in EDGAR’s form and a filed date not in the future', async () => {
  await start({ env: LIVE_ON }, async (base, server, fetchFn) => {
    const { id, key } = await ready(base);
    await staffPost(base, id, 'outcome', { step: 'test', result: 'accepted' });
    const bad = [
      { accession: '9999999-26-1', filedOn: TODAY },
      { accession: '000999999926000001', filedOn: TODAY },
      { accession: '', filedOn: TODAY },
      { accession: ACCESSION, filedOn: '2026-11-21' },
      { accession: ACCESSION, filedOn: '2026-02-30' },
      { accession: ACCESSION, filedOn: '' }
    ];
    for (const b of bad) {
      const r = await staffPost(base, id, 'outcome', Object.assign({ step: 'live', result: 'accepted' }, b));
      assert.equal(r.status, 400, JSON.stringify(b));
    }
    assert.equal((await portalStatus(base, id, key)).json.formD.status, 'test_passed');
    const ok = await staffPost(base, id, 'outcome', { step: 'live', result: 'accepted', accession: ACCESSION, filedOn: '2026-11-19' });
    assert.equal(ok.status, 200);
    const st = (await portalStatus(base, id, key)).json;
    assert.deepEqual([st.status, st.formD.status, st.formD.accession, st.formD.filedOn], ['done', 'accepted', ACCESSION, '2026-11-19']);
    // A filed order takes no further outcome.
    assert.equal((await staffPost(base, id, 'outcome', { step: 'test', result: 'suspended' })).status, 409);
    assert.equal(fetchFn.calls.length, 0);
  });
});

test('guard: any EDGAR_TRANSPORT other than staff leaves the module off, with the reason', async () => {
  for (const value of ['api', 'recorded', 'fixture']) {
    await start({ env: { EDGAR_TRANSPORT: value } }, async (base) => {
      const on = await call(base, 'GET', '/v1/filings', { token: API });
      assert.equal(on.status, 200);
      assert.equal(on.json.on, false);
      assert.match(on.json.reason, /EDGAR_TRANSPORT/);
      assert.equal((await call(base, 'POST', '/v1/filings/orders', { token: API, body: orderBody() })).status, 404);
      assert.equal((await call(base, 'GET', '/v1/filings/staff/orders', { token: STAFF })).status, 404);
    });
  }
  await start({ env: { EDGAR_TRANSPORT: 'staff' } }, async (base) => {
    assert.equal((await call(base, 'GET', '/v1/filings', { token: API })).json.on, true);
  });
});

test('guard: the connector itself refuses LIVE, and a file whose own TEST or LIVE line differs from the mode asked for', async () => {
  const { makeEdgar, recordedTransport } = await edgarLib();
  const live = '<?xml version="1.0"?>\n<edgarSubmission>\n    <testOrLive>LIVE</testOrLive>\n</edgarSubmission>\n';
  const tested = live.replace('LIVE', 'TEST');
  const at = () => Date.parse('2026-11-20T15:00:00Z');
  const make = (env) => {
    const transport = recordedTransport({ submit: 'submission-accepted', status: 'status-accepted', operational: 'operational-open' }, DIR);
    return { transport, edgar: makeEdgar({ transport, env, now: at }) };
  };
  for (const env of [{}, { NODE_ENV: 'test', EDGAR_ALLOW_LIVE: '1' }, { NODE_ENV: 'production' }, { NODE_ENV: 'production', EDGAR_ALLOW_LIVE: 'true' }]) {
    const { transport, edgar } = make(env);
    assert.equal(edgar.allowLive().ok, false);
    const r = await edgar.submit({ xml: live, mode: 'LIVE', filerCik: '1' });
    assert.deepEqual([r.ok, r.refused], [false, true]);
    assert.equal(transport.calls.length, 0, 'nothing reached the transport');
  }
  const { transport, edgar } = make({ NODE_ENV: 'production', EDGAR_ALLOW_LIVE: '1' });
  assert.equal(edgar.allowLive().ok, true);
  // A LIVE file can never ride on a TEST call, nor a TEST file on a LIVE call, nor a file with no line at all.
  for (const [xml, mode] of [[live, 'TEST'], [tested, 'LIVE'], ['<edgarSubmission></edgarSubmission>', 'TEST'], [live, 'live']]) {
    const r = await edgar.submit({ xml, mode, filerCik: '1' });
    assert.deepEqual([r.ok, r.refused], [false, true]);
  }
  assert.equal(transport.calls.filter((c) => c.op === 'submit').length, 0);
  assert.equal((await edgar.submit({ xml: tested, mode: 'TEST', filerCik: '1' })).ok, true);
  // A transport that throws is answered without its error's text.
  const broken = makeEdgar({ transport: { name: 'broken', submit: async ({ xml }) => { throw new Error(`refused ${xml}`); }, status: async () => { throw new Error('no'); } }, env: {}, now: at });
  assert.deepEqual(await broken.submit({ xml: tested, mode: 'TEST', filerCik: '1' }), { ok: false, error: true });
  assert.deepEqual(await broken.status({ accession: ACCESSION }), { error: true });
});

test('hours: closed at 22:30 Eastern, on a Saturday and on a federal holiday, opening at 06:00 Eastern on the next business day; open at 09:00, winter and summer', async () => {
  const { makeEdgar } = await edgarLib();
  const lib = createRequire(import.meta.url)('../../assets/js/filings.js');
  const edgar = makeEdgar({ env: {}, holidays: lib.holidays });
  const at = (isoTime) => edgar.openAt(Date.parse(isoTime));
  // Winter (Eastern is UTC-5).
  assert.deepEqual(at('2026-11-20T14:00:00Z'), { open: true, nextOpen: '' }); // Friday 09:00
  assert.deepEqual(at('2026-11-20T11:00:00Z'), { open: true, nextOpen: '' }); // 06:00 exactly
  assert.deepEqual(at('2026-11-20T10:59:00Z'), { open: false, nextOpen: '2026-11-20T11:00:00.000Z' }); // 05:59: opens today
  assert.deepEqual(at('2026-11-20T03:30:00Z'), { open: false, nextOpen: '2026-11-20T11:00:00.000Z' }); // Thursday 22:30
  assert.deepEqual(at('2026-11-21T03:00:00Z'), { open: false, nextOpen: '2026-11-23T11:00:00.000Z' }); // Friday 22:00 exactly: Monday
  assert.deepEqual(at('2026-11-21T15:00:00Z'), { open: false, nextOpen: '2026-11-23T11:00:00.000Z' }); // Saturday
  assert.deepEqual(at('2026-11-26T15:00:00Z'), { open: false, nextOpen: '2026-11-27T11:00:00.000Z' }); // Thanksgiving Day
  // Summer (Eastern is UTC-4).
  assert.deepEqual(at('2026-07-01T13:00:00Z'), { open: true, nextOpen: '' }); // Wednesday 09:00
  assert.deepEqual(at('2026-07-02T02:30:00Z'), { open: false, nextOpen: '2026-07-02T10:00:00.000Z' }); // Wednesday 22:30
  assert.deepEqual(at('2026-07-03T14:00:00Z'), { open: false, nextOpen: '2026-07-06T10:00:00.000Z' }); // Independence Day observed, a Friday
  assert.deepEqual(at('2026-07-05T14:00:00Z'), { open: false, nextOpen: '2026-07-06T10:00:00.000Z' }); // Sunday
  // The night the clocks go back: Friday 30 October 22:30 EDT opens Monday 2 November at 06:00 EST.
  assert.deepEqual(at('2026-10-31T02:30:00Z'), { open: false, nextOpen: '2026-11-02T11:00:00.000Z' });
});

test('ccc: a CCC is exactly eight characters, is stored only sealed, and is refused where it could not be sealed', async () => {
  await start({}, async (base, server) => {
    const put = (body, cik = '1234567') => call(base, 'PUT', `/v1/filings/staff/issuers/${cik}`, { token: STAFF, body });
    for (const ccc of [CCCS[0].slice(0, 7), `${CCCS[0]}x`, 'ab cd#12', '', 12345678, null]) {
      const r = await put({ ccc, name: 'AN ISSUER LP' });
      assert.equal(r.status, 400);
      assert.equal(r.json.error, 'The CCC must be exactly 8 characters');
    }
    assert.equal((await put({ ccc: CCCS[0] })).status, 400, 'the first record needs EDGAR’s name for the issuer');
    assert.equal((await put({ ccc: CCCS[0], name: 'AN ISSUER LP' })).status, 200);
    assert.equal((await put({ name: 'AN ISSUER, L.P.' })).status, 200, 'the name can be corrected without the code');
    assert.equal((await put({ ccc: CCCS[1], name: 'x' }, '12345678901')).status, 404, 'a CIK has at most ten digits');
    const rec = server.store.data().filingIssuers['1234567'];
    assert.equal(rec.name, 'AN ISSUER, L.P.');
    assert.deepEqual(Object.keys(rec.ccc).sort(), ['data', 'iv', 'kid', 'tag', 'v']);
    assert.equal(holdsCode(JSON.stringify(server.store.data())), -1);
    for (const s of seen) assert.equal(holdsCode(s.text), -1);
  });
  // No DATA_KEY: a CCC is never stored unsealed, also on a test server and also where plain storage is allowed.
  for (const env of [{ DATA_KEY: undefined }, { DATA_KEY: undefined, ALLOW_PLAINTEXT_STORE: '1', NODE_ENV: 'production' }]) {
    await start({ env }, async (base, server) => {
      const r = await call(base, 'PUT', '/v1/filings/staff/issuers/1234567', { token: STAFF, body: { ccc: CCCS[0], name: 'AN ISSUER LP' } });
      assert.equal(r.status, 400);
      assert.match(r.json.error, /DATA_KEY/);
      assert.deepEqual(server.store.data().filingIssuers, {});
    });
  }
  // No DATA_KEY outside tests: an order is refused too, as invitations are.
  await start({ env: { DATA_KEY: undefined, NODE_ENV: 'production' } }, async (base, server) => {
    const r = await call(base, 'POST', '/v1/filings/orders', { token: API, body: orderBody() });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /DATA_KEY/);
    assert.deepEqual(server.store.data().filings, {});
  });
});

test('ccc: a CCC is in no answer, no stored field, no event, no outbox message and no log line: only in the staff file and the text handed to the transport', async () => {
  const { recordedTransport } = await edgarLib();
  const lines = [];
  const kept = { log: console.log, error: console.error, warn: console.warn };
  for (const k of Object.keys(kept)) console[k] = (...args) => lines.push(args.map((a) => (a instanceof Error ? `${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  const fileText = [];
  const clean = (text, what) => {
    assert.equal(holdsCode(text), -1, `a CCC is in ${what}`);
    for (const part of fileText) assert.ok(!String(text).includes(part), `the file text is in ${what}`);
  };
  try {
    // 1. A test server and the recorded route: every call the module has, the refusals included.
    const transport = recordedTransport({ submit: 'submission-accepted', status: 'status-accepted', operational: 'operational-open' }, DIR);
    await start({ transport, env: { ADMIN_TOKEN: 'operator-admin-token-0123456789' } }, async (base, server) => {
      const draft = sampleDraft();
      const ciks = issuersOf(draft);
      const { id, key } = await ready(base, draft, CCCS);
      const file = await fileOf(base, id, 'TEST');
      assert.equal(file.status, 200);
      assert.deepEqual(Object.values(codesIn(file.text)), CCCS, 'the staff file is where the codes are');
      fileText.push(file.text, file.text.split('\n').find((l) => l.includes('<ccc>')).trim());

      await call(base, 'GET', '/v1/filings', { token: API });
      await call(base, 'GET', '/v1/filings/staff/orders', { token: STAFF });
      await call(base, 'GET', '/v1/filings/staff/orders?status=received', { token: STAFF });
      await call(base, 'GET', `/v1/filings/staff/orders/${id}`, { token: STAFF });
      await call(base, 'PUT', `/v1/filings/staff/issuers/${ciks[0]}`, { token: STAFF, body: { ccc: `${CCCS[0]}9`, name: 'x' } });
      await call(base, 'PUT', `/v1/filings/staff/issuers/${ciks[0]}`, { token: STAFF, body: `{"ccc":"${CCCS[0]}",` });
      await call(base, 'PUT', `/v1/filings/staff/issuers/${ciks[0]}`, { token: 'wrong', body: { ccc: CCCS[0], name: 'x' } });
      await staffPost(base, id, 'submit', { mode: 'TEST' });
      await staffPost(base, id, 'submit', { mode: 'LIVE' });
      await staffPost(base, id, 'submit', { mode: CCCS[1] });
      await staffPost(base, id, 'outcome', { step: 'test', result: 'suspended', messages: [{ type: 'error', code: '1', message: 'CIK and CCC do not match' }] });
      await staffPost(base, id, 'outcome', { step: 'live', result: 'accepted', accession: ACCESSION, filedOn: TODAY });
      await fileOf(base, id, 'LIVE', { keep: true });
      await fileOf(base, id, 'TEST', { keep: true, headers: { Origin: 'https://portal.example' } });
      await portalStatus(base, id, key);
      await portalStatus(base, id, newKey());
      await call(base, 'POST', '/v1/filings/orders', { token: API, body: orderBody({ draft: Object.assign(sampleDraft(), { ccc: CCCS[2] }), clientId: 'fo-2' }) });
      await call(base, 'GET', '/v1/outbox', { token: API });
      await call(base, 'GET', '/v1/admin/accounts', { token: 'operator-admin-token-0123456789' });
      await call(base, 'GET', '/v1/filings/nothing', { token: API });
      await call(base, 'GET', '/health');
      assert.ok(seen.length >= 25, `${seen.length} answers searched`);
      for (const s of seen) clean(s.text, `the answer of ${s.method} ${s.path}`);
      clean(JSON.stringify(server.store.data()), 'the stored file');
      clean(JSON.stringify(server.store.data().events), 'an event');
      clean(JSON.stringify(server.invitations.mailer.outbox({})), 'an outbox message');
      assert.ok(transport.calls.some((c) => c.op === 'submit' && Object.values(codesIn(c.xml)).length === 4), 'the transport was handed the file');
    });

    // 2. Not a test server, and a transport that throws with the file text in its error.
    const answers = [];
    const throwing = {
      name: 'throwing',
      operational: async () => ({ open: true }),
      submit: async ({ xml }) => {
        fileText.push(xml);
        throw new Error(`EDGAR refused the connection while sending ${xml}`);
      },
      status: async () => {
        throw new Error('down');
      }
    };
    await start({ transport: throwing, env: { NODE_ENV: 'production', EDGAR_ALLOW_LIVE: '1' } }, async (base, server) => {
      const { id, key } = await ready(base, sampleDraft(), CCCS);
      const sub = await staffPost(base, id, 'submit', { mode: 'TEST' });
      assert.equal(sub.status, 502);
      assert.match(sub.json.error, /could not be reached/);
      await staffPost(base, id, 'outcome', { step: 'test', result: 'accepted' });
      const live = await staffPost(base, id, 'submit', { mode: 'LIVE' });
      assert.equal(live.status, 502);
      assert.equal((await portalStatus(base, id, key)).json.formD.status, 'test_passed', 'a failed hand-over changes nothing');
      answers.push(...seen);
      for (const s of seen) clean(s.text, `the answer of ${s.method} ${s.path}`);
      clean(JSON.stringify(server.store.data()), 'the stored file');
      clean(JSON.stringify(server.invitations.mailer.outbox({})), 'an outbox message');
    });
    assert.ok(answers.length >= 8);

    // 3. An error nobody planned for, whose text holds a CCC and the file: it is answered in fixed words, and its text
    // is not logged, stored or sent.
    const { openStore } = await import('../lib/store.mjs');
    const store = openStore(null);
    const event = store.event;
    store.event = (e) => {
      if (e.type === 'filing_file_downloaded') throw new Error(`the disk is full: ${CCCS[0]} ${fileText[0]}`);
      return event(e);
    };
    await start({ store, env: { NODE_ENV: 'production' } }, async (base, server) => {
      const { id } = await ready(base, sampleDraft(), CCCS);
      const r = await fileOf(base, id, 'TEST', { keep: true });
      assert.equal(r.status, 500);
      assert.deepEqual(r.json, { error: 'The filing service could not complete this request' });
      assert.deepEqual(server.store.data().events.filter((e) => e.type === 'filing_error'), [{ at: server.store.data().events.find((e) => e.type === 'filing_error').at, type: 'filing_error' }]);
      for (const s of seen) clean(s.text, `the answer of ${s.method} ${s.path}`);
      clean(JSON.stringify(server.store.data()), 'the stored file');
    });
    assert.ok(fileText.length >= 4, 'the throwing transport was handed the file');
  } finally {
    Object.assign(console, kept);
  }
  for (const line of lines) clean(line, 'a log line');
});

test('ccc: the staff file call answers 403 to anything a browser page sends, and to nothing else', async () => {
  await start({}, async (base, server, fetchFn) => {
    const { id } = await ready(base);
    const path = `/v1/filings/staff/orders/${id}/file?mode=TEST`;
    for (const headers of [{ Origin: 'https://portal.example' }, { Origin: 'null' }, { 'Sec-Fetch-Mode': 'cors' }, { 'Sec-Fetch-Mode': 'navigate' }, { 'Sec-Fetch-Mode': 'no-cors', Origin: base }]) {
      const r = await raw(base, 'GET', path, { token: STAFF, headers });
      assert.equal(r.status, 403, JSON.stringify(headers));
      assert.equal(holdsCode(r.text), -1);
      assert.ok(!r.text.includes('<edgarSubmission'));
    }
    // fetch, which is what a page uses, adds Sec-Fetch-Mode itself.
    const viaFetch = await call(base, 'GET', path, { token: STAFF });
    assert.equal(viaFetch.status, 403);
    assert.equal(holdsCode(viaFetch.text), -1);
    assert.deepEqual(server.store.data().events.filter((e) => e.type === 'filing_file_downloaded'), []);
    // A command-line call with the staff token gets the file; without the token, nothing.
    assert.equal((await raw(base, 'GET', path, { keep: true })).status, 401);
    assert.equal((await raw(base, 'GET', path, { token: API, keep: true })).status, 401);
    const ok = await raw(base, 'GET', path, { token: STAFF, keep: false });
    assert.equal(ok.status, 200);
    assert.equal(holdsCode(ok.text), 0);
    assert.equal(fetchFn.calls.length, 0);
  });
});
