// Plan 08-09 (D-04, C-06, D-01): the sponsor asks an investor already on file to verify their accredited investor status
// again. The console sends an invitation to that investor (existing: true) marked reverify, with no offering: the link holds
// the accreditation step and the done screen only. The integration server keeps the flag for such an invitation only,
// writes the investor a short email about that step, tells the sponsor the accreditation result it brought, and, with the
// verification package, charges the reverify price from its own settings and runs the package's accreditation check only.
// Stand-ins only: the accreditation provider is a recorded stand-in and no payment provider is called (credit pays).
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer, mockFetch } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { loadProviders } from '../providers/index.mjs';

const DAY = 864e5;
const T0 = Date.parse('2026-11-26T12:00:00Z');
const API = 'sponsor-api-token-reverify-0123456789';
const ADMIN = 'operator-admin-token-reverify-0123456789';
const KEY = randomBytes(32).toString('base64');
// The portal page's address (its name holds no product word: the email's white-label check reads the link too).
const PORTAL = 'https://portal.example/portal.html?tenant=harbor';
const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', colors: { primary: '#123456', accent: '#1F7A8C' }, portalName: 'Harbor Ridge Investor Portal', onboarding: { accreditation: false } };
// The console's summary of an investor on file whose verification lapsed (flags and a date, no personal details).
const ONFILE = { accredited: false, accreditedUntil: '', holds: false };
const INVESTOR = { id: 'HRC-0042', contact: 'Dana Whitfield', title: 'Dana Whitfield', type: 'individual', email: 'dana@investor.example', existing: ONFILE };
// The firm's own accreditation connection, run through this server (a stand-in provider that is not the package's).
const OWN = { connections: [{ id: 'acc-own', name: 'Accreditation letters', type: 'server', connector: 'letters', checks: ['accreditation'] }], use: { accreditation: ['acc-own'] }, rules: { validDays: 90 }, accreditationRequired: false };
// White label (C-01 apart): no provider, product or library word in what the investor or the sponsor reads.
const VENDOR = /didit|stripe|verify\s*investor|verifyinvestor|north capital|parallel markets|carrow|\bvale\b|powered by|diy/i;

/** The default registry plus two stand-in accreditation providers that record their calls: the package's and the firm's own. */
const accreditCalls = [];
const ownCalls = [];
const identityCalls = [];
const PROVIDERS = Object.assign({}, await loadProviders({ env: {} }), {
  idown: {
    name: 'Identity',
    kinds: ['identity'],
    env: ['IDOWN_API_KEY'],
    createSession: (ctx) => {
      identityCalls.push(ctx);
      return { status: 'pending', url: '' };
    }
  },
  letters: {
    name: 'Accreditation letters',
    kinds: ['accreditation'],
    env: ['LETTERS_API_KEY'],
    createSession: (ctx) => {
      ownCalls.push(ctx);
      return { status: 'pending', url: '' };
    }
  },
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

/** What the console sends for a re-verification request: no offering, no agreement, the investor on file. */
function payload(over = {}, inv = {}) {
  return Object.assign(
    {
      workspace: 'ws-harbor',
      portalUrl: PORTAL,
      notifyEmail: 'ops@harborridge.example',
      firm: FIRM,
      investor: INVESTOR,
      offering: null,
      invitation: Object.assign({ cents: 0, cls: '', note: '', existing: true, reverify: true, expiresAt: new Date(T0 + 30 * DAY).toISOString() }, inv),
      verification: OWN
    },
    over
  );
}
async function j(base, method, path, { body, token, bearer = API } = {}) {
  const h = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, bearer ? { Authorization: `Bearer ${bearer}` } : {}, token !== undefined ? { 'X-Invite-Token': token } : {});
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text), text };
  } catch {
    return { status: res.status, body: text, text };
  }
}
async function invite(base, over, inv, bearer) {
  const r = await j(base, 'POST', '/v1/invitations', { body: payload(over, inv), bearer });
  assert.equal(r.status, 200, r.text);
  return r.body;
}
const outbox = async (base, id, bearer) => (await j(base, 'GET', `/v1/outbox?invitation=${id}`, { bearer })).body.messages;
const view = async (base, token) => (await j(base, 'GET', '/v1/invite', { token, bearer: '' })).body;
const complete = (base, token, body) => j(base, 'POST', '/v1/invite/complete', { token, bearer: '', body });
const sealed = (server, id) => {
  const rec = server.store.get('invitations', id);
  return server.invitations.vault.open(rec.snapshot, `${rec.id}:snapshot`);
};
/** What the investor's device sends back: the investor's accreditation (with the reference of this server's check, if any). */
const submission = (acc) => ({ investor: { id: 'HRC-0042', contact: 'Dana Whitfield', title: 'Dana Whitfield', email: 'dana@investor.example', type: 'individual', verify: { accreditation: acc }, onboarding: { status: 'complete' } }, request: null, envelope: null, files: {}, docs: [], audit: [], notifications: [] });

// Every provider setting is filled, so a refused check is refused by the link's scope, not by a missing setting; every call
// a provider would get is kept here (none leaves this machine).
const IDCHECK = { IDCHECK_API_KEY: 'key-test-0123456789', IDCHECK_WORKFLOW: 'wf-test-1', IDCHECK_WEBHOOK_SECRET: 'whk-test-secret-abcdef' };
const start = (fn, env) => {
  const net = mockFetch([]);
  return withServer({ env: Object.assign({ API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: 'https://verify.example', ACCREDIT_API_KEY: 'acc-test-0123456789', LETTERS_API_KEY: 'letters-test-0123456789', IDOWN_API_KEY: 'idown-test-0123456789', RATE_LIMIT_PER_MIN: '0' }, IDCHECK, env), fetch: net, providers: PROVIDERS, now: () => T0 }, (base, server) => fn(base, server, net));
};

test('reverify flag: kept only for an investor on file with no offering, no tax-form request and no portal link; the link carries it', () =>
  start(async (base, server) => {
    const kept = await invite(base);
    assert.equal(sealed(server, kept.id).invitation.reverify, true);
    const v = await view(base, kept.token);
    assert.equal(v.invitation.reverify, true, 'GET /v1/invite carries invitation.reverify');
    assert.equal(v.invitation.existing, true);
    assert.equal(v.offering, null);
    const dropped = [
      ['a new investor', payload({ investor: { id: 'HRC-0050', contact: 'Nina New', email: 'nina@investor.example' } }, { existing: false })],
      ['an invitation to subscribe', payload({ offering: { id: 'hr-fund-iii', name: 'Harbor Ridge Fund III', exemption: 'Rule 506(c)', documents: [] } })],
      ['a tax-form request', payload({}, { taxRequest: true })],
      ['a portal link', payload({}, { access: true })]
    ];
    for (const [what, body] of dropped) {
      const r = await j(base, 'POST', '/v1/invitations', { body });
      assert.equal(r.status, 200, `${what}: ${r.text}`);
      assert.equal(sealed(server, r.body.id).invitation.reverify, undefined, `${what}: the flag is dropped`);
      assert.equal((await view(base, r.body.token)).invitation.reverify, undefined, `${what}: the link does not carry it`);
    }
    assert.equal(sealed(server, (await j(base, 'POST', '/v1/invitations', { body: dropped[2][1] })).body.id).invitation.taxRequest, true, 'the tax-form request behaves as before');
  }));

test('reverify email: the invitation, the resend and the reminder ask to verify accredited investor status again, for that step only; no vendor word', async () => {
  const clock = { t: T0 };
  await withServer({ env: { API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: 'https://verify.example', ACCREDIT_API_KEY: 'acc-test-0123456789' }, providers: PROVIDERS, now: () => clock.t }, async (base, server) => {
    const r = await invite(base);
    const [m] = await outbox(base, r.id);
    assert.equal(m.subject, 'Harbor Ridge Capital: verify your accredited investor status');
    assert.match(m.text, /Harbor Ridge Capital asks you to verify your accredited investor status again\./);
    assert.match(m.text, /The link below opens the accreditation step only: you verify your status online\. Nothing else is asked\./);
    assert.match(m.text, /Verify your accreditation:/);
    assert.ok(!/photo ID|bank details|onboarding|subscri|tax form/i.test(m.text), m.text);
    assert.ok(!VENDOR.test(m.text + m.html), 'no vendor word');
    const again = await j(base, 'POST', `/v1/invitations/${r.id}/resend`, { body: {} });
    assert.equal(again.status, 200, again.text);
    const re = (await outbox(base, r.id)).find((x) => x.kind === 'invitation_resent');
    assert.equal(re.subject, 'Reminder: Harbor Ridge Capital: verify your accredited investor status');
    assert.match(re.text, /Here is a new link to verify your accredited investor status for Harbor Ridge Capital\. Any earlier link we sent no longer works\./);
    assert.ok(!VENDOR.test(re.text + re.html), 'no vendor word in the resend');

    // Finished and never imported: the sponsor is reminded once, a week before the result is deleted.
    assert.equal((await complete(base, again.body.token, submission({ status: 'not_started' }))).status, 200);
    clock.t += 23 * DAY + 60e3;
    assert.equal(server.invitations.purge(clock.t).reminders, 1);
    await new Promise((res) => setTimeout(res, 50));
    const rem = (await j(base, 'GET', '/v1/outbox')).body.messages.find((x) => x.kind === 'submission_reminder');
    assert.equal(rem.subject, 'Waiting in your console: Dana Whitfield’s re-verification');
    assert.match(rem.text, /Dana Whitfield finished your request to verify their accreditation again on November 26, 2026, but the console has not added the result to your records yet\./);
    assert.ok(!/subscri|onboarding|signed agreement/i.test(rem.text), rem.text);
    assert.ok(!VENDOR.test(rem.text + rem.html), 'no vendor word in the reminder');
  });
});

test('reverify summary: the sponsor’s finished summary has a re-verification row with the accreditation result and no onboarding rows', () =>
  start(async (base, server) => {
    const r = await invite(base);
    // The investor starts the firm's own check with their link; its result arrives on this server (the stand-in's answer).
    const ver = await j(base, 'POST', '/v1/verifications', { token: r.token, bearer: '', body: { kind: 'accreditation', provider: 'letters', investor: { id: 'HRC-0042', name: 'Dana Whitfield' } } });
    assert.equal(ver.status, 200, ver.text);
    server.store.put('verifications', { id: ver.body.id, status: 'verified', method: 'Letter from a CPA', completedAt: new Date(T0 + 60e3).toISOString() });
    const c = await complete(base, r.token, submission({ status: 'pending', ref: ver.body.id, connection: 'acc-own' }));
    assert.equal(c.status, 200, c.text);
    const n = (await outbox(base, r.id)).find((x) => x.kind === 'sponsor_notification');
    assert.equal(n.subject, 'Dana Whitfield verified their accreditation again');
    assert.match(n.text, /^Accredited investor: Verified$/m);
    assert.match(n.text, /^Investor: Dana Whitfield$/m);
    assert.ok(!/Identity:|Sanctions|Commitment|Subscription agreement|Offering:|Tax form/i.test(n.text), n.text);
    assert.ok(!VENDOR.test(n.text + n.html), 'no vendor word');
    const row = (await j(base, 'GET', '/v1/invitations?workspace=ws-harbor')).body.find((x) => x.id === r.id);
    assert.equal(row.status, 'completed');
  }));

test('reverify tier: with the package a sponsor account is charged the server’s reverify price from credit; the link runs accreditation only and is refused identity', async () => {
  for (const [env, price] of [[{}, 9900], [{ PACKAGE_PRICE_REVERIFY_CENTS: '6900' }, 6900]]) {
    const store = openStore(null);
    const pay = mockFetch([]);
    await withServer({ env: Object.assign({ ADMIN_TOKEN: ADMIN, DATA_KEY: KEY, PUBLIC_URL: 'https://verify.example', PORTAL_ORIGIN: 'https://portal.example', BILLING_SECRET_KEY: 'stand-in-not-a-key', BILLING_PUBLISHABLE_KEY: 'stand-in-not-a-key', RATE_LIMIT_PER_MIN: '0', IDCHECK_API_KEY: 'key-test-0123456789', IDCHECK_WORKFLOW: 'wf-test-1', IDCHECK_WEBHOOK_SECRET: 'whk-test-secret-abcdef', ACCREDIT_API_KEY: 'acc-test-0123456789' }, env), fetch: pay, store, providers: PROVIDERS, now: () => T0 }, async (base) => {
      const a = (await j(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace: 'ws-harbor', name: 'Harbor Ridge Capital' } })).body;
      store.put('billing', { id: a.id, creditCents: 20000 });
      const r = await invite(base, { verification: { connections: [], use: {}, accreditationRequired: false } }, { package: true, clientId: 'rv-1' }, a.token);
      const rec = store.get('invitations', r.id);
      const ents = store.list('entitlements').filter((e) => e.account === a.id);
      assert.equal(ents.length, 1);
      assert.equal(ents[0].tier, 'reverify', 'the entitlement’s tier is reverify');
      assert.equal(ents[0].cents, price, `charged ${price}, the server’s own setting`);
      assert.equal(rec.package.tier, 'reverify');
      assert.equal(store.get('billing', a.id).creditCents, 20000 - price, 'paid from credit');
      assert.equal(pay.calls.length, 0, 'no payment provider call');
      const v = await view(base, r.token);
      assert.deepEqual(v.verification.use, { accreditation: ['package-acc'] }, 'the snapshot holds only the package’s accreditation connection');
      assert.deepEqual(v.verification.connections.map((x) => x.id), ['package-acc']);
      const text = JSON.stringify(v);
      for (const w of ['"tier"', 'entitlement', '9900', '6900', '$99', '$69']) assert.ok(!text.includes(w), `GET /v1/invite holds no ${w}`);
      assert.ok(!('package' in v.invitation), 'the invitation has no package key');
      const acc = accreditCalls.length;
      const ok = await j(base, 'POST', '/v1/verifications', { token: r.token, bearer: '', body: { kind: 'accreditation', provider: 'accredit', investor: { id: 'HRC-0042', name: 'Dana Whitfield' } } });
      assert.equal(ok.status, 200, ok.text);
      assert.equal(accreditCalls.length, acc + 1, 'the accreditation stand-in ran once');
      const before = pay.calls.length;
      const no = await j(base, 'POST', '/v1/verifications', { token: r.token, bearer: '', body: { kind: 'identity', provider: 'idcheck', investor: { id: 'HRC-0042', name: 'Dana Whitfield' } } });
      assert.equal(no.status, 403, no.text);
      assert.equal(pay.calls.length, before, 'no identity provider call');
    });
  }
});

test('reverify plain: without the package nothing is charged and the firm’s own accreditation connection is used', () =>
  start(async (base, server, net) => {
    // The console sends the firm's connections as they are, its own identity check among them: the link uses accreditation only.
    const own = { connections: OWN.connections.concat({ id: 'id-own', name: 'Identity', type: 'server', connector: 'idown', checks: ['identity'] }), use: { identity: ['id-own'], accreditation: ['acc-own'] }, rules: OWN.rules, accreditationRequired: false };
    const r = await invite(base, { verification: own });
    assert.equal(server.store.list('entitlements').length, 0, 'no package');
    assert.equal(server.store.list('payments').length, 0, 'nothing charged');
    assert.equal(server.store.get('invitations', r.id).package, undefined);
    const v = await view(base, r.token);
    assert.deepEqual(v.verification.use, { accreditation: ['acc-own'] }, 'the link uses the firm’s own accreditation connection only');
    const ownN = ownCalls.length;
    const pkg = accreditCalls.length;
    const s = await j(base, 'POST', '/v1/verifications', { token: r.token, bearer: '', body: { kind: 'accreditation', provider: 'letters', investor: { id: 'HRC-0042', name: 'Dana Whitfield' } } });
    assert.equal(s.status, 200, s.text);
    assert.equal(ownCalls.length, ownN + 1, 'the firm’s own connection ran');
    assert.equal(accreditCalls.length, pkg, 'the package’s provider did not');
    // The firm's own identity connection would answer an ordinary invitation's link; a re-verification link is refused it.
    const idN = identityCalls.length;
    const id = await j(base, 'POST', '/v1/verifications', { token: r.token, bearer: '', body: { kind: 'identity', provider: 'idown', investor: { id: 'HRC-0042', name: 'Dana Whitfield' } } });
    assert.equal(id.status, 403, id.text);
    assert.equal(identityCalls.length, idN, 'no identity provider was called');
    assert.equal(net.calls.length, 0, 'nothing left this machine');
  }));

test('reverify snapshot: the stored snapshot of a request carries no address, taxpayer number, bank detail or tax pre-fill', () =>
  start(async (base, server) => {
    // Planted markers (not real numbers): each would be a leak if any reached the snapshot or the link.
    const planted = Object.assign({}, INVESTOR, { address: 'PLANTED-ADDRESS-MARKER', tin: 'PLANTED-TIN-MARKER', ssn: 'PLANTED-SSN-MARKER', bank: { account: 'PLANTED-BANK-MARKER', routing: 'PLANTED-ROUTING-MARKER' }, taxPrefill: { address: 'PLANTED-PREFILL-MARKER', country: 'United States', citizen: 'us', citizenship: '', consentAt: '' } });
    const r = await invite(base, { investor: planted });
    const snap = sealed(server, r.id);
    const all = JSON.stringify(snap) + JSON.stringify(await view(base, r.token));
    assert.ok(!/PLANTED-/.test(all), all.match(/PLANTED-[A-Z-]+/g));
    assert.equal(snap.investor.taxPrefill, undefined, 'no tax pre-fill');
    assert.deepEqual(Object.keys(snap.investor).sort(), ['contact', 'email', 'existing', 'id', 'title', 'type']);
    // The scan above is proven on a planted copy: a snapshot that kept the address would fail it.
    assert.ok(/PLANTED-/.test(JSON.stringify(Object.assign({}, snap, { investor: Object.assign({}, snap.investor, { address: planted.address }) }))));
  }));
