// gate: browser
// last "DIST FLOW: PASS (parts run: 1)"
// The distribution record on screen (plan 10-01), the way the owner sees it: the portal inside a sandboxed iframe that
// refuses every connection, at 390x844 with touch and at 1280x800, on the Kestrel Bay sample with the page's clock on
// 19 November 2026 (a Thursday).
//   record-phone   a distribution recorded on the phone keeps each investor's amount; the investor's page shows it
//   NODE_PATH=$(npm root -g) node dist-flow.js [--only part1,part2]
// The last line is "DIST FLOW: PASS (parts run: N)" or "DIST FLOW: FAIL (parts run: N) - <failed parts>". The two marker
// lines above are read by the phase gate.
const path = require('path');
const fs = require('fs');
const T = require('./lib10.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, 'dist-flow');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-recorded\.png$/, 'Distributions after "Record distribution": History lists the payment as Paid.'],
  [/-investor\.png$/, 'The investor’s Distributions page: the payment with the amount stored for this investor.']
]);

const TODAY = '2026-11-19';
const usdc = (cents) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const longDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Open a view by its route and wait for something of it. */
async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 15000 });
  await fr.waitForTimeout(300);
}
/** The rows of a table as text, one line per row. */
const rowsOf = (fr, sel) => fr.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()), sel);
/** The History panel's rows on the console's Distributions page. */
const history = (fr) =>
  fr.evaluate(() => {
    const p = Array.from(document.querySelectorAll('.cs-panel')).find((x) => (x.querySelector('.cs-panel-head h2') || {}).innerText === 'History');
    return p ? Array.from(p.querySelectorAll('tbody tr')).map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()) : [];
  });
/** On the Distributions page: a total amount for `day`, typed and recorded the way a person does it. */
async function record(fr, dollars, day) {
  await go(fr, 'console-distributions', '[data-action=dist-record]');
  if (!(await fr.evaluate(() => !!document.getElementById('ds-total')))) await T.press(fr, 'input[name=ds-mode][value=total]');
  await fr.waitForSelector('#ds-total');
  await fr.fill('#ds-date', day);
  await fr.waitForFunction((day) => (document.getElementById('ds-date') || {}).value === day && !!document.getElementById('ds-total'), day);
  await fr.fill('#ds-total', dollars);
  await fr.waitForFunction(() => !document.querySelector('[data-action=dist-record]').disabled);
  const before = await fr.evaluate(() => window.CVPortal.state.ws.runs.map((r) => r.id));
  await T.press(fr, '[data-action=dist-record]');
  await fr.waitForTimeout(500);
  return fr.evaluate((before) => {
    const NS = window.CVPortal;
    const runs = NS.state.ws.runs;
    return { added: runs.length - before.length, run: runs.find((r) => before.indexOf(r.id) < 0) || null, actor: NS.app.actor(), saved: JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /ws:kestrel-bay$/.test(k)) || '') || 'null') };
  }, before);
}

/** One size: record $10,000.00 dated today as the admin, then read it as one of its investors. */
async function recordAt(size, { check, S }) {
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
  const hist = await history(fr);
  check('History lists it as Paid', hist.some((t) => t.indexOf(longDay(TODAY)) >= 0 && t.indexOf('$10,000.00') >= 0 && /\bPaid\b/.test(t) && t.indexOf(String(lines.length)) >= 0), hist.slice(0, 3));
  await A.page.screenshot({ path: path.join(OUT, `${size}-recorded.png`) });
  await T.wayOut(check, fr);
  await T.leak(check, fr);
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

const parts = {
  'record-phone': (ctx) => recordAt('phone', ctx)
};

Lib.runParts(parts, { name: 'DIST FLOW', unit: 'parts', flag: '--only', browser: true });
