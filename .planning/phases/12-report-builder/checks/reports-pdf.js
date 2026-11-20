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

/** Every word pdftotext -bbox finds: { page, text, xMin, xMax, yMin, yMax } (points from the page's top left). */
function wordsOf(file) {
  const { spawnSync } = require('child_process');
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
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
/** A pixel within tol of a color on every channel. */
const near = (px, h, tol) => rgbOf(h).every((v, i) => Math.abs(v - px[i]) <= (tol == null ? 8 : tol));
/** Scans the pixels at x from y0 to y1 (points from the top) and returns the first that is near the color, or null. */
function scan(file, page, x, y0, y1, h) {
  for (let yy = Math.ceil(y0); yy <= y1; yy++) {
    const px = T.pixel(file, page, x, yy);
    if (near(px, h)) return { y: yy, px };
  }
  return null;
}
const SHA = (NS, b) => NS.audit.sha256(b);

const parts = {
  /** The fixture becomes a portrait US Letter PDF whose every string, page count and page numbers read back. */
  async compose({ check }) {
    const { P, kit, G } = load();
    const dir = T.work('reports-pdf');
    const t0 = process.hrtime.bigint();
    const bytes = await P.compose(clone(F.model), { kit, images: imagesFor(G) });
    const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
    check(`compose returns bytes starting %PDF- (layout-a in Node took ${ms} ms; measured, printed, no threshold)`, bytes instanceof G.Uint8Array && Buffer.from(bytes.subarray(0, 5)).toString() === '%PDF-');
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
  },

  /** C-12: the file properties name the firm only; no vendor, library, model or platform name anywhere; the firm's colors are drawn. */
  async brand({ check }) {
    const { P, kit, G } = load();
    const dir = T.work('reports-pdf');
    const file = T.save(dir, fileName('brand'), await P.compose(clone(F.model), { kit, images: imagesFor(G) }));
    const info = T.info(file);
    const firm = 'Société Àrbre Capital Management, LLC';
    check("Title is the report's title", info.Title === 'Quarterly report - Quarter ended December 31, 2026', info.Title);
    check("Author is the firm's legal name", info.Author === firm, info.Author);
    check("Producer is the firm's legal name (never the library's own)", info.Producer === firm, info.Producer);
    check("Creator is the firm's legal name", info.Creator === firm, info.Creator);
    check('Subject is the subtitle', info.Subject === 'Quarter ended December 31, 2026', info.Subject);
    check('CreationDate and ModDate are the generation time (2027-01-20 12:00 UTC)', /2027/.test(info.CreationDate || '') && /2027/.test(info.ModDate || ''), [info.CreationDate, info.ModDate]);
    const text = T.text(file);
    const lk = T.leak(JSON.stringify(info) + '\n' + text);
    check('no vendor, library, model or platform name and never the forbidden word in the file properties or the text', lk.ok, lk.hits);
    const names = T.fonts(file);
    check(`pdffonts names (the record for C-02): ${names.join(', ')}`, names.length >= 2 && names.every((n) => /DejaVuSans/.test(n)), names);
    check("the font's internal name is not page text", !/dejavu/i.test(text));
    check('the cover band is drawn in the cover accent (#1F3A5F)', near(T.pixel(file, 1, 500, 250), '#1F3A5F'), T.pixel(file, 1, 500, 250));
  },

  /** The 60-row table splits across pages with its heading row on top of each, right-aligned money and the total last. */
  async tables({ check }) {
    const { P, kit, G } = load();
    const dir = T.work('reports-pdf');
    const file = T.save(dir, fileName('tables'), await P.compose(clone(F.model), { kit, images: imagesFor(G) }));
    const words = wordsOf(file);
    const money = words.filter((w) => /^\$1,000\.\d\d$/.test(w.text));
    check('all 60 money cells are found', money.length === 60, money.length);
    const pages = Array.from(new Set(money.map((w) => w.page))).sort((a, b) => a - b);
    check('the table runs onto at least two pages', pages.length >= 2, pages);
    pages.forEach((p) => {
      const cells = money.filter((w) => w.page === p);
      const top = Math.min(...cells.map((w) => w.yMin));
      const heads = words.filter((w) => w.page === p && (w.text === 'Item' || w.text === 'Amount'));
      check(`page ${p}: the heading row (Item, Amount) is above the table's rows`, heads.length === 2 && heads.every((h) => h.yMax <= top + 0.5), heads);
    });
    const headPages = Array.from(new Set(words.filter((w) => w.text === 'Amount').map((w) => w.page)));
    const alone = headPages.filter((p) => !money.some((w) => w.page === p && w.yMin > words.find((x) => x.page === p && x.text === 'Amount').yMax));
    check('no page ends with the heading row alone', alone.length === 0, alone);
    const total = words.find((w) => w.text === '$60,018.30');
    check('the total row is on the last of the pages, under every row', !!total && total.page === pages[pages.length - 1] && money.filter((w) => w.page === total.page).every((w) => w.yMax <= total.yMin + 0.5), total);
    const edge = Math.max(...money.map((w) => w.xMax));
    const off = money.concat(total ? [total] : [], words.filter((w) => w.text === 'Amount')).filter((w) => Math.abs(w.xMax - edge) > 1);
    check("every money cell's right edge (and the heading's and the total's) is within 1 pt of the column's right edge", off.length === 0, off.slice(0, 5));
  },

  /** Logos (PNG, JPEG, the generated marks as vectors), the photo, and a photo whose bytes are missing. */
  async images({ check }) {
    const { NS, P, kit, G } = load();
    const dir = T.work('reports-pdf');
    const lf = async (logo) => P.logoFor({ name: 'Société Àrbre Capital', shortName: 'Société Àrbre', colors: { primary: '#1F3A5F', accent: '#C8963E' }, logo });
    const png = await lf({ type: 'image', image: 'data:image/png;base64,' + F.b64.logoPng });
    const jpg = await lf({ type: 'image', image: 'data:image/jpeg;base64,' + F.b64.logoJpg });
    const svg = await lf({ type: 'image', image: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#1F3A5F"/></svg>').toString('base64') });
    const mark = await lf({ type: 'wing', letters: 'SA' });
    check('logoFor: a PNG data URL gives its bytes', png.kind === 'png' && png.bytes && png.bytes.length === Buffer.from(F.b64.logoPng, 'base64').length, png.kind);
    check('logoFor: a JPEG data URL gives its bytes', jpg.kind === 'jpeg' && jpg.bytes && jpg.bytes.length === Buffer.from(F.b64.logoJpg, 'base64').length, jpg.kind);
    check("logoFor: an SVG logo with no canvas (Node) gives the firm's short name in its primary color", svg.kind === 'name' && svg.text === 'Société Àrbre' && svg.color === '#1F3A5F', svg);
    const on = NS.brand.onColor('#1F3A5F');
    check("logoFor: a generated mark gives its type, letters and the console's mark colors", mark.kind === 'mark' && mark.type === 'wing' && mark.letters === 'SA' && mark.colors.p === '#1F3A5F' && mark.colors.a === '#C8963E' && mark.colors.ink === on, mark);

    for (const [name, logo, enc] of [['PNG', png, 'image'], ['JPEG', jpg, 'jpeg']]) {
      const b = await P.compose(clone(F.model), { kit, images: imagesFor(G), logo });
      const list = T.images(T.save(dir, fileName('logo-' + name), b));
      const logos = list.filter((r) => r.type === 'image' && r.width === 120 && r.height === 40 && r.enc === enc);
      const onPages = Array.from(new Set(logos.map((r) => r.page))).sort((a, c) => a - c);
      check(`a ${name} logo is embedded on page 1 and in every page's header (${b.pages} pages)`, onPages.length === b.pages && onPages[0] === 1, { onPages, list: list.slice(0, 8) });
    }

    const b = await P.compose(clone(F.model), { kit, images: imagesFor(G) });
    const file = T.save(dir, fileName('mark'), b);
    const list = T.images(file);
    const text = T.text(file);
    const photoPage = text.split('\f').findIndex((p) => p.indexOf('Cedar Row, east elevation') >= 0) + 1;
    check('the photo p1 is one JPEG image on the page of its caption', list.length === 1 && list[0].enc === 'jpeg' && list[0].width === 160 && list[0].height === 100 && list[0].page === photoPage, { list, photoPage });
    check('with the wing mark no image is listed for the logo', list.every((r) => !(r.width === 120 && r.height === 40)), list);
    const L = (b.logos || []).find((x) => x.page === 1);
    check('the composer reports where the cover mark is drawn', !!L && L.kind === 'mark', b.logos);
    if (L) {
      const band = '#1F3A5F';
      const bandOn = NS.brand.onColor(band);
      const bandA = NS.brand.contrast('#C8963E', band) >= 2.2 ? '#C8963E' : NS.brand.mix(bandOn, band, 0.45);
      const at = (px, py) => T.pixel(file, 1, L.x + (px * L.w) / 40, L.top + (py * L.h) / 40);
      const p1 = at(13.4, 24);
      const p2 = at(27.7, 25.8);
      check(`the mark's first shape on the cover is drawn in the band's mark color ${bandOn} (vectors, no image)`, near(p1, bandOn), p1);
      check(`the mark's second shape on the cover is drawn in the band's accent ${bandA}`, near(p2, bandA), p2);
    }
    for (const type of ['monogram', 'wing', 'ridge', 'wave', 'arch']) {
      const m = clone(F.model);
      m.firm.logo = { type, letters: 'SA' };
      let ok = false;
      let info;
      try {
        const bb = await P.compose(m, { kit, images: imagesFor(G) });
        const f = T.save(dir, fileName('mark-' + type), bb);
        const li = T.images(f);
        ok = li.length === 1 && (type !== 'monogram' || T.text(f).indexOf('SA') >= 0);
        info = li;
      } catch (e) {
        info = String(e && e.stack ? e.stack : e).slice(0, 600);
      }
      check(`the ${type} mark composes as vectors (only the photo is an image${type === 'monogram' ? '; its letters are drawn' : ''})`, ok, info);
    }
    const lost = await P.compose(clone(F.model), { kit, images: {} });
    const lt = T.text(T.save(dir, fileName('lost'), lost));
    check('a photo whose bytes are missing is drawn as its caption, .missingImages is 1, no error', lt.indexOf('Cedar Row, east elevation') >= 0 && lost.missingImages === 1, lost.missingImages);
  },

  /** Columns, line and 100% bar charts drawn as vectors in the brand colors, with every label and shown value. */
  async charts({ check }) {
    const { P, kit, G } = load();
    const dir = T.work('reports-pdf');
    const file = T.save(dir, fileName('charts'), await P.compose(clone(F.model), { kit, images: imagesFor(G) }));
    const text = T.text(file);
    const charts = F.model.blocks.filter((b) => b.k === 'chart');
    const want = [].concat(...charts.map((c) => [c.title].concat(c.labels, c.shown, c.ticks.map((t) => t.s))));
    const lost = missingIn(text, want);
    check(`every chart title, label, shown value and tick is in the text (${want.length})`, lost.length === 0, lost);
    const words = wordsOf(file);
    const ACC = '#C8963E';
    const PRI = '#1F3A5F';
    charts[0].shown.forEach((s) => {
      const w = words.find((x) => x.text === s);
      const hit = w && scan(file, w.page, (w.xMin + w.xMax) / 2, w.yMax + 1, w.yMax + 200, ACC);
      check(`the column under ${s} is a filled area in the accent color`, !!hit, w);
    });
    const title = words.find((x) => x.text === 'holding');
    const first = words.find((x) => x.text === '50.0%');
    const M = P.PAGE.M;
    const TW = P.PAGE.W - 2 * M;
    const segX = [M + TW * 0.25, M + TW * 0.65];
    [PRI, ACC].forEach((c, k) => {
      const hit = title && first && scan(file, title.page, segX[k], title.yMax + 1, first.yMin - 1, c);
      check(`segment ${k + 1} of the 100% bar is a filled area in the ${k ? 'accent' : 'primary'} color`, !!hit, { title, first });
    });
    // the line chart's points: a marker in the accent color under each shown value
    charts[1].shown.forEach((s) => {
      // the last word with this text: the top tick label reads the same as the last point's value and is drawn first
      const w = words.filter((x) => x.text === s).pop();
      const hit = w && scan(file, w.page, (w.xMin + w.xMax) / 2, w.yMax + 1, w.yMax + 12, ACC);
      check(`the line chart's point under ${s} is drawn`, !!hit, w);
    });
  },

  /** Accents and Polish letters print; a character the font cannot draw refuses the report plainly and no file is written. */
  async unicode({ check }) {
    const { P, kit, G } = load();
    const dir = T.work('reports-pdf');
    const text = T.text(T.save(dir, fileName('unicode'), await P.compose(clone(F.model), { kit, images: imagesFor(G) })));
    check("'Łukasz Żółć' prints exactly", text.indexOf('Łukasz Żółć') >= 0);
    check("'Société Àrbre Capital' prints exactly", text.indexOf('Société Àrbre Capital') >= 0);
    const refused = T.work('reports-pdf-refused');
    const m = clone(F.model);
    const s = 'Our new office opened in the 漢 district of the city this quarter.';
    m.blocks.splice(2, 0, { k: 'p', runs: [{ s, b: false, i: false }] });
    let err = null;
    try {
      const b = await P.compose(m, { kit, images: imagesFor(G) });
      T.save(refused, 'refused.pdf', b);
    } catch (e) {
      err = e;
    }
    const msg = `This report has a character the PDF font cannot show: "漢" (U+6F22) in "${Array.from(s).slice(0, 40).join('')}". Change the text and try again.`;
    check('compose refuses with the plain message naming "漢" (U+6F22)', !!err && err.message === msg, err ? err.message : 'no error');
    check('no file is written', require('fs').readdirSync(refused).length === 0, require('fs').readdirSync(refused));
    const m2 = clone(F.model);
    m2.blocks[4].rows[3][0].s = 'Line \u{1F680}';
    let e2 = null;
    try {
      await P.compose(m2, { kit, images: imagesFor(G) });
    } catch (e) {
      e2 = e;
    }
    check('a table cell is checked too (U+1F680 is refused)', !!e2 && /"\u{1F680}" \(U\+1F680\) in "Line \u{1F680}"/u.test(e2.message), e2 ? e2.message : 'no error');
  },

  /** The same model and generation time give byte-identical PDFs; another generation time gives other bytes. */
  async repeat({ check }) {
    const { NS, P, kit, G } = load();
    const a = await P.compose(clone(F.model), { kit, images: imagesFor(G) });
    const b = await P.compose(clone(F.model), { kit, images: imagesFor(G) });
    check('two runs of the same model give the same SHA-256', SHA(NS, a) === SHA(NS, b), [SHA(NS, a), SHA(NS, b)]);
    const L2 = load();
    const c = await L2.P.compose(clone(F.model), { kit: L2.kit, images: imagesFor(L2.G) });
    check('a fresh load of the portal gives the same SHA-256 too', SHA(NS, a) === SHA(NS, c), [SHA(NS, a), SHA(NS, c)]);
    const m = clone(F.model);
    m.when = '2027-02-01T12:00:00.000Z';
    const d = await P.compose(m, { kit, images: imagesFor(G) });
    check('a different generation time gives a different SHA-256', SHA(NS, a) !== SHA(NS, d));
  },

  /**
   * RB-14: in the owner's phone frame (390x844, touch, sandboxed, scripts from the page's own address only, connections
   * refused) the composer loads as a script from the same address, redraws an SVG and a WebP logo to PNG on a canvas,
   * composes layout-a with the shipped writer and fonts, and hands the bytes out; with the canvas refusing, the firm's
   * short name stands in.
   */
  async phone({ check }) {
    const Lib = require(path.join(T.P6, 'lib.js'));
    const L10 = require(path.join(T.P10, 'checks/lib10.js'));
    const S = await Lib.start();
    try {
      const { A, fr } = await L10.framed(S, 'phone', { page: 'diy.html', policy: 'self' });
      const size = await fr.evaluate(() => [window.innerWidth, window.innerHeight, navigator.maxTouchPoints > 0]);
      check('the frame is 390x844 with touch', A.page.viewportSize().width === 390 && A.page.viewportSize().height === 844 && size[2] === true, size);
      await L10.proveRefused(check, A, fr);
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect width="40" height="40" fill="#1F3A5F"/><rect x="46" y="14" width="74" height="12" fill="#C8963E"/></svg>').toString('base64');
      const arg = { model: clone(F.model), photo: F.b64.photo, svg: 'data:image/svg+xml;base64,' + svg, webp: 'data:image/webp;base64,' + WEBP };
      const got = await fr.evaluate(async (a) => {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'assets/js/reports-pdf.js';
          s.onload = res;
          s.onerror = () => rej(new Error('reports-pdf.js did not load'));
          document.head.appendChild(s);
        });
        const P = window.CVPortal.reportsPdf;
        const b64 = (u8) => {
          let bin = '';
          for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
          return btoa(bin);
        };
        const u8 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
        const tenant = (image) => ({ name: 'Société Àrbre Capital', shortName: 'Société Àrbre', colors: { primary: '#1F3A5F', accent: '#C8963E' }, logo: { type: 'image', image } });
        const images = { p1: { type: 'image/jpeg', bytes: u8(a.photo) } };
        const svgLogo = await P.logoFor(tenant(a.svg));
        const webpLogo = await P.logoFor(tenant(a.webp));
        const t0 = performance.now();
        const pdf = await P.compose(a.model, { images, logo: svgLogo });
        const ms = Math.round(performance.now() - t0);
        const proto = HTMLCanvasElement.prototype;
        const keep = { toBlob: proto.toBlob, toDataURL: proto.toDataURL };
        proto.toBlob = function () {
          throw new Error('refused');
        };
        proto.toDataURL = function () {
          throw new Error('refused');
        };
        let refused;
        try {
          refused = await P.logoFor(tenant(a.svg));
        } finally {
          proto.toBlob = keep.toBlob;
          proto.toDataURL = keep.toDataURL;
        }
        const pdf2 = await P.compose(a.model, { images, logo: refused });
        return {
          svgKind: svgLogo.kind,
          webpKind: webpLogo.kind,
          refused: { kind: refused.kind, text: refused.text, color: refused.color },
          ms,
          head: String.fromCharCode.apply(null, pdf.subarray(0, 5)),
          b64: b64(pdf),
          b64b: b64(pdf2),
          loaded: performance.getEntriesByType('resource').map((e) => e.name)
        };
      }, arg);
      check('logoFor redraws an SVG logo to PNG on the canvas', got.svgKind === 'png', got.svgKind);
      check('logoFor redraws a WebP logo to PNG on the canvas', got.webpKind === 'png', got.webpKind);
      check(`compose of layout-a in the frame took ${got.ms} ms (measured, printed, no threshold)`, Number.isFinite(got.ms) && got.head === '%PDF-', got.head);
      const shipped = ['assets/js/reports-pdf.js', 'assets/vendor/pdfwrite/write.js', 'assets/vendor/pdfwrite/fonts.js', 'assets/vendor/textfont/text-regular.js', 'assets/vendor/textfont/text-bold.js'];
      check("the composer, the shipped writer, font embedder and both font data files came from the page's own address", shipped.every((f) => got.loaded.some((u) => u === `${S.origin}/${f}`)), got.loaded.filter((u) => /vendor|reports-pdf/.test(u)));
      const dir = T.work('reports-pdf');
      const file = T.save(dir, fileName('phone'), Buffer.from(got.b64, 'base64'));
      const list = T.images(file);
      check('the redrawn logo is an image on page 1', list.some((r) => r.page === 1 && r.type === 'image' && r.enc !== 'jpeg'), list.slice(0, 6));
      const text = T.text(file);
      const lost = missingIn(text, strings(F.model));
      check("every string of the model is in the frame's PDF", lost.length === 0, lost.slice(0, 10));
      check("with the canvas refusing, logoFor gives the firm's short name in its primary color", got.refused.kind === 'name' && got.refused.text === 'Société Àrbre' && got.refused.color === '#1F3A5F', got.refused);
      const file2 = T.save(dir, fileName('phone-name'), Buffer.from(got.b64b, 'base64'));
      const head2 = (T.text(file2).split('\f')[1] || '').split('\n').find((l) => l.trim()) || '';
      check("that PDF's page headers carry the short name (not an image)", /Société Àrbre/.test(head2) && !/Capital/.test(head2) && T.images(file2).every((r) => r.enc === 'jpeg'), head2);
      check("no request outside the page's address", A.p10.outside.length === 0 && got.loaded.every((u) => u.startsWith(S.origin + '/') || u.startsWith('data:') || u.startsWith('blob:')), A.p10.outside.concat(got.loaded.filter((u) => !u.startsWith(S.origin))));
      await L10.quiet(check, A, fr);
      await L10.leak(check, fr);
      await A.context.close();
    } finally {
      await S.stop();
    }
  },

  /** The check itself can fail: an unknown case name and an empty list each exit 1 with a FAIL line. */
  async selfcheck({ check }) {
    const { spawnSync } = require('child_process');
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8', env: process.env });
    const u = run(['--case', 'nonesuch']);
    check('an unknown --case name exits 1 with a FAIL line', u.status === 1 && /^FAIL unknown case name: nonesuch/m.test(u.stdout), { status: u.status, out: u.stdout.slice(-300) });
    const e = run(['--case', '']);
    check('an empty --case list exits 1 with a FAIL line', e.status === 1 && /^FAIL no cases to run/m.test(e.stdout), { status: e.status, out: e.stdout.slice(-300) });
  }
};
// A 120x40 lossless WebP of the test logo (python3 -I with PIL 12.3.0, once).
const WEBP = 'UklGRkYAAABXRUJQVlA4TDkAAAAvd8AJABcgEEjAUtlfYw2BQKKS/pQLBBLVzEd5/uMPFRiJoIaS9EMTdPdyuIj+T4CPQgeRgk+FrgAA';

module.exports = { strings, missingIn, imagesFor, load };

if (require.main === module) {
  require(path.join(T.P6, 'lib.js')).runParts(parts, { name: 'REPORTS PDF', unit: 'cases', flag: '--case' });
}
