#!/usr/bin/env node
/*
 * Phase 01.4-08: the place model's decoding and snapping, on made-up heat maps and made-up page pictures (no browser,
 * no model, no document). Each case prints one line, PASS or FAIL; the last line is "PLACEMODEL UNIT: PASS" or "FAIL".
 *
 *   node .planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/checks/placemodel-unit.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../../../..');
const ctx = { window: { CVPortal: {} }, document: { baseURI: 'http://localhost/' }, URL, console, setTimeout, clearTimeout, Promise };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/placemodel.js'), 'utf8'), ctx, { filename: 'placemodel.js' });
const PM = ctx.window.CVPortal.placemodel;

let bad = 0;
const line = (ok, name, said) => {
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${said}`);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const r1 = (v) => Math.round(v * 10) / 10;
const fmt = (b) => (b ? `[${r1(b.x0)}, ${r1(b.y0)}, ${r1(b.x1)}, ${r1(b.y1)}]` : 'none');

/* ---------- decode ---------- */
const MW = 40;
const MH = 30;
const N = MW * MH;
const K = 3; // one cell is 4 pixels of the 96-to-the-inch input, 3 points
function maps(fill) {
  const m = new Float32Array(6 * N);
  for (let i = 0; i < N; i++) m[i] = 1; // paper everywhere
  fill((cls, r, c, v) => {
    m[(cls + 1) * N + r * MW + c] = v;
    m[r * MW + c] = 1 - v;
  });
  return m;
}
const T = { tick: 0.5, writing: 0.5, signature: 0.5, letterbox: 0.5, illustration: 0.95 };

{
  const m = maps((set) => {
    for (let r = 2; r <= 3; r++) for (let c = 4; c <= 5; c++) set(0, r, c, 0.9); // a tick, 2 x 2 cells
    for (let r = 10; r <= 11; r++) for (let c = 6; c <= 15; c++) set(1, r, c, 0.8); // a writing place, 10 x 2 cells
  });
  const got = PM.decode(m, MW, MH, 612, 792, T);
  const ok = got.length === 2 && got[0].cls === 'tick' && got[1].cls === 'writing' && near(got[0].x0, 4 * K, 1e-9) && near(got[0].y0, 2 * K, 1e-9) && near(got[0].x1, 6 * K, 1e-9) && near(got[0].y1, 4 * K, 1e-9) && near(got[1].x0, 6 * K, 1e-9) && near(got[1].x1, 16 * K, 1e-9) && near(got[0].p, 0.9, 1e-6);
  line(ok, 'two blobs', got.map((g) => `${g.cls} ${fmt(g)} p ${r1(g.p * 100) / 100}`).join('; ') + ' (expected tick [12, 6, 18, 12], writing [18, 30, 48, 36])');
}
{
  const m = maps((set) => {
    for (let r = 5; r <= 6; r++) for (let c = 2; c <= 4; c++) set(0, r, c, 0.9);
    for (let r = 5; r <= 6; r++) for (let c = 5; c <= 7; c++) set(0, r, c, 0.7); // shares an edge: one place
    set(0, 9, 10, 0.9);
    set(0, 10, 11, 0.9); // touches only at a corner: two places
  });
  const got = PM.decode(m, MW, MH, 612, 792, T);
  const ok = got.length === 3 && near(got[0].x0, 2 * K, 1e-9) && near(got[0].x1, 8 * K, 1e-9) && near(got[0].p, 0.8, 1e-6) && near(got[1].y0, 9 * K, 1e-9) && near(got[2].y0, 10 * K, 1e-9);
  line(ok, 'a blob touching another', `${got.length} places: ${got.map(fmt).join(', ')} (expected one of 6 x 2 cells with p 0.8, and the two corner-touching cells apart)`);
}
{
  const got = PM.decode(maps(() => {}), MW, MH, 612, 792, T);
  line(got.length === 0, 'an empty map', `${got.length} places (expected 0)`);
}
{
  const m = maps((set) => {
    set(0, 1, 1, Infinity);
    set(0, 1, 2, 0.9);
    set(1, 20, 1, NaN);
    set(1, 20, 2, NaN);
    set(1, 20, 3, NaN);
    for (let c = 30; c <= 45; c++) set(1, 25, Math.min(c, MW - 1), 0.9); // runs to the map's edge
  });
  const got = PM.decode(m, MW, MH, 100, 792, T);
  const ok = got.length === 1 && got[0].cls === 'writing' && got[0].x1 <= 100 && Number.isFinite(got[0].p);
  line(ok, 'values that are not finite, and a place past the page', `${got.length} places: ${got.map((g) => g.cls + ' ' + fmt(g)).join(', ')} (expected the writing place only, clamped to x1 100)`);
}
{
  const m = maps((set) => {
    set(1, 3, 3, 0.9);
    set(1, 3, 4, 0.9); // two cells: fewer than a writing place needs
  });
  const got = PM.decode(m, MW, MH, 612, 792, T);
  line(got.length === 0, 'a writing place of too few cells', `${got.length} places (expected 0)`);
}

/* ---------- made-up page pictures (2 pixels a point) ---------- */
const S = 2;
function page(w, h, ground) {
  const g = new Uint8Array(w * h).fill(ground || 255);
  return {
    g,
    w,
    h,
    rect(x0, y0, x1, y1, v) {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * w + x] = v;
    },
    frame(x0, y0, x1, y1, t, v) {
      this.rect(x0, y0, x1, y0 + t, v);
      this.rect(x0, y1 - t, x1, y1, v);
      this.rect(x0, y0, x0 + t, y1, v);
      this.rect(x1 - t, y0, x1, y1, v);
    }
  };
}
{
  const p = page(400, 300);
  p.frame(100, 100, 120, 120, 2, 20); // a 10 pt tick box, its frame 1 pt
  const P = PM.sheet(p.g, p.w, p.h, 255, 215, S);
  const got = PM.snapBox(P, { x0: 106, y0: 95, x1: 126, y1: 116 }, 'tick'); // the model's box 3 pt off, 2.5 pt short
  const ok = !!got && got.x0 === 100 && got.y0 === 100 && got.x1 === 120 && got.y1 === 120;
  line(ok, 'a box snapped to a drawn square', `${fmt(got)} (expected [100, 100, 120, 120])`);
}
{
  const p = page(400, 300);
  p.frame(100, 100, 120, 120, 2, 20);
  const P = PM.sheet(p.g, p.w, p.h, 255, 215, S);
  const got = PM.snapBox(P, { x0: 250, y0: 200, x1: 270, y1: 220 }, 'tick');
  line(got === null, 'a box with no edge near is dropped', `${fmt(got)} (expected none)`);
}
{
  const p = page(400, 300);
  p.frame(100, 100, 120, 120, 2, 20);
  p.rect(105, 105, 115, 115, 20); // a ticked box: print inside
  const P = PM.sheet(p.g, p.w, p.h, 255, 215, S);
  const got = PM.snapBox(P, { x0: 100, y0: 100, x1: 120, y1: 120 }, 'tick');
  line(got === null, 'a box with print inside is dropped', `${fmt(got)} (expected none)`);
}
{
  const p = page(400, 300, 190); // a grey ground
  p.rect(150, 60, 350, 100, 255); // a white box on it with no drawn edge
  const P = PM.sheet(p.g, p.w, p.h, 255, 215, S);
  const got = PM.snapBox(P, { x0: 144, y0: 64, x1: 352, y1: 96 }, 'letterbox');
  const ok = !!got && got.x0 === 150 && got.y0 === 60 && got.x1 === 350 && got.y1 === 100;
  line(ok, 'a white box on a tinted ground snapped to its tint steps', `${fmt(got)} (expected [150, 60, 350, 100])`);
}
{
  const p = page(400, 300);
  p.rect(60, 200, 300, 202, 30); // a printed line 120 pt long, 1 pt thick
  const P = PM.sheet(p.g, p.w, p.h, 255, 225, S);
  const got = PM.snapRule(P, { x0: 70, y0: 175, x1: 290, y1: 206 });
  const ok = !!got && got.line && got.x0 === 60 && got.x1 === 300 && got.y0 === 200 && got.y1 === 202 && got.t === 2;
  line(ok, 'a writing place snapped to the line under it', `${fmt(got)} t ${got && got.t} (expected [60, 200, 300, 202] t 2)`);
}
{
  const p = page(400, 300);
  p.rect(60, 200, 300, 202, 30);
  p.rect(80, 186, 200, 197, 30); // print standing on the line: an answered line or underlined words
  const P = PM.sheet(p.g, p.w, p.h, 255, 225, S);
  const got = PM.snapRule(P, { x0: 70, y0: 175, x1: 290, y1: 206 });
  line(got === null, 'a line with print on it is dropped', `${fmt(got)} (expected none)`);
}
{
  const p = page(400, 300);
  for (let x = 60; x < 300; x += 6) p.rect(x, 200, x + 3, 203, 30); // a row of small marks, no line
  const P = PM.sheet(p.g, p.w, p.h, 255, 225, S);
  const got = PM.snapRule(P, { x0: 70, y0: 175, x1: 290, y1: 206 });
  line(got === null, 'a writing place with no line under it is dropped', `${fmt(got)} (expected none)`);
}

{
  const p = page(400, 300);
  p.rect(10, 200, 390, 202, 30); // a separator across the page, far past the place's ends
  const P = PM.sheet(p.g, p.w, p.h, 255, 225, S);
  const got = PM.snapRule(P, { x0: 150, y0: 175, x1: 250, y1: 206 });
  line(got === null, 'a writing place on a separator across the page is dropped', `${fmt(got)} (expected none)`);
}
{
  const p = page(400, 300);
  p.rect(100, 200, 160, 202, 30); // a row of letters run together: print just under the row as well
  for (let x = 100; x < 160; x += 4) p.rect(x, 202, x + 2, 210, 30);
  const P = PM.sheet(p.g, p.w, p.h, 255, 225, S);
  const got = PM.snapRule(P, { x0: 100, y0: 175, x1: 160, y1: 203 });
  line(got === null, 'a writing place on letters run together is dropped', `${fmt(got)} (expected none)`);
}

/* ---------- whole path in points: snapAll and resample ---------- */
{
  const p = page(400, 300);
  p.frame(100, 100, 120, 120, 2, 20);
  p.rect(60, 200, 300, 202, 30);
  const view = { scale: S, sy: S, ox: 0, oy: 0 };
  const P = PM.sheet(p.g, p.w, p.h, 255, 215, S);
  const places = [
    { cls: 'writing', x0: 35, y0: 88, x1: 145, y1: 103, p: 0.8 },
    { cls: 'tick', x0: 51, y0: 49, x1: 61, y1: 59, p: 0.9 },
    { cls: 'tick', x0: 150, y0: 20, x1: 158, y1: 28, p: 0.9 } // nothing printed there
  ];
  const got = PM.snapAll(places, P, view);
  const ok = got.length === 2 && got[0].cls === 'tick' && got[0].src === 'model' && near(got[0].x0, 50, 1e-9) && near(got[0].x1, 60, 1e-9) && got[1].cls === 'writing' && near(got[1].y1, 101, 1e-9) && near(got[1].y0, 101 - 1 - 14, 1e-9);
  line(ok, 'places in points snapped, sorted, the unsnapped one left out', got.map((g) => `${g.cls} ${fmt(g)}`).join('; ') + ' (expected tick [50, 50, 60, 60]; writing [30, 86, 150, 101])');
}
{
  const p = page(300, 400);
  p.rect(0, 0, 150, 400, 0); // left half black
  const view = { scale: 300 / 150, sy: 400 / 200, ox: 0, oy: 0, pw: 150, ph: 200 };
  const a = PM.resample(p.g, p.w, p.h, view);
  const b = PM.resample(p.g, p.w, p.h, view);
  const same = a.pixels.length === b.pixels.length && a.pixels.every((v, i) => v === b.pixels[i]);
  const ok = a.pw96 === 200 && a.ph96 === 267 && a.w === 208 && a.h === 272 && a.pixels[0] === 0 && a.pixels[150] === 1 && a.pixels[271 * 208 + 5] === 1 && same;
  line(ok, 'the page resampled to 96 to the inch, padded with paper, the same twice', `${a.pw96} x ${a.ph96} in ${a.w} x ${a.h}; print ${a.pixels[0]}, paper ${a.pixels[150]}, padding ${a.pixels[271 * 208 + 5]}; identical ${same}`);
}

console.log(`PLACEMODEL UNIT: ${bad ? 'FAIL' : 'PASS'}`);
process.exit(bad ? 1 : 0);
