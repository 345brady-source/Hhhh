// gate: browser
// last "PDF OUT: PASS (cases run: 1)"
// Plan 11-06: the PDF writer for tables (assets/js/filesout.js, NS.files.pdf) read back by an independent tool.
// Node cases load the portal with load11.js (extra: the shipped PDF writer, font embedder and Unicode font data, then
// filesout.js) inside each case and pass the kit built from those shipped files; nothing is fetched. Each PDF is written
// into a folder named with this process's id under P6_OUT (or the system temporary folder) and read with
// `pdftotext -layout` (and pdfinfo, pdftotext -bbox); the folder is removed when the run ends, pass or fail.
//   node checks/pdf-out.js [--case one,...]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const P6 = path.join(ROOT, '.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const BASE = process.env.P6_OUT || os.tmpdir();
const WORK = path.join(BASE, `pdf-out-${process.pid}`);
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

// The shipped files the kit is built from (plan 10-03 and phase 6), loaded into the portal's own sandbox.
const SHIPPED = ['../vendor/pdfwrite/write.js', '../vendor/pdfwrite/fonts.js', '../vendor/textfont/text-regular.js'];

/** The sandbox's own global object (a function made inside it answers `this` there). */
const globalOf = (NS) => NS.constructor.constructor('return this')();

/**
 * The portal loaded fresh by load11.js with the shipped writer, font embedder, font data and filesout.js, and the kit
 * built from them: { NS, kit }. The font bytes are the shipped base64 data esign.js's unicodeFont reads, as the
 * sandbox's own Uint8Array (the writer checks the type of what it is given).
 */
function portal() {
  const { loadPortal } = require('./load11.js');
  const NS = loadPortal(ROOT, { today: '2026-11-19', edition: 'diy', extra: SHIPPED.concat(['filesout.js']) });
  const G = globalOf(NS);
  const fontBytes = G.Uint8Array.from(Buffer.from(NS.fontData.regular, 'base64'));
  return { NS, kit: { PDFLib: G.PDFLib, fontkit: G.fontkit, fontBytes } };
}

/** Writes bytes to dir/name and returns the path. */
function save(dir, name, bytes) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.from(bytes));
  return file;
}
/** pdftotext -layout's text of a file (pages separated by form feeds), or throws with its error output. */
function textOf(file) {
  const r = spawnSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`pdftotext exited ${r.status}: ${(r.stderr || '').slice(-800)}`);
  return r.stdout;
}
/** The text of each page (pdftotext ends every page with a form feed). */
const pagesOf = (text) => text.split('\f').slice(0, -1);
/** pdfinfo's fields as an object. */
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
/** Every word pdftotext -bbox finds: { page, text, xMin, xMax, yMin, yMax }. */
function wordsOf(file) {
  const r = spawnSync('pdftotext', ['-bbox', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`pdftotext -bbox exited ${r.status}`);
  const out = [];
  let page = 0;
  const un = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  r.stdout.split('\n').forEach((l) => {
    if (/<page /.test(l)) page++;
    const m = l.match(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*)<\/word>/);
    if (m) out.push({ page, text: un(m[5]), xMin: +m[1], yMin: +m[2], xMax: +m[3], yMax: +m[4] });
  });
  return out;
}

const COL = (h, t) => ({ h, t: t || 'text' });
/** The hand-worked sheet of the plan (the one plan 11-03 uses). */
function trialBalance() {
  return {
    id: 'tb',
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
const TB_STRINGS = ['$32,000.00', '$7,500.00', '$1.23', '$0.01', '25.00%', '$32,001.23', '$7,500.01', 'Łukasz Ż', TB_TEXT];
const startsPdf = (b) => !!b && b.length > 5 && String.fromCharCode(b[0], b[1], b[2], b[3], b[4]) === '%PDF-';

const parts = {
  /** The hand-worked trial balance: every figure, the formula-like text and the Unicode name are in the PDF's text. */
  async one({ check }) {
    const { NS, kit } = portal();
    check('NS.files.pdf exists', NS.files && typeof NS.files.pdf === 'function');
    const bytes = await NS.files.pdf({ title: 'Kestrel Bay Fund II', subtitle: 'Year ended December 31, 2025', sheets: [trialBalance()], footer: 'Kestrel Bay Capital' }, kit);
    check('the bytes start with %PDF-', startsPdf(bytes), bytes && Buffer.from(bytes.slice(0, 8)).toString('latin1'));
    const file = save(folder('one'), 'one.pdf', bytes);
    const text = textOf(file);
    TB_STRINGS.forEach((s) => check(`the text holds ${s}`, text.indexOf(s) >= 0, text.slice(0, 1200)));
    const info = infoOf(file);
    check('one US Letter landscape page (792 x 612 pts)', info.Pages === '1' && /^792 x 612 pts/.test(info['Page size'] || ''), { pages: info.Pages, size: info['Page size'] });
    check('the title is the document title', info.Title === 'Kestrel Bay Fund II', info.Title);
    check('no library name in the file properties', !/pdf-lib|fontkit|hopding/i.test(JSON.stringify(info)), { Producer: info.Producer, Creator: info.Creator });
    check('the page reads "Page 1 of 1" and the footer', /Page 1 of 1/.test(text) && text.indexOf('Kestrel Bay Capital') >= 0, text.slice(-300));
    check('the headings are printed', ['Account', 'Debit', 'Credit', 'Share'].every((h) => text.indexOf(h) >= 0), text.slice(0, 600));
    // money is right-aligned: the right edges of a column's amounts line up
    const w = wordsOf(file);
    const right = (s) => (w.find((x) => x.text === s) || {}).xMax;
    const debit = ['$32,000.00', '$1.23', '$32,001.23'].map(right);
    const credit = ['$7,500.00', '$0.01', '$7,500.01'].map(right);
    const lined = (a) => a.every((x) => typeof x === 'number') && Math.max(...a) - Math.min(...a) < 0.6;
    check('the debit amounts are right-aligned', lined(debit), debit);
    check('the credit amounts are right-aligned', lined(credit), credit);
  }
};

if (require.main === module) {
  require(P6).runParts(parts, { name: 'PDF OUT', unit: 'cases', flag: '--case' });
}
