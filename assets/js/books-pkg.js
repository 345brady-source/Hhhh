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
  const clone = (x) => JSON.parse(JSON.stringify(x));

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
    const dist = activity('3100') + activity('3300');
    const results = -tb.filter((r) => r.type === 'income' || r.type === 'expense' || r.type === 'gain').reduce((s, r) => s + r.debits - r.credits, 0);
    const capItems = [];
    if (at.begin['21'] + contrib + results - dist !== at.end['21']) capItems.push(`Beginning capital ${money(at.begin['21'])} + contributions ${money(contrib)} + book net income ${money(results)} - distributions ${money(dist)} = ${money(at.begin['21'] + contrib + results - dist)}, but ending capital (line 21) is ${money(at.end['21'])}.`);
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
    sheets.push(bs);
    if (roll) sheets.push(roll);
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
  void clone;
})(typeof window !== 'undefined' ? window : globalThis);
