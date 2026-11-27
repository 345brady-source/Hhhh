// gate: tests 4
// Tax document notices on the one template set and the sent log (plan 13-07, EM-01, EM-08, EM-09, EM-14): the notice of
// Rev. Proc. 2012-17 section 7.01 and the consent request are assets/js/emails.js renders; every message the server sends
// for a tax document leaves one sealed sent-log entry (13-03) with the document's id and the investor's id; a signed
// permanent bounce of the notice shows on the sponsor's list (GET /v1/taxdocs) as emailStatus bounced with bouncedAt,
// which the console turns into the notice that came back (section 7.02: paper within 30 days). Everything runs against
// the local stand-ins (smtp-fake.mjs, ses-fake.mjs); nothing here reaches the outside world. Every number is invented:
// the last four digits on record, 4721, appear in no date, telephone number or amount of the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';
import { httpsTransport } from '../mailers/ses.mjs';
import { fakeSmtp, parts } from './smtp-fake.mjs';
import { fakeSes, fakeResolver, rsaCert, snsSign } from './ses-fake.mjs';
import { stripLinkTokens } from './helpers.mjs';

const emails = createRequire(import.meta.url)('../../assets/js/emails.js');
const API = 'sponsor-api-token-taxdocs-mail-0123456789';
const TOPIC = 'arn:aws:sns:us-east-1:000000000000:mail-events';
const CERT_URL = 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-0000000000000000000000000000000.pem';
const SIGNER = rsaCert();
const PORTAL = 'https://portal.example/portal.html?tenant=harbor';
const SUBJECT = 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE';
const LAST4 = '4721';
const EMAIL = 'zelda@investor.example';
const CONTACT = { name: 'Harbor Ridge Investor Relations', address: '1 Market Street, Wilmington, DE 19801', phone: '(212) 555-0100', email: 'tax@harborridge.example' };
const CONSENT_LINES = ['Your tax documents are posted on this portal.', 'If you do not consent, they are sent on paper.'];
const pdf = () => Buffer.from('%PDF-1.4\n% K1MARKERHARBOR\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** What the console posts when it delivers one document. */
function payload(over = {}) {
  const file = pdf();
  return Object.assign(
    {
      workspace: 'ws-harbor',
      docId: 'doc-k1-zelda',
      kind: 'k1-1065',
      year: '2026',
      title: 'Schedule K-1 (Form 1065) 2026',
      fileName: 'k1-1065-2026-HRC-0007.pdf',
      pdf: file.toString('base64'),
      sha256: sha(file),
      availableUntil: '2027-12-31',
      investor: { id: 'HRC-0007', name: 'Zelda Quixote', email: EMAIL, last4: LAST4 },
      firm: { name: 'Harbor Ridge Capital', contact: CONTACT },
      consent: { inEffect: true, version: '2026-11-19', lines: CONSENT_LINES },
      portalUrl: PORTAL,
      sendEmail: true
    },
    over
  );
}

/** The same data the server is given, as emails.js reads it. */
const taxData = (link, p = payload()) => ({ variant: 'link', firm: { name: p.firm.name }, investor: { name: p.investor.name }, doc: { title: p.title, availableUntil: p.availableUntil }, link, contact: p.firm.contact });

/** A server with SMTP at the fake relay and the provider's events signed by SIGNER; API_TOKEN for the sponsor. */
async function harness() {
  const relay = await fakeSmtp({});
  const ses = await fakeSes();
  const dir = mkdtempSync(join(tmpdir(), 'taxdocs-mail-'));
  const store = openStore(join(dir, 'store.json'));
  const env = {
    NODE_ENV: 'test',
    PUBLIC_URL: 'https://verify.example',
    PORTAL_ORIGIN: 'https://portal.example',
    API_TOKEN: API,
    DATA_KEY: randomBytes(32).toString('base64'),
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(relay.port),
    SMTP_ALLOW_PLAIN: '1',
    MAIL_FROM: 'notices@harborridge.example',
    MAIL_PROVIDER: 'ses',
    SES_REGION: 'us-east-1',
    SES_ACCESS_KEY_ID: 'AKIDSTANDIN0000013',
    SES_SECRET_ACCESS_KEY: 'standin-secret-for-taxdocs-mail-00000',
    SES_API_HOST: ses.host,
    MAIL_EVENTS_TOPIC_ARN: TOPIC
  };
  const server = createServer({ env, store, mailCtx: { transport: httpsTransport({ ca: ses.ca }), resolver: fakeResolver({}), fetchCert: async () => SIGNER.cert } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    store,
    relay,
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await relay.close();
      await ses.close();
      if (store.close) store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

async function call(base, method, path, { body, raw, bearer = API, doc } = {}) {
  const headers = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (doc !== undefined) headers['X-Doc-Token'] = doc;
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = raw !== undefined ? 'text/plain; charset=UTF-8' : 'application/json';
  const res = await fetch(base + path, { method, headers, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, body: json, text };
}

/** A signed provider notification of one bounce of the message with this Message-ID. */
function bounce(messageId, type = 'Permanent', at = new Date().toISOString()) {
  const mail = { messageId: 'relay-not-known', commonHeaders: { messageId } };
  const event = { eventType: 'Bounce', bounce: { bounceType: type, bouncedRecipients: [{ emailAddress: EMAIL }], timestamp: at } };
  const m = { Type: 'Notification', MessageId: `n-${randomBytes(6).toString('hex')}`, TopicArn: TOPIC, Message: JSON.stringify(Object.assign({ mail }, event)), Timestamp: new Date().toISOString(), SigningCertURL: CERT_URL };
  return JSON.stringify(snsSign(m, SIGNER.privateKey, '2'));
}
const messageIdOf = (data) => (/^Message-ID: (<[^>]+>)$/m.exec(data) || [])[1] || '';
const subjectOf = (data) => (/^Subject: (.*)$/m.exec(data) || [])[1] || '';
/** The relay's message n: its subject header, its text part (LF line ends) and its Message-ID. */
function relayed(h, n) {
  const m = h.relay.messages[n];
  if (!m) return null;
  const p = parts(m.data);
  return { to: m.to, subject: subjectOf(m.data), text: String(p.text || '').replace(/\r\n/g, '\n'), html: p.html || '', mid: messageIdOf(m.data) };
}
const tokenOf = (link) => (/#taxdoc-([A-Za-z0-9_-]{43})$/.exec(String(link)) || [])[1] || '';
const documents = async (h) => (await call(h.base, 'GET', '/v1/taxdocs?workspace=ws-harbor')).body.documents;

test('tracer', async () => {
  const h = await harness();
  try {
    const made = await call(h.base, 'POST', '/v1/taxdocs', { body: payload() });
    assert.equal(made.status, 200, made.text);
    assert.equal(made.body.emailStatus, 'sent', made.text);
    const m = relayed(h, 0);
    assert.ok(m, 'one message reached the relay');
    assert.deepEqual(m.to, [EMAIL]);
    assert.equal(m.subject, SUBJECT);
    const want = emails.render('tax_notice', taxData(made.body.link));
    assert.equal(want.subject, SUBJECT);
    assert.equal(m.text, want.text, 'the notice is emails.js tax_notice (link variant) for the same data');
    assert.ok(!stripLinkTokens(m.text).includes(LAST4) && !stripLinkTokens(m.html).includes(LAST4), 'no digits of the tax number in the message');

    // A signed permanent bounce of that notice: the sponsor's list says bounced, with when.
    const at = new Date().toISOString();
    const ev = await call(h.base, 'POST', '/v1/mail/events', { bearer: null, raw: bounce(m.mid, 'Permanent', at) });
    assert.equal(ev.status, 200, ev.text);
    assert.deepEqual(ev.body, { received: 1 });
    const d = (await documents(h))[0];
    assert.equal(d.id, made.body.id);
    assert.equal(d.emailStatus, 'bounced', JSON.stringify(d));
    assert.equal(d.bouncedAt, new Date(Date.parse(at)).toISOString(), JSON.stringify(d));
  } finally {
    await h.close();
  }
});
