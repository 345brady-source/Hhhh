#!/usr/bin/env node
/*
 * Where the words of a picture page are read, and how a read word is compared with a known word
 * (bands() and near() of assets/js/picturepage.js).
 *
 *   node bands.js --mode pure [--tap]
 *       No browser and no document: every case is a picture drawn here as grey levels (white paper, dark strokes,
 *       small dark blocks standing for letters). One line a case, marked PASS or FAIL. With --tap the same cases are
 *       printed as a TAP report instead.
 *
 * The last line is "BANDS <mode>: PASS" or "BANDS <mode>: FAIL - ..."; exit status 0 or 1. A check that cannot find
 * what it needs prints "NOT RUN: ..." and exits with status 2; that is never a pass.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const MODE = arg('--mode', 'pure');
const TAP = process.argv.includes('--tap');
const notRun = (what) => {
  console.log('NOT RUN: ' + what);
  process.exit(2);
};

/* ---------- pictures drawn here ---------- */
const S = 2; // pixels to the point on every made-up picture
/** White paper of w x h pixels and the pens to draw on it. Rectangles are returned as the finder gives a box. */
function paper(w, h) {
  const grey = new Uint8Array(w * h).fill(255);
  const dot = (x, y, d) => {
    if (x >= 0 && y >= 0 && x < w && y < h && 255 - d < grey[y * w + x]) grey[y * w + x] = 255 - d;
  };
  const level = (y, x0, x1) => {
    for (let x = x0; x <= x1; x++) dot(x, y, 215);
  };
  const upright = (x, y0, y1) => {
    for (let y = y0; y <= y1; y++) dot(x, y, 215);
  };
  const frame = (x0, y0, x1, y1) => {
    level(y0, x0, x1);
    level(y1, x0, x1);
    upright(x0, y0, y1);
    upright(x1, y0, y1);
    return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  };
  /**
   * A line of print: words of so many letters each. A letter is a dark block 3 pixels wide and 8 high, letters stand
   * 2 pixels apart and words 6. Returns the rectangle the line covers.
   */
  const text = (x, y, words) => {
    const x0 = x;
    words.forEach((n, k) => {
      if (k) x += 6;
      for (let i = 0; i < n; i++) {
        if (i) x += 2;
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 3; xx++) dot(x + xx, y + yy, 215);
        x += 3;
      }
    });
    return { x0, y0: y, x1: x, y1: y + 8 };
  };
  return { w, h, grey, level, upright, frame, text };
}
const meets = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const within = (a, b, by) => a.x0 >= b.x0 - by && a.y0 >= b.y0 - by && a.x1 <= b.x1 + by && a.y1 <= b.y1 + by;
const ordered = (list) => list.every((b, i) => !i || list[i - 1].y0 < b.y0 || (list[i - 1].y0 === b.y0 && list[i - 1].x0 <= b.x0));

/* ---------- the cases ---------- */
function cases(pp) {
  const out = [];
  const add = (name, run) => out.push({ name, run });
  const same = (name, got, want) => add(name, () => (got() === want ? '' : `gave ${JSON.stringify(got())}, not ${JSON.stringify(want)}`));
  /** The finder's result on a drawn picture, the bands of it, and helpers to ask about them. */
  const read = (p) => {
    const found = pp.find(p.grey, p.w, p.h, S);
    const got = pp.bands(Object.assign({ grey: p.grey, w: p.w, h: p.h, pxPerPt: S }, found));
    const parts = [];
    got.strips.forEach((st) => st.parts.forEach((q) => parts.push(Object.assign({ strip: st }, q))));
    const box = (r) => found.boxes.findIndex((b) => Math.abs(b.x0 - r.x0) <= 1 && Math.abs(b.y0 - r.y0) <= 1 && Math.abs(b.x1 - r.x1) <= 1 && Math.abs(b.y1 - r.y1) <= 1);
    const of = (r, side) => parts.filter((q) => q.kind === 'box' && q.of === box(r) && (!side || q.side === side));
    return { found, got, parts, box, of };
  };

  /* near */
  same("near('initials', 'initials') is 0", () => pp.near('initials', 'initials'), 0);
  same("near('Initia1s', 'initials') is 1: the digit is no letter, one letter is missing", () => pp.near('Initia1s', 'initials'), 1);
  same("near('nitials', 'initials') is 1", () => pp.near('nitials', 'initials'), 1);
  same("near('inlitialss', 'initials') is 2", () => pp.near('inlitialss', 'initials'), 2);
  same("near('finals', 'initials') is -1", () => pp.near('finals', 'initials'), -1);
  same("near('date', 'date') is 0", () => pp.near('date', 'date'), 0);
  same("near('data', 'date') is -1: a known word under 5 letters allows no change", () => pp.near('data', 'date'), -1);
  same("near('Co-Investor', 'coinvestor') is 0: letters only, case ignored", () => pp.near('Co-Investor', 'coinvestor'), 0);
  same("near('Colnvestor', 'coinvestor') is 1", () => pp.near('Colnvestor', 'coinvestor'), 1);
  add('near of a full-width or ligature spelling equals near of its plain spelling (NFKC)', () => {
    const wide = pp.near('ｉｎｉｔｉａｌｓ', 'initials');
    const tied = pp.near('conﬁrm', 'confirm');
    return wide === 0 && tied === 0 ? '' : `full-width gave ${wide} and the ligature ${tied}, not 0 and 0`;
  });
  add('near of nothing read, and of a word one letter over the allowance, is -1', () => {
    const got = [pp.near('', 'initials'), pp.near(null, 'date'), pp.near('signatur', 'signature'), pp.near('sgnatr', 'signature'), pp.near('brokr', 'broker'), pp.near('brkr', 'broker')];
    return JSON.stringify(got) === '[-1,-1,1,-1,1,-1]' ? '' : `gave ${JSON.stringify(got)}`;
  });

  /* bands */
  add('bands on blank paper returns empty strips, columns and zones and a null margin', () => {
    const p = paper(300, 300);
    const r = read(p).got;
    return r.strips.length === 0 && r.columns.length === 0 && r.zones.length === 0 && r.margin === null ? '' : `gave ${r.strips.length} strips, ${r.columns.length} columns, ${r.zones.length} zones, margin ${JSON.stringify(r.margin)}`;
  });
  add("two wide boxes stacked one pixel apart with print between and round them: no band of either box overlaps the other box's rectangle", () => {
    const p = paper(400, 220);
    const a = p.frame(140, 80, 230, 99);
    const b = p.frame(140, 101, 230, 120);
    p.text(146, 68, [5, 4]); // over the upper
    p.text(146, 124, [6]); // under the lower
    p.text(96, 86, [4, 3]); // before the upper, on its row
    p.text(96, 107, [3, 4]); // before the lower, on its row
    const r = read(p);
    const bad = [];
    if (r.box(a) < 0 || r.box(b) < 0) return 'the two boxes were not found';
    r.of(a).forEach((q) => meets(q, b) && bad.push(`the ${q.side} band of the upper box reaches into the lower box`));
    r.of(b).forEach((q) => meets(q, a) && bad.push(`the ${q.side} band of the lower box reaches into the upper box`));
    r.got.strips.forEach((st) => st.parts.forEach((q) => !within(q, st, 0) && bad.push('a part lies outside its strip')));
    ['over', 'before'].forEach((sd) => r.of(a, sd).length === 1 || bad.push(`the upper box has ${r.of(a, sd).length} ${sd} bands, not 1`));
    ['under', 'before'].forEach((sd) => r.of(b, sd).length === 1 || bad.push(`the lower box has ${r.of(b, sd).length} ${sd} bands, not 1`));
    if (r.of(a, 'under').length || r.of(b, 'over').length) bad.push('a band was made of the one pixel between the two boxes');
    return bad.join('; ');
  });
  add("a small square, print, then a second small square on one row: the first square's after band ends at the second square", () => {
    const p = paper(400, 100);
    const a = p.frame(40, 40, 55, 55);
    const words = p.text(62, 44, [5, 5]);
    const b = p.frame(124, 40, 139, 55);
    const tail = p.text(146, 44, [4]);
    const r = read(p);
    const after = r.of(a, 'after')[0];
    const before = r.of(b, 'before')[0];
    const last = r.of(b, 'after')[0];
    if (!after) return 'the first square has no after band';
    const bad = [];
    if (after.x1 > b.x0 || after.x0 < a.x1) bad.push(`the after band runs from ${after.x0} to ${after.x1}, past the second square at ${b.x0}`);
    if (!within(words, after, 0)) bad.push('the after band does not hold the print between the squares');
    if (!before || before.x0 < a.x1 || !within(words, before, 0)) bad.push('the second square has no before band cut at the first');
    if (!last || !within(tail, last, 0)) bad.push('the second square has no after band of its own');
    if (after && before && after.strip !== before.strip) bad.push('the same print is in two strips');
    return bad.join('; ');
  });
  add('a box with clear paper all round it yields no band and no strip', () => {
    const p = paper(400, 300);
    p.frame(100, 100, 220, 130);
    const r = read(p);
    return r.found.boxes.length === 1 && r.got.strips.length === 0 && r.got.zones.length === 0 ? '' : `gave ${r.found.boxes.length} boxes, ${r.got.strips.length} strips, ${r.got.zones.length} zones`;
  });
  add('a free rule with print before it on its row yields a before band', () => {
    const p = paper(400, 300);
    const words = p.text(40, 250, [5, 4]);
    p.level(260, 110, 300);
    const r = read(p);
    if (r.found.rules.length !== 1) return `the finder gave ${r.found.rules.length} free rules, not 1`;
    const q = r.parts.filter((x) => x.kind === 'rule' && x.of === 0 && x.side === 'before');
    return q.length === 1 && within(words, q[0], 0) ? '' : `the rule has ${q.length} before bands${q.length ? ' that do not hold the print' : ''}`;
  });
  add('three boxes with the same left and right edges are one column and each carries its index in col', () => {
    const p = paper(600, 300);
    const col = [p.frame(300, 40, 380, 60), p.frame(300, 70, 380, 90), p.frame(301, 100, 381, 120)];
    const lone = p.frame(420, 40, 500, 60);
    const r = read(p);
    const ids = col.map(r.box);
    if (ids.some((i) => i < 0) || r.box(lone) < 0) return 'a drawn box was not found';
    const bad = [];
    if (r.got.columns.length !== 1) bad.push(`${r.got.columns.length} columns, not 1`);
    else if (JSON.stringify(r.got.columns[0].boxes) !== JSON.stringify(ids)) bad.push(`the column holds boxes ${JSON.stringify(r.got.columns[0].boxes)}, not ${JSON.stringify(ids)} top to bottom`);
    ids.forEach((i) => r.found.boxes[i].col === 0 || bad.push(`a box of the column carries col ${r.found.boxes[i].col}`));
    if (r.found.boxes[r.box(lone)].col !== -1) bad.push(`the box that stands alone carries col ${r.found.boxes[r.box(lone)].col}, not -1`);
    return bad.join('; ');
  });
  /** A page with one case of most classes, to ask the same questions of twice. */
  const whole = () => {
    const p = paper(640, 720);
    p.upright(120, 40, 680); // the rule beside the margin column
    p.text(20, 60, [3]); // a margin heading of two lines
    p.text(20, 74, [6, 4]);
    p.text(20, 300, [3]); // and a second one further down
    p.text(20, 314, [5]);
    const mark = p.text(150, 180, [2, 5, 4]); // a lettered line at the left edge of the boxes: a short mark, then words
    const prose = p.text(150, 400, [6, 4, 5, 3, 6, 5, 4, 6, 5, 3, 6, 4, 5, 6, 3, 5, 4, 6, 5, 4, 3, 6, 5, 4, 6, 5, 3, 4, 6, 5, 4, 3, 6, 5, 4, 6, 3, 5, 4, 6, 5, 4, 3, 6, 5, 4, 6, 3, 5, 4, 6].slice(0, 16)); // running text at the same edge
    const capA = p.text(154, 220, [5, 4]);
    const a = p.frame(150, 232, 290, 256);
    const capB = p.text(314, 220, [4]);
    const b = p.frame(310, 232, 450, 256);
    const under = p.text(164, 260, [8]);
    const tick = p.frame(150, 500, 165, 515);
    const label = p.text(172, 504, [3, 6, 4]);
    const filled = p.frame(150, 560, 270, 590);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 15; c++) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (255 - 215 < p.grey[(566 + r * 7 + y) * p.w + 158 + c * 7 + x]) p.grey[(566 + r * 7 + y) * p.w + 158 + c * 7 + x] = 40;
    const capF = p.text(154, 548, [6]);
    return { p, mark, prose, capA, a, capB, b, under, tick, label, filled, capF };
  };
  add('two calls with the same input return equal results, strips in reading order', () => {
    const d = whole();
    const one = read(d.p);
    const two = read(d.p);
    const bad = [];
    if (JSON.stringify(one.got) !== JSON.stringify(two.got)) bad.push('two calls differ');
    if (!one.got.strips.length) bad.push('no strip on a page with captions');
    if (!ordered(one.got.strips)) bad.push('the strips are not in reading order');
    if (!ordered(one.got.zones)) bad.push('the zones are not in reading order');
    one.got.strips.forEach((st) => typeof st.line === 'boolean' || bad.push('a strip does not say whether it is one line high'));
    one.got.strips.forEach((st) => st.parts.forEach((q) => ['over', 'under', 'before', 'after', 'inside'].includes(q.side) || bad.push(`a part is on the side "${q.side}"`)));
    return bad.join('; ');
  });
  add('a caption over a box and one under it are bands of that box; a strip one line high says so; a box that is no place gets no band', () => {
    const d = whole();
    const r = read(d.p);
    const bad = [];
    const over = r.of(d.a, 'over')[0];
    const under = r.of(d.a, 'under')[0];
    if (!over || !within(d.capA, over, 0)) bad.push('the caption over the first box is not its over band');
    else if (meets(over, d.capB)) bad.push('the over band of the first box takes in the caption of the box beside it');
    if (!under || !within(d.under, under, 0)) bad.push('the caption under the first box is not its under band');
    else if (!under.strip.line) bad.push('the strip of a caption one line high is not marked as a line');
    const tick = r.of(d.tick, 'after')[0];
    if (!tick || !within(d.label, tick, 0)) bad.push('the words after the tick box are not its after band');
    if (r.of(d.tick, 'over').length || r.of(d.tick, 'under').length) bad.push('a tick box was given a band over or under it');
    const fi = r.box(d.filled);
    if (fi < 0 || r.found.boxes[fi].place !== false) bad.push('the box full of print was not found as a box that is no place');
    else if (r.of(d.filled).length) bad.push('a box that is no place was given a band');
    return bad.join('; ');
  });
  add('running text under a box is no caption of it: the band is dropped, and a short caption under the next box is kept', () => {
    const p = paper(560, 320);
    const a = p.frame(200, 100, 300, 120);
    p.text(40, 124, [5, 4, 6, 3, 5, 4, 6, 5, 3, 6, 4, 5, 6, 3, 5, 4, 6, 5, 4, 3]);
    const b = p.frame(200, 200, 300, 220);
    const cap = p.text(216, 224, [6, 4]);
    const r = read(p);
    const bad = [];
    if (r.box(a) < 0 || r.box(b) < 0) return 'a drawn box was not found';
    if (r.of(a, 'under').length) bad.push('the line of running text under the first box became its under band');
    const u = r.of(b, 'under')[0];
    if (!u || !within(cap, u, 0)) bad.push('the short caption under the second box is not its under band');
    return bad.join('; ');
  });
  add('the margin column is found from the upright rule beside it; its blocks of print are margin zones; a lettered line at the left edge of the boxes is a letter zone and running text there is none', () => {
    const d = whole();
    const r = read(d.p);
    const bad = [];
    const m = r.got.margin;
    if (!m) return 'no margin was found';
    if (m.x1 > 120 || m.x1 < 60) bad.push(`the margin column ends at ${m.x1}, not at the rule at 120`);
    const mz = r.got.zones.filter((z) => z.kind === 'margin');
    const lz = r.got.zones.filter((z) => z.kind === 'letter');
    if (mz.length !== 2) bad.push(`${mz.length} margin zones, not the 2 blocks drawn`);
    else if (!within({ x0: 20, y0: 60, x1: 60, y1: 82 }, mz[0], 0) || !within({ x0: 20, y0: 300, x1: 40, y1: 322 }, mz[1], 0)) bad.push('the margin zones do not hold the two blocks of print');
    // (the caption over the box that is no place is no band, so it may be a letter zone as well; its text decides later)
    if (!lz.some((z) => within(d.mark, z, 0))) bad.push(`no letter zone of ${lz.length} holds the lettered line`);
    if (r.got.zones.some((z) => meets(z, d.prose))) bad.push('a line of running text became a zone');
    r.got.zones.forEach((z) => r.parts.some((q) => meets(z, q)) && bad.push(`a ${z.kind} zone lies in a caption band`));
    r.got.zones.forEach((z) => r.found.boxes.some((b) => meets(z, b)) && bad.push(`a ${z.kind} zone lies in a box`));
    // The caption before a box never comes out of the margin column.
    r.parts.filter((q) => q.side === 'before').forEach((q) => q.x0 < 120 && bad.push('a before band reaches into the margin column'));
    return bad.join('; ');
  });
  add('with no rule beside it the margin column is found from the widest clear upright gap; a column of captions before boxes is no margin', () => {
    const p = paper(640, 720);
    p.level(40, 20, 620); // a rule across the whole page crosses the gap and does not close it
    [80, 94, 108, 260, 274, 288, 440, 454].forEach((y) => p.text(20, y, [4, 5]));
    for (let y = 80; y < 640; y += 14) p.text(160, y, [5, 4, 6, 3, 5, 4, 6, 5, 3, 6, 4, 5, 6, 3, 5, 4]);
    p.frame(160, 660, 300, 684);
    const r = read(p);
    const bad = [];
    const m = r.got.margin;
    if (!m) bad.push('no margin was found on a page with a margin column and no rule');
    else if (m.x1 < 60 || m.x1 > 160) bad.push(`the margin column ends at ${m.x1}, not in the gap between 60 and 160`);
    if (m && r.got.zones.filter((z) => z.kind === 'margin').length !== 3) bad.push(`${r.got.zones.filter((z) => z.kind === 'margin').length} margin zones, not the 3 blocks drawn`);
    // Captions before boxes, row by row: a column of labels, not a margin.
    const q = paper(640, 400);
    const caps = [];
    const boxes = [];
    [60, 110, 160, 210, 260, 310].forEach((y, k) => {
      caps.push(q.text(30, y + 8, k % 2 ? [5, 4] : [4]));
      boxes.push(q.frame(140, y, 400, y + 24));
    });
    const s = read(q);
    if (s.got.margin) bad.push('a column of captions before boxes was taken as the margin');
    boxes.forEach((b, k) => {
      const before = s.of(b, 'before')[0];
      if (!before || !within(caps[k], before, 0)) bad.push(`the caption before box ${k + 1} of the column of labels is not its before band`);
    });
    return bad.join('; ');
  });
  add('running text beside a box on its row is no caption before it', () => {
    const p = paper(640, 200);
    // a paragraph whose lines end 6 pixels (3 pt) before the box at the end of them
    for (let y = 60; y < 130; y += 14) p.text(20, y, [5, 4, 6, 3, 5, 4, 6, 5, 3, 6, 4, 5, 6, 3, 5, 4, 6, 5, 4, 3]);
    const b = p.frame(560, 84, 620, 104);
    const r = read(p);
    if (r.box(b) < 0) return 'the drawn box was not found';
    return r.of(b, 'before').length ? 'a line of running text became the before band of the box at its end' : '';
  });
  return out;
}

/* ---------- the run ---------- */
function pure() {
  const finder = path.join(ROOT, 'assets/js/picturepage.js');
  if (!fs.existsSync(finder)) notRun('the finder is not at ' + finder);
  const pp = require(finder);
  const list = cases(pp);
  const failed = [];
  if (TAP) console.log('TAP version 13');
  list.forEach((c, i) => {
    let why;
    try {
      why = typeof pp.near !== 'function' || typeof pp.bands !== 'function' ? 'picturepage has no ' + (typeof pp.near !== 'function' ? 'near()' : 'bands()') : c.run();
    } catch (e) {
      why = 'stopped: ' + String((e && e.message) || e).slice(0, 200);
    }
    if (why) failed.push(`${c.name}: ${why}`);
    if (TAP) console.log(`${why ? 'not ok' : 'ok'} ${i + 1} - ${c.name}${why ? `\n  ---\n  message: ${JSON.stringify(why)}\n  ...` : ''}`);
    else console.log(`${why ? 'FAIL' : 'PASS'}  ${c.name}${why ? ' - ' + why : ''}`);
  });
  if (TAP) {
    console.log(`1..${list.length}`);
    console.log(`# tests ${list.length}`);
    console.log(`# pass ${list.length - failed.length}`);
    console.log(`# fail ${failed.length}`);
  }
  return failed;
}

(async () => {
  if (MODE !== 'pure') notRun(`--mode ${MODE} is not a mode (pure)`);
  const failed = pure();
  if (!TAP) {
    console.log('');
    console.log(failed.length ? `BANDS ${MODE}: FAIL - ${failed.join('; ')}` : `BANDS ${MODE}: PASS`);
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.log(`BANDS ${MODE}: FAIL - the check itself stopped: ${String((e && e.stack) || e).slice(0, 600)}`);
  process.exit(1);
});
