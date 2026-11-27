// gate: browser
// last "ACH FLOW: PASS (parts run: 5)"
// One file per payment on screen (plan 16-02: F-7, F-4's console part, F-6, F-8's record; C-02, C-05; phase 15 C-10), the
// way the owner sees it: the portal inside a sandboxed iframe that refuses every connection (phase 10's lib10), at
// 390x844 with touch and at 1280x800, on the Kestrel Bay sample with the page's clock on 19 November 2026 (a Thursday).
//   history-phone    a distribution for the next banking day: Generate three times writes nothing; Download records the
//                    file (file ID A, the bytes equal the record by trace and amount); Record distribution; the History's
//                    "ACH file" shows the record and no file text; Build again needs a reason and gives file ID B, whose
//                    download is recorded with the reason; a seeded sample run (no file record) is treated as paid (B4)
//   gating-desktop   a payment date set to 2026-12-25 (a Federal Reserve holiday) through the draft: a red check, Download
//                    and Copy disabled with the reason, and pressed through the action nothing leaves; an amber same-day
//                    file is not held
//   draft-desktop    a draft downloaded and not recorded, then drafted again for the same offering and date: the
//                    already-sent sentence and Download waiting for Build again; built again, both files go on the run
//   team-phone       a team member: Generate works, the preview shows accounts by their last four, no Download, Copy or
//                    Build again, and the actions refuse with the admin sentence
//   managed-desktop  index.html as Carrow & Vale staff: Download records the file and the History shows the record
// Every part: no request left the frame, no vendor name or forbidden word on screen (lib10.leak), no full bank account
// number on the page (for a person who may release the file, outside the file's own records, which they may read), and a
// way out on screen (lib10.wayOut). No file's text and no full account number is printed by this check.
//   NODE_PATH=$(npm root -g) node ach-flow.js [--only part1,part2]
// The last line is "ACH FLOW: PASS (parts run: N)" or "ACH FLOW: FAIL (parts run: N) - <failed parts>". The two marker
// lines above are read by the phase gate. Later phase 16 plans add parts; the last line then changes with them.
'use strict';
const path = require('path');
const fs = require('fs');
const T = require('../../10-investor-tax-documents-and-withholding/checks/lib10.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, 'ach-flow');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-sent\.png$/, 'Distributions, History "ACH file" on a paid run: the record of the file sent (file ID, who and when, each investor by account ending and trace), no second file.'],
  [/-again\.png$/, 'The same run after "Build again" with a reason: a second file, file ID B, marked built again.'],
  [/-paid\.png$/, 'History "ACH file" on a sample run recorded before file records: "recorded as paid", Download and Copy wait for Build again.'],
  [/-red\.png$/, 'A file dated on a Federal Reserve holiday: the red check, and Download and Copy disabled with the reason.'],
  [/-resent\.png$/, 'A new draft for an offering and date whose file was already downloaded: the already-sent sentence.'],
  [/-team\.png$/, 'A team member: the file preview with each account shown by its last four, no Download or Copy.'],
  [/-managed\.png$/, 'The managed console (index.html): the History shows the record of the file downloaded.']
]);

const TODAY = '2026-11-19';
const NEXT = '2026-11-20';
const REASON = 'The bank rejected the first file';
const ADMIN = 'Only an admin can download or copy a payment file.';
const RED = 'Fix the checks marked in red first.';
const longDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Open a view by its route and wait for something of it. */
async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 15000 });
  await fr.waitForTimeout(300);
}
/** On the Distributions page: a total amount for `day` on the default offering, typed the way a person does it. */
async function fillDraft(fr, dollars, day) {
  await go(fr, 'console-distributions', '[data-action=dist-record]');
  if (!(await fr.evaluate(() => !!document.getElementById('ds-total')))) await T.press(fr, 'input[name=ds-mode][value=total]');
  await fr.waitForSelector('#ds-total');
  await fr.fill('#ds-date', day);
  await fr.waitForFunction((day) => (document.getElementById('ds-date') || {}).value === day && !!document.getElementById('ds-total'), day);
  await fr.fill('#ds-total', dollars);
  await fr.waitForFunction(() => !document.querySelector('[data-action=dist-record]').disabled);
}
/** Press "Generate NACHA file" and wait for the draft's file. */
async function generate(fr) {
  await fr.evaluate(() => window.CVPortal.state.ui.dist && (window.CVPortal.state.ui.dist.file = null));
  await T.press(fr, '[data-action=nacha-build]');
  await fr.waitForFunction(() => !!(window.CVPortal.state.ui.dist && window.CVPortal.state.ui.dist.file), null, { timeout: 10000 }).catch(() => {});
  return fr.evaluate(() => {
    const f = window.CVPortal.state.ui.dist && window.CVPortal.state.ui.dist.file;
    return f ? { name: f.filename, modifier: f.modifier } : null;
  });
}
/** The workspace's file log and change log, as plain data (the change log made first: the sample seeds it on first use). */
const logs = (fr) =>
  fr.evaluate(() => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    const audit = NS.audit && NS.audit.ensureLog ? NS.audit.ensureLog(w) : w.audit || [];
    return { ach: JSON.parse(JSON.stringify(w.achLog || [])), audit: audit.map((e) => ({ action: e.action, detail: e.detail })) };
  });
/** Every full bank account number of the sample (investors and the settlement account), 6 digits or more. */
const accountsOf = (fr) =>
  fr.evaluate(() => {
    const w = window.CVPortal.state.ws;
    const out = w.investors.filter((i) => i.payment && i.payment.bank && i.payment.bank.account).map((i) => String(i.payment.bank.account).replace(/\s/g, ''));
    const off = w.tenant.ach && w.tenant.ach.offset;
    if (off && off.account) out.push(String(off.account).replace(/\s/g, ''));
    return out.filter((a) => a.length >= 6);
  });
/**
 * No full account number on the page. With inPreview false the file's own records (#nacha-text) and the field view of a
 * record are left out: a person who may release the file may read them (16-CONTEXT W5).
 */
async function noAccounts(check, fr, inPreview, label) {
  const accts = await accountsOf(fr);
  const text = await fr.evaluate((skip) => {
    const parts = [];
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      const el = n.parentElement;
      if (!el || el.closest('script, style')) continue;
      if (skip && el.closest('#nacha-text, .nacha-fields')) continue;
      parts.push(n.nodeValue);
    }
    return parts.join('\n');
  }, !inPreview);
  const found = accts.filter((a) => text.indexOf(a) >= 0).map((a) => 'ending ' + a.slice(-4));
  check(`${label}: no full bank account number on the page${inPreview ? '' : ' outside the file’s own records'} (${accts.length} known)`, accts.length > 0 && found.length === 0, found);
}
/** Press the draft file's Download; resolves to the bytes' investor entries { trace: cents } (or null, no download). */
async function download(A, fr) {
  const [dl] = await Promise.all([A.page.waitForEvent('download', { timeout: 15000 }).catch(() => null), T.press(fr, '[data-action=nacha-download]')]);
  if (!dl) return null;
  const file = await dl.path();
  const text = fs.readFileSync(file, 'latin1');
  await dl.delete().catch(() => {});
  const entries = {};
  text
    .split(/\r?\n/)
    .filter((l) => l[0] === '6' && l.slice(39, 54).trim() !== 'OFFSET')
    .forEach((l) => (entries[l.slice(79, 94)] = Number(l.slice(29, 39))));
  return { name: dl.suggestedFilename(), entries, n: Object.keys(entries).length };
}
const byTrace = (rec) => {
  const o = {};
  ((rec && rec.entries) || []).forEach((e) => (o[e.trace] = e.cents));
  return o;
};
/** The History's "ACH file" on a run. */
async function openRun(fr, runId) {
  await go(fr, 'console-distributions', '[data-action=dist-record]');
  if (await fr.locator('[data-action=hist-all]').count()) await T.press(fr, '[data-action=hist-all]');
  await T.press(fr, `[data-action=dist-load][data-id="${runId}"]`);
  await fr.waitForTimeout(400);
}
/** What the file section shows. */
const section = (fr) =>
  fr.evaluate(() => {
    const box = document.getElementById('ds-file');
    const btn = (a) => {
      const b = box && box.querySelector(`[data-action=${a}]`);
      return b ? (b.disabled ? 'disabled' : 'enabled') : 'none';
    };
    return {
      text: box ? box.innerText.replace(/\s+/g, ' ').trim() : '',
      download: btn('nacha-download'),
      copy: btn('nacha-copy'),
      again: btn('nacha-again'),
      fileText: !!(box && box.querySelector('#nacha-text')),
      red: box ? box.querySelectorAll('.cs-checks .is-bad').length : 0,
      amber: box ? box.querySelectorAll('.cs-checks .is-warn').length : 0
    };
  });
const toastText = (fr) => fr.evaluate(() => ((document.getElementById('toasts') || {}).innerText || '').trim());
const clearToasts = (fr) => fr.evaluate(() => {
  const el = document.getElementById('toasts');
  if (el) el.innerHTML = '';
});
/** The owner's screenshot: messages cleared and the file section scrolled into view. */
async function shot(A, fr, name) {
  await clearToasts(fr);
  await fr.evaluate(() => {
    const box = document.getElementById('ds-file');
    if (box && box.firstElementChild) box.scrollIntoView({ block: 'start' });
  });
  await fr.waitForTimeout(300);
  await A.page.screenshot({ path: path.join(OUT, name) });
}
/** Press Record distribution; resolves to the new run. */
async function pressRecord(fr) {
  const before = await fr.evaluate(() => window.CVPortal.state.ws.runs.map((r) => r.id));
  await T.press(fr, '[data-action=dist-record]');
  await fr.waitForTimeout(500);
  return fr.evaluate((before) => window.CVPortal.state.ws.runs.find((r) => before.indexOf(r.id) < 0) || null, before);
}
/** The checks every part ends with. */
async function finish(check, A, fr, inPreview) {
  await noAccounts(check, fr, inPreview, 'at the end');
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  await A.context.close();
}

const parts = {
  async 'history-phone'({ check, S }) {
    const { A, fr } = await T.framed(S, 'phone', { clock: TODAY });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await fillDraft(fr, '10000.00', NEXT);
    const start = await logs(fr);
    let g = null;
    for (let k = 0; k < 3; k++) g = await generate(fr);
    const after3 = await logs(fr);
    check('Generate NACHA file pressed three times builds the file (file ID A) and writes nothing to ws.achLog', !!g && g.modifier === 'A' && JSON.stringify(after3.ach) === JSON.stringify(start.ach), { g, before: start.ach.length, after: after3.ach.length });
    check('and no change-log entry (a preview is not an event)', after3.audit.length === start.audit.length, after3.audit.slice(start.audit.length).map((e) => e.action));
    const s0 = await section(fr);
    check('the new file can be downloaded and copied', s0.download === 'enabled' && s0.copy === 'enabled' && s0.again === 'none' && s0.red === 0, s0);
    const d1 = await download(A, fr);
    const l1 = await logs(fr);
    const r1 = l1.ach.filter((x) => x.kind === 'file')[0];
    check('Download leaves one file and records it with file ID A', !!d1 && !!r1 && l1.ach.length === start.ach.length + 1 && r1.modifier === 'A' && r1.how === 'download' && d1.name === r1.name, { got: !!d1, rec: r1 && { id: r1.id, modifier: r1.modifier } });
    check('the downloaded bytes equal the record’s entries by trace and amount', !!d1 && d1.n > 0 && JSON.stringify(d1.entries) === JSON.stringify(byTrace(r1)), d1 && { n: d1.n, rec: r1 && r1.entries.length });
    check('the record is kept by offering and payment date, by the signed-in person', !!r1 && r1.runId === '' && r1.draftKey.endsWith('|' + NEXT) && /admin/.test(r1.by), r1 && { draftKey: r1.draftKey, by: r1.by });
    const run = await pressRecord(fr);
    const l2 = await logs(fr);
    const r1b = l2.ach.find((x) => r1 && x.id === r1.id);
    check('Record distribution records the run and puts the file on it', !!run && !!r1b && r1b.runId === run.id, { run: run && run.id, runId: r1b && r1b.runId });
    await openRun(fr, run && run.id);
    const s1 = await section(fr);
    const last4 = (r1 ? r1.entries : []).map((e) => '••' + e.last4);
    check('the History’s "ACH file" shows the record: sent, by whom, file ID, and no file text', /was sent on/.test(s1.text) && s1.text.indexOf(longDay(TODAY)) >= 0 && !!r1 && s1.text.indexOf(r1.name) >= 0 && /File ID A/.test(s1.text) && !s1.fileText && s1.download === 'none', s1.text.slice(0, 300));
    check('each entry shows its account ending and trace', !!r1 && r1.entries.every((e) => s1.text.indexOf(e.trace) >= 0) && last4.every((x) => s1.text.indexOf(x) >= 0), last4.length);
    check('no new file is built for it', await fr.evaluate(() => !window.CVPortal.state.ui.dist.file));
    await shot(A, fr, 'phone-sent.png');
    await noAccounts(check, fr, true, 'the record');
    // Build again: refused with no reason, then built with one
    await T.press(fr, '[data-action=nacha-again]');
    await fr.waitForSelector('#nacha-again-why');
    const dlg = await fr.evaluate(() => {
      const t = document.getElementById('nacha-again-why');
      const box = t.closest('[role=dialog], dialog, .dlg') || document.body;
      return { label: (t.closest('label') || {}).innerText || '', max: t.maxLength, close: !!box.querySelector('[data-action=close-dialog][aria-label=Close]'), cancel: Array.from(box.querySelectorAll('[data-action=close-dialog]')).some((b) => b.innerText.trim() === 'Cancel') };
    });
    check('the dialog asks "Why is a second file needed?" (300 characters) and has Close and Cancel', /Why is a second file needed\?/.test(dlg.label) && dlg.max === 300 && dlg.close && dlg.cancel, dlg);
    await T.press(fr, '[data-action=nacha-again-go]');
    await fr.waitForTimeout(300);
    const empty = await fr.evaluate(() => {
      const t = document.getElementById('nacha-again-why');
      const err = t && t.closest('.dlg-body') && t.closest('.dlg-body').querySelector('.cs-error');
      return { open: !!t, err: err ? err.innerText.trim() : '', file: !!window.CVPortal.state.ui.dist.file };
    });
    check('Build again with an empty reason is refused: the dialog stays and says why, no file', empty.open && empty.err === 'Enter the reason a second file is needed.' && !empty.file, empty);
    await fr.fill('#nacha-again-why', REASON);
    await T.press(fr, '[data-action=nacha-again-go]');
    await fr.waitForFunction(() => !!window.CVPortal.state.ui.dist.file, null, { timeout: 10000 }).catch(() => {});
    const s2 = await section(fr);
    const f2 = await fr.evaluate(() => {
      const f = window.CVPortal.state.ui.dist.file;
      return f ? { modifier: f.modifier, again: f.again } : null;
    });
    check('with the reason a file with file ID B is built, marked built again, and may be downloaded', !!f2 && f2.modifier === 'B' && f2.again && f2.again.why === REASON && s2.download === 'enabled' && /Built again: The bank rejected the first file/.test(s2.text), { f2, s2: { d: s2.download, t: s2.text.slice(0, 160) } });
    await shot(A, fr, 'phone-again.png');
    const d2 = await download(A, fr);
    const l3 = await logs(fr);
    const r2 = l3.ach.filter((x) => x.kind === 'file').slice(-1)[0];
    check('its download is recorded on the run with the reason and the first file', !!d2 && !!r2 && r2 !== r1 && r2.modifier === 'B' && r2.runId === (run && run.id) && r2.again && r2.again.why === REASON && r2.again.of === (r1 && r1.id), r2 && { id: r2.id, modifier: r2.modifier, again: r2.again });
    check('the second file’s bytes equal its record', !!d2 && JSON.stringify(d2.entries) === JSON.stringify(byTrace(r2)));
    const files = l3.audit.slice(start.audit.length).filter((e) => /^NACHA file/.test(e.action));
    const accts = await accountsOf(fr);
    check('the change log has "NACHA file downloaded" twice, the second built again with the reason', files.length === 2 && files.every((e) => e.action === 'NACHA file downloaded') && /file ID A/.test(files[0].detail) && /file ID B/.test(files[1].detail) && files[1].detail.indexOf('built again: ' + REASON) >= 0, files);
    check('neither change-log entry nor the file log holds a full account number', !accts.some((a) => JSON.stringify(files).indexOf(a) >= 0 || JSON.stringify(l3.ach).indexOf(a) >= 0));
    // 16-CONTEXT B4: a sample run recorded before file records existed is treated as paid
    await openRun(fr, 'kb-fund-ii-2026-09-24');
    const s3 = await section(fr);
    check('B4: a seeded run with no file record says it is recorded as paid; Download and Copy wait; Build again is offered', s3.text.indexOf(`This distribution is recorded as paid on ${longDay('2026-09-24')}. A second upload pays every investor twice.`) >= 0 && s3.download === 'disabled' && s3.copy === 'disabled' && s3.again === 'enabled', s3);
    const before = (await logs(fr)).ach.length;
    await clearToasts(fr);
    await fr.evaluate(() => window.CVPortal.actions['nacha-download']());
    await fr.waitForTimeout(300);
    const msg = await toastText(fr);
    check('B4: pressed through the action, nothing leaves and nothing is recorded', (await logs(fr)).ach.length === before && /recorded as paid|Fix the checks/.test(msg), msg);
    await shot(A, fr, 'phone-paid.png');
    await finish(check, A, fr, false);
  },

  async 'gating-desktop'({ check, S }) {
    const { A, fr } = await T.framed(S, 'desktop', { clock: TODAY });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await fillDraft(fr, '5000.00', NEXT);
    const g = await generate(fr);
    check('a file is generated for the next banking day', !!g, g);
    // the payment date moved to Christmas Day through the draft's state, and the file built again from it
    await fr.evaluate(() => {
      const NS = window.CVPortal;
      NS.state.ui.dist.date = '2026-12-25';
      NS.actions['nacha-build']();
    });
    await fr.waitForTimeout(400);
    const s = await section(fr);
    check('dated 2026-12-25 (a Federal Reserve holiday) the file shows a red check', s.red > 0 && /holiday/i.test(s.text), s.text.slice(0, 300));
    check('Download and Copy are disabled with "Fix the checks marked in red first."', s.download === 'disabled' && s.copy === 'disabled' && s.text.indexOf(RED) >= 0, s);
    await shot(A, fr, 'desktop-red.png');
    const before = await logs(fr);
    let downloads = 0;
    A.page.on('download', () => downloads++);
    for (const act of ['nacha-download', 'nacha-copy']) {
      await clearToasts(fr);
      await fr.evaluate((a) => window.CVPortal.actions[a](), act);
      await fr.waitForTimeout(400);
      const msg = await toastText(fr);
      check(`${act} pressed through the action is refused with the reason`, msg === RED, msg);
    }
    const after = await logs(fr);
    check('nothing left: no download, no record, no change-log entry', downloads === 0 && after.ach.length === before.ach.length && after.audit.length === before.audit.length, { downloads, ach: after.ach.length - before.ach.length, audit: after.audit.length - before.audit.length });
    // an amber warning does not hold the file: a same-day file
    await fillDraft(fr, '5000.00', TODAY);
    await generate(fr);
    const a = await section(fr);
    check('a same-day file (amber) has no red check and may be downloaded and copied', a.amber > 0 && a.red === 0 && a.download === 'enabled' && a.copy === 'enabled' && a.text.indexOf(RED) < 0, a);
    await finish(check, A, fr, false);
  },

  async 'draft-desktop'({ check, S }) {
    const { A, fr } = await T.framed(S, 'desktop', { clock: TODAY });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await fillDraft(fr, '7500.00', NEXT);
    await generate(fr);
    const d1 = await download(A, fr);
    const r1 = (await logs(fr)).ach.filter((x) => x.kind === 'file')[0];
    check('a draft’s file is downloaded and recorded with no run', !!d1 && !!r1 && r1.runId === '', r1 && { runId: r1.runId, draftKey: r1.draftKey });
    // drafted again: a fresh draft for the same offering and date
    await fr.evaluate(() => (window.CVPortal.state.ui.dist = null));
    await go(fr, 'console', '#app');
    await fillDraft(fr, '7500.00', NEXT);
    const g = await generate(fr);
    const s = await section(fr);
    const want = `A file for this distribution was sent on ${longDay(TODAY)} (${r1 && r1.name}). A second upload pays every investor twice.`;
    check('the new draft opens with the already-sent sentence', s.text.indexOf(want) >= 0, s.text.slice(0, 300));
    check('its Download and Copy wait for Build again', s.download === 'disabled' && s.copy === 'disabled' && s.again === 'enabled', s);
    check('the preview takes the next free file ID (B) and writes nothing', !!g && g.modifier === 'B', g);
    await shot(A, fr, 'desktop-resent.png');
    const n = (await logs(fr)).ach.length;
    await clearToasts(fr);
    await fr.evaluate(() => window.CVPortal.actions['nacha-download']());
    await fr.waitForTimeout(300);
    const msg = await toastText(fr);
    check('pressed through the action it is refused with the sentence and nothing is recorded', msg === want && (await logs(fr)).ach.length === n, msg);
    // built again with a reason, downloaded, then recorded: both files go on the run
    await T.press(fr, '[data-action=nacha-again]');
    await fr.waitForSelector('#nacha-again-why');
    await fr.fill('#nacha-again-why', 'The first file was uploaded to the wrong account');
    await T.press(fr, '[data-action=nacha-again-go]');
    await fr.waitForFunction(() => !!window.CVPortal.state.ui.dist.file, null, { timeout: 10000 }).catch(() => {});
    const d2 = await download(A, fr);
    const r2 = (await logs(fr)).ach.filter((x) => x.kind === 'file').slice(-1)[0];
    check('built again, its download is recorded with the reason and the first file', !!d2 && !!r2 && r2.again && r2.again.of === (r1 && r1.id) && r2.modifier === 'B', r2 && r2.again);
    const run = await pressRecord(fr);
    const all = (await logs(fr)).ach.filter((x) => x.kind === 'file');
    check('Record distribution puts both files on the new run', !!run && all.length === 2 && all.every((x) => x.runId === run.id), all.map((x) => x.runId));
    await finish(check, A, fr, false);
  },

  async 'team-phone'({ check, S }) {
    const { A, fr } = await T.framed(S, 'phone', { clock: TODAY });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'team' });
    await fillDraft(fr, '10000.00', NEXT);
    const g = await generate(fr);
    const s = await section(fr);
    check('a team member can generate the file and read its preview', !!g && s.fileText, { g, fileText: s.fileText });
    check('no Download, Copy or Build again for a team member, with the admin sentence', s.download === 'none' && s.copy === 'none' && s.again === 'none' && s.text.indexOf(ADMIN) >= 0, s);
    const masked = await fr.evaluate(() => {
      const f = window.CVPortal.state.ui.dist.file;
      const shown = Array.from(document.querySelectorAll('#nacha-text .nl-6 .nl-t')).map((x) => x.textContent);
      const ends = f.lines.filter((l) => l[0] === '6').map((l) => l.slice(12, 29).trim().slice(-4));
      return { n: shown.length, all: shown.length === ends.length && shown.every((l, i) => /\*/.test(l.slice(12, 29)) && l.slice(12, 29).trim().endsWith(ends[i]) && l.length === 94) };
    });
    check('the preview shows each account by its last four (the rest masked), records still 94 characters', masked.n > 0 && masked.all, masked);
    await T.press(fr, '.nl-6');
    await fr.waitForTimeout(300);
    await noAccounts(check, fr, true, 'the preview and its field view');
    await shot(A, fr, 'phone-team.png');
    const before = await logs(fr);
    for (const act of ['nacha-download', 'nacha-copy', 'nacha-again']) {
      await clearToasts(fr);
      await fr.evaluate((a) => window.CVPortal.actions[a](), act);
      await fr.waitForTimeout(300);
      const msg = await toastText(fr);
      check(`${act} pressed through the action is refused with the admin sentence`, msg === ADMIN, msg);
    }
    const after = await logs(fr);
    check('nothing is recorded', after.ach.length === before.ach.length && after.audit.length === before.audit.length);
    // the History's "ACH file" on a seeded run: the notice, and no Build again for a team member
    await openRun(fr, 'kb-fund-ii-2026-09-24');
    const h = await section(fr);
    check('on a run recorded as paid the team member sees the notice and no Build again', /recorded as paid/.test(h.text) && h.again === 'none' && h.download === 'none', h);
    await finish(check, A, fr, true);
  },

  async 'managed-desktop'({ check, S }) {
    const { A, fr } = await T.framed(S, 'desktop', { page: 'index.html', clock: TODAY });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'staff' });
    await fillDraft(fr, '10000.00', NEXT);
    const start = await logs(fr);
    await generate(fr);
    check('Generate writes nothing in the managed edition too', JSON.stringify((await logs(fr)).ach) === JSON.stringify(start.ach));
    const d1 = await download(A, fr);
    const r1 = (await logs(fr)).ach.filter((x) => x.kind === 'file')[0];
    check('Download records the file (file ID A) and the bytes equal the record', !!d1 && !!r1 && r1.modifier === 'A' && JSON.stringify(d1.entries) === JSON.stringify(byTrace(r1)), r1 && r1.modifier);
    const run = await pressRecord(fr);
    await openRun(fr, run && run.id);
    const s = await section(fr);
    check('the History shows the record of the file sent, with Build again, and no second file', /was sent on/.test(s.text) && !!r1 && s.text.indexOf(r1.name) >= 0 && !s.fileText && s.again === 'enabled', s.text.slice(0, 300));
    await shot(A, fr, 'desktop-managed.png');
    await noAccounts(check, fr, false, 'at the end');
    await T.wayOut(check, fr);
    // the managed edition is Carrow & Vale's own console, so its name is on screen by design; any other name is not
    const text = await fr.evaluate(() => document.body.innerText);
    const hits = text.split('\n').map((l) => l.replace(/Carrow\s*&\s*Vale/gi, '')).filter((l) => Lib.VENDORS.test(l) || Lib.VENDOR_RE.test(l) || Lib.WORD_RE.test(l));
    check('no vendor, model or library name other than the managed firm’s own, and no forbidden word, on screen', hits.length === 0, hits.map((l) => l.trim().slice(0, 160)));
    await T.quiet(check, A, fr);
    await A.context.close();
  }
};

// What a failed check prints never holds a long number from the page (a company ID, a trace, an account): runs of nine or
// more digits are cut to their last four.
const scrub = (x) => (x === undefined ? x : (typeof x === 'string' ? x : JSON.stringify(x)).replace(/\d{9,}/g, (m) => '…' + m.slice(-4)));
Object.keys(parts).forEach((k) => {
  const fn = parts[k];
  parts[k] = (ctx) => fn(Object.assign({}, ctx, { check: (name, ok, info) => ctx.check(name, ok, scrub(info)) }));
});

Lib.runParts(parts, { name: 'ACH FLOW', unit: 'parts', flag: '--only', browser: true });
