// gate: node
// last "POSTING RETURNS: PASS (cases run: 10)"
// The books for a payment the bank sends back (plan 16-04, AC-10, C-07; no browser). A returned distribution line is
// cash back in and an amount owed to that investor in 2000 until it is paid again; a returned redemption payment goes
// back to 2200. Posted from the record once (assets/js/books-post.js), with gross, withheld and net never changing.
// The portal is loaded with phase 11's load11.js (edition diy, today 2027-01-20, the books, posting, bank file and bank
// reconciliation modules) on phase 11's hand-worked fund A; the ach blocks of 16-04's interfaces are written into the
// workspace copy by this check itself (16-08 writes them when a return is applied; 16-11 and 16-12 the second payment).
// Fund A's distribution fa-run-1 is paid 2026-12-15; FA-1001 is its ACH payee (net 600,000), FA-1002 is paid by check.
// The return is dated 2026-12-17, two banking days after the payment (an R03 comes back within two banking days).
// No bank number is written here: the books never read one.
//   node posting-returns.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "POSTING RETURNS: PASS (cases run: N)" or
// "POSTING RETURNS: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal } = require('../../11-fund-accounting-and-cpa-year-end-package/checks/load11.js');

const TODAY = '2027-01-20';
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
const EXTRA = ['books.js', 'books-post.js', 'bankfiles.js', 'books-bank.js'];
const J = (x) => JSON.stringify(x);
const RUN = 'fa-run-1';
const WHO = 'FA-1001';
const NET = 600000;
const RET_DATE = '2026-12-17';

function load(today) {
  const NS = loadPortal(undefined, { today: today || TODAY, edition: 'diy', extra: EXTRA });
  if (!NS.books || typeof NS.books.desired !== 'function' || typeof NS.books.sync !== 'function') throw new Error('assets/js/books-post.js did not add NS.books.desired and NS.books.sync');
  if (!NS.books.bank || typeof NS.books.bank.candidates !== 'function') throw new Error('assets/js/books-bank.js did not add NS.books.bank');
  return NS;
}
/** A fresh copy of phase 11's hand-worked fund A. */
function fixture() {
  return JSON.parse(JSON.stringify(require('../../11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-a.js')));
}
/** The return block 16-08 writes on a line (16-04 interfaces). */
function returned(date, cents, extra) {
  return Object.assign({ status: 'returned', code: 'R03', date, cents, trace: '190000010000001', by: 'Check Runner', at: `${date}T15:00:00.000Z`, source: 'nacha', repaid: null }, extra || {});
}
const lineOf = (ws, runId, id) => ws.runs.find((r) => r.id === runId).lines.find((l) => l.investorId === id);
const byDateSrc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.src < b.src ? -1 : a.src > b.src ? 1 : 0);
const shape = (list) => list.map((e) => ({ src: e.src, date: e.date, lines: e.lines }));
/** The trial balance through a day as { code: end }. */
function tbOf(NS, ws, oid, to) {
  const out = {};
  NS.books.trialBalance(ws, oid, '2026-01-01', to).forEach((x) => (out[x.code] = x.end));
  return out;
}
const live = (NS, ws, oid, src) => NS.books.live(ws.books.funds[oid], src);
/** Fund A: the records synced (with an edit first), then the fixture's bank lines and valuations posted. */
function fundA(NS, edit) {
  const F = fixture();
  const ws = F.records;
  const oid = F.expect.offeringId;
  const o = ws.offerings.find((x) => x.id === oid);
  if (edit) edit(ws, F);
  const r = NS.books.sync(ws, { today: TODAY });
  F.entries.forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  return { F, ws, oid, o, r };
}

const cases = {
  /**
   * Task 1 (tracer): FA-1001's line of fa-run-1 returned R03 on 2026-12-17. desired holds ret:fa-run-1:FA-1001 dated the
   * return day, [1000 +600,000 FA-1001][2000 -600,000 FA-1001]; the run's own entry is the fixture's, unchanged; after
   * sync 2000 is -600,000, cash 3,800,000 (3,200,000 + 600,000), 3100 and 2400 unchanged, and the capital accounts are
   * exactly those of the unreturned fund.
   */
  returned: ({ check }) => {
    const NS = load();
    const F = fixture();
    const ws = F.records;
    const oid = F.expect.offeringId;
    const o = ws.offerings.find((x) => x.id === oid);
    lineOf(ws, RUN, WHO).ach = returned(RET_DATE, NET);
    const d = NS.books.desired(ws, o, { today: TODAY });
    const src = `ret:${RUN}:${WHO}`;
    const ret = d.filter((e) => e.src === src);
    check(`desired holds one ${src} dated ${RET_DATE}: [1000 +600,000 ${WHO}][2000 -600,000 ${WHO}]`, ret.length === 1 && ret[0].date === RET_DATE && J(ret[0].lines) === J([['1000', NET, WHO], ['2000', -NET, WHO]]), shape(ret));
    check(`its memo is 'Returned distribution ${RUN}: ${WHO}'`, ret.length === 1 && ret[0].memo === `Returned distribution ${RUN}: ${WHO}`, ret[0] && ret[0].memo);
    const want = F.recordEntries.slice().sort(byDateSrc);
    check("every other desired entry is the fixture's, unchanged (the run's own entry included: 3100 gross, 1000 paid)", J(shape(d.filter((e) => e.src !== src))) === J(shape(want)), shape(d.filter((e) => e.src !== src)));
    const r = NS.books.sync(ws, { today: TODAY });
    check('sync posts the 15 record entries and the return, reverses nothing and lists nothing', r.posted === 16 && r.reversed === 0 && r.exceptions === 0, r);
    F.entries.forEach((e) => NS.books.post(ws, oid, e, ACTOR));
    const tb = tbOf(NS, ws, oid, '2026-12-31');
    const plain = fundA(load());
    const tb0 = tbOf(NS, plain.ws, plain.oid, '2026-12-31');
    check('2026 trial balance: 2000 is -600,000, all of it owed to FA-1001', tb['2000'] === -NET && NS.books.balance(ws, oid, '2000', '2026-12-31', { partner: WHO }) === -NET, tb);
    check('cash is 3,800,000: the unreturned 3,200,000 plus the 600,000 that came back', tb['1000'] === 3800000 && tb0['1000'] === 3200000, { now: tb['1000'], before: tb0['1000'] });
    check('3100 (gross) and 2400 (withheld) are exactly as in the unreturned fund', tb['3100'] === tb0['3100'] && tb['3100'] === 900000 && (tb['2400'] || 0) === (tb0['2400'] || 0), { now: [tb['3100'], tb['2400']], before: [tb0['3100'], tb0['2400']] });
    const other = Object.keys(Object.assign({}, tb, tb0)).filter((c) => c !== '1000' && c !== '2000' && (tb[c] || 0) !== (tb0[c] || 0));
    check('no other account moves', !other.length, other);
    const sum = Object.keys(tb).reduce((a, c) => a + tb[c], 0);
    check('debits equal credits', sum === 0, sum);
    NS.clearCaches();
    const cap = (N, w) => N.audit.period(w, w.offerings[0], '2026-01-01', '2026-12-31').inv.map((a) => ({ id: a.investor.id, contrib: a.contrib, dist: a.dist }));
    check("the capital accounts' contributions and distributions are those of the unreturned fund (600,000 and 300,000 distributed)", J(cap(NS, ws)) === J(cap(NS, plain.ws)) && cap(NS, ws).map((a) => a.dist).join() === '600000,300000', cap(NS, ws));
  }
};

L.runParts(cases, { name: 'POSTING RETURNS', unit: 'cases', flag: '--case' });
