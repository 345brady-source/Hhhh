#!/usr/bin/env node
// The investor status step in the real invitation flow (phase 6, D-01, C-02, D-30), one part per case.
//   NODE_PATH=$(npm root -g) node status-flow.js [--only part1,part2]
// The last line is "STATUS FLOW: PASS (parts run: N)" or "STATUS FLOW: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const L = require('./lib.js');

const SHOTS = path.join(L.OUT, 'status-shots');
// The owner's screenshot set (plan 06-07): what each screenshot of this check shows (local mode: one shared browser).
L.describeShots([
  ['b506-investor-status.png', 'Investor status step, Rule 506(b), answered "not accredited": Rule 506(b)(2)(ii)\'s one question (alone or with a purchaser representative), the representative\'s name and acknowledgment, then the benefit plan question (plan 06-15, D-08).'],
  ['b506-subscription.png', 'Subscribe step under Rule 506(b): it states the account is not an accredited investor.'],
  ['b506-console-offering.png', 'Console offering page: Investor eligibility panel, "Non-accredited purchasers: 1 of 35", 0 accepted and 1 pending.'],
  ['full-status-warning.png', 'Status step for a 36th investor answering "not accredited": no warning on the investor\'s screen (owner, plan 06-15); the sponsor\'s flag stays.'],
  ['full-console-36.png', 'Console offering page: "Non-accredited purchasers: 36 of 35" with the red badge.'],
  ['full-requests.png', 'Console requests page: the 36th request flagged "Would be non-accredited purchaser 36 of the 35 allowed under Rule 506(b)"; Approve and Decline kept.'],
  ['accredited-done.png', 'Investor done screen after answering "accredited": the Accreditation row reads "Accredited (self-certified)".'],
  ['accredited-console.png', 'Console offering page: an accredited investor is not counted (0 of 35, no badge).'],
  ['unanswered-console.png', 'Console offering page: investors who left the questions open are shown as not answered (eligibility panel); holders with no benefit plan answer are not on the benefit plan list.'],
  ['erisa-status.png', 'Status step under Rule 506(c): the one benefit plan question (D-08), prefilled for an IRA.'],
  ['erisa-subscribe.png', 'Subscribe step after the benefit plan answers.'],
  ['erisa-console-pending.png', 'Console offering page, Benefit plan investors panel (D-08): the plain list of who answered yes, with the IRA\'s pending subscription.'],
  ['erisa-requests.png', 'Console requests page: no benefit plan flag on the request row (D-08); Approve kept.'],
  ['erisa-console-approved.png', 'Console offering page after approval: the IRA listed with its commitment as committed.'],
  ['planassets-status.png', 'Status step: an entity holding plan assets, 40 percent held by benefit plan investors.'],
  ['planassets-console.png', 'Benefit plan panel: the entity holding plan assets listed with its stated share (40 percent) and its commitment.'],
  ['prefill-status.png', 'Status step prefilled from the benefit plan answer on the investor\'s record.'],
  ['existing-status.png', 'Status step for an investor on file (local mode), prefilled with the ground on file.'],
  ['repack-refused.png', 'Status step: a renamed text file and a 26 MB file refused as the purchaser representative’s acknowledgment, with plain messages, nothing kept.'],
  ['repack-attached.png', 'Status step: the acknowledgment PDF attached ("Attached: acknowledgment.pdf").'],
  ['repack-requests.png', 'Console requests page: "Purchaser representative: Morgan Ellery" with the download, and a representative named without a file.'],
  [/^(regA|entity|accredited2|aggregate)-status\.png$/, 'Status step under Regulation A Tier 2 (D-07): after "not accredited", the one optional statement that the total invested in the offering is within 10 percent of income or net worth (organizations: revenue or net assets); no figures asked.'],
  [/^(tier1|listed|untiered)-status\.png$/, 'Status step under Regulation A Tier 1, Tier 2 listed or untiered: the plain statement of what is asked, no limit where none applies.'],
  [/^(regA|entity|accredited2|aggregate|tier1|listed|untiered)-subscribe\.png$/, 'Subscribe step under Regulation A: when the investor did not attest to the 10 percent limit, the warning that does not block; otherwise nothing about a limit.'],
  ['regA-console.png', 'Console offering page: Investor eligibility panel for Regulation A Tier 2 (non-accredited subscribers, who has not attested to the 10 percent limit, who has).'],
  ['untiered-console.png', 'Console offering page: the exemption field and its hints for an untiered Regulation A offering.'],
  ['flag-requests.png', 'Console requests page: the Regulation A "has not attested" flag on the request rows of investors who did not attest.'],
  ['other-regs-status.png', 'Status step for a Regulation S offering with the firm\'s accredited question on: the accredited question only, answered "no" (no sophistication questions, no warning).'],
  [/^other-off-.*-status\.png$/, 'Status step with the firm\'s accredited question off (Regulation S, Regulation Crowdfunding or Section 4(a)(2)): the benefit plan questions only.'],
  [/^other-off-.*-subscribe\.png$/, 'Subscribe step with the accredited question off: no "is an accredited investor" tick where the exemption is open to all (with a note saying why); the optional tick kept for Section 4(a)(2).'],
  ['back-correct-to-no.png', 'Status step reached with Back while the request is pending, the answer being corrected from "yes" to "no".'],
  ['resume-status.png', 'A flow saved by the earlier version resumes at the Investor status step, step 5 of 10, with the earlier answers kept.'],
  [/^portal-(link|investments|address)-status\.png$/, 'Self-serve portal (plan 06-08): an investor on file who is not accredited, after the offering link, the Investments button or the subscribe address: the guided Investor status step, never the old form with the accredited tick.'],
  ['portal-address-box.png', 'Self-serve portal (plan 06-08): the subscribe address for an investor on file shows only the "Continue your subscription" box, no form and no accredited tick.'],
  ['portal-console-3.png', 'Console offering page after the three portal subscriptions: "Non-accredited purchasers: 3 of 35".'],
  [/^portal-other-.*\.png$/, 'Self-serve portal (plan 06-08): Regulation A, benefit plan, unanswered and withdrawn-ground subscriptions reached from the portal.'],
  ['portal-managed-subscribe.png', 'Managed edition (plan 06-08, C-03): the portal subscribe page unchanged, with its accredited tick.'],
  ['rega-unanswered-status.png', 'Status step under Regulation A Tier 2 (plan 06-11) with the accredited question left unanswered: no statement about the limit is shown.'],
  ['rega-unanswered-subscribe.png', 'Subscribe step (plan 06-11) after the accredited question was left unanswered.'],
  [/^c506never-.*-status\.png$/, 'Status step under Rule 506(c) with the firm\'s rule "Require verified accreditation: Never" and the accreditation toggle off (plan 06-25): the accredited question (self-certified), then the benefit plan question.'],
  [/^c506never-.*-subscribe\.png$/, 'Subscribe step under Rule 506(c) with the rule Never (plan 06-25): the statement follows the answer (accredited with its ground, not accredited, or none when left open).'],
  ['c506never-integrations.png', 'Console Integrations page (plan 06-25): "Require verified accreditation: Never" with the note that Rule 506(c) allows accredited investors only and that the reasonable verification steps are the sponsor\'s responsibility.'],
  ['c506never-requests.png', 'Console requests page (plan 06-25): the three Rule 506(c) subscriptions under the rule Never, each flagged with what the sponsor still has to do.'],
  ['rega-unanswered-console.png', 'Console offering page (plan 06-11): the Regulation A panel names the Tier 2 subscriber who left the accredited question unanswered, in one line.']
]);
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

/**
 * A Regulation A case end to end: the sample portal, the exemption chosen with the console's select (o.direct: stored as
 * document intake would, without the select), o.before(page, off) for any set-up, the invitation (o.invite(page, off) for
 * an investor on file), o.afterInvite(page, off, inv), then the walk with o.acc / o.basis / o.attest (tick the Tier 2 statement) / o.amount. R keeps
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
        // D-07: one optional statement, no figures and no limit worked out.
        R.attestQ = await p.locator('#ob-stRaAttest').count();
        R.attestBefore = R.attestQ ? await p.locator('#ob-stRaAttest').isChecked() : null;
        R.attestText = R.attestQ ? await p.locator('label[for="ob-stRaAttest"]').innerText() : '';
        if (o.attest && R.attestQ) await p.check('#ob-stRaAttest');
        R.figFields = await p.locator('#ob-stIncome, #ob-stWorth, #ob-stRevenue, #ob-stAssets, input[name="ob-stRaKind"]').count();
        R.limit = (await p.locator('#ra-limit').count()) ? await p.locator('#ra-limit').innerText() : null;
        R.soph = await p.locator('#ob-stExp, #ob-stEdu, input[name="ob-stRep"]').count();
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

/** The Regulation A request flag's wording (D-07). */
const RA_FLAG = /Not accredited and has not attested to the Regulation A Tier 2 limit \(10 percent of income or net worth\)/;
/** The statement a person ticks under Tier 2 (D-07). */
const RA_PERSON = /The total I am investing in this offering, counting anything I already hold or have subscribed for in it, is not more than 10 percent of my annual income or my net worth \(not counting my primary residence\), whichever is greater\./;
/** The subscribe step's warning when the investor did not attest. */
const RA_WARN = /You have not confirmed that your total investment in this offering is within your limit under Regulation A/;
const reEsc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

/** The agreement on screen: Finish (D-30: nothing on it is required), then the done screen's text (plan 06-15: no summary list; an older tree has one). */
async function finishAgreement(page) {
  await page.waitForSelector('.es-finish', { timeout: 30000 });
  await page.click('.es-finish');
  await page.waitForSelector('.ivf-done .ivf-need, .ivf-done .ivf-summary', { timeout: 30000 });
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
        r.qual = { regime: '506b', at: new Date().toISOString(), accredited: false, basis: '', sophistication: { knowledge: 'alone', rep: null } };
        out.push({ investorId: i.id, requestId: r.id });
      }
      NS.app.save(true);
      return out;
    },
    { offeringId, n, prefix }
  );

/* ---------- Plan 06-08: the self-serve portal's own subscribe entry points (verifier gap 1) ---------- */

/**
 * n active investors on file with no invitation and no holding or request in the offering, individuals first, each left
 * without an accreditation ground, as the status step leaves an investor who answered no. Returns [{ id, name, title,
 * type, email, basis }].
 */
const onFile = (page, offeringId, n) =>
  page.evaluate(
    ({ oid, n }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const ok = (x) => x.onboarding && x.onboarding.status === 'complete' && x.email && !(x.positions || []).some((y) => y.offeringId === oid) && !(ws.invitations || []).some((t) => t.investorId === x.id) && !(ws.requests || []).some((r) => r.investorId === x.id && r.offeringId === oid);
      const list = ws.investors
        .filter(ok)
        .sort((a, b) => (a.type === 'individual' ? 0 : 1) - (b.type === 'individual' ? 0 : 1))
        .slice(0, n);
      list.forEach((i) => (i.accreditation = { basis: '', date: '' }));
      NS.app.save(true);
      return list.map((i) => ({ id: i.id, name: i.contact, title: i.title, type: i.type, email: i.email, basis: i.accreditation.basis }));
    },
    { oid: offeringId, n }
  );

/** Signed in as the investor (the portal's own session), on the given route. */
const asInvestor = (page, investorId, route) =>
  page.evaluate(
    ({ id, route }) => {
      const NS = window.CVPortal;
      NS.state.role = 'investor';
      NS.store.set('role', 'investor');
      NS.state.viewer = id;
      NS.app.go(route);
    },
    { id: investorId, route }
  );

/** The firm's offering link (#join-<offering>) filled in with an investor on file's name and email. */
async function joinFromLink(page, offeringId, who) {
  await page.evaluate((id) => (location.hash = 'join-' + id), offeringId);
  await page.waitForSelector('form[data-form=join]', { timeout: 20000 });
  const n = String(who.name).split(' ');
  await page.fill('#jn-name', n[0]);
  await page.fill('#jn-last', n.slice(1).join(' ') || n[0]);
  await page.fill('#jn-email', who.email);
  await page.check('#jn-consent');
  await page.click('form[data-form=join] button[type=submit]');
  await page.waitForTimeout(900);
}

/** Signed in as the investor, the Investments page's subscribe control for the offering. false when it is not offered. */
async function fromInvestments(page, offeringId, who) {
  await asInvestor(page, who.id, 'investments');
  await page.waitForTimeout(700);
  const ctl = page.locator(`[data-action=sub-start][data-id="${offeringId}"], a[href="#subscribe-${offeringId}"]`).first();
  if (!(await ctl.count())) return false;
  await ctl.click();
  await page.waitForTimeout(900);
  return true;
}

/** No "is an accredited investor" statement and no #sb-acc tick on the screen now shown. */
async function noAccTick(page) {
  const text = await L.screenText(page);
  const sbAcc = await page.locator('#sb-acc').count();
  return { ok: !/is an accredited investor/.test(text) && sbAcc === 0, sbAcc, text };
}

/** The invitation the screen now shows (#invite-<token>), or null. */
const shownInvitation = (page) =>
  page.evaluate(() => {
    const tok = location.hash.replace(/^#invite-/, '');
    const x = (window.CVPortal.state.ws.invitations || []).find((y) => y.token && y.token === tok);
    return x ? { id: x.id, offeringId: x.offeringId, investorId: x.investorId, existing: !!x.existing, sentBy: x.sentBy, status: x.status } : null;
  });

/**
 * After a portal entry point: the screen must be the guided subscription of an investor on file for this offering (never
 * the old form), walked with answers (default: not accredited, the sophistication answers, no representative), the
 * agreement signed. Returns { st, sub, done, req, texts } or null when the flow was not reached.
 */
async function guidedFromPortal(p, check, tag, who, offeringId, answers, shot) {
  const first = await noAccTick(p);
  check(`${tag}: no "is an accredited investor" statement and no #sb-acc on the screen the entry point opens`, first.ok, { sbAcc: first.sbAcc, text: first.text.slice(0, 700) });
  const inFlow = await p.waitForSelector('.ivf-form h1', { timeout: 6000 }).then(
    () => true,
    () => false
  );
  check(`${tag}: the entry point opens the guided subscription`, inFlow, first.text.slice(0, 500));
  if (!inFlow) return null;
  const it = await shownInvitation(p);
  check(`${tag}: the guided subscription is the investor's own, for this offering, as an investor on file`, !!it && it.offeringId === offeringId && it.investorId === who.id && it.existing, it);
  const texts = [];
  const R = { st: '', sub: '' };
  const a = Object.assign({ name: who.name, acc: 'no', exp: 'Ten years of private real estate fund commitments', edu: 'Accountant', rep: 'no', amount: 60000 }, answers || {});
  const userFilled = a.onFilled;
  const userStep = a.onStep;
  a.onStep = async (hd) => {
    texts.push(await L.screenText(p));
    if (userStep) await userStep(hd);
  };
  a.onFilled = async (hd) => {
    if (hd === 'Investor status') {
      R.st = await L.screenText(p);
      if (shot) await p.screenshot({ path: path.join(SHOTS, `${shot}-status.png`), fullPage: true });
    }
    if (hd === 'Subscription') R.sub = await L.screenText(p);
    if (userFilled) await userFilled(hd);
  };
  const w = await L.walk(p, a);
  const heads = w.seen.map((s) => s.split(' | ').pop());
  check(`${tag}: the steps of an investor on file: welcome, Investor status, subscription, agreement`, w.reached && w.errors.length === 0 && /^Welcome/.test(heads[0]) && heads.slice(1).join(',') === 'Investor status,Subscription,Subscription agreement', { seen: w.seen, errors: w.errors });
  check(`${tag}: no screen of the flow asks for the "is an accredited investor" statement`, !texts.concat(R.sub).some((t) => /is an accredited investor/.test(t)) || a.acc === 'yes', texts.map((t) => (t.match(/[^\n]*is an accredited investor[^\n]*/) || [''])[0]).filter(Boolean));
  const req = w.reached ? await requestOf(p, who.id, offeringId) : null;
  const done = w.reached ? await finishAgreement(p) : '';
  const lk = L.leakCheck(texts.concat(R.sub, done).join('\n'));
  check(`${tag}: white label: every screen of the flow passes the leak check`, lk.ok, lk.hits);
  return { st: R.st, sub: R.sub, done, req, texts, w };
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
      soph: 'rep',
      repName: 'Morgan Ellery',
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
    // D-08 (2) (owner, plan 06-15): only Rule 506(b)(2)(ii)'s question and, with a representative, who it is (Rule 501(i)).
    check('the status step asks the accredited question and Rule 506(b)(2)(ii)’s question, and the representative’s name; no experience, education or firm questions', /Is Dana Whitfield an accredited investor\?/.test(st) && /alone or with a purchaser representative, have enough knowledge and experience of business and financial matters to judge the merits and risks of this investment\?/.test(st) && /Purchaser representative’s name/.test(st) && !/investment experience/i.test(st) && !/education or profession/i.test(st) && !/Representative.s firm/.test(st), st.slice(0, 1200));
    // D-06 (plan 06-15): the lede explaining the firm's reasons is gone.
    check('D-06: no lede on the Rule 506(b) status step', !/may accept a limited number of investors/.test(st) && !/leave any question unanswered/i.test(st), st.slice(0, 600));
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
    check('request.qual carries the sophistication answer (with a representative) and the representative’s name, nothing else (D-08 (2))', so.knowledge === 'rep' && !!so.rep && so.rep.name === answers.repName && so.rep.firm === undefined && so.experience === undefined && so.education === undefined, q);
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
   * C-01: 35 purchasers who are not accredited are already counted; a 36th answering no is not warned (owner, plan 06-15:
   * the investor-side warning is removed), still subscribes, and the sponsor sees 36 of 35 with the red badge and the flag on the request. Declining one brings
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
    // Owner (plan 06-15): the investor-side "506(b) may be full" warning is removed; the sponsor's N of 35 flag stays.
    check('no warning on the status step, before or after answering no', warnBeforeNo === 0 && warn === '' && !/may already have as many investors/.test(st), { warnBeforeNo, warn });
    check('the status step names no other investor (T-06-04)', !/Seeded Purchaser/.test(st), st.slice(0, 1500));
    const leakSt = L.leakCheck(st);
    check('white label: the status screen passes the leak check', leakSt.ok, leakSt.hits);
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
    // D-06 (plan 06-15): the done screen's summary list is removed; what is still open is under "What happens next".
    check('the done screen shows what happens next and no summary list (no Accreditation row)', /What happens next/.test(done) && !/Accreditation/.test(done), done);
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
    // D-06 (plan 06-15): the done screen's summary list is removed; what is still open is under "What happens next".
    check('the done screen shows what happens next and no summary list (no Accreditation row)', /What happens next/.test(done) && !/Accreditation/.test(done), done);
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
   * D-01, D-08 (1) (plan 06-15): an IRA investor in a Rule 506(c) offering goes through the verification step as before, then
   * the status step shows only the one benefit plan question, prefilled as a Code section 4975 plan. The sponsor's panel lists
   * the IRA with its pending subscription, then, once approved, with its commitment; no percentage, no flag on the request.
   * None of it reaches the investor's screens (T-06-09).
   */
  async erisa({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(c)' });
    check('the offering is Rule 506(c) with its agreement ready', off.ready && off.exemption === 'Rule 506(c)', off);
    await p.evaluate((oid) => {
      const NS = window.CVPortal;
      NS.state.ws.investors.forEach((i) => {
        if ((i.positions || []).some((x) => x.offeringId === oid)) i.erisa = { plan: 'none', planPct: null, at: new Date().toISOString() };
      });
      NS.app.save(true);
    }, off.offeringId);
    const cents = 25000000;
    const name = 'Harbor Trust Co. FBO Dana Whitfield IRA';
    const inv = await L.createInvitation(p, { name: INV.name, email: INV.email, type: 'ira', account: name, offeringId: off.offeringId, cents });
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
    // D-08 (1) (owner, plan 06-15): one question (yes as one of the three kinds of benefit plan investor, or no); no control question; no lede.
    check('under Rule 506(c) the status step shows only the one benefit plan question (four choices), no control question, no lede', R.accQ === 0 && R.planQ === 4 && R.ctrlQ === 0 && /Is Harbor Trust Co\. FBO Dana Whitfield IRA a benefit plan investor\?/.test(R.status || '') && !/verified in its own step|leave any question unanswered|25 percent/.test(R.status || ''), { accQ: R.accQ, planQ: R.planQ, ctrlQ: R.ctrlQ, st: (R.status || '').slice(0, 1200) });
    check('the IRA is prefilled as a plan or account under Code section 4975', R.pre === '4975', R.pre);
    check('the IRA examples are named on the 4975 choice', /section 4975 of the Internal Revenue Code/.test(R.status || '') && /Such as an IRA or a Keogh plan/.test(R.status || ''), (R.status || '').slice(0, 1500));
    check('T-06-09: no figure or other investor reaches the investor screens', !/% of value|benefit plan investors would hold|committed/.test((R.status || '') + (R.sub || '')), '');
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const e = (r && r.qual && r.qual.erisa) || {};
    check('request.qual.erisa is exactly { plan: 4975, planPct: null }', !!r && JSON.stringify(e) === '{"plan":"4975","planPct":null}', r && r.qual);
    const rec = await p.evaluate((id) => (window.CVPortal.state.ws.investors.find((x) => x.id === id) || {}).erisa || null, inv.investorId);
    check('the investor record keeps the answer to prefill the next subscription (no control answer)', !!rec && rec.plan === '4975' && rec.planPct === null && !('controlling' in rec) && /^\d{4}-\d{2}-\d{2}T/.test(rec.at || ''), rec);
    check('the change log records the benefit plan answer', !!r && r.log.some((x) => x.action === 'Investor status answered' && /benefit plan: a plan or account under Code section 4975/.test(x.detail) && !/control/.test(x.detail)), r && r.log);
    const done = await finishAgreement(p);
    await consoleOffering(p, off.offeringId);
    const field = await exemptionField(p);
    check('the exemption hint carries the Rule 506(c) note under Rule 506(c)', /Rule 506\(c\) offerings take verified accredited investors only/.test(field.hints), field.hints);
    let bp = await panelText(p, 'Benefit plan investors');
    await p.screenshot({ path: path.join(SHOTS, 'erisa-console-pending.png'), fullPage: true });
    const row = (id) => p.evaluate((iid) => (document.querySelector(`.cs-bpi-row[data-investor="${CSS.escape(iid)}"]`) || {}).innerText || '', id);
    let line = await row(inv.investorId);
    check('the panel lists exactly the one investor who answered yes: the IRA, its answer and its pending subscription ($250,000 pending)', (await p.locator('.cs-bpi-row').count()) === 1 && line.indexOf(name) >= 0 && /Code section 4975/.test(line) && /\$250,000 pending/.test(line), { line, bp: bp.slice(0, 800) });
    check('D-08 (1): no percentage, no if-accepted figure, no value basis and no controlling marks on the panel', !/%|If accepted|capital balances|commitments and subscribed amounts|Controlling persons/.test(bp) && (await p.locator('[data-action=bpi-ctrl], .cs-bpi-if, .cs-bpi-line').count()) === 0, bp);
    await consoleRequests(p);
    const rowText = await requestRow(p, r.id);
    await p.screenshot({ path: path.join(SHOTS, 'erisa-requests.png'), fullPage: true });
    check('the request row carries no benefit plan flag; Approve and Decline are there', !/benefit plan/i.test(rowText) && (await p.locator(`[data-action=req-approve][data-id="${r.id}"]`).count()) === 1 && (await p.locator(`[data-action=req-decline][data-id="${r.id}"]`).count()) === 1, rowText);
    const lkRow = L.leakCheck(await L.screenText(p));
    for (let k = 0; k < 2; k++) {
      if ((await p.evaluate((id) => (window.CVPortal.state.ws.requests.find((x) => x.id === id) || {}).status, r.id)) !== 'pending') break;
      await p.click(`[data-action=req-approve][data-id="${r.id}"]`);
      await p.waitForTimeout(400);
    }
    const st = await p.evaluate((id) => (window.CVPortal.state.ws.requests.find((x) => x.id === id) || {}).status, r.id);
    check('Approve works', st === 'approved', st);
    await consoleOffering(p, off.offeringId);
    bp = await panelText(p, 'Benefit plan investors');
    line = await row(inv.investorId);
    await p.screenshot({ path: path.join(SHOTS, 'erisa-console-approved.png'), fullPage: true });
    check('after approval the IRA is listed with $250,000 committed and nothing pending', /\$250,000 committed/.test(line) && !/pending/.test(line), line);
    const lk = L.leakCheck([R.status, R.sub, done, bp].join('\n'));
    check('white label: status, subscribe, done screens and the panel pass the leak check', lk.ok, lk.hits);
    check('white label: the requests view passes the leak check', lkRow.ok, lkRow.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * D-08 (1) (plan 06-15): an entity holding plan assets answers yes and gives the share of its equity held by benefit plan
   * investors (40); the sponsor's list shows it with that share and its commitment. A stored share that does not count is
   * shown as not given; the entity stays listed (it answered yes).
   */
  async planassets({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const X = 100000000;
    const name = 'Alder Ridge Holdings LLC';
    const inv = await L.createInvitation(p, { name, email: 'alder.ridge@example.com', type: 'entity', offeringId: off.offeringId, cents: X });
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    const R = {};
    const w = await L.walk(p, {
      name,
      onStep: async (hd) => {
        if (hd !== 'Investor status') return;
        await p.check('input[name="ob-stPlan"][value="planAssets"]');
        await p.waitForSelector('#ob-stPlanPct', { timeout: 10000 });
        await p.fill('#ob-stPlanPct', '40');
        R.status = await L.screenText(p);
        await p.screenshot({ path: path.join(SHOTS, 'planassets-status.png'), fullPage: true });
      }
    });
    check('the entity answers 40 percent on the status step and reaches the agreement with no field error', w.reached && w.errors.length === 0, { seen: w.seen, errors: w.errors });
    check('the share field has no hint beyond its label (D-06)', /Share of the entity’s equity held by benefit plan investors \(%\)/.test(R.status || '') && !/Only that part of this investment/.test(R.status || ''), (R.status || '').slice(0, 1200));
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const e = (r && r.qual && r.qual.erisa) || {};
    check('request.qual.erisa is exactly { plan: planAssets, planPct: 40 }', JSON.stringify(e) === '{"plan":"planAssets","planPct":40}', r && r.qual);
    await consoleOffering(p, off.offeringId);
    const row = () => p.evaluate((iid) => (document.querySelector(`.cs-bpi-row[data-investor="${CSS.escape(iid)}"]`) || {}).innerText || '', inv.investorId);
    let line = await row();
    check('the panel lists the entity with its stated share and its pending $1,000,000', line.indexOf(name) >= 0 && /Entity holding plan assets, 40% of its equity held by benefit plan investors/.test(line) && /\$1,000,000 pending/.test(line), line);
    // A stored share that does not count (T-06-12): the entity stays listed, its share shown as not given.
    await p.evaluate(({ rid, iid }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const q = ws.requests.find((x) => x.id === rid).qual;
      q.erisa = Object.assign({}, q.erisa, { planPct: 140 });
      NS.app.save(true);
      NS.app.render();
    }, { rid: r.id, iid: inv.investorId });
    await p.waitForTimeout(400);
    line = await row();
    check('a stored share of 140 is shown as not given; the entity stays listed', /share held by benefit plan investors not given/.test(line) && !/140/.test(line), line);
    await p.screenshot({ path: path.join(SHOTS, 'planassets-console.png'), fullPage: true });
    const lk = L.leakCheck([R.status, await L.screenText(p)].join('\n'));
    check('white label: the status step and the console page pass the leak check', lk.ok, lk.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * D-08 (1) (plan 06-15): holders of the sample offering with no benefit plan answer, or answering no, are not on the list;
   * the one holder whose record says a section 4975 plan is listed with its commitment on the books.
   */
  async 'erisa-unanswered'({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const set = await p.evaluate((oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const hs = ws.investors.filter((i) => (i.positions || []).some((x) => x.offeringId === oid && !x.redeemed));
      const iras = hs.filter((i) => i.type === 'ira');
      const open = [iras[0], hs.find((i) => i.type === 'individual'), hs.find((i) => i.type === 'entity' || i.type === 'trust')].filter(Boolean);
      const plan = iras[1];
      hs.forEach((i) => {
        delete i.erisa;
        if (open.indexOf(i) >= 0) return;
        i.erisa = { plan: i === plan ? '4975' : 'none', planPct: null, at: new Date().toISOString() };
      });
      NS.app.save(true);
      const commit = plan ? (plan.positions || []).filter((x) => x.offeringId === oid && !x.redeemed).reduce((t, x) => t + Math.round((x.commitment != null ? x.commitment : x.amount) * 100), 0) : 0;
      return { open: open.map((i) => ({ id: i.id, title: i.title })), plan: plan && { id: plan.id, title: plan.title }, commit, usd: NS.eligibility.usd(commit), holders: hs.length };
    }, off.offeringId);
    check('the sample offering: three holders (an IRA among them) without answers, one IRA answering a section 4975 plan', set.open.length === 3 && !!set.plan && set.commit > 0, set);
    await consoleOffering(p, off.offeringId);
    const bp = await panelText(p, 'Benefit plan investors');
    const rows = await p.evaluate(() => Array.from(document.querySelectorAll('.cs-bpi-row')).map((x) => ({ id: x.getAttribute('data-investor'), text: x.innerText })));
    await p.screenshot({ path: path.join(SHOTS, 'unanswered-console.png'), fullPage: true });
    check(`the list holds only the IRA that answered yes, with ${set.usd} committed`, rows.length === 1 && rows[0].id === set.plan.id && rows[0].text.indexOf(`${set.usd} committed`) >= 0, { rows, set });
    check('holders without answers and holders answering no are not listed, and no figure is worked out', set.open.every((x) => bp.indexOf(x.title) < 0) && !/%|Not answered/.test(bp), bp);
    const lk = L.leakCheck(await L.screenText(p));
    check('white label: the console page passes the leak check', lk.ok, lk.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** Plan 06-05, D-01: an investor on file sees their earlier benefit plan answers prefilled, changes one, and the request carries it. */
  async 'erisa-prefill'({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    const who = await p.evaluate((oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const i = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.email && x.type !== 'ira' && !(x.positions || []).some((y) => y.offeringId === oid));
      if (!i) return null;
      i.erisa = { plan: 'title1', planPct: null, at: '2026-01-15T12:00:00Z' };
      NS.app.save(true);
      return { id: i.id, name: i.contact, title: i.title, email: i.email };
    }, off.offeringId);
    check('an investor on file, not holding the offering, whose record says a plan under Title I of ERISA', !!who, who);
    if (!who) return A.context.close();
    const inv = await L.createInvitation(p, { name: who.name, email: who.email, offeringId: off.offeringId, cents: 0 });
    check('the invitation is to subscribe (the investor is on file)', inv.investorId === who.id, inv);
    await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
    const R = {};
    const w = await L.walk(p, {
      name: who.name,
      amount: 60000,
      onStep: async (hd) => {
        if (hd !== 'Investor status') return;
        R.pre = await p.evaluate(() => ({ plan: (document.querySelector('input[name="ob-stPlan"]:checked') || {}).value || '', ctrl: document.querySelectorAll('input[name="ob-stCtrl"]').length }));
        await p.screenshot({ path: path.join(SHOTS, 'prefill-status.png'), fullPage: true });
        await p.check('input[name="ob-stPlan"][value="none"]');
        await p.waitForTimeout(200);
        R.status = await L.screenText(p);
      }
    });
    check('the investor reaches the agreement with no field error', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    check('the earlier answer is prefilled: Title I plan; no control question (D-08 (1))', !!R.pre && R.pre.plan === 'title1' && R.pre.ctrl === 0, R.pre);
    const r = await requestOf(p, who.id, off.offeringId);
    const e = (r && r.qual && r.qual.erisa) || {};
    check('the new request carries the answer given (no), exactly { plan: none, planPct: null }', JSON.stringify(e) === '{"plan":"none","planPct":null}', r && r.qual);
    const rec = await p.evaluate((id) => (window.CVPortal.state.ws.investors.find((x) => x.id === id) || {}).erisa || null, who.id);
    check('the investor record now holds the changed answer', !!rec && rec.plan === 'none' && rec.at !== '2026-01-15T12:00:00Z', rec);
    const lk = L.leakCheck(R.status || '');
    check('white label: the status step passes the leak check', lk.ok, lk.hits);
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
        await p.screenshot({ path: path.join(SHOTS, 'other-regs-status.png'), fullPage: true });
      }
    });
    check('toggle on: the Regulation S flow has the status step and reaches the agreement', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    check('toggle on: the accredited question only (no sophistication questions, no limit warning) after answering no', soph === 0 && /an accredited investor\?/.test(st) && !/Rule 506\(b\)/.test(st) && (await p.locator('input[name="ob-stSoph"]').count()) === 0, { soph, st: st.slice(0, 900) });
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const q = (r && r.qual) || {};
    check('request.qual: regime other, accredited false, no sophistication answers', q.regime === 'other' && q.accredited === false && !q.sophistication, q);
    const done = await finishAgreement(p);
    // D-06 (plan 06-15): the done screen's summary list is removed; what is still open is under "What happens next".
    check('the done screen shows what happens next and no summary list (no Accreditation row)', /What happens next/.test(done) && !/Accreditation/.test(done), done);
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
          await p.screenshot({ path: path.join(SHOTS, `other-off-${exemption.replace(/\W+/g, '-').toLowerCase()}-subscribe.png`), fullPage: true });
        },
        onFilled: async (hd) => {
          if (hd !== 'Investor status') return;
          R.st = await L.screenText(p);
          R.accQ = await p.locator('input[name="ob-stAcc"]').count();
          await p.screenshot({ path: path.join(SHOTS, `other-off-${exemption.replace(/\W+/g, '-').toLowerCase()}-status.png`), fullPage: true });
        }
      });
      return R;
    };
    const s2 = await offWalk('Regulation S', 'Lee Ortiz', 'lee.ortiz@example.com');
    const w2 = s2.w;
    // Plan 06-04, D-01: every invitation with an offering now has the status step for the benefit plan questions; with the
    // toggle off it asks nothing about accreditation (before 06-04 there was no status step here).
    check('toggle off: the status step asks only the benefit plan question, and the investor reaches the agreement', w2.reached && w2.errors.length === 0 && w2.seen.some((s) => /\| Investor status$/.test(s)) && s2.accQ === 0 && /Is Lee Ortiz a benefit plan investor\?/.test(s2.st), { seen: w2.seen, errors: w2.errors, q2: s2.accQ, st2: s2.st.slice(0, 900) });
    // Rule 1 fix with plan 06-05: Regulation S and Regulation Crowdfunding are not limited to accredited investors, so with the
    // toggle off the subscribe step offers no accreditation tick and says why (as 06-04 did for Reg A Tier 1 and listed Tier 2).
    // Owner (plan 06-15): where no accreditation statement is asked, the tick is left out with no sentence saying why.
    check('toggle off, Regulation S: the subscribe step offers no "is an accredited investor" tick and no note about it', s2.subAcc === 0 && !/is an accredited investor/.test(s2.sub) && !/not limited to accredited investors/.test(s2.sub) && (await p.locator('.ivf-acc-open').count()) === 0, { subAcc: s2.subAcc, sub: s2.sub.slice(0, 1500) });
    const cf = await offWalk('Regulation Crowdfunding', 'Rae Lindgren', 'rae.lindgren@example.com');
    check('toggle off, Regulation Crowdfunding: the investor reaches the agreement with no field error', cf.w.reached && cf.w.errors.length === 0 && cf.accQ === 0, { seen: cf.w.seen, errors: cf.w.errors, accQ: cf.accQ });
    check('toggle off, Regulation Crowdfunding: no "is an accredited investor" tick and no note about it', cf.subAcc === 0 && !/is an accredited investor/.test(cf.sub) && !/open to investors who are not accredited/.test(cf.sub), { subAcc: cf.subAcc, sub: cf.sub.slice(0, 1500) });
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
    // D-06 (plan 06-15): the done screen's summary list is removed; what is still open is under "What happens next".
    check('the done screen shows what happens next and no summary list (no Accreditation row)', /What happens next/.test(done) && !/Accreditation/.test(done), done);
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
    await p.screenshot({ path: path.join(SHOTS, 'back-correct-to-no.png'), fullPage: true });
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
    // The sponsor decides the subscription: the request is no longer pending. Plan 06-34 (plan-check B2): its agreement is not
    // signed (the investor stopped at it), and an unsigned subscription can never be approved, so the sponsor declines it; this
    // used to approve it unsigned. What is tested (a decided request keeps its answers) is the same.
    await p.evaluate((rid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      NS.ops.decide(ws, ws.requests.find((x) => x.id === rid), false, 'Declined by the manager');
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
      soph: 'rep',
      repName: 'Morgan Ellery',
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
    check('the status step offers the acknowledgment upload under the representative’s name, marked optional', R.input === 1 && /written acknowledgment that this person is your purchaser representative/.test(R.label) && /Optional/.test(R.label), R.label);
    check('a text file renamed .pdf is refused with a plain message and nothing is stored', /not a PDF, PNG or JPEG/.test(R.textMsg) && !R.textId && R.textStored && R.textStored.length === 0, { msg: R.textMsg, id: R.textId, stored: R.textStored });
    check('a 26 MB file is refused with a plain message and nothing is stored', /26 MB, more than the 25 MB/.test(R.bigMsg) && !R.bigId && R.bigStored && R.bigStored.length === 0, { msg: R.bigMsg, id: R.bigId, stored: R.bigStored });
    check('a PDF is accepted and stored as rep-{investor id}-{time in base 36}', !R.okMsg && new RegExp(`^rep-${inv.investorId}-[0-9a-z]+$`).test(R.okId) && R.okStored.length === 1 && R.okStored[0] === R.okId && /Attached: acknowledgment\.pdf/.test(R.hint), R);
    check('the investor continues to the agreement with no field error', w.reached && w.errors.length === 0, { seen: w.seen, errors: w.errors });
    const leak = L.leakCheck(R.screen || '');
    check('white label: the status screen with the upload passes the leak check', leak.ok, leak.hits);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    const rep = (r && r.qual && r.qual.sophistication && r.qual.sophistication.rep) || {};
    check('qual.sophistication.rep has name, fileId and fileName (no firm: D-08 (2))', rep.name === 'Morgan Ellery' && rep.firm === undefined && rep.fileId === R.okId && rep.fileName === 'acknowledgment.pdf', rep);
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
    // D-08 (2) (plan 06-15): the representative is identified by name; a firm on an earlier version's request still shows (below).
    check('the request row shows "Purchaser representative: Morgan Ellery" and the download', /Purchaser representative: Morgan Ellery ·/.test(row) && /Download the written acknowledgment/.test(row), row);
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
    await p.screenshot({ path: path.join(SHOTS, 'resume-status.png'), fullPage: true });
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
   * D-07, C-01, C-04: the sponsor picks Regulation A Tier 2 on the offering page; a person who is not accredited sees one
   * optional statement (no figures), leaves it unticked, is warned on the subscribe step and still subscribes; the request
   * keeps attested false; the sponsor's panel and the request row show the investor has not attested.
   */
  async regA({ check, S }) {
    const { A, p, off, inv, w, R, ex } = await regAFlow(S, { exemption: 'Regulation A Tier 2', tag: 'regA', acc: 'no', amount: 50000 });
    check('the offering page’s select offers the three Regulation A choices and stores "Regulation A Tier 2"', ex.stored === 'Regulation A Tier 2' && ex.selected === 'Regulation A Tier 2' && ['Regulation A Tier 1', 'Regulation A Tier 2', 'Regulation A Tier 2, exchange-listed'].every((v) => ex.options.indexOf(v) >= 0) && ex.options.indexOf('Regulation A') < 0, ex);
    check('the investor reaches the subscription agreement with no field error (nothing on the step is required)', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    check('after "not accredited" the status step shows the one statement for a person, not ticked', R.attestQ === 1 && R.attestBefore === false && RA_PERSON.test(R.attestText), R);
    check('no figure fields, no person-or-organization choice and no limit line; no Rule 506(b) sophistication questions', R.figFields === 0 && R.limit === null && R.soph === 0, R);
    // D-06 (plan 06-15): the notice of the limit stays (Rule 251(d)(2)(i)(C)); the sentence saying the firm asks for a confirmation goes (the statement itself asks).
    check('the step gives the notice of the limit', /limited to 10 percent of your annual income or your net worth, whichever is greater/.test(R.status || '') && !/asks you to confirm that your investment is within that limit/.test(R.status || ''), (R.status || '').slice(0, 1500));
    // D-06 (plan 06-15): the warning keeps what is missing; "You can still subscribe ..." goes (Continue shows it), the walk shows it does not block.
    check('the subscribe step warns plainly that the investor has not confirmed the limit, with no amount worked out and nothing blocked', RA_WARN.test(R.warn || '') && !/You can still subscribe/.test(R.warn || '') && !/\$/.test(R.raSub || '') && w.reached, R.raSub);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    check('request.qual: regime regA2, accredited false, regA exactly { attested: false }', !!r && r.qual.regime === 'regA2' && r.qual.accredited === false && JSON.stringify(r.qual.regA) === '{"attested":false}', r && r.qual);
    check('the change log says the investor did not attest (T-06-08)', !!r && r.log.some((e) => e.action === 'Investor status answered' && /Regulation A Tier 2: did not attest that the total invested in this offering is within 10 percent/.test(e.detail)), r && r.log);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    await p.screenshot({ path: path.join(SHOTS, 'regA-console.png'), fullPage: true });
    check('the console panel: "Regulation A Tier 2: 1 non-accredited subscriber, 1 not attested to the 10 percent limit"', /Regulation A Tier 2: 1 non-accredited subscriber, 1 not attested to the 10 percent limit/.test(el), el);
    check('the panel names the investor as not attested, with the warning badge, and shows no amount or limit', /Not attested\s*Dana Whitfield has not attested that this investment is within their 10 percent limit/.test(el) && (await p.locator('.cs-panel .cs-elig-noattest .cs-badge-warn').count()) === 1 && !/\$/.test(el), el);
    check('no Rule 506(b) count on a Regulation A offering', !/Non-accredited purchasers/.test(el), el);
    const cons = await L.screenText(p);
    await consoleRequests(p);
    const row = await requestRow(p, r && r.id);
    check('the request row carries the "has not attested" flag; Approve and Decline kept', RA_FLAG.test(row) && (await p.locator(`[data-action=req-approve][data-id="${r && r.id}"]`).count()) === 1 && (await p.locator(`[data-action=req-decline][data-id="${r && r.id}"]`).count()) === 1, row);
    [['status', R.status], ['subscribe', R.sub], ['console', cons]].forEach(([k, t]) => {
      const lk = L.leakCheck(t || '');
      check(`white label: the ${k} screen passes the leak check`, !!t && lk.ok, lk.hits);
    });
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** D-07: an LLC on file sees the statement for an organization (revenue or net assets), ticks it, and is not warned or flagged. */
  async entity({ check, S }) {
    let who = null;
    const F = await regAFlow(S, {
      exemption: 'Regulation A Tier 2',
      tag: 'entity',
      acc: 'no',
      attest: true,
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
    check('the LLC sees the statement for an organization, naming it: revenue or net assets for the most recent fiscal year', R.attestQ === 1 && new RegExp('^The total ' + reEsc(who.title) + ' is investing in this offering, counting anything it already holds or has subscribed for in it, is not more than 10 percent of its revenue or its net assets for the most recent fiscal year, whichever is greater\\.').test(R.attestText) && R.figFields === 0, R);
    check('ticked: no warning on the subscribe step', !R.warn && !R.raSub, R);
    const r = await requestOf(p, who.id, off.offeringId);
    check('request.qual.regA is exactly { attested: true }', !!r && r.qual.accredited === false && JSON.stringify(r.qual.regA) === '{"attested":true}', r && r.qual);
    check('the change log says the investor attested', !!r && r.log.some((e) => e.action === 'Investor status answered' && /Regulation A Tier 2: attested that the total invested in this offering is within 10 percent/.test(e.detail)), r && r.log);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    check('the panel: 1 non-accredited subscriber, 0 not attested, the LLC named as attested, nobody listed as not attested', /Regulation A Tier 2: 1 non-accredited subscriber, 0 not attested to the 10 percent limit/.test(el) && new RegExp('Attested to the 10 percent limit: ' + reEsc(who.title)).test(el) && (await p.locator('.cs-elig-noattest').count()) === 0, el);
    await consoleRequests(p);
    const row = await requestRow(p, r && r.id);
    check('the request row carries no Regulation A flag', !!row && !RA_FLAG.test(row), row);
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
    check('answered yes: no Tier 2 statement, no figure fields and no limit line on the status step', R.attestQ === 0 && R.figFields === 0 && R.limit === null && /Which ground applies\?/.test(R.status), R);
    check('the subscribe step shows no limit and no warning', !R.raSub && !R.warn && !/investment limit/.test(R.sub), R.raSub);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    check('request.qual: regA2, accredited true, no regA', !!r && r.qual.regime === 'regA2' && r.qual.accredited === true && r.qual.regA === undefined, r && r.qual);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    check('the panel counts no non-accredited subscriber', /Regulation A Tier 2: 0 non-accredited subscribers, 0 not attested to the 10 percent limit/.test(el), el);
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
    check('the status step asks only the benefit plan questions, and the investor reaches the agreement', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)) && R.accQ === 0 && R.planQ === 4 && R.figFields === 0 && R.attestQ === 0, { seen: w.seen, errors: w.errors, accQ: R.accQ, planQ: R.planQ });
    // Rule 1 fix with plan 06-04: any investor may buy a Tier 1 offering, so no accreditation statement is offered.
    check('the subscribe step offers no "is an accredited investor" tick and no note about it (owner, plan 06-15)', R.subAcc === 0 && !/is an accredited investor/.test(R.sub || '') && !/does not limit this offering to accredited investors/.test(R.sub || ''), { subAcc: R.subAcc, sub: (R.sub || '').slice(0, 1500) });
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
    check('the status step asks only the benefit plan questions, and the investor reaches the agreement', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)) && R.accQ === 0 && R.planQ === 4 && R.figFields === 0 && R.attestQ === 0, { seen: w.seen, errors: w.errors, accQ: R.accQ, planQ: R.planQ });
    // Rule 1 fix with plan 06-04: any investor may buy an exchange-listed Tier 2 offering, so no accreditation statement is offered.
    check('the subscribe step offers no "is an accredited investor" tick and no note about it (owner, plan 06-15)', R.subAcc === 0 && !/is an accredited investor/.test(R.sub || '') && !/does not limit this offering to accredited investors/.test(R.sub || ''), { subAcc: R.subAcc, sub: (R.sub || '').slice(0, 1500) });
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
    check('the Tier 2 statement is asked; the step names Regulation A without claiming a tier', R.attestQ === 1 && RA_PERSON.test(R.attestText) && R.figFields === 0 && /is offered under Regulation A\./.test(R.status) && !/Tier 2 of Regulation A/.test(R.status), R);
    check('left unticked: the subscribe step warns', RA_WARN.test(R.warn), R.warn);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    check('request.qual: regime regA2, regA exactly { attested: false }', !!r && r.qual.regime === 'regA2' && JSON.stringify(r.qual.regA) === '{"attested":false}', r && r.qual);
    const lk = L.leakCheck([field ? field.hints : '', R.status, R.sub].join('\n'));
    check('white label: the hint, status and subscribe screens pass the leak check', lk.ok, lk.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * D-07, Rule 251(d)(2)(i)(C): the statement covers everything in the offering. An investor with an earlier $30,000
   * subscription adds $10,000 and ticks the statement, which names what is already held or subscribed; no warning, and
   * neither request is flagged (the latest answer decides for every subscription of theirs).
   */
  async aggregate({ check, S }) {
    const { A, p, off, inv, w, R } = await regAFlow(S, {
      exemption: 'Regulation A Tier 2',
      tag: 'aggregate',
      acc: 'no',
      attest: true,
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
    check('the statement counts what is already held or subscribed in the offering', R.attestQ === 1 && /counting anything I already hold or have subscribed for in it/.test(R.attestText), R.attestText);
    check('ticked: no warning on the subscribe step', !R.warn && !R.raSub, R);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    check('request.qual.regA is exactly { attested: true }', !!r && JSON.stringify(r.qual.regA) === '{"attested":true}', r && r.qual);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    check('the panel: 1 non-accredited subscriber, 0 not attested', /Regulation A Tier 2: 1 non-accredited subscriber, 0 not attested to the 10 percent limit/.test(el), el);
    await consoleRequests(p);
    const row1 = await requestRow(p, 'ra-earlier');
    const row2 = await requestRow(p, r && r.id);
    check('neither the earlier nor the new request carries the Regulation A flag', !!row1 && !!row2 && !RA_FLAG.test(row1) && !RA_FLAG.test(row2), [row1, row2]);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * Verifier warning 1 (plan 06-11, D-06, D-30): a Tier 2 subscriber who leaves the accredited question unanswered is named
   * on the Regulation A panel in one line, shown only when there is someone to name; nothing is flagged or blocked.
   */
  async 'rega-unanswered'({ check, S }) {
    let before = null;
    const { A, p, off, inv, w, R } = await regAFlow(S, {
      exemption: 'Regulation A Tier 2',
      tag: 'rega-unanswered',
      acc: '',
      amount: 60000,
      before: async (page, o) => {
        await consoleOffering(page, o.offeringId);
        before = { el: await eligibilityText(page), line: await page.locator('.cs-elig-unanswered').count() };
      }
    });
    check('before anyone subscribes, the panel has no unanswered line', !!before && /Regulation A Tier 2: 0 non-accredited subscribers/.test(before.el) && before.line === 0 && !/unanswered/.test(before.el), before);
    check('the investor reaches the agreement with the accredited question left open, no field error', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    check('with the question open, no statement about the limit is shown and the subscribe step has no warning', R.attestQ === 0 && !R.warn, R);
    const r = await requestOf(p, inv.investorId, off.offeringId);
    check('request.qual: regA2, accredited null, no regA', !!r && r.qual.regime === 'regA2' && r.qual.accredited === null && r.qual.regA === undefined, r && r.qual);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    await p.screenshot({ path: path.join(SHOTS, 'rega-unanswered-console.png'), fullPage: true });
    check('the panel names the subscriber in one line: "Left the accredited question unanswered, so not asked about the 10 percent limit: Dana Whitfield"', (await p.locator('.cs-elig-unanswered').count()) === 1 && /Left the accredited question unanswered, so not asked about the 10 percent limit: Dana Whitfield/.test(el), el);
    check('the subscriber is not counted as non-accredited or as not attested', /Regulation A Tier 2: 0 non-accredited subscribers, 0 not attested to the 10 percent limit/.test(el) && (await p.locator('.cs-elig-noattest').count()) === 0, el);
    await consoleRequests(p);
    const row = await requestRow(p, r && r.id);
    check('the request row carries no Regulation A flag and keeps Approve', !!row && !RA_FLAG.test(row) && (await p.locator(`[data-action=req-approve][data-id="${r && r.id}"]`).count()) === 1, row);
    const lk = L.leakCheck([R.status, R.sub, el].join('\n'));
    check('white label: status, subscribe and panel pass the leak check', lk.ok, lk.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /** C-01, D-07: the request row flags a Tier 2 subscription without the attestation (unticked, or an earlier answer with none); Approve stays. */
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
      // Left unticked; attested; an answer saved by the earlier version (figures, no attestation).
      mk('fa', 'Avery Unticked', 5000000, { attested: false });
      mk('fb', 'Blake Attested', 500000000, { attested: true });
      mk('fc', 'Casey Earlier', 5000000, { kind: 'person', income: 1000000, netWorth: null, limitCents: 10000000, commitmentCents: 5000000, overLimit: false });
      NS.app.save(true);
    }, off.offeringId);
    await consoleRequests(p);
    const rowA = await requestRow(p, 'fa-req');
    await p.screenshot({ path: path.join(SHOTS, 'flag-requests.png'), fullPage: true });
    check('the unticked request row reads "Not accredited and has not attested to the Regulation A Tier 2 limit (10 percent of income or net worth)"', RA_FLAG.test(rowA), rowA);
    check('an attested request carries no flag, whatever its amount', !RA_FLAG.test(await requestRow(p, 'fb-req')));
    check('an earlier answer with figures and no attestation is flagged (the figures are not read)', RA_FLAG.test(await requestRow(p, 'fc-req')));
    check('exactly two request rows are flagged', (await p.locator('.cs-tbl .iv-warn').count()) === 2, await p.locator('.cs-tbl .iv-warn').allInnerTexts());
    check('the flagged row keeps Approve and Decline (nothing blocked)', (await p.locator('[data-action=req-approve][data-id="fa-req"]').count()) === 1 && (await p.locator('[data-action=req-decline][data-id="fa-req"]').count()) === 1);
    const lk = L.leakCheck(await L.screenText(p));
    check('white label: the requests view passes the leak check', lk.ok, lk.hits);
    await p.click('[data-action=req-approve][data-id="fa-req"]');
    await p.waitForTimeout(400);
    const st = await p.evaluate(() => (window.CVPortal.state.ws.requests.find((r) => r.id === 'fa-req') || {}).status);
    check('Approve works as before on the flagged request', st === 'approved', st);
    await consoleOffering(p, off.offeringId);
    const el = await eligibilityText(p);
    check('the panel: 3 non-accredited subscribers, 2 not attested (Avery, Casey) and Blake named as attested, no amounts', /Regulation A Tier 2: 3 non-accredited subscribers, 2 not attested to the 10 percent limit/.test(el) && /Avery Unticked has not attested/.test(el) && /Casey Earlier has not attested/.test(el) && /Attested to the 10 percent limit: Blake Attested/.test(el) && !/Blake Attested has not attested/.test(el) && !/\$/.test(el), el);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * Plan 06-08 (verifier gap 1, C-05, D-30): in the self-serve portal, investors on file who are not accredited subscribe
   * to a Rule 506(b) offering from the firm's offering link (Run A), from Investments (Run B) and from the subscribe
   * address with an open invitation for another offering (Run C). Never the old form's accredited tick; each goes through
   * the guided status step, the request carries qual and the console counts all three.
   */
  async 'portal-506b'({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    check('the offering is Rule 506(b) with its agreement ready', off.ready && off.exemption === 'Rule 506(b)', off);
    const people = await onFile(p, off.offeringId, 3);
    check('three active investors on file who are not accredited, with no invitation', people.length === 3, people);
    if (people.length < 3) return A.context.close();
    const qualOk = (r, who, exp) => {
      const q = (r && r.qual) || {};
      const so = q.sophistication || {};
      // D-08 (2) (plan 06-15): the one answer (no representative: alone).
      return !!r && q.regime === '506b' && q.accredited === false && so.knowledge === 'alone' && so.rep === null;
    };

    // Run A: the firm's offering link, signed in with the email of an account that is complete.
    await joinFromLink(p, off.offeringId, people[0]);
    const a = await guidedFromPortal(p, check, 'Run A (offering link)', people[0], off.offeringId, { exp: 'Run A: twelve years of fund commitments' }, 'portal-link');
    if (a) {
      check('Run A: the status step asks the accredited and sophistication questions', /an accredited investor\?/.test(a.st) && /alone or with a purchaser representative/.test(a.st), a.st.slice(0, 900));
      check('Run A: the subscribe step states the account is not an accredited investor', /is not an accredited investor/.test(a.sub), a.sub.slice(0, 900));
      check('Run A: the request carries qual: regime 506b, accredited false, the sophistication answers', qualOk(a.req, people[0], 'Run A: twelve years of fund commitments'), a.req);
      check('Run A: the agreement was signed (done screen)', /Accreditation/.test(a.done) || a.done.length > 0, a.done.slice(0, 400));
    }

    // Run B: Investments, the offering's subscribe control.
    const offered = await fromInvestments(p, off.offeringId, people[1]);
    check('Run B: the Investments page offers the offering to an investor on file who is not accredited', offered);
    const b = offered ? await guidedFromPortal(p, check, 'Run B (Investments)', people[1], off.offeringId, { exp: 'Run B: eight years of private equity' }, 'portal-investments') : null;
    if (b) check('Run B: the request carries qual: regime 506b, accredited false, the sophistication answers', qualOk(b.req, people[1], 'Run B: eight years of private equity'), b.req);

    // Run C: the subscribe address typed or bookmarked, with an open invitation for a different offering.
    const other = await p.evaluate((oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === oid);
      const c = JSON.parse(JSON.stringify(o));
      c.id = oid + '-second';
      c.name = 'Second Test Offering';
      c.status = 'Raising';
      ws.offerings.push(c);
      NS.app.save(true);
      return { id: c.id, name: c.name };
    }, off.offeringId);
    const otherInv = await L.createInvitation(p, { name: people[2].name, email: people[2].email, offeringId: other.id, cents: 0 });
    const otherIt = await p.evaluate((id) => (window.CVPortal.state.ws.invitations || []).find((x) => x.id === id) || null, otherInv.invitationId);
    check('Run C: the investor holds an open invitation to subscribe to a different offering', !!otherIt && otherIt.existing && otherIt.offeringId === other.id, otherIt);
    await asInvestor(p, people[2].id, 'subscribe-' + off.offeringId);
    await p.waitForTimeout(900);
    const addr = await noAccTick(p);
    await p.screenshot({ path: path.join(SHOTS, 'portal-address-box.png'), fullPage: true });
    check('Run C: the subscribe address shows no "is an accredited investor" statement and no #sb-acc', addr.ok, { sbAcc: addr.sbAcc, text: addr.text.slice(0, 900) });
    const boxBtn = p.locator('.done-box [data-action=sub-start]', { hasText: 'Continue your subscription' });
    const hasBox = (await boxBtn.count()) === 1;
    check('Run C: the "Continue your subscription" box with its button is shown', hasBox, addr.text.slice(0, 900));
    check('white label: the subscribe address screen passes the leak check', L.leakCheck(addr.text).ok, L.leakCheck(addr.text).hits);
    let c = null;
    if (hasBox) {
      await boxBtn.click();
      await p.waitForTimeout(900);
      c = await guidedFromPortal(p, check, 'Run C (subscribe address)', people[2], off.offeringId, { exp: 'Run C: five years of venture funds' }, 'portal-address');
    }
    if (c) check('Run C: the request carries qual: regime 506b, accredited false, the sophistication answers', qualOk(c.req, people[2], 'Run C: five years of venture funds'), c.req);
    const after = await p.evaluate((id) => (window.CVPortal.state.ws.invitations || []).find((x) => x.id === id) || null, otherInv.invitationId);
    check('Run C: the invitation for the other offering is left as it was (still open, same offering)', !!after && after.offeringId === other.id && ['cancelled', 'expired', 'completed'].indexOf(after.status) < 0, after);

    // The console counts all three.
    await consoleOffering(p, off.offeringId);
    const ct = await L.screenText(p);
    await p.screenshot({ path: path.join(SHOTS, 'portal-console-3.png'), fullPage: true });
    check('the console offering page reads "Non-accredited purchasers: 3 of 35"', /Non-accredited purchasers: 3 of 35/.test(ct), (ct.match(/[^\n]*Non-accredited purchasers[^\n]*/) || [ct.slice(0, 600)])[0]);
    const lkC = L.leakCheck(ct);
    check('white label: the console offering page passes the leak check', lkC.ok, lkC.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  },

  /**
   * Plan 06-08 (C-05, D-30, D-01, C-03): the same portal route carries the Regulation A Tier 2 statement (offering link), the
   * benefit plan answers, an empty status step and a withdrawn self-certified ground (Investments); the managed edition's
   * subscribe page is unchanged.
   */
  async 'portal-other'({ check, S }) {
    // rega: Regulation A Tier 2 from the firm's offering link.
    {
      const A = await L.open(S);
      const p = A.page;
      const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
      const ex = await chooseExemption(p, off.offeringId, 'Regulation A Tier 2');
      check('rega: the offering stores "Regulation A Tier 2"', ex.stored === 'Regulation A Tier 2', ex);
      const [who] = await onFile(p, off.offeringId, 1);
      check('rega: an individual investor on file who is not accredited, with no invitation', !!who && who.type === 'individual', who);
      if (who) {
        await joinFromLink(p, off.offeringId, who);
        const R = {};
        const g = await guidedFromPortal(p, check, 'rega (offering link)', who, off.offeringId, {
          amount: 60000,
          onFilled: async (hd) => {
            if (hd === 'Investor status') {
              R.attestQ = await p.locator('#ob-stRaAttest').count();
              R.figFields = await p.locator('#ob-stIncome, #ob-stWorth, #ob-stRevenue, #ob-stAssets').count();
            }
            if (hd === 'Subscription') {
              R.raSub = await p.locator('#ra-sub').innerText().catch(() => '');
              R.warn = await p.locator('#ra-sub .wire-warn').innerText().catch(() => '');
              await p.screenshot({ path: path.join(SHOTS, 'portal-other-rega-subscribe.png'), fullPage: true });
            }
          }
        });
        check('rega: the status step shows the Tier 2 statement and no figure fields', R.attestQ === 1 && R.figFields === 0, R);
        check('rega: left unticked, the subscribe step warns without blocking (agreement reached)', RA_WARN.test(R.warn || '') && !!g && g.w.reached, R); // D-06 (plan 06-15): "You can still subscribe" removed
        const q = (g && g.req && g.req.qual) || {};
        check('rega: request.qual.regA is exactly { attested: false }', JSON.stringify(q.regA) === '{"attested":false}' && q.accredited === false, q);
        if (g && g.req) {
          await consoleRequests(p);
          const row = await requestRow(p, g.req.id);
          check('rega: the console flags the request as not attested', RA_FLAG.test(row), row);
          check('white label: the requests view passes the leak check', L.leakCheck(await L.screenText(p)).ok);
        }
      }
      check('rega: no script error in the browser', A.errors.length === 0, A.errors);
      check('rega: no request left the check server', A.net.external.length === 0, A.net.external);
      await A.context.close();
    }

    // erisa, empty, withdraw: Rule 506(b) from Investments; the firm accepts self-certification (a ground is recorded).
    {
      const A = await L.open(S);
      const p = A.page;
      const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
      const people = await onFile(p, off.offeringId, 3);
      check('three investors on file with no invitation', people.length === 3, people);
      const ground = await p.evaluate((id) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        NS.integrations.ensure(ws).use.accreditation = ['self'];
        const i = ws.investors.find((x) => x.id === id);
        const b = NS.eligibility.BASES[0];
        if (i) i.accreditation = { basis: b, date: NS.dates.today() };
        NS.app.save(true);
        return b;
      }, (people[2] || {}).id);
      const before = await p.evaluate((oid) => {
        const ws = window.CVPortal.state.ws;
        const n = window.CVPortal.eligibility.nonAccredited(ws, ws.offerings.find((x) => x.id === oid));
        return { count: n.count, unanswered: n.unanswered };
      }, off.offeringId);
      if (people.length === 3) {
        // erisa: the benefit plan question answered (Title I plan).
        let offered = await fromInvestments(p, off.offeringId, people[0]);
        check('erisa: the Investments page offers the offering', offered);
        const ge = offered
          ? await guidedFromPortal(p, check, 'erisa (Investments)', people[0], off.offeringId, {
              onFilled: async (hd) => {
                if (hd === 'Investor status') {
                  await p.check('input[name="ob-stPlan"][value="title1"]');
                  await p.waitForTimeout(200);
                  await p.screenshot({ path: path.join(SHOTS, 'portal-other-erisa-status.png'), fullPage: true });
                }
              }
            })
          : null;
        const eq = (ge && ge.req && ge.req.qual && ge.req.qual.erisa) || {};
        const rec = await p.evaluate((id) => (window.CVPortal.state.ws.investors.find((x) => x.id === id) || {}).erisa || null, people[0].id);
        check('erisa: request.qual.erisa and the investor record carry the Title I answer', eq.plan === 'title1' && !!rec && rec.plan === 'title1', { qual: ge && ge.req && ge.req.qual, rec });

        // empty: every status answer left open (D-30).
        offered = await fromInvestments(p, off.offeringId, people[1]);
        check('empty: the Investments page offers the offering', offered);
        let pre = null;
        const gm = offered
          ? await guidedFromPortal(p, check, 'empty (Investments)', people[1], off.offeringId, {
              acc: '',
              exp: null,
              edu: null,
              rep: '',
              onStep: async (hd) => {
                if (hd === 'Investor status') pre = await p.evaluate(() => Array.from(document.querySelectorAll('.ivf-form input:checked')).map((x) => x.name + '=' + x.value));
              }
            })
          : null;
        check('empty: nothing on the status step is answered for the investor', !!pre && !pre.some((x) => /^ob-st/.test(x)), pre);
        const mq = (gm && gm.req && gm.req.qual) || {};
        check('empty: the subscription is made with request.qual.accredited null', !!(gm && gm.req) && mq.regime === '506b' && mq.accredited === null, mq);

        // withdraw: a self-certified ground on file, the investor answers "not accredited".
        offered = await fromInvestments(p, off.offeringId, people[2]);
        check('withdraw: the Investments page offers the offering', offered);
        const gw = offered ? await guidedFromPortal(p, check, 'withdraw (Investments)', people[2], off.offeringId, { exp: 'Six years of private credit funds' }) : null;
        const acc = await p.evaluate((id) => (window.CVPortal.state.ws.investors.find((x) => x.id === id) || {}).accreditation || null, people[2].id);
        check('withdraw: the record no longer holds the ground (basis empty, kept as superseded)', !!acc && !acc.basis && !!acc.superseded && acc.superseded.basis === ground, acc);
        check('withdraw: request.qual.accredited is false', !!(gw && gw.req) && gw.req.qual.accredited === false, gw && gw.req && gw.req.qual);

        // The 506(b) panel: two more counted, the empty one listed as not answered.
        await consoleOffering(p, off.offeringId);
        const el = await eligibilityText(p);
        await p.screenshot({ path: path.join(SHOTS, 'portal-other-console.png'), fullPage: true });
        check(`the console counts the two "not accredited" answers (${before.count + 2} of 35)`, new RegExp(`Non-accredited purchasers: ${before.count + 2} of 35`).test(el), el);
        check(`the panel lists the empty answer as not answered (${before.unanswered + 1} investors without a status answer)`, new RegExp(`${before.unanswered + 1} investors have no status answer on file`).test(el), el);
        check('white label: the console offering page passes the leak check', L.leakCheck(el).ok, L.leakCheck(el).hits);
      }
      check('erisa/empty/withdraw: no script error in the browser', A.errors.length === 0, A.errors);
      check('erisa/empty/withdraw: no request left the check server', A.net.external.length === 0, A.net.external);
      await A.context.close();
    }

    // managed: C-03, the managed edition's subscribe page is unchanged (the accredited tick, required) and still submits.
    {
      const A = await L.open(S);
      const p = A.page;
      await p.goto(`${S.origin}/index.html`);
      await p.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
      await p.goto(`${S.origin}/index.html`);
      await p.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 20000 });
      const m = await p.evaluate(() => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const o = ws.offerings.find((x) => x.status === 'Raising') || ws.offerings[0];
        o.status = 'Raising';
        const i = ws.investors.find((x) => x.onboarding.status === 'complete' && x.accreditation && x.accreditation.basis && !(x.positions || []).some((y) => y.offeringId === o.id));
        if (!i) return null;
        NS.app.save(true);
        NS.state.role = 'investor';
        NS.store.set('role', 'investor');
        NS.state.viewer = i.id;
        NS.app.go('subscribe-' + o.id);
        return { edition: NS.EDITION.id, oid: o.id, id: i.id, contact: i.contact };
      });
      check('managed: an accredited investor on file and a raising offering', !!m && m.edition === 'managed', m);
      if (m) {
        await p.waitForSelector('form[data-form=sub-submit]', { timeout: 20000 });
        const txt = await L.screenText(p);
        await p.screenshot({ path: path.join(SHOTS, 'portal-managed-subscribe.png'), fullPage: true });
        check('managed: the subscribe page keeps #sb-acc and its "is an accredited investor" statement', (await p.locator('#sb-acc').count()) === 1 && /is an accredited investor/.test(txt), txt.slice(0, 600));
        await p.check('#sb-docs');
        await p.check('#sb-esign');
        await p.fill('#sb-sig', m.contact);
        await p.click('.sub-form button[type=submit]');
        await p.waitForTimeout(600);
        const errs = await L.fieldErrors(p);
        check('managed: without the tick the page still says "Confirm your accreditation to continue."', errs.some((e) => /Confirm your accreditation to continue\./.test(e)), errs);
        await p.check('#sb-acc');
        await p.click('.sub-form button[type=submit]');
        await p.waitForTimeout(900);
        const r = await p.evaluate(({ id, oid }) => (window.CVPortal.state.ws.requests || []).filter((x) => x.type === 'subscription' && x.investorId === id && x.offeringId === oid).pop() || null, m);
        check('managed: the subscription request is submitted as before', !!r && r.status === 'pending', r && { status: r.status, qual: r.qual });
      }
      check('managed: no script error in the browser', A.errors.length === 0, A.errors);
      check('managed: no request left the check server', A.net.external.length === 0, A.net.external);
      await A.context.close();
    }
  },

  /**
   * D-06 (owner, plan 06-15): every item of the investor onboarding screens recorded in checks/onboarding-items.json, held on
   * the screens of five walks: a new individual under Rule 506(b) answering "not accredited" with a purchaser representative,
   * a new LLC under Regulation A Tier 2 answering "not accredited" (an entity holding plan assets, 40 percent), a new IRA
   * under Rule 506(c) (verification step) with the commitment set by the firm, an investor on file under Rule 506(b), and a
   * new individual under Regulation A Tier 1 with the firm's accredited question off. Each item with a text: a keep is on its
   * screen in every walk named, a removal or a fold is on none of them.
   */
  async lean({ check, S }) {
    const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'onboarding-items.json'), 'utf8'));
    check('onboarding-items.json: every item has a screen, an item, a decision (keep, remove or folded) and a reason', Array.isArray(items) && items.length > 0 && items.every((x) => x.screen && x.item && /^(keep|remove|folded)$/.test(x.decision) && x.reason), items.filter((x) => !(x.screen && x.item && /^(keep|remove|folded)$/.test(x.decision) && x.reason)).slice(0, 5));
    const keyOf = (hd) => (/^Welcome/.test(hd) ? 'welcome' : /Create your login/.test(hd) ? 'login' : /Investor information/.test(hd) ? 'profile' : /Identity verification/.test(hd) ? 'identity' : /Accredit/.test(hd) ? 'accreditation' : /^Investor status$/.test(hd) ? 'status' : /Distribution payments/.test(hd) ? 'payment' : /^Subscription$/.test(hd) ? 'subscribe' : /Tax certification/.test(hd) ? 'tax' : hd);
    const formText = (p) => p.evaluate(() => (document.querySelector('.ivf-form') || document.body).innerText);
    const walkOne = async (tag, o) => {
      const A = await L.open(S);
      const p = A.page;
      const off = await L.setupPortal(S, A, { exemption: o.exemption });
      if (o.toggleOff) {
        await p.evaluate(() => {
          window.CVPortal.state.ws.tenant.onboarding.accreditation = false;
          window.CVPortal.app.save(true);
        });
      }
      let name = INV.name;
      let inv;
      if (o.onFile) {
        const who = await p.evaluate((oid) => {
          const ws = window.CVPortal.state.ws;
          const i = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.accreditation && x.accreditation.basis && x.email && !(x.positions || []).some((y) => y.offeringId === oid));
          return i ? { name: i.contact, email: i.email } : null;
        }, off.offeringId);
        name = who.name;
        inv = await L.createInvitation(p, { name: who.name, email: who.email, offeringId: off.offeringId, cents: 0 });
      } else inv = await L.createInvitation(p, { name: INV.name, email: INV.email, type: o.type, account: o.account, offeringId: off.offeringId, cents: o.cents || 0 });
      await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
      const T = {};
      const w = await L.walk(p, Object.assign({}, o.answers || {}, {
        name,
        amount: 60000,
        onStep: async (hd) => {
          const k = keyOf(hd);
          if (k !== 'status' && k !== 'tax') {
            T[k] = await formText(p);
            await p.screenshot({ path: path.join(SHOTS, `lean-${tag}-${k}.png`), fullPage: true });
          }
        },
        onFilled: async (hd) => {
          if (keyOf(hd) !== 'status') return;
          if (o.plan) await p.check(`input[name="ob-stPlan"][value="${o.plan}"]`);
          if (o.planPct) {
            await p.waitForSelector('#ob-stPlanPct', { timeout: 10000 });
            await p.fill('#ob-stPlanPct', o.planPct);
          }
          await p.waitForTimeout(200);
          T.status = await formText(p);
          await p.screenshot({ path: path.join(SHOTS, `lean-${tag}-status.png`), fullPage: true });
        }
      }));
      check(`${tag}: the walk reaches the subscription agreement with no field error`, w.reached && w.errors.length === 0, { seen: w.seen, errors: w.errors });
      if (w.reached) {
        T.agreement = await formText(p);
        await p.screenshot({ path: path.join(SHOTS, `lean-${tag}-agreement.png`), fullPage: true });
        await finishAgreement(p);
        T.done = await formText(p);
        await p.screenshot({ path: path.join(SHOTS, `lean-${tag}-done.png`), fullPage: true });
      }
      T['every step'] = T.login || '';
      const lk = L.leakCheck(Object.values(T).join('\n'));
      check(`${tag}: white label: every screen passes the leak check`, lk.ok, lk.hits);
      check(`${tag}: no script error in the browser`, A.errors.length === 0, A.errors);
      check(`${tag}: no request left the check server`, A.net.external.length === 0, A.net.external);
      await A.context.close();
      return { T, seen: w.seen };
    };
    const W = {
      'individual-506b': await walkOne('individual-506b', { exemption: 'Rule 506(b)', answers: { acc: 'no', soph: 'rep', rep: 'yes', repName: 'Morgan Ellery' } }),
      'entity-rega2': await walkOne('entity-rega2', { exemption: 'Regulation A Tier 2', type: 'entity', account: 'Whitfield Holdings LLC', answers: { acc: 'no' }, plan: 'planAssets', planPct: '40' }),
      'ira-506c': await walkOne('ira-506c', { exemption: 'Rule 506(c)', type: 'ira', account: 'Harbor Trust Co. FBO Dana Whitfield IRA', cents: 25000000 }),
      'onfile-506b': await walkOne('onfile-506b', { exemption: 'Rule 506(b)', onFile: true }),
      'individual-rega1': await walkOne('individual-rega1', { exemption: 'Regulation A Tier 1', toggleOff: true })
    };
    const bad = [];
    let held = 0;
    items.forEach((x) => {
      if (!x.text) return;
      (x.paths || []).forEach((pth) => {
        const t = (W[pth] && W[pth].T[x.screen]) || null;
        const on = t != null && t.indexOf(x.text) >= 0;
        held++;
        if (t == null) bad.push(`${pth} ${x.screen}: screen not reached (${x.item})`);
        else if (x.decision === 'keep' && !on) bad.push(`${pth} ${x.screen}: kept item missing: ${x.text}`);
        else if (x.decision !== 'keep' && on) bad.push(`${pth} ${x.screen}: ${x.decision} item still shown: ${x.text}`);
      });
    });
    check(`every recorded item with a text is held on its screens (${held} item and walk pairs): each keep present, each removal and fold absent`, held > 100 && bad.length === 0, bad);
    const untested = items.filter((x) => !x.text && !x.heldBy && x.screen !== 'flow' && x.screen !== 'every step' && x.screen !== 'payment' && x.screen !== 'welcome');
    check('every item without a text on a walked screen names the check that holds it, or is a step-level decision', untested.length === 0, untested.map((x) => x.item));
    const steps = (k) => W[k].seen.map((s) => s.split(' | ').pop());
    check('the steps are as before (no step removed or folded): 10 for a new individual under Rule 506(b), 11 under Rule 506(c), 5 for the investor on file', W['individual-506b'].seen.every((s) => /^Step \d+ of 10:/.test(s)) && W['ira-506c'].seen.every((s) => /^Step \d+ of 11:/.test(s)) && steps('onfile-506b').map((x) => (/^Welcome/.test(x) ? 'Welcome' : x)).join('|') === 'Welcome|Investor status|Subscription|Subscription agreement', { a: W['individual-506b'].seen, c: W['ira-506c'].seen, d: W['onfile-506b'].seen });
    check('Regulation A Tier 1 with the accredited question off: no accreditation tick on Subscription', !/accredited investor/.test(W['individual-rega1'].T.subscribe || ''), (W['individual-rega1'].T.subscribe || '').slice(0, 800));
  },

  /**
   * Plan 06-25 (gap 2 of 06-24): Rule 506(c) with the firm's "Require verified accreditation: Never" and the accreditation
   * toggle off. Rule 506(c) allows accredited purchasers only, with reasonable steps to verify; the portal must never record
   * someone as accredited without an answer. The status step asks the accredited question (self-certified) and the record
   * follows the answer: true with the ground, false, or null when left open (D-30: nothing required). The console tells the
   * sponsor that 506(c) needs reasonable verification steps that are theirs to take: on the Integrations rule, the offering's
   * exemption hint and each request row. The default rule keeps the verification step (part erisa).
   */
  async c506never({ check, S }) {
    const A = await L.open(S);
    const p = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(c)' });
    check('the offering is Rule 506(c) with its agreement ready', off.ready && off.exemption === 'Rule 506(c)', off);
    await p.evaluate(() => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      NS.integrations.ensure(ws).rules.accreditationFor = '506c';
      ws.tenant.onboarding.accreditation = false;
      NS.app.save(true);
    });
    // The Integrations rule: the sponsor chooses Never with the page's own select; the note appears with it.
    await p.evaluate(() => (location.hash = 'console-integrations'));
    await p.waitForTimeout(400);
    if (await p.locator('#demo-role').count()) {
      await p.selectOption('#demo-role', 'admin');
      await p.waitForTimeout(400);
      await p.evaluate(() => (location.hash = 'console-integrations'));
    }
    await p.waitForSelector('#iv-accfor', { timeout: 20000 });
    const ruleText = () => p.evaluate(() => (document.getElementById('iv-accfor').closest('label') || {}).innerText || '');
    const before = await ruleText();
    await p.selectOption('#iv-accfor', 'none');
    await p.waitForTimeout(400);
    const after = await ruleText();
    await p.screenshot({ path: path.join(SHOTS, 'c506never-integrations.png'), fullPage: true });
    const NOTE = /Rule 506\(c\)[^]*reasonable steps to verify[^]*your responsibility/;
    check('Integrations: no 506(c) note under "For Rule 506(c) offerings"', !NOTE.test(before), before);
    check('Integrations: choosing "Never" shows that Rule 506(c) allows accredited investors only, needs reasonable steps to verify them, and that those steps are the sponsor’s responsibility', NOTE.test(after) && /accredited investors only/.test(after), after);
    const rule = await p.evaluate(() => {
      const NS = window.CVPortal;
      NS.app.save(true);
      return NS.integrations.ensure(NS.state.ws).rules.accreditationFor;
    });
    check('the rule is saved as Never', rule === 'none', rule);
    await consoleOffering(p, off.offeringId);
    const field = await exemptionField(p);
    check('the offering’s exemption hint under Never says the reasonable verification steps are the sponsor’s, and no longer that investors verify while they onboard', NOTE.test(field.hints) && !/investors verify their status while they onboard/.test(field.hints), field.hints);
    // Three investors: accredited (a ground), not accredited, and the question left open.
    const R = {};
    const one = async (tag, name, email, acc) => {
      const inv = await L.createInvitation(p, { name, email, offeringId: off.offeringId, cents: 0 });
      await p.goto(`${S.base}?tenant=${inv.tenant}#invite-${inv.token}`);
      const x = { st: '', accQ: -1, soph: -1, sub: '', subAcc: -1, subText: '' };
      x.w = await L.walk(p, {
        name,
        acc,
        basis: acc === 'yes' ? 1 : undefined,
        amount: 60000,
        onStep: async (hd) => {
          if (hd === 'Investor status') {
            x.accQ = await p.locator('input[name="ob-stAcc"]').count();
            x.soph = await p.locator('input[name="ob-stSoph"]').count();
          }
          if (hd === 'Subscription') {
            x.sub = await L.screenText(p);
            x.subAcc = await p.locator('#ob-subAcc').count();
            x.subText = x.subAcc ? await p.locator('label[for="ob-subAcc"]').innerText() : '';
            await p.screenshot({ path: path.join(SHOTS, `c506never-${tag}-subscribe.png`), fullPage: true });
          }
        },
        onFilled: async (hd) => {
          if (hd !== 'Investor status') return;
          x.st = await L.screenText(p);
          await p.screenshot({ path: path.join(SHOTS, `c506never-${tag}-status.png`), fullPage: true });
        }
      });
      x.heads = x.w.seen.map((s) => s.split(' | ').pop());
      x.req = await requestOf(p, inv.investorId, off.offeringId);
      x.inv = inv;
      R[tag] = x;
      return x;
    };
    const yes = await one('yes', 'Priya Castellanos', 'priya.castellanos@example.com', 'yes');
    const no = await one('no', 'Tobias Achterberg', 'tobias.achterberg@example.com', 'no');
    const open = await one('open', 'Wren Abernathy', 'wren.abernathy@example.com', '');
    ['yes', 'no', 'open'].forEach((k) => {
      const x = R[k];
      check(`${k}: the investor reaches the agreement with no field error, and there is no verification step`, x.w.reached && x.w.errors.length === 0 && x.heads.indexOf('Accredited investor verification') < 0 && x.heads.indexOf('Accreditation') < 0, { seen: x.w.seen, errors: x.w.errors });
      check(`${k}: the status step asks the accredited question (yes or no) and no Rule 506(b) sophistication question`, x.accQ === 2 && x.soph === 0 && /an accredited investor\?/.test(x.st), { accQ: x.accQ, soph: x.soph, st: x.st.slice(0, 600) });
    });
    const q = (x) => (x.req && x.req.qual) || {};
    check('yes: request.qual records accredited true with the ground chosen (self-certified)', q(yes).regime === '506c' && q(yes).accredited === true && /net worth/i.test(q(yes).basis || ''), q(yes));
    check('yes: the investor record keeps the self-certified ground', !!yes.req && !!yes.req.accreditation && /net worth/i.test(yes.req.accreditation.basis || ''), yes.req && yes.req.accreditation);
    check('yes: the subscribe step states the account is an accredited investor, with its ground', yes.subAcc === 1 && /Priya Castellanos is an accredited investor \(Net worth/.test(yes.subText), yes.subText);
    check('no: request.qual records accredited false (no sophistication answers under Rule 506(c))', q(no).accredited === false && !q(no).sophistication, q(no));
    check('no: the subscribe step states the account is not an accredited investor', no.subAcc === 1 && /Tobias Achterberg is not an accredited investor/.test(no.subText), no.subText);
    check('open: request.qual records accredited null (never accredited without an answer)', !!open.req && q(open).accredited === null && q(open).basis === '', q(open));
    check('open: the subscribe step makes no statement about accreditation', open.subAcc === 0 && !/is an accredited investor|is not an accredited investor/.test(open.sub), { subAcc: open.subAcc, sub: open.sub.slice(0, 900) });
    check('open: the change log says the accredited question was not answered', !!open.req && open.req.log.some((e) => e.action === 'Investor status answered' && /^Wren Abernathy: not answered;/.test(e.detail)), open.req && open.req.log);
    check('open: no accreditation ground on the investor record', !!open.req && !((open.req.accreditation || {}).basis), open.req && open.req.accreditation);
    // The sponsor's request rows: each Rule 506(c) subscription under Never says what the sponsor still has to do.
    await consoleRequests(p);
    const rows = {};
    for (const k of ['yes', 'no', 'open']) rows[k] = R[k].req ? await requestRow(p, R[k].req.id) : '';
    await p.screenshot({ path: path.join(SHOTS, 'c506never-requests.png'), fullPage: true });
    check('requests: the self-certified one says Rule 506(c) needs reasonable steps to verify it, which are the sponsor’s', /Self-certified as accredited: Rule 506\(c\) needs reasonable steps to verify it, which are yours to take/.test(rows.yes), rows.yes);
    check('requests: the "not accredited" one says Rule 506(c) allows accredited investors only', /Answered not accredited: Rule 506\(c\) allows accredited investors only/.test(rows.no), rows.no);
    check('requests: the unanswered one says the accredited status was not answered', /Accredited status not answered: Rule 506\(c\) allows accredited investors only/.test(rows.open), rows.open);
    const lk = L.leakCheck([yes.st, no.st, open.st, yes.sub, no.sub, open.sub].join('\n'));
    check('white label: the status and subscribe screens pass the leak check', lk.ok, lk.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  }
};

L.runParts(parts, { name: 'STATUS FLOW', unit: 'parts', flag: '--only', browser: true });
