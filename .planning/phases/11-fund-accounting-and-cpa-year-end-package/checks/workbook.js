// gate: node
// last "WORKBOOK: PASS (cases run: 7)"
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
// stopped from outside (a timeout, Ctrl-C): the folder is still removed
['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((sig) =>
  process.on(sig, () => {
    console.log(`FAIL stopped by ${sig}`);
    process.exit(1);
  })
);
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
    same(check, 'the seven parts, one worksheet', X.parts.slice().sort(), ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'].sort());
  },

  /** One column of each type, a null in each column, zero kept, the currency in the money heading. */
  async types({ check }) {
    const NS = portal();
    const s = {
      title: 'Types',
      cols: [COL('Name'), COL('Amount', 'money'), COL('Share', 'pct'), COL('Multiple', 'ratio'), COL('Price', 'price'), COL('Count', 'int'), COL('Date', 'date'), COL('Units', 'qty')],
      rows: [
        ['Alpha', -1, 0.0375, 1.5, 12.345, 42, '2026-12-31', 10.5],
        ['', null, null, null, null, null, null, '1.25000000'],
        [null, 0, 1, 0, 0, 0, null, null],
        ['Big', 900719925474099, -0.5, 2, 1, -3, '2027-01-01', 'n/a']
      ],
      total: null,
      currency: 'EUR'
    };
    const X = readXlsx(save(folder('types'), 'types.xlsx', NS.files.workbook([s])));
    const c = X.sheets[0].cells;
    same(check, 'headings (currency and percent as the CSV files write them)', ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1'].map((r) => c[r] && c[r].v), ['Name', 'Amount (EUR)', 'Share (%)', 'Multiple', 'Price', 'Count', 'Date', 'Units']);
    cellIs(check, c, 'A2', 'Alpha', 's', 'General');
    cellIs(check, c, 'B2', -0.01, 'n', MONEY);
    cellIs(check, c, 'C2', 0.0375, 'n', '0.00%');
    cellIs(check, c, 'D2', 1.5, 'n', '0.00');
    cellIs(check, c, 'E2', 12.345, 'n', '0.00');
    cellIs(check, c, 'F2', 42, 'n', '0');
    cellIs(check, c, 'G2', '2026-12-31', 's', 'General');
    cellIs(check, c, 'H2', 10.5, 'n', 'General');
    same(check, 'row 3: only the quantity text (empty text and nulls write no cell)', Object.keys(c).filter((r) => /^[A-Z]+3$/.test(r)), ['H3']);
    cellIs(check, c, 'H3', '1.25000000', 's');
    same(check, 'row 4: zeros are kept, nulls absent', Object.keys(c).filter((r) => /^[A-Z]+4$/.test(r)).sort(), ['B4', 'C4', 'D4', 'E4', 'F4']);
    cellIs(check, c, 'B4', 0, 'n', MONEY);
    cellIs(check, c, 'C4', 1, 'n', '0.00%');
    cellIs(check, c, 'F4', 0, 'n', '0');
    cellIs(check, c, 'B5', 9007199254740.99, 'n', MONEY);
    cellIs(check, c, 'C5', -0.5, 'n', '0.00%');
    cellIs(check, c, 'F5', -3, 'n', '0');
    cellIs(check, c, 'H5', 'n/a', 's');
    check('no total row: five rows', X.sheets[0].max_row === 5, X.sheets[0].max_row);
    check('only the heading row is bold', Object.entries(c).every(([r, x]) => x.b === /^[A-Z]+1$/.test(r)));
    same(check, 'no formula', [X.raw_formulas, Object.values(c).filter((x) => x.f).length], [0, 0]);
    // a value that cannot be written exactly stops the file instead of writing a wrong number
    const err = (fn) => {
      try {
        fn();
        return '';
      } catch (e) {
        return String(e && e.message);
      }
    };
    check('money that is not whole cents throws', /whole cents/.test(err(() => NS.files.workbook([{ title: 'x', cols: [COL('A', 'money')], rows: [[1.5]] }]))));
    check('a number that is not finite throws', /not a number/.test(err(() => NS.files.workbook([{ title: 'x', cols: [COL('A', 'pct')], rows: [[NaN]] }]))));
    check('an empty sheet list throws', /at least one sheet/.test(err(() => NS.files.workbook([]))));
  },

  /** Text that a spreadsheet could run, markup and other scripts all read back as the same text. */
  async 'text-safe'({ check }) {
    const NS = portal();
    const texts = ['=1+2', '+SUM(A1:A9)', '-2+3', '@cmd', '\tTAB', '=HYPERLINK("x","y")', 'A & B <c> "d" ’ \'e\'', 'Łukasz Ż', 'emoji 😀 end', 'two\nlines', 'cr\r\nlf', '  spaces  ', '</t></is></c><c r="Z9"><f>1+1</f></c>'];
    const s = { title: 'Text', cols: [COL('Text & <heading> "q"'), COL('Amount', 'money')], rows: texts.map((t) => [t, 100]), total: ['=SUM(B2:B14)', 1300], currency: 'USD' };
    const X = readXlsx(save(folder('text'), 'text.xlsx', NS.files.workbook([s])));
    const c = X.sheets[0].cells;
    cellIs(check, c, 'A1', 'Text & <heading> "q"', 's');
    texts.forEach((t, k) => same(check, `A${k + 2} reads back as the same text: ${JSON.stringify(t).slice(0, 40)}`, c[`A${k + 2}`] && [c[`A${k + 2}`].v, c[`A${k + 2}`].t], [t, 's']));
    cellIs(check, c, `A${texts.length + 2}`, '=SUM(B2:B14)', 's');
    cellIs(check, c, `B${texts.length + 2}`, 13, 'n', MONEY);
    check('no cell outside the two columns (the markup text made no cell of its own)', Object.keys(c).every((r) => /^[AB]\d+$/.test(r)), Object.keys(c).filter((r) => !/^[AB]\d+$/.test(r)));
    same(check, 'no cell holds a formula (openpyxl)', Object.entries(c).filter(([, x]) => x.f).map(([r]) => r), []);
    same(check, 'no <f> element in any worksheet part', X.raw_formulas, 0);
    // characters XML cannot carry are dropped rather than breaking the file
    const Y = readXlsx(save(folder('text'), 'ctl.xlsx', NS.files.workbook([{ title: 'Ctl', cols: [COL('A')], rows: [['bell\u0007 and nul\u0000 end'], ['lone \uD800 high']] }])));
    same(check, 'control characters dropped, a lone surrogate replaced', [Y.sheets[0].cells.A2.v, Y.sheets[0].cells.A3.v], ['bell and nul end', 'lone � high']);
  },

  /** Sheet names within the limits, unique, and every allowed character kept. */
  async names({ check }) {
    const NS = portal();
    const forty = 'Schedule of investments and fair values!';
    check('the forty-character title is 40 characters (test data)', forty.length === 40, forty.length);
    same(check, 'a 40-character title gives its first 31 characters', NS.files.sheetName(forty), forty.slice(0, 31));
    same(check, "'A/B:C?D*[E]' gives 'ABCDE'", NS.files.sheetName('A/B:C?D*[E]'), 'ABCDE');
    same(check, 'a backslash is removed', NS.files.sheetName('X\\Y'), 'XY');
    same(check, 'apostrophes at the ends are removed', NS.files.sheetName("'Quoted'"), 'Quoted');
    same(check, 'an empty title gives Sheet', NS.files.sheetName('  '), 'Sheet');
    const used = new Set();
    same(check, 'sheetName adds to the set it is given', [NS.files.sheetName('Trial balance', used), NS.files.sheetName('Trial balance', used), used.size], ['Trial balance', 'Trial balance (2)', 2]);
    const titles = ['Trial balance', 'Trial balance', 'TRIAL BALANCE', 'A/B:C?D*[E]', forty, forty, 'Łukasz & <Co> "X" ’'];
    const want = ['Trial balance', 'Trial balance (2)', 'TRIAL BALANCE (3)', 'ABCDE', forty.slice(0, 31), forty.slice(0, 27) + ' (2)', 'Łukasz & <Co> "X" ’'];
    const sheets = titles.map((t, k) => ({ title: t, cols: [COL('N', 'int')], rows: [[k]], currency: 'USD' }));
    const X = readXlsx(save(folder('names'), 'names.xlsx', NS.files.workbook(sheets)));
    same(check, 'openpyxl reads the same names, in order', X.sheets.map((s) => s.name), want);
    check('every name is at most 31 characters and free of : \\ / ? * [ ]', X.sheets.every((s) => s.name.length <= 31 && !/[:\\/?*[\]]/.test(s.name)));
    same(check, 'each sheet holds its own row', X.sheets.map((s) => s.cells.A2 && s.cells.A2.v), titles.map((t, k) => k));
  },

  /** 2,000 rows of money and the total read back exactly. */
  async large({ check }) {
    const NS = portal();
    const X = readXlsx(save(folder('large'), 'large.xlsx', NS.files.workbook([large()])));
    const sh = X.sheets[0];
    same(check, '2,002 rows (heading, 2,000 rows, total)', sh.max_row, 2002);
    cellIs(check, sh.cells, 'B2', 0.01, 'n', MONEY);
    cellIs(check, sh.cells, 'B2001', 20, 'n', MONEY);
    cellIs(check, sh.cells, 'B2002', 20010, 'n', MONEY);
    cellIs(check, sh.cells, 'A2002', 'Total', 's');
    const wrong = [];
    let sum = 0;
    for (let i = 1; i <= 2000; i++) {
      const x = sh.cells[`B${i + 1}`];
      const cents = x ? Math.round(x.v * 100) : NaN;
      if (cents !== i || x.v !== Number((i / 100).toFixed(2))) wrong.push(`B${i + 1}`);
      sum += cents;
    }
    same(check, 'every row is its cents exactly', wrong.slice(0, 10), []);
    same(check, 'the rows add up to the total in cents', sum, 2001000);
  },

  /** LibreOffice converts the hand-worked sheet and the large sheet to CSV with the raw values. */
  async libre({ check }) {
    const NS = portal();
    const dir = folder('libre');
    const file = save(dir, 'book.xlsx', NS.files.workbook([trialBalance(), large()]));
    const csv = libreCsv(dir, file);
    same(check, 'one CSV per sheet', Object.keys(csv).sort(), ['Large', 'Trial balance']);
    const tb = csv['Trial balance'] || [];
    same(check, 'Trial balance heading row', tb[0], ['Account', 'Debit (USD)', 'Credit (USD)', 'Share (%)']);
    // Raw values: the money columns carry no grouping and no fixed decimals (32000, not 32,000.00). LibreOffice writes
    // a percent-formatted cell with its % sign even in this mode, and without the format's fixed decimals (12.5%, not
    // 12.50%): the same fractions 0.25, 0.5, 0.125 and 0.875 the sheet was written with (measured 2026-11-19).
    same(check, 'Trial balance row 2: 32000 in column B', tb[1], ['1000 Cash', '32000', '', '25%']);
    same(check, 'Trial balance row 3: the text as written, 7500 in column C', tb[2], [TB_TEXT, '', '7500', '50%']);
    same(check, 'Trial balance row 4', tb[3], ['Łukasz Ż', '1.23', '0.01', '12.5%']);
    same(check, 'Trial balance total row (row 5): 32001.23 and 7500.01', tb[4], ['Total', '32001.23', '7500.01', '87.5%']);
    same(check, 'Trial balance has five lines', tb.length, 5);
    const lg = csv.Large || [];
    same(check, 'Large has 2,002 lines', lg.length, 2002);
    same(check, "Large's last line holds 20010", lg[lg.length - 1], ['Total', '20010']);
    same(check, "Large's line 2001 holds 20", lg[2000], ['Line 2000', '20']);
  },

  /** The rules of the check itself, and nothing in filesout.js that could reach the network. */
  async selfcheck({ check }) {
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8', env: process.env });
    const u = run(['--case', 'nonesuch']);
    check('an unknown --case name exits 1 with a FAIL line', u.status === 1 && /^FAIL unknown case name: nonesuch/m.test(u.stdout), { status: u.status, out: u.stdout.slice(-300) });
    const e = run(['--case', '']);
    check('an empty --case list exits 1 with a FAIL line', e.status === 1 && /^FAIL no cases to run/m.test(e.stdout), { status: e.status, out: e.stdout.slice(-300) });
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/filesout.js'), 'utf8');
    same(check, 'filesout.js holds nothing that loads or fetches (the XML namespace strings excepted)', reach(src), []);
    same(check, 'each allowed namespace string is in filesout.js as written', ALLOWED.filter((a) => src.indexOf(`'${a}'`) < 0), []);
    check('filesout.js uses the audit zip writer and its own UTF-8 encoder', /NS\.audit\.zip\(/.test(src) && /function utf8\(/.test(src) && src.indexOf('TextEncoder') < 0);
    same(check, 'the scan finds what it looks for (controls)', ["fetch('x')", 'new XMLHttpRequest()', "import('m')", "require('m')", 'new Worker(u)', "document.createElement('script')", "'http://x'", "'https://x'"].map((t) => reach(src + '\n' + t).length), [1, 1, 1, 1, 1, 1, 1, 1]);
  }
};

/** The large schedule: 2,000 rows of 1..2,000 cents and their total, 2,001,000 cents. */
function large() {
  const rows = [];
  for (let i = 1; i <= 2000; i++) rows.push([`Line ${i}`, i]);
  return { title: 'Large', cols: [COL('Line'), COL('Amount', 'money')], rows, total: ['Total', 2001000], currency: 'USD' };
}

// The XML namespace strings a workbook must name, listed by value: the only addresses filesout.js may hold.
const ALLOWED = [
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://schemas.openxmlformats.org/package/2006/content-types',
  'http://schemas.openxmlformats.org/package/2006/relationships',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles'
];
const FORBIDDEN = ['fetch(', 'XMLHttpRequest', 'import(', 'require(', 'new Worker', "createElement('script')", 'createElement("script")', 'http://', 'https://', 'WebSocket', 'EventSource', 'sendBeacon', 'importScripts'];
/** The forbidden strings left in a source once each allowed namespace string (quoted, as written) is taken out. */
function reach(src) {
  let s = src;
  ALLOWED.slice()
    .sort((a, b) => b.length - a.length)
    .forEach((a) => (s = s.split(`'${a}'`).join("''")));
  return FORBIDDEN.filter((t) => s.indexOf(t) >= 0);
}

/** The LibreOffice CSV export of every sheet of a file (B1's filter options: raw values, one file per sheet). */
function libreCsv(dir, file) {
  const HEAVY = path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-011/heavy.sh');
  const out = path.join(dir, 'csv');
  fs.mkdirSync(out);
  const cmd = ['timeout', '120', 'soffice', '--headless', `-env:UserInstallation=file://${path.join(dir, 'lo')}`, '--convert-to', 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1', '--outdir', out, file];
  const r = fs.existsSync(HEAVY) ? spawnSync('bash', [HEAVY].concat(cmd), { encoding: 'utf8' }) : spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`LibreOffice exited ${r.status}: ${(r.stderr || '') + (r.stdout || '')}`.slice(0, 1500));
  const stem = path.basename(file, '.xlsx') + '-';
  const res = {};
  fs.readdirSync(out)
    .filter((f) => f.endsWith('.csv'))
    .forEach((f) => (res[f.startsWith(stem) ? f.slice(stem.length, -4) : f.slice(0, -4)] = parseCsv(fs.readFileSync(path.join(out, f), 'utf8'))));
  return res;
}
/** RFC 4180 rows; a byte order mark and the last line ending are ignored. */
function parseCsv(text) {
  const t = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let f = '';
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') {
        f += '"';
        i++;
      } else if (ch === '"') q = false;
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(f);
      f = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(f);
      rows.push(row);
      row = [];
      f = '';
    } else f += ch;
  }
  if (f || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}

if (require.main === module) {
  require(P6).runParts(parts, { name: 'WORKBOOK', unit: 'cases', flag: '--case' });
}
