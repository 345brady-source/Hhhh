/*
 * Scratch: one change at a time to the layout read from the real agreement, to confirm which rule of placement.js
 * is behind each miss. node rules-test.js <layout.json>
 */
const fs = require('fs');
const vm = require('vm');
const g = { window: { CVPortal: {} }, console };
vm.runInNewContext(fs.readFileSync('/home/user/Hhhh/assets/js/placement.js', 'utf8'), g);
const P = g.window.CVPortal.placement;
const layout = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const ctx = { countersign: true, firmNames: ['Northgate Capital'], fundNames: ['New offering'] };
const run = (pg) => P.analyze([pg], ctx).filter((p) => !/could be read in this PDF/.test(p.why || ''));
const line = (p) => `${p.type}/${p.role} "${p.label}" ${p.prefill ? 'prefill=' + p.prefill : ''} ${p.conf} y ${p.y.toFixed(0)}-${(p.y + p.h).toFixed(0)} x ${p.x.toFixed(0)}-${(p.x + p.w).toFixed(0)}${p.why ? ' [' + p.why + ']' : ''}`;
const show = (title, fields, only) => {
  console.log('\n' + title);
  fields.filter(only || (() => true)).forEach((p) => console.log('   ' + line(p)));
};
const notBox = (p) => p.type !== 'checkbox';

/* T1. Page 5: three blanks, each on the line below its label. */
const p5 = layout[4];
const labels5 = p5.items.filter((t) => /:\s*$/.test(t.s) && t.y > 250);
console.log('page 5 labels above lines (length in characters, ends in colon):', labels5.map((t) => t.s.length + (/:\s*$/.test(t.s) ? ' colon' : '')).join(' | '));
show('T1a. page 5 as printed', run(clone(p5)), notBox);
const t1b = clone(p5);
t1b.items.filter((t) => /:\s*$/.test(t.s) && t.y > 250).slice(0, 2).forEach((t, i) => (t.s = i === 0 ? 'Mailing address:' : 'Email:'));
show('T1b. the same page with the first two labels reworded to labels the code knows ("Mailing address:", "Email:")', run(t1b), notBox);
const t1c = clone(p5);
t1c.items.filter((t) => /:\s*$/.test(t.s) && t.y > 250).slice(0, 2).forEach((t, i) => (t.s = i === 0 ? 'Country of citizenship:' : 'Country of residence:'));
show('T1c. the same page with the first two labels shortened to short unknown labels ending in a colon', run(t1c), notBox);
// The same unknown label with its blank on the SAME line: move the first underscore run up beside its label.
const t1d = clone(p5);
const lab = t1d.items.filter((t) => /:\s*$/.test(t.s) && t.y > 250)[0];
lab.s = 'Country of citizenship:';
lab.w = 130;
const us = t1d.items.filter((t) => /^_{3,}$/.test(t.s)).sort((a, b) => a.y - b.y)[0];
const dy = us.y - lab.y;
t1d.rules.forEach((r) => {
  if (Math.abs(r.y - (us.y + 2.4)) < 3 && r.x1 - r.x0 > 100) {
    r.y -= dy;
    r.x0 += 140;
    r.x1 += 140;
    r.clear = 12;
  }
});
us.y = lab.y;
us.x += 140;
show('T1d. the first unknown label with its blank moved onto the same line', run(t1d), notBox);

/* T2. Page 2: a bold label that wraps over two printed lines, the blank after its last words. */
const p2 = layout[1];
show('T2a. page 2 as printed', run(clone(p2)));
const t2b = clone(p2);
const second = t2b.items.find((t) => /^Partner's discretion\)/.test(t.s));
console.log('   (second printed line of the label starts with a capital letter:', !!second && /^[A-Z]/.test(second.s), ')');
if (second) second.s = second.s[0].toLowerCase() + second.s.slice(1);
show('T2b. the same page with the second line of the label starting in lower case', run(t2b));

/* T3. Page 7: a label over three printed lines. */
show('T3. page 7 as printed (text fields only)', run(clone(layout[6])), notBox);

/* T4. Page 13: underscores between square brackets in a table. */
const p13 = layout[12];
console.log('\npage 13 pieces with underscores:', p13.items.filter((t) => /_/.test(t.s)).map((t) => JSON.stringify(t.s.replace(/_+/g, (m) => `_x${m.length}`))).join(' '));
show('T4. page 13 as printed', run(clone(p13)));

/* T5. Page 12 with the heading and the firm's name line removed: who gets the acceptance block then? */
const p12 = clone(layout[11]);
show('T5a. page 12 as printed', run(clone(p12)));
const t5 = clone(p12);
t5.items = t5.items.filter((t) => t.y > 190);
show('T5b. page 12 with everything above the By line removed (no heading, no acceptance sentence, no firm name)', run(t5));

/* T6. Page 11 with the two sub-headings removed. */
const t6 = clone(layout[10]);
t6.items = t6.items.filter((t) => !/^For (Individual|Entity) Subscribers/.test(t.s));
show('T6. page 11 without the "for individual / for entity" sub-headings (signature and name fields only)', run(t6), (p) => p.type === 'signature' || p.type === 'name');
