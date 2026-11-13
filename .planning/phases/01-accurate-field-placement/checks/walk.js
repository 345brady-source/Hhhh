/*
 * The real flow, once, in the browser: a sponsor uploads a subscription agreement on an offering through the upload
 * dialog, the portal places the fields, the sponsor confirms the ones marked for review and saves; an investor is
 * invited, goes through onboarding (login, investor information, checks, tax form, bank details, subscription) and
 * reaches the agreement with the blanks onboarding can answer already filled in and locked and the rest fillable;
 * the investor completes it with the guide and finishes.
 *
 * Uses the sample firm of the self-serve edition and the onboarding walk of the Phase 4 checks.
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/walk.js
 * Screenshots go to PLACE_OUT (default: place-walk under the system temp folder).
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

const OUT = process.env.PLACE_OUT || path.join(os.tmpdir(), 'place-walk');
fs.mkdirSync(OUT, { recursive: true });
process.env.SIGN_OUT = process.env.SIGN_OUT || path.join(OUT, 'phase4');
const F = require('../../04-signing-inside-onboarding/checks/lib.js');
const H = require('./harness');
const { CSS, FIXTURES } = require('./fixtures');

let failed = 0;
let passed = 0;
const check = (name, ok, info) => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info !== undefined ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 1400) : ''}`);
};
const INV = { name: 'Morgan Blake', email: 'morgan.blake@example.org' };
const guide = (p) =>
  p.evaluate(() => {
    const b = document.querySelector('.sf-bar');
    if (!b) return null;
    const count = b.querySelector('.sf-count strong').textContent;
    const m = count.match(/^(\d+) of (\d+) left$/);
    return { count, left: m ? Number(m[1]) : count === 'Ready to finish' ? 0 : -1, total: m ? Number(m[2]) : 0, hint: b.querySelector('.sf-hint').textContent };
  });
const mine = (p) =>
  p.evaluate(() => {
    const NS = window.CVPortal;
    const bar = document.querySelector('.sf-bar');
    const env = NS.esignKit.env(bar.getAttribute('data-id'));
    const s = NS.esignKit.signer(env, bar.getAttribute('data-sid'));
    return {
      envId: env.id,
      group: env.investorGroup,
      firm: env.fields.filter((f) => f.signerId !== s.id).length,
      fields: NS.esignKit.fieldsOf(env, s).map((f) => {
        const el = document.querySelector(`.es-doc-sign [data-fid="${f.id}"]`);
        const input = el && (el.matches('input') ? el : el.querySelector('input'));
        return { id: f.id, type: f.type, page: f.page, label: f.label || '', key: f.prefill || '', forType: f.forType || '', value: f.value, locked: !!f.locked, req: NS.esignKit.isReq(f), onPage: !!el, shown: input ? input.value : '', readOnly: input ? input.readOnly || input.disabled : null };
      })
    };
  });

(async () => {
  const h = await H.start();
  try {
    /* ---- The sponsor: sample firm, an offering that is raising ---- */
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
      await NS.ops.files.put('doc-ppm-walk', new Blob(['%PDF-1.4 test memorandum'], { type: 'application/pdf' }));
      ws.docs = ws.docs || [];
      ws.docs.push({ id: 'doc-ppm-walk', title: 'Private placement memorandum', fileName: 'PPM.pdf', type: 'application/pdf', size: 24, sha256: '', cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: NS.dates.today(), taxYear: '', publishedAt: new Date().toISOString(), publishedBy: 'test', offeringDoc: true, hidden: false });
      ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== o.id);
      NS.app.save(true);
      return { id: o.id, name: o.name, firm: ws.tenant.name, ready: NS.esign.templateReady(ws, o.id) };
    });
    check('the offering starts with no subscription agreement', off.ready === false, off);

    /* ---- Upload through the dialog on the offering page ---- */
    const html = FIXTURES.full.html.replace(/NORTHGATE FUND I, LP/g, off.name.toUpperCase()).replace(/Northgate Capital GP, LLC/g, `${off.firm} GP, LLC`);
    const made = await H.makePdf(h, CSS, html);
    await page.evaluate((id) => (location.hash = 'console-offering-' + id), off.id);
    await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${off.id}"]`);
    await page.click(`[data-action="es-agreement-new"][data-offering="${off.id}"]`);
    await page.waitForSelector('#dlg[open] #es-agr-file');
    await page.screenshot({ path: path.join(OUT, '1-upload-dialog.png') });
    await page.setInputFiles('#es-agr-file', { name: 'Subscription_Agreement.pdf', mimeType: 'application/pdf', buffer: Buffer.from(made.bytes) });
    const t0 = Date.now();
    await page.click('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
    await page.waitForFunction(() => /^#console-envelope-/.test(location.hash), null, { timeout: 60000 });
    const took = Date.now() - t0;
    await page.waitForSelector('.es-editor .es-fld', { timeout: 30000 });
    await page.waitForTimeout(500);
    const ed = await page.evaluate(() => {
      const NS = window.CVPortal;
      const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param);
      const role = (id) => env.signers.find((s) => s.id === id).role;
      return { fields: env.fields.length, investor: env.fields.filter((f) => role(f.signerId) === 'investor').length, firm: env.fields.filter((f) => role(f.signerId) === 'countersigner').length, marks: NS.placement.reviewCount(env), kinds: env.fields.reduce((a, f) => ((a[f.type] = (a[f.type] || 0) + 1), a), {}), high: env.fields.filter((f) => f.confidence === 'high').length, note: document.querySelector('.es-agr-note').textContent };
    });
    console.log(`  (reading the 5-page agreement and placing ${ed.fields} fields took ${took} ms)`);
    check('the portal placed every field of the agreement: 36, for the investor and the firm', ed.fields === 36 && ed.investor === 33 && ed.firm === 3, ed);
    check('each kind of field: signatures, initials, names, dates, blanks and tick boxes', ed.kinds.signature === 3 && ed.kinds.initials === 6 && ed.kinds.checkbox === 7 && ed.kinds.name === 3 && ed.kinds.date === 2 && ed.kinds.text === 15, ed.kinds);
    check('two fields are marked for review and the editor says so', ed.marks === 2 && ed.high === 34 && /36 fields were placed for you from the blanks in the PDF\. 2 are marked Review/.test(ed.note), ed);
    await page.screenshot({ path: path.join(OUT, '2-editor-review.png') });

    /* ---- The sponsor confirms each marked field, then saves ---- */
    for (let i = 0; i < 2; i++) {
      await page.click('.es-review button >> nth=0');
      await page.waitForSelector('[data-action="es-flag-ok"]');
      if (i === 0) await page.screenshot({ path: path.join(OUT, '3-editor-confirm.png') });
      await page.click('[data-action="es-flag-ok"]');
      await page.waitForTimeout(150);
    }
    check('with both confirmed the editor is ready to save', (await page.locator('.es-ready').count()) === 1 && (await page.locator('.es-review').count()) === 0);
    await page.click('[data-action="es-agreement-save"]');
    await page.waitForFunction(() => /^#console-offering-/.test(location.hash));
    await page.waitForSelector('.es-agr-panel');
    const panel = await page.locator('.es-agr-panel').innerText();
    check('the offering shows the agreement as ready, with what is filled in for the investor', /Ready/.test(panel) && /investor name, address, city, state, zip code, email, phone, commitment amount filled in for them/.test(panel) && (await page.evaluate((id) => window.CVPortal.esign.templateReady(window.CVPortal.state.ws, id), off.id)), panel);
    await page.screenshot({ path: path.join(OUT, '4-offering-ready.png') });

    /* ---- An investor is invited and goes through onboarding ---- */
    const inv = await F.createInvitation(page, { name: INV.name, email: INV.email, offeringId: off.id, cents: 7500000 });
    const p = await h.context.newPage();
    p.on('pageerror', (e) => h.errors.push(String(e)));
    await p.goto(`${h.base}/diy.html?tenant=${inv.tenant}#invite-${inv.token}`);
    const walk = await F.walkToAgreement(p, { name: INV.name });
    check('the investor reaches the agreement as a step of onboarding', walk.reached, walk.seen);
    await p.waitForTimeout(600);
    const m = await mine(p);
    const by = (label) => m.fields.find((f) => f.label === label) || {};
    const given = (label, value) => by(label).value === value && by(label).locked && by(label).shown === value && by(label).readOnly === true;
    check('filled in and locked from onboarding: name, street, city, state, ZIP, email, phone, commitment', given('Investor name', 'Morgan Blake') && given('Address', '12 Elm Street') && given('City', 'Austin') && given('State', 'TX') && given('ZIP code', '78701') && given('Email', INV.email) && given('Phone', '+1 512 555 0101') && given('Commitment amount', '$75,000'), m.fields.filter((f) => f.type === 'text'));
    const open = ['Taxpayer ID', 'Date of birth', 'Address line 2'];
    check('left for the investor: taxpayer ID, date of birth, second address line, all fillable', open.every((l) => by(l).onPage && by(l).value === '' && !by(l).locked && by(l).readOnly === false), open.map(by));
    check('the investor is an individual: the block for individuals, none of the block for entities', m.group === 'person' && m.fields.some((f) => f.type === 'signature' && f.forType === 'person') && !m.fields.some((f) => f.forType === 'entity') && m.firm === 3, m.fields.map((f) => f.type + ':' + f.forType + ':p' + f.page));
    check('tick boxes and initials are left for the investor', m.fields.filter((f) => f.type === 'checkbox').length === 7 && m.fields.filter((f) => f.type === 'initials').length === 6 && m.fields.filter((f) => f.type === 'checkbox' || f.type === 'initials').every((f) => !f.value && !f.locked));
    const g0 = await guide(p);
    check('the guide counts only what is left to do', g0 && g0.left > 0 && g0.left === m.fields.filter((f) => f.req && !f.locked && f.type !== 'date' && !(f.type === 'name')).length, { g0, req: m.fields.filter((f) => f.req).map((f) => f.type + ':' + f.label + ':' + f.locked) });
    await p.screenshot({ path: path.join(OUT, '5-signing-step.png') });
    // A locked value cannot be changed; an open blank can be typed into.
    await p.locator(`.es-doc-sign [data-fid="${by('Email').id}"]`).focus();
    await p.keyboard.type('zzz');
    check('a locked value cannot be changed', (await p.locator(`.es-doc-sign [data-fid="${by('Email').id}"]`).inputValue()) === INV.email);

    /* ---- The investor completes the rest with the guide and finishes ---- */
    const values = { 'Taxpayer ID': '123-45-6789', 'Date of birth': '04/02/1980' };
    for (let i = 0; i < 40; i++) {
      const g = await guide(p);
      if (!g || g.left <= 0) break;
      await p.click('.sf-next');
      await p.waitForTimeout(200);
      const a = await p.evaluate(() => {
        const NS = window.CVPortal;
        const el = document.activeElement;
        const fid = el && el.getAttribute('data-fid');
        const bar = document.querySelector('.sf-bar');
        const env = NS.esignKit.env(bar.getAttribute('data-id'));
        const f = env.fields.find((x) => x.id === fid);
        return f ? { type: f.type, label: f.label || '' } : null;
      });
      if (!a) break;
      if (a.type === 'text' || a.type === 'name') await p.keyboard.type(values[a.label] || 'N/A');
      else if (a.type === 'checkbox') await p.keyboard.press('Space');
      else {
        await p.keyboard.press('Enter');
        await p.waitForTimeout(250);
        if (await p.evaluate(() => document.getElementById('dlg').open)) {
          await p.click('[data-action="es-adopt"]');
          await p.waitForFunction(() => !document.getElementById('dlg').open);
        }
        await p.waitForTimeout(300);
      }
    }
    const g1 = await guide(p);
    check('everything required is complete and the guide says so', g1 && g1.left === 0, g1);
    await p.screenshot({ path: path.join(OUT, '6-signing-ready.png') });
    await p.click('.es-finish');
    await p.waitForFunction((id) => { const NS = window.CVPortal; const e = NS.esignKit.env(id); return e && e.signers.some((s) => s.investorId && s.status === 'signed'); }, m.envId, { timeout: 30000 });
    const done = await p.evaluate((id) => {
      const NS = window.CVPortal;
      const env = NS.esignKit.env(id);
      const s = env.signers.find((x) => x.investorId);
      const v = (label) => (env.fields.find((f) => f.signerId === s.id && f.label === label) || {}).value;
      return { status: env.status, signer: s.status, tin: v('Taxpayer ID'), dob: v('Date of birth'), name: v('Investor name'), amount: v('Commitment amount'), street: v('Address'), sig: env.fields.filter((f) => f.signerId === s.id && f.type === 'signature').map((f) => !!f.value), next: currentRole(env) };
      function currentRole(e) {
        return NS.esign.currentSigners(e).map((x) => x.role).join(',');
      }
    }, m.envId);
    check('the investor’s signing is recorded with what was filled in for them and what they typed', done.signer === 'signed' && done.tin === '123-45-6789' && done.dob === '04/02/1980' && done.name === 'Morgan Blake' && done.amount === '$75,000' && done.street === '12 Elm Street' && done.sig.length === 1 && done.sig[0] === true, done);
    check('the agreement now waits for the firm’s countersignature', done.status === 'sent' && done.next === 'countersigner', done);
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, '7-after-signing.png') });
    check('no page errors', h.errors.length === 0, h.errors);
    console.log(`  screenshots: ${OUT}`);
  } finally {
    await h.stop();
  }
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
