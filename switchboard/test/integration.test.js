// End-to-end test against real IMAP/POP3 servers (Dovecot) and an SMTP test server.
// Skips automatically when the Dovecot test server is not running (see README → Development).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import '../src/quiet.js';

const PORT = 4611;
process.env.SWITCHBOARD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-int-'));
process.env.SWITCHBOARD_PORT = String(PORT);

const reachable = (port) => new Promise((r) => {
  const s = net.connect(port, '127.0.0.1');
  s.once('connect', () => { s.destroy(); r(true); });
  s.once('error', () => r(false));
});
const haveDovecot = (await reachable(10993)) && (await reachable(10995));

test('end to end: 12 accounts, mail actions, calendar, MCP and the Claude assistant', { skip: !haveDovecot && 'Dovecot test server not running' }, async (t) => {
  const { startSmtp, imapAppend, imapClear, USERS, DOVECOT } = await import('./helpers/servers.js');
  const { startFakeAnthropic } = await import('./helpers/fake-anthropic.js');
  const { buildRaw } = await import('../src/mailutil.js');
  const { ImapFlow } = await import('imapflow');

  const smtp = await startSmtp(10599);
  const claude = await startFakeAnthropic((body) => {
    const last = body.messages[body.messages.length - 1];
    const results = Array.isArray(last.content) ? last.content.filter((b) => b.type === 'tool_result') : [];
    if (!results.length) {
      return {
        stop: 'tool_use',
        blocks: [
          { type: 'thinking', thinking: 'The user wants lunch added and Sam told.' },
          { type: 'text', text: 'Adding it now.' },
          { type: 'tool_use', id: 'toolu_1', name: 'create_event', input: { title: 'Lunch with Sam', start: '2026-11-10T12:00', duration_minutes: 60, calendar: 'personal' } },
        ],
      };
    }
    if (results[0].tool_use_id === 'toolu_1') {
      return { stop: 'tool_use', blocks: [{ type: 'tool_use', id: 'toolu_2', name: 'send_email', input: { from_account: 'personal', to: ['user3@test.local'], subject: 'Lunch Tuesday', body: 'See you at noon!' } }] };
    }
    return { stop: 'end_turn', blocks: [{ type: 'text', text: `Done. ${results[0].is_error ? 'Not sent.' : 'Added and emailed.'}` }] };
  });
  process.env.ANTHROPIC_BASE_URL = claude.url;
  process.env.ANTHROPIC_API_KEY = 'test-key';

  const { startApp } = await import('../src/server.js');
  const { apiToken } = await import('../src/config.js');
  const app = await startApp({ quiet: true, scheduler: false });
  const token = apiToken();
  const base = `http://127.0.0.1:${PORT}`;
  const api = async (p, opts = {}) => {
    const res = await fetch(base + p, { method: opts.method || 'GET', headers: { 'X-Switchboard-Token': token, 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const j = await res.json();
    if (!res.ok) throw new Error(`${p}: ${j.error}`);
    return j;
  };
  t.after(async () => {
    await app.stop();
    await smtp.close();
    await claude.close();
  });

  // Seed 12 mailboxes with 2 messages each.
  for (let i = 1; i <= 12; i++) {
    const user = `user${i}@test.local`;
    await imapClear(user);
    for (const subject of [`Hello ${i}a`, `Hello ${i}b`]) {
      const { raw } = await buildRaw({ from: 'Carol <carol@example.com>', to: user, subject, text: `Message ${subject} about the quarterly budget` });
      await imapAppend(user, raw);
    }
  }

  await t.test('connects 12 accounts at once (10 IMAP + 2 POP3)', async () => {
    const smtpCfg = { smtpHost: '127.0.0.1', smtpPort: 10599, smtpSecurity: 'none' };
    const labels = ['Work', 'Personal', 'Side', 'Family', 'School', 'Shop', 'Charity', 'Consult', 'Legacy', 'Invest', 'Travel', 'News'];
    for (let i = 1; i <= 12; i++) {
      const pop = i === 9 || i === 12;
      await api('/api/accounts', {
        method: 'POST',
        body: pop
          ? { type: 'pop3', email: `user${i}@test.local`, label: labels[i - 1], config: { popHost: '127.0.0.1', popPort: DOVECOT.pop3, popSecurity: 'ssl', allowSelfSigned: true, ...smtpCfg }, secrets: { password: USERS[`user${i}@test.local`] } }
          : { type: 'imap', email: `user${i}@test.local`, label: labels[i - 1], config: { imapHost: '127.0.0.1', imapPort: DOVECOT.imap, imapSecurity: 'ssl', allowSelfSigned: true, ...smtpCfg }, secrets: { password: USERS[`user${i}@test.local`] } },
      });
    }
    for (let k = 0; k < 120; k++) {
      const accts = await api('/api/accounts');
      if (accts.every((a) => a.status === 'ok' && a.lastSyncAt)) break;
      if (accts.some((a) => a.status === 'error')) throw new Error(JSON.stringify(accts.filter((a) => a.status === 'error')));
      await new Promise((r) => setTimeout(r, 500));
    }
    const accts = await api('/api/accounts');
    assert.equal(accts.length, 12);
    assert.ok(accts.every((a) => a.status === 'ok'), JSON.stringify(accts.map((a) => [a.email, a.status, a.lastError])));
    const unified = await api('/api/messages?view=unified&limit=100');
    assert.equal(unified.messages.length, 24);
    assert.equal(new Set(unified.messages.map((m) => m.accountId)).size, 12);
  });

  await t.test('flags, moves and deletes reach the IMAP server', async () => {
    const work = (await api('/api/accounts')).find((a) => a.label === 'Work');
    const msgs = (await api(`/api/messages?view=unified&account=${work.id}`)).messages;
    await api('/api/messages/actions', { method: 'POST', body: { action: 'read', ids: [msgs[0].id] } });
    await api('/api/messages/actions', { method: 'POST', body: { action: 'flag', ids: [msgs[0].id] } });
    await api('/api/messages/actions', { method: 'POST', body: { action: 'archive', ids: [msgs[1].id] } });
    const c = new ImapFlow({ host: '127.0.0.1', port: DOVECOT.imap, secure: true, tls: { rejectUnauthorized: false }, auth: { user: 'user1@test.local', pass: 'pass1' }, logger: false });
    await c.connect();
    try {
      let lock = await c.getMailboxLock('INBOX');
      const inboxMsgs = await c.fetchAll('1:*', { flags: true, envelope: true });
      lock.release();
      assert.equal(inboxMsgs.length, 1);
      assert.ok(inboxMsgs[0].flags.has('\\Seen') && inboxMsgs[0].flags.has('\\Flagged'));
      lock = await c.getMailboxLock('Archive');
      const archived = await c.fetchAll('1:*', { envelope: true });
      lock.release();
      assert.equal(archived.length, 1);
      assert.equal(archived[0].envelope.subject, msgs[1].subject);
    } finally {
      await c.logout();
    }
    // Opening the archived message still works (its cached copy follows the move).
    const archivedId = (await api('/api/messages?view=all&q=' + encodeURIComponent(`"${msgs[1].subject}"`))).messages[0].id;
    const full = await api(`/api/messages/${archivedId}`);
    assert.match(full.text, /quarterly budget/);
    await api('/api/messages/actions', { method: 'POST', body: { action: 'delete', ids: [archivedId] } });
    const trash = (await api('/api/bootstrap')).folders.find((f) => f.accountId === work.id && f.role === 'trash');
    assert.equal((await api(`/api/messages?folder=${trash.id}`)).messages.length, 1);
  });

  await t.test('sends from one account to another, with threading on reply', async () => {
    const accts = await api('/api/accounts');
    const work = accts.find((a) => a.label === 'Work');
    const legacy = accts.find((a) => a.label === 'Legacy'); // POP3
    await api('/api/send', { method: 'POST', body: { accountId: work.id, to: [{ address: 'user9@test.local' }], subject: 'Ping from Work', html: '<p>Are you there?</p>' } });
    await api(`/api/accounts/${legacy.id}/sync`, { method: 'POST' });
    let got;
    for (let k = 0; k < 40 && !got; k++) {
      await new Promise((r) => setTimeout(r, 250));
      got = (await api(`/api/messages?view=unified&account=${legacy.id}`)).messages.find((m) => m.subject === 'Ping from Work');
    }
    assert.ok(got, 'delivered to the POP3 account');
    await api('/api/send', { method: 'POST', body: { accountId: legacy.id, replyToId: got.id, to: [{ address: 'user1@test.local' }], subject: 'Re: Ping from Work', html: '<p>Yes!</p>' } });
    const sent = smtp.received.find((m) => m.raw.toString().includes('Subject: Re: Ping from Work'));
    assert.ok(sent);
    assert.match(sent.raw.toString(), /In-Reply-To: </);
    const legacySent = (await api('/api/bootstrap')).folders.find((f) => f.accountId === legacy.id && f.role === 'sent');
    assert.equal((await api(`/api/messages?folder=${legacySent.id}`)).messages.length, 1, 'POP3 accounts keep a local Sent copy');
  });

  await t.test('MCP over HTTP: Claude Desktop/Code tools work against the live app', async () => {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    const call = async (name, args = {}) => {
      const r = await client.callTool({ name, arguments: args });
      if (r.isError) throw new Error(r.content[0].text);
      return JSON.parse(r.content[0].text);
    };
    assert.equal((await client.listTools()).tools.length, 25);
    const overview = await call('get_overview');
    assert.equal(overview.accounts.length, 12);
    const ev = await call('create_event', { title: 'Board meeting', start: '2026-11-13T10:00', duration_minutes: 90, calendar: 'charity' });
    assert.match(ev.created.calendar, /^Charity/);
    const found = await call('search_emails', { query: 'budget account:family' });
    assert.equal(found.count, 2);
    const draft = await call('create_draft', { reply_to_id: found.emails[0].id, body: 'Thanks, Carol.' });
    assert.equal(draft.to[0], 'Carol <carol@example.com>');
    const free = await call('find_free_time', { start: '2026-11-13', end: '2026-11-14', duration_minutes: 60 });
    assert.ok(free.slots.length >= 1);
    await client.close();
  });

  await t.test('in-app Claude: streams, runs tools, and waits for approval before sending', async () => {
    const res = await fetch(`${base}/api/assistant/chat`, { method: 'POST', headers: { 'X-Switchboard-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Add lunch with Sam Tuesday at noon and let Sam know' }) });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const seen = [];
    let text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const ev = chunk.match(/^event: (.*)$/m)?.[1];
        const data = JSON.parse(chunk.match(/^data: (.*)$/m)?.[1] || '{}');
        seen.push(ev);
        if (ev === 'text') text += data.text;
        if (ev === 'confirm') {
          assert.equal(data.name, 'send_email');
          await api('/api/assistant/confirm', { method: 'POST', body: { requestId: data.requestId, approved: true, input: { body: 'See you at noon! (edited)' } } });
        }
      }
    }
    assert.ok(seen.includes('thinking') && seen.includes('tool_start') && seen.includes('confirm') && seen.includes('done'), seen.join(','));
    assert.match(text, /Added and emailed/);
    const events = await api('/api/events?start=2026-11-10&end=2026-11-11');
    const lunch = events.find((e) => e.title === 'Lunch with Sam');
    assert.ok(lunch);
    assert.equal(lunch.account, 'Personal');
    assert.equal(lunch.createdBy, 'claude (app)');
    const mail = smtp.received.find((m) => m.raw.toString().includes('Subject: Lunch Tuesday'));
    assert.ok(mail, 'email was sent after approval');
    assert.match(mail.raw.toString(), /\(edited\)/);
    // The request to Claude used the intended settings.
    const req = claude.requests.find((r) => r.body.stream);
    assert.equal(req.body.model, 'claude-opus-5-5');
    assert.deepEqual(req.body.thinking, { type: 'adaptive', display: 'summarized' });
    assert.equal(req.body.output_config.effort, 'medium');
    assert.equal(req.body.fallbacks, 'default');
    assert.match(String(req.headers['anthropic-beta']), /server-side-fallback-2026-07-01/);
    assert.ok(req.body.tools.every((tl) => tl.eager_input_streaming === true));
    assert.deepEqual(req.body.cache_control, { type: 'ephemeral' });
    // Conversation history is append-only and replayed intact (thinking blocks included).
    const later = claude.requests[claude.requests.length - 1].body.messages;
    assert.ok(later.some((m) => m.role === 'assistant' && m.content.some((b) => b.type === 'thinking' && b.signature === 'sig')));
    const activity = await api('/api/activity');
    assert.ok(activity.some((a) => a.actor === 'claude (app)' && a.action === 'mail.send'));
  });

  await t.test('declining a send leaves nothing sent', async () => {
    const before = smtp.received.length;
    const res = await fetch(`${base}/api/assistant/chat`, { method: 'POST', headers: { 'X-Switchboard-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Again please' }) });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const ev = chunk.match(/^event: (.*)$/m)?.[1];
        const data = JSON.parse(chunk.match(/^data: (.*)$/m)?.[1] || '{}');
        if (ev === 'text') text += data.text;
        if (ev === 'confirm') await api('/api/assistant/confirm', { method: 'POST', body: { requestId: data.requestId, approved: false } });
      }
    }
    assert.match(text, /Not sent/);
    assert.equal(smtp.received.length, before);
  });

  await t.test('the local API refuses requests without the token or from other hosts', async () => {
    assert.equal((await fetch(`${base}/api/accounts`)).status, 401);
    assert.equal((await fetch(`${base}/mcp`, { method: 'POST', body: '{}' })).status, 401);
    const evil = await new Promise((resolve) => {
      const s = net.connect(PORT, '127.0.0.1', () => s.write(`GET /api/health HTTP/1.1\r\nHost: evil.example:${PORT}\r\nConnection: close\r\n\r\n`));
      let d = '';
      s.on('data', (c) => (d += c));
      s.on('end', () => resolve(d));
    });
    assert.match(evil, /^HTTP\/1\.1 421/);
  });
});
