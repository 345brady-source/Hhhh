/*
 * The engraved ground on the sign-in page: fine lathe-work lines in the firm's own colors, of the kind printed on
 * share certificates. Decoration only; it reads nothing and changes nothing.
 *
 * NS.engrave(canvas, seed) draws one still engraving: a field of fine wave lines, a rosette of interlaced closed
 * curves r(t) = R + a * sin(n * t + phase) set off the panel's centre so the panel crops it, and a border band of
 * interlaced waves between two rules. The seed (the firm's id) fixes the lobe counts, phases and ratios, so a firm
 * always gets the same engraving and different firms get different ones. Colors are read from the page's tokens at each
 * draw; nothing here moves.
 */
(function (NS) {
  'use strict';

  const TAU = Math.PI * 2;
  const HAIR = 0.6; // line width in CSS px

  // A small seeded generator (mulberry32 over an FNV-1a hash of the seed).
  function seeded(seed) {
    const s = String(seed || 'engrave');
    let a = 2166136261;
    for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 16777619);
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Everything a firm's engraving varies by, drawn from its seed in a fixed order.
  function recipe(seed) {
    const rnd = seeded(seed);
    const pick = (list) => list[Math.floor(rnd() * list.length)];
    const span = (lo, hi) => lo + rnd() * (hi - lo);
    return {
      cx: span(0.66, 0.76), cy: span(0.28, 0.38), size: span(0.5, 0.56),
      rim: { n: pick([40, 44, 48, 52, 56, 60]), k: pick([3, 4]), phase: span(0, TAU) },
      body: { n: pick([9, 10, 11, 12, 13, 14, 15, 16]), weave: span(0.78, 0.9), phase: span(0, TAU), h2: span(0.12, 0.42), psi: span(0, TAU), split: span(0.46, 0.54) },
      inner: { n: pick([14, 16, 18, 20, 22]), k: pick([4, 5, 6]), phase: span(0, TAU) },
      core: { n: pick([6, 7, 8, 9, 10, 11, 12]), weave: span(0.95, 1.15), phase: span(0, TAU), h2: span(0, 0.2), psi: span(0, TAU) },
      band: { wave: span(52, 76), k: pick([6, 8, 10]), phase: span(0, TAU), h2: span(0.1, 0.4), psi: span(0, TAU) },
      chain: { wave: span(20, 28), phase: span(0, TAU) },
      field: { wave: span(36, 60), drift: span(0.25, 0.7), gap: pick([5, 6]) }
    };
  }

  // The lathe's cam: a sine with one overtone, kept inside -1..1 so a curve never leaves its two envelopes.
  const cam = (a, h2, psi) => (Math.sin(a) + (h2 || 0) * Math.sin(2 * a + (psi || 0))) / (1 + (h2 || 0));

  // One ring of the rosette: k phase-shifted copies of r(t) = mid + half * cam(n * t + phase), interlaced.
  function ring(ctx, cx, cy, mid, half, o) {
    const steps = Math.max(o.n * 24, Math.ceil((TAU * (mid + half)) / 1.5));
    for (let i = 0; i < o.k; i++) {
      const ph = o.phase + (TAU * i) / o.k;
      ctx.beginPath();
      for (let s = 0; s < steps; s++) {
        const t = (TAU * s) / steps;
        const r = mid + half * cam(o.n * t + ph, o.h2, o.psi);
        ctx.lineTo(cx + r * Math.cos(t), cy + r * Math.sin(t));
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  function circle(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }

  // A ribbon across the panel: k phase-shifted waves between y - half and y + half.
  function ribbon(ctx, w, y, half, o, k) {
    for (let i = 0; i < k; i++) {
      const ph = o.phase + (TAU * i) / k;
      ctx.beginPath();
      for (let x = -2; x <= w + 2; x += 1.5) ctx.lineTo(x, y + half * cam((TAU * x) / o.wave + ph, o.h2, o.psi));
      ctx.stroke();
    }
  }

  function rule(ctx, w, y) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  function draw(canvas, seed) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const css = getComputedStyle(canvas);
    const token = (name) => css.getPropertyValue(name).trim();
    const brand = token('--brand'), accent = token('--accent'), fine = token('--fg-3');
    const p = recipe(seed);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = HAIR;
    ctx.lineJoin = 'round';
    const ink = (color, alpha) => { ctx.strokeStyle = color; ctx.globalAlpha = alpha; };

    // The ground: very fine parallel wave lines, each a little out of step with the one above.
    ink(fine, 0.12);
    for (let i = -1, y = -p.field.gap; y < h + p.field.gap; i++, y += p.field.gap) {
      ctx.beginPath();
      for (let x = -2; x <= w + 2; x += 3) ctx.lineTo(x, y + 2.5 * Math.sin((TAU * x) / p.field.wave + i * p.field.drift));
      ctx.stroke();
    }

    if (w < 160 || h < 240) return; // too small a panel takes the ground alone

    // The rosette, off centre and cropped by the panel, on clear ground above the border's strip.
    const by = h - 64, half = 17, top = by - half - 28; // the border band's middle, its half height, the top of its strip
    const cx = w * p.cx, cy = top * p.cy, R = Math.min(w, top) * p.size;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.05, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const cut = p.body.split, core = R * (cut - 0.175);
    const woven = (o, r) => Object.assign({ k: Math.max(6, Math.round((r * o.weave) / o.n)) }, o); // as many copies as keep the weave even
    ink(brand, 0.4);
    [1.012, 1, 0.9, 0.888].forEach((f) => circle(ctx, cx, cy, R * f));
    ink(brand, 0.55);
    ring(ctx, cx, cy, R * 0.944, R * 0.036, p.rim);
    ring(ctx, cx, cy, R * (0.872 + cut) / 2, R * (0.872 - cut) / 2, woven(p.body, R));
    ink(accent, 0.7);
    [cut - 0.016, cut - 0.028, cut - 0.14, cut - 0.152].forEach((f) => circle(ctx, cx, cy, R * f));
    ring(ctx, cx, cy, R * (cut - 0.084), R * 0.046, p.inner);
    ink(brand, 0.5);
    ring(ctx, cx, cy, core * 0.64, core * 0.36, woven(p.core, core));

    // The border: a broad band of interlaced waves between rules, and a fine chain above it.
    ctx.clearRect(0, top, w, h);
    ink(brand, 0.4);
    [-half - 8, -half - 5, half + 5, half + 8].forEach((d) => rule(ctx, w, Math.round(by + d) + 0.5));
    ink(brand, 0.55);
    ribbon(ctx, w, by, half, p.band, p.band.k);
    ink(accent, 0.7);
    ribbon(ctx, w, by - half - 17, 4, p.chain, 3);
    ink(fine, 0.12);
    for (let y = by + half + 14; y < h + p.field.gap; y += p.field.gap) rule(ctx, w, Math.round(y) + 0.5);
    ctx.globalAlpha = 1;
  }

  let stop = null; // ends the watch on the canvas drawn last

  NS.engrave = function (canvas, seed) {
    if (stop) stop();
    if (!canvas || !canvas.getContext) return;
    let seen = '';
    const redraw = (force) => {
      if (!canvas.isConnected) return end();
      const size = canvas.clientWidth + 'x' + canvas.clientHeight;
      if (force !== true && size === seen) return;
      seen = size;
      draw(canvas, seed);
    };
    const recolor = () => redraw(true);
    const Watch = typeof MutationObserver === 'function' ? MutationObserver : null;
    const sized = typeof ResizeObserver === 'function' ? new ResizeObserver(redraw) : null;
    const themed = Watch ? new Watch(recolor) : null;
    // A hidden canvas (the panel is not shown on a phone) has no size to lose, so its removal is watched for directly.
    const gone = Watch ? new Watch(() => { if (!canvas.isConnected) end(); }) : null;
    const scheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const end = () => {
      if (sized) sized.disconnect();
      if (themed) themed.disconnect();
      if (gone) gone.disconnect();
      if (scheme && scheme.removeEventListener) scheme.removeEventListener('change', recolor);
      if (stop === end) stop = null;
    };
    stop = end;
    if (sized) sized.observe(canvas);
    if (themed) themed.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (gone) gone.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    if (scheme && scheme.addEventListener) scheme.addEventListener('change', recolor);
    redraw();
  };
})(window.CVPortal);
