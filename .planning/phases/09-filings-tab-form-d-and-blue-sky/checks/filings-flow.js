// gate: browser
// last "FILINGS FLOW: PASS (parts run: 8)"
// Plan 09-03: the Filings tab of the self-serve console, as the owner tests it: inside a sandboxed iframe whose policy
// refuses every connection, with no server, on a 390x844 touch screen (-phone) and at 1280x800 (-desktop). Every part
// answers 404 for the part files later plans add beside filings-ui.js, so it measures the tab alone and stays valid after
// those plans land.
//   tab-phone, tab-desktop       the menu entry with its count opens the page; an overdue first Form D with its date and
//                                reason, and a state notice with the first sale date and no due date; the overview's item
//   silence-phone, -desktop      Silence and Turn back on, one reminder and the whole offering; the menu count and the
//                                overview follow; the choice is still there after a reload
//   own-phone, own-desktop       one sale counted once; the first sale date and where it came from; a notice the sponsor
//                                filed; an offering that ended; an order with the amount due; an offering not filing
//   published                    the published page (portal.html) has the same entry and page
//   filed-long-ago               twenty states: one row that opens; the notices recorded as filed one by one and together;
//                                the sponsor's own Form D and amendment recorded; the menu count follows
//   NODE_PATH=$(npm root -g) node filings-flow.js [--only tab-phone,tab-desktop,silence-phone,silence-desktop,own-phone,own-desktop,published,filed-long-ago]
// The last line is "FILINGS FLOW: PASS (parts run: N)" or "FILINGS FLOW: FAIL (parts run: N) - <failed parts>". The two
// marker lines above are read by gate9.sh.
const path = require('path');
const fs = require('fs');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const L9 = require('./lib9.js');

const OUT = path.join(Lib.OUT, 'filings-flow');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-tab\.png$/, 'The Filings tab for an offering whose first sale was 20 days ago: the first Form D overdue with its date and reason, and the state notice.'],
  [/-silenced\.png$/, 'One reminder silenced: it stays, greyed, with its date and Turn back on; the count beside Filings is one lower.'],
  [/-own\.png$/, 'After the sponsor recorded a Form D they filed themselves: the annual amendment with its date, and an order with the amount due.'],
  [/-states\.png$/, 'An offering sold in twenty states: one row for the state notices, opened to the states.'],
  [/-filed\.png$/, 'The same offering once its notices are recorded as filed: nothing is counted beside Filings.']
]);

const NAV = '.cs-nav a[href="#console-filings"]';
const row = (key) => `.fl-row[data-key="${key}"]`;
/** The offering's name carries angle brackets: the tab must show them as text (T-09-07). */
const NAME = 'Harbor <b>Growth</b> Fund, L.P.';
/** The module under test, for the dates the screen must show (its date rules are proven by filings-math.js). */
const filings = () => require(path.join(Lib.ROOT, 'assets/js/filings.js'));
const firstDue = (first) => filings().businessDay(L9.iso(first, 15));
/** One year after a date that is not 29 February, moved off a weekend or holiday. */
const annualDue = (filedOn) => filings().businessDay(`${Number(filedOn.slice(0, 4)) + 1}${filedOn.slice(4)}`);

/** What the menu shows for Filings: { there, label, count }. */
const menu = (F) =>
  F.fr.evaluate((sel) => {
    const a = document.querySelector(sel);
    const n = a && a.querySelector('.cs-nav-count');
    return { there: !!a, label: a ? a.childNodes[0].textContent.trim() : '', count: n ? n.textContent.trim() : '' };
  }, NAV);
/** The overview's Needs attention items that link to the tab. */
async function attention(F) {
  await L9.goto(F, 'console', '.cs-panel');
  const items = await F.fr.evaluate(() => Array.from(document.querySelectorAll('.cs-list a[href="#console-filings"]')).map((a) => a.innerText.trim()));
  await L9.goto(F, 'console-filings', '.fl');
  return items;
}
/** The reminder rows of an offering on screen: [ { key, text, off, date } ]. */
const rows = (F, offeringId) =>
  F.fr.evaluate((id) => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight);
    return Array.from(document.querySelectorAll(`.fl-off[data-offering="${id}"] .fl-row[data-key]`))
      .filter(vis)
      .map((el) => ({ key: el.getAttribute('data-key'), text: el.innerText.replace(/\s+/g, ' ').trim(), off: el.classList.contains('is-off'), date: ((el.querySelector('.fl-date') || {}).innerText || '').trim() }));
  }, offeringId);
const rec = (F, offeringId) => F.fr.evaluate((id) => JSON.parse(JSON.stringify((window.CVPortal.state.ws.filings || { offerings: {} }).offerings[id] || null)), offeringId);
const silenced = (F) => F.fr.evaluate(() => Object.keys((window.CVPortal.state.ws.filings || {}).silenced || {}).sort());
const log = (F) => F.fr.evaluate(() => (window.CVPortal.state.ws.audit || []).map((e) => e.action));
const sticky = (F) => F.fr.evaluate(() => (document.querySelector('.fl-bar') ? getComputedStyle(document.querySelector('.fl-bar')).position : 'no bar'));
async function openTab(F) {
  await L9.press(F, NAV);
  await F.fr.waitForSelector('.fl', { timeout: 20000 });
}
/** A date typed into a form's field, then its Save. */
async function save(F, form, values) {
  for (const name of Object.keys(values)) await F.fr.fill(`${form} [name="${name}"]`, values[name]);
  await L9.press(F, `${form} button[type=submit]`);
}

/** The tab for an offering whose first sale, to three investors in New York, was 20 days ago. */
async function tab(size, { check, S }, page) {
  const F = await L9.framed(S, size, { absent: L9.LATER, page });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 20, state: 'NY', funded: true }, { daysAgo: 12, state: 'NY' }, { daysAgo: 3, state: 'NY' }] });
  const first = seeded.sales[0].date;
  const due = firstDue(first);
  const m = await menu(F);
  check('the console menu has Filings with the count 2 (the first Form D and the New York notice)', m.there && m.label === 'Filings' && m.count === '2', m);
  if (!m.there) return F.A.context.close();
  if (size === 'desktop') {
    const items = await F.fr.evaluate(() => Array.from(document.querySelectorAll('.cs-list a[href="#console-filings"]')).map((a) => a.innerText.trim()));
    check('the overview\'s Needs attention has one item linking to the tab, with the count', items.length === 1 && /^2 filings/.test(items[0]), items);
  }
  await openTab(F);
  const at = await F.fr.evaluate(() => ({ hash: location.hash, route: window.CVPortal.state.route, h1: (document.querySelector('.fl h1') || {}).innerText || '' }));
  check(`${F.phone ? 'tapping' : 'clicking'} it opens the page`, at.hash === '#console-filings' && at.route === 'console-filings' && at.h1 === 'Filings', at);
  await F.A.page.screenshot({ path: path.join(OUT, `${page ? 'published' : size}-tab.png`), fullPage: false });
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
  if (size === 'desktop' || page) {
    const pos = await sticky(F);
    check('the tab\'s stylesheet is loaded (the bar with the way out stays on screen)', pos === 'sticky', pos);
  }
  await L9.wayOut(check, F, 'the list');
  await L9.leak(check, F, 'the list');
  await L9.quiet(check, F);
  await F.A.context.close();
}

/** Silence and Turn back on: one reminder, then the whole offering; the count and the overview follow; a reload keeps it. */
async function silence(size, { check, S }) {
  const F = await L9.framed(S, size, { absent: L9.LATER });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 20, state: 'NY', funded: true }] });
  const id = seeded.offeringId;
  const due = firstDue(seeded.sales[0].date);
  const fd = `formd-first:${id}`;
  const ny = `state-first:${id}:NY`;
  await openTab(F);
  check('before: two reminders counted', (await menu(F)).count === '2', await menu(F));
  await L9.press(F, `${row(fd)} [data-action="fl-silence"]`);
  let r = (await rows(F, id)).find((x) => x.key === fd) || {};
  const back = await F.fr.locator(`${row(fd)} [data-action="fl-unsilence"]`).innerText().catch(() => '');
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-silenced.png`), fullPage: false });
  check('Silence on the first Form D lowers the menu count by one, in one tap with no question asked', (await menu(F)).count === '1' && !(await F.fr.evaluate(() => !!(document.getElementById('dlg') || {}).open)), await menu(F));
  check('the silenced reminder stays, greyed, with its date and Turn back on', r.off === true && /Silenced/.test(r.text || '') && r.date === `Due ${L9.label(due)}` && back.trim() === 'Turn back on', { row: r, back });
  let items = await attention(F);
  check('the overview\'s item follows: one filing', items.length === 1 && /^1 filing\b/.test(items[0]), items);
  await L9.press(F, `${row(ny)} [data-action="fl-silence"]`);
  items = await attention(F);
  check('silencing the last one removes the count from the menu and the item from the overview', (await menu(F)).count === '' && items.length === 0, { menu: await menu(F), items });
  await L9.press(F, `${row(fd)} [data-action="fl-unsilence"]`);
  r = (await rows(F, id)).find((x) => x.key === fd) || {};
  items = await attention(F);
  check('Turn back on restores the reminder, the count and the overview\'s item', r.off === false && /Overdue/.test(r.text || '') && (await menu(F)).count === '1' && items.length === 1, { row: r, menu: await menu(F), items });
  await L9.press(F, `${row(ny)} [data-action="fl-unsilence"]`);
  check('both turned back on: two counted, nothing silenced on the record', (await menu(F)).count === '2' && (await silenced(F)).length === 0, { menu: await menu(F), silenced: await silenced(F) });
  await L9.press(F, `[data-action="fl-silence"][data-key="offering:${id}"]`);
  let all = await rows(F, id);
  check('silencing the whole offering greys every one of its reminders and counts none', all.length === 2 && all.every((x) => x.off) && (await menu(F)).count === '' && (await silenced(F)).join() === `offering:${id}`, { rows: all, menu: await menu(F), silenced: await silenced(F) });
  await L9.quiet(check, F, 'before the reload');
  await F.reload('console-filings');
  await F.fr.waitForSelector('.fl', { timeout: 20000 });
  all = await rows(F, id);
  check('after a reload of the framed page the choice is still there', all.length === 2 && all.every((x) => x.off) && (await menu(F)).count === '', { rows: all, menu: await menu(F) });
  await L9.press(F, `[data-action="fl-unsilence"][data-key="offering:${id}"]`);
  all = await rows(F, id);
  check('Turn all back on restores them', all.length === 2 && all.every((x) => !x.off) && (await menu(F)).count === '2', { rows: all, menu: await menu(F) });
  const actions = await log(F);
  check('each change is in the change log', actions.indexOf('Filing reminder silenced') >= 0 && actions.indexOf('Filing reminder turned back on') >= 0, actions.slice(0, 12));
  await L9.wayOut(check, F, 'the list');
  await L9.leak(check, F, 'the list');
  await L9.quiet(check, F, 'after the reload');
  await F.A.context.close();
}

/** What the sponsor records themselves: the first sale date, a notice they filed, an ended offering, not filing; and an order. */
async function own(size, { check, S }) {
  const F = await L9.framed(S, size, { absent: L9.LATER });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 20, state: 'NY' }] });
  const id = seeded.offeringId;
  const today = seeded.today;
  const first = seeded.sales[0].date;
  const panel = `.fl-off[data-offering="${id}"]`;
  const fd = `formd-first:${id}`;
  await openTab(F);
  // C5: one definition of a sale
  let all = await rows(F, id);
  let facts = await L9.text(F, `${panel} .fl-facts`);
  check('an approved subscription that is not funded yet raises the first Form D reminder on its own', all.some((x) => x.key === fd && x.date === `Due ${L9.label(firstDue(first))}`) && /\b1 investor\b/.test(facts), { rows: all, facts });
  check('the first sale date shown is the suggestion, with where it came from', facts.indexOf(`First sale ${L9.label(first)}`) >= 0 && /earliest sale on record/.test(facts), facts);
  await F.fr.evaluate((rid) => {
    const NS = window.CVPortal;
    NS.ops.markFunded(NS.state.ws, NS.state.ws.requests.find((r) => r.id === rid));
    NS.app.render();
  }, seeded.sales[0].requestId);
  facts = await L9.text(F, `${panel} .fl-facts`);
  check('once funded it is not counted twice: the investor count shown is still 1, and two reminders are counted', /\b1 investor\b/.test(facts) && (await menu(F)).count === '2', { facts, menu: await menu(F) });
  // the first sale date confirmed by the sponsor
  const earlier = L9.iso(today, -30);
  await L9.press(F, `${panel} [data-action="fl-open"][data-id="options:${id}"]`);
  await save(F, `${panel} form[data-form="fl-first"]`, { firstSale: earlier });
  all = await rows(F, id);
  facts = await L9.text(F, `${panel} .fl-facts`);
  check('confirming another first sale date moves the due date, and the page says the date is the one confirmed', all.some((x) => x.key === fd && x.date === `Due ${L9.label(firstDue(earlier))}`) && facts.indexOf(`First sale ${L9.label(earlier)}`) >= 0 && /confirmed/.test(facts) && (await rec(F, id)).firstSale === earlier, { rows: all, facts });
  // a notice the sponsor filed themselves
  await L9.press(F, `${row(fd)} [data-action="fl-form"]`);
  await L9.press(F, `${panel} form[data-form="fl-filed"] button[type=submit]`);
  const err = await L9.text(F, `${panel} form[data-form="fl-filed"] .field-error`);
  check('"I filed this myself" without a date says so in one sentence and records nothing', err.trim().length > 0 && err.trim().split(/[.!?]\s/).length === 1 && (await rec(F, id)).formD.length === 0, { err, rec: await rec(F, id) });
  const filedOn = L9.iso(today, -10);
  await save(F, `${panel} form[data-form="fl-filed"]`, { filedOn, accession: '0001234567-26-000123' });
  all = await rows(F, id);
  let r = await rec(F, id);
  const annual = all.find((x) => x.key === `formd-annual:${id}`) || {};
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-own.png`), fullPage: false });
  check('with the date (and the accession number) the first Form D reminder goes and the annual amendment shows with its date', !all.some((x) => x.key === fd) && annual.date === `Due ${L9.label(annualDue(filedOn))}` && annual.text.indexOf(L9.label(filedOn)) >= 0, { rows: all, want: L9.label(annualDue(filedOn)) });
  check('the notice is on the record as filed by the sponsor', r.formD.length === 1 && r.formD[0].type === 'D' && r.formD[0].source === 'self' && r.formD[0].filedOn === filedOn && r.formD[0].accession === '0001234567-26-000123' && r.formD[0].status === 'accepted', r.formD);
  check('the annual amendment is a year away, so only the state notice is counted', (await menu(F)).count === '1', await menu(F));
  // an offering that ended
  await save(F, `${panel} form[data-form="fl-ended"]`, { ended: L9.iso(today, -1) });
  all = await rows(F, id);
  check('a closing date removes the annual amendment reminder', !all.some((x) => x.key === `formd-annual:${id}`) && (await rec(F, id)).ended === L9.iso(today, -1), all);
  // an order (plans 09-04 and 09-07 record them; here through the record's own writer)
  const order = await F.fr.evaluate((oid) => {
    const NS = window.CVPortal;
    const o = NS.filings.addOrder(NS.state.ws, { kind: 'formd', offeringId: oid, by: 'check' });
    NS.app.render();
    return o;
  }, id);
  const shown = await L9.text(F, `${panel} .fl-order[data-order="${order.id}"]`);
  const note = await L9.text(F, '.fl-connect');
  check('an order shows its lines, "$100 due" and its status', /Form D filing/.test(shown) && /\$100 due/.test(shown) && /Recorded/.test(shown) && order.dueCents === 10000, { shown, order });
  check('one plain line says that sending an order needs the portal connected to its server', /connected to its server/.test(note) && note.trim().split('\n').length === 1 && (await F.fr.locator('.fl-connect').count()) === 1, note);
  // not filing
  await L9.press(F, `${panel} [data-action="fl-mode"][data-mode="none"]`);
  all = await rows(F, id);
  check('marking the offering as not filing removes its reminders and its count', all.length === 0 && (await menu(F)).count === '' && (await rec(F, id)).mode === 'none', { rows: all, menu: await menu(F) });
  await L9.press(F, `${panel} [data-action="fl-mode"][data-mode=""]`);
  all = await rows(F, id);
  check('and it can be turned back on', all.some((x) => x.key === `state-first:${id}:NY`) && (await rec(F, id)).mode === '', all);
  const required = await F.fr.locator('.fl [required], .fl [aria-required="true"]').count();
  check('nothing on the page is required', required === 0, required);
  const actions = await log(F);
  check('each change is in the change log', ['First sale date confirmed', 'Form D notice recorded as filed', 'Offering end date recorded', 'Offering marked as not filing'].every((a) => actions.indexOf(a) >= 0), actions.slice(0, 14));
  await L9.wayOut(check, F, 'the list with its options open');
  await L9.leak(check, F, 'the list');
  await L9.quiet(check, F);
  await F.A.context.close();
}

const STATES20 = ['NY', 'CA', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI'];
/** C6: an offering that has been selling for over a year in twenty states must not be noise for a sponsor who filed long ago. */
async function filedLongAgo({ check, S }) {
  const F = await L9.framed(S, 'phone', { absent: L9.LATER });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await L9.seed(F, { name: NAME, sales: STATES20.map((state, n) => ({ daysAgo: 420 - n, state, funded: n % 2 === 0 })) });
  const id = seeded.offeringId;
  const today = seeded.today;
  const panel = `.fl-off[data-offering="${id}"]`;
  await openTab(F);
  check('before: the first Form D and twenty state notices are counted', (await menu(F)).count === '21', await menu(F));
  let all = await rows(F, id);
  const group = await L9.text(F, `${panel} .fl-group`);
  check('the twenty state reminders show as one row, not twenty', (await F.fr.locator(`${panel} .fl-group`).count()) === 1 && /State notices/.test(group) && /\b20 states\b/.test(group) && all.filter((x) => /^state-/.test(x.key)).length === 0 && all.length === 1, { group, rows: all.map((x) => x.key) });
  await L9.press(F, `${panel} [data-action="fl-open"][data-id="states:${id}"]`);
  all = await rows(F, id);
  await F.A.page.screenshot({ path: path.join(OUT, 'phone-states.png'), fullPage: false });
  check('the row opens to the twenty states, each with its first sale date', all.filter((x) => /^state-first:/.test(x.key)).length === 20 && all.some((x) => /New York/.test(x.text) && x.text.indexOf(L9.label(seeded.sales[0].date)) >= 0), all.slice(0, 4));
  await L9.wayOut(check, F, 'the twenty states open');
  // one by one
  await L9.press(F, `${row(`state-first:${id}:NY`)} [data-action="fl-form"]`);
  await save(F, `${panel} form[data-form="fl-state"]`, { filedOn: L9.iso(today, -400) });
  all = await rows(F, id);
  let r = await rec(F, id);
  check('one state recorded as filed, with its date: nineteen left, twenty counted, the row still open', all.filter((x) => /^state-first:/.test(x.key)).length === 19 && (await menu(F)).count === '20' && r.states.NY && r.states.NY.filedOn === L9.iso(today, -400) && r.states.NY.source === 'self', { left: all.length, menu: await menu(F), NY: r.states.NY });
  // together
  await L9.press(F, `${panel} .fl-group [data-action="fl-form"][data-kind="states"]`);
  await save(F, `${panel} form[data-form="fl-states"]`, { filedOn: L9.iso(today, -390) });
  all = await rows(F, id);
  r = await rec(F, id);
  check('the other nineteen recorded as filed together, with one date: no state reminder left, one filing counted', all.filter((x) => /^state-/.test(x.key)).length === 0 && (await F.fr.locator(`${panel} .fl-group`).count()) === 0 && Object.keys(r.states).length === 20 && STATES20.slice(1).every((c) => r.states[c].filedOn === L9.iso(today, -390)) && (await menu(F)).count === '1', { rows: all.map((x) => x.key), states: Object.keys(r.states).length, menu: await menu(F) });
  // the sponsor's own Form D, in one action with its date
  await L9.press(F, `${row(`formd-first:${id}`)} [data-action="fl-form"]`);
  await save(F, `${panel} form[data-form="fl-filed"]`, { filedOn: L9.iso(today, -410) });
  all = await rows(F, id);
  const annual = all.find((x) => x.key === `formd-annual:${id}`) || {};
  check('the Form D recorded as filed 410 days ago: the first notice reminder goes, and the annual amendment is overdue with its date', !all.some((x) => /^formd-first/.test(x.key)) && /Overdue/.test(annual.text || '') && annual.date === `Due ${L9.label(annualDue(L9.iso(today, -410)))}` && (await menu(F)).count === '1', { rows: all, menu: await menu(F) });
  // and the amendment they filed since
  await L9.press(F, `${row(`formd-annual:${id}`)} [data-action="fl-form"]`);
  await save(F, `${panel} form[data-form="fl-filed"]`, { filedOn: L9.iso(today, -40) });
  all = await rows(F, id);
  r = await rec(F, id);
  await F.A.page.screenshot({ path: path.join(OUT, 'phone-filed.png'), fullPage: false });
  check('the amendment recorded as filed 40 days ago: the next one is a year after it, and nothing is counted beside Filings', all.length === 1 && all[0].key === `formd-annual:${id}` && all[0].date === `Due ${L9.label(annualDue(L9.iso(today, -40)))}` && !all[0].off && r.formD.length === 2 && r.formD[1].type === 'D/A' && (await menu(F)).count === '', { rows: all, formD: r.formD.map((n) => `${n.type} ${n.filedOn}`), menu: await menu(F) });
  // a mistake can be taken back
  await L9.press(F, `${panel} [data-action="fl-open"][data-id="options:${id}"]`);
  await L9.press(F, `${panel} [data-action="fl-remove-state"][data-code="NY"]`);
  all = await rows(F, id);
  check('a state recorded by mistake can be taken off the record, and its reminder returns', all.some((x) => x.key === `state-first:${id}:NY`) && !(await rec(F, id)).states.NY && (await menu(F)).count === '1', { rows: all.map((x) => x.key), menu: await menu(F) });
  await L9.wayOut(check, F, 'the list with its options open');
  await L9.leak(check, F, 'the list');
  await L9.quiet(check, F);
  await F.A.context.close();
}

const PARTS = {
  'tab-phone': (ctx) => tab('phone', ctx),
  'tab-desktop': (ctx) => tab('desktop', ctx),
  'silence-phone': (ctx) => silence('phone', ctx),
  'silence-desktop': (ctx) => silence('desktop', ctx),
  'own-phone': (ctx) => own('phone', ctx),
  'own-desktop': (ctx) => own('desktop', ctx),
  published: (ctx) => tab('phone', ctx, 'portal.html'),
  'filed-long-ago': filedLongAgo
};

Lib.runParts(PARTS, { name: 'FILINGS FLOW', browser: true });
