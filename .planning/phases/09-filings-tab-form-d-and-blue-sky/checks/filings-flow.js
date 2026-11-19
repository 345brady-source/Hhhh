// gate: browser
// last "FILINGS FLOW: PASS (parts run: 1)"
// Plan 09-03: the Filings tab of the self-serve console, as the owner tests it: inside a sandboxed iframe whose policy
// refuses every connection, with no server, on a 390x844 touch screen (-phone) and at 1280x800 (-desktop). Every part
// answers 404 for the part files later plans add beside filings-ui.js, so it measures the tab alone and stays valid after
// those plans land.
//   tab-phone      the menu entry with its count opens the page; an overdue first Form D with its date and reason, and a
//                  state notice with the first sale date and no due date
//   NODE_PATH=$(npm root -g) node filings-flow.js [--only tab-phone]
// The last line is "FILINGS FLOW: PASS (parts run: N)" or "FILINGS FLOW: FAIL (parts run: N) - <failed parts>". The two
// marker lines above are read by gate9.sh.
const path = require('path');
const fs = require('fs');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const L9 = require('./lib9.js');

const OUT = path.join(Lib.OUT, 'filings-flow');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([[/-tab\.png$/, 'The Filings tab for an offering whose first sale was 20 days ago: the first Form D overdue with its date and reason, and the state notice.']]);

const NAV = '.cs-nav a[href="#console-filings"]';
const row = (key) => `.fl-row[data-key="${key}"]`;
/** The offering's name carries angle brackets: the tab must show them as text (T-09-07). */
const NAME = 'Harbor <b>Growth</b> Fund, L.P.';
/** The module under test, for the dates the screen must show (its date rules are proven by filings-math.js). */
const filings = () => require(path.join(Lib.ROOT, 'assets/js/filings.js'));

/** What the menu shows for Filings: { there, label, count }. */
const menu = (F) =>
  F.fr.evaluate((sel) => {
    const a = document.querySelector(sel);
    const n = a && a.querySelector('.cs-nav-count');
    return { there: !!a, label: a ? a.childNodes[0].textContent.trim() : '', count: n ? n.textContent.trim() : '' };
  }, NAV);

/** The tab for an offering whose first sale, to three investors in New York, was 20 days ago. */
async function tab(size, { check, S }) {
  const F = await L9.framed(S, size, { absent: L9.LATER });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 20, state: 'NY', funded: true }, { daysAgo: 12, state: 'NY' }, { daysAgo: 3, state: 'NY' }] });
  const first = seeded.sales[0].date;
  const due = filings().businessDay(L9.iso(first, 15));
  const m = await menu(F);
  check('the console menu has Filings with the count 2 (the first Form D and the New York notice)', m.there && m.label === 'Filings' && m.count === '2', m);
  if (!m.there) return F.A.context.close();
  await L9.press(F, NAV);
  await F.fr.waitForSelector('.fl', { timeout: 20000 });
  const at = await F.fr.evaluate(() => ({ hash: location.hash, route: window.CVPortal.state.route, h1: (document.querySelector('.fl h1') || {}).innerText || '' }));
  check(`${F.phone ? 'tapping' : 'clicking'} it opens the page`, at.hash === '#console-filings' && at.route === 'console-filings' && at.h1 === 'Filings', at);
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-tab.png`), fullPage: false });
  const panel = `.fl-off[data-offering="${seeded.offeringId}"]`;
  const head = await L9.text(F, `${panel} h2`);
  const bold = await F.fr.locator(`${panel} h2 b`).count();
  check('the offering is listed under its name, angle brackets shown as text', head.indexOf(NAME) >= 0 && bold === 0, { head, bold });
  const fd = await L9.text(F, `${panel} ${row('formd-first:' + seeded.offeringId)}`);
  check('the first Form D is shown as overdue with its due date and the reason (15 days after the first sale, on its date)', /Form D/.test(fd) && /Overdue/.test(fd) && fd.indexOf(`Due ${L9.label(due)}`) >= 0 && /15 days after the first sale/.test(fd) && fd.indexOf(L9.label(first)) >= 0, { shown: fd, due: L9.label(due), first: L9.label(first) });
  const ny = await L9.text(F, `${panel} ${row('state-first:' + seeded.offeringId + ':NY')}`);
  const nyDate = await L9.text(F, `${panel} ${row('state-first:' + seeded.offeringId + ':NY')} .fl-date`);
  check('a state notice reminder for New York shows the first sale date and no due date', /New York/.test(ny) && ny.indexOf(L9.label(first)) >= 0 && !/Due /.test(ny) && nyDate.trim() === '', { shown: ny, date: nyDate });
  const others = await F.fr.locator('.fl-off').count();
  check('only the offering that files Form D is listed (the sample offerings name no exemption)', others === 1, others);
  await L9.wayOut(check, F, 'the list');
  await L9.leak(check, F, 'the list');
  await L9.quiet(check, F);
  await F.A.context.close();
}

const PARTS = {
  'tab-phone': (ctx) => tab('phone', ctx)
};

Lib.runParts(PARTS, { name: 'FILINGS FLOW', browser: true });
