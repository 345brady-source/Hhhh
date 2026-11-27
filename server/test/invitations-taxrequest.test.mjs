// Plan 06-26 (phase 6, D-01, D-09, D-30): the sponsor requests a tax form again from an investor already on file (their
// form is missing, not signed, or its signed copy never reached the console). The console sends an invitation to that
// investor (existing: true) marked taxRequest, with no offering: the link holds the tax step only (the official form for
// the investor's type, pre-filled from the console's record, signed or uploaded) and the done screen. The integration
// server keeps the flag and the form's pre-fill for such an invitation only, writes the investor a short email about that
// form, brings back the signed (or uploaded) tax form as for a new investor (plans 06-22, 06-23), keeps no subscription
// agreement, and tells the sponsor which form came back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';

const DAY = 864e5;
const T0 = Date.parse('2026-11-10T12:00:00Z');
const API = 'sponsor-api-token-taxrequest-0123456789';
const KEY = randomBytes(32).toString('base64');
// The portal page's address (its name holds no product word: the email's white-label check reads the link too).
const PORTAL = 'https://portal.example/portal.html?tenant=harbor';
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', colors: { primary: '#123456', accent: '#1F7A8C' }, portalName: 'Harbor Ridge Investor Portal', onboarding: { accreditation: false } };
// The form's pre-fill: the address, country and citizenship it prints, and when the investor consented to electronic
// records and signatures (so the request needs no consent screen of its own).
const PREFILL = { address: '2287 Willow Bend Drive, Boise, ID 83706', country: 'United States', citizen: 'us', citizenship: '', consentAt: '2026-03-02T15:04:05Z' };
const ONFILE = { accredited: false, accreditedUntil: '', holds: false };
const INVESTOR = { id: 'HRC-0042', contact: 'Dana Whitfield', title: 'Dana Whitfield', type: 'individual', email: 'dana@investor.example', taxType: 'us-individual', existing: ONFILE, taxPrefill: Object.assign({ ssn: '123-45-6789', bank: '000123456' }, PREFILL) };

/** What the console sends for a tax-form request: no offering, no agreement, the investor on file with the form's pre-fill. */
function payload(over = {}) {
  return Object.assign(
    {
      workspace: 'ws-harbor',
      portalUrl: PORTAL,
      notifyEmail: 'ops@harborridge.example',
      firm: FIRM,
      investor: INVESTOR,
      offering: null,
      invitation: { cents: 0, cls: '', note: '', existing: true, taxRequest: true, expiresAt: new Date(T0 + 30 * DAY).toISOString() },
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
      title: 'Form W-9 - Dana Whitfield',
      fileName: 'Form_W-9.pdf',
      taxForm: { form: 'W-9', revision: 'Rev. March 2024' },
      status: 'completed',
      completedAt: '2026-11-10T12:15:00Z',
      docId: 'env-t1-orig',
      workDocId: 'env-t1-work',
      signedDocId: 'env-t1-signed',
      sha256Signed: 'f'.repeat(64),
      signers: [{ id: 'sg-1', role: 'investor', investorId: 'HRC-0042', name: 'Dana Whitfield', email: 'dana@investor.example', status: 'signed', signedAt: '2026-11-10T12:15:00Z' }],
      fields: [{ id: 'fd-1', signerId: 'sg-1', type: 'signature', page: 1, x: 0.2, y: 0.7, w: 0.3, h: 0.03, required: false, value: 'adopted' }]
    },
    over
  );
}
const taxDoc = (over = {}) => Object.assign({ id: 'env-t1-signed', title: 'Form W-9 - Dana Whitfield', fileName: 'Form_W-9_-_Dana_Whitfield_signed.pdf', type: 'application/pdf', cat: 'Tax', audience: 'investors', investors: ['HRC-0042'], offeringId: null, date: '2026-11-10', envelopeId: 'env-t1' }, over);
function submission(over = {}) {
  return Object.assign(
    {
      investor: { id: 'HRC-0042', contact: 'Dana Whitfield', title: 'Dana Whitfield', email: 'dana@investor.example', type: 'individual', taxForm: 'W-9', taxCert: { form: 'W-9', revision: 'Rev. March 2024', envelopeId: 'env-t1', at: '2026-11-10T12:15:00Z', signed: true, signedBy: 'Dana Whitfield', tinLast4: '4326', backupWithholding: false }, onboarding: { status: 'complete' } },
      request: null,
      envelope: null,
      taxEnvelope: taxEnv(),
      files: { 'env-t1-signed': pdf('W9 SIGNED AGAIN').toString('base64') },
      docs: [taxDoc()],
      audit: [{ at: '2026-11-10T12:15:00Z', actor: 'Dana Whitfield (investor)', action: 'Tax form signed', detail: 'Dana Whitfield: Form W-9 (Rev. March 2024); signed by Dana Whitfield' }],
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

test('a tax-form request: the flag and the form’s pre-fill reach the link, nothing else of the record; the email asks for the Form W-9 only', () =>
  start(async (base) => {
    const r = await invite(base);
    const snap = await snapOf(base, r.token);
    assert.equal(snap.invitation.taxRequest, true);
    assert.equal(snap.invitation.existing, true);
    assert.equal(snap.offering, null);
    assert.deepEqual(snap.investor.taxPrefill, PREFILL, 'only the address, country, citizenship and consent date the form needs');
    assert.ok(!JSON.stringify(snap).includes('123-45-6789') && !JSON.stringify(snap).includes('000123456'), 'no taxpayer ID or bank number');
    const [m] = await outbox(base, r.id);
    assert.equal(m.subject, 'Harbor Ridge Capital: your Form W-9');
    assert.match(m.text, /Harbor Ridge Capital asks you to complete your Form W-9\./);
    assert.match(m.text, /filled in from the details we hold/);
    assert.match(m.text, /Complete your tax form:/);
    assert.ok(!/photo ID|bank details|onboarding|subscri|identity verification/i.test(m.text), m.text);
    assert.ok(!/carrow|powered by|diy/i.test(m.text + m.html));
    const again = await j(base, 'POST', `/v1/invitations/${r.id}/resend`, { body: {} });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    const re = (await outbox(base, r.id)).find((x) => x.kind === 'invitation_resent');
    assert.equal(re.subject, 'New link: Harbor Ridge Capital: your Form W-9');
    assert.match(re.text, /Any earlier link we sent no longer works/);
  }));

test('the form named in the request follows the investor type the sponsor chose (W-8BEN for a foreign individual, W-8BEN-E for a foreign entity)', () =>
  start(async (base) => {
    const a = await invite(base, { investor: Object.assign({}, INVESTOR, { id: 'HRC-0043', email: 'joaquin@investor.example', contact: 'Joaquín Peñalosa', taxType: 'foreign-individual', taxPrefill: { address: 'Calle de Zurbarán 18, Madrid 28010', country: 'Spain', citizen: 'other', citizenship: 'Spain' } }) });
    assert.equal((await outbox(base, a.id))[0].subject, 'Harbor Ridge Capital: your Form W-8BEN');
    assert.equal((await snapOf(base, a.token)).investor.taxPrefill.citizenship, 'Spain');
    const b = await invite(base, { investor: Object.assign({}, INVESTOR, { id: 'HRC-0044', email: 'glenmara@investor.example', contact: 'Fionnuala Ní Bhriain', title: 'Glenmara Logistics Holdings Limited', type: 'entity', taxType: 'foreign-entity' }) });
    assert.equal((await outbox(base, b.id))[0].subject, 'Harbor Ridge Capital: your Form W-8BEN-E');
  }));

test('the flag and the pre-fill count only for a tax-form request of an investor on file: a subscription invitation or a new investor carries neither', () =>
  start(async (base) => {
    const sub = await invite(base, { offering: { id: 'hr-fund-iii', name: 'Harbor Ridge Fund III', exemption: 'Rule 506(b)', documents: [] }, invitation: { cents: 0, existing: true, taxRequest: true } });
    const s1 = await snapOf(base, sub.token);
    assert.equal(s1.invitation.taxRequest, undefined, 'an invitation to subscribe is not a tax-form request');
    assert.equal(s1.investor.taxPrefill, undefined, 'no address travels with an invitation to subscribe');
    const fresh = await invite(base, { investor: { id: 'HRC-0050', contact: 'Nina New', email: 'nina@investor.example', taxPrefill: PREFILL }, invitation: { cents: 0, taxRequest: true } });
    const s2 = await snapOf(base, fresh.token);
    assert.equal(s2.invitation.taxRequest, undefined, 'only for an investor already on file');
    assert.equal(s2.investor.taxPrefill, undefined);
  }));

test('a tax-form request brings back the signed tax form (envelope, signed copy, one Tax listing); an agreement and its files are not kept; the sponsor hears which form came back', () =>
  start(async (base) => {
    const r = await invite(base);
    const s = submission({ envelope: { id: 'env-s1', status: 'sent', docId: 'tpl-doc-1', workDocId: 'env-s1-work', signers: [{ id: 'sg-a', role: 'investor', investorId: 'HRC-0042', status: 'signed' }] } });
    s.files['env-s1-work'] = pdf('AGREEMENT').toString('base64');
    const c = await complete(base, r.token, s);
    assert.equal(c.status, 200, JSON.stringify(c.body));
    const got = (await j(base, 'GET', `/v1/invitations/${r.id}/submission`)).body;
    assert.ok(got.taxEnvelope && got.taxEnvelope.id === 'env-t1' && got.taxEnvelope.status === 'completed', 'the tax envelope comes back');
    assert.equal(Buffer.from(got.files['env-t1-signed'], 'base64').toString(), pdf('W9 SIGNED AGAIN').toString(), 'the signed copy byte for byte');
    const tax = (got.docs || []).filter((d) => d.cat === 'Tax');
    assert.equal(tax.length, 1);
    assert.deepEqual(tax[0].investors, ['HRC-0042']);
    assert.equal(got.envelope, null, 'no subscription agreement on a tax-form request');
    assert.ok(!('env-s1-work' in got.files), 'nor its file');
    assert.equal(got.request, null);
    const n = (await outbox(base, r.id)).find((x) => x.kind === 'sponsor_notification');
    assert.equal(n.subject, 'Dana Whitfield returned their Form W-9');
    assert.match(n.text, /Tax form: Form W-9, signed/);
    assert.ok(!/Subscription|Identity:|Sanctions|Commitment/i.test(n.text), n.text);
  }));

test('a tax-form request answered with an uploaded form brings that file back; one finished without a signature brings no file and says so', () =>
  start(async (base) => {
    const up = 'tax-HRC-0042-mh2x1q';
    const r1 = await invite(base);
    const s1 = submission({ taxEnvelope: null, docs: [], files: { [up]: pdf('W-9 COMPLETED ON PAPER').toString('base64') } });
    s1.investor = Object.assign({}, s1.investor, { taxCert: { form: 'W-9', uploaded: true, fileId: up, fileName: 'w9.pdf', at: '2026-11-10T12:10:00Z' } });
    assert.equal((await complete(base, r1.token, s1)).status, 200);
    const g1 = (await j(base, 'GET', `/v1/invitations/${r1.id}/submission`)).body;
    assert.equal(Buffer.from(g1.files[up], 'base64').toString(), pdf('W-9 COMPLETED ON PAPER').toString());
    const n1 = (await outbox(base, r1.id)).find((x) => x.kind === 'sponsor_notification');
    assert.match(n1.text, /Tax form: Form W-9, uploaded/);
    const r2 = await invite(base, { investor: Object.assign({}, INVESTOR, { id: 'HRC-0045', email: 'unsigned@investor.example', contact: 'Uma Unsigned' }) });
    const s2 = submission({ taxEnvelope: null, docs: [], files: {} });
    s2.investor = Object.assign({}, s2.investor, { id: 'HRC-0045', taxCert: { form: 'W-9', revision: 'Rev. March 2024', envelopeId: 'env-t9', at: '2026-11-10T12:10:00Z', signed: false, signedBy: '' } });
    assert.equal((await complete(base, r2.token, s2)).status, 200);
    const n2 = (await outbox(base, r2.id)).find((x) => x.kind === 'sponsor_notification');
    assert.equal(n2.subject, 'Uma Unsigned finished your tax form request without signing');
    assert.match(n2.text, /Tax form: Form W-9, not signed/);
  }));
