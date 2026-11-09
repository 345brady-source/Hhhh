// Time-zone helpers built on Intl only (no dependencies).

export function systemTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function isValidTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

const partsCache = new Map();
function formatter(tz) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a zone. */
export function zonedParts(date, tz) {
  const p = {};
  for (const { type, value } of formatter(tz).formatToParts(date)) p[type] = value;
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour % 24, minute: +p.minute, second: +p.second, weekday: p.weekday,
  };
}

/** Offset of tz from UTC at the given instant, in minutes (e.g. -300 for EST). */
export function offsetMinutes(date, tz) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Convert a wall-clock time in tz to a UTC Date (handles DST). */
export function wallTimeToUtc(year, month, day, hour = 0, minute = 0, second = 0, tz = 'UTC') {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  let off = offsetMinutes(new Date(guess), tz);
  let result = guess - off * 60000;
  const off2 = offsetMinutes(new Date(result), tz);
  if (off2 !== off) result = guess - off2 * 60000;
  return new Date(result);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * Parse a date/time a person or Claude typed.
 * "2026-11-10" -> midnight in tz; "2026-11-10T14:30" -> 2:30pm in tz;
 * "2026-11-10T14:30:00-05:00" or "...Z" -> that exact instant.
 */
export function parseDateTime(value, tz = 'UTC') {
  if (value instanceof Date) return value;
  if (value == null || value === '') return null;
  const s = String(value).trim();
  let m = s.match(DATE_ONLY);
  if (m) return wallTimeToUtc(+m[1], +m[2], +m[3], 0, 0, 0, tz);
  m = s.match(DATE_TIME);
  if (m) {
    if (m[7]) {
      const d = new Date(s.replace(' ', 'T'));
      if (!isNaN(d)) return d;
    }
    return wallTimeToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0), tz);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function isDateOnly(value) {
  return typeof value === 'string' && DATE_ONLY.test(value.trim());
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** "2026-11-10" for an instant as seen in tz. */
export function localDate(date, tz) {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "2026-11-10T14:30:00-05:00" — local wall time with offset, good for Claude to read. */
export function toZonedIso(date, tz) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  const p = zonedParts(d, tz);
  const off = offsetMinutes(d, tz);
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** Human description: "Tue, Nov 10, 2026, 2:30 PM". */
export function describe(date, tz, opts = {}) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    ...(opts.dateOnly ? {} : { hour: 'numeric', minute: '2-digit' }),
  }).format(d);
}

export function addDaysToDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayName(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Start of the local day (in tz) containing the instant, as UTC Date. */
export function startOfLocalDay(date, tz) {
  const [y, m, d] = localDate(date, tz).split('-').map(Number);
  return wallTimeToUtc(y, m, d, 0, 0, 0, tz);
}

// Windows time-zone names appear in Outlook/Exchange invitations. Map the common ones.
export const WINDOWS_ZONES = {
  'Dateline Standard Time': 'Etc/GMT+12', 'UTC-11': 'Etc/GMT+11', 'Hawaiian Standard Time': 'Pacific/Honolulu',
  'Alaskan Standard Time': 'America/Anchorage', 'Pacific Standard Time': 'America/Los_Angeles',
  'Pacific Standard Time (Mexico)': 'America/Tijuana', 'US Mountain Standard Time': 'America/Phoenix',
  'Mountain Standard Time': 'America/Denver', 'Mountain Standard Time (Mexico)': 'America/Mazatlan',
  'Central Standard Time': 'America/Chicago', 'Central Standard Time (Mexico)': 'America/Mexico_City',
  'Canada Central Standard Time': 'America/Regina', 'Central America Standard Time': 'America/Guatemala',
  'Eastern Standard Time': 'America/New_York', 'US Eastern Standard Time': 'America/Indianapolis',
  'SA Pacific Standard Time': 'America/Bogota', 'Atlantic Standard Time': 'America/Halifax',
  'Venezuela Standard Time': 'America/Caracas', 'SA Western Standard Time': 'America/La_Paz',
  'Pacific SA Standard Time': 'America/Santiago', 'Newfoundland Standard Time': 'America/St_Johns',
  'E. South America Standard Time': 'America/Sao_Paulo', 'Argentina Standard Time': 'America/Buenos_Aires',
  'Greenland Standard Time': 'America/Godthab', 'Azores Standard Time': 'Atlantic/Azores',
  'UTC': 'UTC', 'Coordinated Universal Time': 'UTC', 'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'W. Europe Standard Time': 'Europe/Berlin', 'Central Europe Standard Time': 'Europe/Budapest',
  'Romance Standard Time': 'Europe/Paris', 'Central European Standard Time': 'Europe/Warsaw',
  'W. Central Africa Standard Time': 'Africa/Lagos', 'GTB Standard Time': 'Europe/Bucharest',
  'E. Europe Standard Time': 'Europe/Chisinau', 'Egypt Standard Time': 'Africa/Cairo',
  'South Africa Standard Time': 'Africa/Johannesburg', 'FLE Standard Time': 'Europe/Kiev',
  'Israel Standard Time': 'Asia/Jerusalem', 'Jordan Standard Time': 'Asia/Amman', 'Turkey Standard Time': 'Europe/Istanbul',
  'Arabic Standard Time': 'Asia/Baghdad', 'Arab Standard Time': 'Asia/Riyadh', 'Russian Standard Time': 'Europe/Moscow',
  'E. Africa Standard Time': 'Africa/Nairobi', 'Iran Standard Time': 'Asia/Tehran', 'Arabian Standard Time': 'Asia/Dubai',
  'Afghanistan Standard Time': 'Asia/Kabul', 'Pakistan Standard Time': 'Asia/Karachi', 'India Standard Time': 'Asia/Kolkata',
  'Sri Lanka Standard Time': 'Asia/Colombo', 'Nepal Standard Time': 'Asia/Katmandu', 'Bangladesh Standard Time': 'Asia/Dhaka',
  'Myanmar Standard Time': 'Asia/Rangoon', 'SE Asia Standard Time': 'Asia/Bangkok', 'China Standard Time': 'Asia/Shanghai',
  'Singapore Standard Time': 'Asia/Singapore', 'Taipei Standard Time': 'Asia/Taipei', 'W. Australia Standard Time': 'Australia/Perth',
  'Tokyo Standard Time': 'Asia/Tokyo', 'Korea Standard Time': 'Asia/Seoul', 'Cen. Australia Standard Time': 'Australia/Adelaide',
  'AUS Central Standard Time': 'Australia/Darwin', 'E. Australia Standard Time': 'Australia/Brisbane',
  'AUS Eastern Standard Time': 'Australia/Sydney', 'Tasmania Standard Time': 'Australia/Hobart',
  'West Pacific Standard Time': 'Pacific/Port_Moresby', 'New Zealand Standard Time': 'Pacific/Auckland',
};

export function normalizeTimeZone(tz, fallback = 'UTC') {
  if (!tz) return fallback;
  const t = String(tz).replace(/^"|"$/g, '').trim();
  if (isValidTimeZone(t)) return t;
  if (WINDOWS_ZONES[t]) return WINDOWS_ZONES[t];
  const stripped = t.replace(/^\/[^/]+\/[^/]+\//, ''); // "/mozilla.org/20050126_1/America/New_York"
  if (isValidTimeZone(stripped)) return stripped;
  return fallback;
}
