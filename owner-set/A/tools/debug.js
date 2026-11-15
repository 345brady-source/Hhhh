// Scratch: uploads the document against a patched copy of the checkout and prints window.__dbg for one page.
const fs = require('fs'); const path = require('path'); const http = require('http');
const HERE = path.join(__dirname, '..');
const P = require(path.join(HERE, '..', '..', 'build', 'proof', 'proof.js'));
const PORT = 8931; const PDF = path.join(HERE, '..', 'reszi.pdf'); const pageNo = process.argv[process.argv.indexOf('--page') + 1] || '20';
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
(async () => {
  const server = http.createServer((req, res) => { const p = path.join(P.ROOT, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(p).pipe(res); });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const browser = await require('playwright').chromium.launch();
  try {
    const srv = { appPort: PORT };
    const C = await P.newContext(browser, srv);
    await C.context.route(new RegExp(`^http://(localhost|127\\.0\\.0\\.1):${PORT}/`), (r) => r.continue());
    const S = await P.openPortal(C, srv, false);
    const off = await P.prepare(S);
    await P.uploadDialog(S, off, PDF, 120000);
    const d = await S.P.evaluate((n) => (window.__dbg || {})[n] || null, Number(pageNo));
    fs.writeFileSync(path.join(HERE, 'dbg-p' + pageNo + '.json'), JSON.stringify(d, null, 1));
    console.log(JSON.stringify(d && { rightEdge: d.rightEdge, leftEdge: d.leftEdge, bodyH: d.bodyH }));
    (d ? d.slots : []).forEach((s) => console.log('slot', JSON.stringify(s)));
    (d ? d.segs : []).forEach((s) => console.log('seg', JSON.stringify(s)));
  } finally { await browser.close(); server.close(); server.closeAllConnections && server.closeAllConnections(); }
})();
