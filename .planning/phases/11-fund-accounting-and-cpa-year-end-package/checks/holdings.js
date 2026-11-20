// gate: node
// last "HOLDINGS: PASS (cases run: 1)"
// Valuations, opening balances and closing as ledger operations (plan 11-10, no browser): a fair value entered for an
// investment posts the change since its last value to 1150 and 6100; a fund that existed before its books enters its
// opening balances once; finalizing a month brings the books up to date, locks it and writes the trial balance's SHA-256
// to the change log (owner only); a redemption's amount is fixed once its dealing month is finalized. The portal is
// loaded inside each case with load11.js (the scripts diy.html lists, then books.js, books-post.js and books-hold.js).
// Funds A, B and D come from fixtures/fund-a.js, fund-b.js and fund-d.js, each figure written once there.
//   node holdings.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "HOLDINGS: PASS (cases run: N)" or
// "HOLDINGS: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal } = require('./load11.js');

const ACTOR = { by: 'Check Runner', at: '2026-11-20T10:00:00.000Z' };
const J = (x) => JSON.stringify(x);

/** The portal with the journal, the posting module and the holdings module, inside the case. */
function load(today) {
  const NS = loadPortal(undefined, { today, extra: ['books.js', 'books-post.js', 'books-hold.js'] });
  if (!NS.books || typeof NS.books.sync !== 'function') throw new Error('books.js and books-post.js did not load');
  return NS;
}
const fixture = (name) => JSON.parse(JSON.stringify(require('./fixtures/' + name + '.js')));
/** Throws, or a string saying it did not. */
function throws(fn) {
  try {
    fn();
    return null;
  } catch (e) {
    return String((e && e.message) || e);
  }
}
const need = (NS, name) => {
  if (typeof NS.books[name] !== 'function') throw new Error(`NS.books.${name} is not defined (books-hold.js)`);
};

const cases = {
  /**
   * FA-05, fund A: every fixture entry except the two valuations, then the two values of the research entered through
   * value(): their entries equal mark:fa-m1's and mark:fa-m2's lines, the trial balance is the research's, and the same
   * value entered again stores a mark and posts nothing.
   */
  value: ({ check }) => {
    const NS = load('2027-01-20');
    const F = fixture('fund-a');
    const ws = F.records;
    const oid = F.expect.offeringId;
    F.entries.filter((e) => !/^mark:/.test(e.src)).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
    NS.books.sync(ws, { today: NS.dates.today() });
    need(NS, 'value');
    const want = (src) => F.entries.find((e) => e.src === src).lines;
    const f = ws.books.funds[oid];
    const m1 = NS.books.value(ws, oid, { holding: 'fa-x', date: '2026-09-30', fvCents: 46000000, doc: 'Q3 valuation memo' }, ACTOR);
    const e1 = NS.books.live(f, 'mark:' + m1.id);
    check("value(fa-x, 2026-09-30, 46,000,000): change +6,000,000 = mark:fa-m1's lines", e1 && J(e1.lines) === J(want('mark:fa-m1')) && e1.date === '2026-09-30', e1);
    check("the mark is stored { id 'm-1', holding, date, fvCents, doc, at, by }", J(f.marks[0]) === J({ id: 'm-1', holding: 'fa-x', date: '2026-09-30', fvCents: 46000000, doc: 'Q3 valuation memo', at: ACTOR.at, by: ACTOR.by }) && J(m1) === J(f.marks[0]), f.marks);
    const m2 = NS.books.value(ws, oid, { holding: 'fa-x', date: '2026-12-31', fvCents: 49000000 }, ACTOR);
    const e2 = NS.books.live(f, 'mark:' + m2.id);
    check("value(fa-x, 2026-12-31, 49,000,000): change +3,000,000 = mark:fa-m2's lines", e2 && J(e2.lines) === J(want('mark:fa-m2')) && e2.date === '2026-12-31', e2);
    const tb = NS.books.trialBalance(ws, oid, '', '2026-12-31').map((r) => ({ code: r.code, end: r.end }));
    check("fund A's trial balance at 2026-12-31 = the research's (ten accounts)", J(tb) === J(F.expect.tb), tb);
    const n = f.journal.length;
    const m3 = NS.books.value(ws, oid, { holding: 'fa-x', date: '2026-12-31', fvCents: 49000000 }, ACTOR);
    check('the same value again: a third mark is stored (change 0) and no entry is posted', f.marks.length === 3 && m3.id === 'm-3' && f.journal.length === n && !NS.books.live(f, 'mark:' + m3.id), { marks: f.marks.length, journal: [n, f.journal.length] });
  }
};

L.runParts(cases, { name: 'HOLDINGS', unit: 'cases', flag: '--case' });
