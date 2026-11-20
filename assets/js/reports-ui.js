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
  const PARTS = Object.freeze(['reports-data.js', 'reports.js', 'reports-pdf.js', 'reports-record.js']);
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
  function editorHTML(ws, t) {
    const s = st();
    return `<div class="rb rb-edit">
      <div class="rb-bar"><button type="button" class="cs-btn rb-back" data-action="rb-back">Back to reports</button><h2>${h(t.name)}</h2></div>
      ${CK().panel(
        '',
        `<label class="cs-field" for="rb-tname"><span>Name</span><input id="rb-tname" type="text" maxlength="80" autocomplete="off" data-input="rb-draft" data-k="name" value="${h(t.name)}"></label>
        <div class="rb-acts"><button type="button" class="cs-btn cs-btn-primary" data-action="rb-save">Save</button><span class="rb-ver" id="rb-ver">Version ${h(t.version)}</span></div>`
      )}
      ${previewPanel(ws, t)}
      ${s.msg ? `<p class="rb-msg" role="alert">${h(s.msg)}</p>` : ''}
    </div>`;
  }

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
  function tableHTML(b) {
    const cls = (c) => (NUM[c.t] ? ' class="num"' : '');
    const row = (cells, tag) => `<tr>${cells.map((c, i) => `<${tag}${cls(b.cols[i] || {})}>${h(c.s)}</${tag}>`).join('')}</tr>`;
    return `<div class="tbl-scroll rb-tblwrap"><table class="rb-tbl"><caption>${h(b.title)}</caption><thead><tr>${b.cols.map((c) => `<th scope="col"${cls(c)}>${h(c.h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => row(r, 'td')).join('')}</tbody>${b.total ? `<tfoot>${row(b.total, 'td')}</tfoot>` : ''}</table></div>`;
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
    NS.app.render();
    window.scrollTo(0, 0);
  }
  NS.actions['rb-open'] = (el) => {
    const t = templates(W()).find((x) => x.id === el.getAttribute('data-id'));
    if (t) openTemplate(t);
  };
  NS.actions['rb-back'] = () => {
    const s = st();
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
  NS.actions['rb-save'] = () => {
    const s = st();
    if (!s.draft) return;
    const t = R().save(W(), s.draft, { by: NS.app.actor() });
    NS.app.save();
    s.draft = clone(t);
    s.msg = '';
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
