// Plan 06-27 (phase 6, D-10, D-09, D-30): the sponsor invites an investor already on file to subscribe and ticks "Include
// tax form". The console sends the invitation to subscribe (existing: true, with an offering) marked includeTax, with the
// form's pre-fill. The integration server keeps the flag and the pre-fill for such an invitation only, names the tax form in
// the investor's email, brings back the signed (or uploaded) tax form beside the subscription and the agreement, and tells
// the sponsor which form came back. Without the flag an investor on file's tax form is still never taken from the device.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer, stripLinkTokens } from './helpers.mjs';

const DAY = 864e5;
const T0 = Date.parse('2026-11-10T12:00:00Z');
const API = 'sponsor-api-token-includetax-0123456789';
const KEY = randomBytes(32).toString('base64');
// The portal page's address (its name holds no product word: the email's white-label check reads the link too).
const PORTAL = 'https://portal.example/portal.html?tenant=harbor';
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', colors: { primary: '#123456', accent: '#1F7A8C' }, portalName: 'Harbor Ridge Investor Portal', onboarding: { accreditation: false } };
const OFFERING = { id: 'hr-fund-iii', name: 'Harbor Ridge Fund III', exemption: 'Rule 506(b)', documents: [] };
const PREFILL = { address: '1418 Juniper Hollow Road, Missoula, MT 59801', country: 'United States', citizen: 'us', citizenship: '', consentAt: '2026-03-02T15:04:05Z' };
const ONFILE = { accredited: false, accreditedUntil: '', holds: false };
const INVESTOR = { id: 'HRC-0061', contact: 'Ingrid Achterberg', title: 'Ingrid Achterberg', type: 'individual', email: 'ingrid@investor.example', taxType: 'us-individual', existing: ONFILE, taxPrefill: Object.assign({ ssn: '529-04-7318', bank: '000765432' }, PREFILL) };

/** What the console sends for an invitation to subscribe that includes the tax form. */
function payload(over = {}) {
  return Object.assign(
    {
      workspace: 'ws-harbor',
      portalUrl: PORTAL,
      notifyEmail: 'ops@harborridge.example',
      firm: FIRM,
      investor: INVESTOR,
      offering: OFFERING,
      invitation: { cents: 0, cls: '', note: '', existing: true, includeTax: true, expiresAt: new Date(T0 + 30 * DAY).toISOString() },
      verification: { connections: [], use: {}, rules: {} }
    },
    over
  );
}
function taxEnv(over = {}) {
  return Object.assign(
    {
      id: 'env-t1',
      kind: 'tax',
      title: 'Form W-9 - Ingrid Achterberg',
      fileName: 'Form_W-9.pdf',
      taxForm: { form: 'W-9', revision: 'Rev. March 2024' },
      status: 'completed',
      completedAt: '2026-11-10T12:15:00Z',
      docId: 'env-t1-orig',
      workDocId: 'env-t1-work',
      signedDocId: 'env-t1-signed',
      sha256Signed: 'f'.repeat(64),
      signers: [{ id: 'sg-1', role: 'investor', investorId: 'HRC-0061', name: 'Ingrid Achterberg', email: 'ingrid@investor.example', status: 'signed', signedAt: '2026-11-10T12:15:00Z' }],
      fields: [{ id: 'fd-1', signerId: 'sg-1', type: 'signature', page: 1, x: 0.2, y: 0.7, w: 0.3, h: 0.03, required: false, value: 'adopted' }]
    },
    over
  );
}
const taxDoc = () => ({ id: 'env-t1-signed', title: 'Form W-9 - Ingrid Achterberg', fileName: 'Form_W-9_-_Ingrid_Achterberg_signed.pdf', type: 'application/pdf', cat: 'Tax', audience: 'investors', investors: ['HRC-0061'], offeringId: null, date: '2026-11-10', envelopeId: 'env-t1' });
/** The device's completion: the subscription, the agreement the investor signed (work copy) and the signed W-9. */
function submission(over = {}) {
  return Object.assign(
    {
      investor: { id: 'HRC-0061', contact: 'Ingrid Achterberg', title: 'Ingrid Achterberg', email: 'ingrid@investor.example', type: 'individual', taxForm: 'W-9', taxCert: { form: 'W-9', revision: 'Rev. March 2024', envelopeId: 'env-t1', at: '2026-11-10T12:15:00Z', signed: true, signedBy: 'Ingrid Achterberg', tinLast4: '7318', backupWithholding: false }, onboarding: { status: 'complete' } },
      request: { id: 'req-61', offeringId: 'hr-fund-iii', cents: 7500000 },
      envelope: { id: 'env-s1', status: 'sent', docId: 'tpl-doc-1', workDocId: 'env-s1-work', signers: [{ id: 'sg-a', role: 'investor', investorId: 'HRC-0061', status: 'signed' }] },
      taxEnvelope: taxEnv(),
      files: { 'env-t1-signed': pdf('W9 SIGNED WITH SUBSCRIPTION').toString('base64'), 'env-s1-work': pdf('AGREEMENT SIGNED').toString('base64') },
      docs: [taxDoc()],
      audit: [{ at: '2026-11-10T12:15:00Z', actor: 'Ingrid Achterberg (investor)', action: 'Tax form signed', detail: 'Ingrid Achterberg: Form W-9 (Rev. March 2024); signed by Ingrid Achterberg' }],
      notifications: []
    },
    over
  );
}

const start = (fn) => withServer({ env: { API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: 'https://verify.example' }, now: () => T0 }, (base, server) => fn(base, server));
async function j(base, method, path, { body, token, auth = true } = {}) {
  const h = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, auth ? { Authorization: `Bearer ${API}` } : {}, token !== undefined ? { 'X-Invite-Token': token } : {});
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}
async function invite(base, over) {
  const r = await j(base, 'POST', '/v1/invitations', { body: payload(over) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
const complete = (base, token, body) => j(base, 'POST', '/v1/invite/complete', { token, auth: false, body });
const outbox = async (base, id) => (await j(base, 'GET', `/v1/outbox?invitation=${id}`)).body.messages;
const snapOf = async (base, token) => (await j(base, 'GET', '/v1/invite', { token, auth: false })).body;
const submissionOf = async (base, id) => (await j(base, 'GET', `/v1/invitations/${id}/submission`)).body;

test('an invitation to subscribe that includes the tax form: the flag and the form’s pre-fill reach the link, nothing else of the record; the email names the tax form', () =>
  start(async (base) => {
    const r = await invite(base);
    const snap = await snapOf(base, r.token);
    assert.equal(snap.invitation.includeTax, true);
    assert.equal(snap.invitation.existing, true);
    assert.equal(snap.invitation.taxRequest, undefined, 'it is an invitation to subscribe, not a tax-form request');
    assert.equal(snap.offering.id, 'hr-fund-iii');
    assert.deepEqual(snap.investor.taxPrefill, PREFILL, 'only the address, country, citizenship and consent date the form needs');
    assert.equal(snap.investor.taxType, 'us-individual');
    assert.ok(!JSON.stringify(snap).includes('529-04-7318') && !JSON.stringify(snap).includes('000765432'), 'no taxpayer ID or bank number');
    const [m] = await outbox(base, r.id);
    assert.equal(m.subject, 'Harbor Ridge Capital: your subscription to Harbor Ridge Fund III');
    assert.match(m.text, /has invited you to subscribe to Harbor Ridge Fund III/);
    assert.match(m.text, /the offering documents, your tax form, your commitment and the subscription agreement/);
    assert.ok(!/photo ID|bank details/i.test(m.text), m.text);
    assert.ok(!/carrow|powered by|diy/i.test(stripLinkTokens(m.text + m.html)));
  }));

test('without the box the invitation to subscribe is as before: no flag, no pre-fill, the email does not mention a tax form', () =>
  start(async (base) => {
    const r = await invite(base, { invitation: { cents: 0, existing: true } });
    const snap = await snapOf(base, r.token);
    assert.equal(snap.invitation.includeTax, undefined);
    assert.equal(snap.investor.taxPrefill, undefined, 'no address travels with a plain invitation to subscribe');
    const [m] = await outbox(base, r.id);
    assert.ok(!/tax form/i.test(m.text), m.text);
  }));

test('the flag and the pre-fill count only for an investor on file invited to an offering: a new investor, or no offering, carries neither', () =>
  start(async (base) => {
    const fresh = await invite(base, { investor: { id: 'HRC-0070', contact: 'Nina New', email: 'nina@investor.example', taxPrefill: PREFILL }, invitation: { cents: 0, includeTax: true } });
    const s1 = await snapOf(base, fresh.token);
    assert.equal(s1.invitation.includeTax, undefined, 'a new investor’s onboarding has its own tax step');
    assert.equal(s1.investor.taxPrefill, undefined);
    const none = await invite(base, { investor: Object.assign({}, INVESTOR, { id: 'HRC-0071', email: 'noff@investor.example' }), offering: null, invitation: { cents: 0, existing: true, includeTax: true } });
    const s2 = await snapOf(base, none.token);
    assert.equal(s2.invitation.includeTax, undefined, 'only with an offering to subscribe to');
    assert.equal(s2.investor.taxPrefill, undefined);
  }));

test('the completion brings back the signed tax form (envelope, signed copy, one Tax listing) beside the subscription and the agreement; the sponsor hears the form came back signed', () =>
  start(async (base) => {
    const r = await invite(base);
    const c = await complete(base, r.token, submission());
    assert.equal(c.status, 200, JSON.stringify(c.body));
    const got = await submissionOf(base, r.id);
    assert.ok(got.taxEnvelope && got.taxEnvelope.id === 'env-t1' && got.taxEnvelope.status === 'completed', 'the tax envelope comes back');
    assert.equal(Buffer.from(got.files['env-t1-signed'], 'base64').toString(), pdf('W9 SIGNED WITH SUBSCRIPTION').toString(), 'the signed copy byte for byte');
    assert.equal((got.docs || []).filter((d) => d.cat === 'Tax').length, 1);
    assert.ok(got.request && got.request.id === 'req-61', 'the subscription is kept');
    assert.ok(got.envelope && got.envelope.id === 'env-s1', 'the agreement is kept');
    assert.equal(Buffer.from(got.files['env-s1-work'], 'base64').toString(), pdf('AGREEMENT SIGNED').toString(), 'with its file');
    const n = (await outbox(base, r.id)).find((x) => x.kind === 'sponsor_notification');
    assert.equal(n.subject, 'Ingrid Achterberg finished their subscription to Harbor Ridge Fund III');
    assert.match(n.text, /^Tax form: Form W-9, signed$/m);
    assert.match(n.text, /^Subscription agreement: /m);
  }));

test('an uploaded form comes back too; one finished without a signature brings no file and the notice says so', () =>
  start(async (base) => {
    const up = 'tax-HRC-0061-mh2x1q';
    const r1 = await invite(base);
    const s1 = submission({ taxEnvelope: null, docs: [], files: { [up]: pdf('W-9 COMPLETED ON PAPER').toString('base64') } });
    s1.investor = Object.assign({}, s1.investor, { taxCert: { form: 'W-9', uploaded: true, fileId: up, fileName: 'w9.pdf', at: '2026-11-10T12:10:00Z' } });
    assert.equal((await complete(base, r1.token, s1)).status, 200);
    const g1 = await submissionOf(base, r1.id);
    assert.equal(Buffer.from(g1.files[up], 'base64').toString(), pdf('W-9 COMPLETED ON PAPER').toString());
    assert.match((await outbox(base, r1.id)).find((x) => x.kind === 'sponsor_notification').text, /^Tax form: Form W-9, uploaded$/m);
    const r2 = await invite(base, { investor: Object.assign({}, INVESTOR, { id: 'HRC-0062', email: 'unsigned@investor.example', contact: 'Uma Unsigned' }) });
    const s2 = submission({ taxEnvelope: null, docs: [], files: {} });
    s2.investor = Object.assign({}, s2.investor, { id: 'HRC-0062', taxCert: { form: 'W-9', revision: 'Rev. March 2024', envelopeId: 'env-t9', at: '2026-11-10T12:10:00Z', signed: false, signedBy: '' } });
    s2.request = Object.assign({}, s2.request, { id: 'req-62' });
    s2.envelope = null;
    assert.equal((await complete(base, r2.token, s2)).status, 200);
    assert.match((await outbox(base, r2.id)).find((x) => x.kind === 'sponsor_notification').text, /^Tax form: Form W-9, not signed$/m);
  }));

test('without the flag an investor on file’s tax envelope, signed copy and upload are still dropped', () =>
  start(async (base) => {
    const r = await invite(base, { invitation: { cents: 0, existing: true } });
    const c = await complete(base, r.token, submission());
    assert.equal(c.status, 200, JSON.stringify(c.body));
    const got = await submissionOf(base, r.id);
    assert.equal(got.taxEnvelope, null);
    assert.ok(!('env-t1-signed' in got.files));
    assert.ok(got.request && got.envelope, 'the subscription and the agreement as before');
    assert.ok(!/Tax form:/.test((await outbox(base, r.id)).find((x) => x.kind === 'sponsor_notification').text));
  }));
