/*
 * The data room's watermark: every page of a PDF a prospect receives is stamped with their name, email, the date and
 * "Confidential", diagonal and light, with a footer naming the firm, the room and a short view id (14-02, MS-13).
 *
 * One module for the browser and the server. It works on plain data only and touches nothing when it loads (no page,
 * storage, network or clock), so it also loads in Node (module.exports). The PDF writer's namespace is passed in:
 * NS.esignKit.writer() in the browser, a require of assets/vendor/pdfwrite/write.js on the server.
 *
 *   fold(text)              { text, folded }: the text in the characters the standard PDF fonts print. Accents are taken
 *                           off (NFKD, combining marks removed), then Ł→L, ł→l, Ø→O, ø→o, Đ→D, đ→d, ß→ss, Æ→AE, æ→ae,
 *                           Œ→OE, œ→oe; any other character outside printable ASCII and the Latin-1 range becomes '?'.
 *                           folded is true when the text changed.
 *   lines(o)                { diagonal, footer, folded } for o { name, email, day, viewId, room, firm }:
 *                           'Confidential · <name> · <email> · <day>' and '<firm> · <room> · view <viewId>', folded
 *   stamp(L, bytes, opts)   Promise<{ bytes, folded, pages }>: the stamped copy (a new file, not an added revision).
 *                           opts as lines(), day 'YYYY-MM-DD'. The copy's Subject is 'Confidential copy for <name>
 *                           <email>', its Keywords 'view <viewId>', its Producer and Creator the firm, its creation and
 *                           change dates the day at 00:00 UTC (so the same input gives the same bytes). Refused with an
 *                           Error: 'This file is not a PDF.' (no '%PDF-' header), 'This PDF could not be stamped.' (a
 *                           file the writer cannot open, an encrypted one, or one with no pages).
 */
(function (NS) {
  'use strict';

  const MAP = { Ł: 'L', ł: 'l', Ø: 'O', ø: 'o', Đ: 'D', đ: 'd', ß: 'ss', Æ: 'AE', æ: 'ae', Œ: 'OE', œ: 'oe' };
  const SEP = ' · ';

  function fold(text) {
    const was = String(text == null ? '' : text);
    let out = '';
    const plain = was.normalize('NFKD').replace(/[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]/g, '');
    for (const ch of plain) {
      if (MAP[ch]) out += MAP[ch];
      else {
        const c = ch.codePointAt(0);
        out += (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) ? ch : '?';
      }
    }
    return { text: out, folded: out !== was };
  }

  function lines(o) {
    const x = o || {};
    const f = (v) => fold(String(v == null ? '' : v).trim());
    const name = f(x.name);
    const email = f(x.email);
    const firm = f(x.firm);
    const room = f(x.room);
    const viewId = f(x.viewId);
    const day = f(x.day);
    return {
      diagonal: ['Confidential', name.text, email.text, day.text].join(SEP),
      footer: [firm.text, room.text, `view ${viewId.text}`].filter((s) => s !== '').join(SEP),
      folded: [name, email, firm, room, viewId, day].some((v) => v.folded)
    };
  }

  const isView = (b) => !!b && typeof b === 'object' && typeof b.byteLength === 'number' && typeof b.length === 'number';
  const DATE = (day) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
    return m ? `D:${m[1]}${m[2]}${m[3]}000000Z` : '';
  };

  async function stamp(L, bytes, opts) {
    const o = opts || {};
    const b = isView(bytes) ? bytes : bytes && typeof bytes.byteLength === 'number' ? new Uint8Array(bytes) : null;
    const head = '%PDF-';
    if (!b || b.length < head.length || Array.prototype.some.call(head, (c, i) => b[i] !== c.charCodeAt(0))) throw new Error('This file is not a PDF.');
    const L_ = lines(o);
    let doc;
    let pages;
    try {
      doc = await L.PDFDocument.load(b, { updateMetadata: false });
      pages = doc.getPages();
    } catch (e) {
      throw new Error('This PDF could not be stamped.');
    }
    if (!pages || !pages.length) throw new Error('This PDF could not be stamped.');
    const font = await doc.embedFont(L.StandardFonts.Helvetica);
    const grey = L.rgb(0.5, 0.5, 0.5);
    const A = (35 * Math.PI) / 180;
    const cos = Math.cos(A);
    const sin = Math.sin(A);
    pages.forEach((page) => {
      const { width: W, height: H } = page.getSize();
      // The diagonal line: as wide as the page allows along a 35-degree line through its centre.
      const at1 = font.widthOfTextAtSize(L_.diagonal, 1) || 1;
      const size = Math.max(6, Math.min(48, (W * 0.85) / cos / at1, (H * 0.85) / sin / at1));
      const w = at1 * size;
      const cap = font.heightAtSize(size, { descender: false });
      const x = W / 2 - (w / 2) * cos + (cap / 2) * sin;
      const y = H / 2 - (w / 2) * sin - (cap / 2) * cos;
      page.drawText(L_.diagonal, { x, y, size, font, color: grey, opacity: 0.18, rotate: L.degrees(35) });
      const fw = font.widthOfTextAtSize(L_.footer, 7);
      page.drawText(L_.footer, { x: Math.max(8, (W - fw) / 2), y: 18, size: 7, font, color: grey, opacity: 0.6 });
    });
    const name = String(o.name == null ? '' : o.name).trim();
    const email = String(o.email == null ? '' : o.email).trim();
    const firm = fold(String(o.firm == null ? '' : o.firm).trim()).text;
    doc.setSubject(`Confidential copy for ${name} ${email}`);
    doc.setProducer(firm);
    doc.setCreator(firm);
    // Keywords and dates are written into the document's information directly: the writer's own setters test for an
    // Array or a Date of its realm, which a caller in another realm (the portal loaded in a Node vm) does not pass.
    const info = doc.getInfoDict();
    info.set(L.PDFName.of('Keywords'), L.PDFHexString.fromText(`view ${fold(String(o.viewId == null ? '' : o.viewId).trim()).text}`));
    const when = DATE(o.day);
    if (when) {
      info.set(L.PDFName.of('CreationDate'), L.PDFString.of(when));
      info.set(L.PDFName.of('ModDate'), L.PDFString.of(when));
    }
    const out = await doc.save({ useObjectStreams: false });
    return { bytes: out, folded: L_.folded, pages: pages.length };
  }

  const API = { fold, lines, stamp };
  if (NS) NS.watermark = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
