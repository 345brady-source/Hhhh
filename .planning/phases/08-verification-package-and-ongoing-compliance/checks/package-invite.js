#!/usr/bin/env node
// GATE CHECK: PACKAGE INVITE
// Plan 08-06 (D-01): the one tick box "Add verification package" on the sponsor's invite form. In the server parts the
// sponsor's console is the sample self-serve portal connected to the real integration server (server/index.mjs in this
// process). GET /v1/billing (where the server would read the card from the payment provider) and a refused charge are
// stood in for by the check (frame.js stubServer); every other call is the server's. A ticked package is sent with a
// sponsor account's token (plan 08-05: the shared token is the operator's and cannot buy one), and the real server takes
// it, paid from the account's balance, so no payment provider is called and no key is used. In the preview parts the
// portal runs as the owner sees it: a sandboxed frame that refuses every connection, no server.
//   single           1280x800: the label carries the server's price for this invitation ($19 without an offering, $99
//                    for a Rule 506(c) offering); ticked, the request the server receives holds invitation.package true
//                    and invitation.clientId (the console's invitation id) and the server stores the package with the
//                    invitation; unticked, neither; the row the server reports as a package row shows the word "Package"
//   declined         a refused charge (402 card_declined): the server's sentence on screen, no email dialog, "Not sent
//                    yet"; sent again, the same clientId, and the server stores the package
//   nocard           no card on file: the box switched off with a line that leads to the Integrations page; the price in
//                    the label is the server's, whatever it is
//   notoffered       a server without billing: no box; available.full false: no box for a Rule 506(c) offering, the box
//                    for an identity-tier invitation
//   account          the shared token (the operator's own): the server's own 403 account_required; the box shown,
//                    switched off, with the server's sentence; it cannot be ticked; an invitation still sends without the
//                    package. At 1280x800, and at 390x844 with touch
//   unreachable      a server address nothing answers at: the box switched off with one line
//   preview-desktop  the owner's preview at 1280x800: the box shown, switched off, one line; nothing attempted, no raw
//   preview-phone    error; an invitation still sends from the sponsor's own email app. The same at 390x844 with touch
//   phone            server mode at 390x844 with touch: the box fits the width, a tap ticks it, the flag is sent
//   managed          the managed edition's invite form holds no package box; its C-03 slices still pass
// Plan 08-13 (D-01, research Pitfall 9, 08-CONTEXT P1 and P5): the box on "Import a list".
//   list             one box with the list's total (each row's own tier and price, decided by the single form's rule);
//                    ticked, one POST /v1/billing/entitlements with the rows' client ids and tiers before the first
//                    invitation; an investor on file whose package the server does not offer is not paid for, not in the
//                    total and sent without the package; the paid rows are exactly the rows sent with package true
//   list-declined    the list box's no-card and not-offered states; a refused payment: no invitation, nothing created, the
//                    list as it was, the server's sentence once; sent again, the same keys; 205 rows are paid in groups of
//                    200, each group sent before the next is paid, and a refused group stops the list there; the owner's
//                    preview (framed, no server, 390x844 touch): the box switched off with one line, the list still sends
// 12 parts. Every part ends with the leak scan of the screens it saw (phase 6's leak check and frame.js's vendor scan).
//   NODE_PATH=$(npm root -g) node package-invite.js [--only single,declined,nocard,notoffered,account,unreachable,preview-desktop,preview-phone,phone,managed,list,list-declined]
// The last line is "PACKAGE INVITE: PASS (parts run: N)" or "PACKAGE INVITE: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const F = require('./frame.js');
const Lib = F.Lib;

// The integration server runs in this process: a call it makes to anywhere outside this machine (a payment or check
// provider) is refused here and kept, so a part can prove none was made.
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

const SHOTS = path.join(Lib.OUT, 'package-invite-shots');
fs.mkdirSync(SHOTS, { recursive: true });
Lib.describeShots([
  ['single-form.png', 'Server mode, 1280x800: the invite form for a Rule 506(c) offering, the box "Add verification package ($99)" ticked.'],
  ['nocard-form.png', 'Server mode, no card on file: the box switched off with the line that leads to the Integrations page.'],
  ['unreachable-form.png', 'A server address nothing answers at: the box switched off with "The integration server could not be reached."'],
  ['preview-desktop-form.png', 'The owner\'s preview (sandboxed frame, no connection allowed, no server) at 1280x800: the box switched off with its one line.'],
  ['preview-phone-form.png', 'The owner\'s preview at 390x844 with touch: the box switched off with its one line.'],
  ['phone-form.png', 'Server mode at 390x844 with touch: the box with the server\'s price, ticked by a tap.'],
  ['account-desktop-form.png', 'The shared token (no sponsor account), 1280x800: the box switched off with "Card payments need a sponsor account."'],
  ['account-phone-form.png', 'The shared token at 390x844 with touch: the box switched off with the server\'s sentence, inside the width.']
]);

const LABEL = 'Add verification package';
const LINE_NO_SERVER = 'Checks run once your portal is connected to its server.';
const LINE_NO_CARD = 'Add a card on the Integrations page to use it.';
const LINE_UNREACHABLE = 'The integration server could not be reached.';
const DECLINED = 'The card was declined. Nothing was charged.';
const ACCOUNT = 'Card payments need a sponsor account.';

const BILLING = (over) =>
  Object.assign(
    { ready: true, available: { identity: true, full: true, reverify: true }, card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 }, currency: 'usd', prices: { identity: 1900, full: 9900, reverify: 6900 }, creditCents: 0, charges: [] },
    over || {}
  );

/**
 * A server that can sell a sponsor account the package with no payment provider and no key: the operator's admin token
 * (sponsor accounts, plan 08-01); stand-in values where the server only asks that the payment settings are filled (they
 * are read on a call to the provider, and none is made: see outside); the server's own built-in test provider named for
 * both checks (nothing is called when an invitation is created).
 */
const ADMIN = crypto.randomBytes(24).toString('hex');
const ACCOUNT_ENV = { ADMIN_TOKEN: ADMIN, BILLING_SECRET_KEY: 'stand-in-not-a-key', BILLING_PUBLISHABLE_KEY: 'stand-in-not-a-key', PACKAGE_IDENTITY_PROVIDER: 'sandbox', PACKAGE_ACCREDITATION_PROVIDER: 'sandbox' };
/** The account's balance (credit, as from returned packages, plan 08-04): above any price, so the server pays from it. */
const BALANCE = 100000;

/**
 * The sponsor's console on the sample portal (a Rule 506(c) offering raising), connected to the integration server.
 * opts.account: the console holds a sponsor account's token (made through POST /v1/admin/accounts with the admin token,
 * as the server tests do, for the console's workspace, with BALANCE on it); otherwise the shared token.
 */
async function consoleOn(S, check, view, handlers, opts) {
  opts = opts || {};
  const srv = await Lib.serverPortal(S, opts.account ? ACCOUNT_ENV : undefined);
  const A = await Lib.open(S, { allow: [srv.base].concat(opts.allow || []), init: srv.init, context: Object.assign({ acceptDownloads: true }, view) });
  const off = await Lib.setupPortal(S, A, { exemption: 'Rule 506(c)' });
  await A.page.evaluate((a) => { window.CVPortal.state.ws.tenant.postalAddress = a; window.CVPortal.app.save(true); }, '1 Harbor Way, Boston, MA 02110'); // plan 13-09 (B1b): the firm's postal address (emails.js SAMPLE_ADDRESS), so the C-06 stop, now on, lets an invitation to a new offering go
  const stub = await F.stubServer(A.context, srv.base, Object.assign({ 'POST /v1/invitations': () => null }, handlers));
  let token = srv.token;
  let account = null;
  if (opts.account) {
    const workspace = await A.page.evaluate(() => window.CVPortal.state.ws.tenant.id);
    const res = await fetch(`${srv.base}/v1/admin/accounts`, { method: 'POST', headers: { Authorization: `Bearer ${ADMIN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace, name: 'Kestrel Bay Capital' }) });
    account = await res.json().catch(() => null);
    check('a sponsor account is made for the console\'s workspace with the operator\'s admin token', res.status === 200 && !!account && !!account.token && account.workspace === workspace, { status: res.status, workspace: account && account.workspace });
    if (account && account.id) srv.server.store.put('billing', { id: account.id, creditCents: BALANCE });
    token = account && account.token;
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
  } else check('the console uses the integration server', (await srv.configure(A.page)) === true);
  return {
    srv,
    A,
    page: A.page,
    off,
    stub,
    token,
    account,
    close: async () => {
      await A.context.close().catch(() => {});
      await srv.close().catch(() => {});
    }
  };
}

/** The invite form open on the Investors page (p: the page, or the frame that holds the portal). */
async function openForm(p) {
  await p.evaluate(() => (location.hash = '#console-investors'));
  await p.waitForSelector('[data-action=invite-toggle]', { timeout: 20000 });
  if ((await p.locator('#iv-email').count()) === 0) await p.click('[data-action=invite-toggle]');
  await p.waitForSelector('#iv-email', { timeout: 10000 });
}

/** The offering the invitation is for ('' = none: account only), chosen under More options. */
async function chooseOffering(p, id) {
  if (!(await p.locator('#iv-more[open]').count())) await p.click('#iv-more summary');
  await p.selectOption('#iv-off', id);
  await p.waitForTimeout(300);
}

/** The box as the screen shows it. */
const box = (p) =>
  p.evaluate(() => {
    const row = document.getElementById('iv-package-row');
    const input = document.getElementById('iv-package');
    const shown = (el) => !!el && !el.hidden && !!(el.offsetWidth || el.offsetHeight);
    const label = document.getElementById('iv-package-label');
    const line = document.getElementById('iv-package-line');
    const a = line && line.querySelector('a');
    return {
      present: !!input,
      shown: shown(row) && shown(input),
      disabled: !!(input && input.disabled),
      checked: !!(input && input.checked),
      name: input ? input.name : '',
      label: label ? label.innerText.trim() : '',
      line: shown(line) ? line.innerText.trim() : '',
      href: a ? a.getAttribute('href') : '',
      // lean: what the whole row says, line by line (the label, and at most one line under it)
      rows: shown(row) ? row.innerText.split('\n').map((x) => x.trim()).filter(Boolean) : []
    };
  });
/** Waits until the box is on screen (the billing reply has arrived) or the time is up; resolves to the box. */
async function boxShown(p, ms) {
  await p
    .waitForFunction(() => {
      const row = document.getElementById('iv-package-row');
      return !!row && !row.hidden && !!row.offsetWidth;
    }, null, { timeout: ms || 8000 })
    .catch(() => {});
  return box(p);
}
/** Waits until the console has asked the server what it offers n times and the answer has been applied; resolves to the box. */
async function boxAfterAnswer(p, stub, n) {
  for (let i = 0; i < 80 && stub.sent('GET /v1/billing').length < n; i++) await p.waitForTimeout(100);
  await p.waitForTimeout(500);
  return box(p);
}
/** A person tries to tick the box: a click (or a tap on a phone) on its label, whatever its state. */
async function tryTick(p, tap) {
  const row = p.locator('#iv-package-row');
  await row.scrollIntoViewIfNeeded().catch(() => {});
  if (tap) await row.tap({ timeout: 5000 }).catch(() => {});
  else await row.click({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(200);
  return box(p);
}
/** The row and its text inside the window's width, and no sideways scroll. */
const fit = (p) =>
  p.evaluate(() => {
    const r = document.getElementById('iv-package-row').getBoundingClientRect();
    const inner = ['iv-package', 'iv-package-label', 'iv-package-line'].map((id) => document.getElementById(id)).filter((el) => el && !el.hidden && el.offsetWidth).map((el) => el.getBoundingClientRect());
    return { width: innerWidth, left: Math.round(Math.min(r.left, ...inner.map((x) => x.left))), right: Math.round(Math.max(r.right, ...inner.map((x) => x.right))), page: document.documentElement.scrollWidth };
  });
const fits = (f) => f.left >= 0 && f.right <= f.width && f.page <= f.width + 1;

/** The console's newest invitation for this email, as the page holds it. */
const invitationOf = (p, email) =>
  p.evaluate((email) => {
    const ws = window.CVPortal.state.ws;
    const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
    const it = inv && (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
    return it ? { id: it.id, serverId: it.serverId || '', link: it.link || '', emailStatus: it.emailStatus, emailError: it.emailError || '', token: it.token || '', pkg: it.package === undefined ? null : it.package } : null;
  }, email);

/** Fill the form and send; o.package ticks the box first (when it is there and can be ticked). Resolves to the invitation. */
async function invite(p, o) {
  await openForm(p);
  await p.fill('#iv-contact', o.first);
  await p.fill('#iv-last', o.last);
  await p.fill('#iv-email', o.email);
  if (o.offeringId !== undefined) await chooseOffering(p, o.offeringId);
  let ticked = false;
  if (o.package) {
    const b = await boxShown(p);
    if (b.shown && !b.disabled) {
      if (o.tap) await p.tap('#iv-package');
      else await p.check('#iv-package');
      ticked = (await box(p)).checked;
    }
  }
  if (o.beforeSend) await o.beforeSend();
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
  return Object.assign({ ticked }, await invitationOf(p, o.email));
}

/** The invitation's row in the console's list, as text ('' when it is not listed). */
const rowText = (p, id) =>
  p.evaluate((id) => {
    const tr = document.querySelector(`tr[data-invitation="${id}"]`);
    return tr ? tr.innerText.replace(/\s+/g, ' ').trim() : '';
  }, id);
const packageOf = (post) => ((post && post.body) || {}).invitation || {};

/**
 * What the real server stored for an invitation (C: a console on a sponsor account): the record's package, the payment
 * behind it, and whether anything was sent to a payment provider (a payment record is written before any provider call,
 * plan 08-04 M1) or anywhere outside this machine.
 */
function stored(C, serverId) {
  const st = C.srv.server.store;
  const rec = (serverId && st.get('invitations', serverId)) || null;
  const pk = rec && rec.package ? rec.package : null;
  const ent = pk ? st.get('entitlements', pk.entitlement) : null;
  return {
    held: !!rec,
    pkg: pk ? { tier: pk.tier, account: pk.account, key: pk.key } : null,
    paid: ent ? { status: ent.status, invitationId: ent.invitationId, by: ent.by, cents: ent.cents } : null,
    payments: st.list('payments').length,
    outside: outside.slice()
  };
}
/** The stored invitation carries the package: this tier, this account, the console's invitation id; paid once, from the balance, at the server's price. */
const tookPackage = (s, C, one, tier, cents) =>
  !!s.pkg && s.pkg.tier === tier && s.pkg.account === (C.account || {}).id && s.pkg.key === one.id && !!s.paid && s.paid.status === 'consumed' && s.paid.invitationId === one.serverId && s.paid.by === 'credit' && s.paid.cents === cents && s.payments === 0 && s.outside.length === 0;
/** The viewport as it is (the frame's host page in the preview parts), with the box brought into view first. */
async function shot(A, p, name) {
  await p.locator('#iv-package-row').scrollIntoViewIfNeeded().catch(() => {});
  await A.page.screenshot({ path: path.join(SHOTS, name) });
}

/** The owner's preview: the portal framed with every connection refused, no server, at one size. */
async function preview({ check, S }, view) {
  const tap = view === 'phone';
  const { A, fr } = await F.framed(S, view);
  try {
    const size = A.page.viewportSize();
    check(`the window is ${F.VIEW[view].viewport.width}x${F.VIEW[view].viewport.height}${tap ? ' with touch' : ''}`, size.width === F.VIEW[view].viewport.width && size.height === F.VIEW[view].viewport.height && (await fr.evaluate(() => navigator.maxTouchPoints > 0)) === tap, size);
    await F.proveRefused(check, A, fr);
    await fr.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
    await fr.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
    await fr.waitForFunction(() => window.CVPortal && window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
    check('no integration server is connected', (await fr.evaluate(() => window.CVPortal.invitations.serverOn(window.CVPortal.state.ws))) === false);
    await openForm(fr);
    let b = await boxShown(fr);
    check('the box is on the invite form, under the email field, switched off', b.present && b.shown && b.disabled && !b.checked, b);
    check(`its label is "${LABEL}" (no price: no server has given one)`, b.label === LABEL, b.label);
    check(`one plain line under it: "${LINE_NO_SERVER}"`, b.line === LINE_NO_SERVER && !b.href && b.rows.length === 2, b);
    b = await tryTick(fr, tap);
    check('it cannot be ticked', b.checked === false && b.disabled === true, b);
    const f = await fit(fr);
    check('the box, its label and its line fit the width (no sideways scroll)', fits(f), f);
    await shot(A, fr, `preview-${view}-form.png`);
    const seen = [await F.noRawError(check, fr, 'the invite form')];

    // The form still sends: the sponsor's own email app, as before.
    const who = { first: 'Wilhelmina', last: 'Okonkwo', email: 'wilhelmina.okonkwo@example.net' };
    const it = await invite(fr, Object.assign({ package: true, tap }, who));
    await fr.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 }).catch(() => {});
    const dlg = await fr.evaluate(() => {
      const d = document.getElementById('dlg');
      return { open: !!(d && d.open), heading: d ? ((d.querySelector('.dlg-head h2') || {}).textContent || '').trim() : '' };
    });
    check('an invitation still sends by the sponsor\'s own email app (the email dialog opens)', dlg.open && dlg.heading === 'Invitation email' && !!it && it.emailStatus === 'manual' && !!it.link, { dlg, it });
    check('the invitation carries no package', !!it && it.ticked === false && it.pkg === null, it);
    seen.push(await F.noRawError(check, fr, 'the email dialog'));
    if (tap) await fr.tap('#dlg [data-action=close-dialog]');
    else await fr.click('#dlg [data-action=close-dialog]');
    await fr.waitForTimeout(400);
    check('the dialog closes', (await fr.evaluate(() => !!(document.getElementById('dlg') || {}).open)) === false);
    const row = it ? await rowText(fr, it.id) : '';
    check('the invitation is on the list, without the word "Package"', !!row && !/package/i.test(row), row);
    seen.push(await F.noRawError(check, fr, 'the list after sending'));
    check('nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
    F.leakFree(check, 'every screen of this part', seen.join('\n'));
  } finally {
    await A.context.close().catch(() => {});
  }
}

/* ---------- Plan 08-13: the list form ---------- */
/** "Import a list" open on the Investors page (p: the page, or the frame that holds the portal). */
async function openList(p) {
  await p.evaluate(() => (location.hash = '#console-investors'));
  await p.waitForSelector('[data-action=invite-toggle]', { timeout: 20000 });
  await p.evaluate(() => {
    const ui = window.CVPortal.state.ui;
    ui.inviteOpen = true;
    ui.inviteTab = 'bulk';
    window.CVPortal.app.render();
  });
  await p.waitForSelector('#iv-csv', { timeout: 10000 });
}
/** The list pasted and checked ("Check list"); resolves once "Send N invitations" is on screen. */
async function checkList(p, lines, tap) {
  await openList(p);
  await p.fill('#iv-csv', lines.join('\n'));
  if (tap) await p.tap('form[data-form="invite-bulk"] button[type=submit]');
  else await p.click('form[data-form="invite-bulk"] button[type=submit]');
  await p.waitForSelector('[data-action="invite-bulk-add"]', { timeout: 15000 });
  await p.waitForTimeout(300);
}
/** The list's box as the screen shows it. */
const bulkBox = (p) =>
  p.evaluate(() => {
    const row = document.getElementById('iv-bulkPackage-row');
    const input = document.getElementById('iv-bulkPackage');
    const shown = (el) => !!el && !el.hidden && !!(el.offsetWidth || el.offsetHeight);
    const label = document.getElementById('iv-bulkPackage-label');
    const line = document.getElementById('iv-bulkPackage-line');
    const a = line && line.querySelector('a');
    const send = document.querySelector('[data-action="invite-bulk-add"]');
    return {
      present: !!input,
      shown: shown(row) && shown(input),
      disabled: !!(input && input.disabled),
      checked: !!(input && input.checked),
      label: label ? label.innerText.trim() : '',
      line: shown(line) ? line.innerText.trim() : '',
      href: a ? a.getAttribute('href') : '',
      rows: shown(row) ? row.innerText.split('\n').map((x) => x.trim()).filter(Boolean) : [],
      send: send ? send.textContent.trim() : '',
      listed: document.querySelectorAll('.inv8-bulk-tbl tbody tr').length,
      error: Array.from(document.querySelectorAll('#iv-bulk-error')).map((e) => e.innerText.trim())
    };
  });
/** Waits until the list's box is on screen (the billing reply has arrived) or the time is up. */
async function bulkShown(p, ms) {
  await p
    .waitForFunction(() => {
      const row = document.getElementById('iv-bulkPackage-row');
      return !!row && !row.hidden && !!row.offsetWidth;
    }, null, { timeout: ms || 8000 })
    .catch(() => {});
  return bulkBox(p);
}
/** The server is asked again (as after a card change) and the page drawn from its answer. */
const reread = async (p) => {
  await p.evaluate(() => window.CVPortal.pkg.load(window.CVPortal.state.ws, true).then(() => window.CVPortal.app.render()));
  await p.waitForTimeout(400);
  return bulkBox(p);
};
/** Each email's newest invitation in the console: { email: { id, pkg, serverId, emailStatus } }. */
const byEmails = (p, emails) =>
  p.evaluate((emails) => {
    const ws = window.CVPortal.state.ws;
    const out = {};
    emails.forEach((e) => {
      const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === e.toLowerCase());
      const it = inv && (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
      // pkg: the invitation carries the package, as the sponsor's tick (true) or, once the server's list has reported it,
      // as the server's word ({ tier, status }, plan 08-05), which replaces the tick
      const word = it && it.package && typeof it.package === 'object' && it.package.tier ? it.package : null;
      out[e] = it ? { id: it.id, pkg: it.package === true || !!word, word, serverId: it.serverId || '', emailStatus: it.emailStatus } : null;
    });
    return out;
  }, emails);
const people = (n, tag) => Array.from({ length: n }, (_, k) => ({ first: `Pat${tag}${k}`, last: `Rowe${tag}${k}`, email: `pat.${tag}${k}@example.com` }));
const lineOf = (x, off) => [x.first, x.last, x.email].concat(off ? [off] : []).join(',');
const occurrences = (text, s) => text.split(s).length - 1;
/** The paying stand-in: the server's price for each item, as plan 08-04's server works it out. */
const payReply = (prices, paid) => (req) => {
  const items = (req.body && req.body.items) || [];
  const cents = items.reduce((n, it) => n + (prices[it.tier] || 0), 0);
  if (paid) paid.push(cents);
  return { status: 200, body: { paid: items.map((it) => it.key), chargedCents: cents, creditUsedCents: 0 } };
};

const parts = {
  single: async ({ check, S }) => {
    let slow = 0;
    const C = await consoleOn(
      S,
      check,
      F.VIEW.desktop,
      {
        'GET /v1/billing': async () => {
          if (slow) await new Promise((r) => setTimeout(r, slow));
          return { status: 200, body: BILLING() };
        },
        // The rows are the real server's (plan 08-05: package null, or { tier, status }); the check only counts the reads.
        'GET /v1/invitations': () => null
      },
      { account: true }
    );
    try {
      const p = C.page;
      await openForm(p);
      await chooseOffering(p, '');
      let b = await boxShown(p);
      check('the invite form holds one box named package, under the email field', b.present && b.shown && b.name === 'package' && (await p.locator('[name=package]').count()) === 1 && (await p.evaluate(() => {
        const email = document.getElementById('iv-email');
        const row = document.getElementById('iv-package-row');
        return !!(email && row && email.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING && row.getBoundingClientRect().top >= email.getBoundingClientRect().bottom);
      })), b);
      check('no offering: the box reads "Add verification package ($19)" (the server\'s identity price)', b.label === 'Add verification package ($19)' && !b.disabled && !b.checked && b.line === '', b);
      check('lean: the box\'s row says its label and nothing else', b.rows.length === 1 && b.rows[0] === b.label, b.rows);
      await chooseOffering(p, C.off.offeringId);
      b = await boxShown(p);
      check('a Rule 506(c) offering: the box reads "Add verification package ($99)" (the server\'s full price)', b.label === 'Add verification package ($99)' && !b.disabled, b);
      check('the price was asked of the server with the sponsor\'s token (GET /v1/billing)', !!C.token && C.token !== C.srv.token && C.stub.sent('GET /v1/billing').length >= 1 && C.stub.sent('GET /v1/billing').every((c) => c.auth === `Bearer ${C.token}`), C.stub.calls.map((c) => c.key));
      const seen = [await F.noRawError(check, p, 'the invite form', C.A.errors)];

      // Ticked and sent: what the server received (the intercepted request, on its way to the real server).
      const one = await invite(p, { first: 'Dana', last: 'Whitfield', email: 'dana.whitfield@example.com', offeringId: C.off.offeringId, package: true, beforeSend: () => shot(C.A, p, 'single-form.png') });
      let posts = C.stub.sent('POST /v1/invitations');
      const sent1 = posts.length === 1 ? packageOf(posts[0]) : {};
      check('ticked: the box was ticked and the invitation went to the integration server', one.ticked === true && /^ivt_/.test(one.serverId) && posts.length === 1, { one, posts: posts.length });
      check('ticked: the request the server received holds invitation.package true', sent1.package === true, sent1);
      check('ticked: the request holds invitation.clientId, the console\'s invitation id', !!one.id && sent1.clientId === one.id, { clientId: sent1.clientId, id: one.id });
      check('ticked: the request tells the server the offering needs verified accreditation (the full tier)', posts.length === 1 && ((posts[0].body || {}).verification || {}).accreditationRequired === true, posts.length === 1 ? (posts[0].body || {}).verification && posts[0].body.verification.accreditationRequired : null);
      const held = (await C.srv.rows()).find((x) => x.id === one.serverId);
      check('ticked: the real server holds the invitation', !!held && held.status === 'sent', held || null);
      const s1 = stored(C, one.serverId);
      check('ticked: the server took the package: the stored invitation carries it (full, this account, the console\'s invitation id), paid once from the balance at the server\'s price ($99), nothing sent to a payment provider', tookPackage(s1, C, one, 'full', 9900), s1);
      check('ticked: the server reports it as a paid package row', !!held && !!held.package && held.package.tier === 'full' && held.package.status === 'paid', held ? held.package : null);
      seen.push(await F.noRawError(check, p, 'after sending', C.A.errors));

      // Sent unticked: the request is as before.
      const two = await invite(p, { first: 'Ravi', last: 'Patel', email: 'ravi.patel@example.com', offeringId: C.off.offeringId });
      posts = C.stub.sent('POST /v1/invitations');
      const sent2 = posts.length === 2 ? packageOf(posts[1]) : null;
      check('unticked: the invitation went to the integration server', /^ivt_/.test(two.serverId) && posts.length === 2, { two, posts: posts.length });
      check('unticked: the request holds neither invitation.package nor invitation.clientId', !!sent2 && !('package' in sent2) && !('clientId' in sent2), sent2);
      check('unticked: the request keeps the fields it had before', !!sent2 && ['cents', 'cls', 'note', 'expiresAt', 'senderName'].every((k) => k in sent2), sent2 ? Object.keys(sent2) : null);
      const s2 = stored(C, two.serverId);
      check('unticked: the server stored it without a package, and nothing more was paid', s2.held && s2.pkg === null && C.srv.server.store.list('entitlements').length === 1, { s2, entitlements: C.srv.server.store.list('entitlements').length });

      // The form's controls do not change with the investor (phase 6's include-tax check, D-06): an investor on file keeps
      // the box, and its price is the one the server will be told to charge (holding a Rule 506(c) offering calls for
      // verified accreditation, the same answer the snapshot sends).
      const holder = await p.evaluate((oid) => {
        const ws = window.CVPortal.state.ws;
        const i = ws.investors.find((x) => x.onboarding.status === 'complete' && x.email && (x.positions || []).some((y) => y.offeringId === oid));
        return i ? i.email : '';
      }, C.off.offeringId);
      await openForm(p);
      await chooseOffering(p, '');
      await p.fill('#iv-email', 'someone.new@example.com');
      await p.waitForTimeout(300);
      const forNew = await boxShown(p);
      await p.fill('#iv-email', holder);
      await p.waitForTimeout(300);
      const forHolder = await box(p);
      check('an investor on file keeps the box; holding the Rule 506(c) offering their price is the full one ($99), a new investor\'s $19', !!holder && forNew.shown && forNew.label === 'Add verification package ($19)' && forHolder.shown && !forHolder.disabled && forHolder.label === 'Add verification package ($99)', { holder, forNew: forNew.label, forHolder });

      // The server is asked again (as after a card change) while the form is in use: the box stays as it was meanwhile.
      await p.fill('#iv-email', 'someone.new@example.com');
      await chooseOffering(p, C.off.offeringId);
      await boxShown(p);
      await p.check('#iv-package');
      const asked = C.stub.sent('GET /v1/billing').length;
      slow = 1500;
      await p.evaluate(() => void window.CVPortal.pkg.load(window.CVPortal.state.ws, true));
      await chooseOffering(p, ''); // the form is drawn again while the answer is on its way
      const mid = await box(p);
      slow = 0;
      await p.waitForTimeout(1800);
      const after = await box(p);
      check('asked again while the form is in use: the box stays shown and ticked meanwhile, and after the answer', C.stub.sent('GET /v1/billing').length === asked + 1 && mid.shown && mid.checked && mid.label === 'Add verification package ($19)' && after.shown && after.checked && !after.disabled, { asked: C.stub.sent('GET /v1/billing').length - asked, mid, after });
      await p.uncheck('#iv-package').catch(() => {});
      await p.fill('#iv-email', '');

      // The server's list reports the first invitation as a paid package row (the real server's own row).
      const before = C.stub.sent('GET /v1/invitations').length;
      await p.waitForSelector('[data-action=inv8-check]', { timeout: 10000 }).catch(() => {});
      await p.click('[data-action=inv8-check]').catch(() => {});
      await p.waitForFunction((id) => {
        const it = (window.CVPortal.state.ws.invitations || []).find((x) => x.id === id);
        return !!(it && it.package && it.package.status === 'paid');
      }, one.id, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(400);
      check('the console read the server\'s list again', C.stub.sent('GET /v1/invitations').length > before, C.stub.sent('GET /v1/invitations').length);
      const k1 = await invitationOf(p, 'dana.whitfield@example.com');
      check('the console holds the server\'s word on the package ({ tier full, status paid }), not only the sponsor\'s tick', !!k1 && !!k1.pkg && k1.pkg.tier === 'full' && k1.pkg.status === 'paid', k1 ? k1.pkg : null);
      const r1 = await rowText(p, one.id);
      const r2 = await rowText(p, two.id);
      check('the package invitation\'s row shows the word "Package"', /\bPackage\b/.test(r1), r1);
      check('the other invitation\'s row does not', !!r2 && !/package/i.test(r2), r2);
      seen.push(await F.noRawError(check, p, 'the list', C.A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await C.close();
    }
  },

  declined: async ({ check, S }) => {
    let answer = 'declined';
    const C = await consoleOn(
      S,
      check,
      F.VIEW.desktop,
      {
        'GET /v1/billing': () => ({ status: 200, body: BILLING() }),
        'POST /v1/invitations': () => (answer === 'declined' ? { status: 402, body: { error: DECLINED, code: 'card_declined' } } : null)
      },
      { account: true }
    );
    try {
      const p = C.page;
      const one = await invite(p, { first: 'Dana', last: 'Whitfield', email: 'dana.whitfield@example.com', offeringId: '', package: true });
      let posts = C.stub.sent('POST /v1/invitations');
      check('the ticked invitation was sent to the server once, with the flag and its id', one.ticked === true && posts.length === 1 && packageOf(posts[0]).package === true && packageOf(posts[0]).clientId === one.id, { one, posts: posts.map(packageOf) });
      const text = await F.noRawError(check, p, 'after the refused charge', C.A.errors);
      check(`the console shows the server's one plain sentence: "${DECLINED}"`, text.indexOf(DECLINED) >= 0, text.split('\n').filter((l) => /declin|could not/i.test(l)));
      check('no email dialog opens', (await p.locator('#dlg[open]').count()) === 0);
      check('no invitation email is prepared: no link, no token, nothing on the server', one.serverId === '' && one.link === '' && one.token === '' && one.emailStatus === 'failed' && (await C.srv.rows()).length === 0, { one, rows: (await C.srv.rows()).length });
      const row = await rowText(p, one.id);
      check('the invitation reads "Not sent yet"', /Not sent yet/.test(row) && row.indexOf(DECLINED) >= 0, row);

      // The card now goes through: the same invitation, sent again with its own button.
      answer = 'through';
      await p.click(`tr[data-invitation="${one.id}"] [data-action=inv8-resend]`);
      await p.waitForFunction((id) => !!((window.CVPortal.state.ws.invitations || []).find((x) => x.id === id) || {}).serverId, one.id, { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(500);
      posts = C.stub.sent('POST /v1/invitations');
      check('sending it again posts the same clientId, with the flag', posts.length === 2 && packageOf(posts[1]).clientId === one.id && packageOf(posts[1]).package === true, posts.map(packageOf));
      const rows = await C.srv.rows();
      const row2 = await rowText(p, one.id);
      check('the server now holds it and the row no longer reads "Not sent yet"', rows.length === 1 && !/Not sent yet/.test(row2) && row2.indexOf(DECLINED) < 0, { rows: rows.length, row2 });
      const again = await invitationOf(p, 'dana.whitfield@example.com');
      const s = stored(C, again && again.serverId);
      check('the server took the package with it (identity, no offering), paid once from the balance at its price ($19), nothing sent to a payment provider', !!again && tookPackage(s, C, again, 'identity', 1900), s);
      const text2 = await F.noRawError(check, p, 'after sending again', C.A.errors);
      F.leakFree(check, 'every screen of this part', [text, text2].join('\n'));
    } finally {
      await C.close();
    }
  },

  nocard: async ({ check, S }) => {
    let credit = 0;
    // Prices that are not the launch figures: the label can only have them from the server.
    const C = await consoleOn(S, check, F.VIEW.desktop, { 'GET /v1/billing': () => ({ status: 200, body: BILLING({ card: null, creditCents: credit, prices: { identity: 2500, full: 12550, reverify: 6900 } }) }) });
    try {
      const p = C.page;
      await openForm(p);
      await chooseOffering(p, '');
      let b = await boxShown(p);
      check('no card on file: the box is shown, switched off', b.shown && b.disabled && !b.checked, b);
      check('its label carries the server\'s price, whatever it is ($25 here: no figure comes from the browser\'s own code)', b.label === 'Add verification package ($25)', b.label);
      check(`one line under it: "${LINE_NO_CARD}"`, b.line === LINE_NO_CARD && b.rows.length === 2, b);
      check('the line\'s link goes to #console-integrations', b.href === '#console-integrations', b.href);
      b = await tryTick(p, false);
      check('it cannot be ticked', b.checked === false, b);
      await chooseOffering(p, C.off.offeringId);
      b = await boxShown(p);
      check('a price with cents is shown with its cents ($125.50 for the Rule 506(c) offering)', b.label === 'Add verification package ($125.50)', b.label);
      await shot(C.A, p, 'nocard-form.png');
      const seen = [await F.noRawError(check, p, 'the invite form', C.A.errors)];
      const one = await invite(p, { first: 'Dana', last: 'Whitfield', email: 'dana.whitfield@example.com', offeringId: '', package: true });
      const posts = C.stub.sent('POST /v1/invitations');
      check('an invitation sent from this form carries no package', one.ticked === false && posts.length === 1 && !('package' in packageOf(posts[0])) && !('clientId' in packageOf(posts[0])), posts.map(packageOf));
      await openForm(p);
      await boxShown(p);
      await p.click('#iv-package-line a');
      await p.waitForTimeout(600);
      check('following the link opens the Integrations page', (await p.evaluate(() => location.hash)) === '#console-integrations' && /Integrations/.test(await p.locator('h1').first().innerText().catch(() => '')), await p.evaluate(() => location.hash));
      seen.push(await F.noRawError(check, p, 'the Integrations page', C.A.errors));

      // A team member cannot open the Integrations page (admins only): the same line, with no link that leads nowhere.
      await p.selectOption('#demo-role', 'team');
      await p.waitForTimeout(400);
      const role = await p.evaluate(() => ({ role: window.CVPortal.state.role, configure: window.CVPortal.app.can('configure'), operate: window.CVPortal.app.can('operate') }));
      await openForm(p);
      await chooseOffering(p, '');
      b = await boxShown(p);
      check('a team member (no access to the Integrations page): the same line, without a link', role.role === 'team' && role.configure === false && role.operate === true && b.shown && b.disabled && b.line === LINE_NO_CARD && b.href === '', { role, b });
      seen.push(await F.noRawError(check, p, 'the invite form as a team member', C.A.errors));
      await p.selectOption('#demo-role', 'admin');
      await p.waitForTimeout(400);

      // A balance that covers the price pays for it (plan 08-04: credit first), so no card is needed.
      credit = 2500;
      await p.reload();
      await p.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 20000 });
      await openForm(p);
      await chooseOffering(p, '');
      b = await boxShown(p);
      check('a balance that covers the price: the box can be ticked, no line', b.shown && !b.disabled && b.line === '' && b.label === 'Add verification package ($25)', b);
      await chooseOffering(p, C.off.offeringId);
      b = await boxShown(p);
      check('a balance below the price: switched off again, with the line', b.shown && b.disabled && b.line === LINE_NO_CARD, b);
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await C.close();
    }
  },

  notoffered: async ({ check, S }) => {
    let mode = 'nobilling';
    const C = await consoleOn(S, check, F.VIEW.desktop, {
      // A server without billing (as before plan 08-04) answers the path as one it does not know; then a server whose
      // accreditation provider is not set up. The shared token's own answer (403 account_required) is part account's.
      'GET /v1/billing': () => (mode === 'nobilling' ? { status: 404, body: { error: 'Not found' } } : { status: 200, body: BILLING({ available: { identity: true, full: false, reverify: false } }) })
    });
    try {
      const p = C.page;
      const seen = [];
      const fresh = async () => {
        await p.reload();
        await p.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 20000 });
        await openForm(p);
      };
      await openForm(p);
      await chooseOffering(p, '');
      let b = await boxAfterAnswer(p, C.stub, 1);
      check('a server without billing (GET /v1/billing answers 404): no box', C.stub.sent('GET /v1/billing').length >= 1 && b.shown === false, b);
      await chooseOffering(p, C.off.offeringId);
      b = await boxAfterAnswer(p, C.stub, 1);
      check('a server without billing: no box for a Rule 506(c) offering either', b.shown === false, b);
      const text = await F.noRawError(check, p, 'a server without billing', C.A.errors);
      seen.push(text);
      check('the refusal is not put on the invite form', text.indexOf('Not found') < 0 && !/verification package/i.test(await p.locator('.inv8-form').innerText()), text.split('\n').filter((l) => /not found|verification package/i.test(l)));
      const one = await invite(p, { first: 'Dana', last: 'Whitfield', email: 'dana.whitfield@example.com', offeringId: C.off.offeringId, package: true });
      const posts = C.stub.sent('POST /v1/invitations');
      check('an invitation still sends, as before, with no package', one.ticked === false && /^ivt_/.test(one.serverId) && posts.length === 1 && !('package' in packageOf(posts[0])) && !('clientId' in packageOf(posts[0])), { one, sent: posts.map(packageOf) });

      mode = 'nofull';
      await fresh();
      await chooseOffering(p, C.off.offeringId);
      b = await boxAfterAnswer(p, C.stub, 2);
      check('available.full false: no box for a Rule 506(c) offering', C.stub.sent('GET /v1/billing').length >= 2 && b.shown === false, b);
      await chooseOffering(p, '');
      b = await boxShown(p);
      check('available.full false: the box is still there for an identity-tier invitation', b.shown && !b.disabled && b.label === 'Add verification package ($19)', b);
      seen.push(await F.noRawError(check, p, 'available.full false', C.A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await C.close();
    }
  },

  account: async ({ check, S }) => {
    // The shared token is the operator's own (plan 08-05): the integration server answers GET /v1/billing with its own
    // 403 account_required (no stand-in; the check only counts the reads). Once at 1280x800, once at 390x844 with touch.
    const seen = [];
    for (const view of ['desktop', 'phone']) {
      const tap = view === 'phone';
      const C = await consoleOn(S, check, F.VIEW[view], { 'GET /v1/billing': () => null });
      try {
        const p = C.page;
        const size = p.viewportSize();
        check(`${view}: the window is ${F.VIEW[view].viewport.width}x${F.VIEW[view].viewport.height}${tap ? ' with touch' : ''}`, size.width === F.VIEW[view].viewport.width && size.height === F.VIEW[view].viewport.height && (await p.evaluate(() => navigator.maxTouchPoints > 0)) === tap, size);
        const own = await C.srv.call('GET', '/v1/billing');
        check(`${view}: the server's own answer to the shared token is 403 account_required, "${ACCOUNT}"`, own.status === 403 && !!own.body && own.body.code === 'account_required' && own.body.error === ACCOUNT, own);
        await openForm(p);
        await chooseOffering(p, '');
        let b = await boxAfterAnswer(p, C.stub, 1);
        check(`${view}: the console asked the server with the shared token; the box is shown, switched off, "${LABEL}" (no price)`, C.stub.sent('GET /v1/billing').length >= 1 && C.stub.sent('GET /v1/billing').every((c) => c.auth === `Bearer ${C.srv.token}`) && b.present && b.shown && b.disabled && !b.checked && b.label === LABEL, b);
        check(`${view}: one plain line under it, the server's own sentence: "${ACCOUNT}"`, b.line === ACCOUNT && !b.href && b.rows.length === 2, b);
        b = await tryTick(p, tap);
        check(`${view}: it cannot be ticked`, b.checked === false && b.disabled === true, b);
        await chooseOffering(p, C.off.offeringId);
        b = await boxShown(p);
        check(`${view}: the same for a Rule 506(c) offering`, b.shown && b.disabled && !b.checked && b.label === LABEL && b.line === ACCOUNT && !b.href && b.rows.length === 2, b);
        b = await tryTick(p, tap);
        check(`${view}: it cannot be ticked there either`, b.checked === false && b.disabled === true, b);
        const f = await fit(p);
        check(`${view}: the box, its label and its line fit the width (no sideways scroll)`, fits(f), f);
        await shot(C.A, p, `account-${view}-form.png`);
        seen.push(await F.noRawError(check, p, `${view}: the invite form`, C.A.errors));

        const one = await invite(p, { first: 'Dana', last: 'Whitfield', email: 'dana.whitfield@example.com', offeringId: C.off.offeringId, package: true, tap });
        const posts = C.stub.sent('POST /v1/invitations');
        check(`${view}: an invitation still sends, with no package: the request holds neither invitation.package nor invitation.clientId`, !!one && one.ticked === false && one.pkg === null && /^ivt_/.test(one.serverId) && one.emailError.indexOf(ACCOUNT) < 0 && posts.length === 1 && !('package' in packageOf(posts[0])) && !('clientId' in packageOf(posts[0])), { one, sent: posts.map(packageOf) });
        const held = (await C.srv.rows()).find((x) => x.id === one.serverId);
        check(`${view}: the real server holds it, without a package`, !!held && held.status === 'sent' && held.package === null, held || null);
        const row = await rowText(p, one.id);
        check(`${view}: its row is on the list, without the word "Package"`, !!row && !/package/i.test(row), row);
        seen.push(await F.noRawError(check, p, `${view}: the list`, C.A.errors));
      } finally {
        await C.close();
      }
    }
    F.leakFree(check, 'every screen of this part', seen.join('\n'));
  },

  unreachable: async ({ check, S }) => {
    const dead = `http://127.0.0.1:${await Lib.freePort()}`;
    const C = await consoleOn(S, check, F.VIEW.desktop, {}, { allow: [dead] });
    try {
      const p = C.page;
      // The address on the Integrations settings is one nothing answers at.
      const on = await p.evaluate((dead) => {
        const NS = window.CVPortal;
        NS.integrations.ensure(NS.state.ws).server.url = dead;
        NS.app.save(true);
        return NS.invitations.serverOn(NS.state.ws);
      }, dead);
      check('a server address is set, and nothing answers there', on === true && (await fetch(dead + '/health').then(() => 'answered', () => 'refused')) === 'refused');
      await openForm(p);
      await chooseOffering(p, '');
      let b = await boxShown(p, 15000);
      check('the box is shown, switched off', b.shown && b.disabled && !b.checked, b);
      check(`its label is "${LABEL}" (no price: the server gave none)`, b.label === LABEL, b.label);
      check(`one line under it: "${LINE_UNREACHABLE}"`, b.line === LINE_UNREACHABLE && !b.href && b.rows.length === 2, b);
      b = await tryTick(p, false);
      check('it cannot be ticked', b.checked === false, b);
      check('the console did try the address it was given', C.A.net.allowed.some((x) => x === `GET ${dead}/v1/billing`), C.A.net.allowed.slice(0, 6));
      await shot(C.A, p, 'unreachable-form.png');
      const text = await F.noRawError(check, p, 'the invite form', C.A.errors);
      F.leakFree(check, 'every screen of this part', text);
    } finally {
      await C.close();
    }
  },

  'preview-desktop': (ctx) => preview(ctx, 'desktop'),
  'preview-phone': (ctx) => preview(ctx, 'phone'),

  phone: async ({ check, S }) => {
    const C = await consoleOn(S, check, F.VIEW.phone, { 'GET /v1/billing': () => ({ status: 200, body: BILLING() }) }, { account: true });
    try {
      const p = C.page;
      const size = p.viewportSize();
      check('the window is 390x844 with touch', size.width === 390 && size.height === 844 && (await p.evaluate(() => navigator.maxTouchPoints > 0)), size);
      await openForm(p);
      await chooseOffering(p, C.off.offeringId);
      const b = await boxShown(p);
      check('the box reads "Add verification package ($99)" for the Rule 506(c) offering', b.shown && !b.disabled && b.label === 'Add verification package ($99)', b);
      const f = await fit(p);
      check('the box and its label fit the width (no sideways scroll)', fits(f), f);
      const seen = [await F.noRawError(check, p, 'the invite form', C.A.errors)];
      const one = await invite(p, { first: 'Dana', last: 'Whitfield', email: 'dana.whitfield@example.com', offeringId: C.off.offeringId, package: true, tap: true, beforeSend: () => shot(C.A, p, 'phone-form.png') });
      const posts = C.stub.sent('POST /v1/invitations');
      check('a tap ticks it', one.ticked === true, one);
      check('the sent request carries the flag and the invitation\'s id', posts.length === 1 && packageOf(posts[0]).package === true && packageOf(posts[0]).clientId === one.id && /^ivt_/.test(one.serverId), { one, sent: posts.map(packageOf) });
      const s = stored(C, one.serverId);
      check('the server took the package: the stored invitation carries it (full), paid once from the balance at the server\'s price ($99), nothing sent to a payment provider', tookPackage(s, C, one, 'full', 9900), s);
      const row = await rowText(p, one.id);
      check('the invitation\'s row shows the word "Package"', /\bPackage\b/.test(row), row);
      const f2 = await p.evaluate(() => ({ width: innerWidth, page: document.documentElement.scrollWidth }));
      check('the list does not make the page scroll sideways', f2.page <= f2.width + 1, f2);
      seen.push(await F.noRawError(check, p, 'the list', C.A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await C.close();
    }
  },

  managed: async ({ check, S }) => {
    const A = await Lib.open(S, { context: F.VIEW.desktop });
    try {
      const p = A.page;
      await p.goto(`${S.origin}/index.html`);
      await p.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
      await p.goto(`${S.origin}/index.html`);
      await p.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 20000 });
      check('index.html is the managed edition', (await p.evaluate(() => window.CVPortal.EDITION.id)) === 'managed');
      await openForm(p);
      // C2: first the managed form itself (its email field on screen), then what it must not hold.
      check('the managed invite form is on screen (its email field is visible)', (await p.locator('form[data-form="invite-one"] #iv-email').isVisible()) && (await p.locator('form[data-form="invite-one"] #iv-last-name').count()) === 1);
      check('it holds no element named package and no #iv-package', (await p.locator('[name=package]').count()) === 0 && (await p.locator('#iv-package').count()) === 0 && (await p.locator('#iv-package-row').count()) === 0);
      const form = await p.locator('form[data-form="invite-one"]').innerText();
      check('its text says nothing about a package', !/package/i.test(form), form.split('\n').filter((l) => /package/i.test(l)));
      const api = await p.evaluate(() => {
        const NS = window.CVPortal;
        const b = NS.pkg.box(NS.state.ws, '');
        return { show: b.show, enabled: b.enabled, info: NS.pkg.info(NS.state.ws) };
      });
      check('the package code offers nothing in the managed edition', api.show === false && api.enabled === false && api.info === null, api);
      check('nothing outside the page was asked for', A.net.external.length === 0, A.net.external);
      // C-03: the managed edition's onboarding slices, as phase 6's STATUS MATH guards them.
      const r = spawnSync(process.execPath, [path.join(__dirname, '..', '..', '06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa', 'checks', 'status-math.js'), '--case', 'managed'], { encoding: 'utf8' });
      const last = String(r.stdout || '').trim().split('\n').pop();
      check('STATUS MATH\'s managed slices still pass (C-03)', r.status === 0 && last === 'STATUS MATH: PASS (cases run: 1)', last);
      check('no page error', A.errors.length === 0, A.errors);
      F.leakFree(check, 'the managed invite form', form);
    } finally {
      await A.context.close().catch(() => {});
    }
  },

  list: async ({ check, S }) => {
    const prices = { identity: 1900, full: 9900, reverify: 6900 };
    let full = false;
    const charged = [];
    const C = await consoleOn(
      S,
      check,
      F.VIEW.desktop,
      {
        'GET /v1/billing': () => ({ status: 200, body: BILLING({ prices, available: { identity: true, full, reverify: false } }) }),
        'POST /v1/billing/entitlements': payReply(prices, charged)
      },
      { account: true }
    );
    try {
      const p = C.page;
      // An investor on file holding the Rule 506(c) offering (their package is the full one), invited to it again.
      const holder = await p.evaluate((oid) => {
        const ws = window.CVPortal.state.ws;
        const i = ws.investors.find(
          (x) =>
            x.onboarding.status === 'complete' &&
            x.email &&
            /\s/.test(String(x.contact || '').trim()) &&
            (x.positions || []).some((y) => y.offeringId === oid) &&
            !(ws.invitations || []).some((y) => y.investorId === x.id && ['cancelled', 'completed'].indexOf(y.status) < 0) &&
            !(ws.requests || []).some((r) => r.investorId === x.id && r.offeringId === oid && r.status === 'pending')
        );
        if (!i) return null;
        const parts = String(i.contact).trim().split(/\s+/);
        return { first: parts[0], last: parts.slice(1).join(' '), email: i.email };
      }, C.off.offeringId);
      check('an investor on file holding the Rule 506(c) offering, free to be invited to it again', !!holder, holder);
      const fresh = people(3, 'l');
      const lines = fresh.map((x) => lineOf(x)).concat(holder ? [lineOf(holder, C.off.offeringId)] : []);
      await checkList(p, lines);
      let b = await bulkShown(p);
      check('four rows on the list, "Send 4 invitations"', b.listed === 4 && b.send === 'Send 4 invitations', b);
      check('the list\'s box: three rows can carry the package (the investor on file\'s full package is not offered), total $57', b.shown && !b.disabled && !b.checked && b.label === 'Add verification package to 3 invitations ($57)' && b.line === '', b);
      check('lean: the box says its label and nothing else', b.rows.length === 1 && b.rows[0] === b.label, b.rows);
      // The same rule as the single form: once the server offers the full package, the investor on file's row is counted
      // at its own price.
      full = true;
      b = await reread(p);
      check('the full package offered: four rows, each at its own price ($19 x 3 + $99 = $156)', b.label === 'Add verification package to 4 invitations ($156)', b.label);
      full = false;
      b = await reread(p);
      check('offered no longer: back to three rows, $57', b.label === 'Add verification package to 3 invitations ($57)' && !b.disabled, b.label);
      const seen = [await F.noRawError(check, p, 'the list form', C.A.errors)];

      await p.check('#iv-bulkPackage');
      const label = (await bulkBox(p)).label;
      await p.click('[data-action="invite-bulk-add"]');
      const all = fresh.concat(holder ? [holder] : []).map((x) => x.email);
      await p
        .waitForFunction((emails) => {
          const ws = window.CVPortal.state.ws;
          return emails.every((e) => {
            const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === e.toLowerCase());
            const it = inv && (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
            return !!(it && it.serverId);
          });
        }, all, { timeout: 60000 })
        .catch(() => {});
      await p.waitForTimeout(500);
      const got = await byEmails(p, all);
      const keys = (C.stub.sent('POST /v1/billing/entitlements')[0] || { body: {} }).body.items || [];
      const order = C.stub.calls.filter((c) => c.key === 'POST /v1/billing/entitlements' || c.key === 'POST /v1/invitations').map((c) => c.key);
      check('exactly one POST /v1/billing/entitlements, before the first POST /v1/invitations', C.stub.sent('POST /v1/billing/entitlements').length === 1 && order[0] === 'POST /v1/billing/entitlements' && order.filter((k) => k === 'POST /v1/invitations').length === 4, order);
      check('it was sent with the sponsor\'s token', !!C.token && C.token !== C.srv.token && (C.stub.sent('POST /v1/billing/entitlements')[0] || {}).auth === `Bearer ${C.token}`);
      const freshIds = fresh.map((x) => got[x.email] && got[x.email].id);
      check('its items are the three new investors\' client ids (their invitations\' ids), each at the identity tier', keys.length === 3 && keys.every((it) => it.tier === 'identity') && freshIds.every((id) => !!id && keys.some((it) => it.key === id)), { keys, freshIds });
      const hid = holder && got[holder.email] ? got[holder.email].id : '';
      check('P1: the investor on file\'s key is not in the payment and not in the total', !!hid && !keys.some((it) => it.key === hid) && label === 'Add verification package to 3 invitations ($57)', { hid, keys, label });
      check('the total shown ($57) is what the server charges for those items (5700 cents)', charged.length === 1 && charged[0] === 5700, charged);
      const posts = C.stub.sent('POST /v1/invitations').map(packageOf);
      const withPkg = posts.filter((x) => x.package === true).map((x) => x.clientId).sort();
      check('P1: the invitations sent with package true are exactly the rows paid for (same client ids)', JSON.stringify(withPkg) === JSON.stringify(keys.map((it) => it.key).sort()), { withPkg, keys });
      check('the investor on file\'s invitation is sent without the package', posts.filter((x) => !('package' in x) && !('clientId' in x)).length === 1, posts);
      check('the console\'s records agree: three invitations carry the package, the investor on file\'s does not', fresh.every((x) => got[x.email] && got[x.email].pkg) && !!holder && got[holder.email] && got[holder.email].pkg === false, got);
      const rows = await C.srv.rows();
      check('the real server holds the four invitations', all.every((e) => got[e] && rows.some((r) => r.id === got[e].serverId)), { rows: rows.length });
      const took = fresh.map((x) => got[x.email]).filter(Boolean).map((it) => ({ it, s: stored(C, it.serverId) }));
      const hs = holder && got[holder.email] ? stored(C, got[holder.email].serverId) : null;
      check('the server took the three packages: each stored invitation carries its own (identity, this account, its client id), paid from the balance at $19, nothing sent to a payment provider; the investor on file\'s carries none', took.length === 3 && took.every(({ it, s }) => tookPackage(s, C, it, 'identity', 1900)) && !!hs && hs.held && hs.pkg === null, { took: took.map((x) => x.s), hs });
      seen.push(await F.noRawError(check, p, 'after sending', C.A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await C.close();
    }
  },

  'list-declined': async ({ check, S }) => {
    const prices = { identity: 1900, full: 9900, reverify: 6900 };
    let billing = BILLING({ prices });
    let pay = () => ({ status: 402, body: { error: DECLINED, code: 'card_declined' } });
    let posted = 0;
    let quick = false;
    const C = await consoleOn(
      S,
      check,
      F.VIEW.desktop,
      {
        'GET /v1/billing': () => ({ status: billing.status || 200, body: billing.body || billing }),
        'POST /v1/billing/entitlements': (req) => pay(req),
        // Stubbed for the 205-row run only (each invitation answered here); otherwise the real server's.
        'POST /v1/invitations': () => (quick ? { status: 200, body: { id: `ivt_q${++posted}`, link: 'http://127.0.0.1/invite', emailStatus: 'sent', expiresAt: new Date(Date.now() + 864e5 * 30).toISOString() } } : null)
      },
      { account: true }
    );
    try {
      const p = C.page;
      const seen = [];
      // The list's box follows the single form's rules: no card, switched off with the line; 403 account_required (the
      // shared token), switched off with the server's sentence; not offered, no box.
      const two = people(2, 'n');
      billing = BILLING({ prices, card: null });
      await checkList(p, two.map((x) => lineOf(x)));
      let b = await bulkShown(p);
      check(`no card: the list's box switched off with the line "${LINE_NO_CARD}" (link to Integrations)`, b.shown && b.disabled && b.label === LABEL && b.line === LINE_NO_CARD && b.href === '#console-integrations' && b.rows.length === 2, b);
      seen.push(await F.noRawError(check, p, 'no card', C.A.errors));
      billing = { status: 403, body: { error: ACCOUNT, code: 'account_required' } };
      b = await reread(p);
      check(`403 account_required: the list's box switched off with the server's sentence "${ACCOUNT}", no link; "Send 2 invitations" stays`, b.shown && b.disabled && !b.checked && b.label === LABEL && b.line === ACCOUNT && !b.href && b.rows.length === 2 && b.send === 'Send 2 invitations', b);
      await p.locator('#iv-bulkPackage-row').click({ timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(200);
      b = await bulkBox(p);
      check('403 account_required: the list\'s box cannot be ticked', b.checked === false && b.disabled === true, b);
      seen.push(await F.noRawError(check, p, '403 account_required on the list form', C.A.errors));
      billing = BILLING({ prices });
      b = await reread(p);
      check('offered with a card: the box, $38 for two', b.shown && !b.disabled && b.label === 'Add verification package to 2 invitations ($38)', b);

      // A refused payment: nothing is sent, nothing is created, the list stays, the server's sentence once.
      const three = people(3, 'd');
      await checkList(p, three.map((x) => lineOf(x)));
      await bulkShown(p);
      await p.check('#iv-bulkPackage');
      const before = await p.evaluate(() => ({ invitations: (window.CVPortal.state.ws.invitations || []).length, investors: window.CVPortal.state.ws.investors.length, audit: (window.CVPortal.state.ws.audit || []).length }));
      await p.click('[data-action="invite-bulk-add"]');
      await p.waitForSelector('#iv-bulk-error', { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(600);
      const after = await p.evaluate(() => ({ invitations: (window.CVPortal.state.ws.invitations || []).length, investors: window.CVPortal.state.ws.investors.length, audit: (window.CVPortal.state.ws.audit || []).length }));
      b = await bulkBox(p);
      const text = await F.noRawError(check, p, 'after the refused payment', C.A.errors);
      seen.push(text);
      const first = (C.stub.sent('POST /v1/billing/entitlements')[0] || { body: {} }).body.items || [];
      check('one payment was asked for, for the three rows', C.stub.sent('POST /v1/billing/entitlements').length === 1 && first.length === 3, first);
      check('refused: no POST /v1/invitations', C.stub.sent('POST /v1/invitations').length === 0, C.stub.sent('POST /v1/invitations').length);
      check('refused: nothing created in the console (invitations, investors and the audit trail unchanged)', JSON.stringify(before) === JSON.stringify(after), { before, after });
      check('refused: the list stays as it was ("Send 3 invitations", three rows listed, the box still ticked)', b.send === 'Send 3 invitations' && b.listed === 3 && b.checked && b.shown, b);
      check(`refused: the server's sentence is shown once: "${DECLINED}"`, b.error.length === 1 && b.error[0] === DECLINED && occurrences(text, DECLINED) === 1, { error: b.error, n: occurrences(text, DECLINED) });

      // The card goes through: sent again, the same keys are paid (a payment that was not confirmed is never paid twice).
      pay = payReply(prices);
      await p.click('[data-action="invite-bulk-add"]');
      const emails = three.map((x) => x.email);
      await p
        .waitForFunction((emails) => emails.every((e) => {
          const ws = window.CVPortal.state.ws;
          const inv = ws.investors.find((i) => i.email === e);
          const it = inv && (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
          return !!(it && it.serverId);
        }), emails, { timeout: 60000 })
        .catch(() => {});
      await p.waitForTimeout(400);
      const again = (C.stub.sent('POST /v1/billing/entitlements')[1] || { body: {} }).body.items || [];
      const got = await byEmails(p, emails);
      check('sent again: the same three keys, and they are the invitations\' ids', JSON.stringify(again.map((x) => x.key).sort()) === JSON.stringify(first.map((x) => x.key).sort()) && emails.every((e) => got[e] && first.some((x) => x.key === got[e].id) && got[e].pkg), { first, again, got });
      check('sent again: three invitations posted, each with package true', C.stub.sent('POST /v1/invitations').length === 3 && C.stub.sent('POST /v1/invitations').every((c) => packageOf(c).package === true), C.stub.sent('POST /v1/invitations').length);
      const took = emails.map((e) => got[e]).filter(Boolean).map((it) => stored(C, it.serverId));
      check('sent again: the server took the three packages (each stored invitation carries its own, paid from the balance at $19, nothing sent to a payment provider)', took.length === 3 && emails.every((e) => got[e] && tookPackage(stored(C, got[e].serverId), C, got[e], 'identity', 1900)), took);
      b = await bulkBox(p);
      check('the sentence is gone once the list is sent', b.error.length === 0, b.error);

      // P5: 205 package rows are paid in groups of 200; each group is sent before the next is paid; a refused group stops.
      quick = true;
      const many = people(205, 'm');
      await checkList(p, many.map((x) => lineOf(x)));
      b = await bulkShown(p);
      check('205 rows: the box, $3,895 for 205', b.label === 'Add verification package to 205 invitations ($3,895)' && b.send === 'Send 205 invitations', b);
      await p.check('#iv-bulkPackage');
      let calls = 0;
      pay = (req) => (++calls === 1 ? payReply(prices)(req) : { status: 402, body: { error: DECLINED, code: 'card_declined' } });
      const mark = C.stub.calls.length;
      await p.click('[data-action="invite-bulk-add"]');
      await p.waitForSelector('#iv-bulk-error', { timeout: 240000 }).catch(() => {});
      await p.waitForTimeout(800);
      const seq = C.stub.calls.slice(mark).filter((c) => c.key === 'POST /v1/billing/entitlements' || c.key === 'POST /v1/invitations');
      const pays = seq.map((c, k) => (c.key === 'POST /v1/billing/entitlements' ? k : -1)).filter((k) => k >= 0);
      const g1 = seq[pays[0]] ? seq[pays[0]].body.items.length : 0;
      const g2 = seq[pays[1]] ? seq[pays[1]].body.items.length : 0;
      check('two payments: the first for 200 packages, the second for the 5 left', pays.length === 2 && g1 === 200 && g2 === 5, { pays, g1, g2 });
      check('the first group\'s 200 invitations were all sent before the second payment, none after it', pays[0] === 0 && pays[1] === 201 && seq.length === 202, { pays, n: seq.length });
      const sentKeys = seq.filter((c) => c.key === 'POST /v1/invitations').map((c) => packageOf(c).clientId);
      check('those 200 are the first group\'s rows, in order', seq[pays[0]] && JSON.stringify(sentKeys) === JSON.stringify(seq[pays[0]].body.items.map((x) => x.key)), sentKeys.length);
      b = await bulkBox(p);
      const text2 = await F.noRawError(check, p, 'after the refused second group', C.A.errors);
      seen.push(text2);
      const left = await byEmails(p, many.slice(200).map((x) => x.email));
      check('the refused group stops the list there: its 5 rows are not created and stay on the list ("Send 5 invitations")', Object.values(left).every((x) => x === null) && b.send === 'Send 5 invitations' && b.listed === 5, { left, send: b.send, listed: b.listed });
      check(`the server's sentence once: "${DECLINED}"`, b.error.length === 1 && b.error[0] === DECLINED && occurrences(text2, DECLINED) === 1, b.error);
      const sent = await byEmails(p, [many[0].email, many[199].email]);
      check('the first group\'s invitations are in the console, with the package', Object.values(sent).every((x) => x && x.pkg && /^ivt_q/.test(x.serverId)), sent);
      F.leakFree(check, 'every screen of this part (server mode)', seen.join('\n'));
    } finally {
      await C.close();
    }

    // The owner's preview: no server, every connection refused, 390x844 with touch.
    const { A, fr } = await F.framed(S, 'phone');
    try {
      await F.proveRefused(check, A, fr);
      await fr.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
      await fr.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
      await fr.waitForFunction(() => window.CVPortal && window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
      const two = people(2, 'v');
      await checkList(fr, two.map((x) => lineOf(x)), true);
      let b = await bulkShown(fr);
      check(`the preview: the list's box switched off, with the one line "${LINE_NO_SERVER}"`, b.shown && b.disabled && b.label === LABEL && b.line === LINE_NO_SERVER && !b.href && b.rows.length === 2, b);
      await fr.locator('#iv-bulkPackage-row').tap({ timeout: 5000 }).catch(() => {});
      b = await bulkBox(fr);
      check('the preview: it cannot be ticked', b.checked === false, b);
      const f = await fr.evaluate(() => {
        const r = document.getElementById('iv-bulkPackage-row').getBoundingClientRect();
        return { width: innerWidth, left: Math.round(r.left), right: Math.round(r.right), page: document.documentElement.scrollWidth };
      });
      check('the preview: the box fits the width', f.left >= 0 && f.right <= f.width && f.page <= f.width + 1, f);
      const seen = [await F.noRawError(check, fr, 'the preview list form')];
      await fr.tap('[data-action="invite-bulk-add"]');
      await fr.waitForTimeout(1200);
      const got = await byEmails(fr, two.map((x) => x.email));
      check('the preview: the list still sends, from the sponsor\'s own email app, with no package', Object.values(got).every((x) => x && x.emailStatus === 'manual' && !x.pkg), got);
      seen.push(await F.noRawError(check, fr, 'the preview after sending'));
      check('the preview: nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
      F.leakFree(check, 'every screen of the preview', seen.join('\n'));
    } finally {
      await A.context.close().catch(() => {});
    }
  }
};

Lib.runParts(parts, { name: 'PACKAGE INVITE', unit: 'parts', flag: '--only', browser: true });
