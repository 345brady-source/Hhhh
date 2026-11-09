// CalDAV against a real server (Radicale on 127.0.0.1:5232; see test/setup-servers.sh). Skips if it isn't running.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import '../src/quiet.js';

process.env.SWITCHBOARD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-caldav-'));
const up = await new Promise((r) => {
  const s = net.connect(5232, '127.0.0.1');
  s.once('connect', () => { s.destroy(); r(true); });
  s.once('error', () => r(false));
});

const BASE = 'http://127.0.0.1:5232';
const auth = { Authorization: `Basic ${Buffer.from('user3:pass3').toString('base64')}` };

async function freshCalendar(name) {
  const url = `${BASE}/user3/${name}/`;
  await fetch(url, { method: 'DELETE', headers: auth });
  const r = await fetch(url, { method: 'MKCALENDAR', headers: { ...auth, 'Content-Type': 'application/xml' }, body: `<?xml version="1.0"?><C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/"><D:set><D:prop><D:displayname>${name}</D:displayname><A:calendar-color>#ff9500ff</A:calendar-color></D:prop></D:set></C:mkcalendar>` });
  assert.equal(r.status, 201);
  return url;
}

test('CalDAV: discover calendars, sync both ways, repeating events, exceptions, conflicts', { skip: !up && 'Radicale not running' }, async (t) => {
  await fetch(`${BASE}/user3/`, { method: 'PROPFIND', headers: { ...auth, Depth: '0' } }); // creates the principal
  const homeUrl = await freshCalendar('home');
  await freshCalendar('work');
  const db = await import('../src/db.js');
  db.openDb();
  db.setSetting('timeZone', 'America/New_York');
  const accounts = await import('../src/accounts.js');
  const cal = await import('../src/calendar.js');
  const sync = await import('../src/sync.js');
  const tools = await import('../src/claude/tools.js');

  const test1 = await accounts.testSettings({ type: 'caldav', email: 'user3', config: { caldavUrl: `${BASE}/`, caldavUser: 'user3' }, secrets: { password: 'pass3' } });
  assert.deepEqual(test1.calendar, { ok: true, calendars: 2 });
  const bad = await accounts.testSettings({ type: 'caldav', email: 'user3', config: { caldavUrl: `${BASE}/`, caldavUser: 'user3' }, secrets: { password: 'wrong' } });
  assert.equal(bad.calendar.ok, false);
  assert.match(bad.calendar.error, /password/i);

  const a = accounts.createAccount({ type: 'caldav', email: 'user3@cal.test', label: 'Nextcloud', config: { caldavUrl: `${BASE}/`, caldavUser: 'user3' }, secrets: { password: 'pass3' } });
  await sync.syncAccount(a.id);
  assert.equal(accounts.getAccount(a.id).status, 'ok', accounts.getAccount(a.id).lastError);
  const cals = cal.listCalendars().filter((c) => c.accountId === a.id);
  assert.deepEqual(cals.map((c) => c.name).sort(), ['home', 'work']);
  // The main calendar takes the account's color; others keep the color set on the server.
  assert.equal(cals.find((c) => c.name === 'home').isPrimary, true);
  assert.equal(cals.find((c) => c.name === 'work').color, '#ff9500');
  const home = cals.find((c) => c.name === 'home');

  await t.test('events created elsewhere appear after sync', async () => {
    const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//EN\r\nBEGIN:VEVENT\r\nUID:ext-1\r\nDTSTAMP:20261101T000000Z\r\nDTSTART;TZID=America/New_York:20261118T120000\r\nDTEND;TZID=America/New_York:20261118T130000\r\nSUMMARY:Lunch (from phone)\r\nLOCATION:Cafe\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
    assert.equal((await fetch(`${homeUrl}ext-1.ics`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'text/calendar' }, body: ics })).status, 201);
    await sync.syncAccount(a.id);
    const e = cal.listEvents({ from: '2026-11-18', to: '2026-11-19' }).find((x) => x.title === 'Lunch (from phone)');
    assert.ok(e);
    assert.equal(e.startLocal, '2026-11-18T12:00:00-05:00');
    assert.equal(e.location, 'Cafe');
  });

  await t.test('repeating event: create, move one, shift the series, delete one, delete all', async () => {
    const r = await cal.createEvent({ title: 'Yoga', start: '2026-11-10T07:00', duration_minutes: 60, calendarId: home.id, recurrence: { frequency: 'weekly', days: ['TU', 'TH'], count: 6 } });
    assert.equal(r.event.repeats, 'Weekly on Tuesday, Thursday, 6 times');
    const yoga = () => cal.listEvents({ from: '2026-11-01', to: '2027-01-01' }).filter((e) => e.title === 'Yoga');
    assert.equal(yoga().length, 6);
    const third = yoga()[2];
    const moved = await cal.updateEvent(third.id, { start: '2026-11-17T18:00' });
    assert.equal(moved.event.startLocal, '2026-11-17T18:00:00-05:00');
    assert.equal(moved.event.recurring, false);
    await cal.updateEvent(yoga().find((e) => e.recurring).id, { start: '2026-11-10T08:00', scope: 'series' });
    assert.deepEqual(yoga().map((e) => e.startLocal.slice(5, 16)), ['11-10T08:00', '11-12T08:00', '11-17T18:00', '11-19T08:00', '11-24T08:00', '11-26T08:00']);
    await cal.deleteEvent(yoga()[1].id);
    assert.equal(yoga().length, 5);
    await cal.deleteEvent(yoga().find((e) => e.recurring).id, 'you', { scope: 'series' });
    assert.deepEqual(yoga().map((e) => e.startLocal.slice(5, 16)), ['11-17T18:00']);
    // What the server has matches what we show.
    await sync.syncAccount(a.id);
    assert.equal(yoga().length, 1);
  });

  await t.test('all-day events and Claude tools work on CalDAV calendars', async () => {
    const r = await tools.runTool('create_event', { title: 'Offsite', start: '2026-12-03', end: '2026-12-04', calendar: 'Nextcloud' }, { actor: 'claude (mcp)' });
    assert.equal(r.created.all_day, true);
    assert.match(r.created.calendar, /^Nextcloud · home/);
    await sync.syncAccount(a.id);
    const e = cal.listEvents({ from: '2026-12-01', to: '2026-12-10' }).find((x) => x.title === 'Offsite');
    assert.deepEqual([e.startDate, e.endDate], ['2026-12-03', '2026-12-04']);
  });

  await t.test('a change made on the server since the last sync is not overwritten', async () => {
    const r = await cal.createEvent({ title: 'Review', start: '2026-11-20T15:00', calendarId: home.id });
    const row = db.get('SELECT href, etag FROM events WHERE id = ?', r.event.id);
    // Someone edits it on their phone.
    const cur = await fetch(row.href, { headers: auth }).then((x) => x.text());
    await fetch(row.href, { method: 'PUT', headers: { ...auth, 'Content-Type': 'text/calendar' }, body: cur.replace('SUMMARY:Review', 'SUMMARY:Review (phone)') });
    // Our update uses the stale etag only for deletes; edits re-read first, so they apply on top of the latest version.
    const u = await cal.updateEvent(r.event.id, { location: 'Room 2' });
    assert.equal(u.event.title, 'Review (phone)');
    assert.equal(u.event.location, 'Room 2');
    // Deleting with a stale etag is refused rather than discarding someone else's change.
    const stale = db.get('SELECT * FROM events WHERE id = ?', u.event.id);
    const latest = await fetch(stale.href, { headers: auth }).then((x) => x.text());
    await fetch(stale.href, { method: 'PUT', headers: { ...auth, 'Content-Type': 'text/calendar' }, body: latest.replace('Room 2', 'Room 3') });
    await assert.rejects(cal.deleteEvent(u.event.id), /changed on the server/);
  });
});
