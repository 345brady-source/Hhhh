// gate: browser
// last "SAME SCREENS: PASS (parts run: 11)"
// Plan 18-01 (UI-10, D-02): every screen and dialog of 18-UI-SPEC §11 recorded on the base tree and on this tree, under the
// same frozen clock and seeded random numbers, and compared (screens18.compare): the words, the actions (links, buttons,
// fields and what they hold), the headings and the charts must be the same, apart from the C1..C7 changes, the D-05 merge
// (M) and the §7.11 chart rule (CH), each an exact transform in screens18.js. The base is P18_BASE (the gate's base tree),
// else `git archive P18_BASE_COMMIT`; with neither the check FAILs.
//   selftest          stand-in trees with one fault each must FAIL naming the screen; stand-ins applying a rule correctly
//                     must PASS (built from P18_SELFTEST_COMMIT, default this plan's start commit, so they stay true while
//                     later plans change this tree); each stand-in runs only the screens its change touches
//   console-desktop   diy.html, Kestrel Bay as admin: every console menu page in menu order (read from the page), one
//                     offering, the first envelope when the sample has one, the intake upload step; then role team:
//                     Overview and Offerings (1280x800)
//   console-phone     the same on the iPhone 13 profile
//   managed-desktop   index.html as Carrow & Vale staff: every menu page; then the sponsor staff role: Overview, Offerings
//   managed-phone     the same on the phone
//   investor-desktop  diy.html and index.html as the sample investor: every tab, one investment, portfolio, preferences,
//                     subscribe-<id> for an open offering, sign-in
//   investor-phone    the same on the phone, with the menu opened
//   flows-desktop     diy-start; join-<id> (open and closed); the field editor on the sample agreement; the report builder
//                     with a starter template; a new invitation walked step by step (each step recorded before it is
//                     filled, filled the same way on both trees), the W-9 signing view, the agreement signing view and
//                     the done page; the activation page; the bank update page; the e-sign sender list and the envelope
//   flows-phone       the same on the phone
//   dialogs-desktop   every DIALOGS row (screens18.js) on every edition it names: set up, opened, recorded, closed by its
//                     X; the table is compared with `grep -o "U.dialog(" assets/js/*.js` at run time
//   dialogs-phone     the same on the phone
// Every part also checks, on each screen of this tree, no vendor, model or library name and no forbidden word that the
// base tree's screen does not have, and no request outside the page's origin.
//   P18_BASE=<dir> | P18_BASE_COMMIT=<commit> NODE_PATH=$(npm root -g) node same-screens.js [--only selftest,...]
// The last line is "SAME SCREENS: PASS (parts run: N)" or "SAME SCREENS: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const os = require('os');
const path = require('path');
const X = require('./lib18.js');
const S18 = X.S18;
const L = X.L;
const T = X.T;

const DAY = '2026-11-27';
const SELFTEST_COMMIT = process.env.P18_SELFTEST_COMMIT || 'd36521bc4a0a9bf259dc67324c8802985d78bd5c';
const made = [];
process.on('exit', () => made.forEach((t) => X.removeTree(t)));
let p4 = null;
/** Phase 4's helpers (the agreement PDF and its fields), as P6 lib.js loads them. */
function P4() {
  if (!p4) {
    if (!process.env.SIGN_OUT) process.env.SIGN_OUT = path.join(L.OUT, 'p4');
    p4 = require(path.join(X.ROOT, '.planning/phases/04-signing-inside-onboarding/checks/lib.js'));
  }
  return p4;
}

/* ---------- trees ---------- */
let baseP = null;
/** The base tree and a server on it, once per process. */
function base() {
  if (!baseP)
    baseP = (async () => {
      const t = X.baseRoot();
      made.push(t);
      const srv = await X.serveDir(t.dir);
      return { name: 'base tree', dir: t.dir, origin: srv.origin, srv };
    })();
  return baseP;
}
const here = (S) => ({ name: 'this tree', dir: X.ROOT, origin: S.origin });

/* ---------- steps of a walk ---------- */
const route = async (W, h, wait) => {
  await W.fr.evaluate((h) => (location.hash = h), h);
  await W.fr.waitForTimeout(wait || 500);
};
async function press(W, sel, o) {
  const l = typeof sel === 'string' ? W.fr.locator(sel).first() : sel;
  try {
    if (!(await l.count())) return false;
    await l.scrollIntoViewIfNeeded({ timeout: 5000 });
    if (W.size === 'phone') await l.tap({ timeout: (o && o.timeout) || 8000 });
    else await l.click({ timeout: (o && o.timeout) || 8000 });
    await W.fr.waitForTimeout((o && o.wait) || 400);
    return true;
  } catch (e) {
    return false;
  }
}
/** Record the screen as it stands under `key` (a failure to read it is kept as the screen's error). */
async function rec(W, key, o) {
  if (W.records[key]) {
    let n = 2;
    while (W.records[`${key} (${n})`]) n++;
    key = `${key} (${n})`;
  }
  try {
    // a page still drawing (reports' preview, a reading in progress) is read once it has settled
    await W.fr.waitForFunction(() => !document.querySelector('#view .rb-wait, #view [aria-busy="true"]'), null, { timeout: 15000 }).catch(() => {});
    const r = await X.record(W.fr, Object.assign({ key, size: W.size }, o || {}));
    W.records[key] = r;
  } catch (e) {
    W.errors[key] = String(e && e.message ? e.message : e).split('\n')[0].slice(0, 200);
  }
}
const miss = (W, key, why) => (W.errors[key] = why);
const ev = (W, fn, arg) => W.fr.evaluate(fn, arg === undefined ? null : arg);
/** The pages of the console's own menu, in its order (phone-layout.js menu()). */
const menu = (W) => ev(W, () => Array.from(document.querySelectorAll('.cs-nav nav a[href^="#console"]')).map((a) => a.getAttribute('href').slice(1)).filter((h, i, a) => a.indexOf(h) === i));

/** Open `page` on `tree` at `size` with the frozen clock, run walk(W), and resolve to { records, errors, outside }. */
async function onTree(S, tree, size, page, walk) {
  const { A, fr } = await X.framedAt(S, size, { root: tree.dir, origin: tree.origin, page, freeze: DAY });
  const W = { S, A, fr, size, page, tree, records: {}, errors: {}, ctx: {} };
  try {
    await walk(W);
  } catch (e) {
    W.errors['(walk)'] = String(e && e.message ? e.message : e).split('\n')[0].slice(0, 300);
  } finally {
    W.outside = A.p10.outside.concat(A.net.external);
    W.pageErrors = A.errors.slice();
    await A.context.close().catch(() => {});
  }
  return W;
}

/**
 * The same walk on the base tree and on this tree, every screen compared. walks: [{ page, walk }] (each its own fresh page).
 * Prints one PASS or FAIL line per screen; this tree's screens are also checked for new vendor names and outside requests.
 */
async function sameWalk(check, S, part, size, walks, o) {
  o = o || {};
  const B = o.base || (await base());
  const P = o.plan || here(S);
  const got = { base: { records: {}, errors: {}, outside: [], pageErrors: [] }, plan: { records: {}, errors: {}, outside: [], pageErrors: [] } };
  for (const w of walks) {
    for (const [side, tree] of [['base', B], ['plan', P]]) {
      const W = await onTree(S, tree, size, w.page || 'diy.html', w.walk);
      Object.assign(got[side].records, W.records);
      Object.assign(got[side].errors, W.errors);
      got[side].outside.push(...W.outside);
      got[side].pageErrors.push(...W.pageErrors);
    }
  }
  return judge(o.quiet ? null : check, part, got, o);
}
const vendorNotes = {};
/** Compare the records of the two sides; resolves to the list of { key, res, line }. */
function judge(check, part, got, o) {
  o = o || {};
  const keys = Object.keys(got.base.records).concat(Object.keys(got.plan.records).filter((k) => !got.base.records[k]));
  const errKeys = Object.keys(got.base.errors).concat(Object.keys(got.plan.errors)).filter((k, i, a) => a.indexOf(k) === i);
  const out = [];
  const say = (ok, text) => check && check(text, ok);
  for (const k of errKeys) {
    const t = X.mask(`${k}: not recorded (base tree: ${got.base.errors[k] || 'recorded'}; this tree: ${got.plan.errors[k] || 'recorded'})`);
    out.push({ key: k, res: { ok: false }, line: `FAIL ${part} ${t}` });
    say(false, t);
  }
  for (const k of keys) {
    if (errKeys.indexOf(k) >= 0) continue;
    const b = got.base.records[k];
    const p = got.plan.records[k];
    if (!b || !p) {
      const t = `${k}: recorded on ${b ? 'the base tree' : 'this tree'} only`;
      out.push({ key: k, res: { ok: false }, line: `FAIL ${part} ${t}` });
      say(false, t);
      continue;
    }
    const res = S18.compare(b, p, { ctx: { baseByKey: got.base.records }, rules: o.rules });
    const line = S18.line(part, k, res);
    out.push({ key: k, res, line });
    say(res.ok, line.replace(/^(PASS|FAIL) \S+ /, ''));
    if (!o.noVendorCheck && check) {
      const nb = X.noVendor(b.frame.lines.concat(b.content.lines).join('\n')).hits;
      const np = X.noVendor(p.frame.lines.concat(p.content.lines).join('\n')).hits;
      const fresh = np.filter((x) => nb.indexOf(x) < 0);
      if (fresh.length) say(false, X.mask(`${k}: a vendor, model or library name or the forbidden word this tree adds: ${JSON.stringify(fresh.slice(0, 4))}`));
      else if (np.length) vendorNotes[np.join('|')] = X.mask(`NOTE ${part} vendor or product words the base tree shows too, on ${k} and others (white label is SCREEN EDGES' check; nothing new here): ${JSON.stringify(np.slice(0, 3))}`);
    }
  }
  if (check && !o.noVendorCheck) {
    Object.values(vendorNotes).forEach((n) => console.log(n));
    Object.keys(vendorNotes).forEach((k) => delete vendorNotes[k]);
    check(`no request left the page's origin on this tree (${keys.length} screens)`, got.plan.outside.length === 0, got.plan.outside.slice(0, 6));
    const fresh = got.plan.pageErrors.filter((e) => got.base.pageErrors.indexOf(e) < 0);
    check('no script error on this tree that the base tree does not have', fresh.length === 0, fresh.slice(0, 4));
    check(`screens recorded on both trees: ${keys.length}`, keys.length > 0 && (o.min === undefined || keys.length >= o.min), { min: o.min, keys: keys.length });
  }
  return out;
}

/* ---------- state helpers (the phase 6 and phase 10 helpers' steps; nothing sent, deleted or saved by a click) ---------- */
/** setupPortal's state (P6 lib.js) without its reload: a raising offering whose subscription agreement is stored with phase 4's fields. */
async function agreementState(W, exemption) {
  const offName = await ev(W, () => {
    const ws = window.CVPortal.state.ws;
    return (ws.offerings.find((x) => x.status === 'Raising') || ws.offerings[0]).name;
  });
  const b64 = await P4().agreementPdf(W.A.context, offName);
  const r = await W.fr.evaluate(
    async ({ b64, fields, exemption }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      let o = ws.offerings.find((x) => x.status === 'Raising');
      if (!o) {
        o = ws.offerings[0];
        o.status = 'Raising';
      }
      o.structure = Object.assign({}, o.structure, { exemption });
      o.minimum = 50000;
      NS.integrations.ensure(ws).configured = true;
      const docId = 'doc-ppm-test';
      await NS.ops.files.put(docId, new Blob(['%PDF-1.4 test memorandum'], { type: 'application/pdf' }));
      ws.docs = ws.docs || [];
      if (!ws.docs.some((d) => d.id === docId)) ws.docs.push({ id: docId, title: 'Private placement memorandum', fileName: 'PPM.pdf', type: 'application/pdf', size: 24, sha256: '', cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: NS.dates.today(), taxYear: '', publishedAt: new Date().toISOString(), publishedBy: 'test', offeringDoc: true, hidden: false });
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      await NS.ops.files.put('tpl-doc-test', new Blob([u8], { type: 'application/pdf' }));
      ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== o.id);
      const size = { w: 612, h: 792 };
      ws.esignTemplates.push({ id: 'tpl-sub-test', title: 'Subscription Agreement', fileName: 'Subscription_Agreement.pdf', docId: 'tpl-doc-test', pages: 3, pageSizes: [size, size, size], sha256: NS.audit.sha256(u8), roles: ['Investor', 'Sponsor'], message: 'Please sign your subscription agreement.', subscription: true, offeringId: o.id, createdAt: new Date().toISOString(), fields });
      NS.app.save(true);
      NS.app.render();
      return { offeringId: o.id, offeringName: o.name };
    },
    { b64, fields: P4().TEMPLATE_FIELDS, exemption: exemption || 'Rule 506(b)' }
  );
  await W.fr.waitForTimeout(300);
  return r;
}
/** The ids the walks and dialogs use, read from the sample. */
const sampleIds = (W) =>
  ev(W, () => {
    const w = window.CVPortal.state.ws;
    const done = w.investors.filter((i) => i.onboarding && i.onboarding.status === 'complete' && i.type === 'individual' && i.email && !i.coInvestor);
    const invited = w.investors.find((i) => i.onboarding && i.onboarding.status === 'invited' && !(w.invitations || []).some((x) => x.investorId === i.id));
    const notDone = w.investors.find((i) => i.onboarding && i.onboarding.status !== 'complete');
    const raising = w.offerings.find((o) => o.status === 'Raising');
    const plain = w.offerings.find((o) => o.status !== 'Raising' && !(w.esignTemplates || []).some((t) => t.offeringId === o.id));
    return { inv: done[0] ? done[0].id : '', invited: invited ? invited.id : '', notDone: notDone ? notDone.id : '', raising: raising ? raising.id : '', plain: plain ? plain.id : '', firstOffering: w.offerings[0].id };
  });
/** An invited investor walked to the tax step, the step submitted: the W-9 signing view on screen. */
async function toW9(W, who, onStep) {
  await route(W, 'invite-' + who.token, 700);
  const w = await L.walk(W.fr, { name: who.name, acc: 'yes', basis: 0, until: /Tax certification/, onStep });
  if (!w.reached) throw new Error(`the invitation did not reach the tax step: ${w.seen.join(' > ')}`);
  if (onStep) await onStep('Tax certification');
  await L.submit(W.fr);
  await W.fr.waitForSelector('.ivf-tax-sign', { timeout: 60000 });
  await W.fr.waitForTimeout(600);
}
/** The W-9's consent screen continued: the form's page on screen. Resolves to its signature field's id ('' when none). */
async function w9Consent(W, investorId) {
  if (await W.fr.locator('#es-consent-box').count()) {
    await W.fr.check('#es-consent-box');
    await press(W, '[data-action="es-consent"]');
  }
  await W.fr.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  await W.fr.waitForTimeout(500);
  return ev(
    W,
    (id) => {
      const ws = window.CVPortal.state.ws;
      const i = ws.investors.find((x) => x.id === id);
      const env = (ws.envelopes || []).find((e) => e.id === ((i.onboarding || {}).flow || {}).taxEnvelopeId);
      const f = env && env.fields.find((x) => x.type === 'signature');
      return f ? f.id : '';
    },
    investorId
  );
}
/** From the W-9's page: finished as it stands (nothing on it is required, D-30), then on to the agreement, finished. */
async function finishOnboarding(W, who, onStep) {
  await L.finishTaxForm(W.fr);
  const w = await L.walk(W.fr, { name: who.name, acc: 'yes', basis: 0, onStep });
  if (!w.reached) throw new Error(`the invitation did not reach the agreement: ${w.seen.join(' > ')}`);
  await W.fr.waitForTimeout(500);
}
const newInvitation = (W, o) => L.createInvitation(W.fr, o);

/* ---------- the walks ---------- */
/** Every console menu page as `role`, the menu read from the page. */
async function consolePages(W, role) {
  const pages = await menu(W);
  if (!pages.length) miss(W, `${role} console menu`, 'the console menu lists no page');
  for (const h of pages) {
    await route(W, h);
    await rec(W, `${role} ${h}`);
  }
  return pages;
}
const CONSOLE = {
  page: 'diy.html',
  walk: async (W) => {
    await T.sample(W.fr, { role: 'admin' });
    const pages = await consolePages(W, 'admin');
    const ids = await sampleIds(W);
    await route(W, `console-offering-${ids.firstOffering}`);
    await rec(W, 'admin one offering');
    const env = await ev(W, () => ((window.CVPortal.state.ws.envelopes || [])[0] || {}).id || '');
    if (env) {
      await route(W, `console-envelope-${env}`);
      await rec(W, 'admin the first envelope');
    }
    if (pages.indexOf('console-intake') < 0) {
      await route(W, 'console-intake');
      await rec(W, 'admin console-intake');
    }
    await T.sample(W.fr, { role: 'team' });
    await route(W, 'console');
    await rec(W, 'team console');
    await route(W, 'console-offerings');
    await rec(W, 'team console-offerings');
  }
};
const MANAGED = {
  page: 'index.html',
  walk: async (W) => {
    await T.sample(W.fr, { role: 'staff' });
    await consolePages(W, 'staff');
    await T.sample(W.fr, { role: 'sponsor' });
    await route(W, 'console');
    await rec(W, 'sponsor console');
    await route(W, 'console-offerings');
    await rec(W, 'sponsor console-offerings');
  }
};
function investorWalk(page) {
  const ed = page === 'index.html' ? 'managed' : 'diy';
  return {
    page,
    walk: async (W) => {
      await T.sample(W.fr, { role: 'investor' });
      await route(W, 'overview');
      const tabs = await ev(W, () => Array.from(document.querySelectorAll('.pt-nav a[href^="#"]')).map((a) => a.getAttribute('href').slice(1)).filter((h, i, a) => h && !/^(sign-in|sign-out)$/.test(h) && a.indexOf(h) === i));
      if (tabs.length < 5) miss(W, `${ed} investor tabs`, `the investor menu lists ${tabs.length} tabs: ${tabs.join(', ')}`);
      for (const h of tabs) {
        await route(W, h);
        await rec(W, `${ed} investor ${h}`);
      }
      await route(W, 'investments');
      const one = await ev(W, () => (document.querySelector('#main a[href^="#investment-"]') || { getAttribute: () => '' }).getAttribute('href').slice(1));
      if (one) {
        await route(W, one);
        await rec(W, `${ed} investor one investment`);
      } else miss(W, `${ed} investor one investment`, 'no investment link on Investments');
      for (const h of ['portfolio', 'preferences']) {
        if (tabs.indexOf(h) >= 0) continue;
        const has = await ev(W, (h) => !!window.CVPortal.views[h], h);
        if (!has) continue;
        await route(W, h);
        await rec(W, `${ed} investor ${h}`);
      }
      if (W.size === 'phone') {
        await route(W, 'overview');
        if (await press(W, '[data-action="nav-toggle"]')) await rec(W, `${ed} investor menu open`);
        else miss(W, `${ed} investor menu open`, 'the Menu button could not be pressed');
        await press(W, '[data-action="nav-toggle"]');
      }
      // an offering open for subscription (the sample has none: the first offering is set to raising, on both trees)
      const oid = await T.ws(W.fr, (w) => {
        const o = w.offerings.find((x) => x.status === 'Raising') || w.offerings[0];
        o.status = 'Raising';
        return o.id;
      });
      await route(W, `subscribe-${oid}`);
      await rec(W, `${ed} investor subscribe`);
      await route(W, 'sign-in');
      await rec(W, `${ed} sign-in`);
    }
  };
}
function flowsWalk() {
  return {
    page: 'diy.html',
    walk: async (W) => {
      // the sponsor sign-up page, as a new visitor sees it
      await W.fr.waitForSelector('#sd-firm', { timeout: 20000 }).catch(() => {});
      await rec(W, 'diy-start');
      await T.sample(W.fr, { role: 'admin' });
      const ag = await agreementState(W, 'Rule 506(b)');
      const ids = await sampleIds(W);
      await route(W, `join-${ag.offeringId}`);
      await rec(W, 'join, an open offering');
      if (ids.plain) {
        await route(W, `join-${ids.plain}`);
        await rec(W, 'join, an offering not raising');
      }
      // the field editor on the sample agreement
      await T.sample(W.fr, { role: 'admin' });
      await route(W, `console-offering-${ag.offeringId}`);
      if (await press(W, '[data-action="es-agreement-edit"]')) {
        const opened = await W.fr.waitForSelector('.fe .es-fld', { timeout: 60000 }).then(() => true, () => false);
        await W.fr.waitForTimeout(900);
        if (opened) await rec(W, 'field editor');
        else miss(W, 'field editor', 'the editor showed no field');
      } else miss(W, 'field editor', 'no Edit fields button');
      // the report builder with a starter template open (Create keeps the new report: the one state step it needs)
      await route(W, 'console-reports');
      await W.fr.waitForSelector('[data-action=rep-tab][data-t=investor]', { timeout: 20000 }).catch(() => {});
      await press(W, '[data-action=rep-tab][data-t=investor]');
      const can = await W.fr.waitForSelector('.rb [data-action=rb-create]', { timeout: 20000 }).then(() => true, () => false);
      if (can) {
        await rec(W, 'report builder list');
        const starts = await ev(W, () => ({ type: (document.querySelector('#rb-type option[value]:not([value=""])') || {}).value || '', start: '' }));
        if (starts.type) await W.fr.selectOption('#rb-type', starts.type);
        await W.fr.waitForTimeout(200);
        const start = await ev(W, () => (Array.from(document.querySelectorAll('#rb-start option')).find((o) => o.value) || {}).value || '');
        if (start) await W.fr.selectOption('#rb-start', start);
        await W.fr.fill('#rb-name', 'Quarterly letter');
        await press(W, '[data-action=rb-create]');
        const ed = await W.fr.waitForSelector('.rb-edit', { timeout: 15000 }).then(() => true, () => false);
        await W.fr.waitForTimeout(800);
        if (ed) await rec(W, 'report builder, a starter template open');
        else miss(W, 'report builder, a starter template open', 'Create did not open the editor');
      } else miss(W, 'report builder list', 'no New report form');
      // a new invitation, step by step: each step recorded before it is filled
      const name = W.size === 'phone' ? 'Ottoline Varga-Mbeki' : 'Leopold Asante-Ferreira';
      const email = W.size === 'phone' ? 'ottoline.varga@example.com' : 'leopold.asante@example.com';
      const who = Object.assign({ name }, await newInvitation(W, { name, email, type: 'individual', offeringId: ag.offeringId }));
      const step = (hd) => rec(W, `invitation step: ${hd}`, { wait: 150 });
      await toW9(W, who, step);
      await rec(W, 'invitation: the W-9 signing view');
      await w9Consent(W, who.investorId);
      await rec(W, 'invitation: the W-9 page to sign');
      await finishOnboarding(W, who, step);
      await rec(W, 'invitation: the agreement signing view');
      await L.finishAgreement(W.fr);
      await rec(W, 'invitation: done');
      // the activation page (an investor on file who has not activated) and the bank update page
      if (ids.notDone) {
        await T.sample(W.fr, { role: 'investor', investor: ids.notDone });
        await W.fr.waitForTimeout(500);
        await rec(W, 'activation');
      } else miss(W, 'activation', 'the sample has no investor still to activate');
      await T.sample(W.fr, { role: 'investor', investor: ids.inv });
      await route(W, 'account');
      if (await press(W, '[data-action="update-bank"]', { wait: 700 })) await rec(W, 'bank update');
      else miss(W, 'bank update', 'no Update bank account button');
      // the e-sign sender list and the envelope the invitation made
      await T.sample(W.fr, { role: 'admin' });
      await route(W, 'console-esign');
      await rec(W, 'e-sign list');
      const env = await ev(W, (id) => ((window.CVPortal.state.ws.envelopes || []).find((e) => e.agreementFor && (e.signers || []).some((s) => s.investorId === id)) || {}).id || '', who.investorId);
      if (env) {
        await route(W, `console-envelope-${env}`);
        await rec(W, 'e-sign envelope');
      } else miss(W, 'e-sign envelope', 'the invitation left no agreement envelope');
    }
  };
}

/* ---------- the dialogs ---------- */
/** The DIALOGS table against the call sites today: { calls, rows, perFile: [{ file, calls, rows, lines }] }. */
function dialogSites() {
  const dir = path.join(X.ROOT, 'assets/js');
  const perFile = [];
  fs.readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .forEach((f) => {
      const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
      const at = [];
      lines.forEach((l, i) => {
        const n = l.split('U.dialog(').length - 1;
        for (let k = 0; k < n; k++) at.push(i + 1);
      });
      const rows = S18.DIALOGS.filter((r) => r.file === f).length;
      if (at.length || rows) perFile.push({ file: f, calls: at.length, rows, lines: at });
    });
  const calls = perFile.reduce((a, x) => a + x.calls, 0);
  return { calls, rows: S18.DIALOGS.length, perFile };
}
const fillIds = (s, c) => String(s).replace(/\{(\w+)\}/g, (m, k) => (c[k] === undefined ? m : c[k]));
const dlgOpen = (W) => ev(W, () => !!(document.getElementById('dlg') || {}).open);
async function closeByX(W) {
  if (!(await dlgOpen(W))) return 'closed';
  if (await press(W, '#dlg [data-action="close-dialog"][aria-label="Close"]')) {
    if (!(await dlgOpen(W))) return 'X';
  }
  await ev(W, () => window.CVPortal.ui.closeDialog());
  await W.fr.waitForTimeout(200);
  return 'no X';
}
/** The named state steps of the DIALOGS rows (screens18.js); c holds the ids they leave for the rows' steps. */
const SETUP = {
  none: async () => {},
  helpPreview: (W) => ev(W, () => (window.CVPortalConfig = Object.assign(window.CVPortalConfig || {}, { helpAsk: () => new Promise(() => {}) }))),
  coSignIn: (W, c) =>
    T.ws(
      W.fr,
      (w, id) => {
        const inv = w.investors.find((i) => i.id === id);
        const now = new Date();
        const token = 'p18SignInTokenAbc123XyZ';
        inv.coInvestor = { first: 'Ravi', last: 'Shah', name: 'Ravi Shah', email: 'ravi.shah@investor.example', added: now.toISOString(), signIn: { token, link: `${location.origin}${location.pathname}?tenant=${encodeURIComponent(w.tenant.id)}#co-${token}`, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 14 * 864e5).toISOString(), sentAt: '', openedAt: '' } };
      },
      c.inv
    ),
  coExpired: (W, c) =>
    T.ws(
      W.fr,
      (w, id) => {
        const si = w.investors.find((i) => i.id === id).coInvestor.signIn;
        si.expiresAt = new Date(Date.now() - 864e5).toISOString();
        si.openedAt = '';
      },
      c.inv
    ),
  nachaReleased: async (W) => {
    await route(W, 'console-distributions');
    if (await W.fr.locator('input[name="ds-mode"][value="total"]:not(:checked)').count()) {
      await W.fr.check('input[name="ds-mode"][value="total"]', { force: true });
      await W.fr.waitForTimeout(300);
    }
    await W.fr.fill('#ds-total', '25000');
    await W.fr.waitForTimeout(400);
    if (!(await press(W, '[data-action=nacha-build]:not([disabled])', { wait: 900 }))) throw new Error('nacha-build could not be pressed');
    const got = W.A.page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    if (!(await press(W, '[data-action=nacha-download]', { wait: 700 }))) throw new Error('nacha-download could not be pressed');
    await got;
  },
  connection: async (W, c) => {
    c.conn = 'conn-p18-link';
    await T.ws(W.fr, (w, id, NS) => {
      const x = NS.integrations.ensure(w);
      if (!x.connections.some((y) => y.id === id)) x.connections.push({ id, name: 'Harbor Verify', type: 'link', link: 'https://verify.harbor.example/start', checks: ['identity'], note: '' });
    }, c.conn);
  },
  invitation: async (W, c) => {
    const r = await newInvitation(W, { name: 'Mira Castell', email: 'mira.castell@investor.example', type: 'individual', offeringId: c.raising });
    c.newInv = r.investorId;
    c.it = r.invitationId;
    await ev(W, () => window.CVPortal.app.render());
  },
  invitationClosed: (W, c) =>
    T.ws(
      W.fr,
      (w, id) => {
        const it = w.invitations.find((x) => x.id === id);
        it.status = 'cancelled';
        it.cancelledAt = new Date().toISOString();
      },
      c.it
    ),
  templatesTab: async (W) => {
    await route(W, 'console-esign');
    await press(W, '[data-action="es-tab"][data-t="templates"]');
  },
  draft: async (W, c) => {
    await route(W, 'console-esign');
    await press(W, '[data-action="es-tab"][data-t="templates"]');
    if (!(await press(W, '[data-action="es-tpl-use"][data-id="tpl-sub-test"]'))) throw new Error('no Use on the agreement template');
    await W.fr.waitForSelector('[data-change="es-pick"]', { timeout: 10000 });
    await W.fr.locator('[data-change="es-pick"]').first().check({ force: true });
    await W.fr.waitForTimeout(300);
    await press(W, '[data-action="es-create"]', { wait: 600 });
    await W.fr.waitForFunction(() => /^#console-envelope-/.test(location.hash), null, { timeout: 30000 });
    c.draft = await ev(W, () => location.hash.replace('#console-envelope-', ''));
    await W.fr.waitForTimeout(800);
  },
  draftFields: async () => {},
  editorRead: async (W, c) => {
    await route(W, `console-offering-${c.raising}`);
    if (!(await press(W, '[data-action="es-agreement-edit"]'))) throw new Error('no Edit fields on the offering');
    await W.fr.waitForSelector('.fe .es-fld', { timeout: 60000 });
    await ev(W, () => {
      const NS = window.CVPortal;
      const env = (NS.state.ws.envelopes || []).find((e) => e.agreementFor && e.status === 'draft');
      env.read = { ok: true, error: '', pages: env.pages, scanned: [], failed: [], places: 0, left: [], boxes: 0, blanks: 2, signatures: 1, initials: 0, investorPages: [], firmPages: [], firmLeft: 0, firmLeftPages: [], pictured: [] };
      NS.app.render();
    });
    await W.fr.waitForSelector('[data-action="es-reread"]', { timeout: 20000 });
    await W.fr.waitForTimeout(600);
  },
  taxImport: async (W, c) => {
    await route(W, 'console-taxdocs');
    await W.fr.waitForSelector('#tx-files', { timeout: 20000 });
    await W.fr.selectOption('#tx-fund', c.firstOffering);
    await W.fr.selectOption('#tx-kind', 'k1-1065');
    await W.fr.fill('#tx-year', '2025');
    const file = path.join(X.P10, 'fixtures', 'f1065sk1-2025.pdf');
    await W.fr.locator('#tx-files').setInputFiles([{ name: 'f1065sk1-2025.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(file) }]);
    await W.fr.waitForTimeout(300);
    await press(W, '[data-action=tx-import]');
    await W.fr.waitForFunction(() => {
      const NS = window.CVPortal;
      const u = (NS.state.ui || {}).tx || {};
      return !u.busy && ((NS.state.ws.taxdocs || {}).batches || []).length >= 1;
    }, null, { timeout: 120000, polling: 250 });
    await W.fr.waitForSelector('[data-action="tx-view"]:not([disabled])', { timeout: 30000 });
    await W.fr.waitForTimeout(500);
  },
  asInvestor: async (W, c) => {
    const r = await T.sample(W.fr, { role: 'investor', investor: c.inv });
    c.viewer = r.viewer;
  },
  uploadedDoc: async (W, c) => {
    await W.fr.evaluate(async (id) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      await NS.ops.files.put('doc-p18-upload', new Blob(['%PDF-1.4 side letter'], { type: 'application/pdf' }));
      ws.docs = ws.docs || [];
      if (!ws.docs.some((d) => d.id === 'doc-p18-upload')) ws.docs.push({ id: 'doc-p18-upload', title: 'Side letter', fileName: 'Side_letter.pdf', type: 'application/pdf', size: 20, sha256: '', cat: 'Legal', offeringId: '', audience: 'investors', investors: [id], date: NS.dates.today(), taxYear: '', publishedAt: new Date().toISOString(), publishedBy: 'test', hidden: false });
      NS.app.save(true);
      NS.app.render();
    }, c.viewer);
    await W.fr.waitForTimeout(300);
  },
  w9View: async (W, c) => {
    await T.sample(W.fr, { role: 'admin' });
    const name = W.size === 'phone' ? 'Ines Okafor-Lind' : 'Tomas Ruiz-Hallam';
    const who = Object.assign({ name }, await newInvitation(W, { name, email: W.size === 'phone' ? 'ines.okafor@example.com' : 'tomas.ruiz@example.com', type: 'individual', offeringId: c.raising }));
    c.who = who;
    await toW9(W, who);
  },
  w9Consent: async (W, c) => {
    c.sigField = await w9Consent(W, c.who.investorId);
    if (!c.sigField) throw new Error('the W-9 has no signature field');
  },
  onboarded: async (W, c) => {
    await finishOnboarding(W, c.who);
    await L.finishAgreement(W.fr);
    await T.sample(W.fr, { role: 'investor', investor: c.who.investorId });
  },
  asAdminEnvelope: async (W, c) => {
    await T.sample(W.fr, { role: 'admin' });
    c.agrEnv = await ev(W, (id) => ((window.CVPortal.state.ws.envelopes || []).find((e) => e.agreementFor && (e.signers || []).some((s) => s.investorId === id)) || {}).id || '', c.who.investorId);
  }
};
/** Every DIALOGS row of `edition`, in the table's order, in one session. */
function dialogsWalk(edition, only) {
  return {
    page: edition === 'managed' ? 'index.html' : 'diy.html',
    walk: async (W) => {
      const c = W.ctx;
      await T.sample(W.fr, { role: edition === 'managed' ? 'staff' : 'admin' });
      const ag = await agreementState(W, 'Rule 506(c)');
      Object.assign(c, await sampleIds(W));
      c.raising = ag.offeringId;
      const rows = S18.DIALOGS.filter((r) => r.editions.indexOf(edition) >= 0 && (!only || only.indexOf(`${r.file}#${r.nth}`) >= 0));
      for (const r of rows) {
        const key = `${r.file}#${r.nth} ${edition}`;
        const states = (r.first ? [[r.first[0], r.first[1]]] : []).concat([[r.setup, '']]);
        for (const [setup, suffix] of states) {
          const k = key + suffix;
          try {
            if (!SETUP[setup]) throw new Error(`no setup named ${setup}`);
            await SETUP[setup](W, c);
            for (const s of r.open) {
              if (s.route) await route(W, fillIds(s.route, c));
              else if (s.fill) await W.fr.fill(fillIds(s.fill[0], c), s.fill[1]);
              else if (s.press && !(await press(W, fillIds(s.press, c), { wait: 500 }))) throw new Error(`could not press ${fillIds(s.press, c)}`);
            }
            const open = await W.fr.waitForSelector('#dlg[open]', { timeout: 10000 }).then(() => true, () => false);
            if (!open) throw new Error(`the dialog did not open (${r.what})`);
            await W.fr.waitForTimeout(r.file === 'taxdocs-ui.js' ? 1500 : 500);
            await rec(W, k);
            const how = await closeByX(W);
            if (how === 'no X') W.noX = (W.noX || []).concat([k]);
          } catch (e) {
            miss(W, k, String(e && e.message ? e.message : e).split('\n')[0].slice(0, 200));
            await closeByX(W).catch(() => {});
          }
        }
      }
    }
  };
}
async function dialogsPart(check, S, size, only) {
  const part = `dialogs-${size}`;
  const d = dialogSites();
  const without = d.perFile.filter((x) => x.calls > x.rows);
  const extra = d.perFile.filter((x) => x.rows > x.calls);
  check(`the DIALOGS table names every call site: ${d.rows} rows for ${d.calls} call sites`, d.rows === d.calls && !without.length && !extra.length, { without, extra });
  if (without.length) check(`call sites without a row: ${without.reduce((a, x) => a + x.calls - x.rows, 0)}`, false, without.map((x) => `${x.file}: ${x.calls} calls, ${x.rows} rows`));
  d.perFile.forEach((x) => console.log(`NOTE ${part} ${x.file}: ${x.calls} U.dialog( call${x.calls === 1 ? '' : 's'} at line${x.calls === 1 ? '' : 's'} ${x.lines.join(', ')}; ${x.rows} row${x.rows === 1 ? '' : 's'}`));
  if (!S18.DIALOGS.length) return;
  const out = [];
  for (const ed of ['diy', 'managed']) {
    if (!S18.DIALOGS.some((r) => r.editions.indexOf(ed) >= 0)) continue;
    out.push(...(await sameWalk(check, S, part, size, [dialogsWalk(ed, only)], { min: 1 })));
  }
  // every row on every edition it names was opened and recorded on both trees
  const want = S18.DIALOGS.flatMap((r) => r.editions.map((ed) => `${r.file}#${r.nth} ${ed}`));
  const seen = out.filter((x) => x.res.ok).map((x) => x.key);
  const missing = want.filter((k) => seen.indexOf(k) < 0 && (!only || only.indexOf(k.split(' ')[0]) >= 0));
  check(`every DIALOGS row was recorded and is the same on every edition it names (${want.length - missing.length} of ${want.length} row x edition at ${size})`, !missing.length, missing.slice(0, 12));
}

/* ---------- selftest ---------- */
const W1 = (page, walk) => ({ page, walk });
const at = (role, hash, page) =>
  W1(page || 'diy.html', async (W) => {
    await T.sample(W.fr, { role });
    await route(W, hash);
    await rec(W, `${role} ${hash}`);
  });
const BRAND_PLEX = W1('diy.html', async (W) => {
  await T.sample(W.fr, { role: 'admin' });
  await T.ws(W.fr, (w) => (w.tenant.font = 'plex'));
  await route(W, 'console-brand');
  await rec(W, 'admin console-brand');
});
/**
 * Stand-ins: a copy of the selftest tree with literal replaces (each must match exactly once). fault: the comparison must
 * FAIL (and name the screen); control: it must PASS with its rule applied. part: the part whose walk the stand-in runs
 * (its FAIL line names it); each stand-in runs only the screens its change touches.
 */
const E1 = (file, from, to) => ({ file, from, to });
const STANDINS = [
  { name: 'word', kind: 'fault', edits: [E1('assets/js/console.js', 'Each investment is configured separately', 'Each investment is set up separately')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console-offerings')] },
  { name: 'c1-help', kind: 'control', rule: 'C1', edits: [E1('assets/js/help.js', 'aria-haspopup="dialog">Help</button>\')', 'aria-haspopup="dialog">Ask me anything</button>\')')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console')] },
  { name: 'c1-wrong', kind: 'fault', edits: [E1('assets/js/console.js', 'data-action="off-add">Add offering</button>\')', 'data-action="off-add">Ask me anything</button>\')')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console-offerings')] },
  { name: 'action', kind: 'fault', edits: [E1('assets/js/console.js', 'data-action="off-add">Add offering</button>\')', 'data-action="off-add2">Add offering</button>\')')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console-offerings')] },
  { name: 'href', kind: 'fault', edits: [E1('assets/js/console.js', 'return `<a href="#${k}"${active === k', 'return `<a href="#${k}${k === \'console-team\' ? \'-x\' : \'\'}"${active === k')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console')] },
  { name: 'line', kind: 'fault', edits: [E1('assets/js/console.js', 'const head = (title, sub, actions) => `<div class="cs-head"><div><h1>${title}</h1>', 'const head = (title, sub, actions) => `<div class="cs-head"><div><h1>${title}</h1><p>One more sentence on the page.</p>')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console-offerings')] },
  { name: 'menu', kind: 'fault', edits: [E1('assets/js/console.js', "    ['console-investors', 'Investors'],\n", '')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console')] },
  { name: 'chart', kind: 'fault', edits: [E1('assets/js/charts.js', "compact(cfg.values[n - 1]), 'c-cap', 'middle');", "compact(cfg.values[n - 1]) + ' of $987,654', 'c-cap', 'middle');")], part: 'investor-desktop', size: 'desktop', walks: [at('investor', 'distributions')] },
  { name: 'placeholder', kind: 'fault', edits: [E1('assets/js/console.js', 'placeholder="Q3 2026 Investor Update"', 'placeholder="Q3 2026 Investor Letter"')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console-docs')] },
  { name: 'value', kind: 'fault', edits: [E1('assets/js/console.js', 'data-bind="dist:desc" value="${h(d.desc)}"', 'data-bind="dist:desc" value="${h(d.desc)}X"')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console-distributions')] },
  { name: 'dialog-word', kind: 'fault', edits: [E1('assets/js/esign.js', 'Investors sign it during onboarding; you place the fields once.', 'Investors sign it during onboarding; you set the fields once.')], part: 'dialogs-desktop', size: 'desktop', dialogs: ['esign.js#10'] },
  { name: 'dialog-word', kind: 'fault', edits: [E1('assets/js/esign.js', 'Investors sign it during onboarding; you place the fields once.', 'Investors sign it during onboarding; you set the fields once.')], part: 'dialogs-phone', size: 'phone', dialogs: ['esign.js#10'] },
  { name: 'phone-only', kind: 'fault', edits: [E1('assets/css/console.css', '@media (max-width: 900px) {', '@media (max-width: 900px) {\n  .cs-head [data-action="off-add"] { display: none; }')], part: 'console-phone', size: 'phone', walks: [at('admin', 'console-offerings')], once: true },
  { name: 'managed', kind: 'fault', edits: [E1('assets/js/app.js', '<option value="__new">Add a client…</option>', '<option value="__new">Add a new client…</option>')], part: 'managed-desktop', size: 'desktop', walks: [at('staff', 'console', 'index.html')] },
  { name: 'c6-wrong', kind: 'fault', edits: [E1('assets/js/brand.js', '  const FONTS = {\n', "  const FONTS = {\n    brygada: { label: 'Brygada & Ysabeau', note: 'Classic, institutional', display: \"'Brygada 1918', Georgia, serif\", body: \"'Ysabeau Office', system-ui, sans-serif\", href: '' },\n"), E1('assets/js/console.js', "data-bind=\"tenant:font\"${t.font === k ? ' checked' : ''}", "data-bind=\"tenant:font\"${(t.font === 'plex' ? 'brygada' : t.font) === k ? ' checked' : ''}")], part: 'console-desktop', size: 'desktop', walks: [BRAND_PLEX] },
  { name: 'empty', kind: 'fault', edits: [E1('assets/js/console.js', '<main class="cs-main" id="main" tabindex="-1">${inner}</main>', '<main class="cs-main" id="main" tabindex="-1"></main>')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console')] },
  { name: 'c3', kind: 'control', rule: 'C3', edits: [E1('assets/js/help.js', 'aria-label="Ask a question" placeholder="Ask a question"', 'aria-label="Ask me anything" placeholder="Ask me anything"')], part: 'dialogs-desktop', size: 'desktop', dialogs: ['help.js#1'] },
  { name: 'c4', kind: 'control', rule: 'C4', edits: [E1('assets/js/console.js', "    ['console-intake', 'Offering intake'],\n", '')], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console')] },
  { name: 'c6-q4', kind: 'control', rule: 'C6', edits: [E1('assets/js/brand.js', '  const FONTS = {\n', "  const FONTS = {\n    brygada: { label: 'Brygada & Ysabeau', note: 'Classic, institutional', display: \"'Brygada 1918', Georgia, serif\", body: \"'Ysabeau Office', system-ui, sans-serif\", href: '' },\n"), E1('assets/js/tenants.js', "      colors: { primary: '#006C95', accent: '#77B6CA' },\n      font: 'funnel',", "      colors: { primary: '#006C95', accent: '#77B6CA' },\n      font: 'brygada',")], part: 'console-desktop', size: 'desktop', walks: [at('admin', 'console-brand')] }
];
const stCache = {};
async function selftestTree() {
  if (!stCache.tree) {
    const t = X.archiveTree(SELFTEST_COMMIT, 'p18-selftest-');
    made.push(t);
    const srv = await X.serveDir(t.dir);
    stCache.tree = { name: 'selftest tree', dir: t.dir, origin: srv.origin, srv };
  }
  return stCache.tree;
}
async function standIn(st) {
  const src = await selftestTree();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `p18-standin-${st.name}-`));
  const t = { dir, made: true };
  made.push(t);
  fs.cpSync(src.dir, dir, { recursive: true });
  for (const e of st.edits) {
    const f = path.join(dir, e.file);
    const text = fs.readFileSync(f, 'utf8');
    const n = text.split(e.from).length - 1;
    if (n !== 1 && !(st.once && n > 1)) throw new Error(`stand-in ${st.name}: "${e.from.slice(0, 60)}" is in ${e.file} ${n} times, not once`);
    fs.writeFileSync(f, text.replace(e.from, e.to));
  }
  const srv = await X.serveDir(dir);
  return {
    tree: { name: `stand-in ${st.name}`, dir, origin: srv.origin },
    close: async () => {
      await srv.close();
      X.removeTree(t);
    }
  };
}
async function selftest({ check, S }) {
  const src = await selftestTree();
  for (const st of STANDINS) {
    let si = null;
    try {
      si = await standIn(st);
      const walks = st.dialogs ? [dialogsWalk('diy', st.dialogs)] : st.walks;
      const res = await sameWalk(check, S, st.part, st.size, walks, { base: src, plan: si.tree, quiet: true, noVendorCheck: true });
      const failed = res.filter((r) => !r.res.ok);
      if (st.kind === 'fault') check(`fault ${st.name} caught${st.dialogs ? ` in ${st.part}` : ''}: ${failed.length ? failed[0].line : `nothing failed (${res.map((r) => r.line).join(' / ')})`}`, failed.length > 0 && res.length > 0);
      else {
        const used = res.some((r) => r.res.ok && (r.res.applied || []).indexOf(st.rule) >= 0);
        check(`control ${st.name} passes (${st.rule}): ${res.map((r) => r.line).join(' / ')}`, res.length > 0 && !failed.length && used);
      }
    } catch (e) {
      check(`stand-in ${st.name} ran`, false, String(e && e.message ? e.message : e));
    } finally {
      if (si) await si.close();
    }
  }
}

/* ---------- parts ---------- */
L.runParts(
  {
    selftest,
    'console-desktop': ({ check, S }) => sameWalk(check, S, 'console-desktop', 'desktop', [CONSOLE], { min: 20 }),
    'console-phone': ({ check, S }) => sameWalk(check, S, 'console-phone', 'phone', [CONSOLE], { min: 20 }),
    'managed-desktop': ({ check, S }) => sameWalk(check, S, 'managed-desktop', 'desktop', [MANAGED], { min: 10 }),
    'managed-phone': ({ check, S }) => sameWalk(check, S, 'managed-phone', 'phone', [MANAGED], { min: 10 }),
    'investor-desktop': ({ check, S }) => sameWalk(check, S, 'investor-desktop', 'desktop', [investorWalk('diy.html'), investorWalk('index.html')], { min: 16 }),
    'investor-phone': ({ check, S }) => sameWalk(check, S, 'investor-phone', 'phone', [investorWalk('diy.html'), investorWalk('index.html')], { min: 18 }),
    'flows-desktop': ({ check, S }) => sameWalk(check, S, 'flows-desktop', 'desktop', [flowsWalk()], { min: 15 }),
    'flows-phone': ({ check, S }) => sameWalk(check, S, 'flows-phone', 'phone', [flowsWalk()], { min: 15 }),
    'dialogs-desktop': ({ check, S }) => dialogsPart(check, S, 'desktop'),
    'dialogs-phone': ({ check, S }) => dialogsPart(check, S, 'phone')
  },
  { name: 'SAME SCREENS', unit: 'parts', flag: '--only', browser: true }
);
