/*
 * Report runs (plan 12-07): generates a report for one investor, every investor of a fund, every investor across all
 * their funds, or one letter for everyone, one PDF at a time, each file kept on the device before the next is made,
 * and every file recorded with its SHA-256 (NS.reportRecord). An archived file is given back byte-identical.
 *
 *   NS.reportsRun.generate(ws, template, spec, opts) → Promise<run>
 *     spec: plan 12-02's spec ({ from, to } | { runId } | { year }, plus audience)
 *     opts: { by, at, kit, store = NS.ops.files, logo, D = NS.reportsData, onEach({ done, total, file, ms }), shouldStop() }
 *     The caller saves the workspace.
 *
 * Files are kept as bytes through the store (NS.ops.files keeps { type, bytes }, never a Blob in IndexedDB).
 * No screen here: plan 12-08 puts these behind the Generate and Archive panels.
 */
(function (global) {
  'use strict';
  const NS = (global.CVPortal = global.CVPortal || {});

  const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const slug = (s) =>
    String(s || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  /** The model's one fund: the audience's, the distribution's, or the recipient's only fund; '' for none or several. */
  function fundOf(ws, template, spec, rid, D) {
    const aud = spec.audience || {};
    let ids = [];
    if (template.type === 'distribution') {
      const r = (ws.runs || []).find((x) => x.id === spec.runId);
      ids = r ? [r.offeringId] : [];
    } else if (template.type === 'tax') {
      const T = rid ? D.taxYear(ws, rid, Number(spec.year)) : null;
      ids = ((T && T.funds) || []).map((f) => f.offeringId);
    } else if (aud.offeringId) ids = [aud.offeringId];
    else if (aud.kind === 'letter') ids = (aud.offeringIds || []).slice();
    else if (rid) ids = D.fundsOf(ws, rid).map((o) => o.id);
    ids = ids.filter((x, k) => x && ids.indexOf(x) === k);
    return ids.length === 1 ? ids[0] : '';
  }

  async function generate(ws, template, spec, opts) {
    const o = opts || {};
    const D = o.D || NS.reportsData;
    const store = o.store || (NS.ops && NS.ops.files);
    const at = o.at || stamp();
    spec = spec || {};
    const R = NS.reportRecord;
    const ids = NS.reports.recipients(ws, template, spec, D);
    if (!ids.length) throw new Error('No investor gets this report for that choice.');
    const S = Object.assign({}, spec, { when: at });
    const models = ids.map((rid) => {
      const r = NS.reports.resolve(ws, template, S, rid, D);
      if (!r.model) throw new Error(r.errors.map((e) => e.message).join('; '));
      return r.model;
    });
    const first = models[0];
    const run = R.newRun(ws, { template, title: first.title, period: { from: first.period.from, to: first.period.to, label: first.subtitle }, audience: spec.audience || {}, spec, by: o.by, at });
    const firm = (D.firm(ws) || {}).name || '';
    for (let k = 0; k < ids.length; k++) {
      const rid = ids[k];
      const model = models[k];
      const bytes = await NS.reportsPdf.compose(model, { kit: o.kit, images: {}, logo: o.logo });
      const file = R.addFile(ws, run.id, {
        investorIds: [rid],
        offeringId: fundOf(ws, template, spec, rid, D),
        name: [firm, model.title, model.subtitle, rid || 'All'].map(slug).join('_') + '.pdf',
        size: bytes.length,
        sha256: NS.audit.sha256(bytes),
        pages: bytes.pages || 0
      });
      await store.put(file.id, new Blob([bytes], { type: 'application/pdf' }));
    }
    R.finish(ws, run.id, { by: o.by, at });
    return run;
  }

  NS.reportsRun = { generate };
})(typeof window !== 'undefined' ? window : globalThis);
