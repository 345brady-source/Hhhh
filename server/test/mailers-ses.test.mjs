// gate: tests 8
// The default provider's adapter (server/mailers/ses.mjs), against local stand-ins only (ses-fake.mjs): the HTTPS
// stand-in of the identity API, a resolver stand-in and a self-signed RSA signing certificate. No key, no account and
// no outside call: every fetch goes through the injected ctx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import ses, { httpsTransport, signRequest } from '../mailers/ses.mjs';
import { fakeSes, fakeResolver, rsaCert, snsSign, snsStringToSign } from './ses-fake.mjs';

const SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYSTANDINKEY';
const ACCESS = 'AKIDSTANDIN0000001';
const TOPIC = 'arn:aws:sns:us-east-1:123456789012:mail-events';
const VENDOR = /amazon|aws|ses\b/i;
const NOW = Date.now();
const CERT_URL = 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-0000000000000000000000000000000.pem';
const SIGNER = rsaCert();

const envFor = (fake) => ({ SES_REGION: 'us-east-1', SES_ACCESS_KEY_ID: ACCESS, SES_SECRET_ACCESS_KEY: SECRET, SES_API_HOST: fake ? fake.host : '127.0.0.1:9', MAIL_EVENTS_TOPIC_ARN: TOPIC });
/** A record's text with the DKIM key material set aside (random base64 may hold any three letters by chance). */
const words = (r) => `${r.name} ${r.value.replace(/p=[A-Za-z0-9+/=]+$/, 'p=KEY')}`;

/** ctx for events: the certificate served at the allowed URL only, and a transport that records each GET. */
function eventCtx(over = {}) {
  const certCalls = [];
  const gets = [];
  const ctx = Object.assign(
    {
      env: envFor(null),
      now: () => NOW,
      fetchCert: async (url) => {
        certCalls.push(url);
        return SIGNER.cert;
      },
      transport: async (req) => {
        gets.push(req);
        return { status: 200, body: '<ConfirmSubscriptionResponse/>' };
      }
    },
    over
  );
  return { ctx, certCalls, gets };
}
// The notification format: "HTTP/HTTPS notification JSON format", provider's SNS developer guide.
const note = (message, over = {}) => Object.assign({ Type: 'Notification', MessageId: '22b80b92-fdea-4c2c-8f9d-bdfb0c7bf324', TopicArn: TOPIC, Subject: 'Delivery event', Message: JSON.stringify(message), Timestamp: new Date(NOW - 60000).toISOString(), SigningCertURL: CERT_URL, UnsubscribeURL: 'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=x' }, over);
const signed = (m, v = '1') => Buffer.from(JSON.stringify(snsSign(m, SIGNER.privateKey, v)));
const status = async (p) => {
  try {
    await p;
  } catch (e) {
    return e.status;
  }
  return 'no error';
};
// The event format: "Contents of event data that Amazon SES publishes to Amazon SNS", provider's developer guide.
const mail = { timestamp: '2026-11-20T10:00:00.000Z', source: 'notices@harborridge.example', messageId: '0100018c-relay-0001', destination: ['ann@lee.example'], commonHeaders: { from: ['Harbor Ridge <notices@harborridge.example>'], to: ['ann@lee.example'], messageId: '<4f2a9c@harborridge.example>', subject: 'Your invitation' } };

test('sigv4: the published example request signs to the published signature; a changed body changes it', () => {
  // "Create a signed AWS API request" / "Signature Version 4 signing process" example (IAM ListUsers, 2015-08-30).
  const req = { method: 'GET', path: '/', query: 'Action=ListUsers&Version=2010-05-08', headers: { host: 'iam.amazonaws.com', 'content-type': 'application/x-www-form-urlencoded; charset=utf-8', 'x-amz-date': '20150830T123600Z' }, body: '', region: 'us-east-1', service: 'iam', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' };
  const r = signRequest(req);
  assert.equal(createHash('sha256').update(r.canonicalRequest).digest('hex'), 'f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59');
  assert.equal(r.signature, '5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7');
  assert.equal(r.headers.authorization, 'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7');
  assert.notEqual(signRequest(Object.assign({}, req, { body: 'x' })).signature, r.signature);
});

test('records: one DKIM TXT record holding the key sent to the provider, DMARC only when none exists, no vendor word, private key kept nowhere', async () => {
  const fake = await fakeSes();
  try {
    const kp = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const base = { env: envFor(fake), transport: httpsTransport({ ca: fake.ca }), keys: () => kp };
    const out = await ses.setup('harborridge.example', Object.assign({ resolver: fakeResolver({}) }, base));
    assert.deepEqual(out.records.map((r) => `${r.type} ${r.purpose}`), ['TXT dkim', 'TXT dmarc']);
    const [dkim, dmarc] = out.records;
    assert.equal(dkim.name, `${out.selector}._domainkey.harborridge.example`);
    assert.match(out.selector, /^cv[a-z0-9]{8}$/);
    assert.deepEqual([dmarc.name, dmarc.value], ['_dmarc.harborridge.example', 'v=DMARC1; p=none']);
    for (const r of out.records) assert.doesNotMatch(words(r), VENDOR, words(r));
    // The key the provider received is the private half of the published record.
    const sent = fake.identities.get('harborridge.example');
    assert.equal(sent.selector, out.selector);
    const pub = createPublicKey(createPrivateKey({ key: Buffer.from(sent.privateKey, 'base64'), format: 'der', type: 'pkcs1' })).export({ type: 'spki', format: 'der' }).toString('base64');
    assert.equal(dkim.value, `v=DKIM1; k=rsa; p=${pub}`);
    // Private parts only: the key's first ~380 base64 characters hold the modulus, which the public record carries too.
    for (const s of [sent.privateKey.slice(400, 460), sent.privateKey.slice(-70, -10)]) assert.ok(!JSON.stringify(out).includes(s), 'the private key is not in what setup returns');
    // A DMARC record already published (in two pieces) means none is offered.
    const out2 = await ses.setup('ridgeline.example', Object.assign({ resolver: fakeResolver({ '_dmarc.ridgeline.example': [['v=DMA', 'RC1; p=quarantine; rua=mailto:d@ridgeline.example']] }) }, base));
    assert.deepEqual(out2.records.map((r) => r.purpose), ['dkim']);
    // A lookup that times out proves nothing: no DMARC record is offered (a second DMARC record would break the first).
    const out3 = await ses.setup('timeout.example', Object.assign({ resolver: fakeResolver({}, { fail: 'ETIMEOUT' }) }, base));
    assert.deepEqual(out3.records.map((r) => r.purpose), ['dkim']);
    // A refused call: the error holds no key or secret.
    fake.fail = { code: 403 };
    const err = await ses.setup('third.example', Object.assign({ resolver: fakeResolver({}) }, base)).catch((e) => e);
    const pk3 = JSON.parse(fake.requests[fake.requests.length - 1].body).DkimSigningAttributes.DomainSigningPrivateKey;
    for (const s of [pk3.slice(400, 460), pk3.slice(-70, -10), SECRET, ACCESS]) assert.ok(!err.message.includes(s));
    assert.doesNotMatch(err.message, VENDOR);
  } finally {
    await fake.close();
  }
});

test('status: SUCCESS and verified is ready, PENDING pending, FAILED failed with its sentence, a 403 holds no key or secret', async () => {
  const fake = await fakeSes();
  try {
    const ctx = { env: envFor(fake), transport: httpsTransport({ ca: fake.ca }), resolver: fakeResolver({}) };
    await ses.setup('harborridge.example', ctx);
    assert.equal((await ses.status('harborridge.example', ctx)).state, 'pending');
    fake.status.set('harborridge.example', 'SUCCESS');
    fake.verified.set('harborridge.example', false);
    assert.equal((await ses.status('harborridge.example', ctx)).state, 'pending', 'SUCCESS without VerifiedForSendingStatus is not ready');
    fake.verified.delete('harborridge.example');
    const ready = await ses.status('harborridge.example', ctx);
    assert.equal(ready.state, 'ready');
    fake.status.set('harborridge.example', 'FAILED');
    const failed = await ses.status('harborridge.example', ctx);
    assert.deepEqual(failed, { state: 'failed', detail: 'The DKIM record was not found or does not match; check it was copied exactly.' });
    for (const s of [ready.detail, failed.detail]) assert.doesNotMatch(s, VENDOR);
    fake.fail = { code: 403 };
    const err = await ses.status('harborridge.example', ctx).catch((e) => e);
    assert.ok(err instanceof Error);
    for (const s of [SECRET, ACCESS, 'amazonaws']) assert.ok(!err.message.includes(s), err.message);
  } finally {
    await fake.close();
  }
});

test('confirm: a subscription is confirmed only at an https sns host for the configured topic', async () => {
  const conf = (over = {}) => Object.assign({ Type: 'SubscriptionConfirmation', MessageId: '165545c9-2a5c-472c-8df2-7ff2be2b3b1b', Token: '2336412f37fb687f5d51e6e241d09c805', TopicArn: TOPIC, Message: 'You have chosen to subscribe to the topic.', SubscribeURL: 'https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=x&Token=2336412f37fb687f5d51e6e241d09c805', Timestamp: new Date(NOW - 1000).toISOString(), SigningCertURL: CERT_URL }, over);
  const ok = eventCtx();
  assert.deepEqual(await ses.events({ headers: {} }, signed(conf()), ok.ctx), []);
  assert.equal(ok.gets.length, 1);
  assert.equal(`https://${ok.gets[0].host}${ok.gets[0].path}`, conf().SubscribeURL);
  assert.equal(ok.gets[0].method, 'GET');
  for (const bad of [{ SubscribeURL: 'https://sns.us-east-1.amazonaws.com.attacker.example/?Action=ConfirmSubscription' }, { SubscribeURL: 'http://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription' }, { SubscribeURL: 'https://169.254.169.254/latest/meta-data/' }, { TopicArn: 'arn:aws:sns:us-east-1:999999999999:other' }]) {
    const c = eventCtx();
    assert.equal(await status(ses.events({ headers: {} }, signed(conf(bad)), c.ctx)), 401, JSON.stringify(bad));
    assert.equal(c.gets.length, 0, `nothing fetched for ${JSON.stringify(bad)}`);
  }
});

test('signature: versions 1 and 2 verify; a changed Message, no Signature, a certificate on another host or a two-hour-old Timestamp is refused', async () => {
  // The documented string to sign, field by field (Subject present).
  const fixed = note({ eventType: 'Delivery', delivery: { timestamp: '2026-11-20T10:00:02.000Z' }, mail }, { Message: 'Hello world!', Timestamp: '2012-05-02T00:54:06.655Z' });
  assert.equal(snsStringToSign(fixed), `Message\nHello world!\nMessageId\n22b80b92-fdea-4c2c-8f9d-bdfb0c7bf324\nSubject\nDelivery event\nTimestamp\n2012-05-02T00:54:06.655Z\nTopicArn\n${TOPIC}\nType\nNotification\n`);
  const msg = { eventType: 'Delivery', delivery: { timestamp: '2026-11-20T10:00:02.000Z' }, mail };
  for (const v of ['1', '2']) {
    const c = eventCtx();
    const got = await ses.events({ headers: {} }, signed(note(msg), v), c.ctx);
    assert.equal(got.length, 1, `version ${v}`);
    assert.deepEqual(c.certCalls, [CERT_URL]);
  }
  const good = snsSign(note(msg), SIGNER.privateKey, '2');
  const changed = Object.assign({}, good, { Message: good.Message.replace('Delivery', 'Delivers') });
  const unsigned = Object.assign({}, good);
  delete unsigned.Signature;
  const otherHost = snsSign(note(msg, { SigningCertURL: 'https://certs.attacker.example/SimpleNotificationService-1.pem' }), SIGNER.privateKey, '2');
  const notPem = snsSign(note(msg, { SigningCertURL: 'https://sns.us-east-1.amazonaws.com/cert.txt' }), SIGNER.privateKey, '2');
  const old = snsSign(note(msg, { Timestamp: new Date(NOW - 2 * 3600e3).toISOString() }), SIGNER.privateKey, '2');
  const wrongTopic = snsSign(note(msg, { TopicArn: 'arn:aws:sns:us-east-1:999999999999:other' }), SIGNER.privateKey, '2');
  const forger = rsaCert('forger');
  const forged = snsSign(note(msg), forger.privateKey, '2');
  for (const [name, body] of [['changed Message', changed], ['no Signature', unsigned], ['certificate on another host', otherHost], ['certificate path not .pem', notPem], ['two hours old', old], ['another topic', wrongTopic], ['signed by another key', forged]]) {
    const c = eventCtx();
    assert.equal(await status(ses.events({ headers: {} }, Buffer.from(JSON.stringify(body)), c.ctx)), 401, name);
    if (name.startsWith('certificate')) assert.equal(c.certCalls.length, 0, `no certificate fetched: ${name}`);
  }
});

test('bounce: a permanent bounce maps to bounced/permanent, a transient one to permanent false', async () => {
  const b = (bounceType) => ({ eventType: 'Bounce', bounce: { bounceType, bounceSubType: 'General', bouncedRecipients: [{ emailAddress: 'ann@lee.example', action: 'failed', status: '5.1.1' }], timestamp: '2026-11-20T10:00:01.000Z', feedbackId: 'f-1' }, mail });
  const perm = await ses.events({ headers: {} }, signed(note(b('Permanent'))), eventCtx().ctx);
  assert.deepEqual(perm, [{ relayId: '0100018c-relay-0001', messageId: '<4f2a9c@harborridge.example>', type: 'bounced', permanent: true, at: '2026-11-20T10:00:01.000Z' }]);
  const temp = await ses.events({ headers: {} }, signed(note(b('Transient'))), eventCtx().ctx);
  assert.equal(temp[0].type, 'bounced');
  assert.equal(temp[0].permanent, false);
});

test('complaint and delivery: notificationType and eventType forms both map', async () => {
  const complaint = await ses.events({ headers: {} }, signed(note({ notificationType: 'Complaint', complaint: { complainedRecipients: [{ emailAddress: 'ann@lee.example' }], timestamp: '2026-11-20T11:00:00.000Z', feedbackId: 'f-2' }, mail })), eventCtx().ctx);
  assert.deepEqual(complaint, [{ relayId: '0100018c-relay-0001', messageId: '<4f2a9c@harborridge.example>', type: 'complained', permanent: false, at: '2026-11-20T11:00:00.000Z' }]);
  const delivery = await ses.events({ headers: {} }, signed(note({ eventType: 'Delivery', delivery: { timestamp: '2026-11-20T10:00:02.000Z', recipients: ['ann@lee.example'] }, mail })), eventCtx().ctx);
  assert.deepEqual(delivery, [{ relayId: '0100018c-relay-0001', messageId: '<4f2a9c@harborridge.example>', type: 'delivered', permanent: false, at: '2026-11-20T10:00:02.000Z' }]);
  // Other event kinds (opens and clicks are never turned on, C-10) give nothing.
  assert.deepEqual(await ses.events({ headers: {} }, signed(note({ eventType: 'Send', send: {}, mail })), eventCtx().ctx), []);
});

test('malformed: not JSON or no Type is 400; a body over 256 KB is refused before it is parsed', async () => {
  assert.equal(await status(ses.events({ headers: {} }, Buffer.from('not json {'), eventCtx().ctx)), 400);
  assert.equal(await status(ses.events({ headers: {} }, Buffer.from(JSON.stringify({ MessageId: 'x' })), eventCtx().ctx)), 400);
  assert.equal(await status(ses.events({ headers: {} }, Buffer.from(JSON.stringify({ Type: 'Notification' })), eventCtx().ctx)), 401);
  // Valid JSON, over the limit: a parse would reach the signature check (401); the size check answers first.
  const big = Buffer.from(JSON.stringify({ Type: 'Notification', Message: 'x'.repeat(262200) }));
  assert.ok(big.length > 262144);
  assert.equal(await status(ses.events({ headers: {} }, big, eventCtx().ctx)), 413);
});
