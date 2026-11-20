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
  },

  /**
   * The engine anchor: for every sample firm, fund, investor and preset of NS.audit.presets at 2027-01-20 the statement's
   * period, year-to-date and inception-to-date accounts are the engine's rows exactly; perf is the engine's
   * closedPerformance row (closed funds) or null (open funds); each account adds up; the investors add up to the fund.
   */
  statement: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    let rows = 0;
    sampleWorkspaces(NS).forEach((ws) => {
      const bad = [];
      ws.offerings.forEach((o) => {
        const inception = NS.audit.ledger(ws, o).inception;
        NS.audit.presets(ws, o).forEach((pr) => {
          const P = NS.audit.period(ws, o, pr.from, pr.to);
          const Y = NS.audit.period(ws, o, P.to.slice(0, 4) + '-01-01', P.to);
          const I = NS.audit.period(ws, o, inception || P.to, P.to);
          const C = P.S.open ? null : NS.audit.closedPerformance(P);
          ACCT.forEach((k) => {
            if (P.inv.reduce((s, a) => s + a[k], 0) !== P.fund[k]) bad.push({ o: o.id, pr: pr.id, fundSum: k });
          });
          P.inv.forEach((a) => {
            rows++;
            const id = a.investor.id;
            const s = D.statement(ws, id, o.id, pr.from, pr.to);
            const eq = (acc, Q) => {
              const r = Q.inv.find((x) => x.investor.id === id);
              return acc && r && acc.from === Q.from && acc.to === Q.to && ACCT.every((k) => acc[k] === r[k]);
            };
            const add = (x) => x.begin + x.contrib - x.dist + x.income + x.gain - x.fee - x.carry === x.end;
            const cr = C && C.investors.find((x) => x.a.investor.id === id);
            const perfOk = P.S.open ? s && s.perf === null : s && s.perf && ['paid', 'dist', 'nav', 'dpi', 'rvpi', 'tvpi', 'irr'].every((k) => s.perf[k] === cr[k]);
            const fields = s && s.commit === a.commit && s.contribCum === a.contribCum && s.distCum === a.distCum && s.own === a.own && s.unfunded === (P.S.open ? 0 : Math.max(0, a.commit - a.contribCum)) && s.open === !!P.S.open && s.fundType === P.S.key;
            const cents = s && !notCents(s, MONEY).length;
            if (!(eq(s && s.period, P) && eq(s && s.ytd, Y) && eq(s && s.itd, I) && perfOk && fields && cents && add(a) && add(s.period) && add(s.ytd) && add(s.itd)))
              bad.push({ o: o.id, pr: pr.id, id, period: eq(s && s.period, P), ytd: eq(s && s.ytd, Y), itd: eq(s && s.itd, I), perfOk, fields, cents, notCents: s && notCents(s, MONEY) });
          });
          const to = P.to;
          const want = ws.investors.filter((i) => i.positions.some((p) => p.offeringId === o.id && p.date <= to)).map((i) => i.id).sort();
          const got = D.holders(ws, o.id, pr.to).map((i) => i.id);
          if (J(got) !== J(want) || got.some((id) => !D.statement(ws, id, o.id, pr.from, pr.to))) bad.push({ o: o.id, pr: pr.id, holders: got, want });
        });
        if (D.statement(ws, 'NO-SUCH-INVESTOR', o.id, '2026-01-01', '2026-12-31') !== null) bad.push({ o: o.id, unknownInvestor: 'not null' });
      });
      check(`${ws.tenant.id}: every fund, investor and preset: period, ytd and itd accounts and performance = the engine; each account adds up; investors add up to the fund; holders by id`, !bad.length, bad.slice(0, 5));
    });
    check('statements compared: more than 0 (the sample firms have investors)', rows > 0, rows);
  },

  /**
   * One investor across funds: one statement per fund in name order and one total per currency. With kb-harlow in euros
   * (set before the first engine call), KBC-1001's totals are exactly two and no total mixes them.
   */
  consolidated: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    const TOT = ACCT.concat(['commit', 'unfunded', 'distCum']);
    const sums = (list) => {
      const out = [];
      list.forEach((s) => {
        let t = out.find((x) => x.currency === s.currency);
        if (!t) out.push((t = Object.assign({ currency: s.currency }, ...TOT.map((k) => ({ [k]: 0 })))));
        TOT.forEach((k) => (t[k] += ACCT.indexOf(k) >= 0 ? s.period[k] : s[k]));
      });
      return out;
    };
    let seen = 0;
    sampleWorkspaces(NS).forEach((ws) => {
      const bad = [];
      ws.investors
        .filter((i) => new Set(i.positions.map((p) => p.offeringId)).size > 1)
        .forEach((i) => {
          seen++;
          const C = D.consolidated(ws, i.id, '2026-01-01', '2026-12-31');
          const names = ws.offerings.filter((o) => i.positions.some((p) => p.offeringId === o.id)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
          const wantFunds = names.map((o) => D.statement(ws, i.id, o.id, '2026-01-01', '2026-12-31')).filter(Boolean);
          const fundsOf = D.fundsOf(ws, i.id).map((o) => o.id);
          if (!C || J(C.funds) !== J(wantFunds) || J(C.totals) !== J(sums(wantFunds)) || J(fundsOf) !== J(names.map((o) => o.id))) bad.push({ id: i.id, funds: C && C.funds.map((s) => s.offeringId), want: names.map((o) => o.id), totals: C && C.totals, wantTotals: sums(wantFunds) });
        });
      check(`${ws.tenant.id}: every investor in two or more funds: one statement per fund in name order, totals = the sums per currency`, !bad.length, bad.slice(0, 3));
    });
    check('investors in two or more funds: more than 0', seen > 0, seen);

    const N2 = load();
    const kb = sampleWorkspaces(N2).find((w) => w.tenant.id === 'kestrel-bay');
    kb.offerings.find((o) => o.id === 'kb-harlow').currency = 'EUR';
    if (N2.clearCaches) N2.clearCaches();
    const C = N2.reportsData.consolidated(kb, 'KBC-1001', '2026-01-01', '2026-12-31');
    const st = (oid) => N2.reportsData.statement(kb, 'KBC-1001', oid, '2026-01-01', '2026-12-31');
    const usd = sums([st('kb-fund-ii'), st('kb-note-24a')]);
    const eur = sums([st('kb-harlow')]);
    const tUsd = C && C.totals.find((t) => t.currency === 'USD');
    const tEur = C && C.totals.find((t) => t.currency === 'EUR');
    check('KBC-1001 with kb-harlow in euros: exactly two totals, USD = kb-fund-ii + kb-note-24a, EUR = kb-harlow', C && C.totals.length === 2 && J(tUsd) === J(usd[0]) && J(tEur) === J(eur[0]) && usd.length === 1 && eur.length === 1, C && C.totals);
    check('KBC-1001: the euro fund statement reads EUR, the others USD', C && C.funds.every((s) => s.currency === (s.offeringId === 'kb-harlow' ? 'EUR' : 'USD')) && C.funds.length === 3, C && C.funds.map((s) => [s.offeringId, s.currency]));
  },

  /**
   * Every paid run of every sample firm and every line: gross, withheld and net = NS.data.runRows; cumulative = the
   * investor's gross over paid runs of the offering on or before the run, worked a second way from NS.audit.events; a
   * run that is not paid gives null; runs lists every paid run newest first; distributions totals the investor's runs.
   */
  distribution: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    let lines = 0;
    sampleWorkspaces(NS).forEach((ws) => {
      const bad = [];
      ws.offerings.forEach((o) => {
        const paid = ws.runs.filter((r) => r.offeringId === o.id && NS.data.runPaid(r, TODAY));
        const want = paid
          .slice()
          .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0))
          .map((r) => ({ id: r.id, date: r.date, type: r.type || '', gross: NS.data.runRows(ws, r).reduce((s, x) => s + x.cents, 0) }));
        const got = D.runs(ws, o.id);
        if (J(got.map((r) => [r.id, r.date, r.type, r.gross])) !== J(want.map((r) => [r.id, r.date, r.type, r.gross])) || got.some((r, n) => n && r.date > got[n - 1].date)) bad.push({ o: o.id, runs: got.length, want: want.length });
        const E = NS.audit.events(ws, o);
        paid.forEach((run) => {
          NS.data.runRows(ws, run).forEach((row) => {
            lines++;
            const id = row.investor.id;
            const dl = D.distribution(ws, run.id, id);
            const cum = E.dists.filter((d) => d.inv.id === id && d.date <= run.date).reduce((s, d) => s + d.cents, 0);
            const inv = ws.investors.find((x) => x.id === id);
            const method = inv && inv.payment && inv.payment.method === 'ach' && inv.payment.bank ? 'ACH' : inv && inv.payment && inv.payment.method === 'wire' ? 'Wire' : 'Check';
            if (!(dl && dl.gross === row.cents && dl.withheld === row.withheldCents && dl.net === row.netCents && dl.cumulative === cum && dl.method === method && dl.date === run.date && dl.offeringId === o.id && !notCents(dl, MONEY).length))
              bad.push({ run: run.id, id, dl, row: { gross: row.cents, withheld: row.withheldCents, net: row.netCents }, cum, method });
          });
        });
        const y = ws.investors.filter((i) => i.positions.some((p) => p.offeringId === o.id)).slice(0, 3);
        y.forEach((i) => {
          const R = D.distributions(ws, i.id, o.id, '2026-01-01', '2026-12-31');
          const mine = (from, to) =>
            paid
              .filter((r) => r.date >= from && r.date <= to)
              .map((r) => ({ r, x: NS.data.runRows(ws, r).find((x) => x.investor.id === i.id) }))
              .filter((z) => z.x);
          const tot = (z) => ({ gross: z.reduce((s, q) => s + q.x.cents, 0), withheld: z.reduce((s, q) => s + q.x.withheldCents, 0), net: z.reduce((s, q) => s + q.x.netCents, 0) });
          const p2026 = mine('2026-01-01', '2026-12-31');
          const ok = R && R.rows.length === p2026.length && J(R.period) === J(tot(p2026)) && J(R.ytd) === J(tot(p2026)) && J(R.itd) === J(tot(mine('', '2026-12-31')));
          if (!ok) bad.push({ o: o.id, id: i.id, distributions: R && { rows: R.rows.length, period: R.period, itd: R.itd }, want: { rows: p2026.length, period: tot(p2026) } });
        });
      });
      check(`${ws.tenant.id}: every paid run and line: gross, withheld, net = runRows; cumulative = events; method; runs newest first; distributions totals`, !bad.length, bad.slice(0, 3));
    });
    check('paid lines compared: more than 0', lines > 0, lines);
    const { ws } = fundA(NS);
    const run = ws.runs[0];
    ws.runs.push(Object.assign(JSON.parse(J(run)), { id: 'fa-run-cancelled', cancelled: true }), Object.assign(JSON.parse(J(run)), { id: 'fa-run-future', date: '2027-03-15' }));
    check('a cancelled run and a run dated after today give null, and are not in runs', D.distribution(ws, 'fa-run-cancelled', 'FA-1001') === null && D.distribution(ws, 'fa-run-future', 'FA-1001') === null && J(D.runs(ws, 'fund-a').map((r) => r.id)) === J(['fa-run-1']), D.runs(ws, 'fund-a'));
    check('an investor with no line on the run gives null', D.distribution(ws, 'fa-run-1', 'NO-SUCH-INVESTOR') === null);
    // No sample line carries tax withheld, so one is made: FA-1002's 3,000.00 with 24% backup withholding (720.00) taken.
    const N3 = load();
    const W = fundA(N3, (w) => {
      const l = w.runs[0].lines.find((x) => x.investorId === 'FA-1002');
      l.withheld = [{ kind: 'backup', cents: 72000, basisCents: 300000, ratePct: 24, source: 'rule', why: 'No taxpayer number certified', confirmedBy: 'Check Runner', confirmedAt: '2026-12-15T15:00:00.000Z' }];
      l.netCents = 228000; // 300,000 - 72,000
    }).ws;
    const wl = N3.reportsData.distribution(W, 'fa-run-1', 'FA-1002');
    const row = N3.data.runRows(W, W.runs[0]).find((x) => x.investor.id === 'FA-1002');
    check('a line with tax withheld: FA-1002 gross 300,000, withheld 72,000, net 228,000 = runRows', wl && wl.gross === 300000 && wl.withheld === 72000 && wl.net === 228000 && row.withheldCents === 72000 && row.netCents === 228000, wl);
    const ds = N3.reportsData.distributions(W, 'FA-1002', 'fund-a', '2026-01-01', '2026-12-31');
    check('distributions for FA-1002 2026: one row, period gross 300,000, withheld 72,000, net 228,000', ds && ds.rows.length === 1 && J(ds.period) === J({ gross: 300000, withheld: 72000, net: 228000 }), ds);
  },

  /**
   * Performance is the engine's: closedPerformance and openPerformance are exported; for every fund and preset the
   * adapter equals them; no key named gross appears in any performance figure (C-07: net only).
   */
  performance: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    check('NS.audit.closedPerformance and NS.audit.openPerformance are functions', typeof NS.audit.closedPerformance === 'function' && typeof NS.audit.openPerformance === 'function');
    const grossKeys = (x, at, out) => {
      out = out || [];
      if (x && typeof x === 'object') Object.keys(x).forEach((k) => (/gross/i.test(k) ? out.push(`${at}.${k}`) : grossKeys(x[k], `${at}.${k}`, out)));
      return out;
    };
    let kinds = { open: 0, closed: 0 };
    const gross = [];
    sampleWorkspaces(NS).forEach((ws) => {
      const bad = [];
      ws.offerings.forEach((o) => {
        NS.audit.presets(ws, o).forEach((pr) => {
          const P = NS.audit.period(ws, o, pr.from, pr.to);
          const R = D.performance(ws, o.id, pr.from, pr.to);
          let ok;
          if (P.S.open) {
            const X = NS.audit.openPerformance(P);
            ok = R && R.kind === 'open' && R.asOf === P.to && R.period === X.period && R.ytd === X.ytd && R.itd === X.itd && R.itdAnnual === X.itdAnnual && J(R.monthly) === J(X.monthly.map((m) => ({ key: m.key, begin: m.begin, contrib: m.contrib, dist: m.dist, net: m.net })));
          } else {
            const X = NS.audit.closedPerformance(P).fund;
            ok = R && R.kind === 'closed' && R.asOf === P.to && ['paid', 'dist', 'nav', 'dpi', 'rvpi', 'tvpi', 'irr'].every((k) => R.fund[k] === X[k]) && Object.keys(R.fund).length === 7;
          }
          if (R) kinds[R.kind]++;
          if (!ok) bad.push({ o: o.id, pr: pr.id, R });
          gross.push(...grossKeys(R, `${o.id}/${pr.id}`));
          const first = P.inv[0];
          if (first) gross.push(...grossKeys((D.statement(ws, first.investor.id, o.id, pr.from, pr.to) || {}).perf, `${o.id}/${pr.id}/statement.perf`));
        });
      });
      check(`${ws.tenant.id}: every fund and preset: performance = the engine's closedPerformance or openPerformance`, !bad.length, bad.slice(0, 3));
    });
    check('both kinds were compared (open and closed funds)', kinds.open > 0 && kinds.closed > 0, kinds);
    check('no key named gross in any performance result or statement perf (C-07)', !gross.length, gross.slice(0, 5));
  },

  /** The schedule of investments is the engine's: for every fund, rows and NAV = period(...).hold field by field. */
  holdings: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    const map = (hold) => ({ nav: hold.nav, rows: hold.rows.map((r) => ({ id: (r.h && r.h.id) || '', name: r.name, security: r.security, level: r.level, fv: r.fv, cost: r.cost, debt: r.debt, equity: r.equity, pctNav: r.pctNav })) });
    const worlds = sampleWorkspaces(NS).concat([fundA(NS).ws]);
    worlds.forEach((ws) => {
      const bad = [];
      ws.offerings.forEach((o) => {
        ['2026-12-31', '2026-06-30'].forEach((to) => {
          const P = NS.audit.period(ws, o, to, to);
          const H = D.holdings(ws, o.id, to);
          if (!(H && H.asOf === P.to && J({ nav: H.nav, rows: H.rows }) === J(map(P.hold)) && !notCents(H.rows, MONEY).length && Number.isSafeInteger(H.nav))) bad.push({ o: o.id, to, H, want: map(P.hold) });
        });
      });
      check(`${ws.tenant.id}: every fund: holdings rows and NAV = the engine's (period().hold)`, !bad.length, bad.slice(0, 2));
    });
    // The fund's statements ('al', 'ops', 'chg') are the audit package's own schedules, built on a copy of ws (W3).
    // Fund A's fixture investors carry no onboarding block (every path that adds an investor sets one; NS.audit.build
    // reads it), so this seat adds the one the portal gives an investor added by hand.
    const N2 = load();
    const A2 = fundA(N2, (w) => w.investors.forEach((i) => (i.onboarding = { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05' }))).ws;
    const kb = sampleWorkspaces(N2).find((w) => w.tenant.id === 'kestrel-bay');
    [
      [A2, 'fund-a'],
      [kb, 'kb-fund-ii'],
      [kb, 'kb-note-24a']
    ].forEach(([ws, oid]) => {
      const before = J(ws);
      const got = N2.reportsData.statements(ws, oid, '2026-01-01', '2026-12-31');
      const copy = JSON.parse(before);
      const list = N2.audit.build(copy, copy.offerings.find((o) => o.id === oid), '2026-01-01', '2026-12-31').list;
      const want = ['al', 'ops', 'chg'].map((id) => list.find((s) => s.id === id));
      check(`${oid}: statements = the audit package's 'al', 'ops', 'chg' schedules in that order; ws unchanged`, got && got.length === 3 && J(got) === J(want) && J(ws) === before, got && got.map((s) => s.id));
    });
    // Fund A's total net assets in the statement of assets and liabilities = 51,750,000 (expect.statements.netAssets)
    const al = N2.reportsData.statements(A2, 'fund-a', '2026-01-01', '2026-12-31')[0];
    check("fund A: the statement of assets and liabilities carries net assets 51,750,000", al && J(al.rows).indexOf('51750000') >= 0, al && al.rows);
  },

  /**
   * Fees and expenses: fund A from the journal in the ILPA order (source 'books'), year 2026 and Q4 2026 as worked by
   * hand, and with four more expense lines the order 5000, 5100, 5110, 5120, 5200, 5900; a sample fund: one row
   * 'Management fees' = the engine's fee (source 'engine').
   */
  fees: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    const { ws } = fundA(NS);
    const y = D.fees(ws, 'fund-a', '2026-01-01', '2026-12-31');
    // 5000: 12 x 150,000 = 1,800,000; 5100: legal 750,000; total 2,550,000 (= expect.statements.expenses)
    check('fund A 2026 (books): 5000 Management fees 1,800,000; 5100 Professional fees 750,000; total 2,550,000', y && y.source === 'books' && J(y.rows) === J([{ code: '5000', name: 'Management fees', cents: 1800000 }, { code: '5100', name: 'Professional fees', cents: 750000 }]) && y.total === 2550000, y);
    const q = D.fees(ws, 'fund-a', '2026-10-01', '2026-12-31');
    // Q4: 3 x 150,000 = 450,000; no other expense in the quarter
    check('fund A Q4 2026 (books): 5000 only, 450,000', q && q.source === 'books' && J(q.rows) === J([{ code: '5000', name: 'Management fees', cents: 450000 }]) && q.total === 450000, q);
    const N2 = load();
    const B = fundA(N2);
    N2.books.post(B.ws, 'fund-a', { date: '2026-11-15', memo: 'Other expenses', src: 'bank:fa-x1', lines: [['5900', 10000], ['5200', 20000], ['5110', 30000], ['5120', 40000], ['1000', -100000]] }, ACTOR);
    const o2 = N2.reportsData.fees(B.ws, 'fund-a', '2026-01-01', '2026-12-31');
    check('fund A with 5900, 5200, 5110, 5120 added: the ILPA order 5000, 5100, 5110, 5120, 5200, 5900; total 2,650,000', o2 && J(o2.rows.map((r) => r.code)) === J(['5000', '5100', '5110', '5120', '5200', '5900']) && o2.total === 2650000 && J(o2.rows.map((r) => r.cents)) === J([1800000, 750000, 30000, 40000, 20000, 10000]), o2);
    const bad = [];
    sampleWorkspaces(NS).forEach((sw) =>
      sw.offerings.forEach((o) => {
        const P = NS.audit.period(sw, o, '2026-01-01', '2026-12-31');
        const f = D.fees(sw, o.id, '2026-01-01', '2026-12-31');
        if (!(f && f.source === 'engine' && f.rows.length === 1 && f.rows[0].name === 'Management fees' && f.rows[0].cents === P.fund.fee && f.total === P.fund.fee)) bad.push({ o: o.id, f, fee: P.fund.fee });
      })
    );
    check("every sample fund (2026): source 'engine', one row 'Management fees' = the engine's fee", !bad.length, bad.slice(0, 3));
  },

  /**
   * NOI is the journal's: fund A as a real estate fund with rent 10,000.00, insurance 2,000.00 and taxes 1,000.00 on
   * holding fa-x in November 2026: income 1,000,000, expenses 300,000, NOI 700,000; a holding or period with no such
   * line gives null.
   */
  noi: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    const reType = Object.keys(NS.OFFERING_TYPES).find((k) => NS.OFFERING_TYPES[k].profile === 'realestate');
    const { ws } = fundA(NS, (w) => (w.offerings[0].type = reType));
    NS.books.post(ws, 'fund-a', { date: '2026-11-30', memo: 'November property operations', src: 'bank:fa-noi', lines: [['4020', -1000000, '', 'fa-x'], ['5300', 200000, '', 'fa-x'], ['5320', 100000, '', 'fa-x'], ['1000', 700000]] }, ACTOR);
    const n = D.noi(ws, 'fund-a', 'fa-x', '2026-10-01', '2026-12-31');
    check(`fund A as "${reType}": noi(fa-x, Q4 2026) = { income: 1000000, expenses: 300000, noi: 700000 }`, J(n) === J({ income: 1000000, expenses: 300000, noi: 700000 }), n);
    check('a holding with no income or property-expense line gives null', D.noi(ws, 'fund-a', 'no-such-holding', '2026-10-01', '2026-12-31') === null);
    check('fa-x in Q3 2026 (a valuation line only) gives null', D.noi(ws, 'fund-a', 'fa-x', '2026-07-01', '2026-09-30') === null);
  },

  /**
   * Tax year and tax documents: FA-1001's 2026 is one fund, 600,000 gross, nothing withheld, the one run; taxDocs lists
   * only FA-1001's own documents for the year (not FA-1002's, not a withdrawn one, not another year), labelled from
   * NS.taxdocs.KINDS, and no result carries anything shaped like a taxpayer number (the records hold made-up ones).
   */
  tax: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    const doc = (id, inv, year, state) => ({ id, title: 'Schedule K-1', fileName: id + '.pdf', type: 'application/pdf', size: 1, sha256: '', cat: 'Tax', offeringId: 'fund-a', audience: 'investors', investors: [inv], date: '2027-01-15', taxYear: String(year), publishedAt: '', publishedBy: '', hidden: false, tinShown: '987-65-4321', tax: { kind: 'k1-1065', year: String(year), batch: '', pkg: '', pages: [], sourceSha256: '', match: { basis: 'made-up taxpayer number 98-7654321' }, state, replaces: '', deliveredAt: '2027-01-15', availableUntil: '2027-10-15', notice: null, opens: { first: '', last: '', count: 0 }, paper: null, withdrawn: null } });
    const { ws } = fundA(NS, (w) => {
      // Made-up taxpayer numbers in the records, so the scan below can find one if any adapter passed it on.
      w.investors[0].tin = '123-45-6789';
      w.investors[0].tinFull = '123456789';
      w.investors[0].tinLast4 = '6789';
      w.investors[1].tin = '12-3456789';
      w.docs.push(doc('doc-k1-fa1001', 'FA-1001', 2026, 'delivered'), doc('doc-k1-fa1002', 'FA-1002', 2026, 'delivered'), doc('doc-k1-fa1001-old', 'FA-1001', 2026, 'withdrawn'), doc('doc-k1-fa1001-2025', 'FA-1001', 2025, 'delivered'));
    });
    const T = D.taxYear(ws, 'FA-1001', 2026);
    // fa-run-1 is FA-1001's only paid run in 2026: 600,000 gross, 0 withheld, 600,000 net
    const wantT = { year: 2026, funds: [{ offeringId: 'fund-a', name: 'Fund A, L.P.', currency: 'USD', gross: 600000, withheld: 0, net: 600000, runs: [{ runId: 'fa-run-1', date: '2026-12-15', type: 'Realization proceeds', gross: 600000, withheld: 0, net: 600000 }] }] };
    check('FA-1001 tax year 2026: one fund, gross 600,000, withheld 0, net 600,000, the one run', J(T) === J(wantT), T);
    check('FA-1001 tax year 2025: no fund (no paid run in 2025)', J(D.taxYear(ws, 'FA-1001', 2025)) === J({ year: 2025, funds: [] }), D.taxYear(ws, 'FA-1001', 2025));
    const docs = D.taxDocs(ws, 'FA-1001', 2026);
    const wantD = [{ docId: 'doc-k1-fa1001', offeringId: 'fund-a', kind: 'k1-1065', label: NS.taxdocs.KINDS['k1-1065'].label, year: 2026, state: 'delivered', availableUntil: '2027-10-15' }];
    check("taxDocs(FA-1001, 2026): exactly FA-1001's own delivered K-1, labelled 'Schedule K-1 (Form 1065)'; not FA-1002's, not the withdrawn one, not 2025's", J(docs) === J(wantD) && wantD[0].label === 'Schedule K-1 (Form 1065)', docs);
    const blob = J([T, docs, D.taxDocs(ws, 'FA-1002', 2026), D.taxYear(ws, 'FA-1002', 2026), D.investor(ws, 'FA-1001'), D.investor(ws, 'FA-1002')]);
    const shapes = blob.match(/\d{9}|\d{2}-\d{7}|\d{3}-\d{2}-\d{4}/g);
    check('no 9-digit run, NN-NNNNNNN or NNN-NN-NNNN in any tax result or investor block', !shapes, shapes);
    check("taxDocs(FA-1002, 2026) lists only FA-1002's", J(D.taxDocs(ws, 'FA-1002', 2026).map((d) => d.docId)) === J(['doc-k1-fa1002']), D.taxDocs(ws, 'FA-1002', 2026));
  },

  /**
   * Activity: FA-1001's 2026 contributions are NS.audit.events' contributions for FA-1001 (dates and cents, 30,000,000 in
   * all) and one distribution on 2026-12-15 of 600,000; across every sample fund and investor, inception to date, the
   * contributions, distributions and redemptions are the engine's.
   */
  activity: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    const { ws, o } = fundA(NS);
    const act = D.activity(ws, 'FA-1001', 'fund-a', '2026-01-01', '2026-12-31');
    const E = NS.audit.events(ws, o);
    const wantC = E.contribs.filter((c) => c.inv.id === 'FA-1001').map((c) => [c.date, c.cents]);
    const gotC = act.filter((x) => x.kind === 'contribution');
    check('FA-1001 2026 contributions = NS.audit.events (dates and cents), 30,000,000 in all', J(gotC.map((x) => [x.date, x.cents])) === J(wantC) && gotC.reduce((s, x) => s + x.cents, 0) === 30000000, gotC);
    check('FA-1001 2026: one distribution, 2026-12-15, 600,000, labelled as the run', J(act.filter((x) => x.kind === 'distribution')) === J([{ date: '2026-12-15', kind: 'distribution', label: 'Realization proceeds', cents: 600000 }]), act);
    check('FA-1001 2026 activity is by date', act.every((x, n) => !n || act[n - 1].date <= x.date), act.map((x) => x.date));
    let reds = 0;
    sampleWorkspaces(NS).forEach((sw) => {
      const bad = [];
      sw.offerings.forEach((so) => {
        const itd = NS.audit.presets(sw, so).find((p) => p.id === 'itd');
        const P = NS.audit.period(sw, so, itd.from, itd.to);
        const L = P.L;
        const inP = (x) => x.date >= P.from && x.date <= P.to;
        P.inv.forEach((a) => {
          const id = a.investor.id;
          const got = D.activity(sw, id, so.id, itd.from, itd.to);
          const k = (kind) => got.filter((x) => x.kind === kind).map((x) => [x.date, x.cents]);
          const want = (list) => list.filter((x) => x.inv.id === id && inP(x)).map((x) => [x.date, x.cents]);
          const sortD = (l) => l.slice().sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0));
          reds += k('redemption').length;
          if (J(sortD(k('contribution'))) !== J(sortD(want(L.contribs))) || J(sortD(k('distribution'))) !== J(sortD(want(L.dists))) || J(sortD(k('redemption'))) !== J(sortD(want(L.redemptions || []))) || !got.every((x, n) => !n || got[n - 1].date <= x.date) || notCents(got, MONEY).length) bad.push({ o: so.id, id });
        });
      });
      check(`${sw.tenant.id}: every fund and investor, inception to date: contributions, distributions and redemptions = the engine's, by date`, !bad.length, bad.slice(0, 3));
    });
    check('redemptions were among those compared (an open fund redeems)', reds > 0, reds);
  },

  /**
   * Chart series: FA-1001's 2026 distributions per quarter are 0, 0, 0, 600,000; its December capital is 34,500,000 and
   * each month is the ledger row's end; the fund's series (no investor) is the limited partners' capital at each
   * month-end (expect.lpCapital).
   */
  series: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    const { F, ws, o } = fundA(NS);
    const s = D.series(ws, 'fund-a', 'FA-1001', '2026-01-01', '2026-12-31');
    check('FA-1001 2026 distributions per quarter: Q1 0, Q2 0, Q3 0, Q4 600,000', s && J(s.dist) === J([{ label: 'Q1 2026', cents: 0 }, { label: 'Q2 2026', cents: 0 }, { label: 'Q3 2026', cents: 0 }, { label: 'Q4 2026', cents: 600000 }]), s && s.dist);
    const months = F.expect.monthEnds.map((d) => d.slice(0, 7));
    const ledgerEnds = F.expect.monthEnds.map((d) => NS.audit.period(ws, o, d.slice(0, 8) + '01', d).inv.find((a) => a.investor.id === 'FA-1001').end);
    check('FA-1001 2026 capital: twelve month-ends, each the ledger row end, December 34,500,000', s && J(s.capital) === J(months.map((k, i) => ({ key: k, cents: ledgerEnds[i] }))) && s.capital[11].cents === 34500000, s && s.capital);
    const f = D.series(ws, 'fund-a', null, '2026-01-01', '2026-12-31');
    check("fund A series: capital = the limited partners' capital at each month-end (expect.lpCapital); distributions Q4 900,000", f && J(f.capital.map((x) => x.cents)) === J(F.expect.lpCapital) && J(f.dist.map((x) => x.cents)) === J([0, 0, 0, 900000]), f);
    const q = D.series(ws, 'fund-a', 'FA-1001', '2026-11-01', '2026-12-31');
    check('a period inside one quarter: one quarter, Q4 2026, 600,000; capital November and December', q && J(q.dist) === J([{ label: 'Q4 2026', cents: 600000 }]) && J(q.capital.map((x) => x.key)) === J(['2026-11', '2026-12']), q);
  },

  /**
   * Nothing writes to the workspace: JSON.stringify(ws) is identical before and after calling every adapter for fund A
   * and for kestrel-bay. The firm and investor blocks read the records as they are.
   */
  readonly: ({ check }) => {
    const NS = load();
    const D = NS.reportsData;
    const every = (ws, oid, inv, hold, run) => {
      const out = {};
      const call = (name, fn) => {
        const before = J(ws);
        try {
          fn();
        } catch (e) {
          out[name] = 'threw: ' + e.message;
          return;
        }
        if (J(ws) !== before) {
          const a = JSON.parse(before);
          out[name] = Object.keys(ws).filter((k) => J(ws[k]) !== J(a[k]));
        }
      };
      call('fundsOf', () => D.fundsOf(ws, inv));
      call('holders', () => D.holders(ws, oid, '2026-12-31'));
      call('statement', () => D.statement(ws, inv, oid, '2026-01-01', '2026-12-31'));
      call('consolidated', () => D.consolidated(ws, inv, '2026-01-01', '2026-12-31'));
      call('runs', () => D.runs(ws, oid));
      call('distribution', () => D.distribution(ws, run, inv));
      call('distributions', () => D.distributions(ws, inv, oid, '2026-01-01', '2026-12-31'));
      call('activity', () => D.activity(ws, inv, oid, '2026-01-01', '2026-12-31'));
      call('performance', () => D.performance(ws, oid, '2026-01-01', '2026-12-31'));
      call('holdings', () => D.holdings(ws, oid, '2026-12-31'));
      call('noi', () => D.noi(ws, oid, hold, '2026-01-01', '2026-12-31'));
      call('fees', () => D.fees(ws, oid, '2026-01-01', '2026-12-31'));
      call('statements', () => D.statements(ws, oid, '2026-01-01', '2026-12-31'));
      call('series', () => D.series(ws, oid, inv, '2026-01-01', '2026-12-31'));
      call('seriesFund', () => D.series(ws, oid, null, '2026-01-01', '2026-12-31'));
      call('taxYear', () => D.taxYear(ws, inv, 2026));
      call('taxDocs', () => D.taxDocs(ws, inv, 2026));
      call('firm', () => D.firm(ws));
      call('investor', () => D.investor(ws, inv));
      return out;
    };
    const { ws } = fundA(NS, (w) => w.investors.forEach((i) => (i.onboarding = { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05' })));
    const a = every(ws, 'fund-a', 'FA-1001', 'fa-x', 'fa-run-1');
    check('fund A: every adapter leaves JSON.stringify(ws) unchanged and none throws', !Object.keys(a).length, a);
    const kb = sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
    const kr = kb.runs.find((r) => r.offeringId === 'kb-fund-ii' && NS.data.runPaid(r, TODAY));
    const b = every(kb, 'kb-fund-ii', 'KBC-1001', '', kr.id);
    check('kestrel-bay: every adapter leaves JSON.stringify(ws) unchanged and none throws', !Object.keys(b).length, b);
    const t = kb.tenant;
    const fm = D.firm(kb);
    check('firm(kestrel-bay) = the tenant: name, shortName, legalName, portalName, colors, logo, support, disclaimer', J(fm) === J({ name: t.name, shortName: t.shortName, legalName: t.legalName, portalName: t.portalName, colors: t.colors, logo: t.logo, support: t.support, disclaimer: t.disclaimer }), fm);
    check("investor(FA-1001) = { id, title, contact, firstName 'Investor' }; an unknown id gives null", J(D.investor(ws, 'FA-1001')) === J({ id: 'FA-1001', title: 'Investor One', contact: 'Investor One', firstName: 'Investor' }) && D.investor(ws, 'NO-SUCH-INVESTOR') === null, D.investor(ws, 'FA-1001'));
  },

  /** The check's own rules: an unknown case name and an empty list each exit 1 with a FAIL line (child processes). */
  selfcheck: ({ check }) => {
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const a = run(['--case', 'no-such-case']);
    const b = run(['--case', '']);
    check('an unknown --case name exits 1 with a FAIL line', a.status === 1 && /^FAIL unknown case name: no-such-case/m.test(a.stdout) && /REPORTS MATH: FAIL \(cases run: 0\)/.test(a.stdout), a.stdout);
    check('an empty list exits 1 with a FAIL line', b.status === 1 && /^FAIL no cases to run/m.test(b.stdout) && /REPORTS MATH: FAIL \(cases run: 0\)/.test(b.stdout), b.stdout);
  }
};

L.runParts(cases, { name: 'REPORTS MATH', unit: 'cases', flag: '--case' });
