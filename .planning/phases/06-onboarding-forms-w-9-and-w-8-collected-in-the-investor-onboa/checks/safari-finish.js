#!/usr/bin/env node
// Debug session finish-notfound-safari (owner, published preview build 16: "It doesent work after you sign the w-9 then
// click finish it says object cannot be found here"). "The object can not be found here." is Safari's (WebKit's) text for a
// DOMException NotFoundError with no message of its own: what Safari gives when it cannot read a file it kept in IndexedDB
// (the data behind a stored Blob is gone), which Finish does to the document it signs. WebKit cannot be installed on this
// machine, so each part makes Chromium behave that way inside the artifact host's sandboxed frame (same sandbox and
// content security policy as no-network.js), signs, presses Finish, and requires the flow to move on with the signed form
// kept, no error on screen and no uncaught error. Each part first proves the condition is in force in the frame.
//   w9-lost         from Finish on, every Blob that comes out of IndexedDB cannot be read (NotFoundError, Safari's text)
//   w9-throws       from Finish on, IndexedDB's transaction() throws NotFoundError (the store "cannot be found")
//   w9-noidb        the frame has no IndexedDB at all (open throws SecurityError) from the start
//   agreement-lost  the subscription agreement's Finish (same path) with the condition of w9-lost
//   iphone-*        the same on the owner's device as Chromium can stand in for it: an iPhone in the Claude app (390x844
//                   viewport, touch, iOS user agent), with the signature, Adopt and Finish tapped
//   NODE_PATH=$(npm root -g) node safari-finish.js [--only w9-lost,...]
// The last line is "SAFARI FINISH: PASS (parts run: N)" or "SAFARI FINISH: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');

const OUT = path.join(Lib.OUT, 'safari-finish');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([[/-after\.png$/, 'The screen after Finish under the simulated Safari condition (the next step, or the error left on screen).']]);

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const CSP = "connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";
const SAFARI_TEXT = /can ?not be found|NotFoundError/i;

/**
 * Runs before the page's own scripts in every frame. mode: 'lost' | 'throws' | 'noidb'. window.__sim.on switches 'lost' and
 * 'throws' on (the check sets it just before Finish: the form was stored and drawn normally, as the owner saw it).
 */
function simulate(mode) {
  const NF = () => new DOMException('The object can not be found here.', 'NotFoundError');
  const sim = (window.__sim = { mode, on: mode === 'noidb', hits: [], unhandled: [] });
  window.addEventListener('unhandledrejection', (e) => sim.unhandled.push(String(e.reason && (e.reason.name + ': ' + e.reason.message))));
  window.addEventListener('error', (e) => sim.unhandled.push('error: ' + String(e.message)));
  // every toast as it appears (a toast is gone after about four seconds)
  sim.toasts = [];
  new MutationObserver((list) =>
    list.forEach((m) => m.target && m.target.id === 'toasts' && m.addedNodes.forEach((n) => sim.toasts.push(String(n.textContent || '').trim())))
  ).observe(document, { childList: true, subtree: true });
  const OrigBlob = window.Blob;
  const kept = new WeakSet(); // Blobs that came out of IndexedDB (and anything made from them)
  const dead = (b) => sim.on && sim.mode === 'lost' && b && kept.has(b);
  const d = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'result');
  Object.defineProperty(IDBRequest.prototype, 'result', {
    configurable: true,
    enumerable: d.enumerable,
    get() {
      const v = d.get.call(this);
      if (v instanceof OrigBlob) kept.add(v);
      else if (v && typeof v === 'object') Object.keys(v).forEach((k) => v[k] instanceof OrigBlob && kept.add(v[k]));
      return v;
    }
  });
  ['arrayBuffer', 'text', 'bytes'].forEach((k) => {
    const f = OrigBlob.prototype[k];
    if (!f) return;
    OrigBlob.prototype[k] = function () {
      if (dead(this)) {
        sim.hits.push('blob.' + k);
        return Promise.reject(NF());
      }
      return f.apply(this, arguments);
    };
  });
  const slice = OrigBlob.prototype.slice;
  OrigBlob.prototype.slice = function () {
    const r = slice.apply(this, arguments);
    if (kept.has(this)) kept.add(r);
    return r;
  };
  const stream = OrigBlob.prototype.stream;
  OrigBlob.prototype.stream = function () {
    if (dead(this)) {
      sim.hits.push('blob.stream');
      return new ReadableStream({ start: (c) => c.error(NF()) });
    }
    return stream.apply(this, arguments);
  };
  function Blob(parts, opts) {
    const b = new OrigBlob(parts, opts);
    if (Array.isArray(parts) && parts.some((p) => kept.has(p))) kept.add(b);
    return b;
  }
  Blob.prototype = OrigBlob.prototype;
  window.Blob = Blob;
  ['readAsArrayBuffer', 'readAsDataURL', 'readAsText', 'readAsBinaryString'].forEach((k) => {
    const f = FileReader.prototype[k];
    FileReader.prototype[k] = function (b) {
      if (!dead(b)) return f.apply(this, arguments);
      sim.hits.push('FileReader.' + k);
      const r = this;
      Object.defineProperty(r, 'error', { configurable: true, value: NF() });
      setTimeout(() => {
        r.dispatchEvent(new ProgressEvent('error'));
        r.dispatchEvent(new ProgressEvent('loadend'));
      }, 0);
    };
  });
  const tr = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function () {
    if (sim.on && sim.mode === 'throws') {
      sim.hits.push('transaction');
      throw NF();
    }
    return tr.apply(this, arguments);
  };
  const op = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function () {
    if (sim.mode === 'noidb') {
      sim.hits.push('open');
      throw new DOMException('IDBFactory.open() called in an invalid security context', 'SecurityError');
    }
    return op.apply(this, arguments);
  };
}

const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, acceptDownloads: true };
const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};
/** A fresh context (dev: DESKTOP or IPHONE) whose page holds the portal in the host's sandboxed iframe, the condition installed in it. */
async function framed(S, mode, dev) {
  const A = await Lib.open(S, { context: dev || DESKTOP });
  await A.context.addInitScript(simulate, mode);
  await A.context.route(
    (u) => u.origin === S.origin && u.pathname === '/diy.html',
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CSP }, body: fs.readFileSync(path.join(Lib.ROOT, 'diy.html')) })
  );
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${S.base}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  return { A, fr };
}

/** Switch the condition on in the frame and prove it holds there, with IndexedDB used directly (not the portal's code). */
async function switchOn(check, fr, mode, dev) {
  const r = await fr.evaluate(async (mode) => {
    window.__sim.on = true;
    window.__sim.toasts.length = 0;
    const inFrame = window.top !== window && !!window.frameElement && /allow-scripts/.test(window.frameElement.getAttribute('sandbox') || '');
    const width = window.innerWidth;
    const open = () =>
      new Promise((res, rej) => {
        const q = indexedDB.open('sim-probe', 1);
        q.onupgradeneeded = () => q.result.createObjectStore('s');
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      });
    try {
      if (mode === 'noidb') {
        try {
          indexedDB.open('sim-probe', 1);
          return { inFrame, width, held: false, how: 'open did not throw' };
        } catch (e) {
          return { inFrame, width, held: e.name === 'SecurityError', how: e.name };
        }
      }
      if (mode === 'throws') {
        window.__sim.on = false;
        const db = await open();
        window.__sim.on = true;
        try {
          db.transaction('s', 'readonly');
          return { inFrame, width, held: false, how: 'transaction did not throw' };
        } catch (e) {
          return { inFrame, width, held: e.name === 'NotFoundError' && e.message === 'The object can not be found here.', how: `${e.name}: ${e.message}` };
        } finally {
          db.close();
        }
      }
      const db = await open();
      await new Promise((res, rej) => {
        const t = db.transaction('s', 'readwrite');
        t.objectStore('s').put(new Blob(['probe']), 'k');
        t.oncomplete = res;
        t.onerror = () => rej(t.error);
      });
      const b = await new Promise((res, rej) => {
        const q = db.transaction('s', 'readonly').objectStore('s').get('k');
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      });
      db.close();
      try {
        await b.arrayBuffer();
        return { inFrame, width, held: false, how: 'a Blob read back from IndexedDB was readable' };
      } catch (e) {
        return { inFrame, width, held: e.name === 'NotFoundError' && e.message === 'The object can not be found here.', how: `${e.name}: ${e.message}` };
      } finally {
        window.__sim.hits.length = 0;
      }
    } catch (e) {
      return { inFrame, width, held: false, how: 'probe failed: ' + (e && e.message) };
    }
  }, mode);
  check(`the portal runs in a sandboxed frame and the simulated condition (${mode}) is in force there`, r.inFrame && r.held, r);
  if (dev === IPHONE) check('the frame is the iPhone screen width (390 CSS pixels)', r.width === 390, r.width);
  return r.inFrame && r.held;
}

/** The flow's tax envelope, its Documents entry and the signed copy as the page can read it now. */
async function taxState(fr, invId) {
  return fr.evaluate(async (invId) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const i = ws.investors.find((x) => x.id === invId);
    const env = (ws.envelopes || []).filter((e) => e.kind === 'tax' && e.signers.some((s) => s.investorId === invId)).pop();
    const doc = env ? (ws.docs || []).find((d) => d.envelopeId === env.id) : null;
    let signed = null;
    if (doc) {
      try {
        const b = await NS.ops.files.get(doc.id);
        const u8 = b ? new Uint8Array(await b.arrayBuffer()) : null;
        signed = u8 ? { bytes: u8.length, head: String.fromCharCode.apply(null, u8.slice(0, 5)) } : { missing: true };
      } catch (e) {
        signed = { error: `${e && e.name}: ${e && e.message}` };
      }
    }
    return { env: env ? { id: env.id, status: env.status, sigFid: ((env.fields || []).find((f) => f.type === 'signature') || {}).id || '' } : null, doc: doc ? doc.id : '', signed, taxCert: i.taxCert || null };
  }, invId);
}

/** Press a control: tapped on a touch device (dev.hasTouch), clicked otherwise. */
async function press(fr, dev, sel) {
  const l = fr.locator(sel).first();
  await l.scrollIntoViewIfNeeded();
  if (dev && dev.hasTouch) await l.tap();
  else await l.click();
}

async function signTax(fr, sigFid, dev) {
  if (await fr.locator('#es-consent-box').count()) {
    await fr.check('#es-consent-box');
    await press(fr, dev, '[data-action="es-consent"]');
    await fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 30000 });
  }
  await press(fr, dev, `.es-doc-sign [data-fid="${sigFid}"]`);
  await fr.waitForTimeout(300);
  if (await fr.evaluate(() => !!(document.getElementById('dlg') || {}).open)) {
    await press(fr, dev, '[data-action="es-adopt"]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open);
  }
}

/** The screen after Finish: every toast shown since the condition was switched on, the page text, and a Finish still busy. */
const screenAfter = (fr) =>
  fr.evaluate(() => ({
    toasts: window.__sim.toasts.filter(Boolean),
    body: document.body.innerText,
    busy: !!document.querySelector('.es-finish[disabled]')
  }));

async function invited(check, S, mode, name, email, dev) {
  const { A, fr } = await framed(S, mode, dev);
  const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
  const inv = await Lib.createInvitation(fr, { name, email, type: 'individual', account: '', offeringId: portal.offeringId });
  await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
  return { A, fr, inv };
}

/** The W-9, signed and finished under the condition (switched on just before Finish unless it holds from the start). */
function w9Part(mode, dev) {
  const tag = (dev === IPHONE ? 'iphone-' : '') + mode;
  return async ({ check, S }) => {
    const name = 'Avery Lindgren-Shaw';
    const { A, fr, inv } = await invited(check, S, mode, name, 'avery.lindgren@example.com', dev);
    const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0, until: /Tax certification/ });
    check('the investor reaches the tax step', w.reached && w.at === 'Tax certification', w.seen);
    if (!w.reached) return A.context.close();
    await fr.click('.ivf-form .ob-actions button[type=submit]');
    await fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 }).catch(() => {});
    const st0 = await taxState(fr, inv.investorId);
    check('the signing view opens with the filled W-9 drawn', (await fr.locator('.ivf-tax-sign .es-doc-sign .es-page img').count()) >= 1 && !!(st0.env && st0.env.sigFid), st0.env);
    if (!(st0.env && st0.env.sigFid)) return A.context.close();
    await signTax(fr, st0.env.sigFid, dev);
    if (mode !== 'noidb' && !(await switchOn(check, fr, mode, dev))) return A.context.close();
    if (mode === 'noidb') await switchOn(check, fr, mode, dev);
    const before = await Lib.heading(fr);
    await press(fr, dev, '.ivf-tax-sign .es-finish');
    const moved = await fr
      .waitForFunction((hd) => {
        const h = document.querySelector('.ivf-form h1');
        return h && h.innerText !== hd;
      }, before, { timeout: 30000 })
      .then(() => true, () => false);
    await fr.waitForTimeout(400);
    const sc = await screenAfter(fr);
    await A.page.screenshot({ path: path.join(OUT, `${tag}-w9-after.png`), fullPage: false });
    const next = await Lib.heading(fr);
    check('Finish moves on to the next step (Distribution payments)', moved && next === 'Distribution payments', { next, toasts: sc.toasts, busy: sc.busy });
    check('no "The object can not be found here." (or any NotFoundError) on screen', !SAFARI_TEXT.test(sc.body) && !sc.toasts.some((t) => SAFARI_TEXT.test(t)), sc.toasts);
    const st = await taxState(fr, inv.investorId);
    check('the W-9 is recorded as signed by the investor', !!st.taxCert && st.taxCert.form === 'W-9' && st.taxCert.signed === true && st.env && st.env.status === 'completed', { taxCert: st.taxCert, env: st.env });
    check('the signed W-9 is kept: its Documents entry opens as a PDF', !!st.doc && !!st.signed && st.signed.head === '%PDF-' && st.signed.bytes > 1000, { doc: st.doc, signed: st.signed });
    const sim = await fr.evaluate(() => ({ unhandled: window.__sim.unhandled.slice(), hits: window.__sim.hits.slice() }));
    check('no uncaught error or unhandled rejection in the frame', sim.unhandled.length === 0 && A.errors.length === 0, { unhandled: sim.unhandled, console: A.errors, simHits: sim.hits });
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

/** The subscription agreement's Finish (the same finishSigning path) with the data behind IndexedDB's Blobs lost at Finish. */
const agreementLost = (dev) => async ({ check, S }) => {
  const name = 'Rowan Achterberg-Lowe';
  const { A, fr, inv } = await invited(check, S, 'lost', name, 'rowan.achterberg@example.com', dev);
  const w = await Lib.walk(fr, { name, acc: 'yes', basis: 0 });
  check('the investor reaches the subscription agreement', w.reached, w.seen);
  if (!w.reached) return A.context.close();
  await fr.waitForSelector('.es-finish', { timeout: 30000 });
  if (!(await switchOn(check, fr, 'lost', dev))) return A.context.close();
  await press(fr, dev, '.es-finish');
  const done = await fr.waitForSelector('.ivf-done .ivf-need, .ivf-done .ivf-summary', { timeout: 30000 }).then(() => true, () => false);
  await fr.waitForTimeout(400);
  const sc = await screenAfter(fr);
  await A.page.screenshot({ path: path.join(OUT, `${dev === IPHONE ? 'iphone-' : ''}lost-agreement-after.png`), fullPage: false });
  check('Finish on the agreement reaches the done screen', done, { toasts: sc.toasts, busy: sc.busy });
  check('no "The object can not be found here." (or any NotFoundError) on screen', !SAFARI_TEXT.test(sc.body) && !sc.toasts.some((t) => SAFARI_TEXT.test(t)), sc.toasts);
  const st = await fr.evaluate(async (invId) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const env = (ws.envelopes || []).filter((e) => e.kind !== 'tax' && e.signers.some((s) => s.investorId === invId)).pop();
    if (!env) return { env: null };
    const me = env.signers.find((s) => s.investorId === invId);
    const id = env.status === 'completed' ? env.signedDocId : env.workDocId;
    let file = null;
    try {
      const b = id ? await NS.ops.files.get(id) : null;
      const u8 = b ? new Uint8Array(await b.arrayBuffer()) : null;
      file = u8 ? { id, bytes: u8.length, head: String.fromCharCode.apply(null, u8.slice(0, 5)) } : { id, missing: true };
    } catch (e) {
      file = { id, error: `${e && e.name}: ${e && e.message}` };
    }
    return { env: { status: env.status, signer: me && me.status }, file };
  }, inv.investorId);
  check('the investor’s signature is recorded and the signed agreement is kept (opens as a PDF)', !!st.env && st.env.signer === 'signed' && !!st.file && st.file.head === '%PDF-' && st.file.bytes > 1000, st);
  const sim = await fr.evaluate(() => ({ unhandled: window.__sim.unhandled.slice(), hits: window.__sim.hits.slice() }));
  check('no uncaught error or unhandled rejection in the frame', sim.unhandled.length === 0 && A.errors.length === 0, { unhandled: sim.unhandled, console: A.errors, simHits: sim.hits });
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
};

const PARTS = {
  'w9-lost': w9Part('lost', DESKTOP),
  'agreement-lost': agreementLost(DESKTOP),
  'iphone-w9-lost': w9Part('lost', IPHONE),
  'iphone-w9-throws': w9Part('throws', IPHONE),
  'iphone-w9-noidb': w9Part('noidb', IPHONE),
  'iphone-agreement-lost': agreementLost(IPHONE)
};

// Run as a check; required by another check (signing-documents.js), it lends the host's frame and the simulations.
if (require.main === module) Lib.runParts(PARTS, { name: 'SAFARI FINISH', browser: true });
else module.exports = { simulate, framed, press, DESKTOP, IPHONE };
