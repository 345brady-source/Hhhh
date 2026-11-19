#!/usr/bin/env node
// Plan 07-01: a tool for the author of the help guide (server/help/guide.md), not a gate check. It opens the self-serve
// sample portal on the phase 06 check browser, goes to every page and every step a sponsor or an investor can open, and
// writes what each screen says to <P6_OUT>/help-screens/<key>.txt: headings, panel titles, field labels, hints, button
// texts and empty-state sentences, with each table body cut to its first two rows and long option lists cut short.
// The menu is written once per role (console-menu.txt, portal-menu.txt), not on every page.
//   console  as an admin: every page of the console menu (and what its first header button opens), one offering's page,
//            one envelope's page and the notifications dialog; then as a team member: which pages send them to Overview
//   portal   as an investor: every page of the investor menu, one investment's page, Settings, the subscribe page of a
//            raising offering, and sign-in
//   flow     an invitation walked from Welcome to Done, each step as it appears (invite-<step>.txt), the accreditation
//            step of an offering that verifies it, and the bank account update (onboarding-payment.txt)
//   pages    the sponsor's sign-up page and the offering sign-up link page
//   NODE_PATH=$(npm root -g) node help-screens.js [--only console,portal,flow,pages]
// The last line is "HELP SCREENS: PASS (parts run: N)" or "HELP SCREENS: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const OUT = path.join(Lib.OUT, 'help-screens');
fs.mkdirSync(OUT, { recursive: true });
const js = (f) => fs.readFileSync(path.join(Lib.ROOT, 'assets', 'js', f), 'utf8');
/** The routes of `const NAV = [ ['route', 'Label'], ... ]` in a source file, in menu order. */
const nav = (f) => [...(/const NAV = \[([\s\S]*?)\n\s*\];/.exec(js(f)) || ['', ''])[1].matchAll(/\['([a-z-]+)',\s*'([^']+)'\]/g)].map((m) => [m[1], m[2]]);
const OWNER_ONLY = [...(/const OWNER_ONLY = \[([^\]]*)\]/.exec(js('app.js')) || ['', ''])[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
const DESKTOP = { context: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, acceptDownloads: true } };

/** What the screen says now: the open dialog if there is one, else the page without its menu and the preview's role bar. */
function grab(page, sel) {
  return page.evaluate((sel) => {
    document.querySelectorAll('details:not([open])').forEach((d) => (d.open = true));
    const cut = [];
    document.querySelectorAll('select').forEach((s) => {
      [...s.options].slice(8).forEach((o) => {
        cut.push([s, o]);
        o.remove();
      });
    });
    const st = document.createElement('style');
    st.textContent = 'tbody tr:nth-child(n+3){display:none!important} .demo-bar,.cs-nav,.pt-nav,.pt-user,#toasts,#opbar{display:none!important}';
    document.head.appendChild(st);
    const dlg = document.querySelector('#dlg[open]');
    const el = sel ? document.querySelector(sel) : dlg || document.getElementById('view') || document.body;
    const text = el ? (el === dlg ? '[dialog]\n' : '') + el.innerText : '';
    st.remove();
    cut.forEach(([s, o]) => s.appendChild(o));
    return text
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }, sel || '');
}
const menu = (page, sel) => page.evaluate((s) => ((document.querySelector(s) || {}).innerText || '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n'), sel);

/** Keeps what a part wrote, then checks each file's length and that no page raised a script error. */
function writer(check) {
  const files = {};
  return {
    put(key, text) {
      files[key] = (files[key] ? files[key] + '\n' : '') + text;
      fs.writeFileSync(path.join(OUT, `${key}.txt`), files[key] + '\n');
    },
    finish(contexts) {
      const short = Object.keys(files).filter((k) => files[k].length <= 40);
      check(`wrote ${Object.keys(files).length} screen texts, each longer than 40 characters`, Object.keys(files).length > 0 && !short.length, short);
      const errors = contexts.reduce((a, A) => a.concat(A.errors), []);
      check('no page showed a script error', !errors.length, errors.slice(0, 5));
    }
  };
}
const goto = async (page, hash, ms) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(ms || 500);
};
const closeDialog = (page) => page.evaluate(() => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); });

const parts = {
  async console({ check, S }) {
    const A = await Lib.open(S, DESKTOP);
    const W = writer(check);
    const page = A.page;
    const portal = await Lib.setupPortal(S, A);
    // one invitation walked to the end, so the pages that list invitations, notifications and envelopes have a row
    const name = 'Dana Whitlow';
    const inv = await Lib.createInvitation(page, { name, email: 'dana.whitlow@example.com', type: 'individual', offeringId: portal.offeringId });
    await goto(page, 'invite-' + inv.token);
    const w = await Lib.walk(page, { name, acc: 'yes', basis: 0 });
    check('an invited investor reached the subscription agreement', w.reached, w.seen);
    if (w.reached) await Lib.finishAgreement(page);
    const routes = nav('console.js');
    check('the console menu has at least 15 pages', routes.length >= 15, routes.length);
    await Lib.consoleRoute(page, 'console', '.cs-head h1, .cs-panel-head h2');
    W.put('console-menu', `As an admin:\n${await menu(page, '.cs-nav nav')}`);
    for (const [key] of routes) {
      await Lib.consoleRoute(page, key, '.cs-head h1, .cs-panel-head h2');
      W.put(key, await grab(page));
      // what the first button of the page's header opens (a form or a dialog), when it is not a download
      const btn = page.locator('.cs-head .cs-actions button[data-action]').first();
      if (!(await btn.count())) continue;
      const label = (await btn.innerText()).trim();
      if (!label || /download|export|mark all/i.test(label)) continue;
      const before = await grab(page);
      await btn.click();
      await page.waitForTimeout(600);
      const after = await grab(page);
      if (after !== before) W.put(key, `--- after choosing "${label}" ---\n${after}`);
      await closeDialog(page);
    }
    await Lib.consoleRoute(page, `console-offering-${portal.offeringId}`, '.cs-panel-head h2');
    W.put('console-offering', await grab(page));
    const envId = await page.evaluate(() => ((window.CVPortal.state.ws.envelopes || [])[0] || {}).id || '');
    check('the sample portal has an envelope to open', !!envId);
    if (envId) {
      await Lib.consoleRoute(page, `console-envelope-${envId}`, '.cs-panel-head h2, .cs-head h1');
      W.put('console-envelope', await grab(page));
    }
    await Lib.consoleRoute(page, 'console', '.cs-head h1, .cs-panel-head h2');
    await page.click('[data-action=inv8-bell]');
    await page.waitForSelector('#dlg[open]');
    W.put('console-notifications-dialog', await grab(page));
    await closeDialog(page);
    // a team member: the same list, and which pages send them back to Overview
    await page.selectOption('#demo-role', 'team');
    await page.waitForTimeout(500);
    const lines = [`As a team member:\n${await menu(page, '.cs-nav nav')}`, '', 'Opening each page of the admin menu as a team member:'];
    const back = [];
    for (const [key, label] of routes) {
      await goto(page, key);
      const at = await page.evaluate(() => window.CVPortal.state.route);
      if (at !== key) back.push(key);
      lines.push(`${label} (${key}): ${at === key ? 'opens' : `sent to ${at}`}`);
    }
    W.put('console-team-member', lines.join('\n'));
    check('a team member is sent back from exactly the pages only an admin opens', back.slice().sort().join() === OWNER_ONLY.slice().sort().join(), { back, OWNER_ONLY });
    W.finish([A]);
    await A.context.close();
  },

  async portal({ check, S }) {
    const A = await Lib.open(S, DESKTOP);
    const W = writer(check);
    const page = A.page;
    const portal = await Lib.setupPortal(S, A);
    const who = await page.evaluate(() => {
      const NS = window.CVPortal;
      const inv = NS.state.ws.investors.find((i) => i.onboarding.status === 'complete' && i.positions.length);
      if (inv) NS.state.viewer = inv.id;
      return inv ? { id: inv.id, offeringId: inv.positions[0].offeringId } : null;
    });
    check('the sample portal has an activated investor with an investment', !!who);
    await page.selectOption('#demo-role', 'investor');
    await page.waitForFunction(() => location.hash === '#overview');
    await page.waitForTimeout(400);
    W.put('portal-menu', await menu(page, '.pt-nav'));
    const routes = nav('portal.js').map((r) => r[0]);
    check('the investor menu has at least 5 pages', routes.length >= 5, routes.length);
    for (const key of routes) {
      await goto(page, key);
      W.put(key, await grab(page));
    }
    await goto(page, `investment-${who.offeringId}`);
    W.put('investment', await grab(page));
    await goto(page, 'preferences');
    W.put('preferences', await grab(page));
    await goto(page, `subscribe-${portal.offeringId}`);
    W.put('subscribe', await grab(page));
    await goto(page, 'sign-in');
    W.put('sign-in', await grab(page));
    W.finish([A]);
    await A.context.close();
  },

  async flow({ check, S }) {
    const KEY = [
      [/^Welcome/, 'welcome'],
      [/Create your login/, 'login'],
      [/Investor information/, 'profile'],
      [/Identity verification/, 'identity'],
      [/^Investor status$/, 'status'],
      [/Accredit/, 'accreditation'],
      [/Tax certification/, 'tax'],
      [/Distribution payments/, 'payment'],
      [/^Subscription$/, 'subscribe'],
      [/Subscription agreement/, 'agreement']
    ];
    const keyOf = (hd) => (KEY.find(([re]) => re.test(hd)) || [null, 'unknown'])[1];
    const A = await Lib.open(S, DESKTOP);
    const W = writer(check);
    const page = A.page;
    const portal = await Lib.setupPortal(S, A);
    const name = 'Morgan Ellery';
    const inv = await Lib.createInvitation(page, { name, email: 'morgan.ellery@example.com', type: 'individual', offeringId: portal.offeringId });
    await goto(page, 'invite-' + inv.token);
    const w = await Lib.walk(page, {
      name,
      acc: 'yes',
      basis: 0,
      onStep: async (hd) => W.put(`invite-${keyOf(hd)}`, await grab(page)),
      // the tax step has two views: the answers, then the filled form to sign
      taxStep: async (p) => {
        await Lib.submit(p);
        await p.waitForSelector('.ivf-tax-sign .es-finish', { timeout: 60000 });
        W.put('invite-tax', `--- after choosing the step's button: the form ---\n${await grab(p)}`);
        await Lib.finishTaxForm(p);
      }
    });
    check('the invitation was walked to the subscription agreement', w.reached, w.seen);
    if (w.reached) {
      await Lib.finishAgreement(page);
      W.put('invite-done', await grab(page));
      // the bank account update, from the investor's Account page
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const b = document.querySelector('.ivf-done a[href="#overview"], .ivf-done [data-action]');
        if (b) b.click();
      });
      await page.waitForTimeout(600);
      await goto(page, 'account');
      const upd = page.locator('[data-action=update-bank]');
      check('the Account page offers the bank account update', (await upd.count()) > 0, await grab(page));
      if (await upd.count()) {
        await upd.first().click();
        await page.waitForTimeout(600);
        W.put('onboarding-payment', await grab(page));
      }
    }
    // the accreditation step, on an offering that verifies accredited investors
    const B = await Lib.open(S, DESKTOP);
    const p2 = await Lib.setupPortal(S, B, { exemption: 'Rule 506(c)' });
    const inv2 = await Lib.createInvitation(B.page, { name: 'Rowan Castell', email: 'rowan.castell@example.com', type: 'individual', offeringId: p2.offeringId });
    await goto(B.page, 'invite-' + inv2.token);
    const w2 = await Lib.walk(B.page, { name: 'Rowan Castell', until: /Accredit/ });
    check('the second invitation reached the accreditation step', w2.reached, w2.seen);
    if (w2.reached) W.put('invite-accreditation', await grab(B.page));
    W.finish([A, B]);
    await A.context.close();
    await B.context.close();
  },

  async pages({ check, S }) {
    const A = await Lib.open(S, DESKTOP);
    const W = writer(check);
    const page = A.page;
    await page.goto(S.base);
    await page.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
    await page.goto(S.base);
    await page.waitForSelector('[data-action=diy-sample]');
    check('a first visit opens the sign-up page', (await page.evaluate(() => window.CVPortal.state.route)) === 'diy-start');
    W.put('diy-start', await grab(page));
    const portal = await Lib.setupPortal(S, A);
    await page.goto(`${S.base}?tenant=kestrel-bay#join-${portal.offeringId}`);
    await page.waitForTimeout(800);
    check('the offering sign-up link opens its page', (await page.evaluate(() => window.CVPortal.state.route)) === 'join');
    W.put('join', await grab(page));
    W.finish([A]);
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'HELP SCREENS', browser: true });
