// Helpers for the signed-record check (test-only code): a fresh self-serve portal with a sample firm, an offering with a
// subscription agreement, one invited investor walked through onboarding to the signed agreement, then the countersignature.
// Serve the repository root first:  python3 -m http.server 8947
// The app loads its PDF reader and writer from a CDN; where the network is closed, point VENDOR_DIR at local npm copies
// (pdfjs/package/build, pdflib/package/dist) and FONT_DIR at local copies of the web fonts.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = process.env.PORT || '8947';
const ORIGIN = `http://localhost:${PORT}`;
const BASE = `${ORIGIN}/diy.html`;
const SCRATCH = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad';
const VENDOR = process.env.VENDOR_DIR || path.join(SCRATCH, 'vendor');
const FONT_DIR = process.env.FONT_DIR || path.join(SCRATCH, 'esign', 'inv', 'fonts');
const OUT = process.env.OUT_DIR || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
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

/** Send the CDN requests to local copies when they exist; anything else outside this server is refused. */
async function routeAll(context) {
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN + '/') || u.startsWith('blob:') || u.startsWith('data:')) return route.continue();
    const m = u.match(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(.+)$/);
    if (m && LOCAL[m[1]] && fs.existsSync(LOCAL[m[1]])) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(LOCAL[m[1]]) });
    if (/^https:\/\/fonts\.googleapis\.com\//.test(u)) {
      const css = path.join(FONT_DIR, 'fonts.css');
      return route.fulfill({ status: 200, contentType: 'text/css', body: fs.existsSync(css) ? fs.readFileSync(css, 'utf8') : '' });
    }
    const g = u.match(/^https:\/\/fonts\.gstatic\.com\/(.+)$/);
    if (g) {
      const f = path.join(FONT_DIR, g[1].replace(/\//g, '_'));
      return fs.existsSync(f) ? route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) }) : route.abort();
    }
    const jd = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(.+)$/);
    if (jd && JSDELIVR[jd[1]] && fs.existsSync(JSDELIVR[jd[1]].file)) return route.fulfill({ status: 200, contentType: JSDELIVR[jd[1]].type, headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(JSDELIVR[jd[1]].file) });
    return route.abort();
  });
}

async function open(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true }, opts.context || {}));
  await routeAll(context);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push('console: ' + m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e && e.stack ? e.stack : e)));
  return { context, page, errors };
}

const AGREEMENT_HTML = `<html><head><style>
  @page { margin: 0 } body { margin: 0; font: 13px Helvetica, Arial, sans-serif; color: #111 }
  .pg { position: relative; width: 8.5in; height: 11in; box-sizing: border-box; padding: 0.8in; page-break-after: always; overflow: hidden }
  .pg:last-child { page-break-after: auto }
  h1 { font-size: 22px; margin: 0 0 12px } p { line-height: 1.5; margin: 0 0 10px; max-width: 6.4in }
  .foot { position: absolute; left: 0.8in; right: 0.8in; bottom: 0.4in; font-size: 10px; color: #555; border-top: 1px solid #999; padding-top: 4px }
</style></head><body>
<div class="pg"><h1>Subscription Agreement</h1>
<p>This Subscription Agreement (the "Agreement") is entered into by the undersigned investor in connection with an interest in the Fund. Page one of two.</p>
<p>The investor represents that the information provided is complete and accurate and agrees to the terms of the limited partnership agreement.</p>
<div class="foot">Page 1 of 2</div></div>
<div class="pg"><h1>Terms and conditions</h1>
<p>Page two of two. The investor acknowledges receipt of the private placement memorandum and understands the risks of the investment.</p>
<div class="foot">Page 2 of 2</div></div>
</body></html>`;

/** A two-page agreement made with the browser's own print-to-PDF. */
async function agreementPdf(context) {
  const gen = await context.newPage();
  await gen.setContent(AGREEMENT_HTML);
  const buf = await gen.pdf({ format: 'Letter', printBackground: true });
  await gen.close();
  return buf.toString('base64');
}

/** The template fields: fractions of the page, as the portal stores them. */
const FIELDS = [
  { id: 'tf1', signerRole: 'Investor', type: 'text', page: 1, x: 0.12, y: 0.55, w: 0.3, h: 0.03, required: true, label: 'Commitment', value: '' },
  { id: 'tf2', signerRole: 'Investor', type: 'text', page: 1, x: 0.5, y: 0.55, w: 0.36, h: 0.03, required: true, label: 'Investor name', value: '' },
  { id: 'tf3', signerRole: 'Investor', type: 'signature', page: 1, x: 0.12, y: 0.7, w: 0.3, h: 0.055, required: true, label: '', value: '' },
  { id: 'tf4', signerRole: 'Investor', type: 'date', page: 1, x: 0.5, y: 0.72, w: 0.18, h: 0.025, required: false, label: '', value: '' },
  { id: 'tf5', signerRole: 'Sponsor', type: 'signature', page: 2, x: 0.12, y: 0.7, w: 0.3, h: 0.055, required: true, label: '', value: '' }
];

/** A fresh self-serve browser with the Kestrel Bay sample portal, a Rule 506(c) raising offering and its subscription agreement. */
async function setupPortal(page, context) {
  await page.goto(BASE);
  await page.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await page.goto(BASE);
  await page.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]');
  await page.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await page.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay');
  const b64 = await agreementPdf(context);
  return page.evaluate(
    async ({ b64, fields }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      let o = ws.offerings.find((x) => x.status === 'Raising');
      if (!o) {
        o = ws.offerings[0];
        o.status = 'Raising';
      }
      o.structure = Object.assign({}, o.structure, { exemption: 'Rule 506(c)' });
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
      ws.esignTemplates.push({ id: 'tpl-sub-test', title: 'Subscription Agreement', fileName: 'Subscription_Agreement.pdf', docId: 'tpl-doc-test', pages: 2, pageSizes: [{ w: 612, h: 792 }, { w: 612, h: 792 }], sha256: NS.audit.sha256(u8), roles: ['Investor', 'Sponsor'], message: 'Please sign your subscription agreement.', subscription: true, offeringId: o.id, createdAt: new Date().toISOString(), fields });
      NS.app.save(true);
      return { offeringId: o.id, offeringName: o.name, firm: ws.tenant.name };
    },
    { b64, fields: FIELDS }
  );
}

async function createInvitation(page, o) {
  return page.evaluate((o) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const r = NS.invitations.create(ws, { name: o.name, email: o.email, type: 'individual', account: '', offeringId: o.offeringId, cents: o.cents, cls: '', note: '' });
    const it = r.invitation;
    if (!it.token) {
      const b = new Uint8Array(32);
      crypto.getRandomValues(b);
      it.token = btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    it.status = 'sent';
    NS.app.save(true);
    return { token: it.token, invitationId: it.id, investorId: r.investor.id };
  }, o);
}

const heading = (page) => page.locator('.ivf-form h1').first().innerText().catch(() => '');
const submit = async (page) => {
  await page.click('.ivf-form .ob-actions button[type=submit]');
  await page.waitForFunction(() => !document.querySelector('.ivf-form button[type=submit][disabled]'), null, { timeout: 15000 });
  await page.waitForTimeout(150);
};
async function sandbox(page, kind, outcome) {
  await page.click(`[data-action=iv-start][data-kind=${kind}] >> nth=0`);
  await page.waitForSelector('#dlg[open] [data-action=iv-sandbox-finish]');
  await page.check(`input[name="iv-outcome"][value="${outcome}"]`);
  await page.click('[data-action=iv-sandbox-finish]');
  await page.waitForFunction((k) => { const c = document.querySelector(`#iv-${k} .iv-chip`); return c && !/Not started|Submitted/.test(c.textContent); }, kind, { timeout: 10000 });
}
/** Adopt a signature for the field and finish (the dialog's default style is accepted as offered). */
async function signField(page, fid) {
  await page.locator(`.es-doc-sign [data-fid="${fid}"]`).scrollIntoViewIfNeeded();
  await page.click(`.es-doc-sign [data-fid="${fid}"]`);
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById('dlg').open)) {
    await page.click('[data-action="es-adopt"]');
    await page.waitForFunction(() => !document.getElementById('dlg').open);
  }
}

/** Walk the investor's onboarding to the signed agreement. Returns the steps seen. */
async function walk(page, o) {
  const seen = [];
  for (let guard = 0; guard < 20; guard++) {
    await page.waitForSelector('.ivf-form h1', { timeout: 20000 });
    const hd = await heading(page);
    if (seen.length && seen[seen.length - 1] === hd) {
      seen.push('STUCK: ' + (await page.locator('.field-error').allInnerTexts()).join(' / '));
      break;
    }
    seen.push(hd);
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
      await page.fill('#ob-dob', '1980-04-02');
      await page.fill('#ob-tin', '123456789');
      await page.check('input[name="ob-pep"][value="no"]');
    } else if (/Identity verification/.test(hd)) {
      await sandbox(page, 'identity', 'passed');
    } else if (/Accredit/.test(hd)) {
      if (await page.locator('[data-action=iv-start][data-kind=accreditation]').count()) await sandbox(page, 'accreditation', 'verified');
      else await page.check('input[name="ob-accBasis"] >> nth=0');
      await page.check('#ob-accAttest');
    } else if (/Tax certification/.test(hd)) {
      if (await page.locator('input[name="ob-usPerson"]').count()) await page.check('input[name="ob-usPerson"][value="yes"]');
      await page.check('#ob-w9');
      await page.fill('#ob-taxSig', o.name);
    } else if (/Distribution payments/.test(hd)) {
      if (await page.locator('#ob-routing').count()) {
        await page.fill('#ob-routing', '021000021');
        await page.fill('#ob-account', '123456789');
        await page.fill('#ob-account2', '123456789');
        await page.check('#ob-achAuth');
      }
    } else if (/^Subscription$/.test(hd)) {
      if (await page.locator('#ob-amount:not([readonly])').count()) await page.fill('#ob-amount', String(o.amount || 100000));
      if (await page.locator('#ob-subAcc').count()) {
        await page.check('#ob-subAcc');
        await page.check('#ob-subDocs');
      }
      if (await page.locator('#ob-subSig').count()) {
        await page.check('#ob-subEsign');
        await page.fill('#ob-subSig', o.name);
      }
    } else if (/Subscription agreement/.test(hd)) {
      await page.waitForSelector('.es-doc-sign .es-page img', { timeout: 20000 });
      const fid = await page.evaluate(() => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const inv = ws.investors.find((i) => i.id === NS.state.ui.ob.invId);
        const req = ws.requests.find((r) => r.id === inv.onboarding.flow.requestId);
        const env = ws.envelopes.find((e) => e.id === req.envelopeId);
        const s = env.signers.find((x) => x.investorId === inv.id);
        return env.fields.find((f) => f.signerId === s.id && f.type === 'signature').id;
      });
      await signField(page, fid);
      await page.click('.es-finish');
      await page.waitForSelector('.ivf-done', { timeout: 30000 });
      continue;
    } else if (/all set|paperwork is complete|Finishing/.test(hd)) {
      await page.waitForSelector('.ivf-done', { timeout: 30000 });
      break;
    } else break;
    await submit(page);
  }
  return { seen, done: !!(await page.locator('.ivf-done').count()) };
}

/** The sponsor countersigns the envelope from the console. */
async function countersign(page, envId) {
  await page.evaluate((x) => (location.hash = x), 'console-envelope-' + envId);
  await page.waitForSelector('[data-action=es-sign-as]');
  await page.click('[data-action=es-sign-as]');
  await page.waitForTimeout(300);
  if (await page.locator('#es-consent-box').count()) {
    await page.check('#es-consent-box');
    await page.click('[data-action="es-consent"]');
  }
  await page.waitForSelector('.es-doc-sign .es-page img', { timeout: 20000 });
  const fid = await page.evaluate((eid) => {
    const env = window.CVPortal.state.ws.envelopes.find((e) => e.id === eid);
    const s = env.signers.find((x) => x.role === 'countersigner');
    return env.fields.find((f) => f.signerId === s.id && f.type === 'signature').id;
  }, envId);
  await signField(page, fid);
  await page.click('.es-finish');
  await page.waitForFunction((eid) => window.CVPortal.state.ws.envelopes.find((e) => e.id === eid).status === 'completed', envId, { timeout: 30000 });
  await page.waitForTimeout(400);
}

module.exports = { chromium, PORT, ORIGIN, BASE, OUT, VENDOR, LOCAL, FIELDS, open, setupPortal, createInvitation, walk, countersign, signField };
