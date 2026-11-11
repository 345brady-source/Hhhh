// Round 3 (server review): an invitation's token runs only the checks the firm's settings use; an unconfirmed match from the
// browser is held for review; the investor's own names are always screened; a backed approval is the server's own statement;
// envelope pointers only name copies that came with the submission.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';
import { BUILTINS } from '../providers/index.mjs';

const API = 'sponsor-api-token-0123456789';
const KEY = randomBytes(32).toString('base64');
const pdf = () => Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n').toString('base64');
const screened = [];
const providers = Object.assign({}, BUILTINS, { fakescreen: { id: 'fakescreen', name: 'Test screening', kind: 'aml', kinds: ['aml'], env: [], screen: async (ctx) => (screened.push((ctx.names || []).slice()), { hits: [] }) } });
const USES_SERVER = { connections: [{ id: 'c-sbx', name: 'Test checks', type: 'server', connector: 'sandbox', checks: ['identity', 'accreditation'] }, { id: 'c-scr', name: 'Test screening', type: 'server', connector: 'fakescreen', checks: ['aml'] }], use: { identity: ['c-sbx'], accreditation: ['c-sbx'], aml: ['c-scr'] }, rules: {} };
const SANDBOX_IN_BROWSER = { connections: [{ id: 'sandbox', name: 'Sandbox', type: 'builtin', builtin: 'sandbox', checks: ['identity', 'aml', 'accreditation'] }], use: { identity: ['sandbox'], accreditation: ['sandbox'], aml: ['sandbox'] }, rules: {} };
const payload = (over = {}) =>
  Object.assign(
    {
      workspace: 'ws-harbor',
      portalUrl: 'https://portal.example/diy.html',
      notifyEmail: 'ops@harborridge.example',
      firm: { name: 'Harbor Ridge Capital', supportEmail: 'ir@harborridge.example' },
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Quixote Family Trust', type: 'trust', email: 'zelda@investor.example' },
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', exemption: 'Rule 506(b)', documents: [] },
      invitation: { cents: 0 },
      verification: USES_SERVER,
      esign: { template: { title: 'Agreement', roles: ['Investor'], fields: [] } }
    },
    over
  );
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
const ME = { id: 'HRC-0007', name: 'Zelda Quixote', email: 'zelda@investor.example' };

test('an invitation token cannot run the test sandbox (or any provider) the firm’s settings do not use for that check', () =>
  start(async (base) => {
    const r = await create(base, { verification: SANDBOX_IN_BROWSER });
    const v = await j(base, 'POST', '/v1/verifications', { token: r.token, auth: false, body: { kind: 'accreditation', provider: 'sandbox', investor: ME } });
    assert.equal(v.status, 403);
    assert.match(v.body.error, /not one the firm uses/);
    const s = await j(base, 'POST', '/v1/screenings', { token: r.token, auth: false, body: { provider: 'fakescreen', names: ['Zelda Quixote'], investor: ME } });
    assert.equal(s.status, 403);
    // The sponsor's own token is unaffected.
    assert.equal((await j(base, 'POST', '/v1/verifications', { body: { kind: 'identity', provider: 'sandbox', investor: Object.assign({ workspace: 'ws-harbor' }, ME) } })).status, 200);
    // A firm that uses a server connector for the check: allowed.
    const r2 = await create(base);
    assert.equal((await j(base, 'POST', '/v1/verifications', { token: r2.token, auth: false, body: { kind: 'accreditation', provider: 'sandbox', investor: ME } })).status, 200);
  }));

test('a check the sponsor ran with a provider the firm does not use for that kind confirms nothing', () =>
  start(async (base) => {
    const r = await create(base, { verification: SANDBOX_IN_BROWSER });
    const v = await j(base, 'POST', '/v1/verifications', { body: { kind: 'accreditation', provider: 'sandbox', investor: Object.assign({ workspace: 'ws-harbor' }, ME) } });
    await fetch(`https://verify.example/sandbox/x`).catch(() => {});
    const done = await complete(base, r.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', verify: { accreditation: { status: 'verified', ref: v.body.id, connection: 'sandbox', how: 'sandbox' } } } });
    assert.equal(done.status, 200);
    const sub = (await j(base, 'GET', `/v1/invitations/${r.id}/submission`)).body;
    assert.equal(sub.investor.verify.accreditation.status, 'review');
    assert.equal(sub.investor.verify.accreditation.ref, '');
  }));

test('a match the browser reports without a screening here is held for review, never "clear"', () =>
  start(async (base) => {
    const r = await create(base);
    const done = await complete(base, r.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', verify: { aml: { status: 'clear', screenedAt: '2026-11-10', results: [{ status: 'match', ref: '', hits: [{ name: 'Zelda Q', list: 'SDN' }] }] } } } });
    assert.equal(done.status, 200);
    const sub = (await j(base, 'GET', `/v1/invitations/${r.id}/submission`)).body;
    assert.equal(sub.investor.verify.aml.status, 'potential_match');
    assert.equal(sub.checks.aml.status, 'potential_match');
    assert.equal(sub.investor.verify.aml.screenedAt, undefined);
    const n = (await j(base, 'GET', `/v1/outbox?invitation=${r.id}`)).body.messages.find((m) => m.kind === 'sponsor_notification');
    assert.match(n.text, /^Sanctions screening: Potential match, held for your review$/m);
  }));

test('a screening from the investor’s link always includes the investor’s names as the sponsor entered them', () =>
  start(async (base) => {
    const r = await create(base);
    screened.length = 0;
    const s = await j(base, 'POST', '/v1/screenings', { token: r.token, auth: false, body: { provider: 'fakescreen', names: ['Not My Name'], investor: ME } });
    assert.equal(s.status, 200, JSON.stringify(s.body));
    assert.deepEqual(screened[0].slice().sort(), ['Not My Name', 'Quixote Family Trust', 'Zelda Quixote'].sort());
  }));

test('a backed approval is rewritten by the server: the browser’s time, author and manual flag are not kept', () =>
  withServer({ env: { API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: 'https://verify.example', RESULTS_TOKEN: 'results-token-0123456789abcdef', RATE_LIMIT_PER_MIN: '0' }, providers }, async (base, server) => {
    const r = await create(base);
    const id = await j(base, 'POST', '/v1/verifications', { token: r.token, auth: false, body: { kind: 'identity', provider: 'sandbox', investor: ME } });
    assert.equal(id.status, 200, JSON.stringify(id.body));
    // The provider reports the result through the results API, as a real one would.
    const reference = id.body.id;
    const res = await fetch(`${base}/v1/results`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer results-token-0123456789abcdef' }, body: JSON.stringify({ reference, status: 'passed' }) });
    assert.equal(res.status, 200, await res.text());
    assert.equal(server.store.get('verifications', id.body.id).status, 'passed');
    const scr = await j(base, 'POST', '/v1/screenings', { token: r.token, auth: false, body: { provider: 'fakescreen', names: ['Zelda Quixote'], investor: ME } });
    const done = await complete(base, r.token, {
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', verify: { identity: { status: 'passed', ref: id.body.id }, aml: { status: 'clear', results: [{ status: 'clear', ref: scr.body.id }] }, accreditation: { status: 'not_started' }, decision: { status: 'approved', at: '2099-12-31T00:00:00Z', by: 'Someone on staff', manual: true } } }
    });
    assert.equal(done.status, 200);
    const d = (await j(base, 'GET', `/v1/invitations/${r.id}/submission`)).body.investor.verify.decision;
    assert.equal(d.status, 'approved');
    assert.equal(d.by, 'automatic');
    assert.ok(!d.manual);
    assert.ok(d.at < '2099', d.at);
  }));

test('envelope pointers name only copies that came with the submission; a completed envelope needs its signed copy', () =>
  start(async (base) => {
    const r = await create(base);
    const done = await complete(base, r.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote' }, envelope: { id: 'env-9', status: 'completed', workDocId: 'env-9-work', signedDocId: 'tpl-doc-1', signers: [{ role: 'investor', status: 'signed' }] }, files: { 'tpl-doc-1': pdf() } });
    assert.equal(done.status, 200);
    const env = (await j(base, 'GET', `/v1/invitations/${r.id}/submission`)).body.envelope;
    assert.equal(env.status, 'sent');
    assert.equal(env.signedDocId, null);
    assert.equal(env.workDocId, null);
  }));
