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

/*
 * The owner's screenshot set (plan 06-07): every full-page screenshot a check takes on a page opened here is also copied to
 * OWNER_SHOTS as <check>__<part>__<name>.png, and index.txt there names each shot, its part and what it shows, failed parts
 * first. Each check describes its shots with describeShots([[name or regex, text], ...]).
 */
const OWNER_SHOTS = process.env.P6_SHOTS || path.join(SCRATCH, 'exec-06-07', 'shots');
const shotRun = { check: '', slug: '', part: '', taken: {}, info: [] };
function describeShots(list) {
  list.forEach((x) => shotRun.info.push(x));
}
function shotWhat(name) {
  const hit = shotRun.info.find(([k]) => (k instanceof RegExp ? k.test(name) : k === name));
  return hit ? hit[1] : 'Screen as the check left it (no description given).';
}
function ownerShot(file) {
  if (!shotRun.slug || !shotRun.part || !file) return;
  fs.mkdirSync(OWNER_SHOTS, { recursive: true });
  const name = path.basename(String(file));
  const dest = `${shotRun.slug}__${shotRun.part}__${name}`;
  fs.copyFileSync(file, path.join(OWNER_SHOTS, dest));
  const list = (shotRun.taken[shotRun.part] = shotRun.taken[shotRun.part] || []);
  const was = list.findIndex((x) => x.file === dest);
  const row = { file: dest, what: shotWhat(name) };
  if (was >= 0) list[was] = row;
  else list.push(row);
}
/** Record this run's parts (merged with earlier runs of other parts of the same check) and write index.txt from every check. */
function writeShotIndex(results) {
  if (!shotRun.slug) return;
  fs.mkdirSync(OWNER_SHOTS, { recursive: true });
  const rec = path.join(OWNER_SHOTS, `parts-${shotRun.slug}.json`);
  let parts = {};
  try {
    parts = JSON.parse(fs.readFileSync(rec, 'utf8')).parts || {};
  } catch (e) {
    parts = {};
  }
  results.forEach((r) => (parts[r.part] = { ok: r.ok, failed: r.failed, shots: shotRun.taken[r.part] || [], at: new Date().toISOString() }));
  fs.writeFileSync(rec, JSON.stringify({ check: shotRun.check, parts }, null, 1));
  const all = fs
    .readdirSync(OWNER_SHOTS)
    .filter((f) => /^parts-.*\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(OWNER_SHOTS, f), 'utf8')));
  const rows = [];
  all.forEach((c) => Object.keys(c.parts).forEach((k) => rows.push(Object.assign({ check: c.check, part: k }, c.parts[k]))));
  const block = (r) => [`${r.check}, part ${r.part}: ${r.ok ? 'PASS' : `FAIL (${r.failed.length} check${r.failed.length === 1 ? '' : 's'} failed)`}, run ${r.at}`]
    .concat(r.ok ? [] : r.failed.map((f) => `  FAILED: ${f}`))
    .concat(r.shots.length ? r.shots.map((x) => `  ${x.file}\n      ${x.what}`) : ['  (no screenshot in this part)'])
    .join('\n');
  const bad = rows.filter((r) => !r.ok);
  const good = rows.filter((r) => r.ok);
  const n = rows.reduce((t, r) => t + r.shots.length, 0);
  const text = [
    'Investor status answers: the owner\'s screenshot set (phase 6, plan 06-07)',
    `Folder: ${OWNER_SHOTS}`,
    `${n} screenshots from ${rows.length} parts; the latest run of each part. Failed parts first.`,
    '',
    'FAILED PARTS',
    bad.length ? bad.map(block).join('\n\n') : '(none)',
    '',
    'PASSED PARTS',
    good.map(block).join('\n\n'),
    ''
  ].join('\n');
  fs.writeFileSync(path.join(OWNER_SHOTS, 'index.txt'), text);
}

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

/**
 * A fresh browser context on the check server: CDN and fonts answered locally, anything else outside refused.
 * opts.allow: more origins this context may reach (plan 06-06: the in-process integration server); opts.init: a script
 * run before every page's own scripts (window.CVPortalConfig, as the firm sets it where the portal is published).
 */
async function open(S, opts) {
  opts = opts || {};
  const context = await S.browser.newContext(Object.assign({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }, opts.context || {}));
  if (opts.init) await context.addInitScript(opts.init);
  const allow = (opts.allow || []).map((x) => String(x).replace(/\/+$/, '') + '/');
  const net = { external: [], allowed: [] };
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(S.origin + '/') || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    if (allow.some((a) => u.startsWith(a))) {
      net.allowed.push(`${route.request().method()} ${u.replace(/[?#].*$/, '')}`);
      return route.continue();
    }
    const m = u.match(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(.+)$/);
    if (m && LOCAL[m[1]]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(LOCAL[m[1]]) });
    const jd = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(.+)$/);
    if (jd && JSDELIVR[jd[1]]) return route.fulfill({ status: 200, contentType: JSDELIVR[jd[1]].type, headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(JSDELIVR[jd[1]].file) });
    if (/^https:\/\/fonts\.googleapis\.com\//.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    net.external.push(u);
    return route.abort();
  });
  const page = await context.newPage();
  const shoot = page.screenshot.bind(page);
  page.screenshot = async (o) => {
    const out = await shoot(o);
    if (o && o.path) ownerShot(o.path);
    return out;
  };
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
// Only messages: the signing dialog leaves an empty role="alert" paragraph (signature.js #es-adopt-err) in the page once a
// signature was adopted (plan 06-21 found it); an empty one holds no message (plan 06-22: a signed W-9 in a walk).
const fieldErrors = (page) =>
  page
    .locator('.field-error')
    .allInnerTexts()
    .then((a) => a.filter((t) => String(t).trim()))
    .catch(() => []);

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
    // a.until: stop on the first step whose heading matches (the caller works that step itself, then may walk on).
    if (a.until && a.until.test(hd)) return { seen, reached: true, at: hd, errors: errs };
    if (a.onStep) await a.onStep(hd);
    if (/^Welcome/.test(hd)) {
      await page.check('#ob-esignConsent');
      if (await page.locator('#ob-edelivery').count()) await page.check('#ob-edelivery');
    } else if (/Create your login/.test(hd)) {
      await page.fill('#ob-password', 'investor-pass-123');
      await page.fill('#ob-password2', 'investor-pass-123');
    } else if (/Investor information/.test(hd)) {
      // a.profile: other answers for this screen (plan 06-24's owner set: answers no earlier check used)
      const pf = a.profile || {};
      await page.fill('#ob-street', pf.street || '12 Elm Street');
      await page.fill('#ob-city', pf.city || 'Austin');
      await page.fill('#ob-st', pf.st || 'TX');
      await page.fill('#ob-zip', pf.zip || '78701');
      await page.fill('#ob-phone', pf.phone || '+1 512 555 0101');
      // A person's account asks for the date of birth; an IRA, trust or entity asks for its custodian or place of formation.
      if (await page.locator('#ob-dob').count()) await page.fill('#ob-dob', pf.dob || '1980-04-02');
      if ((await page.locator('#ob-formation').count()) && !(await page.inputValue('#ob-formation'))) await page.fill('#ob-formation', pf.formation || 'Harbor Trust Company');
      // a.tin: the taxpayer ID typed here (plan 06-23 searches the device for one no other answer contains)
      await page.fill('#ob-tin', a.tin || '123456789');
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
        // Plan 06-15 (D-08 (2)): one question, alone / with a purchaser representative / no (a.soph; a.rep 'yes' reads as
        // 'rep' and 'no' as 'alone'). An older tree asks experience, education and a yes or no on the representative (above).
        const soph = a.soph || (a.rep === 'yes' ? 'rep' : a.rep === 'no' ? 'alone' : '');
        if (soph && (await page.locator('input[name="ob-stSoph"]').count())) {
          await page.check(`input[name="ob-stSoph"][value="${soph}"]`);
          await page.waitForTimeout(150);
        }
        if (a.rep === 'yes' || soph === 'rep') {
          if (a.repName != null) await page.fill('#ob-stRepName', a.repName);
          if (a.repFirm != null && (await page.locator('#ob-stRepFirm').count())) await page.fill('#ob-stRepFirm', a.repFirm);
        }
      }
    } else if (/Accredit/.test(hd)) {
      if (await page.locator('[data-action=iv-start][data-kind=accreditation]').count()) await sandbox(page, 'accreditation', 'verified');
      else await page.check('input[name="ob-accBasis"] >> nth=0');
      await page.check('#ob-accAttest');
    } else if (/Tax certification/.test(hd)) {
      if (await page.locator('#ob-w9').count()) {
        // An older tree: the typed substitute certification.
        if (await page.locator('input[name="ob-usPerson"]').count()) await page.check('input[name="ob-usPerson"][value="yes"]');
        await page.check('#ob-w9');
        await page.fill('#ob-taxSig', a.name);
      } else {
        // Plan 06-16: the answers view continued as it stands, then the official form finished without a signature (D-30),
        // or signed first when a.taxSign(page) is given (plan 06-22); a.taxStep(page) works the whole step itself and moves
        // on (plan 06-23: an upload instead of the form).
        if (a.onFilled) await a.onFilled(hd);
        if (a.taxStep) {
          await a.taxStep(page);
          continue;
        }
        await submit(page);
        await finishTaxForm(page, a.taxSign);
        continue;
      }
    } else if (/Distribution payments/.test(hd)) {
      if (await page.locator('#ob-routing').count()) {
        await page.fill('#ob-routing', '131000021');
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

/**
 * Plan 06-16: the tax step's signing view (the official form, embedded) finished as it stands, then the wait until the
 * heading changes (both tax views share it). sign(page) may sign first.
 */
async function finishTaxForm(page, sign) {
  await page.waitForSelector('.ivf-tax-sign .es-finish', { timeout: 60000 });
  if (sign) await sign(page);
  const before = await heading(page);
  await page.click('.ivf-tax-sign .es-finish');
  await page.waitForFunction((hd) => {
    const h = document.querySelector('.ivf-form h1');
    return h && h.innerText !== hd;
  }, before, { timeout: 60000 });
  await page.waitForTimeout(200);
}

/* ---------- Server mode (plan 06-06; reused by plans 06-07 and 06-12) ---------- */

/** A free local port (the integration server needs its own address before it starts: PUBLIC_URL goes into every link). */
function freePort() {
  return new Promise((resolve, reject) => {
    const s = require('net').createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

/**
 * The firm's integration server, the real code (server/index.mjs) in this process: its own free port, NODE_ENV test, a store
 * file in a temporary folder, a random API token, PORTAL_ORIGIN = the check's static origin (so the server takes the
 * console's and the investor's calls from there and builds links to that page only), PUBLIC_URL = its own address.
 * Returns { base, token, server, init, configure(page), call(method, path, body), rows(), submission(id), alter(id, fn),
 * waitCompleted(id), close() }. init is the script that lists the server in window.CVPortalConfig.integrationServers, as
 * the firm does where it publishes the portal, so an investor's page on another device trusts its ?server= link.
 */
async function serverPortal(S, extraEnv) {
  const { pathToFileURL } = require('url');
  const crypto = require('crypto');
  const { createServer } = await import(pathToFileURL(path.join(ROOT, 'server/index.mjs')).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p6-server-'));
  const token = crypto.randomBytes(24).toString('hex');
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const env = Object.assign({ NODE_ENV: 'test', STORE_FILE: path.join(dir, 'store.json'), API_TOKEN: token, PORTAL_ORIGIN: S.origin, PUBLIC_URL: base }, extraEnv || {});
  const server = createServer({ env });
  await new Promise((r, j) => {
    server.once('error', j);
    server.listen(port, '127.0.0.1', r);
  });
  const call = async (method, p, body) => {
    const res = await fetch(base + p, { method, headers: Object.assign({ Authorization: `Bearer ${token}` }, body !== undefined ? { 'Content-Type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    return { status: res.status, body: data };
  };
  // The console lists its own workspace's invitations (the sample portal's tenant id unless told otherwise).
  const rows = async (workspace) => {
    const r = await call('GET', '/v1/invitations?workspace=' + encodeURIComponent(workspace || 'kestrel-bay'));
    return Array.isArray(r.body) ? r.body : (r.body && r.body.invitations) || [];
  };
  return {
    base,
    token,
    server,
    init: `window.CVPortalConfig = Object.assign({}, window.CVPortalConfig || {}, { integrationServers: [${JSON.stringify(base)}] });`,
    /** The console uses this server: the address and token on its Integrations settings (what invitations.js serverOn reads). */
    configure: (page) =>
      page.evaluate(
        ({ base, token }) => {
          const NS = window.CVPortal;
          const ws = NS.state.ws;
          const s = NS.integrations.ensure(ws).server;
          s.url = base;
          s.token = token;
          NS.app.save(true);
          return NS.invitations.serverOn(ws);
        },
        { base, token }
      ),
    call,
    rows,
    /** What the server holds for the console to import (GET /v1/invitations/:id/submission), as the console would read it. */
    submission: async (id) => (await call('GET', `/v1/invitations/${encodeURIComponent(id)}/submission`)).body,
    /** Change the stored submission in place (no DATA_KEY in this run: the store holds it as { plain }); a tampering check. */
    alter(id, fn) {
      const rec = server.store.get('invitations', id);
      if (!rec || !rec.submission || !rec.submission.plain) throw new Error('no stored submission to alter for ' + id);
      const sub = JSON.parse(JSON.stringify(rec.submission.plain));
      fn(sub);
      server.store.put('invitations', { id, submission: { plain: sub } });
      return sub;
    },
    /** Wait until the server has the investor's completed submission for this invitation; resolves to its row. */
    async waitCompleted(id, ms) {
      const until = Date.now() + (ms || 30000);
      for (;;) {
        const row = (await rows()).find((x) => x.id === id);
        if (row && row.status === 'completed' && row.hasSubmission) return row;
        if (Date.now() > until) throw new Error('the server has no completed submission for ' + id + ': ' + JSON.stringify(row || null).slice(0, 400));
        await new Promise((r) => setTimeout(r, 300));
      }
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

/** A console route as a firm admin (the demo role control, when the page shows one), waiting for the selector. */
async function consoleRoute(page, hash, sel) {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(400);
  if (await page.locator('#demo-role').count()) {
    await page.selectOption('#demo-role', 'admin');
    await page.waitForTimeout(400);
    await page.evaluate((h) => (location.hash = h), hash);
  }
  await page.waitForSelector(sel || '.cs-panel-head h2', { timeout: 20000 });
  await page.waitForTimeout(300);
}

/**
 * The sponsor invites an investor with the console's own form on the Investors page (the real send path: invitations.js
 * submitInvite, then send, which posts the snapshot to the integration server). Resolves to the invitation record once the
 * server has answered: { id, serverId, link, investorId, emailStatus, emailError }.
 */
async function inviteFromConsole(page, o) {
  await consoleRoute(page, 'console-investors', '[data-action=invite-toggle]');
  if ((await page.locator('#iv-email').count()) === 0) await page.click('[data-action=invite-toggle]');
  await page.waitForSelector('#iv-email', { timeout: 10000 });
  await page.fill('#iv-contact', o.first);
  await page.fill('#iv-last', o.last);
  await page.fill('#iv-email', o.email);
  if (!(await page.locator('#iv-more[open]').count())) await page.click('#iv-more summary');
  await page.selectOption('#iv-off', o.offeringId);
  await page.waitForTimeout(300);
  // Plan 06-29: "Investor type" is hidden for an investor on file's email (their record's type applies).
  if (o.type && (await page.locator('#iv-type').isVisible())) await page.selectOption('#iv-type', o.type);
  if (o.account) await page.fill('#iv-title', o.account);
  if (o.amount) await page.fill('#iv-amt', String(o.amount));
  // Plan 06-27 (D-10): "Include tax form" for an investor on file (a tree without the box leaves the invitation as it is)
  if (o.includeTax && (await page.locator('#iv-includeTax').count())) await page.check('#iv-includeTax');
  await page.click('.inv8-form[data-form="invite-one"] button[type=submit]');
  await page.waitForFunction((email) => {
    const ws = window.CVPortal.state.ws;
    const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
    const it = inv && (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
    return !!(it && (it.serverId || it.emailStatus === 'failed' || it.emailStatus === 'manual'));
  }, o.email, { timeout: 30000 });
  return page.evaluate((email) => {
    const ws = window.CVPortal.state.ws;
    const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
    const it = (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
    return { id: it.id, serverId: it.serverId || '', link: it.link || '', token: it.token || '', investorId: inv.id, emailStatus: it.emailStatus, emailError: it.emailError || '' };
  }, o.email);
}

/** The console imports what the server holds with its own "Check now" button; resolves once the invitation is imported. */
async function importFromConsole(page, invitationId) {
  await consoleRoute(page, 'console-investors', '[data-action=inv8-check]');
  await page.click('[data-action=inv8-check]');
  await page.waitForFunction((id) => {
    const it = (window.CVPortal.state.ws.invitations || []).find((x) => x.id === id);
    return !!(it && it.importedAt);
  }, invitationId, { timeout: 30000 });
  await page.waitForTimeout(300);
}

/** The agreement on screen: Finish (D-30: nothing on it is required), then the done screen's text (plan 06-15: no summary list; an older tree has one). */
async function finishAgreement(page) {
  await page.waitForSelector('.es-finish', { timeout: 30000 });
  await page.click('.es-finish');
  await page.waitForSelector('.ivf-done .ivf-need, .ivf-done .ivf-summary', { timeout: 30000 });
  await page.waitForTimeout(300);
  return page.locator('.ivf-done').innerText();
}

/** Everything the page shows as text. */
const screenText = (page) => page.evaluate(() => document.body.innerText);

// White label (D-30): no provider, model, vendor or library name, and no form of the forbidden word.
const VENDORS = /pdf-lib|pdf\.js|Carrow|\bVale\b|DocuSign|SignNow|Adobe|HelloSign|Dropbox|PandaDoc|Powered by/i; // phase 5 record-check.js
const VENDOR_RE = /onnx|onnxruntime|microsoft|pytorch|torch|scikit|sklearn|anthropic|claude|\bopus\b|\bsonnet\b|\bhaiku\b/i; // the owner gate
const WORD_RE = /\bbasic(s|ally)?\b/i;
/*
 * The random token parts of links, taken out before the vendor regexes run, so a vendor word a random token holds by
 * chance ("...iRoNnXN...") is not reported as a leak. Every other character stays, the link's host and path words
 * included. Taken out, each replaced with "~": the token or path segment after an invite or sign-in link prefix
 * (#invite-, #room-, #taxdoc-, /invite/, /signin/); the values of token=, t=, sig=, signature= (also after "&amp;");
 * after the host, any run of 16+ base64url characters mixing capitals, small letters and digits, as a random token
 * does. The same rules as stripLinkTokens in server/test/helpers.mjs; keep the two the same.
 */
const LINK_RE = /\bhttps?:\/\/[^\s"'<>()]+/gi;
const PREFIX_TOKEN_RE = /([#/](?:invite|sign-?in|room|taxdoc)[-/=])[A-Za-z0-9_-]+/gi;
const QUERY_TOKEN_RE = /([?&;#](?:token|t|sig|signature)=)[^&;#\s"'<>]*/gi;
const RANDOM_RUN_RE = /[A-Za-z0-9_-]{16,}/g;
function stripLinkTokens(text) {
  return String(text === undefined || text === null ? '' : text).replace(LINK_RE, (url) => {
    const start = url.indexOf('//') + 2;
    const at = url.slice(start).search(/[/?#]/);
    if (at < 0) return url; // only a host: all of it is scanned
    const cut = start + at;
    const rest = url
      .slice(cut)
      .replace(PREFIX_TOKEN_RE, '$1~')
      .replace(QUERY_TOKEN_RE, '$1~')
      .replace(RANDOM_RUN_RE, (run) => (/[A-Z]/.test(run) && /[a-z]/.test(run) && /\d/.test(run) ? '~' : run));
    return url.slice(0, cut) + rest;
  });
}
/** { ok, hits }: each line of text that names a vendor or uses the forbidden word (vendor names looked for with the
 *  links' random tokens taken out; the forbidden word over the text as it is). */
function leakCheck(text) {
  const hits = String(text || '')
    .split('\n')
    .filter((l) => VENDORS.test(stripLinkTokens(l)) || VENDOR_RE.test(stripLinkTokens(l)) || WORD_RE.test(l))
    .map((l) => l.trim().slice(0, 160));
  return { ok: hits.length === 0, hits };
}

/** One PASS or FAIL line per check, prefixed with the part's name. */
function reporter(prefix) {
  const results = [];
  const check = (name, ok, info) => {
    const line = `${ok ? 'PASS' : 'FAIL'} ${prefix ? prefix + ' ' : ''}${name}${info !== undefined && !ok ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 1500) : ''}`;
    results.push({ name, ok: !!ok, line });
    console.log(line);
  };
  return { check, results, failed: () => results.filter((r) => !r.ok).length };
}

/*
 * Part-level resume (a container restart mid-check loses no finished part). Each part's PASS/FAIL lines are written,
 * the moment the part ends, to OUT/.parts/<check>-<checkout hash>/<part>.json (temporary name, then renamed), stamped
 * with the key it ran under: the checkout's folder, HEAD, the hash of "git status --porcelain" + "git diff HEAD" + the
 * untracked files (.planning/checks/gate-key.sh, shared with the gates), the check file's own hash and its command line
 * (without the part selection, which does not change what a part does; parts are independent, as --only requires).
 * A rerun into the same OUT prints "KEPT <part> (from <time>)" and the part's stored lines instead of running a part
 * that passed under exactly the same key; it still counts in "(<unit> run: N)". A failed part, or any difference in the
 * key, runs again. GATE_FRESH=1 runs every part. Nothing is kept for a tree without a key (a base tree made by git
 * archive) or when the tree changed while the part ran.
 */
function partKeyBase(flag) {
  const crypto = require('crypto');
  const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
  let tree = '';
  const treeKey = () => {
    try {
      return require('child_process')
        .execFileSync('bash', [path.join(ROOT, '.planning/checks/gate-key.sh'), ROOT], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 })
        .trim();
    } catch (e) {
      return '';
    }
  };
  tree = treeKey();
  if (!tree) return null;
  const file = path.resolve(process.argv[1] || '');
  let fileHash = '';
  try {
    fileHash = sha(fs.readFileSync(file));
  } catch (e) {
    return null;
  }
  const argv = process.argv.slice(2);
  const cmd = [];
  for (let k = 0; k < argv.length; k++) {
    if (argv[k] === flag) {
      k++;
      continue;
    }
    cmd.push(argv[k]);
  }
  const dir = path.join(OUT, '.parts', `${path.basename(file, '.js').replace(/[^A-Za-z0-9._-]+/g, '_')}-${sha(ROOT).slice(0, 10)}`);
  return {
    tree,
    treeKey,
    dir,
    key: (part) => JSON.stringify({ tree, file, fileHash, cmd, part }),
    fileOf: (part) => path.join(dir, `${String(part).replace(/[^A-Za-z0-9._-]+/g, '_')}-${sha(part).slice(0, 8)}.json`)
  };
}
function keptPart(K, part) {
  if (!K || process.env.GATE_FRESH === '1') return null;
  try {
    const r = JSON.parse(fs.readFileSync(K.fileOf(part), 'utf8'));
    return r && r.key === K.key(part) && r.ok === true && Array.isArray(r.lines) && r.lines.length ? r : null;
  } catch (e) {
    return null;
  }
}
function savePart(K, part, ok, lines) {
  if (!K) return;
  try {
    if (K.treeKey() !== K.tree) {
      console.log(`NOTE the tree changed while part ${part} ran; its result is not kept for a rerun`);
      return;
    }
    fs.mkdirSync(K.dir, { recursive: true });
    const f = K.fileOf(part);
    const tmp = `${f}.part.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify({ key: K.key(part), part, ok, at: new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC'), lines }, null, 1));
    fs.renameSync(tmp, f);
  } catch (e) {
    console.log(`NOTE the result of part ${part} could not be saved: ${e && e.message}`);
  }
}

/**
 * The gate rules for a phase-6 check. parts: { name: async (ctx) => {} } where ctx = { check, S }; opts: { name: the
 * check's NAME, unit: 'parts' | 'cases' | 'checks', flag: '--only' | '--case', browser: true to start the check browser }.
 * An unknown name in the flag, or a run with no part, prints FAIL and exits 1. A missing vendor file prints NOT RUN and
 * exits 2. The last line is "<NAME>: PASS (<unit> run: N)" or "<NAME>: FAIL (<unit> run: N) - <failed parts>".
 * Parts that passed under the same key are kept (see partKeyBase); kept parts count as run.
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
  const K = partKeyBase(flag);
  const kept = {};
  names.forEach((n) => (kept[n] = keptPart(K, n)));
  let S = null;
  if (opts.browser && names.some((n) => !kept[n])) {
    const miss = missingVendor();
    if (miss) {
      console.log(`NOT RUN: the vendor file ${miss} is missing`);
      process.exit(2);
    }
    S = await start();
  }
  const failed = [];
  const summary = [];
  let ran = 0;
  shotRun.check = NAME;
  shotRun.slug = NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  for (const n of names) {
    ran++;
    if (kept[n]) {
      console.log(`KEPT ${n} (from ${kept[n].at})`);
      kept[n].lines.forEach((l) => console.log(l));
      continue;
    }
    const R = reporter(n);
    shotRun.part = n;
    shotRun.taken[n] = [];
    try {
      await parts[n]({ check: R.check, S });
    } catch (e) {
      R.check('ran to the end', false, String(e && e.stack ? e.stack : e));
    }
    if (R.failed() || !R.results.length) failed.push(n);
    summary.push({ part: n, ok: !(R.failed() || !R.results.length), failed: R.results.filter((r) => !r.ok).map((r) => r.name) });
    savePart(K, n, !(R.failed() || !R.results.length), R.results.map((r) => r.line));
  }
  shotRun.part = '';
  if (opts.browser) {
    try {
      writeShotIndex(summary);
    } catch (e) {
      console.log(`FAIL the owner's screenshot index could not be written: ${e && e.message}`);
      failed.push('(screenshot index)');
    }
  }
  if (S) await S.stop();
  console.log(failed.length ? `${NAME}: FAIL (${unit} run: ${ran}) - ${failed.join(', ')}` : `${NAME}: PASS (${unit} run: ${ran})`);
  process.exit(failed.length ? 1 : 0);
}

module.exports = { finishTaxForm, OWNER_SHOTS, describeShots, ROOT, SCRATCH, VENDOR, OUT, missingVendor, serve, start, open, setupPortal, createInvitation, sandbox, heading, submit, fieldErrors, walk, screenText, leakCheck, stripLinkTokens, reporter, runParts, VENDORS, VENDOR_RE, WORD_RE, freePort, serverPortal, consoleRoute, inviteFromConsole, importFromConsole, finishAgreement };
