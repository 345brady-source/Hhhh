import { normalizeTimeZone, wallTimeToUtc, zonedParts, addDaysToDate } from './time.js';

function unfold(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

function parseLine(line) {
  // NAME;PARAM=VAL;PARAM="V:AL":value
  let i = 0;
  let inQuote = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    if (c === ':' && !inQuote) break;
  }
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const parts = head.match(/(?:[^;"]+|"[^"]*")+/g) || [head];
  const name = parts[0].toUpperCase();
  const params = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

export function unescapeText(v) {
  return String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

export function escapeText(v) {
  return String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Parse into nested components: { type, props: {NAME: [{params, value}]}, children: [] } */
export function parseComponents(text) {
  const root = { type: 'ROOT', props: {}, children: [] };
  const stack = [root];
  for (const raw of unfold(text).split('\n')) {
    if (!raw.trim()) continue;
    const { name, params, value } = parseLine(raw);
    const top = stack[stack.length - 1];
    if (name === 'BEGIN') {
      const c = { type: value.trim().toUpperCase(), props: {}, children: [] };
      top.children.push(c);
      stack.push(c);
    } else if (name === 'END') {
      if (stack.length > 1) stack.pop();
    } else {
      (top.props[name] ||= []).push({ params, value });
    }
  }
  return root;
}

const prop = (c, n) => c.props[n]?.[0];

function fixedOffsetZone(tzid) {
  const m = String(tzid || '').match(/(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!m || (m[3] && m[3] !== '00')) return null;
  const h = Number(m[2]);
  return h === 0 ? 'UTC' : `Etc/GMT${m[1] === '+' ? '-' : '+'}${h}`;
}

/** Returns { date: Date, allDay: bool, dateStr?: 'YYYY-MM-DD', tz } */
export function parseIcsDate(p, defaultTz) {
  if (!p) return null;
  const v = p.value.trim();
  if (p.params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    const dateStr = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    return { allDay: true, dateStr, date: wallTimeToUtc(+v.slice(0, 4), +v.slice(4, 6), +v.slice(6, 8), 0, 0, 0, defaultTz), tz: defaultTz };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i);
  if (!m) {
    const d = new Date(v);
    return isNaN(d) ? null : { allDay: false, date: d, tz: defaultTz };
  }
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return { allDay: false, date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0))), tz: 'UTC' };
  const tz = p.params.TZID ? normalizeTimeZone(p.params.TZID, fixedOffsetZone(p.params.TZID) || defaultTz) : defaultTz;
  return { allDay: false, date: wallTimeToUtc(+y, +mo, +d, +h, +mi, +(s || 0), tz), tz };
}

function parseDuration(v) {
  const m = String(v || '').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return 0;
  const ms = ((+m[2] || 0) * 7 * 86400 + (+m[3] || 0) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
  return m[1] === '-' ? -ms : ms;
}

function parsePerson(p) {
  if (!p) return null;
  return {
    email: p.value.replace(/^mailto:/i, '').trim(),
    name: p.params.CN || '',
    status: (p.params.PARTSTAT || '').toLowerCase() || null,
    role: p.params.ROLE || null,
  };
}

/**
 * Parse an .ics document into a list of event objects.
 * Recurring events are expanded between from and to (Dates); if not given, only the first instance is returned.
 */
export function parseIcs(text, { tz = 'UTC', from, to, maxPerEvent = 500 } = {}) {
  const root = parseComponents(text);
  const cal = root.children.find((c) => c.type === 'VCALENDAR') || root;
  const method = prop(cal, 'METHOD')?.value?.trim().toUpperCase() || null;
  const calName = unescapeText(prop(cal, 'X-WR-CALNAME')?.value || '');
  const vevents = cal.children.filter((c) => c.type === 'VEVENT');
  const overrides = new Map(); // uid -> Map(recurrenceIdMs -> vevent)
  for (const v of vevents) {
    const rid = prop(v, 'RECURRENCE-ID');
    if (rid) {
      const uid = prop(v, 'UID')?.value || '';
      const d = parseIcsDate(rid, tz);
      if (d) (overrides.get(uid) || overrides.set(uid, new Map()).get(uid)).set(d.date.getTime(), v);
    }
  }
  const events = [];
  for (const v of vevents) {
    const base = baseEvent(v, tz, method);
    if (!base) continue;
    if (prop(v, 'RECURRENCE-ID')) {
      if (!from || (new Date(base.end) >= from && new Date(base.start) <= to)) events.push({ ...base, recurring: true });
      continue;
    }
    const rrule = prop(v, 'RRULE')?.value?.trim() || null;
    const exdates = new Set();
    const exdateList = [];
    for (const ex of v.props.EXDATE || []) {
      for (const part of ex.value.split(',')) {
        const d = parseIcsDate({ value: part, params: ex.params }, base._tz);
        if (d) {
          exdates.add(d.date.getTime());
          exdateList.push(d.allDay ? d.dateStr : d.date.toISOString());
        }
      }
    }
    if (!rrule || !from || !to) {
      events.push({ ...base, recurring: !!rrule, rrule, exdates: exdateList });
      continue;
    }
    const ov = overrides.get(base.uid) || new Map();
    const durMs = new Date(base.end) - new Date(base.start);
    for (const startMs of expandRRule(rrule, base, { from, to, max: maxPerEvent })) {
      if (exdates.has(startMs) || ov.has(startMs)) continue;
      const s = new Date(startMs);
      const e = new Date(startMs + durMs);
      if (e < from || s > to) continue;
      const inst = { ...base, start: s.toISOString(), end: e.toISOString(), recurring: true, series_id: base.uid, remote_id: `${base.uid}::${startMs}`, rrule, exdates: exdateList, master_start: base.start, master_end: base.end };
      if (base.all_day) {
        inst.start_date = isoDateInTz(s, base._tz);
        inst.end_date = addDaysToDate(inst.start_date, Math.max(1, Math.round(durMs / 86400_000)));
      }
      events.push(inst);
    }
  }
  for (const e of events) delete e._tz;
  return { method, calName, events };
}

function isoDateInTz(d, tz) {
  const p = zonedParts(d, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function baseEvent(v, tz, method) {
  const ds = parseIcsDate(prop(v, 'DTSTART'), tz);
  if (!ds) return null;
  let de = parseIcsDate(prop(v, 'DTEND') || prop(v, 'DUE'), ds.tz);
  let endDate;
  if (!de) {
    const dur = parseDuration(prop(v, 'DURATION')?.value);
    endDate = new Date(ds.date.getTime() + (dur || (ds.allDay ? 86400_000 : 3600_000)));
  } else endDate = de.date;
  if (endDate <= ds.date) endDate = new Date(ds.date.getTime() + (ds.allDay ? 86400_000 : 1800_000));
  const uid = prop(v, 'UID')?.value?.trim() || `${ds.date.getTime()}-${Math.random().toString(36).slice(2)}`;
  const rid = prop(v, 'RECURRENCE-ID');
  const ridDate = rid ? parseIcsDate(rid, tz) : null;
  const status = (prop(v, 'STATUS')?.value || '').toLowerCase();
  const startDate = ds.allDay ? ds.dateStr : null;
  const endDateStr = ds.allDay ? (de?.dateStr || addDaysToDate(ds.dateStr, Math.max(1, Math.round((endDate - ds.date) / 86400_000)))) : null;
  const meeting = unescapeText(prop(v, 'X-MICROSOFT-SKYPETEAMSMEETINGURL')?.value || prop(v, 'X-GOOGLE-CONFERENCE')?.value || '');
  return {
    remote_id: ridDate ? `${uid}::${ridDate.date.getTime()}` : uid,
    uid,
    title: unescapeText(prop(v, 'SUMMARY')?.value || '(No title)'),
    description: unescapeText(prop(v, 'DESCRIPTION')?.value || ''),
    location: unescapeText(prop(v, 'LOCATION')?.value || '') || null,
    start: ds.date.toISOString(),
    end: endDate.toISOString(),
    all_day: ds.allDay,
    start_date: startDate,
    end_date: endDateStr,
    timezone: ds.tz,
    organizer: parsePerson(prop(v, 'ORGANIZER'))?.email || null,
    organizer_name: parsePerson(prop(v, 'ORGANIZER'))?.name || null,
    attendees: (v.props.ATTENDEE || []).map(parsePerson).filter(Boolean),
    status: method === 'CANCEL' || status === 'cancelled' ? 'cancelled' : status || null,
    show_as: (prop(v, 'TRANSP')?.value || '').toUpperCase() === 'TRANSPARENT' ? 'free' : 'busy',
    sequence: Number(prop(v, 'SEQUENCE')?.value || 0),
    web_link: prop(v, 'URL')?.value || null,
    online_meeting_url: meeting || (unescapeText(prop(v, 'DESCRIPTION')?.value || '').match(/https:\/\/(?:teams\.microsoft\.com\/l\/meetup-join|meet\.google\.com|[\w.-]*zoom\.us\/j)\/[^\s>"]+/)?.[0] ?? null),
    reminder_minutes: (() => {
      const alarm = v.children.find((c) => c.type === 'VALARM');
      const trig = alarm && prop(alarm, 'TRIGGER')?.value;
      const ms = trig ? parseDuration(trig) : null;
      return ms != null && ms <= 0 ? Math.round(-ms / 60000) : null;
    })(),
    recurring: false,
    _tz: ds.tz,
  };
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Expand an RRULE into start instants (ms). Works in local wall time so DST shifts are handled. */
export function expandRRule(rrule, base, { from, to, max = 500 }) {
  const r = {};
  for (const part of rrule.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) r[k.toUpperCase()] = v;
  }
  const freq = r.FREQ;
  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const tz = base._tz || 'UTC';
  const until = r.UNTIL ? parseIcsDate({ value: r.UNTIL, params: {} }, tz)?.date : null;
  const startLocal = zonedParts(new Date(base.start), tz);
  const time = base.all_day ? [0, 0, 0] : [startLocal.hour, startLocal.minute, startLocal.second];
  const byDay = r.BYDAY ? r.BYDAY.split(',').map((d) => ({ n: Number(d.slice(0, -2)) || 0, wd: DAY_CODES.indexOf(d.slice(-2).toUpperCase()) })) : null;
  const byMonthDay = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null;
  const byMonth = r.BYMONTH ? r.BYMONTH.split(',').map(Number) : null;
  const toMs = (y, m, d) => wallTimeToUtc(y, m, d, ...time, tz).getTime();
  const startMs = new Date(base.start).getTime();
  const out = [];
  let produced = 0;
  const limitMs = Math.min(to.getTime(), until ? until.getTime() : Infinity);
  const emit = (ms) => {
    if (ms < startMs) return true;
    if (ms > limitMs || produced >= count || out.length >= max) return false;
    produced++;
    if (ms >= from.getTime() - 86400_000 * 7) out.push(ms);
    return true;
  };
  let y = startLocal.year;
  let m = startLocal.month;
  let d = startLocal.day;
  const dim = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const wdOf = (yy, mm, dd) => new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
  for (let guard = 0; guard < 5000; guard++) {
    let candidates = [];
    if (freq === 'DAILY') {
      candidates = [[y, m, d]];
    } else if (freq === 'WEEKLY') {
      const days = byDay ? byDay.map((b) => b.wd) : [wdOf(startLocal.year, startLocal.month, startLocal.day)];
      const wd0 = wdOf(y, m, d);
      for (const wd of days.sort((a, b) => a - b)) {
        const t = new Date(Date.UTC(y, m - 1, d + (wd - wd0)));
        candidates.push([t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]);
      }
    } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
      const months = freq === 'YEARLY' ? byMonth || [startLocal.month] : [m];
      for (const mm of months) {
        const n = dim(y, mm);
        if (byMonthDay) {
          for (const md of byMonthDay) {
            const dd = md > 0 ? md : n + md + 1;
            if (dd >= 1 && dd <= n) candidates.push([y, mm, dd]);
          }
        } else if (byDay) {
          for (const b of byDay) {
            const matches = [];
            for (let dd = 1; dd <= n; dd++) if (wdOf(y, mm, dd) === b.wd) matches.push(dd);
            if (b.n === 0) matches.forEach((dd) => candidates.push([y, mm, dd]));
            else {
              const dd = b.n > 0 ? matches[b.n - 1] : matches[matches.length + b.n];
              if (dd) candidates.push([y, mm, dd]);
            }
          }
        } else {
          const dd = startLocal.day;
          if (dd <= n) candidates.push([y, mm, dd]);
        }
      }
      candidates.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    } else {
      return [startMs];
    }
    for (const [cy, cm, cd] of candidates) {
      if (!emit(toMs(cy, cm, cd))) return out;
    }
    // advance
    if (freq === 'DAILY') {
      const t = new Date(Date.UTC(y, m - 1, d + interval));
      [y, m, d] = [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
    } else if (freq === 'WEEKLY') {
      const t = new Date(Date.UTC(y, m - 1, d + 7 * interval));
      [y, m, d] = [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
    } else if (freq === 'MONTHLY') {
      m += interval;
      while (m > 12) { m -= 12; y++; }
      d = 1;
    } else {
      y += interval;
    }
    if (toMs(y, m, Math.min(d, 28)) > limitMs + 86400_000 * 31) break;
  }
  return out;
}

// Generation --------------------------------------------------------------------------------------

const fold = (line) => {
  const out = [];
  let s = line;
  while (Buffer.byteLength(s) > 74) {
    let n = 74;
    while (Buffer.byteLength(s.slice(0, n)) > 74) n--;
    out.push(s.slice(0, n));
    s = ' ' + s.slice(n);
  }
  out.push(s);
  return out.join('\r\n');
};

const icsUtc = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsDate = (s) => String(s).replace(/-/g, '');

export function buildIcs(events, { method = null, calName = 'Switchboard', organizer = null } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Switchboard//Mail and Calendar//EN', 'CALSCALE:GREGORIAN'];
  if (method) lines.push(`METHOD:${method}`);
  if (calName) lines.push(`X-WR-CALNAME:${escapeText(calName)}`);
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.uid || e.remote_id || `${e.id}@switchboard`}`);
    lines.push(`DTSTAMP:${icsUtc(Date.now())}`);
    if (e.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(e.start_date)}`);
      lines.push(`DTEND;VALUE=DATE:${icsDate(e.end_date)}`);
    } else {
      lines.push(`DTSTART:${icsUtc(e.start)}`);
      lines.push(`DTEND:${icsUtc(e.end)}`);
    }
    if (e.rrule) lines.push(`RRULE:${String(e.rrule).replace(/^RRULE:/i, '')}`);
    for (const x of e.exdates || []) lines.push(/^\d{4}-\d{2}-\d{2}$/.test(x) ? `EXDATE;VALUE=DATE:${icsDate(x)}` : `EXDATE:${icsUtc(x)}`);
    if (e.recurrence_id) lines.push(/^\d{4}-\d{2}-\d{2}$/.test(e.recurrence_id) ? `RECURRENCE-ID;VALUE=DATE:${icsDate(e.recurrence_id)}` : `RECURRENCE-ID:${icsUtc(e.recurrence_id)}`);
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.show_as === 'free') lines.push('TRANSP:TRANSPARENT');
    if (e.sequence) lines.push(`SEQUENCE:${e.sequence}`);
    if (method === 'CANCEL') lines.push('STATUS:CANCELLED');
    const org = organizer || (e.organizer ? { email: e.organizer } : null);
    if (org?.email) lines.push(`ORGANIZER${org.name ? `;CN=${escapeText(org.name)}` : ''}:mailto:${org.email}`);
    for (const a of e.attendees || []) {
      lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=${(a.status || 'NEEDS-ACTION').toUpperCase().replace('ACCEPTED', 'ACCEPTED')};RSVP=TRUE${a.name ? `;CN=${escapeText(a.name)}` : ''}:mailto:${a.email}`);
    }
    if (e.reminder_minutes != null) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.title)}`, `TRIGGER:-PT${Number(e.reminder_minutes)}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
