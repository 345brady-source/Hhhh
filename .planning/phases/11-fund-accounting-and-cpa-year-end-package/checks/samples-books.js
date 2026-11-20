// gate: node
// last "SAMPLES BOOKS: PASS (cases run: 7)"
// Sample funds through the same ledger (plan 11-09, FA-03, no browser): each month of a sample fund carries one sample
// entry (src sim:<offeringId>:<YYYY-MM>) holding the generator's income and gain, which moves the balance sheet to the
// one the Audit page already shows. Then the journal's net assets equal the limited partners' capital plus the general
// partner's accrued share at every month-end (T3), and the trial balance sums to zero. The portal is loaded inside each
// case with load11.js (the scripts diy.html lists, then books.js and books-post.js) and its sampleWorkspaces, today
// 2026-11-19, self-serve edition.
//   node samples-books.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "SAMPLES BOOKS: PASS (cases run: N)" or
// "SAMPLES BOOKS: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal, sampleWorkspaces } = require('./load11.js');

const DAY = '2026-11-19';
const AT = '2026-11-19T10:00:00.000Z';
const J = (x) => JSON.stringify(x);
const n = (c) => String(c).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** The portal with the journal and the posting module, loaded inside the case. */
function load() {
  const NS = loadPortal(undefined, { today: DAY, extra: ['books.js', 'books-post.js'] });
  if (!NS.books || typeof NS.books.desired !== 'function' || typeof NS.books.sync !== 'function') throw new Error('assets/js/books-post.js did not add NS.books.desired and NS.books.sync');
  return NS;
}
const sync = (NS, ws) => NS.books.sync(ws, { today: DAY, at: AT });
function endOf(k) {
  const [y, m] = k.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
/** Live entries of a fund (not reversed, not a reversal). */
function liveOf(ws, oid) {
  const f = ws.books && ws.books.funds && ws.books.funds[oid];
  const j = f && Array.isArray(f.journal) ? f.journal : [];
  const reversed = new Set(j.filter((e) => e.rev).map((e) => e.rev));
  return j.filter((e) => !e.rev && !reversed.has(e.id));
}

/**
 * T3 for one sample fund at every month-end of its ledger: one live sim entry per month (dated the month-end, balancing
 * by itself), journal net assets = LP capital + the GP's accrued share, 1000 = H.cash, 1100 + 1150 = H.longFV,
 * 2100 = -H.feePayable, the trial balance sums to zero; desired.unbalanced is empty. Returns { months, bad: [...] }.
 */
function tie(NS, ws, o) {
  const oid = o.id;
  const bad = [];
  const L = NS.audit.ledger(ws, o);
  const d = NS.books.desired(ws, o, { today: DAY });
  if (!Array.isArray(d.unbalanced)) bad.push(`${oid}: desired has no unbalanced list`);
  else if (d.unbalanced.length) bad.push(`${oid}: unbalanced ${J(d.unbalanced.slice(0, 3))}${d.unbalanced.length > 3 ? ` and ${d.unbalanced.length - 3} more` : ''}`);
  const live = liveOf(ws, oid);
  const sims = live.filter((e) => /^sim:/.test(e.src));
  const stray = sims.filter((e) => e.src.indexOf(`sim:${oid}:`) !== 0 || L.keys.indexOf(e.src.slice(oid.length + 5)) < 0);
  if (stray.length) bad.push(`${oid}: sim entries for no month of the fund: ${stray.slice(0, 3).map((e) => e.src).join(', ')}`);
  const al = NS.books
    .accounts(ws, oid)
    .filter((a) => a.type === 'asset' || a.type === 'liability')
    .map((a) => a.code);
  L.keys.forEach((k) => {
    const E = endOf(k);
    const mine = sims.filter((e) => e.src === `sim:${oid}:${k}`);
    if (mine.length !== 1) bad.push(`${oid} ${k}: ${mine.length} sim entries`);
    else if (mine[0].date !== E || mine[0].lines.reduce((a, l) => a + l[1], 0) !== 0) bad.push(`${oid} ${k}: the sim entry is dated ${mine[0].date} or does not balance`);
    const P = NS.audit.period(ws, o, k + '-01', E);
    const H = P.hold;
    const got = {
      na: NS.books.balance(ws, oid, al, E),
      cash: NS.books.balance(ws, oid, '1000', E),
      inv: NS.books.balance(ws, oid, ['1100', '1150'], E),
      fee: NS.books.balance(ws, oid, '2100', E),
      tb: NS.books.trialBalance(ws, oid, '', E).reduce((a, r) => a + r.end, 0)
    };
    const want = { na: P.fund.end + P.fund.gpEnd, cash: H.cash, inv: H.longFV, fee: -H.feePayable, tb: 0 };
    if (J(got) !== J(want)) bad.push(`${oid} ${k}: journal ${J(got)} engine ${J(want)}`);
  });
  return { months: L.keys.length, bad };
}
const show = (check, name, r, extra) => check(name, r.bad.length === 0, r.bad.length ? `${r.bad.length} problems; first: ${r.bad.slice(0, 4).join(' | ')}` : extra);

const cases = {
  /** Kestrel Bay's fund ii: a balancing sample entry every month; the journal ties to its capital accounts at every month-end. */
  kestrel: ({ check }) => {
    const NS = load();
    const ws = sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
    const o = ws && ws.offerings.find((x) => x.id === 'kb-fund-ii');
    check('Kestrel Bay and its fund ii are in the sample firms', !!o);
    if (!o) return;
    const r = sync(NS, ws);
    const L = NS.audit.ledger(ws, o);
    const first = liveOf(ws, o.id).find((e) => e.src === `sim:${o.id}:${L.keys[0]}`);
    if (first) {
      console.log(`  first sample entry of kb-fund-ii: ${first.src}, dated ${first.date}, memo "${first.memo}"`);
      first.lines.forEach((l) => console.log(`    ${l[0]} ${l[1] > 0 ? 'debit ' : 'credit'} ${n(Math.abs(l[1]))}`));
      console.log(`    sum ${first.lines.reduce((a, l) => a + l[1], 0)}`);
    }
    check('the first sync posted entries', r.posted > 0, r);
    show(check, `kb-fund-ii ties at all ${L.keys.length} month-ends (${L.keys[0]} to ${L.keys[L.keys.length - 1]}): T3, 1000, 1100 + 1150, 2100, the trial balance`, tie(NS, ws, o));
  },

  /** A second sync of every sample firm posts and reverses nothing and leaves the books identical (11-CONTEXT B1). */
  repeat: ({ check }) => {
    const NS = load();
    const wss = sampleWorkspaces(NS);
    let sims = 0;
    wss.forEach((ws) => {
      sync(NS, ws);
      const before = J(ws.books);
      ws.offerings.forEach((o) => (sims += liveOf(ws, o.id).filter((e) => /^sim:/.test(e.src)).length));
      const r = sync(NS, ws);
      check(`${ws.tenant.id}: a second sync posts and reverses nothing; the books are identical`, r.posted === 0 && r.reversed === 0 && J(ws.books) === before, r);
    });
    check('the books held sample entries when synced again', sims > 0, { sims });
  }
};

L.runParts(cases, { name: 'SAMPLES BOOKS', unit: 'cases', flag: '--case' });
