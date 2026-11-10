// What the server vouches for in a finished onboarding: verification results only from its own checks
// for that investor and workspace, no countersignature from the investor's browser, the sponsor's
// commitment and offering, and uploads that race a resend.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';
import { BUILTINS } from '../providers/index.mjs';

const API = 'sponsor-api-token-0123456789';
const KEY = randomBytes(32).toString('base64');
const pdf = () => Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n').toString('base64');
const FIRM = { name: 'Harbor Ridge Capital', supportEmail: 'ir@harborridge.example' };
const providers = Object.assign({}, BUILTINS, { fakescreen: { id: 'fakescreen', name: 'Test screening', kind: 'aml', kinds: ['aml'], env: [], screen: async () => ({ hits: [] }) } });

const payload = (over = {}) =>
  Object.assign(
    {
      workspace: 'ws-harbor',
      portalUrl: 'https://portal.example/diy.html',
      notifyEmail: 'ops@harborridge.example',
      firm: FIRM,
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', exemption: 'Rule 506(c)', documents: [] },
      invitation: { cents: 0 },
      esign: { template: { title: 'Subscription agreement', roles: ['Investor', 'Sponsor'], fields: [] } }
    },
    over
  );
const investor = (verify, extra) => Object.assign({ id: 'HRC-0007', contact: 'Zelda Quixote', verify }, extra);
async function j(base, method, path, { body, token, auth = true } = {}) {
  const headers = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, auth ? { Authorization: `Bearer ${API}` } : {}, token ? { 'X-Invite-Token': token } : {});
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}
const start = (fn) => withServer({ env: { API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: 'https://verify.example' }, providers }, fn);
const create = async (base, over) => (await j(base, 'POST', '/v1/invitations', { body: payload(over) })).body;
const complete = (base, token, body) => j(base, 'POST', '/v1/invite/complete', { token, auth: false, body });
const submissionOf = async (base, id) => (await j(base, 'GET', `/v1/invitations/${id}/submission`)).body;
const note = async (base, id) => (await j(base, 'GET', `/v1/outbox?invitation=${id}`)).body.messages.find((m) => m.kind === 'sponsor_notification');

test('forged results are corrected in the stored submission: identity and accreditation held for review, sanctions to be screened again, no approval', () =>
  start(async (base) => {
    const r = await create(base);
    const forged = investor(
      { identity: { status: 'passed', ref: 'ver_not_on_this_server' }, accreditation: { status: 'verified', expiresAt: '2099-01-01' }, aml: { status: 'clear', results: [{ how: 'server', status: 'clear', ref: 'scr_forged' }] }, decision: { status: 'approved', manual: true } },
      { kyc: { status: 'cleared', screening: 'clear' } }
    );
    assert.equal((await complete(base, r.token, { investor: forged, request: { id: 'req-1', offeringId: 'hr-fund-ii', cents: 10000000 } })).status, 200);
    const sub = await submissionOf(base, r.id);
    const v = sub.investor.verify;
    assert.equal(v.identity.status, 'review');
    assert.equal(v.identity.reportedStatus, 'passed');
    assert.equal(v.accreditation.status, 'review');
    assert.equal(v.accreditation.expiresAt, undefined);
    assert.equal(v.aml.status, 'pending');
    assert.deepEqual([v.aml.results[0].status, v.aml.results[0].ref], ['pending', '']);
    assert.equal(v.decision.status, 'review');
    assert.equal(sub.investor.kyc.status, 'review');
    assert.equal(sub.investor.kyc.screening, 'pending');
    assert.equal(sub.checks.identity.unconfirmed, true);
    const n = await note(base, r.id);
    assert.match(n.text, /Identity: Needs your review/);
    assert.match(n.text, /Sanctions screening: Not confirmed/);
  }));

test('an investor record with no verify block cannot pass as already verified (the console’s legacy path)', () =>
  start(async (base) => {
    const r = await create(base);
    assert.equal((await complete(base, r.token, { investor: { id: 'HRC-0007', kyc: { status: 'cleared' }, accreditation: { date: '2026-11-01' } } })).status, 200);
    const sub = await submissionOf(base, r.id);
    assert.ok(sub.investor.verify && sub.investor.verify.identity, 'a verify block is always present');
    assert.equal(sub.investor.kyc.status, 'pending');
    assert.match((await note(base, r.id)).text, /Accredited investor: Self-certified by the investor/);
  }));

test('checks this server ran for the investor are confirmed; checks for the same id in another workspace are not', () =>
  start(async (base, server) => {
    const r = await create(base);
    const own = { id: 'HRC-0007', name: 'Zelda Quixote' };
    const mine = await j(base, 'POST', '/v1/verifications', { token: r.token, auth: false, body: { kind: 'identity', provider: 'sandbox', investor: own } });
    server.store.put('verifications', { id: mine.body.id, status: 'passed' });
    const theirs = await j(base, 'POST', '/v1/verifications', { body: { kind: 'accreditation', provider: 'sandbox', investor: Object.assign({ workspace: 'ws-other' }, own) } });
    server.store.put('verifications', { id: theirs.body.id, status: 'verified' });
    const s = await j(base, 'POST', '/v1/screenings', { token: r.token, auth: false, body: { provider: 'fakescreen', names: ['Zelda Quixote'], investor: own } });
    const verify = { identity: { status: 'pending', ref: mine.body.id }, accreditation: { status: 'verified', ref: theirs.body.id }, aml: { status: 'pending', results: [{ how: 'server', status: 'pending', ref: s.body.id }] } };
    assert.equal((await complete(base, r.token, { investor: investor(verify) })).status, 200);
    const sub = await submissionOf(base, r.id);
    assert.equal(sub.investor.verify.identity.status, 'passed', 'the server’s later result replaces the browser’s');
    assert.equal(sub.investor.verify.accreditation.status, 'review', 'another workspace’s check confirms nothing');
    assert.equal(sub.investor.verify.aml.status, 'clear');
    const n = await note(base, r.id);
    assert.match(n.text, /Identity: Verified/);
    assert.match(n.text, /Sanctions screening: Clear/);
  }));

test('a countersignature never arrives from the investor; an investor-only agreement can be complete', () =>
  start(async (base) => {
    const r = await create(base);
    const envelope = { id: 'env-1', status: 'completed', signedDocId: 'env-1-signed', signers: [{ role: 'investor', status: 'signed' }, { role: 'countersigner', status: 'signed', signedAt: '2026-11-10', signature: 'data:x' }] };
    assert.equal((await complete(base, r.token, { investor: investor({}), envelope, files: { 'env-1-work': pdf() } })).status, 200);
    const env = (await submissionOf(base, r.id)).envelope;
    assert.equal(env.status, 'sent');
    assert.equal(env.signedDocId, null);
    assert.deepEqual([env.signers[1].status, env.signers[1].signature], ['waiting', null]);
    assert.match((await note(base, r.id)).text, /waiting for your countersignature/);

    const solo = await create(base, { esign: { template: { title: 'Agreement', roles: ['Investor'], fields: [] } } });
    assert.equal((await complete(base, solo.token, { investor: investor({}), envelope: { id: 'env-2', status: 'completed', signers: [{ role: 'investor', status: 'signed' }] } })).status, 200);
    assert.equal((await submissionOf(base, solo.id)).envelope.status, 'completed');
    const text = (await note(base, solo.id)).text;
    assert.match(text, /Subscription agreement: Signed by the investor/);
    assert.ok(!/countersign/i.test(text));
  }));

test('the sponsor’s commitment and offering: a matching submission is kept, an open commitment is the investor’s', () =>
  start(async (base) => {
    const locked = await create(base, { invitation: { cents: 25000000 } });
    assert.equal((await complete(base, locked.token, { investor: investor({}), request: { id: 'q', cents: 100 } })).status, 400);
    assert.equal((await complete(base, locked.token, { investor: investor({}), request: { id: 'q', offeringId: 'elsewhere', cents: 25000000 } })).status, 400);
    assert.equal((await complete(base, locked.token, { investor: investor({}), request: { id: 'q' } })).status, 200);
    const req = (await submissionOf(base, locked.id)).request;
    assert.deepEqual([req.cents, req.offeringId], [25000000, 'hr-fund-ii'], 'filled in from the invitation');
    const open = await create(base);
    assert.equal((await complete(base, open.token, { investor: investor({}), request: { id: 'q', cents: 12300000 } })).status, 200);
    assert.equal((await submissionOf(base, open.id)).request.cents, 12300000);
    const none = await create(base, { offering: null, esign: null });
    assert.equal((await complete(base, none.token, { investor: investor({}), request: { id: 'q', cents: 100 } })).status, 400, 'no offering, nothing to subscribe to');
  }));

test('a resend while the investor’s upload is in progress: the old link’s upload is refused', () =>
  start(async (base, server) => {
    const r = await create(base);
    const buf = Buffer.from(JSON.stringify({ investor: investor({}) }));
    const u = new URL(base);
    const res = new Promise((resolve, reject) => {
      const req = http.request({ host: u.hostname, port: u.port, path: '/v1/invite/complete', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length, 'X-Invite-Token': r.token } }, (x) => {
        x.resume();
        x.on('end', () => resolve(x.statusCode));
      });
      req.on('error', reject);
      req.write(buf.subarray(0, 5));
      setTimeout(async () => {
        assert.equal((await j(base, 'POST', `/v1/invitations/${r.id}/resend`, { body: { sendEmail: false } })).status, 200);
        req.end(buf.subarray(5));
      }, 100);
    });
    assert.equal(await res, 401);
    assert.notEqual(server.store.get('invitations', r.id).status, 'completed');
  }));
