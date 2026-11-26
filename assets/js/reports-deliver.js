/*
 * Investor reports: generating, delivering and the archive (phase 12, plan 12-08). Two parts under the builder's preview
 * (NS.reportsUI.part): 'generate' makes the report for whoever the preview is set to, one file at a time, with progress
 * after each file and a way to stop; 'archive' lists this template's runs, newest first, with each file's download,
 * delivery by a named person (and a corrected report replacing an earlier one), the investors to send on paper (C-01),
 * opens, withdrawal by admins with a reason (C-04), and 'Tell investors', which only fills in the Notices page.
 *
 * The investor's side: an investor opening a report from Documents has the open counted (NS.hooks.documentOpened, the
 * hook taxdocs-investor.js also uses; a tax document is left to that hook).
 *
 * Every record and its change-log entry is written by NS.reportRecord (12-04); files are made and given back by
 * NS.reportsRun (12-07). Nothing here sends anything. Self-serve edition only (reports-ui.js is not on the managed page).
 */
(function (NS) {
  'use strict';
  const U = NS.ui;
  const h = (s) => NS.brand.esc(s);
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const R = () => NS.reportRecord;
  const CK = () => NS.consoleKit;
  const UI = () => NS.reportsUI;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const lastSpec = {};
  // fields here are tap targets of at least 44 px on the phone, as the builder's buttons are
  const TALL = ' style="min-height:44px"';
  const COUNSEL = 'Investors with no consent to electronic delivery on record. Their reports are in their Documents too. To be confirmed with counsel.';

  function st() {
    const ui = S().ui;
    if (!ui.rd) ui.rd = { gen: null, open: '', by: '', corr: false, corrRun: '', msg: '', paper: '', sent: {}, wd: '', why: '', wdMsg: '', dl: {}, busy: '' };
    return ui.rd;
  }
  const refresh = () => (UI() && UI().refresh ? UI().refresh() : NS.app.render());
  const offering = (ws, id) => (ws.offerings || []).find((o) => o.id === id) || null;
  const investor = (ws, id) => (ws.investors || []).find((i) => i.id === id) || null;
  const nameOf = (ws, id) => (investor(ws, id) || { title: id }).title || id;
  const docOf = (ws, id) => (ws.docs || []).find((d) => d.id === id && d.report && typeof d.report === 'object') || null;
  const stored = (ws, id) => ((ws.reports && ws.reports.templates) || []).find((t) => t.id === id) || null;
  const day = (iso) => (iso ? U.date(String(iso).slice(0, 10)) : '');
  const today = () => (NS.dates && NS.dates.today ? NS.dates.today() : new Date().toISOString().slice(0, 10));

  /** Whether the template shown differs from the version saved (the report is made from the saved version). */
  function unsaved(ws, t) {
    const kept = stored(ws, t.id);
    if (!kept) return true;
    const strip = (x) => Object.assign(NS.reports.normalise(x), { version: 0, updatedAt: '', updatedBy: '' });
    return JSON.stringify(strip(t)) !== JSON.stringify(strip(kept));
  }
  /** The investors a choice reaches: each recipient, or for one letter to everyone, every holder it goes to. */
  function reach(ws, t, spec, recipients) {
    if (recipients.length === 1 && recipients[0] === null) {
      const aud = Object.assign({}, spec.audience || {}, { statements: true });
      return { letter: true, n: NS.reports.recipients(ws, t, Object.assign({}, spec, { audience: aud })).length };
    }
    return { letter: false, n: recipients.filter(Boolean).length };
  }

  /* ---------- the page's own timings of the last run (performance.now around each file) ---------- */
  let timings = { start: 0, each: [], total: 0, files: 0 };

  /* ---------- Generate ---------- */
  function generateHTML(ws, ctx) {
    if (!NS.app.can('operate') || !NS.reportsRun) return '';
    const t = ctx.template;
    lastSpec[t.id] = ctx.spec ? JSON.parse(JSON.stringify(ctx.spec)) : null;
    const g = st().gen;
    const mine = g && g.tid === t.id;
    const busy = g && g.running;
    const lines = [];
    if (busy && mine) {
      lines.push(`<p class="rb-line" role="status" data-rd="progress">Made ${g.done} of ${g.total}</p>`);
      lines.push(`<div class="rb-acts"><button type="button" class="cs-btn" data-action="rd-stop"${g.stop ? ' disabled' : ''}>Stop</button></div>`);
      return CK().panel('Generate', `<div class="rd rd-gen">${lines.join('')}</div>`);
    }
    const r = ctx.recipients && ctx.recipients.length ? reach(ws, t, ctx.spec, ctx.recipients) : { letter: false, n: 0 };
    const label = r.letter ? `Generate one letter for ${plural(r.n, 'investor')}` : `Generate for ${plural(r.n, 'investor')}`;
    const dirty = unsaved(ws, t);
    const off = busy || dirty || !r.n || !ctx.model || (ctx.errors && ctx.errors.length);
    if (dirty) lines.push('<p class="rb-line">Save the report first. Reports are made from the saved version.</p>');
    if (busy && !mine) lines.push('<p class="rb-line">Another report is being made.</p>');
    lines.push(`<div class="rb-acts"><button type="button" class="cs-btn cs-btn-primary" data-action="rd-gen"${off ? ' disabled' : ''}>${h(label)}</button></div>`);
    if (mine && g.text) lines.push(`<p class="rb-line" role="status" data-rd="progress">${h(g.text)}</p>`);
    if (mine && g.msg) lines.push(`<p class="rb-msg" role="alert" data-rd="gen-msg">${h(g.msg)}</p>`);
    return CK().panel('Generate', `<div class="rd rd-gen">${lines.join('')}</div>`);
  }

  NS.actions['rd-gen'] = () => {
    const ws = W();
    const rb = UI() && UI().state ? UI().state() : null;
    const t0 = rb && rb.draft ? stored(ws, rb.draft.id) : null;
    if (!t0 || !NS.app.can('operate') || (st().gen && st().gen.running)) return;
    if (unsaved(ws, rb.draft)) return;
    const spec = specNow(ws, t0);
    if (!spec) return;
    let ids;
    try {
      ids = NS.reports.recipients(ws, t0, spec);
    } catch (e) {
      ids = [];
    }
    const total = ids.length;
    const g = (st().gen = { tid: t0.id, running: true, stop: false, done: 0, total, text: '', msg: '', run: '' });
    const start = performance.now();
    let last = start;
    timings = { start, each: [], total: 0, files: 0 };
    refresh();
    NS.reportsRun
      .generate(ws, t0, spec, {
        by: NS.app.actor(),
        shouldStop: () => g.stop,
        onEach: (x) => {
          const now = performance.now();
          timings.each.push(now - last);
          last = now;
          g.done = x.done;
          g.total = x.total;
          refresh();
        }
      })
      .then(
        (run) => {
          g.run = run.id;
          g.text = run.state === 'stopped' ? `Stopped after ${run.files.length} of ${g.total}` : `Made ${run.files.length} of ${g.total}`;
          st().open = run.id;
        },
        (e) => {
          if (e && e.run) {
            g.run = e.run.id;
            g.text = `Stopped after ${e.run.files.length} of ${g.total}`;
            st().open = e.run.id;
          }
          g.msg = (e && e.message) || 'The report could not be made.';
        }
      )
      .then(() => {
        timings.total = last - start;
        timings.files = timings.each.length;
        g.running = false;
        resetDelivery();
        NS.app.save();
        refresh();
      });
  };
  NS.actions['rd-stop'] = () => {
    const g = st().gen;
    if (g && g.running) {
      g.stop = true;
      refresh();
    }
  };
  /** The spec the preview was last drawn for (the builder draws it again on every change of its choices). */
  const specNow = (ws, t) => lastSpec[t.id] || null;

  /* ---------- the archive ---------- */
  function whoText(ws, run) {
    const a = run.audience || {};
    if (a.kind === 'investor') return `For ${nameOf(ws, a.investorId)}`;
    if (a.kind === 'fund') return `Every investor in ${(offering(ws, a.offeringId) || { name: a.offeringId }).name}`;
    if (a.kind === 'all') return 'Every investor, all their funds';
    if (a.kind === 'letter') return a.statements ? 'One letter for everyone, with statements' : 'One letter for everyone';
    return '';
  }
  const investorsOf = (run) => (run.files || []).reduce((a, f) => a.concat(f.investorIds.filter((x) => a.indexOf(x) < 0)), []);
  /** Investors who opened a delivered run, of all its investors. */
  function opened(ws, run) {
    const all = investorsOf(run);
    const seen = {};
    (run.files || []).forEach((f) => {
      const d = docOf(ws, f.id);
      const o = (d && d.report.opens) || {};
      Object.keys(o).forEach((k) => o[k] && o[k].count > 0 && (seen[k] = 1));
    });
    return { n: Object.keys(seen).length, of: all.length };
  }
  const opensText = (d) => {
    const n = d ? R().opensOf(d).count : 0;
    return n ? `Opened ${plural(n, 'time')}` : 'Not opened';
  };
  const stateText = (run) => (run.delivered ? 'Delivered' : run.state === 'stopped' ? 'Stopped' : run.state === 'generated' ? 'Not delivered' : 'Being made');
  /** Earlier delivered runs a run can correct: same type, same funds. */
  function earlier(ws, run) {
    const funds = (r) => JSON.stringify(investorsFunds(r));
    return R()
      .runsOf(ws)
      .filter((r) => r.id !== run.id && r.delivered && r.type === run.type && funds(r) === funds(run));
  }
  const investorsFunds = (r) =>
    (r.files || [])
      .map((f) => f.offeringId)
      .concat(r.audience && r.audience.offeringId ? [r.audience.offeringId] : [], (r.audience && r.audience.offeringIds) || [])
      .filter((x, k, a) => x && a.indexOf(x) === k)
      .sort();
  /** For each investor of the new run, the doc of the earlier run they have now. */
  function pairs(ws, run, old) {
    const out = {};
    investorsOf(run).forEach((inv) => {
      const f = (old.files || []).find((x) => x.investorIds.indexOf(inv) >= 0);
      const d = f ? docOf(ws, f.id) : null;
      if (d && d.report.state === 'delivered' && (d.investors || []).indexOf(inv) >= 0) out[inv] = d.id;
    });
    return out;
  }
  function fileHTML(ws, run, f, admin) {
    const s = st();
    const d = docOf(ws, f.id);
    const who = run.audience && run.audience.kind === 'letter' && !run.audience.statements ? `Everyone: ${plural(f.investorIds.length, 'investor')}` : f.investorIds.map((id) => nameOf(ws, id)).join(', ');
    const lines = [`<span class="strong">${h(who)}</span>`];
    if (d) {
      lines.push(`<span class="sub" data-rd="opens">${h(opensText(d))}</span>`);
      if (d.report.state === 'replaced') lines.push('<span class="sub" data-rd="state">Replaced by a corrected report</span>');
      if (d.report.state === 'withdrawn' && d.report.withdrawn) lines.push(`<span class="sub" data-rd="state">Withdrawn by ${h(d.report.withdrawn.by)} ${h(day(d.report.withdrawn.at))}: ${h(d.report.withdrawn.why)}</span>`);
      if (d.report.replaces) lines.push('<span class="sub">Corrects an earlier report</span>');
    }
    const live = d && (d.report.state === 'delivered' || d.report.state === 'replaced');
    const acts = [`<button type="button" class="cs-btn" data-action="rd-dl" data-run="${h(run.id)}" data-id="${h(f.id)}"${s.busy === f.id ? ' disabled' : ''}>Download</button>`];
    if (admin && live && s.wd !== f.id) acts.push(`<button type="button" class="cs-btn" data-action="rd-wd" data-id="${h(f.id)}">Withdraw</button>`);
    let wd = '';
    if (admin && live && s.wd === f.id)
      wd = `<div class="rb-form rd-wdform"><label class="cs-field" for="rd-why"><span>Why it is withdrawn</span><input id="rd-why" type="text" maxlength="200" autocomplete="off" data-input="rd-why" value="${h(s.why)}"${TALL}></label>
        ${s.wdMsg ? `<p class="rb-msg" role="alert" data-rd="wd-msg">${h(s.wdMsg)}</p>` : ''}
        <div class="rb-acts"><button type="button" class="cs-btn cs-btn-primary" data-action="rd-wd-yes" data-id="${h(f.id)}">Withdraw report</button><button type="button" class="cs-btn" data-action="rd-wd-no">Keep</button></div></div>`;
    const msg = s.dl[f.id] ? `<p class="rb-msg" role="alert" data-rd="dl-msg">${h(s.dl[f.id])}</p>` : '';
    const wait = s.busy === f.id ? '<p class="rb-line" role="status">Getting the file…</p>' : '';
    return `<li class="rb-item rd-file" data-id="${h(f.id)}"><div class="rb-item-main">${lines.join('')}</div><div class="rb-item-acts">${acts.join('')}</div>${wait}${msg}${wd}</li>`;
  }
  function paperHTML(ws, run) {
    const s = st();
    let list = [];
    try {
      list = R().paperList(ws, run.id);
    } catch (e) {
      list = [];
    }
    const rows = list.length
      ? `<ul class="rb-list">${list
          .map((p) => {
            const sent = p.sentOn
              ? `<span class="sub">Sent on paper ${h(day(p.sentOn))} by ${h(p.sentBy)}</span>`
              : `<label class="cs-field" for="rd-sent-${h(p.investorId)}"><span>Sent on</span><input id="rd-sent-${h(p.investorId)}" type="date" data-input="rd-sent" data-id="${h(p.investorId)}" value="${h(s.sent[p.investorId] || today())}"${TALL}></label>`;
            return `<li class="rb-item rd-pinv" data-id="${h(p.investorId)}"><div class="rb-item-main"><span class="strong">${h(p.name)}</span><span class="sub">${h(p.address || 'No mailing address on record')}</span>${sent}</div>
              <div class="rb-item-acts"><button type="button" class="cs-btn" data-action="rd-dl" data-run="${h(run.id)}" data-id="${h(p.fileId)}">Download PDF</button>${p.sentOn ? '' : `<button type="button" class="cs-btn" data-action="rd-mark" data-run="${h(run.id)}" data-id="${h(p.investorId)}">Mark sent on paper</button>`}</div>${s.dl[p.fileId] ? `<p class="rb-msg" role="alert">${h(s.dl[p.fileId])}</p>` : ''}</li>`;
          })
          .join('')}</ul>`
      : '<p class="rb-line">Every investor of this report has consented to electronic delivery.</p>';
    return `<div class="rd-paper"><p class="rb-line" data-rd="counsel">${COUNSEL}</p>${s.paperMsg ? `<p class="rb-msg" role="alert">${h(s.paperMsg)}</p>` : ''}${rows}</div>`;
  }
  function detailHTML(ws, run) {
    const s = st();
    const admin = NS.app.can('configure');
    const files = `<ul class="rb-list rd-files">${(run.files || []).map((f) => fileHTML(ws, run, f, admin)).join('')}</ul>`;
    const parts = [files];
    if (!run.delivered && run.state === 'generated') {
      const list = earlier(ws, run);
      const pick = s.corr
        ? list.length
          ? `<label class="cs-field" for="rd-corr-run"><span>The report it corrects</span><select id="rd-corr-run" data-change="rd-corr-run"${TALL}><option value="">Choose</option>${list
              .map((r) => `<option value="${h(r.id)}"${s.corrRun === r.id ? ' selected' : ''}>${h(`${r.title}, ${r.period.label || r.period.to}, delivered ${day(r.delivered.at)}`)}</option>`)
              .join('')}</select></label>`
          : '<p class="rb-line">No earlier delivered report of this type for these funds.</p>'
        : '';
      parts.push(`<div class="rb-form rd-deliver">
        <label class="cs-field" for="rd-by"><span>Delivered by</span><input id="rd-by" type="text" maxlength="80" autocomplete="name" data-input="rd-by" value="${h(s.by)}"${TALL}></label>
        <label class="rb-opt"><input type="checkbox" id="rd-corr" data-change="rd-corr"${s.corr ? ' checked' : ''}><span>This corrects an earlier report</span></label>
        ${pick}
        ${s.msg ? `<p class="rb-msg" role="alert" data-rd="msg">${h(s.msg)}</p>` : ''}
        <div class="rb-acts"><button type="button" class="cs-btn cs-btn-primary" data-action="rd-deliver" data-id="${h(run.id)}">Deliver</button></div>
      </div>`);
    } else if (!run.delivered && run.state === 'stopped') parts.push('<p class="rb-line">A stopped report is not delivered. Generate it again to deliver it.</p>');
    if (run.delivered) {
      parts.push(`<div class="rb-acts"><button type="button" class="cs-btn" data-action="rd-tell" data-id="${h(run.id)}">Tell investors</button><button type="button" class="cs-btn" data-action="rd-paper" data-id="${h(run.id)}" aria-expanded="${s.paper === run.id}">Send on paper</button></div>`);
      if (s.tellMsg) parts.push(`<p class="rb-msg" role="alert">${h(s.tellMsg)}</p>`);
      if (s.paper === run.id) parts.push(paperHTML(ws, run));
    }
    return `<div class="rd-detail">${parts.join('')}</div>`;
  }
  function archiveHTML(ws, ctx) {
    if (!NS.app.can('operate') || !R()) return '';
    const s = st();
    const runs = R()
      .runsOf(ws)
      .filter((r) => r.templateId === ctx.template.id);
    if (!runs.length) return CK().panel('Archive', '<div class="rd rd-archive"><p class="cs-muted">No report made from this template yet.</p></div>');
    const items = runs
      .map((run) => {
        const open = s.open === run.id;
        const lines = [`<span class="strong">${h(run.title)}</span>`, `<span class="sub">${h(run.period.label || run.period.to)} · ${h(whoText(ws, run))}</span>`, `<span class="sub">${h(plural(run.files.length, 'file'))} · ${h(stateText(run))}</span>`];
        if (run.delivered) {
          const o = opened(ws, run);
          lines.push(`<span class="sub">Delivered by ${h(run.delivered.by)} ${h(day(run.delivered.at))}</span>`);
          lines.push(`<span class="sub" data-rd="run-opens">Opened by ${o.n} of ${o.of}</span>`);
        }
        return `<li class="rb-item rd-run" data-id="${h(run.id)}"><div class="rb-item-main">${lines.join('')}</div><div class="rb-item-acts"><button type="button" class="cs-btn" data-action="rd-open" data-id="${h(run.id)}" aria-expanded="${open}">${open ? 'Close' : 'Open'}</button></div>${open ? detailHTML(ws, run) : ''}</li>`;
      })
      .join('');
    return CK().panel('Archive', `<div class="rd rd-archive"><ul class="rb-list rd-runs">${items}</ul></div>`);
  }

  /* ---------- archive actions ---------- */
  function resetDelivery() {
    const s = st();
    s.msg = '';
    s.corr = false;
    s.corrRun = '';
    s.paper = '';
    s.paperMsg = '';
    s.tellMsg = '';
    s.wd = '';
    s.why = '';
    s.wdMsg = '';
  }
  NS.actions['rd-open'] = (el) => {
    const s = st();
    const id = el.getAttribute('data-id');
    s.open = s.open === id ? '' : id;
    resetDelivery();
    NS.app.render();
  };
  NS.changes['rd-by'] = (el) => {
    st().by = el.value;
  };
  NS.changes['rd-why'] = (el) => {
    st().why = el.value;
  };
  NS.changes['rd-sent'] = (el) => {
    st().sent[el.getAttribute('data-id')] = el.value;
  };
  NS.changes['rd-corr'] = (el) => {
    const s = st();
    s.corr = !!el.checked;
    if (!s.corr) s.corrRun = '';
    s.msg = '';
    NS.app.render();
  };
  NS.changes['rd-corr-run'] = (el) => {
    st().corrRun = el.value;
    st().msg = '';
    NS.app.render();
  };
  NS.actions['rd-deliver'] = (el) => {
    const ws = W();
    const s = st();
    if (!NS.app.can('operate')) return;
    const by = document.getElementById('rd-by');
    if (by) s.by = by.value;
    const run = R().runOf(ws, el.getAttribute('data-id'));
    if (!run) return;
    try {
      let replaces = {};
      if (s.corr) {
        const old = s.corrRun ? R().runOf(ws, s.corrRun) : null;
        if (!old) throw new Error('Choose the report it corrects.');
        replaces = pairs(ws, run, old);
        if (!Object.keys(replaces).length) throw new Error('The report it corrects is not one these investors have now.');
      }
      R().deliver(ws, run.id, { by: s.by, replaces });
      resetDelivery();
      NS.app.save(true);
    } catch (e) {
      s.msg = (e && e.message) || 'This report could not be delivered.';
    }
    NS.app.render();
  };
  NS.actions['rd-tell'] = (el) => {
    const ws = W();
    try {
      S().ui.notice = R().noticeDraft(ws, el.getAttribute('data-id'));
    } catch (e) {
      st().tellMsg = (e && e.message) || 'The notice could not be prepared.';
      return NS.app.render();
    }
    NS.app.go('console-notices');
    window.scrollTo(0, 0);
  };
  NS.actions['rd-paper'] = (el) => {
    const s = st();
    const id = el.getAttribute('data-id');
    s.paper = s.paper === id ? '' : id;
    s.paperMsg = '';
    NS.app.render();
  };
  NS.actions['rd-mark'] = (el) => {
    const ws = W();
    const s = st();
    const inv = el.getAttribute('data-id');
    const input = document.getElementById(`rd-sent-${inv}`);
    const sentOn = input ? input.value : s.sent[inv] || today();
    try {
      R().markPaper(ws, el.getAttribute('data-run'), inv, { sentOn, by: NS.app.actor() });
      s.paperMsg = '';
      NS.app.save(true);
    } catch (e) {
      s.paperMsg = (e && e.message) || 'This could not be marked.';
    }
    NS.app.render();
  };
  NS.actions['rd-wd'] = (el) => {
    if (!NS.app.can('configure')) return;
    const s = st();
    s.wd = el.getAttribute('data-id');
    s.why = '';
    s.wdMsg = '';
    NS.app.render();
  };
  NS.actions['rd-wd-no'] = () => {
    const s = st();
    s.wd = '';
    s.why = '';
    s.wdMsg = '';
    NS.app.render();
  };
  NS.actions['rd-wd-yes'] = (el) => {
    if (!NS.app.can('configure')) return;
    const ws = W();
    const s = st();
    const input = document.getElementById('rd-why');
    if (input) s.why = input.value;
    try {
      R().withdraw(ws, el.getAttribute('data-id'), { by: NS.app.actor(), why: s.why });
      s.wd = '';
      s.why = '';
      s.wdMsg = '';
      NS.app.save(true);
    } catch (e) {
      s.wdMsg = (e && e.message) || 'This report could not be withdrawn.';
    }
    NS.app.render();
  };
  /** An archived file, byte-identical (RB-16): kept, or remade; when it cannot be given, the screen says why. */
  NS.actions['rd-dl'] = (el) => {
    const ws = W();
    const s = st();
    const runId = el.getAttribute('data-run');
    const fileId = el.getAttribute('data-id');
    const run = R().runOf(ws, runId);
    const file = run ? (run.files || []).find((f) => f.id === fileId) : null;
    if (!file || s.busy || !NS.app.can('operate')) return;
    s.busy = fileId;
    s.dl[fileId] = '';
    NS.app.render();
    NS.reportsRun
      .fileBytes(ws, runId, fileId)
      .then(
        (r) => {
          if (r && r.bytes) return U.download(file.name, r.bytes, { mime: 'application/pdf' });
          s.dl[fileId] = (r && r.error) || 'This file cannot be given.';
        },
        () => {
          s.dl[fileId] = 'This file cannot be given.';
        }
      )
      .then(() => {
        s.busy = '';
        NS.app.render();
      });
  };

  /* ---------- the investor's side ---------- */
  NS.hooks.documentOpened = NS.hooks.documentOpened || [];
  NS.hooks.documentOpened.push((doc) => {
    const ws = W();
    const d = doc && ws ? docOf(ws, doc.id) : null;
    if (!d) return '';
    const me = S().role === 'investor' ? S().viewer : null;
    if (me && (d.investors || []).indexOf(me) >= 0) {
      const was = R().opensOf(d).count;
      R().opened(ws, d.id, me);
      if (R().opensOf(d).count !== was) NS.app.save(true);
    }
    return d.report.state === 'replaced' ? '<p>Replaced by a corrected report.</p>' : '';
  });

  NS.reportsDeliver = { timings: () => JSON.parse(JSON.stringify(timings)) };
  UI().part('generate', { order: 10, render: (ws, ctx) => generateHTML(ws, ctx) });
  UI().part('archive', { order: 20, render: (ws, ctx) => archiveHTML(ws, ctx) });
})(window.CVPortal);
