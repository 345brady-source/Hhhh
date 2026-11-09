// Repeating events, mail rules, reminders and scheduled send — no external servers needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import '../src/quiet.js';

process.env.SWITCHBOARD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-feat-'));
const db = await import('../src/db.js');
db.openDb();
db.setSetting('timeZone', 'America/New_York');
const rec = await import('../src/recurrence.js');
const cal = await import('../src/calendar.js');
const accounts = await import('../src/accounts.js');
const store = await import('../src/store.js');
const mail = await import('../src/mail.js');
const rules = await import('../src/rules.js');
const tools = await import('../src/claude/tools.js');
const { startSmtp } = await import('./helpers/servers.js');

test('recurrence: friendly input becomes RRULEs, descriptions and Microsoft patterns', () => {
  const start = '2026-11-10T15:00:00.000Z'; // Tue 10:00 New York
  assert.equal(rec.toRRule({ frequency: 'weekly' }, { start, tz: 'America/New_York' }), 'FREQ=WEEKLY;BYDAY=TU');
  assert.equal(rec.toRRule({ frequency: 'weekdays', until: '2026-12-31' }, { start, tz: 'America/New_York' }), 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261231T235959Z');
  assert.equal(rec.toRRule({ frequency: 'monthly', days: ['-1fri'], count: 6 }, { start }), 'FREQ=MONTHLY;BYDAY=-1FR;COUNT=6');
  assert.equal(rec.toRRule({ frequency: 'weekly', interval: 2, days: ['monday', 'Thursday'] }, { start }), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH');
  assert.throws(() => rec.toRRule({ frequency: 'hourly' }, { start }), /frequency/);
  assert.equal(rec.describeRRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'), 'Every weekday');
  assert.equal(rec.describeRRule('FREQ=MONTHLY;BYDAY=-1FR;COUNT=6'), 'Monthly on the last Friday, 6 times');
  assert.equal(rec.describeRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20270101T000000Z'), 'Every 2 weeks on Monday, Thursday, until 2027-01-01');
  assert.deepEqual(rec.toGraphRecurrence('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10', start, 'America/New_York'), {
    pattern: { type: 'weekly', interval: 1, daysOfWeek: ['monday', 'wednesday'], firstDayOfWeek: 'sunday' },
    range: { type: 'numbered', startDate: '2026-11-10', numberOfOccurrences: 10, recurrenceTimeZone: 'Eastern Standard Time' },
  });
  assert.equal(rec.toGraphRecurrence('FREQ=MONTHLY;BYDAY=-1FR', start, 'America/New_York').pattern.index, 'last');
  assert.equal(rec.toGraphRecurrence('FREQ=YEARLY', start, 'America/New_York').pattern.type, 'absoluteYearly');
});

test('repeating events on a local calendar: create, change one, change all, change the pattern, delete', async () => {
  const r = await cal.createEvent({ title: 'Piano', start: '2026-11-10T16:00', duration_minutes: 45, recurrence: { frequency: 'weekly', count: 4 } });
  assert.equal(r.event.repeats, 'Weekly on Tuesday, 4 times');
  const list = () => cal.listEvents({ from: '2026-11-01', to: '2027-01-01' }).filter((e) => /Piano/.test(e.title));
  assert.deepEqual(list().map((e) => e.startLocal.slice(0, 16)), ['2026-11-10T16:00', '2026-11-17T16:00', '2026-11-24T16:00', '2026-12-01T16:00']);
  // DST does not move a local series (Nov 1 is already past; check the offset stays -05:00 in December)
  assert.match(list()[3].startLocal, /-05:00$/);
  await cal.updateEvent(list()[1].id, { title: 'Piano (recital)', location: 'Hall' });
  assert.deepEqual(list().map((e) => e.title), ['Piano', 'Piano (recital)', 'Piano', 'Piano']);
  await cal.updateEvent(list()[0].id, { start: '2026-11-10T17:00', scope: 'series' });
  assert.ok(list().every((e) => e.startLocal.slice(11, 16) === '17:00'));
  assert.ok(list().every((e) => e.endLocal.slice(11, 16) === '17:45'));
  await cal.updateEvent(list()[0].id, { recurrence: { frequency: 'weekly', count: 2 }, scope: 'series' });
  assert.equal(list().length, 2);
  await cal.deleteEvent(list()[1].id); // just one
  assert.equal(list().length, 1);
  const tool = await tools.runTool('create_event', { title: 'Standup', start: '2026-11-16T09:30', duration_minutes: 15, recurrence: { frequency: 'weekdays', count: 5 } }, { actor: 'claude (app)' });
  assert.equal(tool.created.repeats, 'Every weekday, 5 times');
  const standup = cal.listEvents({ from: '2026-11-16', to: '2026-11-23' }).filter((e) => e.title === 'Standup');
  assert.equal(standup.length, 5);
  await tools.runTool('delete_event', { id: standup[2].id, scope: 'series' }, { actor: 'claude (app)' });
  assert.equal(cal.listEvents({ from: '2026-11-16', to: '2026-11-23' }).filter((e) => e.title === 'Standup').length, 0);
});

test('reminders fire once when their time comes', async () => {
  const soon = new Date(Date.now() + 10 * 60_000);
  const r = await cal.createEvent({ title: 'Call Dana', start: soon.toISOString(), duration_minutes: 30, reminder_minutes: 15 });
  const due = cal.dueReminders();
  assert.ok(due.some((x) => x.id === r.event.id && x.minutes >= 9 && x.minutes <= 10));
  assert.ok(!cal.dueReminders().some((x) => x.id === r.event.id), 'not repeated');
  const later = await cal.createEvent({ title: 'Later', start: new Date(Date.now() + 3 * 3600_000).toISOString(), reminder_minutes: 15 });
  assert.ok(!cal.dueReminders().some((x) => x.id === later.event.id));
});

test('mail rules: match conditions and act on new mail (POP3 account, all local)', async () => {
  const a = accounts.createAccount({ type: 'pop3', email: 'me@pop.test', config: { popHost: '127.0.0.1', popPort: 1, smtpHost: '127.0.0.1', smtpPort: 1 }, secrets: { password: 'x' } });
  store.syncFolderList(a.id, await accounts.providerFor(a.id).listFolders());
  const inbox = store.folderByRole(a.id, 'inbox');
  const ins = store.upsertMessages(a.id, inbox.id, [
    { remote_id: 'u1', subject: 'Your weekly digest', from: { name: 'Shop', address: 'news@shop.com' }, to: [{ address: 'me@pop.test' }], date: new Date().toISOString(), snippet: 'Deals' },
    { remote_id: 'u2', subject: 'Invoice 42', from: { name: 'Billing', address: 'billing@vendor.com' }, to: [{ address: 'me@pop.test' }], date: new Date().toISOString(), snippet: 'Amount due', has_attachments: true },
    { remote_id: 'u3', subject: 'Hello', from: { name: 'Ana', address: 'ana@friends.org' }, to: [{ address: 'me@pop.test' }], date: new Date().toISOString(), snippet: 'Lunch?' },
  ]);
  const ids = ins.map((x) => x.id);
  const r1 = rules.saveRule({ name: 'News', conditions: [{ field: 'from', op: 'contains', value: 'news@' }], actions: [{ type: 'move', folder: 'Newsletters' }, { type: 'mark_read' }] });
  assert.equal(r1.summary, 'If from contains “news@”, move it to Newsletters, mark it read.');
  rules.saveRule({ name: 'Bills', match: 'all', conditions: [{ field: 'subject', value: 'invoice' }, { field: 'has_attachment' }], actions: [{ type: 'flag' }], stop: true });
  rules.saveRule({ name: 'Never', conditions: [{ field: 'from', op: 'ends_with', value: '@nowhere.net' }], actions: [{ type: 'delete' }] });
  assert.throws(() => rules.saveRule({ name: 'Bad', conditions: [], actions: [{ type: 'flag' }] }), /condition/);
  assert.throws(() => rules.saveRule({ name: 'Bad', conditions: [{ field: 'from', value: 'x' }], actions: [{ type: 'forward', to: 'nope' }] }), /address/);
  const out = await rules.applyRules(ids);
  assert.equal(out.applied, 3);
  const news = store.foldersOf(a.id).find((f) => f.name === 'Newsletters');
  assert.ok(news, 'folder created on demand');
  assert.deepEqual(mail.listMessages({ folderId: news.id }).messages.map((m) => [m.subject, m.seen]), [['Your weekly digest', true]]);
  const left = mail.listMessages({ folderId: inbox.id }).messages;
  assert.deepEqual(left.map((m) => [m.subject, m.flagged]).sort(), [['Hello', false], ['Invoice 42', true]]);
  // Claude manages rules through tools too.
  const t = await tools.runTool('create_rule', { name: 'Friends', conditions: [{ field: 'from', op: 'ends_with', value: '@friends.org' }], actions: [{ type: 'flag' }], apply_to_existing: true }, { actor: 'claude (mcp)' });
  assert.equal(t.ran_on_existing.applied, 1);
  assert.equal((await tools.runTool('list_rules', {}, { actor: 'claude (mcp)' })).length, 4);
  await tools.runTool('delete_rule', { id: t.created.id }, { actor: 'claude (mcp)' });
  assert.equal(rules.listRules().length, 3);
});

test('scheduled send: queued, sent when due, can be canceled or turned back into a draft', async (t) => {
  const smtp = await startSmtp(10596);
  t.after(() => smtp.close());
  const a = accounts.createAccount({ type: 'pop3', email: 'sched@pop.test', config: { popHost: '127.0.0.1', popPort: 1, smtpHost: '127.0.0.1', smtpPort: 10596, smtpSecurity: 'none', smtpNoAuth: true }, secrets: { password: 'x' } });
  store.syncFolderList(a.id, await accounts.providerFor(a.id).listFolders());
  const s = await tools.runTool('send_email', { from_account: 'sched@pop.test', to: ['dana@example.com'], subject: 'Tomorrow', body: 'Morning!', send_at: new Date(Date.now() + 86400_000).toISOString() }, { actor: 'claude (app)' });
  assert.equal(s.scheduled, true);
  assert.equal(mail.counts().scheduled, 1);
  assert.equal((await mail.processOutbox()).sent, 0, 'not due yet');
  db.run('UPDATE outbox SET send_at = ? WHERE id = ?', new Date(Date.now() - 1000).toISOString(), s.id);
  assert.equal((await mail.processOutbox()).sent, 1);
  assert.ok(smtp.received.some((m) => m.to.includes('dana@example.com') && m.raw.toString().includes('Subject: Tomorrow')));
  assert.equal(mail.counts().scheduled, 0);
  const sent = store.folderByRole(a.id, 'sent');
  assert.equal(mail.listMessages({ folderId: sent.id }).messages.length, 1);
  const s2 = await mail.sendMessage({ accountId: a.id, to: 'x@example.com', subject: 'Cancel me', text: '…', sendAt: new Date(Date.now() + 3600_000).toISOString() });
  await tools.runTool('cancel_scheduled_email', { id: s2.id }, { actor: 'claude (app)' });
  assert.equal(mail.listOutbox().length, 0);
  const s3 = await mail.sendMessage({ accountId: a.id, to: 'y@example.com', subject: 'Edit me', text: 'draft body', sendAt: new Date(Date.now() + 3600_000).toISOString() });
  const d = mail.outboxToDraft(s3.id);
  assert.equal(d.subject, 'Edit me');
  assert.equal(mail.listOutbox().length, 0);
  await assert.rejects(mail.sendMessage({ accountId: a.id, to: 'z@example.com', subject: 'x', text: 'x', sendAt: 'someday' }), /send time/);
});
