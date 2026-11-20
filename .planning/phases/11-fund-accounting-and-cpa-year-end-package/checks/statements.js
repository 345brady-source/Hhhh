// gate: node
// last "STATEMENTS: PASS (cases run: 1)"
// Real funds' statements from the journal (plan 11-11, no browser): for a fund that is not a sample fund the Audit page's
// statement of assets and liabilities, statement of operations and schedule of investments take every figure from the
// books (NS.audit.build brings the books up to date first), bank references are never invented, the bank evidence shows
// what was paid net of tax withheld, and the 'books' readiness check names each missing input on its own line. The
// portal is loaded inside each case with load11.js (the scripts diy.html lists, then books.js, books-post.js,
// bankfiles.js and books-bank.js), today 2027-01-20. Funds A and C come from fixtures/fund-a.js and fund-c.js; every
// expected figure below is the plan's hand-worked one (11-11-PLAN.md), whole cents.
//   node statements.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "STATEMENTS: PASS (cases run: N)" or
// "STATEMENTS: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal } = require('./load11.js');

const TODAY = '2027-01-20';
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
const BANK = path.join(__dirname, 'fixtures', 'bank');
const J = (x) => JSON.stringify(x);

/** The portal with the journal, posting, the statement reader and bank reconciliation, inside the case. */
function load(edition) {
  const NS = loadPortal(undefined, { today: TODAY, edition: edition || 'diy', extra: ['books.js', 'books-post.js', 'bankfiles.js', 'books-bank.js'] });
  if (!NS.books || typeof NS.books.sync !== 'function') throw new Error('books.js and books-post.js did not load');
  return NS;
}
const fixture = (name) => JSON.parse(JSON.stringify(require('./fixtures/' + name + '.js')));
/** The schedule's rows (labels and cents) as plain arrays. */
const rowsOf = (B, id) => {
  const s = B.list.find((x) => x.id === id);
  return s ? JSON.parse(JSON.stringify(s.rows)) : null;
};
const schedOf = (B, id) => B.list.find((x) => x.id === id) || null;
const checkOf = (B, id) => B.chk.find((c) => c.id === id) || null;

/**
 * A fixture's records with its other entries posted directly (all, or those `keep` allows). The records themselves are
 * not synced here: NS.audit.build must bring the books up to date before it builds the period.
 */
function fundWs(NS, name, opts) {
  opts = opts || {};
  const F = fixture(name);
  const ws = F.records;
  const oid = F.expect.offeringId;
  // Every path that adds an investor stores an onboarding record (console.js, invitations.js); the fixtures leave it out.
  ws.investors.forEach((i) => i.onboarding || (i.onboarding = { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05', source: 'manual' }));
  if (opts.edit) opts.edit(ws, F);
  F.entries.filter((e) => !opts.keep || opts.keep(e)).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  const o = ws.offerings.find((x) => x.id === oid);
  return { F, ws, oid, o };
}

/* ---------- Hand-worked figures (11-11-PLAN.md) ---------- */
const FUND_A_AL = [
  ['Investments, at fair value (cost $400,000.00)', 49000000],
  ['Cash and cash equivalents', 3200000],
  ['Total assets', 52200000],
  ['Management fees payable', 450000],
  ['Total liabilities', 450000],
  ['Net assets (partners’ capital)', 51750000],
  ['  Limited partners', 51750000],
  ['  General partner (carried interest accrued)', 0]
];
const FUND_A_OPS = [
  ['Dividend income', 1200000],
  ['Total investment income', 1200000],
  ['Management fees', -1800000],
  ['Professional fees', -750000],
  ['Total expenses', -2550000],
  ['Net investment income (loss)', -1350000],
  ['Net realized gain (loss) on investments', 0],
  ['Net change in unrealized appreciation (depreciation) on investments', 9000000],
  ['Net increase (decrease) in net assets from operations', 7650000],
  ['Change in carried interest allocated to the general partner', 0],
  ['Net increase (decrease) in limited partners’ capital from operations', 7650000]
];

/** Fund A's three statements for 2026 against the hand-worked figures, and the two ties. */
function fundAStatements(check, NS, tag) {
  const pre = tag ? tag + ': ' : '';
  const A = fundWs(NS, 'fund-a');
  const B = NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31');
  const synced = !!NS.books.live(A.ws.books.funds[A.oid], 'call:fa-call-1:FA-1001') && !!NS.books.live(A.ws.books.funds[A.oid], 'run:fa-run-1');
  check(pre + 'build brought the books up to date first (the call and distribution entries are in the journal)', synced, A.ws.books.funds[A.oid].journal.map((e) => e.src));
  const al = rowsOf(B, 'al');
  check(pre + "statement of assets and liabilities at 2026-12-31 is the research's, label by label, to the cent", J(al) === J(FUND_A_AL), { got: al, want: FUND_A_AL });
  const ops = rowsOf(B, 'ops');
  check(pre + "statement of operations for 2026 is the research's, label by label, to the cent", J(ops) === J(FUND_A_OPS), { got: ops, want: FUND_A_OPS });
  const soi = schedOf(B, 'soi');
  const r = soi && soi.rows.length === 1 ? soi.rows[0] : null;
  const h = B.P.hold.rows[0];
  const pct = r ? (r[7] * 100).toFixed(4) : '';
  check(
    pre + 'schedule of investments: one row, fa-x (Portfolio Co X), cost 40,000,000, fair value 49,000,000, 94.6860% of net assets, Level 3',
    !!r && h && h.h && h.h.id === 'fa-x' && r[1] === 'Portfolio Co X' && r[5] === 40000000 && r[6] === 49000000 && pct === '94.6860' && r[8] === 'Level 3',
    soi && { rows: soi.rows, holding: h && h.h && h.h.id }
  );
  check(pre + 'schedule of investments total: cost 40,000,000, fair value 49,000,000', !!soi && soi.total && soi.total[5] === 40000000 && soi.total[6] === 49000000, soi && soi.total);
  check(pre + "the 'nav' tie (partners' capital agrees to net assets) passes", (checkOf(B, 'nav') || {}).status === 'pass', checkOf(B, 'nav'));
  check(pre + "the 'soi' tie (schedule of investments agrees to the balance sheet) passes", (checkOf(B, 'soi') || {}).status === 'pass', checkOf(B, 'soi'));
  return { A, B };
}

const cases = {
  /** Task 1 (tracer): fund A's Audit statements for 2026 come from its journal and are the research's to the cent. */
  'fund-a': ({ check }) => {
    fundAStatements(check, load());
  }
};

L.runParts(cases, { name: 'STATEMENTS', unit: 'cases', flag: '--case' });
