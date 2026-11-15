#!/usr/bin/env node
// Server mode for the investor status answers (phase 6, plans 06-06 and 06-07; D-01, C-01, D-30, white label, C-05).
// Real invitations go through the firm's integration server. Each part runs the real server code (server/index.mjs)
// in this process and two separate browser contexts that share nothing except through that server: the sponsor's
// console (one context) sends the invitation with its own form; the investor's device (a second context, empty storage,
// the portal page listing the server as the firm publishes it) opens the ?server= link, answers the status step,
// subscribes and signs; the console imports with its own "Check now" and counts the answers exactly as in local mode.
//   NODE_PATH=$(npm root -g) node server-mode.js [--only b506,regA,full,existing,repack,clean]
// The last line is "SERVER MODE: PASS (parts run: N)" or "SERVER MODE: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const { isDeepStrictEqual } = require('util');
const L = require('./lib.js');

const SHOTS = path.join(L.OUT, 'server-shots');
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
        r.qual = { regime: '506b', at: new Date().toISOString(), accredited: false, basis: '', sophistication: { experience: 'Years of private fund commitments', education: 'Accountant', rep: null } };
      }
      NS.app.save(true);
      return NS.eligibility.nonAccredited(ws, o).count;
    },
    { offeringId, n, prefix }
  );

/** The investor status warning C-01 (the one the status step shows when the offering may be full), or ''. */
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
   * C-01 in server mode (plan 06-07): the invitation's snapshot carries offering.nonAccreditedFull, a boolean the console
   * works out when it sends. With 34 non-accredited purchasers counted the invited investor would be the 35th: false, and
   * no warning on their device. With 35 counted they would be the 36th: true, and the investor answering "not accredited"
   * sees the plain warning (no number, no name), still completes, and the console flags the request 36 of 35.
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
      check('with 34 counted the snapshot the investor’s page receives carries offering.nonAccreditedFull === false', F34.snaps.length >= 1 && !!sn.offering && sn.offering.nonAccreditedFull === false, sn.offering && { nonAccreditedFull: sn.offering.nonAccreditedFull });
      check('with 34 counted the investor answering "not accredited" sees no warning (before or after answering)', F34.R.warnBefore === 0 && !FULL_WARN.test(F34.R.warn || '') && !FULL_WARN.test(F34.R.status || ''), { before: F34.R.warnBefore, warn: F34.R.warn });
      commonChecks(check, F34);
      await F34.A.page.screenshot({ path: path.join(SHOTS, 'full34-console.png'), fullPage: true }).catch(() => {});
    } finally {
      await F34.close();
    }
    // 35 counted: the invited investor would be the 36th.
    const F = await fullFlow(S, check, 35, 'full35');
    try {
      check('35 non-accredited purchasers counted in the console before the invitation', F.counted === 35, F.counted);
      const sn = F.snaps[0] || {};
      check('with 35 counted the snapshot the investor’s page receives carries offering.nonAccreditedFull === true', F.snaps.length >= 1 && !!sn.offering && sn.offering.nonAccreditedFull === true, sn.offering && { nonAccreditedFull: sn.offering.nonAccreditedFull });
      check('the investor’s server-mode workspace holds the flag as a boolean on its offering', (await F.B.page.evaluate(() => window.CVPortal.state.ws.offerings[0].nonAccreditedFull)) === true);
      check('no warning before the investor answers', F.R.warnBefore === 0, F.R.warnBefore);
      const warn = F.R.warn || '';
      check('after answering "not accredited" the status step warns the offering may already be full, and that they can still subscribe', FULL_WARN.test(warn) && /You can still subscribe/.test(warn) && /reviews every subscription/.test(warn), warn);
      check('the warning shows no number and the screen names no other investor (T-06-04)', !!warn && !/\d/.test(warn) && !/Seeded Purchaser/.test(F.R.status || ''), { warn, st: (F.R.status || '').slice(0, 800) });
      check('the warning does not block: the investor completes the subscription and the agreement', F.walk.reached && F.walk.errors.length === 0 && /\S/.test(F.done || ''), { seen: F.walk.seen, errors: F.walk.errors });
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
      check('white label: the warning screen and the console pages pass the leak check', lk.ok, lk.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * D-01, C-01 in server mode: a non-accredited 506(b) investor with sophistication answers and plan '4975' completes on
   * their own device; the console imports and shows 1 of 35 with 1 pending, and the benefit plan figure counts the request.
   */
  async b506({ check, S }) {
    const answers = { acc: 'no', exp: 'Twelve years of private real estate and venture fund commitments', edu: 'Civil engineer, MBA', rep: 'yes', repName: 'Morgan Ellery', repFirm: 'Ellery Advisory Partners', amount: 60000 };
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
      check('the status step on the investor’s device asks the accredited, sophistication and benefit plan questions', /Is Dana Whitfield an accredited investor\?/.test(st) && /investment experience/i.test(st) && /purchaser representative/i.test(st) && F.R.plan === '4975', { plan: F.R.plan, st: st.slice(0, 1500) });
      check('the subscribe step states the account is not accredited', /is not an accredited investor/.test(F.R.sub || ''), (F.R.sub || '').slice(0, 1200));
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      const so = q.sophistication || {};
      check('qual: regime 506b, accredited false', q.regime === '506b' && q.accredited === false, q);
      check('qual: the sophistication answers and the purchaser representative arrive as typed', so.experience === answers.exp && so.education === answers.edu && !!so.rep && so.rep.name === answers.repName && so.rep.firm === answers.repFirm, so);
      check('qual.erisa arrives intact: plan 4975, share 1', !!q.erisa && q.erisa.plan === '4975' && q.erisa.share === 1, q.erisa);
      check('the investor’s change-log entry for the answer reached the console', await F.A.page.evaluate((id) => (window.CVPortal.state.ws.audit || []).some((e) => e.record === id && e.action === 'Investor status answered' && /not an accredited investor/.test(e.detail) && /from the investor.s device/.test(e.detail)), F.inv.investorId));
      // The console's offering page counts the imported answers exactly as in local mode.
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const ct = await L.screenText(cp);
      await cp.screenshot({ path: path.join(SHOTS, 'b506-console-offering.png'), fullPage: true });
      check('the console offering page shows "Non-accredited purchasers: 1 of 35"', /Non-accredited purchasers: 1 of 35/.test(ct), ct.slice(0, 2500));
      check('the console offering page shows "0 accepted and 1 more pending"', /\b0 accepted and 1 more pending\b/.test(ct), ct.slice(0, 2500));
      // The benefit plan figure: the request's if-accepted share, worked out here from the holders' commitments.
      const T = await cp.evaluate((oid) => {
        let cents = 0;
        window.CVPortal.state.ws.investors.forEach((i) => (i.positions || []).filter((x) => x.offeringId === oid && !x.redeemed).forEach((x) => (cents += Math.round((x.commitment != null ? x.commitment : x.amount) * 100))));
        return cents;
      }, F.off.offeringId);
      const X = F.req ? F.req.cents : 0;
      const want = Math.round(((1 * X) / (T + X)) * 1000) / 10;
      const bp = await panelText(cp, 'Benefit plan investors');
      const cls = await cp.evaluate(() => (document.querySelector('.cs-bpi-line') || {}).innerText || '');
      const ifLine = F.req ? await cp.evaluate((rid) => (document.querySelector(`.cs-bpi-if[data-request="${CSS.escape(rid)}"]`) || {}).innerText || '', F.req.id) : '';
      check('before acceptance the class line reads 0% (no holder answered)', /^All interests: 0% of value held by benefit plan investors/.test(cls), { cls, bp: bp.slice(0, 1200) });
      check(`the benefit plan panel counts the new request: if accepted, ${want}% of All interests (share 1 of $${X / 100})`, X === 6000000 && Number((ifLine.match(/is accepted: ([\d.]+)% of All interests/) || [])[1]) === want, { ifLine, want, T, X });
      const leakSt = L.leakCheck(st);
      const leakC = L.leakCheck(ct);
      check('white label: the investor’s status screen passes the leak check', leakSt.ok, leakSt.hits);
      check('white label: the console offering page passes the leak check', leakC.ok, leakC.hits);
    } finally {
      await F.close();
    }
  },

  /**
   * C-01 / T-06-06 / T-06-13 in server mode: a Regulation A Tier 2 person who is not accredited gives figures (income
   * $85,000, net worth $120,000: limit $12,000), commits $60,000, sees the warning and completes on their own device.
   * Before the console imports, the check alters the stored submission: overLimit false and a limit of $1,000,000. The
   * console recomputes from the stored figures and its own requests and still flags the investor: $60,000 against $12,000.
   */
  async regA({ check, S }) {
    const F = await serverFlow(S, check, {
      tag: 'regA',
      exemption: 'Regulation A Tier 2',
      answers: { acc: 'no', amount: 60000 },
      onStatus: async (p, R) => {
        R.kind = await p.evaluate(() => (document.querySelector('input[name="ob-stRaKind"]:checked') || {}).value || '');
        await p.fill('#ob-stIncome', '85000');
        await p.fill('#ob-stWorth', '120000');
        await p.waitForTimeout(200);
        R.limit = await p.locator('#ra-limit').innerText().catch(() => '');
      },
      onSubscribe: async (p, R) => {
        R.raSub = await p.locator('#ra-sub').innerText().catch(() => '');
        R.warn = await p.locator('#ra-sub .wire-warn').innerText().catch(() => '');
      },
      beforeImport: async (srv, inv, stored) => {
        const sub = srv.alter(inv.serverId, (s) => {
          s.request.qual.regA.overLimit = false;
          s.request.qual.regA.limitCents = 100000000;
        });
        // Read back through the console's own pickup, so the console is given exactly the altered copy.
        const now = await srv.submission(inv.serverId);
        return isDeepStrictEqual(now.request.qual, sub.request.qual) ? now : { altered: false, now };
      }
    });
    try {
      check('the offering is "Regulation A Tier 2", chosen with the console’s select', F.exemption === 'Regulation A Tier 2', F.exemption);
      check('the investor’s device shows the limit from the figures: "Your investment limit in this offering: $12,000"', F.R.kind === 'person' && F.R.limit === 'Your investment limit in this offering: $12,000', F.R);
      check('the subscribe step shows the limit and warns about $60,000 over it, without blocking', /Your investment limit in this offering under Regulation A: \$12,000/.test(F.R.raSub || '') && !!F.R.warn && F.walk.errors.length === 0, { raSub: F.R.raSub, warn: F.R.warn });
      const dq = F.deviceQual && F.deviceQual.regA;
      check('the device’s own qual said over the limit ($12,000, $60,000)', !!dq && dq.overLimit === true && dq.limitCents === 1200000 && dq.commitmentCents === 6000000, F.deviceQual);
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      check('the console holds the altered device values (overLimit false, limit $1,000,000) on the imported request', q.regime === 'regA2' && q.accredited === false && !!q.regA && q.regA.overLimit === false && q.regA.limitCents === 100000000, q);
      // The console recomputes: the request row and the eligibility panel flag the investor with the right total and limit.
      const cp = F.A.page;
      await L.consoleRoute(cp, 'console-requests', '[data-action=req-tab][data-t=all]');
      await cp.click('[data-action=req-tab][data-t=all]');
      await cp.waitForTimeout(300);
      const row = F.req ? await requestRow(cp, F.req.id) : '';
      await cp.screenshot({ path: path.join(SHOTS, 'regA-requests.png'), fullPage: true });
      check('the request row reads "Over the Regulation A Tier 2 limit: $60,000 committed in this offering, limit $12,000"', /Over the Regulation A Tier 2 limit: \$60,000 committed in this offering, limit \$12,000/.test(row), row);
      check('the flagged request keeps Approve and Decline (nothing blocked)', F.req && (await cp.locator(`[data-action=req-approve][data-id="${F.req.id}"]`).count()) === 1 && (await cp.locator(`[data-action=req-decline][data-id="${F.req.id}"]`).count()) === 1);
      const rowText = await L.screenText(cp);
      await L.consoleRoute(cp, 'console-offering-' + F.off.offeringId);
      const el = await panelText(cp, 'Investor eligibility');
      const ct = await L.screenText(cp);
      await cp.screenshot({ path: path.join(SHOTS, 'regA-console-offering.png'), fullPage: true });
      check('the eligibility panel: 1 non-accredited subscriber, 1 over their 10 percent limit', /Regulation A Tier 2: 1 non-accredited subscribers?, 1 over their 10 percent limit/.test(el), el);
      check('the eligibility panel lists Dana Whitfield: $60,000 committed in this offering, limit $12,000', /Dana Whitfield: \$60,000 committed in this offering, limit \$12,000/.test(el) && !/\$1,000,000/.test(el), el);
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
          ctrl: (document.querySelector('input[name="ob-stCtrl"]:checked') || {}).value || ''
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
      check('the snapshot’s on-file summary carries the ground and the benefit plan answers, cleaned to known fields', ex.accBasis === who.basis && isDeepStrictEqual(ex.erisa, { plan: 'title1', planPct: null, controlling: true }), ex);
      check('the on-file summary carries no personal details (no address, phone, taxpayer ID, bank or positions)', isDeepStrictEqual(Object.keys(ex).sort(), ['accBasis', 'accredited', 'accreditedUntil', 'erisa', 'holds']), Object.keys(ex));
      check('the status step on the investor’s device is prefilled: accredited yes, the ground on file, plan title1, control yes', !!F.R.pre && F.R.pre.acc === 'yes' && F.R.pre.basis === who.basis && F.R.pre.plan === 'title1' && F.R.pre.ctrl === 'yes', { pre: F.R.pre, basis: who.basis });
      check('the investor changed the plan to none', F.R.plan === 'none', F.R.plan);
      const heads = F.walk.seen.map((x) => x.split(' | ').pop());
      check('steps: welcome, status, subscribe, agreement', /^Welcome/.test(heads[0]) && heads.slice(1).join(',') === 'Investor status,Subscription,Subscription agreement', F.walk.seen);
      commonChecks(check, F);
      const q = (F.req && F.req.qual) || {};
      check('qual: regime 506b, accredited true, the ground on file, plan none', q.regime === '506b' && q.accredited === true && q.basis === who.basis && !!q.erisa && q.erisa.plan === 'none' && q.erisa.share === 0, q);
      const rec = await F.A.page.evaluate((id) => {
        const i = window.CVPortal.state.ws.investors.find((x) => x.id === id) || {};
        return { erisa: i.erisa || null, accreditation: i.accreditation || null };
      }, who.id);
      check('after import the console’s investor.erisa is the answer the link collected: plan none, controlling yes', !!rec.erisa && rec.erisa.plan === 'none' && rec.erisa.planPct === null && rec.erisa.controlling === true, rec.erisa);
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
   * D-30 / T-06-16 in server mode (plan 06-07): a non-accredited 506(b) investor attaches the written acknowledgment of their
   * purchaser representative on their own device. It travels with the completion (rep-<investor id>-<time>, named by the
   * request's qual), passes the server's allowlist as evidence, is stored by the console's import, and the request row's
   * download returns the same bytes under the uploaded name.
   */
  async repack({ check, S }) {
    const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% acknowledgment of purchaser representative, signed by Dana Whitfield\ntrailer << /Root 1 0 R >>\n%%EOF\n');
    const answers = { acc: 'no', exp: 'Four years of real estate syndications', edu: 'Nurse', rep: 'yes', repName: 'Morgan Ellery', repFirm: 'Ellery Advisory Partners', amount: 60000 };
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
      check('the request row shows "Purchaser representative: Morgan Ellery, Ellery Advisory Partners" and the download', /Purchaser representative: Morgan Ellery, Ellery Advisory Partners/.test(row) && /Download the written acknowledgment/.test(row), row);
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
      check('the request row gives the note instead of a download', /Purchaser representative: Morgan Ellery, Ellery Advisory Partners; The written acknowledgment/.test(row) && !/Download the written acknowledgment/.test(row), row);
      check('no script error on either side', G.A.errors.length === 0 && G.B.errors.length === 0, { A: G.A.errors, B: G.B.errors });
    } finally {
      await G.close();
    }
  }
};

L.runParts(parts, { name: 'SERVER MODE', browser: true });
