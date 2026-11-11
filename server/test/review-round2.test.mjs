// Second review of turnkey onboarding, server side. Each test pins a defect and passes once it is fixed:
//   - an old verification or screening cannot be replayed as current: only checks created for the invitation count, and
//     every date (expiry, verified on, screened on) comes from the check's own record, never the investor's browser;
//   - a submission carries only the files it produced (its envelope's copies, the investor's own evidence) and at most one
//     document listing, the investor's signed copy, for them alone;
//   - the sponsor's emails for an investor already on file speak of their subscription, not their onboarding;
//   - with PORTAL_ORIGIN set, this server's own pages still accept their own form posts.
// Every time below comes from an injected clock, so nothing depends on how fast the tests run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';
import { BUILTINS } from '../providers/index.mjs';

const DAY = 864e5;
const T0 = Date.parse('2026-01-05T10:00:00Z');
const API = 'sponsor-api-token-0123456789';
const RESULTS = 'results-token-0123456789abcdef';
const KEY = randomBytes(32).toString('base64');
const PUBLIC = 'https://verify.example';
const b64 = (buf) => Buffer.from(buf).toString('base64');
const pdf = (marker) => b64(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const PNG = b64(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(32)]));
const FIRM = { name: 'Harbor Ridge Capital', supportEmail: 'ir@harborridge.example' };
const ME = { id: 'HRC-0007', name: 'Zelda Quixote' };
const providers = Object.assign({}, BUILTINS, {
  fakescreen: { id: 'fakescreen', name: 'Test screening', kind: 'aml', kinds: ['aml'], env: [], screen: async () => ({ hits: [] }) },
  // A provider flow on a page this server hosts, with a form that posts back to it.
  hostedtest: {
    id: 'hostedtest',
    name: 'Hosted test',
    kind: 'accreditation',
    kinds: ['accreditation'],
    env: [],
    start: 'hosted',
    createSession: async (ctx) => ({ url: ctx.hostedUrl, status: 'pending' }),
    page: async () => '<!doctype html><form method="post"><button name="answer" value="yes">Send</button></form>',
    hostedPost: async (ctx) => ({ status: ctx.form.answer === 'yes' ? 'verified' : 'pending', message: 'Thank you' })
  }
});

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
const EXISTING = { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', email: 'zelda@investor.example', existing: { accredited: false, holds: false } }, invitation: { cents: 5000000, existing: true } };

function start(fn, { env = {}, clock = { t: T0 } } = {}) {
  return withServer({ env: Object.assign({ API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: PUBLIC, RESULTS_TOKEN: RESULTS, RATE_LIMIT_PER_MIN: '0' }, env), providers, now: () => clock.t }, (base, server) => fn(base, server, clock));
}
async function j(base, method, path, { body, token, auth = true, headers = {} } = {}) {
  const h = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, auth ? { Authorization: `Bearer ${API}` } : {}, token ? { 'X-Invite-Token': token } : {}, headers);
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}
const create = async (base, over) => {
  const r = await j(base, 'POST', '/v1/invitations', { body: payload(over) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
};
const complete = (base, token, body) => j(base, 'POST', '/v1/invite/complete', { token, auth: false, body });
const submissionOf = async (base, id) => (await j(base, 'GET', `/v1/invitations/${id}/submission`)).body;
const outbox = async (base, id) => (await j(base, 'GET', `/v1/outbox?invitation=${id}`)).body.messages;
const note = async (base, id) => (await outbox(base, id)).find((m) => m.kind === 'sponsor_notification');
/** A check started by the investor's link (token) or by the sponsor's console (API_TOKEN, same workspace). */
const startCheck = async (base, kind, token, provider = 'sandbox') => {
  const r = token ? await j(base, 'POST', '/v1/verifications', { token, auth: false, body: { kind, provider, investor: ME } }) : await j(base, 'POST', '/v1/verifications', { body: { kind, provider, investor: Object.assign({ workspace: 'ws-harbor' }, ME) } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.id;
};
const screenWith = async (base, token) => {
  const r = token ? await j(base, 'POST', '/v1/screenings', { token, auth: false, body: { provider: 'fakescreen', names: [ME.name], investor: ME } }) : await j(base, 'POST', '/v1/screenings', { body: { provider: 'fakescreen', names: [ME.name], investor: Object.assign({ workspace: 'ws-harbor' }, ME) } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.id;
};
/** A provider (or the sponsor's automation) reports a result through the results API. */
const result = async (base, reference, status, extra) => {
  const r = await j(base, 'POST', '/v1/results', { auth: false, headers: { Authorization: `Bearer ${RESULTS}` }, body: Object.assign({ reference, status }, extra) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
};
const iso = (t) => new Date(t).toISOString();

/* ---------- Only checks created for this invitation; dates from their records ---------- */

test('an old verification cannot be replayed as current: it confirms nothing, its expiry is dropped and no pointer to it is kept', () =>
  start(async (base, server, clock) => {
    // January: the investor's accreditation was verified for an earlier offering (the provider gave no expiry).
    const old = await startCheck(base, 'accreditation');
    await result(base, old, 'verified');
    const stillPending = await startCheck(base, 'accreditation');
    // Ten months later the firm invites them to a Rule 506(c) offering; a modified page sends the old check as new.
    clock.t += 300 * DAY;
    const r = await create(base);
    const replay = { status: 'verified', ref: old, remote: true, how: 'server', connection: 'conn-acc', expiresAt: '2099-12-31', verifiedAt: '2099-12-01' };
    assert.equal((await complete(base, r.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', verify: { accreditation: replay } } })).status, 200);
    const sub = await submissionOf(base, r.id);
    const a = sub.investor.verify.accreditation;
    assert.deepEqual([a.status, a.reportedStatus], ['review', 'verified'], 'held for review, as a result no check confirms');
    assert.equal(a.expiresAt, undefined, 'never the browser’s expiry');
    assert.equal(a.ref, '', 'no pointer to the old check');
    assert.equal(a.remote, undefined);
    assert.equal(sub.checks.accreditation.confirmed, false);
    assert.match((await note(base, r.id)).text, /^Accredited investor: Needs your review/m);

    // A pending result pointing at an old check: the console polls pending checks with the sponsor's token, so it would read
    // the old check's result as this one's. The pointer goes; the result stays pending for a person to record.
    const r2 = await create(base);
    const pending = { status: 'pending', ref: stillPending, remote: true, how: 'server', connection: 'conn-acc' };
    assert.equal((await complete(base, r2.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', verify: { accreditation: pending } } })).status, 200);
    const p = (await submissionOf(base, r2.id)).investor.verify.accreditation;
    assert.deepEqual([p.status, p.ref, p.remote], ['pending', '', undefined]);
  }));

test('a check created for this invitation: status, expiry and dates come from its record, not the browser', () =>
  start(async (base, server, clock) => {
    const r = await create(base);
    clock.t += 60e3;
    const idCheck = await startCheck(base, 'identity', r.token);
    const accCheck = await startCheck(base, 'accreditation', r.token);
    // The provider answers two days later.
    clock.t += 2 * DAY;
    await result(base, idCheck, 'passed');
    await result(base, accCheck, 'verified');
    const answered = iso(clock.t);
    // A repeated delivery days later does not make the result look newer.
    clock.t += 3 * DAY;
    await result(base, accCheck, 'verified');
    assert.equal(server.store.get('verifications', accCheck).completedAt, answered);
    const scr = await screenWith(base, r.token);
    const screenedOn = iso(clock.t).slice(0, 10);
    clock.t += DAY;
    const forged = {
      identity: { status: 'passed', ref: idCheck, completedAt: '2099-01-01T00:00:00Z' },
      accreditation: { status: 'verified', ref: accCheck, expiresAt: '2099-12-31', verifiedAt: '2099-12-01', completedAt: '2099-12-01T00:00:00Z' },
      aml: { status: 'clear', screenedAt: '2099-01-01', results: [{ how: 'server', status: 'clear', ref: scr, screenedAt: '2099-01-01' }] }
    };
    assert.equal((await complete(base, r.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', verify: forged } })).status, 200);
    const sub = await submissionOf(base, r.id);
    const v = sub.investor.verify;
    assert.deepEqual([v.identity.status, v.identity.completedAt, v.identity.remote], ['passed', answered, true]);
    assert.equal(v.accreditation.status, 'verified');
    assert.equal(v.accreditation.verifiedAt, answered.slice(0, 10), 'verified on the day the result arrived');
    assert.equal(v.accreditation.completedAt, answered);
    assert.equal(v.accreditation.expiresAt, undefined, 'the record has no expiry, so none: the console applies the firm’s limit from verifiedAt');
    assert.deepEqual([v.aml.status, v.aml.results[0].screenedAt, v.aml.screenedAt], ['clear', screenedOn, screenedOn]);
    assert.equal(sub.checks.accreditation.confirmed, true);
    assert.match((await note(base, r.id)).text, /^Accredited investor: Verified$/m);

    // A provider's own expiry is kept (the console takes the earlier of it and the firm's limit).
    const r2 = await create(base);
    const acc2 = await startCheck(base, 'accreditation', r2.token);
    await result(base, acc2, 'verified', { expiresAt: '2026-04-01' });
    assert.equal((await complete(base, r2.token, { investor: { id: 'HRC-0007', verify: { accreditation: { status: 'verified', ref: acc2, expiresAt: '2099-12-31' } } } })).status, 200);
    assert.equal((await submissionOf(base, r2.id)).investor.verify.accreditation.expiresAt, '2026-04-01');
  }));

test('a record kept before results were dated is dated from its creation; a check started before a resend still counts', () =>
  start(async (base, server, clock) => {
    const r = await create(base);
    const acc = await startCheck(base, 'accreditation', r.token);
    const created = server.store.get('verifications', acc).createdAt;
    // Written the way an earlier version of this server stored a result: no completedAt.
    server.store.put('verifications', { id: acc, status: 'verified' });
    clock.t += 10 * DAY;
    const again = await j(base, 'POST', `/v1/invitations/${r.id}/resend`, { body: { sendEmail: false } });
    assert.equal(again.status, 200);
    assert.equal((await complete(base, again.body.token, { investor: { id: 'HRC-0007', verify: { accreditation: { status: 'verified', ref: acc } } } })).status, 200);
    const a = (await submissionOf(base, r.id)).investor.verify.accreditation;
    assert.deepEqual([a.status, a.verifiedAt, a.completedAt], ['verified', created.slice(0, 10), created]);
  }));

test('an old screening cannot stand behind a new sanctions result; a pending one pointing at it is screened again', () =>
  start(async (base, server, clock) => {
    const old = await screenWith(base);
    clock.t += 200 * DAY;
    const r = await create(base);
    const aml = { status: 'clear', screenedAt: '2026-01-05', results: [{ how: 'server', status: 'clear', ref: old, screenedAt: '2026-01-05' }, { how: 'ofac', status: 'pending', ref: old }] };
    assert.equal((await complete(base, r.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote', verify: { aml } } })).status, 200);
    const sub = await submissionOf(base, r.id);
    for (const x of sub.investor.verify.aml.results) {
      assert.deepEqual([x.status, x.ref], ['pending', '']);
      assert.match(x.error, /Not confirmed by the integration server/, 'the console screens the investor again');
    }
    assert.equal(sub.investor.verify.aml.status, 'pending');
    assert.equal(sub.investor.verify.aml.screenedAt, undefined);
    assert.equal(sub.checks.aml.unconfirmed, true);
    assert.match((await note(base, r.id)).text, /^Sanctions screening: Not confirmed/m);
  }));

/* ---------- Only the files the submission produced ---------- */

test('files: only the envelope’s own copies and the investor’s own evidence are kept; anything else is dropped, never refused', () =>
  start(async (base, server) => {
    const r = await create(base); // the agreement has a countersigner
    const investor = { id: 'HRC-0007', contact: 'Zelda Quixote', verify: { identity: { status: 'review', how: 'manual', fileId: 'kyc-HRC-0007-mf3k2a' }, accreditation: { status: 'review', how: 'manual', fileId: 'kyc-HRC-0008-zz1' } } };
    const envelope = { id: 'env-7', status: 'sent', docId: 'tpl-doc-1', workDocId: 'env-7-work', signedDocId: 'env-7-signed', signers: [{ role: 'investor', status: 'signed' }, { role: 'countersigner', status: 'waiting' }] };
    const files = {
      'tpl-doc-1': pdf('TEMPLATE'), // earlier pages also sent the firm's agreement template
      'env-7-work': pdf('WORK'),
      'env-7-signed': pdf('SIGNED'), // not complete yet: no signed copy
      'kyc-HRC-0007-mf3k2a': PNG, // the investor's own ID photo, named by their record
      'kyc-HRC-0008-zz1': pdf('OTHER'), // named by the record, but not this investor's upload
      'env-other-signed': pdf('ELSEWHERE'), // named by nothing in this submission
      'notice-1': 'not base64 !!' // dropped unread, so it cannot fail the submission
    };
    const docs = [{ id: 'notice-1', title: 'Updated wire instructions', audience: 'all' }, { id: 'env-7-signed', title: 'Signed' }];
    const res = await complete(base, r.token, { investor, envelope, files, docs });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const sub = await submissionOf(base, r.id);
    assert.deepEqual(Object.keys(sub.files).sort(), ['env-7-work', 'kyc-HRC-0007-mf3k2a']);
    assert.ok(Buffer.from(sub.files['env-7-work'], 'base64').toString('latin1').includes('WORK'));
    assert.deepEqual(sub.docs, [], 'no listing: the agreement is not complete, and nothing else may be listed');
    assert.ok(server.store.data().events.some((e) => e.type === 'invite_completed' && e.id === r.id && e.files === 2 && e.filesDropped === 5));

    // The envelope's copies are PDFs.
    const r2 = await create(base);
    const bad = await complete(base, r2.token, { investor: { id: 'HRC-0007' }, envelope: { id: 'env-8', status: 'sent', workDocId: 'env-8-work' }, files: { 'env-8-work': PNG } });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /files\.env-8-work is not a PDF$/);
  }));

test('a completed agreement for the investor alone: its signed copy is kept and listed for that investor only', () =>
  start(async (base) => {
    const r = await create(base, { esign: { template: { title: 'Agreement', roles: ['Investor'], fields: [] } } });
    const envelope = { id: 'env-9', status: 'completed', docId: 'tpl-doc-1', workDocId: 'env-9-work', signedDocId: 'env-9-signed', signers: [{ role: 'investor', status: 'signed' }] };
    const docs = [
      { id: 'env-9-signed', title: 'Subscription agreement (signed)', fileName: 'Agreement_signed.pdf', date: '2026-01-05', audience: 'all', investors: ['HRC-0001', 'HRC-0002'], offeringDoc: true, hidden: false, cat: 'Wire instructions' },
      { id: 'notice-1', title: 'Updated wire instructions', audience: 'all' }
    ];
    const res = await complete(base, r.token, { investor: { id: 'HRC-0007' }, envelope, docs, files: { 'env-9-signed': pdf('SIGNED'), 'env-9-work': pdf('WORK'), 'tpl-doc-1': pdf('TEMPLATE') } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const sub = await submissionOf(base, r.id);
    assert.equal(sub.envelope.status, 'completed');
    assert.deepEqual(Object.keys(sub.files).sort(), ['env-9-signed', 'env-9-work']);
    assert.deepEqual(sub.docs, [{ id: 'env-9-signed', title: 'Subscription agreement (signed)', fileName: 'Agreement_signed.pdf', type: 'application/pdf', cat: 'Legal', date: '2026-01-05', audience: 'investors', investors: ['HRC-0007'], offeringId: 'hr-fund-ii', envelopeId: 'env-9' }]);

    // Back to waiting for the firm (the agreement has a countersigner): no signed copy, no listing.
    const r2 = await create(base);
    assert.equal((await complete(base, r2.token, { investor: { id: 'HRC-0007' }, envelope: Object.assign({}, envelope, { signers: [{ role: 'investor', status: 'signed' }, { role: 'countersigner', status: 'waiting' }] }), docs, files: { 'env-9-signed': pdf('SIGNED'), 'env-9-work': pdf('WORK') } })).status, 200);
    const sub2 = await submissionOf(base, r2.id);
    assert.deepEqual([sub2.envelope.status, sub2.envelope.signedDocId], ['sent', null]);
    assert.deepEqual(Object.keys(sub2.files), ['env-9-work']);
    assert.deepEqual(sub2.docs, []);
  }));

test('an investor already on file brings back accreditation evidence only', () =>
  start(async (base) => {
    const r = await create(base, EXISTING);
    const investor = { id: 'HRC-0007', verify: { identity: { status: 'review', how: 'manual', fileId: 'kyc-HRC-0007-id1' }, accreditation: { status: 'review', how: 'manual', fileId: 'kyc-HRC-0007-acc1' } } };
    assert.equal((await complete(base, r.token, { investor, files: { 'kyc-HRC-0007-id1': PNG, 'kyc-HRC-0007-acc1': pdf('LETTER') } })).status, 200);
    assert.deepEqual(Object.keys((await submissionOf(base, r.id)).files), ['kyc-HRC-0007-acc1']);
  }));

/* ---------- The sponsor's emails for an investor already on file ---------- */

test('the sponsor’s notification for an investor already on file: the subscription is added, their record stays as it is', () =>
  start(async (base) => {
    const r = await create(base, EXISTING);
    assert.equal((await complete(base, r.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote' }, request: { id: 'req-9', offeringId: 'hr-fund-ii', cents: 5000000 } })).status, 200);
    const n = await note(base, r.id);
    assert.match(n.text, /Their subscription, signed agreement and any new accreditation result are added to your investor records the next time the console is open\. The details you already hold for them stay as they are\./);
    assert.ok(!/Their details, verification results/.test(n.text + n.html), 'the console keeps the record on file');
    assert.ok(!/carrow|\bvale\b|powered by/i.test(n.subject + n.text + n.html));
    // A new investor's notification is unchanged.
    const fresh = await create(base, { investor: { id: 'HRC-0009', contact: 'Ada Quill', email: 'ada@investor.example' } });
    assert.equal((await complete(base, fresh.token, { investor: { id: 'HRC-0009', contact: 'Ada Quill' } })).status, 200);
    assert.match((await note(base, fresh.id)).text, /Their details, verification results, documents and signed agreement are added to your investor records the next time the console is open\./);
  }));

test('the reminder for an unimported subscription by an investor already on file says subscription, not onboarding', () =>
  start(async (base, server, clock) => {
    const r = await create(base, EXISTING);
    assert.equal((await complete(base, r.token, { investor: { id: 'HRC-0007', contact: 'Zelda Quixote' } })).status, 200);
    clock.t += 23 * DAY + 60e3;
    assert.equal(server.invitations.purge(clock.t).reminders, 1);
    const m = (await outbox(base, r.id)).find((x) => x.kind === 'submission_reminder');
    assert.ok(m, 'the reminder is in the outbox');
    assert.equal(m.subject, 'Waiting in your console: Zelda Quixote’s subscription');
    assert.match(m.text, /Zelda Quixote finished their subscription to Harbor Ridge Fund II on January 5, 2026, but the console has not added it to your records yet\./);
    assert.match(m.text, /it adds the subscription, the signed agreement and any new accreditation result as soon as it opens/);
    assert.match(m.text, /the investor would have to submit their subscription again\./);
    assert.ok(!/onboarding/i.test(m.subject + m.text + m.html), m.text);
    assert.ok(!/carrow|\bvale\b|powered by/i.test(m.subject + m.text + m.html));
  }));

/* ---------- This server's own pages with PORTAL_ORIGIN set ---------- */

test('with PORTAL_ORIGIN set, this server’s own pages accept their own form posts; the API still answers the portal only', () =>
  start(
    async (base, server) => {
      const id = await startCheck(base, 'accreditation');
      const ref = server.store.get('verifications', id).ref;
      const form = (origin, body) => fetch(`${base}/sandbox/${ref}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin }, body });
      assert.equal((await fetch(`${base}/sandbox/${ref}`, { headers: { Origin: PUBLIC } })).status, 200);
      // A browser sends this server's own origin with the page's form, or "null" (the page is served with no-referrer).
      assert.equal((await form(PUBLIC, 'outcome=review')).status, 200);
      assert.equal(server.store.get('verifications', id).status, 'review');
      assert.equal((await form('null', 'outcome=verified&method=Income')).status, 200);
      assert.equal(server.store.get('verifications', id).status, 'verified');
      // A page this server hosts for a provider flow.
      const hosted = await startCheck(base, 'accreditation', null, 'hostedtest');
      assert.equal(server.store.get('verifications', hosted).url, `${PUBLIC}/hosted/${hosted}`);
      const posted = await fetch(`${base}/hosted/${hosted}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: PUBLIC }, body: 'answer=yes' });
      assert.equal(posted.status, 200);
      assert.match(await posted.text(), /Thank you/);
      assert.equal(server.store.get('verifications', hosted).status, 'verified');
      // The API is not opened: another origin, "null" and this server's own origin are all refused there.
      for (const origin of ['https://evil.example', 'null', PUBLIC]) {
        assert.equal((await fetch(`${base}/v1/connectors`, { headers: { Origin: origin, Authorization: `Bearer ${API}` } })).status, 403, origin);
        assert.equal((await fetch(`${base}/v1/invite`, { headers: { Origin: origin, 'X-Invite-Token': 'x' } })).status, 403, origin);
      }
      const ok = await fetch(`${base}/v1/connectors`, { headers: { Origin: 'https://portal.example', Authorization: `Bearer ${API}` } });
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get('access-control-allow-origin'), 'https://portal.example');
    },
    { env: { PORTAL_ORIGIN: 'https://portal.example' } }
  ));
