// gate: tests 6
// The sponsor's sender on the server (plan 13-03, EM-04, EM-06, C-11, C-12): a workspace's messages go from its own
// ready address and are held, never sent from another domain, until it is ready; bounced addresses get nothing more;
// no message carries an attachment; a note with a taxpayer number, a long number or a password is refused; and the
// sender routes the console's setup screen calls. Everything runs against the local stand-ins (smtp-fake.mjs,
// ses-fake.mjs); nothing here reaches the outside world. Every address, key, password and token is made by the test, and
// the numbers in the notes come from ranges never issued.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';
import { httpsTransport } from '../mailers/ses.mjs';
import { REFUSALS } from '../lib/roles.mjs';
import { fakeSmtp } from './smtp-fake.mjs';
import { fakeSes, fakeResolver, rsaCert, snsSign } from './ses-fake.mjs';

const { screen } = createRequire(import.meta.url)('../../assets/js/emails.js');
const ADMIN = 'operator-admin-token-mail-sender-0123';
const API = 'shared-api-token-mail-sender-0123456';
const TOPIC = 'arn:aws:sns:us-east-1:000000000000:mail-events';
const CERT_URL = 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-0000000000000000000000000000000.pem';
const SIGNER = rsaCert();
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';
const PLATFORM_FROM = 'notices@platform-mail.example';
const VENDOR = /amazon|aws|\bses\b/i;
const ORIGIN = 'http://127.0.0.1';
const NOT_READY = 'Email sending from your domain is not set up yet.';

/** A server wired to the stand-ins. smtp: false leaves SMTP unset; env is laid over the defaults (undefined removes one). */
async function harness({ env = {}, smtp = true, now } = {}) {
  const relay = smtp ? await fakeSmtp({}) : null;
  const ses = await fakeSes();
  const store = openStore(null);
  const base = {
    NODE_ENV: 'test',
    PUBLIC_URL: 'https://verify.example',
    ADMIN_TOKEN: ADMIN,
    DATA_KEY: randomBytes(32).toString('base64'),
    MAIL_FROM: PLATFORM_FROM,
    MAIL_PROVIDER: 'ses',
    SES_REGION: 'us-east-1',
    SES_ACCESS_KEY_ID: 'AKIDSTANDIN0000004',
    SES_SECRET_ACCESS_KEY: 'standin-secret-for-mail-sender-000000',
    SES_API_HOST: ses.host,
    MAIL_EVENTS_TOPIC_ARN: TOPIC
  };
  if (relay) Object.assign(base, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(relay.port), SMTP_ALLOW_PLAIN: '1' });
  const full = Object.assign(base, env);
  for (const k of Object.keys(full)) if (full[k] === undefined) delete full[k];
  const server = createServer({ env: full, store, now, mailCtx: { transport: httpsTransport({ ca: ses.ca }), resolver: fakeResolver({}), fetchCert: async () => SIGNER.cert } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    server,
    store,
    relay,
    ses,
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      if (relay) await relay.close();
      await ses.close();
    }
  };
}

async function call(base, method, path, { bearer, body, raw, cookie, origin } = {}) {
  const headers = {};
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = raw !== undefined ? 'text/plain; charset=UTF-8' : 'application/json';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  const res = await fetch(base + path, { method, headers, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  const set = res.headers.getSetCookie();
  return { status: res.status, body: json, text, cookie: set.length ? set[0].split(';')[0] : '' };
}

const account = async (h, workspace, name = 'Harbor Ridge Capital') => {
  const r = await call(h.base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace, name } });
  assert.equal(r.status, 200, r.text);
  return r.body;
};
/** The account's sender set and checked ready at the provider stand-in. */
async function ready(h, token, address) {
  const set = await call(h.base, 'PUT', '/v1/mail/sender', { bearer: token, body: { address } });
  assert.equal(set.status, 200, set.text);
  h.ses.status.set(address.split('@')[1], 'SUCCESS');
  const chk = await call(h.base, 'POST', '/v1/mail/sender/check', { bearer: token, body: {} });
  assert.equal(chk.body.status, 'ready', chk.text);
}
const invitation = (over = {}, inv = {}) =>
  Object.assign(
    {
      sendEmail: true,
      portalUrl: PORTAL,
      firm: { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', supportEmail: 'ir@harborridge.example' },
      investor: Object.assign({ id: 'HRC-0007', contact: 'Ann Lee', title: 'Ann Lee', type: 'individual', email: 'ann@investor.example' }, inv),
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', shortName: 'Fund II', minimum: 100000, currency: 'USD', documents: [] },
      invitation: { cents: 25000000, cls: 'A' }
    },
    over
  );
const fromHeader = (data) => (/^From: (.*)$/m.exec(data) || [])[1] || '';
const messageIdOf = (data) => (/^Message-ID: (<[^>]+>)$/m.exec(data) || [])[1] || '';
function bounce(messageId, permanent = true) {
  const Message = JSON.stringify({ eventType: 'Bounce', bounce: { bounceType: permanent ? 'Permanent' : 'Transient', bouncedRecipients: [{ emailAddress: 'x@x.example' }], timestamp: new Date().toISOString() }, mail: { messageId: 'relay-not-known', commonHeaders: { messageId } } });
  return JSON.stringify(snsSign({ Type: 'Notification', MessageId: `n-${randomBytes(6).toString('hex')}`, TopicArn: TOPIC, Message, Timestamp: new Date().toISOString(), SigningCertURL: CERT_URL }, SIGNER.privateKey, '2'));
}

test('held', async () => {
  let t = Date.now();
  const h = await harness({ now: () => t });
  try {
    const a = await account(h, 'ws-harbor');
    // No sender yet: the invitation is made, its email held with the reason, nothing reaches the relay.
    const first = await call(h.base, 'POST', '/v1/invitations', { bearer: a.token, body: invitation() });
    assert.equal(first.status, 200, first.text);
    assert.equal(first.body.emailStatus, 'held');
    assert.equal(first.body.emailError, NOT_READY);
    assert.equal(h.relay.sessions.length, 0, 'nothing was sent, from MAIL_FROM or anywhere');
    const row = (await call(h.base, 'GET', '/v1/invitations', { bearer: a.token })).body.find((x) => x.id === first.body.id);
    assert.equal(row.emailStatus, 'held');
    assert.equal(row.emailError, NOT_READY);
    const box = await call(h.base, 'GET', '/v1/outbox', { bearer: a.token });
    assert.deepEqual(box.body.messages.map((m) => [m.invitationId, m.held]), [[first.body.id, true]]);

    // The sender is set and waits for DNS: still held, nothing released.
    const set = await call(h.base, 'PUT', '/v1/mail/sender', { bearer: a.token, body: { address: 'notices@harborridge.example' } });
    assert.equal(set.body.status, 'pending', set.text);
    const waiting = await call(h.base, 'POST', '/v1/mail/sender/check', { bearer: a.token });
    assert.equal(waiting.status, 200, waiting.text);
    assert.deepEqual([waiting.body.status, waiting.body.released], ['pending', 0]);
    assert.equal(h.relay.sessions.length, 0);

    // A held message older than OUTBOX_DAYS (30) is never released; one within it is.
    t += 31 * 864e5;
    const second = await call(h.base, 'POST', '/v1/invitations', { bearer: a.token, body: invitation({}, { id: 'HRC-0008', contact: 'Maria Ortiz', title: 'Maria Ortiz', email: 'maria@investor.example' }) });
    assert.equal(second.body.emailStatus, 'held', second.text);
    h.ses.status.set('harborridge.example', 'SUCCESS');
    const done = await call(h.base, 'POST', '/v1/mail/sender/check', { bearer: a.token, body: {} });
    assert.equal(done.status, 200, done.text);
    assert.deepEqual([done.body.status, done.body.released], ['ready', 1]);
    assert.equal(h.relay.messages.length, 1);
    assert.equal(h.relay.messages[0].from, 'notices@harborridge.example');
    assert.deepEqual(h.relay.messages[0].to, ['maria@investor.example']);
    assert.equal(fromHeader(h.relay.messages[0].data), '"Harbor Ridge Capital" <notices@harborridge.example>');
    assert.ok(!h.relay.messages[0].data.includes(PLATFORM_FROM));
    const list = (await call(h.base, 'GET', '/v1/invitations', { bearer: a.token })).body;
    assert.equal(list.find((x) => x.id === second.body.id).emailStatus, 'sent');
    const log = (await call(h.base, 'GET', '/v1/messages/log', { bearer: a.token })).body.entries;
    assert.deepEqual(log.map((e) => [e.refId, e.status]).sort(), [[first.body.id, 'held'], [second.body.id, 'sent']].sort());
    assert.equal((await call(h.base, 'GET', '/v1/outbox', { bearer: a.token })).body.messages.length, 0, 'the released message left the outbox; the old one was purged');
  } finally {
    await h.close();
  }
});

test('single sponsor', async () => {
  // No accounts, the shared token, MAIL_FROM and no sender: sent from MAIL_FROM as before (the adapter is the default).
  const h = await harness({ env: { API_TOKEN: API, ADMIN_TOKEN: undefined, MAIL_PROVIDER: undefined } });
  try {
    const r = await call(h.base, 'POST', '/v1/invitations', { bearer: API, body: invitation({ workspace: 'harbor' }) });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.emailStatus, 'sent', r.text);
    assert.equal(h.relay.messages[0].from, PLATFORM_FROM);
    assert.equal(fromHeader(h.relay.messages[0].data), `"Harbor Ridge Capital" <${PLATFORM_FROM}>`);
  } finally {
    await h.close();
  }
  // The staff filing order email (lib/filings.mjs sends it with workspace '') uses MAIL_FROM on a server with accounts.
  const s = await harness();
  try {
    await account(s, 'ws-harbor');
    const r = await s.server.invitations.mailer.send({ kind: 'filing_order', workspace: '', fromName: 'Filings', to: 'filings@agent.example', subject: 'Filing order fil_1', text: 'A new order.', html: '<p>A new order.</p>' });
    assert.equal(r.emailStatus, 'sent', JSON.stringify(r));
    assert.equal(s.relay.messages[0].from, PLATFORM_FROM);
    assert.equal(fromHeader(s.relay.messages[0].data), `"Filings" <${PLATFORM_FROM}>`);
  } finally {
    await s.close();
  }
});

test('suppressed', async () => {
  const h = await harness();
  try {
    const a = await account(h, 'ws-harbor');
    await ready(h, a.token, 'notices@harborridge.example');
    const first = await call(h.base, 'POST', '/v1/invitations', { bearer: a.token, body: invitation() });
    assert.equal(first.body.emailStatus, 'sent', first.text);
    const ev = await call(h.base, 'POST', '/v1/mail/events', { raw: bounce(messageIdOf(h.relay.messages[0].data)) });
    assert.equal(ev.status, 200, ev.text);
    // ann@investor.example bounced for good: the next invitation to her is suppressed and nothing reaches the relay.
    const again = await call(h.base, 'POST', '/v1/invitations', { bearer: a.token, body: invitation({}, { id: 'HRC-0017', email: 'Ann@Investor.example' }) });
    assert.equal(again.status, 200, again.text);
    assert.equal(again.body.emailStatus, 'suppressed');
    assert.equal(h.relay.messages.length, 1);
    // Another address is sent.
    const other = await call(h.base, 'POST', '/v1/invitations', { bearer: a.token, body: invitation({}, { id: 'HRC-0008', email: 'maria@investor.example' }) });
    assert.equal(other.body.emailStatus, 'sent', other.text);
    assert.equal(h.relay.messages.length, 2);
    assert.deepEqual(h.relay.messages[1].to, ['maria@investor.example']);
    const statuses = (await call(h.base, 'GET', '/v1/messages/log', { bearer: a.token })).body.entries.map((e) => e.status).sort();
    assert.deepEqual(statuses, ['bounced', 'sent', 'suppressed']);
  } finally {
    await h.close();
  }
});

test('attachments', async () => {
  const h = await harness();
  try {
    const a = await account(h, 'ws-harbor');
    await ready(h, a.token, 'notices@harborridge.example');
    const r = await h.server.invitations.mailer.send({ kind: 'notice', workspace: 'ws-harbor', investorId: 'HRC-0007', fromName: 'Harbor Ridge Capital', to: 'ann@investor.example', subject: 'Your signed agreement', text: 'Attached.', html: '<p>Attached.</p>', attachments: [{ filename: 'agreement.pdf', content: Buffer.from('%PDF-1.4') }] });
    assert.deepEqual(r.emailStatus, 'failed');
    assert.equal(r.error, 'Emails never carry attachments.');
    assert.equal(h.relay.sessions.length, 0, 'nothing reached the relay');
    const log = h.server.invitations.mailLog.list('ws-harbor');
    assert.ok(!log.some((e) => e.status === 'sent'), 'no sent entry');
    assert.deepEqual(log.map((e) => e.status), ['failed']);
  } finally {
    await h.close();
  }
});

test('note screen', async () => {
  const h = await harness();
  try {
    const a = await account(h, 'ws-harbor');
    await ready(h, a.token, 'notices@harborridge.example');
    for (const bad of ['000-12-3456', '991234567890', 'password: x']) {
      const note = `Looking forward to it. ${bad}`;
      const want = screen(note);
      assert.ok(want && want.reason, `the shared patterns refuse ${bad}`);
      const r = await call(h.base, 'POST', '/v1/invitations', { bearer: a.token, body: invitation({ invitation: { cents: 25000000, cls: 'A', note } }) });
      assert.equal(r.status, 422, r.text);
      assert.deepEqual(r.body, { error: want.reason });
    }
    assert.equal(h.store.list('invitations').length, 0, 'nothing stored');
    assert.equal(h.store.list('outbox').length, 0);
    assert.equal(h.store.list('maillog').length, 0, 'no log entry');
    assert.equal(h.relay.sessions.length, 0, 'nothing sent');
    // A clean note still goes.
    const ok = await call(h.base, 'POST', '/v1/invitations', { bearer: a.token, body: invitation({ invitation: { cents: 25000000, cls: 'A', note: 'Looking forward to it.' } }) });
    assert.equal(ok.body.emailStatus, 'sent', ok.text);
  } finally {
    await h.close();
  }
});

test('sender routes', async () => {
  const h = await harness({ smtp: false, env: { PUBLIC_URL: ORIGIN } });
  try {
    const a = await account(h, 'ws-harbor');
    const b = await account(h, 'ws-beta', 'Beta Funds');
    const none = await call(h.base, 'GET', '/v1/mail/sender', { bearer: a.token });
    assert.equal(none.status, 200, none.text);
    assert.equal(none.body.status, 'not_set_up');
    assert.equal(none.body.live, false);
    assert.equal((await call(h.base, 'PUT', '/v1/mail/sender', { bearer: a.token, body: { address: 'not an address' } })).status, 400);
    const set = await call(h.base, 'PUT', '/v1/mail/sender', { bearer: a.token, body: { address: 'notices@harborridge.example' } });
    assert.equal(set.status, 200, set.text);
    assert.equal(set.body.status, 'pending');
    const dkim = set.body.records.filter((r) => r.purpose === 'dkim');
    assert.equal(dkim.length, 1);
    assert.equal(dkim[0].type, 'TXT');
    // The key's random base64 is set aside before the vendor-word scan (it may hold any three letters by chance).
    for (const r of set.body.records) assert.ok(!VENDOR.test(`${r.name} ${r.value.replace(/p=[A-Za-z0-9+/=]+$/, 'p=KEY')}`), JSON.stringify(r.name));
    // beta's token naming harbor's workspace changes only beta's own sender.
    const other = await call(h.base, 'PUT', '/v1/mail/sender', { bearer: b.token, body: { workspace: 'ws-harbor', address: 'mail@betafunds.example' } });
    assert.equal(other.status, 200, other.text);
    assert.equal((await call(h.base, 'GET', '/v1/mail/sender?workspace=ws-harbor', { bearer: a.token })).body.address, 'notices@harborridge.example');
    assert.equal((await call(h.base, 'GET', '/v1/mail/sender?workspace=ws-harbor', { bearer: b.token })).body.address, 'mail@betafunds.example');
    assert.equal(h.store.get('senders', 'ws-harbor').address, 'notices@harborridge.example');

    // A signed-in person whose role lacks configure is refused the change.
    const pw = randomBytes(12).toString('base64url');
    const up = await call(h.base, 'POST', '/v1/auth/signup', { origin: ORIGIN, body: { firm: 'Cedar Point Partners', name: 'Pat Owner', email: 'pat@cedarpoint.example', password: pw } });
    assert.equal(up.status, 201, up.text);
    const ws = up.body.workspace.id;
    const teamPw = randomBytes(12).toString('base64url');
    await h.server.signin.people.create({ workspace: ws, kind: 'team', role: 'team', email: 'sam@cedarpoint.example', name: 'Sam Team', password: teamPw });
    const si = await call(h.base, 'POST', '/v1/auth/signin', { origin: ORIGIN, body: { email: 'sam@cedarpoint.example', password: teamPw } });
    assert.equal(si.status, 200, si.text);
    h.store.put('sessions', { id: createHash('sha256').update(si.cookie.split('=')[1]).digest('hex'), stage: 'full', mfaAt: new Date().toISOString() });
    const refused = await call(h.base, 'PUT', '/v1/mail/sender', { cookie: si.cookie, origin: ORIGIN, body: { address: 'notices@cedarpoint.example' } });
    assert.equal(refused.status, 403, refused.text);
    assert.deepEqual(refused.body, { error: REFUSALS.configure, code: 'role' });
    assert.equal(h.store.get('senders', ws), null, 'nothing was set');
    const seen = await call(h.base, 'GET', '/v1/mail/sender', { cookie: si.cookie, origin: ORIGIN });
    assert.equal(seen.status, 200, seen.text);
    assert.equal(seen.body.status, 'not_set_up');
  } finally {
    await h.close();
  }
  // live is true only on a server the operator started with MAIL_LIVE=1.
  const l = await harness({ smtp: false, env: { MAIL_LIVE: '1' } });
  try {
    const a = await account(l, 'ws-harbor');
    assert.equal((await call(l.base, 'GET', '/v1/mail/sender', { bearer: a.token })).body.live, true);
  } finally {
    await l.close();
  }
});
