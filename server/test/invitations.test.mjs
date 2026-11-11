// Investor invitations: create (token hashed at rest, link, firm-branded email), the investor's link
// (snapshot, opened, progress, complete with PDFs), the sponsor's notification, submission fetch and
// purge, expiry, cancel, resend, automatic purge (injected clock), encryption at rest, DATA_KEY and
// API_TOKEN requirements, invite-token scoping, CORS, rate limits, body size limits and SMTP end to end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withServer } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { BUILTINS } from '../providers/index.mjs';
import { fakeSmtp, parts } from './smtp-fake.mjs';

const DAY = 864e5;
const T0 = Date.parse('2026-11-10T12:00:00Z');
const API = 'sponsor-api-token-0123456789';
const KEY = randomBytes(32).toString('base64');
const PUBLIC = 'https://verify.example';
const pdf = (marker, pad = 0) => Buffer.concat([Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\n`), Buffer.alloc(pad, 32), Buffer.from('trailer << >>\n%%EOF\n')]);
const LOGO = `data:image/png;base64,${Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64')}`;
const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', supportPhone: '+1 212 555 0100', colors: { primary: '#123456', accent: '#1F7A8C' }, logo: LOGO, portalName: 'Harbor Ridge Investor Portal', disclaimer: 'Not an offer to sell securities.', onboarding: { accreditation: true } };
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';

function payload(over = {}) {
  return Object.assign(
    {
      workspace: 'ws-harbor',
      sendEmail: true,
      portalUrl: PORTAL,
      notifyEmail: 'ops@harborridge.example',
      firm: FIRM,
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', shortName: 'Fund II', type: 'Private equity', summary: 'Buyout fund', minimum: 100000, closeDate: '2027-03-31', terms: [{ label: 'Term', value: '10 years' }], exemption: 'Rule 506(c)', classes: [{ id: 'A', name: 'Class A' }], currency: 'USD', documents: [{ id: 'ppm', title: 'Private placement memorandum', fileName: 'ppm.pdf', base64: pdf('PPMMARKER').toString('base64') }] },
      invitation: { cents: 25000000, cls: 'A', note: 'Welcome aboard, Zelda', expiresAt: new Date(T0 + 30 * DAY).toISOString() },
      verification: { connections: [{ id: 'c1', name: 'Test checks', type: 'server', connector: 'sandbox', checks: ['identity', 'accreditation'] }, { id: 'c2', name: 'Test screening', type: 'server', connector: 'fakescreen', checks: ['aml'] }], use: { identity: ['c1'], accreditation: ['c1'], aml: ['c2'] }, rules: { accreditationFor: '506c' } },
      esign: { template: { title: 'Subscription agreement', roles: ['investor', 'countersigner'], fields: [{ id: 'f1', role: 'investor', type: 'signature', page: 1 }], pages: 1, pageSizes: [[612, 792]], sha256: 'abc' }, pdf: pdf('TEMPLATEMARKER').toString('base64') }
    },
    over
  );
}
function submission(over = {}) {
  return Object.assign(
    {
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', email: 'zelda@investor.example', type: 'individual', payment: { method: 'ach', bank: 'First Example Bank', routing: '021000021', account: '000123456789' }, verify: { identity: { status: 'passed' }, aml: { status: 'clear' }, accreditation: { status: 'review' } }, onboarding: { status: 'complete' } },
      request: { id: 'req-1', type: 'subscription', offeringId: 'hr-fund-ii', investorId: 'HRC-0007', cents: 25000000, status: 'pending', envelopeId: 'env-1' },
      // What the investor's page sends: the work copy it signed (esign.js names it <envelope id>-work), never the firm's template.
      envelope: { id: 'env-1', status: 'sent', requestId: 'req-1', docId: 'tpl-doc-1', workDocId: 'env-1-work' },
      files: { 'env-1-work': pdf('SIGNEDMARKER').toString('base64') },
      docs: [{ id: 'env-1-work', title: 'Subscription agreement (signed by the investor)' }],
      audit: [{ at: '2026-11-10T12:30:00Z', actor: 'Zelda Quixote (investor)', action: 'Envelope signed', detail: 'Signed by the investor' }],
      notifications: [{ id: 'n1', at: '2026-11-10T12:30:00Z', kind: 'agreement_signed', title: 'Zelda Quixote signed the subscription agreement', detail: '', route: 'console-envelope/env-1' }]
    },
    over
  );
}

/** A server with an injected clock, API_TOKEN, DATA_KEY and a public URL. */
function start(opts, fn) {
  const clock = opts.clock || { t: T0 };
  return withServer({ env: Object.assign({ API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: PUBLIC }, opts.env), now: () => clock.t, store: opts.store, providers: opts.providers }, (base, server) => fn(base, server, clock));
}
function call(base, method, path, { body, token, auth = true, headers = {} } = {}) {
  const h = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, auth ? { Authorization: `Bearer ${API}` } : {}, token !== undefined ? { 'X-Invite-Token': token } : {}, headers);
  return fetch(base + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
}
async function j(base, method, path, opts) {
  const res = await call(base, method, path, opts);
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}
const create = async (base, over) => {
  const r = await j(base, 'POST', '/v1/invitations', { body: payload(over) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
};
const list = async (base) => (await j(base, 'GET', '/v1/invitations?workspace=ws-harbor')).body;
const outbox = async (base, id) => (await j(base, 'GET', `/v1/outbox${id ? `?invitation=${id}` : ''}`)).body.messages;
const investorGet = (base, token) => j(base, 'GET', '/v1/invite', { token, auth: false });
const complete = (base, token, body) => j(base, 'POST', '/v1/invite/complete', { token, auth: false, body: body || submission() });
const progress = (base, token, body) => j(base, 'PUT', '/v1/invite/progress', { token, auth: false, body });
const sha = (s) => createHash('sha256').update(s).digest('hex');
const head = (raw, name) => (new RegExp(`^${name}: (.*)`, 'mi').exec(raw.split('\r\n\r\n')[0]) || [])[1];

test('create: a one-time token stored only as its SHA-256, the link, and the firm’s email in the outbox', () =>
  start({ env: { MAIL_FROM: 'notices@portal-mail.example' } }, async (base, server) => {
    const r = await create(base);
    assert.match(r.token, /^[A-Za-z0-9_-]{43}$/);
    assert.match(r.id, /^ivt_/);
    assert.equal(r.link, `${PORTAL}&server=${encodeURIComponent(PUBLIC)}#invite-${r.token}`);
    assert.equal(r.emailStatus, 'outbox');
    assert.equal(r.expiresAt, new Date(T0 + 30 * DAY).toISOString());
    const rec = server.store.get('invitations', r.id);
    assert.equal(rec.tokenHash, sha(r.token));
    assert.ok(!JSON.stringify(server.store.data()).includes(r.token), 'the token itself is never stored');
    const [m] = await outbox(base, r.id);
    assert.equal(m.kind, 'invitation');
    assert.equal(m.to, 'zelda@investor.example');
    assert.equal(m.from, '"Harbor Ridge Capital" <notices@portal-mail.example>');
    assert.equal(m.replyTo, 'ir@harborridge.example');
    assert.equal(m.subject, 'Harbor Ridge Fund II: complete your investor onboarding');
    assert.ok(m.text.includes(r.link) && m.text.includes('Welcome aboard, Zelda') && m.text.includes('Commitment: $250,000'));
    assert.ok(!/carrow|powered by|diy portal/i.test(m.text + m.html));
    // Without sendEmail the sponsor gets the link to send themselves.
    const quiet = await create(base, { sendEmail: false, portalUrl: 'https://portal.example/diy.html' });
    assert.equal(quiet.emailStatus, 'not_sent');
    assert.equal(quiet.link, `https://portal.example/diy.html?server=${encodeURIComponent(PUBLIC)}#invite-${quiet.token}`);
    assert.equal((await outbox(base, quiet.id)).length, 0);
    // An earlier server= or hash in portalUrl is replaced.
    const again = await create(base, { sendEmail: false, portalUrl: 'https://portal.example/diy.html?server=https%3A%2F%2Fevil.example#console' });
    assert.equal(again.link, `https://portal.example/diy.html?server=${encodeURIComponent(PUBLIC)}#invite-${again.token}`);
    // Validation.
    for (const [over, re] of [
      [{ firm: Object.assign({}, FIRM, { name: '' }) }, /firm.name/],
      [{ investor: { id: 'HRC-1', contact: 'A', email: 'nope' } }, /investor.email/],
      [{ investor: { id: '../x', contact: 'A', email: 'a@b.example' } }, /investor.id/],
      [{ portalUrl: 'javascript:alert(1)' }, /portalUrl/],
      [{ notifyEmail: 'x' }, /notifyEmail/],
      [{ invitation: { cents: -5 } }, /cents/],
      [{ firm: Object.assign({}, FIRM, { logo: 'data:text/html;base64,PHA+' }) }, /firm.logo/]
    ]) {
      const bad = await j(base, 'POST', '/v1/invitations', { body: payload(over) });
      assert.equal(bad.status, 400, JSON.stringify(over));
      assert.match(bad.body.error, re);
    }
  }));

test('the investor’s link: GET /v1/invite returns the snapshot and marks the invitation opened once', () =>
  start({}, async (base, server, clock) => {
    const r = await create(base);
    const g = await investorGet(base, r.token);
    assert.equal(g.status, 200);
    const s = g.body;
    assert.equal(s.status, 'opened');
    assert.equal(s.openedAt, new Date(T0).toISOString());
    assert.equal(s.firm.name, 'Harbor Ridge Capital');
    assert.equal(s.firm.logo, LOGO);
    assert.deepEqual(s.investor, { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' });
    assert.equal(s.offering.name, 'Harbor Ridge Fund II');
    assert.equal(s.offering.exemption, 'Rule 506(c)');
    assert.deepEqual(Buffer.from(s.offering.documents[0].base64, 'base64'), pdf('PPMMARKER'));
    assert.equal(s.offering.documents[0].fileName, 'ppm.pdf');
    assert.deepEqual(Buffer.from(s.esign.pdf, 'base64'), pdf('TEMPLATEMARKER'));
    assert.equal(s.esign.template.title, 'Subscription agreement');
    assert.deepEqual(s.invitation, { cents: 25000000, cls: 'A', note: 'Welcome aboard, Zelda', senderName: '', expiresAt: r.expiresAt });
    assert.deepEqual(s.verification.use.identity, ['c1']);
    assert.equal(s.serverUrl, PUBLIC);
    const text = JSON.stringify(s);
    for (const hidden of ['ops@harborridge.example', 'notifyEmail', 'portalUrl', 'tokenHash', 'blob']) assert.ok(!text.includes(hidden), `${hidden} is not sent to the investor`);
    let [row] = await list(base);
    assert.equal(row.status, 'opened');
    assert.equal(row.events[0].kind, 'invite_opened');
    clock.t += 3600e3;
    await investorGet(base, r.token);
    [row] = await list(base);
    assert.equal(row.openedAt, new Date(T0).toISOString(), 'opened is recorded once');
    assert.equal(row.events.filter((e) => e.kind === 'invite_opened').length, 1);
    // Bad or missing tokens.
    assert.equal((await j(base, 'GET', '/v1/invite', { auth: false })).status, 401);
    assert.equal((await j(base, 'GET', '/v1/invite')).status, 401, 'API_TOKEN is not an invitation token');
    assert.equal((await investorGet(base, 'abc')).status, 401);
    assert.equal((await investorGet(base, randomBytes(32).toString('base64url'))).status, 401);
    assert.match((await investorGet(base, randomBytes(32).toString('base64url'))).body.error, /not valid/);
  }));

test('progress: the step the investor is on is reported to the sponsor', () =>
  start({}, async (base) => {
    const r = await create(base);
    const p = await progress(base, r.token, { stepKey: 'tax', stepLabel: 'Tax certification', stepIndex: 6, stepCount: 10 });
    assert.deepEqual(p.body, { ok: true, status: 'in_progress' });
    await progress(base, r.token, { stepKey: 'tax', stepLabel: 'Tax certification', stepIndex: 6, stepCount: 10 });
    const [row] = await list(base);
    assert.equal(row.status, 'in_progress');
    assert.deepEqual([row.stepKey, row.stepLabel, row.stepIndex, row.stepCount], ['tax', 'Tax certification', 6, 10]);
    assert.ok(row.openedAt, 'progress implies opened');
    assert.equal(row.events.filter((e) => e.kind === 'invite_progress').length, 1, 'the same step is not repeated');
    for (const bad of [{ stepKey: 'bad key!', stepIndex: 1, stepCount: 10 }, { stepKey: 'tax', stepIndex: 11, stepCount: 10 }, { stepKey: 'tax', stepIndex: 1, stepCount: 0 }, { stepKey: 'tax' }]) assert.equal((await progress(base, r.token, bad)).status, 400, JSON.stringify(bad));
    assert.equal((await progress(base, r.token, '[1]')).status, 400);
  }));

const FAKESCREEN = { fakescreen: { id: 'fakescreen', name: 'Test screening', kind: 'aml', kinds: ['aml'], env: [], screen: async () => ({ hits: [] }) } };

test('complete with a signed PDF: the sponsor is emailed, the console fetches the submission, then purges it', () =>
  start({ env: { MAIL_FROM: 'notices@portal-mail.example' }, providers: Object.assign({}, BUILTINS, FAKESCREEN) }, async (base, server, clock) => {
    const r = await create(base);
    // The investor's browser runs its checks through this server with the link's token; the summary
    // reports what these checks say (the browser's own account is not taken as fact).
    const own = { id: 'HRC-0007', name: 'Zelda Quixote' };
    const v = await j(base, 'POST', '/v1/verifications', { token: r.token, auth: false, body: { kind: 'identity', provider: 'sandbox', investor: own } });
    const sbx = server.store.get('verifications', v.body.id).ref;
    assert.equal((await call(base, 'POST', `/sandbox/${sbx}`, { auth: false, body: 'outcome=passed', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).status, 200);
    const s = await j(base, 'POST', '/v1/screenings', { token: r.token, auth: false, body: { provider: 'fakescreen', names: ['Zelda Quixote'], investor: own } });
    assert.equal(s.body.status, 'clear');
    await progress(base, r.token, { stepKey: 'sign', stepLabel: 'Subscription agreement', stepIndex: 9, stepCount: 10 });
    clock.t += 20 * 60e3;
    const base0 = submission();
    const checked = submission({ investor: Object.assign({}, base0.investor, { verify: { identity: { status: 'passed', ref: v.body.id }, aml: { status: 'clear', results: [{ how: 'server', status: 'clear', ref: s.body.id }] }, accreditation: { status: 'review' } } }) });
    const c = await complete(base, r.token, checked);
    assert.deepEqual(c.body, { ok: true });
    const [row] = await list(base);
    assert.equal(row.status, 'completed');
    assert.equal(row.completedAt, new Date(clock.t).toISOString());
    assert.equal(row.hasSubmission, true);
    assert.equal(row.notifyStatus, 'outbox');
    assert.equal(row.stepKey, 'done');
    assert.equal(row.stepIndex, 10);
    assert.ok(row.events.some((e) => e.kind === 'onboarding_completed'));
    const note = (await outbox(base, r.id)).find((m) => m.kind === 'sponsor_notification');
    assert.equal(note.to, 'ops@harborridge.example');
    assert.equal(note.from, '"Harbor Ridge Capital" <notices@portal-mail.example>');
    assert.equal(note.subject, 'Zelda Quixote finished onboarding for Harbor Ridge Fund II');
    for (const s of ['Commitment: $250,000', 'Identity: Verified', 'Sanctions screening: Clear', 'Accredited investor: In review', 'Subscription agreement: Signed by the investor; waiting for your countersignature', 'Next: countersign the subscription agreement in the console.', `${PORTAL}#console-investors`, 'November 10, 2026']) assert.ok(note.text.includes(s), s);
    assert.ok(!note.text.includes('000123456789') && !note.html.includes('021000021'), 'no bank details in the email');
    assert.ok(!/carrow|powered by/i.test(note.text + note.html));
    // The console fetches the submission.
    const sub = await j(base, 'GET', `/v1/invitations/${r.id}/submission`);
    assert.equal(sub.status, 200);
    assert.equal(sub.body.investorId, 'HRC-0007');
    assert.equal(sub.body.investor.payment.account, '000123456789');
    assert.equal(sub.body.request.cents, 25000000);
    assert.equal(sub.body.envelope.status, 'sent');
    assert.deepEqual(Buffer.from(sub.body.files['env-1-work'], 'base64'), pdf('SIGNEDMARKER'));
    assert.deepEqual(sub.body.docs, [], 'a document listing only for the signed copy of a completed agreement');
    assert.equal(sub.body.audit[0].action, 'Envelope signed');
    assert.equal(sub.body.notifications[0].kind, 'agreement_signed');
    assert.equal(sub.body.investor.verify.identity.status, 'passed');
    assert.deepEqual([sub.body.checks.identity.confirmed, sub.body.checks.aml.confirmed], [true, true]);
    // Repeats are harmless; later changes are refused.
    assert.deepEqual((await complete(base, r.token)).body, { ok: true, already: true });
    assert.equal((await progress(base, r.token, { stepKey: 'tax', stepIndex: 1, stepCount: 10 })).status, 409);
    assert.equal((await j(base, 'POST', `/v1/invitations/${r.id}/cancel`)).status, 409);
    assert.equal((await j(base, 'POST', `/v1/invitations/${r.id}/resend`, { body: {} })).status, 409);
    // The investor can still open the link (their done page) until it expires.
    assert.equal((await investorGet(base, r.token)).body.status, 'completed');
    // Purge after import.
    const blobs = server.store.get('invitations', r.id).submissionBlobs;
    assert.equal(blobs.length, 1);
    assert.deepEqual((await j(base, 'DELETE', `/v1/invitations/${r.id}/submission`)).body, { ok: true, deleted: true });
    assert.equal((await j(base, 'GET', `/v1/invitations/${r.id}/submission`)).status, 404);
    assert.deepEqual((await j(base, 'DELETE', `/v1/invitations/${r.id}/submission`)).body, { ok: true, deleted: false });
    assert.equal(server.store.getBlob(blobs[0]), null);
    const [after] = await list(base);
    assert.equal(after.hasSubmission, false);
    assert.equal(after.importedAt, new Date(clock.t).toISOString());
    assert.equal(server.store.get('invitations', r.id).submission, null);
    assert.equal((await j(base, 'GET', '/v1/invitations/ivt_nope/submission')).status, 404);
  }));

test('complete: the payload is checked against the invitation', () =>
  start({}, async (base) => {
    const r = await create(base);
    const cases = [
      [submission({ investor: Object.assign(submission().investor, { id: 'HRC-0008' }) }), /investor.id does not match/],
      [submission({ request: Object.assign(submission().request, { investorId: 'HRC-0008' }) }), /request.investorId does not match/],
      [submission({ files: { 'env-1-work': Buffer.from('<html>not a pdf</html>').toString('base64') } }), /not a PDF/],
      [submission({ files: { '../x': pdf('X').toString('base64') } }), /document ids/],
      [submission({ files: { 'env-1-work': 'not base64 !!' } }), /base64/],
      [submission({ investor: null }), /investor is required/],
      [submission({ docs: 'x' }), /docs must be a list/]
    ];
    for (const [body, re] of cases) {
      const res = await complete(base, r.token, body);
      assert.equal(res.status, 400, re.source);
      assert.match(res.body.error, re);
    }
    assert.equal((await list(base))[0].status, 'sent', 'a refused submission changes nothing');
    assert.equal((await list(base))[0].hasSubmission, false);
    // Without an offering or envelope the investor can still finish.
    const ok = await complete(base, r.token, submission({ request: null, envelope: null, files: {}, docs: [] }));
    assert.deepEqual(ok.body, { ok: true });
  }));

test('expiry: the link answers 410 after INVITE_DAYS; resend gives a new link and the old one stops working', () =>
  start({}, async (base, server, clock) => {
    const r = await create(base);
    clock.t = T0 + 30 * DAY + 1000;
    const g = await investorGet(base, r.token);
    assert.equal(g.status, 410);
    assert.match(g.body.error, /expired\. Ask Harbor Ridge Capital to send you a new one/);
    assert.equal((await list(base))[0].status, 'expired');
    const re = await j(base, 'POST', `/v1/invitations/${r.id}/resend`, { body: {} });
    assert.equal(re.status, 200);
    assert.notEqual(re.body.token, r.token);
    assert.equal(re.body.expiresAt, new Date(clock.t + 30 * DAY).toISOString());
    assert.equal(re.body.emailStatus, 'outbox');
    assert.ok(re.body.link.endsWith(`#invite-${re.body.token}`));
    assert.equal((await investorGet(base, r.token)).status, 401, 'the old token no longer works');
    const g2 = await investorGet(base, re.body.token);
    assert.equal(g2.status, 200);
    assert.equal(g2.body.invitation.expiresAt, re.body.expiresAt);
    assert.equal((await list(base))[0].status, 'opened');
    const mail = (await outbox(base, r.id)).find((m) => m.kind === 'invitation_resent');
    assert.match(mail.subject, /^Reminder: Harbor Ridge Fund II/);
    assert.ok(mail.text.includes(re.body.link) && !mail.text.includes(r.token));
    assert.equal(server.store.get('invitations', r.id).tokenHash, sha(re.body.token));
  }));

test('INVITE_DAYS caps how long a link lives', () =>
  start({ env: { INVITE_DAYS: '7' } }, async (base) => {
    const r = await create(base);
    assert.equal(r.expiresAt, new Date(T0 + 7 * DAY).toISOString());
    const sooner = await create(base, { invitation: { expiresAt: new Date(T0 + 2 * DAY).toISOString() } });
    assert.equal(sooner.expiresAt, new Date(T0 + 2 * DAY).toISOString());
  }));

test('cancel: the link answers 410 and resend is refused', () =>
  start({}, async (base) => {
    const r = await create(base);
    assert.deepEqual((await j(base, 'POST', `/v1/invitations/${r.id}/cancel`)).body, { ok: true, status: 'cancelled' });
    const g = await investorGet(base, r.token);
    assert.equal(g.status, 410);
    assert.match(g.body.error, /cancelled/);
    assert.equal((await j(base, 'POST', `/v1/invitations/${r.id}/resend`, { body: {} })).status, 409);
    assert.equal((await list(base))[0].status, 'cancelled');
    assert.equal((await complete(base, r.token)).status, 410);
  }));

test('automatic purge: a submission 30 days after completion, the whole invitation 30 days after it ends', () =>
  start({ env: { INVITE_DAYS: '60' } }, async (base, server, clock) => {
    const r = await create(base, { invitation: { cents: 25000000, cls: 'A' } });
    assert.equal(r.expiresAt, new Date(T0 + 60 * DAY).toISOString());
    await complete(base, r.token);
    const rec = server.store.get('invitations', r.id);
    const blobs = rec.blobs.concat(rec.submissionBlobs);
    assert.equal(blobs.length, 3);
    clock.t = T0 + 29 * DAY;
    assert.equal((await list(base))[0].hasSubmission, true);
    clock.t = T0 + 31 * DAY;
    const [row] = await list(base);
    assert.equal(row.hasSubmission, false);
    assert.equal(row.status, 'completed');
    const sub = await j(base, 'GET', `/v1/invitations/${r.id}/submission`);
    assert.equal(sub.status, 404);
    assert.match(sub.body.error, /deleted/);
    assert.equal(server.store.getBlob(rec.submissionBlobs[0]), null);
    assert.ok(server.store.getBlob(rec.blobs[0]), 'the snapshot stays while the link is live');
    clock.t = T0 + 61 * DAY;
    assert.deepEqual(await list(base), []);
    for (const b of blobs) assert.equal(server.store.getBlob(b), null);
    assert.equal(server.store.list('invitations').length, 0);
    // An unopened invitation is removed 30 days after it expires, the outbox after 30 days.
    const u = await create(base);
    clock.t += 89 * DAY;
    assert.equal((await list(base))[0].status, 'expired');
    clock.t += 2 * DAY;
    assert.deepEqual(await list(base), []);
    assert.equal((await outbox(base, u.id)).length, 0);
    assert.ok(server.store.data().events.some((e) => e.type === 'submission_purged' && e.reason === 'age'));
  }));

test('encryption at rest: the store file and blobs never hold the name, email, bank account, note, token or PDFs', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'invite-store-'));
  const file = join(dir, 'store.json');
  let id;
  await start({ store: openStore(file) }, async (base, server) => {
    const r = await create(base);
    id = r.id;
    await investorGet(base, r.token);
    await complete(base, r.token);
    server.store.flush();
    const files = [readFileSync(file)].concat(readdirSync(server.store.blobDir).map((f) => readFileSync(join(server.store.blobDir, f))));
    assert.equal(files.length, 4, 'store plus three blobs (document, agreement template, signed PDF)');
    const all = Buffer.concat(files).toString('latin1');
    const secrets = ['Zelda Quixote', 'zelda@investor.example', '000123456789', '021000021', 'Welcome aboard', 'ops@harborridge.example', 'PPMMARKER', 'TEMPLATEMARKER', 'SIGNEDMARKER', '%PDF-', pdf('SIGNEDMARKER').toString('base64').slice(0, 40), r.token, 'Harbor Ridge Fund II'];
    for (const s of secrets) assert.ok(!all.includes(s), `${s} is not stored in plain text`);
    assert.ok(readFileSync(file, 'utf8').includes('"kid"'), 'sealed records carry a key id');
  });
  // The same key reads it back after a restart.
  await start({ store: openStore(file) }, async (base) => {
    const sub = await j(base, 'GET', `/v1/invitations/${id}/submission`);
    assert.equal(sub.status, 200);
    assert.equal(sub.body.investor.contact, 'Zelda Quixote');
    assert.equal((await list(base))[0].contact, 'Zelda Quixote');
  });
  // A different key cannot; the previous key can be kept as DATA_KEY_PREVIOUS while rotating.
  const other = randomBytes(32).toString('base64');
  await start({ store: openStore(file), env: { DATA_KEY: other } }, async (base) => {
    const sub = await j(base, 'GET', `/v1/invitations/${id}/submission`);
    assert.equal(sub.status, 500);
    assert.match(sub.body.error, /different DATA_KEY/);
  });
  await start({ store: openStore(file), env: { DATA_KEY: other, DATA_KEY_PREVIOUS: KEY } }, async (base) => {
    assert.equal((await j(base, 'GET', `/v1/invitations/${id}/submission`)).status, 200);
  });
  // A tampered record fails its integrity check instead of being read.
  await start({ store: openStore(file) }, async (base, server) => {
    const rec = server.store.get('invitations', id);
    const data = Buffer.from(rec.submission.data, 'base64');
    data[0] ^= 1;
    server.store.put('invitations', { id, submission: Object.assign({}, rec.submission, { data: data.toString('base64') }) });
    const sub = await j(base, 'GET', `/v1/invitations/${id}/submission`);
    assert.equal(sub.status, 500);
    assert.match(sub.body.error, /integrity/);
    // Moving a sealed value to another field (or record) fails too: the record id and field are bound in.
    const fresh = server.store.get('invitations', id);
    server.store.put('invitations', { id, submission: fresh.snapshot });
    assert.equal((await j(base, 'GET', `/v1/invitations/${id}/submission`)).status, 500);
  });
});

test('DATA_KEY and API_TOKEN are required for invitations (not for the existing verification routes)', async () => {
  await withServer({ env: { NODE_ENV: 'production', API_TOKEN: API, PUBLIC_URL: PUBLIC } }, async (base) => {
    const r = await j(base, 'POST', '/v1/invitations', { body: payload() });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /^Set DATA_KEY on the integration server/);
    assert.equal((await j(base, 'GET', '/v1/invitations')).status, 400);
    assert.equal((await investorGet(base, randomBytes(32).toString('base64url'))).status, 400);
    const v = await j(base, 'POST', '/v1/verifications', { body: { kind: 'identity', provider: 'sandbox', investor: { id: 'X-1', name: 'Ann Lee' } } });
    assert.equal(v.status, 200);
  });
  await withServer({ env: { NODE_ENV: 'production', API_TOKEN: API, ALLOW_PLAINTEXT_STORE: '1' } }, async (base) => {
    assert.equal((await j(base, 'POST', '/v1/invitations', { body: payload() })).status, 200);
  });
  await withServer({ env: { API_TOKEN: API, DATA_KEY: 'too-short' } }, async (base) => {
    const r = await j(base, 'POST', '/v1/invitations', { body: payload() });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /DATA_KEY must be 32 random bytes/);
  });
  await withServer({ env: { DATA_KEY: KEY } }, async (base) => {
    const r = await j(base, 'POST', '/v1/invitations', { body: payload(), auth: false });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /Set API_TOKEN/);
  });
  await start({}, async (base) => {
    assert.equal((await j(base, 'POST', '/v1/invitations', { body: payload(), auth: false })).status, 401);
    assert.equal((await j(base, 'GET', '/v1/invitations', { auth: false })).status, 401);
    assert.equal((await j(base, 'GET', '/v1/outbox', { auth: false })).status, 401);
  });
});

test('the invitation token authorizes its own investor’s verifications and screenings, and nothing else', () => {
  const providers = Object.assign({}, BUILTINS, { fakescreen: { id: 'fakescreen', name: 'Test screening', kind: 'aml', kinds: ['aml'], env: [], screen: async () => ({ hits: [] }) } });
  return start({ providers }, async (base, server, clock) => {
    const r = await create(base);
    const own = { id: 'HRC-0007', name: 'Zelda Quixote' };
    const other = { id: 'HRC-0008', name: 'Someone Else' };
    const v = await j(base, 'POST', '/v1/verifications', { token: r.token, auth: false, body: { kind: 'identity', provider: 'sandbox', investor: own } });
    assert.equal(v.status, 200);
    assert.equal(server.store.get('verifications', v.body.id).workspace, 'ws-harbor');
    assert.equal((await j(base, 'GET', `/v1/verifications/${v.body.id}`, { token: r.token, auth: false })).body.status, 'pending');
    assert.equal((await j(base, 'POST', '/v1/verifications', { token: r.token, auth: false, body: { kind: 'identity', provider: 'sandbox', investor: other } })).status, 403);
    const theirs = await j(base, 'POST', '/v1/verifications', { body: { kind: 'identity', provider: 'sandbox', investor: other } });
    assert.equal(theirs.status, 200, 'the console keeps using API_TOKEN');
    assert.equal((await j(base, 'GET', `/v1/verifications/${theirs.body.id}`, { token: r.token, auth: false })).status, 403);
    const s = await j(base, 'POST', '/v1/screenings', { token: r.token, auth: false, body: { provider: 'fakescreen', names: ['Zelda Quixote'], investor: own } });
    assert.equal(s.status, 200);
    assert.equal(s.body.status, 'clear');
    assert.equal((await j(base, 'GET', `/v1/screenings/${s.body.id}`, { token: r.token, auth: false })).status, 200);
    assert.equal((await j(base, 'POST', '/v1/screenings', { token: r.token, auth: false, body: { provider: 'fakescreen', names: ['X'], investor: other } })).status, 403);
    const s2 = await j(base, 'POST', '/v1/screenings', { body: { provider: 'fakescreen', names: ['X'], investor: other } });
    assert.equal((await j(base, 'GET', `/v1/screenings/${s2.body.id}`, { token: r.token, auth: false })).status, 403);
    // Sponsor routes refuse the invitation token, even alongside API_TOKEN.
    for (const [method, path] of [['GET', '/v1/invitations'], ['POST', '/v1/invitations'], ['GET', '/v1/outbox'], ['GET', '/v1/connectors'], ['GET', `/v1/invitations/${r.id}/submission`], ['POST', `/v1/invitations/${r.id}/resend`], ['GET', `/v1/verifications/${v.body.id}/evidence/0`]]) {
      assert.equal((await j(base, method, path, { token: r.token, auth: false, body: method === 'POST' ? {} : undefined })).status, 401, `${method} ${path}`);
      assert.equal((await j(base, method, path, { token: r.token, body: method === 'POST' ? {} : undefined })).status, 401, `${method} ${path} with both`);
    }
    // No token at all, or a dead one.
    assert.equal((await j(base, 'POST', '/v1/verifications', { auth: false, body: { kind: 'identity', provider: 'sandbox', investor: own } })).status, 401);
    assert.equal((await j(base, 'GET', `/v1/verifications/${v.body.id}`, { token: randomBytes(32).toString('base64url'), auth: false })).status, 401);
    clock.t += 31 * DAY;
    assert.equal((await j(base, 'GET', `/v1/verifications/${v.body.id}`, { token: r.token, auth: false })).status, 410);
  });
});

test('CORS: the portal’s origin may send X-Invite-Token, PUT and DELETE; other origins and portal URLs are refused', () =>
  start({ env: { PORTAL_ORIGIN: 'https://portal.example' } }, async (base) => {
    const pre = await fetch(`${base}/v1/invite/progress`, { method: 'OPTIONS', headers: { Origin: 'https://portal.example', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'x-invite-token, content-type' } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), 'https://portal.example');
    assert.match(pre.headers.get('access-control-allow-headers'), /X-Invite-Token/);
    assert.match(pre.headers.get('access-control-allow-methods'), /PUT/);
    assert.match(pre.headers.get('access-control-allow-methods'), /DELETE/);
    const evil = await fetch(`${base}/v1/invite`, { headers: { Origin: 'https://evil.example', 'X-Invite-Token': 'x' } });
    assert.equal(evil.status, 403);
    const r = await create(base);
    const g = await j(base, 'GET', '/v1/invite', { token: r.token, auth: false, headers: { Origin: 'https://portal.example' } });
    assert.equal(g.status, 200);
    assert.equal(g.headers.get('access-control-allow-origin'), 'https://portal.example');
    const off = await j(base, 'POST', '/v1/invitations', { body: payload({ portalUrl: 'https://phish.example/diy.html' }) });
    assert.equal(off.status, 400);
    assert.match(off.body.error, /portalUrl/);
    // A console link off the portal's origin falls back to the portal's own console page.
    const c = await create(base, { consoleUrl: 'https://phish.example/console' });
    await complete(base, c.token);
    const note = (await outbox(base, c.id)).find((m) => m.kind === 'sponsor_notification');
    assert.ok(note.text.includes(`${PORTAL}#console-investors`) && !note.text.includes('phish'));
  }));

test('rate limits: failed tokens and writes are limited per client', async () => {
  await start({ env: { RATE_LIMIT_PER_MIN: '3' } }, async (base) => {
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await investorGet(base, randomBytes(32).toString('base64url'))).status);
    assert.deepEqual(codes, [401, 401, 401, 429]);
  });
  await start({ env: { RATE_LIMIT_PER_MIN: '3' } }, async (base) => {
    const r = await create(base);
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await progress(base, r.token, { stepKey: `s${i}`, stepIndex: i, stepCount: 10 })).status);
    assert.deepEqual(codes, [200, 200, 429]);
    assert.equal((await investorGet(base, r.token)).status, 200, 'reading the snapshot is not limited');
  });
});

test('body size limits: documents 10 MB, logo 600 KB, signed files 25 MB, small calls 16 KB', () =>
  start({}, async (base) => {
    const big = (mb, marker) => ({ title: marker, fileName: `${marker}.pdf`, base64: pdf(marker, mb * 1024 * 1024).toString('base64') });
    let r = await j(base, 'POST', '/v1/invitations', { body: payload({ offering: Object.assign({}, payload().offering, { documents: [big(6, 'a'), big(6, 'b')] }) }) });
    assert.equal(r.status, 413);
    assert.match(r.body.error, /together \(at most 10 MB\)/);
    r = await j(base, 'POST', '/v1/invitations', { body: payload({ offering: Object.assign({}, payload().offering, { documents: [big(11, 'a')] }) }) });
    assert.equal(r.status, 413);
    r = await j(base, 'POST', '/v1/invitations', { body: payload({ firm: Object.assign({}, FIRM, { logo: `data:image/png;base64,${'A'.repeat(700 * 1024)}` }) }) });
    assert.equal(r.status, 413);
    assert.match(r.body.error, /600 KB/);
    r = await j(base, 'POST', '/v1/invitations', { body: payload({ esign: { template: { title: 't' }, pdf: Buffer.from('not a pdf').toString('base64') } }) });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /esign.pdf is not a PDF/);
    r = await j(base, 'POST', '/v1/invitations', { body: 'x'.repeat(33 * 1024 * 1024) });
    assert.equal(r.status, 413);
    const ok = await create(base);
    r = await complete(base, ok.token, submission({ files: { 'env-1-work': pdf('a', 26 * 1024 * 1024).toString('base64') } }));
    assert.equal(r.status, 413);
    assert.match(r.body.error, /25 MB/);
    r = await progress(base, ok.token, { stepKey: 'tax', stepIndex: 1, stepCount: 10, stepLabel: 'x'.repeat(20 * 1024) });
    assert.equal(r.status, 413);
    // Within the limits, a large signed file is accepted.
    r = await complete(base, ok.token, submission({ files: { 'env-1-work': pdf('a', 5 * 1024 * 1024).toString('base64') } }));
    assert.deepEqual(r.body, { ok: true });
  }));

test('SMTP end to end: the invitation and the sponsor’s notification are sent from the firm; failures are reported', async () => {
  const smtp = await fakeSmtp({});
  try {
    await start({ env: { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_ALLOW_PLAIN: '1', MAIL_FROM: 'notices@portal-mail.example' } }, async (base) => {
      const r = await create(base);
      assert.equal(r.emailStatus, 'sent');
      const [m] = smtp.messages;
      assert.deepEqual(m.to, ['zelda@investor.example']);
      assert.equal(m.from, 'notices@portal-mail.example');
      assert.equal(head(m.data, 'From'), '"Harbor Ridge Capital" <notices@portal-mail.example>');
      assert.equal(head(m.data, 'Reply-To'), '<ir@harborridge.example>');
      assert.equal(head(m.data, 'To'), '"Zelda Quixote" <zelda@investor.example>');
      assert.match(head(m.data, 'Content-Type'), /^multipart\/related/, 'the logo is inlined');
      assert.ok(parts(m.data).text.includes(r.link));
      assert.ok(parts(m.data).html.includes('cid:logo@firm'));
      await complete(base, r.token);
      const note = smtp.messages[1];
      assert.deepEqual(note.to, ['ops@harborridge.example']);
      assert.equal(head(note.data, 'Subject'), 'Zelda Quixote finished onboarding for Harbor Ridge Fund II');
      assert.equal(head(note.data, 'Auto-Submitted'), 'auto-generated');
      assert.equal((await list(base))[0].notifyStatus, 'sent');
      assert.equal((await outbox(base)).length, 0, 'nothing goes to the outbox when SMTP is set');
    });
    await start({ env: { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_ALLOW_PLAIN: '1', SMTP_TIMEOUT_MS: '1000', MAIL_FROM: 'notices@portal-mail.example' } }, async (base) => {
      const r = await create(base);
      assert.equal(r.emailStatus, 'failed');
      assert.match(r.emailError, /could not be reached/);
      assert.ok(r.link.includes(r.token), 'the sponsor still gets the link to send another way');
      const [row] = await list(base);
      assert.equal(row.emailStatus, 'failed');
      assert.match(row.emailError, /could not be reached/);
    });
  } finally {
    await smtp.close();
  }
});
