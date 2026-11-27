/*
 * The CPA year-end package's contents (plan 11-14): one pure function returns every sheet the sponsor's CPA needs for
 * a fund and a tax year, as schedule objects (the shape audit.js's schedules have: { id, file, title, desc, cols, rows,
 * total, currency }), plus the package's own checks. The files (workbook, PDF, zip) and the button are plan 11-16's.
 *
 *   NS.books.package(ws, o, year, { today, actor }) → { sheets: [ schedule ], checks: [ { id, title, status, items } ] }
 *
 * The books are brought up to date first (NS.books.sync, as the Audit page's build does), then the Audit page's own
 * build for year-01-01..year-12-31 is read: the trial balance, general ledger, bank reconciliation, roll-forward, fees
 * and carried interest are its schedule objects, never rebuilt, so the files, the screen and the books cannot differ.
 * Every figure is book basis on the accrual method; nothing here is a tax-basis or K-1 figure, and the cover says so.
 *
 * Only what was recorded is printed. An input nobody entered (a property's address, placed-in-service date, land and
 * building; an investor's tax form; an investment's value) reads 'To be confirmed' (or 'At cost (no value entered)'),
 * never 0 or blank, and is named again on the cover as 'Missing input: <sheet>, <record>: <field>'. No sheet holds more
 * than the last four digits of any taxpayer number (C-04): only tinLast4 and ftinLast4 are read, and only when they are
 * exactly four digits. Signed W-9 and W-8 files are added only by the sponsor's tick in plan 11-16.
 *
 * Reads only: nothing here writes the change log or saves (sync, called first, is the journal's own).
 */
(function (root) {
  'use strict';
  const NS = (root.CVPortal = root.CVPortal || {});
  const B = NS.books;
  if (!B) return;

  const TBC = 'To be confirmed';
  const COL = (h, t) => ({ h, t: t || 'text' });
  const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const money = (c) => (NS.audit && NS.audit.money ? NS.audit.money(c) : String(c));

  /* ---------- Schedule L (Form 1065), in the form's order ---------- */
  // [line, description, side]: a asset, l liability, c capital; the two totals are worked out.
  const SCHED_L = [
    ['1', 'Cash', 'a'],
    ['6', 'Other current assets', 'a'],
    ['8', 'Other investments', 'a'],
    ['9a', 'Buildings and other depreciable assets', 'a'],
    ['9b', 'Less accumulated depreciation', 'a'],
    ['11', 'Land (net of any amortization)', 'a'],
    ['13', 'Other assets', 'a'],
    ['14', 'Total assets', 'ta'],
    ['15', 'Accounts payable', 'l'],
    ['16', 'Mortgages, notes, bonds payable in less than 1 year', 'l'],
    ['17', 'Other current liabilities', 'l'],
    ['19a', 'Loans from partners (or persons related to partners)', 'l'],
    ['19b', 'Mortgages, notes, bonds payable in 1 year or more', 'l'],
    ['20', 'Other liabilities', 'l'],
    ['21', 'Partners’ capital accounts', 'c'],
    ['22', 'Total liabilities and capital', 'tl']
  ];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /** [account, Form 8825 (Rev. December 2025) line] for rental real estate, in the form's line order. */
  const F8825 = [
    ['4020', '2a'],
    ['5300', '7'],
    ['5200', '8'],
    ['5100', '9'],
    ['5320', '10'],
    ['5310', '11'],
    ['5330', '12'],
    ['5340', '17'],
    ['5390', '17']
  ];
  const SIDE = {};
  SCHED_L.forEach((x) => (SIDE[x[0]] = x[2]));
  /**
   * The Schedule L line an account is summed into: the chart's suggested line when it is one of the lines above and on
   * the account's side; otherwise 13 for an asset, 20 for a liability, 21 for capital and for income, expense and gain
   * (the books keep no closing entry, so line 21 carries the year's results). null for an account of no known type.
   */
  function lineOf(a) {
    const side = a.type === 'asset' ? 'a' : a.type === 'liability' ? 'l' : a.type === 'equity' || a.type === 'income' || a.type === 'expense' || a.type === 'gain' ? 'c' : '';
    if (!side) return null;
    if (a.line && SIDE[a.line] === side) return a.line;
    return side === 'a' ? '13' : side === 'l' ? '20' : '21';
  }

  /** The year's live journal lines (an entry that was reversed and its reversal are both left out). */
  function liveLines(ws, o, from, to) {
    const f = ws.books && ws.books.funds && ws.books.funds[o.id];
    const j = f && Array.isArray(f.journal) ? f.journal : [];
    const reversed = new Set();
    j.forEach((e) => e && e.rev && reversed.add(e.rev));
    const out = [];
    j.forEach((e) => {
      if (!e || e.rev || reversed.has(e.id) || typeof e.date !== 'string' || !Array.isArray(e.lines)) return;
      if ((from && e.date < from) || (to && e.date > to)) return;
      e.lines.forEach((l) => out.push({ id: e.id, date: e.date, src: String(e.src || ''), memo: e.memo || '', code: String(l[0]), cents: l[1], partner: l[2] || '', holding: l[3] || '' }));
    });
    return out;
  }
  const sumOf = (xs, pred) => xs.reduce((s, x) => s + (pred(x) ? x.cents : 0), 0);

  /* ---------- The package ---------- */
  function build(ws, o, year, opts) {
    opts = opts || {};
    if (!ws || !o || !o.id) throw new Error('The package needs a workspace and a fund.');
    const y = Number(year);
    if (!Number.isInteger(y) || y < 1900 || y > 9999) throw new Error('The tax year is a four-digit year.');
    if (!NS.audit || typeof NS.audit.build !== 'function') throw new Error('The audit engine (audit.js) is not loaded.');
    const from = `${y}-01-01`;
    const to = `${y}-12-31`;
    if (typeof B.sync === 'function') B.sync(ws, opts.today ? { today: opts.today } : undefined);
    const A = NS.audit.build(ws, o, from, to);
    const P = A.P;
    const cur = (P.S && P.S.currency) || 'USD';
    const of = (id) => A.list.find((s) => s.id === id) || null;
    const sheet = (id, title, desc, cols, rows, total) => ({ id, file: `${slug(title)}.csv`, title, desc: `${o.name}, tax year ${y}. ${desc}`, cols, rows, total: total || null, currency: cur });
    const missing = [];
    const miss = (sheetTitle, record, field) => missing.push([`Missing input: ${sheetTitle}, ${record}: ${field}`, TBC, null]);
    const accts = {};
    B.accounts(ws, o.id).forEach((a) => (accts[a.code] = a));
    const tb = B.trialBalance(ws, o.id, from, to);
    const yearLines = liveLines(ws, o, from, to);
    const toLines = liveLines(ws, o, '', to);
    const activity = (code) => sumOf(yearLines, (l) => l.code === code);

    /* Balance sheet in Schedule L order */
    const at = { begin: {}, end: {} };
    SCHED_L.forEach((x) => ((at.begin[x[0]] = 0), (at.end[x[0]] = 0)));
    const unplaced = [];
    tb.forEach((r) => {
      const ln = lineOf(accts[r.code] || { type: r.type, line: r.line });
      if (!ln) {
        if (r.begin || r.end) unplaced.push(`Account ${r.code} has no known type, so it is on no Schedule L line.`);
        return;
      }
      const sign = SIDE[ln] === 'a' ? 1 : -1;
      at.begin[ln] += sign * r.begin;
      at.end[ln] += sign * r.end;
    });
    ['begin', 'end'].forEach((k) => {
      at[k]['14'] = SCHED_L.filter((x) => x[2] === 'a').reduce((s, x) => s + at[k][x[0]], 0);
      at[k]['22'] = SCHED_L.filter((x) => x[2] === 'l' || x[2] === 'c').reduce((s, x) => s + at[k][x[0]], 0);
    });
    const bs = sheet('bs', 'Balance sheet in Schedule L order', 'Book basis: each asset, liability and capital account summed into its suggested Form 1065 Schedule L line; line 21 includes the year’s net income (the books keep no closing entry). The preparer confirms each line and moves any part of a mortgage due within a year to line 16.', [COL('Line'), COL('Description'), COL('Beginning of year', 'money'), COL('End of year', 'money')], SCHED_L.map((x) => [x[0], x[1], at.begin[x[0]], at.end[x[0]]]));

    /* Capital roll-forward by partner: the Audit page's rollforward with the ownership at both ends */
    const rf = of('rollforward');
    const f = P.fund;
    const beginOf = {};
    P.inv.forEach((a) => (beginOf[a.investor.id] = a.begin));
    const ownBegin = (id) => (f.begin > 0 ? (beginOf[id] || 0) / f.begin : 0);
    const roll = rf
      ? sheet(
          'roll',
          'Capital roll-forward by partner',
          'Each limited partner’s book capital account for the year, from the capital accounts; ownership is the partner’s share of limited partners’ capital at the beginning and the end of the year.',
          rf.cols.slice(0, -1).concat([COL('Ownership, beginning', 'pct'), COL('Ownership, end', 'pct')]),
          rf.rows.map((r) => r.slice(0, -1).concat([ownBegin(r[0]), r[r.length - 1]])),
          rf.total ? rf.total.slice(0, -1).concat([f.begin > 0 ? 1 : 0, rf.total[rf.total.length - 1]]) : null
        )
      : null;

    const generated = typeof NS.audit.generated === 'function' && NS.audit.generated(o);
    const fb = (ws.books && ws.books.funds && ws.books.funds[o.id]) || {};
    const holdings = (Array.isArray(fb.holdings) ? fb.holdings : []).filter((h) => h && h.id);
    const hname = {};
    holdings.forEach((h) => (hname[h.id] = h.name || h.id));
    const titleOf = (id) => {
      const i = (ws.investors || []).find((x) => x && x.id === id);
      return i ? i.title || i.contact || id : id;
    };

    /* Income and expenses by month */
    const KIND = { income: 'Income', expense: 'Expense', gain: 'Gain' };
    const typeOf = (code) => (accts[code] ? accts[code].type : '');
    const ieCodes = Array.from(new Set(yearLines.filter((l) => KIND[typeOf(l.code)]).map((l) => l.code))).sort();
    const ieNet = new Array(13).fill(0);
    const ieRows = ieCodes.map((code) => {
      const sign = typeOf(code) === 'expense' ? 1 : -1;
      const m = new Array(12).fill(0);
      yearLines.forEach((l) => l.code === code && (m[Number(l.date.slice(5, 7)) - 1] += sign * l.cents));
      const vals = m.concat([m.reduce((s, c) => s + c, 0)]);
      vals.forEach((c, k) => (ieNet[k] += sign === 1 ? -c : c));
      return [code, accts[code].name, KIND[typeOf(code)]].concat(vals);
    });
    const ie = sheet('ie', 'Income and expenses by month', 'Book basis: each income, expense and gain account with activity in the year, by month: income and gains as earned (a loss is negative), expenses as incurred. The total row is book net income.', [COL('Account'), COL('Account name'), COL('Kind')].concat(MONTHS.map((m) => COL(m, 'money')), [COL('Total', 'money')]), ieRows, ['', 'Book net income', ''].concat(ieNet));

    /* Rental real estate by property (Form 8825 lines) */
    const props = generated ? [] : holdings.filter((h) => h.kind === 'property');
    const isProp = {};
    props.forEach((h) => (isProp[h.id] = true));
    let f8825 = null;
    if (props.length) {
      const NONE = 'Not assigned to a property';
      const rows = [];
      props.map((h) => h.id).concat([null]).forEach((hid) => {
        F8825.forEach(([code, line]) => {
          if (!accts[code]) return;
          const c = sumOf(yearLines, (l) => l.code === code && (hid ? l.holding === hid : !isProp[l.holding]));
          if (c) rows.push([hid ? hname[hid] : NONE, line, code, accts[code].name, accts[code].type === 'income' ? -c : c]);
        });
      });
      f8825 = sheet('f8825', 'Rental real estate by property', 'Book basis: the year’s rental income and expenses recorded on each property, by Form 8825 (Rev. December 2025) line; lines recorded without a property are listed under ‘Not assigned to a property’. Depreciation is not in the books; the preparer works it out from the property and depreciation inputs.', [COL('Property'), COL('Form 8825 line'), COL('Account'), COL('Account name'), COL('Amount', 'money')], rows);
    }

    /* Ownership and changes */
    const months = (P.L && Array.isArray(P.L.months) && P.L.months) || [];
    const shareAt = (id, date) => {
      const m = months.find((x) => x.key === String(date).slice(0, 7));
      if (!m || !m.rows || !m.rows[id]) return null;
      const all = Object.keys(m.rows).reduce((s, k) => s + Math.max(0, m.rows[k].end || 0), 0);
      return all > 0 ? Math.max(0, m.rows[id].end || 0) / all : 0;
    };
    const ORDER = { Commitment: 0, 'Opening capital': 1, Contribution: 2, Distribution: 3, Redemption: 4 };
    const ev = [];
    (ws.investors || []).forEach((i) =>
      (i.positions || []).forEach((p) => {
        // A position's commitment is whole dollars (operations.js commitOf multiplies it by 100).
        if (p && p.offeringId === o.id && Number(p.commitment) > 0 && typeof p.date === 'string' && p.date >= from && p.date <= to) ev.push([p.date, i.id, titleOf(i.id), 'Commitment', Math.round(Number(p.commitment) * 100)]);
      })
    );
    yearLines.forEach((l) => {
      if (!l.partner) return;
      if (l.code === '3000') ev.push([l.date, l.partner, titleOf(l.partner), 'Contribution', -l.cents]);
      else if (l.code === '3100') ev.push([l.date, l.partner, titleOf(l.partner), l.src.indexOf('req:') === 0 ? 'Redemption' : 'Distribution', l.cents]);
      else if (l.code === '3900') ev.push([l.date, l.partner, titleOf(l.partner), 'Opening capital', -l.cents]);
    });
    ev.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : ORDER[a[3]] - ORDER[b[3]] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)));
    const own = sheet('own', 'Ownership and changes', 'Each commitment and each contribution, distribution and redemption in the year, with its date; ownership after is the partner’s share of limited partners’ capital at that month’s end.', [COL('Date', 'date'), COL('Investor ID'), COL('Investor'), COL('Event'), COL('Amount', 'money'), COL('Ownership after', 'pct')], ev.map((r) => r.concat([shareAt(r[1], r[0])])));

    /* Investor tax details (C-04: last four digits only) */
    const WH = NS.withholding;
    if (!WH || typeof WH.w8 !== 'function') throw new Error('The withholding module (withholding.js) is not loaded; the package reads each W-8’s validity from it.');
    if (!NS.inviteFlow || typeof NS.inviteFlow.taxOnFile !== 'function') throw new Error('The rule for a tax form on file (onboarding.js) is not loaded.');
    const TAX = 'Investor tax details';
    const four = (v) => (/^\d{4}$/.test(String(v == null ? '' : v)) ? String(v) : '');
    const taxRows = P.inv
      .map((a) => a.investor)
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((i) => {
        const id = i.id;
        const name = i.title || i.contact || id;
        const address = String(i.address || '').trim() || (miss(TAX, id, 'address'), TBC);
        const as = (NS.ENTITY_TYPES && NS.ENTITY_TYPES[i.type] && NS.ENTITY_TYPES[i.type].label) || (miss(TAX, id, 'investing as'), TBC);
        const ira = i.type === 'ira' ? 'Yes' : 'No';
        const form = String(i.taxForm || '');
        if (!form) {
          miss(TAX, id, 'tax form');
          return [id, name, address, as, '', ira, 'Limited', TBC, '', '', '', '', '', '', '', ''];
        }
        const c = i.taxCert && typeof i.taxCert === 'object' ? i.taxCert : {};
        const w = WH.w8(i, to);
        const isW8 = /^W-8/.test(form);
        const onFile = NS.inviteFlow.taxOnFile(i);
        let formCell = form;
        if (!onFile) {
          formCell = c.signed === false ? `${form} (not signed)` : `${form} (signed copy not received)`;
          miss(TAX, id, 'signed tax form');
        }
        const signed = c.signed === true ? 'Yes' : c.signed === false ? 'No' : 'Not recorded';
        const usf = w.foreign ? 'Foreign' : form === 'W-9' ? 'U.S.' : (miss(TAX, id, 'U.S. or foreign'), TBC);
        const ch3 = form === 'W-8BEN-E' ? c.chapter3 || (miss(TAX, id, 'chapter 3 status'), TBC) : '';
        const tin = w.foreign ? '' : four(c.tinLast4) || four(i.tinLast4) || (miss(TAX, id, 'taxpayer number'), TBC);
        const ftin = isW8 ? four(c.ftinLast4) || (c.noFtin ? 'Not required' : (miss(TAX, id, 'foreign taxpayer number'), TBC)) : '';
        const backup = form === 'W-9' ? (c.backupWithholding === true ? 'Yes' : c.backupWithholding === false ? 'No' : 'Not recorded') : '';
        const treaty = form === 'W-8BEN' ? String(c.treatyCountry || '') : '';
        let until = '';
        if (isW8 && w.validUntil) until = w.valid ? w.validUntil : `${w.validUntil} (expired by ${to})`;
        if (isW8 && w.signed && !w.valid) miss(TAX, id, `a current ${form}`);
        return [id, name, address, as, usf, ira, 'Limited', formCell, c.revision || 'Not recorded', signed, ch3, tin, ftin, backup, treaty, until];
      });
    const tax = sheet('tax', TAX, 'From each partner’s W-9 or W-8 on record. Taxpayer numbers are shown by their last four digits only; signed forms are included only when the sponsor chooses to include them.', ['Investor ID', 'Name', 'Address', 'Investing as', 'U.S. or foreign', 'Retirement plan', 'Partner type', 'Form on file', 'Form revision', 'Signed', 'Chapter 3 status', 'Taxpayer number ending', 'Foreign taxpayer number ending', 'Backup withholding', 'Treaty country', 'W-8 valid until'].map((h) => COL(h)), taxRows);

    /* Distributions by type */
    const KINDS = WH.KINDS || {};
    const paid = NS.data && typeof NS.data.paidLines === 'function' ? NS.data.paidLines(ws, { offeringId: o.id, from, to }) : [];
    const byType = [];
    const distRows = paid.map(({ run, line }) => {
      const gross = line.grossCents;
      const net = Number.isSafeInteger(line.netCents) ? line.netCents : gross;
      const kinds = Array.from(new Set((line.withheld || []).map((x) => (KINDS[x.kind] ? KINDS[x.kind].label : String(x.kind || '')))));
      let t = byType.find((x) => x[0] === run.type);
      if (!t) byType.push((t = [run.type, 0, 0, 0]));
      t[1] += gross;
      t[2] += gross - net;
      t[3] += net;
      return [run.date, line.investorId, titleOf(line.investorId), run.type, gross, gross - net, net, kinds.join('; ')];
    });
    byType.forEach((t) => distRows.push(['', '', 'All investors', t[0], t[1], t[2], t[3], '']));
    const dist = sheet('dist', 'Distributions by type', 'Each distribution paid in the year to each partner: the gross amount, the tax withheld and the amount paid; then each type’s totals for all investors.', [COL('Date', 'date'), COL('Investor ID'), COL('Investor'), COL('Type'), COL('Gross', 'money'), COL('Tax withheld', 'money'), COL('Paid', 'money'), COL('Withholding kind')], distRows);

    /* Distributions through the waterfall */
    const gpRuns = (ws.runs || [])
      .filter((r) => r && r.offeringId === o.id && !r.cancelled && r.gp > 0 && typeof r.date === 'string' && r.date >= from && r.date <= to && NS.data.runPaid(r))
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const wfRows = gpRuns.map((r) => [r.date, r.id, Number.isSafeInteger(r.gross) ? r.gross : r.total + r.gp, r.total, r.gp]);
    const wfSum = (k) => wfRows.reduce((s, r) => s + r[k], 0);
    const waterfall = sheet('waterfall', 'Distributions through the waterfall', wfRows.length ? 'Each distribution in the year that paid the general partner a share: the gross amount, what went to the investors and what went to the general partner.' : 'No distribution in the year paid the general partner a share.', [COL('Date', 'date'), COL('Distribution ID'), COL('Gross', 'money'), COL('To investors', 'money'), COL('To the general partner', 'money')], wfRows, ['', 'Total', wfSum(2), wfSum(3), wfSum(4)]);

    /* Property and depreciation inputs */
    const PROP = 'Property and depreciation inputs';
    const COST = { 1100: 1, 1400: 1, 1410: 1 };
    let property = null;
    const propCols = [COL('Property'), COL('Address'), COL('Placed in service', 'date'), COL('Land', 'money'), COL('Building', 'money'), COL('Cost in the books', 'money'), COL('Additions in the year', 'money'), COL('Mortgage balance at year end', 'money'), COL('Interest paid in the year', 'money')];
    if (props.length) {
      const rows = props.map((h) => {
        const name = hname[h.id];
        const address = String(h.address || '').trim() || (miss(PROP, name, 'address'), TBC);
        const placed = h.placed || (miss(PROP, name, 'placed in service'), TBC);
        const none = !(h.landCents > 0) && !(h.buildingCents > 0);
        if (none) miss(PROP, name, 'land'), miss(PROP, name, 'building');
        const on = (l) => l.holding === h.id;
        return [
          name,
          address,
          placed,
          none ? TBC : h.landCents || 0,
          none ? TBC : h.buildingCents || 0,
          sumOf(toLines, (l) => on(l) && COST[l.code]),
          sumOf(yearLines, (l) => on(l) && COST[l.code] && l.cents > 0),
          -sumOf(toLines, (l) => on(l) && l.code === '2500'),
          sumOf(yearLines, (l) => on(l) && l.code === '5200')
        ];
      });
      property = sheet('property', PROP, 'For each property the fund holds: what the sponsor entered (address, placed-in-service date, the split of cost between land and building) and, from the books, its cost, the year’s additions, the mortgage on it at year end and the interest paid on it in the year. Property is carried at cost; depreciation is the preparer’s.', propCols, rows);
    } else if (generated && P.S && P.S.key === 'realestate') {
      // A sample real estate fund: the Audit page's generated properties; what the generator does not give is to be confirmed.
      const rows = ((P.hold && P.hold.rows) || []).map((r) => {
        const name = r.name;
        const address = (r.h && r.h.location) || (miss(PROP, name, 'address'), TBC);
        miss(PROP, name, 'placed in service');
        miss(PROP, name, 'land');
        miss(PROP, name, 'building');
        miss(PROP, name, 'additions in the year');
        miss(PROP, name, 'interest paid in the year');
        return [name, address, TBC, TBC, TBC, r.cost, TBC, r.debt || 0, TBC];
      });
      property = sheet('property', PROP, 'For each property: its cost and the mortgage on it at year end; the placed-in-service date, the split between land and building, the year’s additions and the interest paid are to be confirmed. Property is carried at cost; depreciation is the preparer’s.', propCols, rows);
    }

    /* Investments */
    const INV = 'Investments';
    const NOINV = 'Not assigned to an investment';
    const invRows = [];
    if (generated) {
      ((P.hold && P.hold.rows) || []).forEach((r) => invRows.push([r.name, 'Held at year end', to, r.cost, null, null, r.fv]));
    } else {
      const marked = (hid) => (Array.isArray(fb.marks) ? fb.marks : []).some((m) => m && m.holding === hid && typeof m.date === 'string' && m.date <= to) || toLines.some((l) => l.holding === hid && l.src.indexOf('mark:') === 0);
      holdings
        .map((h) => h.id)
        .concat([''])
        .forEach((hid) => {
          const name = hid ? hname[hid] : NOINV;
          const byEntry = new Map();
          yearLines.forEach((l) => {
            if (l.holding !== hid || !(COST[l.code] || l.code === '6000')) return;
            const e = byEntry.get(l.id) || { date: l.date, debit: 0, credit: 0, gain: 0 };
            if (COST[l.code]) {
              if (l.cents > 0) e.debit += l.cents;
              else e.credit -= l.cents;
            } else e.gain -= l.cents;
            byEntry.set(l.id, e);
          });
          Array.from(byEntry.values())
            .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
            .forEach((e) => {
              if (e.debit) invRows.push([name, 'Purchase', e.date, e.debit, null, null, null]);
              if (e.credit) invRows.push([name, 'Sale', e.date, e.credit + e.gain, e.credit, e.gain, null]);
            });
          const cost = sumOf(toLines, (l) => l.holding === hid && COST[l.code]);
          const unreal = sumOf(toLines, (l) => l.holding === hid && l.code === '1150');
          if (!cost && !unreal) return;
          const valued = !!hid && (marked(hid) || unreal !== 0);
          if (!valued) miss(INV, name, 'fair value');
          invRows.push([name, 'Held at year end', to, cost, null, null, valued ? cost + unreal : 'At cost (no value entered)']);
        });
    }
    const inv = sheet('inv', INV, 'Each purchase and sale of an investment in the year and each investment held at year end. Amount is the price paid for a purchase, the proceeds of a sale and the cost in the books of an investment held at year end; fair value is the last value entered.', [COL('Investment'), COL('Event'), COL('Date', 'date'), COL('Amount', 'money'), COL('Cost given up', 'money'), COL('Realized gain (loss)', 'money'), COL('Fair value', 'money')], invRows);

    /* Checks */
    const checks = [];
    const add = (id, title, items) => checks.push({ id, title, status: items.length ? 'exception' : 'pass', items });
    const tbEnd = tb.reduce((s, r) => s + r.end, 0);
    add('tb_zero', 'Trial balance ending balances sum to zero', tbEnd === 0 ? [] : [`The trial balance’s ending balances sum to ${money(tbEnd)}, not $0.00.`]);
    const liabEnd = SCHED_L.filter((x) => x[2] === 'l').reduce((s, x) => s + at.end[x[0]], 0);
    const netAssets = at.end['14'] - liabEnd;
    const capTotal = f.end + f.gpEnd;
    add('nav', 'Net assets in the books agree to the capital accounts', netAssets === capTotal ? [] : [`Net assets in the books at ${to} are ${money(netAssets)}; the capital accounts total ${money(capTotal)}.`]);
    const schl = [];
    ['begin', 'end'].forEach((k) => {
      if (at[k]['14'] !== at[k]['22']) schl.push(`${k === 'begin' ? 'Beginning' : 'End'} of year: line 14 is ${money(at[k]['14'])}, line 22 is ${money(at[k]['22'])}.`);
    });
    add('sch_l', 'Schedule L balances at the beginning and end of the year', schl.concat(unplaced));
    const contrib = -activity('3000');
    const distCents = activity('3100') + activity('3300');
    const results = -tb.filter((r) => r.type === 'income' || r.type === 'expense' || r.type === 'gain').reduce((s, r) => s + r.debits - r.credits, 0);
    const capItems = [];
    if (at.begin['21'] + contrib + results - distCents !== at.end['21']) capItems.push(`Beginning capital ${money(at.begin['21'])} + contributions ${money(contrib)} + book net income ${money(results)} - distributions ${money(distCents)} = ${money(at.begin['21'] + contrib + results - distCents)}, but ending capital (line 21) is ${money(at.end['21'])}.`);
    if (at.end['21'] !== capTotal) capItems.push(`Ending capital (line 21) is ${money(at.end['21'])}; the capital accounts total ${money(capTotal)}.`);
    add('capital', 'Capital rolls forward and agrees to the capital accounts', capItems);
    const ct = typeof B.closedThrough === 'function' ? B.closedThrough(ws, o.id) : '';
    add('closed', 'Books closed through the year end', ct && ct >= to ? [] : [`The books are ${ct ? `closed only through ${ct}` : 'not closed'}; close them through ${to} before the return is prepared.`]);

    /* Cover */
    const t = ws.tenant || {};
    const who = opts.actor && typeof opts.actor === 'object' ? opts.actor.by : opts.actor;
    const firm = t.legalName || t.name || '';
    const preparedBy = [who, firm].filter((x) => typeof x === 'string' && x.trim()).join(', ');
    const cover = [
      ['Fund', o.name || o.id, null],
      ['Tax year', String(y), null],
      ['Currency', cur, null]
    ];
    if (cur !== 'USD') cover.push(['Translation', `Amounts are in ${cur}; Schedule L must be translated to U.S. dollars`, null]);
    cover.push(
      ['Accounting method', 'Accrual', null],
      ['Basis', 'Book basis. No figure here is a tax-basis or K-1 figure.', null],
      ['Fund type', o.type || TBC, null],
      ['Prepared by', preparedBy || TBC, null],
      ['Prepared at', opts.today || NS.dates.today(), null],
      ['Books closed through', ct || 'Not closed', null],
      ['Signed tax forms included', 'No', null]
    );
    checks.forEach((c) => cover.push([`Check: ${c.title}`, c.status === 'pass' ? 'Pass' : `Exception: ${c.items.join(' | ')}`, null]));
    const booksChk = (A.chk || []).find((c) => c.id === 'books');
    if (booksChk) booksChk.items.forEach((x) => cover.push(['Open item', x, null]));
    cover.push(['Unrealized appreciation included in book income', '', -activity('6100')]);
    cover.push(['Expenses accrued and unpaid at year end', '', -sumOf(toLines, (l) => l.code === '2000' && !l.partner)]);
    const owed = -sumOf(toLines, (l) => l.code === '2000' && !!l.partner);
    if (owed) cover.push(['Distributions returned and owed to investors', '', owed]);
    cover.push(['Organizational costs in the year', '', activity('5120')]);

    const sheets = [];
    const coverSheet = sheet('cover', 'Cover', 'Book basis on the accrual method; what this package holds, its checks and what is still open.', [COL('Item'), COL('Value'), COL('Amount', 'money')], cover);
    sheets.push(coverSheet);
    ['tb', 'gl', 'bankrec'].forEach((id) => of(id) && sheets.push(of(id)));
    sheets.push(ie);
    if (f8825) sheets.push(f8825);
    sheets.push(bs);
    if (roll) sheets.push(roll);
    sheets.push(own, tax, dist);
    ['fees', 'carry'].forEach((id) => of(id) && sheets.push(of(id)));
    sheets.push(waterfall);
    if (property) sheets.push(property);
    sheets.push(inv);
    coverSheet.rows = coverSheet.rows.concat(missing);
    return { sheets, checks };
  }

  /**
   * A sheet as CSV: NS.audit.toCsv's output, except that a text cell in a money, percentage or number column (an input
   * 'To be confirmed') is written as text rather than as a number.
   */
  function packageCsv(s) {
    const toCsv = NS.audit.toCsv;
    const head = toCsv(Object.assign({}, s, { rows: [], total: null })).replace(/\r\n$/, '');
    const line = (r) => {
      const cols = s.cols.map((c, i) => (typeof r[i] === 'string' && c.t !== 'text' && c.t !== 'date' ? { h: c.h, t: 'text' } : c));
      return toCsv({ cols, rows: [r], total: null, currency: s.currency }).split('\r\n')[1];
    };
    const lines = [head].concat(s.rows.map(line));
    if (s.total) lines.push(line(s.total));
    return lines.join('\r\n') + '\r\n';
  }

  B.package = build;
  B.packageCsv = packageCsv;
  B.packageLineOf = lineOf;
})(typeof window !== 'undefined' ? window : globalThis);
