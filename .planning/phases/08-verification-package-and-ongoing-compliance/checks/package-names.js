#!/usr/bin/env node
// GATE CHECK: PACKAGE NAMES
// Plan 08-19 (R12, D-30): a package screening covers the role names the investor's own onboarding holds (an entity's
// beneficial owners, a joint account's second holder), stored on the server before the screening, at most 5; the
// console's "N names screened" is the server's count. The sponsor's console is the sample self-serve portal on a sponsor
// account of the real integration server (server/index.mjs in this process, doubles/world.js startServer); the payment and
// identity check providers are the world's injected fetch answering the recorded fixtures. No provider is called, no key
// exists, and any call that would leave this machine is refused and kept; every part asserts that record is empty.
//   owners    1280x800: an entity investor invited with the package gives two beneficial owners other than the
//             controlling person on the profile step; when identity passes, the server already holds those two role
//             names (read from its store through its vault at each screening call) and the world records four calls:
//             the controlling person, the entity's name and the two owners; the investor goes back to the profile step,
//             corrects the second owner's name and continues: the corrected name is stored first, then a new round of
//             four calls holds it and not the old one; package screening starts total 2 (the limit is 3); the investor
//             finishes, the console imports, and the investor's last screening line in its audit reads "4 names
//             screened"; the typed taxpayer number is in no world record, no server output and no file this part writes
//             (the scan proved first on a planted copy)
//   individual  390x844 with touch: an individual investor with the package: no role name is stored; the world records
//             exactly the invitation's own names; the device's audit line counts what the server screened; the profile
//             and identity steps fit the width with no sideways scroll
//   preview-desktop, preview-phone  the owner's preview (framed, every connection refused, no server) at 1280x800 and at
//             390x844 with touch: the frame refuses a fetch; an entity investor's profile step shows exactly the fields it
//             showed at the base ("Second beneficial owner" still Optional) and continues with only what phase 6 already
//             requires; the identity step works with the firm's sandbox connection; nothing attempted, no raw error
//   NODE_PATH=$(npm root -g) node package-names.js [--only owners,individual,preview-desktop,preview-phone]
// The last line is "PACKAGE NAMES: PASS (parts run: N)" or "PACKAGE NAMES: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const F = require('./frame.js');
const W = require('./doubles/world.js');
const Lib = F.Lib;

// The integration server runs in this process: any call it makes outside this machine, other than through the world's
// fetch, is refused here and kept, so every part can prove none was made.
const outside = [];
const ownFetch = globalThis.fetch;
W.world.localFetch = ownFetch;
globalThis.fetch = (input, init) => {
  const u = new URL(String(input && input.url ? input.url : input));
  if (['127.0.0.1', 'localhost', '[::1]'].indexOf(u.hostname) < 0) {
    outside.push(`${(init && init.method) || 'GET'} ${u.origin}${u.pathname}`);
    return Promise.reject(new Error('refused by the check: no call leaves this machine'));
  }
  return ownFetch(input, init);
};

fs.mkdirSync(Lib.OUT, { recursive: true });
const SHOTS = path.join(Lib.OUT, 'package-names-shots');
fs.mkdirSync(SHOTS, { recursive: true });
Lib.describeShots([
  ['owners-profile-desktop.png', 'The entity investor\'s profile step at 1280x800 with two beneficial owners other than the controlling person.'],
  ['owners-audit-line.png', 'The console\'s Integrations page after the import: under "Recent verification activity", the investor\'s screening line reads "4 names screened".'],
  ['individual-profile-phone.png', 'An individual investor\'s profile step through the package at 390x844 with touch.'],
  ['preview-desktop-profile.png', 'The owner\'s preview at 1280x800: an entity investor\'s profile step, the same fields as before.'],
  ['preview-phone-profile.png', 'The owner\'s preview at 390x844 with touch: an entity investor\'s profile step, the same fields as before.']
]);

const SCREEN_RUN = 'Sanctions and PEP screening run';
const ENTITY = { first: 'Odalys', last: 'Vantongeren', email: 'odalys.vantongeren@example.net', account: 'Vantongeren Holdings LLC' };
const PERSON = { first: 'Teodor', last: 'Halvorsen', email: 'teodor.halvorsen@example.net' };
const OWNER1 = { first: 'Amelia', last: 'Oakhurst', pct: '50' };
const OWNER2 = { first: 'Bastian', last: 'Pellow', pct: '40' };
const OWNER2_FIXED = { first: 'Bastian', last: 'Pellew' };
const full = (o) => `${o.first} ${o.last}`;
// The labels an entity's profile step showed at the base (b90ca2a, read by this check's preview parts before plan 08-19
// changed anything on the investor's device; the plan adds no field).
const BASE_LABELS = [
  'Individual',
  'Joint account',
  'Trust',
  'LLC, partnership or corporation',
  'IRA (through a custodian)',
  'Entity legal name The legal name of the entity',
  'Country of mailing address',
  'Mailing address',
  'City',
  'State',
  'ZIP code',
  'Phone',
  'State or country of formation',
  'Controlling person',
  'Beneficial owner: first name',
  'Last name',
  'Ownership (%)',
  'Second beneficial owner: first name Optional',
  'Last name',
  'Ownership (%)',
  'Employer ID number (EIN) Nine digits.',
  'No',
  'Yes'
];

// The taxpayer number phase 6's walk types (lib.js walk: a.tin || '123456789'); read from that file, never typed here.
const TIN = (() => {
  const src = fs.readFileSync(path.join(Lib.ROOT, '.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js'), 'utf8');
  const m = src.match(/#ob-tin', a\.tin \|\| '(\d{9})'/);
  return m ? m[1] : '';
})();
const holdsTin = (text) => !!TIN && String(text || '').indexOf(TIN) >= 0;

/** The console on a sponsor account of the real server, wired to a fresh world. */
async function boot(S, check) {
  const w = W.world();
  const srv = await W.startServer(S, w, { dir: Lib.OUT });
  const A = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
  const C = { S, w, srv, A, cp: A.page, rounds: [], closers: [() => A.context.close()] };
  C.close = async () => {
    for (const c of C.closers.reverse()) await c().catch(() => {});
    await srv.close().catch(() => {});
  };
  try {
    C.off = await Lib.setupPortal(S, A, { exemption: 'Rule 506(b)' });
    check('the console uses the integration server with the sponsor account\'s token', (await srv.configure(A.page)) === true);
  } catch (e) {
    await C.close();
    throw e;
  }
  return C;
}
/** The role names the server holds for an invitation, read from its store through its vault (never through a route). */
const storedRoles = (C, serverId) => C.srv.server.invitations.roleNames(C.srv.server.store.get('invitations', serverId));

/** The console invites `who` (an entity when who.account is set) to the raising offering with the package box ticked. */
async function sendPackage(C, check, who) {
  const p = C.cp;
  await Lib.consoleRoute(p, 'console-investors', '[data-action=invite-toggle]');
  if ((await p.locator('#iv-email').count()) === 0) await p.click('[data-action=invite-toggle]');
  await p.waitForSelector('#iv-email', { timeout: 10000 });
  await p.fill('#iv-contact', who.first);
  await p.fill('#iv-last', who.last);
  await p.fill('#iv-email', who.email);
  if (!(await p.locator('#iv-more[open]').count())) await p.click('#iv-more summary');
  if (who.account) {
    await p.selectOption('#iv-type', 'entity');
    await p.fill('#iv-title', who.account);
  }
  await p.selectOption('#iv-off', C.off.offeringId);
  await p.waitForFunction(() => {
    const i = document.getElementById('iv-package');
    return !!i && !i.disabled && !!i.offsetWidth;
  }, null, { timeout: 15000 });
  await p.check('#iv-package');
  await p.click('.inv8-form[data-form="invite-one"] button[type=submit]');
  await p.waitForFunction((email) => {
    const ws = window.CVPortal.state.ws;
    const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
    const it = inv && (ws.invitations || []).filter((x) => x.investorId === inv.id).pop();
    return !!(it && (it.serverId || it.emailStatus === 'failed' || it.emailStatus === 'manual'));
  }, who.email, { timeout: 30000 });
  await p.waitForTimeout(300);
  const it = await p.evaluate((email) => {
    const ws = window.CVPortal.state.ws;
    const inv = ws.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
    const x = (ws.invitations || []).filter((y) => y.investorId === inv.id).pop();
    return { id: x.id, serverId: x.serverId || '', link: x.link || '', investorId: inv.id, title: inv.title, type: inv.type };
  }, who.email);
  if (await p.evaluate(() => !!(document.getElementById('dlg') || {}).open)) await p.click('#dlg [data-action=close-dialog]').catch(() => {});
  check(`the invitation (${who.account ? 'an entity' : 'an individual'}) went to the server with the package box ticked`, /^ivt_/.test(it.serverId) && !!it.link && (who.account ? it.title === who.account : true), it);
  return it;
}

/** The investor's own browser (view 'desktop' | 'phone') on the link. */
async function investorBrowser(C, view) {
  const B = await Lib.open(C.S, { allow: [C.srv.base], init: C.srv.init, context: Object.assign({}, F.VIEW[view || 'desktop']) });
  C.closers.push(() => B.context.close());
  return B;
}
/** The profile step's two owner rows filled (first, last, percentage). */
async function fillOwners(ip, o1, o2) {
  await ip.fill('#ob-owner1', o1.first);
  await ip.fill('#ob-owner1Last', o1.last);
  if (o1.pct) await ip.fill('#ob-owner1pct', o1.pct);
  await ip.fill('#ob-owner2', o2.first);
  await ip.fill('#ob-owner2Last', o2.last);
  if (o2.pct) await ip.fill('#ob-owner2pct', o2.pct);
}
/** "Verify my identity" pressed (tapped on a phone); the new tab is closed once it opened (its page is the provider's). */
async function startCheck(B, ip, tap) {
  const popup = B.context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  if (tap) await ip.tap('#iv-identity [data-action=iv-start]');
  else await ip.click('#iv-identity [data-action=iv-start]');
  const tab = await popup;
  await ip.waitForTimeout(800);
  if (tab && !tab.isClosed()) await tab.close().catch(() => {});
  return !!tab;
}
const waitVerified = (ip) =>
  ip
    .waitForFunction(() => /Verified/.test(((document.querySelector('#iv-identity .iv-chip') || {}).textContent || '')), null, { timeout: 45000 })
    .then(() => true)
    .catch(() => false);
/** Until the world's screening calls stop growing for 1.5 s (a round of one call per name ends); resolves to the count. */
async function screeningsSettle(C, atLeast) {
  let last = -1;
  let same = 0;
  for (let i = 0; i < 150; i++) {
    const n = C.w.count('screening');
    if (n === last && n >= atLeast) {
      if (++same >= 6) return n;
    } else same = 0;
    last = n;
    await new Promise((r) => setTimeout(r, 250));
  }
  return C.w.count('screening');
}
/** Until the server holds the investor's completed submission (account token); resolves to its row or null. */
async function completed(C, serverId) {
  for (let i = 0; i < 100; i++) {
    const r = await C.srv.call('GET', '/v1/invitations?workspace=kestrel-bay', undefined, C.srv.token);
    const rows = Array.isArray(r.body) ? r.body : (r.body && r.body.invitations) || [];
    const row = rows.find((x) => x.id === serverId);
    if (row && row.status === 'completed' && row.hasSubmission) return row;
    await new Promise((res) => setTimeout(res, 300));
  }
  return null;
}
/** The investor's screening lines in a workspace's audit (the page's own ws.audit), oldest first. */
const screeningLines = (page, title) =>
  page.evaluate(
    ({ title, action }) => (window.CVPortal.state.ws.audit || []).filter((e) => e && e.action === action && String(e.detail || '').indexOf(`${title}: `) === 0).map((e) => e.detail),
    { title, action: SCREEN_RUN }
  );
const countOf = (line) => {
  const m = /^.*?: (\d+) names? screened\./.exec(String(line || ''));
  return m ? Number(m[1]) : null;
};
/** The names of the world's screening calls from index `from` on, in order. */
const namesFrom = (C, from) => C.w.calls.filter((c) => c.kind === 'screening').slice(from).map((c) => (c.names || [])[0]);
const sameSet = (a, b) => JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());
/** What every part asserts about the outside world: nothing left this machine, and the world was asked for nothing unknown. */
function worldClean(check, C) {
  check('no call left this machine outside the stand-in world (the outside-call record is empty)', outside.length === 0, outside);
  check('the stand-in world was asked for nothing but the package providers\' own calls', C.w.count('other') === 0, C.w.calls.filter((c) => c.kind === 'other'));
}
/** An element (selector) and the page inside the window's width. */
const widths = (p, sel) =>
  p.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el ? el.getBoundingClientRect() : null;
    return { found: !!el, left: r ? Math.round(r.left) : null, right: r ? Math.round(r.right) : null, width: innerWidth, page: document.documentElement.scrollWidth };
  }, sel);
const fitsWidth = async (p, sel) => {
  const x = await widths(p, sel);
  return x.found && x.left >= 0 && x.right <= x.width && x.page <= x.width + 1;
};
/** The labels of the step's fields, as the investor reads them (the Optional mark included). */
const labels = (p) =>
  p.evaluate(() =>
    Array.from(document.querySelectorAll('.ivf-form label'))
      .filter((l) => !!(l.offsetWidth || l.offsetHeight))
      .map((l) => {
        const c = l.cloneNode(true);
        c.querySelectorAll('select, option, input, textarea').forEach((x) => x.remove());
        return c.textContent.replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean)
  );

async function owners({ check, S }) {
  // The taxpayer-number scan proved first on a planted copy of a file.
  const O = path.dirname(Lib.OUT);
  const plantFile = path.join(O, `package-names-planted-${process.pid}.txt`);
  fs.writeFileSync(plantFile, `planted copy: ${TIN}\n`);
  check('the taxpayer-number scan finds the number in a planted copy of a file', TIN.length === 9 && holdsTin(fs.readFileSync(plantFile, 'utf8')));
  fs.rmSync(plantFile, { force: true });
  let printed = '';
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  process.stdout.write = (c, ...a) => ((printed += String(c)), out(c, ...a));
  process.stderr.write = (c, ...a) => ((printed += String(c)), err(c, ...a));
  const C = await boot(S, check);
  try {
    const it = await sendPackage(C, check, ENTITY);
    // At each screening call: the role names the server holds at that moment.
    const atCall = [];
    C.w.onCall = (e) => {
      if (e.kind === 'screening') atCall.push({ name: (e.names || [])[0], roles: storedRoles(C, it.serverId) });
    };
    const B = await investorBrowser(C, 'desktop');
    const ip = B.page;
    await ip.goto(it.link);
    let shot = false;
    const wk = await Lib.walk(ip, {
      name: full(ENTITY),
      until: /Identity verification/,
      onStep: async (hd) => {
        if (!/Investor information/.test(hd)) return;
        await fillOwners(ip, OWNER1, OWNER2);
        if (!shot) await ip.screenshot({ path: path.join(SHOTS, 'owners-profile-desktop.png') });
        shot = true;
      }
    });
    check('the entity investor reaches the identity step with two beneficial owners given and no field error', wk.reached && wk.errors.length === 0, wk);
    check('no screening before identity passes', C.w.count('screening') === 0, C.w.count('screening'));
    await startCheck(B, ip, false);
    const code = await C.w.deliver(C.srv.base, C.w.sessions[0], 'Approved');
    const ok = await waitVerified(ip);
    check('identity passes through the package (signed delivery accepted, the step reads Verified)', code === 200 && ok, { code, ok });
    const n1 = await screeningsSettle(C, 1);
    const round1 = namesFrom(C, 0);
    const want1 = [full(ENTITY), ENTITY.account, full(OWNER1), full(OWNER2)];
    check('when identity passes the world records four calls: the controlling person, the entity\'s name and the two owners', n1 === 4 && sameSet(round1, want1), { calls: n1, names: round1 });
    check('the server held the two role names before the first screening call', atCall.length >= 1 && sameSet(atCall[0].roles, [full(OWNER1), full(OWNER2)]), atCall.map((a) => a.roles));

    // The investor goes back to the profile step, corrects the second owner's name and continues.
    await ip.click('.ivf-form [data-action=ivf-back]');
    await ip.waitForFunction(() => /Investor information/.test((document.querySelector('.ivf-form h1') || {}).textContent || ''), null, { timeout: 15000 });
    const wk2 = await Lib.walk(ip, {
      name: full(ENTITY),
      until: /Identity verification/,
      onStep: async (hd) => {
        if (!/Investor information/.test(hd)) return;
        await ip.fill('#ob-owner2', OWNER2_FIXED.first);
        await ip.fill('#ob-owner2Last', OWNER2_FIXED.last);
      }
    });
    check('the corrected profile continues to the identity step with no field error', wk2.reached && wk2.errors.length === 0, wk2);
    const n2 = await screeningsSettle(C, 5);
    const round2 = namesFrom(C, n1);
    const want2 = [full(ENTITY), ENTITY.account, full(OWNER1), full(OWNER2_FIXED)];
    check('a new round of four calls holds the corrected name and not the old one', n2 - n1 === 4 && sameSet(round2, want2) && round2.indexOf(full(OWNER2)) < 0, { calls: n2 - n1, names: round2 });
    const first2 = atCall[n1];
    check('the corrected role names were stored before that round\'s first call', !!first2 && sameSet(first2.roles, [full(OWNER1), full(OWNER2_FIXED)]), first2 && first2.roles);
    const starts = (C.srv.server.store.get('invitations', it.serverId).packageStarts || {}).screening;
    check('package screening starts total 2 (the limit is 3)', starts === 2, starts);

    // The investor finishes; the console imports; the investor's last screening line counts the server's names.
    await Lib.submit(ip);
    const rest = await Lib.walk(ip, { name: full(ENTITY) });
    check('the investor walks on to the agreement with no field error', rest.reached && rest.errors.length === 0, rest);
    const done = await Lib.finishAgreement(ip).catch((e) => `NOT FINISHED: ${e.message}`);
    check('the investor finishes onboarding', !/^NOT FINISHED/.test(done), done);
    check('the server holds the completed submission', !!(await completed(C, it.serverId)));
    await Lib.importFromConsole(C.cp, it.id);
    const lines = await screeningLines(C.cp, it.title);
    const last = lines[lines.length - 1] || '';
    check('the console imports and the investor\'s last screening line reads "4 names screened"', countOf(last) === 4 && last.indexOf(`${it.title}: 4 names screened.`) === 0, lines);
    check('that count is the server\'s: the number of calls in the last round', countOf(last) === n2 - n1, { line: countOf(last), server: n2 - n1 });
    // On screen: the Integrations page's "Recent verification activity" lists the line (the owner's screenshot shows it).
    await Lib.consoleRoute(C.cp, 'console-integrations', '.cs-list li').catch(() => {});
    await C.cp.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 8000 }).catch(() => {});
    const shown = await C.cp.evaluate((want) => {
      const li = Array.from(document.querySelectorAll('.cs-list li')).find((x) => x.innerText.indexOf(want) >= 0);
      if (li) li.scrollIntoView({ block: 'center' });
      return li ? li.innerText.replace(/\s+/g, ' ').trim() : '';
    }, `${it.title}: 4 names screened.`);
    check('the console shows the line under "Recent verification activity"', shown.indexOf(`${it.title}: 4 names screened.`) >= 0, shown);
    await C.cp.screenshot({ path: path.join(SHOTS, 'owners-audit-line.png') });
    check('the console screened nothing again on import (eight calls in all)', C.w.count('screening') === 8, C.w.count('screening'));
    worldClean(check, C);
    check('no script error in the console or on the investor\'s device', C.A.errors.length === 0 && B.errors.length === 0, { console: C.A.errors, investor: B.errors });
    F.leakFree(check, 'the investor\'s last screen', await Lib.screenText(ip));
    // W1/W2: the typed taxpayer number appears in no world record, no server output and no file this part writes.
    const record = path.join(O, 'package-names-owners.txt');
    fs.writeFileSync(record, [`PACKAGE NAMES owners, ${new Date().toISOString()}`, `round 1 calls ${n1}`, `round 2 calls ${n2 - n1}`, `screening starts ${starts}`, `last screening line count ${countOf(last)}`].join('\n') + '\n');
    check('the typed taxpayer number is in no world record', C.w.calls.length > 0 && !holdsTin(JSON.stringify(C.w.calls)));
    check('the typed taxpayer number is in no server output (event log, anything this process printed)', !holdsTin(JSON.stringify(C.srv.server.store.list('events'))) && !holdsTin(printed));
    check('the typed taxpayer number is in no file this part writes', !holdsTin(fs.readFileSync(record, 'utf8')));
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
    await C.close();
  }
}

async function individual({ check, S }) {
  const C = await boot(S, check);
  try {
    const it = await sendPackage(C, check, PERSON);
    const B = await investorBrowser(C, 'phone');
    const ip = B.page;
    const size = ip.viewportSize();
    check('the investor\'s window is 390x844 with touch', size.width === 390 && size.height === 844 && (await ip.evaluate(() => navigator.maxTouchPoints > 0)), size);
    await ip.goto(it.link);
    const fit = {};
    const wk = await Lib.walk(ip, {
      name: full(PERSON),
      until: /Identity verification/,
      onStep: async (hd) => {
        if (!/Investor information/.test(hd)) return;
        fit.profile = await fitsWidth(ip, '.ivf-form');
        fit.profileAt = await widths(ip, '.ivf-form');
        await ip.screenshot({ path: path.join(SHOTS, 'individual-profile-phone.png') });
      }
    });
    check('the investor reaches the identity step with no field error', wk.reached && wk.errors.length === 0, wk);
    check('the profile step fits the width (no sideways scroll)', fit.profile === true, fit.profileAt);
    check('the identity step fits the width (no sideways scroll)', await fitsWidth(ip, '#iv-identity'), await widths(ip, '#iv-identity'));
    await startCheck(B, ip, true);
    const code = await C.w.deliver(C.srv.base, C.w.sessions[0], 'Approved');
    const ok = await waitVerified(ip);
    check('identity passes through the package (a tap starts it; the step reads Verified)', code === 200 && ok, { code, ok });
    const n = await screeningsSettle(C, 1);
    const own = Array.from(new Set([full(PERSON), it.title].map((x) => String(x || '').trim()).filter(Boolean)));
    check('the world records exactly the invitation\'s own names', n === own.length && sameSet(namesFrom(C, 0), own), { calls: n, names: namesFrom(C, 0), own });
    check('no role name is stored for an individual', storedRoles(C, it.serverId).length === 0, storedRoles(C, it.serverId).length);
    const lines = await screeningLines(ip, it.title);
    check('the device\'s screening line counts the names the server screened', lines.length >= 1 && countOf(lines[lines.length - 1]) === n, { lines, server: n });
    check('the identity step still fits the width once verified', await fitsWidth(ip, '#iv-identity'), await widths(ip, '#iv-identity'));
    worldClean(check, C);
    check('no script error on the investor\'s device', B.errors.length === 0, B.errors);
    F.leakFree(check, 'the investor\'s screen', await Lib.screenText(ip));
  } finally {
    await C.close();
  }
}

/** The owner's preview (view 'desktop' | 'phone'): framed, every connection refused, no server. */
async function preview(check, S, view) {
  const { A, fr } = await F.framed(S, view);
  try {
    const size = A.page.viewportSize();
    const tap = view === 'phone';
    check(`the window is ${F.VIEW[view].viewport.width}x${F.VIEW[view].viewport.height}${tap ? ' with touch' : ''}`, size.width === F.VIEW[view].viewport.width && size.height === F.VIEW[view].viewport.height && (await fr.evaluate(() => navigator.maxTouchPoints > 0)) === tap, size);
    await F.proveRefused(check, A, fr);
    const portal = await Lib.setupPortal(S, { page: fr, context: A.context });
    check('no integration server is connected', (await fr.evaluate(() => window.CVPortal.invitations.serverOn(window.CVPortal.state.ws))) === false);
    const who = { name: 'Rosalind Achebe', email: 'rosalind.achebe@example.net', account: 'Achebe Family Holdings LLC' };
    const inv = await Lib.createInvitation(fr, { name: who.name, email: who.email, type: 'entity', account: who.account, offeringId: portal.offeringId });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    const atProfile = await Lib.walk(fr, { name: who.name, until: /Investor information/ });
    check('an invited entity investor reaches the profile step', atProfile.reached && atProfile.errors.length === 0, atProfile);
    const got = await labels(fr);
    fs.writeFileSync(path.join(path.dirname(Lib.OUT), `package-names-labels-${view}.json`), JSON.stringify(got, null, 1));
    await A.page.screenshot({ path: path.join(SHOTS, `preview-${view}-profile.png`) });
    check('the profile step shows exactly the fields it showed at the base (the same labels)', !!BASE_LABELS && JSON.stringify(got) === JSON.stringify(BASE_LABELS), got);
    check('"Second beneficial owner" is still marked Optional', got.some((l) => /^Second beneficial owner: first name Optional$/.test(l)), got.filter((l) => /owner/i.test(l)));
    await F.noRawError(check, fr, 'the profile step');
    const wk = await Lib.walk(fr, { name: who.name, until: /Identity verification/ });
    check('the profile step continues with only what phase 6 already requires (the owner as prefilled, nothing more)', wk.reached && wk.errors.length === 0, wk);
    const text = await fr.evaluate(() => ((document.getElementById('iv-identity') || {}).innerText || ''));
    check('the identity step offers the firm\'s own sandbox connection', text.indexOf('This portal is in sandbox mode: the check is simulated.') >= 0, text);
    await Lib.sandbox(fr, 'identity', 'passed');
    const chip = await fr.evaluate(() => ((document.querySelector('#iv-identity .iv-chip') || {}).textContent || '').trim());
    check('the identity step works with the sandbox connection (Verified)', /Verified/.test(chip), chip);
    const step = await F.noRawError(check, fr, 'the identity step');
    check('nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
    F.leakFree(check, 'every screen of this part', step);
  } finally {
    await A.context.close().catch(() => {});
  }
}

const PARTS = {
  owners,
  individual,
  'preview-desktop': ({ check, S }) => preview(check, S, 'desktop'),
  'preview-phone': ({ check, S }) => preview(check, S, 'phone')
};

Lib.runParts(PARTS, { name: 'PACKAGE NAMES', unit: 'parts', flag: '--only', browser: true });
