// gate: node
// last "BANK REC: PASS (cases run: 1)"
// Bank reconciliation in the books (plan 11-08, no browser): statement lines stored per bank account once, matched to
// cash lines already posted, decided once by account when unmatched (which posts the entry), and reconciled to a
// statement date with a difference of zero (assets/js/books-bank.js: NS.books.bank). The portal is loaded inside each
// case with load11.js (the scripts diy.html lists, then books.js, books-post.js, bankfiles.js and books-bank.js), today
// 2027-01-20. Statements are read from fixtures/bank/ with NS.bankFiles.parse; fund A comes from fixtures/fund-a.js.
//   node bank-rec.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "BANK REC: PASS (cases run: N)" or
// "BANK REC: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal } = require('./load11.js');

const TODAY = '2027-01-20';
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
const BANK = path.join(__dirname, 'fixtures', 'bank');
const J = (x) => JSON.stringify(x);

/** The portal with the journal, posting, the statement reader and bank reconciliation, inside the case. */
function load() {
  const NS = loadPortal(undefined, { today: TODAY, extra: ['books.js', 'books-post.js', 'bankfiles.js', 'books-bank.js'] });
  if (!NS.books || !NS.books.bank || typeof NS.books.bank.importLines !== 'function') throw new Error('assets/js/books-bank.js did not add NS.books.bank');
  if (!NS.bankFiles || typeof NS.bankFiles.parse !== 'function') throw new Error('assets/js/bankfiles.js did not add NS.bankFiles.parse');
  return NS;
}
const fixture = () => JSON.parse(JSON.stringify(require('./fixtures/fund-a.js')));
const expectBank = () => JSON.parse(fs.readFileSync(path.join(BANK, 'expect.json'), 'utf8'));
const readBank = (name) => fs.readFileSync(path.join(BANK, name), 'utf8');
/** A statement file read with NS.bankFiles.parse, and the import options for it. */
function statement(NS, name, extra) {
  const text = readBank(name);
  return { parsed: NS.bankFiles.parse(text), opts: Object.assign({ name, sha256: NS.audit.sha256(text), fileId: 'file-' + name, by: ACTOR.by, at: ACTOR.at }, extra || {}) };
}
const fundOf = (ws, oid) => ws.books.funds[oid];
const linesOf = (ws, oid) => fundOf(ws, oid).bank.lines;
const entryById = (ws, oid, id) => fundOf(ws, oid).journal.find((e) => e.id === id) || null;
const liveSrc = (NS, ws, oid, src) => NS.books.live(fundOf(ws, oid), src);
/** The non-zero rows of the trial balance through a day, as { code, end }. */
const tbAt = (NS, ws, oid, to) =>
  NS.books
    .trialBalance(ws, oid, '', to)
    .filter((r) => r.end !== 0)
    .map((r) => ({ code: r.code, end: r.end }));

/**
 * Fund A as the hand-worked reconciliation leaves it (11-CONTEXT B1): the fixture's mark: entries posted directly, the
 * records synced, account ba-1 added, fund-a.ofx imported, autoMatch run, and the six lines without a candidate decided
 * as the fixture's bank: entries are (those entries themselves are never posted). Returns everything a case needs.
 */
function fundA(NS) {
  const F = fixture();
  const ws = F.records;
  const oid = F.expect.offeringId;
  const B = NS.books.bank;
  F.entries.filter((e) => e.src.indexOf('mark:') === 0).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  const synced = NS.books.sync(ws, { today: TODAY });
  const acct = B.addAccount(ws, oid, { name: 'Operating', last4: '6789' });
  const st = statement(NS, 'fund-a.ofx');
  const imported = B.importLines(ws, oid, acct.id, st.parsed, st.opts);
  const auto = B.autoMatch(ws, oid, acct.id);
  const L0 = linesOf(ws, oid).slice();
  // line 3 a purchase of fa-x; line 4 professional fees; lines 5, 7, 8 management fees paid; line 6 a dividend
  const decisions = [
    [2, { kind: 'purchase', holding: 'fa-x' }],
    [3, { kind: 'account', account: '5100' }],
    [4, { kind: 'account', account: '2100' }],
    [5, { kind: 'account', account: '4010' }],
    [6, { kind: 'account', account: '2100' }],
    [7, { kind: 'account', account: '2100' }]
  ];
  const decided = decisions.map(([i, d]) => ({ i, entry: B.categorize(ws, oid, L0[i].id, d, ACTOR) }));
  return { F, ws, oid, B, acct, st, synced, imported, auto, decided, lines: () => linesOf(ws, oid) };
}

const cases = {
  'fund-a': ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const { F, ws, oid, B, acct } = A;
    const X = expectBank();
    check('the first bank account is ba-1 on cash account 1000', acct.id === 'ba-1' && acct.code === '1000' && acct.last4 === '6789' && fundOf(ws, oid).bank.accounts.length === 1, acct);
    check('importing fund-a.ofx adds 9 lines, skips none, finds no overlap', J(A.imported) === J({ added: 9, skipped: 0, overlap: 0 }), A.imported);
    const imps = fundOf(ws, oid).bank.imports;
    check(
      'one import record names the file, its SHA-256, its dates, 9 added, the stored bytes and who',
      imps.length === 1 && imps[0].account === 'ba-1' && imps[0].name === 'fund-a.ofx' && imps[0].sha256 === A.st.opts.sha256 && imps[0].from === X.from && imps[0].to === X.to && imps[0].added === 9 && imps[0].fileId === 'file-fund-a.ofx' && imps[0].by === ACTOR.by && imps[0].at === ACTOR.at,
      imps
    );
    const lines = A.lines();
    check(
      'the 9 stored lines are expect.json\'s dates, amounts and texts, on ba-1',
      lines.length === 9 && lines.every((l, i) => l.account === 'ba-1' && l.date === X.lines[i].date && l.cents === X.lines[i].cents && l.text === X.lines[i].text && l.imp === imps[0].id),
      lines.map((l) => [l.date, l.cents, l.text])
    );
    check('autoMatch matches 3 lines', A.auto === 3, A.auto);
    const callA = liveSrc(NS, ws, oid, 'call:fa-call-1:FA-1001');
    const callB = liveSrc(NS, ws, oid, 'call:fa-call-1:FA-1002');
    const run = liveSrc(NS, ws, oid, 'run:fa-run-1');
    const at = (e, code, cents) => (e ? e.lines.findIndex((l) => l[0] === code && l[1] === cents) : -1);
    const want = [
      { entry: callA && callA.id, line: at(callA, '1000', 30000000) },
      { entry: callB && callB.id, line: at(callB, '1000', 15000000) },
      { entry: run && run.id, line: at(run, '1000', -600000) }
    ];
    check(
      'the two calls and the ACH file are the matched lines, each to its cash line, and nothing was posted for them',
      J([lines[0].match, lines[1].match, lines[8].match]) === J(want) && want.every((w) => w.entry && w.line >= 0) && [0, 1, 8].every((i) => lines[i].entry === null),
      { got: [lines[0].match, lines[1].match, lines[8].match], want }
    );
    // each decision posts exactly the fixture's bank entry (bank:fa-1 to bank:fa-6, in date order), under src bank:<lineId>
    const fixBank = F.entries.filter((e) => e.src.indexOf('bank:') === 0);
    A.decided.forEach((d, k) => {
      const e = d.entry;
      const ln = lines[d.i];
      check(
        `line ${d.i + 1} (${ln.text}) posts ${fixBank[k].src}'s date and lines under src bank:${ln.id}`,
        e && e.src === 'bank:' + ln.id && e.date === fixBank[k].date && J(e.lines) === J(fixBank[k].lines) && ln.entry === e.id && ln.match === null && e.by === ACTOR.by,
        { got: e && { src: e.src, date: e.date, lines: e.lines }, want: fixBank[k] }
      );
    });
    check('no bank: entry of the fixture was posted directly', fixBank.every((e) => !liveSrc(NS, ws, oid, e.src)));
    const tb = tbAt(NS, ws, oid, '2026-12-31');
    check('the trial balance at 2026-12-31 equals the fixture\'s expect.tb exactly', J(tb) === J(F.expect.tb), { got: tb, want: F.expect.tb });
    check('no line is left undecided', B.undecided(ws, oid, 'ba-1').length === 0, B.undecided(ws, oid, 'ba-1'));
    // reconcile at 2026-12-31 with the statement's closing balance: book 3,200,000; the check of FA-1002 outstanding
    const check2 = F.records.runs[0].lines.find((l) => l.investorId === 'FA-1002').netCents;
    const rec = B.reconcile(ws, oid, 'ba-1', '2026-12-31', A.st.parsed.closingCents);
    const book = F.expect.tb.find((r) => r.code === '1000').end;
    const wantOut = [{ entry: run && run.id, line: at(run, '1000', -check2), date: '2026-12-15', cents: -check2, memo: run && run.memo }];
    check('the statement balance is the file\'s closing balance, 3,500,000', rec.statementCents === X.files['fund-a.ofx'].closingCents && rec.statementCents === 3500000, rec.statementCents);
    check('the book balance is 1000 at 2026-12-31, 3,200,000', rec.bookCents === book && book === 3200000, rec.bookCents);
    check('the one outstanding item is FA-1002\'s check of -300,000', J(rec.outstanding) === J(wantOut), { got: rec.outstanding, want: wantOut });
    check('nothing is undecided and the difference is 0', Array.isArray(rec.undecided) && rec.undecided.length === 0 && rec.differenceCents === 0, { undecided: rec.undecided, d: rec.differenceCents });
    const stored = B.markReconciled(ws, oid, 'ba-1', '2026-12-31', rec.statementCents, ACTOR);
    const recs = fundOf(ws, oid).bank.recs;
    const wantRec = { account: 'ba-1', asOf: '2026-12-31', statementCents: 3500000, bookCents: 3200000, outstanding: [[run && run.id, at(run, '1000', -check2), -check2]], at: ACTOR.at, by: ACTOR.by };
    check('markReconciled stores the reconciliation with the outstanding check', recs.length === 1 && J(recs[0]) === J(wantRec) && J(stored) === J(wantRec), { got: recs, want: wantRec });
    check('nothing was written to the change log', (ws.audit || []).length === 0, (ws.audit || []).length);
  }
};

L.runParts(cases, { name: 'BANK REC', unit: 'cases', flag: '--case' });
