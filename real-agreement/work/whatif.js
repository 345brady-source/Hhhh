/*
 * Scratch: NS.placement.analyze on the layout read from the real agreement (out/local/layout.json), under changed conditions.
 * placement.js is pure, so it is loaded here in Node exactly as the browser loads it.
 * node whatif.js <layout.json>
 */
const fs = require('fs');
const vm = require('vm');
const NS = {};
vm.runInNewContext(fs.readFileSync('/home/user/Hhhh/assets/js/placement.js', 'utf8'), { window: { CVPortal: NS }, CVPortal: NS, console });
const src = fs.readFileSync('/home/user/Hhhh/assets/js/placement.js', 'utf8');
// How the file binds its namespace: find the closing call.
const tail = src.trim().split('\n').slice(-3).join('\n');
if (!NS.placement) {
  const g = { window: {}, console };
  g.window.CVPortal = NS;
  vm.runInNewContext(src, g);
  if (!NS.placement && g.window.CVPortal && g.window.CVPortal.placement) NS.placement = g.window.CVPortal.placement;
}
if (!NS.placement) {
  console.error('could not load placement.js; its last lines are:\n' + tail);
  process.exit(1);
}
const layout = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const show = (name, pages, ctx, full) => {
  const out = NS.placement.analyze(clone(pages), ctx);
  const c = {};
  out.forEach((p) => {
    const k = `p${p.page}`;
    c[k] = (c[k] || 0) + 1;
  });
  const kinds = {};
  out.forEach((p) => {
    const k = `${p.type}/${p.role}`;
    kinds[k] = (kinds[k] || 0) + 1;
  });
  console.log(`\n=== ${name}: ${out.length} fields; review ${out.filter((p) => p.conf !== 'high').length}; per page ${JSON.stringify(c)}; ${JSON.stringify(kinds)}`);
  const sig = out.filter((p) => p.type === 'signature' || full);
  sig.forEach((p) => console.log(`   p${p.page} ${p.type} ${p.role}${p.forType ? '/' + p.forType : ''} ${p.conf} x ${p.x.toFixed(1)}-${(p.x + p.w).toFixed(1)} y ${p.y.toFixed(1)}-${(p.y + p.h).toFixed(1)} "${p.label}" ${p.why || ''}`));
  return out;
};
const KB = { countersign: true, firmNames: ['Kestrel Bay Capital', 'Kestrel Bay Capital Management, LLC', 'Kestrel Bay'], fundNames: ['Kestrel Bay Fund II, L.P.', 'Fund II'] };
const mode = process.argv[3] || 'all';
const NAMES = JSON.parse(process.argv[4] || '{}');
show('A. as uploaded locally (sample firm names, countersign on)', layout, KB);
show('B. countersign box unticked', layout, Object.assign({}, KB, { countersign: false }));
if (NAMES.firm) {
  show('C. firm and offering named as printed in the agreement', layout, { countersign: true, firmNames: NAMES.firm, fundNames: NAMES.fund });
  show('C2. a new firm with any other name, offering with its default name', layout, { countersign: true, firmNames: ['Northgate Capital', '', 'Northgate'], fundNames: ['New offering', ''] });
}
show('D. nothing could be read (pageLayout threw or returned no pages): page sizes only', layout.map((p) => ({ page: p.page, w: p.w, h: p.h, items: [], rules: [], boxes: [] })), KB, true);
show('E. text read, pages not drawn (no lines or squares from pixels)', layout.map((p) => Object.assign({}, p, { rules: [], boxes: [] })), KB, mode === 'full');
show('F. pages drawn, no text (text reading returned nothing)', layout.map((p) => Object.assign({}, p, { items: [] })), KB, true);
show('G. text read, lines found, squares not found', layout.map((p) => Object.assign({}, p, { boxes: [] })), KB, mode === 'full');
show('H. text read, squares found, lines not found', layout.map((p) => Object.assign({}, p, { rules: [] })), KB, mode === 'full');
