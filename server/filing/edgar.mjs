// The EDGAR connector: one interface for every way a Form D file reaches the SEC, and the guard that keeps a LIVE
// filing from happening by accident.
//
//   makeEdgar({ transport, env, now, holidays }) → {
//     allowLive()                        { ok, reason }: LIVE needs EDGAR_ALLOW_LIVE=1, and is always refused when the
//                                        server runs as a test (NODE_ENV=test)
//     submit({ xml, mode, filerCik })    hands a file to the transport; every LIVE passes allowLive() first, a file
//                                        whose own TEST or LIVE line differs from mode is refused, and nothing is sent
//                                        outside EDGAR's hours or while EDGAR reports itself closed
//     status({ accession })              the transport's status for a submission
//     openAt(ms)                         { open, nextOpen }: EDGAR takes submissions from 06:00 to 22:00 Eastern on
//                                        business days; nextOpen is the next 06:00 Eastern as an instant ('' when open)
//     filingDay(ms)                      the filing date of a submission made at that instant
//   }
//   transport = { name, submit({ xml, mode, filerCik }), status({ accession }), operational() }
//     staffTransport()        the route that works on the day access is granted: nothing is sent from this server; a
//                             staff person downloads the file and uploads it on EDGAR (Transmit XML Submission)
//     recordedTransport(...)  replies kept in files, for tests only. It can only be passed in by code: no setting selects
//                             it, so a running server can never report a made-up accession number.
//
// The file text carries the issuers' CCCs. Nothing here logs it, stores it, or puts it or a transport's error text into
// what it returns: a transport that throws is answered with { ok: false, error: true } and nothing else.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MODES = ['TEST', 'LIVE'];
const clip = (v, n) => (v === undefined || v === null ? '' : String(v).slice(0, n));

/** The calendar day and the minutes after midnight in New York (EDGAR's clock) at an instant. */
export function eastern(ms) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))) parts[p.type] = p.value;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/* ---------- Replies, as the SEC's Overview of EDGAR APIs (22 December 2025) draws them in figures B to E ---------- */
/** EDGAR's messages: [ { type: 'error' | 'warning', code, message } ], clipped. */
export function readMessages(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 50).map((m) => (m && typeof m === 'object' ? { type: clip(m.type, 20), code: clip(m.code, 20), message: clip(m.message, 500) } : { type: '', code: '', message: clip(m, 500) }));
}
const accessionOf = (raw) => clip(raw['accession number'] !== undefined ? raw['accession number'] : raw.accessionNumber, 40).replace(/\s+/g, '');
/** Figure B: { response: 'submitted', 'accession number' } or { response: 'rejected', messages }. */
export function readSubmission(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  if (r.response === 'submitted' && accessionOf(r)) return { ok: true, accession: accessionOf(r) };
  if (r.response === 'rejected') return { ok: false, rejected: true, messages: readMessages(r.messages) };
  return { ok: false, error: true };
}
/** Figure C: { status: 'accepted' (in progress) | 'disseminated' (complete) | 'suspended', 'accession number', messages }. */
export function readStatus(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const status = String(r.status || '').toLowerCase();
  if (!['accepted', 'disseminated', 'suspended'].includes(status)) return { error: true };
  return { status, accession: accessionOf(r), messages: readMessages(r.messages) };
}
/** Figure E. The overview's text and its figure give different words for the same states; only "accepting submissions" is read as open. */
export function readOperational(raw) {
  const status = clip(raw && typeof raw === 'object' ? raw.status : '', 80);
  return { open: /^accepting submissions/i.test(status), raw: status };
}

/* ---------- Transports ---------- */
/** Nothing leaves this server: staff download the file and upload it on EDGAR themselves. */
export function staffTransport() {
  return { name: 'staff', submit: async () => ({ ok: true, pending: 'staff' }) };
}

/**
 * Recorded replies, for tests. replies = { submit, status, operational }: each a reply, a list of replies used in order
 * (the last one repeats), or a function of the call. A reply given as text names a file in dir (<name>.json holding
 * { _source, reply }). Every call is kept in .calls, the file text included: that is the one copy a test may look at.
 */
export function recordedTransport(replies = {}, dir = '') {
  const calls = [];
  const load = (r) => {
    const v = typeof r === 'string' ? JSON.parse(readFileSync(join(dir, `${r}.json`), 'utf8')) : r;
    return v && typeof v === 'object' && v._source !== undefined && v.reply !== undefined ? v.reply : v;
  };
  const next = (key, call) => {
    let r = replies[key];
    if (typeof r === 'function') r = r(call);
    else if (Array.isArray(r)) r = r.length > 1 ? r.shift() : r[0];
    if (r === undefined) throw new Error(`no recorded reply for ${key}`);
    return load(r);
  };
  return {
    name: 'recorded',
    calls,
    async submit({ xml, mode, filerCik }) {
      const call = { op: 'submit', xml, mode, filerCik };
      calls.push(call);
      return readSubmission(next('submit', call));
    },
    async status({ accession }) {
      const call = { op: 'status', accession };
      calls.push(call);
      return readStatus(next('status', call));
    },
    async operational() {
      calls.push({ op: 'operational' });
      return readOperational(next('operational', {}));
    }
  };
}

/* ---------- The connector ---------- */
const OPENS = 6 * 60;
const CLOSES = 22 * 60;
/** A submission begun after 17:30 Eastern is filed the next business day (Regulation S-T, rule 13). Not yet seen in a reply from EDGAR. */
const SAME_DAY_UNTIL = 17 * 60 + 30;
const nextDay = (date) => new Date(Date.parse(`${date}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);

export function makeEdgar({ transport, env = {}, now = () => Date.now(), holidays } = {}) {
  const t = transport || staffTransport();
  const isBusinessDay = (date) => {
    const w = new Date(`${date}T12:00:00Z`).getUTCDay();
    return w !== 0 && w !== 6 && !(typeof holidays === 'function' ? holidays(Number(date.slice(0, 4))) : []).includes(date);
  };
  const nextBusinessDay = (date) => {
    let d = nextDay(date);
    while (!isBusinessDay(d)) d = nextDay(d);
    return d;
  };
  /** 06:00 Eastern on a calendar day, as an instant (New York is four or five hours behind UTC). */
  const opening = (date) => {
    for (const hours of [4, 5]) {
      const ms = Date.parse(`${date}T${String(6 + hours).padStart(2, '0')}:00:00Z`);
      const e = eastern(ms);
      if (e.date === date && e.minutes === OPENS) return new Date(ms).toISOString();
    }
    return '';
  };
  function openAt(ms = now()) {
    const e = eastern(ms);
    const business = isBusinessDay(e.date);
    if (business && e.minutes >= OPENS && e.minutes < CLOSES) return { open: true, nextOpen: '' };
    return { open: false, nextOpen: opening(business && e.minutes < OPENS ? e.date : nextBusinessDay(e.date)) };
  }
  function filingDay(ms = now()) {
    const e = eastern(ms);
    return isBusinessDay(e.date) && e.minutes <= SAME_DAY_UNTIL ? e.date : nextBusinessDay(e.date);
  }

  /** The guard. Every LIVE file and every LIVE submission asks it first. */
  function allowLive() {
    if (env.NODE_ENV === 'test') return { ok: false, reason: 'This server runs as a test, and a test never files a live notice' };
    if (env.EDGAR_ALLOW_LIVE !== '1') return { ok: false, reason: 'Live filing is off on this server (EDGAR_ALLOW_LIVE is not 1)' };
    return { ok: true, reason: '' };
  }

  async function submit({ xml, mode, filerCik } = {}) {
    if (!MODES.includes(mode)) return { ok: false, refused: true, reason: 'mode must be TEST or LIVE' };
    if (mode === 'LIVE') {
      const g = allowLive();
      if (!g.ok) return { ok: false, refused: true, reason: g.reason };
    }
    // The file says itself whether it is a test: a LIVE file never rides on a TEST call.
    const line = /<testOrLive>([^<]*)<\/testOrLive>/.exec(String(xml));
    if (!line || line[1] !== mode) return { ok: false, refused: true, reason: 'The file’s own TEST or LIVE line does not match the mode asked for' };
    if (t.name === 'staff') return { ok: true, pending: 'staff' };
    const hours = openAt(now());
    if (!hours.open) return { ok: false, closed: true, nextOpen: hours.nextOpen };
    if (typeof t.operational === 'function') {
      let op;
      try {
        op = await t.operational();
      } catch {
        return { ok: false, error: true };
      }
      if (!op || op.open !== true) return { ok: false, closed: true, nextOpen: '' };
    }
    try {
      const r = await t.submit({ xml: String(xml), mode, filerCik: clip(filerCik, 10) });
      if (r && r.ok === true && r.accession) return { ok: true, accession: clip(r.accession, 40) };
      if (r && r.rejected) return { ok: false, rejected: true, messages: readMessages(r.messages) };
      return { ok: false, error: true };
    } catch {
      return { ok: false, error: true };
    }
  }

  async function status({ accession } = {}) {
    if (typeof t.status !== 'function') return { error: true };
    try {
      const r = await t.status({ accession: clip(accession, 40) });
      return r && ['accepted', 'disseminated', 'suspended'].includes(r.status) ? { status: r.status, messages: readMessages(r.messages) } : { error: true };
    } catch {
      return { error: true };
    }
  }

  return { transport: t.name, allowLive, submit, status, openAt, filingDay };
}
