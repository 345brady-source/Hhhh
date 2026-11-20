// gate: node
// last "REPORTS XLSX: PASS (cases run: 4)"
// Plan 12-05: every report type's spreadsheet (NS.reports.sheets → NS.files.workbook) reopened by an independent reader
// (python3 -I P11/checks/read-xlsx.py, openpyxl, read only). Models come from the starters through the real figures, as
// in checks/reports-starters.js. Workbooks are written into lib12.work('reports-xlsx') (under P6_OUT, named with this
// process's id, removed when the run ends, pass or fail).
//   node checks/reports-xlsx.js [--case fund-a,types,inject,selfcheck]
'use strict';
const path = require('path');
const T = require('./lib12.js');
const S = require('./reports-starters.js');

const J = (x) => JSON.stringify(x);
const MONEY_FMT = '#,##0.00;(#,##0.00)';
const WHEN = new Date(Date.UTC(2027, 0, 20));

let seq = 0;
/** The model's workbook written and reopened: { sheets (schedule objects), X (the reader's object) }. */
function reopen(L, model, name) {
  const sheets = L.NS.reports.sheets(model);
  const file = T.save(T.work('reports-xlsx'), `${name}-${++seq}.xlsx`, L.NS.files.workbook(sheets, { when: WHEN }));
  return { sheets, X: T.xlsx(file) };
}
/** A resolved model of a starter, or null after a FAIL line. */
function modelOf(L, ws, id, spec, rid, check, what) {
  const t = S.template(L.NS, ws, id);
  const r = L.NS.reports.resolve(ws, t, Object.assign({ when: S.WHEN }, spec), rid);
  check(`${what}: resolve gives no error`, r.errors.length === 0 && !!r.model, r.errors);
  return r.model;
}

const parts = {
  /** Task 1 (tracer): st-capital for FA-1001, Q4 2026: the capital sheet's money cells to the cent, as numbers. */
  async 'fund-a'({ check }) {
    const L = S.load();
    const { ws } = T.fundA(L.NS);
    const m = modelOf(L, ws, 'st-capital', Object.assign({ audience: { kind: 'investor', investorId: 'FA-1001', offeringId: 'fund-a' } }, S.Q4), 'FA-1001', check, 'st-capital');
    if (!m) return;
    const { X } = reopen(L, m, 'st-capital');
    check("the first sheet is 'Report'", X.sheets[0] && X.sheets[0].name === 'Report', X.sheets.map((s) => s.name));
    const cs = X.sheets.find((s) => s.name === 'Your capital account');
    check("a sheet 'Your capital account'", !!cs, X.sheets.map((s) => s.name));
    if (cs) {
      // Rows 2-8 are the seven line items, row 9 the ending capital; B is Q4 2026, C the year to date.
      const want = {
        B: [334000.0, 0.0, -6000.0, 0.0, 20000.0, -3000.0, 0.0, 345000.0],
        C: [0.0, 300000.0, -6000.0, 3000.0, 60000.0, -12000.0, 0.0, 345000.0]
      };
      ['B', 'C'].forEach((c) => {
        const got = want[c].map((w, k) => cs.cells[c + (k + 2)]);
        check(`column ${c}: ${J(want[c])} as numbers`, got.every((x, k) => x && x.t === 'n' && x.v === want[c][k]), got);
        check(`column ${c}: the money format ${MONEY_FMT}`, got.every((x) => x && x.fmt === MONEY_FMT), got.map((x) => x && x.fmt));
      });
    }
    check('no formula in any worksheet part', X.raw_formulas === 0, X.raw_formulas);
    check('no cell holds a formula (openpyxl)', X.sheets.every((s) => Object.values(s.cells).every((c) => !c.f)));
  },

  /**
   * Task 3: one workbook per report type, reopened: 'Report' first, one sheet per table block, every money cell a number
   * equal to the model's cents / 100 in the money format, every percent cell the model's fraction, no formula, and no
   * document-properties part naming an application.
   */
  async types({ check }) {
    const L = S.load();
    const { NS } = L;
    const { sampleWorkspaces } = require(path.join(T.P11, 'checks/load11.js'));
    const fa = T.fundA(NS).ws;
    const firms = sampleWorkspaces(NS);
    const ar = firms.find((w) => w.tenant.id === 'ashwell-ridge');
    const kb = firms.find((w) => w.tenant.id === 'kestrel-bay');
    const arFirst = NS.reportsData.holders(ar, 'ar-cedar-row', '2026-12-31')[0].id;
    const kbFirst = NS.reportsData.holders(kb, 'kb-fund-ii', '2026-12-31')[0].id;
    const inv = (id, oid) => ({ kind: 'investor', investorId: id, offeringId: oid });
    const runs = [
      ['st-capital', fa, Object.assign({ audience: inv('FA-1001', 'fund-a') }, S.Q4), 'FA-1001'],
      ['dn-notice', fa, { runId: 'fa-run-1', audience: { kind: 'investor', investorId: 'FA-1001' } }, 'FA-1001'],
      ['q-realestate', ar, Object.assign({ audience: inv(arFirst, 'ar-cedar-row') }, S.Q4), arFirst],
      ['a-review', kb, Object.assign({ audience: inv(kbFirst, 'kb-fund-ii') }, S.Y2026), kbFirst],
      ['p-summary', fa, Object.assign({ audience: inv('FA-1001', 'fund-a') }, S.Y2026), 'FA-1001'],
      ['t-season', fa, { year: 2026, audience: { kind: 'investor', investorId: 'FA-1001' } }, 'FA-1001']
    ];
    for (const [id, ws, spec, rid] of runs) {
      const m = modelOf(L, ws, id, spec, rid, check, id);
      if (!m) continue;
      const { sheets, X } = reopen(L, m, id);
      const tables = m.blocks.filter((b) => b.k === 'table');
      const reports = sheets.length - tables.length;
      check(`${id}: 'Report' first, then one sheet per table block (${tables.length})`, X.sheets.length === sheets.length && X.sheets[0].name === 'Report' && reports >= 1 && sheets.slice(0, reports).every((s) => /^Report/.test(s.title)), { names: X.sheets.map((s) => s.name), tables: tables.length });
      if (id === 'a-review') {
        const titles = NS.reportsData.statements(ws, 'kb-fund-ii', S.Y2026.from, S.Y2026.to).map((s) => [s.id, s.title]);
        const names = X.sheets.map((s) => s.name);
        check("a-review: the 'al', 'ops' and 'chg' statements each have their sheet", J(titles.map((t) => t[0])) === J(['al', 'ops', 'chg']) && titles.every((t) => names.indexOf(t[1].slice(0, 31)) >= 0), { titles, names });
      }
      // Each schedule object k is worksheet k; table sheets carry the model's own cells.
      const bad = [];
      let money = 0;
      let pct = 0;
      sheets.forEach((s, k) => {
        const cells = X.sheets[k] ? X.sheets[k].cells : {};
        const table = k >= reports ? tables[k - reports] : null;
        const rows = (s.rows || []).map((r, i) => ({ r: i + 2, vals: table ? table.rows[i].map((c) => c.v) : r }));
        if (s.total) rows.push({ r: s.rows.length + 2, vals: table ? table.total.map((c) => c.v) : s.total });
        rows.forEach(({ r, vals }) =>
          s.cols.forEach((c, i) => {
            const v = vals[i];
            if (typeof v !== 'number') return;
            const x = cells[String.fromCharCode(65 + i) + r];
            if (c.t === 'money') {
              money++;
              if (!x || x.t !== 'n' || x.v !== v / 100 || x.fmt !== MONEY_FMT) bad.push({ sheet: s.title, ref: String.fromCharCode(65 + i) + r, want: v / 100, got: x });
            } else if (c.t === 'pct') {
              pct++;
              if (!x || x.t !== 'n' || Math.abs(x.v - v) > 1e-12 || x.fmt !== '0.00%') bad.push({ sheet: s.title, ref: String.fromCharCode(65 + i) + r, want: v, got: x });
            }
          })
        );
      });
      check(`${id}: every money cell (${money}) is a number equal to the model's cents / 100 in ${MONEY_FMT}; every percent cell (${pct}) is the model's fraction`, money > 0 && !bad.length, bad.slice(0, 4));
      check(`${id}: no formula (raw ${X.raw_formulas}, openpyxl none)`, X.raw_formulas === 0 && X.sheets.every((s) => Object.values(s.cells).every((c) => !c.f)), X.raw_formulas);
      check(`${id}: no document-properties part naming an application`, !X.parts.some((p) => /^docProps\//i.test(p)), X.parts);
    }
  },

  /** Task 3 (T-12-23): typed figure labels starting with = + - and @ stay text in the workbook. */
  async inject({ check }) {
    const L = S.load();
    const { NS } = L;
    const { sampleWorkspaces } = require(path.join(T.P11, 'checks/load11.js'));
    const ws = sampleWorkspaces(NS).find((w) => w.tenant.id === 'ashwell-ridge');
    // The sample holdings are generated rows with no id until plan 11-11 moves holdings onto the journal (12-01); here
    // the real figures are used with each holding row given the id the journal will give it, so an asset item can name it.
    const D = Object.assign({}, NS.reportsData, {
      holdings(w, oid, to) {
        const H = NS.reportsData.holdings(w, oid, to);
        return H && Object.assign({}, H, { rows: H.rows.map((h, k) => Object.assign({}, h, { id: h.id || `h${k + 1}` })) });
      }
    });
    const LABELS = ['=HYPERLINK("http://x","y")', '+1', '-2', '@x'];
    const t = S.template(NS, ws, 'q-realestate');
    t.sections.find((s) => s.key === 'assets').opts.items = [{ holdingId: 'h1', photoIds: [], text: [], figures: LABELS.map((label, k) => ({ label, value: `Value ${k + 1}` })) }];
    const rid = NS.reportsData.holders(ws, 'ar-cedar-row', '2026-12-31')[0].id;
    const r = NS.reports.resolve(ws, t, Object.assign({ when: S.WHEN, audience: { kind: 'investor', investorId: rid, offeringId: 'ar-cedar-row' } }, S.Q4), rid, D);
    check('the model resolves', r.errors.length === 0 && !!r.model, r.errors);
    if (!r.model) return;
    const fig = r.model.blocks.find((b) => b.k === 'table' && /^Figures: /.test(b.title));
    check('the model carries the four labels as typed', !!fig && J(fig.rows.map((row) => row[0].v)) === J(LABELS), fig && fig.rows);
    const { sheets, X } = reopen(L, r.model, 'inject');
    const k = sheets.findIndex((s) => /^Figures: /.test(s.title));
    const cells = k >= 0 && X.sheets[k] ? X.sheets[k].cells : {};
    LABELS.forEach((label, i) => {
      const c = cells['A' + (i + 2)];
      check(`the label ${J(label)} is a text cell equal to the typed text`, !!c && c.t === 's' && c.v === label && !c.f, c);
    });
    check('raw formulas stay 0', X.raw_formulas === 0 && X.sheets.every((s) => Object.values(s.cells).every((c) => !c.f)), X.raw_formulas);
  },

  /** The check itself can fail: an unknown case name and an empty list each exit 1 with a FAIL line. */
  async selfcheck({ check }) {
    const { spawnSync } = require('child_process');
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8', env: process.env });
    const u = run(['--case', 'nonesuch']);
    check('an unknown --case name exits 1 with a FAIL line', u.status === 1 && /^FAIL unknown case name: nonesuch/m.test(u.stdout), { status: u.status, out: u.stdout.slice(-300) });
    const e = run(['--case', '']);
    check('an empty --case list exits 1 with a FAIL line', e.status === 1 && /^FAIL no cases to run/m.test(e.stdout), { status: e.status, out: e.stdout.slice(-300) });
  }
};

if (require.main === module) {
  require(path.join(T.P6, 'lib.js')).runParts(parts, { name: 'REPORTS XLSX', unit: 'cases', flag: '--case' });
}
