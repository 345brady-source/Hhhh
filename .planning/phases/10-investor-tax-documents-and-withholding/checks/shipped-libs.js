// gate: browser
// last "SHIPPED LIBS: PASS (parts run: 5)"
// The PDF libraries shipped in the repository (plan 10-03, F-6): the reader and its worker (assets/vendor/pdfview), the
// writer and the font embedder (assets/vendor/pdfwrite), byte for byte the published files of the versions the portal
// already ran from two outside hosts, pinned by SHA-256, loaded first by assets/js/esign.js.
//   pins        no browser: each shipped file's SHA-256 equals its SHA256SUMS line and the constant below; each licence
//               file is there with its licence's opening words; each SOURCE.txt names its package and version
//   view-phone  390x844 with touch, in a sandboxed frame that may load scripts from the portal's own address only and has
//               every request to the two outside hosts refused: an admin of the Kestrel Bay sample publishes a two-page PDF
//               (built here with the shipped writer) to one investor; that investor opens it from Documents and both pages
//               are drawn; the shipped reader was loaded and nothing was asked of either outside host
//   taxform     1280x800, the same frame: an invited U.S. individual whose name has a letter the standard PDF fonts lack (Ł)
//               reaches the tax step, continues to the form, sees the filled W-9 drawn, signs and finishes; the signed
//               copy's text is in the embedded Unicode fonts; nothing was asked of either outside host
//   fallback    1280x800, the frame of the phase 6 checks (scripts from the two outside hosts allowed, answered from local
//               copies) with the four shipped addresses answered 404: the published PDF is still drawn and the W-9 still
//               fills, with no error on screen; each shipped address was asked for before its outside address
//   managed     index.html at 1280x800, the frame of view-phone: a page of the managed console is visible; a PDF published
//               there is drawn from the investor's Documents list; NS.esignKit.writer(), unicodeFont() and reader() write a
//               PDF in the embedded Unicode font and read its text back; nothing was asked of either outside host
//   NODE_PATH=$(npm root -g) node shipped-libs.js [--only part1,part2]
// The last line is "SHIPPED LIBS: PASS (parts run: N)" or "SHIPPED LIBS: FAIL (parts run: N) - <failed parts>". The two
// marker lines above are read by the phase gate.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const T = require('./lib10.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, 'shipped-libs');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-viewed\.png$/, 'The investor\'s Documents dialog in a frame that refuses both outside hosts: the published PDF\'s pages drawn in the page.'],
  [/-not-viewed\.png$/, 'The investor\'s Documents dialog when the published PDF could not be drawn.']
]);

// The pins of the plan (measured from the npm archives whose sha512 matched the registry's integrity value on 2026-11-19).
const PINS = {
  'assets/vendor/pdfview/view.js': '5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946',
  'assets/vendor/pdfview/view-worker.js': 'feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b',
  'assets/vendor/pdfwrite/write.js': '0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f',
  'assets/vendor/pdfwrite/fonts.js': 'd8df561b9fba98e24f2e5130e40948809281bbbc55a20c412359f1a0a5eb35a6',
  'assets/vendor/pdfwrite/LICENSE-fonts.txt': 'cf22b8198f0886a8d4626121579114f23141070e1fceab02ab3c1c361e163440'
};
const LICENCES = [
  ['assets/vendor/pdfview/LICENSE-view.txt', 'Apache License'],
  ['assets/vendor/pdfwrite/LICENSE-write.md', 'Permission is hereby granted'],
  ['assets/vendor/pdfwrite/LICENSE-fonts.txt', 'Permission is hereby granted']
];
const SOURCES = [
  ['assets/vendor/pdfview/SOURCE.txt', ['pdfjs-dist 3.11.174', 'Apache-2.0']],
  ['assets/vendor/pdfwrite/SOURCE.txt', ['pdf-lib 1.17.1', '@pdf-lib/fontkit 1.1.1', 'MIT']]
];
// The four shipped library addresses, and the outside addresses they replace.
const SHIPPED = /\/assets\/vendor\/(pdfview\/view|pdfview\/view-worker|pdfwrite\/write|pdfwrite\/fonts)\.js$/;
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//;

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const J = (x) => JSON.stringify(x);

/** A two-page PDF written here with the shipped writer (plain text in a standard font, nothing to embed). */
async function twoPagePdf() {
  const L = require(path.join(Lib.ROOT, 'assets/vendor/pdfwrite/write.js'));
  const pdf = await L.PDFDocument.create();
  const font = await pdf.embedFont(L.StandardFonts.Helvetica);
  for (const n of [1, 2]) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`Quarterly letter, page ${n} of 2`, { x: 72, y: 700, size: 20, font });
    page.drawRectangle({ x: 72, y: 400, width: 200 + n * 100, height: 120, color: L.rgb(0.1, 0.3, 0.6) });
  }
  return Buffer.from(await pdf.save());
}

async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 20000 });
  await fr.waitForTimeout(300);
}

/** The investor the sample signs in by default (activated, with an investment). */
const firstInvestor = (fr) => fr.evaluate(() => window.CVPortal.state.ws.investors.find((i) => i.onboarding.status === 'complete' && i.positions.length).id);

/**
 * As the firm (admin or staff), on the console's Documents page: publish one PDF named with the investor's id, sent to
 * matched investors only; resolves to the published document's id ('' when none was published).
 */
async function publish(fr, investorId, bytes) {
  await go(fr, 'console-docs', '#dup-files');
  await T.press(fr, 'input[name=dup-aud][value=investors]');
  await fr.waitForTimeout(200);
  const fileName = `${investorId}_Quarterly_letter.pdf`;
  await fr.locator('#dup-files').setInputFiles({ name: fileName, mimeType: 'application/pdf', buffer: bytes });
  await fr.waitForSelector('[data-action=docs-publish]:not([disabled])', { timeout: 10000 });
  await T.press(fr, '[data-action=docs-publish]');
  await fr.waitForFunction((n) => (window.CVPortal.state.ws.docs || []).some((d) => d.fileName === n), fileName, { timeout: 20000 }).catch(() => {});
  return fr.evaluate((n) => ((window.CVPortal.state.ws.docs || []).find((d) => d.fileName === n) || {}).id || '', fileName);
}

/** As the investor: Documents, the document; resolves to what the dialog shows. */
async function openFromDocuments(fr, docId) {
  await go(fr, 'documents', `[data-action=open-doc][data-id="${docId}"]`);
  await T.press(fr, `[data-action=open-doc][data-id="${docId}"]`);
  await fr
    .waitForFunction(() => {
      const b = document.querySelector('#dlg .dlg-body');
      if (!b) return false;
      const imgs = Array.from(b.querySelectorAll('img.doc-page'));
      return (imgs.length && imgs.every((i) => i.complete && i.naturalWidth > 0)) || (b.querySelector('.empty') && !/Loading/.test(b.innerText));
    }, null, { timeout: 60000 })
    .catch(() => {});
  return fr.evaluate(() => {
    const b = document.querySelector('#dlg .dlg-body');
    return {
      open: !!(document.getElementById('dlg') || {}).open,
      drawn: b ? Array.from(b.querySelectorAll('img.doc-page')).filter((i) => i.complete && i.naturalWidth > 0).length : 0,
      said: b ? b.innerText.trim().slice(0, 200) : ''
    };
  });
}

/** The library scripts the page holds now (a script that failed to load is removed by the loader). */
const libScripts = (fr) => fr.evaluate(() => Array.from(document.scripts).map((s) => s.src).filter((s) => /vendor\/pdf(view|write)\/|cdnjs|jsdelivr/.test(s)));

/* ---------- The tax step (the walk of P6/no-network.js, part w9) ---------- */
const TAXPAYER = { name: 'Łucja Brennan-Okafor', email: 'lucja.brennan@example.com', type: 'individual' };

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
      error: m ? m[0].trim().slice(0, 200) : ''
    };
  });
}

/** The flow's tax envelope: its filled file and (once finished) its signed copy, each read with the page's PDF writer. */
function readTaxFiles(fr, invId) {
  return fr.evaluate(async (invId) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const i = ws.investors.find((x) => x.id === invId);
    const env = (ws.envelopes || []).find((e) => e.id === ((i.onboarding || {}).flow || {}).taxEnvelopeId) || (ws.envelopes || []).filter((e) => e.kind === 'tax' && e.signers.some((s) => s.investorId === invId)).pop();
    if (!env) return { env: null };
    const L = window.PDFLib;
    const look = async (blob) => {
      if (!blob || !L) return null;
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
      return { head: String.fromCharCode.apply(null, u8.slice(0, 5)), pages: pdf.getPageCount(), fields, fonts: Array.from(new Set(fonts)).sort() };
    };
    const doc = (ws.docs || []).find((d) => d.envelopeId === env.id);
    return {
      env: { id: env.id, form: env.taxForm && env.taxForm.form, status: env.status },
      filled: await look(env.docId ? await NS.ops.files.get(env.docId) : null),
      signed: await look(doc ? await NS.ops.files.get(doc.id) : null),
      sigFid: ((env.fields || []).find((f) => f.type === 'signature') || {}).id || ''
    };
  }, invId);
}

/** Consent (if asked) and the signature adopted on the tax form, as the investor does it. */
async function signTax(fr, sigFid) {
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

const UNI = (fonts) => (fonts || []).some((f) => /^\/DejaVuSans(-\d+)?$/.test(f));
const UNI_BOLD = (fonts) => (fonts || []).some((f) => /^\/DejaVuSans-Bold(-\d+)?$/.test(f));

/**
 * An invited U.S. individual walked to the tax step and on to the filled W-9; with sign, signed and finished. Resolves
 * to { reached, view, filled, signed } after the checks are made.
 */
async function taxWalk(check, S, A, fr, opts) {
  const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
  const inv = await Lib.createInvitation(fr, Object.assign({ account: '', offeringId: portal.offeringId }, TAXPAYER));
  await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
  const w = await Lib.walk(fr, { name: TAXPAYER.name, acc: 'yes', basis: 0, until: /Tax certification/ });
  check('the invited investor reaches the tax step (the subscription agreement signed on the way)', w.reached && w.at === 'Tax certification' && w.errors.length === 0, { seen: w.seen, errors: w.errors });
  if (!w.reached) return { reached: false };
  const v = await continueToForm(fr);
  await A.page.screenshot({ path: path.join(OUT, `${opts.id}-${v.signing && v.pages ? 'signing' : 'error'}.png`) });
  check('"Continue to the form" opens the signing view with the filled W-9 drawn and no error on screen', v.signing && v.pages >= 1 && !v.error, v);
  const files = await readTaxFiles(fr, inv.investorId);
  check('the filled W-9 is a PDF with no form field left, written in the embedded Unicode font', !!files.filled && files.filled.head === '%PDF-' && files.filled.fields === 0 && UNI(files.filled.fonts) && !!files.env && files.env.form === 'W-9', { env: files.env, filled: files.filled });
  if (!opts.sign) return { reached: true, view: v, filled: files.filled };
  if (!(v.signing && v.pages && files.sigFid)) {
    check('the W-9 could be signed and finished', false, 'the signing view never opened');
    return { reached: true, view: v, filled: files.filled };
  }
  await signTax(fr, files.sigFid);
  await Lib.finishTaxForm(fr);
  const next = await Lib.heading(fr);
  check('finishing the signed W-9 moves on to the next step', next === 'Distribution payments', next);
  const after = await readTaxFiles(fr, inv.investorId);
  check("the signed W-9 is stored and its added text uses the embedded Unicode fonts, regular and bold", !!after.signed && after.signed.head === '%PDF-' && UNI(after.signed.fonts) && UNI_BOLD(after.signed.fonts), { env: after.env, signed: after.signed });
  return { reached: true, view: v, filled: files.filled, signed: after.signed };
}

/**
 * lib10's quiet, for a part that loads the page again (Lib.setupPortal) and signs: lib10 clears the requests a page makes
 * while it loads, and these parts cannot. The one kind of outside request allowed is the page's typography stylesheets
 * (fonts.googleapis.com: the brand's faces when the firm opens, the handwriting faces when the signature dialog opens),
 * which the policy in force does not restrict and no PDF path uses; they are printed so the report names them.
 */
async function quietReloaded(check, A, fr) {
  const refused = await fr.evaluate(() => (window.__cspv || []).slice());
  check('the policy refused nothing (no fetch, no outside script)', refused.length === 0, refused);
  check('no script error in the browser', A.errors.length === 0, A.errors);
  const styles = A.p10.outside.filter((u) => /^https:\/\/fonts\.googleapis\.com\/css2\?/.test(u));
  const other = A.p10.outside.filter((u) => styles.indexOf(u) < 0);
  check("no request outside the page's origin other than its typography stylesheets", other.length === 0 && A.net.external.length === 0, other.concat(A.net.external));
  if (styles.length) console.log(`NOTE typography stylesheets asked of fonts.googleapis.com (not a PDF library): ${styles.length}`);
}

/** White label on the managed page: its own firm's name is on screen by design (P/checks/dist-flow.js, part managed). */
async function leakManaged(check, fr) {
  const text = await fr.evaluate(() => document.body.innerText);
  const hits = text
    .split('\n')
    .map((l) => l.replace(/Carrow\s*&\s*Vale/gi, ''))
    .filter((l) => Lib.VENDORS.test(l) || Lib.VENDOR_RE.test(l) || Lib.WORD_RE.test(l));
  check('no vendor, model or library name other than the managed firm’s own, and no forbidden word, on screen', hits.length === 0, hits.map((l) => l.trim().slice(0, 160)));
}

const parts = {
  async pins({ check }) {
    for (const dir of ['assets/vendor/pdfview', 'assets/vendor/pdfwrite']) {
      const sumsFile = path.join(Lib.ROOT, dir, 'SHA256SUMS');
      const lines = fs.existsSync(sumsFile) ? fs.readFileSync(sumsFile, 'utf8').split('\n').filter(Boolean) : [];
      check(`${dir}/SHA256SUMS is there and lists files`, lines.length > 0, sumsFile);
      for (const line of lines) {
        const m = line.match(/^([0-9a-f]{64}) [ *](.+)$/);
        const file = m ? path.join(Lib.ROOT, dir, m[2]) : '';
        const got = m && fs.existsSync(file) ? sha(file) : '';
        check(`${dir}/${m ? m[2] : line}: its SHA-256 equals its SHA256SUMS line`, !!m && got === m[1], { line, got });
      }
    }
    for (const [rel, want] of Object.entries(PINS)) {
      const file = path.join(Lib.ROOT, rel);
      const got = fs.existsSync(file) ? sha(file) : 'missing';
      const sums = fs.existsSync(path.join(path.dirname(file), 'SHA256SUMS')) ? fs.readFileSync(path.join(path.dirname(file), 'SHA256SUMS'), 'utf8') : '';
      check(`${rel} is the pinned file (${want.slice(0, 8)}…) and SHA256SUMS pins that value`, got === want && sums.indexOf(`${want}  ${path.basename(rel)}\n`) >= 0, { got });
    }
    for (const [rel, words] of LICENCES) {
      const file = path.join(Lib.ROOT, rel);
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      check(`${rel} is there and holds "${words}"`, text.indexOf(words) >= 0, text.slice(0, 80));
    }
    for (const [rel, names] of SOURCES) {
      const file = path.join(Lib.ROOT, rel);
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      check(`${rel} names ${names.join(', ')} and says the bytes are unchanged`, names.every((n) => text.indexOf(n) >= 0) && /bytes are unchanged/.test(text), text.slice(0, 120));
    }
  },

  async ['view-phone']({ check, S }) {
    const bytes = await twoPagePdf();
    const { A, fr } = await T.framed(S, 'phone', { policy: 'self' });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    const inv = await firstInvestor(fr);
    const docId = await publish(fr, inv, bytes);
    check('the admin publishes the two-page PDF to one investor from Documents', !!docId && J(await fr.evaluate((id) => (window.CVPortal.state.ws.docs.find((d) => d.id === id) || {}).investors, docId)) === J([inv]), { docId, inv });
    await T.sample(fr, { role: 'investor', investor: inv });
    const v = await openFromDocuments(fr, docId);
    await A.page.screenshot({ path: path.join(OUT, `phone-${v.drawn === 2 ? 'viewed' : 'not-viewed'}.png`) });
    check('as that investor, Documents, the document: both pages are drawn in the dialog', v.open && v.drawn === 2, v);
    const scripts = await libScripts(fr);
    check('the page loaded the shipped reader and its worker, and no library from an outside host', scripts.some((s) => /\/vendor\/pdfview\/view\.js$/.test(s)) && scripts.some((s) => /\/vendor\/pdfview\/view-worker\.js$/.test(s)) && !scripts.some((s) => CDN.test(s)), scripts);
    check('no request to either outside host was attempted', !A.p10.outside.some((u) => CDN.test(u)), A.p10.outside);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  async taxform({ check, S }) {
    const { A, fr } = await T.framed(S, 'desktop', { policy: 'self' });
    await T.proveRefused(check, A, fr);
    await taxWalk(check, S, A, fr, { id: 'taxform', sign: true });
    const scripts = await libScripts(fr);
    check('the page loaded the shipped writer and font embedder, and no library from an outside host', scripts.some((s) => /\/vendor\/pdfwrite\/write\.js$/.test(s)) && scripts.some((s) => /\/vendor\/pdfwrite\/fonts\.js$/.test(s)) && !scripts.some((s) => CDN.test(s)), scripts);
    check('no request to either outside host was attempted', !A.p10.outside.some((u) => CDN.test(u)), A.p10.outside.filter((u) => CDN.test(u)));
    await T.leak(check, fr);
    await quietReloaded(check, A, fr);
    await A.context.close();
  },

  async fallback({ check, S }) {
    const bytes = await twoPagePdf();
    const { A, fr } = await T.framed(S, 'desktop');
    await T.proveRefused(check, A, fr);
    // every request in the order it was made, and the four shipped addresses answered 404 (added last, so it is asked first)
    const asked = [];
    A.context.on('request', (r) => asked.push(r.url()));
    await A.context.route(
      (u) => u.origin === S.origin && SHIPPED.test(u.pathname),
      (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not here' })
    );
    await T.sample(fr, { role: 'admin' });
    const inv = await firstInvestor(fr);
    const docId = await publish(fr, inv, bytes);
    await T.sample(fr, { role: 'investor', investor: inv });
    const v = await openFromDocuments(fr, docId);
    await A.page.screenshot({ path: path.join(OUT, `fallback-${v.drawn === 2 ? 'viewed' : 'not-viewed'}.png`) });
    check('with the shipped files missing, the published PDF is still drawn from Documents (both pages)', !!docId && v.open && v.drawn === 2, v);
    const t = await taxWalk(check, S, A, fr, { id: 'fallback', sign: false });
    check('with the shipped files missing, the W-9 still fills and is drawn with no error on screen', !!t.reached && !!t.view && t.view.pages >= 1 && !t.view.error, t.view);
    // each library: its shipped address was asked for (and answered 404) before its outside address
    const firstAt = (re) => asked.findIndex((u) => re.test(u));
    const order = [
      ['the reader', /\/assets\/vendor\/pdfview\/view\.js$/, /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/3\.11\.174\/pdf\.min\.js$/],
      ['the writer', /\/assets\/vendor\/pdfwrite\/write\.js$/, /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf-lib\/1\.17\.1\/pdf-lib\.min\.js$/],
      ['the font embedder', /\/assets\/vendor\/pdfwrite\/fonts\.js$/, /^https:\/\/cdn\.jsdelivr\.net\/npm\/@pdf-lib\/fontkit@1\.1\.1\/dist\/fontkit\.umd\.min\.js$/]
    ].map(([what, mine, outside]) => ({ what, shipped: firstAt(mine), outside: firstAt(outside) }));
    check('the reader, the writer and the font embedder were each asked of the shipped address first, then of the outside address (the fallback ran)', order.every((o) => o.shipped >= 0 && o.outside > o.shipped), order);
    check("the reader's worker came from its outside address", A.p10.outside.some((u) => /\/pdf\.js\/3\.11\.174\/pdf\.worker\.min\.js$/.test(u)), A.p10.outside);
    const refused = await fr.evaluate(() => (window.__cspv || []).slice());
    check('the policy refused nothing', refused.length === 0, refused);
    check('no script error in the browser (a missing shipped file is not an error the page shows)', A.errors.length === 0, A.errors);
    const libsOrStyles = (u) => CDN.test(u) || /^https:\/\/fonts\.googleapis\.com\/css2\?/.test(u);
    check('every outside request was a library address of the two hosts (or a typography stylesheet), answered (none left unanswered)', A.net.external.length === 0 && A.p10.outside.every(libsOrStyles), { external: A.net.external, other: A.p10.outside.filter((u) => !libsOrStyles(u)) });
    await T.leak(check, fr);
    await A.context.close();
  },

  async managed({ check, S }) {
    const bytes = await twoPagePdf();
    const { A, fr } = await T.framed(S, 'desktop', { page: 'index.html', policy: 'self' });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'staff' });
    await go(fr, 'console-docs', '#dup-files');
    const page = await fr.evaluate(() => ({ edition: window.CVPortal.EDITION.id, panel: Array.from(document.querySelectorAll('.cs-panel-head h2')).map((x) => x.innerText.trim()) }));
    check('a page of the managed console is visible (Documents, Publish documents)', page.edition === 'managed' && page.panel.indexOf('Publish documents') >= 0 && (await fr.locator('#dup-files').isVisible()), page);
    const inv = await firstInvestor(fr);
    const docId = await publish(fr, inv, bytes);
    await T.sample(fr, { role: 'investor', investor: inv });
    const v = await openFromDocuments(fr, docId);
    await A.page.screenshot({ path: path.join(OUT, `managed-${v.drawn === 2 ? 'viewed' : 'not-viewed'}.png`) });
    check('the PDF published in the managed console is drawn from the investor\'s Documents list (both pages)', !!docId && v.open && v.drawn === 2, v);
    // the three names phase 11 relies on, on the managed page
    const kit = await fr.evaluate(async (name) => {
      const K = window.CVPortal.esignKit;
      const out = { names: [typeof K.writer, typeof K.unicodeFont, typeof K.reader] };
      try {
        const L = await K.writer();
        const { fontkit, fontBytes } = await K.unicodeFont();
        const pdf = await L.PDFDocument.create();
        pdf.registerFontkit(fontkit);
        const font = await pdf.embedFont(fontBytes, { subset: true });
        pdf.addPage([612, 792]).drawText(name, { x: 72, y: 700, size: 18, font });
        const bytes = await pdf.save();
        const R = await K.reader();
        const doc = await R.getDocument({ data: bytes, isEvalSupported: false }).promise;
        const tc = await (await doc.getPage(1)).getTextContent();
        out.text = tc.items.map((i) => i.str).join('');
        doc.destroy();
      } catch (e) {
        out.error = String(e && e.message);
      }
      return out;
    }, TAXPAYER.name);
    check('NS.esignKit.writer(), unicodeFont() and reader() write a PDF with the name in the embedded Unicode font and read it back', kit.names.every((t) => t === 'function') && kit.text === TAXPAYER.name && !kit.error, kit);
    const scripts = await libScripts(fr);
    check('the page loaded the four shipped files and no library from an outside host', ['view', 'view-worker', 'write', 'fonts'].every((n) => scripts.some((s) => new RegExp(`/vendor/pdf(view|write)/${n}\\.js$`).test(s))) && !scripts.some((s) => CDN.test(s)), scripts);
    check('no request to either outside host was attempted', !A.p10.outside.some((u) => CDN.test(u)), A.p10.outside);
    await leakManaged(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'SHIPPED LIBS', unit: 'parts', flag: '--only', browser: true });
