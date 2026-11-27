#!/usr/bin/env node
// GATE CHECK: REVERIFY
// Plan 08-09 (D-04, C-06, D-30): the sponsor asks an investor on file to verify their accreditation again. The investor
// gets one link that holds the accreditation step and the done screen only; the renewed verification lifts the Rule
// 506(c) block that a lapsed one put on their subscription (the block itself was already built). Stand-ins only: the
// sample self-serve portal, the firm's own simulated connection, the real integration server in this process.
//   local   1280x800, no server: an active investor whose verification by a third party lapsed yesterday, and a pending
//           Rule 506(c) subscription; the sponsor's Approve is refused with the existing "expired" sentence; the Investors
//           row offers "Ask to re-verify"; its dialog names the investor, with "Send request" and a close control;
//           sending prepares the sponsor's email with the link; the link's flow has exactly two steps (accreditation,
//           done), no login, profile, identity, tax or payment step, and the request's own line; the investor verifies
//           through the firm's own connection; the console then shows the new verification with its valid-until date, one
//           "Accreditation re-verification requested" and one "Accreditation re-verified" entry; Approve is allowed
//   server  1280x800, the real integration server in this process (shared token, no mail settings): "Ask to re-verify",
//           "Send request": the server stores the request (reverify, no offering) and emails it (outbox); the investor's
//           own browser context opens the link (two steps) and verifies; the console imports; the record shows the new
//           verification, the two entries, a re-verification notice and row; Approve is allowed; one POST /v1/invitations;
//           the taxpayer number Lib.walk types reaches no store, call or screen (the scan proven on a planted copy)
//   leave   D-30: the investor, signed in to the portal, is offered "Verify your accreditation"; Back on the request's first
//           step returns to the portal, which still offers it; leaving changes nothing on the record; opening it again
//           resumes the same request; an expired or a cancelled request is not offered
//   button  "Ask to re-verify" shows for an active investor whose verification by a third party is missing, lapsed or lapses
//           within 14 days while an offering raising needs verified accreditation; not for a current verification more than
//           14 days from lapsing, a firm with only Rule 506(b) offerings and the default rule, an investor not yet active, a
//           team role that may not invite, or the managed edition (index.html); asking again while the request is open
//           makes no second request (local), and in server mode resends it with no new POST /v1/invitations
// Plan 08-20 (D-01, G6, the 08-09 warning): the package on a re-verification request, and the investor's way to it.
//   package  1280x800, the real integration server on a sponsor account with a card on file (doubles/world.js startServer,
//           the stand-in accreditation provider): the dialog holds "Add verification package (<the server's reverify
//           price>)"; ticked, "Send request": one charge of exactly that price before the request's email; the server holds
//           the request with its package at tier reverify; the investor's own browser opens the link (two steps, the
//           accreditation step reads "A secure page opens in a new tab for this step.") and verifies through the package;
//           the console imports and shows the new verification with its valid-until date; the request's row reads
//           "Package"; no investor screen, request email or GET /v1/invite reply holds a price, a tier or an entitlement;
//           no call leaves the machine outside the stand-in world; the typed taxpayer number reaches nothing
//   server (08-20, G6) the shared token: the dialog's box switched off with the server's account_required sentence; then, on a
//           sponsor account: unreachable (package.js's line), no card (its line, linked to Integrations for an admin only),
//           an amount owed (the real credit_owed sentence; "Send request" sends without the package, nothing charged),
//           tier_mismatch and package_used shown in the dialog and on the row word for word, nothing charged; a used package
//           leaves a new request with a new id, still a re-verification
//   subscribe  the 08-09 warning: a Rule 506(c) subscription refused for a lapsed verification: with an open request the
//           subscribe screen offers "Verify your accreditation" (the request's link); with none and no accreditation check
//           of the firm's own, "<firm> will send you a link to verify again."; with the firm's own check, as today; no way
//           to sign around the refusal in any case
//   phone   390x844 with touch: the dialog with its box fits, scrolls to "Send request" and closes with its X, Escape and
//           the browser's back; the investor's step and the subscribe banner fit, with Back on screen
//   preview-desktop, preview-phone  the owner's preview (framed, connect-src none, no server): the frame refuses a fetch;
//           the box switched off with "Checks run once your portal is connected to its server."; "Send request" prepares the
//           sponsor's own email; the subscribe screen offers the request; its two steps run with the firm's own connection;
//           no refused connection recorded; no raw error
//   NODE_PATH=$(npm root -g) node reverify.js [--only local,server,leave,button,package,subscribe,phone,preview-desktop,preview-phone]
// The last line is "REVERIFY: PASS (parts run: N)" or "REVERIFY: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const F = require('./frame.js');
const W = require('./doubles/world.js');
const Lib = F.Lib;

// The integration server runs in this process: a call it makes to anywhere outside this machine, other than through the
// stand-in world's fetch, is refused here and kept, so a part can prove none was made (plan 08-20).
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

const SHOTS = path.join(Lib.OUT, 'reverify-shots');
fs.mkdirSync(SHOTS, { recursive: true });
Lib.describeShots([
  ['local-button.png', 'Local mode, 1280x800: the Investors page with "Ask to re-verify" on the row of an investor whose verification lapsed.'],
  ['local-dialog.png', 'Local mode, 1280x800: the "Ask to re-verify" dialog with the investor\'s name and "Send request".'],
  ['local-email.png', 'Local mode, 1280x800: the request\'s email, prepared with the investor\'s link.'],
  ['local-link.png', 'Local mode, 1280x800: the request\'s link: step 1 of 2, the accreditation step, with the request\'s own line.'],
  ['local-done.png', 'Local mode, 1280x800: the request\'s done screen after the investor verified.'],
  ['server-link.png', 'Server mode, 1280x800: the investor\'s own device opens the request: step 1 of 2, the accreditation step.'],
  ['server-row.png', 'Server mode, 1280x800: after the import, the request\'s row reads "Re-verification only".'],
  ['package-dialog.png', 'Plan 08-20, server mode, 1280x800: the "Ask to re-verify" dialog with "Add verification package" and the server\'s reverify price.'],
  ['package-link.png', 'Plan 08-20: the investor\'s own device opens the request with the package: step 1 of 2, "A secure page opens in a new tab for this step."'],
  ['package-row.png', 'Plan 08-20: after the import, the request\'s row reads "Re-verification only" and "Package".'],
  ['subscribe-request.png', 'Plan 08-20, 1280x800: the investor\'s subscribe screen with an open request: the reason and "Verify your accreditation".'],
  ['subscribe-will-send.png', 'Plan 08-20, 1280x800: no open request and no accreditation check of the firm\'s own: the reason and "<firm> will send you a link to verify again."'],
  ['subscribe-own-check.png', 'Plan 08-20, 1280x800: the firm\'s own accreditation check: the subscribe screen as today.'],
  ['phone-dialog.png', 'Plan 08-20, 390x844 with touch: the dialog with "Add verification package" and the server\'s reverify price.'],
  ['phone-link.png', 'Plan 08-20, 390x844 with touch: the investor\'s own phone on the request\'s step, Back on screen.'],
  ['phone-subscribe.png', 'Plan 08-20, 390x844 with touch: the subscribe screen offering "Verify your accreditation".'],
  ['preview-desktop-dialog.png', 'Plan 08-20, the owner\'s preview (no server) at 1280x800: the dialog\'s box switched off with its one line.'],
  ['preview-desktop-subscribe.png', 'Plan 08-20, the owner\'s preview at 1280x800: the subscribe screen offering the request.'],
  ['preview-phone-dialog.png', 'Plan 08-20, the owner\'s preview at 390x844 with touch: the dialog\'s box switched off with its one line.'],
  ['preview-phone-subscribe.png', 'Plan 08-20, the owner\'s preview at 390x844 with touch: the subscribe screen offering the request.']
]);

const DAY = 864e5;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const LAPSED = 'Your accreditation verification expired on';

/** The toasts on screen, newest last. */
const toasts = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#toasts .toast')).map((t) => t.textContent));
/** Waits for a toast holding re (a RegExp source) and resolves to its text ('' when none came). */
async function toastLike(p, re) {
  try {
    await p.waitForFunction((src) => Array.from(document.querySelectorAll('#toasts .toast')).some((t) => new RegExp(src).test(t.textContent)), re, { timeout: 10000 });
  } catch (e) {
    return '';
  }
  return (await toasts(p)).filter((t) => new RegExp(re).test(t)).pop() || '';
}

/**
 * The sample self-serve portal (a Rule 506(c) offering raising) with one active individual whose verification by a third
 * party (the firm's own simulated connection) lapsed yesterday, and their pending subscription to that offering. No
 * request is open for them. Resolves to { id, email, contact, title, reqId, firm, until }.
 */
async function lapsedInvestor(S, A, opts) {
  const off = await Lib.setupPortal(S, A, { exemption: 'Rule 506(c)' });
  return A.page.evaluate(
    ({ off, opts, DAY }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const c = NS.integrations.ensure(ws);
      c.use.accreditation = ['sandbox'];
      c.rules.accreditationFor = '506c';
      c.rules.validDays = 90;
      const a = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.email);
      const t = Date.now();
      const day = (n) => new Date(t + n * DAY).toISOString().slice(0, 10);
      const at = (n) => new Date(t + n * DAY).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const until = opts.until === undefined ? day(-1) : opts.until;
      Object.assign(a, { contact: 'Marguerite Okonkwo-Laurent', title: 'Marguerite Okonkwo-Laurent', email: 'marguerite.okonkwo@example.com' });
      a.verify = {
        identity: { status: 'passed', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', completedAt: at(-120) },
        aml: { status: 'clear', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', completedAt: at(-120), screenedAt: day(-1) },
        accreditation: until === null ? { status: 'not_started' } : { status: 'verified', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', method: 'Net worth over $1 million, excluding primary residence', completedAt: at(-91), verifiedAt: day(-91), expiresAt: until },
        decision: { status: 'approved', at: at(-120), by: 'Automatic' }
      };
      a.accreditation = Object.assign({}, a.accreditation, { basis: 'Net worth over $1 million, excluding primary residence', date: day(-91), verifiedBy: 'Sandbox', expires: until || '' });
      ws.invitations = (ws.invitations || []).filter((x) => x.investorId !== a.id);
      const o = ws.offerings.find((x) => x.id === off.offeringId);
      const r = NS.ops.submitSubscription(ws, a, o, { cents: Math.round((Number(o.minimum) || 50000) * 100), signature: a.contact });
      // Signed on paper and recorded as such: no agreement waits for a signature, so only the verification decides Approve.
      if (r.envelopeId) ws.envelopes = (ws.envelopes || []).filter((e) => e.id !== r.envelopeId);
      delete r.envelopeId;
      r.signedAt = at(-1);
      NS.integrations.syncKyc(ws, a);
      NS.app.save(true);
      return { id: a.id, email: a.email, contact: a.contact, title: a.title, reqId: r.id, firm: ws.tenant.name, until, offeringId: o.id };
    },
    { off, opts: opts || {}, DAY }
  );
}

/** The entries of the change log with this action for this investor. */
const entries = (p, id, action) => p.evaluate(({ id, action }) => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === action && e.record === id).map((e) => e.detail), { id, action });

/** The sponsor presses Approve on the subscription on the Requests page; resolves to { toast, status, overridden }. */
async function approve(p, reqId) {
  await p.evaluate(() => (window.CVPortal.state.ui.reqOverride = null));
  await Lib.consoleRoute(p, 'console-requests', `[data-action=req-approve][data-id="${reqId}"]`);
  await p.evaluate(() => (document.getElementById('toasts').innerHTML = ''));
  await p.click(`[data-action=req-approve][data-id="${reqId}"]`);
  const toast = await toastLike(p, 'not fully verified|Subscription approved|not signed');
  return p.evaluate(
    ({ reqId, toast }) => {
      const ws = window.CVPortal.state.ws;
      const r = (ws.requests || []).find((x) => x.id === reqId) || {};
      const inv = ws.investors.find((y) => y.id === r.investorId);
      const o = ws.offerings.find((y) => y.id === r.offeringId);
      return { toast, status: r.status, overridden: (ws.audit || []).filter((e) => e.action === 'Subscription approved without full verification').length, gate: inv && o ? (window.CVPortal.integrations.subscribeGate(ws, inv, o) || {}).reason || '' : '(none)' };
    },
    { reqId, toast: toast || (await toasts(p)).join(' | ') }
  );
}

/** The investor's row on the Investors page. */
async function row(p, email) {
  await Lib.consoleRoute(p, 'console-investors', '.cs-tbl');
  return p.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: email }).first();
}

/** What the request's link shows: the count, the step keys, the controls and inputs on screen, the text. */
const flowState = (p, itId) =>
  p.evaluate((itId) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const it = (ws.invitations || []).find((x) => x.id === itId);
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const form = document.querySelector('.ivf-form');
    return {
      hash: location.hash.replace(/^#(invite-).*/, '#$1…'),
      count: (document.querySelector('.ivf-progress .ob-count') || {}).innerText || '',
      steps: it ? NS.inviteFlow.steps(ws, it) : null,
      list: Array.from(document.querySelectorAll('.ob-steps li, .ivf-steps li')).map((li) => li.innerText.replace(/\s+/g, ' ').trim()),
      inputs: form ? Array.from(form.querySelectorAll('input, select, textarea')).filter((el) => el.type !== 'hidden' && vis(el)).map((el) => el.id || el.name) : [],
      text: form ? form.innerText.replace(/\s+/g, ' ') : document.body.innerText.replace(/\s+/g, ' ')
    };
  }, itId);

/* ---------- Plan 08-20: the package on a re-verification request ---------- */
// package.js's own sentences, read from the file (never typed here): the box's lines in its no-server, unreachable and no-card
// states, and the label's first words.
const PKG_SRC = fs.readFileSync(path.join(Lib.ROOT, 'assets', 'js', 'package.js'), 'utf8');
const pkgConst = (name) => (PKG_SRC.match(new RegExp(`const ${name} = '([^']+)';`)) || [])[1] || `(${name} not found in package.js)`;
const PKG_LABEL = pkgConst('LABEL');
const NO_SERVER_LINE = pkgConst('NO_SERVER');
const UNREACHABLE_LINE = pkgConst('UNREACHABLE');
const NO_CARD_LINE = (PKG_SRC.match(/line: '(Add a card on the Integrations page[^']*)'/) || [])[1] || '(no-card line not found in package.js)';
const SECURE = 'A secure page opens in a new tab for this step.';
// What the investor never sees about the package (T-08-58).
const PRICE_WORDS = ['$19', '$99', '1900', '9900', 'tier', 'entitlement'];
/** Cents as a price on screen, as package.js priceLabel writes it (whole dollars, cents only when there are any). */
const priceText = (n) => `$${(n / 100).toLocaleString('en-US', { minimumFractionDigits: n % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
// Lib.walk's typed taxpayer number (wave-6 W2): built here, never printed, so no output of this check holds it.
const TIN = ['1234', '56789'].join('');
const holdsTin = (text) => String(text).indexOf(TIN) >= 0;
/** The scan proven on a planted copy of a file before it is relied on. */
function tinProof(check) {
  const plant = path.join(Lib.OUT, `reverify-planted-${process.pid}.txt`);
  fs.writeFileSync(plant, `planted copy: ${TIN}\n`);
  check('the taxpayer-number scan finds the number in a planted copy of a file', holdsTin(fs.readFileSync(plant, 'utf8')));
  fs.rmSync(plant, { force: true });
}
/** Everything this process prints from now until stop(), which restores the output and resolves to the text. */
function capture() {
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
  return {
    stop: () => {
      process.stdout.write = out;
      process.stderr.write = err;
      return printed;
    }
  };
}

/**
 * The real integration server on a sponsor account (a card on file, the stand-in accreditation provider) wired to a fresh
 * stand-in world, and the console on it at the given size, with a lapsed investor (lapsedInvestor). opts: { view, handlers
 * (frame.js stubServer), card: false (no card on file) }. Resolves to { w, srv, A, p, x, stub, marks, close }.
 */
async function sponsorConsole(S, check, opts) {
  opts = opts || {};
  const w = W.world();
  const srv = await W.startServer(S, w, { dir: Lib.OUT });
  const A = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({ acceptDownloads: true }, F.VIEW[opts.view || 'desktop']) });
  const C = { w, srv, A, p: A.page, marks: [], closers: [() => A.context.close()] };
  C.close = async () => {
    for (const c of C.closers.reverse()) await Promise.resolve().then(c).catch(() => {});
    await srv.close().catch(() => {});
  };
  try {
    C.stub = opts.handlers ? await F.stubServer(A.context, srv.base, opts.handlers) : null;
    C.x = await lapsedInvestor(S, A);
    if (opts.card === false) srv.server.store.put('billing', Object.assign({}, srv.server.store.get('billing', srv.account.id), { card: null, creditCents: 0 }));
    check('the console uses the integration server with the sponsor account\'s token', (await srv.configure(A.page)) === true);
    // At every outside call, how many emails the server holds (the order: the charge, then the request's email).
    w.onCall = (e) => C.marks.push({ kind: e.kind, n: e.n, outbox: srv.server.store.list('outbox').length });
  } catch (e) {
    await C.close();
    throw e;
  }
  return C;
}
/** The account's money as the server holds it: card payments, the balance, the amount owed and every entitlement. */
function money(C) {
  const st = C.srv.server.store;
  const rec = st.get('billing', C.srv.account.id) || {};
  const ents = st.list('entitlements').filter((e) => e.account === C.srv.account.id);
  return { charges: C.w.count('charge'), payments: st.list('payments').length, credit: rec.creditCents || 0, owed: rec.owedCents || 0, entitlements: ents.length, ents: ents.map((e) => ({ key: e.key, tier: e.tier, status: e.status, cents: e.cents })) };
}
/** The dialog's package box as drawn: { present, shown, enabled, checked, label, line, link }. */
const rvBox = (p) =>
  p.evaluate(() => {
    const row = document.getElementById('rv-package-row');
    const input = document.getElementById('rv-package');
    const line = document.getElementById('rv-package-line');
    const vis = (el) => !!(el && !el.hidden && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    return { present: !!input, shown: vis(row), enabled: !!input && !input.disabled, checked: !!input && input.checked, label: ((document.getElementById('rv-package-label') || {}).textContent || '').trim(), line: line && !line.hidden ? line.textContent.trim() : '', link: line && line.querySelector('a') ? line.querySelector('a').getAttribute('href') : '' };
  });
/** "Ask to re-verify" on the investor's row, then the dialog with its box once the server's answer is drawn. */
async function openDialog(p, x, settled, tap) {
  const r = await row(p, x.email);
  const btn = r.locator('[data-action="reverify-request"]');
  if (!(await btn.count())) return null;
  if (tap) await btn.first().tap();
  else await btn.first().click();
  await p.waitForSelector('#dlg[open] [data-action="reverify-send"]', { timeout: 10000 });
  // The box is drawn again when GET /v1/billing answers: wait until it reads as `settled` says (or the time is up).
  if (settled) await p.waitForFunction(settled, null, { timeout: 15000 }).catch(() => {});
  else await p.waitForTimeout(800);
  return rvBox(p);
}
/** "Send request" in the dialog; resolves once the request went to the server (or failed), with the request and its row. */
async function sendRequest(p, x, tick, tap) {
  if (tick) await p.check('#rv-package');
  const before = await p.evaluate((id) => (window.CVPortal.state.ws.invitations || []).filter((y) => y.investorId === id).map((y) => `${y.id}:${y.serverId || ''}:${y.emailStatus}:${y.status}`).join('|'), x.id);
  if (tap) await p.tap('#dlg [data-action="reverify-send"]');
  else await p.click('#dlg [data-action="reverify-send"]');
  await p.waitForFunction(
    ({ id, before }) => {
      const ws = window.CVPortal.state.ws;
      const now = (ws.invitations || []).filter((y) => y.investorId === id).map((y) => `${y.id}:${y.serverId || ''}:${y.emailStatus}:${y.status}`).join('|');
      return now !== before && (ws.invitations || []).filter((y) => y.investorId === id).every((y) => y.serverId || ['failed', 'manual'].indexOf(y.emailStatus) >= 0 || y.status === 'cancelled' || y.emailStatus === 'not_sent');
    },
    { id: x.id, before },
    { timeout: 30000 }
  );
  await p.waitForTimeout(500);
  return p.evaluate((id) => {
    const ws = window.CVPortal.state.ws;
    const d = document.getElementById('dlg');
    return {
      all: (ws.invitations || []).filter((y) => y.investorId === id).map((y) => ({ id: y.id, serverId: y.serverId || '', link: y.link || '', emailStatus: y.emailStatus, emailError: y.emailError || '', status: y.status, reverify: !!y.reverify, existing: !!y.existing, offeringId: y.offeringId || '', pkg: !!y.package })),
      dlg: !!(d && d.open),
      said: d && d.open ? ((d.querySelector('#rv-said') || {}).textContent || '').trim() : '',
      dlgText: d && d.open ? d.innerText : ''
    };
  }, x.id);
}
/** The request's row on the Investors page's invitations list ("All"), as text. */
async function requestRow(p, itId) {
  await Lib.consoleRoute(p, 'console-investors', '.cs-tbl');
  await p.evaluate(() => {
    window.CVPortal.state.ui.inv8Filter = 'all';
    window.CVPortal.app.render();
  });
  await p.waitForTimeout(300);
  return p.locator(`tr[data-invitation="${itId}"]`).innerText().catch(() => '');
}
/** "Verify my accreditation" on the package's step: the stand-in's own page in a new tab, "Continue" there, the tab closed. */
async function accStart(B, ip) {
  const popup = B.context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  await ip.click('#iv-accreditation [data-action=iv-start]');
  const tab = await popup;
  const out = { opened: !!tab, page: '' };
  if (!tab) return out;
  await tab.waitForURL(/\/hosted\/ver_/, { timeout: 15000 }).catch(() => {});
  out.page = tab.url();
  const go = tab.locator('button[type=submit]');
  await go.waitFor({ timeout: 15000 }).catch(() => {});
  if ((await go.count()) && (await go.innerText()).trim() === 'Continue') await Promise.all([tab.waitForNavigation({ timeout: 15000 }).catch(() => {}), go.click()]);
  await tab.close().catch(() => {});
  await ip.waitForTimeout(500);
  return out;
}
/** A text holds none of the package's prices, tier or entitlement words: the words found. */
const priceHits = (text) => PRICE_WORDS.filter((x) => String(text).indexOf(x) >= 0);

/** An element and everything shown inside it, against the window's width; and the page's own width (as package-console.js). */
const fitOf = (p, sel) =>
  p.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const kids = Array.from(el.querySelectorAll('*')).filter((k) => !k.hidden && k.offsetWidth).map((k) => k.getBoundingClientRect());
    return { width: innerWidth, left: Math.round(Math.min(r.left, ...kids.map((k) => k.left))), right: Math.round(Math.max(r.right, ...kids.map((k) => k.right))), page: document.documentElement.scrollWidth };
  }, sel);
const fits = (f) => !!f && f.left >= 0 && f.right <= f.width && f.page <= f.width + 1;
/** The first element matching sel brought into view: is all of it inside the window? */
async function onScreen(p, sel) {
  const l = p.locator(sel).first();
  if (!(await l.count())) return { ok: false, why: 'not there' };
  await l.scrollIntoViewIfNeeded().catch(() => {});
  const r = await l.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom), w: innerWidth, h: innerHeight, shown: !!(el.offsetWidth || el.offsetHeight) };
  });
  return Object.assign({ ok: r.shown && r.left >= 0 && r.right <= r.w && r.top >= 0 && r.bottom <= r.h }, r);
}
/** The investor (signed in to the portal) on the offering's subscribe screen: what it shows and offers. */
async function subscribePage(p, x) {
  await p.evaluate((id) => (window.CVPortal.state.viewer = id), x.id);
  if ((await p.evaluate(() => window.CVPortal.state.role)) !== 'investor') {
    await p.selectOption('#demo-role', 'investor');
    await p.waitForFunction(() => location.hash === '#overview', null, { timeout: 10000 }).catch(() => {});
  }
  await p.evaluate((hash) => (location.hash = hash), `subscribe-${x.offeringId}`);
  await p.waitForSelector('.done-box', { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(400);
  return p.evaluate(
    ({ id, off }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const inv = ws.investors.find((y) => y.id === id);
      const o = ws.offerings.find((y) => y.id === off);
      const gate = NS.integrations.subscribeGate(ws, inv, o) || {};
      const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
      const ban = Array.from(document.querySelectorAll('.iv-banner')).find(vis) || null;
      const it = (ws.invitations || []).filter((y) => y.investorId === id && y.reverify && ['completed', 'cancelled'].indexOf(y.status) < 0).pop();
      const btns = Array.from(document.querySelectorAll('button, a.btn')).filter(vis).map((b) => b.textContent.trim());
      return {
        text: document.body.innerText,
        hash: location.hash,
        reason: gate.reason || '',
        banner: ban ? ban.innerText.replace(/\s+/g, ' ').trim() : '',
        links: ban ? Array.from(ban.querySelectorAll('a')).map((a) => ({ label: a.textContent.trim(), href: a.getAttribute('href') })) : [],
        buttons: ban ? Array.from(ban.querySelectorAll('button')).map((b) => b.textContent.trim()) : [],
        sign: btns.filter((t) => t === 'Sign subscription documents').length,
        typed: document.querySelectorAll('[data-form="sub-submit"]').length,
        cont: btns.filter((t) => t === 'Continue your subscription').length,
        ask: NS.inviteFlow.reverifyAsk(inv),
        askId: it ? it.id : '',
        short: ws.tenant.shortName
      };
    },
    { id: x.id, off: x.offeringId }
  );
}
/**
 * The owner's preview: the sample portal in a sandboxed frame with every connection refused and no server, at one size;
 * a Rule 506(c) offering raising and an active investor whose verification by the firm's own (simulated) connection lapsed
 * yesterday. The dialog, the sponsor's own email, the subscribe screen's offer and the request's two steps.
 */
async function preview(check, S, view) {
  const tap = view === 'phone';
  const press = (fr, sel) => (tap ? fr.tap(sel) : fr.click(sel));
  const { A, fr } = await F.framed(S, view);
  const seen = [];
  try {
    const size = A.page.viewportSize();
    check(`the window is ${F.VIEW[view].viewport.width}x${F.VIEW[view].viewport.height}${tap ? ' with touch' : ''}`, size.width === F.VIEW[view].viewport.width && size.height === F.VIEW[view].viewport.height && (await fr.evaluate(() => navigator.maxTouchPoints > 0)) === tap, size);
    await F.proveRefused(check, A, fr);
    await fr.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
    await fr.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
    await fr.waitForFunction(() => window.CVPortal && window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
    check('no integration server is connected', (await fr.evaluate(() => window.CVPortal.invitations.serverOn(window.CVPortal.state.ws))) === false);
    const x = await fr.evaluate((DAY) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      let o = ws.offerings.find((y) => y.status === 'Raising');
      if (!o) {
        o = ws.offerings[0];
        o.status = 'Raising';
      }
      o.structure = Object.assign({}, o.structure, { exemption: 'Rule 506(c)' });
      const c = NS.integrations.ensure(ws);
      c.configured = true;
      c.use.accreditation = ['sandbox'];
      c.rules.accreditationFor = '506c';
      c.rules.validDays = 90;
      const a = ws.investors.find((y) => y.onboarding && y.onboarding.status === 'complete' && y.type === 'individual' && y.email);
      const t = Date.now();
      const day = (n) => new Date(t + n * DAY).toISOString().slice(0, 10);
      const at = (n) => new Date(t + n * DAY).toISOString().replace(/\.\d{3}Z$/, 'Z');
      a.verify = {
        identity: { status: 'passed', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', completedAt: at(-120) },
        aml: { status: 'clear', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', completedAt: at(-120), screenedAt: day(-1) },
        accreditation: { status: 'verified', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', method: 'Net worth over $1 million, excluding primary residence', completedAt: at(-91), verifiedAt: day(-91), expiresAt: day(-1) },
        decision: { status: 'approved', at: at(-120), by: 'Automatic' }
      };
      a.accreditation = Object.assign({}, a.accreditation, { basis: 'Net worth over $1 million, excluding primary residence', date: day(-91), verifiedBy: 'Sandbox', expires: day(-1) });
      ws.invitations = (ws.invitations || []).filter((y) => y.investorId !== a.id);
      NS.integrations.syncKyc(ws, a);
      NS.app.save(true);
      return { id: a.id, email: a.email, contact: a.contact, firm: ws.tenant.name, offeringId: o.id };
    }, DAY);

    // The dialog: the box switched off with package.js's own no-server line.
    const r = await row(fr, x.email);
    const btn = r.locator('[data-action="reverify-request"]');
    check('the investor\'s row offers "Ask to re-verify"', (await btn.count()) === 1);
    if (!(await btn.count())) return;
    if (tap) await btn.first().tap();
    else await btn.first().click();
    await fr.waitForSelector('#dlg[open] [data-action="reverify-send"]', { timeout: 10000 });
    await fr.waitForTimeout(400);
    let b = await rvBox(fr);
    check(`the dialog's box shown, switched off, "${PKG_LABEL}", with the one line "${NO_SERVER_LINE}"`, b.shown && !b.enabled && !b.checked && b.label === PKG_LABEL && b.line === NO_SERVER_LINE, b);
    await fr.evaluate(() => document.getElementById('rv-package').click());
    b = await rvBox(fr);
    check('it cannot be ticked', b.checked === false && b.enabled === false, b);
    if (tap) {
      const fit = await fitOf(fr, '#dlg');
      check('the dialog and its box fit the width', fits(fit), fit);
    }
    await A.page.screenshot({ path: path.join(SHOTS, `preview-${view}-dialog.png`) });
    seen.push(await F.noRawError(check, fr, 'the dialog'));

    // "Send request" prepares the sponsor's own email with the link.
    await press(fr, '#dlg [data-action="reverify-send"]');
    await fr.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 }).catch(() => {});
    const mail = await fr.evaluate(() => ({ link: (document.getElementById('inv8-link') || {}).value || '', heading: ((document.querySelector('#dlg .dlg-head h2') || {}).textContent || '').trim() }));
    const it = await fr.evaluate((id) => (window.CVPortal.state.ws.invitations || []).filter((y) => y.investorId === id).map((y) => ({ id: y.id, reverify: !!y.reverify, emailStatus: y.emailStatus, pkg: !!y.package })), x.id);
    check('"Send request" prepares the sponsor\'s own email with the link, and the request holds no package', mail.heading === 'Re-verification request email' && /#invite-[\w-]{20,}$/.test(mail.link) && it.length === 1 && it[0].reverify && it[0].emailStatus === 'manual' && !it[0].pkg, { heading: mail.heading, it });
    seen.push(await F.noRawError(check, fr, 'the email dialog'));
    await press(fr, '#dlg .dlg-head [data-action="close-dialog"]');
    await fr.waitForTimeout(300);

    // The investor's subscribe screen offers the request; its two steps run with the firm's own connection.
    const v = await subscribePage(fr, x);
    check('the subscribe screen offers "Verify your accreditation", leading to the request', v.links.length === 1 && v.links[0].label === 'Verify your accreditation' && v.links[0].href === v.ask && v.banner.indexOf(v.reason) >= 0, v);
    if (tap) {
      const fit = await fitOf(fr, '.iv-banner');
      check('the subscribe banner fits the width', fits(fit), fit);
    }
    await A.page.screenshot({ path: path.join(SHOTS, `preview-${view}-subscribe.png`) });
    seen.push(v.text);
    if (v.links.length !== 1) return;
    await press(fr, '.iv-banner a');
    await fr.waitForSelector('.ivf-form', { timeout: 20000 });
    await fr.waitForTimeout(300);
    const s = await flowState(fr, v.askId);
    check('the link has two steps (accreditation, done)', /^Step 1 of 2/.test(s.count) && JSON.stringify(s.steps) === JSON.stringify(['accreditation', 'done']), { count: s.count, steps: s.steps });
    await press(fr, '.ivf-form [data-action="iv-start"][data-kind="accreditation"]');
    await fr.waitForSelector('#dlg[open] [data-action="iv-sandbox-finish"]', { timeout: 10000 });
    await press(fr, '#dlg [data-action="iv-sandbox-finish"]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 });
    if (await fr.locator('#ob-accAttest').count()) await fr.check('#ob-accAttest');
    await press(fr, '.ivf-form button[type=submit]');
    await fr.waitForSelector('.ivf-done', { timeout: 20000 });
    const done = await fr.locator('.ivf-done').innerText();
    check('the investor verifies with the firm\'s own connection and finishes', new RegExp(`${x.firm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} will see the result`).test(done), done);
    seen.push(done, await F.noRawError(check, fr, 'the request\'s done screen'));
    check('nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
    F.leakFree(check, 'every screen of this part', seen.join('\n'));
  } finally {
    await A.context.close().catch(() => {});
  }
}

/**
 * Plan 08-20 (G6), part server: the dialog's box in every state the invite form's box has, on a sponsor account of the real
 * server (a card on file), and every refusal of the re-verification request shown as the real server sends it. Every
 * sentence asserted is read in this run from the real server's reply or from package.js, never typed here.
 */
async function g6(check, S) {
  tinProof(check);
  const cap = capture();
  let mode = 'real';
  const replies = [];
  let lost = null;
  let prepaid = null;
  const C = await sponsorConsole(S, check, {
    view: 'desktop',
    handlers: {
      'GET /v1/billing': () => (mode === 'unreachable' ? { refuse: true } : null),
      'POST /v1/invitations': async (req) => {
        if (mode === 'lost') {
          // The request reaches the real server (stored and paid), but the console hears a refused connection.
          mode = 'real';
          const r = await ownFetch(`${C.srv.base}/v1/invitations`, { method: 'POST', headers: { Authorization: req.auth, 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) });
          lost = { status: r.status, body: await r.json().catch(() => null) };
          return { refuse: true };
        }
        if (mode === 'tier') {
          // The request's own id is paid at the identity tier first (the account's token), then the real server answers.
          mode = 'real';
          const key = req.body && req.body.invitation && req.body.invitation.clientId;
          prepaid = key ? await C.srv.call('POST', '/v1/billing/entitlements', { items: [{ key, tier: 'identity' }] }, C.srv.token) : { status: 0 };
          prepaid.money = money(C);
        }
        return { amend: (json, status) => (replies.push({ status, json }), json) };
      }
    }
  });
  const seen = [];
  const plainOn = (label, text) => {
    const hits = (String(text).match(/\b[45]\d\d\b|answered/g) || []).concat(F.vendorScan(text).hits);
    check(`${label}: no status number, "answered" or vendor word in the dialog`, hits.length === 0, hits);
  };
  const reread = (p) => p.evaluate(() => window.CVPortal.pkg.load(window.CVPortal.state.ws, true));
  const closeDlg = async (p) => {
    if (await p.evaluate(() => !!(document.getElementById('dlg') || {}).open)) await p.click('#dlg .dlg-head [data-action="close-dialog"]');
  };
  // The request closed in the console between states, so the next "Ask to re-verify" makes a new one.
  const closeOpen = (p, id) =>
    p.evaluate((id) => {
      (window.CVPortal.state.ws.invitations || []).forEach((y) => y.investorId === id && y.reverify && ['completed', 'cancelled'].indexOf(y.status) < 0 && (y.status = 'cancelled'));
      window.CVPortal.app.save(true);
      window.CVPortal.app.render();
    }, id);
  const settledLine = () => {
    const l = document.getElementById('rv-package-line');
    return !!l && !l.hidden && l.textContent.trim().length > 0;
  };
  try {
    const { p, srv, x } = C;
    const bill = await srv.call('GET', '/v1/billing', undefined, srv.token);
    const LABEL = `${PKG_LABEL} (${priceText(Number(bill.body.prices.reverify))})`;
    const st = srv.server.store;
    const billing = (patch) => st.put('billing', Object.assign({}, st.get('billing', srv.account.id), patch));
    const card = (st.get('billing', srv.account.id) || {}).card;

    // Unreachable: the box switched off with package.js's own line.
    mode = 'unreachable';
    await reread(p);
    let b = await openDialog(p, x, settledLine);
    check(`unreachable: the box shown switched off, unticked, with "${UNREACHABLE_LINE}"`, !!b && b.shown && !b.enabled && !b.checked && b.line === UNREACHABLE_LINE, b);
    seen.push(await p.locator('#dlg').innerText());
    await closeDlg(p);
    mode = 'real';

    // No card (and no balance): the line and its link to the Integrations page for an admin; the line alone for a team member.
    billing({ card: null, creditCents: 0 });
    await reread(p);
    b = await openDialog(p, x, settledLine);
    check(`no card: the box shown switched off with "${NO_CARD_LINE}" leading to the Integrations page (an admin)`, !!b && b.shown && !b.enabled && b.label === LABEL && b.line === NO_CARD_LINE && b.link === '#console-integrations', b);
    seen.push(await p.locator('#dlg').innerText());
    await closeDlg(p);
    await p.evaluate(() => {
      const app = window.CVPortal.app;
      app.__can = app.can;
      app.can = (what, role) => (what === 'configure' ? false : app.__can(what, role));
    });
    b = await openDialog(p, x, settledLine);
    check('no card: for someone who cannot open Integrations, the same line with no link', !!b && b.shown && !b.enabled && b.line === NO_CARD_LINE && b.link === '', b);
    await closeDlg(p);
    await p.evaluate(() => {
      const app = window.CVPortal.app;
      app.can = app.__can;
    });
    billing({ card });

    // An amount owed: switched off with the real server's credit_owed sentence; "Send request" sends without the package.
    billing({ owedCents: 1900 });
    const probe = await srv.call('POST', '/v1/invitations', { workspace: 'kestrel-bay', portalUrl: `${S.origin}/diy.html`, sendEmail: false, firm: { name: 'Kestrel Bay Capital' }, investor: { id: 'OWED-PROBE', contact: 'Owed Probe', email: 'owed.probe@example.com' }, invitation: { package: true, clientId: 'owed-probe-1' }, verification: {} }, srv.token);
    const OWED = probe.body && typeof probe.body.error === 'string' ? probe.body.error : '';
    check('the real server refuses a package for this account with 409 credit_owed and a sentence of its own (a direct POST)', probe.status === 409 && probe.body.code === 'credit_owed' && OWED.length > 10, probe.body);
    await reread(p);
    b = await openDialog(p, x, settledLine);
    check('an amount owed: the box shown switched off, unticked, with the server\'s price and exactly its credit_owed sentence', !!b && b.shown && !b.enabled && !b.checked && b.label === LABEL && !!OWED && b.line === OWED, { b, OWED });
    seen.push(await p.locator('#dlg').innerText());
    plainOn('an amount owed', await p.locator('#dlg').innerText());
    let m0 = money(C);
    let sent = await sendRequest(p, x, false);
    let it = sent.all.filter((y) => y.reverify && y.status !== 'cancelled').pop() || {};
    let rec = it.serverId ? st.get('invitations', it.serverId) : null;
    check('an amount owed: "Send request" still sends the request, without the package; the server holds it with none', /^ivt_/.test(it.serverId || '') && !it.pkg && !!rec && !rec.package && sent.dlg === false, { it, pkg: rec && rec.package });
    let m1 = money(C);
    check('an amount owed: nothing was charged', JSON.stringify(m1) === JSON.stringify(m0), { m0, m1 });
    await closeOpen(p, x.id);
    billing({ owedCents: 0 });
    await reread(p);

    // tier_mismatch: the request's own id was paid at the identity tier; the sponsor sends it with the box ticked.
    mode = 'tier';
    b = await openDialog(p, x, () => {
      const i = document.getElementById('rv-package');
      return !!i && !i.disabled;
    });
    check('nothing owed and a card on file: the box is switched on again after the next read', !!b && b.shown && b.enabled && b.label === LABEL && b.line === '', b);
    replies.length = 0;
    sent = await sendRequest(p, x, true);
    let said = replies[0] || null;
    let SENT = said && said.json && typeof said.json.error === 'string' ? said.json.error : '';
    check('tier_mismatch: the request\'s id was paid at the identity tier first, then the real server answered 409 tier_mismatch with a sentence of its own', !!prepaid && prepaid.status === 200 && !!said && said.status === 409 && said.json.code === 'tier_mismatch' && SENT.length > 10, { prepaid: prepaid && prepaid.status, said });
    check('tier_mismatch: the dialog shows the server\'s sentence word for word, alone', sent.dlg && !!SENT && sent.said === SENT, { said: sent.said, SENT });
    plainOn('tier_mismatch', sent.dlgText);
    seen.push(sent.dlgText);
    it = sent.all.filter((y) => y.reverify && y.status !== 'cancelled').pop() || {};
    const tierRow = await requestRow(p, it.id);
    check('tier_mismatch: the request\'s row shows the server\'s sentence word for word and reads "Not sent yet"', !!SENT && tierRow.indexOf(SENT) >= 0 && /Not sent yet/.test(tierRow), tierRow);
    m1 = money(C);
    check('tier_mismatch: nothing was charged by the refused send (no new payment, no new entitlement)', !!prepaid.money && m1.charges === prepaid.money.charges && m1.payments === prepaid.money.payments && m1.entitlements === prepaid.money.entitlements && m1.credit === prepaid.money.credit, { before: prepaid.money, after: m1 });
    check('tier_mismatch: the request is not replaced (one open request, not sent)', sent.all.filter((y) => y.reverify && y.status !== 'cancelled').length === 1 && !it.serverId, sent.all);
    await closeDlg(p);
    await closeOpen(p, x.id);

    // package_used: the request reached the server with its package (the console heard a refused connection); the package's
    // check started and the server's request ended; the sponsor sends it again.
    mode = 'lost';
    b = await openDialog(p, x, () => {
      const i = document.getElementById('rv-package');
      return !!i && !i.disabled;
    });
    sent = await sendRequest(p, x, true);
    const one = sent.all.filter((y) => y.reverify && y.status !== 'cancelled').pop() || {};
    const sid = lost && lost.body && lost.body.id;
    rec = sid ? st.get('invitations', sid) : null;
    check('package_used: the first send reached the real server, stored at tier reverify and paid; the console heard a refused connection', !!lost && lost.status === 200 && !!rec && !!rec.package && rec.package.tier === 'reverify' && rec.package.key === one.id && !one.serverId && one.pkg, { lost: lost && lost.status, pkg: rec && rec.package, one });
    seen.push(sent.dlgText);
    await closeDlg(p);
    if (rec && rec.package) st.put('entitlements', Object.assign({}, st.get('entitlements', rec.package.entitlement), { startedAt: new Date().toISOString() }));
    const cancel = sid ? await srv.call('POST', `/v1/invitations/${encodeURIComponent(sid)}/cancel`, {}, srv.token) : { status: 0 };
    check('package_used: the package\'s check is started and the server\'s request cancelled (the account\'s token)', cancel.status === 200 && (st.get('invitations', sid) || {}).status === 'cancelled', cancel.status);
    m0 = money(C);
    replies.length = 0;
    b = await openDialog(p, x);
    sent = await sendRequest(p, x, false);
    said = replies[0] || null;
    SENT = said && said.json && typeof said.json.error === 'string' ? said.json.error : '';
    check('package_used: sent again, the real server answered 409 package_used with a sentence of its own', !!said && said.status === 409 && said.json.code === 'package_used' && SENT.length > 10, said);
    check('package_used: the dialog shows the server\'s sentence word for word, alone', sent.dlg && !!SENT && sent.said === SENT, { said: sent.said, SENT });
    plainOn('package_used', sent.dlgText);
    seen.push(sent.dlgText);
    const old = sent.all.find((y) => y.id === one.id) || {};
    const fresh = sent.all.filter((y) => y.id !== one.id && y.reverify && y.status !== 'cancelled');
    const nu = fresh[0] || {};
    check('package_used: the old request is closed in the console', old.status === 'cancelled', old);
    check('package_used: one new request for the same investor with a different id, still a re-verification (reverify, on file, no offering), with the package choice, not sent', fresh.length === 1 && !!nu.id && nu.id !== one.id && nu.reverify && nu.existing && !nu.offeringId && nu.pkg && !nu.serverId && nu.emailStatus === 'not_sent', { one: one.id, fresh });
    m1 = money(C);
    check('package_used: nothing was charged (no new payment, no new entitlement)', m1.charges === m0.charges && m1.payments === m0.payments && m1.entitlements === m0.entitlements && m1.credit === m0.credit, { m0, m1 });
    const oldRow = await requestRow(p, one.id);
    check('package_used: on "All", the old request\'s row shows the server\'s sentence word for word', !!SENT && oldRow.indexOf(SENT) >= 0, oldRow);
    seen.push(oldRow, await F.noRawError(check, p, 'the console after the refusals', C.A.errors));
    check('no call left this machine outside the stand-in world', outside.length === 0 && C.w.count('other') === 0, { outside, other: C.w.calls.filter((c) => c.kind === 'other') });
    F.leakFree(check, 'every dialog and row of the G6 states', seen.join('\n'));
    const printed = cap.stop();
    check('the typed taxpayer number is in no world record, server output or screen of the G6 states', !holdsTin(JSON.stringify(C.w.calls)) && !holdsTin(JSON.stringify({ i: st.list('invitations'), e: st.list('events') })) && !holdsTin(printed) && !holdsTin(seen.join('\n')));
  } finally {
    cap.stop();
    await C.close();
  }
}

const parts = {
  async local({ check, S }) {
    const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
    const p = A.page;
    const seen = [];
    try {
      const x = await lapsedInvestor(S, A);
      check('the investor\'s verification by a third party lapsed yesterday and their Rule 506(c) subscription is pending', x.until === iso(Date.now() - DAY) && !!x.reqId, x);

      // Before: the sponsor's Approve is refused with the existing sentence.
      const before = await approve(p, x.reqId);
      check(`before: Approve is refused with the existing "expired" sentence ("${LAPSED} ...")`, before.toast.indexOf(LAPSED) >= 0 && /Rule 506\(c\) offerings need a current verification/.test(before.toast) && before.status === 'pending', before);

      // The Investors row offers "Ask to re-verify"; its dialog.
      const r = await row(p, x.email);
      const btn = r.locator('[data-action="reverify-request"]');
      const label = (await btn.count()) ? (await btn.first().innerText()).trim() : '(no button)';
      check('the investor\'s row offers "Ask to re-verify"', label === 'Ask to re-verify', label);
      await p.screenshot({ path: path.join(SHOTS, 'local-button.png') });
      if (label !== 'Ask to re-verify') return;
      await btn.first().click();
      await p.waitForSelector('#dlg[open]', { timeout: 10000 });
      const dlg = await p.evaluate(() => {
        const d = document.getElementById('dlg');
        const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
        return { text: d.innerText, send: Array.from(d.querySelectorAll('button')).filter((b) => vis(b) && b.innerText.trim() === 'Send request').length, close: vis(d.querySelector('.dlg-head [data-action="close-dialog"]')) };
      });
      check('the dialog names the investor and holds one "Send request" button and a close control', dlg.text.indexOf(x.contact) >= 0 && dlg.send === 1 && dlg.close === true, dlg);
      await p.screenshot({ path: path.join(SHOTS, 'local-dialog.png') });
      seen.push(dlg.text);

      // Sending prepares the sponsor's email with the link (no server: the sponsor sends it from their own email app).
      await p.click('#dlg [data-action="reverify-send"]');
      await p.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 });
      const mail = await p.evaluate(() => ({ link: (document.getElementById('inv8-link') || {}).value || '', subject: (document.querySelector('#dlg .inv8-subject') || {}).innerText || '', text: document.getElementById('dlg').innerText }));
      check('sending prepares the sponsor\'s email with the investor\'s link', /#invite-[\w-]{20,}$/.test(mail.link) && mail.subject === `${x.firm}: verify your accredited investor status` && /verify your accredited investor status again/.test(mail.text), { link: mail.link.replace(/invite-.*/, 'invite-…'), subject: mail.subject });
      await p.screenshot({ path: path.join(SHOTS, 'local-email.png') });
      seen.push(mail.text);
      await p.click('#dlg .dlg-head [data-action="close-dialog"]');
      const asked = await entries(p, x.id, 'Accreditation re-verification requested');
      check('one change-log entry "Accreditation re-verification requested"', asked.length === 1, asked);
      const it = await p.evaluate((id) => (window.CVPortal.state.ws.invitations || []).filter((y) => y.investorId === id).map((y) => ({ id: y.id, reverify: !!y.reverify, existing: !!y.existing, offeringId: y.offeringId, token: !!y.token })), x.id);
      check('one invitation for the investor on file, marked reverify, with no offering', it.length === 1 && it[0].reverify && it[0].existing && !it[0].offeringId && it[0].token, it);
      if (!it.length || !mail.link) return;

      // The link: two steps, the request's own line.
      await p.evaluate((h) => (location.hash = h), mail.link.slice(mail.link.indexOf('#')));
      await p.waitForSelector('.ivf-form', { timeout: 20000 });
      await p.waitForTimeout(300);
      const s1 = await flowState(p, it[0].id);
      check('the link\'s flow has exactly two steps: accreditation, then done', JSON.stringify(s1.steps) === JSON.stringify(['accreditation', 'done']) && /^Step 1 of 2/.test(s1.count), { steps: s1.steps, count: s1.count });
      check('no login, profile, identity, tax or payment step and no field of theirs on screen', !/password|ob-tin|ob-street|ob-routing|ob-account/i.test(s1.inputs.join(' ')) && !/Create your login|Investor information|Identity verification|Tax certification|Distribution/i.test(s1.list.join(' ') + ' ' + s1.count), s1);
      const LINE = `${x.firm} asked you to verify your accredited investor status again; this link covers that step only.`;
      check(`the request's own line: "${LINE}"`, s1.text.indexOf(LINE) >= 0, s1.text.slice(0, 600));
      await p.screenshot({ path: path.join(SHOTS, 'local-link.png') });
      seen.push(s1.text);

      // The investor verifies through the firm's own connection (simulated), then finishes.
      await p.click('.ivf-form [data-action="iv-start"][data-kind="accreditation"]');
      await p.waitForSelector('#dlg[open] [data-action="iv-sandbox-finish"]', { timeout: 10000 });
      seen.push(await p.locator('#dlg').innerText());
      await p.click('#dlg [data-action="iv-sandbox-finish"]');
      await p.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 });
      if (await p.locator('#ob-accAttest').count()) await p.check('#ob-accAttest');
      await p.click('.ivf-form button[type=submit]');
      await p.waitForSelector('.ivf-done', { timeout: 20000 });
      const done = await p.locator('.ivf-done').innerText();
      check('the done screen says the firm will see the result', new RegExp(`${x.firm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} will see the result`).test(done), done);
      await p.screenshot({ path: path.join(SHOTS, 'local-done.png') });
      seen.push(done);

      // The simulated check answers a moment after it starts (a real provider may take days): the console reads the result
      // once it is in, on the Investors page.
      await p.waitForFunction((id) => { const NS = window.CVPortal; return NS.integrations.peek(NS.state.ws.investors.find((y) => y.id === id)).accreditation.status === 'verified'; }, x.id, { timeout: 15000 });
      await row(p, x.email);

      // The console: the new verification with its valid-until date; the two entries.
      const want = iso(Date.now() + 90 * DAY);
      await Lib.consoleRoute(p, 'console-kyc', '[data-action=kyc-tab]');
      await p.click('[data-action=kyc-tab][data-t=all]');
      await p.evaluate((id) => {
        window.CVPortal.state.ui.kycOpen = id;
        window.CVPortal.app.render();
      }, x.id);
      await p.waitForTimeout(300);
      const kyc = await p.evaluate(({ id, want }) => {
        const NS = window.CVPortal;
        const inv = NS.state.ws.investors.find((y) => y.id === id);
        const a = NS.integrations.peek(inv).accreditation;
        return { text: document.body.innerText, expiresAt: a.expiresAt, status: a.status, shown: NS.ui.date(want) };
      }, { id: x.id, want });
      const line = kyc.text.split('\n').find((l) => /^Accreditation: verified/.test(l.trim())) || '';
      if (!line) console.log('NOTE kyc text: ' + kyc.text.replace(/\s+/g, ' ').slice(0, 1500));
      check(`the console shows the accreditation verified, valid until ${want} (the firm's 90 days)`, kyc.status === 'verified' && kyc.expiresAt === want && line.indexOf(`valid until ${kyc.shown}`) >= 0, { line, expiresAt: kyc.expiresAt });
      seen.push(line);
      const asked2 = await entries(p, x.id, 'Accreditation re-verification requested');
      const done2 = await entries(p, x.id, 'Accreditation re-verified');
      const why = await p.evaluate(({ id, itId }) => {
        const ws = window.CVPortal.state.ws;
        const it = (ws.invitations || []).find((y) => y.id === itId) || {};
        return { actions: (ws.audit || []).filter((e) => e.record === id).map((e) => e.action), it: { status: it.status, sentAt: it.sentAt, completedAt: it.completedAt }, acc: window.CVPortal.integrations.peek(ws.investors.find((y) => y.id === id)).accreditation };
      }, { id: x.id, itId: it[0].id });
      check('one "Accreditation re-verification requested" and one "Accreditation re-verified" in the change log', asked2.length === 1 && done2.length === 1, { asked2, done2, why });

      // After: Approve is allowed (no override, no second click).
      const after = await approve(p, x.reqId);
      check('after: Approve is allowed, without the override', /^Subscription approved/.test(after.toast) && after.status !== 'pending' && after.overridden === 0, after);
      seen.push(await F.noRawError(check, p, 'the console after the re-verification', A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await A.context.close().catch(() => {});
    }
  },

  async server({ check, S }) {
    // Lib.walk's typed taxpayer number (wave-6 W2): never typed here, and the scan below proves it reaches nothing. It is
    // built here, never printed, so no output file of this check holds it either.
    const TIN = ['1234', '56789'].join('');
    const scan = (label, text) => check(`${label}: holds no copy of the taxpayer number Lib.walk types`, String(text).indexOf(TIN) < 0);
    const planted = JSON.stringify({ calls: [{ at: 'x', kind: 'accreditation' }], typed: TIN });
    check('the taxpayer-number scan fails on a planted copy (proven before it is relied on)', planted.indexOf(TIN) >= 0);
    const srv = await Lib.serverPortal(S, {});
    const A = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
    const p = A.page;
    const closers = [() => A.context.close(), () => srv.close()];
    const seen = [];
    const posts = [];
    p.on('request', (rq) => rq.method() === 'POST' && /\/v1\/invitations$/.test(rq.url().replace(/[?#].*$/, '')) && posts.push(rq.url()));
    try {
      const x = await lapsedInvestor(S, A);
      const on = await srv.configure(p);
      check('the console uses the integration server in this process', on === true);

      // The sponsor asks: the real server stores the request and emails it (the outbox: no mail settings here).
      const r = await row(p, x.email);
      const btn = r.locator('[data-action="reverify-request"]');
      check('the investor\'s row offers "Ask to re-verify"', (await btn.count()) === 1);
      if (!(await btn.count())) return;
      await btn.first().click();
      await p.waitForSelector('#dlg[open] [data-action="reverify-send"]', { timeout: 10000 });
      // Plan 08-20 (G6): the shared token is not a sponsor account's: the box switched off with the server's own sentence.
      const acct = await srv.call('GET', '/v1/billing');
      const ACCOUNT_REQUIRED = acct.body && typeof acct.body.error === 'string' ? acct.body.error : '';
      check('the shared token: GET /v1/billing answers 403 account_required with a sentence of its own', acct.status === 403 && acct.body.code === 'account_required' && ACCOUNT_REQUIRED.length > 10, acct.body);
      await p.waitForFunction(() => {
        const l = document.getElementById('rv-package-line');
        return !!l && !l.hidden && l.textContent.trim().length > 0;
      }, null, { timeout: 15000 }).catch(() => {});
      const sb = await rvBox(p);
      check('the shared token: the dialog\'s box shown switched off, unticked, with exactly the server\'s account_required sentence', sb.shown && !sb.enabled && !sb.checked && !!ACCOUNT_REQUIRED && sb.line === ACCOUNT_REQUIRED, { sb, ACCOUNT_REQUIRED });
      seen.push(await p.locator('#dlg').innerText());
      await p.click('#dlg [data-action="reverify-send"]');
      await p.waitForFunction((id) => {
        const it = (window.CVPortal.state.ws.invitations || []).filter((y) => y.investorId === id).pop();
        return !!(it && (it.serverId || it.emailStatus === 'failed'));
      }, x.id, { timeout: 30000 });
      const it = await p.evaluate((id) => {
        const ws = window.CVPortal.state.ws;
        const y = (ws.invitations || []).filter((z) => z.investorId === id).pop();
        return { id: y.id, serverId: y.serverId, link: y.link, emailStatus: y.emailStatus, reverify: !!y.reverify, dlg: document.getElementById('dlg').open };
      }, x.id);
      check('"Send request" sends the request to the integration server, which keeps it in its outbox; the dialog closes', /^ivt_/.test(it.serverId) && it.emailStatus === 'outbox' && it.reverify && it.dlg === false && it.link.indexOf(`server=${encodeURIComponent(srv.base)}`) > 0, it);
      const toast = await toastLike(p, 'Re-verification request');
      check('the sponsor is told where the request went', /^Re-verification request for .* saved in the integration server outbox/.test(toast), toast);
      seen.push(toast);
      const rec = it.serverId ? srv.server.store.get('invitations', it.serverId) : null;
      const snap = rec ? srv.server.invitations.vault.open(rec.snapshot, `${rec.id}:snapshot`) : null;
      check('the server stored the request: an investor on file, no offering, marked reverify', !!snap && snap.invitation.reverify === true && snap.invitation.existing === true && snap.offering === null, snap && snap.invitation);
      const mail = it.serverId ? ((await srv.call('GET', `/v1/outbox?invitation=${encodeURIComponent(it.serverId)}`)).body.messages || []) : [];
      check('the server\'s email asks the investor to verify their accredited investor status again', mail.length === 1 && mail[0].subject === `${x.firm}: verify your accredited investor status` && /verify your accredited investor status again/.test(mail[0].text), mail.map((m) => m.subject));
      seen.push(mail.map((m) => `${m.subject}\n${m.text}`).join('\n'));
      if (!it.serverId) return;

      // The investor's own device: the link holds the accreditation step and the done screen.
      const B = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({}, F.VIEW.desktop) });
      closers.unshift(() => B.context.close());
      const ip = B.page;
      let sent = '';
      ip.on('request', (rq) => rq.method() === 'POST' && /\/v1\/invite\/complete$/.test(rq.url()) && (sent = rq.postData() || ''));
      await ip.goto(it.link);
      await ip.waitForSelector('.ivf-form', { timeout: 30000 });
      await ip.waitForTimeout(300);
      const s1 = await ip.evaluate(() => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        return { count: (document.querySelector('.ivf-progress .ob-count') || {}).innerText || '', steps: NS.inviteFlow.steps(ws, ws.invitations[0]), text: document.querySelector('.ivf-form').innerText.replace(/\s+/g, ' ') };
      });
      const LINE = `${x.firm} asked you to verify your accredited investor status again; this link covers that step only.`;
      check('the investor\'s device opens on step 1 of 2; the steps are accreditation and done; the request\'s own line', /^Step 1 of 2/.test(s1.count) && JSON.stringify(s1.steps) === JSON.stringify(['accreditation', 'done']) && s1.text.indexOf(LINE) >= 0, { count: s1.count, steps: s1.steps });
      await ip.screenshot({ path: path.join(SHOTS, 'server-link.png') });
      seen.push(s1.text);
      if (JSON.stringify(s1.steps) !== JSON.stringify(['accreditation', 'done'])) return;
      await ip.click('.ivf-form [data-action="iv-start"][data-kind="accreditation"]');
      await ip.waitForSelector('#dlg[open] [data-action="iv-sandbox-finish"]', { timeout: 10000 });
      await ip.click('#dlg [data-action="iv-sandbox-finish"]');
      await ip.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 });
      await ip.waitForFunction(() => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const inv = ws.investors.find((y) => y.id === ws.invitations[0].investorId);
        return NS.integrations.peek(inv).accreditation.status === 'verified';
      }, null, { timeout: 15000 });
      if (await ip.locator('#ob-accAttest').count()) await ip.check('#ob-accAttest');
      await ip.click('.ivf-form button[type=submit]');
      await ip.waitForSelector('.ivf-done', { timeout: 30000 });
      const done = await ip.locator('.ivf-done').innerText();
      check('the investor\'s done screen: verified, and the firm will see the result', /Your accreditation is verified/.test(done) && done.indexOf(`${x.firm} will see the result`) >= 0, done);
      seen.push(done, await F.noRawError(check, ip, 'the investor\'s device', B.errors));
      const body = sent ? JSON.parse(sent) : {};
      check('the device sent the accreditation result only: no subscription, agreement or tax form', !!body.investor && !body.request && !body.envelope && !body.taxEnvelope, { request: !!body.request, envelope: !!body.envelope, taxEnvelope: !!body.taxEnvelope });
      await srv.waitCompleted(it.serverId);

      // The console imports: the new verification, the two entries, a re-verification row.
      await Lib.importFromConsole(p, it.id);
      const after = await p.evaluate((id) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const inv = ws.investors.find((y) => y.id === id);
        const a = NS.integrations.peek(inv).accreditation;
        return { status: a.status, expiresAt: a.expiresAt, asked: (ws.audit || []).filter((e) => e.record === id && e.action === 'Accreditation re-verification requested').length, done: (ws.audit || []).filter((e) => e.record === id && e.action === 'Accreditation re-verified').length, notes: (ws.notifications || []).filter((n) => n.kind === 'onboarding_completed').map((n) => n.title) };
      }, x.id);
      const want = iso(Date.now() + 90 * DAY);
      check(`the record shows the new verification, valid until ${want}`, after.status === 'verified' && after.expiresAt === want, after);
      check('one "Accreditation re-verification requested" and one "Accreditation re-verified" entry', after.asked === 1 && after.done === 1, after);
      check('the console\'s notice reads as a re-verification', after.notes.some((t) => t === `${x.title} finished your re-verification request`), after.notes);
      await Lib.consoleRoute(p, 'console-investors', '.cs-tbl');
      await p.evaluate(() => {
        window.CVPortal.state.ui.inv8Filter = 'all';
        window.CVPortal.app.render();
      });
      await p.waitForTimeout(300);
      const rowText = await p.locator(`tr[data-invitation="${it.id}"]`).innerText().catch(() => '');
      check('the request\'s row reads as a re-verification', /Re-verification only/.test(rowText) && !/Account only|Tax form only/.test(rowText), rowText);
      await p.locator(`tr[data-invitation="${it.id}"]`).scrollIntoViewIfNeeded().catch(() => {});
      await p.screenshot({ path: path.join(SHOTS, 'server-row.png') });
      seen.push(rowText);
      const approved = await approve(p, x.reqId);
      check('after: Approve is allowed, without the override', /^Subscription approved/.test(approved.toast) && approved.status !== 'pending' && approved.overridden === 0, approved);
      seen.push(await F.noRawError(check, p, 'the console after the import', A.errors));
      check('asking once made exactly one POST /v1/invitations', posts.length === 1, posts);

      // W3: the typed taxpayer number reaches no call, no stored record, no email and no screen.
      const store = JSON.stringify({ invitations: srv.server.store.list('invitations'), outbox: srv.server.store.list('outbox'), verifications: srv.server.store.list('verifications'), screenings: srv.server.store.list('screenings') });
      scan('the server\'s store and outbox', store);
      scan('what the device sent', sent);
      scan('every screen of this part', seen.join('\n'));
      F.leakFree(check, 'every screen and email of this part', seen.join('\n'));
    } finally {
      for (const c of closers) await Promise.resolve().then(c).catch(() => {});
    }
    // Plan 08-20 (G6): every other state of the box, and every refusal as the real server sends it.
    await g6(check, S);
  },

  async leave({ check, S }) {
    const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
    const p = A.page;
    const seen = [];
    try {
      const x = await lapsedInvestor(S, A);
      const r = await row(p, x.email);
      await r.locator('[data-action="reverify-request"]').first().click();
      await p.waitForSelector('#dlg[open] [data-action="reverify-send"]', { timeout: 10000 });
      await p.click('#dlg [data-action="reverify-send"]');
      await p.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 });
      await p.click('#dlg .dlg-head [data-action="close-dialog"]');
      const record = () =>
        p.evaluate((id) => {
          const ws = window.CVPortal.state.ws;
          const i = ws.investors.find((y) => y.id === id);
          return JSON.stringify({ verify: i.verify, accreditation: i.accreditation, positions: i.positions, kyc: i.kyc, requests: (ws.requests || []).filter((q) => q.investorId === id) });
        }, x.id);
      const before = await record();
      const itId = await p.evaluate((id) => (window.CVPortal.state.ws.invitations || []).filter((y) => y.investorId === id).pop().id, x.id);

      // Signed in as the investor: the portal offers the open request.
      await p.evaluate((id) => (window.CVPortal.state.viewer = id), x.id);
      await p.selectOption('#demo-role', 'investor');
      await p.waitForFunction(() => location.hash === '#overview');
      const offer = async () => {
        for (const hash of ['overview', 'investments']) {
          await p.evaluate((h) => (location.hash = h), hash);
          await p.waitForTimeout(400);
          const l = p.locator('a', { hasText: 'Verify your accreditation' }).first();
          if (await l.count()) return { link: l, text: await p.locator('.ivf-invited').first().innerText().catch(() => '') };
        }
        return null;
      };
      const o1 = await offer();
      check('the portal offers the open request: "<firm> asked you to verify your accreditation again." with "Verify your accreditation"', !!o1 && o1.text.indexOf('asked you to verify your accreditation again.') >= 0, o1 && o1.text);
      if (!o1) return;
      seen.push(o1.text);
      await o1.link.click();
      await p.waitForSelector('.ivf-form', { timeout: 20000 });
      await p.waitForTimeout(300);
      const s1 = await flowState(p, itId);
      const back = p.locator('.ivf-form .ob-actions >> text="Back"').first();
      check('the request opens on step 1 of 2 with Back beside Continue', /^Step 1 of 2/.test(s1.count) && (await back.count()) === 1, s1.count);
      seen.push(s1.text);
      if (!(await back.count())) return;
      await back.click();
      await p.waitForFunction(() => location.hash === '#overview', null, { timeout: 10000 });
      check('Back on the first step returns to the investor\'s portal', (await p.evaluate(() => location.hash)) === '#overview');
      const o2 = await offer();
      check('the portal still offers "Verify your accreditation" after leaving', !!o2);
      check('leaving changed nothing on the record', (await record()) === before);
      if (!o2) return;
      await o2.link.click();
      await p.waitForSelector('.ivf-form', { timeout: 20000 });
      await p.waitForTimeout(300);
      const s2 = await flowState(p, itId);
      const count = await p.evaluate((id) => (window.CVPortal.state.ws.invitations || []).filter((y) => y.investorId === id).length, x.id);
      check('opening it again resumes the same request where it was (step 1 of 2, no new invitation)', /^Step 1 of 2/.test(s2.count) && JSON.stringify(s2.steps) === JSON.stringify(['accreditation', 'done']) && count === 1, { count: s2.count, invitations: count });
      await p.locator('.ivf-form .ob-actions >> text="Back"').first().click();
      await p.waitForFunction(() => location.hash === '#overview', null, { timeout: 10000 });

      // An expired or a cancelled request is not offered.
      for (const [what, patch] of [['expired', { expiresAt: new Date(Date.now() - DAY).toISOString() }], ['cancelled', { status: 'cancelled' }]]) {
        const keep = await p.evaluate(({ itId, patch }) => {
          const it = window.CVPortal.state.ws.invitations.find((y) => y.id === itId);
          const was = { expiresAt: it.expiresAt, status: it.status };
          Object.assign(it, patch);
          window.CVPortal.app.render();
          return was;
        }, { itId, patch });
        check(`a${what === 'expired' ? 'n' : ''} ${what} request is not offered`, (await offer()) === null);
        await p.evaluate(({ itId, keep }) => Object.assign(window.CVPortal.state.ws.invitations.find((y) => y.id === itId), keep), { itId, keep });
      }
      seen.push(await F.noRawError(check, p, 'the portal after leaving', A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await A.context.close().catch(() => {});
    }
  },

  async button({ check, S }) {
    const shown = async (p, email) => (await (await row(p, email)).locator('[data-action="reverify-request"]').count()) === 1;
    const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
    const p = A.page;
    try {
      // Self-serve edition, an active investor, a Rule 506(c) offering raising: by the verification's date.
      const base = await lapsedInvestor(S, A);
      check('shown: the verification lapsed yesterday', await shown(p, base.email));
      const set = (o) =>
        p.evaluate(({ id, o, DAY }) => {
          const NS = window.CVPortal;
          const ws = NS.state.ws;
          const i = ws.investors.find((y) => y.id === id);
          if (o.until !== undefined) {
            const a = i.verify.accreditation;
            if (o.until === null) i.verify.accreditation = { status: 'not_started' };
            else Object.assign(a, { status: 'verified', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', expiresAt: new Date(Date.now() + o.until * DAY).toISOString().slice(0, 10) });
          }
          if (o.exemption) ws.offerings.forEach((f) => (f.structure = Object.assign({}, f.structure, { exemption: o.exemption })));
          if (o.status) i.onboarding = Object.assign({}, i.onboarding, { status: o.status });
          NS.app.save(true);
          NS.app.render();
        }, { id: base.id, o, DAY });
      await set({ until: null });
      check('shown: no verification by a third party on file', await shown(p, base.email));
      await set({ until: 10 });
      check('shown: the verification lapses within 14 days (in 10)', await shown(p, base.email));
      await set({ until: 14 });
      check('shown: the verification lapses in exactly 14 days', await shown(p, base.email));
      await set({ until: 30 });
      check('not shown: a current verification more than 14 days from lapsing (30)', !(await shown(p, base.email)));
      await set({ until: -1, exemption: 'Rule 506(b)' });
      check('not shown: a lapsed verification where every offering is Rule 506(b) and the rule is the default', !(await shown(p, base.email)));
      await set({ exemption: 'Rule 506(c)', status: 'in_progress' });
      check('not shown: an investor not yet active', !(await shown(p, base.email)));
      await set({ status: 'complete' });
      check('shown again: active, lapsed, a Rule 506(c) offering raising', await shown(p, base.email));
      // A team role that may not invite (the console's own permission, NS.app.can('operate')).
      await p.evaluate(() => {
        const app = window.CVPortal.app;
        app.__can = app.can;
        app.can = (what, role) => (what === 'operate' ? false : app.__can(what, role));
        app.render();
      });
      check('not shown: a team role that may not invite', !(await shown(p, base.email)));
      await p.evaluate(() => {
        const app = window.CVPortal.app;
        app.can = app.__can;
        app.render();
      });

      // Asking twice while the request is open: the same request, no second one.
      const ask = async () => {
        const r = await row(p, base.email);
        await r.locator('[data-action="reverify-request"]').first().click();
        await p.waitForSelector('#dlg[open] [data-action="reverify-send"]', { timeout: 10000 });
        const text = await p.locator('#dlg').innerText();
        await p.click('#dlg [data-action="reverify-send"]');
        await p.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 });
        await p.click('#dlg .dlg-head [data-action="close-dialog"]');
        return text;
      };
      await ask();
      const again = await ask();
      const twice = await p.evaluate((id) => {
        const ws = window.CVPortal.state.ws;
        return { invitations: (ws.invitations || []).filter((y) => y.investorId === id && y.reverify).length, asked: (ws.audit || []).filter((e) => e.record === id && e.action === 'Accreditation re-verification requested').length };
      }, base.id);
      check('asking again while the request is open says so and makes no second request (one invitation, one entry)', /A request is already open/.test(again) && twice.invitations === 1 && twice.asked === 1, twice);
      await F.noRawError(check, p, 'the Investors page', A.errors);
    } finally {
      await A.context.close().catch(() => {});
    }

    // Server mode: asking again resends the same request; no new POST /v1/invitations.
    const srv = await Lib.serverPortal(S, {});
    const B = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
    try {
      const p = B.page;
      const calls = [];
      p.on('request', (rq) => rq.method() === 'POST' && /\/v1\/invitations(\/[^/]+\/resend)?$/.test(rq.url().replace(/[?#].*$/, '')) && calls.push(rq.url().replace(/^.*\/v1\//, '/v1/').replace(/ivt_[\w-]+/, ':id')));
      const x = await lapsedInvestor(S, B);
      await srv.configure(p);
      for (let k = 0; k < 2; k++) {
        const r = await row(p, x.email);
        await r.locator('[data-action="reverify-request"]').first().click();
        await p.waitForSelector('#dlg[open] [data-action="reverify-send"]', { timeout: 10000 });
        await p.click('#dlg [data-action="reverify-send"]');
        await p.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 30000 });
        await p.waitForTimeout(300);
      }
      const held = srv.server.store.list('invitations').filter((y) => y.investorId === x.id).length;
      check('server mode, asked twice: one POST /v1/invitations, then a resend of the same request; the server holds one', JSON.stringify(calls) === JSON.stringify(['/v1/invitations', '/v1/invitations/:id/resend']) && held === 1, { calls, held });
      await F.noRawError(check, p, 'the Investors page, server mode', B.errors);
    } finally {
      await B.context.close().catch(() => {});
      await srv.close().catch(() => {});
    }

    // The managed edition (index.html) has no such button.
    const M = await Lib.open(S, { context: F.VIEW.desktop });
    try {
      const p = M.page;
      await p.goto(`${S.origin}/index.html`);
      await p.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
      await p.goto(`${S.origin}/index.html`);
      await p.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 20000 });
      // The managed edition's staff role (its demo control has no "admin"): the Investors page as the firm's team sees it.
      if (await p.locator('#demo-role').count()) await p.selectOption('#demo-role', 'staff');
      await p.evaluate(() => (location.hash = '#console-investors'));
      await p.waitForSelector('table.cs-tbl tbody tr', { timeout: 20000 });
      await p.waitForTimeout(300);
      const m = await p.evaluate(() => ({ edition: window.CVPortal.EDITION.id, rows: document.querySelectorAll('table.cs-tbl tbody tr').length, buttons: document.querySelectorAll('[data-action="reverify-request"]').length }));
      check('not shown in the managed edition (index.html): its Investors page lists investors and offers no "Ask to re-verify"', m.edition === 'managed' && m.rows > 0 && m.buttons === 0, m);
    } finally {
      await M.context.close().catch(() => {});
    }
  },

  async package({ check, S }) {
    tinProof(check);
    const cap = capture();
    let printed = '';
    const C = await sponsorConsole(S, check, { view: 'desktop' });
    const investorSeen = [];
    const consoleSeen = [];
    try {
      const { p, srv, w, x } = C;
      const bill = await srv.call('GET', '/v1/billing', undefined, srv.token);
      const PRICE = bill.body && bill.body.prices ? Number(bill.body.prices.reverify) : 0;
      check('GET /v1/billing (the account\'s token) offers the reverify tier at a price of its own', bill.status === 200 && bill.body.available && bill.body.available.reverify === true && PRICE > 0, bill.body && { available: bill.body.available, prices: bill.body.prices });
      const LABEL = `${PKG_LABEL} (${priceText(PRICE)})`;

      // The dialog: the box with the server's reverify price, switched on (a card is on file).
      const box = await openDialog(p, x, () => {
        const i = document.getElementById('rv-package');
        return !!i && !i.disabled;
      });
      check(`the dialog holds "${LABEL}" (the server's reverify price), switched on and unticked`, !!box && box.shown && box.enabled && !box.checked && box.label === LABEL && box.line === '', box);
      if (!box || !box.enabled) return;
      consoleSeen.push(await p.locator('#dlg').innerText());
      await p.screenshot({ path: path.join(SHOTS, 'package-dialog.png') });

      // Ticked, "Send request": one charge of exactly that price, before the request's email.
      const sent = await sendRequest(p, x, true);
      const it = sent.all.filter((y) => y.reverify).pop() || {};
      check('"Send request" sends the request to the server, marked reverify, with the package; the dialog closes', /^ivt_/.test(it.serverId || '') && it.pkg && sent.dlg === false, sent);
      const pays = srv.server.store.list('payments');
      const charges = C.marks.filter((m) => m.kind === 'charge');
      check(`one charge of exactly the reverify price (${PRICE} cents) on the card, and it succeeded`, w.count('charge') === 1 && pays.length === 1 && pays[0].cardCents === PRICE && pays[0].status === 'succeeded', { charges: w.count('charge'), pays: pays.map((y) => ({ cents: y.cardCents, status: y.status })) });
      const mail = it.serverId ? ((await srv.call('GET', `/v1/outbox?invitation=${encodeURIComponent(it.serverId)}`, undefined, srv.token)).body.messages || []) : [];
      check('the charge came before the request\'s email existed; the server then emailed the request once', charges.length === 1 && charges[0].outbox === 0 && mail.length === 1 && mail[0].subject === `${x.firm}: verify your accredited investor status`, { atCharge: charges.map((m) => m.outbox), mail: mail.map((m) => m.subject) });
      const rec = it.serverId ? srv.server.store.get('invitations', it.serverId) : null;
      const snap = rec ? srv.server.invitations.vault.open(rec.snapshot, `${rec.id}:snapshot`) : null;
      check('the server holds the request with its package at tier reverify (an investor on file, no offering)', !!rec && !!rec.package && rec.package.tier === 'reverify' && rec.package.key === it.id && !!snap && snap.invitation.reverify === true && snap.offering === null, rec && { pkg: rec.package, reverify: snap && snap.invitation.reverify });
      const email = mail.map((m) => `${m.subject}\n${m.text}\n${m.html || ''}`).join('\n');
      investorSeen.push(email);
      if (!it.serverId) return;

      // The investor's own browser: two steps; the accreditation step through the package.
      const B = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({}, F.VIEW.desktop) });
      C.closers.push(() => B.context.close());
      const ip = B.page;
      const replies = [];
      ip.on('response', async (res) => {
        if (res.request().method() === 'GET' && /\/v1\/invite$/.test(res.url().replace(/[?#].*$/, ''))) replies.push(await res.text().catch(() => ''));
      });
      await ip.goto(it.link);
      await ip.waitForSelector('.ivf-form', { timeout: 30000 });
      await ip.waitForTimeout(400);
      const s1 = await ip.evaluate(() => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const pn = document.getElementById('iv-accreditation');
        return { count: (document.querySelector('.ivf-progress .ob-count') || {}).innerText || '', steps: NS.inviteFlow.steps(ws, ws.invitations[0]), panel: pn ? pn.innerText : '', button: pn && pn.querySelector('[data-action=iv-start]') ? pn.querySelector('[data-action=iv-start]').textContent.trim() : '' };
      });
      check(`the link has two steps (accreditation, done); the accreditation step reads "${SECURE}" and offers "Verify my accreditation"`, /^Step 1 of 2/.test(s1.count) && JSON.stringify(s1.steps) === JSON.stringify(['accreditation', 'done']) && s1.panel.indexOf(SECURE) >= 0 && s1.button === 'Verify my accreditation', s1);
      await ip.screenshot({ path: path.join(SHOTS, 'package-link.png') });
      investorSeen.push(await Lib.screenText(ip));
      if (s1.button !== 'Verify my accreditation') return;
      const acc = await accStart(B, ip);
      check('the stand-in\'s page opens in a new tab; the server holds one accreditation check through the package', acc.opened && /\/hosted\/ver_/.test(acc.page) && srv.server.store.list('verifications').filter((v) => v.kind === 'accreditation').length === 1 && srv.accredit.control.calls.some((c) => c.kind === 'session'), { opened: acc.opened, calls: srv.accredit.control.calls.map((c) => c.kind) });
      // The third party's result: verified. The investor's step reads it, and the investor finishes.
      srv.accredit.control.state = 'verified';
      const turned = await ip.waitForFunction(() => /Verified/.test(((document.querySelector('#iv-accreditation .iv-chip') || {}).textContent || '')), null, { timeout: 60000 }).then(() => true, () => false);
      investorSeen.push(await Lib.screenText(ip));
      check('the investor\'s step turns to Verified when the stand-in answers', turned, ((await ip.locator('#iv-accreditation').innerText().catch(() => '')) || '').slice(0, 400));
      if (await ip.locator('#ob-accAttest').count()) await ip.check('#ob-accAttest');
      await ip.click('.ivf-form button[type=submit]');
      await ip.waitForSelector('.ivf-done', { timeout: 30000 });
      const done = await ip.locator('.ivf-done').innerText();
      check('the investor\'s done screen: verified, and the firm will see the result', /Your accreditation is verified/.test(done) && done.indexOf(`${x.firm} will see the result`) >= 0, done);
      investorSeen.push(done, await F.noRawError(check, ip, 'the investor\'s device', B.errors));
      for (let k = 0; k < 60; k++) {
        const r = await srv.call('GET', '/v1/invitations?workspace=kestrel-bay', undefined, srv.token);
        const rows = Array.isArray(r.body) ? r.body : (r.body && r.body.invitations) || [];
        const one = rows.find((y) => y.id === it.serverId);
        if (one && one.status === 'completed' && one.hasSubmission) break;
        await new Promise((res) => setTimeout(res, 300));
      }

      // The console imports: the new verification with its valid-until date; the row reads "Package".
      await Lib.importFromConsole(p, it.id);
      const want = iso(Date.now() + 90 * DAY);
      await Lib.consoleRoute(p, 'console-kyc', '[data-action=kyc-tab]');
      const got = await p.waitForFunction((id) => {
        const NS = window.CVPortal;
        const a = NS.integrations.peek(NS.state.ws.investors.find((y) => y.id === id)).accreditation;
        return a.status === 'verified' && a.expiresAt > new Date().toISOString().slice(0, 10) ? { status: a.status, expiresAt: a.expiresAt } : null;
      }, x.id, { timeout: 60000 }).then((h) => h.jsonValue(), () => null);
      const after = await p.evaluate((id) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const a = NS.integrations.peek(ws.investors.find((y) => y.id === id)).accreditation;
        return { status: a.status, expiresAt: a.expiresAt, shown: a.expiresAt ? NS.ui.date(a.expiresAt) : '', done: (ws.audit || []).filter((e) => e.record === id && e.action === 'Accreditation re-verified').length };
      }, x.id);
      check(`the record shows the new verification, valid until ${want} (the stand-in's 90 days, the firm's 90-day cap)`, !!got && after.status === 'verified' && after.expiresAt === want, after);
      check('one "Accreditation re-verified" entry', after.done === 1, after);
      const rowText = await requestRow(p, it.id);
      check('the request\'s row reads "Re-verification only" and "Package"', /Re-verification only/.test(rowText) && /\bPackage\b/.test(rowText), rowText);
      await p.locator(`tr[data-invitation="${it.id}"]`).scrollIntoViewIfNeeded().catch(() => {});
      await p.screenshot({ path: path.join(SHOTS, 'package-row.png') });
      consoleSeen.push(rowText, await F.noRawError(check, p, 'the console after the import', C.A.errors));
      check('no second charge: still one payment', w.count('charge') === 1 && srv.server.store.list('payments').length === 1, money(C));

      // T-08-58: the investor never sees a price.
      const invText = investorSeen.concat(replies).join('\n');
      check(`no investor screen, the request's email or GET /v1/invite (${replies.length} replies) holds ${PRICE_WORDS.join(', ')}`, replies.length > 0 && priceHits(invText).length === 0, priceHits(invText));
      check('no call left this machine outside the stand-in world', outside.length === 0 && w.count('other') === 0, { outside, other: w.calls.filter((c) => c.kind === 'other') });
      F.leakFree(check, 'every screen and email of this part', investorSeen.concat(consoleSeen).join('\n'));
      printed = cap.stop();
      check('the typed taxpayer number is in no world record', w.calls.length > 0 && !holdsTin(JSON.stringify(w.calls)));
      check('the typed taxpayer number is in no server output (store, events, anything this process printed) and on no screen', !holdsTin(JSON.stringify({ i: srv.server.store.list('invitations'), o: srv.server.store.list('outbox'), e: srv.server.store.list('events') })) && !holdsTin(printed) && !holdsTin(investorSeen.concat(consoleSeen).join('\n')));
    } finally {
      cap.stop();
      await C.close();
    }
  },

  async subscribe({ check, S }) {
    const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
    const p = A.page;
    const seen = [];
    try {
      const x = await lapsedInvestor(S, A);
      // Three firms: an open request; no request and no accreditation check of the firm's own; the firm's own check.
      const forms = [
        ['an open re-verification request', { ask: true, use: ['sandbox'] }],
        ['no open request and no accreditation check the portal can run', { ask: false, use: [] }],
        ['no open request and the firm\'s own accreditation check', { ask: false, use: ['sandbox'] }]
      ];
      for (const [what, f] of forms) {
        await p.evaluate(({ id, use }) => {
          const NS = window.CVPortal;
          const ws = NS.state.ws;
          NS.integrations.ensure(ws).use.accreditation = use.slice();
          (ws.invitations || []).forEach((y) => y.investorId === id && y.reverify && ['completed', 'cancelled'].indexOf(y.status) < 0 && (y.status = 'cancelled'));
          NS.app.save(true);
          NS.app.render();
        }, { id: x.id, use: f.use });
        if (f.ask) {
          const r = await row(p, x.email);
          await r.locator('[data-action="reverify-request"]').first().click();
          await p.waitForSelector('#dlg[open] [data-action="reverify-send"]', { timeout: 10000 });
          await p.click('#dlg [data-action="reverify-send"]');
          await p.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 });
          await p.click('#dlg .dlg-head [data-action="close-dialog"]');
        }
        const v = await subscribePage(p, x);
        seen.push(v.text);
        check(`${what}: the subscription is still refused for the lapsed verification ("${LAPSED} ...")`, v.reason.indexOf(LAPSED) >= 0 && /Rule 506\(c\) offerings need a current verification/.test(v.reason), v.reason);
        check(`${what}: no way to sign around it: no "Sign subscription documents" and no typed subscription form; "Continue your subscription" is still offered`, v.sign === 0 && v.typed === 0 && v.cont === 1, v);
        if (f.ask) {
          check(`${what}: the banner shows the reason and "Verify your accreditation", which leads to the request's link`, v.banner.indexOf(v.reason) >= 0 && v.links.length === 1 && v.links[0].label === 'Verify your accreditation' && !!v.ask && v.links[0].href === v.ask && v.buttons.length === 0, v);
          await p.screenshot({ path: path.join(SHOTS, 'subscribe-request.png') });
          if (v.links.length === 1) {
            await p.click('.iv-banner a');
            await p.waitForSelector('.ivf-form', { timeout: 20000 });
            await p.waitForTimeout(300);
            const s = await flowState(p, v.askId);
            check(`${what}: "Verify your accreditation" opens the request: step 1 of 2, accreditation then done`, /^Step 1 of 2/.test(s.count) && JSON.stringify(s.steps) === JSON.stringify(['accreditation', 'done']), { count: s.count, steps: s.steps });
            seen.push(s.text);
          }
        } else if (!f.use.length) {
          const LINE = `${v.short} will send you a link to verify again.`;
          check(`${what}: the banner shows the reason and "${LINE}", with no button`, v.banner.indexOf(v.reason) >= 0 && v.banner.indexOf(LINE) >= 0 && v.links.length === 0 && v.buttons.length === 0, v);
          await p.screenshot({ path: path.join(SHOTS, 'subscribe-will-send.png') });
        } else {
          check(`${what}: as today: no banner (the firm's own check is offered in the subscription itself), no "will send you a link"`, v.banner === '' && v.text.indexOf('will send you a link') < 0 && v.text.indexOf('Verify your accreditation') < 0, v);
          await p.screenshot({ path: path.join(SHOTS, 'subscribe-own-check.png') });
        }
      }
      seen.push(await F.noRawError(check, p, 'the subscribe screens', A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await A.context.close().catch(() => {});
    }
  },

  async phone({ check, S }) {
    const seen = [];
    // The sponsor's console on a phone, server mode, a card on file: the dialog with its box.
    const C = await sponsorConsole(S, check, { view: 'phone' });
    try {
      const { p, srv, x } = C;
      const size = p.viewportSize();
      check('the window is 390x844 with touch', size.width === 390 && size.height === 844 && (await p.evaluate(() => navigator.maxTouchPoints > 0)), size);
      const bill = await srv.call('GET', '/v1/billing', undefined, srv.token);
      const LABEL = `${PKG_LABEL} (${priceText(Number(bill.body.prices.reverify))})`;
      const enabled = () => {
        const i = document.getElementById('rv-package');
        return !!i && !i.disabled;
      };
      let b = await openDialog(p, x, enabled, true);
      check(`the dialog opens with a tap and holds "${LABEL}", switched on`, !!b && b.shown && b.enabled && b.label === LABEL, b);
      const fit = await fitOf(p, '#dlg');
      check('the dialog and its box fit the width (no sideways scroll)', fits(fit), fit);
      const sendBox = await p.evaluate(() => {
        const btn = document.querySelector('#dlg [data-action="reverify-send"]');
        btn.scrollIntoView({ block: 'end' });
        const r = btn.getBoundingClientRect();
        const d = document.getElementById('dlg');
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: innerHeight, scrollable: d.scrollHeight >= d.clientHeight };
      });
      check('the dialog scrolls to "Send request", which is then on screen', sendBox.bottom <= sendBox.height && sendBox.top >= 0 && sendBox.scrollable, sendBox);
      await p.screenshot({ path: path.join(SHOTS, 'phone-dialog.png') });
      seen.push(await p.locator('#dlg').innerText());
      const shut = () => p.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 5000 }).then(() => true, () => false);
      await p.tap('#dlg .dlg-head [data-action="close-dialog"]');
      check('the dialog closes with its X (a tap)', await shut());
      await openDialog(p, x, enabled, true);
      await p.keyboard.press('Escape');
      check('the dialog closes with Escape', await shut());
      await openDialog(p, x, enabled, true);
      const hash = await p.evaluate(() => location.hash);
      await p.goBack();
      const backShut = await shut();
      check('the dialog closes with the browser\'s back, and the page stays', backShut && (await p.evaluate(() => location.hash)) === hash, { backShut, hash });

      // Ticked and sent with taps; the investor's own phone opens the request.
      b = await openDialog(p, x, enabled, true);
      await p.tap('#rv-package');
      check('a tap ticks the box', (await rvBox(p)).checked === true);
      const sent = await sendRequest(p, x, false, true);
      const it = sent.all.filter((y) => y.reverify).pop() || {};
      check('"Send request" (a tap) sends the request with the package; one charge', /^ivt_/.test(it.serverId || '') && it.pkg && C.w.count('charge') === 1, { it, charges: C.w.count('charge') });
      if (!it.serverId) return;
      const B = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({}, F.VIEW.phone) });
      C.closers.push(() => B.context.close());
      const ip = B.page;
      await ip.goto(it.link);
      await ip.waitForSelector('.ivf-form', { timeout: 30000 });
      await ip.waitForTimeout(400);
      const step = await fitOf(ip, '.ivf-form');
      check('the investor\'s step fits the phone\'s width (no sideways scroll)', fits(step), step);
      const back = await onScreen(ip, '.ivf-form .ob-actions >> text="Back"');
      check('the investor\'s step has Back on screen', back.ok, back);
      await ip.screenshot({ path: path.join(SHOTS, 'phone-link.png') });
      seen.push(await Lib.screenText(ip), await F.noRawError(check, ip, 'the investor\'s phone', B.errors));
      seen.push(await F.noRawError(check, p, 'the sponsor\'s phone', C.A.errors));
    } finally {
      await C.close();
    }

    // The subscribe screen's offer on a phone (no server: the request prepared for the sponsor's own email).
    const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, F.VIEW.phone) });
    try {
      const p = A.page;
      const x = await lapsedInvestor(S, A);
      const r = await row(p, x.email);
      await r.locator('[data-action="reverify-request"]').first().tap();
      await p.waitForSelector('#dlg[open] [data-action="reverify-send"]', { timeout: 10000 });
      await p.tap('#dlg [data-action="reverify-send"]');
      await p.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 });
      await p.tap('#dlg .dlg-head [data-action="close-dialog"]');
      const v = await subscribePage(p, x);
      check('the subscribe screen on a phone offers "Verify your accreditation"', v.links.length === 1 && v.links[0].label === 'Verify your accreditation', v);
      const fit = await fitOf(p, '.iv-banner');
      check('the subscribe banner fits the phone\'s width (no sideways scroll)', fits(fit), fit);
      const link = await onScreen(p, '.iv-banner a');
      check('its link is on screen and can be tapped', link.ok, link);
      await p.screenshot({ path: path.join(SHOTS, 'phone-subscribe.png') });
      seen.push(v.text);
      if (link.ok) {
        await p.tap('.iv-banner a');
        await p.waitForSelector('.ivf-form', { timeout: 20000 });
        await p.waitForTimeout(300);
        const s = await flowState(p, v.askId);
        check('a tap opens the request: step 1 of 2', /^Step 1 of 2/.test(s.count), s.count);
        const back = await onScreen(p, '.ivf-form .ob-actions >> text="Back"');
        check('the request\'s step has Back on screen', back.ok, back);
        seen.push(s.text);
      }
      seen.push(await F.noRawError(check, p, 'the investor\'s portal on a phone', A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await A.context.close().catch(() => {});
    }
  },

  'preview-desktop': async ({ check, S }) => preview(check, S, 'desktop'),
  'preview-phone': async ({ check, S }) => preview(check, S, 'phone')
};

Lib.runParts(parts, { name: 'REVERIFY', unit: 'parts', flag: '--only', browser: true });
