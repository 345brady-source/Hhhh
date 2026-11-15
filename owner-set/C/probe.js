// What anchors.js and placement.js read of each page (scratch).  NODE_PATH=$(npm root -g) node probe.js <pdf> <out.json>
const fs = require('fs');
const path = require('path');
const { P, PORT, serve, newContext } = require('./lib.js');
(async () => {
  const pdf = path.resolve(process.argv[2]);
  const out = path.resolve(process.argv[3]);
  const { chromium } = require('playwright');
  const srv = await serve();
  const browser = await chromium.launch();
  try {
    const C = await newContext(browser);
    const S = await P.openPortal(C, srv, false, '');
    await P.prepare(S);
    const b64 = fs.readFileSync(pdf).toString('base64');
    const res = await S.P.evaluate(async (b64) => {
      const NS = window.CVPortal;
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await NS.ops.files.put('probe-doc', new Blob([bytes], { type: 'application/pdf' }));
      await NS.esign.pageLayout('probe-doc', {});
      const lib = window.pdfjsLib;
      if (!lib) return { error: 'no pdfjs on window' };
      const doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
      const pages = [];
      const layout = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        const raw = await NS.anchors.walk(page, vp, lib.OPS);
        const pg = NS.anchors.page(raw, { page: i, w: vp.width, h: vp.height }, []);
        layout.push(pg);
        pages.push({ page: i, segs: raw.segs, rects: raw.rects, rules: pg.rules, boxes: pg.boxes, items: pg.items.map((it) => ({ s: it.s.slice(0, 80), x: it.x, y: it.y, w: it.w, h: it.h })), fonts: Array.from(new Set(raw.glyphs.filter((g) => g.box).map((g) => g.u + ' ' + (g.font || '')))) });
      }
      const t = NS.state.ws.tenant;
      const r = NS.placement.read(layout, { firmNames: [t.name, t.legalName, t.shortName], fundNames: [] });
      return { pages, read: { places: r.places, left: r.left, boxes: r.boxes, blanks: r.blanks, signatures: r.signatures, investorPages: r.investorPages, firmPages: r.firmPages, errors: r.errors }, fields: r.fields };
    }, b64);
    fs.writeFileSync(out, JSON.stringify(res, null, 1));
    console.log(res.error || JSON.stringify(res.read), 'fields', res.fields && res.fields.length, 'errors', JSON.stringify(S.errors));
  } finally { await browser.close(); srv.close(); }
})();
