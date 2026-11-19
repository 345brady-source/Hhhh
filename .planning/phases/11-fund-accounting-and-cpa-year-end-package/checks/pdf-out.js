// gate: browser
// last "PDF OUT: PASS (cases run: 6)"
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
  },

  /** 300 rows run onto N pages: headings and "Page k of N" on every page, every row once, the total on the last page. */
  async pages({ check }) {
    const { NS, kit } = portal();
    const rows = [];
    for (let i = 1; i <= 300; i++) rows.push([`Row ${i}`, i]);
    const sheet = { title: 'Ledger', desc: 'Three hundred lines', cols: [COL('Line'), COL('Amount', 'money')], rows, total: ['Total', 45150], currency: 'USD' };
    const file = save(folder('pages'), 'pages.pdf', await NS.files.pdf({ title: 'Kestrel Bay Fund II', sheets: [sheet], footer: 'Kestrel Bay Capital' }, kit));
    const text = textOf(file);
    const pages = pagesOf(text);
    console.log(`pages: pdftotext read ${pages.length} pages; pdfinfo says ${infoOf(file).Pages}`);
    check(`${PAGES_300} pages (the first passing run's count)`, pages.length === PAGES_300 && infoOf(file).Pages === String(PAGES_300), { text: pages.length, info: infoOf(file).Pages });
    const noHead = pages.map((p, k) => k + 1).filter((k) => !/^\s*Line\s+Amount\s*$/m.test(pages[k - 1]));
    check('every page repeats the column headings', pages.length > 1 && noHead.length === 0, noHead);
    const noNum = pages.map((p, k) => k + 1).filter((k) => (pages[k - 1].match(new RegExp(`\\bPage ${k} of ${pages.length}\\b`, 'g')) || []).length !== 1);
    check('every page carries "Page k of N" once', pages.length > 1 && noNum.length === 0, noNum);
    check('pages 2 to N say the table continues', pages.slice(1).every((p) => /Ledger \(continued\)/.test(p)) && !/continued/.test(pages[0]), pages.map((p) => /continued/.test(p)));
    const count = (k) => (text.match(new RegExp(`\\bRow ${k}\\b`, 'g')) || []).length;
    console.log(`pages: Row 1 x${count(1)}, Row 150 x${count(150)}, Row 300 x${count(300)}`);
    const wrong = [];
    for (let k = 1; k <= 300; k++) if (count(k) !== 1) wrong.push(`Row ${k} x${count(k)}`);
    check('every Row k appears exactly once', wrong.length === 0, wrong.slice(0, 20));
    check('$451.50 is on the last page and nowhere else', pages[pages.length - 1].indexOf('$451.50') >= 0 && pages.slice(0, -1).every((p) => p.indexOf('$451.50') < 0), pages.map((p) => p.indexOf('$451.50') >= 0));
    // the amounts read back to the cent: the rows add up to 45,150 cents, each row's own amount beside it
    const amounts = Array.from(text.matchAll(/^\s*Row (\d+)\s+\$(\d+)\.(\d\d)\s*$/gm)).map((m) => [+m[1], +m[2] * 100 + +m[3]]);
    check('300 row lines read back, each with its own cents', amounts.length === 300 && amounts.every(([k, c]) => k === c), amounts.filter(([k, c]) => k !== c).slice(0, 10));
    check('the rows read back add up to 45,150 cents', amounts.reduce((a, [, c]) => a + c, 0) === 45150, amounts.reduce((a, [, c]) => a + c, 0));
  },

  /** Negative money in parentheses, percentages, the other number types and dates as the Audit page shows them; one title per sheet. */
  async formats({ check }) {
    const { NS, kit } = portal();
    const cols = [COL('Item'), COL('Amount', 'money'), COL('Share', 'pct'), COL('Multiple', 'ratio'), COL('Price', 'price'), COL('Units', 'int'), COL('Date', 'date')];
    const a = { title: 'Statement of operations', desc: 'Formats', cols, rows: [['Refund', -450000, 0.125, 1.5, 12.5, 1234, '2026-12-31'], ['Nil', 0, 0, null, null, 0, null]], currency: 'USD' };
    const b = { title: 'Capital roll-forward', desc: 'Second sheet', cols: [COL('Investor'), COL('Ending', 'money')], rows: [['Łukasz Ż', 123]], total: ['Total', 123], currency: 'USD' };
    const file = save(folder('formats'), 'formats.pdf', await NS.files.pdf({ title: 'Kestrel Bay Fund II', subtitle: 'Year ended December 31, 2025', sheets: [a, b], footer: 'Kestrel Bay Capital' }, kit));
    const text = textOf(file);
    const want = { money: '($4,500.00)', pct: '12.50%', ratio: NS.audit.display({ t: 'ratio' }, 1.5), price: NS.audit.display({ t: 'price' }, 12.5), int: NS.audit.display({ t: 'int' }, 1234), date: NS.audit.display({ t: 'date' }, '2026-12-31') };
    console.log(`formats: the Audit page shows ${JSON.stringify(want)}`);
    check('-450,000 cents prints ($4,500.00)', text.indexOf('($4,500.00)') >= 0, text.slice(0, 900));
    check('no minus sign of the Audit page\'s money display is printed', text.indexOf('−') < 0 && !/-\$/.test(text));
    check('a pct of 0.125 prints 12.50%', text.indexOf('12.50%') >= 0);
    check('ratio, price and int as the Audit page displays them (1.50x, $12.50, 1,234)', want.ratio === '1.50x' && want.price === '$12.50' && want.int === '1,234' && [want.ratio, want.price, want.int].every((s) => text.indexOf(s) >= 0), want);
    check(`the date 2026-12-31 prints as the Audit page displays it (${want.date})`, want.date === 'Dec 31, 2026' && text.indexOf(want.date) >= 0 && text.indexOf('2026-12-31') < 0);
    check('zero money prints $0.00 and a zero pct 0.00%', /Nil\s+\$0\.00\s+0\.00%/.test(text), (text.match(/^.*Nil.*$/m) || [''])[0]);
    const pages = pagesOf(text);
    const lines = pages.map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean));
    check('two pages, one per sheet', pages.length === 2, pages.length);
    check('page 1 starts with the first sheet\'s title', lines[0] && lines[0][1] === 'Statement of operations' && pages[0].indexOf('Capital roll-forward') < 0, lines[0] && lines[0].slice(0, 3));
    check('page 2 starts with the second sheet\'s title', lines[1] && lines[1][1] === 'Capital roll-forward' && pages[1].indexOf('Statement of operations') < 0, lines[1] && lines[1].slice(0, 3));
    check('each page carries the document title and subtitle above the sheet', lines.every((l) => /^Kestrel Bay Fund II\s+Year ended December 31, 2025$/.test(l[0])), lines.map((l) => l[0]));
    check('Page 1 of 2 and Page 2 of 2', /Page 1 of 2/.test(pages[0]) && /Page 2 of 2/.test(pages[1]));
  },

  /** Long text wraps inside its column, a long description is cut to one line, a character the font lacks prints '?'. */
  async text({ check }) {
    const { NS, kit } = portal();
    const descWords = [];
    for (let i = 1; descWords.join(' ').length < 400; i++) descWords.push(`note${i}`);
    const desc = descWords.join(' ').slice(0, 400);
    const cellWords = [];
    for (let i = 1; cellWords.join(' ').length < 200; i++) cellWords.push(`word${i}`);
    const cell = cellWords.join(' ').slice(0, 200).replace(/\s\S*$/, '');
    const token = 'Z'.repeat(60) + 'Q'.repeat(60);
    // The plan names U+1F600 as a character the font lacks; the shipped font has it (it prints as typed), so the
    // character the font lacks is U+1F680, proven absent from the shipped font's own character set below.
    const ROCKET = '\u{1F680}';
    const glyphs = new Set(kit.fontkit.create(Buffer.from(kit.fontBytes)).characterSet);
    check('the shipped font lacks U+1F680 and has U+1F600', !glyphs.has(0x1f680) && glyphs.has(0x1f600));
    const sheet = {
      title: 'Notes',
      desc,
      cols: [COL('Investor'), COL('Memo'), COL('Amount', 'money')],
      rows: [
        [`Lift ${ROCKET} off`, cell, 100],
        ['Smile \u{1F600} here', 'Grin', 300],
        ['Long token', token, 200]
      ],
      currency: 'USD'
    };
    check('the description is 400 characters and the cell about 200', desc.length === 400 && cell.length > 190 && cell.length <= 200, [desc.length, cell.length]);
    let bytes = null;
    try {
      bytes = await NS.files.pdf({ title: 'Kestrel Bay Fund II', sheets: [sheet], footer: 'Kestrel Bay Capital' }, kit);
      check('drawn without throwing', true);
    } catch (e) {
      check('drawn without throwing', false, String(e && e.stack));
      return;
    }
    const file = save(folder('text'), 'text.pdf', bytes);
    const text = textOf(file);
    const flat = text.replace(/\s+/g, ' ');
    const lost = cell.split(' ').filter((w) => !new RegExp(`\\b${w}\\b`).test(text));
    check("every word of the 200-character cell is in the text", lost.length === 0, lost);
    const memoLines = text.split('\n').filter((l) => /\bword\d+\b/.test(l)).length;
    check('the cell wraps onto more than one line', memoLines > 1, memoLines);
    const pieces = text.split('\n').map((l) => (l.match(/\b[ZQ]{2,}\b/) || [''])[0]).filter(Boolean);
    check('the long token is drawn whole, broken across lines', pieces.length > 1 && pieces.join('') === token, pieces);
    const descLine = text.split('\n').filter((l) => /\bnote1\b/.test(l));
    check('the description is one line, cut with an ellipsis', descLine.length === 1 && /…\s*$/.test(descLine[0]) && text.indexOf(descWords[descWords.length - 1] + ' ') < 0 && !/\bnote\d+\b/.test(text.split('\n').filter((l) => !/\bnote1\b/.test(l)).join('\n')), descLine);
    check('the character the font lacks (U+1F680) is drawn as ?', /Lift \? off/.test(flat), (text.match(/^.*Lift.*$/m) || [''])[0]);
    check('U+1F600, which the font has, prints as typed', /Smile \u{1F600} here/u.test(flat), (text.match(/^.*Smile.*$/m) || [''])[0]);
    check('pdf.missing is 1', bytes.missing === 1, bytes.missing);
    const words = wordsOf(file);
    const out = words.filter((w) => w.xMin < 36 - 0.5 || w.xMax > 792 - 36 + 0.5 || w.yMin < 36 - 0.5 || w.yMax > 612 - 36 + 0.5);
    check('nothing is drawn outside the 0.5 inch margins', words.length > 0 && out.length === 0, out.slice(0, 5));
    // each memo line stays inside the memo column: left of where the amounts start
    const amountX = Math.min(...words.filter((w) => /^\$[123]\.00$/.test(w.text)).map((w) => w.xMin));
    const over = words.filter((w) => /^(word\d+|[ZQ]+)$/.test(w.text) && w.xMax > amountX);
    check('the memo text stays inside its column', Number.isFinite(amountX) && over.length === 0, { amountX, over: over.slice(0, 5) });
  },

  /** On a phone-sized sandboxed frame that may load scripts from the portal's own address only, a PDF is built with no outside request. */
  async frame({ check }) {
    const Lib = require(P6);
    const L10 = require(path.join(ROOT, '.planning/phases/10-investor-tax-documents-and-withholding/checks/lib10.js'));
    const S = await Lib.start();
    try {
      const { A, fr } = await L10.framed(S, 'phone', { page: 'diy.html', policy: 'self' });
      const size = await fr.evaluate(() => [window.innerWidth, window.innerHeight, navigator.maxTouchPoints > 0]);
      check('the frame is 390x844 with touch', A.page.viewportSize().width === 390 && A.page.viewportSize().height === 844 && size[2] === true, size);
      await L10.proveRefused(check, A, fr);
      const got = await fr.evaluate(async (sheet) => {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'assets/js/filesout.js';
          s.onload = res;
          s.onerror = () => rej(new Error('filesout.js did not load'));
          document.head.appendChild(s);
        });
        const b = await window.CVPortal.files.pdf({ title: 'Kestrel Bay Fund II', sheets: [sheet], footer: 'Kestrel Bay Capital' });
        let bin = '';
        for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
        return {
          head: String.fromCharCode.apply(null, b.subarray(0, 5)),
          isBytes: b instanceof Uint8Array,
          missing: b.missing,
          b64: btoa(bin),
          loaded: performance.getEntriesByType('resource').map((e) => e.name)
        };
      }, trialBalance());
      check('the result is bytes starting %PDF-', got.isBytes && got.head === '%PDF-', got.head);
      const shipped = ['assets/vendor/pdfwrite/write.js', 'assets/vendor/pdfwrite/fonts.js', 'assets/vendor/textfont/text-regular.js'];
      check("the shipped writer, font embedder and font data were loaded from the portal's own address", shipped.every((f) => got.loaded.some((u) => u === `${S.origin}/${f}`)), got.loaded.filter((u) => /vendor/.test(u)));
      check('no request to either outside host was attempted', A.p10.outside.every((u) => !/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(u)) && got.loaded.every((u) => !/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(u)), A.p10.outside);
      const file = save(folder('frame'), 'frame.pdf', Buffer.from(got.b64, 'base64'));
      const text = textOf(file);
      TB_STRINGS.forEach((s) => check(`the frame's PDF holds ${s}`, text.indexOf(s) >= 0, text.slice(0, 600)));
      check('nothing missing from the font', got.missing === 0, got.missing);
      await L10.quiet(check, A, fr);
      await A.context.close();
    } finally {
      await S.stop();
    }
  },

  /** The check itself can fail: an unknown case name and an empty list each exit 1 with a FAIL line. */
  async selfcheck({ check }) {
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8', env: process.env });
    const u = run(['--case', 'nonesuch']);
    check('an unknown --case name exits 1 with a FAIL line', u.status === 1 && /^FAIL unknown case name: nonesuch/m.test(u.stdout), { status: u.status, out: u.stdout.slice(-300) });
    const e = run(['--case', '']);
    check('an empty --case list exits 1 with a FAIL line', e.status === 1 && /^FAIL no cases to run/m.test(e.stdout), { status: e.status, out: e.stdout.slice(-300) });
  }
};
// The page count of the 300-row sheet, read from the first passing run (SCRATCH/exec-11-06/pages-base.txt).
const PAGES_300 = 9;

if (require.main === module) {
  require(P6).runParts(parts, { name: 'PDF OUT', unit: 'cases', flag: '--case' });
}
