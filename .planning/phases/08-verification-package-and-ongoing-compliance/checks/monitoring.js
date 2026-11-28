#!/usr/bin/env node
// GATE CHECK: MONITORING
// Plan 08-08 (D-04, C-06): ongoing screening of investors already on file, against stand-ins. The sponsor's console is the
// sample self-serve portal on a sponsor account of the real integration server (server/index.mjs in this process,
// doubles/world.js startServer); the identity check provider and the payment provider are the world's injected fetch
// answering the recorded fixtures; the U.S. Treasury list files are answered here from stand-in lists (as
// server/test/core.test.mjs answers them); monitoring alerts are signed here as server/test/idcheck.test.mjs signs them. No
// provider is called, no key exists, and any call that would leave this machine is refused and kept.
// Every part that uses the server first shows that the console asks a server whose address is only saved nothing by itself,
// then confirms it with "Check connection" on the Integrations page, as the sponsor does when connecting it.
//   alert     1280x800: a package investor is brought into the console cleared (as package-flow.js part identity does);
//             a signed new-hit alert reaches the server; the console is opened again; with no click the investor reads
//             "Needs review" on the AML/KYC page, the details name the hit's listed name, the Overview's attention list
//             counts one investor held, and the change log holds exactly one "Monitoring alert" naming the investor; the
//             typed taxpayer number is in no world record, no server output and no file the part writes (the scan proved
//             first on a planted copy)
//   hold-only 1280x800: an investor held by an alert; the server's record then reads clear and the console's next pull
//             lists it: the investor stays held; a person's approval with a note on the AML/KYC page clears them, and it
//             stands when the console opens again
//   monitored-not-due  a package investor whose screening is monitored (with the old date an import leaves): no next
//             re-screen date once the console loads, not due, never offered "Run now" whatever the date; "Run now"
//             re-screens the other due investor only; a screening whose every result is monitored sets no next date, one
//             that is not keeps the firm's interval
//   package-not-run  (G4) a package investor whose screening was not monitored and is due: with the firm's free Treasury
//             connection on, "Run now" re-screens them through it alone (one list read, no call to the package provider
//             or the sponsor's own connector, the package result kept); with none, they are left out of "Run now" and
//             nothing is called; no error text on the Overview or the AML/KYC page in either
//   kyc-buttons  (08-CONTEXT "After 08-08") the AML/KYC page's "Re-screen" and "Re-screen N due" follow "Run now"'s
//             package rule: with the free Treasury connection on, a package investor is re-screened through it alone (never
//             the sponsor's own connector, never the package provider, the package result kept); with none, "Re-screen" calls
//             nothing and says why in one sentence, and "Re-screen N due" leaves them out of its count
//   auto-free (C-06) the firm screens with the free Treasury connection and its own connector: a due investor is
//             re-screened through the Treasury connection alone when the console loads, with no click: one change-log entry
//             "Re-screened automatically", the next date moved by the firm's interval, the own connector's result kept and
//             the connector never called; with only the own connector and team screening on, nothing runs and the
//             investor stays due with "Run now"
//   once      loads at once while a run is going start one run; reloading right after screens nobody again; a run that
//             got no answer is tried once for its due date and writes nothing (the investor stays due with "Run now")
//   preview-desktop, preview-phone  the owner's preview (framed, connect-src none, no server) at 1280x800 and at 390x844
//             with touch, an investor due for re-screening: the frame refuses a fetch; nothing runs by itself; no refused
//             connection is recorded; no raw error; "Run now" re-screens with the firm's sandbox connection as before
//   NODE_PATH=$(npm root -g) node monitoring.js [--only alert,hold-only,monitored-not-due,package-not-run,kyc-buttons,auto-free,once,preview-desktop,preview-phone]
// The last line is "MONITORING: PASS (parts run: N)" or "MONITORING: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const F = require('./frame.js');
const W = require('./doubles/world.js');
const Lib = F.Lib;

// The integration server runs in this process: a call it makes to anywhere outside this machine, other than through the
// world's fetch, is refused here and kept, so every part can prove none was made.
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
const SHOTS = path.join(Lib.OUT, 'monitoring-shots');
fs.mkdirSync(SHOTS, { recursive: true });
Lib.describeShots([
  ['alert-kyc-held.png', 'The console\'s AML/KYC page opened again after a monitoring alert: the investor reads "Needs review", with no button pressed.'],
  ['alert-kyc-details.png', 'The same investor\'s details: the potential match with the listed name the alert carried.'],
  ['alert-overview.png', 'The console\'s Overview after the alert: "1 investor held for review by automated verification".'],
  ['preview-desktop-overview.png', 'The owner\'s preview (no server) at 1280x800: the Overview with an investor due for re-screening and "Run now", as before; nothing ran by itself.'],
  ['preview-desktop-kyc.png', 'The owner\'s preview at 1280x800: the AML/KYC page after "Run now" re-screened with the sandbox connection.'],
  ['preview-phone-overview.png', 'The owner\'s preview at 390x844 with touch: the Overview with "Run now", as before.'],
  ['preview-phone-kyc.png', 'The owner\'s preview at 390x844 with touch: the AML/KYC page after "Run now".']
]);

const WHO = { first: 'Odalys', last: 'Vantongeren', email: 'odalys.vantongeren@example.net' };
const LISTED = 'VANTONGEREN, Odalys Marisa';
const HELD_LINE = '1 investor held for review by automated verification';
const STAND_IN_SECRET = W.STAND_IN.IDCHECK_WEBHOOK_SECRET;

/* ---------- the taxpayer number the walk types (plan-check W3) ---------- */
// The taxpayer number phase 6's walk types (lib.js walk: a.tin || '123456789'); read from that file, never typed here.
const TIN = (() => {
  const src = fs.readFileSync(path.join(Lib.ROOT, '.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js'), 'utf8');
  const m = src.match(/#ob-tin', a\.tin \|\| '(\d{9})'/);
  return m ? m[1] : '';
})();
const holdsTin = (text) => !!TIN && String(text || '').indexOf(TIN) >= 0;
/** The scan proved before it is relied on: a planted copy of a file holding the number is caught. */
function tinProof(check) {
  const plant = path.join(path.dirname(Lib.OUT), `monitoring-planted-${process.pid}.txt`);
  fs.writeFileSync(plant, `planted copy: ${TIN}\n`);
  check('the taxpayer-number scan finds the number in a planted copy of a file', TIN.length === 9 && holdsTin(fs.readFileSync(plant, 'utf8')));
  fs.rmSync(plant, { force: true });
}
/** Everything this process prints from now until stop(), which restores the output and resolves to the text. */
function capture() {
  let printed = '';
  let on = true;
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  process.stdout.write = (c, ...a) => {
    printed += String(c);
    return out(c, ...a);
  };
  process.stderr.write = (c, ...a) => {
    printed += String(c);
    return err(c, ...a);
  };
  return {
    stop: () => {
      if (on) {
        process.stdout.write = out;
        process.stderr.write = err;
        on = false;
      }
      return printed;
    }
  };
}
/** A part's record of what it kept (counts only), written where the gate keeps its outputs; resolves to its path. */
function writeRecord(partName, counts) {
  const f = path.join(path.dirname(Lib.OUT), `monitoring-${partName}.txt`);
  fs.writeFileSync(f, [`MONITORING ${partName} part, ${new Date().toISOString()}`].concat(Object.keys(counts).map((k) => `${k} ${counts[k]}`)).join('\n') + '\n');
  return f;
}
function tinChecks(check, C, printed, files) {
  check('the typed taxpayer number is in no world record', C.w.calls.length > 0 && !holdsTin(JSON.stringify(C.w.calls)));
  check('the typed taxpayer number is in no server output (event log, anything this process printed)', !holdsTin(JSON.stringify(C.srv.server.store.list('events'))) && !holdsTin(printed));
  check(`the typed taxpayer number is in no file this part writes (${files.length})`, files.length > 0 && files.every((f) => !holdsTin(fs.readFileSync(f, 'latin1'))));
}

/* ---------- the world, with the Treasury lists ---------- */
// The address the free Treasury connection downloads its lists from, read from the provider itself (never typed here).
const TREASURY = (() => {
  const src = fs.readFileSync(path.join(Lib.ROOT, 'server/providers/ofac.mjs'), 'utf8');
  const m = src.match(/const BASE = '([^']+)'/);
  return m ? new URL(m[1]) : null;
})();
// Stand-in lists in the files' own layout (as server/test/core.test.mjs writes them): nobody this check invites is on them.
const LISTS = {
  'SDN.CSV': '10001,"VOLKOV, Dmitri Sergeyevich","individual","RUSSIA-EO14024",-0-,-0-,-0-,-0-,-0-,-0-,-0-,"DOB 01 Jan 1970"\r\n10002,"OCEANIC TRADING LLC","-0-","SDGT",-0-,-0-,-0-,-0-,-0-,-0-,-0-,-0-\r\n',
  'ALT.CSV': '10001,501,"aka","VOLKOV, Dmitry",-0-\r\n',
  'CONS_PRIM.CSV': '20001,"KASPIAN SHIPPING COMPANY","-0-","SSI",-0-,-0-,-0-,-0-,-0-,-0-,-0-,-0-\r\n',
  'CONS_ALT.CSV': ''
};
/** A world (doubles/world.js) whose fetch also answers the Treasury list files, each kept as { kind: 'treasury', file }. */
function treasuryWorld() {
  const w = W.world();
  const inner = w.fetch;
  w.hold = 0; // milliseconds the lists take to answer
  w.failLists = false; // the list service does not answer
  w.fetch = async (input, init) => {
    const u = new URL(String(input && input.url ? input.url : input));
    if (TREASURY && u.protocol === 'https:' && u.hostname === TREASURY.hostname) {
      const file = u.pathname.split('/').pop();
      w.calls.push({ at: Date.now(), kind: 'treasury', file });
      if (w.hold) await new Promise((r) => setTimeout(r, w.hold));
      if (w.failLists) return { ok: false, status: 503, text: async () => '' };
      const body = Object.prototype.hasOwnProperty.call(LISTS, file) ? LISTS[file] : null;
      return { ok: body !== null, status: body !== null ? 200 : 404, text: async () => body || '' };
    }
    return inner(input, init);
  };
  /** How many times the lists were read (each read asks for the SDN file once). */
  w.listReads = () => w.calls.filter((c) => c.kind === 'treasury' && c.file === 'SDN.CSV').length;
  /** Calls to the package's identity check provider (sessions, decisions and its screenings). */
  w.packageCalls = () => w.calls.filter((c) => ['session', 'decision', 'screening'].indexOf(c.kind) >= 0).length;
  return w;
}
/** The Treasury connection keeps its lists for a day in memory: every part starts with none kept. */
async function forgetLists() {
  const ofac = await import(require('url').pathToFileURL(path.join(Lib.ROOT, 'server/providers/ofac.mjs')).href);
  ofac._setList(null);
}

/** A monitoring alert for one screening record, signed as server/test/idcheck.test.mjs signs one; resolves to the HTTP status. */
async function alert(base, screeningId, listed) {
  const fx = W.fixture('idcheck', 'webhook-new-hit').reply;
  const ts = Math.floor(Date.now() / 1000);
  const body = Object.assign(JSON.parse(JSON.stringify(fx)), { event_id: `evt-monitoring-${crypto.randomUUID()}`, timestamp: ts, created_at: ts, vendor_data: screeningId, decision: { aml_screenings: [{ status: 'In Review', hits: [{ match_score: 93, risk_score: 75, caption: listed }] }] } });
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', STAND_IN_SECRET).update(`${ts}.${raw}`).digest('hex');
  const res = await ownFetch(`${base}/webhooks/idcheck`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Timestamp': String(ts), 'X-Signature-V2': sig }, body: raw });
  return res.status;
}

/* ---------- the console on a sponsor account ---------- */
/** The console on a sponsor account of the real server, wired to a fresh world. opts: { view, exemption }. */
async function boot(S, check, opts) {
  opts = opts || {};
  await forgetLists();
  const w = treasuryWorld();
  const srv = await W.startServer(S, w, { dir: Lib.OUT });
  const A = await Lib.open(S, { allow: [srv.base], init: srv.init, context: Object.assign({}, F.VIEW[opts.view || 'desktop']) });
  // Every click the person makes in the console (trusted events only), counted from each page's start.
  await A.context.addInitScript(() => {
    window.__clicks = 0;
    document.addEventListener('click', (e) => e.isTrusted && window.__clicks++, true);
  });
  const C = { S, w, srv, A, cp: A.page, investors: [], posts: [], pulls: 0, closers: [() => A.context.close()] };
  // Every time the console asks the server which checks changed.
  A.page.on('request', (req) => {
    if (/\/v1\/checks\/changed\?/.test(req.url())) C.pulls++;
  });
  // Every screening the console asks the server for, by the connector it names (nothing else from the body is kept).
  A.page.on('request', (req) => {
    if (req.method() !== 'POST' || !/\/v1\/screenings$/.test(req.url().replace(/[?#].*$/, ''))) return;
    let provider = '';
    try {
      provider = String(JSON.parse(req.postData() || '{}').provider || '');
    } catch (e) {
      provider = '?';
    }
    C.posts.push(provider);
  });
  C.close = async () => {
    for (const c of C.closers.reverse()) await c().catch(() => {});
    await srv.close().catch(() => {});
  };
  try {
    C.off = await Lib.setupPortal(S, A, { exemption: opts.exemption || 'Rule 506(b)' });
    check('the console uses the integration server with the sponsor account\'s token', (await srv.configure(A.page)) === true);
    // An address only saved (never checked on the Integrations page) is never asked anything by the console itself.
    await reopen(C);
    await A.page.waitForTimeout(1500);
    check('with the server\'s address only saved, the console asks it nothing by itself', C.pulls === 0, C.pulls);
    // The sponsor confirms the server as the Integrations page asks: "Check connection".
    await Lib.consoleRoute(A.page, 'console-integrations', '[data-action=iv-check]');
    await A.page.click('[data-action=iv-check]');
    const ok = await A.page
      .waitForFunction(() => /^Connected/.test(window.CVPortal.integrations.ensure(window.CVPortal.state.ws).server.status || ''), null, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    check('"Check connection" on the Integrations page confirms the server', ok, await A.page.evaluate(() => window.CVPortal.integrations.ensure(window.CVPortal.state.ws).server.status));
  } catch (e) {
    await C.close();
    throw e;
  }
  return C;
}

/** The console invites `who` to the raising offering with the package box ticked; resolves to the invitation. */
async function sendPackage(C, check, who) {
  const p = C.cp;
  await Lib.consoleRoute(p, 'console-investors', '[data-action=invite-toggle]');
  if ((await p.locator('#iv-email').count()) === 0) await p.click('[data-action=invite-toggle]');
  await p.waitForSelector('#iv-email', { timeout: 10000 });
  await p.fill('#iv-contact', who.first);
  await p.fill('#iv-last', who.last);
  await p.fill('#iv-email', who.email);
  if (!(await p.locator('#iv-more[open]').count())) await p.click('#iv-more summary');
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
    return { id: x.id, serverId: x.serverId || '', link: x.link || '', investorId: inv.id, title: inv.title };
  }, who.email);
  if (await p.evaluate(() => !!(document.getElementById('dlg') || {}).open)) await p.click('#dlg [data-action=close-dialog]').catch(() => {});
  check('the invitation went to the server with the package box ticked', /^ivt_/.test(it.serverId) && !!it.link, it);
  return it;
}

/** "Verify my identity" pressed on the investor's page; the new tab the check opens is closed once it has gone. */
async function startCheck(B, ip) {
  const popup = B.context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  await ip.click('#iv-identity [data-action=iv-start]');
  const tab = await popup;
  await ip.waitForTimeout(800);
  if (tab && !tab.isClosed()) await tab.close().catch(() => {});
  return !!tab;
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

/**
 * A package investor brought into the console cleared, as package-flow.js part identity does: invited with the package
 * box ticked, the investor's own browser walks the link, verifies their identity through the package (the signed status
 * delivery), finishes onboarding; the console imports. Resolves to { it, rec } (rec: the console's record of the investor).
 */
async function packageInvestor(C, check, who) {
  const it = await sendPackage(C, check, who);
  const B = await Lib.open(C.S, { allow: [C.srv.base], init: C.srv.init, context: Object.assign({}, F.VIEW.desktop) });
  C.closers.push(() => B.context.close());
  C.investors.push(B);
  const ip = B.page;
  await ip.goto(it.link);
  const wk = await Lib.walk(ip, { name: `${who.first} ${who.last}`, until: /Identity verification/ });
  check('the investor\'s own browser reaches the identity step', wk.reached && /Identity verification/.test(wk.at || '') && wk.errors.length === 0, wk);
  check('"Verify my identity" opens the check in a new tab', await startCheck(B, ip));
  const code = await C.w.deliver(C.srv.base, C.w.sessions[0], 'Approved');
  const ok = await ip
    .waitForFunction(() => /Verified/.test(((document.querySelector('#iv-identity .iv-chip') || {}).textContent || '')), null, { timeout: 45000 })
    .then(() => true)
    .catch(() => false);
  check('the signed status delivery arrives and the step reads Verified', code === 200 && ok, { code, ok });
  await Lib.submit(ip);
  const rest = await Lib.walk(ip, { name: `${who.first} ${who.last}` });
  check('the investor walks on to the agreement with no field error', rest.reached && rest.errors.length === 0, rest);
  const done = await Lib.finishAgreement(ip).catch((e) => `NOT FINISHED: ${e.message}`);
  check('the investor finishes onboarding', !/^NOT FINISHED/.test(done), done);
  check('the server holds the completed submission', !!(await completed(C, it.serverId)));
  await Lib.importFromConsole(C.cp, it.id);
  const rec = await record(C.cp, it.investorId);
  check('the console\'s record: identity passed, screening clear on the server\'s own screening record, investor approved', !!rec && rec.identity === 'passed' && rec.aml === 'clear' && rec.results.length === 1 && /^scr_/.test(rec.results[0].ref) && rec.results[0].connection === 'package-id' && rec.decision === 'approved', rec);
  return { it, rec };
}

/** The console's record of one investor, read without changing it. */
const record = (p, id) =>
  p.evaluate((id) => {
    const NS = window.CVPortal;
    const inv = NS.state.ws.investors.find((x) => x.id === id);
    if (!inv) return null;
    const v = NS.integrations.peek(inv);
    return { title: inv.title, identity: v.identity.status, aml: v.aml.status, nextScreen: v.aml.nextScreen || '', results: (v.aml.results || []).map((r) => ({ connection: r.connection, how: r.how, status: r.status, ref: r.ref || '', monitoring: !!r.monitoring, hits: (r.hits || []).map((x) => x.listed || x.name) })), decision: v.decision.status, kyc: (inv.kyc || {}).status || '' };
  }, id);
/** The change log's entries of one action. */
const auditOf = (p, action) => p.evaluate((action) => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === action).map((e) => ({ record: e.record, detail: e.detail })), action);
/** The Overview's attention list, item by item. */
async function attention(p) {
  await Lib.consoleRoute(p, 'console', '.cs-panel-head h2');
  return p.evaluate(() => {
    const h = Array.from(document.querySelectorAll('.cs-panel-head h2')).find((x) => /Needs attention/.test(x.textContent));
    const panel = h && h.closest('.cs-panel');
    return panel ? Array.from(panel.querySelectorAll('li')).map((li) => li.innerText.replace(/\s+/g, ' ').trim()) : [];
  });
}
/** The investor's row on the AML/KYC page as it opens (no tab pressed): its status cell and screening cell. */
async function kycRowAsOpened(p, title) {
  await p.evaluate(() => (location.hash = 'console-kyc'));
  await p.waitForSelector('[data-action=kyc-tab]', { timeout: 20000 });
  await p.waitForTimeout(300);
  return p.evaluate((title) => {
    const tr = Array.from(document.querySelectorAll('table.cs-tbl tbody tr')).find((r) => {
      const td = r.querySelector('td[data-label=Investor]');
      return td && td.innerText.indexOf(title) === 0;
    });
    if (!tr) return null;
    const cell = (l) => ((tr.querySelector(`td[data-label="${l}"]`) || {}).innerText || '').replace(/\s+/g, ' ').trim();
    return { status: cell('Status'), screening: cell('Screening'), text: tr.innerText.replace(/\s+/g, ' ').trim() };
  }, title);
}
/** The console's page opened again (a reload of what the sponsor has open), back on the Overview. */
async function reopen(C) {
  await C.cp.reload();
  await C.cp.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 20000 });
  await Lib.consoleRoute(C.cp, 'console', '.cs-panel-head h2');
}
/** Until the investor's decision reads `status` in the console (the console's own pull; nothing pressed), or the time is up. */
const waitDecision = (p, id, status, ms) =>
  p
    .waitForFunction(
      ({ id, status }) => {
        const NS = window.CVPortal;
        const inv = NS.state.ws.investors.find((x) => x.id === id);
        return !!inv && NS.integrations.peek(inv).decision.status === status;
      },
      { id, status },
      { timeout: ms || 20000 }
    )
    .then(() => true)
    .catch(() => false);
function worldClean(check, C) {
  check('no call left this machine outside the stand-in world (the outside-call record is empty)', outside.length === 0, outside);
  check('the stand-in world was asked for nothing but the providers\' own calls', C.w.count('other') === 0, C.w.calls.filter((c) => c.kind === 'other'));
}

/* ---------- investors on file, as an import leaves them ---------- */
const OWN = 'ownscreen'; // the sponsor's own (paid) screening connector on the server: never called by these parts
const OWN_CONN = { id: 'own-screen', name: 'Own screening service', type: 'server', connector: OWN, checks: ['aml'] };
const daysFrom = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
/**
 * Writes the firm's screening connections (use: the ids on for screening; own: the sponsor's own connector added) and
 * investors on file into the console (sample investors by index), each approved and screened earlier through the given
 * connections: spec.investors = [{ index, results: [{ connection, via, how, ref, monitoring }], next, rawNext }] (next: the
 * re-screen date; rawNext: written after the console's own bookkeeping, as an import may leave it). Resolves to
 * [{ id, title, contact }].
 */
const seed = (p, spec) =>
  p.evaluate(
    ({ spec, own }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const I = NS.integrations;
      const c = I.ensure(ws);
      if (spec.own && !c.connections.some((x) => x.id === own.id)) c.connections.push(Object.assign({}, own));
      if (spec.use) c.use.aml = spec.use.slice();
      const on = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
      const out = (spec.investors || []).map((s) => {
        const inv = ws.investors[s.index];
        const names = Array.from(new Set([inv.contact, inv.title].map((n) => String(n || '').trim()).filter(Boolean)));
        const pkg = s.results.some((r) => /^package-/.test(r.connection));
        inv.verify = {
          identity: pkg ? { status: 'passed', connection: 'package-id', via: 'Identity check', how: 'server', remote: true, ref: `ver_seed${s.index}`, completedAt: `${on}T10:00:00Z` } : { status: 'passed', connection: 'sandbox', via: 'Sandbox', how: 'sandbox', ref: `sbx_seed${s.index}`, completedAt: `${on}T10:00:00Z` },
          aml: { status: 'clear', results: s.results.map((r) => Object.assign({ status: 'clear', hits: [], screenedAt: on }, r)), names, screenedAt: on, nextScreen: s.next || '' },
          accreditation: { status: 'not_started' },
          decision: { status: 'approved', at: `${on}T10:00:01Z`, by: 'automatic', reason: 'all checks passed' }
        };
        I.syncKyc(ws, inv);
        if (s.rawNext !== undefined) {
          inv.verify.aml.nextScreen = s.rawNext;
          inv.kyc.nextReview = s.rawNext;
        }
        return { id: inv.id, title: inv.title, contact: inv.contact };
      });
      NS.app.save(true);
      return out;
    },
    { spec, own: OWN_CONN }
  );
/** The firm's screening connections on, by id. */
const useAml = (p, ids) =>
  p.evaluate((ids) => {
    const NS = window.CVPortal;
    NS.integrations.ensure(NS.state.ws).use.aml = ids.slice();
    NS.app.save(true);
  }, ids);
/** Until the console's own GET /v1/checks/changed answered (started by `go`); resolves to its JSON, or null. */
async function pulled(C, go) {
  const res = C.cp.waitForResponse((r) => /\/v1\/checks\/changed\?/.test(r.url()) && r.request().method() === 'GET', { timeout: 30000 }).catch(() => null);
  await go();
  const r = await res;
  const body = r ? await r.json().catch(() => null) : null;
  await C.cp.waitForTimeout(800); // what the console does with the answer
  return body;
}
/** The attention list's re-screening line ('' when there is none). */
const rescreenLine = (items) => items.find((x) => /due for re-screening/.test(x)) || '';
/**
 * The first toast the console raises after `act` (a press), recorded in the page the moment it is added: a toast already on
 * screen is never taken for it (Lib.consoleRoute's "Signed in as" toast stays 4.2 s), and one gone before the check reads
 * it is still read. The console raises the toast of "Run now", "Re-screen" and "Re-screen N due" only after writing the
 * records it re-screened, so a record read after it reads what was written. Resolves to its text, or null when none came.
 */
async function toastAfter(p, act) {
  await p.evaluate(() => {
    if (window.__toastWatch) window.__toastWatch.disconnect();
    const added = (window.__toastsAdded = []);
    window.__toastWatch = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => n.classList && n.classList.contains('toast') && added.push(n.textContent))));
    window.__toastWatch.observe(document.getElementById('toasts'), { childList: true });
  });
  await act();
  const h = await p.waitForFunction(() => (window.__toastsAdded.length ? window.__toastsAdded[0] : false), null, { timeout: 30000 }).catch(() => null);
  const text = h ? String(await h.jsonValue()).trim() : null;
  await p.evaluate(() => window.__toastWatch && window.__toastWatch.disconnect()).catch(() => {});
  return text;
}
/** "Run now" on the Overview pressed (tapped on a phone); resolves to the toast it raised. */
async function runNow(p, tap) {
  const link = p.locator('[data-action=iv-rescreen]').first();
  const text = await toastAfter(p, () => (tap ? link.tap() : link.click()));
  if (text === null) throw new Error('"Run now" raised no toast within 30 s');
  return text;
}
/** A button on the AML/KYC page pressed (sel); resolves to the toast it raised ('' when none). */
async function kycPress(p, sel) {
  await Lib.consoleRoute(p, 'console-kyc', '[data-action=kyc-tab]');
  return (await toastAfter(p, () => p.locator(sel).first().click())) || '';
}
/** The "Re-screen N due" button's text on the AML/KYC page ('' when it is not offered). */
async function dueButton(p) {
  await Lib.consoleRoute(p, 'console-kyc', '[data-action=kyc-tab]');
  const b = p.locator('[data-action=kyc-screen-due]');
  return (await b.count()) ? (await b.first().innerText()).trim() : '';
}
/** The console's sentence when a package investor cannot be re-screened (no free Treasury connection on). */
const NO_FREE = (title) => `${title} was screened through the verification package, so only the free U.S. Treasury connection can re-screen them: turn it on in Integrations.`;
/** Lines that read as an error, on the console's Overview attention list and the AML/KYC page. */
const ERROR_RE = /error|could not|failed|not set up|answered \d|integration server/i;
async function errorLines(p) {
  const items = await attention(p);
  await Lib.consoleRoute(p, 'console-kyc', '[data-action=kyc-tab]');
  const kyc = await Lib.screenText(p);
  return items.concat(kyc.split('\n')).filter((l) => ERROR_RE.test(l) || F.RAW_WORDS.some((w) => l.indexOf(w) >= 0)).map((l) => l.trim().slice(0, 160));
}

/* ---------- the parts ---------- */
const PARTS = {
  /** D-04: an alert reaches a person. */
  async alert({ check, S }) {
    tinProof(check);
    const cap = capture();
    let printed = '';
    const C = await boot(S, check);
    try {
      const { it, rec } = await packageInvestor(C, check, WHO);
      const scr = rec.results[0].ref;
      check('before the alert: no "Monitoring alert" in the change log', (await auditOf(C.cp, 'Monitoring alert')).length === 0);
      const code = await alert(C.srv.base, scr, LISTED);
      check('the signed new-hit alert is accepted by the server and holds its screening record', code === 200 && (C.srv.server.store.get('screenings', scr) || {}).status === 'potential_match', { code, status: (C.srv.server.store.get('screenings', scr) || {}).status });
      await reopen(C);
      const held = await waitDecision(C.cp, it.investorId, 'review', 30000);
      const now = await record(C.cp, it.investorId);
      check('with nothing pressed, the console holds the investor for review with the alert\'s hit', held && now.aml === 'potential_match' && now.results[0].hits.indexOf(LISTED) >= 0, now);
      const row = await kycRowAsOpened(C.cp, it.title);
      await C.cp.screenshot({ path: path.join(SHOTS, 'alert-kyc-held.png') });
      check('the AML/KYC page reads "Needs review" for the investor', !!row && /Needs review/.test(row.status) && /Potential match/.test(row.screening), row);
      check('no click was made between the alert and reading "Needs review"', (await C.cp.evaluate(() => window.__clicks)) === 0, await C.cp.evaluate(() => window.__clicks));
      await C.cp.click(`button[data-action=kyc-open][data-id="${it.investorId}"]`);
      await C.cp.waitForSelector('tr.kyc-detail', { timeout: 10000 });
      const det = await C.cp.evaluate(() => document.querySelector('tr.kyc-detail').innerText.replace(/\s+/g, ' ').trim());
      await C.cp.screenshot({ path: path.join(SHOTS, 'alert-kyc-details.png') });
      check('the details name the hit\'s listed name', det.indexOf(`listed name “${LISTED}”`) >= 0, det.slice(0, 600));
      const items = await attention(C.cp);
      await C.cp.screenshot({ path: path.join(SHOTS, 'alert-overview.png') });
      check(`the Overview's attention list reads "${HELD_LINE}"`, items.indexOf(HELD_LINE) >= 0, items);
      const log = await auditOf(C.cp, 'Monitoring alert');
      check('the change log holds exactly one "Monitoring alert", naming the investor', log.length === 1 && log[0].record === it.investorId && log[0].detail.indexOf(it.title) === 0, log);
      const screens = (await Lib.screenText(C.cp)) + '\n' + det;
      F.leakFree(check, 'the console screens of this part', screens);
      worldClean(check, C);
      check('no script error in the console', C.A.errors.length === 0, C.A.errors);
      printed = cap.stop();
      const file = writeRecord('alert', { 'world calls': C.w.calls.length, 'monitoring alerts in the change log': log.length });
      tinChecks(check, C, printed, [file]);
    } finally {
      cap.stop();
      await C.close();
    }
  },

  /** T-08-24: a pull from the server only holds; a person's approval with a note still clears. */
  async 'hold-only'({ check, S }) {
    const C = await boot(S, check);
    try {
      const inv0 = await C.cp.evaluate(() => {
        const i = window.CVPortal.state.ws.investors[0];
        return { id: i.id, contact: i.contact };
      });
      // A screening record of the package on the server for this investor (the operator's shared token, as an investor's
      // link would start it), enrolled in monitoring; the console's record holds it clear.
      const made = await C.srv.call('POST', '/v1/screenings', { provider: 'idcheck', investor: { id: inv0.id, workspace: 'kestrel-bay' }, names: [inv0.contact] }, C.srv.shared);
      check('the package screening record exists on the server, clear and monitored', made.status === 200 && made.body.status === 'clear' && C.srv.server.store.get('screenings', made.body.id).monitoring === true, made.body);
      const scr = made.body.id;
      const [who] = await seed(C.cp, { investors: [{ index: 0, results: [{ connection: 'package-id', via: 'Identity check', how: 'server', ref: scr, monitoring: true }] }] });
      check('the seeded investor is approved', (await record(C.cp, who.id)).decision === 'approved');
      check('the signed new-hit alert is accepted', (await alert(C.srv.base, scr, 'HOLDFAST, Emre')) === 200);
      await reopen(C);
      check('the console holds the investor for review on its own', await waitDecision(C.cp, who.id, 'review', 30000), await record(C.cp, who.id));
      // The server's record later reads clear (as a re-read could leave it): the console must not clear the investor.
      C.srv.server.store.put('screenings', { id: scr, status: 'clear', hits: [], changedAt: new Date().toISOString() });
      const body = await pulled(C, () => reopen(C));
      const listed = body && Array.isArray(body.checks) ? body.checks.find((c) => c.id === scr) : null;
      check('the console\'s next pull lists the record as clear', !!listed && listed.status === 'clear', body);
      let now = await record(C.cp, who.id);
      check('a server record that reads clear does not clear the held investor', now.decision === 'review' && now.aml === 'potential_match' && now.results[0].status === 'potential_match', now);
      // A person approves with a note on the AML/KYC page.
      await Lib.consoleRoute(C.cp, 'console-kyc', '[data-action=kyc-tab]');
      await C.cp.click(`button[data-action=kyc-open][data-id="${who.id}"]`);
      await C.cp.waitForSelector('#kyc-note', { timeout: 10000 });
      await C.cp.fill('#kyc-note', 'Compared date of birth and nationality: not the listed person.');
      await C.cp.locator('#kyc-note').dispatchEvent('change');
      await C.cp.click(`[data-action=kyc-iv-approve][data-id="${who.id}"]`);
      await C.cp.waitForTimeout(500);
      now = await record(C.cp, who.id);
      check('a person\'s approval with a note on the AML/KYC page clears the investor', now.decision === 'approved' && now.aml === 'clear', now);
      await pulled(C, () => reopen(C));
      now = await record(C.cp, who.id);
      check('opened again, the person\'s approval stands', now.decision === 'approved' && now.aml === 'clear', now);
      check('one "Monitoring alert" and one approval after review in the change log', (await auditOf(C.cp, 'Monitoring alert')).length === 1 && (await auditOf(C.cp, 'Investor approved after review')).length === 1);
      worldClean(check, C);
      check('no script error in the console', C.A.errors.length === 0, C.A.errors);
    } finally {
      await C.close();
    }
  },

  /** A package investor whose screening is monitored has no calendar re-screen: not due, never offered "Run now". */
  async 'monitored-not-due'({ check, S }) {
    const C = await boot(S, check);
    try {
      // Investor 0: screened through the package and monitored, with the date an import's cap leaves (40 days ago, so long
      // past); investor 1: screened by the firm's sandbox connection, due yesterday.
      const [mon, other] = await seed(C.cp, {
        investors: [
          { index: 0, results: [{ connection: 'package-id', via: 'Identity check', how: 'server', ref: 'scr_seedmonitored', monitoring: true }], rawNext: daysFrom(-10) },
          { index: 1, results: [{ connection: 'sandbox', via: 'Sandbox', how: 'sandbox', ref: 'sbx_seedother' }], next: daysFrom(-1) }
        ]
      });
      await pulled(C, () => reopen(C));
      let r0 = await record(C.cp, mon.id);
      const kyc0 = await C.cp.evaluate((id) => (window.CVPortal.state.ws.investors.find((x) => x.id === id).kyc || {}).nextReview || '', mon.id);
      check('the monitored investor has no next re-screen date (nor a next review on the AML/KYC record)', r0.nextScreen === '' && kyc0 === '', { nextScreen: r0.nextScreen, nextReview: kyc0 });
      const dueIds = () => C.cp.evaluate(() => window.CVPortal.integrations.due(window.CVPortal.state.ws).rescreen.map((i) => i.id));
      check('only the other investor counts as due for re-screening', JSON.stringify(await dueIds()) === JSON.stringify([other.id]), await dueIds());
      let items = await attention(C.cp);
      check('the Overview offers "Run now" for one investor', rescreenLine(items) === '1 investor is due for re-screening. Run now', items);
      const before = JSON.stringify(r0.results);
      const toast = await runNow(C.cp);
      r0 = await record(C.cp, mon.id);
      const r1 = await record(C.cp, other.id);
      check('"Run now" re-screens the other investor only', /^1 investor re-screened/.test(toast) && r1.nextScreen > daysFrom(0) && JSON.stringify(r0.results) === before, { toast, other: r1.nextScreen, same: JSON.stringify(r0.results) === before });
      // Whatever the date: an old date left on the record still makes nobody due.
      await C.cp.evaluate((id) => {
        const NS = window.CVPortal;
        NS.state.ws.investors.find((x) => x.id === id).verify.aml.nextScreen = '2020-01-01';
      }, mon.id);
      items = await attention(C.cp);
      check('with any date on the record, the monitored investor is not due and "Run now" is not offered', JSON.stringify(await dueIds()) === '[]' && rescreenLine(items) === '', { due: await dueIds(), line: rescreenLine(items) });
      // The screening itself sets no next date when every result is monitored (and one when it is not).
      const stub = await F.stubServer(C.A.context, C.srv.base, { 'POST /v1/screenings': () => ({ status: 200, body: { id: 'scr_stubmon', status: 'clear', hits: [], screened: 1, monitoring: true } }) });
      await seed(C.cp, { use: ['own-screen'], own: true, investors: [] });
      const third = await C.cp.evaluate(async () => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const inv = ws.investors[2];
        await NS.integrations.screen(ws, inv);
        return { id: inv.id, next: inv.verify.aml.nextScreen, monitoring: inv.verify.aml.results.map((r) => !!r.monitoring), review: inv.kyc.nextReview || '' };
      });
      check('a screening whose every result is monitored sets no next re-screen date', third.next === '' && third.review === '' && third.monitoring.join() === 'true', third);
      stub.set('POST /v1/screenings', () => ({ status: 200, body: { id: 'scr_stubplain', status: 'clear', hits: [], screened: 1, monitoring: false } }));
      const fourth = await C.cp.evaluate(async () => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const inv = ws.investors[3];
        await NS.integrations.screen(ws, inv);
        return { next: inv.verify.aml.nextScreen, monitoring: inv.verify.aml.results.map((r) => !!r.monitoring) };
      });
      check('a screening that is not monitored keeps the firm\'s interval', fourth.next === daysFrom(30) && fourth.monitoring.join() === 'false', fourth);
      check('the stand-in answered the two screenings and nothing else', stub.calls.length === 2, stub.calls.length);
      worldClean(check, C);
      check('no script error in the console', C.A.errors.length === 0, C.A.errors);
    } finally {
      await C.close();
    }
  },

  /** G4, T-08-56: "Run now" for a package investor never reaches the package provider. */
  async 'package-not-run'({ check, S }) {
    const C = await boot(S, check);
    try {
      await pulled(C, () => reopen(C)); // the console's own pass at load has run; what follows is the person's click
      // A: the firm's screening uses the free Treasury connection and its own connector.
      const [pk] = await seed(C.cp, { use: ['ofac', 'own-screen'], own: true, investors: [{ index: 0, results: [{ connection: 'package-id', via: 'Identity check', how: 'server', ref: 'scr_seedpackage', monitoring: false }], next: daysFrom(-1) }] });
      const errorsBefore = await errorLines(C.cp);
      let items = await attention(C.cp);
      check('with the Treasury connection on, the package investor is offered "Run now"', rescreenLine(items) === '1 investor is due for re-screening. Run now', items);
      const toast = await runNow(C.cp);
      const r = await record(C.cp, pk.id);
      check('"Run now" re-screened them', /^1 investor re-screened/.test(toast), toast);
      check('through the Treasury connection only: one list read, one screening asked of the server, for the Treasury lists', C.w.listReads() === 1 && JSON.stringify(C.posts) === JSON.stringify(['ofac']), { reads: C.w.listReads(), posts: C.posts });
      check('the package provider was never called (the world records no session, decision or screening)', C.w.packageCalls() === 0, C.w.calls.map((c) => c.kind));
      check('the package result is kept as it was, the Treasury result is added, the next date moved', r.results.length === 2 && r.results[0].connection === 'package-id' && r.results[0].ref === 'scr_seedpackage' && r.results[1].connection === 'ofac' && r.results[1].status === 'clear' && r.aml === 'clear' && r.nextScreen === daysFrom(30), r);
      let errorsAfter = await errorLines(C.cp);
      check('no error text appears on the Overview or the AML/KYC page', errorsAfter.filter((l) => errorsBefore.indexOf(l) < 0).length === 0, errorsAfter.filter((l) => errorsBefore.indexOf(l) < 0));
      // B: no Treasury connection (the firm's sandbox only): the package investor is left out of "Run now".
      await useAml(C.cp, ['sandbox']);
      const [pk2] = await seed(C.cp, { investors: [{ index: 1, results: [{ connection: 'package-id', via: 'Identity check', how: 'server', ref: 'scr_seedpackage2', monitoring: false }], next: daysFrom(-1) }] });
      items = await attention(C.cp);
      check('with no Treasury connection, the package investor is left out of "Run now" (no line at all)', rescreenLine(items) === '', items);
      const [plain] = await seed(C.cp, { investors: [{ index: 2, results: [{ connection: 'sandbox', via: 'Sandbox', how: 'sandbox', ref: 'sbx_seedplain' }], next: daysFrom(-1) }] });
      items = await attention(C.cp);
      check('with another investor due, "Run now" counts that one only', rescreenLine(items) === '1 investor is due for re-screening. Run now', items);
      const before2 = JSON.stringify((await record(C.cp, pk2.id)).results);
      await runNow(C.cp);
      const r2 = await record(C.cp, pk2.id);
      const r3 = await record(C.cp, plain.id);
      check('"Run now" re-screens the other investor and leaves the package investor as it was', JSON.stringify(r2.results) === before2 && r3.nextScreen === daysFrom(30), { same: JSON.stringify(r2.results) === before2, other: r3.nextScreen });
      check('nothing was called for the package investor: no list read, no screening asked of the server, no package provider call', C.w.listReads() === 1 && C.posts.length === 1 && C.w.packageCalls() === 0, { reads: C.w.listReads(), posts: C.posts, calls: C.w.packageCalls() });
      errorsAfter = await errorLines(C.cp);
      check('still no error text on the Overview or the AML/KYC page', errorsAfter.filter((l) => errorsBefore.indexOf(l) < 0).length === 0, errorsAfter.filter((l) => errorsBefore.indexOf(l) < 0));
      worldClean(check, C);
      check('no script error in the console', C.A.errors.length === 0, C.A.errors);
    } finally {
      await C.close();
    }
  },

  /** 08-CONTEXT "After 08-08": "Re-screen" and "Re-screen N due" on the AML/KYC page follow the package rule of "Run now". */
  async 'kyc-buttons'({ check, S }) {
    const C = await boot(S, check);
    try {
      await pulled(C, () => reopen(C)); // the console's own pass at load has run; what follows is the person's click
      const pkg = (ref) => [{ connection: 'package-id', via: 'Identity check', how: 'server', ref, monitoring: false }];
      // A: the free Treasury connection and the sponsor's own connector on; "Re-screen" on a due package investor's row.
      const [pk] = await seed(C.cp, { use: ['ofac', 'own-screen'], own: true, investors: [{ index: 0, results: pkg('scr_seedpackage'), next: daysFrom(-1) }] });
      let reads = C.w.listReads();
      let posts = C.posts.length;
      let toast = await kycPress(C.cp, `[data-action=kyc-screen][data-id="${pk.id}"]`);
      const r = await record(C.cp, pk.id);
      check('"Re-screen" re-screens the package investor through the Treasury connection alone: one list read, one screening asked of the server, for the Treasury lists', C.w.listReads() - reads === 1 && JSON.stringify(C.posts.slice(posts)) === JSON.stringify(['ofac']), { reads: C.w.listReads() - reads, posts: C.posts.slice(posts), toast });
      check('"Re-screen": the package result is kept, the Treasury result added, the next date moved', r.results.length === 2 && r.results[0].ref === 'scr_seedpackage' && r.results[1].connection === 'ofac' && r.results[1].status === 'clear' && r.nextScreen === daysFrom(30), r);
      check('"Re-screen" says the investor was screened', /^.+ screened: no matches\.$/.test(toast), toast);
      // B: "Re-screen N due" with a second due package investor.
      const [pk2] = await seed(C.cp, { investors: [{ index: 1, results: pkg('scr_seedpackage2'), next: daysFrom(-1) }] });
      posts = C.posts.length;
      toast = await kycPress(C.cp, '[data-action=kyc-screen-due]');
      const r2 = await record(C.cp, pk2.id);
      check('"Re-screen N due" never asks the sponsor\'s own connector', C.posts.slice(posts).indexOf(OWN) < 0, { posts: C.posts.slice(posts), toast });
      check('"Re-screen N due": the package investor through the Treasury connection, the package result kept', r2.results.length === 2 && r2.results[0].ref === 'scr_seedpackage2' && r2.results[1].connection === 'ofac' && r2.nextScreen === daysFrom(30), r2);
      check('the package provider was never called', C.w.packageCalls() === 0, C.w.calls.map((c) => c.kind));
      // C: no Treasury connection (the sponsor's own connector only).
      await useAml(C.cp, ['own-screen']);
      const [pk3] = await seed(C.cp, { investors: [{ index: 2, results: pkg('scr_seedpackage3'), next: daysFrom(-1) }] });
      const before3 = JSON.stringify((await record(C.cp, pk3.id)).results);
      reads = C.w.listReads();
      posts = C.posts.length;
      toast = await kycPress(C.cp, `[data-action=kyc-screen][data-id="${pk3.id}"]`);
      const r3 = await record(C.cp, pk3.id);
      check('with no Treasury connection, "Re-screen" calls nothing for the package investor and keeps the record', C.posts.length === posts && C.w.listReads() === reads && C.w.packageCalls() === 0 && JSON.stringify(r3.results) === before3 && r3.nextScreen === daysFrom(-1), { posts: C.posts.slice(posts), same: JSON.stringify(r3.results) === before3, next: r3.nextScreen });
      check('and says why in one sentence', toast === NO_FREE(pk3.title), toast);
      const others = await C.cp.evaluate((id) => {
        const NS = window.CVPortal;
        const O = NS.ops;
        return NS.state.ws.investors.filter((i) => i.id !== id && O.kycLabel(O.kycOf(i)).key === 'due').length;
      }, pk3.id);
      const btn = await dueButton(C.cp);
      check('"Re-screen N due" leaves the package investor out of its count', btn === (others ? `Re-screen ${others} due` : ''), { btn, others });
      worldClean(check, C);
      check('no script error in the console', C.A.errors.length === 0, C.A.errors);
    } finally {
      await C.close();
    }
  },

  /** C-06, T-08-25: the free Treasury re-screen runs by itself; a sponsor's own connector and team screening never do. */
  async 'auto-free'({ check, S }) {
    const C = await boot(S, check);
    try {
      // The firm screens with the free Treasury connection and its own connector; investor 0 was screened by both and is due.
      const [due0] = await seed(C.cp, { use: ['ofac', 'own-screen'], own: true, investors: [{ index: 0, results: [{ connection: 'ofac', via: 'U.S. Treasury OFAC sanctions lists', how: 'ofac', ref: 'scr_seedofac' }, { connection: 'own-screen', via: 'Own screening service', how: 'server', ref: 'scr_seedown' }], next: daysFrom(-1) }] });
      const own0 = (await record(C.cp, due0.id)).results.find((r) => r.connection === 'own-screen');
      await reopen(C);
      const moved = await C.cp
        .waitForFunction((id) => {
          const NS = window.CVPortal;
          const inv = NS.state.ws.investors.find((x) => x.id === id);
          return NS.integrations.peek(inv).aml.nextScreen > new Date().toISOString().slice(0, 10);
        }, due0.id, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      await C.cp.waitForTimeout(500);
      const r = await record(C.cp, due0.id);
      const log = await auditOf(C.cp, 'Re-screened automatically');
      check('with no click, the console re-screens the due investor when it loads', moved && (await C.cp.evaluate(() => window.__clicks)) === 0, { moved, clicks: await C.cp.evaluate(() => window.__clicks) });
      check('one change-log entry "Re-screened automatically", naming the investor', log.length === 1 && log[0].record === due0.id && log[0].detail.indexOf(due0.title) === 0, log);
      check('the next date moved by the firm\'s interval (30 days)', r.nextScreen === daysFrom(30), r.nextScreen);
      check('through the Treasury connection alone: one list read, one screening asked of the server, for the Treasury lists', C.w.listReads() === 1 && JSON.stringify(C.posts) === JSON.stringify(['ofac']), { reads: C.w.listReads(), posts: C.posts });
      check('the sponsor\'s own connector was not called and its result is kept as it was', C.posts.indexOf(OWN) < 0 && JSON.stringify(r.results.find((x) => x.connection === 'own-screen')) === JSON.stringify(own0), r.results);
      check('the Treasury result is the new one, clear', r.results.length === 2 && r.results.some((x) => x.connection === 'ofac' && x.status === 'clear' && /^scr_/.test(x.ref) && x.ref !== 'scr_seedofac') && r.aml === 'clear' && r.decision === 'approved', r);
      check('no package provider call and nothing else in the world', C.w.packageCalls() === 0 && C.w.count('other') === 0, C.w.calls.map((c) => c.kind));
      let items = await attention(C.cp);
      check('nobody is left due for re-screening', rescreenLine(items) === '', items);
      // Only the sponsor's own connector and team screening on: nothing runs by itself.
      await useAml(C.cp, ['own-screen', 'team']);
      const [due1] = await seed(C.cp, { investors: [{ index: 1, results: [{ connection: 'own-screen', via: 'Own screening service', how: 'server', ref: 'scr_seedown1' }, { connection: 'team', via: 'Screening by your team', how: 'team', ref: '' }], next: daysFrom(-1) }] });
      await pulled(C, () => reopen(C));
      await C.cp.waitForTimeout(1500);
      const r1 = await record(C.cp, due1.id);
      check('with only the sponsor\'s own connector and team screening on, nothing is screened by itself', r1.nextScreen === daysFrom(-1) && C.posts.length === 1 && (await auditOf(C.cp, 'Re-screened automatically')).length === 1, { next: r1.nextScreen, posts: C.posts });
      items = await attention(C.cp);
      check('and the investor stays listed as due with "Run now"', rescreenLine(items) === '1 investor is due for re-screening. Run now', items);
      worldClean(check, C);
      check('no script error in the console', C.A.errors.length === 0, C.A.errors);
    } finally {
      await C.close();
    }
  },

  /** Once per due date, one run at a time. */
  async once({ check, S }) {
    const C = await boot(S, check);
    try {
      const [inv] = await seed(C.cp, { use: ['ofac'], investors: [{ index: 0, results: [{ connection: 'ofac', via: 'U.S. Treasury OFAC sanctions lists', how: 'ofac', ref: 'scr_seedonce' }], next: daysFrom(-1) }] });
      const treasury = () => C.srv.server.store.list('screenings').filter((x) => x.provider === 'ofac').length;
      C.w.hold = 2500; // the lists answer slowly, so the run is still going while the console is loaded again
      await reopen(C);
      // Two loads at once while the run is going: the Overview again and the AML/KYC page, each asking to resume.
      await C.cp.evaluate(() => {
        const NS = window.CVPortal;
        NS.integrations.resume(NS.state.ws);
        NS.integrations.resume(NS.state.ws);
      });
      await C.cp.evaluate(() => (location.hash = 'console-kyc'));
      await C.cp.waitForFunction((id) => {
        const NS = window.CVPortal;
        return NS.integrations.peek(NS.state.ws.investors.find((x) => x.id === id)).aml.nextScreen > new Date().toISOString().slice(0, 10);
      }, inv.id, { timeout: 30000 }).catch(() => {});
      await C.cp.waitForTimeout(3000);
      check('loads at once start one run: one Treasury screening on the server, one list read, one change-log entry', treasury() === 1 && C.w.listReads() === 1 && (await auditOf(C.cp, 'Re-screened automatically')).length === 1, { screenings: treasury(), reads: C.w.listReads(), posts: C.posts });
      C.w.hold = 0;
      await pulled(C, () => reopen(C));
      await C.cp.waitForTimeout(1500);
      check('reloading the console right after does not screen the same investor again', treasury() === 1 && C.posts.length === 1 && (await auditOf(C.cp, 'Re-screened automatically')).length === 1, { screenings: treasury(), posts: C.posts });
      // A run that gets no answer is not repeated for the same due date (no loop); the investor stays due with "Run now".
      await forgetLists();
      C.w.failLists = true;
      const [inv2] = await seed(C.cp, { investors: [{ index: 1, results: [{ connection: 'ofac', via: 'U.S. Treasury OFAC sanctions lists', how: 'ofac', ref: 'scr_seedonce2' }], next: daysFrom(-2) }] });
      const asked = C.cp.waitForResponse((r) => r.request().method() === 'POST' && /\/v1\/screenings$/.test(r.url().replace(/[?#].*$/, '')), { timeout: 30000 }).catch(() => null);
      await pulled(C, () => reopen(C));
      await asked; // the run's screening request, answered (the lists do not answer)
      await C.cp.waitForTimeout(1500);
      const tried = C.posts.length;
      await pulled(C, () => reopen(C));
      await C.cp.waitForTimeout(1500);
      const r2 = await record(C.cp, inv2.id);
      check('a run that got no answer was tried once for that due date and writes nothing', tried === 2 && C.posts.length === 2 && r2.nextScreen === daysFrom(-2) && r2.results[0].ref === 'scr_seedonce2', { tried, posts: C.posts.length, next: r2.nextScreen });
      const items = await attention(C.cp);
      check('that investor stays listed as due with "Run now", with no error text', rescreenLine(items) === '1 investor is due for re-screening. Run now' && !items.some((l) => ERROR_RE.test(l)), items);
      worldClean(check, C);
      check('no script error in the console', C.A.errors.length === 0, C.A.errors);
    } finally {
      await C.close();
    }
  },

  'preview-desktop': ({ check, S }) => preview(check, S, 'desktop'),
  'preview-phone': ({ check, S }) => preview(check, S, 'phone')
};

/**
 * The owner's preview (view: 'desktop' | 'phone'): the portal framed with every connection refused and no server, an
 * investor due for re-screening. Nothing runs by itself, nothing is attempted, and "Run now" re-screens with the firm's
 * sandbox connection as before.
 */
async function preview(check, S, view) {
  const { A, fr } = await F.framed(S, view);
  try {
    const size = A.page.viewportSize();
    const tap = view === 'phone';
    check(`the window is ${F.VIEW[view].viewport.width}x${F.VIEW[view].viewport.height}${tap ? ' with touch' : ''}`, size.width === F.VIEW[view].viewport.width && size.height === F.VIEW[view].viewport.height && (await fr.evaluate(() => navigator.maxTouchPoints > 0)) === tap, size);
    await F.proveRefused(check, A, fr);
    await Lib.setupPortal(S, { page: fr, context: A.context });
    check('no integration server is connected', (await fr.evaluate(() => window.CVPortal.integrations.serverUrl(window.CVPortal.state.ws))) === '');
    const [inv] = await seed(fr, { use: ['sandbox'], investors: [{ index: 0, results: [{ connection: 'sandbox', via: 'Sandbox', how: 'sandbox', ref: 'sbx_seedpreview' }], next: daysFrom(-1) }] });
    const items = await attention(fr);
    await fr.waitForTimeout(1500);
    const r = await record(fr, inv.id);
    check('nothing runs by itself: the investor is still due, no automatic entry, no monitoring entry', r.nextScreen === daysFrom(-1) && (await auditOf(fr, 'Re-screened automatically')).length === 0 && (await auditOf(fr, 'Monitoring alert')).length === 0, r);
    check('the Overview offers "Run now" as before', rescreenLine(items) === '1 investor is due for re-screening. Run now', items);
    await F.noRawError(check, fr, 'the console\'s Overview');
    await A.page.screenshot({ path: path.join(SHOTS, `preview-${view}-overview.png`) });
    const toast = await runNow(fr, tap);
    const r2 = await record(fr, inv.id);
    check('"Run now" re-screens with the firm\'s sandbox connection as before', /^1 investor re-screened/.test(toast) && r2.results.length === 1 && r2.results[0].connection === 'sandbox' && r2.results[0].status === 'clear' && r2.nextScreen === daysFrom(30), { toast, r2 });
    await Lib.consoleRoute(fr, 'console-kyc', '[data-action=kyc-tab]');
    const text = await F.noRawError(check, fr, 'the console\'s AML/KYC page after "Run now"');
    await A.page.screenshot({ path: path.join(SHOTS, `preview-${view}-kyc.png`) });
    check('nothing outside the page was asked for', A.net.external.length === 0 && A.net.allowed.length === 0, A.net);
    F.leakFree(check, 'the console screens of the preview', text);
  } finally {
    await A.context.close().catch(() => {});
  }
}

Lib.runParts(PARTS, { name: 'MONITORING', unit: 'parts', flag: '--only', browser: true });
