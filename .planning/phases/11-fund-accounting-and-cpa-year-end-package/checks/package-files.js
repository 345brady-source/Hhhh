// gate: node
// last "PACKAGE FILES: PASS (cases run: 6)"
// The CPA year-end package's files (plan 11-16, no browser): NS.books.packageFiles(ws, o, year, { includeForms, actor,
// now, kit }) writes the sheets of plan 11-14 as a workbook, a PDF and one CSV each, with a README and a SHA-256
// manifest, zipped in the browser. The portal is loaded inside each case with load11.js (the scripts diy.html lists,
// then the shipped PDF writer, font embedder and Unicode font, books.js, books-post.js, bankfiles.js, books-bank.js,
// books-hold.js, withholding.js, filesout.js and books-pkg.js); the kit is built from those shipped files, as
// pdf-out.js does. Each package is written into a folder named with this process's id under P6_OUT (or the system
// temporary folder) and read back with python3 -I (zipfile; checks/read-xlsx.py for the workbook), LibreOffice
// headless with its own profile folder, and pdftotext; the folder is removed when the run ends, pass or fail.
// Fund A's tax facts are written onto the loaded copy here (as package.js does); fixtures/fund-a.js is not changed.
// Every expected figure is the plan's hand-worked one (11-16-PLAN.md).
//   node package-files.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "PACKAGE FILES: PASS (cases run: N)" or
// "PACKAGE FILES: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal } = require('./load11.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const READER = path.join(__dirname, 'read-xlsx.py');
const BASE = process.env.P6_OUT || os.tmpdir();
const WORK = path.join(BASE, `package-files-${process.pid}`);
let made = false;
process.on('exit', () => {
  if (made) fs.rmSync(WORK, { recursive: true, force: true });
});
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

const TODAY = '2027-01-20';
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
const SHIPPED = ['../vendor/pdfwrite/write.js', '../vendor/pdfwrite/fonts.js', '../vendor/textfont/text-regular.js'];
const EXTRA = ['books.js', 'books-post.js', 'bankfiles.js', 'books-bank.js', 'books-hold.js', 'withholding.js', 'filesout.js', 'books-pkg.js'];
const J = (x) => JSON.stringify(x);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const globalOf = (NS) => NS.constructor.constructor('return this')();

/** The portal with the books, withholding, the file writers and the package, and the kit from the shipped writer. */
function load(today, edition) {
  const NS = loadPortal(undefined, { today: today || TODAY, edition: edition || 'diy', extra: SHIPPED.concat(EXTRA) });
  if (!NS.books || typeof NS.books.package !== 'function') throw new Error('books-pkg.js did not load: NS.books.package is not a function');
  if (typeof NS.books.packageFiles !== 'function') throw new Error('NS.books.packageFiles is not a function');
  const G = globalOf(NS);
  const fontBytes = G.Uint8Array.from(Buffer.from(NS.fontData.regular, 'base64'));
  return { NS, G, kit: { PDFLib: G.PDFLib, fontkit: G.fontkit, fontBytes } };
}
const fixture = (name) => JSON.parse(JSON.stringify(require('./fixtures/' + name + '.js')));

/** A fixture's records with its other entries posted directly; the package brings the books up to date itself. */
function fundWs(NS, name, opts) {
  opts = opts || {};
  const F = fixture(name);
  const ws = F.records;
  const oid = F.expect.offeringId;
  ws.investors.forEach((i) => i.onboarding || (i.onboarding = { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05', source: 'manual' }));
  if (opts.edit) opts.edit(ws, F);
  F.entries.forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  const o = ws.offerings.find((x) => x.id === oid);
  return { F, ws, oid, o };
}
/** The two investors' tax facts (made up, as package.js writes them): FA-1001 a signed W-9, FA-1002 a signed W-8BEN-E. */
function taxFacts(ws) {
  const one = ws.investors.find((i) => i.id === 'FA-1001');
  Object.assign(one, { type: 'individual', taxForm: 'W-9', tinLast4: '1234', address: '1 Example Street, Springfield IL 62701' });
  one.taxCert = { form: 'W-9', revision: 'March 2024', envelopeId: 'env-fa-1001-w9', at: '2026-01-08T15:00:00.000Z', signed: true, signedBy: 'Investor One', tinLast4: '1234', backupWithholding: false };
  const two = ws.investors.find((i) => i.id === 'FA-1002');
  Object.assign(two, { type: 'entity', taxType: 'foreign-entity', taxForm: 'W-8BEN-E', address: '2 Sample Road, London' });
  two.taxCert = { form: 'W-8BEN-E', revision: 'October 2021', envelopeId: 'env-fa-1002-w8', at: '2026-01-09T15:00:00.000Z', signed: true, signedBy: 'Investor Two', chapter3: 'Corporation', chapter4: '', country: 'United Kingdom', ftinLast4: '9876', noFtin: false, validUntil: '2029-12-31' };
}
const fundA = (NS, opts) => fundWs(NS, 'fund-a', Object.assign({}, opts || {}, { edit: (ws, F) => (taxFacts(ws), opts && opts.edit && opts.edit(ws, F)) }));
const NOW = '2027-01-20T10:00:00.000Z';
const filesOf = (K, A, year, more) => K.NS.books.packageFiles(A.ws, A.o, year || 2026, Object.assign({ actor: ACTOR.by, now: NOW, today: TODAY, kit: K.kit }, more || {}));

/* ---------- reading the files back ---------- */
/** Writes bytes to dir/name and returns the path. */
function save(dir, name, bytes) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(bytes));
  return file;
}
/** The zip read with Python's zipfile: { names, dir } with every entry extracted into dir/x (names in the zip's order). */
function unzip(dir, file) {
  const out = path.join(dir, 'x');
  const py = 'import json,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nbad=z.testzip()\nif bad: raise SystemExit("bad entry "+bad)\nz.extractall(sys.argv[2])\nprint(json.dumps(z.namelist()))';
  const r = spawnSync('python3', ['-I', '-c', py, file, out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`zipfile could not read the package: ${(r.stderr || '').slice(-800)}`);
  return { names: JSON.parse(r.stdout), dir: out, read: (n) => fs.readFileSync(path.join(out, n)) };
}
function readXlsx(file) {
  const r = spawnSync('python3', ['-I', READER, file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`read-xlsx.py exited ${r.status}: ${(r.stderr || '').slice(-800)}`);
  return JSON.parse(r.stdout);
}
function textOf(file) {
  const r = spawnSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`pdftotext exited ${r.status}: ${(r.stderr || '').slice(-800)}`);
  return r.stdout;
}
function infoOf(file) {
  const r = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`pdfinfo exited ${r.status}: ${(r.stderr || '').slice(-800)}`);
  const o = {};
  r.stdout.split('\n').forEach((l) => {
    const m = l.match(/^([^:]+):\s*(.*)$/);
    if (m) o[m[1].trim()] = m[2].trim();
  });
  return o;
}
/** A read-xlsx sheet's cells as rows: rows[r][c] = value (1-based row numbers, columns A=0). */
function grid(sh) {
  const rows = {};
  Object.keys(sh.cells).forEach((ref) => {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    const c = m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    (rows[m[2]] = rows[m[2]] || [])[c] = sh.cells[ref].v;
  });
  return Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b)
    .map((r) => rows[r]);
}
const rowWhere = (g, i, v) => g.find((r) => r && r[i] === v) || null;

/** The package written to disk and read back: { P, file, Z, X, pdf, text, info }. */
async function written(dir, K, A, year, more) {
  const P = await filesOf(K, A, year, more);
  const file = save(dir, P.name, P.bytes);
  const Z = unzip(dir, file);
  const xlsx = Z.names.find((n) => /\.xlsx$/.test(n));
  const pdf = Z.names.find((n) => /\.pdf$/.test(n) && n.indexOf('forms/') !== 0);
  const X = xlsx ? readXlsx(path.join(Z.dir, xlsx)) : null;
  const text = pdf ? textOf(path.join(Z.dir, pdf)) : '';
  const info = pdf ? infoOf(path.join(Z.dir, pdf)) : {};
  return { P, file, Z, X, xlsx, pdf, text, info };
}
/** Every MANIFEST line's hash equals the SHA-256 of that entry's bytes, and every other entry has a line. */
function manifestOk(Z) {
  const lines = Z.read('MANIFEST.sha256').toString('utf8').split('\n').filter(Boolean);
  const bad = [];
  const named = lines.map((l) => {
    const m = l.match(/^([0-9a-f]{64})  (.+)$/);
    if (!m) {
      bad.push(`not a manifest line: ${l}`);
      return '';
    }
    if (sha(Z.read(m[2])) !== m[1]) bad.push(`hash differs: ${m[2]}`);
    return m[2];
  });
  const others = Z.names.filter((n) => n !== 'MANIFEST.sha256');
  if (J(named) !== J(others)) bad.push(`manifest names ${J(named)} are not the other entries ${J(others)}`);
  return bad;
}

const cases = {
  /** Task 1 (tracer): fund A's 2026 package without the tick: the files in order, the manifest, the workbook and PDF figures. */
  'fund-a': async ({ check }) => {
    const K = load();
    const A = fundA(K.NS);
    const sheets = K.NS.books.package(A.ws, A.o, 2026, { today: TODAY, actor: ACTOR.by }).sheets;
    const dir = folder('fund-a');
    const W = await written(dir, K, A);
    const n = sheets.length;
    check("the zip is named 'Fund_A_Sponsor_Fund_A_2026_year_end_package.zip'", W.P.name === 'Fund_A_Sponsor_Fund_A_2026_year_end_package.zip', W.P.name);
    check('packageFiles returns { name, bytes, hash, files } with hash the SHA-256 of the bytes', W.P.hash === sha(Buffer.from(W.P.bytes)) && Array.isArray(W.P.files), W.P.hash);
    const want = ['00_README.txt', 'Fund_A_Sponsor_Fund_A_2026_year_end.xlsx', 'Fund_A_Sponsor_Fund_A_2026_year_end.pdf']
      .concat(sheets.map((s, k) => `csv/${String(k + 1).padStart(2, '0')}_${String(s.title).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}.csv`))
      .concat(['MANIFEST.sha256']);
    check(`without the tick the zip holds 4 + ${n} sheets = ${4 + n} files, in order: README, workbook, PDF, one CSV per sheet, manifest`, J(W.Z.names) === J(want), { got: W.Z.names, want });
    check('the files list packageFiles returns is the zip\'s, with sizes', J(W.P.files.map((f) => f.name)) === J(W.Z.names) && W.P.files.every((f) => f.size === W.Z.read(f.name).length), W.P.files);
    check('no entry starts with forms/', !W.Z.names.some((x) => /^forms\//.test(x)), W.Z.names);
    const bad = manifestOk(W.Z);
    check('every MANIFEST line is "<sha256>  <name>" and verifies against the entry\'s bytes; every other entry has one', bad.length === 0, bad);
    // the workbook (openpyxl through read-xlsx.py)
    const tabs = sheets.map((s) => K.NS.files.sheetName(s.title, null));
    check('the workbook has one tab per package sheet, named as the writer names them (31 characters at most)', !!W.X && J(W.X.sheets.map((s) => s.name)) === J(tabs) && tabs.every((t) => t.length <= 31), W.X && W.X.sheets.map((s) => s.name));
    check('the workbook holds no formula', !!W.X && W.X.raw_formulas === 0, W.X && W.X.raw_formulas);
    const tab = (name) => (W.X ? W.X.sheets.find((s) => s.name === name) : null);
    const tb = tab('Trial balance');
    const tbTotal = tb ? rowWhere(grid(tb), 1, 'Total') : null;
    check("'Trial balance' total row: Debits 556500.0, Credits 556500.0, Ending balance 0", !!tbTotal && Number(tbTotal[5]) === 556500 && Number(tbTotal[6]) === 556500 && Number(tbTotal[7] || 0) === 0, tbTotal);
    const bsTab = K.NS.files.sheetName('Balance sheet in Schedule L order', null);
    const bs = tab(bsTab);
    const g = bs ? grid(bs) : [];
    const l14 = rowWhere(g, 0, '14');
    const l22 = rowWhere(g, 0, '22');
    check(`'${bsTab}' line 14 end 522000.0 and line 22 end 522000.0`, !!l14 && !!l22 && Number(l14[3]) === 522000 && Number(l22[3]) === 522000, { l14, l22 });
    const roll = tab('Capital roll-forward by partner');
    const rg = roll ? grid(roll) : [];
    const r1 = rowWhere(rg, 0, 'FA-1001');
    const r2 = rowWhere(rg, 0, 'FA-1002');
    check("'Capital roll-forward by partner' Ending capital: FA-1001 345000.0, FA-1002 172500.0", !!r1 && !!r2 && Number(r1[9]) === 345000 && Number(r2[9]) === 172500, { r1, r2, head: rg[0] });
    const tax = tab('Investor tax details');
    const tg = tax ? grid(tax) : [];
    const ti = tg.length ? tg[0].indexOf('Taxpayer number ending') : -1;
    const t1 = rowWhere(tg, 0, 'FA-1001');
    check("'Investor tax details' FA-1001's Taxpayer number ending '1234'", ti >= 0 && !!t1 && String(t1[ti]) === '1234', { ti, t1 });
    const cover = tab('Cover');
    const cg = cover ? grid(cover) : [];
    check("the workbook's Cover starts with Fund 'Fund A, L.P.' then Tax year '2026'", cg.length > 2 && J(cg[1].slice(0, 2)) === J(['Fund', 'Fund A, L.P.']) && J(cg[2].slice(0, 2)) === J(['Tax year', '2026']), cg.slice(0, 3));
    const signed = rowWhere(cg, 0, 'Signed tax forms included');
    check("the workbook's Cover: 'Signed tax forms included' 'No'", !!signed && signed[1] === 'No', signed);
    // the PDF (pdftotext)
    ['$517,500.00', '$32,000.00', '($409,000.00)', '$556,500.00', 'Page 1 of'].forEach((s) => check(`the PDF's text holds '${s}'`, W.text.indexOf(s) >= 0, W.text.length));
    check("the PDF's title is 'Fund A, L.P. year-end package 2026'", W.info.Title === 'Fund A, L.P. year-end package 2026', W.info.Title);
    check("the PDF's footer names fund and year: 'Fund A, L.P., 2026, book basis'", W.text.indexOf('Fund A, L.P., 2026, book basis') >= 0, W.text.slice(0, 200));
  }
};

L.runParts(cases, { name: 'PACKAGE FILES', unit: 'cases', flag: '--case' });
