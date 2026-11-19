// gate: node
// last "WORKBOOK: PASS (cases run: 1)"
// Plan 11-03: the workbook writer (assets/js/filesout.js, NS.files.workbook) read back by two independent readers.
// Every case loads the portal's scripts into a fresh sandbox, writes its workbook into a folder named with this
// process's id under P6_OUT (or the system temporary folder) and reads it with checks/read-xlsx.py (openpyxl).
// The folder is removed when the run ends, pass or fail.
//   node checks/workbook.js [--case one,...]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const P6 = path.join(ROOT, '.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const READER = path.join(__dirname, 'read-xlsx.py');
const BASE = process.env.P6_OUT || os.tmpdir();
const WORK = path.join(BASE, `workbook-${process.pid}`);
let made = false;
process.on('exit', () => {
  if (made) fs.rmSync(WORK, { recursive: true, force: true });
});
let seq = 0;
/** A new empty folder for one case, inside this run's folder. */
function folder(name) {
  made = true;
  const d = path.join(WORK, `${name}-${++seq}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** The portal's scripts in a fresh sandbox; returns window.CVPortal. */
function portal() {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window, console, TextEncoder, TextDecoder });
  ['tenants.js', 'data.js', 'audit.js', 'filesout.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8'), ctx, { filename: f }));
  return window.CVPortal;
}

/** Writes the workbook bytes to dir/name and returns the path. */
function save(dir, name, bytes) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.from(bytes));
  return file;
}

/** openpyxl's reading of a file (read-xlsx.py), or throws with its error output. */
function readXlsx(file) {
  const r = spawnSync('python3', ['-I', READER, file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`read-xlsx.py exited ${r.status}: ${(r.stderr || '').slice(-1500)}`);
  return JSON.parse(r.stdout);
}

const MONEY = '#,##0.00;(#,##0.00)';
const COL = (h, t) => ({ h, t: t || 'text' });

/** The hand-worked sheet of the plan, written once. */
function trialBalance() {
  return {
    id: 'tb',
    file: 'tb.csv',
    title: 'Trial balance',
    desc: 'Hand-worked trial balance',
    cols: [COL('Account'), COL('Debit', 'money'), COL('Credit', 'money'), COL('Share', 'pct')],
    rows: [
      ['1000 Cash', 3200000, null, 0.25],
      ['=SUM(A1) & <Co> "X" ’', null, 750000, 0.5],
      ['Łukasz Ż', 123, 1, 0.125]
    ],
    total: ['Total', 3200123, 750001, 0.875],
    currency: 'USD'
  };
}
const TB_TEXT = '=SUM(A1) & <Co> "X" ’';

/** check(name, actual === expected) with both shown on failure. */
function same(check, name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}
/** A cell's value, type and format compared field by field. */
function cellIs(check, cells, ref, v, t, fmt) {
  const c = cells[ref];
  if (!c) return check(`${ref} is present`, false, 'no cell');
  same(check, `${ref} value`, c.v, v);
  if (t) same(check, `${ref} type`, c.t, t);
  if (fmt) same(check, `${ref} format`, c.fmt, fmt);
}

const parts = {
  /** The hand-worked trial balance reads back in openpyxl to the cent, with no formula anywhere. */
  async one({ check }) {
    const NS = portal();
    check('NS.files.workbook exists', NS.files && typeof NS.files.workbook === 'function');
    const bytes = NS.files.workbook([trialBalance()], { title: 'Trial balance' });
    check('returns bytes', bytes instanceof Uint8Array || (bytes && bytes.constructor && bytes.constructor.name === 'Uint8Array'));
    const X = readXlsx(save(folder('one'), 'one.xlsx', bytes));
    same(check, 'one sheet named Trial balance', X.sheets.map((s) => s.name), ['Trial balance']);
    const c = X.sheets[0].cells;
    same(check, 'headings', ['A1', 'B1', 'C1', 'D1'].map((r) => c[r] && c[r].v), ['Account', 'Debit (USD)', 'Credit (USD)', 'Share (%)']);
    cellIs(check, c, 'B2', 32000, 'n', MONEY);
    cellIs(check, c, 'C3', 7500, 'n', MONEY);
    cellIs(check, c, 'B4', 1.23, 'n', MONEY);
    cellIs(check, c, 'C4', 0.01, 'n', MONEY);
    cellIs(check, c, 'D2', 0.25, 'n', '0.00%');
    cellIs(check, c, 'B5', 32001.23, 'n', MONEY);
    cellIs(check, c, 'C5', 7500.01, 'n', MONEY);
    cellIs(check, c, 'D5', 0.875, 'n', '0.00%');
    cellIs(check, c, 'A3', TB_TEXT, 's');
    cellIs(check, c, 'A4', 'Łukasz Ż', 's');
    cellIs(check, c, 'A5', 'Total', 's');
    check('C2 and B3 (null) have no cell', !c.C2 && !c.B3, { C2: c.C2, B3: c.B3 });
    check('five rows', X.sheets[0].max_row === 5, X.sheets[0].max_row);
    check('heading and total rows bold, data rows not', ['A1', 'D1', 'A5', 'C5'].every((r) => c[r] && c[r].b) && ['A2', 'B2', 'A4'].every((r) => c[r] && !c[r].b));
    check('no cell holds a formula (openpyxl)', Object.values(c).every((x) => !x.f));
    same(check, 'no <f> element in any worksheet part', X.raw_formulas, 0);
  }
};

if (require.main === module) {
  require(P6).runParts(parts, { name: 'WORKBOOK', unit: 'cases', flag: '--case' });
}
