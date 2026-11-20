#!/usr/bin/env node
// GATE CHECK: PACKAGE CONSOLE
// Plan 08-17 (08-CONTEXT R7, "After 08-15", "After 08-16", G1): the sponsor's console shows the integration server's package
// refusals as the server sends them, and a used package leaves a new invitation, never a charge by surprise. The console is
// the sample self-serve portal on a sponsor account (BALANCE credit, the server's built-in sandbox provider named for both
// package checks, as package-invite.js does), connected to the real integration server in this process. Every sentence a
// part asserts on screen is read from the real server's reply in that run (frame.js stubServer { amend }), never typed here.
//   package-used     1280x800 (R7): an invitation with the package reaches the real server (stored, paid from the balance)
//                    but the console hears a refused connection, so it reads "Not sent yet"; the package's check is then
//                    started and the server's invitation cancelled; sent again, the server answers 409 package_used: its
//                    sentence on screen word for word, the old invitation closed, a new invitation for the same investor,
//                    offering, amount and package choice with a new id reading "Not sent yet", nothing charged and nothing
//                    sent by itself; sending the new one pays one new package at the server's price
// Every part asserts that the server in this process called nothing outside this machine, and ends with the leak scan of
// the screens it saw (phase 6's leak check and frame.js's vendor scan).
//   NODE_PATH=$(npm root -g) node package-console.js [--only package-used]
// The last line is "PACKAGE CONSOLE: PASS (parts run: N)" or "PACKAGE CONSOLE: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const F = require('./frame.js');
const Lib = F.Lib;

// The integration server runs in this process: a call it makes to anywhere outside this machine (a payment or check
// provider) is refused here and kept, so every part can prove none was made.
const outside = [];
const ownFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const u = new URL(String(input && input.url ? input.url : input));
  if (['127.0.0.1', 'localhost', '[::1]'].indexOf(u.hostname) < 0) {
    outside.push(`${(init && init.method) || 'GET'} ${u.origin}${u.pathname}`);
    return Promise.reject(new Error('refused by the check: no call leaves this machine'));
  }
  return ownFetch(input, init);
};

const SHOTS = path.join(Lib.OUT, 'package-console-shots');
fs.mkdirSync(SHOTS, { recursive: true });
Lib.describeShots([
  ['used-rows.png', 'Server mode, 1280x800: after the server refused a used package, the new invitation for the same investor reads "Not sent yet".'],
  ['used-all.png', 'Server mode, 1280x800: the invitations list on "All": the closed invitation with the server\'s sentence, and its replacement.']
]);

// As package-invite.js (sponsor accounts, plan 08-01): the operator's admin token; stand-in values where the server only asks
// that the payment settings are filled (no provider is called: see outside); the built-in sandbox provider for both checks.
const ADMIN = crypto.randomBytes(24).toString('hex');
const ACCOUNT_ENV = { ADMIN_TOKEN: ADMIN, BILLING_SECRET_KEY: 'stand-in-not-a-key', BILLING_PUBLISHABLE_KEY: 'stand-in-not-a-key', PACKAGE_IDENTITY_PROVIDER: 'sandbox', PACKAGE_ACCREDITATION_PROVIDER: 'sandbox' };
/** The account's balance: covers two full packages, so the server pays from it and never reaches a payment provider. */
const BALANCE = 100000;

/**
 * The sponsor's console on the sample portal (a Rule 506(c) offering raising), connected to the integration server with a
 * sponsor account's token (made with the admin token for the console's workspace, BALANCE on it). GET /v1/billing is the
 * real server's answer. handlers: frame.js stubServer handlers.
 */
async function consoleOn(S, check, view, handlers) {
  const srv = await Lib.serverPortal(S, ACCOUNT_ENV);
  const A = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({ acceptDownloads: true }, view) });
  const off = await Lib.setupPortal(S, A, { exemption: 'Rule 506(c)' });
  const stub = await F.stubServer(A.context, srv.base, Object.assign({ 'POST /v1/invitations': () => null, 'GET /v1/billing': () => null }, handlers));
  const workspace = await A.page.evaluate(() => window.CVPortal.state.ws.tenant.id);
  const res = await fetch(`${srv.base}/v1/admin/accounts`, { method: 'POST', headers: { Authorization: `Bearer ${ADMIN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace, name: 'Kestrel Bay Capital' }) });
  const account = await res.json().catch(() => null);
  check('a sponsor account is made for the console\'s workspace with the operator\'s admin token', res.status === 200 && !!account && !!account.token && account.workspace === workspace, { status: res.status });
  if (account && account.id) srv.server.store.put('billing', { id: account.id, creditCents: BALANCE });
  const token = account && account.token;
  const on = await A.page.evaluate(
    ({ base, token }) => {
      const NS = window.CVPortal;
      const s = NS.integrations.ensure(NS.state.ws).server;
      s.url = base;
      s.token = token;
      NS.app.save(true);
      return NS.invitations.serverOn(NS.state.ws);
    },
    { base: srv.base, token }
  );
  check('the console uses the integration server with the sponsor account\'s token', on === true);
  /** A call to the real server with the account's token: { status, body }. */
  const call = async (method, p, body) => {
    const r = await fetch(srv.base + p, { method, headers: Object.assign({ Authorization: `Bearer ${token}` }, body !== undefined ? { 'Content-Type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  /** The account's money as the server holds it: balance, amount owed, and every package entitlement. */
  const money = () => {
    const st = srv.server.store;
    const rec = (account && st.get('billing', account.id)) || {};
    const ents = st.list('entitlements').filter((e) => e.account === (account || {}).id);
    return { credit: rec.creditCents || 0, owed: rec.owedCents || 0, entitlements: ents.length, payments: st.list('payments').length, ents: ents.map((e) => ({ key: e.key, tier: e.tier, status: e.status, cents: e.cents, by: e.by, invitationId: e.invitationId })) };
  };
  return {
    srv,
    A,
    page: A.page,
    off,
    stub,
    token,
    account,
    call,
    money,
    close: async () => {
      await A.context.close().catch(() => {});
      await srv.close().catch(() => {});
    }
  };
}

/** The invite form open on the Investors page. */
async function openForm(p) {
  await p.evaluate(() => (location.hash = '#console-investors'));
  await p.waitForSelector('[data-action=invite-toggle]', { timeout: 20000 });
  if ((await p.locator('#iv-email').count()) === 0) await p.click('[data-action=invite-toggle]');
  await p.waitForSelector('#iv-email', { timeout: 10000 });
}
/** The offering the invitation is for ('' = none), chosen under More options. */
async function chooseOffering(p, id) {
  if (!(await p.locator('#iv-more[open]').count())) await p.click('#iv-more summary');
  await p.selectOption('#iv-off', id);
  await p.waitForTimeout(300);
}
/** The single form's box as the screen shows it. */
const box = (p) =>
  p.evaluate(() => {
    const row = document.getElementById('iv-package-row');
    const input = document.getElementById('iv-package');
    const shown = (el) => !!el && !el.hidden && !!(el.offsetWidth || el.offsetHeight);
    const label = document.getElementById('iv-package-label');
    const line = document.getElementById('iv-package-line');
    return { present: !!input, shown: shown(row) && shown(input), disabled: !!(input && input.disabled), checked: !!(input && input.checked), label: label ? label.innerText.trim() : '', line: shown(line) ? line.innerText.trim() : '', rows: shown(row) ? row.innerText.split('\n').map((x) => x.trim()).filter(Boolean) : [] };
  });
/** Waits until the box is on screen with a price (the server's answer has arrived) or the time is up. */
async function boxReady(p, ms) {
  await p
    .waitForFunction(() => {
      const row = document.getElementById('iv-package-row');
      const label = document.getElementById('iv-package-label');
      return !!row && !row.hidden && !!row.offsetWidth && /\$/.test((label && label.textContent) || '');
    }, null, { timeout: ms || 10000 })
    .catch(() => {});
  return box(p);
}
/** All of an investor's invitations in the console, oldest first. */
const invitationsOf = (p, email) =>
  p.evaluate((email) => {
    const ws = window.CVPortal.state.ws;
    const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
    return inv ? (ws.invitations || []).filter((x) => x.investorId === inv.id).map((it) => ({ id: it.id, investorId: it.investorId, offeringId: it.offeringId, cents: it.cents, cls: it.cls, note: it.note, status: it.status, serverId: it.serverId || '', emailStatus: it.emailStatus, emailError: it.emailError || '', pkg: it.package === undefined ? null : it.package, includeTax: !!it.includeTax })) : [];
  }, email);
/** Fill the single form and send; o.package ticks the box first. Resolves to the newest invitation for the email. */
async function invite(p, o) {
  await openForm(p);
  await p.fill('#iv-contact', o.first);
  await p.fill('#iv-last', o.last);
  await p.fill('#iv-email', o.email);
  if (o.offeringId !== undefined) await chooseOffering(p, o.offeringId);
  if (o.amount) await p.fill('#iv-amt', String(o.amount));
  let ticked = false;
  if (o.package) {
    const b = await boxReady(p);
    if (b.shown && !b.disabled) {
      if (o.tap) await p.tap('#iv-package');
      else await p.check('#iv-package');
      ticked = (await box(p)).checked;
    }
  }
  if (o.tap) await p.tap('.inv8-form[data-form="invite-one"] button[type=submit]');
  else await p.click('.inv8-form[data-form="invite-one"] button[type=submit]');
  await p
    .waitForFunction((email) => {
      const ws = window.CVPortal.state.ws;
      const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
      const it = inv && (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
      return !!(it && (it.serverId || it.emailStatus === 'failed' || it.emailStatus === 'manual'));
    }, o.email, { timeout: 30000 })
    .catch(() => {});
  await p.waitForTimeout(400);
  const all = await invitationsOf(p, o.email);
  return Object.assign({ ticked }, all[all.length - 1] || {});
}
/** The invitation's row in the console's list, as text ('' when it is not listed). */
const rowText = (p, id) =>
  p.evaluate((id) => {
    const tr = document.querySelector(`tr[data-invitation="${id}"]`);
    return tr ? tr.innerText.replace(/\s+/g, ' ').trim() : '';
  }, id);
/** The invitations list on one of its tabs ('open' | 'completed' | 'all'). */
async function listTab(p, f, tap) {
  const sel = `[data-action=inv8-filter][data-f=${f}]`;
  await p.locator(sel).scrollIntoViewIfNeeded().catch(() => {});
  if (tap) await p.tap(sel);
  else await p.click(sel);
  await p.waitForTimeout(300);
}
/** The row's own send ("Resend" on an invitation not sent yet), pressed; waits for the console to hear back. */
async function sendRow(p, id, posts, tap) {
  const before = posts();
  const sel = `tr[data-invitation="${id}"] [data-action=inv8-resend]`;
  await p.locator(sel).scrollIntoViewIfNeeded().catch(() => {});
  if (tap) await p.tap(sel);
  else await p.click(sel);
  for (let i = 0; i < 100 && posts() === before; i++) await p.waitForTimeout(100);
  await p.waitForTimeout(1200);
}
const packageOf = (post) => ((post && post.body) || {}).invitation || {};

const parts = {
  'package-used': async ({ check, S }) => {
    // The first send reaches the real server, but the console hears a refused connection; later sends are the server's own
    // replies, kept as the server sent them.
    let mode = 'lost';
    const replies = [];
    let lost = null;
    const C = await consoleOn(S, check, F.VIEW.desktop, {
      'POST /v1/invitations': async (req) => {
        if (mode === 'lost') {
          mode = 'real';
          const r = await ownFetch(`${C.srv.base}/v1/invitations`, { method: 'POST', headers: { Authorization: req.auth, 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) });
          lost = { status: r.status, body: await r.json().catch(() => null) };
          return { refuse: true };
        }
        return {
          amend: (json, status) => {
            replies.push({ status, json });
            return json;
          }
        };
      }
    });
    try {
      const p = C.page;
      const posts = () => C.stub.sent('POST /v1/invitations').length;
      const who = { first: 'Imogen', last: 'Achterberg', email: 'imogen.achterberg@example.com', offeringId: C.off.offeringId, amount: 250000, package: true };
      const start = C.money();
      const one = await invite(p, who);
      check('the box was ticked for the Rule 506(c) offering and the invitation was sent once', one.ticked === true && posts() === 1 && packageOf(C.stub.sent('POST /v1/invitations')[0]).package === true && packageOf(C.stub.sent('POST /v1/invitations')[0]).clientId === one.id, { one, posts: posts() });
      const sid = lost && lost.body && lost.body.id;
      const rec = sid ? C.srv.server.store.get('invitations', sid) : null;
      check('the real server stored it and paid its package from the balance (full, the server\'s price)', lost && lost.status === 200 && !!rec && !!rec.package && rec.package.key === one.id && rec.package.tier === 'full' && C.money().credit === start.credit - 9900, { lost: lost && lost.status, credit: C.money().credit });
      check('the console heard a refused connection: no server id, the row reads "Not sent yet"', one.serverId === '' && one.emailStatus === 'failed' && /Not sent yet/.test(await rowText(p, one.id)), one);
      // The package's check started (as a started check leaves it), then the server's invitation ended (cancelled).
      if (rec && rec.package) C.srv.server.store.put('entitlements', { id: rec.package.entitlement, startedAt: new Date().toISOString() });
      const cancel = sid ? await C.call('POST', `/v1/invitations/${encodeURIComponent(sid)}/cancel`, {}) : { status: 0 };
      check('the package\'s check is started and the server\'s invitation is cancelled with the account\'s token', cancel.status === 200 && (C.srv.server.store.get('invitations', sid) || {}).status === 'cancelled', cancel);

      // Sent again: the real server refuses with package_used.
      const before = C.money();
      await sendRow(p, one.id, posts);
      await p.waitForTimeout(800);
      const said = replies[0] || null;
      const SENT = said && said.json && typeof said.json.error === 'string' ? said.json.error : '';
      check('sent again, the real server answered 409 package_used with a sentence of its own', !!said && said.status === 409 && said.json.code === 'package_used' && SENT.length > 10, said);
      const text = await F.noRawError(check, p, 'after the refusal', C.A.errors);
      check('the server\'s sentence is on screen word for word', !!SENT && text.indexOf(SENT) >= 0, text.split('\n').filter((l) => /package|could not/i.test(l)).slice(0, 6));
      const after = C.money();
      check('the refused send charged nothing: the balance and the entitlements are as they were', after.credit === before.credit && after.owed === before.owed && after.entitlements === before.entitlements && after.payments === before.payments && JSON.stringify(after.ents) === JSON.stringify(before.ents), { before, after });
      const all = await invitationsOf(p, who.email);
      const old = all.find((x) => x.id === one.id) || {};
      const fresh = all.filter((x) => x.id !== one.id);
      const nu = fresh[0] || {};
      check('the old invitation is closed in the console', old.status === 'cancelled', old);
      check('one new invitation for the same investor, offering, amount and class, with a new id', fresh.length === 1 && !!nu.id && nu.id !== one.id && nu.investorId === one.investorId && nu.offeringId === one.offeringId && nu.cents === one.cents && nu.cls === one.cls && nu.note === one.note && nu.includeTax === one.includeTax, { one, fresh });
      check('the new invitation holds the package choice before it is sent', nu.pkg === true && nu.serverId === '' && nu.emailStatus === 'not_sent', nu);
      check('nothing was sent by itself: no request after the refused one', posts() === 2, posts());
      const nuRow = nu.id ? await rowText(p, nu.id) : '';
      check('the new invitation reads "Not sent yet" on the list', /Not sent yet/.test(nuRow) && /\bPackage\b/.test(nuRow), nuRow);
      await C.A.page.screenshot({ path: path.join(SHOTS, 'used-rows.png') });
      await listTab(p, 'all');
      const oldRow = await rowText(p, one.id);
      check('on "All", the old invitation\'s row shows the server\'s sentence word for word', !!SENT && oldRow.indexOf(SENT) >= 0 && /Cancelled/i.test(oldRow), oldRow);
      const audited = await p.evaluate((s) => (window.CVPortal.state.ws.audit || []).filter((a) => a.action === 'Invitation replaced' && String(a.detail || '').indexOf(s) >= 0).length, SENT);
      check('one audit entry "Invitation replaced" with the server\'s sentence', audited === 1, audited);
      await C.A.page.screenshot({ path: path.join(SHOTS, 'used-all.png') });
      const seen = [text, await F.noRawError(check, p, 'the list on All', C.A.errors)];
      await listTab(p, 'open');

      // The sponsor sends the new invitation: one new package, at the server's price, from the balance.
      const pre = C.money();
      if (nu.id) await sendRow(p, nu.id, posts);
      const sentNew = C.stub.sent('POST /v1/invitations')[2];
      const got = (await invitationsOf(p, who.email)).find((x) => x.id === nu.id) || {};
      const held = got.serverId ? C.srv.server.store.get('invitations', got.serverId) : null;
      const post = C.money();
      check('sending the new one posts its own id as the client id, with the package', !!sentNew && packageOf(sentNew).clientId === nu.id && packageOf(sentNew).package === true, sentNew ? packageOf(sentNew) : null);
      check('the server holds it with a new package of its own', !!held && !!held.package && held.package.key === nu.id && held.package.tier === 'full' && (replies[1] || {}).status === 200, { held: held && held.package, reply: replies[1] && replies[1].status });
      check('the balance dropped by exactly the tier\'s price ($99), one new entitlement, no payment to a card', post.credit === pre.credit - 9900 && post.entitlements === pre.entitlements + 1 && post.payments === 0, { pre, post });
      const row2 = await rowText(p, nu.id);
      check('its row no longer reads "Not sent yet"', !!row2 && !/Not sent yet/.test(row2), row2);
      seen.push(await F.noRawError(check, p, 'after sending the new one', C.A.errors));
      check('the server called nothing outside this machine', outside.length === 0, outside);
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await C.close();
    }
  }
};

Lib.runParts(parts, { name: 'PACKAGE CONSOLE', unit: 'parts', flag: '--only', browser: true });
