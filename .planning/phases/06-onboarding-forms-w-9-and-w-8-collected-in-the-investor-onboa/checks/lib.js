// The phase-6 check browser (test-only code): the repository on its own free local port (no separately started server,
// so checks in parallel worktrees never clash), the CDN libraries and fonts answered from the local vendor copies,
// every other outside request aborted; the self-serve sample portal with a subscription agreement; an invited
// investor walked through onboarding; screen text and the white-label leak check; and the parts runner every
// phase-6 check uses (gate rules: an unknown or empty part list fails, the last line is "<NAME>: PASS (parts run: N)").
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const VENDOR = process.env.VENDOR_DIR || path.join(SCRATCH, 'vendor');
const OUT = process.env.P6_OUT || path.join(SCRATCH, 'exec-06-01', 'checks-out');
fs.mkdirSync(OUT, { recursive: true });
// Phase 4's agreement and its fields are reused; its PDF goes into this check's folder, not phase 4's. Loaded only when a
// browser check needs it, so the pure checks (status-math.js) run with plain node and no browser package.
let p4 = null;
function P4() {
  if (!p4) {
    if (!process.env.SIGN_OUT) process.env.SIGN_OUT = path.join(OUT, 'p4');
    p4 = require(path.join(ROOT, '.planning/phases/04-signing-inside-onboarding/checks/lib.js'));
  }
  return p4;
}

const LOCAL = {
  'pdf.js/3.11.174/pdf.min.js': path.join(VENDOR, 'pdfjs/package/build/pdf.min.js'),
  'pdf.js/3.11.174/pdf.worker.min.js': path.join(VENDOR, 'pdfjs/package/build/pdf.worker.min.js'),
  'pdf-lib/1.17.1/pdf-lib.min.js': path.join(VENDOR, 'pdflib/package/dist/pdf-lib.min.js')
};
const JSDELIVR = {
  '@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js': { file: path.join(VENDOR, 'fontkit/package/dist/fontkit.umd.min.js'), type: 'application/javascript' },
  'dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf': { file: path.join(VENDOR, 'dejavu/package/ttf/DejaVuSans.ttf'), type: 'font/ttf' },
  'dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf': { file: path.join(VENDOR, 'dejavu/package/ttf/DejaVuSans-Bold.ttf'), type: 'font/ttf' }
};
const IGNORE = /Failed to load resource|net::ERR|favicon/;

/** The vendor files this browser needs; the first one missing, or ''. */
function missingVendor() {
  const all = Object.values(LOCAL).concat(Object.values(JSDELIVR).map((x) => x.file));
  return all.find((f) => !fs.existsSync(f)) || '';
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
/** The repository served on a free local port. */
function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

/** Browser, server and the routing; stop() closes both. */
async function start() {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const stop = async () => {
    await browser.close().catch(() => {});
    server.close();
  };
  return { origin, base: `${origin}/diy.html`, browser, server, stop };
}

/** A fresh browser context on the check server: CDN and fonts answered locally, anything else outside refused. */
async function open(S, opts) {
  opts = opts || {};
  const context = await S.browser.newContext(Object.assign({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }, opts.context || {}));
  const net = { external: [] };
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(S.origin + '/') || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    const m = u.match(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(.+)$/);
    if (m && LOCAL[m[1]]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(LOCAL[m[1]]) });
    const jd = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(.+)$/);
    if (jd && JSDELIVR[jd[1]]) return route.fulfill({ status: 200, contentType: JSDELIVR[jd[1]].type, headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(JSDELIVR[jd[1]].file) });
    if (/^https:\/\/fonts\.googleapis\.com\//.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    net.external.push(u);
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push('console: ' + m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e && e.stack ? e.stack : e)));
  return { context, page, errors, net };
}

/**
 * A fresh self-serve portal (the Kestrel Bay sample) with a raising offering whose subscription agreement is stored with
 * phase 4's fields, then the given exemption on the offering (opts.exemption, default Rule 506(b)).
 */
async function setupPortal(S, A, opts) {
  opts = opts || {};
  const page = A.page;
  await page.goto(S.base);
  await page.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await page.goto(S.base);
  await page.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]');
  await page.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await page.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay');
  const offName = await page.evaluate(() => {
    const ws = window.CVPortal.state.ws;
    return (ws.offerings.find((x) => x.status === 'Raising') || ws.offerings[0]).name;
  });
  const b64 = await P4().agreementPdf(A.context, offName);
  return page.evaluate(
    async ({ b64, fields, exemption }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      let o = ws.offerings.find((x) => x.status === 'Raising');
      if (!o) {
        o = ws.offerings[0];
        o.status = 'Raising';
      }
      o.structure = Object.assign({}, o.structure, { exemption });
      o.minimum = 50000;
      NS.integrations.ensure(ws).configured = true;
      const docId = 'doc-ppm-test';
      await NS.ops.files.put(docId, new Blob(['%PDF-1.4 test memorandum'], { type: 'application/pdf' }));
      ws.docs = ws.docs || [];
      if (!ws.docs.some((d) => d.id === docId)) ws.docs.push({ id: docId, title: 'Private placement memorandum', fileName: 'PPM.pdf', type: 'application/pdf', size: 24, sha256: '', cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: NS.dates.today(), taxYear: '', publishedAt: new Date().toISOString(), publishedBy: 'test', offeringDoc: true, hidden: false });
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      await NS.ops.files.put('tpl-doc-test', new Blob([u8], { type: 'application/pdf' }));
      ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== o.id);
      const size = { w: 612, h: 792 };
      ws.esignTemplates.push({ id: 'tpl-sub-test', title: 'Subscription Agreement', fileName: 'Subscription_Agreement.pdf', docId: 'tpl-doc-test', pages: 3, pageSizes: [size, size, size], sha256: NS.audit.sha256(u8), roles: ['Investor', 'Sponsor'], message: 'Please sign your subscription agreement.', subscription: true, offeringId: o.id, createdAt: new Date().toISOString(), fields });
      NS.app.save(true);
      return { offeringId: o.id, offeringName: o.name, ready: NS.esign.templateReady(ws, o.id), exemption: o.structure.exemption };
    },
    { b64, fields: P4().TEMPLATE_FIELDS, exemption: opts.exemption || 'Rule 506(b)' }
  );
}

const createInvitation = (...a) => P4().createInvitation(...a);
const sandbox = (...a) => P4().sandbox(...a);
const heading = (page) => page.locator('.ivf-form h1').first().innerText().catch(() => '');
async function submit(page) {
  await page.click('.ivf-form .ob-actions button[type=submit]');
  await page.waitForFunction(() => !document.querySelector('.ivf-form button[type=submit][disabled]'), null, { timeout: 20000 });
  await page.waitForTimeout(150);
}
/** Field errors on screen now. */
const fieldErrors = (page) => page.locator('.field-error').allInnerTexts().catch(() => []);

/**
 * Walk the invited investor's onboarding until the subscription agreement is on screen. The status step is filled from
 * answers: { acc: 'yes' | 'no' | '' (left open), basis: index into the grounds, exp, edu, rep: 'yes' | 'no' | '', repName,
 * repFirm }; the other steps as phase 4's walker fills them. onStep(heading) runs on every screen before it is filled;
 * onFilled(heading) after. Returns { seen, reached, errors: field errors seen on any step after Continue }.
 */
async function walk(page, answers) {
  const a = answers || {};
  const seen = [];
  const errs = [];
  for (let guard = 0; guard < 24; guard++) {
    await page.waitForSelector('.ivf-form h1', { timeout: 30000 });
    const hd = await heading(page);
    const count = await page.locator('.ivf-progress .ob-count').innerText().catch(() => '');
    if (seen.length && seen[seen.length - 1] === `${count} | ${hd}`) {
      seen.push('STUCK: ' + (await fieldErrors(page)).join(' / '));
      break;
    }
    seen.push(`${count} | ${hd}`);
    if (a.onStep) await a.onStep(hd);
    if (/^Welcome/.test(hd)) {
      await page.check('#ob-esignConsent');
      if (await page.locator('#ob-edelivery').count()) await page.check('#ob-edelivery');
    } else if (/Create your login/.test(hd)) {
      await page.fill('#ob-password', 'investor-pass-123');
      await page.fill('#ob-password2', 'investor-pass-123');
    } else if (/Investor information/.test(hd)) {
      await page.fill('#ob-street', '12 Elm Street');
      await page.fill('#ob-city', 'Austin');
      await page.fill('#ob-st', 'TX');
      await page.fill('#ob-zip', '78701');
      await page.fill('#ob-phone', '+1 512 555 0101');
      // A person's account asks for the date of birth; an IRA, trust or entity asks for its custodian or place of formation.
      if (await page.locator('#ob-dob').count()) await page.fill('#ob-dob', '1980-04-02');
      if ((await page.locator('#ob-formation').count()) && !(await page.inputValue('#ob-formation'))) await page.fill('#ob-formation', 'Harbor Trust Company');
      await page.fill('#ob-tin', '123456789');
      await page.check('input[name="ob-pep"][value="no"]');
    } else if (/Identity verification/.test(hd)) {
      await sandbox(page, 'identity', 'passed');
    } else if (/^Investor status$/.test(hd)) {
      if (a.acc) await page.check(`input[name="ob-stAcc"][value="${a.acc}"]`);
      if (a.acc === 'yes' && a.basis != null) await page.check(`input[name="ob-stBasis"] >> nth=${a.basis}`);
      if (a.acc === 'no') {
        if (a.exp != null && (await page.locator('#ob-stExp').count())) await page.fill('#ob-stExp', a.exp);
        if (a.edu != null && (await page.locator('#ob-stEdu').count())) await page.fill('#ob-stEdu', a.edu);
        if (a.rep && (await page.locator('input[name="ob-stRep"]').count())) await page.check(`input[name="ob-stRep"][value="${a.rep}"]`);
        if (a.rep === 'yes') {
          if (a.repName != null) await page.fill('#ob-stRepName', a.repName);
          if (a.repFirm != null) await page.fill('#ob-stRepFirm', a.repFirm);
        }
      }
    } else if (/Accredit/.test(hd)) {
      if (await page.locator('[data-action=iv-start][data-kind=accreditation]').count()) await sandbox(page, 'accreditation', 'verified');
      else await page.check('input[name="ob-accBasis"] >> nth=0');
      await page.check('#ob-accAttest');
    } else if (/Tax certification/.test(hd)) {
      if (await page.locator('input[name="ob-usPerson"]').count()) await page.check('input[name="ob-usPerson"][value="yes"]');
      await page.check('#ob-w9');
      await page.fill('#ob-taxSig', a.name);
    } else if (/Distribution payments/.test(hd)) {
      if (await page.locator('#ob-routing').count()) {
        await page.fill('#ob-routing', '021000021');
        await page.fill('#ob-account', '123456789');
        await page.fill('#ob-account2', '123456789');
        await page.check('#ob-achAuth');
      }
    } else if (/^Subscription$/.test(hd)) {
      if (await page.locator('#ob-amount:not([readonly])').count()) await page.fill('#ob-amount', String(a.amount || 100000));
      if (a.subAcc !== false && (await page.locator('#ob-subAcc').count())) await page.check('#ob-subAcc');
      await page.check('#ob-subDocs');
    } else if (/Subscription agreement/.test(hd)) {
      await page.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 });
      return { seen, reached: true, errors: errs };
    } else {
      seen.push('UNKNOWN STEP');
      break;
    }
    if (a.onFilled) await a.onFilled(hd);
    await submit(page);
    const fe = await fieldErrors(page);
    if (fe.length) errs.push(`${hd}: ${fe.join(' / ')}`);
  }
  return { seen, reached: false, errors: errs };
}

/** Everything the page shows as text. */
const screenText = (page) => page.evaluate(() => document.body.innerText);

// White label (D-30): no provider, model, vendor or library name, and no form of the forbidden word.
const VENDORS = /pdf-lib|pdf\.js|Carrow|\bVale\b|DocuSign|SignNow|Adobe|HelloSign|Dropbox|PandaDoc|Powered by/i; // phase 5 record-check.js
const VENDOR_RE = /onnx|onnxruntime|microsoft|pytorch|torch|scikit|sklearn|anthropic|claude|\bopus\b|\bsonnet\b|\bhaiku\b/i; // the owner gate
const WORD_RE = /\bbasic(s|ally)?\b/i;
/** { ok, hits }: each line of text that names a vendor or uses the forbidden word. */
function leakCheck(text) {
  const hits = String(text || '')
    .split('\n')
    .filter((l) => VENDORS.test(l) || VENDOR_RE.test(l) || WORD_RE.test(l))
    .map((l) => l.trim().slice(0, 160));
  return { ok: hits.length === 0, hits };
}

/** One PASS or FAIL line per check, prefixed with the part's name. */
function reporter(prefix) {
  const results = [];
  const check = (name, ok, info) => {
    results.push({ name, ok: !!ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${prefix ? prefix + ' ' : ''}${name}${info !== undefined && !ok ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 1500) : ''}`);
  };
  return { check, results, failed: () => results.filter((r) => !r.ok).length };
}

/**
 * The gate rules for a phase-6 check. parts: { name: async (ctx) => {} } where ctx = { check, S }; opts: { name: the
 * check's NAME, unit: 'parts' | 'cases' | 'checks', flag: '--only' | '--case', browser: true to start the check browser }.
 * An unknown name in the flag, or a run with no part, prints FAIL and exits 1. A missing vendor file prints NOT RUN and
 * exits 2. The last line is "<NAME>: PASS (<unit> run: N)" or "<NAME>: FAIL (<unit> run: N) - <failed parts>".
 */
async function runParts(parts, opts) {
  const NAME = opts.name;
  const unit = opts.unit || 'parts';
  const flag = opts.flag || '--only';
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  const all = Object.keys(parts);
  let names = all;
  if (i >= 0) {
    names = String(argv[i + 1] || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const unknown = names.filter((n) => all.indexOf(n) < 0);
    if (unknown.length) {
      console.log(`FAIL unknown ${flag.replace(/^--/, '')} name: ${unknown.join(', ')} (known: ${all.join(', ')})`);
      console.log(`${NAME}: FAIL (${unit} run: 0) - unknown: ${unknown.join(', ')}`);
      process.exit(1);
    }
  }
  if (!names.length) {
    console.log(`FAIL no ${unit} to run`);
    console.log(`${NAME}: FAIL (${unit} run: 0) - none`);
    process.exit(1);
  }
  let S = null;
  if (opts.browser) {
    const miss = missingVendor();
    if (miss) {
      console.log(`NOT RUN: the vendor file ${miss} is missing`);
      process.exit(2);
    }
    S = await start();
  }
  const failed = [];
  let ran = 0;
  for (const n of names) {
    const R = reporter(n);
    ran++;
    try {
      await parts[n]({ check: R.check, S });
    } catch (e) {
      R.check('ran to the end', false, String(e && e.stack ? e.stack : e));
    }
    if (R.failed() || !R.results.length) failed.push(n);
  }
  if (S) await S.stop();
  console.log(failed.length ? `${NAME}: FAIL (${unit} run: ${ran}) - ${failed.join(', ')}` : `${NAME}: PASS (${unit} run: ${ran})`);
  process.exit(failed.length ? 1 : 0);
}

module.exports = { ROOT, SCRATCH, VENDOR, OUT, missingVendor, serve, start, open, setupPortal, createInvitation, sandbox, heading, submit, fieldErrors, walk, screenText, leakCheck, reporter, runParts, VENDORS, VENDOR_RE, WORD_RE };
