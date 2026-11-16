#!/usr/bin/env node
// Plan 06-30 (owner, published preview: "it says failed to fetch when trying to go to the tax form, where it says its been
// pre filled the screen doesent work, error message failed to fetch"). The artifact host shows the portal in a sandboxed
// iframe whose content security policy lets scripts load (same origin and the two CDNs) but refuses every fetch()/XHR.
// Each part loads the portal in such a frame (connect-src 'none'), proves the frame really refuses a fetch, walks an invited
// investor to the tax step, presses "Continue to the form", and requires the signing view to open with the filled official
// form (pages drawn, no error on screen, no refused connection, the form's Unicode font embedded, no field left); then signs
// and finishes it and requires the next step, with the signed copy's text written in the embedded Unicode fonts (regular and
// bold), not the picture fallback. Every name has a letter the standard PDF fonts lack (Ł), so the Unicode fonts are needed.
//   w9      a U.S. individual: Form W-9
//   w8ben   a foreign individual living in Germany: Form W-8BEN
//   w8bene  a Cayman Islands corporation, Active NFFE: Form W-8BEN-E
//   NODE_PATH=$(npm root -g) node no-network.js [--only w9,w8ben,w8bene]
// The last line is "NO NETWORK: PASS (parts run: N)" or "NO NETWORK: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const Lib = require('./lib.js');

const OUT = path.join(Lib.OUT, 'no-network');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-signing\.png$/, 'The tax step after "Continue to the form" in a frame that refuses every fetch: the filled official form, ready to sign.'],
  [/-error\.png$/, 'The tax step after "Continue to the form" when the form could not be built: the error on screen.']
]);

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const CSP = "connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";

/** A fresh desktop context whose page holds the portal in a sandboxed iframe served with CSP; resolves to { A, fr }. */
async function framed(S) {
  const A = await Lib.open(S, { context: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, acceptDownloads: true } });
  // every refused request, in every frame, kept where the check can read it
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await A.context.route(
    (u) => u.origin === S.origin && u.pathname === '/diy.html',
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CSP }, body: fs.readFileSync(path.join(Lib.ROOT, 'diy.html')) })
  );
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${S.base}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  return { A, fr };
}

/** The frame refuses a fetch of a file that is there (the check's own proof that the policy is in force). */
async function proveRefused(check, A, fr) {
  const r = await fr.evaluate(() =>
    fetch('assets/forms/SHA256SUMS', { cache: 'no-store' }).then(
      (x) => 'fetched ' + x.status,
      (e) => 'refused: ' + String(e && e.message)
    )
  );
  check('the frame refuses fetch() (connect-src none is in force)', /^refused/.test(r), r);
  await fr.evaluate(() => (window.__cspv = []));
  A.errors.length = 0;
}

/** Continue to the form, then wait for the signing view or an error on screen; resolves to what the screen shows. */
async function continueToForm(fr) {
  await fr.click('.ivf-form .ob-actions button[type=submit]');
  await fr
    .waitForFunction(() => document.querySelector('.ivf-tax-sign .es-doc-sign .es-page img') || /failed to fetch|could not|not available|try again/i.test(document.body.innerText), null, { timeout: 60000 })
    .catch(() => {});
  await fr.waitForTimeout(800);
  return fr.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/[^\n]*(failed to fetch|could not|not available|try again)[^\n]*/i);
    return {
      signing: !!document.querySelector('.ivf-tax-sign'),
      pages: Array.from(document.querySelectorAll('.ivf-tax-sign .es-doc-sign .es-page img')).filter((i) => i.complete && i.naturalWidth > 0).length,
      error: m ? m[0].trim().slice(0, 200) : '',
      h1: (document.querySelector('.ivf-form h1') || {}).innerText || ''
    };
  });
}

/** The flow's tax envelope: its filled file and (once finished) its signed copy, each read with the page's PDF writer. */
async function readTaxFiles(fr, invId) {
  return fr.evaluate(async (invId) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const i = ws.investors.find((x) => x.id === invId);
    const env = (ws.envelopes || []).find((e) => e.id === ((i.onboarding || {}).flow || {}).taxEnvelopeId) || (ws.envelopes || []).filter((e) => e.kind === 'tax' && e.signers.some((s) => s.investorId === invId)).pop();
    if (!env) return { env: null };
    const L = window.PDFLib;
    const look = async (blob) => {
      if (!blob) return null;
      const u8 = new Uint8Array(await blob.arrayBuffer());
      const pdf = await L.PDFDocument.load(u8, { ignoreEncryption: true });
      const fonts = [];
      pdf.context.enumerateIndirectObjects().forEach(([, obj]) => {
        if (!(obj instanceof L.PDFDict)) return;
        const t = obj.get(L.PDFName.of('Type'));
        const b = obj.get(L.PDFName.of('BaseFont'));
        if (t && String(t) === '/Font' && b) fonts.push(String(b).replace(/^\/[A-Z]{6}\+/, '/'));
      });
      let fields = -1;
      try {
        fields = pdf.getForm().getFields().length;
      } catch (e) {
        fields = 0;
      }
      return { bytes: u8.length, head: String.fromCharCode.apply(null, u8.slice(0, 5)), pages: pdf.getPageCount(), fields, fonts: Array.from(new Set(fonts)).sort() };
    };
    const doc = (ws.docs || []).find((d) => d.envelopeId === env.id);
    return {
      env: { id: env.id, kind: env.kind, form: env.taxForm && env.taxForm.form, status: env.status },
      filled: await look(env.docId ? await NS.ops.files.get(env.docId) : null),
      signed: await look(doc ? await NS.ops.files.get(doc.id) : null),
      sigFid: ((env.fields || []).find((f) => f.type === 'signature') || {}).id || ''
    };
  }, invId);
}

/** Consent (if asked) and the signature adopted on the tax form, as the investor does it. */
async function sign(fr, sigFid) {
  if (await fr.locator('#es-consent-box').count()) {
    await fr.check('#es-consent-box');
    await fr.click('[data-action="es-consent"]');
    await fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 30000 });
  }
  await fr.locator(`.es-doc-sign [data-fid="${sigFid}"]`).scrollIntoViewIfNeeded();
  await fr.click(`.es-doc-sign [data-fid="${sigFid}"]`);
  await fr.waitForTimeout(300);
  if (await fr.evaluate(() => !!(document.getElementById('dlg') || {}).open)) {
    await fr.click('[data-action="es-adopt"]');
    await fr.waitForFunction(() => !document.getElementById('dlg').open);
  }
}

/**
 * One investor, end to end in the refusing frame. spec: { id, form, name, email, type, account, onInfo(fr, hd), atTax(fr) }.
 */
function part(spec) {
  return async ({ check, S }) => {
    const { A, fr } = await framed(S);
    await proveRefused(check, A, fr);
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    const inv = await Lib.createInvitation(fr, { name: spec.name, email: spec.email, type: spec.type, account: spec.account || '', offeringId: portal.offeringId });
    if (spec.taxType)
      await fr.evaluate(
        ({ id, t }) => {
          const NS = window.CVPortal;
          NS.state.ws.investors.find((x) => x.id === id).taxType = t;
          NS.app.save(true);
        },
        { id: inv.investorId, t: spec.taxType }
      );
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    const w = await Lib.walk(fr, { name: spec.name, acc: 'yes', basis: 0, until: /Tax certification/, onFilled: (hd) => (spec.onInfo ? spec.onInfo(fr, hd) : null) });
    check(`the investor reaches the tax step (${spec.form})`, w.reached && w.at === 'Tax certification' && w.errors.length === 0, { seen: w.seen, errors: w.errors });
    if (!w.reached) return A.context.close();
    if (spec.atTax) await spec.atTax(fr);
    const btn = await fr.locator('.ivf-form button[type=submit]').innerText();
    check('the button goes to the form', /Continue to the form/.test(btn), btn);
    const v = await continueToForm(fr);
    await A.page.screenshot({ path: path.join(OUT, `${spec.id}-${v.signing && v.pages ? 'signing' : 'error'}.png`), fullPage: false });
    check(`Continue opens the signing view with the filled ${spec.form} drawn in the page and no error on screen`, v.signing && v.pages >= 1 && !v.error, v);
    const files = await readTaxFiles(fr, inv.investorId);
    check(`the filled ${spec.form} is a PDF with no form field left, written in the embedded Unicode font`, !!files.filled && files.filled.head === '%PDF-' && files.filled.fields === 0 && files.filled.fonts.some((f) => /^\/DejaVuSans(-\d+)?$/.test(f)) && !!files.env && files.env.form === spec.form, { env: files.env, filled: files.filled });
    if (v.signing && v.pages && files.sigFid) {
      await sign(fr, files.sigFid);
      await Lib.finishTaxForm(fr);
      const next = await Lib.heading(fr);
      check('finishing the signed form moves on to the next step', next === 'Distribution payments', next);
      const after = await readTaxFiles(fr, inv.investorId);
      check(`the signed ${spec.form} is stored and its added text uses the embedded Unicode fonts, regular and bold`, !!after.signed && after.signed.head === '%PDF-' && after.signed.fonts.some((f) => /^\/DejaVuSans(-\d+)?$/.test(f)) && after.signed.fonts.some((f) => /^\/DejaVuSans-Bold(-\d+)?$/.test(f)), { env: after.env, signed: after.signed });
    } else check(`the ${spec.form} could be signed and finished`, false, 'the signing view never opened');
    const refused = await fr.evaluate(() => window.__cspv.slice());
    check('no fetch or XHR was attempted (no refused connection) on the whole way', refused.length === 0, refused);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

const PARTS = {
  w9: part({ id: 'w9', form: 'W-9', name: 'Łucja Brennan-Okafor', email: 'lucja.brennan@example.com', type: 'individual' }),
  w8ben: part({
    id: 'w8ben',
    form: 'W-8BEN',
    name: 'Zoë Müller-Łukasz',
    email: 'zoe.muller.nn@example.com',
    type: 'individual',
    taxType: 'foreign-individual',
    async onInfo(fr, hd) {
      if (!/Investor information/.test(hd)) return;
      await fr.selectOption('#ob-country', 'Germany');
      await fr.waitForTimeout(200);
      if (await fr.locator('input[name="ob-citizen"][value="other"]').count()) await fr.check('input[name="ob-citizen"][value="other"]');
      await fr.fill('#ob-street', 'Königsallee 27');
      await fr.fill('#ob-city', 'Düsseldorf');
      await fr.fill('#ob-st', '');
      await fr.fill('#ob-zip', '40212');
    },
    async atTax(fr) {
      if (await fr.locator('#ob-w8Citizen').count()) {
        if (!(await fr.locator('#ob-w8Citizen').inputValue())) await fr.selectOption('#ob-w8Citizen', 'Germany');
      }
      await fr.fill('#ob-ftin', '12345678901');
    }
  }),
  w8bene: part({
    id: 'w8bene',
    form: 'W-8BEN-E',
    name: 'Łukasz Lindqvist-Barros',
    email: 'lukasz.lindqvist@example.com',
    type: 'foreign-entity',
    account: 'Coral Reef Capital Ltd.',
    async onInfo(fr, hd) {
      if (!/Investor information/.test(hd)) return;
      await fr.selectOption('#ob-country', 'Cayman Islands');
      await fr.waitForTimeout(200);
      await fr.fill('#ob-street', '94 Solaris Avenue');
      await fr.fill('#ob-city', 'Camana Bay');
      await fr.fill('#ob-st', 'Grand Cayman');
      await fr.fill('#ob-zip', 'KY1-1108');
      await fr.fill('#ob-formation', 'Cayman Islands');
      await fr.fill('#ob-tin', '');
    },
    async atTax(fr) {
      await fr.check('input[name="ob-e8Ch3"][value="corporation"]');
      await fr.waitForTimeout(200);
      await fr.check('input[name="ob-e8Ch4"][value="activeNffe"]');
      await fr.waitForTimeout(200);
      await fr.fill('#ob-ftin', 'KY48213907');
    }
  })
};

Lib.runParts(PARTS, { name: 'NO NETWORK', browser: true });
