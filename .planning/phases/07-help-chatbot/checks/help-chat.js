#!/usr/bin/env node
// Plan 07-03: Help in the browser, under the conditions the owner tests in. Every part loads the portal in a sandboxed
// iframe (as the published preview runs it) whose content security policy refuses every connection, or allows only this
// check's own stand-in server; at 1280x800 with a mouse and at 390x844 with touch.
//   nosrv-desktop    no server address: a sponsor presses Help and reads one plain sentence; nothing is requested;
//                    the dialog closes by its X, by Escape and by browser back
//   NODE_PATH=$(npm root -g) node help-chat.js [--only nosrv-desktop,...]
// The last line is "HELP CHAT: PASS (parts run: N)" or "HELP CHAT: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const P6 = path.resolve(__dirname, '..', '..', '06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa', 'checks');
const Lib = require(path.join(P6, 'lib.js'));

const OUT = path.join(Lib.OUT, 'help-chat');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-bar\.png$/, 'The console with Help in its bar, the portal in a framed page that refuses connections.'],
  [/-nosrv\.png$/, 'The Help dialog with no server connected: one sentence and, where there is one, the contact.']
]);

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const SCRIPTS = "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";
/** The frame's policy: every connection refused, or only those to the given origins allowed. */
const CSP = (allow) => `connect-src ${allow && allow.length ? allow.join(' ') : "'none'"}; ${SCRIPTS}`;
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};
const NO_SERVER = 'Help is available once the portal is connected.';
// The browser's own console notice of a connection its policy refused is not a script error.
const REFUSAL_NOTICE = /Refused to connect|Content Security Policy/;

/**
 * A fresh context whose page holds the portal in a sandboxed iframe served with the policy; resolves to { A, fr, phone }.
 * opts: { file: 'diy.html' | 'index.html', allow: origins the frame may reach, init: a script run before the page's own,
 * height: the iframe's CSS height (the window's by default) }.
 */
async function framed(S, vp, opts) {
  opts = opts || {};
  const file = opts.file || 'diy.html';
  const A = await Lib.open(S, { context: VIEW[vp], allow: opts.allow || [], init: opts.init });
  // every refused request, in every frame, kept where the check can read it
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await A.context.route(
    (u) => u.origin === S.origin && u.pathname === '/' + file,
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CSP(opts.allow) }, body: fs.readFileSync(path.join(Lib.ROOT, file)) })
  );
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${S.origin}/${file}" style="border:0;width:100vw;height:${opts.height || '100vh'};display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  return { A, fr, phone: vp === 'phone' };
}

/** The frame refuses a fetch of a file that is there (the check's own proof that the policy is in force). */
async function proveRefused(check, A, fr) {
  const r = await fr.evaluate(() =>
    fetch('assets/forms/SHA256SUMS', { cache: 'no-store' }).then(
      (x) => 'fetched ' + x.status,
      (e) => 'refused: ' + String(e && e.message)
    )
  );
  check('the frame refuses fetch() (connect-src none is in force)', /^refused/.test(r), r);
  await fr.evaluate(() => (window.__cspv = []));
  A.errors.length = 0;
}

/** The self-serve sample portal (Kestrel Bay), fresh. */
async function samplePortal(fr) {
  await fr.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
  await fr.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await fr.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await fr.waitForFunction(() => window.CVPortal && window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
}

const hash = (fr) => fr.evaluate(() => location.hash);
const dlgOpen = (fr) => fr.evaluate(() => !!(document.getElementById('dlg') || {}).open);
const press = (T, sel) => (T.phone ? T.fr.tap(sel) : T.fr.click(sel));
const scriptErrors = (A) => A.errors.filter((e) => !REFUSAL_NOTICE.test(e));

/** Every help control on the page: where it is, what it says, whether it is whole inside the window and what it overlaps. */
function controls(fr) {
  return fr.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    };
    const over = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b && a.w > 0 && b.w > 0;
    const name = Array.from(document.querySelectorAll('.cs-client .lockup, .cs-client .cs-client-meta')).filter((e) => e.offsetWidth);
    const bell = document.querySelector('.cs-bell');
    return Array.from(document.querySelectorAll('[data-action="help-open"]')).map((el) => {
      const b = box(el);
      const hit = document.elementFromPoint(b.l + b.w / 2, b.t + b.h / 2);
      return {
        text: el.textContent,
        tag: el.tagName,
        inNav: !!el.closest('.cs-nav'),
        inFoot: !!el.closest('.pt-foot'),
        box: b,
        inside: b.w > 0 && b.h > 0 && b.l >= 0 && b.r <= innerWidth && b.t >= 0 && b.b <= innerHeight,
        onTop: !!hit && (hit === el || el.contains(hit)),
        overBell: !!bell && over(b, box(bell)),
        overName: name.some((n) => over(b, box(n))),
        nameSeen: name.length
      };
    });
  });
}

/** The open dialog: its class, its lines of text, its fields, and whether its Close button is whole on screen and on top. */
function dialogState(fr) {
  return fr.evaluate(() => {
    const d = document.getElementById('dlg');
    if (!d || !d.open) return { open: false };
    const x = d.querySelector('[data-action="close-dialog"][aria-label="Close"]');
    const r = x ? x.getBoundingClientRect() : null;
    const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    const dr = d.getBoundingClientRect();
    return {
      open: true,
      cls: d.className,
      heading: (d.querySelector('.dlg-head h2') || {}).textContent || '',
      lines: d.innerText.split('\n').map((l) => l.trim()).filter(Boolean),
      fields: d.querySelectorAll('input, textarea, select').length,
      close: !!r && r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && !!hit && (hit === x || x.contains(hit)),
      box: { l: Math.round(dr.left), t: Math.round(dr.top), r: Math.round(dr.right), b: Math.round(dr.bottom) },
      win: { w: innerWidth, h: innerHeight },
      pageW: document.documentElement.scrollWidth
    };
  });
}

async function openHelp(T) {
  await press(T, '[data-action="help-open"]');
  await T.fr.waitForSelector('#dlg[open].dlg-help', { timeout: 5000 });
  await T.fr.waitForTimeout(250);
}

/** What every part ends with: no script error, nothing sent beyond the check server (and the stand-in), no vendor word. */
async function ending(check, T, screens) {
  check('no script error in the browser', scriptErrors(T.A).length === 0, scriptErrors(T.A));
  check('no request left the check server', T.A.net.external.length === 0, T.A.net.external);
  const leak = Lib.leakCheck(screens.join('\n'));
  check('no vendor, model or library name and no forbidden word on the screens read', leak.ok, leak.hits);
}

const parts = {
  'nosrv-desktop': async ({ check, S }) => {
    const T = await framed(S, 'desktop');
    const { A, fr } = T;
    const screens = [];
    try {
      await proveRefused(check, A, fr);
      await samplePortal(fr);
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      const role = await fr.evaluate(() => window.CVPortal.state.role);
      check('signed in as an admin on the console', role === 'admin', role);
      await A.page.screenshot({ path: path.join(OUT, 'desktop-bar.png'), fullPage: false });
      const c = await controls(fr);
      check('exactly one Help control is on the page, in the console bar', c.length === 1 && c[0].inNav && c[0].tag === 'BUTTON', c);
      if (c.length !== 1) return;
      check('it says exactly "Help"', c[0].text === 'Help', c[0].text);
      check('it is whole inside the window and nothing covers it', c[0].inside && c[0].onTop, c[0]);
      check('it overlaps neither the bell nor the firm name', !c[0].overBell && !c[0].overName && c[0].nameSeen >= 1, c[0]);
      const before = await hash(fr);
      await openHelp(T);
      const d = await dialogState(fr);
      screens.push(await Lib.screenText(fr));
      await A.page.screenshot({ path: path.join(OUT, 'desktop-nosrv.png'), fullPage: false });
      check('the click opens the dialog with the class dlg-help', d.open && /\bdlg-help\b/.test(d.cls), d);
      check('an admin with no support address reads exactly the heading and the sentence', d.heading === 'Help' && JSON.stringify(d.lines) === JSON.stringify(['Help', NO_SERVER]), d.lines);
      check('the dialog holds no field', d.fields === 0, d.fields);
      const refused = await fr.evaluate(() => window.__cspv.slice());
      check('no connection was attempted', refused.length === 0, refused);
      check('the page nowhere says "Failed to fetch"', !/Failed to fetch/i.test(screens[0]), screens[0].slice(0, 300));
      check('the Close button is whole on screen and on top', d.close, d);
      await fr.click('#dlg [data-action="close-dialog"][aria-label="Close"]');
      await fr.waitForTimeout(300);
      check('the Close button closes it, the page unchanged', !(await dlgOpen(fr)) && (await hash(fr)) === before, { open: await dlgOpen(fr), hash: await hash(fr), before });
      await openHelp(T);
      await A.page.keyboard.press('Escape');
      await fr.waitForTimeout(400);
      check('opened again, Escape closes it', !(await dlgOpen(fr)) && (await hash(fr)) === before, { open: await dlgOpen(fr), hash: await hash(fr) });
      if (await dlgOpen(fr)) await fr.evaluate(() => window.CVPortal.ui.closeDialog());
      await openHelp(T);
      await fr.evaluate(() => history.back());
      await fr.waitForTimeout(800);
      const back = { open: await dlgOpen(fr), hash: await hash(fr) };
      check('opened again, browser back closes it and the page stays', !back.open && back.hash === before, Object.assign({ before }, back));
      check('still no connection attempted', (await fr.evaluate(() => window.__cspv.length)) === 0);
      await ending(check, T, screens);
    } finally {
      await A.context.close();
    }
  }
};

Lib.runParts(parts, { name: 'HELP CHAT', unit: 'parts', flag: '--only', browser: true });
