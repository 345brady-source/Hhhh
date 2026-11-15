#!/usr/bin/env node
/*
 * The picture notice of D-28, through the real upload screen.
 *
 *   node picture-notice.js [--only picture,text | all]
 *
 *   picture  the owner's picture form chosen in the offering's agreement dialog and Continue pressed, as a sponsor does:
 *            the reading note in the editor carries the notice sentence once; the 241 fields are placed as before
 *   text     the first agreement (a PDF with text) uploaded the same way: the notice sentence is absent; its 47 fields
 *            are placed as before, none marked
 *
 * The documents live outside the repository (PICTURE_SCRATCH, or the session's folder under the system temp folder).
 * A missing document prints "NOT RUN: (what)" and the exit status is 2. Output holds counts only. One line per part;
 * last line "PICTURE NOTICE: PASS" or "PICTURE NOTICE: FAIL"; exit 0 or 1.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const PICTURE = process.env.PRINTED_PDF || path.join(SCRATCH, 'xx/printed-no-text.pdf');
const TEXT = process.env.EXAMPLE_PDF || path.join(SCRATCH, 'real-agreement/agreement.pdf');
const HARNESS = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/harness.js');
const NOTICE = 'This document was read from page pictures, which is common when a document is printed to PDF. For better accuracy, upload a PDF with selectable text.';
const ALL = ['picture', 'text'];
const i = process.argv.indexOf('--only');
const want = i > 0 && process.argv[i + 1] ? process.argv[i + 1].split(',').map((s) => s.trim()) : ['all'];
const PARTS = want.includes('all') ? ALL : want;
const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
PARTS.forEach((p) => ALL.includes(p) || notRun(`--only ${p} is not a part (${ALL.join(', ')})`));
if (!fs.existsSync(HARNESS)) notRun('the check browser is missing (' + HARNESS + ')');
if (PARTS.includes('picture') && !fs.existsSync(PICTURE)) notRun("the owner's picture form is missing (" + PICTURE + ')');
if (PARTS.includes('text') && !fs.existsSync(TEXT)) notRun('the first agreement is missing (' + TEXT + ')');
try {
  require.resolve('playwright');
} catch (e) {
  process.env.NODE_PATH = [execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  require('module').Module._initPaths();
}
const H = require(HARNESS);

const fails = [];
const line = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) fails.push(text.split(' ')[0]);
  return ok;
};
const times = (hay, needle) => hay.split(needle).length - 1;

/** The file chosen in the offering's agreement dialog and Continue pressed; what the editor then shows. */
async function upload(h, file) {
  const page = await H.signUp(h);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const offId = await page.evaluate(() => {
    const ws = window.CVPortal.state.ws;
    return ws.offerings[ws.offerings.length - 1].id;
  });
  await page.evaluate((id) => (location.hash = 'console-offering-' + id), offId);
  await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${offId}"]`);
  await page.click(`[data-action="es-agreement-new"][data-offering="${offId}"]`);
  await page.waitForSelector('#dlg[open] #es-agr-file');
  await page.setInputFiles('#es-agr-file', { name: 'Agreement.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(file) });
  await page.click('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
  // A picture document is read from its pictures before the editor opens (D-13): up to the reader's three minutes.
  await page.waitForFunction(() => /^#console-envelope-/.test(location.hash), null, { timeout: 300000 });
  await page.waitForSelector('.es-read .es-agr-note', { timeout: 60000 });
  await page.waitForTimeout(400);
  const seen = await page.evaluate(() => {
    const NS = window.CVPortal;
    const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param) || NS.state.ws.envelopes[NS.state.ws.envelopes.length - 1];
    const note = document.querySelector('.es-read .es-agr-note');
    return { note: note ? note.textContent : '', fields: env.fields.length, marked: env.fields.filter((f) => f.review).length, pictured: ((env.read && env.read.pictured) || []).length };
  });
  await page.close();
  return seen;
}

(async () => {
  // Each part in a browser of its own (a fresh workspace each, as a sponsor's first upload).
  const run = async (part, check) => {
    if (!PARTS.includes(part)) return;
    const h = await H.start();
    try {
      await check(h);
    } catch (e) {
      line(false, `${part} run: ${String((e && e.message) || e).slice(0, 300)}`);
    } finally {
      await h.stop();
    }
  };
  await run('picture', async (h) => {
    const s = await upload(h, PICTURE);
    const n = times(s.note, NOTICE);
    line(n === 1 && s.fields === 241 && s.pictured > 0, `picture the reading note shows the notice ${n} time(s) (wanted 1); ${s.fields} fields (wanted 241); ${s.pictured} pages read from their picture`);
  });
  await run('text', async (h) => {
    const s = await upload(h, TEXT);
    const n = times(s.note, NOTICE);
    const loose = /read from page pictures|printed to PDF/.test(s.note);
    line(n === 0 && !loose && s.fields === 47 && s.marked === 0 && s.pictured === 0, `text the reading note shows the notice ${n} time(s) (wanted 0${loose ? '; part of it shown' : ''}); ${s.fields} fields (wanted 47), ${s.marked} marked (wanted 0)`);
  });
  console.log(fails.length ? `PICTURE NOTICE: FAIL - ${fails.join('; ')}` : 'PICTURE NOTICE: PASS');
  process.exit(fails.length ? 1 : 0);
})();
