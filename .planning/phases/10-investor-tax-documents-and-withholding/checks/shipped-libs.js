// gate: browser
// last "SHIPPED LIBS: PASS (parts run: 2)"
// The PDF libraries shipped in the repository (plan 10-03, F-6): the reader and its worker (assets/vendor/pdfview), the
// writer and the font embedder (assets/vendor/pdfwrite), byte for byte the published files of the versions the portal
// already ran from two outside hosts, pinned by SHA-256, loaded first by assets/js/esign.js.
//   pins        no browser: each shipped file's SHA-256 equals its SHA256SUMS line and the constant below; each licence
//               file is there with its licence's opening words; each SOURCE.txt names its package and version
//   view-phone  390x844 with touch, in a sandboxed frame that may load scripts from the portal's own address only and has
//               every request to the two outside hosts refused: an admin of the Kestrel Bay sample publishes a two-page PDF
//               (built here with the shipped writer) to one investor; that investor opens it from Documents and both pages
//               are drawn; the shipped reader was loaded and nothing was asked of either outside host
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
  }
};

Lib.runParts(parts, { name: 'SHIPPED LIBS', unit: 'parts', flag: '--only', browser: true });
