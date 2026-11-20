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
 *   facts(ws, offering)         { regime, usd, firstSale, firstSaleSuggested, sold, investors,
 *                                 nonAccredited: { count, pending, unanswered }, total: integer | 'Indefinite' | null,
 *                                 minimum: integer | null, byState: { [code]: group }, outsideUS: group, unplaced: group }
 *                               group = { firstSale, sold, investors }. count: non-accredited investors who have
 *                               invested; pending: those whose subscription is not decided yet. unplaced: investors
 *                               whose state cannot be told from the address on file. Amounts are whole U.S. dollars;
 *                               an offering in another currency has usd false and null amounts (no rate is applied).
 *   holidays(year)              the federal holidays' observed days that fall in that calendar year, 'YYYY-MM-DD', in order
 *   businessDay(iso)            that day, or the first day after it that is not a Saturday, Sunday or federal holiday
 *   due(ws, today, opts)        [ { key, kind, offeringId, state?, due: 'YYYY-MM-DD' | null, basis, level, silenced } ]
 *                               opts.states: the state table { [code]: { days, noticeRequired, confirmed } }
 *   count(ws, today, opts)      how many reminders are due or overdue and not silenced
 *   changeNeeded(last, now)     [ { item, from, to } ]: what in two snapshots needs an amendment (empty: nothing)
 *   silence(ws, key, by), unsilence(ws, key)      true when the key names a reminder (or offering:<id>) and was changed
 *   PRICES                      cents per service: formd, formd-amendment, bluesky, bluesky-renewal
 *   orderLines(kind, { passThrough })             { lines: [ { label, cents, passThrough, state? } ], dueCents, openFees }
 *   addOrder(ws, { kind, offeringId, by, passThrough, package })   the order, status recorded (null: unknown offering)
 *   cancelOrder(ws, id)         true when a recorded order was cancelled
 *   setIssuer(ws, offeringId, patch), setEdgar(ws, offeringId, patch)   the known keys only
 *   recordFiled(ws, offeringId, notice)   an accepted notice: { id?, type, filedOn, accession, snapshot, source, orderId }
 *   recordState(ws, offeringId, code, patch)      a state's entry; the state counts as filed once filedOn is set
 * Every writer saves the workspace where NS.workspace is loaded; addOrder and cancelOrder also write the change log.
 *
 * snapshot (what a filed notice said, made by the Form D builder and compared by changeNeeded):
 *   { minimumInvestment, totalOffering: integer | 'Indefinite', nonAccredited, commissions, findersFees,
 *     proceedsToInsiders, relatedPersons: [ 'first|middle|last' in lower case ], material: text }
 *
 * A sale (one definition, used for every figure): a subscription request that is approved, funded or accepted (its
 * amount, on the day it was decided), or a holding that does not come from such a request (its commitment where it has
 * one, otherwise its amount, on its date). A holding and its request are never both counted; a redeemed holding still
 * counts; declined subscriptions and redemptions never count.
 *
 * Reminder kinds and their basis:
 *   formd-first    due 15 calendar days after the first sale, moved to the next business day; only while no notice is
 *                  filed. basis { firstSale, confirmed }
 *   formd-annual   due on the first anniversary of the latest filed notice (D or D/A, the portal's or the sponsor's
 *                  own), moved the same way. basis { filedOn, type, accession }
 *   formd-change   the offering's figures (minimum, total offering where the record holds one, non-accredited count)
 *                  laid over the latest filed snapshot need an amendment; due null. basis { filedOn, reasons }
 *   state-first    one per state with a sale and no notice filed; with a confirmed row of the state table, due that
 *                  row's days after the first sale in the state, moved the same way; otherwise due null.
 *                  basis { firstSale, days? }. A confirmed row with noticeRequired false gives none.
 *   state-renewal  on the state's renewsOn. basis { renewsOn, filedOn }
 * The annual, the change and the state renewal reminders stop once rec.ended is set and not after today (the Form D
 * instructions ask for no amendment after the offering terminates; a notice is not renewed for an offering that ended). An offering record with no cap or minimum is not laid over the filed
 * figures: a blank in the portal is not a change in the offering.
 * Levels: overdue once today is after the due date; due when the calendar deadline is within the reminder's lead
 * (15 days for a first notice, so from the day of the first sale; 30 for an annual amendment and a renewal), and
 * always when there is no date; soon within the lead plus 30 days; later beyond. Only due and overdue are counted.
 * Silence keys: formd-first:<offeringId>, formd-annual:<offeringId>, formd-change:<offeringId>,
 * state-first:<offeringId>:<code>, state-renewal:<offeringId>:<code>, offering:<offeringId> (all of an offering's).
 * A silenced reminder stays in the list with silenced true and its date unchanged.
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
  /** The same calendar day one year later (29 February becomes 28 February). */
  const anniversary = (iso) => {
    const p = iso.split('-');
    return day(`${Number(p[0]) + 1}-${p[1]}-${p[2]}`) || `${Number(p[0]) + 1}-02-28`;
  };
  const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
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
  const log = (ws, e) => (NS && NS.audit && NS.audit.log ? NS.audit.log(ws, e) : null);
  /** A copy for the record with any key that could hold a secret left out (the record keeps none). */
  const SECRET = /ccc|token|secret|password/i;
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
    // No rate is applied to another currency (the reference rates are for summary screens only): no dollar figure.
    const money = (t) => (usd ? t : Object.assign(t, { sold: null }));
    Object.keys(byState).forEach((k) => money(byState[k]));
    const whole = (v) => (v === '' || v == null || !isFinite(Number(v)) ? null : Math.round(Number(v)));
    const st = o.structure || {};
    const cap = whole(st.hardCap) || whole(st.targetSize);
    const regime = regimeOf(o);
    const na = NS.eligibility.nonAccredited(ws, o);
    return {
      regime,
      usd,
      firstSale: day(r.firstSale) || all.firstSale,
      firstSaleSuggested: all.firstSale,
      sold: usd ? all.sold : null,
      investors: all.investors,
      // Investors who have invested (the figure Form D asks for); those still pending are given apart.
      nonAccredited: { count: na.accepted.length, pending: na.pending.length, unanswered: na.unanswered },
      total: usd ? (cap > 0 ? cap : 'Indefinite') : null,
      minimum: usd ? whole(o.minimum) : null,
      byState,
      outsideUS: money(tally(groups.abroad || [])),
      unplaced: money(tally(groups[''] || []))
    };
  }

  /* ---------- The amendment test (Form D General Instructions, "When amendment is not required") ---------- */
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const names = (list) => (Array.isArray(list) ? list.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : null);
  /**
   * What differs between the last filed snapshot and the figures now in a way that needs an amendment:
   * [ { item, from, to } ], empty when nothing does. The 10 percent tests are cumulative since the last filed notice,
   * which comparing against its snapshot gives. Exempt and so never reported: a higher minimum investment or one lowered
   * by no more than 10 percent; a lower total offering amount, commissions, finders' fees or proceeds to insiders, or
   * one raised by no more than 10 percent; a non-accredited count that does not rise above 35. Reported: a total
   * offering amount that moves between a number and Indefinite, a related person added or no longer named, a different
   * material text. An item missing from either snapshot is not compared.
   */
  function changeNeeded(last, now) {
    const out = [];
    if (!last || !now || typeof last !== 'object' || typeof now !== 'object') return out;
    const add = (item, more) => out.push(Object.assign({ item, from: last[item], to: now[item] }, more || {}));
    const a = (k) => Math.round(last[k]);
    const b = (k) => Math.round(now[k]);
    const both = (k) => isNum(last[k]) && isNum(now[k]);
    // Written as multiplications, so a base of 0 divides nothing: a rise from 0 is a rise of more than 10 percent.
    const up = (k) => both(k) && (b(k) - a(k)) * 10 > a(k);
    if (both('minimumInvestment') && (a('minimumInvestment') - b('minimumInvestment')) * 10 > a('minimumInvestment')) add('minimumInvestment');
    const indefinite = (v) => v === 'Indefinite';
    if ((indefinite(last.totalOffering) && isNum(now.totalOffering)) || (isNum(last.totalOffering) && indefinite(now.totalOffering)) || up('totalOffering')) add('totalOffering');
    if (both('nonAccredited') && b('nonAccredited') > a('nonAccredited') && b('nonAccredited') > 35) add('nonAccredited');
    ['commissions', 'findersFees', 'proceedsToInsiders'].forEach((k) => up(k) && add(k));
    const was = names(last.relatedPersons);
    const is = names(now.relatedPersons);
    if (was && is) {
      const added = is.filter((x) => was.indexOf(x) < 0);
      const removed = was.filter((x) => is.indexOf(x) < 0);
      if (added.length || removed.length) add('relatedPersons', { added, removed });
    }
    if (typeof last.material === 'string' && typeof now.material === 'string' && last.material !== now.material) add('material');
    return out;
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
  const isState = (kind) => kind === 'state-first' || kind === 'state-renewal';

  function due(ws, today, opts) {
    const now = day(today) || todayIso();
    const out = [];
    const quiet = (ws && ws.filings && ws.filings.silenced) || {};
    const table = opts && opts.states && typeof opts.states === 'object' ? opts.states : null;
    ((ws && ws.offerings) || []).forEach((o) => {
      if (!o || !applies(o)) return;
      const r = peek(ws, o.id);
      if (r.mode === 'none') return;
      const f = facts(ws, o);
      const add = (kind, target, basis, code) => {
        const key = `${kind}:${o.id}${code ? `:${code}` : ''}`;
        // A renewal is on the date the record gives; every other date is moved off a weekend or holiday.
        const date = target ? (kind === 'state-renewal' ? target : businessDay(target)) : null;
        out.push(Object.assign({ key, kind, offeringId: o.id }, code ? { state: code } : {}, { due: date, basis, level: levelOf(kind, date, target, now), silenced: !!(quiet[key] || quiet[`offering:${o.id}`]) }));
      };
      const filed = filedNotices(r);
      const ended = !!day(r.ended) && day(r.ended) <= now;
      if (!filed.length) {
        if (f.firstSale) add('formd-first', addDays(f.firstSale, 15), { firstSale: f.firstSale, confirmed: !!day(r.firstSale) });
      } else if (!ended) {
        // The latest filed notice, D or D/A (of two filed the same day, the one recorded later).
        const last = filed.reduce((a, b) => (day(b.filedOn) >= day(a.filedOn) ? b : a));
        const filedOn = day(last.filedOn);
        add('formd-annual', anniversary(filedOn), { filedOn, type: last.type, accession: last.accession || '' });
        if (last.snapshot && typeof last.snapshot === 'object') {
          const live = Object.assign({}, last.snapshot, { nonAccredited: f.nonAccredited.count });
          if (isNum(f.minimum)) live.minimumInvestment = f.minimum;
          if (isNum(f.total)) live.totalOffering = f.total;
          const reasons = changeNeeded(last.snapshot, live);
          if (reasons.length) add('formd-change', null, { filedOn, reasons });
        }
      }
      Object.keys(f.byState).forEach((code) => {
        const s = own(r.states, code) ? r.states[code] : null;
        if (s && day(s.filedOn)) return;
        const row = table && own(table, code) && table[code] && table[code].confirmed === true ? table[code] : null;
        if (row && row.noticeRequired === false) return;
        const first = f.byState[code].firstSale;
        const days = row && Number.isInteger(row.days) && row.days >= 0 ? row.days : null;
        if (days != null && first) add('state-first', addDays(first, days), { firstSale: first, days }, code);
        else add('state-first', null, { firstSale: first }, code);
      });
      // A notice is not renewed for an offering that has ended (F4 (3)); a first notice for a sale before the end still shows.
      if (!ended)
        Object.keys(r.states)
          .sort()
          .forEach((code) => {
            const s = r.states[code];
            const renewsOn = own(STATES, code) && s ? day(s.renewsOn) : '';
            if (renewsOn) add('state-renewal', renewsOn, { renewsOn, filedOn: day(s.filedOn) }, code);
          });
    });
    return out;
  }
  const count = (ws, today, opts) => due(ws, today, opts).filter((x) => !x.silenced && (x.level === 'due' || x.level === 'overdue')).length;

  /* ---------- Silencing ---------- */
  const KINDS = ['formd-first', 'formd-annual', 'formd-change', 'state-first', 'state-renewal', 'offering'];
  /** A key names a reminder when its kind is known, its offering is in the workspace and, for a state kind, its state is one. */
  function validKey(ws, key) {
    const k = String(key == null ? '' : key);
    const kind = KINDS.find((x) => k.indexOf(`${x}:`) === 0);
    if (!kind) return false;
    const rest = k.slice(kind.length + 1);
    if (!isState(kind)) return !!offeringOf(ws, rest);
    const cut = rest.lastIndexOf(':');
    return cut > 0 && own(STATES, rest.slice(cut + 1)) && !!offeringOf(ws, rest.slice(0, cut));
  }
  function silence(ws, key, by) {
    if (!validKey(ws, key)) return false;
    ensure(ws).silenced[key] = { at: stamp(), by: String(by == null ? '' : by) };
    save(ws);
    return true;
  }
  function unsilence(ws, key) {
    const q = ws && ws.filings && ws.filings.silenced;
    if (!q || !own(q, key)) return false;
    delete q[key];
    save(ws);
    return true;
  }

  /* ---------- Prices and orders ---------- */
  /** Cents. One place, so the server works out an order from the same numbers. */
  const PRICES = Object.freeze({ formd: 10000, 'formd-amendment': 5000, bluesky: 10000, 'bluesky-renewal': 5000 });
  const SERVICE = { formd: 'Form D filing, EDGAR access setup included', 'formd-amendment': 'Form D amendment filing', bluesky: 'State notice filings, any number of states', 'bluesky-renewal': 'State notice renewals' };
  const dollars = (cents) => `$${String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${cents % 100 ? `.${pad(cents % 100)}` : ''}`;
  /**
   * An order's lines: the service at its price, then each pass-through fee as its own line at cost
   * ({ label, cents, state? }). A fee not yet confirmed has cents null: it adds nothing to dueCents and sets openFees.
   * An unknown kind, or an amount that is not a whole number of cents, is an error.
   */
  function orderLines(kind, opts) {
    if (typeof kind !== 'string' || !own(PRICES, kind)) throw new Error(`filings: unknown order kind "${kind}"`);
    const lines = [{ label: SERVICE[kind], cents: PRICES[kind], passThrough: false }];
    ((opts && opts.passThrough) || []).forEach((l) => {
      const cents = l && l.cents != null ? l.cents : null;
      if (cents !== null && !(Number.isInteger(cents) && cents >= 0)) throw new Error('filings: a pass-through amount is a whole number of cents, or null until it is confirmed');
      lines.push(Object.assign({ label: String((l && l.label) || '').trim(), cents, passThrough: true }, l && l.state ? { state: String(l.state) } : {}));
    });
    return { lines, dueCents: lines.reduce((a, l) => a + (l.cents || 0), 0), openFees: lines.some((l) => l.cents === null) };
  }
  function addOrder(ws, o) {
    const q = o || {};
    const built = orderLines(q.kind, { passThrough: q.passThrough });
    const off = offeringOf(ws, q.offeringId);
    if (!off) return null;
    const f = ensure(ws);
    const order = { id: newId(f.orders, 'fo'), kind: q.kind, offeringId: off.id, lines: built.lines, dueCents: built.dueCents, openFees: built.openFees, status: 'recorded', at: stamp(), by: String(q.by == null ? '' : q.by), package: q.package ? clean(q.package) : null };
    f.orders.push(order);
    log(ws, { action: 'Filing order recorded', fund: off.id, record: order.id, detail: `${SERVICE[order.kind]}: ${dollars(order.dueCents)} due${order.openFees ? ', with fees still to be confirmed' : ''}` });
    save(ws);
    return order;
  }
  /** Only an order still recorded can be cancelled (one already received or done is with the filing agent). */
  function cancelOrder(ws, id) {
    const order = ((ws && ws.filings && ws.filings.orders) || []).find((x) => x && x.id === id);
    if (!order || order.status !== 'recorded') return false;
    order.status = 'cancelled';
    log(ws, { action: 'Filing order cancelled', fund: order.offeringId, record: order.id, detail: `${SERVICE[order.kind] || order.kind}: ${dollars(order.dueCents)} was due` });
    save(ws);
    return true;
  }

  /* ---------- Writing the record ---------- */
  const text = (v) => String(v).trim();
  /** The issuer details asked once per offering. Only the record's own keys are kept; null or absent leaves a key as it is. */
  function setIssuer(ws, offeringId, patch) {
    const r = rec(ws, offeringId);
    if (!r) return null;
    const p = patch || {};
    Object.keys(blankIssuer()).forEach((k) => {
      if (!own(p, k) || p[k] == null) return;
      r.issuer[k] = k === 'previousNames' ? (Array.isArray(p[k]) ? p[k] : []).map(text).filter(Boolean) : text(p[k]);
    });
    save(ws);
    return r.issuer;
  }
  /** EDGAR access progress: cik, name, singleMember and steps ({ [stepKey]: { done, at } }, merged by key). Nothing else is kept. */
  function setEdgar(ws, offeringId, patch) {
    const r = rec(ws, offeringId);
    if (!r) return null;
    const p = patch || {};
    if (p.cik != null) r.edgar.cik = text(p.cik);
    if (p.name != null) r.edgar.name = text(p.name);
    if (own(p, 'singleMember')) r.edgar.singleMember = p.singleMember == null ? null : !!p.singleMember;
    if (p.steps && typeof p.steps === 'object') {
      Object.keys(p.steps).forEach((k) => {
        const s = p.steps[k];
        if (!SECRET.test(k) && s && typeof s === 'object') r.edgar.steps[k] = { done: !!s.done, at: s.at == null ? '' : text(s.at) };
      });
    }
    save(ws);
    return r.edgar;
  }
  const blankState = () => ({ status: '', filedOn: '', efdId: '', feeCents: null, quotedCents: null, renewsOn: '', source: '' });
  /**
   * A state's notice: { status, filedOn, efdId, feeCents, quotedCents, renewsOn, source }, the keys given in patch
   * changed. The state counts as filed once filedOn is set. Null for an unknown offering or state.
   */
  function recordState(ws, offeringId, code, patch) {
    const r = rec(ws, offeringId);
    if (!r || typeof code !== 'string' || !own(STATES, code)) return null;
    const s = own(r.states, code) && r.states[code] && typeof r.states[code] === 'object' ? fill(r.states[code], blankState()) : (r.states[code] = blankState());
    const p = patch || {};
    const cents = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
    if (p.status != null) s.status = text(p.status);
    if (p.filedOn != null) s.filedOn = day(p.filedOn);
    if (p.efdId != null) s.efdId = text(p.efdId);
    if (own(p, 'feeCents')) s.feeCents = cents(p.feeCents);
    if (own(p, 'quotedCents')) s.quotedCents = cents(p.quotedCents);
    if (p.renewsOn != null) s.renewsOn = day(p.renewsOn);
    if (p.source != null) s.source = p.source === 'portal' || p.source === 'self' ? p.source : '';
    save(ws);
    return s;
  }
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

  const API = { ensure, rec, applies, facts, holidays, businessDay, due, count, changeNeeded, silence, unsilence, PRICES, orderLines, addOrder, cancelOrder, setIssuer, setEdgar, recordFiled, recordState };
  /** A state's or territory's name for its two-letter code ('' when it is not one): what the Filings tab writes. */
  API.stateName = (code) => (typeof code === 'string' && own(STATES, code) ? STATES[code] : '');
  if (NS) NS.filings = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
