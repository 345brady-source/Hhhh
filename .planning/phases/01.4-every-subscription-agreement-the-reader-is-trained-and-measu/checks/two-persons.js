#!/usr/bin/env node
/*
 * D-30 (the owner's decision): two people only, the investor and the sponsor; no investor field is required to finish
 * signing, signatures included; what the portal already holds is filled in for the investor and stays editable.
 * Through the real upload screen and the real signing step of onboarding.
 *
 *   node two-persons.js [--only persons,optional,autofill | all]
 *
 *   persons   the first agreement and document C, each chosen in the offering's agreement dialog with Continue pressed:
 *             every field is the investor's or the firm's (no co-investor field, no field for somebody else, no
 *             second-signer line), and the field count and every field's page, box and type are as before D-30
 *   optional  the first agreement saved as the offering's agreement, an investor invited and walked through onboarding
 *             to it: the guide asks for nothing, and the investor finishes with every investor field they can empty
 *             left empty and no signature; the firm's signature line is still required of the firm
 *   autofill  on the same signing step, before finishing: every investor field the portal holds an answer for shows
 *             that investor's answer, is not read-only and takes an edit; every blank without an answer is empty
 *             and editable
 *
 * The documents live outside the repository (TWO_SCRATCH, or the session's folder under the system temp folder). A
 * missing document prints "NOT RUN: (what)" and the exit status is 2. Output holds counts only, never document text.
 * One line per check; last line "TWO PERSONS: PASS" or "TWO PERSONS: FAIL - <parts>"; exit 0 or 1.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.TWO_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const FIRST = process.env.EXAMPLE_PDF || path.join(SCRATCH, 'real-agreement/agreement.pdf');
const DOC_C = process.env.DOC_C_PDF || path.join(SCRATCH, 'owner-set/doc-c.pdf');
const HARNESS = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/harness.js');
const FLOW = path.join(ROOT, '.planning/phases/04-signing-inside-onboarding/checks/lib.js');
// What the reader placed before D-30, measured on the unchanged reader (field count, and the sha256 of every field's
// page, type and box, sorted): D-30 changes whose field it is and whether it is required, never a place.
const BEFORE = {
  first: { fields: 47, places: '64d41c889c478037' },
  C: { fields: 138, places: '67119a776026e055' }
};
const ALL = ['persons', 'optional', 'autofill'];
const i = process.argv.indexOf('--only');
const want = i > 0 && process.argv[i + 1] ? process.argv[i + 1].split(',').map((s) => s.trim()) : ['all'];
const PARTS = want.includes('all') ? ALL : want;
const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
PARTS.forEach((p) => ALL.includes(p) || notRun(`--only ${p} is not a part (${ALL.join(', ')})`));
if (!fs.existsSync(HARNESS)) notRun('the check browser is missing (' + HARNESS + ')');
if (!fs.existsSync(FLOW)) notRun('the onboarding walk is missing (' + FLOW + ')');
if (!fs.existsSync(FIRST)) notRun('the first agreement is missing (' + FIRST + ')');
if (PARTS.includes('persons') && !fs.existsSync(DOC_C)) notRun('document C is missing (' + DOC_C + ')');
try {
  require.resolve('playwright');
} catch (e) {
  process.env.NODE_PATH = [execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  require('module').Module._initPaths();
}
process.env.SIGN_OUT = process.env.SIGN_OUT || path.join(os.tmpdir(), 'two-persons');
const H = require(HARNESS);
const F = require(FLOW);

const fails = new Set();
const line = (part, ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${part} ${text}`);
  if (!ok) fails.add(part);
  return ok;
};
const INV = { name: 'Morgan Blake', email: 'morgan.blake@example.org' };

/** Whose each field of the open envelope is, its places' fingerprint, and the counts. */
const roles = (page) =>
  page.evaluate(() => {
    const NS = window.CVPortal;
    const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param) || NS.state.ws.envelopes[NS.state.ws.envelopes.length - 1];
    const sg = (id) => env.signers.find((s) => s.id === id) || {};
    const c = { fields: env.fields.length, investor: 0, firm: 0, co: 0, other: 0, second: 0, unknown: 0, investorRequired: 0, firmRequired: 0, marked: 0 };
    const rows = [];
    env.fields.forEach((f) => {
      const s = sg(f.signerId);
      const placed = (f.placed && f.placed.role) || '';
      if (s.co || placed === 'co') c.co++;
      if (NS.placement.isOther(f)) c.other++;
      if (f.second) c.second++;
      if (s.role === 'countersigner') c.firm++;
      else if (s.role === 'investor' && !s.co) c.investor++;
      if (!(placed === 'investor' || placed === 'firm')) c.unknown++;
      if (f.required && s.role === 'countersigner') c.firmRequired++;
      if (f.required && s.role === 'investor') c.investorRequired++;
      if (f.review) c.marked++;
      rows.push([f.page, f.type, f.x.toFixed(4), f.y.toFixed(4), f.w.toFixed(4), f.h.toFixed(4)].join('|'));
    });
    return { c, rows: rows.sort(), read: { firmPages: (env.read && env.read.firmPages) || [], investorPages: (env.read && env.read.investorPages) || [] } };
  });
const sha = (rows) => crypto.createHash('sha256').update(rows.join('\n')).digest('hex').slice(0, 16);

/** The file chosen in the agreement dialog of a fresh firm's offering and Continue pressed; the editor's envelope. */
async function uploadFresh(h, file) {
  const page = await H.signUp(h);
  page.on('pageerror', (e) => h.errors.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const offId = await page.evaluate(() => {
    const ws = window.CVPortal.state.ws;
    return ws.offerings[ws.offerings.length - 1].id;
  });
  await choose(page, offId, file);
  const r = await roles(page);
  await page.close();
  return r;
}
async function choose(page, offId, file) {
  await page.evaluate((id) => (location.hash = 'console-offering-' + id), offId);
  await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${offId}"]`);
  await page.click(`[data-action="es-agreement-new"][data-offering="${offId}"]`);
  await page.waitForSelector('#dlg[open] #es-agr-file');
  await page.setInputFiles('#es-agr-file', { name: 'Agreement.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(file) });
  await page.click('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
  await page.waitForFunction(() => /^#console-envelope-/.test(location.hash), null, { timeout: 300000 });
  await page.waitForSelector('.es-editor .es-fld', { timeout: 60000 });
  await page.waitForTimeout(400);
}

function personsLines(name, r) {
  const b = BEFORE[name];
  const print = sha(r.rows);
  line('persons', r.c.co === 0 && r.c.other === 0 && r.c.second === 0 && r.c.unknown === 0 && r.c.investor + r.c.firm === r.c.fields, `${name}: every field is the investor's or the firm's: ${r.c.investor} investor, ${r.c.firm} firm, ${r.c.co} co-investor, ${r.c.other} somebody else's, ${r.c.second} second-signer lines, ${r.c.unknown} with no reader person (wanted 0, 0, 0, 0)`);
  line('persons', r.c.investorRequired === 0, `${name}: ${r.c.investorRequired} investor fields required (wanted 0); ${r.c.firmRequired} firm fields required`);
  line('persons', r.c.fields === b.fields && (!b.places || print === b.places), `${name}: ${r.c.fields} fields (wanted ${b.fields || '(not given)'}); places ${print} (wanted ${b.places || '(not given)'}); marked ${r.c.marked}; investor signature pages ${r.read.investorPages.length}, firm ${r.read.firmPages.length}`);
}

/** The investor's own fields on the signing step, as the page shows them. */
const mine = (p) =>
  p.evaluate(() => {
    const NS = window.CVPortal;
    const bar = document.querySelector('.sf-bar');
    const env = NS.esignKit.env(bar.getAttribute('data-id'));
    const s = NS.esignKit.signer(env, bar.getAttribute('data-sid'));
    const inv = NS.state.ws.investors.find((x) => x.id === s.investorId) || {};
    const held = NS.placement.values(inv, null, {});
    return {
      envId: env.id,
      held,
      fields: NS.esignKit.fieldsOf(env, s).map((f) => {
        const el = document.querySelector(`.es-doc-sign [data-fid="${f.id}"]`);
        const input = el && (el.matches('input') ? el : el.querySelector('input'));
        return { id: f.id, type: f.type, key: f.prefill || '', printed: f.printed || '', req: NS.esignKit.isReq(f, env), onPage: !!el, shown: input ? (input.type === 'checkbox' ? (input.checked ? 'x' : '') : input.value) : '', readOnly: input ? input.readOnly || input.disabled : null };
      })
    };
  });
const guide = (p) =>
  p.evaluate(() => {
    const b = document.querySelector('.sf-bar');
    if (!b) return null;
    const count = b.querySelector('.sf-count strong').textContent;
    const m = count.match(/^(\d+) of (\d+) left$/);
    return { count, left: m ? Number(m[1]) : count === 'Ready to finish' ? 0 : -1 };
  });

async function signing(h) {
  const page = await h.context.newPage();
  page.on('pageerror', (e) => h.errors.push(String(e)));
  await page.goto(h.base + '/diy.html');
  await page.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]');
  await page.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await page.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay');
  const off = await page.evaluate(async () => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    let o = ws.offerings.find((x) => x.status === 'Raising');
    if (!o) {
      o = ws.offerings[0];
      o.status = 'Raising';
    }
    o.structure = Object.assign({}, o.structure, { exemption: 'Rule 506(c)' });
    o.minimum = 50000;
    NS.integrations.ensure(ws).configured = true;
    await NS.ops.files.put('doc-ppm-two', new Blob(['%PDF-1.4 test memorandum'], { type: 'application/pdf' }));
    ws.docs = ws.docs || [];
    ws.docs.push({ id: 'doc-ppm-two', title: 'Private placement memorandum', fileName: 'PPM.pdf', type: 'application/pdf', size: 24, sha256: '', cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: NS.dates.today(), taxYear: '', publishedAt: new Date().toISOString(), publishedBy: 'test', offeringDoc: true, hidden: false });
    ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== o.id);
    NS.app.save(true);
    return { id: o.id };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await choose(page, off.id, FIRST);
  // The sponsor settles any mark and saves, as a sponsor does.
  for (let k = 0; k < 60 && (await page.locator('.es-review button').count()); k++) {
    await page.click('.es-review button >> nth=0');
    await page.waitForSelector('[data-action="es-flag-ok"]');
    await page.click('[data-action="es-flag-ok"]');
    await page.waitForTimeout(120);
  }
  const todo = await page.evaluate(() => (document.querySelector('.es-todo') || {}).textContent || '');
  const saveable = (await page.locator('.es-ready').count()) === 1;
  line('optional', saveable, `the sponsor can save the agreement with every investor field optional${saveable ? '' : ' (the editor says: ' + todo.slice(0, 160) + ')'}`);
  if (!saveable) return page.close();
  await page.click('[data-action="es-agreement-save"]');
  await page.waitForFunction(() => /^#console-offering-/.test(location.hash));

  const inv = await F.createInvitation(page, { name: INV.name, email: INV.email, offeringId: off.id, cents: 7500000 });
  const p = await h.context.newPage();
  p.on('pageerror', (e) => h.errors.push(String(e)));
  await p.goto(`${h.base}/diy.html?tenant=${inv.tenant}#invite-${inv.token}`);
  const walk = await F.walkToAgreement(p, { name: INV.name });
  if (!line('optional', walk.reached, 'the investor reaches the agreement as a step of onboarding')) return;
  await p.waitForTimeout(600);
  const m = await mine(p);
  const text = m.fields.filter((f) => f.type === 'text');

  if (PARTS.includes('autofill')) {
    // Each held answer, as the blank shows it (a blank after a printed currency sign shows the figure alone).
    const want = (f) => {
      const v = f.key === 'amount' ? '$75,000' : m.held[f.key];
      return v == null ? null : f.printed === '$' ? String(v).replace(/^\s*(US)?\$\s*/i, '') : String(v);
    };
    const keyed = text.filter((f) => f.key && want(f) != null);
    const wrong = keyed.filter((f) => f.shown !== want(f) || f.readOnly !== false || !f.onPage);
    const keys = Array.from(new Set(keyed.map((f) => f.key)));
    line('autofill', keyed.length > 0 && !wrong.length, `${keyed.length} investor blanks the portal holds an answer for (keys ${keys.join(', ') || 'none'}) show this investor's answer and are editable; ${wrong.length} do not`);
    const open = text.filter((f) => !f.key || want(f) == null);
    const shut = open.filter((f) => f.shown !== '' || f.readOnly !== false);
    line('autofill', !shut.length, `${open.length} investor blanks with no answer held are empty and editable; ${shut.length} are not`);
    // An edit to a filled-in blank is taken (typed over, as the investor would).
    let took = false;
    if (keyed.length && keyed[0].readOnly === false) {
      const sel = `.es-doc-sign [data-fid="${keyed[0].id}"]`;
      const ctl = (await p.locator(`${sel} input`).count()) ? `${sel} input` : sel;
      await p.locator(ctl).scrollIntoViewIfNeeded();
      await p.locator(ctl).fill('Changed by the investor');
      await p.waitForTimeout(150);
      took = (await p.locator(ctl).inputValue()) === 'Changed by the investor' && (await p.evaluate(({ envId, fid }) => {
        const NS = window.CVPortal;
        const bar = document.querySelector('.sf-bar');
        const env = NS.esignKit.env(envId);
        return NS.esignKit.state(env, bar.getAttribute('data-sid')).vals[fid];
      }, { envId: m.envId, fid: keyed[0].id })) === 'Changed by the investor';
    }
    line('autofill', took, `a filled-in blank (${keyed.length ? keyed[0].key : 'none'}) takes the investor's edit`);
  }

  if (PARTS.includes('optional')) {
    const g = await guide(p);
    const req = m.fields.filter((f) => f.req);
    line('optional', req.length === 0 && g && g.left === 0, `the guide asks for nothing: ${req.length} of ${m.fields.length} investor fields required (wanted 0); the guide says "${g ? g.count : 'no guide'}"`);
    // Every blank the investor can empty is emptied; nothing is ticked, typed or signed.
    for (const f of text.filter((x) => x.readOnly === false && x.shown)) {
      const sel = `.es-doc-sign [data-fid="${f.id}"]`;
      const ctl = (await p.locator(`${sel} input`).count()) ? `${sel} input` : sel;
      await p.locator(ctl).scrollIntoViewIfNeeded();
      await p.locator(ctl).fill('');
    }
    await p.waitForTimeout(200);
    const left = (await mine(p)).fields.filter((f) => f.type === 'text' && f.shown).length;
    await p.click('.es-finish');
    const signed = await p
      .waitForFunction((id) => { const NS = window.CVPortal; const e = NS.esignKit.env(id); return e && e.signers.some((s) => s.investorId && s.status === 'signed'); }, m.envId, { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    const done = await p.evaluate((id) => {
      const NS = window.CVPortal;
      const env = NS.esignKit.env(id);
      const s = env.signers.find((x) => x.investorId);
      const cs = env.signers.find((x) => x.role === 'countersigner');
      const firmSig = cs ? env.fields.filter((f) => f.signerId === cs.id && f.type === 'signature' && !NS.placement.isOther(f)) : [];
      const st = cs ? NS.esignKit.state(env, cs.id) : null;
      const missing = cs ? NS.esignKit.missing(env, cs, st).map((f) => f.id) : [];
      return {
        signer: s.status,
        sigs: env.fields.filter((f) => f.signerId === s.id && (f.type === 'signature' || f.type === 'initials')).map((f) => !!f.value),
        nudge: (document.querySelector('.sf-hint.is-nudge') || {}).textContent || '',
        firmSig: firmSig.length,
        firmRequired: firmSig.filter((f) => missing.indexOf(f.id) >= 0).length,
        next: NS.esign.currentSigners(env).map((x) => x.role).join(',')
      };
    }, m.envId);
    line('optional', signed && done.signer === 'signed' && done.sigs.every((v) => !v), `the investor finishes with nothing ticked, typed or signed (${left} blanks still hold a value they could not empty; ${done.sigs.length} signature and initials fields, ${done.sigs.filter(Boolean).length} signed): signer ${done.signer}${done.nudge ? '; the guide says: ' + done.nudge.slice(0, 120) : ''}`);
    line('optional', done.firmSig > 0 && done.firmRequired === done.firmSig && done.next === 'countersigner', `the firm's signature line is still required of the firm: ${done.firmRequired} of ${done.firmSig} firm signature fields required; next to sign: ${done.next || 'nobody'}`);
  }
  await p.close();
  await page.close();
}

/** One run in a browser of its own (a fresh firm signs up in each), with its page errors said. */
async function own(name, fn) {
  const h = await H.start();
  try {
    await fn(h);
  } finally {
    line('errors', h.errors.length === 0, `${name}: no page errors (${h.errors.length}${h.errors.length ? ': ' + h.errors[0].slice(0, 160) : ''})`);
    await h.stop();
  }
}

(async () => {
  if (PARTS.includes('persons')) {
    await own('first', async (h) => personsLines('first', await uploadFresh(h, FIRST)));
    await own('C', async (h) => personsLines('C', await uploadFresh(h, DOC_C)));
  }
  if (PARTS.includes('optional') || PARTS.includes('autofill')) await own('signing', signing);
  console.log(fails.size ? `TWO PERSONS: FAIL - ${Array.from(fails).join(', ')}` : 'TWO PERSONS: PASS');
  process.exit(fails.size ? 1 : 0);
})().catch((e) => {
  console.error(e);
  console.log('TWO PERSONS: FAIL - crashed');
  process.exit(1);
});
