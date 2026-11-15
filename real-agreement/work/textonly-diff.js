/*
 * Scratch: how far the fields move when the pages cannot be drawn (text only), or only squares or only lines are lost.
 * node textonly-diff.js <layout.json>
 */
const fs = require('fs');
const vm = require('vm');
const g = { window: { CVPortal: {} }, console };
vm.runInNewContext(fs.readFileSync('/home/user/Hhhh/assets/js/placement.js', 'utf8'), g);
const P = g.window.CVPortal.placement;
const layout = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const ctx = { countersign: true, firmNames: ['Northgate Capital'], fundNames: ['New offering'] };
const A = P.analyze(clone(layout), ctx);
const variants = {
  'text only (no lines, no squares)': layout.map((p) => Object.assign({}, p, { rules: [], boxes: [] })),
  'squares lost': layout.map((p) => Object.assign({}, p, { boxes: [] })),
  'lines lost': layout.map((p) => Object.assign({}, p, { rules: [] }))
};
Object.keys(variants).forEach((k) => {
  const B = P.analyze(clone(variants[k]), ctx);
  let worst = { d: 0 };
  let unmatched = 0;
  const by = {};
  A.forEach((a) => {
    // The nearest field of the same type and page.
    const c = B.filter((b) => b.page === a.page && b.type === a.type).map((b) => ({ b, d: Math.max(Math.abs(b.x - a.x), Math.abs(b.y + b.h - (a.y + a.h))) })).sort((x, y) => x.d - y.d)[0];
    if (!c || c.d > 30) return unmatched++;
    by[a.type] = Math.max(by[a.type] || 0, c.d);
    if (c.d > worst.d) worst = { d: c.d, page: a.page, type: a.type, dx: c.b.x - a.x, dBottom: c.b.y + c.b.h - (a.y + a.h), dTop: c.b.y - a.y, dw: c.b.w - a.w };
  });
  console.log(`${k}: ${B.length} fields (${A.length} with everything read); marked ${B.filter((p) => p.conf !== 'high').length}; no counterpart within 30 pt: ${unmatched}; largest move of left edge or bottom edge by type (pt): ${JSON.stringify(Object.fromEntries(Object.entries(by).map(([t, d]) => [t, +d.toFixed(1)])))}; worst: ${JSON.stringify(worst, (key, v) => (typeof v === 'number' ? +v.toFixed(1) : v))}`);
});
