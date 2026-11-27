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
const { loadPortal, sampleWorkspaces } = require('../../11-fund-accounting-and-cpa-year-end-package/checks/load11.js');

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
/**
 * Fund B (open-ended, as phase 11's posting check builds it, with no bank number): B-1 holds a position of 100,000.00
 * dated 2026-01-31 (paid by ACH) and redeems 2,000.00 at the 2026-12-31 dealing date, paid 2027-01-04.
 */
function fundB() {
  return {
    v: 2,
    tenant: { id: 'fund-b-sponsor', sample: false, name: 'Fund B Sponsor', shortName: 'Fund B Sponsor', legalName: 'Fund B Sponsor Management, LLC' },
    offerings: [
      {
        id: 'fund-b',
        name: 'Fund B, L.P.',
        shortName: 'Fund B',
        type: 'Hedge fund',
        status: 'Open',
        closeDate: '2026-01-31',
        exit: { basis: 'date', date: '2036-01-31', from: '', to: '', note: '' },
        distribution: { frequency: 'None', type: 'Redemption proceeds', target: '' },
        terms: [],
        accounting: { mgmtFee: '1.5', feeBasis: 'nav', carry: '0', pref: '0' }
      }
    ],
    investors: [
      { id: 'B-1', contact: 'Investor B', title: 'Investor B', type: 'individual', email: 'b-1@example.com', taxForm: 'W-9', payment: { method: 'ach', bank: { holder: 'Investor B', type: 'checking' } }, positions: [{ offeringId: 'fund-b', amount: 100000, date: '2026-01-31' }] }
    ],
    calls: [],
    runs: [],
    notices: [],
    requests: [{ id: 'req-b-1', type: 'redemption', offeringId: 'fund-b', investorId: 'B-1', cents: 200000, full: false, dealing: '2026-12-31', status: 'paid', decided: '2026-12-01', paid: '2027-01-04', paidCents: 200000 }],
    docs: []
  };
}
/** The fund's listed items without the day each was found. */
const exceptionsOf = (ws, oid) => ws.books.funds[oid].exceptions.map((x) => Object.assign({}, x, { found: undefined }));
const repaidBy = (how, on, fileId) => ({ how, on, by: 'Check Runner', at: `${on}T15:00:00.000Z`, fileId: fileId || '' });

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
  },

  /**
   * The same line paid again by check on 2026-12-23 (16-11 writes the block): repaid:fa-run-1:FA-1001 dated that day,
   * [2000 +600,000 FA-1001][1000 -600,000 FA-1001]; the ret: entry already posted stays; 2000 ends at 0 and cash at the
   * unreturned fund's 3,200,000.
   */
  repaid: ({ check }) => {
    const NS = load();
    const { ws, oid } = fundA(NS, (w) => (lineOf(w, RUN, WHO).ach = returned(RET_DATE, NET)));
    const src = `repaid:${RUN}:${WHO}`;
    const retE = live(NS, ws, oid, `ret:${RUN}:${WHO}`);
    check('the return was posted first', !!retE);
    const a = lineOf(ws, RUN, WHO).ach;
    a.status = 'repaid';
    a.repaid = repaidBy('check', '2026-12-23');
    const d = NS.books.desired(ws, oid, { today: TODAY }).filter((e) => e.src === src);
    check(`desired holds one ${src} dated 2026-12-23: [2000 +600,000 ${WHO}][1000 -600,000 ${WHO}]`, d.length === 1 && d[0].date === '2026-12-23' && J(d[0].lines) === J([['2000', NET, WHO], ['1000', -NET, WHO]]), shape(d));
    check(`its memo is 'Distribution paid again ${RUN}: ${WHO}'`, d.length === 1 && d[0].memo === `Distribution paid again ${RUN}: ${WHO}`, d[0] && d[0].memo);
    const r = NS.books.sync(ws, { today: TODAY });
    const retNow = live(NS, ws, oid, `ret:${RUN}:${WHO}`);
    check('sync posts the second payment only and reverses nothing (the ret: entry stays as posted)', r.posted === 1 && r.reversed === 0 && r.exceptions === 0 && !!live(NS, ws, oid, src) && !!retNow && !!retE && retNow.id === retE.id, r);
    check('2000 is -600,000 on 2026-12-22 and 0 at 2026-12-31', NS.books.balance(ws, oid, '2000', '2026-12-22') === -NET && NS.books.balance(ws, oid, '2000', '2026-12-31') === 0);
    check('cash at 2026-12-31 is 3,200,000, as before the return, and 600,000 higher in between', NS.books.balance(ws, oid, '1000', '2026-12-31') === 3200000 && NS.books.balance(ws, oid, '1000', '2026-12-22') - NS.books.balance(ws, oid, '1000', '2026-12-31') === NET);
    check('3100 stays at 900,000', NS.books.balance(ws, oid, '3100', '2026-12-31') === 900000);
  },

  /** The run cancelled after the return and the second payment: no ret: or repaid: entry is desired; sync reverses both and the run's. */
  cancelled: ({ check }) => {
    const NS = load();
    const { ws, oid } = fundA(NS, (w) => (lineOf(w, RUN, WHO).ach = returned(RET_DATE, NET, { status: 'repaid', repaid: repaidBy('ach', '2026-12-23', 'f-1') })));
    const srcs = [`run:${RUN}`, `ret:${RUN}:${WHO}`, `repaid:${RUN}:${WHO}`];
    check('the run, the return and the second payment were posted', srcs.every((s) => !!live(NS, ws, oid, s)));
    NS.data.cancelRun(ws, RUN, { by: 'Check Runner', at: ACTOR.at, why: 'Recorded in error' });
    const d = NS.books.desired(ws, oid, { today: TODAY });
    check('no run:, ret: or repaid: entry is desired', !d.some((e) => /^(ret|repaid|run):/.test(e.src)), d.map((e) => e.src));
    const r = NS.books.sync(ws, { today: TODAY });
    check('sync reverses the three and posts nothing', r.reversed === 3 && r.posted === 0, r);
    check('none of them is live afterwards', srcs.every((s) => !live(NS, ws, oid, s)));
    check('2000 ends at 0 and cash at 4,100,000 (nothing paid out)', NS.books.balance(ws, oid, '2000', '2026-12-31') === 0 && NS.books.balance(ws, oid, '1000', '2026-12-31') === 4100000, NS.books.balance(ws, oid, '1000', '2026-12-31'));
  },

  /**
   * Fund B's paid redemption returned on 2027-01-06 and paid again by ACH on 2027-01-12: reqret:req-b-1
   * [1000 +c B-1][2200 -c] and reqrepaid:req-b-1 [2200 +c][1000 -c B-1]; req: and reqpaid: are unchanged; 2200 is -c
   * between the two and 0 after.
   */
  redemption: ({ check }) => {
    const NS = load();
    const ws = fundB();
    const o = ws.offerings[0];
    const x = NS.audit.ledger(ws, o).redemptions[0];
    check('the engine redeems 200,000 at the dealing date, the amount paid', !!x && x.cents === 200000, x && x.cents);
    const before = shape(NS.books.desired(ws, o, { today: TODAY }));
    const q = ws.requests[0];
    q.ach = returned('2027-01-06', q.paidCents);
    const d1 = NS.books.desired(ws, o, { today: TODAY });
    const rr = d1.filter((e) => e.src === 'reqret:req-b-1');
    check('reqret:req-b-1 dated 2027-01-06: [1000 +200,000 B-1][2200 -200,000]', rr.length === 1 && rr[0].date === '2027-01-06' && J(rr[0].lines) === J([['1000', 200000, 'B-1'], ['2200', -200000]]), shape(rr));
    check("its memo is 'Returned redemption payment req-b-1: B-1'", rr.length === 1 && rr[0].memo === 'Returned redemption payment req-b-1: B-1', rr[0] && rr[0].memo);
    check('every other entry is as before the return (req: and reqpaid: included)', J(shape(d1.filter((e) => e.src !== 'reqret:req-b-1'))) === J(before), shape(d1));
    NS.books.sync(ws, { today: TODAY });
    check('2200 is -200,000 after the return', NS.books.balance(ws, 'fund-b', '2200', '2027-01-08') === -200000, NS.books.balance(ws, 'fund-b', '2200', '2027-01-08'));
    q.ach.status = 'repaid';
    q.ach.repaid = repaidBy('ach', '2027-01-12', 'f-2');
    const rp = NS.books.desired(ws, o, { today: TODAY }).filter((e) => e.src === 'reqrepaid:req-b-1');
    check('reqrepaid:req-b-1 dated 2027-01-12: [2200 +200,000][1000 -200,000 B-1]', rp.length === 1 && rp[0].date === '2027-01-12' && J(rp[0].lines) === J([['2200', 200000], ['1000', -200000, 'B-1']]), shape(rp));
    check("its memo is 'Redemption paid again req-b-1: B-1'", rp.length === 1 && rp[0].memo === 'Redemption paid again req-b-1: B-1', rp[0] && rp[0].memo);
    const r = NS.books.sync(ws, { today: TODAY });
    check('sync posts the second payment only', r.posted === 1 && r.reversed === 0 && r.exceptions === 0, r);
    check('2200 ends at 0, and 3100 at the 200,000 redeemed', NS.books.balance(ws, 'fund-b', '2200', '2027-01-31') === 0 && NS.books.balance(ws, 'fund-b', '3100', '2027-01-31') === 200000);
    check('no exception is listed', ws.books.funds['fund-b'].exceptions.length === 0, ws.books.funds['fund-b'].exceptions);
    const w2 = fundB();
    w2.requests[0].status = 'approved';
    delete w2.requests[0].paid;
    w2.requests[0].ach = returned('2027-01-06', 200000);
    check('a request not marked paid posts no return', !NS.books.desired(w2, 'fund-b', { today: TODAY }).some((e) => /^reqret:/.test(e.src)));
  },

  /** A return whose cents differ from the line's net (or the request's paid cents) is listed as 'amount' and posts nothing. */
  amount: ({ check }) => {
    const src = `ret:${RUN}:${WHO}`;
    [NET + 1, 0, -NET, String(NET), 6000.5].forEach((bad) => {
      const NS = load();
      const { ws, oid, r } = fundA(NS, (w) => (lineOf(w, RUN, WHO).ach = returned(RET_DATE, bad)));
      const ex = exceptionsOf(ws, oid);
      check(`ach.cents ${J(bad)}: no ret: entry, listed once as { src, kind: 'amount', account: '1000', value: '${String(bad)}' }`, !live(NS, ws, oid, src) && r.exceptions === 1 && J(ex) === J([{ src, kind: 'amount', account: '1000', value: String(bad) }]), ex);
      check(`ach.cents ${J(bad)}: the books are the unreturned fund's (cash 3,200,000, 2000 at 0)`, NS.books.balance(ws, oid, '1000', '2026-12-31') === 3200000 && NS.books.balance(ws, oid, '2000', '2026-12-31') === 0);
    });
    const NS = load();
    const { ws, oid } = fundA(NS, (w) => (lineOf(w, RUN, WHO).ach = returned(RET_DATE, NET)));
    const posted = live(NS, ws, oid, src);
    lineOf(ws, RUN, WHO).ach.cents = NET - 1;
    const r = NS.books.sync(ws, { today: TODAY });
    const now = live(NS, ws, oid, src);
    check('a posted return whose record then holds a wrong amount: its entry is left as it is and the record is listed', !!posted && !!now && now.id === posted.id && r.posted === 0 && r.reversed === 0 && r.exceptions === 1, r);
    const r2 = NS.books.sync(ws, { today: TODAY });
    check('syncing again lists nothing new', r2.posted === 0 && r2.reversed === 0 && r2.exceptions === 0, r2);
    const NSd = load();
    const D = fundA(NSd, (w) => (lineOf(w, RUN, WHO).ach = returned('2026-12-32', NET)));
    check("a return dated 2026-12-32 (no such day): nothing posted, sync does not stop, listed as { src, kind: 'date', value }", !live(NSd, D.ws, D.oid, src) && J(exceptionsOf(D.ws, D.oid)) === J([{ src, kind: 'date', value: '2026-12-32' }]), exceptionsOf(D.ws, D.oid));
    const NSe = load();
    const E = fundA(NSe, (w) => (lineOf(w, RUN, WHO).ach = returned(RET_DATE, NET, { status: 'repaid', repaid: repaidBy('check', '2026-12-23') })));
    lineOf(E.ws, RUN, WHO).ach.repaid.on = '23/12/2026';
    const rE = NSe.books.sync(E.ws, { today: TODAY });
    check("a second payment whose day is not a real date: the return stays posted, the second payment's entry is left and the record listed", !!live(NSe, E.ws, E.oid, src) && !!live(NSe, E.ws, E.oid, `repaid:${RUN}:${WHO}`) && rE.posted === 0 && rE.reversed === 0 && J(exceptionsOf(E.ws, E.oid)) === J([{ src: `repaid:${RUN}:${WHO}`, kind: 'date', value: '23/12/2026' }]), { rE, ex: exceptionsOf(E.ws, E.oid) });
    // The Audit page's 'books' check counts a 'date' refusal among the records that could not be posted.
    const unposted = (N, X) => {
      const c = N.audit.checks(X.ws, N.audit.period(X.ws, X.o, '2026-01-01', '2026-12-31'), { verify: N.audit.verify(X.ws) }).find((x) => x.id === 'books');
      return c ? c.items.filter((t) => /could not be posted/.test(t)) : null;
    };
    const uD = unposted(NSd, D);
    check("the Audit page's books check names the refused return: '1 records could not be posted to the books as recorded.'", J(uD) === J(['1 records could not be posted to the books as recorded.']), uD);
    const uE = unposted(NSe, E);
    check("the Audit page's books check names the refused second payment: '1 records could not be posted to the books as recorded.'", J(uE) === J(['1 records could not be posted to the books as recorded.']), uE);
    const wb = fundB();
    wb.requests[0].ach = returned('2027-01-06', 199999);
    NS.books.sync(wb, { today: TODAY });
    check("a redemption return of 199,999 against 200,000 paid: no reqret: entry, listed as 'amount'", !live(NS, wb, 'fund-b', 'reqret:req-b-1') && J(exceptionsOf(wb, 'fund-b')) === J([{ src: 'reqret:req-b-1', kind: 'amount', account: '1000', value: '199999' }]), exceptionsOf(wb, 'fund-b'));
  },

  /** December 2026 closed: a return dated 2026-12-17 is listed once as a closed-period difference and not posted. */
  closed: ({ check }) => {
    const NS = load();
    const { ws, oid } = fundA(NS);
    NS.books.close(ws, oid, '2026-12-31', ACTOR);
    const f = ws.books.funds[oid];
    const before = J(f.journal);
    lineOf(ws, RUN, WHO).ach = returned(RET_DATE, NET);
    const r = NS.books.sync(ws, { today: TODAY });
    const src = `ret:${RUN}:${WHO}`;
    check('nothing is posted or reversed (the journal is identical)', J(f.journal) === before && r.posted === 0 && r.reversed === 0, r);
    const want = { kind: 'closed', src, date: RET_DATE, wasDate: null, was: null, now: [['1000', NET, WHO], ['2000', -NET, WHO]], found: TODAY };
    check('fund.exceptions holds the one closed-period item for the return', f.exceptions.length === 1 && r.exceptions === 1 && J(f.exceptions[0]) === J(want), f.exceptions);
    const r2 = NS.books.sync(ws, { today: TODAY });
    check('syncing again lists it no second time', f.exceptions.length === 1 && r2.exceptions === 0 && r2.posted === 0 && J(f.journal) === before, r2);
  },

  /** Every kind posted, then a second sync: nothing posted, reversed or listed; ws.books identical. */
  idempotent: ({ check }) => {
    const NS = load();
    const { ws, oid } = fundA(NS, (w) => (lineOf(w, RUN, WHO).ach = returned(RET_DATE, NET, { status: 'repaid', repaid: repaidBy('wire', '2026-12-23') })));
    const before = J(ws.books);
    const r = NS.books.sync(ws, { today: TODAY });
    check('fund A with ret: and repaid: posted: a second sync posts, reverses and lists nothing; ws.books identical', !!live(NS, ws, oid, `ret:${RUN}:${WHO}`) && !!live(NS, ws, oid, `repaid:${RUN}:${WHO}`) && r.posted === 0 && r.reversed === 0 && r.exceptions === 0 && J(ws.books) === before, r);
    NS.books.desired(ws, oid, { today: TODAY }).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
    check('posting every desired entry again through NS.books.post adds nothing', J(ws.books) === before);
    const wb = fundB();
    wb.requests[0].ach = returned('2027-01-06', 200000, { status: 'repaid', repaid: repaidBy('ach', '2027-01-12', 'f-2') });
    const r1 = NS.books.sync(wb, { today: TODAY });
    const b2 = J(wb.books);
    const r2 = NS.books.sync(wb, { today: TODAY });
    check(`fund B with reqret: and reqrepaid: (first sync posted ${r1.posted}): the second posts nothing and ws.books is identical`, !!live(NS, wb, 'fund-b', 'reqret:req-b-1') && !!live(NS, wb, 'fund-b', 'reqrepaid:req-b-1') && r2.posted === 0 && r2.reversed === 0 && r2.exceptions === 0 && J(wb.books) === b2, r2);
  },

  /**
   * D-04: FA-1001 paid by wire (its bank on file kept), FA-1002 by ACH: the run's entry is [3100 +600,000 FA-1001]
   * [3100 +300,000 FA-1002][1000 -300,000] (the ACH total, FA-1002 only)[1000 -600,000 FA-1001] (the wire, its own
   * line); the statement's wire finds that line in reconciliation and the statement's ACH total the other.
   */
  wire: ({ check }) => {
    const NS = load();
    const { ws, oid } = fundA(NS, (w) => {
      w.investors.find((i) => i.id === 'FA-1001').payment.method = 'wire';
      w.investors.find((i) => i.id === 'FA-1002').payment = { method: 'ach', bank: { holder: 'Investor Two', type: 'checking' } };
    });
    const e = live(NS, ws, oid, `run:${RUN}`);
    check("the run's entry: the wire is its own cash line and the ACH total leaves it out", !!e && J(e.lines) === J([['3100', 600000, 'FA-1001'], ['3100', 300000, 'FA-1002'], ['1000', -300000], ['1000', -600000, 'FA-1001']]), e && e.lines);
    const acct = NS.books.bank.addAccount(ws, oid, { name: 'Operating', last4: '0001' });
    NS.books.bank.importLines(ws, oid, acct.id, { lines: [{ id: 'w1', date: '2026-12-15', cents: -600000, text: 'WIRE OUT INVESTOR ONE FA-1001' }, { id: 'a1', date: '2026-12-15', cents: -300000, text: 'ACH BATCH FUND A LP' }] }, { by: 'Check Runner', at: ACTOR.at });
    const cw = NS.books.bank.candidates(ws, oid, `${acct.id}:w1`);
    const ca = NS.books.bank.candidates(ws, oid, `${acct.id}:a1`);
    check('the statement wire of -600,000 has exactly the wire line as its candidate, named (rank 0)', !!e && cw.length === 1 && cw[0].entry === e.id && cw[0].line === 3 && cw[0].rank === 0, cw);
    check('the statement ACH total of -300,000 has exactly the ACH total line as its candidate', !!e && ca.length === 1 && ca[0].entry === e.id && ca[0].line === 2, ca);
  },

  /**
   * Phase 11's reconciliation, unchanged: the statement's return credit (+600,000 on 2026-12-17) has exactly the ret:
   * entry's cash line as its candidate, and match succeeds. Without the return posted it has none.
   */
  reconcile: ({ check }) => {
    const NS = load();
    const { ws, oid } = fundA(NS, (w) => (lineOf(w, RUN, WHO).ach = returned(RET_DATE, NET)));
    const retE = live(NS, ws, oid, `ret:${RUN}:${WHO}`);
    const stmt = { lines: [{ id: 'r1', date: RET_DATE, cents: NET, text: 'ACH RETURN R03 INVESTOR ONE FA-1001' }] };
    const acct = NS.books.bank.addAccount(ws, oid, { name: 'Operating', last4: '0001' });
    const imp = NS.books.bank.importLines(ws, oid, acct.id, stmt, { by: 'Check Runner', at: ACTOR.at });
    check('the statement line is imported', imp.added === 1, imp);
    const c = NS.books.bank.candidates(ws, oid, `${acct.id}:r1`);
    check("candidates gives exactly the ret: entry's cash line (line 0, +600,000, FA-1001, named)", !!retE && c.length === 1 && c[0].entry === retE.id && c[0].line === 0 && c[0].cents === NET && c[0].partner === WHO && c[0].rank === 0, c);
    let m = null;
    try {
      m = NS.books.bank.match(ws, oid, `${acct.id}:r1`, { entry: c[0].entry, line: c[0].line });
    } catch (err) {
      m = { error: String(err && err.message) };
    }
    check('match succeeds and posts nothing', !!m && !!m.match && !!retE && m.match.entry === retE.id && m.match.line === 0 && !live(NS, ws, oid, `bank:${acct.id}:r1`), m);
    const P = fundA(load());
    const a2 = NS.books.bank.addAccount(P.ws, P.oid, { name: 'Operating', last4: '0001' });
    NS.books.bank.importLines(P.ws, P.oid, a2.id, stmt, { by: 'Check Runner', at: ACTOR.at });
    check('without the return posted, the same statement line has no candidate', NS.books.bank.candidates(P.ws, P.oid, `${a2.id}:r1`).length === 0);
  },

  /**
   * 16-CONTEXT W2: a sample firm (Kestrel Bay, today 2026-11-19) with one paid line returned. Sample runs are saved
   * without stored lines, so both copies store the lines of kb-fund-ii-2024-12-20 first (NS.data.confirmLines); one copy
   * then has KBC-1001's line returned on 2024-12-24. After sync: the ret: entry is posted, every entry balances, the
   * unbalanced list and the exceptions of every fund are the unreturned copy's, cash is up by the net and 2000 down by
   * it, and no other account moves.
   */
  sample: ({ check }) => {
    const day = '2026-11-19';
    const RUNK = 'kb-fund-ii-2024-12-20';
    const WHOK = 'KBC-1001';
    const oid = 'kb-fund-ii';
    const NS = load(day);
    const copy = (ret) => {
      const ws = sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
      NS.data.confirmLines(ws, RUNK, { by: 'Check Runner', at: '2026-11-19T10:00:00.000Z' });
      const line = lineOf(ws, RUNK, WHOK);
      if (ret) line.ach = returned('2024-12-24', line.netCents);
      const r = NS.books.sync(ws, { today: day });
      return { ws, r, net: line.netCents };
    };
    const A = copy(false);
    const B = copy(true);
    const per = (S) => S.ws.offerings.map((o) => ({ oid: o.id, unbalanced: NS.books.desired(S.ws, o, { today: day }).unbalanced, exceptions: exceptionsOf(S.ws, o.id) }));
    console.log(`  kestrel-bay: net returned ${B.net} cents; posted ${A.r.posted} unreturned, ${B.r.posted} returned`);
    const e = live(NS, B.ws, oid, `ret:${RUNK}:${WHOK}`);
    check('the returned line has a net above zero and its ret: entry is posted', B.net > 0 && !!e && J(e.lines) === J([['1000', B.net, WHOK], ['2000', -B.net, WHOK]]), e);
    check('one more entry is posted than in the unreturned copy', B.r.posted === A.r.posted + 1, { A: A.r, B: B.r });
    const bad = [];
    B.ws.offerings.forEach((o) =>
      B.ws.books.funds[o.id].journal.forEach((x) => {
        const why = NS.books.check(x, NS.books.accounts(B.ws, o.id));
        if (why) bad.push(`${o.id} ${x.src}: ${why}`);
      })
    );
    check('every entry balances in whole cents on the fund chart', !bad.length, bad.slice(0, 5));
    check("the unbalanced list and the exceptions of every fund are the unreturned copy's", J(per(B)) === J(per(A)), { A: per(A), B: per(B) });
    const tA = tbOf(NS, A.ws, oid, day);
    const tB = tbOf(NS, B.ws, oid, day);
    check(`cash is up by the net (${B.net}) and 2000 down by it`, tB['1000'] - tA['1000'] === B.net && (tB['2000'] || 0) - (tA['2000'] || 0) === -B.net, { A: [tA['1000'], tA['2000']], B: [tB['1000'], tB['2000']] });
    const moved = Object.keys(Object.assign({}, tA, tB)).filter((c) => c !== '1000' && c !== '2000' && (tA[c] || 0) !== (tB[c] || 0));
    check('no other account moves', !moved.length, moved.map((c) => [c, tA[c], tB[c]]));
  }
};

L.runParts(cases, { name: 'POSTING RETURNS', unit: 'cases', flag: '--case' });
