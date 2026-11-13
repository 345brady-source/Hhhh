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
 *                  shared (a stroke of it is also a side of a neighbouring patch: the cell of a ruled table),
 *                  place (an empty place a person completes), why ('' for a place; else 'filled': print inside,
 *                  'table': a cell that is not empty, 'narrow': too small to write in and not a square) }]
 *               Every box is reported, whether a place or not: a box exists by its pixels, and what is printed in
 *               it only says whether it is still empty.
 *       rules   [{ x0, y0, x1, y1 (pixels), t (thickness in pixels) }]   level strokes that are no side of a box;
 *               a rule that climbs or falls a pixel now and then (a page scanned a little turned) is one rule
 *     throws an Error with code 'size' for a picture of no size or of more than MAX_PIXELS pixels
 *   picturepage.toGrey(rgba, w, h)   the grey levels of RGBA bytes
 */
(function () {
  'use strict';
  const INK = 0.2;
  const MAX_PIXELS = 9.5e6;
  const MIN_PT = 4.5; // the shortest stroke and the smallest inside of a box, in points
  const SMALL_PT = 14;
  // Shares of the inside of a box that are as dark as print: an empty tick box holds at most EMPTY_TICK, a roomy box
  // with a short caption in it at most EMPTY_ROOMY, an empty cell of a ruled table less than EMPTY_CELL.
  const EMPTY_TICK = 0.01;
  const EMPTY_ROOMY = 0.12;
  const EMPTY_CELL = 0.002;
  const SQUARE = 0.2; // the sides of a square are within this share of each other
  const NARROW_W_PT = 14;
  const NARROW_H_PT = 6;

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
      return { x0: x0 - 1, y0: y0 - 1, x1: x1 + 2, y1: y1 + 2, w: bw, h: bh, ink: print, small: false, shared: false, place: true, why: '' };
    };

    // Every patch of free pixels, filled with a stack of its own (a page is far too deep for recursion).
    // Each patch has a number (patch[i], 0 on a stroke); roomy[number] says whether it is large enough to be the
    // inside of a box (a sliver of paper between two frames is not).
    let boxes = [];
    const patch = new Int32Array(n);
    const roomy = [false];
    const stack = new Int32Array(n);
    for (let start = 0; start < n; start++) {
      if (!free[start] || patch[start]) continue;
      const id = roomy.length;
      let top = 0;
      stack[top++] = start;
      patch[start] = id;
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
        if (y > 0 && free[i - w] && !patch[i - w]) (patch[i - w] = id), (stack[top++] = i - w);
        if (y < h - 1 && free[i + w] && !patch[i + w]) (patch[i + w] = id), (stack[top++] = i + w);
        if (x > 0 && free[i - 1] && !patch[i - 1]) (patch[i - 1] = id), (stack[top++] = i - 1);
        if (x < w - 1 && free[i + 1] && !patch[i + 1]) (patch[i + 1] = id), (stack[top++] = i + 1);
      }
      roomy.push(x1 - x0 + 1 >= inside && y1 - y0 + 1 >= inside);
      const box = boxOf(x0, y0, x1, y1, cnt);
      if (box) boxes.push(Object.assign(box, { id }));
    }
    // A box that holds another box is a frame round it, not a place.
    const holds = (r, o) => o !== r && o.x0 >= r.x0 - 1 && o.x1 <= r.x1 + 1 && o.y0 >= r.y0 - 1 && o.y1 <= r.y1 + 1;
    boxes = boxes.filter((r) => !boxes.some((o) => holds(r, o)));

    /* Whether each box is an empty place a person completes: decided from its pixels and its shape, never from a word. */
    // Shared: the stroke along one of its sides is also the side of a neighbouring patch (the cells of a ruled table).
    // A box with its own four strokes has the same paper past all of them: the patches past its sides are one patch.
    // The patch past a side is the one most of that side looks out on, across the stroke.
    const reach = Math.max(3, Math.round(2.6 * s)) + 2;
    const past = (b, from, to, at) => {
      const seen = new Map();
      for (let c = from; c <= to; c++) for (let k = 1; k <= reach; k++) {
        const i = at(c, k);
        if (i < 0) break;
        const id = patch[i];
        if (!id) continue;
        if (id !== b.id && roomy[id]) seen.set(id, (seen.get(id) || 0) + 1);
        break;
      }
      let best = 0;
      seen.forEach((count, id) => {
        if (count >= 0.5 * (to - from + 1) && count > (seen.get(best) || 0)) best = id;
      });
      return best;
    };
    boxes.forEach((b) => {
      // The paper inside is x0+1..x1-2 across and y0+1..y1-2 down.
      const cx0 = b.x0 + 1;
      const cx1 = b.x1 - 2;
      const cy0 = b.y0 + 1;
      const cy1 = b.y1 - 2;
      const round = [
        past(b, cx0, cx1, (x, k) => (cy0 - k >= 0 ? (cy0 - k) * w + x : -1)),
        past(b, cx0, cx1, (x, k) => (cy1 + k < h ? (cy1 + k) * w + x : -1)),
        past(b, cy0, cy1, (y, k) => (cx0 - k >= 0 ? y * w + cx0 - k : -1)),
        past(b, cy0, cy1, (y, k) => (cx1 + k < w ? y * w + cx1 + k : -1))
      ].filter((id) => id);
      b.shared = round.some((id) => id !== round[0]);
      delete b.id;
    });
    boxes.forEach((b) => {
      const bw = (b.x1 - b.x0) / s;
      const bh = (b.y1 - b.y0) / s;
      const square = Math.abs(bw - bh) <= SQUARE * Math.max(bw, bh);
      b.small = bw <= SMALL_PT && bh <= SMALL_PT;
      if (b.shared) b.why = b.ink < EMPTY_CELL ? '' : 'table'; // a cell of a ruled table: a place only when it is empty
      else if (b.small && square) b.why = b.ink <= EMPTY_TICK ? '' : 'filled'; // a tick box: empty, or ticked or a letter
      else if (bw < NARROW_W_PT || bh < NARROW_H_PT) b.why = 'narrow'; // too small to write in, and not a square
      else b.why = b.ink <= EMPTY_ROOMY ? '' : 'filled'; // a short caption printed inside a roomy box leaves it a place
      b.place = !b.why;
    });

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
    // On a page scanned a little turned, a long line climbs or falls one pixel every so often, and each stretch of it
    // lies on its own row. Strokes that continue each other one row down, each shifted the same way along, are one stroke.
    const chains = [];
    let open = [];
    lines.forEach((b) => {
      open = open.filter((c) => b.y0 - c.last.y1 <= 1);
      let best = null;
      let most = -Infinity;
      open.forEach((c) => {
        const a = c.last;
        if (a.y1 + 1 !== b.y0 || b.a0 > a.a1 + 2 || a.a0 > b.a1 + 2) return;
        const dir = b.a0 >= a.a0 - 2 && b.a1 >= a.a1 - 2 ? 1 : b.a0 <= a.a0 + 2 && b.a1 <= a.a1 + 2 ? -1 : 0;
        if (!dir || (c.dir && c.dir !== dir)) return;
        const shared = Math.min(a.a1, b.a1) - Math.max(a.a0, b.a0);
        if (shared > most) (most = shared), (best = { c, dir });
      });
      if (best) {
        best.c.parts.push(b);
        best.c.last = b;
        best.c.dir = best.dir;
      } else {
        const c = { parts: [b], last: b, dir: 0 };
        chains.push(c);
        open.push(c);
      }
    });
    const rules = [];
    const room = Math.round(5 * s);
    chains.forEach((c) => {
      const a0 = Math.min.apply(null, c.parts.map((p) => p.a0));
      const a1 = Math.max.apply(null, c.parts.map((p) => p.a1));
      const long = a1 - a0;
      if (long + 1 < 10 * s) return;
      // The rows the stroke lies on, column by column.
      const top = new Int32Array(long + 1).fill(h);
      const bot = new Int32Array(long + 1).fill(-1);
      c.parts.forEach((p) => {
        for (let x = p.a0; x <= p.a1; x++) {
          if (p.y0 < top[x - a0]) top[x - a0] = p.y0;
          if (p.y1 > bot[x - a0]) bot[x - a0] = p.y1;
        }
      });
      let t = 0;
      for (let i = 0; i <= long; i++) {
        if (bot[i] < 0) (top[i] = top[i - 1]), (bot[i] = bot[i - 1]); // the one pixel a stroke may skip
        if (bot[i] - top[i] + 1 > t) t = bot[i] - top[i] + 1;
      }
      if (t > Math.max(2, Math.floor(1.5 * s))) return;
      // Evenly dark along its length: a row of letters is not.
      let sum = 0;
      let squares = 0;
      let cols = 0;
      for (let i = 1; i < long; i++, cols++) {
        let col = 0;
        for (let y = Math.max(top[i] - 1, 0); y <= Math.min(bot[i] + 1, h - 1); y++) col += dark[y * w + a0 + i];
        sum += col;
        squares += col * col;
      }
      if (!cols) return;
      const mean = sum / cols;
      if (Math.sqrt(Math.max(0, squares / cols - mean * mean)) > 0.3 * mean) return;
      // Not the top or the bottom of a box.
      let cov = 0;
      boxes.forEach((b) => {
        const from = Math.max(a0, b.x0);
        const to = Math.min(a1, b.x1);
        for (let x = from; x < to; x++) if (Math.abs(top[x - a0] - b.y0) <= 3 || Math.abs(bot[x - a0] - b.y1) <= 3) cov++;
      });
      if (cov > 0.5 * long) return;
      // Paper on both sides of it, and clear paper above its middle four fifths: room to write.
      const trim = Math.max(2, Math.floor(0.1 * long));
      let over = 0;
      let under = 0;
      let clear = 0;
      let seen = 0;
      for (let i = 0; i <= long; i++) {
        const x = a0 + i;
        if (dark[Math.max(top[i] - 2, 0) * w + x] < tau) over++;
        if (dark[Math.min(bot[i] + 2, h - 1) * w + x] < tau) under++;
        if (i < trim || i > long - trim) continue;
        for (let y = Math.max(top[i] - room, 0); y <= top[i] - 2; y++, seen++) if (dark[y * w + x] < tau) clear++;
      }
      if (over < 0.8 * (long + 1) || under < 0.8 * (long + 1)) return;
      if (!seen || clear < 0.97 * seen) return;
      rules.push({ x0: a0, y0: Math.min.apply(null, c.parts.map((p) => p.y0)), x1: a1 + 1, y1: Math.max.apply(null, c.parts.map((p) => p.y1)) + 1, t });
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
