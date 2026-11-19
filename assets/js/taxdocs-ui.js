/*
 * Tax documents page (self-serve console, D-01, C-06): the CPA's file is taken in, a combined Schedule K-1 file is cut
 * into one package per K-1 in this browser, and a person confirms whose each package is. Nothing here delivers a
 * document: a confirmed document stays hidden from every investor until it is delivered on this page by a later step.
 *
 * Every decision about a page or a match is made by NS.taxdocs (taxdocs.js): this file reads each page's text items and
 * field values with the PDF reader, hands them over, and draws what it returns. It keeps and shows the last four digits
 * of a taxpayer number only ("ending 1234"); a number is never stored, logged or written by this file. Values that came
 * from a file or from the workspace are escaped before they are drawn. No network call is made on any path.
 * The managed edition does not load this file.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION;
  const U = NS.ui;
  const { h, date } = U;
  const CK = () => NS.consoleKit;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const TD = () => NS.taxdocs;
  const ROUTE = 'console-taxdocs';
  const MAX_BYTES = 25 * 1024 * 1024;
  // The kinds a CPA's file can be: a Schedule K-1 (Form 1065) file is cut and matched by rule, every other one by hand.
  const KINDS = ['k1-1065', 'k1-other', '8805', '1042-s', 'letter'];
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const redraw = () => NS.app.render();
  const btn = (action, label, attrs, cls) => `<button type="button" class="cs-btn cs-btn-small${cls ? ' ' + cls : ''}" data-action="${action}"${attrs || ''}>${label}</button>`;

  /** What is open on the page now, kept across redraws and never stored. */
  function ui() {
    const u = S().ui;
    if (!u.tx) u.tx = { offeringId: '', kind: 'k1-1065', year: String(Number(NS.dates.today().slice(0, 4)) - 1), files: [], busy: false, err: '' };
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
  const pagesText = (p) => (p.first === p.last ? `Page ${p.first}` : `Pages ${p.first} to ${p.last}`);
  const batchOf = (ws, id) => ((ws.taxdocs || {}).batches || []).find((b) => b.id === id) || null;

  /* ---------- reading a file ---------- */
  /** The PDF reader library (the copy shipped with the portal). */
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
  const isPdf = (bytes) => bytes.length > 4 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) === '%PDF-';
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
    const batch = TD().addBatch(ws, { kind: u.kind, year: u.year, offeringId: u.offeringId, by: NS.app.actor(), fileName: f.name, sourceSha256: NS.audit.sha256(bytes), pages: pages.length, split: TD().split(pages) });
    await NS.ops.files.put(batch.id, new Blob([bytes], { type: 'application/pdf' }));
    return batch;
  }

  /* ---------- the list page ---------- */
  function importHTML(ws) {
    const u = ui();
    const funds = ws.offerings || [];
    return CK().panel(
      'Import',
      `<div class="tx-form">
        <label class="cs-field" for="tx-fund"><span>Fund</span><select id="tx-fund" data-bind="tx:offeringId"><option value="">Choose</option>${funds.map((o) => `<option value="${h(o.id)}"${o.id === u.offeringId ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select></label>
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
    return `<div class="tx">${CK().head('Tax documents', '')}${importHTML(ws)}${batches.length ? CK().panel(`Imports <span class="cs-count">${batches.length}</span>`, `<ul class="tx-list">${batches.map((b) => batchRow(ws, b)).join('')}</ul>`) : ''}</div>`;
  }

  /* ---------- one import ---------- */
  const BASIS = { 'number and name': 'Last four and name agree', 'number only': 'Last four agree; the name does not', 'name only': 'Name agrees; no number on the K-1', 'by hand': 'Picked by hand' };
  const LOOK = { 'no text': 'has no text', 'another number': 'has another number', 'another name': 'names another investor' };
  const ending = (l4) => (l4 ? `ending ${h(l4)}` : 'no number');
  const invLine = (ws, id) => {
    const inv = investorOf(ws, id);
    return inv ? `${h(inv.title)} · ${h(inv.id)}${recordLast4(inv) ? ` · ending ${h(recordLast4(inv))}` : ''}` : '';
  };
  function lookLine(p) {
    const why = (p.lookWhy || []).map((w) => `page ${w.page} ${LOOK[w.why] || w.why}`);
    if (p.otherPartnership) why.unshift('another partnership’s K-1');
    return why.length ? `<p class="tx-note">Look first: ${h(why.join('; '))}.</p>` : '';
  }
  function togetherRow(ws, p) {
    return `<li class="tx-row" data-id="${h(p.id)}"><div class="tx-what"><span class="tx-title">${h(p.name || 'No name')} · ${ending(p.last4)}</span><span class="tx-detail">${pagesText(p)} · ${invLine(ws, p.proposed.investorId)}</span></div></li>`;
  }
  function singleRow(ws, b, p) {
    const prop = p.proposed.investorId;
    return `<li class="tx-row" data-id="${h(p.id)}"><div class="tx-what"><span class="tx-title">${h(p.name || 'No name read')} · ${ending(p.last4)}</span><span class="tx-detail">${pagesText(p)} · ${prop ? `${invLine(ws, prop)} · ${h(BASIS[p.proposed.basis] || p.proposed.basis)}` : 'No investor proposed'}</span></div>${lookLine(p)}</li>`;
  }
  function batchHTML(ws, b) {
    const auto = !!(TD().KINDS[b.kind] || {}).auto;
    const open = b.packages.filter((p) => p.state === 'open');
    const tog = new Set(auto ? TD().togetherIds(ws, b.id) : []);
    const together = open.filter((p) => tog.has(p.id));
    const single = open.filter((p) => !tog.has(p.id));
    const aside = b.packages.filter((p) => p.state === 'aside');
    const used = new Set(b.packages.filter((p) => p.state !== 'aside').map((p) => p.investorId || p.proposed.investorId).filter(Boolean));
    const missing = auto ? holdersOf(ws, b.offeringId).filter((i) => !used.has(i.id)) : [];
    const list = (name, rows) => `<ul class="tx-list" data-list="${name}">${rows}</ul>`;
    const bar = `<div class="tx-bar"><a class="tx-back" href="#${ROUTE}">Back</a><h1>${h(kindLabel(b.kind))} ${h(b.year)}</h1></div>`;
    const head = `<p class="tx-detail">${h(fundName(ws, b.offeringId))} · ${h(b.fileName)} · ${plural(b.pages, 'page')}</p>`;
    return `<div class="tx">${bar}${head}
      ${together.length ? CK().panel(`Confirm together <span class="cs-count">${together.length}</span>`, list('together', together.map((p) => togetherRow(ws, p)).join(''))) : ''}
      ${single.length ? CK().panel(`One by one <span class="cs-count">${single.length}</span>`, list('single', single.map((p) => singleRow(ws, b, p)).join(''))) : ''}
      ${b.loose.length ? CK().panel('Pages with no package', list('loose', `<li class="tx-row"><div class="tx-what"><span class="tx-title">${b.loose.length === 1 ? `Page ${b.loose[0]}` : `Pages ${h(b.loose.join(', '))}`}</span></div></li>`)) : ''}
      ${aside.length ? CK().panel(`Set aside <span class="cs-count">${aside.length}</span>`, list('aside', aside.map((p) => `<li class="tx-row" data-id="${h(p.id)}"><div class="tx-what"><span class="tx-title">${h(p.name || 'No name read')} · ${ending(p.last4)}</span><span class="tx-detail">${pagesText(p)}</span></div></li>`).join(''))) : ''}
      ${missing.length ? CK().panel(`No K-1 in this file <span class="cs-count">${missing.length}</span>`, list('missing', missing.map((i) => `<li class="tx-row"><div class="tx-what"><span class="tx-title">${h(i.title)}</span><span class="tx-detail">${h(i.id)}</span></div></li>`).join(''))) : ''}
    </div>`;
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

  /* ---------- the page ---------- */
  if (E.diy) {
    NS.views['console-taxdocs'] = {
      mode: 'console',
      edition: 'diy',
      render(param) {
        const ws = W();
        const m = /^batch-(.+)$/.exec(String(param || ''));
        const b = m ? batchOf(ws, m[1]) : null;
        return CK().shell(b ? batchHTML(ws, b) : listHTML(ws), ROUTE);
      }
    };
  }
})(window.CVPortal);
