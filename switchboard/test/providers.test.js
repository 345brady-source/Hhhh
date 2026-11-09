// Gmail / Google Calendar and Microsoft Graph providers, exercised against mocked HTTP responses
// shaped like the documented APIs. (Live accounts need OAuth app registrations; see README.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import '../src/quiet.js';

process.env.SWITCHBOARD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-prov-'));
const db = await import('../src/db.js');
db.openDb();
db.setSetting('timeZone', 'America/New_York');
const accounts = await import('../src/accounts.js');
const sync = await import('../src/sync.js');
const store = await import('../src/store.js');
const cal = await import('../src/calendar.js');
const mail = await import('../src/mail.js');

const realFetch = globalThis.fetch;
let routes = [];
const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const method = opts.method || 'GET';
  calls.push({ method, url: u, body: opts.body, headers: opts.headers });
  for (const [m, re, handler] of routes) {
    if (m === method && re.test(u)) {
      const out = await handler(u, opts);
      if (out instanceof Response) return out;
      if (out == null) return new Response(null, { status: 204 });
      return new Response(typeof out === 'string' ? out : JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }
  return new Response(JSON.stringify({ error: { message: `unmocked ${method} ${u}` } }), { status: 404 });
};
test.after(() => (globalThis.fetch = realFetch));

const tokens = { accessToken: 'at', refreshToken: 'rt', expiresAt: Date.now() + 3600_000 };
const hdrs = (o) => Object.entries(o).map(([name, value]) => ({ name, value }));

test('Gmail: labels become folders, full sync, then incremental history (adds, read state, deletes)', async () => {
  const meta = {
    m1: { id: 'm1', threadId: 't1', labelIds: ['INBOX', 'UNREAD'], snippet: 'Hello &amp; welcome', internalDate: String(Date.parse('2026-11-08T15:00:00Z')), sizeEstimate: 2000, payload: { headers: hdrs({ From: 'Dana Lee <dana@acme.co>', To: 'me@gmail.com', Subject: 'Welcome', 'Message-ID': '<m1@acme.co>', 'Content-Type': 'multipart/mixed; boundary=x' }) } },
    m2: { id: 'm2', threadId: 't2', labelIds: ['INBOX', 'Label_1', 'STARRED'], snippet: 'Your receipt', internalDate: String(Date.parse('2026-11-07T12:00:00Z')), sizeEstimate: 900, payload: { headers: hdrs({ From: 'shop@store.com', To: 'me@gmail.com', Subject: 'Receipt' }) } },
    m3: { id: 'm3', threadId: 't1', labelIds: ['INBOX', 'UNREAD'], snippet: 'Following up', internalDate: String(Date.parse('2026-11-09T10:00:00Z')), sizeEstimate: 800, payload: { headers: hdrs({ From: 'Dana Lee <dana@acme.co>', To: 'me@gmail.com', Subject: 'Re: Welcome', 'In-Reply-To': '<m1@acme.co>', References: '<m1@acme.co>' }) } },
  };
  let history = null;
  routes = [
    ['GET', /gmail\/v1\/users\/me\/labels$/, () => ({ labels: [
      { id: 'INBOX', name: 'INBOX', type: 'system' }, { id: 'SENT', name: 'SENT', type: 'system' }, { id: 'TRASH', name: 'TRASH', type: 'system' },
      { id: 'SPAM', name: 'SPAM', type: 'system' }, { id: 'DRAFT', name: 'DRAFT', type: 'system' }, { id: 'UNREAD', name: 'UNREAD', type: 'system' },
      { id: 'CATEGORY_SOCIAL', name: 'CATEGORY_SOCIAL', type: 'system' }, { id: 'Label_1', name: 'Receipts', type: 'user' }, { id: 'Label_2', name: 'Receipts/2026', type: 'user' },
    ] })],
    ['GET', /\/profile$/, () => ({ emailAddress: 'me@gmail.com', historyId: '100' })],
    ['GET', /\/messages\?labelIds=INBOX/, () => ({ messages: [{ id: 'm1' }, { id: 'm2' }] })],
    ['GET', /\/messages\?labelIds=Label_1/, () => ({ messages: [{ id: 'm2' }] })],
    ['GET', /\/messages\?labelIds=/, () => ({})],
    ['GET', /\/messages\/(m\d)\?format=metadata/, (u) => meta[u.match(/messages\/(m\d)/)[1]]],
    ['GET', /\/history\?startHistoryId=100/, () => history],
    ['POST', /\/messages\/batchModify$/, () => null],
    ['GET', /calendar\/v3\/users\/me\/calendarList/, () => ({ items: [{ id: 'primary@gmail.com', summary: 'me@gmail.com', primary: true, accessRole: 'owner', backgroundColor: '#9fe1e7' }, { id: 'holidays', summary: 'Holidays', accessRole: 'reader' }] })],
    ['GET', /calendar\/v3\/calendars\/primary%40gmail.com\/events\?/, () => ({ items: [
      { id: 'e1', status: 'confirmed', summary: 'Dentist', start: { dateTime: '2026-11-10T15:00:00-05:00' }, end: { dateTime: '2026-11-10T16:00:00-05:00' }, htmlLink: 'https://calendar.google.com/e1' },
      { id: 'e2', status: 'confirmed', summary: 'Thanksgiving trip', start: { date: '2026-11-26' }, end: { date: '2026-11-29' } },
      { id: 'e3', status: 'cancelled', summary: 'gone', start: { dateTime: '2026-11-10T09:00:00Z' }, end: { dateTime: '2026-11-10T10:00:00Z' } },
    ] })],
    ['GET', /calendar\/v3\/calendars\/holidays\/events\?/, () => ({ items: [] })],
    ['POST', /calendar\/v3\/calendars\/primary%40gmail.com\/events\?/, (u, o) => {
      const b = JSON.parse(o.body);
      return { id: 'new1', status: 'confirmed', summary: b.summary, start: b.start, end: b.end, attendees: b.attendees, hangoutLink: b.conferenceData ? 'https://meet.google.com/abc' : undefined };
    }],
  ];
  const a = accounts.createAccount({ type: 'gmail', email: 'me@gmail.com', secrets: { tokens } });
  await sync.syncAccount(a.id);
  const acc = accounts.getAccount(a.id);
  assert.equal(acc.status, 'ok', acc.lastError);
  const folders = store.foldersOf(a.id);
  assert.deepEqual(folders.map((f) => f.name).sort(), ['2026', 'Drafts', 'Inbox', 'Receipts', 'Sent', 'Spam', 'Trash']);
  const nested = folders.find((f) => f.name === '2026');
  assert.equal(nested.parent_remote_id, 'Label_1');
  const inbox = mail.listMessages({ folderId: store.folderByRole(a.id, 'inbox').id }).messages;
  assert.deepEqual(inbox.map((m) => m.subject), ['Welcome', 'Receipt']);
  assert.equal(inbox[0].snippet, 'Hello & welcome');
  assert.equal(inbox[0].seen, false);
  assert.equal(inbox[0].hasAttachments, true);
  assert.equal(inbox[1].flagged, true);
  // The same Gmail message under two labels shows once in cross-folder views.
  assert.equal(mail.listMessages({ view: 'flagged' }).messages.length, 1);
  // Google Calendar
  const events = cal.listEvents({ from: '2026-11-01', to: '2026-12-01' }).filter((e) => e.accountEmail === 'me@gmail.com');
  assert.deepEqual(events.map((e) => e.title), ['Dentist', 'Thanksgiving trip']);
  assert.equal(events[0].startLocal, '2026-11-10T15:00:00-05:00');
  assert.equal(events[1].allDay, true);
  assert.equal(events[1].endDate, '2026-11-28'); // inclusive last day
  const holidays = cal.listCalendars().find((c) => c.name === 'Holidays');
  assert.equal(holidays.readOnly, true);

  // Incremental: m3 arrives in the thread, m1 is read elsewhere, m2 is deleted.
  meta.m1 = { ...meta.m1, labelIds: ['INBOX'] };
  history = { historyId: '105', history: [{ messagesAdded: [{ message: { id: 'm3' } }] }, { labelsRemoved: [{ message: { id: 'm1' }, labelIds: ['UNREAD'] }] }, { messagesDeleted: [{ message: { id: 'm2' } }] }] };
  await sync.syncAccount(a.id);
  const after = mail.listMessages({ view: 'all', accountId: a.id }).messages;
  assert.deepEqual(after.map((m) => m.subject), ['Re: Welcome', 'Welcome']);
  assert.equal(after[1].seen, true);
  assert.equal(after[0].threadKey, after[1].threadKey);
  assert.equal(store.accountState(a.id).historyId, '105');

  // Flagging calls batchModify with STARRED.
  calls.length = 0;
  await mail.setFlags([after[0].id], { flagged: true });
  const mod = calls.find((c) => c.url.endsWith('/messages/batchModify'));
  assert.deepEqual(JSON.parse(mod.body), { ids: ['m3'], addLabelIds: ['STARRED'], removeLabelIds: [] });

  // Creating a Google event with attendees and a Meet link.
  calls.length = 0;
  const r = await cal.createEvent({ title: 'Kickoff', start: '2026-11-11T13:00', duration_minutes: 30, calendar: 'me@gmail.com', attendees: ['dana@acme.co'], online_meeting: true });
  const post = calls.find((c) => c.method === 'POST' && c.url.includes('/events?'));
  const body = JSON.parse(post.body);
  assert.match(post.url, /sendUpdates=all/);
  assert.match(post.url, /conferenceDataVersion=1/);
  assert.equal(body.start.dateTime, '2026-11-11T18:00:00.000Z');
  assert.equal(body.start.timeZone, 'America/New_York');
  assert.deepEqual(body.attendees, [{ email: 'dana@acme.co' }]);
  assert.equal(r.event.onlineMeetingUrl, 'https://meet.google.com/abc');
  assert.equal(r.event.account, 'me@gmail.com');
});

test('Microsoft Graph: folders with roles, delta sync with paging and removals, calendar, sendMail as MIME', async () => {
  let delta = 0;
  routes = [
    ['GET', /\/me\/mailFolders\/inbox\?/, () => ({ id: 'F-INBOX' })],
    ['GET', /\/me\/mailFolders\/sentitems\?/, () => ({ id: 'F-SENT' })],
    ['GET', /\/me\/mailFolders\/deleteditems\?/, () => ({ id: 'F-DEL' })],
    ['GET', /\/me\/mailFolders\/(drafts|junkemail|archive)\?/, () => new Response('{"error":{"code":"ErrorItemNotFound"}}', { status: 404 })],
    ['GET', /\/me\/mailFolders\?\$top/, () => ({ value: [
      { id: 'F-INBOX', displayName: 'Inbox', childFolderCount: 1 }, { id: 'F-SENT', displayName: 'Sent Items', childFolderCount: 0 }, { id: 'F-DEL', displayName: 'Deleted Items', childFolderCount: 0 },
    ] })],
    ['GET', /\/me\/mailFolders\/F-INBOX\/childFolders/, () => ({ value: [{ id: 'F-PROJ', displayName: 'Projects', childFolderCount: 0 }] })],
    ['GET', /\/me\/mailFolders\/F-INBOX\/messages\/delta/, () => {
      delta++;
      if (delta === 1) return { value: [{ id: 'g1', subject: 'Contract', from: { emailAddress: { name: 'Priya', address: 'priya@contoso.com' } }, toRecipients: [{ emailAddress: { address: 'me@outlook.com' } }], receivedDateTime: '2026-11-08T14:00:00Z', isRead: false, hasAttachments: true, bodyPreview: 'Please sign', conversationId: 'c1', flag: { flagStatus: 'notFlagged' } }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/mailFolders/F-INBOX/messages/delta?$skiptoken=p2' };
      if (delta === 2) return { value: [{ id: 'g2', subject: 'Lunch', from: { emailAddress: { name: 'Tom', address: 'tom@fabrikam.net' } }, receivedDateTime: '2026-11-09T11:00:00Z', isRead: true, bodyPreview: 'Noon?', conversationId: 'c2', flag: { flagStatus: 'flagged' } }], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/mailFolders/F-INBOX/messages/delta?$deltatoken=d1' };
      return { value: [{ id: 'g1', subject: 'Contract', from: { emailAddress: { name: 'Priya', address: 'priya@contoso.com' } }, receivedDateTime: '2026-11-08T14:00:00Z', isRead: true, conversationId: 'c1', flag: { flagStatus: 'flagged' } }, { id: 'g2', '@removed': { reason: 'deleted' } }], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/mailFolders/F-INBOX/messages/delta?$deltatoken=d2' };
    }],
    ['GET', /\/me\/mailFolders\/[^/]+\/messages\/delta/, () => ({ value: [], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/x?$deltatoken=z' })],
    ['GET', /\/me\/calendars\?/, () => ({ value: [{ id: 'CAL1', name: 'Calendar', hexColor: '#0078d4', canEdit: true, isDefaultCalendar: true }] })],
    ['GET', /\/me\/calendars\/CAL1\/calendarView/, () => ({ value: [
      { id: 'ev1', subject: 'Standup', start: { dateTime: '2026-11-10T14:30:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-11-10T14:45:00.0000000', timeZone: 'UTC' }, isAllDay: false, type: 'occurrence', seriesMasterId: 'S1', onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/x' }, isReminderOn: true, reminderMinutesBeforeStart: 15, showAs: 'busy' },
      { id: 'ev2', subject: 'Vacation', start: { dateTime: '2026-12-21T00:00:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-12-24T00:00:00.0000000', timeZone: 'UTC' }, isAllDay: true, showAs: 'oof' },
    ] })],
    ['POST', /\/me\/calendars\/CAL1\/events$/, (u, o) => {
      const b = JSON.parse(o.body);
      return { id: 'evN', subject: b.subject, start: b.isAllDay ? b.start : { dateTime: b.start.dateTime + '0000', timeZone: 'UTC' }, end: b.isAllDay ? b.end : { dateTime: b.end.dateTime + '0000', timeZone: 'UTC' }, isAllDay: b.isAllDay, showAs: 'busy' };
    }],
    ['POST', /\/me\/sendMail$/, () => null],
    ['PATCH', /\/me\/messages\/g1$/, () => ({})],
  ];
  const a = accounts.createAccount({ type: 'microsoft', email: 'me@outlook.com', displayName: 'Me', secrets: { tokens } });
  await sync.syncAccount(a.id);
  assert.equal(accounts.getAccount(a.id).status, 'ok', accounts.getAccount(a.id).lastError);
  const folders = store.foldersOf(a.id);
  assert.deepEqual(folders.map((f) => [f.name, f.role]), [['Inbox', 'inbox'], ['Sent Items', 'sent'], ['Deleted Items', 'trash'], ['Projects', null]]);
  assert.equal(folders.find((f) => f.name === 'Projects').parent_remote_id, 'F-INBOX');
  let inbox = mail.listMessages({ folderId: store.folderByRole(a.id, 'inbox').id }).messages;
  assert.deepEqual(inbox.map((m) => [m.subject, m.seen, m.flagged]), [['Lunch', true, true], ['Contract', false, false]]);
  assert.match(store.folderState(store.folderByRole(a.id, 'inbox')).deltaLink, /deltatoken=d1/);
  // Calendar: occurrence of a series with a Teams link; all-day event keeps its dates.
  const evs = cal.listEvents({ from: '2026-11-01', to: '2027-01-01' }).filter((e) => e.accountEmail === 'me@outlook.com');
  assert.equal(evs[0].title, 'Standup');
  assert.equal(evs[0].startLocal, '2026-11-10T09:30:00-05:00');
  assert.equal(evs[0].recurring, true);
  assert.match(evs[0].onlineMeetingUrl, /teams/);
  assert.equal(evs[1].allDay, true);
  assert.equal(evs[1].startDate, '2026-12-21');
  assert.equal(evs[1].endDate, '2026-12-23');

  // Second delta: g1 read+flagged elsewhere, g2 deleted.
  await sync.syncAccount(a.id);
  inbox = mail.listMessages({ folderId: store.folderByRole(a.id, 'inbox').id }).messages;
  assert.deepEqual(inbox.map((m) => [m.subject, m.seen, m.flagged]), [['Contract', true, true]]);

  // Marking unread PATCHes isRead=false.
  calls.length = 0;
  await mail.setFlags([inbox[0].id], { seen: false });
  assert.deepEqual(JSON.parse(calls.find((c) => c.method === 'PATCH').body), { isRead: false });

  // All-day event creation uses midnight in the user's (Windows-named) zone.
  calls.length = 0;
  await cal.createEvent({ title: 'Offsite', start: '2026-11-19', end: '2026-11-20', calendar: 'me@outlook.com' });
  const body = JSON.parse(calls.find((c) => c.method === 'POST' && c.url.endsWith('/events')).body);
  assert.deepEqual([body.isAllDay, body.start, body.end], [true, { dateTime: '2026-11-19T00:00:00', timeZone: 'Eastern Standard Time' }, { dateTime: '2026-11-21T00:00:00', timeZone: 'Eastern Standard Time' }]);

  // Sending goes through sendMail with a base64 MIME body, keeping threading headers.
  calls.length = 0;
  await mail.sendMessage({ accountId: a.id, to: 'priya@contoso.com', subject: 'Signed', text: 'Attached.' });
  const send = calls.find((c) => c.url.endsWith('/me/sendMail'));
  assert.equal(send.headers['Content-Type'], 'text/plain');
  const mime = Buffer.from(send.body, 'base64').toString();
  assert.match(mime, /Subject: Signed/);
  assert.match(mime, /From: Me <me@outlook.com>/);
});

test('OAuth token refresh: expired tokens are refreshed once and saved; revoked grants flag the account', async () => {
  db.setSetting('googleClientId', 'cid');
  let refreshes = 0;
  routes = [
    ['POST', /oauth2\.googleapis\.com\/token/, (u, o) => {
      refreshes++;
      const p = new URLSearchParams(o.body);
      if (p.get('refresh_token') === 'revoked') return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }), { status: 400 });
      return { access_token: 'fresh', expires_in: 3599 };
    }],
    ['GET', /gmail\/v1\/users\/me\/profile$/, (u, o) => (o.headers.Authorization === 'Bearer fresh' ? { emailAddress: 'r@gmail.com', historyId: '1' } : new Response('{}', { status: 401 }))],
  ];
  const a = accounts.createAccount({ type: 'gmail', email: 'r@gmail.com', secrets: { tokens: { accessToken: 'old', refreshToken: 'rt', expiresAt: Date.now() - 1000 } } });
  const p = accounts.providerFor(a.id);
  await Promise.all([p.test(), p.test(), p.test()]);
  assert.equal(refreshes, 1, 'concurrent calls share one refresh');
  assert.equal(accounts.secretsOf(a.id).tokens.accessToken, 'fresh');
  assert.equal(accounts.secretsOf(a.id).tokens.refreshToken, 'rt');

  const b = accounts.createAccount({ type: 'gmail', email: 'x@gmail.com', secrets: { tokens: { accessToken: 'old', refreshToken: 'revoked', expiresAt: 0 } } });
  await assert.rejects(accounts.providerFor(b.id).test(), /revoked/);
  assert.equal(accounts.getAccount(b.id).status, 'auth_error');
});
