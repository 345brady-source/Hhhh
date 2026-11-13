/*
 * Shared helpers for the Phase 1 placement checks (built from the working parts of baseline-probe.js, which stays
 * as the record of the starting point).
 *
 *  - The script CDN the app loads its PDF libraries from is not reachable from the build sandbox, but the package
 *    registry is. vendor() fetches the same two libraries at the same versions the app uses, refuses an archive
 *    whose content differs from its pin, and the check browser serves them in place of the CDN addresses.
 *    Nothing is added to the app or the repository.
 *  - A fixture is HTML printed to PDF by the browser. Each blank carries data-x with what belongs there, and its
 *    printed position is read from the page before printing (CSS px * 0.75 = PDF points, top-left origin), so the
 *    expected positions never come from the code under test.
 *  - upload() runs a file through NS.esign.agreementDraft exactly as the upload form does.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
// Where the two PDF libraries are kept: PLACE_VENDOR, or VENDOR_DIR as the other phases' checks call it, or the first
// of the usual scratch folders that already holds them, or a folder under the system temp folder to fetch them into.
const HAS = (dir) => fs.existsSync(path.join(dir, 'pdfjs/package/build/pdf.min.js')) && fs.existsSync(path.join(dir, 'pdflib/package/dist/pdf-lib.min.js'));
const SCRATCH = path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const VENDOR = process.env.PLACE_VENDOR || process.env.VENDOR_DIR || [path.join(os.tmpdir(), 'place-vendor'), path.join(SCRATCH, 'vendor'), path.join(SCRATCH, 'place-vendor')].find(HAS) || path.join(os.tmpdir(), 'place-vendor');
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
const WRITER = 'pdf-lib/1.17.1/pdf-lib.min.js';
const LOCAL = {
  'pdf.js/3.11.174/pdf.min.js': path.join(VENDOR, 'pdfjs/package/build/pdf.min.js'),
  'pdf.js/3.11.174/pdf.worker.min.js': path.join(VENDOR, 'pdfjs/package/build/pdf.worker.min.js'),
  [WRITER]: path.join(VENDOR, 'pdflib/package/dist/pdf-lib.min.js')
};
// The two archives, pinned by content: the hashes the package registry published for these versions (read when the phase was planned).
const PINS = [
  ['pdfjs-dist-3.11.174.tgz', 'pdfjs', 'sha512-TdTZPf1trZ8/UFu5Cx/GXB7GZM30LT+wWUNfsi6Bq8ePLnb+woNKtDymI2mxZYBpMbonNFqKmiz684DIfnd8dA=='],
  ['pdf-lib-1.17.1.tgz', 'pdflib', 'sha512-V/mpyJAoTsN4cnP31vc0wfNA1+p20evqqnap0KLoRUN0Yk/p3wN52DOEsL4oBFcLdb76hlpKPtzJIgo67j/XLw==']
];
/**
 * The PDF libraries the app loads from its CDN, at the same versions, unpacked once into a folder outside the repository.
 * "npm pack" only downloads an archive (no package script runs); an archive whose content differs from its pin is refused.
 */
function vendor() {
  if (Object.values(LOCAL).every((f) => fs.existsSync(f))) return;
  fs.mkdirSync(VENDOR, { recursive: true });
  execFileSync('npm', ['pack', 'pdfjs-dist@3.11.174', 'pdf-lib@1.17.1', '--pack-destination', VENDOR], { stdio: 'ignore' });
  PINS.forEach(([tgz, dir, pin]) => {
    const got = 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(path.join(VENDOR, tgz))).digest('base64');
    if (got !== pin) throw new Error(`${tgz} is not the pinned archive (got ${got})`);
    fs.mkdirSync(path.join(VENDOR, dir), { recursive: true });
    execFileSync('tar', ['-xzf', path.join(VENDOR, tgz), '-C', path.join(VENDOR, dir)]);
  });
}
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
/** The repository served on a free local port. */
function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

/**
 * The check browser: the repository on a local port, the three library addresses answered from the fetched copies,
 * the font stylesheet addresses answered with an empty stylesheet, every other outside request aborted.
 */
async function start() {
  vendor();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    if (u.startsWith(CDN) && LOCAL[u.slice(CDN.length)]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(LOCAL[u.slice(CDN.length)]) });
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  const errors = [];
  const stop = async () => {
    await browser.close();
    server.close();
  };
  return { base, browser, context, errors, stop };
}

/**
 * Print a fixture to PDF and read where each blank was printed. Returns { expect, bytes }: one expectation per
 * data-x element, with page, x0, x1 and line (the y of the printed line) in PDF points from the page's top-left.
 * A tick box has box: { x0, x1, y0, y1 } instead of a line. A table cell (data-k="cell") is ruled along its bottom
 * edge; from is where the row's label ends (the line is empty from there on, and nothing printed marks where the
 * cell itself begins). A label with no line of its own (class nl) takes its place from the signature blank it names.
 * opts: { paper: [width, height] in inches (default Letter) }.
 */
async function makePdf(h, css, html, opts) {
  const paper = (opts && opts.paper) || [8.5, 11];
  const g = await h.context.newPage();
  await g.setViewportSize({ width: Math.round(paper[0] * 96), height: Math.round(paper[1] * 96) });
  await g.setContent(`<html><head><style>${css}</style></head><body>${html}</body></html>`);
  await g.emulateMedia({ media: 'print' });
  const expect = await g.evaluate(() => {
    const pages = Array.from(document.querySelectorAll('.pg'));
    const pt = (v) => v * 0.75;
    const where = (el) => {
      const o = el.closest('.pg').getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { page: pages.indexOf(el.closest('.pg')) + 1, x0: pt(r.left - o.left), x1: pt(r.right - o.left), y0: pt(r.top - o.top), y1: pt(r.bottom - o.top), o };
    };
    // The baseline of the text inside an element: where a zero-size inline box put into it comes to rest.
    const baseline = (el, o) => {
      const probe = document.createElement('span');
      probe.style.cssText = 'display:inline-block;width:0;height:0';
      el.appendChild(probe);
      const y = pt(probe.getBoundingClientRect().bottom - o.top);
      el.removeChild(probe);
      return y;
    };
    const out = [];
    const byId = {};
    Array.from(document.querySelectorAll('[data-x]')).forEach((el) => {
      const x = JSON.parse(el.getAttribute('data-x'));
      const w = where(el);
      const k = el.getAttribute('data-k') || (el.classList.contains('rule') ? 'rule' : el.classList.contains('sq') ? 'box' : el.classList.contains('nl') ? 'noline' : 'text');
      const e = Object.assign(x, { page: w.page, x0: w.x0, x1: w.x1, how: k });
      const size = pt(parseFloat(getComputedStyle(el).fontSize));
      if (k === 'box' || k === 'bracket') e.box = { x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 };
      else if (k === 'rule' || k === 'cell') e.line = w.y1 - 0.5;
      // An underscore is drawn a little below the baseline (about an eighth of the font size).
      else e.line = baseline(el, w.o) + 0.13 * size;
      if (k === 'cell') {
        const lab = el.parentElement.querySelector('[data-lab]');
        if (lab) e.from = where(lab).x1;
      }
      if (el.getAttribute('data-id')) byId[el.getAttribute('data-id')] = e;
      out.push(e);
    });
    out.forEach((e) => {
      if (e.how !== 'noline' || !byId[e.ref]) return;
      e.x0 = Math.max(e.x0 + 4, byId[e.ref].x0);
      e.x1 = byId[e.ref].x1;
    });
    return out;
  });
  const bytes = await g.pdf({ width: paper[0] + 'in', height: paper[1] + 'in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await g.close();
  return { expect, bytes: Array.from(bytes) };
}

/** A new firm in the self-serve edition with one offering; resolves to the page showing its console. */
async function signUp(h, firm) {
  const page = await h.context.newPage();
  page.on('pageerror', (e) => h.errors.push(String(e)));
  await page.goto(h.base + '/diy.html');
  await page.waitForSelector('#sd-firm');
  await page.fill('#sd-firm', firm || 'Northgate Capital');
  await page.fill('#sd-name', 'Priya Raman');
  await page.fill('#sd-email', 'priya@northgate-example.com');
  await page.fill('#sd-password', 'a-long-password-1');
  await page.click('.sd-submit');
  await page.waitForFunction(() => /^#console/.test(location.hash));
  await page.evaluate(() => (location.hash = 'console-offerings'));
  await page.waitForSelector('[data-action=off-add]');
  await page.click('[data-action=off-add]');
  await page.waitForFunction(() => window.CVPortal.state.ws.offerings.length > 0);
  return page;
}

/**
 * Give every page of a PDF a crop box [x, y, width, height], inside the check browser with the PDF writing library
 * the harness already serves. Returns the new bytes.
 */
async function cropPdf(page, bytes, box) {
  if (!(await page.evaluate(() => !!window.PDFLib))) await page.addScriptTag({ url: CDN + WRITER });
  return page.evaluate(
    async ({ arr, b }) => {
      const pdf = await window.PDFLib.PDFDocument.load(new Uint8Array(arr));
      pdf.getPages().forEach((p) => p.setCropBox(b[0], b[1], b[2], b[3]));
      return Array.from(await pdf.save());
    },
    { arr: bytes, b: box }
  );
}

/**
 * Run a file through the upload path: the same call the upload form makes (assets/js/esign.js, NS.forms['es-agreement']),
 * then the save the form tries straight away. Options: countersign (default true), offering (a name to give the
 * offering before the upload), offeringShort. Returns the fields in points with each signer's role, whether
 * saveAgreement accepted the draft, and the sentence that stopped it. The draft or the saved template is removed again.
 */
async function upload(page, bytes, opts) {
  return page.evaluate(
    async ({ arr, o }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const off = ws.offerings[ws.offerings.length - 1];
      if (o.offering) {
        off.name = o.offering;
        off.shortName = o.offeringShort || o.offering;
      }
      const file = new File([new Uint8Array(arr)], 'fixture.pdf', { type: 'application/pdf' });
      const env = await NS.esign.agreementDraft(ws, off.id, { file, title: 'Subscription Agreement', countersign: o.countersign !== false });
      const role = (id) => (env.signers.find((s) => s.id === id).role === 'countersigner' ? 'firm' : 'investor');
      const fields = env.fields.map((f) => {
        const ps = env.pageSizes[f.page - 1];
        return {
          type: f.type,
          role: role(f.signerId),
          page: f.page,
          conf: f.confidence || '',
          why: f.reviewReason || '',
          review: !!f.review,
          prefill: f.prefill || '',
          forType: f.forType || '',
          label: f.label || '',
          required: !!f.required,
          auto: !!f.auto,
          x0: f.x * ps.w,
          x1: (f.x + f.w) * ps.w,
          top: f.y * ps.h,
          bottom: (f.y + f.h) * ps.h
        };
      });
      // The upload form saves at once when it can: true here means the agreement went live with nobody looking at it.
      const saved = !!NS.esign.saveAgreement(ws, env);
      const todo = saved ? '' : NS.esign.agreementTodo ? NS.esign.agreementTodo(env) : '';
      ws.envelopes = (ws.envelopes || []).filter((e) => e !== env);
      ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== env.agreementFor);
      try {
        await NS.ops.files.del(env.docId);
      } catch (e) {
        /* the file store keeps it; nothing reads it again */
      }
      return { fields, saved, todo, pages: env.pageSizes };
    },
    { arr: bytes, o: opts || {} }
  );
}

/**
 * A PDF drawn directly with the PDF writing library (a different producer from the browser's print-to-PDF: text set
 * in the standard PDF fonts, lines and squares as vector strokes). spec: { size: [w, h], pages, ops } where an op is
 *   ['text', page, x, baseline, size, font, string]
 *   ['utext', page, x, baseline, size, font, before, underscores, after, id]   text with a run of underscores in it
 *   ['line', page, x0, x1, y, thickness]      ['rect', page, x, top, width, height, thickness]
 * with y measured from the top of the page and font one of H, HB, T, TB, TI, C. Returns { bytes, found }: found[id]
 * is where the underscores of a 'utext' came out ({ x0, x1, line }), measured with the font's own widths.
 */
async function drawPdf(page, spec) {
  if (!(await page.evaluate(() => !!window.PDFLib))) await page.addScriptTag({ url: CDN + WRITER });
  return page.evaluate(async (spec) => {
    const L = window.PDFLib;
    const pdf = await L.PDFDocument.create();
    const F = L.StandardFonts;
    const fonts = { H: await pdf.embedFont(F.Helvetica), HB: await pdf.embedFont(F.HelveticaBold), T: await pdf.embedFont(F.TimesRoman), TB: await pdf.embedFont(F.TimesRomanBold), TI: await pdf.embedFont(F.TimesRomanItalic), C: await pdf.embedFont(F.Courier) };
    const [W, Ht] = spec.size;
    const pages = Array.from({ length: spec.pages }, () => pdf.addPage([W, Ht]));
    const black = L.rgb(0, 0, 0);
    const found = {};
    spec.ops.forEach((op) => {
      const pg = pages[op[1] - 1];
      if (op[0] === 'text') pg.drawText(op[6], { x: op[2], y: Ht - op[3], size: op[4], font: fonts[op[5]], color: black });
      else if (op[0] === 'utext') {
        const f = fonts[op[5]];
        const us = '_'.repeat(op[7]);
        pg.drawText(op[6] + us + (op[8] || ''), { x: op[2], y: Ht - op[3], size: op[4], font: f, color: black });
        const x0 = op[2] + f.widthOfTextAtSize(op[6], op[4]);
        // The underscore of the standard fonts is drawn a tenth of the font size below the baseline.
        found[op[9]] = { x0, x1: x0 + f.widthOfTextAtSize(us, op[4]), line: op[3] + 0.1 * op[4] };
      } else if (op[0] === 'line') pg.drawLine({ start: { x: op[2], y: Ht - op[4] }, end: { x: op[3], y: Ht - op[4] }, thickness: op[5] || 0.75, color: black });
      else if (op[0] === 'rect') pg.drawRectangle({ x: op[2], y: Ht - op[3] - op[5], width: op[4], height: op[5], borderWidth: op[6] || 0.75, borderColor: black });
    });
    return { bytes: Array.from(await pdf.save()), found };
  }, spec);
}

/**
 * One fixture end to end: printed (or drawn), cropped when it asks for it, and put through the upload path. Returns
 * { expect, out, bytes }: the printed blanks (in points of the page as displayed) and what the portal placed.
 * A fixture that names another with `from` uses that one's pages with its own options.
 */
async function run(h, page, fixtures, css, name) {
  const fx = fixtures[name];
  const src = fx.from ? fixtures[fx.from] : fx;
  let bytes;
  let expect;
  if (src.draw) {
    const spec = src.draw();
    const made = await drawPdf(page, spec);
    bytes = made.bytes;
    expect = spec.expect.map((e) => (e.id && made.found[e.id] ? Object.assign({}, e, made.found[e.id]) : e));
  } else {
    const made = await makePdf(h, css + (src.css || ''), src.html, { paper: src.paper });
    bytes = made.bytes;
    expect = made.expect;
  }
  if (fx.crop) {
    // A crop box [x, y, width, height] in PDF space (origin bottom-left): the displayed page starts at its top-left corner.
    const top = (src.paper ? src.paper[1] : 11) * 72 - fx.crop[1] - fx.crop[3];
    bytes = await cropPdf(page, bytes, fx.crop);
    expect = expect.map((e) => Object.assign({}, e, { x0: e.x0 - fx.crop[0], x1: e.x1 - fx.crop[0], line: e.line - top }));
  }
  // With no countersignature the firm's blanks are expected to stay empty.
  if (fx.countersign === false) expect = expect.filter((e) => e.role !== 'firm');
  const out = await upload(page, bytes, { countersign: fx.countersign, offering: fx.offering || src.offering });
  return { expect, out, bytes };
}

/* ---------- Judging a field against a printed blank ---------- */
/**
 * Whether a field rests on a printed blank of its kind. For a line: same page and type, left edge within 6 pt of
 * the blank's start, bottom edge between 2 pt above and 7 pt below the printed line. For a ruled table row the
 * field may start anywhere from the end of the row's label to 6 pt past the cell's left edge. For a tick box:
 * the field covers at least 60% of the printed square (or, for a box written as brackets, its centre is on it).
 */
function sits(f, e) {
  if (f.page !== e.page || f.type !== e.type) return false;
  if (e.box) {
    const b = e.box;
    if (e.how === 'bracket') {
      const cx = (f.x0 + f.x1) / 2;
      const cy = (f.top + f.bottom) / 2;
      return cx >= b.x0 - 3 && cx <= b.x1 + 3 && cy >= b.y0 - 3 && cy <= b.y1 + 3;
    }
    const ox = Math.min(f.x1, b.x1) - Math.max(f.x0, b.x0);
    const oy = Math.min(f.bottom, b.y1) - Math.max(f.top, b.y0);
    return ox > 0 && oy > 0 && (ox * oy) / ((b.x1 - b.x0) * (b.y1 - b.y0)) >= 0.6;
  }
  const left = e.from != null ? f.x0 >= e.from - 1 && f.x0 <= e.x0 + 6 : Math.abs(f.x0 - e.x0) <= 6;
  return left && f.bottom - e.line >= -2 && f.bottom - e.line <= 7;
}
/** What is wrong with a field that sits on a blank ('' when it is right): signer, kind of investor, label, key, required. */
function wrong(f, e) {
  const bad = [];
  if (f.role !== e.role) bad.push(`signer ${f.role}, not ${e.role}`);
  if (e.forType != null && (f.forType || '') !== e.forType) bad.push(`for ${f.forType || 'everyone'}, not ${e.forType || 'everyone'}`);
  if (e.label != null && f.label !== e.label) bad.push(`label "${f.label}", not "${e.label}"`);
  if (e.key != null && (f.prefill || '') !== e.key) bad.push(`filled in from ${f.prefill || 'nothing'}, not ${e.key || 'nothing'}`);
  if (e.required != null && f.type !== 'date' && !!f.required !== !!e.required) bad.push(`${f.required ? 'required' : 'optional'}, not ${e.required ? 'required' : 'optional'}`);
  return bad.join('; ');
}
/**
 * Every blank and every field of one run, judged. Returns { blanks: [{ e, f, state }], strays: [fields on no blank],
 * right, flagged, mistakes: [high-confidence fields that are on no blank or wrong on theirs] }.
 * state is 'right' (the right kind of field on the line for the right signer), 'wrong: ...' or 'none'.
 */
function judge(expect, fields) {
  const used = new Set();
  const blanks = expect.map((e) => {
    const on = fields.filter((f) => !used.has(f) && sits(f, e));
    const f = on.find((x) => !wrong(x, e)) || on[0] || null;
    if (f) used.add(f);
    return { e, f, state: !f ? 'none' : wrong(f, e) ? 'wrong: ' + wrong(f, e) : 'right' };
  });
  const strays = fields.filter((f) => !used.has(f));
  const mistakes = strays.filter((f) => f.conf === 'high').concat(blanks.filter((b) => b.f && b.state !== 'right' && b.f.conf === 'high').map((b) => b.f));
  return { blanks, strays, mistakes, right: blanks.filter((b) => b.state === 'right').length, flagged: fields.filter((f) => f.review).length };
}

module.exports = { ROOT, start, makePdf, drawPdf, signUp, cropPdf, upload, run, sits, wrong, judge };
