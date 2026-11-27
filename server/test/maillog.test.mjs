// gate: tests 6
// The sent log (plan 13-03, EM-07, EM-08, C-07; server/lib/maillog.mjs): one sealed entry for every message the mailer
// handles, whatever became of it; the personal link replaced; each workspace sees only its own; entries kept
// MAIL_LOG_DAYS; a complaint stops optional and possibly commercial mail from that workspace only. Runs against the
// local SMTP stand-in (smtp-fake.mjs) only; every address, key and token is made by the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';
import { openVault } from '../lib/vault.mjs';
import { createMailer } from '../lib/mail.mjs';
import { createMailLog, LOG_STATUSES, emailHash } from '../lib/maillog.mjs';
import { fakeSmtp } from './smtp-fake.mjs';

const DAY = 864e5;
const ADMIN = 'operator-admin-token-maillog-0123456';
const TOKEN = randomBytes(32).toString('base64url');
const LINK = `https://portal.example/diy.html?server=https%3A%2F%2Fverify.example#invite-${TOKEN}`;
const SECRET_WORDS = ['zelda@investor.example', 'Zelda Quixote', 'Quarterly letter for the Quixote account', TOKEN];

/** A ready sender for every workspace except 'ws-pending' (stands in for lib/senders.mjs). */
const senders = { get: (ws) => (ws === 'ws-pending' ? { address: 'x@pending.example', status: 'pending' } : { address: `notices@${ws}.example`, status: 'ready' }) };

/** A store (with a file), a sealing vault, the log, and mailers with and without SMTP sharing them. */
async function rig({ env = {}, now } = {}) {
  const relay = await fakeSmtp({});
  const file = join(mkdtempSync(join(tmpdir(), 'maillog-')), 'store.json');
  const store = openStore(file);
  store.put('accounts', { id: 'acct_t', workspace: 'ws-a' }); // a server with sponsor accounts
  const vault = openVault({ DATA_KEY: randomBytes(32).toString('base64') });
  const log = createMailLog({ store, vault, env, now });
  const smtpEnv = { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(relay.port), SMTP_ALLOW_PLAIN: '1', MAIL_FROM: 'notices@platform-mail.example' };
  const sending = createMailer({ env: smtpEnv, store, vault, now, senders, log });
  const outbox = createMailer({ env: {}, store, vault, now, senders, log });
  const refusing = createMailer({ env: Object.assign({}, smtpEnv, { SMTP_PORT: '1', SMTP_TIMEOUT_MS: '2000' }), store, vault, now, senders, log });
  return { relay, file, store, vault, log, sending, outbox, refusing, close: async () => (await relay.close(), store.close()) };
}
const message = (over = {}) => Object.assign({ kind: 'notice', workspace: 'ws-a', refId: 'ntc_1', investorId: 'HRC-0007', fromName: 'Harbor Ridge Capital', to: 'zelda@investor.example', toName: 'Zelda Quixote', subject: 'Quarterly letter for the Quixote account', text: `Dear Zelda,\n\nOpen your letter: ${LINK}\n\nOr paste this: ${LINK}\n`, html: `<p><a href="${LINK}">Open</a></p>`, link: LINK }, over);

/** One message of each outcome: sent, outbox, held, failed, suppressed. */
async function everyStatus(r) {
  const out = {};
  out.sent = await r.sending.send(message({ refId: 'ntc_sent' }));
  out.outbox = await r.outbox.send(message({ refId: 'ntc_outbox' }));
  out.held = await r.sending.send(message({ refId: 'ntc_held', workspace: 'ws-pending' }));
  out.failed = await r.refusing.send(message({ refId: 'ntc_failed' }));
  r.store.put('mailsuppress', { id: emailHash('gone@investor.example'), reason: 'bounced', at: new Date().toISOString() });
  out.suppressed = await r.sending.send(message({ refId: 'ntc_suppressed', to: 'gone@investor.example' }));
  return out;
}

test('sealed', async () => {
  const r = await rig();
  try {
    await everyStatus(r);
    r.store.flush();
    const disk = readFileSync(r.file, 'utf8');
    for (const s of SECRET_WORDS.concat(['gone@investor.example', 'invite-'])) assert.ok(!disk.includes(s), `${s.slice(0, 12)}… is not in the store's file`);
    // The workspace opens them.
    const list = r.log.list('ws-a');
    assert.equal(list.length, 4);
    const sent = list.find((e) => e.refId === 'ntc_sent');
    assert.equal(sent.to, 'zelda@investor.example');
    assert.equal(sent.subject, 'Quarterly letter for the Quixote account');
    assert.ok(sent.text.startsWith('Dear Zelda,'));
    assert.deepEqual(Object.keys(sent).sort(), ['at', 'events', 'id', 'investorId', 'kind', 'refId', 'status', 'subject', 'text', 'to']);
    assert.equal(r.log.list('ws-pending')[0].subject, 'Quarterly letter for the Quixote account');
  } finally {
    await r.close();
  }
});

test('redacted', async () => {
  const r = await rig();
  try {
    await r.sending.send(message());
    const [e] = r.log.list('ws-a');
    assert.equal(e.text.split('[personal link]').length - 1, 2, e.text);
    assert.ok(!e.text.includes(TOKEN));
    assert.ok(!JSON.stringify(r.store.data()).includes(TOKEN));
    // The relay got the live link: only the log is redacted.
    assert.ok(r.relay.messages[0].data.replace(/=\r\n/g, '').includes(TOKEN.slice(0, 20)));
    // A text holding another token link the caller did not name is redacted too.
    await r.sending.send(message({ refId: 'ntc_2', link: '', text: `Your document: https://portal.example/p.html#taxdoc-${TOKEN}` }));
    const two = r.log.list('ws-a', { refId: 'ntc_2' })[0];
    assert.equal(two.text, 'Your document: [personal link]');
  } finally {
    await r.close();
  }
});

/** One call to the server. */
async function call(base, method, path, { bearer, body } = {}) {
  const headers = body !== undefined ? { 'Content-Type': 'application/json' } : {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text), text };
}
const invitation = (investor) => ({
  sendEmail: true,
  portalUrl: 'https://portal.example/diy.html',
  firm: { name: 'Harbor Ridge Capital', supportEmail: 'ir@harborridge.example' },
  investor: Object.assign({ contact: 'Ann Lee', type: 'individual' }, investor),
  offering: { id: 'f2', name: 'Fund II', minimum: 100000, currency: 'USD', documents: [] },
  invitation: { cents: 25000000, cls: 'A' }
});

test('workspace', async () => {
  let t = Date.now();
  const store = openStore(null);
  const server = createServer({ env: { NODE_ENV: 'test', PUBLIC_URL: 'https://verify.example', ADMIN_TOKEN: ADMIN, DATA_KEY: randomBytes(32).toString('base64') }, store, now: () => t });
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const a = (await call(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace: 'ws-a', name: 'A' } })).body;
    const b = (await call(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace: 'ws-b', name: 'B' } })).body;
    for (const [tok, id] of [[a.token, 'A-1'], [a.token, 'A-2'], [b.token, 'B-1']]) {
      t += 1000;
      const r = await call(base, 'POST', '/v1/invitations', { bearer: tok, body: invitation({ id, email: `${id.toLowerCase()}@investor.example` }) });
      assert.equal(r.status, 200, r.text);
    }
    for (const q of ['', '?workspace=ws-b', '?workspace=ws-a&investorId=B-1']) {
      const mine = await call(base, 'GET', `/v1/messages/log${q}`, { bearer: a.token });
      assert.equal(mine.status, 200, mine.text);
      assert.ok(mine.body.entries.every((e) => !e.investorId.startsWith('B')), q);
      if (!q.includes('investorId')) assert.deepEqual(mine.body.entries.map((e) => e.investorId), ['A-2', 'A-1'], `newest first ${q}`);
    }
    const one = await call(base, 'GET', '/v1/messages/log?investorId=A-1', { bearer: a.token });
    assert.deepEqual(one.body.entries.map((e) => [e.investorId, e.status, e.to]), [['A-1', 'outbox', 'a-1@investor.example']]);
    const theirs = await call(base, 'GET', '/v1/messages/log?workspace=ws-a', { bearer: b.token });
    assert.deepEqual(theirs.body.entries.map((e) => e.investorId), ['B-1']);
  } finally {
    server.closeAllConnections();
    await new Promise((res) => server.close(res));
  }
});

test('retention', async () => {
  const at = () => {
    let t = 0;
    return { now: () => t, set: (ms) => (t = ms) };
  };
  const vault = openVault({ DATA_KEY: randomBytes(32).toString('base64') });
  const NOW = Date.parse('2026-11-27T12:00:00Z');
  const run = (env, ages) => {
    const clock = at();
    const store = openStore(null);
    const log = createMailLog({ store, vault, env, now: clock.now });
    const ids = ages.map((d) => {
      clock.set(NOW - d * DAY);
      return log.add({ workspace: 'ws-a', kind: 'notice', status: 'sent', to: 'zelda@investor.example', subject: 's', text: 't' });
    });
    clock.set(NOW);
    const removed = log.purge(NOW);
    return { removed, kept: ids.filter((i) => store.get('maillog', i)).length, ids, store };
  };
  const dflt = run({}, [2554, 2556]);
  assert.deepEqual([dflt.removed, dflt.kept], [1, 1]);
  assert.ok(dflt.store.get('maillog', dflt.ids[0]), 'the entry 2,554 days old stays');
  const thirty = run({ MAIL_LOG_DAYS: '30' }, [29, 31]);
  assert.deepEqual([thirty.removed, thirty.kept], [1, 1]);
  assert.ok(thirty.store.get('maillog', thirty.ids[0]), 'the entry 29 days old stays');
  for (const bad of ['0', '3651', '-5', 'abc', '']) {
    const r = run({ MAIL_LOG_DAYS: bad }, [29, 2554, 2556]);
    assert.deepEqual([r.removed, r.kept], [1, 2], `MAIL_LOG_DAYS=${JSON.stringify(bad)} falls back to 2,555`);
  }
  // The bounce list is never purged.
  const kept = run({ MAIL_LOG_DAYS: '1' }, [5]);
  kept.store.put('mailsuppress', { id: 'h', reason: 'bounced', at: '2000-01-01T00:00:00.000Z' });
  createMailLog({ store: kept.store, vault, env: { MAIL_LOG_DAYS: '1' } }).purge(NOW);
  assert.ok(kept.store.get('mailsuppress', 'h'));

  // The purge runs where the invitations' purge runs.
  let t = NOW;
  const store = openStore(null);
  const server = createServer({ env: { NODE_ENV: 'test', PUBLIC_URL: 'https://verify.example', DATA_KEY: randomBytes(32).toString('base64') }, store, now: () => t });
  try {
    server.invitations.mailLog.add({ workspace: 'ws-a', kind: 'notice', status: 'sent', to: 'zelda@investor.example', subject: 's', text: 't' });
    t += 2554 * DAY;
    assert.equal(server.invitations.purge().maillog, 0);
    t += 2 * DAY;
    assert.equal(server.invitations.purge().maillog, 1);
    assert.equal(store.list('maillog').length, 0);
  } finally {
    server.emit('close');
  }
});

test('statuses', async () => {
  const r = await rig();
  try {
    const out = await everyStatus(r);
    assert.deepEqual(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.emailStatus])), { sent: 'sent', outbox: 'outbox', held: 'held', failed: 'failed', suppressed: 'suppressed' });
    const all = r.store.list('maillog');
    assert.equal(all.length, 5, 'one entry per message');
    for (const s of ['sent', 'outbox', 'held', 'failed', 'suppressed']) {
      assert.equal(all.filter((e) => e.status === s).length, 1, s);
      assert.equal(all.find((e) => e.status === s).refId, `ntc_${s}`);
      assert.match(out[s].logId, /^mlg_/);
    }
    assert.ok(LOG_STATUSES.includes('unsubscribed'), '13-04 logs unsubscribed with no change here');
    // Only the sent one reached the relay, from the workspace's own address.
    assert.equal(r.relay.messages.length, 1);
    assert.equal(r.relay.messages[0].from, 'notices@ws-a.example');
  } finally {
    await r.close();
  }
});

test('complaint', async () => {
  const r = await rig();
  try {
    const first = await r.sending.send(message({ refId: 'ivt_x', kind: 'invitation' }));
    assert.equal(first.emailStatus, 'sent');
    const mid = (/^Message-ID: <([^>]+)>$/m.exec(r.relay.messages[0].data) || [])[1];
    const e = r.log.event({ messageId: `<${mid}>`, type: 'complained', at: new Date().toISOString() });
    assert.equal(e.status, 'complained');
    assert.equal(r.log.optionalOff('ws-a', 'Zelda@Investor.example'), true);
    assert.equal(r.log.optionalOff('ws-b', 'zelda@investor.example'), false);
    // From ws-a: optional and possibly commercial mail stops; a transactional message still goes.
    assert.equal((await r.sending.send(message({ refId: 'n2', commercial: true }))).emailStatus, 'suppressed');
    assert.equal((await r.sending.send(message({ refId: 'n3', optional: true }))).emailStatus, 'suppressed');
    assert.equal((await r.sending.send(message({ refId: 'n4' }))).emailStatus, 'sent');
    // Another workspace still sends to the address, commercial or not.
    assert.equal((await r.sending.send(message({ refId: 'n5', workspace: 'ws-b', commercial: true }))).emailStatus, 'sent');
    assert.equal(r.relay.messages.length, 3);
    assert.deepEqual(r.relay.messages.map((m) => m.from), ['notices@ws-a.example', 'notices@ws-a.example', 'notices@ws-b.example']);
    assert.equal(r.log.suppressed('zelda@investor.example'), false, 'a complaint is not a bounce');
  } finally {
    await r.close();
  }
});
