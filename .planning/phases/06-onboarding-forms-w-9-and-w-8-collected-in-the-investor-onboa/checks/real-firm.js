#!/usr/bin/env node
// Plan 06-31 (owner-path walkthrough of 2026-11-19, failures 2, 4, 6 and 8 of 06-WALKTHROUGH.md). A firm that signs itself
// up through "Create your portal" (never one of the sample firms) is used the way the owner uses the preview: the portal in
// a sandboxed iframe whose policy refuses every connection (connect-src 'none'; each part first proves a fetch of a file that
// exists is refused), at 1280x800 with a mouse (-desktop) and at 390x844 with touch (-phone). Everything is done on screen:
// sign-up, the offering from an uploaded document, the subscription agreement, the invitation, the investor's onboarding,
// Approve and Countersign.
//   setup      (failure 8) "Prepare your subscription agreement" stays in the Setup list once an offering exists; its link
//              opens that offering, where the agreement is added; a draft does not complete it, discarding the draft leaves
//              it listed, saving the agreement completes it, removing the agreement brings it back.
//   shortname  (failure 6, second half) on the offering review screen, correcting the Name corrects the Short name unless the
//              sponsor typed a short name of their own; the corrected name is what Requests, the Account dialog and the audit
//              package's file name show.
//   contact    (failure 4) no phone number, office hours or disclosure the sponsor did not enter reaches an investor: the
//              invitation email, every onboarding screen, the done screen, the investor's Home, Account and sign-in pages,
//              the tax-form-request email and the signed tax form's certificate page. "Brand the investor portal" is
//              complete only once the sponsor has entered their support contact; what they enter is then shown.
//              The self-serve footer's Help button (plan 07-03) is expected there and only there.
//   documents  (failure 2) the accepted investor sees only real documents (what the sponsor published, their own tax
//              form and, once the firm has countersigned, the agreement they signed), on Documents, Home and the investment
//              page; an offering with no maturity date prints no maturity, no 1900 and no "Matured" on any investor or
//              sponsor screen; with a date entered, the maturity is shown. Countersign signs the agreement as the firm on
//              screen when it waits for the firm (plan 06-32), and records at once otherwise.
//   managed    the managed edition is as it was: a client added there keeps the standard contact lines and documents,
//              and its footer has no Help button.
// The sample firm (Kestrel Bay) is read in the contact and documents parts: it shows what it showed before.
//   NODE_PATH=$(npm root -g) node real-firm.js [--only setup-desktop,setup-phone,shortname-desktop,shortname-phone,contact-desktop,contact-phone,documents-desktop,documents-phone,managed]
// The last line is "REAL FIRM: PASS (parts run: N)" or "REAL FIRM: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');
// Phase 4's three-page agreement (the PDF the sponsor uploads here), from the same module lib.js uses.
if (!process.env.SIGN_OUT) process.env.SIGN_OUT = path.join(Lib.OUT, 'p4');
const P4 = require(path.join(Lib.ROOT, '.planning/phases/04-signing-inside-onboarding/checks/lib.js'));

const OUT = path.join(Lib.OUT, 'real-firm');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-setup-list\.png$/, 'Console Overview of a firm that signed up, with an offering and no agreement: the Setup list with "Prepare your subscription agreement".'],
  [/-setup-offering\.png$/, 'The offering the Setup step opens: its Subscription agreement panel.'],
  [/-review-name\.png$/, 'Offering review screen after the Name was corrected: the Short name beside it.'],
  [/-requests\.png$/, 'Requests page: the Fund column for the offering whose name was corrected on review.'],
  [/-done\.png$/, 'The investor’s done screen of a firm that entered no phone, hours or disclosure.'],
  [/-account\.png$/, 'The investor’s Account page of that firm.'],
  [/-footer-entered\.png$/, 'The investor’s Home after the sponsor entered a phone, hours and a disclosure: the footer shows them.'],
  [/-documents\.png$/, 'The accepted investor’s Documents page: only the published document and their own tax form.'],
  [/-investments\.png$/, 'The accepted investor’s Investments page: an offering with no maturity date.'],
  [/-investment\.png$/, 'The investment page of an offering with no maturity date.']
]);

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const CSP = "connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' }
};

// What a firm that entered none of them must never show an investor.
const PHONE_RE = /\d{3}\)?[\s.-]?555[\s.-]?\d{4}/;
const HOURS_RE = /Mon\s*[–-]\s*Fri|9:00\s*a\.m\./i;
const BRACKET_RE = /\[[^\]\n]+\]/;
const DISCLOSURE_RE = /Regulatory disclosures|provided by counsel|informational purposes only/i;
/** The placeholder lines found in a text ('' when none): phone, hours, anything bracketed, the standard disclosure. */
function placeholders(text) {
  const t = String(text || '');
  return [PHONE_RE, HOURS_RE, BRACKET_RE, DISCLOSURE_RE]
    .map((re) => (t.match(re) || [''])[0])
    .filter(Boolean)
    .join(' | ');
}
// Documents nobody made, a 1900 date, a redemption countdown that has run out.
const GENERATED_RE = /Investor Update|Capital Account Statement|Note Purchase Agreement|Schedule K-1|Form 1099|Tax Letter|Final Distribution Notice/i;
const NINETEEN_RE = /\b1900\b/;
const MATURED_RE = /\bMatured\b/i;
const MATURITY_RE = /\bMaturity\b/i;

const FIRM = { name: 'Harbor Ridge Capital', first: 'Maya', last: 'Okonkwo', email: 'maya.okonkwo@harborridge.example', support: 'investors@harborridge.example' };
// The document the offering is set up from: it names a company and an exemption, and no fee, term, minimum or maturity.
const SUMMARY = [
  'SUBSCRIPTION AGREEMENT',
  '',
  'NORTHGATE MOTORS, INC., an Arizona corporation',
  '',
  'Shares of Common Stock',
  '',
  'The undersigned (the "Subscriber") hereby subscribes for and agrees to purchase shares of common stock of Northgate Motors, Inc., an Arizona corporation (the "Company"), upon the terms and conditions set forth in this Subscription Agreement.',
  '',
  '1. Subscription. The Subscriber shall deliver the purchase price by wire transfer or check payable to the Company.',
  '',
  '2. Exemption. Northgate sells these shares to accredited buyers only, relying on Rule 506(b) of Regulation D.',
  '',
  '3. The Subscriber. The Subscriber can judge this purchase alone and can afford to lose all of the money paid for it.',
  ''
].join('\n');
const SUMMARY_FILE = { name: 'Offering summary.txt', mimeType: 'text/plain', buffer: Buffer.from(SUMMARY) };
const OFFERING = 'Elio Motors Shares';

/* ---------- the frame ---------- */

/** A fresh context whose page holds the portal (diy.html, or `file`) in a sandboxed iframe served with the refusing policy. */
async function framed(S, vp, file) {
  const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, VIEW[vp]) });
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await A.context.route(
    (u) => u.origin === S.origin && /^\/(diy|index)\.html$/.test(u.pathname),
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CSP }, body: fs.readFileSync(path.join(Lib.ROOT, new URL(route.request().url()).pathname.slice(1))) })
  );
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${S.origin}/${file || 'diy.html'}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  /** A press as this device makes it: a finger tap on the phone, a mouse click on the desktop. */
  const press = async (target) => {
    const l = typeof target === 'string' ? fr.locator(target).first() : target;
    await l.scrollIntoViewIfNeeded();
    if (vp === 'phone') await l.tap();
    else await l.click();
  };
  const go = async (hash, sel) => {
    await fr.evaluate((h) => (location.hash = h), hash);
    if (sel) await fr.waitForSelector(sel, { timeout: 20000 });
    await fr.waitForTimeout(350);
  };
  const shot = (name) => A.page.screenshot({ path: path.join(OUT, `${vp}-${name}.png`), fullPage: false });
  return { S, A, fr, vp, press, go, shot };
}

/** The frame refuses a fetch of a file that is there, and reports its size (the check's own proof of its conditions). */
async function proveFrame(check, J) {
  const r = await J.fr.evaluate(() =>
    fetch('assets/forms/SHA256SUMS', { cache: 'no-store' }).then(
      (x) => 'fetched ' + x.status,
      (e) => 'refused: ' + String(e && e.message)
    )
  );
  const size = await J.fr.evaluate(() => ({ w: innerWidth, h: innerHeight, touch: navigator.maxTouchPoints > 0, framed: window.top !== window }));
  const want = VIEW[J.vp].viewport;
  check(`the portal is in a sandboxed frame that refuses fetch(), ${want.width}x${want.height}${J.vp === 'phone' ? ' with touch' : ''}`, /^refused/.test(r) && size.framed && size.w === want.width && size.h === want.height && size.touch === (J.vp === 'phone'), { fetch: r, size });
  await J.fr.evaluate(() => (window.__cspv = []));
  J.A.errors.length = 0;
}
/** Nothing went wrong under the page while the part ran. */
async function quiet(check, J) {
  const refused = await J.fr.evaluate(() => window.__cspv.slice()).catch(() => ['(the frame is gone)']);
  check('no connection was attempted (none refused) on the whole way', refused.length === 0, refused);
  check('no script error in the browser', J.A.errors.length === 0, J.A.errors);
  check('no request left the check server', J.A.net.external.length === 0, J.A.net.external);
}

/* ---------- the sponsor ---------- */

/** "Create your portal": the firm signs itself up. Resolves to its workspace id. */
async function signUp(J) {
  const { fr, press } = J;
  await fr.waitForSelector('#sd-firm', { timeout: 30000 });
  await fr.fill('#sd-firm', FIRM.name);
  await fr.fill('#sd-name', FIRM.first);
  await fr.fill('#sd-last', FIRM.last);
  await fr.fill('#sd-email', FIRM.email);
  await fr.fill('#sd-password', 'harbor-ridge-pass-1');
  await press('.sd-submit');
  await fr.waitForFunction(() => window.CVPortal.state.ws && location.hash === '#console', null, { timeout: 20000 });
  await fr.waitForTimeout(400);
  return fr.evaluate(() => {
    const NS = window.CVPortal;
    return { id: NS.state.ws.tenant.id, sample: NS.workspace.isBuiltin(NS.state.ws.tenant.id), edition: NS.EDITION.id };
  });
}
/** Back on the firm's own portal (a part that read the sample firm leaves the frame there). */
async function ownPortal(J) {
  const { fr } = J;
  if (!J.own || (await fr.evaluate(() => window.CVPortal.state.ws.tenant.id)) === J.own) return;
  await fr.selectOption('#demo-sponsor', J.own);
  await fr.waitForFunction((id) => window.CVPortal.state.ws.tenant.id === id, J.own);
  await fr.waitForTimeout(300);
}
/** The console as the firm's admin, on its own portal. */
async function asAdmin(J, hash, sel) {
  await ownPortal(J);
  await Lib.consoleRoute(J.fr, hash || 'console', sel || '.cs-head');
}
/** The Setup list on the Overview: its count line and each step (name, complete or not, where its button leads). */
async function setupList(J) {
  await asAdmin(J, 'console', '.cs-head');
  return J.fr.evaluate(() => {
    const steps = Array.from(document.querySelectorAll('.cs-steps > li')).map((li) => {
      const a = li.querySelector('.cs-step-act a');
      return { name: li.querySelector('strong').textContent.trim(), done: li.classList.contains('is-done'), href: a.getAttribute('href'), button: a.textContent.trim() };
    });
    const head = Array.from(document.querySelectorAll('.cs-panel-head h2')).find((x) => /^Setup/.test(x.textContent.trim()));
    return { count: head ? head.textContent.replace(/\s+/g, ' ').trim() : '', steps, complete: !!document.querySelector('.cs-setup-done') };
  });
}
const stepOf = (list, name) => list.steps.find((s) => s.name === name) || null;
const AGR_STEP = 'Prepare your subscription agreement';
const BRAND_STEP = 'Brand the investor portal';

/** Offering intake: the summary uploaded and read; resolves to what the review screen proposes. */
async function readSummary(J) {
  const { fr, press } = J;
  await asAdmin(J, 'console-intake', '#ik-files');
  await fr.setInputFiles('#ik-files', SUMMARY_FILE);
  await fr.waitForTimeout(300);
  await press('[data-action=ik-read]');
  await fr.waitForSelector('#ik-offering-name', { timeout: 120000 });
  await fr.waitForTimeout(300);
  return fr.evaluate(() => ({ name: document.getElementById('ik-offering-name').value, short: document.getElementById('ik-offering-shortName').value, type: document.getElementById('ik-offering-type').value }));
}
/** "Create the offering" on the review screen; resolves to the offering as stored. */
async function createOffering(J) {
  const { fr, press } = J;
  await press('[data-action=ik-apply]');
  await fr.waitForFunction(() => window.CVPortal.state.ui.intake && window.CVPortal.state.ui.intake.step === 'done', null, { timeout: 60000 });
  await fr.waitForTimeout(400);
  return fr.evaluate(() => {
    const NS = window.CVPortal;
    const o = NS.state.ws.offerings.find((x) => x.id === NS.state.ui.intake.done);
    return { id: o.id, name: o.name, shortName: o.shortName, type: o.type, exit: o.exit, terms: (o.terms || []).map((t) => `${t.label}=${t.value}`) };
  });
}
/** The offering page's "Add the subscription agreement": the PDF chosen, read, and the field editor opened on the draft. */
async function addAgreement(J, offeringId) {
  const { fr, press } = J;
  if ((await fr.evaluate(() => location.hash)) !== '#console-offering-' + offeringId) await asAdmin(J, 'console-offering-' + offeringId, '#agreement');
  await press('[data-action=es-agreement-new]');
  await fr.waitForSelector('#es-agr-file', { timeout: 15000 });
  await fr.setInputFiles('#es-agr-file', { name: 'Agreement.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await P4.agreementPdf(J.A.context, OFFERING), 'base64') });
  await fr.waitForTimeout(500);
  await press('form[data-form="es-agreement"] button[type=submit]');
  await fr.waitForFunction(() => /^#console-envelope-/.test(location.hash), null, { timeout: 180000 });
  await fr.waitForSelector('[data-action="es-agreement-save"]', { timeout: 30000 });
  await fr.waitForTimeout(600);
}
async function saveAgreement(J, offeringId) {
  await J.press('[data-action="es-agreement-save"]');
  await J.fr.waitForFunction((id) => location.hash === '#console-offering-' + id, offeringId, { timeout: 20000 });
  await J.fr.waitForTimeout(400);
}
/** The Investors page's "Invite an investor" form; resolves to the email the dialog shows and the invitation. */
async function invite(J, who, offeringId, amount) {
  const { fr, press } = J;
  await asAdmin(J, 'console-investors', '[data-action=invite-toggle]');
  if ((await fr.locator('#iv-email').count()) === 0) await press('[data-action=invite-toggle]');
  await fr.waitForSelector('#iv-email', { timeout: 10000 });
  await fr.fill('#iv-contact', who.first);
  await fr.fill('#iv-last', who.last);
  await fr.fill('#iv-email', who.email);
  if (!(await fr.locator('#iv-more[open]').count())) await press('#iv-more summary');
  await fr.selectOption('#iv-off', offeringId);
  await fr.waitForTimeout(300);
  await fr.fill('#iv-amt', String(amount));
  await press('.inv8-form[data-form="invite-one"] button[type=submit]');
  const email = await emailDialog(J);
  const made = await fr.evaluate((addr) => {
    const ws = window.CVPortal.state.ws;
    const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === addr.toLowerCase());
    const it = inv && (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
    return it ? { investorId: inv.id, token: it.token || '' } : null;
  }, who.email);
  return Object.assign({ email }, made || {});
}
/** The email dialog on screen: its heading, the email as shown, and the text the sponsor's email app is handed; then closed. */
async function emailDialog(J) {
  const { fr, press } = J;
  await fr.waitForSelector('#dlg[open] .inv8-email', { timeout: 30000 });
  await fr.waitForTimeout(400);
  const e = await fr.evaluate(() => {
    const d = document.getElementById('dlg');
    const m = document.getElementById('inv8-mailto');
    let sent = '';
    try {
      sent = m ? decodeURIComponent((m.getAttribute('href').split('&body=')[1] || '').replace(/\+/g, ' ')) : '';
    } catch (x) {
      sent = '(the mailto could not be read)';
    }
    return { heading: (d.querySelector('.dlg-head h2') || {}).innerText || '', shown: (d.querySelector('article.email') || {}).innerText || '', sent };
  });
  await press('#dlg .dlg-head [data-action="close-dialog"]');
  await fr.waitForFunction(() => !document.getElementById('dlg').open);
  return e;
}
/** "Add manually" on the Investors page: an active investor on file (no onboarding), with a commitment when given. */
async function addManually(J, who, offeringId, amount) {
  const { fr, press } = J;
  await asAdmin(J, 'console-investors', '[data-action=invite-toggle]');
  if ((await fr.locator('[data-action=invite-tab]').count()) === 0) await press('[data-action=invite-toggle]');
  await fr.waitForSelector('[data-action=invite-tab][data-t=manual]', { timeout: 10000 });
  await press('[data-action=invite-tab][data-t=manual]');
  await fr.waitForSelector('#im-first', { timeout: 10000 });
  await fr.fill('#im-first', who.first);
  await fr.fill('#im-last', who.last);
  await fr.fill('#im-email', who.email);
  if (offeringId) {
    await fr.selectOption('#im-off', offeringId);
    await fr.waitForTimeout(300);
    await fr.fill('#im-amt', String(amount));
  }
  await press('.inv8-manual button[type=submit]');
  await fr.waitForFunction((addr) => window.CVPortal.state.ws.investors.some((i) => i.email === addr) && !document.querySelector('.inv8-manual'), who.email, { timeout: 20000 });
  await fr.waitForTimeout(400);
  return fr.evaluate((addr) => window.CVPortal.state.ws.investors.find((i) => i.email === addr).id, who.email);
}
const investorRow = (fr, email) => fr.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: email }).first();

/* ---------- the investor ---------- */

/** Signed in as this investor, on Home. */
async function asInvestor(J, id) {
  const { fr } = J;
  await fr.evaluate((id) => (window.CVPortal.state.viewer = id), id);
  if ((await fr.evaluate(() => window.CVPortal.state.role)) !== 'investor') await fr.selectOption('#demo-role', 'investor');
  else
    await fr.evaluate(() => {
      location.hash = 'overview';
      window.CVPortal.app.render();
    });
  await fr.waitForFunction(() => location.hash === '#overview');
  await fr.waitForTimeout(500);
}
const screen = (fr) =>
  fr.evaluate(() => ({
    hash: location.hash,
    h1: ((document.querySelector('.ivf-form h1') || document.querySelector('h1') || {}).innerText || '').trim(),
    foot: (document.querySelector('.pt-foot') || {}).innerText || '',
    // the footer's Help button (plan 07-03: the self-serve edition's help, opened from the investor's footer)
    footHelp: Array.from(document.querySelectorAll('.pt-foot [data-action="help-open"]')).map((b) => b.innerText.trim()),
    text: document.body.innerText
  }));
/** The investor's W-9 signing view: consent (if asked) and the signature adopted, as ways-out.js signs it. */
async function signW9(J, investorId) {
  const { fr, press } = J;
  if (await fr.locator('#es-consent-box').count()) {
    await fr.check('#es-consent-box');
    await press('[data-action="es-consent"]');
    await fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 30000 });
  }
  const fid = await fr.evaluate((id) => {
    const ws = window.CVPortal.state.ws;
    const i = ws.investors.find((x) => x.id === id);
    const env = (ws.envelopes || []).find((e) => e.id === (i.onboarding.flow || {}).taxEnvelopeId);
    const f = env && env.fields.find((x) => x.type === 'signature');
    return f ? f.id : '';
  }, investorId);
  if (!fid) return false;
  await press(fr.locator(`.es-doc-sign [data-fid="${fid}"]`).first());
  await fr.waitForTimeout(300);
  if (await fr.evaluate(() => !!(document.getElementById('dlg') || {}).open)) {
    await press('[data-action="es-adopt"]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open);
  }
  return true;
}
/**
 * The firm's signing view that Countersign opens when the investor's agreement waits for the firm (plan 06-32), signed on
 * screen as signing-documents.js's firmSigns does: agree to sign electronically, adopt the signature on each of the firm's
 * signature fields, give the signer's name where it is empty, then Finish. Resolves to whether the view says it is
 * finished, with the firm's fields and the request's status for the report.
 */
async function firmSigns(J, investorId) {
  const { fr, press } = J;
  if (await fr.locator('#es-consent-box').count()) {
    await fr.check('#es-consent-box');
    await press('[data-action="es-consent"]');
  }
  await fr.waitForSelector('.es-sign-console .es-doc-sign .es-page img', { timeout: 30000 });
  const own = await fr.evaluate((id) => {
    const ws = window.CVPortal.state.ws;
    const r = (ws.requests || []).filter((x) => x.investorId === id && x.type === 'subscription').pop();
    const env = r && r.envelopeId ? (ws.envelopes || []).find((e) => e.id === r.envelopeId) : null;
    const firm = env ? env.signers.find((s) => s.role === 'countersigner') : null;
    return firm ? env.fields.filter((f) => f.signerId === firm.id).map((f) => ({ id: f.id, type: f.type })) : [];
  }, investorId);
  for (const f of own.filter((x) => x.type === 'signature' || x.type === 'initials')) {
    await press(fr.locator(`.es-doc-sign [data-fid="${f.id}"]`).first());
    await fr.waitForTimeout(300);
    if (await fr.evaluate(() => !!(document.getElementById('dlg') || {}).open)) {
      await press('[data-action="es-adopt"]');
      await fr.waitForFunction(() => !document.getElementById('dlg').open);
    }
  }
  for (const f of own.filter((x) => x.type === 'name')) {
    const sel = `.es-doc-sign input[data-fid="${f.id}"]`;
    if (!(await fr.locator(sel).count()) || (await fr.inputValue(sel))) continue;
    if (J.vp === 'phone') {
      await press(sel);
      await fr.waitForSelector('.sf-tray:not([hidden]) .sf-tray-in', { timeout: 10000 });
      await fr.fill('.sf-tray-in', `${FIRM.first} ${FIRM.last}`);
    } else await fr.fill(sel, `${FIRM.first} ${FIRM.last}`);
    await fr.waitForTimeout(200);
  }
  await press('.es-sign-console .es-finish');
  const finished = await fr.waitForSelector('.es-sign-console .es-done', { timeout: 30000 }).then(
    () => true,
    () => false
  );
  await fr.waitForTimeout(700);
  const req = await fr.evaluate((id) => ((window.CVPortal.state.ws.requests || []).filter((x) => x.investorId === id && x.type === 'subscription').pop() || {}).status || '', investorId);
  return { finished, fields: own.map((f) => f.type), request: req };
}
/** The text of the certificate page(s) the portal added to the investor's signed tax form (read with the page's own PDF reader). */
const certificateText = (fr, investorId) =>
  fr.evaluate(async (id) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const inv = ws.investors.find((x) => x.id === id);
    const doc = (ws.docs || []).find((d) => d.envelopeId && d.envelopeId === ((inv.taxCert || {}).envelopeId || '-'));
    const blob = doc ? await NS.ops.files.get(doc.id) : null;
    if (!blob) return null;
    const lib = await NS.pdfLib();
    const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) pages.push((await (await pdf.getPage(p)).getTextContent()).items.map((i) => i.str).join(' '));
    return { title: doc.title, pages: pages.length, text: pages.filter((t) => /Certificate of completion/i.test(t)).join('\n') };
  }, investorId);

/* ---------- the journey the contact and documents parts share (one per device) ---------- */

const journeys = {};
const INVESTOR = { first: 'Tomás', last: 'Vidal', email: 'tomas.vidal@example.com' };
/**
 * A firm signs up, sets an offering up from the uploaded summary (type "Private credit", no maturity date entered), adds and
 * saves its subscription agreement, invites an investor, and the investor onboards to the done screen (W-9 signed, the
 * agreement finished). What each screen showed is kept in J.seen. Built once per device.
 */
async function journey(S, vp, check) {
  if (journeys[vp]) return journeys[vp];
  const J = await framed(S, vp);
  journeys[vp] = J;
  const { fr, press } = J;
  J.seen = { steps: [] };
  await proveFrame(check, J);
  const firm = await signUp(J);
  J.own = firm.id;
  check('the firm signed itself up in the self-serve edition and is not a sample firm', firm.edition === 'diy' && !firm.sample && !!firm.id, firm);
  J.seen.setup0 = await setupList(J);
  const prop = await readSummary(J);
  await fr.fill('#ik-offering-name', OFFERING);
  await fr.selectOption('#ik-offering-type', 'Private credit');
  await fr.waitForTimeout(400);
  J.seen.review = Object.assign(prop, { term: await fr.evaluate(() => ({ basis: document.getElementById('ik-term-basis').value, date: document.getElementById('ik-term-date').value, years: document.getElementById('ik-term-years').value })) });
  J.off = await createOffering(J);
  check('the offering is set up from the uploaded summary: "Private credit", no maturity date entered on review', J.off.name === OFFERING && J.off.type === 'Private credit' && J.off.exit.basis === 'maturity' && !J.off.exit.date && !J.seen.review.term.date && !J.seen.review.term.years, { off: J.off, review: J.seen.review });
  await addAgreement(J, J.off.id);
  await saveAgreement(J, J.off.id);
  const ready = await fr.evaluate((id) => window.CVPortal.esign.templateReady(window.CVPortal.state.ws, id), J.off.id);
  check('the subscription agreement is uploaded and saved on the offering', ready);
  J.inv = await invite(J, INVESTOR, J.off.id, 100000);
  check('the investor is invited from the Investors page and the invitation email is shown', !!J.inv.investorId && !!J.inv.token && J.inv.email.heading === 'Invitation email' && /Dear Tomás,/.test(J.inv.email.shown), { heading: J.inv.email.heading, inv: J.inv.investorId });
  if (!J.inv.token) return J;
  // the investor's link, opened in this browser
  await fr.evaluate((t) => (location.hash = 'invite-' + t), J.inv.token);
  const name = `${INVESTOR.first} ${INVESTOR.last}`;
  const note = async () => J.seen.steps.push(await screen(fr));
  const answers = { name, acc: 'yes', basis: 0, amount: 100000, profile: { phone: '512-867-5309' }, onStep: note };
  let w = await Lib.walk(fr, Object.assign({ until: /Tax certification/ }, answers));
  if (w.reached) {
    await note();
    await Lib.submit(fr);
    await fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
    await note();
    J.seen.w9signed = await signW9(J, J.inv.investorId);
    await Lib.finishTaxForm(fr);
    w = await Lib.walk(fr, answers);
  }
  J.seen.reached = w.reached;
  J.seen.walk = w.seen;
  if (w.reached) {
    await note();
    J.seen.doneText = await Lib.finishAgreement(fr);
    J.seen.done = await screen(fr);
    await J.shot('done');
    await press('.ivf-done a[href="#overview"]');
    await fr.waitForFunction(() => location.hash === '#overview');
    await fr.waitForTimeout(500);
    J.seen.home = await screen(fr);
  }
  check('the investor onboards to the done screen (W-9 signed, agreement finished)', w.reached && !!J.seen.w9signed && !!J.seen.doneText, { walk: w.seen, errors: w.errors });
  return J;
}

/* ---------- failure 8: the Setup step for the subscription agreement ---------- */
function setupPart(vp) {
  return async ({ check, S }) => {
    const J = await framed(S, vp);
    const { fr, press } = J;
    await proveFrame(check, J);
    const firm = await signUp(J);
    J.own = firm.id;
    check('the firm signed itself up and is not a sample firm', firm.edition === 'diy' && !firm.sample, firm);
    const s0 = await setupList(J);
    const a0 = stepOf(s0, AGR_STEP);
    check('after sign-up the Setup list has 8 steps with "Prepare your subscription agreement", not complete', s0.steps.length === 8 && !!a0 && !a0.done && a0.button === 'Start', s0);
    await readSummary(J);
    await fr.fill('#ik-offering-name', OFFERING);
    const off = await createOffering(J);
    const s1 = await setupList(J);
    await fr.evaluate((n) => { const li = Array.from(document.querySelectorAll('.cs-steps > li')).find((x) => x.textContent.indexOf(n) >= 0); if (li) li.scrollIntoView({ block: 'center' }); }, AGR_STEP);
    await J.shot('setup-list');
    const a1 = stepOf(s1, AGR_STEP);
    check('with an offering and no agreement the Setup list still has 8 steps', s1.steps.length === 8, { count: s1.count, steps: s1.steps.map((x) => x.name) });
    check('"Prepare your subscription agreement" is still listed, not complete', !!a1 && !a1.done && a1.button === 'Start', a1 || s1.steps.map((x) => x.name));
    check('its link is the offering', !!a1 && a1.href === '#console-offering-' + off.id, a1 && a1.href);
    if (!a1) return J.A.context.close();
    await press(fr.locator('.cs-steps > li', { hasText: AGR_STEP }).locator('.cs-step-act a'));
    await fr.waitForTimeout(700);
    const at = await fr.evaluate(() => {
      const b = document.querySelector('#agreement [data-action=es-agreement-new]');
      if (b) b.scrollIntoView({ block: 'center' });
      const r = b ? b.getBoundingClientRect() : null;
      const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      return { hash: location.hash, h1: (document.querySelector('h1') || {}).innerText || '', button: b ? b.innerText.trim() : '', reachable: !!r && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && !!hit && (hit === b || b.contains(hit)) };
    });
    await J.shot('setup-offering');
    check('pressing it opens that offering, whose "Add the subscription agreement" button is on screen', at.hash === '#console-offering-' + off.id && at.h1 === OFFERING && /Add the subscription agreement/.test(at.button) && at.reachable, at);
    // a draft: uploaded and read, not saved
    await addAgreement(J, off.id);
    const draft = await fr.evaluate((id) => ({ drafts: (window.CVPortal.state.ws.envelopes || []).filter((e) => e.agreementFor === id && e.status === 'draft').length, saved: !!window.CVPortal.esign.subscriptionTemplate(window.CVPortal.state.ws, id) }), off.id);
    const s2 = await setupList(J);
    const a2 = stepOf(s2, AGR_STEP);
    check('with the agreement uploaded but not saved (a draft) the step is listed and not complete', draft.drafts === 1 && !draft.saved && !!a2 && !a2.done && a2.href === '#console-offering-' + off.id, { draft, a2, n: s2.steps.length });
    // Discard on the offering page
    await asAdmin(J, 'console-offering-' + off.id, '#agreement');
    await press('#agreement [data-action=es-agreement-cancel]');
    await fr.waitForTimeout(600);
    const gone = await fr.evaluate((id) => (window.CVPortal.state.ws.envelopes || []).filter((e) => e.agreementFor === id && e.status === 'draft').length, off.id);
    const s3 = await setupList(J);
    const a3 = stepOf(s3, AGR_STEP);
    check('after "Discard" the draft is gone and the step is still listed, not complete, with its link to the offering', gone === 0 && s3.steps.length === 8 && !!a3 && !a3.done && a3.button === 'Start' && a3.href === '#console-offering-' + off.id, { gone, a3, n: s3.steps.length });
    // saved
    await addAgreement(J, off.id);
    await saveAgreement(J, off.id);
    const s4 = await setupList(J);
    const a4 = stepOf(s4, AGR_STEP);
    const done = (s) => s.steps.filter((x) => x.done).length;
    check('once the agreement is saved the step is complete ("Review") and the count goes up by one', !!a4 && a4.done && a4.button === 'Review' && s4.steps.length === 8 && done(s4) === done(s3) + 1 && s4.count.indexOf(`${done(s4)} of 8 complete`) >= 0, { a4, count: s4.count, before: s3.count });
    // removed again
    await asAdmin(J, 'console-offering-' + off.id, '#agreement');
    await press('#agreement [data-action=es-agreement-remove]');
    await fr.waitForSelector('#dlg[open] [data-action=es-agreement-remove-yes]', { timeout: 10000 });
    await press('#dlg [data-action=es-agreement-remove-yes]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open);
    const s5 = await setupList(J);
    const a5 = stepOf(s5, AGR_STEP);
    check('when the saved agreement is removed the step is not complete again', !!a5 && !a5.done && s5.steps.length === 8, { a5, count: s5.count });
    await quiet(check, J);
    await J.A.context.close();
  };
}

/* ---------- failure 6, second half: the review form's Short name follows its Name ---------- */
function shortnamePart(vp) {
  return async ({ check, S }) => {
    const J = await framed(S, vp);
    const { fr, press } = J;
    await proveFrame(check, J);
    const firm = await signUp(J);
    J.own = firm.id;
    check('the firm signed itself up and is not a sample firm', firm.edition === 'diy' && !firm.sample, firm);
    // first reading: the sponsor types a short name of their own, then corrects the Name
    const p1 = await readSummary(J);
    check('the review screen proposes a name and a short name from the document', !!p1.name && !!p1.short && p1.name !== OFFERING, p1);
    await fr.fill('#ik-offering-shortName', 'Northgate');
    await fr.fill('#ik-offering-name', 'Northgate Motors Common Stock');
    await fr.waitForTimeout(200);
    const own = await fr.inputValue('#ik-offering-shortName');
    check('a short name the sponsor typed is kept when the Name is corrected afterwards', own === 'Northgate', own);
    await press('[data-action=ik-restart]');
    await fr.waitForSelector('#ik-files', { timeout: 10000 });
    // second reading: only the Name is corrected
    const p2 = await readSummary(J);
    await fr.fill('#ik-offering-name', OFFERING);
    await fr.waitForTimeout(200);
    const after = await fr.evaluate(() => ({ name: document.getElementById('ik-offering-name').value, short: document.getElementById('ik-offering-shortName').value, focus: (document.activeElement || {}).id || '' }));
    await fr.evaluate(() => document.getElementById('ik-offering-name').scrollIntoView({ block: 'center' }));
    await J.shot('review-name');
    check(`correcting the Name to "${OFFERING}" corrects the Short name (it read "${p2.short}")`, after.short === OFFERING, after);
    check('the Name field keeps the focus and its text while typing', after.name === OFFERING && after.focus === 'ik-offering-name', after);
    const off = await createOffering(J);
    check('the offering is created with the corrected name and short name', off.name === OFFERING && off.shortName === OFFERING, off);
    // where the short name shows: Requests, the Account dialog, the audit package's file name
    const who = { first: 'Ingrid', last: 'Solheim', email: 'ingrid.solheim@example.com' };
    await addManually(J, who, off.id, 50000);
    await asAdmin(J, 'console-requests', '.cs-tabs');
    await press('[data-action=req-tab][data-t=all]');
    await fr.waitForTimeout(400);
    const fund = await fr.evaluate(() => {
      const t = Array.from(document.querySelectorAll('table.cs-tbl')).find((x) => Array.from(x.querySelectorAll('thead th')).some((th) => th.textContent.trim() === 'Fund'));
      const i = t ? Array.from(t.querySelectorAll('thead th')).findIndex((th) => th.textContent.trim() === 'Fund') : -1;
      return t ? Array.from(t.querySelectorAll('tbody tr')).map((tr) => tr.children[i].textContent.trim()) : [];
    });
    await fr.evaluate(() => { const t = document.querySelector('main table.cs-tbl'); if (t) t.scrollIntoView({ block: 'center' }); });
    await J.shot('requests');
    check('Requests shows the corrected name in its Fund column', fund.length === 1 && fund[0] === OFFERING, fund);
    await asAdmin(J, 'console-investors', '.cs-tbl');
    await press(investorRow(fr, who.email).locator('[data-action="co-record"]'));
    await fr.waitForSelector('#dlg[open] .co-record', { timeout: 10000 });
    const offs = await fr.evaluate(() => {
      const row = Array.from(document.querySelectorAll('#dlg .co-record dl > div')).find((d) => d.querySelector('dt').textContent.trim() === 'Offerings');
      return row ? row.querySelector('dd').textContent.trim() : '';
    });
    check('the Account dialog shows the corrected name under Offerings', offs === OFFERING, offs);
    await press('#dlg .dlg-head [data-action="close-dialog"]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open);
    await asAdmin(J, 'console-audit', '[data-action=aud-zip]');
    const got = J.A.page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
    await press('[data-action=aud-zip]');
    const d = await got;
    const file = d ? d.suggestedFilename() : '';
    check('the audit package’s file name carries the corrected name', /^Harbor_Ridge_Capital_Elio_Motors_Shares_audit_package_.+\.zip$/.test(file), file);
    await quiet(check, J);
    await J.A.context.close();
  };
}

/* ---------- failure 4: nothing the sponsor did not enter ---------- */
function contactPart(vp) {
  return async ({ check, S }) => {
    const J = await journey(S, vp, check);
    const { fr, press } = J;
    const seen = J.seen;
    if (!seen.reached) return;
    await ownPortal(J);
    // the invitation email, as shown and as handed to the sponsor's email app
    check('the invitation email shows no phone, hours or disclosure the sponsor did not enter', !placeholders(J.inv.email.shown) && /Questions\? Contact Investor Relations at investors@harborridge\.example\./.test(J.inv.email.shown), placeholders(J.inv.email.shown) || J.inv.email.shown.slice(-300));
    check('nor does the email text handed to the email app', !placeholders(J.inv.email.sent) && /Questions\? Contact Investor Relations at investors@harborridge\.example\./.test(J.inv.email.sent), placeholders(J.inv.email.sent) || J.inv.email.sent.slice(-300));
    // every onboarding screen
    const bad = seen.steps.map((s) => ({ h1: s.h1, found: placeholders(s.text) })).filter((x) => x.found);
    check(`none of the ${seen.steps.length} onboarding screens shows a phone, hours or disclosure the sponsor did not enter`, seen.steps.length >= 9 && bad.length === 0, bad.length ? bad : seen.steps.map((s) => s.h1));
    const feet = seen.steps.filter((s) => s.foot);
    check('their footer still names who to ask: the team and the email from sign-up, and the firm', feet.length >= 5 && feet.every((s) => /Investor Relations/.test(s.foot) && s.foot.indexOf(FIRM.support) >= 0 && /© \d{4} Harbor Ridge Capital/.test(s.foot)), feet.length ? feet[0].foot : 'no footer seen');
    // This firm is in the self-serve edition (checked at sign-up), whose footer ends the contact row with its Help button
    // (plan 07-03); the managed part checks that edition's footer has none.
    const footer = (s) => s.foot.replace(/\s+/g, ' ').trim();
    const hasHelp = (s) => s.footHelp.length === 1 && s.footHelp[0] === 'Help';
    check('the footer holds nothing else (team, email, the Help button, the legal line)', feet.every((s) => hasHelp(s) && footer(s) === `Investor Relations ${FIRM.support} Help © ${new Date().getFullYear()} Harbor Ridge Capital, LLC`), feet.length ? { foot: footer(feet[0]), help: feet[0].footHelp, odd: feet.filter((s) => !hasHelp(s) || footer(s) !== footer(feet[0])).map((s) => s.h1) } : '');
    // the done screen
    check('the done screen says who to ask, with no phone', !placeholders(seen.done.text) && /Questions\? Investor Relations at investors@harborridge\.example\./.test(seen.doneText), placeholders(seen.done.text) || seen.doneText.slice(-300));
    // the investor's Home, Account and sign-in pages
    check('the investor’s Home shows no phone, hours or disclosure the sponsor did not enter', !placeholders(seen.home.text) && seen.home.text.indexOf(FIRM.support) >= 0, placeholders(seen.home.text));
    await asInvestor(J, J.inv.investorId);
    await J.go('account', '.pt-title');
    const acct = await screen(fr);
    await J.shot('account');
    const line = (acct.text.match(/To change these details[^\n]*/) || [''])[0];
    check('the investor’s Account page shows none either, and says who to contact by email', !placeholders(acct.text) && line === `To change these details, contact Investor Relations at ${FIRM.support}.`, placeholders(acct.text) || line);
    await J.go('sign-in', '.auth-help');
    const sign = await screen(fr);
    const help = await fr.evaluate(() => Array.from(document.querySelectorAll('.auth-help p')).map((p) => p.innerText.trim()));
    check('the sign-in page’s help lists the team and the email only', !placeholders(sign.text) && help.length === 2 && help[0] === 'Investor Relations' && help[1] === FIRM.support, placeholders(sign.text) || help);
    await J.go('overview');
    // the certificate page of the investor's signed tax form
    const cert = await certificateText(fr, J.inv.investorId);
    check('the signed W-9’s certificate page names the firm and its email, and no phone', !!cert && /Certificate of completion/i.test(cert.text) && cert.text.indexOf(FIRM.support) >= 0 && !placeholders(cert.text), cert ? placeholders(cert.text) || cert.text.slice(0, 300) : 'no signed tax form found');
    // the Setup step
    const b0 = stepOf(seen.setup0, BRAND_STEP);
    check('at sign-up "Brand the investor portal" is listed and not complete', !!b0 && !b0.done && b0.button === 'Start', b0 || seen.setup0);
    // a tax-form request to an investor on file
    const onFile = { first: 'Ingrid', last: 'Solheim', email: 'ingrid.solheim@example.com' };
    await addManually(J, onFile);
    await asAdmin(J, 'console-investors', '.cs-tbl');
    await press(investorRow(fr, onFile.email).locator('[data-action="tax-request"]'));
    const req = await emailDialog(J);
    check('the tax-form-request email shows no phone, hours or disclosure the sponsor did not enter', req.heading === 'Tax form request email' && !placeholders(req.shown) && !placeholders(req.sent) && /Questions\? Contact Investor Relations at investors@harborridge\.example\./.test(req.sent), placeholders(req.shown + req.sent) || `${req.heading}: ${req.sent.slice(-200)}`);
    // the sponsor enters their support contact and a disclosure on Portal and brand
    const ENTERED = { phone: '(646) 867-5309', hours: 'Weekdays, 9 to 5 Eastern', disclosure: 'Shares are offered to accredited investors only.' };
    await asAdmin(J, 'console-brand', '#tb-support-phone');
    const blank = await fr.evaluate(() => ({ phone: document.getElementById('tb-support-phone').value, hours: document.getElementById('tb-support-hours').value, disclosure: document.getElementById('tb-disclaimer').value }));
    check('Portal and brand shows Phone, Hours and Footer disclosure empty for the sponsor to fill in', blank.phone === '' && blank.hours === '' && blank.disclosure === '', blank);
    await fr.fill('#tb-support-phone', ENTERED.phone);
    await fr.fill('#tb-support-hours', ENTERED.hours);
    await fr.fill('#tb-disclaimer', ENTERED.disclosure);
    await fr.waitForTimeout(600);
    const b1 = stepOf(await setupList(J), BRAND_STEP);
    check('once the sponsor has entered their support contact the step is complete', !!b1 && b1.done && b1.button === 'Review', b1);
    await asInvestor(J, J.inv.investorId);
    const home = await screen(fr);
    await fr.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await fr.waitForTimeout(300);
    await J.shot('footer-entered');
    check('and the investor’s footer shows exactly what the sponsor entered (and the Help button)', hasHelp(home) && footer(home) === `Investor Relations ${ENTERED.phone} ${FIRM.support} ${ENTERED.hours} Help ${ENTERED.disclosure} © ${new Date().getFullYear()} Harbor Ridge Capital, LLC`, { foot: footer(home), help: home.footHelp });
    await J.go('account', '.pt-title');
    const line2 = ((await screen(fr)).text.match(/To change these details[^\n]*/) || [''])[0];
    check('the Account page then gives the phone the sponsor entered', line2 === `To change these details, contact Investor Relations at ${ENTERED.phone}.`, line2);
    // a sample firm is as it was
    await fr.selectOption('#demo-sponsor', 'kestrel-bay');
    await fr.waitForFunction(() => window.CVPortal.state.ws.tenant.id === 'kestrel-bay');
    await asInvestor(J, 'KBC-1001');
    const kb = await screen(fr);
    check('the sample firm’s footer is as it was (its phone, hours and disclosure)', kb.foot.indexOf('(212) 555-0148') >= 0 && kb.foot.indexOf('Mon–Fri, 8:30 a.m.–6:00 p.m. ET') >= 0 && kb.foot.indexOf('[Regulatory disclosures to be provided by counsel.]') >= 0, kb.foot.replace(/\s+/g, ' '));
    await quiet(check, J);
  };
}

/* ---------- failure 2: only real documents, and no maturity that was never entered ---------- */
const docRows = (fr, scope) =>
  fr.evaluate((scope) => Array.from(document.querySelectorAll(`${scope} [data-action=open-doc].doc-link, ${scope} [data-action=open-doc].list-title`)).map((b) => ({ id: b.getAttribute('data-id'), title: b.innerText.trim() })), scope);
function documentsPart(vp) {
  return async ({ check, S }) => {
    const J = await journey(S, vp, check);
    const { fr, press } = J;
    if (!J.seen.reached) return;
    await ownPortal(J);
    const iid = J.inv.investorId;
    // The sponsor accepts the subscription: Approve, then Countersign. When the investor's agreement waits for the firm's
    // signature, Countersign opens the firm's signing of it and the commitment is recorded once that signing is finished
    // (plan 06-32), so the firm signs it here on screen; otherwise Countersign records at once.
    let countersign = 'not pressed (already held)';
    if (!(await fr.evaluate((id) => window.CVPortal.state.ws.investors.find((x) => x.id === id).positions.length, iid))) {
      await asAdmin(J, 'console-requests', '[data-action=req-approve]');
      await press('main [data-action=req-approve]');
      await fr.waitForTimeout(500);
      if (await fr.locator('main [data-action=req-approve]').count()) {
        await press('main [data-action=req-approve]');
        await fr.waitForTimeout(500);
      }
      await fr.waitForSelector('main [data-action=req-funded]', { timeout: 10000 });
      await press('main [data-action=req-funded]');
      await fr.waitForTimeout(900);
      if (await fr.locator('.es-sign-console').count()) {
        const signed = await firmSigns(J, iid);
        countersign = Object.assign({ path: 'the firm’s signing view opened' }, signed);
        check('Countersign opens the firm’s signing of the agreement, and the firm finishes it on screen', signed.finished && signed.request === 'accepted', signed);
      } else countersign = 'recorded at once (no signing view)';
    }
    const real = await fr.evaluate((id) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const inv = ws.investors.find((x) => x.id === id);
      const r = (ws.requests || []).filter((x) => x.investorId === id && x.type === 'subscription').pop();
      const env = r && r.envelopeId ? (ws.envelopes || []).find((e) => e.id === r.envelopeId) : null;
      return { positions: inv.positions.length, agreement: env ? { id: env.id, status: env.status, title: env.title } : null, docs: NS.ops.docsFor(ws, inv).map((d) => ({ id: d.id, title: d.title, envelopeId: d.envelopeId || '' })) };
    }, iid);
    check('after Approve and Countersign the investor holds the offering', real.positions === 1, Object.assign({ countersign }, real));
    // The real documents: what the sponsor published, the investor's own W-9 and, once the firm has countersigned (the
    // agreement completed, plan 06-32), the signed copy of the agreement the investor and the firm signed. Nothing else.
    const summaryDoc = real.docs.find((d) => d.title === 'Offering summary');
    const agreed = real.agreement && real.agreement.status === 'completed' ? real.docs.find((d) => d.envelopeId === real.agreement.id && d.title === real.agreement.title) : null;
    const wantDocs = 2 + (real.agreement && real.agreement.status === 'completed' ? 1 : 0);
    check('the real documents exist for the investor: the published summary, their own W-9 and, once countersigned, the agreement they and the firm signed; nothing else', real.docs.length === wantDocs && !!summaryDoc && real.docs.some((d) => /^Form W-9/.test(d.title)) && (wantDocs === 2 || !!agreed), { agreement: real.agreement, docs: real.docs });
    const realIds = real.docs.map((d) => d.id).sort();
    const same = (rows) => JSON.stringify(rows.map((r) => r.id).sort()) === JSON.stringify(realIds);
    // Documents
    await asInvestor(J, iid);
    await J.go('documents', '.pt-title');
    const page = await screen(fr);
    const rows = await docRows(fr, '.tbl-docs');
    await J.shot('documents');
    check('Documents lists exactly those, and nothing nobody made', same(rows) && !GENERATED_RE.test(page.text), rows.map((r) => r.title));
    // each one opens as the real file (never a generated page "Prepared for" the investor)
    const opened = [];
    for (const r of rows) {
      await press(fr.locator(`.tbl-docs [data-action=open-doc][data-id="${r.id}"].doc-link`));
      await fr.waitForSelector('#dlg[open]', { timeout: 15000 });
      await fr.waitForFunction(() => !/Loading/.test((document.querySelector('#dlg .dlg-body') || {}).innerText || ''), null, { timeout: 30000 }).catch(() => {});
      await fr.waitForTimeout(500);
      opened.push(await fr.evaluate(() => ({ text: document.getElementById('dlg').innerText.replace(/\s+/g, ' ').slice(0, 400), paper: !!document.querySelector('#dlg .paper'), drawn: document.querySelectorAll('#dlg .dlg-body img, #dlg .dlg-body canvas, #dlg .dlg-body pre').length })));
      await press('#dlg [data-action="close-dialog"][aria-label="Close"]');
      await fr.waitForFunction(() => !document.getElementById('dlg').open);
    }
    check('each opens as the file itself: no generated page, no "Prepared for", no 1900', opened.length === rows.length && opened.every((o) => !o.paper && o.drawn >= 1 && !/Prepared for/.test(o.text) && !NINETEEN_RE.test(o.text)), opened);
    // Home
    await J.go('overview', '.hm-head');
    const home = await screen(fr);
    const recent = await docRows(fr, 'section[aria-label="Recent documents"]');
    check('Home’s "Recent documents" lists the same ones', same(recent) && !GENERATED_RE.test(home.text), recent.map((r) => r.title));
    const toExit = await fr.evaluate(() => Array.from(document.querySelectorAll('td[data-label="Time to exit"]')).map((td) => td.innerText.trim()));
    check('Home prints no maturity, no 1900 and no "Matured" for the offering', !NINETEEN_RE.test(home.text) && !MATURED_RE.test(home.text) && !MATURITY_RE.test(home.text) && toExit.length === 1 && !toExit[0], { toExit, found: (home.text.match(/[^\n]*(1900|Matur)[^\n]*/i) || [''])[0] });
    // Investments
    await J.go('investments', '.pt-title');
    const invs = await screen(fr);
    const red = await fr.evaluate(() => Array.from(document.querySelectorAll('td[data-label="Time to redemption"]')).map((td) => td.innerText.replace(/\s+/g, ' ').trim()));
    await J.shot('investments');
    check('Investments shows "Time to redemption: Not set", with no "Matured" and no 1900', red.length === 1 && red[0] === 'Not set' && !MATURED_RE.test(invs.text) && !NINETEEN_RE.test(invs.text), { red, found: (invs.text.match(/[^\n]*(1900|Matur)[^\n]*/i) || [''])[0] });
    // the investment page
    await J.go('investment-' + J.off.id, '.pt-title');
    const one = await screen(fr);
    const there = await docRows(fr, '.tbl-docs');
    // Its figures and its term section; its key terms are what the sponsor set up (the type's terms, each shown or hidden on
    // the offering page), so a term labelled "Maturity" may be listed, with no date.
    const parts = await fr.evaluate(() => {
      const secs = Array.from(document.querySelectorAll('main .sec'));
      const head = (s) => ((s.querySelector('.sec-head h2') || {}).textContent || '').trim();
      const kt = secs.find((s) => head(s) === 'Key terms');
      const term = secs.find((s) => /^(Term|Time to exit|Holding period)$/.test(head(s)));
      return { figs: (document.querySelector('main dl.figs') || {}).innerText || '', term: term ? { text: term.innerText, body: term.innerText.replace(head(term), '').trim() } : null, keyTerms: kt ? Array.from(kt.querySelectorAll('dl.terms > div')).map((d) => [d.children[0].innerText.trim(), d.children[1].innerText.trim()]) : [] };
    });
    await J.shot('investment');
    // The term section is left out when it has nothing to say (no empty box in its place).
    check('the investment page prints no maturity in its figures or its term (left out, not an empty box), no 1900 and no "Matured", and no date for a key term "Maturity"', !MATURITY_RE.test(parts.figs) && (!parts.term || (!!parts.term.body && !MATURITY_RE.test(parts.term.text))) && !NINETEEN_RE.test(one.text) && !MATURED_RE.test(one.text) && parts.keyTerms.every(([k, v]) => !MATURITY_RE.test(k) || !v), { parts, found: (one.text.match(/[^\n]*(1900|Matur)[^\n]*/gi) || []).slice(0, 4) });
    // the offering's own documents: the published summary and, once countersigned, the agreement the investor signed
    const offeringIds = [summaryDoc ? summaryDoc.id : 'Offering summary'].concat(agreed ? [agreed.id] : []).sort();
    check('and lists only the published summary (and, once countersigned, the agreement they signed) under Documents', JSON.stringify(there.map((r) => r.id).sort()) === JSON.stringify(offeringIds) && there.some((r) => r.title === 'Offering summary') && !GENERATED_RE.test(one.text), there.map((r) => r.title));
    // Distributions and Updates
    const others = [];
    for (const h of ['distributions', 'updates']) {
      await J.go(h, '.pt-title');
      others.push(await screen(fr));
    }
    check('Distributions and Updates print no 1900 and no "Matured"', others.every((s) => !NINETEEN_RE.test(s.text) && !MATURED_RE.test(s.text)), others.map((s) => (s.text.match(/[^\n]*(1900|Matured)[^\n]*/i) || [''])[0]));
    // the sponsor's own screens
    const spon = [];
    for (const [h, sel] of [['console', '.cs-head'], ['console-offerings', '.cs-tbl'], ['console-offering-' + J.off.id, '#agreement']]) {
      await asAdmin(J, h, sel);
      spon.push(await screen(fr));
    }
    check('the sponsor’s Overview, Offerings table and offering page print no 1900 and no "Matured"', spon.every((s) => !NINETEEN_RE.test(s.text) && !MATURED_RE.test(s.text)), spon.map((s) => `${s.hash}: ${(s.text.match(/[^\n]*(1900|Matured)[^\n]*/i) || [''])[0]}`));
    const exitCell = await fr.evaluate(() => {
      const dl = Array.from(document.querySelectorAll('.pv-figs > div')).map((d) => Array.from(d.children).map((c) => c.textContent.trim()).join(' '));
      return dl[dl.length - 1] || '';
    });
    check('the offering page’s "What investors see" reads "Projected exit Not set"', exitCell === 'Projected exit Not set', exitCell);
    // with a maturity date entered, the maturity is shown
    await fr.fill('#of-exit-date', '2031-06-30');
    await fr.waitForTimeout(500);
    await asInvestor(J, iid);
    await J.go('investments', '.pt-title');
    const red2 = await fr.evaluate(() => Array.from(document.querySelectorAll('td[data-label="Time to redemption"]')).map((td) => td.innerText.replace(/\s+/g, ' ').trim()));
    await J.go('investment-' + J.off.id, '.pt-title');
    const one2 = await screen(fr);
    check('once the sponsor enters a maturity date, the investor sees it ("Matures Jun 30, 2031")', red2.length === 1 && /Matures Jun 30, 2031$/.test(red2[0]) && /Maturity\s+Jun 30, 2031/i.test(one2.text), { red2, found: (one2.text.match(/[^\n]*Maturity[^\n]*\n[^\n]*/i) || [''])[0] });
    // a sample firm is as it was
    await fr.selectOption('#demo-sponsor', 'kestrel-bay');
    await fr.waitForFunction(() => window.CVPortal.state.ws.tenant.id === 'kestrel-bay');
    await asInvestor(J, 'KBC-1001');
    await J.go('documents', '.pt-title');
    const kbDocs = (await docRows(fr, '.tbl-docs')).map((r) => r.title);
    await J.go('investments', '.pt-title');
    const kbRed = await fr.evaluate(() => Array.from(document.querySelectorAll('td[data-label="Time to redemption"]')).map((td) => td.innerText.replace(/\s+/g, ' ').trim()));
    const year = new Date().getFullYear();
    check('the sample firm’s investor still has the sample documents and the note’s maturity', ['Note Purchase Agreement', `Q3 ${year} Investor Update`, `Capital Account Statement, Q3 ${year}`, 'Subscription Agreement'].every((t) => kbDocs.indexOf(t) >= 0) && kbRed.some((x) => /Matures? Jun 30, 2027|Matured Jun 30, 2027/.test(x)), { docs: kbDocs.length, kbRed });
    await quiet(check, J);
  };
}

/* ---------- the managed edition is as it was ---------- */
async function managedPart({ check, S }) {
  const J = await framed(S, 'desktop', 'index.html');
  const { fr, press } = J;
  await fr.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 30000 });
  check('the page is the managed edition', await fr.evaluate(() => window.CVPortal.EDITION.managed === true));
  await J.go('console-new-client', '#nc-name');
  await fr.fill('#nc-name', 'Harrow Point Partners');
  await fr.fill('#nc-domain', 'investors.harrowpoint.example');
  await fr.fill('#nc-email', 'ir@harrowpoint.example');
  await press('form[data-form="new-client"] button[type=submit]');
  await fr.waitForFunction(() => window.CVPortal.state.ws.tenant.id === 'harrow-point-partners' && location.hash === '#console', null, { timeout: 20000 });
  await fr.waitForTimeout(400);
  const made = await fr.evaluate(() => {
    const NS = window.CVPortal;
    const t = NS.state.ws.tenant;
    const steps = Array.from(document.querySelectorAll('.cs-steps > li')).map((li) => ({ name: li.querySelector('strong').textContent.trim(), done: li.classList.contains('is-done') }));
    const foot = NS.portalFooter();
    return { phone: t.support.phone, hours: t.support.hours, disclaimer: t.disclaimer, steps, footer: foot.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), help: /data-action="help-open"|\bHelp\b/.test(foot) };
  });
  check('a client added in the managed edition keeps the standard phone, hours and disclosure', made.phone === '(212) 555-0100' && made.hours === 'Mon–Fri, 9:00 a.m.–5:00 p.m. ET' && /\[Regulatory disclosures to be provided by counsel\.\]$/.test(made.disclaimer), made);
  // The footer's Help button is the self-serve edition's (plan 07-03): the managed edition's footer has none.
  check('its portal footer prints them, as before, with no Help button', made.footer.indexOf('(212) 555-0100') >= 0 && made.footer.indexOf('Mon–Fri, 9:00 a.m.–5:00 p.m. ET') >= 0 && made.footer.indexOf('[Regulatory disclosures to be provided by counsel.]') >= 0 && !made.help, { footer: made.footer, help: made.help });
  check('its "Client setup" list has 5 steps and "Brand the investor portal" is complete from the domain and email given', made.steps.length === 5 && made.steps[0].name === BRAND_STEP && made.steps[0].done, made.steps);
  // an offering and an investor with a position, by the managed edition's own forms
  await J.go('console-offerings', '[data-action=off-add]');
  await press('[data-action=off-add]');
  await fr.waitForFunction(() => /^#console-offering-/.test(location.hash));
  await J.go('console-investors', '[data-action=invite-toggle]');
  await press('[data-action=invite-toggle]');
  await fr.waitForSelector('#iv-contact');
  await fr.fill('#iv-contact', 'Petra');
  await fr.fill('#iv-last-name', 'Lindqvist');
  await fr.fill('#iv-email', 'petra.lindqvist@example.com');
  await fr.fill('#iv-amt', '100000');
  await press('form[data-form="invite-one"] button[type=submit]');
  await fr.waitForSelector('#dlg[open] article.email', { timeout: 15000 });
  const mail = await fr.evaluate(() => document.querySelector('#dlg article.email').innerText.replace(/\s+/g, ' '));
  check('the managed edition’s invitation email reads as before, with the standard phone', /Questions\? Contact Harrow Point Investor Relations at \(212\) 555-0100\./.test(mail), mail.slice(-200));
  const docs = await fr.evaluate(() => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const inv = ws.investors.find((i) => i.email === 'petra.lindqvist@example.com');
    return NS.investorDocs(ws, NS.investorView(ws, inv.id)).map((d) => d.title);
  });
  const year = new Date().getFullYear();
  check('and its investor’s documents are built as before', ['Subscription Agreement', `Q3 ${year} Investor Update`, `Q2 ${year} Investor Update`, `Capital Account Statement, Q3 ${year}`].every((t) => docs.indexOf(t) >= 0) && docs.length === 4, docs);
  check('no script error in the browser', J.A.errors.length === 0, J.A.errors);
  check('no request left the check server', J.A.net.external.length === 0, J.A.net.external);
  await J.A.context.close();
}

Lib.runParts(
  {
    'setup-desktop': setupPart('desktop'),
    'setup-phone': setupPart('phone'),
    'shortname-desktop': shortnamePart('desktop'),
    'shortname-phone': shortnamePart('phone'),
    'contact-desktop': contactPart('desktop'),
    'contact-phone': contactPart('phone'),
    'documents-desktop': documentsPart('desktop'),
    'documents-phone': documentsPart('phone'),
    managed: managedPart
  },
  { name: 'REAL FIRM', unit: 'parts', flag: '--only', browser: true }
);
