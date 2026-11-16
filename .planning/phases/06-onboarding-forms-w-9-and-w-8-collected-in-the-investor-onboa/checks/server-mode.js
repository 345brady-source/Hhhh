#!/usr/bin/env node
// Server mode for the investor status answers (phase 6, plans 06-06 and 06-07; D-01, C-01, D-30, white label, C-05).
// Real invitations go through the firm's integration server. Each part runs the real server code (server/index.mjs)
// in this process and two separate browser contexts that share nothing except through that server: the sponsor's
// console (one context) sends the invitation with its own form; the investor's device (a second context, empty storage,
// the portal page listing the server as the firm publishes it) opens the ?server= link, answers the status step,
// subscribes and signs; the console imports with its own "Check now" and counts the answers exactly as in local mode.
// Plan 06-22 (research Pattern 6): the investor's signed tax form travels with the completion (parts tax-w9, tax-unsigned).
// Plan 06-23 (research Pitfall 2): after a confirmed send the device keeps no copy of the full taxpayer ID (part tax-wipe);
// an uploaded tax form and the W-8BEN reach the console (parts tax-upload, tax-w8ben).
//   NODE_PATH=$(npm root -g) node server-mode.js [--only b506,regA,full,existing,withdraw,repack,clean,signed,tax-w9,tax-unsigned,tax-wipe,tax-upload,tax-w8ben]
// The last line is "SERVER MODE: PASS (parts run: N)" or "SERVER MODE: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const { isDeepStrictEqual } = require('util');
const L = require('./lib.js');

const SHOTS = path.join(L.OUT, 'server-shots');
// The owner's screenshot set (plan 06-07): what each screenshot of this check shows (server mode: the console and the
// investor's device are separate browsers that share only the integration server).
L.describeShots([
  ['b506-status.png', 'Investor’s own device (server mode), status step, Rule 506(b), answered "not accredited" with a purchaser representative and plan 4975.'],
  ['b506-subscribe.png', 'Investor’s device, subscribe step: it states the account is not an accredited investor.'],
  ['b506-done.png', 'Investor’s device, done screen after the completion went to the integration server.'],
  ['b506-console-offering.png', 'Console after import: "Non-accredited purchasers: 1 of 35", and the Benefit plan investors list naming the investor with the pending subscription (D-08).'],
  ['regA-status.png', 'Investor’s device, Regulation A Tier 2 status step (D-07): "not accredited", the one statement about the 10 percent limit left unticked, no figures asked.'],
  ['regA-subscribe.png', 'Investor’s device, subscribe step: the warning that the investor has not confirmed the limit, which does not block.'],
  ['regA-done.png', 'Investor’s device, done screen (Regulation A).'],
  ['regA-requests.png', 'Console requests page: "Not accredited and has not attested to the Regulation A Tier 2 limit (10 percent of income or net worth)" on the imported request.'],
  ['regA-console-offering.png', 'Console offering page: "1 non-accredited subscriber, 1 not attested to the 10 percent limit" and Dana Whitfield named.'],
  ['full34-status.png', 'Investor’s device with 34 non-accredited purchasers counted when invited: status step answered "not accredited", no warning (they would be the 35th).'],
  ['full34-subscribe.png', 'Investor’s device, subscribe step (34 counted).'],
  ['full34-done.png', 'Investor’s device, done screen (34 counted).'],
  ['full34-console-offering.png', 'Console offering page after import with 34 counted before: "Non-accredited purchasers: 35 of 35", at the limit (the warning badge, not the red one).'],
  ['full34-requests.png', 'Console requests page after a backdated completion: the Submitted and Date columns are the console’s own (today; the offering’s closing date), not 2001 or 1999.'],
  ['full35-status.png', 'Investor’s device with 35 counted when invited: status step answered "not accredited", no warning (owner, plan 06-15); the sponsor’s flag stays.'],
  ['full35-subscribe.png', 'Investor’s device, subscribe step (35 counted).'],
  ['full35-done.png', 'Investor’s device, done screen (35 counted).'],
  ['full35-console-offering.png', 'Console offering page after import: "Non-accredited purchasers: 36 of 35".'],
  ['full35-requests.png', 'Console requests page: "Would be non-accredited purchaser 36 of the 35 allowed under Rule 506(b)" on the new request.'],
  ['existing-status-prefilled.png', 'Investor on file, own device: the status step prefilled from the console (accredited, the ground on file, plan Title I; no control question), before the investor changes the plan to "none".'],
  ['existing-status.png', 'Investor on file: status step after changing the benefit plan answer to "none of these".'],
  ['existing-subscribe.png', 'Investor on file: subscribe step (accredited investor).'],
  ['existing-done.png', 'Investor on file: done screen.'],
  ['existing-console-offering.png', 'Console offering page after import: the Benefit plan investors list, which no longer names the investor (answer now "no").'],
  ['withdraw-status.png', 'Investor on file with a self-certified ground, own device: status step answered "not accredited" (sophistication answers).'],
  ['withdraw-subscribe.png', 'Investor on file: subscribe step stating the account is not an accredited investor.'],
  ['withdraw-done.png', 'Investor on file: done screen after answering "not accredited".'],
  ['withdraw-console-offering.png', 'Console offering page after import: "Non-accredited purchasers: 1 of 35"; the investor record no longer holds the self-certified ground.'],
  ['withdrawB-status.png', 'Investor on file whose ground a third party verified: status step answered "not accredited".'],
  ['withdrawB-subscribe.png', 'Investor on file (verified ground): subscribe step.'],
  ['withdrawB-done.png', 'Investor on file (verified ground): done screen; the verified ground stays on the console record.'],
  ['repack-status.png', 'Investor’s device: status step with the purchaser representative’s acknowledgment attached.'],
  ['repack-subscribe.png', 'Investor’s device: subscribe step (not accredited, representative named).'],
  ['repack-done.png', 'Investor’s device: done screen; the acknowledgment went with the completion.'],
  ['repack-requests.png', 'Console requests page after import: "Purchaser representative: Morgan Ellery" with "Download the written acknowledgment" (returns the same bytes).'],
  ['repbig-status.png', 'Investor’s device: a 25 MB acknowledgment attached (accepted, but it cannot go with the signed agreement).'],
  ['repbig-subscribe.png', 'Investor’s device: subscribe step (25 MB acknowledgment case).'],
  ['repbig-done.png', 'Investor’s device, done screen: "The acknowledgment of your purchaser representative you uploaded could not be sent with your details".'],
  ['repbig-requests.png', 'Console requests page: the representative with the note that the acknowledgment did not fit and to ask the investor for it (no download).'],
  ['tax-w9-status.png', 'Investor’s own device (server mode, plan 06-22): status step before the tax step where the W-9 is signed.'],
  ['tax-w9-subscribe.png', 'Investor’s device: subscribe step after signing the W-9.'],
  ['tax-w9-done.png', 'Investor’s device: done screen; the signed W-9 went with the completion.'],
  ['tax-w9-console.png', 'Console Investors page after import: the investor row reads "W-9 signed <date> · Download"; the Download returns the bytes the device produced.'],
  ['tax-unsigned-status.png', 'Investor’s device (server mode): status step before a W-9 finished without a signature.'],
  ['tax-unsigned-subscribe.png', 'Investor’s device: subscribe step (W-9 not signed).'],
  ['tax-unsigned-done.png', 'Investor’s device: done screen; no tax form was sent.'],
  ['tax-unsigned-console.png', 'Console Investors page after import: the investor row reads "W-9 not signed", no Download.'],
  ['tax-toolarge-status.png', 'Investor’s device: status step before the W-9 is signed (its signed copy is then made 25 MB).'],
  ['tax-toolarge-subscribe.png', 'Investor’s device: subscribe step (signed W-9 too large to send).'],
  ['tax-toolarge-done.png', 'Investor’s device, done screen: "The Form W-9 you signed could not be sent with your details".'],
  ['tax-toolarge-console.png', 'Console Investors page: the investor row reads "W-9 signed, copy not received: ask the investor for it".'],
  ['tax-wipe-status.png', 'Investor’s device (server mode, plan 06-23): status step before the W-9 is built, left by Back, and signed.'],
  ['tax-wipe-subscribe.png', 'Investor’s device: subscribe step after signing the second W-9.'],
  ['tax-wipe-done.png', 'Investor’s device: done screen; after the confirmed send it holds no tax file and no Documents entry for it.'],
  ['tax-wipe-console.png', 'Console Investors page: "W-9 signed <date> · Download"; the Download returns the bytes the device sent before wiping its copy.'],
  ['tax-keep-status.png', 'Investor’s device: status step (the integration server is stopped before the agreement is finished).'],
  ['tax-keep-subscribe.png', 'Investor’s device: subscribe step (server stopped later).'],
  ['tax-keep-failed.png', 'Investor’s device with the integration server stopped: "We could not reach <firm> to send your details, but nothing you entered is lost: check your connection, then try again." with Try again; nothing deleted.'],
  ['tax-keep-done.png', 'Investor’s device: done screen after Try again with the server back; the same signed W-9 was sent.'],
  ['tax-upload-status.png', 'Investor’s device (server mode, plan 06-23): status step for Kittiwake Point Partners LP, invited as a foreign entity.'],
  ['tax-upload-subscribe.png', 'Investor’s device: subscribe step after uploading a W-8IMY, going Back and uploading the corrected one.'],
  ['tax-upload-done.png', 'Investor’s device: done screen; the uploaded W-8IMY went with the completion and left the device.'],
  ['tax-upload-console.png', 'Console Investors page: "W-8IMY uploaded <date> · Download"; the Download returns the bytes the investor chose.'],
  ['tax-upbig-status.png', 'Investor’s device: status step before a W-9 is uploaded (then made 25 MB on the device).'],
  ['tax-upbig-subscribe.png', 'Investor’s device: subscribe step (uploaded W-9 too large to send).'],
  ['tax-upbig-done.png', 'Investor’s device, done screen: "The Form W-9 you uploaded could not be sent with your details".'],
  ['tax-upbig-console.png', 'Console Investors page: "W-9 uploaded, copy not received: ask the investor for it", no Download.'],
  ['tax-w8ben-status.png', 'Investor’s device (server mode): status step for a foreign individual living in Germany.'],
  ['tax-w8ben-subscribe.png', 'Investor’s device: subscribe step after signing the W-8BEN.'],
  ['tax-w8ben-done.png', 'Investor’s device: done screen; the signed W-8BEN went with the completion.'],
  ['tax-w8ben-console.png', 'Console Investors page: "W-8BEN signed <date>, valid until Dec 31, 2029 · Download".'],
  ['clean-status.png', 'Investor’s device with 35 other non-accredited purchasers on the console: status step answered "not accredited", no warning and nothing about the others.']
]);
fs.mkdirSync(SHOTS, { recursive: true });
const INV = { first: 'Dana', last: 'Whitfield', name: 'Dana Whitfield', email: 'dana.whitfield@example.com' };

/** The text of the console panel with the given title on the page now on screen ('' when there is none). */
const panelText = (page, title) =>
  page.evaluate((t) => {
    const s = Array.from(document.querySelectorAll('.cs-panel')).find((x) => ((x.querySelector('.cs-panel-head h2') || {}).textContent || '') === t);
    return s ? s.innerText : '';
  }, title);

/** The text of the requests table row for one request id ('' when not shown). */
const requestRow = (page, id) =>
  page.evaluate((rid) => {
    const b = document.querySelector(`[data-action=req-approve][data-id="${CSS.escape(rid)}"], [data-action=req-decline][data-id="${CSS.escape(rid)}"]`);
    const tr = b && b.closest('tr');
    return tr ? tr.innerText : '';
  }, id);

/** The console's subscription request of one investor in one offering, with its qual. */
const consoleRequest = (page, investorId, offeringId) =>
  page.evaluate(({ investorId, offeringId }) => {
    const ws = window.CVPortal.state.ws;
    const r = (ws.requests || []).filter((x) => x.type === 'subscription' && x.investorId === investorId && x.offeringId === offeringId).pop();
    return r ? { id: r.id, status: r.status, cents: r.cents, qual: r.qual === undefined ? '(none)' : r.qual } : null;
  }, { investorId, offeringId });

/**
 * n investors on file who are not accredited, each with a pending subscription to the offering (NS.ops.submitSubscription)
 * and the answers a 506(b) investor gives (qual.accredited false), in the console. The same seeding as status-flow.js.
 */
const seedNonAccredited = (page, offeringId, n, prefix) =>
  page.evaluate(
    ({ offeringId, n, prefix }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === offeringId);
      const tpl = ws.investors[0];
      for (let k = 0; k < n; k++) {
        const i = JSON.parse(JSON.stringify(tpl));
        i.id = `${prefix}-inv-${k + 1}`;
        i.title = i.contact = `Seeded Purchaser ${prefix.toUpperCase()}${k + 1}`;
        i.email = `${prefix}${k + 1}@example.com`;
        i.positions = [];
        if (i.onboarding) i.onboarding = Object.assign({}, i.onboarding, { flow: undefined });
        ws.investors.push(i);
        const r = NS.ops.submitSubscription(ws, i, o, { cents: 5000000, signature: i.contact });
        r.id = `${prefix}-req-${k + 1}`;
        r.qual = { regime: '506b', at: new Date().toISOString(), accredited: false, basis: '', sophistication: { knowledge: 'alone', rep: null } };
      }
      NS.app.save(true);
      return NS.eligibility.nonAccredited(ws, o).count;
    },
    { offeringId, n, prefix }
  );

/** The investor status warning C-01 an earlier version showed when the offering may be full (removed by the owner, plan 06-15). */
const FULL_WARN = /may already have as many investors who are not accredited as it is able to accept/;
const warnText = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.ivf-form .wire-warn')).map((x) => x.innerText).join('\n'));

/* ---------- The signed tax form in server mode (plan 06-22) ---------- */

/** Adopt a signature on the tax step's embedded W-9 (consent first when it is asked): the investor signs it. */
async function signTax(pg) {
  if (await pg.locator('#es-consent-box').count()) {
    await pg.check('#es-consent-box');
    await pg.click('[data-action="es-consent"]');
    await pg.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 30000 });
  }
  const fid = await pg.evaluate(() => {
    const ws = window.CVPortal.state.ws;
    const fl = ws.investors[0].onboarding.flow || {};
    const env = (ws.envelopes || []).find((e) => e.id === fl.taxEnvelopeId);
    const f = env && env.fields.find((x) => x.type === 'signature');
    return f ? f.id : '';
  });
  if (!fid) throw new Error('the tax form on the device has no signature field');
  await pg.locator(`.es-doc-sign [data-fid="${fid}"]`).scrollIntoViewIfNeeded();
  await pg.click(`.es-doc-sign [data-fid="${fid}"]`);
  await pg.waitForTimeout(200);
  if (await pg.evaluate(() => document.getElementById('dlg').open)) {
    await pg.click('[data-action="es-adopt"]');
    await pg.waitForFunction(() => !document.getElementById('dlg').open);
  }
}

/**
 * What the investor's device holds for its tax form once the step is behind it (read on the next screen, before anything is
 * sent): the record's taxCert and taxForm, the envelope it names, and the SHA-256 and size of the signed copy it stored.
 */
const deviceTax = (page) =>
  page.evaluate(async () => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const i = ws.investors[0];
    const tc = i.taxCert || null;
    const env = tc && tc.envelopeId ? (ws.envelopes || []).find((e) => e.id === tc.envelopeId) : null;
    let sha = '';
    let size = 0;
    const b = env && env.signedDocId ? await NS.ops.files.get(env.signedDocId) : null;
    if (b) {
      size = b.size;
      const d = new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()));
      sha = Array.from(d, (x) => x.toString(16).padStart(2, '0')).join('');
    }
    return { taxForm: i.taxForm || '', taxCert: tc ? JSON.parse(JSON.stringify(tc)) : null, env: env ? { id: env.id, kind: env.kind, status: env.status, signedDocId: env.signedDocId || '', signers: env.signers.map((s) => ({ role: s.role, investorId: s.investorId || '' })) } : null, sha, size };
  });

/** The console's tax line for one investor on the Investors page, and the bytes its Download returns (null when none). */
async function consoleTaxRow(page, email, shot) {
  await L.consoleRoute(page, 'console-investors', '.cs-tbl');
  const row = page.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: email }).first();
  const text = (await row.innerText().catch(() => '')).replace(/\s+/g, ' ');
  await row.scrollIntoViewIfNeeded().catch(() => {});
  // the import's messages fade first, so the owner's screenshot shows the row they would cover
  if (shot) await page.waitForTimeout(4500);
  if (shot) await page.screenshot({ path: path.join(SHOTS, shot), fullPage: true });
  const downloads = await row.locator('[data-action="kyc-iv-file"]').count();
  let bytes = null;
  let name = '';
  let error = downloads ? '' : 'no Download in the row';
  if (downloads)
    try {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), row.locator('[data-action="kyc-iv-file"]').first().click()]);
      bytes = fs.readFileSync(await dl.path());
      name = dl.suggestedFilename();
    } catch (e) {
      error = String(e.message || e).slice(0, 200);
    }
  return { text, bytes, name, error, downloads };
}
const sha256 = (b) => require('crypto').createHash('sha256').update(b).digest('hex');

/* ---------- The device keeps no full taxpayer ID after a confirmed send (plan 06-23, research Pitfall 2) ---------- */

/** The taxpayer ID the tax-wipe walk types at Investor information (no other answer of the walk contains it). */
const WIPE_SSN = '468023917';
/** The number in every way it can be written, and every piece of it longer than its last four digits (as forms-flow tin). */
const WIPE_SSN_RE = ['468[-\\s.]?02[-\\s.]?3917', '468[-\\s.]?02', '02[-\\s.]?3917', '8023917', '680239'];

/**
 * What the investor's device holds that could carry the full taxpayer ID: every id in its file store (the portal's own
 * IndexedDB store), its tax envelopes and their file ids, its Documents entries for them, the uploaded file the record
 * names, the SHA-256 of one file (sha: its id), and which ways of writing the number appear anywhere in the workspace JSON,
 * local storage or session storage.
 */
const deviceStore = (page, sha) =>
  page.evaluate(
    async ({ pats, sha }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const i = ws.investors[0] || {};
      const keys = await new Promise((res) => {
        const r = indexedDB.open('cvp-documents', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('files');
        r.onerror = () => res(null);
        r.onsuccess = () => {
          const q = r.result.transaction('files', 'readonly').objectStore('files').getAllKeys();
          q.onsuccess = () => res(q.result.map(String));
          q.onerror = () => res(null);
        };
      });
      const envs = (ws.envelopes || []).filter((e) => e.kind === 'tax').map((e) => ({ id: e.id, status: e.status, docId: e.docId || '', workDocId: e.workDocId || '', signedDocId: e.signedDocId || '' }));
      const taxDocs = (ws.docs || []).filter((d) => d.cat === 'Tax' || envs.some((e) => e.id === d.envelopeId)).map((d) => d.id);
      const tc = i.taxCert || null;
      let digest = '';
      const b = sha ? await NS.ops.files.get(sha) : null;
      if (b) digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer())), (x) => x.toString(16).padStart(2, '0')).join('');
      const ls = Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`).join('\n');
      const ss = Object.keys(sessionStorage).map((k) => `${k}=${sessionStorage.getItem(k)}`).join('\n');
      const all = `${JSON.stringify(ws)}\n${ls}\n${ss}`;
      return { keys, envs, taxDocs, upload: tc && tc.fileId ? tc.fileId : '', sha: digest, hits: pats.filter((p) => new RegExp(p).test(all)) };
    },
    { pats: WIPE_SSN_RE, sha: sha || '' }
  );
/** The file-store ids that belong to a tax envelope seen on the device (by its id) or to a tax upload (tax-...). */
const taxKeys = (keys, envIds) => (keys || []).filter((k) => /^tax-/.test(k) || envIds.some((id) => k.indexOf(id) === 0));
/** Stop the integration server in place (its store stays), and start it again on the same address. */
async function stopServer(srv) {
  srv.server.closeAllConnections();
  await new Promise((r) => srv.server.close(r));
}
async function startServer(srv) {
  const port = Number(new URL(srv.base).port);
  await new Promise((r, j) => {
    srv.server.once('error', j);
    srv.server.listen(port, '127.0.0.1', r);
  });
}

/* ---------- Uploaded tax forms and the W-8BEN in server mode (plan 06-23) ---------- */

/** A one-page PDF carrying one line of text (a form completed outside the portal). */
async function samplePdf(line) {
  const PL = require(path.join(L.VENDOR, 'pdflib/package/dist/pdf-lib.min.js'));
  const doc = await PL.PDFDocument.create();
  const pg = doc.addPage([612, 792]);
  pg.drawText(line, { x: 72, y: 700, size: 14, font: await doc.embedFont(PL.StandardFonts.Helvetica) });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
/** On the tax step's answers view: "Upload it instead", the form picked (form: null keeps the one chosen to start), the file, Continue. */
async function uploadTaxForm(p, form, file) {
  await p.waitForSelector('[data-action="ivf-taxupload"]', { timeout: 30000 });
  await p.click('[data-action="ivf-taxupload"]');
  await p.waitForSelector('#ob-taxUpFile', { timeout: 20000 });
  if (form) await p.check(`input[name="ob-taxUpForm"][value="${form}"]`);
  await p.setInputFiles('#ob-taxUpFile', file);
  await p.waitForTimeout(400);
  const hint = await p.locator('#hint-taxUpFile').innerText().catch(() => '');
  await L.submit(p);
  await p.waitForFunction(() => {
    const h = document.querySelector('.ivf-form h1');
    return h && h.innerText !== 'Tax certification';
  }, null, { timeout: 30000 });
  await p.waitForTimeout(200);
  return hint;
}
/** The device's tax record and the SHA-256 of the upload it names. */
const deviceUpload = (page) =>
  page.evaluate(async () => {
    const NS = window.CVPortal;
    const i = NS.state.ws.investors[0];
    const tc = i.taxCert || null;
    const b = tc && tc.fileId ? await NS.ops.files.get(tc.fileId) : null;
    const sha = b ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer())), (x) => x.toString(16).padStart(2, '0')).join('') : '';
    return { id: i.id, taxForm: i.taxForm || '', taxCert: tc ? JSON.parse(JSON.stringify(tc)) : null, sha, size: b ? b.size : 0 };
  });
/** The console's record of the investor: taxForm, taxCert, and the SHA-256 of the file stored under id (when given). */
const consoleRecord = (page, iid, id) =>
  page.evaluate(
    async ({ iid, id }) => {
      const NS = window.CVPortal;
      const i = NS.state.ws.investors.find((x) => x.id === iid) || {};
      const b = id ? await NS.ops.files.get(id) : null;
      const sha = b ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer())), (x) => x.toString(16).padStart(2, '0')).join('') : '';
      return { taxForm: i.taxForm || '', taxCert: i.taxCert ? JSON.parse(JSON.stringify(i.taxCert)) : null, sha, onFile: NS.inviteFlow.taxOnFile(i) };
    },
    { iid, id: id || '' }
  );

/**
 * One server-mode case end to end. o: { tag, exemption, invite (extra form fields), answers (lib walk answers),
 * onStatus(page, R), onSubscribe(page, R), beforeImport(srv, inv, sub); plan 06-22: taxSign(page), onAnyStep(hd, page, R);
 * plan 06-23: onFilledAny(hd, page, R), taxStep(page, R), finish(page, out) }. Returns everything the part asserts on; the
 * caller closes ctx.close().
 */
async function serverFlow(S, check, o) {
  const srv = await L.serverPortal(S);
  const out = { srv, R: {} };
  const closers = [];
  out.close = async () => {
    for (const c of closers.reverse()) await c().catch(() => {});
    await srv.close();
  };
  try {
    // The sponsor's console: its own context, the sample portal with the agreement, the exemption, the server set up.
    const A = await L.open(S, { allow: [srv.base], init: srv.init, context: { acceptDownloads: true } });
    closers.push(() => A.context.close());
    out.A = A;
    const cp = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    out.off = off;
    if (o.exemption !== 'Rule 506(b)') {
      await L.consoleRoute(cp, 'console-offering-' + off.offeringId);
      await cp.selectOption('#of-structure-exemption', o.exemption);
      await cp.waitForTimeout(300);
    }
    out.exemption = await cp.evaluate((id) => (window.CVPortal.state.ws.offerings.find((x) => x.id === id).structure || {}).exemption, off.offeringId);
    if (o.beforeInvite) await o.beforeInvite(cp, off, out);
    // The investor invited: Dana Whitfield (new), or the one beforeInvite picked (out.who: an investor on file).
    const who = out.who || INV;
    out.serverOn = await srv.configure(cp);
    const inv = await L.inviteFromConsole(cp, Object.assign({ first: who.first, last: who.last, email: who.email, offeringId: off.offeringId }, o.invite || {}));
    out.inv = inv;
    check('the console sends the invitation to the integration server with its own form (the server holds it)', out.serverOn === true && /^ivt_/.test(inv.serverId) && inv.token === '' && inv.link.indexOf(`server=${encodeURIComponent(srv.base)}`) > 0 && inv.link.indexOf(S.base) === 0, inv);
    const held = (await srv.rows()).find((x) => x.id === inv.serverId);
    check(`the server holds the invitation for the ${o.exemption} offering`, !!held && held.offeringId === off.offeringId && held.investorId === inv.investorId, held);

    // The investor's device: a second context with nothing in its storage, the portal page as the firm publishes it.
    const B = await L.open(S, { allow: [srv.base], init: srv.init });
    closers.push(() => B.context.close());
    out.B = B;
    const ip = B.page;
    // The snapshot exactly as the investor's page receives it from the server (GET /v1/invite), read in this context.
    out.snaps = [];
    ip.on('response', async (res) => {
      if (res.request().method() !== 'GET' || !/\/v1\/invite$/.test(res.url().replace(/[?#].*$/, ''))) return;
      try {
        out.snaps.push(await res.json());
      } catch (e) {
        out.snaps.push({ unreadable: String(e) });
      }
    });
    await ip.goto(inv.link);
    // Workspace keys in this browser's storage (the edition's prefix, then ws:<id>).
    out.storageBefore = await ip.evaluate(() => Object.keys(localStorage).filter((k) => /ws:/.test(k)));
    const answers = Object.assign({}, o.answers, o.taxSign ? { taxSign: o.taxSign } : {}, o.taxStep ? { taxStep: () => o.taxStep(ip, out.R) } : {}, {
      name: who.name,
      onStep: async (hd) => {
        if (hd === 'Investor status' && o.onStatusStep) await o.onStatusStep(ip, out.R);
        if (o.onAnyStep) await o.onAnyStep(hd, ip, out.R);
      },
      onFilled: async (hd) => {
        if (o.onFilledAny) await o.onFilledAny(hd, ip, out.R);
        if (hd === 'Investor status') {
          if (o.onStatus) await o.onStatus(ip, out.R);
          out.R.status = await L.screenText(ip);
          await ip.screenshot({ path: path.join(SHOTS, `${o.tag}-status.png`), fullPage: true });
        }
        if (hd === 'Subscription') {
          if (o.onSubscribe) await o.onSubscribe(ip, out.R);
          out.R.sub = await L.screenText(ip);
          await ip.screenshot({ path: path.join(SHOTS, `${o.tag}-subscribe.png`), fullPage: true });
        }
      }
    });
    const w = await L.walk(ip, answers);
    out.walk = w;
    check('the investor’s device runs on the server’s snapshot (state.remote) and reaches the agreement with no field error', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    // D-09 (plan 06-16): the investor type the sponsor chose travels in the snapshot and the device's record keeps it (the
    // console form's default, U.S. individual, for a new investor; an investor on file from before has none).
    const snapInv = (out.snaps.find((x) => x && x.investor) || {}).investor || {};
    const deviceType = await ip.evaluate(() => ((window.CVPortal.state.ws || {}).investors || []).map((x) => x.taxType || ''));
    const wantType = out.who ? undefined : (o.invite && o.invite.type) || 'us-individual';
    check('D-09: the snapshot carries the investor type the sponsor chose, and the investor’s device keeps it', snapInv.taxType === wantType && deviceType[0] === (wantType || ''), { snapshot: snapInv.taxType, device: deviceType });
    out.remote = await ip.evaluate(() => !!(window.CVPortal.state.remote && window.CVPortal.state.remote.server && !window.CVPortal.state.remote.refused));
    // The answers as the device holds them on its request, before it sends anything.
    out.deviceQual = await ip.evaluate(() => {
      const r = ((window.CVPortal.state.ws || {}).requests || []).filter((x) => x.type === 'subscription').pop();
      return r ? JSON.parse(JSON.stringify(r.qual === undefined ? '(none)' : r.qual)) : '(no request)';
    });
    // o.finish(page, out): the agreement finished another way (plan 06-23: the server stopped first, then Try again)
    out.done = o.finish ? await o.finish(ip, out) : await L.finishAgreement(ip);
    await ip.screenshot({ path: path.join(SHOTS, `${o.tag}-done.png`), fullPage: true });
    out.row = await srv.waitCompleted(inv.serverId);
    out.storageAfter = await ip.evaluate(() => Object.keys(localStorage).filter((k) => /ws:/.test(k)));
    // What the server holds for the console, read as the console reads it, before the console imports (and deletes) it.
    out.stored = await srv.submission(inv.serverId);
    if (o.beforeImport) {
      // A tampering check changes the stored submission: the device-to-server leg is compared with the copy from before.
      out.storedBefore = out.stored && out.stored.request ? JSON.parse(JSON.stringify(out.stored.request.qual)) : null;
      out.tampered = true;
      out.stored = await o.beforeImport(srv, inv, out.stored);
    }

    // The console imports with its own button, then reads its own copy.
    await L.importFromConsole(cp, inv.id);
    out.req = await consoleRequest(cp, inv.investorId, off.offeringId);
    out.afterImport = (await srv.rows()).find((x) => x.id === inv.serverId);
    return out;
  } catch (e) {
    await out.close();
    throw e;
  }
}

/** Checks every server-mode part makes on transport, isolation and the import. */
function commonChecks(check, F) {
  check('the investor’s page loaded the invitation from the server (state.remote, trusted from CVPortalConfig)', F.remote === true, F.remote);
  check('the two contexts share nothing: the investor’s device never holds the firm’s workspace, only its own copy of the invitation', !F.storageBefore.some((k) => /ws:kestrel-bay$/.test(k)) && !F.storageAfter.some((k) => /ws:kestrel-bay$/.test(k)) && F.storageAfter.length === 1 && /ws:invite-/.test(F.storageAfter[0]), { before: F.storageBefore, after: F.storageAfter });
  check('the investor’s device called the integration server (load, progress, complete) and nothing else outside', F.B.net.allowed.some((x) => /^GET .*\/v1\/invite$/.test(x)) && F.B.net.allowed.some((x) => /^PUT .*\/v1\/invite\/progress$/.test(x)) && F.B.net.allowed.some((x) => /^POST .*\/v1\/invite\/complete$/.test(x)) && F.B.net.external.length === 0, { allowed: F.B.net.allowed.slice(0, 40), external: F.B.net.external });
  check('the console called the integration server (send, list, submission, delete) and nothing else outside', F.A.net.allowed.some((x) => /^POST .*\/v1\/invitations$/.test(x)) && F.A.net.allowed.some((x) => /^GET .*\/submission$/.test(x)) && F.A.net.allowed.some((x) => /^DELETE .*\/submission$/.test(x)) && F.A.net.external.length === 0, { allowed: F.A.net.allowed, external: F.A.net.external });
  const sq = F.stored && F.stored.request ? F.stored.request.qual : undefined;
  check('the server stored the request with the status answers on it (request.qual)', !!sq && typeof sq === 'object' && /^\d{4}-\d{2}-\d{2}T/.test(sq.at || ''), F.stored && F.stored.request);
  check('the console imported the request, pending, for the invited investor and offering', !!F.req && F.req.status === 'pending' && F.stored && F.req.id === F.stored.request.id, F.req);
  check('the server stored exactly the qual the investor’s device put on its request', isDeepStrictEqual(F.deviceQual, F.tampered ? F.storedBefore : sq), { device: F.deviceQual, server: F.tampered ? F.storedBefore : sq });
  check('the imported request’s qual deep-equals the one the server stored', !!F.req && isDeepStrictEqual(F.req.qual, sq), { console: F.req && F.req.qual, server: sq });
  check('the console deleted its copy on the server after importing (nothing left to import)', !!F.afterImport && F.afterImport.hasSubmission === false, F.afterImport);
  check('no script error in the console', F.A.errors.length === 0, F.A.errors);
  check('no script error on the investor’s device', F.B.errors.length === 0, F.B.errors);
}

/**
 * C-01 in server mode, one boundary: n non-accredited purchasers counted in the console before the invitation is sent.
 * Returns the flow with R.warnBefore (warning count before the investor answers), R.warn (warning text after answering no).
 */
function fullFlow(S, check, n, tag, extra) {
  const answers = { acc: 'no', exp: 'Eight years of private real estate commitments', edu: 'Physician', rep: 'no', amount: 60000 };
  return serverFlow(S, check, Object.assign({
    tag,
    exemption: 'Rule 506(b)',
    answers,
    beforeInvite: async (cp, off, out) => {
      out.counted = await seedNonAccredited(cp, off.offeringId, n, tag);
    },
    onStatusStep: async (p, R) => {
      R.warnBefore = await p.locator('.ivf-form .wire-warn').count();
    },
    onStatus: async (p, R) => {
      R.warn = await warnText(p);
    }
  }, extra || {}));
}

const parts = {
  /**
   * C-01 in server mode (plan 06-07, changed by plan 06-15): the owner removed the investor-side "506(b) may be full" warning,
   * so the snapshot carries no offering.nonAccreditedFull and the investor sees no warning at 34 or 35 counted. The sponsor's
   * count and flag stay: with 35 counted the investor (the 36th) completes and the console flags the request 36 of 35.
   */
  async full({ check, S }) {
    // 34 counted: the boundary below the limit. Before the console imports, the stored request's dates are altered (a device
    // that backdates its subscription): the console sets the submitted day and the closing date itself.
    const F34 = await fullFlow(S, check, 34, 'full34', {
      beforeImport: async (srv, inv) => {
        srv.alter(inv.serverId, (s) => {
          s.request.submitted = '2001-01-02';
          s.request.dealing = '1999-12-31';
        });
        return srv.submission(inv.serverId);
      }
    });
    try {
      check('34 non-accredited purchasers counted in the console before the invitation', F34.counted === 34, F34.counted);
      // The requests page's Date column is the subscription's closing date (closed-end offering) or effective date (open-ended),
      // not the day the request was made (that is the Submitted column). Both are the console's own, never the device's.
      const dates = await F34.A.page.evaluate(({ rid, oid, iid }) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const r = ws.requests.find((x) => x.id === rid) || {};
        const o = ws.offerings.find((x) => x.id === oid) || {};
        const it = ws.invitations.find((x) => x.id === iid) || {};
        return { submitted: r.submitted, dealing: r.dealing, closeDate: o.closeDate, open: NS.ops.isOpen(o), want: NS.ops.isOpen(o) ? NS.ops.subscriptionDate(NS.dates.today()) : o.closeDate, today: NS.dates.today(), sentDay: String(it.sentAt || '').slice(0, 10) };
      }, { rid: F34.req && F34.req.id, oid: F34.off.offeringId, iid: F34.inv.id });
      check('the stored request was backdated before import (submitted 2001-01-02, dealing 1999-12-31)', !!F34.stored && F34.stored.request && F34.stored.request.submitted === '2001-01-02' && F34.stored.request.dealing === '1999-12-31', F34.stored && F34.stored.request && { submitted: F34.stored.request.submitted, dealing: F34.stored.request.dealing });
      check('the console sets the request’s own dates: submitted is today (not before the invitation), the Date column’s date is the offering’s closing or effective date', dates.submitted === dates.today && dates.submitted >= dates.sentDay && dates.dealing === dates.want, dates);
      await L.consoleRoute(F34.A.page, 'console-requests', '[data-action=req-tab][data-t=all]');
      await F34.A.page.click('[data-action=req-tab][data-t=all]');
      await F34.A.page.waitForTimeout(300);
      const row34 = F34.req ? await requestRow(F34.A.page, F34.req.id) : '';
      await F34.A.page.screenshot({ path: path.join(SHOTS, 'full34-requests.png'), fullPage: true });
      check('the request row shows no backdated date (2001 or 1999)', !!row34 && !/\b(2001|1999)\b/.test(row34), row34);
      const sn = F34.snaps[0] || {};
      // Owner (plan 06-15): the snapshot no longer carries the "may be full" boolean.
      check('with 34 counted the snapshot the investor’s page receives carries no offering.nonAccreditedFull', F34.snaps.length >= 1 && !!sn.offering && !('nonAccreditedFull' in sn.offering), sn.offering && Object.keys(sn.offering));
      check('with 34 counted the investor answering "not accredited" sees no warning (before or after answering)', F34.R.warnBefore === 0 && !FULL_WARN.test(F34.R.warn || '') && !FULL_WARN.test(F34.R.status || ''), { before: F34.R.warnBefore, warn: F34.R.warn });
      commonChecks(check, F34);
      await L.consoleRoute(F34.A.page, 'console-offering-' + F34.off.offeringId);
      const el34 = await panelText(F34.A.page, 'Investor eligibility');
      await F34.A.page.screenshot({ path: path.join(SHOTS, 'full34-console-offering.png'), fullPage: true });
      check('the console counts the imported request: "Non-accredited purchasers: 35 of 35", at the limit', /Non-accredited purchasers: 35 of 35/.test(el34) && /At the limit/.test(el34), el34);
    } finally {
      await F34.close();
    }
    // 35 counted: the invited investor would be the 36th.
    const F = await fullFlow(S, check, 35, 'full35');
    try {
      check('35 non-accredited purchasers counted in the console before the invitation', F.counted === 35, F.counted);
      const sn = F.snaps[0] || {};
      check('with 35 counted the snapshot the investor’s page receives carries no offering.nonAccreditedFull', F.snaps.length >= 1 && !!sn.offering && !('nonAccreditedFull' in sn.offering), sn.offering && Object.keys(sn.offering));
      check('the investor’s server-mode workspace holds no such flag on its offering', (await F.B.page.evaluate(() => 'nonAccreditedFull' in window.CVPortal.state.ws.offerings[0])) === false);
      check('no warning before or after the investor answers "not accredited" (owner, plan 06-15)', F.R.warnBefore === 0 && !FULL_WARN.test(F.R.warn || '') && !FULL_WARN.test(F.R.status || ''), { before: F.R.warnBefore, warn: F.R.warn });
      check('the screen names no other investor (T-06-04)', !/Seeded Purchaser/.test(F.R.status || ''), (F.R.status || '').slice(0, 800));
      check('the investor completes the subscription and the agreement', F.walk.reached && F.walk.errors.length === 0 && /\S/.test(F.done || ''), { seen: F.walk.seen, errors: F.walk.errors });
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      check('qual: regime 506b, accredited false', q.regime === '506b' && q.accredited === false, q);
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const el = await panelText(cp, 'Investor eligibility');
      await cp.screenshot({ path: path.join(SHOTS, 'full35-console-offering.png'), fullPage: true });
      check('the console counts the imported request: "Non-accredited purchasers: 36 of 35"', /Non-accredited purchasers: 36 of 35/.test(el), el);
      await L.consoleRoute(cp, 'console-requests', '[data-action=req-tab][data-t=all]');
      await cp.click('[data-action=req-tab][data-t=all]');
      await cp.waitForTimeout(300);
      const row = F.req ? await requestRow(cp, F.req.id) : '';
      await cp.screenshot({ path: path.join(SHOTS, 'full35-requests.png'), fullPage: true });
      check('the request row carries "Would be non-accredited purchaser 36 of the 35 allowed under Rule 506(b)"', /Would be non-accredited purchaser 36 of the 35 allowed under Rule 506\(b\)/.test(row), row);
      const lk = L.leakCheck([F.R.status, el, row].join('\n'));
      check('white label: the status screen and the console pages pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * D-01, C-01 in server mode: a non-accredited 506(b) investor answering Rule 506(b)(2)(ii)'s question (with a purchaser
   * representative, D-08 (2)) and plan '4975' completes on their own device; the console imports and shows 1 of 35 with 1
   * pending, and the benefit plan list names the investor with the pending subscription (D-08 (1), plan 06-15).
   */
  async b506({ check, S }) {
    const answers = { acc: 'no', exp: 'Twelve years of private real estate and venture fund commitments', edu: 'Civil engineer, MBA', rep: 'yes', soph: 'rep', repName: 'Morgan Ellery', amount: 60000 };
    const F = await serverFlow(S, check, {
      tag: 'b506',
      exemption: 'Rule 506(b)',
      answers,
      onStatusStep: async (p, R) => {
        await p.check('input[name="ob-stPlan"][value="4975"]');
        await p.waitForTimeout(200);
      },
      onStatus: async (p, R) => {
        R.plan = await p.evaluate(() => (document.querySelector('input[name="ob-stPlan"]:checked') || {}).value || '');
      }
    });
    try {
      check('the offering is Rule 506(b) with its agreement ready', F.off.ready && F.exemption === 'Rule 506(b)', { off: F.off, exemption: F.exemption });
      const st = F.R.status || '';
      check('the status step on the investor’s device asks the accredited question, Rule 506(b)(2)(ii)’s question and the benefit plan question (D-08)', /Is Dana Whitfield an accredited investor\?/.test(st) && /alone or with a purchaser representative, have enough knowledge and experience/.test(st) && !/investment experience/i.test(st) && /a benefit plan investor\?/.test(st) && F.R.plan === '4975', { plan: F.R.plan, st: st.slice(0, 1500) });
      check('the subscribe step states the account is not accredited', /is not an accredited investor/.test(F.R.sub || ''), (F.R.sub || '').slice(0, 1200));
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      const so = q.sophistication || {};
      check('qual: regime 506b, accredited false', q.regime === '506b' && q.accredited === false, q);
      check('qual: the sophistication answer and the purchaser representative arrive as given, nothing else (D-08 (2))', so.knowledge === 'rep' && !!so.rep && so.rep.name === answers.repName && so.experience === undefined && so.rep.firm === undefined, so);
      check('qual.erisa arrives intact: exactly { plan: 4975, planPct: null }', JSON.stringify(q.erisa) === '{"plan":"4975","planPct":null}', q.erisa);
      check('the investor’s change-log entry for the answer reached the console', await F.A.page.evaluate((id) => (window.CVPortal.state.ws.audit || []).some((e) => e.record === id && e.action === 'Investor status answered' && /not an accredited investor/.test(e.detail) && /from the investor.s device/.test(e.detail)), F.inv.investorId));
      // The console's offering page counts the imported answers exactly as in local mode.
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const ct = await L.screenText(cp);
      await cp.screenshot({ path: path.join(SHOTS, 'b506-console-offering.png'), fullPage: true });
      check('the console offering page shows "Non-accredited purchasers: 1 of 35"', /Non-accredited purchasers: 1 of 35/.test(ct), ct.slice(0, 2500));
      check('the console offering page shows "0 accepted and 1 more pending"', /\b0 accepted and 1 more pending\b/.test(ct), ct.slice(0, 2500));
      // D-08 (1) (plan 06-15): the plain list of who answered yes, with the pending subscription; no figure worked out.
      const bp = await panelText(cp, 'Benefit plan investors');
      const rowB = await cp.evaluate((iid) => (document.querySelector(`.cs-bpi-row[data-investor="${CSS.escape(iid)}"]`) || {}).innerText || '', F.inv.investorId);
      check('the benefit plan list names the investor, the section 4975 answer and the $60,000 pending; no percentage', /Code section 4975/.test(rowB) && /\$60,000 pending/.test(rowB) && !/%/.test(bp), { rowB, bp: bp.slice(0, 1200) });
      const leakSt = L.leakCheck(st);
      const leakC = L.leakCheck(ct);
      check('white label: the investor’s status screen passes the leak check', leakSt.ok, leakSt.hits);
      check('white label: the console offering page passes the leak check', leakC.ok, leakC.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * C-01 / D-07 / T-06-13 in server mode: a Regulation A Tier 2 person who is not accredited leaves the attestation to the
   * 10 percent limit unticked, commits $60,000, sees the warning and completes on their own device. The attestation
   * (attested false) travels to the server and the console unchanged; the console flags the request and names the investor.
   */
  async regA({ check, S }) {
    const F = await serverFlow(S, check, {
      tag: 'regA',
      exemption: 'Regulation A Tier 2',
      answers: { acc: 'no', amount: 60000 },
      onStatus: async (p, R) => {
        R.attestQ = await p.locator('#ob-stRaAttest').count();
        R.attestText = R.attestQ ? await p.locator('label[for="ob-stRaAttest"]').innerText() : '';
        R.figFields = await p.locator('#ob-stIncome, #ob-stWorth, #ob-stRevenue, #ob-stAssets, input[name="ob-stRaKind"], #ra-limit').count();
      },
      onSubscribe: async (p, R) => {
        R.raSub = await p.locator('#ra-sub').innerText().catch(() => '');
        R.warn = await p.locator('#ra-sub .wire-warn').innerText().catch(() => '');
      }
    });
    try {
      check('the offering is "Regulation A Tier 2", chosen with the console’s select', F.exemption === 'Regulation A Tier 2', F.exemption);
      check('the investor’s device shows the one statement about the 10 percent limit and no figure fields or limit line', F.R.attestQ === 1 && /is not more than 10 percent of my annual income or my net worth/.test(F.R.attestText || '') && F.R.figFields === 0, F.R);
      check('left unticked, the subscribe step warns without blocking', /You have not confirmed that your total investment in this offering is within your limit under Regulation A/.test(F.R.warn || '') && F.walk.errors.length === 0, { raSub: F.R.raSub, warn: F.R.warn });
      check('the device’s own qual carries regA exactly { attested: false }', !!F.deviceQual && JSON.stringify(F.deviceQual.regA) === '{"attested":false}', F.deviceQual);
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      check('the console’s imported request: regA2, not accredited, attested false', q.regime === 'regA2' && q.accredited === false && JSON.stringify(q.regA) === '{"attested":false}', q);
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-requests', '[data-action=req-tab][data-t=all]');
      await cp.click('[data-action=req-tab][data-t=all]');
      await cp.waitForTimeout(300);
      const row = F.req ? await requestRow(cp, F.req.id) : '';
      await cp.screenshot({ path: path.join(SHOTS, 'regA-requests.png'), fullPage: true });
      check('the request row reads "Not accredited and has not attested to the Regulation A Tier 2 limit (10 percent of income or net worth)"', /Not accredited and has not attested to the Regulation A Tier 2 limit \(10 percent of income or net worth\)/.test(row), row);
      check('the flagged request keeps Approve and Decline (nothing blocked)', F.req && (await cp.locator(`[data-action=req-approve][data-id="${F.req.id}"]`).count()) === 1 && (await cp.locator(`[data-action=req-decline][data-id="${F.req.id}"]`).count()) === 1);
      const rowText = await L.screenText(cp);
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const el = await panelText(cp, 'Investor eligibility');
      const ct = await L.screenText(cp);
      await cp.screenshot({ path: path.join(SHOTS, 'regA-console-offering.png'), fullPage: true });
      check('the eligibility panel: 1 non-accredited subscriber, 1 not attested to the 10 percent limit', /Regulation A Tier 2: 1 non-accredited subscribers?, 1 not attested to the 10 percent limit/.test(el), el);
      check('the eligibility panel names Dana Whitfield as not attested, with no amount or limit', /Dana Whitfield has not attested that this investment is within their 10 percent limit/.test(el) && !/\$/.test(el), el);
      const lk = L.leakCheck([F.R.status, F.R.sub, rowText, ct].join('\n'));
      check('white label: the investor’s status and subscribe screens and the console pages pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * D-01 in server mode, both ways (plan 06-07): an investor on file (benefit plan answer 'title1', a self-certified ground)
   * is invited to the Rule 506(b) offering. Their device gets the answers in the snapshot's on-file summary, shows them
   * prefilled, and the investor changes the plan to 'none'. After import the console's investor.erisa.plan is 'none', the
   * ground is kept (dated by this answer) and the request's qual agrees.
   */
  async existing({ check, S }) {
    const OLD_DATE = '2024-01-15';
    const F = await serverFlow(S, check, {
      tag: 'existing',
      exemption: 'Rule 506(b)',
      answers: { amount: 60000 },
      beforeInvite: async (cp, off, out) => {
        out.who = await cp.evaluate(
          ({ oid, OLD_DATE }) => {
            const NS = window.CVPortal;
            const ws = NS.state.ws;
            const i = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.accreditation && x.accreditation.basis && !x.accreditation.verifiedBy && x.email && !(x.positions || []).some((y) => y.offeringId === oid));
            if (!i) return null;
            i.erisa = { plan: 'title1', planPct: null, controlling: true, at: '2025-06-01T12:00:00Z' };
            i.accreditation = Object.assign({}, i.accreditation, { date: OLD_DATE });
            NS.app.save(true);
            const parts = String(i.contact).trim().split(/\s+/);
            return { id: i.id, name: i.contact, first: parts[0], last: parts.slice(1).join(' ') || parts[0], email: i.email, basis: i.accreditation.basis };
          },
          { oid: off.offeringId, OLD_DATE }
        );
      },
      onStatusStep: async (p, R) => {
        R.pre = await p.evaluate(() => ({
          acc: (document.querySelector('input[name="ob-stAcc"]:checked') || {}).value || '',
          basis: (document.querySelector('input[name="ob-stBasis"]:checked') || {}).value || '',
          plan: (document.querySelector('input[name="ob-stPlan"]:checked') || {}).value || '',
          ctrl: (document.querySelector('input[name="ob-stCtrl"]:checked') || {}).value || '',
          ctrlQ: document.querySelectorAll('input[name="ob-stCtrl"]').length
        }));
        await p.screenshot({ path: path.join(SHOTS, 'existing-status-prefilled.png'), fullPage: true });
        await p.check('input[name="ob-stPlan"][value="none"]');
        await p.waitForTimeout(200);
      },
      onStatus: async (p, R) => {
        R.plan = await p.evaluate(() => (document.querySelector('input[name="ob-stPlan"]:checked') || {}).value || '');
      }
    });
    try {
      const who = F.who || {};
      check('an active individual investor on file with a self-certified ground, not holding the offering', !!F.who && !!who.basis, F.who);
      check('the invitation is to subscribe (the investor is on file)', (await F.A.page.evaluate((id) => !!(window.CVPortal.state.ws.invitations.find((x) => x.id === id) || {}).existing, F.inv.id)) && F.inv.investorId === who.id, F.inv);
      const ex = ((F.snaps[0] || {}).investor || {}).existing || {};
      // D-08 (1) (plan 06-15): the control answer an earlier version kept on the record is not sent (no longer asked).
      check('the snapshot’s on-file summary carries the ground and the benefit plan answer, cleaned to known fields (no control answer)', ex.accBasis === who.basis && isDeepStrictEqual(ex.erisa, { plan: 'title1', planPct: null }), ex);
      check('the on-file summary carries no personal details (no address, phone, taxpayer ID, bank or positions)', isDeepStrictEqual(Object.keys(ex).sort(), ['accBasis', 'accredited', 'accreditedUntil', 'erisa', 'holds']), Object.keys(ex));
      check('the status step on the investor’s device is prefilled: accredited yes, the ground on file, plan title1; no control question', !!F.R.pre && F.R.pre.acc === 'yes' && F.R.pre.basis === who.basis && F.R.pre.plan === 'title1' && F.R.pre.ctrl === '' && F.R.pre.ctrlQ === 0, { pre: F.R.pre, basis: who.basis });
      check('the investor changed the plan to none', F.R.plan === 'none', F.R.plan);
      const heads = F.walk.seen.map((x) => x.split(' | ').pop());
      check('steps: welcome, status, subscribe, agreement', /^Welcome/.test(heads[0]) && heads.slice(1).join(',') === 'Investor status,Subscription,Subscription agreement', F.walk.seen);
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      check('qual: regime 506b, accredited true, the ground on file, plan none', q.regime === '506b' && q.accredited === true && q.basis === who.basis && !!q.erisa && q.erisa.plan === 'none' && !('share' in q.erisa), q);
      const rec = await F.A.page.evaluate((id) => {
        const i = window.CVPortal.state.ws.investors.find((x) => x.id === id) || {};
        return { erisa: i.erisa || null, accreditation: i.accreditation || null };
      }, who.id);
      check('after import the console’s investor.erisa is the answer the link collected: plan none, no control answer', !!rec.erisa && rec.erisa.plan === 'none' && rec.erisa.planPct === null && !('controlling' in rec.erisa), rec.erisa);
      check('the self-certified ground is kept, dated by this answer (not the old date)', !!rec.accreditation && rec.accreditation.basis === who.basis && rec.accreditation.basis === q.basis && rec.accreditation.date !== OLD_DATE && /^\d{4}-\d{2}-\d{2}$/.test(rec.accreditation.date || ''), rec.accreditation);
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const bp = await panelText(cp, 'Benefit plan investors');
      await cp.screenshot({ path: path.join(SHOTS, 'existing-console-offering.png'), fullPage: true });
      const lk = L.leakCheck([F.R.status, F.R.sub, bp].join('\n'));
      check('white label: the status and subscribe screens and the benefit plan panel pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * Verifier gap 2 / T-06-21 in server mode (plan 06-09): an investor on file with a self-certified ground (dated 2026-04-16,
   * with the self-certification verification record made from it) answers "not accredited" on their own device. After the
   * console's import its record no longer holds the ground, exactly as onboarding.js withdrawGround leaves it in local mode
   * (basis and date cleared, the ground kept as superseded, the self-certification record withdrawn). Run B: a ground a third
   * party verified (verifiedBy) stays exactly as it was.
   */
  async withdraw({ check, S }) {
    const OLD = '2026-04-16';
    const pick = (third) => async (cp, off, out) => {
      out.who = await cp.evaluate(
        ({ oid, OLD, third }) => {
          const NS = window.CVPortal;
          const ws = NS.state.ws;
          const i = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.accreditation && x.accreditation.basis && !x.accreditation.verifiedBy && x.email && !(x.positions || []).some((y) => y.offeringId === oid));
          if (!i) return null;
          const basis = i.accreditation.basis;
          if (third) {
            i.accreditation = { basis, date: OLD, verifiedBy: 'Example Verification Services', expires: '2027-04-16' };
          } else {
            // The firm accepts self-certification: the ground made the self-certification record when it was given.
            NS.integrations.ensure(ws).use.accreditation = ['self'];
            i.accreditation = { basis, date: OLD };
            const at = `${OLD}T12:00:00Z`;
            i.verify = {
              identity: { status: 'passed', completedAt: at },
              aml: { status: 'clear', completedAt: at },
              accreditation: { status: 'verified', method: `Self-certified: ${basis}`, connection: 'self', via: NS.integrations.conn(ws, 'self').name, how: 'self', completedAt: at, verifiedAt: OLD, expiresAt: '2027-04-16' },
              decision: { status: 'approved', at, by: 'automatic', reason: 'all checks passed' }
            };
          }
          NS.app.save(true);
          const parts = String(i.contact).trim().split(/\s+/);
          return { id: i.id, name: i.contact, first: parts[0], last: parts.slice(1).join(' ') || parts[0], email: i.email, basis, before: JSON.parse(JSON.stringify({ accreditation: i.accreditation, verify: i.verify || null })) };
        },
        { oid: off.offeringId, OLD, third }
      );
    };
    const answers = { acc: 'no', exp: 'Ten years of private fund commitments', edu: 'Engineer', rep: 'no', amount: 60000 };
    const record = (page, id) =>
      page.evaluate((iid) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const i = ws.investors.find((x) => x.id === iid) || {};
        return { accreditation: i.accreditation || null, verify: i.verify ? JSON.parse(JSON.stringify(i.verify)) : null, today: NS.dates.today(), log: (ws.audit || []).filter((e) => e.record === iid).map((e) => ({ action: e.action, detail: e.detail })) };
      }, id);

    // Run A: a self-certified ground.
    const F = await serverFlow(S, check, { tag: 'withdraw', exemption: 'Rule 506(b)', answers, beforeInvite: pick(false) });
    try {
      const who = F.who || {};
      check('withdraw A: an active investor on file with a self-certified ground dated 2026-04-16 and its self-certification record', !!who.basis && who.before.accreditation.date === OLD && !!who.before.verify && who.before.verify.accreditation.connection === 'self', who);
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      check('withdraw A: the imported request records accredited false (regime 506b)', q.regime === '506b' && q.accredited === false, q);
      const r = await record(F.A.page, who.id);
      const a = r.accreditation || {};
      check('withdraw A: the console record no longer holds the ground: basis and date cleared, kept as superseded with when it was given (2026-04-16) and withdrawn (today)', a.basis === '' && a.date === '' && !!a.superseded && a.superseded.basis === who.basis && a.superseded.date === OLD && a.superseded.at === r.today && !a.verifiedBy, a);
      const va = (r.verify || {}).accreditation || {};
      check('withdraw A: the self-certification verification record made from the ground is withdrawn: not started, with the superseded record', va.status === 'not_started' && !!va.superseded && va.superseded.method === `Self-certified: ${who.basis}` && va.superseded.verifiedAt === OLD && /^\d{4}-\d{2}-\d{2}T/.test(va.superseded.at || ''), va);
      check('withdraw A: a change-log entry from the investor’s device says the ground no longer applies', r.log.some((e) => e.action === 'Investor status answered' && /no longer applies/.test(e.detail) && /from the investor.s device/.test(e.detail)), r.log);
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const el = await panelText(cp, 'Investor eligibility');
      await cp.screenshot({ path: path.join(SHOTS, 'withdraw-console-offering.png'), fullPage: true });
      check('withdraw A: the console offering page reads "Non-accredited purchasers: 1 of 35"', /Non-accredited purchasers: 1 of 35/.test(el), el);
    } finally {
      await F.close();
    }

    // Run B: the same answer over a ground a third party verified: it stays.
    const G = await serverFlow(S, check, { tag: 'withdrawB', exemption: 'Rule 506(b)', answers, beforeInvite: pick(true) });
    try {
      const who = G.who || {};
      check('withdraw B: an investor on file whose ground a third party verified (verifiedBy)', !!who.basis && !!who.before.accreditation.verifiedBy, who);
      const q = (G.req && G.req.qual) || {};
      check('withdraw B: the imported request records accredited false', q.accredited === false, q);
      const r = await record(G.A.page, who.id);
      check('withdraw B: the verified ground stays exactly as it was', isDeepStrictEqual(r.accreditation, who.before.accreditation), { now: r.accreditation, before: who.before.accreditation });
      check('withdraw B: the console’s own change-log entry says the verified accreditation stays on the record', r.log.some((e) => e.action === 'Accreditation kept' && /verified by Example Verification Services/.test(e.detail) && e.detail.indexOf(who.basis) >= 0 && !/from the investor.s device/.test(e.detail)), r.log);
      // Recorded for the summary, not asserted: what the device's own change-log entry for the answer says in this case.
      console.log('INFO withdraw B: device change-log entries for the answer:', JSON.stringify(r.log.filter((e) => e.action === 'Investor status answered')));
      check('withdraw B: no script error on either side', G.A.errors.length === 0 && G.B.errors.length === 0, { A: G.A.errors, B: G.B.errors });
    } finally {
      await G.close();
    }
  },

  /**
   * Deferred item 2 / T-06-20 (plan 06-09): an imported request's signedBy and signedAt are the console's, never the device's.
   * Each run alters the stored request before import (signedAt 2001-01-02T00:00:00Z, signedBy "Someone Else"):
   *   envelope   signedBy is the console's investor name; signedAt is the kept envelope's investor signature time
   *   unsigned   the envelope arrives with the investor's signature not made (they stopped before signing): signedAt ''
   *   noenvelope a request signed without an envelope: the integration server's completion time
   * every time inside the invitation window (from its sending to now).
   */
  async signed({ check, S }) {
    const answers = { acc: 'no', exp: 'Six years of private fund commitments', edu: 'Architect', rep: 'no', amount: 60000 };
    const FAKE = { signedAt: '2001-01-02T00:00:00Z', signedBy: 'Someone Else' };
    const runs = [
      ['envelope', (s) => Object.assign(s.request, FAKE)],
      [
        'unsigned',
        (s) => {
          Object.assign(s.request, FAKE);
          s.envelope.status = 'sent';
          s.envelope.completedAt = null;
          s.envelope.signers.forEach((x) => x.role === 'investor' && Object.assign(x, { status: 'waiting', signedAt: null, signature: null, initials: null }));
        }
      ],
      [
        'noenvelope',
        (s) => {
          Object.assign(s.request, FAKE);
          delete s.request.envelopeId;
          s.envelope = null;
        }
      ]
    ];
    for (const [name, change] of runs) {
      const F = await serverFlow(S, check, {
        tag: `signed-${name}`,
        exemption: 'Rule 506(b)',
        answers,
        beforeImport: async (srv, inv) => {
          srv.alter(inv.serverId, change);
          return srv.submission(inv.serverId);
        }
      });
      try {
        const st = (F.stored && F.stored.request) || {};
        check(`signed ${name}: the stored request was altered before import (signedAt 2001-01-02, signedBy "Someone Else")`, st.signedAt === FAKE.signedAt && st.signedBy === FAKE.signedBy, { signedAt: st.signedAt, signedBy: st.signedBy });
        commonChecks(check, F);
        const got = await F.A.page.evaluate(({ rid, iid, ivid }) => {
          const ws = window.CVPortal.state.ws;
          const r = ws.requests.find((x) => x.id === rid) || {};
          const i = ws.investors.find((x) => x.id === ivid) || {};
          const it = ws.invitations.find((x) => x.id === iid) || {};
          const e = r.envelopeId ? ws.envelopes.find((x) => x.id === r.envelopeId) : null;
          const sg = e ? e.signers.find((x) => x.role === 'investor') : null;
          return { signedAt: r.signedAt, signedBy: r.signedBy, envelopeId: r.envelopeId || '', envStatus: e ? e.status : '', signer: sg ? { status: sg.status, signedAt: sg.signedAt } : null, contact: i.contact, title: i.title, sentAt: it.sentAt, now: new Date().toISOString() };
        }, { rid: F.req && F.req.id, iid: F.inv.id, ivid: F.inv.investorId });
        const inWindow = (t) => !!t && Date.parse(t) >= Date.parse(got.sentAt) - 1000 && Date.parse(t) <= Date.parse(got.now);
        check(`signed ${name}: signedBy is the console’s own investor name, not the device’s`, got.signedBy === (got.contact || got.title) && got.signedBy !== FAKE.signedBy, got);
        if (name === 'envelope') {
          const want = got.signer && got.signer.status === 'signed' ? String(got.signer.signedAt || '').replace(/\.\d{3}Z$/, 'Z') : '(unsigned)';
          check('signed envelope: the request is tied to the kept envelope, whose investor signature is made', !!got.envelopeId && !!got.signer && got.signer.status === 'signed', got);
          check('signed envelope: signedAt is the kept envelope’s investor signature time, inside the invitation window', got.signedAt === want && inWindow(got.signedAt), got);
        } else if (name === 'unsigned') {
          check('signed unsigned: the kept envelope’s investor signature is not made', !!got.envelopeId && !!got.signer && got.signer.status !== 'signed', got);
          check('signed unsigned: signedAt is empty, whatever the device sent', got.signedAt === '', got);
        } else {
          const done = String((F.stored && F.stored.completedAt) || '').replace(/\.\d{3}Z$/, 'Z');
          check('signed noenvelope: the request has no envelope', !got.envelopeId, got);
          check('signed noenvelope: signedAt is the integration server’s completion time, inside the invitation window', !!done && got.signedAt === done && inWindow(got.signedAt), { got, serverCompletedAt: F.stored && F.stored.completedAt });
        }
      } finally {
        await F.close();
      }
    }
  },

  /**
   * D-30 / T-06-16 in server mode (plan 06-07): a non-accredited 506(b) investor attaches the written acknowledgment of their
   * purchaser representative on their own device. It travels with the completion (rep-<investor id>-<time>, named by the
   * request's qual), passes the server's allowlist as evidence, is stored by the console's import, and the request row's
   * download returns the same bytes under the uploaded name.
   */
  async repack({ check, S }) {
    const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% acknowledgment of purchaser representative, signed by Dana Whitfield\ntrailer << /Root 1 0 R >>\n%%EOF\n');
    const answers = { acc: 'no', exp: 'Four years of real estate syndications', edu: 'Nurse', rep: 'yes', soph: 'rep', repName: 'Morgan Ellery', amount: 60000 };
    const F = await serverFlow(S, check, {
      tag: 'repack',
      exemption: 'Rule 506(b)',
      answers,
      onStatus: async (p, R) => {
        await p.setInputFiles('#ob-stRepFile', { name: 'acknowledgment.pdf', mimeType: 'application/pdf', buffer: PDF });
        await p.waitForTimeout(500);
        R.fileId = await p.evaluate(() => (window.CVPortal.state.ui.ob || { d: {} }).d.stRepFileId || '');
        R.hint = await p.locator('#hint-stRepFile').innerText().catch(() => '');
      }
    });
    try {
      const id = F.R.fileId;
      check('the investor’s device keeps the acknowledgment as rep-{investor id}-{time}', new RegExp(`^rep-${F.inv.investorId}-[0-9a-z]+$`).test(id) && /Attached: acknowledgment\.pdf/.test(F.R.hint), F.R.hint);
      const dr = ((F.deviceQual || {}).sophistication || {}).rep || {};
      check('the device’s request names it: qual.sophistication.rep.fileId and fileName', dr.fileId === id && dr.fileName === 'acknowledgment.pdf', dr);
      commonChecks(check, F);
      const files = (F.stored && F.stored.files) || {};
      check('the acknowledgment passed the server’s allowlist: the server holds it, byte for byte', typeof files[id] === 'string' && Buffer.from(files[id], 'base64').equals(PDF), Object.keys(files));
      const rq = ((F.req && F.req.qual) || {}).sophistication || {};
      check('the imported request keeps the pointer: rep.fileId and fileName', !!rq.rep && rq.rep.fileId === id && rq.rep.fileName === 'acknowledgment.pdf', rq.rep);
      const kept = await F.A.page.evaluate(async (fid) => {
        const b = await window.CVPortal.ops.files.get(fid);
        return b ? Array.from(new Uint8Array(await b.arrayBuffer())) : null;
      }, id);
      check('the console stored the acknowledgment under the same id, byte for byte', !!kept && Buffer.from(kept).equals(PDF), kept && kept.length);
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-requests', '[data-action=req-tab][data-t=all]');
      await cp.click('[data-action=req-tab][data-t=all]');
      await cp.waitForTimeout(300);
      const row = F.req ? await requestRow(cp, F.req.id) : '';
      await cp.screenshot({ path: path.join(SHOTS, 'repack-requests.png'), fullPage: true });
      check('the request row shows "Purchaser representative: Morgan Ellery" and the download (D-08 (2): name only)', /Purchaser representative: Morgan Ellery ·/.test(row) && /Download the written acknowledgment/.test(row), row);
      let got = null;
      let name = '';
      if (id && (await cp.locator(`[data-action=kyc-iv-file][data-id="${id}"]`).count())) {
        const [dl] = await Promise.all([cp.waitForEvent('download', { timeout: 15000 }), cp.click(`[data-action=kyc-iv-file][data-id="${id}"]`)]);
        got = fs.readFileSync(await dl.path());
        name = dl.suggestedFilename();
      }
      check('the request row’s download returns the same bytes, under the uploaded name', !!got && got.equals(PDF) && name === 'acknowledgment.pdf', { size: got && got.length, want: PDF.length, name });
      const lk = L.leakCheck([F.R.status, row].join('\n'));
      check('white label: the status screen and the request row pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
    // An acknowledgment of the full 25 MB the page accepts does not fit with the signed agreement: it stays on the device, the
    // completion still goes, the firm's copy of the request says so and points at no file, and the investor is told.
    const BIG = Buffer.alloc(25 * 1024 * 1024, 0x20);
    PDF.copy(BIG, 0);
    const G = await serverFlow(S, check, {
      tag: 'repbig',
      exemption: 'Rule 506(b)',
      answers,
      onStatus: async (p, R) => {
        await p.setInputFiles('#ob-stRepFile', { name: 'acknowledgment-scan.pdf', mimeType: 'application/pdf', buffer: BIG });
        await p.waitForTimeout(1500);
        R.fileId = await p.evaluate(() => (window.CVPortal.state.ui.ob || { d: {} }).d.stRepFileId || '');
      }
    });
    try {
      check('a 25 MB acknowledgment is accepted on the status step', new RegExp(`^rep-${G.inv.investorId}-[0-9a-z]+$`).test(G.R.fileId), G.R.fileId);
      check('it does not fit with the agreement: the server holds the agreement and no acknowledgment', !!G.stored && Object.keys(G.stored.files || {}).length === 1 && !Object.keys(G.stored.files || {}).some((k) => /^rep-/.test(k)), G.stored && Object.keys(G.stored.files || {}));
      const sr = ((((G.stored || {}).request || {}).qual || {}).sophistication || {}).rep || {};
      check('the firm’s copy of the request points at no file and says to ask the investor for it', !sr.fileId && !sr.fileName && /written acknowledgment of their purchaser representative the investor uploaded \(acknowledgment-scan\.pdf\) did not fit in the 25 MB/.test(sr.note || '') && /Ask the investor for it\./.test(sr.note || ''), sr);
      check('the done screen tells the investor the acknowledgment could not be sent', /The acknowledgment of your purchaser representative you uploaded could not be sent with your details/.test(G.done || ''), (G.done || '').slice(0, 1500));
      check('the firm’s change log records the acknowledgment not sent', await G.A.page.evaluate((id) => (window.CVPortal.state.ws.audit || []).some((e) => e.record === id && e.action === 'Uploaded evidence not sent' && /purchaser representative/.test(e.detail)), G.inv.investorId));
      const cp = G.A.page;
      await L.consoleRoute(cp, 'console-requests', '[data-action=req-tab][data-t=all]');
      await cp.click('[data-action=req-tab][data-t=all]');
      await cp.waitForTimeout(300);
      const row = G.req ? await requestRow(cp, G.req.id) : '';
      await cp.screenshot({ path: path.join(SHOTS, 'repbig-requests.png'), fullPage: true });
      check('the request row gives the note instead of a download', /Purchaser representative: Morgan Ellery; The written acknowledgment/.test(row) && !/Download the written acknowledgment/.test(row), row);
      check('no script error on either side', G.A.errors.length === 0 && G.B.errors.length === 0, { A: G.A.errors, B: G.B.errors });
    } finally {
      await G.close();
    }
  },

  /**
   * T-06-15 (plan 06-07): what the investor's page receives from the server, read in the investor's own context, carries
   * nothing about other investors: no count, no name, no email, no id and no request of the 35 non-accredited purchasers
   * already on the console, and (owner, plan 06-15) no longer even the C-01 "may be full" boolean. The investor's own
   * workspace holds only them.
   */
  async clean({ check, S }) {
    const srv = await L.serverPortal(S);
    const closers = [];
    try {
      const A = await L.open(S, { allow: [srv.base], init: srv.init });
      closers.push(() => A.context.close());
      const cp = A.page;
      const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
      const counted = await seedNonAccredited(cp, off.offeringId, 35, 'cl');
      check('35 non-accredited purchasers counted in the console', counted === 35, counted);
      // Every detail of the others the console holds, to search for in what the investor's page receives.
      const others = await cp.evaluate(() => {
        const ws = window.CVPortal.state.ws;
        const inv = ws.investors.filter((i) => /^cl-inv-/.test(i.id));
        const req = ws.requests.filter((r) => /^cl-req-/.test(r.id));
        return { names: inv.map((i) => i.contact), emails: inv.map((i) => i.email), ids: inv.map((i) => i.id), requests: req.map((r) => r.id) };
      });
      await srv.configure(cp);
      const inv = await L.inviteFromConsole(cp, { first: INV.first, last: INV.last, email: INV.email, offeringId: off.offeringId });
      check('the console sends the invitation to the integration server', /^ivt_/.test(inv.serverId) && inv.link.indexOf(`server=${encodeURIComponent(srv.base)}`) > 0, inv);
      const B = await L.open(S, { allow: [srv.base], init: srv.init });
      closers.push(() => B.context.close());
      const ip = B.page;
      const raw = [];
      ip.on('response', async (res) => {
        if (res.request().method() !== 'GET' || !/\/v1\/invite$/.test(res.url().replace(/[?#].*$/, ''))) return;
        try {
          raw.push(await res.text());
        } catch (e) {
          raw.push('');
        }
      });
      await ip.goto(inv.link);
      await ip.waitForSelector('.ivf-form h1', { timeout: 30000 });
      await ip.waitForTimeout(300);
      check('the investor’s page received the snapshot from the server', raw.length >= 1 && raw[0].length > 0, raw.length);
      let snap = {};
      try {
        snap = JSON.parse(raw[0] || '{}');
      } catch (e) {
        snap = {};
      }
      // Owner (plan 06-15): the investor-side warning and its snapshot boolean are removed.
      check('the snapshot carries no offering.nonAccreditedFull', !('nonAccreditedFull' in (snap.offering || {})), snap.offering && Object.keys(snap.offering));
      // Every key anywhere in the snapshot: none that could carry a count, a list of investors or requests, or a place.
      const keys = new Set();
      const walkKeys = (x) => {
        if (Array.isArray(x)) return x.forEach(walkKeys);
        if (x && typeof x === 'object') Object.keys(x).forEach((k) => (keys.add(k), walkKeys(x[k])));
      };
      walkKeys(snap);
      const bad = Array.from(keys).filter((k) => /^(count|ranked|place|purchasers|investors|requests|positions|accepted|pending|unanswered|holders)$|^nonAccredited/.test(k));
      check('no key in the snapshot could carry a count, a place or other investors or requests', bad.length === 0, bad);
      check('the offering in the snapshot has only its known fields', Object.keys(snap.offering || {}).every((k) => ['id', 'name', 'shortName', 'type', 'summary', 'minimum', 'closeDate', 'terms', 'exemption', 'classes', 'currency', 'documents'].indexOf(k) >= 0), Object.keys(snap.offering || {}));
      check('the investor in the snapshot is the invited investor alone', !!snap.investor && snap.investor.id === inv.investorId && Object.keys(snap.investor).every((k) => ['id', 'contact', 'title', 'type', 'email', 'taxType', 'existing'].indexOf(k) >= 0), snap.investor);
      const text = raw.join('\n');
      const found = [].concat(others.names, others.emails, others.ids, others.requests).filter((v) => v && text.indexOf(v) >= 0);
      check(`none of the others’ ${others.names.length} names, emails, investor ids or request ids appears in what the page received`, others.names.length === 35 && found.length === 0 && !/Seeded Purchaser/.test(text), found.slice(0, 10));
      const dev = await ip.evaluate(() => {
        const ws = window.CVPortal.state.ws;
        return { investors: ws.investors.map((i) => i.id), requests: (ws.requests || []).length, offerings: ws.offerings.length, flag: !!ws.offerings[0] && 'nonAccreditedFull' in ws.offerings[0] };
      });
      check('the investor’s workspace holds one investor (them), one offering with no flag, and no request', dev.investors.length === 1 && dev.investors[0] === inv.investorId && dev.offerings === 1 && dev.flag === false && dev.requests === 0, dev);
      // The status step from it: no warning, no number and no name.
      const w = await L.walk(ip, {
        name: INV.name,
        acc: 'no',
        exp: 'Eight years of private real estate commitments',
        edu: 'Physician',
        rep: 'no',
        amount: 60000,
        onFilled: async (hd) => {
          if (hd !== 'Investor status') return;
          dev.warn = await warnText(ip);
          dev.st = await L.screenText(ip);
          await ip.screenshot({ path: path.join(SHOTS, 'clean-status.png'), fullPage: true });
        }
      });
      check('the status step shows no warning and names no other investor', !FULL_WARN.test(dev.warn || '') && !/Seeded Purchaser/.test(dev.st || ''), { warn: dev.warn, seen: w.seen });
      const lk = L.leakCheck(dev.st || '');
      check('white label: the status screen passes the leak check', lk.ok, lk.hits);
      check('no script error on either side', A.errors.length === 0 && B.errors.length === 0, { A: A.errors, B: B.errors });
      check('the investor’s device reached nothing outside but the integration server', B.net.external.length === 0, B.net.external);
    } finally {
      for (const c of closers.reverse()) await c().catch(() => {});
      await srv.close();
    }
  },

  /**
   * Plan 06-22 (research Pattern 6 and Pitfall 3; D-01): a U.S. individual in server mode signs the pre-filled W-9 on their
   * own device and completes. The tax envelope and its signed copy travel with the completion, pass the integration server's
   * allowlist (one Tax listing, for this investor alone), and arrive in the console, whose investor row reads "W-9 signed
   * <date>" with a Download returning exactly the bytes the device produced (SHA-256 read on the device before sending).
   */
  async 'tax-w9'({ check, S }) {
    const answers = { acc: 'no', exp: 'Six years of private fund commitments', edu: 'Architect', rep: 'no', amount: 60000 };
    const F = await serverFlow(S, check, {
      tag: 'tax-w9',
      exemption: 'Rule 506(b)',
      answers,
      taxSign: signTax,
      onAnyStep: async (hd, p, R) => {
        if (hd === 'Distribution payments' && !R.tax) R.tax = await deviceTax(p);
      }
    });
    try {
      commonChecks(check, F);
      const dv = F.R.tax || {};
      const id = dv.env ? dv.env.id : '';
      const sid = id ? `${id}-signed` : '';
      check('the device signed the W-9: taxCert signed, a completed tax envelope with this investor as its one signer, its signed copy stored', !!dv.taxCert && dv.taxCert.signed === true && dv.taxCert.form === 'W-9' && !!dv.env && dv.env.kind === 'tax' && dv.env.status === 'completed' && dv.env.signedDocId === sid && dv.env.signers.length === 1 && dv.env.signers[0].role === 'investor' && dv.env.signers[0].investorId === F.inv.investorId && /^[0-9a-f]{64}$/.test(dv.sha), dv);
      const st = F.stored || {};
      const te = st.taxEnvelope || null;
      check('the server holds the tax envelope, completed, pointing at its signed copy', !!te && te.id === id && te.kind === 'tax' && te.status === 'completed' && te.signedDocId === sid, te && { id: te.id, kind: te.kind, status: te.status, signedDocId: te.signedDocId });
      const held = st.files && st.files[sid] ? Buffer.from(st.files[sid], 'base64') : null;
      check('the server holds the signed W-9 byte for byte as the device produced it', !!held && sha256(held) === dv.sha, { server: held ? sha256(held) : Object.keys(st.files || {}), device: dv.sha });
      const listed = (st.docs || []).filter((d) => d.cat === 'Tax');
      check('the server lists it once, category Tax, for this investor alone', listed.length === 1 && listed[0].id === sid && listed[0].envelopeId === id && listed[0].audience === 'investors' && JSON.stringify(listed[0].investors) === JSON.stringify([F.inv.investorId]) && listed[0].offeringId === null, st.docs);
      const cp = F.A.page;
      const got = await cp.evaluate(async ({ iid, eid, sid }) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const i = ws.investors.find((x) => x.id === iid) || {};
        const e = (ws.envelopes || []).find((x) => x.id === eid) || null;
        const docs = (ws.docs || []).filter((d) => d.envelopeId === eid);
        const b = await NS.ops.files.get(sid);
        let sha = '';
        if (b) sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer())), (x) => x.toString(16).padStart(2, '0')).join('');
        return { taxForm: i.taxForm, taxCert: i.taxCert || null, env: e ? { kind: e.kind, status: e.status, signedDocId: e.signedDocId, docId: e.docId || null, workDocId: e.workDocId || null } : null, docs: docs.map((d) => ({ id: d.id, cat: d.cat, investors: d.investors, audience: d.audience })), sha };
      }, { iid: F.inv.investorId, eid: id, sid });
      check('the console imported the tax envelope, completed, with only its signed copy', !!got.env && got.env.kind === 'tax' && got.env.status === 'completed' && got.env.signedDocId === sid && !got.env.docId && !got.env.workDocId, got.env);
      check('the console stored the signed W-9 byte for byte', got.sha === dv.sha, { console: got.sha, device: dv.sha });
      check('the console lists it once, category Tax, for this investor alone', got.docs.length === 1 && got.docs[0].id === sid && got.docs[0].cat === 'Tax' && got.docs[0].audience === 'investors' && JSON.stringify(got.docs[0].investors) === JSON.stringify([F.inv.investorId]), got.docs);
      check('the console’s record names the signed W-9', got.taxForm === 'W-9' && !!got.taxCert && got.taxCert.envelopeId === id && got.taxCert.signed === true, got.taxCert);
      const row = await consoleTaxRow(cp, INV.email, 'tax-w9-console.png');
      check('the investor row reads "W-9 signed <date>" with one Download', /W-9 signed [A-Z][a-z]+ \d{1,2}, \d{4}/.test(row.text) && row.downloads === 1, row.text.slice(0, 400));
      check('the Download returns exactly the bytes the device produced', !!row.bytes && sha256(row.bytes) === dv.sha, { download: row.bytes ? sha256(row.bytes) : row.error, device: dv.sha });
      const lk = L.leakCheck([F.done, row.text].join('\n'));
      check('white label: the done screen and the console row pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * Plan 06-22 (D-30, research Pitfall 3). Two runs in server mode.
   *  unsigned  the W-9 finished without a signature: no tax envelope and no signed copy leave the device, the firm's record
   *            says the form was not signed, and the console row reads "W-9 not signed" with no Download.
   *  toolarge  the W-9 signed, but its signed copy does not fit in what is left of the 25 MB after the agreement (the stored
   *            copy is made 25 MB on the device before it completes): the completion still goes with the agreement, the
   *            firm's copy of the record and its change log say so in one line each, the done screen tells the investor,
   *            and the console row says the signed copy was not received.
   */
  async 'tax-unsigned'({ check, S }) {
    const answers = { acc: 'no', exp: 'Six years of private fund commitments', edu: 'Architect', rep: 'no', amount: 60000 };
    const F = await serverFlow(S, check, {
      tag: 'tax-unsigned',
      exemption: 'Rule 506(b)',
      answers,
      onAnyStep: async (hd, p, R) => {
        if (hd === 'Distribution payments' && !R.tax) R.tax = await deviceTax(p);
      }
    });
    try {
      commonChecks(check, F);
      const dv = F.R.tax || {};
      check('unsigned: the device recorded the W-9 as finished without a signature', !!dv.taxCert && dv.taxCert.form === 'W-9' && dv.taxCert.signed === false && !!dv.env && dv.env.status === 'completed', dv);
      const st = F.stored || {};
      check('unsigned: no tax envelope and no signed tax copy reached the server', !st.taxEnvelope && Object.keys(st.files || {}).every((k) => !dv.env || k.indexOf(dv.env.id) !== 0), { taxEnvelope: st.taxEnvelope, files: Object.keys(st.files || {}) });
      check('unsigned: the server lists no tax form', !(st.docs || []).some((d) => d.cat === 'Tax'), st.docs);
      check('unsigned: the firm’s copy of the record says the W-9 was not signed', !!st.investor && !!st.investor.taxCert && st.investor.taxCert.signed === false && st.investor.taxForm === 'W-9', st.investor && st.investor.taxCert);
      const cp = F.A.page;
      const got = await cp.evaluate((iid) => {
        const ws = window.CVPortal.state.ws;
        return { envs: (ws.envelopes || []).filter((e) => e.kind === 'tax' && e.signers.some((s) => s.investorId === iid)).length, docs: (ws.docs || []).filter((d) => d.cat === 'Tax' && (d.investors || []).indexOf(iid) >= 0).length };
      }, F.inv.investorId);
      check('unsigned: the console has no tax envelope and no tax listing for the investor', got.envs === 0 && got.docs === 0, got);
      const row = await consoleTaxRow(cp, INV.email, 'tax-unsigned-console.png');
      check('unsigned: the investor row reads "W-9 not signed" with no Download', /W-9 not signed/.test(row.text) && !/W-9 signed/.test(row.text) && row.downloads === 0, row.text.slice(0, 400));
    } finally {
      await F.close();
    }
    // The signed copy does not fit with the agreement.
    const G = await serverFlow(S, check, {
      tag: 'tax-toolarge',
      exemption: 'Rule 506(b)',
      answers,
      taxSign: signTax,
      onAnyStep: async (hd, p, R) => {
        if (hd !== 'Distribution payments' || R.tax) return;
        R.tax = await deviceTax(p);
        R.big = await p.evaluate(async () => {
          const NS = window.CVPortal;
          const ws = NS.state.ws;
          const i = ws.investors[0];
          const env = (ws.envelopes || []).find((e) => e.id === (i.taxCert || {}).envelopeId);
          if (!env || !env.signedDocId) return 0;
          const big = new Uint8Array(25 * 1024 * 1024).fill(0x20);
          big.set(Array.from('%PDF-1.4\n', (ch) => ch.charCodeAt(0)), 0);
          await NS.ops.files.put(env.signedDocId, new Blob([big], { type: 'application/pdf' }));
          return (await NS.ops.files.get(env.signedDocId)).size;
        });
      }
    });
    try {
      const dv = G.R.tax || {};
      check('toolarge: the device signed the W-9 and its stored signed copy is now 25 MB', !!dv.taxCert && dv.taxCert.signed === true && G.R.big === 25 * 1024 * 1024, { taxCert: dv.taxCert, big: G.R.big });
      const st = G.stored || {};
      check('toolarge: the completion still went, with the agreement and no tax copy or tax envelope', !!st.request && Object.keys(st.files || {}).length === 1 && /-work$|-signed$/.test(Object.keys(st.files || {})[0] || '') && !Object.keys(st.files || {}).some((k) => dv.env && k.indexOf(dv.env.id) === 0) && !st.taxEnvelope, { files: Object.keys(st.files || {}), taxEnvelope: !!st.taxEnvelope });
      const tc = (st.investor || {}).taxCert || {};
      check('toolarge: the firm’s copy of the record says in one line that the signed W-9 did not fit and to ask for it', /^The Form W-9 the investor signed did not fit in the 25 MB that can be sent from the investor’s browser with the rest of their details, so it was not sent with their details\. Ask the investor for it\.$/.test(tc.note || ''), tc);
      const log = await G.A.page.evaluate((id) => (window.CVPortal.state.ws.audit || []).filter((e) => e.record === id && e.action === 'Signed tax form not sent').map((e) => e.detail), G.inv.investorId);
      check('toolarge: the firm’s change log records it in one entry', log.length === 1 && /Form W-9 the investor signed did not fit in the 25 MB/.test(log[0]) && /ask the investor for it/.test(log[0]), log);
      const doneLines = String(G.done || '').split('\n').filter((l) => /Form W-9 you signed/.test(l));
      check('toolarge: the done screen tells the investor in one line', doneLines.length === 1 && /The Form W-9 you signed could not be sent with your details, so .+ may ask you for it again\./.test(doneLines[0]), (G.done || '').slice(0, 1500));
      const row = await consoleTaxRow(G.A.page, INV.email, 'tax-toolarge-console.png');
      check('toolarge: the investor row says the signed copy was not received, with no Download', /W-9 signed, copy not received: ask the investor for it/.test(row.text) && row.downloads === 0, row.text.slice(0, 400));
      check('toolarge: no script error on either side', G.A.errors.length === 0 && G.B.errors.length === 0, { A: G.A.errors, B: G.B.errors });
    } finally {
      await G.close();
    }
  },

  /**
   * Plan 06-23 (research Pitfall 2, T-06-50): an investor may finish onboarding on a shared computer, so once the firm has the
   * tax form the device keeps no copy of the full taxpayer ID. Two runs in server mode.
   *  wipe  a U.S. individual (SSN 468-02-3917) builds the W-9, goes Back and types the number again (the first form is voided),
   *        signs the second and completes. After the confirmed send the device's file store holds no file of any of its tax
   *        envelopes and no tax upload, its Documents list has no tax entry, no tax envelope points at a file, and the
   *        workspace JSON, local and session storage hold no run of the number. The signed W-9 still reached the console.
   *  keep  the integration server is stopped before the agreement is finished: the send fails and nothing is deleted (the
   *        tax files, the Documents entry, the signed copy's SHA-256); with the server back, Try again sends the same file
   *        (SHA-256 equal on the server), and only then is it wiped.
   */
  async 'tax-wipe'({ check, S }) {
    const answers = { acc: 'no', exp: 'Six years of private fund commitments', edu: 'Architect', rep: 'no', amount: 60000, tin: WIPE_SSN };
    const F = await serverFlow(S, check, {
      tag: 'tax-wipe',
      exemption: 'Rule 506(b)',
      answers,
      taxSign: signTax,
      onAnyStep: async (hd, p, R) => {
        if (hd === 'Tax certification' && !R.backed) {
          // the W-9 built from the answers, then Back: the number left memory with the form, so it is typed again (a change)
          R.backed = true;
          await L.submit(p);
          await p.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
          await p.click('.ivf-tax-sign [data-action="ivf-taxanswers"]');
          await p.waitForSelector('#ob-tin', { timeout: 20000 });
          await p.fill('#ob-tin', WIPE_SSN);
        }
        if (hd === 'Distribution payments' && !R.tax) R.tax = await deviceTax(p);
      },
      finish: async (p, out) => {
        const dv = out.R.tax || {};
        out.R.before = await deviceStore(p, dv.env ? dv.env.signedDocId : '');
        const done = await L.finishAgreement(p);
        out.R.after = await deviceStore(p, dv.env ? dv.env.signedDocId : '');
        return done;
      }
    });
    try {
      commonChecks(check, F);
      const R = F.R;
      const dv = R.tax || {};
      const b = R.before || {};
      const a = R.after || {};
      const envIds = (b.envs || []).map((e) => e.id);
      const voided = (b.envs || []).filter((e) => e.status === 'voided');
      const done = (b.envs || []).filter((e) => e.status === 'completed');
      check('wipe: before sending, the device holds a voided W-9 (Back, the number typed again) and the signed one', voided.length === 1 && done.length === 1 && !!dv.taxCert && dv.taxCert.signed === true && !!dv.env && dv.env.id === done[0].id, { envs: b.envs, taxCert: dv.taxCert });
      const held = taxKeys(b.keys, envIds);
      check('wipe: before sending, the signed W-9’s files are in the device’s file store and listed under Documents', !!done[0] && held.indexOf(done[0].docId) >= 0 && held.indexOf(done[0].signedDocId) >= 0 && b.taxDocs.indexOf(done[0].signedDocId) >= 0 && /^[0-9a-f]{64}$/.test(b.sha), { held, taxDocs: b.taxDocs, sha: b.sha });
      check('wipe: before sending, nothing saved outside the file store holds a run of the number (the search covers the workspace, local and session storage)', Array.isArray(b.hits) && b.hits.length === 0, b.hits);
      const st = F.stored || {};
      const sid = done[0] ? done[0].signedDocId : '';
      const sent = st.files && st.files[sid] ? sha256(Buffer.from(st.files[sid], 'base64')) : '';
      check('wipe: the signed W-9 reached the server byte for byte (the send was confirmed)', !!sent && sent === b.sha, { server: sent || Object.keys(st.files || {}), device: b.sha });
      const left = taxKeys(a.keys, envIds);
      check('wipe: after the confirmed send the device’s file store holds no file of any tax envelope (original, work, signed, voided) and no tax upload', Array.isArray(a.keys) && left.length === 0, { left, keys: a.keys });
      check('wipe: after the confirmed send the device’s Documents list has no tax entry', Array.isArray(a.taxDocs) && a.taxDocs.length === 0, a.taxDocs);
      check('wipe: no tax envelope on the device points at a file any more', (a.envs || []).every((e) => !e.docId && !e.workDocId && !e.signedDocId), a.envs);
      check('wipe: the workspace JSON, local and session storage hold no run of the number', Array.isArray(a.hits) && a.hits.length === 0, a.hits);
      check('wipe: the agreement’s own signed copy stays on the device (only the tax files go)', (a.keys || []).some((k) => /-work$|-signed$/.test(k) && envIds.every((id) => k.indexOf(id) !== 0)), a.keys);
      const row = await consoleTaxRow(F.A.page, INV.email, 'tax-wipe-console.png');
      check('wipe: the console row reads "W-9 signed <date>" and its Download returns the bytes the device sent', /W-9 signed [A-Z][a-z]+ \d{1,2}, \d{4}/.test(row.text) && !!row.bytes && sha256(row.bytes) === b.sha, { text: row.text.slice(0, 300), download: row.bytes ? sha256(row.bytes) : row.error });
    } finally {
      await F.close();
    }
    // The server is stopped before the agreement is finished: nothing is deleted until a send is confirmed.
    const G = await serverFlow(S, check, {
      tag: 'tax-keep',
      exemption: 'Rule 506(b)',
      answers,
      taxSign: signTax,
      onAnyStep: async (hd, p, R) => {
        if (hd === 'Distribution payments' && !R.tax) R.tax = await deviceTax(p);
      },
      finish: async (p, out) => {
        const R = out.R;
        const sid = R.tax && R.tax.env ? R.tax.env.signedDocId : '';
        R.before = await deviceStore(p, sid);
        await stopServer(out.srv);
        try {
          await p.waitForSelector('.es-finish', { timeout: 30000 });
          await p.click('.es-finish');
          await p.waitForSelector('[data-action="ivf-retry"]', { timeout: 30000 });
          await p.waitForTimeout(300);
          R.failed = await L.screenText(p);
          R.alert = await p.locator('.ivf-form p.lede[role=alert], p.lede[role=alert]').first().innerText().catch(() => '');
          await p.screenshot({ path: path.join(SHOTS, 'tax-keep-failed.png'), fullPage: true });
          R.during = await deviceStore(p, sid);
        } finally {
          await startServer(out.srv);
        }
        await p.click('[data-action="ivf-retry"]');
        await p.waitForSelector('.ivf-done .ivf-need, .ivf-done .ivf-summary', { timeout: 30000 });
        await p.waitForTimeout(300);
        R.after = await deviceStore(p, sid);
        return p.locator('.ivf-done').innerText();
      }
    });
    try {
      const R = G.R;
      const b = R.before || {};
      const d = R.during || {};
      const a = R.after || {};
      const envIds = (b.envs || []).map((e) => e.id);
      const sid = R.tax && R.tax.env ? R.tax.env.signedDocId : '';
      check('keep: with the server stopped the send fails and the investor is offered Try again', /Almost done/.test(R.failed || '') && /Try again/.test(R.failed || ''), (R.failed || '').slice(0, 600));
      // Plan 06-24 (deferred from 06-23): one plain sentence, never the browser's own error text.
      const alert = (R.alert || '').replace(/\s+/g, ' ').trim();
      check('keep: the page says it in one plain sentence: "We could not reach <firm> to send your details, but nothing you entered is lost: check your connection, then try again."', /^We could not reach [^.:]+ to send your details, but nothing you entered is lost: check your connection, then try again\.$/.test(alert), alert);
      check('keep: no browser error text on the page (Failed to fetch, NetworkError, Load failed, TypeError)', !/Failed to fetch|NetworkError|Load failed|TypeError/i.test(R.failed || ''), (R.failed || '').slice(0, 600));
      const kb = taxKeys(b.keys, envIds).sort();
      const kd = taxKeys(d.keys, envIds).sort();
      check('keep: after the failed send every tax file is still on the device', kb.length > 0 && kb.indexOf(sid) >= 0 && JSON.stringify(kb) === JSON.stringify(kd), { before: kb, during: kd });
      check('keep: after the failed send the Documents entry and the signed copy are unchanged (SHA-256)', /^[0-9a-f]{64}$/.test(b.sha) && d.sha === b.sha && JSON.stringify(d.taxDocs) === JSON.stringify(b.taxDocs) && b.taxDocs.indexOf(sid) >= 0, { before: [b.sha, b.taxDocs], during: [d.sha, d.taxDocs] });
      const st = G.stored || {};
      const sent = st.files && st.files[sid] ? sha256(Buffer.from(st.files[sid], 'base64')) : '';
      check('keep: with the server back, Try again sends the same signed W-9 (SHA-256 equal on the server)', !!sent && sent === b.sha, { server: sent || Object.keys(st.files || {}), device: b.sha });
      check('keep: once that send is confirmed the tax files and the Documents entry are gone from the device', Array.isArray(a.keys) && taxKeys(a.keys, envIds).length === 0 && Array.isArray(a.taxDocs) && a.taxDocs.length === 0, { left: taxKeys(a.keys, envIds), taxDocs: a.taxDocs });
      check('keep: no script error on either side', G.A.errors.length === 0 && G.B.errors.length === 0, { A: G.A.errors, B: G.B.errors });
    } finally {
      await G.close();
    }
  },

  /**
   * Plan 06-23 (D-01, D-30, T-06-51): an uploaded tax form in server mode. Two runs.
   *  upload   Kittiwake Point Partners LP, invited as a foreign entity, uploads a W-8IMY instead of the W-8BEN-E, goes Back
   *           and uploads a corrected one (the first file leaves the device then). The second file passes the integration
   *           server as evidence and reaches the console: the row reads "W-8IMY uploaded <date>" (no review mark, owner's
   *           legal review) and its Download returns the same bytes. After the confirmed send the device holds no tax- file.
   *  upbig    a U.S. individual uploads a W-9 that is then made 25 MB on the device: the completion still goes with the
   *           agreement; the firm's copy of the record, its change log and the done screen each say so in one line, and the
   *           console row says the upload was not received, with no Download.
   */
  async 'tax-upload'({ check, S }) {
    const answers = { acc: 'no', exp: 'Twelve years of private fund commitments', edu: 'Fund administrator', rep: 'no', amount: 60000 };
    const first = await samplePdf('Form W-8IMY - Kittiwake Point Partners LP (draft, replaced)');
    const second = await samplePdf('Form W-8IMY - Kittiwake Point Partners LP (completed outside the portal)');
    const F = await serverFlow(S, check, {
      tag: 'tax-upload',
      exemption: 'Rule 506(b)',
      answers,
      invite: { type: 'foreign-entity', account: 'Kittiwake Point Partners LP' },
      onFilledAny: async (hd, p) => {
        if (!/Investor information/.test(hd)) return;
        await p.selectOption('#ob-country', 'Cayman Islands');
        await p.waitForTimeout(200);
        await p.fill('#ob-street', '94 Solaris Avenue');
        await p.fill('#ob-city', 'Camana Bay');
        await p.fill('#ob-st', 'Grand Cayman');
        await p.fill('#ob-zip', 'KY1-1108');
        await p.fill('#ob-formation', 'Cayman Islands');
        await p.fill('#ob-tin', '');
      },
      taxStep: async (p, R) => {
        R.hint1 = await uploadTaxForm(p, 'W-8IMY', { name: 'W-8IMY draft.pdf', mimeType: 'application/pdf', buffer: first });
        R.first = await deviceUpload(p);
        // Back to the tax step, and a corrected form uploaded in its place
        await p.click('[data-action="ivf-back"]');
        await p.waitForFunction(() => document.querySelector('.ivf-form h1') && document.querySelector('.ivf-form h1').innerText === 'Tax certification', null, { timeout: 20000 });
        R.hint2 = await uploadTaxForm(p, 'W-8IMY', { name: 'W-8IMY Kittiwake Point.pdf', mimeType: 'application/pdf', buffer: second });
        R.up = await deviceUpload(p);
        R.mid = await deviceStore(p);
      },
      finish: async (p, out) => {
        out.R.before = await deviceStore(p);
        const done = await L.finishAgreement(p);
        out.R.after = await deviceStore(p);
        return done;
      }
    });
    try {
      commonChecks(check, F);
      const R = F.R;
      const up = R.up || {};
      const tc = up.taxCert || {};
      const own = new RegExp(`^tax-${String(F.inv.investorId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-[a-z0-9]+$`);
      check('upload: each file was attached on the upload view', /Attached: W-8IMY draft\.pdf/.test(R.hint1 || '') && /Attached: W-8IMY Kittiwake Point\.pdf/.test(R.hint2 || ''), { hint1: R.hint1, hint2: R.hint2 });
      check('upload: the device’s record names the second W-8IMY under the investor’s own tax- id, bytes as chosen', up.taxForm === 'W-8IMY' && tc.uploaded === true && tc.form === 'W-8IMY' && own.test(tc.fileId || '') && tc.fileName === 'W-8IMY Kittiwake Point.pdf' && up.sha === sha256(second) && !!R.first && R.first.taxCert && R.first.taxCert.fileId !== tc.fileId, { first: R.first && R.first.taxCert, now: tc, sha: up.sha });
      const ups = ((R.mid || {}).keys || []).filter((k) => /^tax-/.test(k));
      check('upload: the replaced first file left the device when the second was stored (one tax- file)', ups.length === 1 && ups[0] === tc.fileId, ups);
      const st = F.stored || {};
      const held = st.files && st.files[tc.fileId] ? Buffer.from(st.files[tc.fileId], 'base64') : null;
      check('upload: the server holds the uploaded W-8IMY byte for byte, and only it beside the agreement', !!held && sha256(held) === sha256(second) && Object.keys(st.files || {}).filter((k) => /^tax-/.test(k)).length === 1, { server: held ? sha256(held) : Object.keys(st.files || {}), want: sha256(second) });
      check('upload: the server’s copy of the record names it', !!st.investor && !!st.investor.taxCert && st.investor.taxCert.fileId === tc.fileId && st.investor.taxCert.uploaded === true, st.investor && st.investor.taxCert);
      const got = await consoleRecord(F.A.page, F.inv.investorId, tc.fileId);
      check('upload: the console stored the same bytes and its record names the upload, on file', got.sha === sha256(second) && got.taxForm === 'W-8IMY' && !!got.taxCert && got.taxCert.fileId === tc.fileId && got.taxCert.received === undefined && got.onFile === true, got);
      const row = await consoleTaxRow(F.A.page, INV.email, 'tax-upload-console.png');
      check('upload: the investor row reads "W-8IMY uploaded <date>" with one Download (no review mark)', /W-8IMY uploaded [A-Z][a-z]+ \d{1,2}, \d{4}/.test(row.text) && row.downloads === 1 && !/review/i.test(row.text) && !/not received/.test(row.text), row.text.slice(0, 400));
      check('upload: the Download returns exactly the bytes the investor chose', !!row.bytes && sha256(row.bytes) === sha256(second), { download: row.bytes ? sha256(row.bytes) : row.error });
      const left = ((R.after || {}).keys || []).filter((k) => /^tax-/.test(k));
      check('upload: after the confirmed send the device holds no tax- file', Array.isArray((R.after || {}).keys) && left.length === 0 && ((R.before || {}).keys || []).indexOf(tc.fileId) >= 0, { before: (R.before || {}).keys, after: (R.after || {}).keys });
      const lk = L.leakCheck([F.done, row.text].join('\n'));
      check('upload: white label: the done screen and the console row pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
    // An upload that does not fit with the agreement.
    const big = await samplePdf('Form W-9 - Dana Whitfield (completed outside the portal)');
    const G = await serverFlow(S, check, {
      tag: 'tax-upbig',
      exemption: 'Rule 506(b)',
      answers,
      taxStep: async (p, R) => {
        R.hint = await uploadTaxForm(p, null, { name: 'my-w9.pdf', mimeType: 'application/pdf', buffer: big });
        R.up = await deviceUpload(p);
        R.big = await p.evaluate(async () => {
          const NS = window.CVPortal;
          const tc = NS.state.ws.investors[0].taxCert || {};
          if (!tc.fileId) return 0;
          const b = new Uint8Array(25 * 1024 * 1024).fill(0x20);
          b.set(Array.from('%PDF-1.4\n', (ch) => ch.charCodeAt(0)), 0);
          await NS.ops.files.put(tc.fileId, new Blob([b], { type: 'application/pdf' }));
          return (await NS.ops.files.get(tc.fileId)).size;
        });
      }
    });
    try {
      const R = G.R;
      const tc0 = (R.up || {}).taxCert || {};
      check('upbig: the device stored the uploaded W-9, now 25 MB', tc0.uploaded === true && tc0.form === 'W-9' && R.big === 25 * 1024 * 1024, { taxCert: tc0, big: R.big });
      const st = G.stored || {};
      check('upbig: the completion still went, with the agreement and no tax- file', !!st.request && Object.keys(st.files || {}).length === 1 && !Object.keys(st.files || {}).some((k) => /^tax-/.test(k)), Object.keys(st.files || {}));
      const tc = (st.investor || {}).taxCert || {};
      check('upbig: the firm’s copy of the record says in one line that the uploaded W-9 did not fit and to ask for it, and names no file', /^The Form W-9 the investor uploaded \(my-w9\.pdf\) did not fit in the 25 MB that can be sent from the investor’s browser with the rest of their details, so it was not sent with their details\. Ask the investor for it\.$/.test(tc.note || '') && !tc.fileId, tc);
      const log = await G.A.page.evaluate((id) => (window.CVPortal.state.ws.audit || []).filter((e) => e.record === id && /not sent/.test(e.action)).map((e) => `${e.action} :: ${e.detail}`), G.inv.investorId);
      check('upbig: the firm’s change log records it in one entry', log.length === 1 && /^Uploaded tax form not sent :: .*Form W-9 the investor uploaded \(my-w9\.pdf\) did not fit in the 25 MB/.test(log[0]) && /ask the investor for it/.test(log[0]), log);
      const doneLines = String(G.done || '').split('\n').filter((l) => /Form W-9 you uploaded/.test(l));
      check('upbig: the done screen tells the investor in one line', doneLines.length === 1 && /The Form W-9 you uploaded could not be sent with your details, so .+ may ask you for it again\./.test(doneLines[0]), (G.done || '').slice(0, 1500));
      const got = await consoleRecord(G.A.page, G.inv.investorId, '');
      check('upbig: the console marks the upload not received and not on file', !!got.taxCert && got.taxCert.received === false && !got.taxCert.fileId && got.onFile === false, got);
      const row = await consoleTaxRow(G.A.page, INV.email, 'tax-upbig-console.png');
      check('upbig: the investor row says the uploaded W-9 was not received, with no Download', /W-9 uploaded, copy not received: ask the investor for it/.test(row.text) && row.downloads === 0, row.text.slice(0, 400));
      check('upbig: no script error on either side', G.A.errors.length === 0 && G.B.errors.length === 0, { A: G.A.errors, B: G.B.errors });
    } finally {
      await G.close();
    }
  },

  /**
   * Plan 06-23 (D-01, research FORM-07): a foreign individual in server mode signs the pre-filled W-8BEN on their own device.
   * The signed copy and its envelope pass the integration server, the record arrives with its validity date, and the console
   * row reads "W-8BEN signed <date>, valid until Dec 31, <year + 3>" with a Download of the same bytes. After the confirmed
   * send the device holds no file of the form and no run of the foreign tax ID.
   */
  async 'tax-w8ben'({ check, S }) {
    const answers = { acc: 'no', exp: 'Ten years of private equity commitments', edu: 'Engineer', rep: 'no', amount: 60000 };
    const FTIN = '86014520937';
    const F = await serverFlow(S, check, {
      tag: 'tax-w8ben',
      exemption: 'Rule 506(b)',
      answers,
      invite: { type: 'foreign-individual' },
      onFilledAny: async (hd, p) => {
        if (/Investor information/.test(hd)) {
          await p.selectOption('#ob-country', 'Germany');
          await p.waitForTimeout(200);
          if (await p.locator('input[name="ob-citizen"][value="other"]').count()) await p.check('input[name="ob-citizen"][value="other"]');
          await p.fill('#ob-street', 'Königsallee 27');
          await p.fill('#ob-city', 'Düsseldorf');
          await p.fill('#ob-st', '');
          await p.fill('#ob-zip', '40212');
          await p.fill('#ob-tin', '');
        }
        if (/Tax certification/.test(hd) && (await p.locator('#ob-ftin').count())) await p.fill('#ob-ftin', FTIN);
      },
      taxSign: signTax,
      onAnyStep: async (hd, p, R) => {
        if (hd === 'Distribution payments' && !R.tax) R.tax = await deviceTax(p);
      },
      finish: async (p, out) => {
        const dv = out.R.tax || {};
        out.R.before = await deviceStore(p, dv.env ? dv.env.signedDocId : '');
        const done = await L.finishAgreement(p);
        out.R.after = await deviceStore(p, '');
        out.R.ftinLeft = await p.evaluate((f) => JSON.stringify(window.CVPortal.state.ws).indexOf(f) >= 0 || Object.keys(localStorage).some((k) => String(localStorage.getItem(k)).indexOf(f) >= 0), FTIN);
        return done;
      }
    });
    try {
      commonChecks(check, F);
      const dv = F.R.tax || {};
      const tc = dv.taxCert || {};
      const year = Number(new Date().toISOString().slice(0, 4));
      const until = `${year + 3}-12-31`;
      check('w8ben: the device signed the W-8BEN: taxCert signed, valid until 31 December three years on, a completed tax envelope with this investor alone', tc.form === 'W-8BEN' && tc.signed === true && tc.validUntil === until && tc.ftinLast4 === FTIN.slice(-4) && !!dv.env && dv.env.kind === 'tax' && dv.env.status === 'completed' && dv.env.signers.length === 1 && dv.env.signers[0].investorId === F.inv.investorId && /^[0-9a-f]{64}$/.test(dv.sha), dv);
      const st = F.stored || {};
      const sid = dv.env ? dv.env.signedDocId : '';
      const te = st.taxEnvelope || null;
      const held = st.files && st.files[sid] ? Buffer.from(st.files[sid], 'base64') : null;
      check('w8ben: the server holds the completed W-8BEN envelope and the signed copy byte for byte', !!te && te.status === 'completed' && te.taxForm && te.taxForm.form === 'W-8BEN' && !!held && sha256(held) === dv.sha, { te: te && { status: te.status, taxForm: te.taxForm }, server: held ? sha256(held) : Object.keys(st.files || {}), device: dv.sha });
      check('w8ben: the server’s copy of the record carries the validity date', !!st.investor && !!st.investor.taxCert && st.investor.taxCert.validUntil === until && st.investor.taxForm === 'W-8BEN', st.investor && st.investor.taxCert);
      const got = await consoleRecord(F.A.page, F.inv.investorId, sid);
      check('w8ben: the console stored the signed W-8BEN byte for byte and its record keeps the validity date, on file', got.sha === dv.sha && got.taxForm === 'W-8BEN' && !!got.taxCert && got.taxCert.validUntil === until && got.taxCert.signed === true && got.onFile === true, got);
      const row = await consoleTaxRow(F.A.page, INV.email, 'tax-w8ben-console.png');
      check('w8ben: the investor row reads "W-8BEN signed <date>, valid until Dec 31, <year + 3>" with one Download', new RegExp(`W-8BEN signed [A-Z][a-z]+ \\d{1,2}, \\d{4}, valid until Dec 31, ${year + 3}`).test(row.text) && row.downloads === 1, row.text.slice(0, 400));
      check('w8ben: the Download returns exactly the bytes the device produced', !!row.bytes && sha256(row.bytes) === dv.sha, { download: row.bytes ? sha256(row.bytes) : row.error, device: dv.sha });
      const envIds = ((F.R.before || {}).envs || []).map((e) => e.id);
      check('w8ben: after the confirmed send the device holds no file of the form, no Documents entry for it and no run of the foreign tax ID', envIds.length > 0 && Array.isArray((F.R.after || {}).keys) && taxKeys(F.R.after.keys, envIds).length === 0 && F.R.after.taxDocs.length === 0 && F.R.ftinLeft === false, { left: taxKeys((F.R.after || {}).keys, envIds), taxDocs: (F.R.after || {}).taxDocs, ftinLeft: F.R.ftinLeft });
      const lk = L.leakCheck([F.done, row.text].join('\n'));
      check('w8ben: white label: the done screen and the console row pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
  }
};

L.runParts(parts, { name: 'SERVER MODE', browser: true });
