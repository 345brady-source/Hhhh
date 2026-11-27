// gate: browser
// last "AUDIT FLOW: PASS (parts run: 4)"
// The Audit page with the five new schedules (plan 11-12), the way the owner sees it: the portal inside a sandboxed
// iframe that refuses every connection, at 390x844 with touch and at 1280x800, in both editions.
//   real-phone      Kestrel Bay as admin with fund A added (offering, investors, call, distribution, holding and the
//                   fixture's bank and value entries, through lib10 ws), clock 2027-01-20: Audit, fund A, fiscal 2026 shows
//                   fund A's recorded figures, the five new tabs, and a trial balance whose debits equal its credits
//   real-desktop    the same at 1280x800, and the readiness list shows 'No bank account added.'
//   sample-desktop  Kestrel Bay's kb-fund-ii (a sample fund, clock 2026-11-19): the trial balance's debits equal its
//                   credits and are not zero; the general ledger shows the hint that the CSV has every row
//   managed         index.html as staff: the Audit page's heading, the five new tabs, no Accounting entry in the menu, and
//                   index.html loading no phase 11 file it did not load at the plan's base (11-CONTEXT "Decision during
//                   16-02") and the menu (NAV, NAV_SECTIONS lines of console.js) unchanged since that base
//                   commit (11-CONTEXT "Decision during 11-16": a later plan's line elsewhere in console.js is allowed)
//   NODE_PATH=$(npm root -g) node audit-flow.js [--only part1,part2]
// The last line is "AUDIT FLOW: PASS (parts run: N)" or "AUDIT FLOW: FAIL (parts run: N) - <failed parts>". The two
// marker lines above are read by the phase gate.
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const T = require('../../10-investor-tax-documents-and-withholding/checks/lib10.js');
const Lib = T.Lib;

/*
 * 11-CONTEXT "Decision during 16-02": index.html may change after phase 11 (16-02 adds its achrecord.js line), but no
 * line it has gained since the base may load one of phase 11's own files (books*.js, books.css, bankfiles.js,
 * filesout.js), so the managed edition still gets none of phase 11. p11Added gives those lines (empty when none).
 */
const P11_OWN = /assets\/(js\/(books[\w-]*|bankfiles|filesout)\.js|css\/books\.css)/;
function p11Added(base, now) {
  const left = new Map();
  String(base).split('\n').forEach((l) => left.set(l, (left.get(l) || 0) + 1));
  return String(now)
    .split('\n')
    .filter((l) => {
      const n = left.get(l) || 0;
      if (n) left.set(l, n - 1);
      return !n;
    })
    .filter((l) => P11_OWN.test(l))
    .map((l) => l.trim());
}

const OUT = path.join(Lib.OUT, 'audit-flow');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-figures\.png$/, 'Audit, fund A, fiscal 2026: the four figures from what was recorded, and the readiness list.'],
  [/-tb\.png$/, 'Audit preview, Trial balance tab: one row per account; the total row shows equal debits and credits.'],
  [/-gl\.png$/, 'Audit preview, General ledger tab: one row per journal line (60 shown; the CSV has every row).'],
  [/-cf\.png$/, 'Audit preview, Statement of cash flows tab: operating, financing, and the change in cash.'],
  [/-bankrec\.png$/, 'Audit preview, Bank reconciliation tab: the latest reconciliation of each bank account, or what is missing.'],
  [/-ratios\.png$/, 'Audit preview, Financial highlights tab: expense and net investment income ratios and the return measure.'],
  [/-managed\.png$/, 'The managed console (index.html), Audit page with the new schedule tabs.']
]);

const REAL_DAY = '2027-01-20';
const SAMPLE_DAY = '2026-11-19';
const NEW_TABS = [
  ['tb', 'Trial balance'],
  ['gl', 'General ledger'],
  ['cf', 'Statement of cash flows'],
  ['bankrec', 'Bank reconciliation'],
  ['ratios', 'Financial highlights']
];
const J = (x) => JSON.stringify(x);
const fixture = () => JSON.parse(JSON.stringify(require('./fixtures/fund-a.js')));

/** The commit the plan started from: the gate's copy, then GATE_OUT's, then this plan's output folder. */
/** The added or removed lines of a `git diff -U0` (not the +++/--- headers) that touch the menu: NAV or NAV_SECTIONS. */
function menuChanges(diff) {
  return String(diff || '')
    .split('\n')
    .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l) && /\bNAV(_SECTIONS)?\b/.test(l));
}
if (process.argv.includes('--menu-selftest')) {
  // RED/GREEN proof of the menu test on real git diffs (11-CONTEXT "Decision during 11-16"):
  //   node audit-flow.js --menu-selftest <base commit> <scratch folder>
  // GREEN: this tree's console.js against the base (11-16's one hook line). RED: a scratch copy of console.js with one
  // NAV_SECTIONS line added, diffed against the tree's own file with git diff --no-index.
  const i = process.argv.indexOf('--menu-selftest');
  const base = process.argv[i + 1];
  const dir = process.argv[i + 2];
  const git = (args) => spawnSync('git', args, { cwd: Lib.ROOT, encoding: 'utf8' });
  const green = git(['diff', '-U0', base, 'HEAD', '--', 'assets/js/console.js']);
  const src = fs.readFileSync(path.join(Lib.ROOT, 'assets/js/console.js'), 'utf8');
  fs.mkdirSync(dir, { recursive: true });
  const copy = path.join(dir, 'console-nav.js');
  const at = src.indexOf('\n', src.indexOf('NAV_SECTIONS'));
  fs.writeFileSync(copy, src.slice(0, at + 1) + "  NAV_SECTIONS.find((g) => g[0] === 'Report')[1].push('console-x');\n" + src.slice(at + 1));
  const red = git(['diff', '--no-index', '-U0', path.join(Lib.ROOT, 'assets/js/console.js'), copy]);
  fs.rmSync(copy, { force: true });
  const r = menuChanges(red.stdout);
  const g = menuChanges(green.stdout);
  const gAdded = String(green.stdout || '').split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l));
  console.log(`${r.length === 1 ? 'PASS' : 'FAIL'} menu-selftest RED: a console.js copy with one NAV_SECTIONS line added is reported :: ${JSON.stringify(r)}`);
  console.log(`${green.status === 0 && gAdded.length === 1 && g.length === 0 ? 'PASS' : 'FAIL'} menu-selftest GREEN: this tree against ${String(base).slice(0, 7)} changes ${gAdded.length} line of console.js, none of the menu :: ${JSON.stringify(gAdded.map((l) => l.trim().slice(0, 60)))}`);
  process.exit(r.length === 1 && green.status === 0 && gAdded.length === 1 && g.length === 0 ? 0 : 1);
}

function baseCommit() {
  const at = [
    process.env.P11_ROOT ? path.join(process.env.P11_ROOT, '..', 'base-commit.txt') : '',
    process.env.GATE_OUT ? path.join(process.env.GATE_OUT, 'base-commit.txt') : '',
    path.join(Lib.SCRATCH, 'exec-11-12', 'base-commit.txt')
  ].filter((f) => f && fs.existsSync(f));
  return at.length ? fs.readFileSync(at[0], 'utf8').trim() : '';
}

/** Open a view by its route and wait for something of it. */
async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 30000 });
  await fr.waitForTimeout(300);
}
/** Choose the fund on the Audit page and wait until the page is drawn for it. */
async function chooseFund(fr, id) {
  await fr.selectOption('#aud-offering', id);
  await fr.waitForFunction((id) => {
    const s = document.querySelector('#aud-offering');
    const B = window.CVPortal.state.ui && window.CVPortal.state.ui.audBuild;
    return !!s && s.value === id && !!B && B.P.o.id === id;
  }, id, { timeout: 30000 });
  await fr.waitForTimeout(300);
}
/** The four figures: { label: value }. */
const figures = (fr) => fr.evaluate(() => Array.from(document.querySelectorAll('.cs-figs > div')).map((d) => [d.querySelector('dt').innerText.trim(), d.querySelector('dd').innerText.trim()]));
/** The preview's tab titles. */
const tabs = (fr) => fr.evaluate(() => Array.from(document.querySelectorAll('.aud-tabs [data-action=aud-tab]')).map((b) => [b.getAttribute('data-t'), b.innerText.trim()]));
/** Press a preview tab and wait until it is the one shown. */
async function openTab(fr, id) {
  await T.press(fr, `.aud-tabs [data-action=aud-tab][data-t="${id}"]`);
  await fr.waitForFunction((id) => {
    const b = document.querySelector(`.aud-tabs [data-action=aud-tab][data-t="${id}"]`);
    return !!b && b.getAttribute('aria-pressed') === 'true';
  }, id, { timeout: 30000 });
  await fr.waitForTimeout(200);
}
/** The shown table: header cells, body row count, the total row's cells and the hint under it. */
const shown = (fr) =>
  fr.evaluate(() => {
    const t = document.querySelector('.aud-tbl');
    const cells = (tr) => (tr ? Array.from(tr.children).map((c) => c.innerText.trim()) : null);
    const hint = t && t.closest('.tbl-scroll') && t.closest('.tbl-scroll').nextElementSibling;
    return {
      head: t ? cells(t.querySelector('thead tr')) : null,
      rows: t ? t.querySelectorAll('tbody tr').length : 0,
      total: t ? cells(t.querySelector('tfoot tr')) : null,
      hint: hint && hint.classList.contains('cs-hint') ? hint.innerText.trim() : '',
      desc: (document.querySelector('.aud-desc') || {}).innerText || ''
    };
  });

/** Fund A added to the open sample workspace: records, its books (holding fa-x) and the fixture's other entries. */
async function addFundA(fr) {
  const F = fixture();
  return T.ws(
    fr,
    (w, F, NS) => {
      const oid = F.expect.offeringId;
      if (w.offerings.some((o) => o.id === oid)) return 'already there';
      w.offerings.push(F.records.offerings[0]);
      F.records.investors.forEach((i) => {
        i.onboarding = i.onboarding || { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05', source: 'manual' };
        w.investors.push(i);
      });
      (w.calls = w.calls || []).push(...F.records.calls);
      (w.runs = w.runs || []).push(...F.records.runs);
      if (!w.books || typeof w.books !== 'object') w.books = { v: 1, funds: {} };
      w.books.funds = w.books.funds || {};
      w.books.funds[oid] = F.records.books.funds[oid];
      F.entries.forEach((e) => NS.books.post(w, oid, e, { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' }));
      return w.books.funds[oid].journal.length;
    },
    F
  );
}

/** Parts real-phone and real-desktop: fund A's Audit page from its recorded figures. */
async function realAt(size, { check, S }) {
  const { A, fr } = await T.framed(S, size, { clock: REAL_DAY });
  const vp = A.page.viewportSize();
  check(`the frame is ${size === 'phone' ? '390x844' : '1280x800'}`, size === 'phone' ? vp.width === 390 && vp.height === 844 : vp.width === 1280 && vp.height === 800, vp);
  await T.proveRefused(check, A, fr);
  await T.sample(fr, { role: 'admin' });
  const posted = await addFundA(fr);
  check("fund A's eight fixture entries were posted in the frame", posted === 8, posted);
  await go(fr, 'console-audit', '#aud-offering');
  await chooseFund(fr, 'fund-a');
  const pre = await fr.evaluate(() => document.querySelector('#aud-preset').value);
  check("the period is 'Fiscal year 2026' (the page's first choice on 20 January 2027)", pre === 'fy' && (await fr.evaluate(() => document.querySelector('#aud-preset').selectedOptions[0].innerText.trim())) === 'Fiscal year 2026', pre);
  const figs = await figures(fr);
  const want = [
    ['Net assets, Dec 31, 2026', '$517,500.00'],
    ['Contributions', '$450,000.00'],
    ['Distributions', '$9,000.00'],
    ['Net increase from operations', '$76,500.00']
  ];
  check("the four figures are fund A's recorded ones: net assets $517,500.00, contributions $450,000.00, distributions $9,000.00, net increase $76,500.00", J(figs) === J(want), { got: figs, want });
  const tb = await tabs(fr);
  const names = tb.map((x) => x[1]);
  check('the schedule tabs include Trial balance, General ledger, Statement of cash flows, Bank reconciliation and Financial highlights, after the existing ones', NEW_TABS.every(([id, t]) => tb.some((x) => x[0] === id && x[1] === t)) && J(tb.slice(-5).map((x) => x[0])) === J(NEW_TABS.map((x) => x[0])), names);
  await A.page.screenshot({ path: path.join(OUT, `${size}-figures.png`), fullPage: true });
  await openTab(fr, 'tb');
  const t = await shown(fr);
  check("the Trial balance tab's total row shows equal debits and credits ($1,000,000.00 each) and ending balances summing to $0.00", !!t.total && t.total[1] === 'Total' && t.total[5] === '$1,000,000.00' && t.total[6] === t.total[5] && t.total[7] === '$0.00', t.total);
  check('the Trial balance shows its ten accounts', t.rows === 10, t.rows);
  await A.page.screenshot({ path: path.join(OUT, `${size}-tb.png`), fullPage: true });
  await openTab(fr, 'cf');
  const cf = await fr.evaluate(() => Array.from(document.querySelectorAll('.aud-tbl tbody tr')).map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()));
  check("the Statement of cash flows tab ends with the increase $32,000.00 and cash at the end $32,000.00", cf.indexOf('Net increase (decrease) in cash $32,000.00') >= 0 && cf[cf.length - 1] === 'Cash at end of period $32,000.00', cf);
  await A.page.screenshot({ path: path.join(OUT, `${size}-cf.png`), fullPage: true });
  await openTab(fr, 'ratios');
  const ra = await fr.evaluate(() => Array.from(document.querySelectorAll('.aud-tbl tbody tr')).map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()));
  check('the Financial highlights tab: expenses 5.51% and net investment loss -2.92% of average capital', ra[0] === 'Expenses to average limited partners’ capital 5.51%' && ra[1] === 'Net investment income (loss) to average limited partners’ capital -2.92%' && /^Net internal rate of return since inception -?\d+\.\d{2}%$/.test(ra[2] || ''), ra);
  await A.page.screenshot({ path: path.join(OUT, `${size}-ratios.png`), fullPage: true });
  await openTab(fr, 'bankrec');
  const br = await fr.evaluate(() => Array.from(document.querySelectorAll('.aud-tbl tbody tr')).map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()));
  check("the Bank reconciliation tab says 'No bank account added'", J(br) === J(['No bank account added']), br);
  await A.page.screenshot({ path: path.join(OUT, `${size}-bankrec.png`), fullPage: true });
  await openTab(fr, 'gl');
  const g = await shown(fr);
  check('the General ledger tab shows all 48 journal lines (no hint: fewer than 60)', g.rows === 48 && !g.hint && !!g.total && g.total[8] === '$1,000,000.00' && g.total[9] === '$1,000,000.00', { rows: g.rows, hint: g.hint, total: g.total });
  await A.page.screenshot({ path: path.join(OUT, `${size}-gl.png`), fullPage: true });
  if (size === 'desktop') {
    const items = await fr.evaluate(() => Array.from(document.querySelectorAll('.aud-checks li li')).map((li) => li.innerText.trim()));
    check("the readiness list shows 'No bank account added.'", items.indexOf('No bank account added.') >= 0, items);
  }
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  await A.context.close();
}

const parts = {
  'real-phone': (ctx) => realAt('phone', ctx),
  'real-desktop': (ctx) => realAt('desktop', ctx),

  /** A sample fund: its books are brought up to date when the Audit page is built, so the trial balance is not empty. */
  async 'sample-desktop'({ check, S }) {
    const { A, fr } = await T.framed(S, 'desktop', { clock: SAMPLE_DAY });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await go(fr, 'console-audit', '#aud-offering');
    await chooseFund(fr, 'kb-fund-ii');
    await openTab(fr, 'tb');
    const t = await shown(fr);
    check("kb-fund-ii's Trial balance tab exists and its total row's debits equal its credits, and are not $0.00", !!t.total && t.total[1] === 'Total' && t.total[5] === t.total[6] && t.total[5] !== '$0.00' && /^\$[\d,]+\.\d{2}$/.test(t.total[5]), t.total);
    check('its ending balances sum to $0.00', !!t.total && t.total[7] === '$0.00', t.total);
    await A.page.screenshot({ path: path.join(OUT, 'sample-tb.png'), fullPage: true });
    await openTab(fr, 'gl');
    const g = await shown(fr);
    const m = /^Showing 60 of ([\d,]+) rows\. The CSV has every row\.$/.exec(g.hint);
    check('the General ledger tab shows 60 rows and the hint that the CSV has every row (it holds more than 60)', g.rows === 60 && !!m && Number(m[1].replace(/,/g, '')) > 60, { rows: g.rows, hint: g.hint });
    await A.page.screenshot({ path: path.join(OUT, 'sample-gl.png'), fullPage: true });
    await T.wayOut(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  /** The managed edition as staff: the Audit page carries the new tabs; the menu and the page are as at the base. */
  async managed({ check, S }) {
    const { A, fr } = await T.framed(S, 'desktop', { page: 'index.html', clock: SAMPLE_DAY });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'staff' });
    await go(fr, 'console-audit', '#aud-offering');
    const h1 = await fr.locator('.cs-head h1').first();
    check("the Audit page's heading is visible", (await h1.isVisible()) && (await h1.innerText()).trim() === 'Audit', await h1.innerText());
    const tb = await tabs(fr);
    check('the five new tabs are present', NEW_TABS.every(([id, t]) => tb.some((x) => x[0] === id && x[1] === t)), tb.map((x) => x[1]));
    const menu = await fr.evaluate(() => Array.from(document.querySelectorAll('.cs-nav a')).map((a) => a.innerText.replace(/\s+\d+$/, '').trim()));
    check('the menu has no Accounting entry', menu.length > 0 && menu.indexOf('Accounting') < 0, menu);
    const base = baseCommit();
    const g = (args) => spawnSync('git', args, { cwd: Lib.ROOT, encoding: 'utf8' });
    const baseHtml = base ? g(['show', `${base}:index.html`]) : { status: 1, stdout: '' };
    const added = baseHtml.status === 0 ? p11Added(baseHtml.stdout, fs.readFileSync(path.join(Lib.ROOT, 'index.html'), 'utf8')) : null;
    const menuFile = g(['diff', '-U0', base, 'HEAD', '--', 'assets/js/console.js']);
    const menuLines = menuChanges(menuFile.stdout);
    check(`index.html loads no phase 11 file it did not load at the base commit ${base.slice(0, 7)}, and the menu (NAV, NAV_SECTIONS lines of console.js) has no change since it`, !!base && !!added && added.length === 0 && menuFile.status === 0 && menuLines.length === 0, { base, page: added, console: menuFile.status, menu: menuLines });
    await A.page.screenshot({ path: path.join(OUT, 'desktop-managed.png'), fullPage: true });
    // the managed edition is Carrow & Vale's own console, so its name is on screen by design; any other name is not
    const text = await fr.evaluate(() => document.body.innerText);
    const hits = text.split('\n').map((l) => l.replace(/Carrow\s*&\s*Vale/gi, '')).filter((l) => Lib.VENDORS.test(l) || Lib.VENDOR_RE.test(l) || Lib.WORD_RE.test(l));
    check('no vendor, model or library name other than the managed firm’s own, and no forbidden word, on screen', hits.length === 0, hits.map((l) => l.trim().slice(0, 160)));
    await T.wayOut(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'AUDIT FLOW', unit: 'parts', flag: '--only', browser: true });
