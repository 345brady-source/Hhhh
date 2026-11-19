#!/usr/bin/env node
// Plan 06-32: four failures of the owner-path walkthrough (06-WALKTHROUGH.md, 2026-11-19), all around signing and documents.
// Every part runs the portal the way the owner does: inside the artifact host's sandboxed iframe, whose policy refuses every
// fetch (the frame of safari-finish.js), at 1280x800 with a mouse (-desktop) and at 390x844 with touch (-phone: the controls
// under test are tapped, sideways scrolling is a finger drag). Each part first proves the frame refuses a fetch of a file
// that exists.
//   countersign  failure 3. An investor onboards and signs; the sponsor approves the subscription. "Countersign" on Requests
//                opens the agreement to sign as the firm (the view of E-sign, Open, "Sign as sponsor"); leaving it without
//                finishing leaves the request approved and nothing on the register; finishing it completes the envelope,
//                puts the commitment on the register and the request reads Accepted. The investor's Documents lists the
//                copy they signed before the firm signs and the fully signed copy after, also for an investor who already
//                holds an investment. With no agreement, or one the firm has no field on, Countersign records at once.
//   title        failure 7. The same agreement PDF named "Document.pdf": taken from the offering intake, and added with the
//                offering's "Add the subscription agreement" button from a document on the offering. The agreement, the
//                offering's document, the envelope and the investor's signed copy are titled "Subscription Agreement"
//                (the last two with the investor's name), never "Document".
//   lost-files   failure 1. The browser gives the portal no IndexedDB and the frame is loaded again, so every stored PDF is
//                gone. The sponsor's editor, the investor's agreement step and Documents each say in one plain line that
//                this browser did not keep the file and what to do; nothing says "different browser" or "document vault";
//                the agreement step shows no "Ready to finish" and no Finish; a Download with no file says so; each view
//                keeps a way out on screen.
//   viewer       failure 10. A PDF opened from the investor's Home and Documents: the zoom controls of the signing views,
//                a first width that fits, twice the width at full zoom, sideways scrolling, Download and Close kept.
//   NODE_PATH=$(npm root -g) node signing-documents.js [--only countersign-desktop,countersign-phone,title-desktop,...]
// The last line is "SIGNING DOCUMENTS: PASS (parts run: N)" or "SIGNING DOCUMENTS: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');
const SF = require('./safari-finish.js');

const OUT = path.join(Lib.OUT, 'signing-documents');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-countersign-opens\.png$/, 'Requests, Countersign pressed on an approved subscription whose agreement waits for the firm: the firm’s signing view of that agreement.'],
  [/-countersign-finished\.png$/, 'The firm finished signing from Countersign: the envelope reads Countersigned.'],
  [/-requests-accepted\.png$/, 'The Requests page once the firm has signed: the subscription reads Accepted.'],
  [/-investor-documents-before\.png$/, 'The investor’s Documents before the firm signs: the copy they signed is listed.'],
  [/-investor-documents-signed\.png$/, 'The investor’s Documents once the firm has signed: the fully signed copy is listed.'],
  [/-title-esign\.png$/, 'E-sign for an agreement whose file is named Document.pdf: the envelope is titled Subscription Agreement and the investor’s name.'],
  [/-title-documents\.png$/, 'The investor’s Documents for an agreement whose file is named Document.pdf: the signed copy and the offering document are titled Subscription Agreement.'],
  [/-lost-agreement\.png$/, 'IndexedDB absent and the frame loaded again: the investor’s agreement step says this browser did not keep the file, with no Finish and with Back.'],
  [/-lost-documents\.png$/, 'IndexedDB absent and the frame loaded again: a document opened from the investor’s Documents says this browser did not keep the file.'],
  [/-lost-editor\.png$/, 'IndexedDB absent and the frame loaded again: the sponsor’s field editor says this browser did not keep the agreement’s file.'],
  [/-viewer-open\.png$/, 'A PDF opened from the investor’s portal: drawn in the page at a width that fits, with the zoom controls, Download and Close.'],
  [/-viewer-zoomed\.png$/, 'The same PDF at full zoom, dragged sideways: Download and Close still on screen.']
]);

const { DESKTOP, IPHONE, press } = SF;
const tagOf = (dev) => (dev === IPHONE ? 'phone' : 'desktop');
const WRONG = /different browser|document vault/i;
const KEPT = /This browser did not keep/;

/** The portal in the host's frame (mode: a simulation of safari-finish.js, or 'none'), proved to refuse a fetch and to be the device's size. */
async function begin(check, S, mode, dev) {
  const { A, fr } = await SF.framed(S, mode, dev);
  await proveFrame(check, fr, dev);
  return { A, fr };
}
// The probe's own refusal is logged by the browser; only those lines (marked by PROBE) are left out of "no script error".
const PROBE = 'frame-probe';
const scriptErrors = (A) => A.errors.filter((e) => e.indexOf(PROBE) < 0);
async function proveFrame(check, fr, dev) {
  const r = await fr.evaluate((probe) =>
    fetch('assets/forms/SHA256SUMS?' + probe, { cache: 'no-store' })
      .then(
        (x) => 'fetched ' + x.status,
        (e) => 'refused: ' + String(e && e.message)
      )
      .then((f) => ({ fetch: f, sandbox: window.top !== window && !!window.frameElement ? window.frameElement.getAttribute('sandbox') || '' : '', w: innerWidth, h: innerHeight, touch: navigator.maxTouchPoints > 0 })),
    PROBE
  );
  check('the portal runs in the sandboxed frame, and the frame refuses a fetch of a file that exists', /allow-scripts/.test(r.sandbox) && /^refused/.test(r.fetch), r);
  const want = dev === IPHONE ? r.w === 390 && r.h === 844 && r.touch : r.w === 1280 && r.h === 800;
  check(dev === IPHONE ? 'the frame is 390x844 with touch' : 'the frame is 1280x800', want, { w: r.w, h: r.h, touch: r.touch });
}
/** The frame loaded again, as when the artifact is reopened (everything held only in memory is gone). */
async function reload(A) {
  await A.page.reload();
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  await fr.waitForTimeout(600);
  return fr;
}
/** Every toast shown since the last call (safari-finish.js keeps each as it appears; a toast is gone after four seconds). */
const toasts = (fr) => fr.evaluate(() => window.__sim.toasts.splice(0).filter(Boolean));
const hashOf = (fr) => fr.evaluate(() => location.hash);
const dlgOpen = (fr) => fr.evaluate(() => !!(document.getElementById('dlg') || {}).open);
/** Whether the first element matching sel (and, when given, holding the text) is inside the screen and not covered. */
const onScreen = (fr, sel, text) =>
  fr.evaluate(
    ({ sel, text }) => {
      const el = Array.from(document.querySelectorAll(sel)).find((x) => (x.offsetWidth || x.offsetHeight) && (!text || x.innerText.trim() === text));
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth || !r.width || !r.height) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && (hit === el || el.contains(hit));
    },
    { sel, text: text || '' }
  );
/** The investor's portal, signed in as them with the preview's own "Signed in as" control, on the given page. */
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
/** What the investor's Documents page lists, by section. */
const documentsNow = (fr) =>
  fr.evaluate(() => {
    const texts = (sel) => Array.from(document.querySelectorAll(sel)).map((b) => b.innerText.trim());
    return {
      mine: texts('.es-mine [data-action="es-open-mine"]'),
      signed: texts('.es-signed [data-action="es-open-doc"]'),
      table: texts('.tbl-docs .doc-link'),
      offering: texts('[data-action="sub-doc"]'),
      waiting: texts('.es-waiting .td-lead a')
    };
  });
/** The subscription of an investor: its request, its envelope and the register, as the workspace holds them now. */
const subscription = (fr, investorId, requestId) =>
  fr.evaluate(
    ({ investorId, requestId }) => {
      const ws = window.CVPortal.state.ws;
      const r = requestId ? (ws.requests || []).find((x) => x.id === requestId) : (ws.requests || []).filter((x) => x.investorId === investorId && x.type === 'subscription').pop();
      const env = r && r.envelopeId ? (ws.envelopes || []).find((e) => e.id === r.envelopeId) : null;
      const i = ws.investors.find((x) => x.id === investorId);
      const firm = env ? env.signers.find((s) => s.role === 'countersigner') : null;
      const me = env ? env.signers.find((s) => s.investorId === investorId) : null;
      const own = (type) => (env && firm ? (env.fields.find((f) => f.signerId === firm.id && f.type === type) || {}).id || '' : '');
      return {
        req: r ? { id: r.id, status: r.status } : null,
        env: env ? { id: env.id, status: env.status, title: env.title, firm: firm ? firm.status : 'none', investor: me ? me.status : 'none', sig: own('signature'), name: own('name') } : null,
        onRegister: r ? i.positions.filter((p) => p.ref === r.id).length : 0,
        hash: location.hash
      };
    },
    { investorId, requestId: requestId || '' }
  );
async function requestsPage(fr) {
  await Lib.consoleRoute(fr, 'console-requests', '[data-action=req-tab][data-t=all]');
  await fr.click('[data-action=req-tab][data-t=all]');
  await fr.waitForTimeout(300);
}
// A request's row: by its buttons while it has any, else (accepted, no buttons) by the investor's name (`who`).
const rowText = (fr, rid, who) =>
  fr.evaluate(
    ({ rid, who }) => {
      const b = document.querySelector(`[data-id="${CSS.escape(rid)}"]`);
      const rows = Array.from(document.querySelectorAll('.cs-tbl tbody tr'));
      const tr = b ? b.closest('tr') : rows.find((x) => x.innerHTML.indexOf(rid) >= 0) || (who ? rows.find((x) => x.innerText.indexOf(who) >= 0) : null);
      return tr ? tr.innerText.replace(/\s+/g, ' ') : '';
    },
    { rid, who: who || '' }
  );
/** Approve a pending request the way the sponsor does (a second press when the portal asks for one). */
async function approve(fr, dev, rid) {
  for (let i = 0; i < 2; i++) {
    const b = `[data-action=req-approve][data-id="${rid}"]`;
    if (!(await fr.locator(b).count())) break;
    await press(fr, dev, b);
    await fr.waitForTimeout(500);
  }
}
/** The firm's signing view on screen: agree to sign electronically, sign, give the signer's name, then Finish. */
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

/* ---------- countersign (failure 3) ---------- */
function countersignPart(dev) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const { A, fr } = await begin(check, S, 'none', dev);
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const name = dev === IPHONE ? 'Imogen Castellanos' : 'Thaddeus Okafor-Lindqvist';
    const title = `Subscription Agreement - ${name}`;
    const inv = await Lib.createInvitation(fr, { name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, type: 'individual', offeringId: portal.offeringId });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0 });
    check('the investor reaches the subscription agreement', w.reached, w.seen);
    if (!w.reached) return A.context.close();
    const done = await Lib.finishAgreement(fr);
    check('the done screen says a copy of the agreement they signed is in their Documents now', /A copy of the agreement you signed is in your Documents now/.test(done), done.replace(/\s+/g, ' ').slice(0, 400));
    await fr.click('.ivf-done a[href="#overview"]');
    await fr.waitForFunction(() => location.hash === '#overview');
    await asInvestor(fr, inv.investorId, 'documents');
    let docs = await documentsNow(fr);
    check('that sentence is true: the investor’s Documents lists the copy they signed', docs.mine.indexOf(title) >= 0, docs);

    // The sponsor approves; the agreement still waits for the firm's signature.
    await requestsPage(fr);
    let st = await subscription(fr, inv.investorId);
    check('the subscription is on Requests with its agreement signed by the investor and waiting for the firm', !!st.req && !!st.env && st.env.status === 'sent' && st.env.investor === 'signed' && st.env.firm !== 'signed' && !!st.env.sig, st);
    if (!st.req || !st.env) return A.context.close();
    const rid = st.req.id;
    await approve(fr, dev, rid);
    st = await subscription(fr, inv.investorId, rid);
    const funded = `[data-action=req-funded][data-id="${rid}"]`;
    check('once approved, the row has "Countersign"', st.req.status === 'approved' && (await fr.locator(funded).innerText().catch(() => '')) === 'Countersign', { status: st.req.status, row: await rowText(fr, rid) });
    await asInvestor(fr, inv.investorId, 'documents');
    docs = await documentsNow(fr);
    await A.page.screenshot({ path: path.join(OUT, `${tag}-investor-documents-before.png`), fullPage: false });
    check('approved, before the firm signs: the investor’s Documents lists the copy they signed', docs.mine.indexOf(title) >= 0, docs);

    // Countersign on Requests is the firm's signing of that agreement.
    await requestsPage(fr);
    await toasts(fr);
    await press(fr, dev, funded);
    await fr.waitForTimeout(900);
    st = await subscription(fr, inv.investorId, rid);
    const view = await fr.evaluate(() => ({ signing: !!document.querySelector('.es-sign-console'), h1: (document.querySelector('.es-sign-console h1') || {}).innerText || '', back: !!document.querySelector('[data-action="es-sign-exit"]') }));
    let said = await toasts(fr);
    await A.page.screenshot({ path: path.join(OUT, `${tag}-countersign-opens.png`), fullPage: false });
    const opened = st.hash === '#console-envelope-' + st.env.id && view.signing && view.h1 === title;
    check('Countersign opens that agreement to sign as the firm (the view of E-sign, Open, "Sign as sponsor")', opened, { hash: st.hash, view, toasts: said });
    check('nothing says "countersigned" while the agreement waits for the firm’s signature', !said.some((t) => /countersigned/i.test(t)) || st.env.firm === 'signed', { toasts: said, firm: st.env.firm });
    check('until the firm has signed, the request stays approved and nothing is on the register', st.req.status === 'approved' && st.onRegister === 0 && st.env.status === 'sent', st);
    check('the firm’s signing view keeps "Back to envelope" on screen', await onScreen(fr, '[data-action="es-sign-exit"]'), view);

    // Leaving without finishing changes nothing.
    if (view.back) {
      await press(fr, dev, '[data-action="es-sign-exit"]');
      await fr.waitForTimeout(500);
    }
    await requestsPage(fr);
    st = await subscription(fr, inv.investorId, rid);
    check('leaving the signing view without finishing leaves the request approved, with Countersign, and not on the register', st.req.status === 'approved' && st.onRegister === 0 && st.env.firm !== 'signed' && (await fr.locator(funded).count()) === 1, { st, row: await rowText(fr, rid) });
    await asInvestor(fr, inv.investorId, 'documents');
    docs = await documentsNow(fr);
    check('after Countersign was pressed, the investor’s Documents still lists the copy they signed', docs.mine.indexOf(title) >= 0 || docs.table.indexOf(title) >= 0, docs);

    // Countersign again, and this time the firm signs.
    await requestsPage(fr);
    if (await fr.locator(funded).count()) {
      await press(fr, dev, funded);
      await fr.waitForTimeout(900);
    }
    const inView = await fr.evaluate(() => !!document.querySelector('.es-sign-console'));
    check('Countersign opens the firm’s signing again', inView, await hashOf(fr));
    if (inView) {
      await toasts(fr);
      const finished = await firmSigns(fr, dev, st);
      await fr.waitForTimeout(700);
      said = await toasts(fr);
      st = await subscription(fr, inv.investorId, rid);
      await A.page.screenshot({ path: path.join(OUT, `${tag}-countersign-finished.png`), fullPage: false });
      check('the firm finishes signing: the envelope is completed with the firm’s signature', finished && st.env.status === 'completed' && st.env.firm === 'signed', { finished, st, toasts: said });
      check('only now the request reads countersigned: it is accepted and the commitment is on the register', st.req.status === 'accepted' && st.onRegister === 1, st);
      check('the sponsor is told "Subscription countersigned. The commitment is on the investor register."', said.some((t) => t === 'Subscription countersigned. The commitment is on the investor register.'), said);
      check('the finished view keeps "Back to envelope" on screen', await onScreen(fr, '[data-action="es-sign-exit"]'));
      await requestsPage(fr);
      await A.page.screenshot({ path: path.join(OUT, `${tag}-requests-accepted.png`), fullPage: false });
      const row = await rowText(fr, rid, name);
      check('Requests shows the subscription as Accepted, with no Countersign left', /Accepted/.test(row) && (await fr.locator(funded).count()) === 0, row);
      await Lib.consoleRoute(fr, 'console-esign', '.cs-tbl');
      const es = await fr.evaluate((t) => {
        const tr = Array.from(document.querySelectorAll('.cs-tbl tbody tr')).find((x) => x.innerText.indexOf(t) >= 0);
        return tr ? tr.innerText.replace(/\s+/g, ' ') : '';
      }, title);
      check('E-sign lists the envelope as completed', /Completed/.test(es) && !/Out for signature/.test(es), es);
      await asInvestor(fr, inv.investorId, 'documents');
      docs = await documentsNow(fr);
      await A.page.screenshot({ path: path.join(OUT, `${tag}-investor-documents-signed.png`), fullPage: false });
      check('after the firm signs, the investor’s Documents lists the fully signed copy', docs.table.indexOf(title) >= 0 || docs.signed.indexOf(title) >= 0, docs);
      const link = fr.locator('.tbl-docs .doc-link, .es-signed [data-action="es-open-doc"]', { hasText: title }).first();
      if (await link.count()) {
        await press(fr, dev, `.tbl-docs .doc-link:has-text("${title}"), .es-signed [data-action="es-open-doc"]:has-text("${title}")`);
        const drawn = await fr
          .waitForFunction(() => {
            const i = Array.from(document.querySelectorAll('#dlg[open] .doc-page'));
            return i.length > 0 && i.every((x) => x.complete && x.naturalWidth > 0) ? i.length : 0;
          }, null, { timeout: 30000 })
          .then((x) => x.jsonValue(), () => 0);
        // the agreement's three pages and its certificate
        check('the fully signed copy opens from Documents with its pages drawn (the agreement and its certificate)', drawn >= 4, drawn);
        if (await dlgOpen(fr)) await press(fr, dev, '#dlg [data-action="close-dialog"]');
      }
    }

    // An investor who already holds an investment and signs the agreement for more: their signed copy is listed too.
    const holder = await fr.evaluate((oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === oid);
      const open = (ws.invitations || []).filter((x) => ['sent', 'opened', 'in_progress'].indexOf(x.status) >= 0).map((x) => x.investorId);
      const i = ws.investors.find((x) => x.positions.length && x.onboarding.status === 'complete' && x.type === 'individual' && open.indexOf(x.id) < 0 && !(ws.requests || []).some((r) => r.investorId === x.id && r.status === 'pending'));
      if (!i) return null;
      const r = NS.ops.submitSubscription(ws, i, o, { cents: 7500000, signature: i.contact });
      NS.app.save(true);
      return { id: i.id, title: i.title, rid: r.id, envId: r.envelopeId || '' };
    }, portal.offeringId);
    check('an investor on file who holds an investment subscribes for more on the agreement', !!holder && !!holder.envId, holder);
    if (holder && holder.envId) {
      await asInvestor(fr, holder.id, 'sign-' + holder.envId);
      if (await fr.locator('#es-consent-box').count()) {
        await fr.check('#es-consent-box');
        await press(fr, dev, '[data-action="es-consent"]');
      }
      await fr.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 });
      await press(fr, dev, '.es-finish');
      await fr.waitForSelector('.es-done', { timeout: 30000 }).catch(() => {});
      await asInvestor(fr, holder.id, 'documents');
      docs = await documentsNow(fr);
      const hs = await subscription(fr, holder.id, holder.rid);
      check('they signed and the firm has not: their Documents (the page with the document table) lists the copy they signed', hs.env.investor === 'signed' && hs.env.firm !== 'signed' && docs.mine.indexOf(`Subscription Agreement - ${holder.title}`) >= 0, { docs: { mine: docs.mine, table: docs.table.length }, env: hs.env });
    }

    // No agreement at all (a subscription recorded from paper): Countersign records at once, as before.
    const paper = await fr.evaluate((oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === oid);
      const i = ws.investors.find((x) => x.onboarding.status === 'complete' && !(ws.requests || []).some((r) => r.investorId === x.id && r.offeringId === oid));
      if (!i) return null;
      const r = NS.ops.submitSubscription(ws, i, o, { cents: 6000000, signature: i.contact, offline: true, actor: 'check' });
      NS.app.save(true);
      return { id: i.id, rid: r.id, envId: r.envelopeId || '' };
    }, portal.offeringId);
    check('a subscription with no agreement is on Requests', !!paper && !paper.envId, paper);
    if (paper) {
      await requestsPage(fr);
      await approve(fr, dev, paper.rid);
      await toasts(fr);
      await press(fr, dev, `[data-action=req-funded][data-id="${paper.rid}"]`);
      await fr.waitForTimeout(600);
      const ps = await subscription(fr, paper.id, paper.rid);
      const pt = await toasts(fr);
      check('with no agreement, Countersign records at once as before (accepted, on the register, the Requests page kept)', ps.req.status === 'accepted' && ps.onRegister === 1 && ps.hash === '#console-requests' && pt.some((t) => /^Subscription countersigned\./.test(t)), { ps, toasts: pt });
    }
    // An agreement the firm has no field on: the same.
    const solo = await fr.evaluate((oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === oid);
      const tpl = NS.esign.subscriptionTemplate(ws, oid);
      tpl.roles = ['Investor'];
      tpl.fields = tpl.fields.filter((f) => f.signerRole === 'Investor');
      const i = ws.investors.find((x) => x.onboarding.status === 'complete' && !(ws.requests || []).some((r) => r.investorId === x.id && r.offeringId === oid));
      if (!i) return null;
      const r = NS.ops.submitSubscription(ws, i, o, { cents: 6500000, signature: i.contact });
      const env = (ws.envelopes || []).find((e) => e.id === r.envelopeId);
      NS.app.save(true);
      return { id: i.id, rid: r.id, envId: r.envelopeId || '', firm: env ? env.signers.filter((s) => s.role === 'countersigner').length : -1 };
    }, portal.offeringId);
    check('a subscription whose agreement has no field for the firm is on Requests', !!solo && !!solo.envId && solo.firm === 0, solo);
    if (solo) {
      await requestsPage(fr);
      await approve(fr, dev, solo.rid);
      await toasts(fr);
      await press(fr, dev, `[data-action=req-funded][data-id="${solo.rid}"]`);
      await fr.waitForTimeout(600);
      const ss = await subscription(fr, solo.id, solo.rid);
      const stt = await toasts(fr);
      check('with no field for the firm, Countersign records at once as before', ss.req.status === 'accepted' && ss.onRegister === 1 && ss.hash === '#console-requests' && stt.some((t) => /^Subscription countersigned\./.test(t)), { ss, toasts: stt });
    }
    const shown = await Lib.screenText(fr);
    check('no vendor name and no forbidden word on the last screen', Lib.leakCheck(shown).ok, Lib.leakCheck(shown).hits);
    check('no script error in the browser', scriptErrors(A).length === 0, scriptErrors(A));
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

/* ---------- title (failure 7) ---------- */
function titlePart(dev) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const { A, fr } = await begin(check, S, 'none', dev);
    // The sample firm, with no agreement on any offering yet.
    await fr.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
    await fr.goto(S.base);
    await fr.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]');
    await fr.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
    await fr.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay');
    // Phase 4's generated three-page agreement, as lib.js setupPortal makes it (one PDF for every part of a run).
    const fund = await fr.evaluate(() => {
      const ws = window.CVPortal.state.ws;
      return (ws.offerings.find((x) => x.status === 'Raising') || ws.offerings[0]).name;
    });
    if (!process.env.SIGN_OUT) process.env.SIGN_OUT = path.join(Lib.OUT, 'p4');
    const pdf = Buffer.from(await require(path.join(Lib.ROOT, '.planning/phases/04-signing-inside-onboarding/checks/lib.js')).agreementPdf(A.context, fund), 'base64');

    // Path 1: the offering intake reads "Document.pdf" and takes it as the subscription agreement.
    await Lib.consoleRoute(fr, 'console-intake', '#ik-files');
    await fr.setInputFiles('#ik-files', { name: 'Document.pdf', mimeType: 'application/pdf', buffer: pdf });
    await fr.waitForSelector('[data-action=ik-read]:not([disabled])');
    await press(fr, dev, '[data-action=ik-read]');
    await fr.waitForSelector('[data-action=ik-apply]', { timeout: 180000 });
    const before = await fr.evaluate(() => window.CVPortal.state.ws.offerings.map((o) => o.id));
    await press(fr, dev, '[data-action=ik-apply]');
    await fr.waitForFunction(() => /is set up/.test(document.body.innerText), null, { timeout: 300000 });
    const oid = await fr.evaluate((old) => (window.CVPortal.state.ws.offerings.find((x) => old.indexOf(x.id) < 0) || {}).id || '', before);
    await fr.waitForFunction((id) => {
      const r = window.CVPortal.intake.agreementReading ? window.CVPortal.intake.agreementReading(id) : null;
      return !r || r.state !== 'reading';
    }, oid, { timeout: 300000, polling: 1000 });
    const agreement = (id) =>
      fr.evaluate((id) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const tpl = NS.esign.subscriptionTemplate(ws, id);
        return {
          saved: !!tpl,
          ready: !!tpl && NS.esign.templateReady(ws, id),
          title: tpl ? tpl.title : '',
          fileName: tpl ? tpl.fileName : '',
          docs: (ws.docs || []).filter((d) => d.offeringId === id && d.offeringDoc).map((d) => ({ title: d.title, fileName: d.fileName, hidden: !!d.hidden }))
        };
      }, id);
    const a1 = await agreement(oid);
    check('the intake takes "Document.pdf" as the offering’s subscription agreement, ready for investors', a1.saved && a1.ready && a1.fileName === 'Document.pdf', a1);
    check('intake: the agreement is titled "Subscription Agreement", not by its file name', a1.title === 'Subscription Agreement', a1.title);
    check('intake: the offering’s document is titled "Subscription Agreement" (its file name is kept as the file name)', a1.docs.length === 1 && a1.docs[0].title === 'Subscription Agreement' && a1.docs[0].fileName === 'Document.pdf', a1.docs);
    await Lib.consoleRoute(fr, 'console-offering-' + oid, '#agreement');
    const panel = (await fr.locator('#agreement').innerText()).replace(/\s+/g, ' ');
    check('intake: the offering page names the agreement "Subscription Agreement"', /Ready Subscription Agreement ·/.test(panel) && !/\bDocument\b/.test(panel), panel.slice(0, 200));
    await Lib.consoleRoute(fr, 'console-docs', '.cs-panel-head h2');
    const pub = await fr.evaluate(() => Array.from(document.querySelectorAll('.cs-tbl tbody tr')).map((tr) => tr.children[1].innerText.replace(/\s+/g, ' ')).filter((t) => /Document\.pdf/.test(t)));
    check('intake: the console’s Documents lists it as "Subscription Agreement" with the file name beneath', pub.length === 1 && /^Subscription Agreement Document\.pdf/.test(pub[0]), pub);

    // An investor invited to that offering signs it.
    await fr.evaluate((id) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === id);
      o.structure = Object.assign({}, o.structure, { exemption: 'Rule 506(b)' });
      o.minimum = 50000;
      NS.integrations.ensure(ws).configured = true;
      NS.app.save(true);
    }, oid);
    const name = dev === IPHONE ? 'Ravi Balasubramanian' : 'Henrietta Voss-Aldana';
    const title = `Subscription Agreement - ${name}`;
    const inv = await Lib.createInvitation(fr, { name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, type: 'individual', offeringId: oid });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    let listed = null;
    const w = await Lib.walk(fr, {
      name,
      acc: 'yes',
      basis: 0,
      onStep: async (hd) => {
        if (/^Subscription$/.test(hd)) listed = await fr.locator('.ivf-docs [data-action="sub-doc"]').allInnerTexts();
      }
    });
    check('the investor reaches the subscription agreement', w.reached, w.seen);
    check('intake: the Subscription step lists the offering document as "Subscription Agreement"', !!listed && listed.length === 1 && listed[0].trim() === 'Subscription Agreement', listed);
    if (w.reached) {
      await Lib.finishAgreement(fr);
      await fr.click('.ivf-done a[href="#overview"]');
      await fr.waitForFunction(() => location.hash === '#overview');
      await asInvestor(fr, inv.investorId, 'documents');
      const docs = await documentsNow(fr);
      await A.page.screenshot({ path: path.join(OUT, `${tag}-title-documents.png`), fullPage: false });
      check(`intake: the investor’s signed copy is titled "${title}"`, docs.mine.length === 1 && docs.mine[0] === title, docs.mine);
      check('intake: the investor’s Documents lists the offering document as "Subscription Agreement"', docs.offering.length === 1 && docs.offering[0] === 'Subscription Agreement', docs.offering);
      await Lib.consoleRoute(fr, 'console-esign', '.cs-tbl');
      await A.page.screenshot({ path: path.join(OUT, `${tag}-title-esign.png`), fullPage: false });
      const rows = await fr.evaluate(() => Array.from(document.querySelectorAll('.cs-tbl tbody tr')).map((tr) => tr.children[0].innerText.replace(/\s+/g, ' ').trim()));
      check(`intake: E-sign lists the envelope as "${title}"`, rows.some((t) => t.indexOf(title) === 0) && !rows.some((t) => /^Document\b/.test(t)), rows.slice(0, 6));
    }

    // Path 2: the offering's "Add the subscription agreement" button, with the same file already on the offering.
    const other = await fr.evaluate(
      async ({ arr, not }) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const o = ws.offerings.find((x) => x.status === 'Raising' && x.id !== not && !NS.esign.subscriptionTemplate(ws, x.id)) || ws.offerings.find((x) => x.id !== not && !NS.esign.subscriptionTemplate(ws, x.id));
        const blob = new Blob([new Uint8Array(arr)], { type: 'application/pdf' });
        await NS.ops.files.put('doc-title-check', blob);
        ws.docs = ws.docs || [];
        // as the intake stores an uploaded document: titled from its file name
        ws.docs.push({ id: 'doc-title-check', title: 'Document', fileName: 'Document.pdf', type: 'application/pdf', size: blob.size, sha256: '', cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: NS.dates.today(), taxYear: '', publishedAt: new Date().toISOString(), publishedBy: 'check', offeringDoc: true, hidden: false });
        NS.app.save(true);
        return { id: o.id, name: o.name };
      },
      { arr: Array.from(pdf), not: oid }
    );
    await Lib.consoleRoute(fr, 'console-offering-' + other.id, `[data-action="es-agreement-new"][data-offering="${other.id}"]`);
    await press(fr, dev, `[data-action="es-agreement-new"][data-offering="${other.id}"]`);
    await fr.waitForSelector('#dlg[open] form[data-form="es-agreement"]');
    await fr.waitForFunction(() => (document.querySelector('#es-agr-doc') || { dataset: {} }).dataset.read === 'done', null, { timeout: 180000, polling: 500 });
    await fr.selectOption('#es-agr-doc', 'doc-title-check');
    const typed = await fr.inputValue('#es-agr-title');
    await press(fr, dev, 'form[data-form="es-agreement"] button[type=submit]');
    await fr.waitForFunction(() => /^#console-envelope-/.test(location.hash) && !!document.querySelector('[data-action="es-agreement-save"]'), null, { timeout: 180000 });
    await fr.waitForTimeout(600);
    await press(fr, dev, '[data-action="es-agreement-save"]');
    await fr.waitForFunction((id) => location.hash === '#console-offering-' + id, other.id, { timeout: 20000 }).catch(() => {});
    const a2 = await agreement(other.id);
    check('button: the agreement added from the document on the offering is saved and ready', a2.saved && a2.ready, Object.assign({ toasts: await toasts(fr) }, a2));
    check('button: the agreement is titled "Subscription Agreement" (the dialog’s own title)', typed === 'Subscription Agreement' && a2.title === 'Subscription Agreement', { typed, title: a2.title });
    check('button: the offering’s document is titled "Subscription Agreement" too', a2.docs.length === 1 && a2.docs[0].title === 'Subscription Agreement' && a2.docs[0].fileName === 'Document.pdf', a2.docs);
    const env2 = await fr.evaluate((id) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === id);
      const i = ws.investors.find((x) => x.onboarding.status === 'complete' && !(ws.requests || []).some((r) => r.investorId === x.id && r.offeringId === id));
      const r = NS.ops.submitSubscription(ws, i, o, { cents: 5000000, signature: i.contact });
      const env = (ws.envelopes || []).find((e) => e.id === r.envelopeId);
      NS.app.save(true);
      return { title: env ? env.title : '', want: `Subscription Agreement - ${i.title}` };
    }, other.id);
    check('button: the envelope an investor of that offering signs is titled "Subscription Agreement" and their name', env2.title === env2.want, env2);
    const shown = await Lib.screenText(fr);
    check('no vendor name and no forbidden word on the last screen', Lib.leakCheck(shown).ok, Lib.leakCheck(shown).hits);
    check('no script error in the browser', scriptErrors(A).length === 0, scriptErrors(A));
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

/* ---------- lost-files (failure 1) ---------- */
function lostFilesPart(dev) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const { A, fr: first } = await begin(check, S, 'noidb', dev);
    let fr = first;
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
    // The sponsor opens the agreement's fields: a draft of it, drawn from the stored PDF.
    await Lib.consoleRoute(fr, 'console-offering-' + portal.offeringId, `[data-action="es-agreement-edit"][data-offering="${portal.offeringId}"]`);
    await press(fr, dev, `[data-action="es-agreement-edit"][data-offering="${portal.offeringId}"]`);
    const drew = await fr.waitForSelector('.fe-doc .es-page img', { timeout: 30000 }).then(() => true, () => false);
    const draftId = await fr.evaluate(() => (location.hash.match(/^#console-envelope-(.+)$/) || [])[1] || '');
    check('in the same page load the field editor draws the agreement', drew && !!draftId, { drew, hash: await hashOf(fr) });
    // An investor walks to the agreement, finishing the W-9 on the way; the agreement draws.
    const name = dev === IPHONE ? 'Marisol Etxeberria' : 'Cormac Niedzwiecki';
    const inv = await Lib.createInvitation(fr, { name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, type: 'individual', offeringId: portal.offeringId });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0 });
    check('in the same page load the investor reaches the agreement and it is drawn', w.reached, w.seen);
    if (!w.reached) return A.context.close();
    const team = await fr.evaluate(() => {
      const s = window.CVPortal.state.ws.tenant.support || {};
      return { team: s.team || '', email: s.email || '' };
    });

    // The frame is loaded again: what was held in memory is gone.
    fr = await reload(A);
    await proveFrame(check, fr, dev);
    check('after the reload the browser still gives no IndexedDB', (await noIdb()) === 'SecurityError', await noIdb());
    const asks = (t) => KEPT.test(t) && (!team.email || t.indexOf(team.email) >= 0) && /\bAsk\b/.test(t);

    // 1. The investor's agreement step.
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    await fr.waitForFunction(() => /Subscription agreement/.test((document.querySelector('.ivf-form h1') || {}).innerText || ''), null, { timeout: 30000 }).catch(() => {});
    await fr.waitForFunction(() => !document.querySelector('.ivf-form .es-loading'), null, { timeout: 30000 }).catch(() => {});
    await fr.waitForTimeout(600);
    const step = await fr.evaluate(() => {
      const f = document.querySelector('.ivf-form');
      const fin = f ? f.querySelector('.es-finish') : null;
      return { h1: f ? (f.querySelector('h1') || {}).innerText || '' : '', text: f ? f.innerText.replace(/\s+/g, ' ') : '', pages: f ? f.querySelectorAll('.es-page img').length : -1, finish: !!fin && !fin.disabled && !!(fin.offsetWidth || fin.offsetHeight), note: f ? ((f.querySelector('.es-note-bad') || {}).innerText || '').replace(/\s+/g, ' ').trim() : '' };
    });
    await A.page.screenshot({ path: path.join(OUT, `${tag}-lost-agreement.png`), fullPage: false });
    check('the agreement step opens and cannot draw the agreement', step.h1 === 'Subscription agreement' && step.pages === 0, { h1: step.h1, pages: step.pages });
    check('agreement step: nothing about "a different browser" or "the document vault"', !WRONG.test(step.text), step.note || step.text.slice(0, 300));
    check('agreement step: one plain line says this browser did not keep the file and to ask the firm (its contact named)', asks(step.note), step.note);
    check('agreement step: the bar does not read "Ready to finish" and no Finish can be pressed', !/Ready to finish/.test(step.text) && !step.finish, { finish: step.finish, text: step.text.slice(0, 300) });
    check('agreement step: nothing on it tells the investor to Start, Finish or Decline a document they cannot see', !/Select Start|then Finish|Decline to sign/.test(step.text), step.text.slice(0, 300));
    const backOn = await onScreen(fr, '.ivf-form button, .ivf-form a', 'Back');
    check('agreement step: Back is on screen', backOn, step.text.slice(0, 200));
    if (backOn) {
      await fr.evaluate(() => {
        const vis = (el) => {
          const r = el.getBoundingClientRect();
          return el.offsetWidth && r.top >= 0 && r.bottom <= innerHeight;
        };
        const b = Array.from(document.querySelectorAll('.ivf-form button, .ivf-form a')).find((x) => x.innerText.trim() === 'Back' && vis(x));
        b.click();
      });
      await fr.waitForTimeout(600);
      check('agreement step: Back leaves it (to Subscription)', (await Lib.heading(fr)) === 'Subscription', await Lib.heading(fr));
    }

    // 2. The investor's Documents: the signed W-9 and the offering document, whose files are gone.
    await asInvestor(fr, inv.investorId, 'documents');
    const docs = await documentsNow(fr);
    check('Documents lists the signed Form W-9 and the offering document', docs.signed.some((t) => /W-9/.test(t)) && docs.offering.length >= 1, docs);
    const dialogSays = async (what, sel) => {
      await press(fr, dev, sel);
      await fr.waitForSelector('#dlg[open]', { timeout: 15000 }).catch(() => {});
      await fr.waitForFunction(() => !/Loading/.test((document.querySelector('#dlg .dlg-body') || {}).innerText || ''), null, { timeout: 30000 }).catch(() => {});
      await fr.waitForTimeout(400);
      const body = ((await fr.locator('#dlg .dlg-body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      check(`${what}: nothing about "a different browser" or "the document vault"`, !!body && !WRONG.test(body), body);
      check(`${what}: one plain line says this browser did not keep the file and to ask the firm`, asks(body) && body.split(/(?<=\.)\s/).length <= 2, body);
      check(`${what}: Close is on screen`, await onScreen(fr, '#dlg [data-action="close-dialog"][aria-label="Close"]'));
      return body;
    };
    if (docs.offering.length) {
      await dialogSays('offering document', '[data-action="sub-doc"]');
      await A.page.screenshot({ path: path.join(OUT, `${tag}-lost-documents.png`), fullPage: false });
      await toasts(fr);
      const got = A.page.waitForEvent('download', { timeout: 2500 }).then(() => true, () => false);
      await press(fr, dev, '#dlg [data-action="up-download"]');
      const file = await got;
      const said = await toasts(fr);
      check('offering document: its Download, having no file, says so in the same plain words (and saves nothing)', !file && said.length === 1 && asks(said[0]) && !WRONG.test(said[0]), { file, said });
      await press(fr, dev, '#dlg [data-action="close-dialog"][aria-label="Close"]');
      await fr.waitForTimeout(300);
    }
    if (docs.signed.length) {
      await toasts(fr);
      const got = A.page.waitForEvent('download', { timeout: 2500 }).then(() => true, () => false);
      await press(fr, dev, '.es-signed [data-action="es-dl-signed"]');
      const file = await got;
      const said = await toasts(fr);
      check('signed W-9: Download, having no file, says so in the same plain words (and saves nothing)', !file && said.length === 1 && asks(said[0]) && !WRONG.test(said[0]), { file, said });
      await dialogSays('signed W-9', '.es-signed [data-action="es-open-doc"]');
      await press(fr, dev, '#dlg [data-action="close-dialog"][aria-label="Close"]');
      await fr.waitForTimeout(300);
    }

    // 3. The sponsor's field editor: the draft opened before the reload, then "Edit fields" on the offering.
    await Lib.consoleRoute(fr, 'console-envelope-' + draftId, '.cs-head, .cs-panel-head h2, h1');
    await fr.waitForFunction(() => !document.querySelector('.es-loading'), null, { timeout: 30000 }).catch(() => {});
    await fr.waitForTimeout(500);
    const ed = await fr.evaluate(() => ({ note: ((document.querySelector('#view .es-note-bad') || {}).innerText || '').replace(/\s+/g, ' ').trim(), pages: document.querySelectorAll('#view .es-page img').length, text: document.querySelector('#view').innerText.replace(/\s+/g, ' ') }));
    await A.page.screenshot({ path: path.join(OUT, `${tag}-lost-editor.png`), fullPage: false });
    check('field editor: the draft opens and cannot draw the agreement', ed.pages === 0 && /^#console-envelope-/.test(await hashOf(fr)), { pages: ed.pages, hash: await hashOf(fr) });
    check('field editor: nothing about "a different browser" or "the document vault"', !WRONG.test(ed.text), ed.note);
    check('field editor: one plain line says this browser did not keep the agreement’s file and to add the agreement again', KEPT.test(ed.note) && /Add the agreement again/.test(ed.note), ed.note);
    const out = { offering: await onScreen(fr, 'a.cs-btn', 'Offering'), cancel: await onScreen(fr, '[data-action="es-agreement-cancel"]') };
    check('field editor: "Offering" and "Cancel" are on screen', out.offering && out.cancel, out);
    if (await fr.locator('[data-action="es-agreement-cancel"]').count()) {
      await press(fr, dev, '[data-action="es-agreement-cancel"]');
      await fr.waitForFunction((id) => location.hash === '#console-offering-' + id, portal.offeringId, { timeout: 15000 }).catch(() => {});
    }
    await fr.waitForTimeout(400);
    const edit = `[data-action="es-agreement-edit"][data-offering="${portal.offeringId}"]`;
    check('Cancel returns to the offering, which offers "Edit fields"', (await hashOf(fr)) === '#console-offering-' + portal.offeringId && (await fr.locator(edit).count()) === 1, await hashOf(fr));
    if (await fr.locator(edit).count()) {
      await toasts(fr);
      await press(fr, dev, edit);
      await fr.waitForTimeout(1200);
      const said = await toasts(fr);
      check('"Edit fields": one plain line says this browser did not keep the agreement’s file and to add the agreement again', said.length === 1 && KEPT.test(said[0]) && /Add the agreement again/.test(said[0]) && !WRONG.test(said[0]), said);
      check('"Edit fields": the offering page stays, with "Replace the PDF" to add the agreement again', (await hashOf(fr)) === '#console-offering-' + portal.offeringId && (await fr.locator(`[data-action="es-agreement-new"][data-offering="${portal.offeringId}"]`).count()) === 1, await hashOf(fr));
    }
    const top = (await fr.locator('#notes').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    check('the sponsor is told at the top that this browser is not letting the portal save', /This browser is not letting the portal save/.test(top), top);
    const sim = await fr.evaluate(() => window.__sim.unhandled.slice());
    check('no uncaught error or unhandled rejection in the frame', sim.length === 0 && scriptErrors(A).length === 0, { unhandled: sim, console: scriptErrors(A) });
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

/* ---------- viewer (failure 10) ---------- */
/** A finger drag (phone) or a sideways wheel (desktop) across the open dialog's body, to the left by `dx` pixels. */
async function sideways(A, fr, dev, dx) {
  const b = await fr.locator('#dlg .dlg-body').boundingBox();
  const y = Math.round(b.y + Math.min(b.height / 2, 220));
  const x0 = Math.round(b.x + b.width - 30);
  if (!dev.hasTouch) {
    await A.page.mouse.move(Math.round(b.x + b.width / 2), y);
    await A.page.mouse.wheel(dx, 0);
    return fr.waitForTimeout(400);
  }
  const cdp = await A.context.newCDPSession(A.page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(x0 - (dx * k) / 8), y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  return fr.waitForTimeout(500);
}
const viewerNow = (fr) =>
  fr.evaluate(() => {
    const d = document.getElementById('dlg');
    const body = d.querySelector('.dlg-body');
    const pages = Array.from(d.querySelectorAll('.doc-page'));
    const seen = (el) => {
      if (!el || !(el.offsetWidth || el.offsetHeight)) return false;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && (hit === el || el.contains(hit));
    };
    const zoom = Array.from(d.querySelectorAll('.sf-zoom .sf-zoom-btn')).filter((b) => b.offsetWidth);
    return {
      pages: pages.filter((i) => i.complete && i.naturalWidth > 0).length,
      pageW: pages[0] ? Math.round(pages[0].getBoundingClientRect().width) : 0,
      bodyW: body ? body.clientWidth : 0,
      scrollW: body ? body.scrollWidth : 0,
      scrollLeft: body ? Math.round(body.scrollLeft) : 0,
      zoom: zoom.map((b) => ({ label: b.getAttribute('aria-label') || '', disabled: b.disabled, seen: seen(b), h: Math.round(b.getBoundingClientRect().height) })),
      download: seen(Array.from(d.querySelectorAll('.dlg-head button')).find((b) => /Download/.test(b.innerText))),
      close: seen(d.querySelector('[data-action="close-dialog"][aria-label="Close"]')),
      other: d.querySelectorAll('iframe, embed, object').length
    };
  });
async function viewerChecks(check, A, fr, dev, what, sel, opts) {
  opts = opts || {};
  await press(fr, dev, sel);
  await fr.waitForSelector('#dlg[open]', { timeout: 15000 });
  const drawn = await fr
    .waitForFunction(() => {
      const i = Array.from(document.querySelectorAll('#dlg[open] .doc-page'));
      return i.length > 0 && i.every((x) => x.complete && x.naturalWidth > 0);
    }, null, { timeout: 45000 })
    .then(() => true, () => false);
  await fr.waitForTimeout(300);
  let v = await viewerNow(fr);
  if (opts.shot) await A.page.screenshot({ path: path.join(OUT, `${opts.shot}-viewer-open.png`), fullPage: false });
  check(`${what}: drawn in the page (page images, no browser PDF viewer)`, drawn && v.pages >= 1 && v.other === 0, v);
  const zin = (x) => x.zoom.find((b) => /^Zoom in/.test(b.label));
  const zout = (x) => x.zoom.find((b) => /^Zoom out/.test(b.label));
  check(`${what}: the signing views’ zoom controls are in the viewer, on screen ("Zoom out" and "Zoom in")`, !!zin(v) && !!zout(v) && zin(v).seen && zout(v).seen, v.zoom);
  check(`${what}: it opens at a width that fits (nothing to scroll sideways, zoom out at its end)`, v.pageW > 0 && v.pageW <= v.bodyW && v.scrollW <= v.bodyW + 1 && !!zout(v) && zout(v).disabled, { pageW: v.pageW, bodyW: v.bodyW, scrollW: v.scrollW });
  check(`${what}: Download${opts.noDownload ? ' is not offered (a copy still waiting for the firm) and' : ' and'} Close are on screen`, v.close && (opts.noDownload ? !v.download : v.download), { download: v.download, close: v.close });
  const w0 = v.pageW;
  for (let i = 0; i < 4 && zin(v) && !zin(v).disabled; i++) {
    await press(fr, dev, '#dlg .sf-zoom [aria-label="Zoom in"]');
    await fr.waitForTimeout(350);
    v = await viewerNow(fr);
  }
  check(`${what}: at full zoom the page is twice as wide${dev === IPHONE ? ' (over 600 pixels on the phone)' : ''}`, w0 > 0 && Math.abs(v.pageW / w0 - 2) < 0.03 && (dev !== IPHONE || v.pageW >= 600) && !!zin(v) && zin(v).disabled, { before: w0, now: v.pageW });
  check(`${what}: zoomed, the page is wider than the viewer`, v.scrollW > v.bodyW + 50, { scrollW: v.scrollW, bodyW: v.bodyW });
  const l0 = v.scrollLeft;
  await sideways(A, fr, dev, 160);
  v = await viewerNow(fr);
  if (opts.shot) await A.page.screenshot({ path: path.join(OUT, `${opts.shot}-viewer-zoomed.png`), fullPage: false });
  check(`${what}: zoomed, ${dev === IPHONE ? 'a finger drag' : 'the wheel'} scrolls it sideways`, v.scrollLeft > l0 + 40, { before: l0, now: v.scrollLeft });
  check(`${what}: zoomed and scrolled, the zoom controls${opts.noDownload ? '' : ', Download'} and Close stay on screen`, v.close && (opts.noDownload || v.download) && !!zout(v) && zout(v).seen && zin(v).seen, { download: v.download, close: v.close, zoom: v.zoom });
  for (let i = 0; i < 4 && zout(v) && !zout(v).disabled; i++) {
    await press(fr, dev, '#dlg .sf-zoom [aria-label="Zoom out"]');
    await fr.waitForTimeout(350);
    v = await viewerNow(fr);
  }
  check(`${what}: zoomed out again, it fits as it opened`, Math.abs(v.pageW - w0) <= 2 && v.scrollW <= v.bodyW + 1, { before: w0, now: v.pageW, scrollW: v.scrollW, bodyW: v.bodyW });
  await press(fr, dev, '#dlg [data-action="close-dialog"][aria-label="Close"]');
  await fr.waitForTimeout(400);
  check(`${what}: Close closes it`, !(await dlgOpen(fr)));
}
function viewerPart(dev) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const { A, fr } = await begin(check, S, 'none', dev);
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    // The offering's memorandum is a real PDF here (the agreement's bytes), so it can be drawn.
    await fr.evaluate(async () => {
      const NS = window.CVPortal;
      const b = await NS.ops.files.get('tpl-doc-test');
      await NS.ops.files.put('doc-ppm-test', b);
      const d = NS.state.ws.docs.find((x) => x.id === 'doc-ppm-test');
      d.size = b.size;
      NS.app.save(true);
    });
    const name = dev === IPHONE ? 'Solveig Abernathy' : 'Bartholomew Nwosu';
    const inv = await Lib.createInvitation(fr, { name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, type: 'individual', offeringId: portal.offeringId });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0 });
    check('the investor reaches the subscription agreement', w.reached, w.seen);
    if (!w.reached) return A.context.close();
    await Lib.finishAgreement(fr);
    await fr.click('.ivf-done a[href="#overview"]');
    await fr.waitForFunction(() => location.hash === '#overview');
    await fr.waitForTimeout(600);
    const w9 = '[data-action="es-open-doc"]:has-text("W-9")';
    check('Home lists the Form W-9', (await fr.locator(w9).count()) >= 1, await fr.locator('[data-action="es-open-doc"]').allInnerTexts());
    if (await fr.locator(w9).count()) await viewerChecks(check, A, fr, dev, 'Form W-9 from Home', w9, { shot: tag });
    await asInvestor(fr, inv.investorId, 'documents');
    const docs = await documentsNow(fr);
    check('Documents lists the copy the investor signed and the offering document', docs.mine.length === 1 && docs.offering.length >= 1, docs);
    if (docs.mine.length) await viewerChecks(check, A, fr, dev, 'the agreement the investor signed, from Documents', '.es-mine [data-action="es-open-mine"]', { noDownload: true });
    if (docs.offering.length) await viewerChecks(check, A, fr, dev, 'the offering document, from Documents', '[data-action="sub-doc"]');
    check('no script error in the browser', scriptErrors(A).length === 0, scriptErrors(A));
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

const PARTS = {
  'countersign-desktop': countersignPart(DESKTOP),
  'countersign-phone': countersignPart(IPHONE),
  'title-desktop': titlePart(DESKTOP),
  'title-phone': titlePart(IPHONE),
  'lost-files-desktop': lostFilesPart(DESKTOP),
  'lost-files-phone': lostFilesPart(IPHONE),
  'viewer-desktop': viewerPart(DESKTOP),
  'viewer-phone': viewerPart(IPHONE)
};

Lib.runParts(PARTS, { name: 'SIGNING DOCUMENTS', browser: true });
