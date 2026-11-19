#!/usr/bin/env node
// GATE CHECK: AML RECORD
// Plan 08-11 (D-04, VPK-09): the console's record of the firm's AML program, one page under Report, self-serve edition
// only. The sponsor types the few fields nobody else can know; the procedures and the screening log are compiled from what
// the console already holds (the Integrations settings, each investor's checks, the audit log); the record exports as one
// HTML file, and the export is logged.
//   record           1280x800, the sample self-serve console: "AML program" after AML/KYC in Report; eight headed
//                    sections; typed values kept after saving and reloading; the re-screen interval set to 45 on the
//                    Integrations page reads "Every 45 days"; the screening log holds a screened investor's date,
//                    connection and result, and for a reviewed match the reviewer, the decision and the note; the
//                    retention line
//   export           "Export" saves one .html file whose text (read from the file) holds the eight headings, each typed
//                    value, the procedures and every screening-log row; one audit entry "AML program record exported"
//   entries          training (who, date) and independent review (who, date, findings) entries added and removed,
//                    newest first, in the export too; a date that is not a real date shows the field's own error and
//                    stores nothing; escaping: angle brackets and a script tag typed in a field are shown and exported as
//                    text, never run
//   empty-roles      a record nobody typed: empty fields, compiled sections, "Not recorded" in the export for each typed
//                    field; a team member sees the page read only and can export; an investor has no route to it
//   managed          index.html (the managed edition): no "AML program" in the menu, #console-aml shows nothing new,
//                    STATUS MATH's managed slices pass (C-03)
//   preview-desktop  the owner's preview (sandboxed frame, connect-src none, no server) at 1280x800, and at 390x844 with
//   preview-phone    touch: the frame refuses a fetch; the page renders its eight headings; a field typed and saved; the
//                    screening log scrolls inside the width; Export gives one download; the menu leaves the page; no
//                    refused connection recorded; no raw error
// Every part ends with the leak scan of what it saw (phase 6's leak check and frame.js's vendor scan).
//   NODE_PATH=$(npm root -g) node aml-record.js [--only record,export,entries,empty-roles,managed,preview-desktop,preview-phone]
// The last line is "AML RECORD: PASS (parts run: N)" or "AML RECORD: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const F = require('./frame.js');
const Lib = F.Lib;

const SHOTS = path.join(Lib.OUT, 'aml-record-shots');
fs.mkdirSync(SHOTS, { recursive: true });
Lib.describeShots([
  ['record-page.png', 'The AML program page at 1280x800 with typed values, the compiled procedures and the screening log.'],
  ['export-file.png', 'The exported AML program record opened on its own, as a bank or auditor would see it.'],
  ['preview-desktop-page.png', 'The owner\'s preview (sandboxed frame, no connection allowed, no server) at 1280x800: the AML program page after a save.'],
  ['preview-phone-page.png', 'The owner\'s preview at 390x844 with touch: the AML program page after a save.']
]);

const HEADINGS = ['Policy', 'Responsible person', 'Risk assessment', 'Procedures in force', 'Screening log', 'Escalation', 'Training and independent review', 'Retention'];
const RETENTION = 'Sanctions records are kept for ten years.';
const EXPORTED = 'AML program record exported';
const TYPED = {
  '#aml-statement': 'The firm screens every investor against the sanctions lists before accepting funds and on a fixed interval after.',
  '#aml-scope': 'Every fund and investor of the firm.',
  '#aml-approved-by': 'Managing members (written consent)',
  '#aml-officer-name': 'Harriet Quill',
  '#aml-officer-title': 'Chief compliance officer',
  '#aml-risk': 'U.S. individuals and family trusts; no offering open to non-U.S. persons.',
  '#aml-escalation': 'A possible match goes to the compliance officer the same day; a confirmed match is blocked and reported to OFAC within ten business days.'
};

async function shot(A, p, name) {
  const file = path.join(SHOTS, name);
  await A.page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

/** The sample self-serve console (Kestrel Bay), fresh, signed in as `role` (admin by default). Resolves to { A, p }. */
async function sampleConsole(S, view, role) {
  const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, view || F.VIEW.desktop) });
  const p = A.page;
  await p.goto(S.base);
  await p.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await p.goto(S.base);
  await p.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
  await p.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await p.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
  await setRole(p, role || 'admin');
  return { A, p };
}
async function setRole(p, role) {
  await p.evaluate(() => (location.hash = '#console'));
  await p.waitForSelector('#demo-role', { timeout: 20000 });
  if ((await p.evaluate(() => window.CVPortal.state.role)) !== role) {
    await p.selectOption('#demo-role', role);
    await p.waitForTimeout(500);
  }
}
/** Opens the AML program page by its menu entry (as a person would). */
async function openByMenu(p, tap) {
  await p.evaluate(() => (location.hash = '#console'));
  await p.waitForSelector('.cs-nav a[href="#console"]', { timeout: 20000 });
  const link = p.locator('.cs-nav a[href="#console-aml"]');
  if (!(await link.count())) return false;
  await link.scrollIntoViewIfNeeded();
  if (tap) await link.tap();
  else await link.click();
  await p.waitForSelector('#aml-form', { timeout: 15000 }).catch(() => {});
  return (await p.locator('#aml-form').count()) === 1;
}
const reportMenu = (p) => p.evaluate(() => Array.from(document.querySelectorAll('.cs-nav-group[aria-label="Report"] a')).map((a) => a.textContent.replace(/\s*\d+\s*$/, '').trim()));
const headings = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#main .cs-panel-head h2')).map((x) => x.textContent.trim()));
const h1 = (p) => p.evaluate(() => ((document.querySelector('#main h1') || {}).textContent || '').trim());
/** The screening log as rows of cell texts. */
const logRows = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#aml-log tbody tr')).map((tr) => Array.from(tr.children).map((td) => td.innerText.trim())));
async function typeAll(p, values) {
  for (const [sel, v] of Object.entries(values)) await p.fill(sel, v);
}
async function save(p, tap) {
  const b = p.locator('button[type=submit][form="aml-form"]');
  if (tap) await b.tap();
  else await b.click();
  await p.waitForTimeout(500);
}
async function values(p, sels) {
  const out = {};
  for (const sel of sels) out[sel] = await p.locator(sel).inputValue().catch(() => null);
  return out;
}

/**
 * Two sample investors through the real screening code: one cleared investor re-screened on the AML/KYC page through the
 * connection on (the sandbox in the sample), one potential match reviewed there by the signed-in person with a note.
 * Resolves to { screened: { title }, reviewed: { title, note, actor } }.
 */
async function screenTwo(p) {
  const pick = await p.evaluate(() => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const cleared = ws.investors.find((i) => i.kyc && i.kyc.status === 'cleared');
    const review = ws.investors.find((i) => i.kyc && i.kyc.status === 'review');
    // the investor's verification record, as the first automated check gives it (seeded from the KYC on file)
    NS.integrations.vOf(cleared);
    NS.app.save(true);
    return { a: { id: cleared.id, title: cleared.title }, b: review ? { id: review.id, title: review.title } : null, actor: NS.app.actor() };
  });
  await p.evaluate(() => (location.hash = '#console-kyc'));
  await p.waitForSelector('[data-action=kyc-tab][data-t=all]', { timeout: 15000 });
  await p.click('[data-action=kyc-tab][data-t=all]');
  await p.click(`[data-action=kyc-screen][data-id="${pick.a.id}"]`);
  await p.waitForTimeout(800);
  const note = 'Date of birth and country differ from the listed party.';
  if (pick.b) {
    await p.click('[data-action=kyc-tab][data-t=attention]');
    await p.click(`[data-action=kyc-open][data-id="${pick.b.id}"]`);
    await p.fill('#kyc-note', note);
    if (await p.locator(`[data-action=kyc-iv-approve][data-id="${pick.b.id}"]`).count()) await p.click(`[data-action=kyc-iv-approve][data-id="${pick.b.id}"]`);
    else await p.click(`[data-action=kyc-clear][data-id="${pick.b.id}"]`);
    await p.waitForTimeout(500);
  }
  return { screened: pick.a, reviewed: pick.b ? Object.assign({ note, actor: pick.actor }, pick.b) : null };
}

/** The exported file: { name, text (the file as saved), seen (its text as a browser shows it), rows, headings }. */
async function exportFile(A, p, tap) {
  const wait = A.page.waitForEvent('download', { timeout: 15000 });
  const b = p.locator('[data-action=aml-export]');
  if (tap) await b.tap();
  else await b.click();
  const d = await wait;
  const file = path.join(SHOTS, 'export-' + Date.now() + '.html');
  await d.saveAs(file);
  const text = fs.readFileSync(file, 'utf8');
  fs.unlinkSync(file);
  const v = await A.context.newPage();
  await v.setContent(text);
  const read = await v.evaluate(() => ({
    seen: document.body.innerText,
    headings: Array.from(document.querySelectorAll('h2')).map((x) => x.textContent.trim()),
    rows: Array.from(document.querySelectorAll('#aml-log tbody tr')).map((tr) => Array.from(tr.children).map((td) => td.innerText.trim())),
    tables: Array.from(document.querySelectorAll('table[id]')).reduce((o, t) => ((o[t.id] = Array.from(t.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.children).map((td) => td.innerText.trim()))), o), {}),
    images: document.querySelectorAll('img').length,
    scripts: document.querySelectorAll('script').length,
    outside: Array.from(document.querySelectorAll('[src], link[href]')).map((x) => x.getAttribute('src') || x.getAttribute('href'))
  }));
  await v.screenshot({ path: path.join(SHOTS, 'export-file.png'), fullPage: true }).catch(() => {});
  await v.close();
  return Object.assign({ name: d.suggestedFilename(), text }, read);
}
const tableRows = (p, sel) => p.evaluate((s) => Array.from(document.querySelectorAll(`${s} tbody tr`)).map((tr) => Array.from(tr.children).map((td) => td.innerText.trim())), sel);
async function addTraining(p, who, on) {
  await p.fill('#aml-training-who', who);
  await p.fill('#aml-training-on', on);
  await p.click('[data-action=aml-add][data-list=training]');
  await p.waitForTimeout(400);
}
/** A field's own error: { text, invalid }. */
const fieldError = (p, id) =>
  p.evaluate((id) => {
    const el = document.getElementById(id);
    const e = document.getElementById(id + '-error');
    return { text: e ? e.textContent.trim() : '', invalid: !!el && el.getAttribute('aria-invalid') === 'true', describedBy: el ? el.getAttribute('aria-describedby') || '' : '' };
  }, id);

/** The owner's preview: the portal framed with every connection refused, no server, at one size. */
async function preview({ check, S }, view) {
  const tap = view === 'phone';
  const { A, fr } = await F.framed(S, view);
  try {
    const size = A.page.viewportSize();
    check(`the window is ${F.VIEW[view].viewport.width}x${F.VIEW[view].viewport.height}${tap ? ' with touch' : ''}`, size.width === F.VIEW[view].viewport.width && size.height === F.VIEW[view].viewport.height && (await fr.evaluate(() => navigator.maxTouchPoints > 0)) === tap, size);
    await F.proveRefused(check, A, fr);
    await fr.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
    if (tap) await fr.tap('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
    else await fr.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
    await fr.waitForFunction(() => window.CVPortal && window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
    check('signed in as an admin of the sample portal', (await fr.evaluate(() => window.CVPortal.state.role)) === 'admin');
    check('the menu entry opens the page', await openByMenu(fr, tap));
    const hs = await headings(fr);
    check('the eight headed sections are on the page', JSON.stringify(hs) === JSON.stringify(HEADINGS), hs);
    const text = 'Every investor is screened before funds are accepted.';
    await fr.fill('#aml-statement', text);
    await save(fr, tap);
    check('a typed statement is saved', (await fr.evaluate(() => ((window.CVPortal.state.ws.amlProgram || {}).policy || {}).statement)) === text);
    const fit = await fr.evaluate(() => {
      const t = document.getElementById('aml-log');
      const box = t && t.closest('.tbl-scroll');
      const r = box ? box.getBoundingClientRect() : null;
      return { width: innerWidth, page: document.documentElement.scrollWidth, boxRight: r ? Math.round(r.right) : -1, boxLeft: r ? Math.round(r.left) : -1, scrolls: box ? getComputedStyle(box).overflowX : '', table: t ? t.scrollWidth : 0, inner: box ? box.clientWidth : 0 };
    });
    check('the screening log scrolls inside the width (no sideways page scroll)', fit.page <= fit.width + 1 && fit.boxLeft >= 0 && fit.boxRight <= fit.width + 1 && fit.scrolls === 'auto', fit);
    await shot(A, fr, `preview-${view}-page.png`);
    const seen = [await F.noRawError(check, fr, 'the AML program page')];
    let downloads = 0;
    A.page.on('download', () => downloads++);
    const f = await exportFile(A, fr, tap);
    await fr.waitForTimeout(800);
    check('Export gives one download, an .html file holding the saved statement', downloads === 1 && /\.html$/.test(f.name) && f.seen.indexOf(text) >= 0, { downloads, name: f.name });
    seen.push(await F.noRawError(check, fr, 'after the export'));
    // the way out: the menu
    const out = fr.locator('.cs-nav a[href="#console"]');
    await out.scrollIntoViewIfNeeded();
    if (tap) await out.tap();
    else await out.click();
    await fr.waitForTimeout(600);
    const left = await fr.evaluate(() => ({ hash: location.hash, form: !!document.getElementById('aml-form'), h1: ((document.querySelector('#main h1') || {}).textContent || '').trim() }));
    check('the menu leaves the page (Overview)', left.hash === '#console' && !left.form && left.h1 !== 'AML program', left);
    check('back on the page, the statement is still there', (await openByMenu(fr, tap)) && (await fr.inputValue('#aml-statement')) === text);
    seen.push(await F.noRawError(check, fr, 'the way out and back'));
    check('nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
    F.leakFree(check, 'the page and the exported file', seen.concat([f.seen]).join('\n'));
  } finally {
    await A.context.close().catch(() => {});
  }
}

const exportedCount = (p, action) => p.evaluate((a) => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === a).length, action || EXPORTED);

const parts = {
  record: async ({ check, S }) => {
    const { A, p } = await sampleConsole(S, F.VIEW.desktop);
    try {
      const seen = [];
      const menu = await reportMenu(p);
      check('the Report section lists "AML program" right after "AML/KYC"', menu.indexOf('AML program') === menu.indexOf('AML/KYC') + 1 && menu.indexOf('AML/KYC') >= 0, menu);
      check('the menu entry opens the page', await openByMenu(p));
      check('the page is titled "AML program"', (await h1(p)) === 'AML program', await h1(p));
      const hs = await headings(p);
      check(`eight headed sections in order: ${HEADINGS.join(', ')}`, JSON.stringify(hs) === JSON.stringify(HEADINGS), hs);

      const typed = { '#aml-statement': TYPED['#aml-statement'], '#aml-approved-by': TYPED['#aml-approved-by'], '#aml-officer-name': TYPED['#aml-officer-name'], '#aml-risk': TYPED['#aml-risk'] };
      await typeAll(p, typed);
      await save(p);
      const kept = await p.evaluate(() => JSON.parse(JSON.stringify(window.CVPortal.state.ws.amlProgram || null)));
      check('saved into the workspace record (policy, approver, responsible person, risk)', !!kept && kept.policy && kept.policy.statement === typed['#aml-statement'] && kept.policy.approvedBy === typed['#aml-approved-by'] && kept.officer && kept.officer.name === typed['#aml-officer-name'] && kept.risk === typed['#aml-risk'], kept);
      await p.reload();
      await p.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
      await p.evaluate(() => (location.hash = '#console-aml'));
      await p.waitForSelector('#aml-form', { timeout: 15000 });
      const after = await values(p, Object.keys(typed));
      check('after a reload the typed values are still there', Object.keys(typed).every((k) => after[k] === typed[k]), after);

      // the re-screen interval from the Integrations page
      await p.evaluate(() => (location.hash = '#console-integrations'));
      await p.waitForSelector('#iv-rescreen', { timeout: 15000 });
      await p.fill('#iv-rescreen', '45');
      await p.click('[data-action=iv-save]');
      await p.waitForTimeout(400);
      const rules = await p.evaluate(() => window.CVPortal.state.ws.integrations.rules.rescreenDays);
      check('the Integrations page saved a re-screen interval of 45 days', rules === 45, rules);
      await p.evaluate(() => (location.hash = '#console-aml'));
      await p.waitForSelector('#aml-procedures', { timeout: 15000 });
      const proc = await p.locator('#aml-procedures').innerText();
      check('the procedures read "Every 45 days" for re-screening', /Re-screening\s*\n?\s*Every 45 days/.test(proc), proc);
      const names = await p.evaluate(() => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        return ['identity', 'aml', 'accreditation'].map((k) => NS.integrations.activeFor(ws, k).map((x) => x.name).join(', '));
      });
      check('the procedures name the connections in use for identity, screening and accreditation', names.every((n) => n && proc.indexOf(n) >= 0), { names, proc });
      check('the procedures state when verified accreditation is required, how long it stays valid, the hold for politically exposed persons and how investors are approved', /For Rule 506\(c\) offerings/.test(proc) && /90 days/.test(proc) && /Held for enhanced due diligence/.test(proc) && /Automatic when every check passes/.test(proc), proc);

      // the screening log
      const two = await screenTwo(p);
      await p.evaluate(() => (location.hash = '#console-aml'));
      await p.waitForSelector('#aml-log', { timeout: 15000 });
      const rows = await logRows(p);
      const today = await p.evaluate(() => window.CVPortal.ui.date(window.CVPortal.dates.today()));
      const a = rows.find((r) => r[1] === two.screened.title && /Sandbox: no matches/.test(r[3]));
      check('the screening log lists the screened investor with the date, the connection\'s name and the result', !!a && a[0] === today && a[2] === 'Sanctions and PEP screening run', { today, a, first: rows.slice(0, 4) });
      check('the newest entry is first', rows.length > 1 && rows[0][0] === today, rows.slice(0, 2));
      const b = two.reviewed && rows.find((r) => r[1] === two.reviewed.title && r[3].indexOf(two.reviewed.note) >= 0);
      check('for the reviewed match: the reviewer, the decision and the note', !!b && b[4] === two.reviewed.actor && /cleared|approved/i.test(b[2]), { b, reviewed: two.reviewed });
      const ret = await p.locator('#aml-retention').innerText();
      check(`the retention line reads "${RETENTION}"`, ret.trim() === RETENTION, ret);
      await shot(A, p, 'record-page.png');
      seen.push(await F.noRawError(check, p, 'the AML program page', A.errors));
      check('nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await A.context.close().catch(() => {});
    }
  },

  export: async ({ check, S }) => {
    const { A, p } = await sampleConsole(S, F.VIEW.desktop);
    try {
      const two = await screenTwo(p);
      check('the menu entry opens the page', await openByMenu(p));
      await typeAll(p, TYPED);
      await save(p);
      const before = await exportedCount(p);
      const page = await logRows(p);
      const procPage = (await p.locator('#aml-procedures').innerText()).split('\n').map((x) => x.trim()).filter(Boolean);
      const f = await exportFile(A, p);
      check('one .html file is saved', /\.html$/.test(f.name) && f.text.length > 500, f.name);
      check('the file is one self-contained document: no script, nothing loaded from outside', f.scripts === 0 && !/<script/i.test(f.text) && f.outside.length === 0, { scripts: f.scripts, outside: f.outside });
      check('the file holds the eight headings in order', JSON.stringify(f.headings) === JSON.stringify(HEADINGS), f.headings);
      const miss = Object.values(TYPED).filter((v) => f.seen.indexOf(v) < 0);
      check('the file holds each typed value', miss.length === 0, miss);
      const missProc = procPage.filter((l) => f.seen.indexOf(l) < 0);
      check('the file holds every line of the procedures', procPage.length >= 9 && missProc.length === 0, { missProc, procPage });
      check('the file holds every screening-log row, as the page shows them', page.length > 0 && JSON.stringify(f.rows) === JSON.stringify(page), { page: page.length, file: f.rows.length, first: [page[0], f.rows[0]] });
      check('the file holds the screened investor\'s row and the reviewed match\'s note', f.rows.some((r) => r[1] === two.screened.title && /Sandbox/.test(r[3])) && (!two.reviewed || f.rows.some((r) => r[3].indexOf(two.reviewed.note) >= 0)), two);
      check(`the file holds the retention line "${RETENTION}"`, f.seen.indexOf(RETENTION) >= 0);
      const after = await exportedCount(p);
      check(`the audit log gains one entry "${EXPORTED}"`, after === before + 1, { before, after });
      const last = await p.evaluate((a) => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === a).pop() || null, EXPORTED);
      check('the entry names the file', !!last && last.detail.indexOf(f.name) >= 0, last);
      const seen = [await F.noRawError(check, p, 'the AML program page', A.errors), f.seen];
      check('nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
      F.leakFree(check, 'the page and the exported file', seen.join('\n'));
    } finally {
      await A.context.close().catch(() => {});
    }
  },

  entries: async ({ check, S }) => {
    const { A, p } = await sampleConsole(S, F.VIEW.desktop);
    try {
      check('the menu entry opens the page', await openByMenu(p));
      const stored = () => p.evaluate(() => JSON.parse(JSON.stringify(window.CVPortal.state.ws.amlProgram || {})));
      await addTraining(p, 'Jordan Ames', '2026-03-02');
      await addTraining(p, 'Priya Shah', '2026-09-15');
      await addTraining(p, 'Lena Ortiz', '2025-11-20');
      let t = await tableRows(p, '#aml-training');
      check('three training entries, newest first', t.length === 3 && t[0][1] === 'Priya Shah' && t[1][1] === 'Jordan Ames' && t[2][1] === 'Lena Ortiz', t);
      let st = await stored();
      check('stored in the workspace record as { who, on }', Array.isArray(st.training) && st.training.length === 3 && st.training.every((e) => e.who && /^\d{4}-\d{2}-\d{2}$/.test(e.on)), st.training);
      await p.fill('#aml-review-who', 'Calder & Finch LLP');
      await p.fill('#aml-review-on', '2026-06-30');
      await p.fill('#aml-review-findings', 'No exceptions; screening interval documented.');
      await p.click('[data-action=aml-add][data-list=reviews]');
      await p.waitForTimeout(400);
      const rv = await tableRows(p, '#aml-reviews');
      check('an independent review entry (who, date, findings) is added', rv.length === 1 && rv[0][1] === 'Calder & Finch LLP' && rv[0][2] === 'No exceptions; screening interval documented.', rv);
      // remove the middle training entry (Jordan Ames)
      await p.click('#aml-training tbody tr:nth-child(2) [data-action=aml-remove]');
      await p.waitForTimeout(400);
      t = await tableRows(p, '#aml-training');
      st = await stored();
      check('a training entry is removed (from the page and the record)', t.length === 2 && !t.some((r) => r[1] === 'Jordan Ames') && st.training.length === 2 && !st.training.some((e) => e.who === 'Jordan Ames'), { t, st: st.training });
      await p.click('#aml-reviews tbody tr:nth-child(1) [data-action=aml-remove]');
      await p.waitForTimeout(400);
      st = await stored();
      check('the review entry is removed', (await tableRows(p, '#aml-reviews')).length === 0 && (st.reviews || []).length === 0, st.reviews);
      await p.fill('#aml-review-who', 'Calder & Finch LLP');
      await p.fill('#aml-review-on', '2026-06-30');
      await p.fill('#aml-review-findings', 'No exceptions.');
      await p.click('[data-action=aml-add][data-list=reviews]');
      await p.waitForTimeout(400);

      // a date that is not a real date: the field's own error, nothing stored
      const before = JSON.stringify(await stored());
      await p.fill('#aml-training-who', 'Omar Haddad');
      await p.focus('#aml-training-on');
      await p.keyboard.type('02302026');
      await p.click('[data-action=aml-add][data-list=training]');
      await p.waitForTimeout(400);
      const e1 = await fieldError(p, 'aml-training-on');
      check('a training date that is not a real date shows the field\'s own error', e1.text === 'Enter a real date.' && e1.invalid, e1);
      check('and stores nothing', JSON.stringify(await stored()) === before);
      await p.fill('#aml-statement', 'Kept only when the date is right.');
      await p.focus('#aml-adopted-on');
      await p.keyboard.type('13452026');
      await save(p);
      const e2 = await fieldError(p, 'aml-adopted-on');
      check('an adoption date that is not a real date shows the field\'s own error on Save', e2.text === 'Enter a real date.' && e2.invalid, e2);
      check('and Save stores nothing', JSON.stringify(await stored()) === before);
      check('the typed statement is still in its field', (await p.inputValue('#aml-statement')) === 'Kept only when the date is right.');
      await p.fill('#aml-adopted-on', '2026-01-15');
      await save(p);
      st = await stored();
      check('with a real date it saves, and the error is gone', st.policy && st.policy.adoptedOn === '2026-01-15' && st.policy.statement === 'Kept only when the date is right.' && (await fieldError(p, 'aml-adopted-on')).text === '', st.policy);

      // escaping: angle brackets and a script tag are text, never run
      const evil = 'Policy <b>v2</b> </textarea><script>window.__aml=1</script><img src=x onerror="window.__amlImg=1">';
      let dialogs = 0;
      p.on('dialog', (d) => {
        dialogs++;
        d.dismiss().catch(() => {});
      });
      await p.fill('#aml-statement', evil);
      await p.fill('#aml-officer-name', '<script>alert(1)</script>');
      await save(p);
      await p.evaluate(() => (location.hash = '#console'));
      await p.waitForTimeout(300);
      await p.evaluate(() => (location.hash = '#console-aml'));
      await p.waitForSelector('#aml-form', { timeout: 15000 });
      const esc = await p.evaluate(() => ({ v: document.getElementById('aml-statement').value, n: document.getElementById('aml-officer-name').value, scripts: document.querySelectorAll('#aml-form script, #aml-form img, #aml-form b').length, ran: !!(window.__aml || window.__amlImg) }));
      check('the page shows the statement and the name as typed, as text', esc.v === evil && esc.n === '<script>alert(1)</script>' && esc.scripts === 0, esc);
      check('nothing in them ran (no script, no image handler, no dialog)', esc.ran === false && dialogs === 0, { esc, dialogs });

      // the export holds the entries newest first and the escaped text
      const f = await exportFile(A, p);
      const tr = f.tables['aml-training'] || [];
      const rvx = f.tables['aml-reviews'] || [];
      check('the export lists the training entries newest first', tr.length === 2 && tr[0][1] === 'Priya Shah' && tr[1][1] === 'Lena Ortiz', tr);
      check('the export lists the independent review with its findings', rvx.length === 1 && rvx[0][1] === 'Calder & Finch LLP' && rvx[0][2] === 'No exceptions.', rvx);
      check('the export shows the statement and the name as text, with no script or image in the file', f.seen.indexOf(evil) >= 0 && f.seen.indexOf('<script>alert(1)</script>') >= 0 && f.scripts === 0 && f.images === 0 && !/<script/i.test(f.text), { scripts: f.scripts, images: f.images });
      const seen = [await F.noRawError(check, p, 'the AML program page', A.errors), f.seen];
      F.leakFree(check, 'the page and the exported file', seen.join('\n'));
    } finally {
      await A.context.close().catch(() => {});
    }
  },

  'empty-roles': async ({ check, S }) => {
    const { A, p } = await sampleConsole(S, F.VIEW.desktop);
    try {
      check('the menu entry opens the page', await openByMenu(p));
      const hs = await headings(p);
      check('a record nobody has typed: the eight sections are on the page', JSON.stringify(hs) === JSON.stringify(HEADINGS), hs);
      const empty = await p.evaluate(() => Array.from(document.querySelectorAll('#aml-form input, #aml-form textarea')).filter((x) => x.value !== '').map((x) => x.id));
      check('every field is empty', empty.length === 0, empty);
      const proc = (await p.locator('#aml-procedures').innerText()).split('\n').filter(Boolean);
      check('the procedures are compiled', proc.length >= 18 && /Every 30 days/.test(proc.join('\n')), proc);
      check('the screening log is compiled from the audit log', (await logRows(p)).length > 0);
      const f = await exportFile(A, p);
      const nr = (f.seen.match(/Not recorded/g) || []).length;
      check('the export says "Not recorded" for each of the 9 typed fields and the two empty lists (11)', nr === 11, nr);
      check('the export still holds the eight headings', JSON.stringify(f.headings) === JSON.stringify(HEADINGS), f.headings);
      const seen = [await F.noRawError(check, p, 'the empty page', A.errors), f.seen];

      // a team member: the same page, read only, and Export works
      await setRole(p, 'team');
      check('a team member has the menu entry', await openByMenu(p));
      const ro = await p.evaluate(() => {
        const els = Array.from(document.querySelectorAll('#aml-form input, #aml-form textarea'));
        return { n: els.length, editable: els.filter((x) => !x.readOnly && !x.disabled).map((x) => x.id), save: document.querySelectorAll('button[type=submit][form="aml-form"]').length, add: document.querySelectorAll('[data-action=aml-add], [data-action=aml-remove]').length };
      });
      check('every field is read only, and there is no Save, Add or Remove', ro.n >= 9 && ro.editable.length === 0 && ro.save === 0 && ro.add === 0, ro);
      const before = await exportedCount(p);
      const g = await exportFile(A, p);
      const last = await p.evaluate((a) => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === a).pop() || null, EXPORTED);
      check('a team member can export, and the export is logged in their name', /\.html$/.test(g.name) && (await exportedCount(p)) === before + 1 && !!last && /team/i.test(last.actor), last);
      const forced = await p.evaluate(() => {
        const NS = window.CVPortal;
        const f = document.getElementById('aml-form');
        f.elements['aml-statement'].removeAttribute('readonly');
        f.elements['aml-statement'].value = 'Changed by a team member';
        f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        return ((NS.state.ws.amlProgram || {}).policy || {}).statement || '';
      });
      check('a team member\'s submit changes nothing', forced !== 'Changed by a team member', forced);
      seen.push(await F.noRawError(check, p, 'the team member\'s page', A.errors));

      // an investor: no route to it
      await p.selectOption('#demo-role', 'investor');
      await p.waitForTimeout(600);
      await p.evaluate(() => (location.hash = '#console-aml'));
      await p.waitForTimeout(800);
      const inv = await p.evaluate(() => ({ form: !!document.getElementById('aml-form'), text: document.body.innerText }));
      check('an investor opening #console-aml gets no AML program page', !inv.form && inv.text.indexOf('Sanctions records are kept for ten years.') < 0 && inv.text.indexOf('Screening log') < 0);
      check('nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await A.context.close().catch(() => {});
    }
  },

  managed: async ({ check, S }) => {
    const A = await Lib.open(S, { context: F.VIEW.desktop });
    try {
      const p = A.page;
      await p.goto(`${S.origin}/index.html`);
      await p.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
      await p.goto(`${S.origin}/index.html`);
      await p.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 20000 });
      check('index.html is the managed edition', (await p.evaluate(() => window.CVPortal.EDITION.id)) === 'managed');
      await p.evaluate(() => (location.hash = '#console-kyc'));
      await p.waitForSelector('.cs-nav a[href="#console-kyc"]', { timeout: 20000 });
      const menu = await p.evaluate(() => Array.from(document.querySelectorAll('.cs-nav a')).map((a) => a.textContent.replace(/\s*\d+\s*$/, '').trim()));
      check('the managed menu is on screen with AML/KYC', menu.indexOf('AML/KYC') >= 0, menu);
      check('it has no "AML program"', menu.indexOf('AML program') < 0 && (await p.locator('.cs-nav a[href="#console-aml"]').count()) === 0, menu);
      const report = await reportMenu(p);
      check('its Report section is unchanged: Reports, Audit, AML/KYC', JSON.stringify(report) === JSON.stringify(['Reports', 'Audit', 'AML/KYC']), report);
      await p.evaluate(() => (location.hash = '#console-aml'));
      await p.waitForTimeout(800);
      const st = await p.evaluate(() => ({ form: !!document.getElementById('aml-form'), h1: ((document.querySelector('#main h1') || {}).textContent || '').trim(), text: document.body.innerText }));
      check('#console-aml shows nothing new (no AML program page)', !st.form && st.h1 !== 'AML program' && st.text.indexOf('Sanctions records are kept for ten years.') < 0, st.h1);
      check('the managed edition may not open it', (await p.evaluate(() => window.CVPortal.app.allowed('console-aml'))) === false);
      check('nothing outside the page was asked for', A.net.external.length === 0, A.net.external);
      const r = spawnSync(process.execPath, [path.join(__dirname, '..', '..', '06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa', 'checks', 'status-math.js'), '--case', 'managed'], { encoding: 'utf8' });
      const last = String(r.stdout || '').trim().split('\n').pop();
      check('STATUS MATH\'s managed slices still pass (C-03)', r.status === 0 && last === 'STATUS MATH: PASS (cases run: 1)', last);
      check('no page error', A.errors.length === 0, A.errors);
    } finally {
      await A.context.close().catch(() => {});
    }
  },

  'preview-desktop': (ctx) => preview(ctx, 'desktop'),
  'preview-phone': (ctx) => preview(ctx, 'phone')
};

Lib.runParts(parts, { name: 'AML RECORD', unit: 'parts', flag: '--only', browser: true });
