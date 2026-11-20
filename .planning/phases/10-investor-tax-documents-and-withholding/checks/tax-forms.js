// gate: node
// last "TAX FORMS: PASS (forms run: 1)"
// The official Form 1099-INT and its Copy B map (plan 10-09, TAX-11), no browser, after phase 6's form-maps.js:
//   node tax-forms.js [--only 1099-INT] [--embed]
// For the form: the pinned file (SHA256SUMS in assets/forms/1099, the map and the constant below agree with the file);
// the page that carries "Copy B" and "For Recipient" and the recipient's instructions after it, found from the file's
// own text; the file's own field list on that page compared with the map both ways (every field mapped or unused, every
// mapped name on that page with the kind and length the file gives); each mapped field beside its own printed label; a
// copy with one byte changed is refused and nothing is filled; a sample recipient copy leaves no field, each filled value
// inside its own field's rectangle, its pages the Copy B page and the recipient's instructions only; and
// assets/forms/1099/forms1099-data.js decodes to exactly the pinned bytes (--embed writes it from the pinned file first).
// Everything is built and read in memory; nothing filled is written. Every number in the sample is invented in a range
// the IRS never issues, and this check prints no number of that shape and no hash.
// The last line is "TAX FORMS: PASS (forms run: N)" or "TAX FORMS: FAIL (forms run: N) - <failed forms>".
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const ROOT = Lib.ROOT;
const EMBED = process.argv.includes('--embed');
process.argv = process.argv.filter((a) => a !== '--embed');
const SRC = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const mask = (s) =>
  String(s)
    .replace(/[0-9a-f]{32,}/gi, '[hex]')
    .replace(/\d{3}-\d{2}-\d{4}/g, '[ddd-dd-dddd]')
    .replace(/\d{2}-\d{7}/g, '[dd-ddddddd]')
    .replace(/\d{9,}/g, '[digits]');
const masked = (check) => (name, ok, info) => check(name, ok, info === undefined ? undefined : mask(typeof info === 'string' ? info : JSON.stringify(info)));

// The file read in the research (SCRATCH/r10/dl/f1099int.pdf, 538,774 bytes), from https://www.irs.gov/pub/irs-pdf/f1099int.pdf.
const PIN = 'ee7697c9b29374596fd9645b157b7312d121ae3c2f76bebf68908c3fc2b739e6';
const KEY = '1099-INT 2024-01 Copy B';
const DATA = 'assets/forms/1099/forms1099-data.js';
const W = () => require(path.join(ROOT, 'assets/vendor/pdfwrite/write.js'));
const fillOpts = () => ({
  fontkit: require(path.join(ROOT, 'assets/vendor/pdfwrite/fonts.js')),
  fontBytes: fs.readFileSync(path.join(ROOT, 'assets/vendor/textfont/DejaVuSans.ttf')),
  sha256: (b) => sha(Buffer.from(b))
});

/** taxforms.js, tax1099-data.js and tax1099.js in a fresh sandbox with window.CVPortal = {}. */
function load() {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window, console, setTimeout: () => 0, clearTimeout: () => {}, TextEncoder, TextDecoder });
  ['taxforms.js', 'tax1099-data.js', 'tax1099.js'].forEach((f) => vm.runInContext(SRC('assets/js/' + f), ctx, { filename: f }));
  return window.CVPortal;
}

/** The file's own field list: name, kind, maxLen and widget rectangles (points, from the top left). */
async function liveFields(bytes) {
  const L = W();
  const pdf = await L.PDFDocument.load(bytes, { updateMetadata: false });
  const pages = pdf.getPages();
  const refPage = {};
  pages.forEach((pg, i) => {
    const a = pg.node.Annots();
    if (a) a.asArray().forEach((r) => (refPage[String(r)] = i + 1));
  });
  return pdf
    .getForm()
    .getFields()
    .map((f) => {
      let kind = 'other';
      let maxLen = null;
      if (f instanceof L.PDFTextField) {
        maxLen = f.getMaxLength() || null;
        kind = f.isCombed() ? 'comb' : 'text';
      } else if (f instanceof L.PDFCheckBox) kind = 'check';
      else if (f instanceof L.PDFSignature) kind = 'sig';
      const rects = f.acroField.getWidgets().map((w) => {
        const r = w.getRectangle();
        const page = refPage[String(pdf.context.getObjectRef(w.dict))] || 0;
        const ph = page ? pages[page - 1].getHeight() : 0;
        return { page, x: r.x, w: r.width, top: ph - r.y - r.height, h: r.height };
      });
      return { name: f.getName(), kind, maxLen, rects };
    });
}
/** Each page's text items { s, x, w, top, bottom } (points from the top left), read with the shipped reader. */
async function readPdf(bytes) {
  const V = require(path.join(ROOT, 'assets/vendor/pdfview/view.js'));
  V.GlobalWorkerOptions.workerSrc = path.join(ROOT, 'assets/vendor/pdfview/view-worker.js');
  const doc = await V.getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false, useSystemFonts: false, disableFontFace: true }).promise;
  const pages = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const h = page.getViewport({ scale: 1 }).height;
      const items = (await page.getTextContent()).items.filter((it) => it.str && it.str.trim()).map((it) => ({ s: it.str, x: it.transform[4], w: it.width || 0, top: h - it.transform[5] - (it.height || 0), bottom: h - it.transform[5] }));
      pages.push({ items, text: items.map((it) => it.s).join(' ') });
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}
/** The printed words just above a rectangle (their foot within 24 points above its top, overlapping it across). */
const above = (items, r) =>
  items
    .filter((it) => it.bottom <= r.top + 2 && it.bottom >= r.top - 24 && it.x < r.x + r.w && it.x + it.w > r.x)
    .sort((a, b) => a.top - b.top || a.x - b.x)
    .map((it) => it.s)
    .join(' ');
// The printed label each mapped field must sit beside on the blank Copy B page: [where, words].
const ANCHORS = {
  year: [above, /For calendar year/],
  payerBlock: [above, /PAYER.S name, street address/],
  payerTin: [above, /PAYER.S TIN/],
  recipientTin: [above, /RECIPIENT.S TIN/],
  recipientName: [above, /RECIPIENT.S name/],
  recipientStreet: [above, /Street address/],
  recipientCity: [above, /City or town/],
  box1: [above, /1 Interest income/],
  box4: [above, /4 Federal income tax withheld/]
};
// An invented sample (never-issued ranges): an employer number starting 00 and a social security number starting 000.
const SAMPLE = {
  year: '2026',
  payerBlock: 'Fund One Notes LLC\n100 Main St\nDallas, TX 75201\n214-555-0100',
  payerTin: '00-' + '7654321',
  recipientTin: '***-**-7310',
  recipientName: 'Avery Example',
  recipientStreet: '22 Oak Ave Apt 4',
  recipientCity: 'Austin, TX 78701',
  box1: '13,333.32',
  box4: '1,600.00'
};

const forms = {
  async '1099-INT'({ check: raw }) {
    const check = masked(raw);
    // the data file first, so every later step can rely on it
    const NS = load();
    const map = NS.tax1099data && NS.tax1099data.MAPS && NS.tax1099data.MAPS[KEY];
    check('the Copy B map exists', !!map, KEY);
    if (!map) return;
    const file = path.join(ROOT, map.file);
    const bytes = fs.readFileSync(file);
    const h = sha(bytes);
    const sums = SRC('assets/forms/1099/SHA256SUMS');
    check('SHA256SUMS pins the file', sums.split('\n').some((l) => l === `${h}  ${path.basename(map.file)}`));
    check("the map's pin equals the file's SHA-256", map.sha256 === h);
    check('the file is the one the research read (the pin in this check)', h === PIN);
    if (h !== PIN) return;

    if (EMBED) {
      const head = '/* Generated by .planning/phases/10-investor-tax-documents-and-withholding/checks/tax-forms.js --embed from the pinned Form 1099-INT in assets/forms/1099 (do not edit by hand). Base64. */\n';
      fs.writeFileSync(path.join(ROOT, DATA), `${head}(function (NS) {\n  NS.tax1099formsData = Object.assign(NS.tax1099formsData || {}, {\n    '${map.file}': '${bytes.toString('base64')}'\n  });\n})((window.CVPortal = window.CVPortal || {}));\n`);
    }
    let decoded = null;
    try {
      const w = { CVPortal: {} };
      vm.runInContext(SRC(DATA), vm.createContext({ window: w }), { filename: DATA });
      const d = w.CVPortal.tax1099formsData || {};
      decoded = Object.keys(d).length === 1 && typeof d[map.file] === 'string' ? Buffer.from(d[map.file], 'base64') : null;
    } catch (e) {
      decoded = null;
    }
    check(`${DATA} holds one entry, the map's file, decoding to exactly the pinned bytes`, !!decoded && decoded.equals(bytes));

    // the pages, from the file's own text
    const blank = await readPdf(bytes);
    const cb = blank.findIndex((p) => /Copy B/.test(p.text) && /For Recipient/.test(p.text)) + 1;
    const ins = blank.findIndex((p, i) => i + 1 > cb && /^Instructions for Recipient(?! \(continued\))/.test(p.text.trim())) + 1;
    const cont = blank.findIndex((p, i) => i + 1 > ins && /^Instructions for Recipient \(continued\)/.test(p.text.trim())) + 1;
    check('the Copy B page, the instructions for the recipient after it and their continuation are found (pages 4, 5 and 7)', cb === 4 && ins === 5 && cont === 7, [cb, ins, cont]);
    check("the map's pages are those three, in that order", JSON.stringify(map.pages) === JSON.stringify([cb, ins, cont]), map.pages);

    // the map against the file, both ways
    const live = await liveFields(bytes);
    const onPage = live.filter((f) => f.rects.some((r) => r.page === cb));
    const byName = {};
    live.forEach((f) => (byName[f.name] = f));
    const where = {};
    const note = (n, how) => (where[n] = (where[n] || []).concat(how));
    Object.keys(map.fields).forEach((k) => note(map.fields[k].name, 'field ' + k));
    Object.keys(map.unused || {}).forEach((r) => map.unused[r].forEach((n) => note(n, 'unused')));
    const missing = onPage.filter((f) => !where[f.name]).map((f) => f.name);
    const twice = Object.keys(where).filter((n) => where[n].length > 1);
    const ghost = Object.keys(where).filter((n) => !byName[n] || !byName[n].rects.every((r) => r.page === cb));
    check(`every field on the Copy B page (${onPage.length}) is mapped or listed as unused`, onPage.length === 31 && !missing.length, missing);
    check('no field is listed twice', !twice.length, twice);
    check('every name in the map is a field of the Copy B page', !ghost.length, ghost);
    Object.keys(map.unused || {}).forEach((r) => check(`the reason for an unused group is given: ${r.slice(0, 50)}`, r.trim().length > 20));
    const kindBad = [];
    Object.keys(map.fields).forEach((k) => {
      const f = map.fields[k];
      const l = byName[f.name];
      if (!l) return;
      if (l.kind !== f.kind) kindBad.push(`${k}: map ${f.kind}, file ${l.kind}`);
      if ((f.max || null) !== l.maxLen) kindBad.push(`${k}: map max ${f.max}, file ${l.maxLen}`);
    });
    check('kinds and lengths match the file', !kindBad.length, kindBad);
    check('removeBeforeFlatten is empty (the Copy B page has no signature field)', Array.isArray(map.removeBeforeFlatten) && map.removeBeforeFlatten.length === 0);
    const labelBad = [];
    Object.keys(ANCHORS).forEach((k) => {
      const l = map.fields[k] && byName[map.fields[k].name];
      if (!l) return labelBad.push(`${k}: not mapped`);
      const [fn, re] = ANCHORS[k];
      const t = fn(blank[cb - 1].items, l.rects[0]);
      if (!re.test(t)) labelBad.push(`${k}: "${t.slice(0, 80)}" does not match ${re}`);
    });
    check(`each mapped field sits beside its own printed label (${Object.keys(ANCHORS).length})`, !labelBad.length && Object.keys(map.fields).length === Object.keys(ANCHORS).length, labelBad);

    // a changed file is refused and nothing is filled
    const bad = Buffer.from(bytes);
    bad[bad.length >> 1] ^= 0xff;
    let got = 'untouched';
    try {
      got = await NS.tax1099.recipientCopy(W(), bad, map, SAMPLE, fillOpts());
    } catch (e) {
      got = e;
    }
    // (the error comes from the sandbox's realm, so it is recognised by its pin mark, not by instanceof)
    check('a copy of the file with one byte changed is refused and nothing is returned', !!got && got.pin === true && typeof got.message === 'string', String(got && got.message));

    // a sample recipient copy
    const out = await NS.tax1099.recipientCopy(W(), bytes, map, SAMPLE, fillOpts());
    const pdf = await W().PDFDocument.load(out, { updateMetadata: false });
    check('the recipient copy has no form field left', pdf.getForm().getFields().length === 0, pdf.getForm().getFields().length);
    const pages = await readPdf(out);
    check('the copy has three pages', pages.length === 3, pages.length);
    if (pages.length !== 3) return;
    check('its first page is the Copy B page, its second and third the instructions for the recipient', /Copy B/.test(pages[0].text) && /For Recipient/.test(pages[0].text) && pages[1].text.trim().indexOf('Instructions for Recipient') === 0 && pages[2].text.trim().indexOf('Instructions for Recipient (continued)') === 0);
    const all = pages.map((p) => p.text).join(' ');
    // The recipient's instructions name other copies in two sentences of their own ("(Continued on the back of Copy 2.)"
    // and a nominee's "File Copy A of the form with the IRS ... Internal Revenue Service Center for your area"); apart
    // from those, no page of the copy carries the heading or the words of Copy A, Copy 1, Copy 2 or Copy C.
    const heads = [].concat(...pages.map((p) => p.items)).filter((it) => /^(Copy [A12C]|For Internal Revenue|Service Center|For State Tax Department)$/.test(it.s.trim()));
    const rest = all.replace(/back\s+of\s+Copy\s+2/g, '').replace(/File\s+Copy\s+A\s+of\s+the\s+form/g, '').replace(/Internal\s+Revenue\s+Service\s+Center\s+for\s+your\s+area/g, '');
    check('no page is Copy A, Copy 1, Copy 2 or Copy C: no such heading, and those words appear only in the instructions\' own two sentences', !heads.length && !/Copy\s+[A12C]\b|Service\s+Center|For\s+State\s+Tax/.test(rest), heads.map((h) => h.s));
    const p1 = pages[0].items;
    const outside = [];
    Object.keys(SAMPLE).forEach((k) => {
      const r = byName[map.fields[k].name].rects[0];
      SAMPLE[k].split('\n').forEach((part) => {
        const it = p1.find((x) => x.s.trim() === part);
        if (!it) return outside.push(`${k}: a filled line is not printed on its own`);
        const cx = it.x + it.w / 2;
        const cy = (it.top + it.bottom) / 2;
        if (!(cx >= r.x - 1 && cx <= r.x + r.w + 1 && cy >= r.top - 1 && cy <= r.top + r.h + 1)) outside.push(`${k}: outside its field`);
      });
    });
    check(`each filled value lies inside its own field's rectangle (${Object.keys(SAMPLE).length} fields)`, !outside.length, outside);
    const blankWords = new Set(blank[cb - 1].items.map((it) => it.s.trim()));
    const filled = new Set([].concat(...Object.values(SAMPLE).map((v) => v.split('\n'))));
    const extra = p1.filter((it) => !blankWords.has(it.s.trim()) && !filled.has(it.s.trim())).map((it) => it.s);
    check('nothing else is printed on the Copy B page', !extra.length, extra.slice(0, 5));
  }
};

Lib.runParts(forms, { name: 'TAX FORMS', unit: 'forms', flag: '--only' });
