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

  /** Every photo id the template draws: the cover photo (cover on, photo style) and each asset update's photos. */
  function photoIds(template) {
    const t = NS.reports.normalise(template);
    const on = (k) => t.sections.filter((s) => s.key === k && s.on);
    const ids = [];
    if (on('cover').length && t.cover.style === 'photo' && t.cover.photoId) ids.push(t.cover.photoId);
    on('assets').forEach((s) => ((s.opts && s.opts.items) || []).forEach((it) => (it.photoIds || []).forEach((id) => ids.push(id))));
    return ids.filter((x, k) => ids.indexOf(x) === k);
  }

  /** The photos from the store as the composer takes them: { images: { id: { type, bytes } }, missing: [ids not kept] }. */
  async function photosFrom(store, ids) {
    const images = {};
    const missing = [];
    for (const id of ids) {
      let b;
      try {
        b = await store.get(id);
      } catch (e) {
        b = undefined;
      }
      if (!b) missing.push(id);
      else images[id] = { type: b.type || '', bytes: new Uint8Array(await b.arrayBuffer()) };
    }
    return { images, missing };
  }
  /** The logo the composer would draw for the model's firm, worked out once for a whole run. */
  const logoOf = (model) => NS.reportsPdf.logoFor({ name: model.firm.name, shortName: model.firm.name, logo: model.firm.logo, colors: model.firm.colors });

  /** The investors a letter without statements is for: every holder of its funds at the period end. */
  function letterInvestors(ws, template, spec, D) {
    const aud = Object.assign({}, spec.audience || {}, { statements: true });
    return NS.reports.recipients(ws, template, Object.assign({}, spec, { audience: aud }), D);
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /**
   * Every recipient is resolved and checked before anything is recorded or kept: an unknown or unavailable merge field,
   * another investor's details in a report, or a photo not on this device refuses the whole run.
   */
  async function generate(ws, template, spec, opts) {
    const o = opts || {};
    const D = o.D || NS.reportsData;
    const store = o.store || (NS.ops && NS.ops.files);
    const at = o.at || stamp();
    spec = spec || {};
    const R = NS.reportRecord;
    const ids = NS.reports.recipients(ws, template, spec, D);
    if (!ids.length) throw new Error('No investor gets this report for that choice.');
    const everyone = ids.length === 1 && ids[0] === null ? letterInvestors(ws, template, spec, D) : null;
    if (everyone && !everyone.length) throw new Error('No investor gets this report for that choice.');

    const S = Object.assign({}, spec, { when: at });
    const models = [];
    const messages = [];
    let wrong = 0;
    ids.forEach((rid) => {
      const r = NS.reports.resolve(ws, template, S, rid, D);
      if (!r.model) {
        wrong++;
        (r.errors || []).forEach((e) => messages.indexOf(e.message) < 0 && messages.push(e.message));
      }
      models.push(r.model);
    });
    if (wrong) throw new Error(`${plural(wrong, 'report cannot', 'reports cannot')} be made: ${messages.slice(0, 5).join('; ')}`);
    if (models.some((m) => NS.reports.othersIn(ws, m).length)) throw new Error('A report would show another investor’s details. Nothing was generated.');
    const photos = await photosFrom(store, photoIds(template));
    if (photos.missing.length) throw new Error('A photo this template uses is not on this device. Remove it or add it again.');
    const images = photos.images;

    const first = models[0];
    const logo = o.logo || (await logoOf(first));
    const run = R.newRun(ws, { template, title: first.title, period: { from: first.period.from, to: first.period.to, label: first.subtitle }, audience: spec.audience || {}, spec, by: o.by, at });
    const firm = (D.firm(ws) || {}).name || '';
    let stopped = false;
    try {
      for (let k = 0; k < ids.length; k++) {
        if (o.shouldStop && o.shouldStop()) {
          stopped = true;
          break;
        }
        const t0 = Date.now();
        const rid = ids[k];
        const model = models[k];
        const bytes = await NS.reportsPdf.compose(model, { kit: o.kit, images, logo });
        const file = R.addFile(ws, run.id, {
          investorIds: everyone || [rid],
          offeringId: fundOf(ws, template, spec, rid, D),
          name: [firm, model.title, model.subtitle, rid || 'All'].map(slug).join('_') + '.pdf',
          size: bytes.length,
          sha256: NS.audit.sha256(bytes),
          pages: bytes.pages || 0
        });
        // kept before the next one is made, so a phone that runs out of memory loses nothing already made
        await store.put(file.id, new Blob([bytes], { type: 'application/pdf' }));
        if (o.onEach) o.onEach({ done: k + 1, total: ids.length, file, ms: Date.now() - t0 });
      }
    } catch (e) {
      // the files already made stay recorded and kept; the run ends as stopped and the reason goes to the caller
      R.finish(ws, run.id, { by: o.by, at, stopped: true });
      if (e && typeof e === 'object') e.run = run;
      throw e;
    }
    R.finish(ws, run.id, { by: o.by, at, stopped });
    return run;
  }

  const CHANGED = 'The original file is not kept on this device, and the figures or the firm’s details have changed since it was made.';
  const NO_PHOTO = 'The original file is not kept on this device, and a photo it used is no longer on this device.';

  /**
   * An archived file, byte-identical or not at all: the kept bytes when their SHA-256 equals the record; otherwise the
   * file remade from the run's own copy of the template, spec and audience at the time it was made, served only when its
   * SHA-256 equals the record. Nothing is recorded or kept here.
   *   opts: { kit, store = NS.ops.files, logo, D = NS.reportsData } → { bytes, source: 'kept' | 'remade' } | { error }
   */
  async function fileBytes(ws, runId, fileId, opts) {
    const o = opts || {};
    const D = o.D || NS.reportsData;
    const store = o.store || (NS.ops && NS.ops.files);
    const R = NS.reportRecord;
    const run = R.runOf(ws, runId);
    const file = run ? (run.files || []).find((f) => f.id === fileId) : null;
    if (!file) return { error: 'That report file is not in this workspace.' };
    let kept;
    try {
      kept = await store.get(fileId);
    } catch (e) {
      kept = undefined; // the device could not read it: remade below, served only if it is the same file
    }
    if (kept) {
      const bytes = new Uint8Array(await kept.arrayBuffer());
      return R.verifyFile(ws, runId, fileId, bytes) ? { bytes, source: 'kept' } : { error: 'The kept file does not match its record.' };
    }
    const aud = run.audience || {};
    const rid = aud.kind === 'letter' && !aud.statements ? null : file.investorIds[0] || null;
    const spec = Object.assign({}, run.spec || {}, { audience: run.audience, when: run.createdAt });
    let r;
    try {
      r = NS.reports.resolve(ws, run.template, spec, rid, D);
    } catch (e) {
      return { error: CHANGED };
    }
    if (!r || !r.model) return { error: CHANGED };
    const photos = await photosFrom(store, photoIds(run.template));
    let bytes;
    try {
      bytes = await NS.reportsPdf.compose(r.model, { kit: o.kit, images: photos.images, logo: o.logo || (await logoOf(r.model)) });
    } catch (e) {
      return { error: CHANGED };
    }
    if (R.verifyFile(ws, runId, fileId, bytes)) return { bytes, source: 'remade' };
    return { error: photos.missing.length ? NO_PHOTO : CHANGED };
  }

  NS.reportsRun = { generate, fileBytes };
})(typeof window !== 'undefined' ? window : globalThis);
