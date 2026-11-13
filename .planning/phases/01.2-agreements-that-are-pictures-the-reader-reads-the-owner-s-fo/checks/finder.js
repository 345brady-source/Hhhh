#!/usr/bin/env node
/*
 * The finder alone (assets/js/picturepage.js): boxes and free rules from the pixels of a page picture, no word read.
 *
 *   node finder.js [--mode pixels|browser] [--doc form|prose|example|all] [--ink 0.19,0.20,0.22]
 *
 *   --mode pixels    no browser: each page's one picture is taken out of the PDF and handed to find()
 *       form      the answer sheet's 241 places against the boxes that are places and the free rules, at each ink
 *                 level: every place found, no false box; two runs equal; lists in reading order
 *       prose     a scanned page of running text gives no place and no free rule
 *       example   a scanned agreement gives its small empty squares and its free rules by page, and no place in its table
 *       all       the three above, and a made-up page drawn here that holds one case of every class rule
 *   --mode browser   the portal's own page draws each page of the form and searches it (NS.textread.page, words off)
 *
 * The documents are confidential and are never in the repository: they are taken by path from the scratch folder
 * (PICTURE_SCRATCH, or the session's folder under the system temp folder), working files are written only there and
 * removed again, and what is printed names a place by its page and kind only. A check that cannot find a document
 * prints "NOT RUN: ..." and exits with status 2; it is never a pass.
 * The last line is "FINDER <mode>: PASS" or "FINDER <mode>: FAIL - ..."; exit status 0 or 1.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const MODE = arg('--mode', 'pixels');
const DOC = arg('--doc', MODE === 'browser' ? 'form' : 'all');
const INKS = arg('--ink', '0.19,0.20,0.22').split(',').map(Number).filter((v) => v > 0);
const DOCS = {
  form: path.join(SCRATCH, 'xx/printed-no-text.pdf'),
  prose: path.join(SCRATCH, 'build/ocr-truth/prose-scan.pdf'),
  example: path.join(SCRATCH, 'build/ocr-truth/example-scan.pdf')
};
const SHEET = path.join(SCRATCH, 'build/ocr-truth/truth-printed.json');
const SCAN_PX_PER_PT = 150 / 72;
// The scanned example, by page: its small empty squares, and its free rules (where a line place is printed).
const EXAMPLE_SQUARES = { 4: 2, 5: 3, 6: 5, 7: 5 };
const EXAMPLE_RULES = { 2: 1, 5: 3, 7: 1, 9: 5, 11: 16, 12: 6 };
const EXAMPLE_TABLE_PAGE = 13;
const PAGE_LIMIT_MS = 2000;

const notRun = (what) => {
  console.log('NOT RUN: ' + what);
  process.exit(2);
};
const fails = [];
const fail = (s) => fails.push(s);

/* ---------- pictures out of a PDF ---------- */
/** A PGM or PPM file as grey levels: { w, h, grey }. */
function readPicture(file, toGrey) {
  const b = fs.readFileSync(file);
  let at = 0;
  const token = () => {
    for (;;) {
      while (at < b.length && /\s/.test(String.fromCharCode(b[at]))) at++;
      if (b[at] !== 35) break; // a comment line
      while (at < b.length && b[at] !== 10) at++;
    }
    const from = at;
    while (at < b.length && !/\s/.test(String.fromCharCode(b[at]))) at++;
    return b.toString('latin1', from, at);
  };
  const kind = token();
  const w = +token();
  const h = +token();
  const most = +token();
  at++; // the one white-space byte before the pixels
  if ((kind !== 'P5' && kind !== 'P6') || most !== 255) throw new Error('not an 8-bit grey or colour picture: ' + path.basename(file));
  if (kind === 'P5') return { w, h, grey: new Uint8Array(b.buffer, b.byteOffset + at, w * h).slice() };
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0, j = at; i < w * h; i++, j += 3) {
    rgba[4 * i] = b[j];
    rgba[4 * i + 1] = b[j + 1];
    rgba[4 * i + 2] = b[j + 2];
    rgba[4 * i + 3] = 255;
  }
  return { w, h, grey: toGrey(rgba, w, h) };
}
/** Each page's one picture, taken out of the PDF into a folder under the scratch folder, read, and removed again. */
function pictures(name, toGrey) {
  const dir = path.join(SCRATCH, 'exec-012', `finder-${name}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const list = execFileSync('pdfimages', ['-list', DOCS[name]], { encoding: 'utf8' })
      .split('\n')
      .slice(2)
      .map((l) => l.trim().split(/\s+/))
      .filter((c) => c.length > 3 && c[2] === 'image');
    execFileSync('pdfimages', [DOCS[name], path.join(dir, 'p')], { stdio: 'ignore' });
    const pages = {};
    list.forEach((c) => (pages[+c[0]] = (pages[+c[0]] || []).concat(+c[1])));
    return Object.keys(pages)
      .map(Number)
      .sort((a, b) => a - b)
      .map((p) => {
        if (pages[p].length !== 1) notRun(`page ${p} of the ${name} document is not one picture`);
        const stem = path.join(dir, 'p-' + String(pages[p][0]).padStart(3, '0'));
        const file = [stem + '.ppm', stem + '.pgm'].find((f) => fs.existsSync(f));
        if (!file) notRun(`the picture of page ${p} of the ${name} document could not be taken out as grey or colour`);
        return Object.assign({ page: p }, readPicture(file, toGrey));
      });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* ---------- judging ---------- */
const ordered = (list) => list.every((b, i) => !i || list[i - 1].y0 < b.y0 || (list[i - 1].y0 === b.y0 && list[i - 1].x0 <= b.x0));
/**
 * The places of one page (boxes in the units of the candidates) against the candidates, one candidate to one place.
 * near(place, candidate) says whether the candidate lies on the place. A found box is tried on every place before any
 * free rule is: a printed box must be found as a box, and a rule along one of its sides does not stand in for it.
 * Returns { missed: [place], spare: [candidate], byBox, byRule }.
 */
function pair(places, cands, near) {
  const used = new Set();
  let missed = places;
  const count = [true, false].map((box) => {
    const left = [];
    missed.forEach((p) => {
      const i = cands.findIndex((c, k) => c.box === box && !used.has(k) && near(p, c));
      if (i < 0) left.push(p);
      else used.add(i);
    });
    const n = missed.length - left.length;
    missed = left;
    return n;
  });
  return { missed, spare: cands.filter((c, k) => !used.has(k)), byBox: count[0], byRule: count[1] };
}
// The answer sheet's places are 237 printed boxes and 4 short rules.
const FORM_BOXES = 237;
const FORM_RULES = 4;
const kinds = (list) => {
  const n = {};
  list.forEach((p) => (n[p.kind] = (n[p.kind] || 0) + 1));
  return Object.keys(n).sort().map((k) => `${n[k]} ${k}`).join(', ');
};
const isPlace = (b) => b.place !== false;

/* ---------- mode pixels ---------- */
function formPixels(find, toGrey, sheet) {
  const pics = pictures('form', toGrey);
  INKS.forEach((ink) => {
    console.log(`\nthe form, ink ${ink.toFixed(2)}`);
    let found = 0;
    let all = 0;
    let falseBoxes = 0;
    let byBox = 0;
    let byRule = 0;
    pics.forEach((pic) => {
      const m = sheet.image_placement_pt[String(pic.page)];
      if (!m) return fail(`the form, page ${pic.page}: the answer sheet has no picture rectangle for it`);
      const sx = pic.w / (m.x1 - m.x0);
      const sy = pic.h / (m.y1 - m.y0);
      const t0 = Date.now();
      const r = find(pic.grey, pic.w, pic.h, sx, { ink });
      const ms = Date.now() - t0;
      const again = find(pic.grey, pic.w, pic.h, sx, { ink });
      if (JSON.stringify(again) !== JSON.stringify(r)) fail(`the form, ink ${ink}, page ${pic.page}: two runs on the same picture differ`);
      if (!ordered(r.boxes) || !ordered(r.rules)) fail(`the form, ink ${ink}, page ${pic.page}: the lists are not in reading order`);
      if (r.boxes.some((b) => typeof b.place !== 'boolean' || typeof b.why !== 'string' || typeof b.shared !== 'boolean')) fail(`the form, ink ${ink}, page ${pic.page}: a box does not say whether it is a place`);
      const places = sheet.fields.filter((f) => f.page === pic.page).map((f) => ({ kind: f.kind, x0: (f.x0 - m.x0) * sx, y0: (f.y0 - m.y0) * sy, x1: (f.x1 - m.x0) * sx, y1: (f.y1 - m.y0) * sy }));
      // A free rule is compared as a box reaching 12 pixels above it (the room one writes in).
      const cands = r.boxes.filter(isPlace).map((b) => ({ box: true, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })).concat(r.rules.map((q) => ({ box: false, x0: q.x0, y0: q.y0 - 12, x1: q.x1, y1: q.y1 })));
      const near = (p, c) => {
        const cx = (c.x0 + c.x1) / 2;
        const cy = (c.y0 + c.y1) / 2;
        return cx >= p.x0 - 4 && cx <= p.x1 + 4 && cy >= p.y0 - 4 && cy <= p.y1 + 4 && Math.abs(c.x1 - c.x0 - (p.x1 - p.x0)) < 0.4 * (p.x1 - p.x0) + 4;
      };
      const j = pair(places, cands, near);
      const spareBoxes = j.spare.filter((c) => c.box).length;
      const refused = r.boxes.filter((b) => !isPlace(b));
      found += places.length - j.missed.length;
      all += places.length;
      falseBoxes += spareBoxes;
      byBox += j.byBox;
      byRule += j.byRule;
      console.log(`  page ${pic.page}: paper ${r.paper}, print ${Math.round(r.print)}, places ${places.length}, found ${places.length - j.missed.length} (${j.byBox} by a box, ${j.byRule} by a free rule), false boxes ${spareBoxes}, unmatched rules ${j.spare.length - spareBoxes}${refused.length ? `, boxes that are no place ${refused.length} (${refused.map((b) => b.why).join(', ')})` : ''}, ${ms} ms`);
      if (j.missed.length) fail(`the form, ink ${ink}, page ${pic.page}: not found: ${kinds(j.missed)}`);
      if (spareBoxes) fail(`the form, ink ${ink}, page ${pic.page}: ${spareBoxes} false box${spareBoxes > 1 ? 'es' : ''}`);
    });
    console.log(`  ${byBox} places found by a box and ${byRule} by a free rule (the sheet: ${FORM_BOXES} boxes and ${FORM_RULES} short rules)`);
    console.log(`  ink ${ink.toFixed(2)}: found ${found} of ${all}, false boxes ${falseBoxes}`);
    if (all !== 241) fail(`the form, ink ${ink}: the answer sheet gave ${all} places for the pages read, not 241`);
    if (byBox !== FORM_BOXES || byRule !== FORM_RULES) fail(`the form, ink ${ink}: ${byBox} places were found by a box and ${byRule} by a free rule, not ${FORM_BOXES} and ${FORM_RULES}`);
  });
}
function scanPixels(name, find, toGrey) {
  const pics = pictures(name, toGrey);
  console.log(`\n${name === 'prose' ? 'the scan of running text' : 'the scanned example'}, ink ${find.INK.toFixed(2)}`);
  if (name === 'prose' && pics.length !== 6) fail(`prose: ${pics.length} pages, not 6`);
  pics.forEach((pic) => {
    const r = find(pic.grey, pic.w, pic.h, SCAN_PX_PER_PT);
    const places = r.boxes.filter(isPlace);
    const squares = places.filter((b) => b.small).length;
    const refused = r.boxes.filter((b) => !isPlace(b));
    if (name === 'prose') {
      console.log(`  page ${pic.page}: ${places.length} places, ${r.rules.length} rules${refused.length ? ` (boxes that are no place: ${refused.length})` : ''}`);
      if (places.length || r.rules.length) fail(`prose, page ${pic.page}: ${places.length} places and ${r.rules.length} free rules on running text`);
      return;
    }
    const wantSquares = EXAMPLE_SQUARES[pic.page] || 0;
    const wantRules = EXAMPLE_RULES[pic.page];
    console.log(`  page ${pic.page}: ${places.length} places (${squares} small empty squares, expected ${wantSquares}), ${r.rules.length} rules${wantRules == null ? ' (not judged here: the line rules decide them)' : `, expected ${wantRules}`}${refused.length ? `; boxes that are no place: ${refused.length} (${refused.map((b) => `${b.why} ${b.ink.toFixed(3)}`).join(', ')})` : ''}`);
    if (squares !== wantSquares) fail(`example, page ${pic.page}: ${squares} small empty squares, expected ${wantSquares}`);
    if (wantRules != null && r.rules.length !== wantRules) fail(`example, page ${pic.page}: ${r.rules.length} free rules, expected ${wantRules}`);
    if (pic.page === EXAMPLE_TABLE_PAGE && places.length) fail(`example, page ${pic.page}: ${places.length} cells of its table count as places`);
  });
}

/* ---------- a made-up page: every class rule on a page that is no document ---------- */
/**
 * A page drawn here, 2 pixels to the point, inside a page border: a tick box; two boxes stacked one pixel apart; two
 * stacked boxes whose frames touch; two boxes side by side with one stroke between them; a ruled table of four cells
 * with print in one; a roomy box with a short caption in it and one full of print; a box whose strokes fall between
 * two pixels; a box too narrow to write in; a level rule; and a rule turned by 0.4 degrees.
 */
function madeUp(pp) {
  const W = 700;
  const H = 560;
  const S = 2;
  const grey = new Uint8Array(W * H).fill(255);
  const dot = (x, y, d) => {
    if (255 - d < grey[y * W + x]) grey[y * W + x] = 255 - d;
  };
  const level = (y, x0, x1, d) => {
    for (let x = x0; x <= x1; x++) dot(x, y, d);
  };
  const upright = (x, y0, y1, d) => {
    for (let y = y0; y <= y1; y++) dot(x, y, d);
  };
  const frame = (x0, y0, x1, y1) => {
    level(y0, x0, x1, 215);
    level(y1, x0, x1, 215);
    upright(x0, y0, y1, 215);
    upright(x1, y0, y1, 215);
    return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  };
  // Print that is no stroke: small dark squares, each shorter than the shortest stroke.
  const print = (x0, y0, across, down, step) => {
    for (let r = 0; r < down; r++) for (let c = 0; c < across; c++) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) dot(x0 + c * step + x, y0 + r * step + y, 215);
  };
  frame(10, 10, 689, 549); // the page border
  const want = [];
  const expect = (name, r, facts) => want.push(Object.assign({ name }, r, facts));
  expect('a tick box', frame(40, 40, 55, 55), { place: true, small: true, shared: false, why: '' });
  expect('the upper of two boxes one pixel apart', frame(40, 80, 130, 99), { place: true, shared: false, why: '' });
  expect('the lower of two boxes one pixel apart', frame(40, 101, 130, 120), { place: true, shared: false, why: '' });
  expect('the upper of two boxes whose frames touch', frame(400, 80, 490, 100), { place: true, shared: true, why: '' });
  expect('the lower of two boxes whose frames touch', frame(400, 101, 490, 121), { place: true, shared: true, why: '' });
  frame(200, 80, 320, 100);
  upright(260, 80, 100, 215);
  expect('the left of two boxes with one stroke between', { x0: 200, y0: 80, x1: 261, y1: 101 }, { place: true, shared: true, why: '' });
  expect('the right of two boxes with one stroke between', { x0: 260, y0: 80, x1: 321, y1: 101 }, { place: true, shared: true, why: '' });
  frame(200, 140, 360, 188);
  level(164, 200, 360, 215);
  upright(280, 140, 188, 215);
  print(300, 172, 3, 1, 10);
  expect('an empty cell of a table', { x0: 200, y0: 140, x1: 281, y1: 165 }, { place: true, shared: true, why: '' });
  expect('an empty cell of a table', { x0: 280, y0: 140, x1: 361, y1: 165 }, { place: true, shared: true, why: '' });
  expect('an empty cell of a table', { x0: 200, y0: 164, x1: 281, y1: 189 }, { place: true, shared: true, why: '' });
  expect('a cell of a table with print in it', { x0: 280, y0: 164, x1: 361, y1: 189 }, { place: false, shared: true, why: 'table' });
  expect('a roomy box with a short caption in it', frame(40, 140, 160, 170), { place: true, shared: false, why: '' });
  print(60, 150, 6, 1, 10);
  expect('a box full of print', frame(40, 190, 160, 220), { place: false, shared: false, why: 'filled' });
  print(48, 196, 15, 3, 7);
  // Strokes that fall between two pixels: a dark row or column with a half-dark one beside it, inside the box.
  level(300, 40, 160, 159);
  level(301, 41, 159, 62);
  level(312, 40, 160, 180);
  upright(40, 300, 312, 130);
  upright(41, 300, 312, 105);
  upright(160, 300, 312, 135);
  upright(159, 301, 311, 60);
  expect('a box whose strokes fall between two pixels', { x0: 41, y0: 300, x1: 161, y1: 313 }, { place: true, shared: false, why: '' });
  expect('a box too narrow to write in', frame(200, 330, 219, 359), { place: false, shared: false, why: 'narrow' });
  level(260, 40, 200, 215);
  const lines = [{ name: 'a level rule', x0: 40, x1: 201, y0: 260, y1: 261 }];
  // A rule turned by 0.4 degrees: its darkness is shared between the two rows it crosses.
  for (let x = 240; x <= 640; x++) {
    const yf = 300 - (x - 240) * Math.tan((0.4 * Math.PI) / 180);
    const y = Math.floor(yf);
    dot(x, y, Math.round(215 * (1 - (yf - y))));
    dot(x, y + 1, Math.round(215 * (yf - y)));
  }
  lines.push({ name: 'a rule turned by 0.4 degrees', x0: 240, x1: 641, y0: 297, y1: 302 });

  console.log('\na made-up page (no document), ink ' + pp.INK.toFixed(2));
  const r = pp.find(grey, W, H, S);
  const bad = [];
  if (JSON.stringify(pp.find(grey, W, H, S)) !== JSON.stringify(r)) bad.push('two runs on the same picture differ');
  if (!ordered(r.boxes) || !ordered(r.rules)) bad.push('the lists are not in reading order');
  if (r.boxes.some((a) => r.boxes.some((b) => a !== b && b.x0 >= a.x0 && b.x1 <= a.x1 && b.y0 >= a.y0 && b.y1 <= a.y1))) bad.push('a reported box holds another');
  const used = new Set();
  want.forEach((e) => {
    const b = r.boxes.find((q) => !used.has(q) && Math.abs(q.x0 - e.x0) <= 1 && Math.abs(q.y0 - e.y0) <= 1 && Math.abs(q.x1 - e.x1) <= 1 && Math.abs(q.y1 - e.y1) <= 1);
    if (!b) return bad.push(`${e.name}: not found as a box`);
    used.add(b);
    const off = ['place', 'shared', 'why', 'small'].filter((k) => e[k] !== undefined && b[k] !== e[k]);
    if (off.length) bad.push(`${e.name}: ${off.map((k) => `${k} is ${JSON.stringify(b[k])}, not ${JSON.stringify(e[k])}`).join(', ')}`);
  });
  if (r.boxes.length !== want.length) bad.push(`${r.boxes.length} boxes, not the ${want.length} drawn`);
  lines.forEach((e) => {
    const hit = r.rules.filter((q) => q.y0 >= e.y0 - 1 && q.y1 <= e.y1 + 1 && q.x0 < e.x1 && q.x1 > e.x0);
    if (hit.length !== 1 || Math.abs(hit[0].x0 - e.x0) > 2 || Math.abs(hit[0].x1 - e.x1) > 2) bad.push(`${e.name}: ${hit.length === 1 ? 'found with other ends' : `found as ${hit.length} rules, not as one`}`);
  });
  // Nothing printed, and a picture that cannot be searched.
  const blank = pp.find(new Uint8Array(200 * 200).fill(255), 200, 200, 1.5);
  if (blank.boxes.length || blank.rules.length) bad.push('blank paper gives a box or a rule');
  [[0, 0], [4000, 4000]].forEach(([w, h]) => {
    try {
      pp.find(new Uint8Array(0), w, h, 1.5);
      bad.push(`a picture of ${w} x ${h} pixels was not refused`);
    } catch (e) {
      if (e.code !== 'size') bad.push(`a picture of ${w} x ${h} pixels was refused without the code "size"`);
    }
  });
  console.log(`  ${want.length} boxes drawn, ${r.boxes.length} found (${r.boxes.filter(isPlace).length} places; no place: ${r.boxes.filter((b) => !isPlace(b)).map((b) => b.why).join(', ') || 'none'}); 2 rules drawn, ${r.rules.length} free rules found with the page border's; blank paper: ${blank.boxes.length} boxes, ${blank.rules.length} rules`);
  bad.forEach((s) => fail('the made-up page: ' + s));
}

/* ---------- mode browser ---------- */
async function formBrowser(sheet) {
  const harness = require(path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/harness.js'));
  const h = await harness.start();
  try {
    const page = await h.context.newPage();
    page.on('pageerror', (e) => h.errors.push(String(e)));
    await page.goto(h.base + '/diy.html');
    await page.waitForFunction(() => !!(window.CVPortal && window.CVPortal.textread && window.CVPortal.picturepage && window.CVPortal.anchors));
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });
    const b64 = fs.readFileSync(DOCS.form).toString('base64');
    const pages = await page.evaluate(async (b64) => {
      const NS = window.CVPortal;
      const lib = window.pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
        const t0 = performance.now();
        const got = await NS.textread.page(pg, raw, { words: false, trace: true });
        const ms = performance.now() - t0;
        out.push({ page: i, kind, ms, trace: got.trace || null, words: (got.words || []).length, found: got.found.map((b) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, place: b.place, why: b.why })), rules: got.segs.filter((s) => s.o === 'h' && !s.frame).map((s) => ({ x0: s.a0, x1: s.a1, y: s.c })) });
        pg.cleanup();
      }
      doc.destroy();
      return out;
    }, b64);
    console.log('\nthe form, drawn and searched by the portal\'s own page (no word read)');
    let found = 0;
    let all = 0;
    let falseBoxes = 0;
    let byBox = 0;
    let byRule = 0;
    pages.forEach((pg) => {
      const places = sheet.fields.filter((f) => f.page === pg.page).map((f) => ({ kind: f.kind, x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 }));
      // In points. A free rule is compared as a box reaching 8 pt above it.
      const cands = pg.found.filter(isPlace).map((b) => ({ box: true, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })).concat(pg.rules.map((q) => ({ box: false, x0: q.x0, y0: q.y - 8, x1: q.x1, y1: q.y + 0.5 })));
      const near = (p, c) => {
        const cx = (c.x0 + c.x1) / 2;
        const cy = (c.y0 + c.y1) / 2;
        if (cx >= p.x0 - 3 && cx <= p.x1 + 3 && cy >= p.y0 - 3 && cy <= p.y1 + 3) return true;
        const ox = Math.min(p.x1, c.x1) - Math.max(p.x0, c.x0);
        const oy = Math.min(p.y1, c.y1) - Math.max(p.y0, c.y0);
        return ox > 0 && oy > 0 && ox * oy >= 0.4 * Math.min((p.x1 - p.x0) * (p.y1 - p.y0), (c.x1 - c.x0) * (c.y1 - c.y0));
      };
      const j = pair(places, cands, near);
      const spareBoxes = j.spare.filter((c) => c.box).length;
      found += places.length - j.missed.length;
      all += places.length;
      falseBoxes += spareBoxes;
      byBox += j.byBox;
      byRule += j.byRule;
      console.log(`  page ${pg.page}: ${pg.kind || 'has text'}, paper ${pg.trace ? pg.trace.paper : '?'}, print ${pg.trace ? Math.round(pg.trace.print) : '?'}, places ${places.length}, found ${places.length - j.missed.length} (${j.byBox} by a box, ${j.byRule} by a free rule), false boxes ${spareBoxes}, unmatched rules ${j.spare.length - spareBoxes}, ${Math.round(pg.ms)} ms`);
      if (pg.kind !== 'picture') fail(`browser, page ${pg.page}: not taken as a picture of a page`);
      if (pg.words) fail(`browser, page ${pg.page}: ${pg.words} words were read with words switched off`);
      if (j.missed.length) fail(`browser, page ${pg.page}: not found: ${kinds(j.missed)}`);
      if (spareBoxes) fail(`browser, page ${pg.page}: ${spareBoxes} false box${spareBoxes > 1 ? 'es' : ''}`);
      if (pg.ms >= PAGE_LIMIT_MS) fail(`browser, page ${pg.page}: searched in ${Math.round(pg.ms)} ms, over ${PAGE_LIMIT_MS}`);
    });
    console.log(`  ${byBox} places found by a box and ${byRule} by a free rule (the sheet: ${FORM_BOXES} boxes and ${FORM_RULES} short rules)`);
    console.log(`  found ${found} of ${all}, false boxes ${falseBoxes}`);
    if (all !== 241) fail(`browser: the answer sheet gave ${all} places for the pages read, not 241`);
    if (byBox !== FORM_BOXES || byRule !== FORM_RULES) fail(`browser: ${byBox} places were found by a box and ${byRule} by a free rule, not ${FORM_BOXES} and ${FORM_RULES}`);
    h.errors.forEach((e) => fail('browser: the page reported an error: ' + e.slice(0, 200)));
  } finally {
    await h.stop();
  }
}

(async () => {
  if (MODE !== 'pixels' && MODE !== 'browser') notRun(`--mode ${MODE} is not a mode (pixels or browser)`);
  const names = DOC === 'all' ? ['form', 'prose', 'example'] : [DOC];
  if (names.some((n) => !DOCS[n])) notRun(`--doc ${DOC} is not a document (form, prose, example or all)`);
  if (MODE === 'browser' && (names.length !== 1 || names[0] !== 'form')) notRun('--mode browser reads the form only (--doc form)');
  if (!INKS.length) notRun('--ink names no ink level');
  names.forEach((n) => fs.existsSync(DOCS[n]) || notRun(`the ${n} document is not at ${DOCS[n]}`));
  if (names.includes('form') && !fs.existsSync(SHEET)) notRun('the answer sheet is not at ' + SHEET);
  const finder = path.join(ROOT, 'assets/js/picturepage.js');
  if (!fs.existsSync(finder)) notRun('the finder is not at ' + finder);
  const sheet = names.includes('form') ? JSON.parse(fs.readFileSync(SHEET, 'utf8')) : null;
  if (MODE === 'pixels') {
    try {
      execFileSync('pdfimages', ['-v'], { stdio: 'ignore' });
    } catch (e) {
      notRun('the pdfimages tool is not installed');
    }
    const pp = require(finder);
    const find = Object.assign((g, w, h, s, o) => pp.find(g, w, h, s, o), { INK: pp.INK });
    names.forEach((n) => (n === 'form' ? formPixels(find, pp.toGrey, sheet) : scanPixels(n, find, pp.toGrey)));
    if (DOC === 'all') madeUp(pp);
  } else await formBrowser(sheet);
  console.log('');
  console.log(fails.length ? `FINDER ${MODE}: FAIL - ${fails.join('; ')}` : `FINDER ${MODE}: PASS`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.log(`FINDER ${MODE}: FAIL - the check itself stopped: ${String((e && e.stack) || e).slice(0, 600)}`);
  process.exit(1);
});
