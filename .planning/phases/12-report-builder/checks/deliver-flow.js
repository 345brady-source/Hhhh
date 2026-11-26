// gate: browser
// last "DELIVER FLOW: PASS (parts run: 8)"
// DELIVER FLOW (plan 12-08): generating, delivering and the archive of the Investor reports tab, and the investor's side,
// in the owner's frame (a sandboxed iframe whose policy refuses every connection and loads scripts from the page's own
// address only), at 390x844 with touch and at 1280x800. Sample firm Kestrel Bay, clock 2027-01-20.
//   node checks/deliver-flow.js [--only part,part]
'use strict';
const path = require('path');
const crypto = require('crypto');
const L12 = require('./lib12.js');
const T = require(path.join(L12.P10, 'checks/lib10.js'));
const F = require('./reports-flow.js');
const Lib = T.Lib;

const FUND = 'kb-fund-ii';
const PE = 'Quarterly letter: venture or private equity';
const COUNSEL = 'Investors with no consent to electronic delivery on record. Their reports are in their Documents too. To be confirmed with counsel.';
const OUT = () => L12.work('deliver-flow');
const LONG = { timeout: 300000 };

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const slug = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const named = (s) => Lib.VENDORS.test(s) || Lib.VENDOR_RE.test(s) || Lib.WORD_RE.test(s);

/** The Investor reports tab's list, whatever the tab showed before. */
async function toList(fr) {
  await fr.evaluate(() => {
    const u = window.CVPortal.state.ui;
    if (u.rb) {
      u.rb.view = 'list';
      u.rb.leave = false;
    }
    if (location.hash !== '#console-reports') location.hash = '#console-reports';
    else window.CVPortal.app.render();
  });
  await fr.waitForSelector('[data-action=rep-tab][data-t=investor]', { timeout: 20000 });
  await T.press(fr, '[data-action=rep-tab][data-t=investor]');
  await fr.waitForSelector('.rb [data-action=rb-create]', { timeout: 20000 });
}
/** Choose what the report is for: fund, the quarter, who. */
async function forWho(fr, who, fund) {
  await fr.selectOption('#rb-fund', fund || FUND);
  await fr.waitForTimeout(120);
  if (await fr.locator('#rb-period').count()) {
    await fr.selectOption('#rb-period', 'q');
    await fr.waitForTimeout(120);
  }
  await T.press(fr, `input[name=rb-who][value=${who}]`);
  await fr.waitForTimeout(200);
}
/** New quarterly report from a starter (by its name in 'Start from'), then what it is for. */
async function newReport(fr, name, who, start) {
  await toList(fr);
  await fr.selectOption('#rb-type', 'quarterly');
  await fr.waitForTimeout(150);
  await fr.selectOption('#rb-start', { label: start || PE });
  await fr.fill('#rb-name', name);
  await T.press(fr, '[data-action=rb-create]');
  await fr.waitForSelector('.rb-edit', { timeout: 10000 });
  await forWho(fr, who || 'fund');
  return fr.evaluate(() => window.CVPortal.state.ui.rb.draft.id);
}
/** A saved template opened in the editor from the list. */
async function openTpl(fr, id) {
  await toList(fr);
  await T.press(fr, `[data-action=rb-open][data-id="${id}"]`);
  await fr.waitForSelector('.rb-edit', { timeout: 10000 });
}
/** The fund's holders at the end of the quarter, in the order reports are made. */
const holders = (fr, fund) =>
  fr.evaluate((fund) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    const o = w.offerings.find((x) => x.id === fund);
    const q = NS.audit.presets(w, o).find((p) => p.id === 'q');
    return NS.reportsData.holders(w, fund, q.to).map((i) => ({ id: i.id, title: i.title }));
  }, fund || FUND);
/** Press Generate (or Stop once the k-th file is made) and wait for the run to end; resolves to the last line and every line seen. */
async function generate(fr, stopAfter) {
  await fr.evaluate(() => {
    window.__rdSeen = [];
    const note = () => {
      const el = document.querySelector('[data-rd=progress]');
      const t = el ? el.innerText.trim() : '';
      if (t && window.__rdSeen[window.__rdSeen.length - 1] !== t) window.__rdSeen.push(t);
    };
    if (window.__rdObs) window.__rdObs.disconnect();
    window.__rdObs = new MutationObserver(note);
    window.__rdObs.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await T.press(fr, '[data-action=rd-gen]');
  if (stopAfter) {
    await fr.waitForFunction((k) => (window.__rdSeen || []).some((t) => t.indexOf(`Made ${k} of`) === 0), stopAfter, LONG);
    await T.press(fr, '[data-action=rd-stop]');
  }
  await fr.waitForFunction(() => {
    const el = document.querySelector('[data-rd=progress]');
    return !!el && !document.querySelector('[data-action=rd-stop]') && /^(Made|Stopped after) \d+ of \d+$/.test(el.innerText.trim());
  }, null, LONG);
  return fr.evaluate(() => {
    window.__rdObs.disconnect();
    return { text: document.querySelector('[data-rd=progress]').innerText.trim(), seen: window.__rdSeen.slice() };
  });
}
/** The archive as drawn: each run's text and, when open, its files. */
const archive = (fr) =>
  fr.evaluate(() =>
    Array.from(document.querySelectorAll('.rd-run')).map((li) => ({
      id: li.getAttribute('data-id'),
      text: li.innerText,
      open: !!li.querySelector('.rd-detail'),
      files: Array.from(li.querySelectorAll('.rd-file')).map((f) => ({ id: f.getAttribute('data-id'), text: f.innerText, opens: (f.querySelector('[data-rd=opens]') || { innerText: '' }).innerText.trim() }))
    }))
  );
/** Open a run in the archive (when it is not open). */
async function openRun(fr, runId) {
  if (!(await fr.locator(`.rd-run[data-id="${runId}"] .rd-detail`).count())) await T.press(fr, `[data-action=rd-open][data-id="${runId}"]`);
  await fr.waitForSelector(`.rd-run[data-id="${runId}"] .rd-detail`, { timeout: 10000 });
}
/** Deliver the open run as a named person. */
async function deliver(fr, runId, by) {
  await fr.fill(`.rd-run[data-id="${runId}"] #rd-by`, by);
  await T.press(fr, `.rd-run[data-id="${runId}"] [data-action=rd-deliver]`);
  await fr.waitForTimeout(300);
}
const lastLog = (fr) =>
  fr.evaluate(() => {
    const a = window.CVPortal.state.ws.audit || [];
    return a.length ? a[a.length - 1].action : '';
  });
/** The run's files as kept in IndexedDB, read straight from the database: their shape, and one file's bytes (base64). */
const stored = (fr, ids) =>
  fr.evaluate(
    (ids) =>
      new Promise((resolve) => {
        const r = indexedDB.open('cvp-documents', 1);
        r.onsuccess = () => {
          const db = r.result;
          const s = db.transaction('files', 'readonly').objectStore('files');
          const out = [];
          let left = ids.length;
          ids.forEach((id) => {
            const g = s.get(id);
            g.onsuccess = () => {
              const v = g.result;
              const row = { id, there: !!v, blob: v instanceof Blob, type: v ? v.type : '', buffer: !!(v && v.bytes instanceof ArrayBuffer), size: v && v.bytes ? v.bytes.byteLength : 0, b64: '' };
              if (row.buffer && id === ids[0]) {
                let bin = '';
                const u = new Uint8Array(v.bytes);
                for (let k = 0; k < u.length; k += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000));
                row.b64 = btoa(bin);
              }
              out.push(row);
              if (!--left) resolve(out);
            };
            g.onerror = () => {
              out.push({ id, there: false });
              if (!--left) resolve(out);
            };
          });
        };
        r.onerror = () => resolve([]);
      }),
    ids
  );
/** Sign in as an investor and open Documents; resolves to the rows of the table: { id, title, cat }. */
async function documentsAs(fr, investor) {
  await T.sample(fr, { role: 'investor', investor });
  await fr.evaluate(() => (location.hash = '#documents'));
  await fr.waitForSelector('.tbl-docs, .empty', { timeout: 20000 });
  await fr.waitForTimeout(200);
  return fr.evaluate(() =>
    Array.from(document.querySelectorAll('.tbl-docs tbody tr')).map((tr) => {
      const b = tr.querySelector('[data-action=open-doc]');
      const cells = Array.from(tr.cells).map((c) => c.innerText.trim());
      return { id: b ? b.getAttribute('data-id') : '', title: b ? b.innerText.trim() : '', cat: cells[cells.length - 2] || '' };
    })
  );
}
/** A report made and delivered in the page through the modules, for the parts that test what comes after. */
async function seed(fr, opts) {
  await fr.waitForFunction(() => !!(window.CVPortal.reportsRun && window.CVPortal.reportsRun.generate && window.CVPortal.reports && window.CVPortal.reports.starters('quarterly').some((s) => s.id === 'q-pe')), null, { timeout: 20000 });
  return fr.evaluate(async (o) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    const off = w.offerings.find((x) => x.id === o.fund);
    const q = NS.audit.presets(w, off).find((p) => p.id === 'q');
    const t = NS.reports.startFrom(w, o.start, { name: o.name, by: NS.app.actor() });
    const audience = o.who === 'letter' ? { kind: 'letter', offeringIds: [o.fund], statements: false } : { kind: 'fund', offeringId: o.fund };
    const run = await NS.reportsRun.generate(w, t, { from: q.from, to: q.to, audience }, { by: NS.app.actor() });
    if (o.by) NS.reportRecord.deliver(w, run.id, { by: o.by });
    NS.app.save(true);
    const docs = run.files.map((f) => w.docs.find((d) => d.id === f.id)).filter(Boolean);
    return { tid: t.id, runId: run.id, title: docs.length ? docs[0].title : '', files: run.files.map((f) => ({ id: f.id, inv: f.investorIds.slice(), name: f.name, sha256: f.sha256 })) };
  }, Object.assign({ fund: FUND, start: 'q-pe', name: 'Seeded letter', who: 'fund', by: 'Pat Admin' }, opts || {}));
}
/** Visible controls in the archive and generate panels smaller than 44 x 44 px. */
const small = (fr) =>
  fr.evaluate(() =>
    Array.from(document.querySelectorAll('.rd button, .rd input, .rd select'))
      .filter((b) => b.offsetWidth || b.offsetHeight)
      .map((b) => {
        const r = (b.closest('label.rb-opt') || b).getBoundingClientRect();
        return { name: (b.innerText || b.id || b.type || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((x) => x.w < 44 || x.h < 44)
  );

const parts = {
  /** Tracer: on the phone a starter is generated for every investor of kb-fund-ii, delivered by a named person, listed for paper. */
  async 'deliver-phone'({ check, S }) {
    const { A, fr } = await F.open(S, 'phone', check);
    const size = await fr.evaluate(() => [innerWidth, innerHeight, navigator.maxTouchPoints > 0]);
    check('the frame is 390x844 with touch', size[0] === 390 && size[1] === 844 && size[2] === true, size);
    const tid = await newReport(fr, 'Q4 Fund II letter', 'fund');
    const hs = await holders(fr);
    const N = hs.length;
    check(`kb-fund-ii has holders at the quarter's end (${N})`, N > 2, N);
    const label = await fr.locator('[data-action=rd-gen]').innerText();
    check(`the button reads 'Generate for ${N} investors'`, label.trim() === `Generate for ${N} investors`, label);
    const g = await generate(fr);
    check(`the run ends 'Made ${N} of ${N}'`, g.text === `Made ${N} of ${N}`, g.text);
    const steps = Array.from({ length: N }, (_, k) => `Made ${k + 1} of ${N}`);
    check('progress shows after each file (every Made k of N seen)', steps.every((s) => g.seen.indexOf(s) >= 0), g.seen);
    const run = await fr.evaluate((tid) => {
      const NS = window.CVPortal;
      const r = NS.reportRecord.runsOf(NS.state.ws)[0];
      return { id: r.id, templateId: r.templateId, state: r.state, files: r.files.map((f) => ({ id: f.id, inv: f.investorIds, name: f.name })), by: r.createdBy || r.by || '' };
    }, tid);
    check('the run is recorded for this template, generated, with a file per holder', run.templateId === tid && run.state === 'generated' && run.files.length === N && hs.every((h) => run.files.some((f) => f.inv.length === 1 && f.inv[0] === h.id)), run);
    let ar = await archive(fr);
    check(`the run opens in the archive, first, with ${N} files`, ar.length >= 1 && ar[0].id === run.id && ar[0].open && ar[0].files.length === N && ar[0].text.indexOf(`${N} files`) >= 0, ar[0] && { id: ar[0].id, open: ar[0].open, files: ar[0].files.length, text: ar[0].text.slice(0, 300) });
    const saved = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const raw = JSON.stringify(NS.state.ws.reports.runs.map((r) => r.id));
      return raw;
    });
    check('the workspace holds the run', saved.indexOf(run.id) >= 0, saved);
    // a delivery with no name is refused on screen
    await T.press(fr, `.rd-run[data-id="${run.id}"] [data-action=rd-deliver]`);
    await fr.waitForTimeout(300);
    const refused = await fr.evaluate((id) => {
      const m = document.querySelector(`.rd-run[data-id="${id}"] [data-rd=msg]`);
      return { msg: m ? m.innerText.trim() : '', delivered: !!window.CVPortal.reportRecord.runOf(window.CVPortal.state.ws, id).delivered };
    }, run.id);
    check("Deliver with no name says 'The person delivering must be named.' and delivers nothing", refused.msg === 'The person delivering must be named.' && !refused.delivered, refused);
    await deliver(fr, run.id, 'Pat Admin');
    ar = await archive(fr);
    const mine = ar.find((x) => x.id === run.id) || { text: '' };
    check("the run reads 'Delivered by Pat Admin'", mine.text.indexOf('Delivered by Pat Admin') >= 0, mine.text.slice(0, 400));
    check("the change log's last entry is 'Report delivered'", (await lastLog(fr)) === 'Report delivered', await lastLog(fr));
    const rec = await fr.evaluate((id) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const r = NS.reportRecord.runOf(w, id);
      return { by: r.delivered && r.delivered.by, docs: (r.delivered ? r.delivered.docs : []).map((d) => w.docs.find((x) => x.id === d)).map((d) => ({ id: d.id, inv: d.investors, hidden: d.hidden, cat: d.cat })) };
    }, run.id);
    check("each holder's file is in the Documents of exactly that holder, under Reports", rec.by === 'Pat Admin' && rec.docs.length === N && rec.docs.every((d) => d.inv.length === 1 && !d.hidden && d.cat === 'Reports'), rec);
    await T.press(fr, `.rd-run[data-id="${run.id}"] [data-action=rd-paper]`);
    await fr.waitForSelector(`.rd-run[data-id="${run.id}"] .rd-paper`, { timeout: 10000 });
    const paper = await fr.evaluate((id) => {
      const p = document.querySelector(`.rd-run[data-id="${id}"] .rd-paper`);
      return {
        line: (p.querySelector('[data-rd=counsel]') || { innerText: '' }).innerText.trim(),
        rows: Array.from(p.querySelectorAll('.rd-pinv')).map((li) => ({ id: li.getAttribute('data-id'), text: li.innerText, dl: li.querySelectorAll('[data-action=rd-dl]').length, mark: li.querySelectorAll('[data-action=rd-mark]').length, date: li.querySelectorAll('input[type=date]').length }))
      };
    }, run.id);
    check("'Send on paper' shows the counsel line (C-01)", paper.line === COUNSEL, paper.line);
    check(`'Send on paper' lists every holder once (none has consent on record): ${N}`, paper.rows.length === N && hs.every((h) => paper.rows.filter((r) => r.id === h.id).length === 1 && paper.rows.find((r) => r.id === h.id).text.indexOf(h.title) >= 0), paper.rows.map((r) => r.id));
    check("each has 'Download PDF', a 'Sent on' date and 'Mark sent on paper'", paper.rows.every((r) => r.dl === 1 && r.mark === 1 && r.date === 1 && /Download PDF/.test(r.text)), paper.rows.slice(0, 2));
    const kept = await stored(fr, run.files.map((f) => f.id));
    check(`every file is kept in IndexedDB as { type, bytes } with bytes an ArrayBuffer, no Blob (${kept.length})`, kept.length === N && kept.every((x) => x.there && !x.blob && x.buffer && x.type === 'application/pdf' && x.size > 1000), kept.map((x) => ({ id: x.id, there: x.there, blob: x.blob, buffer: x.buffer, type: x.type })));
    const firm = await fr.evaluate(() => ({ name: window.CVPortal.state.ws.tenant.name, legal: window.CVPortal.state.ws.tenant.legalName || window.CVPortal.state.ws.tenant.name }));
    const one = kept.find((x) => x.b64);
    if (one) {
      const buf = Buffer.from(one.b64, 'base64');
      const fileName = run.files[0].name;
      const file = L12.save(OUT(), 'kept.pdf', buf);
      const inf = L12.info(file);
      const sum = await fr.evaluate((id) => window.CVPortal.reportRecord.runsOf(window.CVPortal.state.ws)[0].files.find((f) => f.id === id).sha256, one.id);
      check("the kept file's SHA-256 equals its record", sha(buf) === sum, { kept: sha(buf), record: sum });
      check(`Producer and Creator are the firm's name (${firm.legal}) (C-12)`, inf.Producer === firm.legal && inf.Creator === firm.legal, { Producer: inf.Producer, Creator: inf.Creator });
      const vals = Object.keys(inf).map((k) => `${k}: ${inf[k]}`);
      check('no vendor or library name and never the forbidden word in the PDF info or the file name', !vals.some(named) && !named(fileName), { vals: vals.filter(named), fileName });
      check(`the file name starts with the firm (${slug(firm.name)}_) and ends .pdf`, fileName.indexOf(slug(firm.name) + '_') === 0 && /\.pdf$/.test(fileName), fileName);
    } else check('one kept file could be read', false, kept.slice(0, 1));
    const tiny = await small(fr);
    check('every control of Generate and the archive is at least 44 x 44 px on the phone', tiny.length === 0, tiny);
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await T.wayOut(check, fr);
    await A.context.close();
  },

  /** An investor opens the report from Documents, drawn in the page; the sponsor sees the open; another holder sees only their own. */
  async 'investor-phone'({ check, S }) {
    const { A, fr } = await F.open(S, 'phone', check);
    const sd = await seed(fr, { name: 'Q4 opens' });
    const first = sd.files[0];
    const second = sd.files[1];
    const who = await fr.evaluate((id) => window.CVPortal.state.ws.investors.find((i) => i.id === id).title, first.inv[0]);
    let rows = await documentsAs(fr, first.inv[0]);
    const row = rows.find((r) => r.id === first.id);
    check(`the first holder's Documents list '${sd.title}' under Reports`, !!row && row.title === sd.title && row.cat === 'Reports', rows.slice(0, 6));
    await T.press(fr, `[data-action=open-doc][data-id="${first.id}"]`);
    const drawn = await fr
      .waitForFunction(() => {
        const imgs = Array.from(document.querySelectorAll('#dlg img.doc-page'));
        return imgs.length && imgs.every((i) => i.complete && i.naturalWidth > 0) ? imgs.length : 0;
      }, null, { timeout: 30000 })
      .then((x) => x.jsonValue())
      .catch(() => 0);
    check('opening it draws the pages in the page (drawn from a canvas)', drawn >= 1, drawn);
    const dlgText = await fr.evaluate(() => (document.querySelector('#dlg .dlg-head') || { innerText: '' }).innerText);
    check('a delivered report says nothing about being replaced', dlgText.indexOf('Replaced') < 0, dlgText);
    const opens = await fr.evaluate(({ id, inv }) => {
      const d = window.CVPortal.state.ws.docs.find((x) => x.id === id);
      return d.report.opens[inv] ? d.report.opens[inv].count : 0;
    }, { id: first.id, inv: first.inv[0] });
    check('the open is on record once', opens === 1, opens);
    await T.wayOut(check, fr);
    await T.press(fr, '#dlg [data-action=close-dialog]');
    await fr.waitForTimeout(200);
    await T.sample(fr, { role: 'admin' });
    await openTpl(fr, sd.tid);
    await openRun(fr, sd.runId);
    const ar = (await archive(fr)).find((x) => x.id === sd.runId);
    const f1 = ar.files.find((f) => f.id === first.id) || {};
    const f2 = ar.files.find((f) => f.id === second.id) || {};
    check("back as admin, that file reads 'Opened 1 time' and another 'Not opened'", f1.opens === 'Opened 1 time' && f2.opens === 'Not opened', { f1: f1.opens, f2: f2.opens });
    check(`the run reads 'Opened by 1 of ${sd.files.length}'`, ar.text.indexOf(`Opened by 1 of ${sd.files.length}`) >= 0, ar.text.slice(0, 300));
    const log = await fr.evaluate((id) => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === 'Report opened' && e.record === id).map((e) => e.actor), first.id);
    check(`the change log holds 'Report opened' by '${who} (investor)'`, log.length === 1 && log[0] === `${who} (investor)`, log);
    rows = await documentsAs(fr, second.inv[0]);
    const ids = sd.files.map((f) => f.id);
    const theirs = rows.filter((r) => ids.indexOf(r.id) >= 0).map((r) => r.id);
    check("the second holder's Documents list only their own report", theirs.length === 1 && theirs[0] === second.id, theirs);
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await T.wayOut(check, fr);
    await A.context.close();
  }
};

if (require.main === module) {
  Lib.runParts(parts, { name: 'DELIVER FLOW', unit: 'parts', flag: '--only', browser: true });
}
module.exports = { parts };
