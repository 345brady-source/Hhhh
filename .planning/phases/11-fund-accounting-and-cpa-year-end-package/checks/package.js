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
/**
 * The two investors' tax facts (made up), written onto the loaded copy in the shape onboarding.js persists
 * (11-CONTEXT 11-14 B1; fixtures/fund-a.js stays as it is): FA-1001 a U.S. individual with a signed W-9, FA-1002 a
 * foreign corporation with a signed W-8BEN-E, valid until 31 December of the third year after signing.
 */
function taxFacts(ws) {
  const one = ws.investors.find((i) => i.id === 'FA-1001');
  Object.assign(one, { type: 'individual', taxForm: 'W-9', tinLast4: '1234', address: '1 Example Street, Springfield IL 62701' });
  one.taxCert = { form: 'W-9', revision: 'March 2024', envelopeId: 'env-fa-1001-w9', at: '2026-01-08T15:00:00.000Z', signed: true, signedBy: 'Investor One', tinLast4: '1234', backupWithholding: false };
  const two = ws.investors.find((i) => i.id === 'FA-1002');
  Object.assign(two, { type: 'entity', taxType: 'foreign-entity', taxForm: 'W-8BEN-E', address: '2 Sample Road, London' });
  two.taxCert = { form: 'W-8BEN-E', revision: 'October 2021', envelopeId: 'env-fa-1002-w8', at: '2026-01-09T15:00:00.000Z', signed: true, signedBy: 'Investor Two', chapter3: 'Corporation', chapter4: '', country: 'United Kingdom', ftinLast4: '9876', noFtin: false, validUntil: '2029-12-31' };
}
/** Fund A with its tax facts; opts.edit runs after them. */
function fundA(NS, opts) {
  opts = opts || {};
  return fundWs(NS, 'fund-a', Object.assign({}, opts, { edit: (ws, F) => (taxFacts(ws), opts.edit && opts.edit(ws, F)) }));
}
const pkgOf = (NS, A, year, today) => NS.books.package(A.ws, A.o, year || 2026, { today: today || TODAY, actor: ACTOR.by });
/**
 * The leak search (T-11-42, 11-CONTEXT 11-14 W2): every cell whose value is a number is dropped on every sheet (rows and
 * totals), every 64-character hex run removed, and what is left searched for a run of nine or more digits and for the
 * shapes ddd-dd-dddd and dd-ddddddd. Returns the matches.
 */
function leaks(K) {
  const keep = (r) => (Array.isArray(r) ? r.map((v) => (typeof v === 'number' ? null : v)) : r);
  const text = JSON.stringify((K.sheets || []).map((s) => Object.assign({}, s, { rows: s.rows.map(keep), total: keep(s.total) }))).concat(JSON.stringify(K.checks || []));
  const t = text.replace(/[0-9a-fA-F]{64}/g, '');
  return [].concat(t.match(/(?<![0-9a-f])[0-9]{9,}(?![0-9a-f])/g) || [], t.match(/(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g) || [], t.match(/(?<![\d-])\d{2}-\d{7}(?!\d)/g) || []);
}
const sampleFund = (NS, ws, id) => ({ ws, o: ws.offerings.find((x) => x.id === id) });
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
  },

  /** Task 2: every D-02 sheet in order; carry and the waterfall on fund C; every sheet a titled schedule toCsv accepts; white label; income and expenses by month; investments. */
  sheets: ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const K = pkgOf(NS, A);
    const ids = K.sheets.map((s) => s.id);
    const WANT = ['cover', 'tb', 'gl', 'bankrec', 'ie', 'bs', 'roll', 'own', 'tax', 'dist', 'fees', 'waterfall', 'inv'];
    check(`fund A's package holds, in order, ${WANT.join(', ')} (13: no carry, f8825 or property sheet)`, J(ids) === J(WANT), ids);
    const B = NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31');
    const fees = K.sheets.find((s) => s.id === 'fees');
    check("sheet fees is the Audit page's management fee schedule", !!fees && J(fees) === J(B.list.find((x) => x.id === 'fees')), fees && fees.title);
    const all = [];
    const C = fundWs(NS, 'fund-c');
    const KC = pkgOf(NS, C);
    const cids = KC.sheets.map((s) => s.id);
    check("fund C's package also holds carry, after fees and before waterfall", cids.indexOf('carry') > cids.indexOf('fees') && cids.indexOf('carry') < cids.indexOf('waterfall') && cids.indexOf('fees') > 0, cids);
    const BC = NS.audit.build(C.ws, C.o, '2026-01-01', '2026-12-31');
    check("fund C's carry sheet is the Audit page's carried interest schedule", J(sheetOf(KC, 'carry')) === J(BC.list.find((x) => x.id === 'carry')), sheetOf(KC, 'carry') && sheetOf(KC, 'carry').title);
    const wf = sheetOf(KC, 'waterfall');
    check("fund C's waterfall 'Distributions through the waterfall': Date, Distribution ID, Gross, To investors, To the general partner", !!wf && wf.title === 'Distributions through the waterfall' && J(wf.cols.map((c) => [c.h, c.t])) === J([['Date', 'date'], ['Distribution ID', 'text'], ['Gross', 'money'], ['To investors', 'money'], ['To the general partner', 'money']]), wf && wf.cols);
    check("fund C's waterfall row 2026-05-15 fc-run-1 15,000,000 / 14,000,000 / 1,000,000", !!wf && J(wf.rows) === J([['2026-05-15', 'fc-run-1', 15000000, 14000000, 1000000]]), wf && wf.rows);
    check("fund A's waterfall has no row (no distribution paid the general partner)", !!sheetOf(K, 'waterfall') && sheetOf(K, 'waterfall').rows.length === 0, sheetOf(K, 'waterfall') && sheetOf(K, 'waterfall').rows);
    [K, KC].forEach((P) => P.sheets.forEach((s) => all.push(s)));
    const csvBad = [];
    all.forEach((s) => {
      try {
        NS.audit.toCsv(s);
      } catch (e) {
        csvBad.push(`${s.id}: toCsv threw ${e.message}`);
      }
      const c = NS.books.packageCsv(s);
      if (/NaN|undefined|\[object/.test(c)) csvBad.push(`${s.id}: packageCsv holds NaN, undefined or [object]`);
      if (!s.title || typeof s.title !== 'string' || !s.file || !Array.isArray(s.cols) || !Array.isArray(s.rows) || s.currency !== 'USD') csvBad.push(`${s.id}: not a titled schedule object with currency`);
      s.rows.concat(s.total ? [s.total] : []).forEach((r, i) => r.length !== s.cols.length && csvBad.push(`${s.id} row ${i}: ${r.length} cells for ${s.cols.length} columns`));
    });
    check(`every sheet of both packages (${all.length}) is a titled schedule object with currency, toCsv accepts it, packageCsv writes no NaN, and every row has one cell per column`, !csvBad.length, csvBad);
    // White label (11-CONTEXT 11-14 W5): the package never names the product, in either edition.
    const wl = [];
    ['diy', 'managed'].forEach((ed) => {
      const N2 = load(TODAY, ed);
      const txt = J(pkgOf(N2, fundA(N2)));
      if (txt.indexOf(N2.EDITION.product) >= 0) wl.push(`${ed}: holds ${N2.EDITION.product}`);
      if (/Powered by/i.test(txt)) wl.push(`${ed}: holds 'Powered by'`);
      if (/\bbasic\b/i.test(txt)) wl.push(`${ed}: holds the word basic`);
    });
    check("the package JSON holds neither NS.EDITION.product nor 'Powered by' (diy and managed)", !wl.length, wl);
    // Income and expenses by month (fund A, hand-worked).
    const ie = sheetOf(K, 'ie');
    const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    check("ie 'Income and expenses by month': Account, Account name, Kind, January..December, Total (money)", !!ie && ie.title === 'Income and expenses by month' && J(ie.cols.map((c) => c.h)) === J(['Account', 'Account name', 'Kind'].concat(MON, ['Total'])) && ie.cols.slice(3).every((c) => c.t === 'money'), ie && ie.cols.map((c) => c.h));
    const ieRow = (code) => rowBy(ie, 0, code);
    const mon = (code, m) => (ieRow(code) ? ieRow(code)[3 + m] : undefined);
    const tot = (code) => (ieRow(code) ? ieRow(code)[15] : undefined);
    check('ie: 4010 Income, June 1,200,000, total 1,200,000', !!ieRow('4010') && ieRow('4010')[2] === 'Income' && mon('4010', 5) === 1200000 && tot('4010') === 1200000, ieRow('4010'));
    check('ie: 5000 Expense, 150,000 each month, total 1,800,000', !!ieRow('5000') && ieRow('5000')[2] === 'Expense' && MON.every((x, m) => mon('5000', m) === 150000) && tot('5000') === 1800000, ieRow('5000'));
    check('ie: 5100 Expense, March 750,000', !!ieRow('5100') && mon('5100', 2) === 750000 && tot('5100') === 750000, ieRow('5100'));
    check('ie: 6100 Gain, September 6,000,000 and December 3,000,000, total 9,000,000', !!ieRow('6100') && ieRow('6100')[2] === 'Gain' && mon('6100', 8) === 6000000 && mon('6100', 11) === 3000000 && tot('6100') === 9000000, ieRow('6100'));
    check('ie: rows only for the four accounts with activity in 2026', !!ie && J(ie.rows.map((r) => r[0])) === J(['4010', '5000', '5100', '6100']), ie && ie.rows.map((r) => r[0]));
    check('ie total row: book net income 7,650,000', !!ie && !!ie.total && ie.total[15] === 7650000, ie && ie.total);
    // Investments.
    const inv = sheetOf(K, 'inv');
    check("inv 'Investments': Investment, Event, Date, Amount, Cost given up, Realized gain (loss), Fair value", !!inv && inv.title === 'Investments' && J(inv.cols.map((c) => [c.h, c.t])) === J([['Investment', 'text'], ['Event', 'text'], ['Date', 'date'], ['Amount', 'money'], ['Cost given up', 'money'], ['Realized gain (loss)', 'money'], ['Fair value', 'money']]), inv && inv.cols);
    check('inv: Portfolio Co X Purchase 2026-01-20 40,000,000; Held at year end, cost 40,000,000, fair value 49,000,000', !!inv && J(inv.rows) === J([['Portfolio Co X', 'Purchase', '2026-01-20', 40000000, null, null, null], ['Portfolio Co X', 'Held at year end', '2026-12-31', 40000000, null, null, 49000000]]), inv && inv.rows);
    const incSale = sheetOf(KC, 'inv');
    check('fund C inv: the sale of Portfolio Co Y 2026-04-20: proceeds 15,000,000, cost given up 10,000,000, realized gain 5,000,000', !!incSale && incSale.rows.some((r) => J(r) === J(['Portfolio Co Y', 'Sale', '2026-04-20', 15000000, 10000000, 5000000, null])), incSale && incSale.rows);
  },

  /** Task 2: investor tax details from the fixture's facts, nothing beyond the last four digits, a missing form named. */
  tax: ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const K = pkgOf(NS, A);
    const tx = sheetOf(K, 'tax');
    const COLS = ['Investor ID', 'Name', 'Address', 'Investing as', 'U.S. or foreign', 'Retirement plan', 'Partner type', 'Form on file', 'Form revision', 'Signed', 'Chapter 3 status', 'Taxpayer number ending', 'Foreign taxpayer number ending', 'Backup withholding', 'Treaty country', 'W-8 valid until'];
    check(`tax 'Investor tax details' columns: ${COLS.join(', ')}`, !!tx && tx.title === 'Investor tax details' && J(tx.cols.map((c) => c.h)) === J(COLS), tx && tx.cols.map((c) => c.h));
    const WANT = [
      ['FA-1001', 'Investor One', '1 Example Street, Springfield IL 62701', 'Individual', 'U.S.', 'No', 'Limited', 'W-9', 'March 2024', 'Yes', '', '1234', '', 'No', '', ''],
      ['FA-1002', 'Investor Two', '2 Sample Road, London', 'LLC, partnership or corporation', 'Foreign', 'No', 'Limited', 'W-8BEN-E', 'October 2021', 'Yes', 'Corporation', '', '9876', '', '', '2029-12-31']
    ];
    check('tax: the two rows from the facts exactly', !!tx && J(tx.rows) === J(WANT), { got: tx && tx.rows, want: WANT });
    const cover = sheetOf(K, 'cover');
    check("the cover names no missing tax input for fund A's two investors", !!cover && !cover.rows.some((r) => /^Missing input: Investor tax details/.test(r[0])), cover && cover.rows.filter((r) => /^Missing input/.test(r[0])));
    const lk = leaks(K);
    check("fund A's package: no run of nine or more digits and no ddd-dd-dddd or dd-ddddddd shape outside the amounts", !lk.length, lk);
    // The search can fail: a nine-digit run in FA-1001's name, and each shape, are found.
    ['123456789', '000-12-3456', '00-1234567'].forEach((bad) => {
      const N2 = load();
      const A2 = fundA(N2, { edit: (ws) => (ws.investors.find((i) => i.id === 'FA-1001').title = `Investor ${bad}`) });
      const found = leaks(pkgOf(N2, A2));
      check(`the same search over a copy with '${bad}' in FA-1001's name finds it`, found.indexOf(bad) >= 0, found);
    });
    // Over a sample fund's package too.
    const N3 = load('2026-11-19');
    const ws = N3.ops.ensure(N3.seedWorkspace(N3.TENANTS.find((t) => t.sample && t.offerings && t.offerings.some((o) => o.id === 'kb-fund-ii')) || N3.TENANTS.find((t) => t.sample)));
    const kb = sampleFund(N3, ws, 'kb-fund-ii');
    const Kkb = kb.o ? N3.books.package(kb.ws, kb.o, 2025, { today: '2026-11-19', actor: ACTOR.by }) : null;
    const lk2 = Kkb ? leaks(Kkb) : ['no kb-fund-ii'];
    check(`kb-fund-ii's 2025 package (${Kkb ? sheetOf(Kkb, 'tax').rows.length : 0} investors): no run of nine or more digits and no taxpayer-number shape`, !lk2.length && !!Kkb && sheetOf(Kkb, 'tax').rows.length > 0, lk2.slice(0, 5));
    // A copy with FA-1002's form removed: 'To be confirmed', every form-derived cell empty, and a cover row.
    const N4 = load();
    const A4 = fundA(N4, {
      edit: (w) => {
        const i = w.investors.find((x) => x.id === 'FA-1002');
        i.taxForm = '';
        delete i.taxCert;
        delete i.taxType;
      }
    });
    const K4 = pkgOf(N4, A4);
    const r4 = rowBy(sheetOf(K4, 'tax'), 0, 'FA-1002');
    check("FA-1002 with no form: Form on file 'To be confirmed', every form-derived cell empty", !!r4 && J(r4) === J(['FA-1002', 'Investor Two', '2 Sample Road, London', 'LLC, partnership or corporation', '', 'No', 'Limited', 'To be confirmed', '', '', '', '', '', '', '', '']), r4);
    const c4 = sheetOf(K4, 'cover').rows.filter((r) => /^Missing input/.test(r[0]));
    check("the cover names it once: 'Missing input: Investor tax details, FA-1002: tax form' 'To be confirmed'", J(c4) === J([['Missing input: Investor tax details, FA-1002: tax form', 'To be confirmed', null]]), c4);
    // An unsigned form reads Signed 'No' and is named on the cover.
    const N5 = load();
    const A5 = fundA(N5, { edit: (w) => (w.investors.find((x) => x.id === 'FA-1001').taxCert.signed = false) });
    const K5 = pkgOf(N5, A5);
    const r5 = rowBy(sheetOf(K5, 'tax'), 0, 'FA-1001');
    check("FA-1001's W-9 unsigned: Form on file 'W-9 (not signed)', Signed 'No', and a cover row for it", !!r5 && r5[7] === 'W-9 (not signed)' && r5[9] === 'No' && sheetOf(K5, 'cover').rows.some((r) => r[0] === 'Missing input: Investor tax details, FA-1001: signed tax form'), r5);
  },

  /** Task 2: ownership and its changes with dates (fund A, hand-worked). */
  own: ({ check }) => {
    const NS = load();
    const K = pkgOf(NS, fundA(NS));
    const own = sheetOf(K, 'own');
    check("own 'Ownership and changes': Date, Investor ID, Investor, Event, Amount, Ownership after (pct)", !!own && own.title === 'Ownership and changes' && J(own.cols.map((c) => [c.h, c.t])) === J([['Date', 'date'], ['Investor ID', 'text'], ['Investor', 'text'], ['Event', 'text'], ['Amount', 'money'], ['Ownership after', 'pct']]), own && own.cols);
    const WANT = [
      ['2026-01-10', 'FA-1001', 'Investor One', 'Commitment', 60000000, '66.6667'],
      ['2026-01-10', 'FA-1002', 'Investor Two', 'Commitment', 30000000, '33.3333'],
      ['2026-01-15', 'FA-1001', 'Investor One', 'Contribution', 30000000, '66.6667'],
      ['2026-01-15', 'FA-1002', 'Investor Two', 'Contribution', 15000000, '33.3333'],
      ['2026-12-15', 'FA-1001', 'Investor One', 'Distribution', 600000, '66.6667'],
      ['2026-12-15', 'FA-1002', 'Investor Two', 'Distribution', 300000, '33.3333']
    ];
    const got = own ? own.rows.map((r) => r.slice(0, 5).concat([pct4(r[5])])) : null;
    check("own: fund A's rows exactly (commitments x100 from the positions; only 3000/3100 investor lines)", J(got) === J(WANT), { got, want: WANT });
  },

  /** Task 2: distributions by type, with plan 11-05's withheld example as tax withheld from a foreign investor (W1). */
  dist: ({ check }) => {
    const NS = load();
    const A = fundA(NS, {
      edit: (w) => {
        const l = w.runs[0].lines.find((x) => x.investorId === 'FA-1002');
        l.withheld = [{ kind: 'foreign', cents: 80000, basisCents: 300000, ratePct: null, source: 'entered', why: 'Foreign investor', confirmedBy: 'Check Runner', confirmedAt: '2026-12-15T15:00:00.000Z' }];
        l.netCents = 220000;
      }
    });
    const K = pkgOf(NS, A);
    const d = sheetOf(K, 'dist');
    check("dist 'Distributions by type': Date, Investor ID, Investor, Type, Gross, Tax withheld, Paid, Withholding kind", !!d && d.title === 'Distributions by type' && J(d.cols.map((c) => [c.h, c.t])) === J([['Date', 'date'], ['Investor ID', 'text'], ['Investor', 'text'], ['Type', 'text'], ['Gross', 'money'], ['Tax withheld', 'money'], ['Paid', 'money'], ['Withholding kind', 'text']]), d && d.cols);
    const WANT = [
      ['2026-12-15', 'FA-1001', 'Investor One', 'Realization proceeds', 600000, 0, 600000, ''],
      ['2026-12-15', 'FA-1002', 'Investor Two', 'Realization proceeds', 300000, 80000, 220000, 'Withholding on a foreign investor'],
      ['', '', 'All investors', 'Realization proceeds', 900000, 80000, 820000, '']
    ];
    check("dist: FA-1002 300,000 / 80,000 / 220,000 'Withholding on a foreign investor'; 'All investors' 900,000 / 80,000 / 820,000", !!d && J(d.rows) === J(WANT), { got: d && d.rows, want: WANT });
    const N0 = load();
    const d0 = sheetOf(pkgOf(N0, fundA(N0)), 'dist');
    check('dist without the withholding: 600,000 / 0 / 600,000, 300,000 / 0 / 300,000 and All investors 900,000 / 0 / 900,000', !!d0 && J(d0.rows.map((r) => r.slice(4, 7))) === J([[600000, 0, 600000], [300000, 0, 300000], [900000, 0, 900000]]), d0 && d0.rows);
  },

  /** Task 2: the real estate variant: Form 8825 lines, property and depreciation inputs, Schedule L line 19b; a second property with nothing entered. */
  property: ({ check }) => {
    const NS = load();
    const re = Object.keys(NS.OFFERING_TYPES).find((k) => NS.OFFERING_TYPES[k].profile === 'realestate');
    let second = null;
    const A = fundA(NS, {
      edit: (w) => {
        w.offerings[0].type = re;
        Object.assign(w.books.funds['fund-a'].holdings[0], { name: 'Main Street Building', kind: 'property', address: '10 Main Street', placed: '2026-02-01', landCents: 10000000, buildingCents: 30000000 });
      },
      after: (w) => {
        [
          { date: '2026-04-01', memo: 'Rent received', src: 'bank:pr-1', lines: [['1000', 2400000], ['4020', -2400000, '', 'fa-x']] },
          { date: '2026-04-15', memo: 'Real estate taxes', src: 'bank:pr-2', lines: [['5320', 300000, '', 'fa-x'], ['1000', -300000]] },
          { date: '2026-02-01', memo: 'Loan proceeds', src: 'bank:pr-3', lines: [['1000', 20000000], ['2500', -20000000, '', 'fa-x']] },
          { date: '2026-07-01', memo: 'Mortgage payment', src: 'bank:pr-4', lines: [['5200', 600000, '', 'fa-x'], ['2500', 400000, '', 'fa-x'], ['1000', -1000000]] }
        ].forEach((e) => NS.books.post(w, 'fund-a', e, ACTOR));
        second = NS.books.addHolding(w, 'fund-a', { name: 'Second Property', kind: 'property' });
      }
    });
    check(`offering type '${re}' has the realestate profile and the second property was added`, !!re && !!second, { re, second });
    const K = pkgOf(NS, A);
    const ids = K.sheets.map((s) => s.id);
    check('the package holds f8825 after ie and property after waterfall', ids.indexOf('f8825') === ids.indexOf('ie') + 1 && ids.indexOf('property') === ids.indexOf('waterfall') + 1, ids);
    const f8 = sheetOf(K, 'f8825');
    check("f8825 'Rental real estate by property': Property, Form 8825 line, Account, Account name, Amount", !!f8 && f8.title === 'Rental real estate by property' && J(f8.cols.map((c) => [c.h, c.t])) === J([['Property', 'text'], ['Form 8825 line', 'text'], ['Account', 'text'], ['Account name', 'text'], ['Amount', 'money']]), f8 && f8.cols);
    const fx = f8 ? f8.rows.filter((r) => r[0] === 'Main Street Building').map((r) => [r[1], r[2], r[4]]) : null;
    check("f8825 for the property: '2a' 4020 2,400,000, '8' 5200 600,000, '10' 5320 300,000", J(fx) === J([['2a', '4020', 2400000], ['8', '5200', 600000], ['10', '5320', 300000]]), f8 && f8.rows);
    const na = f8 ? f8.rows.filter((r) => r[0] === 'Not assigned to a property').map((r) => [r[1], r[2], r[4]]) : null;
    check("f8825: the legal fees with no property under 'Not assigned to a property': '9' 5100 750,000", J(na) === J([['9', '5100', 750000]]), na);
    const pr = sheetOf(K, 'property');
    const PCOLS = ['Property', 'Address', 'Placed in service', 'Land', 'Building', 'Cost in the books', 'Additions in the year', 'Mortgage balance at year end', 'Interest paid in the year'];
    check(`property 'Property and depreciation inputs': ${PCOLS.join(', ')}`, !!pr && pr.title === 'Property and depreciation inputs' && J(pr.cols.map((c) => c.h)) === J(PCOLS), pr && pr.cols.map((c) => c.h));
    const p1 = rowBy(pr, 0, 'Main Street Building');
    check('property row: 10 Main Street, 2026-02-01, land 10,000,000, building 30,000,000, cost 40,000,000, additions 40,000,000, mortgage 19,600,000, interest 600,000', J(p1) === J(['Main Street Building', '10 Main Street', '2026-02-01', 10000000, 30000000, 40000000, 40000000, 19600000, 600000]), p1);
    const p2 = rowBy(pr, 0, 'Second Property');
    check("the second property with nothing entered: address, placed in service, land and building 'To be confirmed' (never 0 or blank)", J(p2) === J(['Second Property', 'To be confirmed', 'To be confirmed', 'To be confirmed', 'To be confirmed', 0, 0, 0, 0]), p2);
    const miss = sheetOf(K, 'cover').rows.filter((r) => /^Missing input: Property/.test(r[0])).map((r) => r[0]);
    const WANTM = ['address', 'placed in service', 'land', 'building'].map((x) => `Missing input: Property and depreciation inputs, Second Property: ${x}`);
    check('the cover names each of the four gaps once', J(miss) === J(WANTM), miss);
    const csv = NS.books.packageCsv(pr);
    check("packageCsv writes 'To be confirmed' in the money columns as text and the figures as amounts", csv.indexOf('Second Property,To be confirmed,To be confirmed,To be confirmed,To be confirmed,0.00,0.00,0.00,0.00') >= 0 && csv.indexOf('100000.00,300000.00,400000.00') >= 0, csv.split('\r\n'));
    const bs = sheetOf(K, 'bs');
    const l19b = rowBy(bs, 0, '19b');
    check("bs line 19b 'Mortgages, notes, bonds payable in 1 year or more' 0 -> 19,600,000", !!l19b && l19b[1] === 'Mortgages, notes, bonds payable in 1 year or more' && l19b[2] === 0 && l19b[3] === 19600000, l19b);
    const l1 = rowBy(bs, 0, '1');
    check('bs line 1 cash 3,200,000 + 2,400,000 - 300,000 + 20,000,000 - 1,000,000 = 24,300,000', !!l1 && l1[3] === 24300000, l1);
    ['sch_l', 'capital', 'nav', 'tb_zero'].forEach((id) => check(`the '${id}' check passes`, !!checkOf(K, id) && checkOf(K, id).status === 'pass', checkOf(K, id)));
    const ie = sheetOf(K, 'ie');
    const m = (code, i) => (rowBy(ie, 0, code) || [])[3 + i];
    check('ie: 4020 April 2,400,000, 5320 April 300,000, 5200 July 600,000', m('4020', 3) === 2400000 && m('5320', 3) === 300000 && m('5200', 6) === 600000, ie && ie.rows.filter((r) => ['4020', '5320', '5200'].indexOf(r[0]) >= 0));
    const inv = sheetOf(K, 'inv');
    const ir = inv ? inv.rows.filter((r) => r[0] === 'Main Street Building') : [];
    check("inv: the property's purchase 2026-01-20 40,000,000 and its year-end row (cost 40,000,000, fair value 49,000,000)", J(ir) === J([['Main Street Building', 'Purchase', '2026-01-20', 40000000, null, null, null], ['Main Street Building', 'Held at year end', '2026-12-31', 40000000, null, null, 49000000]]), ir);
  }
};

L.runParts(cases, { name: 'PACKAGE', unit: 'cases', flag: '--case' });
