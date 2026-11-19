// gate: node
// last "BOOKS CORE: PASS (cases run: 1)"
// Pure checks for the fund journal (plan 11-01, no browser): assets/js/books.js in a fresh sandbox per case, the way the
// browser loads it (window.CVPortal). The smallest set of scripts that loads it: assets/js/tenants.js (NS.OFFERING_TYPES,
// for the chart's fund type), assets/js/data.js (NS.dates), assets/js/audit.js (NS.audit.sha256), then assets/js/books.js;
// the sandbox is given TextEncoder (audit.js's sha256 needs it) and NS.dates.today is fixed to 2027-01-20.
// Every expected figure of hand-worked fund A is read from fixtures/fund-a.js, never typed here.
//   node books-core.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "BOOKS CORE: PASS (cases run: N)" or
// "BOOKS CORE: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const SRC = (f) => fs.readFileSync(path.join(L.ROOT, f), 'utf8');
const FILES = ['assets/js/tenants.js', 'assets/js/data.js', 'assets/js/audit.js', 'assets/js/books.js'];
const TODAY = '2027-01-20';
/** A fresh sandbox with the four scripts. Called inside each case, so a missing or broken module prints a FAIL line. */
function load() {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window, TextEncoder });
  FILES.forEach((f) => {
    vm.runInContext(SRC(f), ctx, { filename: f });
    if (f === 'assets/js/data.js') window.CVPortal.dates.today = () => TODAY;
  });
  if (!window.CVPortal.books) throw new Error('assets/js/books.js did not set NS.books');
  return window.CVPortal;
}
/** A fresh copy of the fixture (the require cache is not shared between cases' workspaces). */
function fixture() {
  return JSON.parse(JSON.stringify(require('./fixtures/fund-a.js')));
}
const J = (x) => JSON.stringify(x);
const sum = (a) => a.reduce((s, x) => s + x, 0);
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };

/** Fund A's workspace with every record entry and every other entry posted. */
function fundA(NS) {
  const F = fixture();
  const ws = F.records;
  const oid = F.expect.offeringId;
  F.recordEntries.concat(F.entries).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  return { F, ws, oid };
}
/** Totals by type of a trial balance's ends, in the signs a reader uses (each positive when normal). */
function byType(rows) {
  const t = { asset: 0, liability: 0, equity: 0, income: 0, expense: 0, gain: 0, other: 0 };
  rows.forEach((r) => (t[r.type] !== undefined ? (t[r.type] += r.end) : (t.other += r.end)));
  return { assets: t.asset, liabilities: -t.liability, equity: -t.equity, income: -t.income, expenses: t.expense, gains: -t.gain, other: t.other };
}

const cases = {
  /** Hand-worked fund A gives the research's trial balance to the cent (T1, T2, T10). */
  'fund-a': ({ check }) => {
    const NS = load();
    const { F, ws, oid } = fundA(NS);
    const X = F.expect;
    // The fixture's own arithmetic, before anything is compared with the journal.
    check('fixture: the expected trial balance sums to 0', sum(X.tb.map((r) => r.end)) === 0, sum(X.tb.map((r) => r.end)));
    check('fixture: its debits and credits are the stated totals', sum(X.tb.filter((r) => r.end > 0).map((r) => r.end)) === X.tbDebits && -sum(X.tb.filter((r) => r.end < 0).map((r) => r.end)) === X.tbCredits && X.tbDebits === X.tbCredits);
    check('fixture: every amount is an integer number of cents', F.recordEntries.concat(F.entries).every((e) => e.lines.every((l) => Number.isSafeInteger(l[1]))));
    check('fixture: every entry it gives sums to 0', F.recordEntries.concat(F.entries).every((e) => sum(e.lines.map((l) => l[1])) === 0));
    check('fixture: the month-end capital adds up to the stated sum and average', sum(X.lpCapital) === X.lpCapitalSum && X.lpCapitalSum / 12 === X.lpCapitalAverage && X.lpCapital.length === 12);

    const fund = ws.books.funds[oid];
    check('every entry is stored (2 calls + 12 fees + 1 distribution + 8 others = 23)', fund.journal.length === F.recordEntries.length + F.entries.length && fund.journal.length === 23, fund.journal.length);
    check('every stored entry sums to 0 and holds only integer cents (T1)', fund.journal.every((e) => sum(e.lines.map((l) => l[1])) === 0 && e.lines.every((l) => Number.isSafeInteger(l[1]))));

    const tb = NS.books.trialBalance(ws, oid, '2026-01-01', '2026-12-31');
    check('the trial balance at 2026-12-31 has exactly the ten rows of expect.tb, in code order', J(tb.map((r) => r.code)) === J(X.tb.map((r) => r.code)), tb.map((r) => r.code));
    check('every row ends at the fixture figure, to the cent', J(tb.map((r) => [r.code, r.end])) === J(X.tb.map((r) => [r.code, r.end])), tb.map((r) => [r.code, r.end]));
    const deb = sum(tb.filter((r) => r.end > 0).map((r) => r.end));
    const cre = -sum(tb.filter((r) => r.end < 0).map((r) => r.end));
    check('debits total = credits total = expect.tbDebits (55,650,000)', deb === X.tbDebits && cre === X.tbCredits && deb === cre, { deb, cre });
    check('every row: end = begin + debits - credits, all integers, debits and credits not negative', tb.every((r) => r.end === r.begin + r.debits - r.credits && [r.begin, r.debits, r.credits, r.end].every(Number.isSafeInteger) && r.debits >= 0 && r.credits >= 0));
    check('the rows carry name, type and Schedule L line from the chart', tb.every((r) => r.name && r.type) && tb.find((r) => r.code === '1000').line === '1' && tb.find((r) => r.code === '4010').line === '');

    const eq = byType(tb);
    check('accounting equation at 2026-12-31 equals the fixture (assets, liabilities, equity, results)', eq.assets === X.equation.assets && eq.liabilities === X.equation.liabilities && eq.equity === X.equation.equity && eq.income - eq.expenses + eq.gains === X.equation.results && eq.assets - eq.liabilities === X.equation.netAssets, eq);

    const bad = [];
    X.monthEnds.forEach((d, i) => {
      const rows = NS.books.trialBalance(ws, oid, '2026-01-01', d);
      const t = byType(rows);
      const s = sum(rows.map((r) => r.end));
      const left = t.assets - t.liabilities;
      const right = t.equity + t.income - t.expenses + t.gains;
      if (s !== 0 || left !== right || t.other !== 0 || left !== X.lpCapital[i]) bad.push({ d, sum: s, left, right, want: X.lpCapital[i] });
    });
    check('at each of the twelve month-ends the trial balance sums to 0 (T1)', !bad.some((b) => b.sum !== 0), bad);
    check('at each of the twelve month-ends assets - liabilities = equity + income - expenses + gains (T2)', !bad.some((b) => b.left !== b.right), bad);
    check("at each month-end net assets equal the fixture's limited partners' capital", bad.length === 0, bad);
    check('balance(1000, 2026-12-31) is the cash of the fixture', NS.books.balance(ws, oid, '1000', '2026-12-31') === X.statements.cash);
  }
};

L.runParts(cases, { name: 'BOOKS CORE', unit: 'cases', flag: '--case' });
