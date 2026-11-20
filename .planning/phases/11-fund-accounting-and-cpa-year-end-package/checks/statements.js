// gate: node
// last "STATEMENTS: PASS (cases run: 8)"
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
const { loadPortal, sampleWorkspaces } = require('./load11.js');

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

/** The probe firm (plan 11-07's; 11-RESEARCH.md defect 1) with one more record: $4,000.00 paid by check on 2025-12-15. */
function probeWs() {
  const pos = (amount) => [{ offeringId: 'probe-re', amount, date: '2025-02-03' }];
  const inv = (id, amount) => ({ id, contact: id, title: id, type: 'individual', email: id.toLowerCase() + '@example.com', taxForm: 'W-9', onboarding: { status: 'complete', step: 0, invited: '2025-02-01', completed: '2025-02-01', source: 'manual' }, payment: { method: 'check', bank: null }, positions: pos(amount) });
  return {
    v: 2,
    tenant: { id: 'probe-sponsor', sample: false, name: 'Probe Sponsor', shortName: 'Probe', legalName: 'Probe Sponsor, LLC' },
    offerings: [{ id: 'probe-re', name: 'Probe Real Estate Fund, L.P.', shortName: 'Probe RE', type: 'Real estate fund', status: 'Active', closeDate: '2025-02-03', exit: { basis: 'date', date: '2032-02-03', from: '', to: '', note: '' }, distribution: { frequency: 'Quarterly', type: 'Income', target: '' }, terms: [] }],
    investors: [inv('PR-1', 100000), inv('PR-2', 300000)],
    calls: [],
    runs: [
      {
        id: 'pr-run-1',
        offeringId: 'probe-re',
        date: '2025-12-15',
        type: 'Income',
        total: 400000, // $4,000.00 split by amount invested 100,000 : 300,000
        status: 'paid',
        source: 'recorded',
        lines: [
          { investorId: 'PR-1', grossCents: 100000, withheld: [], netCents: 100000 },
          { investorId: 'PR-2', grossCents: 300000, withheld: [], netCents: 300000 }
        ],
        linesBasis: 'recorded',
        linesAt: '2025-12-15T15:00:00.000Z',
        linesBy: 'Probe Sponsor'
      }
    ],
    notices: [],
    audit: [],
    requests: [],
    docs: []
  };
}
const activityOf = (B, runId) => (rowsOf(B, 'activity') || []).filter((r) => r[6] === runId).map((r) => ({ inv: r[1], method: r[7], ref: r[8] }));
const booksItems = (B) => {
  const c = checkOf(B, 'books');
  return c ? { status: c.status, items: JSON.parse(JSON.stringify(c.items)) } : null;
};
const statementText = (name) => fs.readFileSync(path.join(BANK, name), 'utf8');
/**
 * Fund A through plan 11-08's flow (11-CONTEXT B1): the fixture's mark: entries posted, the records synced, account
 * Operating (ending 6789) added, fund-a.ofx imported, autoMatch run and the six lines without a candidate decided as the
 * fixture's bank: entries are; `skip` leaves those decisions (indexes into the stored lines) undecided.
 */
function fundAThroughBank(NS, skip) {
  const F = fixture('fund-a');
  const ws = F.records;
  ws.investors.forEach((i) => i.onboarding || (i.onboarding = { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05', source: 'manual' }));
  const oid = F.expect.offeringId;
  const o = ws.offerings.find((x) => x.id === oid);
  const BB = NS.books.bank;
  F.entries.filter((e) => e.src.indexOf('mark:') === 0).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  NS.books.sync(ws, { today: TODAY });
  const acct = BB.addAccount(ws, oid, { name: 'Operating', last4: '6789' });
  const text = statementText('fund-a.ofx');
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
  ]
    .filter(([i]) => (skip || []).indexOf(i) < 0)
    .forEach(([i, d]) => BB.categorize(ws, oid, lines[i].id, d, ACTOR));
  return { F, ws, oid, o, BB, acct };
}

const cases = {
  /** Task 1 (tracer): fund A's Audit statements for 2026 come from its journal and are the research's to the cent. */
  'fund-a': ({ check }) => {
    fundAStatements(check, load());
  },

  /** Fund C for 2026 (the GP's share paid with a distribution): realized 5,000,000, everything sold, A&L all zero. */
  'fund-c': ({ check }) => {
    const NS = load();
    const C = fundWs(NS, 'fund-c');
    const B = NS.audit.build(C.ws, C.o, '2026-01-01', '2026-12-31');
    const wantOps = [
      ['Total investment income', 0],
      ['Total expenses', 0],
      ['Net investment income (loss)', 0],
      ['Net realized gain (loss) on investments', 5000000],
      ['Net change in unrealized appreciation (depreciation) on investments', 0],
      ['Net increase (decrease) in net assets from operations', 5000000],
      ['Change in carried interest allocated to the general partner', -1000000],
      ['Net increase (decrease) in limited partners’ capital from operations', 4000000]
    ];
    const ops = rowsOf(B, 'ops');
    check('statement of operations for 2026: realized 5,000,000, unrealized 0, net increase 5,000,000 (carry 1,000,000 to the general partner)', J(ops) === J(wantOps), { got: ops, want: wantOps });
    const wantAl = [
      ['Investments, at fair value', 0],
      ['Cash and cash equivalents', 0],
      ['Total assets', 0],
      ['Management fees payable', 0],
      ['Total liabilities', 0],
      ['Net assets (partners’ capital)', 0],
      ['  Limited partners', 0],
      ['  General partner (carried interest accrued)', 0]
    ];
    const al = rowsOf(B, 'al');
    check('statement of assets and liabilities at 2026-12-31: every line 0', J(al) === J(wantAl), { got: al, want: wantAl });
    const chg = rowsOf(B, 'chg') || [];
    const dist = chg.find((r) => r[0] === 'Distributions');
    const realloc = chg.find((r) => r[0] === 'Carried interest reallocation');
    check('changes in partners’ capital: general partner distributions -1,000,000 and carried interest reallocation +1,000,000', !!dist && dist[2] === -1000000 && !!realloc && realloc[2] === 1000000, { dist, realloc });
    check('the schedule of investments has no rows (Y was sold)', (rowsOf(B, 'soi') || [1]).length === 0, rowsOf(B, 'soi'));
    check("the 'roll' check passes", (checkOf(B, 'roll') || {}).status === 'pass', checkOf(B, 'roll'));
    check("the 'nav' check passes (capital agrees to the journal's balance sheet)", (checkOf(B, 'nav') || {}).status === 'pass', checkOf(B, 'nav'));
  },

  /** The probe firm, fiscal 2025: only what was recorded (two contributions and a $4,000.00 distribution by check). */
  probe: ({ check }) => {
    const NS = load();
    const ws = probeWs();
    const o = ws.offerings[0];
    const B = NS.audit.build(ws, o, '2025-01-01', '2025-12-31');
    const wantAl = [
      ['Investments, at fair value', 0],
      ['Cash and cash equivalents', 39600000],
      ['Total assets', 39600000],
      ['Management fees payable', 0],
      ['Total liabilities', 0],
      ['Net assets (partners’ capital)', 39600000],
      ['  Limited partners', 39600000],
      ['  General partner (carried interest accrued)', 0]
    ];
    const al = rowsOf(B, 'al');
    check('fiscal 2025 A&L: cash 39,600,000 (40,000,000 - 400,000), investments 0, net assets 39,600,000', J(al) === J(wantAl), { got: al, want: wantAl });
    const wantOps = [
      ['Total investment income', 0],
      ['Total expenses', 0],
      ['Net investment income (loss)', 0],
      ['Net realized gain (loss) on investments', 0],
      ['Net change in unrealized appreciation (depreciation) on investments', 0],
      ['Net increase (decrease) in net assets from operations', 0],
      ['Change in carried interest allocated to the general partner', 0],
      ['Net increase (decrease) in limited partners’ capital from operations', 0]
    ];
    const ops = rowsOf(B, 'ops');
    check('statement of operations: no income or expense row, net increase 0', J(ops) === J(wantOps), { got: ops, want: wantOps });
    check('the schedule of investments has no rows', (rowsOf(B, 'soi') || [1]).length === 0, rowsOf(B, 'soi'));
    const acts = activityOf(B, 'pr-run-1');
    check("each distribution row's method is 'Check' and its bank reference is exactly 'Check' (no number)", acts.length === 2 && acts.every((a) => a.method === 'Check' && a.ref === 'Check'), acts);
    const bk = booksItems(B);
    check("the 'books' check lists exactly 'No bank account added.' and 'Management fee terms not set.'", !!bk && bk.status === 'exception' && J(bk.items) === J(['No bank account added.', 'Management fee terms not set.']), bk);
    check("the 'nav' check passes", (checkOf(B, 'nav') || {}).status === 'pass', checkOf(B, 'nav'));
    const H = B.P.hold;
    const ni = (ops || []).find((r) => r[0] === 'Net increase (decrease) in net assets from operations');
    console.log(`  probe after (this tree), fiscal 2025: investments ${H.longFV}, cash ${H.cash}, fee payable ${H.feePayable}, net assets ${H.totalAssets - H.totalLiabilities}, net increase ${ni ? ni[1] : ''}; bank references ${J(acts.map((a) => a.ref))}`);
  },

  /** Bank references are never invented: ACH rows carry the file name or 'No file', check rows exactly 'Check'. */
  refs: ({ check }) => {
    const NS = load();
    const A = fundWs(NS, 'fund-a', {
      edit: (ws) => {
        ws.runs[0].source = 'console';
        ws.runs[0].file = 'FUND_A_LP_20261215_A.ach';
        ws.runs.push({ id: 'fa-run-2', offeringId: 'fund-a', date: '2026-12-20', type: 'Realization proceeds', total: 300000, status: 'paid', source: 'recorded', lines: [{ investorId: 'FA-1001', grossCents: 200000, withheld: [], netCents: 200000 }, { investorId: 'FA-1002', grossCents: 100000, withheld: [], netCents: 100000 }], linesBasis: 'recorded', linesAt: '2026-12-20T15:00:00.000Z', linesBy: 'Fund A Sponsor' });
      }
    });
    const B = NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31');
    const r1 = activityOf(B, 'fa-run-1');
    const r2 = activityOf(B, 'fa-run-2');
    const want1 = [{ inv: 'FA-1001', method: 'ACH', ref: 'FUND_A_LP_20261215_A.ach' }, { inv: 'FA-1002', method: 'Check', ref: 'Check' }];
    const want2 = [{ inv: 'FA-1001', method: 'ACH', ref: 'No file' }, { inv: 'FA-1002', method: 'Check', ref: 'Check' }];
    check("fa-run-1 (a console run with its file): FA-1001 'ACH' with the file name, FA-1002 'Check' with 'Check'", J(r1) === J(want1), { got: r1, want: want1 });
    check("fa-run-2 (not a console run, no file): FA-1001 'ACH' with 'No file', FA-1002 'Check' with 'Check'", J(r2) === J(want2), { got: r2, want: want2 });
    const b2 = (rowsOf(B, 'bank') || []).find((r) => r[1] === 'fa-run-2');
    check("schedule 07: fa-run-2 has no invented file name ('Missing')", !!b2 && b2[10] === 'Missing', b2);
  },

  /** Schedule 07 shows what was paid: fund A with $800.00 withheld from FA-1002 (plan 11-05's example). */
  net: ({ check }) => {
    const NS = load();
    const A = fundWs(NS, 'fund-a', {
      edit: (ws) => {
        const l = ws.runs[0].lines.find((x) => x.investorId === 'FA-1002');
        l.withheld = [{ kind: 'backup', cents: 80000, basisCents: 300000, ratePct: null, source: 'entered', why: 'No taxpayer number on file', confirmedBy: 'Check Runner', confirmedAt: '2026-12-15T15:00:00.000Z' }];
        l.netCents = 220000;
      }
    });
    const B = NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31');
    const row = (rowsOf(B, 'bank') || []).find((r) => r[1] === 'fa-run-1');
    const want = ['2026-12-15', 'fa-run-1', 'Realization proceeds', 900000, 900000, 0, 1, 600000, 1, 220000, 'Missing', 'Exception: no bank file'];
    check("schedule 07's row for fa-run-1: total 900,000, allocated 900,000, ACH 1 entry 600,000, checks 1 for 220,000", J(row) === J(want), { got: row, want });
    const wantAl = [
      ['Investments, at fair value (cost $400,000.00)', 49000000],
      ['Cash and cash equivalents', 3280000],
      ['Total assets', 52280000],
      ['Management fees payable', 450000],
      ['Tax withheld, payable', 80000],
      ['Total liabilities', 530000],
      ['Net assets (partners’ capital)', 51750000],
      ['  Limited partners', 51750000],
      ['  General partner (carried interest accrued)', 0]
    ];
    const al = rowsOf(B, 'al');
    check('the A&L shows the tax withheld owed (80,000) and cash 3,280,000; net assets still 51,750,000', J(al) === J(wantAl), { got: al, want: wantAl });
    check("the 'nav' check passes", (checkOf(B, 'nav') || {}).status === 'pass', checkOf(B, 'nav'));
  },

  /** The 'books' readiness check: one line per missing input, in order; none for a sample fund. */
  missing: ({ check }) => {
    const NS = load();
    const END = 'December 31, 2026';
    // Fund A before any bank import (its bank and value entries posted directly).
    const A = fundWs(NS, 'fund-a');
    const a = booksItems(NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31'));
    check("fund A before any bank import: exactly 'No bank account added.' (fa-x has a value in 2026; fee terms are set)", !!a && a.status === 'exception' && J(a.items) === J(['No bank account added.']), a);
    // After plan 11-08's flow and the reconciliation at 2026-12-31.
    const R = fundAThroughBank(NS);
    R.BB.markReconciled(R.ws, R.oid, R.acct.id, '2026-12-31', 3500000, ACTOR);
    const r = booksItems(NS.audit.build(R.ws, R.o, '2026-01-01', '2026-12-31'));
    check("after the import, the six decisions and markReconciled at 2026-12-31 the 'books' check passes", !!r && r.status === 'pass' && r.items.length === 0, r);
    // One line left undecided, not reconciled, and a second account with no last four digits (W4).
    const U = fundAThroughBank(NS, [7]);
    U.BB.addAccount(U.ws, U.oid, { name: 'Reserve' });
    const u = booksItems(NS.audit.build(U.ws, U.o, '2026-01-01', '2026-12-31'));
    const wantU = [`Operating ending 6789: not reconciled through ${END}.`, `Reserve: not reconciled through ${END}.`, '1 bank lines not yet decided.'];
    check("one line undecided: the not-reconciled line for each account (no 'ending' without last four digits) and '1 bank lines not yet decided.'", !!u && u.status === 'exception' && J(u.items) === J(wantU), { got: u, want: wantU });
    // No value in the period, fee terms not set, and a record changed inside a closed period.
    const V = fundWs(NS, 'fund-a', { keep: (e) => e.src.indexOf('mark:') !== 0, edit: (ws) => (ws.offerings[0].accounting.mgmtFee = '') });
    NS.audit.build(V.ws, V.o, '2026-01-01', '2026-12-31');
    NS.books.close(V.ws, V.oid, '2026-06-30', ACTOR);
    V.ws.calls[0].items[1].received = '2026-01-16';
    const v = booksItems(NS.audit.build(V.ws, V.o, '2026-01-01', '2026-12-31'));
    const wantV = ['No bank account added.', 'Portfolio Co X: no value in this period; shown at cost.', 'Management fee terms not set.', '1 changes to records inside a closed period are not applied.'];
    check('no value in 2026, fee terms unset and a change inside the closed period: one line each, in order', !!v && J(v.items) === J(wantV), { got: v, want: wantV });
    // Records the books could not take as recorded are named; a stray line (the 'bank' check's) is not counted here.
    V.ws.books.funds[V.oid].exceptions.push({ src: 'run:x', kind: 'amount', account: '3100', value: 1.5 }, { src: 'run:y', kind: 'stray', investorId: 'Z-1', cents: 100 });
    const w = booksItems(NS.audit.build(V.ws, V.o, '2026-01-01', '2026-12-31'));
    check("a record that could not be posted as recorded is its own line ('1 records could not be posted to the books as recorded.')", !!w && J(w.items) === J(wantV.concat(['1 records could not be posted to the books as recorded.'])), w);
    // Bringing the books up to date failed: said first, never hidden.
    const X = fundWs(NS, 'fund-a');
    const sync = NS.books.sync;
    NS.books.sync = () => {
      throw new Error('Stand-in failure.');
    };
    let x;
    try {
      x = booksItems(NS.audit.build(X.ws, X.o, '2026-01-01', '2026-12-31'));
    } finally {
      NS.books.sync = sync;
    }
    check("when the books cannot be brought up to date the 'books' check says so first", !!x && x.items[0] === 'The books could not be brought up to date (Stand-in failure).', x);
    // A sample fund: no 'books' check, and build leaves its books alone (W5).
    const sw = sampleWorkspaces(NS)[0];
    const so = sw.offerings[0];
    const before = J(sw.books || null);
    const sb = NS.audit.build(sw, so, '2026-01-01', '2026-12-31');
    check(`a sample fund (${so.id}) has no 'books' check and build does not touch its books`, NS.audit.generated(so) && !checkOf(sb, 'books') && J(sw.books || null) === before, { books: !!checkOf(sb, 'books'), same: J(sw.books || null) === before });
  },

  /** The managed edition's real firms get the same figures: fund A's case with the managed edition loaded. */
  managed: ({ check }) => {
    const NS = load('managed');
    check('the managed edition is loaded', NS.EDITION.id === 'managed', NS.EDITION.id);
    fundAStatements(check, NS, 'managed');
  },

  /** The check's own rules: an unknown case name and an empty list each exit 1 with a FAIL line (child processes). */
  selfcheck: ({ check }) => {
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const a = run(['--case', 'no-such-case']);
    const b = run(['--case', '']);
    check('an unknown --case name exits 1 with a FAIL line', a.status === 1 && /^FAIL unknown case name: no-such-case/m.test(a.stdout) && /STATEMENTS: FAIL \(cases run: 0\)/.test(a.stdout), a.stdout);
    check('an empty list exits 1 with a FAIL line', b.status === 1 && /^FAIL no cases to run/m.test(b.stdout) && /STATEMENTS: FAIL \(cases run: 0\)/.test(b.stdout), b.stdout);
  }
};

L.runParts(cases, { name: 'STATEMENTS', unit: 'cases', flag: '--case' });
