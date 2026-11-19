/*
 * The AML program record (plan 08-11, D-04), self-serve edition only. One console page under Report: the few fields only
 * the firm can type (the policy and who approved it, the responsible person, a risk assessment, escalation, training and
 * independent review entries), the procedures in force compiled from the Integrations settings, the screening log compiled
 * from the audit log's screening and review entries, and the retention line. It exports as one self-contained HTML file
 * (no script, nothing loaded from outside) that opens and prints anywhere; each export is written to the audit log.
 * Everything runs in the browser: no request to any server.
 * Data: ws.amlProgram = { policy: { statement, scope, adoptedOn, approvedBy }, officer: { name, title, designatedOn },
 * risk, escalation, training: [{ who, on }], reviews: [{ who, on, findings }] }; every field optional, dates YYYY-MM-DD.
 */
(function (NS) {
  'use strict';
  const U = NS.ui;
  const h = U.h;
  const W = () => NS.state.ws;
  const NONE = 'Not recorded';
  const RETENTION = 'Sanctions records are kept for ten years.';
  const EXPORTED = 'AML program record exported';
  const UPDATED = 'AML program record updated';
  /** The audit log's screening and review entries (operations.js and integrations.js write them). */
  const LOG_ACTIONS = ['Sanctions and PEP screening run', 'Screening result recorded', 'Screening match cleared', 'Screening match escalated', 'Investor held for review', 'Investor approved after review', 'Investor declined after review'];
  /** The typed fields: id, path in ws.amlProgram, label, kind ('area' | 'date' | text). */
  const FIELDS = [
    ['aml-statement', 'policy.statement', 'Statement', 'area'],
    ['aml-scope', 'policy.scope', 'Scope', 'area'],
    ['aml-adopted-on', 'policy.adoptedOn', 'Adopted on', 'date'],
    ['aml-approved-by', 'policy.approvedBy', 'Approved by', ''],
    ['aml-officer-name', 'officer.name', 'Name', ''],
    ['aml-officer-title', 'officer.title', 'Title', ''],
    ['aml-designated-on', 'officer.designatedOn', 'Designated on', 'date'],
    ['aml-risk', 'risk', 'Investor types, countries and offerings', 'area'],
    ['aml-escalation', 'escalation', 'Who is told of a possible match and what is reported', 'area']
  ].map(([id, path, label, kind]) => ({ id, path, label, kind }));
  const field = (id) => FIELDS.find((f) => f.id === id);
  const str = (v) => (v == null ? '' : String(v));
  const get = (o, path) => str(path.split('.').reduce((x, k) => (x == null ? x : x[k]), o));

  /** The record as stored, with every field present (read only: nothing is written to the workspace). */
  function record(ws) {
    const a = ws && ws.amlProgram && typeof ws.amlProgram === 'object' ? ws.amlProgram : {};
    const list = (x) => (Array.isArray(x) ? x.filter((e) => e && typeof e === 'object') : []);
    return {
      policy: Object.assign({ statement: '', scope: '', adoptedOn: '', approvedBy: '' }, a.policy),
      officer: Object.assign({ name: '', title: '', designatedOn: '' }, a.officer),
      risk: str(a.risk),
      escalation: str(a.escalation),
      training: list(a.training),
      reviews: list(a.reviews)
    };
  }
  /** Newest first (by date, then by the order entered). */
  const newest = (list) =>
    list
      .map((e, i) => ({ e, i }))
      .sort((x, y) => (str(y.e.on) > str(x.e.on) ? 1 : str(y.e.on) < str(x.e.on) ? -1 : y.i - x.i))
      .map((x) => x.e);
  const shown = (v) => (str(v).trim() ? v : NONE);
  const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? U.date(v) : shown(v));

  /** The procedures in force, from the Integrations settings: [[label, value], ...]. */
  function procedures(ws) {
    const IV = NS.integrations;
    if (!IV) return [];
    const c = IV.ensure(ws);
    const r = c.rules;
    const names = (k) => IV.activeFor(ws, k).map((x) => x.name).join(', ');
    const n = (v, d) => Math.round(Number(v)) || d;
    return [
      ['Automated verification', c.configured ? 'On' : 'Not turned on'],
      [IV.KINDS.identity, names('identity')],
      [IV.KINDS.aml, names('aml')],
      ['Re-screening', `Every ${n(r.rescreenDays, 30)} days`],
      [IV.KINDS.accreditation, names('accreditation')],
      ['Verified accreditation required', { '506c': 'For Rule 506(c) offerings', all: 'For every offering', none: 'Never (self-certification only)' }[r.accreditationFor] || 'For Rule 506(c) offerings'],
      ['Accreditation valid for', `${n(r.validDays, 90)} days`],
      ['Politically exposed persons', r.holdOnPep ? 'Held for enhanced due diligence' : 'Not held'],
      ['Approval', r.autoApprove ? 'Automatic when every check passes' : 'Manual']
    ];
  }
  /** The screening log, newest first: every screening and review entry of the audit log. */
  function screeningLog(ws) {
    const byId = {};
    (ws.investors || []).forEach((i) => (byId[i.id] = i));
    const log = NS.audit ? NS.audit.ensureLog(ws) : ws.audit || [];
    return log
      .filter((e) => LOG_ACTIONS.indexOf(e.action) >= 0)
      .map((e) => {
        const inv = byId[e.record];
        const title = inv ? inv.title : '';
        let detail = str(e.detail);
        if (title && detail.indexOf(title + ': ') === 0) detail = detail.slice(title.length + 2);
        return { at: str(e.at), seq: e.seq || 0, investor: title || str(e.record), entry: e.action, detail, by: str(e.actor) };
      })
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.seq - a.seq));
  }

  /* ---------- Shared pieces of the page and the export (every value escaped) ---------- */
  const dl = (rows, id) => `<dl${id ? ` id="${id}"` : ''} class="cs-kv">${rows.map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${h(v)}</dd></div>`).join('')}</dl>`;
  const table = (id, head, rows, compact) =>
    rows.length
      ? `<div class="tbl-scroll"><table${id ? ` id="${id}"` : ''} class="cs-tbl${compact ? ' cs-tbl-compact' : ''}"><thead><tr>${head.map((x) => `<th scope="col">${h(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : `<p class="cs-muted">${NONE}</p>`;
  const logTable = (ws) => table('aml-log', ['Date', 'Investor', 'Entry', 'Detail', 'By'], screeningLog(ws).map((e) => [U.date(e.at.slice(0, 10)), e.investor, e.entry, e.detail, e.by]), true);
  const trainingRows = (a) => newest(a.training).map((e) => [day(e.on), shown(e.who)]);
  const reviewRows = (a) => newest(a.reviews).map((e) => [day(e.on), shown(e.who), shown(e.findings)]);

  /* ---------- The page ---------- */
  function input(f, a, edit) {
    const v = get(a, f.path);
    const ro = edit ? '' : ' readonly';
    const box = f.kind === 'area' ? `<textarea id="${f.id}" name="${f.id}" rows="3" maxlength="4000"${ro}>${h(v)}</textarea>` : `<input id="${f.id}" name="${f.id}" type="${f.kind === 'date' ? 'date' : 'text'}" maxlength="200" value="${h(v)}"${ro}>`;
    return `<label class="cs-field" for="${f.id}"><span>${h(f.label)}</span>${box}</label>`;
  }
  /** Training and independent review entries: newest first; an admin adds and removes them. */
  const LISTS = {
    training: { table: 'aml-training', head: ['Date', 'Who'], cells: (e) => [day(e.on), shown(e.who)], fields: [['aml-training-who', 'who', 'Who', 'text'], ['aml-training-on', 'on', 'Date', 'date']] },
    reviews: { table: 'aml-reviews', head: ['Date', 'Who', 'Findings'], cells: (e) => [day(e.on), shown(e.who), shown(e.findings)], fields: [['aml-review-who', 'who', 'Who', 'text'], ['aml-review-on', 'on', 'Date', 'date'], ['aml-review-findings', 'findings', 'Findings', 'text']] }
  };
  function entries(a, key, edit) {
    const L = LISTS[key];
    const list = newest(a[key]);
    const rows = list.map((e) => `<tr>${L.cells(e).map((c) => `<td>${h(c)}</td>`).join('')}${edit ? `<td class="num"><button class="cs-btn cs-btn-small" type="button" data-action="aml-remove" data-list="${key}" data-id="${h(e.id || '')}">Remove</button></td>` : ''}</tr>`).join('');
    const tbl = list.length ? `<div class="tbl-scroll"><table id="${L.table}" class="cs-tbl"><thead><tr>${L.head.map((x) => `<th scope="col">${x}</th>`).join('')}${edit ? '<th scope="col"><span class="sr-only">Remove</span></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="cs-muted">${NONE}</p>`;
    const add = edit ? `<div class="cs-grid cs-grid-3">${L.fields.map(([id, , label, type]) => `<label class="cs-field" for="${id}"><span>${label}</span><input id="${id}" type="${type}" maxlength="200" value=""></label>`).join('')}</div><div class="cs-row"><button class="cs-btn" type="button" data-action="aml-add" data-list="${key}">Add</button></div>` : '';
    return tbl + add;
  }
  NS.views['console-aml'] = {
    mode: 'console',
    edition: 'diy',
    render() {
      const K = NS.consoleKit;
      const ws = W();
      const a = record(ws);
      const edit = NS.app.can('configure');
      const f = (id) => input(field(id), a, edit);
      const actions = `${edit ? '<button class="cs-btn cs-btn-primary" type="submit" form="aml-form">Save</button>' : ''}<button class="cs-btn" type="button" data-action="aml-export">Export</button>`;
      return K.shell(
        `${K.head('AML program', '', actions)}
        <form id="aml-form" data-form="aml-save" novalidate style="display:contents">
          ${K.panel('Policy', `<div class="cs-grid">${f('aml-statement')}${f('aml-scope')}${f('aml-adopted-on')}${f('aml-approved-by')}</div>`)}
          ${K.panel('Responsible person', `<div class="cs-grid">${f('aml-officer-name')}${f('aml-officer-title')}${f('aml-designated-on')}</div>`)}
          ${K.panel('Risk assessment', f('aml-risk'))}
          ${K.panel('Procedures in force', dl(procedures(ws), 'aml-procedures'))}
          ${K.panel('Screening log', logTable(ws))}
          ${K.panel('Escalation', f('aml-escalation'))}
          ${K.panel('Training and independent review', `<h3>Training</h3>${entries(a, 'training', edit)}<h3>Independent reviews</h3>${entries(a, 'reviews', edit)}`)}
          ${K.panel('Retention', `<p id="aml-retention">${RETENTION}</p>`)}
        </form>`,
        'console-aml'
      );
    }
  };

  /** A calendar date written YYYY-MM-DD (2026-02-30 is not one). */
  const realDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  /** The value of a date field: { v } or { bad } (the browser could not read what was typed, or it is not a real date). */
  function dateOf(el) {
    const v = String((el && el.value) || '').trim();
    if ((el && el.validity && el.validity.badInput) || (v && !realDate(v))) return { bad: true, v: '' };
    return { v };
  }
  const BAD_DATE = 'Enter a real date.';
  /** Each field's own error under it (errors: [[id, message]]), the first one focused; earlier errors are cleared. */
  function showErrors(form, errors) {
    form.querySelectorAll('.aml-err').forEach((x) => x.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach((x) => {
      x.removeAttribute('aria-invalid');
      x.removeAttribute('aria-describedby');
    });
    errors.forEach(([id, msg]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', `${id}-error`);
      const s = document.createElement('span');
      s.className = 'cs-error aml-err';
      s.id = `${id}-error`;
      s.textContent = msg;
      el.insertAdjacentElement('afterend', s);
    });
    const first = errors.length && document.getElementById(errors[0][0]);
    if (first) first.focus();
  }
  /** The typed fields of the form read into a copy of the record: { a, changed (labels), errors }. Nothing is stored. */
  function readTyped(ws, form) {
    const a = record(ws);
    const changed = [];
    const errors = [];
    FIELDS.forEach((f) => {
      const el = form.elements[f.id];
      if (!el) return;
      let v = String(el.value || '').trim();
      if (f.kind === 'date') {
        const d = dateOf(el);
        if (d.bad) return errors.push([f.id, BAD_DATE]);
        v = d.v;
      }
      const [k1, k2] = f.path.split('.');
      const was = k2 ? a[k1][k2] : a[k1];
      if (str(was) === v) return;
      if (k2) a[k1][k2] = v;
      else a[k1] = v;
      changed.push(f.label);
    });
    return { a, changed, errors };
  }
  /** Stores a copy of the record made by readTyped and logs what changed. */
  function commit(ws, a, what) {
    ws.amlProgram = a;
    if (what.length) NS.audit.log(ws, { action: UPDATED, detail: what.join('; ') });
    NS.app.save(true);
    NS.app.render();
  }
  const ADMINS_ONLY = 'Only admins can change this. Ask an admin on your team.';
  NS.forms['aml-save'] = (form) => {
    const ws = W();
    if (!NS.app.can('configure')) return U.toast(ADMINS_ONLY);
    const r = readTyped(ws, form);
    if (r.errors.length) return showErrors(form, r.errors);
    commit(ws, r.a, r.changed);
    U.toast('Saved');
  };
  /** Adds a training or independent review entry (what was typed above is saved with it). */
  NS.actions['aml-add'] = (el) => {
    const ws = W();
    const form = document.getElementById('aml-form');
    const L = LISTS[el.getAttribute('data-list')];
    if (!form || !L) return;
    if (!NS.app.can('configure')) return U.toast(ADMINS_ONLY);
    const r = readTyped(ws, form);
    const e = { id: 'aml-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
    L.fields.forEach(([id, key, , type]) => {
      const box = document.getElementById(id);
      if (type === 'date') {
        const d = dateOf(box);
        if (d.bad || !d.v) r.errors.push([id, BAD_DATE]);
        e[key] = d.v;
      } else e[key] = String((box && box.value) || '').trim();
    });
    if (!e.who) r.errors.push([L.fields[0][0], 'Enter a name.']);
    if (r.errors.length) return showErrors(form, r.errors);
    const key = el.getAttribute('data-list');
    r.a[key] = r.a[key].concat([e]);
    commit(ws, r.a, r.changed.concat([`${key === 'training' ? 'Training' : 'Independent review'} entry added: ${e.who}, ${e.on}`]));
    U.toast('Added');
  };
  NS.actions['aml-remove'] = (el) => {
    const ws = W();
    const form = document.getElementById('aml-form');
    const key = el.getAttribute('data-list');
    if (!form || !LISTS[key]) return;
    if (!NS.app.can('configure')) return U.toast(ADMINS_ONLY);
    const r = readTyped(ws, form);
    if (r.errors.length) return showErrors(form, r.errors);
    const e = r.a[key].find((x) => x.id === el.getAttribute('data-id'));
    if (!e) return;
    r.a[key] = r.a[key].filter((x) => x !== e);
    commit(ws, r.a, r.changed.concat([`${key === 'training' ? 'Training' : 'Independent review'} entry removed: ${e.who}, ${e.on}`]));
    U.toast('Removed');
  };

  /* ---------- The export: one self-contained HTML document ---------- */
  function exportHtml(ws) {
    const a = record(ws);
    const t = ws.tenant;
    const firm = t.legalName || t.name || t.shortName || '';
    const v = (path) => shown(get(a, path));
    const d = (path) => day(get(a, path));
    const sec = (title, body) => `<h2>${h(title)}</h2>${body}`;
    const css =
      'body{font:14px/1.5 system-ui,sans-serif;color:#111;max-width:880px;margin:32px auto;padding:0 16px}h1{font-size:22px;margin:0}h2{font-size:16px;margin:28px 0 8px;padding-bottom:4px;border-bottom:1px solid #bbb}h3{font-size:14px;margin:16px 0 6px}p{margin:4px 0}.cs-kv{display:grid;grid-template-columns:minmax(150px,32%) 1fr;gap:4px 16px;margin:0}.cs-kv div{display:contents}dt{color:#555}dd{margin:0;white-space:pre-wrap}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}thead{display:table-header-group}tr{break-inside:avoid}.cs-muted{color:#555}';
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${h(firm)} AML program</title><style>${css}</style></head><body>
<h1>${h(firm)} AML program</h1>
<p>Exported ${h(U.date(NS.dates.today()))} by ${h(NS.app.actor())}</p>
${sec('Policy', dl([['Statement', v('policy.statement')], ['Scope', v('policy.scope')], ['Adopted on', d('policy.adoptedOn')], ['Approved by', v('policy.approvedBy')]]))}
${sec('Responsible person', dl([['Name', v('officer.name')], ['Title', v('officer.title')], ['Designated on', d('officer.designatedOn')]]))}
${sec('Risk assessment', dl([[field('aml-risk').label, v('risk')]]))}
${sec('Procedures in force', dl(procedures(ws)))}
${sec('Screening log', logTable(ws))}
${sec('Escalation', dl([[field('aml-escalation').label, v('escalation')]]))}
${sec('Training and independent review', `<h3>Training</h3>${table('aml-training', ['Date', 'Who'], trainingRows(a))}<h3>Independent reviews</h3>${table('aml-reviews', ['Date', 'Who', 'Findings'], reviewRows(a))}`)}
${sec('Retention', `<p>${RETENTION}</p>`)}
</body></html>
`;
  }
  const slug = (s) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'firm';
  NS.actions['aml-export'] = () => {
    const ws = W();
    const html = exportHtml(ws);
    const name = `${slug(ws.tenant.shortName || ws.tenant.name)}_aml_program_${NS.dates.today()}.html`;
    NS.audit.log(ws, { action: EXPORTED, record: name, detail: `${name}; SHA-256 ${NS.audit.sha256(html)}` });
    NS.app.save(true);
    U.download(name, html, { mime: 'text/html' });
  };

  NS.amlProgram = { record, procedures, screeningLog, exportHtml, RETENTION, NONE };
})(window.CVPortal);
