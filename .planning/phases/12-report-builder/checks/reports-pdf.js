// gate: browser
// last "REPORTS PDF: PASS (cases run: 9)"
// Plan 12-03: the report page composer (assets/js/reports-pdf.js, NS.reportsPdf) read back by independent tools. Node
// cases load the portal with lib12.portal (load11.js with the shipped PDF writer, font embedder and both Unicode font
// data files) plus reports-pdf.js, and pass the kit built from those shipped files; nothing is fetched. Each PDF is
// written into lib12.work('reports-pdf') (under P6_OUT, named with this process's id, removed when the run ends, pass
// or fail) and read with pdftotext, pdfinfo, pdfimages, pdffonts and pdftoppm. The model drawn is
// fixtures/layout-a.js, written by hand to plan 12-02's layout model.
//   node checks/reports-pdf.js [--case one,...]
'use strict';
const path = require('path');
const T = require('./lib12.js');
const F = require('./fixtures/layout-a.js');

const clone = (x) => JSON.parse(JSON.stringify(x));
let seq = 0;
const fileName = (name) => `${name}-${++seq}.pdf`;

/** The portal with the composer loaded: { NS, kit, G, P } (P = NS.reportsPdf). */
function load() {
  const L = T.portal({ extra: ['reports-pdf.js'] });
  if (!L.NS.reportsPdf || typeof L.NS.reportsPdf.compose !== 'function') throw new Error('assets/js/reports-pdf.js did not define NS.reportsPdf.compose');
  return Object.assign(L, { P: L.NS.reportsPdf });
}
/** Bytes of the sandbox's own type from base64. */
const bytesIn = (G, b64) => G.Uint8Array.from(Buffer.from(b64, 'base64'));
/** The fixture's images, as the composer is given them. */
const imagesFor = (G) => ({ p1: { type: 'image/jpeg', bytes: bytesIn(G, F.b64.photo) } });

/** Every string of a layout model that a reader must find in the PDF. */
function strings(m) {
  const out = [m.title, m.subtitle, m.footer, m.firm.name, m.firm.support.team, m.firm.support.email, m.firm.support.phone].concat(m.cover.on ? m.cover.lines : []);
  const runs = (rs) => rs.forEach((r) => out.push(r.s));
  m.blocks.forEach((b) => {
    if (b.k === 'h1' || b.k === 'h2' || b.k === 'note') out.push(b.text);
    else if (b.k === 'p') runs(b.runs);
    else if (b.k === 'ul') b.items.forEach(runs);
    else if (b.k === 'tiles') b.items.forEach((t) => out.push(t.label, t.value));
    else if (b.k === 'table') {
      out.push(b.title);
      b.cols.forEach((c) => out.push(c.h));
      b.rows.forEach((r) => r.forEach((c) => out.push(c.s)));
      (b.total || []).forEach((c) => out.push(c.s));
    } else if (b.k === 'chart') {
      out.push(b.title);
      b.labels.forEach((s) => out.push(s));
      b.shown.forEach((s) => out.push(s));
      b.ticks.forEach((t) => out.push(t.s));
    } else if (b.k === 'photo') out.push(b.caption);
  });
  return out.map((s) => String(s).trim()).filter(Boolean);
}
const flat = (s) => String(s).replace(/\s+/g, ' ');
/** The strings not found in the text (whitespace collapsed on both sides; a cell like 'Line 1' must not match 'Line 10'). */
function missingIn(text, list) {
  const t = ' ' + flat(text) + ' ';
  return list.filter((s) => {
    const f = flat(s);
    let at = t.indexOf(f);
    while (at >= 0) {
      const after = t[at + f.length];
      if (!/[0-9]/.test(f[f.length - 1]) || !/[0-9]/.test(after)) return false;
      at = t.indexOf(f, at + 1);
    }
    return true;
  });
}

const parts = {
  /** The fixture becomes a portrait US Letter PDF whose every string, page count and page numbers read back. */
  async compose({ check }) {
    const { P, kit, G } = load();
    const dir = T.work('reports-pdf');
    const bytes = await P.compose(clone(F.model), { kit, images: imagesFor(G) });
    check('compose returns bytes starting %PDF-', bytes instanceof G.Uint8Array && Buffer.from(bytes.subarray(0, 5)).toString() === '%PDF-');
    const file = T.save(dir, fileName('compose'), bytes);
    const info = T.info(file);
    const N = +info.Pages;
    check('the pages are portrait US Letter (612 x 792 pts)', /^612 x 792 pts/.test(info['Page size'] || ''), info['Page size']);
    check('.pages equals pdfinfo Pages', bytes.pages === N && N >= 3, { pages: bytes.pages, N });
    const text = T.text(file);
    const pages = text.split('\f').slice(0, -1);
    check('pdftotext reads N pages', pages.length === N, pages.length);
    const lost = missingIn(text, strings(F.model));
    check(`every string of the model is in the text (${strings(F.model).length} strings)`, lost.length === 0, lost.slice(0, 20));
    const numbered = pages.map((p, k) => p.indexOf(`Page ${k + 1} of ${N}`) >= 0);
    check("each page carries 'Page n of N'", numbered.every(Boolean), numbered);
    check('the recipient and the firm print with their accents and Polish letters', text.indexOf('Łukasz Żółć') >= 0 && text.indexOf('Société Àrbre Capital') >= 0);
  }
};

module.exports = { strings, missingIn, imagesFor, load };

if (require.main === module) {
  require(path.join(T.P6, 'lib.js')).runParts(parts, { name: 'REPORTS PDF', unit: 'cases', flag: '--case' });
}
