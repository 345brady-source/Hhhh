/*
 * Filings (self-serve edition): the record of what was filed and ordered for each offering's Form D and state notices,
 * and the reminders worked out from it.
 *
 * The record holds facts only (what was filed, when, where, what was ordered, which reminders the sponsor silenced).
 * Every due date is worked out from those facts on each call and never stored, so a reminder cannot go stale. Nothing
 * secret is kept here: the record has no place for an EDGAR access code or a token, and what is written through this
 * file has any such key removed.
 *
 * This file touches nothing when it loads, so it also loads outside a browser (module.exports under Node). The pure
 * parts (holidays, businessDay) need nothing else; applies, facts, due and count read NS.eligibility (eligibility.js)
 * when they are called.
 *
 * ws.filings = { v: 1, offerings: { [offeringId]: rec }, orders: [], silenced: {} }, created by ensure(ws).
 *   rec = { mode: '' | 'portal' | 'self' | 'none', opened, firstSale: '' | 'YYYY-MM-DD', ended: '' | 'YYYY-MM-DD',
 *           issuer: { street1, street2, city, state, zip, phone, entityType, entityTypeOther, yearKind, yearFormed,
 *                     previousNames: [], signerName, signerTitle },
 *           edgar: { cik, name, singleMember, steps: { [stepKey]: { done, at } } },
 *           formD: [ { id, type: 'D' | 'D/A', status, draft, signoff, filedOn, accession, snapshot, source, orderId } ],
 *           states: { [code]: { status, filedOn, efdId, feeCents, quotedCents, renewsOn, source } } }
 *   mode none: the sponsor marked the offering as not filing, and it has no reminders. mode self: the sponsor files
 *   themselves, and reminders still run. A Form D notice counts as filed when its status is accepted and filedOn is set.
 *
 *   ensure(ws)                  the record, created once
 *   rec(ws, offeringId)         the offering's entry, created with every key (null for an unknown offering)
 *   applies(offering)           true for a Rule 506(b) or Rule 506(c) offering: the ones that file Form D
 *   facts(ws, offering)         { regime, usd, firstSale, firstSaleSuggested, sold, investors, byState }
 *   holidays(year)              the federal holidays' observed days that fall in that calendar year, 'YYYY-MM-DD', in order
 *   businessDay(iso)            that day, or the first day after it that is not a Saturday, Sunday or federal holiday
 *   due(ws, today, opts)        [ { key, kind, offeringId, state?, due: 'YYYY-MM-DD' | null, basis, level, silenced } ]
 *   count(ws, today, opts)      how many reminders are due or overdue and not silenced
 *   recordFiled(ws, offeringId, notice)   an accepted notice: { id?, type, filedOn, accession, snapshot, source, orderId }
 *
 * A sale (one definition, used for every figure): a subscription request that is approved, funded or accepted (its
 * amount, on the day it was decided), or a holding that does not come from such a request (its commitment where it has
 * one, otherwise its amount, on its date). A holding and its request are never both counted; a redeemed holding still
 * counts; declined subscriptions and redemptions never count.
 *
 * Reminder kinds and their basis:
 *   formd-first   due 15 calendar days after the first sale, moved to the next business day; basis { firstSale, confirmed }
 * Levels: overdue once today is after the due date; due when the calendar deadline is within the reminder's lead
 * (15 days for a first notice, so from the day of the first sale); soon within the lead plus 30 days; later beyond.
 */
(function (NS) {
  'use strict';

  /* ---------- Dates: plain 'YYYY-MM-DD' text ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const utc = (iso) => {
    const p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  };
  const isoOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  /** The date at the start of a value as 'YYYY-MM-DD', or '' when it is not a real date. */
  const day = (s) => {
    const t = String(s == null ? '' : s).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(t) && isoOf(utc(t)) === t ? t : '';
  };
  const addDays = (iso, n) => isoOf(new Date(utc(iso).getTime() + n * 86400000));
  const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
  const todayIso = () => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  };

  /* ---------- Federal holidays (5 U.S.C. 6103) ---------- */
  /** Day of the month of the k-th given weekday of a month (k = -1: the last one). Months count from 1. */
  function nthWeekday(y, m, weekday, k) {
    if (k > 0) return 1 + ((weekday - new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 7) % 7) + (k - 1) * 7;
    const last = new Date(Date.UTC(y, m, 0));
    return last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7);
  }
  /** The eleven holidays of a year on their own dates (Juneteenth from 2021, the year it became one). */
  function holidayDates(y) {
    const d = (m, n) => `${y}-${pad(m)}-${pad(n)}`;
    return [d(1, 1), d(1, nthWeekday(y, 1, 1, 3)), d(2, nthWeekday(y, 2, 1, 3)), d(5, nthWeekday(y, 5, 1, -1))]
      .concat(y >= 2021 ? [d(6, 19)] : [])
      .concat([d(7, 4), d(9, nthWeekday(y, 9, 1, 1)), d(10, nthWeekday(y, 10, 1, 2)), d(11, 11), d(11, nthWeekday(y, 11, 4, 4)), d(12, 25)]);
  }
  /** A holiday on a Saturday is observed the Friday before; on a Sunday, the Monday after. */
  const observed = (iso) => {
    const w = utc(iso).getUTCDay();
    return w === 6 ? addDays(iso, -1) : w === 0 ? addDays(iso, 1) : iso;
  };
  const holidayCache = {};
  /**
   * The observed federal holidays that fall in a calendar year, in order. When 1 January of the next year is a Saturday
   * its observed day is 31 December of this year, and it is listed here.
   */
  function holidays(year) {
    const y = Math.floor(Number(year));
    if (!(y >= 1971 && y <= 9998)) return [];
    if (!holidayCache[y]) {
      holidayCache[y] = holidayDates(y)
        .concat([`${y + 1}-01-01`])
        .map(observed)
        .filter((x) => x.slice(0, 4) === String(y))
        .sort();
    }
    return holidayCache[y].slice();
  }
  const isBusinessDay = (iso) => {
    const w = utc(iso).getUTCDay();
    return w !== 0 && w !== 6 && holidays(iso.slice(0, 4)).indexOf(iso) < 0;
  };
  /** The Form D instructions: a due date on a Saturday, Sunday or holiday becomes the first business day following. */
  function businessDay(iso) {
    let d = day(iso);
    if (!d) return '';
    while (!isBusinessDay(d)) d = addDays(d, 1);
    return d;
  }

  /* ---------- The record ---------- */
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const save = (ws) => NS && NS.workspace && NS.workspace.save(ws);
  /** A copy for the record with any key that could hold a secret left out (the record keeps none). */
  const SECRET = /^ccc$|token|secret|password/i;
  function clean(v) {
    if (Array.isArray(v)) return v.map(clean);
    if (!v || typeof v !== 'object') return v;
    const out = {};
    Object.keys(v).forEach((k) => {
      if (!SECRET.test(k)) out[k] = clean(v[k]);
    });
    return out;
  }
  const blankIssuer = () => ({ street1: '', street2: '', city: '', state: '', zip: '', phone: '', entityType: '', entityTypeOther: '', yearKind: '', yearFormed: '', previousNames: [], signerName: '', signerTitle: '' });
  const blankRec = () => ({ mode: '', opened: false, firstSale: '', ended: '', issuer: blankIssuer(), edgar: { cik: '', name: '', singleMember: null, steps: {} }, formD: [], states: {} });
  /** Keys a stored value lacks are added from the blank shape (stored data from an earlier build keeps loading). */
  function fill(target, blank) {
    Object.keys(blank).forEach((k) => {
      if (!own(target, k) || target[k] == null) {
        if (!(own(target, k) && blank[k] === null)) target[k] = blank[k];
      } else if (blank[k] && typeof blank[k] === 'object' && !Array.isArray(blank[k]) && typeof target[k] === 'object' && !Array.isArray(target[k])) fill(target[k], blank[k]);
    });
    return target;
  }
  function ensure(ws) {
    if (!ws.filings || typeof ws.filings !== 'object' || Array.isArray(ws.filings)) ws.filings = { v: 1, offerings: {}, orders: [], silenced: {} };
    return fill(ws.filings, { v: 1, offerings: {}, orders: [], silenced: {} });
  }
  const offeringOf = (ws, id) => ((ws && ws.offerings) || []).find((o) => o && o.id === id) || null;
  function rec(ws, offeringId) {
    if (!offeringOf(ws, offeringId)) return null;
    const f = ensure(ws);
    if (!own(f.offerings, offeringId) || !f.offerings[offeringId] || typeof f.offerings[offeringId] !== 'object') f.offerings[offeringId] = blankRec();
    return fill(f.offerings[offeringId], blankRec());
  }
  /** The offering's entry for reading: the stored one laid over the blank shape, with nothing written to the workspace. */
  function peek(ws, offeringId) {
    const all = ws && ws.filings && ws.filings.offerings;
    const stored = all && own(all, offeringId) && all[offeringId] && typeof all[offeringId] === 'object' ? all[offeringId] : {};
    const r = Object.assign(blankRec(), stored);
    if (!Array.isArray(r.formD)) r.formD = [];
    if (!r.states || typeof r.states !== 'object') r.states = {};
    return r;
  }
  function newId(list, prefix) {
    const base = `${prefix}-${Date.now().toString(36)}`;
    let id = base;
    for (let n = 2; list.some((x) => x && x.id === id); n++) id = `${base}-${n}`;
    return id;
  }

  /* ---------- Offering facts ---------- */
  function regimeOf(o) {
    if (!NS || !NS.eligibility) throw new Error('filings: eligibility.js must be loaded before applies, facts, due or count are called');
    return NS.eligibility.regime(o);
  }
  /** Form D is filed for Rule 506(b) and Rule 506(c) offerings; the portal offers no other Regulation D exemption. */
  const applies = (o) => {
    const g = regimeOf(o);
    return g === '506b' || g === '506c';
  };

  const SOLD = ['approved', 'funded', 'accepted'];
  /** Every sale of an offering: [ { investorId, amount (in the offering's currency units), date } ]. See the header. */
  function sales(ws, o) {
    const out = [];
    const counted = {};
    ((ws && ws.requests) || []).forEach((r) => {
      if (!r || r.type !== 'subscription' || r.offeringId !== o.id || SOLD.indexOf(r.status) < 0) return;
      counted[`#${r.id}`] = true;
      // The day it was decided; a request on file without one (brought in from elsewhere) falls back to its other dates.
      out.push({ investorId: r.investorId, amount: (Number(r.cents) || 0) / 100, date: day(r.decided) || day(r.completed) || day(r.submitted) });
    });
    ((ws && ws.investors) || []).forEach((i) => {
      ((i && i.positions) || []).forEach((p) => {
        if (!p || p.offeringId !== o.id || (p.ref != null && counted[`#${p.ref}`])) return;
        out.push({ investorId: i.id, amount: Number(p.commitment != null ? p.commitment : p.amount) || 0, date: day(p.date) });
      });
    });
    return out;
  }
  /** { firstSale, sold, investors } of a list of sales: the earliest date, whole units sold, each investor once. */
  function tally(list) {
    const seen = {};
    let first = '';
    let sum = 0;
    list.forEach((s) => {
      seen[`#${s.investorId}`] = true;
      sum += s.amount;
      if (s.date && (!first || s.date < first)) first = s.date;
    });
    return { firstSale: first, sold: Math.round(sum), investors: Object.keys(seen).length };
  }

  const STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico', VI: 'Virgin Islands', GU: 'Guam', AS: 'American Samoa', MP: 'Northern Mariana Islands' };
  const ZIP = '(?:[ ,]+\\d{5}(?:-\\d{4})?)?\\s*$';
  const CODE_AT_END = new RegExp(`(?:,|\\s)\\s*([A-Z]{2})${ZIP}`);
  const NAME_AT_END = new RegExp(`(?:^|,|\\s)\\s*(${Object.keys(STATES).map((k) => STATES[k]).join('|')})${ZIP}`, 'i');
  const CODE_OF_NAME = {};
  Object.keys(STATES).forEach((k) => (CODE_OF_NAME[STATES[k].toLowerCase()] = k));
  const isUSA = (c) => /^(u\.?s\.?(a\.?)?|united states(?: of america)?)$/i.test(String(c || '').trim());
  /**
   * Where an investor's address on file places them: a U.S. state or territory code (the address ends "City, ST 12345",
   * with or without the ZIP code, the state as its code or its name), 'abroad' (the record names another country, or the
   * address names no U.S. state and has no U.S. ZIP code), or '' when it cannot be told (no address, or a ZIP code
   * with no state).
   */
  function placeOf(inv) {
    if (!inv) return '';
    if (inv.country && !isUSA(inv.country)) return 'abroad';
    const a = String(inv.address || '').trim().replace(/[,\s]*\b(?:USA|U\.S\.A\.|U\.S\.|United States(?: of America)?)\.?$/i, '').trim();
    if (!a) return '';
    const c = a.match(CODE_AT_END);
    if (c && own(STATES, c[1])) return c[1];
    const n = a.match(NAME_AT_END);
    if (n) return CODE_OF_NAME[n[1].toLowerCase()];
    return /\d{5}(?:-\d{4})?$/.test(a) ? '' : 'abroad';
  }

  /**
   * What the workspace says about an offering, for its filings. firstSale is the sponsor's confirmed date where one is
   * on the record, otherwise the suggestion (the earliest sale). Amounts are whole U.S. dollars.
   */
  function facts(ws, o) {
    const r = peek(ws, o.id);
    const list = sales(ws, o);
    const all = tally(list);
    const byId = {};
    ((ws && ws.investors) || []).forEach((i) => i && (byId[`#${i.id}`] = i));
    const groups = {};
    list.forEach((s) => {
      const where = placeOf(byId[`#${s.investorId}`]);
      (groups[where] = groups[where] || []).push(s);
    });
    const byState = {};
    Object.keys(groups)
      .filter((k) => own(STATES, k))
      .sort()
      .forEach((k) => (byState[k] = tally(groups[k])));
    const usd = String(o.currency || 'USD') === 'USD';
    return { regime: regimeOf(o), usd, firstSale: day(r.firstSale) || all.firstSale, firstSaleSuggested: all.firstSale, sold: usd ? all.sold : null, investors: all.investors, byState };
  }

  /* ---------- Reminders ---------- */
  const LEAD = { 'formd-first': 15, 'state-first': 15, 'formd-annual': 30, 'state-renewal': 30, 'formd-change': 0 };
  /**
   * target: the calendar deadline before it is moved off a weekend or holiday (the lead is measured to it, so a first
   * notice is due from the day of the first sale); due: the moved date (overdue is measured from it).
   */
  function levelOf(kind, due, target, today) {
    if (!due) return 'due';
    if (today > due) return 'overdue';
    const left = daysBetween(today, target);
    return left <= LEAD[kind] ? 'due' : left <= LEAD[kind] + 30 ? 'soon' : 'later';
  }
  const filedNotices = (r) => r.formD.filter((n) => n && n.status === 'accepted' && day(n.filedOn));

  function due(ws, today, opts) {
    const now = day(today) || todayIso();
    const out = [];
    ((ws && ws.offerings) || []).forEach((o) => {
      if (!o || !applies(o)) return;
      const r = peek(ws, o.id);
      if (r.mode === 'none') return;
      const f = facts(ws, o);
      const add = (kind, key, date, target, basis, more) => out.push(Object.assign({ key, kind, offeringId: o.id }, more || {}, { due: date, basis, level: levelOf(kind, date, target, now), silenced: false }));
      if (!filedNotices(r).length && f.firstSale) {
        const target = addDays(f.firstSale, 15);
        add('formd-first', `formd-first:${o.id}`, businessDay(target), target, { firstSale: f.firstSale, confirmed: !!day(r.firstSale) });
      }
    });
    return out;
  }
  const count = (ws, today, opts) => due(ws, today, opts).filter((x) => !x.silenced && (x.level === 'due' || x.level === 'overdue')).length;

  /* ---------- Writing the record ---------- */
  /**
   * An accepted notice: the entry with notice.id is updated, or a new one is added. notice: { id?, type: 'D' | 'D/A',
   * filedOn, accession, snapshot, source: 'portal' | 'self', orderId }. Returns the entry, or null when the offering is
   * unknown or the notice has no type or filing date.
   */
  function recordFiled(ws, offeringId, notice) {
    const n = notice || {};
    const filedOn = day(n.filedOn);
    const r = rec(ws, offeringId);
    if (!r || !filedOn || (n.type !== 'D' && n.type !== 'D/A')) return null;
    let e = n.id ? r.formD.find((x) => x && x.id === n.id) : null;
    if (!e) {
      e = { id: n.id ? String(n.id) : newId(r.formD, 'fd'), type: n.type, status: 'accepted', draft: null, signoff: null, filedOn, accession: '', snapshot: null, source: 'portal', orderId: '' };
      r.formD.push(e);
    }
    e.type = n.type;
    e.status = 'accepted';
    e.filedOn = filedOn;
    if (n.accession != null) e.accession = String(n.accession);
    if (n.snapshot !== undefined) e.snapshot = n.snapshot ? clean(n.snapshot) : null;
    if (n.draft !== undefined) e.draft = n.draft ? clean(n.draft) : null;
    if (n.signoff !== undefined) e.signoff = n.signoff ? clean(n.signoff) : null;
    if (n.source === 'self' || n.source === 'portal') e.source = n.source;
    if (n.orderId != null) e.orderId = String(n.orderId);
    save(ws);
    return e;
  }

  const API = { ensure, rec, applies, facts, holidays, businessDay, due, count, recordFiled };
  if (NS) NS.filings = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
