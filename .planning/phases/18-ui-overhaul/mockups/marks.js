/*
 * Phase 18 (D-10): 24 new sponsor logo marks, hand-built for the regal direction. Mockup reference for brand.js MARKS and
 * markBody(): the same 40x40 contract and the same three colours, c.p (the firm's primary, contrast-guarded), c.a (its
 * second colour, detail only) and c.ink (drawn on top of c.p). The silhouette of every mark is in c.p, so it stays at
 * least 3:1 against paper and the dark frame whatever the second colour is. Letter marks take the firm's initials.
 */
(function (global) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const f = (c) => `style="fill:${c}"`;
  const s = (c, w) => `fill="none" style="stroke:${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const txt = (L, c, font, y, size) => `<text x="20" y="${y}" text-anchor="middle" dominant-baseline="central" style="fill:${c};font-family:${font};font-weight:600;font-size:${size}px;letter-spacing:0.03em">${L}</text>`;
  const size = (L, two, three) => (L.length > 2 ? three : L.length === 2 ? two : two + 3);
  const leaves = (side) => {
    const k = side < 0 ? 1 : -1;
    return [[11, 31, -35], [8.6, 25.5, -18], [7.6, 19.5, 0], [8.4, 13.5, 18], [10.8, 8.4, 36]]
      .map(([x, y, r]) => `<ellipse cx="${side < 0 ? x : 40 - x}" cy="${y}" rx="2.1" ry="4" transform="rotate(${r * k} ${side < 0 ? x : 40 - x} ${y})"/>`).join('');
  };
  const rays = () => [180, 150, 120, 90, 60, 30, 0].map((d) => {
    const r = (d * Math.PI) / 180;
    const x1 = 20 + 14.5 * Math.cos(r), y1 = 28 - 14.5 * Math.sin(r), x2 = 20 + 18.5 * Math.cos(r), y2 = 28 - 18.5 * Math.sin(r);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }).join(' ');
  const petals = () => [0, 45, 90, 135, 180, 225, 270, 315].map((d) => {
    const r = (d * Math.PI) / 180;
    return `<circle cx="${(20 + 10 * Math.cos(r)).toFixed(2)}" cy="${(20 + 10 * Math.sin(r)).toFixed(2)}" r="6"/>`;
  }).join('');

  const MARKS = {
    crest: { label: 'Crest', body: (L, c) => `<path d="M6 4H34V18C34 28 27 34 20 37C13 34 6 28 6 18Z" ${f(c.p)}/><path d="M10 25L20 15L30 25V30L20 20L10 30Z" ${f(c.ink)}/><circle cx="20" cy="9.5" r="2.6" ${f(c.a)}/>` },
    escutcheon: { label: 'Escutcheon', letters: true, body: (L, c, font) => `<path d="M5 5H35V17Q35 31 20 37Q5 31 5 17Z" ${f(c.p)}/><rect x="5" y="5" width="30" height="5" ${f(c.a)}/>${txt(L, c.ink, font, 21.5, size(L, 12.5, 10))}` },
    seal: { label: 'Seal', letters: true, body: (L, c, font) => `<circle cx="20" cy="20" r="18.5" ${f(c.p)}/><circle cx="20" cy="20" r="14.5" ${s(c.ink, 1.5)}/>${[[20, 3.6], [36.4, 20], [20, 36.4], [3.6, 20]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" ${f(c.a)}/>`).join('')}${txt(L, c.ink, font, 20.5, size(L, 12.5, 10))}` },
    cartouche: { label: 'Cartouche', letters: true, body: (L, c, font) => `<path d="M10 3H30A7 7 0 0 0 37 10V30A7 7 0 0 0 30 37H10A7 7 0 0 0 3 30V10A7 7 0 0 0 10 3Z" ${f(c.p)}/><rect x="12" y="28.5" width="16" height="1.8" ${f(c.a)}/>${txt(L, c.ink, font, 19, size(L, 13, 10.5))}` },
    keystone: { label: 'Keystone', body: (L, c) => `<path d="M3.5 12H11.5L15 35H5.5Z" ${f(c.a)}/><path d="M28.5 12H36.5L34.5 35H25Z" ${f(c.a)}/><path d="M13 5H27L23.5 35H16.5Z" ${f(c.p)}/><path d="M17 10H23" ${s(c.ink, 1.4)}/>` },
    portico: { label: 'Portico', body: (L, c) => `<path d="M3 14L20 4L37 14Z" ${f(c.p)}/><rect x="5" y="15.5" width="30" height="3" ${f(c.p)}/>${[7.5, 14.5, 21.5, 28.5].map((x) => `<rect x="${x}" y="20" width="4" height="11" ${f(c.p)}/>`).join('')}<rect x="4" y="32" width="32" height="4" ${f(c.a)}/>` },
    column: { label: 'Column', body: (L, c) => `<rect x="8" y="4.5" width="24" height="4" ${f(c.a)}/><rect x="11" y="9" width="18" height="2.6" ${f(c.p)}/><rect x="13.5" y="11.6" width="13" height="19" ${f(c.p)}/><path d="M17 14V28.5M20 14V28.5M23 14V28.5" ${s(c.ink, 1.2)}/><rect x="11" y="30.6" width="18" height="2.6" ${f(c.p)}/><rect x="8" y="33.2" width="24" height="3.6" ${f(c.a)}/>` },
    tower: { label: 'Tower', body: (L, c) => `<path d="M10 12H30V36H10Z" ${f(c.p)}/>${[10, 17.5, 25].map((x) => `<rect x="${x}" y="5" width="5" height="7.5" ${f(c.p)}/>`).join('')}<rect x="18.5" y="16.5" width="3" height="5.5" ${f(c.a)}/><path d="M16.5 36V29.5A3.5 3.5 0 0 1 23.5 29.5V36Z" ${f(c.ink)}/>` },
    laurel: { label: 'Laurel', letters: true, body: (L, c, font) => `<g ${f(c.a)}>${leaves(-1)}${leaves(1)}</g><path d="M15 35.5Q20 33 25 35.5" ${s(c.p, 1.8)}/>${txt(L, c.p, font, 20, size(L, 12, 9.5))}` },
    crown: { label: 'Crown', body: (L, c) => `<path d="M8 27L6 11L14 19L20 8L26 19L34 11L32 27Z" ${f(c.p)}/><rect x="8" y="27" width="24" height="6" ${f(c.p)}/><circle cx="6" cy="10" r="2.2" ${f(c.a)}/><circle cx="20" cy="7" r="2.4" ${f(c.a)}/><circle cx="34" cy="10" r="2.2" ${f(c.a)}/>${[14, 20, 26].map((x) => `<circle cx="${x}" cy="30" r="1.3" ${f(c.ink)}/>`).join('')}` },
    key: { label: 'Key', body: (L, c) => `<circle cx="20" cy="10.5" r="7.5" ${f(c.p)}/><circle cx="20" cy="10.5" r="3" ${f(c.ink)}/><rect x="17.8" y="17" width="4.4" height="20" ${f(c.p)}/><rect x="22.2" y="27" width="7" height="3.2" ${f(c.a)}/><rect x="22.2" y="32.4" width="4.5" height="3.2" ${f(c.a)}/>` },
    compass: { label: 'Compass', body: (L, c) => `<path d="M29.2 10.8L20 16L10.8 10.8L16 20L10.8 29.2L20 24L29.2 29.2L24 20Z" ${f(c.a)}/><path d="M20 2L23.5 16.5L38 20L23.5 23.5L20 38L16.5 23.5L2 20L16.5 16.5Z" ${f(c.p)}/><circle cx="20" cy="20" r="2.4" ${f(c.ink)}/>` },
    quatrefoil: { label: 'Quatrefoil', body: (L, c) => `<g ${f(c.p)}><circle cx="20" cy="11.5" r="8.3"/><circle cx="28.5" cy="20" r="8.3"/><circle cx="20" cy="28.5" r="8.3"/><circle cx="11.5" cy="20" r="8.3"/></g><path d="M20 14L26 20L20 26L14 20Z" ${f(c.a)}/><circle cx="20" cy="20" r="1.8" ${f(c.ink)}/>` },
    lozenge: { label: 'Lozenge', letters: true, body: (L, c, font) => `<path d="M20 1.5L38.5 20L20 38.5L1.5 20Z" ${f(c.p)}/><path d="M20 6.5L33.5 20L20 33.5L6.5 20Z" ${s(c.ink, 1.3)}/><circle cx="20" cy="4.6" r="1.1" ${f(c.a)}/><circle cx="20" cy="35.4" r="1.1" ${f(c.a)}/>${txt(L, c.ink, font, 20.5, size(L, 10.5, 8.5))}` },
    chevrons: { label: 'Chevrons', body: (L, c) => `<path d="M4 16L20 5L36 16V22.5L20 11.5L4 22.5Z" ${f(c.p)}/><path d="M4 26L20 15L36 26V32.5L20 21.5L4 32.5Z" ${f(c.a)}/><rect x="4" y="33.5" width="32" height="3.5" ${f(c.p)}/>` },
    sunburst: { label: 'Sunburst', body: (L, c) => `<path d="${rays()}" ${s(c.p, 2.2)}/><path d="M8 28A12 12 0 0 1 32 28Z" ${f(c.p)}/><rect x="3" y="29.5" width="34" height="3" ${f(c.a)}/><rect x="9" y="34.5" width="22" height="2" ${f(c.p)}/>` },
    bastion: { label: 'Bastion', body: (L, c) => `<path d="M20 3L26.47 12.1L37.12 15.44L30.46 24.4L30.58 35.56L20 32L9.42 35.56L9.54 24.4L2.88 15.44L13.53 12.1Z" ${f(c.p)}/><path d="M20 14L26.66 18.84L24.11 26.66H15.89L13.34 18.84Z" ${f(c.a)}/><circle cx="20" cy="21" r="2.2" ${f(c.ink)}/>` },
    rosette: { label: 'Rosette', body: (L, c) => `<g ${f(c.p)}>${petals()}</g><circle cx="20" cy="20" r="7" ${f(c.a)}/><circle cx="20" cy="20" r="2.6" ${f(c.p)}/>` },
    banner: { label: 'Banner', letters: true, body: (L, c, font) => `<path d="M1 17H7V31H1L4 24Z" ${f(c.a)}/><path d="M39 17H33V31H39L36 24Z" ${f(c.a)}/><rect x="5" y="11.5" width="30" height="16" ${f(c.p)}/><rect x="5" y="8" width="30" height="1.6" ${f(c.p)}/>${txt(L, c.ink, font, 19.8, size(L, 11.5, 9.5))}` },
    obelisk: { label: 'Obelisk', body: (L, c) => `<path d="M16.6 8.5L20 3L23.4 8.5L25 31H15Z" ${f(c.p)}/><path d="M16.6 8.5L20 3L23.4 8.5Z" ${f(c.a)}/><rect x="11" y="31" width="18" height="3" ${f(c.a)}/><rect x="7.5" y="34.5" width="25" height="3" ${f(c.p)}/>` },
    gate: { label: 'Gate', body: (L, c) => `<rect x="5" y="12" width="7.5" height="25" ${f(c.p)}/><rect x="27.5" y="12" width="7.5" height="25" ${f(c.p)}/><circle cx="8.75" cy="8" r="3.2" ${f(c.a)}/><circle cx="31.25" cy="8" r="3.2" ${f(c.a)}/><path d="M12.5 19.5Q20 12.5 27.5 19.5M16 18V37M20 16V37M24 18V37" ${s(c.p, 1.8)}/>` },
    balance: { label: 'Balance', body: (L, c) => `<circle cx="20" cy="6" r="2.6" ${f(c.a)}/><rect x="18.9" y="8" width="2.2" height="25" ${f(c.p)}/><rect x="5" y="9.5" width="30" height="2.6" ${f(c.p)}/><path d="M8 12L4.5 22M8 12L11.5 22M32 12L28.5 22M32 12L35.5 22" ${s(c.p, 1.2)}/><path d="M2.5 22H13.5A5.5 4.5 0 0 1 2.5 22Z" ${f(c.a)}/><path d="M26.5 22H37.5A5.5 4.5 0 0 1 26.5 22Z" ${f(c.a)}/><path d="M11 37.5L20 31.5L29 37.5Z" ${f(c.p)}/>` },
    acorn: { label: 'Acorn', body: (L, c) => `<rect x="18.8" y="2.5" width="2.4" height="6.5" ${f(c.a)}/><path d="M12.5 19H27.5C27.5 28.5 24 34 20 36.8C16 34 12.5 28.5 12.5 19Z" ${f(c.p)}/><path d="M8.5 20C8.5 12.5 13.5 8 20 8C26.5 8 31.5 12.5 31.5 20Z" ${f(c.p)}/><path d="M12 15.5H28M10.5 18.5H29.5" ${s(c.ink, 1.1)}/>` },
    ledger: { label: 'Ledger', body: (L, c) => `<rect x="6.5" y="8" width="7.5" height="26" ${f(c.p)}/><rect x="16.25" y="4.5" width="7.5" height="29.5" ${f(c.a)}/><rect x="26" y="10" width="7.5" height="24" ${f(c.p)}/><path d="M7.5 13H13M7.5 29H13M27 15H32.5M27 29H32.5" ${s(c.ink, 1.3)}/><rect x="4" y="34.5" width="32" height="2.8" ${f(c.p)}/>` }
  };
  /** Old keys (stored by firms today) and the new mark each is shown as. Stored data is not rewritten. */
  const OLD = { monogram: 'cartouche', wing: 'chevrons', ridge: 'sunburst', wave: 'rosette', arch: 'portico' };
  function markBody(type, letters, c, font) {
    const m = MARKS[OLD[type] || type] || MARKS.seal;
    return m.body(esc(String(letters || '').slice(0, 3).toUpperCase()), c, font || 'serif');
  }
  global.REGAL_MARKS = { MARKS, OLD, markBody, svg: (type, letters, c, font, px) => `<svg viewBox="0 0 40 40" width="${px}" height="${px}" aria-hidden="true" focusable="false">${markBody(type, letters, c, font)}</svg>` };
})(window);
