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

  /** 'png' or 'jpeg' from the bytes themselves, or '' (only these two are ever embedded). */
  function sniff(b) {
    if (!b || b.length < 8) return '';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    return '';
  }
  /**
   * An SVG, WebP or GIF logo redrawn as PNG bytes on a canvas (browser only; the canvas keeps pixels only, nothing else
   * of the file), the longest side at most 600 px; null where there is no canvas. Throws when the canvas refuses.
   */
  async function redraw(src) {
    if (typeof Image === 'undefined' || typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null;
    const img = new Image();
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('the logo did not load')), 8000);
      img.onload = () => (clearTimeout(t), res());
      img.onerror = () => (clearTimeout(t), rej(new Error('the logo could not be read')));
      img.src = src;
    });
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) {
      w = 600;
      h = 200;
    }
    // a drawing is drawn at the full 600 px so it stays sharp; a picture is only ever made smaller
    const k = /^data:image\/svg/.test(src) ? 600 / Math.max(w, h) : Math.min(1, 600 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    let bytes = null;
    try {
      const blob = await new Promise((res, rej) => {
        try {
          c.toBlob((b) => (b ? res(b) : rej(new Error('no image'))), 'image/png');
        } catch (e) {
          rej(e);
        }
      });
      bytes = blob.arrayBuffer
        ? new Uint8Array(await blob.arrayBuffer())
        : await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(new Uint8Array(r.result));
            r.onerror = () => rej(r.error);
            r.readAsArrayBuffer(blob);
          });
    } catch (e) {
      bytes = fromBase64(String(c.toDataURL('image/png')).split(',')[1] || '');
    }
    return bytes;
  }
  /**
   * The logo art for a tenant: an uploaded PNG or JPEG as its bytes; an SVG, WebP or GIF redrawn to PNG on a canvas in the
   * browser; the generated mark as { kind: 'mark', type, letters, colors } in the colors the console uses for it; and the
   * firm's name in its primary color when an image cannot be used.
   */
  async function logoFor(tenant) {
    const t = tenant || {};
    const colors = t.colors || {};
    const std = B().STANDARD || {};
    const P = hex(colors.primary, hex(std.primary, '#1F3A5F'));
    const A = hex(colors.accent, hex(std.accent, P));
    const name = { kind: 'name', text: String(t.shortName || t.name || ''), color: P };
    const logo = t.logo || {};
    if (logo.type === 'image') {
      const src = B().safeImage ? B().safeImage(logo.image) : '';
      const m = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,([\s\S]*)$/.exec(src);
      if (!m) return name;
      if (m[1] === 'png' || m[1] === 'jpeg') {
        const bytes = fromBase64(m[2]);
        const kind = sniff(bytes);
        return kind ? { kind, bytes } : name;
      }
      try {
        const png = await redraw(src);
        if (png && sniff(png) === 'png') return { kind: 'png', bytes: png };
      } catch (e) {
        /* the canvas refused: the name below */
      }
      return name;
    }
    return { kind: 'mark', type: String(logo.type || 'monogram'), letters: String(logo.letters || ''), colors: { p: P, a: A, ink: onColor(P) } };
  }

  /** The mark's artwork read from brand.js (never copied here): [{ d, fill, stroke, sw, cap, join } | { text, x, y, size, fill }] on 40x40. */
  function markShapes(type, letters, c) {
    if (!B().markBody) return [];
    const svg = B().markBody(type, letters, c, 'sans');
    const un = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const shapes = [];
    const re = /<(path|rect|circle|text)\b([^>]*?)(?:\/>|>([^<]*)<\/text>)/g;
    let el;
    while ((el = re.exec(svg))) {
      const a = {};
      el[2].replace(/([a-zA-Z-]+)="([^"]*)"/g, (all, k, v) => (a[k] = v));
      const st = {};
      String(a.style || '')
        .split(';')
        .forEach((kv) => {
          const i = kv.indexOf(':');
          if (i > 0) st[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
        });
      const fill = a.fill === 'none' ? null : hex(st.fill || a.fill);
      const stroke = hex(st.stroke || a.stroke);
      const n = (k) => parseFloat(a[k]) || 0;
      let d = '';
      if (el[1] === 'path') d = a.d || '';
      else if (el[1] === 'rect') {
        const x = n('x');
        const y = n('y');
        const w = n('width');
        const h = n('height');
        const r = Math.min(n('rx'), w / 2, h / 2);
        d = r
          ? `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
          : `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
      } else if (el[1] === 'circle') {
        const cx = n('cx');
        const cy = n('cy');
        const r = n('r');
        d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
      } else {
        shapes.push({ text: un(el[3] || ''), x: n('x'), y: n('y'), size: parseFloat(st['font-size']) || 15, fill: hex(st.fill) || '#FFFFFF' });
        continue;
      }
      shapes.push({ d, fill, stroke, sw: n('stroke-width'), cap: a['stroke-linecap'] || '', join: a['stroke-linejoin'] || '' });
    }
    return shapes;
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

    // Every string is checked against the font before any page is drawn: a character it cannot show refuses the report
    // (never a silent '?' in a name or a figure).
    const refuse = (s, b) => {
      for (const ch of clean(s)) {
        const cp = ch.codePointAt(0);
        if (!reg.has(cp) || (b && bold && !bold.has(cp))) {
          const u = cp.toString(16).toUpperCase().padStart(4, '0');
          throw new Error(`This report has a character the PDF font cannot show: "${ch}" (U+${u}) in "${Array.from(String(s)).slice(0, 40).join('')}". Change the text and try again.`);
        }
      }
    };
    [m.title, firm.name, firm.legalName].forEach((s) => refuse(s || '', true));
    [m.subtitle, m.footer, support.team, support.email, support.phone, meta.title, meta.author].concat(cover.lines || []).forEach((s) => refuse(s || '', false));
    if (logo.kind === 'name') refuse(logo.text || '', true);
    if (logo.kind === 'mark') refuse(String(logo.letters || '').slice(0, 3).toUpperCase(), true);
    blocks.forEach((b) => {
      if (!b || typeof b !== 'object') return;
      const runs = (rs) => (rs || []).forEach((r) => refuse((r && r.s) || '', !!(r && r.b)));
      if (b.k === 'h1' || b.k === 'h2') refuse(b.text || '', true);
      else if (b.k === 'p') runs(b.runs);
      else if (b.k === 'ul') (b.items || []).forEach(runs);
      else if (b.k === 'tiles') (b.items || []).forEach((t) => (refuse(t.label || '', false), refuse(t.value || '', true)));
      else if (b.k === 'table') {
        refuse(b.title || '', true);
        refuse(b.currency || '', true);
        (b.cols || []).forEach((c) => refuse(c.h || '', true));
        (b.rows || []).forEach((r) => (r || []).forEach((c) => refuse((c && c.s) || '', false)));
        (b.total || []).forEach((c) => refuse((c && c.s) || '', true));
      } else if (b.k === 'chart') {
        refuse(b.title || '', true);
        (b.labels || []).concat(b.shown || [], (b.ticks || []).map((t) => t && t.s)).forEach((s) => refuse(s || '', false));
      } else if (b.k === 'photo' || b.k === 'note') refuse(b.caption || b.text || '', false);
    });

    /** An image of the model embedded once: { img, w, h } or null (only PNG and JPEG bytes; anything else is not used). */
    const embedded = new Map();
    const imageOf = async (key, bytes) => {
      if (embedded.has(key)) return embedded.get(key);
      let r = null;
      try {
        const kind = sniff(bytes);
        const img = kind === 'png' ? await out.embedPng(bytes) : kind === 'jpeg' ? await out.embedJpg(bytes) : null;
        if (img) r = { img, w: img.width, h: img.height };
      } catch (e) {
        r = null;
      }
      embedded.set(key, r);
      return r;
    };
    let art = logo;
    if (logo.kind === 'png' || logo.kind === 'jpeg') {
      const im = await imageOf('logo', logo.bytes);
      art = im ? Object.assign({}, logo, im) : { kind: 'name', text: firm.name || '', color: PRIMARY };
    }
    const photos = {};
    for (const b of blocks) if (b && b.k === 'photo' && images[b.id]) photos[b.id] = await imageOf('p:' + b.id, images[b.id].bytes);
    if (cover.on && cover.style === 'photo' && cover.photoId && images[cover.photoId]) photos[cover.photoId] = await imageOf('p:' + cover.photoId, images[cover.photoId].bytes);
    const logos = [];

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
    const marks = new Map();
    const drawMark = (x, top, s, c) => {
      const key = JSON.stringify(c);
      if (!marks.has(key)) marks.set(key, markShapes(art.type, art.letters, c));
      const k = s / 40;
      marks.get(key).forEach((sh) => {
        if (sh.text != null) {
          const size = sh.size * k;
          const tw = width(sh.text, size, true);
          text(sh.text, x + sh.x * k - tw / 2, top - (sh.y + sh.size * 0.36) * k, size, true, sh.fill);
          return;
        }
        const o = { x, y: top, scale: k };
        if (sh.fill) o.color = color(sh.fill);
        if (sh.stroke) {
          o.borderColor = color(sh.stroke);
          o.borderWidth = sh.sw || 1;
          if (sh.cap === 'round') o.borderLineCap = L.LineCapStyle.Round;
        }
        if (!sh.fill && !sh.stroke) return;
        if (sh.join === 'round') page.pushOperators(L.pushGraphicsState(), L.setLineJoin(L.LineJoinStyle.Round));
        page.drawSvgPath(sh.d, o);
        if (sh.join === 'round') page.pushOperators(L.popGraphicsState());
      });
    };
    const drawLogo = (x, top, h, onBand) => {
      const at = { page: pages.length, x, top: PAGE.H - top, h, kind: art.kind };
      if (art.kind === 'name') {
        const size = h * 0.8;
        text(clean(art.text), x, top - h * 0.78, size, true, onBand ? onColor(onBand) : hex(art.color, PRIMARY));
        at.w = width(clean(art.text), size, true);
      } else if (art.kind === 'mark') {
        let c = art.colors || {};
        if (onBand) {
          // on a colored ground the mark takes the console's hero colors for that ground (brand.js derive)
          const on = onColor(onBand);
          c = { p: on, a: contrast(c.a || ACCENT, onBand) >= 2.2 ? c.a || ACCENT : mix(on, onBand, 0.45), ink: onBand };
        }
        drawMark(x, top, h, { p: hex(c.p, PRIMARY), a: hex(c.a, ACCENT), ink: hex(c.ink, WHITE) });
        at.w = h;
      } else {
        let ih = h;
        let iw = (art.w / art.h) * ih;
        if (iw > h * 4) {
          iw = h * 4;
          ih = (art.h / art.w) * iw;
        }
        if (onBand) {
          // an uploaded logo sits on a white plate over a colored band, so its own colors stay readable
          const p = h * 0.18;
          page.drawRectangle({ x: x - p, y: top - ih - p, width: iw + 2 * p, height: ih + 2 * p, color: color(WHITE) });
        }
        page.drawImage(art.img, { x, y: top - ih - (h - ih) / 2, width: iw, height: ih });
        at.w = iw;
        at.h = ih;
      }
      logos.push(at);
      return at.w;
    };
    /** Logo, then the firm's name beside it (unless the logo is the name). */
    const lockup = (x, top, h, nameSize, onBand) => {
      const lw = drawLogo(x, top, h, onBand);
      if (art.kind !== 'name' && firm.name) {
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
      let style = cover.style === 'plain' || cover.style === 'photo' ? cover.style : 'band';
      const band = hex(cover.accent, PRIMARY);
      if (style === 'photo' && !photos[cover.photoId]) {
        // the cover photo's bytes are not here: the band cover instead, counted like any missing photo
        missingImages++;
        style = 'band';
      }
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
      } else if (style === 'photo') {
        // the photo across the top half, cropped to fill it, then the lockup and the title on white
        const ph = photos[cover.photoId];
        const areaH = PAGE.H / 2;
        const k = Math.max(PAGE.W / ph.w, areaH / ph.h);
        const w = ph.w * k;
        const h = ph.h * k;
        page.pushOperators(L.pushGraphicsState(), L.rectangle(0, PAGE.H - areaH, PAGE.W, areaH), L.clip(), L.endPath());
        page.drawImage(ph.img, { x: (PAGE.W - w) / 2, y: PAGE.H - areaH - (h - areaH) / 2, width: w, height: h });
        page.pushOperators(L.popGraphicsState());
        rect(0, PAGE.H - areaH - 4, PAGE.W, 4, band);
        lockup(PAGE.M, PAGE.H - areaH - 28, 36, 14, null);
        yy = titleBlock(PAGE.H - areaH - 84, PRIMARY, MUTE) - 18;
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

    /* ----- charts: vector shapes in the brand colors, every label, shown value and tick drawn as text ----- */

    const PLOT_H = 130;
    const PALETTE = [PRIMARY, ACCENT, mix(PRIMARY, WHITE, 0.45), mix(ACCENT, WHITE, 0.45), mix(PRIMARY, WHITE, 0.7), mix(ACCENT, WHITE, 0.7), mix(PRIMARY, ACCENT, 0.5)];
    /** Bar heights as fractions of the plot: values already in 0..1 are used as they are, others against the largest. */
    const fracs = (vals) => {
      const v = (vals || []).map((x) => (Number.isFinite(Number(x)) ? Number(x) : 0));
      const unit = v.every((x) => x >= 0 && x <= 1);
      const most = Math.max(0, ...v);
      return v.map((x) => (unit ? x : most > 0 ? Math.max(0, x) / most : 0));
    };
    const charts = new Map();
    function chartOf(b) {
      if (charts.has(b)) return charts.get(b);
      const labels = (b.labels || []).map(clean);
      const shown = (b.shown || []).map(clean);
      const n = Math.max(labels.length, 1);
      const title = wrap(b.title || '', 10, true, TW);
      const titleH = title[0] ? title.length * 13 + 5 : 0;
      let c;
      if (b.kind === 'bar100') {
        const rows = [];
        let row = [];
        let rw = 0;
        labels.forEach((s, k) => {
          const w = 12 + width(s, 8, false) + 5 + width(shown[k] || '', 8, true) + 16;
          if (row.length && rw + w > TW) {
            rows.push(row);
            row = [];
            rw = 0;
          }
          row.push({ k, x: rw, s, v: shown[k] || '' });
          rw += w;
        });
        if (row.length) rows.push(row);
        c = { title, titleH, rows, h: 8 + titleH + 4 + 22 + 10 + rows.length * 14 + 2 };
      } else {
        const ticks = (b.ticks || []).map((t) => ({ at: Math.min(1, Math.max(0, Number(t && t.at) || 0)), s: clean(t && t.s) }));
        const tw = Math.max(0, ...ticks.map((t) => width(t.s, 7, false)));
        const plotX = PAGE.M + (tw ? tw + 6 : 0);
        const plotW = PAGE.M + TW - plotX;
        const slot = plotW / n;
        let ls = 7.5;
        while (ls > 5 && labels.some((s) => width(s, ls, false) > slot - 2)) ls -= 0.5;
        let ss = 7.5;
        while (ss > 5 && shown.some((s) => width(s, ss, false) > slot - 2)) ss -= 0.5;
        const labelLines = labels.map((s) => wrap(s, ls, false, Math.max(1, slot - 2)));
        const most = Math.max(1, ...labelLines.map((l) => l.length));
        c = { title, titleH, ticks, plotX, plotW, slot, ls, ss, labelLines, h: 8 + titleH + 12 + PLOT_H + 4 + most * ls * 1.25 + 6 };
      }
      c.labels = labels;
      c.shown = shown;
      c.f = fracs(b.values);
      charts.set(b, c);
      return c;
    }
    const chartH = (b) => chartOf(b).h;
    const chart = (b) => {
      const c = chartOf(b);
      need(c.h);
      y -= 8;
      c.title.forEach((ln) => {
        text(ln, PAGE.M, y - 10, 10, true, PRIMARY);
        y -= 13;
      });
      if (c.title.length) y -= 5;
      atTop = false;
      if (b.kind === 'bar100') {
        y -= 4;
        let x = PAGE.M;
        c.f.forEach((f, k) => {
          const w = TW * f;
          if (w > 0) rect(x, y - 22, w, 22, PALETTE[k % PALETTE.length]);
          if (k && w > 0) line(x, y - 22, x, y, 1, WHITE);
          x += w;
        });
        y -= 22 + 10;
        c.rows.forEach((row) => {
          row.forEach((e) => {
            const x0 = PAGE.M + e.x;
            rect(x0, y - 8, 8, 8, PALETTE[e.k % PALETTE.length]);
            text(e.s, x0 + 12, y - 7.5, 8, false, INK);
            text(e.v, x0 + 12 + width(e.s, 8, false) + 5, y - 7.5, 8, true, INK);
          });
          y -= 14;
        });
        y -= 2;
        return;
      }
      y -= 12;
      const base = y - PLOT_H;
      c.ticks.forEach((t) => {
        const ty = base + t.at * PLOT_H;
        if (t.at > 0) line(c.plotX, ty, c.plotX + c.plotW, ty, 0.4, RULE);
        text(t.s, c.plotX - 6 - width(t.s, 7, false), ty - 2.5, 7, false, MUTE);
      });
      const cx = (k) => c.plotX + c.slot * (k + 0.5);
      if (b.kind === 'line') {
        const pts = c.f.map((f, k) => ({ x: cx(k), y: base + f * PLOT_H }));
        for (let k = 1; k < pts.length; k++) page.drawLine({ start: pts[k - 1], end: pts[k], thickness: 1.6, color: color(PRIMARY), lineCap: L.LineCapStyle.Round });
        pts.forEach((p, k) => {
          page.drawCircle({ x: p.x, y: p.y, size: 2.8, color: color(ACCENT) });
          const s = c.shown[k] || '';
          text(s, p.x - width(s, c.ss, false) / 2, p.y + 6, c.ss, false, INK);
        });
      } else {
        const bw = Math.min(c.slot * 0.6, 56);
        c.f.forEach((f, k) => {
          const h = f * PLOT_H;
          if (h > 0) rect(cx(k) - bw / 2, base, bw, h, ACCENT);
          const s = c.shown[k] || '';
          text(s, cx(k) - width(s, c.ss, false) / 2, base + h + 4, c.ss, false, INK);
        });
      }
      line(c.plotX, base, c.plotX + c.plotW, base, 0.7, INK);
      let most = 1;
      c.labelLines.forEach((ls, k) => {
        most = Math.max(most, ls.length);
        ls.forEach((ln, j) => text(ln, cx(k) - width(ln, c.ls, false) / 2, base - 4 - c.ls - j * c.ls * 1.25, c.ls, false, MUTE));
      });
      y = base - 4 - most * c.ls * 1.25 - 6;
    };

    /* ----- photos: scaled to the text width keeping their shape, never split, the caption under ----- */

    const photoOf = (b) => {
      const ph = photos[b.id] || null;
      const cap = b.caption ? wrap(b.caption, 8.5, false, TW) : [];
      const capH = cap.length * 12;
      let w = TW;
      let h = 0;
      if (ph) {
        h = (w * ph.h) / ph.w;
        const most = TOP - FLOOR - capH - 22;
        if (h > most) {
          h = most;
          w = (h * ph.w) / ph.h;
        }
      }
      return { ph, cap, capH, w, h, total: 8 + (ph ? h + 6 : 0) + capH + 6 };
    };
    const photoH = (b) => photoOf(b).total;
    const photo = (b) => {
      const p = photoOf(b);
      need(p.total);
      if (!atTop) y -= 8;
      if (p.ph) {
        page.drawImage(p.ph.img, { x: PAGE.M + (TW - p.w) / 2, y: y - p.h, width: p.w, height: p.h });
        y -= p.h + 6;
      } else missingImages++;
      p.cap.forEach((ln) => {
        text(ln, PAGE.M, y - 9, 8.5, false, MUTE);
        y -= 12;
      });
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

    // File properties (C-12): the firm's name as Author, Producer and Creator, never the writer's own; dates from the
    // model, so the same model gives the same bytes.
    const who = clean(meta.author || firm.legalName || firm.name || '');
    out.setTitle(clean(meta.title || m.title || ''));
    out.setAuthor(who);
    out.setProducer(who);
    out.setCreator(who);
    out.setSubject(clean(m.subtitle || ''));
    const when = new Date(m.when);
    if (m.when && Number.isFinite(when.getTime())) {
      out.setCreationDate(when);
      out.setModificationDate(when);
    }
    const bytes = await out.save();
    bytes.pages = pages.length;
    bytes.missingImages = missingImages;
    bytes.logos = logos;
    return bytes;
  }

  NS.reportsPdf = { PAGE, compose, logoFor };
})(typeof window !== 'undefined' ? window : this);
