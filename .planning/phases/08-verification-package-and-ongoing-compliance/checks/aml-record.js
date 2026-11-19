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
// Every part ends with the leak scan of what it saw (phase 6's leak check and frame.js's vendor scan).
//   NODE_PATH=$(npm root -g) node aml-record.js [--only record,export]
// The last line is "AML RECORD: PASS (parts run: N)" or "AML RECORD: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const F = require('./frame.js');
const Lib = F.Lib;

const SHOTS = path.join(Lib.OUT, 'aml-record-shots');
fs.mkdirSync(SHOTS, { recursive: true });
Lib.describeShots([
  ['record-page.png', 'The AML program page at 1280x800 with typed values, the compiled procedures and the screening log.'],
  ['export-file.png', 'The exported AML program record opened on its own, as a bank or auditor would see it.']
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
    scripts: document.querySelectorAll('script').length,
    outside: Array.from(document.querySelectorAll('[src], link[href]')).map((x) => x.getAttribute('src') || x.getAttribute('href'))
  }));
  await v.screenshot({ path: path.join(SHOTS, 'export-file.png'), fullPage: true }).catch(() => {});
  await v.close();
  return Object.assign({ name: d.suggestedFilename(), text }, read);
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
  }
};

Lib.runParts(parts, { name: 'AML RECORD', unit: 'parts', flag: '--only', browser: true });
