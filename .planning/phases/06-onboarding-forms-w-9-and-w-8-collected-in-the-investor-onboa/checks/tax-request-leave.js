#!/usr/bin/env node
// Debug session tax-info-view-cant-leave (owner, published preview build 13: "when viewing the tax info that was filled in
// the onboarding workflow you cant leave the page"). A tax-form request (plan 06-26, "Request tax form") opens the official
// form pre-filled from what onboarding recorded. Its flow starts on the tax step, and the invitation page drew Back only on
// steps after the first; the page has no portal menu, no demo bar and no "Back to console" bar. So the request's tax step,
// and the form behind it, could not be left without finishing the form.
// Every part runs the portal inside a sandboxed iframe, as the artifact host shows it.
//   request    the investor opens the request from the portal: Back on its first step returns to the portal; from the form,
//              Back then Back; the step's content is unchanged; the request is still offered and opens again where it was
//   phone      the same on a phone-sized touch screen
//   preview    the sponsor's own investor preview ("View portal"): Back returns to the portal, whose demo bar leads to the console
//   welcome    a request for an investor with no consent on record starts on Welcome: Back there returns to the portal
//   onboarding a new investor's invitation is unchanged: no Back on Welcome, Back on the next step
//   NODE_PATH=$(npm root -g) node tax-request-leave.js [--only request,phone,preview,welcome,onboarding]
// The last line is "TAX REQUEST LEAVE: PASS (parts run: N)" or "TAX REQUEST LEAVE: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');

const OUT = path.join(Lib.OUT, 'tax-request-leave');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-step\.png$/, 'The tax-form request opened from the portal: the pre-filled Form W-9 step with Back beside Continue to the form.'],
  [/-left\.png$/, 'After Back on the tax-form request: the investor portal, with the request still offered.']
]);

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** A fresh context whose page holds the portal in a sandboxed iframe; resolves to { A, fr } (fr: the portal's frame). */
async function framed(S, context) {
  const A = await Lib.open(S, context ? { context } : undefined);
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${S.base}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  return { A, fr };
}

/**
 * The sample portal in the frame, with one active individual whose Form W-9 was finished without a signature (D-30: the
 * form view says nothing is required), as the owner's own run left it. consent: whether their consent to electronic records
 * and signatures is on the record (a request without it starts on Welcome).
 */
async function portalWithUnsignedW9(S, A, fr, consent) {
  await Lib.setupPortal(S, { page: fr, context: A.context });
  return fr.evaluate((consent) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const a = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.email);
    if (consent) a.esignConsent = { at: '2026-03-02T15:04:05Z', scope: 'Electronic records and signatures (ESIGN Act, UETA)' };
    else delete a.esignConsent;
    Object.assign(a, { contact: 'Renée Zoë Ångström', title: 'Renée Zoë Ångström', taxType: 'us-individual', address: '12 Elm Street, Austin, TX 78701', country: 'United States', citizenship: 'us', taxForm: 'W-9', taxCert: { form: 'W-9', revision: 'Rev. March 2024', envelopeId: 'env-old-unsigned', at: new Date().toISOString(), signed: false, signedBy: '' } });
    NS.app.save(true);
    return { id: a.id, email: a.email };
  }, consent);
}

/** The sponsor's Investors page: the row of this investor. */
async function row(fr, email) {
  await Lib.consoleRoute(fr, 'console-investors', '.cs-tbl');
  return fr.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: email }).first();
}

/** "Request tax form" on the investor's row, its email dialog closed again. */
async function request(fr, email) {
  const r = await row(fr, email);
  await r.locator('[data-action="tax-request"]').click();
  await fr.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 });
  await fr.click('#dlg [data-action="close-dialog"]');
  await fr.waitForFunction(() => !document.getElementById('dlg').open);
}

/** Signed in as the investor (the demo bar's "Signed in as"), on the portal page that offers the request. */
async function asInvestor(fr, id) {
  await fr.evaluate((id) => (window.CVPortal.state.viewer = id), id);
  await fr.selectOption('#demo-role', 'investor');
  await fr.waitForFunction(() => location.hash === '#overview');
  return cta(fr);
}
/** The portal's "Complete your tax form" link (Home, else Investments). */
async function cta(fr) {
  for (const hash of ['overview', 'investments']) {
    if (hash !== 'overview') await fr.evaluate((h) => (location.hash = h), hash);
    await fr.waitForTimeout(400);
    const l = fr.locator('a', { hasText: 'Complete your tax form' }).first();
    if (await l.count()) return l;
  }
  return null;
}

/** What the request's step shows: heading, step count, visible inputs, buttons and links in the step, the Back button. */
const stepState = (fr) =>
  fr.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const form = document.querySelector('.ivf-form');
    const back = form ? Array.from(form.querySelectorAll('.ob-actions a, .ob-actions button')).find((b) => vis(b) && b.innerText.trim() === 'Back') : null;
    return {
      hash: location.hash.replace(/^#(invite-).*/, '#$1…'),
      h1: (document.querySelector('.ivf-form h1') || document.querySelector('h1') || {}).innerText || '',
      count: (document.querySelector('.ivf-progress .ob-count') || {}).innerText || '',
      taxSign: !!document.querySelector('.ivf-tax-sign'),
      inputs: form ? Array.from(form.querySelectorAll('input, select, textarea')).filter((el) => el.type !== 'hidden' && vis(el)).map((el) => el.id || el.name) : [],
      text: form ? form.innerText.replace(/\s+/g, ' ') : '',
      controls: form ? Array.from(form.querySelectorAll('a, button')).filter(vis).map((b) => b.innerText.trim()) : [],
      back: back ? back.innerText.trim() : '',
      previewBar: !!document.querySelector('.pvbar-back')
    };
  });
const backButton = (fr) => fr.locator('.ivf-form .ob-actions >> text="Back"').first();

/** The request's first step: its content as plan 06-26 made it (unchanged by this fix). */
function contentUnchanged(check, s) {
  check('the request opens on "Step 1 of 2: Tax certification"', s.h1 === 'Tax certification' && /^Step 1 of 2/.test(s.count), { h1: s.h1, count: s.count });
  check('the step still says the firm asked for the tax form and the link covers that form only', /asked you for your tax form; this link covers that form only/.test(s.text), s.text.slice(0, 300));
  check('the step still asks only the taxpayer ID (the W-9 is pre-filled from the record)', JSON.stringify(s.inputs) === JSON.stringify(['ob-tin']), s.inputs);
  const want = ['Change your answers', 'Upload it instead', 'Use the form for foreign investors', 'Continue to the form'];
  check('the step keeps Change your answers, Upload it instead, Use the form for foreign investors and Continue to the form', want.every((w) => s.controls.indexOf(w) >= 0), s.controls);
}

/** The investor (desktop or phone): the request from the portal, then every way out of its tax step. */
function requestPart(id, context) {
  return async ({ check, S }) => {
    const { A, fr } = await framed(S, context);
    const who = await portalWithUnsignedW9(S, A, fr, true);
    await request(fr, who.email);
    let link = await asInvestor(fr, who.id);
    check('the portal offers "Complete your tax form"', !!link);
    if (!link) return A.context.close();
    await link.click();
    await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
    let s = await stepState(fr);
    contentUnchanged(check, s);
    check('the request’s tax step has a Back button (a way out without finishing the form)', s.back === 'Back', s.controls);
    await A.page.screenshot({ path: path.join(OUT, `${id}-step.png`), fullPage: true });
    if (s.back) {
      await backButton(fr).click();
      await fr.waitForTimeout(600);
      s = await stepState(fr);
      check('Back on the request’s tax step returns to the portal', s.hash === '#overview' && !s.count, { hash: s.hash, h1: s.h1 });
      link = await cta(fr);
      check('the portal still offers the request, to finish it later', !!link);
      await A.page.screenshot({ path: path.join(OUT, `${id}-left.png`), fullPage: false });
      if (link) {
        await link.click();
        await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
        s = await stepState(fr);
        check('opened again, the request is on its tax step as before', s.h1 === 'Tax certification' && /^Step 1 of 2/.test(s.count), { h1: s.h1, count: s.count });
      }
    }
    // The pre-filled form itself: Back to the answers, then Back to the portal.
    await fr.fill('#ob-tin', '468023917');
    await Lib.submit(fr);
    await fr.waitForSelector('.ivf-tax-sign .es-finish', { timeout: 60000 });
    s = await stepState(fr);
    check('Continue to the form shows the pre-filled W-9 on the step', s.taxSign && s.h1 === 'Tax certification', { taxSign: s.taxSign, h1: s.h1 });
    await fr.click('.ivf-tax-sign [data-action="ivf-taxanswers"]');
    await fr.waitForFunction(() => !document.querySelector('.ivf-tax-sign'));
    s = await stepState(fr);
    check('from the form, Back returns to the answers', !s.taxSign && s.h1 === 'Tax certification', { taxSign: s.taxSign, h1: s.h1 });
    if (s.back) {
      await backButton(fr).click();
      await fr.waitForTimeout(600);
      s = await stepState(fr);
    }
    check('and Back again returns to the portal', s.hash === '#overview' && !s.count, { hash: s.hash, h1: s.h1, controls: s.controls });
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

/** The sponsor previewing as the investor ("View portal"): Back returns to the preview, and "Back to console" works. */
async function previewPart({ check, S }) {
  const { A, fr } = await framed(S);
  const who = await portalWithUnsignedW9(S, A, fr, true);
  await request(fr, who.email);
  const r = await row(fr, who.email);
  await r.locator('[data-action="view-as"]').click();
  await fr.waitForFunction(() => location.hash === '#overview');
  const link = await cta(fr);
  check('the investor preview offers "Complete your tax form"', !!link);
  if (!link) return A.context.close();
  await link.click();
  await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
  let s = await stepState(fr);
  check('the request opens in the preview on its tax step', s.h1 === 'Tax certification' && /^Step 1 of 2/.test(s.count), { h1: s.h1, count: s.count });
  check('the request’s tax step in the preview has a Back button', s.back === 'Back', s.controls);
  if (s.back) {
    await backButton(fr).click();
    await fr.waitForTimeout(600);
    s = await stepState(fr);
  }
  // Opening an invitation signs in as its investor (onboarding.js ensureFlow), so Back lands on the investor's portal, where
  // the demo bar's "Signed in as" takes the sponsor back to the console.
  const bar = await fr.locator('#demo-role').count();
  check('Back returns to the portal, where the demo bar’s "Signed in as" is offered again', s.hash === '#overview' && !s.count && bar === 1, { hash: s.hash, demoRole: bar });
  if (bar) {
    await fr.selectOption('#demo-role', 'admin');
    await fr.waitForTimeout(600);
    s = await stepState(fr);
    check('"Signed in as" Admin returns the sponsor to the console', s.hash === '#console', s.hash);
  }
  check('no script error in the browser', A.errors.length === 0, A.errors);
  await A.context.close();
}

/** A request for an investor with no consent on record starts on Welcome: Back there returns to the portal. */
async function welcomePart({ check, S }) {
  const { A, fr } = await framed(S);
  const who = await portalWithUnsignedW9(S, A, fr, false);
  await request(fr, who.email);
  const link = await asInvestor(fr, who.id);
  check('the portal offers "Complete your tax form"', !!link);
  if (!link) return A.context.close();
  await link.click();
  await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
  let s = await stepState(fr);
  check('the request starts on "Step 1 of 3: Welcome" (consent to electronic signatures asked first)', /^Welcome/.test(s.h1) && /^Step 1 of 3/.test(s.count), { h1: s.h1, count: s.count });
  check('the Welcome step of a request has a Back button', s.back === 'Back', s.controls);
  if (s.back) {
    await backButton(fr).click();
    await fr.waitForTimeout(600);
    s = await stepState(fr);
  }
  check('Back on it returns to the portal', s.hash === '#overview' && !s.count, { hash: s.hash, h1: s.h1 });
  check('no script error in the browser', A.errors.length === 0, A.errors);
  await A.context.close();
}

/** A new investor's invitation (no portal yet) is unchanged: no Back on Welcome, Back on the next step. */
async function onboardingPart({ check, S }) {
  const { A, fr } = await framed(S);
  const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
  const inv = await Lib.createInvitation(fr, { name: 'Odile Brennan-Sato', email: 'odile.brennan@example.com', type: 'individual', offeringId: portal.offeringId });
  await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
  await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
  let s = await stepState(fr);
  check('a new investor’s invitation opens on Welcome with no Back (nothing before it)', /^Welcome/.test(s.h1) && !s.back, { h1: s.h1, controls: s.controls });
  await fr.check('#ob-esignConsent');
  if (await fr.locator('#ob-edelivery').count()) await fr.check('#ob-edelivery');
  await Lib.submit(fr);
  s = await stepState(fr);
  check('its next step has Back, as before', /Create your login/.test(s.h1) && s.back === 'Back', { h1: s.h1, controls: s.controls });
  if (s.back) {
    await backButton(fr).click();
    await fr.waitForTimeout(500);
    s = await stepState(fr);
    check('which returns to Welcome', /^Welcome/.test(s.h1), s.h1);
  }
  check('no script error in the browser', A.errors.length === 0, A.errors);
  await A.context.close();
}

Lib.runParts(
  {
    request: requestPart('request'),
    phone: requestPart('phone', PHONE),
    preview: previewPart,
    welcome: welcomePart,
    onboarding: onboardingPart
  },
  { name: 'TAX REQUEST LEAVE', unit: 'parts', flag: '--only', browser: true }
);
