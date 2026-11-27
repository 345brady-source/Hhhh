// gate: browser
// last "PACKAGE FLOW: PASS (parts run: 6)"
// The year-end package's button and its in-page sheets (plan 11-16, D-02, C-04, FA-09..FA-13), in the owner's
// conditions: the portal inside a sandboxed frame whose policy refuses every connection and allows scripts from the
// portal's own address only (both outside hosts refused), the clock on 2027-01-20. Fund A (fixtures/fund-a.js) is seated
// in the Kestrel Bay sample as a fund that is not seeded (as books-flow.js seats it), with its investors' tax facts as
// package.js writes them; the sample's own kb-fund-ii is used as it is.
//   button-phone    390x844 with touch: Audit, fund A: the 'Year-end package' panel with its one line, Year 2026, the
//                   tick, the button and the sheets; 'Download year-end package' gives one download whose bytes are a zip
//                   holding README, workbook, PDF, one CSV per sheet and the manifest; withholding.js, filesout.js, the
//                   PDF writer and the font came from the page's own address; nothing was refused
//   button-desktop  1280x800: FA-1001's signed W-9 stored through the page (a stand-in carrying the never-issued number
//                   000-65-1234 / 000651234); with the tick the zip holds forms/FA-1001_W-9.pdf, byte for byte, and no
//                   other file of the zip, no text on the page and nothing stored outside the file store holds the number;
//                   the change log's last entry is 'Year-end package exported'
//   view            'View' on 'Investor tax details' draws two rows ending 1234 and 9876; 'View' on 'Balance sheet in
//                   Schedule L order' shows line 22 at $522,000.00; a way out stays on screen
//   sample-phone    kb-fund-ii, 2025, at 390x844: the panel lists the package's sheets and the download is a zip
//   roles           a team member sees no panel; an investor opening #console-audit gets the investor's own page
//   managed         index.html at 1280x800 as staff: the Audit page's heading; no 'Year-end package' panel; no error;
//                   index.html names no file of this plan and is unchanged (against the base tree P11_ROOT when given)
// Every part: the frame refuses a fetch; quiet, leak and a way out on screen.
//   NODE_PATH=$(npm root -g) node package-flow.js [--only part1,part2]
// The last line is "PACKAGE FLOW: PASS (parts run: N)" or "PACKAGE FLOW: FAIL (parts run: N) - <parts>".
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const T = require('../../10-investor-tax-documents-and-withholding/checks/lib10.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, `package-flow-${process.pid}`);
fs.mkdirSync(OUT, { recursive: true });
process.on('exit', () => fs.rmSync(OUT, { recursive: true, force: true }));
const FA = require('./fixtures/fund-a.js');
const CLOCK = '2027-01-20';
const J = (x) => JSON.parse(JSON.stringify(x));
const S_ = (x) => JSON.stringify(x);
const TINS = ['000-65-1234', '000651234'];
// The files the download needs, which must come from the page's own address (C-02).
const LIBS = /\/assets\/(js\/withholding\.js|js\/filesout\.js|vendor\/pdfwrite\/write\.js|vendor\/pdfwrite\/fonts\.js|vendor\/textfont\/text-regular\.js)$/;

Lib.describeShots([
  [/button-phone-panel/, 'Audit on a phone: the Year-end package panel for Fund A, 2026, with its sheets.'],
  [/button-desktop/, 'Audit at desktop width: the Year-end package panel with signed forms ticked, after the download.'],
  [/view-tax/, 'Audit on a phone: Investor tax details viewed in the page (last four digits only).'],
  [/view-bs/, 'Audit on a phone: Balance sheet in Schedule L order viewed in the page.'],
  [/sample-phone/, 'Audit on a phone: the Year-end package panel for Kestrel Bay Fund II, 2025.']
]);

/* ---------- the frame ---------- */
async function open(S, size, opts) {
  opts = opts || {};
  const { A, fr } = await T.framed(S, size, { policy: 'self', clock: CLOCK, page: opts.page || 'diy.html' });
  A.libs = [];
  A.context.on('request', (r) => {
    const u = r.url();
    let p = '';
    try {
      p = new URL(u).pathname;
    } catch (e) {
      p = u;
    }
    if (LIBS.test(p)) A.libs.push(u);
  });
  await T.proveRefused(opts.check, A, fr);
  return { A, fr };
}
async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 30000 });
  await fr.waitForTimeout(300);
}
async function shot(A, name, fr, sel) {
  if (fr && sel) {
    await fr.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) return;
      e.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -90);
    }, sel);
    await fr.waitForTimeout(300);
  }
  await A.page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

/* ---------- seating fund A (as books-flow.js does), with the tax facts of package.js ---------- */
const MARKS_A = [
  { id: 'fa-m1', holding: 'fa-x', date: '2026-09-30', fvCents: 46000000, doc: 'Q3 statement' },
  { id: 'fa-m2', holding: 'fa-x', date: '2026-12-31', fvCents: 49000000, doc: 'Year-end statement' }
];
function seatA(fr) {
  return T.ws(
    fr,
    (w, a, NS) => {
      const tmpl = w.investors.find((i) => i.onboarding && i.onboarding.status === 'complete' && i.positions.length);
      a.records.investors.forEach((src) => {
        const inv = JSON.parse(JSON.stringify(tmpl));
        ['taxCert', 'taxW8', 'taxForm', 'taxDelivery', 'coInvestor', 'taxType', 'tinLast4'].forEach((k) => delete inv[k]);
        Object.assign(inv, { id: src.id, contact: src.contact, title: src.title, type: src.type, email: src.email, payment: src.payment, positions: src.positions });
        w.investors.push(inv);
      });
      a.records.offerings.forEach((o) => w.offerings.push(o));
      w.calls = (w.calls || []).concat(a.records.calls);
      w.runs = (w.runs || []).concat(a.records.runs);
      if (!w.books || typeof w.books !== 'object') w.books = { v: 1, funds: {} };
      if (!w.books.funds) w.books.funds = {};
      Object.assign(w.books.funds, a.records.books.funds);
      const oid = a.records.offerings[0].id;
      const by = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
      (a.entries || []).forEach((e) => NS.books.post(w, oid, e, by));
      (a.marks || []).forEach((m) => w.books.funds[oid].marks.push(Object.assign({ at: by.at, by: by.by }, m)));
      // the investors' tax facts (made up, the shape onboarding.js stores; package.js writes the same)
      const one = w.investors.find((i) => i.id === 'FA-1001');
      Object.assign(one, { type: 'individual', taxForm: 'W-9', tinLast4: '1234', address: '1 Example Street, Springfield IL 62701' });
      one.taxCert = { form: 'W-9', revision: 'March 2024', envelopeId: 'env-fa-1001-w9', at: '2026-01-08T15:00:00.000Z', signed: true, signedBy: 'Investor One', tinLast4: '1234', backupWithholding: false };
      const two = w.investors.find((i) => i.id === 'FA-1002');
      Object.assign(two, { type: 'entity', taxType: 'foreign-entity', taxForm: 'W-8BEN-E', address: '2 Sample Road, London' });
      two.taxCert = { form: 'W-8BEN-E', revision: 'October 2021', envelopeId: 'env-fa-1002-w8', at: '2026-01-09T15:00:00.000Z', signed: true, signedBy: 'Investor Two', chapter3: 'Corporation', chapter4: '', country: 'United Kingdom', ftinLast4: '9876', noFtin: false, validUntil: '2029-12-31' };
      return { oid, journal: w.books.funds[oid].journal.length };
    },
    { records: J(FA.records), entries: J(FA.entries || []), marks: MARKS_A }
  );
}

/* ---------- the panel ---------- */
/** The Audit page with a fund chosen, and its Year-end package panel ready (its sheets listed). */
async function audit(fr, oid) {
  await go(fr, 'console-audit', '#aud-offering');
  if ((await fr.evaluate(() => document.getElementById('aud-offering').value)) !== oid) {
    await fr.selectOption('#aud-offering', oid);
    await fr.waitForTimeout(500);
  }
  await fr.waitForSelector(`#ye-panel[data-fund="${oid}"] [data-action=ye-dl]`, { timeout: 60000 }).catch(() => {});
  await fr.waitForTimeout(300);
}
function panel(fr) {
  return fr.evaluate(() => {
    const p = document.getElementById('ye-panel');
    if (!p) return null;
    const t = (el) => (el ? el.innerText.trim() : '');
    const y = document.getElementById('ye-year');
    const tick = document.getElementById('ye-forms');
    return {
      fund: p.getAttribute('data-fund'),
      title: t(p.querySelector('h2')),
      line: t(p.querySelector('.ye-line')),
      years: y ? Array.from(y.options).map((o) => o.value) : [],
      year: y ? y.value : '',
      tick: tick ? { checked: tick.checked, label: t(tick.closest('label')) } : null,
      button: t(p.querySelector('[data-action=ye-dl]')),
      sheets: Array.from(p.querySelectorAll('.ye-sheet')).map((r) => ({ k: r.getAttribute('data-k'), title: t(r.querySelector('.ye-title')), view: t(r.querySelector('[data-action=ye-view]')) })),
      text: p.innerText
    };
  });
}
/** The package's sheet titles as the page's own NS.books.package builds them. */
const titlesOf = (fr, oid, year) => fr.evaluate(({ oid, year }) => {
  const NS = window.CVPortal;
  const w = NS.state.ws;
  return NS.books.package(w, w.offerings.find((o) => o.id === oid), year).sheets.map((s) => s.title);
}, { oid, year });
const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
const filesWanted = (stem, titles, forms) => ['00_README.txt', `${stem}_year_end.xlsx`, `${stem}_year_end.pdf`].concat(titles.map((t, k) => `csv/${String(k + 1).padStart(2, '0')}_${slug(t)}.csv`)).concat(forms || []).concat(['MANIFEST.sha256']);

/** Press the download button; the file is saved, unzipped with Python's zipfile and deleted. { name, names, read, size } or null. */
async function download(A, fr) {
  const [dl] = await Promise.all([A.page.waitForEvent('download', { timeout: 180000 }).catch(() => null), T.press(fr, '[data-action=ye-dl]')]);
  if (!dl) return null;
  const dir = path.join(OUT, `dl-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'package.zip');
  await dl.saveAs(file);
  await dl.delete().catch(() => {});
  const bytes = fs.readFileSync(file);
  const x = path.join(dir, 'x');
  const r = spawnSync('python3', ['-I', '-c', 'import json,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nbad=z.testzip()\nif bad: raise SystemExit("bad "+bad)\nz.extractall(sys.argv[2])\nprint(json.dumps(z.namelist()))', file, x], { encoding: 'utf8' });
  const names = r.status === 0 ? JSON.parse(r.stdout) : null;
  const read = (n) => fs.readFileSync(path.join(x, n));
  const all = names ? names.map((n) => ({ n, b: read(n) })) : [];
  fs.rmSync(dir, { recursive: true, force: true });
  return { name: dl.suggestedFilename(), names, size: bytes.length, zip: bytes.slice(0, 4).toString('latin1'), get: (n) => (all.find((e) => e.n === n) || {}).b || null, all, err: r.status === 0 ? '' : r.stderr };
}
const lastLog = (fr) => fr.evaluate(() => {
  const l = window.CVPortal.audit.ensureLog(window.CVPortal.state.ws);
  return l.length ? { action: l[l.length - 1].action, fund: l[l.length - 1].fund, record: l[l.length - 1].record, detail: l[l.length - 1].detail } : null;
});
async function ends(check, A, fr) {
  const sx = await fr.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check('no horizontal page scroll', sx <= 0, sx);
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
}
const LINE = /^Everything the fund[’']s CPA needs for the return, as a workbook and a PDF\.$/;

const parts = {
  async 'button-phone'({ check, S }) {
    const { A, fr } = await open(S, 'phone', { check });
    await T.sample(fr, { role: 'admin' });
    await seatA(fr);
    await audit(fr, 'fund-a');
    const p = await panel(fr);
    check("the Audit page for fund A has the 'Year-end package' panel with its one line", !!p && p.fund === 'fund-a' && p.title === 'Year-end package' && LINE.test(p.line), p && { title: p.title, line: p.line });
    check('Year: the years with entries, newest first, 2026 chosen', !!p && p.year === '2026' && p.years.indexOf('2026') >= 0 && S_(p.years) === S_(p.years.slice().sort().reverse()), p && { years: p.years, year: p.year });
    check("the tick 'Include signed W-9 and W-8 forms', off; the button 'Download year-end package'", !!p && !!p.tick && !p.tick.checked && p.tick.label === 'Include signed W-9 and W-8 forms' && p.button === 'Download year-end package', p && { tick: p.tick, button: p.button });
    const titles = await titlesOf(fr, 'fund-a', 2026);
    check(`the panel lists the package's ${titles.length} sheets, each with 'View'`, !!p && S_(p.sheets.map((x) => x.title)) === S_(titles) && p.sheets.every((x) => x.view === 'View'), p && p.sheets.map((x) => x.title));
    await shot(A, 'button-phone-panel', fr, '#ye-panel');
    const D = await download(A, fr);
    check('one download, named Kestrel Bay\'s and fund A\'s year-end package for 2026', !!D && /_Fund_A_2026_year_end_package\.zip$/.test(D.name), D && D.name);
    const stem = D ? D.name.replace(/_year_end_package\.zip$/, '') : '';
    check(`its bytes are a zip holding 4 + ${titles.length} files: README, workbook, PDF, one CSV per sheet, manifest`, !!D && D.zip === 'PK\u0003\u0004' && !!D.names && S_(D.names) === S_(filesWanted(stem, titles)), D && { names: D.names, err: D.err });
    check('the workbook and the PDF in it are not empty; no forms/ entry', !!D && !!D.get(`${stem}_year_end.xlsx`) && D.get(`${stem}_year_end.pdf`).slice(0, 5).toString('latin1') === '%PDF-' && !D.names.some((n) => /^forms\//.test(n)), D && D.names);
    const libs = A.libs.slice();
    const need = ['js/withholding.js', 'js/filesout.js', 'vendor/pdfwrite/write.js', 'vendor/pdfwrite/fonts.js', 'vendor/textfont/text-regular.js'];
    check("withholding.js, filesout.js, the PDF writer, its font embedder and the font came from the page's own address", need.every((n) => libs.some((u) => u === `${S.origin}/assets/${n}`)) && libs.every((u) => u.indexOf(S.origin + '/') === 0), libs);
    const cspv = await fr.evaluate(() => (window.__cspv || []).slice());
    check('the policy refused nothing while the package was written', cspv.length === 0, cspv);
    const last = await lastLog(fr);
    check("the change log's last entry is 'Year-end package exported' with the zip's name", !!last && last.action === 'Year-end package exported' && !!D && last.record === D.name, last);
    await ends(check, A, fr);
    await A.context.close();
  },

  async 'button-desktop'({ check, S }) {
    const { A, fr } = await open(S, 'desktop', { check });
    await T.sample(fr, { role: 'admin' });
    await seatA(fr);
    // FA-1001's signed W-9: a completed tax envelope and its signed copy stored in the page's own file store
    const stored = await fr.evaluate(async () => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      w.envelopes = (w.envelopes || []).concat([{ id: 'env-fa-1001-w9', kind: 'tax', status: 'completed', signedDocId: 'env-fa-1001-w9-signed', signers: [{ investorId: 'FA-1001', name: 'Investor One' }] }]);
      NS.app.save(true);
      const text = '%PDF-1.4\n% Stand-in signed W-9 for FA-1001 (check fixture)\n(Taxpayer identification number: 000-65-1234) (000651234)\n%%EOF\n';
      await NS.ops.files.put('env-fa-1001-w9-signed', new Blob([new TextEncoder().encode(text)], { type: 'application/pdf' }));
      const back = await NS.ops.files.get('env-fa-1001-w9-signed');
      return back ? Array.from(new Uint8Array(await back.arrayBuffer())) : null;
    });
    check('the stand-in signed W-9 is in the page\'s file store', Array.isArray(stored) && stored.length > 40, stored && stored.length);
    const B = Buffer.from(stored || []);
    await audit(fr, 'fund-a');
    await fr.check('#ye-forms').catch(() => {});
    await fr.waitForTimeout(400);
    const p = await panel(fr);
    check('the tick is on', !!p && !!p.tick && p.tick.checked, p && p.tick);
    const titles = await titlesOf(fr, 'fund-a', 2026);
    const D = await download(A, fr);
    const stem = D ? D.name.replace(/_year_end_package\.zip$/, '') : '';
    check(`with the tick the zip holds 5 + ${titles.length} files, forms/FA-1001_W-9.pdf before the manifest`, !!D && !!D.names && S_(D.names) === S_(filesWanted(stem, titles, ['forms/FA-1001_W-9.pdf'])), D && D.names);
    check('forms/FA-1001_W-9.pdf is byte for byte the stored signed copy', !!D && !!D.get('forms/FA-1001_W-9.pdf') && Buffer.compare(D.get('forms/FA-1001_W-9.pdf'), B) === 0, D && D.get('forms/FA-1001_W-9.pdf') && D.get('forms/FA-1001_W-9.pdf').length);
    const holds = (buf) => TINS.filter((t) => buf.indexOf(Buffer.from(t, 'latin1')) >= 0);
    const others = D ? D.all.filter((e) => e.n !== 'forms/FA-1001_W-9.pdf' && holds(e.b).length).map((e) => e.n) : ['no download'];
    check('no other file of the zip holds 000-65-1234 or 000651234', others.length === 0, others);
    const readme = D && D.get('00_README.txt') ? D.get('00_README.txt').toString('utf8') : '';
    check("the README says 'Signed tax forms included: Yes' and names FA-1002's form as not on this device", /Signed tax forms included: Yes\r\n/.test(readme) && /Signed form not on this device: FA-1002 W-8BEN-E/.test(readme), readme.slice(0, 600));
    const last = await lastLog(fr);
    check("the change log's last entry is 'Year-end package exported', signed forms included", !!last && last.action === 'Year-end package exported' && /signed tax forms included \(1\)/.test(last.detail) && /SHA-256 [0-9a-f]{64}$/.test(last.detail), last);
    const page = await fr.evaluate(() => {
      const ls = [];
      for (let k = 0; k < localStorage.length; k++) ls.push(localStorage.getItem(localStorage.key(k)) || '');
      return { text: document.body.innerText, html: document.documentElement.outerHTML, ws: JSON.stringify(window.CVPortal.state.ws), ls: ls.join('\n') };
    });
    const where = ['text', 'html', 'ws', 'ls'].filter((k) => holds(Buffer.from(page[k], 'utf8')).length);
    check('neither number is in the page\'s text or markup, the workspace or anything stored outside the file store', where.length === 0, where);
    await shot(A, 'button-desktop', fr, '#ye-panel');
    await ends(check, A, fr);
    await A.context.close();
  },

  async view({ check, S }) {
    const { A, fr } = await open(S, 'phone', { check });
    await T.sample(fr, { role: 'admin' });
    await seatA(fr);
    await audit(fr, 'fund-a');
    const viewOf = async (title) => {
      const k = await fr.evaluate((t) => {
        const r = Array.from(document.querySelectorAll('#ye-panel .ye-sheet')).find((x) => (x.querySelector('.ye-title') || {}).innerText === t);
        return r ? r.getAttribute('data-k') : null;
      }, title);
      if (k == null) return null;
      await T.press(fr, `#ye-panel .ye-sheet[data-k="${k}"] [data-action=ye-view]`);
      await fr.waitForSelector(`#ye-view[data-k="${k}"] table`, { timeout: 30000 }).catch(() => {});
      await fr.waitForTimeout(300);
      return fr.evaluate(() => {
        const v = document.getElementById('ye-view');
        if (!v) return null;
        const head = Array.from(v.querySelectorAll('thead th')).map((th) => th.innerText.trim());
        const rows = Array.from(v.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.children).map((td) => td.innerText.trim()));
        return { k: v.getAttribute('data-k'), title: (v.querySelector('h3') || { innerText: '' }).innerText.trim(), head, rows };
      });
    };
    const tax = await viewOf('Investor tax details');
    const ti = tax ? tax.head.indexOf('Taxpayer number ending') : -1;
    const fi = tax ? tax.head.indexOf('Foreign taxpayer number ending') : -1;
    check("'View' on 'Investor tax details' draws two rows: FA-1001 ending 1234, FA-1002 ending 9876", !!tax && tax.title === 'Investor tax details' && tax.rows.length === 2 && tax.rows[0][0] === 'FA-1001' && tax.rows[0][ti] === '1234' && tax.rows[1][0] === 'FA-1002' && tax.rows[1][fi] === '9876', tax);
    await shot(A, 'view-tax', fr, '#ye-view');
    await T.wayOut(check, fr);
    const bs = await viewOf('Balance sheet in Schedule L order');
    const l22 = bs ? bs.rows.find((r) => r[0] === '22') : null;
    check("'View' on 'Balance sheet in Schedule L order' shows line 22 at $522,000.00 at the end of the year", !!bs && bs.title === 'Balance sheet in Schedule L order' && !!l22 && l22[3] === '$522,000.00', { title: bs && bs.title, l22 });
    const gl = await viewOf('General ledger');
    const more = await fr.evaluate(() => (document.querySelector('#ye-view .cs-hint') || { innerText: '' }).innerText.trim());
    check("'View' on 'General ledger' (48 lines) shows 48 rows, or 60 with 'The file has every row.' when longer", !!gl && (gl.rows.length === 48 || (gl.rows.length === 60 && /The file has every row\./.test(more))), { rows: gl && gl.rows.length, more });
    await shot(A, 'view-bs', fr, '#ye-view');
    await ends(check, A, fr);
    await A.context.close();
  },

  async 'sample-phone'({ check, S }) {
    const { A, fr } = await open(S, 'phone', { check });
    await T.sample(fr, { role: 'admin' });
    await audit(fr, 'kb-fund-ii');
    let p = await panel(fr);
    check('kb-fund-ii has the panel, with 2025 among its years', !!p && p.fund === 'kb-fund-ii' && p.years.indexOf('2025') >= 0, p && { fund: p.fund, years: p.years });
    if (p && p.year !== '2025') {
      await fr.selectOption('#ye-year', '2025');
      await fr.waitForSelector('#ye-panel [data-action=ye-dl]', { timeout: 60000 }).catch(() => {});
      await fr.waitForTimeout(500);
      p = await panel(fr);
    }
    const titles = await titlesOf(fr, 'kb-fund-ii', 2025);
    check(`Year 2025: the panel lists the package's ${titles.length} sheets`, !!p && p.year === '2025' && S_(p.sheets.map((x) => x.title)) === S_(titles), p && { year: p.year, sheets: p.sheets.map((x) => x.title) });
    await shot(A, 'sample-phone', fr, '#ye-panel');
    const D = await download(A, fr);
    const stem = D ? D.name.replace(/_year_end_package\.zip$/, '') : '';
    check('the download is a zip of the 2025 package', !!D && /_2025_year_end_package\.zip$/.test(D.name) && D.zip === 'PK\u0003\u0004' && !!D.names && S_(D.names) === S_(filesWanted(stem, titles)), D && { name: D.name, names: D.names, err: D.err });
    await ends(check, A, fr);
    await A.context.close();
  },

  async roles({ check, S }) {
    const { A, fr } = await open(S, 'desktop', { check });
    await T.sample(fr, { role: 'admin' });
    await seatA(fr);
    await T.sample(fr, { role: 'team' });
    await go(fr, 'console-audit', '#aud-offering');
    await fr.waitForTimeout(1500);
    const seen = await fr.evaluate(() => ({ panel: !!document.getElementById('ye-panel'), text: /Year-end package/.test(document.getElementById('view').innerText), audit: !!document.querySelector('[data-action=aud-zip]') }));
    check('a team member sees the Audit page and no Year-end package panel', seen.audit && !seen.panel && !seen.text, seen);
    await ends(check, A, fr);
    await T.sample(fr, { role: 'investor' });
    await fr.evaluate(() => (location.hash = '#console-audit'));
    await fr.waitForTimeout(1500);
    const at = await fr.evaluate(() => ({ route: window.CVPortal.state.route, panel: !!document.getElementById('ye-panel'), console: !!document.querySelector('.cs-nav') }));
    check("an investor opening #console-audit gets the investor's own page, with no panel", at.route !== 'console-audit' && !at.panel && !at.console, at);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  async managed({ check, S }) {
    const { A, fr } = await open(S, 'desktop', { check, page: 'index.html' });
    const src = fs.readFileSync(path.join(Lib.ROOT, 'index.html'), 'utf8');
    check("index.html names no file of this plan (books-pkg.js, filesout.js)", !/books-pkg|filesout/.test(src), (src.match(/[^"]*(books-pkg|filesout)[^"]*/) || [''])[0]);
    if (process.env.P11_ROOT) {
      const base = fs.readFileSync(path.join(process.env.P11_ROOT, 'index.html'), 'utf8');
      check("index.html is byte for byte the base tree's", base === src, { base: base.length, now: src.length });
    }
    const g = spawnSync('git', ['status', '--porcelain', '--', 'index.html'], { cwd: Lib.ROOT, encoding: 'utf8' });
    check('git shows no uncommitted change to index.html', g.status === 0 && g.stdout.trim() === '', g.stdout);
    await T.sample(fr, { role: 'staff' });
    await go(fr, 'console-audit', '.cs-main h1');
    await fr.waitForTimeout(1200);
    const at = await fr.evaluate(() => ({ edition: window.CVPortal.EDITION.id, route: window.CVPortal.state.route, h1: (document.querySelector('.cs-main h1') || { innerText: '' }).innerText.trim(), visible: (() => { const h = document.querySelector('.cs-main h1'); if (!h) return false; const r = h.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; })(), panel: !!document.getElementById('ye-panel'), text: /Year-end package/.test(document.getElementById('view').innerText), err: !!document.querySelector('#view .cs-error, #view .is-stop') }));
    check("the managed Audit page's heading 'Audit' is visible", at.edition === 'managed' && at.route === 'console-audit' && at.h1 === 'Audit' && at.visible, at);
    check("no 'Year-end package' panel and no error on it", !at.panel && !at.text && !at.err, at);
    const files = await fr.evaluate(() => Array.from(document.scripts).map((s) => s.src).filter((u) => /books-pkg|filesout/.test(u)));
    check("none of this plan's files is on the page", files.length === 0, files);
    await ends(check, A, fr);
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'PACKAGE FLOW', unit: 'parts', flag: '--only', browser: true });
