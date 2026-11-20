#!/usr/bin/env node
// gate: browser
// last "WALK3 FIXES: PASS (parts run: 9)"
// Quick fix batch 2026-11-20 (06-WALKTHROUGH-3.md, the cosmetic failures 4, 6, 8, 9, 10 and 11 of the preview's third
// owner-path walkthrough). Every browser part loads the self-serve portal (diy.html) the way the owner sees it: inside a
// sandboxed iframe whose policy refuses every connection (P9/lib9.js framed), at 390x844 with touch (-phone) or at
// 1280x800 (-desktop), on the Kestrel Bay sample as its admin.
//   targets-phone     failure 9: EDGAR access's "Open the answer sheet" and the offering link in ACH origination's
//                     "Paying entity by offering" (an offering with a short name, "Fund 7", on one line) each have a touch area of at
//                     least 24 px high, and a tap 3 px above the text still lands on the link
//   money             failure 11: the foreign withholding line's reason and the deposit's change-log line print every
//                     amount as the portal's money formatter does (NS.ui.usdc: "$5,000.00", never "$5000.00")
//   signedin-phone    failure 8: with a long firm name ("Harbor Ridge Capital") every choice of "Signed in as" fits its
//                     menu whole; the menu carries the chosen name in full as its title; the preview bar keeps its height
//                     when another choice is made (no layout shift)
//   signedin-desktop  at 1280x800 (the floating bar left as it was): the chosen name fits, the title carries it in full and
//                     follows another choice, and the bar keeps its height
//   deliver-phone     failure 6: on a K-1 import's page, Deliver pressed before the Contact for tax documents is saved
//                     shows its one reason beside the button, on screen and not covered; Telephone is drawn as a rounded
//                     field like the fields around it
//   deliver-desktop   the same at 1280x800
//   parts-load        failure 4: a page load and Tax documents ask for no file that is not shipped (no 404 at all), and
//                     every file in NS.taxUI.PARTS is in assets/js
//   headings-phone    failure 10: Form D, EDGAR access and State filings each open under the Filings bar with a heading
//                     naming the section (the tab's own h1 pattern, its font), the offering's name kept beside it, and the
//                     heading the same as the name the help guide quotes ("Form D", "EDGAR access", "State filings")
//   headings-desktop  the same at 1280x800
// Every browser part: no fetch attempted, no script error, no request outside the check server, no vendor name or
// forbidden word on screen (P9/lib9.js quiet and leak).
//   NODE_PATH=$(npm root -g) node walk3-fixes.js [--only targets-phone,money,signedin-phone,signedin-desktop,deliver-phone,deliver-desktop,parts-load,headings-phone,headings-desktop]
// The last line is "WALK3 FIXES: PASS (parts run: N)" or "WALK3 FIXES: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');
const L9 = require('../../09-filings-tab-form-d-and-blue-sky/checks/lib9.js');

const OUT = path.join(Lib.OUT, 'walk3-fixes');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/targets-edgar\.png$/, 'EDGAR access on the phone: "Open the answer sheet" with its touch area.'],
  [/targets-ach\.png$/, 'ACH origination on the phone: "Paying entity by offering" with the one-line offering link.'],
  [/signedin-(phone|desktop)\.png$/, 'The preview bar with a long firm name: "Signed in as" shows the whole name.'],
  [/deliver-(phone|desktop)\.png$/, 'A K-1 import, Deliver pressed before the contact is saved: the reason beside the button.'],
  [/headings-(phone|desktop)-(formd|access|states)\.png$/, 'A Filings section: the heading naming the section under the bar, with the offering\'s name.']
]);

const shot = (F, name) => F.A.page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false }).catch(() => {});

/** The height a finger can hit: the box, or the absolutely placed ::before/::after laid over it (as phone-layout.js). */
const HIT = `(el) => {
  const r = el.getBoundingClientRect();
  let hh = r.height;
  if (getComputedStyle(el).position === 'static') return { box: Math.round(r.height * 10) / 10, hit: Math.round(hh * 10) / 10, w: Math.round(r.width) };
  ['::before', '::after'].forEach((p) => {
    const s = getComputedStyle(el, p);
    if (!s || s.content === 'none' || s.content === 'normal' || s.display === 'none' || s.position !== 'absolute' || s.pointerEvents === 'none') return;
    const t = parseFloat(s.top);
    const b = parseFloat(s.bottom);
    if (isFinite(t) && isFinite(b)) hh = Math.max(hh, r.height - t - b);
  });
  return { box: Math.round(r.height * 10) / 10, hit: Math.round(hh * 10) / 10, w: Math.round(r.width) };
}`;

/** One link: its touch height, and whether a point 3 px above its text box (inside the screen) lands on it. */
async function measureLink(F, selector) {
  await F.fr.locator(selector).first().scrollIntoViewIfNeeded().catch(() => {});
  await F.fr.waitForTimeout(250);
  return F.fr.evaluate(
    ({ selector, HIT }) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const m = new Function('return ' + HIT)()(el);
      const r = el.getClientRects()[0];
      const x = r.left + Math.min(r.width / 2, 20);
      const above = document.elementFromPoint(x, r.top - 3);
      const below = document.elementFromPoint(x, r.bottom + 3);
      return Object.assign(m, { text: el.innerText.trim(), lines: el.getClientRects().length, above: !!above && (above === el || el.contains(above)), below: !!below && (below === el || el.contains(below)) });
    },
    { selector, HIT }
  );
}

/* ---------- a: the two small tap targets ---------- */
async function targetsPhone({ check, S }) {
  const F = await L9.framed(S, 'phone');
  await L9.proveRefused(check, F);
  await L9.sample(F);
  // a name short enough to stay on one line in the ACH table (the walk's "New offering" was 85x17 px there)
  const seeded = await L9.seed(F, { name: 'Fund 7', shortName: 'Fund 7', sales: [{ daysAgo: 5, state: 'TX' }] });
  const id = seeded.offeringId;
  await L9.goto(F, `console-filings-access-${id}`, '.fl-section[data-part="access"] .fl-steps');
  const sheet = await measureLink(F, '.fl-section[data-part="access"] .fl-steps a[href$="-sheet"]');
  await shot(F, 'targets-edgar');
  check('EDGAR access: "Open the answer sheet" has a touch area of at least 24 px high', !!sheet && sheet.text === 'Open the answer sheet' && sheet.hit >= 24, sheet);
  check('EDGAR access: a tap 3 px above and 3 px below "Open the answer sheet" lands on the link', !!sheet && sheet.above && sheet.below, sheet);
  await L9.leak(check, F, 'EDGAR access');
  await L9.goto(F, 'console-ach', '.cs-tbl');
  const sel = `.cs-tbl a[href="#console-offering-${id}"]`;
  const ach = await measureLink(F, sel);
  await shot(F, 'targets-ach');
  check('ACH origination: the one-line offering link "Fund 7" has a touch area of at least 24 px high', !!ach && ach.text === 'Fund 7' && ach.lines === 1 && ach.hit >= 24, ach);
  check('ACH origination: a tap 3 px above and 3 px below the offering link lands on it', !!ach && ach.above && ach.below, ach);
  // every offering link in that table, whatever its length
  const all = await F.fr.evaluate(
    (HIT) =>
      Array.from(document.querySelectorAll('.cs-tbl a[href^="#console-offering-"]'))
        .map((a) => Object.assign({ t: a.innerText.trim() }, new Function('return ' + HIT)()(a)))
        .filter((x) => x.hit < 24),
    HIT
  );
  check('ACH origination: no offering link in "Paying entity by offering" has a touch area under 24 px', all.length === 0, all);
  await L9.press(F, sel);
  const to = await F.fr.evaluate(() => ({ route: window.CVPortal.state.route, param: window.CVPortal.state.param }));
  check('tapping the offering link still opens that offering', to.route === 'console-offering' && to.param === id, to);
  await L9.leak(check, F, 'ACH origination');
  await L9.quiet(check, F, 'EDGAR access and ACH origination');
  await F.A.context.close();
}

/* ---------- b: amounts printed with the money formatter ---------- */
async function money({ check, S }) {
  const F = await L9.framed(S, 'phone');
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const r = await F.fr.evaluate(() => {
    const NS = window.CVPortal;
    const W = NS.withholding;
    const U = NS.ui;
    const ws = NS.state.ws;
    const rule = W.foreignDraft({ investorId: 'X-1', grossCents: 500000 }, { subjectCents: 500000 });
    const entered = W.foreignDraft({ investorId: 'X-1', grossCents: 123456789 }, { subjectCents: 123456789, ratePct: 15 });
    const small = W.foreignDraft({ investorId: 'X-1', grossCents: 99999 }, { subjectCents: 99999 });
    const o = ws.offerings[0];
    W.addDeposit(ws, { offeringId: o.id, kind: 'foreign', year: '2026', cents: 100000, date: '2027-01-15', confirmation: 'W3-DEP', by: 'Walk 3 check' });
    const log = (ws.audit || []).filter((e) => e.action === 'Tax deposit marked' && /W3-DEP/.test(e.detail || '')).map((e) => e.detail);
    return { rule: rule.why, entered: entered.why, small: small.why, log, usdc: [U.usdc(500000), U.usdc(123456789), U.usdc(99999), U.usdc(100000)] };
  });
  const raw = /\$\d{4,}\.\d\d/;
  check('the 30% line\'s reason prints the amount as the money formatter does ($5,000.00)', r.rule.indexOf(`(${r.usdc[0]})`) >= 0 && r.usdc[0] === '$5,000.00' && !raw.test(r.rule), r);
  check('the entered rate\'s reason prints $1,234,567.89', r.entered.indexOf(`(${r.usdc[1]})`) >= 0 && r.usdc[1] === '$1,234,567.89' && !raw.test(r.entered), r);
  check('an amount under a thousand dollars is printed as before ($999.99)', r.small.indexOf(`(${r.usdc[2]})`) >= 0, r);
  check('the deposit\'s change-log line prints $1,000.00', r.log.length === 1 && r.log[0].indexOf(`${r.usdc[3]} deposited 2027-01-15`) >= 0 && !raw.test(r.log[0]), r.log);
  await L9.quiet(check, F, 'the withholding reasons');
  await F.A.context.close();
}

/* ---------- c: "Signed in as" on the preview bar ---------- */
async function signedIn(check, S, size) {
  const F = await L9.framed(S, size);
  await L9.proveRefused(check, F);
  await L9.sample(F);
  await F.fr.evaluate(() => {
    const NS = window.CVPortal;
    NS.state.ws.tenant.shortName = 'Harbor Ridge Capital';
    NS.app.save(true);
    NS.app.render();
  });
  await F.fr.waitForTimeout(400);
  const measure = () =>
    F.fr.evaluate(() => {
      const sel = document.getElementById('demo-role');
      const bar = document.querySelector('#demo .demo-bar');
      const cs = getComputedStyle(sel);
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      // the room the menu leaves for its text: its inner width less its padding and the arrow the browser draws (20 px)
      const room = sel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 20;
      const opts = Array.from(sel.options).map((o) => ({ t: o.text, w: Math.ceil(ctx.measureText(o.text).width) }));
      const chosen = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
      const b = bar.getBoundingClientRect();
      const s = sel.getBoundingClientRect();
      return { room: Math.floor(room), opts, chosen, title: sel.getAttribute('title') || '', bar: [Math.round(b.top), Math.round(b.height)], sel: [Math.round(s.left), Math.round(s.top), Math.round(s.width), Math.round(s.height)], font: cs.fontSize, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
  const a = await measure();
  await shot(F, `signedin-${size}`);
  check(`"Signed in as" shows its whole choice with the long firm name ("${a.chosen}")`, /Harbor Ridge Capital$/.test(a.chosen) && (a.opts.find((o) => o.t === a.chosen) || { w: 1e9 }).w <= a.room, a);
  // The phone: every choice fits. The desktop's floating bar is left as it was (its menu is held to 240 px, failure 13's
  // desktop half is not in this batch): there the chosen name fits and the title carries every name in full.
  if (size === 'phone') check('every choice of "Signed in as" fits its menu whole', a.opts.length >= 2 && a.opts.every((o) => o.w <= a.room), a);
  check('the menu carries the chosen name in full as its title', a.title === a.chosen && a.title.length > 0, { title: a.title, chosen: a.chosen });
  check('the preview bar makes the page no wider than the screen', !a.overflow, a);
  // another choice: the bar keeps its place and height
  await F.fr.selectOption('#demo-role', 'team');
  await F.fr.waitForFunction(() => window.CVPortal.state.role === 'team', null, { timeout: 10000 }).catch(() => {});
  await F.fr.waitForTimeout(500);
  const b = await measure();
  check('after choosing Team member the title follows the choice and the bar keeps its height (no layout shift)', b.title === b.chosen && /^Team member/.test(b.chosen) && b.bar[1] === a.bar[1] && b.sel[3] === a.sel[3], { before: a.bar, after: b.bar, sel: [a.sel, b.sel], title: b.title });
  await L9.leak(check, F, 'the console with the preview bar');
  await L9.quiet(check, F, 'the preview bar');
  await F.A.context.close();
}

/* ---------- d: Deliver's reason beside the button ---------- */
/** One K-1 (Form 1065) 2025 import of the first fund with two holders, both packages confirmed with their documents. */
function seatK1(F) {
  return F.fr.evaluate(() => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const holders = (o) => ws.investors.filter((i) => (i.positions || []).some((p) => p.offeringId === o.id));
    const o = ws.offerings.find((x) => holders(x).length >= 2);
    const two = holders(o).slice(0, 2);
    const by = 'Walk 3 check';
    const b = NS.taxdocs.addBatch(ws, { kind: 'k1-1065', year: '2025', offeringId: o.id, fileName: 'k1-2025.pdf', pages: 4, by, split: { packages: [{ first: 1, last: 2 }, { first: 3, last: 4 }], loose: [], scan: false } });
    b.packages.forEach((p, k) => {
      NS.taxdocs.confirm(ws, b.id, p.id, { by, investorId: two[k].id });
      NS.taxdocs.toDocument(ws, b.id, p.id, { id: `doc-w3-${k}`, title: 'Schedule K-1 (Form 1065) 2025', fileName: `k1-${k}.pdf`, size: 1000, by });
    });
    if (ws.taxdocs) ws.taxdocs.contact = {};
    NS.app.save(true);
    NS.app.render();
    return { batchId: b.id };
  });
}
async function deliver(check, S, size) {
  const F = await L9.framed(S, size);
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const { batchId } = await seatK1(F);
  await L9.goto(F, `console-taxdocs-batch-${batchId}`, '[data-action=tx-deliver]');
  await L9.press(F, '[data-action=tx-deliver]');
  await F.fr.waitForTimeout(600);
  const r = await F.fr.evaluate(() => {
    const alerts = Array.from(document.querySelectorAll('.tx [role=alert]')).filter((x) => x.innerText.trim());
    const btn = document.querySelector('[data-action=tx-deliver]');
    const a = alerts[0];
    if (!a || !btn) return { alerts: alerts.map((x) => x.innerText.trim()), btn: !!btn };
    const ar = a.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(ar.left + Math.min(ar.width / 2, 40), ar.top + ar.height / 2);
    return {
      alerts: alerts.map((x) => x.innerText.trim()),
      alert: [Math.round(ar.top), Math.round(ar.bottom)],
      button: [Math.round(br.top), Math.round(br.bottom)],
      screen: innerHeight,
      onScreen: ar.top >= 0 && ar.bottom <= innerHeight,
      seen: !!hit && (hit === a || a.contains(hit)),
      gap: Math.round(Math.min(Math.abs(ar.top - br.bottom), Math.abs(br.top - ar.bottom)))
    };
  });
  await shot(F, `deliver-${size}`);
  check('Deliver before the contact is saved gives its one reason', r.alerts && r.alerts.length === 1 && /^Before delivering, save the Contact for tax documents/.test(r.alerts[0]), r);
  check('the reason is on screen where the button was pressed, not covered', !!r.onScreen && !!r.seen, r);
  check('the reason stands beside the Deliver button (within 48 px of it)', typeof r.gap === 'number' && r.gap <= 48, r);
  const fields = await F.fr.evaluate(() => {
    const rad = (id) => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).borderTopLeftRadius : 'missing';
    };
    return { phone: rad('tx-c-phone'), email: rad('tx-c-email'), name: rad('tx-c-name') };
  });
  check('Telephone is drawn as a rounded field like Name and Email', fields.phone !== 'missing' && fields.phone === fields.email && fields.phone === fields.name && parseFloat(fields.phone) > 0, fields);
  await L9.leak(check, F, 'the K-1 import page');
  await L9.quiet(check, F, 'the K-1 import page');
  await F.A.context.close();
}

/* ---------- e: no request for a file that is not shipped ---------- */
async function partsLoad({ check, S }) {
  const F = await L9.framed(S, 'phone');
  await L9.sample(F);
  // from here on every answer is watched: a reload of the framed page loads every script again
  const missing = [];
  F.A.context.on('response', (res) => res.status() === 404 && missing.push(new URL(res.url()).pathname));
  F.A.errors.length = 0;
  await F.reload();
  await F.fr.waitForTimeout(2500);
  check('a page load asks for no file that is not there (no 404)', missing.length === 0, missing);
  await L9.goto(F, 'console-taxdocs', '.tx');
  await F.fr.waitForTimeout(1500);
  check('opening Tax documents asks for no file that is not there (no 404)', missing.length === 0, missing);
  const parts = await F.fr.evaluate(() => (window.CVPortal.taxUI ? Array.from(window.CVPortal.taxUI.PARTS) : null));
  const absent = (parts || []).filter((f) => !fs.existsSync(path.join(Lib.ROOT, 'assets', 'js', f)));
  // Plans 10-10 and 10-12 add tax1099-ui.js and taxlink.js back with their files: a part is listed only when its file is shipped.
  check('every file in NS.taxUI.PARTS is in assets/js (tax1099-ui.js and taxlink.js are listed only once their files are there)', Array.isArray(parts) && parts.length > 0 && absent.length === 0, { parts, absent });
  const src = fs.readFileSync(path.join(Lib.ROOT, 'assets/js/taxdocs-ui.js'), 'utf8');
  check('the parts list names the plans that add the two files back (10-10, 10-12)', /10-10/.test(src) && /10-12/.test(src) && /tax1099-ui\.js/.test(src) && /taxlink\.js/.test(src), 'comment not found');
  await L9.leak(check, F, 'Tax documents');
  await L9.quiet(check, F, 'a page load and Tax documents');
  await F.A.context.close();
}

/* ---------- f: a heading on each Filings section ---------- */
const SECTIONS = [
  ['formd', 'Form D'],
  ['access', 'EDGAR access'],
  ['states', 'State filings']
];
async function headings(check, S, size) {
  const F = await L9.framed(S, size);
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const NAME = 'Harbor <b>Growth</b> Fund, L.P.';
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 5, state: 'TX' }] });
  const id = seeded.offeringId;
  await L9.goto(F, 'console-filings', '.fl');
  const tab = await F.fr.evaluate(() => {
    const h = document.querySelector('.fl-bar h1');
    const cs = h ? getComputedStyle(h) : null;
    return h ? { text: h.innerText.trim(), font: `${cs.fontFamily}|${cs.fontSize}|${cs.fontWeight}` } : null;
  });
  check('the Filings tab has its h1 in the bar (the pattern the sections follow)', !!tab && tab.text === 'Filings', tab);
  const guide = fs.readFileSync(path.join(Lib.ROOT, 'server/help/guide.md'), 'utf8');
  for (const [key, title] of SECTIONS) {
    await L9.goto(F, `console-filings-${key}-${id}`, `.fl-section[data-part="${key}"]`);
    const r = await F.fr.evaluate(() => {
      const bar = document.querySelector('.fl-section .fl-bar');
      const h = bar && bar.querySelector('h1');
      const cs = h ? getComputedStyle(h) : null;
      const hr = h ? h.getBoundingClientRect() : null;
      return {
        h1: h ? h.innerText.trim() : '',
        count: document.querySelectorAll('.fl-section h1').length,
        font: cs ? `${cs.fontFamily}|${cs.fontSize}|${cs.fontWeight}` : '',
        name: ((bar && bar.querySelector('.fl-bar-title')) || {}).innerText || '',
        bold: document.querySelectorAll('.fl-bar b').length,
        back: !!(bar && bar.querySelector('a.fl-back')),
        inside: !!hr && hr.left >= 0 && hr.right <= innerWidth + 0.5,
        overflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    });
    await shot(F, `headings-${size}-${key}`);
    check(`${title}: the section opens under the bar with Back and an h1 "${title}" in the tab's pattern (same font as "Filings")`, r.h1 === title && r.count === 1 && r.back && !!tab && r.font === tab.font, r);
    check(`${title}: the offering's name is still shown beside the heading, as text`, r.name.trim() === NAME && r.bold === 0, r);
    check(`${title}: the heading is inside the screen and the page is no wider than it`, r.inside && !r.overflow, r);
    check(`${title}: the heading is the name the help guide quotes ("${title}" under an offering)`, guide.indexOf(`"${title}" under an offering`) >= 0, title);
  }
  await L9.wayOut(check, F, 'a Filings section', { selector: '.fl-bar a.fl-back' });
  await L9.leak(check, F, 'the Filings sections');
  await L9.quiet(check, F, 'the Filings sections');
  await F.A.context.close();
}

Lib.runParts(
  {
    'targets-phone': targetsPhone,
    money,
    'signedin-phone': ({ check, S }) => signedIn(check, S, 'phone'),
    'signedin-desktop': ({ check, S }) => signedIn(check, S, 'desktop'),
    'deliver-phone': ({ check, S }) => deliver(check, S, 'phone'),
    'deliver-desktop': ({ check, S }) => deliver(check, S, 'desktop'),
    'parts-load': partsLoad,
    'headings-phone': ({ check, S }) => headings(check, S, 'phone'),
    'headings-desktop': ({ check, S }) => headings(check, S, 'desktop')
  },
  { name: 'WALK3 FIXES', unit: 'parts', flag: '--only', browser: true }
);
