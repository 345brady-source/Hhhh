// gate: node
// last "BANK REC: PASS (cases run: 10)"
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
/** Lines written in the case as a CSV (Date,Description,Amount), read with NS.bankFiles.parse and imported into ba-1. */
function importCsv(NS, A, rows, extra) {
  const csv = 'Date,Description,Amount\n' + rows.map((r) => r.join(',')).join('\n') + '\n';
  const parsed = NS.bankFiles.parse(csv);
  const r = A.B.importLines(A.ws, A.oid, 'ba-1', parsed, Object.assign({ name: 'in-case.csv', sha256: NS.audit.sha256(csv), fileId: '', by: ACTOR.by, at: ACTOR.at }, extra || {}));
  const ids = new Set(parsed.lines.map((l) => 'ba-1:' + l.id));
  return { parsed, r, lines: linesOf(A.ws, A.oid).filter((l) => ids.has(l.id)) };
}
/** The holding's balance on an account through a day. */
const held = (NS, A, code, holding, asOf) => NS.books.balance(A.ws, A.oid, code, asOf || '9999-12-31', { holding });
/** Calls fn, which must throw; { threw, message, code, same } where same says ws.books did not change. */
function refused(A, fn) {
  const before = J(A.ws.books);
  try {
    fn();
  } catch (e) {
    return { threw: true, message: String(e && e.message), code: e && e.code, same: J(A.ws.books) === before };
  }
  return { threw: false, message: '', code: undefined, same: J(A.ws.books) === before };
}
/** One plain sentence: a capital first, one full stop at the end and none inside. */
const sentence = (m) => /^[A-Z][^]*\.$/.test(m) && !/\.\s/.test(m);
/** The January 2027 statement imported after case fund-a. */
function january(NS, A) {
  const st = statement(NS, 'fund-a-2027-01.csv');
  const r = A.B.importLines(A.ws, A.oid, 'ba-1', st.parsed, st.opts);
  const lines = A.lines().slice(-2);
  return { st, r, check: lines[0], sale: lines[1] };
}
const at = (e, code, cents) => (e ? e.lines.findIndex((l) => l[0] === code && l[1] === cents) : -1);

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
  },

  // T13: the same statement twice adds nothing; the same statement in another format is an overlap, added only when asked.
  twice: ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const { ws, oid, B } = A;
    const journal = fundOf(ws, oid).journal.length;
    const again = (name, extra) => {
      const st = statement(NS, name, extra);
      return B.importLines(ws, oid, 'ba-1', st.parsed, st.opts);
    };
    const r1 = again('fund-a.ofx');
    check('fund-a.ofx a second time: added 0, skipped 9, no import record', J(r1) === J({ added: 0, skipped: 9, overlap: 0 }) && fundOf(ws, oid).bank.imports.length === 1 && A.lines().length === 9, r1);
    const r2 = again('fund-a.qfx');
    check('fund-a.qfx (the same bank ids): added 0, skipped 9, no import record', J(r2) === J({ added: 0, skipped: 9, overlap: 0 }) && fundOf(ws, oid).bank.imports.length === 1 && A.lines().length === 9, r2);
    const r3 = again('fund-a-signed.csv');
    check('fund-a-signed.csv (other ids, the same lines): added 0, overlap 9, no import record', J(r3) === J({ added: 0, skipped: 0, overlap: 9 }) && fundOf(ws, oid).bank.imports.length === 1 && A.lines().length === 9, r3);
    const r4 = again('fund-a-signed.csv', { allowOverlap: true });
    check('with allowOverlap (the sponsor\'s choice) it adds the 9 and stores one import record', J(r4) === J({ added: 9, skipped: 0, overlap: 9 }) && fundOf(ws, oid).bank.imports.length === 2 && A.lines().length === 18, r4);
    const r5 = again('fund-a-signed.csv', { allowOverlap: true });
    check('the CSV a second time is skipped by its ids', J(r5) === J({ added: 0, skipped: 9, overlap: 0 }) && A.lines().length === 18, r5);
    check('no import posted anything', fundOf(ws, oid).journal.length === journal, fundOf(ws, oid).journal.length);
  },

  // Two investors wire the same amount in the same week: never matched automatically; the investor's id ranks first.
  candidates: ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const { ws, oid, B } = A;
    // call 2: FA-1002 pays 100,000.00 on 2027-01-11, FA-1001 the same on 2027-01-12 (recorded as NS.ops.receive records it)
    ws.calls.push({
      id: 'fa-call-2',
      offeringId: oid,
      number: 2,
      noticeDate: '2027-01-04',
      due: '2027-01-12',
      pct: 0,
      total: 20000000,
      purpose: 'Follow-on investment',
      note: '',
      status: 'complete',
      items: [
        { investorId: 'FA-1001', cents: 10000000, received: '2027-01-12', reminders: [] },
        { investorId: 'FA-1002', cents: 10000000, received: '2027-01-11', reminders: [] }
      ]
    });
    ws.investors.find((i) => i.id === 'FA-1001').positions.push({ offeringId: oid, amount: 100000, commitment: 0, date: '2027-01-12', ref: 'fa-call-2' });
    ws.investors.find((i) => i.id === 'FA-1002').positions.push({ offeringId: oid, amount: 100000, commitment: 0, date: '2027-01-11', ref: 'fa-call-2' });
    NS.books.sync(ws, { today: TODAY });
    const c1 = liveSrc(NS, ws, oid, 'call:fa-call-2:FA-1001');
    const c2 = liveSrc(NS, ws, oid, 'call:fa-call-2:FA-1002');
    check('the records post both call 2 payments, each a cash line of 10,000,000', !!(c1 && c2) && at(c1, '1000', 10000000) >= 0 && at(c2, '1000', 10000000) >= 0, { c1, c2 });
    // one bank line alone with two candidates: not matched automatically
    const b2 = importCsv(NS, A, [['01/12/2027', 'WIRE IN FA-1002 FUND A CALL 2', '100000.00']]).lines[0];
    check('a lone line with two candidates is not matched automatically', B.candidates(ws, oid, b2.id).length === 2 && B.autoMatch(ws, oid, 'ba-1') === 0 && !b2.match, B.candidates(ws, oid, b2.id));
    const b1 = importCsv(NS, A, [['01/13/2027', 'WIRE IN FA-1001 FUND A CALL 2', '100000.00']]).lines[0];
    const k2 = B.candidates(ws, oid, b2.id);
    const k1 = B.candidates(ws, oid, b1.id);
    const keys = (ks) => ks.map((k) => k.entry + '|' + k.line).sort();
    const both = [c1.id + '|' + at(c1, '1000', 10000000), c2.id + '|' + at(c2, '1000', 10000000)].sort();
    check('each bank line has the same two candidates', J(keys(k2)) === J(both) && J(keys(k1)) === J(both), { k2, k1 });
    check('autoMatch matches 0 and both lines stay undecided', B.autoMatch(ws, oid, 'ba-1') === 0 && !b2.match && !b1.match && B.undecided(ws, oid, 'ba-1').length === 2, B.undecided(ws, oid, 'ba-1'));
    check(
      "the line naming FA-1002 ranks FA-1002's call first, ahead of FA-1001's dated the same day as the line",
      k2.length === 2 && k2[0].entry === c2.id && k2[0].partner === 'FA-1002' && k2[0].rank < k2[1].rank && k2[1].entry === c1.id && k2[1].date === b2.date,
      k2
    );
    check("the line naming FA-1001 ranks FA-1001's call first", k1.length === 2 && k1[0].entry === c1.id && k1[0].partner === 'FA-1001' && k1[0].rank < k1[1].rank, k1);
    // the bank text without the hyphen still names the investor (banks drop punctuation)
    const im2 = importCsv(NS, A, [['01/13/2027', 'WIRE IN FA1002 CALL 2', '100000.00']]);
    const k3 = B.candidates(ws, oid, im2.lines[0].id);
    check("'FA1002' in the text ranks FA-1002's call first", k3.length === 2 && k3[0].entry === c2.id && k3[0].rank < k3[1].rank, k3);
    // every word of the wire reference NS.ops.wire gives FA-1002 for call 2, in another order, also ranks it first
    const refWords = NS.ops.wire(ws, ws.offerings[0], ws.investors[1], ws.calls[1]).reference;
    const im3 = importCsv(NS, A, [['01/13/2027', '1002 FA / FUND A CALL 2', '100000.00']]);
    const k5 = B.candidates(ws, oid, im3.lines[0].id);
    check(`text holding every word of the wire reference '${refWords}' ranks FA-1002's call first`, k5.length === 2 && k5[0].entry === c2.id && k5[0].rank === 0 && k5[1].rank === 1, k5);
    // the ACH file's cash line names no investor (W2: the partner is the cash line's, else the entry's only 3000/3100 line's)
    const run = liveSrc(NS, ws, oid, 'run:fa-run-1');
    const k4 = B.candidates(ws, oid, A.lines()[0].id);
    check('a matched line still lists its own match as a candidate, and the call line it matched carries FA-1001 as partner', k4.length === 1 && k4[0].partner === 'FA-1001', k4);
    check('the ACH line of the distribution carries no partner (two 3100 lines)', run && B.candidates(ws, oid, A.lines()[8].id).every((k) => k.partner === ''), B.candidates(ws, oid, A.lines()[8].id));
  },

  // A check issued 15 December clears 4 January: its only candidate is FA-1002's check line; the month reconciles to 0.
  'check-clears': ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const { ws, oid, B } = A;
    const jan = january(NS, A);
    check('the January statement adds 2 lines', J(jan.r) === J({ added: 2, skipped: 0, overlap: 0 }) && jan.check.cents === -300000 && jan.sale.cents === 24000000, jan.r);
    const run = liveSrc(NS, ws, oid, 'run:fa-run-1');
    const ck = at(run, '1000', -300000);
    const cs = B.candidates(ws, oid, jan.check.id);
    check(
      "the check line's candidates are exactly FA-1002's check line (20 days after issue, inside 180)",
      cs.length === 1 && cs[0].entry === run.id && cs[0].line === ck && cs[0].partner === 'FA-1002' && cs[0].date === '2026-12-15',
      cs
    );
    B.match(ws, oid, jan.check.id, { entry: cs[0].entry, line: cs[0].line });
    check('matched, nothing posted', jan.check.match && jan.check.match.entry === run.id && jan.check.entry === null, jan.check);
    B.categorize(ws, oid, jan.sale.id, { kind: 'sale', holding: 'fa-x', costCents: 20000000 }, ACTOR);
    const closing = jan.st.parsed.closingCents;
    const r = B.reconcile(ws, oid, 'ba-1', '2027-01-31', closing);
    check(
      'reconcile at 2027-01-31 with 27,200,000: book 27,200,000, no outstanding item, nothing undecided, difference 0',
      closing === 27200000 && r.bookCents === 27200000 && r.outstanding.length === 0 && r.undecided.length === 0 && r.differenceCents === 0,
      r
    );
    const r0 = B.reconcile(ws, oid, 'ba-1', '2026-12-31', A.st.parsed.closingCents);
    check('at 2026-12-31 the check is still outstanding (it cleared after that day) and the difference is 0', r0.outstanding.length === 1 && r0.outstanding[0].cents === -300000 && r0.differenceCents === 0, r0);
    // undoing the match leaves the check outstanding and the bank line undecided; matching again restores it
    B.unmatch(ws, oid, jan.check.id);
    const r2 = B.reconcile(ws, oid, 'ba-1', '2027-01-31', closing);
    check('after unmatch: the check outstanding, its bank line undecided, difference 0', jan.check.match === null && r2.outstanding.length === 1 && r2.undecided.length === 1 && r2.differenceCents === 0, r2);
    B.match(ws, oid, jan.check.id, { entry: run.id, line: ck });
    check('matched again', B.reconcile(ws, oid, 'ba-1', '2027-01-31', closing).outstanding.length === 0);
  },

  // Half of Portfolio Co X sold: cost given up, realized gain booked, the unrealized gain on the half reversed.
  sale: ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const { ws, oid, B } = A;
    const jan = january(NS, A);
    const e = B.categorize(ws, oid, jan.sale.id, { kind: 'sale', holding: 'fa-x', costCents: 20000000 }, ACTOR);
    // u = 9,000,000 x 20,000,000 / 40,000,000 = 4,500,000
    const want = [['1000', 24000000], ['1100', -20000000, '', 'fa-x'], ['6000', -4000000, '', 'fa-x'], ['6100', 4500000, '', 'fa-x'], ['1150', -4500000, '', 'fa-x']];
    check('the half sale posts exactly the example\'s entry, dated the line\'s date, src bank:<lineId>', e && J(e.lines) === J(want) && e.date === '2027-01-11' && e.src === 'bank:' + jan.sale.id && jan.sale.entry === e.id, e);
    check("fa-x's cost is 20,000,000 and its unrealized gain 4,500,000 afterwards", held(NS, A, '1100', 'fa-x') === 20000000 && held(NS, A, '1150', 'fa-x') === 4500000, [held(NS, A, '1100', 'fa-x'), held(NS, A, '1150', 'fa-x')]);
  },

  // All of Portfolio Co X sold on the same day: cost and unrealized gain both end at 0.
  'full-sale': ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const { ws, oid, B } = A;
    const im = importCsv(NS, A, [['01/11/2027', 'WIRE IN SALE PORTFOLIO CO X', '500000.00']]);
    const e = B.categorize(ws, oid, im.lines[0].id, { kind: 'sale', holding: 'fa-x', costCents: 40000000 }, ACTOR);
    const want = [['1000', 50000000], ['1100', -40000000, '', 'fa-x'], ['6000', -10000000, '', 'fa-x'], ['6100', 9000000, '', 'fa-x'], ['1150', -9000000, '', 'fa-x']];
    check('the full sale posts exactly the example\'s entry', e && J(e.lines) === J(want), e);
    check("fa-x's 1100 and 1150 balances end at 0", held(NS, A, '1100', 'fa-x') === 0 && held(NS, A, '1150', 'fa-x') === 0, [held(NS, A, '1100', 'fa-x'), held(NS, A, '1150', 'fa-x')]);
    // a sale at exactly the cost given up leaves the zero realized-gain line out
    const NS2 = load();
    const A2 = fundA(NS2);
    const im2 = importCsv(NS2, A2, [['01/11/2027', 'WIRE IN SALE PORTFOLIO CO X', '200000.00']]);
    const e2 = A2.B.categorize(A2.ws, A2.oid, im2.lines[0].id, { kind: 'sale', holding: 'fa-x', costCents: 20000000 }, ACTOR);
    check('a sale at cost has no 6000 line', e2 && J(e2.lines) === J([['1000', 20000000], ['1100', -20000000, '', 'fa-x'], ['6100', 4500000, '', 'fa-x'], ['1150', -4500000, '', 'fa-x']]), e2);
  },

  // A mortgage payment split between interest and principal.
  split: ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const { ws, oid, B } = A;
    const im = importCsv(NS, A, [['07/01/2026', 'LOAN PAYMENT', '-10000.00']]);
    const id = im.lines[0].id;
    const bad = refused(A, () =>
      B.categorize(ws, oid, id, { kind: 'split', lines: [{ account: '5200', cents: 600000, holding: 'fa-x' }, { account: '2500', cents: 399999, holding: 'fa-x' }] }, ACTOR)
    );
    check('items summing to 999,999 are refused with one sentence naming their total and nothing is posted', bad.threw && sentence(bad.message) && /\$9,999\.99/.test(bad.message) && bad.same && im.lines[0].entry === null, bad);
    const e = B.categorize(ws, oid, id, { kind: 'split', lines: [{ account: '5200', cents: 600000, holding: 'fa-x' }, { account: '2500', cents: 400000, holding: 'fa-x' }] }, ACTOR);
    check('the split posts [5200 +600,000 fa-x][2500 +400,000 fa-x][1000 -1,000,000]', e && J(e.lines) === J([['5200', 600000, '', 'fa-x'], ['2500', 400000, '', 'fa-x'], ['1000', -1000000]]) && e.date === '2026-07-01', e);
  },

  // Undoing a decision reverses its entry; in a closed period the undo is refused.
  uncategorize: ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const { ws, oid, B } = A;
    const line = A.lines()[3];
    const first = line.entry;
    const rev = B.uncategorize(ws, oid, line.id, ACTOR);
    check('the 5100 decision is reversed: 5100 is 0 at 2026-12-31', rev && rev.rev === first && NS.books.balance(ws, oid, '5100', '2026-12-31') === 0, rev);
    check('the line is undecided again', line.entry === null && line.match === null && B.undecided(ws, oid, 'ba-1').map((l) => l.id).join() === line.id, B.undecided(ws, oid, 'ba-1'));
    const r = B.reconcile(ws, oid, 'ba-1', '2026-12-31', A.st.parsed.closingCents);
    check(
      'reconcile then lists only the check as outstanding (the reversed pair is left out), the line as undecided, difference 0',
      r.outstanding.length === 1 && r.outstanding[0].cents === -300000 && r.undecided.length === 1 && r.undecided[0].id === line.id && r.differenceCents === 0,
      r
    );
    const again = B.categorize(ws, oid, line.id, { kind: 'account', account: '5100' }, ACTOR);
    check('decided again: a new entry under the same src', again && again.id !== first && again.src === 'bank:' + line.id && line.entry === again.id, again);
    NS.books.close(ws, oid, '2026-12-31', ACTOR);
    const no = refused(A, () => B.uncategorize(ws, oid, line.id, ACTOR));
    check("after closing through 2026-12-31 the undo is refused (the core's 'closed') and nothing changes", no.threw && no.code === 'closed' && no.same && line.entry === again.id, no);
  },

  refusals: ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const { ws, oid, B } = A;
    const callA = liveSrc(NS, ws, oid, 'call:fa-call-1:FA-1001');
    const callB = liveSrc(NS, ws, oid, 'call:fa-call-1:FA-1002');
    const im = importCsv(NS, A, [
      ['01/16/2026', 'WIRE IN SECOND COPY', '300000.00'],
      ['01/11/2027', 'WIRE IN SALE PORTFOLIO CO X', '500000.00']
    ]);
    const [extra, big] = im.lines;
    const sentenceOk = (x) => x.threw && sentence(x.message) && x.same;
    const r1 = refused(A, () => B.match(ws, oid, extra.id, { entry: callA.id, line: at(callA, '1000', 30000000) }));
    check('matching a journal line already matched is refused', sentenceOk(r1) && extra.match === null, r1);
    const run = liveSrc(NS, ws, oid, 'run:fa-run-1');
    const r2 = refused(A, () => B.match(ws, oid, extra.id, { entry: run.id, line: at(run, '1000', -300000) }));
    check('matching a different amount (an unmatched cash line) is refused', sentenceOk(r2) && /300,000\.00/.test(r2.message), r2);
    const r3 = refused(A, () => B.match(ws, oid, A.lines()[2].id, { entry: callB.id, line: at(callB, '1000', 15000000) }));
    check('matching a line already decided is refused', sentenceOk(r3), r3);
    const r4 = refused(A, () => B.categorize(ws, oid, extra.id, { kind: 'account', account: '9999' }, ACTOR));
    check('an account not in the chart is refused', sentenceOk(r4) && extra.entry === null, r4);
    const r5 = refused(A, () => B.categorize(ws, oid, extra.id, { kind: 'account', account: '1000' }, ACTOR));
    check('the cash code itself is refused', sentenceOk(r5) && extra.entry === null, r5);
    const r6 = refused(A, () => B.categorize(ws, oid, A.lines()[0].id, { kind: 'account', account: '4090' }, ACTOR));
    check('deciding a matched line is refused', sentenceOk(r6), r6);
    const r7 = refused(A, () => B.categorize(ws, oid, big.id, { kind: 'sale', holding: 'fa-x', costCents: 40000001 }, ACTOR));
    check("a sale with costCents above the holding's cost is refused", sentenceOk(r7) && big.entry === null, r7);
    const r8 = refused(A, () => B.markReconciled(ws, oid, 'ba-1', '2026-12-31', 3500001, ACTOR));
    check('markReconciled with a difference of 1 cent is refused', sentenceOk(r8) && fundOf(ws, oid).bank.recs.length === 0, r8);
    const zero = 3500000 - B.reconcile(ws, oid, 'ba-1', '2026-12-31', 3500000).differenceCents; // the extra line is undecided
    const r10 = refused(A, () => B.markReconciled(ws, oid, 'ba-1', '2026-12-31', zero, { at: ACTOR.at }));
    check('markReconciled without the name of the person storing it is refused', sentenceOk(r10) && fundOf(ws, oid).bank.recs.length === 0, r10);
    const r11 = refused(A, () => B.categorize(ws, oid, big.id, { kind: 'purchase', holding: 'fa-x' }, ACTOR));
    check('a purchase on a line of money in is refused', sentenceOk(r11), r11);
    const r12 = refused(A, () => B.categorize(ws, oid, extra.id, { kind: 'account', account: '1100', holding: 'no-such' }, ACTOR));
    check('an investment that is not in the fund is refused', sentenceOk(r12), r12);
    // accounts: only the last four digits are kept (T-11-25); a second account gets the next cash code
    const r13 = refused(A, () => B.addAccount(ws, oid, { name: 'Reserve', last4: '000123456789' }));
    check('a full account number is refused', sentenceOk(r13), r13);
    const ba2 = B.addAccount(ws, oid, { name: 'Reserve', last4: '4321' });
    check("a second account is ba-2 on 1001, added to the chart as 'Cash: Reserve'", ba2.id === 'ba-2' && ba2.code === '1001' && NS.books.accounts(ws, oid).some((a) => a.code === '1001' && a.name === 'Cash: Reserve' && a.type === 'asset'), ba2);
    const map = NS.bankFiles.csvGuess(readBank('fund-a-2027-01.csv'));
    B.setMap(ws, oid, 'ba-2', map);
    check('setMap keeps the confirmed column map on the account', J(fundOf(ws, oid).bank.accounts[1].map) === J(map), fundOf(ws, oid).bank.accounts[1]);
    const st2 = statement(NS, 'fund-a.ofx');
    const r14 = refused(A, () => B.importLines(ws, oid, 'ba-2', st2.parsed, st2.opts));
    check('a statement for the account ending 6789 is refused on the account ending 4321', sentenceOk(r14) && /6789/.test(r14.message), r14);
    // W3: u in BigInt, half-up: 1100 = 3e12, 1150 = 1e12 + 1, cost 1e12
    const h = NS.books.addHolding(ws, oid, { name: 'Large Co' }).id;
    NS.books.post(ws, oid, { date: '2026-10-01', memo: 'Large Co bought', src: 'man:large-buy', lines: [['1100', 3e12, '', h], ['1000', -3e12]] }, ACTOR);
    NS.books.post(ws, oid, { date: '2026-10-01', memo: 'Large Co valued', src: 'mark:large', lines: [['1150', 1e12 + 1, '', h], ['6100', -(1e12 + 1)]] }, ACTOR);
    const imL = importCsv(NS, A, [['10/02/2026', 'WIRE IN SALE LARGE CO', '12000000000.00']]);
    const B1100 = 3000000000000n;
    const B1150 = 1000000000001n;
    const cost = 1000000000000n;
    const u = Number((2n * B1150 * cost + B1100) / (2n * B1100));
    const eL = B.categorize(ws, oid, imL.lines[0].id, { kind: 'sale', holding: h, costCents: 1e12 }, ACTOR);
    const wantL = [['1000', 1.2e12], ['1100', -1e12, '', h], ['6000', -2e11, '', h], ['6100', u, '', h], ['1150', -u, '', h]];
    check(`the unrealized gain given up on 1e12 of 3e12 cost with 1e12 + 1 carried is the BigInt value ${u}`, u === 333333333334 && eL && J(eL.lines) === J(wantL), { got: eL && eL.lines, want: wantL });
    // the W3 numbers give the same u in floating point; these do not: 1e12 of 2e12 cost with 1e12 + 23 carried is
    // exactly 500,000,000,011.5, which half-up makes ...012 (floating point gives ...011)
    const h2 = NS.books.addHolding(ws, oid, { name: 'Large Co 2' }).id;
    NS.books.post(ws, oid, { date: '2026-10-01', memo: 'Large Co 2 bought', src: 'man:large-buy-2', lines: [['1100', 2e12, '', h2], ['1000', -2e12]] }, ACTOR);
    NS.books.post(ws, oid, { date: '2026-10-01', memo: 'Large Co 2 valued', src: 'mark:large-2', lines: [['1150', 1e12 + 23, '', h2], ['6100', -(1e12 + 23)]] }, ACTOR);
    const u2 = Number((2n * 1000000000023n * 1000000000000n + 2000000000000n) / (2n * 2000000000000n));
    const imL2 = importCsv(NS, A, [['10/02/2026', 'WIRE IN SALE LARGE CO 2', '10000000000.00']]);
    const eL2 = B.categorize(ws, oid, imL2.lines[0].id, { kind: 'sale', holding: h2, costCents: 1e12 }, ACTOR);
    check(`1e12 of 2e12 cost with 1e12 + 23 carried gives the BigInt value ${u2}, not floating point's ${Math.round(((1e12 + 23) * 1e12) / 2e12)}`, u2 === 500000000012 && eL2 && J(eL2.lines.slice(-2)) === J([['6100', u2, '', h2], ['1150', -u2, '', h2]]), eL2 && eL2.lines);
    // a line dated in a closed period cannot be decided and stays undecided
    NS.books.close(ws, oid, '2026-06-30', ACTOR);
    const r9 = refused(A, () => B.categorize(ws, oid, extra.id, { kind: 'account', account: '4090' }, ACTOR));
    check("a line dated in a closed period cannot be decided (the core's 'closed') and stays undecided", r9.threw && r9.code === 'closed' && r9.same && extra.entry === null && B.undecided(ws, oid, 'ba-1').some((l) => l.id === extra.id), r9);
  },

  selfcheck: ({ check }) => {
    const { spawnSync } = require('child_process');
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const a = run(['--case', 'no-such-case']);
    const b = run(['--case', '']);
    check('an unknown --case name exits 1 with a FAIL line', a.status === 1 && /^FAIL unknown case name: no-such-case/m.test(a.stdout) && /BANK REC: FAIL \(cases run: 0\)/.test(a.stdout), a.stdout);
    check('an empty list exits 1 with a FAIL line', b.status === 1 && /^FAIL no cases to run/m.test(b.stdout) && /BANK REC: FAIL \(cases run: 0\)/.test(b.stdout), b.stdout);
  }
};

L.runParts(cases, { name: 'BANK REC', unit: 'cases', flag: '--case' });
