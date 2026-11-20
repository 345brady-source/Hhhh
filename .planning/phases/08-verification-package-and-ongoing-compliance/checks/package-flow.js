#!/usr/bin/env node
// GATE CHECK: PACKAGE FLOW
// Plan 08-07 (D-01, D-03, C-01): the verification package from the investor's side, end to end against stand-ins. The
// sponsor's console is the sample self-serve portal on a sponsor account of the real integration server (server/index.mjs
// in this process, doubles/world.js startServer); the payment provider and the identity check provider are the world's
// injected fetch answering the recorded fixtures (doubles/world.js world); the accreditation provider is doubles/
// accredit.mjs. No provider is called, no key exists, and any call that would leave this machine is refused and kept.
//   identity  1280x800: the console ticks the box for a new investor to a Rule 506(b) offering; the card is charged
//             ($19) before the invitation email exists; the investor's own browser opens the link; the identity step
//             reads "A secure page opens in a new tab for this step." (no "Handled by"); "Verify my identity" starts one
//             session and its page opens in a new tab outside the portal's and the server's origins; the signed status
//             delivery arrives; the step reads "Verified" without a reload; the investor finishes; the invitation's
//             names are screened through the package, one call per name, after the session; the console imports; its
//             AML/KYC row shows the identity verified and no matches; the investor's browser never called a payment address
// Every part ends with the leak scan of the investor's screens it saw (phase 6's leak check and frame.js's vendor scan).
//   NODE_PATH=$(npm root -g) node package-flow.js [--only identity]
// The last line is "PACKAGE FLOW: PASS (parts run: N)" or "PACKAGE FLOW: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const F = require('./frame.js');
const W = require('./doubles/world.js');
const Lib = F.Lib;

// The integration server runs in this process: a call it makes to anywhere outside this machine, other than through the
// world's fetch, is refused here and kept, so every part can prove none was made.
const outside = [];
const ownFetch = globalThis.fetch;
W.world.localFetch = ownFetch;
globalThis.fetch = (input, init) => {
  const u = new URL(String(input && input.url ? input.url : input));
  if (['127.0.0.1', 'localhost', '[::1]'].indexOf(u.hostname) < 0) {
    outside.push(`${(init && init.method) || 'GET'} ${u.origin}${u.pathname}`);
    return Promise.reject(new Error('refused by the check: no call leaves this machine'));
  }
  return ownFetch(input, init);
};

fs.mkdirSync(Lib.OUT, { recursive: true });
const SHOTS = path.join(Lib.OUT, 'package-flow-shots');
fs.mkdirSync(SHOTS, { recursive: true });
Lib.describeShots([
  ['identity-step-desktop.png', 'The investor\'s identity step through the package at 1280x800: "A secure page opens in a new tab for this step."'],
  ['identity-verified-desktop.png', 'The same step after the signed result arrived: Verified, without a reload.'],
  ['identity-kyc-row.png', 'The console\'s AML/KYC page after the import: the investor\'s identity verified and no matches.']
]);

const SECURE = 'A secure page opens in a new tab for this step.';
const WHO = { first: 'Odalys', last: 'Vantongeren', email: 'odalys.vantongeren@example.net' };

/** The console on a sponsor account of the real server, wired to a fresh world. */
async function boot(S, check) {
  const w = W.world();
  const srv = await W.startServer(S, w, { dir: Lib.OUT });
  const A = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
  const C = { S, w, srv, A, cp: A.page, marks: [], closers: [() => A.context.close()] };
  C.close = async () => {
    for (const c of C.closers.reverse()) await c().catch(() => {});
    await srv.close().catch(() => {});
  };
  try {
    C.off = await Lib.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    check('the console uses the integration server with the sponsor account\'s token', (await srv.configure(A.page)) === true);
    // At every outside call, how many emails the server holds (the order: charge, then the invitation email, then the session).
    w.onCall = (e) => C.marks.push({ kind: e.kind, n: e.n, outbox: srv.server.store.list('outbox').length });
  } catch (e) {
    await C.close();
    throw e;
  }
  return C;
}

/** The console invites `who` to the raising offering with the package box ticked; resolves to the invitation. */
async function sendPackage(C, check, who) {
  const p = C.cp;
  await Lib.consoleRoute(p, 'console-investors', '[data-action=invite-toggle]');
  if ((await p.locator('#iv-email').count()) === 0) await p.click('[data-action=invite-toggle]');
  await p.waitForSelector('#iv-email', { timeout: 10000 });
  await p.fill('#iv-contact', who.first);
  await p.fill('#iv-last', who.last);
  await p.fill('#iv-email', who.email);
  if (!(await p.locator('#iv-more[open]').count())) await p.click('#iv-more summary');
  await p.selectOption('#iv-off', C.off.offeringId);
  await p.waitForFunction(() => {
    const i = document.getElementById('iv-package');
    return !!i && !i.disabled && !!i.offsetWidth;
  }, null, { timeout: 15000 });
  const label = (await p.locator('#iv-package-label').innerText()).trim();
  await p.check('#iv-package');
  await p.click('.inv8-form[data-form="invite-one"] button[type=submit]');
  await p.waitForFunction((email) => {
    const ws = window.CVPortal.state.ws;
    const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
    const it = inv && (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
    return !!(it && (it.serverId || it.emailStatus === 'failed' || it.emailStatus === 'manual'));
  }, who.email, { timeout: 30000 });
  await p.waitForTimeout(300);
  const it = await p.evaluate((email) => {
    const ws = window.CVPortal.state.ws;
    const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
    const x = (ws.invitations || []).filter((y) => y.investorId === inv.id).pop();
    return { id: x.id, serverId: x.serverId || '', link: x.link || '', emailStatus: x.emailStatus, emailError: x.emailError || '', investorId: inv.id, title: inv.title, support: { team: ws.tenant.support.team, email: ws.tenant.support.email } };
  }, who.email);
  it.label = label;
  // The dialog the console may open after sending is closed, so the console is ready for the next action.
  if (await p.evaluate(() => !!(document.getElementById('dlg') || {}).open)) await p.click('#dlg [data-action=close-dialog]').catch(() => {});
  check('the invitation went to the server with the package box ticked', /^ivt_/.test(it.serverId) && !!it.link, it);
  return it;
}

/** The investor's own browser (view: 'desktop' | 'phone') on the link, walked to the identity step. */
async function investor(C, it, who, view) {
  const B = await Lib.open(C.S, { allow: [C.srv.base], init: C.srv.init, context: Object.assign({}, F.VIEW[view || 'desktop']) });
  C.closers.push(() => B.context.close());
  const ip = B.page;
  B.replies = [];
  B.navs = 0;
  ip.on('response', async (res) => {
    if (res.request().method() !== 'GET' || !/\/v1\/invite$/.test(res.url().replace(/[?#].*$/, ''))) return;
    B.replies.push(await res.text().catch(() => ''));
  });
  ip.on('framenavigated', (f) => {
    if (f === ip.mainFrame()) B.navs++;
  });
  B.screens = [];
  B.keep = async () => B.screens.push(await Lib.screenText(ip));
  await ip.goto(it.link);
  const wk = await Lib.walk(ip, { name: `${who.first} ${who.last}`, until: /Identity verification/ });
  return { B, ip, wk };
}

/** The identity step as the investor sees it. */
const idPanel = (ip) =>
  ip.evaluate(() => {
    const p = document.getElementById('iv-identity');
    const vis = (el) => !!el && !!(el.offsetWidth || el.offsetHeight);
    const btn = p && p.querySelector('[data-action=iv-start]');
    const again = p ? Array.from(p.querySelectorAll('a')).find((a) => /Open it again/.test(a.textContent)) : null;
    const err = p ? Array.from(p.querySelectorAll('.iv-refused')).filter(vis).map((e) => e.innerText.trim()) : [];
    return { text: p ? p.innerText : '', chip: p ? ((p.querySelector('.iv-chip') || {}).textContent || '').trim() : '', button: btn ? btn.textContent.trim() : '', again: again ? again.getAttribute('href') : '', refusal: err };
  });

/**
 * "Verify my identity" (or "Start again") pressed (tapped on a phone). Resolves to { address: where the new tab went ('' when
 * it was closed), tab }. The tab is closed by the check once its address is known (the browser refuses the provider's page).
 */
async function startCheck(B, ip, tap) {
  const before = B.net.external.length;
  const popup = B.context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  if (tap) await ip.tap('#iv-identity [data-action=iv-start]');
  else await ip.click('#iv-identity [data-action=iv-start]');
  const tab = await popup;
  for (let i = 0; i < 75; i++) {
    if (B.net.external.length > before || !tab || tab.isClosed()) break;
    await ip.waitForTimeout(200);
  }
  await ip.waitForTimeout(400);
  const address = B.net.external.slice(before).find((u) => /^https:\/\//.test(u)) || '';
  if (tab && !tab.isClosed()) await tab.close().catch(() => {});
  return { address, opened: !!tab };
}

/** The step's chip reads Verified (the page's own polling; no reload), or the time is up. */
const waitVerified = (ip) =>
  ip
    .waitForFunction(() => /Verified/.test(((document.querySelector('#iv-identity .iv-chip') || {}).textContent || '')), null, { timeout: 45000 })
    .then(() => true)
    .catch(() => false);

/** Until the server holds the investor's completed submission (account token); resolves to its row or null. */
async function completed(C, serverId) {
  for (let i = 0; i < 100; i++) {
    const r = await C.srv.call('GET', '/v1/invitations?workspace=kestrel-bay', undefined, C.srv.token);
    const rows = Array.isArray(r.body) ? r.body : (r.body && r.body.invitations) || [];
    const row = rows.find((x) => x.id === serverId);
    if (row && row.status === 'completed' && row.hasSubmission) return row;
    await new Promise((res) => setTimeout(res, 300));
  }
  return null;
}

/** The emails the server holds for an invitation, read with the account's token as the console reads them. */
async function emails(C, serverId) {
  const r = await C.srv.call('GET', `/v1/outbox?invitation=${encodeURIComponent(serverId)}`, undefined, C.srv.token);
  return (r.body && r.body.messages) || [];
}

/** The names the invitation holds, as the server gave them to the investor (GET /v1/invite: the investor and the account). */
function invitationNames(B) {
  const snap = B.replies.map((t) => {
    try {
      return JSON.parse(t);
    } catch (e) {
      return null;
    }
  }).find((x) => x && x.investor);
  const inv = (snap && snap.investor) || {};
  return Array.from(new Set([inv.contact, inv.title].map((n) => String(n || '').trim()).filter(Boolean))).sort();
}

/** The console's AML/KYC row for an investor (All investors), cell by cell. */
async function kycRow(p, title) {
  await Lib.consoleRoute(p, 'console-kyc', '[data-action=kyc-tab]');
  await p.click('[data-action=kyc-tab][data-t=all]');
  await p.waitForTimeout(300);
  return p.evaluate((title) => {
    const tr = Array.from(document.querySelectorAll('table.cs-tbl tbody tr')).find((r) => {
      const td = r.querySelector('td[data-label=Investor]');
      return td && td.innerText.indexOf(title) === 0;
    });
    if (!tr) return null;
    const cell = (l) => ((tr.querySelector(`td[data-label="${l}"]`) || {}).innerText || '').replace(/\s+/g, ' ').trim();
    return { identity: cell('Identity verified'), screening: cell('Screening'), status: cell('Status'), text: tr.innerText.replace(/\s+/g, ' ').trim() };
  }, title);
}

/** What every part asserts about the outside world: nothing left this machine, and the world was asked for nothing unknown. */
function worldClean(check, C) {
  check('no call left this machine outside the stand-in world (the outside-call record is empty)', outside.length === 0, outside);
  check('the stand-in world was asked for nothing but the package providers\' own calls', C.w.count('other') === 0, C.w.calls.filter((c) => c.kind === 'other'));
}
/** The investor's browser never asked for a payment address (the provider's or the server's billing routes). */
function noPayment(check, B) {
  const all = B.net.allowed.concat(B.net.external);
  const pay = all.filter((x) => /payment_intents|\/v1\/billing|\/billing\//.test(x));
  check('the investor\'s browser made no call to a payment address', pay.length === 0, pay);
}

const PARTS = {
  async identity({ check, S }) {
    const C = await boot(S, check);
    try {
      const it = await sendPackage(C, check, WHO);
      check('the box carries the server\'s identity price for a Rule 506(b) offering', it.label === 'Add verification package ($19)', it.label);
      const pays = C.srv.server.store.list('payments');
      const charges = C.marks.filter((m) => m.kind === 'charge');
      check('the sponsor\'s card is charged once, $19 (1900 cents), and the payment succeeded', C.w.count('charge') === 1 && pays.length === 1 && pays[0].cardCents === 1900 && pays[0].status === 'succeeded', { charges: C.w.count('charge'), pays: pays.map((x) => ({ cents: x.cardCents, status: x.status })) });
      const mail = await emails(C, it.serverId);
      check('the charge came before the invitation email existed, and the server then emailed the investor once', charges.length === 1 && charges[0].outbox === 0 && mail.length === 1 && String(mail[0].to || '').toLowerCase() === WHO.email, { atCharge: charges.map((m) => m.outbox), mail: mail.map((m) => ({ to: m.to, subject: m.subject })) });

      const { B, ip, wk } = await investor(C, it, WHO, 'desktop');
      check('the investor\'s own browser opens the link and reaches the identity step with no field error', wk.reached && /Identity verification/.test(wk.at || '') && wk.errors.length === 0, wk);
      let pn = await idPanel(ip);
      await B.keep();
      await ip.screenshot({ path: path.join(SHOTS, 'identity-step-desktop.png') });
      check(`the identity step reads "${SECURE}"`, pn.text.indexOf(SECURE) >= 0, pn.text);
      check('the identity step names no one: no "Handled by"', pn.text.indexOf('Handled by') < 0, pn.text);
      check('the step offers "Verify my identity"', pn.button === 'Verify my identity', pn.button);
      const navs = B.navs;
      const st = await startCheck(B, ip, false);
      const origins = [new URL(S.origin).origin, new URL(C.srv.base).origin];
      check('"Verify my identity" asks the world for one session', C.w.count('session') === 1, C.w.calls.map((c) => c.kind));
      check('the session\'s page opens in a new tab whose address is outside the portal\'s and the server\'s origins', st.opened && /^https:\/\//.test(st.address) && origins.indexOf(new URL(st.address).origin) < 0, { opened: st.opened, outsideOrigins: st.address ? origins.indexOf(new URL(st.address).origin) < 0 : false });
      const sessMark = C.marks.find((m) => m.kind === 'session');
      check('the invitation email existed before the session started', !!sessMark && sessMark.outbox >= 1, sessMark);
      pn = await idPanel(ip);
      await B.keep();
      check('while the check runs the step offers "Open it again"', /^https:\/\//.test(pn.again), pn);
      const code = await C.w.deliver(C.srv.base, C.w.sessions[0], 'Approved');
      check('the signed status delivery is accepted by the server', code === 200, code);
      const ok = await waitVerified(ip);
      pn = await idPanel(ip);
      await B.keep();
      await ip.screenshot({ path: path.join(SHOTS, 'identity-verified-desktop.png') });
      check('the step shows "Verified" without a reload', ok && /Verified/.test(pn.chip) && B.navs === navs, { chip: pn.chip, navs: B.navs, before: navs });

      // The investor finishes onboarding.
      await Lib.submit(ip);
      const rest = await Lib.walk(ip, { name: `${WHO.first} ${WHO.last}` });
      check('the investor walks on to the agreement with no field error', rest.reached && rest.errors.length === 0, rest);
      await B.keep();
      const done = await Lib.finishAgreement(ip).catch((e) => `NOT FINISHED: ${e.message}`);
      await B.keep();
      check('the investor finishes onboarding', !/^NOT FINISHED/.test(done), done);
      const row = await completed(C, it.serverId);
      check('the server holds the completed submission', !!row, row);

      const names = invitationNames(B);
      const kinds = C.w.calls.map((c) => c.kind);
      const iSession = kinds.indexOf('session');
      const iDelivery = kinds.indexOf('delivery');
      const scr = C.w.calls.filter((c) => c.kind === 'screening');
      const screened = scr.map((c) => (c.names || [])[0]).sort();
      check('the invitation\'s names are screened through the package: one screening call per name', names.length >= 1 && scr.length === names.length && JSON.stringify(screened) === JSON.stringify(names), { names: names.length, calls: scr.length, same: JSON.stringify(screened) === JSON.stringify(names) });
      check('the order in the world\'s record: charge, then session, then delivery, then every screening', kinds.indexOf('charge') >= 0 && kinds.indexOf('charge') < iSession && iSession < iDelivery && scr.every((c) => kinds.indexOf('delivery') < C.w.calls.indexOf(c)), kinds);

      await Lib.importFromConsole(C.cp, it.id);
      const kr = await kycRow(C.cp, it.title);
      await C.A.page.screenshot({ path: path.join(SHOTS, 'identity-kyc-row.png') });
      check('the console\'s AML/KYC row shows the identity verified and screening clear (no matches)', !!kr && !/Not submitted/.test(kr.identity) && /\d/.test(kr.identity) && /^No matches/.test(kr.screening), kr);
      const dev = await C.cp.evaluate((id) => {
        const NS = window.CVPortal;
        const inv = NS.state.ws.investors.find((x) => x.id === id);
        const v = NS.integrations.peek(inv);
        return { identity: v.identity.status, aml: v.aml.status, refs: (v.aml.results || []).map((r) => /^scr_/.test(r.ref || '')), decision: v.decision.status };
      }, it.investorId);
      check('the imported record: identity passed and screening clear on the server\'s own screening records', dev.identity === 'passed' && dev.aml === 'clear' && dev.refs.length >= 1 && dev.refs.every(Boolean), dev);

      noPayment(check, B);
      worldClean(check, C);
      check('no script error in the console or on the investor\'s device', C.A.errors.length === 0 && B.errors.length === 0, { console: C.A.errors, investor: B.errors });
      F.leakFree(check, 'every investor screen of this part', B.screens.join('\n'));
    } finally {
      await C.close();
    }
  }
};

Lib.runParts(PARTS, { name: 'PACKAGE FLOW', unit: 'parts', flag: '--only', browser: true });
