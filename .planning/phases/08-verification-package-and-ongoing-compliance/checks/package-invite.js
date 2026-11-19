#!/usr/bin/env node
// GATE CHECK: PACKAGE INVITE
// Plan 08-06 (D-01): the one tick box "Add verification package" on the sponsor's invite form. The sponsor's console is the
// sample self-serve portal connected to the real integration server (server/index.mjs in this process); the billing
// replies of plans 08-04 and 08-05 are stood in for by the check (frame.js stubServer), every other call is the server's.
//   single   1280x800: the label carries the server's price for this invitation ($19 without an offering, $99 for a
//            Rule 506(c) offering); ticked, the request the server receives holds invitation.package true and
//            invitation.clientId (the console's invitation id); unticked, neither; a row the server reports as a package
//            row shows the word "Package"
//   NODE_PATH=$(npm root -g) node package-invite.js [--only single]
// The last line is "PACKAGE INVITE: PASS (parts run: N)" or "PACKAGE INVITE: FAIL (parts run: N) - <failed parts>".
const F = require('./frame.js');
const Lib = F.Lib;

const BILLING = (over) =>
  Object.assign(
    { ready: true, available: { identity: true, full: true, reverify: true }, card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 }, currency: 'usd', prices: { identity: 1900, full: 9900, reverify: 6900 }, creditCents: 0, charges: [] },
    over || {}
  );

/** The sponsor's console on the sample portal (a Rule 506(c) offering raising), connected to the integration server. */
async function consoleOn(S, check, view, handlers) {
  const srv = await Lib.serverPortal(S);
  const A = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({ acceptDownloads: true }, view) });
  const off = await Lib.setupPortal(S, A, { exemption: 'Rule 506(c)' });
  const stub = await F.stubServer(A.context, srv.base, Object.assign({ 'POST /v1/invitations': () => null }, handlers));
  check('the console uses the integration server', (await srv.configure(A.page)) === true);
  return {
    srv,
    A,
    page: A.page,
    off,
    stub,
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
      href: a ? a.getAttribute('href') : ''
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

/** The console's newest invitation for this email, as the page holds it. */
const invitationOf = (p, email) =>
  p.evaluate((email) => {
    const ws = window.CVPortal.state.ws;
    const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
    const it = inv && (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
    return it ? { id: it.id, serverId: it.serverId || '', emailStatus: it.emailStatus, emailError: it.emailError || '', token: it.token || '', pkg: it.package === undefined ? null : it.package } : null;
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
  await p.click('.inv8-form[data-form="invite-one"] button[type=submit]');
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

const parts = {
  single: async ({ check, S }) => {
    const paid = {};
    const C = await consoleOn(S, check, F.VIEW.desktop, {
      'GET /v1/billing': () => ({ status: 200, body: BILLING() }),
      // Rows as plan 08-05's server reports them: package null, or { tier, status } for a paid package invitation.
      'GET /v1/invitations': () => ({ amend: (rows) => (Array.isArray(rows) ? rows.map((r) => Object.assign({}, r, { package: paid[r.id] || null })) : rows) })
    });
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
      await chooseOffering(p, C.off.offeringId);
      b = await boxShown(p);
      check('a Rule 506(c) offering: the box reads "Add verification package ($99)" (the server\'s full price)', b.label === 'Add verification package ($99)' && !b.disabled, b);
      check('the price was asked of the server with the sponsor\'s token (GET /v1/billing)', C.stub.sent('GET /v1/billing').length >= 1 && C.stub.sent('GET /v1/billing').every((c) => c.auth === `Bearer ${C.srv.token}`), C.stub.calls.map((c) => c.key));

      // Ticked and sent: what the server received (the intercepted request, on its way to the real server).
      const one = await invite(p, { first: 'Dana', last: 'Whitfield', email: 'dana.whitfield@example.com', offeringId: C.off.offeringId, package: true });
      let posts = C.stub.sent('POST /v1/invitations');
      const sent1 = posts.length === 1 ? (posts[0].body || {}).invitation || {} : {};
      check('ticked: the box was ticked and the invitation went to the integration server', one.ticked === true && /^ivt_/.test(one.serverId) && posts.length === 1, { one, posts: posts.length });
      check('ticked: the request the server received holds invitation.package true', sent1.package === true, sent1);
      check('ticked: the request holds invitation.clientId, the console\'s invitation id', !!one.id && sent1.clientId === one.id, { clientId: sent1.clientId, id: one.id });
      check('ticked: the request tells the server the offering needs verified accreditation (the full tier)', posts.length === 1 && ((posts[0].body || {}).verification || {}).accreditationRequired === true, posts.length === 1 ? (posts[0].body || {}).verification && posts[0].body.verification.accreditationRequired : null);
      const held = (await C.srv.rows()).find((x) => x.id === one.serverId);
      check('ticked: the real server holds the invitation', !!held && held.status === 'sent', held || null);

      // Sent unticked: the request is as before.
      const two = await invite(p, { first: 'Ravi', last: 'Patel', email: 'ravi.patel@example.com', offeringId: C.off.offeringId });
      posts = C.stub.sent('POST /v1/invitations');
      const sent2 = posts.length === 2 ? (posts[1].body || {}).invitation || {} : null;
      check('unticked: the invitation went to the integration server', /^ivt_/.test(two.serverId) && posts.length === 2, { two, posts: posts.length });
      check('unticked: the request holds neither invitation.package nor invitation.clientId', !!sent2 && !('package' in sent2) && !('clientId' in sent2), sent2);
      check('unticked: the request keeps the fields it had before', !!sent2 && ['cents', 'cls', 'note', 'expiresAt', 'senderName'].every((k) => k in sent2), sent2 ? Object.keys(sent2) : null);

      // The server's list reports the first invitation as a paid package row.
      if (one.serverId) paid[one.serverId] = { tier: 'full', status: 'paid' };
      const before = C.stub.sent('GET /v1/invitations').length;
      await p.waitForSelector('[data-action=inv8-check]', { timeout: 10000 }).catch(() => {});
      await p.click('[data-action=inv8-check]').catch(() => {});
      await p.waitForFunction((id) => {
        const it = (window.CVPortal.state.ws.invitations || []).find((x) => x.id === id);
        return !!(it && it.package && it.package.status === 'paid');
      }, one.id, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(400);
      check('the console read the server\'s list again', C.stub.sent('GET /v1/invitations').length > before, C.stub.sent('GET /v1/invitations').length);
      const r1 = await rowText(p, one.id);
      const r2 = await rowText(p, two.id);
      check('the package invitation\'s row shows the word "Package"', /\bPackage\b/.test(r1), r1);
      check('the other invitation\'s row does not', !!r2 && !/package/i.test(r2), r2);
      check('no page error', C.A.errors.length === 0, C.A.errors);
    } finally {
      await C.close();
    }
  }
};

Lib.runParts(parts, { name: 'PACKAGE INVITE', unit: 'parts', flag: '--only', browser: true });
