/*
 * Investor reports: the builder's screens (phase 12, plan 12-06). A tab "Investor reports" on the self-serve Reports page
 * (C-03; the managed edition does not load this file, C-08): the template list, the editor, the preview drawn from the
 * same layout model the PDF is drawn from (NS.reports.resolve), the PDF drawn in the page, and downloads of the PDF and
 * the spreadsheet.
 *
 * The report modules are loaded as parts from beside this file, in order, when it loads (PARTS; only shipped files may be
 * listed); the spreadsheet writer (filesout.js) is loaded the first time a spreadsheet is asked for. No file name comes from
 * data or from the address, and no request leaves the page's own address.
 *
 * Every value from the workspace is escaped before it is drawn. Wording is kept only as NS.reports' block model.
 *
 * Plan 12-08 adds its sections under the preview with NS.reportsUI.part(key, { order, render(ws, ctx) -> html }), where
 * ctx = { template, spec, audience, recipients, previewId, model, errors }.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION;
  const U = NS.ui;
  const h = (s) => NS.brand.esc(s);
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const R = () => NS.reports;
  const CK = () => NS.consoleKit;
  const ROUTE = 'console-reports';
  const TYPE_LABELS = {
    statement: 'Capital account statement',
    distribution: 'Distribution notice',
    quarterly: 'Quarterly letter',
    annual: 'Annual review',
    performance: 'Performance and holdings',
    tax: 'Tax-season summary'
  };
  const TYPE_ORDER = ['statement', 'distribution', 'quarterly', 'annual', 'performance', 'tax'];
  const PERIOD_TYPES = { statement: 1, quarterly: 1, annual: 1, performance: 1 };
  const LINE_506 = 'Rule 506 offerings have no federal duty to send periodic reports; your fund documents say what you owe. To be confirmed with counsel.';

  /* ---------- the parts: the report modules, loaded from beside this file ---------- */
  const HERE = (document.currentScript && document.currentScript.src) || '';
  // Only files that are shipped. Plan 12-08 adds 'reports-templates.js', 'reports-run.js' and 'reports-deliver.js'.
  const PARTS = Object.freeze(['reports-data.js', 'reports.js', 'reports-pdf.js', 'reports-record.js', 'reports-templates.js', 'reports-run.js', 'reports-deliver.js']);
  const load = { settled: false, failed: false };
  const extra = {};
  const near = (name) => (HERE ? new URL(name, HERE).href : new URL(`assets/js/${name}`, document.baseURI).href);
  function script(name) {
    return new Promise((resolve) => {
      let src = '';
      try {
        src = near(name);
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
  /** A section another plan adds under the preview. */
  function part(key, spec) {
    if (!/^[a-z][a-z0-9]*$/.test(String(key)) || !spec || typeof spec.render !== 'function') return false;
    extra[key] = { key, order: Number(spec.order) || 0, render: spec.render };
    refresh();
    return true;
  }
  const typing = () => {
    const a = document.activeElement;
    return !!(a && a.closest && a.closest('.rb') && (/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) || a.isContentEditable));
  };
  let waiting = false;
  /** Draw the page again when the tab is showing; never while a field of the tab has focus. */
  function refresh() {
    if (!S() || S().route !== ROUTE || !S().ui.rep || S().ui.rep.tab !== 'investor') return;
    if (typing()) {
      waiting = true;
      return;
    }
    waiting = false;
    NS.app.render();
  }
  document.addEventListener('focusout', () => {
    if (waiting) setTimeout(refresh, 0);
  });

  /* ---------- state ---------- */
  function st() {
    const ui = S().ui;
    if (!ui.rb) ui.rb = { view: 'list', id: '', draft: null, spec: null, pdf: null, busy: '', msg: '', del: '', nw: { type: 'quarterly', start: 'quarterly', name: '', scope: 'firm', offs: [] } };
    return ui.rb;
  }
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const templates = (ws) => (ws.reports && Array.isArray(ws.reports.templates) ? ws.reports.templates : []);
  const offering = (ws, id) => (ws.offerings || []).find((o) => o.id === id) || null;
  const lastYear = () => Number(String(NS.dates && NS.dates.today ? NS.dates.today() : new Date().toISOString()).slice(0, 4)) - 1;
  function scopeText(ws, sc) {
    if (!sc || sc.firm) return 'This firm';
    return (sc.offeringIds || []).map((id) => (offering(ws, id) || { name: id }).name).join(', ');
  }
  /** The preview's choices for a template, with defaults filled. */
  function specState(ws, t) {
    const s = st();
    if (!s.spec || s.spec.for !== t.id) {
      const ids = t.scope && t.scope.offeringIds ? t.scope.offeringIds : [];
      const fund = (ids.length ? offering(ws, ids[0]) : null) || (ws.offerings || [])[0] || { id: '' };
      s.spec = { for: t.id, fund: fund.id, preset: 'q', from: '', to: '', who: 'fund', inv: '', as: '', run: '', year: lastYear(), statements: false };
    }
    const p = s.spec;
    if (!offering(ws, p.fund)) p.fund = ((ws.offerings || [])[0] || { id: '' }).id;
    if (t.type === 'distribution') {
      const runs = NS.reportsData.runs(ws, p.fund);
      if (!runs.some((r) => r.id === p.run)) p.run = runs[0] ? runs[0].id : '';
      if (['investor', 'fund'].indexOf(p.who) < 0) p.who = 'fund';
    } else if (t.type === 'tax') {
      if (['investor', 'all'].indexOf(p.who) < 0) p.who = 'all';
    }
    return p;
  }
  /** The period of a period type: a preset of NS.audit.presets for the fund, or Custom. */
  function periodOf(ws, p) {
    const o = offering(ws, p.fund);
    const list = NS.audit.presets(ws, o);
    if (p.preset !== 'custom') {
      const x = list.find((q) => q.id === p.preset) || list.find((q) => q.id === 'q');
      return { list, from: x.from, to: x.to };
    }
    const first = list.find((q) => q.id === 'q');
    return { list, from: p.from || first.from, to: p.to || first.to };
  }
  function audienceOf(p, type) {
    if (p.who === 'investor') return Object.assign({ kind: 'investor', investorId: p.inv }, PERIOD_TYPES[type] ? { offeringId: p.fund } : {});
    if (p.who === 'all') return { kind: 'all' };
    if (p.who === 'letter') return { kind: 'letter', offeringIds: [p.fund], statements: !!p.statements };
    return { kind: 'fund', offeringId: p.fund };
  }
  /** The spec NS.reports takes for the template and the preview's choices. */
  function specOf(ws, t, p) {
    let spec;
    if (t.type === 'distribution') spec = { runId: p.run };
    else if (t.type === 'tax') spec = { year: Number(p.year) };
    else {
      const per = periodOf(ws, p);
      spec = { from: per.from, to: per.to };
    }
    spec.audience = audienceOf(p, t.type);
    return spec;
  }
  /** The investors 'One investor' can pick from. */
  function candidates(ws, t, p) {
    const spec = specOf(ws, t, Object.assign({}, p, { who: t.type === 'tax' ? 'all' : 'fund' }));
    return R()
      .recipients(ws, t, spec)
      .filter(Boolean);
  }
  /** Everything the preview needs, worked out once per drawing. */
  function current(ws, t) {
    const p = specState(ws, t);
    if (p.who === 'investor') {
      const c = candidates(ws, t, p);
      if (c.indexOf(p.inv) < 0) p.inv = c[0] || '';
    }
    const spec = specOf(ws, t, p);
    let recipients = [];
    let errors = [];
    let model = null;
    try {
      recipients = R().recipients(ws, t, spec);
      if (recipients.indexOf(p.as === '' ? null : p.as) < 0) p.as = recipients.length ? (recipients[0] === null ? '' : recipients[0]) : '';
      if (recipients.length) {
        const r = R().resolve(ws, t, spec, p.as || null);
        model = r.model;
        errors = r.errors || [];
      }
    } catch (e) {
      if (window.console) console.error(e);
      errors = [{ message: 'This report could not be prepared.' }];
      model = null;
    }
    return { p, spec, recipients, model, errors, previewId: p.as || null };
  }

  /* ---------- the list ---------- */
  function listHTML(ws) {
    const s = st();
    const nw = s.nw;
    const starters = R().starters(nw.type);
    if (!starters.some((x) => x.id === nw.start)) nw.start = nw.type;
    const offs = ws.offerings || [];
    const form = `<div class="rb-form">
        <label class="cs-field" for="rb-type"><span>Report type</span><select id="rb-type" data-change="rb-new" data-k="type">${TYPE_ORDER.map((k) => `<option value="${k}"${nw.type === k ? ' selected' : ''}>${TYPE_LABELS[k]}</option>`).join('')}</select></label>
        <label class="cs-field" for="rb-start"><span>Start from</span><select id="rb-start" data-change="rb-new" data-k="start">${starters
          .filter((x) => !x.blank)
          .concat(starters.filter((x) => x.blank))
          .map((x) => `<option value="${h(x.id)}"${nw.start === x.id ? ' selected' : ''}>${h(x.name)}</option>`)
          .join('')}</select></label>
        <label class="cs-field" for="rb-name"><span>Name</span><input id="rb-name" type="text" maxlength="80" autocomplete="off" data-input="rb-new" data-k="name" value="${h(nw.name)}"></label>
        <fieldset class="cs-field rb-scope"><legend>Saved for</legend>
          <label class="rb-opt"><input type="radio" name="rb-scope" value="firm" data-change="rb-new" data-k="scope"${nw.scope === 'firm' ? ' checked' : ''}><span>This firm</span></label>
          <label class="rb-opt"><input type="radio" name="rb-scope" value="some" data-change="rb-new" data-k="scope"${nw.scope === 'some' ? ' checked' : ''}><span>Chosen offerings</span></label>
          ${nw.scope === 'some' ? offs.map((o) => `<label class="rb-opt rb-sub"><input type="checkbox" value="${h(o.id)}" data-change="rb-new" data-k="offs"${nw.offs.indexOf(o.id) >= 0 ? ' checked' : ''}><span>${h(o.name)}</span></label>`).join('') : ''}
        </fieldset>
      </div>
      ${s.msg ? `<p class="rb-msg" role="alert">${h(s.msg)}</p>` : ''}
      <div class="rb-acts"><button type="button" class="cs-btn cs-btn-primary" data-action="rb-create">Create</button></div>`;
    const list = templates(ws);
    const admin = NS.app.can('configure');
    const rows = list.length
      ? `<ul class="rb-list">${list
          .map(
            (t) => `<li class="rb-item" data-id="${h(t.id)}">
              <div class="rb-item-main"><span class="strong">${h(t.name)}</span><span class="sub">${h(TYPE_LABELS[t.type] || t.type)} · ${h(scopeText(ws, t.scope))} · Version ${h(t.version)}</span><span class="sub">Updated${t.updatedBy ? ` by ${h(t.updatedBy)}` : ''}${t.updatedAt ? ` ${h(U.date(String(t.updatedAt).slice(0, 10)))}` : ''}</span></div>
              <div class="rb-item-acts">${
                s.del === t.id
                  ? `<span class="rb-ask">Delete ${h(t.name)}?</span><button type="button" class="cs-btn" data-action="rb-del-yes" data-id="${h(t.id)}">Yes, delete</button><button type="button" class="cs-btn" data-action="rb-del-no">Keep</button>`
                  : `<button type="button" class="cs-btn cs-btn-primary" data-action="rb-open" data-id="${h(t.id)}">Open</button>${admin ? `<button type="button" class="cs-btn" data-action="rb-del" data-id="${h(t.id)}">Delete</button>` : ''}`
              }</div>
            </li>`
          )
          .join('')}</ul>`
      : '<p class="cs-muted">No saved reports yet.</p>';
    return `<div class="rb rb-home">
      <p class="rb-506">${LINE_506}</p>
      ${CK().panel('New report', form)}
      ${CK().panel('Saved reports', rows)}
    </div>`;
  }

  /* ---------- the editor ---------- */
  const CAT = () => {
    const o = {};
    R().CATALOGUE.forEach((c) => (o[c.key] = c));
    return o;
  };
  const OPTS = { cover: 1, letter: 1, capital: 1, commitment: 1, assets: 1, chart: 1, outlook: 1, taxdocs: 1, disclosures: 1 };
  const RICH = { letter: 1, outlook: 1, disclosures: 1 };
  const CHARTS = [['none', 'None'], ['dist', 'Distributions by quarter'], ['capital', 'Capital over time'], ['allocation', 'Allocation']];
  const STYLES = [['band', 'Band'], ['plain', 'Plain'], ['photo', 'Photo']];
  const MAX_PHOTOS = 12;
  const msgHTML = () => (st().msg ? `<p class="rb-msg" role="alert">${h(st().msg)}</p>` : '');
  function editorHTML(ws, t) {
    const s = st();
    const C = CAT();
    const movable = t.sections.filter((x) => x.key !== 'cover' && x.key !== 'disclosures').map((x) => x.key);
    const rows = t.sections
      .map((sec) => {
        const c = C[sec.key] || { label: sec.key };
        const label = c.label;
        const fixed = sec.key === 'cover' || sec.key === 'disclosures';
        const k = movable.indexOf(sec.key);
        const isOpen = s.open === sec.key;
        const head = `<div class="rb-sec-head">${
          sec.key === 'disclosures'
            ? `<span class="rb-sec-name">${h(label)}</span>`
            : `<label class="rb-switch"><input type="checkbox" class="rb-on" data-change="rb-on" data-key="${sec.key}"${sec.on ? ' checked' : ''}><span>${h(label)}</span></label>`
        }<span class="rb-sec-acts">${
          fixed
            ? ''
            : `<button type="button" class="cs-btn rb-move" data-action="rb-move" data-key="${sec.key}" data-dir="up" aria-label="Move up: ${h(label)}"${k <= 0 ? ' disabled' : ''}>Move up</button><button type="button" class="cs-btn rb-move" data-action="rb-move" data-key="${sec.key}" data-dir="down" aria-label="Move down: ${h(label)}"${k >= movable.length - 1 ? ' disabled' : ''}>Move down</button>`
        }${OPTS[sec.key] ? `<button type="button" class="cs-btn" data-action="rb-sec" data-key="${sec.key}" aria-expanded="${isOpen}" aria-label="Edit ${h(label)}">Edit</button>` : ''}</span></div>`;
        return `<li class="rb-sec${sec.on ? '' : ' is-off'}" data-key="${sec.key}">${head}${isOpen ? `<div class="rb-opts">${optsHTML(ws, t, sec)}${msgHTML()}</div>` : ''}</li>`;
      })
      .join('');
    const offs = ws.offerings || [];
    const some = !!(t.scope && t.scope.offeringIds);
    const ids = some ? t.scope.offeringIds : [];
    return `<div class="rb rb-edit">
      <div class="rb-bar"><button type="button" class="cs-btn rb-back" data-action="rb-back">Back to reports</button><h2>${h(t.name)}</h2></div>
      ${s.leave ? `<div class="rb-leave" role="alert"><p class="rb-msg">Changes are not saved.</p><div class="rb-acts"><button type="button" class="cs-btn cs-btn-primary" data-action="rb-save-back">Save</button><button type="button" class="cs-btn" data-action="rb-leave">Leave without saving</button></div></div>` : ''}
      ${CK().panel(
        '',
        `<div class="rb-form">
          <label class="cs-field" for="rb-tname"><span>Name</span><input id="rb-tname" type="text" maxlength="80" autocomplete="off" data-input="rb-draft" data-k="name" value="${h(t.name)}"></label>
          <fieldset class="cs-field rb-scope"><legend>Saved for</legend>
            <label class="rb-opt"><input type="radio" name="rb-tscope" value="firm" data-change="rb-tscope"${some ? '' : ' checked'}><span>This firm</span></label>
            <label class="rb-opt"><input type="radio" name="rb-tscope" value="some" data-change="rb-tscope"${some ? ' checked' : ''}><span>Chosen offerings</span></label>
            ${some ? offs.map((o) => `<label class="rb-opt rb-sub"><input type="checkbox" value="${h(o.id)}" data-change="rb-tscope-off"${ids.indexOf(o.id) >= 0 ? ' checked' : ''}><span>${h(o.name)}</span></label>`).join('') : ''}
          </fieldset>
        </div>
        <ul class="rb-secs">${rows}</ul>
        ${s.open ? '' : msgHTML()}
        <div class="rb-acts"><button type="button" class="cs-btn cs-btn-primary" data-action="rb-save">Save</button><span class="rb-ver" id="rb-ver">Version ${h(t.version)}</span></div>`
      )}
      ${previewPanel(ws, t)}
    </div>`;
  }
  /** One section's options, under its row. */
  function optsHTML(ws, t, sec) {
    const s = st();
    const o = sec.opts || {};
    if (RICH[sec.key]) return `${sec.key === 'disclosures' ? '<p class="rb-line">Starting wording; to be confirmed with counsel.</p>' : ''}${rteHTML(sec.key, sec.key === 'disclosures' ? t.disclosures : sec.text, CAT()[sec.key].label)}`;
    if (sec.key === 'cover') {
      const firm = (ws.tenant.colors && (ws.tenant.colors.accent || ws.tenant.colors.primary)) || '#1F3A5F';
      const acc = NS.brand.normHex(t.cover.accent) || NS.brand.normHex(firm) || '#1F3A5F';
      return `<div class="rb-form">
        <label class="cs-field" for="rb-cover-style"><span>Style</span><select id="rb-cover-style" data-change="rb-cover" data-k="style">${STYLES.map(([k, l]) => opt(k, l, t.cover.style === k)).join('')}</select></label>
        <div class="cs-field"><span>Accent</span><div class="rb-accent"><input id="rb-accent" type="color" aria-label="Accent" value="${h(acc.toLowerCase())}" data-change="rb-cover" data-k="accent"><input id="rb-accent-hex" type="text" aria-label="Accent hex" maxlength="7" autocomplete="off" value="${h(acc)}" data-change="rb-cover" data-k="accent"></div>${s.adjusted ? '<p class="rb-line rb-adjusted">Adjusted for contrast</p>' : ''}</div>
        <div class="cs-field rb-coverphoto"><span>Cover photo</span>${t.cover.photoId ? `<div class="rb-thumbs">${thumbHTML(t.cover.photoId, 'cover', 'Remove cover photo')}</div>` : ''}<label class="cs-btn rb-file">Add photo<input id="rb-cover-photo" type="file" accept="image/*" data-change="rb-photo" data-target="cover"></label></div>
      </div>`;
    }
    if (sec.key === 'capital') return `<label class="cs-field" for="rb-second"><span>Second column</span><select id="rb-second" data-change="rb-opt" data-key="capital" data-k="second">${opt('ytd', 'Year to date', o.second !== 'itd')}${opt('itd', 'Since inception', o.second === 'itd')}</select></label>`;
    if (sec.key === 'commitment') return `<label class="rb-opt"><input type="checkbox" data-change="rb-opt" data-key="commitment" data-k="activity"${o.activity ? ' checked' : ''}><span>Show capital activity</span></label>`;
    if (sec.key === 'taxdocs') return `<label class="cs-field" for="rb-expected"><span>Expected</span><input id="rb-expected" type="text" maxlength="200" autocomplete="off" data-input="rb-opt" data-key="taxdocs" data-k="expected" value="${h(o.expected || '')}"></label>`;
    if (sec.key === 'chart') return `<label class="cs-field" for="rb-chart"><span>Chart</span><select id="rb-chart" data-change="rb-chart">${CHARTS.map(([k, l]) => opt(k, l, t.chart === k)).join('')}</select></label>`;
    if (sec.key === 'assets') {
      const rows = holdingsOf(ws, t);
      if (!rows.length) return '<p class="rb-line">No holding in the books for this fund yet.</p>';
      const items = o.items || [];
      return rows
        .map((hd) => {
          const it = items.find((x) => x.holdingId === hd.id) || { photoIds: [], text: [], figures: [] };
          return `<div class="rb-hold" data-holding="${h(hd.id)}"><h4>${h(hd.name)}</h4>
            <div class="cs-field"><span>Photos</span>${it.photoIds.length ? `<div class="rb-thumbs">${it.photoIds.map((id, i) => thumbHTML(id, `asset:${hd.id}`, `Remove photo ${i + 1}`)).join('')}</div>` : ''}<label class="cs-btn rb-file">Add photo<input type="file" accept="image/*" multiple data-change="rb-photo" data-target="asset:${h(hd.id)}"></label></div>
            <div class="cs-field"><span>Description</span>${rteHTML(`asset:${hd.id}`, it.text, `Description of ${hd.name}`)}</div>
            <div class="cs-field"><span>Figures</span>${(it.figures || [])
              .map((f, i) => `<div class="rb-fig"><input type="text" aria-label="Label" placeholder="Label" maxlength="80" data-input="rb-fig" data-h="${h(hd.id)}" data-i="${i}" data-f="label" value="${h(f.label)}"><input type="text" aria-label="Value" placeholder="Value" maxlength="80" data-input="rb-fig" data-h="${h(hd.id)}" data-i="${i}" data-f="value" value="${h(f.value)}"></div>`)
              .join('')}<div class="rb-acts"><button type="button" class="cs-btn" data-action="rb-fig-add" data-h="${h(hd.id)}">Add figure</button></div></div>
          </div>`;
        })
        .join('');
    }
    return '';
  }
  function thumbHTML(id, target, label) {
    const src = photoSrc(id);
    return `<span class="rb-thumb">${src ? `<img src="${h(src)}" alt="">` : '<span class="rb-photo-wait"></span>'}<button type="button" class="cs-btn rb-x" data-action="rb-photo-del" data-id="${h(id)}" data-target="${h(target)}" aria-label="${h(label)}">×</button></span>`;
  }
  /** The fund's holdings that have a record (an id) to keep photos and wording against. */
  function holdingsOf(ws, t) {
    const p = specState(ws, t);
    const to = PERIOD_TYPES[t.type] ? periodOf(ws, p).to : NS.audit.snap('2000-01-01', '9999-12-31').to;
    const H = NS.reportsData.holdings(ws, p.fund, to) || { rows: [] };
    return (H.rows || []).filter((x) => x.id);
  }

  /* ---------- the rich-text editor (the block model only; never document.execCommand) ---------- */
  const TOOLS = [['bold', 'Bold'], ['italic', 'Italic'], ['heading', 'Heading'], ['list', 'List']];
  function blocksHTML(blocks) {
    const out = (blocks || [])
      .map((b) => {
        if (b.t === 'h') return `<h3>${runsHTML(b.runs)}</h3>`;
        if (b.t === 'ul') return `<ul>${(b.items || []).map((it) => `<li>${runsHTML(it)}</li>`).join('')}</ul>`;
        return `<p>${runsHTML(b.runs)}</p>`;
      })
      .join('');
    return out || '<p><br></p>';
  }
  function rteHTML(path, blocks, label) {
    return `<div class="rb-rte" data-rte="${h(path)}"><div class="rb-tools" role="toolbar" aria-label="${h(label)}">${TOOLS.map(([k, l]) => `<button type="button" class="cs-btn rb-tool" data-action="rb-cmd" data-cmd="${k}">${l}</button>`).join('')}<select class="rb-field" aria-label="Insert field" data-change="rb-field">${opt('', 'Insert field', true)}${R()
      .MERGE_FIELDS.map((f) => opt(f, `{${f}}`, false))
      .join('')}</select></div><div class="rb-area" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${h(label)}" data-input="rb-rte" data-path="${h(path)}">${blocksHTML(blocks)}</div></div>`;
  }
  const sectionOf = (t, key) => t.sections.find((x) => x.key === key);
  /** The assets item of a holding, made (for every holding with a record) the first time one is needed. */
  function itemOf(ws, t, hid) {
    const sec = sectionOf(t, 'assets');
    if (!sec) return null;
    sec.opts = sec.opts || {};
    if (!Array.isArray(sec.opts.items) || !sec.opts.items.length) sec.opts.items = holdingsOf(ws, t).map((x) => ({ holdingId: x.id, photoIds: [], text: [], figures: [] }));
    let it = sec.opts.items.find((x) => x.holdingId === hid);
    if (!it) sec.opts.items.push((it = { holdingId: hid, photoIds: [], text: [], figures: [] }));
    return it;
  }
  function setBlocks(t, path, blocks) {
    if (path === 'disclosures') t.disclosures = blocks;
    else if (path.indexOf('asset:') === 0) {
      const it = itemOf(W(), t, path.slice(6));
      if (it) it.text = blocks;
    } else {
      const sec = sectionOf(t, path);
      if (sec) sec.text = blocks;
    }
  }
  const toTree = (n) =>
    Array.from(n.childNodes)
      .map((c) => (c.nodeType === 3 ? { text: c.nodeValue.replace(/ /g, ' ') } : c.nodeType === 1 ? { tag: c.nodeName.toLowerCase(), children: toTree(c) } : null))
      .filter(Boolean);
  /** The area's words into the template (as blocks), the workspace saved, the preview drawn again in place. */
  function fromArea(area) {
    const t = st().draft;
    if (!t || !area) return;
    setBlocks(t, area.getAttribute('data-path'), R().fromTree(toTree(area)));
    NS.app.save();
    livePreview();
  }
  /** The preview and the three file buttons, redrawn in place (never the whole page while someone types). */
  function livePreview() {
    const ws = W();
    const t = st().draft;
    const box = document.getElementById('rb-preview');
    if (!ws || !t || !box) return;
    const C = current(ws, t);
    box.innerHTML = previewHTML(C);
    const off = !C.model || C.errors.length > 0;
    ['rb-pdf', 'rb-dl-pdf', 'rb-dl-xlsx'].forEach((a) => {
      const b = document.querySelector(`[data-action=${a}]`);
      if (b) b.disabled = off;
    });
  }
  // the last selection inside an area, so a tap on a tool (which may move focus) acts on it
  let saved = null;
  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection();
    if (!sel || !sel.rangeCount) return;
    const n = sel.anchorNode;
    const area = n && (n.nodeType === 1 ? n : n.parentNode).closest && (n.nodeType === 1 ? n : n.parentNode).closest('.rb-area');
    if (area) saved = { area, range: sel.getRangeAt(0).cloneRange() };
  });
  // a tap on a tool keeps the selection and the keyboard
  ['pointerdown', 'mousedown'].forEach((ev) =>
    document.addEventListener(ev, (e) => {
      if (e.target.closest && e.target.closest('.rb-tools button')) e.preventDefault();
    })
  );
  /** The area a tool acts on, with the selection put back inside it. */
  function areaFor(el) {
    const area = el.closest('.rb-rte') && el.closest('.rb-rte').querySelector('.rb-area');
    if (!area) return null;
    let range = saved && saved.area === area && area.contains(saved.range.startContainer) ? saved.range : null;
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(area);
      range.collapse(false);
    }
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return { area, range };
  }
  const inTag = (node, area, re) => {
    for (let n = node.parentNode; n && n !== area; n = n.parentNode) if (re.test(n.nodeName)) return n;
    return null;
  };
  /** Bold or italic: the selected text wrapped in b or i, or unwrapped when all of it already is. */
  function styleRange(area, range, tag) {
    if (range.collapsed) return;
    const re = tag === 'b' ? /^(B|STRONG)$/ : /^(I|EM)$/;
    if (range.startContainer.nodeType === 3 && range.startOffset > 0 && range.startOffset < range.startContainer.length) {
      const rest = range.startContainer.splitText(range.startOffset);
      if (range.endContainer === rest.previousSibling) range.setEnd(rest, range.endOffset - rest.previousSibling.length);
      range.setStart(rest, 0);
    }
    if (range.endContainer.nodeType === 3 && range.endOffset > 0 && range.endOffset < range.endContainer.length) range.endContainer.splitText(range.endOffset);
    const nodes = [];
    const walk = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.length && range.intersectsNode(n) && !(n === range.endContainer && range.endOffset === 0) && !(n === range.startContainer && range.startOffset === n.length)) nodes.push(n);
    if (!nodes.length) return;
    const all = nodes.every((n) => inTag(n, area, re));
    nodes.forEach((n) => {
      if (!all) {
        if (inTag(n, area, re)) return;
        const w = document.createElement(tag);
        n.parentNode.insertBefore(w, n);
        w.appendChild(n);
        return;
      }
      for (let anc = inTag(n, area, re); anc; anc = inTag(n, area, re)) {
        const before = document.createRange();
        before.setStart(anc, 0);
        before.setEndBefore(n);
        const after = document.createRange();
        after.setStartAfter(n);
        after.setEnd(anc, anc.childNodes.length);
        const fb = before.extractContents();
        const fa = after.extractContents();
        const parent = anc.parentNode;
        const wrap = (frag) => {
          if (!frag.textContent) return null;
          const el = document.createElement(anc.nodeName.toLowerCase());
          el.appendChild(frag);
          return el;
        };
        const b1 = wrap(fb);
        const b2 = wrap(fa);
        if (b1) parent.insertBefore(b1, anc);
        while (anc.firstChild) parent.insertBefore(anc.firstChild, anc);
        if (b2) parent.insertBefore(b2, anc);
        parent.removeChild(anc);
      }
    });
    const r = document.createRange();
    r.setStart(nodes[0], 0);
    r.setEnd(nodes[nodes.length - 1], nodes[nodes.length - 1].length);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  const BLOCK = /^(P|DIV|H[1-6]|UL|OL)$/;
  /** The block of the area that holds the node (loose text at the top is first put in a paragraph). */
  function blockOf(area, node) {
    let n = node.nodeType === 3 ? node : node;
    if (n === area) n = area.childNodes[Math.min(area.childNodes.length - 1, 0)] || null;
    while (n && n.parentNode !== area) n = n.parentNode;
    if (!n) {
      const p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      area.appendChild(p);
      return p;
    }
    if (n.nodeType === 1 && BLOCK.test(n.nodeName)) return n;
    // loose inline content: gather the run of inline siblings into one paragraph
    let a = n;
    while (a.previousSibling && !(a.previousSibling.nodeType === 1 && BLOCK.test(a.previousSibling.nodeName))) a = a.previousSibling;
    const p = document.createElement('p');
    area.insertBefore(p, a);
    while (p.nextSibling && !(p.nextSibling.nodeType === 1 && BLOCK.test(p.nextSibling.nodeName))) {
      const x = p.nextSibling;
      if (x.nodeName === 'BR') {
        x.remove();
        break;
      }
      p.appendChild(x);
    }
    return p;
  }
  function retag(el, tag) {
    const x = document.createElement(tag);
    while (el.firstChild) x.appendChild(el.firstChild);
    el.parentNode.replaceChild(x, el);
    return x;
  }
  function caretAtEnd(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function blockCmd(area, range, cmd) {
    const blk = blockOf(area, range.startContainer);
    let at = blk;
    if (cmd === 'heading') {
      if (/^(UL|OL)$/.test(blk.nodeName)) return;
      at = retag(blk, blk.nodeName === 'H3' ? 'p' : 'h3');
    } else if (/^(UL|OL)$/.test(blk.nodeName)) {
      const items = Array.from(blk.children).filter((x) => x.nodeName === 'LI');
      const ps = items.map((li) => {
        const p = document.createElement('p');
        while (li.firstChild) p.appendChild(li.firstChild);
        return p;
      });
      ps.forEach((p) => area.insertBefore(p, blk));
      blk.remove();
      at = ps[ps.length - 1] || area;
    } else {
      const li = document.createElement('li');
      while (blk.firstChild) li.appendChild(blk.firstChild);
      const prev = blk.previousSibling;
      if (prev && prev.nodeName === 'UL') {
        prev.appendChild(li);
        blk.remove();
      } else {
        const ul = document.createElement('ul');
        ul.appendChild(li);
        area.replaceChild(ul, blk);
      }
      at = li;
    }
    caretAtEnd(at);
  }
  /** Text put in at the caret (paste and Insert field): plain text only; a line break starts a new paragraph. */
  function insertText(area, range, text) {
    range.deleteContents();
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const frag = document.createDocumentFragment();
    let last = null;
    lines.forEach((l, i) => {
      if (i) frag.appendChild(document.createElement('br'));
      last = document.createTextNode(l);
      frag.appendChild(last);
    });
    range.insertNode(frag);
    const r = document.createRange();
    r.setStartAfter(last);
    r.collapse(true);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  document.addEventListener('paste', (e) => {
    const area = e.target.closest && e.target.closest('.rb-area');
    if (!area) return;
    e.preventDefault();
    const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
    const sel = document.getSelection();
    if (!sel.rangeCount || !area.contains(sel.getRangeAt(0).startContainer)) caretAtEnd(area);
    insertText(area, document.getSelection().getRangeAt(0), text);
    fromArea(area);
  });
  NS.changes['rb-rte'] = (el) => fromArea(el);
  NS.actions['rb-cmd'] = (el, e) => {
    if (e) e.preventDefault();
    const a = areaFor(el);
    if (!a) return;
    const cmd = el.getAttribute('data-cmd');
    if (cmd === 'bold' || cmd === 'italic') styleRange(a.area, a.range, cmd === 'bold' ? 'b' : 'i');
    else blockCmd(a.area, a.range, cmd);
    fromArea(a.area);
  };
  NS.changes['rb-field'] = (el) => {
    const v = el.value;
    if (!v) return;
    const a = areaFor(el);
    el.value = '';
    if (!a || R().MERGE_FIELDS.indexOf(v) < 0) return;
    insertText(a.area, a.range, `{${v}}`);
    fromArea(a.area);
  };

  /* ---------- photos (C-11): redrawn on a canvas to at most 1,600 px as JPEG, kept as bytes ---------- */
  function redraw(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const w0 = img.naturalWidth;
          const h0 = img.naturalHeight;
          if (!w0 || !h0) throw new Error('empty');
          const k = Math.min(1, 1600 / Math.max(w0, h0));
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(w0 * k));
          cv.height = Math.max(1, Math.round(h0 * k));
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          cv.toBlob(
            (b) => {
              URL.revokeObjectURL(url);
              if (b && b.size) resolve(b);
              else reject(new Error('no jpeg'));
            },
            'image/jpeg',
            0.82
          );
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('decode'));
      };
      img.src = url;
    });
  }
  const photoCount = (t) => ((sectionOf(t, 'assets') || { opts: {} }).opts.items || []).reduce((a, it) => a + (it.photoIds || []).length, 0);
  /** A new file id for a photo: unique across the firm's templates (the file store is shared by every portal in this browser). */
  function photoId(ws, t) {
    const pre = `rp-${ws.tenant.id}-`;
    let n = 0;
    const see = (id) => {
      if (String(id).indexOf(pre) === 0) n = Math.max(n, Number(String(id).slice(pre.length)) || 0);
    };
    templates(ws)
      .concat([t])
      .forEach((x) => {
        see(x.cover && x.cover.photoId);
        x.sections.forEach((s) => ((s.opts && s.opts.items) || []).forEach((it) => (it.photoIds || []).forEach(see)));
      });
    Object.keys(photoUrls).forEach(see);
    return pre + (n + 1);
  }
  NS.changes['rb-photo'] = async (el) => {
    const ws = W();
    const s = st();
    const t = s.draft;
    const target = el.getAttribute('data-target');
    const files = Array.from(el.files || []);
    el.value = '';
    if (!t || !files.length) return;
    s.msg = '';
    for (const f of files) {
      if (target !== 'cover' && photoCount(t) >= MAX_PHOTOS) {
        s.msg = 'A template holds at most 12 photos.';
        break;
      }
      let blob;
      try {
        blob = await redraw(f);
      } catch (e) {
        s.msg = 'This photo could not be read.';
        continue;
      }
      const id = photoId(ws, t);
      photoUrls[id] = URL.createObjectURL(blob);
      await NS.ops.files.put(id, blob);
      if (target === 'cover') t.cover.photoId = id;
      else {
        const it = itemOf(ws, t, target.slice(6));
        if (it) it.photoIds.push(id);
      }
    }
    NS.app.save();
    NS.app.render();
  };
  NS.actions['rb-photo-del'] = (el) => {
    const t = st().draft;
    if (!t) return;
    const id = el.getAttribute('data-id');
    const target = el.getAttribute('data-target');
    if (target === 'cover') t.cover.photoId = '';
    else {
      const it = itemOf(W(), t, target.slice(6));
      if (it) it.photoIds = it.photoIds.filter((x) => x !== id);
    }
    st().msg = '';
    NS.app.render();
  };

  /* ---------- the distribution split (C-06): typed by the sponsor, exact to the cent ---------- */
  const DOLLARS = /^\d{1,13}(\.\d{1,2})?$/;
  const centsOf = (s) => {
    const [a, b] = String(s).split('.');
    return Number(a) * 100 + Number(((b || '') + '00').slice(0, 2));
  };
  const dollarsOf = (c) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
  function splitState(ws, runId) {
    const s = st();
    if (!s.split || s.split.run !== runId) {
      const kept = ws.reports && ws.reports.splits && ws.reports.splits[runId];
      s.split = { run: runId, rows: kept && kept.parts && kept.parts.length ? kept.parts.map((p) => ({ label: p.label, amount: dollarsOf(p.cents) })) : [{ label: R().SPLIT_LABELS[0], amount: '' }] };
    }
    return s.split;
  }
  /** Whether the typed split can be saved, and what to say if not. */
  function splitCheck(ws, sp) {
    const run = NS.reportsData.runs(ws, specState(ws, st().draft).fund).find((r) => r.id === sp.run);
    if (!run) return { ok: false, off: '', msg: '' };
    const rows = sp.rows.filter((r) => String(r.amount).trim() !== '');
    if (rows.some((r) => !DOLLARS.test(String(r.amount).trim()))) return { ok: false, off: '', msg: 'Enter dollars and cents, like 1250.50.' };
    const labels = rows.map((r) => r.label);
    if (labels.some((l, i) => labels.indexOf(l) !== i)) return { ok: false, off: '', msg: 'Each character can be listed once.' };
    if (rows.some((r) => centsOf(String(r.amount).trim()) <= 0)) return { ok: false, off: '', msg: 'Each amount must be above zero.' };
    if (!rows.length) return { ok: false, off: '', msg: '' };
    const sum = rows.reduce((a, r) => a + centsOf(String(r.amount).trim()), 0);
    const cur = NS.structures.curOf(offering(ws, specState(ws, st().draft).fund));
    if (sum !== run.gross) return { ok: false, off: `Off by ${R().fmt.money(Math.abs(sum - run.gross), cur)}`, msg: '' };
    return { ok: true, off: '', msg: '', parts: rows.map((r) => ({ label: r.label, cents: centsOf(String(r.amount).trim()) })) };
  }
  function splitHTML(ws, runId) {
    const sp = splitState(ws, runId);
    const c = splitCheck(ws, sp);
    const kept = !!(ws.reports && ws.reports.splits && ws.reports.splits[runId]);
    return `<fieldset class="cs-field rb-split"><legend>Character of this distribution (optional)</legend>
      ${sp.rows
        .map(
          (r, i) => `<div class="rb-split-row"><select aria-label="Character" data-change="rb-split" data-i="${i}" data-f="label">${R()
            .SPLIT_LABELS.map((l) => opt(l, l, r.label === l))
            .join('')}</select><input type="text" inputmode="decimal" autocomplete="off" aria-label="Amount" data-input="rb-split" data-i="${i}" data-f="amount" value="${h(r.amount)}"></div>`
        )
        .join('')}
      <div class="rb-acts"><button type="button" class="cs-btn" data-action="rb-split-add"${sp.rows.length >= R().SPLIT_LABELS.length ? ' disabled' : ''}>Add line</button><button type="button" class="cs-btn cs-btn-primary" data-action="rb-split-save"${c.ok ? '' : ' disabled'}>Save split</button>${kept ? '<button type="button" class="cs-btn" data-action="rb-split-clear">Remove split</button>' : ''}</div>
      <p class="rb-line rb-off">${h(c.off)}</p>
      <div class="rb-split-msg">${c.msg ? `<p class="rb-msg" role="alert">${h(c.msg)}</p>` : ''}</div>
    </fieldset>`;
  }
  function splitLive() {
    const ws = W();
    const s = st();
    if (!s.split) return;
    const c = splitCheck(ws, s.split);
    const off = document.querySelector('.rb-off');
    if (off) off.textContent = c.off;
    const m = document.querySelector('.rb-split-msg');
    if (m) m.innerHTML = c.msg ? `<p class="rb-msg" role="alert">${h(c.msg)}</p>` : '';
    const b = document.querySelector('[data-action=rb-split-save]');
    if (b) b.disabled = !c.ok;
  }
  const splitRow = (el) => {
    const s = st();
    const i = Number(el.getAttribute('data-i'));
    return s.split && s.split.rows[i] ? s.split.rows[i] : null;
  };
  NS.changes['rb-split'] = (el) => {
    const r = splitRow(el);
    if (!r) return;
    r[el.getAttribute('data-f')] = el.value;
    splitLive();
  };
  NS.actions['rb-split-add'] = () => {
    const s = st();
    if (!s.split) return;
    const used = s.split.rows.map((r) => r.label);
    const next = R().SPLIT_LABELS.find((l) => used.indexOf(l) < 0);
    if (next) s.split.rows.push({ label: next, amount: '' });
    NS.app.render();
  };
  NS.actions['rb-split-save'] = () => {
    const ws = W();
    const s = st();
    if (!s.split) return;
    const c = splitCheck(ws, s.split);
    if (!c.ok) return splitLive();
    const r = R().setSplit(ws, s.split.run, c.parts, { by: NS.app.actor() });
    if (!r.ok) {
      s.msg = r.error;
      return NS.app.render();
    }
    NS.app.save();
    s.split = null;
    s.msg = '';
    NS.app.render();
    U.toast('Split saved');
  };
  NS.actions['rb-split-clear'] = () => {
    const s = st();
    if (!s.split) return;
    R().setSplit(W(), s.split.run, [], { by: NS.app.actor() });
    NS.app.save();
    s.split = null;
    NS.app.render();
  };

  /* ---------- the preview: what it is for, and the preview itself ---------- */
  const opt = (v, label, sel) => `<option value="${h(v)}"${sel ? ' selected' : ''}>${h(label)}</option>`;
  function previewPanel(ws, t) {
    const C = current(ws, t);
    const p = C.p;
    const fmt = R().fmt;
    const offs = ws.offerings || [];
    const fields = [];
    if (t.type !== 'tax') fields.push(`<label class="cs-field" for="rb-fund"><span>Fund</span><select id="rb-fund" data-change="rb-spec" data-k="fund">${offs.map((o) => opt(o.id, o.name, o.id === p.fund)).join('')}</select></label>`);
    if (PERIOD_TYPES[t.type]) {
      const per = periodOf(ws, p);
      fields.push(`<label class="cs-field" for="rb-period"><span>Period</span><select id="rb-period" data-change="rb-spec" data-k="preset">${per.list.map((q) => opt(q.id, q.label, p.preset === q.id)).join('')}${opt('custom', 'Custom', p.preset === 'custom')}</select></label>`);
      if (p.preset === 'custom')
        fields.push(`<label class="cs-field" for="rb-from"><span>From</span><input id="rb-from" type="date" data-change="rb-spec" data-k="from" value="${h(per.from)}"></label><label class="cs-field" for="rb-to"><span>To</span><input id="rb-to" type="date" data-change="rb-spec" data-k="to" value="${h(per.to)}"></label>`);
      const sn = NS.audit.snap(per.from, per.to);
      fields.push(`<p class="rb-line">Shows ${h(fmt.date(sn.from))} to ${h(fmt.date(sn.to))}</p>`);
    }
    if (t.type === 'distribution') {
      const runs = NS.reportsData.runs(ws, p.fund);
      const cur = NS.structures.curOf(offering(ws, p.fund));
      fields.push(
        runs.length
          ? `<label class="cs-field" for="rb-run"><span>Payment</span><select id="rb-run" data-change="rb-spec" data-k="run">${runs.map((r) => opt(r.id, `${fmt.date(r.date)} · ${fmt.money(r.gross, cur)}${r.type ? ` · ${r.type}` : ''}`, r.id === p.run)).join('')}</select></label>`
          : '<p class="rb-line">No paid distribution in this fund yet.</p>'
      );
      if (p.run) fields.push(splitHTML(ws, p.run));
    }
    if (t.type === 'tax') {
      const y = lastYear() + 1;
      const years = [y, y - 1, y - 2, y - 3, y - 4];
      fields.push(`<label class="cs-field" for="rb-year"><span>Tax year</span><select id="rb-year" data-change="rb-spec" data-k="year">${years.map((x) => opt(x, x, Number(p.year) === x)).join('')}</select></label>`);
    }
    const whos = t.type === 'distribution' ? [['investor', 'One investor'], ['fund', 'Every investor in the fund']] : t.type === 'tax' ? [['investor', 'One investor'], ['all', 'Every investor, all their funds']] : [['investor', 'One investor'], ['fund', 'Every investor in the fund'], ['all', 'Every investor, all their funds'], ['letter', 'One letter for everyone']];
    fields.push(
      `<fieldset class="cs-field rb-who"><legend>Who</legend>${whos.map(([k, l]) => `<label class="rb-opt"><input type="radio" name="rb-who" value="${k}" data-change="rb-spec" data-k="who"${p.who === k ? ' checked' : ''}><span>${l}</span></label>`).join('')}${
        p.who === 'letter' ? `<label class="rb-opt rb-sub"><input type="checkbox" data-change="rb-spec" data-k="statements"${p.statements ? ' checked' : ''}><span>Add each investor's own statement</span></label>` : ''
      }</fieldset>`
    );
    const names = {};
    (ws.investors || []).forEach((i) => (names[i.id] = i.title || i.id));
    if (p.who === 'investor') {
      const c = candidates(ws, t, p);
      fields.push(`<label class="cs-field" for="rb-inv"><span>Investor</span><select id="rb-inv" data-change="rb-spec" data-k="inv">${c.map((id) => opt(id, `${names[id] || id} (${id})`, id === p.inv)).join('')}</select></label>`);
    }
    fields.push(
      C.recipients.length
        ? `<label class="cs-field" for="rb-as"><span>Preview as</span><select id="rb-as" data-change="rb-spec" data-k="as">${C.recipients.map((id) => (id === null ? opt('', 'Everyone (one letter)', true) : opt(id, `${names[id] || id} (${id})`, id === p.as))).join('')}</select></label>`
        : '<p class="rb-line">No investor to preview for this choice.</p>'
    );
    const off = !C.model || C.errors.length > 0;
    const dis = off ? ' disabled' : '';
    const busy = st().busy;
    const parts = Object.keys(extra)
      .map((k) => extra[k])
      .sort((a, b) => a.order - b.order)
      .map((x) => {
        try {
          return x.render(ws, { template: t, spec: C.spec, audience: C.spec.audience, recipients: C.recipients, previewId: C.previewId, model: C.model, errors: C.errors }) || '';
        } catch (e) {
          if (window.console) console.error(e);
          return '';
        }
      })
      .join('');
    return `${CK().panel('Preview for', `<div class="rb-form">${fields.join('')}</div>`)}
      <section class="rb-pv" aria-label="Preview">
        <div id="rb-preview">${previewHTML(C)}</div>
        <div class="rb-acts rb-files">
          <button type="button" class="cs-btn cs-btn-primary" data-action="rb-pdf"${dis}>See the PDF</button>
          <button type="button" class="cs-btn" data-action="rb-dl-pdf"${dis}>Download PDF</button>
          <button type="button" class="cs-btn" data-action="rb-dl-xlsx"${dis}>Download spreadsheet</button>
        </div>
        ${busy ? `<p class="rb-line" role="status">${h(busy)}</p>` : ''}
        ${pdfPanel()}
      </section>
      ${parts}`;
  }
  function pdfPanel() {
    const P = st().pdf;
    if (!P) return '';
    return `<div class="rb-pdf" id="rb-pdfpanel"><div class="rb-pdf-head"><h3>PDF</h3><button type="button" class="cs-btn" data-action="rb-pdf-close">Close PDF</button></div><div class="rb-pdf-body">${P.html || '<p class="cs-muted" role="status">Drawing the PDF…</p>'}</div></div>`;
  }

  /* ---------- the model drawn as HTML (strings from the model only, escaped) ---------- */
  const runsHTML = (runs) =>
    (runs || [])
      .map((r) => {
        let x = h(r.s);
        if (r.i) x = `<i>${x}</i>`;
        if (r.b) x = `<b>${x}</b>`;
        return x;
      })
      .join('');
  const NUM = { money: 1, pct: 1, ratio: 1, price: 1, int: 1 };
  // A word with a hyphen, a dash or a slash stays whole on one line ('Single-name'): the browser may break after any of
  // them, and a phone draws a text column at its narrowest. Number cells never wrap (.num), so they are left as they are.
  const words = (s) => h(s).replace(/\S*[-\u2010\u2013\u2014/]\S*/g, (w) => `<span class="rb-nw">${w}</span>`);
  function tableHTML(b) {
    const cls = (c) => (NUM[c.t] ? ' class="num"' : '');
    const text = (c, s) => (NUM[c.t] ? h(s) : words(s));
    const row = (cells, tag) => `<tr>${cells.map((c, i) => `<${tag}${cls(b.cols[i] || {})}>${text(b.cols[i] || {}, c.s)}</${tag}>`).join('')}</tr>`;
    return `<div class="tbl-scroll rb-tblwrap"><table class="rb-tbl"><caption>${h(b.title)}</caption><thead><tr>${b.cols.map((c) => `<th scope="col"${cls(c)}>${text(c, c.h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => row(r, 'td')).join('')}</tbody>${b.total ? `<tfoot>${row(b.total, 'td')}</tfoot>` : ''}</table></div>`;
  }
  function chartHTML(b, accent) {
    const W0 = 320;
    const H0 = 160;
    const pad = { l: 8, r: 8, t: 10, b: 8 };
    const vals = (b.values || []).map((v) => Number(v) || 0);
    const n = vals.length;
    if (!n) return '';
    const iw = W0 - pad.l - pad.r;
    const ih = H0 - pad.t - pad.b;
    let svg = '';
    if (b.kind === 'bar100') {
      let x = pad.l;
      const segs = vals.map((v, i) => {
        const w = Math.max(0, v) * iw;
        const shade = i % 2 ? '#9AA3AD' : accent;
        const r = `<rect x="${x.toFixed(2)}" y="${pad.t}" width="${w.toFixed(2)}" height="28" fill="${shade}"></rect>`;
        x += w;
        return r;
      });
      svg = `<svg class="rb-svg" viewBox="0 0 ${W0} 48" role="img" aria-label="${h(b.title)}">${segs.join('')}</svg><ul class="rb-legend">${(b.labels || []).map((l, i) => `<li><span class="rb-key" style="background:${i % 2 ? '#9AA3AD' : accent}"></span>${h(l)} ${h((b.shown || [])[i] || '')}</li>`).join('')}</ul>`;
    } else {
      // values between 0 and 1 are fractions of the plot (as the ticks' at); any other values are placed against the
      // lower of zero and the least value and the greatest, as the ticks are
      const frac = vals.every((v) => v >= 0 && v <= 1);
      const lo = frac ? 0 : Math.min(0, ...vals);
      const hi = frac ? 1 : Math.max(0, ...vals);
      const span = hi - lo || 1;
      const y = (v) => pad.t + ih - ((v - lo) / span) * ih;
      const grid = (b.ticks || []).map((tk) => `<line x1="${pad.l}" x2="${W0 - pad.r}" y1="${(pad.t + ih - tk.at * ih).toFixed(2)}" y2="${(pad.t + ih - tk.at * ih).toFixed(2)}" stroke="#D5D8DC" stroke-width="1"></line>`).join('');
      if (b.kind === 'columns') {
        const step = iw / n;
        const bw = Math.max(2, step * 0.6);
        svg = vals.map((v, i) => `<rect x="${(pad.l + i * step + (step - bw) / 2).toFixed(2)}" y="${Math.min(y(v), y(Math.max(lo, 0))).toFixed(2)}" width="${bw.toFixed(2)}" height="${Math.abs(y(Math.max(lo, 0)) - y(v)).toFixed(2)}" fill="${accent}"></rect>`).join('');
      } else {
        const step = n > 1 ? iw / (n - 1) : 0;
        svg = `<polyline fill="none" stroke="${accent}" stroke-width="2" points="${vals.map((v, i) => `${(pad.l + i * step).toFixed(2)},${y(v).toFixed(2)}`).join(' ')}"></polyline>`;
      }
      svg = `<svg class="rb-svg" viewBox="0 0 ${W0} ${H0}" role="img" aria-label="${h(b.title)}">${grid}${svg}</svg><ul class="rb-legend rb-ticks">${(b.ticks || []).map((tk) => `<li>${h(tk.s)}</li>`).join('')}</ul><ul class="rb-legend">${(b.labels || []).map((l, i) => `<li>${h(l)} ${h((b.shown || [])[i] || '')}</li>`).join('')}</ul>`;
    }
    return `<figure class="rb-chart"><figcaption>${h(b.title)}</figcaption>${svg}</figure>`;
  }
  const photoUrls = {};
  const photoWait = {};
  function photoSrc(id) {
    if (photoUrls[id]) return photoUrls[id];
    if (!photoWait[id] && NS.ops && NS.ops.files) {
      photoWait[id] = NS.ops.files
        .get(id)
        .then((blob) => {
          if (blob) photoUrls[id] = URL.createObjectURL(blob);
          refresh();
        })
        .catch(() => {});
    }
    return '';
  }
  function photoHTML(id, caption) {
    const src = photoSrc(id);
    return `<figure class="rb-photo">${src ? `<img src="${h(src)}" alt="${h(caption || '')}">` : '<span class="rb-photo-wait"></span>'}${caption ? `<figcaption>${h(caption)}</figcaption>` : ''}</figure>`;
  }
  function modelHTML(m) {
    const accent = /^#[0-9A-F]{6}$/i.test(m.cover && m.cover.accent) ? m.cover.accent : '#1F2937';
    const out = [];
    const c = m.cover || {};
    if (c.on) {
      const lines = c.lines || [];
      // the band's words in white or ink, whichever reads better on the accent (as the PDF draws them)
      const ink = NS.brand.contrast(accent, '#FFFFFF') >= NS.brand.contrast(accent, '#1A1D21') ? '#FFFFFF' : '#1A1D21';
      out.push(
        `<header class="rb-cover rb-cover-${h(c.style)}" style="--rb-accent:${accent};--rb-on:${ink}">${c.style === 'photo' && c.photoId ? photoHTML(c.photoId, '') : ''}<h1>${h(lines[0] || '')}</h1>${lines
          .slice(1)
          .map((l) => `<p>${h(l)}</p>`)
          .join('')}</header>`
      );
    } else out.push(`<header class="rb-head"><h1>${h(m.title)}</h1><p>${h(m.subtitle)}</p></header>`);
    (m.blocks || []).forEach((b) => {
      if (b.k === 'h1') out.push(`<h2 class="rb-h1">${h(b.text)}</h2>`);
      else if (b.k === 'h2') out.push(`<h3 class="rb-h2">${h(b.text)}</h3>`);
      else if (b.k === 'p') out.push(`<p>${runsHTML(b.runs)}</p>`);
      else if (b.k === 'ul') out.push(`<ul>${(b.items || []).map((it) => `<li>${runsHTML(it)}</li>`).join('')}</ul>`);
      else if (b.k === 'tiles') out.push(`<div class="rb-tiles">${(b.items || []).map((it) => `<div class="rb-tile"><span class="rb-tile-l">${h(it.label)}</span><span class="rb-tile-v">${h(it.value)}</span></div>`).join('')}</div>`);
      else if (b.k === 'table') out.push(tableHTML(b));
      else if (b.k === 'chart') out.push(chartHTML(b, accent));
      else if (b.k === 'photo') out.push(photoHTML(b.id, b.caption));
      else if (b.k === 'note') out.push(`<p class="rb-note">${h(b.text)}</p>`);
      else if (b.k === 'break') out.push('<hr class="rb-break">');
    });
    return out.join('');
  }
  function previewHTML(C) {
    const errs = C.errors.length ? `<ul class="rb-errors" role="alert">${C.errors.map((e) => `<li>${h(e.message)}</li>`).join('')}</ul>` : '';
    if (!C.model) return errs || '<p class="cs-muted">Nothing to preview yet.</p>';
    return `${errs}<article class="rb-doc" aria-label="Report preview">${modelHTML(C.model)}</article>`;
  }

  /* ---------- files ---------- */
  const slug = (s) =>
    String(s || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  function fileBase(ws, m) {
    const per = R().periodLabel(m.period.from, m.period.to);
    const period = m.kind === 'distribution' ? m.period.to : per.short !== 'This period' ? per.short : `${m.period.from}_to_${m.period.to}`;
    return [ws.tenant.shortName || ws.tenant.name, m.title, period, m.recipient ? m.recipient.id : 'all'].map(slug).filter(Boolean).join('_');
  }
  /** The photos the model draws, as bytes, from the file store. */
  async function imagesFor(m) {
    const ids = [];
    if (m.cover && m.cover.on && m.cover.style === 'photo' && m.cover.photoId) ids.push(m.cover.photoId);
    (m.blocks || []).forEach((b) => b.k === 'photo' && ids.push(b.id));
    const out = {};
    for (const id of ids) {
      try {
        const blob = await NS.ops.files.get(id);
        if (blob) out[id] = { bytes: new Uint8Array(await blob.arrayBuffer()) };
      } catch (e) {
        /* a photo this browser did not keep is left out */
      }
    }
    return out;
  }
  async function pdfBytes(m) {
    const ws = W();
    const model = Object.assign({}, m, { when: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') });
    const logo = await NS.reportsPdf.logoFor(ws.tenant);
    return NS.reportsPdf.compose(model, { images: await imagesFor(model), logo });
  }
  /** The model of what the preview shows now, or null while an error stands. */
  function shown() {
    const ws = W();
    const t = st().draft;
    if (!ws || !t) return null;
    const C = current(ws, t);
    return C.model && !C.errors.length ? C.model : null;
  }
  async function withBusy(text, fn) {
    st().busy = text;
    NS.app.render();
    try {
      await fn();
    } catch (e) {
      if (window.console) console.error(e);
      U.toast((e && e.message && /character the PDF font cannot show/.test(e.message) ? e.message : '') || 'The file could not be made.');
    } finally {
      st().busy = '';
      NS.app.render();
    }
  }

  /* ---------- the tab ---------- */
  function tabButton(tab) {
    if (!E.diy || !NS.app.can('operate')) return '';
    return `<button type="button" class="cs-tab" data-action="rep-tab" data-t="investor" aria-pressed="${tab === 'investor'}">Investor reports</button>`;
  }
  function tabHTML(tab, w) {
    if (tab !== 'investor' || !E.diy || !NS.app.can('operate') || !w) return '';
    if (load.failed) return '<div class="rb"><p class="rb-msg" role="alert">This part of the page did not load. Reload to try again.</p></div>';
    if (!load.settled) return '<div class="rb"><p class="cs-muted" role="status">Loading…</p></div>';
    const s = st();
    if (s.view === 'edit' && s.draft && templates(w).some((t) => t.id === s.draft.id)) return editorHTML(w, s.draft);
    s.view = 'list';
    return listHTML(w);
  }
  NS.hooks.reportTabs = (NS.hooks.reportTabs || []).concat([tabButton]);
  NS.hooks.reportTab = (NS.hooks.reportTab || []).concat([tabHTML]);

  /* ---------- actions ---------- */
  NS.changes['rb-new'] = (el) => {
    const nw = st().nw;
    const k = el.getAttribute('data-k');
    if (k === 'name') {
      nw.name = el.value;
      return;
    }
    if (k === 'offs') {
      nw.offs = nw.offs.filter((x) => x !== el.value);
      if (el.checked) nw.offs.push(el.value);
    } else nw[k] = el.value;
    if (k === 'type') nw.start = el.value;
    st().msg = '';
    NS.app.render();
  };
  NS.actions['rb-create'] = () => {
    const ws = W();
    const s = st();
    const nw = s.nw;
    if (nw.scope === 'some' && !nw.offs.length) {
      s.msg = 'Choose at least one offering.';
      return NS.app.render();
    }
    const scope = nw.scope === 'some' ? { offeringIds: nw.offs.slice() } : { firm: true };
    const t = R().startFrom(ws, nw.start || nw.type, { name: String(nw.name || '').trim() || undefined, scope, by: NS.app.actor() });
    NS.app.save();
    s.nw = { type: nw.type, start: nw.type, name: '', scope: 'firm', offs: [] };
    openTemplate(t);
  };
  function openTemplate(t) {
    const s = st();
    s.view = 'edit';
    s.id = t.id;
    s.draft = clone(t);
    s.pdf = null;
    s.msg = '';
    s.del = '';
    s.open = '';
    s.adjusted = false;
    s.split = null;
    s.leave = false;
    NS.app.render();
    window.scrollTo(0, 0);
  }
  NS.actions['rb-open'] = (el) => {
    const t = templates(W()).find((x) => x.id === el.getAttribute('data-id'));
    if (t) openTemplate(t);
  };
  /** Whether the template being edited differs from the version stored. */
  function unsaved() {
    const s = st();
    if (!s.draft) return false;
    const kept = templates(W()).find((x) => x.id === s.draft.id);
    const strip = (t) => Object.assign(R().normalise(t), { version: 0, updatedAt: '', updatedBy: '' });
    return !kept || JSON.stringify(strip(s.draft)) !== JSON.stringify(strip(kept));
  }
  NS.actions['rb-back'] = () => {
    const s = st();
    if (unsaved() && !s.leave) {
      s.leave = true;
      NS.app.render();
      window.scrollTo(0, 0);
      return;
    }
    toList();
  };
  NS.actions['rb-leave'] = () => toList();
  NS.actions['rb-save-back'] = () => {
    NS.actions['rb-save']();
    toList();
  };
  function toList() {
    const s = st();
    s.leave = false;
    s.view = 'list';
    s.draft = null;
    s.pdf = null;
    s.msg = '';
    NS.app.render();
    window.scrollTo(0, 0);
  };
  NS.actions['rb-del'] = (el) => {
    if (!NS.app.can('configure')) return;
    st().del = el.getAttribute('data-id');
    NS.app.render();
  };
  NS.actions['rb-del-no'] = () => {
    st().del = '';
    NS.app.render();
  };
  NS.actions['rb-del-yes'] = (el) => {
    if (!NS.app.can('configure')) return;
    R().remove(W(), el.getAttribute('data-id'), { by: NS.app.actor() });
    NS.app.save();
    st().del = '';
    NS.app.render();
  };
  NS.changes['rb-draft'] = (el) => {
    const t = st().draft;
    if (!t) return;
    if (el.getAttribute('data-k') === 'name') t.name = el.value;
  };
  NS.changes['rb-tscope'] = (el) => {
    const t = st().draft;
    if (!t || !el.checked) return;
    t.scope = el.value === 'some' ? { offeringIds: [] } : { firm: true };
    NS.app.render();
  };
  NS.changes['rb-tscope-off'] = (el) => {
    const t = st().draft;
    if (!t || !t.scope.offeringIds) return;
    t.scope.offeringIds = t.scope.offeringIds.filter((x) => x !== el.value);
    if (el.checked) t.scope.offeringIds.push(el.value);
    NS.app.render();
  };
  NS.changes['rb-on'] = (el) => {
    const t = st().draft;
    const sec = t && sectionOf(t, el.getAttribute('data-key'));
    if (!sec || sec.key === 'disclosures') return;
    sec.on = el.checked;
    NS.app.render();
  };
  NS.actions['rb-move'] = (el) => {
    const t = st().draft;
    if (!t) return;
    R().move(t, el.getAttribute('data-key'), el.getAttribute('data-dir') === 'up' ? -1 : 1);
    NS.app.render();
  };
  NS.actions['rb-sec'] = (el) => {
    const s = st();
    const k = el.getAttribute('data-key');
    s.open = s.open === k ? '' : k;
    s.msg = '';
    s.adjusted = false;
    NS.app.render();
  };
  NS.changes['rb-cover'] = (el) => {
    const s = st();
    const t = s.draft;
    if (!t) return;
    const k = el.getAttribute('data-k');
    s.msg = '';
    if (k === 'style') t.cover.style = el.value;
    else if (k === 'accent') {
      const hex = NS.brand.normHex(el.value);
      if (!hex) {
        s.msg = 'Enter a color like #1F3A5F.';
        return NS.app.render();
      }
      const ok = NS.brand.ensureContrast(hex, '#FFFFFF', 3);
      t.cover.accent = NS.brand.normHex(ok) || hex;
      s.adjusted = t.cover.accent !== hex;
    }
    NS.app.render();
  };
  NS.changes['rb-opt'] = (el) => {
    const t = st().draft;
    const sec = t && sectionOf(t, el.getAttribute('data-key'));
    if (!sec) return;
    sec.opts = sec.opts || {};
    const k = el.getAttribute('data-k');
    if (el.type === 'checkbox') sec.opts[k] = el.checked;
    else sec.opts[k] = el.value;
    if (el.type === 'text') livePreview();
    else NS.app.render();
  };
  NS.changes['rb-chart'] = (el) => {
    const t = st().draft;
    if (!t) return;
    t.chart = el.value;
    const sec = sectionOf(t, 'chart');
    if (sec) sec.on = el.value !== 'none';
    NS.app.render();
  };
  NS.changes['rb-fig'] = (el) => {
    const t = st().draft;
    if (!t) return;
    const it = itemOf(W(), t, el.getAttribute('data-h'));
    const f = it && it.figures[Number(el.getAttribute('data-i'))];
    if (!f) return;
    f[el.getAttribute('data-f')] = el.value;
    livePreview();
  };
  NS.actions['rb-fig-add'] = (el) => {
    const t = st().draft;
    if (!t) return;
    const it = itemOf(W(), t, el.getAttribute('data-h'));
    if (it && it.figures.length < 20) it.figures.push({ label: '', value: '' });
    NS.app.render();
  };
  NS.actions['rb-save'] = () => {
    const s = st();
    if (!s.draft) return;
    const t = R().save(W(), s.draft, { by: NS.app.actor() });
    NS.app.save();
    s.draft = clone(t);
    s.msg = '';
    s.leave = false;
    NS.app.render();
    U.toast(`Saved, version ${t.version}`);
  };
  NS.changes['rb-spec'] = (el) => {
    const s = st();
    if (!s.spec) return;
    const k = el.getAttribute('data-k');
    if (el.type === 'checkbox') s.spec[k] = el.checked;
    else if (el.type === 'radio') {
      if (!el.checked) return;
      s.spec[k] = el.value;
    } else s.spec[k] = el.value;
    if (k === 'from' || k === 'to') s.spec.preset = 'custom';
    if (k === 'fund' || k === 'who' || k === 'run' || k === 'year' || k === 'inv' || k === 'preset') s.spec.as = '';
    s.pdf = null;
    NS.app.render();
  };
  NS.actions['rb-pdf'] = () => {
    const m = shown();
    if (!m) return;
    withBusy('Making the PDF…', async () => {
      const bytes = await pdfBytes(m);
      // drawn into a holder outside the view, so a redraw while the pages are made loses nothing
      const box = document.createElement('div');
      box.hidden = true;
      document.body.appendChild(box);
      try {
        await NS.esign.viewPdf(box, new Blob([bytes], { type: 'application/pdf' }), m.meta.title, true);
        st().pdf = { html: box.innerHTML };
      } finally {
        box.remove();
      }
    }).then(() => {
      const el = document.getElementById('rb-pdfpanel');
      if (el) el.scrollIntoView({ block: 'start' });
    });
  };
  NS.actions['rb-pdf-close'] = () => {
    st().pdf = null;
    NS.app.render();
  };
  NS.actions['rb-dl-pdf'] = () => {
    const m = shown();
    if (!m) return;
    withBusy('Making the PDF…', async () => {
      const bytes = await pdfBytes(m);
      await U.download(`${fileBase(W(), m)}.pdf`, bytes, { mime: 'application/pdf' });
    });
  };
  NS.actions['rb-dl-xlsx'] = () => {
    const m = shown();
    if (!m) return;
    withBusy('Making the spreadsheet…', async () => {
      if (!(NS.files && NS.files.workbook)) await NS.esignKit.loadScript(near('filesout.js'), () => !!(NS.files && NS.files.workbook));
      const bytes = NS.files.workbook(R().sheets(m));
      await U.download(`${fileBase(W(), m)}.xlsx`, bytes, { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    });
  };

  NS.reportsUI = {
    PARTS,
    part,
    refresh,
    state: () => st()
  };

  (async () => {
    for (const name of PARTS) {
      if (!(await script(name))) {
        load.failed = true;
        break;
      }
    }
    load.settled = true;
    refresh();
  })();
})(window.CVPortal);
