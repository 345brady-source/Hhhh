/*
 * Shared helpers for the Phase 1 placement checks (built from the working parts of baseline-probe.js, which stays
 * as the record of the starting point).
 *
 *  - The script CDN the app loads its PDF libraries from is not reachable from the build sandbox, but the package
 *    registry is. vendor() fetches the same two libraries at the same versions the app uses, refuses an archive
 *    whose content differs from its pin, and the check browser serves them in place of the CDN addresses.
 *    Nothing is added to the app or the repository.
 *  - A fixture is HTML printed to PDF by the browser. Each blank carries data-x with what belongs there, and its
 *    printed position is read from the page before printing (CSS px * 0.75 = PDF points, top-left origin), so the
 *    expected positions never come from the code under test.
 *  - upload() runs a file through NS.esign.agreementDraft exactly as the upload form does.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const VENDOR = process.env.PLACE_VENDOR || path.join(os.tmpdir(), 'place-vendor');
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
const WRITER = 'pdf-lib/1.17.1/pdf-lib.min.js';
const LOCAL = {
  'pdf.js/3.11.174/pdf.min.js': path.join(VENDOR, 'pdfjs/package/build/pdf.min.js'),
  'pdf.js/3.11.174/pdf.worker.min.js': path.join(VENDOR, 'pdfjs/package/build/pdf.worker.min.js'),
  [WRITER]: path.join(VENDOR, 'pdflib/package/dist/pdf-lib.min.js')
};
// The two archives, pinned by content: the hashes the package registry published for these versions (read when the phase was planned).
const PINS = [
  ['pdfjs-dist-3.11.174.tgz', 'pdfjs', 'sha512-TdTZPf1trZ8/UFu5Cx/GXB7GZM30LT+wWUNfsi6Bq8ePLnb+woNKtDymI2mxZYBpMbonNFqKmiz684DIfnd8dA=='],
  ['pdf-lib-1.17.1.tgz', 'pdflib', 'sha512-V/mpyJAoTsN4cnP31vc0wfNA1+p20evqqnap0KLoRUN0Yk/p3wN52DOEsL4oBFcLdb76hlpKPtzJIgo67j/XLw==']
];
/**
 * The PDF libraries the app loads from its CDN, at the same versions, unpacked once into a folder outside the repository.
 * "npm pack" only downloads an archive (no package script runs); an archive whose content differs from its pin is refused.
 */
function vendor() {
  if (Object.values(LOCAL).every((f) => fs.existsSync(f))) return;
  fs.mkdirSync(VENDOR, { recursive: true });
  execFileSync('npm', ['pack', 'pdfjs-dist@3.11.174', 'pdf-lib@1.17.1', '--pack-destination', VENDOR], { stdio: 'ignore' });
  PINS.forEach(([tgz, dir, pin]) => {
    const got = 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(path.join(VENDOR, tgz))).digest('base64');
    if (got !== pin) throw new Error(`${tgz} is not the pinned archive (got ${got})`);
    fs.mkdirSync(path.join(VENDOR, dir), { recursive: true });
    execFileSync('tar', ['-xzf', path.join(VENDOR, tgz), '-C', path.join(VENDOR, dir)]);
  });
}
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
/** The repository served on a free local port. */
function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

/**
 * The check browser: the repository on a local port, the three library addresses answered from the fetched copies,
 * the font stylesheet addresses answered with an empty stylesheet, every other outside request aborted.
 */
async function start() {
  vendor();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    if (u.startsWith(CDN) && LOCAL[u.slice(CDN.length)]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(LOCAL[u.slice(CDN.length)]) });
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  const errors = [];
  const stop = async () => {
    await browser.close();
    server.close();
  };
  return { base, browser, context, errors, stop };
}

/**
 * Print a fixture to PDF and read where each blank was printed. Returns { expect, bytes }: one expectation per
 * data-x element, with page, x0, x1 and line (the y of the printed line) in PDF points from the page's top-left.
 */
async function makePdf(h, css, html) {
  const g = await h.context.newPage();
  await g.setViewportSize({ width: 816, height: 1056 });
  await g.setContent(`<html><head><style>${css}</style></head><body>${html}</body></html>`);
  await g.emulateMedia({ media: 'print' });
  const expect = await g.evaluate(() => {
    const pages = Array.from(document.querySelectorAll('.pg'));
    return Array.from(document.querySelectorAll('[data-x]')).map((el) => {
      const o = el.closest('.pg').getBoundingClientRect();
      const r = el.getBoundingClientRect();
      // A drawn rule is the element's bottom edge; a run of underscores is drawn about 3 pt above the bottom of its line box.
      const line = (r.bottom - o.top) * 0.75 - (el.classList.contains('rule') ? 0.5 : 3.2);
      return Object.assign(JSON.parse(el.getAttribute('data-x')), { page: pages.indexOf(el.closest('.pg')) + 1, x0: (r.left - o.left) * 0.75, x1: (r.right - o.left) * 0.75, line });
    });
  });
  const bytes = await g.pdf({ width: '8.5in', height: '11in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await g.close();
  return { expect, bytes: Array.from(bytes) };
}

/** A new firm in the self-serve edition with one offering; resolves to the page showing its console. */
async function signUp(h, firm) {
  const page = await h.context.newPage();
  page.on('pageerror', (e) => h.errors.push(String(e)));
  await page.goto(h.base + '/diy.html');
  await page.waitForSelector('#sd-firm');
  await page.fill('#sd-firm', firm || 'Northgate Capital');
  await page.fill('#sd-name', 'Priya Raman');
  await page.fill('#sd-email', 'priya@northgate-example.com');
  await page.fill('#sd-password', 'a-long-password-1');
  await page.click('.sd-submit');
  await page.waitForFunction(() => /^#console/.test(location.hash));
  await page.evaluate(() => (location.hash = 'console-offerings'));
  await page.waitForSelector('[data-action=off-add]');
  await page.click('[data-action=off-add]');
  await page.waitForFunction(() => window.CVPortal.state.ws.offerings.length > 0);
  return page;
}

/**
 * Give every page of a PDF a crop box [x, y, width, height], inside the check browser with the PDF writing library
 * the harness already serves. Returns the new bytes.
 */
async function cropPdf(page, bytes, box) {
  if (!(await page.evaluate(() => !!window.PDFLib))) await page.addScriptTag({ url: CDN + WRITER });
  return page.evaluate(
    async ({ arr, b }) => {
      const pdf = await window.PDFLib.PDFDocument.load(new Uint8Array(arr));
      pdf.getPages().forEach((p) => p.setCropBox(b[0], b[1], b[2], b[3]));
      return Array.from(await pdf.save());
    },
    { arr: bytes, b: box }
  );
}

/**
 * Run a file through the upload path: the same call the upload form makes (assets/js/esign.js, NS.forms['es-agreement']),
 * then the save the form tries straight away. Options: countersign (default true), offering (a name to give the
 * offering before the upload), offeringShort. Returns the fields in points with each signer's role, whether
 * saveAgreement accepted the draft, and the sentence that stopped it. The draft or the saved template is removed again.
 */
async function upload(page, bytes, opts) {
  return page.evaluate(
    async ({ arr, o }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const off = ws.offerings[ws.offerings.length - 1];
      if (o.offering) {
        off.name = o.offering;
        off.shortName = o.offeringShort || o.offering;
      }
      const file = new File([new Uint8Array(arr)], 'fixture.pdf', { type: 'application/pdf' });
      const env = await NS.esign.agreementDraft(ws, off.id, { file, title: 'Subscription Agreement', countersign: o.countersign !== false });
      const role = (id) => (env.signers.find((s) => s.id === id).role === 'countersigner' ? 'firm' : 'investor');
      const fields = env.fields.map((f) => {
        const ps = env.pageSizes[f.page - 1];
        return {
          type: f.type,
          role: role(f.signerId),
          page: f.page,
          conf: f.conf || '',
          why: f.why || '',
          forType: f.forType || '',
          label: f.label || '',
          required: !!f.required,
          auto: !!f.auto,
          x0: f.x * ps.w,
          x1: (f.x + f.w) * ps.w,
          top: f.y * ps.h,
          bottom: (f.y + f.h) * ps.h
        };
      });
      // The upload form saves at once when it can: true here means the agreement went live with nobody looking at it.
      const saved = !!NS.esign.saveAgreement(ws, env);
      const todo = saved ? '' : NS.esign.agreementTodo ? NS.esign.agreementTodo(env) : '';
      ws.envelopes = (ws.envelopes || []).filter((e) => e !== env);
      ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== env.agreementFor);
      try {
        await NS.ops.files.del(env.docId);
      } catch (e) {
        /* the file store keeps it; nothing reads it again */
      }
      return { fields, saved, todo, pages: env.pageSizes };
    },
    { arr: bytes, o: opts || {} }
  );
}

module.exports = { ROOT, start, makePdf, signUp, cropPdf, upload };
