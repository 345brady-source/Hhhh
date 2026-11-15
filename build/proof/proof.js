#!/usr/bin/env node
/*
 * Final proof run for the e-signature placement fix. Scratch: nothing here is in the repository.
 *
 *   node proof.js [--root <checkout>] [--only 1,2,...] [--opaque] [--out <dir>] [--type-into-strays]
 *
 * Serves the checkout itself (ports 8700-8720, stopped at the end), runs the steps in order with one browser at a
 * time, writes evidence under out/, prints a PASS/FAIL table and exits non-zero on any FAIL.
 *
 * What is driven through the screen only: the upload dialog, the editor (fields are read from its page elements),
 * confirming review marks, saving, the investor's onboarding, the signing step, the firm's countersigning and the
 * signed PDF's download. What is NOT through the screen (workspace preparation, none of it code under change):
 * the sample firm's offering is made ready to raise and the investor is invited through the workspace's own calls
 * (see prepare() and invite()).
 */
const { chromium } = require('playwright');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const SCRATCH = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad';
const HERE = __dirname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', '/home/user/Hhhh'));
const ONLY = arg('--only', '1,2,3,4,5,6,7').split(',').map((s) => s.trim()).filter(Boolean);
const OPAQUE = process.argv.includes('--opaque'); // the frame without allow-same-origin (storage refused)
// diagnostic only: also type into fields off the expected list, to exercise the rest of the path on code that has strays.
// The line "no field the investor is shown lies off the expected pages" still fails, so such a run can never pass.
const TYPE_STRAYS = process.argv.includes('--type-into-strays');
const OUT = path.resolve(arg('--out', path.join(HERE, 'out')));
const EXAMPLE = process.env.EXAMPLE_PDF || path.join(SCRATCH, 'real-agreement/agreement.pdf');
const PUBLIC = process.env.PUBLIC_DIR || path.join(SCRATCH, 'public-agreements');
const WRAPPER = process.env.WRAPPER || path.join(SCRATCH, 'artifact/diy-portal.html');
const VENDOR = process.env.VENDOR_DIR || path.join(SCRATCH, 'vendor');
const ORACLE = process.env.ORACLE || path.join(SCRATCH, 'research-011/oracle.py');
// The pins (Phase 01.3, D-12): what the reader gives today on the first agreement and on the seven public documents.
// A proof run only ever reads them. --record-pins <file> writes what this run measured to another file, for the one
// who records the pins to look at; the pins themselves are never written from here.
const PINS_FILE = path.resolve(arg('--pins', path.join(SCRATCH, 'owner-set/pins.json')));
const RECORD_PINS = arg('--record-pins', '');
const want = (n) => ONLY.includes(String(n));
const mk = (d) => (fs.mkdirSync(d, { recursive: true }), d);
const pad = (n) => String(n).padStart(2, '0');
const say = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ---------- what the example must have after the fix ---------- */
// page -> { signer, checkbox, other }; "who": which kind of investor sees the page's fields (all | entity)
const EXPECT = {
  2: { signer: 'investor', checkbox: 0, other: 1 },
  4: { signer: 'investor', checkbox: 2, other: 0 },
  5: { signer: 'investor', checkbox: 3, other: 3 },
  6: { signer: 'investor', checkbox: 5, other: 0 },
  7: { signer: 'investor', checkbox: 5, other: 1 },
  9: { signer: 'investor', checkbox: 0, other: 5, who: 'entity' },
  11: { signer: 'investor', checkbox: 0, other: 16, individual: 7, entity: 9 },
  12: { signer: 'firm', checkbox: 0, other: 6 }
};
const EXPECT_TOTAL = 47;
// what an investor of each kind is shown: every tick box, their blanks, their block of page 11
const SHOWN = { individual: { 2: 1, 4: 2, 5: 6, 6: 5, 7: 6, 11: 7 }, entity: { 2: 1, 4: 2, 5: 6, 6: 5, 7: 6, 9: 5, 11: 9 } };
const NO_FORM = { PPM_RockStep_Hometown_America_Fund_I: 'prose', PPM_Worcester_Fund_LLC: 'prose', Subscription_PA_SERS_Insight_Venture_Partners_VIII_Closing_Binder_Redacted: 'scan' };

/* ---------- results ---------- */
const rows = [];
function line(step, name, ok, info) {
  rows.push({ step, name, ok: !!ok, info: info == null ? '' : typeof info === 'string' ? info : JSON.stringify(info) });
  say(`${ok ? 'PASS' : 'FAIL'} [${step}] ${name}${info ? ' :: ' + rows[rows.length - 1].info.slice(0, 700) : ''}`);
}

/* ---------- serving the checkout ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net/npm/ https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com data:',
  'img-src data: blob:',
  "connect-src 'none'",
  "worker-src 'self' blob:"
].join('; ');
const SANDBOX = 'allow-scripts allow-forms' + (OPAQUE ? '' : ' allow-same-origin');
/** The published wrapper page, with any script or stylesheet the checkout's diy.html links and the wrapper lacks. */
function wrapperPage() {
  let html = fs.readFileSync(WRAPPER, 'utf8');
  const diy = fs.readFileSync(path.join(ROOT, 'diy.html'), 'utf8');
  const added = [];
  const sync = (re, tag, anchorRe) => {
    const inDiy = Array.from(diy.matchAll(re)).map((m) => m[1]);
    const has = new Set(Array.from(html.matchAll(re)).map((m) => m[1]));
    inDiy.forEach((src, i) => {
      if (has.has(src)) return;
      // before the next file of diy.html that the wrapper has; otherwise after the last one of its kind
      const next = inDiy.slice(i + 1).find((s) => has.has(s));
      const t = tag(src);
      if (next) html = html.replace(new RegExp(anchorRe(next)), (m) => t + '\n' + m);
      else {
        const all = Array.from(html.matchAll(re));
        const last = all[all.length - 1];
        const at = last.index + last[0].length;
        const end = html.indexOf('>', at) + 1 + (tag === scriptTag ? '</script>'.length : 0);
        html = html.slice(0, end) + '\n' + t + html.slice(end);
      }
      has.add(src);
      added.push(src);
    });
  };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  const scriptTag = (s) => `<script src="${s}"></script>`;
  sync(/<script src="(assets\/[^"]+)"/g, scriptTag, (n) => `<script src="${esc(n)}"></script>`);
  sync(/<link rel="stylesheet" href="(assets\/[^"]+)"/g, (s) => `<link rel="stylesheet" href="${s}">`, (n) => `<link rel="stylesheet" href="${esc(n)}">`);
  wrapperPage.added = added;
  return html;
}
const PORTS = { from: 8700, to: 8720 }; // another runner that reuses these helpers may set its own range
function listen(handler) {
  return new Promise((resolve, reject) => {
    let port = PORTS.from;
    const tryNext = () => {
      if (port > PORTS.to) return reject(new Error(`no free port in ${PORTS.from}-${PORTS.to}`));
      const s = http.createServer(handler);
      s.once('error', () => { port++; tryNext(); });
      s.listen(port, () => resolve(s));
    };
    tryNext();
  });
}
async function startServers() {
  const app = await listen((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/diy-portal.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' });
      return res.end(wrapperPage());
    }
    const p = path.join(ROOT, url);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  const appPort = app.address().port;
  const host = await listen((req, res) => {
    const u = new URL(req.url, 'http://x').searchParams.get('u') || '';
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(`<!doctype html><title>host</title><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="http://127.0.0.1:${appPort}/diy-portal.html${u.replace(/"/g, '&quot;')}" style="border:0;display:block;width:100vw;height:100vh"></iframe></body>`);
  });
  return { appPort, hostPort: host.address().port, close: () => { app.close(); host.close(); app.closeAllConnections && app.closeAllConnections(); host.closeAllConnections && host.closeAllConnections(); } };
}

/* ---------- the browser ---------- */
const CDNJS = { 'pdf.js/3.11.174/pdf.min.js': 'pdfjs/package/build/pdf.min.js', 'pdf.js/3.11.174/pdf.worker.min.js': 'pdfjs/package/build/pdf.worker.min.js', 'pdf-lib/1.17.1/pdf-lib.min.js': 'pdflib/package/dist/pdf-lib.min.js' };
const JSD = { '@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js': ['fontkit/package/dist/fontkit.umd.min.js', 'application/javascript'], 'dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf': ['dejavu/package/ttf/DejaVuSans.ttf', 'font/ttf'], 'dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf': ['dejavu/package/ttf/DejaVuSans-Bold.ttf', 'font/ttf'] };
/** One context: the script hosts answered from local copies, the font stylesheet with an empty one, anything else outside aborted and listed. */
async function newContext(browser, srv, opts) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true }, opts || {}));
  const net = { aborted: [], notes: [] };
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (/^http:\/\/(localhost|127\.0\.0\.1):(8[78]\d\d)\//.test(u) || /^(blob|data|about):/.test(u)) return route.continue();
    let m = u.match(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(.+)$/);
    if (m && CDNJS[m[1]]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(VENDOR, CDNJS[m[1]])) });
    m = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(.+)$/);
    if (m && JSD[m[1]] && fs.existsSync(path.join(VENDOR, JSD[m[1]][0]))) return route.fulfill({ status: 200, contentType: JSD[m[1]][1], headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(VENDOR, JSD[m[1]][0])) });
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    net.aborted.push(u.slice(0, 120));
    return route.abort();
  });
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} blocked ${String(e.blockedURI).slice(0, 90)}`));
  });
  return { context, net };
}
/**
 * A tab showing the portal: directly (diy.html), or inside the sandboxed frame of a host page on the other origin.
 * S.P is what the walk drives (the page, or the frame); S.page takes pictures and sizes the window.
 */
async function openPortal(C, srv, preview, rel) {
  const page = await C.context.newPage();
  const S = { page, preview, errors: [], dialogs: [] };
  page.on('pageerror', (e) => S.errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/.test(m.text()) && S.errors.push('console: ' + m.text().slice(0, 300)));
  page.on('dialog', (d) => { S.dialogs.push(d.type() + ': ' + d.message().slice(0, 120)); d.dismiss().catch(() => {}); });
  if (preview) {
    await page.goto(`http://localhost:${srv.hostPort}/?u=${encodeURIComponent(rel || '')}`);
    S.P = await (await page.waitForSelector('#art')).contentFrame();
  } else {
    await page.goto(`http://localhost:${srv.appPort}/diy.html${rel || ''}`);
    S.P = page;
  }
  return S;
}

/* ---------- small tools outside the browser ---------- */
function pageSizes(pdf) {
  const n = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }))[1]);
  const out = execFileSync('pdfinfo', ['-f', '1', '-l', String(n), pdf], { encoding: 'utf8' });
  const sizes = [];
  for (const m of out.matchAll(/Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+) pts/g)) sizes[Number(m[1]) - 1] = { w: Number(m[2]), h: Number(m[3]) };
  for (const m of out.matchAll(/Page\s+(\d+) rot:\s+(\d+)/g)) if (Number(m[2]) % 180 === 90) { const s = sizes[Number(m[1]) - 1]; sizes[Number(m[1]) - 1] = { w: s.h, h: s.w }; }
  return sizes;
}
function words(pdf, page) {
  const out = execFileSync('pdftotext', ['-bbox', '-f', String(page), '-l', String(page), pdf, '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return Array.from(out.matchAll(/<word xMin="([\d.\-]+)" yMin="([\d.\-]+)" xMax="([\d.\-]+)" yMax="([\d.\-]+)">(.*?)<\/word>/g)).map((m) => ({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], s: dec(m[5]) }));
}
/** The independent judge. Returns { summary, per } (per field: anchored, covers, bracketed, overlaps). */
function oracle(pdf, fields, dir, name) {
  mk(dir);
  const fj = path.join(dir, name + '.oracle-in.json');
  fs.writeFileSync(fj, JSON.stringify(fields.map((f) => ({ page: f.page, type: f.kind === 'checkbox' ? 'checkbox' : f.kind, x0: f.x0, x1: f.x1, top: f.top, bottom: f.bottom }))));
  if (!fields.length) return { summary: { fields: 0, clean: 0, notAnchored: [], coversInk: [], bracketed: [], overlapping: [] }, per: [] };
  const tmp = mk(path.join(dir, name + '.oracle'));
  const r = spawnSync('python3', ['-I', ORACLE, pdf, fj, '--out', tmp], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error('oracle failed: ' + (r.stderr || '').slice(-400));
  const summary = JSON.parse(r.stdout.trim().split('\n').pop());
  const per = JSON.parse(fs.readFileSync(path.join(tmp, 'oracle.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, name + '.oracle.json'), JSON.stringify({ summary, per }, null, 1));
  return { summary, per };
}
const unclean = (r) => !r.anchored || r.covers > 0.004 || r.bracketed || (r.overlaps && r.overlaps.length);
/** Which pictures are blank: [{ file, w, h, std, ink }] with blank true when nothing is drawn. */
function blankCheck(files) {
  if (!files.length) return [];
  const py = `
import sys, json
import numpy as np
from PIL import Image
out = []
for f in sys.argv[1:]:
    try:
        a = np.asarray(Image.open(f).convert('L')).astype('float32')
        std = float(a.std()); ink = float((a < 110).mean())
        out.append({'file': f, 'w': int(a.shape[1]), 'h': int(a.shape[0]), 'std': round(std, 2), 'ink': round(ink, 5), 'blank': bool(a.shape[0] < 50 or a.shape[1] < 50 or std < 6 or ink < 0.002)})
    except Exception as e:
        out.append({'file': f, 'blank': True, 'error': str(e)[:80]})
print(json.dumps(out))`;
  const r = spawnSync('python3', ['-I', '-c', py, ...files], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error('blank check failed: ' + (r.stderr || '').slice(-300));
  return JSON.parse(r.stdout);
}

/* ---------- the sponsor's side ---------- */
/** The sample firm with one offering ready to raise (workspace preparation; not the code under change). */
async function prepare(S) {
  const P = S.P;
  await P.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
  await P.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await P.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
  return P.evaluate(async () => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    let o = ws.offerings.find((x) => x.status === 'Raising');
    if (!o) { o = ws.offerings[0]; o.status = 'Raising'; }
    o.structure = Object.assign({}, o.structure, { exemption: 'Rule 506(c)' });
    o.minimum = 50000;
    NS.integrations.ensure(ws).configured = true;
    let stored = 'ok';
    try { await NS.ops.files.put('doc-ppm-test', new Blob(['%PDF-1.4 test memorandum'], { type: 'application/pdf' })); } catch (e) { stored = String(e && e.message).slice(0, 120); }
    ws.docs = ws.docs || [];
    ws.docs.push({ id: 'doc-ppm-test', title: 'Private placement memorandum', fileName: 'PPM.pdf', type: 'application/pdf', size: 24, sha256: '', cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: NS.dates.today(), taxYear: '', publishedAt: new Date().toISOString(), publishedBy: 'test', offeringDoc: true, hidden: false });
    ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== o.id);
    NS.app.save(true);
    return { id: o.id, name: o.name, stored };
  });
}
const toasts = (P) => P.evaluate(() => Array.from(document.querySelectorAll('.toast, [role=alert], [role=status]')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(() => []);
/**
 * Upload through the real dialog. Resolves to { opened, ms, said } where said is every sentence the screen showed
 * on the way (toasts, the dialog's own errors, the editor's note and status).
 */
async function uploadDialog(S, off, pdf, timeout) {
  const P = S.P;
  await P.evaluate((id) => (location.hash = 'console-offering-' + id), off.id);
  await P.waitForSelector(`[data-action="es-agreement-new"][data-offering="${off.id}"]`, { timeout: 20000 });
  await P.click(`[data-action="es-agreement-new"][data-offering="${off.id}"]`);
  await P.waitForSelector('#dlg[open] input[type=file]');
  await P.setInputFiles('#dlg[open] input[type=file]', pdf);
  const t0 = Date.now();
  const said = new Set();
  await P.click('#dlg[open] form button[type=submit]');
  let opened = false;
  const until = Date.now() + (timeout || 180000);
  let dialogSays = '';
  while (Date.now() < until) {
    (await toasts(P)).forEach((t) => said.add(t));
    const st = await P.evaluate(() => {
      const d = document.getElementById('dlg');
      const busy = !!document.querySelector('#dlg[open] button[type=submit][disabled], #dlg[open] [aria-busy=true]');
      const errs = Array.from(document.querySelectorAll('#dlg[open] .field-error, #dlg[open] .cs-error, #dlg[open] [role=alert], #dlg[open] .es-agr-error, #dlg[open] .is-error')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
      return { editor: /^#console-envelope-/.test(location.hash) && !!document.querySelector('.fe-doc .es-page'), dlgOpen: !!(d && d.open), busy, errs, dlgText: d && d.open ? d.innerText.replace(/\s+/g, ' ').trim().slice(0, 600) : '' };
    }).catch(() => ({}));
    if (st.editor) { opened = true; break; }
    if (st.errs && st.errs.length) { st.errs.forEach((e) => said.add(e)); dialogSays = st.dlgText; if (!st.busy) break; }
    await P.waitForTimeout(150);
  }
  const ms = Date.now() - t0;
  if (opened) {
    await P.waitForSelector('.fe-doc .es-page img[src]', { timeout: 60000 }).catch(() => {});
    await P.waitForTimeout(500);
    (await toasts(P)).forEach((t) => said.add(t));
    for (const sel of ['.es-agr-note', '.fe-status', '.es-read-note', '.fe-doc-empty', '.es-agr-read']) for (const t of await P.locator(sel).allInnerTexts().catch(() => [])) if (t.trim()) said.add(t.replace(/\s+/g, ' ').trim());
  }
  return { opened, ms, said: Array.from(said), dialogSays };
}
/**
 * The fields as the editor shows them: one entry per element carrying a field id on a page of the document, with
 * its box in points of the page (from the element's place on the page element), kind, signer, required, review
 * mark and label, all read from the element.
 */
async function readEditor(S, sizes) {
  const raw = await S.P.evaluate(() => {
    const out = [];
    document.querySelectorAll('.fe-doc .es-page[data-page]').forEach((pg) => {
      const pr = pg.getBoundingClientRect();
      const bx = { l: pr.left + pg.clientLeft, t: pr.top + pg.clientTop, w: pg.clientWidth, h: pg.clientHeight };
      pg.querySelectorAll('[data-fid]').forEach((el) => {
        const r = el.getBoundingClientRect();
        const cls = String(el.className || '');
        const aria = el.getAttribute('aria-label') || '';
        const kind = (cls.match(/(?:^|\s)[a-z]+-fld-(signature|initials|name|date|text|checkbox)\b/) || aria.match(/^(Signature|Initials|Name|Date|Text|Checkbox)\b/i) || [])[1] || '';
        const m = aria.match(/^(.*?) for (.*?), page (\d+)(.*)$/);
        const flagged = /\bis-flag\b/.test(cls) || /marked for review|to review|needs review/i.test(aria) || !!el.querySelector('[class*=flag], [class*=review]');
        out.push({ id: el.getAttribute('data-fid'), page: Number(pg.getAttribute('data-page')), fx: (r.left - bx.l) / bx.w, fy: (r.top - bx.t) / bx.h, fw: r.width / bx.w, fh: r.height / bx.h, kind: kind.toLowerCase(), signerName: m ? m[2] : '', label: m ? m[1] : '', required: /\bis-req\b/.test(cls) || /, required/.test(aria), review: flagged, aria: aria.slice(0, 300), cls });
      });
    });
    return { fields: out, pages: document.querySelectorAll('.fe-doc .es-page[data-page]').length, reviewList: Array.from(document.querySelectorAll('[data-action="es-flag-go"]')).map((b) => b.textContent.replace(/\s+/g, ' ').trim()) };
  });
  raw.fields.forEach((f) => {
    const s = sizes[f.page - 1] || { w: 612, h: 792 };
    Object.assign(f, { x0: f.fx * s.w, x1: (f.fx + f.fw) * s.w, top: f.fy * s.h, bottom: (f.fy + f.fh) * s.h });
    f.signer = /investor|subscriber|purchaser|individual|entity|member|partner \(|limited partner/i.test(f.signerName) ? 'investor' : 'firm';
  });
  return raw;
}
/* ---------- the pins (D-12) ---------- */
/** The draft the editor is showing, as the workspace holds it: its fields, its signers and what the reader says it read. */
async function readStored(S) {
  return S.P.evaluate(() => {
    try {
      const NS = window.CVPortal;
      const id = location.hash.replace('#console-envelope-', '');
      const ws = NS.state.ws;
      const e = [].concat(ws.esignTemplates || [], ws.envelopes || [], ws.esign || []).find((x) => x && x.id === id);
      if (!e) return null;
      return { read: e.read ? JSON.parse(JSON.stringify(e.read)) : null, signers: (e.signers || []).map((s) => ({ id: s.id, role: s.role || '', co: !!s.co || s.investorId === '__co_investor__' })), fields: (e.fields || []).map((f) => JSON.parse(JSON.stringify(f))) };
    } catch (err) { return { error: String(err) }; }
  }).catch(() => null);
}
const pinsOnDisk = () => { try { return JSON.parse(fs.readFileSync(PINS_FILE, 'utf8')); } catch (e) { return null; } };
const measuredPins = { example: null, public: {} };
const nums = (a) => (a || []).map(Number).sort((x, y) => x - y);
/** Fields joined with the stored draft, in reading order: page, then top to bottom, then left to right. */
function joined(fields, stored) {
  const byId = {};
  ((stored && stored.fields) || []).forEach((f) => (byId[f.id] = f));
  const co = new Set(((stored && stored.signers) || []).filter((s) => s.co).map((s) => s.id));
  return fields.map((f, i) => { const s = byId[f.id] || {}; return { f, s, i, co: co.has(s.signerId) || !!(s.placed && s.placed.role === 'co') }; })
    .sort((a, b) => a.f.page - b.f.page || Math.round(a.f.top) - Math.round(b.f.top) || a.f.x0 - b.f.x0 || a.i - b.i);
}
/** What is pinned for one public document: totals read from the editor's elements, joined with the stored draft and its read record. */
function pinCounts(fields, stored) {
  const c = { fields: fields.length, prefill: 0, kinds: { checkbox: 0, text: 0, date: 0, signature: 0, initials: 0 }, marked: 0, required: 0, shownRequired: 0, second: 0, other: 0, co: 0, person: 0, entity: 0 };
  joined(fields, stored).forEach(({ f, s, co }) => {
    const k = f.kind === 'name' ? 'text' : f.kind || 'none';
    c.kinds[k] = (c.kinds[k] || 0) + 1;
    if (f.review) c.marked++;
    if (f.required) c.shownRequired++;
    if (s.required) c.required++;
    if (s.prefill) c.prefill++;
    if (s.second) c.second++;
    if (String(s.other || '').trim()) c.other++;
    if (co) c.co++;
    if (s.forType === 'person') c.person++;
    if (s.forType === 'entity') c.entity++;
  });
  const r = (stored && stored.read) || {};
  Object.assign(c, { investorPages: nums(r.investorPages), firmPages: nums(r.firmPages), left: nums(r.left) });
  if (fields.length && !(stored && stored.fields)) c.noDraft = true; // fields on screen and no draft to read them from: never equal to a pin
  return c;
}
/** What is pinned for the first agreement: every field in reading order with what the sponsor sees and what the draft holds. */
function pinExample(fields, stored) {
  const r1 = (v) => Math.round(v * 10) / 10;
  return { fields: fields.length, marked: fields.filter((f) => f.review).length, list: joined(fields, stored).map(({ f, s, co }) => ({ page: f.page, kind: f.kind, signer: co ? 'co-investor' : f.signer, label: f.label, storedLabel: s.label || '', required: !!s.required, shownRequired: !!f.required, second: !!s.second, prefill: s.prefill || '', forType: s.forType || '', box: [f.x0, f.top, f.x1, f.bottom].map(r1) })) };
}
const flat = (c) => { const o = {}; Object.keys(c).forEach((k) => { if (k === 'kinds') Object.keys(c.kinds).forEach((kk) => (o['kinds.' + kk] = c.kinds[kk])); else o[k] = c[k]; }); return o; };
/**
 * One public document against its pin. Every pinned value must be unchanged. A change in a value other than the field
 * total passes only when pins.explained lists it ({ doc, key, now, reason }) with a sentence of reason; the field total
 * fails on any change, and an entry that names it (or the first agreement) is ignored and reported.
 */
function comparePin(doc, got, pins) {
  if (!pins) return { ok: false, info: `NOT RUN: no pins at ${PINS_FILE}` };
  const pin = (pins.public || {})[doc];
  if (!pin) return { ok: false, info: 'NOT RUN: this document has no pin' };
  const a = flat(pin), b = flat(got);
  const explained = Array.isArray(pins.explained) ? pins.explained : [];
  const notes = [], bad = [], excused = [];
  explained.filter((e) => e && e.doc === doc && e.key === 'fields').forEach(() => notes.push('ignored: an explained entry names the field total, which fails on any change'));
  Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).forEach((k) => {
    if (JSON.stringify(a[k]) === JSON.stringify(b[k])) return;
    const e = k === 'fields' ? null : explained.find((x) => x && x.doc === doc && x.key === k && JSON.stringify(x.now) === JSON.stringify(b[k]) && String(x.reason || '').trim().length >= 12);
    (e ? excused : bad).push(`${k}: pinned ${JSON.stringify(a[k])}, now ${JSON.stringify(b[k])}${e ? ` (explained: ${String(e.reason).slice(0, 120)})` : ''}`);
  });
  return { ok: bad.length === 0, excused, info: bad.concat(excused.length && bad.length ? excused : []).concat(notes).join('; ') };
}
/** The first agreement against its pin: nothing pinned for it may change, and no explained entry applies to it. */
function compareExamplePin(got, pins) {
  const none = { ok: false, info: `NOT RUN: no pins for the first agreement at ${PINS_FILE}` };
  if (!pins || !pins.example || !Array.isArray(pins.example.list)) return { marked: none, values: none, boxes: none, notes: [] };
  const pin = pins.example;
  const notes = (Array.isArray(pins.explained) ? pins.explained : []).filter((e) => e && /^(example|first agreement)$/i.test(String(e.doc || ''))).map(() => 'ignored: an explained entry names the first agreement, where nothing pinned may change');
  const vals = [], boxes = [];
  const n = Math.max(pin.list.length, got.list.length);
  for (let i = 0; i < n; i++) {
    const p = pin.list[i], g = got.list[i];
    if (!p || !g) { vals.push(`field ${i + 1}: ${p ? 'gone' : 'new'}`); boxes.push(`field ${i + 1}: ${p ? 'gone' : 'new'}`); continue; }
    ['label', 'storedLabel', 'required', 'shownRequired', 'second', 'prefill'].forEach((k) => { if (p[k] !== g[k]) vals.push(`field ${i + 1} (page ${g.page}) ${k}: pinned ${JSON.stringify(p[k])}, now ${JSON.stringify(g[k])}`); });
    if (p.page !== g.page || p.kind !== g.kind || p.signer !== g.signer || p.forType !== g.forType || p.box.some((v, j) => Math.abs(v - g.box[j]) > 1)) boxes.push(`field ${i + 1}: pinned page ${p.page} ${p.kind} ${p.signer} [${p.box.join(', ')}], now page ${g.page} ${g.kind} ${g.signer} [${g.box.join(', ')}]`);
  }
  return {
    marked: { ok: got.marked === 0 && pin.marked === 0, info: got.marked === 0 ? '' : `${got.marked} marked` },
    values: { ok: vals.length === 0 && got.fields === pin.fields, info: vals.slice(0, 6).concat(vals.length > 6 ? [`and ${vals.length - 6} more`] : []).concat(notes).join('; ') },
    boxes: { ok: boxes.length === 0 && got.fields === pin.fields, info: boxes.slice(0, 4).concat(boxes.length > 4 ? [`and ${boxes.length - 4} more`] : []).join('; ') },
    notes
  };
}

/** By page: counts of tick boxes and other fields per signer, compared with EXPECT. Returns the differences. */
function compareExample(fields) {
  const diffs = [];
  const pages = new Set(fields.map((f) => f.page).concat(Object.keys(EXPECT).map(Number)));
  Array.from(pages).sort((a, b) => a - b).forEach((p) => {
    const e = EXPECT[p] || { signer: '', checkbox: 0, other: 0 };
    const on = fields.filter((f) => f.page === p);
    const cb = on.filter((f) => f.kind === 'checkbox').length;
    const ot = on.length - cb;
    if (cb !== e.checkbox) diffs.push(`page ${p}: ${cb} tick boxes, expected ${e.checkbox}`);
    if (ot !== e.other) diffs.push(`page ${p}: ${ot} blanks and signature fields, expected ${e.other}`);
    const wrongSigner = on.filter((f) => e.signer && f.signer !== e.signer);
    if (wrongSigner.length) diffs.push(`page ${p}: ${wrongSigner.length} fields for the ${wrongSigner[0].signer} ("${wrongSigner[0].signerName}"), expected the ${e.signer}`);
  });
  return diffs;
}
async function shotPages(S, sel, pagesList, file, floor) {
  const made = [];
  for (const i of pagesList) {
    const el = S.P.locator(`${sel}[data-page="${i}"]`);
    if (!(await el.count())) continue;
    // the page's top below any bar that sticks to the top of the window
    await el.evaluate((e, fl) => { e.scrollIntoView({ block: 'start' }); const sc = (n) => { let p = n.parentElement; while (p) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p; p = p.parentElement; } return document.scrollingElement; }; const s = sc(e); s.scrollTop = Math.max(0, s.scrollTop - fl); }, floor || 0);
    await S.P.waitForFunction((a) => { const img = document.querySelector(`${a.sel}[data-page="${a.i}"] img`); return img && img.complete && img.naturalWidth > 0; }, { sel, i }, { timeout: 20000 }).catch(() => {});
    await S.P.waitForTimeout(150);
    const f = file(i);
    await el.screenshot({ path: f }).then(() => made.push(f), (e) => say('  picture failed', path.basename(f), String(e).slice(0, 100)));
  }
  return made;
}
/** Confirm every field on the "To review" list through its own button, then save. */
async function confirmAndSave(S, off) {
  const P = S.P;
  let confirmed = 0;
  for (let guard = 0; guard < 200; guard++) {
    const go = P.locator('[data-action="es-flag-go"]').first();
    if (!(await go.count())) break;
    await go.click();
    const ok = P.locator('[data-action="es-flag-ok"]').first();
    if (!(await ok.count())) { await P.waitForTimeout(150); if (!(await ok.count())) break; }
    await ok.click();
    confirmed++;
    await P.waitForTimeout(60);
  }
  await P.click('[data-action="es-agreement-save"]');
  const saved = await P.waitForFunction((id) => location.hash === '#console-offering-' + id, off.id, { timeout: 8000 }).then(() => true, () => false);
  return { confirmed, saved, said: await toasts(P) };
}
/** Invite an investor as the console form does (workspace call; not the code under change). */
async function invite(S, off, who) {
  return S.P.evaluate(({ o, offId }) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const r = NS.invitations.create(ws, { name: o.name, email: o.email, type: o.type, account: o.account || '', offeringId: offId, cents: 25000000, cls: '', note: '' });
    const it = r.invitation;
    if (!it.token) { const b = new Uint8Array(32); crypto.getRandomValues(b); it.token = btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    it.status = 'sent';
    NS.app.save(true);
    return { token: it.token, tenant: ws.tenant.id };
  }, { o: who, offId: off.id });
}

/* ---------- the investor's side ---------- */
const heading = (P) => P.locator('.ivf-form h1').first().innerText().catch(() => '');
async function sandboxVerify(P, kind, outcome) {
  await P.click(`[data-action=iv-start][data-kind=${kind}] >> nth=0`);
  await P.waitForSelector('#dlg[open] [data-action=iv-sandbox-finish]');
  if (outcome) await P.check(`input[name="iv-outcome"][value="${outcome}"]`);
  await P.click('[data-action=iv-sandbox-finish]');
  await P.waitForFunction((k) => { const c = document.querySelector(`#iv-${k} .iv-chip`); return c && !/Not started|Submitted/.test(c.textContent); }, kind, { timeout: 10000 });
}
/** Onboarding from the welcome step until the agreement is on screen, for a person or an entity. */
async function walkToAgreement(P, o) {
  const seen = [];
  const fillIf = async (sel, v) => { const l = P.locator(sel).first(); if ((await l.count()) && (await l.isVisible()) && (await l.isEditable())) await l.fill(v); };
  const checkIf = async (sel) => { const l = P.locator(sel).first(); if ((await l.count()) && (await l.isVisible())) await l.check(); };
  for (let guard = 0; guard < 24; guard++) {
    await P.waitForSelector('.ivf-form h1', { timeout: 30000 });
    const hd = await heading(P);
    const count = await P.locator('.ivf-progress .ob-count').innerText().catch(() => '');
    const key = `${count} | ${hd}`;
    if (seen.length && seen[seen.length - 1] === key) {
      seen.push('STUCK: ' + (await P.locator('.field-error').allInnerTexts()).join(' / '));
      break;
    }
    seen.push(key);
    if (/^Welcome/.test(hd)) {
      await checkIf('#ob-esignConsent');
      await checkIf('#ob-edelivery');
    } else if (/Create your login/.test(hd)) {
      await P.fill('#ob-password', 'investor-pass-123');
      await P.fill('#ob-password2', 'investor-pass-123');
    } else if (/Investor information/.test(hd)) {
      await fillIf('#ob-street', '12 Elm Street');
      await fillIf('#ob-city', 'Austin');
      await fillIf('#ob-st', 'TX');
      await fillIf('#ob-zip', '78701');
      await fillIf('#ob-phone', '+1 512 555 0101');
      await fillIf('#ob-dob', '1980-04-02');
      await fillIf('#ob-formation', 'Delaware');
      await fillIf('#ob-tin', '123456789');
      await checkIf('input[name="ob-pep"][value="no"]');
      // an entity: one beneficial owner holding all of it (the second owner is optional and left empty)
      await fillIf('#ob-owner1', o.name.split(' ')[0]);
      await fillIf('#ob-owner1Last', o.name.split(' ').slice(1).join(' '));
      await fillIf('#ob-owner1pct', '100');
    } else if (/Identity verification/.test(hd)) {
      await sandboxVerify(P, 'identity', 'passed');
    } else if (/Accredit/.test(hd)) {
      if (await P.locator('[data-action=iv-start][data-kind=accreditation]').count()) await sandboxVerify(P, 'accreditation', 'verified');
      else await P.check('input[name="ob-accBasis"] >> nth=0');
      await checkIf('#ob-accAttest');
    } else if (/Tax certification/.test(hd)) {
      if (await P.locator('input[name="ob-usPerson"]').count()) await P.check('input[name="ob-usPerson"][value="yes"]');
      await checkIf('#ob-w9');
      await fillIf('#ob-taxSig', o.name);
    } else if (/Distribution payments/.test(hd)) {
      if (await P.locator('#ob-routing').count()) {
        await P.fill('#ob-routing', '021000021');
        await P.fill('#ob-account', '123456789');
        await P.fill('#ob-account2', '123456789');
        await checkIf('#ob-achAuth');
      }
    } else if (/^Subscription$/.test(hd)) {
      if (await P.locator('#ob-amount:not([readonly])').count()) await P.fill('#ob-amount', String(o.amount || 250000));
      await checkIf('#ob-subAcc');
      await checkIf('#ob-subDocs');
    } else if (/Subscription agreement/.test(hd)) {
      await P.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 });
      return { seen, reached: true };
    } else {
      seen.push('UNKNOWN STEP');
      break;
    }
    await P.click('.ivf-form .ob-actions button[type=submit]');
    await P.waitForFunction(() => !document.querySelector('.ivf-form button[type=submit][disabled]'), null, { timeout: 20000 });
    await P.waitForTimeout(200);
  }
  return { seen, reached: false };
}
/** What a signer has on the signing screen: every control of theirs on a page, with its box in points. */
async function readSigning(P, sizes) {
  const raw = await P.evaluate(() => {
    const out = [];
    document.querySelectorAll('.es-doc-sign .es-page[data-page]').forEach((pg) => {
      const pr = pg.getBoundingClientRect();
      const bx = { l: pr.left + pg.clientLeft, t: pr.top + pg.clientTop, w: pg.clientWidth, h: pg.clientHeight };
      const add = (el, box, o) => { const r = box.getBoundingClientRect(); out.push(Object.assign({ page: Number(pg.getAttribute('data-page')), fx: (r.left - bx.l) / bx.w, fy: (r.top - bx.t) / bx.h, fw: r.width / bx.w, fh: r.height / bx.h }, o)); };
      pg.querySelectorAll('[data-fid]').forEach((el) => {
        const box = el.tagName === 'INPUT' ? el.closest('label') || el : el;
        const aria = el.getAttribute('aria-label') || (box.querySelector('.sr-only') || {}).textContent || '';
        const kind = el.tagName === 'INPUT' ? (el.type === 'checkbox' ? 'checkbox' : 'text') : /initial/i.test(aria) ? 'initials' : 'signature';
        add(el, box, { id: el.getAttribute('data-fid'), kind, label: aria.replace(/, (required|optional).*$/, '').replace(/\. Select to.*$/, ''), required: /, required/.test(aria) || el.required, locked: !!el.readOnly || (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.disabled), disabled: !!el.disabled, value: el.type === 'checkbox' ? (el.checked ? 'x' : '') : el.tagName === 'INPUT' ? el.value : box.querySelector('img') ? 'signed' : '', invalid: el.getAttribute('aria-invalid') === 'true' });
      });
      // a date the portal fills in itself is drawn without a control
      pg.querySelectorAll('[class*="-auto"]').forEach((el) => { if (!el.querySelector('[data-fid]') && !el.hasAttribute('data-fid')) add(el, el, { id: '', kind: 'date', label: el.getAttribute('title') || 'Date', required: false, locked: true, disabled: false, value: el.textContent.trim(), auto: true }); });
    });
    return out;
  });
  raw.forEach((f) => { const s = sizes[f.page - 1] || { w: 612, h: 792 }; Object.assign(f, { x0: f.fx * s.w, x1: (f.fx + f.fw) * s.w, top: f.fy * s.h, bottom: (f.fy + f.fh) * s.h }); });
  return raw;
}
/**
 * Complete the signing screen as one signer: sign, tick every box and type into every blank that is on a page the
 * expected list gives this signer. A field anywhere else is NOT touched. Returns what was typed and what was left.
 */
async function completeSigning(P, sizes, allowedPages, tag) {
  const mine = await readSigning(P, sizes);
  const typed = [];
  const skipped = [];
  let n = 0;
  for (const f of mine) {
    if (!f.id || f.disabled) continue;
    if (!allowedPages.includes(f.page)) { skipped.push(f); if (!TYPE_STRAYS) continue; }
    const el = P.locator(`.es-doc-sign [data-fid="${f.id}"]`).first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    if (f.kind === 'signature' || f.kind === 'initials') {
      await el.click();
      await P.waitForTimeout(250);
      if (await P.evaluate(() => { const d = document.getElementById('dlg'); return !!(d && d.open); })) {
        await P.click('[data-action="es-adopt"]');
        await P.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 });
      }
    } else if (f.kind === 'checkbox') {
      await el.check({ force: true }).catch(() => el.click({ force: true }));
    } else if (!f.locked && !f.value) {
      n++;
      const v = /date|dated/i.test(f.label) ? `0${(n % 9) + 1}/1${n % 10}/2027` : `${tag}${pad(n)}`;
      await el.fill(v);
      typed.push({ id: f.id, page: f.page, label: f.label, value: v, x0: f.x0, x1: f.x1, top: f.top, bottom: f.bottom });
    }
  }
  await P.waitForTimeout(300);
  const after = await readSigning(P, sizes);
  const open = after.filter((f) => f.id && f.required && !f.value);
  return { mine, after, typed, skipped, open, invalid: after.filter((f) => f.invalid) };
}
/** The finished PDF, through the console's own download button; where the frame forbids a download, from the portal's store. */
async function fetchSigned(S, file) {
  const btn = S.P.locator('[data-action="es-dl-signed"]').first();
  if (!(await btn.count())) return { how: 'no download button on screen' };
  const dl = S.page.waitForEvent('download', { timeout: 12000 }).catch(() => null);
  await btn.click();
  const d = await dl;
  if (d) { await d.saveAs(file); return { how: 'the Signed PDF button' }; }
  const id = await btn.getAttribute('data-id');
  const b64 = await S.P.evaluate(async (eid) => {
    const b = await window.CVPortal.esign.signedBlob(eid);
    const u = new Uint8Array(await b.arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    return btoa(s);
  }, id);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return { how: 'the portal\'s store (the download was not delivered: ' + (await toasts(S.P)).join(' | ') + ')' };
}
/** Read the finished PDF back: every value in its field's box, no "?" in a filled field, no doubled currency sign. */
function readBack(signedPdf, origPdf, values, dir, kind) {
  const problems = [];
  const n = pageSizes(origPdf).length;
  const cache = {};
  const W = (p) => cache[p] || (cache[p] = words(signedPdf, p));
  const ocache = {};
  const OW = (p) => ocache[p] || (ocache[p] = words(origPdf, p));
  values.forEach((v) => {
    const inBox = W(v.page).filter((w) => (w.x0 + w.x1) / 2 >= v.x0 - 2 && (w.x0 + w.x1) / 2 <= v.x1 + 2 && (w.y0 + w.y1) / 2 >= v.top - 2 && (w.y0 + w.y1) / 2 <= v.bottom + 2);
    const text = inBox.map((w) => w.s).join(' ');
    const squash = (s) => s.replace(/\s+/g, '');
    v.printed = text;
    if (!squash(text).includes(squash(v.value))) {
      const where = W(v.page).filter((w) => squash(v.value).includes(squash(w.s)) && w.s.length > 2).map((w) => `(${w.x0.toFixed(0)},${w.y0.toFixed(0)})`);
      problems.push(`page ${v.page} "${v.label}": "${v.value}" is not in its box (${v.x0.toFixed(0)}-${v.x1.toFixed(0)}, ${v.top.toFixed(0)}-${v.bottom.toFixed(0)}); the box holds "${text}"${where.length ? '; similar words at ' + where.slice(0, 3).join(' ') : ''}`);
    } else {
      const ws = inBox.filter((w) => squash(v.value).includes(squash(w.s)));
      const base = Math.max(...ws.map((w) => w.y1));
      // the words stand on the line: their feet no more than 6 pt above the box's bottom edge and not below it
      if (base > v.bottom + 2.5 || base < v.bottom - Math.max(8, (v.bottom - v.top) * 0.6)) problems.push(`page ${v.page} "${v.label}": "${v.value}" is printed ${(v.bottom - base).toFixed(1)} pt above its line`);
      if (Math.min(...ws.map((w) => w.x0)) < v.x0 - 2 || Math.max(...ws.map((w) => w.x1)) > v.x1 + 4) problems.push(`page ${v.page} "${v.label}": "${v.value}" runs outside its blank`);
    }
    // a blank printed after a currency sign, and a value that brings its own
    if (/^\s*[$€£]/.test(v.value)) {
      const sign = OW(v.page).find((w) => /[$€£]/.test(w.s) && w.y1 > v.top - 2 && w.y0 < v.bottom + 2 && w.x0 <= v.x0 + 6 && w.x1 >= v.x0 - 15);
      if (sign) problems.push(`page ${v.page} "${v.label}": a doubled currency sign (the blank is printed after "${sign.s.replace(/_+/g, '_')}" and the value "${v.value}" begins with one)`);
    }
    if (/\?/.test(text) && !/\?/.test(v.value)) problems.push(`page ${v.page} "${v.label}": a "?" is printed in the field ("${text}")`);
  });
  const txt = (pdf) => execFileSync('pdftotext', ['-layout', '-f', '1', '-l', String(n), pdf, '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const a = txt(origPdf);
  const b = txt(signedPdf);
  const cnt = (s, re) => (s.match(re) || []).length;
  if (cnt(b, /\?/g) > cnt(a, /\?/g)) problems.push(`${cnt(b, /\?/g) - cnt(a, /\?/g)} more "?" in the finished pages than in the agreement`);
  if (cnt(b, /[$€£]\s{0,3}[$€£]/g) > cnt(a, /[$€£]\s{0,3}[$€£]/g)) problems.push(`a doubled currency sign: ${(b.match(/.{0,30}[$€£]\s{0,3}[$€£].{0,20}/g) || []).map((s) => s.trim()).join(' | ')}`);
  const pics = [];
  [2, 5, 11, 12].forEach((p) => {
    const base = path.join(dir, `signed-${kind}-p${pad(p)}`);
    spawnSync('pdftoppm', ['-r', '110', '-f', String(p), '-l', String(p), '-png', '-singlefile', signedPdf, base]);
    if (fs.existsSync(base + '.png')) pics.push(base + '.png');
  });
  return { problems, pics, pages: pageSizes(signedPdf).length };
}

/* ---------- one run of the example: upload, editor, investor, firm, finished PDF ---------- */
async function exampleRun(srv, o) {
  // o: { step, dir, kind, preview, doPlacement, doShots, doWalk, placeStep, shotStep, walkStep }
  const dir = mk(o.dir);
  const sizes = pageSizes(EXAMPLE);
  const res = { kind: o.kind, preview: !!o.preview, root: ROOT };
  const browser = await chromium.launch();
  try {
    const C = await newContext(browser, srv);
    const S = await openPortal(C, srv, o.preview);
    const off = await prepare(S);
    res.offering = off.name;
    res.fileStore = off.stored;
    const up = await uploadDialog(S, off, EXAMPLE);
    res.upload = up;
    if (!up.opened) throw new Error('the upload did not reach the editor: ' + up.said.join(' | ') + ' ' + up.dialogSays);
    const ed = await readEditor(S, sizes);
    res.editorPages = ed.pages;
    res.reviewList = ed.reviewList;
    res.fields = ed.fields;
    if (o.doPlacement) {
      const or = oracle(EXAMPLE, ed.fields, dir, 'fields');
      ed.fields.forEach((f, i) => (f.oracle = or.per.find((r) => r.i === i)));
      fs.writeFileSync(path.join(dir, 'fields.json'), JSON.stringify(ed.fields, null, 1));
      const byPage = {};
      ed.fields.forEach((f) => { const k = `p${f.page}`; byPage[k] = byPage[k] || { checkbox: 0, other: 0 }; byPage[k][f.kind === 'checkbox' ? 'checkbox' : 'other']++; });
      res.byPage = byPage;
      const diffs = compareExample(ed.fields);
      res.diffs = diffs;
      const bad = or.per.filter(unclean);
      line(o.placeStep, `example: ${EXPECT_TOTAL} fields placed (found ${ed.fields.length}, ${ed.fields.filter((f) => f.review).length} marked for review, upload ${up.ms} ms)`, ed.fields.length === EXPECT_TOTAL, ed.fields.length === EXPECT_TOTAL ? '' : JSON.stringify(byPage));
      line(o.placeStep, 'example: fields by page, kind and signer are the expected ones', diffs.length === 0, diffs.join('; '));
      line(o.placeStep, `example: every field judged clean by the independent judge (${or.summary.clean} of ${or.summary.fields})`, bad.length === 0, bad.length ? { notAnchored: or.summary.notAnchored, coversInk: or.summary.coversInk, bracketed: or.summary.bracketed, overlapping: or.summary.overlapping } : '');
      line(o.placeStep, 'example: every field read from the editor has a kind, a signer and a box', ed.fields.every((f) => f.kind && f.signerName && f.x1 > f.x0 && f.bottom > f.top), ed.fields.filter((f) => !f.kind || !f.signerName).slice(0, 3).map((f) => f.aria + ' / ' + f.cls));
      // the pins (D-12): none marked, and every field the same label, required, second, filling in, box, kind and signer as pinned
      const gotPin = pinExample(ed.fields, await readStored(S));
      if (!o.preview) measuredPins.example = gotPin;
      const cp = compareExamplePin(gotPin, pinsOnDisk());
      line(o.placeStep, `example, pinned: no field is marked for review (found ${gotPin.marked})`, cp.marked.ok, cp.marked.info);
      line(o.placeStep, `example, pinned: the label, required, second and filling in from onboarding of every field are unchanged (${gotPin.fields} fields; no exception applies)`, cp.values.ok, cp.values.info);
      line(o.placeStep, 'example, pinned: every field is the same box to the nearest point, kind and signer, in the same reading order', cp.boxes.ok, cp.boxes.info);
    }
    if (o.doShots) {
      const all = Array.from({ length: ed.pages }, (_, i) => i + 1);
      const made = await shotPages(S, '.fe-doc .es-page', all, (i) => path.join(dir, `editor-p${pad(i)}.png`), 0);
      res.editorShots = made.length;
      const bl = blankCheck(made);
      fs.writeFileSync(path.join(dir, 'editor-pictures.json'), JSON.stringify(bl, null, 1));
      line(o.shotStep, `editor at 1440: one picture per page (${made.length} of ${sizes.length}), none blank`, made.length === sizes.length && bl.every((b) => !b.blank), bl.filter((b) => b.blank).map((b) => path.basename(b.file)).join(', '));
    }
    if (o.doShots || o.doWalk) {
      const sv = await confirmAndSave(S, off);
      res.save = sv;
      if (!sv.saved) throw new Error('the agreement did not save: ' + sv.said.join(' | '));
      const who = o.kind === 'entity' ? { name: 'Dana Whitlock', email: 'dana@whitlock-example.com', type: 'entity', account: 'Whitlock Holdings LLC' } : { name: 'Morgan Ellery', email: 'morgan@ellery-example.com', type: 'individual', account: '' };
      const inv = await invite(S, off, who);
      const I = await openPortal(C, srv, o.preview, `?tenant=${inv.tenant}#invite-${inv.token}`);
      const w = await walkToAgreement(I.P, { name: who.name, amount: 250000 });
      res.onboarding = w.seen;
      if (!w.reached) throw new Error('the investor did not reach the agreement: ' + w.seen.slice(-2).join(' -> '));
      await I.P.waitForTimeout(600);
      const shown0 = await readSigning(I.P, sizes);
      const withFields = Array.from(new Set(shown0.map((f) => f.page))).sort((a, b) => a - b);
      res.shown = shown0.reduce((a, f) => ((a['p' + f.page] = (a['p' + f.page] || 0) + 1), a), {});
      if (o.doShots) {
        await I.page.setViewportSize({ width: 1440, height: 2200 });
        await I.P.waitForTimeout(500);
        const a = await shotPages(I, '.es-doc-sign .es-page', withFields, (i) => path.join(dir, `sign-1440-p${pad(i)}.png`), 150);
        await I.page.setViewportSize({ width: 390, height: 844 });
        await I.P.waitForTimeout(800);
        const b = await shotPages(I, '.es-doc-sign .es-page', withFields, (i) => path.join(dir, `sign-390-p${pad(i)}.png`), 150);
        await I.page.setViewportSize({ width: 1440, height: 1000 });
        await I.P.waitForTimeout(500);
        const bl = blankCheck(a.concat(b));
        fs.writeFileSync(path.join(dir, 'sign-pictures.json'), JSON.stringify(bl, null, 1));
        line(o.shotStep, `signing step at 1440 and 390: a picture of each page with fields (${a.length} + ${b.length} for pages ${withFields.join(', ')}), none blank`, a.length === withFields.length && b.length === withFields.length && bl.every((x) => !x.blank), bl.filter((x) => x.blank).map((x) => path.basename(x.file)).join(', '));
      }
      if (o.doWalk) {
        const allowed = Object.keys(SHOWN[o.kind]).map(Number);
        const exp = SHOWN[o.kind];
        const shownDiff = Array.from(new Set(withFields.concat(allowed))).sort((x, y) => x - y).filter((p) => (res.shown['p' + p] || 0) !== (exp[p] || 0)).map((p) => `page ${p}: ${res.shown['p' + p] || 0} shown, expected ${exp[p] || 0}`);
        line(o.walkStep, `${o.kind}: the investor is shown exactly their fields (${shown0.length} shown, expected ${Object.values(exp).reduce((x, y) => x + y, 0)})`, shownDiff.length === 0, shownDiff.join('; '));
        // each control on the signing screen is one of the fields the editor showed (the control itself is drawn
        // larger than the field for touch, so the field's exact box is taken from the editor's reading)
        const match = (f) => { const c = [(f.x0 + f.x1) / 2, (f.top + f.bottom) / 2]; const cand = ed.fields.filter((e) => e.page === f.page && (e.kind === 'checkbox') === (f.kind === 'checkbox')).map((e) => ({ e, d: Math.hypot((e.x0 + e.x1) / 2 - c[0], (e.top + e.bottom) / 2 - c[1]) })).sort((x, y) => x.d - y.d)[0]; return cand && cand.d <= 30 ? cand.e : null; };
        const unmatched = shown0.filter((f) => !match(f));
        res.signBoxes = shown0.slice(0, 40).map((f) => { const e = match(f); return { page: f.page, kind: f.kind, screen: [f.x0, f.top, f.x1, f.bottom].map((v) => Math.round(v)), editor: e ? [e.x0, e.top, e.x1, e.bottom].map((v) => Math.round(v)) : null }; });
        line(o.walkStep, `${o.kind}: every control on the signing screen is a field the editor placed (${shown0.length - unmatched.length} of ${shown0.length})`, unmatched.length === 0, unmatched.map((f) => `p${f.page} ${f.kind} "${f.label}"`).join('; '));
        const boxOf = (f) => { const e = match(f) || f; return { page: f.page, label: f.label, value: f.value, x0: e.x0, x1: e.x1, top: e.top, bottom: e.bottom }; };
        const done = await completeSigning(I.P, sizes, allowed, o.kind === 'entity' ? 'En' : 'Iv');
        res.investor = { typed: done.typed, skipped: done.skipped.map((f) => `p${f.page} ${f.kind} "${f.label}"${f.required ? ' (required)' : ''}`), open: done.open.map((f) => `p${f.page} ${f.kind} "${f.label}"`), invalid: done.invalid.map((f) => `p${f.page} "${f.label}"`) };
        const finishBtn = I.P.locator('.es-finish').first();
        const disabled = await finishBtn.isDisabled().catch(() => true);
        res.investor.guide = await I.P.locator('.es-guide, .es-bar, .es-sign-bar').first().innerText().catch(() => '');
        let finished = false;
        if (!disabled) {
          await finishBtn.click();
          finished = await I.P.waitForSelector('.ivf-done', { timeout: 40000 }).then(() => true, () => false);
        }
        res.investor.toasts = await toasts(I.P);
        res.investor.finished = finished;
        res.investor.errors = I.errors.slice(0, 5);
        await I.page.screenshot({ path: path.join(dir, `investor-${o.kind}-end.png`) }).catch(() => {});
        const openOff = done.open.filter((f) => !allowed.includes(f.page));
        line(o.walkStep, `${o.kind}: the investor finishes after signing, ticking every box and filling every blank of theirs (${done.typed.length} typed)`, finished, finished ? '' : `Finish ${disabled ? 'stays disabled' : 'did not complete'}; still required and empty: ${res.investor.open.join('; ') || 'nothing the screen shows'}${openOff.length ? ` (${openOff.length} of them on pages where this investor has no place to fill)` : ''}${res.investor.toasts.length ? '; the screen says: ' + res.investor.toasts.join(' | ') : ''}`);
        line(o.walkStep, `${o.kind}: no field the investor is shown lies off the expected pages`, done.skipped.length === 0, res.investor.skipped.join('; '));
        if (finished) {
          /* the firm countersigns */
          const F = await openPortal(C, srv, o.preview);
          await F.P.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 30000 });
          // the firm's list of documents to sign: the agreement waiting for its countersignature
          const envId = await F.P.evaluate(() => { const e = (window.CVPortal.state.ws.envelopes || []).filter((x) => x.status !== 'completed' && x.status !== 'draft' && !x.agreementFor && (x.signers || []).some((s) => s.role === 'countersigner' && s.status !== 'signed')); return e.length ? e[e.length - 1].id : ''; });
          res.firm = { envelope: !!envId };
          await F.P.evaluate((x) => (location.hash = 'console-envelope-' + x), envId);
          const has = await F.P.waitForSelector('[data-action=es-sign-as]', { timeout: 15000 }).then(() => true, () => false);
          let completed = false;
          if (has) {
            await F.P.click('[data-action=es-sign-as]');
            await F.P.waitForTimeout(300);
            if (await F.P.locator('#es-consent-box').count()) { await F.P.check('#es-consent-box'); await F.P.click('[data-action="es-consent"]'); }
            await F.P.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 });
            await F.P.waitForTimeout(500);
            const fd = await completeSigning(F.P, sizes, [12], 'Fm');
            res.firm.shown = fd.mine.map((f) => `p${f.page} ${f.kind} "${f.label}"${f.required ? '*' : ''} = "${f.value}"`);
            res.firm.typed = fd.typed;
            res.firm.skipped = fd.skipped.map((f) => `p${f.page} ${f.kind} "${f.label}"`);
            res.firm.open = fd.open.map((f) => `p${f.page} ${f.kind} "${f.label}"`);
            await F.page.screenshot({ path: path.join(dir, `firm-${o.kind}-before-finish.png`) }).catch(() => {});
            if (!(await F.P.locator('.es-finish').first().isDisabled().catch(() => true))) {
              await F.P.locator('.es-finish').first().click();
              completed = await F.P.waitForSelector('[data-action="es-dl-signed"]', { timeout: 40000 }).then(() => true, () => false);
            }
            res.firm.toasts = await toasts(F.P);
            const onP12 = fd.mine.filter((f) => f.page === 12).length;
            line(o.walkStep, `${o.kind}: the firm is shown its 6 fields on page 12 (shown ${onP12}, ${fd.mine.length - onP12} elsewhere)`, onP12 === 6 && fd.mine.length === 6, res.firm.shown.join('; '));
            // what the firm's screen showed for each value it carries
            res.firm.values = fd.after.filter((f) => f.kind !== 'checkbox' && f.kind !== 'signature' && f.kind !== 'initials' && f.value).map(boxOf);
          }
          line(o.walkStep, `${o.kind}: the firm countersigns and the agreement completes`, completed, completed ? '' : `sign button ${has ? 'shown' : 'not shown'}; open: ${(res.firm.open || []).join('; ')}; ${(res.firm.toasts || []).join(' | ')}`);
          if (completed) {
            const file = path.join(dir, `signed-${o.kind}.pdf`);
            res.signedHow = (await fetchSigned(F, file)).how;
            if (fs.existsSync(file)) {
              const values = done.after.filter((f) => f.kind !== 'checkbox' && f.kind !== 'signature' && f.kind !== 'initials' && f.value).map(boxOf).concat(res.firm.values || []);
              const rb = readBack(file, EXAMPLE, values, dir, o.kind);
              res.readBack = { values: values.length, problems: rb.problems, pictures: rb.pics.map((p) => path.basename(p)), pages: rb.pages, how: res.signedHow };
              line(o.walkStep, `${o.kind}: the finished PDF (${rb.pages} pages, from ${res.signedHow}) has every value on its own line, no "?" and no doubled currency sign (${values.length} values read back)`, rb.problems.length === 0, rb.problems.join('; '));
              const bl = blankCheck(rb.pics);
              line(o.walkStep, `${o.kind}: pictures of pages 2, 5, 11, 12 of the finished PDF`, rb.pics.length === 4 && bl.every((b) => !b.blank), rb.pics.map((p) => path.basename(p)).join(', '));
            } else line(o.walkStep, `${o.kind}: the finished PDF could be saved`, false, res.signedHow);
          }
          res.firmErrors = F.errors.slice(0, 5);
        }
      }
    }
    res.csp = await S.P.evaluate(() => Array.from(new Set(window.__csp || []))).catch(() => []);
    res.sponsorErrors = S.errors.slice(0, 5);
    res.aborted = Array.from(new Set(C.net.aborted)).slice(0, 10);
    if (o.preview) {
      res.frame = await S.P.evaluate(() => ({ origin: location.origin, top: (() => { try { return String(window.top.location.href); } catch (e) { return 'unreachable (another origin)'; } })(), scripts: document.scripts.length, sheets: document.styleSheets.length, styled: getComputedStyle(document.body).fontFamily.slice(0, 40) })).catch((e) => ({ error: String(e).slice(0, 100) }));
      res.wrapperAdded = wrapperPage.added;
      res.sandbox = SANDBOX;
      res.policy = CSP;
    }
  } catch (e) {
    res.error = String(e && e.stack ? e.stack : e).slice(0, 900);
    line(o.step, `${o.kind}${o.preview ? ' (preview)' : ''}: the run reached its end`, false, String(e && e.message ? e.message : e).slice(0, 500));
  } finally {
    fs.writeFileSync(path.join(dir, `run-${o.kind}.json`), JSON.stringify(res, null, 1));
    await browser.close();
  }
  return res;
}

/* ---------- step 5: the public agreements ---------- */
async function publicRun(srv) {
  const dir = mk(path.join(OUT, 'step5'));
  const docs = fs.readdirSync(PUBLIC).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(PUBLIC, d, 'doc.pdf'))).sort();
  const summary = [];
  const browser = await chromium.launch();
  try {
    for (const d of docs) {
      const pdf = path.join(PUBLIC, d, 'doc.pdf');
      const r = { doc: d, noForm: NO_FORM[d] || '' };
      const C = await newContext(browser, srv);
      try {
        const sizes = pageSizes(pdf);
        r.pages = sizes.length;
        const S = await openPortal(C, srv, false);
        const off = await prepare(S);
        const up = await uploadDialog(S, off, pdf, 240000);
        r.ms = up.ms;
        r.said = up.said;
        r.opened = up.opened;
        r.dialogSays = up.dialogSays;
        let fields = [];
        if (up.opened) {
          const ed = await readEditor(S, sizes);
          fields = ed.fields;
          r.stored = await readStored(S);
          r.reviewList = ed.reviewList.length;
          // everything the editor says about what it read (for the documents with no form)
          r.screen = await S.P.evaluate(() => { const e = document.querySelector('.es-editor, .fe') || document.body; return Array.from(e.querySelectorAll('p, .cs-hint, [role=status], [role=alert], .toast')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /read|scan|no (place|field|blank|signature)|found/i.test(t)).slice(0, 8); });
          await S.page.screenshot({ path: path.join(dir, d.slice(0, 40) + '.png') }).catch(() => {});
        }
        r.fields = fields.length;
        const or = oracle(pdf, fields, dir, d.slice(0, 40));
        fs.writeFileSync(path.join(dir, d.slice(0, 40) + '.fields.json'), JSON.stringify(fields));
        r.clean = or.summary.clean;
        r.unclean = or.per.filter(unclean).length;
        r.why = { notAnchored: or.summary.notAnchored.length, coversInk: or.summary.coversInk.length, bracketed: or.summary.bracketed.length, overlapping: or.summary.overlapping.length };
        r.errors = S.errors.slice(0, 3);
        r.pin = pinCounts(fields, r.stored);
        delete r.stored;
      } catch (e) {
        r.error = String(e && e.message ? e.message : e).slice(0, 300);
      }
      await C.context.close();
      summary.push(r);
      if (r.pin) measuredPins.public[d] = r.pin;
      const words5 = (r.said || []).concat(r.screen || []).concat(r.dialogSays ? [r.dialogSays] : []);
      if (r.error) line(5, `${d}: the upload ran`, false, r.error);
      else if (r.noForm) {
        line(5, `${d} (${r.noForm}, ${r.pages} pages): no field placed`, r.fields === 0, `${r.fields} fields placed (${r.unclean} of them not on a printed place, over ink, in brackets or overlapping)`.replace(/^0 fields.*$/, ''));
        if (r.noForm === 'scan') {
          const plain = words5.filter((t) => /(could not|cannot|can.t|unable to|not able to)[^.]{0,60}\bread|scan/i.test(t));
          r.couldNotRead = plain;
          line(5, `${d}: the screen says plainly that it could not be read`, plain.length > 0, plain.length ? 'words shown: ' + plain.join(' | ') : 'words shown: ' + (words5.join(' | ') || 'none'));
        }
      } else line(5, `${d} (${r.pages} pages): ${r.fields} fields, every one clean`, r.opened && r.unclean === 0 && r.fields > 0, r.unclean ? `${r.unclean} of ${r.fields} unclean: ${JSON.stringify(r.why)}` : r.fields ? '' : 'no field placed: ' + words5.join(' | '));
      // the pin (D-12): the judge alone passes wrong fields on empty table cells, so every count is held as well
      if (r.pin) {
        const cp = comparePin(d, r.pin, pinsOnDisk());
        line(5, `${d}, pinned: ${r.pin.fields} fields and every pinned count unchanged${cp.excused && cp.excused.length ? ` (${cp.excused.length} explained: ${cp.excused.join('; ').slice(0, 300)})` : ''}`, cp.ok, cp.info);
      } else line(5, `${d}, pinned: the counts could be measured`, false, r.error || 'no measurement');
    }
  } finally {
    fs.writeFileSync(path.join(dir, 'public.json'), JSON.stringify(summary, null, 1));
    await browser.close();
  }
}

/* ---------- step 7: the earlier checks ---------- */
function earlierChecks(srv) {
  const dir = mk(path.join(OUT, 'step7'));
  const P = path.join(ROOT, '.planning/phases');
  const env = (extra) => Object.assign({}, process.env, { VENDOR_DIR: VENDOR, PLACE_VENDOR: VENDOR, NODE_PATH: process.env.NODE_PATH || execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim() }, extra);
  const list = [
    ['accuracy', '01-accurate-field-placement/checks/accuracy.js', { QUIET: '1' }],
    ['labels', '01-accurate-field-placement/checks/labels.js', {}],
    ['review', '01-accurate-field-placement/checks/review.js', {}],
    ['prefill', '01-accurate-field-placement/checks/prefill.js', {}],
    ['walk', '01-accurate-field-placement/checks/walk.js', {}],
    ['editor', '02-field-editor/checks/editor.js', { SIGN_PORT: String(srv.appPort), FE_OUT: path.join(dir, 'fe'), SIGN_OUT: path.join(dir, 'sign-fe') }],
    ['signatures', '03-signatures/checks/signatures.js', { SIGN_PORT: String(srv.appPort), SIGN_OUT: path.join(dir, 'sig') }],
    ['signing-step', '04-signing-inside-onboarding/checks/signing-step.js', { SIGN_PORT: String(srv.appPort), SIGN_OUT: path.join(dir, 'sign') }],
    ['record-check', '05-signed-record/checks/record-check.js', { PORT: String(srv.appPort), OUT_DIR: path.join(dir, 'rec') }]
  ];
  return list.reduce((chain, [name, file, extra]) => chain.then(() => new Promise((resolve) => {
    const f = path.join(P, file);
    if (!fs.existsSync(f)) { line(7, `${name}: the check file exists`, false, file); return resolve(); }
    const t0 = Date.now();
    const { spawn } = require('child_process');
    const ch = spawn('node', [f], { cwd: ROOT, env: env(extra) });
    let out = '';
    ch.stdout.on('data', (b) => (out += b));
    ch.stderr.on('data', (b) => (out += b));
    const kill = setTimeout(() => ch.kill('SIGKILL'), 420000);
    ch.on('close', (code) => {
      clearTimeout(kill);
      fs.writeFileSync(path.join(dir, name + '.log'), out);
      const pass = (out.match(/^PASS\b/gm) || []).length;
      const fail = (out.match(/^FAIL\b/gm) || []).length;
      const tally = (out.match(/(\d+)\s*\/\s*(\d+) passed/g) || []).pop() || (out.match(/\bPASSED\b|\bFAILED\b/g) || []).pop() || '';
      const failing = (out.match(/^FAIL .*$/gm) || []).slice(0, 3).map((s) => s.slice(0, 160));
      line(7, `${name}: ${tally || `${pass} passed, ${fail} failed`} (exit ${code}, ${Math.round((Date.now() - t0) / 1000)} s)`, code === 0 && fail === 0, failing.join(' || '));
      resolve();
    });
  })), Promise.resolve());
}

/* ---------- main ---------- */
const main = async () => {
  const t0 = Date.now();
  mk(OUT);
  if (!fs.existsSync(path.join(ROOT, 'diy.html'))) { console.error('not a checkout of the portal: ' + ROOT); process.exit(2); }
  const srv = await startServers();
  say(`serving ${ROOT} on http://localhost:${srv.appPort} (frame host on :${srv.hostPort}); evidence in ${OUT}`);
  const times = {};
  const timed = async (k, fn) => { const t = Date.now(); try { await fn(); } catch (e) { line(k, 'the step ran', false, String(e && e.stack ? e.stack : e).slice(0, 500)); } times[k] = Math.round((Date.now() - t) / 1000); };
  try {
    if (want(1) || want(2) || want(3)) await timed('1-3', () => exampleRun(srv, { step: want(1) ? 1 : want(2) ? 2 : 3, dir: path.join(OUT, 'example'), kind: 'individual', preview: false, doPlacement: want(1), doShots: want(2), doWalk: want(3), placeStep: 1, shotStep: 2, walkStep: 3 }));
    if (want(4)) await timed('4', () => exampleRun(srv, { step: 4, dir: path.join(OUT, 'example-entity'), kind: 'entity', preview: false, doPlacement: false, doShots: false, doWalk: true, walkStep: 4 }));
    if (want(5)) await timed('5', () => publicRun(srv));
    if (want(6)) await timed('6', async () => {
      const r = await exampleRun(srv, { step: 6, dir: path.join(OUT, 'preview'), kind: 'individual', preview: true, doPlacement: true, doShots: false, doWalk: true, placeStep: 6, walkStep: 6 });
      line(6, `preview: the portal ran inside the sandboxed frame on its own origin (${(r.frame && r.frame.origin) || '?'}; sandbox "${SANDBOX}")`, !!(r.frame && r.frame.top && /unreachable/.test(r.frame.top) && r.frame.sheets > 0), r.frame);
      line(6, 'preview: nothing the portal needs was refused by the policy', (r.csp || []).length === 0, (r.csp || []).join(' | '));
      // the same result as outside the frame, when that run is on disk
      const outside = path.join(OUT, 'example', 'fields.json');
      if (fs.existsSync(outside) && r.fields) {
        const sig = (fs_) => fs_.map((f) => `${f.page}|${f.kind}|${f.signer}|${Math.round(f.x0)}|${Math.round(f.top)}|${Math.round(f.x1)}|${Math.round(f.bottom)}`).sort().join('\n');
        const a = sig(JSON.parse(fs.readFileSync(outside, 'utf8')));
        const b = sig(r.fields);
        line(6, 'preview: the same fields in the same places as outside the frame', a === b, a === b ? '' : `${a.split('\n').filter((x) => !b.split('\n').includes(x)).length} fields differ`);
      } else line(6, 'preview: the same fields as outside the frame', false, 'no run outside the frame to compare with (run step 1 first)');
    });
    if (want(7)) await timed('7', () => earlierChecks(srv));
  } finally {
    srv.close();
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  const w = Math.min(150, Math.max(...rows.map((r) => r.name.length), 10));
  const table = ['', `PROOF RUN  root ${ROOT}  steps ${ONLY.join(',')}  ${secs} s  (${Object.entries(times).map(([k, v]) => `step ${k}: ${v} s`).join(', ')})`, '-'.repeat(w + 14)]
    .concat(rows.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  [${r.step}]  ${r.name}${!r.ok && r.info ? '\n          -> ' + r.info.slice(0, 900) : ''}`))
    .concat(['-'.repeat(w + 14), `${rows.filter((r) => r.ok).length} passed, ${rows.filter((r) => !r.ok).length} failed`]);
  console.log(table.join('\n'));
  fs.writeFileSync(path.join(OUT, `table-${ONLY.join('')}.txt`), table.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, `results-${ONLY.join('')}.json`), JSON.stringify({ root: ROOT, only: ONLY, secs, times, rows }, null, 1));
  if (RECORD_PINS) {
    // what this run measured, merged into the named file (never the pins themselves)
    const file = path.resolve(RECORD_PINS);
    if (file === PINS_FILE) console.log('--record-pins refuses to write over the pins; give another file');
    else {
      let rec = {};
      try { rec = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { rec = {}; }
      if (measuredPins.example) rec.example = measuredPins.example;
      rec.public = Object.assign({}, rec.public || {}, measuredPins.public);
      rec.explained = rec.explained || [];
      fs.writeFileSync(file, JSON.stringify(rec, null, 1) + '\n');
      console.log(`measured values written to ${file}`);
    }
  }
  process.exit(rows.some((r) => !r.ok) ? 1 : 0);
};
// run as a program: the proof. Required by another runner (score-notext.js): only the helpers, nothing runs.
if (require.main === module) main();
else module.exports = { SCRATCH, ROOT, EXAMPLE, EXPECT, EXPECT_TOTAL, PORTS, mk, pad, say, startServers, newContext, openPortal, pageSizes, prepare, toasts, uploadDialog, readEditor, compareExample, shotPages, blankCheck, readStored, pinCounts, pinExample, comparePin, compareExamplePin, PINS_FILE };
