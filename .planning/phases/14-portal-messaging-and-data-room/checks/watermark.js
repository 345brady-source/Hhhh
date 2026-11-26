// gate: node
// last "WATERMARK: PASS (cases run: 5)"
// The data room's watermark (14-02, MS-13): assets/js/watermark.js stamps every page of a PDF for one prospect with the
// shipped writer (assets/vendor/pdfwrite/write.js), the same module in Node (require) and in the portal (load11's vm).
// No browser.
//   node watermark.js [--case every-page,folded,loaders,refuse,big]
// Cases:
//   every-page  a 5-page memo stamped for 'Prospect One': 5 pages; every page's content holds the hex form of the
//               diagonal and footer lines lines() returns; a new file, not an added revision; no library name anywhere
//               in the copy (plain, hex or UTF-16 hex), and its Producer and Creator read back as the firm (white label)
//   folded      'Łukasz Żółć' stamps as 'Lukasz Zolc' (folded true), '李' becomes '?', an ASCII name is not folded
//   loaders     the same input stamped through require and through NS.watermark in the portal gives identical bytes
//   refuse      'hello' and '%PDF-' followed by garbage are refused with their sentences
//   big         a PDF at the 25 MB limit is stamped; prints 'stamp input: <n> bytes' and 'stamp 25 MB: <ms> ms, <pages>
//               pages' (measured, no threshold asserted: plan 14-05 fixes the server limit from its own measurement)
// Fixture PDFs are made at run time (fixtures/room-pdf.js), invented text only. Every case runs on every call (the
// measurement is never replayed from an earlier run).
process.env.GATE_FRESH = '1';
const path = require('path');
const zlib = require('zlib');
const L6 = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const LD = () => require('../../11-fund-accounting-and-cpa-year-end-package/checks/load11.js');
const F = require('./fixtures/room-pdf.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const TODAY = '2027-01-20';
const FIRM = 'Kestrel Bay Capital';
const writer = () => require(path.join(ROOT, 'assets/vendor/pdfwrite/write.js'));
const WM = () => require(path.join(ROOT, 'assets/js/watermark.js'));
const OPTS = (name, email) => ({ name, email, day: TODAY, viewId: 'v7k2q9', room: 'Kestrel Bay Fund II data room', firm: FIRM });
const ONE = ['Prospect One', 'prospect.one@example.invalid'];

/** The hex form the writer gives a standard-font text (one byte per character, Latin-1 = WinAnsi here), lower case. */
const hexOf = (s) => Array.from(s, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
/** Every page's content streams, inflated, as one lower-case text per page. */
async function pageTexts(L, bytes) {
  const doc = await L.PDFDocument.load(bytes, { updateMetadata: false });
  return doc.getPages().map((page) => {
    const c = page.node.Contents();
    const refs = c instanceof L.PDFArray ? c.asArray() : [c];
    return refs
      .map((r) => {
        const s = r instanceof L.PDFRef ? doc.context.lookup(r) : r;
        const raw = Buffer.from(s.getContents ? s.getContents() : s.contents);
        const filter = s.dict.get(L.PDFName.of('Filter'));
        return (filter && String(filter) === '/FlateDecode' ? zlib.inflateSync(raw) : raw).toString('latin1');
      })
      .join('\n')
      .toLowerCase();
  });
}
/** The library's names wherever they could be: plain text, hex of Latin-1, hex of UTF-16 (how the writer stores metadata). */
function libraryNames(bytes) {
  const t = Buffer.from(bytes).toString('latin1').toLowerCase();
  const u16 = (s) => Array.from(s, (c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  return ['pdf-lib', 'hopding'].filter((w) => t.indexOf(w) >= 0 || t.indexOf(hexOf(w)) >= 0 || t.indexOf(u16(w)) >= 0 || t.indexOf(u16(w.replace(/./, (c) => c.toUpperCase()))) >= 0);
}
async function refusal(p) {
  try {
    await p();
  } catch (e) {
    return String(e && e.message);
  }
  return '(no error)';
}

const cases = {
  async 'every-page'({ check }) {
    const L = writer();
    const wm = WM();
    const bytes = await F.memo(L, { pages: 5, label: 'Kestrel Bay Fund II' });
    check('the fixture carries the library name, so the white-label test below can fail', libraryNames(bytes).length > 0);
    const out = await wm.stamp(L, bytes, OPTS(...ONE));
    const t = wm.lines(OPTS(...ONE));
    check("lines() gives 'Confidential · Prospect One · prospect.one@example.invalid · 2027-01-20'", t.diagonal === 'Confidential · Prospect One · prospect.one@example.invalid · 2027-01-20', t.diagonal);
    check("lines() gives the footer '<firm> · <room> · view <id>'", t.footer === 'Kestrel Bay Capital · Kestrel Bay Fund II data room · view v7k2q9', t.footer);
    const pages = await pageTexts(L, out.bytes);
    check('the copy has 5 pages', out.pages === 5 && pages.length === 5, pages.length);
    const miss = pages.map((p, i) => (p.indexOf(hexOf(t.diagonal)) >= 0 && p.indexOf(hexOf(t.footer)) >= 0 ? 0 : i + 1)).filter(Boolean);
    check("every page's content holds the diagonal line and the footer", miss.length === 0, { pagesMissing: miss });
    const orig = Buffer.from(bytes);
    const copy = Buffer.from(out.bytes);
    check('the copy is a new file, not the original with a revision added', !copy.subarray(0, orig.length).equals(orig));
    check("the copy names no library ('pdf-lib', 'Hopding') in any form", libraryNames(out.bytes).length === 0, libraryNames(out.bytes));
    const back = await L.PDFDocument.load(out.bytes, { updateMetadata: false });
    check('the Producer and Creator read back as the firm', back.getProducer() === FIRM && back.getCreator() === FIRM, { producer: back.getProducer(), creator: back.getCreator() });
    check("the Subject names the prospect and the Keywords the view id", back.getSubject() === 'Confidential copy for Prospect One prospect.one@example.invalid' && back.getKeywords() === 'view v7k2q9', { s: back.getSubject(), k: back.getKeywords() });
    check('an ASCII name is not reported as folded', out.folded === false);
  },

  async folded({ check }) {
    const L = writer();
    const wm = WM();
    const a = wm.fold('Łukasz Żółć');
    check("'Łukasz Żółć' folds to 'Lukasz Zolc'", a.text === 'Lukasz Zolc' && a.folded === true, a);
    const b = wm.fold('李');
    check("'李' becomes '?'", b.text === '?' && b.folded === true, b);
    const c = wm.fold('Prospect One');
    check('an ASCII name gives folded false', c.text === 'Prospect One' && c.folded === false, c);
    const d = wm.fold('José Müller ß Ø');
    check("accents and the special letters fold ('Jose Muller ss O')", d.text === 'Jose Muller ss O' && d.folded === true, d);
    const bytes = await F.memo(L, { pages: 2 });
    const opts = OPTS('Łukasz Żółć', 'lukasz@example.invalid');
    const out = await wm.stamp(L, bytes, opts);
    const t = wm.lines(opts);
    check("the stamp reports folded true and its line reads 'Lukasz Zolc'", out.folded === true && t.diagonal.indexOf('Lukasz Zolc') >= 0, { folded: out.folded, diagonal: t.diagonal });
    const pages = await pageTexts(L, out.bytes);
    check('both pages hold the folded line', pages.length === 2 && pages.every((p) => p.indexOf(hexOf(t.diagonal)) >= 0));
  },

  async loaders({ check }) {
    const L = writer();
    const wm = WM();
    const { loadPortal } = LD();
    const NS = loadPortal(ROOT, { today: TODAY, edition: 'diy', extra: ['watermark.js'] });
    check('NS.watermark is loaded in the portal', !!NS.watermark && typeof NS.watermark.stamp === 'function');
    const bytes = await F.memo(L, { pages: 3 });
    const a = await wm.stamp(L, bytes, OPTS(...ONE));
    const b = await NS.watermark.stamp(L, bytes, OPTS(...ONE));
    const a2 = await wm.stamp(L, bytes, OPTS(...ONE));
    check('the same input gives identical bytes through require and in the portal', Buffer.from(a.bytes).equals(Buffer.from(b.bytes)), { require: a.bytes.length, portal: b.bytes.length });
    check('stamping twice gives identical bytes', Buffer.from(a.bytes).equals(Buffer.from(a2.bytes)));
    const back = await L.PDFDocument.load(a.bytes, { updateMetadata: false });
    const iso = (d) => (d && d.toISOString ? d.toISOString() : String(d));
    check('the creation and change dates are the day at 00:00 UTC', iso(back.getCreationDate()) === '2027-01-20T00:00:00.000Z' && iso(back.getModificationDate()) === '2027-01-20T00:00:00.000Z', { c: iso(back.getCreationDate()), m: iso(back.getModificationDate()) });
  },

  async refuse({ check }) {
    const L = writer();
    const wm = WM();
    const r1 = await refusal(() => wm.stamp(L, Buffer.from('hello'), OPTS(...ONE)));
    check("'hello' is refused with 'This file is not a PDF.'", r1 === 'This file is not a PDF.', r1);
    const r2 = await refusal(() => wm.stamp(L, Buffer.from('%PDF-1.7 \x00\x13 garbage that is not a document', 'latin1'), OPTS(...ONE)));
    check("'%PDF-' and garbage is refused with 'This PDF could not be stamped.'", r2 === 'This PDF could not be stamped.', r2);
    const r3 = await refusal(() => wm.stamp(L, new Uint8Array(0), OPTS(...ONE)));
    check('an empty file is refused as not a PDF', r3 === 'This file is not a PDF.', r3);
  },

  async big({ check }) {
    const L = writer();
    const wm = WM();
    const bytes = await F.big(L, 25600000);
    console.log(`stamp input: ${bytes.length} bytes`);
    check('the input is at the 25 MB limit (25,000,000 to 26,214,400 bytes)', bytes.length >= 25000000 && bytes.length <= 26214400, bytes.length);
    const t0 = process.hrtime.bigint();
    const out = await wm.stamp(L, bytes, OPTS(...ONE));
    const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
    console.log(`stamp 25 MB: ${ms} ms, ${out.pages} pages`);
    check('the 25 MB file is stamped on every page', out.pages === 41 && out.bytes.length > bytes.length, { pages: out.pages, size: out.bytes.length });
  }
};

L6.runParts(cases, { name: 'WATERMARK', unit: 'cases', flag: '--case' });
