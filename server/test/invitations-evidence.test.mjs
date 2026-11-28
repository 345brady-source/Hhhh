// gate: tests 2
// A reviewer's letter on the imported record (08-CONTEXT "After 08-18"): when an accreditation result with letters arrives
// before the sponsor imports the investor's onboarding, the stored submission still names the letters (type and label
// only), so the console offers "Download letter". Letters the investor's browser claims are never kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';
import { BUILTINS } from '../providers/index.mjs';

const API = 'sponsor-api-token-0123456789';
const KEY = randomBytes(32).toString('base64');
const FIRM = { name: 'Harbor Ridge Capital', supportEmail: 'ir@harborridge.example' };
const payload = () => ({
  workspace: 'ws-harbor',
  portalUrl: 'https://portal.example/diy.html',
  notifyEmail: 'ops@harborridge.example',
  firm: FIRM,
  investor: { id: 'HRC-0007', contact: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
  offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', exemption: 'Rule 506(c)', documents: [] },
  invitation: { cents: 0 },
  verification: { connections: [{ id: 'c-sbx', name: 'Test checks', type: 'server', connector: 'sandbox', checks: ['identity', 'accreditation'] }], use: { identity: ['c-sbx'], accreditation: ['c-sbx'], aml: [] }, rules: {} },
  esign: { template: { title: 'Subscription agreement', roles: ['Investor', 'Sponsor'], fields: [] } }
});
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
const start = (fn) => withServer({ env: { API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: 'https://verify.example' }, providers: BUILTINS }, fn);
const own = { id: 'HRC-0007', name: 'Zelda Quixote' };

test('a result with letters that arrived before the import: the imported accreditation names the letters (type and label only)', () =>
  start(async (base, server) => {
    const r = (await j(base, 'POST', '/v1/invitations', { body: payload() })).body;
    const ver = await j(base, 'POST', '/v1/verifications', { token: r.token, auth: false, body: { kind: 'accreditation', provider: 'sandbox', investor: own } });
    assert.equal(ver.status, 200, JSON.stringify(ver.body));
    server.store.put('verifications', { id: ver.body.id, status: 'verified', evidence: [{ type: 'letter', label: 'Third-party verification letter', url: 'https://files.provider.example/l/1.pdf' }] });
    const verify = { accreditation: { status: 'pending', ref: ver.body.id, how: 'server' } };
    assert.equal((await j(base, 'POST', '/v1/invite/complete', { token: r.token, auth: false, body: { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', verify } } })).status, 200);
    const sub = (await j(base, 'GET', `/v1/invitations/${r.id}/submission`)).body;
    const a = sub.investor.verify.accreditation;
    assert.equal(a.status, 'verified');
    assert.equal(a.ref, ver.body.id);
    assert.deepEqual(a.evidence, [{ type: 'letter', label: 'Third-party verification letter' }]);
  }));

test('letters the investor’s browser claims are not kept: only the server’s check names letters', () =>
  start(async (base, server) => {
    const r = (await j(base, 'POST', '/v1/invitations', { body: payload() })).body;
    const ver = await j(base, 'POST', '/v1/verifications', { token: r.token, auth: false, body: { kind: 'accreditation', provider: 'sandbox', investor: own } });
    server.store.put('verifications', { id: ver.body.id, status: 'verified' });
    const verify = { accreditation: { status: 'verified', ref: ver.body.id, evidence: [{ type: 'letter', label: 'Forged letter', url: 'https://forged.example/x.pdf' }] } };
    assert.equal((await j(base, 'POST', '/v1/invite/complete', { token: r.token, auth: false, body: { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', verify } } })).status, 200);
    const a = (await j(base, 'GET', `/v1/invitations/${r.id}/submission`)).body.investor.verify.accreditation;
    assert.equal(a.status, 'verified');
    assert.equal(a.evidence, undefined);
  }));
