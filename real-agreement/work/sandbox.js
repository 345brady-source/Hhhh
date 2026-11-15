/*
 * Scratch (not in the repository): the artifact wrapper page with the repository's assets, under conditions comparable
 * to the published preview: a sandboxed iframe (with or without allow-same-origin) and a content security policy.
 * The real artifact host cannot be reached from here; this reproduces only its general conditions.
 *
 * node sandbox.js <agreement.pdf> <outdir> <mode> [browser]
 *   mode: top | top+csp | top+cspnoblobimg | frame-same | frame-opaque | frame-same+csp | frame-opaque+csp
 *   browser: chromium (default) | firefox | webkit
 */
const pw = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = '/home/user/Hhhh';
const SCRATCH = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad';
const WRAPPER = path.join(SCRATCH, 'artifact/diy-portal.html');
const VENDOR = path.join(SCRATCH, 'vendor');
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
const LOCAL = {
  'pdf.js/3.11.174/pdf.min.js': path.join(VENDOR, 'pdfjs/package/build/pdf.min.js'),
  'pdf.js/3.11.174/pdf.worker.min.js': path.join(VENDOR, 'pdfjs/package/build/pdf.worker.min.js'),
  'pdf-lib/1.17.1/pdf-lib.min.js': path.join(VENDOR, 'pdflib/package/dist/pdf-lib.min.js')
};
const [PDF, OUT, MODE, BROWSER] = [process.argv[2], process.argv[3], process.argv[4] || 'top', process.argv[5] || 'chromium'];
fs.mkdirSync(OUT, { recursive: true });

const SCRIPT_HOSTS = 'https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com';
const CSP = {
  csp: `default-src 'self'; script-src 'self' 'unsafe-inline' ${SCRIPT_HOSTS}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'none'; worker-src 'none'; child-src 'none'`,
  cspnoblobimg: `default-src 'self'; script-src 'self' 'unsafe-inline' ${SCRIPT_HOSTS}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; worker-src 'none'; child-src 'none'`
};
const cspKey = (MODE.split('+')[1] || '').trim();
const frameKind = MODE.startsWith('frame-') ? MODE.split('+')[0].slice(6) : '';
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads' + (frameKind === 'same' ? ' allow-same-origin' : '');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/host.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      const port = server.address().port;
      return res.end(`<!doctype html><title>host</title><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="http://localhost:${port}/diy-portal.html" style="border:0;width:100vw;height:100vh"></iframe></body>`);
    }
    if (url === '/diy-portal.html') {
      const head = { 'Content-Type': 'text/html' };
      if (cspKey) head['Content-Security-Policy'] = CSP[cspKey];
      res.writeHead(200, head);
      return res.end('<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(WRAPPER, 'utf8') + '</body></html>');
    }
    const p = path.join(ROOT, url);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => server.listen(0, () => r(server)));
}

(async () => {
  const server = await serve();
  const port = server.address().port;
  const browser = await pw[BROWSER].launch();
  const context = await browser.newContext(process.env.VIEW === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : process.env.VIEW === 'narrow' ? { viewport: { width: 820, height: 700 } } : { viewport: { width: 1280, height: 900 } });
  const aborted = [];
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(`http://127.0.0.1:${port}`) || u.startsWith(`http://localhost:${port}`) || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    if (u.startsWith(CDN) && LOCAL[u.slice(CDN.length)]) return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(LOCAL[u.slice(CDN.length)]) });
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    aborted.push(u);
    return route.abort();
  });
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP-VIOLATION ${e.violatedDirective} blocked ${e.blockedURI} (${e.sourceFile || ''}:${e.lineNumber || ''})`));
    window.addEventListener('unhandledrejection', (e) => console.error('UNHANDLED ' + (e.reason && (e.reason.stack || e.reason.message || e.reason))));
  });
  const logs = [];
  const page = await context.newPage();
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push('pageerror: ' + String(e && e.stack ? e.stack : e)));
  const result = { mode: MODE, browser: BROWSER, sandbox: frameKind ? SANDBOX : '(none: top-level page)', csp: cspKey ? CSP[cspKey] : '(none)' };
  let fr = page;
  try {
    if (frameKind) {
      await page.goto(`http://127.0.0.1:${port}/host.html`);
      await page.waitForSelector('#art');
      fr = await (await page.$('#art')).contentFrame();
    } else await page.goto(`http://127.0.0.1:${port}/diy-portal.html`);
    await fr.waitForSelector('#app', { timeout: 15000 });
    await page.waitForTimeout(1200);
    result.env = await fr.evaluate(async () => {
      const t = (fn) => {
        try {
          return String(fn());
        } catch (e) {
          return 'THROWS ' + e.name + ': ' + e.message;
        }
      };
      const idb = await new Promise((res) => {
        try {
          const r = indexedDB.open('probe-db', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('s');
          r.onsuccess = () => res('opens');
          r.onerror = () => res('ERROR ' + (r.error && r.error.name + ': ' + r.error.message));
        } catch (e) {
          res('THROWS ' + e.name + ': ' + e.message);
        }
      });
      return { origin: t(() => self.origin), localStorage: t(() => typeof localStorage.getItem('x')), indexedDB: idb, app: !!(window.CVPortal && window.CVPortal.state), bodyText: document.body.innerText.slice(0, 160).replace(/\s+/g, ' ') };
    });
    console.log('environment:', JSON.stringify(result.env));
    // A new firm, as the owner does in the preview.
    await fr.waitForSelector('#sd-firm', { timeout: 15000 });
    await fr.fill('#sd-firm', 'Northgate Capital');
    await fr.fill('#sd-name', 'Priya Raman');
    await fr.fill('#sd-email', 'priya@northgate-example.com');
    await fr.fill('#sd-password', 'a-long-password-1');
    await fr.click('.sd-submit');
    await fr.waitForFunction(() => /^#console/.test(location.hash), null, { timeout: 15000 });
    await fr.evaluate(() => (location.hash = 'console-offerings'));
    await fr.waitForSelector('[data-action=off-add]');
    await fr.click('[data-action=off-add]');
    await fr.waitForFunction(() => window.CVPortal.state.ws.offerings.length > 0);
    const off = await fr.evaluate(() => {
      const o = window.CVPortal.state.ws.offerings[window.CVPortal.state.ws.offerings.length - 1];
      return { id: o.id, name: o.name };
    });
    await fr.evaluate((id) => (location.hash = 'console-offering-' + id), off.id);
    await fr.waitForSelector(`[data-action="es-agreement-new"][data-offering="${off.id}"]`);
    await fr.click(`[data-action="es-agreement-new"][data-offering="${off.id}"]`);
    await fr.waitForSelector('#dlg[open] #es-agr-file');
    await fr.setInputFiles('#es-agr-file', PDF);
    if (process.env.FAILTEXT) {
      // SIMULATED failure, to see what the upload does when a page's text cannot be read: getTextContent rejects.
      await fr.evaluate(async () => {
        const lib = await window.CVPortal.pdfLib();
        const file = document.querySelector('#es-agr-file').files[0];
        const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const pg = await doc.getPage(1);
        const proto = Object.getPrototypeOf(pg);
        proto.getTextContent = () => Promise.reject(new Error('simulated: the text of this page cannot be read'));
        await doc.destroy();
      });
    }
    const t0 = Date.now();
    await fr.click('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
    // The editor opens on the draft, or the agreement is saved at once, or a message is shown and the dialog stays.
    const seenToasts = [];
    let outcome = 'timeout';
    for (let i = 0; i < 240; i++) {
      const s = await fr.evaluate((id) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const toasts = Array.from(document.querySelectorAll('#toasts .toast')).map((e) => e.textContent.trim());
        const btn = document.querySelector('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
        return { env: /^#console-envelope-/.test(location.hash), tpl: (ws.esignTemplates || []).some((t) => t.offeringId === id), toasts, btn: btn ? btn.textContent + (btn.disabled ? ' (disabled)' : '') : '' };
      }, off.id);
      s.toasts.forEach((t) => seenToasts.indexOf(t) < 0 && seenToasts.push(t));
      if (s.env) {
        outcome = 'draft opened in the field editor';
        break;
      }
      if (s.tpl) {
        outcome = 'saved at once';
        break;
      }
      if (s.btn === 'Continue to place fields' && i > 2) {
        outcome = 'upload refused: the dialog stays open';
        break;
      }
      await page.waitForTimeout(500);
    }
    result.took = Date.now() - t0;
    result.outcome = outcome;
    await page.waitForTimeout(2500);
    result.toasts = seenToasts.concat(await fr.evaluate(() => Array.from(document.querySelectorAll('#toasts .toast')).map((e) => e.textContent.trim()))).filter((t, i, a) => a.indexOf(t) === i);
    await page.screenshot({ path: path.join(OUT, `editor-${MODE}-${BROWSER}.png`) });
    if (outcome === 'draft opened in the field editor' || outcome === 'saved at once') {
      const r = await fr.evaluate(async (id) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const env = /^#console-envelope-/.test(location.hash) ? ws.envelopes.find((e) => e.id === NS.state.param) : null;
        const src = env || (ws.esignTemplates || []).find((t) => t.offeringId === id);
        const roleOf = (f) => (env ? (env.signers.find((s) => s.id === f.signerId).role === 'countersigner' ? 'firm' : 'investor') : f.signerRole === 'Sponsor' ? 'firm' : 'investor');
        const fields = src.fields.map((f, i) => {
          const ps = src.pageSizes[f.page - 1];
          return { n: i + 1, page: f.page, type: f.type, role: roleOf(f), label: f.label || '', conf: f.confidence || '', review: !!f.review, why: f.reviewReason || '', forType: f.forType || '', prefill: f.prefill || '', x0: +(f.x * ps.w).toFixed(1), x1: +((f.x + f.w) * ps.w).toFixed(1), top: +(f.y * ps.h).toFixed(1), bottom: +((f.y + f.h) * ps.h).toFixed(1) };
        });
        let layout = null;
        let layoutError = '';
        try {
          layout = await NS.esign.pageLayout(src.docId);
        } catch (e) {
          layoutError = (e && (e.stack || e.message)) || String(e);
        }
        const imgs = Array.from(document.querySelectorAll('.es-page img')).map((im) => ({ src: im.src.slice(0, 30), complete: im.complete, w: im.naturalWidth }));
        return { fields, layoutError, layout: layout ? layout.map((p) => ({ page: p.page, items: p.items.length, rules: p.rules.length, boxes: p.boxes.length })) : null, imgs, note: (document.querySelector('.es-agr-note') || {}).textContent || '', todo: env && NS.esign.agreementTodo ? NS.esign.agreementTodo(env) : '' };
      }, off.id);
      Object.assign(result, r);
      // What the editor itself draws: each field's box on the page as shown, against the stored fractions.
      if (process.env.SHOTS) {
        result.review = await fr.evaluate(() => ({ list: Array.from(document.querySelectorAll('.es-review button, .es-review li')).length, text: ((document.querySelector('.es-review') || {}).innerText || '').slice(0, 300), pageShown: (document.querySelector('#fe-page') || {}).value, zoom: (document.querySelector('#fe-zoom') || {}).value }));
        result.drawn = {};
        for (const n of process.env.SHOTS.split(',').map(Number)) {
          const el = await fr.$(`.es-page[data-page="${n}"]`);
          if (!el) {
            result.drawn[n] = 'no page element';
            continue;
          }
          await el.scrollIntoViewIfNeeded();
          await page.waitForTimeout(900);
          result.drawn[n] = await fr.evaluate((n) => {
            const NS = window.CVPortal;
            const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param);
            const pg = document.querySelector(`.es-page[data-page="${n}"]`);
            const o = pg.getBoundingClientRect();
            const img = pg.querySelector('img');
            const ir = img ? img.getBoundingClientRect() : null;
            let worst = 0;
            let shown = 0;
            const mine = env ? env.fields.filter((f) => f.page === n) : [];
            mine.forEach((f) => {
              const el = pg.querySelector(`.es-fld[data-fid="${f.id}"]`);
              if (!el) return;
              shown++;
              const r = el.getBoundingClientRect();
              worst = Math.max(worst, Math.abs((r.left - o.left) / o.width - f.x), Math.abs((r.top - o.top) / o.height - f.y), Math.abs(r.width / o.width - f.w), Math.abs(r.height / o.height - f.h));
            });
            return { fields: mine.length, drawn: shown, anyFldOnPage: pg.querySelectorAll('.es-fld').length, worstOffsetAsFractionOfPage: +worst.toFixed(4), page: [Math.round(o.width), Math.round(o.height)], img: ir ? [Math.round(ir.width), Math.round(ir.height), img.naturalWidth] : null };
          }, n);
          await el.screenshot({ path: path.join(OUT, `editor-${MODE}-${BROWSER}-${process.env.VIEW || 'desk'}-p${n}.png`) });
        }
        console.log('  editor drawing:', JSON.stringify(result.review), JSON.stringify(result.drawn));
      }
    }
  } catch (e) {
    result.failed = String(e && e.stack ? e.stack : e).slice(0, 1500);
    try {
      await page.screenshot({ path: path.join(OUT, `failed-${MODE}-${BROWSER}.png`) });
    } catch (e2) {
      /* no screenshot */
    }
  }
  result.console = logs;
  result.aborted = aborted;
  fs.writeFileSync(path.join(OUT, `result-${MODE}-${BROWSER}.json`), JSON.stringify(result, null, 1));
  const f = result.fields || [];
  const per = {};
  f.forEach((x) => (per['p' + x.page] = (per['p' + x.page] || 0) + 1));
  console.log(`[${MODE} / ${BROWSER}] outcome: ${result.outcome || 'FAILED'}; fields ${f.length}; review ${f.filter((x) => x.review).length}; per page ${JSON.stringify(per)}`);
  console.log('  toasts:', JSON.stringify(result.toasts || []));
  console.log('  layout:', result.layoutError ? 'ERROR ' + result.layoutError : JSON.stringify(result.layout));
  console.log('  page images:', JSON.stringify((result.imgs || []).slice(0, 2)), 'count', (result.imgs || []).length);
  console.log('  signatures:', f.filter((x) => x.type === 'signature').map((x) => `p${x.page} ${x.role} ${x.conf} y${x.top}`).join(' | '));
  if (result.failed) console.log('  FAILED:', result.failed.slice(0, 600));
  const uniq = {};
  logs.forEach((l) => (uniq[l.slice(0, 260)] = (uniq[l.slice(0, 260)] || 0) + 1));
  console.log('  console errors and warnings:');
  Object.keys(uniq).slice(0, 25).forEach((k) => console.log(`    x${uniq[k]} ${k}`));
  if (aborted.length) console.log('  outside requests aborted by the check browser:', Array.from(new Set(aborted)).slice(0, 8).join(' , '));
  await browser.close();
  server.close();
})();
