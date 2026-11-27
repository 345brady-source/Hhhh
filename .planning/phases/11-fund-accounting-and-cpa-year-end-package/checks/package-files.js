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
    const tbg = tb ? grid(tb) : [];
    const tbTotal = rowWhere(tbg, 1, 'Total');
    // The tab's Debits and Credits columns are the year's activity (new-schedules.js: 100,000,000 cents each); the
    // hand-worked 556,500.00 is the total of the debit balances and of the credit balances (fixture tbDebits/tbCredits).
    check("'Trial balance' total row: Debits 1000000.0 = Credits 1000000.0 (the year's activity), Ending balance 0", !!tbTotal && Number(tbTotal[5]) === 1000000 && Number(tbTotal[6]) === 1000000 && Number(tbTotal[7] || 0) === 0, tbTotal);
    const ends = tbg.slice(1).filter((r) => r && r[1] !== 'Total').map((r) => Number(r[7] || 0));
    const dr = Math.round(ends.filter((v) => v > 0).reduce((s, v) => s + v, 0) * 100) / 100;
    const cr = Math.round(ends.filter((v) => v < 0).reduce((s, v) => s + v, 0) * 100) / 100;
    check("'Trial balance' ending balances: debit balances 556500.0, credit balances -556500.0", dr === 556500 && cr === -556500, { dr, cr });
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
    const csvs = W.Z.names.filter((x) => /^csv\//.test(x));
    const heads = csvs.map((x) => W.Z.read(x).toString('utf8').replace(/^\uFEFF/, '').split('\r\n')[0]);
    check(`each of the ${csvs.length} CSVs starts with one quoted line '"Fund A, L.P., 2026: <sheet title>. ..."' then its header`, csvs.length === n && heads.every((h, k) => h.indexOf(`"Fund A, L.P., 2026: ${sheets[k].title}. `) === 0 && /"$/.test(h)), heads.filter((h, k) => h.indexOf(`"Fund A, L.P., 2026: ${sheets[k].title}. `) !== 0));
    const nan = csvs.filter((x) => /NaN/.test(W.Z.read(x).toString('utf8')));
    check('no CSV holds NaN', nan.length === 0, nan);
    const readme = W.Z.read('00_README.txt').toString('utf8');
    check("the README names fund and year: 'Fund A, L.P.' and 'Year-end package for the 2026 tax year'", /^Fund A, L\.P\.\r\nYear-end package for the 2026 tax year\r\n/.test(readme), readme.slice(0, 120));
    check('the README lists each workbook tab beside its full title', sheets.every((s, k) => readme.split('\r\n').some((l) => l.indexOf(tabs[k]) === 0 && l.trim().slice(-s.title.length) === s.title)), tabs);
    check("the README says 'Book basis on the accrual method. Nothing here is a tax-basis or K-1 figure; the preparer decides tax treatment.' and 'Unaudited.'", readme.indexOf('Book basis on the accrual method. Nothing here is a tax-basis or K-1 figure; the preparer decides tax treatment.') >= 0 && /Prepared from the portal’s records\. Unaudited\.\r\n$/.test(readme), readme.slice(-80));
  },

  /**
   * Task 2, C-04 (11-CONTEXT B4, W1, W2): FA-1001's signed W-9 stored as bytes B (a stand-in store in the vm) goes into the
   * zip only with the tick, byte for byte; its never-issued taxpayer number '000-65-1234' / '000651234' is in that file
   * only. FA-1002's W-8BEN-E is not on this device, so it is named in the README and on the cover. White label over
   * every text in the zip, in both editions.
   */
  forms: async ({ check }) => {
    const TINS = ['000-65-1234', '000651234'];
    const B = Buffer.from('%PDF-1.4\n% Stand-in signed W-9 for FA-1001 (check fixture)\n1 0 obj << /Type /Catalog >> endobj\n(Taxpayer identification number: 000-65-1234) (000651234)\n%%EOF\n', 'latin1');
    const store = { 'env-fa-1001-w9-signed': B };
    const setup = (K) => {
      K.NS.ops.files = {
        get: async (id) => (store[id] ? { size: store[id].length, type: 'application/pdf', arrayBuffer: async () => Uint8Array.from(store[id]).buffer } : null),
        put: async () => {},
        del: async () => {}
      };
      return fundA(K.NS, {
        edit: (ws) => {
          ws.envelopes = (ws.envelopes || []).concat([{ id: 'env-fa-1001-w9', kind: 'tax', status: 'completed', signedDocId: 'env-fa-1001-w9-signed', signers: [{ investorId: 'FA-1001', name: 'Investor One' }] }]);
        }
      });
    };
    const holds = (buf) => TINS.filter((t) => buf.indexOf(Buffer.from(t, 'latin1')) >= 0);
    const xmlOf = (dir, file) => {
      const out = path.join(dir, 'xlsx-parts');
      const r = spawnSync('python3', ['-I', '-c', 'import sys,zipfile\nzipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', file, out], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error('the workbook could not be unzipped: ' + r.stderr);
      const all = [];
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : all.push(fs.readFileSync(path.join(d, e.name)))));
      walk(out);
      return Buffer.concat(all);
    };
    const texts = (W, dir) => {
      const t = {};
      W.Z.names.filter((x) => !/^forms\//.test(x) && !/\.(xlsx|pdf)$/.test(x)).forEach((x) => (t[x] = W.Z.read(x)));
      t['workbook XML'] = xmlOf(dir, path.join(W.Z.dir, W.xlsx));
      t['PDF text'] = Buffer.from(W.text, 'utf8');
      t['PDF Title, Producer, Creator'] = Buffer.from([W.info.Title, W.info.Producer, W.info.Creator].join('\n'), 'utf8');
      return t;
    };

    // With the tick.
    const K = load();
    const A = setup(K);
    const n = K.NS.books.package(A.ws, A.o, 2026, { today: TODAY, actor: ACTOR.by }).sheets.length;
    const dir = folder('forms');
    const W = await written(dir, K, A, 2026, { includeForms: true });
    check(`with the tick the zip holds 5 + ${n} sheets = ${5 + n} files`, W.Z.names.length === 5 + n, W.Z.names);
    const fi = W.Z.names.indexOf('forms/FA-1001_W-9.pdf');
    check('forms/FA-1001_W-9.pdf is in it, after the CSVs and before the manifest', fi === W.Z.names.length - 2 && /^csv\//.test(W.Z.names[fi - 1]), W.Z.names.slice(-3));
    check('forms/FA-1001_W-9.pdf is byte for byte the stored signed copy B', fi >= 0 && Buffer.compare(W.Z.read('forms/FA-1001_W-9.pdf'), B) === 0, fi >= 0 ? W.Z.read('forms/FA-1001_W-9.pdf').length : 0);
    check('no other entry starts with forms/', W.Z.names.filter((x) => /^forms\//.test(x)).length === 1, W.Z.names.filter((x) => /^forms\//.test(x)));
    const bad = manifestOk(W.Z);
    check('every MANIFEST line verifies, the signed form included', bad.length === 0, bad);
    const cg = W.X ? grid(W.X.sheets.find((s) => s.name === 'Cover')) : [];
    const yes = rowWhere(cg, 0, 'Signed tax forms included');
    check("the workbook's Cover: 'Signed tax forms included' 'Yes'", !!yes && yes[1] === 'Yes', yes);
    const gone = rowWhere(cg, 0, 'Signed form not on this device: FA-1002 W-8BEN-E');
    check("the Cover names the form this device does not hold: 'Signed form not on this device: FA-1002 W-8BEN-E'", !!gone, cg.map((r) => r[0]).filter((x) => /Signed/.test(x)));
    const readme = W.Z.read('00_README.txt').toString('utf8');
    check("the README says 'Signed tax forms included: Yes' and names FA-1002's form as not on this device", readme.indexOf('Signed tax forms included: Yes\r\n') >= 0 && readme.indexOf('\r\nSigned form not on this device: FA-1002 W-8BEN-E\r\n') >= 0 && readme.indexOf('forms/FA-1001_W-9.pdf') >= 0, readme.slice(0, 700));
    // B4: the full taxpayer number is in the signed form only.
    check("B holds the never-issued numbers '000-65-1234' and '000651234' (the search can find them)", holds(B).length === 2, holds(B));
    const T = texts(W, dir);
    const inZip = Object.keys(T).filter((k) => holds(T[k]).length);
    const rawPdf = holds(W.Z.read(W.pdf));
    const rawXlsx = holds(W.Z.read(W.xlsx));
    check('with the tick: neither number is in the README, the manifest, any CSV, the workbook (zip or XML), the PDF (bytes, text, metadata)', inZip.length === 0 && !rawPdf.length && !rawXlsx.length, { inZip, rawPdf, rawXlsx });
    const G = K.G;
    const stored = Object.keys(G.localStorage)
      .concat(Array.from({ length: G.localStorage.length }, (_, k) => G.localStorage.key(k)))
      .filter((k, i, a) => k && a.indexOf(k) === i)
      .map((k) => String(G.localStorage.getItem(k) || ''))
      .join('\n');
    const where = { 'the workspace (outside the file store)': JSON.stringify(A.ws), 'the change log': JSON.stringify(A.ws.audit || []), 'the stored workspace': stored, 'the return value': JSON.stringify({ name: W.P.name, hash: W.P.hash, files: W.P.files }) };
    const out = Object.keys(where).filter((k) => holds(Buffer.from(where[k], 'utf8')).length);
    check('neither number is in the workspace, the change log, the stored workspace or what packageFiles returns', out.length === 0, out);
    // Without the tick.
    const K2 = load();
    const A2 = setup(K2);
    const dir2 = folder('forms-no');
    const W2 = await written(dir2, K2, A2, 2026, {});
    check(`without the tick: ${4 + n} files and no entry starts with forms/`, W2.Z.names.length === 4 + n && !W2.Z.names.some((x) => /^forms\//.test(x)), W2.Z.names);
    const any = W2.Z.names.filter((x) => holds(W2.Z.read(x)).length).concat(Object.keys(texts(W2, dir2)).filter((k) => holds(texts(W2, dir2)[k]).length));
    check('without the tick nothing in the zip holds either number', any.length === 0, any);
    const cg2 = W2.X ? grid(W2.X.sheets.find((s) => s.name === 'Cover')) : [];
    const no = rowWhere(cg2, 0, 'Signed tax forms included');
    check("without the tick the Cover reads 'No' and names no missing form", !!no && no[1] === 'No' && !cg2.some((r) => /^Signed form not on this device/.test(r[0] || '')), no);
    // The tick with nothing stored.
    const K3 = load();
    const A3 = fundA(K3.NS);
    K3.NS.ops.files = { get: async () => null };
    const P3 = await filesOf(K3, A3, 2026, { includeForms: true });
    const cover3 = await (async () => {
      const W3 = await written(folder('forms-none'), K3, A3, 2026, { includeForms: true });
      return W3.X ? grid(W3.X.sheets.find((s) => s.name === 'Cover')) : [];
    })();
    const none = rowWhere(cover3, 0, 'Signed tax forms included');
    check("the tick with no form on this device: 'No (none stored on this device)', no forms/ entry", !!none && none[1] === 'No (none stored on this device)' && !P3.files.some((f) => /^forms\//.test(f.name)), { none, files: P3.files.length });
    // W2: white label over every text, in both editions.
    const FORBID = (NS) => [NS.EDITION && NS.EDITION.product, 'Powered by', 'pdf-lib', 'fontkit'].filter(Boolean);
    const label = (NS, T, info, ed) => {
      const hits = [];
      Object.keys(T).forEach((k) => {
        const s = T[k].toString('utf8');
        FORBID(NS).forEach((f) => s.indexOf(f) >= 0 && hits.push(`${k}: ${f}`));
        if (/\bbasic\b/i.test(s)) hits.push(`${k}: the forbidden word`);
      });
      check(`${ed}: no product name, 'Powered by', 'pdf-lib', 'fontkit' or the forbidden word in the README, manifest, CSVs, workbook XML or the PDF's text and metadata`, hits.length === 0, hits);
      check(`${ed}: the PDF's Producer and Creator are the firm's name, 'Fund A Sponsor Management, LLC'`, info.Producer === 'Fund A Sponsor Management, LLC' && info.Creator === 'Fund A Sponsor Management, LLC', [info.Producer, info.Creator]);
    };
    label(K.NS, T, W.info, 'self-serve');
    const KM = load(TODAY, 'managed');
    const AM = setup(KM);
    const dirM = folder('forms-managed');
    const WM = await written(dirM, KM, AM, 2026, { includeForms: true });
    label(KM.NS, texts(WM, dirM), WM.info, 'managed');
  },

  /** Task 2: LibreOffice reads the workbook (one CSV per tab, raw values): the trial balance and Schedule L figures. */
  libre: async ({ check }) => {
    const K = load();
    const A = fundA(K.NS);
    const dir = folder('libre');
    const W = await written(dir, K, A);
    const csv = libreCsv(dir, path.join(W.Z.dir, W.xlsx));
    const bsTab = K.NS.files.sheetName('Balance sheet in Schedule L order', null);
    const tb = csv['Trial balance'] || [];
    const total = tb.find((r) => r[1] === 'Total');
    check("LibreOffice's 'Trial balance' CSV: total row Debits 1000000, Credits 1000000, Ending balance 0", !!total && Number(total[5]) === 1000000 && Number(total[6]) === 1000000 && Number(total[7] || 0) === 0, { total, sheets: Object.keys(csv) });
    const ends = tb.slice(1).filter((r) => r[1] !== 'Total' && r.length > 7).map((r) => Number(r[7] || 0));
    const dr = Math.round(ends.filter((v) => v > 0).reduce((s, v) => s + v, 0) * 100) / 100;
    check("LibreOffice's 'Trial balance' CSV: the debit balances total 556500", dr === 556500, dr);
    const bs = csv[bsTab] || [];
    const l14 = bs.find((r) => r[0] === '14');
    const l22 = bs.find((r) => r[0] === '22');
    check(`LibreOffice's '${bsTab}' CSV: line 14 and line 22 end at 522000`, !!l14 && !!l22 && Number(l14[3]) === 522000 && Number(l22[3]) === 522000, { l14, l22 });
    check('LibreOffice wrote one CSV per tab', Object.keys(csv).length === W.X.sheets.length, Object.keys(csv));
  },

  /** Task 2: a sample fund: kb-fund-ii's 2025 package builds; its checks pass; one workbook tab per package sheet, same names. */
  sample: async ({ check }) => {
    const K = load('2026-11-19');
    const NS = K.NS;
    const t = NS.TENANTS.find((x) => x.sample && (x.offerings || []).some((o) => o.id === 'kb-fund-ii')) || NS.TENANTS.find((x) => x.sample && NS.ops.ensure(NS.seedWorkspace(x)).offerings.some((o) => o.id === 'kb-fund-ii'));
    const ws = NS.ops.ensure(NS.seedWorkspace(t));
    const o = ws.offerings.find((x) => x.id === 'kb-fund-ii');
    const pk = NS.books.package(ws, o, 2025, { today: '2026-11-19', actor: ACTOR.by });
    ['tb_zero', 'nav', 'sch_l', 'capital'].forEach((id) => {
      const c = pk.checks.find((x) => x.id === id);
      check(`kb-fund-ii 2025: the '${id}' check passes`, !!c && c.status === 'pass', c);
    });
    const dir = folder('sample');
    const W = await written(dir, K, { ws, o }, 2025, { today: '2026-11-19' });
    const used = new Set();
    const tabs = pk.sheets.map((s) => NS.files.sheetName(s.title, used));
    check(`kb-fund-ii 2025: the workbook has one tab per package sheet (${pk.sheets.length}), named as the writer names them`, !!W.X && J(W.X.sheets.map((s) => s.name)) === J(tabs), { got: W.X && W.X.sheets.map((s) => s.name), want: tabs });
    check(`kb-fund-ii 2025: 4 + ${pk.sheets.length} files, every manifest line verifies`, W.Z.names.length === 4 + pk.sheets.length && manifestOk(W.Z).length === 0, { files: W.Z.names.length, bad: manifestOk(W.Z) });
    check("kb-fund-ii 2025: the PDF's text names the fund and the year and has 'Page 1 of'", W.text.indexOf(`${o.name}, 2025, book basis`) >= 0 && W.text.indexOf('Page 1 of') >= 0, W.text.slice(0, 160));
    const nan = W.Z.names.filter((x) => /^csv\//.test(x) && /NaN/.test(W.Z.read(x).toString('utf8')));
    check('kb-fund-ii 2025: no CSV holds NaN', nan.length === 0, nan);
    console.log(`sample: kb-fund-ii 2025, ${W.Z.names.length} files, ${W.P.bytes.length} bytes`);
  },

  /** Task 2: the export is in the change log with the zip's SHA-256, and the chain still verifies. */
  logged: async ({ check }) => {
    const K = load();
    const A = fundA(K.NS);
    const before = (K.NS.audit.ensureLog(A.ws) || []).length;
    const P = await filesOf(K, A, 2026);
    const log = A.ws.audit || [];
    const last = log[log.length - 1] || {};
    check("the change log's last entry is 'Year-end package exported' for fund-a, recording the zip's name", log.length === before + 1 && last.action === 'Year-end package exported' && last.fund === 'fund-a' && last.record === P.name, last);
    check("its detail holds the file count, 'signed tax forms not included' and the zip's SHA-256", last.detail === `${P.files.length} files; signed tax forms not included; SHA-256 ${P.hash}`, last.detail);
    check('its actor is the one who downloaded', last.actor === ACTOR.by, last.actor);
    const v = K.NS.audit.verify(A.ws);
    check('NS.audit.verify is ok after the export', !!v && v.ok === true, v);
  },

  /** Task 2: the check itself can fail: an unknown --case name and an empty list each exit 1 with a FAIL line. */
  selfcheck: ({ check }) => {
    [['nope', 'an unknown --case name'], ['', 'an empty --case list']].forEach(([arg, what]) => {
      const r = spawnSync(process.execPath, [__filename, '--case', arg], { encoding: 'utf8', env: Object.assign({}, process.env, { GATE_FRESH: '1' }) });
      const out = String(r.stdout || '') + String(r.stderr || '');
      check(`${what} exits 1 with a FAIL line and a failing last line`, r.status === 1 && /^FAIL /m.test(out) && /PACKAGE FILES: FAIL \(cases run: 0\)/.test(out.trim().split('\n').pop()), { status: r.status, out: out.trim().split('\n').slice(-2) });
    });
  }
};

/** The LibreOffice CSV export of every tab (raw values, one file per tab; 11-CONTEXT 11-03 B1), through the shared queue. */
function libreCsv(dir, file) {
  const HEAVY = path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-011/heavy.sh');
  const out = path.join(dir, 'lo-csv');
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
  const t = text.replace(/^\uFEFF/, '');
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
  if (f !== '' || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}

L.runParts(cases, { name: 'PACKAGE FILES', unit: 'cases', flag: '--case' });
