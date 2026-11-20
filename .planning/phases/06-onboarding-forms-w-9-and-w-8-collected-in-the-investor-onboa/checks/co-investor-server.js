#!/usr/bin/env node
// Co-investor sign-in with the integration server (plan 06-39; server contract 06-38, sign-in record and hooks 06-37).
// Each part runs the real integration server (server/index.mjs) in this process and separate browser contexts that share
// nothing but that server: the firm's console, the account investor's device and the co-investor's device. Invented data only.
//   cosign-desktop        a self-serve firm whose agreement has places for a co-investor (a signature and a name) and a
//                         "Taxpayer ID" place for the investor. A co-investor is added to an investor on file BEFORE the
//                         investor signs (no preview dialog; the row says the sign-in is emailed once the investor has
//                         signed). The investor is invited through the server, types a full SSN in the Taxpayer ID place,
//                         signs on their device; the console imports. Then: the console creates the co-investor's sign-in on
//                         the server (one email to the co-investor in the outbox with the 06-38 subject and text, the row
//                         says when), and nothing the co-investor receives holds the investor's taxpayer number (no SSN or
//                         EIN pattern in the snapshot's field values or in the PDF's text, while the console's own copy does
//                         hold it). The co-investor's device (its own context) opens the emailed link: welcome with the
//                         consent, the agreement with only their places, signs, done screen; after a confirmed send it keeps
//                         no copy of the agreement. The console imports: its envelope has the co-investor signed with their
//                         consent and signature, its work copy is new (SHA-256 recorded) and carries the co-investor's name
//                         and still the investor's values, the firm has the notification, the account investor's record is
//                         unchanged; the firm countersigns from Requests and the envelope reads completed.
//   cosign-phone          the co-investor's device at 390x844 with touch and an iOS user agent: the same path from the link
//                         to done, and the console takes the signature in.
//   cosign-later          a co-investor added after the investor's signed copy was imported gets the server sign-in at
//                         "Add co-investor" (no preview dialog; the email is in the outbox; the link loads the agreement).
//   cosign-change-remove  a changed email cancels the old server sign-in (its link answers the server's cancelled message and
//                         the device says the link no longer works) and emails a new one; "Remove co-investor" cancels it.
//   cosign-forged         the co-investor's device sends a completion that also changes the investor's and the firm's field
//                         values, marks the firm signed and adds a signer, and the stored submission is altered the same way
//                         before the console imports: only the co-investor's signature and own places are taken. The same
//                         submission arriving again (the co-investor already signed), and again after the firm voided the
//                         agreement, changes nothing and an audit line says what came and why it was not used.
//   NODE_PATH=$(npm root -g) node co-investor-server.js [--only cosign-desktop,cosign-phone,cosign-later,cosign-change-remove,cosign-forged]
// The last line is "CO-INVESTOR SERVER: PASS (parts run: N)" or "CO-INVESTOR SERVER: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const L = require('./lib.js');

const OUT = path.join(L.OUT, 'co-investor-server');
fs.mkdirSync(OUT, { recursive: true });
L.describeShots([
  [/-co-row-waiting\.png$/, 'Console, Investors: the co-investor added before the investor signed; the row says the sign-in is emailed once the investor has signed.'],
  [/-co-row-sent\.png$/, 'Console, Investors: after the investor’s signed copy was imported, the row says when the co-investor’s sign-in was emailed (the check’s server has no mail settings, so it is in its outbox).'],
  [/-co-welcome\.png$/, 'The co-investor’s own device, opened from the emailed link: welcome and the consent to electronic records and signatures.'],
  [/-co-agreement\.png$/, 'The co-investor’s device: the agreement with only the co-investor’s own places to sign.'],
  [/-co-done\.png$/, 'The co-investor’s device after signing: "Thank you", the signature is recorded and sent to the firm.'],
  [/-co-envelope\.png$/, 'Console: the agreement after the co-investor’s signature was imported, waiting for the firm’s countersignature.'],
  [/-co-completed\.png$/, 'Console: the agreement countersigned by the firm, completed.'],
  [/-co-later-record\.png$/, 'Console: a co-investor added after the investor signed; the Account window shows the sign-in was emailed (no email to send by hand).'],
  [/-co-old-link\.png$/, 'The co-investor’s earlier link after their email was changed: the link no longer works.']
]);

const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
const IPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' };
const tagOf = (dev) => (dev === IPHONE ? 'phone' : 'desktop');
// The agreement's places for the co-investor (template role "Investor 2") and the investor's taxpayer number.
const CO_SIG = { id: 'tf-cosig', signerRole: 'Investor 2', type: 'signature', page: 3, x: 1.9 / 8.5, y: 6.0 / 11, w: 3.2 / 8.5, h: 0.5 / 11, required: true, label: 'Second signature', value: '' };
const CO_NAME = { id: 'tf-coname', signerRole: 'Investor 2', type: 'name', page: 3, x: 1.9 / 8.5, y: 6.6 / 11, w: 3.2 / 8.5, h: 0.24 / 11, required: false, label: 'Second name', value: '' };
const TIN_FIELD = { id: 'tf-tin', signerRole: 'Investor', type: 'text', page: 1, x: 2.5 / 8.5, y: 6.7 / 11, w: 2.4 / 8.5, h: 0.24 / 11, required: false, label: 'Taxpayer ID', value: '' };
const SSN = '412-55-7316';
// The server's own pattern (06-38 withholdTins): a full SSN or EIN, dashed, spaced or nine bare digits.
const TIN_RE = /\b\d{3}-\d{2}-\d{4}\b|\b\d{3} \d{2} \d{4}\b|\b\d{2}-\d{7}\b|(^|\D)\d{9}(\D|$)/;
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

/** The text of a PDF (pdf.js in this process), pages joined. */
let pdfjs = null;
async function pdfText(buf) {
  if (!pdfjs) {
    const warn = console.warn;
    const log = console.log;
    console.warn = console.log = () => {};
    try {
      pdfjs = require(path.join(L.VENDOR, 'pdfjs/package/legacy/build/pdf.js'));
      pdfjs.GlobalWorkerOptions.workerSrc = path.join(L.VENDOR, 'pdfjs/package/legacy/build/pdf.worker.js');
    } finally {
      console.warn = warn;
      console.log = log;
    }
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    out.push(tc.items.map((x) => x.str).join(' '));
  }
  return out.join('\n');
}

/** How many pictures a PDF holds (an adopted signature is stamped as one). */
async function pdfImages(buf) {
  const PL = require(path.join(L.VENDOR, 'pdflib/package/dist/pdf-lib.min.js'));
  const doc = await PL.PDFDocument.load(new Uint8Array(buf), { ignoreEncryption: true });
  let n = 0;
  doc.context.enumerateIndirectObjects().forEach(([, o]) => {
    const d = o && o.dict;
    const st = d && d.get(PL.PDFName.of('Subtype'));
    if (st && String(st) === '/Image') n++;
  });
  return n;
}

/* ---------- The firm's console ---------- */
/** A firm with the integration server set up, the agreement's co-investor places and an investor on file to invite. */
async function firm(S, check) {
  const srv = await L.serverPortal(S);
  const closers = [];
  const F = { srv, closers };
  F.close = async () => {
    for (const c of closers.reverse()) await c().catch(() => {});
    await srv.close();
  };
  const A = await L.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({ acceptDownloads: true }, DESKTOP) });
  closers.push(() => A.context.close());
  F.A = A;
  const cp = A.page;
  F.cp = cp;
  const off = await L.setupPortal(S, A);
  F.off = off;
  F.ready = await cp.evaluate(
    ({ fields, oid }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const t = ws.esignTemplates.find((x) => x.id === 'tpl-sub-test');
      fields.forEach((f) => t.fields.push(Object.assign({}, f)));
      t.roles = ['Investor', 'Investor 2', 'Sponsor'];
      NS.app.save(true);
      return NS.esign.templateReady(ws, oid) && NS.coSigning.coPlaces(ws, oid);
    },
    { fields: [CO_SIG, CO_NAME, TIN_FIELD], oid: off.offeringId }
  );
  F.serverOn = await srv.configure(cp);
  F.who = await cp.evaluate((oid) => {
    const ws = window.CVPortal.state.ws;
    const i = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.accreditation && x.accreditation.basis && !x.accreditation.verifiedBy && x.email && !x.coInvestor && !(x.positions || []).some((y) => y.offeringId === oid));
    if (!i) return null;
    const parts = String(i.contact).trim().split(/\s+/);
    return { id: i.id, name: i.contact, first: parts[0], last: parts.slice(1).join(' ') || parts[0], email: i.email, title: i.title };
  }, off.offeringId);
  F.tenant = await cp.evaluate(() => {
    const t = window.CVPortal.state.ws.tenant;
    return { id: t.id, name: t.name, team: t.support.team, email: t.support.email };
  });
  check('the firm: integration server connected, agreement with places for a co-investor, an investor on file to invite', F.serverOn === true && F.ready === true && !!F.who, { serverOn: F.serverOn, ready: F.ready, who: F.who });
  return F;
}
async function investorsPage(cp, invId) {
  await cp.evaluate(() => window.CVPortal.ui.closeDialog());
  await L.consoleRoute(cp, 'console-investors', `[data-action=co-record][data-id="${invId}"]`);
}
const rowOf = (cp, invId) =>
  cp.evaluate((id) => {
    const b = document.querySelector(`[data-action=co-record][data-id="${CSS.escape(id)}"]`);
    const tr = b && b.closest('tr');
    if (tr) tr.scrollIntoView({ block: 'center' });
    return tr ? tr.innerText.replace(/\s+/g, ' ') : '';
  }, invId);
const dialogNow = (cp) =>
  cp.evaluate(() => {
    const d = document.getElementById('dlg');
    return d && d.open ? { open: true, h2: ((d.querySelector('h2') || {}).innerText || '').trim(), text: d.innerText.replace(/[ \t]+/g, ' '), record: !!d.querySelector('.co-record') } : { open: false };
  });
/** "Add co-investor" (or "Change co-investor") in the Account window, with the console's own form. */
async function saveCo(cp, invId, co) {
  await investorsPage(cp, invId);
  await cp.click(`[data-action=co-record][data-id="${invId}"]`);
  await cp.waitForSelector('#dlg[open] [data-action=co-add]', { timeout: 10000 });
  await cp.click('#dlg [data-action=co-add]');
  await cp.waitForSelector('#dlg form[data-form="co-save"]', { timeout: 10000 });
  await cp.fill('#co-first', co.first);
  await cp.fill('#co-last', co.last);
  await cp.fill('#co-email', co.email);
  await cp.click('#dlg form[data-form="co-save"] button[type=submit]');
  await cp.waitForTimeout(800);
  return dialogNow(cp);
}
async function removeCo(cp, invId) {
  await investorsPage(cp, invId);
  await cp.click(`[data-action=co-record][data-id="${invId}"]`);
  await cp.waitForSelector('#dlg[open] [data-action=co-remove]', { timeout: 10000 });
  await cp.click('#dlg [data-action=co-remove]');
  await cp.waitForSelector('#dlg[open] [data-action=co-remove-yes]', { timeout: 10000 });
  await cp.click('#dlg [data-action=co-remove-yes]');
  await cp.waitForTimeout(800);
}
/** The account's co-investor, sign-in record and the agreement that has the co-investor as a signer, as the console holds them. */
const consoleState = (cp, invId) =>
  cp.evaluate(async (id) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const i = ws.investors.find((x) => x.id === id);
    const c = i && i.coInvestor;
    const env = (ws.envelopes || []).filter((e) => e.status !== 'voided' && e.signers.some((s) => s.investorId === id && s.co)).pop() || (ws.envelopes || []).filter((e) => e.kind !== 'tax' && e.signers.some((s) => s.investorId === id)).pop() || null;
    let sha = '';
    let work = '';
    const b = env && env.workDocId ? await NS.ops.files.get(env.workDocId) : null;
    if (b) {
      const u8 = new Uint8Array(await b.arrayBuffer());
      sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', u8)), (x) => x.toString(16).padStart(2, '0')).join('');
      let s = '';
      for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
      work = btoa(s);
    }
    const sg = (s) => (s ? { id: s.id, name: s.name, email: s.email, status: s.status, role: s.role, co: !!s.co, consentAt: s.consentAt || '', signedAt: s.signedAt || '', signature: !!(s.signature && s.signature.png), userAgent: s.userAgent || '' } : null);
    const co = env && env.signers.find((s) => s.co);
    const me = env && env.signers.find((s) => s.investorId === id && !s.co);
    const firm = env && env.signers.find((s) => s.role === 'countersigner');
    const rec = i ? JSON.parse(JSON.stringify(i)) : null;
    if (rec) delete rec.coInvestor;
    return {
      co: c ? { name: c.name, email: c.email, signIn: c.signIn ? JSON.parse(JSON.stringify(c.signIn)) : null } : null,
      record: rec,
      env: env
        ? {
            id: env.id,
            status: env.status,
            workDocId: env.workDocId || '',
            signers: env.signers.length,
            co: sg(co),
            investor: sg(me),
            firm: sg(firm),
            coFields: co ? env.fields.filter((f) => f.signerId === co.id).map((f) => ({ id: f.id, type: f.type, value: f.value })) : [],
            otherFields: env.fields.filter((f) => !co || f.signerId !== co.id).map((f) => ({ id: f.id, signerId: f.signerId, label: f.label || '', value: f.value })),
            events: env.events.map((e) => ({ actor: e.actor, action: e.action, at: e.at })),
            fieldIds: env.fields.map((f) => f.id)
          }
        : null,
      sha,
      work,
      notes: (ws.notifications || []).map((n) => n.title),
      audit: (ws.audit || []).map((a) => `${a.action}: ${a.detail || ''}`)
    };
  }, invId);
/** Wait (at most ms) until the sign-in record has a server id or an error. */
const waitServerSignIn = (cp, invId, ms) =>
  cp
    .waitForFunction(
      (id) => {
        const i = window.CVPortal.state.ws.investors.find((x) => x.id === id);
        const si = i && i.coInvestor && i.coInvestor.signIn;
        return !!(si && (si.serverId || si.error));
      },
      invId,
      { timeout: ms || 20000 }
    )
    .then(
      () => true,
      () => false
    );
const outbox = async (srv, serverId) => ((await srv.call('GET', `/v1/outbox?invitation=${encodeURIComponent(serverId)}`)).body || {}).messages || [];
const tokenOf = (link) => String(link || '').split('#invite-')[1] || '';
/** What the server hands a device for a link (GET /v1/invite with the link's token), as the device would read it. */
async function openLink(srv, link) {
  const res = await fetch(srv.base + '/v1/invite', { headers: { 'X-Invite-Token': tokenOf(link) } });
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  return { status: res.status, body };
}
const emailLine = (st) => (st === 'outbox' ? /Sign-in in the server outbox [A-Z][a-z]{2} \d{1,2}, \d{4}/ : /Sign-in emailed [A-Z][a-z]{2} \d{1,2}, \d{4}/);

/* ---------- The account investor's device ---------- */
/** The investor on file is invited through the server, types the SSN in the Taxpayer ID place, signs; the console imports. */
async function investorSigns(S, check, F) {
  const cp = F.cp;
  const who = F.who;
  // The firm closes the Account window left open by "Add co-investor" before it invites.
  await cp.evaluate(() => window.CVPortal.ui.closeDialog());
  const inv = await L.inviteFromConsole(cp, { first: who.first, last: who.last, email: who.email, offeringId: F.off.offeringId });
  F.inv = inv;
  check('the investor’s invitation goes through the integration server', /^ivt_/.test(inv.serverId) && inv.investorId === who.id, inv);
  const B = await L.open(S, { allow: [F.srv.base], init: F.srv.init });
  F.closers.push(() => B.context.close());
  F.B = B;
  const ip = B.page;
  await ip.goto(inv.link);
  const w = await L.walk(ip, { acc: 'yes', basis: 0, name: who.name });
  check('the investor reaches the agreement on their device', w.reached && w.errors.length === 0, { seen: w.seen, errors: w.errors });
  if (!w.reached) return false;
  const tinId = await ip.evaluate(() => {
    const ws = window.CVPortal.state.ws;
    const env = (ws.envelopes || []).find((e) => e.kind !== 'tax' && e.status === 'sent');
    const f = env && env.fields.find((x) => x.label === 'Taxpayer ID');
    return f ? f.id : '';
  });
  if (tinId) {
    await ip.waitForSelector(`.es-doc-sign input[data-fid="${tinId}"]`, { timeout: 30000 });
    await ip.fill(`.es-doc-sign input[data-fid="${tinId}"]`, SSN);
    await ip.waitForTimeout(200);
  }
  check('the investor types a full SSN in the agreement’s Taxpayer ID place', !!tinId, tinId);
  // The investor adopts a signature too, so the copy made for the co-investor must carry it again (W2's copy is re-stamped).
  const sigId = await ip.evaluate(() => {
    const ws = window.CVPortal.state.ws;
    const env = (ws.envelopes || []).find((e) => e.kind !== 'tax' && e.status === 'sent');
    const me = env && env.signers.find((s) => s.role === 'investor' && !s.co);
    const f = me && env.fields.find((x) => x.signerId === me.id && x.type === 'signature');
    return f ? f.id : '';
  });
  if (sigId) {
    await ip.click(`.es-doc-sign [data-fid="${sigId}"]`);
    await ip.waitForTimeout(300);
    if (await ip.evaluate(() => !!document.getElementById('dlg').open)) {
      await ip.click('[data-action="es-adopt"]');
      await ip.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 }).catch(() => {});
    }
  }
  await L.finishAgreement(ip);
  F.investorSigned = !!sigId;
  await F.srv.waitCompleted(inv.serverId);
  await L.importFromConsole(cp, inv.id);
  return true;
}

/* ---------- The co-investor's device ---------- */
async function coSigns(S, F, dev, link, opts) {
  opts = opts || {};
  const tag = tagOf(dev);
  const C = await L.open(S, { allow: [F.srv.base], init: F.srv.init, context: dev });
  F.closers.push(() => C.context.close());
  const p = C.page;
  const R = { C, snaps: [], texts: [] };
  p.on('response', async (res) => {
    if (res.request().method() !== 'GET' || !/\/v1\/invite$/.test(res.url().replace(/[?#].*$/, ''))) return;
    try {
      R.snaps.push(await res.json());
    } catch (e) {
      R.snaps.push({ unreadable: String(e) });
    }
  });
  if (opts.tamper) {
    await p.route('**/v1/invite/complete', async (route) => {
      let body = route.request().postData() || '';
      try {
        const b = JSON.parse(body);
        opts.tamper(b);
        R.tampered = true;
        body = JSON.stringify(b);
      } catch (e) {
        R.tamperError = String(e);
      }
      return route.continue({ postData: body });
    });
  }
  const press = async (sel) => {
    const l = p.locator(sel).first();
    await l.scrollIntoViewIfNeeded();
    if (dev.hasTouch) await l.tap();
    else await l.click();
  };
  await p.goto(link);
  await p.waitForSelector('.ivf-form h1, .ivf-msg h1', { timeout: 30000 });
  R.welcome = { h1: await p.locator('.ivf-form h1, .ivf-msg h1').first().innerText(), text: await L.screenText(p), consent: await p.locator('#ob-esignConsent').count() };
  R.texts.push(R.welcome.text);
  await p.screenshot({ path: path.join(OUT, `${tag}-co-welcome.png`), fullPage: true });
  if (!R.welcome.consent) return R;
  await press('#ob-esignConsent');
  await press('.ivf-form .ob-actions button[type=submit]');
  await p.waitForSelector('.es-doc-sign .es-page img, #es-consent-box, .ivf-done', { timeout: 30000 }).catch(() => {});
  if (await p.locator('#es-consent-box').count()) {
    R.askedTwice = true;
    await press('#es-consent-box');
    await press('[data-action="es-consent"]');
  }
  await p.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(500);
  R.agreement = await p.evaluate(() => {
    const ws = window.CVPortal.state.ws;
    const env = (ws.envelopes || [])[0] || null;
    const co = env && env.signers.find((s) => s.co);
    return {
      h1: ((document.querySelector('.ivf-form h1') || {}).innerText || '').trim(),
      mine: Array.from(document.querySelectorAll('.es-doc-sign .es-f-mine')).map((x) => x.getAttribute('data-fid') || (x.querySelector('[data-fid]') || { getAttribute: () => '' }).getAttribute('data-fid') || ''),
      env: env ? { id: env.id, status: env.status, workDocId: env.workDocId, coId: co ? co.id : '', coConsent: co ? co.consentAt || '' : '', coFields: co ? env.fields.filter((f) => f.signerId === co.id).map((f) => ({ id: f.id, type: f.type })) : [], allFields: env.fields.length } : null,
      role: window.CVPortal.state.role,
      co: !!window.CVPortal.state.co,
      text: document.body.innerText
    };
  });
  R.texts.push(R.agreement.text);
  await p.screenshot({ path: path.join(OUT, `${tag}-co-agreement.png`), fullPage: true });
  const env = R.agreement.env;
  if (!env || !env.coFields.length) return R;
  const sig = env.coFields.find((f) => f.type === 'signature');
  const nm = env.coFields.find((f) => f.type === 'name');
  if (sig) {
    await press(`.es-doc-sign [data-fid="${sig.id}"]`);
    await p.waitForTimeout(300);
    if (await p.evaluate(() => !!document.getElementById('dlg').open)) {
      await press('[data-action="es-adopt"]');
      await p.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 }).catch(() => {});
    }
  }
  const nameSel = nm ? `.es-doc-sign input[data-fid="${nm.id}"]` : '';
  if (nm && (await p.locator(nameSel).count()) && !(await p.inputValue(nameSel))) {
    if (dev.hasTouch) {
      await press(nameSel);
      await p.waitForSelector('.sf-tray:not([hidden]) .sf-tray-in', { timeout: 10000 });
      await p.fill('.sf-tray-in', opts.name);
    } else await p.fill(nameSel, opts.name);
    await p.waitForTimeout(200);
  }
  R.typedName = nm ? await p.inputValue(nameSel).catch(() => '') : '';
  if (opts.beforeFinish) await opts.beforeFinish(p);
  await press('.es-finish');
  R.doneShown = await p.waitForSelector('.ivf-done', { timeout: 40000 }).then(
    () => true,
    () => false
  );
  await p.waitForTimeout(800);
  R.done = R.doneShown ? await p.locator('.ivf-done').innerText() : await L.screenText(p);
  R.texts.push(R.done);
  await p.screenshot({ path: path.join(OUT, `${tag}-co-done.png`), fullPage: true });
  R.after = await p.evaluate(async (wid) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws || {};
    const has = async (id) => !!(await NS.ops.files.get(id).catch(() => null));
    return { envelopes: (ws.envelopes || []).length, work: wid ? await has(wid) : false, signed: wid ? await has(wid.replace(/-work$/, '-signed')) : false, token: !!(ws.invite && ws.invite.token), sentAt: !!(ws.invite && ws.invite.sentAt), keys: Object.keys(localStorage).filter((k) => /ws:/.test(k)) };
  }, env.workDocId);
  return R;
}
/** The console's own "Check now"; resolves once the co-investor's signer on the account's agreement is signed (or ms passed). */
async function consoleChecks(cp, invId, ms) {
  await L.consoleRoute(cp, 'console-investors', '[data-action=inv8-check]');
  await cp.click('[data-action=inv8-check]');
  return cp
    .waitForFunction(
      (id) => {
        const ws = window.CVPortal.state.ws;
        return (ws.envelopes || []).some((e) => e.signers.some((s) => s.investorId === id && s.co && s.status === 'signed'));
      },
      invId,
      { timeout: ms || 20000 }
    )
    .then(
      () => true,
      () => false
    );
}
/** The firm's signing view: agree, sign, give the signer's name, Finish (as signing-documents.js). */
async function firmSigns(cp, env) {
  if (await cp.locator('#es-consent-box').count()) {
    await cp.check('#es-consent-box');
    await cp.click('[data-action="es-consent"]');
  }
  await cp.waitForSelector('.es-sign-console .es-doc-sign .es-page img', { timeout: 30000 });
  await cp.click(`.es-doc-sign [data-fid="${env.sig}"]`);
  await cp.waitForTimeout(300);
  if (await cp.evaluate(() => !!document.getElementById('dlg').open)) {
    await cp.click('[data-action="es-adopt"]');
    await cp.waitForFunction(() => !document.getElementById('dlg').open);
  }
  const nameSel = `.es-doc-sign input[data-fid="${env.name}"]`;
  if (env.name && (await cp.locator(nameSel).count()) && !(await cp.inputValue(nameSel))) await cp.fill(nameSel, 'Avery Stone');
  await cp.click('.es-sign-console .es-finish');
  return cp.waitForSelector('.es-sign-console .es-done', { timeout: 30000 }).then(
    () => true,
    () => false
  );
}
async function countersign(cp, invId) {
  const x = await cp.evaluate((id) => {
    const ws = window.CVPortal.state.ws;
    const r = (ws.requests || []).filter((q) => q.investorId === id && q.type === 'subscription').pop();
    const env = r && (ws.envelopes || []).find((e) => e.id === r.envelopeId);
    const firm = env && env.signers.find((s) => s.role === 'countersigner');
    const own = (t) => (firm ? (env.fields.find((f) => f.signerId === firm.id && f.type === t) || {}).id || '' : '');
    return { rid: r ? r.id : '', sig: own('signature'), name: own('name') };
  }, invId);
  await L.consoleRoute(cp, 'console-requests', '[data-action=req-tab][data-t=all]');
  await cp.click('[data-action=req-tab][data-t=all]');
  await cp.waitForTimeout(300);
  for (let i = 0; i < 2; i++) {
    const b = `[data-action=req-approve][data-id="${x.rid}"]`;
    if (!(await cp.locator(b).count())) break;
    await cp.click(b);
    await cp.waitForTimeout(500);
  }
  const funded = `[data-action=req-funded][data-id="${x.rid}"]`;
  if (await cp.locator(funded).count()) {
    await cp.click(funded);
    await cp.waitForTimeout(900);
    if (await cp.locator('.es-sign-console').count()) return firmSigns(cp, x);
  }
  return false;
}

/* ---------- Shared checks ---------- */
/** What the co-investor received: the outbox email, the snapshot (no taxpayer number in its values) and the PDF's text. */
async function receivedChecks(check, F, st, R) {
  const si = (st.co && st.co.signIn) || {};
  const mail = await outbox(F.srv, si.serverId);
  const m = mail.find((x) => String(x.to || '').toLowerCase() === F.coMail.toLowerCase()) || null;
  F.mail = m;
  const subject = `${F.tenant.name}: sign the subscription agreement for ${F.who.title}`;
  check('the outbox holds one email for this sign-in, to the co-investor, with the subject "<firm>: sign the subscription agreement for <account>"', mail.length === 1 && !!m && m.subject === subject, mail.map((x) => ({ to: x.to, subject: x.subject, kind: x.kind })));
  const text = m ? m.text : '';
  check('its text greets the co-investor, asks them to sign as co-investor, has "Review and sign" and the link the console holds', !!m && text.indexOf(`Dear ${F.coName}`) >= 0 && /as co-investor/.test(text) && /Review and sign/.test(m.html || text) && text.indexOf(si.link) >= 0, text.slice(0, 900));
  check('the email never carries the investor’s taxpayer number', !!m && !TIN_RE.test(text) && !TIN_RE.test(m.html || ''), text.slice(0, 300));
  const snap = (R && R.snaps.find((x) => x && x.invitation)) || (await openLink(F.srv, si.link)).body || {};
  F.snap = snap;
  const tpl = (snap.esign && snap.esign.template) || {};
  const values = (tpl.fields || []).map((f) => String(f.value == null ? '' : f.value));
  check('the snapshot is a co-investor sign-in for this agreement: coSign, the envelope id, no offering, the account named', !!snap.invitation && snap.invitation.coSign === true && snap.invitation.envelopeId === st.env.id && tpl.id === st.env.id && snap.offering === null && !!snap.investor && snap.investor.title === F.who.title && snap.investor.contact === F.coName && snap.investor.email === F.coMail, { invitation: snap.invitation, investor: snap.investor, offering: snap.offering });
  check('W2: no field value in the snapshot holds a full SSN or EIN, and the SSN appears nowhere in it', !values.some((v) => TIN_RE.test(v)) && JSON.stringify(snap).indexOf(SSN) < 0 && JSON.stringify(snap).indexOf(SSN.replace(/-/g, '')) < 0, values);
  const pdf = snap.esign && snap.esign.pdf ? Buffer.from(snap.esign.pdf, 'base64') : null;
  const txt = pdf ? await pdfText(pdf).catch((e) => 'UNREADABLE ' + e.message) : '';
  const own = st.work ? await pdfText(Buffer.from(st.work, 'base64')).catch((e) => 'UNREADABLE ' + e.message) : '';
  check('the console’s own copy holds the SSN the investor typed (so the next line tests something)', own.indexOf(SSN) >= 0, own.slice(0, 300));
  const hit = txt.match(TIN_RE);
  const pics = pdf ? await pdfImages(pdf).catch(() => -1) : -1;
  const ownPics = st.work ? await pdfImages(Buffer.from(st.work, 'base64')).catch(() => -1) : -1;
  check('the copy the co-investor receives carries the investor’s adopted signature, as the console’s own copy does', F.investorSigned === true && ownPics > 0 && pics === ownPics, { investorSigned: F.investorSigned, received: pics, console: ownPics });
  check('W2: the PDF the co-investor receives has no full SSN or EIN in its text, and still shows the investor’s other values', !!pdf && !hit && !/^UNREADABLE/.test(txt) && txt.indexOf(F.who.name) >= 0, { hit: hit ? hit[0] : null, len: txt.length, sample: txt.slice(0, 200) });
  return m;
}
/** The co-investor's device from the link to done. */
function deviceChecks(check, F, st, R, dev) {
  const w = R.welcome || {};
  check('the co-investor’s link opens a welcome to the co-investor with the consent to electronic records and signatures', /^Welcome, /.test(w.h1 || '') && (w.h1 || '').indexOf(F.coFirst) >= 0 && w.consent === 1 && /Consent to electronic records and signatures/.test(w.text || '') && (w.text || '').indexOf(`sign the subscription agreement for ${F.who.title} as co-investor`) >= 0, { h1: w.h1, consent: w.consent, text: (w.text || '').slice(0, 400) });
  const a = R.agreement || {};
  const coIds = (st.env && st.env.coFields.map((f) => f.id)) || [];
  check('the agreement opens signed in as the co-investor, the consent recorded on the co-investor’s signer and not asked twice', a.h1 === 'Subscription agreement' && a.role === 'investor' && a.co === true && !!a.env && !!a.env.coConsent && !R.askedTwice, { h1: a.h1, role: a.role, co: a.co, consent: a.env && a.env.coConsent, twice: !!R.askedTwice });
  check('only the co-investor’s own places are to fill: their count equals the co-investor’s fields in the console’s envelope, and they are the same fields', !!a.env && a.mine.length === coIds.length && coIds.length === 2 && a.mine.every((x) => coIds.indexOf(x) >= 0) && a.env.allFields === coIds.length, { mine: a.mine, console: coIds, deviceFields: a.env && a.env.allFields });
  check('the co-investor signs and the done screen thanks them by name and says the signature went to the firm', R.doneShown && R.done.indexOf(`Thank you, ${F.coName}`) >= 0 && R.done.indexOf(`Your signature is recorded and sent to ${F.tenant.name}.`) >= 0, (R.done || '').slice(0, 400));
  check('after the confirmed send the device keeps no copy of the agreement (no envelope, no work or signed copy, no link token) and never held the firm’s workspace', !!R.after && R.after.envelopes === 0 && !R.after.work && !R.after.signed && !R.after.token && R.after.sentAt && R.after.keys.length === 1 && /ws:invite-/.test(R.after.keys[0]), R.after);
  const net = R.C.net;
  check('the co-investor’s device called the integration server (load, progress, complete) and nothing else outside', net.allowed.some((x) => /^GET .*\/v1\/invite$/.test(x)) && net.allowed.some((x) => /^POST .*\/v1\/invite\/complete$/.test(x)) && net.external.length === 0, { allowed: net.allowed.slice(0, 20), external: net.external });
  check('no script error on the co-investor’s device', R.C.errors.length === 0, R.C.errors);
  const lk = L.leakCheck(R.texts.join('\n'));
  check(`white label on the co-investor’s screens (${tagOf(dev)})`, lk.ok, lk.hits);
}
/** The console after it imported the co-investor's signature. */
function importChecks(check, F, before, after) {
  const e = after.env || {};
  const co = e.co || {};
  check('the console took the co-investor’s signature in: their signer is signed with their consent, signature and device, the agreement waits for the firm', co.status === 'signed' && !!co.consentAt && !!co.signedAt && co.signature && /iPhone|Mozilla/.test(co.userAgent) && e.status === 'sent' && !!e.firm && e.firm.status !== 'signed' && !!e.investor && e.investor.status === 'signed', e);
  check('the co-investor’s consent and signature are in the agreement’s events, in that order', (() => {
    const mine = (e.events || []).filter((x) => /co-investor/i.test(x.actor));
    const c = mine.findIndex((x) => x.action === 'Consent given');
    const s = mine.findIndex((x) => x.action === 'Signed');
    return c >= 0 && s > c;
  })(), (e.events || []).slice(-6));
  check('the agreement’s work copy is new (SHA-256 changed) and the change is recorded', !!after.sha && after.sha !== before.sha && after.audit.some((x) => /^Co-investor signed:/.test(x)), { before: before.sha, after: after.sha, audit: after.audit.filter((x) => /co-investor/i.test(x)).slice(-4) });
  check('every other place on the agreement is as the console held it (the investor’s values, the firm’s places)', JSON.stringify(before.env.otherFields) === JSON.stringify(e.otherFields) && before.env.signers === e.signers, { before: before.env.otherFields, after: e.otherFields });
  check('the firm has the notification that the co-investor signed', after.notes.indexOf(`${F.coName} signed the subscription agreement as co-investor`) >= 0, after.notes.slice(-5));
  check('the account investor’s record is unchanged by the co-investor’s signature', JSON.stringify(before.record) === JSON.stringify(after.record), { before: before.record && Object.keys(before.record), after: after.record && Object.keys(after.record) });
  check('no script error in the console', F.A.errors.length === 0, F.A.errors);
  check('the console called nothing outside but its integration server', F.A.net.external.length === 0, F.A.net.external);
}

/* ---------- Parts ---------- */
function cosign(dev, full) {
  const tag = tagOf(dev);
  return async ({ check, S }) => {
    const F = await firm(S, check);
    try {
      if (!F.who || !F.ready || !F.serverOn) return;
      const co = dev === IPHONE ? { first: 'Ingrid', last: 'Vasquez-Holm', email: 'ingrid.vh@example.net' } : { first: 'Theodora', last: 'Mbeki-Larsen', email: 'theodora.ml@example.net' };
      Object.assign(F, { coFirst: co.first, coName: `${co.first} ${co.last}`, coMail: co.email });
      // The co-investor is added before the investor signs: nothing waits for them yet.
      const d = await saveCo(F.cp, F.who.id, co);
      let st = await consoleState(F.cp, F.who.id);
      check('"Add co-investor" with the server connected opens the Account window, not the email to send by hand', d.open && d.record && d.h2 !== 'Co-investor sign-in email', d);
      check('the sign-in record is the server kind, with no link token of its own and nothing sent yet', !!st.co && !!st.co.signIn && st.co.signIn.token === '' && !st.co.signIn.serverId && !st.co.signIn.sentAt, st.co);
      let row = await rowOf(F.cp, F.who.id);
      await F.A.page.screenshot({ path: path.join(OUT, `${tag}-co-row-waiting.png`) });
      check(`the investors row says "Sign-in is emailed once ${F.who.name} has signed"`, row.indexOf(`Sign-in is emailed once ${F.who.name} has signed`) >= 0, row);
      check('the server holds no co-investor sign-in yet', (await F.srv.rows()).length === 0, await F.srv.rows());

      if (!(await investorSigns(S, check, F))) return;
      const made = await waitServerSignIn(F.cp, F.who.id);
      st = await consoleState(F.cp, F.who.id);
      const si = (st.co && st.co.signIn) || {};
      check('after the investor’s signed copy is imported, the agreement waits for the co-investor and the console created their sign-in on the server', made && !!si.serverId && !si.error && si.envelopeId === (st.env && st.env.id) && !!st.env && st.env.co && st.env.co.status !== 'signed' && st.env.investor.status === 'signed' && st.env.status === 'sent', { signIn: si, env: st.env && { status: st.env.status, co: st.env.co, investor: st.env.investor } });
      const rows = await F.srv.rows();
      check('the server holds the co-investor’s sign-in for that account (and the investor’s invitation, imported)', rows.some((x) => x.id === si.serverId && x.investorId === F.who.id && x.status === 'sent'), rows.map((x) => ({ id: x.id, investorId: x.investorId, status: x.status })));
      check('the record keeps the server’s id, link, email status and expiry; no link token', /^ivt_/.test(si.serverId || '') && /#invite-/.test(si.link || '') && si.token === '' && ['sent', 'outbox'].indexOf(si.emailStatus) >= 0 && !!si.sentAt && Date.parse(si.expiresAt) > Date.now(), si);
      row = await rowOf(F.cp, F.who.id);
      await F.A.page.screenshot({ path: path.join(OUT, `${tag}-co-row-sent.png`) });
      check('the investors row says when the sign-in was emailed (in the server outbox here: the check’s server has no mail settings)', emailLine(si.emailStatus).test(row), row);
      const m = await receivedChecks(check, F, st, null);
      if (!m) return;

      // The co-investor's own device, from the emailed link.
      const before = await consoleState(F.cp, F.who.id);
      const R = await coSigns(S, F, dev, si.link, { name: F.coName });
      deviceChecks(check, F, before, R, dev);
      await F.srv.waitCompleted(si.serverId).catch(() => null);
      const took = await consoleChecks(F.cp, F.who.id);
      const after = await consoleState(F.cp, F.who.id);
      check('the console’s Check now imports the co-investor’s signature', took, after.env);
      importChecks(check, F, before, after);
      const coTxt = after.work ? await pdfText(Buffer.from(after.work, 'base64')).catch(() => '') : '';
      check('the console’s new work copy carries the co-investor’s name and still the investor’s taxpayer number (the console’s copy is the record)', coTxt.indexOf(R.typedName || F.coName) >= 0 && coTxt.indexOf(SSN) >= 0, coTxt.slice(-300));
      const left = (await F.srv.rows()).find((x) => x.id === si.serverId);
      check('the console deleted the co-investor’s submission on the server after importing it', !!left && left.hasSubmission === false && left.status === 'completed', left);
      await L.consoleRoute(F.cp, 'console-envelope-' + after.env.id, '.cs-panel-head h2').catch(() => {});
      await F.A.page.screenshot({ path: path.join(OUT, `${tag}-co-envelope.png`), fullPage: true });
      row = await rowOf(F.cp, F.who.id).catch(() => '');
      if (full) {
        const ok = await countersign(F.cp, F.who.id);
        const fin = await consoleState(F.cp, F.who.id);
        await F.A.page.screenshot({ path: path.join(OUT, `${tag}-co-completed.png`), fullPage: true });
        check('the firm countersigns from Requests and the envelope reads completed', ok && fin.env.status === 'completed' && fin.env.firm.status === 'signed' && fin.env.co.status === 'signed', fin.env && { status: fin.env.status, firm: fin.env.firm, co: fin.env.co });
      }
      const lk = L.leakCheck([row, m.text || '', m.subject || ''].join('\n'));
      check('white label in the console row and the co-investor’s email', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
  };
}

/** A firm whose investor signed and was imported with no co-investor on the account; then "Add co-investor". */
async function laterSetup(S, check, co) {
  const F = await firm(S, check);
  if (!F.who || !F.ready || !F.serverOn) return F;
  Object.assign(F, { coFirst: co.first, coName: `${co.first} ${co.last}`, coMail: co.email });
  F.signed = await investorSigns(S, check, F);
  if (!F.signed) return F;
  const st0 = await consoleState(F.cp, F.who.id);
  check('before the co-investor is added: the agreement is signed by the investor, waits for the firm, has no co-investor', !!st0.env && st0.env.status === 'sent' && !st0.env.co && st0.env.investor.status === 'signed', st0.env);
  F.dialog = await saveCo(F.cp, F.who.id, co);
  F.made = await waitServerSignIn(F.cp, F.who.id);
  F.st = await consoleState(F.cp, F.who.id);
  return F;
}

const parts = {
  'cosign-desktop': cosign(DESKTOP, true),
  'cosign-phone': cosign(IPHONE, false),

  async 'cosign-later'({ check, S }) {
    const co = { first: 'Benedikt', last: 'Oyelaran', email: 'benedikt.o@example.net' };
    const F = await laterSetup(S, check, co);
    try {
      if (!F.signed) return;
      const si = (F.st.co && F.st.co.signIn) || {};
      check('"Add co-investor" after the investor signed opens the Account window, not the email to send by hand', F.dialog.open && F.dialog.record && F.dialog.h2 !== 'Co-investor sign-in email', F.dialog);
      check('the co-investor became a signer on the agreement waiting for them, and the server sign-in was created at once for it', F.made && !!F.st.env.co && F.st.env.co.status !== 'signed' && /^ivt_/.test(si.serverId || '') && si.envelopeId === F.st.env.id && !si.error, { signIn: si, co: F.st.env.co });
      const d = await dialogNow(F.cp);
      await F.A.page.screenshot({ path: path.join(OUT, 'desktop-co-later-record.png') });
      check('the Account window says when the sign-in was emailed', d.open && emailLine(si.emailStatus).test(d.text || ''), (d.text || '').slice(0, 500));
      await receivedChecks(check, F, F.st, null);
      const opened = await openLink(F.srv, si.link);
      check('the emailed link loads the co-investor’s agreement from the server', opened.status === 200 && !!opened.body && opened.body.invitation && opened.body.invitation.coSign === true && opened.body.invitation.envelopeId === F.st.env.id, { status: opened.status, invitation: opened.body && opened.body.invitation });
      check('no script error in the console', F.A.errors.length === 0, F.A.errors);
    } finally {
      await F.close();
    }
  },

  async 'cosign-change-remove'({ check, S }) {
    const co = { first: 'Marguerite', last: 'Achterberg', email: 'marguerite.a@example.net' };
    const F = await laterSetup(S, check, co);
    try {
      if (!F.signed) return;
      const first = (F.st.co && F.st.co.signIn) || {};
      check('the first sign-in was created on the server', /^ivt_/.test(first.serverId || ''), first);
      // A changed email: the old sign-in is cancelled, a new one emailed to the new address.
      const moved = co.email.replace('@', '.new@');
      await saveCo(F.cp, F.who.id, Object.assign({}, co, { email: moved }));
      await F.cp
        .waitForFunction(
          (x) => {
            const i = window.CVPortal.state.ws.investors.find((y) => y.id === x.id);
            const si = i && i.coInvestor && i.coInvestor.signIn;
            return !!(si && ((si.serverId && si.serverId !== x.old) || si.error));
          },
          { id: F.who.id, old: first.serverId },
          { timeout: 20000 }
        )
        .catch(() => {});
      const st = await consoleState(F.cp, F.who.id);
      const second = (st.co && st.co.signIn) || {};
      const oldOpen = await openLink(F.srv, first.link);
      check('the old link answers the server’s cancelled message', oldOpen.status === 410 && /This invitation was cancelled/.test((oldOpen.body && oldOpen.body.error) || ''), oldOpen);
      const rows = await F.srv.rows();
      check('the server shows the old sign-in cancelled and a new one sent', rows.some((x) => x.id === first.serverId && x.status === 'cancelled') && rows.some((x) => x.id === second.serverId && x.status === 'sent') && second.serverId !== first.serverId, rows.map((x) => ({ id: x.id, status: x.status })));
      const mail = await outbox(F.srv, second.serverId);
      check('the new sign-in is emailed to the new address', mail.length === 1 && mail[0].to === moved, mail.map((x) => ({ to: x.to, subject: x.subject })));
      check('the agreement’s co-investor signer follows the new email', !!st.env.co && st.env.co.email === moved && st.env.co.status !== 'signed', st.env.co);
      // The co-investor's device on the old link.
      const C = await L.open(S, { allow: [F.srv.base], init: F.srv.init, context: DESKTOP });
      F.closers.push(() => C.context.close());
      await C.page.goto(first.link);
      await C.page.waitForSelector('.ivf-msg h1, .ivf-form h1', { timeout: 30000 }).catch(() => {});
      const h1 = await C.page.locator('.ivf-msg h1, .ivf-form h1').first().innerText().catch(() => '');
      await C.page.screenshot({ path: path.join(OUT, 'desktop-co-old-link.png') });
      check('the device opening the old link says it no longer works', h1 === 'This invitation link no longer works', h1);
      // Removed: the new sign-in is cancelled too.
      await removeCo(F.cp, F.who.id);
      await F.cp.waitForTimeout(1500);
      const st2 = await consoleState(F.cp, F.who.id);
      const newOpen = await openLink(F.srv, second.link);
      check('"Remove co-investor" takes the co-investor off and cancels their sign-in on the server', !st2.co && newOpen.status === 410 && /This invitation was cancelled/.test((newOpen.body && newOpen.body.error) || ''), { co: st2.co, status: newOpen.status, body: newOpen.body });
      check('the change and the removal are in the audit log', st2.audit.some((x) => /^Co-investor sign-in cancelled:/.test(x)) && st2.audit.filter((x) => /^Co-investor sign-in cancelled:/.test(x)).length >= 2, st2.audit.filter((x) => /co-investor/i.test(x)).slice(-6));
      check('no script error in the console or on the device', F.A.errors.length === 0 && C.errors.length === 0, F.A.errors.concat(C.errors));
    } finally {
      await F.close();
    }
  },

  async 'cosign-forged'({ check, S }) {
    const co = { first: 'Oluwaseun', last: 'Brightwater', email: 'oluwaseun.b@example.net' };
    const F = await laterSetup(S, check, co);
    try {
      if (!F.signed) return;
      const si = (F.st.co && F.st.co.signIn) || {};
      if (!si.serverId) return check('the sign-in was created on the server', false, si);
      const before = await consoleState(F.cp, F.who.id);
      const firmId = before.env.firm && before.env.firm.id;
      const invSignerId = before.env.investor && before.env.investor.id;
      const otherIds = before.env.otherFields.map((f) => f.id);
      // The tampered device: the completion it sends also changes the investor's and the firm's places, marks the firm
      // signed, renames the investor, adds a signer and a field, and calls the agreement completed.
      const forge = (env) => {
        env.fields.forEach((f) => otherIds.indexOf(f.id) >= 0 && (f.value = f.type === 'checkbox' ? true : 'FORGED 9,999,999'));
        otherIds.forEach((id) => !env.fields.some((f) => f.id === id) && env.fields.push({ id, signerId: invSignerId, type: 'text', page: 1, x: 0.1, y: 0.1, w: 0.2, h: 0.02, value: 'FORGED 9,999,999' }));
        env.signers.forEach((s) => {
          if (s.id === firmId) Object.assign(s, { status: 'signed', signedAt: new Date().toISOString() });
          if (s.id === invSignerId) s.name = 'Forged Name';
        });
        env.signers.push({ id: 'sg-forged', investorId: F.who.id, name: 'Extra Signer', email: 'x@example.net', role: 'investor', status: 'signed', order: 9 });
        env.fields.push({ id: 'fd-forged', signerId: 'sg-forged', type: 'text', page: 1, x: 0.1, y: 0.2, w: 0.2, h: 0.02, value: 'FORGED' });
        env.status = 'completed';
      };
      const R = await coSigns(S, F, DESKTOP, si.link, { name: F.coName, tamper: (b) => b.envelope && forge(b.envelope) });
      check('the tampered device sent its forged completion (the server took it)', R.tampered === true && R.doneShown, { tampered: R.tampered, error: R.tamperError, done: (R.done || '').slice(0, 200) });
      await F.srv.waitCompleted(si.serverId).catch(() => null);
      // A store between the device and the console altered the same way (the console does not rely on the server's filter).
      const stored = F.srv.alter(si.serverId, (sub) => sub.envelope && forge(sub.envelope));
      const took = await consoleChecks(F.cp, F.who.id);
      const after = await consoleState(F.cp, F.who.id);
      check('the console takes the co-investor’s signature from the forged submission', took && after.env.co.status === 'signed', after.env && after.env.co);
      check('the investor’s and the firm’s places keep the console’s values; no field or signer was added', JSON.stringify(after.env.otherFields) === JSON.stringify(before.env.otherFields) && JSON.stringify(after.env.fieldIds) === JSON.stringify(before.env.fieldIds) && after.env.signers === before.env.signers, { before: before.env.otherFields, after: after.env.otherFields });
      check('the firm is not marked signed, the investor keeps their name, the agreement still waits for the firm', after.env.firm.status !== 'signed' && after.env.investor.name === before.env.investor.name && after.env.status === 'sent', { firm: after.env.firm, investor: after.env.investor, status: after.env.status });
      // The same submission again: the co-investor already signed.
      const replay = async () => {
        F.srv.server.store.put('invitations', { id: si.serverId, status: 'completed', hasSubmission: true, submission: { plain: JSON.parse(JSON.stringify(stored)) } });
        await L.consoleRoute(F.cp, 'console-investors', '[data-action=inv8-check]');
        await F.cp.click('[data-action=inv8-check]');
        await F.cp.waitForTimeout(2500);
        return consoleState(F.cp, F.who.id);
      };
      const r1 = await replay();
      const said1 = r1.audit.filter((x) => /^Co-investor signature not used:/.test(x));
      check('the same submission arriving again changes nothing: the co-investor already signed, and an audit line says so', said1.length === 1 && /already signed/.test(said1[0]) && JSON.stringify(r1.env) === JSON.stringify(after.env) && r1.sha === after.sha, { said: said1, same: JSON.stringify(r1.env) === JSON.stringify(after.env) });
      const left1 = (await F.srv.rows()).find((x) => x.id === si.serverId);
      check('the refused submission is deleted on the server too', !!left1 && left1.hasSubmission === false, left1);
      // The firm voids the agreement; the submission arrives once more.
      await F.cp.evaluate((id) => {
        const NS = window.CVPortal;
        NS.esign.void(NS.state.ws, id, 'Replaced by a new agreement');
        NS.app.save(true);
      }, after.env.id);
      const voided = await consoleState(F.cp, F.who.id);
      const r2 = await replay();
      const said2 = r2.audit.filter((x) => /^Co-investor signature not used:/.test(x));
      check('after the firm voided the agreement, the submission changes nothing and the audit line says it is no longer out for signature', said2.length === 2 && /no longer out for signature/.test(said2[1]) && JSON.stringify(r2.env) === JSON.stringify(voided.env), { said: said2, status: r2.env && r2.env.status });
      check('no script error in the console', F.A.errors.length === 0, F.A.errors);
    } finally {
      await F.close();
    }
  }
};

L.runParts(parts, { name: 'CO-INVESTOR SERVER', browser: true });
