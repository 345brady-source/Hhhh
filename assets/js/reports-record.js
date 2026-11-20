/*
 * The record of investor reports: every run (the template as used, the period, the audience, every file's size and
 * SHA-256), its delivery into investors' Documents, paper, opens, withdrawal and replacement, all on the change log.
 *
 * It mirrors the tax documents record (taxdocs.js): a delivered file is a ws.docs entry of the same shape, so the
 * investor's Documents (NS.ops.docsFor, portal.js allDocs) need no change, plus a `report` block. The file id is the doc
 * id, so NS.ops.files.get(doc.id) finds the bytes.
 *
 * Storage: ws.reports = { v: 1, templates: [], runs: [], splits: {} } (plan 12-02's NS.reports.ensure makes the same).
 *
 * This file works on plain data only. It touches no document, window or screen when it loads, so it also loads outside
 * a browser (the checks, and module.exports under Node). It builds no HTML: every string it returns is plain text.
 */
(function (NS) {
  'use strict';

  // The document categories of the sponsor's Documents page (console.js DOC_CATS).
  const CATS = { statement: 'Statements', distribution: 'Notices', quarterly: 'Reports', annual: 'Reports', performance: 'Reports', tax: 'Tax' };
  const LIVE = ['delivered', 'replaced'];

  function refuse(msg) {
    throw new Error(msg);
  }
  const stamp = (at) => at || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const copy = (x) => (x === undefined ? null : JSON.parse(JSON.stringify(x)));
  const log = (ws, e) => (NS && NS.audit && NS.audit.log ? NS.audit.log(ws, e) : null);
  const investorOf = (ws, id) => (ws.investors || []).find((i) => i.id === id) || null;
  const nameOf = (ws, id) => {
    const i = investorOf(ws, id);
    return i ? i.title : id;
  };
  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o.id === id) || null;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const uniq = (list) => list.filter((x, k) => list.indexOf(x) === k);

  function ensure(ws) {
    if (!ws.reports || typeof ws.reports !== 'object') ws.reports = { v: 1, templates: [], runs: [], splits: {} };
    const r = ws.reports;
    if (!r.v) r.v = 1;
    if (!Array.isArray(r.templates)) r.templates = [];
    if (!Array.isArray(r.runs)) r.runs = [];
    if (!r.splits || typeof r.splits !== 'object') r.splits = {};
    if (!Array.isArray(ws.docs)) ws.docs = [];
    return r;
  }

  /* ---------- runs and files ---------- */
  function runOf(ws, id) {
    return ensure(ws).runs.find((r) => r.id === id) || null;
  }
  const needRun = (ws, id) => runOf(ws, id) || refuse('That report run is not in this workspace.');
  function runsOf(ws) {
    return ensure(ws)
      .runs.map((r, k) => ({ r, k }))
      .sort((a, b) => (a.r.createdAt < b.r.createdAt ? 1 : a.r.createdAt > b.r.createdAt ? -1 : b.k - a.k))
      .map((x) => x.r);
  }
  function nextNumber(ws) {
    return ensure(ws).runs.reduce((n, r) => Math.max(n, Number(String(r.id).replace(/^rr-/, '')) || 0), 0) + 1;
  }
  /** The offerings a run covers: its audience's and its files'. */
  function fundsOf(run) {
    const a = run.audience || {};
    const ids = (run.files || []).map((f) => f.offeringId).concat(a.offeringId ? [a.offeringId] : [], Array.isArray(a.offeringIds) ? a.offeringIds : []);
    return uniq(ids.filter(Boolean));
  }
  /** The run's one offering, or '' when it covers none or several. */
  const fundOf = (run) => (fundsOf(run).length === 1 ? fundsOf(run)[0] : '');
  const investorsOf = (run) => uniq((run.files || []).reduce((a, f) => a.concat(f.investorIds), []));

  /** A new run, generating: a copy of the template as used, the period, the audience and the spec. Nothing is logged yet. */
  function newRun(ws, a) {
    const r = ensure(ws);
    if (!a || !a.template || typeof a.template !== 'object') refuse('A report run needs its template.');
    if (!a.by) refuse('The person generating the report must be named.');
    const p = a.period || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.to || ''))) refuse('A report run needs the end of its period.');
    const tpl = copy(a.template);
    const run = {
      id: `rr-${nextNumber(ws)}`,
      type: tpl.type || '',
      title: String(a.title || tpl.title || tpl.name || ''),
      templateId: tpl.id || '',
      template: tpl,
      period: { from: String(p.from || ''), to: String(p.to), label: String(p.label || '') },
      audience: copy(a.audience || {}),
      spec: copy(a.spec || {}),
      createdAt: stamp(a.at),
      createdBy: a.by,
      state: 'generating',
      files: [],
      delivered: null
    };
    r.runs.push(run);
    return run;
  }
  /** One generated file of a run: its investors, its offering, its name, size, SHA-256 and pages. */
  function addFile(ws, runId, a) {
    const run = needRun(ws, runId);
    if (run.state !== 'generating') refuse('Files can only be added while the report is being generated.');
    if (!a || !Number.isSafeInteger(a.size) || a.size <= 0) refuse('The file size must be a positive whole number of bytes.');
    if (!/^[0-9a-f]{64}$/.test(String(a.sha256 || ''))) refuse('The file needs its SHA-256 (64 hexadecimal characters).');
    const ids = Array.isArray(a.investorIds) ? uniq(a.investorIds.filter(Boolean).map(String)) : [];
    if (!ids.length) refuse('The file needs the investors it is for.');
    const n = String(run.id).replace(/^rr-/, '');
    const file = { id: `rf-${n}-${run.files.length + 1}`, investorIds: ids, offeringId: String(a.offeringId || ''), name: String(a.name || ''), size: a.size, sha256: a.sha256, pages: Number(a.pages) || 0 };
    run.files.push(file);
    return file;
  }
  /** Generation ends: 'generated', or 'stopped' when the person stopped it part-way. */
  function finish(ws, runId, a) {
    const run = needRun(ws, runId);
    if (run.state !== 'generating') refuse('This report is not being generated.');
    if (!a || !a.by) refuse('The person generating the report must be named.');
    run.state = a.stopped ? 'stopped' : 'generated';
    const t = run.template || {};
    log(ws, {
      action: a.stopped ? 'Report generation stopped' : 'Report generated',
      fund: fundOf(run),
      record: run.id,
      actor: a.by,
      at: stamp(a.at),
      detail: `${run.title}, ${run.period.label || run.period.to}: ${plural(run.files.length, 'file')} for ${plural(investorsOf(run).length, 'investor')}; template ${t.name || 'unnamed'}, version ${t.version || 1}`
    });
    return run;
  }

  /** The title investors see: the run's title and period, and the fund's name when the run covers several funds one each. */
  function docTitle(run, file, ws) {
    let t = `${run.title}, ${run.period.label || run.period.to}`;
    const funds = uniq((run.files || []).map((f) => f.offeringId).filter(Boolean));
    if (funds.length > 1 && file && file.offeringId) {
      const o = ws ? offeringOf(ws, file.offeringId) : null;
      t += ` - ${o ? o.name : file.offeringId}`;
    }
    return t;
  }

  /* ---------- delivery ---------- */
  /** Consent to electronic delivery on record: the general consent of onboarding, never the tax documents consent. */
  function edelivery(inv) {
    return !!(inv && inv.esignConsent && /electronic delivery/i.test(String(inv.esignConsent.scope || '')));
  }
  const isReport = (d) => !!(d && d.report && typeof d.report === 'object');
  function reportDoc(ws, id) {
    const d = (ws.docs || []).find((x) => x.id === id);
    return isReport(d) ? d : null;
  }
  function docRecord(ws, run, file, by, at) {
    return {
      id: file.id,
      title: docTitle(run, file, ws),
      fileName: file.name,
      type: 'application/pdf',
      size: file.size,
      sha256: file.sha256,
      cat: CATS[run.type] || 'Reports',
      offeringId: file.offeringId,
      audience: 'investors',
      investors: file.investorIds.slice(),
      date: run.period.to,
      hidden: false,
      publishedAt: at,
      publishedBy: by,
      report: { run: run.id, state: 'delivered', opens: {}, replaces: '', replacedBy: '', withdrawn: null, paper: {} }
    };
  }
  /**
   * A generated run goes to its investors' Documents: one doc per file, shown to exactly the file's investors, by a named
   * person, once. replaces = { investorId: oldDocId } names the report each corrected one replaces. Investors without
   * consent to electronic delivery on record get it in their Documents all the same and are listed for paper (C-01).
   * Everything is checked before anything is written.
   */
  function deliver(ws, runId, a) {
    const run = needRun(ws, runId);
    if (!a || !a.by || !String(a.by).trim()) refuse('The person delivering must be named.');
    if (run.delivered) refuse('This report has already been delivered.');
    if (run.state !== 'generated') refuse('Only a generated report can be delivered.');
    if (!run.files.length) refuse('This report has no files to deliver.');
    run.files.forEach((f) => {
      f.investorIds.forEach((id) => investorOf(ws, id) || refuse(`An investor of this report (${id}) is not in this workspace.`));
      if ((ws.docs || []).some((d) => d.id === f.id)) refuse('A document with this id already exists.');
    });
    const pairs = Object.keys(a.replaces || {}).map((invId) => {
      const old = reportDoc(ws, a.replaces[invId]);
      if (!old || old.report.state !== 'delivered' || (old.investors || []).indexOf(invId) < 0) refuse('The report it replaces must be one this investor has now.');
      const file = run.files.find((f) => f.investorIds.indexOf(invId) >= 0) || refuse('The report it replaces must be one this investor has now.');
      return { invId, old, file };
    });
    const at = stamp(a.at);
    const by = String(a.by).trim();
    const docs = run.files.map((f) => docRecord(ws, run, f, by, at));
    docs.forEach((d) => ws.docs.push(d));
    pairs.forEach((p) => {
      const doc = docs.find((d) => d.id === p.file.id);
      p.old.report.state = 'replaced';
      p.old.report.replacedBy = doc.id;
      p.old.report.replacedAt = at;
      if (!/\(replaced\)$/.test(p.old.title)) p.old.title = `${p.old.title} (replaced)`;
      doc.report.replaces = p.old.id;
      log(ws, { action: 'Report replaced', fund: p.old.offeringId, record: p.old.id, actor: by, at, detail: `${p.old.title} for ${nameOf(ws, p.invId)} replaced by ${doc.id} (${run.id}); it stays in the investor's Documents, marked replaced, and keeps its record of opens` });
    });
    const paper = investorsOf(run).filter((id) => !edelivery(investorOf(ws, id)));
    run.delivered = { at, by, docs: docs.map((d) => d.id) };
    log(ws, {
      action: 'Report delivered',
      fund: fundOf(run),
      record: run.id,
      actor: by,
      at,
      detail: `${run.title}, ${run.period.label || run.period.to}: ${plural(docs.length, 'document')} put in the Documents of ${plural(investorsOf(run).length, 'investor')}; ${paper.length} listed for paper`
    });
    return { docs, paper };
  }

  const API = { CATS, ensure, newRun, addFile, finish, runsOf, runOf, docTitle, edelivery, deliver };
  if (NS) NS.reportRecord = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
