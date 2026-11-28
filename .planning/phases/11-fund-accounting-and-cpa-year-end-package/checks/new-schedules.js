// gate: node
// last "NEW SCHEDULES: PASS (cases run: 7)"
// The statements that did not exist (plan 11-12, no browser): trial balance, general ledger, statement of cash flows,
// bank reconciliation and financial highlights, as schedules 20 to 24 of the Audit page and its package, built from the
// journal for every fund. The portal is loaded inside each case with load11.js (the scripts diy.html lists, then
// books.js, books-post.js, bankfiles.js, books-bank.js and books-hold.js), today 2027-01-20 for funds A and C. Every
// expected figure is the plan's hand-worked one (11-12-PLAN.md), whole cents.
//   node new-schedules.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "NEW SCHEDULES: PASS (cases run: N)" or
// "NEW SCHEDULES: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const fs = require('fs');
const { loadPortal, sampleWorkspaces } = require('./load11.js');

const TODAY = '2027-01-20';
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
const EXTRA = ['books.js', 'books-post.js', 'bankfiles.js', 'books-bank.js', 'books-hold.js'];
const J = (x) => JSON.stringify(x);

/** The portal with the journal, posting, bank files, bank reconciliation and holdings, inside the case. */
function load(today, edition) {
  const NS = loadPortal(undefined, { today: today || TODAY, edition: edition || 'diy', extra: EXTRA });
  if (!NS.books || typeof NS.books.sync !== 'function') throw new Error('books.js and books-post.js did not load');
  return NS;
}
const fixture = (name) => JSON.parse(JSON.stringify(require('./fixtures/' + name + '.js')));
const schedOf = (B, id) => B.list.find((x) => x.id === id) || null;
const rowsOf = (B, id) => {
  const s = schedOf(B, id);
  return s ? JSON.parse(JSON.stringify(s.rows)) : null;
};

/** A fixture's records with its other entries posted directly; build itself brings the books up to date. */
function fundWs(NS, name, opts) {
  opts = opts || {};
  const F = fixture(name);
  const ws = F.records;
  const oid = F.expect.offeringId;
  ws.investors.forEach((i) => i.onboarding || (i.onboarding = { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05', source: 'manual' }));
  if (opts.edit) opts.edit(ws, F);
  F.entries.filter((e) => !opts.keep || opts.keep(e)).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  const o = ws.offerings.find((x) => x.id === oid);
  return { F, ws, oid, o };
}

/* ---------- Hand-worked figures (11-12-PLAN.md) ---------- */
const FUND_A_CF = [
  ['Net increase (decrease) in net assets from operations', 7650000],
  ['Net change in unrealized (appreciation) depreciation on investments', -9000000],
  ['Purchases of investments', -40000000],
  ['Change in management fees payable', 450000],
  ['Net cash provided by (used in) operating activities', -40900000],
  ['Contributions', 45000000],
  ['Distributions and redemptions', -900000],
  ['Net cash provided by (used in) financing activities', 44100000],
  ['Net increase (decrease) in cash', 3200000],
  ['Cash at beginning of period', 0],
  ['Cash at end of period', 3200000]
];
// Gross debits in 2026 (each equals the credits): calls 45,000,000 + fees 1,800,000 + distribution 900,000 + purchase
// 40,000,000 + legal 750,000 + fees paid 1,350,000 + dividend 1,200,000 + valuations 9,000,000 = 100,000,000.
const FUND_A_GROSS = 100000000;
const FUND_C_CF = [
  ['Net increase (decrease) in net assets from operations', 5000000],
  ['Net realized (gain) loss on investments', -5000000],
  ['Purchases of investments', -10000000],
  ['Proceeds from sales of investments', 15000000],
  ['Net cash provided by (used in) operating activities', 5000000],
  ['Contributions', 10000000],
  ['Distributions and redemptions', -14000000],
  ['Distributions to the general partner', -1000000],
  ['Net cash provided by (used in) financing activities', -5000000],
  ['Net increase (decrease) in cash', 0],
  ['Cash at beginning of period', 0],
  ['Cash at end of period', 0]
];
const EXP = 'Expenses to average limited partners’ capital';
const NII = 'Net investment income (loss) to average limited partners’ capital';
const IRR = 'Net internal rate of return since inception';
const TR = 'Total return for the period';
const NO_CAP = ' (not available: no limited partners’ capital in the period)';
const NO_FLOWS = ' (not available: no cash flows to the period end)';

/**
 * Fund A through plan 11-08's flow (wave 3 B1): the fixture's mark: entries posted, the records synced, account
 * Operating (ending 6789) added, fund-a.ofx imported, autoMatch run and the six lines without a candidate decided as
 * the fixture's bank: entries are.
 */
function fundAThroughBank(NS) {
  const F = fixture('fund-a');
  const ws = F.records;
  ws.investors.forEach((i) => i.onboarding || (i.onboarding = { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05', source: 'manual' }));
  const oid = F.expect.offeringId;
  const o = ws.offerings.find((x) => x.id === oid);
  const BB = NS.books.bank;
  F.entries.filter((e) => e.src.indexOf('mark:') === 0).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  NS.books.sync(ws, { today: TODAY });
  const acct = BB.addAccount(ws, oid, { name: 'Operating', last4: '6789' });
  const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'bank', 'fund-a.ofx'), 'utf8');
  BB.importLines(ws, oid, acct.id, NS.bankFiles.parse(text), { name: 'fund-a.ofx', sha256: NS.audit.sha256(text), fileId: 'file-fund-a.ofx', by: ACTOR.by, at: ACTOR.at });
  BB.autoMatch(ws, oid, acct.id);
  const lines = ws.books.funds[oid].bank.lines.slice();
  [
    [2, { kind: 'purchase', holding: 'fa-x' }],
    [3, { kind: 'account', account: '5100' }],
    [4, { kind: 'account', account: '2100' }],
    [5, { kind: 'account', account: '4010' }],
    [6, { kind: 'account', account: '2100' }],
    [7, { kind: 'account', account: '2100' }]
  ].forEach(([i, d]) => BB.categorize(ws, oid, lines[i].id, d, ACTOR));
  return { F, ws, oid, o, BB, acct };
}

/** T6 for one fund and one period: the statements tie to each other and to the journal. Returns the failures. */
function ties(NS, ws, o, from, to) {
  const B = NS.audit.build(ws, o, from, to);
  const P = B.P;
  const bad = [];
  const row = (id, label) => (schedOf(B, id) || { rows: [] }).rows.find((r) => r[0] === label) || null;
  const tb = NS.books.trialBalance(ws, o.id, P.from, P.to);
  const results = -tb.filter((r) => r.type === 'income' || r.type === 'expense' || r.type === 'gain').reduce((s, r) => s + r.debits - r.credits, 0);
  const bal = (codes, at) => NS.books.balance(ws, o.id, codes, at);
  const cashCodes = Array.from(new Set(NS.books.accounts(ws, o.id).map((a) => a.code).concat(tb.map((r) => r.code)))).filter((c) => String(c).slice(0, 2) === '10');
  const dayBefore = NS.dates.isoOf(new Date(NS.dates.parse(P.from).getTime() - 864e5));
  const na = row('al', 'Net assets (partners’ capital)');
  const end = row('chg', 'End of period');
  if (!na || !end || na[1] !== end[3]) bad.push(`al net assets ${na && na[1]} != chg end of period ${end && end[3]}`);
  const ni = row('ops', 'Net increase (decrease) in net assets from operations');
  if (!ni || ni[1] !== results) bad.push(`ops net increase ${ni && ni[1]} != journal results ${results}`);
  const soi = schedOf(B, 'soi');
  const cost = bal('1100', P.to);
  const fv = bal(['1100', '1150'], P.to);
  // The schedule's total is net of securities sold short (cost less short proceeds, fair value less short fair value);
  // the journal carries shorts at fair value in 2300. So the long rows tie to 1100 and 1100 + 1150, the short rows to
  // 2300, and the total's fair value to 1100 + 1150 + 2300. A fund with no short is the plan's tie exactly.
  const rs = soi ? soi.rows : [];
  const shorts = rs.filter((r) => r[6] < 0);
  const sumOf = (xs, i) => xs.reduce((s, r) => s + r[i], 0);
  if (!soi || !soi.total) bad.push('no schedule of investments total');
  else if (!shorts.length) {
    if (soi.total[5] !== cost || soi.total[6] !== fv) bad.push(`soi total cost ${soi.total[5]} / fair value ${soi.total[6]} != 1100 ${cost} / 1100+1150 ${fv}`);
  } else {
    const longs = rs.filter((r) => !(r[6] < 0));
    const short = bal('2300', P.to);
    if (sumOf(longs, 5) !== cost || sumOf(longs, 6) !== fv) bad.push(`soi long rows cost ${sumOf(longs, 5)} / fair value ${sumOf(longs, 6)} != 1100 ${cost} / 1100+1150 ${fv}`);
    if (sumOf(shorts, 6) !== short) bad.push(`soi short rows fair value ${sumOf(shorts, 6)} != 2300 ${short}`);
    if (soi.total[6] !== fv + short || soi.total[5] !== sumOf(rs, 5)) bad.push(`soi total ${soi.total[5]} / ${soi.total[6]} != rows ${sumOf(rs, 5)} / 1100+1150+2300 ${fv + short}`);
  }
  const inc = row('cf', 'Net increase (decrease) in cash');
  const cend = row('cf', 'Cash at end of period');
  const cbeg = row('cf', 'Cash at beginning of period');
  const dCash = bal(cashCodes, P.to) - bal(cashCodes, dayBefore);
  if (!inc || inc[1] !== dCash) bad.push(`cf net increase in cash ${inc && inc[1]} != change in cash accounts ${dCash}`);
  if (!cbeg || !cend || !inc || cbeg[1] + inc[1] !== cend[1]) bad.push(`cf beginning ${cbeg && cbeg[1]} + increase != end ${cend && cend[1]}`);
  const alCash = row('al', 'Cash and cash equivalents');
  if (!cend || !alCash || cend[1] !== alCash[1]) bad.push(`cf cash at end ${cend && cend[1]} != al cash ${alCash && alCash[1]}`);
  const t = schedOf(B, 'tb');
  if (!t || !t.total || t.total[7] !== 0 || t.total[5] !== t.total[6]) bad.push(`tb total ${t && J(t.total)}: ending balances do not sum to 0 or debits != credits`);
  return { bad, B, P };
}

const cases = {
  /** Task 1 (tracer): fund A's 2026 Audit build carries the trial balance and the cash flow statement worked by hand. */
  'fund-a': ({ check }) => {
    const NS = load();
    const A = fundWs(NS, 'fund-a');
    const B = NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31');
    const tb = schedOf(B, 'tb');
    check("build returns a trial balance schedule '20_Trial_balance.csv' titled 'Trial balance'", !!tb && tb.file === '20_Trial_balance.csv' && tb.title === 'Trial balance', tb && { file: tb.file, title: tb.title });
    const got = tb ? tb.rows.map((r) => ({ code: r[0], begin: r[4], end: r[7] })) : null;
    const want = A.F.expect.tb.map((r) => ({ code: r.code, begin: 0, end: r.end }));
    check("the trial balance's rows are expect.tb's ten accounts in code order, each beginning at 0 and ending at the hand-worked balance", J(got) === J(want), { got, want });
    const ok = !!tb && tb.rows.every((r) => r[4] + r[5] - r[6] === r[7]);
    check('every row: beginning + debits - credits = ending', ok, tb && tb.rows);
    const t = tb && tb.total;
    check(
      `total row ['', 'Total', '', '', 0, ${FUND_A_GROSS}, ${FUND_A_GROSS}, 0]: debits equal credits, the ending balances sum to 0`,
      !!t && J(t) === J(['', 'Total', '', '', 0, FUND_A_GROSS, FUND_A_GROSS, 0]),
      t
    );
    const pos = tb ? tb.rows.filter((r) => r[7] > 0).reduce((a, r) => a + r[7], 0) : null;
    const neg = tb ? -tb.rows.filter((r) => r[7] < 0).reduce((a, r) => a + r[7], 0) : null;
    check(`debit balances sum to ${A.F.expect.tbDebits} and credit balances to ${A.F.expect.tbCredits} (the fixture's)`, pos === A.F.expect.tbDebits && neg === A.F.expect.tbCredits, { pos, neg });
    check(
      "the trial balance's columns: Account, Account name, Type, Schedule L line (suggested), Beginning balance, Debits, Credits, Ending balance",
      !!tb && J(tb.cols.map((c) => [c.h, c.t])) === J([['Account', 'text'], ['Account name', 'text'], ['Type', 'text'], ['Schedule L line (suggested)', 'text'], ['Beginning balance', 'money'], ['Debits', 'money'], ['Credits', 'money'], ['Ending balance', 'money']]),
      tb && tb.cols
    );
    const cash = tb && tb.rows.find((r) => r[0] === '1000');
    check("account 1000 reads 'Cash', 'Asset', Schedule L line '1'", !!cash && cash[1] === 'Cash' && cash[2] === 'Asset' && cash[3] === '1', cash);
    check("the description: 'January 1, 2026 to December 31, 2026. Book basis; the Schedule L line is a suggestion for the preparer.'", !!tb && tb.desc === 'January 1, 2026 to December 31, 2026. Book basis; the Schedule L line is a suggestion for the preparer.', tb && tb.desc);
    const cf = schedOf(B, 'cf');
    check("build returns '22_Statement_of_cash_flows.csv' titled 'Statement of cash flows'", !!cf && cf.file === '22_Statement_of_cash_flows.csv' && cf.title === 'Statement of cash flows', cf && { file: cf.file, title: cf.title });
    const cfr = rowsOf(B, 'cf');
    check('the cash flow statement is exactly the hand-worked rows and amounts, in order (zero lines left out)', J(cfr) === J(FUND_A_CF), { got: cfr, want: FUND_A_CF });
    const ids = B.list.map((s) => s.id);
    const at = ids.indexOf('checks');
    check("the new schedules come after every existing one (after 'checks')", at >= 0 && ids.indexOf('tb') > at && ids.indexOf('cf') > at, ids);
    check('the new schedules carry the currency', !!tb && tb.currency === 'USD' && !!cf && cf.currency === 'USD', tb && [tb.currency, cf && cf.currency]);
  },

  /** The general ledger: one row per journal line of the period, debits equal credits, every Source its entry's src. */
  gl: ({ check }) => {
    const NS = load();
    const A = fundWs(NS, 'fund-a');
    const B = NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31');
    const gl = schedOf(B, 'gl');
    check("build returns '21_General_ledger.csv' titled 'General ledger'", !!gl && gl.file === '21_General_ledger.csv' && gl.title === 'General ledger', gl && { file: gl.file, title: gl.title });
    check(
      'the columns: Date (date), Entry, Account, Account name, Memo, Source, Investor ID, Investment, Debit (money), Credit (money)',
      !!gl && J(gl.cols.map((c) => [c.h, c.t])) === J([['Date', 'date'], ['Entry', 'text'], ['Account', 'text'], ['Account name', 'text'], ['Memo', 'text'], ['Source', 'text'], ['Investor ID', 'text'], ['Investment', 'text'], ['Debit', 'money'], ['Credit', 'money']]),
      gl && gl.cols
    );
    const journal = A.ws.books.funds[A.oid].journal.filter((e) => e.date >= '2026-01-01' && e.date <= '2026-12-31');
    const lines = journal.reduce((n, e) => n + e.lines.length, 0);
    check(`one row per journal line: ${lines} lines in ${journal.length} entries (23: 15 from the records, 8 posted)`, !!gl && gl.rows.length === lines && journal.length === 23, gl && { rows: gl.rows.length, lines, entries: journal.length });
    const src = new Map(journal.map((e) => [e.id, e.src]));
    check("every row's Source is its entry's src", !!gl && gl.rows.every((r) => src.get(r[1]) === r[5]), gl && gl.rows.filter((r) => src.get(r[1]) !== r[5]).slice(0, 3));
    const d = gl ? gl.rows.reduce((s, r) => s + (r[8] || 0), 0) : null;
    const c = gl ? gl.rows.reduce((s, r) => s + (r[9] || 0), 0) : null;
    check(`debits total ${FUND_A_GROSS} = credits total, and the total row says the same`, d === FUND_A_GROSS && c === FUND_A_GROSS && !!gl.total && gl.total[8] === FUND_A_GROSS && gl.total[9] === FUND_A_GROSS, { d, c, total: gl && gl.total });
    check('each row has a debit or a credit, never both', !!gl && gl.rows.every((r) => (r[8] > 0) !== (r[9] > 0)), null);
    const buy = gl && gl.rows.find((r) => r[5] === 'bank:fa-1' && r[2] === '1100');
    check("the purchase row: 2026-01-20, account 1100 'Investments, at cost', investment 'Portfolio Co X', debit 40,000,000", !!buy && buy[0] === '2026-01-20' && buy[3] === 'Investments, at cost' && buy[7] === 'Portfolio Co X' && buy[8] === 40000000 && buy[9] == null, buy);
    const call = gl && gl.rows.find((r) => r[5] === 'call:fa-call-1:FA-1002' && r[2] === '3000');
    check("the FA-1002 call row carries investor 'FA-1002' and credit 15,000,000", !!call && call[6] === 'FA-1002' && call[9] === 15000000, call);
    check('rows in date order', !!gl && gl.rows.every((r, i) => !i || gl.rows[i - 1][0] <= r[0]), null);
    check("the description: 'January 1, 2026 to December 31, 2026. Every journal line.'", !!gl && gl.desc === 'January 1, 2026 to December 31, 2026. Every journal line.', gl && gl.desc);
    // A memo that starts like a formula is guarded in the CSV (T-11-37; the page escapes every cell).
    NS.books.post(A.ws, A.oid, { date: '2026-12-30', memo: '=HYPERLINK("x") <b>bold</b>', src: 'man:t1', lines: [['5900', 100], ['1000', -100]] }, ACTOR);
    const csv = NS.audit.toCsv(schedOf(NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31'), 'gl'));
    check("a memo beginning '=' is written with a leading apostrophe in the CSV", csv.indexOf(`"'=HYPERLINK(""x"") <b>bold</b>"`) >= 0, csv.split('\r\n').filter((x) => /HYPERLINK/.test(x)));
  },

  /** The bank reconciliation: none added, not reconciled yet, and after plan 11-08's flow the four rows. */
  bankrec: ({ check }) => {
    const NS = load();
    const A = fundWs(NS, 'fund-a');
    const B0 = NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31');
    const s0 = schedOf(B0, 'bankrec');
    check("build returns '23_Bank_reconciliation.csv' titled 'Bank reconciliation'", !!s0 && s0.file === '23_Bank_reconciliation.csv' && s0.title === 'Bank reconciliation', s0 && { file: s0.file, title: s0.title });
    check(
      'the columns: Bank account, Line, Date (date), Description, Amount (money)',
      !!s0 && J(s0.cols.map((c) => [c.h, c.t])) === J([['Bank account', 'text'], ['Line', 'text'], ['Date', 'date'], ['Description', 'text'], ['Amount', 'money']]),
      s0 && s0.cols
    );
    check("fund A before any import: the one row 'No bank account added'", J(rowsOf(B0, 'bankrec')) === J([['', 'No bank account added', '', '', null]]), rowsOf(B0, 'bankrec'));
    check("the description: 'Latest reconciliation of each bank account on or before December 31, 2026.'", !!s0 && s0.desc === 'Latest reconciliation of each bank account on or before December 31, 2026.', s0 && s0.desc);
    const R = fundAThroughBank(NS);
    const B1 = NS.audit.build(R.ws, R.o, '2026-01-01', '2026-12-31');
    check("after the import, with no reconciliation stored: 'Not reconciled through 2026-12-31'", J(rowsOf(B1, 'bankrec')) === J([['Operating ending 6789', 'Not reconciled through 2026-12-31', '', '', null]]), rowsOf(B1, 'bankrec'));
    R.BB.markReconciled(R.ws, R.oid, R.acct.id, '2026-12-31', 3500000, ACTOR);
    const want = [
      ['Operating ending 6789', 'Statement balance', '2026-12-31', '', 3500000],
      ['Operating ending 6789', 'Outstanding item', '2026-12-15', 'Distribution fa-run-1', -300000],
      ['Operating ending 6789', 'Book balance', '2026-12-31', '', 3200000],
      ['Operating ending 6789', 'Difference', '2026-12-31', '', 0]
    ];
    const got = rowsOf(NS.audit.build(R.ws, R.o, '2026-01-01', '2026-12-31'), 'bankrec');
    check('after the reconciliation at 2026-12-31: statement 3,500,000, the FA-1002 check -300,000 outstanding, book 3,200,000, difference 0', J(got) === J(want), { got, want });
    const r3 = rowsOf(NS.audit.build(R.ws, R.o, '2026-01-01', '2026-11-30'), 'bankrec');
    check("a reconciliation dated after the period end is not used: 'Not reconciled through 2026-11-30'", J(r3) === J([['Operating ending 6789', 'Not reconciled through 2026-11-30', '', '', null]]), r3);
    R.BB.addAccount(R.ws, R.oid, { name: 'Reserve' });
    const r4 = rowsOf(NS.audit.build(R.ws, R.o, '2026-01-01', '2026-12-31'), 'bankrec');
    check("a second account with no last four digits and no reconciliation adds 'Reserve', 'Not reconciled through 2026-12-31'", J(r4) === J(want.concat([['Reserve', 'Not reconciled through 2026-12-31', '', '', null]])), r4);
    // The books hold 500.00 deposited 2026-01-05, before the first statement line (2026-01-15), that the bank never shows:
    // with the opening balance entered as 0.00 the before-opening figure is that 500.00, and it is described.
    const P = fundAThroughBank(NS);
    NS.books.post(P.ws, P.oid, { date: '2026-01-05', memo: 'Deposit not in the bank', src: 'man:pre-open', lines: [['1000', 50000], ['2100', -50000]] }, ACTOR);
    P.BB.setOpening(P.ws, P.oid, P.acct.id, 0, ACTOR);
    P.BB.markReconciled(P.ws, P.oid, P.acct.id, '2026-12-31', 3500000, ACTOR);
    const r5 = rowsOf(NS.audit.build(P.ws, P.o, '2026-01-01', '2026-12-31'), 'bankrec');
    const pre = r5.filter((r) => r[1] === 'Outstanding item' && r[4] === 50000);
    check("the before-opening figure of 50,000 reads 'Before the opening balance on January 15, 2026: in the books, not yet in the bank'", pre.length === 1 && pre[0][3] === 'Before the opening balance on January 15, 2026: in the books, not yet in the bank', r5);
  },

  /** Financial highlights: fund A's three rows; a fund with no capital says what is missing, never NaN, Infinity or 0. */
  ratios: ({ check }) => {
    const NS = load();
    const A = fundWs(NS, 'fund-a');
    const B = NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31');
    const s = schedOf(B, 'ratios');
    check("build returns '24_Financial_highlights.csv' titled 'Financial highlights'", !!s && s.file === '24_Financial_highlights.csv' && s.title === 'Financial highlights', s && { file: s.file, title: s.title });
    check('the columns: Measure, Value (pct)', !!s && J(s.cols.map((c) => [c.h, c.t])) === J([['Measure', 'text'], ['Value', 'pct']]), s && s.cols);
    const caps = B.P.ms.map((m) => m.endCap);
    const avg = caps.reduce((a, x) => a + x, 0) / caps.length;
    check(`the average of the engine's month-end limited partners' capital over 2026 is ${A.F.expect.lpCapitalAverage}`, avg === A.F.expect.lpCapitalAverage && J(caps) === J(A.F.expect.lpCapital), { avg, caps });
    const perf = schedOf(B, 'perf');
    const irr = perf && perf.total ? perf.total[8] : undefined;
    const want = [[EXP, 2550000 / 46275000], [NII, -1350000 / 46275000], [IRR, irr]];
    const got = rowsOf(B, 'ratios');
    check("fund A: expenses 2,550,000 and net investment loss -1,350,000 over 46,275,000; the IRR is schedule 13's fund IRR", J(got) === J(want) && typeof irr === 'number' && isFinite(irr), { got, want });
    const csv = s ? NS.audit.toCsv(s) : '';
    check('the CSV reads 5.5105 and -2.9173', csv.indexOf(`${EXP},5.5105`) >= 0 && csv.indexOf(`${NII},-2.9173`) >= 0, csv);
    check("the description: 'January 1, 2026 to December 31, 2026. Ratios to average limited partners’ capital.'", !!s && s.desc === 'January 1, 2026 to December 31, 2026. Ratios to average limited partners’ capital.', s && s.desc);
    // A real fund with no call (W3): no capital in the period and no cash flows to the period end.
    const E = fundWs(NS, 'fund-a', {
      keep: () => false,
      edit: (ws) => {
        ws.calls = [];
        ws.runs = [];
        ws.investors.forEach((i) => (i.positions = i.positions.filter((p) => !p.ref)));
      }
    });
    const BE = NS.audit.build(E.ws, E.o, '2026-01-01', '2026-12-31');
    const re = rowsOf(BE, 'ratios');
    const wantE = [[EXP + NO_CAP, null], [NII + NO_CAP, null], [IRR + NO_FLOWS, null]];
    check('a real fund with no call: each Value empty and each Measure names what is missing', J(re) === J(wantE), { got: re, want: wantE });
    const csvE = schedOf(BE, 'ratios') ? NS.audit.toCsv(schedOf(BE, 'ratios')) : 'NaN';
    check('its CSV holds no NaN or Infinity, and no value', !/NaN|Infinity/.test(csvE) && csvE.split('\r\n').slice(1, 4).every((l) => /,$/.test(l)), csvE);
    // An open-ended sample fund: the period's total return in place of the IRR.
    const NS2 = load('2026-11-19');
    let open = null;
    sampleWorkspaces(NS2).some((w) => w.offerings.some((o) => NS2.audit.settings(o).open && (open = { w, o })));
    const BO = open && NS2.audit.build(open.w, open.o, '2025-01-01', '2025-12-31');
    const ro = BO && rowsOf(BO, 'ratios');
    const tr = BO && NS2.audit.openPerformance(BO.P).period;
    check(`an open-ended fund (${open && open.o.id}, fiscal 2025): the third row is '${TR}' with the period's return`, !!ro && ro.length === 3 && J(ro[2]) === J([TR, tr]) && typeof tr === 'number' && isFinite(tr) && tr !== 0, ro);
    check('its expense and net investment income ratios are finite numbers', !!ro && ro[0][0] === EXP && ro[1][0] === NII && [ro[0][1], ro[1][1]].every((v) => typeof v === 'number' && isFinite(v)), ro);
  },

  /** Fund C for 2026 (everything sold, the GP's share paid with the distribution): the hand-worked cash flows. */
  'fund-c': ({ check }) => {
    const NS = load();
    const C = fundWs(NS, 'fund-c');
    const B = NS.audit.build(C.ws, C.o, '2026-01-01', '2026-12-31');
    const got = rowsOf(B, 'cf');
    check('fund C cash flows: realized -5,000,000, proceeds 15,000,000, operating 5,000,000, financing -5,000,000, change 0 (unrealized 0 left out)', J(got) === J(FUND_C_CF), { got, want: FUND_C_CF });
    const tb = schedOf(B, 'tb');
    check("fund C's trial balance: debits equal credits and the ending balances sum to 0", !!tb && tb.total[5] === tb.total[6] && tb.total[7] === 0, tb && tb.total);
  },

  /** T6: the statements tie for funds A and C and each of the 15 sample funds, fiscal year and inception to date. */
  ties: ({ check }) => {
    const NS = load();
    ['fund-a', 'fund-c'].forEach((name) => {
      const X = fundWs(NS, name);
      NS.audit.presets(X.ws, X.o).filter((p) => p.id === 'fy' || p.id === 'itd').forEach((p) => {
        const r = ties(NS, X.ws, X.o, p.from, p.to);
        check(`${X.oid} ${p.id} (${r.P.from} to ${r.P.to}): the statements tie`, !r.bad.length, r.bad);
      });
    });
    // Each sample firm built fresh: nothing has synced its books before build (wave 5 B1).
    const NS2 = load('2026-11-19');
    let n = 0;
    const t0 = Date.now();
    sampleWorkspaces(NS2).forEach((w) => {
      const fresh = !w.books || !w.books.funds || Object.keys(w.books.funds).every((k) => !(w.books.funds[k].journal || []).length);
      check(`${w.tenant.id}: built fresh, its journal is empty before the first build`, fresh, null);
      w.offerings.forEach((o) => {
        NS2.audit.presets(w, o).filter((p) => p.id === 'fy' || p.id === 'itd').forEach((p) => {
          const r = ties(NS2, w, o, p.from, p.to);
          check(`${o.id} ${p.id} (${r.P.from} to ${r.P.to}): the statements tie`, !r.bad.length, r.bad);
        });
        n++;
      });
    });
    console.log(`  ties: ${n} sample funds, two periods each, in ${Date.now() - t0} ms`);
    check('15 sample funds were checked', n === 15, n);
  },

  /** The check's own rules: an unknown case name and an empty list each exit 1 with a FAIL line (child processes). */
  selfcheck: ({ check }) => {
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const a = run(['--case', 'no-such-case']);
    const b = run(['--case', '']);
    check('an unknown --case name exits 1 with a FAIL line', a.status === 1 && /^FAIL unknown case name: no-such-case/m.test(a.stdout) && /NEW SCHEDULES: FAIL \(cases run: 0\)/.test(a.stdout), a.stdout);
    check('an empty list exits 1 with a FAIL line', b.status === 1 && /^FAIL no cases to run/m.test(b.stdout) && /NEW SCHEDULES: FAIL \(cases run: 0\)/.test(b.stdout), b.stdout);
  }
};

L.runParts(cases, { name: 'NEW SCHEDULES', unit: 'cases', flag: '--case' });
