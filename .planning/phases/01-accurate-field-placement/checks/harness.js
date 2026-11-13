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
 * cell itself begins). A label with no line of its own (class nl) is no printed place: it comes back with none set
 * (no field may be put after it) and the stretch a field after it would take, up to the end of the signature blank
 * it names.
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
      if (e.how !== 'noline') return;
      e.none = 'a label with no line';
      if (!byId[e.ref]) return;
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
 * then a save of the draft as it was read (what the sponsor's Save button does when they change nothing). Options:
 * offering (a name to give the offering before the upload), offeringShort. Who signs is not an option: it is read
 * from the agreement. Returns the fields in points with each signer's role, whether saveAgreement accepted the draft,
 * the sentence that stopped it (todo), the sentence that would still stop it once every review mark is confirmed
 * (settled), what was read (read, note) and who signs the saved agreement (roles). The draft or the saved template
 * is removed again.
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
      const env = await NS.esign.agreementDraft(ws, off.id, { file, title: 'Subscription Agreement' });
      const role = (id) => (env.signers.find((s) => s.id === id).role === 'countersigner' ? 'firm' : 'investor');
      const fields = env.fields.map((f) => {
        const ps = env.pageSizes[f.page - 1];
        return {
          type: f.type,
          kind: f.kind || '',
          second: !!f.second,
          // The party a place for somebody else belongs to ('' when the field is the investor's or the firm's own).
          other: typeof f.other === 'string' ? f.other : '',
          printed: f.printed || '',
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
          // What every field the reading placed carries besides: the kind of answer, and the reading's own record of it.
          kindOk: typeof f.kind === 'string' && f.kind.length > 0,
          placedOk: !!f.placed && ['page', 'x', 'y', 'w', 'h'].every((k) => f.placed[k] === f[k]) && f.placed.type === f.type && f.placed.signerId === f.signerId && (f.placed.role === 'firm') === (role(f.signerId) === 'firm'),
          x0: f.x * ps.w,
          x1: (f.x + f.w) * ps.w,
          top: f.y * ps.h,
          bottom: (f.y + f.h) * ps.h
        };
      });
      const note = NS.esignKit && NS.esignKit.readNote ? NS.esignKit.readNote(env) : '';
      // Nothing is saved by the upload itself (the editor always opens). This is the sponsor's Save with nothing
      // changed: true means the agreement as read can be used for onboarding, false that something stops it (todo).
      // What would still stop the save once the sponsor has confirmed every field marked for review.
      const settled = NS.esign.agreementTodo ? NS.esign.agreementTodo(Object.assign({}, env, { fields: env.fields.map((f) => Object.assign({}, f, { review: false })) })) : '';
      const tpl = NS.esign.saveAgreement(ws, env);
      const saved = !!tpl;
      const todo = saved ? '' : NS.esign.agreementTodo ? NS.esign.agreementTodo(env) : '';
      ws.envelopes = (ws.envelopes || []).filter((e) => e !== env);
      ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== env.agreementFor);
      try {
        await NS.ops.files.del(env.docId);
      } catch (e) {
        /* the file store keeps it; nothing reads it again */
      }
      // otherPages: the pages the reading says hold a place for somebody else (none when the reading keeps no such record).
      return { fields, saved, todo, pages: env.pageSizes, read: env.read || null, otherPages: ((env.read && env.read.otherPages) || []).slice(), note, settled, roles: tpl ? tpl.roles || [] : [] };
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
        // Text is drawn one character after another with no kerning, so the run is measured the same way (the
        // library's own width of a whole string takes kerning off, which would put the run up to 3 pt too far left).
        const wide = (t) => Array.from(t).reduce((a, ch) => a + f.widthOfTextAtSize(ch, op[4]), 0);
        const x0 = op[2] + wide(op[6]);
        // The underscore of the standard fonts is drawn a tenth of the font size below the baseline.
        found[op[9]] = { x0, x1: x0 + wide(us), line: op[3] + 0.1 * op[4] };
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
 * Who signs is read from the agreement: when it prints no signature line for the firm, the firm gets no field at
 * all, so its other blanks come back with none set (they must stay empty).
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
  if (!expect.some((e) => e.role === 'firm' && e.type === 'signature' && !e.none && !e.second)) expect = expect.map((e) => (e.role === 'firm' && !e.none ? Object.assign({}, e, { none: 'the firm has no signature line' }) : e));
  const out = await upload(page, bytes, { offering: fx.offering || src.offering });
  return { expect, out, bytes };
}

/* ---------- Judging a field against a printed place ---------- */
/**
 * Whether a field rests on a printed place, whatever kind of field it is. For a line: same page, left edge within
 * 6 pt of the line's start, bottom edge between 2 pt above and 7 pt below the printed line. For a ruled table row
 * the field may start anywhere from the end of the row's label to 6 pt past the cell's left edge. For a tick box:
 * the field covers at least 60% of the printed square (or, for a box written as brackets, its centre is on it).
 */
function on(f, e) {
  if (f.page !== e.page) return false;
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
/** Whether a field of the blank's kind rests on it (see on). */
const sits = (f, e) => f.type === e.type && on(f, e);
/**
 * Whether a field covers the ink of its printed line: it reaches both ends of the line (to within half a point, and
 * no more than 3 pt past either) and its bottom edge is on or under the line, not above it. A cell of a table with
 * every border drawn is its own frame: the field stays inside it and reaches its right end. A row ruled along its
 * bottom only is a line that starts where the row's label ends. A tick box is judged by on() alone.
 */
function covers(f, e) {
  if (e.box || e.none) return true;
  if (e.how === 'cell' && e.from == null) return f.x0 >= e.x0 - 1 && f.x1 <= e.x1 + 1 && f.x1 >= e.x1 - 4 && f.bottom <= e.line + 2;
  if (e.how === 'cell') return f.x0 >= e.from - 1 && f.x1 >= e.x1 - 0.5 && f.x1 <= e.x1 + 3 && f.bottom >= e.line - 0.5;
  // Where an underscore's stroke lies under its baseline differs from font to font: the expected line of a blank
  // made of text is an estimate, so only a drawn line is held to the half point.
  const under = e.how === 'rule' ? f.bottom >= e.line - 0.5 : f.bottom >= e.line - 2;
  return f.x0 <= e.x0 + 0.5 && f.x0 >= e.x0 - 3 && f.x1 >= e.x1 - 0.5 && f.x1 <= e.x1 + 3 && under;
}
/**
 * What is wrong with a field that rests on a blank ('' when it is right): kind of field, signer, kind of investor, label,
 * key, required, second signer, cover. Two more keys are compared only when the page gives them, so a page that does
 * not give them is judged exactly as before:
 *   other    a party's name: the field is for somebody else and names that party; true: for somebody else, whoever;
 *            false (or left out on a place that is not a second signer's): the field is nobody else's
 *   review   true: the field is marked for review; false: it is not
 */
function wrong(f, e) {
  const bad = [];
  if (f.type !== e.type) bad.push(`a ${f.type} field, not ${e.type}`);
  if (f.role !== e.role) bad.push(`signer ${f.role}, not ${e.role}`);
  if (e.forType != null && (f.forType || '') !== e.forType) bad.push(`for ${f.forType || 'everyone'}, not ${e.forType || 'everyone'}`);
  if (e.label != null && f.label !== e.label) bad.push(`label "${f.label}", not "${e.label}"`);
  if (e.key != null && (f.prefill || '') !== e.key) bad.push(`filled in from ${f.prefill || 'nothing'}, not ${e.key || 'nothing'}`);
  if (e.required != null && f.type !== 'date' && !!f.required !== !!e.required) bad.push(`${f.required ? 'required' : 'optional'}, not ${e.required ? 'required' : 'optional'}`);
  if (!!f.second !== !!e.second) bad.push(e.second ? 'not kept apart as a line for a second signer' : 'treated as a line for a second signer');
  const whose = f.other || '';
  if (typeof e.other === 'string') {
    if (whose !== e.other) bad.push(`for ${whose ? '"' + whose + '"' : 'nobody else'}, not for "${e.other}"`);
  } else if (e.other === true) {
    if (!whose) bad.push('not given to somebody else');
  } else if ((e.other === false || !e.second) && whose) bad.push(`given to somebody else ("${whose}")`);
  if (e.review != null && !!f.review !== !!e.review) bad.push(e.review ? 'not marked for review' : 'marked for review');
  if (!covers(f, e)) bad.push(`does not cover its line (field x ${f.x0.toFixed(1)}-${f.x1.toFixed(1)} bottom ${f.bottom.toFixed(1)}; line x ${e.x0.toFixed(1)}-${e.x1.toFixed(1)} y ${e.line.toFixed(1)})`);
  return bad.join('; ');
}
/**
 * Every printed place and every field of one run, judged. The rule: a field is placed only on a printed place.
 * Returns
 *   blanks     [{ e, f, state }] for the places that take a field: 'right' (the right kind of field on the line for
 *              the right signer, covering it), 'wrong: ...' or 'none'
 *   empties    [{ e, f }] for the places that must stay empty (a label with no line; a blank of the firm when the
 *              agreement has no signature line for it), with the field found there, if any
 *   strays     fields on no printed place at all: each one is a mistake, at any confidence
 *   overlaps   [[a, b]] pairs of fields that lie over one another (more than half a point each way)
 *   bare       fields the reading placed that do not carry their kind and the reading's record of them (placed)
 *   mistakes   strays, fields on a place that must stay empty, fields in an overlap, bare fields, and fields placed
 *              at high confidence that are wrong for their place
 *   right, flagged (fields marked for review)
 */
function judge(expect, fields) {
  const used = new Set();
  const take = (e) => {
    const cand = fields.filter((f) => !used.has(f) && on(f, e));
    const f = cand.find((x) => !wrong(x, e)) || cand.find((x) => x.type === e.type) || cand[0] || null;
    if (f) used.add(f);
    return f;
  };
  // Places that take a field come first, so that a field on its own line is never counted against a place beside it.
  const blanks = expect.filter((e) => !e.none).map((e) => {
    const f = take(e);
    return { e, f, state: !f ? 'none' : wrong(f, e) ? 'wrong: ' + wrong(f, e) : 'right' };
  });
  const empties = expect.filter((e) => e.none).map((e) => ({ e, f: take(e) }));
  const strays = fields.filter((f) => !used.has(f));
  const overlaps = [];
  fields.forEach((a, i) =>
    fields.slice(i + 1).forEach((b) => {
      if (a.page === b.page && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) overlaps.push([a, b]);
    })
  );
  const bare = fields.filter((f) => f.auto && !(f.kindOk && f.placedOk));
  const mistakes = Array.from(
    new Set(
      strays
        .concat(empties.filter((x) => x.f).map((x) => x.f))
        .concat(overlaps.reduce((a, p) => a.concat(p), []))
        .concat(bare)
        .concat(blanks.filter((b) => b.f && b.state !== 'right' && b.f.conf === 'high').map((b) => b.f))
    )
  );
  return { blanks, empties, strays, overlaps, bare, mistakes, right: blanks.filter((b) => b.state === 'right').length, flagged: fields.filter((f) => f.review).length };
}

/**
 * A picture of one run for a person to look at: each page drawn with the PDF reader the app already loaded, the
 * printed places outlined in green (dashed grey for one that must stay empty) and the fields in blue, or red for a
 * field that is a mistake or wrong for its place. Writes <dir>/<name>-p<n>.png and returns the paths.
 */
async function picture(page, bytes, expect, j, fields, dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  const marks = {
    expect: expect.map((e) => ({ page: e.page, none: !!e.none, x0: e.box ? e.box.x0 : e.x0, x1: e.box ? e.box.x1 : e.x1, y0: e.box ? e.box.y0 : e.line - 1, y1: e.box ? e.box.y1 : e.line + 1 })),
    fields: fields.map((f) => ({ page: f.page, x0: f.x0, x1: f.x1, y0: f.top, y1: f.bottom, bad: j.mistakes.indexOf(f) >= 0 || j.blanks.some((b) => b.f === f && b.state !== 'right'), text: `${f.type}/${f.role}${f.conf === 'high' ? '' : ' ' + f.conf}` }))
  };
  const urls = await page.evaluate(
    async ({ arr, marks }) => {
      const lib = window.pdfjsLib;
      const doc = await lib.getDocument({ data: new Uint8Array(arr), isEvalSupported: false }).promise;
      const out = [];
      const S = 2;
      for (let n = 1; n <= doc.numPages; n++) {
        const pg = await doc.getPage(n);
        const vp = pg.getViewport({ scale: S });
        const c = document.createElement('canvas');
        c.width = vp.width;
        c.height = vp.height;
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        await pg.render({ canvasContext: g, viewport: vp }).promise;
        marks.expect.filter((e) => e.page === n).forEach((e) => {
          g.setLineDash(e.none ? [6, 4] : []);
          g.strokeStyle = e.none ? '#666' : '#0a8a2a';
          g.lineWidth = 2;
          g.strokeRect(e.x0 * S, e.y0 * S - 2, (e.x1 - e.x0) * S, (e.y1 - e.y0) * S + 4);
        });
        g.setLineDash([]);
        g.font = '14px sans-serif';
        marks.fields.filter((f) => f.page === n).forEach((f) => {
          g.fillStyle = f.bad ? 'rgba(220,30,30,.18)' : 'rgba(30,90,220,.14)';
          g.strokeStyle = f.bad ? '#d01818' : '#1e5adc';
          g.lineWidth = 1.5;
          g.fillRect(f.x0 * S, f.y0 * S, (f.x1 - f.x0) * S, (f.y1 - f.y0) * S);
          g.strokeRect(f.x0 * S, f.y0 * S, (f.x1 - f.x0) * S, (f.y1 - f.y0) * S);
          g.fillStyle = f.bad ? '#d01818' : '#1e5adc';
          g.fillText(f.text, f.x0 * S + 3, f.y0 * S + 14);
        });
        out.push(c.toDataURL('image/png'));
      }
      doc.destroy();
      return out;
    },
    { arr: bytes, marks }
  );
  return urls.map((u, i) => {
    const file = path.join(dir, `${name}-p${i + 1}.png`);
    fs.writeFileSync(file, Buffer.from(u.split(',')[1], 'base64'));
    return file;
  });
}

module.exports = { ROOT, start, makePdf, drawPdf, signUp, cropPdf, upload, run, on, sits, covers, wrong, judge, picture };
