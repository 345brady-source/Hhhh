// gate: node
// last "DIST RECORD: PASS (cases run: 1)"
// The distribution record (plan 10-01), no browser: assets/js/data.js run in a sandbox with window.CVPortal = {}, on
// workspaces written out here. Every number is worked by hand below and written out in the case.
//   node dist-record.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "DIST RECORD: PASS (cases run: N)" or
// "DIST RECORD: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
//
// Example A. One fund, three holders since 2 January 2025: A-1001 $300,000, A-1002 $200,000, A-1003 $100,000 (together
// $600,000). A distribution of $10,000.00 (1,000,000 cents) dated 15 June 2026:
//   A-1001: 1,000,000 x 300,000 / 600,000 = 500,000.00         -> 500,000 cents
//   A-1002: 1,000,000 x 200,000 / 600,000 = 333,333.33...      -> 333,333, 0.333 left over
//   A-1003: 1,000,000 x 100,000 / 600,000 = 166,666.66...      -> 166,666, 0.667 left over
//   Whole cents add to 999,999; the one cent left goes to the largest remainder, A-1003: 166,667.
//   Stored lines: 500,000 / 333,333 / 166,667 = 1,000,000.
//
// Example B (item A8: a position redeemed in full). Example A's fund with a fourth holder, A-1004, $400,000 since
// 2 January 2025, redeemed in full at the 31 March 2026 dealing date (together $1,000,000 until then, $600,000 after).
//   $10,000.00 dated 16 March 2026 (before the dealing date), over $1,000,000:
//     A-1001 1,000,000 x 300,000 / 1,000,000 = 300,000; A-1002 200,000; A-1003 100,000; A-1004 400,000. Total 1,000,000.
//   $10,000.00 dated 31 March 2026 (the dealing date; the capital leaves at the end of that day): the same four amounts.
//   $10,000.00 dated 15 June 2026 (after it): A-1004 holds nothing and gets no line; the other three are example A's
//     500,000 / 333,333 / 166,667.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const SRC = (f, root) => fs.readFileSync(path.join(root || L.ROOT, f), 'utf8');
/**
 * A fresh sandbox whose clock stands at noon on `day`, with the given files of assets/js loaded the way the browser
 * loads them. Called inside each case, so a missing function prints a FAIL line for that case and never a bare stack
 * trace. root: another checkout's folder (case sample compares with the base tree).
 */
function load(day, files, root) {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window });
  const [y, m, d] = day.split('-').map(Number);
  vm.runInContext(`(function () { const R = Date; const fixed = new R(${y}, ${m - 1}, ${d}, 12, 0, 0).getTime(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } } globalThis.Date = D; })();`, ctx);
  (files || ['data.js']).forEach((f) => vm.runInContext(SRC('assets/js/' + f, root), ctx, { filename: f }));
  return window.CVPortal;
}

const J = (x) => JSON.stringify(x);
const inv = (id, amount, more) => Object.assign({ id, title: `Investor ${id}`, contact: `Person ${id}`, type: 'individual', onboarding: { status: 'complete' }, payment: { method: 'check', bank: null }, positions: [{ offeringId: 'f1', amount, date: '2025-01-02' }] }, more || {});
/** Example A's workspace. */
const wsA = () => ({
  v: 2,
  tenant: { id: 'example', shortName: 'Example' },
  offerings: [{ id: 'f1', name: 'Fund One, L.P.', shortName: 'Fund One', type: 'Private credit', status: 'Active', closeDate: '2025-01-02', distribution: { frequency: 'Quarterly', type: 'Income' } }],
  investors: [inv('A-1001', 300000), inv('A-1002', 200000), inv('A-1003', 100000)],
  runs: [],
  requests: []
});
/** Example B's workspace: example A with A-1004, $400,000, redeemed in full at 31 March 2026. */
const wsB = () => {
  const w = wsA();
  const d = inv('A-1004', 400000);
  d.positions[0].redeemed = '2026-03-31';
  w.investors.push(d);
  return w;
};
const A_LINES = [
  { investorId: 'A-1001', grossCents: 500000, withheld: [], netCents: 500000 },
  { investorId: 'A-1002', grossCents: 333333, withheld: [], netCents: 333333 },
  { investorId: 'A-1003', grossCents: 166667, withheld: [], netCents: 166667 }
];
const BY = 'Dana Reyes (Example admin)';
const JUNE = { offeringId: 'f1', date: '2026-06-15', type: 'Income', total: 1000000, file: '' };
/** fn must throw and leave the workspace's runs as they were; resolves to the message, or '' when it did not throw. */
function refuses(ws, fn) {
  const before = J(ws.runs);
  let msg = '';
  try {
    fn();
  } catch (e) {
    msg = String((e && e.message) || e) || 'threw';
  }
  // a function that does not exist yet is not a refusal
  return { threw: !!msg && !/is not a function|is not defined|Cannot read/.test(msg), msg, unchanged: J(ws.runs) === before };
}
/** A block of checks that reports one FAIL line when the code it needs is missing. */
function block(check, name, fn) {
  try {
    fn();
  } catch (e) {
    check(`${name}: ran to the end`, false, String(e && e.stack ? e.stack : e).split('\n').slice(0, 3).join(' | '));
  }
}
const shares = (D, ws, date) => D.allocate(ws, { id: 'x-' + date, offeringId: 'f1', date, total: 1000000 }).filter((r) => r.cents > 0).map((r) => `${r.investor.id}=${r.cents}`).join(' ');

const cases = {
  store({ check }) {
    // Item A8 first, on what exists today (NS.data.allocate): a position redeemed in full keeps no share afterwards.
    block(check, 'A8', () => {
      const NS = load('2026-06-15');
      const D = NS.data;
      const w = wsB();
      check('A8: $10,000.00 dated 16 March 2026, before the redemption, is shared by all four (300,000 / 200,000 / 100,000 / 400,000)', shares(D, w, '2026-03-16') === 'A-1001=300000 A-1002=200000 A-1003=100000 A-1004=400000', shares(D, w, '2026-03-16'));
      check('A8: dated the dealing date itself, 31 March 2026, the redeemed investor still has its share (400,000)', shares(D, w, '2026-03-31') === 'A-1001=300000 A-1002=200000 A-1003=100000 A-1004=400000', shares(D, w, '2026-03-31'));
      check('A8: $10,000.00 dated 15 June 2026, after the redemption, gives the redeemed investor nothing (500,000 / 333,333 / 166,667)', shares(D, w, '2026-06-15') === 'A-1001=500000 A-1002=333333 A-1003=166667', shares(D, w, '2026-06-15'));
      check('A8: capital invested is $1,000,000 on the dealing date and $600,000 the day after', D.investedAt(w.investors, 'f1', '2026-03-31') === 1000000 && D.investedAt(w.investors, 'f1', '2026-04-01') === 600000, [D.investedAt(w.investors, 'f1', '2026-03-31'), D.investedAt(w.investors, 'f1', '2026-04-01')]);
    });
    block(check, 'A8 stored', () => {
      const NS = load('2026-06-15');
      const D = NS.data;
      const w = wsB();
      const after = D.recordRun(w, JUNE, { by: BY, today: '2026-06-15', id: 'b-june' });
      check('A8: the run recorded after the redemption stores no line for the redeemed investor', J(after.lines) === J(A_LINES), after.lines);
      const before = D.recordRun(w, Object.assign({}, JUNE, { date: '2026-03-16' }), { by: BY, today: '2026-06-15', id: 'b-march' });
      check('A8: the run dated before the redemption stores its line (A-1004 400,000 of 1,000,000)', J(before.lines.map((l) => [l.investorId, l.grossCents])) === J([['A-1001', 300000], ['A-1002', 200000], ['A-1003', 100000], ['A-1004', 400000]]), before.lines);
    });
    // Example A, to the cent.
    block(check, 'example A', () => {
      const NS = load('2026-06-15');
      const D = NS.data;
      const w = wsA();
      const run = D.recordRun(w, JUNE, { by: BY, today: '2026-06-15', id: 'a-june' });
      check('recordRun stores the three lines 500,000 / 333,333 / 166,667, nothing withheld, net equal to gross', J(run.lines) === J(A_LINES), run.lines);
      check('the gross amounts add up to the total, 1,000,000 cents', run.lines.reduce((a, l) => a + l.grossCents, 0) === 1000000 && run.total === 1000000);
      check('the run says its lines were stored when it was recorded, by whom and when', run.linesBasis === 'recorded' && run.linesBy === BY && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(run.linesAt || ''), { basis: run.linesBasis, by: run.linesBy, at: run.linesAt });
      check('the run keeps the keys it had before (id, offering, date, type, total, status, source, file)', J([run.id, run.offeringId, run.date, run.type, run.total, run.status, run.source, run.file]) === J(['a-june', 'f1', '2026-06-15', 'Income', 1000000, 'paid', 'console', '']), run);
      check('the run is in the workspace', w.runs.length === 1 && w.runs[0] === run);
      const read = D.runLines(w, run);
      check('runLines answers the stored lines as they are', read.stored === true && read.basis === 'recorded' && J(read.lines) === J(A_LINES), read);
      const march = D.recordRun(w, Object.assign({}, JUNE, { date: '2026-03-16', gp: 25000, gross: 1025000 }), { by: BY, today: '2026-06-15', id: 'a-march' });
      const sept = D.recordRun(w, Object.assign({}, JUNE, { date: '2026-09-15', file: 'FUND_ONE_20260915_A.ach' }), { by: BY, today: '2026-06-15', id: 'a-sept' });
      check('runs are kept newest first (15 September, 15 June, 16 March)', J(w.runs.map((r) => r.id)) === J(['a-sept', 'a-june', 'a-march']), w.runs.map((r) => r.id));
      check('a run recorded for a later date is written as scheduled, as before, with its file name', sept.status === 'scheduled' && sept.file === 'FUND_ONE_20260915_A.ach', sept);
      check('carried interest paid to the GP and the gross proceeds are kept when given, and absent otherwise', march.gp === 25000 && march.gross === 1025000 && !('gp' in run) && !('gross' in run), [march.gp, march.gross]);
      check('without an id the run gets one that starts with the offering and the date', /^f1-2026-06-15-/.test(D.recordRun(wsA(), JUNE, { by: BY, today: '2026-06-15' }).id));
    });
    // What is refused stores nothing.
    block(check, 'refusals', () => {
      const NS = load('2026-06-15');
      const D = NS.data;
      const w = wsA();
      const opts = { by: BY, today: '2026-06-15' };
      const zero = refuses(w, () => D.recordRun(w, Object.assign({}, JUNE, { total: 0 }), opts));
      check('a total of 0 is refused and nothing is stored', zero.threw && zero.unchanged && w.runs.length === 0, zero);
      const frac = refuses(w, () => D.recordRun(w, Object.assign({}, JUNE, { total: 1000000.5 }), opts));
      check('a total that is not a whole number of cents is refused and nothing is stored', frac.threw && frac.unchanged && w.runs.length === 0, frac);
      const text = refuses(w, () => D.recordRun(w, Object.assign({}, JUNE, { total: '1000000' }), opts));
      check('a total given as text is refused and nothing is stored', text.threw && text.unchanged && w.runs.length === 0, text);
      const early = refuses(w, () => D.recordRun(w, Object.assign({}, JUNE, { date: '2024-12-31' }), opts));
      check('a date on which nobody holds the offering is refused and nothing is stored', early.threw && early.unchanged && w.runs.length === 0, early);
      const day = refuses(w, () => D.recordRun(w, Object.assign({}, JUNE, { date: '6/15/2026' }), opts));
      check('a date that is not YYYY-MM-DD is refused and nothing is stored', day.threw && day.unchanged && w.runs.length === 0, day);
      const who = refuses(w, () => D.recordRun(w, JUNE, { today: '2026-06-15' }));
      check('a record with nobody named as recording it is refused and nothing is stored', who.threw && who.unchanged && w.runs.length === 0, who);
      // A5: amounts that cannot add up to the total are never stored. A-1002 carries a correcting position of -$300,000:
      // $300,000 + (-$100,000) + $100,000 = $300,000 in all; A-1001 alone would get 1,000,000 x 300,000 / 300,000 =
      // 1,000,000, A-1003 333,333, and A-1002 a negative amount: the positive lines add to 1,333,333, not 1,000,000.
      const bad = wsA();
      bad.investors[1].positions.push({ offeringId: 'f1', amount: -300000, date: '2025-06-02' });
      const sum = refuses(bad, () => D.buildLines(bad, JUNE));
      check('buildLines refuses when its gross amounts do not add up to the total (a negative holding)', sum.threw && /add up/i.test(sum.msg), sum);
      const sum2 = refuses(bad, () => D.recordRun(bad, JUNE, opts));
      check('and recordRun stores nothing in that case', sum2.threw && sum2.unchanged && bad.runs.length === 0, sum2);
      const nan = wsA();
      nan.investors[0].positions[0].amount = NaN;
      const sum3 = refuses(nan, () => D.buildLines(nan, JUNE));
      check('buildLines refuses when a holding is not a number', sum3.threw, sum3);
    });
  }
};

L.runParts(cases, { name: 'DIST RECORD', unit: 'cases', flag: '--case', browser: false });
