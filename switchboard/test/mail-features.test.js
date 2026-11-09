// Rules on arriving mail and drafts kept on the server, against the Dovecot test server.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import '../src/quiet.js';

process.env.SWITCHBOARD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mf-'));
const up = await new Promise((r) => {
  const s = net.connect(10993, '127.0.0.1');
  s.once('connect', () => { s.destroy(); r(true); });
  s.once('error', () => r(false));
});

test('IMAP: rules sort arriving mail on the server; drafts live in the server Drafts folder', { skip: !up && 'Dovecot test server not running' }, async (t) => {
  const { startSmtp, imapAppend, imapClear, USERS } = await import('./helpers/servers.js');
  const { ImapFlow } = await import('imapflow');
  const { buildRaw } = await import('../src/mailutil.js');
  const db = await import('../src/db.js');
  db.openDb();
  const accounts = await import('../src/accounts.js');
  const sync = await import('../src/sync.js');
  const mail = await import('../src/mail.js');
  const rules = await import('../src/rules.js');
  const store = await import('../src/store.js');
  const smtp = await startSmtp(10595);
  t.after(async () => {
    await accounts.closeAllProviders();
    await smtp.close();
  });
  const imap = async (fn) => {
    const c = new ImapFlow({ host: '127.0.0.1', port: 10993, secure: true, tls: { rejectUnauthorized: false }, auth: { user: 'user7@test.local', pass: USERS['user7@test.local'] }, logger: false });
    await c.connect();
    try {
      return await fn(c);
    } finally {
      await c.logout();
    }
  };
  const inFolder = (box) => imap(async (c) => {
    const list = await c.list();
    if (!list.some((f) => f.path === box)) return [];
    const lock = await c.getMailboxLock(box);
    try {
      return c.mailbox.exists ? (await c.fetchAll('1:*', { envelope: true, flags: true })).map((m) => ({ subject: m.envelope.subject, flags: [...m.flags] })) : [];
    } finally {
      lock.release();
    }
  });
  await imapClear('user7@test.local');
  await imap(async (c) => { for (const f of await c.list()) if (f.path === 'Newsletters') await c.mailboxDelete('Newsletters'); });

  const a = accounts.createAccount({ type: 'imap', email: 'user7@test.local', label: 'Charity', config: { imapHost: '127.0.0.1', imapPort: 10993, imapSecurity: 'ssl', allowSelfSigned: true, smtpHost: '127.0.0.1', smtpPort: 10595, smtpSecurity: 'none' }, secrets: { password: USERS['user7@test.local'] } });
  await sync.syncAccount(a.id);
  assert.equal(accounts.getAccount(a.id).status, 'ok');

  await t.test('a rule moves and marks read new mail, on the server too', async () => {
    rules.saveRule({ name: 'Newsletters', conditions: [{ field: 'from', value: 'newsletter@' }], actions: [{ type: 'move', folder: 'Newsletters' }, { type: 'mark_read' }] });
    rules.saveRule({ name: 'Board', conditions: [{ field: 'body', value: 'board meeting' }], actions: [{ type: 'flag' }] });
    for (const [from, subject, text] of [['Weekly <newsletter@news.org>', 'Issue 12', 'Stories'], ['Chair <chair@charity.org>', 'Agenda', 'The board meeting is Thursday'], ['Ana <ana@x.org>', 'Hi', 'Lunch?']]) {
      const { raw } = await buildRaw({ from, to: 'user7@test.local', subject, text });
      await imapAppend('user7@test.local', raw);
    }
    await sync.syncAccount(a.id, { again: true });
    const news = await inFolder('Newsletters');
    assert.deepEqual(news.map((m) => [m.subject, m.flags.includes('\\Seen')]), [['Issue 12', true]]);
    const inbox = await inFolder('INBOX');
    assert.deepEqual(inbox.map((m) => [m.subject, m.flags.includes('\\Flagged')]).sort(), [['Agenda', true], ['Hi', false]]);
    assert.equal(mail.listMessages({ view: 'unified', accountId: a.id }).messages.length, 2);
  });

  await t.test('drafts are mirrored to the server, replaced on edit, and removed when sent', async () => {
    const d = mail.saveDraft({ accountId: a.id, to: 'board@charity.org', subject: 'Minutes', text: 'v1' });
    await mail.mirrorDraft(d.id);
    mail.saveDraft({ id: d.id, accountId: a.id, to: 'board@charity.org', subject: 'Minutes (final)', text: 'v2' });
    await mail.mirrorDraft(d.id);
    let drafts = await inFolder('Drafts');
    assert.deepEqual(drafts.map((m) => [m.subject, m.flags.includes('\\Draft')]), [['Minutes (final)', true]]);
    await mail.sendDraft(d.id);
    await new Promise((r) => setTimeout(r, 800));
    assert.deepEqual(await inFolder('Drafts'), []);
    assert.ok(smtp.received.some((m) => m.to.includes('board@charity.org') && m.raw.toString().includes('Subject: Minutes (final)')));
  });

  await t.test('a draft started on another device can be continued here', async () => {
    const { raw } = await buildRaw({ from: 'user7@test.local', to: 'donor@x.org', subject: 'Thank you', text: 'Started on my phone' });
    await imapAppend('user7@test.local', raw, 'Drafts', ['\\Draft', '\\Seen']);
    await sync.syncAccount(a.id, { again: true });
    const draftsFolder = store.folderByRole(a.id, 'drafts');
    const msg = mail.listMessages({ folderId: draftsFolder.id }).messages.find((m) => m.subject === 'Thank you');
    assert.ok(msg);
    const local = await mail.draftFromMessage(msg.id);
    assert.equal(local.subject, 'Thank you');
    assert.deepEqual(local.to.map((x) => x.address), ['donor@x.org']);
    assert.match(local.text, /Started on my phone/);
    mail.saveDraft({ ...local, id: local.id, accountId: a.id, text: 'Finished on my computer' });
    await mail.mirrorDraft(local.id);
    const drafts = await inFolder('Drafts');
    assert.equal(drafts.length, 1, 'the phone copy was replaced, not duplicated');
  });
});
