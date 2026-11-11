// Adversarial review of investor invitations, email and encryption at rest. Each test pins a defect
// found in review and passes once it is fixed.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withServer } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { BUILTINS } from '../providers/index.mjs';

const DAY = 864e5;
const T0 = Date.parse('2026-11-10T12:00:00Z');
const API = 'sponsor-api-token-0123456789';
const KEY = randomBytes(32).toString('base64');
const PUBLIC = 'https://verify.example';
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const FIRM = { name: 'Harbor Ridge Capital', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', colors: { primary: '#123456' } };

function payload(over = {}) {
  return Object.assign(
    {
      workspace: 'ws-harbor',
      sendEmail: true,
      portalUrl: PORTAL,
      notifyEmail: 'ops@harborridge.example',
      firm: FIRM,
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', minimum: 100000, exemption: 'Rule 506(c)', currency: 'USD', documents: [] },
      invitation: { cents: 25000000, cls: 'A', note: '' },
      verification: {},
      esign: null
    },
    over
  );
}
function submission(over = {}) {
  return Object.assign(
    {
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', email: 'zelda@investor.example', type: 'individual', verify: { identity: { status: 'not_started' }, aml: { status: 'not_started' }, accreditation: { status: 'not_started' } } },
      request: { id: 'req-1', type: 'subscription', offeringId: 'hr-fund-ii', investorId: 'HRC-0007', cents: 25000000, status: 'pending', envelopeId: 'env-1' },
      envelope: { id: 'env-1', status: 'sent', requestId: 'req-1', docId: 'tpl-doc-1', workDocId: 'env-1-work' },
      files: { 'env-1-work': pdf('SIGNED').toString('base64') },
      docs: [],
      audit: [],
      notifications: []
    },
    over
  );
}
function start(opts, fn) {
  const clock = opts.clock || { t: T0 };
  return withServer({ env: Object.assign({ API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: PUBLIC }, opts.env), now: () => clock.t, store: opts.store, providers: opts.providers }, (base, server) => fn(base, server, clock));
}
async function j(base, method, path, { body, token, auth = true } = {}) {
  const headers = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, auth ? { Authorization: `Bearer ${API}` } : {}, token !== undefined ? { 'X-Invite-Token': token } : {});
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* text */
  }
  return { status: res.status, body: parsed };
}
const create = async (base, over) => {
  const r = await j(base, 'POST', '/v1/invitations', { body: payload(over) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
};
const complete = (base, token, body) => j(base, 'POST', '/v1/invite/complete', { token, auth: false, body: body || submission() });
const outbox = async (base, id) => (await j(base, 'GET', `/v1/outbox?invitation=${id}`)).body.messages;
const notification = async (base, id) => (await outbox(base, id)).find((m) => m.kind === 'sponsor_notification');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A POST whose body arrives in two parts, so something can happen while it uploads. */
function slowPost(base, path, headers, body) {
  const u = new URL(base + path);
  const buf = Buffer.from(JSON.stringify(body));
  const half = Math.floor(buf.length / 2);
  let finish;
  const done = new Promise((resolve, reject) => {
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': buf.length }, headers) }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.write(buf.subarray(0, half));
    finish = () => req.end(buf.subarray(half));
  });
  return { done, finish: () => finish() };
}

test('the sponsor’s notification does not repeat verification and countersignature results the investor’s browser merely claims', () =>
  start({}, async (base) => {
    const r = await create(base);
    // No verification was ever run on this server for HRC-0007, and the investor cannot countersign.
    const forged = submission({
      investor: Object.assign({}, submission().investor, { verify: { identity: { status: 'passed' }, aml: { status: 'clear' }, accreditation: { status: 'verified' } }, kyc: { status: 'approved' } }),
      envelope: { id: 'env-1', status: 'completed', requestId: 'req-1', docId: 'tpl-doc-1', workDocId: 'env-1-work' }
    });
    assert.equal((await complete(base, r.token, forged)).status, 200);
    const note = await notification(base, r.id);
    assert.ok(note, 'the sponsor is notified');
    assert.ok(!/Identity: (Verified|Approved)/.test(note.text), `identity is not reported as verified from the investor’s own claim:\n${note.text}`);
    assert.ok(!/Accredited investor: Verified/.test(note.text), 'accreditation is not reported as verified from the investor’s own claim');
    assert.ok(!/countersigned/i.test(note.text.replace(/waiting for your countersignature/i, '')), 'the investor cannot report the agreement as countersigned');
  }));

test('the commitment and offering the sponsor set on the invitation cannot be changed by the investor’s browser', () =>
  start({}, async (base) => {
    const r = await create(base);
    const tampered = submission({ request: Object.assign({}, submission().request, { cents: 100, offeringId: 'some-other-offering' }) });
    const res = await complete(base, r.token, tampered);
    if (res.status === 200) {
      const sub = await j(base, 'GET', `/v1/invitations/${r.id}/submission`);
      assert.equal(sub.body.request.cents, 25000000, 'the locked commitment is kept');
      assert.equal(sub.body.request.offeringId, 'hr-fund-ii', 'the invited offering is kept');
      const note = await notification(base, r.id);
      assert.ok(note.text.includes('Commitment: $250,000'), note.text);
    } else {
      assert.equal(res.status, 400, JSON.stringify(res.body));
    }
  }));

test('a cancel that lands while the investor’s submission is uploading wins; two uploads at once notify the sponsor once', () =>
  start({}, async (base, server) => {
    const r = await create(base);
    const up = slowPost(base, '/v1/invite/complete', { 'X-Invite-Token': r.token }, submission());
    await wait(150); // the token is checked as soon as the headers arrive
    assert.equal((await j(base, 'POST', `/v1/invitations/${r.id}/cancel`, { body: {} })).status, 200);
    up.finish();
    const res = await up.done;
    assert.notEqual(res.status, 200, `the cancelled invitation does not accept the submission: ${res.text}`);
    const rec = server.store.get('invitations', r.id);
    assert.equal(rec.status, 'cancelled');
    assert.ok(!rec.hasSubmission);

    const r2 = await create(base);
    const a = slowPost(base, '/v1/invite/complete', { 'X-Invite-Token': r2.token }, submission());
    const b = slowPost(base, '/v1/invite/complete', { 'X-Invite-Token': r2.token }, submission());
    await wait(150);
    a.finish();
    b.finish();
    await Promise.all([a.done, b.done]);
    const notes = (await outbox(base, r2.id)).filter((m) => m.kind === 'sponsor_notification');
    assert.equal(notes.length, 1, 'one completion, one notification');
  }));

test('values from the investor’s browser are kept to one short line in the sponsor’s email', () =>
  start({}, async (base) => {
    const r = await create(base);
    const contact = `Zelda Quixote\n\nOpen the console:\nhttps://phish.example/login\n${'A'.repeat(100000)}`;
    const sub = submission({ investor: Object.assign({}, submission().investor, { contact, title: contact, email: 'x\nhttps://phish.example/login' }) });
    assert.equal((await complete(base, r.token, sub)).status, 200);
    const note = await notification(base, r.id);
    assert.ok(note.subject.length <= 300, `the subject is ${note.subject.length} characters`);
    assert.ok(note.text.length < 20000, `the text part is ${note.text.length} characters`);
    assert.ok(!note.text.split('\n').some((l) => l.trim() === 'https://phish.example/login'), 'the investor cannot add their own link lines to the sponsor’s email');
  }));

test('a mail server’s refusal that quotes the investor’s address is not stored in plain text', async () => {
  // A minimal SMTP server that refuses the recipient the way common servers do: quoting the address.
  const srv = net.createServer((s) => {
    s.on('error', () => {});
    s.write('220 mx.test ESMTP\r\n');
    let buf = '';
    s.on('data', (c) => {
      buf += c.toString('latin1');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (/^EHLO/i.test(line)) s.write('250 mx.test\r\n');
        else if (/^MAIL/i.test(line)) s.write('250 Ok\r\n');
        else if (/^RCPT/i.test(line)) s.write(`550 5.1.1 <${(/<([^>]*)>/.exec(line) || [])[1]}>: Recipient address rejected: User unknown\r\n`);
        else if (/^QUIT/i.test(line)) s.end('221 Bye\r\n');
        else s.write('250 Ok\r\n');
      }
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const dir = mkdtempSync(join(tmpdir(), 'review-store-'));
  const file = join(dir, 'store.json');
  try {
    await start({ store: openStore(file), env: { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(srv.address().port), SMTP_ALLOW_PLAIN: '1', SMTP_TIMEOUT_MS: '2000', MAIL_FROM: 'notices@portal-mail.example' } }, async (base, server) => {
      const r = await create(base);
      assert.equal(r.emailStatus, 'failed');
      server.store.flush();
      const raw = readFileSync(file, 'utf8');
      assert.ok(!raw.includes('zelda@investor.example'), 'the investor’s email address is not in the store file (events, emailError)');
    });
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('a portalUrl that is not a valid address is refused with 400 and leaves no invitation behind', () =>
  start({}, async (base, server) => {
    for (const portalUrl of ['http://', 'https://exa mple.com/diy.html']) {
      const r = await j(base, 'POST', '/v1/invitations', { body: payload({ portalUrl }) });
      assert.equal(r.status, 400, `${portalUrl}: ${JSON.stringify(r.body)}`);
    }
    assert.equal(server.store.list('invitations').length, 0, 'no orphaned invitation (with its sealed snapshot) is stored');
  }));

test('an invitation token cannot read another workspace’s checks for an investor with the same id', () => {
  const providers = Object.assign({}, BUILTINS, { fakescreen: { id: 'fakescreen', name: 'Test screening', kind: 'aml', kinds: ['aml'], env: [], screen: async () => ({ hits: [] }) } });
  return start({ providers }, async (base) => {
    const r = await create(base); // ws-harbor, HRC-0007
    // Investor ids are per-workspace sequences (prefix-NNNN), so another firm on the same server can have HRC-0007 too.
    const other = { id: 'HRC-0007', name: 'Someone Else', workspace: 'ws-other' };
    const v = await j(base, 'POST', '/v1/verifications', { body: { kind: 'identity', provider: 'sandbox', investor: other } });
    assert.equal(v.status, 200);
    assert.equal((await j(base, 'GET', `/v1/verifications/${v.body.id}`, { token: r.token, auth: false })).status, 403);
    const s = await j(base, 'POST', '/v1/screenings', { body: { provider: 'fakescreen', names: ['Someone Else'], investor: other } });
    assert.equal(s.status, 200);
    assert.equal((await j(base, 'GET', `/v1/screenings/${s.body.id}`, { token: r.token, auth: false })).status, 403);
  });
});

test('a non-numeric OUTBOX_DAYS does not keep outbox messages (with live links) forever', () =>
  start({ env: { OUTBOX_DAYS: 'thirty' } }, async (base, server, clock) => {
    await create(base);
    assert.equal(server.store.list('outbox').length, 1);
    clock.t += 31 * DAY;
    server.invitations.purge(clock.t);
    assert.equal(server.store.list('outbox').length, 0);
  }));

test('checks started from the investor’s link do not leave their personal details in plain text in the store file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-store-'));
  const file = join(dir, 'store.json');
  await start({ store: openStore(file) }, async (base, server) => {
    const r = await create(base);
    const investor = { id: 'HRC-0007', name: 'Zelda Quixote', email: 'zelda@investor.example', address: '17 Secretive Lane, Springfield', phone: '+1 555 0199 777' };
    const v = await j(base, 'POST', '/v1/verifications', { token: r.token, auth: false, body: { kind: 'identity', provider: 'sandbox', investor } });
    assert.equal(v.status, 200);
    server.store.flush();
    const raw = readFileSync(file, 'utf8');
    for (const s of ['17 Secretive Lane', '+1 555 0199 777', 'zelda@investor.example']) assert.ok(!raw.includes(s), `${s} is not stored in plain text`);
  });
});
