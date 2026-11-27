// gate: browser
// last "SERVED PORTAL: PASS (parts run: 2)"
// Plan 15-06 (SE-09, C-07, W-07; 15-CONTEXT wave 1 W6 and wave 3 B3): the portal as this server serves it, under its own
// content security policy. Each part starts the integration server (server/index.mjs createServer) with SERVE_PORTAL=1
// on a free loopback port and, in a fresh browser context:
//   1. loads / (portal.html, the configuration injected, the policy in its header) and waits for the portal to start;
//   2. opens the e-sign preview: a one-page agreement written with the portal's own PDF writer (NS.esignKit.writer) is
//      drawn by the e-sign module's page view (NS.esign.viewPdf, the code that draws an envelope's pages for the
//      preview and the signing screens: the shipped PDF viewer and its worker), and its page image must appear;
//   3. reads one document: that page drawn on a canvas is read by the text reader exactly as the intake loads it
//      (assets/js/textengine.js by a script element, its worker and WebAssembly from assets/vendor/textread), and the
//      words read must hold the agreement's title;
//   4. requires 0 securitypolicyviolation events in the page from the first script on, no page error, and a policy that
//      allows WebAssembly ('wasm-unsafe-eval') and never 'unsafe-eval'; the page itself also compiles a small
//      WebAssembly module under the policy (as the reader's own code needs to).
// Parts:
//   chromium-desktop   Chromium, 1440 x 1000
//   chromium-iphone    Chromium with the iPhone profile of phase 6's checks (390 x 844, touch, the iPhone user agent)
//   WebKit is not a part here (orchestrator decision 2026-11-27, 15-CONTEXT): one NOTE line says so, and the owner's
//   iPhone check covers the served portal in Safari. The marker above counts the parts that run here (2).
//   --plant no-wasm    serves the pages with 'wasm-unsafe-eval' taken out of the policy (the proof that the check fails)
//   NODE_PATH=$(npm root -g) node served-portal.js [--part chromium-desktop,chromium-iphone] [--plant no-wasm]
// The last line is "SERVED PORTAL: PASS (parts run: N)" or "SERVED PORTAL: FAIL (parts run: N) - <failed parts>".
process.env.GATE_FRESH = '1'; // every part runs each time (a run takes seconds)
const path = require('path');
const { pathToFileURL } = require('url');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const argv = process.argv.slice(2);
const PLANT = argv.indexOf('--plant') >= 0 ? String(argv[argv.indexOf('--plant') + 1] || '') : '';
const TITLE = 'INVESTOR ONE SUBSCRIPTION';
// The owner's device as phase 6's checks stand in for it (safari-finish.js IPHONE): an iPhone in the Claude app.
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};

if (PLANT && PLANT !== 'no-wasm') {
  console.log(`FAIL unknown --plant ${PLANT} (known: no-wasm)`);
  console.log('SERVED PORTAL: FAIL (parts run: 0) - plant');
  process.exit(1);
}
console.log("NOTE WebKit not installed here: the owner's iPhone check covers the served portal under the policy (e-sign preview, document read)");
if (PLANT) console.log("NOTE planted: the pages are served with 'wasm-unsafe-eval' taken out of the policy; this run must fail");

/** The integration server with SERVE_PORTAL=1 on a free port; with --plant no-wasm its pages lose 'wasm-unsafe-eval'. */
async function serverUp() {
  const { createServer } = await import(pathToFileURL(path.join(ROOT, 'server/index.mjs')).href);
  const { openStore } = await import(pathToFileURL(path.join(ROOT, 'server/lib/store.mjs')).href);
  const { createPages } = await import(pathToFileURL(path.join(ROOT, 'server/lib/pages.mjs')).href);
  const port = await Lib.freePort();
  const origin = `http://127.0.0.1:${port}`;
  const env = { NODE_ENV: 'test', SERVE_PORTAL: '1', PUBLIC_URL: origin, RATE_LIMIT_PER_MIN: '0' };
  let pages = createPages({ env });
  if (PLANT === 'no-wasm') {
    const real = pages;
    pages = Object.assign({}, real, {
      serve(req, res, p) {
        const head = res.writeHead;
        res.writeHead = function (status, headers) {
          if (headers && headers['Content-Security-Policy']) headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace(/ 'wasm-unsafe-eval'/g, '');
          return head.call(this, status, headers);
        };
        return real.serve(req, res, p);
      }
    });
  }
  const server = createServer({ env, store: openStore(null), pages });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return {
    origin,
    stop: () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      })
  };
}

/** The steps of one part in a context made with ctxOpts. */
async function run(check, S, ctxOpts) {
  const srv = await serverUp();
  let A = null;
  try {
    A = await Lib.open(S, { allow: [srv.origin], context: ctxOpts });
    const page = A.page;
    await page.addInitScript(() => {
      window.__violations = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__violations.push(`${e.effectiveDirective || e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`));
    });
    const refused = [];
    page.on('console', (m) => /Content Security Policy|Refused to/i.test(m.text()) && refused.push(m.text().slice(0, 300)));

    const resp = await page.goto(srv.origin + '/', { waitUntil: 'load' });
    const csp = (resp && resp.headers()['content-security-policy']) || '';
    check('/ is served (200, HTML)', resp && resp.status() === 200 && /^text\/html/.test(resp.headers()['content-type'] || ''), resp && resp.status());
    check("the policy allows WebAssembly ('wasm-unsafe-eval') and never 'unsafe-eval'", /script-src [^;]*'wasm-unsafe-eval'/.test(csp) && !/'unsafe-eval'/.test(csp), csp.split(';').find((d) => /script-src/.test(d)));
    await page.waitForFunction(() => window.CVPortal && window.CVPortal.esign && window.CVPortal.esignKit && document.querySelector('#view'), null, { timeout: 30000 });
    const config = await page.evaluate(() => window.CVPortalConfig || null);
    check('the configuration is injected (sign-in server, no demo control)', !!config && config.signInServer === true && config.demo === false, config);

    // 2. The e-sign preview: the portal's own writer makes the agreement, the e-sign page view draws it.
    const preview = await page.evaluate(async (title) => {
      const NS = window.CVPortal;
      const PDFLib = await NS.esignKit.writer();
      const doc = await PDFLib.PDFDocument.create();
      const pg = doc.addPage([612, 792]);
      const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      pg.drawText(title, { x: 60, y: 700, size: 30, font });
      const bytes = await doc.save();
      const body = document.createElement('div');
      body.id = 'served-check-preview';
      document.body.appendChild(body);
      await NS.esign.viewPdf(body, new Blob([bytes], { type: 'application/pdf' }), 'Subscription agreement');
      const img = body.querySelector('img.doc-page');
      if (!img) return { pages: 0, text: body.innerText.slice(0, 200) };
      await new Promise((ok) => (img.complete ? ok() : img.addEventListener('load', ok)));
      window.__page = img;
      return { pages: body.querySelectorAll('img.doc-page').length, w: img.naturalWidth, h: img.naturalHeight };
    }, TITLE);
    check('the e-sign preview draws the agreement’s page', preview.pages === 1 && preview.w > 600, preview);

    // 3. A document read: the drawn page's title strip read by the text reader, loaded as the intake loads it.
    const read = await page.evaluate(async () => {
      const NS = window.CVPortal;
      if (!NS.textengine)
        await new Promise((ok, no) => {
          const s = document.createElement('script');
          s.src = new URL('assets/js/textengine.js', document.baseURI).href;
          s.onload = ok;
          s.onerror = () => no(new Error('textengine.js could not be loaded'));
          document.head.appendChild(s);
        });
      const img = window.__page;
      const cv = document.createElement('canvas');
      const sx = img.naturalWidth / 612;
      cv.width = Math.round(560 * sx);
      cv.height = Math.round(60 * sx);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, Math.round(40 * sx), Math.round(60 * sx), cv.width, cv.height, 0, 0, cv.width, cv.height);
      try {
        await NS.textengine.start();
        const blocks = await NS.textengine.read(cv, 'line', 20000);
        const words = [];
        const walk = (x) => {
          if (!x || typeof x !== 'object') return;
          if (typeof x.text === 'string' && !x.words && !x.lines && !x.paragraphs) words.push(x.text);
          for (const k of ['paragraphs', 'lines', 'words']) (x[k] || []).forEach(walk);
        };
        (blocks || []).forEach(walk);
        return { ok: true, text: words.join(' ') };
      } catch (e) {
        return { ok: false, text: '', why: e && (e.why || e.code), detail: String((e && (e.detail || e.message)) || e).slice(0, 300) };
      } finally {
        if (NS.textengine) NS.textengine.stop();
      }
    });
    const said = read.text.toUpperCase().replace(/[^A-Z ]/g, '');
    check('a document read: the text reader starts and reads the agreement’s title', read.ok && said.includes('INVESTOR') && said.includes('SUBSCRIPTION'), read);

    // 4. WebAssembly in the page itself, under the page's policy (what 'wasm-unsafe-eval' allows).
    const wasm = await page.evaluate(async () => {
      try {
        await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
        return 'compiled';
      } catch (e) {
        return 'refused: ' + String(e && e.message).slice(0, 200);
      }
    });
    check('WebAssembly compiles in the served page', wasm === 'compiled', wasm);

    await page.waitForTimeout(300);
    const violations = await page.evaluate(() => window.__violations.slice());
    check('0 securitypolicyviolation events', violations.length === 0, violations.slice(0, 10));
    check('no "Refused to" line in the console', refused.length === 0, refused.slice(0, 5));
    check('no page error', !A.errors.length, A.errors.slice(0, 5));
    check('no request left this machine', !A.net.external.length, A.net.external.slice(0, 5));
  } finally {
    if (A) await A.context.close().catch(() => {});
    await srv.stop();
  }
}

Lib.runParts(
  {
    'chromium-desktop': ({ check, S }) => run(check, S, { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }),
    'chromium-iphone': ({ check, S }) => run(check, S, PHONE)
  },
  { name: 'SERVED PORTAL', unit: 'parts', flag: '--part', browser: true }
);
