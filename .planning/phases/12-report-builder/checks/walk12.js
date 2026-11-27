// gate: none
// WALK12 (plan 12-09): the owner's path through the report builder, end to end, in the owner's frame (a sandboxed iframe
// whose policy refuses every connection and loads scripts from the page's own address only), at 390x844 with touch,
// clock 2027-01-20. Run once by plan 12-09 (not in every gate). One browser context for the whole walk: each step
// starts where the step before it ended, so the steps run in order and are never kept from an earlier run.
// Every step takes one screenshot with a description (P6_SHOTS: index.txt, and walk12-index.txt in step order), and
// checks its screen: the policy refused nothing, no new script error, no request left the page's own origin (counted
// from the first request of the walk, printed), no vendor, model or library name and never the forbidden word on
// screen, and a way out of the view on screen. Every Generate prints its measured time.
//   node checks/walk12.js [--only step,step]   (steps depend on the steps before them)
// Last line: "WALK12: PASS (steps run: N)" or "WALK12: FAIL (steps run: N) - <failed steps>".
'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const L12 = require('./lib12.js');
const T = require(path.join(L12.P10, 'checks/lib10.js'));
const F = require('./reports-flow.js');
const D = require('./deliver-flow.js');
const Lib = T.Lib;

// Steps depend on each other: a step is never kept from an earlier run.
process.env.GATE_FRESH = '1';

const CLOCK = '2027-01-20';
const KB = 'kestrel-bay';
const AR = 'ashwell-ridge';
const PB = 'pellbrook';
const KB_FUND = 'kb-fund-ii';
const AR_FUND = 'ar-cedar-row';
const PB_FUND = 'pb-long-short';
const PE = 'Quarterly letter: venture or private equity';
const RE = 'Quarterly letter: real estate';
const OPEN = 'Quarterly letter: open-ended fund';
const NONE = 'Every file of this report is withdrawn; there is no one to tell.';
const NOT_KEPT = 'The original file is not kept on this device.';
const NO_HOLDING = 'No holding in the books for this fund yet.';
const COUNSEL = 'Investors with no consent to electronic delivery on record. Their reports are in their Documents too. To be confirmed with counsel.';
const MINUS = '−';
const LONG = { timeout: 300000 };
const OUT = () => L12.work('walk12');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const J = (x) => JSON.stringify(x);
const slug = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/* ---------- the walk's shared state ---------- */
const W = { A: null, fr: null, S: null, off: [], offAt: 0, err0: 0, shots: [], step: '', kb: {}, ar: {}, pb: {}, fa: {} };

/** One screenshot of the phone screen as it is, with its description (copied to the owner's folder by lib.js). */
async function shot(name, what, scrollTo) {
  if (scrollTo)
    await W.fr
      .evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return;
        el.scrollIntoView({ block: 'start' });
        // the editor's bar ('Back to reports' and the title) stays at the top: show what is under it
        window.scrollBy(0, -120);
      }, scrollTo)
      .catch(() => {});
  await W.fr.waitForTimeout(250);
  Lib.describeShots([[name, what]]);
  await W.A.page.screenshot({ path: path.join(OUT(), name) });
  W.shots.push({ step: W.step, file: `walk12__${W.step}__${name}`, what });
  writeIndex();
}
function writeIndex() {
  const dir = Lib.OWNER_SHOTS;
  fs.mkdirSync(dir, { recursive: true });
  const lines = ['The report builder, the owner\'s path (plan 12-09, WALK12): one screenshot per step, in step order.', `Folder: ${dir}`, 'Phone frame 390x844 with touch, Chromium (not iPhone Safari), clock 2027-01-20.', ''];
  W.shots.forEach((s, k) => lines.push(`${String(k + 1).padStart(2, '0')}. step ${s.step}: ${s.file}`, `      ${s.what}`));
  fs.writeFileSync(path.join(dir, 'walk12-index.txt'), lines.join('\n') + '\n');
}

/** The checks every screen of the walk gets. o.dialog: the view is a dialog, whose own Close button is its way out. */
async function screen(check, o) {
  o = o || {};
  const fr = W.fr;
  const refused = await fr.evaluate(() => (window.__cspv || []).slice());
  check('the policy refused nothing (no fetch, no outside script)', refused.length === 0, refused);
  const errs = W.A.errors.slice(W.err0);
  W.err0 = W.A.errors.length;
  check('no new script error in the browser', errs.length === 0, errs);
  const mine = W.off.slice(W.offAt);
  console.log(`requests outside the page's origin: ${mine.length} in step ${W.step}, ${W.off.length} since the walk began`);
  check(`no request left the page's own origin in this step (${mine.length})`, mine.length === 0, mine.slice(0, 5));
  await T.leak(check, fr);
  if (o.dialog) {
    const ok = await fr.evaluate(() => {
      const b = document.querySelector('#dlg [data-action=close-dialog]');
      if (!b) return false;
      const r = b.getBoundingClientRect();
      if (!r.width || r.top < 0 || r.bottom > innerHeight || r.right > innerWidth) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && (hit === b || b.contains(hit));
    });
    check("the dialog's Close button is on screen (its way out)", ok, ok);
  } else await T.wayOut(check, fr);
}
/** A step that needs the walk opened by the first step. */
function needs(check) {
  if (W.fr) return true;
  check('the walk is open (the first step opened it)', false, 'no frame');
  return false;
}

/* ---------- moving about ---------- */
/** A sample firm in the same frame (the same browser and file store), signed in as admin. */
async function firm(id) {
  const fr = W.fr;
  await fr.evaluate((id) => {
    const NS = window.CVPortal;
    if (!NS.state.ws || NS.state.ws.tenant.id !== id) NS.app.setClient(id, 'console');
  }, id);
  await fr.waitForFunction((id) => !!(window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === id), id, { timeout: 20000 });
  await role('admin');
}
async function role(r) {
  const fr = W.fr;
  await fr.waitForSelector('#demo-role', { state: 'attached' });
  await fr.evaluate((r) => {
    const el = document.getElementById('demo-role');
    el.value = r;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, r);
  await fr.waitForFunction((r) => window.CVPortal.state.role === r, r);
  await fr.waitForTimeout(300);
}
/** Signed in as one investor of the open firm, on Documents; resolves to the report rows listed: [{ id, title, cat }]. */
async function documentsAs(investor) {
  const fr = W.fr;
  await fr.evaluate((id) => (window.CVPortal.state.viewer = id), investor);
  await role('investor');
  await fr.evaluate((id) => (window.CVPortal.state.viewer = id), investor);
  await fr.evaluate(() => (location.hash = '#documents'));
  await fr.waitForSelector('.tbl-docs, .empty', { timeout: 20000 });
  await fr.waitForTimeout(300);
  return fr.evaluate(() =>
    Array.from(document.querySelectorAll('.tbl-docs tbody tr')).map((tr) => {
      const b = tr.querySelector('[data-action=open-doc]');
      const cells = Array.from(tr.cells).map((c) => c.innerText.trim());
      return { id: b ? b.getAttribute('data-id') : '', title: b ? b.innerText.trim() : '', cat: cells[cells.length - 2] || '' };
    })
  );
}
/** The Documents viewer watched: the SHA-256 of every file handed to the PDF viewer. */
const watchViewer = () =>
  W.fr.evaluate(() => {
    const NS = window.CVPortal;
    if (NS.esign.__watched) return;
    const real = NS.esign.viewPdf;
    NS.esign.viewPdf = async function (body, blob) {
      (window.__viewed = window.__viewed || []).push(NS.audit.sha256(new Uint8Array(await blob.arrayBuffer())));
      return real.apply(this, arguments);
    };
    NS.esign.__watched = true;
  });
/** Open a document from Documents and read the viewer once it has settled. */
async function viewDoc(id) {
  const fr = W.fr;
  await watchViewer();
  await fr.evaluate(() => (window.__viewed = []));
  await T.press(fr, `.tbl-docs [data-action=open-doc][data-id="${id}"]`);
  await fr.waitForSelector('#dlg .dlg-body', { timeout: 20000 });
  await fr
    .waitForFunction(
      () => {
        const b = document.querySelector('#dlg .dlg-body');
        if (!b) return false;
        const imgs = Array.from(b.querySelectorAll('img.doc-page'));
        if (imgs.length) return imgs.every((i) => i.complete && i.naturalWidth > 0);
        const t = b.innerText.trim();
        return t.length > 0 && !/^Loading/.test(t) && !/^Preparing/.test(t);
      },
      null,
      { timeout: 120000 }
    )
    .catch(() => {});
  await fr.waitForTimeout(300);
  return fr.evaluate(() => {
    const b = document.querySelector('#dlg .dlg-body');
    return { viewed: (window.__viewed || []).slice(), pages: b ? b.querySelectorAll('img.doc-page').length : 0, text: b ? b.innerText.trim() : '' };
  });
}
async function closeDialog() {
  await T.press(W.fr, '#dlg [data-action=close-dialog]');
  await W.fr.waitForTimeout(250);
}
/** New report from the list: type, the starter by its label, a name; then the fund, the quarter and who it is for. */
async function newReport(type, start, name, fund, who, preset) {
  const fr = W.fr;
  await D.toList(fr);
  await fr.selectOption('#rb-type', type);
  await fr.waitForTimeout(150);
  const starts = await fr.evaluate(() => Array.from(document.querySelectorAll('#rb-start option')).map((o) => o.textContent.trim()));
  await fr.selectOption('#rb-start', { label: start });
  await fr.fill('#rb-name', name);
  await T.press(fr, '[data-action=rb-create]');
  await fr.waitForSelector('.rb-edit', { timeout: 10000 });
  await fr.selectOption('#rb-fund', fund);
  await fr.waitForTimeout(150);
  if (await fr.locator('#rb-period').count()) {
    await fr.selectOption('#rb-period', preset || 'q');
    await fr.waitForTimeout(150);
  }
  if (who && (await fr.locator(`input[name=rb-who][value=${who}]`).count())) {
    await T.press(fr, `input[name=rb-who][value=${who}]`);
    await fr.waitForTimeout(200);
  }
  return { starts, id: await fr.evaluate(() => window.CVPortal.state.ui.rb.draft.id) };
}
/** Save the open template; resolves to the version shown. */
async function save() {
  await T.press(W.fr, '[data-action=rb-save]');
  await W.fr.waitForTimeout(300);
  return W.fr.evaluate(() => (document.querySelector('#rb-ver') || { innerText: '' }).innerText.trim());
}
/** 'See the PDF': resolves to the number of pages drawn in the panel. */
async function seePdf() {
  await T.press(W.fr, '[data-action=rb-pdf]');
  return W.fr
    .waitForFunction(() => {
      const imgs = Array.from(document.querySelectorAll('#rb-pdfpanel img.doc-page'));
      return imgs.length && imgs.every((i) => i.complete && i.naturalWidth > 0) ? imgs.length : 0;
    }, null, { timeout: 60000 })
    .then((h) => h.jsonValue())
    .catch(() => 0);
}
async function closePdf() {
  if (await W.fr.locator('[data-action=rb-pdf-close]').count()) await T.press(W.fr, '[data-action=rb-pdf-close]');
  await W.fr.waitForTimeout(200);
}
/** 'Download PDF' in the editor: { file, name, text, info, images } or null. */
async function downloadPdf(name) {
  const [dl] = await Promise.all([W.A.page.waitForEvent('download', { timeout: 60000 }), T.press(W.fr, '[data-action=rb-dl-pdf]')]).catch(() => [null]);
  if (!dl) return null;
  const file = path.join(OUT(), name);
  await dl.saveAs(file);
  return { file, name: dl.suggestedFilename(), text: L12.text(file), info: L12.info(file), images: L12.images(file), bytes: fs.readFileSync(file) };
}
/** Press Generate and wait for the run to end; resolves to { text, ms (the page's performance.now total), files, wall }. */
async function generate() {
  const fr = W.fr;
  const t0 = Date.now();
  await T.press(fr, '[data-action=rd-gen]');
  await fr.waitForFunction(() => {
    const el = document.querySelector('[data-rd=progress]');
    return !!el && !document.querySelector('[data-action=rd-stop]') && /^(Made|Stopped after) \d+ of \d+$/.test(el.innerText.trim());
  }, null, LONG);
  const wall = Date.now() - t0;
  const text = await fr.evaluate(() => document.querySelector('[data-rd=progress]').innerText.trim());
  const tm = await fr.evaluate(() => window.CVPortal.reportsDeliver.timings());
  return { text, ms: Math.round(tm.total), files: tm.files, per: tm.files ? Math.round(tm.total / tm.files) : 0, wall };
}
function timeLine(what, g) {
  const line = `generate: ${what}: ${g.files} files, ${g.ms} ms in the page (${g.per} ms per file, performance.now), ${g.wall} ms from the tap to the last line`;
  console.log(line);
  return line;
}
const newestRun = () =>
  W.fr.evaluate(() => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    const r = NS.reportRecord.runsOf(w)[0];
    return r ? { id: r.id, templateId: r.templateId, state: r.state, files: r.files.map((f) => ({ id: f.id, inv: f.investorIds.slice(), sha256: f.sha256, name: f.name })) } : null;
  });
async function deliverRun(runId, by) {
  const fr = W.fr;
  await fr.fill(`.rd-run[data-id="${runId}"] #rd-by`, by);
  await T.press(fr, `.rd-run[data-id="${runId}"] [data-action=rd-deliver]`);
  await fr.waitForTimeout(400);
  return fr.evaluate((id) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    const r = NS.reportRecord.runOf(w, id);
    const li = document.querySelector(`.rd-run[data-id="${id}"]`);
    return { by: r.delivered ? r.delivered.by : '', docs: r.delivered ? r.delivered.docs.slice() : [], text: li ? li.innerText : '' };
  }, runId);
}
/** The preview's table titles, words and photos once it has settled. */
async function preview() {
  const st = await F.previewState(W.fr);
  st.photos = await W.fr.evaluate(() => document.querySelectorAll('#rb-preview .rb-photo img').length);
  st.bold = await W.fr.evaluate(() => Array.from(document.querySelectorAll('#rb-preview .rb-doc p b, #rb-preview .rb-doc p strong')).map((b) => b.textContent));
  st.items = await W.fr.evaluate(() => Array.from(document.querySelectorAll('#rb-preview .rb-doc ul li')).map((li) => li.textContent.trim()));
  st.titles = st.tables.map((t) => t.title);
  return st;
}
/** A JPEG made in the page: a sky, a field and a block of a building, w x h. Resolves to its bytes. */
async function jpeg(w, h) {
  const b64 = await W.fr.evaluate(({ w, h }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#6FA8DC');
    sky.addColorStop(1, '#D9EAF7');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5B8C3A';
    g.fillRect(0, Math.round(h * 0.7), w, h);
    g.fillStyle = '#8C6E54';
    g.fillRect(Math.round(w * 0.3), Math.round(h * 0.35), Math.round(w * 0.4), Math.round(h * 0.36));
    g.fillStyle = '#F4F1EA';
    for (let k = 0; k < 4; k++) g.fillRect(Math.round(w * (0.34 + k * 0.09)), Math.round(h * 0.42), Math.round(w * 0.05), Math.round(h * 0.08));
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }, { w, h });
  return Buffer.from(b64, 'base64');
}
/** Asset updates opened: the holdings listed, and whether the no-holding line shows. */
async function assetRows() {
  await F.openSec(W.fr, 'assets');
  return W.fr.evaluate((none) => ({
    rows: Array.from(document.querySelectorAll('.rb-hold')).map((d) => ({ id: d.getAttribute('data-holding'), name: (d.querySelector('h4') || { innerText: '' }).innerText.trim() })),
    none: ((document.querySelector('.rb-sec[data-key=assets]') || { innerText: '' }).innerText || '').indexOf(none) >= 0
  }), NO_HOLDING);
}
/** Turn a section on or off by its switch (only when it is not already as wanted). */
async function switchTo(key, on) {
  const is = await W.fr.evaluate((k) => {
    const el = document.querySelector(`.rb-sec[data-key=${k}] input.rb-on`);
    return el ? el.checked : null;
  }, key);
  if (is !== on) await T.press(W.fr, `.rb-sec[data-key=${key}] label.rb-switch`);
  await W.fr.waitForTimeout(250);
}
/** A photo for one holding in Asset updates; resolves once the template holds it. */
async function holdingPhoto(hid, buf, name) {
  await W.fr.setInputFiles(`.rb-hold[data-holding="${hid}"] input[type=file]`, [{ name, mimeType: 'image/jpeg', buffer: buf }]);
  return W.fr
    .waitForFunction((hid) => {
      const t = window.CVPortal.reportsUI.state().draft;
      const it = (t.sections.find((s) => s.key === 'assets').opts.items || []).find((x) => x.holdingId === hid);
      return it && it.photoIds.length >= 1 ? it.photoIds.slice() : null;
    }, hid, { timeout: 30000 })
    .then((h) => h.jsonValue())
    .catch(() => null);
}
/** The open firm's holdings of a fund as the engine gives them (NS.reportsData.holdings at the quarter's end). */
const engineHoldings = (fund, to) =>
  W.fr.evaluate(({ fund, to }) => {
    const NS = window.CVPortal;
    const H = NS.reportsData.holdings(NS.state.ws, fund, to);
    return H ? H.rows.map((r) => ({ id: r.id, name: r.name, fv: r.fv, cost: r.cost })) : null;
  }, { fund, to });
/** Fund A (P11/checks/fixtures/fund-a.js) seated in the page as its own firm, with no sample flag; resolves to its id. */
async function seatFundA() {
  const Fx = JSON.parse(JSON.stringify(require(path.join(L12.P11, 'checks/fixtures/fund-a.js'))));
  const id = await W.fr.evaluate((Fx) => {
    const NS = window.CVPortal;
    const oid = Fx.expect.offeringId;
    const ws = NS.workspace.create(Fx.records.tenant.name);
    ws.tenant.legalName = Fx.records.tenant.legalName;
    ws.tenant.shortName = Fx.records.tenant.shortName;
    ws.tenant.sample = false;
    ws.offerings.push(Fx.records.offerings[0]);
    Fx.records.investors.forEach((i) => {
      i.onboarding = i.onboarding || { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05', source: 'manual' };
      ws.investors.push(i);
    });
    ws.calls = (ws.calls || []).concat(Fx.records.calls || []);
    ws.runs = (ws.runs || []).concat(Fx.records.runs || []);
    ws.books = { v: 1, funds: {} };
    ws.books.funds[oid] = Fx.records.books.funds[oid];
    Fx.entries.forEach((e) => NS.books.post(ws, oid, e, { by: 'Walk Runner', at: '2027-01-20T10:00:00.000Z' }));
    NS.workspace.save(ws, true);
    NS.app.setClient(ws.tenant.id, 'console');
    return ws.tenant.id;
  }, Fx);
  await W.fr.waitForFunction((id) => !!(window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === id), id, { timeout: 20000 });
  await role('admin');
  return id;
}

/* ---------- the steps ---------- */
const steps = {
  /** The phone frame, Kestrel Bay as admin, Reports, tab 'Investor reports'. */
  async 'kb-open'({ check, S }) {
    W.S = S;
    const { A } = await T.framed(S, 'phone', { page: 'diy.html', policy: 'self', clock: CLOCK });
    W.A = A;
    // every request that leaves the page's own origin, from the first one of the walk (the page is loaded again)
    A.context.on('request', (r) => {
      const u = r.url();
      if (!(u.startsWith(S.origin + '/') || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:'))) W.off.push(u);
    });
    W.fr = await A.setClock(CLOCK);
    W.err0 = 0;
    await T.proveRefused(check, A, W.fr);
    const size = await W.fr.evaluate(() => [innerWidth, innerHeight, navigator.maxTouchPoints > 0]);
    check('the frame is 390x844 with touch', size[0] === 390 && size[1] === 844 && size[2] === true, size);
    await T.sample(W.fr, { role: 'admin' });
    await F.toTab(W.fr);
    const line = await W.fr.evaluate(() => (document.querySelector('.rb-506') || { innerText: '' }).innerText.trim());
    check("the list shows the 506 line, ending 'To be confirmed with counsel.' (C-13)", /To be confirmed with counsel\.$/.test(line), line);
    await shot('01-list.png', "Kestrel Bay as admin: Reports, tab 'Investor reports' (the 506 line, New report, saved templates)");
    await screen(check);
  },

  /** New report from 'Quarterly letter: venture or private equity' for Kestrel Bay Fund II, the quarter, every investor. */
  async 'kb-new'({ check }) {
    if (!needs(check)) return;
    const r = await newReport('quarterly', PE, 'Q4 2026 letter', KB_FUND, 'fund');
    W.kb.tid = r.id;
    check(`'Start from' offers '${PE}'`, r.starts.indexOf(PE) >= 0, r.starts);
    const t = await W.fr.evaluate(() => {
      const d = window.CVPortal.state.ui.rb.draft;
      return { name: d.name, starter: d.starter || d.from || '', on: d.sections.filter((s) => s.on).map((s) => s.key) };
    });
    check("the editor opened on 'Q4 2026 letter' with the starter's sections on", t.name === 'Q4 2026 letter' && t.on.indexOf('performance') >= 0 && t.on.indexOf('fees') >= 0, t);
    W.kb.order0 = await W.fr.evaluate(() => Array.from(document.querySelectorAll('.rb-sec')).map((x) => x.getAttribute('data-key')));
    await shot('02-editor.png', `The editor for 'Q4 2026 letter' (from '${PE}'), Kestrel Bay Fund II, Q4 2026, every investor in the fund`, '.rb-edit');
    await screen(check);
  },

  /** One section off (Fees and expenses), one moved up (Holdings, above Performance). */
  async 'kb-sections'({ check }) {
    if (!needs(check)) return;
    const st0 = await preview();
    check("with 'Fees and expenses' on, the preview has the table 'Fees and expenses' (or its no-fees line)", st0.titles.indexOf('Fees and expenses') >= 0 || /No fees or expenses in this period\./.test(st0.text), st0.titles);
    await switchTo('fees', false);
    const st1 = await preview();
    check("'Fees and expenses' turned off: no fees table and no fees line in the preview", st1.titles.indexOf('Fees and expenses') < 0 && !/No fees or expenses in this period\./.test(st1.text), st1.titles);
    const before = await W.fr.evaluate(() => Array.from(document.querySelectorAll('.rb-sec')).map((x) => x.getAttribute('data-key')));
    const k = before.indexOf('holdings');
    console.log(`sections before the move: ${before.join(', ')}`);
    await T.press(W.fr, '.rb-sec[data-key=holdings] [data-action=rb-move][data-dir=up]');
    await W.fr.waitForTimeout(250);
    const after = await W.fr.evaluate(() => Array.from(document.querySelectorAll('.rb-sec')).map((x) => x.getAttribute('data-key')));
    check(`'Move up' on Holdings puts it before '${before[k - 1]}' in the editor`, k > 0 && after.indexOf('holdings') === k - 1 && after[k] === before[k - 1], { before, after });
    const st2 = await preview();
    const t1 = st1.titles;
    const t2 = st2.titles;
    check("the preview's 'Holdings' table now comes before 'Net performance' (it came after)", t1.indexOf('Holdings') > t1.indexOf('Net performance') && t1.indexOf('Net performance') >= 0 && t2.indexOf('Holdings') >= 0 && t2.indexOf('Holdings') < t2.indexOf('Net performance'), { before: t1, after: t2 });
    W.kb.order1 = after;
    await shot('03-sections.png', "'Fees and expenses' switched off and 'Holdings' moved up one place (Move up), on the phone", '.rb-sec[data-key=holdings]');
    await screen(check);
  },

  /** The letter: a bold word and a list. */
  async 'kb-letter'({ check }) {
    if (!needs(check)) return;
    const fr = W.fr;
    const A = W.A;
    await F.openSec(fr, 'letter');
    const area = '.rb-sec[data-key=letter] .rb-area';
    await fr.evaluate((a) => {
      const el = document.querySelector(a);
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(true);
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }, area);
    await T.press(fr, area);
    await fr.evaluate((a) => {
      const el = document.querySelector(a);
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }, area);
    await A.page.keyboard.press('Enter');
    await A.page.keyboard.type('Highlights this quarter');
    await fr.waitForTimeout(250);
    // the word 'Highlights' made bold
    await fr.evaluate((a) => {
      const el = document.querySelector(a);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let t;
      let n;
      while ((n = walker.nextNode())) if (n.textContent.indexOf('Highlights this quarter') >= 0) t = n;
      const at = t.textContent.indexOf('Highlights');
      const r = document.createRange();
      r.setStart(t, at);
      r.setEnd(t, at + 'Highlights'.length);
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }, area);
    await fr.waitForTimeout(100);
    await T.press(fr, '.rb-sec[data-key=letter] [data-cmd=bold]');
    await fr.evaluate((a) => {
      const el = document.querySelector(a);
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }, area);
    await A.page.keyboard.press('Enter');
    await A.page.keyboard.type('Two new portfolio companies');
    await T.press(fr, '.rb-sec[data-key=letter] [data-cmd=list]');
    await fr.waitForTimeout(200);
    await A.page.keyboard.press('Enter');
    await A.page.keyboard.type('One follow-on round');
    await fr.waitForTimeout(400);
    const st = await preview();
    check("the preview shows 'Highlights' in bold", st.bold.indexOf('Highlights') >= 0, st.bold);
    check("the preview shows the list 'Two new portfolio companies', 'One follow-on round'", st.items.indexOf('Two new portfolio companies') >= 0 && st.items.indexOf('One follow-on round') >= 0, st.items);
    check('no error stands in the preview', st.errors.length === 0, st.errors);
    await shot('04-letter.png', "The letter in rich text on the phone: 'Highlights' in bold and a two-item list, with the toolbar", '.rb-sec[data-key=letter]');
    await screen(check);
  },

  /** Asset updates lists the sample holdings by id; a JPEG the walk makes goes on one and shows in the preview. */
  async 'kb-asset-photo'({ check }) {
    if (!needs(check)) return;
    const fr = W.fr;
    await switchTo('assets', true);
    const want = await fr.evaluate((fund) => (window.CVPortal.state.ws.offerings.find((o) => o.id === fund).holdings || []).map((h) => ({ id: h.id || '', name: h.name })), KB_FUND);
    const L = await assetRows();
    check(`Asset updates never says '${NO_HOLDING}'`, !L.none, L);
    check(`Asset updates lists Kestrel Bay Fund II's ${want.length} sample holdings, each under '${KB_FUND}-<slug of its name>'`, want.length > 0 && L.rows.length === want.length && L.rows.every((r, k) => r.id === `${KB_FUND}-${slug(want[k].name)}` && r.id === want[k].id), { rows: L.rows, want });
    const hid = L.rows[0] && L.rows[0].id;
    W.kb.photoHolding = hid;
    W.kb.jpeg = await jpeg(800, 600);
    check('the walk made an 800 x 600 JPEG in the page', W.kb.jpeg[0] === 0xff && W.kb.jpeg[1] === 0xd8, W.kb.jpeg.subarray(0, 4));
    const ids = hid ? await holdingPhoto(hid, W.kb.jpeg, 'site-visit.jpg') : null;
    check(`the photo is kept for ${L.rows[0] && L.rows[0].name}, by that holding's id`, !!ids && ids.length === 1, ids);
    const st = await preview();
    check('the preview shows the photo', st.photos >= 1, st.photos);
    await shot('05-asset-photo.png', `Asset updates on the phone: Kestrel Bay Fund II's sample holdings, the walk's photo on '${L.rows[0] && L.rows[0].name}'`, `.rb-hold[data-holding="${hid}"]`);
    await screen(check);
  },

  /** The preview for the fund's first holder. */
  async 'kb-preview'({ check }) {
    if (!needs(check)) return;
    const st = await preview();
    const who = await W.fr.evaluate(() => {
      const NS = window.CVPortal;
      const id = document.querySelector('#rb-as').value;
      return { id, title: NS.state.ws.investors.find((i) => i.id === id).title };
    });
    W.kb.first = who;
    check(`the preview is prepared for the first holder (${who.title})`, st.text.indexOf(`Prepared for ${who.title}`) >= 0, st.text.slice(0, 300));
    check('no error stands; See the PDF, Download PDF and Download spreadsheet are on', st.errors.length === 0 && st.pdf && st.dlPdf && st.dlXlsx, st);
    check('the preview holds the photo, the bold word and the list', st.photos >= 1 && st.bold.indexOf('Highlights') >= 0 && st.items.length >= 2, { photos: st.photos, bold: st.bold, items: st.items });
    await shot('06-preview.png', `The preview on the phone, prepared for ${who.title}`, '#rb-preview');
    await screen(check);
  },

  /** 'See the PDF': the pages drawn in the page. */
  async 'kb-pdf'({ check }) {
    if (!needs(check)) return;
    const n = await seePdf();
    check('See the PDF draws the pages inside the panel', n >= 1, n);
    W.kb.pages = n;
    await shot('07-pdf.png', `'See the PDF' on the phone: ${n} pages drawn inside the page (no PDF viewer)`, '#rb-pdfpanel');
    await screen(check);
    await closePdf();
  },

  /** 'Download PDF': the file, its photo, its words; nothing names a vendor. */
  async 'kb-download'({ check }) {
    if (!needs(check)) return;
    const P = await downloadPdf('kb-letter.pdf');
    check("'Download PDF' gives a PDF", !!P && P.bytes.subarray(0, 5).toString() === '%PDF-', P && P.name);
    if (P) {
      W.kb.pdfName = P.name;
      check(`the file is named for the firm, the report, the quarter and the investor (${P.name})`, /^Kestrel_Bay_.*Q4_2026.*\.pdf$/.test(P.name), P.name);
      check('the PDF holds the walk\'s 800 x 600 photo as a JPEG image', P.images.some((x) => x.width === 800 && x.height === 600 && x.enc === 'jpeg'), P.images);
      const flat = P.text.replace(/\s+/g, ' ');
      check("the PDF holds 'Highlights', the list and 'Prepared for' the first holder", flat.indexOf('Highlights') >= 0 && flat.indexOf('Two new portfolio companies') >= 0 && flat.indexOf('One follow-on round') >= 0 && flat.indexOf(W.kb.first.title) >= 0, flat.slice(0, 400));
      check("the PDF has no 'Fees and expenses' table (switched off)", flat.indexOf('Fees and expenses') < 0, '');
      const lk = L12.leak(P.text + '\n' + J(P.info));
      check('no vendor, library or model name, never audited or the forbidden word in the PDF text and properties', lk.ok, lk.hits.slice(0, 5));
      check("Producer and Creator are the firm's name", P.info.Producer === P.info.Creator && /Kestrel Bay/.test(P.info.Producer || ''), { Producer: P.info.Producer, Creator: P.info.Creator });
      console.log(`downloaded: ${P.name}, ${P.bytes.length} bytes, ${P.info.Pages} pages, images ${J(P.images.map((x) => `${x.width}x${x.height} ${x.enc}`))}`);
    }
    await shot('08-download.png', `'Download PDF' on the phone: the browser was handed ${W.kb.pdfName || 'no file'}`, '[data-action=rb-dl-pdf]');
    await screen(check);
  },

  /** Save, then 'Generate' for every investor in the fund; the measured time. */
  async 'kb-generate'({ check }) {
    if (!needs(check)) return;
    const fr = W.fr;
    const v = await save();
    check("'Save' shows version 2", v === 'Version 2', v);
    const hs = await D.holders(fr, KB_FUND);
    const N = hs.length;
    W.kb.holders = hs;
    const label = (await fr.locator('[data-action=rd-gen]').innerText()).trim();
    check(`the button reads 'Generate for ${N} investors' ('Every investor in the fund')`, label === `Generate for ${N} investors`, label);
    const g = await generate();
    W.kb.time = timeLine(`Kestrel Bay, '${PE}', kb-fund-ii, every investor in the fund`, g);
    check(`the run ends 'Made ${N} of ${N}'`, g.text === `Made ${N} of ${N}`, g.text);
    const run = await newestRun();
    W.kb.run = run;
    check('the run is recorded for this template, one file per holder', !!run && run.templateId === W.kb.tid && run.files.length === N, run && { t: run.templateId, n: run.files.length });
    await shot('09-generate.png', `'Generate' on the phone: ${g.text}, the run in the archive (${g.ms} ms in the page for ${g.files} files)`, '.rd');
    await screen(check);
  },

  /** 'Deliver' as Pat Admin. */
  async 'kb-deliver'({ check }) {
    if (!needs(check) || !W.kb.run) return check('a run to deliver', false, 'none');
    const r = await deliverRun(W.kb.run.id, 'Pat Admin');
    check("the run reads 'Delivered by Pat Admin'", r.by === 'Pat Admin' && r.text.indexOf('Delivered by Pat Admin') >= 0, r.text.slice(0, 300));
    check("each holder's file is a document (one per holder)", r.docs.length === W.kb.run.files.length, r.docs.length);
    await shot('10-deliver.png', "'Deliver' as Pat Admin: the run reads 'Delivered by Pat Admin'", `.rd-run[data-id="${W.kb.run.id}"]`);
    await screen(check);
  },

  /** 'Send on paper': the counsel line and the list. */
  async 'kb-paper'({ check }) {
    if (!needs(check) || !W.kb.run) return check('a run', false, 'none');
    const fr = W.fr;
    const id = W.kb.run.id;
    await T.press(fr, `.rd-run[data-id="${id}"] [data-action=rd-paper]`);
    await fr.waitForSelector(`.rd-run[data-id="${id}"] .rd-paper`, { timeout: 10000 });
    const p = await fr.evaluate((id) => {
      const el = document.querySelector(`.rd-run[data-id="${id}"] .rd-paper`);
      return { line: (el.querySelector('[data-rd=counsel]') || { innerText: '' }).innerText.trim(), rows: Array.from(el.querySelectorAll('.rd-pinv')).map((li) => ({ id: li.getAttribute('data-id'), mark: li.querySelectorAll('[data-action=rd-mark]').length, dl: li.querySelectorAll('[data-action=rd-dl]').length })) };
    }, id);
    check("'Send on paper' shows the counsel line (C-01)", p.line === COUNSEL, p.line);
    check(`'Send on paper' lists every holder once, each with 'Download PDF' and 'Mark sent on paper' (${W.kb.holders.length})`, p.rows.length === W.kb.holders.length && p.rows.every((r) => r.mark === 1 && r.dl === 1), p.rows.slice(0, 3));
    await shot('11-paper.png', "'Send on paper' on the phone: the counsel line, each investor with 'Download PDF', a 'Sent on' date and 'Mark sent on paper'", `.rd-run[data-id="${id}"] .rd-paper`);
    await screen(check);
  },

  /** 'Mark sent on paper' for the first investor on the list. */
  async 'kb-mark-paper'({ check }) {
    if (!needs(check) || !W.kb.run) return check('a run', false, 'none');
    const fr = W.fr;
    const id = W.kb.run.id;
    const inv = await fr.evaluate((id) => (document.querySelector(`.rd-run[data-id="${id}"] .rd-pinv`) || { getAttribute: () => '' }).getAttribute('data-id'), id);
    await fr.fill(`#rd-sent-${inv}`, '2027-01-19');
    await fr.waitForTimeout(150);
    const before = await fr.evaluate(() => (window.CVPortal.state.ws.audit || []).length);
    await T.press(fr, `.rd-run[data-id="${id}"] .rd-pinv[data-id="${inv}"] [data-action=rd-mark]`);
    await fr.waitForTimeout(400);
    const r = await fr.evaluate(({ id, inv }) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const p = NS.reportRecord.paperList(w, id).find((x) => x.investorId === inv);
      const li = document.querySelector(`.rd-run[data-id="${id}"] .rd-pinv[data-id="${inv}"]`);
      const a = w.audit || [];
      return { sentOn: p ? p.sentOn : '', by: p ? p.sentBy : '', text: li ? li.innerText : '', mark: li ? li.querySelectorAll('[data-action=rd-mark]').length : -1, last: a.length ? a[a.length - 1].action : '', n: a.length, actor: NS.app.actor() };
    }, { id, inv });
    check(`'Mark sent on paper' records ${inv} as sent on 2027-01-19 by the person signed in`, r.sentOn === '2027-01-19' && r.by === r.actor, r);
    check("the row now reads 'Sent on paper' with the date and no 'Mark sent on paper' button", /Sent on paper/.test(r.text) && r.mark === 0, r.text);
    check("the change log's last entry is 'Report sent on paper'", r.last === 'Report sent on paper' && r.n === before + 1, { last: r.last, n: r.n, before });
    W.kb.paperInv = inv;
    await shot('12-mark-paper.png', `'Mark sent on paper' for ${inv}: the row reads 'Sent on paper' with the date and who marked it`, `.rd-run[data-id="${id}"] .rd-pinv[data-id="${inv}"]`);
    await screen(check);
  },

  /** 'Tell investors': the Notices page filled in; nothing is sent. */
  async 'kb-tell'({ check }) {
    if (!needs(check) || !W.kb.run) return check('a run', false, 'none');
    const fr = W.fr;
    const id = W.kb.run.id;
    const before = await fr.evaluate(() => ({ sent: (window.CVPortal.state.ws.audit || []).filter((e) => e.action === 'Notice sent').length, notices: (window.CVPortal.state.ws.notices || []).length }));
    await T.press(fr, `.rd-run[data-id="${id}"] [data-action=rd-tell]`);
    await fr.waitForSelector('#nt-subject', { timeout: 10000 });
    const nt = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const n = NS.state.ui.notice;
      return { route: NS.state.route, kind: document.querySelector('#nt-kind').value, subject: document.querySelector('#nt-subject').value, investors: (n.investors || []).length, send: (document.querySelector('[data-action=notice-send]') || { innerText: '' }).innerText.trim() };
    });
    const N = W.kb.holders.length;
    check("'Tell investors' opens Notices filled in with the quarterly template", nt.route === 'console-notices' && nt.kind === 'quarterly' && !!nt.subject, nt);
    check(`the delivered investors are chosen (${N}) and nothing is sent: the button still reads 'Send to ${N} investors'`, nt.investors === N && nt.send === `Send to ${N} investors`, nt);
    const after = await fr.evaluate(() => ({ sent: (window.CVPortal.state.ws.audit || []).filter((e) => e.action === 'Notice sent').length, notices: (window.CVPortal.state.ws.notices || []).length }));
    check("no 'Notice sent' and no notice recorded", J(after) === J(before), { before, after });
    await shot('13-tell.png', `'Tell investors': the Notices page filled in for the ${N} investors; nothing is sent until Send and Confirm`);
    await screen(check);
  },

  /** As the first holder: Documents, the report opened, drawn in the page, byte-identical to the record. */
  async 'kb-investor-open'({ check }) {
    if (!needs(check) || !W.kb.run) return check('a run', false, 'none');
    const first = W.kb.run.files[0];
    const inv = first.inv[0];
    const rows = await documentsAs(inv);
    const row = rows.find((r) => r.id === first.id);
    check(`the first holder's Documents list the report under Reports`, !!row && row.cat === 'Reports', rows.slice(0, 5));
    const doc = await W.fr.evaluate((id) => (window.CVPortal.state.ws.docs.find((d) => d.id === id) || {}).sha256 || '', first.id);
    const v = row ? await viewDoc(first.id) : { viewed: [], pages: 0, text: '' };
    check('opening it draws its pages in the page', v.pages >= 1, v);
    check("the bytes shown are the record's (SHA-256 equal to doc.sha256)", v.viewed.length === 1 && v.viewed[0] === doc && doc === first.sha256, { viewed: v.viewed, doc, record: first.sha256 });
    W.kb.opened = { inv, id: first.id };
    await shot('14-investor-open.png', `As ${inv}, the fund's first holder: Documents, the report opened and drawn in the page`);
    await screen(check, { dialog: true });
    await closeDialog();
  },

  /** As admin: the archive reads 'Opened 1 time' for that file. */
  async 'kb-opened'({ check }) {
    if (!needs(check) || !W.kb.run) return check('a run', false, 'none');
    await role('admin');
    await D.openTpl(W.fr, W.kb.tid);
    await D.openRun(W.fr, W.kb.run.id);
    const f = await W.fr.evaluate((id) => {
      const el = document.querySelector(`.rd-file[data-id="${id}"] [data-rd=opens]`);
      return el ? el.innerText.trim() : '';
    }, W.kb.opened.id);
    check("back as admin, that file reads 'Opened 1 time'", f === 'Opened 1 time', f);
    await shot('15-opened.png', `Back as admin: the archive reads 'Opened 1 time' for ${W.kb.opened.inv}'s file`, `.rd-file[data-id="${W.kb.opened.id}"]`);
    await screen(check);
  },

  /** One letter for everyone, delivered, its file withdrawn: 'Tell investors' refuses with one sentence. */
  async 'kb-tell-refused'({ check }) {
    if (!needs(check)) return;
    const fr = W.fr;
    const noticeBefore = await fr.evaluate(() => JSON.stringify(window.CVPortal.state.ui.notice || null));
    await D.openTpl(fr, W.kb.tid);
    await T.press(fr, 'input[name=rb-who][value=letter]');
    await fr.waitForTimeout(250);
    const g = await generate();
    timeLine(`Kestrel Bay, '${PE}', kb-fund-ii, one letter for everyone`, g);
    check("the letter ends 'Made 1 of 1'", g.text === 'Made 1 of 1', g.text);
    const run = await newestRun();
    const d = await deliverRun(run.id, 'Pat Admin');
    check('the letter is delivered', d.by === 'Pat Admin', d.text.slice(0, 200));
    const f = run.files[0];
    const wsel = `.rd-file[data-id="${f.id}"]`;
    await D.openRun(fr, run.id);
    await T.press(fr, `${wsel} [data-action=rd-wd]`);
    await fr.waitForSelector('#rd-why', { timeout: 10000 });
    await fr.fill('#rd-why', 'Sent in error');
    await T.press(fr, `${wsel} [data-action=rd-wd-yes]`);
    await fr.waitForTimeout(300);
    const wd = await fr.evaluate((id) => window.CVPortal.state.ws.docs.find((d) => d.id === id).report.state, f.id);
    check('its only file is withdrawn, on screen, with a reason', wd === 'withdrawn', wd);
    const noticeMid = await fr.evaluate(() => JSON.stringify(window.CVPortal.state.ui.notice || null));
    await D.openRun(fr, run.id);
    await T.press(fr, `.rd-run[data-id="${run.id}"] [data-action=rd-tell]`);
    await fr.waitForTimeout(500);
    const after = await fr.evaluate((runId) => {
      const NS = window.CVPortal;
      const el = document.querySelector(`.rd-run[data-id="${runId}"]`);
      return { route: NS.state.route, msgs: el ? Array.from(el.querySelectorAll('.rb-msg')).map((m) => m.innerText.trim()) : [], notice: JSON.stringify(NS.state.ui.notice || null) };
    }, run.id);
    check(`the report screen says exactly '${NONE}'`, after.msgs.indexOf(NONE) >= 0 && after.route === 'console-reports', after);
    check('the Notices draft (S().ui.notice) is unchanged', after.notice === noticeMid, { mid: noticeMid.slice(0, 200), after: after.notice.slice(0, 200), start: noticeBefore.slice(0, 80) });
    await shot('16-tell-refused.png', `'Tell investors' on a letter whose only file is withdrawn: '${NONE}' and the Notices draft untouched`, `.rd-run[data-id="${run.id}"]`);
    await screen(check);
  },

  /** Ashwell Ridge: 'Quarterly letter: real estate' for Cedar Row, photos on the asset pages, NOI where the journal has it. */
  async 'ar-letter'({ check }) {
    if (!needs(check)) return;
    const fr = W.fr;
    await firm(AR);
    const r = await newReport('quarterly', RE, 'Q4 2026 Cedar Row letter', AR_FUND, 'fund');
    W.ar.tid = r.id;
    check(`'Start from' offers '${RE}' on Ashwell Ridge`, r.starts.indexOf(RE) >= 0, r.starts);
    const want = await fr.evaluate((fund) => (window.CVPortal.state.ws.offerings.find((o) => o.id === fund).holdings || []).map((h) => ({ id: h.id || '', name: h.name })), AR_FUND);
    const L = await assetRows();
    check(`Asset updates lists Cedar Row's ${want.length} properties, each under '${AR_FUND}-<slug of its name>', and never '${NO_HOLDING}'`, !L.none && want.length > 0 && L.rows.length === want.length && L.rows.every((x, k) => x.id === `${AR_FUND}-${slug(want[k].name)}`), { rows: L.rows, want });
    const buf = W.kb.jpeg || (await jpeg(800, 600));
    const added = [];
    for (const row of L.rows.slice(0, 3)) {
      const ids = await holdingPhoto(row.id, buf, `${slug(row.name)}.jpg`);
      if (ids && ids.length) added.push(row);
    }
    check(`a photo is kept on each of the first ${Math.min(3, L.rows.length)} properties`, added.length === Math.min(3, L.rows.length) && added.length > 0, added.map((x) => x.id));
    W.ar.photos = added.length;
    const noi = await fr.evaluate(({ fund, ids }) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      return ids.map((id) => ({ id, n: NS.reportsData.noi(w, fund, id, '2026-10-01', '2026-12-31') }));
    }, { fund: AR_FUND, ids: L.rows.map((x) => x.id) });
    const withNoi = noi.filter((x) => x.n);
    console.log(`NOI: ${withNoi.length} of ${noi.length} Cedar Row properties have property income or expense lines in the journal for Q4 2026`);
    W.ar.noi = withNoi.length;
    W.ar.noiTotal = noi.length;
    const st = await preview();
    check(`the preview shows the ${added.length} photos, each property's page named`, st.photos === added.length && added.every((x) => st.text.indexOf(x.name) >= 0), { photos: st.photos });
    const noiTables = st.titles.filter((t) => t === 'Net operating income').length;
    check(`the preview has a 'Net operating income' table for each property with journal lines (${withNoi.length})`, noiTables === withNoi.length, { noiTables, withNoi: withNoi.map((x) => x.id) });
    check('no error stands in the preview', st.errors.length === 0, st.errors);
    await shot('17-ar-assets.png', `Ashwell Ridge, '${RE}' for Cedar Row: Asset updates with a photo on ${added.length} properties`, '.rb-sec[data-key=assets]');
    await screen(check);
  },

  /** Ashwell Ridge: the preview's asset pages and the PDF. */
  async 'ar-preview-pdf'({ check }) {
    if (!needs(check) || !W.ar.tid) return check('the Ashwell Ridge report is open', false, 'none');
    const st = await preview();
    check('the preview is ready (no error, See the PDF on)', st.errors.length === 0 && st.pdf === true, st.errors);
    const n = await seePdf();
    check('See the PDF draws the pages inside the panel', n >= 1, n);
    await shot('18-ar-pdf.png', `Ashwell Ridge's Cedar Row letter drawn as a PDF in the page (${n} pages)`, '#rb-pdfpanel');
    await closePdf();
    const P = await downloadPdf('ar-letter.pdf');
    check("'Download PDF' gives a PDF", !!P, P && P.name);
    if (P) {
      const photos = P.images.filter((x) => x.width === 800 && x.height === 600 && x.enc === 'jpeg').length;
      check(`the PDF holds the ${W.ar.photos} photos as JPEG images`, photos === W.ar.photos, P.images);
      const flat = P.text.replace(/\s+/g, ' ');
      const noiN = (flat.match(/Net operating income/g) || []).length;
      check(`the PDF has the 'Net operating income' tables the preview has (${W.ar.noi})`, W.ar.noi === 0 ? noiN === 0 : noiN >= W.ar.noi, noiN);
      const lk = L12.leak(P.text + '\n' + J(P.info));
      check('no vendor, library or model name, never audited or the forbidden word in the PDF text and properties', lk.ok, lk.hits.slice(0, 5));
      console.log(`downloaded: ${P.name}, ${P.bytes.length} bytes, ${P.info.Pages} pages, ${photos} photos`);
    }
    await screen(check);
  },

  /** Pellbrook: 'Quarterly letter: open-ended fund' for pb-long-short: monthly net returns, 'Distributions and redemptions'. */
  async 'pb-letter'({ check }) {
    if (!needs(check)) return;
    await firm(PB);
    const r = await newReport('quarterly', OPEN, 'Q4 2026 Long/Short letter', PB_FUND, 'fund');
    W.pb.tid = r.id;
    check(`'Start from' offers '${OPEN}' on Pellbrook`, r.starts.indexOf(OPEN) >= 0, r.starts);
    const st = await preview();
    const monthly = await W.fr.evaluate(() => {
      const t = Array.from(document.querySelectorAll('#rb-preview table')).find((x) => (x.querySelector('caption') || { innerText: '' }).innerText.trim() === 'Monthly net return');
      return t ? Array.from(t.tBodies[0].rows).map((r) => Array.from(r.cells).map((c) => c.innerText.trim())) : null;
    });
    check("the preview has the table 'Monthly net return' with a row for each month of the quarter", !!monthly && monthly.length >= 3, monthly);
    check("the preview shows 'Distributions and redemptions'", st.text.indexOf('Distributions and redemptions') >= 0, st.titles);
    check('no error stands in the preview', st.errors.length === 0, st.errors);
    W.pb.monthly = monthly;
    console.log(`Pellbrook monthly net return rows: ${J(monthly)}`);
    await shot('19-pb-preview.png', `Pellbrook, '${OPEN}' for its long/short fund: the monthly net returns in the preview`, '#rb-preview table');
    await screen(check);
  },

  /** Pellbrook: the PDF drawn in the page and downloaded. */
  async 'pb-pdf'({ check }) {
    if (!needs(check) || !W.pb.tid) return check('the Pellbrook report is open', false, 'none');
    const n = await seePdf();
    check('See the PDF draws the pages inside the panel', n >= 1, n);
    await shot('20-pb-pdf.png', `Pellbrook's open-ended fund letter drawn as a PDF in the page (${n} pages)`, '#rb-pdfpanel');
    await closePdf();
    const P = await downloadPdf('pb-letter.pdf');
    check("'Download PDF' gives a PDF", !!P, P && P.name);
    if (P) {
      const flat = P.text.replace(/\s+/g, ' ');
      check("the PDF holds 'Monthly net return' and 'Distributions and redemptions'", flat.indexOf('Monthly net return') >= 0 && flat.indexOf('Distributions and redemptions') >= 0, flat.slice(0, 300));
      const months = (W.pb.monthly || []).map((r) => r[1]).filter(Boolean);
      check(`every monthly net return of the preview is in the PDF (${months.join(', ')})`, months.length >= 3 && months.every((m) => flat.indexOf(m) >= 0), months);
      const lk = L12.leak(P.text + '\n' + J(P.info));
      check('no vendor, library or model name, never audited or the forbidden word in the PDF text and properties', lk.ok, lk.hits.slice(0, 5));
    }
    await screen(check);
  },

  /** Pellbrook: Save, Generate for every investor in the fund and Deliver, in the same browser as Kestrel Bay. */
  async 'pb-generate'({ check }) {
    if (!needs(check) || !W.pb.tid) return check('the Pellbrook report is open', false, 'none');
    const v = await save();
    check("'Save' shows version 2", v === 'Version 2', v);
    const hs = await D.holders(W.fr, PB_FUND);
    const g = await generate();
    W.pb.time = timeLine(`Pellbrook, '${OPEN}', ${PB_FUND}, every investor in the fund`, g);
    check(`the run ends 'Made ${hs.length} of ${hs.length}'`, hs.length > 0 && g.text === `Made ${hs.length} of ${hs.length}`, g.text);
    const run = await newestRun();
    W.pb.run = run;
    const d = await deliverRun(run.id, 'Pat Admin');
    check("the run reads 'Delivered by Pat Admin'", d.by === 'Pat Admin' && d.text.indexOf('Delivered by Pat Admin') >= 0, d.text.slice(0, 200));
    await shot('21-pb-deliver.png', `Pellbrook: ${g.text} and delivered by Pat Admin (${g.ms} ms in the page for ${g.files} files)`, `.rd-run[data-id="${run.id}"]`);
    await screen(check);
  },

  /** Two firms in one browser: every report file id carries its firm, none shared; Pellbrook's first holder sees the record's bytes. */
  async 'two-firms'({ check }) {
    if (!needs(check) || !W.pb.run || !W.kb.run) return check('both firms delivered a run', false, { kb: !!W.kb.run, pb: !!W.pb.run });
    const fr = W.fr;
    const ids = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const of = (id) => {
        const w = NS.workspace.load(id);
        return (w.docs || []).filter((d) => d.report).map((d) => d.id);
      };
      return { kb: of('kestrel-bay'), pb: of('pellbrook') };
    });
    check(`every Kestrel Bay report document id starts 'rf-kestrel-bay-' (${ids.kb.length})`, ids.kb.length > 0 && ids.kb.every((x) => /^rf-kestrel-bay-/.test(x)), ids.kb.filter((x) => !/^rf-kestrel-bay-/.test(x)));
    check(`every Pellbrook report document id starts 'rf-pellbrook-' (${ids.pb.length})`, ids.pb.length > 0 && ids.pb.every((x) => /^rf-pellbrook-/.test(x)), ids.pb.filter((x) => !/^rf-pellbrook-/.test(x)));
    check('no report document id is shared by the two firms', !ids.kb.some((x) => ids.pb.indexOf(x) >= 0), ids.kb.filter((x) => ids.pb.indexOf(x) >= 0));
    const first = W.pb.run.files[0];
    const rows = await documentsAs(first.inv[0]);
    check("Pellbrook's first holder's Documents list the report", rows.some((r) => r.id === first.id), rows.slice(0, 5));
    const doc = await fr.evaluate((id) => (window.CVPortal.state.ws.docs.find((d) => d.id === id) || {}).sha256 || '', first.id);
    const v = await viewDoc(first.id);
    check("Pellbrook's first holder sees bytes whose SHA-256 equals doc.sha256, drawn in the page", v.viewed.length === 1 && v.viewed[0] === doc && doc === first.sha256 && v.pages >= 1, { viewed: v.viewed, doc, pages: v.pages });
    await shot('22-pb-investor.png', `As ${first.inv[0]}, Pellbrook's first holder: the report opened, byte-identical to the record, in the same browser as Kestrel Bay`);
    await screen(check, { dialog: true });
    await closeDialog();
  },

  /** Back in Kestrel Bay: its first holder still sees Kestrel Bay's bytes, after Pellbrook generated in the same browser. */
  async 'two-firms-kb'({ check }) {
    if (!needs(check) || !W.kb.run || !W.pb.run) return check('both runs', false, 'none');
    await firm(KB);
    const first = W.kb.run.files[0];
    const rows = await documentsAs(first.inv[0]);
    check("Kestrel Bay's first holder's Documents list the report", rows.some((r) => r.id === first.id), rows.slice(0, 5));
    const doc = await W.fr.evaluate((id) => (window.CVPortal.state.ws.docs.find((d) => d.id === id) || {}).sha256 || '', first.id);
    const v = await viewDoc(first.id);
    check("Kestrel Bay's first holder sees bytes whose SHA-256 equals doc.sha256 (never Pellbrook's)", v.viewed.length === 1 && v.viewed[0] === doc && doc === first.sha256 && v.pages >= 1 && !W.pb.run.files.some((f) => f.sha256 === v.viewed[0]), { viewed: v.viewed, doc, pages: v.pages });
    await shot('23-kb-investor-again.png', `As ${first.inv[0]} of Kestrel Bay, after Pellbrook generated in the same browser: still Kestrel Bay's own file`);
    await screen(check, { dialog: true });
    await closeDialog();
  },

  /** Test setup only: one Kestrel Bay kept file overwritten with Pellbrook's bytes. Those bytes are never shown; the file is remade to the record. */
  async 'hash-check'({ check }) {
    if (!needs(check) || !W.kb.run || !W.pb.run) return check('both runs', false, 'none');
    const fr = W.fr;
    const target = W.kb.run.files[1];
    const theirs = W.pb.run.files[0];
    const planted = await fr.evaluate(async ({ id, from }) => {
      const NS = window.CVPortal;
      const b = await NS.ops.files.get(from);
      const bytes = new Uint8Array(await b.arrayBuffer());
      await NS.ops.files.put(id, new Blob([bytes], { type: 'application/pdf' }));
      const k = await NS.ops.files.get(id);
      return NS.audit.sha256(new Uint8Array(await k.arrayBuffer()));
    }, { id: target.id, from: theirs.id });
    check("test setup: the kept file of a Kestrel Bay holder now holds Pellbrook's bytes", planted === theirs.sha256 && planted !== target.sha256, { planted, theirs: theirs.sha256, record: target.sha256 });
    await documentsAs(target.inv[0]);
    const v = await viewDoc(target.id);
    check("opening it never shows Pellbrook's bytes", v.viewed.indexOf(theirs.sha256) < 0, v.viewed);
    check('opening it shows the file remade, its SHA-256 equal to the record, drawn in the page', v.viewed.length === 1 && v.viewed[0] === target.sha256 && v.pages >= 1, { viewed: v.viewed, record: target.sha256, pages: v.pages, text: v.text.slice(0, 160) });
    W.kb.planted = { target, theirs };
    await shot('24-hash-remade.png', `As ${target.inv[0]}: the kept file had been overwritten with another firm's bytes (test setup); the portal shows the file remade, equal to the record`);
    await screen(check, { dialog: true });
    await closeDialog();
    const kept = await fr.evaluate(async (id) => {
      const x = await window.CVPortal.ops.files.get(id);
      return x ? window.CVPortal.audit.sha256(new Uint8Array(await x.arrayBuffer())) : '';
    }, target.id);
    check('opening it writes nothing over the kept bytes', kept === theirs.sha256, kept);
  },

  /** The same file where the remake is not loaded on the page: the not-kept sentence, never the bytes. */
  async 'hash-not-kept'({ check }) {
    if (!needs(check) || !W.kb.planted) return check('the planted file of the step before', false, 'none');
    const { target, theirs } = W.kb.planted;
    await W.fr.evaluate(() => {
      window.__run = window.CVPortal.reportsRun;
      delete window.CVPortal.reportsRun;
    });
    const v = await viewDoc(target.id);
    check(`without the remake on the page, the viewer says '${NOT_KEPT}' and shows no bytes`, !v.viewed.length && !v.pages && v.text === NOT_KEPT, { viewed: v.viewed, text: v.text.slice(0, 200) });
    check("Pellbrook's bytes are never shown", v.viewed.indexOf(theirs.sha256) < 0, v.viewed);
    await shot('25-hash-not-kept.png', `The same file where the remake cannot run: '${NOT_KEPT}' and nothing else`);
    await screen(check, { dialog: true });
    await closeDialog();
    await W.fr.evaluate(() => {
      window.CVPortal.reportsRun = window.__run;
      delete window.__run;
    });
  },

  /** Fund A seated as its own firm: 'Capital account statement' for FA-1001, Q4 2026: the hand-worked figures in the preview. */
  async 'fa-statement'({ check }) {
    if (!needs(check)) return;
    const fr = W.fr;
    await role('admin');
    const id = await seatFundA();
    const t = await fr.evaluate(() => ({ id: window.CVPortal.state.ws.tenant.id, sample: !!window.CVPortal.state.ws.tenant.sample, name: window.CVPortal.state.ws.tenant.legalName }));
    check("fund A is seated as its own firm with no sample flag ('Fund A Sponsor Management, LLC')", t.id === id && !t.sample && t.name === 'Fund A Sponsor Management, LLC', t);
    const r = await newReport('statement', 'Capital account statement', 'Q4 2026 statement', 'fund-a', 'fund', 'q');
    W.fa.tid = r.id;
    if (await fr.locator('#rb-as').count()) {
      await fr.selectOption('#rb-as', 'FA-1001');
      await fr.waitForTimeout(250);
    }
    const spec = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const o = w.offerings.find((x) => x.id === 'fund-a');
      const q = NS.audit.presets(w, o).find((p) => p.id === 'q');
      return { from: q.from, to: q.to, preset: (document.querySelector('#rb-period') || { value: '' }).value, as: (document.querySelector('#rb-as') || { value: '' }).value };
    });
    check('the period is 2026-10-01 to 2026-12-31 and the preview is for FA-1001', spec.from === '2026-10-01' && spec.to === '2026-12-31' && spec.preset === 'q' && spec.as === 'FA-1001', spec);
    const st = await preview();
    const want = ['$334,000.00', `${MINUS}$6,000.00`, '$20,000.00', `${MINUS}$3,000.00`, '$345,000.00', 'Preliminary: the books are not closed for this period.'];
    const missing = want.filter((x) => st.text.indexOf(x) < 0);
    check(`the preview shows ${want.join(', ')}`, missing.length === 0, { missing, text: st.text.slice(0, 600) });
    check('the preview is prepared for Investor One and names no other investor', st.text.indexOf('Prepared for Investor One') >= 0 && st.text.indexOf('Investor Two') < 0, st.text.slice(0, 300));
    W.fa.want = want;
    await shot('26-fa-statement.png', "Fund A (a real fund, hand-worked figures), 'Capital account statement' for FA-1001, Q4 2026: beginning $334,000.00, distributions −$6,000.00, gain $20,000.00, fees −$3,000.00, ending $345,000.00", '#rb-preview table');
    await screen(check);
  },

  /** Fund A: the same statement as a PDF, drawn and downloaded. */
  async 'fa-pdf'({ check }) {
    if (!needs(check) || !W.fa.tid) return check('the fund A statement is open', false, 'none');
    const n = await seePdf();
    check('See the PDF draws the pages inside the panel', n >= 1, n);
    await shot('27-fa-pdf.png', `Fund A's statement for FA-1001 drawn as a PDF in the page (${n} pages)`, '#rb-pdfpanel');
    await closePdf();
    const P = await downloadPdf('fa-statement.pdf');
    check("'Download PDF' gives a PDF", !!P, P && P.name);
    if (P) {
      const flat = P.text.replace(/\s+/g, ' ');
      const missing = W.fa.want.filter((x) => flat.indexOf(x) < 0);
      check(`the PDF shows ${W.fa.want.join(', ')}`, missing.length === 0, missing);
      check("Producer and Creator are 'Fund A Sponsor Management, LLC'", P.info.Producer === 'Fund A Sponsor Management, LLC' && P.info.Creator === 'Fund A Sponsor Management, LLC', { Producer: P.info.Producer, Creator: P.info.Creator });
      const lk = L12.leak(P.text + '\n' + J(P.info));
      check('no vendor, library or model name, never audited or the forbidden word in the PDF text and properties', lk.ok, lk.hits.slice(0, 5));
    }
    await screen(check);
  },

  /** Fund A: 'Performance and holdings summary' for 2026: the engine's holdings equal the journal's Portfolio Co X. */
  async 'fa-holdings'({ check }) {
    if (!needs(check)) return;
    const fr = W.fr;
    await newReport('performance', 'Performance and holdings summary', '2026 summary', 'fund-a', 'fund', 'fy');
    if (await fr.locator('#rb-as').count()) {
      await fr.selectOption('#rb-as', 'FA-1001');
      await fr.waitForTimeout(250);
    }
    const per = await fr.evaluate(() => (document.querySelector('#rb-period') ? document.querySelector('#rb-period').selectedOptions[0].innerText.trim() : ''));
    check(`the period is the year 2026 ('${per}')`, /2026/.test(per), per);
    const eng = await engineHoldings('fund-a', '2026-12-31');
    const journal = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const lines = NS.books.entries(NS.state.ws, 'fund-a', { from: '2026-01-01', to: '2026-12-31', holding: 'fa-x' });
      const sum = (code) => lines.filter((l) => l.code === code).reduce((s, l) => s + l.cents, 0);
      return { cost: sum('1100'), fv: sum('1100') + sum('1150') };
    });
    console.log(`fund A holdings: engine ${J(eng)}; journal Portfolio Co X fair value ${journal.fv}, cost ${journal.cost} (cents)`);
    check('the journal holds Portfolio Co X at $490,000.00, cost $400,000.00', journal.fv === 49000000 && journal.cost === 40000000, journal);
    check("the engine's holdings equal the journal: Portfolio Co X $490,000.00 at cost $400,000.00", !!eng && eng.length === 1 && eng[0].name === 'Portfolio Co X' && eng[0].fv === 49000000 && eng[0].cost === 40000000, eng);
    const st = await preview();
    const row = await fr.evaluate(() => {
      const t = Array.from(document.querySelectorAll('#rb-preview table')).find((x) => (x.querySelector('caption') || { innerText: '' }).innerText.trim() === 'Holdings');
      return t ? Array.from(t.tBodies[0].rows).map((r) => Array.from(r.cells).map((c) => c.innerText.trim())) : null;
    });
    check("the preview's Holdings table shows Portfolio Co X at $490,000.00, cost $400,000.00", !!row && row.length === 1 && row[0][0] === 'Portfolio Co X' && row[0].indexOf('$490,000.00') >= 0 && row[0].indexOf('$400,000.00') >= 0, row);
    check('no error stands in the preview', st.errors.length === 0, st.errors);
    W.fa.holdings = { eng, journal, row };
    await shot('28-fa-holdings.png', "Fund A, 'Performance and holdings summary' for 2026: Holdings shows Portfolio Co X at $490,000.00, cost $400,000.00, as the journal holds it", '#rb-preview table');
    await screen(check);
  }
};

/** Each step knows its name, and counts errors and outside requests from its own start. */
const walk = {};
Object.keys(steps).forEach((k) => {
  walk[k] = (ctx) => {
    W.step = k;
    W.offAt = W.off.length;
    W.err0 = W.A ? W.A.errors.length : 0;
    return steps[k](ctx);
  };
});

if (require.main === module) {
  Lib.runParts(walk, { name: 'WALK12', unit: 'steps', flag: '--only', browser: true });
}
module.exports = { steps };
