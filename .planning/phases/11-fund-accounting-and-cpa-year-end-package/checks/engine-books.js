// gate: node
// last "ENGINE BOOKS: PASS (cases run: 8)"
// The capital-account engine reads the journal (plan 11-07, no browser): for a fund that is not a sample fund each
// month's income and gains are the journal's, fee terms apply only once set, carried interest paid with a distribution
// is the general partner's distribution in the month paid (F-3), and opening balances set each investor's capital. The
// portal is loaded inside each case with load11.js (the scripts diy.html lists, then books.js and books-post.js), today
// 2027-01-20 unless a case says otherwise. Funds A to D come from fixtures/fund-a.js ... fund-d.js, each figure written
// once there.
//   node engine-books.js [--case name1,name2]
// P11_ROOT: the base tree (case terms compares the 15 sample offerings' settings with it; case probe prints the base's
// figures as "before"). One PASS or FAIL line per check; the last line is "ENGINE BOOKS: PASS (cases run: N)" or
// "ENGINE BOOKS: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal, sampleWorkspaces, CHECKOUT } = require('./load11.js');

const TODAY = '2027-01-20';
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
const J = (x) => JSON.stringify(x);
const MONTHS_2026 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => '2026-' + m);

/** The portal with the journal and the posting module, inside the case. */
function load(today, root) {
  const NS = loadPortal(root, { today: today || TODAY, extra: ['books.js', 'books-post.js'] });
  if (!NS.books || typeof NS.books.sync !== 'function') throw new Error('books.js and books-post.js did not load');
  return NS;
}
/**
 * The base tree's portal (P11_ROOT). A base holding only assets/js (as a plan's verify extracts it) is loaded through a
 * temporary folder holding this checkout's diy.html (for the script list) and a link to the base's assets.
 */
function loadBase(today) {
  const root = process.env.P11_ROOT;
  if (!root) throw new Error('P11_ROOT is not set: the base tree is needed');
  if (fs.existsSync(path.join(root, 'diy.html'))) return loadPortal(root, { today: today || TODAY });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-books-base-'));
  try {
    fs.copyFileSync(path.join(CHECKOUT, 'diy.html'), path.join(tmp, 'diy.html'));
    fs.symlinkSync(path.resolve(root, 'assets'), path.join(tmp, 'assets'));
    return loadPortal(tmp, { today: today || TODAY });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
const fixture = (name) => JSON.parse(JSON.stringify(require('./fixtures/' + name + '.js')));
function endOf(k) {
  const [y, m] = k.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** A fixture's records as the workspace: its other entries posted directly (all, or those `keep` allows), then synced. */
function build(NS, F, opts) {
  opts = opts || {};
  const ws = F.records;
  const oid = F.expect.offeringId;
  const o = ws.offerings.find((x) => x.id === oid);
  if (opts.edit) opts.edit(ws, F);
  F.entries.filter((e) => !opts.keep || opts.keep(e)).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  const r = NS.books.sync(ws, { today: NS.dates.today() });
  return { ws, oid, o, r };
}
/** Net assets in the journal at a date: asset lines plus liability lines (liabilities are credits). */
function netAssets(NS, ws, oid, date) {
  const codes = NS.books.accounts(ws, oid).filter((a) => a.type === 'asset' || a.type === 'liability').map((a) => a.code);
  return NS.books.balance(ws, oid, codes, date);
}
/** The journal's results for a period: minus the lines on income, expense and gain accounts. */
function results(NS, ws, oid, from, to) {
  const codes = NS.books.accounts(ws, oid).filter((a) => a.type === 'income' || a.type === 'expense' || a.type === 'gain').map((a) => a.code);
  return -NS.books.entries(ws, oid, { account: codes, from, to }).reduce((a, r) => a + r.cents, 0);
}
/** The engine at one month-end: limited partners' capital and the general partner's accrued share. */
function engineAt(NS, ws, o, k) {
  const P = NS.audit.period(ws, o, k + '-01', endOf(k));
  return { lp: P.fund.end, gp: P.fund.gpEnd, P };
}
/** T3 at each month given: journal net assets = LP capital + the GP's accrued share. Returns the months that differ. */
function t3(NS, ws, oid, o, keys) {
  return keys
    .map((k) => {
      const e = engineAt(NS, ws, o, k);
      const na = netAssets(NS, ws, oid, endOf(k));
      return { k, na, lp: e.lp, gp: e.gp };
    })
    .filter((x) => x.na !== x.lp + x.gp);
}
/** T7 for a period: the investors' income + gain - fee - carry plus the GP's carry = the journal's results. */
function t7(NS, ws, oid, o, from, to) {
  const P = NS.audit.period(ws, o, from, to);
  const lp = P.inv.reduce((a, x) => a + x.income + x.gain - x.fee - x.carry, 0);
  const gp = P.inv.reduce((a, x) => a + x.carry, 0);
  return { engine: lp + gp, journal: results(NS, ws, oid, from, to), P };
}
/** The probe firm (FA-03; 11-RESEARCH.md defect 1): one real estate offering, two investors, nothing else recorded. */
function probeWs() {
  const pos = (amount) => [{ offeringId: 'probe-re', amount, date: '2025-02-03' }];
  const inv = (id, amount) => ({ id, contact: id, title: id, type: 'individual', email: id.toLowerCase() + '@example.com', taxForm: 'W-9', payment: { method: 'check', bank: null }, positions: pos(amount) });
  return {
    v: 2,
    tenant: { id: 'probe-sponsor', sample: false, name: 'Probe Sponsor', shortName: 'Probe', legalName: 'Probe Sponsor, LLC' },
    offerings: [{ id: 'probe-re', name: 'Probe Real Estate Fund, L.P.', shortName: 'Probe RE', type: 'Real estate fund', status: 'Active', closeDate: '2025-02-03', exit: { basis: 'date', date: '2032-02-03', from: '', to: '', note: '' }, distribution: { frequency: 'Quarterly', type: 'Income', target: '' }, terms: [] }],
    investors: [inv('PR-1', 100000), inv('PR-2', 300000)],
    calls: [],
    runs: [],
    notices: [],
    audit: [],
    requests: [],
    docs: []
  };
}
const usd = (c) => (c < 0 ? '-$' : '$') + (Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const cases = {
  /**
   * Task 1 (tracer): fund A's capital accounts come from its journal and tie to it at every 2026 month-end (T3); December
   * capital per investor; T7 for 2026; the engine sees an entry posted after it was read without a cache clear (B2).
   */
  'fund-a': ({ check }) => {
    const NS = load();
    const F = fixture('fund-a');
    const { ws, oid, o } = build(NS, F, { keep: (e) => e.src !== 'mark:fa-m2' });
    const before = NS.audit.period(ws, o, '2026-01-01', '2026-12-31').ms.find((m) => m.key === '2026-12');
    NS.books.post(ws, oid, F.entries.find((e) => e.src === 'mark:fa-m2'), ACTOR);
    const after = NS.audit.period(ws, o, '2026-01-01', '2026-12-31').ms.find((m) => m.key === '2026-12');
    check("B2: posting mark:fa-m2 moves December's gain by 3,000,000 with no cache clear (the journal's length is in the key)", before && after && after.gain - before.gain === 3000000, { before: before && before.gain, after: after && after.gain });
    NS.books.sync(ws, { today: TODAY });
    const want = F.expect.lpCapital;
    const rows = MONTHS_2026.map((k, i) => {
      const e = engineAt(NS, ws, o, k);
      return { k, journal: netAssets(NS, ws, oid, endOf(k)), lp: e.lp, gp: e.gp, want: want[i] };
    });
    const bad = rows.filter((r) => r.journal !== r.lp + r.gp || r.lp !== r.want || r.gp !== 0);
    check("T3: at each 2026 month-end the journal's net assets = the limited partners' capital (the fixture's twelve figures), general partner 0", !bad.length, bad.length ? bad : rows.map((r) => r.lp));
    const P = NS.audit.period(ws, o, '2026-01-01', '2026-12-31');
    const caps = {};
    P.inv.forEach((a) => (caps[a.investor.id] = a.end));
    check("December 2026 capital: FA-1001 34,500,000 and FA-1002 17,250,000 (the fixture's)", J(caps) === J(F.expect.capital), caps);
    const T = t7(NS, ws, oid, o, '2026-01-01', '2026-12-31');
    check("T7: the investors' income, gains, fees and carry plus the general partner's carry = the journal's 2026 results (7,650,000)", T.engine === T.journal && T.journal === F.expect.equation.results, { engine: T.engine, journal: T.journal });
    const split = P.inv.map((a) => [a.investor.id, a.income, a.gain, a.fee]);
    check('2026 by investor: income 800,000 - 500,000 legal and 400,000 - 250,000; gains 6,000,000 and 3,000,000; fees 1,200,000 and 600,000', J(split) === J([['FA-1001', 300000, 6000000, 1200000], ['FA-1002', 150000, 3000000, 600000]]), split);
  },

  /** FA-05: fund B, open-ended: January and February to the cent; journal net assets = NAV at both month-ends. */
  'fund-b': ({ check }) => {
    const F = fixture('fund-b');
    const NS = load(F.expect.today);
    const { ws, oid, o } = build(NS, F);
    const Lg = NS.audit.ledger(ws, o);
    Object.keys(F.expect.months).forEach((k) => {
      const W = F.expect.months[k];
      const M = Lg.byKey[k];
      check(`${k} exists in the engine`, !!M, Lg.keys);
      if (!M) return;
      Object.keys(W.rows).forEach((id) => {
        const r = M.rows[id];
        const got = r && { gain: r.gain, fee: r.fee, pre: r.pre, carryEnd: r.carryEnd, end: r.end };
        check(`${k} ${id}: gain, fee, capital before incentive, incentive accrued and ending capital to the cent`, J(got) === J(W.rows[id]), { got, want: W.rows[id] });
      });
      const nav = M.endCap + M.gpEnd;
      check(`${k}: NAV ${W.nav} (capital plus the incentive accrued)`, nav === W.nav, nav);
      check(`${k}: the journal's net assets at the month-end equal the NAV`, netAssets(NS, ws, oid, endOf(k)) === W.nav, netAssets(NS, ws, oid, endOf(k)));
    });
    check('only January and February 2026 are complete on 2026-03-05', J(Lg.keys) === J(['2026-01', '2026-02']), Lg.keys);
  },

  /**
   * FA-03: a term the sponsor has not set is no term (fee, carry, preferred return); a set fee is charged; the 15 sample
   * offerings' settings are exactly the base tree's.
   */
  terms: ({ check }) => {
    const NS = load();
    const unset = build(NS, fixture('fund-a'), { edit: (w) => delete w.offerings[0].accounting.mgmtFee });
    const S0 = NS.audit.settings(unset.o);
    const fees0 = NS.audit.ledger(unset.ws, unset.o).months.map((m) => m.fee);
    check('mgmtFee unset: the rate is 0 and no month charges a fee', S0.mgmtFee === 0 && fees0.length === 12 && fees0.every((x) => x === 0), { rate: S0.mgmtFee, fees: fees0 });
    check('mgmtFee unset: no fee entry is posted', NS.books.entries(unset.ws, unset.oid, { account: '5000' }).length === 0);
    const NS2 = load();
    const set = build(NS2, fixture('fund-a'));
    const rows2 = NS2.audit.ledger(set.ws, set.o).months.map((m) => [m.rows['FA-1001'].fee, m.rows['FA-1002'].fee]);
    check("mgmtFee '2' on commitments: every 2026 month charges 100,000 and 50,000", rows2.length === 12 && rows2.every((r) => r[0] === 100000 && r[1] === 50000), rows2);
    const NS3 = load();
    const nc = build(NS3, fixture('fund-a'), {
      edit: (w) => {
        delete w.offerings[0].accounting.carry;
        delete w.offerings[0].accounting.pref;
      }
    });
    const S3 = NS3.audit.settings(nc.o);
    const P3 = NS3.audit.period(nc.ws, nc.o, '2026-01-01', '2026-12-31');
    const accrued = NS3.audit.ledger(nc.ws, nc.o).months.map((m) => m.gpEnd);
    check('carry and pref unset: both 0, so no carried interest even with 9,000,000 of gains recorded', S3.carry === 0 && S3.pref === 0 && P3.fund.gain === 9000000 && P3.fund.carry === 0 && accrued.every((x) => x === 0), { carry: S3.carry, pref: S3.pref, gain: P3.fund.gain, allocated: P3.fund.carry, accrued });
    let base = null;
    let why = '';
    try {
      base = loadBase();
    } catch (e) {
      why = String(e && e.message);
    }
    check('the base tree is loaded from P11_ROOT', !!base, why);
    if (!base) return;
    const tree = load();
    const offs = (N) => sampleWorkspaces(N).reduce((a, ws) => a.concat(ws.offerings.map((x) => [ws.tenant.id, x])), []);
    const B = offs(base);
    const T = offs(tree);
    const diff = T.filter(([tid, x], i) => !B[i] || B[i][1].id !== x.id || J(base.audit.settings(B[i][1])) !== J(tree.audit.settings(x))).map(([tid, x]) => tid + '/' + x.id);
    check(`each of the ${T.length} sample offerings' settings is exactly the base tree's (15 expected)`, T.length === 15 && B.length === 15 && !diff.length, diff);
    const gen = T.filter(([, x]) => !tree.audit.generated(x)).map(([, x]) => x.id);
    check('every sample offering is generated; fund A, B and the probe are not', !gen.length && !tree.audit.generated(set.o) && !tree.audit.generated(probeWs().offerings[0]), gen);
  },

  /** FA-04, T8: fund A's 2100 at each month-end; each month's 5000 equals the engine's fee. */
  t8: ({ check }) => {
    const NS = load();
    const { ws, oid, o } = build(NS, fixture('fund-a'));
    // 2100 owed at the 2026 month-ends: 150,000 accrued a month, 450,000 paid at each of the first three quarter-ends.
    const OWED = [150000, 300000, 0, 150000, 300000, 0, 150000, 300000, 0, 150000, 300000, 450000];
    const got = MONTHS_2026.map((k) => -NS.books.balance(ws, oid, '2100', endOf(k)));
    check('2100 at each 2026 month-end: 150,000 · 300,000 · 0 · 150,000 · 300,000 · 0 · 150,000 · 300,000 · 0 · 150,000 · 300,000 · 450,000', J(got) === J(OWED), got);
    const Lg = NS.audit.ledger(ws, o);
    const s5000 = NS.books.series(ws, oid, '5000', '2026-01-01', '2026-12-31').map((x) => x.cents);
    const fees = MONTHS_2026.map((k) => (Lg.byKey[k] ? Lg.byKey[k].fee : null));
    check("each month's 5000 equals that month's engine fee (150,000)", J(s5000) === J(fees) && fees.every((x) => x === 150000), { s5000, fees });
    const owed = MONTHS_2026.map((k) => -NS.books.balance(ws, oid, '2100', endOf(k)));
    const paid = (k) => NS.books.entries(ws, oid, { account: '2100', to: endOf(k) }).filter((r) => r.cents > 0).reduce((a, r) => a + r.cents, 0);
    const accrued = (k) => NS.books.balance(ws, oid, '5000', endOf(k));
    check('2100 = fees accrued less fees paid at every month-end', MONTHS_2026.every((k, i) => owed[i] === accrued(k) - paid(k)), MONTHS_2026.map((k) => [accrued(k), paid(k)]));
  },

  /** FA-03 (11-RESEARCH.md defect 1): a real firm with nothing recorded shows nothing invented for fiscal 2025. */
  probe: ({ check }) => {
    const figures = (N) => {
      const ws = probeWs();
      const P = N.audit.period(ws, ws.offerings[0], '2025-01-01', '2025-12-31');
      return { income: P.fund.income, gain: P.fund.gain, fee: P.fund.fee, carry: P.fund.carry, ends: P.inv.map((a) => [a.investor.id, a.end]) };
    };
    if (process.env.P11_ROOT) {
      const b = figures(loadBase());
      console.log(`  probe before this plan (base tree), fiscal 2025: income ${usd(b.income)}, gains ${usd(b.gain)}, income and gains ${usd(b.income + b.gain)}, fees ${usd(b.fee)}, carry ${usd(b.carry)}, ending capital ${b.ends.map((x) => x[0] + ' ' + usd(x[1])).join(', ')}`);
    }
    const g = figures(load());
    console.log(`  probe after (this tree), fiscal 2025: income ${usd(g.income)}, gains ${usd(g.gain)}, fees ${usd(g.fee)}, carry ${usd(g.carry)}, ending capital ${g.ends.map((x) => x[0] + ' ' + usd(x[1])).join(', ')}`);
    check('fiscal 2025: income 0, gain 0, fee 0, carry 0', g.income === 0 && g.gain === 0 && g.fee === 0 && g.carry === 0, g);
    check('ending capital 10,000,000 and 30,000,000', J(g.ends) === J([['PR-1', 10000000], ['PR-2', 30000000]]), g.ends);
  }
};

L.runParts(cases, { name: 'ENGINE BOOKS', unit: 'cases', flag: '--case' });
