/*
 * Printed places: reads what a page of an agreement has printed on it, without drawing the page.
 *
 * This file works on plain data only and touches nothing when it loads, so it can also be loaded outside a browser.
 * All coordinates are PDF points of the page as displayed (crop box and rotation applied), origin top-left, y downwards.
 *
 *   walk(page, viewport, OPS)   the drawing operators of one page of the PDF reader, as plain data:
 *                               { glyphs, segs, rects, picture } (every character with its true extent, every straight
 *                               stroke and thin filled bar, every drawn rectangle, and whether one picture covers the page)
 *   page(raw, size, forms)      what placement reads: { page, w, h, items, rules, boxes, forms, scan }
 *                               items  runs of text { s, x, y, w, h } (a run of underscores and a box character are
 *                                      runs of their own, so their extents are exact)
 *                               rules  printed lines that can be written on { x0, x1, y, clear, pad, made, cut, cell, table,
 *                                      bracketed (printed between square brackets as a blank or a box) }
 *                                      (pad: how far a field may reach past each end and under the line: { l, r, d })
 *                               boxes  printed tick boxes { x, y, w, h, made }
 *                               forms  the PDF's own form fields { x0, y0, x1, y1, type, label, check, readOnly }
 *                               scan   true when the page is a picture (nothing can be read from it)
 *
 * A place is only ever something printed: a run of underscores, a drawn line, a box character, a drawn square, an
 * empty bracket pair, an empty ruled cell, a form field. A line between square brackets is the sponsor's own
 * placeholder and is left out, as are underlines of words, footnote and footer rules and the frames of tables.
 */
(function (NS) {
  'use strict';

  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const at = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

  /** One page's drawing operators as plain data. page: a page of the PDF reader; vp: its viewport at scale 1; OPS: the reader's operator codes. */
  async function walk(page, vp, OPS) {
    const ol = await page.getOperatorList();
    // A font is only known once the reader has finished loading it, which can be after the operator list is ready:
    // wait for each (a font that never arrives is given up on after a moment, and its characters still count as text).
    const ids = [];
    for (let i = 0; i < ol.fnArray.length; i++) if (ol.fnArray[i] === OPS.setFont && ids.indexOf(ol.argsArray[i][0]) < 0) ids.push(ol.argsArray[i][0]);
    await Promise.all(
      ids.map(
        (id) =>
          new Promise((done) => {
            const timer = setTimeout(done, 3000);
            const ok = () => {
              clearTimeout(timer);
              done();
            };
            try {
              if (page.commonObjs.has(id)) ok();
              else page.commonObjs.get(id, ok);
            } catch (e) {
              ok();
            }
          })
      )
    );
    let st = { ctm: vp.transform.slice(), tm: [1, 0, 0, 1, 0, 0], x: 0, y: 0, lineX: 0, lineY: 0, size: 0, dir: 1, cs: 0, ws: 0, hs: 1, rise: 0, lead: 0, font: null, lw: 1, mode: 0, fill: 0, ink: 0 };
    const stack = [];
    const push = () => stack.push(Object.assign({}, st, { ctm: st.ctm.slice(), tm: st.tm.slice() }));
    const pop = () => stack.length && (st = stack.pop());
    const light = (a) => (a && a.length >= 3 && Math.min(a[0], a[1], a[2]) >= 245 ? 1 : 0);
    const glyphs = [];
    const segs = []; // { o: 'h' | 'v', a0, a1 (extent along it), c (its position across), t (thickness), frame }
    const rects = [];
    const blobs = []; // the extent of every filled shape that is not a plain rectangle (the letters of a page whose text is drawn)
    const frames = []; // squares drawn as a filled frame: one rectangle inside another { x0, y0, x1, y1, t }
    let cur = null;
    let picture = false;
    let image = null; // the picture that covers the page: its own pixel size and where it lies { w, h, x0, y0, x1, y1 }
    const fontOf = (id) => {
      try {
        return page.commonObjs.get(id);
      } catch (e) {
        try {
          return page.objs.get(id);
        } catch (e2) {
          return null;
        }
      }
    };
    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i];
      const a = ol.argsArray[i];
      if (fn === OPS.save) push();
      else if (fn === OPS.restore) pop();
      else if (fn === OPS.transform) st.ctm = mul(st.ctm, a);
      else if (fn === OPS.paintFormXObjectBegin) {
        push();
        if (a && a[0]) st.ctm = mul(st.ctm, a[0]);
      } else if (fn === OPS.paintFormXObjectEnd) pop();
      else if (fn === OPS.setLineWidth) st.lw = a[0];
      else if (fn === OPS.setFillRGBColor) st.fill = light(a);
      else if (fn === OPS.setStrokeRGBColor) st.ink = light(a);
      else if (fn === OPS.beginText) {
        st.tm = [1, 0, 0, 1, 0, 0];
        st.x = st.y = st.lineX = st.lineY = 0;
      } else if (fn === OPS.setTextMatrix) {
        st.tm = [a[0], a[1], a[2], a[3], a[4], a[5]];
        st.x = st.lineX = 0;
        st.y = st.lineY = 0;
      } else if (fn === OPS.moveText) {
        st.x = st.lineX += a[0];
        st.y = st.lineY += a[1];
      } else if (fn === OPS.setLeadingMoveText) {
        st.lead = a[1];
        st.x = st.lineX += a[0];
        st.y = st.lineY += a[1];
      } else if (fn === OPS.setLeading) st.lead = -a[0];
      else if (fn === OPS.nextLine) {
        st.x = st.lineX;
        st.y = st.lineY += st.lead;
      } else if (fn === OPS.setFont) {
        st.size = Math.abs(a[1]);
        st.dir = a[1] < 0 ? -1 : 1;
        st.font = fontOf(a[0]);
      } else if (fn === OPS.setCharSpacing) st.cs = a[0];
      else if (fn === OPS.setWordSpacing) st.ws = a[0];
      else if (fn === OPS.setHScale) st.hs = a[0] / 100;
      else if (fn === OPS.setTextRise) st.rise = a[0];
      else if (fn === OPS.setTextRenderingMode) st.mode = a[0];
      else if (fn === OPS.showText) {
        const font = st.font || {};
        const adv = st.size * (font.fontMatrix || [0.001])[0];
        const M = mul(mul(st.ctm, st.tm), [1, 0, 0, 1, st.x, st.y + st.rise]);
        const pt = (lx) => [M[0] * lx * st.hs + M[4], M[1] * lx * st.hs + M[5]];
        const hgt = Math.hypot(M[2], M[3]) * st.size;
        const level = M[0] > 0 && Math.abs(M[1]) <= 0.02 * Math.abs(M[0]); // horizontal as displayed
        const name = String(font.name || '').replace(/^[A-Z]{6}\+/, '');
        let x = 0;
        (a[0] || []).forEach((g) => {
          if (typeof g === 'number') {
            x -= (g * st.size) / 1000;
            return;
          }
          if (!g) return;
          const p0 = pt(x);
          const p1 = pt(x + g.width * adv);
          // What the character is comes from its own code point; the reader's space flag only says the byte was 32,
          // which a subset font may give to any letter (it still decides where word spacing applies).
          const u = String(g.unicode == null ? '' : g.unicode);
          if (level && hgt >= 3) glyphs.push({ u, sp: !u.trim(), x0: p0[0], x1: p1[0], y: p0[1], h: hgt, font: name, hidden: st.mode === 3 || st.mode === 7 });
          x += g.width * adv + ((g.isSpace ? st.ws : 0) + st.cs) * st.dir;
        });
        st.x += x * st.hs;
      } else if (fn === OPS.constructPath) {
        const ops = a[0];
        const co = a[1];
        const list = [];
        let k = 0;
        let px = 0;
        let py = 0;
        let sx = 0;
        let sy = 0;
        let curve = false;
        let sub = 0;
        const box = [Infinity, Infinity, -Infinity, -Infinity];
        const grow = (x, y) => {
          const p = at(st.ctm, x, y);
          if (p[0] < box[0]) box[0] = p[0];
          if (p[1] < box[1]) box[1] = p[1];
          if (p[0] > box[2]) box[2] = p[0];
          if (p[1] > box[3]) box[3] = p[1];
        };
        const line = (x0, y0, x1, y1) => {
          const p1 = at(st.ctm, x0, y0);
          const p2 = at(st.ctm, x1, y1);
          list.push({ t: 'l', x0: p1[0], y0: p1[1], x1: p2[0], y1: p2[1], sub });
        };
        for (let j = 0; j < ops.length; j++) {
          const o = ops[j];
          if (o === OPS.rectangle) {
            const x = co[k++];
            const y = co[k++];
            const w = co[k++];
            const hh = co[k++];
            const p1 = at(st.ctm, x, y);
            const p2 = at(st.ctm, x + w, y + hh);
            grow(x, y);
            grow(x + w, y + hh);
            list.push({ t: 'r', x0: Math.min(p1[0], p2[0]), y0: Math.min(p1[1], p2[1]), x1: Math.max(p1[0], p2[0]), y1: Math.max(p1[1], p2[1]) });
          } else if (o === OPS.moveTo) {
            px = sx = co[k++];
            py = sy = co[k++];
            sub++;
            grow(px, py);
          } else if (o === OPS.lineTo) {
            const x = co[k++];
            const y = co[k++];
            line(px, py, x, y);
            grow(x, y);
            px = x;
            py = y;
          } else if (o === OPS.curveTo) {
            k += 6;
            grow(co[k - 2], co[k - 1]);
            curve = true;
          } else if (o === OPS.curveTo2 || o === OPS.curveTo3) {
            k += 4;
            grow(co[k - 2], co[k - 1]);
            curve = true;
          } else if (o === OPS.closePath) {
            if (px !== sx || py !== sy) line(px, py, sx, sy);
            px = sx;
            py = sy;
          }
        }
        cur = { list, curve, box, scale: Math.sqrt(Math.abs(st.ctm[0] * st.ctm[3] - st.ctm[1] * st.ctm[2])) };
      } else if (fn === OPS.stroke || fn === OPS.closeStroke || fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) {
        if (cur && !st.fill && fn !== OPS.stroke && fn !== OPS.closeStroke && cur.box[2] > cur.box[0]) {
          // What a page whose text is drawn is read from (NS.textread): the extent of each filled shape, and a square
          // drawn as a filled frame (two rectangles, one inside the other).
          const subs = [];
          cur.list.forEach((s) => s.t === 'l' && (subs[s.sub] = subs[s.sub] || []).push(s));
          const sq = cur.curve || cur.list.some((s) => s.t !== 'l') ? [] : subs.filter(Boolean).map((ls) => (ls.length >= 4 && ls.length <= 5 && ls.every((s) => Math.abs(s.x0 - s.x1) < 0.3 || Math.abs(s.y0 - s.y1) < 0.3) ? { x0: Math.min.apply(null, ls.map((s) => Math.min(s.x0, s.x1))), y0: Math.min.apply(null, ls.map((s) => Math.min(s.y0, s.y1))), x1: Math.max.apply(null, ls.map((s) => Math.max(s.x0, s.x1))), y1: Math.max.apply(null, ls.map((s) => Math.max(s.y0, s.y1))) } : null));
          if (sq.length === 2 && sq[0] && sq[1]) {
            const o = sq[0].x1 - sq[0].x0 >= sq[1].x1 - sq[1].x0 ? sq[0] : sq[1];
            const n = o === sq[0] ? sq[1] : sq[0];
            const t = (o.x1 - o.x0 - (n.x1 - n.x0)) / 2;
            if (n.x0 > o.x0 && n.x1 < o.x1 && n.y0 > o.y0 && n.y1 < o.y1 && t < 0.2 * (o.x1 - o.x0)) frames.push({ x0: o.x0 + t / 2, y0: o.y0 + t / 2, x1: o.x1 - t / 2, y1: o.y1 - t / 2, t });
            else blobs.push({ x0: cur.box[0], y0: cur.box[1], x1: cur.box[2], y1: cur.box[3] });
          } else if (cur.curve || sq.length !== 1 || !sq[0]) blobs.push({ x0: cur.box[0], y0: cur.box[1], x1: cur.box[2], y1: cur.box[3] });
        }
        if (cur && !cur.curve) {
          const stroked = fn !== OPS.fill && fn !== OPS.eoFill && !st.ink;
          const filled = fn !== OPS.stroke && fn !== OPS.closeStroke && !st.fill;
          const lw = Math.max(0.2, st.lw * cur.scale);
          // A closed path of four straight sides at right angles is a rectangle whatever it was built from.
          let list = cur.list;
          const ls = list.filter((s) => s.t === 'l');
          if (ls.length >= 4 && ls.length <= 5 && list.length === ls.length && ls.every((s) => Math.abs(s.x0 - s.x1) < 0.3 || Math.abs(s.y0 - s.y1) < 0.3) && Math.abs(ls[0].x0 - ls[ls.length - 1].x1) < 0.3 && Math.abs(ls[0].y0 - ls[ls.length - 1].y1) < 0.3) {
            const xs = ls.reduce((o, s) => o.concat(s.x0, s.x1), []);
            const ys = ls.reduce((o, s) => o.concat(s.y0, s.y1), []);
            list = [{ t: 'r', x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) }];
          }
          list.forEach((s) => {
            if (s.t === 'l') {
              if (!stroked) return;
              if (Math.abs(s.y0 - s.y1) < 0.6) segs.push({ o: 'h', a0: Math.min(s.x0, s.x1), a1: Math.max(s.x0, s.x1), c: (s.y0 + s.y1) / 2, t: lw });
              else if (Math.abs(s.x0 - s.x1) < 0.6) segs.push({ o: 'v', a0: Math.min(s.y0, s.y1), a1: Math.max(s.y0, s.y1), c: (s.x0 + s.x1) / 2, t: lw });
              return;
            }
            const w = s.x1 - s.x0;
            const hh = s.y1 - s.y0;
            // A rectangle with no height or no width, stroked, is a line.
            if (stroked && hh < 0.6 && w >= 3) return segs.push({ o: 'h', a0: s.x0, a1: s.x1, c: (s.y0 + s.y1) / 2, t: lw });
            if (stroked && w < 0.6 && hh >= 3) return segs.push({ o: 'v', a0: s.y0, a1: s.y1, c: (s.x0 + s.x1) / 2, t: lw });
            if (filled && hh <= 3 && w >= 3 * hh) segs.push({ o: 'h', a0: s.x0, a1: s.x1, c: (s.y0 + s.y1) / 2, t: hh });
            else if (filled && w <= 3 && hh >= 3 * w) segs.push({ o: 'v', a0: s.y0, a1: s.y1, c: (s.x0 + s.x1) / 2, t: w });
            else if (stroked) {
              rects.push({ x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, t: lw });
              segs.push({ o: 'h', a0: s.x0, a1: s.x1, c: s.y0, t: lw, frame: true }, { o: 'h', a0: s.x0, a1: s.x1, c: s.y1, t: lw, frame: true }, { o: 'v', a0: s.y0, a1: s.y1, c: s.x0, t: lw }, { o: 'v', a0: s.y0, a1: s.y1, c: s.x1, t: lw });
            }
          });
        }
        cur = null;
      } else if (fn === OPS.endPath) cur = null;
      else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject || fn === OPS.paintImageMaskXObject || fn === OPS.paintInlineImageXObject) {
        const p1 = at(st.ctm, 0, 0);
        const p2 = at(st.ctm, 1, 1);
        if (Math.abs(p2[0] - p1[0]) * Math.abs(p2[1] - p1[1]) > 0.6 * vp.width * vp.height) {
          // A picture over the page covers whatever was drawn before it (the recognised text laid under a scan).
          picture = true;
          image = fn === OPS.paintImageXObject && a && a[1] > 0 && a[2] > 0 && Math.abs(st.ctm[1]) < 1e-6 && Math.abs(st.ctm[2]) < 1e-6 ? { w: a[1], h: a[2], x0: Math.min(p1[0], p2[0]), y0: Math.min(p1[1], p2[1]), x1: Math.max(p1[0], p2[0]), y1: Math.max(p1[1], p2[1]) } : null;
          glyphs.forEach((g) => (g.hidden = true));
          segs.length = 0;
          rects.length = 0;
          blobs.length = 0;
          frames.length = 0;
        }
      }
    }
    return { glyphs, segs, rects, picture, blobs, frames, image };
  }

  /* Box characters. In a symbol font the code decides, whatever character the reader reports for it. */
  const BOX_CHAR = /[☐□▢◻◽❑❒❏❐⬜]/;
  const SYMBOL_FONT = /wingdings|webdings|dingbat/i;
  const SYMBOL_BOX = { wingdings: [0x6f, 0x70, 0x71, 0x72, 0xa8], wingdings2: [0xa3, 0x2a], dingbat: [0x6f, 0x70, 0x71, 0x72] };
  function boxChar(g) {
    if (!g.u) return false;
    if (BOX_CHAR.test(g.u)) return true;
    if (!SYMBOL_FONT.test(g.font)) return false;
    const code = g.u.codePointAt(0);
    const low = code >= 0xf000 && code <= 0xf0ff ? code & 0xff : code;
    const set = /wingdings.?2/i.test(g.font) ? SYMBOL_BOX.wingdings2 : /dingbat/i.test(g.font) ? SYMBOL_BOX.dingbat : /wingdings/i.test(g.font) ? SYMBOL_BOX.wingdings : [];
    return set.indexOf(low) >= 0;
  }

  /**
   * The least number of letter-like drawn shapes (filled, not a plain rectangle, no taller than 40 pt) that makes a
   * page with no visible character a page of drawings. A page of the outlined copies that holds anything printed has
   * well over this many (the fewest measured: 259); an empty page or a page with only a mark or a logo has fewer.
   */
  const LETTER_SHAPES = 40;
  /**
   * A page with no text to read: 'picture' (a picture of a page, as in a scan), 'drawings' (its letters are drawn as
   * shapes, as some "print to PDF" printers make them) or '' (it has text, or it is empty). A page with any visible
   * character is a text page, whatever lies behind it.
   */
  function textless(raw) {
    if (!raw || raw.glyphs.some((g) => !g.hidden && !g.sp)) return '';
    if (raw.picture) return 'picture';
    return (raw.blobs || []).filter((b) => b.y1 - b.y0 <= 40).length >= LETTER_SHAPES ? 'drawings' : '';
  }

  /** What placement reads of one page. raw: from walk(); size: { page, w, h }; forms: the PDF's form fields on it (already in displayed points). */
  function page(raw, size, forms) {
    const out = { page: size.page, w: size.w, h: size.h, items: [], rules: [], boxes: [], forms: [], scan: false };
    if (!raw) return out;
    const shown = raw.glyphs.filter((g) => !g.hidden);
    const ink = shown.filter((g) => !g.sp);
    // A page with no text to read is not read by the rules for text (a page with real text over a background picture
    // is a text page): a picture of the page with no visible text on it (a scan), or a page whose letters are drawn
    // as shapes. Both are read from their picture only when the sponsor asks for it.
    out.scan = !ink.length && !!textless(raw);
    if (out.scan) return out;
    shown.forEach((g) => (g.box = !g.sp && boxChar(g)));
    const words = ink.filter((g) => g.u !== '_' && !g.box);

    // A small square drawn as four separate strokes is a square all the same.
    const drawn = raw.rects.slice();
    const short = raw.segs.filter((sg) => sg.a1 - sg.a0 >= 5 && sg.a1 - sg.a0 <= 20);
    short.forEach((top) => {
      if (top.o !== 'h') return;
      const bottom = short.find((b) => b.o === 'h' && b !== top && b.c - top.c >= 5 && Math.abs(b.c - top.c - (top.a1 - top.a0)) <= 0.25 * (top.a1 - top.a0) && Math.abs(b.a0 - top.a0) <= 1 && Math.abs(b.a1 - top.a1) <= 1);
      if (!bottom) return;
      const side = (x) => short.some((v) => v.o === 'v' && Math.abs(v.c - x) <= 1 && v.a0 <= top.c + 1 && v.a1 >= bottom.c - 1);
      if (side(top.a0) && side(top.a1) && !drawn.some((r) => Math.abs(r.x0 - top.a0) <= 1 && Math.abs(r.y0 - top.c) <= 1)) drawn.push({ x0: top.a0, y0: top.c, x1: top.a1, y1: bottom.c });
    });
    const squares = drawn.filter((r) => r.x1 - r.x0 >= 5 && r.x1 - r.x0 <= 20 && Math.abs(r.x1 - r.x0 - (r.y1 - r.y0)) <= 0.25 * (r.x1 - r.x0));
    /* Runs of text. A run of underscores and a box character each stand alone, so their extents are the printed ones.
       A run never carries on across a drawn square: the words before a box and the words after it are two runs. */
    let cur = null;
    shown.forEach((g) => {
      if (g.sp) {
        if (cur && cur.cat === 'text' && Math.abs(g.y - cur.y) < 0.5 && g.x0 - cur.x1 > -0.3 * g.h && g.x0 - cur.x1 < 1.2 * g.h) cur.s += ' ';
        return;
      }
      const cat = g.box ? 'box' : g.u === '_' ? 'gap' : 'text';
      const gap = cur ? g.x0 - cur.x1 : 0;
      const spaces = cur ? cur.s.length - cur.s.replace(/ +$/, '').length : 0;
      const boxBetween = cur && squares.some((r) => r.x0 >= cur.x1 - 2 && r.x1 <= g.x0 + 2 && r.y0 < g.y + 2 && r.y1 > g.y - g.h);
      if (cur && !boxBetween && cur.cat === cat && cat !== 'box' && Math.abs(g.y - cur.y) < 0.5 && gap > -0.3 * g.h && gap < (cat === 'gap' ? Math.max(0.8, 0.35 * g.h) : (1.2 + 0.6 * spaces) * g.h)) {
        if (cat === 'text' && !spaces && gap > 0.18 * g.h) cur.s += ' ';
        cur.s += g.u;
        cur.x1 = g.x1;
        cur.n++;
        if (g.conf < cur.conf) cur.conf = g.conf;
        return;
      }
      if (cur) cur.s = cur.s.replace(/ +$/, '');
      cur = { cat, s: cat === 'box' ? '☐' : g.u, x: g.x0, x1: g.x1, y: g.y, h: g.h, n: 1, conf: g.conf };
      out.items.push(cur);
    });
    if (cur) cur.s = cur.s.replace(/ +$/, '');
    // A run of recognised text (NS.textread) carries how sure the recognition was of its weakest word.
    out.items = out.items.map((it) => Object.assign({ s: it.s, x: it.x, y: it.y, w: Math.max(0, it.x1 - it.x), h: Math.max(4, it.h) }, it.conf == null ? null : { conf: it.conf }));
    // A page read from its picture (NS.textread) also carries what placement decides it by: found (every box, with
    // its bands and column), lines (every free rule, with its bands), heads (the headings read) and reader (whether
    // the words could be read: 'ok', or why not).
    if (raw.pictured) Object.assign(out, { pictured: raw.pictured, approx: !!raw.approx, found: raw.found || [], words: raw.words || [], lines: raw.lines || [], heads: raw.heads || [], reader: raw.reader || 'ok' });

    /* Tick boxes: box characters, drawn squares with nothing in them, empty bracket pairs. */
    shown.forEach((g) => {
      if (!g.box) return;
      const side = Math.min(g.x1 - g.x0, 0.95 * g.h);
      const cx = (g.x0 + g.x1) / 2;
      out.boxes.push({ x: cx - side / 2, y: g.y - 0.84 * side, w: side, h: 0.9 * side, made: 'character' });
    });
    drawn.forEach((r) => {
      const w = r.x1 - r.x0;
      const hh = r.y1 - r.y0;
      if (w < 5 || w > 20 || Math.abs(w - hh) > 0.25 * w) return;
      if (ink.some((g) => (g.x0 + g.x1) / 2 > r.x0 && (g.x0 + g.x1) / 2 < r.x1 && g.y > r.y0 && g.y - 0.5 * g.h < r.y1)) return;
      if (out.boxes.some((b) => ov(b.x, b.x + b.w, r.x0, r.x1) > 0.5 * w && ov(b.y, b.y + b.h, r.y0, r.y1) > 0.5 * hh)) return;
      out.boxes.push({ x: r.x0, y: r.y0, w, h: hh, made: 'square' });
    });
    for (let i = 0; i < shown.length - 1; i++) {
      const open = shown[i];
      if (open.u !== '[' && open.u !== '(') continue;
      const close = open.u === '[' ? ']' : ')';
      let j = i + 1;
      while (j < shown.length && shown[j].sp && j - i <= 6) j++;
      const end = shown[j];
      if (!end || end.u !== close || Math.abs(end.y - open.y) >= 0.5) continue;
      if (open.u === '(' && j === i + 1) continue;
      if (end.x1 - open.x0 < 5 || end.x1 - open.x0 > 3 * open.h) continue;
      // "(   ) ________": the room for an area code before a blank, not a box.
      if (open.u === '(') {
        let k = j + 1;
        while (k < shown.length && shown[k].sp) k++;
        const next = shown[k];
        if (next && next.u === '_' && Math.abs(next.y - open.y) < 0.5 && next.x0 - end.x1 < 40) continue;
        if (raw.segs.some((sg) => sg.o === 'h' && Math.abs(sg.c - open.y) < 4 && sg.a0 >= end.x1 - 2 && sg.a0 - end.x1 < 40 && sg.a1 - sg.a0 >= 16)) continue;
      }
      out.boxes.push({ x: open.x0, y: open.y - 0.75 * open.h, w: end.x1 - open.x0, h: 0.95 * open.h, made: 'brackets' });
    }

    /* Lines: runs of underscores and drawn rules; pieces that touch on one height are one line. */
    const pieces = [];
    let run = null;
    shown.forEach((g) => {
      if (g.u === '_' && !g.sp) {
        if (run && Math.abs(g.y - run.base) < 0.5 && g.x0 - run.x1 > -0.8 && g.x0 - run.x1 < Math.max(0.8, 0.35 * g.h)) {
          run.x1 = g.x1;
          run.n++;
        } else {
          run = { x0: g.x0, x1: g.x1, base: g.y, y: g.y + 0.12 * g.h, low: g.y + 0.25 * g.h, n: 1, made: 'underscores' };
          pieces.push(run);
        }
      } else run = null;
    });
    // A leader of dots or dashes is a blank when it follows a label on its line and nothing follows it (a leader that
    // ends in a page number or other words is a line of a table of contents).
    let lead = null;
    const leaders = [];
    shown.forEach((g) => {
      const mark = !g.sp && /^[.\-\u2013\u2014\u2017]$/.test(g.u);
      if (mark && lead && lead.u === g.u && Math.abs(g.y - lead.base) < 0.5 && g.x0 - lead.x1 > -0.8 && g.x0 - lead.x1 < 0.6 * g.h) {
        lead.x1 = g.x1;
        lead.n++;
      } else if (mark) {
        lead = { u: g.u, x0: g.x0, x1: g.x1, base: g.y, h: g.h, n: 1 };
        leaders.push(lead);
      } else if (!g.sp) lead = null;
    });
    leaders.forEach((ld) => {
      if (ld.n < (ld.u === '.' ? 8 : 6) || ld.x1 - ld.x0 < 36) return;
      const same = ink.filter((g) => Math.abs(g.y - ld.base) < 0.45 * ld.h);
      if (same.some((g) => g.x0 >= ld.x1 - 0.5)) return;
      if (!same.some((g) => g.x1 <= ld.x0 + 0.5 && ld.x0 - g.x1 < 30 && /[A-Za-z:)]/.test(g.u))) return;
      pieces.push({ x0: ld.x0, x1: ld.x1, base: ld.base, y: ld.base, low: ld.base + 0.5, n: 3, made: 'leader' });
    });
    const hs = raw.segs.filter((s) => s.o === 'h' && s.a1 - s.a0 >= 6);
    const vs = raw.segs.filter((s) => s.o === 'v' && s.a1 - s.a0 >= 6);
    hs.forEach((s) => pieces.push(Object.assign({ x0: s.a0, x1: s.a1, y: s.c, low: s.c + s.t / 2, n: 0, made: 'rule', frame: !!s.frame }, s.bracket ? { bracket: true } : null)));
    pieces.sort((a, b) => a.y - b.y || a.x0 - b.x0);
    const lines = [];
    pieces.forEach((p) => {
      if (p.made === 'underscores' && p.n < 2) return;
      const m = lines.find((l) => !l.frame && !p.frame && Math.abs(l.y - p.y) <= 2.2 && p.x0 - l.x1 <= 3.5 && p.x1 >= l.x0 - 3.5);
      if (m) {
        m.x0 = Math.min(m.x0, p.x0);
        m.x1 = Math.max(m.x1, p.x1);
        m.y = Math.max(m.y, p.y);
        m.low = Math.max(m.low, p.low);
        if (m.made.indexOf(p.made) < 0) m.made += ' and ' + p.made;
        m.n += p.n;
        if (p.bracket) m.bracket = true;
      } else lines.push({ x0: p.x0, x1: p.x1, y: p.y, low: p.low, made: p.made, n: p.n, frame: !!p.frame, bracket: !!p.bracket });
    });
    const drafting = /\[[^\]]*\b(insert|placeholder|to be (completed|inserted|provided|determined|confirmed)|tbd|drafting note|note to draft)\b/i.test(out.items.map((it) => it.s).join(' '));
    const margin = words.length ? Math.min.apply(null, words.map((g) => g.x0)) : 0;
    const body = words.length ? words.map((g) => g.h).sort((a, b) => a - b)[Math.floor(words.length / 2)] : 10;
    const sameLine = (g, l) => Math.abs(g.y - (l.y - (l.made.indexOf('underscores') >= 0 ? 0.12 * g.h : 0))) < 0.45 * g.h + 2;
    const emptyAbove = (x0, x1, y) => {
      let clear = 60;
      ink.forEach((g) => {
        if (g.u === '_' || ov(g.x0, g.x1, x0, x1) <= 0) return;
        const d = y - g.y;
        if (d >= 0.35 * g.h + 1.5 && d - 0.25 * g.h < clear) clear = d - 0.25 * g.h;
      });
      return clear;
    };
    lines.forEach((l) => {
      const w = l.x1 - l.x0;
      const typed = l.made.indexOf('underscores') >= 0 || l.made.indexOf('leader') >= 0;
      if (w < 9 || (l.made === 'underscores' && l.n < 3)) return;
      // Between square brackets. It is the sponsor's own placeholder, and no place, when the brackets also enclose
      // words, when the line stands in running prose, or when the page carries a drafting note in brackets ("[insert
      // ...]", "[Placeholder ...]"). Otherwise the brackets are the agreement's way of printing a blank or a box: kept, and marked.
      const beside = ink.filter((g) => g.u !== '_' && sameLine(g, l)).sort((a, b) => a.x0 - b.x0);
      const left = beside.filter((g) => g.x1 <= l.x0 + 1).sort((a, b) => b.x1 - a.x1)[0];
      const right = beside.filter((g) => g.x0 >= l.x1 - 1).sort((a, b) => a.x0 - b.x0)[0];
      // (a line read from a picture says itself that it stands in brackets: NS.textread finds them from the pixels)
      const open = l.bracket || (left && left.u === '[' && l.x0 - left.x1 < 12);
      const close = l.bracket || (right && right.u === ']' && right.x0 - l.x1 < 12);
      let bracketed = false;
      if (open || close) {
        if (drafting || open !== close) return;
        const before = beside.filter((g) => g.x1 <= (left ? left.x0 : l.x0) + 0.5);
        const after = beside.filter((g) => g.x0 >= (right ? right.x1 : l.x1) - 0.5);
        const lastBefore = before[before.length - 1];
        // Running prose: a dozen letters or more before it and words after it, on a line with no other bracketed blank
        // (a row of them is a row of boxes).
        const letters = (list) => list.filter((g) => /[A-Za-z]/.test(g.u)).length;
        const row = before.some((g) => g.u === ']') || after.some((g) => g.u === '[');
        if (!row && letters(before) >= 12 && letters(after) > 3 && lastBefore && !/[:$]/.test(lastBefore.u)) return;
        // "[________] L.P./LLC": a name the sponsor completes (the fund's, a company's), never the investor's blank.
        if (!row && /^[\],\s]*(l\.?\s?p|l\.?\s?l\.?\s?c|inc|ltd|corp)\.?(?![a-z])/i.test(after.slice(0, 12).map((g) => g.u).join(''))) return;
        bracketed = true;
      }
      // Walls: a rule with upright strokes meeting it is the edge of a table or a frame. Its empty cells are blanks.
      const walls = vs.filter((v) => v.c >= l.x0 - 1.5 && v.c <= l.x1 + 1.5 && v.a0 <= l.y + 1.5 && v.a1 >= l.y - 1.5);
      if (!typed && (l.frame || walls.length >= 2)) {
        const up = walls.filter((v) => v.a0 < l.y - 5).map((v) => v.c).sort((a, b) => a - b).filter((c, i, all) => !i || c - all[i - 1] > 2);
        for (let i = 0; i + 1 < up.length; i++) {
          const a = up[i];
          const b = up[i + 1];
          if (b - a < 16) continue;
          const roof = hs.filter((s) => s.c < l.y - 6 && s.c > l.y - 80 && ov(s.a0, s.a1, a, b) > 0.5 * (b - a)).sort((p, q) => q.c - p.c)[0];
          const top = roof ? roof.c : l.y - 20;
          if (ink.some((g) => (g.x0 + g.x1) / 2 > a && (g.x0 + g.x1) / 2 < b && g.y > top && g.y - 0.4 * g.h < l.y + 1)) continue;
          // On a page read from its picture a line printed in the cell is print in it too (its characters are a stroke there).
          if (raw.pictured && lines.some((o) => o !== l && !o.frame && o.y > top + 1 && o.y < l.y - 1 && o.x0 >= a - 1 && o.x1 <= b + 1)) continue;
          out.rules.push({ x0: a + 2, x1: b - 2, y: l.y, clear: Math.max(0, l.y - top - 1), made: 'cell', cut: false, cell: true, table: true });
        }
        return;
      }
      let x0 = l.x0;
      let cut = false;
      // Characters standing on the line (most of each over it). On a drawn rule they are an underlined word or heading,
      // or a label whose rule runs on after it: then the blank starts where the words end. Anything else written on a
      // line is an answer already given, and an answered blank gets no field.
      const dotted = l.made.indexOf('leader') >= 0;
      const on = words.filter((g) => !(dotted && /^[.\-\u2013\u2014\u2017]$/.test(g.u)) && l.y - g.y > -1.5 && l.y - g.y < 0.35 * g.h + 1.5 && ov(g.x0, g.x1, l.x0, l.x1) > 0.5 * (g.x1 - g.x0));
      if (on.length) {
        const covered = on.reduce((s, g) => s + Math.max(0, ov(g.x0, g.x1, l.x0, l.x1)), 0);
        const first = Math.min.apply(null, on.map((g) => g.x0));
        const end = Math.max.apply(null, on.map((g) => g.x1));
        if (typed || covered >= 0.45 * w || first > l.x0 + 6 || l.x1 - end < 36) return;
        x0 = end + 4;
        cut = true;
      }
      const clear = emptyAbove(x0, l.x1, l.y);
      if (l.made === 'rule') {
        // A footnote rule: a short rule at the left margin in the lower part of the page, empty paper above it and small
        // print under it that opens with a footnote mark. (A short rule with a small caption under it is a signature line.)
        const under = words.filter((g) => g.y - l.y > 2 && g.y - l.y < 16 && ov(g.x0, g.x1, l.x0, l.x1) > 0).sort((a, b) => a.y - b.y || a.x0 - b.x0);
        if (w > 100 && w < 200 && Math.abs(l.x0 - margin) <= 8 && l.y > 0.45 * size.h && under.length && under.every((g) => g.h < 0.93 * body) && /^[0-9*\u2020\u2021\u00A7(]/.test(under[0].u) && clear > 10) return;
        // A rule right across the page near its head or foot: a running rule.
        if (w > 0.7 * size.w && (l.y > 0.9 * size.h || l.y < 0.08 * size.h)) return;
      }
      out.rules.push({ x0, x1: l.x1, y: l.y, low: l.low, clear, made: l.made, cut, cell: false, table: walls.length > 0, bracketed });
    });
    // Empty paper above a line ends at the next printed line above it, too.
    out.rules.forEach((r) => {
      out.rules.forEach((o) => {
        if (o !== r && o.y < r.y - 2 && ov(o.x0, o.x1, r.x0, r.x1) > 0) r.clear = Math.min(r.clear, r.y - o.y - 2.5);
      });
    });
    // How far a field may reach past each end of its line and under it, so that the line's own ink lies inside the
    // field: about a point, less where something else is printed closer than that.
    out.rules.forEach((r) => {
      if (r.cell) return (r.pad = { l: 0, r: 0, d: 0 });
      let l = 1;
      let rt = 1;
      // Under the line: to just below the lowest its ink can reach (an underscore hangs lower in some fonts than in others).
      let d = Math.max(1.5, (r.low || r.y) - r.y + 0.6);
      ink.forEach((g) => {
        if (g.u === '_' && Math.abs(g.y + 0.12 * g.h - r.y) < 1 && g.x0 >= r.x0 - 0.5 && g.x1 <= r.x1 + 0.5) return; // the line's own characters
        const top = g.y - 0.75 * g.h;
        if (top < r.y + 0.5 && g.y + 0.25 * g.h > r.y - 2) {
          if (g.x1 <= r.x0 + 0.5) l = Math.min(l, Math.max(0, r.x0 - g.x1 - 0.3));
          else if (g.x0 >= r.x1 - 0.5) rt = Math.min(rt, Math.max(0, g.x0 - r.x1 - 0.3));
        } else if (top >= r.y + 0.5 && ov(g.x0, g.x1, r.x0 - 1, r.x1 + 1) > 0) d = Math.min(d, Math.max(0, top - r.y - 0.3));
      });
      r.pad = { l, r: rt, d };
    });

    /* The PDF's own form fields: each is a place, and nothing else is read where one stands. */
    (forms || []).forEach((f) => {
      if (!f || !(f.x1 - f.x0 > 2) || !(f.y1 - f.y0 > 2)) return;
      out.forms.push(f);
    });
    if (out.forms.length) {
      const inForm = (x0, x1, y0, y1) => out.forms.some((f) => ov(f.x0 - 2, f.x1 + 2, x0, x1) > 0 && ov(f.y0 - 2, f.y1 + 2, y0, y1) > 0);
      out.rules = out.rules.filter((r) => !inForm(r.x0, r.x1, r.y - 1, r.y + 1));
      out.boxes = out.boxes.filter((b) => !inForm(b.x, b.x + b.w, b.y, b.y + b.h));
    }
    return out;
  }

  NS.anchors = { walk, page, textless };
})(typeof window !== 'undefined' ? window.CVPortal : globalThis.CVPortal);
