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
 *   picturepage.bands(page, opts)    where the words that decide something are printed: the caption strips round every
 *                                    place and free rule, the columns of places, the margin column and the heading
 *                                    zones (see the function itself)
 *   picturepage.near(word, target)   the letter changes between a read word and a known word, or -1 beyond its allowance
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

  /* ---------- How a read word is compared with a known word ---------- */

  /** The letters of a text: NFKC (full-width and tied letters as their plain spelling), case ignored, letters only. */
  function letters(s) {
    return Array.from(String(s == null ? '' : s).normalize('NFKC').toLowerCase()).filter((c) => /\p{L}/u.test(c));
  }
  /**
   * The number of letter changes (one letter put in, taken out or replaced) between a read word and a known word, when
   * it is within the known word's allowance (2 for 7 letters or more, 1 for 5 or 6, none for shorter); else -1.
   */
  function near(word, target) {
    const a = letters(word);
    const b = letters(target);
    if (!a.length || !b.length) return -1;
    const allow = b.length >= 7 ? 2 : b.length >= 5 ? 1 : 0;
    if (Math.abs(a.length - b.length) > allow) return -1;
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length] <= allow ? prev[b.length] : -1;
  }

  /* ---------- Where the words of a searched picture are read ---------- */

  // Every reach in points, relative to its own box or rule (turned into pixels by the picture's pixels per point).
  const REACH = {
    over: 15, // over a box, its own width
    under: 9, // under a box, its own width
    before: 120, // before a box on its row
    row: 1, // a row reaches this far above and below its box
    tickAfter: 260, // after a tick box on its row
    tickBefore: 60, // before a tick box on its row
    tickGap: 14, // clear paper after a tick box's words that ends them
    ruleBefore: 200,
    ruleAfter: 60,
    ruleUp: 8, // the rows before and after a free rule: from this far above it ...
    ruleDown: 2, // ... to this far below it
    ruleUnder: 12,
    ruleOverNear: 0, // over a free rule: from just above it ...
    ruleOverFar: 20, // ... to this far above (the line rules look this far up for print over a rule: a table's cells)
    longRule: 200, // a free rule longer than this is no short line with a caption under it
    word: 4.5, // the widest gap between the words of one text line
    rowGap: 24, // bands of one row merge across at most this much (a box or a rule between them)
    grow: 2, // paper round every strip
    line: 12, // a strip at most this high, with one row of print, is read as one line
    column: 3, // the edges of the boxes of one column agree within this
    marginGap: 8, // the least width of the clear gap that sets off a margin column
    block: 6, // rows of print closer than this are one block
    zoneLeft: 6, // a lettered line begins within this left ...
    zoneRight: 14, // ... and this right of the left edge of the leftmost place
    zoneHigh: 14, // and is at most this high
    zoneRead: 70, // of a lettered line this much is read: its letter and the words that decide come first
    blockRead: 60, // of a block of the margin column this much is read: a numbered heading is named in its first lines
    word1: 10, // a zone narrower than this ...
    word2: 3, // ... or lower than this holds no word (a rule across the page is lower)
    labelLeft: 12, // a label over a free rule starts within this of the rule's left end (and may run on past its right end)
    stackGap: 30, // free rules one under another this close, overlapping across, are one stack (a block of By / Name / Title)
    stackLeast: 3, // a stack of at least this many free rules has a block heading over it ...
    blockAbove: 48, // ... read from this far above its first rule's row ...
    blockLines: 3, // ... at most this many lines of print, from the bottom up ...
    blockGap: 14, // ... while the clear paper between two of them is at most this
    paraLines: 3, // the lines of a paragraph read over a blank that ends it
    spread: 16 // the widest gap between the words of a label or a paragraph line read whole (a justified line spreads them)
  };
  const MERGE = 1.5; // bands are merged while a strip's area stays within this many times the sum of its bands
  const ROW_MERGE = 3; // ... and bands of one row while it stays within this many times
  const SIDE_ORDER = ['over', 'under', 'before', 'after', 'inside'];

  /**
   * The caption strips and heading zones of a searched picture: where the words that decide something are printed.
   *   page   { grey, w, h, pxPerPt, boxes, rules, paper, range } (the finder's result with its picture)
   *   opts   { merge, row } the merge allowances (MERGE and ROW_MERGE when not given; row 1 merges no row across a box)
   * Returns { strips, columns, margin, zones }, all in pixels of the picture, strips and zones in reading order:
   *   strips  [{ x0, y0, x1, y1, line, parts: [{ of (index in boxes or rules), kind 'box' or 'rule', side, x0, y0, x1, y1 }],
   *              paint: [the parts of boxes and rules inside the strip, to be painted white before it is read] }]
   *   columns [{ boxes: [indices, top to bottom], x0, y0, x1, y1 }]   two or more places with the same left and right edges
   *   margin  { x0, x1, main } the margin column (x0 to x1) and where the page's main area begins, or null
   *   zones   [{ kind 'margin', 'letter' or 'block', x0, y0, x1, y1, line }]   heading candidates; their text decides later
   *           ('block': the lines of print over a stack of free rules, where a signature block names whose it is)
   * Every box gets col (its column's index, or -1). Only places get bands; a band with no print is dropped.
   */
  function bands(page, opts) {
    const grey = page.grey;
    const w = page.w;
    const h = page.h;
    const s = page.pxPerPt > 0 ? page.pxPerPt : 1;
    const boxes = page.boxes || [];
    const rules = page.rules || [];
    const allowance = opts && opts.merge > 0 ? +opts.merge : MERGE;
    const pt = (v) => Math.round(v * s);
    boxes.forEach((b) => (b.col = -1));
    const out = { strips: [], columns: [], margin: null, zones: [] };
    const places = [];
    boxes.forEach((b, i) => b.place !== false && places.push(i));
    if (!places.length && !rules.length) return out;
    let P = page.paper;
    let R = page.range;
    if (!(P > 0) || !(R > 0)) {
      const lv = levels(grey, w * h);
      P = lv.paper;
      R = lv.range;
    }
    // Print: a pixel as dark as half the picture's range. Counted over any rectangle from one table of sums.
    const dark = P - 0.5 * R;
    const W1 = w + 1;
    const sum = new Int32Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) {
      let run = 0;
      const r = y * w;
      const o = (y + 1) * W1;
      const p = y * W1;
      for (let x = 0; x < w; x++) {
        if (grey[r + x] <= dark) run++;
        sum[o + x + 1] = sum[p + x + 1] + run;
      }
    }
    const ink = (x0, y0, x1, y1) => {
      x0 = Math.max(0, x0);
      y0 = Math.max(0, y0);
      x1 = Math.min(w, x1);
      y1 = Math.min(h, y1);
      return x1 <= x0 || y1 <= y0 ? 0 : sum[y1 * W1 + x1] - sum[y0 * W1 + x1] - sum[y1 * W1 + x0] + sum[y0 * W1 + x0];
    };
    const meets = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const empty = (r) => r.x1 <= r.x0 || r.y1 <= r.y0;
    const g = Math.max(2, pt(0.75)); // a band keeps this far from every frame (a blurred stroke is wider than its core)
    const gap = Math.max(1, pt(0.5)); // rows of one text line may part by this much
    // What no band may enter: every box (place or not) and every free rule, each with its owner.
    const keep = boxes.map((b, i) => ({ x0: b.x0 - g, y0: b.y0 - g, x1: b.x1 + g, y1: b.y1 + g, kind: 'box', of: i })).concat(rules.map((r, i) => ({ x0: r.x0 - 1, y0: r.y0 - 1, x1: r.x1 + 1, y1: r.y1 + 1, kind: 'rule', of: i })));

    /** Rows [a, b) of a rectangle that hold print, as runs of rows (a run bridges a gap of `gap` rows). */
    const rowRuns = (r) => {
      const runs = [];
      let a = -1;
      let last = -1;
      for (let y = r.y0; y < r.y1; y++) {
        if (ink(r.x0, y, r.x1, y + 1) > 0) {
          if (a >= 0 && y - last - 1 > gap) runs.push([a, last + 1]), (a = -1);
          if (a < 0) a = y;
          last = y;
        }
      }
      if (a >= 0) runs.push([a, last + 1]);
      return runs;
    };
    /** The rectangle trimmed to the print in it, or null when it holds none. */
    const trim = (r) => {
      if (empty(r) || ink(r.x0, r.y0, r.x1, r.y1) < 2) return null;
      let { x0, y0, x1, y1 } = r;
      while (x0 < x1 && !ink(x0, y0, x0 + 1, y1)) x0++;
      while (x1 > x0 && !ink(x1 - 1, y0, x1, y1)) x1--;
      while (y0 < y1 && !ink(x0, y0, x1, y0 + 1)) y0++;
      while (y1 > y0 && !ink(x0, y1 - 1, x1, y1)) y1--;
      return { x0, y0, x1, y1 };
    };
    /**
     * How far the text line in rows [y0, y1) that holds print at columns [x0, x1) runs, left and right: words follow
     * each other with less than REACH.word of clear paper between them; a box or a rule ends the line.
     */
    const lineOf = (y0, y1, x0, x1, gapPt) => {
      let lo = 0;
      let hi = w;
      keep.forEach((k) => {
        if (k.y0 >= y1 || k.y1 <= y0) return;
        if (k.x1 <= x0 && k.x1 > lo) lo = k.x1;
        if (k.x0 >= x1 && k.x0 < hi) hi = k.x0;
      });
      const most = pt(gapPt || REACH.word);
      let a = x0;
      for (let x = x0 - 1, clear = 0; x >= lo && clear <= most; x--) {
        if (ink(x, y0, x + 1, y1)) (a = x), (clear = 0);
        else clear++;
      }
      let b = x1;
      for (let x = x1, clear = 0; x < hi && clear <= most; x++) {
        if (ink(x, y0, x + 1, y1)) (b = x + 1), (clear = 0);
        else clear++;
      }
      return { x0: a, x1: b };
    };
    /**
     * A band reaching away from its own box or rule (dir 'up', 'down', 'left', 'right'), cut at every other box and
     * rule it meets: one that lies ahead is cut across, one beside it is cut along. Returns which ends were cut.
     */
    const clip = (r, dir, own) => {
      const cut = {};
      const oc = { x: (own.x0 + own.x1) / 2, y: (own.y0 + own.y1) / 2 };
      for (let pass = 0; pass < 4; pass++) {
        let changed = false;
        keep.forEach((k) => {
          if ((k.kind === own.kind && k.of === own.of) || empty(r) || !meets(r, k)) return;
          // the box a place stands inside (a table's cell round a short line) is no obstacle to its own bands
          if (k.x0 <= own.x0 && k.x1 >= own.x1 && k.y0 <= own.y0 && k.y1 >= own.y1) return;
          changed = true;
          const kx = (k.x0 + k.x1) / 2;
          const ky = (k.y0 + k.y1) / 2;
          const across = dir === 'up' ? ky < own.y0 : dir === 'down' ? ky > own.y1 : dir === 'left' ? kx < own.x0 : kx > own.x1;
          if (across) {
            if (dir === 'up') (r.y0 = Math.max(r.y0, k.y1)), (cut.y0 = true);
            else if (dir === 'down') (r.y1 = Math.min(r.y1, k.y0)), (cut.y1 = true);
            else if (dir === 'left') (r.x0 = Math.max(r.x0, k.x1)), (cut.x0 = true);
            else (r.x1 = Math.min(r.x1, k.x0)), (cut.x1 = true);
          } else if (dir === 'up' || dir === 'down') {
            if (kx < oc.x) r.x0 = Math.max(r.x0, k.x1);
            else r.x1 = Math.min(r.x1, k.x0);
          } else if (ky < oc.y) r.y0 = Math.max(r.y0, k.y1);
          else r.y1 = Math.min(r.y1, k.y0);
        });
        if (!changed) break;
      }
      r.x0 = Math.max(0, r.x0);
      r.y0 = Math.max(0, r.y0);
      r.x1 = Math.min(w, r.x1);
      r.y1 = Math.min(h, r.y1);
      return cut;
    };

    /* The margin column, found from the picture and never from the boxes. */
    const lefts = places.map((i) => boxes[i].x0).concat(rules.map((r) => r.x0));
    const leftmost = Math.min.apply(null, lefts);
    const letter = Math.max(4, Math.round(4 * s * s)); // about the print of one small letter
    // A column of print beside the rows of the boxes right of it is their captions, not a margin.
    const captions = (x1, main) => {
      let n = 0;
      let m = 0;
      for (let y = 0; y < h; y++) {
        if (!ink(0, y, x1, y + 1)) continue;
        n++;
        if (places.some((i) => boxes[i].x0 >= main && y >= boxes[i].y0 - pt(REACH.row) && y < boxes[i].y1 + pt(REACH.row))) m++;
      }
      return n > 0 && m > 0.5 * n;
    };
    const firstInk = (x0, x1) => {
      for (let x = x0; x < x1; x++) if (ink(x, 0, x + 1, h)) return x;
      return x0;
    };
    // (1) a long upright stroke left of the leftmost box that is a place, with print left of it: the margin rule runs
    // beside the places it sets off, at least 30% of the height they span, and never shorter than a tenth of the
    // picture. (A free rule may start inside the margin column: a rule across the page, or a line to write on at the
    // page's left edge.)
    const spanTop = Math.min.apply(null, places.map((i) => boxes[i].y0).concat(rules.map((r) => r.y0)));
    const spanEnd = Math.max.apply(null, places.map((i) => boxes[i].y1).concat(rules.map((r) => r.y1)));
    const tall = Math.max(0.3 * (spanEnd - spanTop), 0.1 * h);
    const boxLeft = places.length ? Math.min.apply(null, places.map((i) => boxes[i].x0)) : leftmost;
    const strokeCols = [];
    for (let x = 1; x < Math.min(boxLeft, w - 1); x++) {
      if (ink(x - 1, 0, x + 2, h) < tall) continue;
      let best = 0;
      let run = 0;
      let miss = 0;
      for (let y = 0; y < h; y++) {
        const r = y * w + x;
        if (grey[r - 1] <= dark || grey[r] <= dark || grey[r + 1] <= dark) {
          run += miss + 1;
          miss = 0;
          if (run > best) best = run;
        } else if (run && miss < 1) miss++;
        else (run = 0), (miss = 0);
      }
      if (best >= tall) strokeCols.push(x);
    }
    for (let k = strokeCols.length - 1; k >= 0 && !out.margin; ) {
      let a = k;
      while (a > 0 && strokeCols[a - 1] === strokeCols[a] - 1) a--;
      const xa = strokeCols[a];
      const xb = strokeCols[k];
      if (ink(0, 0, xa - 1, h) >= letter && !captions(xa - 1, xb + 1)) out.margin = { x0: firstInk(0, xa - 1), x1: xa - 1, main: xb + 2 };
      k = a - 1;
    }
    // (2) else the widest upright gap of clear paper, at least 8 pt wide, in the left two fifths, with print on both sides
    if (!out.margin) {
      const most = 0.02 * h;
      let best = null;
      for (let x = 0; x < w; ) {
        if (ink(x, 0, x + 1, h) > most) {
          x++;
          continue;
        }
        const ga = x;
        while (x < w && ink(x, 0, x + 1, h) <= most) x++;
        const gb = x;
        if (gb - ga < pt(REACH.marginGap) || ga === 0 || gb > 0.4 * w) continue;
        if (ink(0, 0, ga, h) < letter || ink(gb, 0, w, h) < letter) continue;
        if (best && gb - ga <= best.gb - best.ga) continue;
        if (captions(ga, gb)) continue;
        best = { ga, gb };
      }
      if (best) out.margin = { x0: firstInk(0, best.ga), x1: best.ga, main: best.gb };
    }
    const margin = out.margin;

    /* The bands of every place and every free rule. A band never ends inside a line of print: read as one line, a
       strip with the cut-off tops of the next line under it comes back with no word at all. */
    // a run of rows that an edge of r cuts through: print goes on past that edge
    const cutAt = (r, a, b) => (a === r.y0 && a > 0 && ink(r.x0, a - 1, r.x1, a) > 0) || (b === r.y1 && b < h && ink(r.x0, b, r.x1, b + 1) > 0);
    // r limited to its whole lines (null when it has none)
    const whole = (r) => {
      if (empty(r)) return null;
      const runs = rowRuns(r).filter(([a, b]) => !cutAt(r, a, b));
      return runs.length ? trim({ x0: r.x0, y0: runs[0][0], x1: r.x1, y1: runs[runs.length - 1][1] }) : null;
    };
    // a band on its box's row: the whole text lines (looked for a little above and below) that cross the middle half of
    // the box's height
    const rowOf = (r, own) => {
      if (empty(r)) return null;
      const look = { x0: r.x0, y0: Math.max(0, own.y0 - pt(6)), x1: r.x1, y1: Math.min(h, own.y1 + pt(6)) };
      const q = (own.y1 - own.y0) / 4;
      const runs = rowRuns(look).filter(([a, b]) => a < own.y1 - q && b > own.y0 + q && !cutAt(look, a, b));
      return runs.length ? { x0: r.x0, y0: runs[0][0], x1: r.x1, y1: runs[runs.length - 1][1] } : null;
    };
    // a band beside a free rule whose own rows hold no whole line: the whole text line (looked for a little above and
    // below) whose print comes down to within 3 pt of the rule, as a label stands on the line it names; a line of print
    // larger than the band's rows (a bold label with its descenders) is taken whole, at most REACH.line * 1.5 high
    const ruleRow = (r, own) => {
      if (empty(r)) return null;
      const look = { x0: r.x0, y0: Math.max(0, r.y0 - pt(6)), x1: r.x1, y1: Math.min(h, r.y1 + pt(6)) };
      const runs = rowRuns(look).filter(([a, b]) => a < own.y1 + pt(REACH.ruleDown) && b > own.y0 - pt(3) && b - a <= pt(1.5 * REACH.line) && !cutAt(look, a, b));
      return runs.length ? trim({ x0: r.x0, y0: runs[0][0], x1: r.x1, y1: runs[runs.length - 1][1] }) : null;
    };
    // A free rule with words before it on its row, under a line of print that runs on past both its ends, is a blank at
    // the end of a paragraph, and its label is the paragraph: over it the paragraph's lines are read whole, across the
    // text, from the bottom up (at most REACH.paraLines, each parted from the next by less than half a line of paper).
    const paragraph = (over, lead, own) => {
      const ln = lineOf(over.y0, over.y1, Math.min(over.x0, lead.x0), over.x1, REACH.spread);
      if (ln.x0 > lead.x0 + pt(REACH.word) || ln.x1 < own.x1 + pt(REACH.word)) return null;
      const r = { x0: ln.x0, y0: Math.max(0, over.y0 - pt(REACH.blockAbove)), x1: ln.x1, y1: over.y1 };
      clip(r, 'up', own);
      if (empty(r)) return null;
      // (the band's own line ends the paragraph at the foot: only a line cut at the top is left out)
      const runs = rowRuns(r).filter(([a, b]) => !(a === r.y0 && a > 0 && ink(r.x0, a - 1, r.x1, a) > 0) && b - a <= pt(1.5 * REACH.line));
      if (!runs.length) return null;
      let k = runs.length - 1;
      let top = runs[k][0];
      for (let n = 1; k > 0 && n < REACH.paraLines; n++) {
        const lineH = runs[k][1] - runs[k][0];
        if (runs[k][0] - runs[k - 1][1] >= 0.5 * lineH) break;
        k--;
        top = runs[k][0];
      }
      return trim({ x0: r.x0, y0: top, x1: r.x1, y1: runs[runs.length - 1][1] });
    };
    const parts = [];
    const add = (kind, of, side, r) => r && parts.push({ of, kind, side, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 });
    // over or under: cut at a text line wider than its owner by more than the owner's own width (running prose)
    const upDown = (r, dir, own) => {
      clip(r, dir, own);
      if (empty(r)) return null;
      const runs = rowRuns(r);
      if (dir === 'up') runs.reverse();
      const kept = [];
      for (let i = 0; i < runs.length; i++) {
        const long = own.kind === 'rule' && own.x1 - own.x0 > pt(REACH.longRule);
        if (cutAt(r, runs[i][0], runs[i][1]) && own.kind === 'rule' && dir === 'down' && long && !kept.length && runs[i][1] === r.y1) {
          // the first line under a long free rule, cut by the band's far edge: taken whole (see below)
          let b = runs[i][1];
          while (b < h && b < r.y1 + pt(8) && ink(r.x0, b, r.x1, b + 1) > 0) b++;
          runs[i] = [runs[i][0], b];
        } else if (cutAt(r, runs[i][0], runs[i][1])) {
          // a line the band's far edge cuts through: left out of a box's band; over a free rule taken whole, since the
          // line rules look for print up to REACH.ruleOverFar above a rule
          if (own.kind !== 'rule' || dir !== 'up') continue;
          let a = runs[i][0];
          while (a > 0 && a > r.y0 - pt(8) && ink(r.x0, a - 1, r.x1, a) > 0) a--;
          runs[i] = [a, runs[i][1]];
        }
        const t = trim({ x0: r.x0, y0: runs[i][0], x1: r.x1, y1: runs[i][1] });
        if (!t) continue;
        const ln = lineOf(t.y0, t.y1, t.x0, t.x1);
        // (a free rule's bands are its own width, and the line rules read them: the words standing over a rule and the
        // mark that opens the print under a footnote rule; running text is cut only from the bands of a box)
        if (own.kind === 'box' && ln.x1 - ln.x0 > 2 * (own.x1 - own.x0)) break;
        // under a free rule longer than REACH.longRule, a text line nearly as wide as the rule is the next line of the
        // page (a heading or running text), not a caption of the rule: only that first line is read (the line rules
        // look at what stands right under a rule: a note in the sponsor's brackets opens there), nothing under it
        if (own.kind === 'rule' && dir === 'down' && own.x1 - own.x0 > pt(REACH.longRule) && ln.x1 - ln.x0 >= 0.8 * (own.x1 - own.x0)) {
          if (!kept.length) kept.push(t);
          break;
        }
        kept.push(t);
      }
      if (!kept.length) return null;
      // Over a free rule the line rules look for the nearest print, and only where two or more upright strokes meet
      // the rule (the edge of a table) for print over each stretch between them: the nearest line is enough elsewhere.
      if (own.kind === 'rule' && dir === 'up') {
        const tol = pt(1.5);
        const walls = boxes.reduce((n, b) => (b.y0 - tol <= own.y1 && b.y1 + tol >= own.y0 ? n + (b.x0 >= own.x0 - tol && b.x0 <= own.x1 + tol) + (b.x1 >= own.x0 - tol && b.x1 <= own.x1 + tol) : n), 0);
        if (walls < 2) kept.length = 1;
      }
      const t = trim({ x0: r.x0, y0: Math.min.apply(null, kept.map((t) => t.y0)), x1: r.x1, y1: Math.max.apply(null, kept.map((t) => t.y1)) });
      // A label over a free rule that starts where the rule starts is read whole: it may run on past the rule's right
      // end (its closing words and colon decide that it is a label), up to the rule's own width again.
      if (t && own.kind === 'rule' && dir === 'up' && t.x0 - own.x0 <= pt(REACH.labelLeft)) {
        const ln = lineOf(t.y0, t.y1, t.x0, t.x1, REACH.spread);
        if (ln.x1 > t.x1) t.x1 = Math.min(w, ln.x1, own.x1 + (own.x1 - own.x0));
      }
      return t;
    };
    // before on its row: cut at the margin; a text line that runs on past the band's reach is running prose
    const before = (r, own, prose) => {
      if (margin && own.x0 >= margin.main && r.x0 < margin.main) (r.x0 = margin.main), (own.edge = true);
      const reach = r.x0;
      clip(r, 'left', own);
      let t = own.kind === 'box' ? rowOf(r, own) : whole(r) || ruleRow(r, own);
      if (t && own.kind === 'box') {
        Object.assign(r, { y0: t.y0, y1: t.y1 });
        clip(r, 'left', own);
        t = trim(r);
      }
      if (!t) return null;
      if (prose && r.x0 === reach && reach > 0 && !own.edge && lineOf(t.y0, t.y1, t.x0, t.x1).x0 < r.x0) return null;
      return t;
    };
    places.forEach((i) => {
      const b = boxes[i];
      const own = { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, kind: 'box', of: i };
      const bw = (b.x1 - b.x0) / s;
      const bh = (b.y1 - b.y0) / s;
      const y0 = b.y0 - pt(REACH.row);
      const y1 = b.y1 + pt(REACH.row);
      if (b.small && Math.abs(bw - bh) <= SQUARE * Math.max(bw, bh)) {
        // a tick box: the words after it on its row, up to the next box or a wide gap once its words have begun
        const r = { x0: b.x1 + g, y0, x1: b.x1 + pt(REACH.tickAfter), y1 };
        clip(r, 'right', own);
        if (!empty(r)) {
          let last = -1;
          for (let x = r.x0; x < r.x1; x++) {
            if (ink(x, r.y0, x + 1, r.y1)) last = x;
            else if (last >= 0 && x - last > pt(REACH.tickGap)) break;
          }
          const line = last >= 0 ? rowOf({ x0: r.x0, y0: r.y0, x1: last + 1, y1: r.y1 }, own) : null;
          if (line) {
            clip(line, 'right', own);
            add('box', i, 'after', trim(line));
          }
        }
        add('box', i, 'before', before({ x0: b.x0 - pt(REACH.tickBefore), y0, x1: b.x0 - g, y1 }, Object.assign({}, own), true));
        return;
      }
      add('box', i, 'over', upDown({ x0: b.x0, y0: b.y0 - pt(REACH.over), x1: b.x1, y1: b.y0 - g }, 'up', own));
      add('box', i, 'under', upDown({ x0: b.x0, y0: b.y1 + g, x1: b.x1, y1: b.y1 + pt(REACH.under) }, 'down', own));
      add('box', i, 'before', before({ x0: b.x0 - pt(REACH.before), y0, x1: b.x0 - g, y1 }, Object.assign({}, own), true));
      if (b.ink > 0) add('box', i, 'inside', trim({ x0: b.x0 + g, y0: b.y0 + g, x1: b.x1 - g, y1: b.y1 - g }));
    });
    rules.forEach((ru, i) => {
      const own = { x0: ru.x0, y0: ru.y0, x1: ru.x1, y1: ru.y1, kind: 'rule', of: i };
      const y0 = ru.y0 - pt(REACH.ruleUp);
      const y1 = ru.y1 + pt(REACH.ruleDown);
      add('rule', i, 'before', before({ x0: ru.x0 - pt(REACH.ruleBefore), y0, x1: ru.x0 - 1, y1 }, Object.assign({}, own), false));
      const after = { x0: ru.x1 + 1, y0, x1: ru.x1 + pt(REACH.ruleAfter), y1 };
      clip(after, 'right', own);
      add('rule', i, 'after', whole(after) || ruleRow(after, own));
      let over = upDown({ x0: ru.x0, y0: ru.y0 - pt(REACH.ruleOverFar), x1: ru.x1, y1: ru.y0 - Math.max(1, pt(REACH.ruleOverNear)) }, 'up', own);
      const lead = parts.find((q) => q.kind === 'rule' && q.of === i && q.side === 'before');
      if (over && lead) over = paragraph(over, lead, own) || over;
      add('rule', i, 'over', over);
      add('rule', i, 'under', upDown({ x0: ru.x0, y0: ru.y1 + 1, x1: ru.x1, y1: ru.y1 + pt(REACH.ruleUnder) }, 'down', own));
    });

    /*
     * Bands that touch or overlap are one strip, while its area stays within the allowance and it meets no box or rule.
     * Bands of one row (their rows overlap by more than half) are one strip while its area stays within ROW_MERGE times
     * theirs, even with a box or a rule between them, when nothing else is printed between them: the boxes and rules
     * inside such a strip are painted white before it is read (strip.paint), so one reading takes the whole row.
     */
    const area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);
    const touch = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
    const rowAllowance = opts && opts.row > 0 ? +opts.row : ROW_MERGE;
    const oneRow = (a, b) => {
      const common = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (common <= 0.5 * Math.min(a.y1 - a.y0, b.y1 - b.y0)) return false;
      const l = a.x1 <= b.x0 ? a : b;
      const r = l === a ? b : a;
      if (r.x0 - l.x1 > pt(REACH.rowGap)) return false;
      // nothing printed between them but boxes and rules
      const between = { x0: l.x1, y0: Math.max(a.y0, b.y0), x1: r.x0, y1: Math.min(a.y1, b.y1) };
      if (empty(between)) return true;
      let left = ink(between.x0, between.y0, between.x1, between.y1);
      keep.forEach((k) => meets(between, k) && (left -= ink(Math.max(between.x0, k.x0), Math.max(between.y0, k.y0), Math.min(between.x1, k.x1), Math.min(between.y1, k.y1))));
      return left <= 0;
    };
    let list = parts.map((q) => ({ x0: q.x0, y0: q.y0, x1: q.x1, y1: q.y1, parts: [q], area: area(q) }));
    for (let changed = true; changed; ) {
      changed = false;
      for (let i = 0; i < list.length && !changed; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          const u = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
          const plain = touch(a, b) && area(u) <= allowance * (a.area + b.area) && !keep.some((k) => meets(u, k));
          if (!plain && !(rowAllowance > allowance && area(u) <= rowAllowance * (a.area + b.area) && oneRow(a, b))) continue;
          list[i] = Object.assign(u, { parts: a.parts.concat(b.parts), area: a.area + b.area });
          list.splice(j, 1);
          changed = true;
          break;
        }
      }
    }
    // One row of print at most REACH.line high is read as a line.
    const oneLine = (r) => r.y1 - r.y0 <= pt(REACH.line) && rowRuns(r).length <= 1;
    // Grown by paper: a row or column is added while it holds no print and meets no box, rule or other strip.
    const grow = (r, others) => {
      const most = pt(REACH.grow);
      const free = (q) => q.x0 >= 0 && q.y0 >= 0 && q.x1 <= w && q.y1 <= h && !ink(q.x0, q.y0, q.x1, q.y1) && !keep.some((k) => meets(q, k)) && !others.some((o) => o !== r && meets(q, o));
      for (let k = 0; k < most && free({ x0: r.x0, y0: r.y0 - 1, x1: r.x1, y1: r.y0 }); k++) r.y0--;
      for (let k = 0; k < most && free({ x0: r.x0, y0: r.y1, x1: r.x1, y1: r.y1 + 1 }); k++) r.y1++;
      for (let k = 0; k < most && free({ x0: r.x0 - 1, y0: r.y0, x1: r.x0, y1: r.y1 }); k++) r.x0--;
      for (let k = 0; k < most && free({ x0: r.x1, y0: r.y0, x1: r.x1 + 1, y1: r.y1 }); k++) r.x1++;
      return r;
    };
    const order = (a, b) => a.y0 - b.y0 || a.x0 - b.x0 || a.y1 - b.y1 || a.x1 - b.x1;
    const sideOrder = (a, b) => SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side) || order(a, b);
    list = list.map((st) => ({ x0: st.x0, y0: st.y0, x1: st.x1, y1: st.y1, line: oneLine(st), parts: st.parts.slice().sort((a, b) => (a.kind === b.kind ? a.of - b.of : a.kind === 'box' ? -1 : 1) || sideOrder(a, b)) }));
    list.sort(order);
    list.forEach((st) => grow(st, list));
    // the boxes and rules a strip of one row spans, to be painted white before it is read
    list.forEach((st) => {
      st.paint = keep.filter((k) => meets(st, k)).map((k) => ({ x0: Math.max(st.x0, k.x0), y0: Math.max(st.y0, k.y0), x1: Math.min(st.x1, k.x1), y1: Math.min(st.y1, k.y1) }));
    });
    out.strips = list;

    /* Columns: places whose left and right edges agree, top to bottom. */
    const tol = REACH.column * s;
    const root = places.map((_, k) => k);
    const top = (k) => (root[k] === k ? k : (root[k] = top(root[k])));
    for (let a = 0; a < places.length; a++)
      for (let c = a + 1; c < places.length; c++) {
        const p = boxes[places[a]];
        const q = boxes[places[c]];
        if (Math.abs(p.x0 - q.x0) <= tol && Math.abs(p.x1 - q.x1) <= tol) root[top(a)] = top(c);
      }
    const groups = new Map();
    places.forEach((i, k) => {
      const t = top(k);
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(i);
    });
    const columns = [];
    groups.forEach((ids) => {
      if (ids.length < 2) return;
      ids.sort((a, c) => boxes[a].y0 - boxes[c].y0 || boxes[a].x0 - boxes[c].x0);
      const bs = ids.map((i) => boxes[i]);
      columns.push({ boxes: ids, x0: Math.min.apply(null, bs.map((b) => b.x0)), y0: bs[0].y0, x1: Math.max.apply(null, bs.map((b) => b.x1)), y1: Math.max.apply(null, bs.map((b) => b.y1)) });
    });
    columns.sort(order);
    columns.forEach((c, k) => c.boxes.forEach((i) => (boxes[i].col = k)));
    out.columns = columns;

    /* Heading zones: blocks of print in the margin column, and lettered lines at the left edge of the places. */
    const zones = [];
    if (margin) {
      const runs = [];
      for (let y = 0; y < h; y++) {
        if (!ink(margin.x0, y, margin.x1, y + 1)) continue;
        const last = runs[runs.length - 1];
        if (last && y - last[1] < pt(REACH.block)) last[1] = y + 1;
        else runs.push([y, y + 1]);
      }
      runs.forEach((rn) => {
        if (rn[1] - rn[0] < pt(REACH.word2)) return; // a rule across the page, not a heading
        const t = trim({ x0: margin.x0, y0: rn[0], x1: margin.x1, y1: Math.min(rn[1], rn[0] + pt(REACH.blockRead)) });
        if (t) zones.push(Object.assign({ kind: 'margin' }, t));
      });
    }
    const from = margin ? margin.main : 0;
    const inMain = lefts.filter((x) => x >= from);
    if (inMain.length) {
      const L = Math.min.apply(null, inMain);
      const wa = Math.max(from, L - pt(REACH.zoneLeft));
      const wb = Math.min(w, L + pt(REACH.zoneRight));
      // print that lies in no box, no rule and no caption strip
      const off = keep.concat(out.strips);
      const mask = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0, r = y * w; x < w; x++) mask[r + x] = grey[r + x] <= dark ? 1 : 0;
      off.forEach((k) => {
        for (let y = Math.max(0, k.y0); y < Math.min(h, k.y1); y++) mask.fill(0, y * w + Math.max(0, k.x0), y * w + Math.max(0, Math.min(w, k.x1)));
      });
      const rowHas = (y, x0, x1) => {
        for (let x = x0, r = y * w; x < x1; x++) if (mask[r + x]) return true;
        return false;
      };
      const colHas = (x, y0, y1) => {
        for (let y = y0; y < y1; y++) if (mask[y * w + x]) return true;
        return false;
      };
      const runs = [];
      let a = -1;
      let last = -1;
      for (let y = 0; y <= h; y++) {
        if (y < h && rowHas(y, wa, wb)) {
          if (a >= 0 && y - last - 1 > gap) runs.push([a, last + 1]), (a = -1);
          if (a < 0) a = y;
          last = y;
        }
      }
      if (a >= 0) runs.push([a, last + 1]);
      runs.forEach(([y0, y1]) => {
        if (y1 - y0 > pt(REACH.zoneHigh)) return;
        let x0 = -1;
        for (let x = from; x < wb && x0 < 0; x++) if (colHas(x, y0, y1)) x0 = x;
        if (x0 < wa) return; // the row begins further left: it is no line set at the edge of the places
        let stop = w;
        off.forEach((k) => k.y0 < y1 && k.y1 > y0 && k.x0 >= x0 && k.x0 < stop && (stop = k.x0));
        let x1 = x0 + 1;
        for (let x = x0, clear = 0; x < stop && clear <= pt(REACH.zoneRight); x++) {
          if (colHas(x, y0, y1)) (x1 = x + 1), (clear = 0);
          else clear++;
        }
        // A lettered line opens with one short mark (a letter and its stop, or a bracketed letter) and then a space;
        // running text at the same edge opens with a word.
        const hi = y1 - y0;
        const space = Math.max(2, Math.ceil(0.3 * hi));
        let first = x0 + 1;
        for (let x = x0, clear = 0; x < x1; x++) {
          if (colHas(x, y0, y1)) (first = x + 1), (clear = 0);
          else if (++clear >= space) break;
        }
        if (first - x0 > 1.4 * hi || first >= x1) return; // (a capital and its stop are wider than a line of capitals is high)
        // the mark ends in a full stop (a small dot low in the line) or a closing bracket (reaching below the capital)
        const k = Math.max(1, Math.round(0.25 * hi));
        const rows = (c0, c1) => {
          let t = -1;
          let b = -1;
          for (let y = y0; y < y1; y++) {
            for (let x = Math.max(x0, c0); x < c1; x++) {
              if (mask[y * w + x]) {
                if (t < 0) t = y;
                b = y;
                break;
              }
            }
          }
          return { t, b };
        };
        const head = rows(x0, x0 + k);
        const tail = rows(first - k, first);
        const dot = tail.t >= y0 + 0.55 * hi;
        const bracket = tail.b >= head.b + Math.max(1, 0.1 * hi) && tail.b - tail.t >= 0.8 * hi;
        if (!dot && !bracket) return;
        if (x1 - x0 < pt(REACH.word1) || hi < pt(REACH.word2)) return; // too small to hold a word
        // and it is set off from what is above it by more than the spacing of the lines of running text
        const end = Math.min(x1, x0 + pt(REACH.zoneRead));
        for (let y = Math.max(0, y0 - Math.ceil(0.6 * hi)); y < y0; y++) if (rowHas(y, x0, end)) return;
        zones.push({ kind: 'letter', x0, y0, x1: end, y1 });
      });
    }
    // A block heading over a stack of free rules: the stack's rules stand one under another (each within
    // REACH.stackGap of the one above, overlapping it across by half the shorter); over the first, the lines of print
    // from the bottom up (whole lines, at most REACH.blockLines, parted by at most REACH.blockGap) up to REACH.blockAbove
    // above its row, from the left end of the stack's labels to the stack's right end.
    const stacks = [];
    rules
      .map((ru, i) => ({ ru, i }))
      .sort((a, b) => a.ru.y0 - b.ru.y0 || a.ru.x0 - b.ru.x0)
      .forEach((e) => {
        const st = stacks.find((k) => {
          const last = k[k.length - 1].ru;
          return e.ru.y0 - last.y1 > 0 && e.ru.y0 - last.y1 <= pt(REACH.stackGap) && Math.min(e.ru.x1, last.x1) - Math.max(e.ru.x0, last.x0) >= 0.5 * Math.min(e.ru.x1 - e.ru.x0, last.x1 - last.x0);
        });
        if (st) st.push(e);
        else stacks.push([e]);
      });
    stacks.forEach((st) => {
      if (st.length < REACH.stackLeast) return;
      const first = st[0];
      const mine = parts.filter((q) => q.kind === 'rule' && st.some((e) => e.i === q.of));
      const left = Math.min.apply(null, mine.filter((q) => q.side === 'before').map((q) => q.x0).concat(st.map((e) => e.ru.x0)));
      const right = Math.max.apply(null, st.map((e) => e.ru.x1));
      const roof = Math.min.apply(null, mine.filter((q) => q.of === first.i).map((q) => q.y0).concat(first.ru.y0 - pt(REACH.ruleUp)));
      const r = { x0: left, y0: Math.max(0, roof - pt(REACH.blockAbove)), x1: right, y1: roof - 1 };
      clip(r, 'up', { x0: first.ru.x0, y0: first.ru.y0, x1: first.ru.x1, y1: first.ru.y1, kind: 'rule', of: first.i });
      if (empty(r)) return;
      const runs = rowRuns(r).filter(([a, b]) => !cutAt(r, a, b) && b - a <= pt(1.5 * REACH.line));
      const kept = [];
      for (let k = runs.length - 1; k >= 0 && kept.length < REACH.blockLines; k--) {
        if (kept.length && kept[kept.length - 1][0] - runs[k][1] > pt(REACH.blockGap)) break;
        if (!kept.length && roof - runs[k][1] > pt(REACH.blockGap)) break;
        kept.push(runs[k]);
      }
      if (!kept.length) return;
      const t = trim({ x0: r.x0, y0: kept[kept.length - 1][0], x1: r.x1, y1: kept[0][1] });
      if (t && t.x1 - t.x0 >= pt(REACH.word1)) zones.push(Object.assign({ kind: 'block' }, t));
    });
    zones.forEach((z) => (z.line = oneLine(z)));
    zones.sort(order);
    zones.forEach((z) => grow(z, out.strips.concat(zones)));
    out.zones = zones;
    return out;
  }

  const api = { find, toGrey, bands, near, INK, MAX_PIXELS, MIN_PT };
  if (typeof window !== 'undefined' && window.CVPortal) window.CVPortal.picturepage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
