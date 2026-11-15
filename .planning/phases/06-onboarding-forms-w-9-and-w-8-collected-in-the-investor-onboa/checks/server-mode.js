#!/usr/bin/env node
// Server mode for the investor status answers (phase 6, plan 06-06; D-01, C-01, D-30, white label, C-05).
// Real invitations go through the firm's integration server. Each part runs the real server code (server/index.mjs)
// in this process and two separate browser contexts that share nothing except through that server: the sponsor's
// console (one context) sends the invitation with its own form; the investor's device (a second context, empty storage,
// the portal page listing the server as the firm publishes it) opens the ?server= link, answers the status step,
// subscribes and signs; the console imports with its own "Check now" and counts the answers exactly as in local mode.
//   NODE_PATH=$(npm root -g) node server-mode.js [--only b506,regA]
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
    const A = await L.open(S, { allow: [srv.base], init: srv.init });
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
    out.serverOn = await srv.configure(cp);
    const inv = await L.inviteFromConsole(cp, Object.assign({ first: INV.first, last: INV.last, email: INV.email, offeringId: off.offeringId }, o.invite || {}));
    out.inv = inv;
    check('the console sends the invitation to the integration server with its own form (the server holds it)', out.serverOn === true && /^ivt_/.test(inv.serverId) && inv.token === '' && inv.link.indexOf(`server=${encodeURIComponent(srv.base)}`) > 0 && inv.link.indexOf(S.base) === 0, inv);
    const held = (await srv.rows()).find((x) => x.id === inv.serverId);
    check(`the server holds the invitation for the ${o.exemption} offering`, !!held && held.offeringId === off.offeringId && held.investorId === inv.investorId, held);

    // The investor's device: a second context with nothing in its storage, the portal page as the firm publishes it.
    const B = await L.open(S, { allow: [srv.base], init: srv.init });
    closers.push(() => B.context.close());
    out.B = B;
    const ip = B.page;
    await ip.goto(inv.link);
    // Workspace keys in this browser's storage (the edition's prefix, then ws:<id>).
    out.storageBefore = await ip.evaluate(() => Object.keys(localStorage).filter((k) => /ws:/.test(k)));
    const answers = Object.assign({}, o.answers, {
      name: INV.name,
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

const parts = {
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
  }
};

L.runParts(parts, { name: 'SERVER MODE', browser: true });
