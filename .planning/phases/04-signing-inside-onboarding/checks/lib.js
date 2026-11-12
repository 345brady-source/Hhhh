// Helpers for the Phase 4 checks (signing inside onboarding). Test-only code.
// Serve the repository root first:  python3 -m http.server 8791   (or set SIGN_PORT).
// The PDF libraries are served from local copies (VENDOR_DIR) because the sandbox blocks the CDN.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.SIGN_PORT || 8791);
const ORIGIN = `http://localhost:${PORT}`;
const BASE = `${ORIGIN}/diy.html`;
const SCRATCH = process.env.SIGN_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const VENDOR = process.env.VENDOR_DIR || path.join(SCRATCH, 'vendor');
const OUT = process.env.SIGN_OUT || path.join(SCRATCH, 'signflow');
const SHOTS = path.join(OUT, 'shots');
const FONTS = path.join(OUT, 'fonts');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(FONTS, { recursive: true });

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

/** A web font file or stylesheet, fetched once through the machine's proxy and kept in the scratch folder. */
function cached(url, ext) {
  const file = path.join(FONTS, Buffer.from(url).toString('base64url').slice(-120) + ext);
  if (!fs.existsSync(file)) {
    try {
      execFileSync('curl', ['-sS', '-m', '20', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', '-o', file, url], { stdio: 'ignore' });
    } catch (e) {
      return null;
    }
  }
  return fs.existsSync(file) && fs.statSync(file).size ? file : null;
}

async function routeAll(context) {
  const state = { external: [] };
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN + '/') || u.startsWith('blob:') || u.startsWith('data:')) return route.continue();
    const m = u.match(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(.+)$/);
    if (m && LOCAL[m[1]]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(LOCAL[m[1]]) });
    const jd = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(.+)$/);
    if (jd && JSDELIVR[jd[1]]) return route.fulfill({ status: 200, contentType: JSDELIVR[jd[1]].type, headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(JSDELIVR[jd[1]].file) });
    if (/^https:\/\/fonts\.googleapis\.com\//.test(u)) {
      const f = cached(u, '.css');
      return f ? route.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) }) : route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (/^https:\/\/fonts\.gstatic\.com\//.test(u)) {
      const f = cached(u, '.woff2');
      return f ? route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) }) : route.abort();
    }
    state.external.push(u);
    return route.abort();
  });
  return state;
}

async function open(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }, opts.context || {}));
  const net = await routeAll(context);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push('console: ' + m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e && e.stack ? e.stack : e)));
  return { context, page, errors, net };
}

/* ---------- The agreement used by the checks: three pages with blanks, initials, a checkbox and two signature blocks ---------- */
// Positions are in inches on a US Letter page (8.5 x 11), so the template's fields below can be placed exactly on the lines.
const line = (x, y, w) => `<i class="ln" style="left:${x}in;top:${y}in;width:${w}in"></i>`;
const lab = (x, y, t) => `<span class="lb" style="left:${x}in;top:${y}in">${t}</span>`;
const AGREEMENT_HTML = (fund) => `<html><head><style>
  @page { margin: 0 } body { margin: 0; font: 11.5px/1.5 Georgia, 'Times New Roman', serif; color: #111 }
  .pg { position: relative; width: 8.5in; height: 11in; box-sizing: border-box; padding: 1in 1in 0; page-break-after: always; overflow: hidden }
  .pg:last-child { page-break-after: auto }
  h1 { font-size: 17px; margin: 0 0 4px; text-align: center; letter-spacing: 0.02em } h2 { font-size: 12px; margin: 16px 0 4px }
  .sub { text-align: center; margin: 0 0 18px; color: #333 } p { margin: 0 0 8px; text-align: justify }
  .ln { position: absolute; height: 0; border-bottom: 1px solid #111 } .lb { position: absolute; font-size: 11px }
  .box { position: absolute; width: 0.17in; height: 0.17in; border: 1px solid #111; box-sizing: border-box }
  .foot { position: absolute; left: 1in; right: 1in; bottom: 0.45in; font-size: 9.5px; color: #444; border-top: 1px solid #999; padding-top: 4px; display: flex; justify-content: space-between }
</style></head><body>
<div class="pg"><h1>SUBSCRIPTION AGREEMENT</h1><p class="sub">${fund}</p>
<p>The undersigned (the "Subscriber") hereby subscribes for a limited partnership interest (the "Interest") in ${fund} (the "Fund") in the amount set out below, on the terms of the Fund's limited partnership agreement and its confidential private placement memorandum, each as amended from time to time.</p>
<h2>1. Subscription</h2>
<p>The Subscriber agrees to contribute capital to the Fund up to the amount of its commitment when called by the general partner on not less than ten business days' notice. The general partner may accept or reject this subscription in whole or in part in its sole discretion.</p>
<h2>2. Subscriber details</h2>
<p>The Subscriber provides the following details for the Fund's register of partners.</p>
${lab(1, 5.02, 'Commitment amount:')}${line(2.5, 5.2, 2.6)}
${lab(1, 5.52, 'Name of Subscriber:')}${line(2.5, 5.7, 4.2)}
${lab(1, 6.02, 'Mailing address:')}${line(2.5, 6.2, 4.2)}
<div style="position:absolute;left:1in;right:1in;top:6.7in"><h2>3. Payment</h2>
<p>Capital contributions are paid by wire transfer to the account named in each capital call notice. No amount is due on signing this Agreement.</p>
<p>Each page of this Agreement is initialled by the Subscriber where shown.</p></div>
${lab(5.75, 9.72, 'Initials:')}${line(6.35, 9.9, 0.95)}
<div class="foot"><span>${fund} · Subscription Agreement</span><span>Page 1 of 3</span></div></div>
<div class="pg"><h2 style="margin-top:0">4. Representations of the Subscriber</h2>
<p>The Subscriber represents and warrants to the Fund and its general partner that: (a) it is acquiring the Interest for its own account, for investment and not with a view to distribution; (b) it has received and read the memorandum and the partnership agreement; (c) it can bear the economic risk of the investment, including a complete loss; and (d) the information it has given to the Fund is complete and accurate.</p>
<h2>5. Investor status</h2>
<p>The Subscriber confirms each statement that applies by marking the box beside it.</p>
<i class="box" style="left:1in;top:3.6in"></i>${lab(1.3, 3.6, 'The Subscriber is an "accredited investor" as defined in Rule 501(a) of Regulation D.')}
<i class="box" style="left:1in;top:4.0in"></i>${lab(1.3, 4.0, 'The Subscriber asks to receive tax documents on paper as well as electronically.')}
<div style="position:absolute;left:1in;right:1in;top:4.6in"><h2>6. General</h2>
<p>This Agreement is governed by the laws of the State of Delaware. It may be signed in counterparts and delivered electronically, each of which is an original. The Subscriber may not assign this Agreement without the consent of the general partner.</p>
<p>The representations in this Agreement survive the acceptance of the subscription and are repeated on each date the Subscriber contributes capital.</p></div>
${lab(5.75, 9.72, 'Initials:')}${line(6.35, 9.9, 0.95)}
<div class="foot"><span>${fund} · Subscription Agreement</span><span>Page 2 of 3</span></div></div>
<div class="pg"><h2 style="margin-top:0">7. Signature</h2>
<p>The Subscriber has signed this Agreement on the date set out below.</p>
${lab(1, 2.4, 'SUBSCRIBER')}
${lab(1, 3.22, 'Signature:')}${line(1.9, 3.4, 3.2)}
${lab(1, 3.82, 'Name:')}${line(1.9, 4.0, 3.2)}
${lab(1, 4.32, 'Title (if signing for an entity):')}${line(3.3, 4.5, 2.4)}
${lab(1, 4.82, 'Date:')}${line(1.9, 5.0, 1.7)}
${lab(1, 6.2, 'ACCEPTED by the general partner of the Fund')}
${lab(1, 7.02, 'By:')}${line(1.9, 7.2, 3.2)}
${lab(1, 7.62, 'Name:')}${line(1.9, 7.8, 3.2)}
${lab(1, 8.12, 'Date:')}${line(1.9, 8.3, 1.7)}
<div class="foot"><span>${fund} · Subscription Agreement</span><span>Page 3 of 3</span></div></div>
</body></html>`;
// A field on a line: x, the line's y and width in inches; the box sits on the line, hIn tall.
const on = (id, role, type, page, x, y, w, hIn, extra) => Object.assign({ id, signerRole: role, type, page, x: x / 8.5, y: (y - hIn) / 11, w: w / 8.5, h: hIn / 11, required: false, label: '', value: '' }, extra || {});
const TEMPLATE_FIELDS = [
  on('tf-amt', 'Investor', 'text', 1, 2.5, 5.2, 2.6, 0.24, { required: true, label: 'Commitment amount' }),
  on('tf-inv', 'Investor', 'text', 1, 2.5, 5.7, 4.2, 0.24, { required: true, label: 'Investor name' }),
  on('tf-addr', 'Investor', 'text', 1, 2.5, 6.2, 4.2, 0.24, { required: true, label: 'Mailing address' }),
  on('tf-in1', 'Investor', 'initials', 1, 6.35, 9.9, 0.95, 0.4, { required: true }),
  { id: 'tf-acc', signerRole: 'Investor', type: 'checkbox', page: 2, x: 1 / 8.5, y: 3.6 / 11, w: 0.17 / 8.5, h: 0.17 / 11, required: true, label: 'Accredited investor', value: '' },
  { id: 'tf-paper', signerRole: 'Investor', type: 'checkbox', page: 2, x: 1 / 8.5, y: 4.0 / 11, w: 0.17 / 8.5, h: 0.17 / 11, required: false, label: 'Paper tax documents', value: '' },
  on('tf-in2', 'Investor', 'initials', 2, 6.35, 9.9, 0.95, 0.4, { required: true }),
  on('tf-sig', 'Investor', 'signature', 3, 1.9, 3.4, 3.2, 0.5, { required: true }),
  on('tf-name', 'Investor', 'name', 3, 1.9, 4.0, 3.2, 0.24, { required: true }),
  on('tf-title', 'Investor', 'text', 3, 3.3, 4.5, 2.4, 0.24, { required: false, label: 'Title' }),
  on('tf-date', 'Investor', 'date', 3, 1.9, 5.0, 1.7, 0.24),
  on('tf-csig', 'Sponsor', 'signature', 3, 1.9, 7.2, 3.2, 0.5, { required: true }),
  on('tf-cname', 'Sponsor', 'name', 3, 1.9, 7.8, 3.2, 0.24, { required: true }),
  on('tf-cdate', 'Sponsor', 'date', 3, 1.9, 8.3, 1.7, 0.24)
];

let pdfB64 = null;
async function agreementPdf(context, fund) {
  if (pdfB64) return pdfB64;
  const gen = await context.newPage();
  await gen.setContent(AGREEMENT_HTML(fund || 'Kestrel Bay Income Fund II, LP'));
  const buf = await gen.pdf({ format: 'Letter', printBackground: true });
  await gen.close();
  fs.writeFileSync(path.join(OUT, 'agreement-3p.pdf'), buf);
  pdfB64 = buf.toString('base64');
  return pdfB64;
}

/**
 * A fresh self-serve portal (the Kestrel Bay sample) with a raising offering whose subscription agreement has its fields set.
 * Nothing else is prepared for any investor: no envelope exists until one subscribes.
 */
async function setupPortal(page, context, opts) {
  opts = opts || {};
  await page.goto(BASE);
  await page.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await page.goto(BASE);
  await page.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]');
  await page.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await page.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay');
  const offName = await page.evaluate(() => {
    const ws = window.CVPortal.state.ws;
    return (ws.offerings.find((x) => x.status === 'Raising') || ws.offerings[0]).name;
  });
  const b64 = await agreementPdf(context, offName);
  return page.evaluate(
    async ({ b64, fields, legacy }) => {
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
      const size = { w: 612, h: 792 };
      ws.esignTemplates.push({
        id: 'tpl-sub-test', title: 'Subscription Agreement', fileName: 'Subscription_Agreement.pdf', docId: 'tpl-doc-test', pages: 3, pageSizes: [size, size, size], sha256: NS.audit.sha256(u8),
        roles: ['Investor', 'Sponsor'], message: 'Please sign your subscription agreement.', subscription: true, offeringId: o.id, createdAt: new Date().toISOString(),
        // legacy: an agreement stored before this change (two fields only, as the earliest templates had).
        fields: legacy ? fields.filter((f) => f.id === 'tf-sig' || f.id === 'tf-csig') : fields
      });
      NS.app.save(true);
      return { offeringId: o.id, offeringName: o.name, ready: NS.esign.templateReady(ws, o.id) };
    },
    { b64, fields: TEMPLATE_FIELDS, legacy: !!opts.legacy }
  );
}

/** Invite an investor exactly as the console form does (NS.invitations.create), and return their link's token. */
async function createInvitation(page, o) {
  return page.evaluate((o) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const r = NS.invitations.create(ws, { name: o.name, email: o.email, type: o.type || 'individual', account: o.account || '', offeringId: o.offeringId || '', cents: o.cents || 0, cls: '', note: '' });
    const it = r.invitation;
    if (!it.token) {
      const b = new Uint8Array(32);
      crypto.getRandomValues(b);
      it.token = btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    it.status = 'sent';
    NS.app.save(true);
    return { token: it.token, invitationId: it.id, investorId: r.investor.id, tenant: ws.tenant.id };
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
  if (outcome) await page.check(`input[name="iv-outcome"][value="${outcome}"]`);
  await page.click('[data-action=iv-sandbox-finish]');
  await page.waitForFunction((k) => { const c = document.querySelector(`#iv-${k} .iv-chip`); return c && !/Not started|Submitted/.test(c.textContent); }, kind, { timeout: 10000 });
}

/**
 * Walk the investor's onboarding from the welcome step until the subscription agreement is on screen.
 * At every step, onStep(heading) is called (the checks look at each screen there). Returns the steps seen.
 */
async function walkToAgreement(page, o) {
  const seen = [];
  for (let guard = 0; guard < 20; guard++) {
    await page.waitForSelector('.ivf-form h1', { timeout: 20000 });
    const hd = await heading(page);
    const count = await page.locator('.ivf-progress .ob-count').innerText().catch(() => '');
    if (seen.length && seen[seen.length - 1] === `${count} | ${hd}`) {
      seen.push('STUCK: ' + (await page.locator('.field-error').allInnerTexts()).join(' / '));
      break;
    }
    seen.push(`${count} | ${hd}`);
    if (o.onStep) await o.onStep(hd);
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
    } else if (/Subscription agreement/.test(hd)) {
      await page.waitForSelector('.es-doc-sign .es-page img', { timeout: 20000 });
      return { seen, reached: true };
    } else break;
    await submit(page);
  }
  return { seen, reached: false };
}

/** Results table for a check script. */
function reporter() {
  const results = [];
  const check = (name, ok, info) => {
    results.push({ name, ok: !!ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info !== undefined && !ok ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 1500) : ''}`);
  };
  const done = () => {
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exitCode = failed ? 1 : 0;
  };
  return { check, done, results };
}

module.exports = { chromium, PORT, ORIGIN, BASE, OUT, SHOTS, open, routeAll, setupPortal, createInvitation, walkToAgreement, heading, submit, sandbox, agreementPdf, reporter, TEMPLATE_FIELDS };
