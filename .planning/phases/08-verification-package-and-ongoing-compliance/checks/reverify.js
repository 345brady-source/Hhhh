#!/usr/bin/env node
// GATE CHECK: REVERIFY
// Plan 08-09 (D-04, C-06, D-30): the sponsor asks an investor on file to verify their accreditation again. The investor
// gets one link that holds the accreditation step and the done screen only; the renewed verification lifts the Rule
// 506(c) block that a lapsed one put on their subscription (the block itself was already built). Stand-ins only: the
// sample self-serve portal, the firm's own simulated connection, the real integration server in this process.
//   local   1280x800, no server: an active investor whose verification by a third party lapsed yesterday, and a pending
//           Rule 506(c) subscription; the sponsor's Approve is refused with the existing "expired" sentence; the Investors
//           row offers "Ask to re-verify"; its dialog names the investor, with "Send request" and a close control;
//           sending prepares the sponsor's email with the link; the link's flow has exactly two steps (accreditation,
//           done), no login, profile, identity, tax or payment step, and the request's own line; the investor verifies
//           through the firm's own connection; the console then shows the new verification with its valid-until date, one
//           "Accreditation re-verification requested" and one "Accreditation re-verified" entry; Approve is allowed
//   NODE_PATH=$(npm root -g) node reverify.js [--only local]
// The last line is "REVERIFY: PASS (parts run: N)" or "REVERIFY: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const F = require('./frame.js');
const Lib = F.Lib;

const SHOTS = path.join(Lib.OUT, 'reverify-shots');
fs.mkdirSync(SHOTS, { recursive: true });
Lib.describeShots([
  ['local-button.png', 'Local mode, 1280x800: the Investors page with "Ask to re-verify" on the row of an investor whose verification lapsed.'],
  ['local-dialog.png', 'Local mode, 1280x800: the "Ask to re-verify" dialog with the investor\'s name and "Send request".'],
  ['local-email.png', 'Local mode, 1280x800: the request\'s email, prepared with the investor\'s link.'],
  ['local-link.png', 'Local mode, 1280x800: the request\'s link: step 1 of 2, the accreditation step, with the request\'s own line.'],
  ['local-done.png', 'Local mode, 1280x800: the request\'s done screen after the investor verified.']
]);

const DAY = 864e5;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const LAPSED = 'Your accreditation verification expired on';

/** The toasts on screen, newest last. */
const toasts = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#toasts .toast')).map((t) => t.textContent));
/** Waits for a toast holding re (a RegExp source) and resolves to its text ('' when none came). */
async function toastLike(p, re) {
  try {
    await p.waitForFunction((src) => Array.from(document.querySelectorAll('#toasts .toast')).some((t) => new RegExp(src).test(t.textContent)), re, { timeout: 10000 });
  } catch (e) {
    return '';
  }
  return (await toasts(p)).filter((t) => new RegExp(re).test(t)).pop() || '';
}

/**
 * The sample self-serve portal (a Rule 506(c) offering raising) with one active individual whose verification by a third
 * party (the firm's own simulated connection) lapsed yesterday, and their pending subscription to that offering. No
 * request is open for them. Resolves to { id, email, contact, title, reqId, firm, until }.
 */
async function lapsedInvestor(S, A, opts) {
  const off = await Lib.setupPortal(S, A, { exemption: 'Rule 506(c)' });
  return A.page.evaluate(
    ({ off, opts, DAY }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const c = NS.integrations.ensure(ws);
      c.use.accreditation = ['sandbox'];
      c.rules.accreditationFor = '506c';
      c.rules.validDays = 90;
      const a = ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.email);
      const t = Date.now();
      const day = (n) => new Date(t + n * DAY).toISOString().slice(0, 10);
      const at = (n) => new Date(t + n * DAY).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const until = opts.until === undefined ? day(-1) : opts.until;
      Object.assign(a, { contact: 'Marguerite Okonkwo-Laurent', title: 'Marguerite Okonkwo-Laurent', email: 'marguerite.okonkwo@example.com' });
      a.verify = {
        identity: { status: 'passed', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', completedAt: at(-120) },
        aml: { status: 'clear', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', completedAt: at(-120), screenedAt: day(-1) },
        accreditation: until === null ? { status: 'not_started' } : { status: 'verified', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', method: 'Net worth over $1 million, excluding primary residence', completedAt: at(-91), verifiedAt: day(-91), expiresAt: until },
        decision: { status: 'approved', at: at(-120), by: 'Automatic' }
      };
      a.accreditation = Object.assign({}, a.accreditation, { basis: 'Net worth over $1 million, excluding primary residence', date: day(-91), verifiedBy: 'Sandbox', expires: until || '' });
      ws.invitations = (ws.invitations || []).filter((x) => x.investorId !== a.id);
      const o = ws.offerings.find((x) => x.id === off.offeringId);
      const r = NS.ops.submitSubscription(ws, a, o, { cents: Math.round((Number(o.minimum) || 50000) * 100), signature: a.contact });
      // Signed on paper and recorded as such: no agreement waits for a signature, so only the verification decides Approve.
      if (r.envelopeId) ws.envelopes = (ws.envelopes || []).filter((e) => e.id !== r.envelopeId);
      delete r.envelopeId;
      r.signedAt = at(-1);
      NS.integrations.syncKyc(ws, a);
      NS.app.save(true);
      return { id: a.id, email: a.email, contact: a.contact, title: a.title, reqId: r.id, firm: ws.tenant.name, until, offeringId: o.id };
    },
    { off, opts: opts || {}, DAY }
  );
}

/** The entries of the change log with this action for this investor. */
const entries = (p, id, action) => p.evaluate(({ id, action }) => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === action && e.record === id).map((e) => e.detail), { id, action });

/** The sponsor presses Approve on the subscription on the Requests page; resolves to { toast, status, overridden }. */
async function approve(p, reqId) {
  await p.evaluate(() => (window.CVPortal.state.ui.reqOverride = null));
  await Lib.consoleRoute(p, 'console-requests', `[data-action=req-approve][data-id="${reqId}"]`);
  await p.evaluate(() => (document.getElementById('toasts').innerHTML = ''));
  await p.click(`[data-action=req-approve][data-id="${reqId}"]`);
  const toast = await toastLike(p, 'not fully verified|Subscription approved|not signed');
  return p.evaluate(
    ({ reqId, toast }) => {
      const ws = window.CVPortal.state.ws;
      const r = (ws.requests || []).find((x) => x.id === reqId) || {};
      const inv = ws.investors.find((y) => y.id === r.investorId);
      const o = ws.offerings.find((y) => y.id === r.offeringId);
      return { toast, status: r.status, overridden: (ws.audit || []).filter((e) => e.action === 'Subscription approved without full verification').length, gate: inv && o ? (window.CVPortal.integrations.subscribeGate(ws, inv, o) || {}).reason || '' : '(none)' };
    },
    { reqId, toast: toast || (await toasts(p)).join(' | ') }
  );
}

/** The investor's row on the Investors page. */
async function row(p, email) {
  await Lib.consoleRoute(p, 'console-investors', '.cs-tbl');
  return p.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: email }).first();
}

/** What the request's link shows: the count, the step keys, the controls and inputs on screen, the text. */
const flowState = (p, itId) =>
  p.evaluate((itId) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const it = (ws.invitations || []).find((x) => x.id === itId);
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const form = document.querySelector('.ivf-form');
    return {
      hash: location.hash.replace(/^#(invite-).*/, '#$1…'),
      count: (document.querySelector('.ivf-progress .ob-count') || {}).innerText || '',
      steps: it ? NS.inviteFlow.steps(ws, it) : null,
      list: Array.from(document.querySelectorAll('.ob-steps li, .ivf-steps li')).map((li) => li.innerText.replace(/\s+/g, ' ').trim()),
      inputs: form ? Array.from(form.querySelectorAll('input, select, textarea')).filter((el) => el.type !== 'hidden' && vis(el)).map((el) => el.id || el.name) : [],
      text: form ? form.innerText.replace(/\s+/g, ' ') : document.body.innerText.replace(/\s+/g, ' ')
    };
  }, itId);

const parts = {
  async local({ check, S }) {
    const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
    const p = A.page;
    const seen = [];
    try {
      const x = await lapsedInvestor(S, A);
      check('the investor\'s verification by a third party lapsed yesterday and their Rule 506(c) subscription is pending', x.until === iso(Date.now() - DAY) && !!x.reqId, x);

      // Before: the sponsor's Approve is refused with the existing sentence.
      const before = await approve(p, x.reqId);
      check(`before: Approve is refused with the existing "expired" sentence ("${LAPSED} ...")`, before.toast.indexOf(LAPSED) >= 0 && /Rule 506\(c\) offerings need a current verification/.test(before.toast) && before.status === 'pending', before);

      // The Investors row offers "Ask to re-verify"; its dialog.
      const r = await row(p, x.email);
      const btn = r.locator('[data-action="reverify-request"]');
      const label = (await btn.count()) ? (await btn.first().innerText()).trim() : '(no button)';
      check('the investor\'s row offers "Ask to re-verify"', label === 'Ask to re-verify', label);
      await p.screenshot({ path: path.join(SHOTS, 'local-button.png') });
      if (label !== 'Ask to re-verify') return;
      await btn.first().click();
      await p.waitForSelector('#dlg[open]', { timeout: 10000 });
      const dlg = await p.evaluate(() => {
        const d = document.getElementById('dlg');
        const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
        return { text: d.innerText, send: Array.from(d.querySelectorAll('button')).filter((b) => vis(b) && b.innerText.trim() === 'Send request').length, close: vis(d.querySelector('.dlg-head [data-action="close-dialog"]')) };
      });
      check('the dialog names the investor and holds one "Send request" button and a close control', dlg.text.indexOf(x.contact) >= 0 && dlg.send === 1 && dlg.close === true, dlg);
      await p.screenshot({ path: path.join(SHOTS, 'local-dialog.png') });
      seen.push(dlg.text);

      // Sending prepares the sponsor's email with the link (no server: the sponsor sends it from their own email app).
      await p.click('#dlg [data-action="reverify-send"]');
      await p.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 });
      const mail = await p.evaluate(() => ({ link: (document.getElementById('inv8-link') || {}).value || '', subject: (document.querySelector('#dlg .inv8-subject') || {}).innerText || '', text: document.getElementById('dlg').innerText }));
      check('sending prepares the sponsor\'s email with the investor\'s link', /#invite-[\w-]{20,}$/.test(mail.link) && mail.subject === `${x.firm}: verify your accredited investor status` && /verify your accredited investor status again/.test(mail.text), { link: mail.link.replace(/invite-.*/, 'invite-…'), subject: mail.subject });
      await p.screenshot({ path: path.join(SHOTS, 'local-email.png') });
      seen.push(mail.text);
      await p.click('#dlg .dlg-head [data-action="close-dialog"]');
      const asked = await entries(p, x.id, 'Accreditation re-verification requested');
      check('one change-log entry "Accreditation re-verification requested"', asked.length === 1, asked);
      const it = await p.evaluate((id) => (window.CVPortal.state.ws.invitations || []).filter((y) => y.investorId === id).map((y) => ({ id: y.id, reverify: !!y.reverify, existing: !!y.existing, offeringId: y.offeringId, token: !!y.token })), x.id);
      check('one invitation for the investor on file, marked reverify, with no offering', it.length === 1 && it[0].reverify && it[0].existing && !it[0].offeringId && it[0].token, it);
      if (!it.length || !mail.link) return;

      // The link: two steps, the request's own line.
      await p.evaluate((h) => (location.hash = h), mail.link.slice(mail.link.indexOf('#')));
      await p.waitForSelector('.ivf-form', { timeout: 20000 });
      await p.waitForTimeout(300);
      const s1 = await flowState(p, it[0].id);
      check('the link\'s flow has exactly two steps: accreditation, then done', JSON.stringify(s1.steps) === JSON.stringify(['accreditation', 'done']) && /^Step 1 of 2/.test(s1.count), { steps: s1.steps, count: s1.count });
      check('no login, profile, identity, tax or payment step and no field of theirs on screen', !/password|ob-tin|ob-street|ob-routing|ob-account/i.test(s1.inputs.join(' ')) && !/Create your login|Investor information|Identity verification|Tax certification|Distribution/i.test(s1.list.join(' ') + ' ' + s1.count), s1);
      const LINE = `${x.firm} asked you to verify your accredited investor status again; this link covers that step only.`;
      check(`the request's own line: "${LINE}"`, s1.text.indexOf(LINE) >= 0, s1.text.slice(0, 600));
      await p.screenshot({ path: path.join(SHOTS, 'local-link.png') });
      seen.push(s1.text);

      // The investor verifies through the firm's own connection (simulated), then finishes.
      await p.click('.ivf-form [data-action="iv-start"][data-kind="accreditation"]');
      await p.waitForSelector('#dlg[open] [data-action="iv-sandbox-finish"]', { timeout: 10000 });
      seen.push(await p.locator('#dlg').innerText());
      await p.click('#dlg [data-action="iv-sandbox-finish"]');
      await p.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 });
      if (await p.locator('#ob-accAttest').count()) await p.check('#ob-accAttest');
      await p.click('.ivf-form button[type=submit]');
      await p.waitForSelector('.ivf-done', { timeout: 20000 });
      const done = await p.locator('.ivf-done').innerText();
      check('the done screen says the firm will see the result', new RegExp(`${x.firm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} will see the result`).test(done), done);
      await p.screenshot({ path: path.join(SHOTS, 'local-done.png') });
      seen.push(done);

      // The simulated check answers a moment after it starts (a real provider may take days): the console reads the result
      // once it is in, on the Investors page.
      await p.waitForFunction((id) => { const NS = window.CVPortal; return NS.integrations.peek(NS.state.ws.investors.find((y) => y.id === id)).accreditation.status === 'verified'; }, x.id, { timeout: 15000 });
      await row(p, x.email);

      // The console: the new verification with its valid-until date; the two entries.
      const want = iso(Date.now() + 90 * DAY);
      await Lib.consoleRoute(p, 'console-kyc', '[data-action=kyc-tab]');
      await p.click('[data-action=kyc-tab][data-t=all]');
      await p.evaluate((id) => {
        window.CVPortal.state.ui.kycOpen = id;
        window.CVPortal.app.render();
      }, x.id);
      await p.waitForTimeout(300);
      const kyc = await p.evaluate(({ id, want }) => {
        const NS = window.CVPortal;
        const inv = NS.state.ws.investors.find((y) => y.id === id);
        const a = NS.integrations.peek(inv).accreditation;
        return { text: document.body.innerText, expiresAt: a.expiresAt, status: a.status, shown: NS.ui.date(want) };
      }, { id: x.id, want });
      const line = kyc.text.split('\n').find((l) => /^Accreditation: verified/.test(l.trim())) || '';
      if (!line) console.log('NOTE kyc text: ' + kyc.text.replace(/\s+/g, ' ').slice(0, 1500));
      check(`the console shows the accreditation verified, valid until ${want} (the firm's 90 days)`, kyc.status === 'verified' && kyc.expiresAt === want && line.indexOf(`valid until ${kyc.shown}`) >= 0, { line, expiresAt: kyc.expiresAt });
      seen.push(line);
      const asked2 = await entries(p, x.id, 'Accreditation re-verification requested');
      const done2 = await entries(p, x.id, 'Accreditation re-verified');
      const why = await p.evaluate(({ id, itId }) => {
        const ws = window.CVPortal.state.ws;
        const it = (ws.invitations || []).find((y) => y.id === itId) || {};
        return { actions: (ws.audit || []).filter((e) => e.record === id).map((e) => e.action), it: { status: it.status, sentAt: it.sentAt, completedAt: it.completedAt }, acc: window.CVPortal.integrations.peek(ws.investors.find((y) => y.id === id)).accreditation };
      }, { id: x.id, itId: it[0].id });
      check('one "Accreditation re-verification requested" and one "Accreditation re-verified" in the change log', asked2.length === 1 && done2.length === 1, { asked2, done2, why });

      // After: Approve is allowed (no override, no second click).
      const after = await approve(p, x.reqId);
      check('after: Approve is allowed, without the override', /^Subscription approved/.test(after.toast) && after.status !== 'pending' && after.overridden === 0, after);
      seen.push(await F.noRawError(check, p, 'the console after the re-verification', A.errors));
      F.leakFree(check, 'every screen of this part', seen.join('\n'));
    } finally {
      await A.context.close().catch(() => {});
    }
  }
};

Lib.runParts(parts, { name: 'REVERIFY', unit: 'parts', flag: '--only', browser: true });
