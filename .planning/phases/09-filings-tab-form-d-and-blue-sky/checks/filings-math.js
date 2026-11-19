// gate: node
// last "FILINGS MATH: PASS (cases run: 1)"
// Pure checks for phase 9 (no browser): assets/js/filings.js with data.js and eligibility.js in one sandbox, the way the
// browser loads them (window.CVPortal), on sample workspaces built here.
//   node filings-math.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "FILINGS MATH: PASS (cases run: N)" or
// "FILINGS MATH: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by gate9.sh.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const SRC = (f) => fs.readFileSync(path.join(L.ROOT, f), 'utf8');
/**
 * A fresh sandbox with data.js, eligibility.js and filings.js. Called inside each case, so a missing or broken module
 * prints a FAIL line for that case and never a bare stack trace. more: values placed on NS before filings.js loads.
 */
function load(more) {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window });
  ['assets/js/data.js', 'assets/js/eligibility.js'].forEach((f) => vm.runInContext(SRC(f), ctx, { filename: f }));
  Object.assign(window.CVPortal, more || {});
  vm.runInContext(SRC('assets/js/filings.js'), ctx, { filename: 'assets/js/filings.js' });
  if (!window.CVPortal.filings) throw new Error('assets/js/filings.js did not set NS.filings');
  return window.CVPortal;
}

/* ---------- Sample data ---------- */
const J = (x) => JSON.stringify(x);
const off = (id, exemption, more) => Object.assign({ id, name: `Fund ${id}`, minimum: 50000, structure: { exemption } }, more || {});
const inv = (id, address, more) => Object.assign({ id, title: `Investor ${id}`, address, positions: [] }, more || {});
const ABROAD = { address: '4 Rue de la Paix, Paris, 75002, France', country: 'France' };
const abroad = (id) => inv(id, ABROAD.address, { country: ABROAD.country });
const sub = (id, investorId, offeringId, status, cents, decided, more) => Object.assign({ id, type: 'subscription', investorId, offeringId, status, cents, decided, submitted: decided }, more || {});
const WS = (offerings, investors, requests) => ({ tenant: { id: 't1', shortName: 'Sample' }, offerings, investors, requests: requests || [] });
/** A drawdown subscription countersigned: the request is accepted and the investor holds a position that refers to it. */
function accept(ws, r, date) {
  r.status = 'accepted';
  ws.investors.find((i) => i.id === r.investorId).positions.push({ offeringId: r.offeringId, amount: 0, commitment: r.cents / 100, date: date || r.decided, ref: r.id });
  return r;
}
/** One Rule 506(b) offering with three accepted subscriptions from investors abroad; the earliest is decided on `first`. */
function threeSales(first, second, third) {
  const ws = WS([off('o1', 'Rule 506(b)')], [abroad('a'), abroad('b'), abroad('c')], []);
  [['a', first, 25000000], ['b', second, 10000000], ['c', third, 5000000]].forEach(([i, d, c], k) => {
    ws.requests.push(accept(ws, sub(`r${k + 1}`, i, 'o1', 'approved', c, d)));
  });
  return ws;
}
const only = (list, kind) => list.filter((x) => x.kind === kind);

const cases = {
  first({ check }) {
    const NS = load();
    const F = NS.filings;
    // Monday 2 November 2026 is the earliest decision; the others follow.
    const ws = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    const before = J(ws);
    const f = F.facts(ws, ws.offerings[0]);
    check('facts gives the earliest accepted subscription as the first sale (2026-11-02)', f.firstSale === '2026-11-02', f);
    const d = F.due(ws, '2026-11-02');
    check('one reminder: the first Form D, for this offering', d.length === 1 && d[0].kind === 'formd-first' && d[0].offeringId === 'o1' && d[0].key === 'formd-first:o1', d);
    check('due 15 calendar days after the first sale (2026-11-17, a Tuesday)', d.length === 1 && d[0].due === '2026-11-17', d);
    check('no state reminder: no investor has an address in a U.S. state', only(d, 'state-first').length === 0 && J(Object.keys(f.byState || { x: 1 })) === '[]', { d, byState: f.byState });
    check('the level is due from the day of the first sale', d.length === 1 && d[0].level === 'due' && d[0].silenced === false, d);
    const on = F.due(ws, '2026-11-17');
    const after = F.due(ws, '2026-11-18');
    check('still due on the due date, overdue the day after', on.length === 1 && on[0].level === 'due' && after.length === 1 && after[0].level === 'overdue' && after[0].due === '2026-11-17', { on, after });
    check('count is 1 (on the first sale date and when overdue)', F.count(ws, '2026-11-02') === 1 && F.count(ws, '2026-11-18') === 1, [F.count(ws, '2026-11-02'), F.count(ws, '2026-11-18')]);
    check('facts, due and count write nothing to the workspace', J(ws) === before, J(ws).slice(0, 300));

    // The fifteenth day is a Saturday (first sale Friday 6 November 2026): due the Monday.
    const sat = threeSales('2026-11-06', '2026-11-09', '2026-11-10');
    const ds = F.due(sat, '2026-11-06');
    check('fifteenth day on Saturday 2026-11-21: due Monday 2026-11-23', ds.length === 1 && ds[0].due === '2026-11-23', ds);
    check('due from the first sale although the moved date is 17 days away; due through the weekend; overdue on the Tuesday', ds.length === 1 && ds[0].level === 'due' && F.due(sat, '2026-11-22')[0].level === 'due' && F.due(sat, '2026-11-23')[0].level === 'due' && F.due(sat, '2026-11-24')[0].level === 'overdue', [ds, F.due(sat, '2026-11-24')]);
    // The fifteenth day is Thanksgiving (first sale Wednesday 11 November 2026): due the Friday.
    const thx = threeSales('2026-11-11', '2026-11-12', '2026-11-13');
    const dt = F.due(thx, '2026-11-12');
    check('fifteenth day on Thanksgiving 2026-11-26: due Friday 2026-11-27', dt.length === 1 && dt[0].due === '2026-11-27', dt);

    // The sponsor's confirmed date wins over the suggestion.
    F.rec(ws, 'o1').firstSale = '2026-10-20';
    const dc = F.due(ws, '2026-11-02');
    check("the sponsor's confirmed first sale (2026-10-20) wins: due 2026-11-04, and facts gives the confirmed date", dc.length === 1 && dc[0].due === '2026-11-04' && F.facts(ws, ws.offerings[0]).firstSale === '2026-10-20', { dc, f: F.facts(ws, ws.offerings[0]).firstSale });
    check('overdue once the confirmed date has passed', F.due(ws, '2026-11-05')[0].level === 'overdue', F.due(ws, '2026-11-05'));

    // An accepted Form D removes the reminder.
    const n = F.recordFiled(ws, 'o1', { type: 'D', filedOn: '2026-11-10', accession: '0000000000-26-000001', source: 'portal' });
    const df = F.due(ws, '2026-11-12');
    check('recordFiled with an accepted D: no first Form D reminder, and nothing counted', !!n && n.status === 'accepted' && only(df, 'formd-first').length === 0 && F.count(ws, '2026-11-12') === 0, { n, df });
    const dr = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    F.rec(dr, 'o1').formD.push({ id: 'fd-x', type: 'D', status: 'submitted', filedOn: '', accession: '', snapshot: null, source: 'portal' });
    check('a notice sent but not yet accepted leaves the reminder in place', only(F.due(dr, '2026-11-10'), 'formd-first').length === 1, F.due(dr, '2026-11-10'));

    // Nothing for an offering under Regulation A, one marked as not filing, or one with no sale yet (Pitfall 12).
    const regA = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    regA.offerings[0].structure.exemption = 'Regulation A Tier 2';
    check('an offering under Regulation A produces nothing', F.applies(regA.offerings[0]) === false && J(F.due(regA, '2026-11-20')) === '[]' && F.count(regA, '2026-11-20') === 0, F.due(regA, '2026-11-20'));
    const none = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    F.rec(none, 'o1').mode = 'none';
    check('an offering with mode none produces nothing', J(F.due(none, '2026-11-20')) === '[]' && F.count(none, '2026-11-20') === 0, F.due(none, '2026-11-20'));
    const self = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    F.rec(self, 'o1').mode = 'self';
    check('a sponsor who files themselves (mode self) still gets the reminder', only(F.due(self, '2026-11-10'), 'formd-first').length === 1, F.due(self, '2026-11-10'));
    const noSale = WS([off('o1', 'Rule 506(c)')], [abroad('a')], [sub('r1', 'a', 'o1', 'pending', 5000000, undefined)]);
    check('an offering with no sale yet produces nothing (a pending subscription is not a sale)', F.applies(noSale.offerings[0]) === true && F.facts(noSale, noSale.offerings[0]).firstSale === '' && J(F.due(noSale, '2026-11-20')) === '[]', { f: F.facts(noSale, noSale.offerings[0]), d: F.due(noSale, '2026-11-20') });
  }
};

L.runParts(cases, { name: 'FILINGS MATH', unit: 'cases', flag: '--case', browser: false });
