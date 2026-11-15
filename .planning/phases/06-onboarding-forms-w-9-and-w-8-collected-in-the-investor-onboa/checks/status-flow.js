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
  }
};

L.runParts(parts, { name: 'STATUS FLOW', unit: 'parts', flag: '--only', browser: true });
