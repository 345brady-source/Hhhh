#!/usr/bin/env node
/*
 * Plan 01.4-64: the reading server's places and answer in placement.js (candidates, fromAnswer), on made-up pages only
 * (no browser, no server, no document). Each case prints one line, PASS or FAIL; the last line is
 * "SERVER READ UNIT: PASS" or "SERVER READ UNIT: FAIL".
 *
 *   node .planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/checks/server-read-unit.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../../../..');
const ctx = { window: { CVPortal: {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/placement.js'), 'utf8'), ctx, { filename: 'placement.js' });
const PL = ctx.window.CVPortal.placement;

let bad = 0;
const line = (ok, name, said) => {
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${said}`);
};
const plain = (v) => JSON.parse(JSON.stringify(v));
const over = (f, c) => Math.min(f.x + f.w, c.x1) - Math.max(f.x, c.x0) > 0 && Math.min(f.y + f.h, c.y1) - Math.max(f.y, c.y0) > 0;

/*
 * A made-up page in the format anchors.js gives placement.read: words (baseline y, top-left origin), drawn rules with the
 * empty paper above them (clear), squares and form widgets. Line 1: a caption and a blank line. Line 2: a caption and a
 * short rule with little room above it (printed, but no blank layout() proposes). Line 3: a square with its words.
 * Line 4: a caption and nothing printed after it. Line 5: an empty widget of the PDF.
 */
const word = (s, x, y, w) => ({ s, x, y, w: w || s.length * 5, h: 10 });
const page1 = {
  page: 1,
  w: 612,
  h: 792,
  items: [word('Name of Subscriber:', 72, 100, 95), word('Telephone', 72, 140, 48), word('Accredited investor', 318, 209, 90), word('Signature of officer', 72, 260, 95), word('Remarks', 72, 394, 40)],
  rules: [
    { x0: 180, x1: 400, y: 101, clear: 20 },
    { x0: 140, x1: 240, y: 141, clear: 5 },
    { x0: 420, x1: 520, y: 101, clear: 5 },
    { x0: 180, x1: 400, y: 262, clear: 30 }
  ],
  boxes: [{ x: 302, y: 200, w: 10, h: 10 }],
  forms: [
    { x0: 302, y0: 200, x1: 312, y1: 210, type: 'Btn', label: '', check: true, radio: false, readOnly: false },
    { x0: 130, y0: 380, x1: 300, y1: 396, type: 'Tx', label: '', check: false, radio: false, readOnly: false }
  ]
};
const page2 = { page: 2, w: 612, h: 792, items: [word('Address:', 72, 100, 40)], rules: [{ x0: 120, x1: 400, y: 101, clear: 20 }], boxes: [], forms: [] };
const pages = [page1, page2];

const cand = PL.candidates(pages, []);
const items = cand.items;
const find = (pred) => items.find(pred);
const nameLine = find((c) => c.page === 1 && c.what === 'line' && c.x0 < 200 && c.y1 > 95 && c.y1 < 110);
const box = find((c) => c.what === 'box');
const widgetBox = find((c) => c.what === 'form' && c.y0 === 200);
const widgetText = find((c) => c.what === 'form' && c.y0 === 380);
const sigLine = find((c) => c.page === 1 && c.what === 'line' && c.y1 > 255);
const addr = find((c) => c.page === 2);
const shortRule = find((c) => c.page === 1 && c.x0 >= 139 && c.x1 <= 241);

/* ---------- candidates ---------- */
{
  const ids = items.map((c) => c.id);
  const ok = items.length === 6 && ids.every((id, i) => id === i + 1) && nameLine && box && widgetBox && widgetText && sigLine && addr && !shortRule && cand.rows.length === items.length && cand.rows.every((r) => r.length === 7 && Number.isInteger(r[0]) && typeof r[6] === 'string');
  line(ok, 'candidates', `${items.length} places (${items.map((c) => c.what).join(', ')}), numbered 1..${items.length}; the short rule with 5 pt above it is ${shortRule ? 'a place (wrong)' : 'not a place'} (expected 6: two lines, a box, two widgets on page 1, one line on page 2)`);
}
{
  const t = cand.text;
  const ok = /^=== Page 1 \(612 x 792 pt\) ===/.test(t) && /=== Page 2 \(612 x 792 pt\) ===/.test(t) && t.includes(`Name of Subscriber: [#${nameLine.id}]`) && t.includes(`[#${box.id}]`) && t.includes(`[#${widgetBox.id}]`) && t.includes(`[#${widgetText.id}]`) && t.includes(`Address: [#${addr.id}]`) && items.every((c) => t.includes(`[#${c.id}]`));
  line(ok, 'candidate text', `every place appears as [#id] on its printed line under its page header (${t.split('\n').length} lines)`);
}
{
  // An in-page proposal on a printed place is that place's rectangle; one on no printed place becomes a place of its own.
  const onLine = { type: 'signature', page: 1, x: 180, y: 220, w: 220, h: 42 };
  const loose = { type: 'text', page: 2, x: 300, y: 600, w: 120, h: 14, label: 'Loose' };
  const c2 = PL.candidates(pages, [onLine, loose]);
  const sl = c2.items.find((c) => c.page === 1 && c.what === 'line' && c.y1 > 255);
  const pl = c2.items.find((c) => c.what === 'place');
  const ok = c2.items.length === 7 && sl && sl.prop === onLine && pl && pl.page === 2 && pl.x0 === 300;
  line(ok, 'in-page proposals', `${c2.items.length} places; the proposal on the signature line is ${sl && sl.prop === onLine ? 'kept with it' : 'not kept'}; the loose proposal is ${pl ? 'a place of its own' : 'missing'}`);
  const out = PL.fromAnswer(pages, c2.items, { fields: [{ id: sl.id, kind: 'signature', person: 'investor', group: 'all' }], missing: [] });
  const f = out.fields[0];
  line(out.fields.length === 1 && f.x === 180 && f.y === 220 && f.w === 220 && f.h === 42, 'in-page rectangle reused', `field at ${f && [f.x, f.y, f.w, f.h].join(',')} (expected the in-page proposal's 180,220,220,42)`);
}

/* ---------- chosen places ---------- */
{
  const out = PL.fromAnswer(pages, items, {
    fields: [
      { id: nameLine.id, kind: 'investorName', person: 'investor', group: 'all' },
      { id: box.id, kind: 'checkbox', person: 'investor', group: 'individual' },
      { id: sigLine.id, kind: 'signature', person: 'sponsor', group: 'all' },
      { id: addr.id, kind: 'address', person: 'investor', group: 'entity' },
      { id: widgetText.id, kind: 'text', person: 'sponsor', group: 'all' }
    ],
    missing: []
  });
  const by = (c) => out.fields.find((f) => f.page === c.page && over(f, c));
  const n = by(nameLine);
  const b = by(box);
  const s = by(sigLine);
  const a = by(addr);
  const w = by(widgetText);
  line(out.fields.length === 5 && out.dropped === 0, 'one field per chosen place', `${out.fields.length} fields, ${out.dropped} dropped (expected 5, 0)`);
  line(!!n && n.type === 'text' && n.role === 'investor' && n.required === false && n.prefill === 'investorName' && n.label === 'Investor name' && !n.forType && n.conf === 'high' && !n.review, 'investor name', n ? `type ${n.type}, ${n.role}, required ${n.required}, prefill ${n.prefill}, label "${n.label}"` : 'missing');
  line(!!b && b.type === 'checkbox' && b.required === false && !b.prefill && b.forType === 'person' && b.label === 'Accredited investor' && Math.abs(b.x - 302.75) < 0.01 && Math.abs(b.w - 8.5) < 0.01, 'investor tick box', b ? `type ${b.type}, required ${b.required}, forType ${b.forType}, label "${b.label}", inset box at ${b.x},${b.y} ${b.w}x${b.h}` : 'missing');
  line(!!s && s.type === 'signature' && s.role === 'firm' && s.required === true && !s.prefill, 'sponsor signature', s ? `type ${s.type}, ${s.role}, required ${s.required}` : 'missing');
  line(!!a && a.prefill === 'address' && a.required === false && a.forType === 'entity' && a.kind === 'address', 'investor address', a ? `prefill ${a.prefill}, required ${a.required}, forType ${a.forType}, kind ${a.kind}` : 'missing');
  line(!!w && w.type === 'text' && w.role === 'firm' && w.required === true && !w.prefill && w.label === 'Remarks' && w.x === 130 && w.w === 170, 'sponsor text on a widget', w ? `type ${w.type}, ${w.role}, required ${w.required}, label "${w.label}", widget rectangle ${w.x},${w.y} ${w.w}x${w.h}` : 'missing');
}
{
  // The square and the widget drawn over it overlap by more than half both ways: one field, the first by number.
  const first = Math.min(box.id, widgetBox.id);
  const out = PL.fromAnswer(pages, items, { fields: [{ id: widgetBox.id, kind: 'checkbox', person: 'investor', group: 'all' }, { id: box.id, kind: 'checkbox', person: 'investor', group: 'all' }], missing: [] });
  const want = items.find((c) => c.id === first);
  line(out.fields.length === 1 && out.merged === 1 && over(out.fields[0], want), 'overlapping places give one field', `${out.fields.length} field(s), ${out.merged} merged; kept place #${first}`);
}

/* ---------- places the list missed ---------- */
{
  const out = PL.fromAnswer(pages, items, { fields: [{ id: nameLine.id, kind: 'investorName', person: 'investor', group: 'all' }], missing: [{ page: 1, near: nameLine.id, caption: '', side: 'right', kind: 'phone', person: 'investor', group: 'all' }] });
  const f = out.fields.find((x) => x.prefill === 'phone');
  line(out.fields.length === 2 && out.dropped === 0 && !!f && f.x >= 419 && f.x + f.w <= 521 && f.y + f.h >= 100 && f.y < 101, 'missing place right of a place, on a printed rule', f ? `field at ${f.x},${f.y} ${f.w}x${f.h} (the rule runs 420 to 520 at 101); ${out.dropped} dropped` : `no field; ${out.dropped} dropped`);
}
{
  const out = PL.fromAnswer(pages, items, { fields: [{ id: addr.id, kind: 'address', person: 'investor', group: 'all' }], missing: [{ page: 2, near: addr.id, caption: '', side: 'right', kind: 'city', person: 'investor', group: 'all' }] });
  line(out.fields.length === 1 && out.dropped === 1, 'missing place with nothing printed there', `${out.fields.length} field(s), ${out.dropped} dropped (expected 1, 1)`);
}
{
  const out = PL.fromAnswer(pages, items, { fields: [], missing: [{ page: 1, near: -1, caption: 'TELEPHONE ', side: 'right', kind: 'phone', person: 'investor', group: 'all' }] });
  const f = out.fields[0];
  line(out.fields.length === 1 && out.dropped === 0 && f.x >= 139 && f.x + f.w <= 241 && f.prefill === 'phone', 'caption words found on the page', f ? `field at ${f.x},${f.y} ${f.w}x${f.h} (the short rule runs 140 to 240 at 141)` : `no field; ${out.dropped} dropped`);
}
{
  const out = PL.fromAnswer(pages, items, { fields: [], missing: [{ page: 1, near: -1, caption: 'Facsimile', side: 'right', kind: 'phone', person: 'investor', group: 'all' }, { page: 1, near: -1, caption: 'Te', side: 'right', kind: 'phone', person: 'investor', group: 'all' }] });
  line(out.fields.length === 0 && out.dropped === 2, 'caption words not on the page', `${out.fields.length} field(s), ${out.dropped} dropped (expected 0, 2: words not printed, and words under 3 characters)`);
}
{
  // A missing place never lands on geometry a chosen field already holds.
  const out = PL.fromAnswer(pages, items, { fields: [{ id: nameLine.id, kind: 'investorName', person: 'investor', group: 'all' }], missing: [{ page: 1, near: -1, caption: 'Name of Subscriber', side: 'right', kind: 'name', person: 'investor', group: 'all' }] });
  const f = out.fields.find((x) => x.kind !== 'text' || x.prefill !== 'investorName');
  line(out.fields.length === 2 && f && f.x >= 419, 'claimed geometry skipped', f ? `the second field went to ${f.x} (the free rule at 420), not onto the chosen line` : `${out.fields.length} field(s)`);
}

/* ---------- what is ignored ---------- */
{
  const out = PL.fromAnswer(pages, items, {
    fields: [
      { id: 999, kind: 'signature', person: 'investor', group: 'all' },
      { id: nameLine.id, kind: 'stamp', person: 'investor', group: 'all' },
      { id: box.id, kind: 'checkbox', person: 'co-investor', group: 'all' },
      { id: sigLine.id, kind: 'signature', person: 'investor', group: 'everyone' },
      { id: addr.id, kind: 'address', person: 'investor', group: 'all' }
    ],
    missing: [{ page: 1, near: 999, caption: '', side: 'right', kind: 'phone', person: 'investor', group: 'all' }, { page: 1, near: nameLine.id, caption: '', side: 'inside', kind: 'phone', person: 'investor', group: 'all' }]
  });
  line(out.fields.length === 1 && out.ignored === 6, 'unknown ids and values outside the lists', `${out.fields.length} field(s), ${out.ignored} ignored (expected 1, 6)`);
}
{
  const shapes = [null, [], 'text', {}, { fields: [] }, { fields: {}, missing: [] }, { fields: [], missing: 'x' }];
  const got = shapes.map((a) => PL.fromAnswer(pages, items, a));
  line(
    got.every((g) => g === null),
    'answers of the wrong shape',
    `${got.filter((g) => g === null).length} of ${shapes.length} give no result (the upload keeps the in-page reading)`
  );
}
{
  // Pictures and failed pages give no places, and reading them never throws.
  const c3 = PL.candidates([{ page: 1, scan: true }, { page: 2, failed: true, w: 612, h: 792 }, null], []);
  line(c3.items.length === 0 && c3.text === '', 'unreadable pages', `${c3.items.length} places`);
}

console.log(bad ? `SERVER READ UNIT: FAIL (${bad})` : 'SERVER READ UNIT: PASS');
process.exit(bad ? 1 : 0);
