// gate: node
// last "REPORTS MODEL: PASS (cases run: 11)"
// Plan 12-02: the report model (assets/js/reports.js, NS.reports), proven in Node on stand-in figures.
// The portal is loaded with phase 11's loader (today 2027-01-20). Figures come from a stand-in D written below that
// returns plan 12-01's NS.reportsData shapes (every function takes ws first, 12-CONTEXT W1; the stand-in throws when
// it does not get the workspace first), filled with fund A's hand-worked figures (12-01-PLAN.md) and, for the
// consolidated case, an open-ended US dollar fund and a closed euro fund. The real adapters are proven against the
// same model in plan 12-05.
//   node checks/reports-model.js [--case one,...]
// Files: the sheets case writes its workbook into a folder named with this process's id under P6_OUT (or the system
// temporary folder); the folder, and this check's own part records under P6_OUT/.parts, are removed when the run ends,
// pass or fail (the check runs in seconds, so it keeps no part results for a rerun).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const P6 = path.join(ROOT, '.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const P11 = path.join(ROOT, '.planning/phases/11-fund-accounting-and-cpa-year-end-package/checks');
const { runParts, WORD_RE } = require(P6);
const { loadPortal } = require(path.join(P11, 'load11.js'));
const READER = path.join(P11, 'read-xlsx.py');

const BASE = process.env.P6_OUT || os.tmpdir();
const WORK = path.join(BASE, `reports-model-${process.pid}`);
process.on('exit', () => {
  fs.rmSync(WORK, { recursive: true, force: true });
  // runParts records each part under P6_OUT/.parts/<check>-<hash>; this check leaves nothing behind.
  const parts = path.join(BASE, '.parts');
  try {
    fs.readdirSync(parts)
      .filter((d) => /^reports-model-/.test(d))
      .forEach((d) => fs.rmSync(path.join(parts, d), { recursive: true, force: true }));
    if (!fs.readdirSync(parts).length) fs.rmdirSync(parts);
  } catch (e) {
    /* no part records */
  }
});
['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((sig) =>
  process.on(sig, () => {
    console.log(`FAIL stopped by ${sig}`);
    process.exit(1);
  })
);

const TODAY = '2027-01-20';
const EXTRA = ['books.js', 'books-post.js', 'eligibility.js', 'filesout.js', 'reports.js'];
const WHEN = '2027-01-20T12:00:00.000Z';
const MINUS = '−';
const BAD_RE = /\baudited\b|ILPA compliant|gross (IRR|return|performance|multiple)/i;

const portal = () => loadPortal(ROOT, { today: TODAY, extra: EXTRA });
const clone = (x) => JSON.parse(JSON.stringify(x));
const same = (check, name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });

/* ---------- The workspace: fund A's records plus two more funds for FA-1001 ---------- */
const DISCLAIMER = 'For existing investors of Fund A Sponsor only. Not an offer to sell any security.';
function seat() {
  const F = clone(require(path.join(P11, 'fixtures/fund-a.js')));
  const ws = F.records;
  Object.assign(ws.tenant, {
    portalName: 'Investor Portal',
    disclaimer: DISCLAIMER,
    colors: { primary: '#1F3A5F', accent: '#C9A227' },
    support: { team: 'Investor Relations', email: 'ir@fund-a.example', phone: '+1 (555) 010-0100' }
  });
  ws.offerings.push(
    { id: 'fund-o', name: 'Open Fund, L.P.', shortName: 'Open Fund', type: 'Hedge fund', status: 'Active', currency: 'USD', terms: [] },
    { id: 'fund-r', name: 'Rhine Property Fund SCSp', shortName: 'Rhine Property', type: 'Real estate fund', status: 'Active', currency: 'EUR', terms: [] }
  );
  const one = ws.investors.find((i) => i.id === 'FA-1001');
  one.positions.push({ offeringId: 'fund-o', amount: 100000, commitment: 0, date: '2026-01-02' }, { offeringId: 'fund-r', amount: 50000, commitment: 80000, date: '2026-01-02' });
  return ws;
}

/* ---------- Stand-in figures (12-01's shapes; whole cents) ---------- */
const acct = (from, to, a) => ({ from, to, begin: a[0], contrib: a[1], dist: a[2], income: a[3], gain: a[4], fee: a[5], carry: a[6], end: a[0] + a[1] - a[2] + a[3] + a[4] - a[5] - a[6] });
const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
// FA-1001's month-end capital in fund A (stand-in shape; September and December are the hand-worked 334,000.00 and 345,000.00)
const CAP_1001 = [29900000, 30050000, 30800000, 31000000, 31500000, 32000000, 32500000, 33000000, 33400000, 33300000, 33200000, 34500000];
function figures() {
  return {
    'fund-a': {
      currency: 'USD',
      fundType: 'pe',
      open: false,
      preliminary: true,
      inception: '2026-01-01',
      inv: {
        // Q4 2026: begin 334,000.00, distribution 6,000.00, gain 20,000.00, fees 3 x 1,000.00 (12-01 hand-worked)
        // year 2026: contributions 300,000.00, income 3,000.00, gain 60,000.00, fees 12,000.00
        'FA-1001': {
          period: [33400000, 0, 600000, 0, 2000000, 300000, 0],
          ytd: [0, 30000000, 600000, 300000, 6000000, 1200000, 0],
          commit: 60000000,
          contribCum: 30000000,
          unfunded: 30000000,
          distCum: 600000,
          own: 2 / 3,
          perf: { paid: 30000000, dist: 600000, nav: 34500000, dpi: 0.02, rvpi: 1.15, tvpi: 1.17, irr: 0.2061 },
          dists: [{ runId: 'fa-run-1', date: '2026-12-15', type: 'Realization proceeds', gross: 600000, withheld: 0, net: 600000 }],
          method: 'ACH',
          activity: [
            { date: '2026-01-15', kind: 'contribution', label: 'Capital call 1', cents: 30000000 },
            { date: '2026-12-15', kind: 'distribution', label: 'Realization proceeds', cents: 600000 }
          ],
          capital: CAP_1001,
          qdist: [0, 0, 0, 600000]
        },
        // FA-1002: one third of the fund
        'FA-1002': {
          period: [16700000, 0, 300000, 0, 1000000, 150000, 0],
          ytd: [0, 15000000, 300000, 150000, 3000000, 600000, 0],
          commit: 30000000,
          contribCum: 15000000,
          unfunded: 15000000,
          distCum: 300000,
          own: 1 / 3,
          perf: { paid: 15000000, dist: 300000, nav: 17250000, dpi: 0.02, rvpi: 1.15, tvpi: 1.17, irr: 0.2061 },
          dists: [{ runId: 'fa-run-1', date: '2026-12-15', type: 'Realization proceeds', gross: 300000, withheld: 0, net: 300000 }],
          method: 'Check',
          activity: [
            { date: '2026-01-15', kind: 'contribution', label: 'Capital call 1', cents: 15000000 },
            { date: '2026-12-15', kind: 'distribution', label: 'Realization proceeds', cents: 300000 }
          ],
          capital: CAP_1001.map((c) => c / 2),
          qdist: [0, 0, 0, 300000]
        }
      },
      perf: { kind: 'closed', fund: { paid: 45000000, dist: 900000, nav: 51750000, dpi: 0.02, rvpi: 1.15, tvpi: 1.17, irr: 0.2061 } },
      holdings: { nav: 51750000, rows: [{ id: 'fa-x', name: 'Portfolio Co X', security: 'Preferred equity', level: 3, fv: 49000000, cost: 40000000, debt: 0, equity: 49000000, pctNav: 49000000 / 51750000 }] },
      fees: { source: 'books', rows: [{ code: '5000', name: 'Management fees', cents: 450000 }], total: 450000 },
      noi: {},
      statements: [
        { id: 'al', title: 'Statement of assets and liabilities', desc: 'As of December 31, 2026.', cols: [{ h: 'Line item', t: 'text' }, { h: 'Amount', t: 'money' }], rows: [['Investments, at fair value', 49000000], ['Cash', 2750000], ['Net assets', 51750000]], total: null },
        { id: 'ops', title: 'Statement of operations', desc: 'October 1, 2026 to December 31, 2026.', cols: [{ h: 'Line item', t: 'text' }, { h: 'Amount', t: 'money' }], rows: [['Investment income', 0], ['Management fees', -450000]], total: null },
        { id: 'chg', title: 'Statement of changes in partners’ capital', desc: 'October 1, 2026 to December 31, 2026.', cols: [{ h: 'Line item', t: 'text' }, { h: 'Limited partners', t: 'money' }, { h: 'General partner', t: 'money' }, { h: 'Total', t: 'money' }], rows: [['Beginning of period', 50100000, 0, 50100000], ['End of period', 51750000, 0, 51750000]], total: null }
      ],
      runs: [{ id: 'fa-run-1', date: '2026-12-15', type: 'Realization proceeds', gross: 900000 }],
      fundCapital: CAP_1001.map((c) => c * 1.5),
      fundQdist: [0, 0, 0, 900000]
    },
    'fund-o': {
      currency: 'USD',
      fundType: 'hedge',
      open: true,
      preliminary: true,
      inception: '2026-01-01',
      inv: {
        'FA-1001': {
          // end = 100,000.00 + 5,000.00 - 2,000.00 + 500.00 + 3,000.00 - 400.00 - 600.00 = 105,500.00
          period: [10000000, 500000, 200000, 50000, 300000, 40000, 60000],
          ytd: [0, 10200000, 200000, 50000, 600000, 90000, 60000],
          commit: 0,
          contribCum: 10200000,
          unfunded: 0,
          distCum: 200000,
          own: 0.25,
          perf: null,
          dists: [],
          method: 'ACH',
          activity: [{ date: '2026-01-02', kind: 'contribution', label: 'Subscription', cents: 10200000 }],
          capital: MONTHS.map((m, i) => 10000000 + i * 50000),
          qdist: [0, 0, 0, 0]
        }
      },
      perf: { kind: 'open', monthly: MONTHS.slice(9).map((key) => ({ key, begin: 40000000, contrib: 0, dist: 0, net: 0.0104 })), period: 0.0315, ytd: 0.0842, itd: 0.0842, itdAnnual: 0.0842 },
      holdings: { nav: 42200000, rows: [{ id: 'fo-1', name: 'Listed equities', security: 'Common equity', level: 1, fv: 42200000, cost: 39000000, debt: 0, equity: 42200000, pctNav: 1 }] },
      fees: { source: 'engine', rows: [{ code: '5000', name: 'Management fees', cents: 160000 }], total: 160000 },
      noi: {},
      statements: [],
      runs: [],
      fundCapital: MONTHS.map((m, i) => 40000000 + i * 200000),
      fundQdist: [0, 0, 0, 0]
    },
    'fund-r': {
      currency: 'EUR',
      fundType: 'realestate',
      open: false,
      preliminary: false,
      inception: '2026-01-01',
      inv: {
        'FA-1001': {
          // end = 50,000.00 - 1,000.00 + 800.00 + 1,200.00 - 250.00 = 50,750.00
          period: [5000000, 0, 100000, 80000, 120000, 25000, 0],
          ytd: [0, 5000000, 300000, 240000, 200000, 65000, 0],
          commit: 8000000,
          contribCum: 5000000,
          unfunded: 3000000,
          distCum: 300000,
          own: 0.1,
          perf: { paid: 5000000, dist: 300000, nav: 5075000, dpi: 0.06, rvpi: 1.015, tvpi: 1.075, irr: null },
          dists: [{ runId: 'fr-run-1', date: '2026-12-20', type: 'Income', gross: 100000, withheld: 0, net: 100000 }],
          method: 'Wire',
          activity: [{ date: '2026-01-02', kind: 'contribution', label: 'Capital call 1', cents: 5000000 }],
          capital: MONTHS.map((m, i) => 5000000 + i * 6250),
          qdist: [0, 100000, 100000, 100000]
        }
      },
      perf: { kind: 'closed', fund: { paid: 50000000, dist: 3000000, nav: 50750000, dpi: 0.06, rvpi: 1.015, tvpi: 1.075, irr: 0.081 } },
      holdings: { nav: 50750000, rows: [{ id: 'rh-1', name: 'Harbour Lofts', security: 'Property', level: 3, fv: 50000000, cost: 48000000, debt: 0, equity: 50000000, pctNav: 50000000 / 50750000 }] },
      fees: { source: 'books', rows: [{ code: '5000', name: 'Management fees', cents: 250000 }, { code: '5300', name: 'Property insurance', cents: 40000 }], total: 290000 },
      noi: { 'rh-1': { income: 1000000, expenses: 300000, noi: 700000 } },
      statements: [],
      runs: [{ id: 'fr-run-1', date: '2026-12-20', type: 'Income', gross: 1000000 }],
      fundCapital: MONTHS.map((m, i) => 50000000 + i * 62500),
      fundQdist: [0, 1000000, 1000000, 1000000]
    }
  };
}

/**
 * The stand-in D: plan 12-01's NS.reportsData, every function taking ws first (W1). F: figures() (changed by a case),
 * docs: tax documents by investor. A call without the workspace first throws, so resolve cannot pass while it does so.
 */
function standIn(ws, F, docs) {
  F = F || figures();
  docs = docs || {};
  const calls = [];
  const chk = (name, w) => {
    calls.push(name);
    if (w !== ws) throw new Error(`stand-in D.${name}: the first argument is not the workspace (12-CONTEXT W1)`);
  };
  const off = (oid) => ws.offerings.find((o) => o.id === oid);
  const qlabels = (y) => [1, 2, 3, 4].map((q) => `Q${q} ${y}`);
  const D = {
    calls,
    fundsOf(w, id) {
      chk('fundsOf', w);
      return Object.keys(F)
        .filter((oid) => F[oid].inv[id] && off(oid))
        .map(off)
        .sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    holders(w, oid, to) {
      chk('holders', w);
      const f = F[oid];
      return f ? ws.investors.filter((i) => f.inv[i.id]).sort((a, b) => (a.id < b.id ? -1 : 1)) : [];
    },
    statement(w, id, oid, from, to) {
      chk('statement', w);
      const f = F[oid];
      const r = f && f.inv[id];
      if (!r) return null;
      return {
        offeringId: oid,
        name: off(oid).name,
        currency: f.currency,
        fundType: f.fundType,
        open: f.open,
        generated: false,
        preliminary: f.preliminary,
        period: acct(from, to, r.period),
        ytd: acct(to.slice(0, 4) + '-01-01', to, r.ytd),
        itd: acct(f.inception, to, r.ytd),
        commit: r.commit,
        contribCum: r.contribCum,
        unfunded: r.unfunded,
        distCum: r.distCum,
        own: r.own,
        cls: null,
        feeder: null,
        perf: f.open ? null : clone(r.perf)
      };
    },
    consolidated(w, id, from, to) {
      chk('consolidated', w);
      const funds = D.fundsOf(ws, id).map((o) => D.statement(ws, id, o.id, from, to));
      const totals = [];
      funds.forEach((s) => {
        let t = totals.find((x) => x.currency === s.currency);
        if (!t) totals.push((t = { currency: s.currency, begin: 0, contrib: 0, dist: 0, income: 0, gain: 0, fee: 0, carry: 0, end: 0, commit: 0, unfunded: 0, distCum: 0 }));
        ['begin', 'contrib', 'dist', 'income', 'gain', 'fee', 'carry', 'end'].forEach((k) => (t[k] += s.period[k]));
        ['commit', 'unfunded', 'distCum'].forEach((k) => (t[k] += s[k]));
      });
      return { funds, totals };
    },
    runs(w, oid) {
      chk('runs', w);
      return clone((F[oid] && F[oid].runs) || []);
    },
    distribution(w, runId, id) {
      chk('distribution', w);
      for (const oid of Object.keys(F)) {
        const run = F[oid].runs.find((r) => r.id === runId);
        if (!run) continue;
        const r = F[oid].inv[id];
        const line = r && r.dists.find((d) => d.runId === runId);
        if (!line) return null;
        const cumulative = r.dists.filter((d) => d.date <= line.date).reduce((a, d) => a + d.gross, 0);
        return { runId, offeringId: oid, currency: F[oid].currency, date: line.date, type: line.type, gross: line.gross, withheld: line.withheld, net: line.net, method: r.method, cumulative };
      }
      return null;
    },
    distributions(w, id, oid, from, to) {
      chk('distributions', w);
      const r = F[oid] && F[oid].inv[id];
      const rows = r ? r.dists.filter((d) => d.date >= from && d.date <= to).map(clone) : [];
      const sum = (list) => ({ gross: list.reduce((a, d) => a + d.gross, 0), withheld: list.reduce((a, d) => a + d.withheld, 0), net: list.reduce((a, d) => a + d.net, 0) });
      return { rows, period: sum(rows), ytd: sum(r ? r.dists.filter((d) => d.date.slice(0, 4) === to.slice(0, 4) && d.date <= to) : []), itd: sum(r ? r.dists.filter((d) => d.date <= to) : []) };
    },
    activity(w, id, oid, from, to) {
      chk('activity', w);
      const r = F[oid] && F[oid].inv[id];
      return r ? r.activity.filter((a) => a.date >= from && a.date <= to).map(clone) : [];
    },
    performance(w, oid, from, to) {
      chk('performance', w);
      const f = F[oid];
      return Object.assign({ asOf: to }, clone(f.perf));
    },
    holdings(w, oid, to) {
      chk('holdings', w);
      return Object.assign({ asOf: to }, clone(F[oid].holdings));
    },
    noi(w, oid, hid, from, to) {
      chk('noi', w);
      return F[oid].noi[hid] ? clone(F[oid].noi[hid]) : null;
    },
    fees(w, oid, from, to) {
      chk('fees', w);
      return clone(F[oid].fees);
    },
    statements(w, oid, from, to) {
      chk('statements', w);
      return clone(F[oid].statements);
    },
    series(w, oid, id, from, to) {
      chk('series', w);
      const f = F[oid];
      const y = to.slice(0, 4);
      const r = id ? f.inv[id] : null;
      if (id && !r) return { capital: [], dist: [] };
      const cap = r ? r.capital : f.fundCapital;
      const q = r ? r.qdist : f.fundQdist;
      return { capital: MONTHS.map((key, i) => ({ key, cents: cap[i] })), dist: qlabels(y).map((label, i) => ({ label, cents: q[i] })) };
    },
    taxYear(w, id, year) {
      chk('taxYear', w);
      const funds = [];
      Object.keys(F).forEach((oid) => {
        const r = F[oid].inv[id];
        const runs = r ? r.dists.filter((d) => d.date.slice(0, 4) === String(year)).map(clone) : [];
        if (!runs.length) return;
        const s = (k) => runs.reduce((a, d) => a + d[k], 0);
        funds.push({ offeringId: oid, name: off(oid).name, currency: F[oid].currency, gross: s('gross'), withheld: s('withheld'), net: s('net'), runs });
      });
      return { year: Number(year), funds };
    },
    taxDocs(w, id, year) {
      chk('taxDocs', w);
      return clone((docs[id] || []).filter((d) => d.year === Number(year)));
    },
    firm(w) {
      chk('firm', w);
      const t = ws.tenant;
      return { name: t.name, shortName: t.shortName, legalName: t.legalName, portalName: t.portalName, colors: clone(t.colors || {}), logo: t.logo || '', support: clone(t.support || {}), disclaimer: t.disclaimer || '' };
    },
    investor(w, id) {
      chk('investor', w);
      const i = ws.investors.find((x) => x.id === id);
      return i ? { id: i.id, title: i.title, contact: i.contact, firstName: String(i.contact || '').split(' ')[0] } : null;
    }
  };
  return D;
}

/* ---------- Model helpers ---------- */
const plainRuns = (runs) => (runs || []).map((r) => r.s).join('');
/** Every string anywhere in a value. */
function strings(x, out) {
  out = out || [];
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) x.forEach((y) => strings(y, out));
  else if (x && typeof x === 'object') Object.keys(x).forEach((k) => strings(x[k], out));
  return out;
}
const tables = (model) => model.blocks.filter((b) => b.k === 'table');
const tableNamed = (model, title) => tables(model).find((b) => b.title === title);
const notes = (model) => model.blocks.filter((b) => b.k === 'note').map((b) => b.text);
/** Every money cell of every table and tile holds whole cents. */
function moneyWhole(model) {
  const bad = [];
  tables(model).forEach((t) =>
    t.rows.concat(t.total ? [t.total] : []).forEach((row) =>
      row.forEach((c, i) => {
        if (t.cols[i] && t.cols[i].t === 'money' && c.v != null && !Number.isSafeInteger(c.v)) bad.push(`${t.title}: ${c.v}`);
      })
    )
  );
  model.blocks
    .filter((b) => b.k === 'tiles')
    .forEach((b) => b.items.forEach((it) => it.t === 'money' && it.v != null && !Number.isSafeInteger(it.v) && bad.push(`${it.label}: ${it.v}`)));
  return bad;
}

const Q4 = { from: '2026-10-01', to: '2026-12-31', when: WHEN };
const parts = {
  /** Task 1 (tracer): a blank capital account statement for FA-1001, Q4 2026, with the hand-worked strings and raw cents. */
  async resolve({ check }) {
    const NS = portal();
    const R = NS.reports;
    check('NS.reports is loaded', R && typeof R.resolve === 'function' && typeof R.blank === 'function');
    const ws = seat();
    const D = standIn(ws);
    const t = R.blank('statement', ws);
    same(check, 'blank(statement) holds the statement sections in catalogue order', t.sections.map((s) => s.key), R.CATALOGUE.filter((c) => c.types.indexOf('statement') >= 0).map((c) => c.key));
    check('blank: every section on', t.sections.every((s) => s.on === true));
    same(check, 'blank: disclosures are the tenant disclaimer as one paragraph', t.disclosures, [{ t: 'p', runs: [{ s: DISCLAIMER, b: false, i: false }] }]);
    const spec = Object.assign({ audience: { kind: 'investor', investorId: 'FA-1001', offeringId: 'fund-a' } }, Q4);
    same(check, 'recipients: the one investor', R.recipients(ws, t, spec, D), ['FA-1001']);
    const r = R.resolve(ws, t, spec, 'FA-1001', D);
    same(check, 'no errors', r.errors, []);
    const m = r.model;
    check('a model', m && Array.isArray(m.blocks), m);
    if (!m) return;
    check('every stand-in call took the workspace first (W1)', D.calls.length > 0, D.calls);
    same(check, 'v and kind', [m.v, m.kind], [1, 'statement']);
    same(check, 'title', m.title, 'Capital account statement');
    same(check, 'subtitle', m.subtitle, 'Quarter ended December 31, 2026');
    same(check, 'period (snapped)', m.period, { from: '2026-10-01', to: '2026-12-31' });
    same(check, 'recipient', m.recipient, { id: 'FA-1001', name: 'Investor One' });
    same(check, 'meta.author is the legal name', m.meta.author, 'Fund A Sponsor Management, LLC');
    same(check, 'meta.title', m.meta.title, 'Capital account statement - Quarter ended December 31, 2026');
    same(check, 'when', m.when, WHEN);
    check('cover on with an accent #RRGGBB', m.cover && m.cover.on === true && /^#[0-9A-F]{6}$/.test(m.cover.accent), m.cover);
    check('cover lines name the title and the recipient', m.cover.lines.indexOf('Capital account statement') >= 0 && m.cover.lines.some((l) => /Investor One/.test(l)), m.cover.lines);
    const cap = tableNamed(m, 'Your capital account');
    check('the capital table', !!cap, tables(m).map((x) => x.title));
    if (!cap) return;
    same(check, 'capital columns', cap.cols.map((c) => [c.h, c.t]), [['Line item', 'text'], ['Q4 2026', 'money'], ['Year to date', 'money']]);
    same(check, 'capital currency', cap.currency, 'USD');
    same(check, 'capital row labels', cap.rows.map((row) => row[0].s), ['Beginning capital', 'Contributions', 'Distributions', 'Investment income, net of fund expenses', 'Realized and unrealized gain (loss)', 'Management fees', 'Carried interest']);
    same(check, 'Q4 2026 strings', cap.rows.map((row) => row[1].s), ['$334,000.00', '$0.00', `${MINUS}$6,000.00`, '$0.00', '$20,000.00', `${MINUS}$3,000.00`, '$0.00']);
    same(check, 'Q4 2026 raw cents (distributions and fees negative)', cap.rows.map((row) => row[1].v), [33400000, 0, -600000, 0, 2000000, -300000, 0]);
    same(check, 'Year to date strings', cap.rows.map((row) => row[2].s), ['$0.00', '$300,000.00', `${MINUS}$6,000.00`, '$3,000.00', '$60,000.00', `${MINUS}$12,000.00`, '$0.00']);
    same(check, 'Year to date raw cents', cap.rows.map((row) => row[2].v), [0, 30000000, -600000, 300000, 6000000, -1200000, 0]);
    same(check, 'total row Ending capital', cap.total.map((c) => [c.v, c.s]), [['Ending capital', 'Ending capital'], [34500000, '$345,000.00'], [34500000, '$345,000.00']]);
    check('no negative zero in any cell', !JSON.stringify(cap).includes('-0,') && cap.rows.every((row) => row.every((c) => !Object.is(c.v, -0))));
    same(check, 'every money value whole cents', moneyWhole(m), []);
    check('note: book capital', notes(m).indexOf('Book capital, not tax capital.') >= 0, notes(m));
    check('note: preliminary', notes(m).indexOf('Preliminary: the books are not closed for this period.') >= 0, notes(m));
    const last = m.blocks.slice(-2);
    same(check, 'the last blocks are the disclosures with the tenant disclaimer', last.map((b) => (b.k === 'h2' ? ['h2', b.text] : [b.k, plainRuns(b.runs)])), [['h2', 'Disclosures'], ['p', DISCLAIMER]]);
    check('no HTML anywhere in the model', strings(m).every((s) => !/<[a-z\/!]/i.test(s)));
  },

  /** Task 2: templates keep order, scope, version and the change log. */
  async template({ check }) {
    const NS = portal();
    const R = NS.reports;
    const ws = seat();
    const by = 'gp@fund-a.example';
    const at = '2027-01-20T12:00:00Z';
    const logOf = () => NS.audit.verify(ws);
    const tail = () => (Array.isArray(ws.audit) ? ws.audit[ws.audit.length - 1] : null);
    R.ensure(ws);
    same(check, 'ensure creates ws.reports', ws.reports, { v: 1, templates: [], runs: [], splits: {} });
    ws.reports.runs.push({ id: 'keep' });
    R.ensure(ws);
    same(check, 'ensure leaves existing keys untouched', ws.reports.runs, [{ id: 'keep' }]);
    ws.reports.runs = [];
    const before = logOf().count;
    const t = R.startFrom(ws, 'quarterly', { name: 'Q letter', scope: { firm: true }, by, at });
    same(check, 'startFrom stores rt-1 version 1', [t.id, t.version, t.name, t.type, ws.reports.templates.length], ['rt-1', 1, 'Q letter', 'quarterly', 1]);
    same(check, 'startFrom: updatedBy and updatedAt', [t.updatedBy, t.updatedAt], [by, at]);
    check('one log entry added', logOf().count === before + 1, { before, after: logOf().count });
    check("logged 'Report template created'", tail() && tail().action === 'Report template created' && tail().actor === by && tail().at === at, tail());
    check('audit verify ok after create', logOf().ok === true, logOf());

    const keys = () => t.sections.map((s) => s.key);
    const i = keys().indexOf('holdings');
    const above = keys()[i - 1];
    R.move(t, 'holdings', -1);
    same(check, "move('holdings', -1) swaps it with the section above", [keys()[i - 1], keys()[i]], ['holdings', above]);
    const k0 = keys().slice();
    R.move(t, 'cover', +1);
    same(check, 'cover cannot move down from first', keys(), k0);
    R.move(t, keys()[1], -1);
    same(check, 'nothing moves above the cover', keys(), k0);
    R.move(t, 'disclosures', -1);
    same(check, 'disclosures cannot move up from last', keys(), k0);
    R.move(t, keys()[keys().length - 2], +1);
    same(check, 'nothing moves below the disclosures', keys(), k0);
    t.sections.find((s) => s.key === 'disclosures').on = false;
    t.sections.find((s) => s.key === 'fees').on = false;
    const saved = R.save(ws, t, { by, at: '2027-01-21T09:00:00Z' });
    same(check, 'save gives version 2', [saved.version, ws.reports.templates[0].version], [2, 2]);
    same(check, 'save keeps the order the sponsor set', saved.sections.map((s) => s.key), k0);
    check('save keeps disclosures on and fees off', saved.sections.find((s) => s.key === 'disclosures').on === true && saved.sections.find((s) => s.key === 'fees').on === false);
    check("logged 'Report template saved' with name, version and scope", tail() && tail().action === 'Report template saved' && /Q letter/.test(tail().detail) && /version 2/.test(tail().detail) && /firm/.test(tail().detail), tail());
    check('audit verify ok after save', logOf().ok === true, logOf());

    const bad = clone(saved);
    bad.stray = 1;
    bad.sections = bad.sections.filter((s) => s.key !== 'fees');
    bad.sections.unshift({ key: 'bogus', on: true, opts: {}, text: [] });
    bad.sections.push(clone(bad.sections.find((s) => s.key === 'holdings')));
    const cov = bad.sections.findIndex((s) => s.key === 'cover');
    bad.sections.push(bad.sections.splice(cov, 1)[0]);
    bad.cover.accent = 'red';
    bad.chart = 'pie';
    bad.name = 'N'.repeat(120);
    const n = R.normalise(bad);
    check('normalise drops the stray property', !('stray' in n), Object.keys(n));
    check('normalise drops the unknown section', n.sections.every((s) => s.key !== 'bogus'));
    check('normalise removes the duplicate', n.sections.filter((s) => s.key === 'holdings').length === 1);
    same(check, 'normalise: cover first, disclosures last', [n.sections[0].key, n.sections[n.sections.length - 1].key], ['cover', 'disclosures']);
    const fees = n.sections.find((s) => s.key === 'fees');
    check('normalise appends the missing fees section, off', fees && fees.on === false, fees);
    same(check, "normalise rejects the accent 'red'", n.cover.accent, '');
    same(check, "normalise: accent '#abc' becomes '#AABBCC'", R.normalise(Object.assign(clone(saved), { cover: { style: 'band', accent: '#abc', photoId: '' } })).cover.accent, '#AABBCC');
    same(check, 'normalise: a chart outside the list becomes none', n.chart, 'none');
    same(check, 'normalise: name at most 80 characters', n.name.length, 80);
    same(check, 'normalise: every section of the type present once', n.sections.map((s) => s.key).sort(), R.CATALOGUE.filter((c) => c.types.indexOf('quarterly') >= 0).map((c) => c.key).sort());

    const t2 = R.startFrom(ws, 'statement', { name: 'Fund A statement', scope: { offeringIds: ['fund-a'] }, by, at });
    const t3 = R.startFrom(ws, 'statement', { name: 'Open statement', scope: { offeringIds: ['fund-o'] }, by, at });
    same(check, 'ids rt-2 and rt-3', [t2.id, t3.id], ['rt-2', 'rt-3']);
    same(check, 'templatesFor(fund-a): firm-wide and those naming fund-a', R.templatesFor(ws, 'fund-a').map((x) => x.id), ['rt-1', 'rt-2']);
    R.remove(ws, 'rt-3', { by, at });
    same(check, 'remove deletes the template', ws.reports.templates.map((x) => x.id), ['rt-1', 'rt-2']);
    check("logged 'Report template deleted'", tail() && tail().action === 'Report template deleted', tail());
    check('audit verify ok after delete', logOf().ok === true, logOf());

    const st = R.starters('quarterly');
    check('starters(quarterly) always offers the blank', st.some((s) => s.blank === true && s.type === 'quarterly'), st);
    R.addStarter({ id: 'q-re', name: 'Real estate quarterly', type: 'quarterly', fundType: 'realestate', template: { chart: 'dist' } });
    check('addStarter registers it for its type only', R.starters('quarterly').some((s) => s.id === 'q-re') && !R.starters('tax').some((s) => s.id === 'q-re'));
    const t4 = R.startFrom(ws, 'q-re', { name: 'RE letter', scope: { firm: true }, by, at });
    same(check, 'startFrom a starter keeps its choices', [t4.starter, t4.fundType, t4.chart, t4.version], ['q-re', 'realestate', 'dist', 1]);
    check('audit verify ok at the end', logOf().ok === true, logOf());
  },

  /** Task 2: wording is the block model only. */
  async richtext({ check }) {
    const NS = portal();
    const R = NS.reports;
    const run = (s, b, i) => ({ s, b: !!b, i: !!i });
    const s1 = R.sanitize([
      { t: 'p', runs: [{ s: 'Hello ', b: true, i: false, color: 'red' }, { s: 'world', b: 'yes' }], style: 'x' },
      { t: 'div', runs: [{ s: 'dropped' }] },
      { t: 'h', runs: [{ s: 'Head\u0000ing‮' }] },
      { t: 'ul', items: [[{ s: 'one' }], [{ s: '' }], [{ s: 'two', i: true }]] },
      { t: 'p', runs: [{ s: '<script>x</script>', b: false, i: false }] }
    ]);
    same(check, 'sanitize keeps p, h and ul with runs { s, b, i } only', s1, [
      { t: 'p', runs: [run('Hello ', true), run('world')] },
      { t: 'h', runs: [run('Heading')] },
      { t: 'ul', items: [[run('one')], [run('two', false, true)]] },
      { t: 'p', runs: [run('<script>x</script>')] }
    ]);
    same(check, 'sanitize caps 60 blocks', R.sanitize(Array.from({ length: 61 }, (x, k) => ({ t: 'p', runs: [{ s: 'p' + k }] }))).length, 60);
    const long = R.sanitize([{ t: 'p', runs: [{ s: 'a'.repeat(3000) }, { s: 'b'.repeat(3000), b: true }] }]);
    same(check, 'sanitize caps 5,000 characters per block', long[0].runs.map((r) => r.s.length), [3000, 2000]);
    same(check, 'sanitize strips control characters', R.sanitize([{ t: 'p', runs: [{ s: 'a\u0007b\u0000c‮d' }] }])[0].runs[0].s, 'abcd');
    same(check, 'sanitize of a non-array is empty', R.sanitize('<b>x</b>'), []);

    const tree = [
      { tag: 'p', children: [{ text: 'Hi ' }, { tag: 'b', children: [{ text: 'all' }] }] },
      { tag: 'script', children: [{ text: 'alert(1)' }] },
      { tag: 'ul', children: [{ tag: 'li', children: [{ text: 'one' }] }] },
      { tag: 'img', children: [] }
    ];
    const b = R.fromTree(tree);
    same(check, 'fromTree: a p with a bold run and a ul with one item', b, [{ t: 'p', runs: [run('Hi '), run('all', true)] }, { t: 'ul', items: [[run('one')]] }]);
    check('fromTree: no trace of alert(1)', !JSON.stringify(b).includes('alert'));
    same(check, 'plain() gives the text', R.plain(b), 'Hi all\none');
    same(
      check,
      'fromTree: h2 → h, em → italic, br ends the paragraph, style dropped, span keeps its text',
      R.fromTree([
        { tag: 'h2', children: [{ text: 'Title' }] },
        { tag: 'div', children: [{ text: 'a' }, { tag: 'br', children: [] }, { tag: 'em', children: [{ text: 'b' }] }, { tag: 'span', children: [{ text: 'c' }] }] },
        { tag: 'style', children: [{ text: 'p{color:red}' }] },
        { tag: 'ol', children: [{ tag: 'li', children: [{ tag: 'strong', children: [{ text: 'x' }] }] }, { tag: 'li', children: [{ text: 'y' }] }] },
        { text: 'tail' }
      ]),
      [
        { t: 'h', runs: [run('Title')] },
        { t: 'p', runs: [run('a')] },
        { t: 'p', runs: [run('b', false, true), run('c')] },
        { t: 'ul', items: [[run('x', true)], [run('y')]] },
        { t: 'p', runs: [run('tail')] }
      ]
    );
    const t = R.blank('quarterly', seat());
    t.sections.find((s) => s.key === 'letter').text = [{ t: 'p', runs: [{ s: '<img src=x onerror=alert(1)>' }] }];
    const n = R.normalise(t);
    same(check, 'typed markup stays as plain text in a run (never HTML)', n.sections.find((s) => s.key === 'letter').text, [{ t: 'p', runs: [run('<img src=x onerror=alert(1)>')] }]);
  },

  /** Task 2: merge fields filled from the resolved figures; unknown and unavailable fields are errors. */
  async merge({ check }) {
    const NS = portal();
    const R = NS.reports;
    same(check, 'MERGE_FIELDS is exactly the 12 names', R.MERGE_FIELDS, ['first_name', 'account_name', 'investment', 'firm', 'team', 'phone', 'period', 'period_end', 'ending_capital', 'distributions_period', 'commitment', 'unfunded']);
    const ws = seat();
    const D = standIn(ws);
    const letter = (s, type) => {
      const t = R.blank(type || 'quarterly', ws);
      t.sections.find((x) => x.key === 'letter').text = [{ t: 'p', runs: [{ s, b: false, i: false }] }];
      return t;
    };
    const ALLF = R.MERGE_FIELDS.map((f) => `${f}={${f}}`).join('|');
    const spec = Object.assign({ audience: { kind: 'investor', investorId: 'FA-1001', offeringId: 'fund-a' } }, Q4);
    const r = R.resolve(ws, letter(ALLF), spec, 'FA-1001', D);
    same(check, 'no errors', r.errors, []);
    const p = r.model && r.model.blocks.find((x) => x.k === 'p' && /first_name=/.test(plainRuns(x.runs)));
    same(
      check,
      'every field filled per recipient',
      p && plainRuns(p.runs),
      [
        'first_name=Investor',
        'account_name=Investor One',
        'investment=Fund A, L.P.',
        'firm=Fund A Sponsor',
        'team=Investor Relations',
        'phone=+1 (555) 010-0100',
        'period=Quarter ended December 31, 2026',
        'period_end=December 31, 2026',
        'ending_capital=$345,000.00',
        'distributions_period=$6,000.00',
        'commitment=$600,000.00',
        'unfunded=$300,000.00'
      ].join('|')
    );
    const e1 = R.resolve(ws, letter('Dear {frist_name},'), spec, 'FA-1001', D);
    same(check, "'{frist_name}' is refused naming the field and the section", e1.errors, [{ section: 'letter', field: 'frist_name', message: 'Unknown field {frist_name} in Letter' }]);
    check('no model while an error stands', e1.model === null, e1.model);
    const toAll = { audience: { kind: 'letter', offeringIds: ['fund-a'], statements: false }, from: Q4.from, to: Q4.to, when: WHEN };
    same(check, 'a letter to everyone goes to [null]', R.recipients(ws, letter('x'), toAll, D), [null]);
    const e2 = R.resolve(ws, letter('Dear {first_name},'), toAll, null, D);
    check('an investor field in a letter to everyone is an error naming the field', e2.model === null && e2.errors.length === 1 && e2.errors[0].field === 'first_name' && e2.errors[0].section === 'letter' && /\{first_name\}/.test(e2.errors[0].message), e2.errors);
    const ok2 = R.resolve(ws, letter('From {firm} for {investment}, {period}.'), toAll, null, D);
    check('fund fields in a letter to everyone fill', ok2.errors.length === 0 && ok2.model && ok2.model.blocks.some((x) => x.k === 'p' && plainRuns(x.runs) === 'From Fund A Sponsor for Fund A, L.P., Quarter ended December 31, 2026.'), ok2);
    same(check, 'the letter with statements goes to every holder', R.recipients(ws, letter('x'), Object.assign({}, toAll, { audience: { kind: 'letter', offeringIds: ['fund-a'], statements: true } }), D), ['FA-1001', 'FA-1002']);
    const open = Object.assign({ audience: { kind: 'investor', investorId: 'FA-1001', offeringId: 'fund-o' } }, Q4);
    const e3 = R.resolve(ws, letter('Unfunded: {unfunded}'), open, 'FA-1001', D);
    check('{unfunded} for an open-ended fund is an error', e3.model === null && e3.errors.length === 1 && e3.errors[0].field === 'unfunded', e3.errors);
    const e4 = R.resolve(ws, letter('Commitment: {commitment}'), open, 'FA-1001', D);
    check('{commitment} for an open-ended fund is an error', e4.model === null && e4.errors.length === 1 && e4.errors[0].field === 'commitment', e4.errors);
    const lit = R.resolve(ws, letter('{ x } and {A} and {first_name'), spec, 'FA-1001', D);
    check('braces that are not a field name stay as typed', lit.errors.length === 0 && lit.model.blocks.some((x) => x.k === 'p' && plainRuns(x.runs) === '{ x } and {A} and {first_name'), lit);
    const out = R.fill([{ t: 'p', runs: [{ s: 'Hi {first_name} {zzz}', b: true, i: false }] }], { first_name: 'Ann' });
    same(check, 'fill() fills known values and leaves others as typed', out, [{ t: 'p', runs: [{ s: 'Hi Ann {zzz}', b: true, i: false }] }]);
    same(check, 'fields() lists the names used', R.fields([{ t: 'p', runs: [{ s: '{a_b} {first_name} {a_b}' }] }, { t: 'ul', items: [[{ s: '{firm}' }]] }]), ['a_b', 'first_name', 'firm']);
    const oth = letter('ok');
    oth.sections.find((x) => x.key === 'outlook').text = [{ t: 'p', runs: [{ s: '{nope}' }] }];
    const e5 = R.resolve(ws, oth, spec, 'FA-1001', D);
    same(check, 'an unknown field in the outlook names the Outlook section', e5.errors, [{ section: 'outlook', field: 'nope', message: 'Unknown field {nope} in Outlook' }]);
  },

  /** Task 2: the distribution split (C-06) is exact per investor and stays out of the run's record. */
  async split({ check }) {
    const NS = portal();
    const R = NS.reports;
    const ws = seat();
    const by = 'gp@fund-a.example';
    const at = '2027-01-20T12:00:00Z';
    const runsBefore = JSON.stringify(ws.runs);
    same(check, 'SPLIT_LABELS', R.SPLIT_LABELS, ['Return of capital', 'Income', 'Interest', 'Capital gain', 'Other']);
    const off = R.setSplit(ws, 'fa-run-1', [{ label: 'Return of capital', cents: 450000 }, { label: 'Capital gain', cents: 449999 }], { by, at });
    same(check, "a split one cent short is refused with 'Off by $0.01'", [off.ok, off.error], [false, 'Off by $0.01']);
    check('nothing stored after a refusal', !(ws.reports && ws.reports.splits && ws.reports.splits['fa-run-1']));
    const lab = R.setSplit(ws, 'fa-run-1', [{ label: 'Dividend', cents: 900000 }], { by, at });
    check('a label outside SPLIT_LABELS is refused', lab.ok === false && /Dividend/.test(lab.error), lab);
    const frac = R.setSplit(ws, 'fa-run-1', [{ label: 'Income', cents: 450000.5 }, { label: 'Other', cents: 449999.5 }], { by, at });
    check('cents that are not whole are refused', frac.ok === false, frac);
    const zero = R.setSplit(ws, 'fa-run-1', [{ label: 'Income', cents: 900000 }, { label: 'Other', cents: 0 }], { by, at });
    check('a zero part is refused', zero.ok === false, zero);
    const n0 = NS.audit.verify(ws).count;
    const ok = R.setSplit(ws, 'fa-run-1', [{ label: 'Return of capital', cents: 450000 }, { label: 'Capital gain', cents: 450000 }], { by, at });
    check('450000 + 450000 is stored', ok.ok === true && ws.reports.splits['fa-run-1'] && ws.reports.splits['fa-run-1'].parts.length === 2, { ok, splits: ws.reports && ws.reports.splits });
    const L = ws.audit || [];
    check("logged 'Distribution split entered'", NS.audit.verify(ws).count === n0 + 1 && L.length && L[L.length - 1].action === 'Distribution split entered', L.slice(-1));
    check('audit verify ok', NS.audit.verify(ws).ok === true);
    same(check, 'splitFor FA-1001 (gross 600000)', R.splitFor(ws, 'fa-run-1', 600000), [{ label: 'Return of capital', cents: 300000 }, { label: 'Capital gain', cents: 300000 }]);
    same(check, 'splitFor FA-1002 (gross 300000)', R.splitFor(ws, 'fa-run-1', 300000), [{ label: 'Return of capital', cents: 150000 }, { label: 'Capital gain', cents: 150000 }]);
    check('splitFor without a stored split is null', R.splitFor(ws, 'no-such-run', 100) === null);
    // a run of 3 cents split 1 + 2: every investor's split still sums exactly to its own gross
    ws.runs.push({ id: 'tiny', offeringId: 'fund-a', date: '2026-12-20', type: 'Income', total: 3, status: 'paid', source: 'recorded', lines: [{ investorId: 'FA-1001', grossCents: 2, withheld: [], netCents: 2 }, { investorId: 'FA-1002', grossCents: 1, withheld: [], netCents: 1 }] });
    const tiny = R.setSplit(ws, 'tiny', [{ label: 'Income', cents: 1 }, { label: 'Return of capital', cents: 2 }], { by, at });
    check('parts 1 and 2 on a 3-cent run are stored', tiny.ok === true, tiny);
    const sums = [100, 2, 1, 7].map((g) => [g, (R.splitFor(ws, 'tiny', g) || []).reduce((a, x) => a + x.cents, 0)]);
    check('each investor split sums to its own gross (100, 2, 1, 7 cents)', sums.every(([g, s]) => g === s), sums);
    check('every split part is a safe integer', (R.splitFor(ws, 'tiny', 100) || []).every((x) => Number.isSafeInteger(x.cents)));
    ws.runs.pop();
    same(check, 'ws.runs is unchanged (JSON before and after)', JSON.stringify(ws.runs), runsBefore);
    check('the split lives in ws.reports.splits only', !JSON.stringify(ws.runs).includes('Capital gain'));
  }
};

runParts(parts, { name: 'REPORTS MODEL', unit: 'cases', flag: '--case' });
