// gate: browser
// last "REPORT FIXES: PASS (parts run: 3)"
// REPORT FIXES (quick task 2026-11-27-report-fixes, before 12-09's owner walk), in the owner's frame (a sandboxed iframe
// whose policy refuses every connection and loads scripts from the page's own address only), clock 2027-01-20:
//   tell-withdrawn  (390x844, touch) 'Tell investors' on a report whose every file is withdrawn says so on the report
//                   screen, sends nothing and leaves the Notices draft as it was.
//   two-firms       (1280x800) two sample firms in one browser (one file store) each generate; each opens its own files
//                   byte-identical to the record; a record with an old-style file id (rf-<run>-<file>) whose kept file
//                   is another firm's, or missing, is remade.
//   sample-holdings (390x844, touch) Kestrel Bay's seeded holdings carry ids derived from fund and name; Asset updates
//                   lists them and keeps a photo by holding id across a reload; a sample workspace saved before the ids
//                   existed gets them when it loads.
//   node checks/report-fixes.js [--only part,part]
'use strict';
const path = require('path');
const crypto = require('crypto');
const L12 = require('./lib12.js');
const T = require(path.join(L12.P10, 'checks/lib10.js'));
const F = require('./reports-flow.js');
const D = require('./deliver-flow.js');
const Lib = T.Lib;

const CLOCK = '2027-01-20';
const FUND = 'kb-fund-ii';
const OTHER = 'pellbrook';
const OTHER_FUND = 'pb-ventures-i';
const NONE = 'Every file of this report is withdrawn; there is no one to tell.';
const OUT = () => L12.work('report-fixes');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const J = (x) => JSON.stringify(x);

/** Another sample firm in the same frame (the same browser, so the same file store), signed in as admin. */
async function firm(fr, id) {
  await fr.evaluate((id) => {
    const NS = window.CVPortal;
    if (!NS.state.ws || NS.state.ws.tenant.id !== id) NS.app.setClient(id, 'console');
  }, id);
  await fr.waitForFunction((id) => !!(window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === id), id, { timeout: 20000 });
  await fr.waitForSelector('#demo-role', { state: 'attached' });
  await fr.evaluate(() => {
    const el = document.getElementById('demo-role');
    el.value = 'admin';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await fr.waitForFunction(() => window.CVPortal.state.role === 'admin');
  await fr.waitForTimeout(300);
}
/** Every file of a run as NS.reportsRun.fileBytes gives it: { id, source, error, ok (SHA-256 equals the record) }. */
const opened = (fr, runId) =>
  fr.evaluate(async (runId) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    const run = NS.reportRecord.runOf(w, runId);
    const out = [];
    for (const f of run.files) {
      const r = await NS.reportsRun.fileBytes(w, runId, f.id);
      out.push({ id: f.id, source: r.source || '', error: r.error || '', ok: !!(r.bytes && NS.audit.sha256(r.bytes) === f.sha256) });
    }
    return out;
  }, runId);
/** 'Download' on one file of the archive; resolves to { buf, name } or null when no file came. */
async function download(A, fr, fileId, name) {
  const sel = `.rd-file[data-id="${fileId}"] [data-action=rd-dl]`;
  const [dl] = await Promise.all([A.page.waitForEvent('download', { timeout: 60000 }), T.press(fr, sel)]).catch(() => [null]);
  if (!dl) return null;
  const p = path.join(OUT(), name);
  await dl.saveAs(p);
  return { buf: require('fs').readFileSync(p), name: dl.suggestedFilename() };
}
/** The message under a file of the archive ('' when none). */
const dlMsg = (fr, fileId) => fr.evaluate((id) => (document.querySelector(`.rd-file[data-id="${id}"] [data-rd=dl-msg]`) || { innerText: '' }).innerText.trim(), fileId);

const parts = {
  /** 'Tell investors' after every file of a report is withdrawn: one sentence on the report screen, Notices left alone. */
  async 'tell-withdrawn'({ check, S }) {
    const { A, fr } = await F.open(S, 'phone', check);
    // a draft of the person's own on the Notices page, typed there
    await fr.evaluate(() => (location.hash = '#console-notices'));
    await fr.waitForSelector('#nt-subject', { timeout: 20000 });
    await fr.fill('#nt-subject', 'Our own draft: the annual meeting');
    await fr.waitForTimeout(300);
    const before = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      return { notice: JSON.stringify(NS.state.ui.notice || null), subject: (NS.state.ui.notice || {}).subject || '', sent: (w.audit || []).filter((e) => e.action === 'Notice sent').length, notices: JSON.stringify(w.notices || []), send: (document.querySelector('[data-action=notice-send]') || { innerText: '' }).innerText.trim() };
    });
    check('the Notices page holds the draft typed there', before.subject === 'Our own draft: the annual meeting', before.subject);
    // one letter for everyone, delivered, then withdrawn on screen by an admin
    const sd = await D.seed(fr, { who: 'letter', name: 'Withdrawn letter' });
    check('the letter is one file, delivered', sd.files.length === 1 && sd.files[0].inv.length > 2, sd.files.map((f) => f.inv.length));
    const f = sd.files[0];
    await D.openTpl(fr, sd.tid);
    await D.openRun(fr, sd.runId);
    const wsel = `.rd-file[data-id="${f.id}"]`;
    await T.press(fr, `${wsel} [data-action=rd-wd]`);
    await fr.waitForSelector('#rd-why', { timeout: 10000 });
    await fr.fill('#rd-why', 'Wrong period');
    await T.press(fr, `${wsel} [data-action=rd-wd-yes]`);
    await fr.waitForTimeout(300);
    const wd = await fr.evaluate((id) => window.CVPortal.state.ws.docs.find((d) => d.id === id).report.state, f.id);
    check('every file of the report is withdrawn (on screen, with a reason)', wd === 'withdrawn', wd);
    await D.openRun(fr, sd.runId);
    const tell = `.rd-run[data-id="${sd.runId}"] [data-action=rd-tell]`;
    check("the report still offers 'Tell investors'", (await fr.locator(tell).count()) === 1);
    await T.press(fr, tell);
    await fr.waitForTimeout(500);
    const after = await fr.evaluate((runId) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const run = document.querySelector(`.rd-run[data-id="${runId}"]`);
      return {
        route: NS.state.route,
        msgs: run ? Array.from(run.querySelectorAll('.rb-msg')).map((m) => m.innerText.trim()) : [],
        notice: JSON.stringify(NS.state.ui.notice || null),
        sent: (w.audit || []).filter((e) => e.action === 'Notice sent').length,
        notices: JSON.stringify(w.notices || []),
        ntPage: !!document.querySelector('#nt-subject')
      };
    }, sd.runId);
    check('the page stays on the report (Reports), not Notices', after.route === 'console-reports' && !after.ntPage, { route: after.route, ntPage: after.ntPage });
    check(`the report screen says '${NONE}'`, after.msgs.indexOf(NONE) >= 0, after.msgs);
    check('the Notices draft is not changed', after.notice === before.notice, { before: before.notice.slice(0, 300), after: after.notice.slice(0, 300) });
    check("nothing is sent: no 'Notice sent' in the change log and no notice recorded", after.sent === before.sent && after.notices === before.notices, { before: before.sent, after: after.sent });
    await fr.evaluate(() => (location.hash = '#console-notices'));
    await fr.waitForSelector('#nt-subject', { timeout: 20000 });
    const nt = await fr.evaluate(() => ({ subject: document.querySelector('#nt-subject').value, send: (document.querySelector('[data-action=notice-send]') || { innerText: '' }).innerText.trim() }));
    check('Notices still shows the draft typed there, with the same Send button', nt.subject === before.subject && nt.send === before.send, { nt, before: before.send });
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await A.context.close();
  },

  /** Two sample firms in one browser: each opens its own files; old-style ids are remade when the kept file is not theirs. */
  async 'two-firms'({ check, S }) {
    const { A, fr } = await F.open(S, 'desktop', check);
    const kb = await D.seed(fr, { name: 'Two firms, Kestrel Bay' });
    check(`Kestrel Bay's file ids carry its id (rf-kestrel-bay-...) (${kb.files.length} files)`, kb.files.length > 2 && kb.files.every((x) => x.id.indexOf('rf-kestrel-bay-') === 0), kb.files.map((x) => x.id).slice(0, 3));
    await firm(fr, OTHER);
    const pb = await D.seed(fr, { name: 'Two firms, Pellbrook', fund: OTHER_FUND });
    check(`Pellbrook's file ids carry its id (rf-pellbrook-...) (${pb.files.length} files)`, pb.files.length > 0 && pb.files.every((x) => x.id.indexOf('rf-pellbrook-') === 0), pb.files.map((x) => x.id).slice(0, 3));
    check('no file id of one firm is a file id of the other', !kb.files.some((x) => pb.files.some((y) => y.id === x.id)), { kb: kb.files[0].id, pb: pb.files[0].id });
    const pbOpen = await opened(fr, pb.runId);
    check("every Pellbrook file opens as kept, byte-identical to its record", pbOpen.every((x) => x.source === 'kept' && x.ok), pbOpen.filter((x) => !(x.source === 'kept' && x.ok)).slice(0, 3));
    await firm(fr, 'kestrel-bay');
    const kbOpen = await opened(fr, kb.runId);
    check("after Pellbrook generated in the same browser, every Kestrel Bay file opens as kept, byte-identical to its record", kbOpen.every((x) => x.source === 'kept' && x.ok), kbOpen.filter((x) => !(x.source === 'kept' && x.ok)).slice(0, 3));
    await D.openTpl(fr, kb.tid);
    await D.openRun(fr, kb.runId);
    const a = await download(A, fr, kb.files[0].id, 'kb.pdf');
    check("Kestrel Bay's 'Download' gives its own file, its SHA-256 equal to the record", !!a && sha(a.buf) === kb.files[0].sha256 && a.name === kb.files[0].name, a ? { sha: sha(a.buf), want: kb.files[0].sha256 } : await dlMsg(fr, kb.files[0].id));
    // a record made before file ids named the firm: rf-<run>-<file>, the first one kept under Pellbrook's bytes (what the
    // shared store held after two firms generated), the second one with nothing kept
    const old = await fr.evaluate(async (pbFirst) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const t = NS.reportRecord.runOf(w, NS.reportRecord.runsOf(w)[0].id).template;
      const off = w.offerings.find((x) => x.id === 'kb-fund-ii');
      const q = NS.audit.presets(w, off).find((p) => p.id === 'q');
      const run = await NS.reportsRun.generate(w, t, { from: q.from, to: q.to, audience: { kind: 'fund', offeringId: 'kb-fund-ii' } }, { by: NS.app.actor() });
      const n = String(run.id).replace(/^rr-/, '');
      const ids = [];
      for (let k = 0; k < 2; k++) {
        const f = run.files[k];
        const was = f.id;
        f.id = `rf-${n}-${k + 1}`;
        ids.push(f.id);
        await NS.ops.files.del(was);
        await NS.ops.files.del(f.id);
      }
      const theirs = await NS.ops.files.get(pbFirst);
      await NS.ops.files.put(ids[0], new Blob([new Uint8Array(await theirs.arrayBuffer())], { type: 'application/pdf' }));
      NS.app.save(true);
      return { runId: run.id, tid: run.templateId, ids, sums: run.files.slice(0, 2).map((f) => f.sha256), theirs: NS.audit.sha256(new Uint8Array(await theirs.arrayBuffer())) };
    }, pb.files[0].id);
    const res = await fr.evaluate(async (o) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const out = [];
      for (const id of o.ids) {
        const r = await NS.reportsRun.fileBytes(w, o.runId, id);
        out.push({ id, source: r.source || '', error: r.error || '', sha: r.bytes ? NS.audit.sha256(r.bytes) : '' });
      }
      return out;
    }, old);
    check("an old-style id whose kept file is another firm's: remade, byte-identical to its record", res[0].source === 'remade' && res[0].sha === old.sums[0], res[0]);
    check('an old-style id with nothing kept: remade, byte-identical to its record', res[1].source === 'remade' && res[1].sha === old.sums[1], res[1]);
    await D.openTpl(fr, old.tid);
    await D.openRun(fr, old.runId);
    const b = await download(A, fr, old.ids[0], 'old.pdf');
    check("on screen, 'Download' of the old-style file gives it remade, its SHA-256 equal to the record", !!b && sha(b.buf) === old.sums[0], b ? { sha: sha(b.buf), want: old.sums[0] } : await dlMsg(fr, old.ids[0]));
    const kept = await fr.evaluate(async (id) => {
      const x = await window.CVPortal.ops.files.get(id);
      return x ? window.CVPortal.audit.sha256(new Uint8Array(await x.arrayBuffer())) : '';
    }, old.ids[0]);
    check("remaking it keeps nothing over the bytes under that id (Pellbrook's stay)", kept === old.theirs, { kept, theirs: old.theirs });
    await firm(fr, OTHER);
    const pbAgain = await opened(fr, pb.runId);
    check('Pellbrook still opens every file as kept, byte-identical to its record', pbAgain.every((x) => x.source === 'kept' && x.ok), pbAgain.filter((x) => !(x.source === 'kept' && x.ok)).slice(0, 3));
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await A.context.close();
  },

  /** Kestrel Bay's sample holdings in Asset updates, a photo kept by holding id, and a workspace saved before the ids. */
  async 'sample-holdings'({ check, S }) {
    let { A, fr } = await F.open(S, 'phone', check);
    const ids = await fr.evaluate(() => {
      const slug = (s) =>
        String(s || '')
          .normalize('NFKD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      const NS = window.CVPortal;
      const all = [];
      const wrong = [];
      NS.TENANTS.forEach((t) =>
        (t.offerings || []).forEach((o) =>
          (o.holdings || []).forEach((h) => {
            all.push(h.id);
            if (h.id !== `${o.id}-${slug(h.name)}`) wrong.push({ o: o.id, name: h.name, id: h.id || '' });
          })
        )
      );
      const o = NS.state.ws.offerings.find((x) => x.id === 'kb-fund-ii');
      return { n: all.length, wrong, dup: all.filter((x, k) => all.indexOf(x) !== k), fund: o.holdings.map((h) => ({ id: h.id || '', name: h.name })) };
    });
    check(`every seeded sample holding (${ids.n}) has the id '<fund id>-<its name>', none twice`, ids.n > 20 && ids.wrong.length === 0 && ids.dup.length === 0, { wrong: ids.wrong.slice(0, 3), dup: ids.dup.slice(0, 3) });
    check("the workspace's kb-fund-ii holdings carry those ids", ids.fund.length === 7 && ids.fund.every((h) => h.id === `kb-fund-ii-${h.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`), ids.fund);
    const listed = async () => {
      await F.openSec(fr, 'assets');
      return fr.evaluate(() => ({
        rows: Array.from(document.querySelectorAll('.rb-hold')).map((d) => ({ id: d.getAttribute('data-holding'), name: (d.querySelector('h4') || { innerText: '' }).innerText.trim() })),
        none: /No holding in the books for this fund yet\./.test((document.querySelector('.rb-sec[data-key=assets]') || { innerText: '' }).innerText)
      }));
    };
    await F.toTab(fr);
    await F.create(fr, 'quarterly', 'quarterly', 'Asset updates');
    await F.previewFor(fr, { who: 'fund' });
    let L = await listed();
    check(`Asset updates lists Kestrel Bay Fund II's ${ids.fund.length} holdings by name, each under its id`, !L.none && J(L.rows) === J(ids.fund), L);
    const hid = ids.fund[1] && ids.fund[1].id;
    await fr.setInputFiles(`.rb-hold[data-holding="${hid}"] input[type=file]`, [{ name: 'plant.png', mimeType: 'image/png', buffer: F.png(64, 48, [30, 110, 70]) }]);
    await fr.waitForFunction((hid) => {
      const t = window.CVPortal.reportsUI.state().draft;
      const it = (t.sections.find((s) => s.key === 'assets').opts.items || []).find((x) => x.holdingId === hid);
      return it && it.photoIds.length === 1;
    }, hid, { timeout: 30000 }).catch(() => {});
    const photo = await fr.evaluate(async (hid) => {
      const NS = window.CVPortal;
      const t = NS.reportsUI.state().draft;
      const it = (t.sections.find((s) => s.key === 'assets').opts.items || []).find((x) => x.holdingId === hid);
      const id = it && it.photoIds[0];
      const b = id ? await NS.ops.files.get(id) : null;
      return { tid: t.id, id: id || '', kept: !!b, type: b ? b.type : '' };
    }, hid);
    check(`a photo added to ${ids.fund[1] && ids.fund[1].name} is kept under that holding's id (rp-kestrel-bay-...)`, /^rp-kestrel-bay-\d+$/.test(photo.id) && photo.kept && photo.type === 'image/jpeg', photo);
    await T.press(fr, '[data-action=rb-save]');
    await fr.waitForTimeout(400);
    // the page loaded again (its saved data kept): the photo is still the holding's
    fr = await A.setClock(CLOCK);
    await T.sample(fr, { role: 'admin' });
    await D.openTpl(fr, photo.tid);
    L = await listed();
    const back = await fr.evaluate((hid) => {
      const NS = window.CVPortal;
      const t = NS.reportsUI.state().draft;
      const it = (t.sections.find((s) => s.key === 'assets').opts.items || []).find((x) => x.holdingId === hid);
      return { photos: it ? it.photoIds : [], thumbs: document.querySelectorAll(`.rb-hold[data-holding="${hid}"] .rb-thumb`).length };
    }, hid);
    check('after the page loads again, the saved report keeps the photo under the same holding, shown there', J(back.photos) === J([photo.id]) && back.thumbs === 1 && J(L.rows) === J(ids.fund), { back, rows: L.rows.length });
    // a sample workspace saved before its holdings had ids: they are given when it loads
    await fr.evaluate(() => {
      const NS = window.CVPortal;
      NS.state.ws.offerings.forEach((o) => (o.holdings || []).forEach((h) => delete h.id));
      NS.app.save(true);
    });
    fr = await A.setClock(CLOCK);
    await T.sample(fr, { role: 'admin' });
    const again = await fr.evaluate(() => window.CVPortal.state.ws.offerings.find((x) => x.id === 'kb-fund-ii').holdings.map((h) => ({ id: h.id || '', name: h.name })));
    check('a Kestrel Bay workspace saved without holding ids gets the same ids when it loads', J(again) === J(ids.fund), again);
    await D.openTpl(fr, photo.tid);
    L = await listed();
    check('and Asset updates lists the holdings again, the photo still under its holding', !L.none && J(L.rows) === J(ids.fund) && (await fr.locator(`.rb-hold[data-holding="${hid}"] .rb-thumb`).count()) === 1, L);
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await A.context.close();
  }
};

if (require.main === module) {
  Lib.runParts(parts, { name: 'REPORT FIXES', unit: 'parts', flag: '--only', browser: true });
}
module.exports = { parts };
