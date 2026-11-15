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

/** The eligibility panel's text on the console offering page ('' when there is none). */
const eligibilityText = (page) =>
  page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.cs-panel')).find((x) => /^Investor eligibility$/.test((x.querySelector('.cs-panel-head h2') || {}).textContent || ''));
    return s ? s.innerText : '';
  });

/** The text of the requests table row for one request id ('' when not shown). */
const requestRow = (page, id) =>
  page.evaluate((rid) => {
    const b = document.querySelector(`[data-action=req-approve][data-id="${CSS.escape(rid)}"], [data-action=req-decline][data-id="${CSS.escape(rid)}"]`);
    const tr = b && b.closest('tr');
    return tr ? tr.innerText : '';
  }, id);

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
  }
};

L.runParts(parts, { name: 'STATUS FLOW', unit: 'parts', flag: '--only', browser: true });
