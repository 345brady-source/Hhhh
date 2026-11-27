// gate: tests 5
// Delivery events (plan 13-03, EM-07): POST /v1/mail/events takes the mail provider's signed notifications, and each
// verified bounce, complaint or delivery updates the sealed sent-log entry it names (lib/maillog.mjs). Everything runs
// against the local stand-ins (smtp-fake.mjs, ses-fake.mjs); nothing here reaches the outside world. Every address,
// key and token is made by the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';
import { httpsTransport } from '../mailers/ses.mjs';
import { fakeSmtp } from './smtp-fake.mjs';
import { fakeSes, fakeResolver, rsaCert, snsSign } from './ses-fake.mjs';

const ADMIN = 'operator-admin-token-mail-events-0123';
const TOPIC = 'arn:aws:sns:us-east-1:000000000000:mail-events';
const CERT_URL = 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-0000000000000000000000000000000.pem';
const SIGNER = rsaCert();
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';
const INVESTOR_EMAIL = 'ann@investor.example';

/** A server wired to the stand-ins: SMTP at the fake relay, the provider's API at fakeSes, events signed by SIGNER. */
async function harness({ env = {}, smtp, store } = {}) {
  const relay = smtp || (await fakeSmtp({}));
  const ses = await fakeSes();
  const dir = mkdtempSync(join(tmpdir(), 'mail-events-'));
  const file = join(dir, 'store.json');
  const st = store || openStore(file);
  const fullEnv = Object.assign(
    {
      NODE_ENV: 'test',
      PUBLIC_URL: 'https://verify.example',
      ADMIN_TOKEN: ADMIN,
      DATA_KEY: randomBytes(32).toString('base64'),
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(relay.port),
      SMTP_ALLOW_PLAIN: '1',
      MAIL_FROM: 'notices@platform-mail.example',
      MAIL_PROVIDER: 'ses',
      SES_REGION: 'us-east-1',
      SES_ACCESS_KEY_ID: 'AKIDSTANDIN0000003',
      SES_SECRET_ACCESS_KEY: 'standin-secret-for-mail-events-0000000',
      SES_API_HOST: ses.host,
      MAIL_EVENTS_TOPIC_ARN: TOPIC
    },
    env
  );
  const server = createServer({ env: fullEnv, store: st, mailCtx: { transport: httpsTransport({ ca: ses.ca }), resolver: fakeResolver({}), fetchCert: async () => SIGNER.cert } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    server,
    store: st,
    file,
    relay,
    ses,
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await relay.close();
      await ses.close();
      if (st.close) st.close();
    }
  };
}

async function call(base, method, path, { bearer, body, raw } = {}) {
  const headers = {};
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = raw !== undefined ? 'text/plain; charset=UTF-8' : 'application/json';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
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

/** The operator makes the sponsor's account; its sender is set and checked ready at the provider stand-in. */
async function readySponsor(h, workspace = 'ws-harbor', address = 'notices@harborridge.example') {
  const acct = await call(h.base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace, name: 'Harbor Ridge Capital' } });
  assert.equal(acct.status, 200, acct.text);
  const set = await call(h.base, 'PUT', '/v1/mail/sender', { bearer: acct.body.token, body: { address } });
  assert.equal(set.status, 200, set.text);
  h.ses.status.set(address.split('@')[1], 'SUCCESS');
  const chk = await call(h.base, 'POST', '/v1/mail/sender/check', { bearer: acct.body.token, body: {} });
  assert.equal(chk.status, 200, chk.text);
  assert.equal(chk.body.status, 'ready');
  return acct.body;
}

const invitation = (over = {}) =>
  Object.assign(
    {
      sendEmail: true,
      portalUrl: PORTAL,
      firm: { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', supportEmail: 'ir@harborridge.example' },
      investor: { id: 'HRC-0007', contact: 'Ann Lee', title: 'Ann Lee', type: 'individual', email: INVESTOR_EMAIL },
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', shortName: 'Fund II', minimum: 100000, currency: 'USD', documents: [] },
      invitation: { cents: 25000000, cls: 'A' }
    },
    over
  );

/** A signed provider notification carrying one event about the message (relay id and our Message-ID). */
function notification(event, { relayId = 'relay-not-known', messageId = '', over = {} } = {}) {
  const mail = { messageId: relayId, commonHeaders: { messageId } };
  const m = Object.assign({ Type: 'Notification', MessageId: `n-${randomBytes(6).toString('hex')}`, TopicArn: TOPIC, Message: JSON.stringify(Object.assign({ mail }, event)), Timestamp: new Date().toISOString(), SigningCertURL: CERT_URL }, over);
  return JSON.stringify(snsSign(m, SIGNER.privateKey, '2'));
}
const permanentBounce = () => ({ eventType: 'Bounce', bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: INVESTOR_EMAIL }], timestamp: new Date().toISOString() } });
const messageIdOf = (data) => (/^Message-ID: (<[^>]+>)$/m.exec(data) || [])[1] || '';

test('tracer', async () => {
  const h = await harness();
  try {
    const acct = await readySponsor(h);
    const made = await call(h.base, 'POST', '/v1/invitations', { bearer: acct.token, body: invitation() });
    assert.equal(made.status, 200, made.text);
    assert.equal(made.body.emailStatus, 'sent', made.text);
    const token = made.body.token;

    // Sent as the sponsor: the envelope and the From header carry the firm's own ready address, never MAIL_FROM.
    assert.equal(h.relay.messages.length, 1);
    const msg = h.relay.messages[0];
    assert.equal(msg.from, 'notices@harborridge.example');
    assert.deepEqual(msg.to, [INVESTOR_EMAIL]);
    assert.ok(msg.data.includes('From: "Harbor Ridge Capital" <notices@harborridge.example>\r\n'), msg.data.slice(0, 400));
    assert.ok(!msg.data.includes('platform-mail.example'), 'MAIL_FROM is never used for a sponsor’s message');
    const mid = messageIdOf(msg.data);
    assert.match(mid, /^<[0-9a-f]{32}@harborridge\.example>$/);

    // One sealed log entry: sent, the personal link replaced, the token nowhere.
    const log = await call(h.base, 'GET', '/v1/messages/log', { bearer: acct.token });
    assert.equal(log.status, 200, log.text);
    assert.equal(log.body.entries.length, 1, log.text);
    const e = log.body.entries[0];
    assert.equal(e.status, 'sent');
    assert.equal(e.kind, 'invitation');
    assert.equal(e.investorId, 'HRC-0007');
    assert.equal(e.refId, made.body.id);
    assert.equal(e.to, INVESTOR_EMAIL);
    assert.ok(e.text.includes('[personal link]'), e.text);
    assert.ok(!e.text.includes(token), 'the token is not in the logged text');
    assert.ok(!log.text.includes(token), 'the token is nowhere in the answer');

    // The store's file holds neither the investor's address nor the token.
    h.store.flush();
    const disk = readFileSync(h.file, 'utf8');
    assert.ok(!disk.includes(INVESTOR_EMAIL), 'no investor address in the store file');
    assert.ok(!disk.includes(token), 'no token in the store file');

    // A signed permanent bounce for that message: the entry shows bounced, and so does the invitation.
    const ev = await call(h.base, 'POST', '/v1/mail/events', { raw: notification(permanentBounce(), { messageId: mid }) });
    assert.equal(ev.status, 200, ev.text);
    assert.deepEqual(ev.body, { received: 1 });
    const after = await call(h.base, 'GET', '/v1/messages/log', { bearer: acct.token });
    assert.equal(after.body.entries[0].status, 'bounced');
    assert.deepEqual(after.body.entries[0].events.map((x) => x.type), ['bounced']);
    const list = await call(h.base, 'GET', '/v1/invitations', { bearer: acct.token });
    assert.equal(list.status, 200, list.text);
    assert.equal(list.body.find((x) => x.id === made.body.id).emailStatus, 'bounced');
  } finally {
    await h.close();
  }
});

/** A one-connection-at-a-time SMTP stand-in that answers DATA as the provider's relay does: "250 Ok <its message id>". */
async function idRelay(relayId) {
  const messages = [];
  const sockets = new Set();
  const server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    sock.on('error', () => {});
    let buf = '';
    let data = null;
    let from = '';
    const w = (s) => sock.write(`${s}\r\n`);
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (data) {
          if (line === '.') {
            messages.push({ from, data: data.join('\r\n') });
            data = null;
            w(`250 Ok ${relayId}`);
          } else data.push(line);
          continue;
        }
        const verb = line.split(' ')[0].toUpperCase();
        if (verb === 'EHLO') w('250 relay.test');
        else if (verb === 'MAIL') {
          from = (/<([^>]*)>/.exec(line) || [])[1] || '';
          w('250 Ok');
        } else if (verb === 'RCPT') w('250 Ok');
        else if (verb === 'DATA') {
          data = [];
          w('354 go ahead');
        } else if (verb === 'QUIT') {
          w('221 Bye');
          sock.end();
        } else w('502 no');
      }
    });
    w('220 relay.test ESMTP');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    port: server.address().port,
    messages,
    close: () =>
      new Promise((r) => {
        for (const s of sockets) s.destroy();
        server.close(r);
      })
  };
}

test('refused', async () => {
  const h = await harness();
  try {
    const acct = await readySponsor(h);
    const made = await call(h.base, 'POST', '/v1/invitations', { bearer: acct.token, body: invitation() });
    assert.equal(made.body.emailStatus, 'sent', made.text);
    const mid = messageIdOf(h.relay.messages[0].data);
    const before = JSON.stringify(h.store.list('maillog'));
    const good = JSON.parse(notification(permanentBounce(), { messageId: mid }));
    const unsigned = Object.assign({}, good);
    delete unsigned.Signature;
    const cases = {
      unsigned: JSON.stringify(unsigned),
      'wrong topic': notification(permanentBounce(), { messageId: mid, over: { TopicArn: 'arn:aws:sns:us-east-1:000000000000:another-topic' } }),
      'wrong certificate host': notification(permanentBounce(), { messageId: mid, over: { SigningCertURL: 'https://certs.attacker.example/SimpleNotificationService-0.pem' } }),
      'old timestamp': notification(permanentBounce(), { messageId: mid, over: { Timestamp: new Date(Date.now() - 2 * 3600e3).toISOString() } }),
      'changed after signing': JSON.stringify(Object.assign({}, good, { Message: good.Message.replace('Permanent', 'Permanent ') }))
    };
    for (const [name, raw] of Object.entries(cases)) {
      const r = await call(h.base, 'POST', '/v1/mail/events', { raw });
      assert.equal(r.status, 401, `${name}: ${r.text}`);
      assert.deepEqual(r.body, { error: 'Not authorized' }, name);
    }
    assert.equal(JSON.stringify(h.store.list('maillog')), before, 'no entry changed');
    assert.equal(h.store.list('mailsuppress').length, 0, 'nothing suppressed');
    // A body over 256 KB is refused by the size limit before any parsing.
    const big = await call(h.base, 'POST', '/v1/mail/events', { raw: JSON.stringify({ Type: 'Notification', Message: 'x'.repeat(300 * 1024) }) });
    assert.equal(big.status, 413, big.text);
    assert.deepEqual(big.body, { error: 'Request body too large' });
    assert.equal((await call(h.base, 'POST', '/v1/mail/events', { raw: 'not json {' })).status, 400);
    assert.equal(JSON.stringify(h.store.list('maillog')), before);
    // The route takes POST only.
    assert.equal((await call(h.base, 'GET', '/v1/mail/events')).status, 405);
  } finally {
    await h.close();
  }
});

test('delivery', async () => {
  const relay = await idRelay('0100018c7f2a-relay-000000');
  const h = await harness({ smtp: relay });
  try {
    const acct = await readySponsor(h);
    const made = await call(h.base, 'POST', '/v1/invitations', { bearer: acct.token, body: invitation() });
    assert.equal(made.body.emailStatus, 'sent', made.text);
    assert.equal(relay.messages[0].from, 'notices@harborridge.example');
    assert.equal(h.store.list('maillog')[0].relayId, '0100018c7f2a-relay-000000', 'the relay’s id is read from its reply');
    // Matched by the relay's id alone (no Message-ID in the event).
    const at = new Date(Date.now() - 5000).toISOString();
    const r = await call(h.base, 'POST', '/v1/mail/events', { raw: notification({ eventType: 'Delivery', delivery: { timestamp: at, recipients: [INVESTOR_EMAIL] } }, { relayId: '0100018c7f2a-relay-000000' }) });
    assert.equal(r.status, 200, r.text);
    const [e] = (await call(h.base, 'GET', '/v1/messages/log', { bearer: acct.token })).body.entries;
    assert.equal(e.status, 'delivered');
    assert.deepEqual(e.events, [{ type: 'delivered', at }]);
    // The same notification again records nothing new.
    await call(h.base, 'POST', '/v1/mail/events', { raw: notification({ eventType: 'Delivery', delivery: { timestamp: at } }, { relayId: '0100018c7f2a-relay-000000' }) });
    assert.equal((await call(h.base, 'GET', '/v1/messages/log', { bearer: acct.token })).body.entries[0].events.length, 1);
  } finally {
    await h.close();
  }
});

test('transient', async () => {
  const h = await harness();
  try {
    const acct = await readySponsor(h);
    const made = await call(h.base, 'POST', '/v1/invitations', { bearer: acct.token, body: invitation() });
    const mid = messageIdOf(h.relay.messages[0].data);
    const soft = { eventType: 'Bounce', bounce: { bounceType: 'Transient', bouncedRecipients: [{ emailAddress: INVESTOR_EMAIL }], timestamp: new Date().toISOString() } };
    const r = await call(h.base, 'POST', '/v1/mail/events', { raw: notification(soft, { messageId: mid }) });
    assert.equal(r.status, 200, r.text);
    const [e] = (await call(h.base, 'GET', '/v1/messages/log', { bearer: acct.token })).body.entries;
    assert.equal(e.status, 'sent', 'a transient bounce does not change the status');
    assert.deepEqual(e.events.map((x) => [x.type, x.permanent]), [['bounced', false]]);
    assert.equal(h.store.list('mailsuppress').length, 0, 'not suppressed');
    const row = (await call(h.base, 'GET', '/v1/invitations', { bearer: acct.token })).body.find((x) => x.id === made.body.id);
    assert.equal(row.emailStatus, 'sent');
    const again = await call(h.base, 'POST', '/v1/invitations', { bearer: acct.token, body: invitation() });
    assert.equal(again.body.emailStatus, 'sent', 'the address still gets mail');
  } finally {
    await h.close();
  }
});

test('unknown', async () => {
  const h = await harness();
  try {
    const acct = await readySponsor(h);
    await call(h.base, 'POST', '/v1/invitations', { bearer: acct.token, body: invitation() });
    const before = JSON.stringify(h.store.list('maillog'));
    const r = await call(h.base, 'POST', '/v1/mail/events', { raw: notification(permanentBounce(), { relayId: 'no-such-relay-id', messageId: '<00000000000000000000000000000000@harborridge.example>' }) });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { received: 1 });
    assert.equal(JSON.stringify(h.store.list('maillog')), before, 'nothing changed');
    assert.equal(h.store.list('mailsuppress').length, 0);
  } finally {
    await h.close();
  }
});
