/*
 * Planning probe for Phase 1 (Accurate Field Placement). Read-only against the app: it measures where the
 * automatic placement puts fields on two generated subscription agreements, against the printed blanks.
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/baseline-probe.js
 *
 * What it shows that the executor can reuse (all of it was run and worked when the phase was planned):
 *  - The script CDN the app loads its PDF libraries from is not reachable from the build sandbox, but the package
 *    registry is. vendor() fetches the same two libraries at the same versions the app uses and the browser
 *    context serves them in place of the CDN addresses. Nothing is added to the app.
 *  - A fixture is HTML printed to PDF by the browser. Each blank carries data-x with what belongs there, and its
 *    printed position is read from the page before printing (CSS px * 0.75 = PDF points, top-left origin), so
 *    the expected positions never come from the code under test.
 *  - Reaching a sponsor console in the self-serve edition and running the real upload path on a file.
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
const LOCAL = {
  'pdf.js/3.11.174/pdf.min.js': path.join(VENDOR, 'pdfjs/package/build/pdf.min.js'),
  'pdf.js/3.11.174/pdf.worker.min.js': path.join(VENDOR, 'pdfjs/package/build/pdf.worker.min.js'),
  'pdf-lib/1.17.1/pdf-lib.min.js': path.join(VENDOR, 'pdflib/package/dist/pdf-lib.min.js')
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

const CSS = `@page{size:8.5in 11in;margin:0} html,body{margin:0} body{font:12pt/1.4 "Times New Roman",serif}
.pg{width:8.5in;height:11in;box-sizing:border-box;padding:1in;position:relative;page-break-after:always;overflow:hidden}
.b{display:inline-block} .rule{display:inline-block;border-bottom:1px solid #000;height:1em;vertical-align:baseline}
.cols{display:flex;gap:.5in} .cols>div{flex:1} .cap{font-size:9pt}`;
const blank = (x, text) => `<span class="b" data-x='${JSON.stringify(x)}'>${text}</span>`;
const rule = (x, width) => `<span class="rule" style="width:${width}" data-x='${JSON.stringify(x)}'></span>`;
const U30 = '_'.repeat(30);
const U28 = '_'.repeat(28);
const block = (role) => `<p>By: ${blank({ type: 'signature', role }, U30)}</p><p>Name: ${blank({ type: 'name', role }, U28)}</p><p>Title: ${blank({ type: 'text', role }, U28)}</p><p>Date: ${blank({ type: 'date', role }, U28)}</p>`;
const FIXTURES = {
  // The investor signs on one page and the firm accepts on the next; every blank is a run of underscores after its label.
  classic: `<div class="pg"><h2 style="text-align:center">SUBSCRIPTION AGREEMENT</h2>
<p>The undersigned (the "Subscriber") hereby subscribes for an interest in Northgate Fund I, LP (the "Fund") and agrees to make a Capital Commitment of $${blank({ type: 'text', role: 'investor' }, '_'.repeat(14))} on the terms of this Agreement. The Manager may accept or reject this subscription.</p>
<p>Signature pages follow. The signature of the Subscriber below constitutes execution of the limited partnership agreement of the Fund by each member of the Subscriber.</p></div>
<div class="pg"><h3 style="text-align:center"><u>SIGNATURE PAGE</u></h3><p>IN WITNESS WHEREOF, the undersigned has executed this Subscription Agreement to the Fund as of the date set forth below.</p>
<p><b>SUBSCRIBER:</b></p>${block('investor')}</div>
<div class="pg"><p><b>ACCEPTED AND AGREED:</b></p><p>NORTHGATE FUND I GP, LLC, as General Partner</p>${block('firm')}</div>`,
  // One page, two columns (investor left, firm right); every blank is a drawn line with its caption underneath.
  caption: `<div class="pg"><h3>Signature Page to Subscription Agreement</h3><p>The Subscriber and the General Partner have signed below.</p>
<div class="cols">${[['investor', 'SUBSCRIBER', 'Signature of Subscriber'], ['firm', 'GENERAL PARTNER', 'Authorized Signature']]
    .map(([role, head, cap]) => `<div><p><b>${head}</b></p><p style="margin:36pt 0 0">${rule({ type: 'signature', role }, '2.6in')}<br><span class="cap">${cap}</span></p>
<p style="margin:24pt 0 0">${rule({ type: 'name', role }, '2.6in')}<br><span class="cap">Print Name</span></p>
<p style="margin:24pt 0 0">${rule({ type: 'date', role }, '1.4in')}<br><span class="cap">Date</span></p></div>`)
    .join('')}</div></div>`
};

(async () => {
  vendor();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    const m = u.match(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(.+)$/);
    if (m && LOCAL[m[1]]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(LOCAL[m[1]]) });
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  /** Print a fixture to PDF and read where each blank was printed. */
  const make = async (html) => {
    const g = await context.newPage();
    await g.setViewportSize({ width: 816, height: 1056 });
    await g.setContent(`<html><head><style>${CSS}</style></head><body>${html}</body></html>`);
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
    return { expect, bytes };
  };
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // A new firm in the self-serve edition, with one offering.
  await page.goto(base + '/diy.html');
  await page.waitForSelector('#sd-firm');
  await page.fill('#sd-firm', 'Northgate Capital');
  await page.fill('#sd-name', 'Priya Raman');
  await page.fill('#sd-email', 'priya@northgate-example.com');
  await page.fill('#sd-password', 'a-long-password-1');
  await page.click('.sd-submit');
  await page.waitForFunction(() => /^#console/.test(location.hash));
  await page.evaluate(() => (location.hash = 'console-offerings'));
  await page.waitForSelector('[data-action=off-add]');
  await page.click('[data-action=off-add]');
  await page.waitForFunction(() => window.CVPortal.state.ws.offerings.length > 0);

  let blanks = 0;
  let onLine = 0;
  for (const name of Object.keys(FIXTURES)) {
    const fx = await make(FIXTURES[name]);
    const out = await page.evaluate(async (arr) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const file = new File([new Uint8Array(arr)], 'fixture.pdf', { type: 'application/pdf' });
      // The same call the upload form makes (assets/js/esign.js, NS.forms['es-agreement']).
      const env = await NS.esign.agreementDraft(ws, ws.offerings[ws.offerings.length - 1].id, { file, title: 'Subscription Agreement', countersign: true });
      const role = (id) => (env.signers.find((s) => s.id === id).role === 'countersigner' ? 'firm' : 'investor');
      const fields = env.fields.map((f) => {
        const ps = env.pageSizes[f.page - 1];
        return { type: f.type, role: role(f.signerId), page: f.page, conf: f.conf || '', x0: f.x * ps.w, x1: (f.x + f.w) * ps.w, top: f.y * ps.h, bottom: (f.y + f.h) * ps.h };
      });
      // The upload form saves at once when it can: true here means the agreement went live with nobody looking at it.
      const saved = !!NS.esign.saveAgreement(ws, env);
      ws.envelopes = (ws.envelopes || []).filter((e) => e !== env);
      ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== env.agreementFor);
      return { fields, saved };
    }, Array.from(fx.bytes));
    // A field is on its printed blank when it is the right kind for the right signer, starts where the line starts and rests on the line.
    const hit = (e) => out.fields.find((f) => f.page === e.page && f.type === e.type && f.role === e.role && Math.abs(f.x0 - e.x0) <= 6 && Math.abs(f.bottom - e.line) <= 6);
    const hits = fx.expect.filter(hit).length;
    blanks += fx.expect.length;
    onLine += hits;
    console.log(`\n${name}: ${fx.expect.length} printed blanks, ${out.fields.length} fields placed, ${hits} on their blank, saved with no review: ${out.saved}`);
    fx.expect.forEach((e) => console.log(`  blank  p${e.page} ${e.type}/${e.role}  x ${e.x0.toFixed(0)}-${e.x1.toFixed(0)}  line y ${e.line.toFixed(0)}${hit(e) ? '' : '   <- no field on it'}`));
    out.fields.forEach((f) => console.log(`  field  p${f.page} ${f.type}/${f.role}  x ${f.x0.toFixed(0)}-${f.x1.toFixed(0)}  y ${f.top.toFixed(0)}-${f.bottom.toFixed(0)}${f.conf ? '  ' + f.conf : ''}`));
  }
  console.log(`\nTOTAL: ${onLine} of ${blanks} printed blanks have a field on them`);
  console.log(errors.length ? 'PAGE ERRORS ' + errors.join(' | ') : 'NO PAGE ERRORS');
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
