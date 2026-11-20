/*
 * The place model: places a person completes, seen on the picture of a page by a small trained network, each one
 * kept only where the picture prints it.
 *
 * A hosted preview refuses every request a page makes for data, so nothing here asks the network for anything: this
 * file is loaded by a script element (NS.textread, on the first page read from its picture), the model's worker is
 * started from the portal's own file (assets/vendor/formread/places-worker.js) and the model reaches it as a script it
 * imports (assets/vendor/formread/places-model.js). No part of a page picture leaves the page.
 *
 *   NS.placemodel.start()               starts the worker and the model once; resolves when it is ready. Rejects with an
 *                                       Error whose code is 'load' within LOAD_MS; a failed start is forgotten and its
 *                                       worker ended, so a later start tries again.
 *   NS.placemodel.find(canvas, view)    the places of one drawn page. view: { scale, sy, ox, oy } (canvas pixel = point *
 *                                       (scale, sy) + (ox, oy)), pw, ph (the page in points), and, when the caller
 *                                       has them, grey (one byte a canvas pixel), paper and range (the picture's paper
 *                                       level and its range from paper to print, NS.picturepage.find). Resolves to
 *                                       [{ x0, y0, x1, y1 (points), cls, p, src: 'model', px }] sorted by page position
 *                                       (top, then left): cls one of CLASSES, p the mean probability of the place, px
 *                                       the snapped place in canvas pixels ({ x0, y0, x1, y1 } a box; a writing or
 *                                       signature place also { line: true, t } for the printed line it stands on).
 *                                       Rejects with code 'load' or 'run'.
 *   NS.placemodel.stop()                ends the worker
 *
 * Every place the model sees is snapped before it is given: each side of a box grows or shrinks to the nearest printed
 * edge or tint step within SNAP_PT, and a writing place to the printed line under it; a place that does not snap is
 * dropped, never given. An illustration place is given as the model saw it: it only says where boxes are part of a
 * picture (a cheque, an example), and adds nothing.
 *
 * The same page gives the same places: the page is resampled to a fixed size from its points (96 to the inch), the
 * worker runs on one thread, and every step after it is plain arithmetic in a fixed order.
 */
(function (NS) {
  'use strict';
  const DIR = 'assets/vendor/formread/';
  const LOAD_MS = 20000;
  const RUN_MS = 10000; // one page
  const PX_PER_PT = 4 / 3; // the model reads the page at 96 to the inch
  const Q = 4; // its maps are a quarter of its input each way
  const MULT = 16; // its input is padded with paper to a multiple of 16 each way
  const MAX_SIDE = 4096;
  /** The model's maps: 0 is the paper, then one map for each class. */
  const CLASSES = ['tick', 'writing', 'signature', 'letterbox', 'illustration'];
  /** A cell is part of a place of a class when the class's map is at least this there (chosen on train fold 1). */
  const THRESH = { tick: 0.9, writing: 0.75, signature: 0.3, letterbox: 0.95, illustration: 0.95 };
  /** The fewest cells (a quarter of the input each way) a place of a class may have. */
  const MIN_CELLS = { tick: 1, writing: 3, signature: 3, letterbox: 3, illustration: 16 };
  const SNAP_PT = 6;
  const EDGE = 0.75; // the share of a side that must be printed for it to be an edge
  const TINT = 0.15; // a tint step: the paper inside is lighter than the ground outside by this share of the range
  const TICK_PT = [4.5, 16]; // the sides of a tick box
  const TICK_INK = 0.02; // the most of a tick box's inside that may be as dark as print
  const BOX_INK = 0.06; // the same for a row of letter boxes, its walls left out
  const LINE_MIN_PT = 18; // the shortest printed line a writing place stands on
  const PAPER_INK = 0.1; // the most print on the rows just over and under a printed line
  const ROOM_PT = 12; // the room above a line that must be paper
  const ROOM_INK = 0.03;
  const LINE_T_PT = 1.5; // the thickest a printed line may be (and at least 2 pixels)

  const words = (e) => String((e && e.message) || e || '').slice(0, 300);
  const fail = (code, detail) => Object.assign(new Error(code === 'load' ? 'the place reader could not start' : 'the place reader could not read the page'), { code, detail: words(detail) });
  const here = (f) => new URL(DIR + f, document.baseURI).href;

  /* ---------- the worker ---------- */
  let worker = null;
  let ready = null;
  let seq = 0;
  const waiting = new Map();

  function end() {
    const w = worker;
    worker = null;
    ready = null;
    waiting.forEach((q) => q.no(fail('run', 'stopped')));
    waiting.clear();
    if (w) {
      try {
        w.postMessage({ type: 'stop' });
      } catch (e) {
        /* already ended */
      }
      setTimeout(() => w.terminate(), 1000);
    }
  }

  function start() {
    if (ready) return ready;
    ready = new Promise((ok, no) => {
      let w;
      const clock = setTimeout(() => no(fail('load', 'no answer within ' + LOAD_MS / 1000 + ' s')), LOAD_MS);
      try {
        w = new Worker(here('places-worker.js'), { type: 'module' });
      } catch (e) {
        clearTimeout(clock);
        return no(fail('load', e));
      }
      worker = w;
      w.addEventListener('error', (e) => {
        e.preventDefault();
        clearTimeout(clock);
        no(fail('load', e.message || 'the worker could not be started'));
      });
      w.addEventListener('message', (ev) => {
        const m = ev.data || {};
        if (m.type === 'ready') return clearTimeout(clock), ok();
        if (m.type === 'error' && m.id === undefined) return clearTimeout(clock), no(fail('load', m.code + ': ' + m.detail));
        const q = waiting.get(m.id);
        if (!q) return;
        waiting.delete(m.id);
        if (m.type === 'maps') q.ok(m);
        else q.no(fail('run', m.code + ': ' + m.detail));
      });
      w.postMessage({ type: 'start', modelScript: here('places-model.js') });
    }).catch((e) => {
      end();
      throw e;
    });
    return ready;
  }

  function stop() {
    end();
  }

  async function run(pixels, w, h) {
    await start();
    const id = ++seq;
    return new Promise((ok, no) => {
      const clock = setTimeout(() => {
        waiting.delete(id);
        no(fail('run', 'no answer within ' + RUN_MS / 1000 + ' s'));
        end(); // a worker that hangs is ended; the next page starts it afresh
      }, RUN_MS);
      waiting.set(id, { ok: (m) => (clearTimeout(clock), ok(m)), no: (e) => (clearTimeout(clock), no(e)) });
      worker.postMessage({ type: 'run', pixels, w, h, id }, [pixels.buffer]);
    });
  }

  /* ---------- the page as the model reads it ---------- */

  /** Source pixels and their shares for each target pixel of one axis: target k covers points [k, k+1) / PX_PER_PT. */
  function spans(n, from, per, size) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = from + per * k;
      const b = a + per;
      const parts = [];
      for (let i = Math.floor(a); i < Math.ceil(b); i++) {
        const wgt = Math.min(b, i + 1) - Math.max(a, i);
        if (wgt > 0) parts.push(i >= 0 && i < size ? i : -1, wgt);
      }
      out.push({ parts, all: b - a });
    }
    return out;
  }

  /**
   * The drawn page resampled to 96 to the inch, grey 0 (print) to 1 (paper), each target pixel the mean of the canvas
   * pixels it covers (beyond the canvas: paper), padded with paper to a multiple of MULT. Returns { pixels, w, h, pw96, ph96 }.
   */
  function resample(grey, gw, gh, view) {
    const W = Math.max(1, Math.round(view.pw * PX_PER_PT));
    const H = Math.max(1, Math.round(view.ph * PX_PER_PT));
    const w = Math.ceil(W / MULT) * MULT;
    const h = Math.ceil(H / MULT) * MULT;
    const xs = spans(W, view.ox, view.scale / PX_PER_PT, gw);
    const ys = spans(H, view.oy, view.sy / PX_PER_PT, gh);
    // across first, row by row of the canvas
    const across = new Float32Array(W * gh);
    for (let y = 0; y < gh; y++) {
      const row = y * gw;
      for (let k = 0; k < W; k++) {
        const s = xs[k];
        let sum = 0;
        for (let j = 0; j < s.parts.length; j += 2) sum += s.parts[j + 1] * (s.parts[j] < 0 ? 255 : grey[row + s.parts[j]]);
        across[y * W + k] = sum / s.all;
      }
    }
    const pixels = new Float32Array(w * h).fill(1);
    for (let k = 0; k < H; k++) {
      const s = ys[k];
      for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let j = 0; j < s.parts.length; j += 2) sum += s.parts[j + 1] * (s.parts[j] < 0 ? 255 : across[s.parts[j] * W + x]);
        pixels[k * w + x] = sum / s.all / 255;
      }
    }
    return { pixels, w, h, pw96: W, ph96: H };
  }

  /**
   * Heat maps to places: each class's map thresholded at THRESH, 4-connected components at quarter scale, row by row.
   * maps: Float32Array of (1 + CLASSES.length) maps of mh * mw, class after class. Returns [{ cls, x0, y0, x1, y1, p }]
   * in points (cells times Q, divided by PX_PER_PT), clamped to the page (pw, ph points), sorted by top, then left.
   * A component with a value that is not a finite number is dropped.
   */
  function decode(maps, mw, mh, pw, ph, thresh) {
    const th = thresh || THRESH;
    const out = [];
    const n = mw * mh;
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    CLASSES.forEach((cls, ci) => {
      const t = th[cls];
      if (!(t > 0 && t <= 1)) return;
      const base = (ci + 1) * n;
      seen.fill(0);
      for (let s = 0; s < n; s++) {
        if (seen[s] || !(maps[base + s] >= t)) continue;
        let top = 0;
        stack[top++] = s;
        seen[s] = 1;
        let c0 = s % mw;
        let c1 = c0;
        let r0 = (s - c0) / mw;
        let r1 = r0;
        let cnt = 0;
        let sum = 0;
        while (top) {
          const i = stack[--top];
          const x = i % mw;
          const y = (i - x) / mw;
          cnt++;
          sum += maps[base + i];
          if (x < c0) c0 = x;
          if (x > c1) c1 = x;
          if (y < r0) r0 = y;
          if (y > r1) r1 = y;
          if (y > 0 && !seen[i - mw] && maps[base + i - mw] >= t) (seen[i - mw] = 1), (stack[top++] = i - mw);
          if (y < mh - 1 && !seen[i + mw] && maps[base + i + mw] >= t) (seen[i + mw] = 1), (stack[top++] = i + mw);
          if (x > 0 && !seen[i - 1] && maps[base + i - 1] >= t) (seen[i - 1] = 1), (stack[top++] = i - 1);
          if (x < mw - 1 && !seen[i + 1] && maps[base + i + 1] >= t) (seen[i + 1] = 1), (stack[top++] = i + 1);
        }
        if (cnt < MIN_CELLS[cls]) continue;
        const p = sum / cnt;
        const k = Q / PX_PER_PT;
        const b = { cls, x0: Math.max(0, c0 * k), y0: Math.max(0, r0 * k), x1: Math.min(pw, (c1 + 1) * k), y1: Math.min(ph, (r1 + 1) * k), p };
        if (![b.x0, b.y0, b.x1, b.y1, p].every(Number.isFinite) || b.x1 <= b.x0 || b.y1 <= b.y0) continue;
        out.push(b);
      }
    });
    out.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0 || CLASSES.indexOf(a.cls) - CLASSES.indexOf(b.cls));
    return out;
  }

  /* ---------- snapping to what is printed ---------- */

  /**
   * The picture a place is snapped on: grey (one byte a pixel), w, h, dark (a pixel darker than this is print),
   * range (paper to print), s (pixels per point).
   */
  function sheet(grey, w, h, paper, range, s) {
    return { grey, w, h, dark: paper - 0.5 * range, range, s };
  }

  /** The share of the pixels of row y from x0 to x1 (or of column x from y0 to y1) that are print. */
  function rowInk(P, y, x0, x1) {
    if (y < 0 || y >= P.h) return 0;
    let c = 0;
    let n = 0;
    for (let x = Math.max(0, x0); x <= Math.min(P.w - 1, x1); x++, n++) if (P.grey[y * P.w + x] < P.dark) c++;
    return n ? c / n : 0;
  }
  function colInk(P, x, y0, y1) {
    if (x < 0 || x >= P.w) return 0;
    let c = 0;
    let n = 0;
    for (let y = Math.max(0, y0); y <= Math.min(P.h - 1, y1); y++, n++) if (P.grey[y * P.w + x] < P.dark) c++;
    return n ? c / n : 0;
  }
  /** Mean grey of a rectangle (inclusive pixels), paper beyond the picture. */
  function mean(P, x0, y0, x1, y1) {
    let sum = 0;
    let n = 0;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++, n++) sum += y < 0 || y >= P.h || x < 0 || x >= P.w ? 255 : P.grey[y * P.w + x];
    return n ? sum / n : 255;
  }

  /** The mean grey of line v (a row, or a column) along a0..a1. */
  function lineMean(P, horizontal, v, a0, a1) {
    return horizontal ? mean(P, a0, v, a1, v) : mean(P, v, a0, v, a1);
  }
  /**
   * Line v of a side is an edge (EDGE of it print), or the first line inside a tint step: it and the next line inward
   * are lighter than both lines outside by TINT of the range, and the ground outside is not print. Else ''.
   */
  function edgeOf(P, horizontal, v, a0, a1, inward) {
    if ((horizontal ? rowInk(P, v, a0, a1) : colInk(P, v, a0, a1)) >= EDGE) return 'edge';
    const inside = Math.min(lineMean(P, horizontal, v, a0, a1), lineMean(P, horizontal, v + inward, a0, a1));
    const outside = Math.max(lineMean(P, horizontal, v - inward, a0, a1), lineMean(P, horizontal, v - 2 * inward, a0, a1));
    return outside > P.dark && inside - outside >= TINT * P.range ? 'tint' : '';
  }

  /**
   * One side of a box: the line of pixels (a row for top and bottom, a column for left and right) between from and to,
   * nearest to at, that is an edge, or failing any edge a tint step, along a0..a1; an edge is followed outward over
   * the lines of print next to it (the outer edge of a frame). inward: +1 when the inside lies at larger values.
   * Returns { at, how } or null.
   */
  function side(P, horizontal, at, from, to, a0, a1, inward) {
    let edge = null;
    let tint = null;
    const last = Math.min((horizontal ? P.h : P.w) - 1, to);
    for (let v = Math.max(0, from); v <= last; v++) {
      const how = edgeOf(P, horizontal, v, a0, a1, inward);
      if (how === 'edge' && (!edge || Math.abs(v - at) < Math.abs(edge.at - at))) edge = { at: v, how };
      if (how === 'tint' && (!tint || Math.abs(v - at) < Math.abs(tint.at - at))) tint = { at: v, how };
    }
    if (edge) {
      const end = horizontal ? P.h : P.w;
      while (edge.at - inward >= 0 && edge.at - inward < end && edgeOf(P, horizontal, edge.at - inward, a0, a1, inward) === 'edge') edge.at -= inward;
    }
    return edge || tint;
  }

  /**
   * A box place (tick, letterbox) snapped: each side to the nearest edge or tint step within SNAP_PT of the model's
   * side, measured along the middle half of the box; then each side checked along the whole of the snapped box, its
   * inside checked empty and its size checked for its class. b: { x0, y0, x1, y1 } canvas pixels. Returns the snapped
   * box in canvas pixels ({ x0, y0, x1, y1 } the outer edge of the frame, x1 and y1 one past it; ink) or null.
   */
  function snapBox(P, b, cls) {
    const d = Math.max(2, Math.round(SNAP_PT * P.s));
    const cx = Math.round((b.x0 + b.x1) / 2);
    const cy = Math.round((b.y0 + b.y1) / 2);
    const mid = (a0, a1) => [Math.round(a0 + 0.25 * (a1 - a0)), Math.round(a1 - 0.25 * (a1 - a0))];
    let [ma0, ma1] = mid(b.x0, b.x1);
    const top = side(P, true, Math.round(b.y0), Math.round(b.y0) - d, Math.min(cy - 1, Math.round(b.y0) + d), ma0, ma1, 1);
    const bot = side(P, true, Math.round(b.y1) - 1, Math.max(cy + 1, Math.round(b.y1) - 1 - d), Math.round(b.y1) - 1 + d, ma0, ma1, -1);
    if (!top || !bot || bot.at - top.at < 3) return null;
    let [mb0, mb1] = mid(top.at, bot.at);
    const left = side(P, false, Math.round(b.x0), Math.round(b.x0) - d, Math.min(cx - 1, Math.round(b.x0) + d), mb0, mb1, 1);
    const right = side(P, false, Math.round(b.x1) - 1, Math.max(cx + 1, Math.round(b.x1) - 1 - d), Math.round(b.x1) - 1 + d, mb0, mb1, -1);
    if (!left || !right || right.at - left.at < 3) return null;
    // the whole of each side, between the other two
    const r = { x0: left.at, y0: top.at, x1: right.at + 1, y1: bot.at + 1 };
    const whole = (sd, horizontal, at, a0, a1, inward) => edgeOf(P, horizontal, at, a0, a1, inward) === sd.how;
    if (!whole(top, true, r.y0, r.x0 + 1, r.x1 - 2, 1) || !whole(bot, true, r.y1 - 1, r.x0 + 1, r.x1 - 2, -1)) return null;
    if (!whole(left, false, r.x0, r.y0 + 1, r.y1 - 2, 1) || !whole(right, false, r.x1 - 1, r.y0 + 1, r.y1 - 2, -1)) return null;
    // size for its class, in points
    const wPt = (r.x1 - r.x0) / P.s;
    const hPt = (r.y1 - r.y0) / P.s;
    if (cls === 'tick' && (wPt < TICK_PT[0] || hPt < TICK_PT[0] || wPt > TICK_PT[1] || hPt > TICK_PT[1])) return null;
    if (cls === 'letterbox' && (hPt < TICK_PT[0] || hPt > 30 || wPt < 3 * hPt)) return null;
    // an empty inside: in from the frame by 1.5 points (at least 2 pixels); a row of letter boxes leaves its walls out
    const m = Math.max(2, Math.round(1.5 * P.s));
    const ix0 = r.x0 + m;
    const iy0 = r.y0 + m;
    const ix1 = r.x1 - 1 - m;
    const iy1 = r.y1 - 1 - m;
    if (ix1 < ix0 || iy1 < iy0) return null;
    let ink = 0;
    let n = 0;
    for (let x = ix0; x <= ix1; x++) {
      if (cls === 'letterbox' && colInk(P, x, iy0, iy1) >= 0.8) continue;
      for (let y = iy0; y <= iy1; y++, n++) if (P.grey[y * P.w + x] < P.dark) ink++;
    }
    const share = n ? ink / n : 1;
    if (share > (cls === 'tick' ? TICK_INK : BOX_INK)) return null;
    return Object.assign(r, { ink: share });
  }

  /**
   * A writing or signature place snapped to the printed line it stands on: the row within SNAP_PT of the place's foot
   * with the longest run of print (gaps of a pixel bridged) inside the place widened by SNAP_PT, at least LINE_MIN_PT
   * and half the place long; the whole line, followed past the place, ends within SNAP_PT of the place's two ends; at
   * most LINE_T_PT thick; paper just over and under it; paper over it for ROOM_PT (at most ROOM_INK print). b: canvas
   * pixels. Returns { x0, y0, x1, y1, t, line: true } in canvas pixels (y0..y1 the stroke) or null.
   */
  function snapRule(P, b) {
    const d = Math.max(2, Math.round(SNAP_PT * P.s));
    const foot = Math.round(b.y1);
    const a0 = Math.max(0, Math.round(b.x0) - d);
    const a1 = Math.min(P.w - 1, Math.round(b.x1) + d);
    const need = Math.max(LINE_MIN_PT * P.s, 0.5 * (b.x1 - b.x0));
    let best = null;
    for (let y = Math.max(0, foot - d); y <= Math.min(P.h - 1, foot + d); y++) {
      let run0 = -1;
      let gap = 0;
      let bestRun = null;
      for (let x = a0; x <= a1 + 2; x++) {
        const on = x <= a1 && P.grey[y * P.w + x] < P.dark;
        if (on) {
          if (run0 < 0) run0 = x;
          gap = 0;
        } else if (run0 >= 0 && ++gap > 1) {
          const e = x - gap; // the last pixel of print
          if (!bestRun || e - run0 > bestRun[1] - bestRun[0]) bestRun = [run0, e];
          run0 = -1;
          gap = 0;
        }
      }
      if (!bestRun || bestRun[1] - bestRun[0] + 1 < need) continue;
      const len = bestRun[1] - bestRun[0];
      if (!best || len > best.len || (len === best.len && Math.abs(y - foot) < Math.abs(best.y - foot))) best = { y, x0: bestRun[0], x1: bestRun[1], len };
    }
    if (!best) return null;
    // the whole of the printed line, followed past the place on both sides (gaps of a pixel bridged): its two ends
    // must be the place's ends, each within SNAP_PT (a separator across the page is no writing place)
    const at = (x) => x >= 0 && x < P.w && P.grey[best.y * P.w + x] < P.dark;
    while (at(best.x0 - 1) || at(best.x0 - 2)) best.x0 -= at(best.x0 - 1) ? 1 : 2;
    while (at(best.x1 + 1) || at(best.x1 + 2)) best.x1 += at(best.x1 + 1) ? 1 : 2;
    if (Math.abs(best.x0 - b.x0) > d || Math.abs(best.x1 + 1 - b.x1) > d) return null;
    // its thickness: the rows next to it printed along nine tenths of the run
    let y0 = best.y;
    let y1 = best.y;
    while (y0 > 0 && rowInk(P, y0 - 1, best.x0, best.x1) >= 0.9) y0--;
    while (y1 < P.h - 1 && rowInk(P, y1 + 1, best.x0, best.x1) >= 0.9) y1++;
    const t = y1 - y0 + 1;
    if (t > Math.max(2, Math.floor(LINE_T_PT * P.s))) return null;
    // paper on both sides of it, two pixels off, along nine tenths of it (a row of letters run together has not)
    if (rowInk(P, y0 - 2, best.x0, best.x1) > PAPER_INK || rowInk(P, y1 + 2, best.x0, best.x1) > PAPER_INK) return null;
    // room to write over it, along its middle four fifths
    const trim = Math.round(0.1 * (best.x1 - best.x0));
    const room = Math.round(ROOM_PT * P.s);
    let ink = 0;
    let n = 0;
    for (let y = Math.max(0, y0 - room); y <= y0 - 2; y++)
      for (let x = best.x0 + trim; x <= best.x1 - trim; x++, n++) if (P.grey[y * P.w + x] < P.dark) ink++;
    if (!n || ink / n > ROOM_INK) return null;
    return { x0: best.x0, y0, x1: best.x1 + 1, y1: y1 + 1, t, line: true };
  }

  /** Places in points snapped on the picture P (canvas pixels through view); unsnapped places are left out. */
  function snapAll(places, P, view) {
    const px = (b) => ({ x0: b.x0 * view.scale + view.ox, y0: b.y0 * view.sy + view.oy, x1: b.x1 * view.scale + view.ox, y1: b.y1 * view.sy + view.oy });
    const pt = (r) => ({ x0: (r.x0 - view.ox) / view.scale, y0: (r.y0 - view.oy) / view.sy, x1: (r.x1 - view.ox) / view.scale, y1: (r.y1 - view.oy) / view.sy });
    const out = [];
    places.forEach((q) => {
      const b = px(q);
      let r = null;
      if (q.cls === 'illustration') r = { x0: Math.round(b.x0), y0: Math.round(b.y0), x1: Math.round(b.x1), y1: Math.round(b.y1) };
      else if (q.cls === 'tick' || q.cls === 'letterbox') r = snapBox(P, b, q.cls);
      else r = snapRule(P, b);
      if (!r) return;
      const p = pt(r);
      // a line's place is the writing room over it, as a printed line's place is everywhere in the reader
      if (r.line) p.y0 = p.y1 - r.t / view.sy - 14;
      out.push(Object.assign(p, { cls: q.cls, p: q.p, src: 'model', px: r }));
    });
    out.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0 || CLASSES.indexOf(a.cls) - CLASSES.indexOf(b.cls));
    return out;
  }

  /** The places of one drawn page (see the head of this file). */
  async function find(canvas, view) {
    const gw = canvas.width;
    const gh = canvas.height;
    let grey = view.grey;
    if (!grey) {
      const rgba = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, gw, gh).data;
      grey = new Uint8Array(gw * gh);
      for (let i = 0, j = 0; i < gw * gh; i++, j += 4) grey[i] = Math.round((rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000);
    }
    const input = resample(grey, gw, gh, view);
    if (input.w > MAX_SIDE || input.h > MAX_SIDE) return [];
    const m = await run(input.pixels, input.w, input.h);
    if (!m || !(m.data instanceof Float32Array) || m.classes !== CLASSES.length + 1 || m.data.length !== m.classes * m.w * m.h) throw fail('run', 'maps of an unexpected shape');
    const places = decode(m.data, m.w, m.h, view.pw, view.ph);
    let paper = view.paper;
    let range = view.range;
    if (!(paper > 0 && range > 0)) {
      const hist = new Uint32Array(256);
      for (let i = 0; i < grey.length; i++) hist[grey[i]]++;
      paper = 128;
      for (let v = 129; v < 256; v++) if (hist[v] > hist[paper]) paper = v;
      let seen = 0;
      let print = 0;
      for (let v = 0; v < 256; v++) if ((seen += hist[v]) > 0.005 * grey.length) (print = v), (v = 256);
      range = Math.max(paper - print, 40);
    }
    return snapAll(places, sheet(grey, gw, gh, paper, range, view.scale), view);
  }

  NS.placemodel = { start, find, stop, resample, decode, snapBox, snapRule, snapAll, sheet, CLASSES, THRESH };
})(window.CVPortal);
