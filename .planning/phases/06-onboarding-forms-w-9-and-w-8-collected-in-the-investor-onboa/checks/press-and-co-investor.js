#!/usr/bin/env node
// Plan 06-37. Two things the owner hit on his iPhone, both needing app.js.
// (1) Walkthrough-2 failure N4: a control redrawn at the moment it is pressed loses the press. Something that finishes in the
//     background (the tax form's page images drawn, a file stored) redraws the whole page between the finger going down and
//     the click, so the pressed control is replaced: with a mouse the click goes to the common ancestor and nothing happens;
//     with touch Chromium may hit the new control, but the pressed one is gone. Each press part makes a background redraw
//     arrive during one press and requires that one press to do what it says, with the pressed control still in the page at
//     its click.
// (2) The co-investor's own sign-in in the self-serve edition (01.4-RESUME 2026-11-19: a co-investor added to an account
//     was never sent anything; only the demo bar could switch to them).
// Every part runs the portal inside the artifact host's sandboxed frame that refuses every connection (connect-src 'none',
// as no-network.js and safari-finish.js), with invented data; no script error, no request leaving the check server, no
// vendor name and never the forbidden word on any screen checked.
//   press-tax-desktop  1280x800, mouse. The W-9's page images held; "Loading document..." on screen; mouse down on Finish,
//                      the images released (the drawing ends and asks for a redraw), 150 ms, mouse up: the step after the
//                      tax step is on screen after this one press and the Finish pressed was still in the page at mouse up.
//                      A second investor: a press on Finish that is moved off and released elsewhere while the redraw is
//                      asked for: the pages are drawn within 1 s after the press ends.
//   press-tax-phone    390x844, touch, iOS user agent, the CPU slowed four times (Emulation.setCPUThrottlingRate) around
//                      the presses; touches sent through the page's CDP session (touchStart, release, 150 ms, touchEnd);
//                      the cancelled press is a touchCancel.
//   press-nav-desktop  the walkthrough's sequence. (a) The real source found in Task 2: on the field editor, the console's
//   press-nav-phone    Investors link pressed down while the editor's Save runs (pressed by code during the press), whose
//                      navigation redraws the whole page a task later; released. (b) The bar's select to the investor and
//                      back to Admin, then the Investors link pressed down, a background redraw arriving during the press
//                      (a 0 ms timer calling the portal's render, as a timer- or file-driven redraw does), released. Each
//                      time Investors is open after this one press and the link pressed stayed in the page until its click.
//   co-link-desktop    a self-serve firm whose agreement gets a co-investor place in "Edit fields"; an investor invited,
//   co-link-phone      onboarded and signed; "Add co-investor" on the account. The "Co-investor sign-in email" dialog
//                      (To, Subject, text, link, Copy link, Open in your email app, Mark as sent, Open the co-investor's
//                      link), nothing saying an email was sent, the investors row and the Account window before and after
//                      Mark as sent, "Sign-in link" reopening the dialog; the link signs the co-investor in to only their
//                      own places, they sign, the firm is notified, countersigns from Requests and the envelope completes.
//                      Then a changed email gives a new link and the old one no longer works; after Remove the new one no
//                      longer works; a made-up one is not found.
//   co-managed         1280x800, the managed edition: adding a co-investor behaves as before (same toast, no sign-in
//                      dialog, no sign-in record).
//   press-w8-phone     walkthrough 3 failure 7 (N4 again, run iphone-a2): a foreign individual's W-8BEN at CPU 4x, Finish
//                      pressed the moment it appears. The form has one page, so its image arrives about then and the step is
//                      redrawn after Finish was found and before the finger lands (no press is pending yet, so the guard
//                      cannot hold it). The Finish found must still be the one in the page, and one press on it moves on.
//   co-link-none-phone walkthrough 3 failure 2 (iphone-a2, iphone-b-2): the account investor signed an agreement that waits
//                      for the firm's countersignature and has no place for a co-investor; "Add co-investor", then "Open the
//                      co-investor's link". No script error, never left on "Opening your agreement…": the page says there
//                      is nothing to sign and why, with a way out (Documents); the console says why (no place for a
//                      co-investor) and how to add one. Following that (Edit fields, a signature field given to
//                      "Co-investor (if any)", Save), the co-investor is on the agreement and the same link opens it.
//   NODE_PATH=$(npm root -g) node press-and-co-investor.js [--only press-tax-desktop,...]
// The last line is "PRESS AND CO-INVESTOR: PASS (parts run: N)" or "PRESS AND CO-INVESTOR: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');
const SF = require('./safari-finish.js');

const OUT = path.join(Lib.OUT, 'press-and-co-investor');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-press-finish\.png$/, 'The step after the tax form, reached with one press on Finish while the form’s pages were still drawing.'],
  [/-press-nav\.png$/, 'Investors, opened with one press on the console’s Investors link while a background redraw arrived.'],
  [/-co-email\.png$/, 'The co-investor’s sign-in email after "Add co-investor": To, Subject, the text, the link, Copy link, Open in your email app and Mark as sent.'],
  [/-co-row-ready\.png$/, 'The investors list: the account’s row reads "Sign-in link ready to send".'],
  [/-co-row-sent\.png$/, 'The investors list after Mark as sent: the row reads "Sign-in sent" and the date.'],
  [/-co-signing\.png$/, 'The co-investor’s link opened: the agreement with only the co-investor’s own places to sign.'],
  [/-co-old-link\.png$/, 'The co-investor’s earlier link after their email was changed: "This sign-in link no longer works", with the firm’s contact.'],
  [/-co-managed\.png$/, 'The managed edition after "Add co-investor": the account window as before, no sign-in email.'],
  [/-press-w8\.png$/, 'The step after the W-8BEN, reached with one press on the Finish found before the form’s page was drawn and the step redrawn.'],
  [/-co-none-email\.png$/, 'The co-investor’s sign-in email when the agreement has no place for a co-investor: the console says why and how to add one.'],
  [/-co-none-link\.png$/, 'The co-investor’s link on an agreement with no place for them: "Nothing for you to sign", why, and Go to Documents.'],
  [/-co-none-documents\.png$/, 'Go to Documents from that page: the account’s Documents, signed in as the co-investor.'],
  [/-co-none-then-place\.png$/, 'After the firm gave a signature field to the co-investor and saved: the same link opens the agreement for them.']
]);

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const CSP = "connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};
const tagOf = (dev) => (dev === IPHONE ? 'phone' : 'desktop');

/**
 * Runs before the page's own scripts in every frame (bank-step-typing.js slowPages, plus a press recorder and the toasts).
 * window.__slow: while on, a page image (canvas.toBlob, which esign.js's page drawing alone uses) is held until release().
 * window.__press: the element a primary pointer went down on, whether it was still in the page at pointerup and at the click,
 * and whether the click landed on it. window.__sim.toasts: every toast as it appears.
 */
function instrument() {
  const held = [];
  const sim = (window.__slow = {
    on: false,
    held: 0,
    done: 0,
    need: 0,
    errors: [],
    calls: 0,
    only: 0,
    release() {
      sim.on = false;
      held.splice(0).forEach((x) => x.go());
    },
    // Let every image but the k-th go (and hold only that one from now on): the press then lasts as long as a tap.
    prime(k) {
      sim.only = k;
      held.splice(0).forEach((x) => (x.n === k ? held.push(x) : x.go()));
      sim.held = held.length;
    }
  });
  window.addEventListener('unhandledrejection', (e) => sim.errors.push(String(e.reason && (e.reason.name + ': ' + e.reason.message))));
  window.addEventListener('error', (e) => sim.errors.push('error: ' + String(e.message)));
  const toBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (cb) {
    const cv = this;
    const rest = Array.prototype.slice.call(arguments, 1);
    const go = () =>
      toBlob.apply(
        cv,
        [
          (b) => {
            cb(b);
            sim.done++;
          }
        ].concat(rest)
      );
    const n = ++sim.calls;
    if (!sim.on || (sim.only && n !== sim.only)) return go();
    sim.held++;
    held.push({ n, go });
  };
  const rec = (window.__press = { down: null, label: '', upConnected: null, clickConnected: null, clickOnIt: null, clicks: 0 });
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!e.isTrusted || !e.isPrimary) return;
      rec.down = e.target;
      rec.label = String((e.target.closest && e.target.closest('a,button') ? e.target.closest('a,button').textContent : e.target.textContent) || '').trim().slice(0, 40);
      rec.upConnected = rec.clickConnected = rec.clickOnIt = null;
      rec.clicks = 0;
    },
    true
  );
  window.addEventListener('pointerup', (e) => e.isTrusted && rec.down && (rec.upConnected = rec.down.isConnected), true);
  window.addEventListener(
    'click',
    (e) => {
      if (!e.isTrusted) return; // a click made by code (the check's own) is not the press
      rec.clicks++;
      if (rec.down && rec.clickConnected === null) {
        rec.clickConnected = rec.down.isConnected;
        rec.clickOnIt = rec.down === e.target || rec.down.contains(e.target);
      }
    },
    true
  );
  const t = (window.__sim = window.__sim || {});
  t.toasts = [];
  const watch = () =>
    new MutationObserver((list) => list.forEach((m) => m.target && m.target.id === 'toasts' && m.addedNodes.forEach((n) => t.toasts.push(String(n.textContent || '').trim())))).observe(document, { childList: true, subtree: true });
  if (document.documentElement) watch();
  else document.addEventListener('DOMContentLoaded', watch);
}

/** A fresh context (dev) whose page holds the portal (page: diy.html or index.html) in the host's sandboxed frame. */
async function framed(S, dev, page) {
  page = page || 'diy.html';
  const A = await Lib.open(S, { context: dev });
  await A.context.addInitScript(instrument);
  await A.context.route(
    (u) => u.origin === S.origin && (u.pathname === '/diy.html' || u.pathname === '/index.html'),
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CSP }, body: fs.readFileSync(path.join(Lib.ROOT, new URL(route.request().url()).pathname.slice(1))) })
  );
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${S.origin}/${page}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  return { A, fr };
}
// The probe's own refusal is logged by the browser; only those lines (marked by PROBE) are left out of "no script error".
const PROBE = 'frame-probe';
async function proveFrame(check, fr, dev) {
  const r = await fr.evaluate(
    (probe) =>
      fetch('assets/forms/SHA256SUMS?' + probe, { cache: 'no-store' })
        .then(
          (x) => 'fetched ' + x.status,
          (e) => 'refused: ' + String(e && e.message)
        )
        .then((f) => ({ fetch: f, sandbox: window.top !== window && !!window.frameElement ? window.frameElement.getAttribute('sandbox') || '' : '', w: innerWidth, h: innerHeight, touch: navigator.maxTouchPoints > 0 })),
    PROBE
  );
  const size = dev === IPHONE ? r.w === 390 && r.h === 844 && r.touch : r.w === 1280 && r.h === 800;
  check(`the portal runs in the sandboxed frame that refuses a fetch, at ${dev === IPHONE ? '390x844 with touch' : '1280x800'}`, /allow-scripts/.test(r.sandbox) && /^refused/.test(r.fetch) && size, r);
}
const scriptErrors = (A) => A.errors.filter((e) => e.indexOf(PROBE) < 0);
async function quiet(check, A, fr, texts) {
  const sim = await fr.evaluate(() => window.__slow.errors.slice()).catch(() => ['frame gone']);
  check('no uncaught error in the frame and no request left the check server', sim.length === 0 && scriptErrors(A).length === 0 && A.net.external.length === 0, { sim, console: scriptErrors(A), external: A.net.external });
  if (texts) {
    const leak = Lib.leakCheck(texts.join('\n'));
    check('no vendor name and never the forbidden word on the screens checked', leak.ok, leak.hits);
  }
}
const press = SF.press;
const toasts = (fr) => fr.evaluate(() => window.__sim.toasts.splice(0).filter(Boolean));
const hashOf = (fr) => fr.evaluate(() => location.hash);
const screen = (fr) => fr.evaluate(() => document.body.innerText);

/* ---------- A press with something redrawn under it ---------- */
async function centre(fr, sel) {
  const l = fr.locator(sel).first();
  await l.scrollIntoViewIfNeeded();
  const b = await l.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function down(A, cdp, dev, p) {
  if (dev.hasTouch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
  else {
    await A.page.mouse.move(p.x, p.y);
    await A.page.mouse.down();
  }
}
async function up(A, cdp, dev) {
  if (dev.hasTouch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await A.page.mouse.up();
}
/** Counts the redraws asked for through the portal's render (what esign.js and the other modules call when work ends). */
const countAsks = (fr) =>
  fr.evaluate(() => {
    const app = window.CVPortal.app;
    if (!app.__asks) {
      const r = app.render;
      app.__asks = { n: 0 };
      app.render = function () {
        app.__asks.n++;
        return r.apply(this, arguments);
      };
    }
    return app.__asks.n;
  });
const pressNow = (fr) => fr.evaluate(() => ({ label: window.__press.label, upConnected: window.__press.upConnected, clickConnected: window.__press.clickConnected, clickOnIt: window.__press.clickOnIt, clicks: window.__press.clicks }));

/** A new investor invited and walked to the tax step's form with its pages held ("Loading document..."). */
async function toTaxForm(check, A, fr, dev, portal, name, cdp) {
  const inv = await Lib.createInvitation(fr, { name, email: `${name.split(' ')[0].toLowerCase()}.${Date.now().toString(36)}@example.org`, type: 'individual', account: '', offeringId: portal.offeringId });
  await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
  const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0, until: /Tax certification/ });
  check(`${name} reaches the tax step`, w.reached && w.at === 'Tax certification', w.seen);
  if (!w.reached) return null;
  if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await fr.evaluate(() => (window.__slow.on = true));
  await press(fr, dev, '.ivf-form .ob-actions button[type=submit]');
  await fr.waitForSelector('.ivf-tax-sign .es-finish', { timeout: 90000 });
  const loading = await fr.evaluate((invId) => {
    const NS = window.CVPortal;
    const i = NS.state.ws.investors.find((x) => x.id === invId);
    const env = (NS.state.ws.envelopes || []).find((e) => e.id === i.onboarding.flow.taxEnvelopeId);
    window.__slow.need = env ? Number(env.pages) || 0 : 0;
    return { placeholder: !!document.querySelector('.ivf-tax-sign .es-loading'), images: document.querySelectorAll('.ivf-tax-sign .es-page img').length, pages: window.__slow.need };
  }, inv.investorId);
  check(`${name}: the W-9 is still drawing ("Loading document...") with Finish on screen`, loading.placeholder && loading.images === 0 && loading.pages > 0, loading);
  return loading.placeholder ? inv : null;
}
/** Every page image but the last drawn, before the press (the last one is let go during it). */
async function allButLast(fr) {
  await fr.evaluate(() => window.__slow.prime(window.__slow.need));
  return fr.waitForFunction(() => window.__slow.done >= window.__slow.need - 1, null, { timeout: 120000 }).then(() => true, () => false);
}
/** Let the held image go and wait until the drawing has ended and asked for its redraw. */
async function releaseAndAsk(fr, before) {
  await fr.evaluate(() => window.__slow.release());
  const drawn = await fr.waitForFunction(() => window.__slow.need > 0 && window.__slow.done >= window.__slow.need, null, { timeout: 120000 }).then(() => true, () => false);
  const asked = await fr.waitForFunction((n) => window.CVPortal.app.__asks.n > n, before, { timeout: 30000 }).then(() => true, () => false);
  await fr.waitForTimeout(150);
  return { drawn, asked };
}

function pressTax(dev) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const { A, fr } = await framed(S, dev);
    await proveFrame(check, fr, dev);
    const cdp = dev.hasTouch ? await A.context.newCDPSession(A.page) : null;
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const texts = [];

    // 1. One press on Finish while the redraw arrives.
    const inv = await toTaxForm(check, A, fr, dev, portal, dev === IPHONE ? 'Rosalind Achterberg' : 'Casimir Oyelaran', cdp);
    if (!inv) return A.context.close();
    const ready = await allButLast(fr);
    const asks = await countAsks(fr);
    const p = await centre(fr, '.ivf-tax-sign .es-finish');
    const t0 = Date.now();
    await down(A, cdp, dev, p);
    const r1 = await releaseAndAsk(fr, asks);
    const during = await fr.evaluate(() => ({ loading: !!document.querySelector('.ivf-tax-sign .es-loading') }));
    await up(A, cdp, dev);
    console.log(`NOTE ${tag}: Finish held down for ${Date.now() - t0} ms (all pages but the last drawn before: ${ready})`);
    const moved = await fr
      .waitForFunction(() => {
        const h = document.querySelector('.ivf-form h1');
        return h && h.innerText !== 'Tax certification';
      }, null, { timeout: 20000 })
      .then(() => true, () => false);
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const at = await Lib.heading(fr);
    const pr = await pressNow(fr);
    texts.push(await screen(fr));
    await A.page.screenshot({ path: path.join(OUT, `${tag}-press-finish.png`) });
    check('the drawing ended and asked for a redraw while Finish was held down', r1.drawn && r1.asked, Object.assign({}, r1, during));
    check('the step after the tax step (Distribution payments) is on screen after this one press', moved && at === 'Distribution payments', { at, press: pr });
    check(`the Finish pressed was still in the page when the ${dev.hasTouch ? 'finger lifted' : 'mouse button was released'} and its click landed on it`, pr.upConnected === true && pr.clickConnected === true && pr.clickOnIt === true, pr);

    // 2. A press on Finish that does not become a click, while the redraw is asked for: the pages are drawn soon after.
    const inv2 = await toTaxForm(check, A, fr, dev, portal, dev === IPHONE ? 'Benedikt Szalai' : 'Ottilie Brannagh', cdp);
    if (inv2) {
      await allButLast(fr);
      const asks2 = await countAsks(fr);
      const p2 = await centre(fr, '.ivf-tax-sign .es-finish');
      await down(A, cdp, dev, p2);
      const r2 = await releaseAndAsk(fr, asks2);
      if (dev.hasTouch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      else {
        const off = await centre(fr, '.ivf-progress');
        await A.page.mouse.move(off.x, off.y, { steps: 4 });
        await A.page.mouse.up();
      }
      const t0 = Date.now();
      const drawn = await fr.waitForFunction(() => document.querySelectorAll('.ivf-tax-sign .es-page img').length > 0 && !document.querySelector('.ivf-tax-sign .es-loading'), null, { timeout: 5000 }).then(() => true, () => false);
      const ms = Date.now() - t0;
      if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const still = await Lib.heading(fr);
      check(`a press on Finish ${dev.hasTouch ? 'cancelled' : 'moved off and released elsewhere'} while the redraw is asked for: the pages are drawn within 1 s after the press ends`, r2.drawn && r2.asked && drawn && ms <= 1000, { r2, drawn, ms });
      check('that press did not finish the form', still === 'Tax certification', still);
    }
    await quiet(check, A, fr, texts);
    await A.context.close();
  };
}

/* ---------- Walkthrough 3 failure 7: the W-8BEN's Finish redrawn between being found and the finger landing ---------- */
/** A foreign individual (Germany) invited and walked to the tax step, which asks for the W-8BEN. */
async function toW8(check, fr, portal, name) {
  const inv = await Lib.createInvitation(fr, { name, email: `${name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}.${Date.now().toString(36)}@example.de`, type: 'individual', account: '', offeringId: portal.offeringId });
  await fr.evaluate((id) => {
    const NS = window.CVPortal;
    NS.state.ws.investors.find((x) => x.id === id).taxType = 'foreign-individual';
    NS.app.save(true);
  }, inv.investorId);
  await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
  const w = await Lib.walk(fr, {
    name,
    acc: 'yes',
    basis: 0,
    until: /Tax certification/,
    onFilled: async (hd) => {
      if (!/Investor information/.test(hd)) return;
      await fr.selectOption('#ob-country', 'Germany');
      await fr.waitForTimeout(200);
      if (await fr.locator('input[name="ob-citizen"][value="other"]').count()) await fr.check('input[name="ob-citizen"][value="other"]');
      await fr.fill('#ob-street', 'Königsallee 27');
      await fr.fill('#ob-city', 'Düsseldorf');
      await fr.fill('#ob-st', '');
      await fr.fill('#ob-zip', '40212');
    }
  });
  const w8 = w.reached ? await fr.evaluate(() => /Form W-8BEN is filled in from your answers/.test((document.querySelector('.ivf-form') || {}).innerText || '')) : false;
  check(`${name} (a foreign individual) reaches the tax step, which asks for the W-8BEN`, w.reached && w.at === 'Tax certification' && w8, w.seen);
  return w.reached && w8 ? inv : null;
}
function pressW8(dev) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const { A, fr } = await framed(S, dev);
    await proveFrame(check, fr, dev);
    const cdp = dev.hasTouch ? await A.context.newCDPSession(A.page) : null;
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const texts = [];
    const inv = await toW8(check, fr, portal, 'Zoë Müller');
    if (!inv) return A.context.close();
    // The walk's answers: the country of citizenship, and "a foreign tax identifying number is not legally required".
    await fr.selectOption('#ob-w8Citizen', 'Germany');
    await fr.check('#ob-noFtin');
    // A slow phone from "Continue to the form" on; the form's page image held until the moment chosen below.
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await fr.evaluate(() => (window.__slow.on = true));
    await press(fr, dev, '.ivf-form .ob-actions button[type=submit]');
    await fr.waitForSelector('.ivf-tax-sign .es-finish', { state: 'visible', timeout: 90000 });
    const st0 = await fr.evaluate((invId) => {
      const NS = window.CVPortal;
      const i = NS.state.ws.investors.find((x) => x.id === invId);
      const env = (NS.state.ws.envelopes || []).find((e) => e.id === i.onboarding.flow.taxEnvelopeId);
      window.__slow.need = env ? Number(env.pages) || 0 : 0;
      return { placeholder: !!document.querySelector('.ivf-tax-sign .es-loading'), pages: window.__slow.need, form: env && env.taxForm ? env.taxForm.form : '' };
    }, inv.investorId);
    check('the W-8BEN is still drawing ("Loading document...") with Finish on screen', st0.placeholder && st0.form === 'W-8BEN' && st0.pages > 0, st0);
    // Finish as found on screen: the control the finger is on its way to.
    const found = await fr.$('.ivf-tax-sign .es-finish');
    const box0 = await found.boundingBox();
    const asks = await countAsks(fr);
    // The page image arrives and the step asks for its redraw before the finger lands (nothing is pressed yet).
    await fr.evaluate(() => window.__slow.release());
    const drawn = await fr.waitForFunction(() => window.__slow.need > 0 && window.__slow.done >= window.__slow.need, null, { timeout: 120000 }).then(() => true, () => false);
    const asked = await fr.waitForFunction((n) => window.CVPortal.app.__asks.n > n, asks, { timeout: 30000 }).then(() => true, () => false);
    const redrawn = await fr.waitForFunction(() => document.querySelectorAll('.ivf-tax-sign .es-page img').length > 0 && !document.querySelector('.ivf-tax-sign .es-loading'), null, { timeout: 30000 }).then(() => true, () => false);
    const kept = await found.evaluate((el) => el.isConnected && el === document.querySelector('.ivf-tax-sign .es-finish'));
    const box1 = await fr.locator('.ivf-tax-sign .es-finish').first().boundingBox();
    console.log(`NOTE ${tag}: Finish at ${Math.round(box0.x)},${Math.round(box0.y)} when found and at ${Math.round(box1.x)},${Math.round(box1.y)} after the redraw`);
    // The finger lands on the Finish found.
    let lost = '';
    try {
      if (dev.hasTouch) await found.tap({ timeout: 5000 });
      else await found.click({ timeout: 5000 });
    } catch (e) {
      lost = String(e && e.message).split('\n')[0];
    }
    const moved = await fr
      .waitForFunction(() => {
        const h = document.querySelector('.ivf-form h1');
        return h && h.innerText !== 'Tax certification';
      }, null, { timeout: 20000 })
      .then(() => true, () => false);
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const at = await Lib.heading(fr);
    const pr = await pressNow(fr);
    texts.push(await screen(fr));
    await A.page.screenshot({ path: path.join(OUT, `${tag}-press-w8.png`) });
    check('the page image arrived and the step was redrawn after Finish was found and before the finger landed', drawn && asked && redrawn, { drawn, asked, redrawn });
    check('the Finish found is still the Finish in the page after that redraw', kept === true, { kept });
    check('one press on it: the step after the tax step (Distribution payments) is on screen, and the press landed on that Finish', !lost && moved && at === 'Distribution payments' && pr.clickOnIt === true, { lost, at, press: pr });
    await quiet(check, A, fr, texts);
    await A.context.close();
  };
}

/* ---------- The console's Investors link ---------- */
/** A self-serve portal and its agreement opened in the field editor (the walkthrough's "Edit fields"); resolves to the draft's id. */
async function openEditor(fr, dev, oid) {
  await Lib.consoleRoute(fr, 'console-offering-' + oid, '[data-action="es-agreement-edit"]');
  await press(fr, dev, '[data-action="es-agreement-edit"]');
  await fr.waitForSelector('.es-editor.fe .fe-doc .es-page img[src]', { timeout: 60000 });
  await fr.waitForSelector('[data-action="es-agreement-save"]', { timeout: 20000 });
  await fr.waitForTimeout(400);
  return fr.evaluate(() => window.CVPortal.state.param);
}
async function selectRole(fr, value) {
  await fr.selectOption('#demo-role', value);
  await fr.waitForTimeout(500);
}

function pressNav(dev) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const { A, fr } = await framed(S, dev);
    await proveFrame(check, fr, dev);
    const cdp = dev.hasTouch ? await A.context.newCDPSession(A.page) : null;
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const texts = [];
    const link = '.cs-nav a[href="#console-investors"]';
    // (a) The walkthrough's record: the field editor's Save, then the Investors link pressed before Save's navigation drew.
    await openEditor(fr, dev, portal.offeringId);
    const pa = await centre(fr, link);
    await down(A, cdp, dev, pa);
    await fr.evaluate(() => document.querySelector('[data-action="es-agreement-save"]').click());
    await fr.waitForTimeout(150);
    const mid = await fr.evaluate(() => location.hash);
    await up(A, cdp, dev);
    const openedA = await fr.waitForFunction(() => location.hash === '#console-investors' && /Investors/.test((document.querySelector('.cs-head h1') || {}).innerText || ''), null, { timeout: 10000 }).then(() => true, () => false);
    const prA = await pressNow(fr);
    const savedA = await fr.evaluate((oid) => (window.CVPortal.state.ws.esignTemplates || []).some((t) => t.offeringId === oid && t.subscription), portal.offeringId);
    texts.push(await screen(fr));
    check('pressed while the editor’s Save navigates (a redraw a task later): the agreement is saved and Investors is open after this one press', openedA && savedA && /^#console-offering-/.test(mid), { hash: await hashOf(fr), during: mid, saved: savedA, press: prA });
    check('that link stayed in the page until its click and the click landed on it', prA.upConnected === true && prA.clickConnected === true && prA.clickOnIt === true, prA);
    // (b) The bar's select to the investor and back to Admin, then a redraw from a timer during the press.
    await selectRole(fr, 'investor');
    await selectRole(fr, 'admin');
    await fr.waitForSelector(link, { timeout: 20000 });
    const p = await centre(fr, link);
    await down(A, cdp, dev, p);
    // A redraw that something finishing in the background asks for, arriving during the press.
    await fr.evaluate(() => setTimeout(() => window.CVPortal.app.render(), 0));
    await fr.waitForTimeout(150);
    await up(A, cdp, dev);
    const opened = await fr.waitForFunction(() => location.hash === '#console-investors' && /Investors/.test((document.querySelector('.cs-head h1') || {}).innerText || ''), null, { timeout: 10000 }).then(() => true, () => false);
    const pr = await pressNow(fr);
    texts.push(await screen(fr));
    await A.page.screenshot({ path: path.join(OUT, `${tag}-press-nav.png`) });
    check('Investors is open after this one press on the console’s Investors link', opened, { hash: await hashOf(fr), press: pr });
    check(`the link pressed stayed in the page until its click and the click landed on it`, pr.upConnected === true && pr.clickConnected === true && pr.clickOnIt === true, pr);
    await quiet(check, A, fr, texts);
    await A.context.close();
  };
}

/* ---------- The co-investor's own sign-in ---------- */
const CO_SIG = { id: 'tf-cosig', signerRole: 'Investor', type: 'signature', page: 3, x: 1.9 / 8.5, y: 6.0 / 11, w: 3.2 / 8.5, h: 0.5 / 11, required: true, label: 'Second signature', value: '' };
/** The investor's agreement on screen: Finish (nothing on it is required, D-30), then the done screen. */
async function investorSigns(fr) {
  return Lib.finishAgreement(fr);
}
/** The investors row of an account, as text. */
const rowOf = (fr, invId) =>
  fr.evaluate((id) => {
    const b = document.querySelector(`[data-action=co-record][data-id="${CSS.escape(id)}"]`);
    const tr = b && b.closest('tr');
    return tr ? tr.innerText.replace(/\s+/g, ' ') : '';
  }, invId);
/** The account's row brought to the middle of the screen (for the owner's screenshot). */
const showRow = (fr, invId) =>
  fr.evaluate((id) => {
    const b = document.querySelector(`[data-action=co-record][data-id="${CSS.escape(id)}"]`);
    const tr = b && b.closest('tr');
    if (tr) tr.scrollIntoView({ block: 'center' });
  }, invId);
const dialogNow = (fr) =>
  fr.evaluate(() => {
    const d = document.getElementById('dlg');
    if (!d || !d.open) return { open: false };
    const btn = (t) => Array.from(d.querySelectorAll('button, a')).find((b) => b.textContent.replace(/\s+/g, ' ').trim() === t) || null;
    const field = Array.from(d.querySelectorAll('input[readonly]')).find((i) => /#co-/.test(i.value)) || null;
    const mail = btn('Open in your email app');
    return {
      open: true,
      h2: ((d.querySelector('h2') || {}).innerText || '').trim(),
      text: d.innerText.replace(/[ \t]+/g, ' '),
      link: field ? field.value : '',
      copy: !!btn('Copy link'),
      mailto: mail ? mail.getAttribute('href') || '' : '',
      sent: !!btn('Mark as sent'),
      open2: !!btn('Open the co-investor’s link'),
      record: !!d.querySelector('.co-record')
    };
  });
async function pressText(fr, dev, scope, text) {
  const l = fr.locator(`${scope} :is(button, a)`, { hasText: text }).filter({ hasText: new RegExp('^\\s*' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }).first();
  await l.scrollIntoViewIfNeeded();
  if (dev.hasTouch) await l.tap();
  else await l.click();
  await fr.waitForTimeout(400);
}
async function investorsPage(fr, invId) {
  // A window left open (the Account window when what was looked for in it is missing) would cover the page.
  await fr.evaluate(() => window.CVPortal.ui.closeDialog());
  await Lib.consoleRoute(fr, 'console-investors', `[data-action=co-record][data-id="${invId}"]`);
}
async function fillCo(fr, dev, first, last, email) {
  await fr.waitForSelector('#dlg form[data-form="co-save"]', { timeout: 10000 });
  await fr.fill('#co-first', first);
  await fr.fill('#co-last', last);
  await fr.fill('#co-email', email);
  await press(fr, dev, '#dlg form[data-form="co-save"] button[type=submit]');
  await fr.waitForTimeout(700);
}
/** The co-investor's sign-in link of the account now (from the workspace), or ''. */
const coState = (fr, invId) =>
  fr.evaluate((id) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const i = ws.investors.find((x) => x.id === id);
    const c = i && i.coInvestor;
    return { co: !!c, signIn: c && c.signIn ? JSON.parse(JSON.stringify(c.signIn)) : null, tenant: ws.tenant.id, firm: ws.tenant.name, team: ws.tenant.support.team, email: ws.tenant.support.email, title: i ? i.title : '' };
  }, invId);
/** The firm's signing view on screen: agree to sign electronically, sign, give the signer's name, then Finish (signing-documents.js). */
async function firmSigns(fr, dev, env) {
  if (await fr.locator('#es-consent-box').count()) {
    await fr.check('#es-consent-box');
    await press(fr, dev, '[data-action="es-consent"]');
  }
  await fr.waitForSelector('.es-sign-console .es-doc-sign .es-page img', { timeout: 30000 });
  await press(fr, dev, `.es-doc-sign [data-fid="${env.sig}"]`);
  await fr.waitForTimeout(300);
  if (await fr.evaluate(() => !!document.getElementById('dlg').open)) {
    await press(fr, dev, '[data-action="es-adopt"]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open);
  }
  const nameSel = `.es-doc-sign input[data-fid="${env.name}"]`;
  if (env.name && (await fr.locator(nameSel).count()) && !(await fr.inputValue(nameSel))) {
    if (dev.hasTouch) {
      await press(fr, dev, nameSel);
      await fr.waitForSelector('.sf-tray:not([hidden]) .sf-tray-in', { timeout: 10000 });
      await fr.fill('.sf-tray-in', 'Avery Stone');
    } else await fr.fill(nameSel, 'Avery Stone');
    await fr.waitForTimeout(200);
  }
  await press(fr, dev, '.es-sign-console .es-finish');
  return fr.waitForSelector('.es-sign-console .es-done', { timeout: 30000 }).then(() => true, () => false);
}
const envOf = (fr, invId) =>
  fr.evaluate((id) => {
    const ws = window.CVPortal.state.ws;
    const r = (ws.requests || []).filter((x) => x.investorId === id && x.type === 'subscription').pop();
    const env = r && r.envelopeId ? (ws.envelopes || []).find((e) => e.id === r.envelopeId) : null;
    if (!env) return { rid: r ? r.id : '', req: r ? r.status : '' };
    const firm = env.signers.find((s) => s.role === 'countersigner');
    const co = env.signers.find((s) => s.co);
    const me = env.signers.find((s) => s.investorId === id && !s.co);
    const own = (type) => (firm ? (env.fields.find((f) => f.signerId === firm.id && f.type === type) || {}).id || '' : '');
    return {
      rid: r.id,
      req: r.status,
      id: env.id,
      status: env.status,
      firm: firm ? firm.status : 'none',
      co: co ? { id: co.id, status: co.status, name: co.name, email: co.email, fields: env.fields.filter((f) => f.signerId === co.id).map((f) => f.id), sig: (env.fields.find((f) => f.signerId === co.id && f.type === 'signature') || {}).id || '' } : null,
      investor: me ? { status: me.status, fields: env.fields.filter((f) => f.signerId === me.id).map((f) => f.id) } : null,
      sig: own('signature'),
      name: own('name')
    };
  }, invId);

function coLink(dev) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const { A, fr } = await framed(S, dev);
    await proveFrame(check, fr, dev);
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const texts = [];
    // The agreement gets a second signature place, given to "Co-investor (if any)" in "Edit fields" and saved.
    await fr.evaluate((f) => {
      const NS = window.CVPortal;
      const t = NS.state.ws.esignTemplates.find((x) => x.id === 'tpl-sub-test');
      t.fields.push(Object.assign({}, f));
      NS.app.save(true);
    }, CO_SIG);
    const draftId = await openEditor(fr, dev, portal.offeringId);
    const pick = await fr.evaluate((id) => {
      const env = (window.CVPortal.state.ws.envelopes || []).find((e) => e.id === id);
      const f = env.fields.find((x) => x.label === 'Second signature');
      const co = env.signers.find((s) => s.co);
      return { fid: f ? f.id : '', co: co ? co.id : '', coName: co ? co.name : '' };
    }, draftId);
    check('the field editor offers the signer "Co-investor (if any)"', !!pick.fid && pick.coName === 'Co-investor (if any)', pick);
    if (!pick.fid || !pick.co) return A.context.close();
    await press(fr, dev, `.fe-doc .es-fld[data-fid="${pick.fid}"]`);
    await fr.waitForTimeout(300);
    if (!(await fr.locator('#es-fs').isVisible().catch(() => false))) {
      await press(fr, dev, '.fe-tools [data-action="fe-props"]');
      await fr.waitForTimeout(300);
    }
    await fr.selectOption('#es-fs', pick.co);
    await fr.waitForTimeout(300);
    if (await fr.locator('.fe-props [data-action="fe-props-close"]').isVisible().catch(() => false)) await press(fr, dev, '.fe-props [data-action="fe-props-close"]');
    await press(fr, dev, '[data-action="es-agreement-save"]');
    await fr.waitForTimeout(500);
    const places = await fr.evaluate((oid) => {
      const ws = window.CVPortal.state.ws;
      const t = ws.esignTemplates.find((x) => x.offeringId === oid && x.subscription);
      return t ? { roles: t.roles, co: t.fields.filter((f) => f.signerRole === 'Investor 2').length } : null;
    }, portal.offeringId);
    check('saved: the agreement has a place for the co-investor', !!places && places.roles.indexOf('Investor 2') >= 0 && places.co === 1, places);

    // An investor invited, onboarded and signed.
    const name = dev === IPHONE ? 'Leopold Haverkamp' : 'Marisol Quenneville';
    const inv = await Lib.createInvitation(fr, { name, email: `${name.split(' ')[0].toLowerCase()}@example.org`, type: 'individual', account: '', offeringId: portal.offeringId });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0 });
    check('the investor reaches the subscription agreement', w.reached, w.seen);
    if (!w.reached) return A.context.close();
    await investorSigns(fr);
    let env = await envOf(fr, inv.investorId);
    check('the investor signed; the agreement waits for the firm', env.status === 'sent' && env.investor && env.investor.status === 'signed', env);

    // "Add co-investor" on the account.
    const co = dev === IPHONE ? { first: 'Ingrid', last: 'Vasquez-Holm', email: 'ingrid.vh@example.net' } : { first: 'Theodora', last: 'Mbeki-Larsen', email: 'theodora.ml@example.net' };
    const coName = `${co.first} ${co.last}`;
    await investorsPage(fr, inv.investorId);
    await press(fr, dev, `[data-action=co-record][data-id="${inv.investorId}"]`);
    await fr.waitForSelector('#dlg[open] [data-action=co-add]', { timeout: 10000 });
    await toasts(fr);
    await press(fr, dev, '#dlg [data-action=co-add]');
    await fillCo(fr, dev, co.first, co.last, co.email);
    let said = await toasts(fr);
    let d = await dialogNow(fr);
    let st = await coState(fr, inv.investorId);
    texts.push(d.text || '', said.join('\n'));
    await A.page.screenshot({ path: path.join(OUT, `${tag}-co-email.png`) });
    check('after "Add co-investor" the "Co-investor sign-in email" opens', d.open && d.h2 === 'Co-investor sign-in email', { h2: d.h2, toasts: said });
    check('it is addressed to the co-investor, with the subject "<firm>: sign the subscription agreement for <account>"', d.open && d.text.indexOf(coName) >= 0 && d.text.indexOf(co.email) >= 0 && d.text.indexOf(`${st.firm}: sign the subscription agreement for ${st.title}`) >= 0, (d.text || '').slice(0, 600));
    const lines = ['Dear ' + co.first + ',', `asks you to sign the subscription agreement for ${st.title} as co-investor.`, 'The link below opens the agreement with only your places to sign. Nothing else is asked.', 'This link is personal to you; please do not forward it. It expires on', `Questions? Contact ${st.team}`];
    check('its text greets the co-investor, says what is asked, that the link is personal and when it expires, and whom to ask', d.open && lines.every((l) => d.text.indexOf(l) >= 0), { missing: lines.filter((l) => !(d.text || '').includes(l)) });
    const re = new RegExp(`\\?tenant=${st.tenant}#co-[A-Za-z0-9_-]{43}$`);
    check('the link field holds the co-investor’s link (…?tenant=<firm>#co-<43-character token>), the same as the account’s sign-in record', re.test(d.link || '') && !!st.signIn && st.signIn.link === d.link && st.signIn.token.length === 43, { link: d.link, signIn: st.signIn });
    check('Copy link, Open in your email app (a mailto to the co-investor), Mark as sent and "Open the co-investor’s link" are offered', d.copy && d.sent && d.open2 && d.mailto.indexOf('mailto:' + encodeURIComponent(co.email)) === 0 && /%0D%0A/.test(d.mailto), { copy: d.copy, sent: d.sent, open2: d.open2, mailto: (d.mailto || '').slice(0, 120) });
    check('nothing says an email was sent (the preview sends none)', !said.some((t) => /emailed|email was sent|has been sent/i.test(t)) && !/emailed|simulated/i.test(d.text || ''), { toasts: said });
    check('the sign-in record has its 30-day expiry and is not marked sent or opened', !!st.signIn && Math.abs(Date.parse(st.signIn.expiresAt) - Date.parse(st.signIn.createdAt) - 30 * 864e5) < 6e4 && st.signIn.sentAt === '' && st.signIn.openedAt === '', st.signIn);
    const firstLink = d.link;

    // The row and the Account window: ready to send; "Sign-in link" reopens the dialog; Mark as sent.
    await fr.evaluate(() => window.CVPortal.ui.closeDialog());
    await investorsPage(fr, inv.investorId);
    let row = await rowOf(fr, inv.investorId);
    await showRow(fr, inv.investorId);
    await A.page.screenshot({ path: path.join(OUT, `${tag}-co-row-ready.png`) });
    check('the investors row reads "Sign-in link ready to send"', /Sign-in link ready to send/.test(row), row);
    await press(fr, dev, `[data-action=co-record][data-id="${inv.investorId}"]`);
    d = await dialogNow(fr);
    texts.push(d.text || '');
    check('the Account window says the same', d.open && d.record && /Sign-in link ready to send/.test(d.text), (d.text || '').slice(0, 500));
    if (d.open && d.record && (await fr.locator('#dlg :is(button,a)', { hasText: 'Sign-in link' }).count())) await pressText(fr, dev, '#dlg', 'Sign-in link');
    d = await dialogNow(fr);
    check('its "Sign-in link" reopens the sign-in email with the same link', d.open && d.h2 === 'Co-investor sign-in email' && d.link === firstLink, { h2: d.h2, link: d.link });
    if (d.sent) await pressText(fr, dev, '#dlg', 'Mark as sent');
    await investorsPage(fr, inv.investorId);
    row = await rowOf(fr, inv.investorId);
    st = await coState(fr, inv.investorId);
    await showRow(fr, inv.investorId);
    await A.page.screenshot({ path: path.join(OUT, `${tag}-co-row-sent.png`) });
    check('after Mark as sent the row reads "Sign-in sent <date>"', /Sign-in sent [A-Z][a-z]{2} \d{1,2}, \d{4}/.test(row) && !!st.signIn && !!st.signIn.sentAt, { row, signIn: st.signIn });
    await press(fr, dev, `[data-action=co-record][data-id="${inv.investorId}"]`);
    d = await dialogNow(fr);
    check('and the Account window the same', d.open && /Sign-in sent [A-Z][a-z]{2} \d{1,2}, \d{4}/.test(d.text || ''), (d.text || '').slice(0, 500));

    // The co-investor's link: signed in as them, only their own places.
    if (d.open && (await fr.locator('#dlg :is(button,a)', { hasText: 'Sign-in link' }).count())) await pressText(fr, dev, '#dlg', 'Sign-in link');
    d = await dialogNow(fr);
    env = await envOf(fr, inv.investorId);
    if (d.open2) await pressText(fr, dev, '#dlg', 'Open the co-investor’s link');
    const opened = await fr.waitForFunction((id) => location.hash === '#sign-' + id && !!document.querySelector('.es-doc-sign, #es-consent-box'), env.id, { timeout: 20000 }).then(() => true, () => false);
    const who = await fr.evaluate(() => ({ role: window.CVPortal.state.role, co: !!window.CVPortal.state.co, viewer: window.CVPortal.state.viewer, text: document.body.innerText }));
    texts.push(who.text);
    check('"Open the co-investor’s link" signs the co-investor in and opens the agreement waiting for them', opened && who.role === 'investor' && who.co && who.viewer === inv.investorId && who.text.indexOf(coName) >= 0, { hash: await hashOf(fr), role: who.role, co: who.co });
    st = await coState(fr, inv.investorId);
    check('the sign-in record notes when the link was opened', !!st.signIn && !!st.signIn.openedAt, st.signIn);
    if (opened && (await fr.locator('#es-consent-box').count())) {
      await fr.check('#es-consent-box');
      await press(fr, dev, '[data-action="es-consent"]');
    }
    await fr.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 }).catch(() => {});
    const mine = await fr.evaluate(() => Array.from(document.querySelectorAll('.es-doc-sign .es-f-mine')).map((x) => x.getAttribute('data-fid') || (x.querySelector('[data-fid]') || {}).getAttribute?.('data-fid') || ''));
    await A.page.screenshot({ path: path.join(OUT, `${tag}-co-signing.png`) });
    check('only the co-investor’s own places are to fill (their count equals the co-investor’s fields in the envelope)', !!env.co && env.co.fields.length > 0 && mine.length === env.co.fields.length && !mine.some((f) => env.investor.fields.indexOf(f) >= 0), { mine, co: env.co && env.co.fields, investor: env.investor && env.investor.fields });
    // They sign.
    if (env.co && env.co.sig && (await fr.locator(`.es-doc-sign [data-fid="${env.co.sig}"]`).count())) {
      await press(fr, dev, `.es-doc-sign [data-fid="${env.co.sig}"]`);
      await fr.waitForTimeout(300);
      if (await fr.evaluate(() => !!document.getElementById('dlg').open)) {
        await press(fr, dev, '[data-action="es-adopt"]');
        await fr.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 }).catch(() => {});
      }
      await press(fr, dev, '.es-finish');
      await fr.waitForTimeout(1200);
    }
    env = await envOf(fr, inv.investorId);
    const note = await fr.evaluate((n) => (window.CVPortal.state.ws.notifications || []).some((x) => x.title === `${n} signed the subscription agreement as co-investor`), coName);
    check('the co-investor signs, and the firm has the notification that they signed as co-investor', !!env.co && env.co.status === 'signed' && note, { co: env.co, note });

    // The firm countersigns from Requests.
    await Lib.consoleRoute(fr, 'console-requests', '[data-action=req-tab][data-t=all]');
    await fr.click('[data-action=req-tab][data-t=all]');
    await fr.waitForTimeout(300);
    for (let i = 0; i < 2; i++) {
      const b = `[data-action=req-approve][data-id="${env.rid}"]`;
      if (!(await fr.locator(b).count())) break;
      await press(fr, dev, b);
      await fr.waitForTimeout(500);
    }
    const funded = `[data-action=req-funded][data-id="${env.rid}"]`;
    let finished = false;
    if (await fr.locator(funded).count()) {
      await press(fr, dev, funded);
      await fr.waitForTimeout(900);
      if (await fr.locator('.es-sign-console').count()) finished = await firmSigns(fr, dev, env);
    }
    env = await envOf(fr, inv.investorId);
    check('the firm countersigns from Requests and the envelope reads completed', finished && env.status === 'completed' && env.firm === 'signed', env);

    // A changed email: a new link; the old one no longer works.
    await investorsPage(fr, inv.investorId);
    await press(fr, dev, `[data-action=co-record][data-id="${inv.investorId}"]`);
    await fr.waitForSelector('#dlg[open] [data-action=co-add]', { timeout: 10000 }).catch(() => {});
    if (await fr.locator('#dlg [data-action=co-add]').count()) {
      await press(fr, dev, '#dlg [data-action=co-add]');
      await fillCo(fr, dev, co.first, co.last, co.email.replace('@', '.new@'));
    }
    d = await dialogNow(fr);
    st = await coState(fr, inv.investorId);
    const secondLink = d.link || (st.signIn && st.signIn.link) || '';
    check('"Save co-investor" with a new email gives a new link in the sign-in email', d.open && d.h2 === 'Co-investor sign-in email' && re.test(d.link || '') && d.link !== firstLink, { h2: d.h2, link: d.link, first: firstLink });
    await fr.evaluate(() => window.CVPortal.ui.closeDialog());
    const tokenOf = (l) => String(l).split('#co-')[1] || '';
    const visit = async (token) => {
      await fr.evaluate((t) => (location.hash = 'co-' + t), token);
      await fr.waitForTimeout(700);
      return fr.evaluate(() => ({ h1: ((document.querySelector('h1') || {}).innerText || '').trim(), text: document.body.innerText, role: window.CVPortal.state.role, co: !!window.CVPortal.state.co }));
    };
    let v = await visit(tokenOf(firstLink));
    texts.push(v.text);
    await A.page.screenshot({ path: path.join(OUT, `${tag}-co-old-link.png`) });
    const contact = (t) => t.indexOf(st.team) >= 0 && (!st.email || t.indexOf(st.email) >= 0);
    check('the old link says "This sign-in link no longer works", with the firm’s team and email, and signs nobody in', v.h1 === 'This sign-in link no longer works' && contact(v.text) && !v.co, { h1: v.h1, text: v.text.slice(0, 300), co: v.co });

    // Removed: the new link no longer works either; a made-up one is not found.
    await investorsPage(fr, inv.investorId);
    await press(fr, dev, `[data-action=co-record][data-id="${inv.investorId}"]`);
    await fr.waitForSelector('#dlg[open] [data-action=co-remove]', { timeout: 10000 }).catch(() => {});
    if (await fr.locator('#dlg [data-action=co-remove]').count()) {
      await press(fr, dev, '#dlg [data-action=co-remove]');
      await fr.waitForSelector('#dlg[open] [data-action=co-remove-yes]', { timeout: 10000 }).catch(() => {});
      if (await fr.locator('#dlg [data-action=co-remove-yes]').count()) await press(fr, dev, '#dlg [data-action=co-remove-yes]');
      await fr.waitForTimeout(500);
    }
    st = await coState(fr, inv.investorId);
    check('"Remove co-investor" takes the co-investor and their sign-in off the account', !st.co, st);
    await fr.evaluate(() => window.CVPortal.ui.closeDialog());
    v = await visit(tokenOf(secondLink));
    texts.push(v.text);
    check('after Remove the last link says "This sign-in link no longer works", with the firm’s contact', !!secondLink && v.h1 === 'This sign-in link no longer works' && contact(v.text) && !v.co, { h1: v.h1, link: secondLink });
    v = await visit('Zx' + 'q'.repeat(41));
    texts.push(v.text);
    check('a made-up link says "We could not find this sign-in link", with the firm’s contact', v.h1 === 'We could not find this sign-in link' && contact(v.text) && !v.co, { h1: v.h1, text: v.text.slice(0, 300) });
    await quiet(check, A, fr, texts);
    await A.context.close();
  };
}

/* ---------- Walkthrough 3 failure 2: the co-investor's link when the agreement has no place for a co-investor ---------- */
const pageNow = (fr) =>
  fr.evaluate(() => ({
    hash: location.hash,
    h1: ((document.querySelector('main h1') || {}).innerText || '').trim(),
    text: document.body.innerText,
    role: window.CVPortal.state.role,
    co: !!window.CVPortal.state.co,
    exits: Array.from(document.querySelectorAll('main a[href], main button')).map((b) => b.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean),
    errors: window.__slow.errors.slice()
  }));
function coLinkNone(dev) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const { A, fr } = await framed(S, dev);
    await proveFrame(check, fr, dev);
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const texts = [];
    const tplNow = () =>
      fr.evaluate((oid) => {
        const NS = window.CVPortal;
        const t = NS.esign.subscriptionTemplate(NS.state.ws, oid);
        return t ? { roles: t.roles, co: t.fields.filter((f) => f.signerRole === 'Investor 2').length } : null;
      }, portal.offeringId);
    const tpl0 = await tplNow();
    check('the offering’s agreement has no place for a co-investor (as in the walk)', !!tpl0 && tpl0.roles.indexOf('Investor 2') < 0 && tpl0.co === 0, tpl0);
    // Maya Okonkwo invited, onboarded and signed: her agreement waits for the firm's countersignature.
    const name = 'Maya Okonkwo';
    const inv = await Lib.createInvitation(fr, { name, email: `maya.okonkwo.${Date.now().toString(36)}@example.com`, type: 'individual', account: '', offeringId: portal.offeringId });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0 });
    check('Maya reaches the subscription agreement', w.reached, w.seen);
    if (!w.reached) return A.context.close();
    await investorSigns(fr);
    let env = await envOf(fr, inv.investorId);
    check('Maya signed; the agreement waits for the firm’s countersignature and has no co-investor signer', env.status === 'sent' && !!env.investor && env.investor.status === 'signed' && env.firm !== 'signed' && !env.co, env);

    // "Add co-investor" on her account: Ruth Okonkwo, as in the walk.
    await investorsPage(fr, inv.investorId);
    await press(fr, dev, `[data-action=co-record][data-id="${inv.investorId}"]`);
    await fr.waitForSelector('#dlg[open] [data-action=co-add]', { timeout: 10000 });
    await toasts(fr);
    await press(fr, dev, '#dlg [data-action=co-add]');
    await fillCo(fr, dev, 'Ruth', 'Okonkwo', 'ruth.okonkwo.b@example.com');
    const said = await toasts(fr);
    let d = await dialogNow(fr);
    let st = await coState(fr, inv.investorId);
    texts.push(d.text || '', said.join('\n'));
    await A.page.screenshot({ path: path.join(OUT, `${tag}-co-none-email.png`) });
    const WHY = /has no place for a co-investor/;
    const HOW = ['Edit fields', 'Co-investor (if any)'];
    check('the toast says Ruth was added and has nothing to sign on the agreement, because it has no place for a co-investor', said.some((t) => /^Ruth Okonkwo was added to the account/.test(t) && WHY.test(t)) && !said.some((t) => /They sign their own places on each agreement made for it/.test(t)), said);
    check('the sign-in email still opens with the link; the console says above it that Ruth has nothing to sign (no place for a co-investor) and how to add one (Edit fields, "Co-investor (if any)")', d.open && d.h2 === 'Co-investor sign-in email' && /#co-/.test(d.link || '') && WHY.test(d.text || '') && HOW.every((x) => (d.text || '').indexOf(x) >= 0), (d.text || '').slice(0, 900));
    // The Account window says the same.
    await fr.evaluate(() => window.CVPortal.ui.closeDialog());
    await investorsPage(fr, inv.investorId);
    await press(fr, dev, `[data-action=co-record][data-id="${inv.investorId}"]`);
    d = await dialogNow(fr);
    texts.push(d.text || '');
    check('the Account window says the same (nothing to sign, why, and how to add a place)', d.open && d.record && WHY.test(d.text || '') && HOW.every((x) => (d.text || '').indexOf(x) >= 0), (d.text || '').slice(0, 900));

    // The co-investor's link, opened as the preview offers it ("Sign-in link", then "Open the co-investor's link").
    if (d.open && (await fr.locator('#dlg :is(button,a)', { hasText: 'Sign-in link' }).count())) await pressText(fr, dev, '#dlg', 'Sign-in link');
    d = await dialogNow(fr);
    check('"Open the co-investor’s link" is offered', d.open && d.open2, { h2: d.h2 });
    if (d.open2) await pressText(fr, dev, '#dlg', 'Open the co-investor’s link');
    await fr.waitForTimeout(1500);
    let v = await pageNow(fr);
    texts.push(v.text);
    await A.page.screenshot({ path: path.join(OUT, `${tag}-co-none-link.png`) });
    check('the link opens with no script error', v.errors.length === 0 && scriptErrors(A).length === 0, { errors: v.errors, console: scriptErrors(A) });
    check('the page is not left on "Opening your agreement…"', !/Opening your agreement/.test(v.text), v.text.slice(0, 300));
    const contact = (t) => t.indexOf(st.team) >= 0 && (!st.email || t.indexOf(st.email) >= 0);
    check('it says plainly there is nothing for Ruth to sign and why (Maya Okonkwo’s agreement has no place for a co-investor), with the firm’s contact', v.h1 === 'Nothing for you to sign' && WHY.test(v.text) && v.text.indexOf(name) >= 0 && contact(v.text), { h1: v.h1, text: v.text.slice(0, 600) });
    check('it signs Ruth in as the co-investor and has a way out: Go to Documents', v.role === 'investor' && v.co && v.exits.indexOf('Go to Documents') >= 0, { role: v.role, co: v.co, exits: v.exits });
    if (v.exits.indexOf('Go to Documents') >= 0) await pressText(fr, dev, 'main', 'Go to Documents');
    await fr.waitForTimeout(900);
    v = await pageNow(fr);
    texts.push(v.text);
    await A.page.screenshot({ path: path.join(OUT, `${tag}-co-none-documents.png`) });
    check('Go to Documents opens the account’s Documents, signed in as Ruth, with no script error and no "Signed by you" (Ruth signed nothing)', v.hash === '#documents' && v.h1 === 'Documents' && v.role === 'investor' && v.co && !/Signed by you/.test(v.text) && v.errors.length === 0 && scriptErrors(A).length === 0, { hash: v.hash, h1: v.h1, errors: v.errors, console: scriptErrors(A), text: v.text.slice(0, 400) });

    // How to add one, as the console says: Edit fields, a signature field given to "Co-investor (if any)", Save.
    await selectRole(fr, 'admin');
    // The agreement prints a second signature line, which the reading gave to the investor (as co-link's).
    await fr.evaluate((f) => {
      const NS = window.CVPortal;
      const t = NS.state.ws.esignTemplates.find((x) => x.id === 'tpl-sub-test');
      t.fields.push(Object.assign({}, f));
      NS.app.save(true);
    }, CO_SIG);
    const draftId = await openEditor(fr, dev, portal.offeringId);
    const pick = await fr.evaluate((id) => {
      const e = (window.CVPortal.state.ws.envelopes || []).find((x) => x.id === id);
      const f = e.fields.find((x) => x.label === 'Second signature');
      const co = e.signers.find((s) => s.co);
      return { fid: f ? f.id : '', co: co ? co.id : '' };
    }, draftId);
    if (pick.fid && pick.co) {
      await press(fr, dev, `.fe-doc .es-fld[data-fid="${pick.fid}"]`);
      await fr.waitForTimeout(300);
      if (!(await fr.locator('#es-fs').isVisible().catch(() => false))) {
        await press(fr, dev, '.fe-tools [data-action="fe-props"]');
        await fr.waitForTimeout(300);
      }
      await fr.selectOption('#es-fs', pick.co);
      await fr.waitForTimeout(300);
      if (await fr.locator('.fe-props [data-action="fe-props-close"]').isVisible().catch(() => false)) await press(fr, dev, '.fe-props [data-action="fe-props-close"]');
      await toasts(fr);
      await press(fr, dev, '[data-action="es-agreement-save"]');
      await fr.waitForTimeout(700);
    }
    const saved = await toasts(fr);
    const tpl1 = await tplNow();
    env = await envOf(fr, inv.investorId);
    check('saved: the agreement has a place for the co-investor', !!tpl1 && tpl1.roles.indexOf('Investor 2') >= 0 && tpl1.co === 1, tpl1);
    check('Ruth is now a signer on Maya’s agreement, with her own places, and the save says so', !!env.co && env.co.name === 'Ruth Okonkwo' && env.co.fields.length > 0 && !!env.co.sig && env.status === 'sent' && env.investor.status === 'signed' && saved.some((t) => /Ruth Okonkwo/.test(t)), { co: env.co, status: env.status, saved });
    st = await coState(fr, inv.investorId);
    await fr.evaluate((t) => (location.hash = 'co-' + t), st.signIn ? st.signIn.token : '');
    const opened = await fr.waitForFunction((id) => location.hash === '#sign-' + id && !!document.querySelector('.es-doc-sign, #es-consent-box'), env.id, { timeout: 20000 }).then(() => true, () => false);
    v = await pageNow(fr);
    texts.push(v.text);
    await A.page.screenshot({ path: path.join(OUT, `${tag}-co-none-then-place.png`) });
    check('the same sign-in link now opens Maya’s agreement for Ruth’s signature', opened && v.co && v.text.indexOf('Ruth Okonkwo') >= 0, { hash: v.hash, co: v.co });
    await quiet(check, A, fr, texts);
    await A.context.close();
  };
}

/* ---------- The managed edition: unchanged ---------- */
async function coManaged({ check, S }) {
  const { A, fr } = await framed(S, DESKTOP, 'index.html');
  await proveFrame(check, fr, DESKTOP);
  await fr.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await A.page.reload();
  const f2 = await (await A.page.waitForSelector('#art')).contentFrame();
  await f2.waitForSelector('#app');
  await f2.waitForFunction(() => window.CVPortal && window.CVPortal.state.ws);
  await f2.evaluate(() => (location.hash = 'console-investors'));
  await f2.waitForSelector('[data-action=co-record]', { timeout: 20000 });
  const invId = await f2.evaluate(() => {
    const ws = window.CVPortal.state.ws;
    const b = Array.from(document.querySelectorAll('[data-action=co-record]')).find((x) => {
      const i = ws.investors.find((y) => y.id === x.getAttribute('data-id'));
      return i && !i.coInvestor;
    });
    return b ? b.getAttribute('data-id') : '';
  });
  check('the managed edition’s Investors lists an account with no co-investor', !!invId, invId);
  if (!invId) return A.context.close();
  await press(f2, DESKTOP, `[data-action=co-record][data-id="${invId}"]`);
  await f2.waitForSelector('#dlg[open] [data-action=co-add]', { timeout: 10000 });
  await toasts(f2);
  await press(f2, DESKTOP, '#dlg [data-action=co-add]');
  await fillCo(f2, DESKTOP, 'Perpetua', 'Lindqvist-Oduya', 'perpetua.lo@example.net');
  const said = await toasts(f2);
  const d = await dialogNow(f2);
  const st = await f2.evaluate((id) => {
    const i = window.CVPortal.state.ws.investors.find((x) => x.id === id);
    return { co: !!(i && i.coInvestor), signIn: !!(i && i.coInvestor && i.coInvestor.signIn), name: i && i.coInvestor ? i.coInvestor.name : '' };
  }, invId);
  await A.page.screenshot({ path: path.join(OUT, 'desktop-co-managed.png') });
  check('the co-investor is added and the account window opens as before (no sign-in email)', st.co && d.open && d.record && d.h2 !== 'Co-investor sign-in email', { st, h2: d.h2 });
  check('the same toast as before ("<name> was added to the account…")', said.some((t) => /^Perpetua Lindqvist-Oduya was added to the account/.test(t)), said);
  check('no sign-in record is made', !st.signIn, st);
  await quiet(check, A, f2, [d.text || '', said.join('\n')]);
  await A.context.close();
}

Lib.runParts(
  {
    'press-tax-desktop': pressTax(DESKTOP),
    'press-tax-phone': pressTax(IPHONE),
    'press-nav-desktop': pressNav(DESKTOP),
    'press-nav-phone': pressNav(IPHONE),
    'co-link-desktop': coLink(DESKTOP),
    'co-link-phone': coLink(IPHONE),
    'co-managed': coManaged,
    'press-w8-phone': pressW8(IPHONE),
    'co-link-none-phone': coLinkNone(IPHONE)
  },
  { name: 'PRESS AND CO-INVESTOR', browser: true }
);
