#!/usr/bin/env node
// Plan 06-29 (owner, published preview: "when viewing the tax info that was filled in the onboarding workflow you cant leave
// the page, its broken"). Every view that shows tax information, or leads to it, must be leavable in one obvious step, on a
// desktop and on a phone, inside a sandboxed iframe as the artifact host shows the portal. Every part runs framed, at
// 1280x800 (-desktop) and 390x844 touch (-phone).
//   signing   a new investor's onboarding: the W-9 signing view and the agreement signing view keep Back and the signing
//             progress on screen at the top, middle and end of the document; Back leaves each. Then, on the portal, the signed
//             W-9 opened from Home and from Documents is drawn in the page (no browser PDF viewer, which Chrome blocks in
//             sandboxed frames) with its X and Download; X, Escape with focus inside the viewer and browser back each close it
//             without changing the page; after the dialog, one browser back leaves the page. Account shows the form on file
//             and leaves; the console row's Download leaves the page as it was; the console's Account dialog closes with
//             Escape and with browser back.
//   request   a tax-form request (plan 06-26): its first step's Back returns to the portal, which offers the request again;
//             its signing view keeps Back on screen at every position; Back, then Back, returns to the portal.
//   short     an investor on file invited to subscribe: the invite form shows no "Investor type" for their email (shown for a
//             new email); the short flow's Welcome has Back, which returns to the portal, where the invitation is offered.
//   server    server mode (plan 06-06), the investor's own device: Back on the request's first step leads to the device's
//             portal page, which offers "Complete your tax form", which opens the request again.
//   NODE_PATH=$(npm root -g) node ways-out.js [--only signing-desktop,signing-phone,request-desktop,request-phone,short-desktop,short-phone,server]
// The last line is "WAYS OUT: PASS (parts run: N)" or "WAYS OUT: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');

const OUT = path.join(Lib.OUT, 'ways-out');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-tax-sign-mid\.png$/, 'The W-9 signing view scrolled to the middle of the form: Back and the signing progress stay on screen.'],
  [/-agr-sign-mid\.png$/, 'The subscription agreement signing view scrolled to the middle: Back and the signing progress stay on screen.'],
  [/-w9-dialog\.png$/, 'The signed W-9 opened from the portal: its pages drawn in the dialog, with Download and the X.'],
  [/-req-sign-mid\.png$/, 'A tax-form request’s signing view scrolled to the middle: Back stays on screen.'],
  [/-short-welcome\.png$/, 'An investor on file invited to subscribe: the Welcome step with Back to the portal.'],
  [/-invite-onfile\.png$/, 'The invite form for an investor on file: no "Investor type".'],
  [/-device-portal\.png$/, 'Server mode, the investor’s device after Back on the request: the portal offers "Complete your tax form".']
]);

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};

/** A fresh context whose page holds `src` (the portal by default) in a sandboxed iframe; resolves to { A, fr }. */
async function framed(S, vp, opts) {
  opts = opts || {};
  const A = await Lib.open(S, Object.assign({ context: Object.assign({ acceptDownloads: true }, VIEW[vp]) }, opts.open || {}));
  const src = opts.src || S.base;
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${src}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  return { A, fr };
}

const hash = (fr) => fr.evaluate(() => location.hash);
const dlgOpen = (fr) => fr.evaluate(() => !!(document.getElementById('dlg') || {}).open);
/** Browser back, as the frame's own history sees it (the artifact host has no address bar; this is the back gesture). */
async function browserBack(fr) {
  await fr.evaluate(() => history.back());
  await fr.waitForTimeout(800);
}

/**
 * The signing view on screen (root: its container): at the top, the middle and the end of the document, whether a visible
 * Back button and the signing progress are inside the viewport and not covered. Resolves to { at: [{ y, back, progress }], n }.
 */
async function reach(fr, root) {
  const total = await fr.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const at = [];
  for (const y of [0, Math.round(total / 2), total]) {
    await fr.evaluate((y) => window.scrollTo(0, y), y);
    await fr.waitForTimeout(350);
    at.push(
      await fr.evaluate((root) => {
        const box = document.querySelector(root);
        const onScreen = (el) => {
          if (!el || !(el.offsetWidth || el.offsetHeight)) return false;
          const r = el.getBoundingClientRect();
          if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth || !r.width || !r.height) return false;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!hit && (hit === el || el.contains(hit));
        };
        const backs = box ? Array.from(box.closest('.ivf-form, .pt-main, body').querySelectorAll('button, a')).filter((b) => b.innerText.trim() === 'Back') : [];
        const progress = box ? box.querySelector('.sf-count') : null;
        return { y: Math.round(scrollY), back: backs.some(onScreen), progress: onScreen(progress) };
      }, root)
    );
  }
  return { at, n: total };
}
/** Click the Back button that is on screen now (the way a person would, without scrolling to the end). */
const clickBackOnScreen = (fr) =>
  fr.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return el.offsetWidth && r.top >= 0 && r.bottom <= innerHeight;
    };
    const b = Array.from(document.querySelectorAll('.ivf-form button, .ivf-form a')).find((x) => x.innerText.trim() === 'Back' && vis(x));
    if (!b) return false;
    b.click();
    return true;
  });

/** A form step's Back, beside its Continue at the end of the step (scrolled to, as the step's own button is). */
const clickStepBack = (fr) =>
  fr.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.ivf-form .ob-actions button, .ivf-form .ob-actions a')).find((x) => x.innerText.trim() === 'Back' && x.offsetWidth);
    if (!b) return false;
    b.scrollIntoView({ block: 'center' });
    b.click();
    return true;
  });

function checkReach(check, what, r) {
  check(`${what}: Back is on screen at the top, the middle and the end of the document`, r.at.every((x) => x.back), r.at);
  check(`${what}: the signing progress is on screen at the top, the middle and the end`, r.at.every((x) => x.progress), r.at);
}

/** The investor's W-9 signing view: consent (if asked) and the signature, as forms-flow signs it. */
async function signW9(fr, investorId) {
  if (await fr.locator('#es-consent-box').count()) {
    await fr.check('#es-consent-box');
    await fr.click('[data-action="es-consent"]');
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
  await fr.locator(`.es-doc-sign [data-fid="${fid}"]`).scrollIntoViewIfNeeded();
  await fr.click(`.es-doc-sign [data-fid="${fid}"]`);
  await fr.waitForTimeout(250);
  if (await dlgOpen(fr)) {
    await fr.click('[data-action="es-adopt"]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open);
  }
  return true;
}

/**
 * A document dialog (opened by open()): drawn in the page with X and Download; X, Escape with focus inside the viewer and
 * browser back each close it with the page unchanged; one more browser back then leaves the page.
 */
async function dialogWaysOut(check, A, fr, what, open, shot) {
  const before = await hash(fr);
  await open();
  await fr.waitForSelector('#dlg[open]', { timeout: 15000 });
  await fr.waitForFunction(() => !/Loading/.test((document.querySelector('#dlg .dlg-body') || {}).innerText || ''), null, { timeout: 30000 }).catch(() => {});
  await fr.waitForTimeout(800);
  const v = await fr.evaluate(() => {
    const d = document.getElementById('dlg');
    const imgs = Array.from(d.querySelectorAll('.dlg-body img, .dlg-body canvas'));
    const x = d.querySelector('[data-action="close-dialog"][aria-label="Close"]');
    const r = x ? x.getBoundingClientRect() : null;
    const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    return {
      frames: d.querySelectorAll('iframe, embed, object').length,
      pages: imgs.filter((i) => (i.tagName === 'IMG' ? i.complete && i.naturalWidth > 0 : i.width > 0)).length,
      x: !!r && r.top >= 0 && r.bottom <= innerHeight && !!hit && (hit === x || x.contains(hit)),
      download: Array.from(d.querySelectorAll('button')).some((b) => /Download/.test(b.innerText)),
      text: d.innerText.replace(/\s+/g, ' ').slice(0, 160)
    };
  });
  if (shot) await A.page.screenshot({ path: path.join(OUT, shot), fullPage: false });
  check(`${what}: the form is drawn in the page (page images, no browser PDF viewer, which a sandboxed frame blocks)`, v.frames === 0 && v.pages >= 1, v);
  check(`${what}: the dialog keeps its X (on screen, not covered) and Download`, v.x && v.download, v);
  await fr.click('#dlg [data-action="close-dialog"][aria-label="Close"]');
  await fr.waitForTimeout(400);
  check(`${what}: the X closes it, the page unchanged`, !(await dlgOpen(fr)) && (await hash(fr)) === before, { open: await dlgOpen(fr), hash: await hash(fr), before });
  // Escape with focus inside the viewer (a click on the document, as a reader does before scrolling it)
  await open();
  await fr.waitForSelector('#dlg[open]', { timeout: 15000 });
  await fr.waitForTimeout(1200);
  const body = await fr.locator('#dlg .dlg-body').boundingBox();
  if (body) await A.page.mouse.click(body.x + body.width / 2, body.y + Math.min(body.height / 2, 200));
  await fr.waitForTimeout(200);
  await A.page.keyboard.press('Escape');
  await fr.waitForTimeout(500);
  check(`${what}: with focus inside the viewer, Escape closes it`, !(await dlgOpen(fr)) && (await hash(fr)) === before, { open: await dlgOpen(fr), hash: await hash(fr) });
  if (await dlgOpen(fr)) await fr.evaluate(() => window.CVPortal.ui.closeDialog());
  // browser back while open: closes the dialog, the page stays
  await open();
  await fr.waitForSelector('#dlg[open]', { timeout: 15000 });
  await fr.waitForTimeout(500);
  await browserBack(fr);
  const afterBack = { open: await dlgOpen(fr), hash: await hash(fr) };
  check(`${what}: browser back with the dialog open closes it and leaves the page as it was`, !afterBack.open && afterBack.hash === before, Object.assign({ before }, afterBack));
  if (afterBack.open) await fr.evaluate(() => window.CVPortal.ui.closeDialog());
  return before;
}

/* ---------- signing: a new investor's onboarding, then the portal and the console ---------- */
function signingPart(vp) {
  return async ({ check, S }) => {
    const { A, fr } = await framed(S, vp);
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const name = vp === 'phone' ? 'Ottoline Varga-Mbeki' : 'Leopold Asante-Ferreira';
    const email = vp === 'phone' ? 'ottoline.varga@example.com' : 'leopold.asante@example.com';
    const inv = await Lib.createInvitation(fr, { name, email, type: 'individual', offeringId: portal.offeringId });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    let w = await Lib.walk(fr, { name, acc: 'yes', basis: 0, until: /Tax certification/ });
    check('the investor reaches the tax step', w.reached, w.seen);
    if (!w.reached) return A.context.close();
    await Lib.submit(fr);
    await fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
    let r = await reach(fr, '.ivf-tax-sign .es-sign');
    await fr.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
    await fr.waitForTimeout(300);
    await A.page.screenshot({ path: path.join(OUT, `${vp}-tax-sign-mid.png`), fullPage: false });
    checkReach(check, 'the W-9 signing view', r);
    let clicked = await clickBackOnScreen(fr);
    await fr.waitForTimeout(600);
    const answers = await fr.evaluate(() => ({ sign: !!document.querySelector('.ivf-tax-sign'), h1: (document.querySelector('.ivf-form h1') || {}).innerText || '' }));
    check('Back from the middle of the W-9 returns to the tax answers', clicked && !answers.sign && answers.h1 === 'Tax certification', Object.assign({ clicked }, answers));
    if (!answers.sign && clicked) {
      await Lib.submit(fr);
      await fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
    }
    const signed = await signW9(fr, inv.investorId);
    check('the W-9 is signed on the page', signed);
    await Lib.finishTaxForm(fr);
    w = await Lib.walk(fr, { name, acc: 'yes', basis: 0 });
    check('the investor reaches the subscription agreement', w.reached, w.seen);
    if (!w.reached) return A.context.close();
    r = await reach(fr, '.ivf-agreement .es-sign');
    await fr.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
    await fr.waitForTimeout(300);
    await A.page.screenshot({ path: path.join(OUT, `${vp}-agr-sign-mid.png`), fullPage: false });
    checkReach(check, 'the agreement signing view', r);
    clicked = await clickBackOnScreen(fr);
    await fr.waitForTimeout(600);
    const sub = await Lib.heading(fr);
    check('Back from the middle of the agreement returns to the step before it (Subscription)', clicked && sub === 'Subscription', { clicked, h1: sub });
    if (clicked && sub === 'Subscription') {
      await Lib.submit(fr);
      await fr.waitForSelector('.es-doc-sign .es-page img', { timeout: 60000 });
    }
    await Lib.finishAgreement(fr);
    await fr.click('.ivf-done a[href="#overview"]');
    await fr.waitForFunction(() => location.hash === '#overview');
    await fr.waitForTimeout(600);
    // The signed W-9 from Home
    const docLink = () => fr.locator('[data-action="es-open-doc"]', { hasText: 'W-9' }).first();
    check('Home lists the signed Form W-9', (await docLink().count()) === 1, await fr.locator('[data-action="es-open-doc"]').allInnerTexts());
    if (await docLink().count()) {
      await dialogWaysOut(check, A, fr, 'Form W-9 from Home', () => docLink().click(), `${vp}-w9-dialog.png`);
      await browserBack(fr);
      check('after the dialog, one browser back leaves Home (one press, one page)', (await hash(fr)) !== '#overview' && !(await dlgOpen(fr)), await hash(fr));
      await fr.evaluate(() => (location.hash = 'overview'));
      await fr.waitForTimeout(500);
    }
    // ... and from Documents
    await fr.evaluate(() => (location.hash = 'documents'));
    await fr.waitForTimeout(700);
    check('Documents lists the signed Form W-9', (await docLink().count()) === 1, await fr.locator('[data-action="es-open-doc"]').allInnerTexts());
    if (await docLink().count()) {
      await dialogWaysOut(check, A, fr, 'Form W-9 from Documents', () => docLink().click());
      await browserBack(fr);
      check('after the dialog, one browser back returns from Documents to Home', (await hash(fr)) === '#overview', await hash(fr));
    }
    // Account: the form on file, and the page leaves
    await fr.evaluate(() => (location.hash = 'account'));
    await fr.waitForTimeout(700);
    const acct = await fr.evaluate(() => ({ text: document.body.innerText.replace(/\s+/g, ' '), home: document.querySelectorAll('a[href="#overview"]').length, modal: !!document.getElementById('dlg').open }));
    check('Account shows "Tax form W-9 on file", with nothing modal and a link Home', /Tax form W-9 on file/.test(acct.text) && acct.home > 0 && !acct.modal, { home: acct.home, modal: acct.modal, text: acct.text.slice(0, 200) });
    await browserBack(fr);
    check('browser back leaves Account', (await hash(fr)) !== '#account', await hash(fr));
    // The console's row: Download only (the page stays, nothing modal); the Account dialog closes with Escape and with back
    await Lib.consoleRoute(fr, 'console-investors', '.cs-tbl');
    const row = fr.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: email }).first();
    const dl = row.locator('[data-action="kyc-iv-file"]', { hasText: 'Download' }).first();
    check('the console row reads "W-9 signed" with a Download', (await dl.count()) === 1 && /W-9 signed/.test(await row.innerText()), (await row.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200));
    if (await dl.count()) {
      const before = await hash(fr);
      const got = A.page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
      await dl.click();
      const d = await got;
      await fr.waitForTimeout(400);
      check('the row’s Download saves the form and leaves the page as it was (nothing modal)', !!d && (await hash(fr)) === before && !(await dlgOpen(fr)), { download: !!d, hash: await hash(fr), open: await dlgOpen(fr) });
    }
    const acc = row.locator('[data-action="co-record"]').first();
    if (await acc.count()) {
      const before = await hash(fr);
      await acc.click();
      await fr.waitForSelector('#dlg[open]', { timeout: 10000 });
      await A.page.keyboard.press('Escape');
      await fr.waitForTimeout(400);
      check('the console’s Account dialog closes with Escape', !(await dlgOpen(fr)) && (await hash(fr)) === before);
      await acc.click();
      await fr.waitForSelector('#dlg[open]', { timeout: 10000 });
      await browserBack(fr);
      check('the console’s Account dialog closes with browser back, the Investors page unchanged', !(await dlgOpen(fr)) && (await hash(fr)) === before, { open: await dlgOpen(fr), hash: await hash(fr) });
    } else check('the console row has its Account button', false);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

/* ---------- request: a tax-form request (plan 06-26) ---------- */
/** One active individual whose W-9 was finished unsigned (D-30), as the owner's run left it. */
async function unsignedW9(fr, consent) {
  return fr.evaluate((consent) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const OPEN = ['sent', 'opened', 'in_progress', 'expired'];
    const a = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.email && !(ws.invitations || []).some((y) => y.investorId === x.id && OPEN.indexOf(y.status) >= 0));
    if (consent) a.esignConsent = { at: '2026-03-02T15:04:05Z', scope: 'Electronic records and signatures (ESIGN Act, UETA)' };
    Object.assign(a, { contact: 'Renée Zoë Ångström', title: 'Renée Zoë Ångström', taxType: 'us-individual', address: '12 Elm Street, Austin, TX 78701', country: 'United States', citizenship: 'us', taxForm: 'W-9', taxCert: { form: 'W-9', revision: 'Rev. March 2024', envelopeId: 'env-old-unsigned', at: new Date().toISOString(), signed: false, signedBy: '' } });
    NS.app.save(true);
    const parts = String(a.contact).split(/\s+/);
    return { id: a.id, email: a.email, first: parts[0], last: parts.slice(1).join(' ') };
  }, consent);
}
async function closeEmailDialog(fr) {
  await fr.waitForSelector('#dlg[open]', { timeout: 15000 }).catch(() => {});
  if (await dlgOpen(fr)) await fr.click('#dlg [data-action="close-dialog"] >> nth=0');
  await fr.waitForFunction(() => !document.getElementById('dlg').open);
}
async function asInvestor(fr, id) {
  await fr.evaluate((id) => (window.CVPortal.state.viewer = id), id);
  await fr.selectOption('#demo-role', 'investor');
  await fr.waitForFunction(() => location.hash === '#overview');
  await fr.waitForTimeout(500);
}
/** The portal's offer of an open invitation (text), on Home or else Investments. */
async function offer(fr, text) {
  for (const h of ['overview', 'investments']) {
    if (h !== 'overview') await fr.evaluate((x) => (location.hash = x), h);
    await fr.waitForTimeout(500);
    const l = fr.locator('a', { hasText: text }).first();
    if (await l.count()) return l;
  }
  return null;
}
function requestPart(vp) {
  return async ({ check, S }) => {
    const { A, fr } = await framed(S, vp);
    await Lib.setupPortal(S, { page: fr, context: A.context });
    const who = await unsignedW9(fr, true);
    await Lib.consoleRoute(fr, 'console-investors', '.cs-tbl');
    await fr.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: who.email }).first().locator('[data-action="tax-request"]').click();
    await closeEmailDialog(fr);
    await asInvestor(fr, who.id);
    let link = await offer(fr, 'Complete your tax form');
    check('the portal offers "Complete your tax form"', !!link);
    if (!link) return A.context.close();
    await link.click();
    await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
    let clicked = await clickStepBack(fr);
    await fr.waitForTimeout(600);
    check('the request’s first step has Back, which returns to the portal', clicked && (await hash(fr)) === '#overview', { clicked, hash: await hash(fr) });
    link = await offer(fr, 'Complete your tax form');
    check('the portal still offers the request', !!link);
    if (!link) return A.context.close();
    await link.click();
    await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
    await fr.fill('#ob-tin', '468023917');
    await Lib.submit(fr);
    await fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
    const r = await reach(fr, '.ivf-tax-sign .es-sign');
    await fr.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
    await fr.waitForTimeout(300);
    await A.page.screenshot({ path: path.join(OUT, `${vp}-req-sign-mid.png`), fullPage: false });
    checkReach(check, 'the request’s W-9 signing view', r);
    clicked = await clickBackOnScreen(fr);
    await fr.waitForTimeout(600);
    const s = await fr.evaluate(() => ({ sign: !!document.querySelector('.ivf-tax-sign'), h1: (document.querySelector('.ivf-form h1') || {}).innerText || '' }));
    check('Back from the middle of the request’s form returns to its answers', clicked && !s.sign && s.h1 === 'Tax certification', Object.assign({ clicked }, s));
    clicked = await clickStepBack(fr);
    await fr.waitForTimeout(600);
    check('and Back again returns to the portal', clicked && (await hash(fr)) === '#overview', { clicked, hash: await hash(fr) });
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

/* ---------- short: an investor on file invited to subscribe ---------- */
function shortPart(vp) {
  return async ({ check, S }) => {
    const { A, fr } = await framed(S, vp);
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const who = await unsignedW9(fr, true);
    await Lib.consoleRoute(fr, 'console-investors', '[data-action=invite-toggle]');
    if ((await fr.locator('#iv-email').count()) === 0) await fr.click('[data-action=invite-toggle]');
    await fr.waitForSelector('#iv-email', { timeout: 10000 });
    const typeShown = () => fr.evaluate(() => {
      const el = document.getElementById('iv-type');
      return !!el && !!(el.offsetWidth || el.offsetHeight) && !el.closest('[hidden]');
    });
    await fr.fill('#iv-contact', 'Wilhelmina');
    await fr.fill('#iv-last', 'Okonkwo-Brandt');
    await fr.fill('#iv-email', 'wilhelmina.okonkwo@example.net');
    await fr.waitForTimeout(200);
    const fresh = await typeShown();
    await fr.fill('#iv-contact', who.first);
    await fr.fill('#iv-last', who.last);
    await fr.fill('#iv-email', who.email);
    await fr.waitForTimeout(200);
    const onFile = await typeShown();
    await A.page.screenshot({ path: path.join(OUT, `${vp}-invite-onfile.png`), fullPage: false });
    check('the invite form shows "Investor type" for a new investor’s email', fresh);
    check('and hides it for an investor on file (the tax form follows their record)', !onFile);
    if (!(await fr.locator('#iv-more[open]').count())) await fr.click('#iv-more summary');
    await fr.selectOption('#iv-off', portal.offeringId);
    await fr.waitForTimeout(250);
    await fr.click('.inv8-form[data-form="invite-one"] button[type=submit]');
    await closeEmailDialog(fr);
    await asInvestor(fr, who.id);
    const link = await offer(fr, 'Continue your subscription');
    check('the portal offers "Continue your subscription"', !!link);
    if (!link) return A.context.close();
    await link.click();
    await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
    const h1 = await Lib.heading(fr);
    await A.page.screenshot({ path: path.join(OUT, `${vp}-short-welcome.png`), fullPage: false });
    check('the invitation opens on Welcome', /^Welcome/.test(h1), h1);
    const clicked = await clickStepBack(fr);
    await fr.waitForTimeout(600);
    check('Welcome has Back, which returns to the portal', clicked && (await hash(fr)) === '#overview', { clicked, hash: await hash(fr) });
    check('the portal still offers the invitation', !!(await offer(fr, 'Continue your subscription')));
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

/* ---------- server: the investor's own device in server mode ---------- */
async function serverPart({ check, S }) {
  const srv = await Lib.serverPortal(S);
  try {
    const C = await Lib.open(S, { allow: [srv.base], init: srv.init });
    const cp = C.page;
    await Lib.setupPortal(S, C);
    check('the console uses the integration server', !!(await srv.configure(cp)));
    const who = await unsignedW9(cp, true);
    await Lib.consoleRoute(cp, 'console-investors', '.cs-tbl');
    await cp.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: who.email }).first().locator('[data-action="tax-request"]').click();
    await cp.waitForFunction((iid) => (window.CVPortal.state.ws.invitations || []).some((x) => x.investorId === iid && x.taxRequest && x.serverId), who.id, { timeout: 30000 });
    const link = await cp.evaluate((iid) => (window.CVPortal.state.ws.invitations || []).filter((y) => y.investorId === iid && y.taxRequest).pop().link, who.id);
    const { A, fr } = await framed(S, 'desktop', { src: link, open: { allow: [srv.base], init: srv.init } });
    await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
    const count = await fr.locator('.ivf-progress .ob-count').innerText();
    check('the device opens the request on its tax step', /^Step 1 of 2/.test(count), count);
    const clicked = await clickStepBack(fr);
    await fr.waitForTimeout(1200);
    await A.page.screenshot({ path: path.join(OUT, 'desktop-device-portal.png'), fullPage: false });
    const l = fr.locator('a', { hasText: 'Complete your tax form' }).first();
    check('Back leads to the device’s portal page, which offers "Complete your tax form"', clicked && (await l.count()) === 1, { clicked, hash: await hash(fr), text: (await fr.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300))) });
    if (await l.count()) {
      await l.click();
      await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
      const again = await fr.locator('.ivf-progress .ob-count').innerText();
      check('which opens the request again on its tax step', /^Step 1 of 2/.test(again), again);
    }
    check('no script error on the device', A.errors.length === 0, A.errors);
    check('no script error in the console', C.errors.length === 0, C.errors);
    await A.context.close();
    await C.context.close();
  } finally {
    await srv.close().catch(() => {});
  }
}

Lib.runParts(
  {
    'signing-desktop': signingPart('desktop'),
    'signing-phone': signingPart('phone'),
    'request-desktop': requestPart('desktop'),
    'request-phone': requestPart('phone'),
    'short-desktop': shortPart('desktop'),
    'short-phone': shortPart('phone'),
    server: serverPart
  },
  { name: 'WAYS OUT', unit: 'parts', flag: '--only', browser: true }
);
