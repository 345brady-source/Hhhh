// gate: none
// Run-time fixture PDFs for phase 14's data room checks (14-02). Nothing is committed as a PDF and no personal data is
// used: every page is drawn here with the shipped writer (assets/vendor/pdfwrite/write.js) in the standard fonts, with
// invented text only.
//   const F = require('./fixtures/room-pdf.js');
//   const bytes = await F.memo(L, { pages: 2, label: 'Fund II' });   // an invented memorandum, Uint8Array
//   const bytes = await F.big(L, 25600000);                         // about that many bytes, used only to measure
// L is the writer's namespace (require of write.js). The writer's own default metadata (its Producer and Creator) is
// left on these files on purpose: the watermark check proves the stamp replaces it with the firm's name.
// The files are the same bytes on every run (fixed dates, a fixed pseudo-random sequence for the image).
const zlib = require('zlib');

const FIXED = new Date(Date.UTC(2026, 0, 15, 0, 0, 0));
const PARAS = [
  'This memorandum describes an invented offering prepared only to test the data room. It is not an offer to sell or a solicitation of an offer to buy any security.',
  'The fund will invest in a small number of private companies over a period of about four years and hold each investment for five to seven years.',
  'Investors should read the whole memorandum, the limited partnership agreement and the subscription documents before deciding whether to invest.',
  'An investment in the fund is speculative, involves a high degree of risk and is suitable only for persons who can bear the loss of their entire investment.',
  'Interests in the fund have not been registered and may not be transferred except as the partnership agreement allows.'
];

/** Lines of at most `max` points wide in `font` at `size`. */
function wrap(text, font, size, max) {
  const out = [];
  let line = '';
  text.split(' ').forEach((w) => {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  });
  if (line) out.push(line);
  return out;
}

async function textDoc(L, pages, label) {
  const doc = await L.PDFDocument.create();
  const font = await doc.embedFont(L.StandardFonts.Helvetica);
  const bold = await doc.embedFont(L.StandardFonts.HelveticaBold);
  for (let n = 1; n <= pages; n++) {
    const page = doc.addPage([612, 792]);
    let y = 730;
    page.drawText(`Private placement memorandum (sample): ${label}`, { x: 56, y, size: 14, font: bold });
    y -= 30;
    for (let k = 0; k < 6; k++) {
      wrap(PARAS[(n + k) % PARAS.length], font, 11, 500).forEach((l) => {
        page.drawText(l, { x: 56, y, size: 11, font });
        y -= 16;
      });
      y -= 10;
    }
    page.drawText(`Page ${n} of ${pages}`, { x: 56, y: 40, size: 9, font });
  }
  doc.setTitle(`Private placement memorandum (sample): ${label}`);
  doc.setCreationDate(FIXED);
  doc.setModificationDate(FIXED);
  return doc;
}

/** An invented memorandum of `pages` pages (default 2). */
async function memo(L, opts) {
  const o = opts || {};
  const doc = await textDoc(L, Math.max(1, Math.floor(o.pages || 2)), o.label || 'Sample Fund I');
  return doc.save({ useObjectStreams: false });
}

/**
 * A PDF of about `bytes` bytes: 40 pages of drawn text plus one page holding one generated image (pseudo-random pixels,
 * deflated, so the file is as large as its pixels). Used only to measure the stamp on a file at the size limit.
 */
async function big(L, bytes) {
  const target = Math.floor(bytes);
  const doc = await textDoc(L, 40, 'Large sample');
  const base = (await doc.save({ useObjectStreams: false })).length;
  const width = 2000;
  const room = target - base - 4096; // the image object's dictionary, the page and the cross-reference lines
  const height = Math.max(1, Math.floor(room / (width * 3)));
  const pixels = Buffer.alloc(width * height * 3);
  let s = 0x2545f491;
  for (let i = 0; i + 4 <= pixels.length; i += 4) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    pixels.writeUInt32LE(s >>> 0, i);
  }
  const data = zlib.deflateSync(pixels, { level: 1 });
  const image = doc.context.stream(data, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: width,
    Height: height,
    ColorSpace: 'DeviceRGB',
    BitsPerComponent: 8,
    Filter: 'FlateDecode'
  });
  const ref = doc.context.register(image);
  const page = doc.addPage([612, 792]);
  const name = page.node.newXObject('Im', ref);
  page.pushOperators(L.pushGraphicsState(), L.concatTransformationMatrix(500, 0, 0, 600, 56, 96), L.drawObject(name), L.popGraphicsState());
  return doc.save({ useObjectStreams: false });
}

module.exports = { memo, big };
