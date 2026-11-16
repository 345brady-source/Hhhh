#!/usr/bin/env node
/*
 * D-11 (plan 06-28): how well NS.intake.recognise tells a subscription agreement, and the agreement pages inside a file
 * that holds another document too, from what the pages say. No browser: assets/js/intake.js runs in a sandbox and each
 * PDF's pages are read with the same pdf.js build (3.11.174) and the same page-text code (intake.js pageText and
 * readPdf's clean-up) the intake uses, so the text is the intake's own. Picture-only PDFs are listed apart: their pages are
 * read in the browser by the built-in text reader (NS.intake.recogniseFile), which this tool does not run.
 *
 *   node recognition-measure.js [--split tune | final | all]          (default final)
 *
 * Documents (public SEC filings only, kept outside the repository, never committed):
 *   positives  EDGAR/set-a ... set-d/<id>/doc.pdf; final = the ids in EDGAR/held-out.json and held-out-b.json, tune = the rest
 *   others     RECOG/dl/<id>/doc.pdf with RECOG/list.json (each id's split, fixed by a hash of the issuer's CIK before any
 *              tuning) and RECOG/truth.json (non-agreements, combined files with the agreement's pages labelled by hand
 *              before any tuning, ambiguous files reported apart)
 *   EDGAR = REC_EDGAR or SCRATCH/edgar; RECOG = REC_DOCS or SCRATCH/d11. Page texts are cached in RECOG/txt.
 * EDGAR's own header lines (SGML tags and the exhibit tag line, which carry the filer's label for the file) are left out
 * before reading: they are labels, like a file name.
 *
 * Output: counts, ids and page numbers only, never document text. A missing folder prints "NOT RUN: (what)", exit 2.
 * Last line: "RECOGNITION: <split> agreements N/M, non-agreements wrongly recognised N/M, combined found N/M (exact range N)".
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const EDGAR = process.env.REC_EDGAR || path.join(SCRATCH, 'edgar');
const RECOG = process.env.REC_DOCS || path.join(SCRATCH, 'd11');
const VENDOR = process.env.VENDOR_DIR || path.join(SCRATCH, 'vendor');
const i = process.argv.indexOf('--split');
const SPLIT = i > 0 ? process.argv[i + 1] : 'final';
const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
if (!['tune', 'final', 'all'].includes(SPLIT)) notRun('--split must be tune, final or all');
[EDGAR, path.join(RECOG, 'list.json'), path.join(RECOG, 'truth.json'), path.join(VENDOR, 'pdfjs/package/legacy/build/pdf.js')].forEach((f) => fs.existsSync(f) || notRun(f + ' is missing'));

const src = fs.readFileSync(path.join(ROOT, 'assets/js/intake.js'), 'utf8');
const window = { CVPortal: { dates: {} } };
vm.runInNewContext(src, { window, console, TextDecoder, URL, setTimeout, clearTimeout });
const recognise = window.CVPortal.intake.recognise;
const pageText = new Function(/function pageText\(items\) \{[\s\S]*?\n {2}\}\n/.exec(src)[0] + '; return pageText;')();
const pdfjs = require(path.join(VENDOR, 'pdfjs/package/legacy/build/pdf.js'));

/** The page texts of one PDF as the intake reads them (cached), EDGAR's header lines left out. */
async function pagesOf(id, file) {
  const cache = path.join(RECOG, 'txt', id + '.json');
  let pages;
  if (fs.existsSync(cache)) pages = JSON.parse(fs.readFileSync(cache)).pages;
  else {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), isEvalSupported: false, verbosity: 0, standardFontDataUrl: path.join(VENDOR, 'pdfjs/package/standard_fonts/') }).promise;
    pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      pages.push(pageText((await page.getTextContent()).items).replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim());
      page.cleanup();
    }
    await doc.destroy();
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, JSON.stringify({ pages }));
  }
  return pages.map((t, n) =>
    t
      .split('\n')
      .filter((l, k) => !/^<\/?(?:DOCUMENT|TYPE|SEQUENCE|FILENAME|DESCRIPTION|TEXT|PAGE|PDF|HTML)\b[^>]*>?/i.test(l.trim()) && !(n === 0 && k < 3 && /^\S.*?\s\d+\s+\S+\.(?:htm|html|txt|pdf|xml)\b/i.test(l.trim())))
      .join('\n')
  );
}
/** A picture-only file: under 100 characters a page once browser print headers (date, address) are left out. */
const pictures = (pages) => pages.map((t) => t.split('\n').filter((l) => !/^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/.test(l.trim()) && !/https?:\/\//.test(l)).join('')).join('').replace(/\s/g, '').length < 100 * pages.length;
const desc = (r) => (r.kind === 'none' ? 'none' : `${r.kind} ${r.firstPage}-${r.lastPage}`);

(async () => {
  const want = (s) => SPLIT === 'all' || s === SPLIT;
  const held = new Set(JSON.parse(fs.readFileSync(path.join(EDGAR, 'held-out.json'))).held_out.concat(JSON.parse(fs.readFileSync(path.join(EDGAR, 'held-out-b.json'))).held_out_b));
  const truth = JSON.parse(fs.readFileSync(path.join(RECOG, 'truth.json')));
  const splitOf = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(RECOG, 'list.json'))).map((x) => [x.id, x.split]));
  const pos = [];
  const pic = [];
  for (const set of ['set-a', 'set-b', 'set-c', 'set-d']) {
    const dir = path.join(EDGAR, set);
    if (!fs.existsSync(dir)) continue;
    for (const id of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, id, 'doc.pdf');
      if (!/^[a-d]\d{3}$/.test(id) || !fs.existsSync(file) || !want(held.has(id) ? 'final' : 'tune')) continue;
      const pages = await pagesOf(id, file);
      (pictures(pages) ? pic : pos).push({ id, n: pages.length, r: recognise(pages) });
    }
  }
  const doc = (id) => path.join(RECOG, 'dl', id, 'doc.pdf');
  const neg = [];
  for (const id of truth.negative.filter((x) => want(splitOf[x]))) neg.push({ id, n: 0, r: recognise(await pagesOf(id, doc(id))) });
  const comb = [];
  const err = (v, [a, b]) => (v < a ? a - v : v > b ? v - b : 0);
  for (const [id, t] of Object.entries(truth.combined).filter(([x]) => want(splitOf[x]))) {
    const pages = await pagesOf(id, doc(id));
    const r = recognise(pages);
    comb.push({ id, n: pages.length, t, r, e1: r.kind === 'none' ? null : err(r.firstPage, t.first), e2: r.kind === 'none' ? null : err(r.lastPage, t.last) });
  }
  const amb = [];
  for (const id of Object.keys(truth.ambiguous).filter((x) => want(splitOf[x]))) {
    const pages = await pagesOf(id, doc(id));
    amb.push({ id, n: pages.length, r: recognise(pages) });
  }
  const ok = pos.filter((x) => x.r.kind !== 'none');
  console.log(`agreements (text layer) recognised ${ok.length}/${pos.length}: as the whole file ${pos.filter((x) => x.r.kind === 'agreement').length}, as part of a file ${pos.filter((x) => x.r.kind === 'combined').length}${pos.some((x) => x.r.kind === 'combined') ? ' (' + pos.filter((x) => x.r.kind === 'combined').map((x) => `${x.id} ${x.r.firstPage}-${x.r.lastPage}/${x.n}`).join(', ') + ')' : ''}`);
  console.log(`  missed: ${pos.filter((x) => x.r.kind === 'none').map((x) => `${x.id}/${x.n}`).join(', ') || 'none'}`);
  console.log(`agreements that are pictures (text layer alone; the browser reads their pictures): ${pic.filter((x) => x.r.kind !== 'none').length}/${pic.length} from the text layer: ${pic.map((x) => x.id).join(', ')}`);
  const fp = neg.filter((x) => x.r.kind !== 'none');
  console.log(`non-agreements wrongly recognised ${fp.length}/${neg.length}${fp.length ? ': ' + fp.map((x) => `${x.id} ${desc(x.r)}`).join(', ') : ''}`);
  const found = comb.filter((x) => x.r.kind !== 'none');
  const exact = comb.filter((x) => x.e1 === 0 && x.e2 === 0);
  console.log(`combined files with the agreement found ${found.length}/${comb.length}; range exact ${exact.length}/${comb.length}`);
  for (const x of comb) console.log(`  ${x.id} labelled ${x.t.first.join('|')}-${x.t.last.join('|')} of ${x.n}, found ${desc(x.r)}, page error first ${x.e1 == null ? '-' : x.e1} last ${x.e2 == null ? '-' : x.e2}`);
  for (const x of amb) console.log(`  ambiguous ${x.id} (${truth.ambiguous[x.id].slice(0, 60)}): found ${desc(x.r)} of ${x.n}`);
  console.log(`RECOGNITION: ${SPLIT} agreements ${ok.length}/${pos.length}, non-agreements wrongly recognised ${fp.length}/${neg.length}, combined found ${found.length}/${comb.length} (exact range ${exact.length})`);
})();
