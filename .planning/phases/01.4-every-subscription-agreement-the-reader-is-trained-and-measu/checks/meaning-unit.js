#!/usr/bin/env node
/*
 * Phase 01.4-23: the meaning layer's pure parts (assets/js/meaning.js) on made-up pages: blocks, features, the tree
 * evaluator, calibration and word normalisation. No browser, no model file, no document. Each case prints one line,
 * PASS or FAIL; the last line is "MEANING UNIT: PASS" or "MEANING UNIT: FAIL".
 *
 *   node .planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/checks/meaning-unit.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../../../..');
let bad = 0;
const line = (ok, name, said) => {
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${said}`);
};

/* ---------- loading: under Node with no window, and in a page-like context after placement.js ---------- */
let bare = null;
try {
  const ctx0 = { console };
  ctx0.globalThis = ctx0;
  vm.createContext(ctx0);
  // As a module: no window, no document; the file must not touch either when it loads.
  const mod = { exports: {} };
  vm.runInContext(`(function (module, exports) {${fs.readFileSync(path.join(ROOT, 'assets/js/meaning.js'), 'utf8')}\n})`, ctx0, { filename: 'meaning.js' })(mod, mod.exports);
  bare = mod.exports && mod.exports.features ? mod.exports : null;
} catch (e) {
  bare = null;
  line(false, 'loads without a window', String(e && e.message));
}
if (bare) line(true, 'loads without a window', 'module.exports carries blocks, features, predict, calibrate');
else if (bare === null) line(false, 'loads without a window', 'module.exports is missing');

const ctx = { window: { CVPortal: {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/placement.js'), 'utf8'), ctx, { filename: 'placement.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/meaning.js'), 'utf8'), ctx, { filename: 'meaning.js' });
const M = ctx.window.CVPortal.meaning;
if (!M) {
  console.log('FAIL load: window.CVPortal.meaning is missing');
  console.log('MEANING UNIT: FAIL');
  process.exit(1);
}
['blocks', 'features', 'predict', 'calibrate', 'norm'].forEach((k) => line(typeof M[k] === 'function', `exports ${k}`, typeof M[k]));
line(M.FEATURES_V === 1, 'FEATURES_V', String(M.FEATURES_V));
line(Array.isArray(M.FEATURE_NAMES) && M.FEATURE_NAMES.length > 100 && new Set(M.FEATURE_NAMES).size === M.FEATURE_NAMES.length, 'FEATURE_NAMES fixed and unique', `${M.FEATURE_NAMES.length} names`);

/* ---------- norm ---------- */
const n1 = M.norm('Name of Subscriber (please print):');
line(n1 === 'name of subscriber', 'norm caption', JSON.stringify(n1));
const n2 = M.norm('Co-Investor’s  E-MAIL [optional]');
line(n2 === 'co investor s e mail', 'norm punctuation and brackets', JSON.stringify(n2));
const n3 = M.norm('Café — DÉJÀ');
line(n3 === 'café déjà', 'norm NFC and lower case', JSON.stringify(n3));

/* ---------- a made-up signature page: individual, joint and issuer acceptance blocks ---------- */
// Items are { s, x, y (baseline), w, h } in points, origin top-left; rules are { x0, x1, y, made }.
const it = (s, x, y, h) => ({ s, x, y, w: s.length * (h || 10) * 0.5, h: h || 10 });
function sigPage() {
  return {
    page: 1, w: 612, h: 792,
    items: [
      it('The undersigned agrees to the terms of this Subscription Agreement and the documents named in it.', 72, 80),
      it('INDIVIDUAL SUBSCRIBER', 72, 130, 11),
      it('Signature:', 72, 160),
      it('Name (please print):', 72, 185),
      it('Date:', 72, 210),
      it('JOINT SUBSCRIBER', 72, 270, 11),
      it('Signature of Joint Subscriber:', 72, 300),
      it('Name:', 72, 325),
      it('ACCEPTED BY THE ISSUER', 72, 390, 11),
      it('By:', 72, 420),
      it('Name:', 72, 445),
      it('Title:', 72, 470)
    ],
    rules: [
      { x0: 130, x1: 330, y: 161, made: 'rule' },
      { x0: 180, x1: 380, y: 186, made: 'rule' },
      { x0: 110, x1: 250, y: 211, made: 'rule' },
      { x0: 230, x1: 430, y: 301, made: 'underscores' },
      { x0: 110, x1: 310, y: 326, made: 'rule' },
      { x0: 100, x1: 300, y: 421, made: 'rule' },
      { x0: 110, x1: 310, y: 446, made: 'rule' },
      { x0: 110, x1: 310, y: 471, made: 'rule' }
    ],
    boxes: [],
    forms: []
  };
}
const pages = [sigPage()];
const B = M.blocks(pages);
const heads = B.map((b) => b.heading);
const want = ['INDIVIDUAL SUBSCRIBER', 'JOINT SUBSCRIBER', 'ACCEPTED BY THE ISSUER'];
const sigBlocks = B.filter((b) => want.indexOf(b.heading) >= 0);
line(sigBlocks.length === 3 && sigBlocks.map((b) => b.heading).join('|') === want.join('|'), 'blocks: three signature blocks in reading order', JSON.stringify(heads));
line(B.length === 4 && B[0].kind === 'section' && B[0].heading === '', 'blocks: the text before the first heading is its own block', B.map((b) => `${b.kind}:${b.heading || '-'}`).join(', '));
const kinds = sigBlocks.map((b) => b.kind).join(',');
line(kinds === 'signature,branch,signature', 'blocks: kinds (a joint heading opens a branch)', kinds);
line(B.every((b, i) => i === 0 || b.page > B[i - 1].page || b.y0 >= B[i - 1].y1 - 0.001), 'blocks: no overlap, top to bottom', B.map((b) => `${b.y0.toFixed(1)}-${b.y1.toFixed(1)}`).join(' '));
line(/\bname of joint subscriber\b|\bsignature of joint subscriber\b/.test(sigBlocks[1].words), 'blocks: words normalised', JSON.stringify(sigBlocks[1].words.slice(0, 60)));

// A branch line inside a section opens a branch block; a 24 pt gap ends a signature block opened by a caption.
const p2 = {
  page: 2, w: 612, h: 792,
  items: [
    it('SIGNATURE PAGE', 72, 70, 12),
    it('If an individual:', 72, 100),
    it('Signature', 72, 125),
    it('If an entity:', 72, 170),
    it('By:', 72, 195),
    it('Its:', 72, 220)
  ],
  rules: [{ x0: 130, x1: 330, y: 126, made: 'rule' }, { x0: 100, x1: 300, y: 196, made: 'rule' }, { x0: 100, x1: 300, y: 221, made: 'rule' }],
  boxes: [],
  forms: []
};
const B2 = M.blocks([p2]);
line(B2.map((b) => b.kind).join(',') === 'section,branch,branch' && B2[1].heading === 'If an individual:' && B2[2].heading === 'If an entity:', 'blocks: investor-type branches', B2.map((b) => `${b.kind}:${b.heading}`).join(', '));
const p3 = {
  page: 3, w: 612, h: 792,
  items: [it('Signature', 72, 100), it('Date', 72, 125), it('More terms follow on this page after a wide gap.', 72, 200)],
  rules: [], boxes: [], forms: []
};
const B3 = M.blocks([p3]);
line(B3.length === 2 && B3[0].kind === 'signature' && B3[1].kind === 'section', 'blocks: a 24 pt gap ends a signature block', B3.map((b) => `${b.kind}:${b.y0.toFixed(0)}-${b.y1.toFixed(0)}`).join(', '));

/* ---------- features ---------- */
// Proposals as placement.read gives them (page points): kind, role, second, other, forType, label, conf.
const prop = (o) => Object.assign({ type: 'text', role: 'investor', label: '', required: true, conf: 'high', why: '', page: 1 }, o);
function result() {
  return {
    fields: [
      prop({ kind: 'signature', type: 'signature', x: 130, y: 147, w: 200, h: 14, label: 'Signature' }),
      prop({ kind: 'name', x: 180, y: 172, w: 200, h: 14, label: 'Name' }),
      prop({ kind: 'date', type: 'date', x: 110, y: 197, w: 140, h: 14, label: 'Date', required: false }),
      prop({ kind: 'signature', type: 'signature', x: 230, y: 287, w: 200, h: 14, second: true, conf: 'low', required: false }),
      prop({ kind: 'name', x: 110, y: 312, w: 200, h: 14, second: true, conf: 'low', required: false }),
      prop({ kind: 'signature', type: 'signature', role: 'firm', x: 100, y: 407, w: 200, h: 14 }),
      prop({ kind: 'name', role: 'firm', x: 110, y: 432, w: 200, h: 14 }),
      prop({ kind: 'title', role: 'firm', x: 110, y: 457, w: 200, h: 14, conf: 'medium' })
    ]
  };
}
const R1 = M.features(pages, result());
const R2 = M.features([sigPage()], result());
const same = R1.length === R2.length && R1.every((r, i) => r.pid === R2[i].pid && r.page === R2[i].page && JSON.stringify(r.box) === JSON.stringify(R2[i].box) && r.x.length === R2[i].x.length && r.x.every((v, j) => Object.is(v, R2[i].x[j])));
line(R1.length === 8 && same, 'features: the same layout twice gives identical rows', `${R1.length} rows, identical ${same}`);
const L = M.FEATURE_NAMES.length;
line(R1.every((r) => Object.prototype.toString.call(r.x) === '[object Float64Array]' && r.x.length === L), 'features: every row has FEATURE_NAMES.length slots', `${L} names; row lengths ${Array.from(new Set(R1.map((r) => r.x.length))).join(',')}`);
line(R1.every((r) => r.x.every((v) => Number.isFinite(v))), 'features: every slot is a finite number', 'checked');
const at = (r, name) => r.x[M.FEATURE_NAMES.indexOf(name)];
line(M.FEATURE_NAMES.indexOf('cap:fam:signature') >= 0 && at(R1[0], 'cap:fam:signature') === 1 && at(R1[1], 'cap:fam:name') === 1, 'features: the caption before a place is counted by family', `sig ${at(R1[0], 'cap:fam:signature')}, name ${at(R1[1], 'cap:fam:name')}`);
line(at(R1[3], 'head:fam:joint') === 1 && at(R1[3], 'blk:kind:branch') === 1 && at(R1[5], 'head:fam:accepted') === 1 && at(R1[5], 'blk:kind:signature') === 1, 'features: block heading and kind reach the places', `joint ${at(R1[3], 'head:fam:joint')}, accepted ${at(R1[5], 'head:fam:accepted')}`);
line(at(R1[0], 'blk:index') === 0 && at(R1[2], 'blk:index') === 2 && at(R1[0], 'blk:sigCount') === 1, 'features: index in block and signature places in block', `${at(R1[0], 'blk:index')}, ${at(R1[2], 'blk:index')}, ${at(R1[0], 'blk:sigCount')}`);
line(at(R1[0], 'ev:rule') === 1 && at(R1[3], 'ev:underscore') === 1 && at(R1[3], 'dec:second') === 1 && at(R1[5], 'dec:role:firm') === 1 && at(R1[7], 'dec:conf:medium') === 1, 'features: evidence and the reader’s decision', 'rule, underscore, second, firm, medium');
line(Math.abs(at(R1[0], 'geo:x') - 130 / 612) < 1e-12 && Math.abs(at(R1[0], 'geo:w') - 200 / 612) < 1e-12, 'features: geometry as page fractions', `${at(R1[0], 'geo:x')}`);
// Reading order: proposals given out of order come back by page, top, left, with the proposal index as the last tie.
const shuffled = result();
shuffled.fields = [shuffled.fields[5], shuffled.fields[0], shuffled.fields[7], shuffled.fields[2], shuffled.fields[1], shuffled.fields[6], shuffled.fields[3], shuffled.fields[4]];
const R3 = M.features(pages, shuffled);
const order = R3.map((r) => `${r.box[1]}`).join(',');
line(order === R1.map((r) => `${r.box[1]}`).join(',') && R3.every((r, i) => r.x.every((v, j) => Object.is(v, R1[i].x[j]))), 'features: reading order whatever the proposal order', order);
line(R3[0].pid === 1 && R1[0].pid === 0, 'features: pid is the proposal’s index in res.fields', `${R3[0].pid}, ${R1[0].pid}`);
// Two places at the same top: left first, then the proposal index.
const tie = { fields: [prop({ kind: 'other', x: 300, y: 172, w: 50, h: 14 }), prop({ kind: 'other', x: 300, y: 172, w: 50, h: 14 }), prop({ kind: 'other', x: 100, y: 172, w: 50, h: 14 })] };
const R4 = M.features(pages, tie);
line(R4.map((r) => r.pid).join(',') === '2,0,1', 'features: tie-break by left, then proposal index', R4.map((r) => r.pid).join(','));
// Hashed bigrams: a fixed hash (FNV-1a, 32 bit) into 64 buckets.
const hb = M.bucket('joint subscriber');
line(hb === M.bucket('joint subscriber') && hb >= 0 && hb < 64 && M.fnv1a('a') === 0xe40c292c, 'features: fixed bigram hash', `bucket ${hb}, fnv1a("a") ${M.fnv1a('a').toString(16)}`);
// Nothing in the proposals or the pages is changed.
const before = JSON.stringify(result());
const rr = result();
M.features([sigPage()], rr);
line(JSON.stringify(rr) === before, 'features: proposals left unchanged', 'compared');

/* ---------- predict and calibrate ---------- */
// Trees as parallel arrays: node i splits on x[f[i]] < t[i] (left) else right; l[i] < 0 marks a leaf with value v[i].
const x = new Float64Array(L);
x[0] = 0.3;
x[1] = 5;
const bin = {
  v: 1, classes: ['no', 'yes'], base: [0.25],
  trees: [
    { f: [0, -1, -1], t: [0.5, 0, 0], l: [1, -1, -1], r: [2, -1, -1], v: [0, 0.7, -0.4] },
    { f: [1, -1, 1, -1, -1], t: [2, 0, 7, 0, 0], l: [1, -1, 3, -1, -1], r: [2, -1, 4, -1, -1], v: [0, -1.1, 0, 0.2, 0.9] }
  ]
};
// x[0] = 0.3 < 0.5: left leaf 0.7; x[1] = 5 >= 2: node 2; 5 < 7: node 3, leaf 0.2. score 0.25 + 0.7 + 0.2 = 1.15.
const s = 1.15;
const pyes = 1 / (1 + Math.exp(-s));
const pb = M.predict(bin, x);
line(pb && Math.abs(pb[1] - pyes) < 1e-12 && Math.abs(pb[0] - (1 - pyes)) < 1e-12, 'predict: binary model, two trees, sigmoid', pb ? `${pb[1]} vs ${pyes}` : 'null');
// Multi-class: each leaf carries one value per class; softmax over base + the sums.
const multi = {
  v: 1, classes: ['investor', 'firm', 'other'], base: [0.1, -0.2, 0],
  trees: [
    { f: [0, -1, -1], t: [0.2, 0, 0], l: [1, -1, -1], r: [2, -1, -1], v: [null, [1, 0, 0], [0.5, -0.5, 0.25]] },
    { f: [1, -1, -1], t: [5, 0, 0], l: [1, -1, -1], r: [2, -1, -1], v: [null, [0, 0, 0], [-0.3, 0.8, 0.1]] }
  ]
};
// x[0] = 0.3 >= 0.2: right [0.5, -0.5, 0.25]; x[1] = 5 >= 5: right [-0.3, 0.8, 0.1]. scores [0.3, 0.1, 0.35].
const sc = [0.1 + 0.5 - 0.3, -0.2 - 0.5 + 0.8, 0 + 0.25 + 0.1];
const mx = Math.max.apply(null, sc);
const ex = sc.map((v) => Math.exp(v - mx));
const sum = ex.reduce((a, b) => a + b, 0);
const want3 = ex.map((v) => v / sum);
const pm = M.predict(multi, x);
line(pm && pm.length === 3 && pm.every((v, i) => Math.abs(v - want3[i]) < 1e-12), 'predict: three classes, softmax', pm ? pm.map((v) => v.toFixed(15)).join(', ') : 'null');
// One value per leaf with the tree's class (one tree per class per round, as boosting libraries export).
const perClass = { v: 1, classes: ['a', 'b'], base: [0, 0], trees: [{ c: 0, f: [-1], t: [0], l: [-1], r: [-1], v: [0.4] }, { c: 1, f: [-1], t: [0], l: [-1], r: [-1], v: [-0.4] }] };
const pc = M.predict(perClass, x);
const e1 = Math.exp(0.4), e2 = Math.exp(-0.4);
line(pc && Math.abs(pc[0] - e1 / (e1 + e2)) < 1e-12, 'predict: one tree per class', pc ? pc.join(', ') : 'null');
line(M.predict(Object.assign({}, bin, { v: 2 }), x) === null, 'predict: a model of another feature version is refused', 'null');
// Calibration: an isotonic table, linear between its points, flat beyond its ends.
const tab = { x: [0, 0.2, 0.6, 1], y: [0, 0.1, 0.7, 1] };
const c1 = M.calibrate(tab, 0.4);
const c2 = M.calibrate(tab, 0.2);
const c3 = M.calibrate(tab, -0.5);
const c4 = M.calibrate(tab, 1.5);
const c5 = M.calibrate(tab, 0.9);
line(Math.abs(c1 - 0.4) < 1e-12 && Math.abs(c2 - 0.1) < 1e-12 && c3 === 0 && c4 === 1 && Math.abs(c5 - (0.7 + 0.3 * 0.75)) < 1e-12, 'calibrate: linear interpolation in an isotonic table', `${c1}, ${c2}, ${c3}, ${c4}, ${c5}`);

console.log(`MEANING UNIT: ${bad ? 'FAIL' : 'PASS'}`);
process.exit(bad ? 1 : 0);
