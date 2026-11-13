/*
 * Printed boxes and free rules on the picture of a page, found from its pixels alone.
 *
 * A box is a patch of paper enclosed by four straight strokes. Nothing here reads a word, draws a page or asks for
 * a file: grey levels go in, rectangles come out, so the same code runs in the browser and in a check under Node.
 * Every setting is relative to the picture itself (its paper level, its print level, its pixels per point): no
 * position, page or wording of any document is known here.
 *
 *   picturepage.find(grey, w, h, pxPerPt, opts)
 *       grey      one byte a pixel, 0 black to 255 white, row after row
 *       pxPerPt   how many pixels of the picture make one point of the page
 *       opts      { ink } the share of the picture's range from paper to print at which a pixel counts as a stroke
 *     returns { paper, print, range, tau, boxes, rules }, boxes and rules in reading order (top edge, then left edge):
 *       boxes   [{ x0, y0, x1, y1 (pixels, the outer edge of the frame), w, h (the paper inside, pixels),
 *                  ink (the share of the inside that is as dark as print), small (both sides at most 14 pt),
 *                  shared, place, why }]
 *       rules   [{ x0, y0, x1, y1 (pixels), t (thickness in pixels) }]   level strokes that are no side of a box
 *     throws an Error with code 'size' for a picture of no size or of more than MAX_PIXELS pixels
 *   picturepage.toGrey(rgba, w, h)   the grey levels of RGBA bytes
 */
(function () {
  'use strict';
  const INK = 0.2;
  const MAX_PIXELS = 9.5e6;
  const MIN_PT = 4.5; // the shortest stroke and the smallest inside of a box, in points
  const SMALL_PT = 14;

  function toGrey(rgba, w, h) {
    const n = w * h;
    const grey = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) grey[i] = Math.round((rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000);
    return grey;
  }

  /** Paper (the most common grey of the bright half) and print (the grey that half a percent of the pixels are darker than). */
  function levels(grey, n) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) hist[grey[i]]++;
    let paper = 128;
    for (let v = 129; v < 256; v++) if (hist[v] > hist[paper]) paper = v;
    // The value at a position in the sorted pixels, read from the counts.
    const at = (k) => {
      let seen = 0;
      for (let v = 0; v < 256; v++) {
        seen += hist[v];
        if (seen > k) return v;
      }
      return 255;
    };
    const pos = 0.005 * (n - 1);
    const lo = Math.floor(pos);
    const a = at(lo);
    const print = a + (at(Math.min(n - 1, lo + 1)) - a) * (pos - lo);
    return { paper, print, range: Math.max(paper - print, 40) };
  }

  /**
   * Straight strokes one way: level (along the rows) or upright (along the columns). A pixel is on a stroke only on
   * its ridge: dark itself, and at least half as dark as the darker of its two neighbours across the stroke (the soft
   * edge beside a dark frame is not a stroke). Its evidence is its own darkness plus that neighbour's, so a line one
   * pixel thick that falls on two rows of the picture counts whole. A stroke is a run of evidence at least `least`
   * long, bridging a gap of one pixel. Returns { mask (1 on a stroke), runs: [[line, from, to]] }.
   */
  function strokes(dark, w, h, tau, least, level) {
    const lines = level ? h : w;
    const len = level ? w : h;
    const along = level ? 1 : w;
    const across = level ? w : 1;
    const mask = new Uint8Array(w * h);
    const runs = [];
    const third = tau / 3;
    for (let c = 0; c < lines; c++) {
      const at = c * across;
      let a0 = -1;
      let a1 = -1;
      for (let a = 0; a <= len; a++) {
        let on = false;
        if (a < len) {
          const i = at + a * along;
          const d = dark[i];
          if (d >= third) {
            const p = c > 0 ? dark[i - across] : 0;
            const q = c < lines - 1 ? dark[i + across] : 0;
            const m = p > q ? p : q;
            on = d >= 0.5 * m && d + m >= tau;
          }
        }
        if (on) {
          if (a0 < 0) a0 = a;
          a1 = a;
        } else if (a0 >= 0 && (a === len || a - a1 > 1)) {
          if (a1 - a0 + 1 >= least) {
            for (let k = a0; k <= a1; k++) mask[at + k * along] = 1;
            runs.push([c, a0, a1]);
          }
          a0 = -1;
        }
      }
    }
    return { mask, runs };
  }

  function find(grey, w, h, pxPerPt, opts) {
    const n = w * h;
    if (!(w > 0 && h > 0) || !(n <= MAX_PIXELS) || !grey || grey.length < n) throw Object.assign(new Error('a picture of no size, or too large to search'), { code: 'size' });
    const s = pxPerPt > 0 ? pxPerPt : 1;
    const ink = opts && opts.ink > 0 ? +opts.ink : INK;
    const lv = levels(grey, n);
    const P = lv.paper;
    const R = lv.range;
    const tau = ink * R;
    const dark = new Uint8Array(n);
    for (let i = 0; i < n; i++) dark[i] = grey[i] < P ? P - grey[i] : 0;
    const least = Math.max(5, Math.round(MIN_PT * s));
    const level = strokes(dark, w, h, tau, least, true);
    const upright = strokes(dark, w, h, tau, least, false);
    const mh = level.mask;
    const mv = upright.mask;
    // Whatever is not a stroke is free; a box is a patch of free pixels that fills a rectangle.
    const free = new Uint8Array(n);
    for (let i = 0; i < n; i++) free[i] = mh[i] || mv[i] ? 0 : 1;

    const inside = MIN_PT * s;
    // The share of a side (cells from..to) with a stroke within 3 pixels outside it, and the share that keeps one
    // distance (the same or one pixel more): near(cell, k) says whether the k-th pixel outward from the cell is a stroke.
    const side = (from, to, near) => {
      const count = [0, 0, 0];
      for (let c = from; c <= to; c++) for (let k = 0; k < 3; k++) if (near(c, k)) {
        count[k]++;
        break;
      }
      const all = to - from + 1;
      return { cover: (count[0] + count[1] + count[2]) / all, straight: Math.max(count[0] + count[1], count[1] + count[2]) / all };
    };
    const share = (x0, y0, x1, y1, test) => {
      let hit = 0;
      for (let y = y0; y <= y1; y++) for (let i = y * w + x0, e = y * w + x1; i <= e; i++) if (test(i)) hit++;
      return hit / ((x1 - x0 + 1) * (y1 - y0 + 1));
    };
    const isFree = (i) => free[i] === 1;
    const isPaper = (i) => dark[i] < tau;
    const isPrint = (i) => dark[i] >= 0.5 * R;

    /** The box a patch of free pixels is, or null. (x0, y0, x1, y1): the patch's bounding rectangle; cnt: its pixels. */
    const boxOf = (x0, y0, x1, y1, cnt) => {
      if (x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1) return null;
      let bw = x1 - x0 + 1;
      let bh = y1 - y0 + 1;
      if (bw < inside || bh < inside) return null; // too small to tick or to write in
      if (bw > 0.6 * w && bh > 0.3 * h) return null; // a frame round the page
      if (cnt / (bw * bh) < 0.6) return null;
      // The core: the rows and columns that are mostly free (the ragged edge row of a pale stroke is trimmed off).
      let r0 = -1;
      let r1 = -1;
      for (let y = y0; y <= y1; y++) if (share(x0, y, x1, y, isFree) >= 0.6) {
        if (r0 < 0) r0 = y;
        r1 = y;
      }
      let c0 = -1;
      let c1 = -1;
      for (let x = x0; x <= x1; x++) if (share(x, y0, x, y1, isFree) >= 0.6) {
        if (c0 < 0) c0 = x;
        c1 = x;
      }
      if (r0 < 0 || c0 < 0) return null;
      x0 = c0;
      x1 = c1;
      y0 = r0;
      y1 = r1;
      bw = x1 - x0 + 1;
      bh = y1 - y0 + 1;
      if (bw < inside || bh < inside) return null;
      if (share(x0, y0, x1, y1, isFree) < 0.9) return null; // not a rectangle of paper
      // A stroke along each of the four sides, straight.
      const sides = [
        side(x0, x1, (x, k) => y0 - 1 - k >= 0 && mh[(y0 - 1 - k) * w + x] === 1),
        side(x0, x1, (x, k) => y1 + 1 + k < h && mh[(y1 + 1 + k) * w + x] === 1),
        side(y0, y1, (y, k) => x0 - 1 - k >= 0 && mv[y * w + x0 - 1 - k] === 1),
        side(y0, y1, (y, k) => x1 + 1 + k < w && mv[y * w + x1 + 1 + k] === 1)
      ];
      if (sides.some((q) => q.straight < 0.85 || q.cover < 0.85)) return null;
      // Square corners: paper right into each corner (a round letter has print there). A stroke that falls between
      // two pixels leaves a band of half-dark pixels along its whole side: that band is the edge of the stroke, and
      // the paper starts past it.
      const soft = (ax0, ay0, ax1, ay1) => (share(ax0, ay0, ax1, ay1, isPaper) < 0.15 ? 1 : 0);
      const px0 = x0 + soft(x0, y0, x0, y1);
      const px1 = x1 - soft(x1, y0, x1, y1);
      const py0 = y0 + soft(x0, y0, x1, y0);
      const py1 = y1 - soft(x0, y1, x1, y1);
      const c = Math.max(2, Math.round(0.2 * Math.min(px1 - px0 + 1, py1 - py0 + 1)));
      if (px1 - px0 + 1 < c || py1 - py0 + 1 < c) return null;
      const corners = Math.min(share(px0, py0, px0 + c - 1, py0 + c - 1, isPaper), share(px1 - c + 1, py0, px1, py0 + c - 1, isPaper), share(px0, py1 - c + 1, px0 + c - 1, py1, isPaper), share(px1 - c + 1, py1 - c + 1, px1, py1, isPaper));
      if (corners < 0.5) return null;
      // Print inside is reported; it never decides whether the patch is a box.
      const print = bw > 2 && bh > 2 ? share(x0 + 1, y0 + 1, x1 - 1, y1 - 1, isPrint) : 0;
      // The rectangle reported is the core grown by the stroke round it.
      return { x0: x0 - 1, y0: y0 - 1, x1: x1 + 2, y1: y1 + 2, w: bw, h: bh, ink: print, small: bw <= SMALL_PT * s && bh <= SMALL_PT * s, shared: false, place: true, why: '' };
    };

    // Every patch of free pixels, filled with a stack of its own (a page is far too deep for recursion).
    let boxes = [];
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    for (let start = 0; start < n; start++) {
      if (!free[start] || seen[start]) continue;
      let top = 0;
      stack[top++] = start;
      seen[start] = 1;
      let x0 = start % w;
      let x1 = x0;
      let y0 = (start - x0) / w;
      let y1 = y0;
      let cnt = 0;
      while (top) {
        const i = stack[--top];
        cnt++;
        const x = i % w;
        const y = (i - x) / w;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (y > 0 && free[i - w] && !seen[i - w]) (seen[i - w] = 1), (stack[top++] = i - w);
        if (y < h - 1 && free[i + w] && !seen[i + w]) (seen[i + w] = 1), (stack[top++] = i + w);
        if (x > 0 && free[i - 1] && !seen[i - 1]) (seen[i - 1] = 1), (stack[top++] = i - 1);
        if (x < w - 1 && free[i + 1] && !seen[i + 1]) (seen[i + 1] = 1), (stack[top++] = i + 1);
      }
      const box = boxOf(x0, y0, x1, y1, cnt);
      if (box) boxes.push(box);
    }
    // A box that holds another box is a frame round it, not a place.
    const holds = (r, o) => o !== r && o.x0 >= r.x0 - 1 && o.x1 <= r.x1 + 1 && o.y0 >= r.y0 - 1 && o.y1 <= r.y1 + 1;
    boxes = boxes.filter((r) => !boxes.some((o) => holds(r, o)));

    /* Free rules: level strokes that are no side of a box, thin, evenly dark, with paper on both sides and clear paper above. */
    const lines = [];
    let live = [];
    let row = -1;
    level.runs.forEach((run) => {
      const y = run[0];
      if (y !== row) {
        live = live.filter((ln) => y - ln.y1 <= 1);
        row = y;
      }
      // The rows of one stroke have the same ends (bold words just above a line have other ends, and stay apart).
      let ln = null;
      for (let k = 0; k < live.length; k++) if (Math.abs(live[k].a0 - run[1]) <= 2 && Math.abs(live[k].a1 - run[2]) <= 2 && y - live[k].y1 <= 1) {
        ln = live[k];
        break;
      }
      if (ln) {
        ln.y1 = y;
        ln.a0 = Math.min(ln.a0, run[1]);
        ln.a1 = Math.max(ln.a1, run[2]);
      } else {
        ln = { a0: run[1], a1: run[2], y0: y, y1: y };
        lines.push(ln);
        live.push(ln);
      }
    });
    const rules = [];
    lines.forEach((ln) => {
      const t = ln.y1 - ln.y0 + 1;
      const long = ln.a1 - ln.a0;
      if (t > Math.max(2, Math.floor(1.5 * s))) return;
      if (long + 1 < 10 * s) return;
      // Evenly dark along its length: a row of letters is not.
      const ya = Math.max(ln.y0 - 1, 0);
      const yb = Math.min(ln.y1 + 1, h - 1);
      let sum = 0;
      let squares = 0;
      let cols = 0;
      for (let x = ln.a0 + 1; x < ln.a1; x++, cols++) {
        let col = 0;
        for (let y = ya; y <= yb; y++) col += dark[y * w + x];
        sum += col;
        squares += col * col;
      }
      if (!cols) return;
      const mean = sum / cols;
      if (Math.sqrt(Math.max(0, squares / cols - mean * mean)) > 0.3 * mean) return;
      // Not the top or the bottom of a box.
      let cov = 0;
      boxes.forEach((b) => {
        if (Math.abs(ln.y0 - b.y0) <= 3 || Math.abs(ln.y1 - b.y1) <= 3) cov += Math.max(0, Math.min(ln.a1, b.x1) - Math.max(ln.a0, b.x0));
      });
      if (cov > 0.5 * long) return;
      // Paper on both sides of it.
      const over = Math.max(ln.y0 - 2, 0);
      const under = Math.min(ln.y1 + 2, h - 1);
      if (share(ln.a0, over, ln.a1, over, isPaper) < 0.8 || share(ln.a0, under, ln.a1, under, isPaper) < 0.8) return;
      // Clear paper above its middle four fifths: room to write.
      const room = Math.round(5 * s);
      const trim = Math.max(2, Math.floor(0.1 * long));
      const r0 = Math.max(ln.y0 - room, 0);
      const r1 = Math.max(ln.y0 - 1, 0) - 1;
      if (r1 < r0 || ln.a1 - trim < ln.a0 + trim) return;
      if (share(ln.a0 + trim, r0, ln.a1 - trim, r1, isPaper) < 0.97) return;
      rules.push({ x0: ln.a0, y0: ln.y0, x1: ln.a1 + 1, y1: ln.y1 + 1, t });
    });

    const order = (a, b) => a.y0 - b.y0 || a.x0 - b.x0 || a.x1 - b.x1 || a.y1 - b.y1;
    boxes.sort(order);
    rules.sort(order);
    return { paper: P, print: lv.print, range: R, tau, boxes, rules };
  }

  const api = { find, toGrey, INK, MAX_PIXELS, MIN_PT };
  if (typeof window !== 'undefined' && window.CVPortal) window.CVPortal.picturepage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
