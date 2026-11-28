// Writes and reads back a PDF with the build copies of the shipped PDF libraries (their control bytes escaped by build.py).
// Usage: NODE_PATH=$(npm root -g) node .planning/tools/preview/escape-check.js <build-dir>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.pdf': 'application/pdf', '.ttf': 'font/ttf', '.txt': 'text/plain', '.md': 'text/plain' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.listen(0, async () => {
  const port = srv.address().port; const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); let miss = 0; pg.on('response', (r) => { if (r.status() === 404) miss++; });
  await pg.goto(`http://127.0.0.1:${port}/diy-portal.html`); await pg.waitForTimeout(2500);
  const out = await pg.evaluate(async () => {
    const NS = window.CVPortal;
    const K = NS && NS.esignKit; if (!K) return { error: 'no esignKit' };
    const W = await K.writer(); const F = await K.unicodeFont();
    const doc = await W.PDFDocument.create(); doc.registerFontkit(F.fontkit);
    const font = await doc.embedFont(F.fontBytes, { subset: true, features: { liga: false } }); const p = doc.addPage([300, 200]);
    const text = 'Escape check Ünïcödé €1,234.56 — ✓'; p.drawText(text, { x: 10, y: 100, size: 12, font });
    const bytes = await doc.save();
    const R = await K.reader(); const pdf = await R.getDocument({ data: bytes }).promise; const pg1 = await pdf.getPage(1); const tc = await pg1.getTextContent();
    return { pages: pdf.numPages, text: tc.items.map((i) => i.str).join(''), want: text, size: bytes.length };
  }).catch((e) => ({ error: String(e) }));
  console.log(JSON.stringify({ out, errs, miss })); await b.close(); srv.close();
});
