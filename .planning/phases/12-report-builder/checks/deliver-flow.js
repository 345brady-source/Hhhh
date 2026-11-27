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
    // the panel is drawn again after every file, so the tap is made on the button as it is at that moment
    await fr.locator('[data-action=rd-stop]').tap({ timeout: 10000 });
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
    const closeAt = [];
    for (const k of [0, 0.5, 1]) {
      await fr.evaluate((k) => {
        const dlg = document.querySelector('#dlg');
        [dlg].concat(Array.from(dlg.querySelectorAll('*'))).filter((el) => el.scrollHeight > el.clientHeight + 2).forEach((el) => (el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * k)));
      }, k);
      await fr.waitForTimeout(200);
      closeAt.push(
        await fr.evaluate(() => {
          const dlg = document.querySelector('#dlg');
          const b = dlg.querySelector('[data-action=close-dialog]');
          const r = b ? b.getBoundingClientRect() : null;
          if (!r || !r.width || r.top < 0 || r.bottom > innerHeight || r.right > innerWidth) return false;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!hit && (hit === b || b.contains(hit));
        })
      );
    }
    check("the document's Close button is on screen at the top, the middle and the end of the document (its way out)", closeAt.every(Boolean), closeAt);
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
  },

  /** One letter for everyone in kb-fund-ii, delivered; 'Tell investors' fills in the Notices page and sends nothing. */
  async notice({ check, S }) {
    const { A, fr } = await F.open(S, 'phone', check);
    await newReport(fr, 'Q4 letter to all', 'letter');
    const hs = await holders(fr);
    const N = hs.length;
    const label = await fr.locator('[data-action=rd-gen]').innerText();
    check(`the button reads 'Generate one letter for ${N} investors'`, label.trim() === `Generate one letter for ${N} investors`, label);
    const g = await generate(fr);
    check("the letter ends 'Made 1 of 1'", g.text === 'Made 1 of 1', g);
    const run = await fr.evaluate(() => {
      const r = window.CVPortal.reportRecord.runsOf(window.CVPortal.state.ws)[0];
      return { id: r.id, type: r.type, files: r.files.map((f) => ({ id: f.id, inv: f.investorIds.slice() })) };
    });
    check(`one file, for every holder (${N})`, run.files.length === 1 && run.files[0].inv.length === N && hs.every((h) => run.files[0].inv.indexOf(h.id) >= 0), run);
    const before = await fr.evaluate(() => ({ sent: (window.CVPortal.state.ws.audit || []).filter((e) => e.action === 'Notice sent').length, notices: (window.CVPortal.state.ws.notices || []).length }));
    await deliver(fr, run.id, 'Pat Admin');
    const lists = await fr.evaluate(({ id, ids }) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      return ids.filter((inv) => NS.ops.docsFor(w, w.investors.find((i) => i.id === inv)).some((d) => d.id === id));
    }, { id: run.files[0].id, ids: hs.map((x) => x.id) });
    check("every holder's Documents list the letter", lists.length === N, lists.length);
    const rows = await documentsAs(fr, hs[N - 1].id);
    check("on screen, the last holder's Documents list it under Reports", rows.some((r) => r.id === run.files[0].id && r.cat === 'Reports'), rows.slice(0, 4));
    await T.sample(fr, { role: 'admin' });
    const tid = await fr.evaluate((id) => window.CVPortal.reportRecord.runOf(window.CVPortal.state.ws, id).templateId, run.id);
    await openTpl(fr, tid);
    await openRun(fr, run.id);
    await T.press(fr, `.rd-run[data-id="${run.id}"] [data-action=rd-paper]`);
    await fr.waitForSelector(`.rd-run[data-id="${run.id}"] .rd-paper`, { timeout: 10000 });
    const paper = await fr.evaluate((id) => Array.from(document.querySelectorAll(`.rd-run[data-id="${id}"] .rd-pinv`)).map((li) => li.getAttribute('data-id')), run.id);
    check(`the paper list holds each holder once (${N})`, paper.length === N && hs.every((h) => paper.filter((x) => x === h.id).length === 1), paper);
    await T.press(fr, `.rd-run[data-id="${run.id}"] [data-action=rd-tell]`);
    await fr.waitForSelector('#nt-subject', { timeout: 10000 });
    const nt = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const n = NS.state.ui.notice;
      return { route: NS.state.route, kind: document.querySelector('#nt-kind').value, subject: document.querySelector('#nt-subject').value, want: NS.NOTICE_TEMPLATES.quarterly.subject, investors: n.investors.slice().sort(), send: (document.querySelector('[data-action=notice-send]') || { innerText: '' }).innerText.trim() };
    });
    check("'Tell investors' opens the Notices page with the 'quarterly' template's subject", nt.route === 'console-notices' && nt.kind === 'quarterly' && nt.subject === nt.want && !!nt.want, nt);
    check(`the delivered investors are chosen (${N}) and nothing is sent: the button still reads 'Send to ${N} investors'`, JSON.stringify(nt.investors) === JSON.stringify(hs.map((h) => h.id).sort()) && nt.send === `Send to ${N} investors`, { investors: nt.investors.length, send: nt.send });
    const after = await fr.evaluate(() => ({ sent: (window.CVPortal.state.ws.audit || []).filter((e) => e.action === 'Notice sent').length, notices: (window.CVPortal.state.ws.notices || []).length }));
    check("the change log gains no 'Notice sent' and no notice is recorded", after.sent === before.sent && after.notices === before.notices, { before, after });
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await T.wayOut(check, fr);
    await A.context.close();
  },

  /** 1280x800: a team member cannot withdraw; an admin withdraws with a reason; a corrected report replaces the earlier one; consent keeps an investor off paper. */
  async 'withdraw-replace'({ check, S }) {
    const { A, fr } = await F.open(S, 'desktop', check);
    const hs = await holders(fr);
    const N = hs.length;
    // one holder consents to electronic delivery, set through the page (W3)
    const consent = hs[2].id;
    await T.ws(fr, (w, id) => {
      const inv = w.investors.find((i) => i.id === id);
      inv.esignConsent = Object.assign({}, inv.esignConsent || {}, { at: '2027-01-02T10:00:00Z', scope: 'Electronic signature and electronic delivery of documents' });
    }, consent);
    const sd = await seed(fr, { name: 'Q4 corrections' });
    const fileOf = (s, inv) => s.files.find((f) => f.inv.indexOf(inv) >= 0);
    await T.sample(fr, { role: 'team' });
    await openTpl(fr, sd.tid);
    await openRun(fr, sd.runId);
    const team = await fr.evaluate((id) => ({ wd: document.querySelectorAll(`.rd-run[data-id="${id}"] [data-action=rd-wd]`).length, dl: document.querySelectorAll(`.rd-run[data-id="${id}"] [data-action=rd-dl]`).length }), sd.runId);
    check("a team member sees the files and no 'Withdraw' (C-04)", team.wd === 0 && team.dl === N, team);
    await T.sample(fr, { role: 'admin' });
    await openTpl(fr, sd.tid);
    await openRun(fr, sd.runId);
    await T.press(fr, `.rd-run[data-id="${sd.runId}"] [data-action=rd-paper]`);
    await fr.waitForSelector(`.rd-run[data-id="${sd.runId}"] .rd-paper`, { timeout: 10000 });
    const paper = await fr.evaluate((id) => Array.from(document.querySelectorAll(`.rd-run[data-id="${id}"] .rd-pinv`)).map((li) => li.getAttribute('data-id')), sd.runId);
    check(`the holder with consent to electronic delivery on record is not under 'Send on paper'; the other ${N - 1} are`, paper.indexOf(consent) < 0 && paper.length === N - 1, paper);
    const target = fileOf(sd, hs[0].id);
    const wsel = `.rd-file[data-id="${target.id}"]`;
    const wdCount = await fr.locator(`${wsel} [data-action=rd-wd]`).count();
    check("an admin sees 'Withdraw' on each delivered file", wdCount === 1, wdCount);
    await T.press(fr, `${wsel} [data-action=rd-wd]`);
    await fr.waitForSelector('#rd-why', { timeout: 10000 });
    await T.press(fr, `${wsel} [data-action=rd-wd-yes]`);
    await fr.waitForTimeout(300);
    const blank = await fr.evaluate(({ sel, id }) => ({ msg: (document.querySelector(`${sel} [data-rd=wd-msg]`) || { innerText: '' }).innerText.trim(), state: window.CVPortal.state.ws.docs.find((d) => d.id === id).report.state }), { sel: wsel, id: target.id });
    check("a reason left blank is refused on screen ('Say why it is withdrawn.')", blank.msg === 'Say why it is withdrawn.' && blank.state === 'delivered', blank);
    await fr.fill('#rd-why', 'Wrong period');
    await T.press(fr, `${wsel} [data-action=rd-wd-yes]`);
    await fr.waitForTimeout(300);
    const wd = await fr.evaluate(({ sel, id }) => {
      const d = window.CVPortal.state.ws.docs.find((x) => x.id === id);
      return { state: d.report.state, why: d.report.withdrawn && d.report.withdrawn.why, hidden: d.hidden, row: (document.querySelector(sel) || { innerText: '' }).innerText };
    }, { sel: wsel, id: target.id });
    check("withdrawn with 'Wrong period', and the file reads so", wd.state === 'withdrawn' && wd.why === 'Wrong period' && wd.hidden === true && /Withdrawn by .*: Wrong period/.test(wd.row), wd);
    check("the change log's last entry is 'Report withdrawn'", (await lastLog(fr)) === 'Report withdrawn', await lastLog(fr));
    // the corrected report: the same template generated again on screen and delivered as a correction
    await forWho(fr, 'fund');
    const g = await generate(fr);
    check(`the second run ends 'Made ${N} of ${N}'`, g.text === `Made ${N} of ${N}`, g.text);
    const run2 = await fr.evaluate(() => window.CVPortal.reportRecord.runsOf(window.CVPortal.state.ws)[0].id);
    check('the second run is a new run', run2 !== sd.runId, run2);
    await fr.fill(`.rd-run[data-id="${run2}"] #rd-by`, 'Pat Admin');
    await T.press(fr, `.rd-run[data-id="${run2}"] label.rb-opt:has(#rd-corr)`);
    await fr.waitForSelector('#rd-corr-run', { timeout: 10000 });
    await fr.selectOption('#rd-corr-run', sd.runId);
    await fr.waitForTimeout(200);
    await fr.fill(`.rd-run[data-id="${run2}"] #rd-by`, 'Pat Admin');
    await T.press(fr, `.rd-run[data-id="${run2}"] [data-action=rd-deliver]`);
    await fr.waitForTimeout(300);
    const rep = await fr.evaluate(({ old, run2 }) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const r2 = NS.reportRecord.runOf(w, run2);
      return {
        delivered: !!r2.delivered,
        msg: (document.querySelector(`.rd-run[data-id="${run2}"] [data-rd=msg]`) || { innerText: '' }).innerText,
        old: old.map((f) => {
          const d = w.docs.find((x) => x.id === f.id);
          return { id: f.id, inv: f.inv[0], state: d.report.state, by: d.report.replacedBy };
        }),
        news: r2.files.map((f) => ({ id: f.id, inv: f.investorIds[0], replaces: (w.docs.find((x) => x.id === f.id) || { report: {} }).report.replaces }))
      };
    }, { old: sd.files, run2 });
    const live = rep.old.filter((x) => x.inv !== hs[0].id);
    check(`'This corrects an earlier report' marks each earlier report the investors had replaced (${live.length})`, rep.delivered && live.every((x) => x.state === 'replaced' && rep.news.some((n) => n.id === x.by && n.replaces === x.id)), rep);
    check('the withdrawn one stays withdrawn', rep.old.find((x) => x.inv === hs[0].id).state === 'withdrawn', rep.old.find((x) => x.inv === hs[0].id));
    let rows = await documentsAs(fr, hs[0].id);
    check("the withdrawn investor's Documents no longer list the withdrawn report", !rows.some((r) => r.id === target.id) && rows.some((r) => r.id === rep.news.find((n) => n.inv === hs[0].id).id), rows.map((r) => r.id));
    const h1 = hs[1].id;
    const oldDoc = fileOf(sd, h1).id;
    const newDoc = rep.news.find((n) => n.inv === h1).id;
    rows = await documentsAs(fr, h1);
    check('the investor sees both, the earlier marked (replaced)', rows.some((r) => r.id === oldDoc && /\(replaced\)$/.test(r.title)) && rows.some((r) => r.id === newDoc), rows.filter((r) => r.id === oldDoc || r.id === newDoc));
    await T.press(fr, `[data-action=open-doc][data-id="${oldDoc}"]`);
    await fr.waitForSelector('#dlg .dlg-head', { timeout: 10000 });
    await fr.waitForTimeout(300);
    const said = await fr.evaluate(() => document.querySelector('#dlg .dlg-head').innerText);
    check("opening the earlier one shows 'Replaced by a corrected report.'", said.indexOf('Replaced by a corrected report.') >= 0, said);
    await T.press(fr, '#dlg [data-action=close-dialog]');
    const crows = await documentsAs(fr, consent);
    check('the investor with consent still has the report in Documents', crows.some((r) => r.id === fileOf(sd, consent).id), crows.map((r) => r.id));
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await T.wayOut(check, fr);
    await A.context.close();
  },

  /** 1280x800: an archived file downloads byte-identical, kept or remade; when it cannot be given the screen says why (RB-16). */
  async 'archive-desktop'({ check, S }) {
    const { A, fr } = await F.open(S, 'desktop', check);
    const sd = await seed(fr, { name: 'Q4 archive' });
    const f = sd.files[0];
    await openTpl(fr, sd.tid);
    await openRun(fr, sd.runId);
    const sel = `.rd-file[data-id="${f.id}"] [data-action=rd-dl]`;
    const get = async (name) => {
      const [dl] = await Promise.all([A.page.waitForEvent('download', { timeout: 60000 }), T.press(fr, sel)]).catch(() => [null]);
      if (!dl) return null;
      const p = path.join(OUT(), name);
      await dl.saveAs(p);
      return { buf: require('fs').readFileSync(p), name: dl.suggestedFilename() };
    };
    const a = await get('kept.pdf');
    check("'Download' gives the kept file, its SHA-256 equal to the record, under the file's own name", !!a && sha(a.buf) === f.sha256 && a.name === f.name, a && { sha: sha(a.buf), want: f.sha256, name: a.name });
    await fr.evaluate((id) => window.CVPortal.ops.files.del(id), f.id);
    const gone = await stored(fr, [f.id]);
    check('the file is deleted from the store in the page', gone.length === 1 && !gone[0].there, gone);
    const b = await get('remade.pdf');
    check("after that, 'Download' gives the same SHA-256 again (remade)", !!b && sha(b.buf) === f.sha256, b && { sha: sha(b.buf), want: f.sha256 });
    const still = await stored(fr, [f.id]);
    check('remaking keeps nothing new in the store', still.length === 1 && !still[0].there, still);
    await T.ws(fr, (w) => {
      w.tenant.legalName = 'Kestrel Bay Capital Partners, LLC';
    });
    await openRun(fr, sd.runId);
    const [dl] = await Promise.all([A.page.waitForEvent('download', { timeout: 8000 }), T.press(fr, sel)]).catch(() => [null]);
    await fr.waitForSelector(`.rd-file[data-id="${f.id}"] [data-rd=dl-msg]`, { timeout: 30000 }).catch(() => {});
    const msg = await fr.evaluate((id) => (document.querySelector(`.rd-file[data-id="${id}"] [data-rd=dl-msg]`) || { innerText: '' }).innerText.trim(), f.id);
    check("after the firm's legal name changed, 'Download' gives no file", !dl, !!dl);
    check('and says the original is not kept and the details changed', msg === 'The original file is not kept on this device, and the figures or the firm’s details have changed since it was made.', msg);
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await T.wayOut(check, fr);
    await A.context.close();
  },

  /** RB-01: every report type offers its starters; a distribution notice from its starter previews the payment's figures. */
  async 'starters-phone'({ check, S }) {
    const { A, fr } = await F.open(S, 'phone', check);
    await toList(fr);
    const types = ['statement', 'distribution', 'quarterly', 'annual', 'performance', 'tax'];
    for (const ty of types) {
      await fr.selectOption('#rb-type', ty);
      await fr.waitForTimeout(150);
      const opts = await fr.evaluate(() => Array.from(document.querySelectorAll('#rb-start option')).map((o) => o.textContent.trim()));
      const list = opts.filter((x) => x !== 'Blank');
      check(`${ty}: 'Start from' lists at least two starters and 'Blank' (${list.length})`, list.length >= 2 && opts.indexOf('Blank') >= 0, opts);
    }
    await fr.selectOption('#rb-type', 'distribution');
    await fr.waitForTimeout(150);
    await fr.selectOption('#rb-start', { label: 'Distribution notice' });
    await fr.fill('#rb-name', 'Fund II notice');
    await T.press(fr, '[data-action=rb-create]');
    await fr.waitForSelector('.rb-edit', { timeout: 10000 });
    await fr.selectOption('#rb-fund', FUND);
    await fr.waitForTimeout(200);
    const pick = await fr.evaluate((fund) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const newest = NS.reportsData.runs(w, fund)[0];
      return { newest: newest && newest.id, chosen: (document.querySelector('#rb-run') || { value: '' }).value };
    }, FUND);
    check("'Payment' starts on kb-fund-ii's newest paid run", !!pick.newest && pick.chosen === pick.newest, pick);
    await fr.waitForFunction(() => {
      const p = document.querySelector('#rb-preview');
      return p && !p.querySelector('.rb-wait') && document.querySelector('#rb-as');
    }, null, { timeout: 20000 });
    const fig = await fr.evaluate((runId) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const id = document.querySelector('#rb-as').value;
      const run = w.runs.find((r) => r.id === runId);
      const line = NS.data.runRows(w, run).find((x) => x.investor.id === id);
      return { id, gross: line.cents, withheld: line.withheldCents, net: line.netCents, text: (document.querySelector('#rb-preview .rb-doc') || { innerText: '' }).innerText };
    }, pick.newest);
    const usd = (c) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const want = [usd(fig.gross), usd(fig.withheld), usd(fig.net)];
    check(`the notice previews ${fig.id}'s gross, tax withheld and net from the payment (${want.join(', ')})`, fig.gross > 0 && want.every((s) => fig.text.indexOf(s) >= 0), { want, text: fig.text.slice(0, 600) });
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await T.wayOut(check, fr);
    await A.context.close();
  },

  /** RB-14: the whole firm on the phone frame, each file timed in the page; a second batch stopped after the second file. */
  async 'speed-phone'({ check, S }) {
    const { A, fr } = await F.open(S, 'phone', check);
    await newReport(fr, 'Q4 firm letter', 'all');
    const N = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const t = NS.state.ui.rb.draft;
      const w = NS.state.ws;
      const o = w.offerings.find((x) => x.id === 'kb-fund-ii');
      const q = NS.audit.presets(w, o).find((p) => p.id === 'q');
      return NS.reports.recipients(w, t, { from: q.from, to: q.to, audience: { kind: 'all' } }).length;
    });
    const label = await fr.locator('[data-action=rd-gen]').innerText();
    check(`'Every investor, all their funds' reads 'Generate for ${N} investors'`, N > 2 && label.trim() === `Generate for ${N} investors`, label);
    const g = await generate(fr);
    check(`the batch ends 'Made ${N} of ${N}'`, g.text === `Made ${N} of ${N}`, g.text);
    const tm = await fr.evaluate(() => window.CVPortal.reportsDeliver.timings());
    const total = Math.round(tm.total);
    const per = tm.files ? Math.round(tm.total / tm.files) : 0;
    const line = `speed: ${tm.files} reports, ${total} ms, ${per} ms per report`;
    console.log(line);
    check(`each of the ${N} files was timed in the page with performance.now (${line})`, tm.files === N && tm.each.length === N && tm.each.every((x) => x > 0), tm);
    const s = await generate(fr, 2);
    const m = /^Stopped after (\d+) of (\d+)$/.exec(s.text);
    const k = m ? Number(m[1]) : -1;
    check(`'Stop' after the second file ends 'Stopped after k of ${N}' with 2 <= k < ${N}`, !!m && Number(m[2]) === N && k >= 2 && k < N, s.text);
    const ar = await archive(fr);
    const run = await fr.evaluate(() => {
      const r = window.CVPortal.reportRecord.runsOf(window.CVPortal.state.ws)[0];
      return { id: r.id, state: r.state, files: r.files.length };
    });
    check(`the stopped run is in the archive with k files (${k}), stopped`, run.state === 'stopped' && run.files === k && ar[0] && ar[0].id === run.id && ar[0].files.length === k && /Stopped/.test(ar[0].text), { run, ar0: ar[0] && { id: ar[0].id, files: ar[0].files.length } });
    check("a stopped run offers no 'Deliver'", (await fr.locator(`.rd-run[data-id="${run.id}"] [data-action=rd-deliver]`).count()) === 0, run.id);
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await T.wayOut(check, fr);
    await A.context.close();
  },

  /** Tax documents' opens are still counted by their own hook beside report opens; the managed edition is unchanged (C-08). */
  async 'managed-taxdocs'({ check, S }) {
    {
      const { A, fr } = await F.open(S, 'phone', check);
      const sd = await seed(fr, { name: 'Q4 beside tax' });
      const rep = sd.files[0];
      const inv = rep.inv[0];
      // a delivered tax document for the same investor: made by the tax documents module, then shown as delivered
      const tax = await fr.evaluate(async ({ inv, fund, from }) => {
        const NS = window.CVPortal;
        const w = NS.state.ws;
        const blob = await NS.ops.files.get(from);
        const id = 'td-deliver-flow-1';
        const d = NS.taxdocs.addGenerated(w, { id, kind: 'letter', year: 2026, investorId: inv, offeringId: fund, confirmedBy: 'Pat Admin', title: 'Tax letter 2026', fileName: 'Tax-letter-2026.pdf', size: blob.size, sha256: '' });
        await NS.ops.files.put(id, blob);
        d.tax.state = 'delivered';
        d.tax.deliveredAt = '2027-01-20T12:00:00Z';
        d.hidden = false;
        d.publishedAt = '2027-01-20T12:00:00Z';
        NS.app.save(true);
        return { id, opens: d.tax.opens.count };
      }, { inv, fund: FUND, from: rep.id });
      const counts = () =>
        fr.evaluate(({ tax, rep }) => {
          const w = window.CVPortal.state.ws;
          const t = w.docs.find((d) => d.id === tax);
          const r = w.docs.find((d) => d.id === rep);
          const reports = w.docs.filter((d) => d.report).reduce((n, d) => n + Object.keys(d.report.opens || {}).reduce((m, k) => m + d.report.opens[k].count, 0), 0);
          return { tax: t.tax.opens.count, taxReport: !!t.report, rep: (r.report.opens[Object.keys(r.report.opens)[0]] || { count: 0 }).count, reports, taxLog: (w.audit || []).filter((e) => e.action === 'Tax document opened' && e.record === tax).length, repLog: (w.audit || []).filter((e) => e.action === 'Report opened').length };
        }, { tax: tax.id, rep: rep.id });
      const rows = await documentsAs(fr, inv);
      check('the investor\'s Documents list the tax document and the report', rows.some((r) => r.id === tax.id) && rows.some((r) => r.id === rep.id), rows.slice(0, 6));
      await T.press(fr, `[data-action=open-doc][data-id="${tax.id}"]`);
      await fr.waitForSelector('#dlg .dlg-head', { timeout: 10000 });
      await fr.waitForTimeout(400);
      let c = await counts();
      check("opening the tax document counts in its tax.opens (taxdocs-investor.js's hook) and adds no report open", c.tax === 1 && c.taxLog === 1 && !c.taxReport && c.reports === 0 && c.repLog === 0, c);
      await T.press(fr, '#dlg [data-action=close-dialog]');
      await fr.waitForTimeout(200);
      await T.press(fr, `[data-action=open-doc][data-id="${rep.id}"]`);
      await fr.waitForSelector('#dlg .dlg-head', { timeout: 10000 });
      await fr.waitForTimeout(400);
      c = await counts();
      check('a report opened in the same session counts in its report block only', c.rep === 1 && c.reports === 1 && c.repLog === 1 && c.tax === 1 && c.taxLog === 1, c);
      await T.press(fr, '#dlg [data-action=close-dialog]');
      await T.quiet(check, A, fr);
      await A.context.close();
    }
    for (const role of ['staff', 'investor']) {
      const { A, fr } = await T.framed(S, 'desktop', { page: 'index.html', clock: '2027-01-20' });
      await T.proveRefused(check, A, fr);
      await T.sample(fr, { role });
      await fr.evaluate((role) => (location.hash = role === 'staff' ? '#console-reports' : '#documents'), role);
      await fr.waitForTimeout(1500);
      const m = await fr.evaluate(() => ({
        tab: document.querySelectorAll('[data-action=rep-tab][data-t=investor]').length,
        rd: document.querySelectorAll('.rd, [data-action^=rd-]').length,
        text: /Investor reports|Generate for|Send on paper|Tell investors/.test(document.body.innerText),
        ui: typeof window.CVPortal.reportsUI,
        deliver: typeof window.CVPortal.reportsDeliver,
        hooks: (window.CVPortal.hooks.documentOpened || []).length
      }));
      check(`index.html at 1280x800 as ${role}: no report control, the builder and delivery not loaded`, m.tab === 0 && m.rd === 0 && !m.text && m.ui === 'undefined' && m.deliver === 'undefined', m);
      check(`index.html as ${role}: no error on the page`, A.errors.length === 0, A.errors);
      await A.context.close();
    }
  }
};

if (require.main === module) {
  Lib.runParts(parts, { name: 'DELIVER FLOW', unit: 'parts', flag: '--only', browser: true });
}
module.exports = { parts };
