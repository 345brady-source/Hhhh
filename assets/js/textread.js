/*
 * Reading a page that has no text: a page whose letters are drawings, or a picture of a page (a scan).
 *
 * Only the words a decision waits for are read, in this order:
 *   1. the page is drawn (a picture at its own pixels, one to one);
 *   2. its boxes and free rules are found: on a picture from its pixels alone (NS.picturepage.find), on a page of
 *      drawings from the drawn rectangles and level strokes;
 *   3. a page on which nothing is found (no box that is a place, no free rule) is done: no strip, no engine;
 *   4. the caption strips round every place and free rule and the heading zones are cut (NS.picturepage.bands);
 *   5. each strip is enlarged four times, its contrast stretched, and read by NS.textengine (assets/js/textengine.js,
 *      loaded by a script element on first need; it starts from the portal's own files and makes no request);
 *   6. the words are attached to the box, rule or heading their strip was cut for.
 * Nothing here places a field: the printed places still come only from what is printed (NS.anchors.page) and the
 * fields from NS.placement. A box exists by its pixels: no word read adds one or removes one.
 *
 *   NS.textread.page(pdfPage, raw, opts)   raw: NS.anchors.walk of the page. opts (for checks and callers):
 *                                            words   false: no strip is read and the engine is not started
 *                                            reader  the reader state to give when words is false ('off' when not given)
 *                                            ink     the finder's ink level
 *                                            trace   also return the finder's levels, the strips, and the seconds
 *                                                    spent drawing, finding and reading
 *                                          Resolves to a raw page of the same form as NS.anchors.walk gives, plus:
 *                                            pictured  'picture' or 'drawings'
 *                                            approx    true for a picture: positions come from its pixels
 *                                            words     the read words, in points, each with conf (0 to 100)
 *                                            found     every box: { x0, y0, x1, y1, outer (the outer edge of its
 *                                                      ink, NS.picturepage.find), small, ink, shared, place, why,
 *                                                      col, inside (its words as plain text), bands { over, under,
 *                                                      before, after, inside: each { s, conf } } }
 *                                            lines     every free rule: { x0, x1, y, t, bands { over, under, before, after } }
 *                                            heads     [{ kind 'column' | 'letter' | 'margin', col, x0, y0, x1, y1, s, conf }]
 *                                            reader    'ok' read; 'load' the engine could not start; 'time' the words of
 *                                                      the page ran out of time; 'fail' a strip could not be read; 'off'
 *                                                      or what opts.reader says when words is false
 *                                          A band that was not read has the text '' and the confidence 0. Rejects only
 *                                          when the page cannot be drawn or searched: an Error with code 'time' or 'fail'.
 *   NS.textread.stop()                     ends the engine and forgets that it could not start
 */
(function (NS) {
  'use strict';
  const MAX_PIXELS = 9.5e6;
  const DRAW_MS = 20000; // drawing and searching one page
  const ENLARGE = 4; // a strip is read enlarged this many times ...
  const STRIP_PIXELS = 4e6; // ... or 3 or 2 times when it would be larger than this
  const WORDS_MS = 20000; // all the strips of one page share this
  const STRIP_MS = 8000; // one strip
  const WHITE = 235; // a grey this light or lighter is paper when the contrast is stretched
  const SIDES = ['over', 'under', 'before', 'after', 'inside'];
  const RULE_SIDES = ['over', 'under', 'before', 'after'];
  const fail = (code, e) => Object.assign(new Error((e && e.message) || String(e || code)), { code });
  const timed = (p, ms, code) =>
    new Promise((ok, no) => {
      const t = setTimeout(() => no(fail(code, 'took too long')), ms);
      p.then(
        (v) => (clearTimeout(t), ok(v)),
        (e) => (clearTimeout(t), no(e))
      );
    });
  const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

  /** A script file loaded once by a script element; ready() says whether what it brings is already there. */
  function script(src, ready) {
    return new Promise((ok, no) => {
      if (ready()) return ok();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => (ready() ? ok() : no(new Error('did not start: ' + src)));
      s.onerror = () => (s.remove(), no(new Error('could not be loaded: ' + src)));
      document.head.appendChild(s);
    });
  }
  // A start that failed is remembered, so the next pages of the same reading do not try again; stop() forgets it.
  let refused = null;
  /** NS.textengine, loaded on first need and started; rejects with code 'load'. */
  async function engine() {
    if (refused) throw refused;
    try {
      await script(new URL('assets/js/textengine.js', document.baseURI).href, () => !!NS.textengine);
      await NS.textengine.start();
      return NS.textengine;
    } catch (e) {
      refused = Object.assign(fail('load', e), { why: (e && e.why) || 'file' });
      throw refused;
    }
  }
  function stop() {
    refused = null;
    if (NS.textengine) NS.textengine.stop();
  }

  /**
   * The page drawn on a canvas: { canvas, ctx, scale, sy, ox, oy } with canvas pixel = point * (scale, sy) + (ox, oy). Where one
   * picture covers the page it is drawn at its own pixels, one to one (its strokes stay as crisp as they are in the
   * file); any other page at about 200 to the inch.
   */
  async function draw(pdfPage, raw) {
    const v1 = pdfPage.getViewport({ scale: 1 });
    const im = raw.image;
    // A little under the cap: the canvas is a pixel larger each way than the page drawn on it.
    const most = 0.99 * Math.sqrt(MAX_PIXELS / (v1.width * v1.height));
    const own = !!im && im.w / (im.x1 - im.x0) <= most && im.w / (im.x1 - im.x0) >= 1;
    // One to one: a pixel of the picture is a pixel of the canvas, across and down, and starts on a whole pixel.
    const scale = own ? im.w / (im.x1 - im.x0) : Math.min(200 / 72, most);
    const sy = own ? im.h / (im.y1 - im.y0) : scale;
    const ox = own ? Math.round(im.x0 * scale) - im.x0 * scale : 0;
    const oy = own ? Math.round(im.y0 * sy) - im.y0 * sy : 0;
    const vp = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width) + 1;
    canvas.height = Math.ceil(v1.height * sy) + 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, sy / scale, ox, oy] }).promise;
    return { canvas, ctx, scale, sy, ox, oy };
  }

  /**
   * One strip of the drawing, cut out and enlarged with smoothing (ENLARGE times, fewer when it would exceed
   * STRIP_PIXELS), its contrast stretched: its darkest pixel black, WHITE and lighter white, straight in between.
   * r: { x0, y0, x1, y1 } in pixels of the drawing. Returns { canvas, k }.
   */
  function strip(pic, r) {
    const sw = Math.max(1, r.x1 - r.x0);
    const sh = Math.max(1, r.y1 - r.y0);
    let k = ENLARGE;
    while (k > 2 && sw * sh * k * k > STRIP_PIXELS) k--;
    if (sw * sh * k * k > STRIP_PIXELS) k = Math.max(1, Math.sqrt(STRIP_PIXELS / (sw * sh)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * k));
    canvas.height = Math.max(1, Math.round(sh * k));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pic.canvas, r.x0, r.y0, sw, sh, 0, 0, canvas.width, canvas.height);
    // the boxes and rules a strip of one row spans are paper to the reader
    const kx = canvas.width / sw;
    const ky = canvas.height / sh;
    ctx.fillStyle = '#fff';
    (r.paint || []).forEach((p) => ctx.fillRect(Math.floor((p.x0 - r.x0) * kx), Math.floor((p.y0 - r.y0) * ky), Math.ceil((p.x1 - p.x0) * kx) + 1, Math.ceil((p.y1 - p.y0) * ky) + 1));
    const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = im.data;
    let lo = 255;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      if (v < lo) lo = v;
    }
    const span = WHITE - lo;
    if (span > 0) {
      for (let i = 0; i < d.length; i += 4) {
        const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        const c = v >= WHITE ? 255 : Math.round(((v - lo) * 255) / span);
        d[i] = d[i + 1] = d[i + 2] = c;
        d[i + 3] = 255;
      }
      ctx.putImageData(im, 0, 0);
    }
    return { canvas, k: canvas.width / sw };
  }

  /**
   * The recognised words as characters in points: { glyphs, words, slope }. Every character of a line stands on the
   * line's baseline; conf is how sure the recognition was of its word (0 to 100). Underscores are left out: a blank
   * is read from its drawn line, never from a recognised character.
   */
  function characters(blocks, scale, ox, oy, sy) {
    const glyphs = [];
    const words = [];
    const slopes = [];
    (blocks || []).forEach((b) =>
      (b.paragraphs || []).forEach((p) =>
        (p.lines || []).forEach((l) => {
          const ws = (l.words || []).filter((w) => w && w.bbox && String(w.text || '').trim());
          if (!ws.length) return;
          const bl = l.baseline || { x0: l.bbox.x0, y0: l.bbox.y1, x1: l.bbox.x1, y1: l.bbox.y1 };
          if (bl.x1 - bl.x0 > 150 * scale) slopes.push(Math.abs((bl.y1 - bl.y0) / (bl.x1 - bl.x0)));
          const base = ((bl.y0 + bl.y1) / 2 - oy) / sy;
          // The size of the type: the height of the line's tallest word is about seven tenths of it when the line has
          // capitals or tall letters, and the whole of it when it has letters that hang below as well.
          const tall = Math.max.apply(null, ws.map((w) => w.bbox.y1 - w.bbox.y0)) / sy;
          const text = ws.map((w) => w.text).join('');
          const size = Math.max(4, Math.min(40, /[gjpqy,;()[\]]/.test(text) ? tall / 0.95 : tall / 0.72));
          let last = null;
          ws.forEach((w) => {
            const conf = Math.round(+w.confidence || 0);
            const letters = /[A-Za-z0-9]/.test(w.text);
            if (!letters && conf < 30) return; // specks
            const box = { s: w.text, x0: (w.bbox.x0 - ox) / scale, x1: (w.bbox.x1 - ox) / scale, y0: (w.bbox.y0 - oy) / sy, y1: (w.bbox.y1 - oy) / sy, conf, letters, base, size };
            words.push(box);
            // The characters of a word share its width evenly: the recognition is sure of a word's extent, not of each letter's.
            const cells = Array.from(w.text).map((u, i, all) => ({ u, x0: box.x0 + ((box.x1 - box.x0) * i) / all.length, x1: box.x0 + ((box.x1 - box.x0) * (i + 1)) / all.length }));
            cells.forEach((c, i) => {
              if (c.u === '_' || !c.u.trim()) return;
              if (i === 0 && last && c.x0 > last) glyphs.push({ u: ' ', sp: true, x0: last, x1: c.x0, y: base, h: size, font: '', hidden: false, conf, word: box });
              glyphs.push({ u: c.u, sp: false, x0: c.x0, x1: Math.max(c.x1, c.x0 + 0.5), y: base, h: size, font: '', hidden: false, conf, word: box });
            });
            last = box.x1;
          });
        })
      )
    );
    slopes.sort((a, b) => a - b);
    return { glyphs, words, slope: slopes.length ? slopes[Math.floor(slopes.length / 2)] : 0 };
  }

  /**
   * A run of strokes on one height whose ends touch is one stroke: a blank printed as underscores, once its letters are
   * drawn as shapes, is a row of short bars, as a run of underscore characters is one line on a page with text. Only
   * level strokes that are not the side of a frame are joined, when their heights and thicknesses agree within 0.3 pt
   * and the gap between them is at most 0.8 pt (the gap allowed between two underscore characters of one run).
   */
  function joinRuns(segs) {
    const out = segs.filter((s) => s.o !== 'h' || s.frame);
    const hs = segs.filter((s) => s.o === 'h' && !s.frame).sort((a, b) => a.c - b.c || a.a0 - b.a0);
    const open = [];
    hs.forEach((s) => {
      const t = s.t || 0;
      const m = open.find((q) => Math.abs(q.c - s.c) <= 0.3 && Math.abs((q.t || 0) - t) <= 0.3 && s.a0 - q.a1 <= 0.8 && s.a1 >= q.a0 - 0.8);
      if (m) {
        m.a0 = Math.min(m.a0, s.a0);
        m.a1 = Math.max(m.a1, s.a1);
      } else open.push(Object.assign({}, s));
    });
    return out.concat(open);
  }

  /**
   * A page whose letters are drawings: its lines and boxes are the drawn ones, exactly. A thin bar that lies in a
   * recognised word is a letter or a dash; a square drawn as a filled frame is a box; a drawing inside a box that was
   * not read as a word is kept as a mark, so the box does not count as empty.
   */
  function drawn(raw, read) {
    const out = { glyphs: read.glyphs.slice(), segs: [], rects: raw.rects.slice(), picture: false };
    const inWord = (x0, x1, y0, y1) => read.words.some((w) => w.letters && ov(w.x0 - 0.5, w.x1 + 0.5, x0, x1) > 0.5 * (x1 - x0) && ov(w.y0 - 0.5, w.y1 + 0.5, y0, y1) > 0.5 * (y1 - y0));
    raw.segs.forEach((s) => {
      const t = Math.max(s.t || 0, 0.2);
      if (s.frame || !(s.o === 'h' ? inWord(s.a0, s.a1, s.c - t / 2, s.c + t / 2) : inWord(s.c - t / 2, s.c + t / 2, s.a0, s.a1))) out.segs.push(s);
    });
    (raw.frames || []).forEach((b) => {
      out.rects.push(b);
      out.segs.push({ o: 'h', a0: b.x0, a1: b.x1, c: b.y0, t: b.t, frame: true }, { o: 'h', a0: b.x0, a1: b.x1, c: b.y1, t: b.t, frame: true }, { o: 'v', a0: b.y0, a1: b.y1, c: b.x0, t: b.t }, { o: 'v', a0: b.y0, a1: b.y1, c: b.x1, t: b.t });
    });
    out.rects.forEach((b) => {
      if (b.x1 - b.x0 > 20 || b.y1 - b.y0 > 20 || b.x1 - b.x0 < 5) return;
      const inside = (x, y) => x > b.x0 + 0.5 && x < b.x1 - 0.5 && y > b.y0 + 0.5 && y < b.y1 - 0.5;
      out.glyphs = out.glyphs.filter((g) => g.sp || !inside((g.x0 + g.x1) / 2, g.y - 0.3 * g.h));
      if ((raw.blobs || []).some((q) => inside((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2) && (q.x1 - q.x0 < 0.9 * (b.x1 - b.x0) || q.y1 - q.y0 < 0.9 * (b.y1 - b.y0)))) out.glyphs.push({ u: '•', sp: false, x0: (b.x0 + b.x1) / 2 - 1, x1: (b.x0 + b.x1) / 2 + 1, y: (b.y0 + b.y1) / 2 + 1, h: 4, font: '', hidden: false, conf: 0 });
    });
    return out;
  }

  /** The boxes and free rules of a page of drawings, in pixels of its drawing, in the form NS.picturepage.find gives. */
  function drawnShapes(raw, pic) {
    const px = (v) => v * pic.scale + pic.ox;
    const py = (v) => v * pic.sy + pic.oy;
    const boxes = raw.rects.concat(raw.frames || []).map((b) => {
      const bw = Math.abs(b.x1 - b.x0);
      const bh = Math.abs(b.y1 - b.y0);
      return { x0: Math.floor(px(Math.min(b.x0, b.x1))), y0: Math.floor(py(Math.min(b.y0, b.y1))), x1: Math.ceil(px(Math.max(b.x0, b.x1))) + 1, y1: Math.ceil(py(Math.max(b.y0, b.y1))) + 1, small: bw <= 14 && bh <= 14, ink: 0, shared: false, place: true, why: '' };
    });
    const rules = raw.segs.filter((s) => s.o === 'h' && !s.frame).map((s) => {
      const t = Math.max(s.t || 0, 0.2);
      return { x0: Math.floor(px(s.a0)), y0: Math.floor(py(s.c - t / 2)), x1: Math.ceil(px(s.a1)) + 1, y1: Math.ceil(py(s.c + t / 2)) + 1, t: Math.max(1, Math.round(t * pic.sy)) };
    });
    const order = (a, b) => a.y0 - b.y0 || a.x0 - b.x0 || a.x1 - b.x1 || a.y1 - b.y1;
    return { boxes: boxes.sort(order), rules: rules.sort(order) };
  }

  /**
   * A short free rule set in brackets ("[____]"), read from the picture: at each end an upright stroke as high as a line
   * of print stands on the rule's row (from 5 to 15 pt above it, ending within 2 pt under it), within 4 pt outside the
   * end. Brackets are print the engine seldom reads alone; the line rules ask whether a line stands in brackets.
   */
  function inBrackets(grey, w, h, r, s, dark) {
    if ((r.x1 - r.x0) / s > 72) return false;
    const row = Math.max(0, Math.round(r.y0 - s));
    const end = (xa, xb) => {
      for (let x = Math.max(0, xa); x < Math.min(w, xb); x++) {
        if (grey[row * w + x] > dark) continue;
        let top = row;
        while (top > 0 && grey[(top - 1) * w + x] <= dark) top--;
        let foot = row;
        while (foot < h - 1 && grey[(foot + 1) * w + x] <= dark) foot++;
        const up = (r.y0 - top) / s;
        if (up >= 5 && up <= 15 && (foot - r.y1) / s <= 2) return true;
      }
      return false;
    };
    return end(Math.round(r.x0 - 4 * s), Math.round(r.x0 + s)) && end(Math.round(r.x1 - s), Math.round(r.x1 + 4 * s));
  }

  /**
   * The top edge of a frame or of a row of cells, read from the picture: an upright stroke hangs from the rule (it goes
   * down from the rule at least 10 pt and rises above it at most 2 pt), at either end of the rule or anywhere along it.
   * A rule drawn faintly in part is first followed along its row past the piece that was found (over gaps of up to
   * 2 pt) to where it really ends. A line to write on has nothing hanging from it; the bottom edge of a cell has the
   * cell's sides standing on it, and a row border between two rows of cells has them crossing it. Returns the hanging
   * stroke's x (pixels) or -1.
   */
  function hangs(grey, w, h, r, s, dark, pale) {
    const top = Math.max(0, r.y0 - 1);
    const foot = Math.min(h - 1, r.y1);
    const on = (x, lim) => {
      for (let y = top; y <= foot; y++) if (grey[y * w + x] <= lim) return true;
      return false;
    };
    // (the rule followed along its row, a faint stretch and a gap of up to 2 pt included)
    const gap = Math.max(2, Math.round(2 * s));
    let x0 = r.x0;
    for (let x = r.x0 - 1, miss = 0; x >= 0 && miss <= gap; x--) (on(x, pale) ? ((x0 = x), (miss = 0)) : miss++);
    let x1 = r.x1 - 1;
    for (let x = r.x1, miss = 0; x < w && miss <= gap; x++) (on(x, pale) ? ((x1 = x), (miss = 0)) : miss++);
    const dk = (x, y) => grey[y * w + x] <= dark || (x > 0 && grey[y * w + x - 1] <= dark) || (x < w - 1 && grey[y * w + x + 1] <= dark);
    // a run of dark rows from y in the direction d (one pale row inside it is allowed), in pixels
    const run = (x, y, d) => {
      let n = 0;
      let miss = 0;
      for (let yy = y; yy >= 0 && yy < h && miss <= 1; yy += d) {
        if (dk(x, yy)) {
          n += 1 + miss;
          miss = 0;
        } else miss++;
      }
      return n;
    };
    const down = 10 * s;
    const up = 2 * s;
    const reach = Math.round(3 * s);
    for (let x = Math.max(0, x0 - reach); x <= Math.min(w - 1, x1 + reach); x++) {
      if (!on(x, dark)) continue;
      if (run(x, foot + 1, 1) >= down && run(x, top - 1, -1) <= up) return x;
    }
    return -1;
  }

  /**
   * The print under a rule, read from the picture: the first line of print beneath it (from 2 to 12 pt under it) that
   * begins within 8 pt of the rule's left end, followed to the right while its gaps are no wider than 12 pt (a column
   * counts as print where at least two of its pixels are dark, so specks of a scan do not join two columns of print).
   * Returns the right end of that run in pixels, or -1 when no print begins there.
   */
  function printUnder(grey, w, h, r, s, dark) {
    const y0 = Math.min(h - 1, r.y1 + Math.round(2 * s));
    const y1 = Math.min(h - 1, r.y1 + Math.round(12 * s));
    const inked = (x) => {
      let n = 0;
      for (let y = y0; y <= y1; y++) if (grey[y * w + x] <= dark && ++n >= 2) return true;
      return false;
    };
    let x = Math.max(0, r.x0 - Math.round(8 * s));
    const first = Math.min(w - 1, r.x0 + Math.round(8 * s));
    while (x <= first && !inked(x)) x++;
    if (x > first) return -1;
    const gap = Math.round(12 * s);
    let end = x;
    for (let miss = 0; x < w && miss <= gap; x++) (inked(x) ? ((end = x), (miss = 0)) : miss++);
    return end;
  }

  /**
   * A box that is a row of a table, read from the picture: an upright stroke stands on the middle of its top edge (it
   * rises at least 10 pt from the edge, more than 6 pt in from either corner, and goes on into the box at most 2 pt):
   * the wall between two cells of the row above. A lone panel or an entry box has nothing standing on its top edge
   * away from its corners. Returns the stroke's x (pixels) or -1.
   */
  function standsOn(grey, w, h, b, s, dark) {
    const top = Math.max(0, b.y0 - 1);
    const foot = Math.min(h - 1, b.y0 + Math.max(1, Math.round(1.5 * s)));
    const dk = (x, y) => grey[y * w + x] <= dark || (x > 0 && grey[y * w + x - 1] <= dark) || (x < w - 1 && grey[y * w + x + 1] <= dark);
    const run = (x, y, d) => {
      let n = 0;
      let miss = 0;
      for (let yy = y; yy >= 0 && yy < h && miss <= 1; yy += d) {
        if (dk(x, yy)) {
          n += 1 + miss;
          miss = 0;
        } else miss++;
      }
      return n;
    };
    const inset = Math.round(6 * s);
    for (let x = b.x0 + inset; x <= b.x1 - 1 - inset; x++) {
      let on = false;
      for (let y = top; y <= foot && !on; y++) on = grey[y * w + x] <= dark;
      if (on && run(x, top - 1, -1) >= 10 * s && run(x, foot + 1, 1) <= 2 * s) return x;
    }
    return -1;
  }

  /**
   * Writing joined to a rule, read from the picture: the strokes that touch the rule from above or from under it (dark
   * on the row next to the rule's own rows) and, followed through the dark pixels joined to them on that side, reach at
   * least 2.5 pt away from it while staying narrower than 60 % of the rule, more than 3 pt in from its ends, and not a
   * straight upright stroke (narrower than 1.5 pt and 8 pt long or more: a wall). Printed captions stand clear of their
   * rule; a hand that writes on a line or just under it touches it. Returns how many such strokes there are.
   */
  function joined(grey, w, h, r, s, dark) {
    const far = Math.round(15 * s);
    const xa = Math.max(0, r.x0 - Math.round(10 * s));
    const xb = Math.min(w - 1, r.x1 + Math.round(10 * s));
    const seen = new Set();
    let n = 0;
    // one side: d = 1 under the rule (from the second row under it), d = -1 above it
    const side = (row, d) => {
      if (row < 0 || row >= h) return;
      for (let x = Math.max(0, r.x0); x < Math.min(w, r.x1); x++) {
        const k0 = row * w + x;
        if (grey[k0] > dark || seen.has(k0)) continue;
        // the stroke's dark pixels joined to it on this side of the rule, within 15 pt of it
        const todo = [k0];
        seen.add(k0);
        let reach = 0;
        let lo = x;
        let hi = x;
        while (todo.length) {
          const k = todo.pop();
          const y = (k / w) | 0;
          const xx = k - y * w;
          reach = Math.max(reach, (y - row) * d);
          lo = Math.min(lo, xx);
          hi = Math.max(hi, xx);
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const yy = y + dy;
              const x2 = xx + dx;
              if ((yy - row) * d < 0 || (yy - row) * d > far || x2 < xa || x2 > xb) continue;
              const k2 = yy * w + x2;
              if (grey[k2] <= dark && !seen.has(k2)) {
                seen.add(k2);
                todo.push(k2);
              }
            }
        }
        // (a straight upright stroke is a wall or a side, not writing: textread's hangs and the cells read those)
        const wall = hi - lo < 1.5 * s && reach >= 8 * s;
        if (reach >= 2.5 * s && hi - lo < 0.6 * (r.x1 - r.x0) && !wall && x > r.x0 + 3 * s && x < r.x1 - 3 * s) n++;
      }
    };
    side(r.y1 + 1, 1);
    side(r.y0 - 2, -1);
    return n;
  }

  /** Words in reading order (by line, then left to right) as one text, with the confidence of the least sure. */
  function said(words) {
    if (!words.length) return { s: '', conf: 0 };
    const ws = words.slice().sort((a, b) => (Math.abs(a.base - b.base) > 0.5 * Math.min(a.size, b.size) ? a.base - b.base : a.x0 - b.x0));
    return { s: ws.map((q) => q.s).join(' '), conf: Math.min.apply(null, ws.map((q) => q.conf)) };
  }

  async function page(pdfPage, raw, opts) {
    const o = opts || {};
    const ms = { draw: 0, find: 0, read: 0 };
    let pic = null;
    try {
      let t = Date.now();
      pic = await timed(draw(pdfPage, raw), DRAW_MS, 'time');
      ms.draw = Date.now() - t;
      await new Promise((r) => setTimeout(r, 0));
      t = Date.now();
      const at = { x: (v) => (v - pic.ox) / pic.scale, y: (v) => (v - pic.oy) / pic.sy };
      const w = pic.canvas.width;
      const h = pic.canvas.height;
      let grey;
      let seen;
      try {
        grey = NS.picturepage.toGrey(pic.ctx.getImageData(0, 0, w, h).data, w, h);
        // On a page of drawings the strokes of one run are joined first (joinRuns): what is read is the joined page.
        if (!raw.picture) raw = Object.assign({}, raw, { segs: joinRuns(raw.segs) });
        seen = raw.picture ? NS.picturepage.find(grey, w, h, pic.scale, { ink: o.ink }) : Object.assign({}, drawnShapes(raw, pic));
      } catch (e) {
        throw fail('fail', e);
      }
      let where = null;
      const out = { glyphs: [], segs: [], rects: [], picture: false, pictured: raw.picture ? 'picture' : 'drawings', approx: !!raw.picture, words: [], found: [], lines: [], heads: [], reader: 'ok' };
      const trace = (strips) => {
        if (o.trace) out.trace = { paper: seen.paper, print: seen.print, range: seen.range, tau: seen.tau, ms, strips: strips || 0, margin: where ? where.margin : null, zones: where ? where.zones.map((z) => z.kind) : [] };
        return out;
      };
      // Nothing found: no strip, no engine, no field.
      if (!seen.boxes.some((b) => b.place !== false) && !seen.rules.length) {
        ms.find = Date.now() - t;
        if (!raw.picture) Object.assign(out, drawn(raw, { glyphs: [], words: [] }));
        return trace(0);
      }
      where = NS.picturepage.bands(Object.assign({ grey, w, h, pxPerPt: pic.scale }, seen));
      // (a page of drawings is drawn black on white: half way is the print's edge)
      const dark = raw.picture ? (seen.paper > 0 && seen.range > 0 ? seen.paper - 0.5 * seen.range : -1) : 128;
      if (dark >= 0) seen.rules.forEach((r) => (r.bracket = inBrackets(grey, w, h, r, pic.scale, dark)));
      // (on a picture: a rule something hangs from is the top edge of a frame or of cells; see hangs)
      if (raw.picture && dark >= 0) seen.rules.forEach((r) => (r.hang = hangs(grey, w, h, r, pic.scale, dark, seen.paper - 0.25 * seen.range) >= 0));
      if (raw.picture && dark >= 0) seen.rules.forEach((r) => (r.under = printUnder(grey, w, h, r, pic.scale, dark)));
      if (raw.picture && dark >= 0) seen.rules.forEach((r) => (r.joined = joined(grey, w, h, r, pic.scale, dark)));
      if (raw.picture && dark >= 0) seen.boxes.forEach((b) => b.place !== false && !b.small && (b.row = standsOn(grey, w, h, b, pic.scale, dark) >= 0));
      grey = null;
      ms.find = Date.now() - t;
      await new Promise((r) => setTimeout(r, 0));

      /* Read every strip and zone, in reading order, through the engine. */
      t = Date.now();
      const todo = where.strips.map((st) => ({ r: st, parts: st.parts })).concat(where.zones.map((z) => ({ r: z, zone: z })));
      todo.sort((a, b) => a.r.y0 - b.r.y0 || a.r.x0 - b.r.x0);
      const read = { glyphs: [], words: [] };
      const heard = new Map(); // part or zone -> its words
      const toPt = (r) => ({ x0: at.x(r.x0), y0: at.y(r.y0), x1: at.x(r.x1), y1: at.y(r.y1) });
      if (o.words === false) out.reader = o.reader || 'off';
      else if (todo.length) {
        let eng = null;
        try {
          eng = await engine();
        } catch (e) {
          out.reader = 'load';
        }
        const end = Date.now() + WORDS_MS;
        const got = new Array(todo.length);
        let next = 0;
        let over = !eng;
        // Two lanes: NS.textengine hands a strip asked for while another is being read to its second worker. The words
        // are attached afterwards in the order of the strips, so the page reads the same however the lanes ran.
        const lane = async () => {
          while (!over && next < todo.length) {
            if (end - Date.now() <= 0) {
              over = true;
              out.reader = 'time';
              break;
            }
            const i = next++;
            const job = todo[i];
            const cut = strip(pic, job.r);
            try {
              const blocks = await eng.read(cut.canvas, job.r.line ? 'line' : 'block', Math.min(STRIP_MS, Math.max(1, end - Date.now())));
              got[i] = characters(blocks, pic.scale * cut.k, (pic.ox - job.r.x0) * cut.k, (pic.oy - job.r.y0) * cut.k, pic.sy * cut.k);
            } catch (e) {
              if (!over) {
                out.reader = e && e.code === 'time' ? 'time' : e && e.code === 'load' ? 'load' : 'fail';
                if (out.reader === 'load') refused = Object.assign(fail('load', e), { why: e.why || 'file' });
              }
              over = true;
            } finally {
              cut.canvas.width = cut.canvas.height = 0;
            }
          }
        };
        await Promise.all([lane(), lane()]);
        // Print a zone shares with a strip is read twice: the page keeps the strip's reading of it (the zone's words
        // still name its heading).
        const stripsPt = where.strips.map(toPt);
        const twice = (cx, cy) => stripsPt.some((r) => cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1);
        todo.forEach((job, i) => {
          if (!got[i]) return;
          got[i].glyphs.forEach((g) => (!job.zone || !twice((g.x0 + g.x1) / 2, g.y - 0.3 * g.h)) && read.glyphs.push(g));
          got[i].words.forEach((q) => (!job.zone || !twice((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2)) && read.words.push(q));
          // Each word goes to the part of its strip whose rectangle holds its centre (or the nearest, within the
          // paper the strip was grown by); a word in no part of its strip belongs to another strip and is dropped.
          const owners = job.zone ? [{ key: job.zone, r: toPt(job.zone) }] : job.parts.map((q) => ({ key: q, r: toPt(q) }));
          got[i].words.forEach((q) => {
            const cx = (q.x0 + q.x1) / 2;
            const cy = (q.y0 + q.y1) / 2;
            let best = null;
            let dist = job.zone ? Infinity : 2.5; // points: the paper a strip is grown by, and a little
            owners.forEach((ow) => {
              const d = Math.max(ow.r.x0 - cx, 0, cx - ow.r.x1) + Math.max(ow.r.y0 - cy, 0, cy - ow.r.y1);
              if (d < dist) (dist = d), (best = ow);
            });
            if (!best) return;
            if (!heard.has(best.key)) heard.set(best.key, []);
            heard.get(best.key).push(q);
          });
        });
      }
      ms.read = Date.now() - t;

      /* A caption printed between two boxes, one over the other, is the nearer box's (NS.picturepage.attach): the print
         over a box is never the under caption of the box above it. */
      if (heard.size && NS.picturepage.attach) {
        const boxParts = [];
        where.strips.forEach((st) => st.parts.forEach((q) => q.kind === 'box' && (q.side === 'over' || q.side === 'under') && boxParts.push(Object.assign({ key: q, of: q.of, side: q.side }, toPt(q)))));
        const byKey = new Map(boxParts.map((q) => [q, heard.get(q.key)]).filter(([, ws]) => !!ws));
        NS.picturepage.attach(boxParts, byKey, seen.boxes.map(toPt));
        boxParts.forEach((q) => byKey.has(q) && heard.set(q.key, byKey.get(q)));
      }

      /* The page: every box and free rule with the words of its bands, and the headings. */
      const bandsOf = (kind, of, sides) => {
        const b = {};
        sides.forEach((sd) => {
          const part = where.strips.reduce((f, st) => f || st.parts.find((q) => q.kind === kind && q.of === of && q.side === sd), null);
          b[sd] = said(part ? heard.get(part) || [] : []);
        });
        return b;
      };
      const t0 = Math.max(0.3, 1 / pic.scale);
      out.words = read.words;
      seen.boxes.forEach((r, i) => {
        // found carries the outer edge of the printed frame. The rectangle and its four strokes are written the way a
        // drawn rectangle is given: along the middle of the frame's strokes, half a pixel inside that edge.
        const b = toPt(r);
        const m = { x0: at.x(r.x0 + 0.5), y0: at.y(r.y0 + 0.5), x1: at.x(r.x1 - 0.5), y1: at.y(r.y1 - 0.5), t: t0 };
        const inside = read.words.filter((q) => q.letters && (q.x0 + q.x1) / 2 > b.x0 && (q.x0 + q.x1) / 2 < b.x1 && (q.y0 + q.y1) / 2 > b.y0 && (q.y0 + q.y1) / 2 < b.y1);
        out.found.push(Object.assign({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, outer: toPt(r.outer || r), small: r.small, ink: r.ink, shared: r.shared, place: r.place, why: r.why, col: r.col, inside: inside.map((q) => q.s).join(' '), bands: bandsOf('box', i, SIDES) }, r.row ? { row: true } : null));
        // A box full of print (a letter or a mark the finder took for a frame) is print to the line rules, not a frame.
        if (r.why === 'filled') return;
        out.rects.push(m);
        out.segs.push({ o: 'h', a0: m.x0, a1: m.x1, c: m.y0, t: t0, frame: true }, { o: 'h', a0: m.x0, a1: m.x1, c: m.y1, t: t0, frame: true }, { o: 'v', a0: m.y0, a1: m.y1, c: m.x0, t: t0 }, { o: 'v', a0: m.y0, a1: m.y1, c: m.x1, t: t0 });
      });
      seen.rules.forEach((r, i) => {
        const ln = { x0: at.x(r.x0), x1: at.x(r.x1), y: at.y((r.y0 + r.y1) / 2), t: r.t / pic.sy, bands: bandsOf('rule', i, RULE_SIDES) };
        if (r.bracket) ln.bracket = true;
        if (r.hang) ln.hang = true;
        if (r.under >= 0) ln.under = at.x(r.under);
        if (r.joined) ln.joined = r.joined;
        out.lines.push(ln);
        out.segs.push(Object.assign({ o: 'h', a0: ln.x0, a1: ln.x1, c: ln.y, t: ln.t }, r.bracket ? { bracket: true } : null));
      });
      where.columns.forEach((c, k) => {
        const topBox = c.boxes[0];
        const part = where.strips.reduce((f, st) => f || st.parts.find((q) => q.kind === 'box' && q.of === topBox && q.side === 'over'), null);
        const r = toPt(part || { x0: c.x0, y0: c.y0 - 15 * pic.sy, x1: c.x1, y1: c.y0 });
        out.heads.push(Object.assign({ kind: 'column', col: k }, r, part ? said(heard.get(part) || []) : { s: '', conf: 0 }));
      });
      where.zones.forEach((z) => {
        const t = said(heard.get(z) || []);
        const r = toPt(z);
        // A block heading over a stack of free rules is read for its words alone (they decide whose block it is).
        if (z.kind === 'block') return;
        if (z.kind === 'letter') {
          // one list mark (a capital, or the digit the engine may read a capital as: B as 8, at most two such), its stop or bracket, a word;
          // this decides that the line is a heading and never changes the text kept
          if (/^[A-Z0-9]{1,2}[.)]\s*\p{L}/u.test(t.s)) out.heads.push(Object.assign({ kind: 'letter', col: -1 }, r, t));
          return;
        }
        // A block of the margin that does not begin with a number (bare or in brackets) goes on the heading above it.
        const last = out.heads.filter((q) => q.kind === 'margin').pop();
        if (last && t.s && !/^[([{]?\d{1,2}[)\]}.]?(\s|$)/.test(t.s)) {
          Object.assign(last, { x0: Math.min(last.x0, r.x0), x1: Math.max(last.x1, r.x1), y1: Math.max(last.y1, r.y1), s: (last.s + ' ' + t.s).trim(), conf: last.s ? Math.min(last.conf, t.conf) : t.conf });
        } else out.heads.push(Object.assign({ kind: 'margin', col: -1 }, r, t));
      });
      if (raw.picture) out.glyphs = read.glyphs;
      else {
        // A page of drawings keeps its drawn geometry and the three rules of drawn().
        const d = drawn(raw, read);
        // a drawn line found standing in brackets says so, as on a picture
        out.lines.forEach((l) => l.bracket && d.segs.forEach((sg) => sg.o === 'h' && !sg.frame && Math.abs(sg.c - l.y) < 1.5 && sg.a0 < l.x1 && sg.a1 > l.x0 && (sg.bracket = true)));
        Object.assign(out, { glyphs: d.glyphs, segs: d.segs, rects: d.rects });
      }
      return trace(todo.length);
    } catch (e) {
      throw e && e.code ? e : fail('fail', e);
    } finally {
      if (pic) pic.canvas.width = pic.canvas.height = 0;
    }
  }

  NS.textread = { page, stop, hangs, printUnder, standsOn, joined, ENLARGE, STRIP_PIXELS, WORDS_MS };
})(window.CVPortal);
