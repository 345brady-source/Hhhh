/*
 * Scratch: what the fixed block of analyze() (placement.js, "No signature line found for a signer") does on this document
 * when a signer has no signature line. node fallback-demo.js <layout.json> <out.json>
 */
const fs = require('fs');
const vm = require('vm');
const g = { window: { CVPortal: {} }, console };
vm.runInNewContext(fs.readFileSync('/home/user/Hhhh/assets/js/placement.js', 'utf8'), g);
const P = g.window.CVPortal.placement;
const layout = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const ctx = { countersign: true, firmNames: ['Northgate Capital', '', 'Northgate'], fundNames: ['New offering', 'New offering'] };
const cases = {
  'nothing-read': layout.map((p) => ({ page: p.page, w: p.w, h: p.h, items: [], rules: [], boxes: [] })),
  'no-acceptance-page (pages 1-11)': clone(layout.slice(0, 11)),
  'no-signature-pages (pages 1-4)': clone(layout.slice(0, 4))
};
const out = {};
Object.keys(cases).forEach((k) => {
  const all = P.analyze(cases[k], ctx);
  const fb = all.filter((p) => p.conf === 'low' && /could be read in this PDF/.test(p.why || ''));
  out[k] = fb.map((p) => ({ page: p.page, type: p.type, role: p.role, x0: +p.x.toFixed(1), x1: +(p.x + p.w).toFixed(1), top: +p.y.toFixed(1), bottom: +(p.y + p.h).toFixed(1), why: p.why }));
  // Text the block covers: items whose box meets a field's box.
  const pg = cases[k][cases[k].length - 1];
  const src = layout.find((p) => p.page === pg.page);
  const covered = (f) => src.items.filter((t) => t.x < f.x + f.w && t.x + t.w > f.x && t.y - t.h < f.y + f.h && t.y > f.y).length;
  console.log(`${k}: ${all.length} fields in all, ${fb.length} from the fixed block, all on page ${pg.page}`);
  fb.forEach((p) => console.log(`   ${p.type} ${p.role} x ${p.x.toFixed(0)}-${(p.x + p.w).toFixed(0)} y ${p.y.toFixed(0)}-${(p.y + p.h).toFixed(0)} covers ${covered(p)} piece(s) of printed text`));
});
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
