// gate: node
// last "NEW SCHEDULES: PASS (cases run: 1)"
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
const { loadPortal } = require('./load11.js');

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
  }
};

L.runParts(cases, { name: 'NEW SCHEDULES', unit: 'cases', flag: '--case' });
