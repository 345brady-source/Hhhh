#!/usr/bin/env node
// Server mode for the investor status answers (phase 6, plans 06-06 and 06-07; D-01, C-01, D-30, white label, C-05).
// Real invitations go through the firm's integration server. Each part runs the real server code (server/index.mjs)
// in this process and two separate browser contexts that share nothing except through that server: the sponsor's
// console (one context) sends the invitation with its own form; the investor's device (a second context, empty storage,
// the portal page listing the server as the firm publishes it) opens the ?server= link, answers the status step,
// subscribes and signs; the console imports with its own "Check now" and counts the answers exactly as in local mode.
//   NODE_PATH=$(npm root -g) node server-mode.js [--only b506,regA,full,existing,withdraw,repack,clean,signed]
// The last line is "SERVER MODE: PASS (parts run: N)" or "SERVER MODE: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const { isDeepStrictEqual } = require('util');
const L = require('./lib.js');

const SHOTS = path.join(L.OUT, 'server-shots');
// The owner's screenshot set (plan 06-07): what each screenshot of this check shows (server mode: the console and the
// investor's device are separate browsers that share only the integration server).
L.describeShots([
  ['b506-status.png', 'Investor’s own device (server mode), status step, Rule 506(b), answered "not accredited" with a purchaser representative and plan 4975.'],
  ['b506-subscribe.png', 'Investor’s device, subscribe step: it states the account is not an accredited investor.'],
  ['b506-done.png', 'Investor’s device, done screen after the completion went to the integration server.'],
  ['b506-console-offering.png', 'Console after import: "Non-accredited purchasers: 1 of 35", and the Benefit plan investors list naming the investor with the pending subscription (D-08).'],
  ['regA-status.png', 'Investor’s device, Regulation A Tier 2 status step (D-07): "not accredited", the one statement about the 10 percent limit left unticked, no figures asked.'],
  ['regA-subscribe.png', 'Investor’s device, subscribe step: the warning that the investor has not confirmed the limit, which does not block.'],
  ['regA-done.png', 'Investor’s device, done screen (Regulation A).'],
  ['regA-requests.png', 'Console requests page: "Not accredited and has not attested to the Regulation A Tier 2 limit (10 percent of income or net worth)" on the imported request.'],
  ['regA-console-offering.png', 'Console offering page: "1 non-accredited subscriber, 1 not attested to the 10 percent limit" and Dana Whitfield named.'],
  ['full34-status.png', 'Investor’s device with 34 non-accredited purchasers counted when invited: status step answered "not accredited", no warning (they would be the 35th).'],
  ['full34-subscribe.png', 'Investor’s device, subscribe step (34 counted).'],
  ['full34-done.png', 'Investor’s device, done screen (34 counted).'],
  ['full34-console-offering.png', 'Console offering page after import with 34 counted before: "Non-accredited purchasers: 35 of 35", at the limit (the warning badge, not the red one).'],
  ['full34-requests.png', 'Console requests page after a backdated completion: the Submitted and Date columns are the console’s own (today; the offering’s closing date), not 2001 or 1999.'],
  ['full35-status.png', 'Investor’s device with 35 counted when invited: status step answered "not accredited", no warning (owner, plan 06-15); the sponsor’s flag stays.'],
  ['full35-subscribe.png', 'Investor’s device, subscribe step (35 counted).'],
  ['full35-done.png', 'Investor’s device, done screen (35 counted).'],
  ['full35-console-offering.png', 'Console offering page after import: "Non-accredited purchasers: 36 of 35".'],
  ['full35-requests.png', 'Console requests page: "Would be non-accredited purchaser 36 of the 35 allowed under Rule 506(b)" on the new request.'],
  ['existing-status-prefilled.png', 'Investor on file, own device: the status step prefilled from the console (accredited, the ground on file, plan Title I; no control question), before the investor changes the plan to "none".'],
  ['existing-status.png', 'Investor on file: status step after changing the benefit plan answer to "none of these".'],
  ['existing-subscribe.png', 'Investor on file: subscribe step (accredited investor).'],
  ['existing-done.png', 'Investor on file: done screen.'],
  ['existing-console-offering.png', 'Console offering page after import: the Benefit plan investors list, which no longer names the investor (answer now "no").'],
  ['withdraw-status.png', 'Investor on file with a self-certified ground, own device: status step answered "not accredited" (sophistication answers).'],
  ['withdraw-subscribe.png', 'Investor on file: subscribe step stating the account is not an accredited investor.'],
  ['withdraw-done.png', 'Investor on file: done screen after answering "not accredited".'],
  ['withdraw-console-offering.png', 'Console offering page after import: "Non-accredited purchasers: 1 of 35"; the investor record no longer holds the self-certified ground.'],
  ['withdrawB-status.png', 'Investor on file whose ground a third party verified: status step answered "not accredited".'],
  ['withdrawB-subscribe.png', 'Investor on file (verified ground): subscribe step.'],
  ['withdrawB-done.png', 'Investor on file (verified ground): done screen; the verified ground stays on the console record.'],
  ['repack-status.png', 'Investor’s device: status step with the purchaser representative’s acknowledgment attached.'],
  ['repack-subscribe.png', 'Investor’s device: subscribe step (not accredited, representative named).'],
  ['repack-done.png', 'Investor’s device: done screen; the acknowledgment went with the completion.'],
  ['repack-requests.png', 'Console requests page after import: "Purchaser representative: Morgan Ellery" with "Download the written acknowledgment" (returns the same bytes).'],
  ['repbig-status.png', 'Investor’s device: a 25 MB acknowledgment attached (accepted, but it cannot go with the signed agreement).'],
  ['repbig-subscribe.png', 'Investor’s device: subscribe step (25 MB acknowledgment case).'],
  ['repbig-done.png', 'Investor’s device, done screen: "The acknowledgment of your purchaser representative you uploaded could not be sent with your details".'],
  ['repbig-requests.png', 'Console requests page: the representative with the note that the acknowledgment did not fit and to ask the investor for it (no download).'],
  ['clean-status.png', 'Investor’s device with 35 other non-accredited purchasers on the console: status step answered "not accredited", no warning and nothing about the others.']
]);
fs.mkdirSync(SHOTS, { recursive: true });
const INV = { first: 'Dana', last: 'Whitfield', name: 'Dana Whitfield', email: 'dana.whitfield@example.com' };

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

/** The console's subscription request of one investor in one offering, with its qual. */
const consoleRequest = (page, investorId, offeringId) =>
  page.evaluate(({ investorId, offeringId }) => {
    const ws = window.CVPortal.state.ws;
    const r = (ws.requests || []).filter((x) => x.type === 'subscription' && x.investorId === investorId && x.offeringId === offeringId).pop();
    return r ? { id: r.id, status: r.status, cents: r.cents, qual: r.qual === undefined ? '(none)' : r.qual } : null;
  }, { investorId, offeringId });

/**
 * n investors on file who are not accredited, each with a pending subscription to the offering (NS.ops.submitSubscription)
 * and the answers a 506(b) investor gives (qual.accredited false), in the console. The same seeding as status-flow.js.
 */
const seedNonAccredited = (page, offeringId, n, prefix) =>
  page.evaluate(
    ({ offeringId, n, prefix }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings.find((x) => x.id === offeringId);
      const tpl = ws.investors[0];
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
      }
      NS.app.save(true);
      return NS.eligibility.nonAccredited(ws, o).count;
    },
    { offeringId, n, prefix }
  );

/** The investor status warning C-01 an earlier version showed when the offering may be full (removed by the owner, plan 06-15). */
const FULL_WARN = /may already have as many investors who are not accredited as it is able to accept/;
const warnText = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.ivf-form .wire-warn')).map((x) => x.innerText).join('\n'));

/**
 * One server-mode case end to end. o: { tag, exemption, invite (extra form fields), answers (lib walk answers),
 * onStatus(page, R), onSubscribe(page, R), beforeImport(srv, inv, sub) }. Returns everything the part asserts on; the
 * caller closes ctx.close().
 */
async function serverFlow(S, check, o) {
  const srv = await L.serverPortal(S);
  const out = { srv, R: {} };
  const closers = [];
  out.close = async () => {
    for (const c of closers.reverse()) await c().catch(() => {});
    await srv.close();
  };
  try {
    // The sponsor's console: its own context, the sample portal with the agreement, the exemption, the server set up.
    const A = await L.open(S, { allow: [srv.base], init: srv.init, context: { acceptDownloads: true } });
    closers.push(() => A.context.close());
    out.A = A;
    const cp = A.page;
    const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    out.off = off;
    if (o.exemption !== 'Rule 506(b)') {
      await L.consoleRoute(cp, 'console-offering-' + off.offeringId);
      await cp.selectOption('#of-structure-exemption', o.exemption);
      await cp.waitForTimeout(300);
    }
    out.exemption = await cp.evaluate((id) => (window.CVPortal.state.ws.offerings.find((x) => x.id === id).structure || {}).exemption, off.offeringId);
    if (o.beforeInvite) await o.beforeInvite(cp, off, out);
    // The investor invited: Dana Whitfield (new), or the one beforeInvite picked (out.who: an investor on file).
    const who = out.who || INV;
    out.serverOn = await srv.configure(cp);
    const inv = await L.inviteFromConsole(cp, Object.assign({ first: who.first, last: who.last, email: who.email, offeringId: off.offeringId }, o.invite || {}));
    out.inv = inv;
    check('the console sends the invitation to the integration server with its own form (the server holds it)', out.serverOn === true && /^ivt_/.test(inv.serverId) && inv.token === '' && inv.link.indexOf(`server=${encodeURIComponent(srv.base)}`) > 0 && inv.link.indexOf(S.base) === 0, inv);
    const held = (await srv.rows()).find((x) => x.id === inv.serverId);
    check(`the server holds the invitation for the ${o.exemption} offering`, !!held && held.offeringId === off.offeringId && held.investorId === inv.investorId, held);

    // The investor's device: a second context with nothing in its storage, the portal page as the firm publishes it.
    const B = await L.open(S, { allow: [srv.base], init: srv.init });
    closers.push(() => B.context.close());
    out.B = B;
    const ip = B.page;
    // The snapshot exactly as the investor's page receives it from the server (GET /v1/invite), read in this context.
    out.snaps = [];
    ip.on('response', async (res) => {
      if (res.request().method() !== 'GET' || !/\/v1\/invite$/.test(res.url().replace(/[?#].*$/, ''))) return;
      try {
        out.snaps.push(await res.json());
      } catch (e) {
        out.snaps.push({ unreadable: String(e) });
      }
    });
    await ip.goto(inv.link);
    // Workspace keys in this browser's storage (the edition's prefix, then ws:<id>).
    out.storageBefore = await ip.evaluate(() => Object.keys(localStorage).filter((k) => /ws:/.test(k)));
    const answers = Object.assign({}, o.answers, {
      name: who.name,
      onStep: async (hd) => {
        if (hd === 'Investor status' && o.onStatusStep) await o.onStatusStep(ip, out.R);
      },
      onFilled: async (hd) => {
        if (hd === 'Investor status') {
          if (o.onStatus) await o.onStatus(ip, out.R);
          out.R.status = await L.screenText(ip);
          await ip.screenshot({ path: path.join(SHOTS, `${o.tag}-status.png`), fullPage: true });
        }
        if (hd === 'Subscription') {
          if (o.onSubscribe) await o.onSubscribe(ip, out.R);
          out.R.sub = await L.screenText(ip);
          await ip.screenshot({ path: path.join(SHOTS, `${o.tag}-subscribe.png`), fullPage: true });
        }
      }
    });
    const w = await L.walk(ip, answers);
    out.walk = w;
    check('the investor’s device runs on the server’s snapshot (state.remote) and reaches the agreement with no field error', w.reached && w.errors.length === 0 && w.seen.some((s) => /\| Investor status$/.test(s)), { seen: w.seen, errors: w.errors });
    // D-09 (plan 06-16): the investor type the sponsor chose travels in the snapshot and the device's record keeps it (the
    // console form's default, U.S. individual, for a new investor; an investor on file from before has none).
    const snapInv = (out.snaps.find((x) => x && x.investor) || {}).investor || {};
    const deviceType = await ip.evaluate(() => ((window.CVPortal.state.ws || {}).investors || []).map((x) => x.taxType || ''));
    const wantType = out.who ? undefined : 'us-individual';
    check('D-09: the snapshot carries the investor type the sponsor chose, and the investor’s device keeps it', snapInv.taxType === wantType && deviceType[0] === (wantType || ''), { snapshot: snapInv.taxType, device: deviceType });
    out.remote = await ip.evaluate(() => !!(window.CVPortal.state.remote && window.CVPortal.state.remote.server && !window.CVPortal.state.remote.refused));
    // The answers as the device holds them on its request, before it sends anything.
    out.deviceQual = await ip.evaluate(() => {
      const r = ((window.CVPortal.state.ws || {}).requests || []).filter((x) => x.type === 'subscription').pop();
      return r ? JSON.parse(JSON.stringify(r.qual === undefined ? '(none)' : r.qual)) : '(no request)';
    });
    out.done = await L.finishAgreement(ip);
    await ip.screenshot({ path: path.join(SHOTS, `${o.tag}-done.png`), fullPage: true });
    out.row = await srv.waitCompleted(inv.serverId);
    out.storageAfter = await ip.evaluate(() => Object.keys(localStorage).filter((k) => /ws:/.test(k)));
    // What the server holds for the console, read as the console reads it, before the console imports (and deletes) it.
    out.stored = await srv.submission(inv.serverId);
    if (o.beforeImport) {
      // A tampering check changes the stored submission: the device-to-server leg is compared with the copy from before.
      out.storedBefore = out.stored && out.stored.request ? JSON.parse(JSON.stringify(out.stored.request.qual)) : null;
      out.tampered = true;
      out.stored = await o.beforeImport(srv, inv, out.stored);
    }

    // The console imports with its own button, then reads its own copy.
    await L.importFromConsole(cp, inv.id);
    out.req = await consoleRequest(cp, inv.investorId, off.offeringId);
    out.afterImport = (await srv.rows()).find((x) => x.id === inv.serverId);
    return out;
  } catch (e) {
    await out.close();
    throw e;
  }
}

/** Checks every server-mode part makes on transport, isolation and the import. */
function commonChecks(check, F) {
  check('the investor’s page loaded the invitation from the server (state.remote, trusted from CVPortalConfig)', F.remote === true, F.remote);
  check('the two contexts share nothing: the investor’s device never holds the firm’s workspace, only its own copy of the invitation', !F.storageBefore.some((k) => /ws:kestrel-bay$/.test(k)) && !F.storageAfter.some((k) => /ws:kestrel-bay$/.test(k)) && F.storageAfter.length === 1 && /ws:invite-/.test(F.storageAfter[0]), { before: F.storageBefore, after: F.storageAfter });
  check('the investor’s device called the integration server (load, progress, complete) and nothing else outside', F.B.net.allowed.some((x) => /^GET .*\/v1\/invite$/.test(x)) && F.B.net.allowed.some((x) => /^PUT .*\/v1\/invite\/progress$/.test(x)) && F.B.net.allowed.some((x) => /^POST .*\/v1\/invite\/complete$/.test(x)) && F.B.net.external.length === 0, { allowed: F.B.net.allowed.slice(0, 40), external: F.B.net.external });
  check('the console called the integration server (send, list, submission, delete) and nothing else outside', F.A.net.allowed.some((x) => /^POST .*\/v1\/invitations$/.test(x)) && F.A.net.allowed.some((x) => /^GET .*\/submission$/.test(x)) && F.A.net.allowed.some((x) => /^DELETE .*\/submission$/.test(x)) && F.A.net.external.length === 0, { allowed: F.A.net.allowed, external: F.A.net.external });
  const sq = F.stored && F.stored.request ? F.stored.request.qual : undefined;
  check('the server stored the request with the status answers on it (request.qual)', !!sq && typeof sq === 'object' && /^\d{4}-\d{2}-\d{2}T/.test(sq.at || ''), F.stored && F.stored.request);
  check('the console imported the request, pending, for the invited investor and offering', !!F.req && F.req.status === 'pending' && F.stored && F.req.id === F.stored.request.id, F.req);
  check('the server stored exactly the qual the investor’s device put on its request', isDeepStrictEqual(F.deviceQual, F.tampered ? F.storedBefore : sq), { device: F.deviceQual, server: F.tampered ? F.storedBefore : sq });
  check('the imported request’s qual deep-equals the one the server stored', !!F.req && isDeepStrictEqual(F.req.qual, sq), { console: F.req && F.req.qual, server: sq });
  check('the console deleted its copy on the server after importing (nothing left to import)', !!F.afterImport && F.afterImport.hasSubmission === false, F.afterImport);
  check('no script error in the console', F.A.errors.length === 0, F.A.errors);
  check('no script error on the investor’s device', F.B.errors.length === 0, F.B.errors);
}

/**
 * C-01 in server mode, one boundary: n non-accredited purchasers counted in the console before the invitation is sent.
 * Returns the flow with R.warnBefore (warning count before the investor answers), R.warn (warning text after answering no).
 */
function fullFlow(S, check, n, tag, extra) {
  const answers = { acc: 'no', exp: 'Eight years of private real estate commitments', edu: 'Physician', rep: 'no', amount: 60000 };
  return serverFlow(S, check, Object.assign({
    tag,
    exemption: 'Rule 506(b)',
    answers,
    beforeInvite: async (cp, off, out) => {
      out.counted = await seedNonAccredited(cp, off.offeringId, n, tag);
    },
    onStatusStep: async (p, R) => {
      R.warnBefore = await p.locator('.ivf-form .wire-warn').count();
    },
    onStatus: async (p, R) => {
      R.warn = await warnText(p);
    }
  }, extra || {}));
}

const parts = {
  /**
   * C-01 in server mode (plan 06-07, changed by plan 06-15): the owner removed the investor-side "506(b) may be full" warning,
   * so the snapshot carries no offering.nonAccreditedFull and the investor sees no warning at 34 or 35 counted. The sponsor's
   * count and flag stay: with 35 counted the investor (the 36th) completes and the console flags the request 36 of 35.
   */
  async full({ check, S }) {
    // 34 counted: the boundary below the limit. Before the console imports, the stored request's dates are altered (a device
    // that backdates its subscription): the console sets the submitted day and the closing date itself.
    const F34 = await fullFlow(S, check, 34, 'full34', {
      beforeImport: async (srv, inv) => {
        srv.alter(inv.serverId, (s) => {
          s.request.submitted = '2001-01-02';
          s.request.dealing = '1999-12-31';
        });
        return srv.submission(inv.serverId);
      }
    });
    try {
      check('34 non-accredited purchasers counted in the console before the invitation', F34.counted === 34, F34.counted);
      // The requests page's Date column is the subscription's closing date (closed-end offering) or effective date (open-ended),
      // not the day the request was made (that is the Submitted column). Both are the console's own, never the device's.
      const dates = await F34.A.page.evaluate(({ rid, oid, iid }) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const r = ws.requests.find((x) => x.id === rid) || {};
        const o = ws.offerings.find((x) => x.id === oid) || {};
        const it = ws.invitations.find((x) => x.id === iid) || {};
        return { submitted: r.submitted, dealing: r.dealing, closeDate: o.closeDate, open: NS.ops.isOpen(o), want: NS.ops.isOpen(o) ? NS.ops.subscriptionDate(NS.dates.today()) : o.closeDate, today: NS.dates.today(), sentDay: String(it.sentAt || '').slice(0, 10) };
      }, { rid: F34.req && F34.req.id, oid: F34.off.offeringId, iid: F34.inv.id });
      check('the stored request was backdated before import (submitted 2001-01-02, dealing 1999-12-31)', !!F34.stored && F34.stored.request && F34.stored.request.submitted === '2001-01-02' && F34.stored.request.dealing === '1999-12-31', F34.stored && F34.stored.request && { submitted: F34.stored.request.submitted, dealing: F34.stored.request.dealing });
      check('the console sets the request’s own dates: submitted is today (not before the invitation), the Date column’s date is the offering’s closing or effective date', dates.submitted === dates.today && dates.submitted >= dates.sentDay && dates.dealing === dates.want, dates);
      await L.consoleRoute(F34.A.page, 'console-requests', '[data-action=req-tab][data-t=all]');
      await F34.A.page.click('[data-action=req-tab][data-t=all]');
      await F34.A.page.waitForTimeout(300);
      const row34 = F34.req ? await requestRow(F34.A.page, F34.req.id) : '';
      await F34.A.page.screenshot({ path: path.join(SHOTS, 'full34-requests.png'), fullPage: true });
      check('the request row shows no backdated date (2001 or 1999)', !!row34 && !/\b(2001|1999)\b/.test(row34), row34);
      const sn = F34.snaps[0] || {};
      // Owner (plan 06-15): the snapshot no longer carries the "may be full" boolean.
      check('with 34 counted the snapshot the investor’s page receives carries no offering.nonAccreditedFull', F34.snaps.length >= 1 && !!sn.offering && !('nonAccreditedFull' in sn.offering), sn.offering && Object.keys(sn.offering));
      check('with 34 counted the investor answering "not accredited" sees no warning (before or after answering)', F34.R.warnBefore === 0 && !FULL_WARN.test(F34.R.warn || '') && !FULL_WARN.test(F34.R.status || ''), { before: F34.R.warnBefore, warn: F34.R.warn });
      commonChecks(check, F34);
      await L.consoleRoute(F34.A.page, 'console-offering-' + F34.off.offeringId);
      const el34 = await panelText(F34.A.page, 'Investor eligibility');
      await F34.A.page.screenshot({ path: path.join(SHOTS, 'full34-console-offering.png'), fullPage: true });
      check('the console counts the imported request: "Non-accredited purchasers: 35 of 35", at the limit', /Non-accredited purchasers: 35 of 35/.test(el34) && /At the limit/.test(el34), el34);
    } finally {
      await F34.close();
    }
    // 35 counted: the invited investor would be the 36th.
    const F = await fullFlow(S, check, 35, 'full35');
    try {
      check('35 non-accredited purchasers counted in the console before the invitation', F.counted === 35, F.counted);
      const sn = F.snaps[0] || {};
      check('with 35 counted the snapshot the investor’s page receives carries no offering.nonAccreditedFull', F.snaps.length >= 1 && !!sn.offering && !('nonAccreditedFull' in sn.offering), sn.offering && Object.keys(sn.offering));
      check('the investor’s server-mode workspace holds no such flag on its offering', (await F.B.page.evaluate(() => 'nonAccreditedFull' in window.CVPortal.state.ws.offerings[0])) === false);
      check('no warning before or after the investor answers "not accredited" (owner, plan 06-15)', F.R.warnBefore === 0 && !FULL_WARN.test(F.R.warn || '') && !FULL_WARN.test(F.R.status || ''), { before: F.R.warnBefore, warn: F.R.warn });
      check('the screen names no other investor (T-06-04)', !/Seeded Purchaser/.test(F.R.status || ''), (F.R.status || '').slice(0, 800));
      check('the investor completes the subscription and the agreement', F.walk.reached && F.walk.errors.length === 0 && /\S/.test(F.done || ''), { seen: F.walk.seen, errors: F.walk.errors });
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      check('qual: regime 506b, accredited false', q.regime === '506b' && q.accredited === false, q);
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const el = await panelText(cp, 'Investor eligibility');
      await cp.screenshot({ path: path.join(SHOTS, 'full35-console-offering.png'), fullPage: true });
      check('the console counts the imported request: "Non-accredited purchasers: 36 of 35"', /Non-accredited purchasers: 36 of 35/.test(el), el);
      await L.consoleRoute(cp, 'console-requests', '[data-action=req-tab][data-t=all]');
      await cp.click('[data-action=req-tab][data-t=all]');
      await cp.waitForTimeout(300);
      const row = F.req ? await requestRow(cp, F.req.id) : '';
      await cp.screenshot({ path: path.join(SHOTS, 'full35-requests.png'), fullPage: true });
      check('the request row carries "Would be non-accredited purchaser 36 of the 35 allowed under Rule 506(b)"', /Would be non-accredited purchaser 36 of the 35 allowed under Rule 506\(b\)/.test(row), row);
      const lk = L.leakCheck([F.R.status, el, row].join('\n'));
      check('white label: the status screen and the console pages pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * D-01, C-01 in server mode: a non-accredited 506(b) investor answering Rule 506(b)(2)(ii)'s question (with a purchaser
   * representative, D-08 (2)) and plan '4975' completes on their own device; the console imports and shows 1 of 35 with 1
   * pending, and the benefit plan list names the investor with the pending subscription (D-08 (1), plan 06-15).
   */
  async b506({ check, S }) {
    const answers = { acc: 'no', exp: 'Twelve years of private real estate and venture fund commitments', edu: 'Civil engineer, MBA', rep: 'yes', soph: 'rep', repName: 'Morgan Ellery', amount: 60000 };
    const F = await serverFlow(S, check, {
      tag: 'b506',
      exemption: 'Rule 506(b)',
      answers,
      onStatusStep: async (p, R) => {
        await p.check('input[name="ob-stPlan"][value="4975"]');
        await p.waitForTimeout(200);
      },
      onStatus: async (p, R) => {
        R.plan = await p.evaluate(() => (document.querySelector('input[name="ob-stPlan"]:checked') || {}).value || '');
      }
    });
    try {
      check('the offering is Rule 506(b) with its agreement ready', F.off.ready && F.exemption === 'Rule 506(b)', { off: F.off, exemption: F.exemption });
      const st = F.R.status || '';
      check('the status step on the investor’s device asks the accredited question, Rule 506(b)(2)(ii)’s question and the benefit plan question (D-08)', /Is Dana Whitfield an accredited investor\?/.test(st) && /alone or with a purchaser representative, have enough knowledge and experience/.test(st) && !/investment experience/i.test(st) && /a benefit plan investor\?/.test(st) && F.R.plan === '4975', { plan: F.R.plan, st: st.slice(0, 1500) });
      check('the subscribe step states the account is not accredited', /is not an accredited investor/.test(F.R.sub || ''), (F.R.sub || '').slice(0, 1200));
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      const so = q.sophistication || {};
      check('qual: regime 506b, accredited false', q.regime === '506b' && q.accredited === false, q);
      check('qual: the sophistication answer and the purchaser representative arrive as given, nothing else (D-08 (2))', so.knowledge === 'rep' && !!so.rep && so.rep.name === answers.repName && so.experience === undefined && so.rep.firm === undefined, so);
      check('qual.erisa arrives intact: exactly { plan: 4975, planPct: null }', JSON.stringify(q.erisa) === '{"plan":"4975","planPct":null}', q.erisa);
      check('the investor’s change-log entry for the answer reached the console', await F.A.page.evaluate((id) => (window.CVPortal.state.ws.audit || []).some((e) => e.record === id && e.action === 'Investor status answered' && /not an accredited investor/.test(e.detail) && /from the investor.s device/.test(e.detail)), F.inv.investorId));
      // The console's offering page counts the imported answers exactly as in local mode.
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const ct = await L.screenText(cp);
      await cp.screenshot({ path: path.join(SHOTS, 'b506-console-offering.png'), fullPage: true });
      check('the console offering page shows "Non-accredited purchasers: 1 of 35"', /Non-accredited purchasers: 1 of 35/.test(ct), ct.slice(0, 2500));
      check('the console offering page shows "0 accepted and 1 more pending"', /\b0 accepted and 1 more pending\b/.test(ct), ct.slice(0, 2500));
      // D-08 (1) (plan 06-15): the plain list of who answered yes, with the pending subscription; no figure worked out.
      const bp = await panelText(cp, 'Benefit plan investors');
      const rowB = await cp.evaluate((iid) => (document.querySelector(`.cs-bpi-row[data-investor="${CSS.escape(iid)}"]`) || {}).innerText || '', F.inv.investorId);
      check('the benefit plan list names the investor, the section 4975 answer and the $60,000 pending; no percentage', /Code section 4975/.test(rowB) && /\$60,000 pending/.test(rowB) && !/%/.test(bp), { rowB, bp: bp.slice(0, 1200) });
      const leakSt = L.leakCheck(st);
      const leakC = L.leakCheck(ct);
      check('white label: the investor’s status screen passes the leak check', leakSt.ok, leakSt.hits);
      check('white label: the console offering page passes the leak check', leakC.ok, leakC.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * C-01 / D-07 / T-06-13 in server mode: a Regulation A Tier 2 person who is not accredited leaves the attestation to the
   * 10 percent limit unticked, commits $60,000, sees the warning and completes on their own device. The attestation
   * (attested false) travels to the server and the console unchanged; the console flags the request and names the investor.
   */
  async regA({ check, S }) {
    const F = await serverFlow(S, check, {
      tag: 'regA',
      exemption: 'Regulation A Tier 2',
      answers: { acc: 'no', amount: 60000 },
      onStatus: async (p, R) => {
        R.attestQ = await p.locator('#ob-stRaAttest').count();
        R.attestText = R.attestQ ? await p.locator('label[for="ob-stRaAttest"]').innerText() : '';
        R.figFields = await p.locator('#ob-stIncome, #ob-stWorth, #ob-stRevenue, #ob-stAssets, input[name="ob-stRaKind"], #ra-limit').count();
      },
      onSubscribe: async (p, R) => {
        R.raSub = await p.locator('#ra-sub').innerText().catch(() => '');
        R.warn = await p.locator('#ra-sub .wire-warn').innerText().catch(() => '');
      }
    });
    try {
      check('the offering is "Regulation A Tier 2", chosen with the console’s select', F.exemption === 'Regulation A Tier 2', F.exemption);
      check('the investor’s device shows the one statement about the 10 percent limit and no figure fields or limit line', F.R.attestQ === 1 && /is not more than 10 percent of my annual income or my net worth/.test(F.R.attestText || '') && F.R.figFields === 0, F.R);
      check('left unticked, the subscribe step warns without blocking', /You have not confirmed that your total investment in this offering is within your limit under Regulation A/.test(F.R.warn || '') && F.walk.errors.length === 0, { raSub: F.R.raSub, warn: F.R.warn });
      check('the device’s own qual carries regA exactly { attested: false }', !!F.deviceQual && JSON.stringify(F.deviceQual.regA) === '{"attested":false}', F.deviceQual);
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      check('the console’s imported request: regA2, not accredited, attested false', q.regime === 'regA2' && q.accredited === false && JSON.stringify(q.regA) === '{"attested":false}', q);
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-requests', '[data-action=req-tab][data-t=all]');
      await cp.click('[data-action=req-tab][data-t=all]');
      await cp.waitForTimeout(300);
      const row = F.req ? await requestRow(cp, F.req.id) : '';
      await cp.screenshot({ path: path.join(SHOTS, 'regA-requests.png'), fullPage: true });
      check('the request row reads "Not accredited and has not attested to the Regulation A Tier 2 limit (10 percent of income or net worth)"', /Not accredited and has not attested to the Regulation A Tier 2 limit \(10 percent of income or net worth\)/.test(row), row);
      check('the flagged request keeps Approve and Decline (nothing blocked)', F.req && (await cp.locator(`[data-action=req-approve][data-id="${F.req.id}"]`).count()) === 1 && (await cp.locator(`[data-action=req-decline][data-id="${F.req.id}"]`).count()) === 1);
      const rowText = await L.screenText(cp);
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const el = await panelText(cp, 'Investor eligibility');
      const ct = await L.screenText(cp);
      await cp.screenshot({ path: path.join(SHOTS, 'regA-console-offering.png'), fullPage: true });
      check('the eligibility panel: 1 non-accredited subscriber, 1 not attested to the 10 percent limit', /Regulation A Tier 2: 1 non-accredited subscribers?, 1 not attested to the 10 percent limit/.test(el), el);
      check('the eligibility panel names Dana Whitfield as not attested, with no amount or limit', /Dana Whitfield has not attested that this investment is within their 10 percent limit/.test(el) && !/\$/.test(el), el);
      const lk = L.leakCheck([F.R.status, F.R.sub, rowText, ct].join('\n'));
      check('white label: the investor’s status and subscribe screens and the console pages pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * D-01 in server mode, both ways (plan 06-07): an investor on file (benefit plan answer 'title1', a self-certified ground)
   * is invited to the Rule 506(b) offering. Their device gets the answers in the snapshot's on-file summary, shows them
   * prefilled, and the investor changes the plan to 'none'. After import the console's investor.erisa.plan is 'none', the
   * ground is kept (dated by this answer) and the request's qual agrees.
   */
  async existing({ check, S }) {
    const OLD_DATE = '2024-01-15';
    const F = await serverFlow(S, check, {
      tag: 'existing',
      exemption: 'Rule 506(b)',
      answers: { amount: 60000 },
      beforeInvite: async (cp, off, out) => {
        out.who = await cp.evaluate(
          ({ oid, OLD_DATE }) => {
            const NS = window.CVPortal;
            const ws = NS.state.ws;
            const i = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.accreditation && x.accreditation.basis && !x.accreditation.verifiedBy && x.email && !(x.positions || []).some((y) => y.offeringId === oid));
            if (!i) return null;
            i.erisa = { plan: 'title1', planPct: null, controlling: true, at: '2025-06-01T12:00:00Z' };
            i.accreditation = Object.assign({}, i.accreditation, { date: OLD_DATE });
            NS.app.save(true);
            const parts = String(i.contact).trim().split(/\s+/);
            return { id: i.id, name: i.contact, first: parts[0], last: parts.slice(1).join(' ') || parts[0], email: i.email, basis: i.accreditation.basis };
          },
          { oid: off.offeringId, OLD_DATE }
        );
      },
      onStatusStep: async (p, R) => {
        R.pre = await p.evaluate(() => ({
          acc: (document.querySelector('input[name="ob-stAcc"]:checked') || {}).value || '',
          basis: (document.querySelector('input[name="ob-stBasis"]:checked') || {}).value || '',
          plan: (document.querySelector('input[name="ob-stPlan"]:checked') || {}).value || '',
          ctrl: (document.querySelector('input[name="ob-stCtrl"]:checked') || {}).value || '',
          ctrlQ: document.querySelectorAll('input[name="ob-stCtrl"]').length
        }));
        await p.screenshot({ path: path.join(SHOTS, 'existing-status-prefilled.png'), fullPage: true });
        await p.check('input[name="ob-stPlan"][value="none"]');
        await p.waitForTimeout(200);
      },
      onStatus: async (p, R) => {
        R.plan = await p.evaluate(() => (document.querySelector('input[name="ob-stPlan"]:checked') || {}).value || '');
      }
    });
    try {
      const who = F.who || {};
      check('an active individual investor on file with a self-certified ground, not holding the offering', !!F.who && !!who.basis, F.who);
      check('the invitation is to subscribe (the investor is on file)', (await F.A.page.evaluate((id) => !!(window.CVPortal.state.ws.invitations.find((x) => x.id === id) || {}).existing, F.inv.id)) && F.inv.investorId === who.id, F.inv);
      const ex = ((F.snaps[0] || {}).investor || {}).existing || {};
      // D-08 (1) (plan 06-15): the control answer an earlier version kept on the record is not sent (no longer asked).
      check('the snapshot’s on-file summary carries the ground and the benefit plan answer, cleaned to known fields (no control answer)', ex.accBasis === who.basis && isDeepStrictEqual(ex.erisa, { plan: 'title1', planPct: null }), ex);
      check('the on-file summary carries no personal details (no address, phone, taxpayer ID, bank or positions)', isDeepStrictEqual(Object.keys(ex).sort(), ['accBasis', 'accredited', 'accreditedUntil', 'erisa', 'holds']), Object.keys(ex));
      check('the status step on the investor’s device is prefilled: accredited yes, the ground on file, plan title1; no control question', !!F.R.pre && F.R.pre.acc === 'yes' && F.R.pre.basis === who.basis && F.R.pre.plan === 'title1' && F.R.pre.ctrl === '' && F.R.pre.ctrlQ === 0, { pre: F.R.pre, basis: who.basis });
      check('the investor changed the plan to none', F.R.plan === 'none', F.R.plan);
      const heads = F.walk.seen.map((x) => x.split(' | ').pop());
      check('steps: welcome, status, subscribe, agreement', /^Welcome/.test(heads[0]) && heads.slice(1).join(',') === 'Investor status,Subscription,Subscription agreement', F.walk.seen);
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      check('qual: regime 506b, accredited true, the ground on file, plan none', q.regime === '506b' && q.accredited === true && q.basis === who.basis && !!q.erisa && q.erisa.plan === 'none' && !('share' in q.erisa), q);
      const rec = await F.A.page.evaluate((id) => {
        const i = window.CVPortal.state.ws.investors.find((x) => x.id === id) || {};
        return { erisa: i.erisa || null, accreditation: i.accreditation || null };
      }, who.id);
      check('after import the console’s investor.erisa is the answer the link collected: plan none, no control answer', !!rec.erisa && rec.erisa.plan === 'none' && rec.erisa.planPct === null && !('controlling' in rec.erisa), rec.erisa);
      check('the self-certified ground is kept, dated by this answer (not the old date)', !!rec.accreditation && rec.accreditation.basis === who.basis && rec.accreditation.basis === q.basis && rec.accreditation.date !== OLD_DATE && /^\d{4}-\d{2}-\d{2}$/.test(rec.accreditation.date || ''), rec.accreditation);
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const bp = await panelText(cp, 'Benefit plan investors');
      await cp.screenshot({ path: path.join(SHOTS, 'existing-console-offering.png'), fullPage: true });
      const lk = L.leakCheck([F.R.status, F.R.sub, bp].join('\n'));
      check('white label: the status and subscribe screens and the benefit plan panel pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * Verifier gap 2 / T-06-21 in server mode (plan 06-09): an investor on file with a self-certified ground (dated 2026-04-16,
   * with the self-certification verification record made from it) answers "not accredited" on their own device. After the
   * console's import its record no longer holds the ground, exactly as onboarding.js withdrawGround leaves it in local mode
   * (basis and date cleared, the ground kept as superseded, the self-certification record withdrawn). Run B: a ground a third
   * party verified (verifiedBy) stays exactly as it was.
   */
  async withdraw({ check, S }) {
    const OLD = '2026-04-16';
    const pick = (third) => async (cp, off, out) => {
      out.who = await cp.evaluate(
        ({ oid, OLD, third }) => {
          const NS = window.CVPortal;
          const ws = NS.state.ws;
          const i = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.accreditation && x.accreditation.basis && !x.accreditation.verifiedBy && x.email && !(x.positions || []).some((y) => y.offeringId === oid));
          if (!i) return null;
          const basis = i.accreditation.basis;
          if (third) {
            i.accreditation = { basis, date: OLD, verifiedBy: 'Example Verification Services', expires: '2027-04-16' };
          } else {
            // The firm accepts self-certification: the ground made the self-certification record when it was given.
            NS.integrations.ensure(ws).use.accreditation = ['self'];
            i.accreditation = { basis, date: OLD };
            const at = `${OLD}T12:00:00Z`;
            i.verify = {
              identity: { status: 'passed', completedAt: at },
              aml: { status: 'clear', completedAt: at },
              accreditation: { status: 'verified', method: `Self-certified: ${basis}`, connection: 'self', via: NS.integrations.conn(ws, 'self').name, how: 'self', completedAt: at, verifiedAt: OLD, expiresAt: '2027-04-16' },
              decision: { status: 'approved', at, by: 'automatic', reason: 'all checks passed' }
            };
          }
          NS.app.save(true);
          const parts = String(i.contact).trim().split(/\s+/);
          return { id: i.id, name: i.contact, first: parts[0], last: parts.slice(1).join(' ') || parts[0], email: i.email, basis, before: JSON.parse(JSON.stringify({ accreditation: i.accreditation, verify: i.verify || null })) };
        },
        { oid: off.offeringId, OLD, third }
      );
    };
    const answers = { acc: 'no', exp: 'Ten years of private fund commitments', edu: 'Engineer', rep: 'no', amount: 60000 };
    const record = (page, id) =>
      page.evaluate((iid) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const i = ws.investors.find((x) => x.id === iid) || {};
        return { accreditation: i.accreditation || null, verify: i.verify ? JSON.parse(JSON.stringify(i.verify)) : null, today: NS.dates.today(), log: (ws.audit || []).filter((e) => e.record === iid).map((e) => ({ action: e.action, detail: e.detail })) };
      }, id);

    // Run A: a self-certified ground.
    const F = await serverFlow(S, check, { tag: 'withdraw', exemption: 'Rule 506(b)', answers, beforeInvite: pick(false) });
    try {
      const who = F.who || {};
      check('withdraw A: an active investor on file with a self-certified ground dated 2026-04-16 and its self-certification record', !!who.basis && who.before.accreditation.date === OLD && !!who.before.verify && who.before.verify.accreditation.connection === 'self', who);
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      check('withdraw A: the imported request records accredited false (regime 506b)', q.regime === '506b' && q.accredited === false, q);
      const r = await record(F.A.page, who.id);
      const a = r.accreditation || {};
      check('withdraw A: the console record no longer holds the ground: basis and date cleared, kept as superseded with when it was given (2026-04-16) and withdrawn (today)', a.basis === '' && a.date === '' && !!a.superseded && a.superseded.basis === who.basis && a.superseded.date === OLD && a.superseded.at === r.today && !a.verifiedBy, a);
      const va = (r.verify || {}).accreditation || {};
      check('withdraw A: the self-certification verification record made from the ground is withdrawn: not started, with the superseded record', va.status === 'not_started' && !!va.superseded && va.superseded.method === `Self-certified: ${who.basis}` && va.superseded.verifiedAt === OLD && /^\d{4}-\d{2}-\d{2}T/.test(va.superseded.at || ''), va);
      check('withdraw A: a change-log entry from the investor’s device says the ground no longer applies', r.log.some((e) => e.action === 'Investor status answered' && /no longer applies/.test(e.detail) && /from the investor.s device/.test(e.detail)), r.log);
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const el = await panelText(cp, 'Investor eligibility');
      await cp.screenshot({ path: path.join(SHOTS, 'withdraw-console-offering.png'), fullPage: true });
      check('withdraw A: the console offering page reads "Non-accredited purchasers: 1 of 35"', /Non-accredited purchasers: 1 of 35/.test(el), el);
    } finally {
      await F.close();
    }

    // Run B: the same answer over a ground a third party verified: it stays.
    const G = await serverFlow(S, check, { tag: 'withdrawB', exemption: 'Rule 506(b)', answers, beforeInvite: pick(true) });
    try {
      const who = G.who || {};
      check('withdraw B: an investor on file whose ground a third party verified (verifiedBy)', !!who.basis && !!who.before.accreditation.verifiedBy, who);
      const q = (G.req && G.req.qual) || {};
      check('withdraw B: the imported request records accredited false', q.accredited === false, q);
      const r = await record(G.A.page, who.id);
      check('withdraw B: the verified ground stays exactly as it was', isDeepStrictEqual(r.accreditation, who.before.accreditation), { now: r.accreditation, before: who.before.accreditation });
      check('withdraw B: the console’s own change-log entry says the verified accreditation stays on the record', r.log.some((e) => e.action === 'Accreditation kept' && /verified by Example Verification Services/.test(e.detail) && e.detail.indexOf(who.basis) >= 0 && !/from the investor.s device/.test(e.detail)), r.log);
      // Recorded for the summary, not asserted: what the device's own change-log entry for the answer says in this case.
      console.log('INFO withdraw B: device change-log entries for the answer:', JSON.stringify(r.log.filter((e) => e.action === 'Investor status answered')));
      check('withdraw B: no script error on either side', G.A.errors.length === 0 && G.B.errors.length === 0, { A: G.A.errors, B: G.B.errors });
    } finally {
      await G.close();
    }
  },

  /**
   * Deferred item 2 / T-06-20 (plan 06-09): an imported request's signedBy and signedAt are the console's, never the device's.
   * Each run alters the stored request before import (signedAt 2001-01-02T00:00:00Z, signedBy "Someone Else"):
   *   envelope   signedBy is the console's investor name; signedAt is the kept envelope's investor signature time
   *   unsigned   the envelope arrives with the investor's signature not made (they stopped before signing): signedAt ''
   *   noenvelope a request signed without an envelope: the integration server's completion time
   * every time inside the invitation window (from its sending to now).
   */
  async signed({ check, S }) {
    const answers = { acc: 'no', exp: 'Six years of private fund commitments', edu: 'Architect', rep: 'no', amount: 60000 };
    const FAKE = { signedAt: '2001-01-02T00:00:00Z', signedBy: 'Someone Else' };
    const runs = [
      ['envelope', (s) => Object.assign(s.request, FAKE)],
      [
        'unsigned',
        (s) => {
          Object.assign(s.request, FAKE);
          s.envelope.status = 'sent';
          s.envelope.completedAt = null;
          s.envelope.signers.forEach((x) => x.role === 'investor' && Object.assign(x, { status: 'waiting', signedAt: null, signature: null, initials: null }));
        }
      ],
      [
        'noenvelope',
        (s) => {
          Object.assign(s.request, FAKE);
          delete s.request.envelopeId;
          s.envelope = null;
        }
      ]
    ];
    for (const [name, change] of runs) {
      const F = await serverFlow(S, check, {
        tag: `signed-${name}`,
        exemption: 'Rule 506(b)',
        answers,
        beforeImport: async (srv, inv) => {
          srv.alter(inv.serverId, change);
          return srv.submission(inv.serverId);
        }
      });
      try {
        const st = (F.stored && F.stored.request) || {};
        check(`signed ${name}: the stored request was altered before import (signedAt 2001-01-02, signedBy "Someone Else")`, st.signedAt === FAKE.signedAt && st.signedBy === FAKE.signedBy, { signedAt: st.signedAt, signedBy: st.signedBy });
        commonChecks(check, F);
        const got = await F.A.page.evaluate(({ rid, iid, ivid }) => {
          const ws = window.CVPortal.state.ws;
          const r = ws.requests.find((x) => x.id === rid) || {};
          const i = ws.investors.find((x) => x.id === ivid) || {};
          const it = ws.invitations.find((x) => x.id === iid) || {};
          const e = r.envelopeId ? ws.envelopes.find((x) => x.id === r.envelopeId) : null;
          const sg = e ? e.signers.find((x) => x.role === 'investor') : null;
          return { signedAt: r.signedAt, signedBy: r.signedBy, envelopeId: r.envelopeId || '', envStatus: e ? e.status : '', signer: sg ? { status: sg.status, signedAt: sg.signedAt } : null, contact: i.contact, title: i.title, sentAt: it.sentAt, now: new Date().toISOString() };
        }, { rid: F.req && F.req.id, iid: F.inv.id, ivid: F.inv.investorId });
        const inWindow = (t) => !!t && Date.parse(t) >= Date.parse(got.sentAt) - 1000 && Date.parse(t) <= Date.parse(got.now);
        check(`signed ${name}: signedBy is the console’s own investor name, not the device’s`, got.signedBy === (got.contact || got.title) && got.signedBy !== FAKE.signedBy, got);
        if (name === 'envelope') {
          const want = got.signer && got.signer.status === 'signed' ? String(got.signer.signedAt || '').replace(/\.\d{3}Z$/, 'Z') : '(unsigned)';
          check('signed envelope: the request is tied to the kept envelope, whose investor signature is made', !!got.envelopeId && !!got.signer && got.signer.status === 'signed', got);
          check('signed envelope: signedAt is the kept envelope’s investor signature time, inside the invitation window', got.signedAt === want && inWindow(got.signedAt), got);
        } else if (name === 'unsigned') {
          check('signed unsigned: the kept envelope’s investor signature is not made', !!got.envelopeId && !!got.signer && got.signer.status !== 'signed', got);
          check('signed unsigned: signedAt is empty, whatever the device sent', got.signedAt === '', got);
        } else {
          const done = String((F.stored && F.stored.completedAt) || '').replace(/\.\d{3}Z$/, 'Z');
          check('signed noenvelope: the request has no envelope', !got.envelopeId, got);
          check('signed noenvelope: signedAt is the integration server’s completion time, inside the invitation window', !!done && got.signedAt === done && inWindow(got.signedAt), { got, serverCompletedAt: F.stored && F.stored.completedAt });
        }
      } finally {
        await F.close();
      }
    }
  },

  /**
   * D-30 / T-06-16 in server mode (plan 06-07): a non-accredited 506(b) investor attaches the written acknowledgment of their
   * purchaser representative on their own device. It travels with the completion (rep-<investor id>-<time>, named by the
   * request's qual), passes the server's allowlist as evidence, is stored by the console's import, and the request row's
   * download returns the same bytes under the uploaded name.
   */
  async repack({ check, S }) {
    const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% acknowledgment of purchaser representative, signed by Dana Whitfield\ntrailer << /Root 1 0 R >>\n%%EOF\n');
    const answers = { acc: 'no', exp: 'Four years of real estate syndications', edu: 'Nurse', rep: 'yes', soph: 'rep', repName: 'Morgan Ellery', amount: 60000 };
    const F = await serverFlow(S, check, {
      tag: 'repack',
      exemption: 'Rule 506(b)',
      answers,
      onStatus: async (p, R) => {
        await p.setInputFiles('#ob-stRepFile', { name: 'acknowledgment.pdf', mimeType: 'application/pdf', buffer: PDF });
        await p.waitForTimeout(500);
        R.fileId = await p.evaluate(() => (window.CVPortal.state.ui.ob || { d: {} }).d.stRepFileId || '');
        R.hint = await p.locator('#hint-stRepFile').innerText().catch(() => '');
      }
    });
    try {
      const id = F.R.fileId;
      check('the investor’s device keeps the acknowledgment as rep-{investor id}-{time}', new RegExp(`^rep-${F.inv.investorId}-[0-9a-z]+$`).test(id) && /Attached: acknowledgment\.pdf/.test(F.R.hint), F.R.hint);
      const dr = ((F.deviceQual || {}).sophistication || {}).rep || {};
      check('the device’s request names it: qual.sophistication.rep.fileId and fileName', dr.fileId === id && dr.fileName === 'acknowledgment.pdf', dr);
      commonChecks(check, F);
      const files = (F.stored && F.stored.files) || {};
      check('the acknowledgment passed the server’s allowlist: the server holds it, byte for byte', typeof files[id] === 'string' && Buffer.from(files[id], 'base64').equals(PDF), Object.keys(files));
      const rq = ((F.req && F.req.qual) || {}).sophistication || {};
      check('the imported request keeps the pointer: rep.fileId and fileName', !!rq.rep && rq.rep.fileId === id && rq.rep.fileName === 'acknowledgment.pdf', rq.rep);
      const kept = await F.A.page.evaluate(async (fid) => {
        const b = await window.CVPortal.ops.files.get(fid);
        return b ? Array.from(new Uint8Array(await b.arrayBuffer())) : null;
      }, id);
      check('the console stored the acknowledgment under the same id, byte for byte', !!kept && Buffer.from(kept).equals(PDF), kept && kept.length);
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-requests', '[data-action=req-tab][data-t=all]');
      await cp.click('[data-action=req-tab][data-t=all]');
      await cp.waitForTimeout(300);
      const row = F.req ? await requestRow(cp, F.req.id) : '';
      await cp.screenshot({ path: path.join(SHOTS, 'repack-requests.png'), fullPage: true });
      check('the request row shows "Purchaser representative: Morgan Ellery" and the download (D-08 (2): name only)', /Purchaser representative: Morgan Ellery ·/.test(row) && /Download the written acknowledgment/.test(row), row);
      let got = null;
      let name = '';
      if (id && (await cp.locator(`[data-action=kyc-iv-file][data-id="${id}"]`).count())) {
        const [dl] = await Promise.all([cp.waitForEvent('download', { timeout: 15000 }), cp.click(`[data-action=kyc-iv-file][data-id="${id}"]`)]);
        got = fs.readFileSync(await dl.path());
        name = dl.suggestedFilename();
      }
      check('the request row’s download returns the same bytes, under the uploaded name', !!got && got.equals(PDF) && name === 'acknowledgment.pdf', { size: got && got.length, want: PDF.length, name });
      const lk = L.leakCheck([F.R.status, row].join('\n'));
      check('white label: the status screen and the request row pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
    // An acknowledgment of the full 25 MB the page accepts does not fit with the signed agreement: it stays on the device, the
    // completion still goes, the firm's copy of the request says so and points at no file, and the investor is told.
    const BIG = Buffer.alloc(25 * 1024 * 1024, 0x20);
    PDF.copy(BIG, 0);
    const G = await serverFlow(S, check, {
      tag: 'repbig',
      exemption: 'Rule 506(b)',
      answers,
      onStatus: async (p, R) => {
        await p.setInputFiles('#ob-stRepFile', { name: 'acknowledgment-scan.pdf', mimeType: 'application/pdf', buffer: BIG });
        await p.waitForTimeout(1500);
        R.fileId = await p.evaluate(() => (window.CVPortal.state.ui.ob || { d: {} }).d.stRepFileId || '');
      }
    });
    try {
      check('a 25 MB acknowledgment is accepted on the status step', new RegExp(`^rep-${G.inv.investorId}-[0-9a-z]+$`).test(G.R.fileId), G.R.fileId);
      check('it does not fit with the agreement: the server holds the agreement and no acknowledgment', !!G.stored && Object.keys(G.stored.files || {}).length === 1 && !Object.keys(G.stored.files || {}).some((k) => /^rep-/.test(k)), G.stored && Object.keys(G.stored.files || {}));
      const sr = ((((G.stored || {}).request || {}).qual || {}).sophistication || {}).rep || {};
      check('the firm’s copy of the request points at no file and says to ask the investor for it', !sr.fileId && !sr.fileName && /written acknowledgment of their purchaser representative the investor uploaded \(acknowledgment-scan\.pdf\) did not fit in the 25 MB/.test(sr.note || '') && /Ask the investor for it\./.test(sr.note || ''), sr);
      check('the done screen tells the investor the acknowledgment could not be sent', /The acknowledgment of your purchaser representative you uploaded could not be sent with your details/.test(G.done || ''), (G.done || '').slice(0, 1500));
      check('the firm’s change log records the acknowledgment not sent', await G.A.page.evaluate((id) => (window.CVPortal.state.ws.audit || []).some((e) => e.record === id && e.action === 'Uploaded evidence not sent' && /purchaser representative/.test(e.detail)), G.inv.investorId));
      const cp = G.A.page;
      await L.consoleRoute(cp, 'console-requests', '[data-action=req-tab][data-t=all]');
      await cp.click('[data-action=req-tab][data-t=all]');
      await cp.waitForTimeout(300);
      const row = G.req ? await requestRow(cp, G.req.id) : '';
      await cp.screenshot({ path: path.join(SHOTS, 'repbig-requests.png'), fullPage: true });
      check('the request row gives the note instead of a download', /Purchaser representative: Morgan Ellery; The written acknowledgment/.test(row) && !/Download the written acknowledgment/.test(row), row);
      check('no script error on either side', G.A.errors.length === 0 && G.B.errors.length === 0, { A: G.A.errors, B: G.B.errors });
    } finally {
      await G.close();
    }
  },

  /**
   * T-06-15 (plan 06-07): what the investor's page receives from the server, read in the investor's own context, carries
   * nothing about other investors: no count, no name, no email, no id and no request of the 35 non-accredited purchasers
   * already on the console, and (owner, plan 06-15) no longer even the C-01 "may be full" boolean. The investor's own
   * workspace holds only them.
   */
  async clean({ check, S }) {
    const srv = await L.serverPortal(S);
    const closers = [];
    try {
      const A = await L.open(S, { allow: [srv.base], init: srv.init });
      closers.push(() => A.context.close());
      const cp = A.page;
      const off = await L.setupPortal(S, A, { exemption: 'Rule 506(b)' });
      const counted = await seedNonAccredited(cp, off.offeringId, 35, 'cl');
      check('35 non-accredited purchasers counted in the console', counted === 35, counted);
      // Every detail of the others the console holds, to search for in what the investor's page receives.
      const others = await cp.evaluate(() => {
        const ws = window.CVPortal.state.ws;
        const inv = ws.investors.filter((i) => /^cl-inv-/.test(i.id));
        const req = ws.requests.filter((r) => /^cl-req-/.test(r.id));
        return { names: inv.map((i) => i.contact), emails: inv.map((i) => i.email), ids: inv.map((i) => i.id), requests: req.map((r) => r.id) };
      });
      await srv.configure(cp);
      const inv = await L.inviteFromConsole(cp, { first: INV.first, last: INV.last, email: INV.email, offeringId: off.offeringId });
      check('the console sends the invitation to the integration server', /^ivt_/.test(inv.serverId) && inv.link.indexOf(`server=${encodeURIComponent(srv.base)}`) > 0, inv);
      const B = await L.open(S, { allow: [srv.base], init: srv.init });
      closers.push(() => B.context.close());
      const ip = B.page;
      const raw = [];
      ip.on('response', async (res) => {
        if (res.request().method() !== 'GET' || !/\/v1\/invite$/.test(res.url().replace(/[?#].*$/, ''))) return;
        try {
          raw.push(await res.text());
        } catch (e) {
          raw.push('');
        }
      });
      await ip.goto(inv.link);
      await ip.waitForSelector('.ivf-form h1', { timeout: 30000 });
      await ip.waitForTimeout(300);
      check('the investor’s page received the snapshot from the server', raw.length >= 1 && raw[0].length > 0, raw.length);
      let snap = {};
      try {
        snap = JSON.parse(raw[0] || '{}');
      } catch (e) {
        snap = {};
      }
      // Owner (plan 06-15): the investor-side warning and its snapshot boolean are removed.
      check('the snapshot carries no offering.nonAccreditedFull', !('nonAccreditedFull' in (snap.offering || {})), snap.offering && Object.keys(snap.offering));
      // Every key anywhere in the snapshot: none that could carry a count, a list of investors or requests, or a place.
      const keys = new Set();
      const walkKeys = (x) => {
        if (Array.isArray(x)) return x.forEach(walkKeys);
        if (x && typeof x === 'object') Object.keys(x).forEach((k) => (keys.add(k), walkKeys(x[k])));
      };
      walkKeys(snap);
      const bad = Array.from(keys).filter((k) => /^(count|ranked|place|purchasers|investors|requests|positions|accepted|pending|unanswered|holders)$|^nonAccredited/.test(k));
      check('no key in the snapshot could carry a count, a place or other investors or requests', bad.length === 0, bad);
      check('the offering in the snapshot has only its known fields', Object.keys(snap.offering || {}).every((k) => ['id', 'name', 'shortName', 'type', 'summary', 'minimum', 'closeDate', 'terms', 'exemption', 'classes', 'currency', 'documents'].indexOf(k) >= 0), Object.keys(snap.offering || {}));
      check('the investor in the snapshot is the invited investor alone', !!snap.investor && snap.investor.id === inv.investorId && Object.keys(snap.investor).every((k) => ['id', 'contact', 'title', 'type', 'email', 'taxType', 'existing'].indexOf(k) >= 0), snap.investor);
      const text = raw.join('\n');
      const found = [].concat(others.names, others.emails, others.ids, others.requests).filter((v) => v && text.indexOf(v) >= 0);
      check(`none of the others’ ${others.names.length} names, emails, investor ids or request ids appears in what the page received`, others.names.length === 35 && found.length === 0 && !/Seeded Purchaser/.test(text), found.slice(0, 10));
      const dev = await ip.evaluate(() => {
        const ws = window.CVPortal.state.ws;
        return { investors: ws.investors.map((i) => i.id), requests: (ws.requests || []).length, offerings: ws.offerings.length, flag: !!ws.offerings[0] && 'nonAccreditedFull' in ws.offerings[0] };
      });
      check('the investor’s workspace holds one investor (them), one offering with no flag, and no request', dev.investors.length === 1 && dev.investors[0] === inv.investorId && dev.offerings === 1 && dev.flag === false && dev.requests === 0, dev);
      // The status step from it: no warning, no number and no name.
      const w = await L.walk(ip, {
        name: INV.name,
        acc: 'no',
        exp: 'Eight years of private real estate commitments',
        edu: 'Physician',
        rep: 'no',
        amount: 60000,
        onFilled: async (hd) => {
          if (hd !== 'Investor status') return;
          dev.warn = await warnText(ip);
          dev.st = await L.screenText(ip);
          await ip.screenshot({ path: path.join(SHOTS, 'clean-status.png'), fullPage: true });
        }
      });
      check('the status step shows no warning and names no other investor', !FULL_WARN.test(dev.warn || '') && !/Seeded Purchaser/.test(dev.st || ''), { warn: dev.warn, seen: w.seen });
      const lk = L.leakCheck(dev.st || '');
      check('white label: the status screen passes the leak check', lk.ok, lk.hits);
      check('no script error on either side', A.errors.length === 0 && B.errors.length === 0, { A: A.errors, B: B.errors });
      check('the investor’s device reached nothing outside but the integration server', B.net.external.length === 0, B.net.external);
    } finally {
      for (const c of closers.reverse()) await c().catch(() => {});
      await srv.close();
    }
  }
};

L.runParts(parts, { name: 'SERVER MODE', browser: true });
