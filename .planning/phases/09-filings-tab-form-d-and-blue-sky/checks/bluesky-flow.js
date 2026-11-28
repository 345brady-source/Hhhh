// gate: browser
// last "BLUESKY FLOW: PASS (parts run: 4)"
// Plan 09-07: the state filings section of the Filings tab, as the owner tests it: inside a sandboxed iframe whose policy
// refuses every connection, with no server, on a 390x844 touch screen (-phone) and at 1280x800 (-desktop). The part files
// of the other Filings plans are answered 404, so the section is measured alone.
//   order-phone     an offering with sales in New York and California and a filed Form D: the tab's State filings line; the
//                   section with both states ticked and the first sale date in each; Texas added by hand; the service fee
//                   $100 and the state fees and the filing system's fee to be confirmed, with no other amount; a reload at
//                   the section's address; the admin orders: "$100 due", the fees open, the package on the page
//   order-desktop   the same path at 1280x800, where no Form D is on record yet: the section asks for the date and accession
//                   number of the notice the sponsor filed before anything can be ordered (angle brackets typed are shown
//                   as text); an investor with no state on file is said in one line; un-ticking every state leaves nothing
//                   to order; the package names the admin's contact; a team member sees the section and cannot order
//   results-phone,  before any result the tab's State notices row opens to "State notice: New York", "First sale in the state
//   results-desktop on <date>", "To file", counted; New York's result recorded on the section (a team member records it on
//                   the desktop) removes that reminder and shows the state filed with its date and filing ID; the quoted and
//                   the paid fee are both shown with the difference; a renewal date 20 days ahead shows a renewal reminder
//                   in the tab with its date; "Order renewal" records an order of kind bluesky-renewal with "$50 due";
//                   silencing the renewal reminder takes it off the count and keeps it listed
//   NODE_PATH=$(npm root -g) node bluesky-flow.js [--only order-phone,order-desktop,results-phone,results-desktop]
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
  [/-ordered\.png$/, 'The same section once the admin ordered: "$100 due" with fees to be confirmed, and the package staff file from by hand.'],
  [/-result\.png$/, 'New York\'s result recorded: filed with its date and filing ID, the fee paid beside the fee quoted with the difference, the renewal date and Order renewal.'],
  [/-renewal\.png$/, 'The Filings tab once New York renews in 20 days: the renewal reminder with its date, beside California\'s notice still to file.']
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
  const desk = size === 'desktop';
  // On the desktop no Form D is on record yet, and one more sale comes from an investor whose address names no state.
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 30, state: 'NY', funded: true }, { daysAgo: 20, state: 'CA' }, { daysAgo: 10, state: 'NY' }].concat(desk ? [{ daysAgo: 5, state: 'NY' }] : []), notices: desk ? [] : [{ type: 'D', daysAgo: 25, accession: ACC }] });
  const id = seeded.offeringId;
  const firstNY = seeded.sales[0].date;
  const firstCA = seeded.sales[1].date;
  if (desk)
    await F.fr.evaluate((iid) => {
      const NS = window.CVPortal;
      NS.state.ws.investors.find((i) => i.id === iid).address = '';
      NS.app.save(true);
    }, seeded.sales[3].investorId);
  await L9.press(F, NAV);
  const shown = await openSection(F, id);
  check('the tab shows the offering\'s State filings line, with the states that have sales', /State filings/.test(shown) && /2 states with sales/.test(shown), shown);
  if (!shown) return F.A.context.close();
  if (desk) await noFormD(F, check, id);
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
  if (desk) {
    for (const c of ['CA', 'NY', 'TX']) await L9.press(F, `${SEC} [data-picker] input[value="${c}"]`);
    p = await picker(F);
    check('un-ticking every state leaves nothing to order: no fee lines and no order control', p.length === 3 && p.every((x) => !x.ticked) && (await F.fr.locator(`${SEC} [data-fees]`).count()) === 0 && (await F.fr.locator(`${SEC} [data-action="bs-order"]`).count()) === 0, p);
    for (const c of ['CA', 'NY', 'TX']) await L9.press(F, `${SEC} [data-picker] input[value="${c}"]`);
    check('ticking them again brings the order back', (await picker(F)).every((x) => x.ticked) && (await F.fr.locator(`${SEC} [data-action="bs-order"]`).count()) === 1);
  }
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
  if (desk) {
    // The admin on the team list; a workspace never opened at Team has none, and the firm's support contact is named.
    const admin = await F.fr.evaluate(() => {
      const ws = window.CVPortal.state.ws;
      const sup = ws.tenant.support || {};
      const m = (ws.team || []).find((x) => x.role === 'admin' && x.current) || (ws.team || []).find((x) => x.role === 'admin' && x.status !== 'invited');
      return m ? { name: m.name, email: m.email || sup.email } : { name: sup.team, email: sup.email };
    });
    check('the package names the admin\'s contact (the firm\'s support contact when no team list is on record)', !!admin.name && pack.indexOf(admin.name) >= 0 && (!admin.email || pack.indexOf(admin.email) >= 0) && pk.contact && pk.contact.name === admin.name, { admin, contact: pk.contact });
  }
  check('and each state with its first sale date, amount sold and investors', /New York[^\n]*/.test(pack) && pack.indexOf(L9.label(firstNY)) >= 0 && /\$200,000/.test(pack) && /2 investors/.test(pack) && pack.indexOf(L9.label(firstCA)) >= 0 && /\$100,000/.test(pack) && /1 investor\b/.test(pack) && /Texas/.test(pack), pack);
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-ordered.png`), fullPage: false });
  await F.reload(`console-filings-states-${id}`);
  await F.fr.waitForSelector(`${SEC} .fl-order`, { timeout: 30000 }).catch(() => {});
  check('after a reload the order and its package are still on the section', /\$100 due/.test(await L9.text(F, `${SEC} .fl-order`)) && (await L9.text(F, `${SEC} [data-pack]`)).indexOf(ACC) >= 0);
  await L9.wayOut(check, F, 'the section with the order: Back stays on screen', BACK);
  await L9.leak(check, F, 'the section');
  if (desk) {
    await L9.role(F, 'team');
    await L9.goto(F, `console-filings-states-${id}`, SEC);
    const team = { section: await F.fr.locator(SEC).count(), order: await F.fr.locator(`${SEC} [data-action="bs-order"]`).count(), pack: await L9.text(F, `${SEC} [data-pack]`), controls: await F.fr.evaluate((sec) => Array.from(document.querySelectorAll(`${sec} button`)).map((b) => b.innerText.trim()), SEC) };
    check('a team member sees the section and its package, and has no order control', team.section === 1 && team.order === 0 && team.pack.indexOf(ACC) >= 0 && !team.controls.some((t) => /^order/i.test(t)), team);
    await L9.role(F, 'admin');
  }
  await L9.quiet(check, F);
  await F.A.context.close();
}

/** Desktop: no Form D on record, an investor with no state on file. */
async function noFormD(F, check, id) {
  const un = await F.fr.evaluate((sec) => {
    const el = document.querySelector(`${sec} [data-unplaced]`);
    return el ? { text: el.innerText.replace(/\s+/g, ' ').trim(), href: (el.querySelector('a') || { getAttribute: () => '' }).getAttribute('href') } : null;
  }, SEC);
  check('one line says an investor has no state on file and is not ticked, with the way to the investor list', !!un && /^1 investor with no state on file: their state is not ticked/.test(un.text) && un.href === '#console-investors', un);
  const form = `${SEC} form[data-form="bs-formd"]`;
  check('with no Form D on record the section asks for the date and accession number of the notice the sponsor filed, and offers no order', (await F.fr.locator(form).count()) === 1 && (await F.fr.locator(`${form} [name="filedOn"]`).count()) === 1 && (await F.fr.locator(`${form} [name="accession"]`).count()) === 1 && (await F.fr.locator(`${SEC} [data-action="bs-order"]`).count()) === 0);
  await F.fr.fill(`${form} [name="filedOn"]`, L9.iso(await F.fr.evaluate(() => window.CVPortal.dates.today()), -25));
  await F.fr.fill(`${form} [name="accession"]`, '<b>0001234567</b>');
  await L9.press(F, `${form} button[type=submit]`);
  const err = await L9.text(F, `${form} .field-error`);
  const kept = await F.fr.inputValue(`${form} [name="accession"]`).catch(() => '');
  const notices = await F.fr.evaluate((oid) => (((window.CVPortal.state.ws.filings || {}).offerings || {})[oid] || { formD: [] }).formD.length, id);
  check('an accession number typed with angle brackets is refused in one sentence, kept in the field as text, and nothing is recorded', err.trim().length > 0 && err.trim().split(/[.!?]\s/).length === 1 && kept === '<b>0001234567</b>' && (await F.fr.locator(`${SEC} b`).count()) === 0 && notices === 0, { err, kept, notices });
  await F.fr.fill(`${form} [name="accession"]`, ACC);
  await L9.press(F, `${form} button[type=submit]`);
  const r = await F.fr.evaluate((oid) => JSON.parse(JSON.stringify(window.CVPortal.state.ws.filings.offerings[oid].formD)), id);
  check('with the date and the accession number the notice is recorded as the sponsor\'s own, and the order control appears', r.length === 1 && r[0].type === 'D' && r[0].source === 'self' && r[0].accession === ACC && r[0].status === 'accepted' && (await F.fr.locator(`${SEC} [data-action="bs-order"]`).count()) === 1 && (await F.fr.locator(form).count()) === 0, r);
}

const MENU = (F) => F.fr.evaluate((sel) => ((document.querySelector(sel) || { querySelector: () => null }).querySelector('.cs-nav-count') || { textContent: '' }).textContent.trim(), NAV);
const rowSel = (key) => `.fl-row[data-key="${key}"]`;
/** The tab with the offering's State notices row open (09-03's tab as built: one row that opens to the states). */
async function tabStates(F, id) {
  await L9.goto(F, 'console-filings', '.fl');
  await F.fr.waitForSelector(line(id), { timeout: 30000 }).catch(() => {});
  const head = `.fl-off[data-offering="${id}"] [data-action="fl-open"][data-id="states:${id}"]`;
  if ((await F.fr.locator(head).count()) && (await F.fr.getAttribute(head, 'aria-expanded')) !== 'true') await L9.press(F, head);
}
const rowText = (F, key) => L9.text(F, rowSel(key));

/** Per-state results, the renewal and its reminder. On the desktop a team member records the result. */
async function results(size, { check, S }) {
  const F = await L9.framed(S, size, { absent: ABSENT });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const desk = size === 'desktop';
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 30, state: 'NY', funded: true }, { daysAgo: 20, state: 'CA' }], notices: [{ type: 'D', daysAgo: 25, accession: ACC }] });
  const id = seeded.offeringId;
  const today = seeded.today;
  const firstNY = seeded.sales[0].date;
  await L9.press(F, NAV);
  await tabStates(F, id);
  const ny = `state-first:${id}:NY`;
  let t = await rowText(F, ny);
  const pill = await L9.text(F, `${rowSel(ny)} .fl-pill`);
  check('before any result the tab\'s State notices row opens to "State notice: New York", first sale in the state on its date, "To file", with no due date', /State notice: New York/.test(t) && t.indexOf(`First sale in the state on ${L9.label(firstNY)}`) >= 0 && pill.trim() === 'To file' && !/Due /.test(t), { t, pill });
  check('it is counted beside Filings (New York and California)', (await MENU(F)) === '2', await MENU(F));
  // A test row for New York in the page's table (invented source), so a fee is quoted: what plan 09-10's rows will do.
  await F.fr.evaluate((d) => Object.assign(window.CVPortal.blueskyData.table.NY, { confirmed: true, noticeRequired: true, fee: { kind: 'fixed', cents: 30000 }, source: 'test row, invented for this check', readOn: d }), today);
  await L9.goto(F, `console-filings-states-${id}`, SEC);
  await L9.press(F, `${SEC} [data-action="bs-order"]`);
  let fl = await filings(F);
  check('the order keeps New York\'s quoted fee on the record, and its line has no amount until the fee paid is recorded', fl.offerings[id].states.NY.quotedCents === 30000 && fl.offerings[id].states.NY.status === 'ordered' && fl.orders.slice(-1)[0].lines.every((l) => !l.passThrough || l.cents === null), { NY: fl.offerings[id].states.NY, lines: fl.orders.slice(-1)[0].lines });
  if (desk) {
    await L9.role(F, 'team');
    await L9.goto(F, `console-filings-states-${id}`, SEC);
  }
  const form = `${SEC} form[data-form="bs-result"][data-code="NY"]`;
  await L9.press(F, `${SEC} [data-action="bs-form"][data-code="NY"]`);
  check(`${desk ? 'a team member' : 'the admin'} opens New York's result form`, (await F.fr.locator(form).count()) === 1);
  const filedOn = L9.iso(today, -1);
  const renewsOn = L9.iso(today, 20);
  const efd = desk ? 'NY<i>2026</i>-1' : 'NY-2026-1';
  await F.fr.fill(`${form} [name="filedOn"]`, filedOn);
  await F.fr.fill(`${form} [name="efdId"]`, efd);
  await F.fr.fill(`${form} [name="fee"]`, '350');
  await F.fr.fill(`${form} [name="renewsOn"]`, renewsOn);
  await L9.press(F, `${form} button[type=submit]`);
  fl = await filings(F);
  const st = fl.offerings[id].states.NY;
  check('the result is recorded: filed, with its date, filing ID, fee paid and renewal date', st.status === 'filed' && st.filedOn === filedOn && st.efdId === efd && st.feeCents === 35000 && st.renewsOn === renewsOn && st.quotedCents === 30000, st);
  const done = await L9.text(F, `${SEC} [data-done] li[data-state="NY"]`);
  check('the section shows New York filed with its date and filing ID (typed text shown as text)', done.indexOf(`Filed ${L9.label(filedOn)}`) >= 0 && done.indexOf(efd) >= 0 && (await F.fr.locator(`${SEC} [data-done] i`).count()) === 0, done);
  check('the quoted and the paid fee are both shown, with the difference', /Quoted \$300/.test(done) && /paid \$350/.test(done) && /\$50 more than quoted/.test(done), done);
  check(desk ? 'a team member has no order control (no Order renewal)' : 'the admin has Order renewal on the state', (await F.fr.locator(`${SEC} [data-action="bs-renew"][data-code="NY"]`).count()) === (desk ? 0 : 1));
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-result.png`), fullPage: false });
  if (desk) await L9.role(F, 'admin');
  await tabStates(F, id);
  const ren = `state-renewal:${id}:NY`;
  t = await rowText(F, ren);
  check('the tab: New York\'s first-notice reminder is gone; its renewal reminder shows with its date', (await F.fr.locator(rowSel(ny)).count()) === 0 && /State notice renewal: New York/.test(t) && t.indexOf(`Due ${L9.label(renewsOn)}`) >= 0, t);
  check('the renewal is counted with California\'s notice', (await MENU(F)) === '2', await MENU(F));
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-renewal.png`), fullPage: false });
  await L9.wayOut(check, F, 'the tab');
  await L9.goto(F, `console-filings-states-${id}`, SEC);
  await L9.press(F, `${SEC} [data-action="bs-renew"][data-code="NY"]`);
  fl = await filings(F);
  const r = fl.orders.slice(-1)[0];
  check('"Order renewal" records an order of kind bluesky-renewal at $50 due: the service fee and New York\'s line', r.kind === 'bluesky-renewal' && r.dueCents === 5000 && r.lines.length === 2 && r.lines[1].state === 'NY' && r.lines[1].cents === null && fl.offerings[id].states.NY.status === 'renewal-ordered', r);
  const shown = await L9.text(F, `${SEC} .fl-order[data-order="${r.id}"]`);
  check('the section shows the renewal order with "$50 due"', /\$50 due/.test(shown) && /renewal/i.test(shown), shown);
  await L9.wayOut(check, F, 'the section with its results: Back stays on screen', BACK);
  await L9.leak(check, F, 'the section with its results');
  await tabStates(F, id);
  await L9.press(F, `${rowSel(ren)} [data-action="fl-silence"]`);
  const after = await rowText(F, ren);
  check('silencing the renewal reminder takes it off the count and keeps it listed', (await MENU(F)) === '1' && /Silenced/.test(after) && /State notice renewal: New York/.test(after), { menu: await MENU(F), after });
  await L9.leak(check, F, 'the tab');
  await L9.quiet(check, F);
  await F.A.context.close();
}

const PARTS = {
  'order-phone': (ctx) => order('phone', ctx),
  'order-desktop': (ctx) => order('desktop', ctx),
  'results-phone': (ctx) => results('phone', ctx),
  'results-desktop': (ctx) => results('desktop', ctx)
};

Lib.runParts(PARTS, { name: 'BLUESKY FLOW', browser: true });
