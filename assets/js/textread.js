/*
 * Reading a page that has no text: a page whose letters are drawings, or a picture of a page (a scan).
 *
 * The page is drawn, its words are recognised from the drawing, and they are handed to NS.anchors in the same form as
 * the characters of an ordinary PDF, each marked with how sure the recognition was. Nothing here places a field: the
 * printed places still come only from what is printed (NS.anchors.page) and the fields from NS.placement.
 *
 *   NS.textread.page(pdfPage, raw, opts)   raw: NS.anchors.walk of the page (opts, for checks: words: false finds lines
 *                                          and boxes only; trace: true also returns the strokes). Resolves to a raw page of the same form
 *                                          { glyphs, segs, rects, picture: false, pictured, approx, found, words }:
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
  /**
   * The English data of the recognition engine, as bytes. A host that serves only common file types refuses the
   * compressed file, so the same bytes are also kept as text (base 64) beside it: that file is read when the first
   * request fails or does not answer with the compressed data.
   */
  async function language() {
    const zipped = (b) => b.length > 1000 && b[0] === 31 && b[1] === 139;
    try {
      const r = await fetch(here('eng.traineddata.gz'));
      const b = r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
      if (b && zipped(b)) return b;
    } catch (e) {
      /* the text copy below */
    }
    const r = await fetch(here('eng.traineddata.gz.txt'));
    if (!r.ok) throw new Error('language data: ' + r.status);
    const text = atob((await r.text()).replace(/\s+/g, ''));
    const b = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) b[i] = text.charCodeAt(i);
    if (!zipped(b)) throw new Error('language data: not the expected file');
    return b;
  }
  /** The recognition engine, started once (its files come from the portal's own folder). */
  function start() {
    if (!engine) {
      const p = timed(
        Promise.all([script(here('textread.min.js')), language()]).then((got) => {
          // The engine asks for its language data by address: inside its worker that request is answered with the
          // bytes the page already holds, so it does not matter which of the two files the host served.
          const data = URL.createObjectURL(new Blob([got[1]]));
          const boot = URL.createObjectURL(new Blob([`const ask=self.fetch;self.fetch=(u,o)=>ask(/eng\\.traineddata/.test(String(u))?${JSON.stringify(data)}:u,o);importScripts(${JSON.stringify(here('textread-worker.min.js'))});`], { type: 'application/javascript' }));
          return window.Tesseract.createWorker('eng', 1, { workerPath: boot, workerBlobURL: false, corePath: here('textread-core.wasm.js'), langPath: here('').replace(/\/$/, ''), cacheMethod: 'none', gzip: true, errorHandler: () => {} });
        }),
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

  /**
   * The page drawn on a canvas: { canvas, ctx, scale, sy, ox, oy } with canvas pixel = point * (scale, sy) + (ox, oy). Where one
   * picture covers the page it is drawn at its own pixels, one to one (its strokes stay as crisp as they are in the
   * file); any other page at about 200 to the inch.
   */
  async function draw(pdfPage, raw) {
    const v1 = pdfPage.getViewport({ scale: 1 });
    const im = raw.image;
    const most = Math.sqrt(MAX_PIXELS / (v1.width * v1.height));
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
   * A smooth enlarged copy for recognition (small print wants about 300 to the inch), with the found lines and boxes
   * painted out so that they are not read as letters. marks: [{ x0, y0, x1, y1 }] in pixels of the drawing.
   */
  function enlarged(pic, marks) {
    const k = Math.max(1, Math.min(4, Math.round(300 / 72 / pic.scale), Math.floor(Math.sqrt((1.6 * MAX_PIXELS) / (pic.canvas.width * pic.canvas.height)))));
    const canvas = document.createElement('canvas');
    canvas.width = pic.canvas.width * k;
    canvas.height = pic.canvas.height * k;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pic.canvas, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    (marks || []).forEach((m) => ctx.fillRect((m.x0 - 1) * k, (m.y0 - 1) * k, (m.x1 - m.x0 + 2) * k, (m.y1 - m.y0 + 2) * k));
    return { canvas, k };
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
   * Straight strokes on the picture of a page: every level and upright run of dark at least five points long, no
   * thicker than a rule, with paper on both sides of it (the edge of a dark block is not a line).
   * Returns { h, v, dark, w, hgt } with each stroke { a0, a1 (along it), c (across it), t, c0, c1 } in pixels.
   */
  function strokes(ctx, w, h, scale) {
    const px = ctx.getImageData(0, 0, w, h).data;
    // 1: darker than paper (a pale printed line counts); 2: as dark as print (what is written or printed inside a box).
    const dark = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < dark.length; i++, j += 4) {
      const lum = px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114;
      dark[i] = lum < 150000 ? 2 : lum < 238000 ? 1 : 0;
    }
    const least = Math.max(6, Math.round(4.6 * scale));
    const thick = Math.max(3, Math.round(2.6 * scale));
    const bridge = scale > 2.5 ? 2 : 1;
    const ends = Math.max(2, Math.round(scale));
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
            } else if (++gap > bridge) break;
            b++;
          }
          if (e - a + 1 >= least) {
            let seg = null;
            for (let k = 0; k < live.length; k++) {
              const s = live[k];
              // The rows of one stroke have the same ends (bold words just above a line have other ends, and stay apart).
              if (Math.abs(s.a0 - a) <= ends && Math.abs(s.a1 - e) <= ends) {
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
        live = now;
      }
      // Paper on both sides: the lines just outside the stroke are mostly not print-dark along it.
      const side = (s, c) => {
        if (c < 0 || c >= lines) return 0;
        let n = 0;
        for (let x = s.a0; x <= s.a1; x++) n += dark[c * across + x * along] === 2 ? 1 : 0;
        return n / (s.a1 - s.a0 + 1);
      };
      return out.filter((s) => s.c1 - s.c0 + 1 <= thick && side(s, s.c0 - 2) < 0.7 && side(s, s.c1 + 2) < 0.7).map((s) => ({ a0: s.a0, a1: s.a1 + 1, c: (s.c0 + s.c1 + 1) / 2, t: s.c1 - s.c0 + 1 }));
    };
    return { h: find(true), v: find(false), dark, w, hgt: h };
  }
  /** The share of print-dark (or, with least 1, of anything darker than paper) inside a rectangle of the picture (pixels). */
  function inked(pic, x0, y0, x1, y1, least) {
    let n = 0;
    let all = 0;
    for (let y = Math.max(0, Math.ceil(y0)); y < Math.min(pic.hgt, y1); y++) for (let x = Math.max(0, Math.ceil(x0)); x < Math.min(pic.w, x1); x++, all++) n += pic.dark[y * pic.w + x] >= (least || 2) ? 1 : 0;
    return all ? n / all : 0;
  }
  /**
   * Closed boxes on the picture: four straight strokes of like thickness that meet at the corners, level sides ending
   * at the corners (uprights may run on where boxes are stacked). In pixels: [{ x0, y0, x1, y1, t, parts }].
   */
  function closed(pic, scale) {
    const tol = Math.max(2, 1.4 * scale);
    const over = 3 * scale; // a level side may run on past a corner by this much (where it meets its neighbour's)
    const rects = [];
    pic.h.forEach((top) => {
      let best = null;
      pic.h.forEach((bot) => {
        if (bot.c - top.c < 4 * scale || Math.abs(bot.a0 - top.a0) > over || Math.abs(bot.a1 - top.a1) > over) return;
        if (best && bot.c >= best.bot.c) return;
        // The corners: where the shorter of the two level sides ends, an upright runs from one to the other.
        const side = (x) => pic.v.find((v) => Math.abs(v.c - x) <= tol && v.a0 <= top.c + tol && v.a1 >= bot.c - tol);
        const l = side(Math.max(top.a0, bot.a0));
        const r = side(Math.min(top.a1, bot.a1));
        if (l && r && r.c - l.c >= 4 * scale) best = { bot, l, r };
      });
      if (!best) return;
      const ts = [top.t, best.bot.t, best.l.t, best.r.t];
      const box = { x0: best.l.c, y0: top.c, x1: best.r.c, y1: best.bot.c, t: Math.max.apply(null, ts), parts: [top, best.bot, best.l, best.r] };
      if (rects.some((o) => Math.abs(o.x0 - box.x0) <= 2 && Math.abs(o.x1 - box.x1) <= 2 && Math.abs(o.y0 - box.y0) <= 2 && Math.abs(o.y1 - box.y1) <= 2)) return;
      // A small box stands clear on one side at least: a letter inside a word has a neighbour right against it on both.
      if (box.x1 - box.x0 <= 14 * scale && box.y1 - box.y0 <= 14 * scale) {
        const beside = (x) => inked(pic, x, box.y0 + 1, x + 2, box.y1 - 1, 1);
        if (beside(box.x0 - best.l.t / 2 - 3) > 0.3 && beside(box.x1 + best.r.t / 2 + 1) > 0.3) return;
      }
      rects.push(box);
    });
    // A box that holds other boxes is a frame around them, not a place.
    return rects.filter((r) => !rects.some((o) => o !== r && o.x0 >= r.x0 - 1 && o.x1 <= r.x1 + 1 && o.y0 >= r.y0 - 1 && o.y1 <= r.y1 + 1 && (o.x1 - o.x0) * (o.y1 - o.y0) < 0.9 * (r.x1 - r.x0) * (r.y1 - r.y0)));
  }

  /**
   * What was found on the picture of a page, in points, in the form NS.anchors.walk gives it, with found: the closed
   * boxes [{ x0, y0, x1, y1, small, inside (the words printed in it) }]. A stroke that lies in a recognised word is
   * part of a letter and is left out; a box filled with print, or lying in running text that was read with confidence,
   * is no place.
   */
  function shapes(pic, boxes, at, read, size) {
    const out = { glyphs: read.glyphs.slice(), segs: [], rects: [], picture: false, found: [], words: read.words };
    const used = new Set();
    const inWord = (x0, x1, y0, y1) => read.words.some((w) => w.letters && ov(w.x0, w.x1, x0, x1) > 0.5 * (x1 - x0) && ov(w.y0 - 0.5, w.y1 + 0.5, y0, y1) > 0.5 * (y1 - y0));
    boxes.forEach((r) => {
      r.parts.forEach((s) => used.add(s));
      const b = { x0: at.x(r.x0), y0: at.y(r.y0), x1: at.x(r.x1), y1: at.y(r.y1), t: Math.max(0.3, r.t / at.scale) };
      const w = b.x1 - b.x0;
      const hh = b.y1 - b.y0;
      if (w < 5 || hh < 5 || (w > 0.6 * size.w && hh > 0.3 * size.h)) return;
      const small = w <= 20 && hh <= 20;
      const inside = read.words.filter((q) => q.letters && (q.x0 + q.x1) / 2 > b.x0 && (q.x0 + q.x1) / 2 < b.x1 && (q.y0 + q.y1) / 2 > b.y0 && (q.y0 + q.y1) / 2 < b.y1);
      // A small box that lies in a word read with confidence (the word goes on past it) is the shape of a letter.
      if (small && read.words.some((q) => q.conf >= 60 && /[A-Za-z0-9]{3}/.test(q.s) && (q.x0 < b.x0 - 3 || q.x1 > b.x1 + 3) && q.x0 < (b.x0 + b.x1) / 2 && q.x1 > (b.x0 + b.x1) / 2 && ov(q.y0, q.y1, b.y0, b.y1) > 0.5 * hh)) return;
      const pad = r.t + Math.max(1, 0.8 * at.scale);
      const ink = inked(pic, r.x0 + pad, r.y0 + pad, r.x1 - pad, r.y1 - pad);
      // Mostly paper inside: a shape that closes round words (rows of small print run together) is not a box.
      if (inked(pic, r.x0 + pad, r.y0 + pad, r.x1 - pad, r.y1 - pad, 1) > (small ? 0.3 : 0.18)) return;
      // Filled in, ticked or full of print: not an empty place (a short caption printed inside a roomy box is one).
      const covered = inside.reduce((n, q) => n + (q.x1 - q.x0) * (q.y1 - q.y0), 0) / (w * hh);
      if (small ? ink > 0.03 : ink > 0.12 || covered > 0.3 || inside.length > 6) return;
      if (small) out.glyphs = out.glyphs.filter((g) => g.sp || !((g.x0 + g.x1) / 2 > b.x0 - 1 && (g.x0 + g.x1) / 2 < b.x1 + 1 && g.y > b.y0 && g.y - 0.5 * g.h < b.y1 + 1));
      out.found.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, small, inside: inside.map((q) => q.s).join(' ') });
      out.rects.push(b);
      out.segs.push({ o: 'h', a0: b.x0, a1: b.x1, c: b.y0, t: b.t, frame: true }, { o: 'h', a0: b.x0, a1: b.x1, c: b.y1, t: b.t, frame: true }, { o: 'v', a0: b.y0, a1: b.y1, c: b.x0, t: b.t }, { o: 'v', a0: b.y0, a1: b.y1, c: b.x1, t: b.t });
    });
    pic.h.forEach((s) => {
      if (used.has(s)) return;
      const g = { o: 'h', a0: at.x(s.a0), a1: at.x(s.a1), c: at.y(s.c), t: s.t / at.scale };
      if (!inWord(g.a0, g.a1, g.c - g.t / 2, g.c + g.t / 2)) out.segs.push(g);
    });
    pic.v.forEach((s) => {
      if (used.has(s)) return;
      const g = { o: 'v', a0: at.y(s.a0), a1: at.y(s.a1), c: at.x(s.c), t: s.t / at.scale };
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

  async function page(pdfPage, raw, opts) {
    const worker = opts && opts.words === false ? null : await start();
    let pic = null;
    let big = null;
    try {
      pic = await timed(draw(pdfPage, raw), PAGE_MS, 'time');
      await new Promise((r) => setTimeout(r, 0));
      const v1 = pdfPage.getViewport({ scale: 1 });
      const at = { scale: pic.scale, x: (v) => (v - pic.ox) / pic.scale, y: (v) => (v - pic.oy) / pic.sy };
      // On a picture the lines and boxes are found first, and the boxes one writes in are painted out of the copy the
      // words are recognised from (their frames are read as letters otherwise).
      const found = raw.picture ? strokes(pic.ctx, pic.canvas.width, pic.canvas.height, pic.scale) : null;
      const boxes = found ? closed(found, pic.scale) : [];
      const marks = [];
      boxes.filter((r) => r.x1 - r.x0 > 14 * pic.scale).forEach((r) => r.parts.forEach((s, i) => marks.push(i < 2 ? { x0: s.a0, x1: s.a1, y0: s.c - s.t / 2, y1: s.c + s.t / 2 } : { x0: s.c - s.t / 2, x1: s.c + s.t / 2, y0: Math.max(s.a0, r.y0 - 1), y1: Math.min(s.a1, r.y1 + 1) })));
      big = enlarged(pic, marks);
      const res = worker ? await timed(worker.recognize(big.canvas, {}, { blocks: true, text: false }), PAGE_MS, 'time') : null;
      const read = characters(res && res.data && res.data.blocks, pic.scale * big.k, pic.ox * big.k, pic.oy * big.k, pic.sy * big.k);
      await new Promise((r) => setTimeout(r, 0));
      const out = raw.picture ? shapes(found, boxes, at, read, { w: v1.width, h: v1.height }) : drawn(raw, read);
      out.pictured = raw.picture ? 'picture' : 'drawings';
      out.approx = !!raw.picture;
      if (opts && opts.trace && found) out.trace = { h: found.h.map((s) => [at.x(s.a0), at.x(s.a1), at.y(s.c), s.t]), v: found.v.map((s) => [at.y(s.a0), at.y(s.a1), at.x(s.c), s.t]) };
      return out;
    } catch (e) {
      // A page that ran out of time leaves the engine busy: it is stopped, and started afresh for the next page.
      if (e && e.code === 'time') stop();
      throw e && e.code ? e : fail('fail', e);
    } finally {
      if (pic) pic.canvas.width = pic.canvas.height = 0;
      if (big) big.canvas.width = big.canvas.height = 0;
    }
  }

  NS.textread = { page, stop };
})(window.CVPortal);
