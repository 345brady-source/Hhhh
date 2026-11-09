import { all, get, run, tx, json, getSetting, logActivity } from './db.js';
import { getAccount, listAccounts, calendarProviderFor, hasServerCalendars } from './accounts.js';
import { toRRule, describeRRule, expandLocal } from './recurrence.js';
import { parseIcs, buildIcs } from './ics.js';
import { randomId } from './crypto.js';
import { events } from './bus.js';
import {
  parseDateTime, isDateOnly, localDate, addDaysToDate, toZonedIso, systemTimeZone, isValidTimeZone,
  wallTimeToUtc, zonedParts, startOfLocalDay, describe,
} from './time.js';

export const CAL_COLORS = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626'];

export function userTz() {
  const tz = getSetting('timeZone', '');
  return tz && isValidTimeZone(tz) ? tz : systemTimeZone();
}

function syncWindow() {
  const now = Date.now();
  return { from: new Date(now - 120 * 86400_000), to: new Date(now + 400 * 86400_000) };
}

// Calendars -------------------------------------------------------------------------------------

export function ensureLocalCalendars() {
  if (!get("SELECT id FROM calendars WHERE account_id IS NULL AND kind = 'local'")) {
    run("INSERT INTO calendars(account_id, remote_id, name, color, kind) VALUES(NULL, 'local:default', 'My Calendar', '#0f766e', 'local')");
  }
  // IMAP and POP3 accounts have no calendar on the server; like Outlook, give each a calendar kept on this computer.
  for (const a of listAccounts()) {
    if ((a.type === 'imap' || a.type === 'pop3') && !a.config.caldavUrl && !get('SELECT id FROM calendars WHERE account_id = ?', a.id)) {
      run("INSERT INTO calendars(account_id, remote_id, name, color, kind) VALUES(?, 'local', 'Calendar', ?, 'local')", a.id, a.color);
    }
  }
}

function calendarRow(id) {
  return get('SELECT * FROM calendars WHERE id = ?', id);
}

export function listCalendars() {
  ensureLocalCalendars();
  const accounts = new Map(listAccounts().map((a) => [a.id, a]));
  return all('SELECT * FROM calendars ORDER BY account_id IS NOT NULL, account_id, is_primary DESC, name').map((c) => publicCalendar(c, accounts.get(c.account_id)));
}

function publicCalendar(c, account) {
  return {
    id: c.id,
    name: c.name,
    color: c.color || account?.color || '#64748b',
    kind: c.kind,
    accountId: c.account_id,
    account: account ? account.label : c.kind === 'ics' ? 'Subscribed' : 'On this computer',
    accountEmail: account?.email || null,
    visible: !!c.visible,
    readOnly: !!c.read_only,
    isPrimary: !!c.is_primary,
    url: c.url || null,
    lastError: c.last_error || null,
    isDefault: Number(getSetting('defaultCalendarId', 0)) === c.id,
  };
}

export function updateCalendar(id, patch) {
  const c = calendarRow(id);
  if (!c) throw new Error('Calendar not found');
  run('UPDATE calendars SET name = ?, color = ?, visible = ? WHERE id = ?', patch.name ?? c.name, patch.color ?? c.color, patch.visible == null ? c.visible : patch.visible ? 1 : 0, id);
  return listCalendars().find((x) => x.id === id);
}

export function addLocalCalendar(name, color) {
  const r = run("INSERT INTO calendars(account_id, remote_id, name, color, kind) VALUES(NULL, ?, ?, ?, 'local')", `local:${randomId(6)}`, name || 'Calendar', color || CAL_COLORS[Math.floor(Math.random() * CAL_COLORS.length)]);
  return listCalendars().find((x) => x.id === Number(r.lastInsertRowid));
}

export async function subscribeCalendar(url, name) {
  const u = String(url || '').trim().replace(/^webcal:/i, 'https:');
  if (!/^https?:\/\//i.test(u)) throw new Error('Enter an http(s) or webcal:// calendar address');
  const r = run("INSERT INTO calendars(account_id, remote_id, name, color, kind, url, read_only) VALUES(NULL, ?, ?, ?, 'ics', ?, 1)", `ics:${randomId(6)}`, name || 'Subscribed calendar', CAL_COLORS[Math.floor(Math.random() * CAL_COLORS.length)], u);
  const id = Number(r.lastInsertRowid);
  await refreshSubscription(id);
  return listCalendars().find((x) => x.id === id);
}

export function deleteCalendar(id) {
  const c = calendarRow(id);
  if (!c) return;
  if (c.kind === 'remote') throw new Error('Calendars from an account are removed by hiding them, or by removing the account.');
  if (c.account_id == null && c.kind === 'local' && all("SELECT id FROM calendars WHERE account_id IS NULL AND kind = 'local'").length === 1) {
    throw new Error('Keep at least one calendar on this computer.');
  }
  run('DELETE FROM calendars WHERE id = ?', id);
}

export function resolveCalendar(ref, { writable = true } = {}) {
  const cals = listCalendars().filter((c) => !writable || !c.readOnly);
  if (ref == null || ref === '' || ref === 'default') return defaultCalendar();
  const s = String(ref).trim().toLowerCase();
  const byAccount = (pred) => {
    const matches = cals.filter((c) => c.accountEmail && pred(c));
    return matches.find((c) => c.isPrimary) || matches.find((c) => c.kind === 'local') || matches[0];
  };
  return (
    cals.find((c) => String(c.id) === s) ||
    cals.find((c) => c.name.toLowerCase() === s && c.isPrimary) ||
    byAccount((c) => c.accountEmail.toLowerCase() === s) ||
    byAccount((c) => c.account.toLowerCase() === s) ||
    cals.find((c) => c.name.toLowerCase() === s) ||
    byAccount((c) => c.accountEmail.toLowerCase().startsWith(s + '@')) ||
    cals.find((c) => `${c.account} ${c.name}`.toLowerCase().includes(s)) ||
    byAccount((c) => c.accountEmail.toLowerCase().includes(s)) ||
    null
  );
}

export function defaultCalendar() {
  const cals = listCalendars().filter((c) => !c.readOnly);
  const id = Number(getSetting('defaultCalendarId', 0));
  return cals.find((c) => c.id === id) || cals.find((c) => c.isPrimary) || cals.find((c) => c.kind === 'local' && !c.accountId) || cals[0];
}

// Sync ------------------------------------------------------------------------------------------

export async function syncAccountCalendars(accountId) {
  ensureLocalCalendars();
  const account = getAccount(accountId);
  if (!account || !hasServerCalendars(account)) return;
  const provider = calendarProviderFor(accountId);
  const tz = userTz();
  const remote = await provider.listCalendars();
  const existing = new Map(all("SELECT * FROM calendars WHERE account_id = ? AND kind = 'remote'", accountId).map((c) => [c.remote_id, c]));
  tx(() => {
    for (const c of remote) {
      const cur = existing.get(c.remote_id);
      if (cur) run('UPDATE calendars SET name = ?, read_only = ?, is_primary = ? WHERE id = ?', c.name, c.read_only ? 1 : 0, c.is_primary ? 1 : 0, cur.id);
      else run("INSERT INTO calendars(account_id, remote_id, name, color, kind, visible, read_only, is_primary) VALUES(?,?,?,?, 'remote', ?,?,?)", accountId, c.remote_id, c.name, c.is_primary ? account.color : c.color || account.color, c.visible ?? 1, c.read_only ? 1 : 0, c.is_primary ? 1 : 0);
    }
    const keep = new Set(remote.map((c) => c.remote_id));
    for (const [rid, c] of existing) if (!keep.has(rid)) run('DELETE FROM calendars WHERE id = ?', c.id);
  });
  const { from, to } = syncWindow();
  for (const cal of all('SELECT * FROM calendars WHERE account_id = ? AND visible = 1', accountId)) {
    try {
      const evs = await provider.listEvents(cal, from, to, tz);
      replaceEvents(cal.id, evs, from, to);
      run('UPDATE calendars SET last_error = NULL WHERE id = ?', cal.id);
    } catch (e) {
      run('UPDATE calendars SET last_error = ? WHERE id = ?', String(e.message).slice(0, 300), cal.id);
      if (cal.is_primary) throw e;
    }
  }
}

/** Re-read one server calendar (after writes that change several events, like series edits). */
export async function resyncCalendar(calendarId) {
  const cal = calendarRow(calendarId);
  if (!cal || cal.kind !== 'remote') return;
  const { from, to } = syncWindow();
  const evs = await calendarProviderFor(cal.account_id).listEvents(cal, from, to, userTz());
  replaceEvents(cal.id, evs, from, to);
}

function replaceEvents(calendarId, evs, from, to) {
  tx(() => {
    const keep = new Set();
    for (const e of evs) {
      keep.add(e.remote_id);
      upsertEventRow(calendarId, e);
    }
    const stale = all('SELECT id, remote_id FROM events WHERE calendar_id = ? AND start < ? AND end > ?', calendarId, to.toISOString(), from.toISOString());
    for (const s of stale) if (!keep.has(s.remote_id)) run('DELETE FROM events WHERE id = ?', s.id);
  });
}

function upsertEventRow(calendarId, e, extra = {}) {
  const cur = get('SELECT id FROM events WHERE calendar_id = ? AND remote_id = ?', calendarId, e.remote_id);
  const vals = [
    e.uid || null, e.title || '(No title)', e.description || null, e.location || null, e.start, e.end, e.all_day ? 1 : 0,
    e.start_date || null, e.end_date || null, e.timezone || null, JSON.stringify(e.attendees || []), e.organizer || null,
    e.status || null, e.show_as || 'busy', e.recurring ? 1 : 0, e.series_id || null, e.reminder_minutes ?? null,
    e.web_link || null, e.online_meeting_url || null, e.etag || null, e.rrule || null, e.href || null,
  ];
  if (cur) {
    run(
      `UPDATE events SET uid=?, title=?, description=?, location=?, start=?, end=?, all_day=?, start_date=?, end_date=?, timezone=?,
         attendees_json=?, organizer=?, status=?, show_as=?, recurring=?, series_id=?, reminder_minutes=?, web_link=?, online_meeting_url=?, etag=?,
         rrule=?, href=?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
      ...vals, cur.id,
    );
    if (extra.source_message_id || extra.created_by) run('UPDATE events SET source_message_id = coalesce(?, source_message_id), created_by = coalesce(?, created_by) WHERE id = ?', extra.source_message_id || null, extra.created_by || null, cur.id);
    return cur.id;
  }
  const r = run(
    `INSERT INTO events(calendar_id, remote_id, uid, title, description, location, start, end, all_day, start_date, end_date, timezone,
       attendees_json, organizer, status, show_as, recurring, series_id, reminder_minutes, web_link, online_meeting_url, etag, rrule, href, source_message_id, created_by)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    calendarId, e.remote_id, ...vals, extra.source_message_id || null, extra.created_by || null,
  );
  return Number(r.lastInsertRowid);
}

export async function refreshSubscription(id) {
  const c = calendarRow(id);
  if (!c || c.kind !== 'ics') return;
  try {
    const res = await fetch(c.url, { headers: { Accept: 'text/calendar, */*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const { from, to } = syncWindow();
    const { events, calName } = parseIcs(text, { tz: userTz(), from, to });
    tx(() => {
      run('DELETE FROM events WHERE calendar_id = ?', id);
      for (const e of events) if (e.status !== 'cancelled') upsertEventRow(id, e);
      if (calName && /^Subscribed calendar$/.test(c.name)) run('UPDATE calendars SET name = ? WHERE id = ?', calName, id);
      run('UPDATE calendars SET last_error = NULL WHERE id = ?', id);
    });
  } catch (e) {
    run('UPDATE calendars SET last_error = ? WHERE id = ?', String(e.message).slice(0, 300), id);
    throw e;
  }
}

export async function refreshSubscriptions() {
  for (const c of all("SELECT id FROM calendars WHERE kind = 'ics'")) await refreshSubscription(c.id).catch(() => {});
}

// Events ----------------------------------------------------------------------------------------

export function publicEvent(r, tz = userTz()) {
  if (!r) return null;
  return {
    id: r.id,
    calendarId: r.calendar_id,
    calendar: r.cal_name,
    account: r.acc_label || r.acc_email || (r.cal_kind === 'ics' ? 'Subscribed' : 'On this computer'),
    accountEmail: r.acc_email || null,
    color: r.cal_color || r.acc_color || '#64748b',
    title: r.title,
    start: r.start,
    end: r.end,
    startLocal: r.all_day ? r.start_date : toZonedIso(r.start, tz),
    endLocal: r.all_day ? addDaysToDate(r.end_date, -1) : toZonedIso(r.end, tz),
    when: r.all_day
      ? r.end_date && addDaysToDate(r.start_date, 1) !== r.end_date
        ? `${describe(new Date(r.start), tz, { dateOnly: true })} – ${describe(new Date(r.end) - 86400_000, tz, { dateOnly: true })} (all day)`
        : `${describe(new Date(r.start), tz, { dateOnly: true })} (all day)`
      : `${describe(new Date(r.start), tz)} – ${new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(r.end))}`,
    allDay: !!r.all_day,
    startDate: r.start_date,
    endDate: r.end_date ? addDaysToDate(r.end_date, -1) : null,
    location: r.location,
    description: r.description,
    attendees: json(r.attendees_json, []),
    organizer: r.organizer,
    status: r.status,
    showAs: r.show_as,
    recurring: !!r.recurring,
    seriesId: r.series_id || null,
    repeats: r.rrule ? describeRRule(r.rrule) : r.recurring ? 'Repeats' : null,
    rrule: r.rrule || null,
    reminderMinutes: r.reminder_minutes,
    webLink: r.web_link,
    onlineMeetingUrl: r.online_meeting_url,
    readOnly: !!r.cal_read_only,
    createdBy: r.created_by,
    sourceMessageId: r.source_message_id,
  };
}

const EVENT_SELECT = `
  SELECT e.*, c.name AS cal_name, c.color AS cal_color, c.kind AS cal_kind, c.read_only AS cal_read_only, c.visible AS cal_visible,
         a.label AS acc_label, a.email AS acc_email, a.color AS acc_color
  FROM events e JOIN calendars c ON c.id = e.calendar_id LEFT JOIN accounts a ON a.id = c.account_id`;

export function getEvent(id) {
  return publicEvent(get(`${EVENT_SELECT} WHERE e.id = ?`, id));
}

/** Events overlapping [from, to) across the master calendar. */
export function listEvents({ from, to, calendarIds, query, includeHidden = false, limit = 1000 } = {}) {
  const tz = userTz();
  const f = from instanceof Date ? from : parseDateTime(from, tz) || startOfLocalDay(new Date(), tz);
  const t = to instanceof Date ? to : parseDateTime(to, tz) || new Date(f.getTime() + 7 * 86400_000);
  const where = ['e.start < ?', 'e.end > ?'];
  const params = [t.toISOString(), f.toISOString()];
  if (!includeHidden) where.push('c.visible = 1');
  if (calendarIds?.length) {
    where.push(`e.calendar_id IN (${calendarIds.map(() => '?').join(',')})`);
    params.push(...calendarIds);
  }
  if (query) {
    where.push("(lower(e.title) LIKE ? OR lower(coalesce(e.location,'')) LIKE ? OR lower(coalesce(e.description,'')) LIKE ? OR lower(coalesce(e.attendees_json,'')) LIKE ?)");
    const q = `%${String(query).toLowerCase()}%`;
    params.push(q, q, q, q);
  }
  params.push(limit);
  return all(`${EVENT_SELECT} WHERE ${where.join(' AND ')} ORDER BY e.start, e.all_day DESC LIMIT ?`, ...params).map((r) => publicEvent(r, tz));
}

export function conflictsFor(start, end, excludeId = null) {
  return listEvents({ from: new Date(start), to: new Date(end) }).filter((e) => e.id !== excludeId && !e.allDay && e.showAs !== 'free' && e.status !== 'declined');
}

function normalizeAttendees(list) {
  if (!list) return [];
  return (Array.isArray(list) ? list : String(list).split(/[,;]/))
    .map((a) => (typeof a === 'string' ? { email: a.trim(), name: '' } : { email: (a.email || a.address || '').trim(), name: a.name || '' }))
    .filter((a) => a.email.includes('@'));
}

/** Turn loosely-specified input (from the UI or Claude) into exact times. */
export function normalizeEventInput(input, { partial = false, existing = null } = {}) {
  const tz = input.timezone && isValidTimeZone(input.timezone) ? input.timezone : userTz();
  const out = {};
  if (input.title !== undefined) out.title = String(input.title || '').trim() || '(No title)';
  if (input.location !== undefined) out.location = input.location || '';
  if (input.description !== undefined) out.description = input.description || '';
  if (input.attendees !== undefined) out.attendees = normalizeAttendees(input.attendees);
  if (input.reminder_minutes !== undefined) out.reminder_minutes = input.reminder_minutes == null ? null : Number(input.reminder_minutes);
  if (input.show_as !== undefined) out.show_as = input.show_as;
  if (input.online_meeting) out.online_meeting = true;
  if (input.notify !== undefined) out.notify = input.notify;
  const recurrenceIn = input.recurrence;

  const timesGiven = input.start !== undefined || input.end !== undefined || input.all_day !== undefined || input.duration_minutes !== undefined;
  if (!timesGiven && partial) {
    if (recurrenceIn !== undefined) out.rrule = recurrenceIn === null || recurrenceIn === 'none' || recurrenceIn === '' ? null : toRRule(recurrenceIn, { start: existing?.start, allDay: existing?.allDay, tz });
    return out;
  }
  const allDay = input.all_day ?? (existing ? existing.allDay : isDateOnly(input.start) && (input.end == null || isDateOnly(input.end)));
  const startIn = input.start ?? (existing ? (existing.allDay ? existing.startDate : existing.start) : null);
  if (!startIn) throw new Error('A start date/time is required.');
  out.all_day = !!allDay;
  out.timezone = tz;
  if (allDay) {
    const sd = isDateOnly(startIn) ? String(startIn).trim() : localDate(parseDateTime(startIn, tz), tz);
    let lastDay;
    if (input.end != null) lastDay = isDateOnly(input.end) ? String(input.end).trim() : localDate(parseDateTime(input.end, tz), tz);
    else if (existing?.allDay && input.start != null) lastDay = addDaysToDate(sd, Math.round((Date.parse(existing.endDate) - Date.parse(existing.startDate)) / 86400_000));
    else lastDay = existing?.allDay && input.start == null ? existing.endDate : sd;
    if (lastDay < sd) lastDay = sd;
    out.start_date = sd;
    out.end_date = addDaysToDate(lastDay, 1); // stored exclusive
    const [y, m, d] = sd.split('-').map(Number);
    const [y2, m2, d2] = out.end_date.split('-').map(Number);
    out.start = wallTimeToUtc(y, m, d, 0, 0, 0, tz).toISOString();
    out.end = wallTimeToUtc(y2, m2, d2, 0, 0, 0, tz).toISOString();
  } else {
    const s = parseDateTime(startIn, tz);
    if (!s) throw new Error(`Could not understand the start time "${startIn}". Use e.g. 2026-11-12T14:30.`);
    let e;
    if (input.end != null) {
      e = parseDateTime(input.end, tz);
      if (!e) throw new Error(`Could not understand the end time "${input.end}".`);
    } else if (input.duration_minutes) e = new Date(s.getTime() + Number(input.duration_minutes) * 60000);
    else if (existing && !existing.allDay) e = new Date(s.getTime() + (Date.parse(existing.end) - Date.parse(existing.start)));
    else e = new Date(s.getTime() + 60 * 60000);
    if (e <= s) throw new Error('The end time must be after the start time.');
    out.start = s.toISOString();
    out.end = e.toISOString();
  }
  if (recurrenceIn !== undefined) out.rrule = recurrenceIn === null || recurrenceIn === 'none' || recurrenceIn === '' ? null : toRRule(recurrenceIn, { start: out.start, allDay: out.all_day, tz });
  return out;
}

export async function createEvent(input, actor = 'you') {
  const cal = input.calendarId ? listCalendars().find((c) => c.id === Number(input.calendarId)) : resolveCalendar(input.calendar);
  if (!cal) throw new Error(`No calendar matches "${input.calendar}". Use list_calendars to see the options.`);
  if (cal.readOnly) throw new Error(`"${cal.name}" is read-only.`);
  const ev = normalizeEventInput(input);
  const tz = userTz();
  const conflicts = conflictsFor(ev.start, ev.end).filter(() => !ev.all_day);
  let id;
  const extra = { source_message_id: input.source_message_id, created_by: actor };
  if (cal.kind === 'remote') {
    const row = calendarRow(cal.id);
    const created = await calendarProviderFor(cal.accountId).createEvent(row, ev, tz);
    if (created?.resync || ev.rrule) {
      await resyncCalendar(cal.id);
      id = findAfterResync(cal.id, { uid: created?.uid, seriesId: created?.remote_id, remoteId: created?.remote_id, near: ev.start });
      if (id) markCreated(cal.id, id, extra);
    } else id = upsertEventRow(cal.id, created, extra);
    if (!id) throw new Error('The event was saved on the server but could not be read back. It will appear after the next sync.');
  } else {
    const uid = input.uid || `${randomId(12)}@switchboard`;
    const local = { ...ev, remote_id: `local-${randomId(10)}`, uid, status: 'confirmed', organizer: input.organizer || null };
    if (ev.rrule) {
      id = materializeSeries(cal.id, local, extra);
    } else id = upsertEventRow(cal.id, local, extra);
    if (ev.attendees?.length && ev.notify !== false) await sendInvitation(getEvent(id), cal, 'REQUEST').catch((e) => { throw new Error(`Event saved, but the invitation email failed: ${e.message}`); });
  }
  const event = getEvent(id);
  logActivity(actor, 'event.create', `${event.title} — ${event.when} (${cal.account} · ${cal.name})`);
  events.emit('calendar', { changed: event.id });
  return { event, conflicts };
}

export async function updateEvent(id, patch, actor = 'you') {
  const existing = getEvent(id);
  if (!existing) throw new Error('Event not found');
  if (existing.readOnly) throw new Error('This event is on a read-only calendar.');
  let targetCal = null;
  if (patch.calendar != null || patch.calendarId != null) {
    targetCal = patch.calendarId ? listCalendars().find((c) => c.id === Number(patch.calendarId)) : resolveCalendar(patch.calendar);
    if (!targetCal) throw new Error('Target calendar not found');
  }
  const ev = normalizeEventInput(patch, { partial: true, existing });
  const tz = userTz();
  const row = get('SELECT * FROM events WHERE id = ?', id);
  const cal = calendarRow(row.calendar_id);
  if (targetCal && targetCal.id !== cal.id) {
    // Moving between calendars: create in the new one, then remove the old one.
    const merged = {
      title: existing.title, location: existing.location, description: existing.description, attendees: existing.attendees,
      reminder_minutes: existing.reminderMinutes, show_as: existing.showAs,
      start: existing.allDay ? existing.startDate : existing.start, end: existing.allDay ? existing.endDate : existing.end, all_day: existing.allDay,
      ...patch, calendarId: targetCal.id, calendar: undefined, notify: false,
    };
    const res = await createEvent(merged, actor);
    await deleteEvent(id, actor, { notify: false, quiet: true });
    return res;
  }
  const scope = patch.scope === 'series' && (row.series_id || row.recurring) ? 'series' : 'occurrence';
  if (cal.kind === 'remote') {
    const result = await calendarProviderFor(cal.account_id).updateEvent(cal, row.remote_id, ev, tz, { row, scope });
    if (result?.resync) {
      await resyncCalendar(cal.id);
      id = (get('SELECT id FROM events WHERE id = ?', id) && scope !== 'series' && !result.uid ? id : null) || findAfterResync(cal.id, { uid: result.uid, seriesId: row.series_id, remoteId: row.remote_id, near: ev.start || row.start }) || id;
    } else upsertEventRow(cal.id, result);
  } else if (scope === 'series' && row.series_id) {
    id = updateLocalSeries(cal.id, row, ev);
  } else {
    const merged = { ...rowToProviderEvent(row), ...ev };
    if (ev.rrule && !row.series_id) {
      run('DELETE FROM events WHERE id = ?', id);
      id = materializeSeries(cal.id, { ...merged, remote_id: `local-${randomId(10)}` }, { created_by: row.created_by });
    } else upsertEventRow(cal.id, merged);
    const after = getEvent(id);
    if (after.attendees?.length && patch.notify !== false && (ev.start || ev.title || ev.location)) await sendInvitation(after, publicCalendarById(cal.id), 'REQUEST').catch(() => {});
  }
  const event = getEvent(id);
  if (!event) throw new Error('The event was updated on the server; it will appear after the next sync.');
  logActivity(actor, 'event.update', `${event.title} — ${event.when}`);
  events.emit('calendar', { changed: event.id });
  return { event, conflicts: event.allDay ? [] : conflictsFor(event.start, event.end, id) };
}

function publicCalendarById(id) {
  return listCalendars().find((c) => c.id === id);
}

function rowToProviderEvent(r) {
  return {
    remote_id: r.remote_id, uid: r.uid, title: r.title, description: r.description, location: r.location, start: r.start, end: r.end,
    all_day: !!r.all_day, start_date: r.start_date, end_date: r.end_date, timezone: r.timezone, attendees: json(r.attendees_json, []),
    organizer: r.organizer, status: r.status, show_as: r.show_as, recurring: !!r.recurring, series_id: r.series_id,
    reminder_minutes: r.reminder_minutes, web_link: r.web_link, online_meeting_url: r.online_meeting_url, etag: r.etag,
    rrule: r.rrule, href: r.href,
  };
}

/** Store every occurrence of a repeating event kept on this computer (two years ahead). */
function materializeSeries(calendarId, master, extra = {}) {
  const tz = userTz();
  const durMs = Date.parse(master.end) - Date.parse(master.start);
  const days = master.all_day ? Math.round((Date.parse(master.end_date) - Date.parse(master.start_date)) / 86400_000) : 0;
  const from = new Date(Date.parse(master.start) - 86400_000);
  const to = new Date(Date.parse(master.start) + 730 * 86400_000);
  const starts = expandLocal(master.rrule, { start: master.start, allDay: master.all_day, tz, from, to }).filter((ms) => !(master.exdates || []).includes(new Date(ms).toISOString()));
  if (!starts.length) starts.push(Date.parse(master.start));
  let first = null;
  tx(() => {
    for (const ms of starts) {
      const startIso = new Date(ms).toISOString();
      const inst = { ...master, remote_id: `${master.uid}::${ms}`, series_id: master.uid, recurring: true, start: startIso, end: new Date(ms + durMs).toISOString() };
      if (master.all_day) {
        inst.start_date = localDate(new Date(ms), tz);
        inst.end_date = addDaysToDate(inst.start_date, days || 1);
      }
      const rowId = upsertEventRow(calendarId, inst, extra);
      if (first == null) first = rowId;
    }
  });
  return first;
}

function updateLocalSeries(calendarId, row, ev) {
  const rows = all('SELECT * FROM events WHERE calendar_id = ? AND series_id = ? ORDER BY start', calendarId, row.series_id);
  const firstRow = rows[0];
  const shift = ev.start ? Date.parse(ev.start) - Date.parse(row.start) : 0;
  const newDur = ev.start ? Date.parse(ev.end) - Date.parse(ev.start) : null;
  const fields = { ...ev };
  delete fields.start; delete fields.end; delete fields.start_date; delete fields.end_date; delete fields.all_day;
  if (ev.rrule !== undefined || ev.all_day !== undefined) {
    // The pattern itself changed: rebuild the series from its first occurrence.
    const base = { ...rowToProviderEvent(firstRow), ...fields, rrule: ev.rrule !== undefined ? ev.rrule : firstRow.rrule };
    base.start = new Date(Date.parse(firstRow.start) + shift).toISOString();
    base.end = new Date(Date.parse(base.start) + (newDur ?? Date.parse(firstRow.end) - Date.parse(firstRow.start))).toISOString();
    if (ev.all_day !== undefined) Object.assign(base, { all_day: ev.all_day, start_date: ev.start_date, end_date: ev.end_date });
    run('DELETE FROM events WHERE calendar_id = ? AND series_id = ?', calendarId, row.series_id);
    return base.rrule ? materializeSeries(calendarId, base, { created_by: firstRow.created_by }) : upsertEventRow(calendarId, { ...base, remote_id: `local-${randomId(10)}`, recurring: false, series_id: null }, { created_by: firstRow.created_by });
  }
  const tz = userTz();
  tx(() => {
    for (const r of rows) {
      const next = { ...rowToProviderEvent(r), ...fields };
      if (ev.start) {
        next.start = new Date(Date.parse(r.start) + shift).toISOString();
        next.end = new Date(Date.parse(next.start) + newDur).toISOString();
        if (r.all_day) {
          next.start_date = localDate(new Date(next.start), tz);
          next.end_date = addDaysToDate(next.start_date, Math.round(newDur / 86400_000) || 1);
        }
      }
      upsertEventRow(calendarId, next);
    }
  });
  return row.id;
}

function findAfterResync(calendarId, { uid, seriesId, remoteId, near }) {
  const t = near ? new Date(near).toISOString() : null;
  const pick = (sql, ...p) => get(`${sql} ORDER BY abs(julianday(start) - julianday(coalesce(?, start))) LIMIT 1`, ...p, t)?.id;
  return (
    (remoteId && get('SELECT id FROM events WHERE calendar_id = ? AND remote_id = ?', calendarId, remoteId)?.id) ||
    (uid && pick('SELECT id, start FROM events WHERE calendar_id = ? AND uid = ?', calendarId, uid)) ||
    (seriesId && pick('SELECT id, start FROM events WHERE calendar_id = ? AND series_id = ?', calendarId, seriesId)) ||
    null
  );
}

function markCreated(calendarId, id, extra) {
  const row = get('SELECT series_id, uid FROM events WHERE id = ?', id);
  const key = row?.series_id ? ['series_id', row.series_id] : row?.uid ? ['uid', row.uid] : ['id', id];
  run(`UPDATE events SET created_by = coalesce(?, created_by), source_message_id = coalesce(?, source_message_id) WHERE calendar_id = ? AND ${key[0]} = ?`, extra.created_by || null, extra.source_message_id || null, calendarId, key[1]);
}

export async function deleteEvent(id, actor = 'you', { notify = true, quiet = false, scope = 'occurrence' } = {}) {
  const existing = getEvent(id);
  if (!existing) throw new Error('Event not found');
  if (existing.readOnly) throw new Error('This event is on a read-only calendar.');
  const row = get('SELECT * FROM events WHERE id = ?', id);
  const cal = calendarRow(row.calendar_id);
  const series = scope === 'series' && row.series_id;
  if (cal.kind === 'remote') {
    const r = await calendarProviderFor(cal.account_id).deleteEvent(cal, row.remote_id, { notify, row, scope: series ? 'series' : 'occurrence' });
    if (r?.resync || series) await resyncCalendar(cal.id);
  } else if (notify && existing.attendees?.length && !existing.organizer) await sendInvitation(existing, publicCalendarById(cal.id), 'CANCEL').catch(() => {});
  if (series && cal.kind !== 'remote') run('DELETE FROM events WHERE calendar_id = ? AND series_id = ?', cal.id, row.series_id);
  run('DELETE FROM events WHERE id = ?', id);
  if (!quiet) logActivity(actor, 'event.delete', `${existing.title} — ${existing.when}`);
  events.emit('calendar', { deleted: id });
  return { deleted: existing };
}

/** Email an iCalendar invitation/cancellation for events on local calendars. */
async function sendInvitation(event, cal, method) {
  const { sendMessage } = await import('./mail.js');
  const account = cal.accountId ? getAccount(cal.accountId) : listAccounts({ includeDisabled: false })[0];
  if (!account) throw new Error('Add an email account to send invitations.');
  const ics = buildIcs([{ ...rowLike(event), sequence: Math.floor(Date.now() / 1000) }], { method, organizer: { email: account.email, name: account.displayName } });
  const verb = method === 'CANCEL' ? 'Canceled' : 'Invitation';
  await sendMessage(
    {
      accountId: account.id,
      to: event.attendees.map((a) => ({ address: a.email, name: a.name })),
      subject: `${verb}: ${event.title} @ ${event.when}`,
      text: `${event.title}\n${event.when}${event.location ? `\n${event.location}` : ''}${event.description ? `\n\n${event.description}` : ''}`,
      icalEvent: { method: method.toLowerCase(), content: ics },
      skipContacts: true,
    },
    'you',
  );
}

function rowLike(e) {
  return {
    uid: get('SELECT uid FROM events WHERE id = ?', e.id)?.uid, title: e.title, description: e.description, location: e.location,
    start: e.start, end: e.end, all_day: e.allDay, start_date: e.startDate, end_date: e.endDate ? addDaysToDate(e.endDate, 1) : null,
    attendees: e.attendees, reminder_minutes: e.reminderMinutes, show_as: e.showAs,
  };
}

/** Open slots of at least durationMinutes within working hours, across all visible calendars. */
export function findFreeTime({ from, to, durationMinutes = 30, workStart = null, workEnd = null, includeWeekends = false, limit = 20, calendarIds } = {}) {
  const tz = userTz();
  const ws = workStart || getSetting('workStart', '09:00');
  const we = workEnd || getSetting('workEnd', '17:00');
  const f = parseDateTime(from, tz) || new Date();
  const t = parseDateTime(to, tz) || new Date(f.getTime() + 7 * 86400_000);
  const busy = listEvents({ from: f, to: t, calendarIds })
    .filter((e) => !e.allDay && e.showAs !== 'free' && e.status !== 'declined')
    .map((e) => [Date.parse(e.start), Date.parse(e.end)])
    .sort((a, b) => a[0] - b[0]);
  const slots = [];
  const need = durationMinutes * 60000;
  const [wsH, wsM] = ws.split(':').map(Number);
  const [weH, weM] = we.split(':').map(Number);
  let day = localDate(f, tz);
  const lastDay = localDate(t, tz);
  for (let i = 0; i < 120 && day <= lastDay && slots.length < limit; i++, day = addDaysToDate(day, 1)) {
    const [y, m, d] = day.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (!includeWeekends && (wd === 0 || wd === 6)) continue;
    let cursor = Math.max(wallTimeToUtc(y, m, d, wsH, wsM, 0, tz).getTime(), f.getTime());
    const dayEnd = Math.min(wallTimeToUtc(y, m, d, weH, weM, 0, tz).getTime(), t.getTime());
    // Round up to the next quarter hour.
    cursor = Math.ceil(cursor / 900000) * 900000;
    for (const [bs, be] of busy) {
      if (be <= cursor || bs >= dayEnd) continue;
      if (bs - cursor >= need) slots.push([cursor, bs]);
      cursor = Math.max(cursor, Math.ceil(be / 900000) * 900000);
      if (cursor >= dayEnd) break;
    }
    if (dayEnd - cursor >= need) slots.push([cursor, dayEnd]);
  }
  return slots.slice(0, limit).map(([s, e]) => ({
    start: toZonedIso(new Date(s), tz),
    end: toZonedIso(new Date(e), tz),
    minutes: Math.round((e - s) / 60000),
    when: `${describe(new Date(s), tz)} – ${new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(e))}`,
  }));
}

// Invitations in email --------------------------------------------------------------------------

export function findEventByUid(uid) {
  if (!uid) return null;
  const r = get(`${EVENT_SELECT} WHERE e.uid = ? ORDER BY c.kind = 'remote' DESC LIMIT 1`, uid);
  return r ? publicEvent(r) : null;
}

export function parseInvite(icsText) {
  const tz = userTz();
  const { method, events } = parseIcs(icsText, { tz });
  const e = events[0];
  if (!e) return null;
  const existing = findEventByUid(e.uid);
  return {
    method,
    uid: e.uid,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.all_day,
    startDate: e.start_date,
    endDate: e.end_date ? addDaysToDate(e.end_date, -1) : null,
    when: e.all_day ? describe(new Date(e.start), tz, { dateOnly: true }) + ' (all day)' : `${describe(new Date(e.start), tz)} – ${new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(e.end))}`,
    startLocal: e.all_day ? e.start_date : toZonedIso(new Date(e.start), tz),
    endLocal: e.all_day ? addDaysToDate(e.end_date, -1) : toZonedIso(new Date(e.end), tz),
    location: e.location,
    description: e.description,
    organizer: e.organizer,
    organizerName: e.organizer_name,
    attendees: e.attendees,
    recurring: e.recurring,
    rrule: e.rrule || null,
    onlineMeetingUrl: e.online_meeting_url,
    cancelled: e.status === 'cancelled',
    existingEventId: existing?.id || null,
    existingCalendar: existing ? `${existing.account} · ${existing.calendar}` : null,
    raw: { ...e },
  };
}

export async function addInviteToCalendar(invite, { calendar, calendarId, sourceMessageId, actor = 'you' } = {}) {
  if (invite.existingEventId) return { event: getEvent(invite.existingEventId), conflicts: [], alreadyThere: true };
  const e = invite.raw;
  return createEvent(
    {
      calendarId, calendar, title: e.title, description: e.description, location: e.location,
      start: e.all_day ? e.start_date : e.start, end: e.all_day ? addDaysToDate(e.end_date, -1) : e.end, all_day: e.all_day,
      reminder_minutes: e.reminder_minutes ?? 15, notify: false, source_message_id: sourceMessageId, uid: e.uid, organizer: e.organizer,
      attendees: undefined,
    },
    actor,
  );
}

/** Accept, decline or tentatively accept a meeting invitation that arrived by email. */
export async function respondToInvite(messageId, response, actor = 'you') {
  const map = { accept: 'accepted', accepted: 'accepted', decline: 'declined', declined: 'declined', tentative: 'tentative', maybe: 'tentative' };
  const status = map[String(response).toLowerCase()];
  if (!status) throw new Error('Response must be accept, decline or tentative.');
  const { getMessage, sendMessage } = await import('./mail.js');
  const msg = await getMessage(messageId);
  const invite = msg.invite;
  if (!invite) throw new Error('This email has no meeting invitation.');
  const account = getAccount(msg.accountId);
  const existing = invite.existingEventId ? getEvent(invite.existingEventId) : null;
  const tz = userTz();
  let event = existing;
  if (existing) {
    const row = get('SELECT * FROM events WHERE id = ?', existing.id);
    const cal = calendarRow(row.calendar_id);
    const provider = cal.kind === 'remote' ? calendarProviderFor(cal.account_id) : null;
    if (provider?.respondToEvent) {
      await provider.respondToEvent(cal, row.remote_id, status, tz);
      run('UPDATE events SET status = ? WHERE id = ?', status, existing.id);
      logActivity(actor, 'event.respond', `${status}: ${existing.title}`);
      return { response: status, event: getEvent(existing.id), via: account.type };
    }
  }
  // No calendar server to answer through: reply to the organizer with an iCalendar REPLY.
  if (invite.organizer) {
    const reply = buildIcs([{ ...invite.raw, attendees: [{ email: account.email, name: account.displayName, status }] }], { method: 'REPLY', organizer: { email: invite.organizer, name: invite.organizerName } });
    const verb = { accepted: 'Accepted', declined: 'Declined', tentative: 'Tentative' }[status];
    await sendMessage({ accountId: account.id, to: [{ address: invite.organizer, name: invite.organizerName || '' }], subject: `${verb}: ${invite.title}`, text: `${verb}: ${invite.title}\n${invite.when}`, icalEvent: { method: 'reply', content: reply }, skipContacts: true }, actor);
  }
  if (status !== 'declined' && !existing) {
    const res = await addInviteToCalendar(invite, { calendar: account.email, sourceMessageId: messageId, actor });
    event = res.event;
  } else if (status === 'declined' && existing && !existing.readOnly) {
    await deleteEvent(existing.id, actor, { notify: false });
    event = null;
  }
  logActivity(actor, 'event.respond', `${status}: ${invite.title}`);
  return { response: status, event, via: 'email' };
}

export function eventsAsIcs(calendarId) {
  const cal = calendarRow(calendarId);
  const rows = all('SELECT * FROM events WHERE calendar_id = ? ORDER BY start', calendarId);
  return buildIcs(rows.map(rowToProviderEvent), { calName: cal?.name || 'Calendar' });
}

export function dayRange(dateStr = null, days = 1) {
  const tz = userTz();
  const start = dateStr || localDate(new Date(), tz);
  const [y, m, d] = start.split('-').map(Number);
  const [y2, m2, d2] = addDaysToDate(start, days).split('-').map(Number);
  return { from: wallTimeToUtc(y, m, d, 0, 0, 0, tz), to: wallTimeToUtc(y2, m2, d2, 0, 0, 0, tz), tz };
}


// Reminders ----------------------------------------------------------------------------------------

const reminded = new Set();

/** Events whose reminder time has come (each is returned once per run of the app). */
export function dueReminders(now = Date.now()) {
  const def = Number(getSetting('defaultReminderMinutes', 15));
  const out = [];
  for (const e of listEvents({ from: new Date(now - 5 * 60_000), to: new Date(now + 26 * 3600_000) })) {
    if (e.allDay || e.status === 'declined') continue;
    const mins = e.reminderMinutes ?? (def >= 0 ? def : null);
    if (mins == null) continue;
    const start = Date.parse(e.start);
    const key = `${e.id}|${e.start}|${mins}`;
    if (now >= start - mins * 60_000 && now < start + 5 * 60_000 && !reminded.has(key)) {
      reminded.add(key);
      out.push({ id: e.id, title: e.title, when: e.when, start: e.start, minutes: Math.round((start - now) / 60_000), location: e.location, onlineMeetingUrl: e.onlineMeetingUrl, calendar: `${e.account} · ${e.calendar}`, color: e.color });
    }
  }
  return out;
}
