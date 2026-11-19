// gate: node
// last "POSTING: PASS (cases run: 1)"
// Posting from records (plan 11-05, no browser): every money record the portal keeps becomes journal entries once,
// keyed by the record (assets/js/books-post.js: NS.books.desired and NS.books.sync). The portal is loaded inside each
// case with load11.js (the scripts diy.html lists, then books.js and books-post.js), today 2027-01-20 unless a case
// says otherwise. Every figure of hand-worked fund A is read from fixtures/fund-a.js, never typed again here.
//   node posting.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "POSTING: PASS (cases run: N)" or
// "POSTING: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal } = require('./load11.js');

const TODAY = '2027-01-20';
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
const AUTO = 'Portal (automatic)';
const J = (x) => JSON.stringify(x);

/** The portal with the journal and the posting module, inside the case (a missing module prints a FAIL line). */
function load(today) {
  const NS = loadPortal(undefined, { today: today || TODAY, extra: ['books.js', 'books-post.js'] });
  if (!NS.books || typeof NS.books.desired !== 'function' || typeof NS.books.sync !== 'function') throw new Error('assets/js/books-post.js did not add NS.books.desired and NS.books.sync');
  return NS;
}
/** A fresh copy of hand-worked fund A. */
function fixture() {
  return JSON.parse(JSON.stringify(require('./fixtures/fund-a.js')));
}
/** Entries sorted by date, then src (11-CONTEXT B1). */
const byDateSrc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.src < b.src ? -1 : a.src > b.src ? 1 : 0);
/** src, date and lines of each entry (memos are not compared, 11-CONTEXT B1 and I1). */
const shape = (list) => list.map((e) => ({ src: e.src, date: e.date, lines: e.lines }));

/** Fund A: the records as the workspace, synced, then the fixture's other entries posted. */
function fundA(NS, opts) {
  const F = fixture();
  const ws = F.records;
  const oid = F.expect.offeringId;
  const o = ws.offerings.find((x) => x.id === oid);
  if (opts && opts.edit) opts.edit(ws, F);
  const r = NS.books.sync(ws, { today: TODAY });
  if (!opts || opts.others !== false) F.entries.forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  return { F, ws, oid, o, r };
}

const cases = {
  /** Task 1 (tracer): the records of fund A give exactly the fixture's entries, and the trial balance is the research's. */
  'fund-a': ({ check }) => {
    const NS = load();
    const F = fixture();
    const ws = F.records;
    const oid = F.expect.offeringId;
    const o = ws.offerings.find((x) => x.id === oid);
    const before = J(ws);
    const d = NS.books.desired(ws, o, { today: TODAY });
    const want = F.recordEntries.slice().sort(byDateSrc);
    check('desired(fund A) is exactly the fixture\'s 15 record entries (2 calls, 12 fees, 1 distribution): src, date and lines, by date then src', J(shape(d)) === J(shape(want)), { got: shape(d), want: shape(want) });
    check('desired accepts the offering id as well as the offering', J(shape(NS.books.desired(ws, oid, { today: TODAY }))) === J(shape(want)));
    check('desired changes nothing in the workspace (it does not even create the books of a fund)', J(ws) === before);
    let threw = '';
    try {
      NS.books.desired(ws, o, { today: '2027-01-21' });
    } catch (e) {
      threw = String(e && e.message);
    }
    check('desired throws when opts.today differs from the portal\'s day (11-CONTEXT W2)', !!threw, threw);
    const r = NS.books.sync(ws, { today: TODAY });
    check('the first sync posts the 15 entries and reverses nothing', r && r.posted === 15 && r.reversed === 0, r);
    const j = ws.books.funds[oid].journal;
    check("every posted entry names its record and is by 'Portal (automatic)'", j.length === 15 && j.every((e) => e.by === AUTO && want.some((w) => w.src === e.src)), j.map((e) => [e.src, e.by]));
    F.entries.forEach((e) => NS.books.post(ws, oid, e, ACTOR));
    const tb = NS.books.trialBalance(ws, oid, '2026-01-01', '2026-12-31').map((x) => ({ code: x.code, end: x.end }));
    check("after the fixture's other entries, the 2026 trial balance is the research's to the cent (ten accounts, 55,650,000 each side)", J(tb) === J(F.expect.tb), tb);
    const dr = tb.filter((x) => x.end > 0).reduce((a, x) => a + x.end, 0);
    const cr = -tb.filter((x) => x.end < 0).reduce((a, x) => a + x.end, 0);
    check('debits and credits are the fixture\'s totals', dr === F.expect.tbDebits && cr === F.expect.tbCredits, { dr, cr });
  }
};

L.runParts(cases, { name: 'POSTING', unit: 'cases', flag: '--case' });
