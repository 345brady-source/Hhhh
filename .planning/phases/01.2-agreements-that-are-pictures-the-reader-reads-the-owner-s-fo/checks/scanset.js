#!/usr/bin/env node
/*
 * The scan set: two public documents whose pages are pictures (a scanned binder, every page a picture; a completed
 * booklet, some pages with text and some pictures), taken through the portal's real upload dialog and the offer to
 * read pages from their picture, as a sponsor does.
 *
 *   node scanset.js [--doc binder|booklet|all] [--root <checkout>] [--out <folder outside the repository>] [--nobody]
 *
 * Required for each document:
 *   before the offer   no field on any text-less page, and a plain sentence on the screen that pages have no text;
 *   after the offer    every field on a text-less page lies on a box found on that page (a place) or on a free rule
 *                      found there (NS.anchors.walk and NS.textread.page with words switched off, in the same page);
 *                      no two fields of a page share more than 0.5 pt both ways; every such field is marked for review;
 *                      the read summary names the pages read from their picture, and the pages the time limit left
 *                      (or that could not be read), and together they are exactly the text-less pages;
 *                      on a page with text the fields are those the upload placed (the offer changes nothing there).
 * Every page that got a field from its picture is photographed whole, 1440 pixels wide, into <out>/<doc>/.
 *
 * Places nobody completes: <scratch>/public-agreements/scanset-nobody.json (or SCANSET_NOBODY) holds, by document and
 * page, the rectangles (points) of places nobody completes that were seen on the pictures (a table's edge, a footnote
 * rule, the edge of a ticked box, a table cell taken for one box, a piece at a line's end, a date line already
 * answered), each with its kind. A field lying mostly (80 % of its area) inside one is counted, by page and kind; a
 * region marked 'whole' counts only a field that also covers half of it. The counts are printed on every run; with
 * --nobody each must be 0 for the run to pass.
 *
 * The documents and the proof runner are outside the repository and nothing of them is copied in. The documents are
 * found through the environment (SCANSET_BINDER, SCANSET_BOOKLET) or the list <scratch>/public-agreements/scanset.json
 * ({ "binder": path, "booklet": path }). PICTURE_SCRATCH overrides the scratch folder, PROOF_DIR the proof runner's.
 * Output names pages and kinds, never words. A missing piece prints "NOT RUN: (what)" and exits 2, which is never a
 * pass. The last line is "SCANSET: PASS" or "SCANSET: FAIL - (what, by document, page and kind)".
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const ROOT = path.resolve(arg('--root', path.resolve(__dirname, '..', '..', '..', '..')));
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const PROOF = process.env.PROOF_DIR || path.join(SCRATCH, 'build/proof');
const OUT = path.resolve(arg('--out', path.join(SCRATCH, 'exec-012', 'scanset')));
const DOC = arg('--doc', 'all');
const LIMIT_MS = 12 * 60 * 1000; // the upload and the reading of one document, each
const OFFER_RE = /read (these|the|those)? ?pages? from (their|its|the) pictures?/i;
const BUSY_RE = /Reading page \d+ of \d+|Reading [^.]{0,60}(…|\.\.\.)/;
const NO_TEXT_RE = /\b(no|without( any)?) text\b|pages? (is|are) (a |only )?pictures?|only pictures? of/i;
const SHARE = 0.5; // pt: two fields of a page may share at most this much both ways
const NOBODY_GATE = process.argv.includes('--nobody');
let NOBODY = {};
try {
  NOBODY = JSON.parse(fs.readFileSync(process.env.SCANSET_NOBODY || path.join(SCRATCH, 'public-agreements', 'scanset-nobody.json'), 'utf8'));
} catch (e) {
  if (NOBODY_GATE) {
    console.log('NOT RUN: the places nobody completes are not recorded (' + (process.env.SCANSET_NOBODY || path.join(SCRATCH, 'public-agreements', 'scanset-nobody.json')) + ')');
    process.exit(2);
  }
}

const notRun = (what) => {
  console.log('NOT RUN: ' + what);
  process.exit(2);
};

/* ---------- what must be there ---------- */
const names = DOC === 'all' ? ['binder', 'booklet'] : [DOC];
if (names.some((n) => n !== 'binder' && n !== 'booklet')) notRun(`--doc ${DOC} is not binder, booklet or all`);
if (!fs.existsSync(path.join(ROOT, 'diy.html'))) notRun('not a checkout of the portal: ' + ROOT);
if (OUT === ROOT || OUT.startsWith(ROOT + path.sep)) notRun('--out is inside the repository: evidence is kept outside it');
if (!fs.existsSync(path.join(PROOF, 'proof.js'))) notRun('the proof runner is not at ' + path.join(PROOF, 'proof.js'));
let listed = {};
try {
  listed = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'public-agreements', 'scanset.json'), 'utf8'));
} catch (e) {
  listed = {};
}
const DOCS = { binder: process.env.SCANSET_BINDER || listed.binder, booklet: process.env.SCANSET_BOOKLET || listed.booklet };
names.forEach((n) => (DOCS[n] && fs.existsSync(DOCS[n])) || notRun(`the ${n} is not there (SCANSET_${n.toUpperCase()} or ${path.join(SCRATCH, 'public-agreements', 'scanset.json')})`));
try {
  execFileSync('pdfinfo', ['-v'], { stdio: 'ignore' });
} catch (e) {
  if (e.code === 'ENOENT') notRun('pdfinfo is not installed (the page sizes come from it)');
}
if (!module.paths.some((p) => fs.existsSync(path.join(p, 'playwright')))) {
  try {
    const g = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    process.env.NODE_PATH = [g, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
    require('module').Module._initPaths();
  } catch (e) {
    notRun('the browser library (playwright) cannot be found');
  }
}
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  notRun('the browser library (playwright) cannot be loaded');
}
// The proof runner serves the checkout named by --root on its own command line.
if (process.argv.indexOf('--root') < 0) process.argv.push('--root', ROOT);
const P = require(path.join(PROOF, 'proof.js'));
if (!P || !P.startServers || !P.uploadDialog || !P.readEditor) notRun('the proof runner does not export startServers, uploadDialog and readEditor');

/* ---------- helpers ---------- */
const mk = (d) => (fs.mkdirSync(d, { recursive: true }), d);
const pad = (n) => String(n).padStart(2, '0');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
const noteText = async (S) => (await S.P.locator('.es-agr-note').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
// every note the editor shows (the read summary, the offer under it, the status)
const notes = (S) => S.P.evaluate(() => Array.from(document.querySelectorAll('.es-agr-note, .es-note, .es-offer, .fe-status')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(() => []);
const toasts = (S) => S.P.evaluate(() => Array.from(document.querySelectorAll('.toast, [role=alert], [role=status]')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(() => []);
const editorOpen = (S) => S.P.evaluate(() => /^#console-envelope-/.test(location.hash) && !!document.querySelector('.fe-doc .es-page')).catch(() => false);
/** Page numbers from the summary's wording: "page 5", "pages 5 and 6", "pages 1 to 3, 5 and 7". */
const pagesIn = (s) => {
  const out = [];
  String(s || '')
    .replace(/^pages?\s+/i, '')
    .split(/,\s*|\s+and\s+/)
    .forEach((part) => {
      const m = /^(\d+)(?:\s+to\s+(\d+))?$/.exec(part.trim());
      if (!m) return;
      const a = +m[1];
      const b = m[2] ? +m[2] : a;
      for (let p = a; p <= b; p++) out.push(p);
    });
  return out;
};
const PAGES = '((?:pages?) [0-9][0-9 ,]*(?:(?:to|and) [0-9][0-9 ,]*)*)';
const said = (note, re) => {
  const m = new RegExp(re, 'i').exec(note);
  return m ? pagesIn(m[1].trim()) : [];
};

/** The upload through the real dialog; the offer may already stand in the dialog (then the editor is not open yet). */
async function upload(S, off, pdf) {
  const main = P.uploadDialog(S, off, pdf, LIMIT_MS);
  main.catch(() => {});
  let stop = false;
  const t0 = Date.now();
  const watcher = (async () => {
    while (!stop) {
      const st = await S.P.evaluate((src) => {
        const d = document.querySelector('#dlg[open]');
        if (!d) return null;
        const re = new RegExp(src, 'i');
        const offer = Array.from(d.querySelectorAll('button, a, [role=button]')).some((e) => e.offsetParent !== null && !e.disabled && re.test(e.textContent.replace(/\s+/g, ' ')));
        const busy = !!d.querySelector('button[type=submit][disabled], [aria-busy=true]');
        return { offer, busy, text: d.innerText.replace(/\s+/g, ' ').trim().slice(0, 900) };
      }, OFFER_RE.source).catch(() => null);
      if (st && st.offer && !st.busy) return { opened: false, ms: Date.now() - t0, said: [st.text], dialogSays: st.text };
      await wait(250);
    }
    return null;
  })();
  const r = await Promise.race([main, watcher.then((v) => v || main)]);
  stop = true;
  return r;
}

/** Press the offer and wait until the reading has ended (nothing busy, the editor open, 1.5 s on end). */
async function takeOffer(S) {
  const btn = S.P.locator('button:visible, a:visible, [role=button]:visible').filter({ hasText: OFFER_RE }).first();
  if (!(await btn.count().catch(() => 0))) return { found: false };
  const t0 = Date.now();
  await btn.click();
  let quiet = 0;
  let seen = false;
  let finished = false;
  while (Date.now() - t0 < LIMIT_MS) {
    await wait(250);
    const st = await S.P.evaluate((busy) => ({ busy: new RegExp(busy).test(document.body.innerText) || !!document.querySelector('[aria-busy=true], #dlg[open] button[type=submit][disabled]'), editor: /^#console-envelope-/.test(location.hash) && !!document.querySelector('.fe-doc .es-page') }), BUSY_RE.source).catch(() => null);
    if (!st) continue;
    if (st.busy) seen = true;
    if (!st.busy && st.editor) {
      quiet = quiet || Date.now();
      if (Date.now() - quiet >= 1500 && (seen || Date.now() - t0 > 10000)) {
        finished = true;
        break;
      }
    } else quiet = 0;
  }
  await wait(400);
  return { found: true, finished, ms: Date.now() - t0 };
}

/** In the portal's own page: each page's kind, and on each text-less page its found boxes (places) and free rules. */
async function geometry(S, pdf) {
  const b64 = fs.readFileSync(pdf).toString('base64');
  await S.P.evaluate(async () => {
    if (window.pdfjsLib) return;
    await new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = ok;
      s.onerror = () => no(new Error('pdf.js could not be loaded'));
      document.head.appendChild(s);
    });
  });
  return S.P.evaluate(async (b64) => {
    const NS = window.CVPortal;
    const lib = window.pdfjsLib;
    if (!lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const bin = atob(b64);
    const data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    const doc = await lib.getDocument({ data, isEvalSupported: false }).promise;
    const out = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      const vp = pg.getViewport({ scale: 1 });
      const raw = await NS.anchors.walk(pg, vp, lib.OPS);
      const kind = NS.anchors.textless(raw);
      const row = { page: i, kind, boxes: [], rules: [] };
      if (kind) {
        try {
          const got = await NS.textread.page(pg, raw, { words: false });
          row.boxes = got.found.filter((b) => b.place !== false).map((b) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }));
          row.rules = got.lines.map((l) => ({ x0: l.x0, x1: l.x1, y: l.y }));
        } catch (e) {
          row.error = (e && e.code) || 'fail';
        }
      }
      out.push(row);
      pg.cleanup();
    }
    doc.destroy();
    return out;
  }, b64);
}

/** A field on a found box (most of the field inside the box grown by 2 pt) or on a free rule (its foot within 3 pt). */
const onPlace = (f, g) =>
  g.boxes.some((b) => {
    const w = f.x1 - f.x0;
    const h = f.bottom - f.top;
    return ov(f.x0, f.x1, b.x0 - 2, b.x1 + 2) >= 0.5 * w && ov(f.top, f.bottom, b.y0 - 2, b.y1 + 2) >= 0.5 * h;
  }) || g.rules.some((l) => Math.abs(l.y - f.bottom) <= 3 && ov(l.x0, l.x1, f.x0, f.x1) >= 0.5 * (f.x1 - f.x0));

/** Every page of the editor that got a field from its picture, photographed whole at 1440 pixels wide. */
async function photograph(C, S, pages, dir) {
  const cdp = await C.context.newCDPSession(S.page).catch(() => null);
  if (!cdp) return [];
  // the editor's pane given room for a whole page, and what the portal fixes or sticks to the window hidden
  await S.P.evaluate(() => {
    const st = document.createElement('style');
    st.id = 'shot-room';
    st.textContent = '.es-editor.fe { height: 3000px !important; }';
    document.head.appendChild(st);
    document.querySelectorAll('body *').forEach((e) => {
      const p = getComputedStyle(e).position;
      if ((p === 'fixed' || p === 'sticky') && !e.querySelector('.es-page') && !e.closest('.es-page')) {
        e.setAttribute('data-shot-hidden', e.style.visibility || '-');
        e.style.visibility = 'hidden';
      }
    });
  });
  const made = [];
  for (const i of pages) {
    const el = S.P.locator(`.fe-doc .es-page[data-page="${i}"]`);
    if (!(await el.count())) continue;
    await el.evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await S.P.waitForFunction((n) => { const img = document.querySelector(`.fe-doc .es-page[data-page="${n}"] img`); return img && img.complete && img.naturalWidth > 0; }, i, { timeout: 20000 }).catch(() => {});
    await el.evaluate((e) => { const r = e.getBoundingClientRect(); e.style.translate = `${-(r.left - Math.floor(r.left))}px ${-(r.top - Math.floor(r.top))}px`; });
    // the window scrolled so the page's top is at its top (the editor's pane alone may leave it lower)
    await el.evaluate((e) => window.scrollBy(0, Math.floor(e.getBoundingClientRect().top)));
    await S.P.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await wait(400);
    const r = await el.evaluate((e) => { const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height, fits: b.top >= 0 && b.bottom <= innerHeight }; });
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1440 / r.w }, captureBeyondViewport: !r.fits }).catch(() => null);
    await el.evaluate((e) => (e.style.translate = ''));
    if (!shot || !shot.data) {
      console.log(`  page ${i}: not photographed (its rectangle ${[r.x, r.y, r.w, r.h].map((v) => Math.round(v)).join(', ')} ${r.fits ? 'fits' : 'does not fit'} the window)`);
      continue;
    }
    const f = path.join(dir, `page-${pad(i)}.png`);
    fs.writeFileSync(f, Buffer.from(shot.data, 'base64'));
    made.push(f);
  }
  await S.P.evaluate(() => {
    const st = document.getElementById('shot-room');
    if (st) st.remove();
    document.querySelectorAll('[data-shot-hidden]').forEach((e) => {
      const v = e.getAttribute('data-shot-hidden');
      e.style.visibility = v === '-' ? '' : v;
      e.removeAttribute('data-shot-hidden');
    });
  });
  return made;
}

/* ---------- one document ---------- */
async function runDoc(srv, name, pdf) {
  const fails = [];
  const fail = (what) => fails.push(`${name}: ${what}`);
  const dir = mk(path.join(OUT, name));
  const sizes = P.pageSizes(pdf);
  console.log(`\n${name} (${sizes.length} pages)`);
  const browser = await chromium.launch();
  try {
    const C = await P.newContext(browser, srv);
    const S = await P.openPortal(C, srv, false);
    const off = await P.prepare(S);
    const up = await upload(S, off, pdf);
    const before = up.opened ? await P.readEditor(S, sizes) : { fields: [] };
    const screenBefore = [up.dialogSays || ''].concat(up.said || [], await toasts(S), up.opened ? await notes(S) : []).filter(Boolean).join(' | ');
    const offer = await takeOffer(S);
    if (offer.found && !offer.finished) fail(`the reading had not ended after ${Math.round(LIMIT_MS / 60000)} minutes`);
    const opened = await editorOpen(S);
    if (!opened) {
      fail('the editor did not open');
      return fails;
    }
    const after = await P.readEditor(S, sizes);
    const note = await noteText(S);
    const geo = await geometry(S, pdf);
    const textless = geo.filter((g) => g.kind).map((g) => g.page);
    const kinds = geo.reduce((o, g) => ((o[g.kind || 'text'] = (o[g.kind || 'text'] || 0) + 1), o), {});
    console.log(`  pages: ${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ')}; the offer ${offer.found ? `was pressed and the reading took ${(offer.ms / 1000).toFixed(1)} s` : 'did not appear'}`);
    geo.filter((g) => g.error).forEach((g) => console.log(`  page ${g.page}: its boxes and rules could not be found here (${g.error})`));
    const isTextless = (p) => textless.indexOf(p) >= 0;

    // before the offer
    const early = before.fields.filter((f) => isTextless(f.page));
    console.log(`  before the offer: ${early.length} fields on text-less pages; ${before.fields.length - early.length} on pages with text`);
    if (early.length) fail(`before the offer ${early.length} fields stood on text-less pages (${Array.from(new Set(early.map((f) => f.page))).join(', ')})`);
    if (textless.length && !NO_TEXT_RE.test(screenBefore)) fail('before the offer no plain sentence said that pages have no text');
    fs.writeFileSync(path.join(dir, 'screen-before.txt'), screenBefore);
    if (textless.length && !offer.found) fail('the offer to read the pages from their picture did not appear');
    if (!textless.length && offer.found) fail('the offer appeared on a document with no text-less page');

    // after the offer: the pages the summary names
    const pictured = said(note, PAGES + ' had no text, so the portal read');
    const limited = said(note, 'stopped after [^:]*: ' + PAGES + ' (?:was|were) not read');
    const lost = [].concat(said(note, PAGES + ' (?:has|have) no text and (?:was|were) not read'), said(note, 'Reading ' + PAGES + ' from (?:its|their) pictures? (?:took too long|failed)'));
    // The time for words used up: those pages are still read from their picture (boxes found, words not read).
    const wordsLeft = said(note, 'stopped after three minutes\\. On ' + PAGES + ' the boxes were found');
    console.log(`  the summary: read from the picture ${pictured.length} pages; words not read after the three minutes ${wordsLeft.length ? `${wordsLeft.length} (pages ${wordsLeft.join(', ')})` : 0}; left at the time limit ${limited.length}; not read for another reason ${lost.length}`);
    if (wordsLeft.some((p) => pictured.indexOf(p) < 0)) fail('the summary names pages whose words were not read that it does not name as read from their picture');
    const named = pictured.concat(limited, lost).sort((a, b) => a - b);
    const missingName = textless.filter((p) => named.indexOf(p) < 0);
    const wrongName = named.filter((p) => !isTextless(p));
    if (missingName.length) fail(`the summary does not name text-less pages ${missingName.join(', ')} as read or as left`);
    if (wrongName.length) fail(`the summary names pages ${wrongName.join(', ')}, which have text, among the pages without text`);
    if (pictured.some((p) => limited.indexOf(p) >= 0 || lost.indexOf(p) >= 0)) fail('the summary names a page both as read and as left');

    // after the offer: each field on a text-less page
    const byPage = {};
    after.fields.forEach((f) => (byPage[f.page] = byPage[f.page] || []).push(f));
    const shots = [];
    textless.forEach((p) => {
      const fs_ = byPage[p] || [];
      if (!fs_.length) return;
      const g = geo.find((x) => x.page === p);
      if (pictured.indexOf(p) < 0) fail(`page ${p}: ${fs_.length} fields on a page the summary does not name as read from its picture`);
      const off_ = fs_.filter((f) => !onPlace(f, g));
      const unmarked = fs_.filter((f) => !f.review);
      off_.forEach((f) => fail(`page ${p}: a ${f.kind || 'field'} on no found box and no free rule (at ${[f.x0, f.top, f.x1, f.bottom].map((v) => v.toFixed(1)).join(', ')} pt)`));
      if (unmarked.length) fail(`page ${p}: ${unmarked.length} fields not marked for review`);
      for (let a = 0; a < fs_.length; a++)
        for (let b = a + 1; b < fs_.length; b++) {
          const x = ov(fs_[a].x0, fs_[a].x1, fs_[b].x0, fs_[b].x1);
          const y = ov(fs_[a].top, fs_[a].bottom, fs_[b].top, fs_[b].bottom);
          if (x > SHARE && y > SHARE) fail(`page ${p}: a ${fs_[a].kind} and a ${fs_[b].kind} overlap`);
        }
      const k = fs_.reduce((o, f) => ((o[f.kind || 'field'] = (o[f.kind || 'field'] || 0) + 1), o), {});
      console.log(`  page ${p}: ${fs_.length} fields (${Object.entries(k).map(([kk, v]) => `${v} ${kk}`).join(', ')}); on a found place ${fs_.length - off_.length}; marked ${fs_.length - unmarked.length}`);
      shots.push(p);
    });
    // Places nobody completes, as recorded from the pictures: no field may lie mostly inside one.
    const nobody = NOBODY[name] || {};
    let onNobody = 0;
    Object.keys(nobody)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((p) => {
        const hits = {};
        (byPage[p] || []).forEach((f) => {
          const area = (f.x1 - f.x0) * (f.bottom - f.top);
          // (a region marked 'whole' is a fault only for a field over most of it: the places inside it are places)
          const r = nobody[p].find((q) => area > 0 && Math.max(0, ov(f.x0, f.x1, q[0] - 2, q[2] + 2)) * Math.max(0, ov(f.top, f.bottom, q[1] - 2, q[3] + 2)) >= 0.8 * area && (q[5] !== 'whole' || area >= 0.5 * (q[2] - q[0]) * (q[3] - q[1])));
          if (r) hits[r[4]] = (hits[r[4]] || 0) + 1;
        });
        const n = Object.values(hits).reduce((a, b) => a + b, 0);
        onNobody += n;
        console.log(`  page ${p}: ${n} fields on places nobody completes (${nobody[p].length} recorded${n ? ': ' + Object.entries(hits).map(([k, v]) => `${v} on a ${k}`).join(', ') : ''})`);
        if (n && NOBODY_GATE) fail(`page ${p}: ${n} fields on places nobody completes (${Object.entries(hits).map(([k, v]) => `${v} ${k}`).join(', ')})`);
      });
    if (Object.keys(nobody).length) console.log(`  fields on places nobody completes: ${onNobody} on ${Object.keys(nobody).length} recorded pages`);
    const onText = after.fields.filter((f) => !isTextless(f.page)).length;
    console.log(`  fields on text-less pages after the offer: ${after.fields.length - onText}; on pages with text: ${onText}`);

    // pages with text: the offer changes nothing there
    const sig = (f) => `${f.page}|${f.kind}|${f.x0.toFixed(1)}|${f.top.toFixed(1)}|${f.x1.toFixed(1)}|${f.bottom.toFixed(1)}`;
    const was = before.fields.filter((f) => !isTextless(f.page));
    const now = after.fields.filter((f) => !isTextless(f.page));
    const near = (a, b) => a.page === b.page && a.kind === b.kind && Math.abs(a.x0 - b.x0) <= 0.5 && Math.abs(a.x1 - b.x1) <= 0.5 && Math.abs(a.top - b.top) <= 0.5 && Math.abs(a.bottom - b.bottom) <= 0.5;
    const gone = was.filter((a) => !now.some((b) => near(a, b)));
    const added = now.filter((b) => !was.some((a) => near(a, b)));
    if (gone.length || added.length) fail(`on pages with text the offer changed fields (${gone.length} gone, ${added.length} added: pages ${Array.from(new Set(gone.concat(added).map((f) => f.page))).join(', ')})`);
    else if (was.length) console.log(`  pages with text: the ${was.length} fields placed on upload are unchanged (${Array.from(new Set(was.map(sig).map((s) => s.split('|')[0]))).length} pages)`);

    // pictures of every page that got a field from its picture
    const made = await photograph(C, S, shots, dir);
    console.log(`  pictures: ${made.length} of ${shots.length} pages that got fields, in ${dir}`);
    if (made.length !== shots.length) fail(`${shots.length - made.length} pages that got fields could not be photographed`);
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({ pages: sizes.length, kinds, textless, offer, before: { fields: before.fields.length, onTextless: early.length }, after: { fields: after.fields.length, onText }, summary: { pictured, wordsLeft, limited, lost }, byPage: Object.fromEntries(Object.entries(byPage).map(([p, l]) => [p, l.length])), onNobody, fields: Object.fromEntries(Object.entries(byPage).map(([p, l]) => [p, l.map((f) => [f.kind, +f.x0.toFixed(1), +f.top.toFixed(1), +f.x1.toFixed(1), +f.bottom.toFixed(1)])])), fails }, null, 1));
  } catch (e) {
    fail('the run stopped: ' + String((e && e.message) || e).slice(0, 300));
  } finally {
    await browser.close().catch(() => {});
  }
  return fails;
}

(async () => {
  mk(OUT);
  P.PORTS.from = 8891;
  P.PORTS.to = 8910;
  const srv = await P.startServers();
  console.log(`scan set: serving ${ROOT} on http://localhost:${srv.appPort}; evidence in ${OUT}`);
  const fails = [];
  try {
    for (const n of names) (await runDoc(srv, n, DOCS[n])).forEach((f) => fails.push(f));
  } finally {
    srv.close();
  }
  console.log(fails.length ? `SCANSET: FAIL - ${fails.join('; ')}` : 'SCANSET: PASS');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.log('SCANSET: FAIL - ' + String((e && e.message) || e).slice(0, 300));
  process.exit(1);
});
