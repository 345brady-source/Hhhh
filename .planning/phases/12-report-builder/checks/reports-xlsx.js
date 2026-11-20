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
  }
};

if (require.main === module) {
  require(path.join(T.P6, 'lib.js')).runParts(parts, { name: 'REPORTS XLSX', unit: 'cases', flag: '--case' });
}
