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

  /** Another exemption: with the firm's toggle on, the accredited question only; with it off, no status step. */
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
    const inv2 = await L.createInvitation(p, { name: 'Lee Ortiz', email: 'lee.ortiz@example.com', offeringId: off.offeringId, cents: 0 });
    await p.goto(`${S.base}?tenant=${inv2.tenant}#invite-${inv2.token}`);
    const w2 = await L.walk(p, { name: 'Lee Ortiz', amount: 60000 });
    check('toggle off: no status step, and the investor reaches the agreement', w2.reached && w2.errors.length === 0 && !w2.seen.some((s) => /Investor status/.test(s)), { seen: w2.seen, errors: w2.errors });
    const leak = L.leakCheck(st + '\n' + done);
    check('white label: the status and done screens pass the leak check', leak.ok, leak.hits);
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

  /** A corrected answer while the request is pending updates request.qual, with a change-log entry; once decided, it does not. */
  async back({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const bases = await p.evaluate(() => window.CVPortal.eligibility.BASES);
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
    check('Continue moves on to the next step', (await L.heading(p)) === 'Tax certification', await L.heading(p));
    // The sponsor approves the subscription: the request is no longer pending.
    await p.evaluate((rid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      NS.ops.decide(ws, ws.requests.find((x) => x.id === rid), true);
      NS.app.render();
    }, r1.id);
    await p.waitForTimeout(300);
    check('Back reaches the status step again', await backTo(p, 'Investor status'), await L.heading(p));
    await p.check('input[name="ob-stAcc"][value="no"]');
    await L.submit(p);
    const r2 = await requestOf(p, inv.investorId, off.offeringId);
    const q2 = (r2 && r2.qual) || {};
    check('once the request is no longer pending, a change leaves request.qual as it was', q2.accredited === true && q2.basis === bases[0] && q2.at === q1.at, q2);
    check('and adds no "Investor status updated" entry', r2 && r2.log.filter((e) => e.action === 'Investor status updated').length === 1, r2 && r2.log);
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
  }
};

L.runParts(parts, { name: 'STATUS FLOW', unit: 'parts', flag: '--only', browser: true });
