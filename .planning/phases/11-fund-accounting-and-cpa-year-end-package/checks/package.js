// gate: node
// last "PACKAGE: PASS (cases run: 9)"
// The CPA year-end package's contents (plan 11-14, no browser): NS.books.package(ws, o, year, { today, actor }) returns
// every sheet the CPA needs for a fund and year as schedule objects, plus the package's checks. The portal is loaded
// inside each case with load11.js (the scripts diy.html lists, then books.js, books-post.js, bankfiles.js, books-bank.js,
// books-hold.js, withholding.js and books-pkg.js), today 2027-01-20 for funds A, C and D (2026-11-19 for sample funds).
// Every expected figure is the plan's hand-worked one (11-14-PLAN.md), whole cents. The investors' tax facts are written
// onto the loaded copy of fund A here (11-CONTEXT 11-14 B1); fixtures/fund-a.js is not changed.
//   node package.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "PACKAGE: PASS (cases run: N)" or
// "PACKAGE: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal } = require('./load11.js');

const TODAY = '2027-01-20';
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
const EXTRA = ['books.js', 'books-post.js', 'bankfiles.js', 'books-bank.js', 'books-hold.js', 'withholding.js', 'books-pkg.js'];
const J = (x) => JSON.stringify(x);
const pct4 = (x) => (typeof x === 'number' ? (x * 100).toFixed(4) : String(x));

/** The portal with the journal, posting, bank, holdings, withholding and the package, inside the case. */
function load(today, edition) {
  const NS = loadPortal(undefined, { today: today || TODAY, edition: edition || 'diy', extra: EXTRA });
  if (!NS.books || typeof NS.books.package !== 'function') throw new Error('books-pkg.js did not load: NS.books.package is not a function');
  return NS;
}
const fixture = (name) => JSON.parse(JSON.stringify(require('./fixtures/' + name + '.js')));

/** A fixture's records with its other entries posted directly; the package brings the books up to date itself. */
function fundWs(NS, name, opts) {
  opts = opts || {};
  const F = fixture(name);
  const ws = F.records;
  const oid = F.expect.offeringId;
  ws.investors.forEach((i) => i.onboarding || (i.onboarding = { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05', source: 'manual' }));
  if (opts.edit) opts.edit(ws, F);
  F.entries.filter((e) => !opts.keep || opts.keep(e)).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  if (opts.after) opts.after(ws, F);
  const o = ws.offerings.find((x) => x.id === oid);
  return { F, ws, oid, o };
}
const pkgOf = (NS, A, year) => NS.books.package(A.ws, A.o, year || 2026, { today: TODAY, actor: ACTOR.by });
const sheetOf = (K, id) => (K && Array.isArray(K.sheets) ? K.sheets.find((s) => s.id === id) : null) || null;
const checkOf = (K, id) => (K && Array.isArray(K.checks) ? K.checks.find((c) => c.id === id) : null) || null;
const rowBy = (s, i, v) => (s ? s.rows.find((r) => r[i] === v) : null) || null;

/* ---------- Hand-worked figures (11-14-PLAN.md) ---------- */
// bs: [line, beginning of year, end of year]
const FUND_A_BS = [
  ['1', 0, 3200000],
  ['8', 0, 49000000],
  ['14', 0, 52200000],
  ['17', 0, 450000],
  ['21', 0, 51750000],
  ['22', 0, 52200000]
];
// roll: Investor ID, Investor, Beginning, Contributions, Distributions, Income, Gain, Fees, Carried interest, Ending,
// Ownership beginning, Ownership end (percentages compared to four places)
const FUND_A_ROLL = [
  ['FA-1001', 'Investor One', 0, 30000000, -600000, 300000, 6000000, -1200000, 0, 34500000, '0.0000', '66.6667'],
  ['FA-1002', 'Investor Two', 0, 15000000, -300000, 150000, 3000000, -600000, 0, 17250000, '0.0000', '33.3333']
];

const cases = {
  /** Task 1 (tracer): fund A's 2026 package: the cover's three amounts and the closed check, the Schedule L balance sheet, the capital check, the roll-forward. */
  'fund-a': ({ check }) => {
    const NS = load();
    const A = fundWs(NS, 'fund-a');
    const K = pkgOf(NS, A);
    check('package returns { sheets, checks }', !!K && Array.isArray(K.sheets) && Array.isArray(K.checks), K && Object.keys(K));
    const cover = sheetOf(K, 'cover');
    check("the cover sheet 'Cover' has columns Item, Value, Amount (money)", !!cover && cover.title === 'Cover' && J(cover.cols.map((c) => [c.h, c.t])) === J([['Item', 'text'], ['Value', 'text'], ['Amount', 'money']]), cover && cover.cols);
    const amt = (label) => {
      const r = rowBy(cover, 0, label);
      return r ? r[2] : undefined;
    };
    check("cover: 'Unrealized appreciation included in book income' 9,000,000", amt('Unrealized appreciation included in book income') === 9000000, amt('Unrealized appreciation included in book income'));
    check("cover: 'Expenses accrued and unpaid at year end' 0", amt('Expenses accrued and unpaid at year end') === 0, amt('Expenses accrued and unpaid at year end'));
    check("cover: 'Organizational costs in the year' 0", amt('Organizational costs in the year') === 0, amt('Organizational costs in the year'));
    check("cover: no 'Distributions returned and owed to investors' row (none owed)", !rowBy(cover, 0, 'Distributions returned and owed to investors'), rowBy(cover, 0, 'Distributions returned and owed to investors'));
    const v = (label) => {
      const r = rowBy(cover, 0, label);
      return r ? r[1] : undefined;
    };
    check("cover: Fund 'Fund A, L.P.', Tax year '2026', Currency 'USD', Accounting method 'Accrual'", v('Fund') === 'Fund A, L.P.' && v('Tax year') === '2026' && v('Currency') === 'USD' && v('Accounting method') === 'Accrual', [v('Fund'), v('Tax year'), v('Currency'), v('Accounting method')]);
    check("cover: Basis 'Book basis. No figure here is a tax-basis or K-1 figure.'", v('Basis') === 'Book basis. No figure here is a tax-basis or K-1 figure.', v('Basis'));
    check("cover: Prepared by 'Check Runner, Fund A Sponsor Management, LLC'; Prepared at '2027-01-20'; Books closed through 'Not closed'; Signed tax forms included 'No'", v('Prepared by') === 'Check Runner, Fund A Sponsor Management, LLC' && v('Prepared at') === '2027-01-20' && v('Books closed through') === 'Not closed' && v('Signed tax forms included') === 'No', [v('Prepared by'), v('Prepared at'), v('Books closed through'), v('Signed tax forms included')]);
    const closed = checkOf(K, 'closed');
    check("the 'closed' check is an exception with one item until the books are closed through 2026-12-31", !!closed && closed.status === 'exception' && closed.items.length === 1, closed);
    const cRow = cover && cover.rows.find((r) => /^Check: /.test(r[0]) && closed && r[0] === `Check: ${closed.title}`);
    check("the cover carries the closed check's row with its exception", !!cRow && /^Exception: /.test(cRow[1]), cRow);
    check('the cover carries one row per package check (5)', !!cover && !!K && K.checks.length === 5 && K.checks.every((c) => cover.rows.some((r) => r[0] === `Check: ${c.title}`)), K && K.checks.map((c) => c.id));
    const bs = sheetOf(K, 'bs');
    check("the balance sheet 'Balance sheet in Schedule L order' has Line, Description, Beginning of year, End of year", !!bs && bs.title === 'Balance sheet in Schedule L order' && J(bs.cols.map((c) => [c.h, c.t])) === J([['Line', 'text'], ['Description', 'text'], ['Beginning of year', 'money'], ['End of year', 'money']]), bs && bs.cols);
    FUND_A_BS.forEach(([line, b, e]) => {
      const r = rowBy(bs, 0, line);
      check(`bs line ${line}: ${b} -> ${e}`, !!r && r[2] === b && r[3] === e, r);
    });
    const lines = bs ? bs.rows.map((r) => r[0]) : [];
    check('bs lines in Schedule L order: 1, 6, 8, 9a, 9b, 11, 13, 14, 15, 16, 17, 19a, 19b, 20, 21, 22', J(lines) === J(['1', '6', '8', '9a', '9b', '11', '13', '14', '15', '16', '17', '19a', '19b', '20', '21', '22']), lines);
    ['tb_zero', 'nav', 'sch_l', 'capital'].forEach((id) => {
      const c = checkOf(K, id);
      check(`the '${id}' check passes`, !!c && c.status === 'pass' && c.items.length === 0, c);
    });
    const roll = sheetOf(K, 'roll');
    const got = roll ? roll.rows.map((r) => r.slice(0, 10).concat([pct4(r[10]), pct4(r[11])])) : null;
    check("the roll-forward 'Capital roll-forward by partner' rows are the hand-worked ones", !!roll && roll.title === 'Capital roll-forward by partner' && J(got) === J(FUND_A_ROLL), { got, want: FUND_A_ROLL });
    const heads = roll ? roll.cols.map((c) => c.h) : [];
    check("the roll-forward's last two columns are 'Ownership, beginning' and 'Ownership, end' (pct)", !!roll && J(heads.slice(-2)) === J(['Ownership, beginning', 'Ownership, end']) && roll.cols.slice(-2).every((c) => c.t === 'pct'), heads);
    const B = NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31');
    ['tb', 'gl', 'bankrec'].forEach((id) => {
      const s = sheetOf(K, id);
      const a = B.list.find((x) => x.id === id);
      check(`sheet ${id} is the Audit page's schedule of the same id for 2026`, !!s && !!a && J(s) === J(a), s && s.title);
    });
  }
};

L.runParts(cases, { name: 'PACKAGE', unit: 'cases', flag: '--case' });
