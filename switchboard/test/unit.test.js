import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import '../src/quiet.js';

process.env.SWITCHBOARD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-unit-'));

const time = await import('../src/time.js');
const ics = await import('../src/ics.js');
const mu = await import('../src/mailutil.js');
const db = await import('../src/db.js');
db.openDb();
db.setSetting('timeZone', 'America/New_York');
const cal = await import('../src/calendar.js');
const mail = await import('../src/mail.js');
const tools = await import('../src/claude/tools.js');
const crypto = await import('../src/crypto.js');

test('wall time in a zone converts to the right UTC instant, across DST', () => {
  assert.equal(time.parseDateTime('2026-11-12T14:30', 'America/New_York').toISOString(), '2026-11-12T19:30:00.000Z'); // EST
  assert.equal(time.parseDateTime('2026-07-01T09:00', 'America/New_York').toISOString(), '2026-07-01T13:00:00.000Z'); // EDT
  assert.equal(time.parseDateTime('2026-11-12', 'Europe/London').toISOString(), '2026-11-12T00:00:00.000Z');
  assert.equal(time.parseDateTime('2026-11-12T14:30:00-08:00', 'America/New_York').toISOString(), '2026-11-12T22:30:00.000Z');
  assert.equal(time.parseDateTime('2026-11-12T14:30Z', 'Asia/Tokyo').toISOString(), '2026-11-12T14:30:00.000Z');
  // The day DST ends (Nov 1 2026 in the US): 1:30 AM happens twice; we pick a valid instant.
  const ambiguous = time.parseDateTime('2026-11-01T01:30', 'America/New_York');
  assert.ok(['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z'].includes(ambiguous.toISOString()));
  assert.equal(time.toZonedIso(new Date('2026-11-12T19:30:00Z'), 'America/New_York'), '2026-11-12T14:30:00-05:00');
  assert.equal(time.normalizeTimeZone('Eastern Standard Time'), 'America/New_York');
  assert.equal(time.addDaysToDate('2026-12-31', 1), '2027-01-01');
});

test('iCalendar: parses invitations, folded lines, escapes, Windows zones and all-day events', () => {
  const text = [
    'BEGIN:VCALENDAR', 'METHOD:REQUEST', 'BEGIN:VEVENT', 'UID:abc@x', 'SUMMARY:Planning\\, Q1', 'DESCRIPTION:Line one\\nLine two with a very long',
    '  continuation', 'DTSTART;TZID=Eastern Standard Time:20261112T140000', 'DTEND;TZID=Eastern Standard Time:20261112T150000',
    'LOCATION:Room 4', 'ORGANIZER;CN=Dana Lee:mailto:dana@acme.co', 'ATTENDEE;PARTSTAT=NEEDS-ACTION;CN=Me:mailto:me@x.com',
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'END:VALARM', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:allday@x', 'SUMMARY:Holiday', 'DTSTART;VALUE=DATE:20261126', 'DTEND;VALUE=DATE:20261127', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const { method, events } = ics.parseIcs(text, { tz: 'America/New_York' });
  assert.equal(method, 'REQUEST');
  const e = events.find((x) => x.uid === 'abc@x');
  assert.equal(e.title, 'Planning, Q1');
  assert.equal(e.description, 'Line one\nLine two with a very long continuation');
  assert.equal(e.start, '2026-11-12T19:00:00.000Z');
  assert.equal(e.organizer, 'dana@acme.co');
  assert.equal(e.reminder_minutes, 15);
  assert.equal(e.attendees[0].email, 'me@x.com');
  const h = events.find((x) => x.uid === 'allday@x');
  assert.equal(h.all_day, true);
  assert.equal(h.start_date, '2026-11-26');
  assert.equal(h.end_date, '2026-11-27');
});

test('iCalendar: expands weekly/monthly recurrences with exceptions, keeping local time across DST', () => {
  const text = [
    'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:w@x', 'SUMMARY:Standup', 'DTSTART;TZID=America/New_York:20261026T093000', 'DTEND;TZID=America/New_York:20261026T094500',
    'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6', 'EXDATE;TZID=America/New_York:20261028T093000', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:m@x', 'SUMMARY:Last Friday', 'DTSTART;TZID=America/New_York:20261030T160000', 'DURATION:PT1H', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20270201T000000Z', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const { events } = ics.parseIcs(text, { tz: 'America/New_York', from: new Date('2026-10-01T00:00:00Z'), to: new Date('2027-03-01T00:00:00Z') });
  const standups = events.filter((x) => x.uid === 'w@x').map((x) => time.toZonedIso(new Date(x.start), 'America/New_York'));
  assert.deepEqual(standups, ['2026-10-26T09:30:00-04:00', '2026-11-02T09:30:00-05:00', '2026-11-04T09:30:00-05:00', '2026-11-09T09:30:00-05:00', '2026-11-11T09:30:00-05:00']);
  const fridays = events.filter((x) => x.uid === 'm@x').map((x) => time.localDate(new Date(x.start), 'America/New_York'));
  assert.deepEqual(fridays, ['2026-10-30', '2026-11-27', '2026-12-25', '2027-01-29']);
});

test('iCalendar round-trip: what we generate, we can read back', () => {
  const out = ics.buildIcs([{ uid: 'r@x', title: 'Dinner; with, friends', start: '2026-11-20T23:00:00Z', end: '2026-11-21T01:00:00Z', location: 'Home', attendees: [{ email: 'a@b.com', name: 'A' }], reminder_minutes: 30 }], { method: 'REQUEST', organizer: { email: 'me@x.com' } });
  const { events, method } = ics.parseIcs(out, { tz: 'UTC' });
  assert.equal(method, 'REQUEST');
  assert.equal(events[0].title, 'Dinner; with, friends');
  assert.equal(events[0].start, '2026-11-20T23:00:00.000Z');
  assert.equal(events[0].reminder_minutes, 30);
  assert.ok(out.split('\r\n').every((l) => Buffer.byteLength(l) <= 75));
});

test('address lists, threading and subjects', () => {
  assert.deepEqual(mu.parseAddressList('"Lee, Dana" <dana@acme.co>, bob@x.com; Ann <ann@y.org>'), [
    { name: 'Lee, Dana', address: 'dana@acme.co' },
    { name: '', address: 'bob@x.com' },
    { name: 'Ann', address: 'ann@y.org' },
  ]);
  assert.equal(mu.threadKeyFor({ references: '<a@x> <b@x>', inReplyTo: '<b@x>', messageId: '<c@x>' }), '<a@x>');
  assert.equal(mu.threadKeyFor({ messageId: 'C@X' }), '<c@x>');
  assert.equal(mu.normalizeSubject('RE: Fwd: re: Budget'), 'budget');
  assert.ok(mu.isValidEmail('a.b+c@sub.example.com'));
  assert.ok(!mu.isValidEmail('not an email'));
});

test('email HTML is stripped of active content; text converts to safe HTML', () => {
  const dirty = '<p onclick="steal()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><iframe src="https://evil"></iframe><img src=x onerror=alert(1)>';
  const clean = mu.sanitizeHtml(dirty);
  assert.ok(!/script|onclick|onerror|javascript:|iframe/i.test(clean), clean);
  const html = mu.textToHtml('Hello **Dana**\n- one\n- two\n<b>not bold</b> https://example.com');
  assert.match(html, /<strong>Dana<\/strong>/);
  assert.match(html, /<ul>\n<li>one<\/li>/);
  assert.match(html, /&lt;b&gt;not bold&lt;\/b&gt;/);
  assert.match(html, /<a href="https:\/\/example.com">/);
  assert.equal(mu.htmlToText('<p>A&amp;B</p><br><ul><li>x</li></ul>'), 'A&B\n\n• x');
});

test('secrets are encrypted at rest and decrypt back', () => {
  const enc = crypto.encrypt({ password: 'hunter2' });
  assert.ok(!enc.includes('hunter2'));
  assert.deepEqual(crypto.decrypt(enc), { password: 'hunter2' });
});

test('search syntax is parsed like Gmail/Outlook', () => {
  const q = mail.parseQuery('from:dana "lease renewal" has:attachment is:unread after:2026-10-01 in:inbox account:work');
  assert.deepEqual(q.from, ['dana']);
  assert.deepEqual(q.words, ['lease', 'renewal']);
  assert.ok(q.flags.attachment && q.flags.unread);
  assert.equal(q.after.toISOString(), '2026-10-01T04:00:00.000Z');
  assert.equal(q.in, 'inbox');
  assert.equal(q.account, 'work');
});

test('event input: all-day end dates are inclusive, durations default sensibly, bad input is rejected', () => {
  const a = cal.normalizeEventInput({ title: 'Trip', start: '2026-11-16', end: '2026-11-18' });
  assert.equal(a.all_day, true);
  assert.equal(a.start_date, '2026-11-16');
  assert.equal(a.end_date, '2026-11-19'); // stored exclusive
  const t = cal.normalizeEventInput({ title: 'Call', start: '2026-11-12T09:00' });
  assert.equal(t.start, '2026-11-12T14:00:00.000Z');
  assert.equal(t.end, '2026-11-12T15:00:00.000Z');
  const d = cal.normalizeEventInput({ title: 'Quick', start: '2026-11-12T09:00', duration_minutes: 15 });
  assert.equal(d.end, '2026-11-12T14:15:00.000Z');
  assert.throws(() => cal.normalizeEventInput({ title: 'x', start: '2026-11-12T10:00', end: '2026-11-12T09:00' }), /after the start/);
  assert.throws(() => cal.normalizeEventInput({ title: 'x', start: 'next tuesday-ish' }), /Could not understand/);
});

test('master calendar: create on a local calendar, detect conflicts, find free time', async () => {
  const r1 = await cal.createEvent({ title: 'Standup', start: '2026-11-12T09:30', duration_minutes: 30 });
  const r2 = await cal.createEvent({ title: 'Review', start: '2026-11-12T09:45', end: '2026-11-12T11:00' });
  assert.equal(r2.conflicts.length, 1);
  assert.equal(r2.conflicts[0].title, 'Standup');
  const slots = cal.findFreeTime({ from: '2026-11-12', to: '2026-11-13', durationMinutes: 60 });
  assert.equal(slots[0].start, '2026-11-12T11:00:00-05:00');
  assert.equal(slots[0].end, '2026-11-12T17:00:00-05:00');
  const moved = await cal.updateEvent(r1.event.id, { start: '2026-11-12T13:00' });
  assert.equal(moved.event.startLocal, '2026-11-12T13:00:00-05:00');
  assert.equal(moved.event.endLocal, '2026-11-12T13:30:00-05:00'); // duration kept
  const listed = cal.listEvents({ from: '2026-11-12', to: '2026-11-13' });
  assert.deepEqual(listed.map((e) => e.title), ['Review', 'Standup']);
  await cal.deleteEvent(r2.event.id);
  assert.equal(cal.listEvents({ from: '2026-11-12', to: '2026-11-13' }).length, 1);
});

test('tool inputs are validated and lightly coerced before anything runs', () => {
  const t = tools.findTool('update_emails');
  assert.deepEqual(tools.validateInput(t, { ids: '3, 4', action: 'flag' }), { ids: [3, 4], action: 'flag' });
  assert.throws(() => tools.validateInput(t, { ids: [1], action: 'explode' }), /must be one of/);
  assert.throws(() => tools.validateInput(t, { action: 'flag' }), /Missing required field "ids"/);
  const ce = tools.findTool('create_event');
  assert.throws(() => tools.validateInput(ce, { title: 'x', start: 5 }), /should be string/);
  assert.equal(tools.TOOLS.length, 20);
  for (const tool of tools.TOOLS) {
    assert.equal(tool.input_schema.type, 'object');
    assert.ok(tool.description.length > 30, tool.name);
  }
});
