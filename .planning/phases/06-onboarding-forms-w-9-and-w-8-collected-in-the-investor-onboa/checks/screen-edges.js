#!/usr/bin/env node
// Plan 06-35 (the second owner-path walkthrough, 06-WALKTHROUGH-2.md): the screen-edge items. The owner tests on an iPhone
// inside an app's web view. Every part loads the portal in a sandboxed iframe whose policy refuses every connection
// (connect-src 'none', as phone-layout.js), proves the refusal, and works at 390x844 with touch and an iPhone's user agent
// (-phone) or at 1280x800 (-desktop), with invented people and firms. Every part also checks, on each screen it visits: no
// script error, no request leaving the check server, no refused connection, no vendor name and never the forbidden word.
// Real WebKit is not installed here: Chromium stands in for the iPhone.
//   bar-phone         earlier failure 13: the preview bar never covers the page. On the sign-up page, the console Overview,
//                     Investors with the invite form open, the investor's Home and Documents, the field editor, an
//                     onboarding step and the W-9 signing view (an investor's invitation shows no bar: said so there):
//                     the bar is neither fixed nor sticky, and at the top of the page it ends above the page's first
//                     content; the page is scrolled to its end a screen at a time and at every stop no control or text box
//                     lies under the bar's box and the browser's hit test at each control's middle never lands on the bar;
//                     the page's last control is tapped where it stands; the bar's controls all lie inside the screen with
//                     no sideways scroll; Admin to Investor and back with the bar's own select
//   bar-desktop       the desktop bar is as it was: fixed, and its box and the page's bottom padding equal the numbers a run
//                     on the tree before recorded (SCREEN_EDGES_BAR_BASE, default SCRATCH/exec-06-35/bar-desktop-base.json;
//                     the first run with no such file records it)
//   hint-desktop      earlier failure 14 (the rest): on the W-9 signing view, the investor's agreement and the firm's
//                     countersign view, the signing bar's hint shows its whole sentence (nothing cut, the last letter inside
//                     its box), before and after Start; Start, Next and Finish are on the screen and press
//   sign-touch-phone  N3: on the W-9 (U.S. individual), the W-8BEN (foreign individual), the W-8BEN-E (foreign entity), the
//                     investor's agreement and the firm's countersign view, the browser's hit test at each signature
//                     field's middle and 20 px above and below it lands on the field or its touch layer (or on a
//                     neighbouring field nearer that point); a finger's tap 20 px below the middle (above, where the field
//                     below is nearer) opens the signature dialog; the envelope's field rectangles are unchanged
//   blanks-phone      earlier failures 9 and 11 on the signing views: on the W-9 and the agreement every blank the investor
//                     fills is read-only on the page with no keyboard of its own; a finger's tap on it, and 18 px above (or
//                     below) its middle on a side where no other field lies nearer, puts the typing in the tray, whose text
//                     is 16 px or more and whose label names the field; what is typed there fills the blank; each blank's
//                     touch layer is 44 px tall or more
//   NODE_PATH=$(npm root -g) node screen-edges.js [--only bar-phone,bar-desktop,hint-desktop,sign-touch-phone,blanks-phone]
// The last line is "SCREEN EDGES: PASS (parts run: N)" or "SCREEN EDGES: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');

const OUT = path.join(Lib.OUT, 'screen-edges');
fs.mkdirSync(OUT, { recursive: true });
const BAR_BASE = process.env.SCREEN_EDGES_BAR_BASE || path.join(Lib.SCRATCH, 'exec-06-35', 'bar-desktop-base.json');
Lib.describeShots([
  [/-bar-top-/, 'Phone: the top of the screen as it opens: where the preview bar stands.'],
  [/-bar-end-/, 'Phone: the end of the same screen, scrolled down: nothing at the bottom under the bar.'],
  [/-hint-/, 'Desktop: the signing bar and its hint, in full.'],
  [/-sig-/, 'Phone: the signature field after a tap 20 px below it opened the signature dialog.'],
  [/-tray-/, 'Phone: a blank of the document typed in the tray above the keyboard.']
]);

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const CSP = "connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' }
};

/** A fresh context whose page holds diy.html in a sandboxed iframe that refuses every connection (phone-layout.js's frame). */
async function framed(S, vp) {
  const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, VIEW[vp]) });
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await A.context.route(
    (u) => u.origin === S.origin && u.pathname === '/diy.html',
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CSP }, body: fs.readFileSync(path.join(Lib.ROOT, 'diy.html')) })
  );
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${S.origin}/diy.html" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  A.page.on('dialog', (d) => d.accept().catch(() => {}));
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  return { A, fr, vp, screens: [], leaks: [] };
}

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

/** A screen the part visits: its text is searched for vendor names and the forbidden word. */
// The sign-up page is the platform's own page for a firm signing up, and names the platform (the managed service offered
// there); every screen a firm's investors or its people see after it carries no such name. Library, model and signing
// vendor names and the forbidden word are searched on every screen.
const PLATFORM = /Carrow|\bVale\b/;
async function visit(W, label) {
  await W.fr.waitForTimeout(250);
  let text = await W.fr.evaluate(() => document.body.innerText).catch(() => '');
  if (label === 'the sign-up page') text = text.split('\n').map((l) => (Lib.VENDOR_RE.test(l) || Lib.WORD_RE.test(l) || Lib.VENDORS.test(l.replace(new RegExp(PLATFORM.source, 'g'), '')) ? l : '')).join('\n');
  const lk = Lib.leakCheck(text);
  W.screens.push(label);
  if (!lk.ok) W.leaks.push({ at: label, hits: lk.hits.slice(0, 4) });
}

async function done(check, W) {
  check(`no vendor name and never the forbidden word on the ${W.screens.length} screens visited`, W.screens.length > 0 && !W.leaks.length, W.leaks);
  const refused = await W.fr.evaluate(() => (window.__cspv || []).slice()).catch(() => []);
  check('no fetch or XHR was attempted (no refused connection)', refused.length === 0, refused);
  check('no script error in the browser', W.A.errors.length === 0, W.A.errors);
  check('no request left the check server', W.A.net.external.length === 0, W.A.net.external);
  await W.A.context.close();
}

const shot = (W, name) => W.A.page.screenshot({ path: path.join(OUT, `${W.vp}-${name}.png`), fullPage: false });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const route = async (W, h, wait) => {
  await W.fr.evaluate((h) => (location.hash = h), h);
  await W.fr.waitForTimeout(wait || 500);
};
async function press(W, sel, o) {
  const l = typeof sel === 'string' ? W.fr.locator(sel).first() : sel;
  try {
    if (!(await l.count())) return false;
    await l.scrollIntoViewIfNeeded({ timeout: 5000 });
    if (W.vp === 'phone') await l.tap({ timeout: (o && o.timeout) || 8000, force: !!(o && o.force) });
    else await l.click({ timeout: (o && o.timeout) || 8000, force: !!(o && o.force) });
    await W.fr.waitForTimeout((o && o.wait) || 350);
    return true;
  } catch (e) {
    W.pressErr = String(e && e.message).split('\n')[0];
    return false;
  }
}
const dlgOpen = (W) => W.fr.evaluate(() => !!(document.getElementById('dlg') || {}).open);

/* ---------- the walk an investor takes (invented people) ---------- */
/** An invitation on the open portal; taxType sets the investor type the sponsor chose. */
async function invite(W, portal, who) {
  const inv = await Lib.createInvitation(W.fr, { name: who.name, email: who.email, type: who.type || 'individual', account: who.account || '', offeringId: portal.offeringId });
  if (who.taxType)
    await W.fr.evaluate(
      ({ id, t }) => {
        const NS = window.CVPortal;
        NS.state.ws.investors.find((x) => x.id === id).taxType = t;
        NS.app.save(true);
      },
      { id: inv.investorId, t: who.taxType }
    );
  return inv;
}
const FOREIGN_INDIVIDUAL = { name: 'Henrike Oyelaran-Strand', email: 'henrike.oyelaran@example.com', taxType: 'foreign-individual' };
const FOREIGN_ENTITY = { name: 'Matteo Kristiansen-Abara', email: 'matteo.kristiansen@example.com', type: 'foreign-entity', account: 'Lagoon Crest Holdings Ltd.' };
/** Investor information as a foreign investor gives it (forms-flow.js toW8Step and toE8Step). */
function foreignProfile(fr, entity) {
  return async (hd) => {
    if (!/Investor information/.test(hd)) return;
    await fr.selectOption('#ob-country', entity ? 'Cayman Islands' : 'Germany');
    await fr.waitForTimeout(200);
    if (!entity && (await fr.locator('input[name="ob-citizen"][value="other"]').count())) await fr.check('input[name="ob-citizen"][value="other"]');
    await fr.fill('#ob-street', entity ? '7 Harbour Drive' : 'Lindenstraße 14');
    await fr.fill('#ob-city', entity ? 'George Town' : 'Leipzig');
    await fr.fill('#ob-st', entity ? 'Grand Cayman' : '');
    await fr.fill('#ob-zip', entity ? 'KY1-1001' : '04109');
    if (entity) {
      await fr.fill('#ob-formation', 'Cayman Islands');
      await fr.fill('#ob-tin', '');
    }
  };
}
/** The invitation opened and walked to its tax form's signing view; the foreign forms answer the step's own questions. */
async function toTaxForm(check, W, inv, who, kind) {
  const { fr } = W;
  await route(W, 'invite-' + inv.token, 700);
  const w = await Lib.walk(fr, { name: who.name, acc: 'yes', basis: 0, until: /Tax certification/, onFilled: kind === 'us' ? undefined : foreignProfile(fr, kind === 'entity') });
  check(`${who.name} reaches the tax step`, w.reached, w.seen);
  if (!w.reached) return false;
  if (kind === 'individual') {
    if (await fr.locator('#ob-w8Citizen').count()) await fr.selectOption('#ob-w8Citizen', 'Austria');
    await fr.fill('#ob-ftin', '98765432109');
  } else if (kind === 'entity') {
    await fr.check('input[name="ob-e8Ch3"][value="corporation"]');
    await fr.waitForTimeout(200);
    await fr.check('input[name="ob-e8Ch4"][value="activeNffe"]');
    await fr.waitForTimeout(200);
    await fr.fill('#ob-ftin', 'KY73015529');
  }
  await Lib.submit(fr);
  const open = await fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 }).then(() => true, () => false);
  await consent(W);
  await fr.waitForTimeout(600);
  check(`${who.name}: the tax form's signing view opens`, open);
  return open;
}
async function consent(W) {
  if (await W.fr.locator('#es-consent-box').count()) {
    await W.fr.check('#es-consent-box');
    await W.fr.click('[data-action="es-consent"]');
    await W.fr.waitForTimeout(500);
  }
}
/** After the agreement is finished: the sponsor approves the subscription and presses Countersign (the firm's signing view). */
async function toCountersign(check, W) {
  const { fr } = W;
  await fr.click('.ivf-done a[href="#overview"]').catch(() => {});
  await fr.waitForFunction(() => location.hash === '#overview', null, { timeout: 15000 }).catch(() => {});
  await Lib.consoleRoute(fr, 'console-requests', 'table [data-action=req-approve]');
  await fr.click('table [data-action=req-approve]');
  await fr.waitForTimeout(600);
  if (await fr.locator('table [data-action=req-approve]').count()) {
    await fr.click('table [data-action=req-approve]');
    await fr.waitForTimeout(600);
  }
  await fr.waitForSelector('table [data-action=req-funded]', { timeout: 15000 });
  await fr.click('table [data-action=req-funded]');
  await fr.waitForTimeout(900);
  await consent(W);
  const open = await fr.waitForSelector('.es-sign-console .es-doc-sign .es-page img', { timeout: 30000 }).then(() => true, () => false);
  await fr.waitForTimeout(600);
  check('Countersign opens the firm’s signing view', open);
  return open;
}

/** The signer's fields on the signing view now open: { env, sid, fields: [{ id, type, locked, page, x, y, w, h }], boxes }. */
const signerFields = (fr) =>
  fr.evaluate(() => {
    const bar = document.querySelector('.sf-bar');
    const ws = window.CVPortal.state.ws;
    const env = bar && (ws.envelopes || []).find((e) => e.id === bar.getAttribute('data-id'));
    if (!env) return null;
    const sid = bar.getAttribute('data-sid');
    const fields = env.fields.filter((f) => f.signerId === sid).map((f) => ({ id: f.id, type: f.type, locked: !!f.locked, label: f.label || '', page: f.page, x: f.x, y: f.y, w: f.w, h: f.h }));
    const boxes = Array.from(document.querySelectorAll('.es-doc-sign .es-f')).map((b) => ['--x', '--y', '--w', '--h'].map((p) => b.style.getPropertyValue(p)).join(' '));
    return { env: env.id, title: env.title, sid, fields, boxes };
  });
const rects = (sf) => JSON.stringify(sf && sf.fields.map((f) => [f.id, f.page, f.x, f.y, f.w, f.h]));

/* ---------- bar-phone: the preview bar on the phone ---------- */
/** The bar at the top of the page (runs in the frame, scrolled to the top). */
function barAt() {
  const bar = document.querySelector('.demo-bar');
  if (!bar || !(bar.offsetWidth || bar.offsetHeight)) return { bar: false };
  const s = getComputedStyle(bar);
  const r = bar.getBoundingClientRect();
  const first = ['notes', 'opbar', 'view'].map((id) => document.getElementById(id)).filter((el) => el && el.getBoundingClientRect().height > 0)[0];
  const vw = document.documentElement.clientWidth;
  const kids = Array.from(bar.children)
    .filter((k) => k.offsetWidth || k.offsetHeight)
    .map((k) => {
      const b = k.getBoundingClientRect();
      return { s: `${k.tagName.toLowerCase()}.${String(k.className).split(' ')[0]}`, t: String(k.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30), left: Math.round(b.left), right: Math.round(b.right) };
    });
  return { bar: true, position: s.position, top: Math.round(r.top), bottom: Math.round(r.bottom), firstTop: first ? Math.round(first.getBoundingClientRect().top) : null, first: first ? first.id : '', kids, outside: kids.filter((k) => k.left < -1 || k.right > vw + 1), vw, scrollW: bar.scrollWidth, clientW: bar.clientWidth, overflowX: s.overflowX };
}
/** The controls on screen at this scroll position: those under the bar's box, and those the hit test finds the bar on. */
function sweep() {
  const bar = document.querySelector('.demo-bar');
  const br = bar && (bar.offsetWidth || bar.offsetHeight) ? bar.getBoundingClientRect() : null;
  const vh = window.innerHeight;
  const vw = document.documentElement.clientWidth;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      if (n.tagName === 'DIALOG' && !n.open) return false;
    }
    return true;
  };
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  const txt = (el) => String(el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const out = { n: 0, under: [], onBar: [], other: 0, otherFirst: [] };
  Array.from(document.querySelectorAll('button, a[href], a[data-action], input:not([type=hidden]), select, textarea, summary, [role=button]'))
    .filter((el) => !(bar && bar.contains(el)) && !el.closest('#toasts') && vis(el))
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      const mx = r.left + r.width / 2;
      const my = r.top + r.height / 2;
      if (my < 0 || my > vh || mx < 0 || mx > vw) return;
      out.n++;
      const row = { s: name(el), t: txt(el), top: Math.round(r.top), bottom: Math.round(r.bottom) };
      if (br && r.left < br.right && r.right > br.left && r.top < br.bottom && r.bottom > br.top) out.under.push(row);
      const t = document.elementFromPoint(mx, my);
      if (t === el || (t && el.contains(t))) return;
      if (t && bar && bar.contains(t)) out.onBar.push(row);
      else {
        out.other++;
        if (out.otherFirst.length < 4) out.otherFirst.push(Object.assign({ by: t ? name(t) : 'nothing' }, row));
      }
    });
  return out;
}
/** Arms a one-time catch of the next click on the page's last control on screen; returns where its middle is. */
function armLast() {
  const bar = document.querySelector('.demo-bar');
  const vh = window.innerHeight;
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  const all = Array.from(document.querySelectorAll('button, a[href], a[data-action], input:not([type=hidden]), select, textarea, summary, [role=button]')).filter((el) => {
    // the fields placed on a document's page (the field editor's and the signing view's) are drag or signing surfaces, not
    // page controls: plan 06-36 and the parts below measure them
    if ((bar && bar.contains(el)) || el.closest('#toasts') || el.closest('dialog') || el.closest('.es-page, .es-fld') || el.disabled) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const my = r.top + r.height / 2;
    return my > 0 && my < vh;
  });
  const el = all.pop();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  window.__seTap = null;
  const f = (e) => {
    window.__seTap = { reached: e.target === el || el.contains(e.target), by: name(e.target) };
    e.preventDefault();
    e.stopImmediatePropagation();
    window.removeEventListener('click', f, true);
  };
  window.addEventListener('click', f, true);
  window.__seDisarm = () => window.removeEventListener('click', f, true);
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: name(el), t: String(el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 30) };
}
/** One screen on the phone: the bar where it stands, then the page scrolled to its end a screen at a time. */
async function edges(check, W, label, wantBar) {
  const { fr } = W;
  await visit(W, label);
  await fr.evaluate(() => window.scrollTo(0, 0));
  await fr.waitForTimeout(250);
  const b = await fr.evaluate(barAt);
  await shot(W, `bar-top-${slug(label)}`);
  if (!wantBar) {
    check(`${label}: no preview bar here (an investor’s invitation shows none), so nothing is under one`, !b.bar, b);
  } else {
    check(`${label}: the preview bar is on the page`, b.bar, b);
    if (!b.bar) return;
    check(`${label}: the preview bar is neither fixed nor sticky`, b.position !== 'fixed' && b.position !== 'sticky', { position: b.position });
    check(`${label}: at the top of the page the bar ends above the page’s first content`, b.firstTop != null && b.bottom <= b.firstTop + 0.5, { barTop: b.top, barBottom: b.bottom, first: b.first, firstTop: b.firstTop });
    check(`${label}: the bar’s controls all lie inside the screen, with no sideways scroll`, !b.outside.length && b.scrollW <= b.clientW + 1, { kids: b.kids, vw: b.vw, scrollWidth: b.scrollW, clientWidth: b.clientW, overflowX: b.overflowX });
  }
  let stops = 0;
  let n = 0;
  let other = 0;
  const under = [];
  const onBar = [];
  const otherFirst = [];
  for (let i = 0; i < 80; i++) {
    const s = await fr.evaluate(sweep);
    stops++;
    n += s.n;
    other += s.other;
    s.under.forEach((x) => under.push(Object.assign({ stop: i }, x)));
    s.onBar.forEach((x) => onBar.push(Object.assign({ stop: i }, x)));
    s.otherFirst.forEach((x) => otherFirst.length < 4 && otherFirst.push(x));
    const more = await fr.evaluate(() => {
      const y = window.scrollY;
      window.scrollBy(0, Math.max(200, window.innerHeight - 60));
      return window.scrollY > y;
    });
    await fr.waitForTimeout(150);
    if (!more) break;
  }
  if (other) console.log(`NOTE ${label}: ${other} control middles under the page’s own sticky header or signing guide (not the preview bar), e.g. ${JSON.stringify(otherFirst)}`);
  check(`${label}: scrolled to its end in ${stops} stops, no control or text box lies under the bar (${n} controls on screen counted)`, !under.length, { n: under.length, first: under.slice(0, 6) });
  check(`${label}: and the hit test at each control’s middle never lands on the bar`, !onBar.length, { n: onBar.length, first: onBar.slice(0, 6) });
  await shot(W, `bar-end-${slug(label)}`);
  const last = await fr.evaluate(armLast);
  if (!last) {
    check(`${label}: the page has a last control to tap`, false);
    return;
  }
  await W.A.page.touchscreen.tap(last.x, last.y);
  await fr.waitForTimeout(300);
  const got = await fr.evaluate(() => {
    if (window.__seDisarm) window.__seDisarm();
    return window.__seTap;
  });
  check(`${label}: the page’s last control (${last.s} "${last.t}") is tapped where it stands`, !!got && got.reached, { last, got });
  await fr.evaluate(() => window.scrollTo(0, 0));
}

async function barPhone({ check, S }) {
  const W = await framed(S, 'phone');
  await proveRefused(check, W);
  const { fr } = W;
  await fr.waitForSelector('#sd-firm');
  await edges(check, W, 'the sign-up page', true);
  const portal = await Lib.setupPortal(S, { page: fr, context: W.A.context });
  await route(W, 'console', 700);
  await edges(check, W, 'the console Overview', true);
  // Admin to Investor and back with the bar's own select, tapped where it stands
  let tapped = true;
  try {
    await fr.locator('#demo-role').tap({ timeout: 8000 });
  } catch (e) {
    tapped = false;
  }
  await fr.selectOption('#demo-role', 'investor');
  const toInv = await fr.waitForFunction(() => location.hash === '#overview', null, { timeout: 15000 }).then(() => true, () => false);
  await fr.waitForTimeout(500);
  await fr.selectOption('#demo-role', 'admin');
  const back = await fr.waitForFunction(() => /^#console/.test(location.hash), null, { timeout: 15000 }).then(() => true, () => false);
  check('the bar’s "Signed in as" select is tapped where it stands, and switches Admin to Investor and back', tapped && toInv && back, { tapped, toInv, back });
  await fr.waitForTimeout(500);
  await route(W, 'console-investors', 700);
  await press(W, '[data-action=invite-toggle]');
  const form = await fr.waitForSelector('#iv-email', { timeout: 10000 }).then(() => true, () => false);
  check('Investors: the invite form opens', form);
  await edges(check, W, 'Investors with the invite form open', true);
  await fr.selectOption('#demo-role', 'investor');
  await fr.waitForFunction(() => location.hash === '#overview', null, { timeout: 15000 }).catch(() => {});
  await fr.waitForTimeout(600);
  await edges(check, W, 'the investor’s Home', true);
  await route(W, 'documents', 700);
  await edges(check, W, 'the investor’s Documents', true);
  await fr.selectOption('#demo-role', 'admin');
  await fr.waitForTimeout(600);
  await route(W, `console-offering-${portal.offeringId}`, 700);
  await press(W, '[data-action=es-agreement-edit]');
  const ed = await fr.waitForSelector('.fe .es-fld', { timeout: 60000 }).then(() => true, () => false);
  await fr.waitForTimeout(900);
  check('the field editor opens', ed);
  await edges(check, W, 'the field editor', true);
  const who = { name: 'Wilhelmina Achterberg-Osei', email: 'wilhelmina.achterberg@example.com' };
  const inv = await invite(W, portal, who);
  await route(W, 'invite-' + inv.token, 700);
  await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
  await edges(check, W, 'an onboarding step', false);
  if (await toTaxForm(check, W, inv, who, 'us')) await edges(check, W, 'the W-9 signing view', false);
  await done(check, W);
}

/* ---------- bar-desktop: the desktop bar unchanged ---------- */
const barBox = (fr) =>
  fr.evaluate(() => {
    const bar = document.querySelector('.demo-bar');
    const main = document.querySelector('.cs-main');
    const view = document.getElementById('view');
    if (!bar) return null;
    const r = bar.getBoundingClientRect();
    return { position: getComputedStyle(bar).position, box: [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10), viewPad: getComputedStyle(view).paddingBottom, mainPad: main ? getComputedStyle(main).paddingBottom : '' };
  });
async function barDesktop({ check, S }) {
  const W = await framed(S, 'desktop');
  await proveRefused(check, W);
  const { fr } = W;
  const got = {};
  await fr.waitForSelector('#sd-firm');
  await visit(W, 'the sign-up page');
  got['the sign-up page'] = await barBox(fr);
  await Lib.setupPortal(S, { page: fr, context: W.A.context });
  await route(W, 'console', 700);
  await visit(W, 'the console Overview');
  got['the console Overview'] = await barBox(fr);
  await route(W, 'console-investors', 700);
  await visit(W, 'Investors');
  got.Investors = await barBox(fr);
  await fr.selectOption('#demo-role', 'investor');
  await fr.waitForFunction(() => location.hash === '#overview', null, { timeout: 15000 }).catch(() => {});
  await fr.waitForTimeout(600);
  await visit(W, 'the investor’s Home');
  got['the investor’s Home'] = await barBox(fr);
  Object.keys(got).forEach((k) => check(`${k}: the desktop bar is fixed (it floats, as before)`, !!got[k] && got[k].position === 'fixed', got[k]));
  if (!fs.existsSync(BAR_BASE)) {
    fs.mkdirSync(path.dirname(BAR_BASE), { recursive: true });
    fs.writeFileSync(BAR_BASE, JSON.stringify(got, null, 1));
    console.log(`NOTE bar-desktop: no run on the tree before was recorded; this run is recorded as it in ${BAR_BASE}`);
  }
  const base = JSON.parse(fs.readFileSync(BAR_BASE, 'utf8'));
  Object.keys(got).forEach((k) => check(`${k}: the bar’s box and the page’s bottom padding equal the tree before’s`, JSON.stringify(got[k]) === JSON.stringify(base[k]), { now: got[k], before: base[k] }));
  await done(check, W);
}

/* ---------- hint-desktop: the signing bar's hint in full ---------- */
const hintNow = (fr) =>
  fr.evaluate(() => {
    const el = document.querySelector('.sf-bar .sf-hint');
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let tn = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim()) tn = n;
    let lastIn = true;
    if (tn) {
      const end = tn.textContent.replace(/\s+$/, '').length;
      const range = document.createRange();
      range.setStart(tn, Math.max(0, end - 1));
      range.setEnd(tn, end);
      const lr = range.getBoundingClientRect();
      lastIn = lr.right <= r.right + 1 && lr.bottom <= r.bottom + 1;
    }
    return { text: el.textContent.replace(/\s+/g, ' ').trim(), shown: !!(el.offsetWidth || el.offsetHeight), cut: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1, lastIn, whiteSpace: s.whiteSpace, textOverflow: s.textOverflow, width: el.clientWidth, needs: el.scrollWidth };
  });
const actsNow = (fr) =>
  fr.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    return Array.from(document.querySelectorAll('.sf-bar .sf-acts button')).filter((b) => b.offsetWidth || b.offsetHeight).map((b) => {
      const r = b.getBoundingClientRect();
      return { t: b.innerText.trim(), inside: r.left >= 0 && r.right <= vw && r.top >= 0 && r.bottom <= vh };
    });
  });
async function hintAt(check, W, what) {
  const { fr } = W;
  let h = await hintNow(fr);
  await shot(W, `hint-${slug(what)}`);
  check(`${what}: the signing bar’s hint shows its whole sentence ("${h ? h.text : ''}")`, !!h && h.shown && !h.cut && h.lastIn, h);
  const a = await actsNow(fr);
  check(`${what}: the bar’s buttons (${a.map((x) => x.t).join(', ')}) are on the screen`, a.length >= 2 && a.every((x) => x.inside) && a.some((x) => /Finish/.test(x.t)) && a.some((x) => /Start|Next/.test(x.t)), a);
  const pressed = await press(W, '.sf-bar [data-action=es-next]');
  await fr.waitForTimeout(400);
  const started = await fr.evaluate(() => /Next/.test((document.querySelector('.sf-bar [data-action=es-next]') || { innerText: 'Next' }).innerText));
  h = await hintNow(fr);
  check(`${what}: Start presses, and the hint is whole after it too ("${h ? h.text : ''}")`, pressed && started && !!h && (!h.shown || (!h.cut && h.lastIn)), Object.assign({ pressed, started }, h));
}
async function hintDesktop({ check, S }) {
  const W = await framed(S, 'desktop');
  await proveRefused(check, W);
  const { fr } = W;
  const portal = await Lib.setupPortal(S, { page: fr, context: W.A.context });
  const who = { name: 'Cornelius Abernathy-Quist', email: 'cornelius.abernathy@example.com' };
  const inv = await invite(W, portal, who);
  if (!(await toTaxForm(check, W, inv, who, 'us'))) return done(check, W);
  await visit(W, 'the W-9 signing view');
  await hintAt(check, W, 'the W-9 signing view');
  await Lib.finishTaxForm(fr);
  const w = await Lib.walk(fr, { name: who.name, acc: 'yes', basis: 0 });
  check('the investor reaches the subscription agreement', w.reached, w.seen);
  if (!w.reached) return done(check, W);
  await fr.waitForTimeout(600);
  await visit(W, 'the investor’s agreement');
  await hintAt(check, W, 'the investor’s agreement');
  const text = await Lib.finishAgreement(fr);
  check('Finish on the agreement presses and the done screen follows', !!text);
  if (await toCountersign(check, W)) {
    await visit(W, 'the firm’s countersign view');
    await hintAt(check, W, 'the firm’s countersign view');
    // Finish pressed with the firm's signature still to make: the nudge is said in full in the bar
    W.pressErr = '';
    const finAt = await fr.evaluate(() => {
      const b = document.querySelector('.sf-bar .sf-finish');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { self: !!t && (t === b || b.contains(t)), disabled: b.disabled, aria: b.getAttribute('aria-disabled'), rect: [r.left, r.top, r.width, r.height].map(Math.round), at: t ? `${t.tagName.toLowerCase()}.${String(t.className).split(' ')[0]}` : '', count: document.querySelectorAll('.sf-bar .sf-finish').length };
    });
    // Finish carries aria-disabled while the firm's signature is still to make, and the automation then refuses to press
    // it; a person can: the browser's hit test at its middle finds Finish itself, so the mouse presses it there
    const fin = !!finAt && finAt.self && !finAt.disabled && (await press(W, '.sf-bar .sf-finish', { force: true }));
    await fr.waitForTimeout(400);
    const h = await hintNow(fr);
    check(`the firm’s countersign view: Finish presses (the bar says what is left, in full: "${h ? h.text : ''}")`, fin && !!h && h.shown && !h.cut && h.lastIn, Object.assign({ fin, err: W.pressErr, finAt }, h));
  }
  await done(check, W);
}

/* ---------- sign-touch-phone: the signature fields under a finger ---------- */
async function sigTouch(check, W, what, fid) {
  const { fr } = W;
  await fr.evaluate((fid) => {
    const el = document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(fid)}"]`);
    if (el) (el.closest('.es-f') || el).scrollIntoView({ block: 'center', inline: 'center' });
  }, fid);
  await fr.waitForTimeout(400);
  const m = await fr.evaluate((fid) => {
    const ctl = document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(fid)}"]`);
    if (!ctl) return null;
    const box = ctl.closest('.es-f') || ctl;
    const hit = document.querySelector(`.es-doc-sign .sf-hit[data-for="${CSS.escape(fid)}"]`);
    const r = box.getBoundingClientRect();
    const hr = hit ? hit.getBoundingClientRect() : null;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const name = (t) => `${t.tagName.toLowerCase()}${t.className && typeof t.className === 'string' ? '.' + t.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
    // Where another of the signer's fields lies nearer the point than this one (its own line, or its touch layer around
    // it), a tap there is that field's, as it must be: the point is counted as the neighbour's, never as a miss.
    const fieldOf = (t) => {
      const h2 = t && t.closest && t.closest('.sf-hit');
      if (h2) return document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(h2.getAttribute('data-for'))}"]`);
      const f2 = t && t.closest && t.closest('.es-f-mine');
      return f2 ? (f2.hasAttribute('data-fid') ? f2 : f2.querySelector('[data-fid]')) : null;
    };
    const at = (yy) => {
      const t = document.elementFromPoint(x, yy);
      if (!t) return 'nothing';
      if (t === box || box.contains(t)) return 'field';
      if (t === hit) return 'touch layer';
      const other = fieldOf(t);
      if (other && other !== ctl) {
        const o = (other.closest('.es-f') || other).getBoundingClientRect();
        if (Math.abs(o.top + o.height / 2 - yy) < Math.abs(y - yy)) return `nearer field ${other.getAttribute('data-fid')} (${Math.round(Math.abs(o.top + o.height / 2 - y))} px from this one's middle)`;
      }
      return name(t);
    };
    return { text: String(box.innerText || '').trim().slice(0, 30), field: `${Math.round(r.width)}x${Math.round(r.height * 10) / 10}`, layer: hr ? `${Math.round(hr.width)}x${Math.round(hr.height * 10) / 10}` : 'none', layerH: hr ? hr.height : 0, x, y, middle: at(y), above20: at(y - 20), below20: at(y + 20) };
  }, fid);
  const mine = (v) => v === 'field' || v === 'touch layer';
  const ok = (v) => mine(v) || /^nearer field /.test(v);
  check(`${what}: the hit test lands on the signature field or its touch layer at its middle and 20 px above and below, unless a neighbouring field is nearer that point (drawn ${m ? m.field : '?'} px, touch layer ${m ? m.layer : '?'} px)`, !!m && mine(m.middle) && ok(m.above20) && ok(m.below20) && (mine(m.above20) || mine(m.below20)), m);
  if (!m) return null;
  // the tap 20 px off the middle: below, or above where the field below is nearer that point
  m.tapAt = mine(m.below20) ? 20 : -20;
  await W.A.page.touchscreen.tap(m.x, m.y + m.tapAt);
  const opened = await fr.waitForFunction(() => !!(document.getElementById('dlg') || {}).open, null, { timeout: 6000 }).then(() => true, () => false);
  if (opened) await shot(W, `sig-${slug(what)}`);
  check(`${what}: a finger’s tap 20 px ${m.tapAt > 0 ? 'below' : 'above (the field below is nearer the point 20 px below)'} the field’s middle opens the signature dialog`, opened);
  if (opened) {
    await fr.click('#dlg [data-action="es-adopt"]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 }).catch(() => {});
    await fr.waitForTimeout(300);
    const filled = await fr.evaluate((fid) => {
      const el = document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(fid)}"]`);
      return !!el && !!(el.closest('.es-f-mine') || el).classList.contains('is-filled');
    }, fid);
    check(`${what}: and the signature adopted there fills the field`, filled);
  }
  W.touch.push(Object.assign({ what }, m, { opened }));
  return m;
}
/** Every signature field of the signer on the view now open, tapped; the envelope's rectangles before and after compared. */
async function sigView(check, W, what) {
  const before = await signerFields(W.fr);
  const sigs = before ? before.fields.filter((f) => f.type === 'signature' && !f.locked) : [];
  check(`${what}: the signer has a signature field on the page`, sigs.length > 0, before && before.fields.map((f) => f.type));
  await visit(W, what);
  for (const f of sigs) await sigTouch(check, W, `${what} (${f.label || f.id})`, f.id);
  const after = await signerFields(W.fr);
  check(`${what}: the envelope’s field rectangles and the page’s boxes are the ones the form was built with`, !!after && rects(after) === rects(before) && JSON.stringify(after.boxes) === JSON.stringify(before.boxes), { before: rects(before), after: rects(after) });
}
async function signTouchPhone({ check, S }) {
  const W = await framed(S, 'phone');
  W.touch = [];
  await proveRefused(check, W);
  const { fr } = W;
  const portal = await Lib.setupPortal(S, { page: fr, context: W.A.context });
  const who = { name: 'Rosalind Okonjo-Pfeiffer', email: 'rosalind.okonjo@example.com' };
  const inv = await invite(W, portal, who);
  if (await toTaxForm(check, W, inv, who, 'us')) {
    await sigView(check, W, 'the W-9 (U.S. individual)');
    await Lib.finishTaxForm(fr);
    const w = await Lib.walk(fr, { name: who.name, acc: 'yes', basis: 0 });
    check('the investor reaches the subscription agreement', w.reached, w.seen);
    if (w.reached) {
      await fr.waitForTimeout(600);
      await sigView(check, W, 'the investor’s agreement');
      await Lib.finishAgreement(fr);
      if (await toCountersign(check, W)) {
        await sigView(check, W, 'the firm’s countersign view');
        const o = await fr.evaluate(() => {
          const a = document.querySelector('.demo-bar');
          const b = document.querySelector('.sf-bar');
          if (!a || !b) return { bar: !!a, guide: !!b, overlap: false };
          const r = a.getBoundingClientRect();
          const g = b.getBoundingClientRect();
          return { bar: [Math.round(r.top), Math.round(r.bottom)], guide: [Math.round(g.top), Math.round(g.bottom)], overlap: r.left < g.right && r.right > g.left && r.top < g.bottom && r.bottom > g.top };
        });
        check('the firm’s countersign view: the preview bar does not lie over the signing guide', !o.overlap, o);
      }
    }
  }
  const fi = await invite(W, portal, FOREIGN_INDIVIDUAL);
  if (await toTaxForm(check, W, fi, FOREIGN_INDIVIDUAL, 'individual')) await sigView(check, W, 'the W-8BEN (foreign individual)');
  const fe = await invite(W, portal, FOREIGN_ENTITY);
  if (await toTaxForm(check, W, fe, FOREIGN_ENTITY, 'entity')) await sigView(check, W, 'the W-8BEN-E (foreign entity)');
  fs.writeFileSync(path.join(OUT, 'sign-touch-phone.json'), JSON.stringify(W.touch, null, 1));
  await done(check, W);
}

/* ---------- blanks-phone: the document's blanks typed in the tray ---------- */
async function blanksAt(check, W, what) {
  const { fr } = W;
  const sf = await signerFields(fr);
  const ids = sf ? sf.fields.filter((f) => !f.locked && (f.type === 'text' || f.type === 'name' || f.type === 'email' || f.type === 'number')).map((f) => f.id) : [];
  const list = await fr.evaluate((ids) => ids.map((id) => {
    const el = document.querySelector(`.es-doc-sign input.es-f-input[data-fid="${CSS.escape(id)}"]`);
    return el ? { id, ro: el.readOnly, im: el.getAttribute('inputmode'), title: (el.closest('.es-f-mine') || el).title || '' } : null;
  }).filter(Boolean), ids);
  check(`${what}: the investor’s unlocked blanks on the page (${list.length}) are read-only with no keyboard of their own`, list.every((b) => b.ro && b.im === 'none'), list.filter((b) => !(b.ro && b.im === 'none')));
  await visit(W, what);
  const bad = [];
  const rows = [];
  let offsetTaps = 0;
  let between = 0;
  for (const b of list) {
    const label = b.title.replace(/, (required|optional)$/, '');
    await fr.evaluate((id) => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      const el = document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(id)}"]`);
      (el.closest('.es-f') || el).scrollIntoView({ block: 'center', inline: 'center' });
    }, b.id);
    await fr.waitForTimeout(350);
    const g = await fr.evaluate((id) => {
      const el = document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(id)}"]`);
      const box = el.closest('.es-f') || el;
      const hit = document.querySelector(`.es-doc-sign .sf-hit[data-for="${CSS.escape(id)}"]`);
      const r = box.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const mine = (yy) => {
        const t = document.elementFromPoint(x, yy);
        return !!t && (t === box || box.contains(t) || t === hit);
      };
      const t0 = document.elementFromPoint(x, y);
      return { mid: t0 ? `${t0.tagName.toLowerCase()}.${String(t0.className).split(' ')[0]}${t0 === el ? ' (it)' : ''}` : 'nothing', x, y, h: Math.round(r.height * 10) / 10, px: Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10, layerH: hit ? Math.round(hit.getBoundingClientRect().height * 10) / 10 : 0, upOk: mine(y - 18), downOk: mine(y + 18), value: el.value };
    }, b.id);
    const tray = async () =>
      fr.evaluate((id) => {
        const t = document.activeElement;
        const lab = document.querySelector('.sf-bar .sf-tray:not([hidden]) .sf-tray-label');
        const tr = document.querySelector('.sf-bar .sf-tray:not([hidden])');
        return { active: t ? `${t.tagName.toLowerCase()}.${String(t.className).split(' ')[0]}` : '', inTray: !!t && t.matches('.sf-tray-in'), forIt: !!tr && tr.getAttribute('data-fid') === id, px: t && t.matches('.sf-tray-in') ? parseFloat(getComputedStyle(t).fontSize) : 0, label: lab ? lab.textContent.trim() : '' };
      }, b.id);
    await W.A.page.touchscreen.tap(g.x, g.y);
    await fr.waitForTimeout(400);
    const t1 = await tray();
    t1.dialog = await dlgOpen(W);
    if (t1.dialog) {
      await fr.evaluate(() => window.CVPortal.ui.closeDialog());
      await fr.waitForTimeout(250);
    }
    if (t1.inTray && rows.length < 2) await shot(W, `tray-${slug(what)}-${rows.length}`);
    // what is typed in the tray fills the blank (then the blank is put back as it was)
    let typed = false;
    if (t1.inTray && t1.forIt) {
      await W.A.page.keyboard.press('End');
      await W.A.page.keyboard.type(' 7Q');
      await fr.waitForTimeout(250);
      const v = await fr.evaluate((id) => ({ blank: document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(id)}"]`).value, tray: document.querySelector('.sf-tray-in').value }), b.id);
      typed = v.blank === v.tray && / 7Q$/.test(v.blank);
      await fr.fill('.sf-tray-in', g.value);
      await fr.waitForTimeout(200);
    }
    // a tap inside the touch layer, 18 px above the middle (below when a neighbouring field lies above)
    let t2 = null;
    // measured again: the tray that opened may have moved the page
    await fr.evaluate((id) => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      const el = document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(id)}"]`);
      (el.closest('.es-f') || el).scrollIntoView({ block: 'center', inline: 'center' });
    }, b.id);
    await fr.waitForTimeout(350);
    const g2 = await fr.evaluate((id) => {
      const el = document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(id)}"]`);
      const box = el.closest('.es-f') || el;
      const hit = document.querySelector(`.es-doc-sign .sf-hit[data-for="${CSS.escape(id)}"]`);
      const r = box.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const mine = (yy) => {
        const t = document.elementFromPoint(x, yy);
        return !!t && (t === box || box.contains(t) || t === hit);
      };
      const who = (yy) => {
        const t = document.elementFromPoint(x, yy);
        return t ? `${t.tagName.toLowerCase()}.${String(t.className).split(' ')[0]}[${t.getAttribute('data-fid') || t.getAttribute('data-for') || (t.closest('[data-fid]') || { getAttribute: () => '' }).getAttribute('data-fid')}]` : 'nothing';
      };
      // the point is this blank's only where no other of the signer's fields lies nearer it (a finger's tap goes to the
      // nearest control, in WebKit as in Chromium)
      const dist = (b2, yy) => Math.hypot(Math.max(0, b2.left - x, x - b2.right), Math.max(0, b2.top - yy, yy - b2.bottom));
      const others = Array.from(document.querySelectorAll('.es-doc-sign .es-f-mine:not(.is-given)')).filter((o) => o !== box).map((o) => o.getBoundingClientRect());
      const nearest = (yy) => others.every((o) => dist(o, yy) > dist(r, yy));
      return { x, y, upOk: mine(y - 18) && nearest(y - 18), downOk: mine(y + 18) && nearest(y + 18), up: who(y - 18), down: who(y + 18), top: Math.round(r.top), bottom: Math.round(r.bottom) };
    }, b.id);
    const dy = g2.upOk ? -18 : g2.downOk ? 18 : 0;
    if (dy) {
      // what the finger's tap reached: the element under the touch, and the element the click went to
      await fr.evaluate(() => {
        const nm = (t) => (t ? `${t.tagName.toLowerCase()}.${String(t.className).split(' ')[0]}[${t.getAttribute('data-fid') || t.getAttribute('data-for') || ''}]` : '');
        window.__seGot = {};
        const d = (e) => (window.__seGot.down = nm(e.target));
        const c = (e) => (window.__seGot.click = nm(e.target));
        window.addEventListener('pointerdown', d, true);
        window.addEventListener('click', c, true);
        window.__seOff = () => {
          window.removeEventListener('pointerdown', d, true);
          window.removeEventListener('click', c, true);
        };
      });
      await W.A.page.touchscreen.tap(g2.x, g2.y + dy);
      await fr.waitForTimeout(400);
      t2 = Object.assign(await tray(), { at: g2, got: await fr.evaluate(() => (window.__seOff(), window.__seGot)) });
      offsetTaps++;
      // a signature dialog opened by a tap meant for this blank is closed (and counted against it)
      t2.dialog = await dlgOpen(W);
      if (t2.dialog) {
        await fr.evaluate(() => window.CVPortal.ui.closeDialog());
        await fr.waitForTimeout(250);
      }
    } else between++;
    const row = { id: b.id, label, mid: g.mid, drawn: g.h, pagePx: g.px, layer: g.layerH, tap: t1, typed, offset: dy, offsetTap: t2 };
    rows.push(row);
    const labelOk = !!label && t1.label.indexOf(label) === 0;
    if (!(t1.inTray && t1.forIt && t1.px >= 16 && labelOk && typed && g.layerH >= 43.9 && (!t2 || (t2.inTray && t2.forIt)))) bad.push(row);
  }
  fs.writeFileSync(path.join(OUT, `blanks-${slug(what)}.json`), JSON.stringify(rows, null, 1));
  const sizes = rows.map((r) => r.pagePx);
  console.log(`NOTE ${what}: ${rows.length} blanks drawn at ${sizes.length ? Math.min(...sizes) : '-'} to ${sizes.length ? Math.max(...sizes) : '-'} px text on the page; touch layers ${rows.length ? Math.min(...rows.map((r) => r.layer)) : '-'} px tall at least; ${offsetTaps} tapped 18 px off the middle, ${between} with a neighbouring field closer than 18 px on both sides (tapped on themselves only)`);
  check(`${what}: each of the ${rows.length} blanks, tapped (and tapped 18 px off its middle), is typed in the tray at 16 px or more, the tray’s label names it, what is typed fills it, and its touch layer is 44 px tall or more`, !bad.length, bad.slice(0, 4));
  return rows.length;
}
async function blanksPhone({ check, S }) {
  const W = await framed(S, 'phone');
  await proveRefused(check, W);
  const { fr } = W;
  const portal = await Lib.setupPortal(S, { page: fr, context: W.A.context });
  const who = { name: 'Thaddeus Nakashima-Ruiz', email: 'thaddeus.nakashima@example.com' };
  const inv = await invite(W, portal, who);
  if (await toTaxForm(check, W, inv, who, 'us')) {
    await blanksAt(check, W, 'the W-9');
    await Lib.finishTaxForm(fr);
    const w = await Lib.walk(fr, { name: who.name, acc: 'yes', basis: 0 });
    check('the investor reaches the subscription agreement', w.reached, w.seen);
    if (w.reached) {
      await fr.waitForTimeout(600);
      const n = await blanksAt(check, W, 'the agreement');
      check('the agreement has blanks for the investor to fill', n > 0, n);
    }
  }
  await done(check, W);
}

Lib.runParts(
  {
    'bar-phone': barPhone,
    'bar-desktop': barDesktop,
    'hint-desktop': hintDesktop,
    'sign-touch-phone': signTouchPhone,
    'blanks-phone': blanksPhone
  },
  { name: 'SCREEN EDGES', unit: 'parts', flag: '--only', browser: true }
);
