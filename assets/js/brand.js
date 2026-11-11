/*
 * White-label engine.
 * Turns one client brand config (two colors, a type pair, a corner style, a logo)
 * into a complete, contrast-checked token set for light and dark mode, then
 * writes it to the page as CSS custom properties.
 */
(function (global) {
  'use strict';
  const NS = (global.CVPortal = global.CVPortal || {});

  /* ---------- Color math: sRGB <-> OKLab / OKLCH, WCAG contrast ---------- */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function normHex(hex) {
    let s = String(hex || '').trim().replace(/^#/, '');
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toUpperCase() : null;
  }
  function hexToRgb(hex) {
    const n = normHex(hex) || '#000000';
    return [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toGam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

  function rgbToOklab(rgb) {
    const [r, g, b] = rgb.map(toLin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    ];
  }
  function oklabToRgb(lab) {
    const [L, a, b] = lab;
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [
      toGam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      toGam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      toGam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
    ];
  }
  function toOklch(hex) {
    const [L, a, b] = rgbToOklab(hexToRgb(hex));
    return { l: L, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
  }
  const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

  /** OKLCH -> hex, reducing chroma until the color fits in sRGB. */
  function oklch(l, c, h) {
    l = clamp(l, 0, 1);
    const hr = (h * Math.PI) / 180;
    const at = (cc) => oklabToRgb([l, cc * Math.cos(hr), cc * Math.sin(hr)]);
    let rgb = at(c);
    if (!inGamut(rgb)) {
      let lo = 0;
      let hi = c;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut(at(mid))) lo = mid;
        else hi = mid;
      }
      rgb = at(lo);
    }
    return rgbToHex(rgb);
  }
  function shiftL(hex, d) {
    const { l, c, h } = toOklch(hex);
    return oklch(l + d, c, h);
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map(toLin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  /** Step a color's OKLCH lightness away from the background until it meets the target ratio. */
  function ensureContrast(hex, bg, target) {
    if (contrast(hex, bg) >= target) return normHex(hex);
    const { l, c, h } = toOklch(hex);
    const darken = luminance(bg) > 0.18;
    for (let i = 1; i <= 100; i++) {
      const nl = darken ? l - i * 0.01 : l + i * 0.01;
      if (nl < 0 || nl > 1) break;
      const out = oklch(nl, c, h);
      if (contrast(out, bg) >= target) return out;
    }
    return darken ? '#000000' : '#FFFFFF';
  }
  function mix(a, b, t) {
    const A = rgbToOklab(hexToRgb(a));
    const B = rgbToOklab(hexToRgb(b));
    return rgbToHex(oklabToRgb(A.map((v, i) => v + (B[i] - v) * t)));
  }
  const INK_DARK = '#0B1622';
  function onColor(bg) {
    const w = contrast('#FFFFFF', bg);
    return w >= 4.5 || w >= contrast(INK_DARK, bg) ? '#FFFFFF' : INK_DARK;
  }
  /** Perceptual distance (OKLab x 100), the same scale the dataviz validator uses. */
  function deltaE(a, b) {
    const A = rgbToOklab(hexToRgb(a));
    const B = rgbToOklab(hexToRgb(b));
    return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) * 100;
  }

  /* ---------- Type pairs and corner styles a client can choose ---------- */

  // `weight` and `tracking` are how each display face is set in headings (the Refract theme sets its own light and tight).
  const FONTS = {
    funnel: {
      label: 'Funnel',
      note: 'Light, calm',
      display: "'Funnel Display', ui-sans-serif, system-ui, sans-serif",
      body: "'Funnel Sans', ui-sans-serif, system-ui, sans-serif",
      href: 'https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500&family=Funnel+Sans:wght@400;500&display=swap',
      weight: 400,
      tracking: '-0.032em'
    },
    hanken: {
      label: 'Hanken Grotesk',
      note: 'Clean, neutral',
      display: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
      body: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
      href: 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap'
    },
    serif: {
      label: 'Source Serif & Sans',
      note: 'Traditional, institutional',
      display: "'Source Serif 4', Georgia, 'Times New Roman', serif",
      body: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif",
      href: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&family=Source+Sans+3:wght@400;500;600;700&display=swap'
    },
    plex: {
      label: 'IBM Plex Sans',
      note: 'Technical, precise',
      display: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
      body: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
      href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap'
    },
    // Public Sans keeps the Franklin look and, unlike Libre Franklin, lines its figures up in columns.
    franklin: {
      label: 'Public Sans',
      note: 'Sturdy, official',
      display: "'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
      body: "'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
      href: 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap'
    },
    manrope: {
      label: 'Manrope',
      note: 'Modern, geometric',
      display: "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif",
      body: "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif",
      href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap'
    }
  };
  const RADII = {
    sharp: { sm: 2, md: 3, lg: 4, card: 4, inner: 3, pill: '3px', label: 'Sharp' },
    // Refract: 22px on panels, 12px inside them, pills for controls.
    soft: { sm: 8, md: 12, lg: 12, card: 22, inner: 12, pill: '999px', label: 'Soft' },
    round: { sm: 8, md: 12, lg: 12, card: 22, inner: 12, pill: '999px', label: 'Round' }
  };

  /* ---------- Token derivation ---------- */
  /*
   * The portal is set in the Refract theme: sunlit white paper, deep pool-blue ink, clear surfaces whose shadows carry
   * a tint of the light. These are the theme's own values, as [lightness, chroma, hue] in OKLCH. A firm's two brand
   * colors sit in the theme's two colored roles: its primary is the accent (the main action, the current tab, focus),
   * and its second color is the shade (the second data tone, and the tint of every shadow). A firm on the standard
   * colors gets the theme's exact palette.
   */
  const RF = {
    paper: [0.982, 0.006, 95], paper2: [0.964, 0.006, 95], paper3: [0.936, 0.008, 95], light: [0.997, 0.004, 95],
    ink: [0.23, 0.035, 245], ink2: [0.36, 0.035, 245], muted: [0.5, 0.025, 240],
    rule: [0.895, 0.008, 230], rule2: [0.935, 0.006, 230],
    accent: [0.5, 0.12, 234], accentHi: [0.44, 0.12, 236], accentInk: [0.99, 0.003, 95], accentSoft: [0.94, 0.025, 220], focus: [0.56, 0.14, 234],
    shade: [0.86, 0.05, 212], shade2: [0.74, 0.07, 220]
  };
  const rf = (k) => oklch(RF[k][0], RF[k][1], RF[k][2]);
  const STANDARD = { primary: rf('accent'), accent: rf('shade2') };
  const same = (x, y) => String(x).toUpperCase() === String(y).toUpperCase();

  function derive(t) {
    const P = normHex(t.colors && t.colors.primary) || STANDARD.primary;
    const A = normHex(t.colors && t.colors.accent) || STANDARD.accent;
    const ownP = !same(P, STANDARD.primary);
    const ownA = !same(A, STANDARD.accent);
    const brandNav = t.nav === 'brand';
    const p = toOklch(P);
    const a = toOklch(A);
    const PAPER = rf('paper');
    const LIGHT = rf('light');
    const INK = rf('ink');

    const L = {};
    L.bg = PAPER;
    L.page = PAPER;
    L.surface = LIGHT;
    L['surface-2'] = rf('paper2');
    L['surface-3'] = rf('paper3');
    L.line = rf('rule');
    L['line-2'] = rf('rule2');
    // A field's edge has to be seen: 3:1 against the well it outlines.
    L['line-strong'] = ensureContrast(rf('rule'), LIGHT, 3.05);
    L.fg = INK;
    L['fg-2'] = rf('ink2');
    L['fg-3'] = rf('muted');

    // The accent: the firm's primary, or the theme's pool blue.
    const onP = contrast(rf('accentInk'), P) >= 4.5 || contrast(rf('accentInk'), P) >= contrast(INK, P) ? rf('accentInk') : INK;
    L.brand = P;
    L['brand-ink'] = onP;
    L['brand-hover'] = ownP ? oklch(Math.max(0, p.l + (p.l > 0.3 ? -0.06 : 0.07)), p.c, p.h + 2) : rf('accentHi');
    L['brand-soft'] = ownP ? oklch(0.94, Math.min(p.c, 0.025), p.h) : rf('accentSoft');
    L['brand-text'] = ensureContrast(P, LIGHT, 4.5);
    L.focus = ensureContrast(ownP ? oklch(Math.min(0.62, p.l + 0.06), p.c + 0.02, p.h) : rf('focus'), PAPER, 3);

    // The shade: the firm's second color, or the theme's water tones.
    L.accent = A;
    L['accent-ink'] = contrast(INK, A) >= contrast(rf('accentInk'), A) ? INK : rf('accentInk');
    L['accent-soft'] = ownA ? oklch(0.86, Math.min(a.c, 0.05), a.h) : rf('shade');
    L['accent-text'] = ensureContrast(A, LIGHT, 4.5);

    L['chart-1'] = ensureContrast(P, LIGHT, 3);
    L['chart-muted'] = rf('muted');
    L['tint-1'] = L['brand-soft'];
    L['tint-2'] = L['accent-soft'];
    L['seg-1'] = L['chart-1'];
    L['seg-2'] = A;
    L['seg-3'] = rf('paper3');
    ['seg-1', 'seg-2', 'seg-3'].forEach((k) => (L[k + '-ink'] = contrast(INK, L[k]) >= contrast(rf('accentInk'), L[k]) ? INK : rf('accentInk')));

    // Every shadow falls down and right from one sun and carries the shade's hue; none is grey.
    const sh = Math.round(a.h);
    L['edge-light'] = 'inset 0 1px 0 oklch(100% 0 0 / 0.9), inset 0 0 0 1px oklch(100% 0 0 / 0.55)';
    L['shadow-card'] = `18px 28px 48px -26px oklch(52% 0.09 ${sh} / 0.38), 2px 3px 6px -2px oklch(40% 0.05 ${sh + 10} / 0.12)`;
    L['shadow-cast'] = `28px 40px 70px -30px oklch(60% 0.11 ${sh - 8} / 0.45)`;
    L['shadow-lift'] = `22px 34px 56px -26px oklch(52% 0.09 ${sh} / 0.42), 2px 4px 8px -2px oklch(40% 0.05 ${sh + 10} / 0.14)`;
    L.shadow = `0 24px 64px -24px oklch(30% 0.06 ${sh + 10} / 0.45), 0 2px 6px -2px oklch(30% 0.05 ${sh + 10} / 0.18)`;
    L.scrim = `oklch(23% 0.035 245 / 0.5)`;

    // The top bar: clear over the paper, or a solid bar in the firm's color.
    if (brandNav) {
      const ink = onP;
      L['nav-bg'] = P;
      L['nav-fg-strong'] = ink;
      L['nav-fg'] = ensureContrast(mix(P, ink, 0.8), P, 4.5);
      L['nav-muted'] = ensureContrast(mix(P, ink, 0.62), P, 4.5);
      L['nav-line'] = mix(P, ink, 0.16);
      L['nav-hover'] = mix(P, ink, 0.08);
      L['nav-active-bg'] = mix(P, ink, 0.15);
      L['nav-active-fg'] = ink;
      L['nav-marker'] = contrast(A, P) >= 3 ? A : ink;
      L['nav-mark-p'] = ink;
      L['nav-mark-a'] = contrast(A, P) >= 2.2 ? A : mix(ink, P, 0.45);
      L['nav-mark-ink'] = P;
    } else {
      L['nav-bg'] = LIGHT;
      L['nav-fg-strong'] = INK;
      L['nav-fg'] = rf('ink2');
      L['nav-muted'] = rf('muted');
      L['nav-line'] = rf('rule');
      L['nav-hover'] = rf('paper2');
      L['nav-active-bg'] = L['brand-soft'];
      L['nav-active-fg'] = INK;
      L['nav-marker'] = ensureContrast(P, LIGHT, 3);
      L['nav-mark-p'] = P;
      L['nav-mark-a'] = A;
      L['nav-mark-ink'] = onP;
    }

    L['hero-bg'] = P;
    L['hero-fg'] = onP;
    L['hero-fg-2'] = ensureContrast(mix(P, onP, 0.76), P, 4.5);
    L['hero-line'] = mix(P, onP, 0.22);
    L['hero-mark-p'] = onP;
    L['hero-mark-a'] = contrast(A, P) >= 2.2 ? A : mix(onP, P, 0.45);
    L['hero-mark-ink'] = P;
    L['mark-p'] = P;
    L['mark-a'] = A;
    L['mark-ink'] = onP;

    /*
     * Dark: the same system re-derived, never inverted. The paper goes deep in the ink's own hue, each surface a step
     * lighter than the one under it; ink and rules are re-spaced; the accent gives up some chroma and gains lightness;
     * shadows are off, and a surface is edged with an inset hairline instead.
     */
    const dk = (l, c, h) => oklch(l, c, h == null ? 245 : h);
    const D = {};
    D.bg = dk(0.155, 0.014);
    D.page = D.bg;
    D.surface = dk(0.19, 0.014);
    D['surface-2'] = dk(0.22, 0.014);
    D['surface-3'] = dk(0.25, 0.014);
    D.line = dk(0.3, 0.014, 235);
    D['line-2'] = dk(0.26, 0.012, 235);
    D['line-strong'] = ensureContrast(dk(0.42, 0.014, 235), D.surface, 3.05);
    D.fg = dk(0.94, 0.012, 240);
    D['fg-2'] = dk(0.84, 0.014, 240);
    D['fg-3'] = ensureContrast(dk(0.7, 0.016, 240), D['surface-2'], 4.5);

    const pd = ensureContrast(oklch(Math.max(0.62, Math.min(0.74, p.l + 0.16)), Math.max(0.02, p.c - 0.03), p.h), D.surface, 4.5);
    const onPd = contrast(D.bg, pd) >= contrast(D.fg, pd) ? D.bg : D.fg;
    D.brand = pd;
    D['brand-ink'] = onPd;
    D['brand-hover'] = shiftL(pd, 0.05);
    D['brand-soft'] = mix(D.surface, pd, 0.2);
    D['brand-text'] = ensureContrast(pd, D['surface-2'], 4.6);
    D.focus = ensureContrast(shiftL(pd, 0.04), D.bg, 3.2);
    const ad = ensureContrast(oklch(Math.max(0.6, Math.min(0.76, a.l)), Math.max(0.02, a.c - 0.02), a.h), D.surface, 3.2);
    D.accent = ad;
    D['accent-ink'] = contrast(D.bg, ad) >= contrast(D.fg, ad) ? D.bg : D.fg;
    D['accent-soft'] = mix(D.surface, ad, 0.3);
    D['accent-text'] = ensureContrast(ad, D['surface-2'], 4.6);
    D['chart-1'] = pd;
    D['chart-muted'] = dk(0.6, 0.014, 240);
    D['tint-1'] = mix(D.surface, pd, 0.3);
    D['tint-2'] = mix(D.surface, ad, 0.3);
    D['seg-1'] = pd;
    D['seg-2'] = ad;
    D['seg-3'] = dk(0.42, 0.014, 240);
    ['seg-1', 'seg-2', 'seg-3'].forEach((k) => (D[k + '-ink'] = contrast(D.bg, D[k]) >= contrast(D.fg, D[k]) ? D.bg : D.fg));
    D['edge-light'] = `inset 0 0 0 1px ${D.line}`;
    D['shadow-card'] = 'none';
    D['shadow-cast'] = 'none';
    D['shadow-lift'] = 'none';
    D.shadow = `0 24px 64px -24px oklch(8% 0.02 245 / 0.8)`;
    D.scrim = 'oklch(8% 0.02 245 / 0.66)';

    // A solid header stays in the firm's hue, deepened; a clear one sits a step above the paper.
    const navDark = brandNav ? oklch(0.25, Math.min(p.c, 0.07), p.h) : D.surface;
    D['nav-bg'] = navDark;
    D['nav-fg-strong'] = D.fg;
    D['nav-fg'] = ensureContrast(mix(navDark, D.fg, 0.78), navDark, 4.5);
    D['nav-muted'] = ensureContrast(mix(navDark, D.fg, 0.62), navDark, 4.5);
    D['nav-line'] = brandNav ? mix(navDark, D.fg, 0.12) : D.line;
    D['nav-hover'] = mix(navDark, D.fg, 0.06);
    D['nav-active-bg'] = mix(navDark, pd, 0.3);
    D['nav-active-fg'] = D.fg;
    D['nav-marker'] = ensureContrast(pd, navDark, 3);
    D['nav-mark-p'] = D['brand-text'];
    D['nav-mark-a'] = ensureContrast(ad, navDark, 3);
    D['nav-mark-ink'] = navDark;

    const heroDark = D['surface-2'];
    D['hero-bg'] = heroDark;
    D['hero-fg'] = D.fg;
    D['hero-fg-2'] = ensureContrast(mix(heroDark, D.fg, 0.74), heroDark, 4.5);
    D['hero-line'] = mix(heroDark, D.fg, 0.16);
    D['hero-mark-p'] = D.fg;
    D['hero-mark-a'] = ensureContrast(ad, heroDark, 2.5);
    D['hero-mark-ink'] = heroDark;
    D['mark-p'] = D['brand-text'];
    D['mark-a'] = ad;
    D['mark-ink'] = D.surface;

    // Paper (statements and other documents) stays white in both modes, like a PDF, in the firm's own colors.
    const WHITE = '#FFFFFF';
    const paper = {
      'paper-bg': WHITE,
      'paper-fg': INK,
      'paper-fg-2': rf('ink2'),
      'paper-line': rf('rule'),
      'paper-soft': rf('paper2'),
      'paper-brand': ensureContrast(P, WHITE, 4.5),
      'paper-brand-fill': P,
      'paper-brand-ink': onP,
      'paper-mark-p': P,
      'paper-mark-a': A,
      'paper-mark-ink': onP
    };

    // What the Brand Studio reports back to the operator.
    const report = [
      { key: 'button', label: 'Button text on primary', ratio: contrast(L['brand-ink'], P), target: 4.5 },
      { key: 'link', label: 'Primary as text on white', ratio: contrast(L['brand-text'], LIGHT), target: 4.5, adjusted: L['brand-text'] !== P, original: contrast(P, LIGHT) },
      { key: 'accent', label: 'Accent as text on white', ratio: contrast(L['accent-text'], LIGHT), target: 4.5, adjusted: L['accent-text'] !== A, original: contrast(A, LIGHT) },
      { key: 'nav', label: 'Header text', ratio: contrast(L['nav-fg'], L['nav-bg']), target: 4.5 },
      { key: 'dark', label: 'Primary in dark mode', ratio: contrast(D['brand-text'], D.surface), target: 4.5, adjusted: D['brand-text'] !== P, original: contrast(P, D.surface) },
      { key: 'chart', label: 'Chart colors apart', delta: deltaE(L['seg-1'], L['seg-2']), target: 15 }
    ];

    return { light: L, dark: D, paper, report, primary: P, accent: A };
  }

  /* ---------- Logo marks ---------- */

  const MARKS = {
    monogram: { label: 'Monogram' },
    wing: { label: 'Wing' },
    ridge: { label: 'Ridge' },
    wave: { label: 'Wave' },
    arch: { label: 'Arch' }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Mark artwork, 40x40. `c` gives the three colors as CSS values (vars or hex). */
  function markBody(type, letters, c, fontFamily) {
    const L = esc(String(letters || '').slice(0, 3).toUpperCase());
    switch (type) {
      case 'wing':
        return `<path d="M3 31 L23 7 L27.5 13 L12 31 Z" style="fill:${c.p}"/><path d="M16.5 31 L29.5 15.5 L37 31 Z" style="fill:${c.a}"/>`;
      case 'ridge':
        return `<rect x="1" y="1" width="38" height="38" rx="3" style="fill:${c.p}"/><circle cx="28.5" cy="12.5" r="3.6" style="fill:${c.a}"/><path d="M6 30 L14.5 18.5 L20 24.5 L26.5 16 L34 30" fill="none" style="stroke:${c.ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
      case 'wave':
        return `<circle cx="20" cy="20" r="19" style="fill:${c.p}"/><path d="M8 17 Q 14 11.5 20 17 T 32 17" fill="none" style="stroke:${c.ink}" stroke-width="3" stroke-linecap="round"/><path d="M8 25 Q 14 19.5 20 25 T 32 25" fill="none" style="stroke:${c.a}" stroke-width="3" stroke-linecap="round"/>`;
      case 'arch':
        return `<path d="M5 37 V19 a15 15 0 0 1 30 0 V37 Z" style="fill:${c.p}"/><path d="M14 37 V21 a6 6 0 0 1 12 0 V37 Z" style="fill:${c.a}"/>`;
      default:
        return `<rect x="1" y="1" width="38" height="38" rx="9" style="fill:${c.p}"/><text x="20" y="20.5" text-anchor="middle" dominant-baseline="central" style="fill:${c.ink};font-family:${fontFamily};font-weight:700;font-size:${L.length > 2 ? 12.5 : 15.5}px;letter-spacing:0.02em">${L}</text>`;
    }
  }

  /** Inline mark that follows the surrounding context's --mark-* variables. */
  function markSVG(type, letters, cls) {
    const c = { p: 'var(--mark-p)', a: 'var(--mark-a)', ink: 'var(--mark-ink)' };
    return `<svg class="${cls || 'mark'}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${markBody(type, letters, c, 'var(--font-display)')}</svg>`;
  }

  function safeImage(src) {
    return typeof src === 'string' && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(src) ? src : '';
  }

  /** Logo lockup: uploaded image, or generated mark + wordmark. */
  function lockup(t, opts) {
    opts = opts || {};
    const logo = t.logo || {};
    const img = logo.type === 'image' ? safeImage(logo.image) : '';
    if (img) {
      return `<span class="lockup lockup-image${logo.plate ? ' has-plate' : ''}"><img class="logo-img" src="${img}" alt="${esc(t.name)}"></span>`;
    }
    const tag = t.tagline && !opts.compact ? `<span class="wm-tag">${esc(t.tagline)}</span>` : '';
    return `<span class="lockup">${markSVG(logo.type, logo.letters)}<span class="wm"><span class="wm-name">${esc(t.shortName || t.name)}</span>${tag}</span></span>`;
  }

  /* ---------- Applying a brand to the page ---------- */

  const block = (o) => Object.keys(o).map((k) => `--${k}:${o[k]};`).join('');
  let loadedFont = '';

  function loadFont(href) {
    if (!href || href === loadedFont) return;
    loadedFont = href;
    let link = document.getElementById('cv-tenant-font');
    if (!link) {
      link = document.createElement('link');
      link.id = 'cv-tenant-font';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = href;
  }

  function setFavicon(t, tk) {
    const logo = t.logo || {};
    let href;
    const img = logo.type === 'image' ? safeImage(logo.image) : '';
    if (img) href = img;
    else {
      const c = { p: tk.primary, a: tk.accent, ink: onColor(tk.primary) };
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${markBody(logo.type, logo.letters, c, 'Arial, sans-serif')}</svg>`;
      href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }

  function apply(t) {
    const tk = derive(t);
    const f = FONTS[t.font] || FONTS.funnel;
    const r = RADII[t.radius] || RADII.soft;
    let el = document.getElementById('cv-brand-tokens');
    if (!el) {
      // Appended at the end of <body> so it comes after the stylesheet defaults in the cascade.
      el = document.createElement('style');
      el.id = 'cv-brand-tokens';
      document.body.appendChild(el);
    }
    const base = `--font-display:${f.display};--font-body:${f.body};--r-sm:${r.sm}px;--r-md:${r.md}px;--r-lg:${r.lg}px;--r-card:${r.card}px;--r-inner:${r.inner}px;--r-pill:${r.pill};--display-weight:${f.weight || 500};--tracking-display:${f.tracking || '-0.02em'};`;
    el.textContent =
      `:root{${block(tk.light)}${block(tk.paper)}${base}}\n` +
      `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${block(tk.dark)}color-scheme:dark}}\n` +
      `:root[data-theme="dark"]{${block(tk.dark)}color-scheme:dark}`;
    loadFont(f.href);
    try {
      setFavicon(t, tk);
    } catch (e) {
      /* favicon is cosmetic */
    }
    return tk;
  }

  NS.brand = {
    normHex, contrast, ensureContrast, mix, onColor, deltaE, toOklch, oklch,
    FONTS, RADII, MARKS, STANDARD, derive, apply, markSVG, markBody, lockup, safeImage, esc
  };
})(window);
