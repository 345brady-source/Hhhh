/*
 * Reading a page that has no text: a page whose letters are drawings, or a picture of a page (a scan).
 *
 * The page is drawn, its words are recognised from the drawing, and they are handed to NS.anchors in the same form as
 * the characters of an ordinary PDF, each marked with how sure the recognition was. Nothing here places a field: the
 * printed places still come only from what is printed (NS.anchors.page) and the fields from NS.placement.
 *
 *   NS.textread.page(pdfPage, raw, opts)   raw: NS.anchors.walk of the page (opts, for checks: words: false finds lines
 *                                          and boxes only, without starting the engine; ink: the finder's ink level;
 *                                          trace: true also returns the picture's levels as the finder took them).
 *                                          Resolves to a raw page of the same form
 *                                          { glyphs, segs, rects, picture: false, pictured, approx, found, words }:
 *                                            pictured  'drawings' (letters drawn as shapes: lines and boxes keep their
 *                                                      exact drawn geometry) or 'picture' (boxes and free rules are
 *                                                      found on the picture itself, by NS.picturepage, from its
 *                                                      pixels alone)
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
   * What the finder saw on the picture of a page (NS.picturepage.find), in points, in the form NS.anchors.walk gives
   * it. found: every box the finder returned, [{ x0, y0, x1, y1, small, ink, place, why, inside (the words printed
   * in it) }]; each free rule is one level stroke. A box exists by its pixels alone: the recognised words are attached
   * to it, and no word adds a box or removes one. No loose stroke is passed on.
   */
  function shapes(seen, at, read) {
    const out = { glyphs: read.glyphs.slice(), segs: [], rects: [], picture: false, found: [], words: read.words };
    const t = Math.max(0.3, 1 / at.scale);
    seen.boxes.forEach((r) => {
      // found carries the outer edge of the printed frame. The rectangle and its four strokes are written the way a
      // drawn rectangle is given: along the middle of the frame's strokes, half a pixel inside that edge.
      const b = { x0: at.x(r.x0), y0: at.y(r.y0), x1: at.x(r.x1), y1: at.y(r.y1) };
      const m = { x0: at.x(r.x0 + 0.5), y0: at.y(r.y0 + 0.5), x1: at.x(r.x1 - 0.5), y1: at.y(r.y1 - 0.5), t };
      const inside = read.words.filter((q) => q.letters && (q.x0 + q.x1) / 2 > b.x0 && (q.x0 + q.x1) / 2 < b.x1 && (q.y0 + q.y1) / 2 > b.y0 && (q.y0 + q.y1) / 2 < b.y1);
      // What recognition made of the frame of a small box is no letter.
      if (r.small) out.glyphs = out.glyphs.filter((g) => g.sp || !((g.x0 + g.x1) / 2 > b.x0 - 1 && (g.x0 + g.x1) / 2 < b.x1 + 1 && g.y > b.y0 && g.y - 0.5 * g.h < b.y1 + 1));
      out.found.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, small: r.small, ink: r.ink, place: r.place, why: r.why, inside: inside.map((q) => q.s).join(' ') });
      out.rects.push(m);
      out.segs.push({ o: 'h', a0: m.x0, a1: m.x1, c: m.y0, t, frame: true }, { o: 'h', a0: m.x0, a1: m.x1, c: m.y1, t, frame: true }, { o: 'v', a0: m.y0, a1: m.y1, c: m.x0, t }, { o: 'v', a0: m.y0, a1: m.y1, c: m.x1, t });
    });
    seen.rules.forEach((r) => out.segs.push({ o: 'h', a0: at.x(r.x0), a1: at.x(r.x1), c: at.y((r.y0 + r.y1) / 2), t: r.t / at.sy }));
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
    const o = opts || {};
    const worker = o.words === false ? null : await start();
    let pic = null;
    let big = null;
    try {
      pic = await timed(draw(pdfPage, raw), PAGE_MS, 'time');
      await new Promise((r) => setTimeout(r, 0));
      const at = { scale: pic.scale, sy: pic.sy, x: (v) => (v - pic.ox) / pic.scale, y: (v) => (v - pic.oy) / pic.sy };
      // On a picture the boxes and free rules are found first, from its pixels alone (NS.picturepage).
      let seen = null;
      if (raw.picture) {
        const w = pic.canvas.width;
        const h = pic.canvas.height;
        try {
          seen = NS.picturepage.find(NS.picturepage.toGrey(pic.ctx.getImageData(0, 0, w, h).data, w, h), w, h, pic.scale, { ink: o.ink });
        } catch (e) {
          throw fail('fail', e);
        }
      }
      // The frames of the boxes one writes in are painted out of the copy the words are recognised from (they are
      // read as letters otherwise): the pixel row or column of the stroke along each side, in pixels of the drawing
      // (the copy paints one pixel more on either side of it).
      const marks = [];
      (seen ? seen.boxes : []).filter((r) => r.x1 - r.x0 > 14 * pic.scale).forEach((r) => marks.push({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y0 + 1 }, { x0: r.x0, x1: r.x1, y0: r.y1 - 1, y1: r.y1 }, { x0: r.x0, x1: r.x0 + 1, y0: r.y0, y1: r.y1 }, { x0: r.x1 - 1, x1: r.x1, y0: r.y0, y1: r.y1 }));
      big = worker ? enlarged(pic, marks) : null;
      const res = worker ? await timed(worker.recognize(big.canvas, {}, { blocks: true, text: false }), PAGE_MS, 'time') : null;
      const k = big ? big.k : 1;
      const read = characters(res && res.data && res.data.blocks, pic.scale * k, pic.ox * k, pic.oy * k, pic.sy * k);
      await new Promise((r) => setTimeout(r, 0));
      const out = raw.picture ? shapes(seen, at, read) : drawn(raw, read);
      out.pictured = raw.picture ? 'picture' : 'drawings';
      out.approx = !!raw.picture;
      if (o.trace && seen) out.trace = { paper: seen.paper, print: seen.print, range: seen.range, tau: seen.tau };
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
