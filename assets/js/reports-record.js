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

  /* ---------- after delivery: paper, opens, withdrawal ---------- */
  /** The run's delivered doc an investor has, or null. */
  function docOfInvestor(ws, run, investorId) {
    const file = run.files.find((f) => f.investorIds.indexOf(investorId) >= 0);
    return file ? reportDoc(ws, file.id) : null;
  }
  /**
   * The investors of a run's files with no consent to electronic delivery on record (C-01): each with name, mailing
   * address, the file to print, and when and by whom it was sent on paper ('' until then).
   */
  function paperList(ws, runId) {
    const run = needRun(ws, runId);
    return investorsOf(run)
      .map((id) => investorOf(ws, id))
      .filter((inv) => inv && !edelivery(inv))
      .map((inv) => {
        const file = run.files.find((f) => f.investorIds.indexOf(inv.id) >= 0);
        const doc = reportDoc(ws, file.id);
        const p = (doc && doc.report.paper && doc.report.paper[inv.id]) || null;
        return { investorId: inv.id, name: inv.title, address: String(inv.address || ''), fileId: file.id, sentOn: p ? p.sentOn : '', sentBy: p ? p.by : '' };
      });
  }
  /** A delivered report on the paper list is marked sent on paper, with the date and the person. */
  function markPaper(ws, runId, investorId, a) {
    const run = needRun(ws, runId);
    if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(String(a.sentOn || ''))) refuse('Give the date it was sent on paper.');
    if (!a.by || !String(a.by).trim()) refuse('The person who sent it must be named.');
    if (!paperList(ws, runId).some((p) => p.investorId === investorId)) refuse('This investor is not on the paper list of this report.');
    if (!run.delivered) refuse('Only a delivered report can be sent on paper.');
    const doc = docOfInvestor(ws, run, investorId) || refuse('Only a delivered report can be sent on paper.');
    if (doc.report.state === 'withdrawn') refuse('This report was withdrawn.');
    const by = String(a.by).trim();
    doc.report.paper[investorId] = { sentOn: a.sentOn, by };
    log(ws, { action: 'Report sent on paper', fund: doc.offeringId, record: doc.id, actor: by, at: stamp(a.at), detail: `${doc.title} for ${nameOf(ws, investorId)} sent on paper on ${a.sentOn}` });
    return doc;
  }
  /** Opens of a report: how many investors opened it and how many times in all. */
  function opensOf(doc) {
    const o = (doc && doc.report && doc.report.opens) || {};
    const ids = Object.keys(o).filter((k) => o[k] && o[k].count > 0);
    return { investors: ids.length, count: ids.reduce((n, k) => n + o[k].count, 0) };
  }
  /** An investor opened a report they have. Anything else (hidden, withdrawn, not theirs) changes nothing. */
  function opened(ws, docId, investorId, at) {
    const doc = (ws.docs || []).find((d) => d.id === docId) || null;
    if (!isReport(doc) || doc.hidden || LIVE.indexOf(doc.report.state) < 0 || (doc.investors || []).indexOf(investorId) < 0) return doc;
    const inv = investorOf(ws, investorId);
    if (!inv) return doc;
    const when = stamp(at);
    if (!doc.report.opens || typeof doc.report.opens !== 'object') doc.report.opens = {};
    const o = doc.report.opens[investorId] || (doc.report.opens[investorId] = { first: '', last: '', count: 0 });
    if (!o.first) o.first = when;
    o.last = when;
    o.count += 1;
    log(ws, { action: 'Report opened', fund: doc.offeringId, record: doc.id, actor: `${inv.title} (investor)`, at: when, detail: `${doc.title}, open number ${o.count} by this investor` });
    return doc;
  }
  /**
   * The sponsor takes a report back (the screen limits this to admins, C-04): it leaves its investors' Documents; its
   * record and its record of opens stay.
   */
  function withdraw(ws, docId, a) {
    const doc = reportDoc(ws, docId);
    if (!doc || LIVE.indexOf(doc.report.state) < 0) refuse('This report cannot be withdrawn.');
    if (!a || !a.by || !String(a.by).trim()) refuse('The person withdrawing it must be named.');
    if (!a.why || !String(a.why).trim()) refuse('Say why it is withdrawn.');
    const at = stamp(a.at);
    const by = String(a.by).trim();
    doc.report.state = 'withdrawn';
    doc.report.withdrawn = { at, by, why: String(a.why).trim() };
    doc.hidden = true;
    const o = opensOf(doc);
    log(ws, { action: 'Report withdrawn', fund: doc.offeringId, record: doc.id, actor: by, at, detail: `${doc.title} for ${(doc.investors || []).map((id) => nameOf(ws, id)).join(', ')} withdrawn: ${doc.report.withdrawn.why}; opened ${plural(o.count, 'time')} by ${plural(o.investors, 'investor')}` });
    return doc;
  }
  /** A file's bytes are the ones on record: same SHA-256. */
  function verifyFile(ws, runId, fileId, bytes) {
    const run = runOf(ws, runId);
    const file = run ? run.files.find((f) => f.id === fileId) : null;
    if (!file || !bytes || !NS || !NS.audit || !NS.audit.sha256) return false;
    return NS.audit.sha256(bytes) === file.sha256;
  }

  /* ---------- the Notices page ---------- */
  /** 'Q4 2026' for a period ending in October to December 2026. */
  function quarterOf(day) {
    const [y, m] = String(day).split('-').map(Number);
    return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
  }
  /**
   * The Notices page's draft for a delivered run, with exactly the keys console.js noticeDraft writes: the investors it
   * was delivered to, the 'quarterly' template for a quarterly report and 'documents' otherwise. It is only a draft:
   * the person reads it, may change it, and sends it on the Notices page. When every file of the run is withdrawn there
   * is no one to tell: it refuses with one sentence, so the Notices page is never filled in for every investor.
   */
  function noticeDraft(ws, runId) {
    const run = needRun(ws, runId);
    if (!run.delivered) refuse('This report has not been delivered yet.');
    const kind = run.type === 'quarterly' ? 'quarterly' : 'documents';
    const docs = run.delivered.docs.map((id) => reportDoc(ws, id)).filter((d) => d && d.report.state !== 'withdrawn');
    const investors = uniq(docs.reduce((a, d) => a.concat(d.investors || []), []));
    if (!investors.length) refuse('Every file of this report is withdrawn; there is no one to tell.');
    const tpl = (NS && NS.NOTICE_TEMPLATES && NS.NOTICE_TEMPLATES[kind]) || { subject: '', body: '' };
    return { kind, audience: 'all', investors, pickerOpen: false, pickerQuery: '', includePending: true, quarter: quarterOf(run.period.to), docName: run.title, subject: tpl.subject, body: tpl.body, subjectEdited: false, bodyEdited: false, confirm: false };
  }

  const API = { CATS, ensure, newRun, addFile, finish, runsOf, runOf, docTitle, edelivery, deliver, paperList, markPaper, opened, opensOf, withdraw, verifyFile, noticeDraft };
  if (NS) NS.reportRecord = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
