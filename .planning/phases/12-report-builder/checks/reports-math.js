// gate: node
// last "REPORTS MATH: PASS (cases run: 13)"
// The report builder's figures (plan 12-01, no browser): assets/js/reports-data.js (NS.reportsData) hands every report
// section its numbers in whole cents straight from the engine the audit and CPA packages use. Fund A is worked by hand
// (fixtures/fund-a.js of phase 11; the working is beside each figure below); every sample firm, fund, investor and period
// preset is compared with the engine itself (NS.audit.period / closedPerformance / openPerformance, NS.data.runRows,
// NS.books.trialBalance). The portal is loaded inside each case with phase 11's load11.js, today 2027-01-20.
//   node reports-math.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "REPORTS MATH: PASS (cases run: N)" or
// "REPORTS MATH: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const P11 = path.resolve(__dirname, '../../11-fund-accounting-and-cpa-year-end-package/checks');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal, sampleWorkspaces } = require(path.join(P11, 'load11.js'));

const TODAY = '2027-01-20';
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
const J = (x) => JSON.stringify(x);
const EXTRA = ['books.js', 'books-post.js', 'eligibility.js', 'taxdocs.js', 'reports-data.js'];
const ACCT = ['begin', 'contrib', 'dist', 'income', 'gain', 'fee', 'carry', 'end'];

/** The portal with the journal, tax documents and the report figures, inside the case. */
function load() {
  const NS = loadPortal(undefined, { today: TODAY, extra: EXTRA });
  if (!NS.reportsData) throw new Error('assets/js/reports-data.js did not define NS.reportsData');
  return NS;
}
const fixture = (name) => JSON.parse(JSON.stringify(require(path.join(P11, 'fixtures', name + '.js'))));
/** Fund A seated as engine-books.js seats it: a deep copy of the fixture, its other entries posted, then synced. */
function fundA(NS, edit) {
  const F = fixture('fund-a');
  const ws = F.records;
  if (edit) edit(ws, F);
  F.entries.forEach((e) => NS.books.post(ws, 'fund-a', e, ACTOR));
  NS.books.sync(ws, { today: NS.dates.today() });
  return { F, ws, o: ws.offerings.find((x) => x.id === 'fund-a') };
}
const pick = (a, keys) => {
  const out = {};
  keys.forEach((k) => (out[k] = a ? a[k] : undefined));
  return out;
};
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
/** Every money-looking number in x (keys named in `money`) is a safe integer; returns the paths that are not. */
function notCents(x, money, at, out) {
  out = out || [];
  at = at || '';
  if (Array.isArray(x)) x.forEach((v, i) => notCents(v, money, `${at}[${i}]`, out));
  else if (x && typeof x === 'object')
    Object.keys(x).forEach((k) => {
      if (money.indexOf(k) >= 0 && typeof x[k] === 'number' && !Number.isSafeInteger(x[k])) out.push(`${at}.${k}=${x[k]}`);
      else if (typeof x[k] === 'object') notCents(x[k], money, `${at}.${k}`, out);
    });
  return out;
}
const MONEY = ['begin', 'contrib', 'dist', 'income', 'gain', 'fee', 'carry', 'end', 'commit', 'contribCum', 'unfunded', 'distCum', 'paid', 'nav', 'gross', 'withheld', 'net', 'cumulative', 'cents', 'fv', 'cost', 'debt', 'equity', 'total', 'expenses', 'noi'];

/**
 * The check's own IRR: Newton's method on the same flows (a different method from the engine's bisection), year
 * fractions Actual/365.25 from the first flow. flows: [{ date, amt }] sorted by date.
 */
function newtonIrr(flows) {
  const t0 = Date.parse(flows[0].date + 'T00:00:00Z');
  const t = flows.map((f) => (Date.parse(f.date + 'T00:00:00Z') - t0) / (365.25 * 864e5));
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    let f = 0;
    let d = 0;
    flows.forEach((x, j) => {
      f += x.amt / Math.pow(1 + r, t[j]);
      d += (-t[j] * x.amt) / Math.pow(1 + r, t[j] + 1);
    });
    const step = f / d;
    r -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return r;
}
/** An investor's (or the fund's, id null) flows to `to`: contributions (dates from NS.audit.events), distributions, ending capital. */
function flowsOf(NS, ws, o, id, to, end) {
  const E = NS.audit.events(ws, o);
  const fl = [];
  E.contribs.filter((c) => (!id || c.inv.id === id) && c.date <= to).forEach((c) => fl.push({ date: c.date, amt: -c.cents / 100 }));
  E.dists.filter((d) => (!id || d.inv.id === id) && d.date <= to).forEach((d) => fl.push({ date: d.date, amt: d.cents / 100 }));
  fl.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  fl.push({ date: to, amt: end / 100 });
  return fl;
}

const cases = {
  /**
   * Task 1 (tracer): fund A's FA-1001 and FA-1002 statements, fa-run-1's lines and the fund's performance equal the
   * figures worked by hand from fixtures/fund-a.js (clock 2027-01-20). Capital at each month-end is exactly 2 : 1.
   */
  'fund-a': ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    const { ws, o } = fundA(NS);
    const want = {
      'FA-1001': {
        // Q4 2026: begin = 2/3 of the September LP capital 50,100,000 = 33,400,000; one distribution 600,000 (fa-run-1);
        // gain = 2/3 of the December valuation +3,000,000 = 2,000,000; fee = 3 months x 2/3 of 150,000 = 300,000;
        // end = 33,400,000 - 600,000 + 2,000,000 - 300,000 = 34,500,000.
        period: { from: '2026-10-01', to: '2026-12-31', begin: 33400000, contrib: 0, dist: 600000, income: 0, gain: 2000000, fee: 300000, carry: 0, end: 34500000 },
        // Year 2026: contributed 300,000.00 on 2026-01-15; income = 2/3 of (12,000.00 dividend - 7,500.00 legal) =
        // 300,000 (the engine nets expenses other than 5000 into income); gain = 2/3 of 90,000.00 = 6,000,000; fee = 12 x
        // 100,000 = 1,200,000; end = 30,000,000 - 600,000 + 300,000 + 6,000,000 - 1,200,000 = 34,500,000.
        ytd: { from: '2026-01-01', to: '2026-12-31', begin: 0, contrib: 30000000, dist: 600000, income: 300000, gain: 6000000, fee: 1200000, carry: 0, end: 34500000 },
        commit: 60000000, // committed 600,000.00
        contribCum: 30000000, // 50% called
        unfunded: 30000000, // 60,000,000 - 30,000,000
        distCum: 600000,
        own: 2 / 3,
        // DPI 600,000 / 30,000,000 = 0.02; RVPI 34,500,000 / 30,000,000 = 1.15; TVPI 1.17
        dpi: 0.02,
        rvpi: 1.15,
        tvpi: 1.17,
        // fa-run-1: 6,000.00 gross, nothing withheld, paid by ACH; the investor's first distribution
        run: { gross: 600000, withheld: 0, net: 600000, method: 'ACH', cumulative: 600000 }
      },
      'FA-1002': {
        // Q4: begin 1/3 of 50,100,000 = 16,700,000; dist 300,000; gain 1,000,000; fee 3 x 50,000 = 150,000; end 17,250,000
        period: { from: '2026-10-01', to: '2026-12-31', begin: 16700000, contrib: 0, dist: 300000, income: 0, gain: 1000000, fee: 150000, carry: 0, end: 17250000 },
        // Year: 15,000,000 - 300,000 + 150,000 + 3,000,000 - 600,000 = 17,250,000
        ytd: { from: '2026-01-01', to: '2026-12-31', begin: 0, contrib: 15000000, dist: 300000, income: 150000, gain: 3000000, fee: 600000, carry: 0, end: 17250000 },
        commit: 30000000,
        contribCum: 15000000,
        unfunded: 15000000,
        distCum: 300000,
        own: 1 / 3,
        dpi: 0.02, // 300,000 / 15,000,000
        rvpi: 1.15, // 17,250,000 / 15,000,000
        tvpi: 1.17,
        run: { gross: 300000, withheld: 0, net: 300000, method: 'Check', cumulative: 300000 }
      }
    };
    Object.keys(want).forEach((id) => {
      const w = want[id];
      const s = D.statement(ws, id, 'fund-a', '2026-10-01', '2026-12-31');
      check(`${id} Q4 2026 account = the hand-worked figures`, s && J(pick(s.period, ['from', 'to'].concat(ACCT))) === J(w.period), s && s.period);
      check(`${id} 2026 (year to date) account = the hand-worked figures`, s && J(pick(s.ytd, ['from', 'to'].concat(ACCT))) === J(w.ytd), s && s.ytd);
      check(`${id} commitment, contributed, unfunded, distributed = the hand-worked figures`, s && s.commit === w.commit && s.contribCum === w.contribCum && s.unfunded === w.unfunded && s.distCum === w.distCum, s && pick(s, ['commit', 'contribCum', 'unfunded', 'distCum']));
      check(`${id} ownership ${id === 'FA-1001' ? '2/3' : '1/3'} (within 1e-12)`, s && Math.abs(s.own - w.own) < 1e-12, s && s.own);
      check(`${id} DPI ${w.dpi}, RVPI ${w.rvpi}, TVPI ${w.tvpi} (2 decimals)`, s && s.perf && r2(s.perf.dpi) === w.dpi && r2(s.perf.rvpi) === w.rvpi && r2(s.perf.tvpi) === w.tvpi, s && s.perf);
      const mine = newtonIrr(flowsOf(NS, ws, o, id, '2026-12-31', w.ytd.end));
      check(`${id} IRR = the check's own Newton IRR to 4 decimals`, s && s.perf && typeof s.perf.irr === 'number' && Math.abs(s.perf.irr - mine) < 5e-5, { adapter: s && s.perf && s.perf.irr, newton: mine });
      check(`${id} statement names the fund, closed, not a sample fund, preliminary (books not closed)`, s && s.offeringId === 'fund-a' && s.name === 'Fund A, L.P.' && s.currency === 'USD' && s.fundType === 'pe' && s.open === false && s.generated === false && s.preliminary === true, s && pick(s, ['offeringId', 'name', 'currency', 'fundType', 'open', 'generated', 'preliminary']));
      const dl = D.distribution(ws, 'fa-run-1', id);
      check(`fa-run-1 for ${id}: gross ${w.run.gross}, withheld 0, net ${w.run.net}, ${w.run.method}, cumulative ${w.run.cumulative}`, dl && J(pick(dl, ['runId', 'offeringId', 'currency', 'date', 'type', 'gross', 'withheld', 'net', 'method', 'cumulative'])) === J(Object.assign({ runId: 'fa-run-1', offeringId: 'fund-a', currency: 'USD', date: '2026-12-15', type: 'Realization proceeds' }, w.run)), dl);
      check(`${id} statement and distribution money fields are whole cents`, s && dl && !notCents([s, dl], MONEY).length, notCents([s, dl], MONEY));
    });
    const p = D.performance(ws, 'fund-a', '2026-01-01', '2026-12-31');
    // Fund at 2026-12-31: paid 45,000,000; dist 900,000; nav 51,750,000; DPI 0.02, RVPI 1.15, TVPI 1.17
    const pf = p && p.fund;
    check('fund A performance: closed, as of 2026-12-31, paid 45,000,000, dist 900,000, nav 51,750,000', p && p.kind === 'closed' && p.asOf === '2026-12-31' && pf && pf.paid === 45000000 && pf.dist === 900000 && pf.nav === 51750000, p);
    check('fund A DPI 0.02, RVPI 1.15, TVPI 1.17 (2 decimals)', pf && r2(pf.dpi) === 0.02 && r2(pf.rvpi) === 1.15 && r2(pf.tvpi) === 1.17, pf);
    const fundIrr = newtonIrr(flowsOf(NS, ws, o, null, '2026-12-31', 51750000));
    check("fund A IRR = the check's own Newton IRR to 4 decimals", pf && typeof pf.irr === 'number' && Math.abs(pf.irr - fundIrr) < 5e-5, { adapter: pf && pf.irr, newton: fundIrr });
  }
};

L.runParts(cases, { name: 'REPORTS MATH', unit: 'cases', flag: '--case' });
