/*
 * Column chart for distributions received. One series in the client's chart
 * color, hairline grid, a value on the latest column only, and a tooltip on
 * hover or keyboard focus (arrow keys move between columns).
 */
(function (NS) {
  'use strict';

  function niceTicks(max, count) {
    const raw = max / (count || 4) || 1;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((x) => x * pow).find((x) => x >= raw);
    const top = Math.ceil(max / step) * step || step;
    const ticks = [];
    for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v));
    return { top, ticks };
  }
  const trim = (n) => String(Number(n.toFixed(2)));
  function compact(v) {
    if (v >= 1e6) return '$' + trim(v / 1e6) + 'M';
    if (v >= 1e3) return '$' + trim(v / 1e3) + 'K';
    return '$' + Math.round(v);
  }
  const full = (v) => '$' + Math.round(v).toLocaleString('en-US');

  function el(tag, attrs, parent) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, cls, anchor, baseline) {
    const t = el('text', { x, y, class: cls, 'text-anchor': anchor || 'start', 'dominant-baseline': baseline || 'auto' }, parent);
    t.textContent = str;
    return t;
  }

  function columns(host, cfg) {
    host.textContent = '';
    const W = Math.max(280, host.clientWidth || 640);
    const H = cfg.height || 220;
    const m = { t: 22, r: 8, b: 28, l: 52 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const n = cfg.values.length;
    const { top, ticks } = niceTicks(Math.max.apply(null, cfg.values) * 1.1, 4);
    const band = iw / n;
    const bw = Math.min(24, band * 0.5);
    const y = (v) => m.t + ih - (v / top) * ih;
    const base = y(0);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', tabindex: '0', 'aria-label': cfg.ariaLabel || '' });
    host.appendChild(svg);
    ticks.forEach((tv) => {
      el('line', { x1: m.l, x2: W - m.r, y1: y(tv), y2: y(tv), class: tv === 0 ? 'c-axis' : 'c-grid' }, svg);
      text(svg, m.l - 10, y(tv), compact(tv), 'c-tick', 'end', 'middle');
    });
    const every = Math.ceil(n / Math.max(2, Math.floor(iw / 64)));
    const bars = cfg.values.map((v, i) => {
      const cx = m.l + band * i + band / 2;
      const x0 = cx - bw / 2;
      const yt = y(v);
      const r = Math.max(0, Math.min(2, (base - yt) / 2));
      const d = `M${x0},${base} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x0 + bw - r} Q${x0 + bw},${yt} ${x0 + bw},${yt + r} V${base} Z`;
      const bar = el('path', { d, class: 'c-bar', style: `fill:${cfg.color}` }, svg);
      if ((n - 1 - i) % every === 0) text(svg, cx, H - 8, cfg.labels[i], 'c-tick', 'middle');
      return { bar, cx, yt };
    });
    const last = bars[n - 1];
    text(svg, last.cx, last.yt - 8, compact(cfg.values[n - 1]), 'c-cap', 'middle');

    const tip = document.createElement('div');
    tip.className = 'c-tip';
    tip.hidden = true;
    host.appendChild(tip);
    let idx = -1;
    function show(i) {
      if (idx >= 0) bars[idx].bar.classList.remove('is-hover');
      idx = i;
      bars[i].bar.classList.add('is-hover');
      tip.textContent = '';
      const v = document.createElement('strong');
      v.textContent = full(cfg.values[i]);
      const l = document.createElement('span');
      l.textContent = cfg.labels[i];
      tip.append(v, l);
      tip.hidden = false;
      const w = tip.offsetWidth;
      let left = bars[i].cx + 14;
      if (left + w > host.clientWidth) left = bars[i].cx - w - 14;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = Math.max(0, Math.min(bars[i].yt, H - 60)) + 'px';
    }
    function hide() {
      if (idx >= 0) bars[idx].bar.classList.remove('is-hover');
      idx = -1;
      tip.hidden = true;
    }
    cfg.values.forEach((v, i) => {
      const hr = el('rect', { x: m.l + band * i, y: m.t, width: band, height: ih, fill: 'transparent' }, svg);
      hr.addEventListener('pointerenter', () => show(i));
      hr.addEventListener('pointerleave', hide);
    });
    svg.addEventListener('focus', () => show(n - 1));
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        show(Math.max(0, Math.min(n - 1, (idx < 0 ? n - 1 : idx) + (e.key === 'ArrowLeft' ? -1 : 1))));
      } else if (e.key === 'Escape') hide();
    });
  }

  /** Redraw when the container width changes. */
  function watch(host, draw) {
    if (!window.ResizeObserver) return;
    let w = host.clientWidth;
    const ro = new ResizeObserver(() => {
      if (!host.isConnected) return ro.disconnect();
      if (Math.abs(host.clientWidth - w) > 2) {
        w = host.clientWidth;
        draw();
      }
    });
    ro.observe(host);
  }

  NS.charts = { columns, watch, compact, full };
})(window.CVPortal);
