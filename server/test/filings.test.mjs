// gate: tests 11
// Filing orders on the server (plan 09-05): a portal places an order, staff are emailed and work it with their own token,
// the issuer's CCC is kept sealed, and the notice is rebuilt and checked on the server. Nothing here files anything: the
// EDGAR transport is a recorded stand-in passed in by code, and every test asserts the fetch stand-in recorded no call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { start, call, raw, seen, realDraft, orderBody, newKey, holdsCode, recordIssuers, account, invitationToken, statePackage, API, STAFF, ADMIN, RESULTS, KEY, STAFF_EMAIL, CCCS, TODAY } from './filings-kit.mjs';
import { openStore } from '../lib/store.mjs';

const ACCESSION = '0009999999-26-000001';
const NOT_FOUND = { error: 'Not found' };
const sha = (x) => createHash('sha256').update(x).digest('hex');
const copy = (x) => JSON.parse(JSON.stringify(x));
const place = (base, body, token = API) => call(base, 'POST', '/v1/filings/orders', { token, body });
const statusOf = (base, id, key, token = API) => call(base, 'POST', `/v1/filings/orders/${id}/status`, { token, body: key === undefined ? {} : { key } });
const opened = (base, id) => call(base, 'GET', `/v1/filings/staff/orders/${id}`, { token: STAFF });
const outcome = (base, id, body) => call(base, 'POST', `/v1/filings/staff/orders/${id}/outcome`, { token: STAFF, body });
const fileOf = (base, id, mode) => raw(base, 'GET', `/v1/filings/staff/orders/${id}/file?mode=${mode}`, { token: STAFF, keep: false });
const orderMail = (server) => server.invitations.mailer.outbox({}).filter((m) => m.kind === 'filing_order');
/** A notice changed in one answer that the rule table does not mind. */
const corrected = (draft, note) => {
  const d = copy(draft);
  d.offeringData.offeringSalesAmounts.clarificationOfResponse = note;
  return d;
};

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

test('pinned: an order placed with one sponsor account’s token cannot be read or replaced with another’s, and the body’s workspace is ignored', async () => {
  await start({ env: { ADMIN_TOKEN: ADMIN } }, async (base, server, fetchFn) => {
    const alpha = await account(base, 'alpha');
    const beta = await account(base, 'beta');
    const draft = realDraft();
    const key = newKey();
    // Alpha places an order and claims beta's workspace in the body: it is stored under alpha's.
    const a = await place(base, orderBody({ key, draft, workspace: 'beta' }), alpha.token);
    assert.equal(a.status, 201);
    assert.equal(server.store.data().filings[a.json.id].workspace, 'alpha');

    // Beta holds alpha's order id and alpha's key: the status call answers exactly as an unknown id.
    const unknown = await statusOf(base, 'fil_unknown0000', key, beta.token);
    const foreign = await statusOf(base, a.json.id, key, beta.token);
    assert.equal(foreign.status, 404);
    assert.deepEqual([foreign.status, foreign.json], [unknown.status, unknown.json]);
    assert.equal((await statusOf(base, a.json.id, key, alpha.token)).status, 200);

    // Beta posts alpha's clientId and key with another notice, claiming alpha's workspace: it becomes beta's own
    // order, and alpha's notice is untouched.
    const b = await place(base, orderBody({ key, draft: corrected(draft, 'Replaced by another sponsor'), workspace: 'alpha' }), beta.token);
    assert.equal(b.status, 201);
    assert.notEqual(b.json.id, a.json.id);
    assert.equal(server.store.data().filings[b.json.id].workspace, 'beta');
    assert.deepEqual((await opened(base, a.json.id)).json.notice, draft);
    assert.equal((await opened(base, a.json.id)).json.version, 1);
    assert.deepEqual(Object.values(server.store.data().filings).map((o) => o.workspace).sort(), ['alpha', 'beta']);
    assert.equal((await statusOf(base, b.json.id, key, alpha.token)).status, 404, 'and alpha cannot read beta’s');

    // The shared token works as before: the workspace comes from the body, and the key alone opens the status.
    const s = await place(base, orderBody({ workspace: 'gamma', key: newKey() }));
    assert.equal(s.status, 201);
    assert.equal(server.store.data().filings[s.json.id].workspace, 'gamma');
    assert.equal((await statusOf(base, a.json.id, key)).status, 200);
    assert.equal(fetchFn.calls.length, 0);
  });
});

test('pinned: the staff calls take the staff token and nothing else: a sponsor account’s token, API_TOKEN, ADMIN_TOKEN, RESULTS_TOKEN and an invitation token answer 401', async () => {
  await start({ env: { ADMIN_TOKEN: ADMIN, RESULTS_TOKEN: RESULTS } }, async (base, server, fetchFn) => {
    const alpha = await account(base, 'alpha');
    const invite = await invitationToken(base);
    const placed = await place(base, orderBody());
    const id = placed.json.id;
    const paths = [
      ['GET', '/v1/filings/staff/orders'],
      ['GET', `/v1/filings/staff/orders/${id}`],
      ['PUT', '/v1/filings/staff/issuers/1234567', { ccc: CCCS[0], name: 'AN ISSUER LP' }],
      ['GET', `/v1/filings/staff/orders/${id}/file?mode=TEST`],
      ['POST', `/v1/filings/staff/orders/${id}/submit`, { mode: 'TEST' }],
      ['POST', `/v1/filings/staff/orders/${id}/outcome`, { step: 'test', result: 'accepted' }]
    ];
    const before = JSON.stringify(server.store.data().filings) + JSON.stringify(server.store.data().filingIssuers);
    for (const [method, path, body] of paths) {
      for (const [who, token] of [['a sponsor account', alpha.token], ['API_TOKEN', API], ['ADMIN_TOKEN', ADMIN], ['RESULTS_TOKEN', RESULTS], ['an invitation token', invite], ['no token', undefined], ['a near miss', `${STAFF}x`]]) {
        const r = await call(base, method, path, { token, body });
        assert.equal(r.status, 401, `${method} ${path} with ${who}`);
      }
      // An investor's link never reaches the staff code, whatever else the request carries.
      for (const token of [undefined, STAFF]) assert.equal((await call(base, method, path, { token, body, headers: { 'X-Invite-Token': invite } })).status, 401, `${method} ${path} with an invitation`);
    }
    assert.equal(JSON.stringify(server.store.data().filings) + JSON.stringify(server.store.data().filingIssuers), before, 'nothing changed');
    assert.equal((await call(base, 'GET', '/v1/filings/staff/orders', { token: STAFF })).status, 200);
    assert.equal(fetchFn.calls.length, 0);
  });
  // With no staff token set the staff addresses do not exist, while the portal's still do.
  await start({ env: { FILINGS_STAFF_TOKEN: undefined } }, async (base) => {
    for (const token of [undefined, API, 'undefined', '']) assert.equal((await call(base, 'GET', '/v1/filings/staff/orders', { token })).status, 404);
    assert.equal((await place(base, orderBody())).status, 201);
  });
  // Every staff call is counted before its token is compared, GET included.
  await start({ env: { RATE_LIMIT_PER_MIN: '2' } }, async (base) => {
    const got = [];
    for (const token of ['guess-1', 'guess-2', 'guess-3', STAFF]) got.push((await call(base, 'GET', '/v1/filings/staff/orders', { token })).status);
    assert.deepEqual(got, [401, 401, 429, 429]);
  });
});

test('pinned: the module reports itself off, with the reason, when the staff token is another token of this server or the calls would be open to anyone', async () => {
  const off = async (opts, pattern, token = API) => {
    await start(opts, async (base, server) => {
      const r = await call(base, 'GET', '/v1/filings', { token });
      assert.equal(r.status, 200);
      assert.equal(r.json.on, false);
      assert.match(r.json.reason, pattern);
      assert.equal((await place(base, orderBody(), token)).status, 404);
      for (const t of [STAFF, opts.env.FILINGS_STAFF_TOKEN, API, ADMIN]) assert.equal((await call(base, 'GET', '/v1/filings/staff/orders', { token: t })).status, 404);
      assert.deepEqual(server.store.data().filings, {});
    });
  };
  await off({ env: { FILINGS_STAFF_TOKEN: API } }, /FILINGS_STAFF_TOKEN.*API_TOKEN/);
  await off({ env: { ADMIN_TOKEN: ADMIN, FILINGS_STAFF_TOKEN: ADMIN } }, /FILINGS_STAFF_TOKEN.*ADMIN_TOKEN/);
  await off({ env: { RESULTS_TOKEN: RESULTS, FILINGS_STAFF_TOKEN: RESULTS } }, /FILINGS_STAFF_TOKEN.*RESULTS_TOKEN/);
  await off({ env: { FILINGS_STAFF_TOKEN: 'short-token' } }, /FILINGS_STAFF_TOKEN.*24/);
  await off({ env: { FILINGS_STAFF_EMAIL: undefined } }, /FILINGS_STAFF_EMAIL/);
  // A sponsor account's own token, and an invitation's token, used as the staff token.
  const token = newKey();
  const accounts = openStore(null);
  accounts.put('accounts', { id: 'acct_seeded', workspace: 'alpha', name: 'alpha capital', tokenHash: sha(token), createdAt: '2026-11-01T00:00:00.000Z' });
  await off({ store: accounts, env: { FILINGS_STAFF_TOKEN: token } }, /FILINGS_STAFF_TOKEN.*sponsor account/);
  const invitations = openStore(null);
  invitations.put('invitations', { id: 'inv_seeded', workspace: 'alpha', tokenHash: sha(token), status: 'sent', expiresAt: '2027-01-01T00:00:00.000Z' });
  await off({ store: invitations, env: { FILINGS_STAFF_TOKEN: token } }, /FILINGS_STAFF_TOKEN.*invitation/);

  // Outside tests, with no API_TOKEN and no sponsor account, anyone could place and read orders: off until one exists.
  await start({ env: { NODE_ENV: 'production', API_TOKEN: undefined, ADMIN_TOKEN: ADMIN } }, async (base) => {
    const r = await call(base, 'GET', '/v1/filings');
    assert.equal(r.json.on, false);
    assert.match(r.json.reason, /API_TOKEN/);
    assert.equal((await place(base, orderBody(), undefined)).status, 404);
    assert.equal((await call(base, 'GET', '/v1/filings/staff/orders', { token: STAFF })).status, 404);
    const alpha = await account(base, 'alpha');
    assert.deepEqual((await call(base, 'GET', '/v1/filings', { token: alpha.token })).json, { on: true, live: false });
    assert.equal((await call(base, 'GET', '/v1/filings')).status, 401);
    assert.equal((await place(base, orderBody(), alpha.token)).status, 201);
  });
  // On a test server the open calls are allowed, as the rest of the server allows them.
  await start({ env: { API_TOKEN: undefined } }, async (base) => {
    assert.equal((await call(base, 'GET', '/v1/filings')).json.on, true);
  });

  // The builder files are not beside the server: off, with the reason, and nothing else is tried.
  const { createFilings } = await import('../lib/filings.mjs');
  const filings = createFilings({ env: { FILINGS: '1', FILINGS_STAFF_TOKEN: STAFF, FILINGS_STAFF_EMAIL: STAFF_EMAIL, NODE_ENV: 'test' }, store: openStore(null), vault: { allowed: true, enabled: false }, mailer: {}, limited: () => false, assetsDir: '/nonexistent/assets/js' });
  const answer = {};
  const res = { headersSent: false, writeHead: (status) => (answer.status = status), end: (data) => (answer.body = JSON.parse(data)) };
  await filings.handle({ method: 'GET', headers: {} }, res, new URL('http://x/v1/filings'), { shared: true });
  assert.equal(answer.status, 200);
  assert.equal(answer.body.on, false);
  assert.match(answer.body.reason, /formd\.js/);
});

test('keys: the status call with a wrong key, another order’s key or no key answers exactly as an unknown id, and the key is stored only as a hash', async () => {
  await start({}, async (base, server, fetchFn) => {
    const k1 = newKey();
    const k2 = newKey();
    const one = await place(base, orderBody({ key: k1, clientId: 'fo-1' }));
    const two = await place(base, orderBody({ key: k2, clientId: 'fo-2' }));
    const unknown = await statusOf(base, 'fil_unknown0000', k1);
    assert.equal(unknown.status, 404);
    assert.deepEqual(unknown.json, NOT_FOUND);
    for (const key of [k2, newKey(), undefined, '', 42, null, [k1], { key: k1 }, k1.slice(0, -1), sha(k1)]) {
      const r = await call(base, 'POST', `/v1/filings/orders/${one.json.id}/status`, { token: API, body: { key } });
      assert.deepEqual([r.status, r.json], [404, NOT_FOUND], `key ${typeof key}`);
    }
    assert.equal((await statusOf(base, two.json.id, k1)).status, 404);
    const ok = await statusOf(base, one.json.id, k1);
    assert.equal(ok.status, 200);
    assert.deepEqual(Object.keys(ok.json).sort(), ['dueCents', 'formD', 'id', 'kind', 'lines', 'openFees', 'states', 'status', 'updatedAt']);
    assert.deepEqual(ok.json.formD, { status: 'in_review', accession: '', filedOn: '', messages: [] });
    assert.equal((await call(base, 'GET', `/v1/filings/orders/${one.json.id}/status`, { token: API })).status, 405);
    // At rest: the hash and never the key; no answer of any call repeats a key or its hash.
    assert.equal(server.store.data().filings[one.json.id].keyHash, sha(k1));
    const stored = JSON.stringify(server.store.data());
    for (const k of [k1, k2]) assert.ok(!stored.includes(k));
    for (const s of seen) for (const k of [k1, k2, sha(k1), sha(k2)]) assert.ok(!s.text.includes(k), `${s.method} ${s.path}`);
    const view = await opened(base, one.json.id);
    assert.ok(!('keyHash' in view.json) && !view.text.includes(sha(k1)));
    assert.equal(fetchFn.calls.length, 0);
  });
});

test('off: with FILINGS unset every filings address answers 404 and the rest of the server is unchanged; when it is on, the portal’s calls need the server’s token', async () => {
  let connectors = null;
  await start({ env: { ADMIN_TOKEN: ADMIN } }, async (base) => {
    connectors = (await call(base, 'GET', '/v1/connectors', { token: API })).json;
    const invite = await invitationToken(base);
    // On: no token, a wrong token and an investor's link are all refused.
    for (const [method, path, body] of [['GET', '/v1/filings'], ['POST', '/v1/filings/orders', orderBody()], ['POST', '/v1/filings/orders/fil_x/status', { key: newKey() }]]) {
      assert.equal((await call(base, method, path, { body })).status, 401);
      assert.equal((await call(base, method, path, { body, token: 'wrong' })).status, 401);
      assert.equal((await call(base, method, path, { body, token: STAFF })).status, 401, 'the staff token is not a sponsor’s token');
      assert.equal((await call(base, method, path, { body, headers: { 'X-Invite-Token': invite } })).status, 401);
      assert.equal((await call(base, method, path, { body, token: API, headers: { 'X-Invite-Token': invite } })).status, 401);
    }
  });
  for (const FILINGS of [undefined, '', '0', 'true', 'on']) {
    await start({ env: { FILINGS } }, async (base, server) => {
      const calls = [
        ['GET', '/v1/filings', API],
        ['POST', '/v1/filings/orders', API, orderBody()],
        ['POST', '/v1/filings/orders/fil_x/status', API, { key: newKey() }],
        ['GET', '/v1/filings/staff/orders', STAFF],
        ['GET', '/v1/filings/staff/orders/fil_x', STAFF],
        ['PUT', '/v1/filings/staff/issuers/1234567', STAFF, { ccc: CCCS[0], name: 'AN ISSUER LP' }],
        ['GET', '/v1/filings/staff/orders/fil_x/file?mode=TEST', STAFF],
        ['POST', '/v1/filings/staff/orders/fil_x/submit', STAFF, { mode: 'TEST' }],
        ['POST', '/v1/filings/staff/orders/fil_x/outcome', STAFF, { step: 'test', result: 'accepted' }]
      ];
      for (const [method, path, token, body] of calls) {
        const r = await call(base, method, path, { token, body });
        assert.deepEqual([r.status, r.json], [404, NOT_FOUND], `${method} ${path} with FILINGS=${FILINGS}`);
      }
      assert.deepEqual(server.store.data().filings, {});
      assert.deepEqual(server.store.data().filingIssuers, {});
      assert.deepEqual(server.store.data().outbox, {});
      // An existing route answers as it does with the module on.
      assert.deepEqual((await call(base, 'GET', '/v1/connectors', { token: API })).json, connectors);
      assert.equal((await call(base, 'GET', '/v1/connectors')).status, 401);
      assert.equal((await call(base, 'GET', '/health')).status, 200);
    });
  }
});

test('orders: the server works out the lines and the amount due itself, and refuses an order it cannot stand behind', async () => {
  await start({}, async (base, server, fetchFn) => {
    // A posted total, lines, status and id are ignored.
    const first = await place(base, orderBody({ dueCents: 1, lines: [{ label: 'Free', cents: 0 }], openFees: true, status: 'done', id: 'fil_mine', formD: { status: 'accepted' } }));
    assert.equal(first.status, 201);
    assert.notEqual(first.json.id, 'fil_mine');
    assert.deepEqual([first.json.status, first.json.dueCents, first.json.openFees], ['received', 10000, false]);
    assert.deepEqual(first.json.lines, [{ label: 'Form D filing, EDGAR access setup included', cents: 10000, passThrough: false }]);
    const amended = await place(base, orderBody({ kind: 'formd-amendment', clientId: 'fo-2', draft: realDraft('01-DA') }));
    assert.equal(amended.status, 201);
    assert.deepEqual([amended.json.dueCents, amended.json.lines.map((l) => l.cents)], [5000, [5000]]);

    const broken = realDraft();
    broken.primaryIssuer.entityType = 'Partnership of some kind';
    const future = realDraft();
    future.offeringData.signatureBlock.signature[0].signatureDate = '2026-11-21';
    const refused = [
      ['a new notice ordered at the amendment price', { kind: 'formd-amendment' }],
      ['an amended notice ordered as a new one', { draft: realDraft('01-DA') }],
      ['an unknown kind', { kind: 'form-x' }],
      ['no kind', { kind: undefined }],
      ['a notice with an answer outside the form’s list', { draft: broken }, /Item/],
      ['a notice signed in the future', { draft: future }, /future/],
      ['no notice', { draft: undefined }],
      ['a notice that is not answers', { draft: '<edgarSubmission/>' }],
      ['no sign-off', { signoff: undefined }],
      ['a sign-off with no title', { signoff: { by: 'owner@sponsor.example', name: 'Dana Whitlock', at: '2026-11-20T14:00:00Z' } }],
      ['a sign-off with no date', { signoff: { by: 'owner@sponsor.example', name: 'Dana Whitlock', title: 'Managing Member', at: 'yesterday' } }],
      ['nobody named as placing it', { by: '' }],
      ['no time', { at: undefined }],
      ['a time that is not one', { at: 'soon' }],
      ['a short key', { key: 'abc123' }],
      ['no order number', { clientId: '' }],
      ['no firm', { firm: {} }],
      ['no offering name', { offering: { id: 'OFF-1' } }],
      ['a workspace that is not a name', { workspace: 'a b/c' }]
    ];
    for (const [what, over, pattern] of refused) {
      const r = await place(base, orderBody(Object.assign({ clientId: 'fo-refused' }, over)));
      assert.equal(r.status, 422, what);
      assert.equal(typeof r.json.error, 'string');
      if (pattern) {
        assert.ok(Array.isArray(r.json.messages) && r.json.messages.length >= 1, what);
        for (const m of r.json.messages) assert.deepEqual(Object.keys(m).sort(), ['field', 'item', 'message']);
        assert.ok(r.json.messages.some((m) => pattern.test(m.message)), what);
      }
    }
    // A body over 1 MB, a body that is not JSON, and one that is not an object.
    const big = await place(base, JSON.stringify(orderBody({ clientId: 'fo-big', padding: 'x'.repeat(1024 * 1024) })));
    assert.equal(big.status, 413);
    assert.equal((await place(base, '{"kind":')).status, 400);
    assert.equal((await place(base, '[]')).status, 400);
    assert.equal((await call(base, 'GET', '/v1/filings/orders', { token: API })).status, 405);
    assert.equal(Object.keys(server.store.data().filings).length, 2, 'nothing was stored for a refused order');
    assert.equal(orderMail(server).length, 2);
    assert.equal(fetchFn.calls.length, 0);
  });
});

test('orders: the same clientId and key twice gives one order and one email; another key, or another kind, answers 409', async () => {
  await start({}, async (base, server, fetchFn) => {
    const body = orderBody();
    const first = await place(base, body);
    const again = await place(base, copy(body));
    assert.equal(first.status, 201);
    assert.equal(again.status, 200);
    assert.deepEqual(again.json, first.json);
    assert.equal(Object.keys(server.store.data().filings).length, 1);
    assert.equal(orderMail(server).length, 1);

    const otherKey = await place(base, Object.assign(copy(body), { key: newKey() }));
    assert.equal(otherKey.status, 409);
    assert.ok(!otherKey.text.includes(first.json.id), 'the refusal does not give the order away');
    assert.equal((await place(base, Object.assign(copy(body), { kind: 'bluesky', package: statePackage() }))).status, 409);
    // The order number is the portal's own: the same number in another workspace is another order.
    const elsewhere = await place(base, Object.assign(copy(body), { workspace: 'other', key: newKey() }));
    assert.equal(elsewhere.status, 201);
    assert.notEqual(elsewhere.json.id, first.json.id);
    assert.equal(Object.keys(server.store.data().filings).length, 2);
    assert.equal(fetchFn.calls.length, 0);
  });
});

test('guard: a corrected notice posted with the same clientId and key returns the order to review, and LIVE waits for a test of the new notice', async () => {
  await start({ env: { NODE_ENV: 'production', EDGAR_ALLOW_LIVE: '1' } }, async (base, server, fetchFn) => {
    const draft = realDraft();
    const body = orderBody({ draft });
    const first = await place(base, body);
    const id = first.json.id;
    await recordIssuers(base, draft);
    // A suspended test, then the correction.
    await outcome(base, id, { step: 'test', result: 'suspended', messages: [{ type: 'error', code: '4', message: 'An answer to correct' }] });
    assert.equal((await statusOf(base, id, body.key)).json.formD.status, 'suspended');
    const second = await place(base, Object.assign(copy(body), { draft: corrected(draft, 'First correction') }));
    assert.equal(second.status, 200);
    assert.equal(second.json.id, id);
    let st = (await statusOf(base, id, body.key)).json;
    assert.deepEqual([st.status, st.formD.status, st.formD.messages], ['received', 'in_review', []]);
    assert.equal((await opened(base, id)).json.notice.offeringData.offeringSalesAmounts.clarificationOfResponse, 'First correction');
    assert.equal(orderMail(server).length, 2, 'staff are told the notice changed');
    assert.equal(Object.keys(server.store.data().filings).length, 1);

    // A test of this notice is accepted; then the notice changes again: that test no longer counts.
    await outcome(base, id, { step: 'test', result: 'accepted' });
    assert.equal((await fileOf(base, id, 'LIVE')).status, 200);
    const third = await place(base, Object.assign(copy(body), { draft: corrected(draft, 'Second correction') }));
    assert.equal(third.status, 200);
    st = (await statusOf(base, id, body.key)).json;
    assert.equal(st.formD.status, 'in_review');
    const refusedFile = await raw(base, 'GET', `/v1/filings/staff/orders/${id}/file?mode=LIVE`, { token: STAFF });
    assert.equal(refusedFile.status, 409);
    assert.match(refusedFile.json.error, /test/i);
    assert.equal((await outcome(base, id, { step: 'live', result: 'accepted', accession: ACCESSION, filedOn: TODAY })).status, 409);
    await outcome(base, id, { step: 'test', result: 'accepted' });
    const live = await fileOf(base, id, 'LIVE');
    assert.equal(live.status, 200);
    assert.ok(live.text.includes('Second correction') && !live.text.includes('First correction'));

    // Once the notice is filed it can no longer be changed; the same order posted again is still answered.
    assert.equal((await outcome(base, id, { step: 'live', result: 'accepted', accession: ACCESSION, filedOn: TODAY })).status, 200);
    const late = await place(base, Object.assign(copy(body), { draft: corrected(draft, 'Too late') }));
    assert.equal(late.status, 409);
    const same = await place(base, Object.assign(copy(body), { draft: corrected(draft, 'Second correction') }));
    assert.deepEqual([same.status, same.json.status], [200, 'done']);
    assert.equal((await opened(base, id)).json.notice.offeringData.offeringSalesAmounts.clarificationOfResponse, 'Second correction');
    assert.equal(fetchFn.calls.length, 0);
  });
});

test('states: a state notice order keeps its package sealed, lists the service line and each pass-through line with no amount, and staff record each state’s result by hand', async () => {
  await start({}, async (base, server, fetchFn) => {
    const pkg = statePackage();
    const body = orderBody({ kind: 'bluesky', draft: undefined, signoff: undefined, package: Object.assign(copy(pkg), { ccc: CCCS[0], notes: { apiToken: 'not-for-storage' } }), passThrough: [{ label: 'x', cents: 5 }], dueCents: 5 });
    const first = await place(base, body);
    assert.equal(first.status, 201);
    const id = first.json.id;
    assert.deepEqual(first.json.lines, [
      { label: 'State notice filings, any number of states', cents: 10000, passThrough: false },
      { label: 'State filing fee, TX', cents: null, passThrough: true, state: 'TX' },
      { label: 'State filing fee, NY', cents: null, passThrough: true, state: 'NY' },
      { label: 'State filing fee, CA', cents: null, passThrough: true, state: 'CA' },
      { label: 'Filing system fee', cents: null, passThrough: true }
    ]);
    assert.deepEqual([first.json.dueCents, first.json.openFees, first.json.status], [10000, true, 'received']);
    // Sealed at rest, shown whole to staff (without anything that looks like a secret), and one email with no investor in it.
    assert.ok(!JSON.stringify(server.store.data()).includes('Zelda Quixote'));
    assert.equal(holdsCode(JSON.stringify(server.store.data())), -1);
    const view = (await opened(base, id)).json;
    assert.deepEqual(view.package, Object.assign(copy(pkg), { notes: {} }));
    assert.equal(view.formD, null);
    const mail = orderMail(server);
    assert.equal(mail.length, 1);
    assert.ok(mail[0].text.includes('State notice filings') && mail[0].text.includes('$100 plus fees still to be confirmed') && !mail[0].text.includes('Zelda'));

    const again = await place(base, copy(body));
    assert.deepEqual([again.status, again.json], [200, first.json]);
    assert.equal(orderMail(server).length, 1, 'the same order posted twice is one order and one email');

    // Nothing of Form D applies to it, and nothing in the server talks to the states' system.
    assert.equal((await raw(base, 'GET', `/v1/filings/staff/orders/${id}/file?mode=TEST`, { token: STAFF })).status, 409);
    assert.equal((await call(base, 'POST', `/v1/filings/staff/orders/${id}/submit`, { token: STAFF, body: { mode: 'TEST' } })).status, 409);
    assert.equal((await outcome(base, id, { step: 'test', result: 'accepted' })).status, 409);

    // The package can still be corrected until a state's result is on record.
    const fixed = await place(base, Object.assign(copy(body), { package: statePackage({ contact: { name: 'Dana Whitlock', email: 'dana@sponsor.example' } }) }));
    assert.equal(fixed.status, 200);
    assert.equal((await opened(base, id)).json.package.contact.email, 'dana@sponsor.example');

    // Staff record one state: its date, filing ID, fee paid and renewal date; the fee becomes that state's line.
    const tx = { filedOn: '2026-11-19', efdId: 'EFD-0012345', feeCents: 50000, renewsOn: '2027-11-19' };
    assert.equal((await outcome(base, id, { states: { TX: tx } })).status, 200);
    let st = (await statusOf(base, id, body.key)).json;
    assert.deepEqual(st.states, { TX: tx });
    assert.deepEqual(st.lines.find((l) => l.state === 'TX'), { label: 'State filing fee, TX', cents: 50000, passThrough: true, state: 'TX' });
    assert.deepEqual([st.dueCents, st.openFees, st.status], [60000, true, 'received']);
    assert.equal((await place(base, Object.assign(copy(body), { package: statePackage({ states: ['TX'] }) }))).status, 409, 'too late to change the package');

    // What is refused, with nothing changed.
    const bad = [
      { states: { ZZ: tx } },
      { states: { tx } },
      { states: { NY: Object.assign({}, tx, { feeCents: -1 }) } },
      { states: { NY: Object.assign({}, tx, { feeCents: 12.5 }) } },
      { states: { NY: Object.assign({}, tx, { feeCents: '50000' }) } },
      { states: { NY: Object.assign({}, tx, { filedOn: '2026-11-21' }) } },
      { states: { NY: Object.assign({}, tx, { filedOn: '19 November' }) } },
      { states: { NY: Object.assign({}, tx, { renewsOn: 'next year' }) } },
      { states: [] },
      { states: {} },
      { systemFeeCents: -5 }
    ];
    for (const b of bad) assert.equal((await outcome(base, id, b)).status, 400, JSON.stringify(b));
    assert.deepEqual((await statusOf(base, id, body.key)).json.states, { TX: tx });

    // The rest: two more states and the filing system's fee. Every fee is then known and the order is done.
    const ny = { filedOn: '2026-11-20', efdId: 'EFD-0012346', feeCents: 30000, renewsOn: '' };
    const ca = { filedOn: '2026-11-20', efdId: 'EFD-0012347', feeCents: 30000, renewsOn: '2027-11-20' };
    assert.equal((await outcome(base, id, { states: { NY: ny, CA: ca } })).status, 200);
    st = (await statusOf(base, id, body.key)).json;
    assert.deepEqual([st.dueCents, st.openFees, st.status], [120000, true, 'received'], 'every state is filed, and the filing system’s fee is still open');
    assert.equal((await outcome(base, id, { systemFeeCents: 16000 })).status, 200);
    st = (await statusOf(base, id, body.key)).json;
    assert.deepEqual(st.states, { TX: tx, NY: ny, CA: ca });
    assert.deepEqual(st.lines.map((l) => l.cents), [10000, 50000, 30000, 30000, 16000]);
    assert.deepEqual([st.dueCents, st.openFees, st.status], [136000, false, 'done']);
    assert.equal((await outcome(base, id, { states: { TX: tx } })).status, 409);

    // A renewal order is $50; a package needs states the form knows.
    const renewal = await place(base, orderBody({ kind: 'bluesky-renewal', clientId: 'fo-2', draft: undefined, signoff: undefined, package: statePackage({ states: ['TX', 'TX', { code: 'FL' }] }) }));
    assert.equal(renewal.status, 201);
    assert.deepEqual(renewal.json.lines.map((l) => [l.cents, l.state || '']), [[5000, ''], [null, 'TX'], [null, 'FL'], [null, '']]);
    assert.equal(renewal.json.dueCents, 5000);
    for (const p of [undefined, 'TX', statePackage({ states: [] }), statePackage({ states: ['ZZ'] }), statePackage({ states: undefined })]) {
      assert.equal((await place(base, orderBody({ kind: 'bluesky', clientId: 'fo-3', draft: undefined, signoff: undefined, package: p }))).status, 422);
    }
    assert.equal(Object.keys(server.store.data().filings).length, 2);
    assert.equal(fetchFn.calls.length, 0, 'no outside call was made');
  });
});

test('orders: the staff email is in no sponsor’s outbox listing, and staff can cancel an order nothing was filed for', async () => {
  await start({ env: { ADMIN_TOKEN: ADMIN } }, async (base, server, fetchFn) => {
    const alpha = await account(base, 'alpha');
    const body = orderBody();
    const placed = await place(base, body, alpha.token);
    assert.equal(placed.status, 201);
    const kept = Object.values(server.store.data().outbox);
    assert.deepEqual(kept.map((m) => [m.kind, m.workspace]), [['filing_order', '']]);
    assert.ok(!JSON.stringify(server.store.data()).includes(STAFF_EMAIL), 'the staff address is sealed at rest');
    for (const [path, token] of [['/v1/outbox', alpha.token], ['/v1/outbox?workspace=', alpha.token], ['/v1/outbox?workspace=alpha', API], ['/v1/outbox?workspace=harbor', API]]) {
      const r = await call(base, 'GET', path, { token });
      assert.equal(r.status, 200);
      assert.deepEqual(r.json.messages, [], path);
      assert.ok(!r.text.includes(STAFF_EMAIL));
    }

    // Cancelled by staff: the portal sees it, and nothing more can be done with the order.
    const id = placed.json.id;
    await recordIssuers(base, body.draft);
    assert.equal((await outcome(base, id, { cancelled: true })).status, 200);
    assert.equal((await statusOf(base, id, body.key, alpha.token)).json.status, 'cancelled');
    assert.equal((await raw(base, 'GET', `/v1/filings/staff/orders/${id}/file?mode=TEST`, { token: STAFF })).status, 409);
    assert.equal((await outcome(base, id, { step: 'test', result: 'accepted' })).status, 409);
    assert.equal((await place(base, Object.assign(copy(body), { draft: corrected(body.draft, 'After cancelling') }), alpha.token)).status, 409);
    assert.deepEqual((await call(base, 'GET', '/v1/filings/staff/orders?status=cancelled', { token: STAFF })).json.map((o) => o.id), [id]);
    assert.deepEqual((await call(base, 'GET', '/v1/filings/staff/orders?status=received', { token: STAFF })).json, []);
    assert.equal((await outcome(base, id, { cancelled: true })).status, 409);
    assert.equal(fetchFn.calls.length, 0);
  });
});
