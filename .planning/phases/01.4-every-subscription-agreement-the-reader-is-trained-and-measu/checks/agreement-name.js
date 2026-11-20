#!/usr/bin/env node
/*
 * D-11 (owner, phase 6, verbatim: "The name of the file should have nothing to do with anything"). With no reading server
 * (the published preview), the intake ("Set up from documents") and the offering's agreement dialog decide which uploaded
 * PDF is the subscription agreement, and for a combined document which pages are, from what the pages say. The file name
 * may be shown; it never decides. Each part below runs the same bytes under several names, misspelt, generic and
 * misleading ones included, and requires the same result every time.
 *
 *   node agreement-name.js [--only gone,intake,memo,combined,dialog | all]
 *
 *   gone      the file-name rule is gone (NS.intake.agreementName is not defined)
 *   intake    a fresh firm, no reading server: the first agreement uploaded through the intake under the names
 *             "Offering_Subscrpition_Agreement.pdf", "Document.pdf", "PPM_-_Fund_LLC.pdf" and
 *             "Fund_Subscription_Agreement.pdf" ends as the offering's agreement (saved, or a draft) every time, with the
 *             same number of fields every time
 *   memo      a public PPM (RockStep Hometown America Fund I) uploaded under the name "Fund_Subscription_Agreement.pdf":
 *             no agreement, no draft and no background reading is made
 *   combined  the RockStep PPM with the public hedge-fund subscription agreement template after it (pages 70 to 87, the
 *             part combined input of intake-server.js) uploaded as "Document.pdf" and as "Subscription_Agreement.pdf":
 *             each time the agreement is found on pages 70 to 87 and read in the background into an agreement with fields,
 *             the same number both times
 *   dialog    the offering's agreement dialog with one stored PDF on the offering: the first agreement under the names
 *             "PPM_-_Fund_LLC.pdf" and "Document.pdf" is pre-selected; the RockStep PPM under the name
 *             "Fund_Subscription_Agreement.pdf" leaves "None" selected; the combined PDF under the name "Document.pdf" is
 *             pre-selected, the dialog says pages 70 to 87, and continuing makes a draft of exactly those 18 pages
 *
 * The first agreement lives outside the repository (SCRATCH/real-agreement/agreement.pdf, or EXAMPLE_PDF); the public PDFs
 * in SCRATCH/public-agreements. A missing harness or document prints "NOT RUN: (what)" and the exit status is 2. Output
 * holds counts, page numbers and invented file names only, never document text. One line per check; last line
 * "AGREEMENT NAME: PASS" or "AGREEMENT NAME: FAIL - <parts>".
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.NAME_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const FIRST = process.env.EXAMPLE_PDF || path.join(SCRATCH, 'real-agreement/agreement.pdf');
const PUB = path.join(process.env.INTAKE_SCRATCH || SCRATCH, 'public-agreements');
const ROCKSTEP = path.join(PUB, 'PPM_RockStep_Hometown_America_Fund_I/doc.pdf');
const HEDGE = path.join(PUB, 'Subscription_Hedge_Fund_Template/doc.pdf');
const COMBINED = path.join(SCRATCH, 'edgar/measure/out-71/combined.pdf');
const RANGE = [70, 87];
const HARNESS = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/harness.js');
const ALL = ['gone', 'intake', 'memo', 'combined', 'dialog'];
const i = process.argv.indexOf('--only');
const want = i > 0 && process.argv[i + 1] ? process.argv[i + 1].split(',').map((s) => s.trim()) : ['all'];
const PARTS = want.includes('all') ? ALL : want;
const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
PARTS.forEach((p) => ALL.includes(p) || notRun(`--only ${p} is not a part (${ALL.join(', ')})`));
if (!fs.existsSync(HARNESS)) notRun('the check browser is missing (' + HARNESS + ')');
if ((PARTS.includes('intake') || PARTS.includes('dialog')) && !fs.existsSync(FIRST)) notRun('the first agreement is missing (' + FIRST + ')');
if (PARTS.some((p) => ['memo', 'combined', 'dialog'].includes(p))) [ROCKSTEP, HEDGE].forEach((f) => fs.existsSync(f) || notRun('the public PDF ' + f + ' is missing'));
if ((PARTS.includes('combined') || PARTS.includes('dialog')) && !fs.existsSync(COMBINED)) {
  try {
    fs.mkdirSync(path.dirname(COMBINED), { recursive: true });
    execFileSync('pdfunite', [ROCKSTEP, HEDGE, COMBINED], { stdio: 'ignore' });
  } catch (e) {
    notRun('the combined PDF could not be made (pdfunite)');
  }
}
try {
  require.resolve('playwright');
} catch (e) {
  process.env.NODE_PATH = [execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  require('module').Module._initPaths();
}
const H = require(HARNESS);

const fails = new Set();
const errors = [];
/** fn(h) in a browser of its own (a fresh firm signs up in each); its page errors are kept for the last line. */
async function own(fn) {
  const h = await H.start();
  try {
    return await fn(h);
  } finally {
    errors.push(...h.errors);
    await h.stop();
  }
}
const line = (part, ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${part} ${text}`);
  if (!ok) fails.add(part);
  return ok;
};

async function partGone() {
  const r = await own(async (h) => {
    const page = await H.signUp(h);
    const got = await page.evaluate(() => ({ intake: !!window.CVPortal.intake, rule: typeof window.CVPortal.intake.agreementName }));
    await page.close();
    return got;
  });
  line('gone', r.intake && r.rule === 'undefined', `NS.intake.agreementName is ${r.rule === 'undefined' ? 'not defined' : 'still defined (a ' + r.rule + ')'}`);
}

/**
 * The intake on a fresh firm (no reading server) with `file` uploaded under `name`; what the new offering holds once the
 * done step shows and any background reading of an agreement found inside the PDF has ended.
 */
async function intakeAs(file, name) {
  return own(async (h) => {
    const page = await H.signUp(h, 'Kestrel Bay Capital');
    await page.evaluate(() => (location.hash = 'console-intake'));
    await page.waitForSelector('#ik-files');
    await page.setInputFiles('#ik-files', { name, mimeType: 'application/pdf', buffer: fs.readFileSync(file) });
    await page.waitForSelector('[data-action=ik-read]:not([disabled])');
    await page.click('[data-action=ik-read]');
    await page.waitForSelector('[data-action=ik-apply]', { timeout: 180000 });
    const before = await page.evaluate(() => window.CVPortal.state.ws.offerings.map((o) => o.id));
    await page.click('[data-action=ik-apply]');
    await page.waitForFunction(() => window.CVPortal.state.ws && document.querySelector('[data-action=ik-restart]') && /is set up/.test(document.body.innerText), null, { timeout: 300000 });
    const oid = await page.evaluate((old) => (window.CVPortal.state.ws.offerings.find((x) => old.indexOf(x.id) < 0) || {}).id || '', before);
    // A background reading (an agreement found inside the PDF) is awaited to its end.
    await page.waitForFunction((id) => {
      const r = window.CVPortal.intake.agreementReading ? window.CVPortal.intake.agreementReading(id) : null;
      return !r || r.state !== 'reading';
    }, oid, { timeout: 900000, polling: 1000 });
    const r = await page.evaluate((id) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === id);
      if (!o) return { offering: false };
      const tpl = NS.esign.subscriptionTemplate(ws, o.id);
      const draft = (ws.envelopes || []).find((e) => e.agreementFor === o.id && e.status === 'draft');
      const bg = NS.intake.agreementReading ? NS.intake.agreementReading(o.id) : null;
      return {
        offering: true,
        saved: !!tpl,
        draft: !!draft,
        fields: tpl ? (tpl.fields || []).length : draft ? draft.fields.length : 0,
        pages: tpl ? tpl.pages : draft ? draft.pages : 0,
        bg: bg ? { state: bg.state, firstPage: bg.firstPage, lastPage: bg.lastPage } : null
      };
    }, oid);
    await page.close();
    return r;
  });
}
const held = (r) => (r.saved ? 'saved' : r.draft ? 'drafted' : 'NONE');

async function partIntake() {
  const names = ['Offering_Subscrpition_Agreement.pdf', 'Document.pdf', 'PPM_-_Fund_LLC.pdf', 'Fund_Subscription_Agreement.pdf'];
  const got = [];
  for (const name of names) {
    const r = await intakeAs(FIRST, name);
    got.push(r);
    line('intake', r.offering && (r.saved || r.draft) && r.fields > 0, `the first agreement as "${name}": offering ${r.offering ? 'made' : 'missing'}, agreement ${held(r)}, ${r.fields} fields, ${r.pages} pages`);
  }
  const same = got.every((r) => r.fields === got[0].fields && r.pages === got[0].pages && held(r) === held(got[0]));
  line('intake', same, `the same result under all ${names.length} names: ${same ? 'yes' : 'no'} (${got.map((r) => `${held(r)} ${r.fields}`).join(', ')})`);
}

async function partMemo() {
  const r = await intakeAs(ROCKSTEP, 'Fund_Subscription_Agreement.pdf');
  line('memo', r.offering && !r.saved && !r.draft && !r.bg, `a PPM named "Fund_Subscription_Agreement.pdf": offering ${r.offering ? 'made' : 'missing'}, agreement ${r.saved ? 'saved (wrong)' : r.draft ? 'drafted (wrong)' : 'none'}, background reading ${r.bg ? 'started (wrong)' : 'none'}`);
}

async function partCombined() {
  const got = [];
  for (const name of ['Document.pdf', 'Subscription_Agreement.pdf']) {
    const r = await intakeAs(COMBINED, name);
    got.push(r);
    const found = r.bg ? `pages ${r.bg.firstPage} to ${r.bg.lastPage} (${r.bg.state})` : 'nothing';
    line('combined', !!r.bg && r.bg.firstPage === RANGE[0] && r.bg.lastPage === RANGE[1] && r.bg.state === 'done' && (r.saved || r.draft) && r.fields > 0 && r.pages === RANGE[1] - RANGE[0] + 1, `the PPM with the agreement inside as "${name}": found ${found}, agreement ${held(r)}, ${r.fields} fields on ${r.pages} pages (expected pages ${RANGE[0]} to ${RANGE[1]})`);
  }
  line('combined', got[0].fields === got[1].fields && got[0].pages === got[1].pages, `the same result under both names: ${got[0].fields === got[1].fields && got[0].pages === got[1].pages ? 'yes' : 'no'}`);
}

/**
 * The agreement dialog of a fresh offering holding one stored PDF (`file`) named `name`; the select once the dialog has
 * read the stored document (the select's data-read is "done"), and the dialog's text about pages.
 */
async function dialogWith(file, name, submit) {
  return own(async (h) => {
    const page = await H.signUp(h, 'Kestrel Bay Capital');
    const oid = await page.evaluate(
      async ({ fileName, arr }) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const o = ws.offerings[ws.offerings.length - 1];
        const blob = new Blob([new Uint8Array(arr)], { type: 'application/pdf' });
        await NS.ops.files.put('doc-name-check', blob);
        ws.docs = ws.docs || [];
        ws.docs.push({ id: 'doc-name-check', title: fileName.replace(/\.[a-z0-9]+$/i, '').replace(/_+/g, ' '), fileName, type: 'application/pdf', size: blob.size, sha256: '', cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: '2026-11-17', taxYear: '', offeringDoc: true, hidden: true });
        NS.app.save(true);
        return o.id;
      },
      { fileName: name, arr: Array.from(fs.readFileSync(file)) }
    );
    await page.evaluate((id) => (location.hash = 'console-offering-' + id), oid);
    await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${oid}"]`);
    await page.click(`[data-action="es-agreement-new"][data-offering="${oid}"]`);
    await page.waitForSelector('#dlg[open] form[data-form="es-agreement"]');
    const read = await page
      .waitForFunction(() => {
        const sel = document.querySelector('#es-agr-doc');
        return !!sel && sel.dataset.read === 'done';
      }, null, { timeout: 180000, polling: 500 })
      .then(() => true, () => false);
    const r = await page.evaluate(() => {
      const sel = document.querySelector('#es-agr-doc');
      const form = document.querySelector('form[data-form="es-agreement"]');
      const m = form ? /pages (\d+) to (\d+)/.exec(form.innerText) : null;
      return sel ? { listed: sel.options.length - 1, selected: sel.value, pages: m ? [+m[1], +m[2]] : null } : { listed: 0, selected: '', pages: null };
    });
    r.read = read;
    if (submit && r.selected) {
      const before = await page.evaluate(() => (window.CVPortal.state.ws.envelopes || []).map((e) => e.id));
      await page.click('form[data-form="es-agreement"] button[type=submit]');
      r.draftPages = await page
        .waitForFunction((old) => {
          const e = (window.CVPortal.state.ws.envelopes || []).find((x) => old.indexOf(x.id) < 0 && x.agreementFor);
          return e ? e.pages : 0;
        }, before, { timeout: 600000, polling: 1000 })
        .then((x) => x.jsonValue(), () => 0);
    }
    await page.close();
    return r;
  });
}

async function partDialog() {
  for (const name of ['PPM_-_Fund_LLC.pdf', 'Document.pdf']) {
    const r = await dialogWith(FIRST, name);
    line('dialog', r.read && r.listed === 1 && r.selected === 'doc-name-check', `the first agreement stored as "${name}": read ${r.read ? 'done' : 'NOT DONE'}, listed ${r.listed}, ${r.selected === 'doc-name-check' ? 'pre-selected' : '"None" selected'}`);
  }
  const memo = await dialogWith(ROCKSTEP, 'Fund_Subscription_Agreement.pdf');
  line('dialog', memo.read && memo.listed === 1 && memo.selected === '', `a PPM stored as "Fund_Subscription_Agreement.pdf": read ${memo.read ? 'done' : 'NOT DONE'}, listed ${memo.listed}, ${memo.selected ? 'pre-selected (wrong)' : '"None" selected'}`);
  const both = await dialogWith(COMBINED, 'Document.pdf', true);
  const ok = both.read && both.selected === 'doc-name-check' && !!both.pages && both.pages[0] === RANGE[0] && both.pages[1] === RANGE[1];
  line('dialog', ok, `the PPM with the agreement inside stored as "Document.pdf": read ${both.read ? 'done' : 'NOT DONE'}, ${both.selected ? 'pre-selected' : '"None" selected'}, the dialog says ${both.pages ? `pages ${both.pages[0]} to ${both.pages[1]}` : 'no pages'} (expected ${RANGE[0]} to ${RANGE[1]})`);
  line('dialog', both.draftPages === RANGE[1] - RANGE[0] + 1, `continuing makes a draft of ${both.draftPages || 0} pages (expected ${RANGE[1] - RANGE[0] + 1})`);
}

(async () => {
  try {
    if (PARTS.includes('gone')) await partGone();
    if (PARTS.includes('intake')) await partIntake();
    if (PARTS.includes('memo')) await partMemo();
    if (PARTS.includes('combined')) await partCombined();
    if (PARTS.includes('dialog')) await partDialog();
  } catch (e) {
    line('run', false, String((e && e.stack) || e).slice(0, 600));
  }
  line('errors', errors.length === 0, `${errors.length} page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ').slice(0, 300) : ''}`);
  console.log(fails.size ? `AGREEMENT NAME: FAIL - ${Array.from(fails).join(', ')}` : 'AGREEMENT NAME: PASS');
  process.exit(fails.size ? 1 : 0);
})();
