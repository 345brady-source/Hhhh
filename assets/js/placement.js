/*
 * Field placement: reads where an agreement's signature lines are printed and proposes a field for each.
 *
 * This file works on plain data only. It never touches the document, the window or any other part of the portal
 * when it loads, so it can also be loaded outside a browser for checks.
 *
 * All coordinates are PDF points of the page as displayed, origin top-left, y downwards.
 *
 *   scan(rgba, width, height, scale)   printed horizontal lines found in a page's pixels
 *   analyze(pages, ctx)                proposed fields for the blanks of each signature block
 *   labelOf(text)                      what a short piece of text asks for, or null
 *   needsReview(field)                 whether a placed field still has to be confirmed by the sponsor
 */
(function (NS) {
  'use strict';

  /* ---------- Reading printed lines from pixels ---------- */
  const DARK = 160; // a pixel is ink when its luminance is under this
  const BRIDGE = 2; // px: gaps this small inside a run of ink are bridged
  const MIN_RULE = 16; // pt: shorter runs are letter feet, not lines
  const MAX_THICK = 3; // pt: anything thicker is a bar, shading or a picture
  const MAX_CLEAR = 60; // pt: how far up empty paper is measured
  const BLANK_CLEAR = 7; // pt of empty paper above a line that makes it a blank to write on

  /**
   * Horizontal printed lines in a page image. rgba is the page's pixels (4 bytes each), scale is pixels per point.
   * Returns { rules: [{ x0, x1, y, t, clear }], boxes: [] } in points: y is the centre of the stroke, t its thickness
   * and clear the height of empty paper directly above it. Underlines and letter feet have ink right above them
   * (clear near zero); a blank does not. Where only part of a line has ink above it, the clear stretches are
   * returned as separate lines.
   */
  function scan(rgba, width, height, scale) {
    const out = { rules: [], boxes: [] };
    const k = scale > 0 ? scale : 1;
    if (!rgba || !(width > 0) || !(height > 0) || rgba.length < width * height * 4) return out;
    const ink = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < ink.length; i++, p += 4) {
      if (rgba[p + 3] > 127 && rgba[p] * 0.299 + rgba[p + 1] * 0.587 + rgba[p + 2] * 0.114 < DARK) ink[i] = 1;
    }
    const minLen = Math.max(4, Math.round(MIN_RULE * k));
    const done = [];
    let prev = [];
    for (let y = 0; y < height; y++) {
      const row = y * width;
      const cur = [];
      let x = 0;
      while (x < width) {
        if (!ink[row + x]) {
          x++;
          continue;
        }
        const start = x;
        let last = x;
        x++;
        while (x < width && x - last <= BRIDGE + 1) {
          if (ink[row + x]) last = x;
          x++;
        }
        if (last - start + 1 < minLen) continue;
        // The same stroke as a run in the row above when they overlap by 80%.
        const at = prev.findIndex((r) => !r.hit && (Math.min(r.x1, last) - Math.max(r.x0, start) + 1) / Math.max(r.x1 - r.x0 + 1, last - start + 1) >= 0.8);
        if (at >= 0) {
          const r = prev[at];
          r.hit = true;
          cur.push({ x0: Math.min(r.x0, start), x1: Math.max(r.x1, last), y0: r.y0, y1: y, hit: false });
        } else cur.push({ x0: start, x1: last, y0: y, y1: y, hit: false });
      }
      prev.forEach((r) => !r.hit && done.push(r));
      prev = cur;
    }
    prev.forEach((r) => done.push(r));

    const cap = Math.round(MAX_CLEAR * k);
    /** Rows of empty paper above row top across x0..x1 (a row with more than 1% ink ends it). */
    const clearAbove = (x0, x1, top) => {
      const allow = (x1 - x0 + 1) * 0.01;
      let rows = 0;
      for (let y = top - 1; y >= 0 && rows < cap; y--) {
        const row = y * width;
        let n = 0;
        for (let x = x0; x <= x1; x++) n += ink[row + x];
        if (n > allow) break;
        rows++;
      }
      return rows;
    };
    const need = Math.ceil(BLANK_CLEAR * k);
    const emit = (r, x0, x1, clear) => out.rules.push({ x0: x0 / k, x1: (x1 + 1) / k, y: (r.y0 + r.y1 + 1) / 2 / k, t: (r.y1 - r.y0 + 1) / k, clear: clear / k });
    done.forEach((r) => {
      if (r.y1 - r.y0 + 1 > MAX_THICK * k) return;
      const clear = clearAbove(r.x0, r.x1, r.y0);
      if (clear >= need) return emit(r, r.x0, r.x1, clear);
      // Ink sits above part of the line: keep the stretches that have empty paper above them.
      const from = Math.max(0, r.y0 - need);
      let parts = 0;
      let s = -1;
      for (let x = r.x0; x <= r.x1 + 1; x++) {
        let free = x <= r.x1;
        for (let y = r.y0 - 1; free && y >= from; y--) if (ink[y * width + x]) free = false;
        if (free && r.y0 - from < need) free = false;
        if (free && s < 0) s = x;
        if (!free && s >= 0) {
          if (x - s >= minLen) {
            emit(r, s, x - 1, clearAbove(s, x - 1, r.y0));
            parts++;
          }
          s = -1;
        }
      }
      if (!parts) emit(r, r.x0, r.x1, clear);
    });
    out.rules.sort((a, b) => a.y - b.y || a.x0 - b.x0);
    return out;
  }

  /* ---------- Text: pieces and printed lines ---------- */
  const MAX_LABEL = 90; // characters: longer text is never a label, and no pattern runs on it
  const SIZES = { signature: { w: 180, h: 42 }, date: { w: 110, h: 20 }, name: { w: 170, h: 20 }, text: { w: 170, h: 20 } };
  const tidy = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
  /** A label as stored on a field: one line, no control characters, at most 60 characters. */
  const clean = (s) => tidy(s).slice(0, 60);
  /** Rough relative width of a character, for estimating where a part of a text run sits. */
  function charW(ch) {
    if (ch === ' ' || ch === ' ') return 0.5;
    if ('ijlt.,:;\'|!()[]'.indexOf(ch) >= 0) return 0.55;
    if (ch === 'm' || ch === 'w') return 1.45;
    if (ch === 'M' || ch === 'W') return 1.7;
    if (ch >= 'A' && ch <= 'Z') return 1.3;
    if (ch >= 'a' && ch <= 'z') return 0.9;
    return 1;
  }
  /**
   * A text run cut into its words and its underscore blanks, each with an estimated extent (characters placed in
   * proportion to the run's width). Returns [{ s, x0, x1, y, h, gap }]; gap is true for a run of underscores.
   */
  function pieces(it) {
    const s = String(it.s == null ? '' : it.s);
    const widths = Array.from(s).map(charW);
    const total = widths.reduce((a, b) => a + b, 0) || 1;
    const unit = (it.w || 0) / total;
    const out = [];
    const re = /_{3,}/g;
    const add = (from, to, gap) => {
      // Trim the white space at both ends of a text part.
      while (!gap && from < to && /\s/.test(s[from])) from++;
      while (!gap && to > from && /\s/.test(s[to - 1])) to--;
      if (to <= from) return;
      let a = 0;
      for (let i = 0; i < from; i++) a += widths[i];
      let b = a;
      for (let i = from; i < to; i++) b += widths[i];
      out.push({ s: gap ? '' : tidy(s.slice(from, to)), x0: it.x + a * unit, x1: it.x + b * unit, y: it.y, h: it.h || 10, gap });
    };
    let at = 0;
    let m;
    while ((m = re.exec(s))) {
      add(at, m.index, false);
      add(m.index, m.index + m[0].length, true);
      at = m.index + m[0].length;
    }
    add(at, s.length, false);
    return out;
  }
  /** A page's pieces grouped into printed lines (same baseline within half the font height), each ordered left to right. */
  function linesOf(page) {
    const all = [];
    (page.items || []).forEach((it) => {
      if (!it || !isFinite(it.x) || !isFinite(it.y)) return;
      pieces(it).forEach((p) => all.push(p));
    });
    all.sort((a, b) => a.y - b.y || a.x0 - b.x0);
    const lines = [];
    all.forEach((p) => {
      const ln = lines.length ? lines[lines.length - 1] : null;
      if (ln && Math.abs(p.y - ln.y) <= 0.5 * Math.min(p.h, ln.h)) ln.parts.push(p);
      else lines.push({ y: p.y, h: p.h, parts: [p] });
    });
    lines.forEach((ln) => {
      ln.parts.sort((a, b) => a.x0 - b.x0);
      ln.text = tidy(ln.parts.filter((p) => !p.gap).map((p) => p.s).join(' '));
    });
    return lines;
  }

  /* ---------- Labels ---------- */
  /** Text as compared with the label patterns: one line, no list marker, bracketed remark or closing colon, lower case. */
  function plain(text) {
    return tidy(text)
      .replace(/^(\(?[0-9a-z]{1,3}[.)]|[•·▪■○●*-])\s+/i, '')
      .replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ')
      .replace(/\s*:\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  const SIGNATURE_RE = /^(by|(authori[sz]ed )?signature|signature of (the )?(subscriber|investor|purchaser|authori[sz]ed signatory))$/;
  const INVESTOR_WORDS = /\b(subscribers?|investors?|purchasers?|limited partners?)\b/;
  const FIRM_WORDS = /\baccepted\b|\bgeneral partner\b|\bmanaging member\b|\bmanager\b|\bsponsor\b/;
  /** Whose words a piece of text uses: 'investor', 'firm' or ''. */
  function whoIn(t) {
    if (FIRM_WORDS.test(t)) return 'firm';
    return INVESTOR_WORDS.test(t) ? 'investor' : '';
  }
  /**
   * What a short piece of text asks for: { kind, who } or null. kind is 'signature'; who is 'investor' or 'firm'
   * when the words themselves say whose it is, otherwise ''.
   */
  function labelOf(text) {
    const raw = tidy(text);
    if (!raw || raw.length > MAX_LABEL) return null;
    const t = plain(raw);
    if (SIGNATURE_RE.test(t)) return { kind: 'signature', who: whoIn(t) };
    return null;
  }

  /* ---------- Blanks to proposed fields ---------- */
  const NO_LINE = 'No signature line could be read in this PDF, so this was placed at the foot of the last page. Move it to where it belongs.';
  const UNSURE_WHO = 'Could not tell whether the investor or your firm fills this in.';
  /** The nearest short heading above y on the page: 'investor', 'firm' or ''. Sentences never count as headings. */
  function headingAbove(lines, y) {
    let who = '';
    lines.forEach((ln) => {
      if (ln.y >= y - 2) return;
      const s = ln.text;
      if (!s || s.length > 60 || /[.;?!]$/.test(s)) return;
      const caps = /[A-Z]/.test(s) && s === s.toUpperCase();
      if (!caps && !/:$/.test(s)) return;
      const w = whoIn(s.toLowerCase());
      if (w) who = w;
    });
    return who;
  }
  /** The label of a printed blank: the text that ends just left of it on the same printed line. */
  function labelLeft(lines, r) {
    let best = null;
    lines.forEach((ln) => {
      ln.parts.forEach((p, i) => {
        if (p.gap || r.y < p.y - 0.3 * p.h || r.y > p.y + 0.9 * p.h) return;
        const next = ln.parts[i + 1];
        // A run that holds label and underscores together: the label is the part before the underscores.
        const joined = next && next.gap && Math.min(next.x1, r.x1) - Math.max(next.x0, r.x0) > 0.5 * Math.min(next.x1 - next.x0, r.x1 - r.x0);
        const near = p.x1 <= r.x0 + 3 && r.x0 - p.x1 <= 36;
        if (!joined && !near) return;
        if (!best || p.x1 > best.x1) best = p;
      });
    });
    return best;
  }
  /**
   * Proposed fields for the signature blanks of an agreement.
   * pages: [{ page, w, h, items: [{ s, x, y, w, h }], rules, boxes }]; ctx: { countersign, firmNames, fundNames }.
   * Returns [{ type, role: 'investor' | 'firm', page, x, y, w, h, label, required, conf, why, forType }].
   */
  function analyze(pages, ctx) {
    const c = ctx || {};
    const out = [];
    (pages || []).forEach((pg) => {
      const lines = linesOf(pg);
      (pg.rules || []).forEach((r) => {
        if (!r || !(r.clear >= BLANK_CLEAR) || !(r.x1 - r.x0 >= MIN_RULE)) return;
        const lab = labelLeft(lines, r);
        const kind = lab ? labelOf(lab.s) : null;
        if (!kind) return;
        const who = kind.who || headingAbove(lines, r.y);
        const w = Math.min(220, r.x1 - r.x0);
        const hh = Math.min(42, r.clear + 4);
        out.push({ type: 'signature', role: who || 'investor', page: pg.page, x: r.x0, y: r.y + 4 - hh, w, h: hh, label: '', required: true, conf: who ? 'high' : 'medium', why: who ? '' : UNSURE_WHO });
      });
    });
    // No signature line found for a signer (a scanned PDF, say): a standard block at the foot of the last page.
    const last = (pages || [])[(pages || []).length - 1];
    if (last) {
      const block = (role, top) => {
        if (out.some((p) => p.role === role && p.type === 'signature')) return;
        [['signature', 0.1, top], ['name', 0.1, top + 0.07], ['date', 0.62, top + 0.02]].forEach(([type, fx, fy]) => {
          out.push({ type, role, page: last.page, x: fx * last.w, y: fy * last.h, w: SIZES[type].w, h: SIZES[type].h, label: '', required: true, conf: 'low', why: NO_LINE });
        });
      };
      block('investor', 0.66);
      if (c.countersign) block('firm', 0.82);
    }
    out.forEach((p) => (p.label = clean(p.label)));
    return out;
  }

  /** True while a field the portal placed itself is below high confidence and the sponsor has not confirmed it. */
  function needsReview(field) {
    return !!(field && field.auto && (field.conf === 'medium' || field.conf === 'low') && !field.confirmed);
  }

  NS.placement = { scan, analyze, labelOf, needsReview };
})(window.CVPortal);
