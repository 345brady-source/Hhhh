// Plan 06-22 (phase 6, D-01, research Pattern 6 and Pitfall 3): the investor's signed tax form in server mode. The
// investor's device sends its tax envelope (payload.taxEnvelope) and the signed copy under esign.js's name
// (<tax envelope id>-signed) with the completion. The integration server keeps that one file, as a PDF, only for a
// completed tax envelope signed by the invitation's own investor alone, seals it like the agreement, lists it for that
// investor alone (category Tax, rebuilt from known fields) and hands it to the console's pickup. Every other file is still
// dropped unread.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';

const DAY = 864e5;
const T0 = Date.parse('2026-11-10T12:00:00Z');
const API = 'sponsor-api-token-taxform-0123456789';
const KEY = randomBytes(32).toString('base64');
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4810000000049454e44ae426082', 'hex');
const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', colors: { primary: '#123456', accent: '#1F7A8C' }, portalName: 'Harbor Ridge Investor Portal', onboarding: { accreditation: false } };
const INVESTOR = { id: 'HRC-0042', contact: 'Dana Whitfield', title: 'Dana Whitfield', type: 'individual', email: 'dana@investor.example', taxType: 'us-individual' };

/** What the console sends: a Rule 506(b) offering with an agreement the firm countersigns. */
function payload(over = {}) {
  return Object.assign(
    {
      workspace: 'ws-harbor',
      sendEmail: false,
      portalUrl: PORTAL,
      firm: FIRM,
      investor: INVESTOR,
      offering: { id: 'hr-fund-iii', name: 'Harbor Ridge Fund III', shortName: 'Fund III', type: 'Real estate', minimum: 50000, exemption: 'Rule 506(b)', classes: [{ id: 'A', name: 'Class A Interests' }], currency: 'USD', documents: [] },
      invitation: { cents: 0, cls: '', note: '', expiresAt: new Date(T0 + 30 * DAY).toISOString() },
      verification: { connections: [], use: {}, rules: { accreditationFor: '506c' } },
      esign: { template: { title: 'Subscription agreement', roles: ['investor', 'countersigner'], fields: [], pages: 1, pageSizes: [[612, 792]], sha256: 'abc' }, pdf: pdf('TEMPLATE').toString('base64') }
    },
    over
  );
}

/** The W-9 envelope as esign.js leaves it once the investor finished it on the tax step (createFromPdf, then signing). */
function taxEnv(over = {}) {
  return Object.assign(
    {
      id: 'env-t1',
      kind: 'tax',
      title: 'Form W-9 - Dana Whitfield',
      fileName: 'Form_W-9.pdf',
      taxForm: { form: 'W-9', revision: 'March 2024' },
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
/** The listing esign.js publishes for the signed copy, as the device holds it (here naming another investor too). */
const taxDoc = (over = {}) => Object.assign({ id: 'env-t1-signed', title: 'Form W-9 - Dana Whitfield', fileName: 'Form_W-9_-_Dana_Whitfield_signed.pdf', type: 'application/pdf', cat: 'Tax', audience: 'all', investors: ['HRC-0042', 'HRC-0099'], offeringId: 'hr-fund-iii', date: '2026-11-10', envelopeId: 'env-t1' }, over);

function submission(over = {}) {
  return Object.assign(
    {
      investor: { id: 'HRC-0042', contact: 'Dana Whitfield', title: 'Dana Whitfield', email: 'dana@investor.example', type: 'individual', taxForm: 'W-9', taxCert: { form: 'W-9', revision: 'March 2024', envelopeId: 'env-t1', at: '2026-11-10T12:15:00Z', signed: true, signedBy: 'Dana Whitfield', tinLast4: '6789', backupWithholding: false }, verify: { identity: { status: 'passed' }, aml: { status: 'clear' }, accreditation: { status: 'not_started' } }, onboarding: { status: 'complete' } },
      request: { id: 'req-tax-1', type: 'subscription', offeringId: 'hr-fund-iii', investorId: 'HRC-0042', cls: 'A', cents: 6000000, status: 'pending', envelopeId: 'env-s1' },
      envelope: { id: 'env-s1', status: 'sent', requestId: 'req-tax-1', docId: 'tpl-doc-1', workDocId: 'env-s1-work', signers: [{ id: 'sg-a', role: 'investor', investorId: 'HRC-0042', status: 'signed' }, { id: 'sg-b', role: 'countersigner', status: 'waiting' }] },
      taxEnvelope: taxEnv(),
      files: { 'env-s1-work': pdf('AGREEMENT SIGNED').toString('base64'), 'env-t1-signed': pdf('W9 SIGNED COPY').toString('base64') },
      docs: [taxDoc()],
      audit: [{ at: '2026-11-10T12:15:00Z', actor: 'Dana Whitfield (investor)', action: 'Tax form signed', detail: 'Dana Whitfield: Form W-9 (March 2024); signed by Dana Whitfield' }],
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
/** One completion, then the console's pickup of it. */
async function run(base, sub, inviteOver) {
  const r = await invite(base, inviteOver);
  const c = await complete(base, r.token, sub);
  const got = await j(base, 'GET', `/v1/invitations/${r.id}/submission`);
  return { r, c, got };
}
const taxDocs = (b) => (b.docs || []).filter((d) => d.cat === 'Tax' || d.envelopeId === 'env-t1' || d.id === 'env-t1-signed');

test('a completed W-9 envelope signed by the invitation’s investor alone reaches the pickup with its signed copy and one Tax listing for that investor', () =>
  start(async (base, server) => {
    const { r, c, got } = await run(base, submission());
    assert.deepEqual(c.body, { ok: true });
    assert.equal(got.status, 200);
    const b = got.body;
    // The tax envelope comes back as the device sent it, completed, pointing at the signed copy it brought.
    assert.ok(b.taxEnvelope && typeof b.taxEnvelope === 'object', 'the pickup carries the tax envelope');
    assert.equal(b.taxEnvelope.id, 'env-t1');
    assert.equal(b.taxEnvelope.kind, 'tax');
    assert.equal(b.taxEnvelope.status, 'completed');
    assert.equal(b.taxEnvelope.signedDocId, 'env-t1-signed');
    assert.deepEqual(b.taxEnvelope.signers.map((s) => [s.role, s.investorId]), [['investor', 'HRC-0042']]);
    // The signed copy, byte for byte, beside the agreement's work copy.
    assert.equal(b.files['env-t1-signed'], pdf('W9 SIGNED COPY').toString('base64'), 'the signed W-9 comes back unchanged');
    assert.equal(b.files['env-s1-work'], pdf('AGREEMENT SIGNED').toString('base64'), 'the agreement still arrives');
    // One listing, rebuilt from known fields: this investor alone, category Tax, no offering, never the device's audience.
    const t = taxDocs(b);
    assert.equal(t.length, 1, JSON.stringify(b.docs));
    assert.deepEqual(t[0], { id: 'env-t1-signed', title: 'Form W-9 - Dana Whitfield', fileName: 'Form_W-9_-_Dana_Whitfield_signed.pdf', type: 'application/pdf', cat: 'Tax', date: '2026-11-10', audience: 'investors', investors: ['HRC-0042'], offeringId: null, envelopeId: 'env-t1' });
    // The subscription envelope is untouched by the tax form.
    assert.equal(b.envelope.id, 'env-s1');
    assert.equal(b.envelope.workDocId, 'env-s1-work');
    // Sealed at rest like the agreement: neither the stored blobs nor the stored record show the signed copy or its title.
    const rec = server.store.get('invitations', r.id);
    assert.equal(rec.submissionBlobs.length, 2);
    for (const k of rec.submissionBlobs) assert.ok(!server.store.getBlob(k).includes(Buffer.from('W9 SIGNED COPY')), `${k} is sealed`);
    assert.ok(!JSON.stringify(server.store.data()).includes('Form W-9 - Dana Whitfield'), 'the tax envelope is sealed with the submission');
  }));

test('every other file id is still dropped unread with a tax envelope present', () =>
  start(async (base) => {
    const extra = {
      'env-t1-work': pdf('TAX WORK COPY').toString('base64'),
      'env-t1-orig': pdf('TAX ORIGINAL').toString('base64'),
      'env-t2-signed': pdf('ANOTHER ENVELOPE').toString('base64'),
      'tax-HRC-0042-mh2x1q': pdf('UPLOADED').toString('base64'),
      'env-t1-signed2': pdf('LOOKALIKE').toString('base64'),
      'env-t1-unread': '%%% not base64 %%%'
    };
    const s = submission();
    s.files = Object.assign({}, s.files, extra);
    const { c, got } = await run(base, s);
    assert.deepEqual(c.body, { ok: true });
    for (const k of Object.keys(extra)) assert.ok(!(k in got.body.files), `${k} is dropped`);
    assert.deepEqual(Object.keys(got.body.files).sort(), ['env-s1-work', 'env-t1-signed']);
    assert.equal(taxDocs(got.body).length, 1);
  }));

/** The subscription envelope and its work copy arrive exactly as without a tax form. */
function agreementIntact(b, what) {
  assert.ok(b.envelope && b.envelope.id === 'env-s1' && b.envelope.workDocId === 'env-s1-work', `${what}: the subscription envelope is unaffected`);
  assert.equal(b.files['env-s1-work'], pdf('AGREEMENT SIGNED').toString('base64'), `${what}: the agreement still arrives`);
  assert.equal(b.request && b.request.id, 'req-tax-1', `${what}: the request still arrives`);
}
/** No signed tax copy and no tax listing reached the pickup, and no completed tax envelope points at a file. */
function nothingTax(b, what, id = 'env-t1') {
  assert.ok(!(`${id}-signed` in b.files), `${what}: the signed copy is dropped`);
  assert.deepEqual(Object.keys(b.files).filter((k) => k !== 'env-s1-work'), [], `${what}: no other file arrives`);
  assert.equal((b.docs || []).filter((d) => d.cat === 'Tax' || d.id === `${id}-signed` || d.envelopeId === id).length, 0, `${what}: no tax listing`);
  const t = b.taxEnvelope;
  assert.ok(!t || (t.status !== 'completed' && !t.signedDocId), `${what}: no completed tax envelope pointing at a file (${JSON.stringify(t && { status: t.status, signedDocId: t.signedDocId })})`);
}

test('forged tax envelopes (another investor, a countersigner, another kind, the agreement’s id) bring no file and no listing; the subscription is unaffected', () =>
  start(async (base) => {
    const cases = [
      ['another investor’s id', taxEnv({ signers: [{ id: 'sg-1', role: 'investor', investorId: 'HRC-0099', name: 'Lee Okafor', status: 'signed' }] })],
      ['a countersigner', taxEnv({ signers: taxEnv().signers.concat([{ id: 'sg-2', role: 'countersigner', name: 'Investor Relations', status: 'signed' }]) })],
      ['the investor twice', taxEnv({ signers: taxEnv().signers.concat([Object.assign({}, taxEnv().signers[0], { id: 'sg-2' })]) })],
      ['no signer', taxEnv({ signers: [] })],
      ['a signer with no investor id', taxEnv({ signers: [{ id: 'sg-1', role: 'investor', name: 'Dana Whitfield', status: 'signed' }] })],
      ['kind agreement', taxEnv({ kind: 'agreement' })],
      ['no kind', taxEnv({ kind: undefined })],
      ['kind TAX', taxEnv({ kind: 'TAX' })]
    ];
    for (const [what, t] of cases) {
      const { c, got } = await run(base, submission({ taxEnvelope: t }));
      assert.deepEqual(c.body, { ok: true }, `${what}: the completion still succeeds`);
      assert.equal(got.body.taxEnvelope, null, `${what}: the tax envelope is not kept`);
      nothingTax(got.body, what);
      agreementIntact(got.body, what);
    }
    // A tax envelope carrying the agreement's own id would make the agreement's signed copy pass as a tax form.
    const s = submission({ taxEnvelope: taxEnv({ id: 'env-s1', signedDocId: 'env-s1-signed' }), docs: [taxDoc({ id: 'env-s1-signed', envelopeId: 'env-s1' })] });
    s.files = { 'env-s1-work': pdf('AGREEMENT SIGNED').toString('base64'), 'env-s1-signed': pdf('PASSED OFF').toString('base64') };
    const { c, got } = await run(base, s);
    assert.deepEqual(c.body, { ok: true });
    assert.equal(got.body.taxEnvelope, null, 'the agreement’s id: the tax envelope is not kept');
    nothingTax(got.body, 'the agreement’s id', 'env-s1');
    agreementIntact(got.body, 'the agreement’s id');
  }));

test('a signed tax copy that is not a PDF is dropped, never refusing the completion; a -signed file for a tax envelope not completed is dropped', () =>
  start(async (base) => {
    // Not a PDF (a PNG, then plain words): dropped; the envelope is not complete without it.
    for (const [what, buf] of [['a PNG', png], ['plain words', Buffer.from('plain words, not a PDF')]]) {
      const s = submission();
      s.files = Object.assign({}, s.files, { 'env-t1-signed': buf.toString('base64') });
      const { c, got } = await run(base, s);
      assert.deepEqual(c.body, { ok: true }, `${what}: the completion still succeeds (${JSON.stringify(c.body)})`);
      nothingTax(got.body, what);
      agreementIntact(got.body, what);
    }
    // Not valid base64 at all: dropped unread.
    const u = submission();
    u.files = Object.assign({}, u.files, { 'env-t1-signed': '%%% not base64 %%%' });
    const ur = await run(base, u);
    assert.deepEqual(ur.c.body, { ok: true }, `not base64: ${JSON.stringify(ur.c.body)}`);
    nothingTax(ur.got.body, 'not base64');
    agreementIntact(ur.got.body, 'not base64');
    // Not completed (sent, or completed without esign.js's name for the copy): the -signed file is dropped.
    for (const [what, t] of [['sent', taxEnv({ status: 'sent', completedAt: null })], ['voided', taxEnv({ status: 'voided' })], ['another copy name', taxEnv({ signedDocId: 'env-t1-final' })]]) {
      const s = submission({ taxEnvelope: t });
      if (what === 'another copy name') s.files = Object.assign({}, s.files, { 'env-t1-final': pdf('FINAL').toString('base64') });
      const { c, got } = await run(base, s);
      assert.deepEqual(c.body, { ok: true }, what);
      nothingTax(got.body, what);
      assert.ok(!('env-t1-final' in got.body.files), `${what}: no file under another name`);
      agreementIntact(got.body, what);
    }
    // Completed, but the copy did not come: kept as not complete, pointing at nothing.
    const m = submission();
    delete m.files['env-t1-signed'];
    const mr = await run(base, m);
    assert.deepEqual(mr.c.body, { ok: true });
    assert.ok(mr.got.body.taxEnvelope && mr.got.body.taxEnvelope.status === 'sent' && mr.got.body.taxEnvelope.signedDocId === null, JSON.stringify(mr.got.body.taxEnvelope && mr.got.body.taxEnvelope.status));
    nothingTax(mr.got.body, 'no copy sent');
  }));

test('an investor already on file brings back no tax form (the console keeps the one it holds)', () =>
  start(async (base) => {
    const { c, got } = await run(base, submission(), { investor: Object.assign({}, INVESTOR, { existing: { accredited: true, accreditedUntil: '2027-03-01', holds: true } }), invitation: { cents: 6000000, existing: true, expiresAt: new Date(T0 + 30 * DAY).toISOString() } });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(got.body.taxEnvelope, null);
    assert.ok(!('env-t1-signed' in got.body.files), 'no signed tax copy');
    assert.equal((got.body.docs || []).filter((d) => d.cat === 'Tax').length, 0, 'no tax listing');
  }));
