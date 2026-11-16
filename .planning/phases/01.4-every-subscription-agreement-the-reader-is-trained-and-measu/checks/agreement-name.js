#!/usr/bin/env node
/*
 * Debug session preview-wont-read-agreement (owner, 2026-11-16: "It's broken, it won't read this"). With no reading server
 * (the published preview), a subscription agreement uploaded through "Set up from documents" becomes the offering's
 * agreement only when its name reads as one (intake.js agreementDoc), and the offering's agreement dialog pre-selects
 * only a document whose name reads as one. A misspelled name ("Subscrpition") or "..._Sub_Docs" fell through: the
 * agreement was never read and the dialog offered "None". One shared name rule now decides both.
 *
 *   node agreement-name.js [--only names,intake,dialog | all]
 *
 *   names   the shared rule (NS.intake.agreementName) on file names: misspelled, abbreviated and underscored names of
 *           subscription documents read as one; a memorandum, an operating or partnership agreement, a tax form, a
 *           substitute form, a subordination or sublease agreement and a neutral name do not
 *   intake  a fresh firm, no reading server: the first agreement uploaded through the intake under a misspelled name
 *           ends as the offering's agreement (saved, or a draft) with fields; under the correct spelling the same
 *           (control: only the name differs); under a memorandum's name no agreement is made (unchanged)
 *   dialog  the offering's agreement dialog with one document on the offering: a misspelled name and a "_Sub_Docs" name
 *           are pre-selected; a memorandum and an operating agreement leave "None" selected (unchanged)
 *
 * The first agreement lives outside the repository (SCRATCH/real-agreement/agreement.pdf, or EXAMPLE_PDF). A missing
 * harness or document prints "NOT RUN: (what)" and the exit status is 2. Output holds counts and invented file names
 * only, never document text. One line per check; last line "AGREEMENT NAME: PASS" or "AGREEMENT NAME: FAIL - <parts>".
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.NAME_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const FIRST = process.env.EXAMPLE_PDF || path.join(SCRATCH, 'real-agreement/agreement.pdf');
const HARNESS = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/harness.js');
const ALL = ['names', 'intake', 'dialog'];
const i = process.argv.indexOf('--only');
const want = i > 0 && process.argv[i + 1] ? process.argv[i + 1].split(',').map((s) => s.trim()) : ['all'];
const PARTS = want.includes('all') ? ALL : want;
const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
PARTS.forEach((p) => ALL.includes(p) || notRun(`--only ${p} is not a part (${ALL.join(', ')})`));
if (!fs.existsSync(HARNESS)) notRun('the check browser is missing (' + HARNESS + ')');
if (PARTS.includes('intake') && !fs.existsSync(FIRST)) notRun('the first agreement is missing (' + FIRST + ')');
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

const READS_AS_AGREEMENT = ['Offering_Subscrpition_Agreement.pdf', 'Fund_Subscription_Agreement.pdf', 'E_-_Fund_Sub_Docs.pdf', 'Sub_Docs_final.pdf', 'Subscriber Questionnaire.pdf', 'Fund II - Subscription Booklet.pdf', 'SubDocs.pdf', 'Fund_Sub_Agreement_v2.pdf', 'Reg_A_Subscription_Packet.pdf', 'FundSubscription.pdf'];
const NOT_AN_AGREEMENT = ['PPM_-_Fund_LLC.pdf', 'Operating_Agreement.pdf', 'Limited_Partnership_Agreement.pdf', 'Financial_Statements_2024.pdf', 'fw9.pdf', 'Document.pdf', 'Substitute_Form_W-9.pdf', 'Subordination_Agreement.pdf', 'Sublease_Agreement.pdf', 'Club_Docs.pdf', 'Unsubscribe_Form.pdf'];

async function partNames() {
  const r = await own(async (h) => {
    const page = await H.signUp(h);
    const got = await page.evaluate(
      ([yes, no]) => {
        const rule = window.CVPortal.intake && window.CVPortal.intake.agreementName;
        if (!(rule instanceof RegExp)) return null;
        return { yes: yes.filter((n) => !rule.test(n)), no: no.filter((n) => rule.test(n)), global: rule.global || rule.sticky };
      },
      [READS_AS_AGREEMENT, NOT_AN_AGREEMENT]
    );
    await page.close();
    return got;
  });
  if (!line('names', !!r, `NS.intake.agreementName is ${r ? 'a regular expression' : 'missing'}`)) return;
  line('names', !r.global, `the rule keeps no state between tests (no g or y flag)`);
  line('names', r.yes.length === 0, `${READS_AS_AGREEMENT.length - r.yes.length}/${READS_AS_AGREEMENT.length} subscription-document names read as one${r.yes.length ? '; missed: ' + r.yes.join(', ') : ''}`);
  line('names', r.no.length === 0, `${NOT_AN_AGREEMENT.length - r.no.length}/${NOT_AN_AGREEMENT.length} other names do not${r.no.length ? '; taken: ' + r.no.join(', ') : ''}`);
}

/** The intake on a fresh firm (no reading server) with the first agreement under `name`; what the new offering holds. */
async function intakeAs(name) {
  return own(async (h) => {
    const page = await H.signUp(h, 'Kestrel Bay Capital');
    await page.evaluate(() => (location.hash = 'console-intake'));
    await page.waitForSelector('#ik-files');
    await page.setInputFiles('#ik-files', { name, mimeType: 'application/pdf', buffer: fs.readFileSync(FIRST) });
    await page.waitForSelector('[data-action=ik-read]:not([disabled])');
    await page.click('[data-action=ik-read]');
    await page.waitForSelector('[data-action=ik-apply]', { timeout: 120000 });
    const before = await page.evaluate(() => window.CVPortal.state.ws.offerings.map((o) => o.id));
    await page.click('[data-action=ik-apply]');
    await page.waitForFunction(() => window.CVPortal.state.ws && document.querySelector('[data-action=ik-restart]') && /is set up/.test(document.body.innerText), null, { timeout: 180000 });
    const r = await page.evaluate((old) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => old.indexOf(x.id) < 0);
      if (!o) return { offering: false };
      const tpl = NS.esign.subscriptionTemplate(ws, o.id);
      const draft = (ws.envelopes || []).find((e) => e.agreementFor === o.id && e.status === 'draft');
      return { offering: true, saved: !!tpl, draft: !!draft, fields: tpl ? (tpl.fields || []).length : draft ? draft.fields.length : 0, server: draft && draft.read && draft.read.server ? draft.read.server.why : '' };
    }, before);
    await page.close();
    return r;
  });
}

async function partIntake() {
  const typo = await intakeAs('Offering_Subscrpition_Agreement.pdf');
  line('intake', typo.offering && (typo.saved || typo.draft) && typo.fields > 0, `misspelled name "Offering_Subscrpition_Agreement.pdf": offering ${typo.offering ? 'made' : 'missing'}, agreement ${typo.saved ? 'saved' : typo.draft ? 'drafted' : 'NONE'}, ${typo.fields} fields`);
  const right = await intakeAs('Offering_Subscription_Agreement.pdf');
  line('intake', right.offering && (right.saved || right.draft) && right.fields > 0 && right.fields === typo.fields, `control "Offering_Subscription_Agreement.pdf": agreement ${right.saved ? 'saved' : right.draft ? 'drafted' : 'NONE'}, ${right.fields} fields (equal to the misspelled upload's: ${right.fields === typo.fields ? 'yes' : 'no'})`);
  const memo = await intakeAs('Offering_Memorandum.pdf');
  line('intake', memo.offering && !memo.saved && !memo.draft, `a memorandum's name "Offering_Memorandum.pdf": agreement ${memo.saved ? 'saved (wrong)' : memo.draft ? 'drafted (wrong)' : 'none, as before'}`);
}

/** The agreement dialog of a fresh offering holding one PDF document named `name`; the select's options. */
async function dialogWith(name) {
  return own(async (h) => {
    const page = await H.signUp(h, 'Kestrel Bay Capital');
    const oid = await page.evaluate((fileName) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings[ws.offerings.length - 1];
      ws.docs = ws.docs || [];
      ws.docs.push({ id: 'doc-name-check', title: fileName.replace(/\.[a-z0-9]+$/i, '').replace(/_+/g, ' '), fileName, type: 'application/pdf', size: 1000, sha256: '', cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: '2026-11-16', taxYear: '', offeringDoc: true, hidden: true });
      NS.app.save(true);
      return o.id;
    }, name);
    await page.evaluate((id) => (location.hash = 'console-offering-' + id), oid);
    await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${oid}"]`);
    await page.click(`[data-action="es-agreement-new"][data-offering="${oid}"]`);
    await page.waitForSelector('#dlg[open] form[data-form="es-agreement"]');
    const r = await page.evaluate(() => {
      const sel = document.querySelector('#es-agr-doc');
      return sel ? { listed: sel.options.length - 1, selected: sel.value } : { listed: 0, selected: '' };
  });
  await page.close();
  return r;
  });
}

async function partDialog() {
  for (const name of ['Offering_Subscrpition_Agreement.pdf', 'E_-_Fund_Sub_Docs.pdf']) {
    const r = await dialogWith(name);
    line('dialog', r.listed === 1 && r.selected === 'doc-name-check', `"${name}" on the offering: listed ${r.listed}, ${r.selected === 'doc-name-check' ? 'pre-selected' : '"None" selected'}`);
  }
  for (const name of ['PPM_-_Fund_LLC.pdf', 'Operating_Agreement.pdf']) {
    const r = await dialogWith(name);
    line('dialog', r.listed === 1 && r.selected === '', `"${name}" on the offering: listed ${r.listed}, ${r.selected ? 'pre-selected (wrong)' : '"None" selected, as before'}`);
  }
}

(async () => {
  try {
    if (PARTS.includes('names')) await partNames();
    if (PARTS.includes('intake')) await partIntake();
    if (PARTS.includes('dialog')) await partDialog();
  } catch (e) {
    line('run', false, String((e && e.stack) || e).slice(0, 600));
  }
  line('errors', errors.length === 0, `${errors.length} page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ').slice(0, 300) : ''}`);
  console.log(fails.size ? `AGREEMENT NAME: FAIL - ${Array.from(fails).join(', ')}` : 'AGREEMENT NAME: PASS');
  process.exit(fails.size ? 1 : 0);
})();
