// Leftovers from turnkey onboarding: an investor already on the firm's books invited to another
// offering (the flag, a short email, the sponsor's summary), ID photos in a finished onboarding,
// and the two wordings for results the server cannot confirm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';
import { BUILTINS } from '../providers/index.mjs';

const API = 'sponsor-api-token-0123456789';
const KEY = randomBytes(32).toString('base64');
const FIRM = { name: 'Harbor Ridge Capital', supportEmail: 'ir@harborridge.example' };
const b64 = (buf) => Buffer.from(buf).toString('base64');
const PDF = b64('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const PNG = b64(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(64)]));
const JPEG = b64(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(64)]));
const GIF = b64(Buffer.concat([Buffer.from('GIF89a'), randomBytes(64)]));
const HTML = b64('<html><script>alert(1)</script></html>');

const payload = (over = {}) =>
  Object.assign(
    {
      workspace: 'ws-harbor',
      portalUrl: 'https://portal.example/portal.html',
      notifyEmail: 'ops@harborridge.example',
      firm: FIRM,
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
      offering: { id: 'hr-fund-iii', name: 'Harbor Ridge Fund III', exemption: 'Rule 506(b)', documents: [] },
      invitation: { cents: 5000000 }
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
const start = (fn) => withServer({ env: { API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: 'https://verify.example' }, providers: BUILTINS }, fn);
const create = async (base, over) => (await j(base, 'POST', '/v1/invitations', { body: payload(over) })).body;
const outbox = async (base, id) => (await j(base, 'GET', `/v1/outbox?invitation=${id}`)).body.messages;
const complete = (base, token, body) => j(base, 'POST', '/v1/invite/complete', { token, auth: false, body });

test('an investor already on file: the flag and accreditation summary reach the link, the email invites them to subscribe', () =>
  start(async (base) => {
    const r = await create(base, {
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example', existing: { accredited: true, accreditedUntil: '2027-03-01', holds: false, ssn: '123-45-6789', bank: '000123456' } },
      invitation: { cents: 5000000, existing: true }
    });
    assert.ok(r.token, JSON.stringify(r));
    const snap = (await j(base, 'GET', '/v1/invite', { token: r.token, auth: false })).body;
    assert.equal(snap.invitation.existing, true);
    assert.deepEqual(snap.investor.existing, { accredited: true, accreditedUntil: '2027-03-01', holds: false }, 'only the flags and the date, nothing else the console sent');
    assert.ok(!JSON.stringify(snap).includes('123-45-6789') && !JSON.stringify(snap).includes('000123456'));
    const [m] = await outbox(base, r.id);
    assert.equal(m.kind, 'invitation');
    assert.equal(m.subject, 'Harbor Ridge Fund III: your subscription');
    assert.match(m.text, /has invited you to subscribe to Harbor Ridge Fund III/);
    assert.match(m.text, /Your account details are already on file/);
    assert.ok(!/photo ID|bank details ready/i.test(m.text), 'no request for ID or bank details');
    assert.ok(m.text.includes(r.link));
    assert.ok(!/carrow|powered by|diy portal/i.test(m.text + m.html));
    // A reminder keeps the subscription wording.
    const again = await j(base, 'POST', `/v1/invitations/${r.id}/resend`, { body: {} });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    const re = (await outbox(base, r.id)).find((x) => x.kind === 'invitation_resent');
    assert.equal(re.subject, 'Reminder: Harbor Ridge Fund III: your subscription');
    assert.match(re.text, /new link to your subscription to Harbor Ridge Fund III/);
    assert.ok(!/photo ID|bank details ready/i.test(re.text));
  }));

test('a bad existing summary is cleaned: a date that is not a date is dropped, flags are only true when true', () =>
  start(async (base) => {
    const r = await create(base, { investor: { id: 'HRC-0008', contact: 'Ada Q', email: 'ada@investor.example', existing: { accredited: 'yes', accreditedUntil: '2027-03-01<script>', holds: 1 } }, invitation: { cents: 0, existing: 'true' } });
    const snap = (await j(base, 'GET', '/v1/invite', { token: r.token, auth: false })).body;
    assert.deepEqual(snap.investor.existing, { accredited: false, accreditedUntil: '', holds: false });
    assert.equal(snap.invitation.existing, undefined, 'existing is only set by a real true');
    const [m] = await outbox(base, r.id);
    assert.equal(m.subject, 'Harbor Ridge Fund III: complete your investor onboarding');
  }));

test('the sponsor summary for an existing investor: no identity or screening rows, accreditation on file, subscription subject', () =>
  start(async (base) => {
    const r = await create(base, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', email: 'zelda@investor.example', existing: { accredited: true, accreditedUntil: '2027-03-01' } }, invitation: { cents: 5000000, existing: true } });
    const done = await complete(base, r.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote' }, request: { id: 'req-9', offeringId: 'hr-fund-iii', cents: 5000000 } });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    const n = (await outbox(base, r.id)).find((x) => x.kind === 'sponsor_notification');
    assert.equal(n.subject, 'Zelda Quixote finished their subscription to Harbor Ridge Fund III');
    assert.match(n.text, /completed the subscription steps on/);
    assert.ok(!/^Identity:/m.test(n.text) && !/^Sanctions screening:/m.test(n.text), n.text);
    assert.match(n.text, /^Accredited investor: On file$/m);
    assert.match(n.text, /^Commitment: \$50,000$/m);
  }));

test('a finished onboarding may carry ID photos (PNG, JPEG) next to PDFs; any other format is refused', () =>
  start(async (base) => {
    const r = await create(base);
    // Evidence is the investor's own upload, named by their verification record (integrations.js: kyc-<investor id>-<time>).
    const withId = (fileId) => ({ id: 'HRC-0007', contact: 'Zelda Quixote', verify: { identity: { status: 'review', how: 'manual', fileId } } });
    const bad = await complete(base, r.token, { investor: withId('kyc-HRC-0007-front'), files: { 'kyc-HRC-0007-front': GIF } });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /files\.kyc-HRC-0007-front is not a PDF, PNG or JPEG/);
    const html = await complete(base, r.token, { investor: withId('kyc-HRC-0007-front'), files: { 'kyc-HRC-0007-front': HTML } });
    assert.equal(html.status, 400);
    const investor = { id: 'HRC-0007', contact: 'Zelda Quixote', verify: { identity: { status: 'review', how: 'manual', fileId: 'kyc-HRC-0007-front' }, accreditation: { status: 'review', how: 'manual', fileId: 'kyc-HRC-0007-letter' } } };
    const envelope = { id: 'env-9', status: 'sent', workDocId: 'env-9-work' };
    const ok = await complete(base, r.token, { investor, envelope, files: { 'env-9-work': PDF, 'kyc-HRC-0007-front': PNG, 'kyc-HRC-0007-letter': JPEG } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const sub = (await j(base, 'GET', `/v1/invitations/${r.id}/submission`)).body;
    assert.equal(sub.files['env-9-work'], PDF);
    assert.equal(sub.files['kyc-HRC-0007-front'], PNG);
    assert.equal(sub.files['kyc-HRC-0007-letter'], JPEG);
  }));

test('results the server cannot confirm: self-certified and sandbox results are "to be confirmed" by the console, a provider claim needs review', () =>
  start(async (base) => {
    const a = await create(base, { offering: { id: 'hr-fund-iii', name: 'Harbor Ridge Fund III', exemption: 'Rule 506(c)', documents: [] } });
    const soft = { identity: { status: 'passed', connection: 'sandbox', how: 'sandbox' }, accreditation: { status: 'verified', connection: 'self', how: 'self' }, aml: { status: 'not_started' } };
    assert.equal((await complete(base, a.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', verify: soft } })).status, 200);
    const na = (await outbox(base, a.id)).find((x) => x.kind === 'sponsor_notification');
    assert.match(na.text, /^Identity: To be confirmed: your console checks this result against your rules/m);
    assert.match(na.text, /^Accredited investor: To be confirmed/m);
    const subA = (await j(base, 'GET', `/v1/invitations/${a.id}/submission`)).body;
    assert.equal(subA.investor.verify.identity.status, 'review', 'still held on the server; only the console accepts it');
    assert.equal(subA.investor.verify.accreditation.status, 'review');

    const b = await create(base, { investor: { id: 'HRC-0010', contact: 'Bo Q', email: 'bo@investor.example' } });
    const hard = { identity: { status: 'passed', connection: 'conn-acme', how: 'server', ref: 'ver_forged' }, accreditation: { status: 'verified', connection: 'conn-acc' }, aml: { status: 'not_started' } };
    assert.equal((await complete(base, b.token, { investor: { id: 'HRC-0010', contact: 'Bo Q', verify: hard } })).status, 200);
    const nb = (await outbox(base, b.id)).find((x) => x.kind === 'sponsor_notification');
    assert.match(nb.text, /^Identity: Needs your review/m);
    assert.match(nb.text, /^Accredited investor: Needs your review/m);
  }));

test('a finished onboarding the console never imported: the sponsor is reminded once, a week before it is deleted', async () => {
  const clock = { t: Date.parse('2026-11-10T12:00:00Z') };
  const DAY = 864e5;
  await withServer({ env: { API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: 'https://verify.example' }, providers: BUILTINS, now: () => clock.t }, async (base, server) => {
    const kept = await create(base, { investor: { id: 'HRC-0021', contact: 'Kept Waiting', email: 'kept@investor.example' } });
    const taken = await create(base, { investor: { id: 'HRC-0022', contact: 'Taken Quickly', email: 'taken@investor.example' } });
    for (const [r, id, name] of [[kept, 'HRC-0021', 'Kept Waiting'], [taken, 'HRC-0022', 'Taken Quickly']]) assert.equal((await complete(base, r.token, { investor: { id, contact: name } })).status, 200);
    // The console imports one of them straight away.
    assert.equal((await j(base, 'DELETE', `/v1/invitations/${taken.id}/submission`)).status, 200);
    const reminders = async () => (await j(base, 'GET', '/v1/outbox')).body.messages.filter((m) => m.kind === 'submission_reminder');

    clock.t += 22 * DAY;
    assert.equal(server.invitations.purge(clock.t).reminders, 0, 'not before 23 days');
    clock.t += 1 * DAY + 60e3;
    assert.equal(server.invitations.purge(clock.t).reminders, 1);
    await new Promise((r) => setTimeout(r, 50));
    const [m, extra] = await reminders();
    assert.ok(m && !extra, 'exactly one reminder, for the onboarding still waiting');
    assert.equal(m.invitationId, kept.id);
    assert.equal(m.to, 'ops@harborridge.example');
    assert.equal(m.subject, 'Waiting in your console: Kept Waiting’s onboarding');
    assert.match(m.text, /has not added them to your investor records yet/);
    assert.match(m.text, /^Deleted on: December 10, 2026$/m);
    assert.match(m.text, /Open the console before December 10, 2026/);
    assert.ok(!/carrow|powered by|diy portal/i.test(m.text + m.html));
    assert.equal(server.store.get('invitations', kept.id).reminderStatus, 'outbox');

    clock.t += 3 * DAY;
    assert.equal(server.invitations.purge(clock.t).reminders, 0, 'never twice');
    assert.equal((await reminders()).length, 1);
    clock.t += 5 * DAY;
    const out = server.invitations.purge(clock.t);
    assert.equal(out.submissions, 1, 'deleted after 30 days, as the reminder said');
    assert.equal(out.reminders, 0);
  });
});

test('with no commitment set by the sponsor, the investor’s amount must be a positive whole number of cents, at least the minimum', () =>
  start(async (base) => {
    const r = await create(base, { offering: { id: 'hr-fund-iii', name: 'Harbor Ridge Fund III', exemption: 'Rule 506(b)', minimum: 25000, documents: [] }, invitation: { cents: 0 } });
    const send = (cents) => complete(base, r.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote' }, request: { id: 'req-c', offeringId: 'hr-fund-iii', cents } });
    for (const bad of [-25000000, 0, 1234.5, 'lots', 2400000]) {
      const x = await send(bad);
      assert.equal(x.status, 400, `cents ${bad} is refused`);
    }
    assert.match((await send(2400000)).body.error, /below the offering minimum/);
    const ok = await send(2500000);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const sub = (await j(base, 'GET', `/v1/invitations/${r.id}/submission`)).body;
    assert.equal(sub.request.cents, 2500000);
  }));

test('a portal link for an investor added from paper documents: its own email, reminder and sponsor notice; nothing to fill in', () =>
  start(async (base) => {
    const r = await create(base, { offering: null, investor: { id: 'HRC-0031', contact: 'Paula Paper', email: 'paula@investor.example', existing: { accredited: false, accreditedUntil: '', holds: false } }, invitation: { cents: 0, existing: true, access: true } });
    assert.ok(r.token, JSON.stringify(r));
    const snap = (await j(base, 'GET', '/v1/invite', { token: r.token, auth: false })).body;
    assert.equal(snap.invitation.access, true);
    assert.equal(snap.invitation.existing, true);
    const [m] = await outbox(base, r.id);
    assert.equal(m.subject, 'Harbor Ridge Capital: your investor portal');
    assert.match(m.text, /has set up your investor portal/);
    assert.match(m.text, /nothing to fill in/);
    assert.match(m.text, /Open your portal:/);
    assert.ok(!/photo ID|bank details|onboarding|identity verification/i.test(m.text), m.text);
    assert.ok(!/carrow|powered by|diy/i.test(m.text + m.html));
    const again = await j(base, 'POST', `/v1/invitations/${r.id}/resend`, { body: {} });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    const re = (await outbox(base, r.id)).find((x) => x.kind === 'invitation_resent');
    assert.equal(re.subject, 'Reminder: Harbor Ridge Capital: your investor portal');
    const done = await complete(base, again.body.token, { investor: { id: 'HRC-0031', contact: 'Paula Paper' } });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    const n = (await outbox(base, r.id)).find((x) => x.kind === 'sponsor_notification');
    assert.equal(n.subject, 'Paula Paper opened their investor portal');
    assert.match(n.text, /created their login/);
    assert.ok(!/subscription|Identity:|Sanctions/i.test(n.text), n.text);
  }));

test('the access flag only counts for an investor already on file', () =>
  start(async (base) => {
    const r = await create(base, { offering: null, investor: { id: 'HRC-0032', contact: 'Nina New', email: 'nina@investor.example' }, invitation: { cents: 0, access: true } });
    const snap = (await j(base, 'GET', '/v1/invite', { token: r.token, auth: false })).body;
    assert.equal(snap.invitation.access, undefined);
    const [m] = await outbox(base, r.id);
    assert.match(m.subject, /Complete your investor onboarding/);
  }));
