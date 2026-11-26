#!/usr/bin/env node
// GATE CHECK: MONITORING
// Plan 08-08 (D-04, C-06): ongoing screening of investors already on file, against stand-ins. The sponsor's console is the
// sample self-serve portal on a sponsor account of the real integration server (server/index.mjs in this process,
// doubles/world.js startServer); the identity check provider and the payment provider are the world's injected fetch
// answering the recorded fixtures; the U.S. Treasury list files are answered here from stand-in lists (as
// server/test/core.test.mjs answers them); monitoring alerts are signed here as server/test/idcheck.test.mjs signs them. No
// provider is called, no key exists, and any call that would leave this machine is refused and kept.
//   alert     1280x800: a package investor is brought into the console cleared (as package-flow.js part identity does);
//             a signed new-hit alert reaches the server; the console is opened again; with no click the investor reads
//             "Needs review" on the AML/KYC page, the details name the hit's listed name, the Overview's attention list
//             counts one investor held, and the change log holds exactly one "Monitoring alert" naming the investor; the
//             typed taxpayer number is in no world record, no server output and no file the part writes (the scan proved
//             first on a planted copy)
//   NODE_PATH=$(npm root -g) node monitoring.js [--only alert]
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
  ['alert-overview.png', 'The console\'s Overview after the alert: "1 investor held for review by automated verification".']
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
  w.hold = 0;
  w.fetch = async (input, init) => {
    const u = new URL(String(input && input.url ? input.url : input));
    if (TREASURY && u.protocol === 'https:' && u.hostname === TREASURY.hostname) {
      const file = u.pathname.split('/').pop();
      w.calls.push({ at: Date.now(), kind: 'treasury', file });
      if (w.hold) await new Promise((r) => setTimeout(r, w.hold));
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
  const C = { S, w, srv, A, cp: A.page, investors: [], closers: [() => A.context.close()] };
  C.close = async () => {
    for (const c of C.closers.reverse()) await c().catch(() => {});
    await srv.close().catch(() => {});
  };
  try {
    C.off = await Lib.setupPortal(S, A, { exemption: opts.exemption || 'Rule 506(b)' });
    check('the console uses the integration server with the sponsor account\'s token', (await srv.configure(A.page)) === true);
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
  }
};

Lib.runParts(PARTS, { name: 'MONITORING', unit: 'parts', flag: '--only', browser: true });
