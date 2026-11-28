#!/usr/bin/env node
// Plan 06-34: walkthrough-2 failure N1 (two "Form W-9 … _signed.pdf · with certificate of completion" rows, one of them a
// form finished without a signature) and the remainder of walkthrough failure 1 (with IndexedDB absent the investor stops
// at the agreement step with only Back). Plan-check additions B1 and B2 (06-CONTEXT.md): a replaced signed tax form is kept
// as superseded, never deleted; an unsigned subscription can never be approved.
// The browser parts run the portal the way the owner does: inside the artifact host's sandboxed iframe whose policy refuses
// every fetch (the frame of safari-finish.js), at 1280x800 with a mouse (-desktop) or at 390x844 with touch and an iOS
// user agent (-phone; the controls under test are tapped, the signature drawn with a finger). Each such part first proves
// the frame refuses a fetch of a file that exists. import-desktop runs on the server-mode harness (server-mode.js): the
// console and the investor's device are two browsers that reach nothing but the integration server.
// Every part also checks: no script error, no request outside, no vendor name and never the forbidden word on any screen
// it reads. Names, addresses and documents are invented; no taxpayer ID is typed anywhere.
//   request-desktop, request-phone  N1 exactly: an investor on file, invited with "Include tax form", finishes the W-9
//                   without signing and finishes the subscription; the firm's "Request tax form"; the investor draws a
//                   signature and finishes. Documents, the firm's row and the record hold one tax form, the signed one; the
//                   earlier unsigned envelope is voided with the reason and its files are gone.
//   unsigned-twice-desktop  the requested form is finished unsigned again: no tax row anywhere, the record on the newest
//                   form (not signed), the earlier one voided and its files gone, "Request tax form" still offered.
//   signed-kept-desktop     an investor with a signed W-9 on file finishes a new one unsigned (an invitation with "Include
//                   tax form"): the record, Documents and the firm's row keep the signed form; the new one is voided with
//                   "Finished without a signature; the signed Form W-9 on file stays" and its files are gone.
//   import-desktop  server mode: an investor on file whose signed W-9 the console holds signs a new one on their device;
//                   after the import the console lists one tax form (the new one); the earlier signed form is kept as
//                   superseded with its signed copy, and not listed (B1).
//   lost-phone, lost-desktop  failure 1: no IndexedDB and the frame loaded again before the agreement step. The step keeps
//                   its honest line and Back and offers "Continue and sign later"; the done screen says what happens; the
//                   firm is notified and the change log says to add the agreement again; Approve is refused while the
//                   agreement is unsigned (B2); the firm adds the agreement again from the offering page; the investor
//                   signs the new copy from "Waiting for your signature"; Approve then works and the firm countersigns.
//                   An agreement in the same offering whose file is still here is not touched.
//   NODE_PATH=$(npm root -g) node record-and-lost-agreement.js [--only request-desktop,request-phone,...]
// The last line is "RECORD AND LOST AGREEMENT: PASS (parts run: N)" or "RECORD AND LOST AGREEMENT: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Lib = require('./lib.js');
const SF = require('./safari-finish.js');

const OUT = path.join(Lib.OUT, 'record-and-lost-agreement');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-docs-before\.png$/, 'The investor’s Documents after the W-9 was finished without a signature: no tax form under "Signed documents".'],
  [/-docs-after\.png$/, 'The investor’s Documents after signing the requested W-9: one "Form W-9" row, the signed one.'],
  [/-w9-open\.png$/, 'The one W-9 row opened from Documents: the signed form, drawn in the page.'],
  [/-console-row\.png$/, 'The firm’s Investors page: the investor’s row reads "W-9 signed … Download".'],
  [/-lost-step\.png$/, 'IndexedDB absent, frame loaded again: the agreement step says this browser did not keep the file, with Back and "Continue and sign later".'],
  [/-lost-done\.png$/, 'After "Continue and sign later": the done screen says the subscription is recorded and what happens next.'],
  [/-lost-notified\.png$/, 'The firm’s Notifications page: the investor could not see the subscription agreement; add it again from the offering page.'],
  [/-lost-refused\.png$/, 'The firm’s Requests page: Approve refused while the agreement is not signed; the row reads "Agreement not signed".'],
  [/-lost-waiting\.png$/, 'After the firm added the agreement again: the investor’s Documents lists it under "Waiting for your signature".'],
  [/-lost-signing\.png$/, 'The agreement added again, opened from Documents with its pages drawn.']
]);

const { DESKTOP, IPHONE, press } = SF;
const tagOf = (dev) => (dev === IPHONE ? 'phone' : 'desktop');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const KEPT = /This browser did not keep/;
const REPLACED = /^Replaced by the Form W-9 (signed|finished) on [A-Z][a-z]+ \d{1,2}, \d{4}$/;
const KEPT_SIGNED = 'Finished without a signature; the signed Form W-9 on file stays';
const REISSUED = 'This browser did not keep the agreement’s file; a new copy was prepared from the agreement added again';

/* ---------- the frame, the screens, the leak check ---------- */
const PROBE = 'frame-probe';
const scriptErrors = (A) => A.errors.filter((e) => e.indexOf(PROBE) < 0);
async function proveFrame(check, fr, dev) {
  const r = await fr.evaluate((probe) =>
    fetch('assets/forms/SHA256SUMS?' + probe, { cache: 'no-store' })
      .then(
        (x) => 'fetched ' + x.status,
        (e) => 'refused: ' + String(e && e.message)
      )
      .then((f) => ({ fetch: f, sandbox: window.top !== window && !!window.frameElement ? window.frameElement.getAttribute('sandbox') || '' : '', w: innerWidth, h: innerHeight, touch: navigator.maxTouchPoints > 0, ua: navigator.userAgent })),
    PROBE
  );
  check('the portal runs in the sandboxed frame, and the frame refuses a fetch of a file that exists', /allow-scripts/.test(r.sandbox) && /^refused/.test(r.fetch), r);
  const want = dev === IPHONE ? r.w === 390 && r.h === 844 && r.touch && /iPhone/.test(r.ua) : r.w === 1280 && r.h === 800;
  check(dev === IPHONE ? 'the frame is 390x844 with touch and an iPhone user agent' : 'the frame is 1280x800', want, { w: r.w, h: r.h, touch: r.touch });
}
async function begin(check, S, mode, dev) {
  const { A, fr } = await SF.framed(S, mode, dev);
  await proveFrame(check, fr, dev);
  return { A, fr, seen: [] };
}
async function reload(A) {
  await A.page.reload();
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  await fr.waitForTimeout(600);
  return fr;
}
/** Reads the screen now and keeps any vendor name or forbidden word it shows (checked at the end of the part). */
async function screen(X, fr, where) {
  const t = await Lib.screenText(fr).catch(() => '');
  const lk = Lib.leakCheck(t);
  if (!lk.ok) X.seen.push({ where, hits: lk.hits });
  return t;
}
function endChecks(check, X) {
  check('no vendor name and never the forbidden word on any screen the part read', X.seen.length === 0, X.seen);
  check('no script error in the browser', scriptErrors(X.A).length === 0, scriptErrors(X.A));
  check('no request left the check server', X.A.net.external.length === 0, X.A.net.external);
}
const toasts = (fr) => fr.evaluate(() => window.__sim.toasts.splice(0).filter(Boolean));
const dlgOpen = (fr) => fr.evaluate(() => !!(document.getElementById('dlg') || {}).open);
const heading = (fr) => fr.evaluate(() => ((document.querySelector('.ivf-form h1') || document.querySelector('#main h1') || {}).innerText || '').trim());
async function tapL(dev, l) {
  await l.scrollIntoViewIfNeeded();
  if (dev && dev.hasTouch) await l.tap();
  else await l.click();
}
async function asInvestor(fr, id, page) {
  await fr.evaluate((id) => (window.CVPortal.state.viewer = id), id);
  if (await fr.locator('#demo-role').count()) await fr.selectOption('#demo-role', 'investor');
  else
    await fr.evaluate(() => {
      const NS = window.CVPortal;
      NS.state.role = 'investor';
      NS.store.set('role', 'investor');
    });
  await fr.waitForTimeout(300);
  await fr.evaluate((p) => {
    if (location.hash === '#' + p) window.CVPortal.app.render();
    else location.hash = p;
  }, page);
  await fr.waitForFunction((p) => location.hash === '#' + p && !!document.querySelector('#main'), page, { timeout: 20000 });
  await fr.waitForTimeout(500);
}

/* ---------- drawing a signature, finishing the tax form ---------- */
async function drawOn(A, fr, dev, sel) {
  const box = await fr.locator(sel).first().boundingBox();
  if (!box) return false;
  const pts = [[0.15, 0.6], [0.28, 0.3], [0.42, 0.72], [0.58, 0.35], [0.72, 0.65], [0.85, 0.4]].map(([x, y]) => ({ x: Math.round(box.x + box.width * x), y: Math.round(box.y + box.height * y) }));
  if (dev.hasTouch) {
    const cdp = await A.context.newCDPSession(A.page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
    for (const p of pts.slice(1)) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
      await fr.waitForTimeout(40);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach().catch(() => {});
  } else {
    await A.page.mouse.move(pts[0].x, pts[0].y);
    await A.page.mouse.down();
    for (const p of pts.slice(1)) await A.page.mouse.move(p.x, p.y, { steps: 4 });
    await A.page.mouse.up();
  }
  await fr.waitForTimeout(200);
  return true;
}
/** The signature field in scope signed with a drawn signature (consent first when asked). Resolves to whether it took. */
async function drawSignature(A, fr, dev, scope) {
  if (await fr.locator('#es-consent-box').count()) {
    await fr.check('#es-consent-box');
    await press(fr, dev, '[data-action="es-consent"]');
    await fr.waitForSelector(`${scope} .es-page img`, { timeout: 30000 });
  }
  const field = `${scope} [data-action="es-sig"]`;
  if (!(await fr.locator(field).count())) return false;
  await press(fr, dev, field);
  await fr.waitForSelector('#dlg[open]', { timeout: 10000 }).catch(() => {});
  if (!(await dlgOpen(fr))) return false;
  if (await fr.locator('#sg-tab-draw').count()) {
    await press(fr, dev, '#sg-tab-draw');
    await fr.waitForTimeout(300);
  }
  await drawOn(A, fr, dev, '#dlg[open] .sg-pad:not([hidden])');
  await press(fr, dev, '#dlg[open] [data-action="es-adopt"]');
  await fr.waitForTimeout(500);
  if (await dlgOpen(fr)) {
    // a second pad (initials) may ask for its own stroke
    if (await fr.locator('#dlg[open] .sg-pad').count()) await drawOn(A, fr, dev, '#dlg[open] .sg-pad');
    await press(fr, dev, '#dlg[open] [data-action="es-adopt"]');
    await fr.waitForTimeout(500);
  }
  return !(await dlgOpen(fr)) && (await fr.locator(`${scope} [data-action="es-sig"].is-filled`).count()) > 0;
}
/** On the tax step's form: optionally draw the signature, then Finish (tapped on the phone); waits for the next screen. */
async function finishTax(X, fr, dev, sign) {
  await fr.waitForSelector('.ivf-tax-sign .es-finish', { timeout: 60000 });
  await fr.waitForSelector('.ivf-tax-sign .es-page img', { timeout: 60000 });
  let drawn = null;
  if (sign) drawn = await drawSignature(X.A, fr, dev, '.ivf-tax-sign');
  const before = await heading(fr);
  await press(fr, dev, '.ivf-tax-sign .es-finish');
  await fr.waitForFunction((hd) => {
    const h = document.querySelector('.ivf-form h1');
    return h && h.innerText !== hd;
  }, before, { timeout: 60000 });
  await fr.waitForTimeout(300);
  return drawn;
}

/* ---------- the firm's console ---------- */
/** "Add manually": an investor on file (identity and screening done), as the firm adds one. Resolves to their id. */
async function addOnFile(X, fr, dev, p) {
  await Lib.consoleRoute(fr, 'console-investors', '[data-action=invite-toggle]');
  if (!(await fr.locator('[data-action=invite-tab]').count())) await press(fr, dev, '[data-action=invite-toggle]');
  await fr.waitForSelector('[data-action=invite-tab]', { timeout: 10000 });
  await tapL(dev, fr.locator('[data-action=invite-tab]', { hasText: 'Add manually' }).first());
  await fr.waitForSelector('#im-first', { timeout: 10000 });
  await fr.fill('#im-first', p.first);
  await fr.fill('#im-last', p.last);
  await fr.fill('#im-email', p.email);
  if (await fr.locator('#im-checked').count()) await fr.check('#im-checked');
  await press(fr, dev, 'form[data-form="invite-manual"] button[type=submit]');
  await fr.waitForTimeout(900);
  if (await dlgOpen(fr)) await press(fr, dev, '#dlg [data-action="close-dialog"]');
  await screen(X, fr, 'investors after Add manually');
  return fr.evaluate((email) => (window.CVPortal.state.ws.investors.find((i) => String(i.email || '').toLowerCase() === email) || {}).id || '', p.email.toLowerCase());
}
/** The console's invitation form for an investor on file, "Include tax form" ticked; opens the investor's link in this browser. */
async function inviteOnFile(X, fr, dev, p, offeringId) {
  await Lib.consoleRoute(fr, 'console-investors', '[data-action=invite-toggle]');
  if (!(await fr.locator('#iv-email').count()) && !(await fr.locator('[data-action=invite-tab]').count())) await press(fr, dev, '[data-action=invite-toggle]');
  await fr.waitForTimeout(300);
  if (!(await fr.locator('#iv-email').count())) await tapL(dev, fr.locator('[data-action=invite-tab]', { hasText: 'One investor' }).first());
  await fr.waitForSelector('#iv-email', { timeout: 10000 });
  await fr.fill('#iv-contact', p.first);
  await fr.fill('#iv-last', p.last);
  await fr.fill('#iv-email', p.email);
  await fr.waitForTimeout(250);
  if (!(await fr.locator('#iv-more[open]').count())) await press(fr, dev, '#iv-more summary');
  await fr.selectOption('#iv-off', offeringId);
  await fr.waitForTimeout(250);
  const box = (await fr.locator('#iv-includeTax').count()) === 1;
  if (box) await fr.check('#iv-includeTax');
  await press(fr, dev, '.inv8-form[data-form="invite-one"] button[type=submit]');
  await fr.waitForSelector('#dlg[open] .inv8-email', { timeout: 20000 });
  await screen(X, fr, 'invitation email');
  await press(fr, dev, '#dlg[open] [data-action="inv8-open-link"]');
  await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
  return box;
}
/** The investor's row on the firm's Investors page. */
async function consoleRow(fr, email) {
  await Lib.consoleRoute(fr, 'console-investors', '.cs-tbl');
  const r = fr.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: email }).first();
  return { r, text: ((await r.innerText().catch(() => '')) || '').replace(/\s+/g, ' ') };
}
/** "Request tax form" on the row, then the investor's link from its email dialog, opened in this browser. */
async function requestTax(X, fr, dev, email) {
  const { r } = await consoleRow(fr, email);
  const b = r.locator('[data-action="tax-request"]');
  if (!(await b.count())) return false;
  await tapL(dev, b);
  await fr.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 });
  await screen(X, fr, 'tax form request email');
  await press(fr, dev, '#dlg[open] [data-action="inv8-open-link"]');
  await fr.waitForSelector('.ivf-form h1', { timeout: 30000 });
  return true;
}
/** Bytes of the download a press starts, or null. */
async function downloadOf(A, fr, dev, sel) {
  const got = A.page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  await press(fr, dev, sel);
  const d = await got;
  if (!d) return null;
  const p = await d.path().catch(() => null);
  return p ? { name: d.suggestedFilename(), bytes: fs.readFileSync(p) } : null;
}

/* ---------- what the workspace holds ---------- */
/** This investor's tax envelopes, their listings, their files and the record's tax form. */
const taxState = (fr, invId) =>
  fr.evaluate(async (invId) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const i = ws.investors.find((x) => x.id === invId) || {};
    const envs = (ws.envelopes || []).filter((e) => e.kind === 'tax' && e.signers.some((s) => s.investorId === invId));
    const out = [];
    for (const e of envs) {
      const me = e.signers.find((s) => s.investorId === invId);
      const ids = Array.from(new Set([e.docId, e.workDocId, e.signedDocId, `${e.id}-orig`, `${e.id}-work`, `${e.id}-signed`].filter(Boolean)));
      const files = {};
      for (const id of ids) files[id.replace(e.id, '')] = !!(await NS.ops.files.get(id).catch(() => null));
      out.push({ id: e.id, status: e.status, investorSigned: e.fields.some((f) => f.signerId === me.id && f.type === 'signature' && !!f.value), voidReason: e.voidReason || '', supersededBy: e.supersededBy || '', supersedeReason: e.supersedeReason || '', sha256Signed: e.sha256Signed || '', files });
    }
    const listings = (ws.docs || []).filter((d) => (d.investors || []).indexOf(invId) >= 0 && (d.cat === 'Tax' || envs.some((e) => e.id === d.envelopeId))).map((d) => ({ id: d.id, envelopeId: d.envelopeId || '', title: d.title, fileName: d.fileName }));
    return { envs: out, listings, taxCert: i.taxCert ? JSON.parse(JSON.stringify(i.taxCert)) : null, taxForm: i.taxForm || '', onFile: NS.inviteFlow.taxOnFile(i), audit: (ws.audit || []).filter((a) => a.record === invId).map((a) => `${a.action}: ${a.detail}`) };
  }, invId);
/** The investor's Documents screen: every tax row (title and its line beneath) and the "Signed documents" list. */
const docsScreen = (fr) =>
  fr.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#main tr')).filter((tr) => /Form W-9/.test(tr.innerText));
    return { taxRows: rows.map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()), signedSection: !!document.querySelector('.es-signed'), opens: Array.from(document.querySelectorAll('#main [data-action="es-open-doc"], #main .tbl-docs .doc-link')).filter((b) => /Form W-9/.test(b.innerText)).map((b) => ({ text: b.innerText.trim(), id: b.getAttribute('data-id') || '' })) };
  });

/* ---------- N1: one tax form per investor ---------- */
/**
 * The investor on file: invited with "Include tax form", the W-9 finished without a signature, the subscription finished,
 * then the firm's "Request tax form" and the requested W-9 signed (signLater true) or finished unsigned again.
 */
function requestPart(dev, signRequested) {
  const tag = signRequested ? tagOf(dev) : 'unsigned-twice';
  return async ({ check, S }) => {
    const X = await begin(check, S, 'none', dev);
    const { A, fr } = X;
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const p = dev === IPHONE ? { first: 'Ottoline', last: 'Ferreira-Nakamura', email: 'ottoline.ferreira@example.com' } : signRequested ? { first: 'Bartholomew', last: 'Achterberg', email: 'bartholomew.achterberg@example.com' } : { first: 'Cosima', last: 'Valdés-Ruiz', email: 'cosima.valdes@example.com' };
    const name = `${p.first} ${p.last}`;
    const invId = await addOnFile(X, fr, dev, p);
    check('the firm adds the investor manually (on file)', !!invId, invId);
    const box = await inviteOnFile(X, fr, dev, p, portal.offeringId);
    check('the invitation to subscribe offers "Include tax form" for the investor on file, and it is ticked', box);
    const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0 });
    check('the investor reaches the subscription agreement, the W-9 finished without a signature on the way', w.reached && w.seen.some((s) => /Tax certification/.test(s)), w.seen);
    if (!w.reached) return A.context.close();
    await Lib.finishAgreement(fr);
    await screen(X, fr, 'done screen');
    const s1 = await taxState(fr, invId);
    const first = s1.envs[0] || {};
    check('the first W-9 is recorded as not signed', s1.envs.length === 1 && !first.investorSigned && !!s1.taxCert && s1.taxCert.envelopeId === first.id && s1.taxCert.signed === false, s1);
    check('a W-9 finished without a signature is not published to Documents (no listing, no "_signed" file name)', s1.listings.length === 0, s1.listings);
    await asInvestor(fr, invId, 'documents');
    let d = await docsScreen(fr);
    await screen(X, fr, 'documents before the request');
    await A.page.screenshot({ path: path.join(OUT, `${tag}-docs-before.png`), fullPage: false });
    check('Documents before the request: no tax form row under "Signed documents"', d.taxRows.length === 0, d);
    await asInvestor(fr, invId, 'account');
    const acct = await screen(X, fr, 'account');
    check('Account says the W-9 is not signed', /W-9 not signed/.test(acct), (acct.match(/Tax form[^\n]*/) || [''])[0]);

    // The firm asks for the tax form; the investor signs it (or finishes it unsigned again).
    const asked = await requestTax(X, fr, dev, p.email);
    check('the firm’s row offers "Request tax form" and its link opens the request', asked);
    if (!asked) return A.context.close();
    const w2 = await Lib.walk(fr, { name, until: /^Tax certification$/ });
    check('the request opens on the tax step', w2.reached, w2.seen);
    await Lib.submit(fr);
    const drawn = await finishTax(X, fr, dev, signRequested);
    if (signRequested) check('the investor draws a signature on the requested W-9', drawn === true, drawn);
    const done = await screen(X, fr, 'request done');
    check(signRequested ? 'the request’s done screen says the form is signed' : 'the request’s done screen says it was finished without a signature', signRequested ? /Your Form W-9 is signed/.test(done) : /You finished without signing your Form W-9/.test(done), done.replace(/\s+/g, ' ').slice(0, 300));

    const s2 = await taxState(fr, invId);
    const old = s2.envs.find((e) => e.id === first.id) || {};
    const now = s2.envs.find((e) => e.id !== first.id) || {};
    check('the earlier unsigned W-9 is voided with "Replaced by the Form W-9 … on <date>"', old.status === 'voided' && REPLACED.test(old.voidReason), old);
    check('the earlier unsigned W-9’s files (filled form, work and signed copies, which hold the taxpayer ID) are gone', Object.keys(old.files || {}).length > 0 && Object.values(old.files).every((x) => x === false), old.files);
    check('the change log says the tax form was replaced', s2.audit.some((a) => /^Tax form replaced: /.test(a)), s2.audit.slice(-6));
    if (signRequested) {
      check('the requested W-9 is completed with the investor’s signature', now.status === 'completed' && now.investorSigned === true, now);
      check('the record points at the signed W-9 (signed true) and it is on file', !!s2.taxCert && s2.taxCert.envelopeId === now.id && s2.taxCert.signed === true && s2.onFile === true, s2.taxCert);
      check('the workspace holds exactly one tax listing for this investor, the signed one', s2.listings.length === 1 && s2.listings[0].envelopeId === now.id, s2.listings);
    } else {
      check('the requested W-9 is completed without a signature', now.status === 'completed' && now.investorSigned === false, now);
      check('the record points at the newest W-9 (signed false)', !!s2.taxCert && s2.taxCert.envelopeId === now.id && s2.taxCert.signed === false && s2.onFile === false, s2.taxCert);
      check('no tax listing for this investor (neither form is signed)', s2.listings.length === 0, s2.listings);
    }

    // The investor's Documents.
    if (await fr.locator('.ivf-done a[href="#overview"]').count()) await press(fr, dev, '.ivf-done a[href="#overview"]');
    await asInvestor(fr, invId, 'documents');
    d = await docsScreen(fr);
    await screen(X, fr, 'documents after the request');
    await A.page.screenshot({ path: path.join(OUT, `${tag}-docs-after.png`), fullPage: false });
    if (signRequested) {
      check(`Documents lists exactly one "Form W-9 - ${name}" row`, d.taxRows.length === 1 && d.opens.length === 1 && d.opens[0].text === `Form W-9 - ${name}`, d);
      check('no "_signed" file name is listed for an unsigned form', !d.taxRows.some((t) => /_signed\.pdf/.test(t)) || (s2.listings.length === 1 && s2.listings[0].envelopeId === now.id), d.taxRows);
      if (d.opens.length) {
        const listing = s2.listings.find((x) => x.id === d.opens[0].id);
        check('the row opens the signed W-9 (its envelope has the investor’s signature)', !!listing && listing.envelopeId === now.id && now.investorSigned, { row: d.opens[0], listing });
        await tapL(dev, fr.locator('#main [data-action="es-open-doc"], #main .tbl-docs .doc-link', { hasText: 'Form W-9' }).first());
        const pages = await fr
          .waitForFunction(() => {
            const i = Array.from(document.querySelectorAll('#dlg[open] .doc-page'));
            return i.length > 0 && i.every((x) => x.complete && x.naturalWidth > 0) ? i.length : 0;
          }, null, { timeout: 30000 })
          .then((x) => x.jsonValue(), () => 0);
        await screen(X, fr, 'the W-9 opened');
        await A.page.screenshot({ path: path.join(OUT, `${tag}-w9-open.png`), fullPage: false });
        check('it opens with its pages drawn (the form and its certificate)', pages >= 2, pages);
        if (await dlgOpen(fr)) await press(fr, dev, '#dlg [data-action="close-dialog"][aria-label="Close"]');
        await fr.waitForTimeout(300);
        const dl = await downloadOf(A, fr, dev, `#main [data-action="es-dl-signed"][data-id="${now.id}"]`);
        check('its Download is a PDF of the same SHA-256 as the signed copy', !!dl && dl.bytes.slice(0, 5).toString() === '%PDF-' && sha(dl.bytes) === now.sha256Signed, dl ? { name: dl.name, sha: sha(dl.bytes), want: now.sha256Signed } : null);
      }
    } else check('Documents lists no tax form row', d.taxRows.length === 0, d);

    // The firm's investor row.
    const row = await consoleRow(fr, p.email);
    await screen(X, fr, 'investors after the request');
    await A.page.screenshot({ path: path.join(OUT, `${tag}-console-row.png`), fullPage: false });
    if (signRequested) {
      check('the firm’s row reads "W-9 signed … Download"', /W-9 signed [A-Z][a-z]+ \d{1,2}, \d{4} · Download/.test(row.text) && !/not signed/.test(row.text), row.text.slice(0, 300));
      const dl = (await row.r.locator('[data-action="kyc-iv-file"]').count()) === 1 ? await (async () => {
        const got = A.page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
        await tapL(dev, row.r.locator('[data-action="kyc-iv-file"]'));
        const x = await got;
        const fp = x ? await x.path().catch(() => null) : null;
        return fp ? fs.readFileSync(fp) : null;
      })() : null;
      check('the row’s Download is the signed copy (same SHA-256)', !!dl && sha(dl) === now.sha256Signed, dl ? sha(dl) : null);
    } else {
      check('the firm’s row says "W-9 not signed" and still offers "Request tax form"', /W-9 not signed/.test(row.text) && (await row.r.locator('[data-action="tax-request"]').count()) === 1, row.text.slice(0, 300));
    }
    endChecks(check, X);
    await A.context.close();
  };
}

/** A signed W-9 on file (signed from a request), then an invitation with "Include tax form" whose W-9 is finished unsigned. */
async function signedKeptPart({ check, S }) {
  const dev = DESKTOP;
  const X = await begin(check, S, 'none', dev);
  const { A, fr } = X;
  const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
  const p = { first: 'Leopoldine', last: 'Okonkwo-Hartmann', email: 'leopoldine.okonkwo@example.com' };
  const name = `${p.first} ${p.last}`;
  const invId = await addOnFile(X, fr, dev, p);
  check('the firm adds the investor manually (on file)', !!invId, invId);
  const asked = await requestTax(X, fr, dev, p.email);
  check('the firm requests the tax form', asked);
  if (!asked) return A.context.close();
  const w1 = await Lib.walk(fr, { name, until: /^Tax certification$/ });
  check('the request reaches the tax step', w1.reached, w1.seen);
  await Lib.submit(fr);
  const drawn = await finishTax(X, fr, dev, true);
  check('the investor signs the requested W-9', drawn === true, drawn);
  const s1 = await taxState(fr, invId);
  const signedEnv = s1.envs[0] || {};
  check('a signed W-9 is on file: the record points at it and it is listed once', s1.envs.length === 1 && signedEnv.investorSigned && !!s1.taxCert && s1.taxCert.envelopeId === signedEnv.id && s1.taxCert.signed === true && s1.listings.length === 1, s1);

  const box = await inviteOnFile(X, fr, dev, p, portal.offeringId);
  check('the invitation to subscribe offers "Include tax form", ticked', box);
  const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0 });
  check('the investor reaches the agreement, the new W-9 finished without a signature', w.reached && w.seen.some((s) => /Tax certification/.test(s)), w.seen);
  if (!w.reached) return A.context.close();
  await Lib.finishAgreement(fr);
  await screen(X, fr, 'done screen');
  const s2 = await taxState(fr, invId);
  const kept = s2.envs.find((e) => e.id === signedEnv.id) || {};
  const fresh = s2.envs.find((e) => e.id !== signedEnv.id) || {};
  check('the record still points at the signed W-9 (signed true) and it is on file', !!s2.taxCert && s2.taxCert.envelopeId === signedEnv.id && s2.taxCert.signed === true && s2.onFile === true, s2.taxCert);
  check('the signed W-9 is still completed with its signed copy', kept.status === 'completed' && kept.files['-signed'] === true, kept);
  check(`the new unsigned W-9 is voided with "${KEPT_SIGNED}"`, fresh.status === 'voided' && fresh.voidReason === KEPT_SIGNED, fresh);
  check('the new unsigned W-9’s files are gone', Object.keys(fresh.files || {}).length > 0 && Object.values(fresh.files).every((x) => x === false), fresh.files);
  check('one tax listing, the signed W-9', s2.listings.length === 1 && s2.listings[0].envelopeId === signedEnv.id, s2.listings);
  if (await fr.locator('.ivf-done a[href="#overview"]').count()) await press(fr, dev, '.ivf-done a[href="#overview"]');
  await asInvestor(fr, invId, 'documents');
  const d = await docsScreen(fr);
  await screen(X, fr, 'documents');
  check(`Documents lists exactly one "Form W-9 - ${name}" row, the signed one`, d.opens.length === 1 && (s2.listings.find((x) => x.id === d.opens[0].id) || {}).envelopeId === signedEnv.id, d);
  const row = await consoleRow(fr, p.email);
  await screen(X, fr, 'investors');
  check('the firm’s row reads "W-9 signed … Download"', /W-9 signed [A-Z][a-z]+ \d{1,2}, \d{4} · Download/.test(row.text) && !/not signed/.test(row.text), row.text.slice(0, 300));
  endChecks(check, X);
  await A.context.close();
}

/* ---------- import (server mode) ---------- */
async function importPart({ check, S }) {
  let SM = null;
  try {
    SM = require('./server-mode.js');
  } catch (e) {
    SM = null;
  }
  check('the server-mode harness can be used (server-mode.js exports serverFlow)', !!SM && typeof SM.serverFlow === 'function', SM ? Object.keys(SM) : 'not loadable');
  if (!SM || typeof SM.serverFlow !== 'function') return;
  const seen = [];
  const F = await SM.serverFlow(S, check, {
    tag: 'record-import',
    exemption: 'Rule 506(b)',
    invite: { includeTax: true },
    wantType: 'us-individual',
    answers: { amount: 60000 },
    beforeInvite: async (cp, off, out) => {
      // An investor on file whose signed W-9 this console holds: the envelope, its signed copy (an invented PDF) and the listing.
      out.who = await cp.evaluate(async (oid) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const i = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.email && !(x.positions || []).some((y) => y.offeringId === oid));
        if (!i) return null;
        Object.assign(i, { contact: 'Fenwick Adeyemi-Strand', title: 'Fenwick Adeyemi-Strand', taxType: 'us-individual', address: '19 Larkspur Row, Missoula, MT 59801', country: 'United States', citizenship: 'us', esignConsent: { at: '2026-03-02T15:04:05Z', scope: 'Electronic records and signatures (ESIGN Act, UETA)' } });
        const L = await NS.esignKit.writer();
        const doc = await L.PDFDocument.create();
        doc.addPage([612, 792]).drawText('Form W-9 (check copy) - Fenwick Adeyemi-Strand', { x: 72, y: 700, size: 12 });
        const bytes = await doc.save();
        const id = 'env-taxold-check';
        const sid = id + '-signed';
        await NS.ops.files.put(sid, new Blob([bytes], { type: 'application/pdf' }));
        const at = '2026-03-02T15:04:05.000Z';
        ws.envelopes = ws.envelopes || [];
        ws.envelopes.push({ id, kind: 'tax', title: 'Form W-9 - Fenwick Adeyemi-Strand', fileName: 'Form_W-9.pdf', docId: null, workDocId: null, signedDocId: sid, status: 'completed', completedAt: at, createdAt: at, sentAt: at, sequential: true, pages: 1, pageSizes: [{ w: 612, h: 792 }], taxForm: { form: 'W-9', revision: 'Rev. March 2024' }, sha256Signed: NS.audit.sha256(bytes), signers: [{ id: 'sg-old', role: 'investor', name: i.contact, email: i.email, investorId: i.id, order: 1, status: 'signed', signedAt: at }], fields: [{ id: 'fd-old', signerId: 'sg-old', type: 'signature', page: 1, x: 0.1, y: 0.8, w: 0.3, h: 0.03, value: 'adopted' }], events: [] });
        ws.docs = ws.docs || [];
        ws.docs.push({ id: sid, title: 'Form W-9 - Fenwick Adeyemi-Strand', fileName: 'Form_W_9_Fenwick_Adeyemi_Strand_signed.pdf', type: 'application/pdf', size: bytes.length, sha256: NS.audit.sha256(bytes), cat: 'Tax', offeringId: null, audience: 'investors', investors: [i.id], date: '2026-03-02', taxYear: '', publishedAt: at, publishedBy: 'E-sign', envelopeId: id });
        i.taxForm = 'W-9';
        i.taxCert = { form: 'W-9', revision: 'Rev. March 2024', envelopeId: id, at, signed: true, signedBy: i.contact, tinLast4: '', backupWithholding: false };
        NS.app.save(true);
        return { id: i.id, name: i.contact, first: 'Fenwick', last: 'Adeyemi-Strand', email: i.email, oldId: id, oldSigned: sid };
      }, off.offeringId);
    },
    taxStep: async (pg) => {
      await Lib.submit(pg);
      await Lib.finishTaxForm(pg, SM.signTax);
    }
  });
  try {
    const who = F.who || {};
    const st = await F.A.page.evaluate(async ({ iid, oldId, oldSigned }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const i = ws.investors.find((x) => x.id === iid);
      const old = (ws.envelopes || []).find((e) => e.id === oldId) || {};
      const taxDocs = (ws.docs || []).filter((d) => d.cat === 'Tax' && (d.investors || []).indexOf(iid) >= 0).map((d) => ({ id: d.id, envelopeId: d.envelopeId }));
      const blob = await NS.ops.files.get(oldSigned).catch(() => null);
      return { taxCert: i.taxCert, old: { status: old.status, supersededBy: old.supersededBy || '', reason: old.supersedeReason || '', voidReason: old.voidReason || '' }, oldFile: !!blob, taxDocs, audit: (ws.audit || []).filter((a) => a.record === iid).map((a) => `${a.action}: ${a.detail}`) };
    }, { iid: who.id, oldId: who.oldId, oldSigned: who.oldSigned });
    seen.push(Lib.leakCheck(await Lib.screenText(F.A.page)).hits);
    const fresh = st.taxCert && st.taxCert.envelopeId !== who.oldId ? st.taxCert.envelopeId : '';
    check('the console imported the new signed W-9: the record points at it (signed true)', !!fresh && st.taxCert.signed === true, st.taxCert);
    check('the console lists exactly one tax form for the investor, the new one', st.taxDocs.length === 1 && st.taxDocs[0].envelopeId === fresh, st.taxDocs);
    check('B1: the earlier signed W-9 is kept as superseded (by the new one, with the reason), not voided or deleted', st.old.status === 'superseded' && st.old.supersededBy === fresh && REPLACED.test(st.old.reason), st.old);
    check('B1: the earlier signed copy is still stored on the console, and not listed', st.oldFile === true && !st.taxDocs.some((d) => d.envelopeId === who.oldId), { file: st.oldFile, docs: st.taxDocs });
    check('the change log says the tax form was replaced', st.audit.some((a) => /^Tax form replaced: /.test(a)), st.audit.slice(-6));
    const row = await SM.consoleTaxRow(F.A.page, who.email, 'record-import-console.png');
    check('the firm’s row reads "W-9 signed … Download" (one Download)', /W-9 signed [A-Z][a-z]+ \d{1,2}, \d{4}/.test(row.text) && row.downloads === 1, row.text.slice(0, 300));
    seen.push(Lib.leakCheck(row.text).hits);
    check('no vendor name and never the forbidden word on the screens read', seen.every((x) => !x.length), seen);
    check('no script error in the console or on the device', F.A.errors.length === 0 && F.B.errors.length === 0, F.A.errors.concat(F.B.errors));
    check('nothing outside but the integration server, from either side', F.A.net.external.length === 0 && F.B.net.external.length === 0, F.A.net.external.concat(F.B.net.external));
  } finally {
    await F.close();
  }
}

/* ---------- failure 1: the agreement this browser did not keep ---------- */
const subscription = (fr, investorId) =>
  fr.evaluate((investorId) => {
    const ws = window.CVPortal.state.ws;
    const r = (ws.requests || []).filter((x) => x.investorId === investorId && x.type === 'subscription').pop();
    const env = r && r.envelopeId ? (ws.envelopes || []).find((e) => e.id === r.envelopeId) : null;
    const me = env ? env.signers.find((s) => s.investorId === investorId) : null;
    const firm = env ? env.signers.find((s) => s.role === 'countersigner') : null;
    const own = (type) => (env && firm ? (env.fields.find((f) => f.signerId === firm.id && f.type === type) || {}).id || '' : '');
    return { req: r ? { id: r.id, status: r.status, signedAt: r.signedAt || '', envelopeId: r.envelopeId || '' } : null, env: env ? { id: env.id, status: env.status, title: env.title, investor: me ? me.status : 'none', firm: firm ? firm.status : 'none', sig: own('signature'), name: own('name'), docId: env.docId, voidReason: env.voidReason || '' } : null, envs: (ws.envelopes || []).filter((e) => e.signers.some((s) => s.investorId === investorId) && e.kind !== 'tax').map((e) => ({ id: e.id, status: e.status, voidReason: e.voidReason || '' })) };
  }, investorId);
async function firmSigns(fr, dev, st) {
  if (await fr.locator('#es-consent-box').count()) {
    await fr.check('#es-consent-box');
    await press(fr, dev, '[data-action="es-consent"]');
  }
  await fr.waitForSelector('.es-sign-console .es-doc-sign .es-page img', { timeout: 30000 });
  await press(fr, dev, `.es-doc-sign [data-fid="${st.env.sig}"]`);
  await fr.waitForTimeout(300);
  if (await dlgOpen(fr)) {
    await press(fr, dev, '[data-action="es-adopt"]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open);
  }
  const nameSel = `.es-doc-sign input[data-fid="${st.env.name}"]`;
  if (st.env.name && !(await fr.inputValue(nameSel))) {
    if (dev.hasTouch) {
      await press(fr, dev, nameSel);
      await fr.waitForSelector('.sf-tray:not([hidden]) .sf-tray-in', { timeout: 10000 });
      await fr.fill('.sf-tray-in', 'Avery Stone');
    } else await fr.fill(nameSel, 'Avery Stone');
    await fr.waitForTimeout(200);
  }
  await press(fr, dev, '.es-sign-console .es-finish');
  return fr.waitForSelector('.es-sign-console .es-done', { timeout: 30000 }).then(
    () => true,
    () => false
  );
}
async function requestsPage(fr) {
  await Lib.consoleRoute(fr, 'console-requests', '[data-action=req-tab][data-t=all]');
  await fr.click('[data-action=req-tab][data-t=all]');
  await fr.waitForTimeout(300);
}
const rowText = (fr, rid) =>
  fr.evaluate((rid) => {
    const b = document.querySelector(`[data-id="${CSS.escape(rid)}"]`);
    const tr = b ? b.closest('tr') : null;
    return tr ? tr.innerText.replace(/\s+/g, ' ') : '';
  }, rid);
async function approve(fr, dev, rid) {
  for (let i = 0; i < 2; i++) {
    const b = `[data-action=req-approve][data-id="${rid}"]`;
    if (!(await fr.locator(b).count())) break;
    await press(fr, dev, b);
    await fr.waitForTimeout(500);
  }
}

function lostPart(dev) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const X = await begin(check, S, 'noidb', dev);
    const { A } = X;
    let fr = X.fr;
    const noIdb = () =>
      fr.evaluate(() => {
        try {
          indexedDB.open('sim-probe', 1);
          return 'opened';
        } catch (e) {
          return e.name;
        }
      });
    check('the browser gives the portal no IndexedDB (opening it throws SecurityError)', (await noIdb()) === 'SecurityError', await noIdb());
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const name = dev === IPHONE ? 'Saoirse Lindqvist-Obi' : 'Thelonius Marchetti';
    const inv = await Lib.createInvitation(fr, { name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, type: 'individual', offeringId: portal.offeringId });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0 });
    check('in the same page load the investor reaches the agreement and it is drawn', w.reached, w.seen);
    if (!w.reached) return A.context.close();
    const team = await fr.evaluate(() => {
      const t = window.CVPortal.state.ws.tenant;
      return { team: (t.support || {}).team || '', email: (t.support || {}).email || '', short: t.shortName || '' };
    });

    // The frame is loaded again: every stored file is gone.
    fr = await reload(A);
    X.fr = fr;
    await proveFrame(check, fr, dev);
    check('after the reload the browser still gives no IndexedDB', (await noIdb()) === 'SecurityError', await noIdb());
    // T-06-56: another investor's agreement in the same offering whose own file is here (stored after the reload).
    const control = await fr.evaluate(async (oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === oid);
      const i = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && !(ws.requests || []).some((r) => r.investorId === x.id && r.offeringId === oid));
      if (!i) return null;
      const r = NS.ops.submitSubscription(ws, i, o, { cents: 7500000, signature: i.contact });
      const env = (ws.envelopes || []).find((e) => e.id === r.envelopeId);
      if (!env) return null;
      const L = await NS.esignKit.writer();
      const doc = await L.PDFDocument.create();
      for (let k = 0; k < 3; k++) doc.addPage([612, 792]).drawText(`Subscription Agreement (check copy), page ${k + 1}`, { x: 72, y: 700, size: 12 });
      env.docId = env.id + '-orig';
      await NS.ops.files.put(env.docId, new Blob([await doc.save()], { type: 'application/pdf' }));
      NS.app.save(true);
      return { id: env.id, investorId: i.id, rid: r.id, before: JSON.stringify({ status: env.status, docId: env.docId, signers: env.signers.map((s) => s.status) }) };
    }, portal.offeringId);
    check('an agreement in the same offering whose file is here (the control) is set up', !!control, control);

    // 1. The investor's agreement step.
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    await fr.waitForFunction(() => /Subscription agreement/.test((document.querySelector('.ivf-form h1') || {}).innerText || ''), null, { timeout: 30000 }).catch(() => {});
    await fr.waitForFunction(() => !document.querySelector('.ivf-form .es-loading'), null, { timeout: 30000 }).catch(() => {});
    await fr.waitForTimeout(800);
    const step = await fr.evaluate(() => {
      const f = document.querySelector('.ivf-form');
      const vis = (el) => !!(el.offsetWidth || el.offsetHeight);
      const fin = f ? f.querySelector('.es-finish') : null;
      const btns = f ? Array.from(f.querySelectorAll('.ob-actions button, .ob-actions a')).filter(vis).map((b) => ({ text: b.innerText.trim(), primary: /btn-primary/.test(b.className), action: b.getAttribute('data-action') || '' })) : [];
      return { h1: f ? (f.querySelector('h1') || {}).innerText || '' : '', text: f ? f.innerText.replace(/\s+/g, ' ') : '', pages: f ? f.querySelectorAll('.es-page img').length : -1, finish: !!fin && !fin.disabled && vis(fin), note: f ? ((f.querySelector('.es-note-bad') || {}).innerText || '').replace(/\s+/g, ' ').trim() : '', btns };
    });
    await screen(X, fr, 'lost agreement step');
    await A.page.screenshot({ path: path.join(OUT, `${tag}-lost-step.png`), fullPage: false });
    check('the agreement step opens and cannot draw the agreement', step.h1 === 'Subscription agreement' && step.pages === 0, { h1: step.h1, pages: step.pages });
    check('the step keeps its honest line ("This browser did not keep the agreement’s file. Ask …", the firm’s contact named)', KEPT.test(step.note) && /agreement’s file/.test(step.note) && /\bAsk\b/.test(step.note) && (!team.email || step.note.indexOf(team.email) >= 0), step.note);
    check('the step keeps Back', step.btns.some((b) => b.text === 'Back'), step.btns);
    check('the step offers a primary "Continue and sign later"', step.btns.some((b) => b.text === 'Continue and sign later' && b.primary), step.btns);
    check('still no signing Finish, no "Ready to finish" and no Decline', !step.finish && !/Ready to finish|Decline to sign/.test(step.text), { finish: step.finish, text: step.text.slice(0, 300) });
    const later = '.ivf-form .ob-actions [data-action="ivf-sign-later"]';
    if (!(await fr.locator(later).count())) {
      endChecks(check, X);
      return A.context.close();
    }
    await press(fr, dev, later);
    await fr.waitForSelector('.ivf-done', { timeout: 30000 }).catch(() => {});
    await fr.waitForTimeout(600);
    const done = ((await fr.locator('.ivf-done').innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
    await screen(X, fr, 'lost done screen');
    await A.page.screenshot({ path: path.join(OUT, `${tag}-lost-done.png`), fullPage: false });
    check('the done screen says the subscription is recorded and the agreement waits until the firm adds it again', /Your subscription is recorded\. The subscription agreement could not be shown in this browser, and .+ has been told\. Once they add it again, it waits for your signature under Documents\./.test(done), done.slice(0, 400));
    let st = await subscription(fr, inv.investorId);
    const lostEnvId = st.env ? st.env.id : '';
    check('the request is pending with the agreement unsigned', !!st.req && st.req.status === 'pending' && !st.req.signedAt && !!st.env && st.env.status === 'sent' && st.env.investor !== 'signed', st);
    const told = await fr.evaluate(({ oid, name }) => {
      const ws = window.CVPortal.state.ws;
      return {
        notes: (ws.notifications || []).filter((n) => n.title.indexOf(name) >= 0).map((n) => ({ title: n.title, detail: n.detail, route: n.route })),
        log: (ws.audit || []).filter((a) => /not shown/.test(a.action)).map((a) => `${a.action}: ${a.detail}`)
      };
    }, { oid: portal.offeringId, name });
    check('the firm has a notification naming the investor, saying to add the agreement again from the offering page, opening the offering', told.notes.some((n) => n.title === `${name} could not see the subscription agreement` && /Add the agreement again from the offering page/.test(n.detail) && n.route === 'console-offering-' + portal.offeringId), told.notes);
    check('the change log names the investor and says to add the agreement again from the offering page', told.log.some((l) => /^Subscription agreement not shown: this browser did not keep its file/.test(l) && l.indexOf(name) >= 0 && /add the agreement again from the offering page/i.test(l)), told.log);

    await Lib.consoleRoute(fr, 'console-notifications', '#main h1, .cs-panel-head h2');
    const ntf = await screen(X, fr, 'the firm’s notifications');
    await A.page.screenshot({ path: path.join(OUT, `${tag}-lost-notified.png`), fullPage: false });
    check('the firm’s Notifications page shows it', ntf.indexOf(`${name} could not see the subscription agreement`) >= 0, ntf.slice(0, 400));

    // 2. B2: Approve is refused while the agreement is not signed.
    await requestsPage(fr);
    await toasts(fr);
    if (st.req) await approve(fr, dev, st.req.id);
    const said = await toasts(fr);
    const row = st.req ? await rowText(fr, st.req.id) : '';
    await screen(X, fr, 'requests, approve refused');
    await A.page.screenshot({ path: path.join(OUT, `${tag}-lost-refused.png`), fullPage: false });
    st = await subscription(fr, inv.investorId);
    check('B2: Approve is refused with "The subscription agreement is not signed yet."', !!st.req && st.req.status === 'pending' && said.indexOf('The subscription agreement is not signed yet.') >= 0, { status: st.req && st.req.status, said });
    check('B2: the Requests row reads "Agreement not signed"', /Agreement not signed/.test(row), row);

    // 3. The firm adds the agreement again from the offering page.
    if (!process.env.SIGN_OUT) process.env.SIGN_OUT = path.join(Lib.OUT, 'p4');
    const pdf = Buffer.from(await require(path.join(Lib.ROOT, '.planning/phases/04-signing-inside-onboarding/checks/lib.js')).agreementPdf(A.context, portal.offeringName), 'base64');
    await Lib.consoleRoute(fr, 'console-offering-' + portal.offeringId, `[data-action="es-agreement-new"][data-offering="${portal.offeringId}"]`);
    await press(fr, dev, `[data-action="es-agreement-new"][data-offering="${portal.offeringId}"]`);
    await fr.waitForSelector('#dlg[open] form[data-form="es-agreement"]');
    await fr.setInputFiles('#es-agr-file', { name: 'Agreement.pdf', mimeType: 'application/pdf', buffer: pdf });
    await fr.waitForTimeout(400);
    await press(fr, dev, 'form[data-form="es-agreement"] button[type=submit]');
    const editor = await fr.waitForFunction(() => /^#console-envelope-/.test(location.hash) && !!document.querySelector('[data-action="es-agreement-save"]'), null, { timeout: 180000 }).then(() => true, () => false);
    check('the firm adds the agreement again from the offering page and its fields are placed', editor, await fr.evaluate(() => location.hash));
    if (editor) {
      await fr.waitForTimeout(600);
      await press(fr, dev, '[data-action="es-agreement-save"]');
      await fr.waitForFunction((id) => location.hash === '#console-offering-' + id, portal.offeringId, { timeout: 20000 }).catch(() => {});
    }
    await fr.waitForFunction(
      ({ iid, old }) => {
        const ws = window.CVPortal.state.ws;
        const r = (ws.requests || []).filter((x) => x.investorId === iid && x.type === 'subscription').pop();
        return !!r && !!r.envelopeId && r.envelopeId !== old;
      },
      { iid: inv.investorId, old: lostEnvId },
      { timeout: 20000 }
    ).catch(() => {});
    st = await subscription(fr, inv.investorId);
    const oldEnv = st.envs.find((e) => e.id === lostEnvId) || {};
    check('the subscription now points at a new agreement from the one added again, for the investor to sign', !!st.env && st.env.id !== lostEnvId && st.env.status === 'sent' && st.env.investor !== 'signed', st);
    check('the earlier agreement is voided with the re-issue reason', oldEnv.status === 'voided' && oldEnv.voidReason === REISSUED, oldEnv);
    const ctl = control ? await fr.evaluate((id) => {
      const env = (window.CVPortal.state.ws.envelopes || []).find((e) => e.id === id);
      return env ? JSON.stringify({ status: env.status, docId: env.docId, signers: env.signers.map((s) => s.status) }) : '';
    }, control.id) : '';
    check('T-06-56: the agreement in the same offering whose file is here is untouched', !!control && ctl === control.before, { before: control && control.before, after: ctl });

    // 4. The investor signs the new copy from Documents.
    await asInvestor(fr, inv.investorId, 'documents');
    const waiting = await fr.evaluate(() => Array.from(document.querySelectorAll('.es-waiting .td-lead a')).map((a) => ({ text: a.innerText.trim(), href: a.getAttribute('href') })));
    await screen(X, fr, 'documents, waiting');
    await A.page.screenshot({ path: path.join(OUT, `${tag}-lost-waiting.png`), fullPage: false });
    check('the investor’s Documents lists the agreement under "Waiting for your signature" (the new copy only)', !!st.env && waiting.length === 1 && waiting[0].href === '#sign-' + st.env.id, waiting);
    if (st.env && waiting.length) {
      await tapL(dev, fr.locator('.es-waiting .td-lead a').first());
      const drawn = await fr.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 }).then(() => true, () => false);
      await screen(X, fr, 'signing the agreement added again');
      await A.page.screenshot({ path: path.join(OUT, `${tag}-lost-signing.png`), fullPage: false });
      check('it opens with its pages drawn', drawn);
      if (drawn) {
        if (await fr.locator('#es-consent-box').count()) {
          await fr.check('#es-consent-box');
          await press(fr, dev, '[data-action="es-consent"]');
          await fr.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 });
        }
        const sig = fr.locator('.es-doc-sign [data-action="es-sig"]').first();
        if (await sig.count()) {
          await tapL(dev, sig);
          await fr.waitForTimeout(300);
          if (await dlgOpen(fr)) {
            await press(fr, dev, '#dlg[open] [data-action="es-adopt"]');
            await fr.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 }).catch(() => {});
          }
        }
        await press(fr, dev, '.es-finish');
        await fr.waitForSelector('.es-done', { timeout: 30000 }).catch(() => {});
        await fr.waitForTimeout(500);
      }
      st = await subscription(fr, inv.investorId);
      // (the request's signedAt is set once everyone has signed, after the firm countersigns: esign.js finishSigning)
      check('the investor signs it: their signer on the new envelope is signed, the envelope waits for the firm', !!st.env && st.env.investor === 'signed' && st.env.status === 'sent', st);
    }

    // 5. Approve now works, and the firm countersigns.
    await requestsPage(fr);
    await toasts(fr);
    const row2 = st.req ? await rowText(fr, st.req.id) : '';
    check('once signed, the Requests row no longer reads "Agreement not signed"', !!row2 && !/Agreement not signed/.test(row2) && /E-signed by/.test(row2), row2);
    if (st.req) await approve(fr, dev, st.req.id);
    st = await subscription(fr, inv.investorId);
    check('B2: once the investor has signed, Approve works', !!st.req && st.req.status === 'approved', { status: st.req && st.req.status, said: await toasts(fr) });
    const funded = st.req ? `[data-action=req-funded][data-id="${st.req.id}"]` : '';
    if (st.req && st.req.status === 'approved' && (await fr.locator(funded).count())) {
      await press(fr, dev, funded);
      await fr.waitForTimeout(900);
      const inView = await fr.evaluate(() => !!document.querySelector('.es-sign-console'));
      const finished = inView ? await firmSigns(fr, dev, st) : false;
      await fr.waitForTimeout(700);
      st = await subscription(fr, inv.investorId);
      check('the firm countersigns from Requests: the envelope reads completed', finished && !!st.env && st.env.status === 'completed' && st.env.firm === 'signed', st);
      await screen(X, fr, 'countersigned');
    } else check('the firm countersigns from Requests: the envelope reads completed', false, st);
    endChecks(check, X);
    await A.context.close();
  };
}

const PARTS = {
  'request-desktop': requestPart(DESKTOP, true),
  'request-phone': requestPart(IPHONE, true),
  'unsigned-twice-desktop': requestPart(DESKTOP, false),
  'signed-kept-desktop': signedKeptPart,
  'import-desktop': importPart,
  'lost-phone': lostPart(IPHONE),
  'lost-desktop': lostPart(DESKTOP)
};

Lib.runParts(PARTS, { name: 'RECORD AND LOST AGREEMENT', browser: true });
