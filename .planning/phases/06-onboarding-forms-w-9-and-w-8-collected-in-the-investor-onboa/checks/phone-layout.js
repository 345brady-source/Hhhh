#!/usr/bin/env node
// Plan 06-33 (the owner-path walkthrough of 2026-11-19, 06-WALKTHROUGH.md failures 5, 9, 11, 12 and 14): the phone layout.
// The owner tests on an iPhone inside an app's web view. Every part loads the portal in a sandboxed iframe whose policy
// refuses every connection (connect-src 'none', as no-network.js), proves the refusal, and walks its screens at 390x844
// with touch and an iPhone's user agent (-phone) and at 1280x800 (-desktop). Real WebKit is not installed here: Chromium
// stands in, so the enlargement an iPhone makes on focus is not seen; the text size that causes it is measured instead.
// On every screen the check measures:
//   table controls  failure 5: any button, link or field inside a table whose right edge is past the screen's (or whose
//                   left edge is before it); a row action must be reachable without dragging the table sideways
//   fields          failure 9: the computed text size of every text field, select and text area (phone: 16 px or more).
//                   The blanks drawn on an agreement's page are scaled with the page and are not counted.
//   width           failure 12: anything past the right edge of the screen that no sideways scroller holds, toasts included
//   targets         failure 14: any button, link, select or summary whose touch area (its box, or the ::before/::after
//                   the stylesheets lay over it) is under 24 px high (phone)
//   dialogs         failure 14: an open dialog's close X stands beside its title, not under it (phone)
// and, where they stand, the items the walkthrough named. At 1280x800 the same walk records the place and size of every
// element on every screen (geometry-<part>.json under the check's output folder), so a run on the tree before a change
// and a run after it can be compared: nothing may move on a desktop.
//   sample   the sign-up page; the sample firm's console (Kestrel Bay): every page of its menu and the forms and
//            dialogs they open; a new offering's "Add the standard terms" button; Offering intake's sample buttons, a
//            read, and "Create the offering" with no name; Distributions' "Enter an amount."; Audit after a download;
//            "Add a connection"
//   firms    the other sample firms (Pellbrook: open requests with Approve and Decline, then the action that follows
//            approval; Ashwell Ridge) and the managed edition (index.html): every page of each console menu
//   owner    a new sponsor signs up: every page of the empty console. Then the sample firm with a subscription
//            agreement: an investor is invited and onboarded (the signing bar's hint on the tax form and on the
//            agreement, phone and desktop), the investor's pages, the sponsor's Investors and Requests rows (Download,
//            Request tax form, View portal, Account, Approve, Decline, then Countersign), a tax-form request (Home and
//            Account both offer it)
//   editor   the field editor with fields marked Review: the sentence above it, the properties sheet with "Confirm
//            this field"
// A desktop part compares every element with a run on the tree before when PHONE_LAYOUT_BASE names that run's phone-layout folder.
//   [PHONE_LAYOUT_BASE=<dir>] NODE_PATH=$(npm root -g) node phone-layout.js [--only sample-phone,sample-desktop,firms-phone,firms-desktop,owner-phone,owner-desktop,editor-phone,editor-desktop]
// The last line is "PHONE LAYOUT: PASS (parts run: N)" or "PHONE LAYOUT: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');

const OUT = path.join(Lib.OUT, 'phone-layout');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-signup\.png$/, 'The sign-up page.'],
  [/-investors\.png$/, 'The sponsor’s Investors page: each row’s actions.'],
  [/-requests\.png$/, 'The sponsor’s Requests page: Approve and Decline on a pending request.'],
  [/-requests-approved\.png$/, 'The Requests page after Approve: the action that follows.'],
  [/-intake\.png$/, 'Offering intake: the two sample buttons.'],
  [/-intake-noname\.png$/, 'Offering intake, "Create the offering" with no name.'],
  [/-new-offering\.png$/, 'A new offering: "Add the standard terms" under the terms.'],
  [/-audit-download\.png$/, 'The Audit page after "Download audit package": the toast and the file name.'],
  [/-connection\.png$/, 'The "Add a connection" dialog.'],
  [/-distribution\.png$/, 'Distributions with an amount typed.'],
  [/-tax-bar\.png$/, 'The tax form’s signing view: the signing bar and its hint.'],
  [/-agreement-bar\.png$/, 'The agreement’s signing view: the signing bar and its hint.'],
  [/-agreement-field\.png$/, 'The agreement’s signing view once Start has gone to a field: the bar and its hint.'],
  [/-account-request\.png$/, 'The investor’s Account page while a tax-form request is open.'],
  [/-editor\.png$/, 'The field editor with fields marked Review.'],
  [/-editor-sheet\.png$/, 'The field editor: a marked field’s properties.']
]);

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const CSP = "connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' }
};
const PAGES = ['diy.html', 'index.html'];
/**
 * What this fix changes at 1280x800 on purpose (the behaviour of failure 14 and the phone's own sentence of failure 11,
 * not layout): { at: the screen, el: every line that differs there, why }. Any other difference from the tree before fails.
 */
const DESKTOP_EXPECTED = [
  { at: /^field editor/, el: /^span\.es-rv-list /, why: 'failure 11: the sentence about fields marked Review is held in a span, so a phone can show its own in its place; its words and every element stay where they were' },
  { at: /^sample distribution, amount typed$/, el: /^span\.cs-hint /, why: 'failure 14: "Enter an amount." goes once an amount is typed (or gives way to the reason that holds then)' },
  { at: /^investor Account with a tax-form request$/, el: /^a\.link-btn /, why: 'failure 14: the Account page offers the open tax-form request ("Complete your tax form"), as Home does' }
];

/** A fresh context whose page holds the portal (diy.html, or index.html for the managed edition) in a sandboxed iframe that refuses every connection. */
async function framed(S, vp, file) {
  const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, VIEW[vp]) });
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await A.context.route(
    (u) => u.origin === S.origin && PAGES.indexOf(u.pathname.slice(1)) >= 0,
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CSP }, body: fs.readFileSync(path.join(Lib.ROOT, new URL(route.request().url()).pathname.slice(1))) })
  );
  const src = `${S.origin}/${file || 'diy.html'}`;
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${src}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  A.page.on('dialog', (d) => d.accept().catch(() => {}));
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  return { A, fr, vp, M: [], geo: {} };
}

/** The frame refuses a fetch of a file that is there (the check's own proof that the policy is in force). */
async function proveRefused(check, W) {
  const r = await W.fr.evaluate(() =>
    fetch('assets/forms/SHA256SUMS', { cache: 'no-store' }).then(
      (x) => 'fetched ' + x.status,
      (e) => 'refused: ' + String(e && e.message)
    )
  );
  check('the frame refuses fetch() (connect-src none is in force)', /^refused/.test(r), r);
  await W.fr.evaluate(() => (window.__cspv = []));
  W.A.errors.length = 0;
}

/** What the screen measures now (runs in the frame). arg: { geo: true to list every element's place and size }. */
function measure(arg) {
  const vw = document.documentElement.clientWidth;
  const vis = (el) => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      if (n.tagName === 'DETAILS' && !n.open && el !== n && !(n.querySelector('summary') || { contains: () => false }).contains(el)) return false;
      if (n.tagName === 'DIALOG' && !n.open) return false;
    }
    return true;
  };
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}${el.getAttribute('data-action') ? `[${el.getAttribute('data-action')}]` : ''}`;
  const txt = (el) => String(el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 44);
  const dlg = Array.from(document.querySelectorAll('dialog[open]')).pop() || null;
  const roots = dlg ? [dlg] : [document.body];
  const toasts = document.getElementById('toasts');
  if (dlg && toasts) roots.push(toasts);
  const all = (sel) => roots.flatMap((r) => Array.from(r.querySelectorAll(sel))).filter(vis);
  // an ancestor that scrolls sideways lets wide content be reached without leaving the screen
  const scroller = (el) => {
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) return n;
    }
    return null;
  };
  const past = (r) => r.right > vw + 1 || r.left < -1;
  const out = { hash: location.hash, vw, dialog: dlg ? dlg.className : '' };
  // failure 9
  const isText = (el) => !/^(checkbox|radio|file|color|range|button|submit|reset|image|hidden)$/.test(el.type || '');
  const fields = all('input, select, textarea').filter(isText);
  out.blanks = fields.filter((el) => el.closest('.es-page')).length;
  out.fields = fields.filter((el) => !el.closest('.es-page')).map((el) => ({ s: name(el), px: Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100 }));
  // failure 5
  out.off = all('table button, table a[href], table a[data-action], table select, table input:not([type=hidden]), table textarea, table summary')
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter((x) => past(x.r))
    .map((x) => ({ s: name(x.el), t: txt(x.el), left: Math.round(x.r.left), right: Math.round(x.r.right) }));
  out.tables = all('table').map((t) => ({ s: name(t), w: Math.round(t.getBoundingClientRect().width), controls: t.querySelectorAll('tbody button, tbody a[href], tbody a[data-action], tbody select, tbody input').length }));
  // failure 12
  const wide = [];
  all('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!past(r) || scroller(el) || el.closest('.sr-only') || el.closest('svg')) return;
    if (wide.some((w) => w.el.contains(el))) return;
    wide.push({ el, s: name(el), t: txt(el), left: Math.round(r.left), right: Math.round(r.right) });
  });
  out.wide = wide.map((w) => ({ s: w.s, t: w.t, left: w.left, right: w.right }));
  if (document.documentElement.scrollWidth > vw + 1) out.wide.push({ s: 'the page', t: '', left: 0, right: document.documentElement.scrollWidth });
  // failure 14: tap targets (the fields drawn on a document's page are scaled with the page and have their own hit areas).
  // The height a finger can hit: the element's box, or the touch area the stylesheets lay over it with an absolutely
  // placed ::before or ::after of the element (the portal's own way to enlarge a small link, e.g. inset: -12px 0).
  const hitH = (el, r) => {
    let hh = r.height;
    if (getComputedStyle(el).position === 'static') return hh;
    ['::before', '::after'].forEach((p) => {
      const s = getComputedStyle(el, p);
      if (!s || s.content === 'none' || s.content === 'normal' || s.display === 'none' || s.position !== 'absolute' || s.pointerEvents === 'none') return;
      const t = parseFloat(s.top);
      const b = parseFloat(s.bottom);
      if (isFinite(t) && isFinite(b)) hh = Math.max(hh, r.height - t - b);
    });
    return hh;
  };
  out.small = all('button, a[href], a[data-action], select, summary, [role=button]')
    .filter((el) => !el.disabled && !el.closest('.es-page'))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .map((x) => Object.assign(x, { hit: hitH(x.el, x.r) }))
    .filter((x) => x.hit < 23.95)
    .map((x) => ({ s: name(x.el), t: txt(x.el), h: Math.round(x.r.height * 10) / 10, hit: Math.round(x.hit * 10) / 10 }));
  // failure 14: the close X beside the title
  if (dlg) {
    const x = dlg.querySelector('[data-action="close-dialog"][aria-label="Close"]');
    const h2 = dlg.querySelector('.dlg-head h2');
    if (x && h2 && vis(x) && vis(h2)) {
      const a = x.getBoundingClientRect();
      const b = h2.getBoundingClientRect();
      out.x = { beside: a.top < b.bottom - 1, xTop: Math.round(a.top), titleBottom: Math.round(b.bottom), title: txt(h2) };
    }
  }
  if (arg && arg.geo) {
    out.geo = all('*')
      .filter((el) => !el.closest('svg') || el.tagName.toLowerCase() === 'svg')
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${name(el)} ${Math.round(r.left)},${Math.round(r.top + window.scrollY)} ${Math.round(r.width)}x${Math.round(r.height)} ${getComputedStyle(el).fontSize}`;
      });
  }
  return out;
}

/** Measure the screen as it stands and keep it under `label`. */
async function screen(W, label, wait) {
  await W.fr.waitForTimeout(wait == null ? 250 : wait);
  const m = await W.fr.evaluate(measure, { geo: W.vp === 'desktop' });
  if (m.geo) {
    W.geo[label] = m.geo;
    delete m.geo;
  }
  m.at = label;
  W.M.push(m);
  return m;
}
const shot = (W, name) => W.A.page.screenshot({ path: path.join(OUT, `${W.vp}-${name}.png`), fullPage: false });

/** Tap (phone) or click (desktop) the first match the way a person does; false when it is not there or cannot be pressed. */
async function press(W, sel, o) {
  const l = typeof sel === 'string' ? W.fr.locator(sel).first() : sel;
  try {
    if (!(await l.count())) return false;
    await l.scrollIntoViewIfNeeded({ timeout: 5000 });
    if (W.vp === 'phone') await l.tap({ timeout: (o && o.timeout) || 8000 });
    else await l.click({ timeout: (o && o.timeout) || 8000 });
    await W.fr.waitForTimeout((o && o.wait) || 350);
    return true;
  } catch (e) {
    return false;
  }
}
const route = async (W, h, wait) => {
  await W.fr.evaluate((h) => (location.hash = h), h);
  await W.fr.waitForTimeout(wait || 450);
};
const dlgOpen = (W) => W.fr.evaluate(() => !!(document.getElementById('dlg') || {}).open);
const closeDialog = async (W) => {
  if (await dlgOpen(W)) await W.fr.evaluate(() => window.CVPortal.ui.closeDialog());
  await W.fr.waitForTimeout(200);
};
/** The pages of the console's own menu, in its order. */
const menu = (W) => W.fr.evaluate(() => Array.from(document.querySelectorAll('.cs-nav nav a[href^="#console"]')).map((a) => a.getAttribute('href').slice(1)).filter((h, i, a) => a.indexOf(h) === i));
/** The visible matches of a selector: how many, and those not inside the screen's width. */
const reach = (W, sel) =>
  W.fr.evaluate((sel) => {
    const vw = document.documentElement.clientWidth;
    const els = Array.from(document.querySelectorAll(sel)).filter((el) => el.offsetWidth || el.offsetHeight);
    return {
      n: els.length,
      out: els
        .map((el) => ({ r: el.getBoundingClientRect(), t: String(el.innerText || '').trim().slice(0, 40) }))
        .filter((x) => x.r.right > vw + 1 || x.r.left < -1)
        .map((x) => ({ t: x.t, left: Math.round(x.r.left), right: Math.round(x.r.right) }))
        .slice(0, 6)
    };
  }, sel);
/** A named control is on the page and inside the screen's width (on a desktop too). */
async function named(check, W, what, sel) {
  const r = await reach(W, sel);
  check(`${what}: on the page and inside the screen’s width`, r.n > 0 && !r.out.length, r);
  return r.n > 0;
}
/**
 * One of the walkthrough's small tap targets (failure 14): on the page and inside the screen's width, and on the phone a
 * finger 24 px tall lands on it: the browser's own hit test, 11.95 px above and below the middle of its first line, finds
 * the control there (whatever the stylesheets lay over it counts, as it does for a finger).
 */
async function target(check, W, what, sel) {
  if (!(await named(check, W, what, sel)) || W.vp !== 'phone') return;
  const p = await W.fr.evaluate((sel) => {
    const el = Array.from(document.querySelectorAll(sel)).find((x) => x.offsetWidth || x.offsetHeight);
    el.scrollIntoView({ block: 'center' });
    const r = el.getClientRects()[0] || el.getBoundingClientRect();
    const x = r.left + Math.min(r.width / 2, 12);
    const y = r.top + r.height / 2;
    const at = (yy) => {
      const t = document.elementFromPoint(x, yy);
      return t === el || (!!t && el.contains(t)) ? 'it' : t ? `${t.tagName.toLowerCase()}${t.className && typeof t.className === 'string' ? '.' + t.className.trim().split(/\s+/)[0] : ''}` : 'nothing';
    };
    return { box: Math.round(r.height * 10) / 10, above: at(y - 11.95), below: at(y + 11.95) };
  }, sel);
  check(`${what}: a 24 px finger lands on it (box ${p.box} px high)`, p.above === 'it' && p.below === 'it', p);
}

/** One line per measure for the whole part, the offenders listed with their screens. */
function verdict(check, W) {
  const n = W.M.length;
  const flat = (k) => W.M.flatMap((m) => (m[k] || []).map((x) => Object.assign({ at: m.at }, x)));
  const brief = (list) => {
    const seen = {};
    const rows = [];
    list.forEach((x) => {
      const key = `${x.at}|${x.s}|${x.t || ''}`;
      if (seen[key]) return seen[key].n++;
      seen[key] = Object.assign({ n: 1 }, x);
      rows.push(seen[key]);
    });
    return { offenders: list.length, screens: Array.from(new Set(list.map((x) => x.at))).length, first: rows.slice(0, 24) };
  };
  // every screen's own numbers, for the before-and-after table of the plan's summary
  fs.writeFileSync(path.join(OUT, `measures-${W.part}.json`), JSON.stringify(W.M));
  const off = flat('off');
  check(`failure 5: no button, link or field inside a table is past an edge of the screen (${n} screens measured)`, !off.length, brief(off));
  const wide = flat('wide');
  check(`failure 12: nothing is wider than the screen (${n} screens measured)`, !wide.length, brief(wide));
  if (W.vp === 'phone') {
    const all = flat('fields');
    const tiny = all.filter((f) => f.px < 16);
    check(`failure 9: every text field, select and text area has text of 16 px or more (${all.length} fields on ${n} screens)`, all.length > 0 && !tiny.length, brief(tiny));
    const small = flat('small');
    check(`failure 14: no button, link, select or summary has a touch area under 24 px high (${n} screens measured)`, !small.length, brief(small));
    const xs = W.M.filter((m) => m.x);
    const under = xs.filter((m) => !m.x.beside).map((m) => Object.assign({ at: m.at }, m.x));
    check(`failure 14: every open dialog’s close X stands beside its title (${xs.length} dialogs)`, !under.length, under);
  } else {
    fs.writeFileSync(path.join(OUT, `geometry-${W.part}.json`), JSON.stringify(W.geo));
    check(`desktop: the place and size of every element on ${Object.keys(W.geo).length} screens is recorded for comparison with the tree before`, Object.keys(W.geo).length > 0);
    // PHONE_LAYOUT_BASE=<the phone-layout folder of a run on the tree before>: every element on every screen of this part
    // must stand where it stood there, at the same size and text size (a line per element: name, place, size, text size)
    const baseDir = process.env.PHONE_LAYOUT_BASE;
    if (baseDir) {
      const f = path.join(baseDir, `geometry-${W.part}.json`);
      const B = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
      const labels = Object.keys(W.geo);
      const missing = labels.filter((k) => !B[k]).concat(Object.keys(B).filter((k) => !W.geo[k]));
      const moved = [];
      const expected = [];
      let lines = 0;
      // an element is its tag, place, size and text size: a class or a label added to it (cs-stack, data-label) is not a move
      const key = (line) => line.replace(/^([a-z0-9-]+)\S*/, '$1');
      // a toast is a passing notice, on screen for four seconds: whether one is still there when a screen is measured
      // depends on the walk's timing, not on the layout, so the toasts are left out of the comparison
      const page = (list) => list.filter((x) => !/^div(#toasts|\.toast)\b/.test(x));
      labels.filter((k) => B[k]).forEach((k) => {
        const was = page(B[k]);
        const now = page(W.geo[k]);
        lines += now.length;
        const count = (list) => list.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m), {});
        const a = count(was);
        const b = count(now);
        const goneKeys = Object.keys(a).filter((x) => (b[x] || 0) < a[x]);
        const addedKeys = Object.keys(b).filter((x) => (a[x] || 0) < b[x]);
        const gone = was.filter((x) => goneKeys.indexOf(key(x)) >= 0);
        const added = now.filter((x) => addedKeys.indexOf(key(x)) >= 0);
        if (!gone.length && !added.length) return;
        // a change the fix makes on every screen size on purpose, named with its reason (DESKTOP_EXPECTED); anything else fails
        const why = DESKTOP_EXPECTED.find((e) => e.at.test(k) && gone.concat(added).every((x) => e.el.test(x)));
        (why ? expected : moved).push({ at: k, why: why ? why.why : undefined, before: gone.slice(0, 4), now: added.slice(0, 4), n: Math.max(gone.length, added.length) });
      });
      expected.forEach((e) => console.log(`NOTE ${W.part} desktop change made on purpose on "${e.at}": ${e.why} (before: ${JSON.stringify(e.before)}; now: ${JSON.stringify(e.now)})`));
      check(`desktop: compared with the tree before, all ${labels.length} screens (${lines} elements) are unchanged: every element in the same place, at the same size and text size${expected.length ? ` (apart from ${expected.length} change${expected.length === 1 ? '' : 's'} made on purpose, listed above)` : ''}`, !missing.length && !moved.length, { screensMissing: missing, screensChanged: moved.length, first: moved.slice(0, 6) });
    }
  }
}
async function done(check, W) {
  verdict(check, W);
  const refused = await W.fr.evaluate(() => (window.__cspv || []).slice()).catch(() => []);
  check('no fetch or XHR was attempted (no refused connection)', refused.length === 0, refused);
  check('no script error in the browser', W.A.errors.length === 0, W.A.errors);
  check('no request left the check server', W.A.net.external.length === 0, W.A.net.external);
  await W.A.context.close();
}

/** Every page of the console's menu, each measured as it opens. */
async function consolePages(check, W, tag, min) {
  const pages = await menu(W);
  check(`${tag}: the console menu lists its pages`, pages.length >= min, pages);
  for (const h of pages) {
    await route(W, h);
    await screen(W, `${tag} ${h}`);
  }
  return pages;
}

/* ---------- sample: the sign-up page and the sample firm's console ---------- */
function samplePart(vp) {
  return async ({ check, S }) => {
    const W = await framed(S, vp);
    W.part = `sample-${vp}`;
    await proveRefused(check, W);
    const { fr } = W;
    // the sign-up page, then its messages for an empty form
    await fr.waitForSelector('#sd-firm');
    await screen(W, 'sign-up');
    await shot(W, 'signup');
    await press(W, '.sd-submit');
    await screen(W, 'sign-up, empty form');
    // the sample firm
    const portal = await Lib.setupPortal(S, { page: fr, context: W.A.context });
    const pages = await consolePages(check, W, 'sample', 16);

    // Offerings: a new offering, with "Add the standard terms" under its terms (failure 12)
    await route(W, 'console-offerings');
    check('Offerings: "Add offering" opens a new offering', (await press(W, '[data-action=off-add]')) && /^#console-offering-/.test(await fr.evaluate(() => location.hash)));
    await screen(W, 'sample new offering');
    await named(check, W, 'failure 12: "Add the standard terms for …" on a new offering', '[data-action=term-defaults]');
    await fr.locator('[data-action=term-defaults]').first().scrollIntoViewIfNeeded().catch(() => {});
    await shot(W, 'new-offering');
    await target(check, W, 'failure 14: the "Offerings" link back from an offering', 'a.cs-back');
    // an offering that has investors
    await route(W, `console-offering-${portal.offeringId}`);
    await screen(W, 'sample offering page');

    // Offering intake: the sample buttons (failure 12), a read, and "Create the offering" with no name (failure 14)
    await route(W, 'console-intake');
    await named(check, W, 'failure 12: the sample buttons on Offering intake', '[data-action=ik-sample]');
    await shot(W, 'intake');
    await press(W, '[data-action=ik-sample]');
    await screen(W, 'sample intake, a sample chosen');
    await press(W, '[data-action=ik-read]');
    const read = await fr.waitForSelector('[data-action=ik-apply]', { timeout: 90000 }).then(() => true, () => false);
    check('Offering intake reads the sample to its review screen', read);
    if (read) {
      await screen(W, 'sample intake review');
      await fr.fill('#ik-offering-name', '');
      await press(W, '[data-action=ik-apply]');
      const v = await fr.evaluate(() => {
        const f = document.getElementById('ik-offering-name');
        return { toast: Array.from(document.querySelectorAll('#toasts .toast')).map((t) => t.textContent).join(' / '), invalid: !!f && f.getAttribute('aria-invalid') === 'true', focused: !!f && document.activeElement === f, step: !!document.querySelector('[data-action=ik-apply]') };
      });
      await shot(W, 'intake-noname');
      check('failure 14: "Create the offering" with no name says "Enter the offering name." and stays on the review', /Enter the offering name\./.test(v.toast) && v.step, v);
      check('failure 14: the name field is marked', v.invalid, v);
      check('failure 14: and the name field takes focus', v.focused, v);
      await fr.fill('#ik-offering-name', 'Harbor Ridge Fund I');
      await fr.waitForTimeout(150);
      check('failure 14: the mark goes once a name is typed', await fr.evaluate(() => document.getElementById('ik-offering-name').getAttribute('aria-invalid') !== 'true'));
    }

    // Investors: the rows, the invite forms, the Account dialog
    await route(W, 'console-investors');
    await named(check, W, 'failure 5: "View portal" on the Investors rows', 'table [data-action=view-as]');
    await named(check, W, 'failure 5: "Account" on the Investors rows', 'table [data-action=co-record]');
    await named(check, W, 'failure 5: "Invitation" and "Send reminder" on a row not yet activated', 'table [data-action=invite-preview], table [data-action=remind]');
    await press(W, '[data-action=invite-toggle]');
    await screen(W, 'sample invite form');
    if (await fr.locator('#iv-more:not([open])').count()) await press(W, '#iv-more summary');
    await screen(W, 'sample invite form, more options');
    for (const t of await fr.evaluate(() => Array.from(document.querySelectorAll('[data-action=invite-tab]')).map((b) => b.getAttribute('data-t')))) {
      await press(W, `[data-action=invite-tab][data-t="${t}"]`);
      await screen(W, `sample invite form, tab ${t}`);
    }
    await press(W, '[data-action=invite-toggle]');
    await press(W, 'table [data-action=co-record]');
    if (await dlgOpen(W)) await screen(W, 'sample Account dialog');
    await closeDialog(W);

    // E-sign: a new envelope, the templates
    await route(W, 'console-esign');
    if (await press(W, '[data-action=es-new]')) await screen(W, 'sample new envelope');
    await press(W, '[data-action=es-new-cancel]');
    for (const t of await fr.evaluate(() => Array.from(document.querySelectorAll('[data-action=es-tab]')).map((b) => b.getAttribute('data-t') || b.getAttribute('data-tab') || ''))) {
      if (t && (await press(W, `[data-action=es-tab][data-t="${t}"], [data-action=es-tab][data-tab="${t}"]`))) await screen(W, `sample E-sign, tab ${t}`);
    }

    // Capital calls: one call, a new call
    await route(W, 'console-calls');
    if (await press(W, '[data-action=call-open]')) await screen(W, 'sample capital call');
    await route(W, 'console-calls');
    await press(W, '[data-action=call-back]');
    if (await press(W, '[data-action=call-new]')) await screen(W, 'sample new capital call');
    await press(W, '[data-action=call-back]');

    // Distributions: "Enter an amount." goes once an amount is typed (failure 14); the NACHA file
    await route(W, 'console-distributions');
    if (await fr.locator('input[name="ds-mode"][value="total"]:not(:checked)').count()) {
      await fr.check('input[name="ds-mode"][value="total"]', { force: true });
      await fr.waitForTimeout(300);
    }
    await fr.fill('#ds-total', '');
    await fr.waitForTimeout(200);
    await route(W, 'console');
    await route(W, 'console-distributions');
    const hint = () => fr.evaluate(() => Array.from(document.querySelectorAll('.cs-main .cs-hint')).filter((x) => x.offsetWidth).some((x) => x.textContent.trim() === 'Enter an amount.'));
    check('Distributions with no amount says "Enter an amount."', await hint());
    await fr.fill('#ds-total', '25000');
    await fr.waitForTimeout(400);
    await fr.locator('#ds-total').scrollIntoViewIfNeeded().catch(() => {});
    await shot(W, 'distribution');
    check('failure 14: "Enter an amount." goes once an amount is typed', !(await hint()));
    await screen(W, 'sample distribution, amount typed');
    if (await press(W, '[data-action=nacha-build]:not([disabled])', { wait: 800 })) await screen(W, 'sample NACHA file');
    await fr.fill('#ds-total', '').catch(() => {});
    await fr.waitForTimeout(300);
    check('and "Enter an amount." comes back when the amount is cleared', await hint());

    // Notices: the investor picker
    await route(W, 'console-notices');
    if (await press(W, '[data-action=picker-toggle]')) await screen(W, 'sample notices, investor picker');

    // Reports: its other tabs
    await route(W, 'console-reports');
    for (const t of await fr.evaluate(() => Array.from(document.querySelectorAll('[data-action=rep-tab]')).map((b) => b.getAttribute('data-t')))) {
      if (t && (await press(W, `[data-action=rep-tab][data-t="${t}"]`))) await screen(W, `sample reports, tab ${t}`);
    }

    // Audit after a download: the toast and the file name (failure 12)
    await route(W, 'console-audit');
    const got = W.A.page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await press(W, '[data-action=aud-zip]');
    await fr.waitForSelector('#toasts .toast', { timeout: 20000 }).catch(() => {});
    const m = await screen(W, 'sample audit after a download', 300);
    const d = await got;
    const toast = await fr.evaluate(() => {
      const t = document.querySelector('#toasts .toast');
      const r = t ? t.getBoundingClientRect() : null;
      return r ? { text: t.textContent, left: Math.round(r.left), right: Math.round(r.right), vw: document.documentElement.clientWidth } : null;
    });
    await shot(W, 'audit-download');
    check('Audit: "Download audit package" gives a file and says so', !!d && !!toast && /^Downloading /.test(toast.text), toast);
    check('failure 12: the "Downloading …" toast is inside the screen', !!toast && toast.left >= 0 && toast.right <= toast.vw, toast);
    await named(check, W, 'failure 12: the package’s file name under the files', '.cs-main .cs-hint code');
    check('the Audit page was measured with the toast on screen', m.wide !== undefined);
    await fr.waitForTimeout(4400);

    // AML/KYC: all investors, one file opened
    await route(W, 'console-kyc');
    await named(check, W, 'failure 5: the row actions on AML/KYC', 'table [data-action=kyc-open], table [data-action=kyc-screen]');
    await target(check, W, 'failure 14: the "Integrations" link on AML/KYC', '.cs-main a.cs-link[href="#console-integrations"]');
    for (const t of await fr.evaluate(() => Array.from(document.querySelectorAll('[data-action=kyc-tab]')).map((b) => b.getAttribute('data-t')))) {
      if (t && (await press(W, `[data-action=kyc-tab][data-t="${t}"]`))) await screen(W, `sample AML/KYC, tab ${t}`);
    }
    if (await press(W, 'table [data-action=kyc-open]')) await screen(W, 'sample AML/KYC, a file open');

    // Integrations: "Add a connection" (failure 14: the close X beside the title)
    await route(W, 'console-integrations');
    await press(W, '[data-action=iv-conn-add]');
    const open = await dlgOpen(W);
    check('Integrations: "Add a connection" opens its dialog', open);
    if (open) {
      const c = await screen(W, 'sample Add a connection dialog');
      await shot(W, 'connection');
      check('failure 14: the "Add a connection" dialog’s close X stands beside its title', !!c.x && c.x.beside, c.x);
    }
    await closeDialog(W);

    // Console overview: the Setup steps
    await route(W, 'console');
    await target(check, W, 'failure 14: "Remove" on the Setup steps', '.cs-step-rm');
    check('the walk reached Requests, Investors, Audit and Team in the menu', ['console-requests', 'console-investors', 'console-audit', 'console-team'].every((p) => pages.indexOf(p) >= 0), pages);
    await done(check, W);
  };
}

/* ---------- firms: the other sample firms and the managed edition ---------- */
function firmsPart(vp) {
  return async ({ check, S }) => {
    const W = await framed(S, vp);
    W.part = `firms-${vp}`;
    await proveRefused(check, W);
    const { fr } = W;
    await fr.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
    await fr.goto(S.base);
    await fr.waitForSelector('#demo-sponsor');
    for (const id of ['pellbrook', 'ashwell-ridge']) {
      // the preview bar's own "Demo · sponsor" control
      await fr.selectOption('#demo-sponsor', id);
      await fr.waitForFunction((id) => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === id && /^#console/.test(location.hash), id, { timeout: 15000 });
      await fr.waitForTimeout(400);
      await consolePages(check, W, id, 16);
      if (id !== 'pellbrook') continue;
      // Requests with open rows: Approve and Decline, then the action that follows approval
      await route(W, 'console-requests');
      await named(check, W, 'failure 5: "Approve" on a pending request', 'table [data-action=req-approve]');
      await named(check, W, 'failure 5: "Decline" on a pending request', 'table [data-action=req-decline]');
      await shot(W, 'requests');
      const before = await fr.locator('table [data-action=req-approve]').count();
      // the subscription's row: a second press may be asked for when the investor is not fully verified
      const sub = fr.locator('table tbody tr', { hasText: /Subscription/i }).first().locator('[data-action=req-approve]');
      const pressed = await press(W, (await sub.count()) ? sub : 'table [data-action=req-approve]', { wait: 600 });
      if (pressed && (await fr.locator('table [data-action=req-approve]').count()) === before) await press(W, (await sub.count()) ? sub : 'table [data-action=req-approve]', { wait: 600 });
      check(`failure 5: "Approve" can be ${vp === 'phone' ? 'tapped' : 'clicked'} where it stands, and the request is approved`, pressed && (await fr.locator('table [data-action=req-approve]').count()) < before, { before, after: await fr.locator('table [data-action=req-approve]').count() });
      await screen(W, 'pellbrook requests after Approve');
      await named(check, W, 'failure 5: the action that follows approval ("Record funding" or "Countersign")', 'table [data-action=req-funded], table [data-action=req-paid]');
      await shot(W, 'requests-approved');
      await press(W, '[data-action=req-tab][data-t=all]');
      await screen(W, 'pellbrook requests, all');
    }
    // the managed edition: the same pages under the operator bar
    await fr.goto(`${S.origin}/index.html`);
    await fr.waitForSelector('#app .cs-nav, #app .pt, #app .op', { timeout: 20000 });
    await route(W, 'console');
    const ed = await fr.evaluate(() => ({ managed: window.CVPortal.EDITION.managed, bar: !!document.querySelector('.op'), tenant: window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id }));
    check('the managed edition opens its console under the operator bar', ed.managed && ed.bar, ed);
    await consolePages(check, W, 'managed', 12);
    await route(W, 'console-requests');
    await press(W, '[data-action=req-tab][data-t=all]');
    await screen(W, 'managed requests, all');
    await route(W, 'overview');
    await screen(W, 'managed investor view');
    await done(check, W);
  };
}

/* ---------- owner: a new sponsor, then an investor onboarded on the sample firm ---------- */
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
  if (await fr.evaluate(() => !!(document.getElementById('dlg') || {}).open)) {
    await fr.click('[data-action="es-adopt"]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open);
  }
  return true;
}
/** The signing bar's hint as it stands: its words, and whether any of them is cut off. */
const hintOf = (fr) =>
  fr.evaluate(() => {
    const el = document.querySelector('.sf-bar .sf-hint');
    if (!el) return null;
    const s = getComputedStyle(el);
    // shown: false while the tray below names the field being typed (the hint that repeats it gives way on a phone)
    return { text: el.textContent.trim(), shown: !!(el.offsetWidth || el.offsetHeight), cut: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1, width: el.clientWidth, needs: el.scrollWidth, wraps: s.whiteSpace, tray: (document.querySelector('.sf-bar .sf-tray:not([hidden]) .sf-tray-label') || {}).textContent || '', trayCut: Array.from(document.querySelectorAll('.sf-bar .sf-tray:not([hidden]) .sf-tray-label')).some((t) => t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1) };
  });
function ownerPart(vp) {
  return async ({ check, S }) => {
    const W = await framed(S, vp);
    W.part = `owner-${vp}`;
    await proveRefused(check, W);
    const { fr } = W;
    // a new sponsor: "Create your portal", then every page of the empty console
    await fr.waitForSelector('#sd-firm');
    await fr.fill('#sd-firm', 'Harbor Ridge Capital');
    await fr.fill('#sd-name', 'Dana');
    await fr.fill('#sd-last', 'Whitcombe');
    await fr.fill('#sd-email', 'dana@harborridge.example');
    await fr.fill('#sd-password', 'a-long-passphrase-42');
    await screen(W, 'sign-up, filled');
    await press(W, '.sd-submit');
    const inConsole = await fr.waitForFunction(() => /^#console/.test(location.hash), null, { timeout: 15000 }).then(() => true, () => false);
    check('"Create my portal" opens the new sponsor’s console', inConsole, await fr.evaluate(() => location.hash));
    if (inConsole) await consolePages(check, W, 'new sponsor', 16);

    // the sample firm with a subscription agreement: an investor invited and onboarded
    const portal = await Lib.setupPortal(S, { page: fr, context: W.A.context });
    const name = vp === 'phone' ? 'Ottoline Varga-Mbeki' : 'Leopold Asante-Ferreira';
    const email = vp === 'phone' ? 'ottoline.varga@example.com' : 'leopold.asante@example.com';
    const inv = await Lib.createInvitation(fr, { name, email, type: 'individual', offeringId: portal.offeringId });
    await route(W, 'console-investors');
    await screen(W, 'investors with an open invitation');
    await named(check, W, 'failure 5: the invitation row’s actions', '.inv8-tbl tbody button, .inv8-tbl tbody a');
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    let w = await Lib.walk(fr, { name, acc: 'yes', basis: 0, until: /Tax certification/, onStep: (hd) => screen(W, `onboarding: ${hd}`, 100) });
    check('the investor reaches the tax step', w.reached, w.seen);
    if (!w.reached) return done(check, W);
    await Lib.submit(fr);
    await fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
    await fr.waitForTimeout(500);
    let hint = await hintOf(fr);
    await shot(W, 'tax-bar');
    // At 1280x800 the bar is left as it was (this fix changes nothing on a desktop; the geometry comparison holds it)
    const phone = vp === 'phone';
    check(`failure 14: the tax form’s signing bar says "Nothing is required. Start goes to each empty field."${phone ? ' and no word of it is cut' : ''}`, !!hint && /Nothing is required\. Start goes to each empty field\./.test(hint.text) && (!phone || !hint.cut), hint);
    await screen(W, 'onboarding: the tax form to sign');
    check('the W-9 is signed on the page', await signW9(fr, inv.investorId));
    await Lib.finishTaxForm(fr);
    w = await Lib.walk(fr, { name, acc: 'yes', basis: 0, onStep: (hd) => screen(W, `onboarding: ${hd}`, 100) });
    check('the investor reaches the subscription agreement', w.reached, w.seen);
    if (!w.reached) return done(check, W);
    await fr.waitForTimeout(500);
    hint = await hintOf(fr);
    await shot(W, 'agreement-bar');
    if (phone) check('failure 14: the agreement’s signing bar hint is not cut', !!hint && !hint.cut, hint);
    await screen(W, 'onboarding: the agreement to sign');
    if (await press(W, '.sf-bar [data-action=es-next]')) {
      hint = await hintOf(fr);
      await shot(W, 'agreement-field');
      if (phone) check('failure 14: and it is not cut once Start has gone to a field (or gives way to the tray that names the field, itself not cut)', !!hint && !hint.cut && (hint.shown || !!hint.tray) && !hint.trayCut, hint);
      await screen(W, 'onboarding: the agreement, a field open');
    }
    await Lib.finishAgreement(fr);
    await screen(W, 'onboarding: done');
    await fr.click('.ivf-done a[href="#overview"]');
    await fr.waitForFunction(() => location.hash === '#overview');
    await fr.waitForSelector('.pt-nav a[href="#account"]', { state: 'attached', timeout: 15000 }).catch(() => {});
    // the investor's pages
    const portalPages = await fr.evaluate(() => Array.from(document.querySelectorAll('.pt-nav a[href^="#"]')).map((a) => a.getAttribute('href').slice(1)).filter((h, i, a) => h && !/sign-in|sign-out/.test(h) && a.indexOf(h) === i));
    check('the investor’s portal lists its pages', portalPages.length >= 5, portalPages);
    for (const h of portalPages) {
      await route(W, h);
      await screen(W, `investor ${h}`);
    }
    if (vp === 'phone' && (await press(W, '.pt-menu'))) await screen(W, 'investor menu open');
    await route(W, 'account');
    await target(check, W, 'failure 14: "Update bank account" on the investor’s Account page', '[data-action=update-bank]');
    await target(check, W, 'failure 14: "Verify now" on the investor’s Account page', '.pt-main [data-action=iv-start]');
    await route(W, 'overview');
    await target(check, W, 'failure 14: the support email link on the investor’s Home', '.pt-main a[href^="mailto:"]');
    // an active investor of the sample whose W-9 was finished without a signature (D-30), as the walkthrough's own run left
    // one: "Request tax form" is on that investor's row
    const who = await fr.evaluate((skip) => {
      const NS = window.CVPortal;
      const a = NS.state.ws.investors.find((x) => x.id !== skip && x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.email);
      a.esignConsent = a.esignConsent || { at: '2026-03-02T15:04:05Z', scope: 'Electronic records and signatures (ESIGN Act, UETA)' };
      Object.assign(a, { taxType: 'us-individual', address: '12 Elm Street, Austin, TX 78701', country: 'United States', citizenship: 'us', taxForm: 'W-9', taxCert: { form: 'W-9', revision: 'Rev. March 2024', envelopeId: 'env-old-unsigned', at: new Date().toISOString(), signed: false, signedBy: '' } });
      NS.app.save(true);
      return { id: a.id, email: a.email };
    }, inv.investorId);
    // the sponsor's rows for these investors
    await Lib.consoleRoute(fr, 'console-investors', '.cs-tbl');
    const rowOf = (mail) => fr.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: mail }).first();
    const row = rowOf(email);
    const askRow = rowOf(who.email);
    await row.scrollIntoViewIfNeeded().catch(() => {});
    await screen(W, 'investors, the onboarded investor');
    await shot(W, 'investors');
    const rowReach = async (sel, r) => {
      const l = (r || row).locator(sel).first();
      if (!(await l.count())) return { n: 0 };
      const b = await l.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right), vw: document.documentElement.clientWidth, t: el.innerText.trim() };
      });
      return Object.assign({ n: 1, inside: b.left >= -1 && b.right <= b.vw + 1 }, b);
    };
    for (const [what, sel, r0] of [['"Download" (the signed W-9)', '[data-action="kyc-iv-file"]'], ['"Request tax form" (a W-9 not signed)', '[data-action="tax-request"]', askRow], ['"View portal"', '[data-action="view-as"]'], ['"Account"', '[data-action="co-record"]']]) {
      const r = await rowReach(sel, r0);
      check(`failure 5: ${what} on the investor’s row is inside the screen’s width`, r.n === 1 && r.inside, r);
    }
    const dl = W.A.page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    const tapped = await press(W, row.locator('[data-action="kyc-iv-file"]').first());
    check(`failure 5: "Download" can be ${vp === 'phone' ? 'tapped' : 'clicked'} where it stands and gives the form`, tapped && !!(await dl));
    await fr.waitForTimeout(4400);
    // Requests: Approve and Decline, then Countersign
    await route(W, 'console-requests');
    await screen(W, 'requests, the investor’s subscription');
    await named(check, W, 'failure 5: "Approve" on the investor’s subscription', 'table [data-action=req-approve]');
    await named(check, W, 'failure 5: "Decline" on the investor’s subscription', 'table [data-action=req-decline]');
    await shot(W, 'requests');
    let ok = await press(W, 'table [data-action=req-approve]', { wait: 600 });
    if (ok && (await fr.locator('table [data-action=req-approve]').count())) ok = await press(W, 'table [data-action=req-approve]', { wait: 600 });
    check(`failure 5: "Approve" can be ${vp === 'phone' ? 'tapped' : 'clicked'} where it stands`, ok && !(await fr.locator('table [data-action=req-approve]').count()));
    await screen(W, 'requests after Approve');
    await named(check, W, 'failure 5: "Countersign" after approval', 'table [data-action=req-funded]');
    await shot(W, 'requests-approved');
    ok = await press(W, 'table [data-action=req-funded]', { wait: 600 });
    check(`failure 5: "Countersign" can be ${vp === 'phone' ? 'tapped' : 'clicked'} where it stands`, ok && !(await fr.locator('table [data-action=req-funded]').count()));
    await fr.waitForTimeout(4400);
    // the sponsor looks at the investor's portal: "Back to console" (failure 14)
    await Lib.consoleRoute(fr, 'console-investors', '.cs-tbl');
    if (await press(W, row.locator('[data-action="view-as"]').first(), { wait: 700 })) {
      await screen(W, 'the sponsor’s view of the investor’s portal');
      await target(check, W, 'failure 14: "Back to console" on the investor preview', '.pvbar-back');
    }
    // a tax-form request: Home offers it, and so does Account (failure 14)
    await Lib.consoleRoute(fr, 'console-investors', '.cs-tbl');
    ok = await press(W, askRow.locator('[data-action="tax-request"]').first(), { wait: 800 });
    await fr.waitForSelector('#dlg[open]', { timeout: 15000 }).catch(() => {});
    check('"Request tax form" opens the request’s email', ok && (await dlgOpen(W)));
    if (await dlgOpen(W)) await screen(W, 'the tax-form request email');
    await closeDialog(W);
    await fr.evaluate((id) => (window.CVPortal.state.viewer = id), who.id);
    await fr.selectOption('#demo-role', 'investor');
    await fr.waitForFunction(() => location.hash === '#overview');
    await fr.waitForTimeout(500);
    const offer = () => fr.evaluate(() => Array.from(document.querySelectorAll('.pt-main a')).filter((a) => a.offsetWidth && a.innerText.trim() === 'Complete your tax form').map((a) => a.getAttribute('href')));
    const home = await offer();
    check('Home offers the request ("Complete your tax form")', home.length === 1, home);
    await screen(W, 'investor Home with a tax-form request');
    await route(W, 'account');
    const acct = await offer();
    await fr.locator('.pt-main a', { hasText: 'Complete your tax form' }).first().scrollIntoViewIfNeeded().catch(() => {});
    await shot(W, 'account-request');
    check('failure 14: the investor’s Account page offers the pending tax-form request as Home does', acct.length === 1 && acct[0] === home[0], { home, account: acct });
    await screen(W, 'investor Account with a tax-form request');
    if (acct.length) {
      await press(W, fr.locator('.pt-main a', { hasText: 'Complete your tax form' }).first(), { wait: 700 });
      const hd = await Lib.heading(fr);
      check('and its button opens the request', hd === 'Tax certification', hd);
    }
    await done(check, W);
  };
}

/* ---------- editor: the field editor with fields marked Review (failure 11) ---------- */
function editorPart(vp) {
  return async ({ check, S }) => {
    const W = await framed(S, vp);
    W.part = `editor-${vp}`;
    await proveRefused(check, W);
    const { fr } = W;
    const portal = await Lib.setupPortal(S, { page: fr, context: W.A.context });
    // two of the template's fields marked for review, as a reading leaves them
    const marked = await fr.evaluate((oid) => {
      const NS = window.CVPortal;
      const t = NS.state.ws.esignTemplates.find((x) => x.offeringId === oid);
      const fl = t.fields.filter((f) => f.type === 'text').slice(0, 2);
      fl.forEach((f) => Object.assign(f, { review: true, reviewReason: 'The portal was not sure about this field.' }));
      NS.app.save(true);
      return fl.length;
    }, portal.offeringId);
    await route(W, `console-offering-${portal.offeringId}`);
    await named(check, W, 'the offering’s "Edit fields"', '[data-action=es-agreement-edit]');
    await press(W, '[data-action=es-agreement-edit]');
    const opened = await fr.waitForSelector('.fe .es-fld', { timeout: 60000 }).then(() => true, () => false);
    await fr.waitForTimeout(900);
    check('the field editor opens with its fields', opened);
    if (!opened) return done(check, W);
    // what a reading of the PDF leaves on the draft (the walkthrough opened the editor from Offering intake): the summary
    // above the editor then speaks of the fields marked Review
    await fr.evaluate(() => {
      const NS = window.CVPortal;
      const env = (NS.state.ws.envelopes || []).find((e) => e.agreementFor && e.status === 'draft');
      env.read = { ok: true, error: '', pages: env.pages, scanned: [], failed: [], places: 0, left: [], boxes: 0, blanks: 2, signatures: 1, initials: 0, investorPages: [], firmPages: [], firmLeft: 0, firmLeftPages: [], pictured: [] };
      NS.app.render();
    });
    await fr.waitForSelector('.fe .es-fld', { timeout: 30000 }).catch(() => {});
    await fr.waitForTimeout(900);
    const v = await fr.evaluate(() => {
      const note = document.querySelector('.es-agr-note');
      const list = document.querySelector('.fe-sec-review');
      return { flags: document.querySelectorAll('.fe .es-fld.is-flag').length, note: note ? note.innerText.replace(/\s+/g, ' ').trim() : '', list: !!list && !!(list.offsetWidth || list.offsetHeight) };
    });
    await shot(W, 'editor');
    check('the editor shows the fields marked Review', marked === 2 && v.flags === 2, Object.assign({ marked }, v));
    if (vp === 'phone') {
      check('the phone hides the list of marked fields (as before)', !v.list, v);
      check('failure 11: on the phone the sentence about fields marked Review does not point to the hidden list', /Fields marked Review/.test(v.note) && !/listed on the left/.test(v.note), v.note);
      check('failure 11: and says how to confirm one there', /Confirm this field/.test(v.note), v.note);
    } else {
      check('the desktop shows the list of marked fields, and the sentence is as it was', v.list && v.note.indexOf('Fields marked Review are listed on the left: confirm each one or move it to the right place before saving.') >= 0, v);
    }
    await screen(W, 'field editor');
    if (vp === 'phone') await target(check, W, 'failure 14: "Read the PDF again" above the editor', '.es-read-again');
    // a marked field's properties: "Confirm this field" is where the sentence says
    await press(W, '.fe .es-fld.is-flag');
    if (!(await fr.locator('[data-action=es-flag-ok]').first().isVisible().catch(() => false))) await press(W, '[data-action=fe-props]');
    const sheet = await fr.locator('[data-action=es-flag-ok]').first().isVisible().catch(() => false);
    await shot(W, 'editor-sheet');
    check(`a marked field’s properties offer "Confirm this field"${vp === 'phone' ? ' (tap the field, then the sliders button)' : ''}`, sheet);
    await screen(W, 'field editor, a marked field’s properties');
    if (sheet) {
      await press(W, '[data-action=es-flag-ok]');
      check('and it confirms the field', (await fr.locator('.fe .es-fld.is-flag').count()) === 1, await fr.locator('.fe .es-fld.is-flag').count());
    }
    await done(check, W);
  };
}

Lib.runParts(
  {
    'sample-phone': samplePart('phone'),
    'sample-desktop': samplePart('desktop'),
    'firms-phone': firmsPart('phone'),
    'firms-desktop': firmsPart('desktop'),
    'owner-phone': ownerPart('phone'),
    'owner-desktop': ownerPart('desktop'),
    'editor-phone': editorPart('phone'),
    'editor-desktop': editorPart('desktop')
  },
  { name: 'PHONE LAYOUT', unit: 'parts', flag: '--only', browser: true }
);
