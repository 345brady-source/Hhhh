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
//   refused   the provider refuses the session start (402): the step shows exactly "This check could not start. Please
//             try again later." with no status number, "answered", "integration server", "Provider" or vendor word, and
//             keeps it (not only a toast) until the next start; "Verify my identity" again works (a new session, then
//             Verified); the package still reads paid (no credit, no second charge). A returned package (its payment
//             refunded): a start shows "This check is not part of this invitation" and the firm's contact, the world
//             records no session; reloading the page clears the line
//   start-limit three accepted identity starts; the fourth shows "This check was already started." and the firm's
//             contact as the investor's page holds it; the world holds exactly three sessions; nothing on screen holds 409
//   phone     the identity step through the package at 390x844 with touch: no sideways scroll, the button is tapped,
//             the refusal line fits the width, "Open it again" is offered while the check runs, Back is on screen and
//             leaves the step
//   preview-desktop, preview-phone  the owner's preview (framed, every connection refused, no server) at 1280x800 and at
//             390x844 with touch: the frame refuses a fetch; the console's AML/KYC page and an invited investor's identity
//             step (the firm's own sandbox connection) render their existing text, no package sentence, nothing attempted,
//             no raw error
//   leak      the flows identity, refused, start-limit and phone again, everything kept: no investor screen, investor
//             email or GET /v1/invite reply holds $19, $99, 1900, 9900, tier or entitlement; those plus the console's
//             screens and GET /v1/connectors and GET /v1/invitations (account token) pass the leak check and the vendor
//             scan; the new tabs' own addresses are the one place outside the portal and the server; the typed taxpayer
//             number is in no world record, no server output and no file this part writes; each scan proved first on a
//             planted copy; the counts scanned are printed
// Every part ends with the leak scan of the investor's screens it saw (phase 6's leak check and frame.js's vendor scan).
//   NODE_PATH=$(npm root -g) node package-flow.js [--only identity,refused,start-limit,phone,preview-desktop,preview-phone,leak]
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
  ['identity-kyc-row.png', 'The console\'s AML/KYC page after the import: the investor\'s identity verified and no matches.'],
  ['identity-step-phone.png', 'The identity step through the package at 390x844 with touch.'],
  ['identity-refusal-phone.png', 'The same step at 390x844 after the provider refused the start: "This check could not start. Please try again later."'],
  ['preview-desktop-kyc.png', 'The owner\'s preview (no server, every connection refused) at 1280x800: the console\'s AML/KYC page as before.'],
  ['preview-desktop-identity.png', 'The owner\'s preview at 1280x800: an invited investor\'s identity step with the firm\'s own sandbox connection, as before.'],
  ['preview-phone-kyc.png', 'The owner\'s preview at 390x844 with touch: the console\'s AML/KYC page as before.'],
  ['preview-phone-identity.png', 'The owner\'s preview at 390x844 with touch: an invited investor\'s identity step as before.']
]);

const SECURE = 'A secure page opens in a new tab for this step.';
const COULD_NOT_START = 'This check could not start. Please try again later.';
const NOT_PART = 'This check is not part of this invitation';
const LIMIT = 'This check was already started.';
// What a refusal on the investor's screen never holds.
const NEVER = ['502', '403', '409', 'answered', 'integration server', 'Provider'];
const WHO = { first: 'Odalys', last: 'Vantongeren', email: 'odalys.vantongeren@example.net' };
const WHO2 = { first: 'Teodor', last: 'Halvorsen', email: 'teodor.halvorsen@example.net' };
const WHO3 = { first: 'Marisol', last: 'Achterberg', email: 'marisol.achterberg@example.net' };
const WHO4 = { first: 'Ingrid', last: 'Nakashima', email: 'ingrid.nakashima@example.net' };
const WHO5 = { first: 'Benedikt', last: 'Oyelaran', email: 'benedikt.oyelaran@example.net' };

/** The console on a sponsor account of the real server, wired to a fresh world. */
async function boot(S, check) {
  const w = W.world();
  const srv = await W.startServer(S, w, { dir: Lib.OUT });
  const A = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
  const C = { S, w, srv, A, cp: A.page, marks: [], investors: [], invited: [], closers: [() => A.context.close()] };
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
  B.addresses = [];
  C.investors.push(B);
  C.invited.push(who.email.toLowerCase());
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
  B.addresses.push(address);
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

/** The firm's contact as the investor's page holds it (the workspace the invitation gave it), never a typed value. */
const firmContact = (ip) => ip.evaluate(() => Object.assign({}, window.CVPortal.state.ws.tenant.support));
/** The sentence and the firm's contact, as the step shows them for a refusal the investor cannot retry. */
const withContact = (sentence, c) => `${sentence}${/[.!?]$/.test(sentence) ? '' : '.'} Contact ${c.team} at ${c.email}.`;
/** A screen's text holds none of NEVER and no vendor. */
function plain(check, label, text) {
  const hits = NEVER.filter((x) => text.indexOf(x) >= 0);
  check(`${label}: no status number, "answered", "integration server" or "Provider" on screen`, hits.length === 0, hits);
  const v = F.vendorScan(text);
  check(`${label}: no vendor on screen`, v.ok, v.hits);
}
/** The server's word on an invitation's package (account token): { tier, status } or null. */
async function packageWord(C, serverId) {
  const r = await C.srv.call('GET', '/v1/invitations?workspace=kestrel-bay', undefined, C.srv.token);
  const rows = Array.isArray(r.body) ? r.body : (r.body && r.body.invitations) || [];
  const row = rows.find((x) => x.id === serverId);
  return row ? row.package || null : null;
}

const FLOWS = {
  async identity(check, S, sink) {
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
      await collect(C, sink);
      await C.close();
    }
  },
  async refused(check, S, sink) {
    const C = await boot(S, check);
    try {
      const it = await sendPackage(C, check, WHO2);
      const { B, ip, wk } = await investor(C, it, WHO2, 'desktop');
      check('the investor reaches the identity step', wk.reached && /Identity verification/.test(wk.at || ''), wk);
      C.w.refuseNextSession(402);
      const st = await startCheck(B, ip, false);
      let pn = await idPanel(ip);
      let text = await Lib.screenText(ip);
      B.screens.push(text);
      check('the provider was asked once and refused (402)', C.w.count('session') === 1 && C.w.sessions.length === 0, C.w.calls.map((c) => c.kind));
      check(`the step shows exactly "${COULD_NOT_START}"`, pn.refusal.length === 1 && pn.refusal[0] === COULD_NOT_START, pn.refusal);
      check('the tab that opened for the check is closed again (no page to show)', st.opened && st.address === '', st);
      plain(check, 'the refused start', text);
      await ip.waitForTimeout(4600);
      pn = await idPanel(ip);
      check('the line stays on the step once the toast has gone (not only a toast)', pn.refusal.length === 1 && pn.refusal[0] === COULD_NOT_START && (await ip.locator('#toasts .toast').count()) === 0, pn.refusal);
      // Retrying works: a new session, then Verified.
      const st2 = await startCheck(B, ip, false);
      pn = await idPanel(ip);
      B.screens.push(await Lib.screenText(ip));
      check('"Verify my identity" again starts a new session, its page in a new tab', C.w.sessions.length === 1 && /^https:\/\//.test(st2.address), { sessions: C.w.sessions.length });
      check('the next start clears the refusal line', pn.refusal.length === 0, pn.refusal);
      const code = await C.w.deliver(C.srv.base, C.w.sessions[0], 'Approved');
      const ok = await waitVerified(ip);
      B.screens.push(await Lib.screenText(ip));
      check('the signed result arrives and the step shows "Verified"', code === 200 && ok, { code, ok });
      const word = await packageWord(C, it.serverId);
      const bill = await C.srv.call('GET', '/v1/billing', undefined, C.srv.token);
      check('the package still reads paid: no credit, no second charge', !!word && ['paid', 'started'].indexOf(word.status) >= 0 && C.w.count('charge') === 1 && !!bill.body && bill.body.creditCents === 0, { word, charges: C.w.count('charge'), credit: bill.body && bill.body.creditCents });

      // A returned package: its payment refunded (as 08-14's delivery leaves the entitlement).
      const it3 = await sendPackage(C, check, WHO3);
      const rec = C.srv.server.store.get('invitations', it3.serverId);
      const ent = rec && rec.package ? rec.package.entitlement : '';
      if (ent) C.srv.server.store.put('entitlements', { id: ent, status: 'refunded' });
      check('the second invitation\'s package is set to refunded on the server', !!ent && ((await packageWord(C, it3.serverId)) || {}).status === 'refunded');
      const sessionsBefore = C.w.count('session');
      const R = await investor(C, it3, WHO3, 'desktop');
      check('the second investor reaches the identity step', R.wk.reached && /Identity verification/.test(R.wk.at || ''), R.wk);
      const contact = await firmContact(R.ip);
      await startCheck(R.B, R.ip, false);
      pn = await idPanel(R.ip);
      text = await Lib.screenText(R.ip);
      R.B.screens.push(text);
      check(`a start shows "${NOT_PART}" followed by the firm's contact as its settings hold it`, !!contact.team && !!contact.email && pn.refusal.length === 1 && pn.refusal[0] === withContact(NOT_PART, contact), { refusal: pn.refusal, contact });
      check('the world records no session for the returned package', C.w.count('session') === sessionsBefore, C.w.calls.map((c) => c.kind));
      plain(check, 'the returned package', text);
      await R.ip.reload();
      await R.ip.waitForSelector('.ivf-form h1', { timeout: 30000 });
      await R.ip.waitForTimeout(500);
      pn = await idPanel(R.ip);
      R.B.screens.push(await Lib.screenText(R.ip));
      check('reloading the page clears the line', pn.refusal.length === 0, pn);
      noPayment(check, B);
      noPayment(check, R.B);
      worldClean(check, C);
      check('no script error on either investor\'s device', B.errors.length === 0 && R.B.errors.length === 0, { a: B.errors, b: R.B.errors });
      F.leakFree(check, 'every investor screen of this part', B.screens.concat(R.B.screens).join('\n'));
    } finally {
      await collect(C, sink);
      await C.close();
    }
  },
  async 'start-limit'(check, S, sink) {
    const C = await boot(S, check);
    try {
      const it = await sendPackage(C, check, WHO4);
      const { B, ip, wk } = await investor(C, it, WHO4, 'desktop');
      check('the investor reaches the identity step', wk.reached && /Identity verification/.test(wk.at || ''), wk);
      const contact = await firmContact(ip);
      for (let k = 1; k <= 3; k++) {
        const st = await startCheck(B, ip, false);
        const pn = await idPanel(ip);
        B.screens.push(await Lib.screenText(ip));
        check(`start ${k} is accepted: session ${k}, its page in a new tab, then "Start again"`, C.w.sessions.length === k && /^https:\/\//.test(st.address) && pn.refusal.length === 0 && pn.button === 'Start again', { sessions: C.w.sessions.length, button: pn.button, refusal: pn.refusal });
      }
      await startCheck(B, ip, false);
      const pn = await idPanel(ip);
      const text = await Lib.screenText(ip);
      B.screens.push(text);
      check(`the fourth start shows "${LIMIT}" followed by the firm's contact as the page holds it`, !!contact.team && !!contact.email && pn.refusal.length === 1 && pn.refusal[0] === withContact(LIMIT, contact), { refusal: pn.refusal, contact });
      check('the world holds exactly three sessions', C.w.count('session') === 3 && C.w.sessions.length === 3, C.w.calls.map((c) => c.kind));
      check('nothing on screen holds "409"', text.indexOf('409') < 0);
      plain(check, 'the fourth start', text);
      noPayment(check, B);
      worldClean(check, C);
      check('no script error on the investor\'s device', B.errors.length === 0, B.errors);
      F.leakFree(check, 'every investor screen of this part', B.screens.join('\n'));
    } finally {
      await collect(C, sink);
      await C.close();
    }
  },
  async phone(check, S, sink) {
    const C = await boot(S, check);
    try {
      const it = await sendPackage(C, check, WHO5);
      const { B, ip, wk } = await investor(C, it, WHO5, 'phone');
      const size = ip.viewportSize();
      check('the investor\'s window is 390x844 with touch', size.width === 390 && size.height === 844 && (await ip.evaluate(() => navigator.maxTouchPoints > 0)), size);
      check('the investor reaches the identity step', wk.reached && /Identity verification/.test(wk.at || ''), wk);
      let pn = await idPanel(ip);
      B.screens.push(await Lib.screenText(ip));
      await ip.locator('#iv-identity').scrollIntoViewIfNeeded();
      await ip.screenshot({ path: path.join(SHOTS, 'identity-step-phone.png') });
      check(`the step reads "${SECURE}"`, pn.text.indexOf(SECURE) >= 0, pn.text);
      check('no sideways scroll on the identity step', await fitsWidth(ip, '#iv-identity'), await widths(ip, '#iv-identity'));
      C.w.refuseNextSession(402);
      await startCheck(B, ip, true);
      pn = await idPanel(ip);
      B.screens.push(await Lib.screenText(ip));
      await ip.locator('#iv-identity .iv-refused').scrollIntoViewIfNeeded().catch(() => {});
      await ip.screenshot({ path: path.join(SHOTS, 'identity-refusal-phone.png') });
      check(`a tap on the button reaches the server; the refusal line reads "${COULD_NOT_START}"`, C.w.count('session') === 1 && pn.refusal.length === 1 && pn.refusal[0] === COULD_NOT_START, pn.refusal);
      check('the refusal line fits the width (no sideways scroll)', await fitsWidth(ip, '#iv-identity .iv-refused'), await widths(ip, '#iv-identity .iv-refused'));
      const st = await startCheck(B, ip, true);
      pn = await idPanel(ip);
      B.screens.push(await Lib.screenText(ip));
      check('a second tap starts the check: one session, its page in a new tab', C.w.sessions.length === 1 && /^https:\/\//.test(st.address), { sessions: C.w.sessions.length });
      check('while the check runs, "Open it again" is offered', /^https:\/\//.test(pn.again), pn);
      check('no sideways scroll while the check runs', await fitsWidth(ip, '#iv-identity'), await widths(ip, '#iv-identity'));
      const back = ip.locator('.ivf-form [data-action=ivf-back]');
      await back.scrollIntoViewIfNeeded().catch(() => {});
      const onScreen = await back.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return el.innerText.trim() === 'Back' && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && !!hit && (hit === el || el.contains(hit));
      }).catch(() => false);
      check('Back is on screen at the end of the step', onScreen);
      if (onScreen) await back.tap();
      await ip.waitForTimeout(600);
      const hd = await Lib.heading(ip);
      B.screens.push(await Lib.screenText(ip));
      check('Back leaves the identity step', !!hd && !/Identity verification/.test(hd), hd);
      noPayment(check, B);
      worldClean(check, C);
      check('no script error on the investor\'s device', B.errors.length === 0, B.errors);
      F.leakFree(check, 'every investor screen of this part', B.screens.join('\n'));
    } finally {
      await collect(C, sink);
      await C.close();
    }
  }
};

/** An element (selector) and the page inside the window's width. */
const widths = (p, sel) =>
  p.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el ? el.getBoundingClientRect() : null;
    return { found: !!el, left: r ? Math.round(r.left) : null, right: r ? Math.round(r.right) : null, width: innerWidth, page: document.documentElement.scrollWidth };
  }, sel);
const fitsWidth = async (p, sel) => {
  const x = await widths(p, sel);
  return x.found && x.left >= 0 && x.right <= x.width && x.page <= x.width + 1;
};

/**
 * What a flow leaves for the leak part, read before its server closes: the investor's screens, the GET /v1/invite bodies
 * the investor's browser received (with its invitation token) and the addresses its new tabs went to; the emails the server
 * holds for the invited investors; the console's Investors and AML/KYC screens; GET /v1/connectors and GET /v1/invitations
 * with the account's token; the server's event log; the world's record.
 */
async function collect(C, sink) {
  if (!sink) return;
  try {
    C.investors.forEach((B) => {
      sink.investor.push(...B.screens);
      sink.replies.push(...B.replies);
      sink.addresses.push(...B.addresses);
    });
    const mail = await C.srv.call('GET', '/v1/outbox?workspace=kestrel-bay', undefined, C.srv.token);
    ((mail.body && mail.body.messages) || [])
      .filter((m) => C.invited.indexOf(String(m.to || '').toLowerCase()) >= 0)
      .forEach((m) => sink.emails.push([m.subject, m.text, String(m.html || '').replace(/<[^>]*>/g, ' ')].join('\n')));
    for (const [hash, sel] of [['console-investors', '[data-action=invite-toggle]'], ['console-kyc', '[data-action=kyc-tab]']]) {
      await Lib.consoleRoute(C.cp, hash, sel);
      sink.console.push(await Lib.screenText(C.cp));
    }
    sink.sponsor.push((await C.srv.call('GET', '/v1/connectors', undefined, C.srv.token)).text);
    sink.sponsor.push((await C.srv.call('GET', '/v1/invitations?workspace=kestrel-bay', undefined, C.srv.token)).text);
    sink.events.push(JSON.stringify(C.srv.server.store.list('events')));
    sink.calls.push(JSON.stringify(C.w.calls));
  } catch (e) {
    sink.errors.push(String(e && e.message));
  }
}
const newSink = () => ({ investor: [], replies: [], addresses: [], emails: [], console: [], sponsor: [], events: [], calls: [], errors: [] });

/**
 * The owner's preview (view: 'desktop' | 'phone'): the portal framed with every connection refused and no server. The
 * console's AML/KYC page and an invited investor's identity step (the firm's own sandbox connection) render as before.
 */
async function preview(check, S, view) {
  const { A, fr } = await F.framed(S, view);
  try {
    const size = A.page.viewportSize();
    const tap = view === 'phone';
    check(`the window is ${F.VIEW[view].viewport.width}x${F.VIEW[view].viewport.height}${tap ? ' with touch' : ''}`, size.width === F.VIEW[view].viewport.width && size.height === F.VIEW[view].viewport.height && (await fr.evaluate(() => navigator.maxTouchPoints > 0)) === tap, size);
    await F.proveRefused(check, A, fr);
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    check('no integration server is connected', (await fr.evaluate(() => window.CVPortal.invitations.serverOn(window.CVPortal.state.ws))) === false);
    await Lib.consoleRoute(fr, 'console-kyc', '[data-action=kyc-tab]');
    const kyc = await F.noRawError(check, fr, 'the console\'s AML/KYC page');
    await A.page.screenshot({ path: path.join(SHOTS, `preview-${view}-kyc.png`) });
    check('the AML/KYC page renders its existing text', /AML\/KYC/.test(kyc) && kyc.indexOf('Identity verification, sanctions and PEP screening and accredited investor checks run automatically') >= 0 && kyc.indexOf(SECURE) < 0, kyc.slice(0, 400));
    const who = { name: 'Rosalind Achebe', email: 'rosalind.achebe@example.net' };
    const inv = await Lib.createInvitation(fr, { name: who.name, email: who.email, type: 'individual', account: '', offeringId: portal.offeringId });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    const wk = await Lib.walk(fr, { name: who.name, until: /Identity verification/ });
    check('an invited investor reaches the identity step', wk.reached && /Identity verification/.test(wk.at || '') && wk.errors.length === 0, wk);
    const pn = await idPanel(fr);
    const step = await F.noRawError(check, fr, 'the identity step');
    await fr.locator('#iv-identity').scrollIntoViewIfNeeded().catch(() => {});
    await A.page.screenshot({ path: path.join(SHOTS, `preview-${view}-identity.png`) });
    check('the identity step renders its existing text (the firm\'s own sandbox connection), with no package sentence', pn.text.indexOf('Take a photo of your government-issued ID') >= 0 && pn.text.indexOf('This portal is in sandbox mode: the check is simulated.') >= 0 && pn.button === 'Verify my identity' && pn.text.indexOf(SECURE) < 0 && pn.refusal.length === 0, pn);
    check('nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
    F.leakFree(check, 'every screen of this part', [kyc, step].join('\n'));
  } finally {
    await A.context.close().catch(() => {});
  }
}

/* ---------- Plan-check W (08-07) and W1 (wave 5): what the investor reads holds no price; nothing holds the TIN ---------- */
// A price, a tier or an entitlement, as the investor could read them (amounts such as $190,000 are not prices).
const PRICE_RE = [/\$19(?![\d,])/, /\$99(?![\d,])/, /(^|[^\d])1900(?!\d)/, /(^|[^\d])9900(?!\d)/, /\btiers?\b/i, /\bentitlements?\b/i];
const PRICE_WORDS = ['$19', '$99', '1900', '9900', 'tier', 'entitlement'];
function priceScan(text) {
  const hits = String(text || '')
    .split('\n')
    .filter((l) => PRICE_RE.some((re) => re.test(l)))
    .map((l) => l.trim().slice(0, 160));
  return { ok: hits.length === 0, hits };
}
/** A GET /v1/invite body as text, without the documents' bytes (base64 holds digits at random). */
function inviteText(raw) {
  try {
    return JSON.stringify(JSON.parse(raw), (k, v) => (k === 'base64' || k === 'pdf' ? '' : v));
  } catch (e) {
    return String(raw || '');
  }
}
// The taxpayer number phase 6's walk types (lib.js walk: a.tin || '123456789'); read from that file, never typed here.
const TIN = (() => {
  const src = fs.readFileSync(path.join(Lib.ROOT, '.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js'), 'utf8');
  const m = src.match(/#ob-tin', a\.tin \|\| '(\d{9})'/);
  return m ? m[1] : '';
})();
const holdsTin = (text) => !!TIN && String(text || '').indexOf(TIN) >= 0;

async function leak({ check, S }) {
  // The scans proved first: a planted vendor word (frame.js), a planted price, a planted taxpayer number in a file.
  F.proveScan(check);
  const planted = ['Add verification package ($19)', 'Your package tier: full', 'Charged 9900 cents'];
  check('the price scan catches a planted "$19", a tier and an amount in cents, and passes a clean screen', planted.every((t) => !priceScan(t).ok) && priceScan('Minimum investment $100,000\nSubscription of $190,000.00 submitted').ok, planted.map((t) => priceScan(t).ok));
  const O = path.dirname(Lib.OUT);
  const plantFile = path.join(O, `package-flow-planted-${process.pid}.txt`);
  fs.writeFileSync(plantFile, `planted copy: ${TIN}\n`);
  check('the taxpayer-number scan finds the number in a planted copy of a file', TIN.length === 9 && holdsTin(fs.readFileSync(plantFile, 'utf8')));
  fs.rmSync(plantFile, { force: true });

  // The four flows the investor sees, their screens, emails and replies kept; everything the process prints captured.
  const sink = newSink();
  let printed = '';
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  process.stdout.write = (c, ...a) => {
    printed += String(c);
    return out(c, ...a);
  };
  process.stderr.write = (c, ...a) => {
    printed += String(c);
    return err(c, ...a);
  };
  try {
    for (const f of ['identity', 'refused', 'start-limit', 'phone']) await FLOWS[f](check, S, sink);
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
  check('everything the flows left was read before their servers closed', sink.errors.length === 0, sink.errors);
  // Test-only: PACKAGE_FLOW_PLANT=price adds a price to one investor screen, to show this part failing on a planted copy.
  if (process.env.PACKAGE_FLOW_PLANT === 'price') sink.investor.push('Your verification package ($19) is paid.');
  const replies = sink.replies.map(inviteText);
  check(`scanned ${sink.investor.length} investor screens, ${sink.emails.length} investor emails, ${replies.length} GET /v1/invite replies, ${sink.console.length} console screens, ${sink.sponsor.length} account replies (each above zero)`, sink.investor.length > 0 && sink.emails.length > 0 && replies.length > 0 && sink.console.length > 0 && sink.sponsor.length > 0);
  for (const [label, texts] of [['investor screens', sink.investor], ['investor emails', sink.emails], ['GET /v1/invite replies (investor token)', replies]]) {
    const p = priceScan(texts.join('\n'));
    check(`${label}: none of ${PRICE_WORDS.join(', ')}`, p.ok, p.hits);
    F.leakFree(check, label, texts.join('\n'));
  }
  F.leakFree(check, 'console screens', sink.console.join('\n'));
  F.leakFree(check, 'GET /v1/connectors and GET /v1/invitations (account token)', sink.sponsor.join('\n'));
  const own = [new URL(S.origin).origin];
  check(`the new tabs' own addresses (${sink.addresses.filter(Boolean).length}) are the one place outside the portal and the server: https, on neither origin`, sink.addresses.filter(Boolean).length > 0 && sink.addresses.filter(Boolean).every((a) => /^https:\/\//.test(a) && own.indexOf(new URL(a).origin) < 0 && !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(a)), sink.addresses.length);
  // W1: the typed taxpayer number appears in no world record, no server output (event log, anything printed) and no file this part writes.
  const record = path.join(O, 'package-flow-leak.txt');
  fs.writeFileSync(record, [`PACKAGE FLOW leak part, ${new Date().toISOString()}`, `investor screens ${sink.investor.length}`, `investor emails ${sink.emails.length}`, `GET /v1/invite replies ${replies.length}`, `console screens ${sink.console.length}`, `account replies ${sink.sponsor.length}`, `new tab addresses ${sink.addresses.filter(Boolean).length}`, `world calls ${sink.calls.map((c) => JSON.parse(c).length).join(' + ')}`].join('\n') + '\n');
  check('the typed taxpayer number is in no world record', sink.calls.length > 0 && !sink.calls.some(holdsTin));
  check('the typed taxpayer number is in no server output (event log, anything this process printed)', sink.events.length > 0 && !sink.events.some(holdsTin) && !holdsTin(printed));
  check('the typed taxpayer number is in no file this part writes', !holdsTin(fs.readFileSync(record, 'utf8')));
  check('no call left this machine outside the stand-in world over all four flows', outside.length === 0, outside);
}

const part = (f) => ({ check, S }) => FLOWS[f](check, S, null);
const PARTS = {
  identity: part('identity'),
  refused: part('refused'),
  'start-limit': part('start-limit'),
  phone: part('phone'),
  'preview-desktop': ({ check, S }) => preview(check, S, 'desktop'),
  'preview-phone': ({ check, S }) => preview(check, S, 'phone'),
  leak
};

Lib.runParts(PARTS, { name: 'PACKAGE FLOW', unit: 'parts', flag: '--only', browser: true });
