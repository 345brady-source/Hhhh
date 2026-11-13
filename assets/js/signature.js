/*
 * Signatures: the dialog where a signer sets their signature and their initials, once, for every field they sign.
 * Three ways to make them: typed in one of six handwriting styles, drawn with a finger, mouse or pen, or taken from an
 * image of a signature on paper. Whatever the way, the result is two pictures (PNG, clear background), one for the
 * signature and one for the initials, each with the style and ink it was made in: the signed PDF paints pictures.
 *
 * esign.js keeps the signing itself. It opens this dialog from a signature or initials field (open) and, when the
 * signer selects Adopt and sign, asks for what they made (result). Nothing here leaves the browser: an image is read,
 * cleaned and trimmed on this device. The handwriting faces are fetched the first time the dialog opens, not before.
 */
(function (NS) {
  'use strict';
  const U = NS.ui;
  const { h, icon } = U;

  /* ---------- Styles, inks and sizes ---------- */
  // Each style's face is a token in esign.css (--es-hand-…): the first family named there is the one fetched.
  // `optical` evens out how large the faces look at one size (a formal script's small letters are tiny beside a marker's).
  const STYLES = [
    { id: 'formal', label: 'Formal', token: '--es-hand-formal', weight: 400, optical: 1.04 },
    { id: 'flowing', label: 'Flowing', token: '--es-hand-flowing', weight: 400, optical: 1.3 },
    { id: 'casual', label: 'Casual', token: '--es-hand-casual', weight: 500, optical: 0.96 },
    { id: 'quick', label: 'Quick', token: '--es-hand-quick', weight: 400, optical: 0.8 },
    { id: 'neat', label: 'Neat', token: '--es-hand-neat', weight: 400, optical: 0.84 },
    { id: 'bold', label: 'Bold', token: '--es-hand-bold', weight: 400, optical: 0.92 }
  ];
  const INKS = [
    { id: 'blue', label: 'Blue', token: '--es-ink-blue' },
    { id: 'black', label: 'Black', token: '--es-ink-black' }
  ];
  const TABS = [
    { id: 'type', label: 'Type' },
    { id: 'draw', label: 'Draw' },
    { id: 'upload', label: 'Upload' }
  ];
  const KINDS = ['signature', 'initials'];
  const CAP = { signature: 'Signature', initials: 'Initials' };
  // The largest picture kept for each: about 240 dots to the inch on a signature line and an initials box of ordinary
  // size, which prints sharply and keeps a signed agreement's record small.
  const OUT = { signature: { w: 600, h: 200 }, initials: { w: 240, h: 150 } };
  const FACES_URL = 'https://fonts.googleapis.com/css2';
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  // The pen: width in CSS pixels (thinner when the hand moves fast, or by pressure with a stylus), how closely the line
  // follows the pointer (1 = exactly, less = steadier) and the shortest move worth keeping.
  const PEN = { min: 1.2, max: 3.6, follow: 0.62, step: 0.8 };

  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const styleOf = (id) => STYLES.find((s) => s.id === id) || STYLES[0];
  const families = {};
  const familyOf = (s) => families[s.id] || (families[s.id] = token(s.token) || 'cursive');
  const faceOf = (s) => (familyOf(s).split(',')[0] || '').trim().replace(/^["']|["']$/g, '');
  const inkOf = (id) => token((INKS.find((k) => k.id === id) || INKS[0]).token) || getComputedStyle(document.body).color;
  const initialsFrom = (name) =>
    String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase())
      .slice(0, 3)
      .join('');
  const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
  const within = (p, ms) => Promise.race([p, wait(ms, false)]);
  const round = (n) => Math.round(n * 100) / 100;
  const blank = (w, hgt) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(hgt));
    return c;
  };

  /* ---------- The handwriting faces, fetched when the dialog first opens ---------- */
  let sheet = null;
  let failedAt = 0;
  const faceIn = {};
  const facesIn = () => STYLES.every((s) => faceIn[s.id]);
  function loadSheet() {
    if (sheet) return sheet;
    // After a failure the request is not made again for a little while (every letter typed asks for the faces).
    if (Date.now() - failedAt < 15000) return Promise.resolve(false);
    sheet = new Promise((resolve) => {
      const link = document.createElement('link');
      link.id = 'sg-faces';
      link.rel = 'stylesheet';
      link.href = `${FACES_URL}?${STYLES.map((s) => `family=${encodeURIComponent(faceOf(s)).replace(/%20/g, '+')}${s.weight === 400 ? '' : `:wght@${s.weight}`}`).join('&')}&display=swap`;
      link.onload = () => resolve(true);
      // Offline, or the request was blocked: the styles fall back to the device's own script faces, and a later
      // opening of the dialog tries again.
      link.onerror = () => {
        link.remove();
        sheet = null;
        failedAt = Date.now();
        resolve(false);
      };
      document.head.appendChild(link);
    });
    return sheet;
  }
  /** Resolves true once the style's face is in, with every part of it that `text` needs (accented letters come apart). */
  function loadFace(s, text) {
    return loadSheet().then((ok) => {
      if (!ok || !document.fonts || !document.fonts.load) return false;
      return document.fonts.load(`${s.weight} 48px "${faceOf(s)}"`, `${text || ''}A`).then(
        (got) => {
          if (got.length) faceIn[s.id] = true;
          return got.length > 0;
        },
        () => false
      );
    });
  }
  const loadFaces = (text) => Promise.all(STYLES.map((s) => loadFace(s, text)));

  /* ---------- Measuring and fitting handwriting ---------- */
  let mctx = null;
  /**
   * Whether a style's face has every letter of `text`. A face with a letter missing borrows it from another face, and a
   * signature in two hands looks wrong: the text is measured twice, with two different stand-in faces behind the style's
   * own, and any difference means a letter was borrowed. A face that never arrived is not judged.
   */
  function covers(s, text) {
    if (!faceIn[s.id] || !text) return true;
    mctx = mctx || blank(4, 4).getContext('2d');
    const wide = (behind) => {
      mctx.font = `${s.weight} 40px "${faceOf(s)}", ${behind}`;
      return mctx.measureText(text).width;
    };
    return Math.abs(wide('serif') - wide('monospace')) < 0.01;
  }
  /** The ink of `text` in a style at `px`: how far it reaches left of its start, its width, and above and below its baseline. */
  function measure(text, s, px) {
    mctx = mctx || blank(4, 4).getContext('2d');
    mctx.font = `${s.weight} ${px}px ${familyOf(s)}`;
    const m = mctx.measureText(text);
    const left = Math.max(0, m.actualBoundingBoxLeft || 0);
    return { left, w: left + Math.max(m.actualBoundingBoxRight || 0, m.width), asc: m.actualBoundingBoxAscent || px * 0.8, desc: Math.max(0, m.actualBoundingBoxDescent || 0) };
  }
  /**
   * Size a line of handwriting to its place: as large as its style allows while the ink stays inside the width, under
   * the top edge and clear of what is below the line it is written on (the CSS sets its baseline on that line).
   */
  function fitHand(el) {
    const ink = el.firstElementChild;
    const text = ink ? ink.textContent : '';
    const wide = el.clientWidth;
    if (!wide || !text) return;
    const s = styleOf(el.getAttribute('data-style'));
    const line = parseFloat(getComputedStyle(el).bottom) || 0;
    const up = el.parentElement.clientHeight - line - 8;
    // On the sheet a tail may dip a little into the caption's row, as a pen does below a printed line.
    const down = Math.max(8, line - 2 + (el.closest('.sg-cell') ? 8 : 0));
    const m = measure(text, s, 100);
    const max = (Number(el.getAttribute('data-max')) || 48) * s.optical;
    const size = Math.max(11, Math.min(max, (100 * wide) / m.w, (100 * up) / m.asc, m.desc ? (100 * down) / m.desc : max));
    ink.style.fontSize = `${size.toFixed(1)}px`;
  }
  const refit = () => document.querySelectorAll('#dlg .sg .sg-hand').forEach(fitHand);

  /* ---------- Pictures ---------- */
  /** Crop a canvas to its ink (with a little air) and return it as a PNG data URL no larger than max. */
  function trim(c, max) {
    const ctx = c.getContext('2d');
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width;
    let y0 = c.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (px[(y * c.width + x) * 4 + 3] > 12) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return null;
    const air = Math.max(4, Math.round(Math.max(x1 - x0, y1 - y0) * 0.012));
    x0 = Math.max(0, x0 - air);
    y0 = Math.max(0, y0 - air);
    x1 = Math.min(c.width - 1, x1 + air);
    y1 = Math.min(c.height - 1, y1 + air);
    const w = x1 - x0 + 1;
    const hgt = y1 - y0 + 1;
    const k = Math.min(1, max.w / w, max.h / hgt);
    const o = blank(w * k, hgt * k);
    const octx = o.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(c, x0, y0, w, hgt, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }
  /** A typed signature or initials as a picture: the text in the style's face and the chosen ink, on nothing. */
  async function typedPng(text, styleId, inkId, kind) {
    const s = styleOf(styleId);
    await within(loadFace(s, text), 6000);
    const c = blank(1400, 460);
    const ctx = c.getContext('2d');
    const m = measure(text, s, 200);
    // Flourishes reach well outside the letters' own box: the size is set from the ink, so none of it is cut off.
    const size = Math.max(24, Math.min(240, (200 * (c.width - 80)) / m.w, (200 * (c.height - 60)) / (m.asc + m.desc || 1)));
    ctx.font = `${s.weight} ${size}px ${familyOf(s)}`;
    ctx.fillStyle = inkOf(inkId);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 40 + (m.left * size) / 200, 30 + (m.asc * size) / 200);
    return trim(c, OUT[kind === 'initials' ? 'initials' : 'signature']);
  }
  /**
   * Make the paper transparent so only the ink is left. The paper's shade is read from the image's edges (white, cream
   * or a grey photo of a page) and the ink's from its darkest pixels; pixels near the paper fade out, pixels near the
   * ink stay. An image with too little contrast has no ink.
   */
  function knockOutPaper(ctx, w, hgt) {
    const id = ctx.getImageData(0, 0, w, hgt);
    const px = id.data;
    const lum = (i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const edge = [];
    const take = (x, y) => {
      const i = (y * w + x) * 4;
      if (px[i + 3] > 200) edge.push(lum(i));
    };
    const sx = Math.max(1, Math.floor(w / 200));
    const sy = Math.max(1, Math.floor(hgt / 200));
    for (let x = 0; x < w; x += sx) {
      take(x, 0);
      take(x, hgt - 1);
    }
    for (let y = 0; y < hgt; y += sy) {
      take(0, y);
      take(w - 1, y);
    }
    if (edge.length < 8) {
      // Already clear around the ink (a cut-out): only near-white pixels go.
      for (let i = 0; i < px.length; i += 4) if (lum(i) > 235) px[i + 3] = 0;
      ctx.putImageData(id, 0, 0);
      return;
    }
    edge.sort((a, b) => a - b);
    const paper = edge[Math.floor(edge.length / 2)];
    const hist = new Array(256).fill(0);
    let n = 0;
    for (let i = 0; i < px.length; i += 4)
      if (px[i + 3] > 200) {
        hist[Math.max(0, Math.min(255, Math.round(lum(i))))]++;
        n++;
      }
    let inkL = 0;
    for (let k = 0, acc = 0; k < 256; k++) {
      acc += hist[k];
      if (acc >= n * 0.005) {
        inkL = k;
        break;
      }
    }
    const span = paper - inkL;
    const clear = paper - span * 0.25;
    const solid = inkL + span * 0.45;
    for (let i = 0; i < px.length; i += 4) {
      if (span < 40) {
        px[i + 3] = 0;
        continue;
      }
      const L = lum(i);
      const a = L >= clear ? 0 : L <= solid ? 1 : (clear - L) / (clear - solid);
      px[i + 3] = Math.round(px[i + 3] * a);
    }
    ctx.putImageData(id, 0, 0);
  }
  /** An image of a signature on paper, as a picture of the ink alone: paper removed, margins trimmed. Null if no ink is found. */
  function clean(img, kind) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return null;
    const k = Math.min(1, 1600 / iw, 1200 / ih);
    const c = blank(iw * k, ih * k);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    knockOutPaper(ctx, c.width, c.height);
    return trim(c, OUT[kind === 'initials' ? 'initials' : 'signature']);
  }
  const readImage = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('unreadable'));
      };
      img.src = url;
    });

  /* ---------- Drawing ---------- */
  /**
   * The line the pen leaves through the points a pointer gave: each corner is rounded into a curve through the midpoints
   * of the moves on either side of it, so the stroke bends where the hand turned and has no straight-sided corners.
   * Returns the points actually painted, each with the width of the line there.
   */
  function smooth(pts) {
    const n = pts.length;
    const out = [];
    if (!n) return out;
    out.push({ x: pts[0].x, y: pts[0].y, w: pts[0].w });
    if (n === 1) return out;
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: (a.w + b.w) / 2 });
    const line = (a, b) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t });
      }
    };
    const curve = (a, c, b) => {
      const l1 = Math.hypot(c.x - a.x, c.y - a.y);
      const l2 = Math.hypot(b.x - c.x, b.y - c.y);
      const dot = l1 && l2 ? ((c.x - a.x) * (b.x - c.x) + (c.y - a.y) * (b.y - c.y)) / (l1 * l2) : 1;
      const turn = Math.acos(Math.max(-1, Math.min(1, dot)));
      // Enough steps that no one of them turns more than a few degrees, however sharp the corner.
      const steps = Math.max(2, Math.ceil((l1 + l2) / 3), Math.ceil(turn / 0.09));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        out.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y, w: u * u * a.w + 2 * u * t * c.w + t * t * b.w });
      }
    };
    if (n === 2) {
      line(pts[0], pts[1]);
      return out;
    }
    let from = mid(pts[0], pts[1]);
    line(pts[0], from);
    for (let i = 1; i < n - 1; i++) {
      const to = mid(pts[i], pts[i + 1]);
      curve(from, pts[i], to);
      from = to;
    }
    line(from, pts[n - 1]);
    return out;
  }
  function paintStrokes(ctx, strokes, color) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    strokes.forEach((pts) => {
      const path = smooth(pts);
      if (path.length === 1) {
        // A tap: a dot, as a pen leaves.
        ctx.beginPath();
        ctx.arc(path[0].x, path[0].y, path[0].w * 0.6, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      for (let i = 1; i < path.length; i++) {
        ctx.lineWidth = (path[i - 1].w + path[i].w) / 2;
        ctx.beginPath();
        ctx.moveTo(path[i - 1].x, path[i - 1].y);
        ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
      }
    });
  }
  /** What was drawn in a pad, as a picture. */
  function drawnPng(d, k) {
    const box = d.box[k];
    if (!box || !d.strokes[k].length) return null;
    const scale = 3;
    const c = blank(box.w * scale, box.h * scale);
    const ctx = c.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    paintStrokes(ctx, d.strokes[k], inkOf(d.ink));
    return trim(c, OUT[k]);
  }
  /**
   * A drawing pad on a canvas: pointer events from a mouse, a finger or a pen, kept as strokes in the pad's own units so
   * they survive a resize, an undo and a change of ink. The canvas holds a device pixel for every screen pixel.
   */
  function makePad(canvas, k, d, changed) {
    const ctx = canvas.getContext('2d');
    let w = 0;
    let hgt = 0;
    let dpr = 1;
    let live = null;
    let raf = 0;
    // Strokes are kept in the units of the pad as it was when the first was drawn: on another size they are fitted in.
    const view = () => {
      const b = d.box[k];
      if (!b || !w) return { s: 1, x: 0, y: 0 };
      const s = Math.min(w / b.w, hgt / b.h);
      return { s, x: (w - b.w * s) / 2, y: (hgt - b.h * s) / 2 };
    };
    function paint() {
      raf = 0;
      if (!w) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const v = view();
      ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.x, dpr * v.y);
      paintStrokes(ctx, d.strokes[k], inkOf(d.ink));
    }
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    function resize() {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const r = Math.min(3, window.devicePixelRatio || 1);
      if (!cw || !ch || (cw === w && ch === hgt && r === dpr)) return;
      w = cw;
      hgt = ch;
      dpr = r;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hgt * dpr);
      paint();
    }
    function add(e, last) {
      const r = canvas.getBoundingClientRect();
      const v = view();
      let x = (((e.clientX - r.left) * w) / (r.width || w) - v.x) / v.s;
      let y = (((e.clientY - r.top) * hgt) / (r.height || hgt) - v.y) / v.s;
      const pts = live.pts;
      const prev = pts[pts.length - 1];
      if (prev) {
        // The line trails the pointer a little, which steadies a shaky hand; the final point lands where the pen lifted.
        if (!last) {
          x = prev.x + (x - prev.x) * PEN.follow;
          y = prev.y + (y - prev.y) * PEN.follow;
        }
        const dist = Math.hypot(x - prev.x, y - prev.y);
        if (dist < PEN.step) return;
        live.v = 0.65 * (dist / Math.max(1, e.timeStamp - live.t)) + 0.35 * live.v;
      }
      live.t = e.timeStamp;
      // A stylus gives its pressure; a mouse and a finger do not, so their line thins as the hand speeds up.
      const want = live.pen && e.pressure > 0 && !last ? PEN.min + (PEN.max + 0.6 - PEN.min) * Math.pow(e.pressure, 0.8) : Math.max(PEN.min, PEN.max / (1 + live.v * 1.4));
      const wide = prev ? prev.w + (want - prev.w) * 0.35 : (PEN.min + want) / 2;
      pts.push({ x: round(x), y: round(y), w: round(last && prev ? wide * 0.8 : wide) });
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (live || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* a pointer that cannot be captured still draws */
      }
      resize();
      if (!d.strokes[k].length) d.box[k] = { w, h: hgt };
      live = { id: e.pointerId, pts: [], v: 0, t: e.timeStamp, pen: e.pointerType === 'pen' };
      add(e);
      d.strokes[k].push(live.pts);
      changed(k);
      queue();
    });
    const lift = (e) => {
      if (!live || e.pointerId !== live.id) return;
      if (e.type === 'pointerup') add(e, true);
      live = null;
      queue();
    };
    canvas.addEventListener('pointermove', (e) => {
      if (!live || e.pointerId !== live.id) return;
      // The button was let go somewhere the pad could not see: the stroke ends where it had got to.
      if (e.pointerType === 'mouse' && e.buttons === 0) return lift(e);
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      (evs.length ? evs : [e]).forEach((ev) => add(ev));
      queue();
    });
    canvas.addEventListener('pointerup', lift);
    canvas.addEventListener('pointercancel', lift);
    canvas.addEventListener('lostpointercapture', lift);
    // The page behind must not scroll or select while a finger draws (touch-action covers this where it is supported).
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    return { resize, paint, busy: () => !!live };
  }

  /* ---------- The dialog ---------- */
  let d = null; // what the open dialog holds
  let pads = null;
  let watcher = null;
  // What each signer last adopted, kept while the page is open so the dialog reopens on it (their strokes included).
  const adoptedBy = {};
  const copy = (o) => JSON.parse(JSON.stringify(o));
  const root = () => document.querySelector('#dlg[open] .sg');
  const typedInitials = () => String(d.text.initials || '').trim() || initialsFrom(d.text.signature);

  function fresh(o) {
    const a = (o.adopted && o.adopted.signature) || null;
    const ai = (o.adopted && o.adopted.initials) || null;
    // A signature adopted before the styles existed was typed in the casual hand.
    const style = a && STYLES.some((s) => s.id === a.style) ? a.style : a && a.kind === 'typed' ? 'casual' : STYLES[0].id;
    const ini = ai && ai.kind === 'typed' && ai.text ? String(ai.text) : '';
    return {
      tab: 'type',
      style,
      ink: a && INKS.some((k) => k.id === a.ink) ? a.ink : INKS[0].id,
      text: { signature: a && a.kind === 'typed' && a.text ? String(a.text) : String(o.name || ''), initials: ini },
      edited: !!ini,
      strokes: { signature: [], initials: [] },
      box: {},
      upload: { signature: null, initials: null }
    };
  }
  // A line of handwriting takes its face from its style's token: the six faces are named in one place, the token block.
  const faceCss = (s) => `font-family:var(${s.token});font-weight:${s.weight}`;
  const hand = (k, style, max, text, cls) => `<span class="sg-hand${cls ? ' ' + cls : ''}" data-k="${k}" data-style="${h(style)}" data-max="${max}"><span class="sg-hand-ink" style="${faceCss(styleOf(style))}">${h(text)}</span></span>`;
  const cell = (k, extra, stage, acts) =>
    `<div class="sg-cell sg-cell-${k}${extra ? ' ' + extra : ''}" data-k="${k}"><div class="sg-stage">${stage}</div><div class="sg-cap"><span class="sg-cap-name">${CAP[k]}</span>${acts ? `<span class="sg-acts">${acts}</span>` : ''}</div></div>`;
  const act = (action, k, label, aria) => `<button class="sg-padbtn" type="button" data-action="${action}" data-k="${k}" aria-label="${h(aria)}">${label}</button>`;

  function html() {
    // In the console the dialog wears the console's controls; wherever an investor signs, the portal's.
    const con = document.body.classList.contains('mode-console');
    const btn = con ? 'cs-btn' : 'btn';
    const field = con ? 'cs-field' : 'field';
    const hint = con ? 'cs-hint' : 'hint';
    const name = d.text.signature;
    const ini = typedInitials();
    const tabs = TABS.map((t) => `<button class="sg-tabbtn" type="button" role="tab" id="sg-tab-${t.id}" aria-controls="sg-pane-${t.id}" aria-selected="${t.id === d.tab}" tabindex="${t.id === d.tab ? 0 : -1}" data-action="sg-tab" data-t="${t.id}"${t.id === d.tab ? ' autofocus' : ''}>${t.label}</button>`).join('');
    const inks = INKS.map((k) => `<label class="sg-inkopt" title="${k.label} ink"><input type="radio" name="sg-ink" value="${k.id}" data-change="sg-ink" aria-label="${k.label} ink"${k.id === d.ink ? ' checked' : ''}><span class="sg-inkchip"><i class="sg-dot" data-ink="${k.id}" aria-hidden="true"></i><span class="sg-inkname">${k.label}</span></span></label>`).join('');
    const styles = STYLES.map(
      (s) =>
        `<label class="sg-style" title="${s.label}"><input type="radio" name="sg-style" value="${s.id}" data-change="sg-style" aria-label="${s.label}"${s.id === d.style ? ' checked' : ''}><span class="sg-style-box">${hand('signature', s.id, 34, name, 'sg-hand-fixed')}<i class="sg-style-tick" aria-hidden="true">${icon('check')}</i></span></label>`
    ).join('');
    const pane = (id, body) => `<div class="sg-pane sg-pane-${id}" id="sg-pane-${id}" role="tabpanel" aria-labelledby="sg-tab-${id}"${id === d.tab ? '' : ' hidden'}>${body}</div>`;
    const pad = (k) => `<canvas class="sg-pad" data-k="${k}" role="img" aria-label="Drawing area for your ${k}"></canvas>`;
    const drawActs = (k) => act('sg-undo', k, 'Undo', `Undo the last stroke of your ${k}`) + act('sg-clear', k, 'Clear', `Clear your drawn ${k}`);
    const file = (k) => `<input type="file" id="sg-file-${k}" accept="image/png,image/jpeg,.png,.jpg,.jpeg" data-change="sg-file" data-k="${k}" hidden>`;
    const upActs = (k) => act('sg-file-pick', k, k === 'initials' && !d.upload[k] ? 'Add image' : 'Replace', k === 'initials' && !d.upload[k] ? 'Add an image of your initials' : `Replace the image of your ${k}`) + act('sg-file-remove', k, 'Remove', `Remove the image of your ${k}`);
    return `<div class="dlg-head"><div><h2 id="sg-title">Adopt your signature</h2><p>Set your signature and initials once. One tap then places them on each field you sign.</p></div><button class="${con ? 'cs-icon' : 'icon-btn'}" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body es-adopt sg${facesIn() ? '' : ' is-loading'}" data-tab="${d.tab}" data-ink="${d.ink}">
        <div class="sg-bar">
          <div class="sg-switch" role="tablist" aria-label="How to create your signature">${tabs}</div>
          <div class="sg-inks" role="radiogroup" aria-labelledby="sg-ink-label"><span class="sg-label" id="sg-ink-label">Ink</span><div class="sg-inkswitch">${inks}</div></div>
        </div>
        ${pane(
          'type',
          `<div class="sg-sheet">${cell('signature', '', hand('signature', d.style, 70, name))}${cell('initials', '', hand('initials', d.style, 58, ini))}</div>
          <fieldset class="sg-styles"><legend class="sg-label">Style</legend><div class="sg-style-grid">${styles}</div></fieldset>
          <div class="sg-fields">
            <label class="${field}" for="es-type-text"><span>Full name</span><input id="es-type-text" type="text" maxlength="60" value="${h(name)}" data-input="es-type-text" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done"></label>
            <label class="${field}" for="sg-initials-text"><span>Initials</span><input id="sg-initials-text" type="text" maxlength="6" value="${h(d.edited ? d.text.initials : ini)}" data-input="sg-initials" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done"></label>
          </div>`
        )}
        ${pane(
          'draw',
          `<div class="sg-sheet sg-sheet-stack">${cell('signature', '', `<span class="sg-prompt">Draw your signature here</span>${pad('signature')}`, drawActs('signature'))}${cell('initials', '', `${hand('initials', d.style, 52, ini, 'sg-hand-default')}${pad('initials')}`, drawActs('initials'))}</div>
          <p class="${hint} sg-hint">Use your finger, a mouse or a pen. Your initials are written for you unless you draw them.</p>`
        )}
        ${pane(
          'upload',
          `<div class="sg-sheet sg-sheet-stack">${cell('signature', 'sg-drop', `<div class="sg-empty"><button class="sg-choosebtn" type="button" data-action="sg-file-pick" data-k="signature">Choose an image</button><span>PNG or JPG, or drop one here</span></div><img class="sg-img" alt="Your signature, from the image" hidden>${file('signature')}`, upActs('signature'))}${cell('initials', 'sg-drop', `${hand('initials', d.style, 52, ini, 'sg-hand-default')}<img class="sg-img" alt="Your initials, from the image" hidden>${file('initials')}`, upActs('initials'))}</div>
          <p class="${hint} sg-hint">A photo or scan of your signature on white paper works best. It is cleaned up on this device and is not sent anywhere. Your initials are written for you unless you add an image of them.</p>`
        )}
      </div>
      <div class="sg-foot">
        <p class="sg-legal">By selecting Adopt and sign, I agree that these marks are my electronic signature and initials, with the same effect as my handwritten signature and initials on this document.</p>
        <p class="field-error" id="es-adopt-err" role="alert"></p>
        <div class="sg-actions">${d.placed ? `<button class="${btn} sg-remove" type="button" data-action="es-sig-clear">Remove from this field</button>` : ''}<button class="${btn}" type="button" data-action="close-dialog">Cancel</button><button class="${btn} ${btn}-primary" type="button" data-action="es-adopt">Adopt and sign</button></div>
      </div>`;
  }

  const setError = (msg) => {
    const el = document.getElementById('es-adopt-err');
    if (el) el.textContent = msg || '';
  };
  /** Bring each cell in step with what it holds: ink or none, which actions apply, the picture of an upload. */
  function syncCells() {
    const r = root();
    if (!r) return;
    KINDS.forEach((k) => {
      const drawn = d.strokes[k].length > 0;
      const dc = r.querySelector(`.sg-pane-draw .sg-cell-${k}`);
      dc.classList.toggle('has-ink', drawn);
      dc.querySelectorAll('.sg-padbtn').forEach((b) => b.setAttribute('aria-disabled', String(!drawn)));
      const uc = r.querySelector(`.sg-pane-upload .sg-cell-${k}`);
      const png = d.upload[k];
      uc.classList.toggle('has-ink', !!png);
      const img = uc.querySelector('.sg-img');
      img.hidden = !png;
      if (png) img.src = png;
      else img.removeAttribute('src');
      const pick = uc.querySelector('[data-action="sg-file-pick"].sg-padbtn');
      const none = k === 'initials' && !png;
      pick.textContent = none ? 'Add image' : 'Replace';
      pick.setAttribute('aria-label', none ? 'Add an image of your initials' : `Replace the image of your ${k}`);
      pick.hidden = k === 'signature' && !png;
      uc.querySelector('[data-action="sg-file-remove"]').hidden = !png;
    });
  }
  function setTab(id) {
    const r = root();
    if (!r || !TABS.some((t) => t.id === id)) return;
    d.tab = id;
    r.setAttribute('data-tab', id);
    TABS.forEach((t) => {
      const on = t.id === id;
      const tb = document.getElementById(`sg-tab-${t.id}`);
      tb.setAttribute('aria-selected', String(on));
      tb.tabIndex = on ? 0 : -1;
      document.getElementById(`sg-pane-${t.id}`).hidden = !on;
    });
    setError('');
    if (pads) KINDS.forEach((k) => pads[k].resize());
    refit();
  }
  function setText(k, value) {
    const r = root();
    if (!r) return;
    d.text[k] = value;
    if (k === 'initials') d.edited = value.trim() !== '';
    const ini = typedInitials();
    if (k === 'signature') {
      r.querySelectorAll('.sg-hand[data-k="signature"] .sg-hand-ink').forEach((el) => (el.textContent = value));
      const box = document.getElementById('sg-initials-text');
      if (!d.edited && box) box.value = ini;
    }
    r.querySelectorAll('.sg-hand[data-k="initials"] .sg-hand-ink').forEach((el) => (el.textContent = ini));
    setError('');
    refit();
    // A letter not typed before may need a part of a face that is not in yet (accented letters come apart).
    const mine = d;
    loadFaces(`${value} ${ini}`).then(() => {
      if (d !== mine || root() !== r) return;
      syncStyles();
      refit();
    });
  }
  /** Choose a style: the sheet, and the initials written for the signer in the other tabs, take its face. */
  function pick(id) {
    const r = root();
    if (!r) return;
    d.style = styleOf(id).id;
    const input = r.querySelector(`.sg-style input[value="${d.style}"]`);
    if (input) input.checked = true;
    r.querySelectorAll('.sg-hand:not(.sg-hand-fixed)').forEach((x) => {
      x.setAttribute('data-style', d.style);
      // The size set for the last face is dropped with it; refit sets the new one.
      x.firstElementChild.style.cssText = faceCss(styleOf(d.style));
    });
    refit();
  }
  /**
   * A style whose face lacks a letter of the name (Ł, ő, ễ … in some of them) is set aside while that name stands, and
   * the choice moves off it. When no style has every letter (a name in another script), all stay: each then writes it
   * in the device's own face.
   */
  function syncStyles() {
    const r = root();
    if (!r) return;
    const text = `${d.text.signature} ${typedInitials()}`;
    const can = STYLES.map((s) => covers(s, text));
    const any = can.some(Boolean);
    STYLES.forEach((s, i) => {
      const input = r.querySelector(`.sg-style input[value="${s.id}"]`);
      const off = any && !can[i];
      input.disabled = off;
      input.setAttribute('aria-label', off ? `${s.label} (cannot write every letter of this name)` : s.label);
      input.closest('.sg-style').title = off ? `${s.label}: this style cannot write every letter of this name` : s.label;
    });
    if (any && !can[STYLES.indexOf(styleOf(d.style))]) pick(STYLES[can.indexOf(true)].id);
  }

  function open(o) {
    o = o || {};
    const key = String(o.key || '');
    d = adoptedBy[key] ? copy(adoptedBy[key]) : fresh(o);
    d.key = key;
    d.placed = !!o.placed;
    d.busy = false;
    const first = !facesIn();
    U.dialog(html(), 'dlg-es dlg-es-adopt sg-dlg');
    const dlg = document.getElementById('dlg');
    const r = root();
    if (!r) return;
    dlg.setAttribute('aria-labelledby', 'sg-title');
    if (watcher) watcher.disconnect();
    pads = {};
    KINDS.forEach((k) => (pads[k] = makePad(r.querySelector(`.sg-pad[data-k="${k}"]`), k, d, syncCells)));
    // The pads and the handwriting follow the dialog's size: a phone turned on its side, a window made narrower.
    if (window.ResizeObserver) {
      watcher = new ResizeObserver(() => {
        if (!r.isConnected) return watcher.disconnect();
        KINDS.forEach((k) => pads[k].resize());
        refit();
      });
      watcher.observe(r);
    }
    r.querySelectorAll('.sg-drop').forEach((c) => {
      const k = c.getAttribute('data-k');
      c.addEventListener('dragover', (e) => {
        e.preventDefault();
        c.classList.add('is-over');
      });
      c.addEventListener('dragleave', () => c.classList.remove('is-over'));
      c.addEventListener('drop', (e) => {
        e.preventDefault();
        c.classList.remove('is-over');
        takeFile(k, e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
      });
    });
    dlg.addEventListener(
      'close',
      () => {
        if (watcher) watcher.disconnect();
        dlg.removeAttribute('aria-labelledby');
      },
      { once: true }
    );
    syncCells();
    KINDS.forEach((k) => pads[k].resize());
    refit();
    // The faces arrive a moment after the dialog the first time: the handwriting shows once they are in (or, with no
    // connection, in the device's own script faces after a short wait).
    const text = `${d.text.signature} ${typedInitials()}`;
    const faces = loadFaces(text);
    const show = () => {
      if (!r.isConnected) return;
      r.classList.remove('is-loading');
      syncStyles();
      refit();
    };
    if (first) within(faces, 2500).then(show);
    faces.then(show);
  }

  async function takeFile(k, file) {
    if (!d || !file || !root()) return;
    setError('');
    if (!/^image\/(png|jpeg)$/.test(file.type || '') && !(!file.type && /\.(png|jpe?g)$/i.test(file.name || ''))) return setError('Choose a PNG or JPG image.');
    if (file.size > MAX_IMAGE_BYTES) return setError('This image is too large. Choose one under 20 MB.');
    const mine = d;
    let png = null;
    try {
      png = clean(await readImage(file), k);
    } catch (e) {
      return setError('This image could not be read. Choose another.');
    }
    if (d !== mine || !root()) return;
    if (!png) return setError(`No ink was found in this image. Use a photo of your ${k} in dark ink on plain white paper.`);
    d.upload[k] = png;
    syncCells();
  }

  /**
   * What the signer made, for esign.js to adopt: { signature, initials }, each { kind, text, png, style, ink } with png a
   * PNG data URL on a clear background. Null when something is missing; the dialog then says what.
   */
  async function result() {
    const r = root();
    if (!d || !r || d.busy) return null;
    const mine = d;
    const fail = (msg, sel) => {
      setError(msg);
      const el = sel ? r.querySelector(sel) : null;
      if (el) el.focus();
      return null;
    };
    const name = String(d.text.signature || '').trim();
    const ini = typedInitials();
    const typed = async (k, text) => ({ kind: 'typed', text, png: await typedPng(text, d.style, d.ink, k), style: d.style, ink: d.ink });
    const drawn = (k) => ({ kind: 'drawn', text: '', png: drawnPng(d, k), style: 'drawn', ink: d.ink });
    const uploaded = (k) => ({ kind: 'uploaded', text: '', png: d.upload[k], style: 'uploaded', ink: '' });
    if (d.tab === 'type' && !name) return fail('Type your name.', '#es-type-text');
    if (d.tab === 'draw' && !d.strokes.signature.length) return fail('Draw your signature first.');
    if (d.tab === 'upload' && !d.upload.signature) return fail('Choose an image of your signature first.', '.sg-choosebtn');
    const own = d.tab === 'draw' ? d.strokes.initials.length > 0 : d.tab === 'upload' ? !!d.upload.initials : false;
    if (!own && !ini) return d.tab === 'type' ? fail('Type your initials.', '#sg-initials-text') : fail(d.tab === 'draw' ? 'Draw your initials as well.' : 'Add an image of your initials as well.');
    d.busy = true;
    const btn = document.querySelector('#dlg .sg-foot [data-action="es-adopt"]');
    if (btn) btn.setAttribute('aria-busy', 'true');
    let out = null;
    try {
      const signature = d.tab === 'type' ? await typed('signature', name) : d.tab === 'draw' ? drawn('signature') : uploaded('signature');
      const initials = own ? (d.tab === 'draw' ? drawn('initials') : uploaded('initials')) : await typed('initials', ini);
      if (signature.png && initials.png) out = { signature, initials };
    } catch (e) {
      out = null;
    }
    mine.busy = false;
    if (btn) btn.removeAttribute('aria-busy');
    // Closed, or opened again, while the pictures were being made: nothing is adopted.
    if (d !== mine || root() !== r) return null;
    if (!out) return fail('That signature could not be created. Try another way.');
    const keep = copy(d);
    delete keep.busy;
    adoptedBy[d.key] = keep;
    return out;
  }

  /* ---------- Controls ---------- */
  NS.actions['sg-tab'] = (el) => setTab(el.getAttribute('data-t'));
  NS.changes['es-type-text'] = (el) => d && setText('signature', el.value);
  NS.changes['sg-initials'] = (el) => d && setText('initials', el.value);
  NS.changes['sg-style'] = (el) => d && el.checked && pick(el.value);
  NS.changes['sg-ink'] = (el) => {
    const r = root();
    if (!d || !r || !el.checked) return;
    d.ink = (INKS.find((k) => k.id === el.value) || INKS[0]).id;
    r.setAttribute('data-ink', d.ink);
    if (pads) KINDS.forEach((k) => pads[k].paint());
  };
  const padAct = (fn) => (el) => {
    const k = el.getAttribute('data-k');
    if (!d || !pads || !pads[k] || pads[k].busy() || el.getAttribute('aria-disabled') === 'true') return;
    fn(k);
    if (!d.strokes[k].length) delete d.box[k];
    setError('');
    syncCells();
    pads[k].paint();
  };
  NS.actions['sg-undo'] = padAct((k) => d.strokes[k].pop());
  NS.actions['sg-clear'] = padAct((k) => (d.strokes[k].length = 0));
  NS.actions['sg-file-pick'] = (el) => {
    const input = document.getElementById(`sg-file-${el.getAttribute('data-k')}`);
    if (input) input.click();
  };
  NS.changes['sg-file'] = (el) => {
    takeFile(el.getAttribute('data-k'), el.files && el.files[0]);
    // The same file can be chosen again after it is removed.
    el.value = '';
  };
  NS.actions['sg-file-remove'] = (el) => {
    const k = el.getAttribute('data-k');
    if (!d || !root()) return;
    d.upload[k] = null;
    setError('');
    syncCells();
    refit();
    const next = root().querySelector(`.sg-pane-upload .sg-cell-${k} [data-action="sg-file-pick"]:not([hidden])`);
    if (next) next.focus();
  };
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    // The tabs: arrow keys move along them, Home and End go to the ends; the tab arrived at is shown at once.
    const tb = t.closest('.sg-switch [role="tab"]');
    if (tb) {
      const all = Array.from(tb.parentElement.querySelectorAll('[role="tab"]'));
      const i = all.indexOf(tb);
      const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % all.length : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + all.length - 1) % all.length : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
      if (to < 0) return;
      e.preventDefault();
      all[to].focus();
      setTab(all[to].getAttribute('data-t'));
      return;
    }
    // Enter in the name or the initials adopts, as the button does.
    if (e.key === 'Enter' && !e.isComposing && t.closest('.sg-fields input')) {
      const btn = document.querySelector('#dlg .sg-foot [data-action="es-adopt"]');
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    }
  });

  NS.signature = {
    open,
    result,
    styles: STYLES.map((s) => ({ id: s.id, label: s.label })),
    inks: INKS.map((k) => ({ id: k.id, label: k.label })),
    typedPng,
    clean,
    smooth,
    /** What the open dialog holds (for the checks): the tab, style and ink, and each pad's strokes as given and as painted. */
    inspect: () => (d && root() ? { tab: d.tab, style: d.style, ink: d.ink, text: copy(d.text), strokes: copy(d.strokes), painted: { signature: d.strokes.signature.map(smooth), initials: d.strokes.initials.map(smooth) }, upload: { signature: !!d.upload.signature, initials: !!d.upload.initials } } : null)
  };
})(window.CVPortal);
