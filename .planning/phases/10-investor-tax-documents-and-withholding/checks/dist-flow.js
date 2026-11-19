// gate: browser
// last "DIST FLOW: PASS (parts run: 7)"
// The distribution record on screen (plan 10-01), the way the owner sees it: the portal inside a sandboxed iframe that
// refuses every connection, at 390x844 with touch and at 1280x800, on the Kestrel Bay sample with the page's clock on
// 19 November 2026 (a Thursday).
//   record-phone      a distribution recorded on the phone keeps each investor's amount; the investor's page shows it
//   record-desktop    the same at 1280x800; and an ACH file built before the register changed is refused at recording (A5)
//   frozen            after a position is edited, the investor's page and the ACH file built again keep the stored amounts (A1)
//   future            a distribution for the next banking day is Scheduled, and Paid once the clock passes it, with no click;
//                     the overview's 12-month total and the report follow; a cancelled run is in no report (A2)
//   withheld-phone    example A's withheld line: the investor sees the amount, the tax withheld and the amount paid; the ACH
//   withheld-desktop  file built again pays the stored net amounts (A1); a cancelled run reads Cancelled with no ACH file
//   managed           index.html as staff: recording stores the lines; the form is the one it was at the base
//   NODE_PATH=$(npm root -g) node dist-flow.js [--only part1,part2]
// The last line is "DIST FLOW: PASS (parts run: N)" or "DIST FLOW: FAIL (parts run: N) - <failed parts>". The two marker
// lines above are read by the phase gate.
//
// Example A (the numbers of checks/dist-record.js), seeded on a fund added to the sample for the two withheld parts:
// three holders A-1001 $300,000, A-1002 $200,000, A-1003 $100,000; $10,000.00 dated 15 June 2026 gives 500,000 / 333,333 /
// 166,667 cents. With $800.00 withheld from A-1002 its net is 333,333 - 80,000 = 253,333 ($2,533.33) and the nets add to
// 920,000. A second $10,000.00 dated 15 September 2026 has A-1003's whole 166,667 withheld: net 0, so no ACH entry, and the
// file's credits are 500,000 + 333,333 = 833,333.
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const T = require('./lib10.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, 'dist-flow');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-recorded\.png$/, 'Distributions after "Record distribution": History lists the payment as Paid.'],
  [/-investor\.png$/, 'The investor’s Distributions page: the payment with the amount stored for this investor.'],
  [/-stale\.png$/, 'Record distribution pressed with an ACH file built before the register changed: one line says to build it again.'],
  [/-frozen\.png$/, 'The investor’s Distributions page after their position was edited: the stored amount stands.'],
  [/-scheduled\.png$/, 'History with the distribution recorded for the next banking day: Scheduled.'],
  [/-paid-later\.png$/, 'History with the clock moved past that day: Paid, with no click.'],
  [/-withheld\.png$/, 'The investor’s Distributions page: the amount, the tax withheld and the amount paid.'],
  [/-cancelled\.png$/, 'History: the cancelled distribution reads Cancelled and offers no ACH file.'],
  [/-managed\.png$/, 'The managed console (index.html) after recording: History lists the payment as Paid.']
]);

const TODAY = '2026-11-19';
const usdc = (cents) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const longDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const J = (x) => JSON.stringify(x);

/** Open a view by its route and wait for something of it. */
async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 15000 });
  await fr.waitForTimeout(300);
}
/** The rows of a table as text, one line per row. */
const rowsOf = (fr, sel) => fr.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()), sel);
/** The History panel's rows on the console's Distributions page (every row: "Show all" is pressed when it is there). */
async function history(fr) {
  if (await fr.locator('[data-action=hist-all]').count()) await T.press(fr, '[data-action=hist-all]');
  return fr.evaluate(() => {
    const p = Array.from(document.querySelectorAll('.cs-panel')).find((x) => (x.querySelector('.cs-panel-head h2') || {}).innerText === 'History');
    return p ? Array.from(p.querySelectorAll('tbody tr')).map((tr) => ({ text: tr.innerText.replace(/\s+/g, ' ').trim(), file: (tr.querySelector('[data-action=dist-load]') || {}).dataset ? (tr.querySelector('[data-action=dist-load]') || { dataset: {} }).dataset.id || '' : '' })) : [];
  });
}
/** The text of the message shown last (empty when none). */
const toastText = (fr) => fr.evaluate(() => ((document.getElementById('toasts') || {}).innerText || '').trim());
/** On the Distributions page: a total amount for `day`, typed the way a person does it (not yet recorded). */
async function fillDraft(fr, dollars, day) {
  await go(fr, 'console-distributions', '[data-action=dist-record]');
  if (!(await fr.evaluate(() => !!document.getElementById('ds-total')))) await T.press(fr, 'input[name=ds-mode][value=total]');
  await fr.waitForSelector('#ds-total');
  await fr.fill('#ds-date', day);
  await fr.waitForFunction((day) => (document.getElementById('ds-date') || {}).value === day && !!document.getElementById('ds-total'), day);
  await fr.fill('#ds-total', dollars);
  await fr.waitForFunction(() => !document.querySelector('[data-action=dist-record]').disabled);
}
/** Press Record distribution; resolves to what was added and what the browser saved. */
async function pressRecord(fr) {
  const before = await fr.evaluate(() => window.CVPortal.state.ws.runs.map((r) => r.id));
  await T.press(fr, '[data-action=dist-record]');
  await fr.waitForTimeout(500);
  return fr.evaluate((before) => {
    const NS = window.CVPortal;
    const runs = NS.state.ws.runs;
    return { added: runs.length - before.length, run: runs.find((r) => before.indexOf(r.id) < 0) || null, actor: NS.app.actor(), saved: JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /ws:kestrel-bay$/.test(k)) || '') || 'null') };
  }, before);
}
async function record(fr, dollars, day) {
  await fillDraft(fr, dollars, day);
  return pressRecord(fr);
}
/**
 * "ACH file" on a History row: the file built again for that run, read from its own entry records (type 6: amount in
 * positions 30-39, the investor's id in 40-54) and its file control total.
 */
async function achFileOf(fr, runId) {
  await go(fr, 'console-distributions', '[data-action=dist-record]');
  if (await fr.locator('[data-action=hist-all]').count()) await T.press(fr, '[data-action=hist-all]');
  const sel = `[data-action=dist-load][data-id="${runId}"]`;
  if (!(await fr.locator(sel).count())) return null;
  await T.press(fr, sel);
  await fr.waitForFunction(() => !!(window.CVPortal.state.ui.dist && window.CVPortal.state.ui.dist.file), null, { timeout: 10000 }).catch(() => {});
  return fr.evaluate(() => {
    const f = window.CVPortal.state.ui.dist && window.CVPortal.state.ui.dist.file;
    if (!f) return null;
    const entries = {};
    f.lines.filter((l) => l[0] === '6').forEach((l) => (entries[l.slice(39, 54).trim()] = Number(l.slice(29, 39))));
    return { entries, credit: f.totals.credit, filename: f.filename };
  });
}
/** The ACH investors with a bank account among a run's lines, and what the stored record says each is paid. */
const achNets = (fr, runId) =>
  fr.evaluate((id) => {
    const w = window.CVPortal.state.ws;
    const run = w.runs.find((r) => r.id === id);
    const out = {};
    (run.lines || []).forEach((l) => {
      const i = w.investors.find((x) => x.id === l.investorId);
      if (i && i.payment && i.payment.method === 'ach' && i.payment.bank && l.netCents > 0) out[l.investorId] = l.netCents;
    });
    return out;
  }, runId);
const sum = (o) => Object.values(o || {}).reduce((a, x) => a + x, 0);

/** One size: record $10,000.00 dated today as the admin, then read it as one of its investors. */
async function recordAt(size, { check, S }, more) {
  const { A, fr } = await T.framed(S, size, { clock: TODAY });
  await T.proveRefused(check, A, fr);
  await T.sample(fr, { role: 'admin' });
  const r = await record(fr, '10000.00', TODAY);
  const run = r.run;
  check('one distribution was recorded', r.added === 1 && !!run, { added: r.added });
  const lines = (run && run.lines) || [];
  check('the stored run has a line for each investor paid, in whole cents', lines.length > 0 && lines.every((l) => Number.isInteger(l.grossCents) && l.grossCents > 0 && l.netCents === l.grossCents && Array.isArray(l.withheld)), lines.slice(0, 3));
  check('the lines’ gross amounts add up to the total, $10,000.00', lines.reduce((a, l) => a + l.grossCents, 0) === 1000000 && run.total === 1000000, lines.reduce((a, l) => a + l.grossCents, 0));
  check('the run says the lines were stored when it was recorded, by the signed-in person', !!run && run.linesBasis === 'recorded' && !!r.actor && run.linesBy === r.actor && /^2026-11-19T/.test(run.linesAt || ''), run && { basis: run.linesBasis, by: run.linesBy, at: run.linesAt, actor: r.actor });
  const savedRun = r.saved && (r.saved.runs || []).find((x) => run && x.id === run.id);
  check('the saved workspace holds the same lines', !!savedRun && JSON.stringify(savedRun.lines) === JSON.stringify(lines), savedRun ? savedRun.lines : r.saved && Object.keys(r.saved));
  const hist = (await history(fr)).map((x) => x.text);
  check('History lists it as Paid', hist.some((t) => t.indexOf(longDay(TODAY)) >= 0 && t.indexOf('$10,000.00') >= 0 && /\bPaid\b/.test(t) && t.indexOf(String(lines.length)) >= 0), hist.slice(0, 3));
  await A.page.screenshot({ path: path.join(OUT, `${size}-recorded.png`) });
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  if (more) await more({ check, A, fr, run });
  // one of its investors, on their own Distributions page
  const who = await fr.evaluate((ids) => {
    const w = window.CVPortal.state.ws;
    const i = w.investors.find((x) => ids.indexOf(x.id) >= 0 && x.onboarding.status === 'complete');
    return i ? i.id : '';
  }, lines.map((l) => l.investorId));
  check('an activated investor is among those paid', !!who, lines.map((l) => l.investorId));
  if (who) {
    const mine = lines.find((l) => l.investorId === who);
    await T.sample(fr, { role: 'investor', investor: who });
    await go(fr, 'distributions', '.tbl');
    const rows = await rowsOf(fr, '.tbl tbody tr');
    const row = rows.find((t) => t.indexOf(longDay(TODAY)) >= 0);
    check(`the investor’s Distributions page shows the stored amount, ${usdc(mine.grossCents)}, as Paid`, !!row && row.indexOf(usdc(mine.grossCents)) >= 0 && /\bPaid\b/.test(row), row || rows.slice(0, 3));
    await A.page.screenshot({ path: path.join(OUT, `${size}-investor.png`) });
    await T.wayOut(check, fr);
    await T.leak(check, fr);
  }
  await T.quiet(check, A, fr);
  await A.context.close();
}

/** A5, after a distribution is recorded at this size: a file built before the register changed is refused at recording. */
async function staleFile({ check, A, fr }) {
  await fillDraft(fr, '5000.00', TODAY);
  await T.press(fr, '[data-action=nacha-build]');
  await fr.waitForFunction(() => !!(window.CVPortal.state.ui.dist && window.CVPortal.state.ui.dist.file), null, { timeout: 10000 }).catch(() => {});
  const built = await fr.evaluate(() => !!(window.CVPortal.state.ui.dist && window.CVPortal.state.ui.dist.file));
  check('A5: an ACH file is built for $5,000.00 dated today', built);
  // the register changes after the file was built: an ACH holder of that fund doubles its position
  const moved = await T.ws(fr, (w) => {
    const d = window.CVPortal.state.ui.dist;
    const inv = w.investors.find((i) => i.payment && i.payment.method === 'ach' && i.payment.bank && i.positions.some((p) => p.offeringId === d.offeringId && p.date <= d.date));
    const p = inv.positions.find((x) => x.offeringId === d.offeringId && x.date <= d.date);
    p.amount *= 2;
    return inv.id;
  });
  await fr.evaluate(() => {
    const el = document.getElementById('toasts');
    if (el) el.innerHTML = '';
  });
  const r = await pressRecord(fr);
  const msg = await toastText(fr);
  check(`A5: with the register changed (${moved}'s position doubled) Record distribution records nothing`, r.added === 0, { added: r.added });
  check('A5: and one line says the file was built before the register changed and must be built again', /built before/i.test(msg) && /again/i.test(msg) && msg.split('\n').filter(Boolean).length === 1, msg);
  await A.page.screenshot({ path: path.join(OUT, `${fr.p10.size}-stale.png`) });
  await T.wayOut(check, fr);
}

/** Example A on a fund added to the Kestrel Bay sample: three investors copied from activated ACH investors, three runs. */
function seedExampleA(w, arg, NS) {
  const src = w.offerings.find((o) => o.status !== 'Exited') || w.offerings[0];
  const o = JSON.parse(JSON.stringify(src));
  Object.assign(o, { id: 'p10-a', name: 'Example Fund A, L.P.', shortName: 'Example Fund A', status: 'Active' });
  delete o.seed;
  w.offerings.push(o);
  const ach = w.investors.filter((i) => i.onboarding.status === 'complete' && i.payment && i.payment.method === 'ach' && i.payment.bank);
  [['A-1001', 300000], ['A-1002', 200000], ['A-1003', 100000]].forEach(([id, amount], k) => {
    const c = JSON.parse(JSON.stringify(ach[k]));
    Object.assign(c, { id, title: `Example investor ${id}`, positions: [{ offeringId: 'p10-a', amount, date: '2025-01-02' }] });
    w.investors.push(c);
  });
  const opts = (id) => ({ by: 'Plan 10-01 check', today: '2026-11-19', id });
  const spec = (date, withheld) => ({ offeringId: 'p10-a', date, type: 'Income', total: 1000000, file: '', withheld });
  NS.data.recordRun(w, spec('2026-06-15', { 'A-1002': [arg.w800] }), opts('p10-june'));
  NS.data.recordRun(w, spec('2026-09-15', { 'A-1003': [arg.wAll] }), opts('p10-sept'));
  NS.data.recordRun(w, spec('2026-03-16'), opts('p10-march'));
  NS.data.cancelRun(w, 'p10-march', { by: 'Plan 10-01 check', at: '2026-11-19T15:00:00.000Z', why: 'Recorded twice' });
  return w.runs.filter((r) => /^p10-/.test(r.id)).map((r) => [r.id, (r.lines || []).map((l) => `${l.investorId}=${l.grossCents}/${l.netCents}`).join(' ')]);
}
const W800 = { kind: 'backup', cents: 80000, basisCents: 333333, ratePct: null, source: 'entered', why: 'Entered by the sponsor', confirmedBy: 'Plan 10-01 check', confirmedAt: '2026-06-12T15:00:00.000Z' };
const WALL = Object.assign({}, W800, { cents: 166667, basisCents: 166667 });

async function withheldAt(size, { check, S }) {
  const { A, fr } = await T.framed(S, size, { clock: TODAY });
  await T.proveRefused(check, A, fr);
  await T.sample(fr, { role: 'admin' });
  let seeded = null;
  try {
    seeded = await T.ws(fr, seedExampleA, { w800: W800, wAll: WALL });
  } catch (e) {
    seeded = String(e && e.message).slice(0, 200);
  }
  check('example A is seeded: June 500,000 / 333,333 (net 253,333) / 166,667; September with A-1003 net 0', J(seeded) === J([['p10-sept', 'A-1001=500000/500000 A-1002=333333/333333 A-1003=166667/0'], ['p10-june', 'A-1001=500000/500000 A-1002=333333/253333 A-1003=166667/166667'], ['p10-march', 'A-1001=500000/500000 A-1002=333333/333333 A-1003=166667/166667']]), seeded);
  // A-1002 sees the amount, the tax withheld and the amount paid; A-1001 sees only the amount
  await T.sample(fr, { role: 'investor', investor: 'A-1002' });
  await go(fr, 'distributions', '.tbl');
  let rows = await rowsOf(fr, '.tbl tbody tr');
  const june = rows.find((t) => t.indexOf(longDay('2026-06-15')) >= 0) || '';
  check('A-1002’s June payment shows the amount $3,333.33, Tax withheld $800.00 and Amount paid $2,533.33', june.indexOf('$3,333.33') >= 0 && /Tax withheld \$800\.00/.test(june) && /Amount paid \$2,533\.33/.test(june) && /\bPaid\b/.test(june), june || rows.slice(0, 4));
  const sept = rows.find((t) => t.indexOf(longDay('2026-09-15')) >= 0) || '';
  check('A-1002’s September payment, with nothing withheld, shows only the amount', sept.indexOf('$3,333.33') >= 0 && !/Tax withheld|Amount paid/.test(sept), sept);
  check('the cancelled March run is not on the investor’s page', !rows.some((t) => t.indexOf(longDay('2026-03-16')) >= 0), rows);
  await A.page.screenshot({ path: path.join(OUT, `${size}-withheld.png`) });
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.sample(fr, { role: 'investor', investor: 'A-1001' });
  await go(fr, 'distributions', '.tbl');
  rows = await rowsOf(fr, '.tbl tbody tr');
  check('A-1001 sees only the amount on each payment ($5,000.00, no withheld lines)', rows.filter((t) => t.indexOf('$5,000.00') >= 0).length === 2 && !rows.some((t) => /Tax withheld|Amount paid/.test(t)), rows);
  await T.sample(fr, { role: 'investor', investor: 'A-1003' });
  await go(fr, 'distributions', '.tbl');
  rows = await rowsOf(fr, '.tbl tbody tr');
  const all = rows.find((t) => t.indexOf(longDay('2026-09-15')) >= 0) || '';
  check('A-1003’s September payment shows $1,666.67, Tax withheld $1,666.67 and Amount paid $0.00', /Tax withheld \$1,666\.67/.test(all) && /Amount paid \$0\.00/.test(all), all);
  // the console: the cancelled run, and the ACH files built again from the stored net amounts
  await T.sample(fr, { role: 'admin' });
  await go(fr, 'console-distributions', '[data-action=dist-record]');
  const hist = await history(fr);
  const mar = hist.find((x) => x.text.indexOf(longDay('2026-03-16')) >= 0 && x.text.indexOf('Example Fund A') >= 0);
  check('History lists the cancelled run as Cancelled and offers no ACH file for it', !!mar && /\bCancelled\b/.test(mar.text) && !mar.file, mar);
  await A.page.screenshot({ path: path.join(OUT, `${size}-cancelled.png`) });
  const fj = await achFileOf(fr, 'p10-june');
  check('A1: "ACH file" on the June run pays A-1002 its stored net, 253,333 cents, and credits 920,000 in all', !!fj && fj.entries['A-1002'] === 253333 && fj.entries['A-1001'] === 500000 && fj.entries['A-1003'] === 166667 && fj.credit === 920000, fj);
  const draftLink = await fr.evaluate(() => !!(window.CVPortal.state.ui.dist || {}).fromRun);
  await fr.fill('#ds-desc', 'DISTRIBX');
  await fr.waitForTimeout(300);
  const dropped = await fr.evaluate(() => !(window.CVPortal.state.ui.dist || {}).fromRun);
  check('A1: editing a field of the draft loaded from the run drops its link to that run', draftLink && dropped, { draftLink, dropped });
  const fs9 = await achFileOf(fr, 'p10-sept');
  check('A1: on the September run A-1003, with a net of 0, has no entry; credits are 833,333', !!fs9 && !('A-1003' in fs9.entries) && fs9.credit === 833333 && fs9.entries['A-1002'] === 333333, fs9);
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  await A.context.close();
}

const parts = {
  'record-phone': (ctx) => recordAt('phone', ctx),
  'record-desktop': (ctx) => recordAt('desktop', ctx, staleFile),

  async frozen({ check, S }) {
    const { A, fr } = await T.framed(S, 'desktop', { clock: TODAY });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    const r = await record(fr, '10000.00', TODAY);
    const run = r.run;
    check('a distribution of $10,000.00 dated today is recorded with its lines', !!run && Array.isArray(run.lines) && run.lines.length > 1, r.added);
    if (!run) return A.context.close();
    // an activated ACH investor of that run has its position edited through the workspace
    const ed = await T.ws(
      fr,
      (w, id, NS) => {
        const run = w.runs.find((x) => x.id === id);
        const inv = w.investors.find((i) => i.onboarding.status === 'complete' && i.payment && i.payment.method === 'ach' && i.payment.bank && run.lines.some((l) => l.investorId === i.id));
        const p = inv.positions.find((x) => x.offeringId === run.offeringId);
        p.amount *= 3;
        NS.clearCaches();
        const now = NS.data.allocate(w, { id: 'p10-what-if', offeringId: run.offeringId, date: run.date, total: run.total }).find((a) => a.investor.id === inv.id);
        return { id: inv.id, stored: run.lines.find((l) => l.investorId === inv.id).grossCents, now: now ? now.cents : 0 };
      },
      run.id
    );
    check(`after ${ed.id}'s position is tripled its share worked out again would differ from the stored one`, ed.now !== ed.stored && ed.stored > 0, ed);
    await T.sample(fr, { role: 'investor', investor: ed.id });
    await go(fr, 'distributions', '.tbl');
    const rows = await rowsOf(fr, '.tbl tbody tr');
    const row = rows.find((t) => t.indexOf(longDay(TODAY)) >= 0) || '';
    check(`the investor’s page still shows the stored amount ${usdc(ed.stored)}`, row.indexOf(usdc(ed.stored)) >= 0 && row.indexOf(usdc(ed.now)) < 0, row || rows.slice(0, 3));
    await A.page.screenshot({ path: path.join(OUT, 'desktop-frozen.png') });
    await T.sample(fr, { role: 'admin' });
    const want = await achNets(fr, run.id);
    const f = await achFileOf(fr, run.id);
    check('A1: "ACH file" on that History row pays each ACH investor the stored net amount (by investor id)', !!f && J(Object.keys(f.entries).sort().map((k) => [k, f.entries[k]])) === J(Object.keys(want).sort().map((k) => [k, want[k]])), { file: f && f.entries, want });
    check('A1: and its total credits equal their sum', !!f && f.credit === sum(want), { credit: f && f.credit, want: sum(want) });
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  async future({ check, S }) {
    const NEXT = '2026-11-20';
    const LATER = '2026-11-23';
    const { A, fr: fr0 } = await T.framed(S, 'desktop', { clock: TODAY });
    let fr = fr0;
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    const r = await record(fr, '10000.00', NEXT);
    const run = r.run;
    check('a distribution of $10,000.00 for the next banking day, 20 November, is recorded with its lines', !!run && run.date === NEXT && Array.isArray(run.lines), r.added);
    if (!run) return A.context.close();
    const row = (hist) => (hist.find((x) => x.text.indexOf(longDay(NEXT)) >= 0 && x.text.indexOf('$10,000.00') >= 0) || { text: '' }).text;
    check('History shows it as Scheduled', /\bScheduled\b/.test(row(await history(fr))), row(await history(fr)));
    await A.page.screenshot({ path: path.join(OUT, 'desktop-scheduled.png') });
    const who = await fr.evaluate((id) => {
      const w = window.CVPortal.state.ws;
      const run = w.runs.find((x) => x.id === id);
      const i = w.investors.find((x) => x.onboarding.status === 'complete' && run.lines.some((l) => l.investorId === x.id));
      return { id: i.id, cents: run.lines.find((l) => l.investorId === i.id).grossCents };
    }, run.id);
    const invRow = async () => {
      await T.sample(fr, { role: 'investor', investor: who.id });
      await go(fr, 'distributions', '.tbl');
      return (await rowsOf(fr, '.tbl tbody tr')).find((t) => t.indexOf(longDay(NEXT)) >= 0) || '';
    };
    const ir = await invRow();
    check(`the investor’s page shows ${usdc(who.cents)} as Scheduled`, ir.indexOf(usdc(who.cents)) >= 0 && /\bScheduled\b/.test(ir), ir);
    // the report, scheduled payments ticked, to the end of the year; and a cancelled run in no report
    const report = async (scheduled) => {
      await T.sample(fr, { role: 'admin' });
      await fr.evaluate((scheduled) => {
        const NS = window.CVPortal;
        NS.state.ui.rep = { tab: 'dist', preset: 'custom', from: '2026-01-01', to: '2026-12-31', offering: 'all', view: 'payment', scheduled, con: { offering: 'all', status: 'all', pay: 'all' } };
      }, scheduled);
      await go(fr, 'console-reports', '.cs-report-sum');
      // the report's CSV, one string per row with its fields joined by |
      return fr.evaluate(() =>
        String(window.CVPortal.state.ui.repCsv || '')
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => {
            const out = [];
            let cur = '';
            let q = false;
            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              if (q && ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
              else if (ch === '"') q = !q;
              else if (ch === ',' && !q) out.push(cur), (cur = '');
              else cur += ch;
            }
            out.push(cur);
            return out.join('|');
          })
      );
    };
    const mine = (csv, state) => csv.filter((l) => l.indexOf(NEXT) === 0 && l.split('|').indexOf(state) >= 0).length;
    let csv = await report(true);
    check(`the distributions report with scheduled payments ticked lists the run as Scheduled (${run.lines.length} lines)`, mine(csv, 'Scheduled') === run.lines.length, csv.filter((l) => l.indexOf(NEXT) === 0).slice(0, 2));
    const past = await fr.evaluate(() => {
      const w = window.CVPortal.state.ws;
      const r = w.runs.find((x) => x.date >= '2026-01-01' && x.date < '2026-11-19' && !x.cancelled);
      return r ? { id: r.id, date: r.date, offeringId: r.offeringId, name: (w.offerings.find((o) => o.id === r.offeringId) || {}).name } : null;
    });
    const hits = (csv) => csv.filter((l) => past && l.indexOf(past.date) === 0 && l.split('|')[1] === past.name).length;
    check('a paid 2026 run of the sample is in the report before it is cancelled', !!past && hits(csv) > 0, past);
    let cancelled = '';
    try {
      cancelled = await T.ws(fr, (w, id, NS) => NS.data.cancelRun(w, id, { by: 'Plan 10-01 check', at: '2026-11-19T15:00:00.000Z', why: 'Recorded twice' }).cancelled.why, past && past.id);
    } catch (e) {
      cancelled = String(e && e.message).slice(0, 160);
    }
    csv = await report(true);
    const csv2 = await report(false);
    check('once cancelled it is in no report, scheduled payments ticked or not', cancelled === 'Recorded twice' && hits(csv) === 0 && hits(csv2) === 0, { cancelled, ticked: hits(csv), unticked: hits(csv2) });
    // the clock moves past 20 November: Paid everywhere, with no click
    fr = await A.setClock(LATER);
    await T.sample(fr, { role: 'admin' });
    await go(fr, 'console-distributions', '[data-action=dist-record]');
    check('with the clock on 23 November History shows it as Paid, with no click', /\bPaid\b/.test(row(await history(fr))), row(await history(fr)));
    await A.page.screenshot({ path: path.join(OUT, 'desktop-paid-later.png') });
    const ir2 = await invRow();
    check('and the investor’s page shows it as Paid', ir2.indexOf(usdc(who.cents)) >= 0 && /\bPaid\b/.test(ir2), ir2);
    csv = await report(false);
    check('and the report lists it as Paid without scheduled payments ticked', mine(csv, 'Paid') === run.lines.length, csv.filter((l) => l.indexOf(NEXT) === 0).slice(0, 2));
    await go(fr, 'console', '.cs-figs');
    const shown = await fr.evaluate(() => {
      const dt = Array.from(document.querySelectorAll('dt')).find((x) => x.innerText.trim() === 'Distributed, last 12 months');
      return dt && dt.nextElementSibling ? dt.nextElementSibling.innerText.trim() : '';
    });
    // the other runs counted by the date rule, worked out here: dated after 23 November 2025 and on or before the 23rd, not cancelled
    const others = await fr.evaluate(({ id, later }) => window.CVPortal.state.ws.runs.filter((r) => r.id !== id && !r.cancelled && r.date > '2025-11-23' && r.date <= later).reduce((a, r) => a + r.total, 0), { id: run.id, later: LATER });
    check(`the overview's 12-month total includes it (${usdc(others)} + $10,000.00)`, shown === usdc(others + 1000000), { shown, want: usdc(others + 1000000) });
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  'withheld-phone': (ctx) => withheldAt('phone', ctx),
  'withheld-desktop': (ctx) => withheldAt('desktop', ctx),

  async managed({ check, S }) {
    const { A, fr } = await T.framed(S, 'desktop', { page: 'index.html', clock: TODAY });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'staff' });
    await go(fr, 'console-distributions', '[data-action=dist-record]');
    const btn = await fr.locator('[data-action=dist-record]').first().isVisible();
    check('the Distributions page shows its Record distribution button', btn);
    const form = await fr.evaluate(() => {
      const p = Array.from(document.querySelectorAll('.cs-panel')).find((x) => (x.querySelector('.cs-panel-head h2') || {}).innerText === 'New distribution');
      if (!p) return null;
      return {
        fields: Array.from(p.querySelectorAll('input, select, textarea')).map((el) => el.id || `${el.name}=${el.value}`),
        buttons: Array.from(p.querySelectorAll('button')).map((b) => b.innerText.trim())
      };
    });
    // as the base tree (3234eb5) draws it for this firm on 19 November 2026
    const BASE_FORM = { fields: ['ds-off', 'ds-type', 'ds-date', 'ds-mode=rate', 'ds-mode=total', 'ds-total', 'ds-desc', 'ds-gross'], buttons: ['Generate NACHA file', 'Record distribution'] };
    check('the new-distribution form has the fields and the two buttons it had at the base, and no other', J(form) === J(BASE_FORM), form);
    const r = await record(fr, '10000.00', TODAY);
    const run = r.run;
    check('recording stores the lines: they add up to $10,000.00, basis recorded', !!run && Array.isArray(run.lines) && run.lines.length > 0 && run.lines.reduce((a, l) => a + l.grossCents, 0) === 1000000 && run.linesBasis === 'recorded', run && run.lines);
    const hist = (await history(fr)).map((x) => x.text);
    check('History lists it as Paid', hist.some((t) => t.indexOf(longDay(TODAY)) >= 0 && t.indexOf('$10,000.00') >= 0 && /\bPaid\b/.test(t)), hist.slice(0, 3));
    await A.page.screenshot({ path: path.join(OUT, 'desktop-managed.png') });
    // index.html: no commit of this plan touches it and the working tree holds no change to it
    const g = (args) => spawnSync('git', args, { cwd: Lib.ROOT, encoding: 'utf8' });
    const log = g(['log', '--format=%s', '3234eb5260e7ebfe4d866997781d9a3ffa8eb2be..HEAD', '--', 'index.html']);
    const dirty = g(['diff', '--quiet', 'HEAD', '--', 'index.html']);
    check('git shows index.html untouched by this plan (no 10-01 commit, no change in the working tree)', log.status === 0 && !/\(10-01\)/.test(log.stdout) && dirty.status === 0, { log: log.stdout.slice(0, 200), dirty: dirty.status });
    await T.wayOut(check, fr);
    // the managed edition is Carrow & Vale's own console, so its name is on screen by design; any other name is not
    const text = await fr.evaluate(() => document.body.innerText);
    const hits = text.split('\n').map((l) => l.replace(/Carrow\s*&\s*Vale/gi, '')).filter((l) => Lib.VENDORS.test(l) || Lib.VENDOR_RE.test(l) || Lib.WORD_RE.test(l));
    check('no vendor, model or library name other than the managed firm’s own, and no forbidden word, on screen', hits.length === 0, hits.map((l) => l.trim().slice(0, 160)));
    await T.quiet(check, A, fr);
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'DIST FLOW', unit: 'parts', flag: '--only', browser: true });
