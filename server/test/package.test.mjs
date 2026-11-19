// The verification package attached when an invitation is created (plan 08-05, D-01): a sponsor account ticks the
// package for an investor, the server works out the tier and its price, the account's card (or credit) pays, and only
// then is the invitation stored, the package tied to it, and the investor's email prepared. A refusal at any step leaves
// nothing behind. The payment provider is a fetch stand-in answering recorded fixtures: no payment account exists and
// none is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { withServer, mockFetch } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { loadProviders } from '../providers/index.mjs';

const ADMIN = 'operator-admin-token-0123456789';
const SECRET = 'sk_test_fixtureSecretKey0123456789';
const PUBKEY = 'pk_test_fixturePublishableKey01';
const PUBLIC = 'https://verify.example';
const ORIGIN = 'https://portal.example';
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';
const API = 'shared-api-token-0123456789';
const KEY = randomBytes(32).toString('base64');
const T0 = Date.parse('2026-11-19T12:00:00Z');
const HOUR = 3600 * 1000;
const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/billing/${name}.json`, import.meta.url), 'utf8'));
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);

/** Every setting a package needs: both payment keys, the identity check's settings, the accreditation stand-in's key. */
const ENV = {
  ADMIN_TOKEN: ADMIN,
  PUBLIC_URL: PUBLIC,
  PORTAL_ORIGIN: ORIGIN,
  BILLING_SECRET_KEY: SECRET,
  BILLING_PUBLISHABLE_KEY: PUBKEY,
  RATE_LIMIT_PER_MIN: '0',
  DATA_KEY: KEY,
  IDCHECK_API_KEY: 'key-test-0123456789',
  IDCHECK_WORKFLOW: 'wf-test-1',
  IDCHECK_WEBHOOK_SECRET: 'whk-test-secret-abcdef',
  ACCREDIT_API_KEY: 'acc-test-0123456789'
};

/** The default registry (with the real identity check plug-in) plus a stand-in accreditation provider that records its calls. */
const accreditCalls = [];
const PROVIDERS = Object.assign({}, await loadProviders({ env: {} }), {
  accredit: {
    name: 'Accreditation check',
    kinds: ['accreditation'],
    env: ['ACCREDIT_API_KEY'],
    createSession: (ctx) => {
      accreditCalls.push(ctx);
      return { status: 'pending', url: '' };
    }
  }
});

/**
 * The payment provider's stand-in (as in billing.test.mjs): every route answers its fixture; a test may replace the
 * charge handler (it gets the call and the default answer).
 */
function gateway(over = {}) {
  let n = 0;
  const ok = (call) => Object.assign({}, fx('charge-succeeded').reply, { id: `pi_fixture_${++n}`, amount: Number(call.body.amount) });
  const f = mockFetch([
    ['POST', /\/v1\/customers$/, () => fx('customer-created').reply],
    ['POST', /\/v1\/setup_intents$/, () => fx('setup-created').reply],
    ['GET', /\/v1\/setup_intents\/[^/]+$/, () => fx('setup-succeeded').reply],
    ['GET', /\/v1\/payment_methods\/[^/]+$/, () => fx('payment-method').reply],
    ['POST', /\/v1\/payment_methods\/[^/]+\/detach$/, () => Object.assign({}, fx('payment-method').reply, { customer: null })],
    ['POST', /\/v1\/payment_intents$/, (call) => (over.charge ? over.charge(call, ok) : ok(call))]
  ]);
  f.charges = () => f.calls.filter((c) => c.method === 'POST' && /\/payment_intents$/.test(c.url));
  return f;
}
const refusal = (name) => ({ status: fx(name)._httpStatus, body: fx(name).reply });

/** A store that logs every write and removal in order and knows which blob keys exist. */
function watched() {
  const s = openStore(null);
  const log = [];
  const blobs = new Set();
  const { put, remove, putBlob, removeBlob } = s;
  s.put = (kind, rec) => {
    const out = put(kind, rec);
    log.push({ kind, op: 'put', rec: Object.assign({}, out) });
    return out;
  };
  s.remove = (kind, id) => {
    log.push({ kind, op: 'remove', rec: { id } });
    return remove(kind, id);
  };
  s.putBlob = (key, buf) => {
    putBlob(key, buf);
    blobs.add(key);
  };
  s.removeBlob = (key) => {
    blobs.delete(key);
    return removeBlob(key);
  };
  s.log = log;
  s.blobs = () => [...blobs].sort();
  return s;
}
/** The named tables, the blob keys and the outbox as plain data, to compare before and after a call. */
const tables = (store) => JSON.parse(JSON.stringify({ invitations: store.list('invitations'), entitlements: store.list('entitlements'), ledger: store.list('ledger'), payments: store.list('payments'), billing: store.list('billing'), outbox: store.list('outbox'), blobs: store.blobs() }));

/** One call: bearer is the Authorization token, invite the X-Invite-Token, origin the browser's Origin header. */
async function j(base, method, path, { bearer, invite, body, origin } = {}) {
  const headers = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, bearer !== undefined ? { Authorization: `Bearer ${bearer}` } : {}, invite !== undefined ? { 'X-Invite-Token': invite } : {}, origin ? { Origin: origin } : {});
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed, text };
}
const account = async (base, workspace) => (await j(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace, name: workspace } })).body;
/** The sponsor's card dialog: ask for a card session, then the hosted page reports it is finished. */
async function saveCard(base, token) {
  const setup = await j(base, 'POST', '/v1/billing/card/setup', { bearer: token, origin: ORIGIN });
  assert.equal(setup.status, 200, setup.text);
  const done = await j(base, 'POST', `${setup.body.url.slice(PUBLIC.length)}/done`);
  assert.equal(done.status, 200, done.text);
}
const buy = (base, token, items) => j(base, 'POST', '/v1/billing/entitlements', { bearer: token, body: { items } });

/** What the console sends: inv goes into body.invitation, over replaces top-level fields. No commitment or value here holds a price or the word "tier". */
function payload(inv = {}, over = {}) {
  return Object.assign(
    {
      sendEmail: true,
      portalUrl: PORTAL,
      notifyEmail: 'ops@harborridge.example',
      firm: { name: 'Harbor Ridge Capital', supportEmail: 'ir@harborridge.example' },
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', exemption: 'Rule 506(b)', currency: 'USD' },
      invitation: Object.assign({ cents: 25000000, note: 'Welcome aboard' }, inv),
      verification: { accreditationRequired: false, connections: [], use: {} }
    },
    over
  );
}
const withDoc = { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', exemption: 'Rule 506(b)', currency: 'USD', documents: [{ id: 'ppm', title: 'Memorandum', fileName: 'ppm.pdf', base64: pdf('PPM').toString('base64') }] };
const invite = (base, token, inv, over) => j(base, 'POST', '/v1/invitations', { bearer: token, body: payload(inv, over) });
const snapshot = (server, rec) => server.invitations.vault.open(rec.snapshot, `${rec.id}:snapshot`);
const entitlementsOf = (store, a, key) => store.list('entitlements').filter((e) => e.account === a.id && (key === undefined || e.key === key));

/**
 * A server on the store given (a watched one by default) and an account named alpha with a card saved through the real
 * card routes (unless card is false). charge replaces the stand-in's charge handler: (call, ok, store).
 */
async function shop(opts, fn) {
  const store = opts.store || watched();
  const gw = gateway({ charge: opts.charge && ((call, ok) => opts.charge(call, ok, store)) });
  const clock = { t: T0 };
  await withServer({ env: Object.assign({}, ENV, opts.env), fetch: gw, store, providers: PROVIDERS, now: () => clock.t }, async (base, server) => {
    const a = await account(base, 'alpha');
    if (opts.card !== false) await saveCard(base, a.token);
    await fn({ base, server, store, gw, clock, a });
  });
}

test('tracer: a sponsor account’s package invitation is paid before it is stored and emailed, and its row shows the paid package', async () => {
  const seen = [];
  const charge = (call, ok, store) => {
    seen.push({ invitations: store.list('invitations').length, outbox: store.list('outbox').length });
    return ok(call);
  };
  await shop({ charge }, async ({ base, server, store, gw, a }) => {
    const r = await invite(base, a.token, { package: true, clientId: 'c1' });
    assert.equal(r.status, 200, r.text);
    // One charge at the server's price for the identity tier, made while nothing was stored and no email prepared.
    assert.equal(gw.charges().length, 1);
    assert.equal(gw.charges()[0].body.amount, '1900');
    assert.deepEqual(seen, [{ invitations: 0, outbox: 0 }]);
    assert.equal(store.list('outbox').length, 1, 'then exactly one email');

    const rec = store.get('invitations', r.body.id);
    const ents = entitlementsOf(store, a, 'c1');
    assert.equal(ents.length, 1);
    assert.deepEqual(rec.package, { entitlement: ents[ents.length - 1].id, tier: 'identity', account: a.id, key: 'c1' });

    const rows = await j(base, 'GET', '/v1/invitations', { bearer: a.token });
    assert.equal(rows.status, 200, rows.text);
    assert.deepEqual(rows.body.find((x) => x.id === rec.id).package, { tier: 'identity', status: 'paid' });

    const snap = snapshot(server, rec);
    assert.deepEqual(snap.verification.use.identity, ['package-id']);
    assert.deepEqual(snap.verification.use.aml, ['package-id']);
    assert.deepEqual(
      snap.verification.connections.find((c) => c.id === 'package-id'),
      { id: 'package-id', name: 'Identity check', type: 'server', connector: 'idcheck', checks: ['identity', 'aml'], package: true }
    );
    assert.ok(!('package' in snap.invitation) && !('clientId' in snap.invitation), 'neither value is written into the snapshot’s invitation');
  });
});

test('N2 order: the record is written, then the package is tied to it, then the email; the charge saw neither', async () => {
  const seen = [];
  const charge = (call, ok, store) => {
    seen.push({ invitations: store.list('invitations').length, outbox: store.list('outbox').length });
    return ok(call);
  };
  await shop({ charge }, async ({ base, store, a }) => {
    const from = store.log.length;
    const r = await invite(base, a.token, { package: true, clientId: 'o1' }, { offering: withDoc });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(seen, [{ invitations: 0, outbox: 0 }]);
    const log = store.log.slice(from);
    const at = (pred) => log.findIndex(pred);
    const record = at((x) => x.kind === 'invitations' && x.op === 'put' && x.rec.id === r.body.id);
    const tied = at((x) => x.kind === 'entitlements' && x.op === 'put' && x.rec.status === 'consumed' && x.rec.invitationId === r.body.id);
    const email = at((x) => x.kind === 'outbox' && x.op === 'put');
    assert.ok(record >= 0 && tied >= 0 && email >= 0, JSON.stringify({ record, tied, email }));
    assert.ok(record < tied && tied < email, `the order is record ${record}, package ${tied}, email ${email}`);
    assert.equal(log.filter((x) => x.kind === 'outbox').length, 1);
  });
});

test('N2 together: two posts with one client id at the same moment give one 200 and one 409, one invitation, one email, one charge', async () => {
  let release;
  const held = new Promise((r) => (release = r));
  const charge = async (call, ok) => {
    await held;
    return ok(call);
  };
  await shop({ charge }, async ({ base, server, store, gw, a }) => {
    // The charge is held until both requests have been read by the server (a safety timer stops a hang).
    let ended = 0;
    server.on('request', (req) => {
      if (req.method === 'POST' && req.url === '/v1/invitations') req.on('end', () => ++ended === 2 && setImmediate(release));
    });
    const safety = setTimeout(release, 3000);
    const both = await Promise.all([invite(base, a.token, { package: true, clientId: 'c2' }, { offering: withDoc }), invite(base, a.token, { package: true, clientId: 'c2' }, { offering: withDoc })]);
    clearTimeout(safety);
    assert.equal(ended, 2);
    assert.deepEqual(both.map((r) => r.status).sort(), [200, 409], both.map((r) => r.text).join(' | '));
    const won = both.find((r) => r.status === 200);
    const lost = both.find((r) => r.status === 409);
    assert.ok(['already_sent', 'package_used'].includes(lost.body.code), lost.text);
    assert.equal(store.list('invitations').length, 1);
    assert.equal(store.list('outbox').length, 1);
    assert.equal(gw.charges().length, 1);
    assert.deepEqual(store.blobs(), store.get('invitations', won.body.id).blobs.slice().sort(), 'only the 200’s files are kept');
  });
});

test('N2 tier: a key paid at one level is refused at the other, both ways, with nothing charged, stored or emailed', async () => {
  await shop({}, async ({ base, store, gw, a }) => {
    const cases = [
      ['t1', 'identity', true],
      ['t2', 'full', false]
    ];
    for (const [key, paidAs, accreditationRequired] of cases) {
      const pre = await buy(base, a.token, [{ key, tier: paidAs }]);
      assert.equal(pre.status, 200, pre.text);
      const before = tables(store);
      const calls = gw.calls.length;
      const r = await invite(base, a.token, { package: true, clientId: key }, { offering: withDoc, verification: { accreditationRequired, connections: [], use: {} } });
      assert.equal(r.status, 409, r.text);
      assert.deepEqual(r.body, { error: "This invitation's package was paid at another level. Nothing was charged.", code: 'tier_mismatch' });
      assert.equal(gw.calls.length, calls, 'no call to the payment provider');
      assert.deepEqual(tables(store), before, 'tables, files and outbox unchanged');
    }
  });
});

test('N2 prepaid 25 hours: a key paid a day earlier has gone back to credit and the invitation is paid from it, with no second charge', async () => {
  await shop({}, async ({ base, store, gw, clock, a }) => {
    const pre = await buy(base, a.token, [{ key: 'p1', tier: 'identity' }]);
    assert.equal(pre.status, 200, pre.text);
    assert.equal(gw.charges().length, 1);
    const first = entitlementsOf(store, a, 'p1')[0];
    clock.t = T0 + 25 * HOUR;
    const mid = await j(base, 'GET', '/v1/billing', { bearer: a.token });
    assert.equal(mid.body.creditCents, 1900);
    assert.deepEqual(mid.body.charges[0], { at: new Date(T0 + 25 * HOUR).toISOString(), type: 'credit', by: 'credit', cents: 1900, tier: 'identity', invitationId: null });
    const r = await invite(base, a.token, { package: true, clientId: 'p1' });
    assert.equal(r.status, 200, r.text);
    assert.equal(gw.charges().length, 1, 'no second charge');
    const rec = store.get('invitations', r.body.id);
    assert.notEqual(rec.package.entitlement, first.id, 'a new package');
    const own = store.get('entitlements', rec.package.entitlement);
    assert.equal(own.by, 'credit');
    assert.equal(own.status, 'consumed');
    assert.equal(own.invitationId, rec.id);
    const after = await j(base, 'GET', '/v1/billing', { bearer: a.token });
    assert.equal(after.body.creditCents, 0);
  });
});

test('N2 other account: account B using account A’s client id never touches A’s package', async () => {
  await shop({}, async ({ base, store, gw, a }) => {
    const ra = await invite(base, a.token, { package: true, clientId: 'x1' });
    assert.equal(ra.status, 200, ra.text);
    const pick = (e) => ({ id: e.id, status: e.status, invitationId: e.invitationId });
    const aBefore = entitlementsOf(store, a, 'x1').map(pick);
    const b = await account(base, 'beta');
    await saveCard(base, b.token);
    const rb = await invite(base, b.token, { package: true, clientId: 'x1' });
    assert.equal(rb.status, 200, rb.text);
    assert.deepEqual(entitlementsOf(store, a, 'x1').map(pick), aBefore);
    const bEnts = entitlementsOf(store, b, 'x1');
    assert.equal(bEnts.length, 1);
    assert.equal(gw.charges().length, 2, 'B paid for its own package');
    const recB = store.get('invitations', rb.body.id);
    assert.equal(recB.package.account, b.id);
    assert.equal(recB.package.entitlement, bEnts[0].id);
    assert.equal(bEnts[0].invitationId, recB.id);
  });
});

test('refused charge: a declined card, a bank asking for confirmation and no card on file each answer 402 and leave nothing behind', async () => {
  let answer = '';
  const charge = (call, ok) => (answer ? refusal(answer) : ok(call));
  await shop({ charge }, async ({ base, store, gw, a }) => {
    const expect = [
      ['error-card-declined', { error: 'The card was declined. Nothing was charged.', code: 'card_declined' }],
      ['error-authentication-required', { error: "The card's bank asks for confirmation. Replace the card on the Integrations page, then try again.", code: 'authentication_required' }]
    ];
    for (const [fixture, body] of expect) {
      answer = fixture;
      const before = tables(store);
      const n = gw.charges().length;
      const r = await invite(base, a.token, { package: true, clientId: 'r1' }, { offering: withDoc });
      assert.equal(r.status, 402, r.text);
      assert.deepEqual(r.body, body);
      assert.equal(gw.charges().length, n + 1);
      const after = tables(store);
      assert.deepEqual(after.invitations, before.invitations);
      assert.deepEqual(after.blobs, before.blobs);
      assert.deepEqual(after.outbox, before.outbox);
      assert.deepEqual(after.entitlements, [], 'no package recorded');
    }
    const removed = await j(base, 'DELETE', '/v1/billing/card', { bearer: a.token });
    assert.equal(removed.status, 200, removed.text);
    const before = tables(store);
    const calls = gw.calls.length;
    const r = await invite(base, a.token, { package: true, clientId: 'r1' }, { offering: withDoc });
    assert.equal(r.status, 402, r.text);
    assert.deepEqual(r.body, { error: 'Add a card on the Integrations page first.', code: 'no_card' });
    assert.equal(gw.calls.length, calls);
    assert.deepEqual(tables(store), before);
  });
});

test('already sent: a second post while the first invitation is open is refused with no charge; once that invitation is gone the package’s credit pays', async () => {
  await shop({}, async ({ base, store, gw, a }) => {
    const first = await invite(base, a.token, { package: true, clientId: 'c3' });
    assert.equal(first.status, 200, first.text);
    assert.equal(gw.charges().length, 1);
    let before = tables(store);
    let calls = gw.calls.length;
    const again = await invite(base, a.token, { package: true, clientId: 'c3' });
    assert.equal(again.status, 409, again.text);
    assert.deepEqual(again.body, { code: 'already_sent', error: 'This invitation was already sent. Nothing was charged.' });
    assert.equal(gw.calls.length, calls);
    assert.deepEqual(tables(store), before);

    // As a purge would: the invitation is gone, so its package counts as ended and returns as credit, which pays the next one.
    store.remove('invitations', first.body.id);
    const next = await invite(base, a.token, { package: true, clientId: 'c3' });
    assert.equal(next.status, 200, next.text);
    assert.equal(gw.calls.length, calls, 'paid from the returned credit');
    const rec = store.get('invitations', next.body.id);
    assert.equal(store.get('entitlements', rec.package.entitlement).by, 'credit');
    assert.equal((store.get('billing', a.id) || {}).creditCents, 0);

    // R7: a package whose check started is never returned; once its invitation has ended, the same client id answers
    // package_used, with no charge and nothing stored.
    store.put('entitlements', { id: rec.package.entitlement, startedAt: new Date(T0).toISOString() });
    const cancel = await j(base, 'POST', `/v1/invitations/${rec.id}/cancel`, { bearer: a.token });
    assert.equal(cancel.status, 200, cancel.text);
    before = tables(store);
    calls = gw.calls.length;
    const used = await invite(base, a.token, { package: true, clientId: 'c3' });
    assert.equal(used.status, 409, used.text);
    assert.equal(used.body.code, 'package_used');
    assert.equal(gw.calls.length, calls);
    assert.deepEqual(tables(store), before);
  });
});

/** A sponsor's own connection, and connections that name the package providers or the package ids. */
const OWN = { id: 'own', name: 'Our checks', type: 'server', connector: 'sandbox', checks: ['identity', 'accreditation'] };
const CLAIMED = [
  { id: 'k-id', name: 'Claimed identity', type: 'server', connector: 'idcheck', checks: ['identity', 'aml'] },
  { id: 'k-acc', name: 'Claimed accreditation', type: 'server', connector: 'accredit', checks: ['accreditation'] },
  { id: 'package-id', name: 'Claimed package', type: 'server', connector: 'sandbox', checks: ['identity', 'aml'], package: true },
  { id: 'package-acc', name: 'Claimed package', type: 'link', checks: ['accreditation'], package: true }
];
const claiming = (accreditationRequired = false) => ({ accreditationRequired, connections: [OWN].concat(CLAIMED), use: { identity: ['own', 'k-id', 'package-id'], accreditation: ['k-acc', 'package-acc', 'own'], aml: ['k-id', 'package-id'] } });

test('shared token: the operator’s shared token cannot buy a package, and keeps its identity check connections exactly as before', async () => {
  await shop({ env: { API_TOKEN: API } }, async ({ base, server, store, gw }) => {
    const billingSays = await j(base, 'GET', '/v1/billing', { bearer: API });
    assert.equal(billingSays.status, 403);
    const before = tables(store);
    const calls = gw.calls.length;
    const r = await invite(base, API, { package: true, clientId: 's1' }, { workspace: 'ws-harbor' });
    assert.equal(r.status, 403, r.text);
    assert.deepEqual(r.body, { error: 'Card payments need a sponsor account.', code: 'account_required' });
    assert.deepEqual(r.body, billingSays.body, 'billing’s own sentence');
    assert.equal(gw.calls.length, calls);
    assert.deepEqual(tables(store), before);

    const verification = { accreditationRequired: false, connections: [{ id: 'k1', name: 'Identity', type: 'server', connector: 'idcheck', checks: ['identity', 'aml'] }], use: { identity: ['k1'], aml: ['k1'] } };
    const ok = await invite(base, API, {}, { workspace: 'ws-harbor', verification });
    assert.equal(ok.status, 200, ok.text);
    const rec = store.get('invitations', ok.body.id);
    assert.equal(rec.package, undefined);
    assert.deepEqual(snapshot(server, rec).verification, verification);
  });
});

test('claimed connections: an account’s snapshot loses every connection naming a package provider or package id; a paid one holds only the server’s', async () => {
  await shop({}, async ({ base, server, store, a }) => {
    const plain = await invite(base, a.token, {}, { verification: claiming() });
    assert.equal(plain.status, 200, plain.text);
    const v = snapshot(server, store.get('invitations', plain.body.id)).verification;
    assert.deepEqual(v.connections, [OWN]);
    assert.deepEqual(v.use, { identity: ['own'], accreditation: ['own'], aml: [] });

    const paid = await invite(base, a.token, { package: true, clientId: 'cc1' }, { verification: claiming() });
    assert.equal(paid.status, 200, paid.text);
    const pv = snapshot(server, store.get('invitations', paid.body.id)).verification;
    assert.deepEqual(pv.connections, [OWN, { id: 'package-id', name: 'Identity check', type: 'server', connector: 'idcheck', checks: ['identity', 'aml'], package: true }]);
    assert.deepEqual(pv.use, { identity: ['package-id'], accreditation: ['own'], aml: ['package-id'] });
  });
});

test('unavailable: a tier whose provider is not set up is refused with nothing charged or stored; once set up the full tier charges its price', async () => {
  await shop({ env: { ACCREDIT_API_KEY: '' } }, async ({ base, store, gw, a }) => {
    const before = tables(store);
    const calls = gw.calls.length;
    const r = await invite(base, a.token, { package: true, clientId: 'u1' }, { offering: withDoc, verification: { accreditationRequired: true, connections: [], use: {} } });
    assert.equal(r.status, 409, r.text);
    assert.deepEqual(r.body, { error: 'The verification package is not available on this server right now. Nothing was charged.', code: 'package_unavailable' });
    assert.equal(gw.calls.length, calls);
    assert.deepEqual(tables(store), before);
    const id = await invite(base, a.token, { package: true, clientId: 'u2' });
    assert.equal(id.status, 200, id.text);
    assert.equal(gw.charges()[0].body.amount, '1900');
  });
  await shop({}, async ({ base, server, store, gw, a }) => {
    const r = await invite(base, a.token, { package: true, clientId: 'u3' }, { verification: { accreditationRequired: true, connections: [], use: {} } });
    assert.equal(r.status, 200, r.text);
    assert.equal(gw.charges().length, 1);
    assert.equal(gw.charges()[0].body.amount, '9900');
    const rec = store.get('invitations', r.body.id);
    assert.equal(rec.package.tier, 'full');
    const v = snapshot(server, rec).verification;
    assert.deepEqual(v.connections.find((c) => c.id === 'package-acc'), { id: 'package-acc', name: 'Accreditation check', type: 'server', connector: 'accredit', checks: ['accreditation'], package: true });
    assert.deepEqual(v.use, { identity: ['package-id'], aml: ['package-id'], accreditation: ['package-acc'] });
  });
});

test('W5 flags: a portal link and a tax-form request never carry the package and never pay', async () => {
  await shop({}, async ({ base, store, gw, a }) => {
    const calls = gw.calls.length;
    const access = await invite(base, a.token, { existing: true, access: true, package: true, clientId: 'w1' }, { offering: null });
    assert.equal(access.status, 200, access.text);
    const tax = await invite(base, a.token, { existing: true, taxRequest: true, package: true, clientId: 'w2' }, { offering: null, investor: { id: 'HRC-0007', contact: 'Zelda Quixote', email: 'zelda@investor.example', taxType: 'us-individual' } });
    assert.equal(tax.status, 200, tax.text);
    assert.equal(gw.calls.length, calls, 'no payment call');
    for (const r of [access, tax]) assert.equal(store.get('invitations', r.body.id).package, undefined);
    assert.deepEqual(store.list('entitlements'), []);
  });
});

test('W9 investor view: the investor’s view of a package invitation holds no level, no package record and no price', async () => {
  await shop({}, async ({ base, store, a }) => {
    const r = await invite(base, a.token, { package: true, clientId: 'clientKeyW9' });
    assert.equal(r.status, 200, r.text);
    assert.ok(store.get('invitations', r.body.id).package);
    const view = await j(base, 'GET', '/v1/invite', { invite: r.body.token });
    assert.equal(view.status, 200, view.text);
    for (const word of ['tier', 'entitlement', '1900', '9900', 'clientKeyW9']) assert.ok(!view.text.includes(word), `the investor's reply holds "${word}"`);
    assert.ok(!('package' in view.body.invitation) && !('clientId' in view.body.invitation));
  });
});

test('rows: the row reads the invitation’s own package: none, paid, started, credited, refunded (refunded, disputed, refunding)', async () => {
  await shop({}, async ({ base, store, a }) => {
    const row = async (id) => {
      const r = await j(base, 'GET', `/v1/invitations/${id}`, { bearer: a.token });
      assert.equal(r.status, 200, r.text);
      return r.body.package;
    };
    const plain = await invite(base, a.token, {});
    assert.equal(await row(plain.body.id), null);
    const r = await invite(base, a.token, { package: true, clientId: 'rw1' });
    const rec = store.get('invitations', r.body.id);
    assert.deepEqual(await row(rec.id), { tier: 'identity', status: 'paid' });
    const eid = rec.package.entitlement;
    const at = new Date(T0).toISOString();
    const cases = [
      [{ status: 'consumed', startedAt: at }, 'started'],
      [{ status: 'credited', startedAt: null }, 'credited'],
      [{ status: 'refunded' }, 'refunded'],
      [{ status: 'disputed' }, 'refunded'],
      [{ status: 'refunding' }, 'refunded']
    ];
    for (const [patch, want] of cases) {
      store.put('entitlements', Object.assign({ id: eid }, patch));
      assert.deepEqual(await row(rec.id), { tier: 'identity', status: want }, JSON.stringify(patch));
    }
    // The key's newest entitlement is now another one: the row still reads its own.
    store.put('entitlements', { id: eid, status: 'credited', startedAt: null });
    store.put('entitlements', { id: 'ent_newer', account: a.id, workspace: 'alpha', key: 'rw1', tier: 'identity', cents: 1900, by: 'card', status: 'paid', chargeRef: '', invitationId: null, paidAt: at, startedAt: null, creditedAt: null });
    assert.deepEqual(await row(rec.id), { tier: 'identity', status: 'credited' });
    const list = await j(base, 'GET', '/v1/invitations', { bearer: a.token });
    assert.deepEqual(list.body.find((x) => x.id === rec.id).package, { tier: 'identity', status: 'credited' });
  });
});

test('amounts: the charge is the server’s price for the server’s tier; amounts, prices and a level in the request change nothing', async () => {
  await shop({ env: { PACKAGE_PRICE_IDENTITY_CENTS: '2500' } }, async ({ base, store, gw, a }) => {
    const sent = [
      ['m1', 1900],
      ['m2', 9900]
    ];
    for (const [clientId, cents] of sent) {
      const r = await invite(base, a.token, { package: true, clientId, cents, amount: 9900, price: 1, tier: 'full' }, { amount: 9900, cents: 1 });
      assert.equal(r.status, 200, r.text);
      assert.equal(store.get('invitations', r.body.id).package.tier, 'identity');
    }
    assert.deepEqual(gw.charges().map((c) => c.body.amount), ['2500', '2500']);
    assert.deepEqual(store.list('entitlements').map((e) => e.cents), [2500, 2500]);
  });
});
