#!/usr/bin/env node
// Debug session bank-step-stuck (two gate runs on a loaded machine: the walk stuck on "Distribution payments" with "Enter the
// account number (4 to 17 digits)." after the account number was typed). On a slow device the W-9's pages can still be drawing
// when the investor presses Finish on the tax step (D-30: nothing on it is required). When the drawing ended, esign.js redrew
// the whole page, whatever was on screen by then: the bank step, while the investor typed. The field being typed in was
// replaced, the keyboard lost it, and every digit typed after that went nowhere.
// Each part runs the portal in the artifact host's sandboxed frame (connect-src 'none', as no-network.js), holds the W-9's
// page drawing (a slow phone, made certain: the first page's image is held until the check lets it go), presses Finish while
// the pages still show "Loading document...", types the routing number and the account number one character at a time as a
// phone keyboard does, lets the drawing finish half-way through the account number, then types the rest. It requires every
// digit in the field, the keyboard still in it, and Continue to move on.
//   iphone   390x844, touch, iOS user agent (the owner's iPhone in the Claude app, as Chromium can stand in for it)
//   desktop  1280x800
//   NODE_PATH=$(npm root -g) node bank-step-typing.js [--only iphone,desktop]
// The last line is "BANK STEP TYPING: PASS (parts run: N)" or "BANK STEP TYPING: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');

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
const ROUTING = '021000021';
const ACCOUNT = '123456789';
const KEY_DELAY = 60; // between two key presses, as a person types on a phone keyboard

/**
 * Runs before the page's own scripts in every frame. While window.__slow.on, a page image (canvas.toBlob, which esign.js's
 * page drawing alone uses) is held until release(); done counts the images delivered, need is set by the check.
 */
function slowPages() {
  const held = [];
  const sim = (window.__slow = {
    on: false,
    held: 0,
    done: 0,
    need: 0,
    errors: [],
    release() {
      sim.on = false;
      held.splice(0).forEach((f) => f());
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
    if (!sim.on) return go();
    sim.held++;
    held.push(go);
  };
}

/** A fresh context (dev) whose page holds the portal in the host's sandboxed frame; resolves to { A, fr }. */
async function framed(S, dev) {
  const A = await Lib.open(S, { context: dev });
  await A.context.addInitScript(slowPages);
  await A.context.route(
    (u) => u.origin === S.origin && u.pathname === '/diy.html',
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CSP }, body: fs.readFileSync(path.join(Lib.ROOT, 'diy.html')) })
  );
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

/** Press a control: tapped on a touch device, clicked otherwise. */
async function press(fr, dev, sel) {
  const l = fr.locator(sel).first();
  await l.scrollIntoViewIfNeeded();
  if (dev.hasTouch) await l.tap();
  else await l.click();
}

/** Type into the field that has the keyboard, one character at a time. */
const typeKeys = (A, text) => A.page.keyboard.type(text, { delay: KEY_DELAY });

/** The field with the keyboard and the bank step's values now. */
const bankNow = (fr) =>
  fr.evaluate(() => {
    const a = document.activeElement;
    const v = (id) => (document.getElementById(id) || {}).value;
    return { focus: a ? a.id || a.tagName : '', routing: v('ob-routing'), account: v('ob-account'), account2: v('ob-account2'), heading: (document.querySelector('.ivf-form h1') || {}).innerText || '' };
  });

const part = (dev) => async ({ check, S }) => {
  const name = 'Morgan Blake';
  const { A, fr } = await framed(S, dev);
  const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
  const inv = await Lib.createInvitation(fr, { name, email: 'morgan.blake@example.org', type: 'individual', account: '', offeringId: portal.offeringId });
  await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
  const env0 = await fr.evaluate(() => ({ inFrame: window.top !== window && /allow-scripts/.test((window.frameElement && window.frameElement.getAttribute('sandbox')) || ''), width: window.innerWidth }));
  check(`the portal runs in the host's sandboxed frame at ${dev.viewport.width} CSS pixels`, env0.inFrame && env0.width === dev.viewport.width, env0);
  const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0, until: /Tax certification/ });
  check('the investor reaches the tax step', w.reached && w.at === 'Tax certification', w.seen);
  if (!w.reached) return A.context.close();

  // A slow phone: the W-9's pages are still drawing when Finish is pressed.
  await fr.evaluate(() => (window.__slow.on = true));
  await press(fr, dev, '.ivf-form .ob-actions button[type=submit]');
  await fr.waitForSelector('.ivf-tax-sign .es-finish', { timeout: 60000 });
  const loading = await fr.evaluate((invId) => {
    const NS = window.CVPortal;
    const i = NS.state.ws.investors.find((x) => x.id === invId);
    const env = (NS.state.ws.envelopes || []).find((e) => e.id === i.onboarding.flow.taxEnvelopeId);
    window.__slow.need = env ? Number(env.pages) || 0 : 0;
    return { placeholder: !!document.querySelector('.ivf-tax-sign .es-loading'), images: document.querySelectorAll('.ivf-tax-sign .es-page img').length, pages: window.__slow.need };
  }, inv.investorId);
  check('the W-9 is still drawing ("Loading document...") when Finish is pressed', loading.placeholder && loading.images === 0 && loading.pages > 0, loading);
  await press(fr, dev, '.ivf-tax-sign .es-finish');
  await fr.waitForFunction(() => {
    const h = document.querySelector('.ivf-form h1');
    return h && h.innerText !== 'Tax certification';
  }, null, { timeout: 60000 });
  const at = await Lib.heading(fr);
  check('Finish moves on to Distribution payments', at === 'Distribution payments' && (await fr.locator('#ob-account').count()) === 1, at);
  if (at !== 'Distribution payments') return A.context.close();

  // The investor types the routing number, then the account number; half-way through it the W-9's pages finish drawing.
  await press(fr, dev, '#ob-routing');
  await typeKeys(A, ROUTING);
  await press(fr, dev, '#ob-account');
  await typeKeys(A, ACCOUNT.slice(0, 4));
  const mid = await fr.evaluate(() => ({ held: window.__slow.held, done: window.__slow.done }));
  await fr.evaluate(() => window.__slow.release());
  const drawn = await fr
    .waitForFunction(() => window.__slow.need > 0 && window.__slow.done >= window.__slow.need, null, { timeout: 120000 })
    .then(() => true, () => false);
  check('the W-9 finishes drawing while the account number is being typed', mid.held >= 1 && drawn, { mid, drawn });
  await typeKeys(A, ACCOUNT.slice(4));
  const typed = await bankNow(fr);
  check('every digit typed into the account number is in the field', typed.account === ACCOUNT && typed.routing === ROUTING, typed);
  check('the keyboard stays in the account number field', typed.focus === 'ob-account', typed);

  // The rest of the step, then Continue.
  await press(fr, dev, '#ob-account2');
  await typeKeys(A, ACCOUNT);
  await press(fr, dev, '#ob-achAuth');
  const auth = await fr.evaluate(() => !!(document.getElementById('ob-achAuth') || {}).checked);
  await press(fr, dev, '.ivf-form .ob-actions button[type=submit]');
  await fr.waitForFunction(() => {
    const h = document.querySelector('.ivf-form h1');
    const errs = Array.from(document.querySelectorAll('.ivf-form .field-error')).filter((e) => e.textContent.trim());
    return (h && h.innerText !== 'Distribution payments') || errs.length > 0;
  }, null, { timeout: 30000 }).catch(() => {});
  const next = await Lib.heading(fr);
  const errs = await Lib.fieldErrors(fr);
  check('Continue moves on from Distribution payments with no field error', auth && next !== 'Distribution payments' && errs.length === 0, { next, errs, auth });
  const sim = await fr.evaluate(() => window.__slow.errors.slice());
  check('no uncaught error in the frame and no request left the check server', sim.length === 0 && A.errors.length === 0 && A.net.external.length === 0, { sim, console: A.errors, external: A.net.external });
  await A.context.close();
};

Lib.runParts({ iphone: part(IPHONE), desktop: part(DESKTOP) }, { name: 'BANK STEP TYPING', browser: true });
