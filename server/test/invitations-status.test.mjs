// Plan 06-06 (phase 6, D-01 in server mode): the investor-status answers ride on the subscription request
// (request.qual: Rule 506(b), Regulation A Tier 2 and the benefit plan questions) through /v1/invite/complete
// and come back to the console's pickup (GET /v1/invitations/:id/submission) exactly as the device sent them.
// The server neither reads nor recomputes them (the console recomputes every count, limit and percentage from
// the stored answers: T-06-13), and the existing 256 KB limit on the request still applies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';

const DAY = 864e5;
const T0 = Date.parse('2026-11-10T12:00:00Z');
const API = 'sponsor-api-token-status-0123456789';
const KEY = randomBytes(32).toString('base64');
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', colors: { primary: '#123456', accent: '#1F7A8C' }, portalName: 'Harbor Ridge Investor Portal', onboarding: { accreditation: false } };

/** What the console sends: an offering under Rule 506(b) with no commitment set, so the amount is the investor's. */
function payload(over = {}) {
  return Object.assign(
    {
      workspace: 'ws-harbor',
      sendEmail: false,
      portalUrl: PORTAL,
      firm: FIRM,
      investor: { id: 'HRC-0042', contact: 'Dana Whitfield', title: 'Dana Whitfield', type: 'individual', email: 'dana@investor.example' },
      offering: { id: 'hr-fund-iii', name: 'Harbor Ridge Fund III', shortName: 'Fund III', type: 'Real estate', minimum: 50000, exemption: 'Rule 506(b)', classes: [{ id: 'A', name: 'Class A Interests' }], currency: 'USD', documents: [] },
      invitation: { cents: 0, cls: '', note: '', expiresAt: new Date(T0 + 30 * DAY).toISOString() },
      verification: { connections: [], use: {}, rules: { accreditationFor: '506c' } },
      esign: { template: { title: 'Subscription agreement', roles: ['investor', 'countersigner'], fields: [], pages: 1, pageSizes: [[612, 792]], sha256: 'abc' }, pdf: pdf('TEMPLATE').toString('base64') }
    },
    over
  );
}
/** Every status answer the investor's page can put on request.qual (assets/js/onboarding.js qualFrom). */
const QUAL = {
  regime: '506b',
  at: '2026-11-10T12:20:00Z',
  accredited: false,
  basis: '',
  sophistication: { experience: 'Twelve years of private real estate and venture fund commitments', education: 'Civil engineer, MBA', rep: { name: 'Morgan Ellery', firm: 'Ellery Advisory Partners', fileId: 'rep-HRC-0042-mh2x1q', fileName: 'acknowledgment.pdf' } },
  regA: { kind: 'person', figures: { income: 85000, worth: 120000, revenue: null, assets: null }, limitCents: 1200000, commitmentCents: 6000000, overLimit: true },
  erisa: { plan: 'planAssets', planPct: 40, controlling: false, share: 0.4 },
  note: 'Unicode stays as typed: Zoë, “quotes”, 10 %'
};
function submission(qual, over = {}) {
  return Object.assign(
    {
      investor: { id: 'HRC-0042', contact: 'Dana Whitfield', title: 'Dana Whitfield', email: 'dana@investor.example', type: 'individual', verify: { identity: { status: 'passed' }, aml: { status: 'clear' }, accreditation: { status: 'not_started' } }, onboarding: { status: 'complete' } },
      request: { id: 'req-status-1', type: 'subscription', offeringId: 'hr-fund-iii', investorId: 'HRC-0042', cls: 'A', cents: 6000000, status: 'pending', envelopeId: 'env-s1', qual },
      envelope: { id: 'env-s1', status: 'sent', requestId: 'req-status-1', docId: 'tpl-doc-1', workDocId: 'env-s1-work' },
      files: { 'env-s1-work': pdf('SIGNED').toString('base64') },
      docs: [],
      audit: [{ at: '2026-11-10T12:20:00Z', actor: 'Dana Whitfield (investor)', action: 'Investor status answered', detail: 'Dana Whitfield: not an accredited investor' }],
      notifications: []
    },
    over
  );
}

function start(fn) {
  const clock = { t: T0 };
  return withServer({ env: { API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: 'https://verify.example' }, now: () => clock.t }, (base, server) => fn(base, server, clock));
}
async function j(base, method, path, { body, token, auth = true } = {}) {
  const h = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, auth ? { Authorization: `Bearer ${API}` } : {}, token !== undefined ? { 'X-Invite-Token': token } : {});
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}
async function invite(base, over) {
  const r = await j(base, 'POST', '/v1/invitations', { body: payload(over) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
const complete = (base, token, body) => j(base, 'POST', '/v1/invite/complete', { token, auth: false, body });

test('request.qual (506(b), Regulation A Tier 2 and benefit plan answers) reaches the console’s pickup unchanged', () =>
  start(async (base, server) => {
    const r = await invite(base);
    const sent = JSON.parse(JSON.stringify(QUAL));
    const c = await complete(base, r.token, submission(sent));
    assert.deepEqual(c.body, { ok: true });
    // Encrypted at rest like the rest of the submission (DATA_KEY): no answer is readable in the store.
    const raw = JSON.stringify(server.store.data());
    assert.ok(!raw.includes('Ellery Advisory Partners') && !raw.includes('planAssets'), 'the answers are sealed at rest');
    const [row] = (await j(base, 'GET', '/v1/invitations?workspace=ws-harbor')).body;
    assert.equal(row.hasSubmission, true);
    const sub = await j(base, 'GET', `/v1/invitations/${r.id}/submission`);
    assert.equal(sub.status, 200);
    assert.deepEqual(sub.body.request.qual, QUAL, 'qual comes back exactly as the device sent it');
    // The invitation's own ids still win over the device's (T-06-14), and the device's flags are kept, not recomputed.
    assert.equal(sub.body.request.investorId, 'HRC-0042');
    assert.equal(sub.body.request.offeringId, 'hr-fund-iii');
    assert.equal(sub.body.request.cents, 6000000);
    assert.equal(sub.body.request.qual.regA.overLimit, true);
    assert.equal(sub.body.request.qual.erisa.share, 0.4);
    // A device that claims a flag the figures do not support gets it passed through as sent: the console recomputes.
    const r2 = await invite(base, { investor: { id: 'HRC-0043', contact: 'Lee Okafor', title: 'Lee Okafor', type: 'individual', email: 'lee@investor.example' } });
    const lying = Object.assign({}, QUAL, { regA: Object.assign({}, QUAL.regA, { overLimit: false }) });
    const s2 = submission(lying);
    s2.investor = Object.assign({}, s2.investor, { id: 'HRC-0043', contact: 'Lee Okafor', title: 'Lee Okafor', email: 'lee@investor.example' });
    s2.request = Object.assign({}, s2.request, { investorId: 'HRC-0043' });
    assert.deepEqual((await complete(base, r2.token, s2)).body, { ok: true });
    const sub2 = await j(base, 'GET', `/v1/invitations/${r2.id}/submission`);
    assert.deepEqual(sub2.body.request.qual, lying);
  }));

test('an investor’s answers for a commitment the sponsor set: qual unchanged, the locked amount forced', () =>
  start(async (base) => {
    const r = await invite(base, { invitation: { cents: 6000000, cls: 'A', note: '', expiresAt: new Date(T0 + 30 * DAY).toISOString() } });
    const qual = { regime: 'regA2', at: '2026-11-10T12:20:00Z', accredited: false, basis: '', regA: { kind: 'organization', figures: { income: null, worth: null, revenue: 400000, assets: 250000 }, limitCents: 4000000, commitmentCents: 6000000, overLimit: true }, erisa: { plan: '4975', planPct: null, controlling: true, share: 1 } };
    assert.deepEqual((await complete(base, r.token, submission(qual))).body, { ok: true });
    const sub = await j(base, 'GET', `/v1/invitations/${r.id}/submission`);
    assert.deepEqual(sub.body.request.qual, qual);
    assert.equal(sub.body.request.cents, 6000000);
  }));

test('the request size limit (256 KB) still applies with status answers on it', () =>
  start(async (base) => {
    const r = await invite(base);
    const big = Object.assign({}, QUAL, { sophistication: Object.assign({}, QUAL.sophistication, { experience: 'x'.repeat(300 * 1024) }) });
    const res = await complete(base, r.token, submission(big));
    assert.equal(res.status, 413);
    assert.match(res.body.error, /request is too large \(at most 256 KB\)/);
    const [row] = (await j(base, 'GET', '/v1/invitations?workspace=ws-harbor')).body;
    assert.equal(row.hasSubmission, false, 'nothing stored for a refused completion');
    assert.notEqual(row.status, 'completed');
    // Just under the limit is accepted, and the answers come back whole.
    const fits = Object.assign({}, QUAL, { sophistication: Object.assign({}, QUAL.sophistication, { experience: 'y'.repeat(200 * 1024) }) });
    assert.deepEqual((await complete(base, r.token, submission(fits))).body, { ok: true });
    const sub = await j(base, 'GET', `/v1/invitations/${r.id}/submission`);
    assert.deepEqual(sub.body.request.qual, fits);
  }));
