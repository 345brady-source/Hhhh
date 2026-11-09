// Repeating events: one description, translated for each calendar type.
import { expandRRule } from './ics.js';
import { zonedParts, localDate, WINDOWS_ZONES } from './time.js';

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_NAMES = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };
const GRAPH_DAYS = { SU: 'sunday', MO: 'monday', TU: 'tuesday', WE: 'wednesday', TH: 'thursday', FR: 'friday', SA: 'saturday' };
const ALIASES = { sun: 'SU', sunday: 'SU', mon: 'MO', monday: 'MO', tue: 'TU', tues: 'TU', tuesday: 'TU', wed: 'WE', wednesday: 'WE', thu: 'TH', thur: 'TH', thurs: 'TH', thursday: 'TH', fri: 'FR', friday: 'FR', sat: 'SA', saturday: 'SA' };

export function parseRRule(rrule) {
  const out = {};
  for (const part of String(rrule || '').replace(/^RRULE:/i, '').split(';')) {
    const [k, v] = part.split('=');
    if (k && v) out[k.toUpperCase()] = v;
  }
  return out;
}

function dayCode(d) {
  const s = String(d).trim();
  const m = s.match(/^(-?\d)?([A-Za-z]{2,})$/);
  if (!m) throw new Error(`Unknown weekday "${d}"`);
  const code = m[2].length === 2 ? m[2].toUpperCase() : ALIASES[m[2].toLowerCase()];
  if (!DAYS.includes(code)) throw new Error(`Unknown weekday "${d}"`);
  return (m[1] || '') + code;
}

/**
 * Accepts an RRULE string ("FREQ=WEEKLY;BYDAY=MO,WE") or
 * { frequency: daily|weekly|weekdays|monthly|yearly, interval, days: ["MO","WE"], count, until: "YYYY-MM-DD" }.
 * start is the first occurrence (ISO instant) used for defaults like the weekday.
 */
export function toRRule(rec, { start, allDay = false, tz = 'UTC' } = {}) {
  if (!rec) return null;
  if (typeof rec === 'string') {
    const r = parseRRule(rec);
    if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(r.FREQ)) throw new Error('Recurrence must be daily, weekly, monthly or yearly.');
    return rec.replace(/^RRULE:/i, '');
  }
  let freq = String(rec.frequency || rec.freq || '').toLowerCase();
  let days = rec.days || rec.by_day || rec.byday;
  if (freq === 'weekdays' || freq === 'weekday') {
    freq = 'weekly';
    days = ['MO', 'TU', 'WE', 'TH', 'FR'];
  }
  const map = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY', annually: 'YEARLY' };
  if (!map[freq]) throw new Error('Recurrence frequency must be daily, weekdays, weekly, monthly or yearly.');
  const parts = [`FREQ=${map[freq]}`];
  const interval = Number(rec.interval || 1);
  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  if (days) {
    const list = (Array.isArray(days) ? days : String(days).split(/[,\s]+/)).filter(Boolean).map(dayCode);
    if (list.length) parts.push(`BYDAY=${list.join(',')}`);
  } else if (freq === 'weekly' && start) {
    parts.push(`BYDAY=${DAYS[new Date(Date.parse(start)).getTime() ? weekdayIndex(start, tz) : 0]}`);
  }
  if (rec.count) parts.push(`COUNT=${Number(rec.count)}`);
  else if (rec.until) {
    const u = String(rec.until).slice(0, 10).replace(/-/g, '');
    parts.push(allDay ? `UNTIL=${u}` : `UNTIL=${u}T235959Z`);
  }
  return parts.join(';');
}

function weekdayIndex(iso, tz) {
  const p = zonedParts(new Date(iso), tz);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

export function describeRRule(rrule) {
  if (!rrule) return null;
  const r = parseRRule(rrule);
  const n = Number(r.INTERVAL || 1);
  const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[r.FREQ] || 'time';
  let text = n > 1 ? `Every ${n} ${unit}s` : { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' }[r.FREQ] || 'Repeats';
  if (r.BYDAY) {
    const days = r.BYDAY.split(',');
    if (r.FREQ === 'WEEKLY' && days.length === 5 && ['MO', 'TU', 'WE', 'TH', 'FR'].every((d) => days.includes(d))) text = n > 1 ? text + ' on weekdays' : 'Every weekday';
    else {
      const ord = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', '-1': 'last' };
      text += ' on ' + days.map((d) => { const m = d.match(/^(-?\d)?(\w\w)$/); return (m[1] ? `the ${ord[m[1]] || m[1]} ` : '') + DAY_NAMES[m[2]]; }).join(', ');
    }
  }
  if (r.COUNT) text += `, ${r.COUNT} times`;
  else if (r.UNTIL) text += `, until ${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}`;
  return text;
}

/** Microsoft Graph patternedRecurrence for an RRULE. */
export function toGraphRecurrence(rrule, startIso, tz) {
  const r = parseRRule(rrule);
  const start = localDate(new Date(startIso), tz);
  const p = zonedParts(new Date(startIso), tz);
  const interval = Number(r.INTERVAL || 1);
  const days = (r.BYDAY || '').split(',').filter(Boolean);
  let pattern;
  if (r.FREQ === 'DAILY') pattern = { type: 'daily', interval };
  else if (r.FREQ === 'WEEKLY') pattern = { type: 'weekly', interval, daysOfWeek: (days.length ? days : [DAYS[weekdayIndex(startIso, tz)]]).map((d) => GRAPH_DAYS[d.slice(-2)]), firstDayOfWeek: 'sunday' };
  else if (r.FREQ === 'MONTHLY' && days.length && /^-?\d/.test(days[0])) {
    const idx = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', '-1': 'last' }[days[0].slice(0, -2)] || 'first';
    pattern = { type: 'relativeMonthly', interval, daysOfWeek: [GRAPH_DAYS[days[0].slice(-2)]], index: idx };
  } else if (r.FREQ === 'MONTHLY') pattern = { type: 'absoluteMonthly', interval, dayOfMonth: Number(r.BYMONTHDAY || p.day) };
  else pattern = { type: 'absoluteYearly', interval, dayOfMonth: p.day, month: p.month };
  const zone = Object.entries(WINDOWS_ZONES).find(([, iana]) => iana === tz)?.[0] || tz;
  let range = { type: 'noEnd', startDate: start, recurrenceTimeZone: zone };
  if (r.COUNT) range = { type: 'numbered', startDate: start, numberOfOccurrences: Number(r.COUNT), recurrenceTimeZone: zone };
  else if (r.UNTIL) range = { type: 'endDate', startDate: start, endDate: `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}`, recurrenceTimeZone: zone };
  return { pattern, range };
}

/** Occurrence start instants (ms) for an event kept on this computer. */
export function expandLocal(rrule, { start, allDay, tz, from, to, max = 730 }) {
  return expandRRule(rrule, { start, all_day: allDay, _tz: tz }, { from, to, max });
}
