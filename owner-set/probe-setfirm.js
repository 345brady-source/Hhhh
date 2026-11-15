#!/usr/bin/env node
/*
 * Proof on a made-up page (scratch, plan 01.3-09): the class page acceptanceOtherParty of class-pages.js (an
 * acceptance block that names another party: marked, nobody's). The sponsor sets its signature and date to the firm
 * in the properties panel, confirms any other mark, and saves. Must save, with the firm's signature required.
 *   NODE_PATH=$(npm root -g) node probe-setfirm.js --root <checkout>
 */
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const ROOT = path.resolve(argv[argv.indexOf('--root') + 1]);
const CK = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks');
const H = require(path.join(CK, 'harness.js'));
const { CLASS_PAGES, CLASS_CSS } = require(path.join(CK, 'class-pages.js'));
const PR = require('../build/proof/proof.js');
const { chromium } = require('playwright');
PR.PORTS.from = 8770; PR.PORTS.to = 8799;
const OUT = path.join(__dirname, 'walk-out', 'probe-setfirm');
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const line = (ok, what, info) => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && info ? ' :: ' + JSON.stringify(info).slice(0, 600) : ''}`); };
(async () => {
  const fx = CLASS_PAGES.acceptanceOtherParty;
  const h = await H.start();
  const made = await H.makePdf(h, CLASS_CSS + (fx.css || ''), fx.html, { paper: fx.paper });
  await h.stop();
  const pdf = path.join(OUT, 'acceptanceOtherParty.pdf');
  fs.writeFileSync(pdf, Buffer.from(made.bytes));
  const srv = await PR.startServers();
  const browser = await chromium.launch();
  try {
    const C = await PR.newContext(browser, srv);
    const S = await PR.openPortal(C, srv, false);
    const off = await PR.prepare(S);
    const up = await PR.uploadDialog(S, off, pdf);
    line(up.opened, 'upload reaches the editor', up.said);
    await S.P.waitForTimeout(500);
    const st = () => S.P.evaluate(() => { const NS = window.CVPortal; const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param); const role = (id) => { const s = env.signers.find((x) => x.id === id); return s.role === 'countersigner' ? 'firm' : s.co ? 'co' : 'investor'; }; return { firm: env.signers.find((s) => s.role === 'countersigner').id, fields: env.fields.map((f) => ({ id: f.id, type: f.type, who: role(f.signerId), other: NS.placement.isOther(f), review: !!f.review || NS.placement.needsReview(f), req: NS.esignKit.isReq(f), firmDoubt: !!(f.placed && f.placed.firmDoubt) || !!f.firmDoubt })) }; });
    let s0 = await st();
    const accept = s0.fields.filter((f) => f.other && f.review && (f.type === 'signature' || f.type === 'date'));
    line(accept.length === 2, 'the acceptance block: a signature and a date, somebody else\'s and marked', s0.fields);
    for (const f of accept) {
      await S.P.locator(`.fe-doc .es-fld[data-fid="${f.id}"]`).first().click();
      await S.P.waitForTimeout(250);
      await S.P.selectOption('#es-fs', s0.firm);
      await S.P.waitForTimeout(250);
    }
    const s1 = await st();
    const sig = s1.fields.find((f) => f.id === accept.find((a) => a.type === 'signature').id);
    line(sig.who === 'firm' && !sig.other && sig.req && !sig.review, 'the signature set to the firm is the firm\'s ordinary signature field: required, unmarked', sig);
    // undo twice (the date, then the signature): the signature is somebody else's and optional again, in one step
    await S.P.click('[data-action="fe-undo"]'); await S.P.waitForTimeout(200);
    await S.P.click('[data-action="fe-undo"]'); await S.P.waitForTimeout(250);
    const sigU = (await st()).fields.find((f) => f.id === sig.id);
    line(sigU.other && !sigU.req && sigU.who !== 'firm', 'one undo puts the signer and the required flag back together', sigU);
    await S.P.click('[data-action="fe-redo"]'); await S.P.waitForTimeout(200);
    await S.P.click('[data-action="fe-redo"]'); await S.P.waitForTimeout(250);
    const sigR = (await st()).fields.find((f) => f.id === sig.id);
    line(sigR.who === 'firm' && sigR.req, 'redo gives it to the firm again, required', sigR);
    // any other mark (the witness line keeps its mark) is confirmed, then save
    for (let i = 0; i < 20; i++) {
      const go = S.P.locator('[data-action="es-flag-go"]').first();
      if (!(await go.count())) break;
      await go.click();
      await S.P.locator('[data-action="es-flag-ok"]').first().click();
      await S.P.waitForTimeout(100);
    }
    await S.P.click('[data-action="es-agreement-save"]');
    const saved = await S.P.waitForFunction((id) => location.hash === '#console-offering-' + id, off.id, { timeout: 8000 }).then(() => true, () => false);
    line(saved, 'the agreement saves', await PR.toasts(S.P));
  } catch (e) {
    line(false, 'the probe ran', String(e && e.stack || e).slice(0, 600));
  } finally {
    await browser.close();
    srv.close();
  }
  console.log(failed ? 'PROBE: FAIL' : 'PROBE: PASS');
  process.exit(failed ? 1 : 0);
})();
