// Phase 2 check: the sponsor's field editor (EDIT-01 to EDIT-06, LOOK-01), with real pointer, touch and keyboard input.
// The sample firm's three-page subscription agreement is opened from the offering page ("Edit fields"); fields are dragged
// within a page and across pages, resized, snapped, nudged, added, duplicated, removed and changed; every step is undone
// and redone; the agreement is saved and an invited investor reaches it in onboarding with the fields where they were put.
// Run:  python3 -m http.server 8822   (from the repository root)   then   SIGN_PORT=8822 node editor.js
const L = require('./lib.js');
const { check, done } = L.reporter();

const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1 : tol);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const PAGE_W = 612;
const PAGE_H = 792;
// Marks another part of the portal may put on a field: the editor has to carry them without knowing them.
const EXTRA = {
  'tf-name': { review: 'Placed by the portal: check that it sits on the line', confidence: 'low', audience: 'individual' },
  'tf-title': { confidence: 'medium', audience: 'entity', note: { why: 'nested', n: [1, 2, 3] } }
};

/** Press, move in steps and (unless hold) release. each() runs after every step with the pointer's position. */
async function drag(p, from, to, opts) {
  opts = opts || {};
  const steps = opts.steps || 16;
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const pt = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, i };
    await p.mouse.move(pt.x, pt.y);
    if (opts.each) await opts.each(pt);
  }
  if (!opts.hold) await p.mouse.up();
}
const editorState = (p) =>
  p.evaluate(() => {
    const NS = window.CVPortal;
    const q = (s) => document.querySelector(s);
    const s = q('.fe-scroll');
    return {
      sel: NS.state.ui.es.sel,
      tool: NS.state.ui.es.tool,
      undo: !q('[data-action="fe-undo"]').disabled,
      redo: !q('[data-action="fe-redo"]').disabled,
      zoom: q('#fe-zoom').value,
      page: q('#fe-page').value,
      scrollTop: s.scrollTop,
      guides: document.querySelectorAll('.fe-guide').length,
      target: (q('.es-page.is-target') || { getAttribute: () => '' }).getAttribute('data-page'),
      tools: !!q('.fe-tools') && getComputedStyle(q('.fe-tools')).visibility !== 'hidden',
      handles: document.querySelectorAll('.es-fld.is-sel .es-handle').length,
      carried: document.querySelectorAll('.fe-carry .es-fld').length
    };
  });
const handlePoint = (p, id, dir) =>
  p.evaluate(
    ({ id, dir }) => {
      const r = document.querySelector(`.es-fld[data-fid="${CSS.escape(id)}"]`).getBoundingClientRect();
      const x = dir.indexOf('w') >= 0 ? r.left - 2 : dir.indexOf('e') >= 0 ? r.right + 2 : r.left + r.width / 2;
      const y = dir.indexOf('n') >= 0 ? r.top - 2 : dir.indexOf('s') >= 0 ? r.bottom + 2 : r.top + r.height / 2;
      const el = document.elementFromPoint(x, y);
      return { x, y, hit: el && el.classList.contains('es-handle') ? el.getAttribute('data-h') : '' };
    },
    { id, dir }
  );
/** Marks the page's own elements, to prove later that none of them was drawn again. */
const tagDom = (p) =>
  p.evaluate(() => {
    window.__tag = (window.__tag || 0) + 1;
    document.querySelectorAll('.cs, .fe-doc, .fe-doc .es-page, .fe-doc .es-page > img, .fe-rail, .fe-bar').forEach((el) => (el.__tag = window.__tag));
    return document.querySelectorAll('.fe-doc .es-page > img').length;
  });
const domKept = (p) => p.evaluate(() => Array.from(document.querySelectorAll('.cs, .fe-doc, .fe-doc .es-page, .fe-doc .es-page > img, .fe-bar')).every((el) => el.__tag === window.__tag));

(async () => {
  const browser = await L.chromium.launch();

  /* ===================== 1. Desktop, mouse and keyboard ===================== */
  {
    const A = await L.open(browser, { context: { viewport: { width: 1440, height: 900 } } });
    const p = A.page;
    try {
      await L.openEditor(p, A.context, { extra: EXTRA });
      const id = await L.idsByTemplate(p);
      const start = await L.fields(p);

      /* ----- LOOK-01: the three parts and the toolbar ----- */
      const parts = await p.evaluate(() => {
        const r = (s) => {
          const el = document.querySelector(s);
          const b = el ? el.getBoundingClientRect() : null;
          return b ? { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height } : null;
        };
        return { rail: r('.fe-rail'), stage: r('.fe-stage'), props: r('.fe-props'), bar: r('.fe-bar'), scroll: r('.fe-scroll'), main: r('.cs-main'), vh: window.innerHeight, tools: document.querySelectorAll('.es-palette .es-tool').length, signers: document.querySelectorAll('.es-signers .es-signer').length, fields: document.querySelectorAll('.fe-doc .es-fld').length };
      });
      check('LOOK-01 three parts side by side: fields to add, the document, the selected field', parts.rail && parts.stage && parts.props && parts.rail.r <= parts.stage.l && parts.stage.r <= parts.props.l && near(parts.rail.t, parts.stage.t, 1) && near(parts.stage.t, parts.props.t, 1), parts);
      check('LOOK-01 the editor fits what is left of the screen: the document scrolls inside it, not the page around it', parts.stage.t > 0 && parts.stage.b <= parts.vh - 24 && near(parts.rail.b, parts.stage.b, 1) && near(parts.props.b, parts.stage.b, 1) && parts.scroll.h > 400, { t: parts.stage.t, b: parts.stage.b, vh: parts.vh });
      const bar = await p.evaluate(() => ['fe-undo', 'fe-redo', 'fe-zoom-out', 'fe-zoom-in', 'fe-prev', 'fe-next'].map((a) => !!document.querySelector(`.fe-bar [data-action="${a}"]`)).concat([!!document.querySelector('.fe-bar #fe-zoom'), !!document.querySelector('.fe-bar #fe-page')]));
      check('LOOK-01 the toolbar has undo, redo, zoom and page controls', bar.every(Boolean), bar);
      check('LOOK-01 the palette offers the six field types and the three signers (the investor, the co-investor, the firm); the stored agreement loads with its 14 fields', parts.tools === 6 && parts.signers === 3 && parts.fields === 14 && start.length === 14, parts);
      const look = await p.evaluate((fid) => {
        const el = document.querySelector(`.es-fld[data-fid="${fid}"]`);
        const cs = getComputedStyle(el);
        return { glyph: !!el.querySelector('.es-fld-glyph svg'), label: el.querySelector('.es-fld-label').textContent, sc: el.style.getPropertyValue('--sc'), border: cs.borderTopStyle, paper: getComputedStyle(el.closest('.es-page')).backgroundColor };
      }, id['tf-sig']);
      check('LOOK-01 a field shows the mark of its type, its label and its signer’s color', look.glyph && /Signature/.test(look.label) && !!look.sc && look.border === 'solid', look);

      /* ----- EDIT-01: a drag within a page ----- */
      await L.scrollTo(p, 3, 0.35, 0.5);
      const title = id['tf-title'];
      const before = await L.field(p, title);
      const b0 = await L.box(p, title);
      const pg3 = await L.pageBox(p, 3);
      await tagDom(p);
      // Picked up off-centre: the grab point has to stay under the pointer.
      const grab = { x: b0.x + b0.w * 0.25, y: b0.y + b0.h * 0.7 };
      const off = { x: grab.x - b0.cx, y: grab.y - b0.cy };
      const dest = { x: pg3.x + pg3.w * 0.62, y: pg3.y + pg3.h * 0.78 };
      let worst = 0;
      let firstStep = null;
      let midModel = null;
      let midState = null;
      await p.keyboard.down('Alt'); // snapping off for this one, so the only thing moving the field is the pointer
      await drag(p, grab, dest, {
        steps: 30,
        hold: true,
        each: async (pt) => {
          const b = await L.box(p, title);
          const d = Math.max(Math.abs(b.cx + off.x - pt.x), Math.abs(b.cy + off.y - pt.y));
          worst = Math.max(worst, d);
          if (pt.i === 1) firstStep = { moved: Math.hypot(b.cx - b0.cx, b.cy - b0.cy), pointer: Math.hypot(pt.x - grab.x, pt.y - grab.y) };
          if (pt.i === 15) {
            midModel = await L.field(p, title);
            midState = Object.assign(await editorState(p), { transform: await p.evaluate((fid) => document.querySelector(`.es-fld[data-fid="${fid}"]`).style.transform, title), kept: await domKept(p), carried: b.carried });
          }
        }
      });
      const heldBox = await L.box(p, title);
      await p.mouse.up();
      await p.keyboard.up('Alt');
      const after = await L.field(p, title);
      const b1 = await L.box(p, title);
      check('EDIT-01 the field stays under the pointer at every step of the drag (within 2px)', worst <= 2, { worst });
      check('EDIT-01 no jump on pick-up: the first step moves the field exactly as far as the pointer', firstStep && near(firstStep.moved, firstStep.pointer, 0.6), firstStep);
      check('EDIT-01 while dragging the field is moved with a transform in the layer over the document', midState.carried && /translate3d\(/.test(midState.transform) && midState.carried === true, midState);
      check('EDIT-01 the model is not written and nothing on the page is drawn again during the drag', same(midModel, before) && midState.kept, { midModel, kept: midState.kept });
      check('EDIT-01 on release the field lands where it was let go, and only then is the model written', near(b1.cx + off.x, dest.x, 1) && near(b1.cy + off.y, dest.y, 1) && near(b1.x, heldBox.x, 0.6) && near(b1.y, heldBox.y, 0.6) && !b1.carried && after.page === 3 && near(after.x, (dest.x - off.x - b0.w / 2 - pg3.x) / pg3.w, 0.002) && after.w === before.w && after.h === before.h, { b1, dest, after });
      check('EDIT-01 the page was not drawn again by the drop either', await domKept(p));
      // Clamped to the page.
      const b2 = await L.box(p, title);
      await p.keyboard.down('Alt');
      await drag(p, { x: b2.cx, y: b2.cy }, { x: pg3.x - 160, y: b2.cy }, { steps: 12, hold: true });
      const leftHeld = await L.box(p, title);
      await p.mouse.up();
      await p.keyboard.up('Alt');
      const clampedL = await L.field(p, title);
      check('EDIT-01 the field is clamped to the page: pulled past the left edge it stops at the edge', near(leftHeld.x, pg3.x, 0.6) && clampedL.x === 0 && clampedL.page === 3, { leftHeld, x: clampedL.x });
      const st1 = await editorState(p);
      check('EDIT-05 each drag is one step: two drags, undo is on', st1.undo && !st1.redo, st1);
      await p.keyboard.press('Control+z');
      await p.keyboard.press('Control+z');
      check('EDIT-05 Ctrl+Z twice puts the field back exactly where it started', same(await L.fields(p), start), await L.field(p, title));

      /* ----- EDIT-02: from page 1 to page 2 in one movement ----- */
      const in1 = id['tf-in1'];
      await L.scrollTo(p, 1, 0.98, 0.45); // the foot of page 1 and the head of page 2 both in view
      const ib = await L.box(p, in1);
      const pg2 = await L.pageBox(p, 2);
      const drop2 = { x: pg2.x + pg2.w * 0.5, y: pg2.y + pg2.h * 0.12 };
      const beforeIn = await L.field(p, in1);
      await tagDom(p);
      let cross = null;
      await p.keyboard.down('Alt');
      await drag(p, { x: ib.cx, y: ib.cy }, drop2, {
        steps: 24,
        hold: true,
        each: async (pt) => {
          if (pt.i === 12 || pt.i === 24) {
            const b = await L.box(p, in1);
            const s = await editorState(p);
            cross = cross || [];
            cross.push({ carried: b.carried, d: Math.max(Math.abs(b.cx - pt.x), Math.abs(b.cy - pt.y)), target: s.target, tools: s.tools });
          }
        }
      });
      await L.shot(p, 'drag-across-pages-1440');
      await p.mouse.up();
      await p.keyboard.up('Alt');
      const afterIn = await L.field(p, in1);
      const ib2 = await L.box(p, in1);
      check('EDIT-02 between the pages the field is carried over the document, under the pointer, never clipped', cross.every((c) => c.carried && c.d <= 2), cross);
      check('EDIT-02 the page under the pointer is highlighted as the drop target (page 2 at the end)', cross[1].target === '2' && !cross[1].tools, cross);
      check('EDIT-02 one movement moves the field to the next page: page 2, at the pointer', afterIn.page === 2 && beforeIn.page === 1 && ib2.page === 2 && near(ib2.cx, drop2.x, 1) && near(ib2.cy, drop2.y, 1) && near(afterIn.x + afterIn.w / 2, 0.5, 0.003) && near(afterIn.y + afterIn.h / 2, 0.12, 0.003) && afterIn.w === beforeIn.w, { afterIn, ib2, drop2 });
      check('EDIT-02 the pages were not drawn again', await domKept(p));
      // Auto-scroll: holding the field near the bottom edge scrolls the document, and it lands on a later page.
      await p.keyboard.press('Control+z');
      await L.scrollTo(p, 1, 0.9, 0.5);
      const ab = await L.box(p, in1);
      const view = await p.evaluate(() => {
        const r = document.querySelector('.fe-scroll').getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
      const top0 = (await editorState(p)).scrollTop;
      await drag(p, { x: ab.cx, y: ab.cy }, { x: ab.cx - 120, y: view.bottom - 10 }, { steps: 10, hold: true });
      await p.waitForTimeout(900);
      const top1 = (await editorState(p)).scrollTop;
      const heldAuto = await L.box(p, in1);
      await p.mouse.up();
      const autoF = await L.field(p, in1);
      check('EDIT-02 the document scrolls by itself while a field is held near its bottom edge', top1 > top0 + 200 && near(heldAuto.cy, view.bottom - 10, 6), { top0, top1, heldAuto });
      check('EDIT-02 … and the field lands on the page it was carried to', autoF.page >= 2, autoF);
      await p.keyboard.press('Control+z');
      check('EDIT-05 undo brings the field back to page 1, exactly', same(await L.fields(p), start));

      /* ----- EDIT-04: snapping ----- */
      await L.scrollTo(p, 3, 0.35, 0.5);
      const nameF = await L.field(p, id['tf-name']);
      const pg = await L.pageBox(p, 3);
      const tb = await L.box(p, title);
      // Put the title field under the name field with its left edge 4px off the name field's left edge.
      const goal = { x: pg.x + nameF.x * pg.w + 4 + tb.w / 2, y: pg.y + pg.h * 0.56 };
      let snapMid = null;
      await drag(p, { x: tb.cx, y: tb.cy }, goal, { steps: 14, hold: true });
      snapMid = await editorState(p);
      const snapHeld = await L.box(p, title);
      await p.mouse.up();
      const snapped = await L.field(p, title);
      check('EDIT-04 a field let go 4px from a neighbour’s edge snaps to it exactly, with a guide line shown', snapped.x === nameF.x && near(snapHeld.x, pg.x + nameF.x * pg.w, 1) && snapMid.guides >= 1, { x: snapped.x, want: nameF.x, guides: snapMid.guides });
      check('EDIT-04 the guide lines go when the field is put down', (await editorState(p)).guides === 0);
      await p.keyboard.press('Control+z');
      await p.keyboard.down('Alt');
      await drag(p, { x: tb.cx, y: tb.cy }, goal, { steps: 14, hold: true });
      const altMid = await editorState(p);
      await p.mouse.up();
      await p.keyboard.up('Alt');
      const free = await L.field(p, title);
      check('EDIT-04 holding Alt turns snapping off: the field stays 4px away and no guide is shown', near((free.x - nameF.x) * pg.w, 4, 0.6) && free.x !== nameF.x && altMid.guides === 0, { dx: (free.x - nameF.x) * pg.w, guides: altMid.guides });
      // Centre to centre, and edge to edge when resizing.
      await p.keyboard.press('Control+z');
      const sigF = await L.field(p, id['tf-sig']);
      const goalC = { x: pg.x + (sigF.x + sigF.w / 2) * pg.w + 3, y: pg.y + pg.h * 0.6 };
      await drag(p, { x: tb.cx, y: tb.cy }, goalC, { steps: 12 });
      const centred = await L.field(p, title);
      check('EDIT-04 centres snap too: the field lines up with the centre of the signature field', near(centred.x + centred.w / 2, sigF.x + sigF.w / 2, 1e-9), { c: centred.x + centred.w / 2, want: sigF.x + sigF.w / 2 });
      await p.keyboard.press('Control+z');
      // A line of text: the bottom edge sits on the baseline of the words beside the field.
      const base = await p.evaluate(async () => {
        const NS = window.CVPortal;
        const blob = await NS.ops.files.get('tpl-doc-test');
        const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        const page = await doc.getPage(3);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const it = tc.items.find((t) => /^ACCEPTED/.test(t.str));
        return { y: 1 - it.transform[5] / vp.height, x1: (it.transform[4] + it.width) / vp.width };
      });
      const tb2 = await L.box(p, title);
      const goalB = { x: pg.x + (base.x1 + 0.03) * pg.w + tb2.w / 2, y: pg.y + base.y * pg.h - tb2.h / 2 - 2 };
      await drag(p, { x: tb2.cx, y: tb2.cy }, goalB, { steps: 12, hold: true });
      const baseMid = await editorState(p);
      await p.mouse.up();
      const onLine = await L.field(p, title);
      check('EDIT-04 a field let go 2px above a line of text sits on its baseline, with a guide line', near(onLine.y + onLine.h, base.y, 1e-9) && baseMid.guides >= 1, { bottom: onLine.y + onLine.h, base: base.y, guides: baseMid.guides });
      await p.keyboard.press('Control+z');
      check('EDIT-05 the snapping trials are all undone', same(await L.fields(p), start));

      /* ----- EDIT-04: nudging with the keyboard ----- */
      await p.mouse.click(tb.cx, tb.cy);
      const sel0 = await editorState(p);
      check('LOOK-01 a click selects the field: eight handles and its own toolbar appear, and its properties open', sel0.sel === title && sel0.handles === 8 && sel0.tools && (await p.locator('.fe-props .es-props').count()) === 1, sel0);
      const cover = await p.evaluate(() => {
        const t = document.querySelector('.fe-tools').getBoundingClientRect();
        return Array.from(document.querySelectorAll('.fe-doc .es-fld:not(.is-sel)')).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top;
        }).length;
      });
      check('LOOK-01 the selected field’s toolbar is put where it covers no other field', cover === 0, { cover });
      const n0 = await L.field(p, title);
      await p.keyboard.press('ArrowRight');
      const n1 = await L.field(p, title);
      await p.keyboard.press('Shift+ArrowDown');
      const n2 = await L.field(p, title);
      check('EDIT-04 an arrow key moves the selected field one point; Shift+arrow moves it ten', near(n1.x - n0.x, 1 / PAGE_W, 1e-9) && n1.y === n0.y && near(n2.y - n1.y, 10 / PAGE_H, 1e-9) && n2.x === n1.x, { dx: (n1.x - n0.x) * PAGE_W, dy: (n2.y - n1.y) * PAGE_H });
      const nb = await L.box(p, title);
      check('EDIT-04 the field on the page follows the nudge', near(nb.x - tb.x, pg.w / PAGE_W, 0.3) && near(nb.y - tb.y, (10 * pg.h) / PAGE_H, 0.3), { nb, tb });
      await p.keyboard.press('Control+z');
      await p.keyboard.press('Control+z');
      check('EDIT-05 each nudge is a step: two undos put it back', same(await L.fields(p), start));

      /* ----- EDIT-03: resize with the handles ----- */
      const sig = id['tf-sig'];
      const sb = await L.box(p, sig);
      await p.mouse.click(sb.cx, sb.cy);
      const hits = [];
      for (const d of ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se']) hits.push((await handlePoint(p, sig, d)).hit === d);
      check('EDIT-03 the selected field has a handle on every corner and every side', hits.every(Boolean), hits);
      const s0 = await L.field(p, sig);
      const se = await handlePoint(p, sig, 'se');
      await p.keyboard.down('Alt');
      await drag(p, se, { x: se.x + 60, y: se.y + 30 }, { steps: 8 });
      const s1 = await L.field(p, sig);
      check('EDIT-03 dragging the corner handle resizes the field: wider and taller by the distance dragged, its top-left corner fixed', near((s1.w - s0.w) * pg.w, 60, 0.6) && near((s1.h - s0.h) * pg.h, 30, 0.6) && s1.x === s0.x && s1.y === s0.y, { dw: (s1.w - s0.w) * pg.w, dh: (s1.h - s0.h) * pg.h });
      const we = await handlePoint(p, sig, 'w');
      await drag(p, we, { x: we.x + 40, y: we.y }, { steps: 6 });
      const s2 = await L.field(p, sig);
      check('EDIT-03 dragging a side handle moves only that side', near((s2.x - s1.x) * pg.w, 40, 0.6) && near(s2.x + s2.w, s1.x + s1.w, 1e-9) && s2.y === s1.y && s2.h === s1.h, { dx: (s2.x - s1.x) * pg.w });
      const nw = await handlePoint(p, sig, 'nw');
      await drag(p, nw, { x: nw.x + 900, y: nw.y + 600 }, { steps: 10 });
      await p.keyboard.up('Alt');
      const s3 = await L.field(p, sig);
      check('EDIT-03 a field cannot be made smaller than its type’s minimum (a signature: 40 by 16 points)', near(s3.w * PAGE_W, 40, 0.01) && near(s3.h * PAGE_H, 16, 0.01) && near(s3.x + s3.w, s2.x + s2.w, 1e-9) && near(s3.y + s3.h, s2.y + s2.h, 1e-9), { w: s3.w * PAGE_W, h: s3.h * PAGE_H });
      // Resizing snaps too: the right edge of the name field to the right edge of the signature line's neighbour.
      for (let i = 0; i < 3; i++) await p.keyboard.press('Control+z');
      check('EDIT-05 three resizes, three undos: the signature field is as it was', same(await L.fields(p), start));
      const cname = await L.field(p, id['tf-cname']);
      const tb3 = await L.box(p, title);
      await p.mouse.click(tb3.cx, tb3.cy);
      const te = await handlePoint(p, title, 'e');
      const wantR = pg.x + (cname.x + cname.w) * pg.w;
      await drag(p, te, { x: te.x + (wantR - (tb3.x + tb3.w)) + 4, y: te.y }, { steps: 8, hold: true });
      const rsMid = await editorState(p);
      await p.mouse.up();
      const rs = await L.field(p, title);
      check('EDIT-04 a resized edge snaps to a neighbour’s edge (4px away), with a guide line', near(rs.x + rs.w, cname.x + cname.w, 1e-9) && rsMid.guides >= 1 && rs.x === start.find((f) => f.id === title).x, { right: rs.x + rs.w, want: cname.x + cname.w, guides: rsMid.guides });
      await p.keyboard.press('Control+z');

      /* ----- EDIT-03: add from the palette, by click and by drag ----- */
      await L.scrollTo(p, 2, 0.5, 0.5);
      const p2 = await L.pageBox(p, 2);
      await p.click('.es-palette .es-tool[data-t="text"]');
      const armed = await editorState(p);
      await p.mouse.move(p2.x + p2.w * 0.5, p2.y + p2.h * 0.5);
      const ghost = await p.evaluate(() => document.querySelectorAll('.fe-carry .es-fld.is-ghost').length);
      await p.mouse.click(p2.x + p2.w * 0.5, p2.y + p2.h * 0.5);
      const added = (await L.fields(p)).filter((f) => !start.some((s) => s.id === f.id));
      const st2 = await editorState(p);
      check('EDIT-03 click a type, then the page: a text field is added there, for the chosen signer, and selected', armed.tool === 'text' && ghost === 1 && added.length === 1 && added[0].type === 'text' && added[0].page === 2 && near(added[0].x + added[0].w / 2, 0.5, 0.002) && near(added[0].y + added[0].h / 2, 0.5, 0.002) && added[0].signerId === start[0].signerId && st2.sel === added[0].id && st2.tool === null, { armed, ghost, added });
      // Drag "Checkbox" off the palette onto the page.
      const tool = await p.evaluate(() => {
        const r = document.querySelector('.es-palette .es-tool[data-t="checkbox"]').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      const dropAt = { x: p2.x + p2.w * 0.3, y: p2.y + p2.h * 0.7 };
      let overRail = null;
      await p.keyboard.down('Alt');
      await drag(p, tool, dropAt, {
        steps: 20,
        hold: true,
        each: async (pt) => {
          if (pt.i === 3) overRail = await p.evaluate(() => ({ ghosts: document.querySelectorAll('.fe-carry .es-fld.is-ghost').length, off: !!document.querySelector('.fe-carry .es-fld.is-off'), target: !!document.querySelector('.es-page.is-target') }));
        }
      });
      const overPage = await editorState(p);
      await p.mouse.up();
      await p.keyboard.up('Alt');
      const added2 = (await L.fields(p)).filter((f) => !start.some((s) => s.id === f.id) && f.id !== added[0].id);
      check('EDIT-03 drag a type off the palette: its outline follows the pointer and the page under it lights up', overRail && overRail.ghosts === 1 && overRail.off && !overRail.target && overPage.target === '2', { overRail, target: overPage.target });
      check('EDIT-03 … and it is added where it is dropped (a checkbox on page 2), without also arming the tool', added2.length === 1 && added2[0].type === 'checkbox' && added2[0].page === 2 && near(added2[0].x + added2[0].w / 2, 0.3, 0.002) && near(added2[0].y + added2[0].h / 2, 0.7, 0.002) && (await editorState(p)).tool === null, added2);
      // A drag let go outside the document adds nothing.
      await drag(p, tool, { x: tool.x + 40, y: tool.y + 200 }, { steps: 6 });
      check('EDIT-03 a type dropped outside the document adds nothing', (await L.fields(p)).length === start.length + 2 && (await p.evaluate(() => document.querySelectorAll('.fe-carry .es-fld').length)) === 0);
      // For the keyboard: choose a type, then "Add to page".
      await p.focus('.es-palette .es-tool[data-t="date"]');
      await p.keyboard.press('Enter');
      await p.focus('[data-action="es-place-kb"]');
      await p.keyboard.press('Enter');
      const afterKb = await L.fields(p);
      check('EDIT-03 with the keyboard alone: choose a type, press “Add to page”, and the field is on the page in view', afterKb.length === start.length + 3 && afterKb[afterKb.length - 1].type === 'date' && afterKb[afterKb.length - 1].page === 2, afterKb.slice(-1));
      for (let i = 0; i < 3; i++) await p.click('[data-action="fe-undo"]');
      check('EDIT-05 the Undo button takes the three added fields away again', same(await L.fields(p), start));
      for (let i = 0; i < 3; i++) await p.click('[data-action="fe-redo"]');
      check('EDIT-05 the Redo button brings all three back, exactly as they were', same(await L.fields(p), afterKb));
      for (let i = 0; i < 3; i++) await p.keyboard.press('Control+z');

      /* ----- EDIT-03: duplicate, remove, type, signer, required, label ----- */
      await L.scrollTo(p, 3, 0.35, 0.5);
      const nameId = id['tf-name'];
      const nbx = await L.box(p, nameId);
      await p.mouse.click(nbx.cx, nbx.cy);
      await p.click('.fe-props [data-action="fe-dup"]');
      const dup1 = await L.fields(p);
      const copy = dup1.find((f) => !start.some((s) => s.id === f.id));
      const orig = dup1.find((f) => f.id === nameId);
      check('EDIT-03 the Duplicate button adds a copy beside the field (12 points right and down) and selects it', dup1.length === 15 && copy && copy.type === 'name' && copy.page === 3 && near((copy.x - orig.x) * PAGE_W, 12, 0.01) && near((copy.y - orig.y) * PAGE_H, 12, 0.01) && copy.w === orig.w && (await editorState(p)).sel === copy.id, copy);
      check('unknown properties are copied with the field (review, confidence, audience)', copy.review === EXTRA['tf-name'].review && copy.confidence === 'low' && copy.audience === 'individual', copy);
      await p.keyboard.press('Control+d');
      const dup2 = await L.fields(p);
      check('EDIT-03 Ctrl+D duplicates the selected field', dup2.length === 16 && (await editorState(p)).sel !== copy.id);
      await p.keyboard.press('Delete');
      check('EDIT-03 Delete removes the selected field', (await L.fields(p)).length === 15 && (await editorState(p)).sel === null);
      const cb = await L.box(p, copy.id);
      await p.mouse.click(cb.cx, cb.cy);
      await p.keyboard.press('Backspace');
      check('EDIT-03 Backspace removes it too', same(await L.fields(p), start));
      await p.keyboard.press('Control+z');
      const cb2 = await L.box(p, copy.id);
      check('EDIT-05 undoing a removal brings the field back, selected and with everything on it', !!cb2 && (await editorState(p)).sel === copy.id && same(await L.field(p, copy.id), copy));
      await p.click('.fe-tools [data-action="es-fdel"]');
      check('EDIT-03 the Remove button on the field’s own toolbar removes it', same(await L.fields(p), start));
      // Type, signer, required, label: on the title field (which carries unknown properties).
      const tb4 = await L.box(p, title);
      await p.mouse.click(tb4.cx, tb4.cy);
      await p.selectOption('#es-ft', 'signature');
      const ty = await L.field(p, title);
      const tyDom = await p.evaluate((fid) => document.querySelector(`.es-fld[data-fid="${fid}"]`).className, title);
      check('EDIT-03 the type can be changed (text to signature): the field on the page changes with it', ty.type === 'signature' && /es-fld-signature/.test(tyDom) && ty.x === start.find((f) => f.id === title).x && ty.h * PAGE_H >= 16 - 0.01 && (await p.locator('.es-props-head h2').innerText()) === 'Signature field', ty);
      const other = start.find((f) => f.signerId !== ty.signerId).signerId;
      await p.selectOption('#es-fs', other);
      const sg = await L.field(p, title);
      const colors = await p.evaluate((ids) => ids.map((fid) => document.querySelector(`.es-fld[data-fid="${fid}"]`).style.getPropertyValue('--sc')), [title, id['tf-csig'], id['tf-sig']]);
      check('EDIT-03 the signer can be changed: the field takes the other signer’s color and the counts follow', sg.signerId === other && colors[0] === colors[1] && colors[0] !== colors[2] && /4 fields/.test(await p.locator('.es-signers .es-signer').last().innerText()), { colors });
      const wasReq = await p.isChecked('#es-fr');
      await p.click('#es-fr');
      const rq = await L.field(p, title);
      const rqDom = await p.evaluate((fid) => document.querySelector(`.es-fld[data-fid="${fid}"]`).className, title);
      check('EDIT-03 required or optional: the box is ticked and the field is marked required', !wasReq && rq.required === true && /is-req/.test(rqDom));
      await p.fill('#es-fl', '');
      await p.type('#es-fl', 'Authorised signatory');
      const lb = await L.field(p, title);
      const lbDom = await p.evaluate((fid) => document.querySelector(`.es-fld[data-fid="${fid}"] .es-fld-label`).textContent, title);
      check('EDIT-03 the label can be edited: it shows on the field as it is typed, and the box keeps the focus', lb.label === 'Authorised signatory' && /Authorised signatory/.test(lbDom) && (await p.evaluate(() => document.activeElement.id)) === 'es-fl');
      check('unknown properties survive a change of type, signer, required and label', lb.confidence === 'medium' && lb.audience === 'entity' && same(lb.note, EXTRA['tf-title'].note), lb);
      await p.click('.fe-scroll', { position: { x: 6, y: 6 } });
      check('a click on the empty part of the document clears the selection', (await editorState(p)).sel === null && (await p.locator('.fe-props .fe-none').count()) === 1);
      await p.keyboard.press('Control+z');
      const lbUndo = await L.field(p, title);
      check('EDIT-05 typing a label is one step: one undo clears the whole label, not a letter', lbUndo.label === 'Title' && lbUndo.required === true, lbUndo);
      for (let i = 0; i < 3; i++) await p.keyboard.press('Control+z');
      check('EDIT-05 required, signer and type are each undone in turn', same(await L.fields(p), start));

      /* ----- EDIT-05 and the unknown properties: a long sequence, undone and redone ----- */
      const snaps = [start];
      const step = async () => snaps.push(await L.fields(p));
      // 1. move the name field (it carries review, confidence and audience) within its page
      const mb = await L.box(p, nameId);
      await drag(p, { x: mb.cx, y: mb.cy }, { x: mb.cx + 140, y: mb.cy + 180 }, { steps: 10 });
      await step();
      const moved = await L.field(p, nameId);
      check('a move by the sponsor clears the review mark and keeps the other unknown properties', !moved.review && moved.confidence === 'low' && moved.audience === 'individual' && Object.keys(moved).length === Object.keys(start.find((f) => f.id === nameId)).length, moved);
      // 2. carry the title field from page 3 back to page 2 (the document scrolls under it)
      await L.scrollTo(p, 3, 0.02, 0.5);
      const tb5 = await L.box(p, title);
      const pTwo = await L.pageBox(p, 2);
      await drag(p, { x: tb5.cx, y: tb5.cy }, { x: pTwo.x + pTwo.w * 0.6, y: pTwo.y + pTwo.h * 0.9 }, { steps: 12 });
      await step();
      const carried = await L.field(p, title);
      check('EDIT-02 a field goes from page 3 to page 2 as well, keeping its size and everything on it', carried.page === 2 && carried.w === start.find((f) => f.id === title).w && carried.confidence === 'medium' && same(carried.note, EXTRA['tf-title'].note), carried);
      // 3. resize the investor's signature
      await L.scrollTo(p, 3, 0.35, 0.5);
      const sb2 = await L.box(p, sig);
      await p.mouse.click(sb2.cx, sb2.cy);
      const se2 = await handlePoint(p, sig, 'se');
      await drag(p, se2, { x: se2.x + 33, y: se2.y + 11 }, { steps: 5 });
      await step();
      // 4. duplicate it, 5. nudge the copy, 6. remove the firm's date field
      await p.keyboard.press('Control+d');
      await step();
      await p.keyboard.press('ArrowDown');
      await step();
      const cd = await L.box(p, id['tf-cdate']);
      await p.mouse.click(cd.cx, cd.cy);
      await p.keyboard.press('Delete');
      await step();
      check('six different steps were made', snaps.length === 7 && snaps.every((s, i) => !i || !same(s, snaps[i - 1])), snaps.map((s) => s.length));
      let back = true;
      const bad = [];
      for (let i = snaps.length - 2; i >= 0; i--) {
        await p.keyboard.press('Control+z');
        const now = await L.fields(p);
        if (!same(now, snaps[i])) bad.push({ i, now: now.filter((f, k) => !same(f, snaps[i][k])).slice(0, 2), want: snaps[i].filter((f, k) => !same(f, now[k])).slice(0, 2) });
        back = back && same(now, snaps[i]);
      }
      check('EDIT-05 undo, step by step, restores every earlier state exactly (positions, pages, sizes, every property)', back, bad);
      const restored = await L.field(p, nameId);
      check('undo restores the review mark that the move had cleared', restored.review === EXTRA['tf-name'].review && restored.confidence === 'low' && restored.audience === 'individual', restored);
      let fwd = true;
      for (let i = 1; i < snaps.length; i++) {
        await p.keyboard.press('Shift+Control+z');
        fwd = fwd && same(await L.fields(p), snaps[i]);
      }
      check('EDIT-05 redo (Shift+Ctrl+Z), step by step, restores every later state exactly, the cross-page move included', fwd && !(await editorState(p)).redo);
      const redone = await L.field(p, nameId);
      check('redo clears the review mark again and keeps the rest', !redone.review && redone.confidence === 'low' && redone.audience === 'individual', redone);
      const domAfter = await p.evaluate(() => {
        const NS = window.CVPortal;
        const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param);
        return env.fields.every((f) => {
          const el = document.querySelector(`.fe-doc .es-page[data-page="${f.page}"] > .es-fld[data-fid="${f.id}"]`);
          return el && Math.abs(parseFloat(el.style.left) - f.x * 100) < 0.01 && Math.abs(parseFloat(el.style.top) - f.y * 100) < 0.01;
        }) && document.querySelectorAll('.fe-doc .es-fld').length === env.fields.length;
      });
      check('after all that every field on the pages is where the model says it is', domAfter);
      // A new step after an undo drops the redo list.
      await p.keyboard.press('Control+z');
      const tb6 = await L.box(p, id['tf-date']);
      await p.mouse.click(tb6.cx, tb6.cy);
      await p.keyboard.press('ArrowLeft');
      check('EDIT-05 a new step after an undo clears what could be redone', !(await editorState(p)).redo && (await editorState(p)).undo);
      // Bounded history: 105 steps, 100 undos.
      for (let i = 0; i < 105; i++) await p.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowUp');
      let undos = 0;
      while ((await editorState(p)).undo && undos < 200) {
        await p.keyboard.press('Control+z');
        undos++;
      }
      check('EDIT-05 the history is bounded: 100 steps are kept', undos === 100, { undos });
      const final = await L.fields(p);

      /* ----- EDIT-06: zoom and the page navigator ----- */
      await L.scrollTo(p, 3, 0.3, 0.4);
      const zb = await L.box(p, sig);
      const zp = await L.pageBox(p, 3);
      const rel0 = { x: (zb.x - zp.x) / zp.w, y: (zb.y - zp.y) / zp.h, w: zb.w / zp.w };
      const widths = { fit: zp.w };
      const rel = {};
      for (const z of ['1', '1.25', '1.5', '2', 'fit']) {
        await p.selectOption('#fe-zoom', z);
        await p.waitForTimeout(80);
        const pb = await L.pageBox(p, 3);
        const fb = await L.box(p, sig);
        widths[z] = pb.w;
        rel[z] = { x: (fb.x - pb.x) / pb.w, y: (fb.y - pb.y) / pb.h, w: fb.w / pb.w };
      }
      check('EDIT-06 zoom sets the page’s width: 816px at 100%, 1020 at 125%, 1224 at 150%, 1632 at 200%, and Fit fits the document area', near(widths['1'], 816, 1) && near(widths['1.25'], 1020, 1) && near(widths['1.5'], 1224, 1) && near(widths['2'], 1632, 1) && near(widths.fit, zp.w, 1) && zp.w < 816, widths);
      check('EDIT-06 at every zoom the field stays on the same spot of its page', Object.keys(rel).every((z) => near(rel[z].x, rel0.x, 0.0015) && near(rel[z].y, rel0.y, 0.0015) && near(rel[z].w, rel0.w, 0.0015)), rel);
      check('EDIT-06 zooming changes nothing in the model', same(await L.fields(p), final));
      await p.click('[data-action="fe-zoom-in"]');
      const zin = await editorState(p);
      await p.click('[data-action="fe-zoom-out"]');
      check('EDIT-06 the plus and minus buttons step through the zoom levels', zin.zoom === '1' && (await editorState(p)).zoom === 'fit', zin.zoom);
      // A drag at 150% is as exact as at Fit.
      await p.selectOption('#fe-zoom', '1.5');
      await L.scrollTo(p, 3, 0.7, 0.5);
      const zd = await L.box(p, id['tf-cname']);
      let zworst = 0;
      await p.keyboard.down('Alt');
      await drag(p, { x: zd.cx, y: zd.cy }, { x: zd.cx + 90, y: zd.cy - 70 }, {
        steps: 12,
        each: async (pt) => {
          const b = await L.box(p, id['tf-cname']);
          zworst = Math.max(zworst, Math.abs(b.cx - pt.x), Math.abs(b.cy - pt.y));
        }
      });
      await p.keyboard.up('Alt');
      const zdAfter = await L.box(p, id['tf-cname']);
      check('EDIT-06 zoomed to 150% a dragged field still stays under the pointer and lands where released', zworst <= 2 && near(zdAfter.cx, zd.cx + 90, 1) && near(zdAfter.cy, zd.cy - 70, 1), { zworst, zdAfter });
      await p.keyboard.press('Control+z');
      // Pages far from view give up their image; they get it back when they come near.
      await p.selectOption('#fe-zoom', '2');
      await p.evaluate(() => (document.querySelector('.fe-scroll').scrollTop = 0));
      await p.waitForTimeout(250);
      const lazy0 = await p.evaluate(() => Array.from(document.querySelectorAll('.fe-doc .es-page > img')).map((i) => !!i.getAttribute('src')));
      await p.fill('#fe-page', '3');
      await p.keyboard.press('Enter');
      await p.waitForTimeout(250);
      const jump = await p.evaluate(() => {
        const s = document.querySelector('.fe-scroll').getBoundingClientRect();
        const r = document.querySelector('.fe-doc .es-page[data-page="3"]').getBoundingClientRect();
        return { top: r.top - s.top, value: document.querySelector('#fe-page').value, imgs: Array.from(document.querySelectorAll('.fe-doc .es-page > img')).map((i) => !!i.getAttribute('src')) };
      });
      check('EDIT-06 only pages near the part in view carry their image (page 3 does not while page 1 is shown at 200%, and does once it is reached)', lazy0[0] && !lazy0[2] && jump.imgs[2] && !jump.imgs[0], { lazy0, after: jump.imgs });
      check('EDIT-06 typing a page number jumps to that page', jump.value === '3' && jump.top >= 0 && jump.top < 40, jump);
      await p.selectOption('#fe-zoom', 'fit');
      await p.click('[data-action="fe-prev"]');
      const prev = await editorState(p);
      await p.click('[data-action="fe-prev"]');
      const first = await p.evaluate(() => ({ value: document.querySelector('#fe-page').value, prevOff: document.querySelector('[data-action="fe-prev"]').disabled, of: document.querySelector('.fe-pager-of').textContent.replace(/\s+/g, ' ').trim() }));
      await p.click('[data-action="fe-next"]');
      const next = await editorState(p);
      check('EDIT-06 the navigator shows “Page N of 3”, and previous and next move a page at a time', prev.page === '2' && first.value === '1' && first.prevOff && /of 3/.test(first.of) && next.page === '2', { prev: prev.page, first, next: next.page });
      await p.evaluate(() => (document.querySelector('.fe-scroll').scrollTop = document.querySelector('.fe-scroll').scrollHeight));
      await p.waitForTimeout(120);
      check('EDIT-06 the page number follows the document as it scrolls', (await editorState(p)).page === '3');

      /* ----- The editor survives the rest of the page being drawn again; then save, and the investor signs it ----- */
      const b3 = await L.box(p, id['tf-csig']);
      await p.mouse.click(b3.cx, b3.cy);
      await p.keyboard.press('ArrowUp');
      const was = await editorState(p);
      await p.evaluate(() => window.CVPortal.app.render());
      await p.waitForSelector('.es-editor.fe .fe-doc .es-page img[src]');
      const again = await editorState(p);
      check('a fresh render of the whole page keeps the scroll position, the page number, the selection and the undo history', again.page === '3' && again.scrollTop > 100 && near(again.scrollTop, was.scrollTop, 1) && again.undo && again.sel === was.sel && again.handles === 8, { was, again });
      await p.keyboard.press('Control+z');
      check('… and undo still works after it', !(await editorState(p)).undo && (await editorState(p)).redo);
      const saved = await L.fields(p);
      await p.click('[data-action="es-agreement-save"]');
      await p.waitForSelector('#agreement');
      const tpl = await p.evaluate(() => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const o = ws.offerings.find((x) => x.status === 'Raising');
        const t = NS.esign.subscriptionTemplate(ws, o.id);
        return { ready: NS.esign.templateReady(ws, o.id), fields: t.fields, drafts: ws.envelopes.filter((e) => e.agreementFor === o.id).length, offeringId: o.id };
      });
      const strip = (f) => {
        const c = Object.assign({}, f);
        delete c.id;
        delete c.signerId;
        delete c.signerRole;
        return c;
      };
      check('the agreement saves from the editor: its template has the same fields, every property included, and is ready', tpl.ready && tpl.drafts === 0 && tpl.fields.length === saved.length && tpl.fields.every((f, i) => same(strip(f), strip(saved[i]))), { n: tpl.fields.length, ready: tpl.ready });
      // An investor invited now reaches the agreement in onboarding, with the fields where the editor left them.
      const inv = await L.createInvitation(p, { name: 'Morgan Blake', email: 'morgan.blake@example.org', offeringId: tpl.offeringId, cents: 7500000 });
      await p.goto(`${L.BASE}?tenant=${inv.tenant}#invite-${inv.token}`);
      const walk = await L.walkToAgreement(p, { name: 'Morgan Blake' });
      await p.waitForTimeout(400);
      const signing = await p.evaluate(() => {
        const NS = window.CVPortal;
        const bar = document.querySelector('.sf-bar');
        const env = NS.esignKit.env(bar.getAttribute('data-id'));
        const s = NS.esignKit.signer(env, bar.getAttribute('data-sid'));
        return { mine: NS.esignKit.fieldsOf(env, s).map((f) => ({ type: f.type, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h, label: f.label })), boxes: document.querySelectorAll('.es-doc-sign .es-f-mine').length, count: bar.querySelector('.sf-count strong').textContent };
      });
      const wantMine = saved.filter((f) => f.signerId === saved[0].signerId);
      const key = (f) => [f.type, f.page, f.x, f.y, f.w, f.h].join('|');
      check('the saved agreement still signs: the invited investor reaches it in onboarding with every one of their fields where the editor left it', walk.reached && signing.mine.length === wantMine.length && signing.boxes === wantMine.length && wantMine.every((f) => signing.mine.some((m) => key(m) === key(f))) && / left$/.test(signing.count), { reached: walk.reached, mine: signing.mine.length, want: wantMine.length, count: signing.count });
      check('desktop: no page or console errors, and nothing asked of another site', !A.errors.length && !A.net.external.length, { errors: A.errors, external: A.net.external });
    } catch (e) {
      check('desktop pass ran to the end', false, String(e && e.stack ? e.stack : e));
    }
    await A.context.close();
  }

  /* ===================== 2. Touch (a phone, 390px) ===================== */
  {
    const A = await L.open(browser, { context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } });
    const p = A.page;
    try {
      await L.openEditor(p, A.context, { extra: EXTRA });
      const id = await L.idsByTemplate(p);
      const start = await L.fields(p);
      const cdp = await A.context.newCDPSession(p);
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((t) => ({ x: t.x, y: t.y, id: 1, radiusX: 8, radiusY: 8, force: 1 })) });
      const touchDrag = async (from, to, opts) => {
        opts = opts || {};
        const steps = opts.steps || 14;
        await touch('touchStart', [from]);
        for (let i = 1; i <= steps; i++) {
          const pt = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, i };
          await touch('touchMove', [pt]);
          // The browser hands touch moves to the page once a frame: wait for it before looking.
          await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          if (opts.each) await opts.each(pt);
        }
        if (opts.before) await opts.before();
        await touch('touchEnd', []);
        await p.waitForTimeout(60);
      };
      const lay = await p.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        return { vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, rail: r('.fe-rail'), stage: r('.fe-stage'), props: getComputedStyle(document.querySelector('.fe-props')).display, page: r('.fe-doc .es-page').width };
      });
      check('EDIT-06 on a phone the editor fits the width (no sideways scroll); the document is under the fields to add', lay.sw <= lay.vw + 1 && lay.stage.top >= lay.rail.bottom && lay.stage.width > 340 && lay.page > 300 && lay.props === 'none', lay);
      await p.evaluate(() => document.querySelector('.es-editor.fe').scrollIntoView({ block: 'start' }));
      await p.selectOption('#fe-zoom', '1');
      await L.scrollTo(p, 3, 0.36, 0.5);
      await p.evaluate(() => (document.querySelector('.fe-scroll').scrollLeft = 120));
      await p.waitForTimeout(100);
      const sig = id['tf-sig'];
      const b0 = await L.box(p, sig);
      const pg = await L.pageBox(p, 3);
      // Drag with a finger.
      let worst = 0;
      let mid = null;
      const to = { x: b0.cx - 30, y: b0.cy + 150 };
      await touchDrag({ x: b0.cx, y: b0.cy }, to, {
        steps: 16,
        each: async (pt) => {
          const b = await L.box(p, sig);
          if (pt.i > 1) worst = Math.max(worst, Math.abs(b.cx - pt.x), Math.abs(b.cy - pt.y));
          if (pt.i === 8) mid = { carried: b.carried, guides: await p.evaluate(() => document.querySelectorAll('.fe-guide').length) };
        }
      });
      const b1 = await L.box(p, sig);
      const f1 = await L.field(p, sig);
      // Snapping is on for a finger (there is no Alt), so the field may sit up to the snapping distance from it.
      check('EDIT-06 touch: a field dragged with a finger is carried under it (within the 6px snapping distance) and lands where it is lifted', mid && mid.carried && worst <= 6.5 && near(b1.cx, to.x, 6.5) && near(b1.cy, to.y, 6.5) && f1.page === 3 && f1.y > start.find((f) => f.id === sig).y, { worst, b1, to });
      // Selected: a toolbar that does not need a hover, and handles with 44px touch areas.
      const sel = await p.evaluate((fid) => {
        const el = document.querySelector(`.es-fld[data-fid="${fid}"]`);
        const hs = Array.from(el.querySelectorAll('.es-handle')).filter((h) => getComputedStyle(h).display !== 'none').map((h) => {
          const r = h.getBoundingClientRect();
          return { d: h.getAttribute('data-h'), w: r.width, h: r.height };
        });
        const t = document.querySelector('.fe-tools');
        const tb = t ? Array.from(t.querySelectorAll('button')).map((b) => {
          const r = b.getBoundingClientRect();
          const a = getComputedStyle(b, '::after');
          return { a: b.getAttribute('data-action'), shown: getComputedStyle(b).display !== 'none', w: r.width, hit: r.height - parseFloat(a.top) - parseFloat(a.bottom) };
        }) : [];
        return { sel: el.classList.contains('is-sel'), hs, tb, coarse: window.matchMedia('(pointer: coarse)').matches };
      }, sig);
      check('EDIT-06 touch: the selected field has its own toolbar (properties, duplicate, remove), each with a 44px touch area', sel.sel && sel.tb.length === 3 && sel.tb.every((b) => b.shown && b.hit >= 44), sel.tb);
      const corners = sel.hs.filter((x) => x.d.length === 2);
      check('EDIT-06 touch: every resize handle has a touch area of at least 44px', sel.coarse && corners.length === 4 && sel.hs.every((x) => (x.d.length === 2 ? x.w >= 44 && x.h >= 44 : Math.min(x.w, x.h) >= 44 || Math.max(x.w, x.h) >= 44)), sel.hs);
      // Resize with a finger, starting 20px outside the corner.
      const f2a = await L.field(p, sig);
      await p.evaluate(() => (document.querySelector('.fe-scroll').scrollLeft += 130));
      await p.waitForTimeout(100);
      const b2 = await L.box(p, sig);
      const from = { x: b2.x + b2.w + 20, y: b2.y + b2.h + 20 };
      const hitDir = await p.evaluate((pt) => {
        const el = document.elementFromPoint(pt.x, pt.y);
        return el && el.classList.contains('es-handle') ? el.getAttribute('data-h') : String(el && el.className);
      }, from);
      await touchDrag(from, { x: from.x + 40, y: from.y + 30 }, { steps: 8 });
      const f2 = await L.field(p, sig);
      check('EDIT-06 touch: a finger 20px outside the corner takes the corner handle and resizes the field', hitDir === 'se' && (f2.w - f2a.w) * pg.w > 30 && (f2.h - f2a.h) * pg.h > 20 && f2.x === f2a.x && f2.y === f2a.y, { hitDir, dw: (f2.w - f2a.w) * pg.w, dh: (f2.h - f2a.h) * pg.h });
      // Duplicate and remove from the field's toolbar; properties as a sheet.
      await p.tap('.fe-tools [data-action="fe-dup"]');
      const nDup = (await L.fields(p)).length;
      await p.tap('.fe-tools [data-action="es-fdel"]');
      check('EDIT-06 touch: duplicate and remove work from the field’s toolbar', nDup === start.length + 1 && (await L.fields(p)).length === start.length);
      // The field is brought to the middle of the screen first: the list of signers above the document is one row taller
      // on a phone (the investor, the co-investor, the firm), so the page sits lower than it did with two.
      await p.evaluate((fid) => document.querySelector(`.es-fld[data-fid="${fid}"]`).scrollIntoView({ block: 'center', inline: 'center' }), sig);
      await p.waitForTimeout(150);
      const b3 = await L.box(p, sig);
      await p.touchscreen.tap(b3.cx, b3.cy);
      await p.tap('.fe-tools [data-action="fe-props"]');
      const sheet = await p.evaluate(() => {
        const el = document.querySelector('.fe-props');
        const r = el.getBoundingClientRect();
        const ed = document.querySelector('.es-editor.fe').getBoundingClientRect();
        return { display: getComputedStyle(el).display, w: r.width, inEditor: r.bottom <= ed.bottom + 1 && r.left >= ed.left - 1, type: !!el.querySelector('#es-ft'), close: !!el.querySelector('[data-action="fe-props-close"]') };
      });
      await L.shot(p, 'touch-390-properties');
      // (The signature now lies over other fields, so whichever is on top there is the one selected.)
      const picked = await p.evaluate(() => window.CVPortal.state.ui.es.sel);
      await p.selectOption('#es-ft', 'initials');
      const f3 = await L.field(p, picked);
      await p.tap('[data-action="fe-props-close"]');
      const shut = await p.evaluate(() => getComputedStyle(document.querySelector('.fe-props')).display);
      check('EDIT-06 touch: the properties open as a sheet from the toolbar, change the field, and close again', sheet.display === 'block' && sheet.type && sheet.close && sheet.inEditor && f3.type === 'initials' && shut === 'none', { sheet, type: f3.type, shut });
      // Add with a tap, and with a drag from the palette.
      await p.selectOption('#fe-zoom', 'fit');
      await L.scrollTo(p, 2, 0.4, 0.5);
      const n0 = (await L.fields(p)).length;
      await p.tap('.es-palette .es-tool[data-t="text"]');
      const p2 = await L.pageBox(p, 2);
      await p.touchscreen.tap(p2.x + p2.w * 0.5, p2.y + p2.h * 0.45);
      const n1 = await L.fields(p);
      check('EDIT-06 touch: tap a type, tap the page: the field is added there', n1.length === n0 + 1 && n1[n1.length - 1].type === 'text' && n1[n1.length - 1].page === 2 && near(n1[n1.length - 1].x + n1[n1.length - 1].w / 2, 0.5, 0.01));
      const tool = await p.evaluate(() => {
        const r = document.querySelector('.es-palette .es-tool[data-t="checkbox"]').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      const p2b = await L.pageBox(p, 2);
      const dropAt = { x: p2b.x + p2b.w * 0.4, y: p2b.y + p2b.h * 0.6 };
      await touchDrag(tool, dropAt, { steps: 14 });
      const n2 = await L.fields(p);
      check('EDIT-06 touch: a type dragged from the palette with a finger is added where it is dropped', n2.length === n0 + 2 && n2[n2.length - 1].type === 'checkbox' && n2[n2.length - 1].page === 2 && near(n2[n2.length - 1].x + n2[n2.length - 1].w / 2, 0.4, 0.02) && near(n2[n2.length - 1].y + n2[n2.length - 1].h / 2, 0.6, 0.02), n2.slice(-1));
      // A finger carries a field to the next page too.
      await L.scrollTo(p, 1, 0.97, 0.4);
      const ib = await L.box(p, id['tf-in1']);
      const pgTwo = await L.pageBox(p, 2);
      await touchDrag({ x: ib.cx, y: ib.cy }, { x: pgTwo.x + pgTwo.w * 0.5, y: pgTwo.y + pgTwo.h * 0.2 }, { steps: 14 });
      const fin = await L.field(p, id['tf-in1']);
      check('EDIT-02 touch: a finger carries a field from page 1 to page 2 in one movement', fin.page === 2 && near(fin.y + fin.h / 2, 0.2, 0.03), fin);
      // Undo and redo from the toolbar.
      let n = 0;
      while (!(await p.evaluate(() => document.querySelector('[data-action="fe-undo"]').disabled)) && n < 20) {
        await p.tap('[data-action="fe-undo"]');
        n++;
      }
      check('EDIT-05 touch: the Undo button walks every step back to the start', same(await L.fields(p), start) && n === 8, { n });
      // A finger that lands just beside a small field selects it; a tap on empty paper clears the selection.
      await L.scrollTo(p, 3, 0.75, 0.5);
      const cs = await L.box(p, id['tf-cdate']);
      await p.touchscreen.tap(cs.x + cs.w + 9, cs.cy);
      const nearSel = await p.evaluate(() => window.CVPortal.state.ui.es.sel);
      const pg3 = await L.pageBox(p, 3);
      await p.touchscreen.tap(pg3.x + pg3.w * 0.85, cs.cy + 60);
      const farSel = await p.evaluate(() => window.CVPortal.state.ui.es.sel);
      check('EDIT-06 touch: a tap 9px beside a small field selects it; a tap on empty paper clears the selection', nearSel === id['tf-cdate'] && farSel === null && same(await L.fields(p), start), { nearSel, farSel });
      check('touch: no page or console errors', !A.errors.length, A.errors);
    } catch (e) {
      check('touch pass ran to the end', false, String(e && e.stack ? e.stack : e));
    }
    await A.context.close();
  }

  /* ===================== 3. An agreement stored before this change ===================== */
  {
    const A = await L.open(browser, { context: { viewport: { width: 1024, height: 768 } } });
    const p = A.page;
    try {
      await L.openEditor(p, A.context, { legacy: true });
      const list = await L.fields(p);
      const lay = await p.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        return { rail: r('.fe-rail'), stage: r('.fe-stage'), props: r('.fe-props'), vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, n: document.querySelectorAll('.fe-doc .es-fld').length };
      });
      check('an agreement stored before this change (two fields, the old properties only) loads in the editor', list.length === 2 && lay.n === 2 && list.every((f) => f.type === 'signature' && f.page === 3));
      check('LOOK-01 at 1024px the three parts are still there: fields to add across the top, the document, and the selected field beside it', lay.sw <= lay.vw + 1 && lay.rail.bottom <= lay.stage.top && lay.stage.right <= lay.props.left && lay.props.width >= 240 && lay.stage.width > 380, lay);
      await L.scrollTo(p, 3, 0.3, 0.5);
      // A control another part of the portal draws on a field (a status mark with its own button) keeps its click.
      const mark = await p.evaluate((fid) => {
        const NS = window.CVPortal;
        window.__marks = 0;
        NS.actions['x-mark'] = () => window.__marks++;
        const el = document.querySelector(`.es-fld[data-fid="${fid}"]`);
        el.insertAdjacentHTML('beforeend', '<button type="button" data-action="x-mark" style="position:absolute;left:0;top:-22px;width:40px;height:18px">ok</button>');
        const r = el.querySelector('[data-action="x-mark"]').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, list[0].id);
      await p.mouse.click(mark.x, mark.y);
      const marked = await p.evaluate(() => ({ n: window.__marks, sel: window.CVPortal.state.ui.es.sel, carried: document.querySelectorAll('.fe-carry .es-fld').length }));
      check('a button drawn on a field by another part of the portal takes its click (the editor does not treat it as a drag)', marked.n === 1 && marked.sel === null && marked.carried === 0 && same(await L.fields(p), list), marked);
      const b = await L.box(p, list[0].id);
      await drag(p, { x: b.cx, y: b.cy }, { x: b.cx + 50, y: b.cy + 40 }, { steps: 8 });
      const moved = await L.field(p, list[0].id);
      check('… and edits: the old field moves, and gains no properties it did not have', moved.x > list[0].x && moved.y > list[0].y && same(Object.keys(moved).sort(), Object.keys(list[0]).sort()), moved);
      // Automatic placement's own mark on a field it was unsure of (placement.js): an edit by the sponsor settles it.
      await p.evaluate((fid) => {
        const NS = window.CVPortal;
        const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param);
        Object.assign(env.fields.find((f) => f.id === fid), { auto: true, confidence: 'low', review: true, reviewReason: 'No signature line could be read' });
        NS.app.render();
      }, list[1].id);
      await p.waitForSelector('.es-editor.fe .fe-doc .es-page img[src]');
      await L.scrollTo(p, 3, 0.63, 0.5);
      const shown = await p.evaluate((fid) => ({ flag: document.querySelector(`.es-fld[data-fid="${fid}"]`).classList.contains('is-flag'), tag: !!document.querySelector(`.es-fld[data-fid="${fid}"] .es-fld-flag`), list: document.querySelectorAll('.fe-sec-review .es-review button').length, needs: window.CVPortal.placement.needsReview(window.CVPortal.state.ws.envelopes.find((e) => e.id === window.CVPortal.state.param)) }), list[1].id);
      check('a field placement was unsure of is marked on the page and listed in the left column', shown.flag && shown.tag && shown.list === 1 && shown.needs === true, shown);
      const b2 = await L.box(p, list[1].id);
      await drag(p, { x: b2.cx, y: b2.cy }, { x: b2.cx + 30, y: b2.cy - 30 }, { steps: 6 });
      const conf = await L.field(p, list[1].id);
      const cleared = await p.evaluate((fid) => ({ flag: document.querySelector(`.es-fld[data-fid="${fid}"]`).classList.contains('is-flag'), list: document.querySelectorAll('.fe-sec-review .es-review button').length }), list[1].id);
      await p.keyboard.press('Control+z');
      const unconf = await L.field(p, list[1].id);
      check('a field placement was unsure of is confirmed by being moved (and unconfirmed again by undo), keeping its confidence and reason', conf.review === false && conf.confidence === 'low' && conf.reviewReason === 'No signature line could be read' && !cleared.flag && cleared.list === 0 && unconf.review === true && unconf.auto === true, { conf, cleared, unconf });
      check('1024px: no page or console errors', !A.errors.length, A.errors);
    } catch (e) {
      check('legacy pass ran to the end', false, String(e && e.stack ? e.stack : e));
    }
    await A.context.close();
  }

  await browser.close();
  done();
})();
