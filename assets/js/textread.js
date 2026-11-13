/*
 * Reading a page that has no text: a page whose letters are drawings, or a picture of a page (a scan).
 *
 * The page is drawn, its words are recognised from the drawing, and they are handed to NS.anchors in the same form as
 * the characters of an ordinary PDF, each marked with how sure the recognition was. Nothing here places a field: the
 * printed places still come only from what is printed (NS.anchors.page) and the fields from NS.placement.
 *
 *   NS.textread.page(pdfPage, raw, opts)   raw: NS.anchors.walk of the page. Resolves to a raw page of the same form
 *                                          { glyphs, segs, rects, picture: false, pictured, approx }:
 *                                            pictured  'drawings' (letters drawn as shapes: lines and boxes keep their
 *                                                      exact drawn geometry) or 'picture' (lines and boxes are found on
 *                                                      the picture itself)
 *                                            approx    true for a picture: positions come from its pixels and are checked by a person
 *                                          Rejects with an Error whose code is 'load' (the recognition files could not
 *                                          be loaded), 'time' (a page took too long) or 'fail'.
 *   NS.textread.stop()                     frees the recognition engine
 *
 * The recognition engine and its English data are the portal's own files (assets/vendor/textread, licences beside
 * them); they are loaded only when a page without text is met.
 */
(function (NS) {
  'use strict';
  const DIR = 'assets/vendor/textread/';
  const DPI = 220; // the drawing resolution: enough for small print, and a page still takes only some seconds
  const MAX_PIXELS = 9.5e6;
  const LOAD_MS = 60000;
  const PAGE_MS = 75000;
  const here = (f) => new URL(DIR + f, document.baseURI).href;
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

  let engine = null;
  function script(src) {
    return new Promise((ok, no) => {
      if (window.Tesseract) return ok();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => ok();
      s.onerror = () => (s.remove(), no(new Error('script')));
      document.head.appendChild(s);
    });
  }
  /** The recognition engine, started once (its files come from the portal's own folder). */
  function start() {
    if (!engine) {
      const p = timed(
        script(here('textread.min.js')).then(() =>
          window.Tesseract.createWorker('eng', 1, { workerPath: here('textread-worker.min.js'), corePath: here('textread-core.wasm.js'), langPath: here('').replace(/\/$/, ''), cacheMethod: 'none', gzip: true, errorHandler: () => {} })
        ),
        LOAD_MS,
        'load'
      ).then(
        (w) => w,
        (e) => {
          if (engine === p) engine = null;
          throw fail('load', e);
        }
      );
      engine = p;
    }
    return engine;
  }
  function stop() {
    const p = engine;
    engine = null;
    if (p) p.then((w) => w.terminate(), () => {});
  }

  /** The page drawn on a canvas; scale is canvas pixels to a point. */
  async function draw(pdfPage) {
    const v1 = pdfPage.getViewport({ scale: 1 });
    const scale = Math.min(DPI / 72, Math.sqrt(MAX_PIXELS / (v1.width * v1.height)));
    const vp = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise;
    return { canvas, ctx, scale };
  }

  /**
   * The recognised words as characters in points: { glyphs, words, slope }. Every character of a line stands on the
   * line's baseline; conf is how sure the recognition was of its word (0 to 100). Underscores are left out: a blank
   * is read from its drawn line, never from a recognised character.
   */
  function characters(blocks, scale) {
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
          const base = (bl.y0 + bl.y1) / 2 / scale;
          // The size of the type: the height of the line's tallest word is about seven tenths of it when the line has
          // capitals or tall letters, and the whole of it when it has letters that hang below as well.
          const tall = Math.max.apply(null, ws.map((w) => w.bbox.y1 - w.bbox.y0)) / scale;
          const text = ws.map((w) => w.text).join('');
          const size = Math.max(4, Math.min(40, /[gjpqy,;()[\]]/.test(text) ? tall / 0.95 : tall / 0.72));
          let last = null;
          ws.forEach((w) => {
            const conf = Math.round(+w.confidence || 0);
            const letters = /[A-Za-z0-9]/.test(w.text);
            if (!letters && conf < 30) return; // specks
            const box = { s: w.text, x0: w.bbox.x0 / scale, x1: w.bbox.x1 / scale, y0: w.bbox.y0 / scale, y1: w.bbox.y1 / scale, conf, letters, base, size };
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
   * Straight strokes on the picture of a page: every level and upright run of dark at least five points long and no
   * thicker than a rule. Returns { h, v, dark, w } with each stroke { a0, a1 (along it), c (across it), t } in pixels.
   */
  function strokes(ctx, w, h, scale) {
    const px = ctx.getImageData(0, 0, w, h).data;
    // 1: darker than paper (a pale printed line counts); 2: as dark as print (what is written or printed inside a box).
    const dark = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < dark.length; i++, j += 4) {
      const lum = px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114;
      dark[i] = lum < 150000 ? 2 : lum < 232000 ? 1 : 0;
    }
    const least = Math.round(5 * scale);
    const thick = Math.max(3, Math.round(2.6 * scale));
    const find = (level) => {
      const lines = level ? h : w;
      const len = level ? w : h;
      const along = level ? 1 : w;
      const across = level ? w : 1;
      const out = [];
      let live = [];
      for (let c = 0; c < lines; c++) {
        const at = c * across;
        const now = [];
        let a = 0;
        while (a < len) {
          if (!dark[at + a * along]) {
            a++;
            continue;
          }
          let e = a;
          let b = a + 1;
          let gap = 0;
          while (b < len) {
            if (dark[at + b * along]) {
              e = b;
              gap = 0;
            } else if (++gap > 2) break;
            b++;
          }
          if (e - a + 1 >= least) {
            let seg = null;
            for (let k = 0; k < live.length; k++) {
              const s = live[k];
              if (Math.min(s.a1, e) - Math.max(s.a0, a) >= 0.6 * Math.min(s.a1 - s.a0, e - a)) {
                seg = s;
                break;
              }
            }
            if (seg) {
              seg.a0 = Math.min(seg.a0, a);
              seg.a1 = Math.max(seg.a1, e);
              seg.c1 = c;
            } else {
              seg = { a0: a, a1: e, c0: c, c1: c };
              out.push(seg);
            }
            if (now.indexOf(seg) < 0) now.push(seg);
          }
          a = b;
        }
        live = now.concat(live.filter((s) => s.c1 >= c - 1 && now.indexOf(s) < 0));
      }
      return out.filter((s) => s.c1 - s.c0 + 1 <= thick).map((s) => ({ a0: s.a0, a1: s.a1 + 1, c: (s.c0 + s.c1 + 1) / 2, t: s.c1 - s.c0 + 1 }));
    };
    return { h: find(true), v: find(false), dark, w };
  }
  /** The share of print-dark inside a rectangle of the picture (pixels). */
  function inked(pic, x0, y0, x1, y1) {
    let n = 0;
    let all = 0;
    for (let y = Math.ceil(y0); y < y1; y++) for (let x = Math.ceil(x0); x < x1; x++, all++) n += pic.dark[y * pic.w + x] === 2 ? 1 : 0;
    return all ? n / all : 0;
  }

  /**
   * Lines and boxes found on the picture of a page, in points, in the form NS.anchors.walk gives them. A box is four
   * straight strokes that meet at its corners (so the shape of a letter is never a box); a stroke that lies in a
   * recognised word is part of a letter and is left out. Something printed inside a box that was not read as words is
   * kept as a mark, so the box does not count as empty.
   */
  function shapes(pic, scale, read) {
    const tol = 1.6 * scale;
    const hs = pic.h;
    const vs = pic.v;
    const rects = [];
    const used = new Set();
    hs.forEach((top) => {
      let best = null;
      hs.forEach((bot) => {
        if (bot.c - top.c < 4 * scale || Math.abs(bot.a0 - top.a0) > tol || Math.abs(bot.a1 - top.a1) > tol) return;
        if (best && bot.c >= best.bot.c) return;
        const side = (x) => vs.find((v) => Math.abs(v.c - x) <= tol && v.a0 <= top.c + tol && v.a1 >= bot.c - tol);
        const l = side(top.a0);
        const r = side(top.a1);
        if (l && r) best = { bot, l, r };
      });
      if (!best) return;
      [top, best.bot, best.l, best.r].forEach((s) => used.add(s));
      rects.push({ x0: best.l.c, y0: top.c, x1: best.r.c, y1: best.bot.c, t: Math.max(top.t, best.l.t) });
    });
    const pt = (v) => v / scale;
    const out = { glyphs: read.glyphs.slice(), segs: [], rects: [], picture: false };
    const inWord = (x0, x1, y0, y1) => read.words.some((w) => w.letters && ov(w.x0, w.x1, x0, x1) > 0.5 * (x1 - x0) && ov(w.y0 - 0.5, w.y1 + 0.5, y0, y1) > 0.5 * (y1 - y0));
    rects.forEach((r) => {
      const b = { x0: pt(r.x0), y0: pt(r.y0), x1: pt(r.x1), y1: pt(r.y1), t: Math.max(0.3, pt(r.t)) };
      const small = b.x1 - b.x0 <= 20 && b.y1 - b.y0 <= 20;
      // A small box in the middle of a word that was read with confidence is the shape of a letter, not a box.
      if (small && read.words.some((w) => w.letters && w.conf >= 60 && w.x0 < b.x0 - 3 && w.x1 > b.x1 + 3 && ov(w.y0, w.y1, b.y0, b.y1) > 0.5 * (b.y1 - b.y0))) return;
      const inside = (g) => (g.x0 + g.x1) / 2 > b.x0 - 1 && (g.x0 + g.x1) / 2 < b.x1 + 1 && g.y > b.y0 && g.y - 0.5 * g.h < b.y1 + 1;
      const pad = r.t + 1.2 * scale;
      const ink = inked(pic, r.x0 + pad, r.y0 + pad, r.x1 - pad, r.y1 - pad);
      if (small) out.glyphs = out.glyphs.filter((g) => g.sp || !inside(g));
      if (ink > (small ? 0.03 : 0.003) && !out.glyphs.some((g) => !g.sp && inside(g))) out.glyphs.push({ u: '•', sp: false, x0: (b.x0 + b.x1) / 2 - 1, x1: (b.x0 + b.x1) / 2 + 1, y: (b.y0 + b.y1) / 2 + 1, h: 4, font: '', hidden: false, conf: 0 });
      out.rects.push(b);
      out.segs.push({ o: 'h', a0: b.x0, a1: b.x1, c: b.y0, t: b.t, frame: true }, { o: 'h', a0: b.x0, a1: b.x1, c: b.y1, t: b.t, frame: true }, { o: 'v', a0: b.y0, a1: b.y1, c: b.x0, t: b.t }, { o: 'v', a0: b.y0, a1: b.y1, c: b.x1, t: b.t });
    });
    hs.forEach((s) => {
      if (used.has(s)) return;
      const g = { o: 'h', a0: pt(s.a0), a1: pt(s.a1), c: pt(s.c), t: pt(s.t) };
      if (!inWord(g.a0, g.a1, g.c - g.t / 2, g.c + g.t / 2)) out.segs.push(g);
    });
    vs.forEach((s) => {
      if (used.has(s)) return;
      const g = { o: 'v', a0: pt(s.a0), a1: pt(s.a1), c: pt(s.c), t: pt(s.t) };
      if (!inWord(g.c - g.t / 2, g.c + g.t / 2, g.a0, g.a1)) out.segs.push(g);
    });
    return out;
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

  async function page(pdfPage, raw) {
    const worker = await start();
    let pic = null;
    try {
      pic = await timed(draw(pdfPage), PAGE_MS, 'time');
      await new Promise((r) => setTimeout(r, 0));
      const res = await timed(worker.recognize(pic.canvas, {}, { blocks: true, text: false }), PAGE_MS, 'time');
      const read = characters(res && res.data && res.data.blocks, pic.scale);
      await new Promise((r) => setTimeout(r, 0));
      const out = raw.picture ? shapes(strokes(pic.ctx, pic.canvas.width, pic.canvas.height, pic.scale), pic.scale, read) : drawn(raw, read);
      out.pictured = raw.picture ? 'picture' : 'drawings';
      out.approx = !!raw.picture;
      return out;
    } catch (e) {
      // A page that ran out of time leaves the engine busy: it is stopped, and started afresh for the next page.
      if (e && e.code === 'time') stop();
      throw e && e.code ? e : fail('fail', e);
    } finally {
      if (pic) pic.canvas.width = pic.canvas.height = 0;
    }
  }

  NS.textread = { page, stop };
})(window.CVPortal);
