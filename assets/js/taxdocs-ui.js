/*
 * Tax documents page (self-serve console, D-01, C-06): the CPA's file is taken in, a combined Schedule K-1 file is cut
 * into one package per K-1 in this browser, and a person confirms whose each package is. A confirmed document stays
 * hidden from every investor until it is delivered (plan 10-06): Deliver first lists who receives what, then hands each
 * document to NS.taxdocs.deliver, which refuses one nobody confirmed and holds one back while its investor has not
 * consented to electronic delivery (the send-on-paper list).
 *
 * Every decision about a page or a match is made by NS.taxdocs (taxdocs.js): this file reads each page's text items and
 * field values with the PDF reader, hands them over, and draws what it returns. Only packages NS.taxdocs.togetherIds
 * names are offered together; every other one is confirmed on its own, beside a picture of its own first page. A
 * confirmation cuts the package's pages into their own PDF first; when that fails nothing is confirmed.
 *
 * It keeps and shows the last four digits of a taxpayer number only ("ending 1234"); a number is never stored, logged or
 * written by this file (the pictures show the CPA's document as printed and are never stored). Values that came from a
 * file or from the workspace are escaped before they are drawn. No network call is made on any path.
 * The managed edition does not load this file.
 *
 * Sections later plans add (withholding, the investor's tax record, Form 1099, the link to the server) are their own
 * scripts beside this one, registered with NS.taxUI.part(key, { order, title, summary(ws) -> html or '',
 * render(ws, rest) -> html, shown(ws) -> boolean (optional; false: no line on the list) }): the list page draws each
 * summary line with a link to console-taxdocs-<key>, and that
 * address draws render() under the bar with Back. The scripts are a fixed list (PARTS), added in their order when this
 * file loads; one that does not load is left out for that visit and nothing is shown for it. No file name comes from data
 * or from the address.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION;
  const U = NS.ui;
  const { h } = U;
  const CK = () => NS.consoleKit;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const TD = () => NS.taxdocs;
  const ROUTE = 'console-taxdocs';
  const MAX_BYTES = 25 * 1024 * 1024;
  // The kinds a CPA's file can be: a Schedule K-1 (Form 1065) file is cut and matched by rule, every other one by hand.
  const KINDS = ['k1-1065', 'k1-other', '8805', '1042-s', 'letter'];
  // The picture beside a package, as page fractions: a K-1's Part I and Part II (the left column from the top of Part I
  // to the foot of Part II); the top half of the first page of anything else; a whole page.
  const CROP = { k1: { x: 0.03, y: 0.172, w: 0.48, h: 0.773 }, top: { x: 0, y: 0, w: 1, h: 0.5 }, page: { x: 0, y: 0, w: 1, h: 1 } };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const redraw = () => NS.app.render();
  const btn = (action, label, attrs, cls) => `<button type="button" class="cs-btn cs-btn-small${cls ? ' ' + cls : ''}" data-action="${action}"${attrs || ''}>${label}</button>`;
  const actor = () => NS.app.actor();

  /** What is open on the page now, kept across redraws and never stored. */
  function ui() {
    const u = S().ui;
    if (!u.tx) u.tx = { offeringId: '', kind: 'k1-1065', year: String(Number(NS.dates.today().slice(0, 4)) - 1), files: [], busy: false, err: '', pick: {}, msg: {}, working: false };
    return u.tx;
  }
  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o.id === id) || null;
  const fundName = (ws, id) => {
    const o = offeringOf(ws, id);
    return o ? o.name : id;
  };
  const investorOf = (ws, id) => (ws.investors || []).find((i) => i.id === id) || null;
  const holdersOf = (ws, offeringId) => (ws.investors || []).filter((i) => (i.positions || []).some((p) => p.offeringId === offeringId));
  /** The last four on record (the W-9's when there is one), as the proposal reads them; never a foreign number. */
  const recordLast4 = (inv) => {
    const v = String((inv && inv.taxCert && inv.taxCert.tinLast4) || (inv && inv.tinLast4) || '');
    return /^\d{4}$/.test(v) ? v : '';
  };
  const kindLabel = (k) => (TD().KINDS[k] || {}).label || k;
  const isAuto = (b) => !!(TD().KINDS[b.kind] || {}).auto;
  const pagesText = (p) => (p.first === p.last ? `Page ${p.first}` : `Pages ${p.first} to ${p.last}`);
  const batchOf = (ws, id) => ((ws.taxdocs || {}).batches || []).find((b) => b.id === id) || null;
  /** Ids with letters only, so no id can ever look like a number. */
  const letterId = (prefix) => prefix + Array.from({ length: 12 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');

  /* ---------- the PDF reader and writer (the copies shipped with the portal) ---------- */
  const reader = () => NS.esignKit.reader();
  /** Each page's facts, read one page at a time with script evaluation off; nothing the library returns is kept. */
  async function readPages(bytes) {
    const lib = await reader();
    const doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    const pages = [];
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const height = page.getViewport({ scale: 1 }).height;
        const it = TD().pdfItems(height, (await page.getTextContent()).items, await page.getAnnotations());
        pages.push(TD().pageFacts(it.text, it.fields));
        page.cleanup();
      }
    } finally {
      doc.destroy();
    }
    return pages;
  }
  // One open reader document per file's bytes while the page needs its pictures.
  const opened = new WeakMap();
  function pdfOf(bytes) {
    let p = opened.get(bytes);
    if (!p) {
      p = reader().then((lib) => lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise);
      opened.set(bytes, p);
      p.catch(() => opened.delete(bytes));
    }
    return p;
  }
  /** A picture of part of one page (crop: { x, y, w, h } as page fractions), as a data: address. Never stored. */
  async function pagePicture(bytes, pageNumber, crop) {
    const c = Object.assign({ x: 0, y: 0, w: 1, h: 1 }, crop || {});
    const doc = await pdfOf(bytes);
    const page = await doc.getPage(pageNumber);
    try {
      const v1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(3, 900 / (v1.width * c.w)) });
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(vp.width * c.w));
      cv.height = Math.max(1, Math.ceil(vp.height * c.h));
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, 1, -vp.width * c.x, -vp.height * c.y] }).promise;
      return cv.toDataURL('image/jpeg', 0.85);
    } finally {
      page.cleanup();
    }
  }
  // The CPA's file of each import, read from this browser's file store once per visit.
  const sources = new Map();
  function source(batchId) {
    if (!sources.has(batchId)) {
      const p = NS.ops.files.get(batchId).then((blob) => (blob ? blob.arrayBuffer().then((x) => new Uint8Array(x)) : null));
      sources.set(batchId, p);
      p.catch(() => sources.delete(batchId));
    }
    return sources.get(batchId);
  }
  /** Each package's pages as their own PDF, all cut before anything is confirmed. */
  async function cut(b, pkgs) {
    const bytes = await source(b.id).catch(() => null);
    if (!bytes) throw new Error('This file is no longer kept in this browser, so nothing was confirmed. Import it again.');
    try {
      const L = await NS.esignKit.writer();
      const src = await L.PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
      const out = [];
      for (const p of pkgs) {
        const pdf = await L.PDFDocument.create();
        const idx = [];
        for (let n = p.first; n <= p.last; n++) idx.push(n - 1);
        (await pdf.copyPages(src, idx)).forEach((pg) => pdf.addPage(pg));
        out.push(await pdf.save());
      }
      return out;
    } catch (e) {
      throw new Error('The pages could not be cut, so nothing was confirmed. Try again.');
    }
  }
  const isPdf = (bytes) => bytes.length > 4 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) === '%PDF-';

  /* ---------- sections other files add (NS.taxUI) ---------- */
  const HERE = (document.currentScript && document.currentScript.src) || '';
  // Only files that are shipped: a part not in the build would be asked for, and refused, on every page load
  // (06-WALKTHROUGH-3 failure 4). Plan 10-10 added 'tax1099-ui.js' after 'tax1099.js'; plan 10-12 adds 'taxlink.js' last.
  const PARTS = Object.freeze(['withholding.js', 'withholding-ui.js', 'taxdocs-investor.js', 'taxrecord-ui.js', 'tax1099.js', 'tax1099-ui.js']);
  const parts = {};
  const load = { settled: false, waiting: false };
  function part(key, spec) {
    if (!/^[a-z0-9]+$/.test(String(key)) || key === 'batch' || !spec || typeof spec.render !== 'function') return false;
    parts[key] = { key, order: Number(spec.order) || 0, title: String(spec.title || ''), summary: typeof spec.summary === 'function' ? spec.summary : null, render: spec.render, shown: typeof spec.shown === 'function' ? spec.shown : null };
    return true;
  }
  /** One script from beside this file; resolves to whether it loaded. */
  function script(name) {
    return new Promise((resolve) => {
      let src = '';
      try {
        src = HERE ? new URL(name, HERE).href : new URL(`assets/js/${name}`, document.baseURI).href;
      } catch (e) {
        return resolve(false);
      }
      const el = document.createElement('script');
      el.src = src;
      el.async = false;
      el.onload = () => resolve(true);
      el.onerror = () => {
        el.remove();
        resolve(false);
      };
      document.head.appendChild(el);
    });
  }
  const typing = () => {
    const a = document.activeElement;
    return !!(a && a.closest && a.closest('.tx') && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
  };
  /** Draw the page again (a section calls it after it registers or changes); never while a field on the page has focus. */
  function refresh() {
    if (S().route !== ROUTE) return;
    if (typing()) {
      load.waiting = true;
      return;
    }
    load.waiting = false;
    redraw();
  }
  document.addEventListener('focusout', () => {
    if (load.waiting) setTimeout(refresh, 0);
  });
  /** What a section gives, or '' when it fails: one section's fault never takes the page down. */
  function from(fn, ...args) {
    try {
      return fn(...args) || '';
    } catch (e) {
      if (window.console) console.error(e);
      return '';
    }
  }
  const API = { part, PARTS, refresh, link: null, reader, pagePicture };
  /** Whether the link to the server (set by its own script) is connected. */
  function connected(ws) {
    const l = API.link;
    try {
      return !!(l && typeof l.connected === 'function' && l.connected(ws));
    } catch (e) {
      if (window.console) console.error(e);
      return false;
    }
  }
  const linkLine = (ws, doc) => (doc && connected(ws) && typeof API.link.rowLine === 'function' ? from(API.link.rowLine, ws, doc) : '');
  const sorted = () => Object.values(parts).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  function partsHTML(ws) {
    // a section may say it has nothing for this workspace (shown(ws) false): no line on the list then (plan 10-10)
    const list = sorted().filter((x) => !x.shown || from(x.shown, ws));
    return list.length ? CK().panel('', `<ul class="tx-list" data-list="parts">${list.map((x) => `<li class="tx-row"><div class="tx-what"><a class="tx-title" href="#${ROUTE}-${x.key}">${h(x.title)}</a>${x.summary ? `<span class="tx-detail">${from(x.summary, ws)}</span>` : ''}</div></li>`).join('')}</ul>`) : '';
  }
  /** A section's page: console-taxdocs-<key>[-<rest>]; null when no such section is registered. */
  function partHTML(ws, param) {
    const m = /^([a-z0-9]+)(?:-(.*))?$/.exec(String(param || ''));
    if (!m || m[1] === 'batch' || !Object.prototype.hasOwnProperty.call(parts, m[1])) return null;
    const x = parts[m[1]];
    return `<div class="tx"><div class="tx-bar"><a class="tx-back" href="#${ROUTE}">Back</a><h1>${h(x.title)}</h1></div>${from(x.render, ws, m[2] || '')}</div>`;
  }

  /* ---------- taking a file in ---------- */
  /** One file taken in as one import; refused with one sentence (the file name is added by the caller). */
  async function takeIn(ws, f, u) {
    if (f.size > MAX_BYTES) throw new Error('it is over 25 MB.');
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (!isPdf(bytes)) throw new Error('it is not a PDF.');
    let pages;
    try {
      pages = await readPages(bytes);
    } catch (e) {
      throw new Error('it could not be read as a PDF.');
    }
    const by = actor();
    const batch = TD().addBatch(ws, { kind: u.kind, year: u.year, offeringId: u.offeringId, by, fileName: f.name, sourceSha256: NS.audit.sha256(bytes), pages: pages.length, split: TD().split(pages) });
    await NS.ops.files.put(batch.id, new Blob([bytes], { type: 'application/pdf' }));
    sources.set(batch.id, Promise.resolve(bytes));
    // Any other kind is one package per file; an account id in the file's name proposes that investor of the fund.
    if (!isAuto(batch)) TD().addPackage(ws, batch.id, { first: 1, last: pages.length, by, proposeId: NS.ops.matchIds(ws, f.name).find((id) => holdersOf(ws, batch.offeringId).some((i) => i.id === id)) || '' });
    return batch;
  }

  /* ---------- the list page ---------- */
  function importHTML(ws) {
    const u = ui();
    return CK().panel(
      'Import',
      `<div class="tx-form">
        <label class="cs-field" for="tx-fund"><span>Fund</span><select id="tx-fund" data-bind="tx:offeringId"><option value="">Choose</option>${(ws.offerings || []).map((o) => `<option value="${h(o.id)}"${o.id === u.offeringId ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select></label>
        <label class="cs-field" for="tx-kind"><span>Type</span><select id="tx-kind" data-bind="tx:kind">${KINDS.map((k) => `<option value="${k}"${k === u.kind ? ' selected' : ''}>${h(kindLabel(k))}</option>`).join('')}</select></label>
        <label class="cs-field" for="tx-year"><span>Tax year</span><input id="tx-year" type="number" inputmode="numeric" min="2000" max="2100" data-bind="tx:year" value="${h(u.year)}"></label>
        <label class="cs-field cs-wide" for="tx-files"><span>Files</span><input id="tx-files" type="file" multiple accept=".pdf,application/pdf" data-change="tx-files"><span class="cs-hint">${u.files.length ? h(u.files.map((f) => f.name).join(', ')) : 'PDF, up to 25 MB each'}</span></label>
      </div>
      ${u.err ? `<p class="tx-note is-stop" role="alert">${h(u.err)}</p>` : ''}
      <div class="cs-row"><button class="cs-btn cs-btn-primary" type="button" data-action="tx-import"${u.busy ? ' disabled aria-busy="true"' : ''}>${u.busy ? 'Importing…' : 'Import'}</button></div>`
    );
  }
  function batchRow(ws, b) {
    const open = b.packages.filter((p) => p.state === 'open').length;
    const aside = b.packages.filter((p) => p.state === 'aside').length;
    const done = b.packages.filter((p) => p.state === 'confirmed').length;
    const pill = open ? `<span class="tx-pill is-wait">${open} to confirm</span>` : b.packages.length ? `<span class="tx-pill is-ok">${done} confirmed</span>` : '<span class="tx-pill is-off">No packages</span>';
    return `<li class="tx-row" data-id="${h(b.id)}"><div class="tx-what"><a class="tx-title" href="#${ROUTE}-batch-${h(b.id)}">${h(b.fileName)}</a><span class="tx-detail">${h(kindLabel(b.kind))} ${h(b.year)} · ${h(fundName(ws, b.offeringId))} · ${plural(b.pages, 'page')}</span></div><div class="tx-when">${pill}${aside ? `<span class="tx-pill is-off">${aside} set aside</span>` : ''}</div></li>`;
  }
  function listHTML(ws) {
    const batches = ((ws.taxdocs || {}).batches || []).slice().reverse();
    const msg = ui().msg.main ? `<p class="tx-note is-stop" role="alert">${h(ui().msg.main)}</p>` : '';
    return `<div class="tx">${CK().head('Tax documents', '')}${msg}${importHTML(ws)}${paperHTML(ws)}${partsHTML(ws)}${batches.length ? CK().panel(`Imports <span class="cs-count">${batches.length}</span>`, `<ul class="tx-list">${batches.map((b) => batchRow(ws, b)).join('')}</ul>`) : ''}${contactHTML(ws)}</div>`;
  }

  /* ---------- one import ---------- */
  const BASIS = { 'number and name': 'Last four and name agree', 'number only': 'Last four agree; the name does not', 'name only': 'Name agrees; no number on the K-1', 'account ID in the file name': 'Account ID in the file name', 'by hand': 'Picked by hand' };
  const LOOK = { 'no text': 'has no text', 'another number': 'has another number', 'another name': 'names another investor' };
  const ending = (l4) => (l4 ? `ending ${h(l4)}` : 'no number');
  const invLine = (ws, id) => {
    const inv = investorOf(ws, id);
    return inv ? `${h(inv.title)} · ${h(inv.id)}${recordLast4(inv) ? ` · ending ${h(recordLast4(inv))}` : ''}` : '';
  };
  const on = (b, p) => ` data-batch="${h(b.id)}"${p ? ` data-id="${h(p.id)}"` : ''}`;
  const pkgTitle = (b, p) => (isAuto(b) ? `${h(p.name || 'No name read')} · ${ending(p.last4)}` : h(b.fileName));
  function lookLine(p) {
    const why = (p.lookWhy || []).map((w) => `page ${w.page} ${LOOK[w.why] || w.why}`);
    if (p.otherPartnership) why.unshift('another partnership’s K-1');
    return why.length ? `<p class="tx-note">Look first: ${h(why.join('; '))}.</p>` : '';
  }
  /** The investor a row will be confirmed for: the one picked on the page, else the one proposed. */
  const pickOf = (p) => {
    const u = ui();
    return Object.prototype.hasOwnProperty.call(u.pick, p.id) ? u.pick[p.id] : p.proposed.investorId;
  };
  function togetherRow(ws, b, p) {
    return `<li class="tx-row" data-id="${h(p.id)}"><div class="tx-what"><span class="tx-title">${pkgTitle(b, p)}</span><span class="tx-detail">${pagesText(p)} · ${invLine(ws, p.proposed.investorId)}</span></div><div class="tx-acts">${btn('tx-single', 'Not this one', on(b, p))}</div></li>`;
  }
  function singleRow(ws, b, p) {
    const prop = p.proposed.investorId;
    const pick = pickOf(p);
    const key = `${b.id}|${p.first}|${isAuto(b) ? 'k1' : 'top'}`;
    const url = pictures.get(key);
    const options = holdersOf(ws, b.offeringId)
      .slice()
      .sort((x, y) => String(x.title).localeCompare(String(y.title)))
      .map((i) => `<option value="${h(i.id)}"${i.id === pick ? ' selected' : ''}>${h(i.title)} · ${h(i.id)}</option>`)
      .join('');
    return `<li class="tx-row" data-id="${h(p.id)}">
      <div class="tx-what"><span class="tx-title">${pkgTitle(b, p)}</span><span class="tx-detail">${pagesText(p)}</span></div>
      <div class="tx-grid">
        <figure class="tx-pic"><img data-tx-pic="${h(key)}"${url ? ` src="${url}"` : ''} alt="${isAuto(b) ? 'Part I and Part II of this K-1' : 'The top of its first page'}"></figure>
        <div class="tx-what">
          <dl class="tx-review"><dt>Proposed</dt><dd>${prop ? invLine(ws, prop) : 'No investor proposed'}</dd>${prop ? `<dt>Why</dt><dd>${h(BASIS[p.proposed.basis] || p.proposed.basis)}</dd>` : ''}</dl>
          ${lookLine(p)}
          <div class="tx-form"><label class="cs-field cs-wide" for="tx-pick-${h(p.id)}"><span>Investor</span><select id="tx-pick-${h(p.id)}" data-change="tx-pick" data-id="${h(p.id)}"><option value="">Choose</option>${options}</select></label></div>
          <div class="tx-acts">${btn('tx-confirm', 'Confirm', on(b, p), 'cs-btn-primary')}${btn('tx-view', 'View pages', on(b, p))}${btn('tx-aside', 'Set aside', on(b, p))}</div>
        </div>
      </div>
    </li>`;
  }
  /** No package is open and no page outside a package needs one (a K-1 file's pages before its first K-1 never do). */
  function finished(b) {
    if (!b.packages.length || b.packages.some((p) => p.state === 'open')) return false;
    const cover = isAuto(b) && !b.scan ? Math.min(...b.packages.map((p) => p.first)) : 1;
    return b.loose.every((n) => n < cover);
  }
  function batchHTML(ws, b) {
    const auto = isAuto(b);
    const u = ui();
    const open = b.packages.filter((p) => p.state === 'open');
    const tog = new Set(auto ? TD().togetherIds(ws, b.id) : []);
    const together = open.filter((p) => tog.has(p.id));
    const single = open.filter((p) => !tog.has(p.id));
    const aside = b.packages.filter((p) => p.state === 'aside');
    const made = b.packages.filter((p) => p.docId).map((p) => ({ p, doc: (ws.docs || []).find((d) => d.id === p.docId) }));
    const used = new Set(b.packages.filter((p) => p.state !== 'aside').map((p) => p.investorId || p.proposed.investorId).filter(Boolean));
    const missing = auto ? holdersOf(ws, b.offeringId).filter((i) => !used.has(i.id)) : [];
    const list = (name, rows) => `<ul class="tx-list" data-list="${name}">${rows}</ul>`;
    const bar = `<div class="tx-bar"><a class="tx-back" href="#${ROUTE}">Back</a><h1>${h(kindLabel(b.kind))} ${h(b.year)}</h1></div>`;
    const msg = u.working ? '<p class="tx-note" role="status">Working…</p>' : u.msg[b.id] && !atDeliver(b) ? `<p class="tx-note is-stop" role="alert">${h(u.msg[b.id])}</p>` : '';
    const scan = b.scan ? `<p class="tx-stop">No text can be read in this file: ask the CPA for the file as the tax software saves it${auto ? ', or make each package from its pages below' : ''}.</p>` : '';
    const loose = b.loose.length
      ? CK().panel(
          'Pages with no package',
          `${list('loose', `<li class="tx-row"><div class="tx-what"><span class="tx-title">${b.loose.length === 1 ? `Page ${b.loose[0]}` : `Pages ${h(b.loose.join(', '))}`}</span></div></li>`)}${
            finished(b)
              ? ''
              : `<div class="tx-form"><label class="cs-field" for="tx-first"><span>First page</span><input id="tx-first" type="number" inputmode="numeric" min="1" max="${b.pages}"></label><label class="cs-field" for="tx-last"><span>Last page</span><input id="tx-last" type="number" inputmode="numeric" min="1" max="${b.pages}"></label>${btn('tx-range', 'Make package', on(b))}</div>`
          }`
        )
      : '';
    return `<div class="tx">${bar}<p class="tx-detail">${h(fundName(ws, b.offeringId))} · ${h(b.fileName)} · ${plural(b.pages, 'page')}</p>${msg}${scan}
      ${together.length ? CK().panel(`Confirm together <span class="cs-count">${together.length}</span>`, `${list('together', together.map((p) => togetherRow(ws, b, p)).join(''))}<div class="cs-row">${btn('tx-together', `Confirm ${together.length}`, on(b), 'cs-btn-primary')}</div>`) : ''}
      ${single.length ? CK().panel(`One by one <span class="cs-count">${single.length}</span>`, list('single', single.map((p) => singleRow(ws, b, p)).join(''))) : ''}
      ${loose}
      ${aside.length ? CK().panel(`Set aside <span class="cs-count">${aside.length}</span>`, list('aside', aside.map((p) => `<li class="tx-row" data-id="${h(p.id)}"><div class="tx-what"><span class="tx-title">${pkgTitle(b, p)}</span><span class="tx-detail">${pagesText(p)}</span></div><div class="tx-acts">${btn('tx-reopen', 'Reopen', on(b, p))}</div></li>`).join(''))) : ''}
      ${made.length && b.kind === '8805' ? '<p class="tx-note">Ask your CPA whether Form 8805 may be delivered electronically.</p>' : ''}
      ${made.some(({ doc }) => doc && doc.tax.state === 'confirmed') && missingContact(ws).length ? contactHTML(ws) : ''}
      ${made.length ? CK().panel(`Confirmed <span class="cs-count">${made.length}</span>`, deliverHTML(ws, b, made) + list('confirmed', made.map(({ p, doc }) => madeRow(ws, b, p, doc)).join(''))) : ''}
      ${missing.length ? CK().panel(`No K-1 in this file <span class="cs-count">${missing.length}</span>`, list('missing', missing.map((i) => `<li class="tx-row"><div class="tx-what"><span class="tx-title">${h(i.title)}</span><span class="tx-detail">${h(i.id)}</span></div></li>`).join(''))) : ''}
    </div>`;
  }

  /* ---------- pictures (drawn after the page, one at a time; kept in memory only) ---------- */
  const pictures = new Map();
  let drawing = false;
  async function drawPictures() {
    if (drawing) return;
    drawing = true;
    try {
      for (;;) {
        const img = Array.from(document.querySelectorAll('img[data-tx-pic]')).find((i) => !i.getAttribute('src') && !i.hasAttribute('data-tx-failed'));
        if (!img) break;
        const key = img.getAttribute('data-tx-pic');
        let url = pictures.get(key);
        if (!url) {
          const [batchId, page, crop] = key.split('|');
          try {
            const bytes = await source(batchId);
            url = bytes ? await pagePicture(bytes, Number(page), CROP[crop]) : '';
          } catch (e) {
            url = '';
          }
          if (url) pictures.set(key, url);
        }
        document.querySelectorAll('img[data-tx-pic]').forEach((i) => {
          if (i.getAttribute('data-tx-pic') !== key) return;
          if (url) i.setAttribute('src', url);
          else {
            i.setAttribute('data-tx-failed', '');
            i.alt = 'This picture could not be drawn. Use View pages.';
          }
        });
      }
    } finally {
      drawing = false;
    }
  }

  /* ---------- actions ---------- */
  NS.binders.tx = (key, v) => {
    const u = ui();
    u[key] = key === 'year' ? String(v) : v;
    u.err = '';
    if (key !== 'year') redraw();
  };
  NS.changes['tx-files'] = (el) => {
    const u = ui();
    u.files = Array.from(el.files || []);
    u.err = '';
    redraw();
  };
  NS.changes['tx-pick'] = (el) => {
    ui().pick[el.getAttribute('data-id')] = el.value;
  };
  NS.actions['tx-import'] = async () => {
    const u = ui();
    const ws = W();
    if (u.busy || !NS.app.can('operate')) return;
    u.err = !u.offeringId || !offeringOf(ws, u.offeringId) ? 'Choose the fund.' : !/^\d{4}$/.test(String(u.year)) ? 'The tax year must be four digits.' : !u.files.length ? 'Choose the file.' : '';
    if (u.err) return redraw();
    u.busy = true;
    redraw();
    const refused = [];
    for (const f of u.files) {
      try {
        await takeIn(ws, f, u);
      } catch (e) {
        refused.push(`${f.name}: ${e && e.message ? e.message : 'it could not be read as a PDF.'}`);
      }
    }
    NS.app.save(true);
    u.busy = false;
    u.files = [];
    u.err = refused.length ? `Not imported: ${refused.join(' ')}` : '';
    redraw();
  };
  /** The confirmed package's own PDF kept in the file store and its document made (hidden, not delivered). */
  async function keep(ws, b, p, bytes) {
    const id = letterId('txd-');
    await NS.ops.files.put(id, new Blob([bytes], { type: 'application/pdf' }));
    const inv = investorOf(ws, p.investorId);
    TD().toDocument(ws, b.id, p.id, { id, title: `${kindLabel(b.kind)} ${b.year}`, fileName: `${b.kind}-${b.year}-${inv ? inv.id : 'investor'}.pdf`, size: bytes.length, sha256: NS.audit.sha256(bytes), by: actor() });
  }
  /** When nothing is left to do with a file, the combined file leaves this browser's file store (its documents stay). */
  async function tidy(ws, b) {
    if (!finished(b)) return;
    const blob = await NS.ops.files.get(b.id).catch(() => null);
    if (!blob) return;
    await NS.ops.files.del(b.id).catch(() => {});
    sources.delete(b.id);
    CK().audit('Tax document file removed from this browser', `${b.fileName}: nothing is left to confirm; each confirmed document keeps its own file`, b.offeringId, b.id);
  }
  /** One action on an import: one at a time, its refusal said in one line, the workspace saved after it. */
  function act(fn) {
    return async (el) => {
      const u = ui();
      const ws = W();
      const b = batchOf(ws, el.getAttribute('data-batch'));
      if (!b || u.working || !NS.app.can('operate')) return;
      const p = el.getAttribute('data-id') ? b.packages.find((x) => x.id === el.getAttribute('data-id')) || null : null;
      // what was typed is read before the page is drawn again
      const val = (id) => String((document.getElementById(id) || {}).value || '').trim();
      const typed = { first: val('tx-first'), last: val('tx-last') };
      u.working = true;
      u.msg[b.id] = '';
      (u.msgBy || (u.msgBy = {}))[b.id] = el.getAttribute('data-action') || '';
      redraw();
      try {
        await fn(ws, b, p, typed);
      } catch (e) {
        u.msg[b.id] = (e && e.message) || 'That could not be done.';
      }
      await tidy(ws, b);
      u.working = false;
      NS.app.save(true);
      redraw();
    };
  }
  NS.actions['tx-confirm'] = act(async (ws, b, p) => {
    const investorId = pickOf(p);
    if (!investorId) throw new Error('Choose the investor first.');
    if (!(holdersOf(ws, b.offeringId).some((i) => i.id === investorId))) throw new Error('That investor does not hold this fund.');
    const [bytes] = await cut(b, [p]);
    TD().confirm(ws, b.id, p.id, { investorId, by: actor() });
    await keep(ws, b, p, bytes);
    delete ui().pick[p.id];
  });
  NS.actions['tx-together'] = act(async (ws, b) => {
    const ids = TD().togetherIds(ws, b.id);
    if (!ids.length) return;
    const pkgs = ids.map((id) => b.packages.find((p) => p.id === id));
    const cuts = await cut(b, pkgs);
    if (TD().togetherIds(ws, b.id).join() !== ids.join()) throw new Error('The list changed while the pages were cut, so nothing was confirmed. Try again.');
    TD().confirmTogether(ws, b.id, { by: actor() });
    for (let k = 0; k < pkgs.length; k++) await keep(ws, b, pkgs[k], cuts[k]);
  });
  NS.actions['tx-single'] = act(async (ws, b, p) => TD().notTogether(ws, b.id, p.id, { by: actor() }));
  NS.actions['tx-aside'] = act(async (ws, b, p) => TD().setAside(ws, b.id, p.id, { by: actor() }));
  NS.actions['tx-reopen'] = act(async (ws, b, p) => TD().reopen(ws, b.id, p.id, { by: actor() }));
  NS.actions['tx-range'] = act(async (ws, b, p, typed) => TD().addPackage(ws, b.id, { first: typed.first, last: typed.last, by: actor() }));
  NS.actions['tx-view'] = async (el) => {
    const ws = W();
    const b = batchOf(ws, el.getAttribute('data-batch'));
    const p = b && b.packages.find((x) => x.id === el.getAttribute('data-id'));
    if (!p) return;
    U.dialog(
      `<div class="dlg-head"><div><h2>${pagesText(p)}</h2><p>${h(b.fileName)}</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${U.icon('close')}</button></div></div><div class="dlg-body"><p class="empty">Loading…</p></div>`,
      'dlg-doc'
    );
    const body = document.querySelector('#dlg .dlg-body');
    const urls = [];
    try {
      const bytes = await source(b.id);
      if (!bytes) throw new Error('gone');
      for (let n = p.first; n <= p.last; n++) urls.push(await pagePicture(bytes, n, CROP.page));
    } catch (e) {
      if (body.isConnected) body.innerHTML = '<p class="empty">These pages cannot be shown here.</p>';
      return;
    }
    if (body.isConnected) body.innerHTML = `<div class="doc-pages" tabindex="0">${urls.map((u, k) => `<img class="doc-page" src="${u}" alt="Page ${p.first + k}">`).join('')}</div>`;
  };

  /* ---------- delivery (plan 10-06: D-01, C-06, C-08, TAX-04, TAX-05) ---------- */
  // NS.taxdocs decides every delivery, wait, paper step, withdrawal and open; this part lists, asks and draws what it
  // returns. The firm's contact is what the investor's consent names for withdrawals (Rev. Proc. 2012-17 section 5.05).
  const CONTACT = [['name', 'Name'], ['address', 'Mailing address'], ['phone', 'Telephone'], ['email', 'Email']];
  const CONTACT_WORDS = { name: 'name', address: 'mailing address', phone: 'telephone', email: 'email' };
  const STATE = { confirmed: ['Not delivered', 'is-wait'], waiting: ['Waiting for consent', 'is-wait'], paper: ['Sent on paper', 'is-off'], delivered: ['Delivered', 'is-ok'], replaced: ['Replaced', 'is-off'], withdrawn: ['Withdrawn', 'is-stop'] };
  const GIVEN = ['waiting', 'delivered', 'paper'];
  const longDay = (iso) => U.date(String(iso || '').slice(0, 10), 'long');
  const andList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
  function dv() {
    const u = ui();
    if (!u.dv) u.dv = { list: {}, replace: {}, row: null };
    return u.dv;
  }
  const contactSaved = (ws) => (ws.taxdocs || {}).contact || {};
  const missingContact = (ws) => CONTACT.map(([k]) => k).filter((k) => !contactSaved(ws)[k]);
  /** The contact as saved; before anything is saved, the name, telephone and email of the firm's support details. */
  function contactDraft(ws) {
    const c = contactSaved(ws);
    if (CONTACT.some(([k]) => c[k])) return c;
    const sup = (ws.tenant && ws.tenant.support) || {};
    return { name: sup.team || '', address: '', phone: sup.phone || '', email: sup.email || '' };
  }
  function contactHTML(ws) {
    const c = contactDraft(ws);
    const ops = NS.app.can('operate');
    const type = { email: 'email', phone: 'tel' };
    return CK().panel(
      'Contact for tax documents',
      `<div class="tx-form">${CONTACT.map(([k, label]) => `<label class="cs-field${k === 'address' ? ' cs-wide' : ''}" for="tx-c-${k}"><span>${label}</span><input id="tx-c-${k}" type="${type[k] || 'text'}" value="${h(c[k] || '')}"${ops ? '' : ' readonly'}></label>`).join('')}</div>${ops ? `<div class="cs-row">${btn('tx-contact', 'Save')}</div>` : ''}`
    );
  }
  /** Every offering, kind and year that has a tax document. */
  function slots(ws) {
    const seen = {};
    return (ws.docs || [])
      .filter((d) => d.tax)
      .map((d) => ({ offeringId: d.offeringId, kind: d.tax.kind, year: d.tax.year }))
      .filter((q) => {
        const k = `${q.offeringId}|${q.kind}|${q.year}`;
        return seen[k] ? false : (seen[k] = true);
      });
  }
  /** Send on paper (sections 5.02, 7.02 and 10): every document owed on paper, from NS.taxdocs.lists. */
  function paperHTML(ws) {
    if (!(ws.taxdocs || {}).batches && !(ws.docs || []).some((d) => d.tax)) return '';
    const rows = slots(ws).reduce((out, q) => out.concat(TD().lists(ws, q).paper), []);
    if (!rows.length) return '';
    const ops = NS.app.can('operate');
    const today = NS.dates.today();
    const row = ({ doc, why, dueBy }) =>
      `<li class="tx-row" data-id="${h(doc.id)}"><div class="tx-what"><span class="tx-title">${invLine(ws, doc.investors[0])}</span><span class="tx-detail">${h(kindLabel(doc.tax.kind))} ${h(doc.tax.year)} · ${h(fundName(ws, doc.offeringId))} · ${why === 'no consent' ? 'No consent to electronic delivery' : `Notice came back on ${h(longDay(doc.tax.notice.bounced))}`}${dueBy ? ` · paper due by ${h(longDay(dueBy))}` : ''}</span>${
        ops ? `<div class="tx-form"><label class="cs-field" for="tx-paper-${h(doc.id)}"><span>Sent on</span><input id="tx-paper-${h(doc.id)}" type="date" value="${h(today)}"></label>${btn('tx-paper', 'Mark sent on paper', ` data-doc="${h(doc.id)}"`)}</div>` : ''
      }</div></li>`;
    return CK().panel(`Send on paper <span class="cs-count">${rows.length}</span>`, `<ul class="tx-list" data-list="paper">${rows.map(row).join('')}</ul>`);
  }
  function opensText(o) {
    if (!o || !o.count) return 'Not opened';
    return o.count === 1 ? `Opened once on ${longDay(o.first)}` : `Opened ${o.count} times, first ${longDay(o.first)}, last ${longDay(o.last)}`;
  }
  /** The document this investor has now for the same offering, kind and year (what an amended one replaces), or null. */
  function earlierOf(ws, doc) {
    return (ws.docs || []).find((d) => d !== doc && d.tax && (d.investors || [])[0] === (doc.investors || [])[0] && d.offeringId === doc.offeringId && d.tax.kind === doc.tax.kind && d.tax.year === doc.tax.year && GIVEN.indexOf(d.tax.state) >= 0) || null;
  }
  const givenOn = (d) => d.tax.deliveredAt || (d.tax.paper && d.tax.paper.sentOn) || d.date;
  const docAttr = (doc) => ` data-doc="${h(doc.id)}"`;
  /** The notice of section 7.01 as NS.taxdocs.notice gives it, with Copy and a link that opens the sponsor's own email. */
  function noticeHTML(ws, doc) {
    const n = TD().notice(ws, doc);
    const inv = investorOf(ws, doc.investors[0]) || {};
    const to = inv.email || '';
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(n.subject)}&body=${encodeURIComponent(n.body.replace(/\r?\n/g, '\r\n'))}`;
    return `<div class="tx-notice"${docAttr(doc)}><dl class="tx-review"><dt>To</dt><dd>${h(inv.contact || inv.title || '')}${to ? ` &lt;${h(to)}&gt;` : ''}</dd><dt>Subject</dt><dd>${h(n.subject)}</dd></dl>${n.body
      .split('\n\n')
      .map((x) => `<p class="tx-detail">${h(x)}</p>`)
      .join('')}<div class="tx-acts">${btn('tx-notice-copy', 'Copy', docAttr(doc))}<a class="cs-btn cs-btn-small" href="${h(href)}">Email</a></div></div>`;
  }
  /** One confirmed package's row: its document's state, dates and opens, and what may be done with it. */
  function madeRow(ws, b, p, doc) {
    const head = `<div class="tx-what"><span class="tx-title">${invLine(ws, p.investorId)}</span><span class="tx-detail">${pagesText(p)} · ${h(BASIS[p.basis] || p.basis)} · ${h(p.confirmedBy)}</span>`;
    if (!doc) return `<li class="tx-row" data-id="${h(p.id)}">${head}</div></li>`;
    const t = doc.tax;
    const [label, cls] = STATE[t.state] || [t.state, 'is-off'];
    const ops = NS.app.can('operate');
    const facts = [];
    if (['delivered', 'replaced', 'withdrawn'].indexOf(t.state) >= 0 && t.deliveredAt) {
      if (t.availableUntil) facts.push(`Available until ${longDay(t.availableUntil)}`);
      facts.push(opensText(t.opens));
    }
    if (t.state === 'replaced' && t.replacedAt) facts.push(`Replaced on ${longDay(t.replacedAt)}`);
    if (t.state === 'withdrawn' && t.withdrawn) facts.push(`Withdrawn on ${longDay(t.withdrawn.at)}: ${t.withdrawn.why}`);
    if (t.paper && t.paper.sentOn) facts.push(`Sent on paper on ${longDay(t.paper.sentOn)}`);
    if (t.notice && t.notice.bounced && !t.paper) facts.push(`Notice came back on ${longDay(t.notice.bounced)}; paper due by ${longDay(t.notice.paperBy)}`);
    if (t.replaces) facts.push('Replaces an earlier document');
    const earlier = ops && t.state === 'confirmed' ? earlierOf(ws, doc) : null;
    const tick = earlier ? `<label class="tx-note"><input type="checkbox" data-change="tx-replaces" data-id="${h(doc.id)}"${dv().replace[doc.id] ? ' checked' : ''}> This replaces the document delivered on ${h(longDay(givenOn(earlier)))}</label>` : '';
    const acts = [];
    if (ops && t.state === 'delivered') acts.push(btn('tx-notice', 'Notice', docAttr(doc)), btn('tx-bounce', 'Notice came back', docAttr(doc)));
    if (NS.app.can('configure') && ['confirmed', 'waiting', 'delivered'].indexOf(t.state) >= 0) acts.push(btn('tx-withdraw', 'Withdraw', docAttr(doc)));
    const f = dv().row && dv().row.id === doc.id ? dv().row.what : '';
    const today = NS.dates.today();
    const form =
      f === 'notice' && t.state === 'delivered'
        ? noticeHTML(ws, doc)
        : f === 'bounce' && t.state === 'delivered'
          ? `<div class="tx-form"><label class="cs-field" for="tx-bounce-date"><span>Came back on</span><input id="tx-bounce-date" type="date" value="${h(today)}"></label>${btn('tx-bounce-go', 'Save', docAttr(doc), 'cs-btn-primary')}${btn('tx-row-close', 'Cancel', docAttr(doc))}</div>`
          : f === 'withdraw' && NS.app.can('configure')
            ? `<div class="tx-form"><label class="cs-field cs-wide" for="tx-why"><span>Reason</span><input id="tx-why" type="text"></label>${btn('tx-withdraw-go', 'Withdraw document', docAttr(doc), 'cs-btn-primary')}${btn('tx-row-close', 'Cancel', docAttr(doc))}</div>`
            : '';
    return `<li class="tx-row" data-id="${h(p.id)}">${head}${facts.length ? `<span class="tx-detail">${h(facts.join(' · '))}</span>` : ''}${linkLine(ws, doc)}${tick}${acts.length ? `<div class="tx-acts">${acts.join('')}</div>` : ''}${form}</div><div class="tx-when"><span class="tx-pill ${cls}">${label}</span></div></li>`;
  }
  // A refusal of Deliver (or of Deliver to these) is said under its button, where the person pressed it: on a phone the
  // top of the page is out of view and the press looked dead (06-WALKTHROUGH-3 failure 6). Other refusals stay at the top.
  const atDeliver = (b) => /^tx-deliver/.test((ui().msgBy || {})[b.id] || '');
  /** Deliver: first the list of who receives what (D-01), then one action. Only confirmed documents are offered. */
  function deliverHTML(ws, b, made) {
    const ready = made.filter(({ doc }) => doc && doc.tax.state === 'confirmed').map(({ doc }) => doc);
    const own = made.some(({ doc }) => doc && doc.tax.state === 'delivered') && !connected(ws) ? '<p class="tx-note">No server is connected, so you send each notice from your own email: choose Notice on its row.</p>' : '';
    const why = !ui().working && ui().msg[b.id] && atDeliver(b) ? `<p class="tx-note is-stop" role="alert">${h(ui().msg[b.id])}</p>` : '';
    if (!NS.app.can('operate') || !ready.length) return why + own;
    if (!dv().list[b.id]) return `<div class="cs-row">${btn('tx-deliver', `Deliver ${ready.length}`, on(b), 'cs-btn-primary')}</div>${why}${own}`;
    const rows = ready
      .map((doc) => {
        const inv = investorOf(ws, doc.investors[0]);
        const e = dv().replace[doc.id] ? earlierOf(ws, doc) : null;
        return `<li class="tx-row" data-id="${h(doc.id)}"><div class="tx-what"><span class="tx-title">${inv ? `${h(inv.title)} · ${h(inv.id)}` : h(doc.investors[0])}</span><span class="tx-detail">${h(kindLabel(doc.tax.kind))} ${h(doc.tax.year)}${e ? ` · replaces the document delivered on ${h(longDay(givenOn(e)))}` : ''}</span></div></li>`;
      })
      .join('');
    return `<ul class="tx-list" data-list="recipients">${rows}</ul><div class="cs-row">${btn('tx-deliver-go', `Deliver to these ${ready.length}`, on(b), 'cs-btn-primary')}${btn('tx-deliver-cancel', 'Cancel', on(b))}</div>${why}${own}`;
  }
  NS.changes['tx-replaces'] = (el) => {
    dv().replace[el.getAttribute('data-id')] = !!el.checked;
    redraw();
  };
  NS.actions['tx-contact'] = () => {
    const ws = W();
    if (!NS.app.can('operate')) return;
    const val = (k) => String((document.getElementById(`tx-c-${k}`) || {}).value || '').trim();
    TD().setContact(ws, { name: val('name'), address: val('address'), phone: val('phone'), email: val('email') });
    ui().msg.main = '';
    // a refusal of Deliver for want of the contact no longer holds once it is saved
    Object.keys(ui().msg).forEach((k) => /^Before delivering, save the Contact/.test(ui().msg[k] || '') && (ui().msg[k] = ''));
    NS.app.save(true);
    redraw();
  };
  NS.actions['tx-deliver'] = act(async (ws, b) => {
    const miss = missingContact(ws);
    if (miss.length) throw new Error(`Before delivering, save the Contact for tax documents with its ${andList(miss.map((k) => CONTACT_WORDS[k]))}.`);
    dv().list[b.id] = true;
  });
  NS.actions['tx-deliver-cancel'] = act(async (ws, b) => {
    dv().list[b.id] = false;
  });
  NS.actions['tx-deliver-go'] = act(async (ws, b) => {
    const docs = b.packages.map((p) => p.docId && (ws.docs || []).find((d) => d.id === p.docId)).filter((d) => d && d.tax && d.tax.state === 'confirmed');
    const how = connected(ws) ? 'email' : 'own email';
    const refused = [];
    const sent = [];
    for (const d of docs) {
      const e = dv().replace[d.id] ? earlierOf(ws, d) : null;
      try {
        TD().deliver(ws, d.id, { by: actor(), how, replaces: e ? e.id : '' });
        delete dv().replace[d.id];
        if (d.tax.state === 'delivered') sent.push(d);
      } catch (err) {
        if (refused.indexOf(err.message) < 0) refused.push(err.message);
      }
    }
    dv().list[b.id] = false;
    if (connected(ws) && typeof API.link.send === 'function') {
      for (const d of sent) {
        try {
          await API.link.send(ws, d);
        } catch (err) {
          if (window.console) console.error(err);
        }
      }
    }
    if (refused.length) throw new Error(`Not delivered: ${refused.join(' ')}`);
  });
  /** An action on one tax document: one at a time, its refusal said in one line, the workspace saved after it. */
  function docAct(fn, need) {
    return async (el) => {
      const u = ui();
      const ws = W();
      const doc = (ws.docs || []).find((d) => d.id === el.getAttribute('data-doc') && d.tax);
      if (!doc || u.working || !NS.app.can(need || 'operate')) return;
      const key = /^batch-/.test(String(S().param || '')) && doc.tax.batch ? doc.tax.batch : 'main';
      const val = (id) => String((document.getElementById(id) || {}).value || '').trim();
      const typed = { date: val('tx-bounce-date'), why: val('tx-why'), sent: val(`tx-paper-${doc.id}`) };
      u.working = true;
      u.msg[key] = '';
      (u.msgBy || (u.msgBy = {}))[key] = el.getAttribute('data-action') || '';
      redraw();
      try {
        await fn(ws, doc, typed);
      } catch (e) {
        u.msg[key] = (e && e.message) || 'That could not be done.';
      }
      u.working = false;
      NS.app.save(true);
      redraw();
    };
  }
  const rowForm = (what, need) => (el) => {
    if (!NS.app.can(need || 'operate')) return;
    const id = el.getAttribute('data-doc');
    const r = dv().row;
    dv().row = r && r.id === id && r.what === what ? null : { id, what };
    redraw();
  };
  NS.actions['tx-notice'] = rowForm('notice');
  NS.actions['tx-bounce'] = rowForm('bounce');
  NS.actions['tx-withdraw'] = rowForm('withdraw', 'configure');
  NS.actions['tx-row-close'] = () => {
    dv().row = null;
    redraw();
  };
  NS.actions['tx-bounce-go'] = docAct(async (ws, doc, t) => {
    TD().bounced(ws, doc.id, t.date);
    dv().row = null;
  });
  NS.actions['tx-withdraw-go'] = docAct(async (ws, doc, t) => {
    TD().withdraw(ws, doc.id, { by: actor(), why: t.why });
    dv().row = null;
  }, 'configure');
  NS.actions['tx-paper'] = docAct(async (ws, doc, t) => {
    TD().markPaper(ws, doc.id, { sentOn: t.sent, by: actor() });
  });
  NS.actions['tx-notice-copy'] = (el) => {
    const ws = W();
    const doc = (ws.docs || []).find((d) => d.id === el.getAttribute('data-doc') && d.tax);
    if (!doc) return;
    const n = TD().notice(ws, doc);
    U.copy(`${n.subject}\n\n${n.body}`, el.closest('.tx-notice'));
  };

  /* ---------- the page ---------- */
  if (E.diy) {
    NS.views['console-taxdocs'] = {
      mode: 'console',
      edition: 'diy',
      render(param) {
        const ws = W();
        const m = /^batch-(.+)$/.exec(String(param || ''));
        const b = m ? batchOf(ws, m[1]) : null;
        if (b) return CK().shell(batchHTML(ws, b), ROUTE);
        const sec = param && !m ? partHTML(ws, param) : null;
        if (sec) return CK().shell(sec, ROUTE);
        // A section's address before the scripts have settled: wait for them. Afterwards an unknown address shows the list.
        if (param && !m && !load.settled) return CK().shell(`<div class="tx"><div class="tx-bar"><a class="tx-back" href="#${ROUTE}">Back</a><h1>Tax documents</h1></div><p class="cs-muted" role="status">Loading…</p></div>`, ROUTE);
        return CK().shell(listHTML(ws), ROUTE);
      },
      after() {
        drawPictures();
      }
    };
    (async () => {
      for (const name of PARTS) await script(name);
      load.settled = true;
      refresh();
    })();
  }
  NS.taxUI = API;
})(window.CVPortal);
