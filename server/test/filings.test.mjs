// gate: tests 1
// Filing orders on the server (plan 09-05): a portal places an order, staff are emailed and work it with their own token,
// the issuer's CCC is kept sealed, and the notice is rebuilt and checked on the server. Nothing here files anything: the
// EDGAR transport is a recorded stand-in passed in by code, and every test asserts the fetch stand-in recorded no call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, call, seen, realDraft, orderBody, newKey, holdsCode, API, STAFF, STAFF_EMAIL, CCCS } from './filings-kit.mjs';

const ACCESSION = '0009999999-26-000001';

test('tracer: a Form D order is received, emailed to staff, its CCC sealed, tested through the recorded route and read back by its portal; LIVE is refused', async () => {
  const { recordedTransport } = await import('../filing/edgar.mjs');
  // Shaped from the SEC's Overview of EDGAR APIs, figures B, C and E (hand-made, not recorded from EDGAR).
  const transport = recordedTransport({ submit: { response: 'submitted', 'accession number': ACCESSION }, status: { status: 'accepted', 'accession number': ACCESSION }, operational: { status: 'ACCEPTING SUBMISSIONS' } });
  await start({ transport }, async (base, server, fetchFn) => {
    const draft = realDraft();
    const cik = draft.primaryIssuer.cik;
    const key = newKey();
    const person = draft.relatedPersonsList[0].relatedPersonName.lastName;

    const placed = await call(base, 'POST', '/v1/filings/orders', { token: API, body: orderBody({ key, draft, dueCents: 1, lines: [{ label: 'Free', cents: 0 }] }) });
    assert.equal(placed.status, 201);
    const id = placed.json.id;
    assert.match(id, /^fil_[\w-]+$/);
    assert.equal(placed.json.status, 'received');
    assert.equal(placed.json.dueCents, 10000);
    assert.equal(placed.json.openFees, false);
    assert.deepEqual(placed.json.lines.map((l) => l.cents), [10000]);

    // One message to the staff address: the order, the firm, the offering and the amount; nobody's name from the notice.
    const mail = server.invitations.mailer.outbox({}).filter((m) => m.kind === 'filing_order');
    assert.equal(mail.length, 1);
    assert.equal(mail[0].to, STAFF_EMAIL);
    assert.equal(mail[0].workspace, '');
    for (const part of [id, 'Harbor Ridge Partners', 'Harbor Ridge Fund I', '$100']) assert.ok(mail[0].text.includes(part), `the staff email names ${part}`);
    for (const p of draft.relatedPersonsList) assert.ok(!mail[0].text.includes(p.relatedPersonName.lastName), 'no related person is named in the email');

    // Staff list and open the order with their own token.
    const list = await call(base, 'GET', '/v1/filings/staff/orders', { token: STAFF });
    assert.equal(list.status, 200);
    assert.deepEqual(list.json.map((o) => [o.id, o.kind, o.status, o.dueCents, o.firm.name, o.offering.name]), [[id, 'formd', 'received', 10000, 'Harbor Ridge Partners', 'Harbor Ridge Fund I']]);
    const opened = await call(base, 'GET', `/v1/filings/staff/orders/${id}`, { token: STAFF });
    assert.equal(opened.status, 200);
    assert.deepEqual(opened.json.notice, draft);
    assert.equal(opened.json.signoff.name, 'Dana Whitlock');
    assert.equal(opened.json.formD.status, 'in_review');

    // Staff record the issuer's CCC and EDGAR's version of its name; the answer does not repeat the code.
    const put = await call(base, 'PUT', `/v1/filings/staff/issuers/${cik}`, { token: STAFF, body: { ccc: CCCS[0], name: 'HARBOR RIDGE FUND I LP' } });
    assert.equal(put.status, 200);
    assert.deepEqual(put.json, { ok: true });

    // A TEST submission through the recorded transport: the file is rebuilt on the server with the CCC under its CIK.
    const sub = await call(base, 'POST', `/v1/filings/staff/orders/${id}/submit`, { token: STAFF, body: { mode: 'TEST' } });
    assert.equal(sub.status, 200);
    const sent = transport.calls.filter((c) => c.op === 'submit');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].mode, 'TEST');
    assert.ok(sent[0].xml.includes('<testOrLive>TEST</testOrLive>'));
    assert.ok(new RegExp(`<cik>${cik}</cik>\\s*<ccc>[^<]{8}</ccc>`).test(sent[0].xml), 'the CCC sits under its CIK in the file handed to the transport');
    assert.ok(sent[0].xml.includes('<issuerName>HARBOR RIDGE FUND I LP</issuerName>'), "the signature block carries EDGAR's version of the name");

    // The portal reads the status with the key it chose.
    const status = await call(base, 'POST', `/v1/filings/orders/${id}/status`, { token: API, body: { key } });
    assert.equal(status.status, 200);
    assert.equal(status.json.formD.status, 'test_passed');
    assert.equal(status.json.dueCents, 10000);

    // LIVE is refused: this server runs as a test.
    const live = await call(base, 'POST', `/v1/filings/staff/orders/${id}/submit`, { token: STAFF, body: { mode: 'LIVE' } });
    assert.equal(live.status, 403);
    assert.match(live.json.error, /test/i);
    assert.equal(transport.calls.filter((c) => c.op === 'submit').length, 1, 'nothing more was handed to the transport');

    // At rest: the notice and the CCC only sealed, the key only as a hash.
    const stored = JSON.stringify(server.store.data());
    assert.equal(holdsCode(stored), -1, 'no CCC in the stored file');
    assert.ok(!stored.includes(person), 'the notice is sealed');
    assert.ok(!stored.includes(key), 'the key is stored only as a hash');
    for (const s of seen) assert.equal(holdsCode(s.text), -1, `no CCC in the answer of ${s.method} ${s.path}`);
    assert.equal(fetchFn.calls.length, 0, 'no outside call was made');
  });
});
