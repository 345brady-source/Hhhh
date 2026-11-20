#!/usr/bin/env node
// GATE CHECK: PACKAGE PANEL
// Plan 08-13 (D-01): the one "Verification package" panel on the sponsor's Integrations page: the prices, the card on file
// with Add card or Replace card and Remove, the credit, the charges, and a payment still being confirmed (08-CONTEXT P8).
// In the server parts the console is the sample self-serve portal connected to the real integration server
// (server/index.mjs in this process); the billing replies (plan 08-04's shapes) are stood in for by the check
// (frame.js stubServer), and the server's hosted card page by a stand-in page on the server's own origin.
//   panel            1280x800: exactly one panel with the server's prices, the card, the credit and three charges, each
//                    with its date, the investor's account name and its amount; nothing else; a payment being confirmed
//                    shows in one line, and nothing when there is none; so does an amount owed (08-16)
//   card             Add card opens the server's card page in the console's dialog; a "card saved" message from any other
//                    origin changes nothing; from the card page it closes the dialog and the card is read from the server;
//                    Replace card and Remove; nothing about the card is kept in the console
//   nocard           no card on file: the prices and "Add card" only
//   failures         card setup refused (409), the server unreachable, a 401, a card page on another origin: each one plain
//                    sentence; the shared token (403 account_required, the real server's own answer): one line; payments
//                    switched off on the server (ready false): no panel
//   dialog-phone     390x844 with touch: the card dialog fits the width, scrolls, and closes with its X, Escape and browser
//                    back, the Integrations page as it was and the server asked again each time
//   preview-desktop  the owner's preview (sandboxed frame refusing every connection, no server) at 1280x800 and at 390x844
//   preview-phone    with touch: the panel is its title and one line, no button, nothing attempted, no raw error
// Every part ends with the leak scan of the screens it saw (phase 6's leak check and frame.js's vendor scan).
//   NODE_PATH=$(npm root -g) node package-panel.js [--only panel,card,nocard,failures,dialog-phone,preview-desktop,preview-phone]
// The last line is "PACKAGE PANEL: PASS (parts run: N)" or "PACKAGE PANEL: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const F = require('./frame.js');
const Lib = F.Lib;

const SHOTS = path.join(Lib.OUT, 'package-panel-shots');
fs.mkdirSync(SHOTS, { recursive: true });
Lib.describeShots([
  ['panel-desktop.png', 'Server mode, 1280x800: the Verification package panel with the prices, the card, the credit and three charges.'],
  ['card-dialog.png', 'Server mode, 1280x800: Add card opens the server\'s card page inside the console\'s dialog.'],
  ['dialog-phone.png', 'Server mode at 390x844 with touch: the card dialog fits the width.'],
  ['preview-desktop.png', 'The owner\'s preview (sandboxed frame, no connection allowed, no server) at 1280x800: the panel and its one line.'],
  ['preview-phone.png', 'The owner\'s preview at 390x844 with touch: the panel and its one line.']
]);

const TITLE = 'Verification package';
const LINE_NO_SERVER = 'Checks run once your portal is connected to its server.';
const UNREACHABLE = 'The integration server could not be reached.';
const TOKEN = 'The integration server did not accept the access token.';
const NO_PAGE = 'The card page could not be opened. Try again.';
const ACCOUNT = 'Card payments need a sponsor account.';
const UNAVAILABLE = 'Card payments are not available right now. Nothing was charged.';
const SID = 'stand-in-session-0123456789abcdef';

const VISA = { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 };
const BILLING = (over) =>
  Object.assign({ ready: true, available: { identity: true, full: true, reverify: true }, card: VISA, currency: 'usd', prices: { identity: 1900, full: 9900, reverify: 6900 }, creditCents: 0, charges: [] }, over || {});

/** The sponsor's console on the sample portal, connected to the integration server, open on the Integrations page. */
async function consoleOn(S, check, view, handlers) {
  const srv = await Lib.serverPortal(S);
  const A = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({ acceptDownloads: true }, view) });
  const off = await Lib.setupPortal(S, A, { exemption: 'Rule 506(c)' });
  const stub = await F.stubServer(A.context, srv.base, handlers || {});
  // The server's hosted card page, stood in for on the server's own origin: "Save card" tells the console's page.
  const card = { pages: 0 };
  await A.context.route(`${srv.base}/billing/card/${SID}`, (route) => {
    card.pages++;
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card</title></head><body style="font:16px system-ui;margin:0;padding:16px"><h1 style="font-size:18px">Card</h1><div style="border:1px solid #bbb;height:44px"></div><button id="save" type="button" style="margin-top:12px">Save card</button><script>document.getElementById('save').addEventListener('click',function(){window.parent.postMessage({type:'cv-card-saved'},${JSON.stringify(S.origin)})})</script></body></html>`
    });
  });
  check('the console uses the integration server', (await srv.configure(A.page)) === true);
  return {
    srv,
    A,
    page: A.page,
    off,
    stub,
    card,
    cardUrl: `${srv.base}/billing/card/${SID}`,
    close: async () => {
      await A.context.close().catch(() => {});
      await srv.close().catch(() => {});
    }
  };
}

/** The Integrations page (p: a page, or the frame holding the portal), as an admin. */
async function integrations(p) {
  await p.evaluate(() => (location.hash = '#console-integrations'));
  await p.waitForTimeout(300);
  if (await p.locator('#demo-role').count()) {
    await p.selectOption('#demo-role', 'admin');
    await p.waitForTimeout(300);
    await p.evaluate(() => (location.hash = '#console-integrations'));
  }
  await p.waitForSelector('.cs-panel-head h2', { timeout: 20000 });
  await p.waitForTimeout(300);
}

/** The panel as the screen shows it (every section titled "Verification package"). */
const panel = (p) =>
  p.evaluate((TITLE) => {
    const secs = Array.from(document.querySelectorAll('section.cs-panel')).filter((s) => {
      const t = s.querySelector('.cs-panel-head h2');
      return t && t.textContent.trim() === TITLE;
    });
    const s = secs[0];
    const shown = (el) => !!el && !!(el.offsetWidth || el.offsetHeight);
    const text = s ? s.innerText : '';
    return {
      count: secs.length,
      shown: shown(s),
      text,
      lines: text.split('\n').map((x) => x.trim()).filter(Boolean),
      buttons: s ? Array.from(s.querySelectorAll('button')).filter(shown).map((b) => b.textContent.trim()) : [],
      rows: s ? Array.from(s.querySelectorAll('#pkg-charges tbody tr')).map((tr) => Array.from(tr.children).map((td) => td.innerText.trim())) : []
    };
  }, TITLE);
/** Waits until the panel shows (the billing reply has arrived and been drawn) or the time is up; resolves to the panel. */
async function panelShown(p, test, ms) {
  await p
    .waitForFunction(
      ({ TITLE, test }) => {
        const s = Array.from(document.querySelectorAll('section.cs-panel')).find((x) => (x.querySelector('.cs-panel-head h2') || {}).textContent === TITLE);
        return !!s && (!test || s.innerText.indexOf(test) >= 0);
      },
      { TITLE, test: test || '' },
      { timeout: ms || 8000 }
    )
    .catch(() => {});
  await p.waitForTimeout(200);
  return panel(p);
}
/** Waits until the console has asked GET /v1/billing n times, then for the answer to be drawn. */
async function asked(p, stub, n) {
  for (let i = 0; i < 80 && stub.sent('GET /v1/billing').length < n; i++) await p.waitForTimeout(100);
  await p.waitForTimeout(400);
  return stub.sent('GET /v1/billing').length;
}
const dlgOpen = (p) => p.evaluate(() => !!(document.getElementById('dlg') || {}).open);
const frameSrc = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#dlg[open] iframe')).map((f) => f.getAttribute('src')));
const sentence = (l) => /[.!?]$/.test(l);

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
    await integrations(fr);
    const b = await panelShown(fr);
    check(`exactly one panel titled "${TITLE}" on the Integrations page`, b.count === 1 && b.shown, b);
    check(`the panel is its title and one line: "${LINE_NO_SERVER}"`, b.lines.length === 2 && b.lines[0] === TITLE && b.lines[1] === LINE_NO_SERVER, b.lines);
    check('no button in the panel', b.buttons.length === 0, b.buttons);
    const f = await fr.evaluate(() => {
      const s = document.getElementById('pkg-panel').getBoundingClientRect();
      return { width: innerWidth, left: Math.round(s.left), right: Math.round(s.right), page: document.documentElement.scrollWidth };
    });
    check('the panel fits the width (no sideways scroll)', f.left >= 0 && f.right <= f.width && f.page <= f.width + 1, f);
    await fr.locator('#pkg-panel').scrollIntoViewIfNeeded().catch(() => {});
    await A.page.screenshot({ path: path.join(SHOTS, `preview-${view}.png`) });
    const text = await F.noRawError(check, fr, 'the Integrations page');
    // The menu still leaves the page (a way out on screen).
    await fr.evaluate(() => (location.hash = '#console-investors'));
    await fr.waitForSelector('[data-action=invite-toggle]', { timeout: 20000 }).catch(() => {});
    check('the page can be left for another console page', (await fr.evaluate(() => location.hash)) === '#console-investors' && (await fr.locator('#pkg-panel').count()) === 0);
    check('nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
    F.leakFree(check, 'every screen of this part', text);
  } finally {
    await A.context.close().catch(() => {});
  }
}

const parts = {
  panel: async ({ check, S }) => {
    let over = {};
    const C = await consoleOn(S, check, F.VIEW.desktop, { 'GET /v1/billing': () => ({ status: 200, body: BILLING(over) }) });
    try {
      const p = C.page;
      // Three of the console's own invitations, as the server knows them (their server ids).
      const names = await p.evaluate(() => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const invs = ws.investors.filter((i) => i.title).slice(0, 3);
        ws.invitations = ws.invitations || [];
        invs.forEach((inv, k) => ws.invitations.push({ id: `invt-panel-${k}`, investorId: inv.id, offeringId: '', cents: 0, cls: '', note: '', token: '', serverId: `ivt_panel${k}`, link: '', status: 'sent', stepKey: '', stepLabel: '', stepIndex: 0, stepCount: 0, sentAt: new Date().toISOString(), openedAt: '', completedAt: '', expiresAt: new Date(Date.now() + 864e5 * 30).toISOString(), emailStatus: 'sent', emailError: '', importedAt: '', sentBy: 'Test' }));
        NS.app.save(true);
        return invs.map((i) => i.title);
      });
      over = {
        creditCents: 1900,
        charges: [
          { at: '2026-11-18T15:00:00.000Z', type: 'package', by: 'card', cents: 9900, tier: 'full', invitationId: 'ivt_panel0' },
          { at: '2026-11-17T10:00:00.000Z', type: 'package', by: 'credit', cents: 1900, tier: 'identity', invitationId: 'ivt_panel1' },
          { at: '2026-11-12T09:00:00.000Z', type: 'credit', by: 'credit', cents: 1900, tier: 'identity', invitationId: 'ivt_panel2' }
        ]
      };
      check('three investors with an account name on file for the charges', names.length === 3, names);
      await integrations(p);
      const b = await panelShown(p, 'Replace card');
      check(`exactly one panel titled "${TITLE}"`, b.count === 1 && b.shown, b.count);
      check('the price was asked of the server with the sponsor\'s token (GET /v1/billing)', C.stub.sent('GET /v1/billing').length >= 1 && C.stub.sent('GET /v1/billing').every((c) => c.auth === `Bearer ${C.srv.token}`), C.stub.calls.map((c) => c.key));
      check('the prices: $19 and $99', /\$19\b/.test(b.text) && /\$99\b/.test(b.text), b.lines);
      check('the card: its brand, last four digits and expiry', /Visa/.test(b.text) && /4242/.test(b.text) && /12\/2030/.test(b.text), b.lines);
      check('"Replace card" and "Remove" are offered, not "Add card"', b.buttons.indexOf('Replace card') >= 0 && b.buttons.indexOf('Remove') >= 0 && b.buttons.indexOf('Add card') < 0, b.buttons);
      check('the credit: $19', b.lines.some((l) => /^Credit\b/.test(l) && /\$19\b/.test(l)), b.lines);
      check('three charge rows', b.rows.length === 3, b.rows);
      const want = [
        ['Nov 18, 2026', names[0], '$99'],
        ['Nov 17, 2026', names[1], '$19'],
        ['Nov 12, 2026', names[2], '$19']
      ];
      want.forEach((w, k) => {
        const r = b.rows[k] || [];
        check(`charge ${k + 1}: ${w.join(', ')} (date, the investor's account name for its invitation, amount)`, r.indexOf(w[0]) >= 0 && r.indexOf(w[1]) >= 0 && r.indexOf(w[2]) >= 0, r);
      });
      check('lean: no sentence in the panel (only the items)', !b.lines.some(sentence), b.lines.filter(sentence));
      await p.locator('#pkg-panel').scrollIntoViewIfNeeded().catch(() => {});
      await p.screenshot({ path: path.join(SHOTS, 'panel-desktop.png') });
      const seen = [await F.noRawError(check, p, 'the Integrations page', C.A.errors)];

      // P8: a payment still being confirmed shows in one line; with none, nothing.
      const redraw = async () => {
        await p.evaluate(() => window.CVPortal.pkg.load(window.CVPortal.state.ws, true).then(() => window.CVPortal.app.render()));
        await p.waitForTimeout(400);
        return panel(p);
      };
      over.unresolved = [{ at: '2026-11-19T08:00:00.000Z', cents: 9900 }];
      let u = await redraw();
      const line = 'A payment of $99 on Nov 19, 2026 is being confirmed.';
      check(`a payment being confirmed: one line "${line}"`, u.lines.filter((l) => l === line).length === 1 && u.lines.filter(sentence).length === 1, u.lines);
      seen.push(u.text);
      over.unresolved = [];
      u = await redraw();
      check('none being confirmed: no such line, no sentence', !u.lines.some((l) => /being confirmed/.test(l)) && !u.lines.some(sentence), u.lines);
      delete over.unresolved;
      u = await redraw();
      check('a server that does not send the list: no such line', !u.lines.some((l) => /being confirmed/.test(l)) && u.rows.length === 3, u.lines);
      // 08-16 (R9): an amount owed shows in one line; with none, nothing.
      over.owedCents = 1900;
      u = await redraw();
      check('an amount owed: one line "Amount owed $19"', u.lines.filter((l) => l === 'Amount owed $19').length === 1, u.lines);
      seen.push(u.text);
      over.owedCents = 0;
      u = await redraw();
      check('nothing owed: no such line', !u.lines.some((l) => /owed/i.test(l)), u.lines);
      delete over.owedCents;
      seen.push(await F.noRawError(check, p, 'after reading again', C.A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await C.close();
    }
  },

  card: async ({ check, S }) => {
    const st = { card: null };
    const C = await consoleOn(S, check, F.VIEW.desktop, {
      'GET /v1/billing': () => ({ status: 200, body: BILLING({ card: st.card }) }),
      'POST /v1/billing/card/setup': () => ({ status: 200, body: { url: C.cardUrl } }),
      'DELETE /v1/billing/card': () => {
        st.card = null;
        return { status: 200, body: { card: null } };
      }
    });
    try {
      const p = C.page;
      await integrations(p);
      let b = await panelShown(p, 'Add card');
      check('no card: "Add card"', b.buttons.indexOf('Add card') >= 0, b.buttons);
      await p.click('#pkg-panel [data-action=pkg-card]');
      await p.waitForSelector('#dlg[open] iframe', { timeout: 10000 }).catch(() => {});
      await p.waitForTimeout(600);
      check('Add card asked the server for a card page (POST /v1/billing/card/setup, the sponsor\'s token)', C.stub.sent('POST /v1/billing/card/setup').length === 1 && C.stub.sent('POST /v1/billing/card/setup')[0].auth === `Bearer ${C.srv.token}`);
      const src = await frameSrc(p);
      check('the dialog holds one frame, on the server\'s card page', (await dlgOpen(p)) && src.length === 1 && src[0] === C.cardUrl && C.card.pages === 1, { src, pages: C.card.pages });
      const own = await p.evaluate(() => ({
        inputs: Array.from(document.querySelectorAll('input')).filter((i) => /cc-|card/i.test(`${i.autocomplete} ${i.name} ${i.id}`)).length,
        scripts: Array.from(document.scripts).map((s) => s.src).filter((s) => s && !s.startsWith(location.origin))
      }));
      check('the console\'s own page holds no card field and loads no outside script', own.inputs === 0 && own.scripts.length === 0, own);
      await p.screenshot({ path: path.join(SHOTS, 'card-dialog.png') });
      const seen = [await F.noRawError(check, p, 'the card dialog', C.A.errors)];

      // A "card saved" message from another origin (here the console's own page) changes nothing.
      const before = C.stub.sent('GET /v1/billing').length;
      st.card = VISA;
      await p.evaluate(() => window.postMessage({ type: 'cv-card-saved' }, '*'));
      await p.waitForTimeout(800);
      check('a "cv-card-saved" message from another origin: the dialog stays open, the server is not asked, no card shown', (await dlgOpen(p)) && C.stub.sent('GET /v1/billing').length === before && !/4242/.test((await panel(p)).text), { open: await dlgOpen(p), asked: C.stub.sent('GET /v1/billing').length - before });

      // From the card page: the dialog closes and the card is read from the server.
      await p.frameLocator('#dlg iframe').locator('#save').click();
      await p.waitForFunction(() => !(document.getElementById('dlg') || {}).open, null, { timeout: 8000 }).catch(() => {});
      await asked(p, C.stub, before + 1);
      b = await panelShown(p, '4242');
      check('saved on the card page: the dialog closes', (await dlgOpen(p)) === false);
      check('the server was asked again and the panel shows the card from its answer', C.stub.sent('GET /v1/billing').length > before && /Visa/.test(b.text) && /4242/.test(b.text) && /12\/2030/.test(b.text) && b.buttons.indexOf('Replace card') >= 0, { asked: C.stub.sent('GET /v1/billing').length - before, lines: b.lines });
      seen.push(b.text);

      // Replace card: the same dialog; closed with its X, the server is asked again (P3).
      await p.click('#pkg-panel [data-action=pkg-card]');
      await p.waitForSelector('#dlg[open] iframe', { timeout: 10000 }).catch(() => {});
      check('Replace card opens the same card page', C.stub.sent('POST /v1/billing/card/setup').length === 2 && (await frameSrc(p))[0] === C.cardUrl);
      const n2 = C.stub.sent('GET /v1/billing').length;
      await p.click('#dlg [data-action=close-dialog]');
      await asked(p, C.stub, n2 + 1);
      check('closed with its X: the server is asked again', (await dlgOpen(p)) === false && C.stub.sent('GET /v1/billing').length === n2 + 1, C.stub.sent('GET /v1/billing').length - n2);

      // Remove: asked once, then DELETE /v1/billing/card, and the panel offers Add card again.
      await p.click('#pkg-panel [data-action=pkg-card-remove]');
      await p.waitForSelector('#dlg[open] [data-action=pkg-card-remove-confirm]', { timeout: 8000 }).catch(() => {});
      const ask = await p.evaluate(() => (document.querySelector('#dlg[open]') || {}).innerText || '');
      check('Remove asks once before removing', /Remove card/.test(ask) && C.stub.sent('DELETE /v1/billing/card').length === 0, ask);
      seen.push(ask);
      await p.click('#dlg [data-action=pkg-card-remove-confirm]');
      b = await panelShown(p, 'Add card');
      check('removed: DELETE /v1/billing/card once, the dialog closed, the panel offers "Add card" and shows no card', C.stub.sent('DELETE /v1/billing/card').length === 1 && (await dlgOpen(p)) === false && b.buttons.indexOf('Add card') >= 0 && !/4242/.test(b.text), { del: C.stub.sent('DELETE /v1/billing/card').length, b: b.lines });

      // T-08-34: nothing about the card is kept by the console; package.js names no payment script or vendor.
      const kept = await p.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).join('\n'));
      check('nothing about the card is saved with the workspace (no last four digits in storage)', kept.indexOf('4242') < 0 && kept.indexOf('cv-card-saved') < 0);
      const src2 = fs.readFileSync(path.join(Lib.ROOT, 'assets/js/package.js'), 'utf8');
      const v = F.vendorScan(src2);
      check('assets/js/package.js names no vendor and loads no payment script (no outside address, no script element)', v.ok && !/https?:\/\//.test(src2) && !/createElement\(\s*['"]script/.test(src2) && !/<script/i.test(src2), v.hits);
      seen.push(await F.noRawError(check, p, 'after removing', C.A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await C.close();
    }
  },

  nocard: async ({ check, S }) => {
    const C = await consoleOn(S, check, F.VIEW.desktop, { 'GET /v1/billing': () => ({ status: 200, body: BILLING({ card: null }) }) });
    try {
      const p = C.page;
      await integrations(p);
      const b = await panelShown(p, 'Add card');
      check(`one panel titled "${TITLE}"`, b.count === 1 && b.shown, b.count);
      check('the prices', /\$19\b/.test(b.text) && /\$99\b/.test(b.text), b.lines);
      check('"Add card" is the only button', b.buttons.length === 1 && b.buttons[0] === 'Add card', b.buttons);
      check('no card, no credit, no charges shown', !/ending|expires|Credit/.test(b.text) && b.rows.length === 0, b.lines);
      check('lean: no sentence in the panel', !b.lines.some(sentence), b.lines);
      const text = await F.noRawError(check, p, 'the Integrations page', C.A.errors);
      F.leakFree(check, 'every screen of this part', text);
    } finally {
      await C.close();
    }
  },

  failures: async ({ check, S }) => {
    let setup = null;
    let billing = () => ({ status: 200, body: BILLING() });
    const C = await consoleOn(S, check, F.VIEW.desktop, {
      'GET /v1/billing': () => billing(),
      'POST /v1/billing/card/setup': () => setup()
    });
    try {
      const p = C.page;
      const seen = [];
      await integrations(p);
      await panelShown(p, 'Replace card');
      const tryCard = async (label, reply, want) => {
        setup = () => reply;
        const n = C.stub.sent('POST /v1/billing/card/setup').length;
        await p.click('#pkg-panel [data-action=pkg-card]');
        await p.waitForTimeout(900);
        const b = await panel(p);
        const err = b.lines.filter(sentence);
        check(`${label}: the panel shows one plain sentence: "${want}"`, C.stub.sent('POST /v1/billing/card/setup').length === n + 1 && err.length === 1 && err[0] === want, err);
        check(`${label}: no dialog, no status number on its own`, (await dlgOpen(p)) === false && !b.lines.some((l) => /\b[45]\d\d\b/.test(l)), b.lines);
        seen.push(await F.noRawError(check, p, label, C.A.errors));
      };
      await tryCard('card setup refused (409 billing_unavailable)', { status: 409, body: { error: UNAVAILABLE, code: 'billing_unavailable' } }, UNAVAILABLE);
      await tryCard('the server unreachable', { refuse: true }, UNREACHABLE);
      await tryCard('a 401', { status: 401, body: { error: 'Not authorized' } }, TOKEN);
      await tryCard('a card page on another origin', { status: 200, body: { url: 'https://elsewhere.example/billing/card/' + SID } }, NO_PAGE);

      // The shared token: the real server's own answer (403 account_required) is one line.
      billing = () => null;
      const own = await C.srv.call('GET', '/v1/billing');
      await p.evaluate(() => window.CVPortal.pkg.load(window.CVPortal.state.ws, true).then(() => window.CVPortal.app.render()));
      let b = await panelShown(p, ACCOUNT);
      check(`the shared token: the server answers 403 account_required, and the panel is its title and one line "${ACCOUNT}"`, own.status === 403 && own.body && own.body.code === 'account_required' && b.count === 1 && b.lines.length === 2 && b.lines[1] === ACCOUNT && b.buttons.length === 0, { own, lines: b.lines });
      seen.push(await F.noRawError(check, p, '403 account_required', C.A.errors));

      // Payments switched off on the server: no panel.
      billing = () => ({ status: 200, body: BILLING({ ready: false, available: { identity: false, full: false, reverify: false } }) });
      await p.evaluate(() => window.CVPortal.pkg.load(window.CVPortal.state.ws, true).then(() => window.CVPortal.app.render()));
      await p.waitForTimeout(400);
      b = await panel(p);
      check('ready false: no panel', b.count === 0, b);
      seen.push(await F.noRawError(check, p, 'ready false', C.A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await C.close();
    }
  },

  'dialog-phone': async ({ check, S }) => {
    const C = await consoleOn(S, check, F.VIEW.phone, {
      'GET /v1/billing': () => ({ status: 200, body: BILLING() }),
      'POST /v1/billing/card/setup': () => ({ status: 200, body: { url: C.cardUrl } })
    });
    try {
      const p = C.page;
      const size = p.viewportSize();
      check('the window is 390x844 with touch', size.width === 390 && size.height === 844 && (await p.evaluate(() => navigator.maxTouchPoints > 0)), size);
      await integrations(p);
      await panelShown(p, 'Replace card');
      const seen = [];
      const page = () => p.evaluate(() => ({ hash: location.hash, panel: !!document.getElementById('pkg-panel'), h1: (document.querySelector('h1') || {}).textContent || '' }));
      const start = await page();
      const open = async () => {
        await p.locator('#pkg-panel [data-action=pkg-card]').scrollIntoViewIfNeeded();
        await p.tap('#pkg-panel [data-action=pkg-card]');
        await p.waitForSelector('#dlg[open] iframe', { timeout: 10000 }).catch(() => {});
        await p.waitForTimeout(500);
        return dlgOpen(p);
      };
      check('a tap on Replace card opens the dialog', await open());
      const g = await p.evaluate(() => {
        const d = document.getElementById('dlg');
        const r = d.getBoundingClientRect();
        const b = d.querySelector('.dlg-body');
        const f = d.querySelector('iframe').getBoundingClientRect();
        return { width: innerWidth, height: innerHeight, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), frame: { left: Math.round(f.left), right: Math.round(f.right) }, overflowY: getComputedStyle(b).overflowY, scrollH: b.scrollHeight, clientH: b.clientHeight, page: document.documentElement.scrollWidth };
      });
      check('the dialog and its frame fit the width', g.left >= 0 && g.right <= g.width && g.frame.left >= g.left && g.frame.right <= g.right, g);
      check('the dialog fits the height and its content scrolls (overflow auto or scroll)', g.top >= 0 && g.bottom <= g.height && /auto|scroll/.test(g.overflowY), g);
      // Scrolled the way a finger does: the end of the dialog's content comes into view.
      await p.evaluate(() => {
        const b = document.querySelector('#dlg .dlg-body');
        b.scrollTop = b.scrollHeight;
      });
      const end = await p.evaluate(() => {
        const b = document.querySelector('#dlg .dlg-body');
        const f = document.querySelector('#dlg iframe').getBoundingClientRect();
        const r = b.getBoundingClientRect();
        return { frameBottom: Math.round(f.bottom), bodyBottom: Math.round(r.bottom) };
      });
      check('scrolled to its end, the whole card page is in view', end.frameBottom <= end.bodyBottom + 1, end);
      await p.screenshot({ path: path.join(SHOTS, 'dialog-phone.png') });
      seen.push(await F.noRawError(check, p, 'the dialog', C.A.errors));

      const ways = [
        ['its X', () => p.tap('#dlg [data-action=close-dialog]')],
        ['Escape', () => p.keyboard.press('Escape')],
        ['browser back', () => p.evaluate(() => history.back())]
      ];
      for (const [how, act] of ways) {
        if (!(await dlgOpen(p))) await open();
        const n = C.stub.sent('GET /v1/billing').length;
        await act();
        await p.waitForFunction(() => !(document.getElementById('dlg') || {}).open, null, { timeout: 5000 }).catch(() => {});
        await asked(p, C.stub, n + 1);
        const now = await page();
        check(`closed with ${how}: the Integrations page as it was, and the server asked again`, (await dlgOpen(p)) === false && now.hash === start.hash && now.panel && now.h1 === start.h1 && C.stub.sent('GET /v1/billing').length === n + 1, { now, start, asked: C.stub.sent('GET /v1/billing').length - n });
      }
      seen.push(await F.noRawError(check, p, 'after closing', C.A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await C.close();
    }
  },

  'preview-desktop': (ctx) => preview(ctx, 'desktop'),
  'preview-phone': (ctx) => preview(ctx, 'phone')
};

Lib.runParts(parts, { name: 'PACKAGE PANEL', unit: 'parts', flag: '--only', browser: true });
