/*
 * Field editor: where the sponsor places the fields signers fill in on a document's pages (sponsor console, drafts only).
 *
 * esign.js owns the envelope, its fields, and the HTML of one field and of the selected field's properties. This file owns
 * the tool around them: the three-part layout (fields to add, the document, the selected field), the toolbar (undo, redo,
 * zoom, page) and every interaction: dragging within and across pages, adding from the palette, resizing, snapping,
 * nudging, duplicating, removing, undo and redo.
 *
 * A field is a plain object: { id, signerId, type, page (1 is the first page), x, y, w, h (fractions of its page), required,
 * label, value } plus whatever else has been put on it (a confidence, a review mark, who the field is for …). The editor
 * only ever changes the properties it is editing and copies a field whole when it duplicates one or steps through the
 * history, so anything it does not know about is carried along untouched.
 *
 * While a field is dragged its element is lifted into a layer over the whole document and moved with a transform; the
 * model is written once, on release, and the page is never rendered again in between.
 */
(function (NS) {
  'use strict';
  const h = NS.ui.h;
  const PT = 96 / 72; // screen pixels per PDF point at 100%
  const ZOOMS = [1, 1.25, 1.5, 2];
  const HISTORY = 100; // steps kept for undo
  const SNAP = 6; // how close (in screen pixels) an edge has to be to snap
  const EDGE = 64; // the band at the top and bottom of the document that scrolls it during a drag
  const OFFSET = 12; // a duplicate sits this many points right of and below the original
  const HANDLES = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'];
  // The smallest each type may be made, in PDF points.
  const MIN = { signature: { w: 40, h: 16 }, initials: { w: 20, h: 14 }, date: { w: 40, h: 10 }, name: { w: 40, h: 10 }, text: { w: 20, h: 10 }, checkbox: { w: 8, h: 8 } };
  const MOD = /Mac|iP(hone|ad|od)/.test((typeof navigator !== 'undefined' && navigator.platform) || '') ? '⌘' : 'Ctrl+';

  const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
  const ICON = {
    undo: '<path d="M8 6 4 10l4 4"/><path d="M4 10h10a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="m16 6 4 4-4 4"/><path d="M20 10H10a5 5 0 0 0 0 10h3"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    prev: '<path d="m6 15 6-6 6 6"/>',
    next: '<path d="m6 9 6 6 6-6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
    sliders: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>'
  };
  // One small mark per field type, drawn like the rest of the portal's icons.
  const GLYPH = {
    signature: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    initials: '<path d="M3.5 18 7.5 6l4 12M5 14h5"/><path d="M14.5 6v12h3.25a3 3 0 0 0 0-6H14.5h2.75a3 3 0 0 0 0-6z"/>',
    date: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    name: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5"/>',
    text: '<path d="M5 6h14M12 6v13M9 19h6"/>',
    checkbox: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12.5 3 3 5-6"/>'
  };
  const glyph = (type) => svg(GLYPH[type] || GLYPH.text);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pc = (v) => (v * 100).toFixed(4) + '%';
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;

  /* ---------- State ---------- */
  const store = {}; // per envelope: zoom, history and where the document was scrolled to (kept while the page is open)
  let cur = null; // the editor on screen
  let drag = null; // the field, handle or new field being dragged
  let press = null; // a press on a field type that may become a drag onto the page
  let ghost = null; // the outline of the field about to be placed, under the pointer
  let swallow = false; // the click that follows a drag is not a click

  function stateOf(env) {
    return store[env.id] || (store[env.id] = { zoom: 'fit', scale: 1, undo: [], redo: [], last: null, merge: '', top: 0, left: 0, page: 1, sheet: false, h: 640 });
  }
  const live = () => !!(cur && cur.root.isConnected && cur.ctx.pages);
  const fieldById = (id) => cur.env.fields.find((f) => f.id === id) || null;
  const selField = () => (cur.ctx.ui.sel ? fieldById(cur.ctx.ui.sel) : null);
  const fieldEl = (id) => cur.root.querySelector(`.es-fld[data-fid="${CSS.escape(id)}"]`);
  const pageEl = (n) => cur.doc.querySelector(`.es-page[data-page="${Number(n)}"]`);
  const pagePt = (n) => cur.ctx.pages[n - 1] || cur.ctx.pages[0];
  function place(el, b) {
    el.style.left = pc(b.x);
    el.style.top = pc(b.y);
    el.style.width = pc(b.w);
    el.style.height = pc(b.h);
  }

  /* ---------- Markup ---------- */
  function railHTML(ctx) {
    const env = ctx.env;
    const ui = ctx.ui;
    const st = stateOf(env);
    const on = env.signers.find((s) => s.id === ui.signer) || env.signers[0] || null;
    const count = (s) => env.fields.filter((f) => f.signerId === s.id).length;
    const signers = env.signers
      .map(
        (s) =>
          `<button type="button" class="es-signer${on === s ? ' is-on' : ''}" data-action="es-signer" data-id="${h(s.id)}" aria-pressed="${on === s}" style="--sc:${h(s.color)}"><span class="es-dot" aria-hidden="true"></span><span><strong>${env.sequential && !ctx.agreement ? `${s.order}. ` : ''}${h(s.name)}</strong><span class="cs-hint">${h(ctx.roleLabel(s))} · ${plural(count(s), 'field')}</span></span></button>`
      )
      .join('');
    const order = ctx.agreement
      ? ''
      : `<fieldset class="cs-field fe-order"><legend>Signing order</legend><div class="cs-seg">${[['true', 'In order'], ['false', 'Any order']].map(([v, l]) => `<label><input type="radio" name="es-seq" value="${v}" data-change="es-seq"${String(env.sequential) === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>`;
    const tools = Object.keys(ctx.types)
      .map((k) => `<button type="button" class="es-tool${ui.tool === k ? ' is-on' : ''}" data-action="es-tool" data-t="${k}" aria-pressed="${ui.tool === k}"><span class="es-tool-glyph" aria-hidden="true">${glyph(k)}</span><span class="es-tool-name">${h(ctx.types[k].label)}</span></button>`)
      .join('');
    const placer = ui.tool
      ? `<div class="es-placer"><p class="cs-hint">Click the page where the ${h(ctx.types[ui.tool].label.toLowerCase())} field goes.</p><button class="cs-btn cs-btn-small" type="button" data-action="es-place-kb">Add to page ${st.page}</button></div>`
      : '<p class="cs-hint fe-how">Choose a field, then click the page where it goes, or drag it onto the page.</p>';
    return `<div class="fe-sec fe-sec-signers"><h2 class="fe-h">Fields for</h2><div class="es-signers" role="group" aria-label="New fields are for">${signers}</div>${order}</div>
      <div class="fe-sec fe-sec-tools"><h2 class="fe-h">Add a field</h2><div class="es-palette" role="group" aria-label="Field to place" style="--sc:${h(on ? on.color : 'currentColor')}">${tools}</div>${placer}</div>
      ${ctx.railExtraHTML ? ctx.railExtraHTML() : ''}
      <div class="fe-sec fe-status" role="status">${ctx.statusHTML()}</div>`;
  }
  function barHTML(ctx, st) {
    const n = ctx.pages ? ctx.pages.length : ctx.env.pages;
    const off = ctx.pages ? '' : ' disabled';
    const zooms = [['fit', 'Fit']].concat(ZOOMS.map((z) => [String(z), Math.round(z * 100) + '%']));
    return `<div class="fe-bar-group">
        <button class="cs-icon" type="button" data-action="fe-undo" aria-label="Undo" title="Undo (${MOD}Z)"${st.undo.length ? '' : ' disabled'}>${svg(ICON.undo)}</button>
        <button class="cs-icon" type="button" data-action="fe-redo" aria-label="Redo" title="Redo (Shift+${MOD}Z)"${st.redo.length ? '' : ' disabled'}>${svg(ICON.redo)}</button>
      </div>
      <div class="fe-bar-group fe-zoom">
        <button class="cs-icon fe-zoom-step" type="button" data-action="fe-zoom-out" aria-label="Zoom out" title="Zoom out"${off}>${svg(ICON.minus)}</button>
        <label class="sr-only" for="fe-zoom">Zoom</label>
        <select id="fe-zoom" class="fe-well" data-change="fe-zoom"${off}>${zooms.map(([v, l]) => `<option value="${v}"${String(st.zoom) === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button class="cs-icon fe-zoom-step" type="button" data-action="fe-zoom-in" aria-label="Zoom in" title="Zoom in"${off}>${svg(ICON.plus)}</button>
      </div>
      <div class="fe-bar-group fe-pager">
        <button class="cs-icon" type="button" data-action="fe-prev" aria-label="Previous page" title="Previous page"${off}>${svg(ICON.prev)}</button>
        <label class="fe-pager-of" for="fe-page"><span>Page</span><input id="fe-page" class="fe-well" type="text" inputmode="numeric" autocomplete="off" maxlength="4" value="${Math.min(st.page, n)}" data-change="fe-page"${off}><span>of ${n}</span></label>
        <button class="cs-icon" type="button" data-action="fe-next" aria-label="Next page" title="Next page"${off}>${svg(ICON.next)}</button>
      </div>`;
  }
  function pagesHTML(ctx, st) {
    const pp = ctx.pages;
    const by = {};
    ctx.env.fields.forEach((f) => (by[f.page] = (by[f.page] || '') + ctx.fieldHTML(f)));
    // Only the pages around the one in view carry their image at first; the rest get theirs as they come near (see watch).
    return pp
      .map((p, i) => {
        const near = Math.abs(i + 1 - st.page) <= 2;
        return `<div class="es-page-wrap" style="--pw:${p.w.toFixed(2)}"><div class="es-page" data-page="${i + 1}" style="aspect-ratio:${p.w} / ${p.h}"><img ${near ? 'src' : 'data-src'}="${p.url}"${near ? ` data-src="${p.url}"` : ''} alt="Page ${i + 1} of ${pp.length}" width="${Math.round(p.w)}" height="${Math.round(p.h)}" draggable="false">${by[i + 1] || ''}</div><p class="es-page-no">Page ${i + 1} of ${pp.length}</p></div>`;
      })
      .join('');
  }
  function emptyPropsHTML() {
    const key = (k) => `<kbd>${k}</kbd>`;
    const rows = [
      ['Move', key('Arrow keys')],
      ['Move further', key('Shift') + key('Arrow')],
      ['Resize', key('Alt') + key('Arrow')],
      ['Duplicate', key(MOD + 'D')],
      ['Remove', key('Delete')],
      ['Undo, redo', key(MOD + 'Z') + key('Shift+' + MOD + 'Z')],
      ['No snapping', 'hold ' + key('Alt') + ' while dragging']
    ];
    return `<div class="fe-none"><h2 class="fe-h">Selected field</h2><p class="cs-hint">Select a field on the page to change its type, who it is for, or its label.</p>
      <dl class="fe-keys">${rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl></div>`;
  }
  function propsHTML(ctx) {
    const f = ctx.ui.sel ? ctx.env.fields.find((x) => x.id === ctx.ui.sel) : null;
    return f ? ctx.propsHTML(f) : emptyPropsHTML();
  }
  function toolsHTML(f) {
    const s = cur.ctx.signer(f);
    const t = cur.ctx.types[f.type] || cur.ctx.types.text;
    return `<div class="fe-tools" role="toolbar" aria-label="${h(t.label)} field" style="--sc:${h(s ? s.color : 'currentColor')}"><button class="cs-icon fe-tools-props" type="button" data-action="fe-props" aria-label="Properties" title="Properties">${svg(ICON.sliders)}</button><button class="cs-icon" type="button" data-action="fe-dup" aria-label="Duplicate" title="Duplicate (${MOD}D)">${svg(ICON.copy)}</button><button class="cs-icon" type="button" data-action="es-fdel" aria-label="Remove" title="Remove (Delete)">${svg(ICON.trash)}</button></div>`;
  }
  /** The whole editor for one draft. esign.js puts it under the page head and calls mount once it is on the page. */
  function html(ctx) {
    const st = stateOf(ctx.env);
    const ui = ctx.ui;
    if (ui.sel && !ctx.env.fields.some((f) => f.id === ui.sel)) ui.sel = null;
    return `<div class="es-editor fe${ui.tool ? ' is-placing' : ''}${st.sheet && ui.sel ? ' show-props' : ''}" data-env="${h(ctx.env.id)}" style="--fe-h:${st.h}px">
      <aside class="fe-rail" aria-label="Signers and fields">${railHTML(ctx)}</aside>
      <section class="fe-stage" aria-label="Document">
        <div class="fe-bar" role="toolbar" aria-label="Undo, zoom and page">${barHTML(ctx, st)}</div>
        <div class="fe-scroll" tabindex="-1">${ctx.pages ? `<div class="es-doc fe-doc" style="--fe-scale:${st.scale.toFixed(4)}">${pagesHTML(ctx, st)}</div>` : `<div class="es-doc fe-doc fe-doc-wait">${ctx.pendingHTML || ''}</div>`}</div>
      </section>
      <aside class="fe-props" aria-label="Selected field">${propsHTML(ctx)}</aside>
      <div class="fe-carry" aria-hidden="true"></div>
    </div>`;
  }

  /* ---------- History: one step is the whole list of fields, as text ---------- */
  function commit(merge) {
    const st = cur.st;
    const now = JSON.stringify(cur.env.fields);
    if (now === st.last) return false;
    // Typing a label, or holding an arrow key down, is one step however many changes it makes.
    if (!(merge && merge === st.merge && st.undo.length)) {
      st.undo.push(st.last);
      if (st.undo.length > HISTORY) st.undo.shift();
    }
    st.merge = merge || '';
    st.redo = [];
    st.last = now;
    cur.ctx.save();
    refreshBar();
    return true;
  }
  /** The field a step changed, added or brought back, so it can be selected and shown. */
  function changedId(before, after) {
    const was = {};
    before.forEach((f) => (was[f.id] = JSON.stringify(f)));
    const hit = after.find((f) => was[f.id] !== JSON.stringify(f));
    return hit ? hit.id : null;
  }
  function travel(from, to) {
    if (!live() || !from.length) return;
    cancelDrag();
    const st = cur.st;
    const before = cur.env.fields;
    to.push(st.last);
    st.last = from.pop();
    st.merge = '';
    cur.env.fields = JSON.parse(st.last);
    const id = changedId(before, cur.env.fields);
    cur.ctx.ui.sel = id;
    if (!id) leaveSheet();
    cur.ctx.save();
    renderFields();
    refreshProps();
    refreshRail();
    refreshBar();
    const el = id && fieldEl(id);
    if (el) {
      reveal(el);
      el.focus({ preventScroll: true });
    } else cur.scroll.focus({ preventScroll: true });
  }
  const undo = () => live() && travel(cur.st.undo, cur.st.redo);
  const redo = () => live() && travel(cur.st.redo, cur.st.undo);

  /**
   * A field the portal placed and marked for the sponsor's review counts as reviewed once the sponsor has moved or resized
   * it (or given it to another signer): the mark is cleared here. Returns whether anything was cleared.
   */
  function settle(f) {
    let hit = false;
    ['review', 'needsReview'].forEach((k) => {
      if (f[k]) {
        f[k] = false;
        hit = true;
      }
    });
    // Automatic placement's own rule, when that part is loaded: a field it was unsure of is confirmed by being edited.
    if (NS.placement && typeof NS.placement.needsReview === 'function' && NS.placement.needsReview(f)) {
      f.confirmed = true;
      hit = true;
    }
    return hit;
  }

  /* ---------- Drawing fields, the selection and the panels ---------- */
  function insertField(f) {
    const pg = pageEl(f.page);
    if (!pg) return null;
    const list = cur.env.fields;
    let before = null;
    for (let i = list.indexOf(f) + 1; i < list.length && !before; i++) if (list[i].page === f.page) before = fieldEl(list[i].id);
    const box = document.createElement('div');
    box.innerHTML = cur.ctx.fieldHTML(f);
    const el = box.firstElementChild;
    pg.insertBefore(el, before && before.parentNode === pg ? before : pg.querySelector('.fe-tools, .fe-guides, .fe-origin'));
    return el;
  }
  function renderField(f) {
    const old = fieldEl(f.id);
    if (old) old.remove();
    return insertField(f);
  }
  function renderFields() {
    cur.root.querySelectorAll('.es-fld, .fe-tools, .fe-guides, .fe-origin').forEach((x) => x.remove());
    const by = {};
    cur.env.fields.forEach((f) => (by[f.page] = (by[f.page] || '') + cur.ctx.fieldHTML(f)));
    Object.keys(by).forEach((n) => {
      const pg = pageEl(n);
      if (pg) pg.insertAdjacentHTML('beforeend', by[n]);
    });
    decorate();
  }
  /** The selected field gets its handles and its small toolbar; every other field loses them. */
  function decorate() {
    cur.root.querySelectorAll('.es-handle, .fe-tools').forEach((x) => x.remove());
    const f = selField();
    cur.doc.querySelectorAll('.es-fld').forEach((el) => {
      const on = !!f && el.getAttribute('data-fid') === f.id;
      el.classList.toggle('is-sel', on);
      el.setAttribute('aria-pressed', String(on));
    });
    const el = f && fieldEl(f.id);
    if (!el || !cur.doc.contains(el)) return;
    el.insertAdjacentHTML('beforeend', HANDLES.map((d) => `<span class="es-handle" data-h="${d}" aria-hidden="true"></span>`).join(''));
    el.parentNode.insertAdjacentHTML('beforeend', toolsHTML(f));
    positionTools();
  }
  /**
   * Puts the toolbar beside the selected field where it covers no other field: above it, else below, else to its right or
   * left (above when nothing is free). Also notes how small the field is drawn, which decides the handles it gets.
   */
  function positionTools() {
    const t = cur.doc.querySelector('.fe-tools');
    const f = selField();
    const el = f && fieldEl(f.id);
    if (!t || !el) return;
    const pg = t.parentNode;
    const pw = pg.clientWidth;
    const ph = pg.clientHeight;
    const w = f.w * pw;
    const hh = f.h * ph;
    // Small fields keep fewer handles, so there is always a part of the field left to drag it by.
    el.classList.toggle('is-thin', hh < 30);
    el.classList.toggle('is-narrow', w < 30);
    el.classList.toggle('is-tiny', Math.max(w, hh) < 30);
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const gap = coarse ? 40 : 14;
    const tw = t.offsetWidth;
    const th = t.offsetHeight;
    const room = pg.getAttribute('data-page') === '1' ? 12 : 28; // the toolbar may sit in the space above a page
    const L = f.x * pw;
    const T = f.y * ph;
    const midX = clamp(L + w / 2 - tw / 2, 0, Math.max(0, pw - tw));
    const midY = clamp(T + hh / 2 - th / 2, 0, Math.max(0, ph - th));
    const spots = [
      { x: midX, y: T - th - gap, ok: T - th - gap >= -room },
      { x: midX, y: T + hh + gap, ok: T + hh + gap + th <= ph + room },
      { x: L + w + gap, y: midY, ok: L + w + gap + tw <= pw },
      { x: L - gap - tw, y: midY, ok: L - gap - tw >= 0 }
    ].filter((s) => s.ok);
    const others = cur.env.fields.filter((o) => o.page === f.page && o.id !== f.id);
    const clear = (s) => !others.some((o) => s.x < (o.x + o.w) * pw + 4 && s.x + tw > o.x * pw - 4 && s.y < (o.y + o.h) * ph + 4 && s.y + th > o.y * ph - 4);
    const at = spots.find(clear) || spots[0] || { x: midX, y: T + hh + gap };
    t.style.left = Math.round(at.x) + 'px';
    t.style.top = Math.round(at.y) + 'px';
  }
  function leaveSheet() {
    cur.st.sheet = false;
    cur.root.classList.remove('show-props');
  }
  function select(id) {
    const ui = cur.ctx.ui;
    id = id || null;
    if (ui.sel === id) return;
    ui.sel = id;
    cur.st.merge = '';
    if (!id) leaveSheet();
    decorate();
    refreshProps();
  }
  function refreshProps() {
    cur.props.innerHTML = propsHTML(cur.ctx);
  }
  function refreshRail() {
    const a = document.activeElement;
    let key = '';
    if (a && cur.rail.contains(a)) {
      if (a.getAttribute('data-action')) key = `[data-action="${a.getAttribute('data-action')}"]` + (a.hasAttribute('data-t') ? `[data-t="${a.getAttribute('data-t')}"]` : '') + (a.hasAttribute('data-id') ? `[data-id="${CSS.escape(a.getAttribute('data-id'))}"]` : '');
      else if (a.name) key = `[name="${a.name}"][value="${a.value}"]`;
    }
    cur.rail.innerHTML = railHTML(cur.ctx);
    const el = key && cur.rail.querySelector(key);
    if (el) el.focus({ preventScroll: true });
  }
  function refreshBar() {
    const st = cur.st;
    const q = (s) => cur.bar.querySelector(s);
    const set = (s, off) => {
      const b = q(s);
      if (b) b.disabled = !!off;
    };
    const n = cur.ctx.pages.length;
    set('[data-action="fe-undo"]', !st.undo.length);
    set('[data-action="fe-redo"]', !st.redo.length);
    const steps = zoomSteps();
    set('[data-action="fe-zoom-out"]', st.scale <= steps[0] + 1e-4);
    set('[data-action="fe-zoom-in"]', st.scale >= steps[steps.length - 1] - 1e-4);
    set('[data-action="fe-prev"]', st.page <= 1);
    set('[data-action="fe-next"]', st.page >= n);
    const z = q('#fe-zoom');
    if (z) z.value = String(st.zoom);
    const p = q('#fe-page');
    if (p && document.activeElement !== p) p.value = String(st.page);
    const add = cur.rail.querySelector('[data-action="es-place-kb"]');
    if (add) add.textContent = `Add to page ${st.page}`;
  }
  /** Scrolls the document just enough to show an element that is out of view. */
  function reveal(el) {
    const v = cur.scroll.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < v.top + 8 || r.bottom > v.bottom - 8) cur.scroll.scrollTop += r.top + r.height / 2 - (v.top + v.height / 2);
    if (r.left < v.left + 8 || r.right > v.right - 8) cur.scroll.scrollLeft += r.left + r.width / 2 - (v.left + v.width / 2);
  }

  /* ---------- Editing steps ---------- */
  function add(type, page, cx, cy, at) {
    if (!live() || !cur.ctx.types[type] || !pageEl(page)) return null;
    const ui = cur.ctx.ui;
    const f = cur.ctx.makeField(type, page, cx, cy);
    if (at) {
      f.x = at.x;
      f.y = at.y;
    }
    cur.env.fields.push(f);
    ui.sel = f.id;
    ui.tool = null;
    cur.root.classList.remove('is-placing');
    hideGhost();
    commit();
    const el = insertField(f);
    decorate();
    refreshProps();
    refreshRail();
    if (el) {
      reveal(el);
      el.focus({ preventScroll: true });
    }
    return f;
  }
  /** For the keyboard and assistive tools: the chosen field type goes on the page in view, in the middle of what is shown. */
  function addHere() {
    if (!live() || !cur.ctx.ui.tool) return null;
    const pg = pageEl(cur.st.page) || pageEl(1);
    const r = pg.getBoundingClientRect();
    const v = cur.scroll.getBoundingClientRect();
    const mid = clamp((Math.max(r.top, v.top) + Math.min(r.bottom, v.bottom)) / 2, r.top, r.bottom);
    const n = cur.env.fields.filter((f) => f.page === cur.st.page).length;
    return add(cur.ctx.ui.tool, Number(pg.getAttribute('data-page')), 0.3 + 0.02 * (n % 8), clamp((mid - r.top) / r.height + 0.015 * (n % 8), 0.04, 0.96));
  }
  function remove(id) {
    if (!live()) return;
    const f = id ? fieldById(id) : selField();
    if (!f) return;
    cancelDrag();
    cur.env.fields = cur.env.fields.filter((x) => x !== f);
    if (cur.ctx.ui.sel === f.id) {
      cur.ctx.ui.sel = null;
      leaveSheet();
    }
    const el = fieldEl(f.id);
    if (el) el.remove();
    commit();
    decorate();
    refreshProps();
    refreshRail();
    cur.scroll.focus({ preventScroll: true });
  }
  function duplicate(id) {
    if (!live()) return null;
    const f = id ? fieldById(id) : selField();
    if (!f) return null;
    cancelDrag();
    // A whole copy, so everything on the field comes with it; only its identity and its place are new.
    const c = JSON.parse(JSON.stringify(f));
    c.id = cur.ctx.uid();
    const pt = pagePt(f.page);
    const dx = OFFSET / pt.w;
    const dy = OFFSET / pt.h;
    c.x = f.x + dx <= 1 - f.w ? f.x + dx : Math.max(0, f.x - dx);
    c.y = f.y + dy <= 1 - f.h ? f.y + dy : Math.max(0, f.y - dy);
    cur.env.fields.splice(cur.env.fields.indexOf(f) + 1, 0, c);
    cur.ctx.ui.sel = c.id;
    commit();
    const el = insertField(c);
    decorate();
    refreshProps();
    refreshRail();
    if (el) {
      reveal(el);
      el.focus({ preventScroll: true });
    }
    return c;
  }
  function retype(f, type) {
    const T = cur.ctx.types;
    const old = f.type;
    const was = cur.ctx.isReq(f);
    f.type = type;
    // Required carries over as the sponsor last saw it; a date is filled in for the signer, so it had no say.
    if (type !== 'date') f.required = old === 'date' ? type === 'signature' || type === 'initials' : was;
    if ((f.label || '') === (old === 'text' ? 'Text' : '')) f.label = type === 'text' ? 'Text' : '';
    // A checkbox is a small square: going to or from one takes the new type's usual size. Otherwise the box is kept.
    const pt = pagePt(f.page);
    const m = MIN[type] || MIN.text;
    if (old === 'checkbox' || type === 'checkbox') {
      f.w = Math.min(0.9, T[type].w / pt.w);
      f.h = Math.min(0.5, T[type].h / pt.h);
    } else {
      f.w = Math.max(f.w, m.w / pt.w);
      f.h = Math.max(f.h, m.h / pt.h);
    }
    f.x = clamp(f.x, 0, 1 - f.w);
    f.y = clamp(f.y, 0, 1 - f.h);
  }
  /** A change made in the properties panel: type, signerId, required or label, or a property passed through to ctx.setExtra. */
  function setProp(k, v) {
    if (!live()) return;
    const f = selField();
    if (!f) return;
    if (k === 'type') {
      if (!cur.ctx.types[v] || v === f.type) return;
      retype(f, v);
    } else if (k === 'signerId') {
      if (!cur.env.signers.some((s) => s.id === v)) return;
      f.signerId = v;
      settle(f);
    } else if (k === 'required') f.required = !!v;
    else if (k === 'label') f.label = String(v);
    // A property this editor does not know (who gets the field, what fills it in, a status being confirmed): the
    // page that owns it writes it through ctx.setExtra, which says whether the field changed.
    else if (!(cur.ctx.setExtra && cur.ctx.setExtra(f, k, v))) return;
    commit(k === 'label' ? 'label:' + f.id : '');
    renderField(f);
    decorate();
    if (k !== 'label') {
      refreshProps();
      const c = cur.props.querySelector(`[data-k="${k}"]`);
      if (c) c.focus({ preventScroll: true });
    }
    refreshRail();
  }
  function setTool(t) {
    if (!live()) return;
    const ui = cur.ctx.ui;
    ui.tool = t && cur.ctx.types[t] && ui.tool !== t ? t : null;
    cur.root.classList.toggle('is-placing', !!ui.tool);
    hideGhost();
    refreshRail();
  }
  function setSigner(id) {
    if (!live()) return;
    cur.ctx.ui.signer = id;
    hideGhost();
    refreshRail();
  }
  function nudge(f, e) {
    const pt = pagePt(f.page);
    const step = e.shiftKey ? 10 : 1; // points
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!mv) return false;
    const dx = (mv[0] * step) / pt.w;
    const dy = (mv[1] * step) / pt.h;
    if (e.altKey) {
      const m = MIN[f.type] || MIN.text;
      f.w = clamp(f.w + dx, Math.min(f.w, m.w / pt.w), 1 - f.x);
      f.h = clamp(f.h + dy, Math.min(f.h, m.h / pt.h), 1 - f.y);
    } else {
      f.x = clamp(f.x + dx, 0, 1 - f.w);
      f.y = clamp(f.y + dy, 0, 1 - f.h);
    }
    const cleared = settle(f);
    if (!e.repeat) cur.st.merge = '';
    if (!commit('nudge:' + f.id)) return true;
    let el = fieldEl(f.id);
    if (cleared) {
      el = renderField(f);
      decorate();
      refreshRail();
      refreshProps();
    } else if (el) {
      place(el, f);
      positionTools();
    }
    if (el) {
      reveal(el);
      el.focus({ preventScroll: true });
    }
    return true;
  }

  /* ---------- Where things are on screen ---------- */
  /** Every page's place on screen. Read once and kept until the document scrolls, zooms or changes size. */
  function rects() {
    if (!cur.rc) cur.rc = Array.from(cur.doc.querySelectorAll('.es-page')).map((el) => ({ n: Number(el.getAttribute('data-page')), el, r: el.getBoundingClientRect() }));
    return cur.rc;
  }
  /** The part of the document's scrolling area that is on screen. */
  function viewRect() {
    const v = cur.scroll.getBoundingClientRect();
    return { left: Math.max(v.left, 0), right: Math.min(v.right, window.innerWidth), top: Math.max(v.top, 0), bottom: Math.min(v.bottom, window.innerHeight) };
  }
  /** The page the pointer is over: the one it is on, or the nearest above or below. Outside the document there is none for a new field. */
  function target(px, py, strict) {
    if (strict) {
      const v = viewRect();
      if (px < v.left || px > v.right || py < v.top || py > v.bottom) return null;
    }
    let best = null;
    let bd = Infinity;
    rects().forEach((p) => {
      const d = py < p.r.top ? p.r.top - py : py > p.r.bottom ? py - p.r.bottom : 0;
      if (d < bd) {
        bd = d;
        best = p;
      }
    });
    return best;
  }

  /* ---------- Snapping ---------- */
  /** What a field can line up with on a page: the edges and centres of the other fields there, and the text's baselines. */
  function candidates(n, exceptId) {
    const xs = [];
    const ys = [];
    cur.env.fields.forEach((o) => {
      if (o.page !== n || o.id === exceptId) return;
      xs.push({ v: o.x, k: 'e', a: o.y, b: o.y + o.h }, { v: o.x + o.w, k: 'e', a: o.y, b: o.y + o.h }, { v: o.x + o.w / 2, k: 'c', a: o.y, b: o.y + o.h });
      ys.push({ v: o.y, k: 'e', a: o.x, b: o.x + o.w }, { v: o.y + o.h, k: 'e', a: o.x, b: o.x + o.w }, { v: o.y + o.h / 2, k: 'c', a: o.x, b: o.x + o.w });
    });
    const lines = (cur.ctx.lines && cur.ctx.lines(n)) || [];
    lines.forEach((l) => ys.push({ v: l.y, k: 'b', a: l.x0, b: l.x1 }));
    return { xs, ys };
  }
  // An edge lines up with edges, a centre with centres, and only the bottom edge sits on a line of text (text under the field or a little way beside it).
  const fits = (c, an, lo, hi) => (c.k === 'b' ? !!an.base && c.a <= hi + 0.06 && c.b >= lo - 0.06 : c.k === an.k);
  /**
   * How far to shift so the nearest anchor meets its nearest candidate (0 when nothing is within reach). Fields win over
   * text, and a line of text pulls from half as far, so a field can still be set down freely between two lines.
   */
  function pull(cands, anchors, reach, lo, hi) {
    let best = 0;
    let bd = Infinity;
    [false, true].forEach((text) => {
      if (bd < Infinity) return;
      const within = text ? reach / 2 : reach;
      anchors.forEach((an) =>
        cands.forEach((c) => {
          if ((c.k === 'b') !== text || !fits(c, an, lo, hi)) return;
          const d = c.v - an.v;
          if (Math.abs(d) <= within && Math.abs(d) < bd) {
            bd = Math.abs(d);
            best = d;
          }
        })
      );
    });
    return bd < Infinity ? best : 0;
  }
  const anchorsX = (b, which) => [which.W !== false && { v: b.x, k: 'e' }, which.E !== false && { v: b.x + b.w, k: 'e' }, which.C !== false && { v: b.x + b.w / 2, k: 'c' }].filter(Boolean);
  const anchorsY = (b, which) => [which.N !== false && { v: b.y, k: 'e' }, which.S !== false && { v: b.y + b.h, k: 'e', base: true }, which.M !== false && { v: b.y + b.h / 2, k: 'c' }].filter(Boolean);
  /** A moving box, snapped. Works in fractions of the page, so a snapped edge is exactly its neighbour's. */
  function snapMove(tp, cands, b) {
    const out = { x: b.x, y: b.y, w: b.w, h: b.h };
    const dx = pull(cands.xs, anchorsX(b, {}), SNAP / tp.r.width, b.y, b.y + b.h);
    if (dx && out.x + dx >= 0 && out.x + dx <= 1 - b.w) out.x += dx;
    const dy = pull(cands.ys, anchorsY(b, {}), SNAP / tp.r.height, out.x, out.x + b.w);
    if (dy && out.y + dy >= 0 && out.y + dy <= 1 - b.h) out.y += dy;
    return out;
  }
  /** The guide lines for a box: one through every candidate one of its anchors now sits on, long enough to join the two. */
  function guideLines(tp, cands, b, which) {
    const ex = 0.5 / tp.r.width;
    const ey = 0.5 / tp.r.height;
    const out = [];
    anchorsX(b, which).forEach((an) => cands.xs.forEach((c) => fits(c, an, b.y, b.y + b.h) && Math.abs(c.v - an.v) < ex && out.push({ ax: 'x', v: c.v, a: Math.min(c.a, b.y), b: Math.max(c.b, b.y + b.h) })));
    anchorsY(b, which).forEach((an) => cands.ys.forEach((c) => fits(c, an, b.x, b.x + b.w) && Math.abs(c.v - an.v) < ey && out.push({ ax: 'y', v: c.v, a: Math.min(c.a, b.x), b: Math.max(c.b, b.x + b.w) })));
    return out;
  }
  function showGuides(tp, lines) {
    if (cur.guides && (!tp || cur.guides.parentNode !== tp.el || !lines.length)) {
      cur.guides.remove();
      cur.guides = null;
    }
    if (!tp || !lines.length) return;
    if (!cur.guides) {
      cur.guides = document.createElement('div');
      cur.guides.className = 'fe-guides';
      tp.el.appendChild(cur.guides);
    }
    const pad = 0.012;
    cur.guides.innerHTML = lines.map((l) => (l.ax === 'x' ? `<i class="fe-guide fe-guide-x" style="left:${pc(l.v)};top:${pc(Math.max(0, l.a - pad))};height:${pc(Math.min(1, l.b + pad) - Math.max(0, l.a - pad))}"></i>` : `<i class="fe-guide fe-guide-y" style="top:${pc(l.v)};left:${pc(Math.max(0, l.a - pad))};width:${pc(Math.min(1, l.b + pad) - Math.max(0, l.a - pad))}"></i>`)).join('');
  }
  function showTarget(tp) {
    const el = tp ? tp.el : null;
    if (cur.over === el) return;
    if (cur.over) cur.over.classList.remove('is-target');
    cur.over = el;
    if (el) el.classList.add('is-target');
  }

  /* ---------- Dragging ---------- */
  function capture(id) {
    try {
      cur.root.setPointerCapture(id);
    } catch (e) {
      /* the pointer is already gone */
    }
  }
  function release(id) {
    try {
      cur.root.releasePointerCapture(id);
    } catch (e) {
      /* nothing was held */
    }
  }
  function carryAt(el, x, y) {
    const o = cur.carry.getBoundingClientRect();
    el.style.transform = `translate3d(${(x - o.left).toFixed(2)}px, ${(y - o.top).toFixed(2)}px, 0)`;
  }
  /** A press on a field (move) or on one of its handles (resize). The field is selected at once and follows from the first pixel. */
  function beginField(e, f, el, dir) {
    hideGhost();
    select(f.id);
    el = fieldEl(f.id) || el;
    el.focus({ preventScroll: true });
    const r = el.getBoundingClientRect();
    const pr = el.parentNode.getBoundingClientRect();
    drag = {
      kind: dir ? 'resize' : 'move', dir, id: e.pointerId, f, el, sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, far: 0, alt: e.altKey,
      ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, h: r.height, slop: e.pointerType === 'mouse' ? 3 : 6,
      // Resizing works from where on the page the press was, so the page may scroll under the pointer.
      gx: (e.clientX - pr.left) / pr.width, gy: (e.clientY - pr.top) / pr.height,
      from: { page: f.page, x: f.x, y: f.y, w: f.w, h: f.h }, cands: {}, lifted: false, box: null, tp: null
    };
    capture(e.pointerId);
    cur.root.classList.add(dir ? 'is-resizing' : 'is-moving');
    if (dir) cur.root.setAttribute('data-dir', dir);
    drag.raf = requestAnimationFrame(autoScroll);
  }
  /** A field type dragged off the palette: its outline follows the pointer until it is dropped on a page. */
  function beginNew(e) {
    const type = press.type;
    press = null;
    hideGhost();
    const g = makeGhost(type);
    if (!g) return;
    drag = { kind: 'new', type, id: e.pointerId, f: { id: '' }, el: g.el, sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, far: 9, alt: e.altKey, ox: g.w / 2, oy: g.h / 2, w: g.w, h: g.h, cands: {}, lifted: true, box: null, tp: null };
    capture(e.pointerId);
    cur.root.classList.add('is-moving');
    drag.raf = requestAnimationFrame(autoScroll);
  }
  function lift() {
    const d = drag;
    const el = d.el;
    const r = el.getBoundingClientRect();
    d.lifted = true;
    // A faint outline stays where the field came from until it is put down.
    d.mark = document.createElement('div');
    d.mark.className = 'fe-origin';
    place(d.mark, d.from);
    d.mark.style.setProperty('--sc', el.style.getPropertyValue('--sc'));
    el.parentNode.appendChild(d.mark);
    cur.root.querySelectorAll('.fe-tools').forEach((x) => x.remove());
    el.classList.add('is-carried');
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = r.width.toFixed(2) + 'px';
    el.style.height = r.height.toFixed(2) + 'px';
    carryAt(el, r.left, r.top);
    cur.carry.appendChild(el);
  }
  /** The size a dragged field takes on a page, as fractions of it: the same size on paper whatever the page's own size. */
  function sizeOn(d, n) {
    const pt = pagePt(n);
    if (d.kind === 'new') {
      const t = cur.ctx.types[d.type];
      return { w: Math.min(0.9, t.w / pt.w), h: Math.min(0.5, t.h / pt.h) };
    }
    const from = pagePt(d.from.page);
    return { w: from.w === pt.w ? d.from.w : Math.min(1, (d.from.w * from.w) / pt.w), h: from.h === pt.h ? d.from.h : Math.min(1, (d.from.h * from.h) / pt.h) };
  }
  const candsFor = (d, n) => d.cands[n] || (d.cands[n] = candidates(n, d.f.id));
  function carryTo() {
    const d = drag;
    if (!d.lifted) lift();
    const tp = target(d.px, d.py, d.kind === 'new');
    let x = d.px - d.ox;
    let y = d.py - d.oy;
    let lines = [];
    d.tp = tp;
    d.box = null;
    if (tp) {
      const all = rects();
      const r = tp.r;
      const s = sizeOn(d, tp.n);
      // Sideways the field stays on the page; up and down it may cross the gap to the next page, and stops at the ends of the document.
      x = clamp(x, r.left, r.right - d.w);
      y = clamp(y, all[0].r.top, all[all.length - 1].r.bottom - d.h);
      let b = { x: clamp((x - r.left) / r.width, 0, 1 - s.w), y: clamp((y - r.top) / r.height, 0, 1 - s.h), w: s.w, h: s.h };
      const onPage = y >= r.top - 0.5 && y + d.h <= r.bottom + 0.5;
      if (!d.alt && onPage) {
        const c = candsFor(d, tp.n);
        b = snapMove(tp, c, b);
        lines = guideLines(tp, c, b, {});
        x = r.left + b.x * r.width;
        y = r.top + b.y * r.height;
      }
      d.box = b;
    }
    d.el.classList.toggle('is-off', !tp);
    showTarget(tp);
    showGuides(tp, lines);
    carryAt(d.el, x, y);
  }
  function resizeTo() {
    const d = drag;
    const f = d.f;
    const o = d.from;
    const tp = rects().find((p) => p.n === f.page);
    if (!tp) return;
    const dx = (d.px - tp.r.left) / tp.r.width - d.gx;
    const dy = (d.py - tp.r.top) / tp.r.height - d.gy;
    const W = d.dir.indexOf('w') >= 0;
    const E = d.dir.indexOf('e') >= 0;
    const N = d.dir.indexOf('n') >= 0;
    const S = d.dir.indexOf('s') >= 0;
    let L = o.x + (W ? dx : 0);
    let R = o.x + o.w + (E ? dx : 0);
    let T = o.y + (N ? dy : 0);
    let B = o.y + o.h + (S ? dy : 0);
    const pt = pagePt(f.page);
    const m = MIN[f.type] || MIN.text;
    const mw = Math.min(m.w / pt.w, o.w);
    const mh = Math.min(m.h / pt.h, o.h);
    const which = { W, E, N, S, C: false, M: false };
    const c = candsFor(d, f.page);
    if (!d.alt) {
      const box = { x: L, y: T, w: R - L, h: B - T };
      if (W || E) {
        const sx = pull(c.xs, anchorsX(box, which), SNAP / tp.r.width, T, B);
        if (W) L += sx;
        else R += sx;
      }
      if (N || S) {
        const sy = pull(c.ys, anchorsY(box, which), SNAP / tp.r.height, L, R);
        if (N) T += sy;
        else B += sy;
      }
    }
    if (W) L = clamp(L, 0, R - mw);
    if (E) R = clamp(R, L + mw, 1);
    if (N) T = clamp(T, 0, B - mh);
    if (S) B = clamp(B, T + mh, 1);
    d.box = { x: L, y: T, w: R - L, h: B - T };
    place(d.el, d.box);
    showGuides(tp, d.alt ? [] : guideLines(tp, c, d.box, which));
  }
  const track = () => drag && (drag.kind === 'resize' ? resizeTo() : carryTo());
  /** Near the top or bottom edge of the document (or its sides, when zoomed in) a drag scrolls it, faster the nearer the edge. */
  function autoScroll() {
    const d = drag;
    if (!d || !live()) return;
    d.raf = requestAnimationFrame(autoScroll);
    if (d.far < 3) return;
    const v = viewRect();
    const band = Math.min(EDGE, (v.bottom - v.top) / 4);
    // A new field comes from outside the document, often across one of its edges: it scrolls nothing until it is well inside.
    if (d.kind === 'new' && !d.inside) {
      d.inside = d.px > v.left && d.px < v.right && d.py > v.top + band && d.py < v.bottom - band;
      if (!d.inside) return;
    }
    const speed = (into) => {
      const t = clamp(into / band, 0, 1.5);
      return t > 0 ? 3 + 21 * t * t : 0;
    };
    const s = cur.scroll;
    const top = s.scrollTop;
    const left = s.scrollLeft;
    const vy = speed(d.py - (v.bottom - band)) - speed(v.top + band - d.py);
    const vx = s.scrollWidth > s.clientWidth + 1 ? speed(d.px - (v.right - band)) - speed(v.left + band - d.px) : 0;
    if (vy) s.scrollTop = top + vy;
    if (vx) s.scrollLeft = left + vx;
    if (s.scrollTop !== top || s.scrollLeft !== left) {
      cur.rc = null;
      track();
    }
  }
  /** Ends the drag's hold on the screen: the pointer, the highlight, the guides and the outline at the origin. */
  function letGo() {
    const d = drag;
    drag = null;
    if (!d) return null;
    cancelAnimationFrame(d.raf);
    release(d.id);
    if (cur) {
      cur.root.classList.remove('is-moving', 'is-resizing');
      cur.root.removeAttribute('data-dir');
      showTarget(null);
      showGuides(null, []);
    }
    if (d.mark) d.mark.remove();
    return d;
  }
  function drop() {
    const d = letGo();
    if (!d || !live()) return;
    swallow = true;
    setTimeout(() => (swallow = false), 0);
    const f = d.f;
    if (d.kind === 'new') {
      d.el.remove();
      if (d.tp && d.box) add(d.type, d.tp.n, 0.5, 0.5, d.box);
      return;
    }
    const o = d.from;
    let changed = false;
    // Less movement than this was a click or a tap, not a drag: the field goes back where it was.
    if (d.far >= d.slop && d.box && (d.kind === 'resize' || d.tp)) {
      const b = d.box;
      const page = d.kind === 'move' ? d.tp.n : f.page;
      changed = page !== o.page || b.x !== o.x || b.y !== o.y || b.w !== o.w || b.h !== o.h;
      if (changed) {
        f.page = page;
        f.x = b.x;
        f.y = b.y;
        f.w = b.w;
        f.h = b.h;
        settle(f); // moved or resized by the sponsor: no longer waiting for review
      }
    }
    if (!changed && !d.lifted) {
      if (d.kind === 'resize') place(d.el, o);
      decorate();
      return;
    }
    // Back on its page, drawn afresh so its description (page, marks) is current. Nothing else on the page is touched.
    const el = renderField(f);
    decorate();
    if (el) el.focus({ preventScroll: true });
    if (changed) {
      commit();
      refreshProps();
      refreshRail();
    }
  }
  function cancelDrag() {
    press = null;
    const d = letGo();
    if (!d || !cur) return;
    if (d.kind === 'new') return d.el.remove();
    const el = renderField(d.f);
    decorate();
    if (el) el.focus({ preventScroll: true });
  }

  /* ---------- The outline of a field about to be placed ---------- */
  function makeGhost(type) {
    const t = cur.ctx.types[type];
    if (!t) return null;
    const f = cur.ctx.makeField(type, 1, 0.5, 0.5);
    f.id = 'fe-new';
    const box = document.createElement('div');
    box.innerHTML = cur.ctx.fieldHTML(f);
    const el = box.firstElementChild;
    el.removeAttribute('tabindex');
    el.removeAttribute('data-fid');
    el.classList.remove('is-sel');
    el.classList.add('is-carried', 'is-ghost');
    const pt = pagePt(1);
    const w = Math.min(0.9 * pt.w, t.w) * cur.st.scale;
    const hh = Math.min(0.5 * pt.h, t.h) * cur.st.scale;
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = w.toFixed(2) + 'px';
    el.style.height = hh.toFixed(2) + 'px';
    cur.carry.appendChild(el);
    return { el, w, h: hh, type };
  }
  function hideGhost() {
    if (ghost) ghost.el.remove();
    ghost = null;
  }
  /** With a field type chosen, its outline follows the mouse over the page to show where a click will put it. */
  function hover(e) {
    const tool = cur.ctx.ui.tool;
    const t = e.target;
    const pg = t.closest && t.closest('.fe-doc .es-page');
    if (!pg || t.closest('.es-fld, .fe-tools')) return hideGhost();
    if (!ghost || ghost.type !== tool) {
      hideGhost();
      ghost = makeGhost(tool);
      if (!ghost) return;
    }
    const r = pg.getBoundingClientRect();
    carryAt(ghost.el, clamp(e.clientX - ghost.w / 2, r.left, r.right - ghost.w), clamp(e.clientY - ghost.h / 2, r.top, r.bottom - ghost.h));
  }

  /** The field on a page whose box is nearest a point, if one is within reach (in screen pixels). */
  function nearestField(pg, x, y, reach) {
    let best = null;
    let bd = reach;
    pg.querySelectorAll('.es-fld').forEach((el) => {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if (d <= bd) {
        bd = d;
        best = el;
      }
    });
    return best;
  }

  /* ---------- Pointer, click and keyboard ---------- */
  document.addEventListener('pointerdown', (e) => {
    if (!live() || drag || !e.isPrimary || e.button > 0) return;
    const t = e.target;
    // The field's toolbar, and any control drawn on a field (a status mark's own button, say), take their clicks as usual.
    if (!t.closest || !cur.root.contains(t) || t.closest('.fe-tools, .es-fld button, .es-fld a, .es-fld [data-action]')) return;
    const el = t.closest('.es-fld');
    if (el && cur.doc.contains(el)) {
      const f = fieldById(el.getAttribute('data-fid'));
      if (!f) return;
      const hd = t.closest('.es-handle');
      beginField(e, f, el, hd ? hd.getAttribute('data-h') : '');
      e.preventDefault();
      return;
    }
    const tool = t.closest('.es-tool');
    press = tool ? { id: e.pointerId, type: tool.getAttribute('data-t'), sx: e.clientX, sy: e.clientY, touch: e.pointerType !== 'mouse' } : null;
  });
  document.addEventListener('pointermove', (e) => {
    if (!live()) return;
    if (press && !drag && e.pointerId === press.id && Math.hypot(e.clientX - press.sx, e.clientY - press.sy) >= (press.touch ? 8 : 4)) beginNew(e);
    if (drag) {
      if (e.pointerId !== drag.id) return;
      drag.px = e.clientX;
      drag.py = e.clientY;
      drag.alt = e.altKey;
      drag.far = Math.max(drag.far, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
      track();
      e.preventDefault();
      return;
    }
    if (cur.ctx.ui.tool && e.pointerType === 'mouse') hover(e);
    else if (ghost) hideGhost();
  });
  document.addEventListener('pointerup', (e) => {
    if (press && e.pointerId === press.id) press = null;
    if (drag && e.pointerId === drag.id) drop();
  });
  document.addEventListener('pointercancel', (e) => {
    if (press && e.pointerId === press.id) press = null;
    if (drag && e.pointerId === drag.id) cancelDrag();
  });
  document.addEventListener(
    'click',
    (e) => {
      if (!swallow) return;
      swallow = false;
      if (live() && e.target && (e.target === document.documentElement || e.target === document.body || cur.root.contains(e.target) || e.target.contains(cur.root))) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true
  );
  document.addEventListener('click', (e) => {
    if (!live()) return;
    const t = e.target;
    if (!t.closest || !cur.scroll.contains(t) || t.closest('.es-fld, .fe-tools')) return;
    const ui = cur.ctx.ui;
    const pg = t.closest('.es-page');
    // A finger that lands just beside a small field means the field.
    if (pg && !ui.tool && e.pointerType && e.pointerType !== 'mouse') {
      const hit = nearestField(pg, e.clientX, e.clientY, 16);
      if (hit) {
        select(hit.getAttribute('data-fid'));
        hit.focus({ preventScroll: true });
        return;
      }
    }
    if (pg && ui.tool) {
      const r = pg.getBoundingClientRect();
      add(ui.tool, Number(pg.getAttribute('data-page')), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    } else if (ui.sel) select(null);
  });
  document.addEventListener('keydown', (e) => {
    if (!live()) return;
    const dlg = document.getElementById('dlg');
    if (dlg && dlg.open) return;
    if (drag) {
      if (e.key === 'Escape') cancelDrag();
      else if (e.key === 'Alt') {
        drag.alt = true;
        track();
      } else return;
      e.preventDefault();
      return;
    }
    const t = e.target;
    const tag = (t.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
    if (typing || !(t === document.body || cur.root.contains(t))) return;
    const ui = cur.ctx.ui;
    const mod = e.metaKey || e.ctrlKey;
    const k = String(e.key).toLowerCase();
    if (mod && !e.altKey && (k === 'z' || k === 'y')) {
      e.preventDefault();
      if (k === 'y' || e.shiftKey) redo();
      else undo();
      return;
    }
    if (e.key === 'Escape') {
      if (ui.tool) setTool(null);
      else if (ui.sel) {
        select(null);
        cur.scroll.focus({ preventScroll: true });
      }
      return;
    }
    const fe = t.closest && t.closest('.es-fld');
    const f = fe ? fieldById(fe.getAttribute('data-fid')) : selField();
    if (!f) return;
    if (mod && !e.altKey && !e.shiftKey && k === 'd') {
      e.preventDefault();
      duplicate(f.id);
      return;
    }
    if (mod) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(f.id);
      return;
    }
    if (fe && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      select(f.id);
      return;
    }
    if (!/^Arrow/.test(e.key)) return;
    e.preventDefault();
    select(f.id);
    nudge(f, e);
  });
  document.addEventListener('keyup', (e) => {
    if (drag && e.key === 'Alt') {
      drag.alt = false;
      track();
      e.preventDefault();
    }
  });
  // A label is one step for as long as the sponsor stays in its box.
  document.addEventListener('focusout', (e) => {
    if (cur && e.target && e.target.matches && e.target.matches('.fe-props [data-k="label"]')) cur.st.merge = '';
  });

  /* ---------- Zoom, pages and size ---------- */
  function fitScale() {
    const maxW = Math.max.apply(null, cur.ctx.pages.map((p) => p.w));
    const pad = parseFloat(getComputedStyle(cur.doc).paddingLeft) || 0;
    return clamp((cur.scroll.clientWidth - 2 * pad) / maxW, 0.2, 2 * PT);
  }
  /** Every zoom the buttons step through, as pixels per point: the fit and the fixed levels, smallest first. */
  function zoomSteps() {
    return [fitScale()].concat(ZOOMS.map((z) => z * PT)).sort((a, b) => a - b);
  }
  function applyZoom() {
    const st = cur.st;
    const s = cur.scroll;
    const sc = st.zoom === 'fit' ? fitScale() : st.zoom * PT;
    // The middle of what is in view stays in the middle.
    const cy = s.scrollHeight ? (s.scrollTop + s.clientHeight / 2) / s.scrollHeight : 0;
    const cx = s.scrollWidth ? (s.scrollLeft + s.clientWidth / 2) / s.scrollWidth : 0;
    const was = st.scale;
    st.scale = sc;
    cur.doc.style.setProperty('--fe-scale', sc.toFixed(4));
    cur.rc = null;
    if (Math.abs(was - sc) > 1e-4) {
      s.scrollTop = cy * s.scrollHeight - s.clientHeight / 2;
      s.scrollLeft = cx * s.scrollWidth - s.clientWidth / 2;
    }
    hideGhost();
    positionTools();
    refreshBar();
  }
  function setZoom(z) {
    if (!live()) return;
    cur.st.zoom = z === 'fit' ? 'fit' : ZOOMS.indexOf(Number(z)) >= 0 ? Number(z) : 'fit';
    applyZoom();
  }
  function stepZoom(dir) {
    if (!live()) return;
    const steps = zoomSteps();
    const fit = fitScale();
    const now = cur.st.scale;
    const next = dir > 0 ? steps.find((v) => v > now + 1e-4) : steps.slice().reverse().find((v) => v < now - 1e-4);
    if (next == null) return;
    setZoom(Math.abs(next - fit) < 1e-4 ? 'fit' : next / PT);
  }
  function pageInView() {
    const v = cur.scroll.getBoundingClientRect();
    const p = target(v.left, v.top + Math.min(v.height * 0.4, 260), false);
    return p ? p.n : 1;
  }
  function goPage(n) {
    if (!live()) return;
    n = clamp(Math.round(Number(n)) || 1, 1, cur.ctx.pages.length);
    const pg = pageEl(n);
    if (!pg) return;
    const pad = parseFloat(getComputedStyle(cur.doc).paddingTop) || 0;
    cur.scroll.scrollTop += pg.getBoundingClientRect().top - cur.scroll.getBoundingClientRect().top - Math.min(pad, 16);
    cur.st.page = n;
    cur.rc = null;
    refreshBar();
  }
  function onScroll() {
    if (!live()) return;
    const st = cur.st;
    st.top = cur.scroll.scrollTop;
    st.left = cur.scroll.scrollLeft;
    cur.rc = null;
    hideGhost();
    if (drag) track();
    if (cur.tick) return;
    cur.tick = requestAnimationFrame(() => {
      if (!cur) return;
      cur.tick = 0;
      if (!live()) return;
      const n = pageInView();
      if (n !== cur.st.page) {
        cur.st.page = n;
        refreshBar();
      }
    });
  }
  /** The editor fills what is left of the screen under the page head, so the document scrolls inside it and the tools stay put. */
  function sizeUp() {
    const top = cur.root.getBoundingClientRect().top + window.scrollY;
    const gap = document.body.classList.contains('has-demo') ? 72 : 24;
    // Where the page around it scrolls (the console's menu on top), the editor takes a screenful; where the fields to add
    // lie across its top, it is never so low that the document is squeezed.
    const narrow = window.matchMedia('(max-width: 900px)').matches;
    const compact = window.matchMedia('(max-width: 1279px)').matches;
    const hgt = Math.round(narrow ? Math.max(440, window.innerHeight - gap - 12) : Math.max(compact ? 680 : 520, window.innerHeight - top - gap));
    if (hgt === cur.st.h && cur.sized) return;
    cur.sized = true;
    cur.st.h = hgt;
    cur.root.style.setProperty('--fe-h', hgt + 'px');
  }
  /** A page's image is loaded when the page comes near the part in view and let go when it is far from it. */
  function watch() {
    if (!('IntersectionObserver' in window)) return cur.doc.querySelectorAll('.es-page > img').forEach((img) => img.getAttribute('src') || (img.src = img.getAttribute('data-src')));
    cur.io = new IntersectionObserver(
      (list) =>
        list.forEach((en) => {
          const img = en.target.querySelector('img');
          if (!img) return;
          if (en.isIntersecting) {
            if (!img.getAttribute('src')) img.src = img.getAttribute('data-src');
          } else if (img.getAttribute('src')) img.removeAttribute('src');
        }),
      { root: cur.scroll, rootMargin: '200% 0px' }
    );
    cur.doc.querySelectorAll('.es-page').forEach((p) => cur.io.observe(p));
  }
  window.addEventListener('resize', () => {
    if (!live()) return;
    sizeUp();
    cur.rc = null;
  });

  /** Called after every render of the page: takes hold of the editor now on screen, or lets go when there is none. */
  function mount(ctx) {
    if (cur) {
      if (cur.ro) cur.ro.disconnect();
      if (cur.io) cur.io.disconnect();
      if (cur.tick) cancelAnimationFrame(cur.tick);
    }
    if (drag) cancelAnimationFrame(drag.raf);
    drag = null;
    press = null;
    ghost = null;
    const root = ctx ? document.querySelector('.es-editor.fe') : null;
    if (!root) {
      cur = null;
      return;
    }
    const st = stateOf(ctx.env);
    const q = (s) => root.querySelector(s);
    cur = { ctx, env: ctx.env, st, root, rail: q('.fe-rail'), bar: q('.fe-bar'), scroll: q('.fe-scroll'), doc: q('.fe-doc'), props: q('.fe-props'), carry: q('.fe-carry'), rc: null, over: null, guides: null, tick: 0, sized: false };
    // The fields may have been changed from outside the editor since it last looked (a field confirmed, say): that is a step too.
    const now = JSON.stringify(ctx.env.fields);
    if (st.last == null) st.last = now;
    else if (st.last !== now) {
      st.undo.push(st.last);
      if (st.undo.length > HISTORY) st.undo.shift();
      st.redo = [];
      st.last = now;
      st.merge = '';
    }
    sizeUp();
    if (!ctx.pages) return;
    applyZoom();
    cur.scroll.scrollTop = st.top;
    cur.scroll.scrollLeft = st.left;
    cur.scroll.addEventListener('scroll', onScroll, { passive: true });
    if ('ResizeObserver' in window) {
      cur.ro = new ResizeObserver(() => {
        if (!live() || drag) return;
        sizeUp();
        cur.rc = null;
        if (cur.st.zoom === 'fit') applyZoom();
        else positionTools();
      });
      cur.ro.observe(cur.scroll);
    }
    watch();
    decorate();
    st.page = pageInView();
    refreshBar();
    if (ctx.lines) ctx.lines(1); // start reading the text's baselines, so they are there for the first drag
  }

  /* ---------- Toolbar and field-toolbar actions ---------- */
  NS.actions['fe-undo'] = undo;
  NS.actions['fe-redo'] = redo;
  NS.actions['fe-zoom-in'] = () => stepZoom(1);
  NS.actions['fe-zoom-out'] = () => stepZoom(-1);
  NS.changes['fe-zoom'] = (el) => setZoom(el.value);
  NS.actions['fe-prev'] = () => live() && goPage(cur.st.page - 1);
  NS.actions['fe-next'] = () => live() && goPage(cur.st.page + 1);
  NS.changes['fe-page'] = (el) => {
    if (!live()) return;
    goPage(String(el.value).replace(/[^\d]/g, ''));
    el.value = String(cur.st.page);
  };
  NS.actions['fe-dup'] = () => duplicate();
  // On a small screen the properties open as a sheet over the document, from the selected field's toolbar.
  NS.actions['fe-props'] = () => {
    if (!live() || !selField()) return;
    cur.st.sheet = !cur.st.sheet;
    cur.root.classList.toggle('show-props', cur.st.sheet);
    const c = cur.st.sheet && cur.props.querySelector('select, input, button');
    if (c) c.focus({ preventScroll: true });
  };
  NS.actions['fe-props-close'] = () => {
    if (!live()) return;
    leaveSheet();
    const el = selField() && fieldEl(cur.ctx.ui.sel);
    if (el) el.focus({ preventScroll: true });
  };

  /** Select a field from outside the document (a list of fields to check, say) and bring it into view. */
  function show(id) {
    if (!live() || !fieldById(id)) return;
    select(id);
    const el = fieldEl(id);
    if (!el) return;
    reveal(el);
    el.focus({ preventScroll: true });
  }

  NS.fieldEditor = { html, mount, glyph, add, addHere, remove, duplicate, setProp, setTool, setSigner, undo, redo, setZoom, goPage, show, active: live };
})(window.CVPortal);
