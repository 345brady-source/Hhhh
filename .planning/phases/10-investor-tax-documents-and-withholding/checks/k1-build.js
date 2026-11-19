// gate: none
// Test-only code for phase 10 (used by k1-split.js, taxdocs-math.js and plan 10-04's browser check): builds combined
// Schedule K-1 files from the IRS's own blank 2025 form (fixtures/f1065sk1-2025.pdf) with invented partners, reads a
// file's pages into NS.taxdocs.pageFacts results, and loads the portal's scripts in a sandbox.
//
// Every person, address and number here is invented. Every number uses a form the IRS never issues: a social security
// number starting 000, an employer number starting 00. The files this builds are never committed.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const FORM = path.join(__dirname, 'fixtures', 'f1065sk1-2025.pdf');
const FORM_SHA256 = '66098d4d48537ce2dac1f093d6351567957896e5843d8c524823b380068f6547';
const FIELD = 'topmostSubform[0].Page1[0].LeftCol[0].';
const OFFERING = 'OFF-1';
const FUND = { name: 'Example Fund LP', ein: '00-3456789', address: 'Example Fund LP\n1 Market Street\nWilmington, DE 19801' };

// tin: what the K-1 shows in item E; f: item F as the preparer typed it; reg: the portal's record of that investor;
// extra: statement pages after the K-1. The twelve awkward cases of the research (10-RESEARCH.md, "The measurement").
const PARTNERS = [
  { id: 'INV-1001', reg: { title: 'Maria Lopez', last4: '6789' }, tin: '000-45-6789', f: 'Maria Lopez\n14 Elm Street\nAustin, TX 78701', extra: 2 },
  { id: 'INV-1002', reg: { title: 'Harbor Light Holdings LLC', contact: 'Tomas Reed', last4: '4321' }, tin: '00-7654321', f: 'Harbor Light Holdings LLC\n200 Bay Road Suite 4\nMiami, FL 33101', extra: 0 },
  // printed with its first five masked, as the Form 1065 instructions allow on the partner's copy
  { id: 'INV-1003', reg: { title: 'Daniel Okafor', last4: '0042' }, tin: '***-**-0042', f: 'Daniel Okafor\n9 Pine Court\nDenver, CO 80202', extra: 3 },
  // a disregarded LLC: items E and F carry its owner; the account is in the LLC's name
  { id: 'INV-1004', reg: { title: 'Kestrel Ridge LLC', contact: 'Dana Whitlow', last4: '7711' }, tin: '000-12-7711', f: 'Priya Raman\n77 Lake Drive\nSeattle, WA 98101', extra: 1 },
  // two IRAs at one custodian: the same number in item E on both
  { id: 'INV-1005', reg: { title: 'Northgate Trust Co FBO Alan Reyes IRA', contact: 'Alan Reyes', last4: '5500' }, tin: '00-1235500', f: 'Northgate Trust Co FBO Alan Reyes IRA\nPO Box 100\nChicago, IL 60601', extra: 0 },
  { id: 'INV-1006', reg: { title: 'Northgate Trust Co FBO Susan Reyes IRA', contact: 'Susan Reyes', last4: '5500' }, tin: '00-1235500', f: 'Northgate Trust Co FBO Susan Reyes IRA\nPO Box 100\nChicago, IL 60601', extra: 0 },
  // a foreign partner with no U.S. number
  { id: 'INV-1007', reg: { title: 'Lukas Dvorak', last4: '' }, tin: '', f: 'Lukas Dvorak\nNa Prikope 12\nPraha 110 00 Czech Republic', extra: 2 },
  // the same last four digits as INV-1001
  { id: 'INV-1008', reg: { title: 'Robert Chen', last4: '6789' }, tin: '000-33-6789', f: 'Robert Chen\n5 Oak Lane\nBoston, MA 02108', extra: 0 },
  // near-identical names
  { id: 'INV-1009', reg: { title: 'John Smith', last4: '1010' }, tin: '000-22-1010', f: 'John Smith\n1 First Ave\nNew York, NY 10001', extra: 1 },
  { id: 'INV-1010', reg: { title: 'John Smith Jr', last4: '2020' }, tin: '000-22-2020', f: 'John Smith Jr\n1 First Ave\nNew York, NY 10001', extra: 1 },
  // typed surname first, in capitals
  { id: 'INV-1011', reg: { title: 'Eleanor Whitfield', last4: '3344' }, tin: '000-55-3344', f: 'WHITFIELD, ELEANOR\n30 Mill Road\nPortland, OR 97201', extra: 0 },
  { id: 'INV-1012', reg: { title: 'Whitfield Family Trust', contact: 'Eleanor Whitfield', last4: '9090' }, tin: '00-0009090', f: 'Whitfield Family Trust\nEleanor Whitfield TTEE\n30 Mill Road\nPortland, OR 97201', extra: 4 }
];
/** What the measurement expects for each of the twelve: 10 on number and name, 1 on number only, 1 on name only. */
const EXPECTED_BASIS = { 'INV-1004': 'number only', 'INV-1007': 'name only' };
/** Every full number a built file can carry (the search list of the "nothing is stored" case). */
const NUMBERS = () => Array.from(new Set(PARTNERS.map((p) => p.tin).concat([FUND.ein, OTHER_EIN]).filter((t) => /^\d[\d-]+$/.test(t))));
const OTHER_EIN = '00-8642097';

/** n partners: the twelve repeated, each later round with its number in every name (ids INV-2001 and up). */
function many(n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const p = PARTNERS[k % PARTNERS.length];
    const round = Math.floor(k / PARTNERS.length) + 1;
    if (round === 1) {
      out.push(p);
      continue;
    }
    const lines = p.f.split('\n');
    lines[0] = `${lines[0]} ${round}`;
    out.push(Object.assign({}, p, { id: `INV-${2000 + k + 1}`, f: lines.join('\n'), reg: Object.assign({}, p.reg, { title: `${p.reg.title} ${round}`, contact: `${p.reg.contact || p.reg.title} ${round}` }) }));
  }
  return out;
}

/** The PDF libraries: the copies shipped in the repository when present (plan 10-03), otherwise the scratch copies. */
function libs() {
  const own = { view: path.join(ROOT, 'assets/vendor/pdfview/view.js'), worker: path.join(ROOT, 'assets/vendor/pdfview/view-worker.js'), write: path.join(ROOT, 'assets/vendor/pdfwrite/write.js') };
  if (Object.values(own).every((f) => fs.existsSync(f))) return Object.assign(own, { from: 'the copies shipped in the repository (assets/vendor/pdfview, assets/vendor/pdfwrite)' });
  const V = require(path.join(ROOT, '.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js')).VENDOR;
  const v = { view: path.join(V, 'pdfjs/package/build/pdf.min.js'), worker: path.join(V, 'pdfjs/package/build/pdf.worker.min.js'), write: path.join(V, 'pdflib/package/dist/pdf-lib.min.js') };
  const missing = Object.values(v).find((f) => !fs.existsSync(f)) || '';
  return Object.assign(v, { missing, from: 'the scratch copies (the reader 3.11.174 browser build and the writer 1.17.1, as the portal loads them today)' });
}

// A one-pixel picture, drawn across a page to stand for a scanned page (a page with no text at all).
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/**
 * Build one combined file in `dir`. opts: name; flatten (true: values printed on the page; false: left in the form's
 * fields); partners (default the twelve); cover (a transmittal page first; default true). A partner may carry
 * picture: true (its K-1 is a picture of a page, with no text), coverLine: 'text' (a one-line page before its K-1) and
 * ein (a K-1 of another partnership). Returns { file, bytes, pages, partners: [{ id, first, last, picture, cover }] } with
 * page numbers counted from 1; first and last are the K-1 page and the last statement page after it.
 */
async function build(dir, opts) {
  const o = Object.assign({ name: 'combined.pdf', flatten: true, partners: PARTNERS, cover: true }, opts || {});
  const W = require(libs().write);
  const form = fs.readFileSync(FORM);
  const out = await W.PDFDocument.create();
  const font = await out.embedFont(W.StandardFonts.Helvetica);
  const line = (pg, s, y) => pg.drawText(s, { x: 40, y, size: 9, font });
  if (o.cover) line(out.addPage([612, 792]), `${FUND.name} - 2025 Schedules K-1 - transmittal`, 700);
  const truth = [];
  for (const p of o.partners) {
    let cover = 0;
    if (p.coverLine) {
      line(out.addPage([612, 792]), p.coverLine, 700);
      cover = out.getPageCount();
    }
    const first = out.getPageCount() + 1;
    if (p.picture) {
      const img = await out.embedPng(PIXEL);
      out.addPage([612, 792]).drawImage(img, { x: 36, y: 36, width: 540, height: 720 });
    } else {
      const one = await W.PDFDocument.load(form, { updateMetadata: false });
      const f = one.getForm();
      f.getTextField(FIELD + 'f1_6[0]').setText(p.ein || FUND.ein);
      f.getTextField(FIELD + 'f1_7[0]').setText(p.ein ? 'Another Fund LP\n9 Other Street\nDover, DE 19901' : FUND.address);
      if (p.tin) f.getTextField(FIELD + 'f1_9[0]').setText(p.tin);
      f.getTextField(FIELD + 'f1_10[0]').setText(p.f);
      if (o.flatten) f.flatten();
      const src = await W.PDFDocument.load(await one.save());
      (await out.copyPages(src, [0])).forEach((pg) => out.addPage(pg));
    }
    for (let n = 0; n < (p.extra || 0); n++) {
      const pg = out.addPage([612, 792]);
      line(pg, `${FUND.name}    ${FUND.ein}    Schedule K-1 supplemental information    statement ${n + 1}`, 750);
      line(pg, 'Box 20, code Z: section 199A information', 720);
    }
    truth.push({ id: p.id, first, last: out.getPageCount(), picture: !!p.picture, cover });
  }
  const bytes = Buffer.from(await out.save());
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, o.name);
  fs.writeFileSync(file, bytes);
  return { file, bytes, pages: out.getPageCount(), partners: truth };
}

/**
 * A file's pages as NS.taxdocs.pageFacts results, read with the portal's reader library. opts.noFields withholds the
 * form-field values (the proof that they are read). What the library returns never leaves this function.
 */
async function read(bytes, T, opts) {
  const lib = libs();
  const V = require(lib.view);
  V.GlobalWorkerOptions.workerSrc = lib.worker;
  // verbosity 0: errors only (the library warns about a standard font on every page otherwise)
  const doc = await V.getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false, useSystemFonts: false, disableFontFace: true }).promise;
  const pages = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const height = page.getViewport({ scale: 1 }).height;
      const it = T.pdfItems(height, (await page.getTextContent()).items, opts && opts.noFields ? [] : await page.getAnnotations());
      pages.push(T.pageFacts(it.text, it.fields));
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

/** The portal's own scripts in a fresh sandbox (the real dates, change log and document listing), then taxdocs.js. */
function portal(files) {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window, console, setTimeout, clearTimeout });
  (files || ['data.js', 'audit.js', 'operations.js', 'taxdocs.js']).forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8'), ctx, { filename: f }));
  return window.CVPortal;
}

/** A workspace whose investors are the given partners, each holding the one offering. The change log starts empty. */
function workspace(partners) {
  return {
    tenant: { id: 'example', shortName: 'Example' },
    audit: [],
    docs: [],
    offerings: [{ id: OFFERING, name: FUND.name }],
    investors: (partners || PARTNERS).map((p) => ({ id: p.id, title: p.reg.title, contact: p.reg.contact || p.reg.title, tinLast4: p.reg.last4, positions: [{ offeringId: OFFERING }] }))
  };
}

module.exports = { ROOT, FORM, FORM_SHA256, FUND, OFFERING, OTHER_EIN, PARTNERS, EXPECTED_BASIS, NUMBERS, many, libs, build, read, portal, workspace };
