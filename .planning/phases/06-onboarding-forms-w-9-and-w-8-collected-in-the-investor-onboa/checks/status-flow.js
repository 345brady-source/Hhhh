#!/usr/bin/env node
// The investor status step in the real invitation flow (phase 6, D-01, C-02, D-30), one part per case.
//   NODE_PATH=$(npm root -g) node status-flow.js [--only part1,part2]
// The last line is "STATUS FLOW: PASS (parts run: N)" or "STATUS FLOW: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const L = require('./lib.js');

const SHOTS = path.join(L.OUT, 'status-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const INV = { name: 'Dana Whitfield', email: 'dana.whitfield@example.com' };

/** The console's offering page, as a firm admin, in the same browser the investor used. */
async function consoleOffering(page, offeringId) {
  await page.evaluate((id) => (location.hash = 'console-offering-' + id), offeringId);
  await page.waitForTimeout(400);
  if (await page.locator('#demo-role').count()) {
    await page.selectOption('#demo-role', 'admin');
    await page.waitForTimeout(400);
    await page.evaluate((id) => (location.hash = 'console-offering-' + id), offeringId);
  }
  await page.waitForSelector('.cs-panel-head h2', { timeout: 20000 });
  await page.waitForTimeout(300);
}

/** The console's requests page (all requests), as a firm admin. */
async function consoleRequests(page) {
  await page.evaluate(() => (location.hash = 'console-requests'));
  await page.waitForTimeout(400);
  if (await page.locator('#demo-role').count()) {
    await page.selectOption('#demo-role', 'admin');
    await page.waitForTimeout(400);
    await page.evaluate(() => (location.hash = 'console-requests'));
  }
  await page.waitForSelector('[data-action=req-tab][data-t=all]', { timeout: 20000 });
  await page.click('[data-action=req-tab][data-t=all]');
  await page.waitForTimeout(300);
}

/**
 * The sponsor chooses the offering's exemption on the console offering page, with the page's own select (C-04). Returns
 * the value then stored on the offering and the options the select offers.
 */
async function chooseExemption(page, offeringId, value) {
  await consoleOffering(page, offeringId);
  await page.selectOption('#of-structure-exemption', value);
  await page.waitForTimeout(300);
  return page.evaluate((id) => {
    const o = window.CVPortal.state.ws.offerings.find((x) => x.id === id);
    const sel = document.getElementById('of-structure-exemption');
    return { stored: (o.structure || {}).exemption, options: sel ? Array.from(sel.options).map((x) => x.value) : [], selected: sel ? sel.value : '', hints: Array.from(document.querySelectorAll('#of-structure-exemption ~ .cs-hint, label[for="of-structure-exemption"] .cs-hint')).map((x) => x.innerText).join('\n') };
  }, offeringId);
}

/** The exemption field on the console offering page now on screen: the value selected, the options and its hints. */
const exemptionField = (page) =>
  page.evaluate(() => {
    const sel = document.getElementById('of-structure-exemption');
    const label = sel && sel.closest('label');
    return { selected: sel ? sel.value : '', options: sel ? Array.from(sel.options).map((x) => x.value) : [], hints: label ? Array.from(label.querySelectorAll('.cs-hint')).map((x) => x.innerText).join('\n') : '' };
  });

/** Regulation A figures on the status step, after "no": { kind, stIncome, stWorth, stRevenue, stAssets }. */
async function fillFigures(page, fig) {
  if (fig.kind) {
    await page.check(`input[name="ob-stRaKind"][value="${fig.kind}"]`);
    await page.waitForTimeout(200);
  }
  for (const k of ['stIncome', 'stWorth', 'stRevenue', 'stAssets']) if (fig[k] != null) await page.fill('#ob-' + k, String(fig[k]));
}

/**
 * A Regulation A case end to end: the sample portal, the exemption chosen with the console's select (o.direct: stored as
 * document intake would, without the select), o.before(page, off) for any set-up, the invitation (o.invite(page, off) for
 * an investor on file), o.afterInvite(page, off, inv), then the walk with o.acc / o.basis / o.figures / o.amount. R keeps
 * what the status and subscribe steps showed.
 */
async function regAFlow(S, o) {
  const A = await L.open(S);
  const p = A.page;
  const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
  let ex = null;
  if (o.direct) {
    await p.evaluate(
      ({ id, v }) => {
        const NS = window.CVPortal;
        const x = NS.state.ws.offerings.find((y) => y.id === id);
        x.structure = Object.assign({}, x.structure, { exemption: v });
        NS.app.save(true);
      },
      { id: off.offeringId, v: o.exemption }
    );
  } else ex = await chooseExemption(p, off.offeringId, o.exemption);
  if (o.before) await o.before(p, off);
  const inv = o.invite ? await o.invite(p, off) : await L.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 0 });
  if (o.afterInvite) await o.afterInvite(p, off, inv);
  await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
  const R = {};
  const tag = o.tag || 'regA';
  const w = await L.walk(p, {
    name: o.name || INV.name,
    acc: o.acc,
    basis: o.basis,
    amount: o.amount || 60000,
    onFilled: async (hd) => {
      if (hd === 'Investor status') {
        if (o.figures) await fillFigures(p, o.figures);
        R.kind = await p.evaluate(() => (document.querySelector('input[name="ob-stRaKind"]:checked') || {}).value || '');
        R.figFields = await p.locator('#ob-stIncome, #ob-stWorth, #ob-stRevenue, #ob-stAssets').count();
        R.fieldIds = await p.evaluate(() => Array.from(document.querySelectorAll('#ob-stIncome, #ob-stWorth, #ob-stRevenue, #ob-stAssets')).map((x) => x.id));
        R.limit = (await p.locator('#ra-limit').count()) ? await p.locator('#ra-limit').innerText() : null;
        R.accQ = await p.locator('input[name="ob-stAcc"]').count();
        R.planQ = await p.locator('input[name="ob-stPlan"]').count();
        R.status = await L.screenText(p);
        await p.screenshot({ path: path.join(SHOTS, `${tag}-status.png`), fullPage: true });
      }
      if (hd === 'Subscription') {
        R.raSub = (await p.locator('#ra-sub').count()) ? await p.locator('#ra-sub').innerText() : '';
        R.warn = (await p.locator('#ra-sub .wire-warn').count()) ? await p.locator('#ra-sub .wire-warn').innerText() : '';
        R.subAcc = await p.locator('#ob-subAcc').count();
        R.sub = await L.screenText(p);
        await p.screenshot({ path: path.join(SHOTS, `${tag}-subscribe.png`), fullPage: true });
      }
    }
  });
  return { A, p, off, inv, w, R, ex };
}

/** The Regulation A request flag's wording. */
const RA_FLAG = /Over the Regulation A Tier 2 limit: \$[\d,.]+ committed in this offering, limit \$[\d,.]+/;

/** The eligibility panel's text on the console offering page ('' when there is none). */
const eligibilityText = (page) =>
  page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.cs-panel')).find((x) => /^Investor eligibility$/.test((x.querySelector('.cs-panel-head h2') || {}).textContent || ''));
    return s ? s.innerText : '';
  });

/** The text of the console panel with the given title on the page now on screen ('' when there is none). */
const panelText = (page, title) =>
  page.evaluate((t) => {
    const s = Array.from(document.querySelectorAll('.cs-panel')).find((x) => ((x.querySelector('.cs-panel-head h2') || {}).textContent || '') === t);
    return s ? s.innerText : '';
  }, title);

/** The text of the requests table row for one request id ('' when not shown). */
const requestRow = (page, id) =>
  page.evaluate((rid) => {
    const b = document.querySelector(`[data-action=req-approve][data-id="${CSS.escape(rid)}"], [data-action=req-decline][data-id="${CSS.escape(rid)}"]`);
    const tr = b && b.closest('tr');
    return tr ? tr.innerText : '';
  }, id);

/** The agreement on screen: Finish (D-30: nothing on it is required), then the done summary's text. */
async function finishAgreement(page) {
  await page.waitForSelector('.es-finish', { timeout: 30000 });
  await page.click('.es-finish');
  await page.waitForSelector('.ivf-done .ivf-summary', { timeout: 30000 });
  await page.waitForTimeout(300);
  return page.locator('.ivf-done').innerText();
}

/** Back, step by step, until the given heading is on screen (at most eight steps). Returns whether it was reached. */
async function backTo(page, heading) {
  for (let k = 0; k < 8; k++) {
    if ((await L.heading(page)) === heading) return true;
    if (!(await page.locator('[data-action=ivf-back]').count())) return false;
    await page.click('[data-action=ivf-back]');
    await page.waitForTimeout(250);
  }
  return (await L.heading(page)) === heading;
}

/** The subscription request of one investor in one offering, with its change-log entries. */
const requestOf = (page, investorId, offeringId) =>
  page.evaluate(({ investorId, offeringId }) => {
    const ws = window.CVPortal.state.ws;
    const r = ws.requests.filter((x) => x.type === 'subscription' && x.investorId === investorId && x.offeringId === offeringId).pop();
    if (!r) return null;
    const i = ws.investors.find((x) => x.id === investorId) || {};
    const log = (ws.audit || []).filter((e) => e && (e.record === r.id || e.record === investorId)).map((e) => ({ action: e.action, record: e.record, detail: e.detail }));
    const IV = window.CVPortal.integrations;
    const acc = IV && IV.peek ? IV.peek(i).accreditation : null;
    return { id: r.id, status: r.status, qual: r.qual, log, accreditation: i.accreditation || null, verify: acc };
  }, { investorId, offeringId });

const NOTE_90 = /Counted for this offering only\. Offerings by the same issuer made within 90 days of each other may be treated as one offering/;
const NOTE_502B = /Rule 502\(b\)/;

/**
 * n investors on file who are not accredited, each with a subscription to the offering made through the operations
 * module (NS.ops.submitSubscription) and the status answers a 506(b) investor gives (qual.accredited false). Returns
 * the investor and request ids in order.
 */
const seedNonAccredited = (page, offeringId, n, prefix) =>
  page.evaluate(
    ({ offeringId, n, prefix }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === offeringId);
      const tpl = ws.investors[0];
      const out = [];
      for (let k = 0; k < n; k++) {
        const i = JSON.parse(JSON.stringify(tpl));
        i.id = `${prefix}-inv-${k + 1}`;
        i.title = i.contact = `Seeded Purchaser ${prefix.toUpperCase()}${k + 1}`;
        i.email = `${prefix}${k + 1}@example.com`;
        i.positions = [];
        if (i.onboarding) i.onboarding = Object.assign({}, i.onboarding, { flow: undefined });
        ws.investors.push(i);
        const r = NS.ops.submitSubscription(ws, i, o, { cents: 5000000, signature: i.contact });
        r.id = `${prefix}-req-${k + 1}`;
        r.qual = { regime: '506b', at: new Date().toISOString(), accredited: false, basis: '', sophistication: { experience: 'Years of private fund commitments', education: 'Accountant', rep: null } };
        out.push({ investorId: i.id, requestId: r.id });
      }
      NS.app.save(true);
      return out;
    },
    { offeringId, n, prefix }
  );

const parts = {
  /** A non-accredited investor subscribes to a Rule 506(b) offering; the sponsor sees 1 of 35. */
  async b506({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    check('the offering is Rule 506(b) with its agreement ready', off.ready && off.exemption === 'Rule 506(b)', off);
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 0 });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    const screens = {};
    const answers = {
      name: INV.name,
      acc: 'no',
      exp: 'Twelve years of private real estate and venture fund commitments',
      edu: 'Civil engineer, MBA',
      rep: 'yes',
      repName: 'Morgan Ellery',
      repFirm: 'Ellery Advisory Partners',
      amount: 60000,
      onFilled: async (hd) => {
        if (/^Investor status$|^Subscription$/.test(hd)) {
          screens[hd] = await L.screenText(p);
          await p.screenshot({ path: path.join(SHOTS, `b506-${hd.replace(/\W+/g, '-').toLowerCase()}.png`), fullPage: true });
        }
      }
    };
    const w = await L.walk(p, answers);
    check('the investor reaches the subscription agreement', w.reached, w.seen);
    check('the flow shows the Investor status step after identity verification', w.seen.some((s) => /\| Investor status$/.test(s)) && w.seen.findIndex((s) => /Investor status$/.test(s)) === w.seen.findIndex((s) => /Identity verification$/.test(s)) + 1, w.seen);
    check('no self-certified Accreditation step in a Rule 506(b) flow', !w.seen.some((s) => /\| Accreditation$/.test(s)), w.seen);
    check('no field error on any step', w.errors.length === 0, w.errors);
    const st = screens['Investor status'] || '';
    check('the status step asks the accredited question and the sophistication questions', /Is Dana Whitfield an accredited investor\?/.test(st) && /investment experience/i.test(st) && /education or profession/i.test(st) && /purchaser representative/i.test(st) && /Representative.s firm/.test(st), st.slice(0, 1200));
    check('the status step says any question may be left unanswered', /leave any question unanswered/i.test(st), st.slice(0, 600));
    const sub = screens.Subscription || '';
    check('the subscribe step states the account is not accredited (no forced accredited statement)', /is not an accredited investor/.test(sub) && !/Whitfield is an accredited investor/.test(sub), sub.slice(0, 1500));
    const leakSt = L.leakCheck(st);
    const leakSub = L.leakCheck(sub);
    check('white label: the status screen passes the leak check', leakSt.ok, leakSt.hits);
    check('white label: the subscribe screen passes the leak check', leakSub.ok, leakSub.hits);
    const req = await p.evaluate(({ invId, offId }) => {
      const ws = window.CVPortal.state.ws;
      const r = ws.requests.find((x) => x.type === 'subscription' && x.investorId === invId && x.offeringId === offId);
      const log = (ws.audit || []).filter((e) => e && e.action === 'Investor status answered' && e.record === invId).map((e) => e.detail);
      return r ? { status: r.status, qual: r.qual, log } : null;
    }, { invId: inv.investorId, offId: off.offeringId });
    const q = (req && req.qual) || {};
    const so = q.sophistication || {};
    check('request.qual carries regime 506b, accredited false and the time', !!req && q.regime === '506b' && q.accredited === false && /^\d{4}-\d{2}-\d{2}T/.test(q.at || ''), req);
    check('request.qual carries the sophistication answers', so.experience === answers.exp && so.education === answers.edu && !!so.rep && so.rep.name === answers.repName && so.rep.firm === answers.repFirm, q);
    check('the answer is in the change log under the investor (T-06-01)', !!req && req.log.some((d) => /Dana Whitfield: not an accredited investor/.test(d)), req && req.log);
    await consoleOffering(p, off.offeringId);
    const ct = await L.screenText(p);
    await p.screenshot({ path: path.join(SHOTS, 'b506-console-offering.png'), fullPage: true });
    check('the console offering page shows "Non-accredited purchasers: 1 of 35"', /Non-accredited purchasers: 1 of 35/.test(ct), ct.slice(0, 2000));
    check('the console offering page shows "1 more pending"', /\b1 more pending\b/.test(ct), ct.slice(0, 2000));
    check('the console offering page shows the "Offering details" panel', /Offering details/.test(ct), ct.slice(0, 800));
    const leakC = L.leakCheck(ct);
    check('white label: the console offering page passes the leak check (no vendor name, no form of the forbidden word)', leakC.ok, leakC.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * C-01: 35 purchasers who are not accredited are already counted; a 36th answering no is warned (no count, no names),
   * still subscribes, and the sponsor sees 36 of 35 with the red badge and the flag on the request. Declining one brings
   * the count to 35; a second subscription by a counted investor changes nothing.
   */
  async full({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    check('the offering is Rule 506(b) with its agreement ready', off.ready && off.exemption === 'Rule 506(b)', off);
    const seeded = await seedNonAccredited(p, off.offeringId, 35, 'na');
    check('35 subscriptions seeded through the operations module with qual.accredited false', seeded.length === 35);
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 0 });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    let warn = '';
    let st = '';
    let warnBeforeNo = null;
    const w = await L.walk(p, {
      name: INV.name,
      acc: 'no',
      exp: 'Eight years of private real estate commitments',
      edu: 'Physician',
      rep: 'no',
      amount: 60000,
      onStep: async (hd) => {
        if (hd === 'Investor status') warnBeforeNo = await p.locator('.ivf-form .wire-warn').count();
      },
      onFilled: async (hd) => {
        if (hd !== 'Investor status') return;
        warn = await p.locator('.ivf-form .wire-warn').innerText().catch(() => '');
        st = await L.screenText(p);
        await p.screenshot({ path: path.join(SHOTS, 'full-status-warning.png'), fullPage: true });
      }
    });
    check('the 36th investor reaches the subscription agreement', w.reached, w.seen);
    check('no field error on any step (the warning never blocks)', w.errors.length === 0, w.errors);
    check('no warning before the investor answers no', warnBeforeNo === 0, warnBeforeNo);
    check('the status step warns that the offering may already have as many non-accredited investors as it can accept', /may already have as many investors who are not accredited as it is able to accept/.test(warn) && /You can still subscribe/.test(warn) && /reviews every subscription/.test(warn), warn);
    check('the warning shows no number (T-06-04)', warn && !/\d/.test(warn), warn);
    check('the warning names no other investor (T-06-04)', warn && !/Seeded Purchaser/.test(st), st.slice(0, 1500));
    const leakSt = L.leakCheck(st);
    check('white label: the warning screen passes the leak check', leakSt.ok, leakSt.hits);
    const req = await p.evaluate(({ invId, offId }) => {
      const ws = window.CVPortal.state.ws;
      const r = ws.requests.find((x) => x.type === 'subscription' && x.investorId === invId && x.offeringId === offId);
      return r ? { id: r.id, status: r.status, qual: r.qual } : null;
    }, { invId: inv.investorId, offId: off.offeringId });
    check('the 36th subscription is made, pending, with qual.accredited false', !!req && req.status === 'pending' && req.qual && req.qual.accredited === false, req);

    await consoleOffering(p, off.offeringId);
    let el = await eligibilityText(p);
    await p.screenshot({ path: path.join(SHOTS, 'full-console-36.png'), fullPage: true });
    check('the panel shows "Non-accredited purchasers: 36 of 35"', /Non-accredited purchasers: 36 of 35/.test(el), el);
    check('the panel carries the red badge (over the limit)', (await p.locator('.cs-panel .cs-elig-count .cs-badge-bad').count()) === 1 && /Over the limit/.test(el), el);
    check('C-02: the panel carries the 90-day note', NOTE_90.test(el), el);
    check('C-02: with purchasers who are not accredited counted, the panel carries the Rule 502(b) reminder', NOTE_502B.test(el) && /disclosure and financial information/.test(el), el);
    const leakP = L.leakCheck(await L.screenText(p));
    check('white label: the console offering page passes the leak check', leakP.ok, leakP.hits);

    await consoleRequests(p);
    const row36 = req ? await requestRow(p, req.id) : '';
    await p.screenshot({ path: path.join(SHOTS, 'full-requests.png'), fullPage: true });
    check('the 36th request row carries the flag', /Would be non-accredited purchaser 36 of the 35 allowed under Rule 506\(b\)/.test(row36), row36);
    check('the 36th request row keeps Approve and Decline (nothing blocked)', req && (await p.locator(`[data-action=req-approve][data-id="${req.id}"]`).count()) === 1 && (await p.locator(`[data-action=req-decline][data-id="${req.id}"]`).count()) === 1);
    const row1 = await requestRow(p, seeded[0].requestId);
    check('a request within the first 35 carries no flag', row1 && !/Would be non-accredited purchaser/.test(row1), row1);
    check('exactly one request row is flagged', (await p.locator('.cs-tbl .iv-warn').count()) === 1, await p.locator('.cs-tbl .iv-warn').allInnerTexts());
    const leakR = L.leakCheck(await L.screenText(p));
    check('white label: the requests view passes the leak check', leakR.ok, leakR.hits);

    // The sponsor declines one of the 36 (the button on its row): the count drops to 35 and the flag goes.
    await p.click(`[data-action=req-decline][data-id="${seeded[4].requestId}"]`);
    await p.waitForTimeout(300);
    check('after declining one, no request row is flagged', (await p.locator('.cs-tbl .iv-warn').count()) === 0, await p.locator('.cs-tbl .iv-warn').allInnerTexts());
    await consoleOffering(p, off.offeringId);
    el = await eligibilityText(p);
    check('declining one of the 36 brings the panel to 35 of 35', /Non-accredited purchasers: 35 of 35/.test(el), el);
    check('at 35 the panel carries the warning badge, not the red one', (await p.locator('.cs-panel .cs-elig-count .cs-badge-warn').count()) === 1 && (await p.locator('.cs-panel .cs-elig-count .cs-badge-bad').count()) === 0 && /At the limit/.test(el), el);

    // A second subscription by an investor already counted: one investor counts once.
    await p.evaluate(({ offId, invId }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const i = ws.investors.find((x) => x.id === invId);
      const r = NS.ops.submitSubscription(ws, i, ws.offerings.find((x) => x.id === offId), { cents: 2500000, signature: i.contact });
      r.id = 'na-req-second';
      r.qual = { regime: '506b', at: new Date().toISOString(), accredited: false, basis: '' };
      NS.app.save(true);
    }, { offId: off.offeringId, invId: seeded[1].investorId });
    await consoleOffering(p, off.offeringId);
    el = await eligibilityText(p);
    check('a second subscription by a counted investor leaves the panel at 35 of 35', /Non-accredited purchasers: 35 of 35/.test(el), el);
    await consoleRequests(p);
    check('and flags nothing', (await p.locator('.cs-tbl .iv-warn').count()) === 0, await p.locator('.cs-tbl .iv-warn').allInnerTexts());
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** An accredited investor in a Rule 506(b) offering: self-certified, not counted; the sponsor's notes. */
  async accredited({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    // The firm accepts self-certification for Rule 506(b) (its integrations page): the answer makes the record of it.
    const bases = await p.evaluate(() => {
      const NS = window.CVPortal;
      NS.integrations.ensure(NS.state.ws).use.accreditation = ['self'];
      NS.app.save(true);
      return NS.eligibility.BASES;
    });
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 0 });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    let sub = '';
    let st = '';
    const w = await L.walk(p, {
      name: INV.name,
      acc: 'yes',
      basis: 1,
      amount: 60000,
      onFilled: async (hd) => {
        if (hd === 'Investor status') st = await L.screenText(p);
        if (hd === 'Subscription') sub = await L.screenText(p);
      }
    });
    check('the investor reaches the subscription agreement with no field error', w.reached && w.errors.length === 0, { seen: w.seen, errors: w.errors });
    check('a status screen answered yes shows the grounds and no warning', /Which ground applies\?/.test(st) && !/may already have as many investors/.test(st), st.slice(0, 1200));
    check('the subscribe step states the account is an accredited investor, on the chosen ground', sub.indexOf(`Dana Whitfield is an accredited investor (${bases[1]})`) >= 0, sub.slice(0, 1500));
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const q = (r && r.qual) || {};
    check('request.qual: regime 506b, accredited true, the chosen ground, no sophistication answers', q.regime === '506b' && q.accredited === true && q.basis === bases[1] && !q.sophistication, q);
    check('the investor record holds the ground and the date (i.accreditation)', !!r && !!r.accreditation && r.accreditation.basis === bases[1] && /^\d{4}-\d{2}-\d{2}$/.test(r.accreditation.date || ''), r && r.accreditation);
    check('the self-certification record is made (the firm accepts self-certification)', !!r && !!r.verify && r.verify.connection === 'self' && r.verify.status === 'verified' && r.verify.method === `Self-certified: ${bases[1]}`, r && r.verify);
    check('the answer is in the change log', !!r && r.log.some((e) => e.action === 'Investor status answered' && e.detail.indexOf(`accredited investor (${bases[1]})`) >= 0), r && r.log);
    const done = await finishAgreement(p);
    await p.screenshot({ path: path.join(SHOTS, 'accredited-done.png'), fullPage: true });
    check('the done summary’s Accreditation row reads "Accredited (self-certified)"', /Accreditation\s+Accredited \(self-certified\)/.test(done), done);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    await p.screenshot({ path: path.join(SHOTS, 'accredited-console.png'), fullPage: true });
    check('an accredited investor is not counted: "Non-accredited purchasers: 0 of 35", no badge', /Non-accredited purchasers: 0 of 35/.test(el) && (await p.locator('.cs-panel .cs-elig-count .cs-badge').count()) === 0, el);
    check('C-02: the 90-day note is always under the 506(b) count', NOTE_90.test(el), el);
    check('C-02: no Rule 502(b) reminder while nobody who is not accredited is counted', !NOTE_502B.test(el), el);
    const leak = L.leakCheck([st, sub, done, await L.screenText(p)].join('\n'));
    check('white label: status, subscribe, done and console screens pass the leak check', leak.ok, leak.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** D-30: nothing answered; the investor continues, the request records accredited null, the panel shows it apart. */
  async unanswered({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const before = await p.evaluate((oid) => {
      const ws = window.CVPortal.state.ws;
      const o = ws.offerings.find((x) => x.id === oid);
      const n = window.CVPortal.eligibility.nonAccredited(ws, o);
      const holders = new Set(ws.investors.filter((i) => (i.positions || []).some((x) => x.offeringId === oid) && !(ws.requests || []).some((r) => r.type === 'subscription' && r.offeringId === oid && r.investorId === i.id && r.status !== 'rejected')).map((i) => i.id)).size;
      return { count: n.count, unanswered: n.unanswered, holders };
    }, off.offeringId);
    check('holders of the offering without a subscription made here are counted as without an answer (planner’s choice)', before.holders > 0 && before.unanswered === before.holders, before);
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 0 });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    let tick = -1;
    let sub = '';
    const w = await L.walk(p, {
      name: INV.name,
      acc: '',
      amount: 60000,
      onFilled: async (hd) => {
        if (hd === 'Subscription') {
          tick = await p.locator('#ob-subAcc').count();
          sub = await L.screenText(p);
        }
      }
    });
    check('Continue moves on from the unanswered status step with no field error', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    check('no accreditation tick on the subscribe step', tick === 0 && !/accredited investor/.test(sub), { tick, sub: sub.slice(0, 1200) });
    const r = await requestOf(p, inv.investorId, off.offeringId);
    check('request.qual.accredited is null', !!r && r.qual && r.qual.accredited === null && r.qual.regime === '506b', r && r.qual);
    check('the change log says the question was not answered', !!r && r.log.some((e) => e.action === 'Investor status answered' && /not answered/.test(e.detail)), r && r.log);
    const done = await finishAgreement(p);
    check('the done summary’s Accreditation row reads "Not answered"', /Accreditation\s+Not answered/.test(done), done);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    await p.screenshot({ path: path.join(SHOTS, 'unanswered-console.png'), fullPage: true });
    const n = before.unanswered + 1;
    check('the count is unchanged', new RegExp(`Non-accredited purchasers: ${before.count} of 35`).test(el), el);
    check(`the panel shows the investors without a status answer apart (${n}, ${before.holders} of them holders without a subscription made here)`, new RegExp(`${n} investors have no status answer on file and are not in the count; ${before.holders} of them hold the offering without a subscription made here\\.`).test(el), el);
    const leak = L.leakCheck([sub, done, el].join('\n'));
    check('white label: subscribe, done and panel pass the leak check', leak.ok, leak.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * D-01: an IRA investor in a Rule 506(c) offering of one class goes through the verification step as before, then the
   * status step shows only the benefit plan questions, prefilled as a Code section 4975 plan. Their commitment takes the
   * class from under 25 to 25 percent or more: the pending request's if-accepted figure and its row are flagged, Approve
   * still works, and once approved the class line is red. None of it reaches the investor's screens (T-06-09).
   */
  async erisa({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(c)' });
    check('the offering is Rule 506(c) with its agreement ready', off.ready && off.exemption === 'Rule 506(c)', off);
    const before = await p.evaluate((oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === oid);
      o.classes = [{ id: 'cls-erisa', name: 'Class A Interests' }];
      let holders = 0;
      ws.investors.forEach((i) => {
        if (!(i.positions || []).some((x) => x.offeringId === oid)) return;
        i.erisa = { plan: 'none', planPct: null, controlling: false, at: new Date().toISOString() };
        holders++;
      });
      NS.app.save(true);
      return { holders, rows: NS.eligibility.erisa(ws, o) };
    }, off.offeringId);
    const row0 = before.rows[0] || {};
    check('one class, whose sample holders answered "none of these": 0 percent held by benefit plan investors', before.holders > 0 && before.rows.length === 1 && row0.name === 'Class A Interests' && row0.total > 0 && row0.pct === 0, before);
    // A commitment of at least a third of the class's value brings an IRA (counted in full) to 25 percent or more.
    const cents = Math.ceil(row0.total / 3 / 10000000) * 10000000;
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, type: 'ira', offeringId: off.offeringId, cents });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    const R = {};
    const w = await L.walk(p, {
      name: INV.name,
      onStep: async (hd) => {
        if (hd !== 'Investor status') return;
        R.pre = await p.evaluate(() => (document.querySelector('input[name="ob-stPlan"]:checked') || {}).value || '');
        R.accQ = await p.locator('input[name="ob-stAcc"]').count();
        R.planQ = await p.locator('input[name="ob-stPlan"]').count();
        R.ctrlQ = await p.locator('input[name="ob-stCtrl"]').count();
        R.status = await L.screenText(p);
        await p.screenshot({ path: path.join(SHOTS, 'erisa-status.png'), fullPage: true });
      },
      onFilled: async (hd) => {
        if (hd === 'Subscription') {
          R.sub = await L.screenText(p);
          await p.screenshot({ path: path.join(SHOTS, 'erisa-subscribe.png'), fullPage: true });
        }
      }
    });
    const heads = w.seen.map((x) => x.split(' | ').pop());
    check('the investor reaches the subscription agreement with no field error', w.reached && w.errors.length === 0, { seen: w.seen, errors: w.errors });
    check('the verification step is unchanged and comes just before the status step', heads.indexOf('Accredited investor verification') >= 0 && heads.indexOf('Investor status') === heads.indexOf('Accredited investor verification') + 1, w.seen);
    check('eleven steps in all for a new investor under Rule 506(c)', w.seen.every((x) => /^Step \d+ of 11:/.test(x)), w.seen);
    check('under Rule 506(c) the status step shows only the benefit plan questions, and its lede says so', R.accQ === 0 && R.planQ === 5 && R.ctrlQ === 2 && /verified in its own step, so this step asks only whether/.test(R.status || ''), { accQ: R.accQ, planQ: R.planQ, ctrlQ: R.ctrlQ, st: (R.status || '').slice(0, 1200) });
    check('the IRA is prefilled as a plan or account under Code section 4975', R.pre === '4975', R.pre);
    check('the IRA examples are named on the 4975 choice', /section 4975 of the Internal Revenue Code/.test(R.status || '') && /Such as an IRA or a Keogh plan/.test(R.status || ''), (R.status || '').slice(0, 1500));
    check('the status step says any question may be left unanswered', /leave any question unanswered/i.test(R.status || ''));
    check('T-06-09: no class figure or other investor reaches the investor screens', !/% of value|benefit plan investors would hold|Class A Interests: /.test((R.status || '') + (R.sub || '')), '');
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const e = (r && r.qual && r.qual.erisa) || {};
    check('request.qual.erisa: plan 4975, no percentage, control not answered, share 1', !!r && e.plan === '4975' && e.planPct === null && e.controlling === null && e.share === 1, r && r.qual);
    const rec = await p.evaluate((id) => (window.CVPortal.state.ws.investors.find((x) => x.id === id) || {}).erisa || null, inv.investorId);
    check('the investor record keeps the answers to prefill the next subscription', !!rec && rec.plan === '4975' && rec.planPct === null && rec.controlling === null && /^\d{4}-\d{2}-\d{2}T/.test(rec.at || ''), rec);
    check('the change log records the benefit plan answer', !!r && r.log.some((x) => x.action === 'Investor status answered' && /benefit plan: a plan or account under Code section 4975/.test(x.detail)), r && r.log);
    const done = await finishAgreement(p);
    check('the done summary keeps the verified accreditation row', /Accreditation\s+Verified/.test(done), done);

    await consoleOffering(p, off.offeringId);
    const field = await exemptionField(p);
    check('the exemption hint carries the Rule 506(c) note under Rule 506(c)', /Rule 506\(c\) offerings take verified accredited investors only/.test(field.hints), field.hints);
    let bp = await panelText(p, 'Benefit plan investors');
    await p.screenshot({ path: path.join(SHOTS, 'erisa-console-pending.png'), fullPage: true });
    const pend = await p.evaluate((rid) => {
      const x = document.querySelector(`.cs-bpi-if[data-request="${CSS.escape(rid)}"]`);
      return x ? { text: x.innerText, warn: !!x.querySelector('.cs-badge-warn') } : null;
    }, r.id);
    const ifPct = pend ? Number((pend.text.match(/is accepted: ([\d.]+)% of Class A Interests/) || [])[1]) : NaN;
    check('before acceptance the class line reads 0% and is not red', /Class A Interests: 0% of value held by benefit plan investors/.test(bp) && (await p.locator('.cs-bpi-line.is-over').count()) === 0, bp);
    check('the pending request if-accepted figure is 25 percent or more, marked', !!pend && ifPct >= 25 && pend.warn, pend);
    await consoleRequests(p);
    const row = await requestRow(p, r.id);
    await p.screenshot({ path: path.join(SHOTS, 'erisa-requests.png'), fullPage: true });
    check('the request row is flagged "If accepted, benefit plan investors would hold N% of Class A Interests (25 percent or more)"', row.indexOf(`If accepted, benefit plan investors would hold ${ifPct}% of Class A Interests (25 percent or more)`) >= 0, row);
    check('the flagged row keeps Approve and Decline (nothing blocked)', (await p.locator(`[data-action=req-approve][data-id="${r.id}"]`).count()) === 1 && (await p.locator(`[data-action=req-decline][data-id="${r.id}"]`).count()) === 1);
    const lkRow = L.leakCheck(await L.screenText(p));
    for (let k = 0; k < 2; k++) {
      if ((await p.evaluate((id) => (window.CVPortal.state.ws.requests.find((x) => x.id === id) || {}).status, r.id)) !== 'pending') break;
      await p.click(`[data-action=req-approve][data-id="${r.id}"]`);
      await p.waitForTimeout(400);
    }
    const st = await p.evaluate((id) => (window.CVPortal.state.ws.requests.find((x) => x.id === id) || {}).status, r.id);
    check('Approve works on the flagged request', st === 'approved', st);
    await consoleOffering(p, off.offeringId);
    bp = await panelText(p, 'Benefit plan investors');
    await p.screenshot({ path: path.join(SHOTS, 'erisa-console-approved.png'), fullPage: true });
    const now = Number((bp.match(/Class A Interests: ([\d.]+)% of value held by benefit plan investors/) || [])[1]);
    check('after approval the class line is red at the if-accepted figure, with the plain sentence', now === ifPct && now >= 25 && (await p.locator('.cs-bpi-line.is-over .cs-badge-bad').count()) === 1 && /may be treated as plan assets under ERISA/.test(bp), bp);
    check('no if-accepted line is left for the approved request', (await p.locator(`.cs-bpi-if[data-request="${r.id}"]`).count()) === 0);
    const lk = L.leakCheck([R.status, R.sub, done, bp].join('\n'));
    check('white label: status, subscribe, done screens and the panel pass the leak check', lk.ok, lk.hits);
    check('white label: the requests view passes the leak check', lkRow.ok, lkRow.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * Plan 06-05, D-01: the sponsor marks a holder of the offering (here its own general partner's holding) as a controlling
   * person or affiliate. In a class where an IRA holds 20 percent and that holder 30 percent, the class figure goes from 20
   * percent to 28.6 percent (20 of the 70 left), red; each mark and unmark is logged with the holder's name; a holder whose
   * own answer says controlling, and which is a benefit plan investor, stays counted.
   */
  async controlling({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const set = await p.evaluate((oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === oid);
      o.classes = [
        { id: 'cls-a', name: 'Class A Interests' },
        { id: 'cls-c', name: 'Class C Interests' }
      ];
      const mk = (id, title, type, dollars, erisa) => {
        const i = JSON.parse(JSON.stringify(ws.investors[0]));
        i.id = id;
        i.title = i.contact = title;
        i.type = type;
        i.email = id + '@example.com';
        i.positions = [{ offeringId: oid, amount: dollars, date: NS.dates.today(), class: 'cls-c' }];
        i.erisa = Object.assign({ planPct: null, controlling: null, at: new Date().toISOString() }, erisa);
        ws.investors.push(i);
      };
      mk('ctl-ira', 'Harbor Trust Co. FBO Morgan Reyes IRA', 'ira', 200000, { plan: '4975' });
      mk('ctl-gp', 'Kestrel Bay Partners GP LLC', 'entity', 300000, { plan: 'none' });
      mk('ctl-ind', 'Rowan Ellery', 'individual', 500000, { plan: 'none' });
      if (NS.clearCaches) NS.clearCaches();
      NS.app.save(true);
      const row = NS.eligibility.erisa(ws, o).find((r) => r.classId === 'cls-c');
      return { total: row && row.total, pct: row && row.pct };
    }, off.offeringId);
    check('Class C: an IRA holds $200,000, the general partner $300,000, another holder $500,000 (20 percent held by benefit plan investors)', set.total === 100000000 && set.pct === 20, set);
    await consoleOffering(p, off.offeringId);
    const classC = () => p.evaluate(() => {
      const x = document.querySelector('.cs-bpi-line[data-class="cls-c"]');
      return x ? { text: x.innerText, red: x.classList.contains('is-over') && !!x.querySelector('.cs-badge-bad') } : null;
    });
    const pctIn = (x) => (x ? Number((x.text.match(/^Class C Interests: ([\d.]+)% of value held by benefit plan investors/) || [])[1]) : NaN);
    let bp = await panelText(p, 'Benefit plan investors');
    const c0 = await classC();
    check('the panel shows Class C at 20.0 percent, not red', pctIn(c0) === 20 && !c0.red, c0);
    check('the panel lists the controlling persons and affiliates, with a line on what is left out', /Controlling persons and affiliates/.test(bp) && /left out of the class total, unless they are benefit plan investors themselves/.test(bp), bp);
    const boxes = await p.evaluate(() => Array.from(document.querySelectorAll('[data-action=bpi-ctrl]')).map((x) => ({ id: x.getAttribute('data-id'), on: x.checked })));
    check('one unticked box per holder, the general partner among them', boxes.some((x) => x.id === 'ctl-gp' && !x.on) && boxes.some((x) => x.id === 'ctl-ira') && boxes.every((x) => !x.on) && new Set(boxes.map((x) => x.id)).size === boxes.length, boxes);
    const logOf = () => p.evaluate(() => (window.CVPortal.state.ws.audit || []).filter((e) => e && e.record === 'ctl-gp').map((e) => ({ action: e.action, detail: e.detail })));
    await p.click('[data-action=bpi-ctrl][data-id="ctl-gp"]');
    await p.waitForTimeout(400);
    const c1 = await classC();
    bp = await panelText(p, 'Benefit plan investors');
    await p.screenshot({ path: path.join(SHOTS, 'controlling-marked.png'), fullPage: true });
    const stored = await p.evaluate((oid) => (window.CVPortal.state.ws.offerings.find((x) => x.id === oid) || {}).erisaControlling || null, off.offeringId);
    check('the mark is kept on the offering', Array.isArray(stored) && stored.length === 1 && stored[0] === 'ctl-gp', stored);
    check('marked: Class C reads 28.6 percent (20 of 70), in red', pctIn(c1) === 28.6 && c1.red, c1);
    check('marked: the panel names what is left out of Class C and why', /Left out of Class C Interests as held by controlling persons or affiliates: \$300,000 \(Kestrel Bay Partners GP LLC\)/.test(bp), bp);
    check('marked: the box stays ticked after the page is drawn again', await p.locator('[data-action=bpi-ctrl][data-id="ctl-gp"]').isChecked());
    let log = await logOf();
    check('the change log names the holder marked', log.some((e) => e.action === 'Marked as a controlling person or affiliate for the 25 percent test' && /^Kestrel Bay Partners GP LLC in /.test(e.detail)), log);
    await p.click('[data-action=bpi-ctrl][data-id="ctl-gp"]');
    await p.waitForTimeout(400);
    const c2 = await classC();
    log = await logOf();
    check('unmarked: Class C returns to 20.0 percent, not red', pctIn(c2) === 20 && !c2.red, c2);
    check('the change log names the holder unmarked', log.some((e) => e.action === 'Unmarked as a controlling person or affiliate for the 25 percent test' && /^Kestrel Bay Partners GP LLC in /.test(e.detail)), log);
    // A second holder (the IRA, a plan under Code section 4975) answers that it has control: a benefit plan investor stays counted.
    await p.evaluate(() => {
      const NS = window.CVPortal;
      const i = NS.state.ws.investors.find((x) => x.id === 'ctl-ira');
      i.erisa = { plan: '4975', planPct: null, controlling: true, at: new Date().toISOString() };
      NS.app.save(true);
      NS.app.render();
    });
    await p.waitForTimeout(400);
    const c3 = await classC();
    bp = await panelText(p, 'Benefit plan investors');
    check('an IRA answering controlling yes stays counted: Class C still 20.0 percent', pctIn(c3) === 20 && !/Left out of Class C Interests/.test(bp), { c3, bp });
    check('the IRA is shown as controlling by its own answers', /Harbor Trust Co\. FBO Morgan Reyes IRA\s*Its own answers say it has control over these assets or gives paid advice about them/.test(bp), bp);
    await p.click('[data-action=bpi-ctrl][data-id="ctl-gp"]');
    await p.waitForTimeout(400);
    const c4 = await classC();
    check('the general partner marked again with the IRA controlling: 28.6 percent, the IRA still counted', pctIn(c4) === 28.6 && c4.red, c4);
    await p.screenshot({ path: path.join(SHOTS, 'controlling-both.png'), fullPage: true });
    const lk = L.leakCheck(await L.screenText(p));
    check('white label: the console offering page passes the leak check', lk.ok, lk.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** Another exemption: with the firm's toggle on, the accredited question; with it off, the benefit plan questions only (06-04). */
  async other({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Regulation S' });
    await p.evaluate(() => {
      window.CVPortal.state.ws.tenant.onboarding.accreditation = true;
      window.CVPortal.app.save(true);
    });
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 0 });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    let st = '';
    let soph = -1;
    const w = await L.walk(p, {
      name: INV.name,
      acc: 'no',
      amount: 60000,
      onFilled: async (hd) => {
        if (hd !== 'Investor status') return;
        st = await L.screenText(p);
        soph = (await p.locator('#ob-stExp, #ob-stEdu, input[name="ob-stRep"]').count()) + (await p.locator('.ivf-form .wire-warn').count());
      }
    });
    check('toggle on: the Regulation S flow has the status step and reaches the agreement', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    check('toggle on: the accredited question only (no sophistication questions, no limit warning) after answering no', soph === 0 && /asks each investor whether they are an accredited investor/.test(st) && !/Rule 506\(b\)/.test(st), { soph, st: st.slice(0, 900) });
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const q = (r && r.qual) || {};
    check('request.qual: regime other, accredited false, no sophistication answers', q.regime === 'other' && q.accredited === false && !q.sophistication, q);
    const done = await finishAgreement(p);
    check('the done summary’s Accreditation row reads "Not accredited"', /Accreditation\s+Not accredited/.test(done), done);
    await consoleOffering(p, off.offeringId);
    check('no Investor eligibility panel for a Regulation S offering', (await eligibilityText(p)) === '');
    await p.evaluate(() => {
      window.CVPortal.state.ws.tenant.onboarding.accreditation = false;
      window.CVPortal.app.save(true);
    });
    // Toggle off: one investor per exemption, with what the status and subscribe steps show.
    const offWalk = async (exemption, name, email) => {
      await p.evaluate(({ oid, exemption }) => {
        const NS = window.CVPortal;
        const o = NS.state.ws.offerings.find((x) => x.id === oid);
        o.structure = Object.assign({}, o.structure, { exemption });
        NS.app.save(true);
      }, { oid: off.offeringId, exemption });
      const iv = await L.createInvitation(p, { name, email, offeringId: off.offeringId, cents: 0 });
      await p.goto(`${S.base}?tenant=${iv.tenant}#invite-${iv.token}`);
      const R = { st: '', accQ: -1, sub: '', subAcc: -1 };
      R.w = await L.walk(p, {
        name,
        amount: 60000,
        onStep: async (hd) => {
          if (hd !== 'Subscription') return;
          R.sub = await L.screenText(p);
          R.subAcc = await p.locator('#ob-subAcc').count();
        },
        onFilled: async (hd) => {
          if (hd !== 'Investor status') return;
          R.st = await L.screenText(p);
          R.accQ = await p.locator('input[name="ob-stAcc"]').count();
        }
      });
      return R;
    };
    const s2 = await offWalk('Regulation S', 'Lee Ortiz', 'lee.ortiz@example.com');
    const w2 = s2.w;
    // Plan 06-04, D-01: every invitation with an offering now has the status step for the benefit plan questions; with the
    // toggle off it asks nothing about accreditation (before 06-04 there was no status step here).
    check('toggle off: the status step asks only the benefit plan questions, and the investor reaches the agreement', w2.reached && w2.errors.length === 0 && w2.seen.some((s) => /\| Investor status$/.test(s)) && s2.accQ === 0 && /asks only whether Lee Ortiz invests on behalf of a benefit plan/.test(s2.st), { seen: w2.seen, errors: w2.errors, q2: s2.accQ, st2: s2.st.slice(0, 900) });
    // Rule 1 fix with plan 06-05: Regulation S and Regulation Crowdfunding are not limited to accredited investors, so with the
    // toggle off the subscribe step offers no accreditation tick and says why (as 06-04 did for Reg A Tier 1 and listed Tier 2).
    check('toggle off, Regulation S: the subscribe step offers no "is an accredited investor" tick and says why', s2.subAcc === 0 && !/is an accredited investor/.test(s2.sub) && /Regulation S is not limited to accredited investors/.test(s2.sub), { subAcc: s2.subAcc, sub: s2.sub.slice(0, 1500) });
    const cf = await offWalk('Regulation Crowdfunding', 'Rae Lindgren', 'rae.lindgren@example.com');
    check('toggle off, Regulation Crowdfunding: the investor reaches the agreement with no field error', cf.w.reached && cf.w.errors.length === 0 && cf.accQ === 0, { seen: cf.w.seen, errors: cf.w.errors, accQ: cf.accQ });
    check('toggle off, Regulation Crowdfunding: no "is an accredited investor" tick, and a note says why', cf.subAcc === 0 && !/is an accredited investor/.test(cf.sub) && /Regulation Crowdfunding is open to investors who are not accredited/.test(cf.sub), { subAcc: cf.subAcc, sub: cf.sub.slice(0, 1500) });
    // Section 4(a)(2) keeps today's optional tick (the caller's instruction with plan 06-05).
    const s4 = await offWalk('Section 4(a)(2)', 'Noor Halvorsen', 'noor.halvorsen@example.com');
    check('toggle off, Section 4(a)(2): the optional "is an accredited investor" tick stays, and the investor reaches the agreement', s4.w.reached && s4.w.errors.length === 0 && s4.subAcc === 1 && /Noor Halvorsen is an accredited investor/.test(s4.sub) && !/not limited to accredited investors|open to investors who are not accredited/.test(s4.sub), { subAcc: s4.subAcc, seen: s4.w.seen, errors: s4.w.errors, sub: s4.sub.slice(0, 1200) });
    const leak = L.leakCheck([st, done, s2.st, s2.sub, cf.st, cf.sub, s4.sub].join('\n'));
    check('white label: the status, subscribe and done screens pass the leak check', leak.ok, leak.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** An investor on file invited to a new Rule 506(b) offering gets the status step, prefilled from their ground. */
  async existing({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const who = await p.evaluate((oid) => {
      const ws = window.CVPortal.state.ws;
      const i = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.accreditation && x.accreditation.basis && x.email && !(x.positions || []).some((y) => y.offeringId === oid));
      return i ? { id: i.id, name: i.contact, email: i.email, basis: i.accreditation.basis } : null;
    }, off.offeringId);
    check('an active individual investor on file with an accreditation ground, not holding the offering', !!who, who);
    if (!who) return A.context.close();
    const inv = await L.createInvitation(p, { name: who.name, email: who.email, offeringId: off.offeringId, cents: 0 });
    const ex = await p.evaluate((id) => !!(window.CVPortal.state.ws.invitations.find((x) => x.id === id) || {}).existing, inv.invitationId);
    check('the invitation is to subscribe (the investor is on file)', ex && inv.investorId === who.id, { ex, inv });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    let pre = null;
    let st = '';
    let sub = '';
    const w = await L.walk(p, {
      name: who.name,
      amount: 60000,
      onStep: async (hd) => {
        if (hd !== 'Investor status') return;
        pre = await p.evaluate(() => ({ acc: (document.querySelector('input[name="ob-stAcc"]:checked') || {}).value || '', basis: (document.querySelector('input[name="ob-stBasis"]:checked') || {}).value || '' }));
        st = await L.screenText(p);
        await p.screenshot({ path: path.join(SHOTS, 'existing-status.png'), fullPage: true });
      },
      onFilled: async (hd) => {
        if (hd === 'Subscription') sub = await L.screenText(p);
      }
    });
    const heads = w.seen.map((s) => s.split(' | ').pop());
    check('steps: welcome, status, subscribe, agreement (then done), five in all', w.reached && w.errors.length === 0 && /^Welcome/.test(heads[0]) && heads.slice(1).join(',') === 'Investor status,Subscription,Subscription agreement' && w.seen.every((s) => /^Step \d of 5/.test(s)), { seen: w.seen, errors: w.errors });
    check('the status step is prefilled from the ground on file (yes, and that ground selected)', !!pre && pre.acc === 'yes' && pre.basis === who.basis, { pre, basis: who.basis });
    check('the ground on file is shown on the status screen', st.indexOf(who.basis) >= 0, st.slice(0, 1500));
    check('the subscribe step states the account is an accredited investor', sub.indexOf(`${who.name} is an accredited investor`) >= 0 || /is an accredited investor/.test(sub), sub.slice(0, 1200));
    const r = await requestOf(p, who.id, off.offeringId);
    const q = (r && r.qual) || {};
    check('the request carries qual: regime 506b, accredited true, the ground on file', q.regime === '506b' && q.accredited === true && q.basis === who.basis, q);
    const done = await finishAgreement(p);
    check('the done summary’s Accreditation row reads "Accredited (self-certified)"', /Accreditation\s+Accredited \(self-certified\)/.test(done), done);
    const leak = L.leakCheck([st, sub, done].join('\n'));
    check('white label: status, subscribe and done screens pass the leak check', leak.ok, leak.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * A corrected answer while the request is pending updates request.qual, with a change-log entry; once decided, it does not.
   * The investor record follows every correction: a "no" withdraws the ground self-certified with an earlier "yes".
   */
  async back({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    // The firm accepts self-certification for Rule 506(b): a "yes" makes the record of it, so its withdrawal can be seen.
    const bases = await p.evaluate(() => {
      const NS = window.CVPortal;
      NS.integrations.ensure(NS.state.ws).use.accreditation = ['self'];
      NS.app.save(true);
      return NS.eligibility.BASES;
    });
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 0 });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    const w = await L.walk(p, { name: INV.name, acc: 'no', exp: 'Ten years of private credit funds', edu: 'Lawyer', rep: 'no', amount: 60000 });
    check('the investor subscribes as not accredited and reaches the agreement (pending, unsigned)', w.reached && w.errors.length === 0, { seen: w.seen, errors: w.errors });
    const r0 = await requestOf(p, inv.investorId, off.offeringId);
    check('request.qual.accredited is false at first', !!r0 && r0.qual.accredited === false && r0.status === 'pending', r0 && r0.qual);
    check('Back reaches the status step from the agreement', await backTo(p, 'Investor status'), await L.heading(p));
    await p.check('input[name="ob-stAcc"][value="yes"]');
    await p.check('input[name="ob-stBasis"] >> nth=0');
    await L.submit(p);
    const r1 = await requestOf(p, inv.investorId, off.offeringId);
    const q1 = (r1 && r1.qual) || {};
    check('while pending, the corrected answer updates request.qual (accredited true, the ground, no sophistication answers)', q1.accredited === true && q1.basis === bases[0] && !q1.sophistication && r1.id === r0.id, q1);
    const upd = (r1 && r1.log.filter((e) => e.action === 'Investor status updated')) || [];
    check('"Investor status updated" is in the change log under the request id', upd.length === 1 && upd[0].record === r1.id, r1 && r1.log);
    check('the investor record holds the ground answered yes, with the self-certification record', !!r1 && !!r1.accreditation && r1.accreditation.basis === bases[0] && !!r1.verify && r1.verify.connection === 'self' && r1.verify.status === 'verified', r1 && { accreditation: r1.accreditation, verify: r1.verify });
    check('Continue moves on to the next step', (await L.heading(p)) === 'Tax certification', await L.heading(p));

    // Corrected from yes to no while pending: the request, and now the investor record, follow the correction.
    check('Back reaches the status step to correct yes to no', await backTo(p, 'Investor status'), await L.heading(p));
    await p.check('input[name="ob-stAcc"][value="no"]');
    await L.submit(p);
    const rn = await requestOf(p, inv.investorId, off.offeringId);
    const qn = (rn && rn.qual) || {};
    check('yes corrected to no while pending: request.qual.accredited is false again', qn.accredited === false && qn.basis === '', qn);
    const accN = (rn && rn.accreditation) || {};
    check('yes corrected to no: the investor record no longer holds the ground (kept as superseded, with when it was given and withdrawn)', !accN.basis && !accN.date && !!accN.superseded && accN.superseded.basis === bases[0] && /^\d{4}-\d{2}-\d{2}$/.test(accN.superseded.date || '') && /^\d{4}-\d{2}-\d{2}$/.test(accN.superseded.at || ''), accN);
    check('yes corrected to no: the self-certification record made from that ground is withdrawn', !!rn && !!rn.verify && rn.verify.status !== 'verified' && String(rn.verify.method || '').indexOf(bases[0]) < 0, rn && rn.verify);
    check('yes corrected to no: the change log says the self-certified ground no longer applies', !!rn && rn.log.some((e) => e.action === 'Investor status answered' && /not an accredited investor/.test(e.detail) && e.detail.indexOf(`self-certified ground on the record (${bases[0]}) no longer applies`) >= 0), rn && rn.log);
    check('Continue moves on after the correction (nothing required)', (await L.heading(p)) === 'Tax certification', await L.heading(p));

    // Back to yes, so the decided case below starts from an accredited answer on the request.
    check('Back reaches the status step to answer yes again', await backTo(p, 'Investor status'), await L.heading(p));
    await p.check('input[name="ob-stAcc"][value="yes"]');
    await p.check('input[name="ob-stBasis"] >> nth=0');
    await L.submit(p);
    const r3 = await requestOf(p, inv.investorId, off.offeringId);
    const q3 = (r3 && r3.qual) || {};
    check('answered yes again: request.qual and the investor record hold the ground', q3.accredited === true && q3.basis === bases[0] && !!r3.accreditation && r3.accreditation.basis === bases[0], { q3, accreditation: r3 && r3.accreditation });
    check('each correction while pending made one "Investor status updated" entry (three in all)', !!r3 && r3.log.filter((e) => e.action === 'Investor status updated').length === 3, r3 && r3.log);
    // The sponsor approves the subscription: the request is no longer pending.
    await p.evaluate((rid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      NS.ops.decide(ws, ws.requests.find((x) => x.id === rid), true);
      NS.app.render();
    }, r3.id);
    await p.waitForTimeout(300);
    check('Back reaches the status step again', await backTo(p, 'Investor status'), await L.heading(p));
    await p.check('input[name="ob-stAcc"][value="no"]');
    await L.submit(p);
    const r2 = await requestOf(p, inv.investorId, off.offeringId);
    const q2 = (r2 && r2.qual) || {};
    check('once the request is no longer pending, a change leaves request.qual as it was', q2.accredited === true && q2.basis === bases[0] && q2.at === q3.at, q2);
    check('and adds no "Investor status updated" entry', r2 && r2.log.filter((e) => e.action === 'Investor status updated').length === 3, r2 && r2.log);
    const acc2 = (r2 && r2.accreditation) || {};
    check('the investor record follows the investor’s latest answer (no ground) also after the request was decided', !acc2.basis && !!acc2.superseded && acc2.superseded.basis === bases[0], acc2);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    check('the panel follows the request: 0 of 35', /Non-accredited purchasers: 0 of 35/.test(el), el);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * Rule 501(i): the investor uploads a written acknowledgment of their purchaser representative; a renamed text file and a
   * 26 MB file are refused with nothing stored; the sponsor sees the representative and downloads the same bytes.
   */
  async repack({ check, S }) {
    const A = await L.open(S, { context: { acceptDownloads: true } });
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 0 });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% acknowledgment of purchaser representative, signed by Dana Whitfield\ntrailer << /Root 1 0 R >>\n%%EOF\n');
    const storedRep = () =>
      p.evaluate(
        (invId) =>
          new Promise((res) => {
            const r = indexedDB.open('cvp-documents', 1);
            r.onsuccess = () => {
              const t = r.result.transaction('files', 'readonly').objectStore('files').getAllKeys();
              t.onsuccess = () => res(t.result.filter((k) => String(k).indexOf(`rep-${invId}-`) === 0));
              t.onerror = () => res(['ERROR']);
            };
            r.onerror = () => res(['ERROR']);
          }),
        inv.investorId
      );
    const msg = () => p.locator('#err-stRepFile').innerText().catch(() => '');
    const fileId = () => p.evaluate(() => (window.CVPortal.state.ui.ob || { d: {} }).d.stRepFileId || '');
    const R = {};
    const w = await L.walk(p, {
      name: INV.name,
      acc: 'no',
      exp: 'Four years of real estate syndications',
      edu: 'Nurse',
      rep: 'yes',
      repName: 'Morgan Ellery',
      repFirm: 'Ellery Advisory Partners',
      amount: 60000,
      onFilled: async (hd) => {
        if (hd !== 'Investor status') return;
        R.input = await p.locator('#ob-stRepFile').count();
        R.label = await p.locator('label[for="ob-stRepFile"]').innerText().catch(() => '');
        await p.setInputFiles('#ob-stRepFile', { name: 'acknowledgment.pdf', mimeType: 'application/pdf', buffer: Buffer.from('This is a plain text note, not a PDF.\n') });
        await p.waitForTimeout(400);
        R.textMsg = await msg();
        R.textId = await fileId();
        R.textStored = await storedRep();
        const big = Buffer.alloc(26 * 1024 * 1024, 0x20);
        PDF.copy(big, 0);
        await p.setInputFiles('#ob-stRepFile', { name: 'large.pdf', mimeType: 'application/pdf', buffer: big });
        await p.waitForTimeout(800);
        R.bigMsg = await msg();
        R.bigId = await fileId();
        R.bigStored = await storedRep();
        await p.screenshot({ path: path.join(SHOTS, 'repack-refused.png'), fullPage: true });
        await p.setInputFiles('#ob-stRepFile', { name: 'acknowledgment.pdf', mimeType: 'application/pdf', buffer: PDF });
        await p.waitForTimeout(400);
        R.okMsg = await msg();
        R.okId = await fileId();
        R.okStored = await storedRep();
        R.hint = await p.locator('#hint-stRepFile').innerText().catch(() => '');
        R.screen = await L.screenText(p);
        await p.screenshot({ path: path.join(SHOTS, 'repack-attached.png'), fullPage: true });
      }
    });
    check('the status step offers the acknowledgment upload under the representative’s name and firm, marked optional', R.input === 1 && /written acknowledgment that this person is your purchaser representative/.test(R.label) && /Optional/.test(R.label), R.label);
    check('a text file renamed .pdf is refused with a plain message and nothing is stored', /not a PDF, PNG or JPEG/.test(R.textMsg) && !R.textId && R.textStored && R.textStored.length === 0, { msg: R.textMsg, id: R.textId, stored: R.textStored });
    check('a 26 MB file is refused with a plain message and nothing is stored', /26 MB, more than the 25 MB/.test(R.bigMsg) && !R.bigId && R.bigStored && R.bigStored.length === 0, { msg: R.bigMsg, id: R.bigId, stored: R.bigStored });
    check('a PDF is accepted and stored as rep-{investor id}-{time in base 36}', !R.okMsg && new RegExp(`^rep-${inv.investorId}-[0-9a-z]+$`).test(R.okId) && R.okStored.length === 1 && R.okStored[0] === R.okId && /Attached: acknowledgment\.pdf/.test(R.hint), R);
    check('the investor continues to the agreement with no field error', w.reached && w.errors.length === 0, { seen: w.seen, errors: w.errors });
    const leak = L.leakCheck(R.screen || '');
    check('white label: the status screen with the upload passes the leak check', leak.ok, leak.hits);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const rep = (r && r.qual && r.qual.sophistication && r.qual.sophistication.rep) || {};
    check('qual.sophistication.rep has name, firm, fileId and fileName', rep.name === 'Morgan Ellery' && rep.firm === 'Ellery Advisory Partners' && rep.fileId === R.okId && rep.fileName === 'acknowledgment.pdf', rep);
    // A refused file after the request is made: the investor still continues, and the acknowledgment on file stays.
    check('Back reaches the status step', await backTo(p, 'Investor status'), await L.heading(p));
    await p.setInputFiles('#ob-stRepFile', { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('plain words') });
    await p.waitForTimeout(400);
    const again = await msg();
    await L.submit(p);
    const hd = await L.heading(p);
    const errs = await L.fieldErrors(p);
    const r2 = await requestOf(p, inv.investorId, off.offeringId);
    const rep2 = (r2 && r2.qual && r2.qual.sophistication && r2.qual.sophistication.rep) || {};
    check('after a refused file the investor can still continue (no field error), and the earlier acknowledgment stays', /not a PDF, PNG or JPEG/.test(again) && hd === 'Tax certification' && errs.length === 0 && rep2.fileId === R.okId, { again, hd, errs, rep2 });
    // A second request naming a representative with no file, for the row's other wording.
    await p.evaluate((offId) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const i = JSON.parse(JSON.stringify(ws.investors[0]));
      i.id = 'rep-check-inv';
      i.title = i.contact = 'Avery Lindqvist';
      i.positions = [];
      ws.investors.push(i);
      const q = NS.ops.submitSubscription(ws, i, ws.offerings.find((x) => x.id === offId), { cents: 5000000, signature: i.contact });
      q.id = 'rep-check-req';
      q.qual = { regime: '506b', at: new Date().toISOString(), accredited: false, basis: '', sophistication: { experience: '', education: '', rep: { name: 'Jordan Pike', firm: 'Pike Wealth' } } };
      NS.app.save(true);
    }, off.offeringId);
    await consoleRequests(p);
    const row = await requestRow(p, r.id);
    await p.screenshot({ path: path.join(SHOTS, 'repack-requests.png'), fullPage: true });
    check('the request row shows "Purchaser representative: Morgan Ellery, Ellery Advisory Partners" and the download', /Purchaser representative: Morgan Ellery, Ellery Advisory Partners/.test(row) && /Download the written acknowledgment/.test(row), row);
    const row2 = await requestRow(p, 'rep-check-req');
    check('a representative named without a file reads "no written acknowledgment uploaded"', /Purchaser representative: Jordan Pike, Pike Wealth; no written acknowledgment uploaded/.test(row2), row2);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click(`[data-action=kyc-iv-file][data-id="${R.okId}"]`)]);
    const got = fs.readFileSync(await dl.path());
    check('the download returns the same bytes, under the uploaded name', got.equals(PDF) && dl.suggestedFilename() === 'acknowledgment.pdf', { size: got.length, want: PDF.length, name: dl.suggestedFilename() });
    const leakR = L.leakCheck(await L.screenText(p));
    check('white label: the requests view passes the leak check', leakR.ok, leakR.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** A flow saved at the old self-certified Accreditation step resumes at the status step with its answers. */
  async resume({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 0 });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    const STOP = 'stopped at the status step';
    let stopped = false;
    try {
      await L.walk(p, {
        name: INV.name,
        onStep: async (hd) => {
          if (hd === 'Investor status') {
            stopped = true;
            throw new Error(STOP);
          }
        }
      });
    } catch (e) {
      if (String(e && e.message) !== STOP) throw e;
    }
    check('the investor got as far as the status step', stopped);
    // The flow as the earlier version saved it: at the self-certified 'accreditation' step, no status answers.
    const saved = await p.evaluate((id) => {
      const NS = window.CVPortal;
      const i = NS.state.ws.investors.find((x) => x.id === id);
      const fl = i.onboarding.flow;
      fl.at = 'accreditation';
      ['stAcc', 'stBasis', 'stExp', 'stEdu', 'stRep', 'stRepName', 'stRepFirm'].forEach((k) => delete fl.d[k]);
      fl.d.accBasis = '';
      delete NS.state.ui.ob;
      NS.app.save(true);
      return { at: fl.at, street: fl.d.street, loginAt: !!fl.loginAt };
    }, inv.investorId);
    await p.reload();
    await p.waitForSelector('.ivf-form h1', { timeout: 30000 });
    const hd = await L.heading(p);
    const count = await p.locator('.ivf-progress .ob-count').innerText().catch(() => '');
    const d = await p.evaluate(() => {
      const o = window.CVPortal.state.ui.ob || {};
      return o.d ? { street: o.d.street, city: o.d.city, stAcc: o.d.stAcc } : null;
    });
    check('the saved flow resumes at the Investor status step (not the welcome step)', hd === 'Investor status' && /^Step 5 of 10/.test(count), { hd, count });
    check('with its answers (the address given earlier is kept)', !!d && d.street === saved.street && saved.street === '12 Elm Street' && d.city === 'Austin' && saved.loginAt, { d, saved });
    const w = await L.walk(p, { name: INV.name, acc: 'no', exp: 'Six years of angel investing', edu: 'Teacher', rep: 'no', amount: 60000 });
    check('from there the investor reaches the agreement with no field error', w.reached && w.errors.length === 0 && /\| Investor status$/.test(w.seen[0]), { seen: w.seen, errors: w.errors });
    const r = await requestOf(p, inv.investorId, off.offeringId);
    check('the request carries the status answer', !!r && r.qual && r.qual.accredited === false, r && r.qual);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * D-01, C-01, C-04: the sponsor picks Regulation A Tier 2 on the offering page; a person who is not accredited gives income
   * 150,000 and net worth 400,000, sees a $40,000 limit, commits $50,000, is warned and still subscribes; the request keeps
   * the figures and the limit; the sponsor's panel lists the investor as over their limit.
   */
  async regA({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const ex = await chooseExemption(p, off.offeringId, 'Regulation A Tier 2');
    check('the offering page’s select offers the three Regulation A choices and stores "Regulation A Tier 2"', ex.stored === 'Regulation A Tier 2' && ex.selected === 'Regulation A Tier 2' && ['Regulation A Tier 1', 'Regulation A Tier 2', 'Regulation A Tier 2, exchange-listed'].every((v) => ex.options.indexOf(v) >= 0) && ex.options.indexOf('Regulation A') < 0, ex);
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 0 });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    const R = {};
    const w = await L.walk(p, {
      name: INV.name,
      acc: 'no',
      amount: 50000,
      onStep: async (hd) => {
        if (hd === 'Investor status') R.limitBefore = await p.locator('#ra-limit').count();
      },
      onFilled: async (hd) => {
        if (hd === 'Investor status') {
          R.kind = await p.evaluate(() => (document.querySelector('input[name="ob-stRaKind"]:checked') || {}).value || '');
          R.soph = await p.locator('#ob-stExp, #ob-stEdu, input[name="ob-stRep"]').count();
          R.emptyLine = await p.locator('#ra-limit').innerText().catch(() => 'MISSING');
          await p.click('#ob-stIncome');
          await p.keyboard.type('150000');
          R.afterIncome = await p.locator('#ra-limit').innerText().catch(() => '');
          R.focusIncome = await p.evaluate(() => (document.activeElement || {}).id || '');
          await p.click('#ob-stWorth');
          await p.keyboard.type('400000');
          R.limit = await p.locator('#ra-limit').innerText().catch(() => '');
          R.focusWorth = await p.evaluate(() => (document.activeElement || {}).id || '');
          R.status = await L.screenText(p);
          await p.screenshot({ path: path.join(SHOTS, 'regA-status.png'), fullPage: true });
        }
        if (hd === 'Subscription') {
          await p.click('#ob-amount', { clickCount: 3 });
          await p.keyboard.type('50000');
          R.focusAmount = await p.evaluate(() => (document.activeElement || {}).id || '');
          R.sub = await p.locator('#ra-sub').innerText().catch(() => '');
          R.warn = await p.locator('#ra-sub .wire-warn').innerText().catch(() => '');
          R.subScreen = await L.screenText(p);
          await p.screenshot({ path: path.join(SHOTS, 'regA-subscribe.png'), fullPage: true });
        }
      }
    });
    check('the investor reaches the subscription agreement with no field error (the warning never blocks)', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    check('no limit line before the investor answers not accredited', R.limitBefore === 0, R.limitBefore);
    check('an individual account is prefilled as a person; no Rule 506(b) sophistication questions', R.kind === 'person' && R.soph === 0, R);
    check('nothing is shown as the limit while no figure is given', R.emptyLine === '', R.emptyLine);
    check('typing the income shows a limit at once, and focus stays in the field', R.afterIncome === 'Your investment limit in this offering: $15,000' && R.focusIncome === 'ob-stIncome', { line: R.afterIncome, focus: R.focusIncome });
    check('with net worth 400,000 the status step shows "Your investment limit in this offering: $40,000", focus kept', R.limit === 'Your investment limit in this offering: $40,000' && R.focusWorth === 'ob-stWorth', { line: R.limit, focus: R.focusWorth });
    check('the status step asks annual income and net worth not counting the primary residence', /Annual income/.test(R.status || '') && /Net worth, not counting your primary residence/.test(R.status || ''), (R.status || '').slice(0, 1500));
    check('the subscribe step shows the limit', /Your investment limit in this offering under Regulation A: \$40,000/.test(R.sub || ''), R.sub);
    check('the subscribe step warns plainly that the commitment is above the limit and the investor can still subscribe', /above your investment limit under Regulation A/.test(R.warn || '') && /You can still subscribe/.test(R.warn || '') && /reviews every subscription/.test(R.warn || ''), R.warn);
    check('typing the amount keeps focus in the field', R.focusAmount === 'ob-amount', R.focusAmount);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const ra = (r && r.qual && r.qual.regA) || {};
    check('request.qual: regime regA2, accredited false', !!r && r.qual.regime === 'regA2' && r.qual.accredited === false, r && r.qual);
    check('request.qual.regA: person, income 150000, net worth 400000, limitCents 4000000, commitmentCents 5000000, overLimit true', ra.kind === 'person' && ra.income === 150000 && ra.netWorth === 400000 && ra.limitCents === 4000000 && ra.commitmentCents === 5000000 && ra.overLimit === true, ra);
    check('the change log keeps the figures and the limit (T-06-08)', !!r && r.log.some((e) => e.action === 'Investor status answered' && /annual income \$150,000, net worth \$400,000; investment limit \$40,000/.test(e.detail)), r && r.log);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    await p.screenshot({ path: path.join(SHOTS, 'regA-console.png'), fullPage: true });
    check('the console panel: "Regulation A Tier 2: 1 non-accredited subscriber, 1 over their 10 percent limit"', /Regulation A Tier 2: 1 non-accredited subscriber, 1 over their 10 percent limit/.test(el), el);
    check('the console panel lists the investor as over their limit, with the red badge', /Over the limit\s*Dana Whitfield: \$50,000 committed in this offering, limit \$40,000/.test(el) && (await p.locator('.cs-panel .cs-elig-over .cs-badge-bad').count()) === 1, el);
    check('no Rule 506(b) count on a Regulation A offering', !/Non-accredited purchasers/.test(el), el);
    const cons = await L.screenText(p);
    [['status', R.status], ['subscribe', R.subScreen], ['console', cons]].forEach(([k, t]) => {
      const lk = L.leakCheck(t || '');
      check(`white label: the ${k} screen passes the leak check`, !!t && lk.ok, lk.hits);
    });
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** D-01: an LLC on file is asked as an organization; revenue 2,000,000 and net assets 500,000 give $200,000; 150,000 is within it. */
  async entity({ check, S }) {
    let who = null;
    const F = await regAFlow(S, {
      exemption: 'Regulation A Tier 2',
      tag: 'entity',
      acc: 'no',
      figures: { stRevenue: 2000000, stAssets: 500000 },
      amount: 150000,
      invite: async (p, off) => {
        who = await p.evaluate((oid) => {
          const ws = window.CVPortal.state.ws;
          const i = ws.investors.find((x) => x.type === 'entity' && /LLC/.test(x.title) && x.onboarding && x.onboarding.status === 'complete' && x.email && !(x.positions || []).some((y) => y.offeringId === oid) && !(ws.requests || []).some((r) => r.investorId === x.id && r.offeringId === oid));
          return i ? { id: i.id, name: i.contact, title: i.title, email: i.email } : null;
        }, off.offeringId);
        if (!who) throw new Error('no LLC investor on file to invite');
        return L.createInvitation(p, { name: who.name, email: who.email, type: 'entity', offeringId: off.offeringId, cents: 0 });
      }
    });
    const { A, p, off, inv, w, R } = F;
    check('an LLC investor on file is invited to subscribe', !!who && inv.investorId === who.id, { who, inv });
    check('the investor reaches the subscription agreement with no field error', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    check('the LLC is prefilled as an organization and asked revenue and net assets', R.kind === 'entity' && R.fieldIds.join() === 'ob-stRevenue,ob-stAssets' && /Revenue for the most recent fiscal year/.test(R.status) && /Net assets at the end of that year/.test(R.status), R);
    check('the limit shown is $200,000', R.limit === 'Your investment limit in this offering: $200,000', R.limit);
    check('a 150,000 commitment shows the limit and no warning', /Your investment limit in this offering under Regulation A: \$200,000/.test(R.raSub) && !R.warn, R);
    const r = await requestOf(p, who.id, off.offeringId);
    const ra = (r && r.qual && r.qual.regA) || {};
    check('request.qual.regA: organization, revenue 2000000, net assets 500000, limitCents 20000000, commitmentCents 15000000, overLimit false', ra.kind === 'entity' && ra.revenue === 2000000 && ra.netAssets === 500000 && ra.limitCents === 20000000 && ra.commitmentCents === 15000000 && ra.overLimit === false, ra);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    check('the panel: 1 non-accredited subscriber, 0 over their limit, nobody listed', /Regulation A Tier 2: 1 non-accredited subscriber, 0 over their 10 percent limit/.test(el) && (await p.locator('.cs-elig-over').count()) === 0, el);
    const lk = L.leakCheck([R.status, R.sub, el].join('\n'));
    check('white label: status, subscribe and panel pass the leak check', lk.ok, lk.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** An accredited investor under Tier 2: no figures, no limit, no warning, no regA on the request. */
  async accredited2({ check, S }) {
    const { A, p, off, inv, w, R } = await regAFlow(S, { exemption: 'Regulation A Tier 2', tag: 'accredited2', acc: 'yes', basis: 1, amount: 60000 });
    check('the investor reaches the subscription agreement with no field error', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    check('answered yes: no figure fields and no limit line on the status step', R.figFields === 0 && R.limit === null && /Which ground applies\?/.test(R.status), R);
    check('the subscribe step shows no limit and no warning', !R.raSub && !R.warn && !/investment limit/.test(R.sub), R.raSub);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    check('request.qual: regA2, accredited true, no regA', !!r && r.qual.regime === 'regA2' && r.qual.accredited === true && r.qual.regA === undefined, r && r.qual);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    check('the panel counts no non-accredited subscriber', /Regulation A Tier 2: 0 non-accredited subscribers, 0 over their 10 percent limit/.test(el), el);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** Regulation A Tier 1 (firm's toggle off): the benefit plan questions only (06-04), no figures, no limit, no panel. */
  async tier1({ check, S }) {
    const off0 = (p) => p.evaluate(() => {
      window.CVPortal.state.ws.tenant.onboarding.accreditation = false;
      window.CVPortal.app.save(true);
    });
    const { A, p, off, inv, w, R, ex } = await regAFlow(S, { exemption: 'Regulation A Tier 1', tag: 'tier1', before: off0, amount: 60000 });
    check('the select stores "Regulation A Tier 1"', ex.stored === 'Regulation A Tier 1', ex);
    // Rule 1 fix with plan 06-04: the Rule 506(c) note shows only under Rule 506(c).
    check('the exemption hint carries no Rule 506(c) note under Tier 1', !/506\(c\)/.test(ex.hints), ex.hints);
    // Plan 06-04, D-01: the status step now appears with the benefit plan questions only (before 06-04: no status step).
    check('the status step asks only the benefit plan questions, and the investor reaches the agreement', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)) && R.accQ === 0 && R.planQ === 5 && R.figFields === 0, { seen: w.seen, errors: w.errors, accQ: R.accQ, planQ: R.planQ });
    // Rule 1 fix with plan 06-04: any investor may buy a Tier 1 offering, so no accreditation statement is offered.
    check('the subscribe step offers no "is an accredited investor" tick and says why', R.subAcc === 0 && !/is an accredited investor/.test(R.sub || '') && /does not limit this offering to accredited investors/.test(R.sub || ''), { subAcc: R.subAcc, sub: (R.sub || '').slice(0, 1500) });
    check('the subscribe step shows no limit and no warning', !R.raSub && !R.warn && !/investment limit/.test(R.sub || ''), R.raSub);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    check('request.qual: regime regA1, no regA', !!r && r.qual.regime === 'regA1' && r.qual.regA === undefined, r && r.qual);
    await consoleOffering(p, off.offeringId);
    check('no Investor eligibility panel for Tier 1', (await eligibilityText(p)) === '');
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** Regulation A Tier 2 listed on an exchange (firm's toggle off): no limit applies; the benefit plan questions only (06-04). */
  async listed({ check, S }) {
    const off0 = (p) => p.evaluate(() => {
      window.CVPortal.state.ws.tenant.onboarding.accreditation = false;
      window.CVPortal.app.save(true);
    });
    const { A, p, off, inv, w, R, ex } = await regAFlow(S, { exemption: 'Regulation A Tier 2, exchange-listed', tag: 'listed', before: off0, amount: 60000 });
    check('the select stores "Regulation A Tier 2, exchange-listed"', ex.stored === 'Regulation A Tier 2, exchange-listed', ex);
    // Rule 1 fix with plan 06-04: the Rule 506(c) note shows only under Rule 506(c).
    check('the exemption hint carries no Rule 506(c) note for an exchange-listed offering', !/506\(c\)/.test(ex.hints), ex.hints);
    // Plan 06-04, D-01: the status step now appears with the benefit plan questions only (before 06-04: no status step).
    check('the status step asks only the benefit plan questions, and the investor reaches the agreement', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)) && R.accQ === 0 && R.planQ === 5 && R.figFields === 0, { seen: w.seen, errors: w.errors, accQ: R.accQ, planQ: R.planQ });
    // Rule 1 fix with plan 06-04: any investor may buy an exchange-listed Tier 2 offering, so no accreditation statement is offered.
    check('the subscribe step offers no "is an accredited investor" tick and says why', R.subAcc === 0 && !/is an accredited investor/.test(R.sub || '') && /does not limit this offering to accredited investors/.test(R.sub || ''), { subAcc: R.subAcc, sub: (R.sub || '').slice(0, 1500) });
    check('the subscribe step shows no limit and no warning', !R.raSub && !R.warn && !/investment limit/.test(R.sub || ''), R.raSub);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    check('request.qual: regime regA2listed, no regA', !!r && r.qual.regime === 'regA2listed' && r.qual.regA === undefined, r && r.qual);
    await consoleOffering(p, off.offeringId);
    check('no Investor eligibility panel for an exchange-listed offering', (await eligibilityText(p)) === '');
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** C-04: a plain "Regulation A" (from document intake) asks the Tier 2 questions; the offering page asks for a tier. */
  async untiered({ check, S }) {
    let field = null;
    let hintsShot = '';
    const { A, p, off, inv, w, R } = await regAFlow(S, {
      exemption: 'Regulation A',
      direct: true,
      tag: 'untiered',
      acc: 'no',
      figures: { stIncome: 100000 },
      amount: 60000,
      before: async (page, o) => {
        await consoleOffering(page, o.offeringId);
        field = await exemptionField(page);
        hintsShot = path.join(SHOTS, 'untiered-console.png');
        await page.screenshot({ path: hintsShot, fullPage: true });
      }
    });
    check('the offering page’s select still shows the current value "Regulation A", with the tiers offered', !!field && field.selected === 'Regulation A' && field.options.indexOf('Regulation A') >= 0 && field.options.indexOf('Regulation A Tier 2') >= 0, field);
    check('the offering page asks the sponsor to choose Tier 1 or Tier 2, and says investors get the Tier 2 questions until then', !!field && /choose Tier 1 or Tier 2/.test(field.hints) && /asked the Tier 2 questions/.test(field.hints), field && field.hints);
    // Rule 1 fix with plan 06-04 (reported by 06-01 to 06-03): the Rule 506(c) note shows only under Rule 506(c).
    check('the hint carries no Rule 506(c) note (the offering is not Rule 506(c))', !!field && !/506\(c\)/.test(field.hints), field && field.hints);
    check('the investor reaches the agreement with no field error, through the status step', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    check('the Tier 2 questions are asked; the step names Regulation A without claiming a tier', R.kind === 'person' && R.figFields === 2 && /is offered under Regulation A\./.test(R.status) && !/Tier 2 of Regulation A/.test(R.status), R);
    check('income 100,000 alone gives "Your investment limit in this offering: $10,000"', R.limit === 'Your investment limit in this offering: $10,000', R.limit);
    check('a 60,000 commitment is warned', /above your investment limit under Regulation A/.test(R.warn), R.warn);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const ra = (r && r.qual && r.qual.regA) || {};
    check('request.qual: regime regA2 with the figures and the limit', !!r && r.qual.regime === 'regA2' && ra.income === 100000 && ra.netWorth === null && ra.limitCents === 1000000 && ra.overLimit === true, r && r.qual);
    const lk = L.leakCheck([field ? field.hints : '', R.status, R.sub].join('\n'));
    check('white label: the hint, status and subscribe screens pass the leak check', lk.ok, lk.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** The limit is on the purchase in the offering: an earlier 30,000 plus a new 10,000 against a 20,000 limit is warned. */
  async aggregate({ check, S }) {
    const { A, p, off, inv, w, R } = await regAFlow(S, {
      exemption: 'Regulation A Tier 2',
      tag: 'aggregate',
      acc: 'no',
      figures: { stIncome: 200000 },
      amount: 10000,
      before: (page, o) =>
        page.evaluate((id) => {
          const NS = window.CVPortal;
          NS.state.ws.offerings.find((x) => x.id === id).minimum = 10000;
          NS.app.save(true);
        }, o.offeringId),
      afterInvite: (page, o, iv) =>
        page.evaluate(
          ({ offId, invId }) => {
            const NS = window.CVPortal;
            const ws = NS.state.ws;
            const i = ws.investors.find((x) => x.id === invId);
            const r = NS.ops.submitSubscription(ws, i, ws.offerings.find((x) => x.id === offId), { cents: 3000000, signature: i.contact });
            r.id = 'ra-earlier';
            NS.app.save(true);
          },
          { offId: o.offeringId, invId: iv.investorId }
        )
    });
    check('the investor reaches the agreement with no field error', w.reached && w.errors.length === 0, { seen: w.seen, errors: w.errors });
    check('the status step shows a $20,000 limit', R.limit === 'Your investment limit in this offering: $20,000', R.limit);
    check('the subscribe step names the earlier $30,000 and warns about the 10,000 commitment', /already committed \$30,000/.test(R.raSub) && /together with your earlier subscriptions to this offering/.test(R.warn) && /above your investment limit/.test(R.warn), R);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const ra = (r && r.qual && r.qual.regA) || {};
    check('request.qual.regA: commitmentCents 4000000 (both subscriptions), limitCents 2000000, overLimit true', ra.commitmentCents === 4000000 && ra.limitCents === 2000000 && ra.overLimit === true, ra);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    check('the console totals $40,000 against the $20,000 limit', /Dana Whitfield: \$40,000 committed in this offering, limit \$20,000/.test(el) && /1 over their 10 percent limit/.test(el), el);
    await consoleRequests(p);
    const row = await requestRow(p, 'ra-earlier');
    check('the earlier request carries the flag with the total', /Over the Regulation A Tier 2 limit: \$40,000 committed in this offering, limit \$20,000/.test(row), row);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** D-30: not accredited with no figures: no limit, no warning, limitCents null; the sponsor sees who gave none. */
  async nofigures({ check, S }) {
    const { A, p, off, inv, w, R } = await regAFlow(S, { exemption: 'Regulation A Tier 2', tag: 'nofigures', acc: 'no', amount: 60000 });
    check('Continue moves on with no figures and no field error, to the agreement', w.reached && w.errors.length === 0, { seen: w.seen, errors: w.errors });
    check('no limit shown on the status step while no figure is given', R.limit === '' && R.figFields === 2, R);
    check('no limit and no warning on the subscribe step', !R.raSub && !R.warn, R);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const ra = (r && r.qual && r.qual.regA) || {};
    check('request.qual.regA: limitCents null, overLimit false, the figures null', r && r.qual.accredited === false && ra.limitCents === null && ra.overLimit === false && ra.income === null && ra.netWorth === null, r && r.qual);
    check('the change log says no figures were given', !!r && r.log.some((e) => e.action === 'Investor status answered' && /figures \(person\): not given; investment limit not known/.test(e.detail)), r && r.log);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    await p.screenshot({ path: path.join(SHOTS, 'nofigures-console.png'), fullPage: true });
    check('the panel: 1 non-accredited subscriber, 0 over, and "1 subscriber has not given figures"', /Regulation A Tier 2: 1 non-accredited subscriber, 0 over their 10 percent limit/.test(el) && /1 subscriber has not given figures/.test(el), el);
    await consoleRequests(p);
    const row = await requestRow(p, r.id);
    check('the request row carries no Regulation A flag', !!row && !RA_FLAG.test(row), row);
    const lk = L.leakCheck([R.status, R.sub, el].join('\n'));
    check('white label: status, subscribe and panel pass the leak check', lk.ok, lk.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** C-01: the request row flags an over-limit subscription, recomputed (a device flag is ignored); Approve stays. */
  async flag({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const ex = await chooseExemption(p, off.offeringId, 'Regulation A Tier 2');
    check('the select stores "Regulation A Tier 2"', ex.stored === 'Regulation A Tier 2', ex);
    await p.evaluate((offId) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === offId);
      const mk = (id, name, cents, regA) => {
        const i = JSON.parse(JSON.stringify(ws.investors[0]));
        i.id = id + '-inv';
        i.title = i.contact = name;
        i.positions = [];
        ws.investors.push(i);
        const r = NS.ops.submitSubscription(ws, i, o, { cents, signature: name });
        r.id = id + '-req';
        r.qual = { regime: 'regA2', at: new Date().toISOString(), accredited: false, basis: '', regA };
      };
      // Over, though the device said it was not; under, though the device said it was over; no figures.
      mk('fa', 'Avery Over', 5000000, { kind: 'person', income: 150000, netWorth: 400000, limitCents: 9000000, commitmentCents: 5000000, overLimit: false });
      mk('fb', 'Blake Under', 5000000, { kind: 'person', income: 1000000, netWorth: null, limitCents: 100, commitmentCents: 5000000, overLimit: true });
      mk('fc', 'Casey None', 5000000, { kind: 'person', income: null, netWorth: null, limitCents: null, commitmentCents: 5000000, overLimit: false });
      NS.app.save(true);
    }, off.offeringId);
    await consoleRequests(p);
    const rowA = await requestRow(p, 'fa-req');
    await p.screenshot({ path: path.join(SHOTS, 'flag-requests.png'), fullPage: true });
    check('the over-limit request row reads "Over the Regulation A Tier 2 limit: $50,000 committed in this offering, limit $40,000" (device said not over)', /Over the Regulation A Tier 2 limit: \$50,000 committed in this offering, limit \$40,000/.test(rowA), rowA);
    check('a request the device marked over but within the recomputed limit carries no flag', !RA_FLAG.test(await requestRow(p, 'fb-req')));
    check('a request with no figures carries no flag', !RA_FLAG.test(await requestRow(p, 'fc-req')));
    check('exactly one request row is flagged', (await p.locator('.cs-tbl .iv-warn').count()) === 1, await p.locator('.cs-tbl .iv-warn').allInnerTexts());
    check('the flagged row keeps Approve and Decline (nothing blocked)', (await p.locator('[data-action=req-approve][data-id="fa-req"]').count()) === 1 && (await p.locator('[data-action=req-decline][data-id="fa-req"]').count()) === 1);
    const lk = L.leakCheck(await L.screenText(p));
    check('white label: the requests view passes the leak check', lk.ok, lk.hits);
    await p.click('[data-action=req-approve][data-id="fa-req"]');
    await p.waitForTimeout(400);
    const st = await p.evaluate(() => (window.CVPortal.state.ws.requests.find((r) => r.id === 'fa-req') || {}).status);
    check('Approve works as before on the flagged request', st === 'approved', st);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    check('the panel: 3 non-accredited subscribers, 1 over, Avery Over listed, 1 without figures', /Regulation A Tier 2: 3 non-accredited subscribers, 1 over their 10 percent limit/.test(el) && /Avery Over: \$50,000 committed in this offering, limit \$40,000/.test(el) && !/Blake Under:/.test(el) && /1 subscriber has not given figures/.test(el), el);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  }
};

L.runParts(parts, { name: 'STATUS FLOW', unit: 'parts', flag: '--only', browser: true });
