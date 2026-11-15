const fs = require('fs');
const path = require('path');
const http = require('http');
const HERE = __dirname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const P = require(path.join(HERE, '../../build/proof/proof.js'));
const ROOT = path.resolve(arg('--root', '/home/user/Hhhh'));
const PORT = Number(arg('--port', 8951));
const VENDOR = path.join(P.SCRATCH, 'vendor');
/* ---------- serving, browser (own copies: the shared helper only lets ports 87xx and 88xx through) ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.gz': 'application/gzip' };
function serve() {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const p = path.join(ROOT, url);
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    s.once('error', reject);
    s.listen(PORT, '127.0.0.1', () => resolve({ appPort: PORT, close: () => { s.close(); s.closeAllConnections && s.closeAllConnections(); } }));
  });
}
const CDNJS = { 'pdf.js/3.11.174/pdf.min.js': 'pdfjs/package/build/pdf.min.js', 'pdf.js/3.11.174/pdf.worker.min.js': 'pdfjs/package/build/pdf.worker.min.js', 'pdf-lib/1.17.1/pdf-lib.min.js': 'pdflib/package/dist/pdf-lib.min.js' };
const JSD = { '@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js': ['fontkit/package/dist/fontkit.umd.min.js', 'application/javascript'], 'dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf': ['dejavu/package/ttf/DejaVuSans.ttf', 'font/ttf'], 'dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf': ['dejavu/package/ttf/DejaVuSans-Bold.ttf', 'font/ttf'] };
async function newContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  const net = { aborted: [] };
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(`http://localhost:${PORT}/`) || u.startsWith(`http://127.0.0.1:${PORT}/`) || /^(blob|data|about):/.test(u)) return route.continue();
    let m = u.match(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(.+)$/);
    if (m && CDNJS[m[1]]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(VENDOR, CDNJS[m[1]])) });
    m = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(.+)$/);
    if (m && JSD[m[1]] && fs.existsSync(path.join(VENDOR, JSD[m[1]][0]))) return route.fulfill({ status: 200, contentType: JSD[m[1]][1], headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(VENDOR, JSD[m[1]][0])) });
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    net.aborted.push(u.slice(0, 120));
    return route.abort();
  });
  return { context, net };
}

module.exports = { P, ROOT, PORT, serve, newContext };
