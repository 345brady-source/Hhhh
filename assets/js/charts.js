/*
 * Small SVG chart kit: a line/area chart with a crosshair and a column chart
 * with per-bar tooltips. Colors come from the brand tokens, so every chart
 * re-themes with the client. Thin marks, hairline grid, one y-axis.
 */
(function (NS) {
  'use strict';

  function niceTicks(max, count) {
    const raw = max / (count || 4);
    const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const step = [1, 2, 2.5, 5, 10].map((x) => x * pow).find((x) => x >= raw);
    const top = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v));
    return { top, ticks };
  }
  const trim = (n) => String(Number(n.toFixed(2)));
  function compact(v) {
    if (v >= 1e6) return '$' + trim(v / 1e6) + 'M';
    if (v >= 1e3) return '$' + trim(v / 1e3) + 'K';
    return '$' + v;
  }
  const full = (v) => '$' + Math.round(v).toLocaleString('en-US');
  const shortQ = (q) => q.replace(/^(Q\d) 20(\d\d)$/, "$1 ’$2");

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

  function makeTip(host) {
    const tip = document.createElement('div');
    tip.className = 'c-tip';
    tip.hidden = true;
    host.appendChild(tip);
    return tip;
  }
  function placeTip(host, tip, x, y) {
    tip.hidden = false;
    const w = tip.offsetWidth;
    const hw = host.clientWidth;
    let left = x + 14;
    if (left + w > hw) left = x - w - 14;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = Math.max(0, y - tip.offsetHeight / 2) + 'px';
  }
  function tipRow(tip, value, label, color, line) {
    const row = document.createElement('div');
    row.className = 'c-tip-row';
    const key = document.createElement('span');
    key.className = line ? 'c-key-line' : 'c-key-box';
    key.style.background = color;
    const v = document.createElement('strong');
    v.textContent = value;
    const l = document.createElement('span');
    l.className = 'c-tip-label';
    l.textContent = label;
    row.append(key, v, l);
    tip.appendChild(row);
  }

  /**
   * Line chart. cfg = { labels, series: [{ name, values, color, area }], height, endLabels, ariaLabel }
   */
  function line(host, cfg) {
    host.textContent = '';
    const W = Math.max(280, host.clientWidth || 640);
    const H = cfg.height || 280;
    const showEnd = cfg.endLabels !== false && W >= 560;
    const m = { t: 14, r: showEnd ? 128 : 14, b: 30, l: 54 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const n = cfg.labels.length;
    const max = Math.max.apply(null, cfg.series.flatMap((s) => s.values));
    const { top, ticks } = niceTicks(max * 1.04, 4);
    const x = (i) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
    const y = (v) => m.t + ih - (v / top) * ih;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', tabindex: '0', 'aria-label': cfg.ariaLabel || '' });
    host.appendChild(svg);

    ticks.forEach((tv) => {
      el('line', { x1: m.l, x2: W - m.r, y1: y(tv), y2: y(tv), class: tv === 0 ? 'c-axis' : 'c-grid' }, svg);
      text(svg, m.l - 10, y(tv), compact(tv), 'c-tick', 'end', 'middle');
    });
    const every = Math.ceil(n / Math.max(2, Math.floor(iw / 62)));
    cfg.labels.forEach((lab, i) => {
      if ((n - 1 - i) % every !== 0) return;
      text(svg, x(i), H - 8, shortQ(lab), 'c-tick', 'middle');
    });

    cfg.series.forEach((s) => {
      const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      if (s.area) {
        el('path', { d: `M${x(0)},${y(0)} L${pts.join(' L')} L${x(n - 1)},${y(0)} Z`, style: 'fill:var(--chart-area)' }, svg);
      }
      el('path', { d: `M${pts.join(' L')}`, fill: 'none', style: `stroke:${s.color}`, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      el('circle', { cx: x(n - 1), cy: y(s.values[n - 1]), r: 4.5, style: `fill:${s.color};stroke:var(--surface)`, 'stroke-width': 2 }, svg);
    });

    // Direct end labels, only when the series are far enough apart not to collide.
    if (showEnd) {
      const ends = cfg.series.map((s) => y(s.values[n - 1]));
      const apart = ends.every((a, i) => ends.every((b, j) => i === j || Math.abs(a - b) >= 34));
      if (apart) {
        cfg.series.forEach((s, i) => {
          const ey = ends[i];
          text(svg, x(n - 1) + 12, ey - 7, s.name, 'c-end-name', 'start', 'middle');
          text(svg, x(n - 1) + 12, ey + 9, full(s.values[n - 1]), 'c-end-value', 'start', 'middle');
        });
      }
    }

    const cross = el('line', { x1: 0, x2: 0, y1: m.t, y2: m.t + ih, class: 'c-cross', visibility: 'hidden' }, svg);
    const dots = cfg.series.map((s) => el('circle', { r: 4.5, style: `fill:${s.color};stroke:var(--surface)`, 'stroke-width': 2, visibility: 'hidden' }, svg));
    const hit = el('rect', { x: m.l - 10, y: m.t, width: iw + 20, height: ih, fill: 'transparent' }, svg);
    const tip = makeTip(host);
    let idx = -1;

    function show(i) {
      idx = i;
      const cx = x(i);
      cross.setAttribute('x1', cx);
      cross.setAttribute('x2', cx);
      cross.setAttribute('visibility', 'visible');
      dots.forEach((d, k) => {
        d.setAttribute('cx', cx);
        d.setAttribute('cy', y(cfg.series[k].values[i]));
        d.setAttribute('visibility', 'visible');
      });
      tip.textContent = '';
      const head = document.createElement('div');
      head.className = 'c-tip-head';
      head.textContent = cfg.labels[i];
      tip.appendChild(head);
      cfg.series.forEach((s) => tipRow(tip, full(s.values[i]), s.name, s.color, true));
      const ys = cfg.series.map((s) => y(s.values[i]));
      placeTip(host, tip, cx, (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2);
    }
    function hide() {
      idx = -1;
      cross.setAttribute('visibility', 'hidden');
      dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
      tip.hidden = true;
    }
    function nearest(evt) {
      const r = svg.getBoundingClientRect();
      const px = ((evt.clientX - r.left) / r.width) * W;
      return Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
    }
    hit.addEventListener('pointermove', (e) => show(nearest(e)));
    hit.addEventListener('pointerleave', hide);
    svg.addEventListener('focus', () => show(n - 1));
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        show(Math.max(0, Math.min(n - 1, (idx < 0 ? n - 1 : idx) + (e.key === 'ArrowLeft' ? -1 : 1))));
      } else if (e.key === 'Escape') hide();
    });
  }

  /**
   * Column chart. cfg = { labels, values, color, height, seriesName, ariaLabel }
   */
  function columns(host, cfg) {
    host.textContent = '';
    const W = Math.max(280, host.clientWidth || 640);
    const H = cfg.height || 240;
    const m = { t: 24, r: 12, b: 30, l: 50 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const n = cfg.values.length;
    const { top, ticks } = niceTicks(Math.max.apply(null, cfg.values) * 1.08, 4);
    const band = iw / n;
    const bw = Math.min(24, band * 0.62);
    const y = (v) => m.t + ih - (v / top) * ih;
    const base = y(0);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', tabindex: '0', 'aria-label': cfg.ariaLabel || '' });
    host.appendChild(svg);
    ticks.forEach((tv) => {
      el('line', { x1: m.l, x2: W - m.r, y1: y(tv), y2: y(tv), class: tv === 0 ? 'c-axis' : 'c-grid' }, svg);
      text(svg, m.l - 10, y(tv), compact(tv), 'c-tick', 'end', 'middle');
    });
    const every = Math.ceil(n / Math.max(2, Math.floor(iw / 58)));

    const bars = cfg.values.map((v, i) => {
      const cx = m.l + band * i + band / 2;
      const x0 = cx - bw / 2;
      const yt = y(v);
      const r = Math.min(4, (base - yt) / 2, bw / 2);
      const d = `M${x0},${base} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x0 + bw - r} Q${x0 + bw},${yt} ${x0 + bw},${yt + r} V${base} Z`;
      const bar = el('path', { d, class: 'c-bar', style: `fill:${cfg.color}` }, svg);
      if ((n - 1 - i) % every === 0) text(svg, cx, H - 8, shortQ(cfg.labels[i]), 'c-tick', 'middle');
      return { bar, cx, yt };
    });
    // Label the most recent bar only; the axis, tooltip and table carry the rest.
    const last = bars[n - 1];
    text(svg, last.cx, last.yt - 8, compact(cfg.values[n - 1]), 'c-cap', 'middle');

    const tip = makeTip(host);
    let idx = -1;
    function show(i) {
      if (idx >= 0) bars[idx].bar.classList.remove('is-hover');
      idx = i;
      bars[i].bar.classList.add('is-hover');
      tip.textContent = '';
      const head = document.createElement('div');
      head.className = 'c-tip-head';
      head.textContent = cfg.labels[i];
      tip.appendChild(head);
      tipRow(tip, full(cfg.values[i]), cfg.seriesName || '', cfg.color, false);
      placeTip(host, tip, bars[i].cx, Math.max(m.t + 20, bars[i].yt));
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

  NS.charts = { line, columns, compact, full };
})(window.CVPortal);
