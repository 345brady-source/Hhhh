// gate: browser
// last "BLUESKY FLOW: PASS (parts run: 1)"
// Plan 09-07: the state filings section of the Filings tab, as the owner tests it: inside a sandboxed iframe whose policy
// refuses every connection, with no server, on a 390x844 touch screen (-phone) and at 1280x800 (-desktop). The part files
// of the other Filings plans are answered 404, so the section is measured alone.
//   order-phone     an offering with sales in New York and California and a filed Form D: the tab's State filings line; the
//                   section with both states ticked and the first sale date in each; Texas added by hand; the service fee
//                   $100 and the state fees and the filing system's fee to be confirmed, with no other amount; a reload at
//                   the section's address; the admin orders: "$100 due", the fees open, the package on the page
//   NODE_PATH=$(npm root -g) node bluesky-flow.js [--only order-phone]
// The last line is "BLUESKY FLOW: PASS (parts run: N)" or "BLUESKY FLOW: FAIL (parts run: N) - <failed parts>". The two
// marker lines above are read by gate9.sh.
const path = require('path');
const fs = require('fs');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const L9 = require('./lib9.js');

const OUT = path.join(Lib.OUT, 'bluesky-flow');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-picker\.png$/, 'State filings for an offering with investors in New York and California, Texas added by hand: the service fee $100, and the state fees and the filing system\'s fee to be confirmed.'],
  [/-ordered\.png$/, 'The same section once the admin ordered: "$100 due" with fees to be confirmed, and the package staff file from by hand.']
]);

/** The part files of the other Filings plans: answered 404, so this check measures the state filings section alone. */
const ABSENT = L9.LATER.filter((f) => !/^bluesky/.test(f));
const NAV = '.cs-nav a[href="#console-filings"]';
const SEC = '.fl-section[data-part="states"]';
const BACK = { selector: '.fl-bar a.fl-back' };
const NAME = 'Harbor <b>Growth</b> Fund, L.P.';
const ACC = '0001234567-26-000123';

const line = (id) => `.fl-off[data-offering="${id}"] li[data-part="states"]`;
/** The tab, then the offering's State filings line, then its section. */
async function openSection(F, id) {
  await L9.goto(F, 'console-filings', '.fl');
  await F.fr.waitForSelector(line(id), { timeout: 30000 }).catch(() => {});
  const shown = await L9.text(F, line(id));
  if (!shown) return shown;
  await L9.press(F, `${line(id)} a`);
  await F.fr.waitForSelector(SEC, { timeout: 20000 }).catch(() => {});
  return shown;
}
/** The picker as shown: [ { code, ticked, text } ]. */
const picker = (F) =>
  F.fr.evaluate((sec) => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight);
    return Array.from(document.querySelectorAll(`${sec} [data-picker] input[type=checkbox][name=state]`))
      .filter(vis)
      .map((el) => ({ code: el.value, ticked: el.checked, text: (el.closest('li') || el.parentElement).innerText.replace(/\s+/g, ' ').trim() }));
  }, SEC);
const filings = (F) => F.fr.evaluate(() => JSON.parse(JSON.stringify(window.CVPortal.state.ws.filings || null)));
/** Every dollar amount in an element's text. */
const amounts = (s) => String(s).match(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d\d)?/g) || [];
async function addState(F, code) {
  await F.fr.selectOption(`${SEC} select[name="add"]`, code);
  await F.fr.waitForTimeout(400);
}

/** The tracer: the states where investors live are ticked, Texas is added, the order is recorded at $100, the package is shown. */
async function order(size, { check, S }) {
  const F = await L9.framed(S, size, { absent: ABSENT });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 30, state: 'NY', funded: true }, { daysAgo: 20, state: 'CA' }, { daysAgo: 10, state: 'NY' }], notices: [{ type: 'D', daysAgo: 25, accession: ACC }] });
  const id = seeded.offeringId;
  const firstNY = seeded.sales[0].date;
  const firstCA = seeded.sales[1].date;
  await L9.press(F, NAV);
  const shown = await openSection(F, id);
  check('the tab shows the offering\'s State filings line, with the states that have sales', /State filings/.test(shown) && /2 states with sales/.test(shown), shown);
  if (!shown) return F.A.context.close();
  const at = await F.fr.evaluate(() => ({ hash: location.hash, route: window.CVPortal.state.route, title: ((document.querySelector('.fl-bar-title') || {}).innerText || '').trim() }));
  check('tapping it opens the section at console-filings-states-<offering>, under the bar with Back and the offering\'s name as text', at.hash === `#console-filings-states-${id}` && at.route === 'console-filings' && at.title === NAME && (await F.fr.locator(`${SEC} .fl-bar b`).count()) === 0, at);
  let p = await picker(F);
  const ny = p.find((x) => x.code === 'NY') || {};
  const ca = p.find((x) => x.code === 'CA') || {};
  check('New York and California are ticked, each with its first sale date, and nothing else is', p.length === 2 && ny.ticked && ca.ticked && ny.text.indexOf(`First sale ${L9.label(firstNY)}`) >= 0 && ca.text.indexOf(`First sale ${L9.label(firstCA)}`) >= 0 && /New York/.test(ny.text) && /California/.test(ca.text), p);
  const acc = await L9.text(F, `${SEC} [data-formd]`);
  check('the Form D the state notices are filed from is named with its accession number', acc.indexOf(ACC) >= 0, acc);
  await addState(F, 'TX');
  p = await picker(F);
  check('Texas, added by hand, is ticked too', p.length === 3 && p.every((x) => x.ticked) && (p.find((x) => x.code === 'TX') || {}).text.indexOf('Texas') >= 0, p);
  const fees = await L9.text(F, `${SEC} [data-fees]`);
  const all = await L9.text(F, SEC);
  const note = await L9.text(F, `${SEC} [data-fees-note]`);
  check('the service fee is shown as $100, each of the three states\' fees and the filing system\'s fee as to be confirmed', /\$100\b/.test(fees) && /New York[^\n]*\n?\s*To be confirmed/.test(fees) && /California[^\n]*\n?\s*To be confirmed/.test(fees) && /Texas[^\n]*\n?\s*To be confirmed/.test(fees) && /Filing system fee[^\n]*\n?\s*To be confirmed/.test(fees), fees);
  check('the screen says state fees and the filing system\'s fee are confirmed when the order is reviewed', /State fees and the filing system.s fee are confirmed when the order is reviewed/.test(note), note);
  check('no amount other than the $100 service fee is anywhere on the section', amounts(all).length >= 1 && amounts(all).every((a) => a === '$100'), amounts(all));
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-picker.png`), fullPage: false });
  // W-3: a reload at the section's address. What is ticked is not stored until it is ordered: the ticks go back to the states
  // with sales.
  await F.reload(`console-filings-states-${id}`);
  await F.fr.waitForSelector(SEC, { timeout: 30000 }).catch(() => {});
  p = await picker(F);
  check('a reload at the section\'s address shows the section again, with the states that have sales ticked (Texas was not ordered, so not kept)', p.length === 2 && p.every((x) => x.ticked) && p.map((x) => x.code).sort().join() === 'CA,NY', p);
  await L9.wayOut(check, F, 'the section after a reload: Back stays on screen', BACK);
  await addState(F, 'TX');
  // The admin orders.
  const orderBtn = `${SEC} [data-action="bs-order"]`;
  check('the admin has the order control', (await F.fr.locator(orderBtn).count()) === 1);
  await L9.press(F, orderBtn);
  const fl = await filings(F);
  const o = ((fl && fl.orders) || []).filter((x) => x.kind === 'bluesky').slice(-1)[0] || {};
  const pass = (o.lines || []).filter((l) => l.passThrough);
  check('one order of kind bluesky is recorded at $100 due, with fees open', o.offeringId === id && o.dueCents === 10000 && o.openFees === true && o.status === 'recorded' && (o.lines || [])[0].cents === 10000 && /any number of states/.test((o.lines || [])[0].label), o);
  check('its pass-through lines are the three states and the filing system, each with no amount', pass.length === 4 && pass.every((l) => l.cents === null) && pass.slice(0, 3).map((l) => l.state).join() === 'CA,NY,TX' && /Filing system fee/.test(pass[3].label), pass);
  const pk = o.package || {};
  check('the order carries the package: the issuer, the accession number and the three states', pk.issuer && pk.issuer.name === NAME && pk.accession === ACC && (pk.states || []).map((s) => s.code).join() === 'CA,NY,TX', pk);
  const st = (fl && fl.offerings && fl.offerings[id] && fl.offerings[id].states) || {};
  check('each ordered state is on the record as ordered, with no quoted fee (none is confirmed)', ['CA', 'NY', 'TX'].every((c) => st[c] && st[c].status === 'ordered' && st[c].quotedCents === null && !st[c].filedOn), st);
  const ord = await L9.text(F, `${SEC} .fl-order`);
  check('the section shows the order with "$100 due" and the fees still to be confirmed', /\$100 due/.test(ord) && /fees to be confirmed/.test(ord), ord);
  const pack = await L9.text(F, `${SEC} [data-pack]`);
  check('the package on the page lists the issuer (as text) and the accession number', pack.indexOf(NAME) >= 0 && pack.indexOf(ACC) >= 0 && (await F.fr.locator(`${SEC} [data-pack] b`).count()) === 0, pack);
  check('and each state with its first sale date, amount sold and investors', /New York[^\n]*/.test(pack) && pack.indexOf(L9.label(firstNY)) >= 0 && /\$200,000/.test(pack) && /2 investors/.test(pack) && pack.indexOf(L9.label(firstCA)) >= 0 && /\$100,000/.test(pack) && /1 investor\b/.test(pack) && /Texas/.test(pack), pack);
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-ordered.png`), fullPage: false });
  await F.reload(`console-filings-states-${id}`);
  await F.fr.waitForSelector(`${SEC} .fl-order`, { timeout: 30000 }).catch(() => {});
  check('after a reload the order and its package are still on the section', /\$100 due/.test(await L9.text(F, `${SEC} .fl-order`)) && (await L9.text(F, `${SEC} [data-pack]`)).indexOf(ACC) >= 0);
  await L9.wayOut(check, F, 'the section with the order: Back stays on screen', BACK);
  await L9.leak(check, F, 'the section');
  await L9.quiet(check, F);
  await F.A.context.close();
}

const PARTS = {
  'order-phone': (ctx) => order('phone', ctx)
};

Lib.runParts(PARTS, { name: 'BLUESKY FLOW', browser: true });
