#!/usr/bin/env node
// The official tax forms and their maps (plan 06-10, D-04, D-05), no browser:
//   node form-maps.js [--only W-9,W-8BEN]
// For each form: the bundled file's pin (SHA256SUMS, the map and the D-05 value agree with the file); the file's own field
// list read live and compared with the map both ways (every field mapped, unused or removed; every mapped name in the
// file; kinds, lengths and on-values as the file has them; the same names as the planner's listing); a copy with one byte
// changed is refused; sample fills each leave zero fields, every filled value inside its own field's rectangle and
// nowhere else (pdftotext -bbox against the blank form), each ticked box inked inside its rectangle and nothing else on
// the page changed (pixel comparison with the blank form); a fill with every answer empty prints the blank form's text;
// the e-sign places lie on the page beside their printed words. Filled pages are written to SCRATCH/exec-06-10/filled/.
// The last line is "FORM MAPS: PASS (forms run: N)" or "FORM MAPS: FAIL (forms run: N) - <failed forms>".
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const Lib = require('./lib.js');

const ROOT = Lib.ROOT;
const OUT = process.env.FORM_MAPS_OUT || path.join(Lib.SCRATCH, 'exec-06-10', 'filled');
const WORK = path.join(OUT, 'work');
fs.mkdirSync(WORK, { recursive: true });
const L = require(path.join(Lib.VENDOR, 'pdflib/package/dist/pdf-lib.min.js'));
const fontkit = require(path.join(Lib.VENDOR, 'fontkit/package/dist/fontkit.umd.js'));
const FONT = fs.readFileSync(path.join(Lib.VENDOR, 'dejavu/package/ttf/DejaVuSans.ttf'));
const LISTING = path.join(Lib.SCRATCH, 'irs-forms', 'fields.json');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const SRC = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** taxmaps.js and taxforms.js in a fresh sandbox with window.CVPortal = {}. */
function load() {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window });
  vm.runInContext(SRC('assets/js/taxmaps.js'), ctx, { filename: 'taxmaps.js' });
  vm.runInContext(SRC('assets/js/taxforms.js'), ctx, { filename: 'taxforms.js' });
  return window.CVPortal;
}
const fillOpts = { fontkit, fontBytes: FONT, sha256: (b) => sha(Buffer.from(b)) };

/** The file's own field list: name, kind, maxLen, on-value and widget rectangles (points, y from the top). */
async function liveFields(bytes) {
  const pdf = await L.PDFDocument.load(bytes, { updateMetadata: false });
  const pages = pdf.getPages();
  const refPage = {};
  pages.forEach((pg, i) => {
    const annots = pg.node.Annots();
    if (annots) annots.asArray().forEach((r) => (refPage[String(r)] = i + 1));
  });
  return pdf
    .getForm()
    .getFields()
    .map((f) => {
      let kind = 'other';
      let maxLen = null;
      let on = null;
      if (f instanceof L.PDFTextField) {
        maxLen = f.getMaxLength() || null;
        kind = f.isCombed() ? 'comb' : 'text';
      } else if (f instanceof L.PDFCheckBox) {
        kind = 'check';
        const v = f.acroField.getWidgets()[0].getOnValue();
        on = v ? (v.decodeText ? v.decodeText() : String(v).replace(/^\//, '')) : null;
      } else if (f instanceof L.PDFSignature) kind = 'sig';
      const rects = f.acroField.getWidgets().map((w) => {
        const r = w.getRectangle();
        const page = refPage[String(pdf.context.getObjectRef(w.dict))] || 0;
        const ph = page ? pages[page - 1].getHeight() : 0;
        return { page, x: r.x, y: r.y, w: r.width, h: r.height, top: ph - r.y - r.height };
      });
      return { name: f.getName(), kind, maxLen, on, rects };
    });
}

/** pdftotext -bbox words of one page: { w, h, words: [{ t, x0, y0, x1, y1 }] } (points, y from the top). */
function words(file, page) {
  const out = path.join(WORK, `bbox-${process.pid}.html`);
  const r = spawnSync('pdftotext', ['-f', String(page), '-l', String(page), '-bbox', file, out]);
  if (r.status !== 0) throw new Error('pdftotext failed on ' + file);
  const t = fs.readFileSync(out, 'utf8');
  const pg = /<page width="([\d.]+)" height="([\d.]+)"/.exec(t);
  const list = [];
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  let m;
  const ent = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  while ((m = re.exec(t))) list.push({ t: ent(m[5]), x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4] });
  return { w: +pg[1], h: +pg[2], words: list };
}
function allText(file) {
  const r = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error('pdftotext failed on ' + file);
  return r.stdout;
}
/** A grey render of one page at dpi: { w, h, px: Uint8Array }; tag 'blank' hides the widgets. */
function gray(file, page, dpi, tag) {
  const pre = path.join(WORK, `${tag}-${process.pid}`);
  const args = ['-gray', '-r', String(dpi), '-f', String(page), '-l', String(page), '-singlefile'];
  // the blank form is rendered without its widgets: the page as printed, with every box empty
  if (tag === 'blank') args.push('-hide-annotations');
  const r = spawnSync('pdftoppm', args.concat([file, pre]));
  if (r.status !== 0) throw new Error('pdftoppm failed on ' + file);
  const b = fs.readFileSync(pre + '.pgm');
  const m = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(b.subarray(0, 64).toString('latin1'));
  return { w: +m[1], h: +m[2], px: b.subarray(m[0].length) };
}
const center = (wd) => [(wd.x0 + wd.x1) / 2, (wd.y0 + wd.y1) / 2];
const inside = (wd, r, tol) => {
  const [cx, cy] = center(wd);
  return cx >= r.x - tol && cx <= r.x + r.w + tol && cy >= r.top - tol && cy <= r.top + r.h + tol;
};
const overlaps = (wd, r) => wd.x1 > r.x && wd.x0 < r.x + r.w && wd.y1 > r.top && wd.y0 < r.top + r.h;
/** An overlay (page fractions) in points with y from the top. */
const pts = (o, pw, ph) => ({ x: o.x * pw, top: o.y * ph, w: o.w * pw, h: o.h * ph });

/**
 * One form part. spec: { key (the map's key), d05 (the owner's recorded SHA-256), listing (key in fields.json), counts,
 * cases: [{ id, answers }], overlays(ctx) }.
 */
function formPart(spec) {
  return async ({ check }) => {
    const NS = load();
    const map = NS.taxmaps[spec.key];
    check('the map exists', !!map, spec.key);
    if (!map) return;
    check('the engine reads its maps from the same object', NS.taxforms && NS.taxforms.MAPS[spec.key] === map);
    const file = path.join(ROOT, map.file);
    const bytes = fs.readFileSync(file);
    const h = sha(bytes);
    // pins
    const sums = SRC('assets/forms/SHA256SUMS');
    check('SHA256SUMS pins the bundled file', sums.split('\n').some((l) => l === `${h}  ${path.basename(map.file)}`), h);
    check("the map's pin equals the file's SHA-256", map.sha256 === h, { map: map.sha256, file: h });
    check('the file is the one recorded in D-05', h === spec.d05, h);

    // coverage, both ways, against the live field list
    const live = await liveFields(bytes);
    const byName = {};
    live.forEach((f) => (byName[f.name] = f));
    const counts = { total: live.length, text: 0, comb: 0, check: 0, sig: 0, other: 0 };
    live.forEach((f) => counts[f.kind]++);
    check('the live field counts are as listed', JSON.stringify(counts) === JSON.stringify(spec.counts), counts);
    let listing = null;
    try {
      listing = JSON.parse(fs.readFileSync(LISTING, 'utf8')).forms[spec.listing];
    } catch (e) {
      listing = null;
    }
    if (listing) {
      const a = listing.fields.map((f) => f.name).sort();
      const b = live.map((f) => f.name).sort();
      check("the live names equal the planner's listing", JSON.stringify(a) === JSON.stringify(b), { listing: a.length, live: b.length });
    }
    const where = {};
    const note = (n, how) => (where[n] = (where[n] || []).concat(how));
    Object.keys(map.fields).forEach((k) => note(map.fields[k].name, 'field ' + k));
    Object.keys(map.unused || {}).forEach((r) => map.unused[r].forEach((n) => note(n, 'unused')));
    (map.removeBeforeFlatten || []).forEach((n) => note(n, 'removed'));
    const missing = live.filter((f) => !where[f.name]).map((f) => f.name);
    const twice = Object.keys(where).filter((n) => where[n].length > 1);
    const ghost = Object.keys(where).filter((n) => !byName[n]);
    check('every live field is mapped, unused or removed', !missing.length, missing);
    check('no field is listed twice', !twice.length, twice);
    check('every name in the map is in the file', !ghost.length, ghost);
    Object.keys(map.unused || {}).forEach((r) => check(`unused reason given: ${r.slice(0, 40)}`, r.trim().length > 20));
    const kindBad = [];
    Object.keys(map.fields).forEach((k) => {
      const f = map.fields[k];
      const l = byName[f.name];
      if (!l) return;
      if (l.kind !== f.kind) kindBad.push(`${k}: map ${f.kind}, file ${l.kind}`);
      if ((f.max || null) !== l.maxLen) kindBad.push(`${k}: map max ${f.max}, file ${l.maxLen}`);
      if (f.kind === 'check' && f.on !== l.on) kindBad.push(`${k}: map on ${f.on}, file ${l.on}`);
      if (f.kind === 'comb' && !Object.keys(map.groups || {}).some((g) => map.groups[g].indexOf(k) >= 0)) kindBad.push(`${k}: comb outside a group`);
    });
    check('kinds, lengths and on-values match the file', !kindBad.length, kindBad);
    (map.removeBeforeFlatten || []).forEach((n) => check(`removed field ${n} is a signature field`, byName[n] && byName[n].kind === 'sig'));
    Object.keys(spec.groups || {}).forEach((g) => {
      const lens = ((map.groups || {})[g] || []).map((k) => map.fields[k] && byName[map.fields[k].name] && byName[map.fields[k].name].maxLen);
      check(`the ${g} group's cells are ${spec.groups[g].join('-')} long in the file`, JSON.stringify(lens) === JSON.stringify(spec.groups[g]), lens);
    });

    // each mapped field is the one its key means: the words printed beside it on the blank form (above it, left or
    // right of it on its line, or under it) match the key's label, so a swapped name puts a value beside the wrong label
    const printed = words(file, 1).words;
    const groupOf = {};
    Object.keys(map.groups || {}).forEach((g) => map.groups[g].forEach((k, i) => (groupOf[k] = { g, i })));
    const needAnchor = Object.keys(map.fields).filter((k) => !groupOf[k] || groupOf[k].i === 0);
    const noAnchor = needAnchor.filter((k) => !(spec.anchors || {})[k]);
    check('every mapped field has a printed label to be checked against', !noAnchor.length, noAnchor);
    const besideText = (r, mode) => {
      const mid = r.top + r.h / 2;
      const sameLine = (w) => Math.abs((w.y0 + w.y1) / 2 - mid) < 5;
      let ws = [];
      if (mode === 'above') ws = printed.filter((w) => w.y1 <= r.top + 1 && w.y1 >= r.top - 12 && w.x1 > r.x && w.x0 < r.x + r.w);
      else if (mode === 'under') ws = printed.filter((w) => w.y0 >= r.top + r.h - 1 && w.y0 <= r.top + r.h + 12 && w.x1 > r.x && w.x0 < r.x + r.w);
      else if (mode === 'left') ws = printed.filter((w) => sameLine(w) && w.x1 <= r.x + 1);
      else if (mode === 'right') ws = printed.filter((w) => sameLine(w) && w.x0 >= r.x + r.w - 1 && w.x0 <= r.x + r.w + 90);
      return ws
        .sort((a, b) => (mode === 'left' || mode === 'right' ? a.x0 - b.x0 : a.y0 - b.y0 || a.x0 - b.x0))
        .map((w) => w.t)
        .join(' ');
    };
    const labelBad = [];
    Object.keys(spec.anchors || {}).forEach((k) => {
      const f = map.fields[k];
      const l = f && byName[f.name];
      if (!l) return labelBad.push(`${k}: not in the map or the file`);
      const [mode, re] = spec.anchors[k];
      const t = besideText(l.rects[0], mode);
      if (!re.test(t)) labelBad.push(`${k} (${mode}): "${t.slice(0, 80)}" does not match ${re}`);
    });
    Object.keys(spec.below || {}).forEach((k) => {
      const a = byName[(map.fields[k] || {}).name];
      const b = byName[(map.fields[spec.below[k]] || {}).name];
      if (!a || !b) return labelBad.push(`${k}: below ${spec.below[k]} cannot be checked`);
      const ra = a.rects[0];
      const rb = b.rects[0];
      const gap = ra.top - (rb.top + rb.h);
      if (!(gap >= 0 && gap < 30)) labelBad.push(`${k}: not the row under ${spec.below[k]} (gap ${gap.toFixed(1)})`);
    });
    Object.keys(map.groups || {}).forEach((g) => {
      const rs = map.groups[g].map((k) => byName[(map.fields[k] || {}).name]).map((l) => l && l.rects[0]);
      rs.forEach((r, i) => {
        if (!r) return labelBad.push(`${g}: cell ${i + 1} missing`);
        if (i && rs[i - 1] && !(Math.abs(r.top - rs[i - 1].top) < 1 && r.x > rs[i - 1].x + rs[i - 1].w)) labelBad.push(`${g}: cell ${i + 1} is not right of cell ${i}`);
      });
    });
    check(`each mapped field sits beside its own printed label (${Object.keys(spec.anchors || {}).length} labels, ${Object.keys(spec.below || {}).length} rows)`, !labelBad.length, labelBad);

    // a changed file is refused, nothing returned
    const bad = Buffer.from(bytes);
    bad[bad.length >> 1] ^= 0xff;
    let got = 'untouched';
    let err = null;
    try {
      got = await NS.taxforms.fill(L, bad, map, spec.cases[0].answers, fillOpts);
    } catch (e) {
      err = e;
    }
    check('a copy with one byte changed is refused', err && /fingerprint/.test(err.message) && got === 'untouched', err ? err.message : 'filled');
    // a misspelt answer key and a short taxpayer number are refused
    let e2 = null;
    try {
      await NS.taxforms.fill(L, bytes, map, { nmae: 'x' }, fillOpts);
    } catch (e) {
      e2 = e;
    }
    check('an answer the map does not name is refused', !!e2 && /no answer named/.test(e2.message), e2 && e2.message);
    if (spec.shortTin) {
      let e3 = null;
      try {
        await NS.taxforms.fill(L, bytes, map, spec.shortTin, fillOpts);
      } catch (e) {
        e3 = e;
      }
      check('a taxpayer number with the wrong digit count is refused', !!e3 && /digits/.test(e3.message), e3 && e3.message);
    }

    // blank references
    const blankWords = words(file, 1);
    const blankImg = gray(file, 1, 100, 'blank');
    const blankText = allText(file);
    const K = 100 / 72;

    for (const c of spec.cases) {
      const tag = `${map.form}-${c.id}`;
      let out = null;
      try {
        out = await NS.taxforms.fill(L, bytes, map, c.answers, fillOpts);
      } catch (e) {
        check(`${c.id}: filled`, false, e.stack);
        continue;
      }
      const of = path.join(OUT, tag + '.pdf');
      fs.writeFileSync(of, out);
      spawnSync('pdftoppm', ['-png', '-r', '100', '-f', '1', '-l', '1', '-singlefile', of, path.join(OUT, tag)]);
      const again = await L.PDFDocument.load(out);
      const left = again.getForm().getFields().length;
      check(`${c.id}: zero fields left after flattening`, left === 0, left);
      check(`${c.id}: the page count is unchanged`, again.getPageCount() === (await L.PDFDocument.load(bytes)).getPageCount());

      // what should print where
      const expect = [];
      const groups = map.groups || {};
      Object.keys(map.fields).forEach((k) => {
        const f = map.fields[k];
        if (f.kind !== 'text') return;
        const v = c.answers[k];
        if (v === undefined || v === null || String(v).trim() === '') return;
        expect.push({ key: k, text: f.max ? String(v).slice(0, f.max) : String(v), r: byName[f.name].rects[0] });
      });
      Object.keys(groups).forEach((g) => {
        const v = c.answers[g];
        if (v === undefined || v === null || String(v).trim() === '') return;
        const d = String(v).replace(/\D/g, '');
        let at = 0;
        groups[g].forEach((k) => {
          const n = map.fields[k].max;
          expect.push({ key: k, text: d.slice(at, at + n), r: byName[map.fields[k].name].rects[0] });
          at += n;
        });
      });
      const W = words(of, 1).words;
      const fresh = W.filter((w) => !blankWords.words.some((b) => b.t === w.t && Math.abs(b.x0 - w.x0) < 0.6 && Math.abs(b.y0 - w.y0) < 0.6));
      const vanished = blankWords.words.filter((b) => !W.some((w) => w.t === b.t && Math.abs(b.x0 - w.x0) < 0.6 && Math.abs(b.y0 - w.y0) < 0.6));
      check(`${c.id}: every printed word of the blank form is still there`, !vanished.length, vanished.slice(0, 5));
      const wrong = [];
      expect.forEach((e) => {
        const here = fresh.filter((w) => inside(w, e.r, 1)).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
        const said = here.map((w) => w.t).join('').replace(/\s+/g, '');
        if (said !== e.text.replace(/\s+/g, '')) wrong.push(`${e.key}: expected "${e.text}", found "${here.map((w) => w.t).join(' ')}"`);
        here.forEach((w) => {
          if (w.x0 < e.r.x - 1.5 || w.x1 > e.r.x + e.r.w + 1.5) wrong.push(`${e.key}: "${w.t}" runs outside the field (${w.x0.toFixed(1)}-${w.x1.toFixed(1)})`);
        });
      });
      check(`${c.id}: every filled value is inside its own field (${expect.length} fields)`, !wrong.length && expect.length > 0, wrong);
      const stray = fresh.filter((w) => !expect.some((e) => inside(w, e.r, 1)));
      check(`${c.id}: no filled text anywhere else`, !stray.length, stray.map((w) => `${w.t}@${w.x0.toFixed(0)},${w.y0.toFixed(0)}`));
      if (c.exact) c.exact.forEach((s) => check(`${c.id}: "${s}" prints exactly`, allText(of).indexOf(s) >= 0));

      // ink: ticked boxes inked inside their rectangles, every other box and the rest of the page unchanged
      const img = gray(of, 1, 100, 'out');
      check(`${c.id}: the render has the blank form's size`, img.w === blankImg.w && img.h === blankImg.h, [img.w, img.h, blankImg.w, blankImg.h]);
      const box = (r, pad) => [Math.floor((r.x - pad) * K), Math.floor((r.top - pad) * K), Math.ceil((r.x + r.w + pad) * K), Math.ceil((r.top + r.h + pad) * K)];
      // New ink: dark in the filled page with no dark pixel of the blank page within one pixel; lost ink the other way
      // round. A printed line that rasterises one pixel row lower after flattening is neither; a value or tick is.
      const dark = (im, x, y) => x >= 0 && y >= 0 && x < im.w && y < im.h && im.px[y * im.w + x] < 128;
      const near = (im, x, y) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dark(im, x + dx, y + dy)) return true;
        return false;
      };
      const diffAt = (x, y) => (dark(img, x, y) && !near(blankImg, x, y)) || (dark(blankImg, x, y) && !near(img, x, y));
      const newInk = (b) => {
        let n = 0;
        for (let y = Math.max(0, b[1]); y < Math.min(img.h, b[3]); y++) for (let x = Math.max(0, b[0]); x < Math.min(img.w, b[2]); x++) if (dark(img, x, y) && !near(blankImg, x, y)) n++;
        return n;
      };
      const ticks = [];
      const allowed = expect.map((e) => box(e.r, 2));
      Object.keys(map.fields).forEach((k) => {
        const f = map.fields[k];
        if (f.kind !== 'check') return;
        const r = byName[f.name].rects[0];
        const on = c.answers[k] === true;
        const d = newInk(box(r, 0));
        if (on) allowed.push(box(r, 1));
        if (on ? d < 6 : d !== 0) ticks.push(`${k}: ${on ? 'ticked' : 'not ticked'}, new ink ${d} px`);
      });
      check(`${c.id}: ticked boxes show ink, the others none`, !ticks.length, ticks);
      let changed = 0;
      const sample = [];
      for (let y = 0; y < img.h; y++)
        for (let x = 0; x < img.w; x++) {
          if (!diffAt(x, y)) continue;
          if (allowed.some((b) => x >= b[0] && x < b[2] && y >= b[1] && y < b[3])) continue;
          changed++;
          if (sample.length < 5) sample.push(`${(x / K).toFixed(0)},${(y / K).toFixed(0)}`);
        }
      check(`${c.id}: nothing else on the page changed`, changed === 0, { changed, at: sample });
    }

    // every answer empty: the blank form's text, zero fields
    const empty = {};
    Object.keys(map.fields).forEach((k) => {
      if (!Object.keys(map.groups || {}).some((g) => map.groups[g].indexOf(k) >= 0)) empty[k] = '';
    });
    Object.keys(map.groups || {}).forEach((g) => (empty[g] = ''));
    const eo = await NS.taxforms.fill(L, bytes, map, empty, fillOpts);
    const ef = path.join(OUT, `${map.form}-empty.pdf`);
    fs.writeFileSync(ef, eo);
    check('every answer empty: the text is the blank form\'s', allText(ef) === blankText);
    check('every answer empty: zero fields left', (await L.PDFDocument.load(eo)).getForm().getFields().length === 0);

    // e-sign places
    const ov = map.overlays || {};
    const pages = (await L.PDFDocument.load(bytes)).getPages();
    Object.keys(ov).forEach((k) => {
      const o = ov[k];
      const okPage = o.page >= 1 && o.page <= pages.length;
      const on = o.x >= 0 && o.y >= 0 && o.w > 0 && o.h > 0 && o.x + o.w <= 1 && o.y + o.h <= 1;
      check(`overlay ${k} lies on page ${o.page}`, okPage && on, o);
    });
    ['sign', 'date', 'caption'].forEach((k) => check(`overlay ${k} is given`, !!ov[k]));
    if (ov.sign && ov.date && ov.caption) {
      const pw = blankWords.w;
      const ph = blankWords.h;
      ['sign', 'date', 'caption'].forEach((k) => {
        const r = pts(ov[k], pw, ph);
        const hit = blankWords.words.filter((w) => overlaps(w, r));
        check(`overlay ${k} covers no printed word`, !hit.length, hit.map((w) => w.t));
      });
      const s = pts(ov.sign, pw, ph);
      const cap = pts(ov.caption, pw, ph);
      const gap = Math.min(Math.abs(cap.top - (s.top + s.h)), Math.abs(s.top - (cap.top + cap.h)));
      check('overlay caption sits against the signature place', gap <= 3 && cap.x >= s.x - 1 && cap.x + cap.w <= s.x + s.w + 1, { gap, cap, s });
      await spec.overlays({ check, map, ov, words: blankWords, byName, pw, ph });
    }
  };
}

/** Words grouped into printed lines (same top within 1 pt), each sorted left to right. */
function lines(ws) {
  const out = [];
  ws.slice()
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
    .forEach((w) => {
      const l = out.find((x) => Math.abs(x.y0 - w.y0) < 1);
      if (l) l.words.push(w);
      else out.push({ y0: w.y0, words: [w] });
    });
  out.forEach((l) => {
    l.words.sort((a, b) => a.x0 - b.x0);
    l.x0 = l.words[0].x0;
    l.x1 = l.words[l.words.length - 1].x1;
    l.y1 = Math.max(...l.words.map((w) => w.y1));
  });
  return out.sort((a, b) => a.y0 - b.y0);
}

const W9_CASES = [
  {
    id: 'individual',
    answers: { name: 'Renée Zoë Ångström', business: '', individual: true, address: '1450 Harbor View Rd Apt 12', cityStateZip: 'Portland, OR 97201', accounts: '', ssn: '123-45-6789', ein: '' },
    exact: ['Renée Zoë Ångström']
  },
  {
    id: 'llc-partnership',
    answers: { name: 'Northwind Ridge Holdings LLC', llc: true, llcLetter: 'P', foreignOwners: true, address: '88 Commerce Street Suite 400', cityStateZip: 'Austin, TX 78701', requester: 'Cedar Lane Fund I LP', accounts: 'CV-2026-0042', ein: '12-3456789' }
  },
  {
    id: 'every-field',
    answers: { name: 'Harbor Light Association', business: 'Harbor Light Sailing', other: true, otherText: 'Unincorporated association', exemptPayee: '5', fatcaCode: 'B', address: '7 Pier Road', cityStateZip: 'Mystic, CT 06355', requester: 'Cedar Lane Fund I LP', accounts: 'A-17, A-18', ein: '98-7654321' }
  }
];

const parts = {
  'W-9': formPart({
    key: 'W-9 2024-03',
    d05: '2d420cbb4123dcf1fb82595b2359cfbb5d81f00b9df9d359fcc7af361d093f53',
    listing: 'W-9',
    counts: { total: 23, text: 10, comb: 5, check: 8, sig: 0, other: 0 },
    groups: { ssn: [3, 2, 4], ein: [2, 7] },
    shortTin: { ssn: '123-45-678' },
    cases: W9_CASES,
    anchors: {
      name: ['above', /name on line 2\.\)$/],
      business: ['above', /^2 Business name/],
      individual: ['right', /^Individual\/sole proprietor/],
      ccorp: ['right', /^C corporation/],
      scorp: ['right', /^S corporation/],
      partnership: ['right', /^Partnership/],
      trust: ['right', /^Trust\/estate/],
      llc: ['right', /^LLC\./],
      other: ['right', /^Other \(see/],
      llcLetter: ['left', /P = Partnership\)/],
      otherText: ['left', /Other \(see instructions\)$/],
      foreignOwners: ['right', /outside the United States/],
      exemptPayee: ['left', /Exempt payee code \(if any\)/],
      fatcaCode: ['above', /\(FATCA\)/],
      address: ['above', /^5 Address/],
      cityStateZip: ['above', /^6 City, state, and ZIP code/],
      requester: ['above', /^Requester.s name and address/],
      accounts: ['above', /^7 List account number/],
      ssn1: ['above', /^Social security/],
      ein1: ['above', /^Employer/]
    },
    below: { business: 'name', cityStateZip: 'address' },
    overlays: async ({ check, ov, words: bw, pw, ph }) => {
      const ws = bw.words;
      // the signature label: the words at x 76-117 in the signing band; the date label: "Date" in the same band
      const band = ws.filter((w) => w.y0 > 570 && w.y1 < 600);
      const label = band.filter((w) => w.x0 >= 75 && w.x1 < 120);
      const date = band.find((w) => w.t === 'Date');
      check('the signature label and the date label are found', label.length >= 4 && !!date, band.map((w) => w.t));
      if (!label.length || !date) return;
      const s = pts(ov.sign, pw, ph);
      const d = pts(ov.date, pw, ph);
      const labelRight = Math.max(...label.map((w) => w.x1));
      const labelTop = Math.min(...label.map((w) => w.y0));
      const labelBottom = Math.max(...label.map((w) => w.y1));
      check('sign starts after the signature label and ends before the date label', s.x > labelRight && s.x - labelRight < 10 && s.x + s.w < date.x0, { s, labelRight, date: date.x0 });
      check('sign is level with the signature label', s.top <= labelTop + 4 && s.top + s.h >= labelBottom - 1, { s, labelTop, labelBottom });
      check('date starts after the date label and is level with it', d.x > date.x1 && d.x - date.x1 < 6 && d.top <= date.y0 && d.top + d.h >= date.y1 - 0.5 && d.x + d.w <= pw - 30, { d, date });
      // certification item 2: from the line starting "2." to the line before the line starting "3."
      const ls = lines(ws.filter((w) => w.y0 > 440 && w.y0 < 560));
      const a = ls.findIndex((l) => l.words[0].t === '2.' && l.words[0].x0 < 40);
      const b = ls.findIndex((l) => l.words[0].t === '3.' && l.words[0].x0 < 40);
      check('certification item 2 is found', a >= 0 && b > a, ls.map((l) => l.words[0].t));
      if (!(a >= 0 && b > a)) return;
      const item = ls.slice(a, b);
      const st = ov.strike2;
      check('strike2 has one stroke per printed line of item 2', !!st && Array.isArray(st.lines) && st.lines.length === item.length, { strokes: st && st.lines && st.lines.length, lines: item.length });
      if (!st || !st.lines) return;
      const bad = [];
      item.forEach((l, i) => {
        const k = st.lines[i];
        const x0 = k.x0 * pw;
        const x1 = k.x1 * pw;
        const y = k.y * ph;
        if (!(y > l.y0 && y < l.y1)) bad.push(`line ${i + 1}: y ${y.toFixed(1)} outside ${l.y0.toFixed(1)}-${l.y1.toFixed(1)}`);
        if (Math.abs(x0 - l.x0) > 1 || Math.abs(x1 - l.x1) > 1) bad.push(`line ${i + 1}: x ${x0.toFixed(1)}-${x1.toFixed(1)} vs text ${l.x0.toFixed(1)}-${l.x1.toFixed(1)}`);
      });
      const r = pts(st, pw, ph);
      if (r.x > item[0].x0 + 1 || r.top > item[0].y0 + 1 || r.top + r.h < item[item.length - 1].y1 - 1) bad.push('the rectangle does not cover item 2');
      check('strike2 runs through the middle of each printed line of item 2, end to end', !bad.length, bad);
    }
  }),
  'W-8BEN': formPart({
    key: 'W-8BEN 2021-10',
    d05: 'b821dc1172c91b348a65675529cc792782f11fc1ae8579df92d627113203f918',
    listing: 'W-8BEN',
    counts: { total: 23, text: 20, comb: 0, check: 2, sig: 1, other: 0 },
    cases: [
      {
        id: 'w8ben',
        answers: {
          name: 'Zoë Müller-Łukasz',
          citizenship: 'Germany',
          street: 'Lindenstraße 14, Wohnung 3',
          cityLine: '10969 Berlin',
          country: 'Germany',
          ftin: '12345678901',
          birthDate: '04-02-1980',
          treatyCountry: 'Germany',
          treatyArticle: '10(2)(b)',
          treatyRate: '15',
          treatyIncome: 'Dividends',
          treatyExplain1: 'Art. 28',
          treatyExplain2: 'Qualified resident under the limitation on benefits article',
          capacity: true,
          printName: 'Zoë Müller-Łukasz'
        },
        exact: ['Zoë Müller-Łukasz', 'Lindenstraße 14, Wohnung 3']
      },
      {
        id: 'noftin',
        answers: { name: 'Aiko Tanaka', citizenship: 'Japan', street: '2-11-3 Meguro', cityLine: 'Meguro-ku, Tokyo 153-0063', country: 'Japan', ftin: '', noFtin: true, birthDate: '11-23-1975', capacity: true, printName: 'Aiko Tanaka' }
      },
      {
        id: 'every-field',
        answers: {
          name: 'Lucía Fernández',
          citizenship: 'Spain',
          street: 'Calle de Alcalá 42',
          cityLine: '28014 Madrid',
          country: 'Spain',
          mailStreet: 'Apartado de Correos 118',
          mailCityLine: '28080 Madrid',
          mailCountry: 'Spain',
          usTin: '912-70-1234',
          ftin: '12345678Z',
          reference: 'CV-2026-0042',
          birthDate: '07-30-1988',
          treatyCountry: 'Spain',
          treatyArticle: '11(2)',
          treatyRate: '10',
          treatyIncome: 'Interest',
          treatyExplain1: 'None',
          treatyExplain2: 'No additional conditions apply',
          capacity: true,
          printName: 'Lucía Fernández'
        }
      }
    ],
    anchors: {
      name: ['above', /1 Name of/],
      citizenship: ['above', /^2 Country of citizenship/],
      street: ['above', /Permanent residence address/],
      cityLine: ['above', /^City or town, state or province/],
      country: ['above', /^Country$/],
      mailStreet: ['above', /^4 Mailing address/],
      mailCityLine: ['above', /^City or town, state or province/],
      mailCountry: ['above', /^Country$/],
      usTin: ['above', /U\.S\. taxpayer identification number/],
      ftin: ['above', /^6a Foreign tax identifying number/],
      noFtin: ['left', /FTIN not legally required/],
      reference: ['above', /^7 Reference number/],
      birthDate: ['above', /^8 Date of birth \(MM-DD-YYYY\)/],
      treatyCountry: ['left', /is a resident of$/],
      treatyArticle: ['right', /^of the treaty identified/],
      treatyRate: ['right', /^% rate of withholding/],
      treatyIncome: ['above', /% rate of withholding on/],
      treatyExplain1: ['left', /eligible for the rate of withholding:$/],
      treatyExplain2: ['above', /^Explain the additional conditions/],
      capacity: ['right', /^I certify that I have the capacity/],
      printName: ['under', /^Print name of signer/]
    },
    below: { cityLine: 'street', country: 'street', mailStreet: 'cityLine', mailCityLine: 'mailStreet', mailCountry: 'mailStreet', treatyIncome: 'treatyArticle', treatyExplain2: 'treatyExplain1' },
    overlays: async ({ check, map, ov, words: bw, byName, pw, ph }) => {
      const P = 'topmostSubform[0].Page1[0].';
      const sig = byName[P + 'f_20[0]'];
      const date = byName[P + 'Date[0]'];
      check('the signature field and the date field are in the file', !!sig && !!date && sig.kind === 'sig' && date.kind === 'text');
      if (!sig || !date) return;
      check('the signature field is removed before flattening', (map.removeBeforeFlatten || []).indexOf(P + 'f_20[0]') >= 0);
      const fill = Object.keys(map.fields).filter((k) => map.fields[k].name === P + 'Date[0]');
      const unused = Object.keys(map.unused || {}).filter((r) => map.unused[r].indexOf(P + 'Date[0]') >= 0);
      check('the date field is never filled: unused, with the reason naming the e-sign date overlay', !fill.length && unused.length === 1 && /date overlay/.test(unused[0]), { fill, unused });
      const same = (o, r) => o.page === r.page && Math.abs(o.x * pw - r.x) < 0.01 && Math.abs(o.y * ph - r.top) < 0.01 && Math.abs(o.w * pw - r.w) < 0.01 && Math.abs(o.h * ph - r.h) < 0.01;
      check("sign is the signature field's rectangle", same(ov.sign, sig.rects[0]), { sign: pts(ov.sign, pw, ph), field: sig.rects[0] });
      check("date is the date field's rectangle, MM-DD-YYYY", same(ov.date, date.rects[0]) && ov.date.fmt === 'MM-DD-YYYY', { date: pts(ov.date, pw, ph), fmt: ov.date.fmt, field: date.rects[0] });
      // the printed labels sit just under both places
      const s = pts(ov.sign, pw, ph);
      const d = pts(ov.date, pw, ph);
      const under = (r) => bw.words.filter((w) => w.y0 >= r.top + r.h - 0.5 && w.y0 <= r.top + r.h + 4 && w.x1 > r.x && w.x0 < r.x + r.w).map((w) => w.t).join(' ');
      check('the signature label is printed just under sign', /^Signature of beneficial owner/.test(under(s)), under(s));
      check('the date label is printed just under date', /^Date \(MM-DD-YYYY\)/.test(under(d)), under(d));
    }
  })
};

Lib.runParts(parts, { name: 'FORM MAPS', unit: 'forms', flag: '--only', browser: false });
