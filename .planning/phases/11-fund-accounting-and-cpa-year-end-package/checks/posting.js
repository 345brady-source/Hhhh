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
const { loadPortal, sampleWorkspaces } = require('./load11.js');

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
/** The sum of the journal lines on one account, with NS.books.entries' filters (from, to, partner). */
const jsum = (NS, ws, oid, code, q) => NS.books.entries(ws, oid, Object.assign({ account: code }, q)).reduce((a, r) => a + r.cents, 0);

/**
 * Fund B (11-CONTEXT W4): an open-ended fund, one investor B-1 with a position of 100,000.00 dated 2026-01-31 (paid by
 * ACH), and one partial redemption of 2,000.00 at the 2026-06-30 dealing date, paid 2026-07-10 with paidCents as given.
 */
function fundB(paidCents) {
  return {
    v: 2,
    tenant: { id: 'fund-b-sponsor', sample: false, name: 'Fund B Sponsor', shortName: 'Fund B Sponsor', legalName: 'Fund B Sponsor Management, LLC', ach: { companyName: 'FUND B LP', companyId: '1000000002', odfiRouting: '044003186', odfiName: 'Sample Bank' } },
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
      {
        id: 'B-1',
        contact: 'Investor B',
        title: 'Investor B',
        type: 'individual',
        email: 'b-1@example.com',
        taxForm: 'W-9',
        payment: { method: 'ach', bank: { holder: 'Investor B', routing: '044003186', account: '20010001', type: 'checking' } },
        positions: [{ offeringId: 'fund-b', amount: 100000, date: '2026-01-31' }]
      }
    ],
    calls: [],
    runs: [],
    notices: [],
    requests: [{ id: 'req-b-1', type: 'redemption', offeringId: 'fund-b', investorId: 'B-1', cents: 200000, full: false, dealing: '2026-06-30', status: 'paid', decided: '2026-06-01', paid: '2026-07-10', paidCents }],
    docs: []
  };
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
  },

  /**
   * T4: each investor's contributions (3000) and distributions (3100) in the journal equal the capital-account engine's,
   * for 2026 and for Q4 2026, and the fund totals equal schedule 06's total row.
   *   2026: FA-1001 3000 -30,000,000 and engine contribution 30,000,000; FA-1002 -15,000,000 and 15,000,000;
   *         3100 FA-1001 +600,000 = engine distribution 600,000; FA-1002 +300,000 = 300,000.
   *   Q4 2026: contributions 0; distributions as above.
   */
  t4: ({ check }) => {
    const NS = load();
    const { ws, oid, o } = fundA(NS);
    const HAND = {
      '2026': { 'FA-1001': [30000000, 600000], 'FA-1002': [15000000, 300000] },
      Q4: { 'FA-1001': [0, 600000], 'FA-1002': [0, 300000] }
    };
    // Schedule 06 reads each investor's portal account; the fixture's investors have none, so they are given one here.
    ws.investors.forEach((i) => (i.onboarding = i.onboarding || { status: 'complete' }));
    [['2026', '2026-01-01', '2026-12-31'], ['Q4', '2026-10-01', '2026-12-31']].forEach(([name, from, to]) => {
      const P = NS.audit.period(ws, o, from, to);
      const rows = P.inv.map((a) => {
        const id = a.investor.id;
        return { id, journalContrib: -jsum(NS, ws, oid, '3000', { from: P.from, to: P.to, partner: id }), engineContrib: a.contrib, journalDist: jsum(NS, ws, oid, '3100', { from: P.from, to: P.to, partner: id }), engineDist: a.dist };
      });
      const hand = rows.every((r) => HAND[name][r.id] && r.journalContrib === HAND[name][r.id][0] && r.journalDist === HAND[name][r.id][1]);
      check(`${name}: each investor's 3000 and 3100 lines equal the engine's contributions and distributions`, rows.length === 2 && rows.every((r) => r.journalContrib === r.engineContrib && r.journalDist === r.engineDist), rows);
      check(`${name}: and they are the hand-worked figures`, hand, rows);
      const s6 = NS.audit.build(ws, o, from, to).list.find((s) => s.id === 'activity');
      const tc = -jsum(NS, ws, oid, '3000', { from: P.from, to: P.to });
      const td = jsum(NS, ws, oid, '3100', { from: P.from, to: P.to });
      check(`${name}: the fund's totals equal schedule 06's total row (contributions ${tc}, distributions ${td})`, s6 && s6.total && s6.total[4] === tc && s6.total[5] === -td, s6 && s6.total);
    });
  },

  /** Twelve fee entries of 150,000 (2% a year of 900,000.00 / 12), dated the month-ends, each month equal to the engine's fee. */
  fees: ({ check }) => {
    const NS = load();
    const { F, ws, oid, o } = fundA(NS);
    const fe = ws.books.funds[oid].journal.filter((e) => e.src.indexOf('fee:') === 0);
    check('twelve fee entries, each [5000 +150,000][2100 -150,000], dated the twelve month-ends', fe.length === 12 && fe.every((e) => J(e.lines) === J([['5000', 150000], ['2100', -150000]])) && J(fe.map((e) => e.date)) === J(F.expect.monthEnds), fe.map((e) => [e.src, e.date, e.lines]));
    const Lg = NS.audit.ledger(ws, o);
    const months = F.expect.monthEnds.map((end, i) => {
      const k = end.slice(0, 7);
      const prev = i ? F.expect.monthEnds[i - 1] : '2025-12-31';
      return { k, journal: NS.books.balance(ws, oid, '5000', end) - NS.books.balance(ws, oid, '5000', prev), engine: Lg.byKey[k] && Lg.byKey[k].fee };
    });
    check("each month's 5000 balance over the month equals the engine's fee for that month (150,000)", months.every((m) => m.journal === m.engine && m.journal === 150000), months);
  },

  /**
   * fa-run-1 recorded with $800.00 withheld from FA-1002 (backup): [3100 +600,000 FA-1001][3100 +300,000 FA-1002]
   * [2400 -80,000 FA-1002][1000 -600,000][1000 -220,000 FA-1002]; 2400 ends at -80,000; cash ends at 3,280,000
   * (3,200,000 + 80,000 not yet paid out).
   */
  withheld: ({ check }) => {
    const NS = load();
    const { ws, oid, o } = fundA(NS, {
      edit: (w) => {
        const l = w.runs[0].lines.find((x) => x.investorId === 'FA-1002');
        l.withheld = [{ kind: 'backup', cents: 80000, basisCents: 300000, ratePct: null, source: 'entered', why: 'No taxpayer number on file', confirmedBy: 'Check Runner', confirmedAt: '2026-12-15T15:00:00.000Z' }];
        l.netCents = 220000;
      }
    });
    const e = NS.books.live(ws.books.funds[oid], 'run:fa-run-1');
    check("the run's entry is the hand-worked one", e && J(e.lines) === J([['3100', 600000, 'FA-1001'], ['3100', 300000, 'FA-1002'], ['2400', -80000, 'FA-1002'], ['1000', -600000], ['1000', -220000, 'FA-1002']]), e && e.lines);
    check('2400 ends at -80,000, all of it FA-1002\'s', NS.books.balance(ws, oid, '2400', '2026-12-31') === -80000 && NS.books.balance(ws, oid, '2400', '2026-12-31', { partner: 'FA-1002' }) === -80000);
    check('cash ends at 3,280,000', NS.books.balance(ws, oid, '1000', '2026-12-31') === 3280000, NS.books.balance(ws, oid, '1000', '2026-12-31'));
    const P = NS.audit.period(ws, o, '2026-01-01', '2026-12-31');
    check("3100 stays at the gross amounts the engine counts (600,000 and 300,000)", P.inv.every((a) => jsum(NS, ws, oid, '3100', { partner: a.investor.id }) === a.dist) && jsum(NS, ws, oid, '3100', {}) === 900000);

    // A stored line for FA-1003, who is not on the register (11-CONTEXT W3): the engine keeps it in L.strays; it is
    // posted to 3100 with its investor id, paid otherwise than by ACH, and listed in fund.exceptions.
    const NS2 = load();
    const S = fundA(NS2, { others: false, edit: (w) => w.runs[0].lines.push({ investorId: 'FA-1003', grossCents: 50000, withheld: [], netCents: 50000 }) });
    const e2 = NS2.books.live(S.ws.books.funds[S.oid], 'run:fa-run-1');
    check('a stray line: [3100 +50,000 FA-1003] and [1000 -50,000 FA-1003] are in the run\'s entry', NS2.audit.ledger(S.ws, S.o).strays.length === 1 && e2 && J(e2.lines) === J([['3100', 600000, 'FA-1001'], ['3100', 300000, 'FA-1002'], ['3100', 50000, 'FA-1003'], ['1000', -600000], ['1000', -300000, 'FA-1002'], ['1000', -50000, 'FA-1003']]), e2 && e2.lines);
    const ex = S.ws.books.funds[S.oid].exceptions;
    check("and it is listed once in fund.exceptions as { src, kind: 'stray', investorId, cents }", ex.length === 1 && ex[0].src === 'run:fa-run-1' && ex[0].kind === 'stray' && ex[0].investorId === 'FA-1003' && ex[0].cents === 50000 && S.r.exceptions === 1, ex);
    const r2 = NS2.books.sync(S.ws, { today: TODAY });
    check('a second sync does not list it again', r2.exceptions === 0 && S.ws.books.funds[S.oid].exceptions.length === 1, r2);
  },

  /** fa-run-1 with gp 100,000 ($1,000.00): the entry adds [3300 +100,000][1000 -100,000]; cash ends at 3,100,000; 3300 at +100,000. */
  gp: ({ check }) => {
    const NS = load();
    const { ws, oid } = fundA(NS, {
      edit: (w) => {
        w.runs[0].gp = 100000;
        w.runs[0].gross = 1000000;
      }
    });
    const e = NS.books.live(ws.books.funds[oid], 'run:fa-run-1');
    check("the run's entry adds the general partner's lines", e && J(e.lines) === J([['3100', 600000, 'FA-1001'], ['3100', 300000, 'FA-1002'], ['1000', -600000], ['1000', -300000, 'FA-1002'], ['3300', 100000], ['1000', -100000]]), e && e.lines);
    check('cash ends at 3,100,000', NS.books.balance(ws, oid, '1000', '2026-12-31') === 3100000, NS.books.balance(ws, oid, '1000', '2026-12-31'));
    check('3300 ends at +100,000', NS.books.balance(ws, oid, '3300', '2026-12-31') === 100000);
  },

  /** With fund.start 2026-02-01: no call entry (January) and eleven fee entries; nothing dated before the start. */
  start: ({ check }) => {
    const NS = load();
    const F = fixture();
    const ws = F.records;
    const oid = F.expect.offeringId;
    ws.books.funds[oid].start = '2026-02-01';
    const d = NS.books.desired(ws, oid, { today: TODAY });
    check('no call entry', !d.some((e) => e.src.indexOf('call:') === 0), d.map((e) => e.src));
    check('eleven fee entries (February to December)', d.filter((e) => e.src.indexOf('fee:') === 0).length === 11);
    check('the distribution is still there and nothing is dated before 2026-02-01', d.some((e) => e.src === 'run:fa-run-1') && d.every((e) => e.date >= '2026-02-01') && d.length === 12, d.length);
  },

  /**
   * Fund B (open-ended), worked by hand (11-CONTEXT W4): B-1's position of 100,000.00 dated 2026-01-31 gives
   * pos:B-1:2026-01-31:0 [1000 +10,000,000][3000 -10,000,000 B-1]; a partial redemption of 2,000.00 at the dealing date
   * 2026-06-30, paid 2026-07-10 with paidCents 200,000, gives req: [3100 +200,000 B-1][2200 -200,000] and
   * reqpaid: [2200 +200,000][1000 -200,000 B-1]; 2200 ends at 0. When paidCents is more than the engine's redemption, the
   * engine's cents are posted and the difference is listed in fund.exceptions.
   */
  redeem: ({ check }) => {
    const NS = load();
    const ws = fundB(200000);
    const d = NS.books.desired(ws, 'fund-b', { today: TODAY });
    const pick = (src) => shape(d.filter((e) => e.src === src));
    check('pos:B-1:2026-01-31:0 is [1000 +10,000,000][3000 -10,000,000 B-1]', J(pick('pos:B-1:2026-01-31:0')) === J([{ src: 'pos:B-1:2026-01-31:0', date: '2026-01-31', lines: [['1000', 10000000], ['3000', -10000000, 'B-1']] }]), d.map((e) => e.src));
    check('req:req-b-1 is [3100 +200,000 B-1][2200 -200,000] at the dealing date', J(pick('req:req-b-1')) === J([{ src: 'req:req-b-1', date: '2026-06-30', lines: [['3100', 200000, 'B-1'], ['2200', -200000]] }]), pick('req:req-b-1'));
    check('reqpaid:req-b-1 is [2200 +200,000][1000 -200,000 B-1] on the day paid', J(pick('reqpaid:req-b-1')) === J([{ src: 'reqpaid:req-b-1', date: '2026-07-10', lines: [['2200', 200000], ['1000', -200000, 'B-1']] }]), pick('reqpaid:req-b-1'));
    NS.books.sync(ws, { today: TODAY });
    check('2200 is -200,000 at the dealing date and ends at 0', NS.books.balance(ws, 'fund-b', '2200', '2026-06-30') === -200000 && NS.books.balance(ws, 'fund-b', '2200', '2026-12-31') === 0);
    check('no exception for a payment equal to the redemption', ws.books.funds['fund-b'].exceptions.length === 0, ws.books.funds['fund-b'].exceptions);

    const NS2 = load();
    const w2 = fundB(20000000);
    const o2 = w2.offerings[0];
    const x = NS2.audit.ledger(w2, o2).redemptions[0];
    console.log(`  fund B with paidCents 20,000,000: the engine redeems ${x ? x.cents : 'nothing'} cents (B-1's whole capital at 2026-06-30)`);
    const d2 = NS2.books.desired(w2, o2, { today: TODAY });
    const rp = d2.find((e) => e.src === 'reqpaid:req-b-1');
    check("paid more than the engine's redemption: reqpaid posts the engine's cents", x && x.cents > 0 && x.cents < 20000000 && rp && J(rp.lines) === J([['2200', x.cents], ['1000', -x.cents, 'B-1']]), rp && rp.lines);
    NS2.books.sync(w2, { today: TODAY });
    const ex = w2.books.funds['fund-b'].exceptions;
    check('and the difference is listed in fund.exceptions', x && ex.length === 1 && ex[0].src === 'reqpaid:req-b-1' && ex[0].kind === 'overpaid' && ex[0].investorId === 'B-1' && ex[0].cents === 20000000 - x.cents, ex);
    check('2200 still ends at 0', NS2.books.balance(w2, 'fund-b', '2200', '2026-12-31') === 0);
  },

  /**
   * All 15 sample funds (today 2026-11-19): every entry balances; the journal holds exactly what desired holds; for the
   * inception-to-date preset each investor's 3000 and 3100 lines equal the engine's contributions and distributions
   * (investors in L.invs only, 11-CONTEXT W3); each redemption has one req entry with its cents and one reqpaid when paid.
   */
  samples: ({ check }) => {
    const day = '2026-11-19';
    const NS = load(day);
    const wss = sampleWorkspaces(NS);
    check('four sample firms with 15 funds', wss.length === 4 && wss.reduce((a, w) => a + w.offerings.length, 0) === 15);
    wss.forEach((ws) => {
      const r = NS.books.sync(ws, { today: day });
      const bad = [];
      const count = [];
      const tie = [];
      const red = [];
      let entries = 0;
      let strays = 0;
      let invs = 0;
      ws.offerings.forEach((o) => {
        const oid = o.id;
        const f = ws.books && ws.books.funds && ws.books.funds[oid];
        const j = f ? f.journal : [];
        entries += j.length;
        const accts = NS.books.accounts(ws, oid);
        j.forEach((e) => {
          const why = NS.books.check(e, accts);
          if (why) bad.push(`${oid} ${e.src}: ${why}`);
        });
        const d = NS.books.desired(ws, o, { today: day });
        if (J(d.map((e) => e.src).sort()) !== J(j.map((e) => e.src).sort())) count.push(`${oid}: desired ${d.length}, journal ${j.length}`);
        const pre = NS.audit.presets(ws, o).find((p) => p.id === 'itd');
        const P = NS.audit.period(ws, o, pre.from, pre.to);
        strays += (P.L.strays || []).length;
        P.inv.forEach((a) => {
          invs++;
          const id = a.investor.id;
          const c = -jsum(NS, ws, oid, '3000', { from: P.from, to: P.to, partner: id });
          const di = jsum(NS, ws, oid, '3100', { from: P.from, to: P.to, partner: id });
          if (c !== a.contrib || di !== a.dist) tie.push(`${oid} ${id}: journal ${c}/${di}, engine ${a.contrib}/${a.dist}`);
        });
        P.L.redemptions.forEach((x) => {
          const q = x.req;
          const rq = j.filter((e) => e.src === 'req:' + q.id);
          const rp = j.filter((e) => e.src === 'reqpaid:' + q.id);
          const okReq = rq.length === 1 && J(rq[0].lines) === J([['3100', x.cents, x.inv.id], ['2200', -x.cents]]) && rq[0].date === q.dealing;
          const okPaid = q.status === 'paid' && q.paid ? rp.length === 1 && J(rp[0].lines) === J([['2200', x.cents], ['1000', -x.cents, x.inv.id]]) && rp[0].date === q.paid : rp.length === 0;
          red.push({ src: q.id, cents: x.cents, paid: q.paid || '', ok: okReq && okPaid });
        });
      });
      console.log(`  ${ws.tenant.id}: ${entries} entries (posted ${r.posted}), ws.books ${Buffer.byteLength(J(ws.books))} bytes, ${strays} stray line(s), ${red.length} redemption(s), ${invs} investor accounts compared`);
      check(`${ws.tenant.id}: every entry balances in whole cents on the fund's chart`, !bad.length && entries > 0 && r.posted === entries, bad.slice(0, 5));
      check(`${ws.tenant.id}: the journal holds exactly the entries the records call for`, !count.length, count);
      check(`${ws.tenant.id}: inception to date, each investor's 3000 and 3100 lines equal the engine's contributions and distributions`, !tie.length, tie.slice(0, 5));
      check(`${ws.tenant.id}: each redemption has one req entry with its cents and one reqpaid entry when paid`, red.every((x) => x.ok), red);
    });
  },

  /** Posting writes no change-log entry and changes nothing in the workspace outside ws.books. */
  nolog: ({ check }) => {
    const day = '2026-11-19';
    const NS = load(day);
    const ws = sampleWorkspaces(NS).find((w) => w.tenant.id === 'pellbrook');
    NS.audit.ensureLog(ws);
    const n = ws.audit.length;
    const last = J(ws.audit[n - 1]);
    const rest = J(Object.assign({}, ws, { books: undefined }));
    let logs = 0;
    const orig = NS.audit.log;
    NS.audit.log = function () {
      logs++;
      return orig.apply(this, arguments);
    };
    const r = NS.books.sync(ws, { today: day });
    check('the sync posted entries', r.posted > 0, r);
    check('ws.audit has the same length and the same last entry (and its hash)', n > 0 && ws.audit.length === n && J(ws.audit[n - 1]) === last, { n, now: ws.audit.length });
    check('NS.audit.log was not called', logs === 0, logs);
    check('the workspace without ws.books is exactly as before', J(Object.assign({}, ws, { books: undefined })) === rest);
  }
};

L.runParts(cases, { name: 'POSTING', unit: 'cases', flag: '--case' });
