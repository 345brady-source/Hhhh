/*
 * Report page composer (plan 12-03): draws one report layout model (plan 12-02's resolve) as a portrait US Letter PDF in
 * the firm's brand, with the PDF writer and Unicode font the portal already ships; nothing is fetched. It draws the
 * model's strings exactly as given and never formats a number itself.
 *
 *   NS.reportsPdf.PAGE                          { W: 612, H: 792, M: 54 } (points; 0.75 inch margins)
 *   NS.reportsPdf.compose(model, { kit, images, logo }) → Promise<Uint8Array> with .pages
 *   NS.reportsPdf.logoFor(tenant) → Promise<LogoArt>
 *
 * Phase 11's landscape table writer (filesout.js) is left as it is; this composer sits beside it.
 */
(function (global) {
  'use strict';
  const NS = (global.CVPortal = global.CVPortal || {});

  const PAGE = { W: 612, H: 792, M: 54 };
  const TW = PAGE.W - 2 * PAGE.M; // the text width
  const TOP = PAGE.H - PAGE.M; // body text starts here; the header sits in the top margin
  const FLOOR = PAGE.M; // body text stops here; the footer sits in the bottom margin
  const INK = '#1A1D21';
  const MUTE = '#5E646B';
  const RULE = '#D5D8DC';
  const WHITE = '#FFFFFF';
  const NUMERIC = { money: 1, pct: 1, ratio: 1, price: 1, int: 1 };
  const PAD = 4;
  const VPAD = 2.5;

  const HERE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  /** The shipped bold font data, beside this file (assets/vendor/textfont/text-bold.js). */
  const BOLD_JS = (() => {
    try {
      return HERE ? new URL('../vendor/textfont/text-bold.js', HERE).href : '';
    } catch (e) {
      return '';
    }
  })();

  /* ---------- small helpers ---------- */

  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  /** Base64 text as bytes (no atob: the composer also runs where there is none). */
  function fromBase64(s) {
    const t = String(s || '').replace(/[^A-Za-z0-9+/]/g, '');
    const out = new Uint8Array(Math.floor((t.length * 3) / 4));
    let o = 0;
    for (let i = 0; i + 1 < t.length; i += 4) {
      const n = (B64.indexOf(t[i]) << 18) | (B64.indexOf(t[i + 1]) << 12) | ((i + 2 < t.length ? B64.indexOf(t[i + 2]) : 0) << 6) | (i + 3 < t.length ? B64.indexOf(t[i + 3]) : 0);
      out[o++] = (n >> 16) & 255;
      if (i + 2 < t.length && o < out.length) out[o++] = (n >> 8) & 255;
      if (i + 3 < t.length && o < out.length) out[o++] = n & 255;
    }
    return out;
  }
  function hex(h, fallback) {
    const s = String(h || '').trim().replace(/^#/, '');
    const six = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
    return /^[0-9a-f]{6}$/i.test(six) ? '#' + six.toUpperCase() : fallback || null;
  }
  const rgb01 = (h) => [1, 3, 5].map((i) => parseInt(hex(h, '#000000').slice(i, i + 2), 16) / 255);
  function lum(h) {
    const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const [r, g, b] = rgb01(h).map(f);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const B = () => NS.brand || {};
  const contrast = (a, b) => (B().contrast ? B().contrast(a, b) : (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05));
  const onColor = (bg) => (B().onColor ? B().onColor(bg) : contrast(WHITE, bg) >= 4.5 ? WHITE : '#0B1622');
  function mix(a, b, t) {
    if (B().mix) return B().mix(a, b, t);
    const A = rgb01(a);
    const C = rgb01(b);
    return '#' + A.map((v, i) => Math.round((v + (C[i] - v) * t) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  /** A string as it can be drawn: tabs become spaces, other control characters go. */
  function clean(s) {
    let t = '';
    for (const ch of String(s == null ? '' : s)) {
      const cp = ch.codePointAt(0);
      if (cp === 9 || cp === 10 || cp === 13) t += ' ';
      else if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
      else t += ch;
    }
    return t;
  }

  /* ---------- the writer, the fonts ---------- */

  async function kitOf(kit) {
    kit = kit || {};
    const E = NS.esignKit || {};
    const L = kit.PDFLib || (E.writer ? await E.writer() : null);
    let fontkit = kit.fontkit;
    let fontBytes = kit.fontBytes;
    if (!fontkit || !fontBytes) {
      if (!E.unicodeFont) throw new Error('The PDF writer is not on this page');
      ({ fontkit, fontBytes } = await E.unicodeFont());
    }
    if (!L) throw new Error('The PDF writer is not on this page');
    let boldBytes = kit.boldBytes;
    if (!boldBytes) {
      const have = () => !!(NS.fontData && typeof NS.fontData.bold === 'string');
      if (!have() && E.loadScript && BOLD_JS) {
        try {
          await E.loadScript(BOLD_JS, have);
        } catch (e) {
          /* no bold font: the regular font filled and outlined stands in */
        }
      }
      if (have()) boldBytes = (E.fromBase64 || fromBase64)(NS.fontData.bold);
    }
    return { L, fontkit, fontBytes, boldBytes };
  }

  /* ---------- logos ---------- */

  async function logoFor(tenant) {
    const t = tenant || {};
    const colors = t.colors || {};
    const P = hex(colors.primary, '#1F3A5F');
    return { kind: 'name', text: String(t.shortName || t.name || ''), color: P };
  }

  /* ---------- the composer ---------- */

  async function compose(model, opts) {
    opts = opts || {};
    const m = model || {};
    const firm = m.firm || {};
    const support = firm.support || {};
    const cover = m.cover || {};
    const meta = m.meta || {};
    const blocks = Array.isArray(m.blocks) ? m.blocks : [];
    const images = opts.images || {};
    const PRIMARY = hex(firm.colors && firm.colors.primary, '#1F3A5F');
    const ACCENT = hex(firm.colors && firm.colors.accent, PRIMARY);
    const logo = opts.logo || (await logoFor({ name: firm.name, shortName: firm.name, logo: firm.logo, colors: firm.colors }));

    const K = await kitOf(opts.kit);
    const L = K.L;
    const out = await L.PDFDocument.create();
    out.registerFontkit(K.fontkit);
    // Ligatures off, so every character is its own glyph: measured widths match drawn widths and text reads back as typed.
    const embed = async (bytes) => {
      const f = await out.embedFont(bytes, { subset: true, features: { liga: false } });
      const cs = new Set(f.getCharacterSet());
      const cache = new Map();
      const width = (s, size) => {
        let w = 0;
        for (const ch of s) {
          let u = cache.get(ch);
          if (u === undefined) cache.set(ch, (u = f.widthOfTextAtSize(ch, 1000)));
          w += u;
        }
        return (w * size) / 1000;
      };
      return { f, has: (cp) => cs.has(cp), width };
    };
    const reg = await embed(K.fontBytes);
    const bold = K.boldBytes ? await embed(K.boldBytes) : null;
    const fontOf = (b) => (b && bold) || reg;
    const color = (h) => {
      const [r, g, b] = rgb01(h);
      return L.rgb(r, g, b);
    };
    const width = (s, size, b) => fontOf(b).width(s, size);

    let missingImages = 0;
    const pages = [];
    let page = null;
    let y = TOP;
    let atTop = true;

    /** One piece of text; b bold (the regular font filled and outlined when there is no bold font), i italic (a 12 degree slant). */
    const text = (s, x, base, size, b, col, i) => {
      if (!s) return;
      const o = { x, y: base, size, font: fontOf(b).f, color: color(col || INK) };
      // the writer's ySkew moves the top of each glyph sideways (a slant); its xSkew would tilt the baseline
      if (i) o.ySkew = L.degrees(12);
      if (b && !bold) {
        page.pushOperators(L.pushGraphicsState(), L.setTextRenderingMode(L.TextRenderingMode.FillAndOutline), L.setLineWidth(size * 0.04), L.setStrokingColor(o.color));
        page.drawText(s, o);
        page.pushOperators(L.popGraphicsState());
      } else page.drawText(s, o);
    };
    const cutTo = (s, size, b, w) => {
      if (width(s, size, b) <= w) return s;
      const cps = Array.from(s);
      while (cps.length && width(cps.join('') + '…', size, b) > w) cps.pop();
      return cps.join('').replace(/\s+$/, '') + '…';
    };
    /** Lines of one string inside width w: broken at spaces, a word wider than w broken between characters. */
    const wrap = (s, size, b, w) => {
      const lines = [];
      let line = '';
      clean(s)
        .split(/ +/)
        .forEach((word) => {
          const tryLine = line ? line + ' ' + word : word;
          if (width(tryLine, size, b) <= w) return (line = tryLine);
          if (line) lines.push(line);
          let cps = Array.from(word);
          while (cps.length > 1 && width(cps.join(''), size, b) > w) {
            let k = 1;
            while (k < cps.length && width(cps.slice(0, k + 1).join(''), size, b) <= w) k++;
            lines.push(cps.slice(0, k).join(''));
            cps = cps.slice(k);
          }
          line = cps.join('');
        });
      if (line || !lines.length) lines.push(line);
      return lines;
    };
    /**
     * Lines of styled runs [{ s, b, i }] inside width w. Words are kept whole across a change of style (a full stop after
     * an italic word stays with it). Each line: [{ s, b, i, w }] with neighbouring pieces of one style joined.
     */
    const wrapRuns = (runs, size, w) => {
      const units = [];
      let unit = null;
      let space = null;
      (runs || []).forEach((r) => {
        const b = !!r.b;
        const i = !!r.i;
        clean(r.s)
          .split(/( +)/)
          .forEach((tok) => {
            if (!tok) return;
            if (/^ +$/.test(tok)) {
              if (unit) units.push(unit);
              unit = null;
              space = { s: ' ', b, i };
              return;
            }
            if (!unit) {
              unit = { space: units.length ? space : null, parts: [] };
              space = null;
            }
            unit.parts.push({ s: tok, b, i });
          });
      });
      if (unit) units.push(unit);
      const lines = [];
      let line = [];
      let lw = 0;
      const uw = (u) => u.parts.reduce((a, p) => a + width(p.s, size, p.b), 0);
      units.forEach((u) => {
        const sw = line.length && u.space ? width(' ', size, u.space.b) : 0;
        const ww = uw(u);
        if (line.length && lw + sw + ww > w) {
          lines.push(line);
          line = [];
          lw = 0;
        }
        if (line.length && u.space) {
          line.push({ s: ' ', b: u.space.b, i: u.space.i });
          lw += sw;
        }
        if (ww > w) {
          // a word wider than the line: broken between characters
          u.parts.forEach((p) => {
            Array.from(p.s).forEach((ch) => {
              const cw = width(ch, size, p.b);
              if (line.length && lw + cw > w) {
                lines.push(line);
                line = [];
                lw = 0;
              }
              line.push({ s: ch, b: p.b, i: p.i });
              lw += cw;
            });
          });
        } else {
          u.parts.forEach((p) => line.push({ s: p.s, b: p.b, i: p.i }));
          lw += ww;
        }
      });
      if (line.length) lines.push(line);
      return lines.map((ln) => {
        const joined = [];
        ln.forEach((p) => {
          const last = joined[joined.length - 1];
          if (last && last.b === p.b && last.i === p.i) last.s += p.s;
          else joined.push({ s: p.s, b: p.b, i: p.i });
        });
        joined.forEach((p) => (p.w = width(p.s, size, p.b)));
        return joined;
      });
    };
    const drawRunLine = (ln, x, base, size, col) => {
      ln.forEach((p) => {
        text(p.s, x, base, size, p.b, col, p.i);
        x += p.w;
      });
    };
    const rect = (x, yy, w, h, col) => page.drawRectangle({ x, y: yy, width: w, height: h, color: color(col) });
    const line = (x1, y1, x2, y2, t, col) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color: color(col) });

    /* ----- the lockup: logo and firm name ----- */

    /** Draws the logo with its top at `top`, height h, at x; returns its width. onBand: the colors for a colored ground. */
    const drawLogo = (x, top, h, onBand) => {
      if (logo.kind === 'name') {
        const size = h * 0.8;
        text(clean(logo.text), x, top - h * 0.78, size, true, onBand ? onColor(onBand) : hex(logo.color, PRIMARY));
        return width(clean(logo.text), size, true);
      }
      return 0;
    };
    /** Logo, then the firm's name beside it (unless the logo is the name). */
    const lockup = (x, top, h, nameSize, onBand) => {
      const lw = drawLogo(x, top, h, onBand);
      if (logo.kind !== 'name' && firm.name) {
        const nx = x + (lw ? lw + h * 0.35 : 0);
        text(cutTo(clean(firm.name), nameSize, true, PAGE.W - PAGE.M - nx), nx, top - h / 2 - nameSize * 0.35, nameSize, true, onBand ? onColor(onBand) : PRIMARY);
      }
    };

    /* ----- pages ----- */

    const header = () => {
      const top = PAGE.H - 30;
      lockup(PAGE.M, top, 14, 8.5, null);
      const t = cutTo(clean(m.title || ''), 8.5, false, TW * 0.45);
      text(t, PAGE.W - PAGE.M - width(t, 8.5, false), top - 10.5, 8.5, false, MUTE);
      line(PAGE.M, top - 19, PAGE.W - PAGE.M, top - 19, 0.75, PRIMARY);
    };
    const newPage = () => {
      page = out.addPage([PAGE.W, PAGE.H]);
      pages.push(page);
      header();
      y = TOP;
      atTop = true;
    };
    /** Room for h points below y, else a new page (never a new page for a page still empty). */
    const need = (h) => {
      if (y - h < FLOOR && !atTop) newPage();
    };

    const supportLines = () => [firm.legalName || firm.name, support.team, support.email, support.phone].map(clean).filter(Boolean);

    const drawCover = () => {
      page = out.addPage([PAGE.W, PAGE.H]);
      pages.push(page);
      const style = cover.style === 'plain' || cover.style === 'photo' ? cover.style : 'band';
      const band = hex(cover.accent, PRIMARY);
      let yy;
      const titleBlock = (startTop, fg, fg2) => {
        let t = startTop;
        wrap(m.title || '', 30, true, TW).forEach((ln) => {
          text(ln, PAGE.M, t - 30, 30, true, fg);
          t -= 36;
        });
        if (m.subtitle) {
          wrap(m.subtitle, 14, false, TW).forEach((ln) => {
            text(ln, PAGE.M, t - 16, 14, false, fg2);
            t -= 20;
          });
        }
        return t;
      };
      if (style === 'band') {
        const bottom = PAGE.H - 330;
        rect(0, bottom, PAGE.W, 330, band);
        lockup(PAGE.M, PAGE.H - PAGE.M, 44, 15, band);
        const fg = onColor(band);
        const tl = wrap(m.title || '', 30, true, TW).length * 36 + (m.subtitle ? wrap(m.subtitle, 14, false, TW).length * 20 : 0);
        titleBlock(bottom + 36 + tl, fg, mix(band, fg, 0.8));
        yy = bottom - 40;
      } else {
        lockup(PAGE.M, PAGE.H - PAGE.M, 44, 15, null);
        line(PAGE.M, PAGE.H - PAGE.M - 64, PAGE.W - PAGE.M, PAGE.H - PAGE.M - 64, 3, band);
        yy = titleBlock(PAGE.H - 250, PRIMARY, MUTE) - 24;
      }
      (cover.lines || []).forEach((s) => {
        wrap(s, 12, false, TW).forEach((ln) => {
          text(ln, PAGE.M, yy - 12, 12, false, INK);
          yy -= 18;
        });
      });
      let sy = FLOOR + 6 + (supportLines().length - 1) * 13;
      supportLines().forEach((s, k) => {
        text(cutTo(s, 9, k === 0, TW), PAGE.M, sy, 9, k === 0, k === 0 ? INK : MUTE);
        sy -= 13;
      });
    };

    /* ----- blocks ----- */

    const H = { h1: { size: 18, before: 14 }, h2: { size: 13, before: 10 } };
    const headingLines = (b) => wrap(b.text || '', H[b.k].size, true, TW);
    const headingH = (b) => (atTop ? 0 : H[b.k].before) + headingLines(b).length * H[b.k].size * 1.25 + 4;
    /** The least of a block that must follow a heading on the same page. */
    const firstChunk = (b) => {
      if (!b) return 0;
      if (b.k === 'p' || b.k === 'ul' || b.k === 'note') return 15;
      if (b.k === 'tiles') return tileRows(b)[0] ? tileRows(b)[0].h + 8 : 0;
      if (b.k === 'table') return tableOf(b).firstH;
      if (b.k === 'chart') return chartH(b);
      if (b.k === 'photo') return photoH(b);
      if (b.k === 'h1' || b.k === 'h2') return headingLines(b).length * H[b.k].size * 1.25 + 4 + 15;
      return 0;
    };
    const heading = (b, next) => {
      need(headingH(b) + firstChunk(next));
      if (!atTop) y -= H[b.k].before;
      const size = H[b.k].size;
      headingLines(b).forEach((ln) => {
        text(ln, PAGE.M, y - size, size, true, PRIMARY);
        y -= size * 1.25;
      });
      y -= 4;
      atTop = false;
    };
    const paragraph = (runs, size, x, w, col, bullet) => {
      const LH = size * 1.45;
      wrapRuns(runs, size, w).forEach((ln, k) => {
        need(LH);
        if (bullet && k === 0) text('•', x - 11, y - size, size, false, ACCENT);
        drawRunLine(ln, x, y - size, size, col);
        y -= LH;
        atTop = false;
      });
    };

    function tileRows(b) {
      const items = b.items || [];
      const n = Math.min(4, items.length) || 1;
      const gap = 8;
      const w = (TW - gap * (n - 1)) / n;
      const rows = [];
      for (let k = 0; k < items.length; k += n) {
        const cells = items.slice(k, k + n).map((t) => {
          const label = wrap(t.label || '', 8, false, w - 16);
          let vs = 14;
          const v = clean(t.value || '');
          while (vs > 8 && width(v, vs, true) > w - 16) vs -= 0.5;
          return { label, value: v, vs };
        });
        const h = Math.max(...cells.map((c) => 9 + c.label.length * 10 + 4 + c.vs + 9));
        rows.push({ cells, h });
      }
      return rows.map((r) => Object.assign(r, { w, gap }));
    }
    const tiles = (b) => {
      const rows = tileRows(b);
      const all = rows.reduce((a, r) => a + r.h + 8, 0);
      if (all <= TOP - FLOOR) need(all);
      const tint = mix(PRIMARY, WHITE, 0.92);
      rows.forEach((r) => {
        need(r.h + 8);
        r.cells.forEach((c, k) => {
          const x = PAGE.M + k * (r.w + r.gap);
          rect(x, y - r.h, r.w, r.h, tint);
          rect(x, y - r.h, 2.5, r.h, ACCENT);
          let ty = y - 9;
          c.label.forEach((ln) => {
            text(ln, x + 9, ty - 8, 8, false, MUTE);
            ty -= 10;
          });
          text(c.value, x + 9, ty - 4 - c.vs * 0.85, c.vs, true, PRIMARY);
        });
        y -= r.h + 8;
        atTop = false;
      });
    };

    const tables = new Map();
    /** A table measured once: columns, widths, type size and each row's lines. */
    function tableOf(b) {
      if (tables.has(b)) return tables.get(b);
      const cols = b.cols || [];
      const cur = b.currency && b.currency !== 'USD' ? ` (${clean(b.currency)})` : '';
      const heads = cols.map((c) => clean(c.h) + (c.t === 'money' ? cur : ''));
      const body = (b.rows || []).map((r) => cols.map((c, i) => clean(((r || [])[i] || {}).s)));
      const total = b.total ? cols.map((c, i) => clean((b.total[i] || {}).s)) : null;
      const right = cols.map((c) => !!NUMERIC[c.t]);
      const fixed = cols.map((c, i) => right[i] || c.t === 'date');
      const sum = (a) => a.reduce((p, q) => p + q, 0);
      const most = (a, f) => a.reduce((mx, x) => Math.max(mx, f(x)), 0);
      const measure = (size) => {
        const longestWord = (s, bb) => most(s.split(/ +/), (w) => width(w, size, bb));
        const min = [];
        const nat = [];
        cols.forEach((c, i) => {
          const full = Math.max(most(body, (r) => width(r[i], size, false)), total ? width(total[i], size, true) : 0);
          const word = Math.max(most(body, (r) => longestWord(r[i], false)), total ? longestWord(total[i], true) : 0);
          min[i] = Math.max(longestWord(heads[i], true), fixed[i] ? full : Math.min(word, 20 * size)) + 2 * PAD;
          nat[i] = Math.max(min[i], width(heads[i], size, true) + 2 * PAD, full + 2 * PAD);
        });
        return { min, nat };
      };
      let size = 9;
      let mm = measure(size);
      while (sum(mm.min) > TW && size > 6) mm = measure((size -= 0.5));
      // widths: each column at least its narrowest, grown toward its widest; extra space goes to text columns
      let widths;
      const left0 = TW - sum(mm.min);
      const need0 = mm.nat.map((n, k) => n - mm.min[k]);
      if (left0 <= 0) widths = mm.min.map((w) => (w * TW) / sum(mm.min));
      else if (sum(need0) >= left0) {
        widths = mm.min.slice();
        let left = left0;
        let open = need0.map((n, k) => k).filter((k) => need0[k] > 0);
        while (open.length) {
          const fair = left / open.length;
          const small = open.filter((k) => need0[k] <= fair);
          if (!small.length) {
            open.forEach((k) => (widths[k] += fair));
            break;
          }
          small.forEach((k) => {
            widths[k] += need0[k];
            left -= need0[k];
          });
          open = open.filter((k) => small.indexOf(k) < 0);
        }
      } else {
        const left = left0 - sum(need0);
        const into = cols.map((c, k) => k).filter((k) => !fixed[k]);
        const to = into.length ? into : cols.map((c, k) => k);
        const share = sum(to.map((k) => mm.nat[k])) || 1;
        widths = mm.nat.map((n, k) => (to.indexOf(k) >= 0 ? n + (left * n) / share : n));
      }
      const xs = [];
      widths.reduce((x, w, k) => ((xs[k] = x), x + w), PAGE.M);
      const LH = size * 1.25;
      const lay = (cells, bb) => cells.map((s, k) => wrap(s, size, bb, Math.max(1, widths[k] - 2 * PAD)));
      const rowH = (lines) => Math.max(1, ...lines.map((l) => l.length)) * LH + 2 * VPAD;
      const headLines = lay(heads, true);
      const rows = body.map((r) => ({ lines: lay(r, false), b: false }));
      if (total) rows.push({ lines: lay(total, true), b: true, total: true });
      rows.forEach((r) => (r.h = rowH(r.lines)));
      const titleLines = b.title ? wrap(b.title, 11, true, TW) : [];
      const titleH = titleLines.length ? titleLines.length * 14 + 4 : 0;
      const headH = rowH(headLines);
      const t = { cols, right, size, LH, widths, xs, headLines, headH, rows, titleLines, titleH, firstH: 10 + titleH + headH + (rows[0] ? rows[0].h : 0) };
      tables.set(b, t);
      return t;
    }
    const table = (b) => {
      const t = tableOf(b);
      const drawCells = (lines, bb, col) => {
        lines.forEach((ls, k) => {
          ls.forEach((ln, j) => {
            const base = y - VPAD - t.size * 0.9 - j * t.LH;
            const x = t.right[k] ? t.xs[k] + t.widths[k] - PAD - width(ln, t.size, bb) : t.xs[k] + PAD;
            text(ln, x, base, t.size, bb, col);
          });
        });
      };
      const head = () => {
        rect(PAGE.M, y - t.headH, TW, t.headH, mix(PRIMARY, WHITE, 0.88));
        drawCells(t.headLines, true, INK);
        y -= t.headH;
        line(PAGE.M, y, PAGE.M + TW, y, 0.6, PRIMARY);
      };
      need(t.firstH);
      if (!atTop) y -= 10;
      t.titleLines.forEach((ln) => {
        text(ln, PAGE.M, y - 11, 11, true, PRIMARY);
        y -= 14;
      });
      if (t.titleLines.length) y -= 4;
      atTop = false;
      if (!t.cols.length) return;
      head();
      t.rows.forEach((r) => {
        if (r.h > y - FLOOR) {
          newPage();
          atTop = false;
          head();
        }
        if (r.total) line(PAGE.M, y, PAGE.M + TW, y, 0.9, INK);
        drawCells(r.lines, r.b, INK);
        y -= r.h;
        if (!r.total) line(PAGE.M, y, PAGE.M + TW, y, 0.3, RULE);
      });
      y -= 6;
    };

    /* charts and photos: titles, labels and captions only for now */
    function chartH(b) {
      return 18 + (b.labels || []).length * 13 + (b.ticks || []).length * 13;
    }
    const chart = (b) => {
      need(chartH(b));
      if (!atTop) y -= 8;
      text(clean(b.title), PAGE.M, y - 10, 10, true, PRIMARY);
      y -= 18;
      (b.labels || []).forEach((s, k) => {
        text(clean(s) + '   ' + clean((b.shown || [])[k]), PAGE.M, y - 9, 9, false, INK);
        y -= 13;
      });
      (b.ticks || []).forEach((tk) => {
        text(clean(tk.s), PAGE.M, y - 9, 9, false, MUTE);
        y -= 13;
      });
      atTop = false;
    };
    function photoH(b) {
      return 18 + (b.caption ? 12 : 0);
    }
    const photo = (b) => {
      need(photoH(b));
      if (!images[b.id]) missingImages++;
      if (b.caption) {
        wrap(b.caption, 8.5, false, TW).forEach((ln) => {
          text(ln, PAGE.M, y - 12, 8.5, false, MUTE);
          y -= 12;
        });
      }
      y -= 6;
      atTop = false;
    };

    /* ----- the document ----- */

    if (cover.on) drawCover();
    newPage();
    if (!cover.on) {
      heading({ k: 'h1', text: m.title || '' }, blocks[0]);
      if (m.subtitle) paragraph([{ s: m.subtitle }], 11, PAGE.M, TW, MUTE);
      const sl = supportLines();
      if (sl.length) paragraph([{ s: sl.join(' · ') }], 8, PAGE.M, TW, MUTE);
      y -= 8;
    }
    blocks.forEach((b, k) => {
      if (!b || typeof b !== 'object') return;
      const next = blocks[k + 1];
      if (b.k === 'h1' || b.k === 'h2') heading(b, next);
      else if (b.k === 'p') {
        paragraph(b.runs, 10, PAGE.M, TW, INK);
        y -= 6;
      } else if (b.k === 'ul') {
        (b.items || []).forEach((it) => {
          paragraph(it, 10, PAGE.M + 16, TW - 16, INK, true);
          y -= 2;
        });
        y -= 4;
      } else if (b.k === 'tiles') tiles(b);
      else if (b.k === 'table') table(b);
      else if (b.k === 'chart') chart(b);
      else if (b.k === 'photo') photo(b);
      else if (b.k === 'note') {
        paragraph([{ s: b.text }], 8, PAGE.M, TW, MUTE);
        y -= 4;
      } else if (b.k === 'break') {
        if (!atTop) newPage();
      }
    });

    // Every page's footer, now that the number of pages is known.
    const footer = clean(m.footer || '');
    pages.forEach((p, k) => {
      page = p;
      const n = `Page ${k + 1} of ${pages.length}`;
      const base = 32;
      text(n, PAGE.W - PAGE.M - width(n, 8, false), base, 8, false, MUTE);
      text(cutTo(footer, 8, false, TW - width(n, 8, false) - 24), PAGE.M, base, 8, false, MUTE);
    });

    out.setTitle(clean(meta.title || m.title || ''));
    const bytes = await out.save();
    bytes.pages = pages.length;
    bytes.missingImages = missingImages;
    return bytes;
  }

  NS.reportsPdf = { PAGE, compose, logoFor };
})(typeof window !== 'undefined' ? window : this);
