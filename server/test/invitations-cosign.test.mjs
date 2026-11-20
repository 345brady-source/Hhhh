// Plan 06-38 (phase 6, the co-investor sign-in gap found 2026-11-19, 01.4-RESUME): a co-investor added to an account was
// never sent anything, so an agreement with co-investor places waited on them forever outside the demo. With the
// integration server connected, the console now sends the co-investor their own invitation (existing: true, coSign: true,
// envelopeId, no offering) holding the agreement as the console holds it and its current copy (the work copy with the
// investor's signature). The server emails the co-investor a link in the firm's name, serves a snapshot holding only that
// agreement and the account's name, takes back only the co-investor's signature on that agreement (its work copy, or its
// signed copy once complete), never a subscription, evidence or tax file, and tells the sponsor whether the co-investor
// signed. Taxpayer numbers in these fixtures come from ranges that are never issued (SSN area 666, EIN prefix 07).
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';
import { summarize } from '../lib/invitations.mjs';
import { reminderMessage } from '../lib/mail.mjs';

const DAY = 864e5;
const T0 = Date.parse('2026-11-20T12:00:00Z');
const API = 'sponsor-api-token-cosign-0123456789abc';
const KEY = randomBytes(32).toString('base64');
// The portal page's address (its name holds no product word: the email's white-label check reads the link too).
const PORTAL = 'https://portal.example/portal.html?tenant=lantern';
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const FIRM = { name: 'Lantern Point Partners', shortName: 'Lantern Point', legalName: 'Lantern Point Partners Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@lanternpoint.example', supportPhone: '+1 208 555 0142', colors: { primary: '#22344F', accent: '#2E7D6B' }, portalName: 'Lantern Point Investor Portal', onboarding: { accreditation: false } };
const ACCOUNT = 'Marlow and Rowan Ashby JTWROS';
const CO = { name: 'Rowan Ashby', email: 'rowan@coinvestor.example' };
// Never-issued numbers (SSN area 666; EIN prefix 07): the account investor's, which the co-investor must never receive.
const SSN = '666-12-3456';
const EIN = '07-1234567';
const WORK = pdf('AGREEMENT WORK COPY SIGNED BY THE INVESTOR');

/** The agreement as the console holds it: signed by the investor, waiting for the co-investor, then the firm. */
function template(over = {}) {
  return Object.assign(
    {
      id: 'env-a7',
      title: 'Subscription Agreement - Lantern Point Fund II - Marlow Ashby',
      status: 'sent',
      docId: 'env-a7-orig',
      workDocId: 'env-a7-work',
      agreementFor: 'lp-fund-ii',
      signers: [
        { id: 'sg-1', role: 'investor', investorId: 'LPP-0107', name: 'Marlow Ashby', email: 'marlow@investor.example', status: 'signed', signedAt: '2026-11-19T15:00:00Z', signature: { kind: 'typed', text: 'Marlow Ashby' } },
        { id: 'sg-2', role: 'investor', co: true, investorId: 'LPP-0107', name: CO.name, email: CO.email, account: ACCOUNT, status: 'waiting', signedAt: null, signature: null },
        { id: 'sg-3', role: 'countersigner', investorId: null, name: 'Avery Lane', email: 'avery@lanternpoint.example', status: 'waiting', signedAt: null, signature: null }
      ],
      fields: [
        { id: 'fd-1', signerId: 'sg-1', type: 'signature', page: 3, x: 0.1, y: 0.7, w: 0.3, h: 0.03, value: 'adopted' },
        { id: 'fd-2', signerId: 'sg-1', type: 'text', label: 'Social Security number', page: 2, x: 0.1, y: 0.4, w: 0.3, h: 0.03, value: SSN },
        { id: 'fd-3', signerId: 'sg-1', type: 'text', label: 'Commitment', page: 1, x: 0.1, y: 0.3, w: 0.3, h: 0.03, value: '$250,000' },
        { id: 'fd-6', signerId: 'sg-1', type: 'text', label: 'Trust EIN', page: 2, x: 0.1, y: 0.5, w: 0.3, h: 0.03, value: `EIN ${EIN}` },
        { id: 'fd-4', signerId: 'sg-2', type: 'signature', page: 3, x: 0.5, y: 0.7, w: 0.3, h: 0.03, value: null },
        { id: 'fd-5', signerId: 'sg-3', type: 'signature', page: 4, x: 0.1, y: 0.7, w: 0.3, h: 0.03, value: null }
      ],
      events: [{ at: '2026-11-19T15:00:00Z', action: 'signed', by: 'Marlow Ashby' }]
    },
    over
  );
}

/** What the console sends for a co-investor sign-in: the account on file, the co-investor's name and email, no offering. */
function payload(over = {}, inv = {}) {
  return Object.assign(
    {
      workspace: 'ws-lantern',
      portalUrl: PORTAL,
      notifyEmail: 'ops@lanternpoint.example',
      firm: FIRM,
      investor: { id: 'LPP-0107', contact: CO.name, title: ACCOUNT, email: CO.email, type: 'joint' },
      offering: null,
      invitation: Object.assign({ cents: 0, existing: true, coSign: true, envelopeId: 'env-a7', senderName: 'Avery Lane', expiresAt: new Date(T0 + 14 * DAY).toISOString() }, inv),
      esign: { template: template(), pdf: WORK.toString('base64') },
      verification: { connections: [{ id: 'persona', kind: 'identity' }], use: { identity: 'persona' }, rules: {} }
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
async function invite(base, over, inv) {
  const r = await j(base, 'POST', '/v1/invitations', { body: payload(over, inv) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
const complete = (base, token, body) => j(base, 'POST', '/v1/invite/complete', { token, auth: false, body });
const outbox = async (base, id) => (await j(base, 'GET', `/v1/outbox?invitation=${id}`)).body.messages;
const snapOf = async (base, token) => (await j(base, 'GET', '/v1/invite', { token, auth: false })).body;
const submissionOf = async (base, id) => (await j(base, 'GET', `/v1/invitations/${id}/submission`)).body;
/** White label (no vendor or product name, never the word "basic") and no taxpayer number, on every email. */
function clean(m) {
  const all = `${m.subject}\n${m.text}\n${m.html}`;
  assert.ok(!/carrow|powered by|diy|refract|claude|anthropic/i.test(all), `vendor name in: ${m.subject}`);
  assert.ok(!/basic/i.test(all), `"basic" in: ${m.subject}`);
  assert.ok(!all.includes(SSN) && !all.includes(EIN) && !/\b\d{3}-\d{2}-\d{4}\b/.test(all), `taxpayer number in: ${m.subject}`);
}

/** What the co-investor's device sends back once they signed: the agreement, its work copy, and nothing else of theirs. */
function signedBack(over = {}) {
  const env = template();
  const co = env.signers.find((s) => s.co);
  Object.assign(co, { status: 'signed', signedAt: '2026-11-20T12:30:00Z', signature: { kind: 'typed', text: CO.name } });
  env.fields.find((f) => f.id === 'fd-4').value = 'adopted';
  env.events.push({ at: '2026-11-20T12:30:00Z', action: 'signed', by: CO.name });
  return Object.assign({ investor: { id: 'LPP-0107' }, request: null, envelope: env, files: { 'env-a7-work': pdf('WORK COPY WITH BOTH INVESTOR SIGNATURES').toString('base64') }, docs: [], audit: [{ at: '2026-11-20T12:30:00Z', actor: `${CO.name} (co-investor)`, action: 'Agreement signed', detail: env.title }], notifications: [] }, over);
}

test('create and email: a co-investor sign-in is stored and the co-investor gets their own link, in the firm’s name, asking only for their signature', () =>
  start(async (base) => {
    const r = await invite(base);
    assert.ok(r.id && r.token && r.link, JSON.stringify(r));
    const msgs = await outbox(base, r.id);
    assert.equal(msgs.length, 1, 'one email, to the co-investor');
    const [m] = msgs;
    assert.equal(m.kind, 'invitation');
    assert.equal(m.to, CO.email);
    assert.equal(m.subject, `Lantern Point Partners: sign the subscription agreement for ${ACCOUNT}`);
    assert.match(m.text, new RegExp(`^Dear ${CO.name},`));
    assert.ok(m.text.includes(`Lantern Point Partners asks you to sign the subscription agreement for ${ACCOUNT} as co-investor.`), m.text);
    assert.ok(m.text.includes('The link below opens the agreement with only your places to sign. Nothing else is asked.'), m.text);
    assert.ok(m.text.includes(`Review and sign:\n${r.link}`), m.text);
    assert.ok(m.html.includes('>Review and sign</a>'), 'the button');
    assert.match(m.text, /It expires on December 4, 2026\./);
    assert.match(m.text, /Questions\? Reply to this email or contact Investor Relations: ir@lanternpoint\.example, \+1 208 555 0142\./);
    assert.ok(!/photo ID|bank details|onboarding|subscribe to|identity verification|tax form/i.test(m.text), m.text);
    assert.match(m.from, /Lantern Point Partners/);
    clean(m);
  }));

test('email again: the resend and the sponsor’s console reminder use the co-investor words', () =>
  start(async (base) => {
    const r = await invite(base);
    const again = await j(base, 'POST', `/v1/invitations/${r.id}/resend`, { body: {} });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    const re = (await outbox(base, r.id)).find((x) => x.kind === 'invitation_resent');
    assert.equal(re.subject, `Reminder: Lantern Point Partners: sign the subscription agreement for ${ACCOUNT}`);
    assert.ok(re.text.includes(`Here is a new link to sign the subscription agreement for ${ACCOUNT} as co-investor. Any earlier link we sent no longer works.`), re.text);
    assert.ok(re.text.includes('The link below opens the agreement with only your places to sign. Nothing else is asked.'), re.text);
    assert.ok(re.text.includes(`Review and sign:\n${again.body.link}`), re.text);
    clean(re);
    const rm = reminderMessage({ firm: FIRM, investor: { contact: CO.name, title: ACCOUNT, email: CO.email }, offering: null, consoleUrl: 'https://portal.example/portal.html#console-investors', completedAt: '2026-11-20T12:30:00Z', deleteOn: '2026-12-20T12:30:00Z', existing: true, coSign: true });
    assert.equal(rm.subject, `Waiting in your console: ${CO.name}’s signature for ${ACCOUNT}`);
    assert.ok(rm.text.includes(`${CO.name} went through your request to sign the subscription agreement for ${ACCOUNT} as co-investor on November 20, 2026`), rm.text);
    assert.ok(!/subscription to|accreditation result|onboarding/i.test(rm.text), rm.text);
    clean(rm);
  }));

test('snapshot: the co-investor’s link holds the agreement and its current copy, the account’s name, and nothing else of the account investor', () =>
  start(async (base) => {
    const r = await invite(base);
    const snap = await snapOf(base, r.token);
    assert.equal(snap.invitation.coSign, true);
    assert.equal(snap.invitation.existing, true);
    assert.equal(snap.invitation.envelopeId, 'env-a7');
    assert.equal(snap.offering, null);
    assert.equal(snap.esign.template.id, 'env-a7');
    assert.equal(Buffer.from(snap.esign.pdf, 'base64').toString('latin1'), WORK.toString('latin1'), 'the current copy byte for byte');
    assert.deepEqual(snap.investor, { id: 'LPP-0107', contact: CO.name, title: ACCOUNT, type: 'joint', email: CO.email });
    assert.deepEqual(snap.verification, {}, 'no verification runs on a co-investor sign-in');
    // W2: the account investor's taxpayer numbers never reach the co-investor; their other values stay as the console sent them.
    const s = JSON.stringify(snap);
    assert.ok(!s.includes(SSN) && !s.includes(EIN), 'no taxpayer number in the snapshot');
    const f = Object.fromEntries(snap.esign.template.fields.map((x) => [x.id, x]));
    assert.equal(f['fd-2'].value, '');
    assert.equal(f['fd-2'].withheld, true);
    assert.equal(f['fd-6'].value, '');
    assert.equal(f['fd-3'].value, '$250,000');
    assert.equal(f['fd-1'].value, 'adopted');
  }));

test('snapshot: a co-investor sign-in drops access, taxRequest, includeTax, package and taxPrefill', () =>
  start(async (base) => {
    const r = await invite(base, { investor: { id: 'LPP-0107', contact: CO.name, title: ACCOUNT, email: CO.email, type: 'joint', taxType: 'us-individual', existing: { accredited: true, holds: true }, taxPrefill: { address: '14 Quarry Lane, Boise, ID 83702', country: 'United States', citizen: 'us' } } }, { access: true, taxRequest: true, includeTax: true, package: true, clientId: 'inv-cosign-1', cents: 2500000, cls: 'A' });
    const snap = await snapOf(base, r.token);
    for (const k of ['access', 'taxRequest', 'includeTax', 'package', 'clientId']) assert.equal(snap.invitation[k], undefined, k);
    assert.equal(snap.invitation.cents, 0, 'no amount travels with a co-investor sign-in');
    assert.equal(snap.investor.taxPrefill, undefined);
    assert.equal(snap.investor.existing, undefined, 'the account investor’s status flags stay with the console');
    assert.equal(snap.investor.taxType, undefined);
    const row = (await j(base, 'GET', `/v1/invitations/${r.id}`)).body;
    assert.equal(row.package, null, 'no verification package on a co-investor sign-in');
  }));

test('refused: a co-investor sign-in without an account on file, with an offering, for another agreement, or without its PDF (400, a plain sentence)', () =>
  start(async (base) => {
    const post = (over, inv) => j(base, 'POST', '/v1/invitations', { body: payload(over, inv) });
    const noExisting = await post({}, { existing: false });
    assert.equal(noExisting.status, 400);
    assert.equal(noExisting.body.error, 'A co-investor sign-in is only for an account already on file.');
    const withOffering = await post({ offering: { id: 'lp-fund-ii', name: 'Lantern Point Fund II', documents: [] } });
    assert.equal(withOffering.status, 400);
    assert.equal(withOffering.body.error, 'A co-investor sign-in has no offering: the co-investor signs the agreement already sent.');
    const other = await post({}, { envelopeId: 'env-zz' });
    assert.equal(other.status, 400);
    assert.equal(other.body.error, 'invitation.envelopeId must be the id of the agreement sent in esign.template.');
    const badId = await post({ esign: { template: template({ id: 'env a7/../x' }), pdf: WORK.toString('base64') } }, { envelopeId: 'env a7/../x' });
    assert.equal(badId.status, 400);
    assert.equal(badId.body.error, 'invitation.envelopeId must be the id of the agreement sent in esign.template.');
    const noPdf = await post({ esign: { template: template() } });
    assert.equal(noPdf.status, 400);
    assert.equal(noPdf.body.error, 'A co-investor sign-in needs the agreement’s current copy as a PDF (esign.pdf).');
    const notPdf = await post({ esign: { template: template(), pdf: Buffer.from('not a pdf at all').toString('base64') } });
    assert.equal(notPdf.status, 400);
    assert.equal(notPdf.body.error, 'esign.pdf is not a PDF');
    const list = (await j(base, 'GET', '/v1/invitations?workspace=ws-lantern')).body;
    assert.equal(list.length, 0, 'nothing is stored for a turned-down sign-in');
  }));

test('the co-investor’s device: a subscription request, a missing agreement or another agreement are turned down (400)', () =>
  start(async (base) => {
    const r = await invite(base);
    const withReq = await complete(base, r.token, signedBack({ request: { offeringId: 'lp-fund-ii', cents: 100 } }));
    assert.equal(withReq.status, 400);
    assert.equal(withReq.body.error, 'A co-investor sign-in brings back no subscription request.');
    const noEnv = await complete(base, r.token, signedBack({ envelope: null }));
    assert.equal(noEnv.status, 400);
    assert.equal(noEnv.body.error, 'envelope is required: the co-investor’s signature travels on the agreement.');
    const otherEnv = signedBack();
    otherEnv.envelope.id = 'env-b9';
    const other = await complete(base, r.token, otherEnv);
    assert.equal(other.status, 400);
    assert.equal(other.body.error, 'envelope.id does not match the agreement on this invitation.');
    const row = (await j(base, 'GET', `/v1/invitations/${r.id}`)).body;
    assert.notEqual(row.status, 'completed', 'a turned-down completion completes nothing');
  }));

test('the co-investor’s device brings back only their signature on that agreement: the work copy, the agreement, an investor of { id }', () =>
  start(async (base) => {
    const r = await invite(base);
    const s = signedBack();
    // What a tampered device might add: the account's record, evidence, a tax form, another agreement's copy, a signed copy
    // of an agreement that is not complete, the firm's countersignature, a changed commitment, the investor's signature undone.
    s.investor = { id: 'LPP-0107', contact: 'Someone Else', email: 'else@attacker.example', verify: { accreditation: { fileId: 'kyc-LPP-0107-mh2x1q' } }, taxCert: { form: 'W-9', uploaded: true, fileId: 'tax-LPP-0107-mh2x1q' } };
    s.taxEnvelope = { id: 'env-t1', kind: 'tax', status: 'completed', signedDocId: 'env-t1-signed', signers: [{ id: 'sg-t', role: 'investor', investorId: 'LPP-0107', status: 'signed' }] };
    Object.assign(s.files, { 'kyc-LPP-0107-mh2x1q': pdf('ID').toString('base64'), 'tax-LPP-0107-mh2x1q': pdf('W9').toString('base64'), 'env-t1-signed': pdf('W9 SIGNED').toString('base64'), 'env-a7-signed': pdf('FAKE SIGNED').toString('base64'), 'env-b9-work': pdf('OTHER').toString('base64') });
    const env = s.envelope;
    env.signedDocId = 'env-a7-signed';
    Object.assign(env.signers.find((x) => x.id === 'sg-3'), { status: 'signed', signedAt: '2026-11-20T12:31:00Z', signature: { kind: 'typed', text: 'Forged' } });
    Object.assign(env.signers.find((x) => x.id === 'sg-1'), { status: 'declined', signedAt: null, signature: null, name: 'Changed Name' });
    env.fields.find((f) => f.id === 'fd-3').value = '$1';
    env.fields.push({ id: 'fd-x', signerId: 'sg-1', type: 'text', page: 1, x: 0, y: 0, w: 0.1, h: 0.1, value: 'added' });
    env.signers.push({ id: 'sg-x', role: 'investor', investorId: 'LPP-0107', name: 'Extra', status: 'signed' });
    const c = await complete(base, r.token, s);
    assert.equal(c.status, 200, JSON.stringify(c.body));
    const got = await submissionOf(base, r.id);
    assert.deepEqual(Object.keys(got.files), ['env-a7-work'], 'only the agreement’s work copy');
    assert.equal(Buffer.from(got.files['env-a7-work'], 'base64').toString(), pdf('WORK COPY WITH BOTH INVESTOR SIGNATURES').toString());
    assert.deepEqual(got.investor, { id: 'LPP-0107' }, 'the co-investor changes nothing on the account’s record');
    assert.equal(got.request, null);
    assert.equal(got.taxEnvelope, null);
    assert.deepEqual(got.docs, []);
    assert.equal(got.envelope.id, 'env-a7');
    assert.equal(got.envelope.status, 'sent', 'still waiting for the firm');
    assert.equal(got.envelope.workDocId, 'env-a7-work');
    assert.equal(got.envelope.signedDocId, null);
    const sg = Object.fromEntries(got.envelope.signers.map((x) => [x.id, x]));
    assert.deepEqual(Object.keys(sg).sort(), ['sg-1', 'sg-2', 'sg-3'], 'no signer added');
    assert.equal(sg['sg-2'].status, 'signed', 'the co-investor’s signature');
    assert.equal(sg['sg-2'].co, true);
    assert.equal(sg['sg-3'].status, 'waiting', 'a countersignature never comes from the co-investor’s device');
    assert.equal(sg['sg-1'].status, 'signed', 'the investor’s signature stays as the console sent it');
    assert.equal(sg['sg-1'].name, 'Marlow Ashby');
    const fd = Object.fromEntries(got.envelope.fields.map((x) => [x.id, x]));
    assert.equal(fd['fd-4'].value, 'adopted', 'the co-investor’s own place');
    assert.equal(fd['fd-3'].value, '$250,000', 'the investor’s values stay as the console sent them');
    assert.equal(fd['fd-x'], undefined, 'no field added');
  }));

test('a completed agreement (no countersigner) may also bring its signed copy and its one Legal listing', () =>
  start(async (base) => {
    const tpl = template({ id: 'env-b2', docId: 'env-b2-orig', workDocId: 'env-b2-work' });
    tpl.signers = tpl.signers.filter((x) => x.role !== 'countersigner');
    tpl.fields = tpl.fields.filter((x) => x.signerId !== 'sg-3');
    const r = await invite(base, { esign: { template: tpl, pdf: WORK.toString('base64') } }, { envelopeId: 'env-b2' });
    const env = JSON.parse(JSON.stringify(tpl));
    Object.assign(env.signers.find((x) => x.co), { status: 'signed', signedAt: '2026-11-20T12:30:00Z' });
    Object.assign(env, { status: 'completed', completedAt: '2026-11-20T12:30:00Z', signedDocId: 'env-b2-signed', sha256Signed: 'a'.repeat(64) });
    const s = signedBack({ envelope: env, files: { 'env-b2-work': pdf('W').toString('base64'), 'env-b2-signed': pdf('S').toString('base64') }, docs: [{ id: 'env-b2-signed', title: 'Subscription Agreement (signed)', fileName: 'Subscription_Agreement_signed.pdf', date: '2026-11-20', audience: 'all', investors: ['LPP-9999'] }] });
    assert.equal((await complete(base, r.token, s)).status, 200);
    const got = await submissionOf(base, r.id);
    assert.deepEqual(Object.keys(got.files).sort(), ['env-b2-signed', 'env-b2-work']);
    assert.equal(got.envelope.status, 'completed');
    assert.equal(got.docs.length, 1);
    assert.deepEqual(got.docs[0].investors, ['LPP-0107']);
    assert.equal(got.docs[0].cat, 'Legal');
  }));

test('the sponsor hears whether the co-investor signed: the summary rows and next line, and a notification naming the co-investor and the account', () =>
  start(async (base) => {
    const r = await invite(base);
    assert.equal((await complete(base, r.token, signedBack())).status, 200);
    const n = (await outbox(base, r.id)).find((x) => x.kind === 'sponsor_notification');
    assert.equal(n.to, 'ops@lanternpoint.example');
    assert.equal(n.subject, `${CO.name} signed the subscription agreement for ${ACCOUNT}`);
    assert.ok(n.text.includes(`${CO.name}, co-investor on ${ACCOUNT}, went through your request to sign the subscription agreement on November 20, 2026.`), n.text);
    assert.match(n.text, /Co-investor signature: Signed/);
    assert.ok(n.text.includes('Next: countersign the subscription agreement in the console.'), n.text);
    assert.ok(!/Identity:|Sanctions|Commitment|Accredited|Tax form/i.test(n.text), n.text);
    clean(n);
    const r2 = await invite(base);
    assert.equal((await complete(base, r2.token, signedBack({ envelope: template() }))).status, 200);
    const n2 = (await outbox(base, r2.id)).find((x) => x.kind === 'sponsor_notification');
    assert.equal(n2.subject, `${CO.name} did not sign the subscription agreement for ${ACCOUNT}`);
    assert.match(n2.text, /Co-investor signature: Not signed/);
    assert.ok(n2.text.includes('Next: ask the co-investor to sign.'), n2.text);
    clean(n2);
  }));

test('summarize for a co-investor sign-in reads the co signer only', () => {
  const snap = { investor: { id: 'LPP-0107', contact: CO.name, title: ACCOUNT, email: CO.email }, offering: null, invitation: { cents: 0, existing: true, coSign: true, envelopeId: 'env-a7' } };
  const signed = signedBack().envelope;
  const a = summarize({ investor: { id: 'LPP-0107' }, request: null, envelope: signed }, snap, null);
  assert.deepEqual(a.rows, [['Co-investor signature', 'Signed']]);
  assert.equal(a.next, 'Next: countersign the subscription agreement in the console.');
  assert.equal(a.coSign, true);
  const b = summarize({ investor: { id: 'LPP-0107' }, request: null, envelope: template() }, snap, null);
  assert.deepEqual(b.rows, [['Co-investor signature', 'Not signed']]);
  assert.equal(b.next, 'Next: ask the co-investor to sign.');
  const c = summarize({ investor: { id: 'LPP-0107' }, request: null, envelope: null }, snap, null);
  assert.deepEqual(c.rows, [['Co-investor signature', 'Not signed']]);
});
