/*
 * Workspace data: each client's offerings, investor roster and distribution
 * history, plus the math the portal and console share (pro-rata allocation to
 * the cent, time-until-exit, per-investor rollups).
 *
 * Sample clients are seeded deterministically from tenants.js, so every figure
 * reconciles: an investor's distributions are their exact share of each payment
 * the sponsor made. In production this module is replaced by the system of record.
 */
(function (NS) {
  'use strict';

  /* ---------- Object helpers ---------- */
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  function merge(base, over) {
    const out = clone(base);
    (function walk(a, b) {
      Object.keys(b || {}).forEach((k) => {
        if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) walk(a[k], b[k]);
        else a[k] = clone(b[k]);
      });
    })(out, over);
    return out;
  }
  NS.util = { clone, merge };

  /* ---------- Dates ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  function parse(s) {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  }
  function today() {
    const n = new Date();
    return isoOf(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
  }
  function addMonths(s, k) {
    const d = parse(s);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + k);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return isoOf(d);
  }
  function weekdayOnOrAfter(s) {
    const d = parse(s);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    return isoOf(d);
  }
  function monthsBetween(a, b) {
    const A = parse(a);
    const B = parse(b);
    let m = (B.getUTCFullYear() - A.getUTCFullYear()) * 12 + (B.getUTCMonth() - A.getUTCMonth());
    if (B.getUTCDate() < A.getUTCDate()) m -= 1;
    return m;
  }
  function span(months) {
    if (months <= 0) return 'less than 1 month';
    const y = Math.floor(months / 12);
    const m = months % 12;
    const parts = [];
    if (y) parts.push(y + (y === 1 ? ' year' : ' years'));
    if (m) parts.push(m + (m === 1 ? ' month' : ' months'));
    return parts.join(', ');
  }
  NS.dates = { parse, isoOf, today, addMonths, weekdayOnOrAfter, monthsBetween, span };

  /* ---------- Deterministic randomness for sample data ---------- */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function digits(R, n) {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(R() * 10);
    return s;
  }
  function abaCheckDigit(first8) {
    const d = first8.split('').map(Number);
    const t = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5]);
    return String((10 - (t % 10)) % 10);
  }
  function fakeRouting(R) {
    const district = pick(R, ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32']);
    const first8 = district + digits(R, 6);
    return first8 + abaCheckDigit(first8);
  }

  const FIRST = ['Robert', 'Ellen', 'Anita', 'Marcus', 'Priya', 'Daniel', 'Grace', 'Thomas', 'Lena', 'Victor', 'Hannah', 'Samuel', 'Naomi', 'Peter', 'Olivia', 'Raymond', 'Claire', 'Isaac', 'Meredith', 'Gabriel', 'Theresa', 'Walter', 'Simone', 'Henry', 'Rachel', 'Arthur', 'Julia', 'Conrad', 'Deborah', 'Elliot'];
  const LAST = ['Marsh', 'Shah', 'Okafor', 'Lindqvist', 'Brennan', 'Castillo', 'Whitaker', 'Novak', 'Harrington', 'Tanaka', 'Delgado', 'Fitzgerald', 'Ramsey', 'Holloway', 'Kessler', 'Abernathy', 'Sato', 'Calloway', 'Iverson', 'Pruitt', 'Montague', 'Ashby', 'Vance', 'Rourke', 'Galloway', 'Mercer', 'Quinlan', 'Easton'];
  const STREETS = ['Orchard Lane', 'Linden Avenue', 'Harbor View Road', 'Willow Court', 'Summit Drive', 'Maple Street', 'Briar Hill Road', 'Juniper Way', 'Ridge Road', 'Cedar Lane'];
  const CITIES = [['Montclair', 'NJ', '07042'], ['Greenwich', 'CT', '06830'], ['Brookline', 'MA', '02445'], ['Bethesda', 'MD', '20814'], ['Naperville', 'IL', '60540'], ['Scottsdale', 'AZ', '85251'], ['Boulder', 'CO', '80302'], ['Franklin', 'TN', '37064'], ['Charlotte', 'NC', '28207'], ['Austin', 'TX', '78703'], ['Palo Alto', 'CA', '94301'], ['Bellevue', 'WA', '98004']];
  const ACCRED = ['Income over $200,000 (or $300,000 jointly)', 'Net worth over $1 million, excluding primary residence', 'Licensed professional (Series 7, 65 or 82)', 'Entity with assets over $5 million', 'All equity owners are accredited'];

  NS.ENTITY_TYPES = {
    individual: { label: 'Individual', sec: 'PPD' },
    joint: { label: 'Joint account', sec: 'PPD' },
    trust: { label: 'Trust', sec: 'PPD' },
    entity: { label: 'LLC, partnership or corporation', sec: 'CCD' },
    ira: { label: 'IRA (through a custodian)', sec: 'CCD' }
  };

  function makeInvestor(t, i, R, used) {
    let first;
    let last;
    do {
      first = pick(R, FIRST);
      last = pick(R, LAST);
    } while (used[first + last]);
    used[first + last] = 1;
    const roll = R();
    const type = roll < 0.5 ? 'individual' : roll < 0.62 ? 'joint' : roll < 0.76 ? 'trust' : roll < 0.88 ? 'entity' : 'ira';
    const partner = pick(R, FIRST.filter((f) => f !== first));
    const title =
      type === 'individual' ? `${first} ${last}` :
      type === 'joint' ? `${first} and ${partner} ${last}, JTWROS` :
      type === 'trust' ? `${last} Family Trust` :
      type === 'entity' ? `${last} Capital Holdings LLC` :
      `Millbrook Trust Co. FBO ${first} ${last} IRA`;
    const city = pick(R, CITIES);
    return {
      id: `${t.idPrefix}-${1001 + i}`,
      contact: `${first} ${last}`,
      title,
      type,
      email: `${first}.${last}`.toLowerCase() + '@example.com',
      phone: `(${pick(R, ['212', '646', '203', '617', '301', '312', '480', '303', '615', '704', '512', '650'])}) 555-01${pad(Math.floor(R() * 100))}`,
      address: `${10 + Math.floor(R() * 890)} ${pick(R, STREETS)}, ${city[0]}, ${city[1]} ${city[2]}`,
      tinLast4: digits(R, 4),
      accreditation: { basis: type === 'entity' || type === 'ira' ? ACCRED[pick(R, [3, 4])] : ACCRED[pick(R, [0, 1, 1, 2])], date: `2026-0${1 + Math.floor(R() * 8)}-1${Math.floor(R() * 9)}` },
      taxForm: 'W-9',
      edelivery: true,
      onboarding: { status: 'complete', step: 5, invited: '2022-01-10', completed: '2022-01-24' },
      payment: {
        method: 'ach',
        bank: { holder: type === 'ira' ? 'Millbrook Trust Company' : type === 'joint' ? `${first} & ${partner} ${last}` : title, routing: fakeRouting(R), account: digits(R, 8 + Math.floor(R() * 5)).replace(/^0/, '4'), type: R() < 0.85 ? 'checking' : 'savings' }
      },
      positions: []
    };
  }

  function genRoster(t, offerings) {
    if (!t.roster || !t.roster.size) return [];
    const R = rng(hashStr(t.id + ':roster'));
    const used = { JordanDavis: 1 };
    const list = [
      {
        id: `${t.idPrefix}-1001`,
        contact: 'Jordan Davis',
        title: 'Davis Family Trust',
        type: 'trust',
        email: 'jordan.davis@example.com',
        phone: '(917) 555-0136',
        address: '41 Orchard Lane, Montclair, NJ 07042',
        tinLast4: '4417',
        accreditation: { basis: ACCRED[1], date: '2026-03-18' },
        taxForm: 'W-9',
        edelivery: true,
        onboarding: { status: 'complete', step: 5, invited: '2022-01-10', completed: '2022-01-12' },
        payment: { method: 'ach', bank: { holder: 'Davis Family Trust', routing: '044003186', account: '48213307', type: 'checking' } },
        positions: []
      }
    ];
    for (let i = 1; i < t.roster.size; i++) list.push(makeInvestor(t, i, R, used));
    // A few investors have not finished activating their portal accounts yet.
    const n = list.length;
    [n - 1, n - 2].forEach((k) => {
      list[k].onboarding = { status: 'invited', step: 0, invited: '2026-10-28', completed: '' };
      list[k].payment = { method: 'check', bank: null };
      list[k].accreditation = { basis: '', date: '' };
      list[k].edelivery = false;
    });
    [[n - 3, 2], [n - 4, 4]].forEach(([k, step]) => {
      list[k].onboarding = { status: 'in_progress', step, invited: '2026-10-21', completed: '' };
      list[k].payment = { method: 'check', bank: null };
    });
    list[n - 5].payment = { method: 'check', bank: null };

    const MULT = [1, 1, 1, 1.5, 2, 2, 2, 2.5, 3, 4, 5];
    offerings.forEach((o) => {
      const jordanAmt = t.roster.jordan && t.roster.jordan[o.id];
      if (jordanAmt) list[0].positions.push({ offeringId: o.id, amount: jordanAmt, date: o.closeDate });
      const others = list.slice(1).filter(() => R() < 0.55);
      list.slice(1).forEach((inv) => {
        if (others.length < 11 && others.indexOf(inv) < 0) others.push(inv);
      });
      others.forEach((inv) => {
        const amt = Math.round((o.minimum * pick(R, MULT)) / 5000) * 5000;
        inv.positions.push({ offeringId: o.id, amount: amt, date: o.closeDate });
      });
    });
    return list.filter((inv) => inv.positions.length);
  }

  const FREQ_MONTHS = { Monthly: 1, Quarterly: 3, 'Semi-annual': 6, Annual: 12 };

  function holdersAt(investors, offeringId, date) {
    const out = [];
    investors.forEach((inv) => {
      inv.positions.forEach((p) => {
        if (p.offeringId === offeringId && p.date <= date) out.push({ investor: inv, amount: p.amount });
      });
    });
    return out;
  }
  const investedAt = (investors, offeringId, date) => holdersAt(investors, offeringId, date).reduce((a, h) => a + h.amount, 0);

  function genRuns(t, offerings, investors) {
    const runs = [];
    const now = today();
    offerings.forEach((o) => {
      const s = o.seed;
      if (!s) return;
      const R = rng(hashStr(t.id + o.id));
      const add = (date, cents, type) => {
        if (cents > 0) runs.push({ id: `${o.id}-${date}`, offeringId: o.id, date, type, total: cents, status: date <= now ? 'paid' : 'scheduled', source: 'history' });
      };
      if (s.events) {
        s.events.forEach(([d, pct]) => {
          const date = weekdayOnOrAfter(d);
          if (date <= now) add(date, Math.round(investedAt(investors, o.id, date) * pct * 100), o.distribution.type);
        });
      }
      if (s.rate) {
        const step = FREQ_MONTHS[s.freq] || 1;
        let d = s.start;
        const end = s.end || now;
        while (d <= end) {
          const date = weekdayOnOrAfter(d);
          if (date > now) break;
          const vary = s.vary ? 1 + s.vary * (R() * 2 - 1) : 1;
          add(date, Math.round(((investedAt(investors, o.id, date) * s.rate * step) / 12) * vary * 100), s.type);
          d = addMonths(d, step);
        }
      }
      if (s.final) {
        const date = weekdayOnOrAfter(s.final[0]);
        add(date, Math.round(investedAt(investors, o.id, date) * s.final[1] * 100), s.final[2]);
      }
    });
    runs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return runs;
  }

  /* ---------- Investor notices ---------- */
  NS.NOTICE_TEMPLATES = {
    quarterly: {
      label: 'Quarterly report available',
      subject: '{quarter} report for {investment} is now available',
      body: 'Dear {first_name},\n\nThe {quarter} quarterly report for {investment} has been posted to your {portal_name}. Sign in and open Documents to read it.\n\nIf you have any questions, contact {team} at {phone}.\n\n{firm}'
    },
    documents: {
      label: 'New documents uploaded',
      subject: 'New documents are available in your {portal_name}',
      body: 'Dear {first_name},\n\nNew documents have been uploaded to your {portal_name}: {documents}. Sign in and open Documents to view them.\n\nIf you have any questions, contact {team} at {phone}.\n\n{firm}'
    },
    custom: { label: 'Custom message', subject: '', body: 'Dear {first_name},\n\n\n\n{firm}' }
  };
  NS.MERGE_FIELDS = ['first_name', 'account_name', 'investment', 'quarter', 'documents', 'portal_name', 'firm', 'team', 'phone'];
  /** Fill {merge_fields} for one investor. Unknown fields are left as typed. */
  NS.mergeNotice = function (text, inv, tenant, notice, offering) {
    const map = {
      first_name: String(inv.contact || '').split(' ')[0],
      account_name: inv.title,
      investment: offering ? offering.name : 'your investments',
      quarter: notice.quarter || '',
      documents: notice.docName || 'new documents',
      portal_name: tenant.portalName,
      firm: tenant.name,
      team: tenant.support.team,
      phone: tenant.support.phone
    };
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (map[k] != null ? map[k] : m));
  };
  /** Notices an investor received and has not dismissed, newest first. */
  NS.noticesFor = function (ws, inv) {
    const read = inv.noticesRead || [];
    return (ws.notices || []).filter((n) => n.recipients.indexOf(inv.id) >= 0 && read.indexOf(n.id) < 0).sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  /** Build a fresh workspace for a client from its seed config. */
  NS.seedWorkspace = function (seed) {
    const tenant = merge(NS.TENANT_TEMPLATE, seed);
    const offerings = clone(tenant.offerings || []);
    const investors = genRoster(tenant, offerings);
    const runs = genRuns(tenant, offerings, investors);
    offerings.forEach((o) => delete o.seed);
    delete tenant.offerings;
    delete tenant.roster;
    const year = today().slice(0, 4);
    const notices = investors.length
      ? [{
          id: 'n-seed-q3',
          date: `${year}-11-03`,
          kind: 'documents',
          audience: 'all',
          includePending: true,
          quarter: `Q3 ${year}`,
          docName: `Q3 ${year} investor updates and account statements`,
          subject: NS.NOTICE_TEMPLATES.documents.subject,
          body: NS.NOTICE_TEMPLATES.documents.body,
          recipients: investors.map((i) => i.id),
          sentBy: 'staff'
        }]
      : [];
    return { v: 2, tenant, offerings, investors, runs, notices };
  };

  /* ---------- Allocation ---------- */

  /** Split totalCents across holders pro rata by amount invested; largest remainder keeps it exact. */
  function split(totalCents, holders) {
    const sum = holders.reduce((a, h) => a + h.amount, 0);
    if (!sum || !totalCents) return holders.map((h) => ({ ...h, share: 0, cents: 0 }));
    const rows = holders.map((h, i) => {
      const exact = (totalCents * h.amount) / sum;
      const base = Math.floor(exact);
      return { ...h, share: h.amount / sum, cents: base, frac: exact - base, i };
    });
    let rem = totalCents - rows.reduce((a, r) => a + r.cents, 0);
    rows
      .slice()
      .sort((a, b) => b.frac - a.frac || a.i - b.i)
      .forEach((r) => {
        if (rem > 0) {
          r.cents += 1;
          rem -= 1;
        }
      });
    return rows;
  }

  const cache = new Map();
  NS.clearCaches = () => cache.clear();
  /** Each holder's share of one distribution. Merges multiple positions per investor. */
  function allocate(ws, run) {
    const key = ws.tenant.id + ':' + run.offeringId + ':' + run.id + ':' + run.total + ':' + run.date;
    if (cache.has(key)) return cache.get(key);
    const merged = {};
    holdersAt(ws.investors, run.offeringId, run.date).forEach((h) => {
      if (!merged[h.investor.id]) merged[h.investor.id] = { investor: h.investor, amount: 0 };
      merged[h.investor.id].amount += h.amount;
    });
    const rows = split(run.total, Object.values(merged));
    cache.set(key, rows);
    return rows;
  }

  /* ---------- Time until exit ---------- */
  function monthYear(s) {
    return parse(s).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  function longDate(s) {
    return parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  NS.exitInfo = function (o, asOf) {
    const now = asOf || today();
    const e = o.exit || {};
    const close = o.closeDate;
    const frac = (a, b) => Math.max(0, Math.min(1, (parse(now) - parse(a)) / (parse(b) - parse(a) || 1)));
    switch (e.basis) {
      case 'exited':
        return { label: 'Exited', value: e.date ? longDate(e.date) : 'Exited', remaining: e.date ? `Held ${span(monthsBetween(close, e.date))}` : '', progress: 1, state: 'exited' };
      case 'open':
        return { label: 'Term', value: 'No set term', remaining: `Held ${span(monthsBetween(close, now))}`, progress: null, state: 'open' };
      case 'maturity': {
        const m = monthsBetween(now, e.date);
        return { label: 'Maturity', value: longDate(e.date), remaining: now >= e.date ? 'Matured' : `${span(m)} remaining`, progress: frac(close, e.date), state: now >= e.date ? 'due' : 'active' };
      }
      case 'range': {
        const fy = parse(e.from).getUTCFullYear();
        const ty = parse(e.to).getUTCFullYear();
        const value = fy === ty ? String(fy) : `${fy}–${ty}`;
        let remaining;
        let state = 'active';
        if (now < e.from) remaining = `Exit window opens in ${span(monthsBetween(now, e.from))}`;
        else if (now <= e.to) {
          remaining = `In exit window through ${monthYear(e.to)}`;
          state = 'window';
        } else {
          remaining = 'Past projected window';
          state = 'due';
        }
        return { label: 'Projected exit', value, remaining, progress: frac(close, e.to), windowStart: frac(close, e.to) > 0 ? (parse(e.from) - parse(close)) / (parse(e.to) - parse(close)) : 0, state };
      }
      default: {
        if (!e.date) return { label: 'Projected exit', value: 'Not set', remaining: '', progress: null, state: 'open' };
        const m = monthsBetween(now, e.date);
        return { label: 'Projected exit', value: monthYear(e.date), remaining: now >= e.date ? 'Past projected date' : `${span(m)} remaining`, progress: frac(close, e.date), state: now >= e.date ? 'due' : 'active' };
      }
    }
  };
  /** Year of hold, e.g. "Year 5 of a 5–7 year hold". */
  NS.holdYear = function (o, asOf) {
    const now = asOf || today();
    if (!o.closeDate || (o.exit && o.exit.basis === 'exited')) return '';
    const yr = Math.floor(monthsBetween(o.closeDate, now) / 12) + 1;
    return `Year ${yr} since closing`;
  };

  /* ---------- Distribution schedule ---------- */
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const firstOf = (iso) => iso.slice(0, 8) + '01';
  function withDay(iso, day) {
    const d = parse(iso);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return isoOf(d);
  }
  /** Payments due on a weekend or Federal Reserve holiday go out the next banking day. */
  function bankingOnOrAfter(iso) {
    const d = parse(iso);
    const ok = (x) => (NS.nacha ? NS.nacha.isBankingDay(x) : [0, 6].indexOf(parse(x).getUTCDay()) < 0);
    while (!ok(isoOf(d))) d.setUTCDate(d.getUTCDate() + 1);
    return isoOf(d);
  }
  /** The day of the month an offering pays: as configured, else the day it has usually paid on. */
  function paymentDay(ws, o) {
    const set = Number(o.distribution && o.distribution.day);
    if (set >= 1 && set <= 31) return set;
    const counts = {};
    ws.runs.forEach((r) => {
      if (r.offeringId === o.id) {
        const k = Number(r.date.slice(8, 10));
        counts[k] = (counts[k] || 0) + 1;
      }
    });
    const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a - b)[0];
    return best ? Number(best) : Math.min(28, Number(String(o.closeDate || '').slice(8, 10)) || 15);
  }
  function scheduleText(ws, o, day) {
    const f = o.distribution.frequency;
    const step = FREQ_MONTHS[f];
    if (step === 1) return `Monthly on the ${ordinal(day)}`;
    const ref = ws.runs.filter((r) => r.offeringId === o.id).map((r) => r.date).sort().pop() || o.closeDate;
    const m0 = Number(ref.slice(5, 7)) - 1;
    const months = [];
    for (let k = 0; k < 12; k += step) months.push((m0 + k) % 12);
    months.sort((a, b) => a - b);
    return `${f} on the ${ordinal(day)} of ${months.map((m) => MONTHS[m]).join(', ')}`;
  }
  /**
   * Next distribution date for an offering. A payment already scheduled in the
   * console wins; otherwise the regular schedule continues from the last payment.
   */
  NS.nextDistribution = function (ws, o, asOf) {
    const now = asOf || today();
    if (!o || o.status === 'Exited' || (o.exit && o.exit.basis === 'exited')) return null;
    const step = FREQ_MONTHS[(o.distribution || {}).frequency];
    const day = step ? paymentDay(ws, o) : null;
    const schedule = step ? scheduleText(ws, o, day) : '';
    const sched = ws.runs.filter((r) => r.offeringId === o.id && r.status === 'scheduled' && r.date >= now).map((r) => r.date).sort()[0];
    if (sched) return { date: sched, nominal: sched, moved: false, scheduled: true, day, schedule };
    if (!step) return null;
    const paid = ws.runs.filter((r) => r.offeringId === o.id && r.status === 'paid').map((r) => r.date).sort();
    let nominal = withDay(addMonths(firstOf(paid.length ? paid[paid.length - 1] : o.closeDate), step), day);
    for (let guard = 0; bankingOnOrAfter(nominal) < now && guard < 600; guard++) nominal = withDay(addMonths(firstOf(nominal), step), day);
    if (o.exit && o.exit.basis === 'maturity' && o.exit.date) {
      if (o.exit.date < now) return null;
      if (nominal > o.exit.date) nominal = o.exit.date;
    }
    const date = bankingOnOrAfter(nominal);
    return { date, nominal, moved: date !== nominal, scheduled: false, day, schedule };
  };

  /* ---------- Investor rollups ---------- */
  NS.investorView = function (ws, invId) {
    const inv = ws.investors.find((x) => x.id === invId) || ws.investors[0];
    if (!inv) return null;
    const now = today();
    const ytdStart = now.slice(0, 4) + '-01-01';
    const byOffering = {};
    inv.positions.forEach((p) => {
      if (!byOffering[p.offeringId]) byOffering[p.offeringId] = { invested: 0, first: p.date };
      byOffering[p.offeringId].invested += p.amount;
      if (p.date < byOffering[p.offeringId].first) byOffering[p.offeringId].first = p.date;
    });
    const payments = [];
    ws.runs.forEach((run) => {
      if (!byOffering[run.offeringId]) return;
      const mine = allocate(ws, run).find((r) => r.investor.id === inv.id);
      if (mine && mine.cents > 0) payments.push({ run, date: run.date, offeringId: run.offeringId, type: run.type, cents: mine.cents, status: run.status });
    });
    payments.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const positions = Object.keys(byOffering)
      .map((oid) => {
        const o = ws.offerings.find((x) => x.id === oid);
        if (!o) return null;
        const paid = payments.filter((p) => p.offeringId === oid && p.status === 'paid');
        return {
          offering: o,
          invested: byOffering[oid].invested,
          date: byOffering[oid].first,
          received: paid.reduce((a, p) => a + p.cents, 0),
          ytd: paid.filter((p) => p.date >= ytdStart).reduce((a, p) => a + p.cents, 0),
          payments: payments.filter((p) => p.offeringId === oid),
          exit: NS.exitInfo(o, now)
        };
      })
      .filter(Boolean);
    const active = positions.filter((p) => p.offering.exit.basis !== 'exited');
    const paidAll = payments.filter((p) => p.status === 'paid');
    return {
      investor: inv,
      positions,
      active,
      exited: positions.filter((p) => p.offering.exit.basis === 'exited'),
      payments,
      totals: {
        invested: active.reduce((a, p) => a + p.invested, 0),
        investedAll: positions.reduce((a, p) => a + p.invested, 0),
        received: paidAll.reduce((a, p) => a + p.cents, 0),
        ytd: paidAll.filter((p) => p.date >= ytdStart).reduce((a, p) => a + p.cents, 0),
        scheduled: payments.filter((p) => p.status === 'scheduled').reduce((a, p) => a + p.cents, 0)
      }
    };
  };

  /** Documents available to one investor, built from their positions. */
  NS.investorDocs = function (ws, view) {
    const docs = [];
    const year = Number(today().slice(0, 4));
    view.positions.forEach((p) => {
      const o = p.offering;
      const exited = o.exit.basis === 'exited';
      if (!exited) {
        docs.push({ id: `qr-${o.id}-q3`, title: `Q3 ${year} Investor Update`, offeringId: o.id, cat: 'Reports', kind: 'update', date: `${year}-11-03`, pages: 8 });
        docs.push({ id: `qr-${o.id}-q2`, title: `Q2 ${year} Investor Update`, offeringId: o.id, cat: 'Reports', kind: 'update', date: `${year}-08-12`, pages: 8 });
      } else {
        docs.push({ id: `final-${o.id}`, title: 'Final Distribution Notice', offeringId: o.id, cat: 'Notices', kind: 'final', date: o.exit.date, pages: 2 });
      }
      if (p.date < `${year - 1}-12-31`) {
        const taxTitle = o.type === 'Delaware Statutory Trust' ? `${year - 1} Grantor Trust Tax Letter` : o.type === 'Private credit' ? `${year - 1} Form 1099-INT` : `${year - 1} Schedule K-1`;
        docs.push({ id: `tax-${o.id}-${year - 1}`, title: taxTitle, offeringId: o.id, cat: 'Tax', kind: 'tax', date: `${year}-03-12`, pages: o.type === 'Private credit' ? 1 : 12 });
      }
      docs.push({ id: `sub-${o.id}`, title: o.type === 'Private credit' ? 'Note Purchase Agreement' : 'Subscription Agreement', offeringId: o.id, cat: 'Legal', kind: 'legal', date: p.date, pages: 38 });
    });
    docs.push({ id: `stmt-${year}-q3`, title: `Account Statement, Q3 ${year}`, offeringId: null, cat: 'Statements', kind: 'statement', date: `${year}-10-15`, pages: 3 });
    docs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return docs;
  };

  NS.data = { allocate, split, holdersAt, investedAt, fakeRouting, abaCheckDigit, FREQ_MONTHS, ACCRED, rng, hashStr, ordinal, paymentDay };
})(window.CVPortal);
