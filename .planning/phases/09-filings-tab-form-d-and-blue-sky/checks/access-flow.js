// gate: browser
// last "ACCESS FLOW: PASS (parts run: 4)"
// Plan 09-06: EDGAR access for a new issuer, the EDGAR access section of the Filings tab (assets/js/edgar-access.js), as
// the owner tests it: inside a sandboxed iframe whose policy refuses every connection, with no server, on a 390x844 touch
// screen (-phone) and at 1280x800 (-desktop). The part files of the other phase 9 sections are answered 404, except
// formd.js, whose prefill is how the CIK entered here reaches the Form D notice.
//   steps-phone    the tab's EDGAR access line with how far the issuer is; the seven steps in order with their how-to;
//                  a step marked done with today's date, kept after a reload; a CIK of letters or of 11 digits refused in
//                  one sentence, a valid one stored with the name and read by the Form D prefill; an issuer that already
//                  has a CIK skips the four application steps and starts at the Login.gov sign-in, then the delegation
//   steps-desktop  the same path at 1280x800; a team member marks a step; the delegation step without a filing agent CIK
//                  (the number is sent when the order is reviewed) and with one configured (name inside data-agent, CIK,
//                  Copy into a clipboard that accepts); the ready step's line on the yearly account confirmation
//   sheet-phone    the page opens at the current step; the Form ID answer sheet: parts 1 to 5 in the dashboard's order,
//                  filled from the offering and the record, each answer with Copy; Copy where the frame refuses the
//                  clipboard leaves the value selected; the single-member question; the cautions once each; a reload
//   sheet-desktop  Copy writes exactly the answer; no field for a secret and no secret stored once the sheet is filled
//   NODE_PATH=$(npm root -g) node access-flow.js [--only steps-phone,steps-desktop,sheet-phone,sheet-desktop]
// The last line is "ACCESS FLOW: PASS (parts run: N)" or "ACCESS FLOW: FAIL (parts run: N) - <failed parts>". The two
// marker lines above are read by gate9.sh.
const path = require('path');
const fs = require('fs');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const L9 = require('./lib9.js');

const OUT = path.join(Lib.OUT, 'access-flow');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-steps\.png$/, 'EDGAR access for an issuer with no account: the seven steps in order, the first marked done with its date.'],
  [/-existing\.png$/, 'An issuer that already has a CIK: the four application steps are not needed; it starts at the Login.gov sign-in.']
]);

/** The other sections' part files are answered 404; formd.js loads (its prefill is read by the check). */
const ABSENT = L9.LATER.filter((x) => x !== 'edgar-access.js' && x !== 'formd.js');
/** The offering's name carries angle brackets: the section must show them as text. */
const NAME = 'Harbor <b>Growth</b> Fund, L.P.';
const KEYS = ['login', 'formid', 'notarize', 'upload', 'granted', 'delegate', 'ready'];
const BACK = { selector: '.fl-bar a.fl-back' };
const line = (id) => `.fl-off[data-offering="${id}"] .fl-part[data-part="access"]`;
const stepSel = (key) => `.fl-section[data-part="access"] .fl-steps > li[data-step="${key}"]`;

/** The section's steps on screen: [ { key, state: done | current | skipped | open, title, lines, pill, date } ]. */
const steps = (F) =>
  F.fr.evaluate(() =>
    Array.from(document.querySelectorAll('.fl-section[data-part="access"] .fl-steps > li')).map((li) => ({
      key: li.getAttribute('data-step'),
      state: li.classList.contains('is-done') ? 'done' : li.classList.contains('is-skipped') ? 'skipped' : li.getAttribute('aria-current') === 'step' ? 'current' : 'open',
      title: ((li.querySelector('.fl-title') || {}).innerText || '').trim(),
      lines: Array.from(li.querySelectorAll('.fl-detail')).map((d) => d.innerText.trim()).filter(Boolean),
      pill: ((li.querySelector('.fl-pill') || {}).innerText || '').trim(),
      date: ((li.querySelector('.fl-date') || {}).innerText || '').trim()
    }))
  );
const edgar = (F, id) => F.fr.evaluate((id) => JSON.parse(JSON.stringify(((((window.CVPortal.state.ws.filings || {}).offerings || {})[id] || {}).edgar) || null)), id);
const log = (F) => F.fr.evaluate(() => (window.CVPortal.state.ws.audit || []).map((e) => `${e.action} :: ${e.detail || ''}`));
/** The CIK the Form D builder's prefill puts on the notice, read in the page from the record as it stands. */
const prefillCik = (F, id) =>
  F.fr.evaluate((id) => {
    const NS = window.CVPortal;
    if (!NS.formD) return 'formd.js not loaded';
    const ws = NS.state.ws;
    const o = ws.offerings.find((x) => x.id === id);
    const p = NS.formD.prefill(o, NS.filings.facts(ws, o), NS.filings.rec(ws, id));
    return p ? p.draft.primaryIssuer.cik : 'no prefill';
  }, id);
const current = (list) => (list.find((s) => s.state === 'current') || {}).key || '';

/** The tab, then its EDGAR access line once the section's file has loaded. */
async function tabLine(F, id) {
  await L9.goto(F, 'console-filings', '.fl');
  await F.fr.waitForSelector(line(id), { timeout: 20000 }).catch(() => {});
  return L9.text(F, line(id));
}
async function openSteps(F, id) {
  await tabLine(F, id);
  if (!(await F.fr.locator(`${line(id)} a`).count())) return false;
  await L9.press(F, `${line(id)} a`);
  await F.fr.waitForSelector('.fl-section[data-part="access"] .fl-steps', { timeout: 20000 }).catch(() => {});
  return (await F.fr.locator('.fl-section[data-part="access"] .fl-steps').count()) === 1;
}
/** The CIK form (of the granted step, or of an issuer that already has one): its values typed, then Save. */
async function cikForm(F, values) {
  const form = '.fl-section[data-part="access"] form[data-form="ea-cik"]';
  await F.fr.fill(`${form} [name="cik"]`, values.cik);
  await F.fr.fill(`${form} [name="name"]`, values.name);
  await L9.press(F, `${form} button[type=submit]`);
  return L9.text(F, `${form} .field-error`);
}

/** The tracer, on the phone: the steps worked down, a CIK entered and refused and stored, an issuer with a CIK. */
async function stepsPhone({ check, S }) {
  const F = await L9.framed(S, 'phone', { absent: ABSENT });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 5, state: 'NY' }] });
  const id = seeded.offeringId;
  const today = seeded.today;
  let shown = await tabLine(F, id);
  check('the tab shows an EDGAR access line for the offering with how far it is (step 1 of 7)', /EDGAR access/.test(shown) && /Step 1 of 7/.test(shown), shown);
  if (!(await openSteps(F, id))) {
    check('tapping the line opens the EDGAR access steps', false, await L9.text(F, '.fl'));
    return F.A.context.close();
  }
  const at = await F.fr.evaluate(() => ({ hash: location.hash, route: window.CVPortal.state.route, title: ((document.querySelector('.fl-bar-title') || {}).innerText || '').trim(), bold: document.querySelectorAll('.fl-section b').length }));
  check('tapping it opens the section under the bar with Back and the offering\'s name as text', at.hash === `#console-filings-access-${id}` && at.route === 'console-filings' && at.title === NAME && at.bold === 0, at);
  let list = await steps(F);
  check('the seven steps are shown in order, each with one or two lines on how', list.map((s) => s.key).join() === KEYS.join() && list.every((s) => s.title && s.lines.length >= 1 && s.lines.length <= 2), list.map((s) => `${s.key}: ${s.title} (${s.lines.length})`));
  check('the first step is the current one and none is done', current(list) === 'login' && !list.some((s) => s.state === 'done' || s.state === 'skipped'), list.map((s) => `${s.key} ${s.state}`));
  const how = list.map((s) => `${s.title} ${s.lines.join(' ')}`).join('\n');
  check('the how-to follows the SEC guides: Login.gov with the email given on Form ID; Form ID on the dashboard; the notary is not an account administrator; the PDF\'s name; the review; the delegation the filing agent accepts', /Login\.gov/.test(how) && /email/i.test(how) && /Form ID/.test(how) && /dashboard/.test(how) && /notary must not be one of the account administrators/.test(how) && /32 characters or fewer/.test(how) && /two business days/.test(how) && /Add Delegation/.test(how) && /accepts/.test(how), how);
  await F.A.page.screenshot({ path: path.join(OUT, 'phone-steps-before.png'), fullPage: false });
  // the first step marked done
  await L9.press(F, `${stepSel('login')} [data-action="ea-step"]`);
  let e = await edgar(F, id);
  list = await steps(F);
  const login = list.find((s) => s.key === 'login') || {};
  check('tapping Done on the first step marks it done with today\'s date, and the next step is the current one', !!(e && e.steps.login && e.steps.login.done && e.steps.login.at === today) && login.state === 'done' && login.date.indexOf(L9.label(today)) >= 0 && current(list) === 'formid', { edgar: e, login, current: current(list) });
  await F.A.page.screenshot({ path: path.join(OUT, 'phone-steps.png'), fullPage: false });
  await L9.wayOut(check, F, 'the steps: Back stays on screen', BACK);
  await L9.leak(check, F, 'the steps');
  shown = await tabLine(F, id);
  check('the tab\'s line moves on: step 2 of 7', /Step 2 of 7/.test(shown), shown);
  await L9.quiet(check, F, 'before the reload');
  await F.reload(`console-filings-access-${id}`);
  await F.fr.waitForSelector('.fl-section[data-part="access"] .fl-steps', { timeout: 20000 }).catch(() => {});
  list = await steps(F);
  check('after a reload of the framed page the step is still done, with its date, and Back is on screen', ((list.find((s) => s.key === 'login') || {}).state === 'done') && current(list) === 'formid' && (await F.fr.locator('.fl-bar a.fl-back').count()) === 1, list.map((s) => `${s.key} ${s.state} ${s.date}`));
  // the CIK the SEC sent
  await L9.press(F, `${stepSel('granted')} [data-action="ea-form"]`);
  let err = await cikForm(F, { cik: 'ABC1234', name: 'HARBOR GROWTH FUND LP' });
  e = await edgar(F, id);
  const one = (t) => t.trim().length > 0 && t.trim().split(/[.!?]\s/).length === 1;
  check('a CIK of letters is refused in one sentence and nothing is stored', one(err) && e.cik === '' && !(e.steps.granted && e.steps.granted.done), { err, cik: e.cik });
  err = await cikForm(F, { cik: '12345678901', name: 'HARBOR GROWTH FUND LP' });
  e = await edgar(F, id);
  check('a CIK of 11 digits is refused in one sentence and nothing is stored', one(err) && e.cik === '', { err, cik: e.cik });
  err = await cikForm(F, { cik: '0001234567', name: 'HARBOR GROWTH FUND LP' });
  e = await edgar(F, id);
  list = await steps(F);
  check('a valid CIK with the company name as EDGAR shows it is stored in the record, and the granted step is done', !err.trim() && e.cik === '0001234567' && e.name === 'HARBOR GROWTH FUND LP' && !!(e.steps.granted && e.steps.granted.done && e.steps.granted.at === today) && ((list.find((s) => s.key === 'granted') || {}).state === 'done'), { err, edgar: e });
  const shownCik = await L9.text(F, stepSel('granted'));
  check('the step shows the CIK and the name back', shownCik.indexOf('0001234567') >= 0 && shownCik.indexOf('HARBOR GROWTH FUND LP') >= 0, shownCik);
  const cik = await prefillCik(F, id);
  check('the CIK entered reaches the Form D notice: NS.formD.prefill reads it from the record (F8)', cik === '0001234567', cik);
  // an issuer that already has a CIK (F3)
  const second = await L9.seed(F, { name: 'Second Fund, L.P.' });
  const id2 = second.offeringId;
  await openSteps(F, id2);
  await L9.press(F, '.fl-section[data-part="access"] [data-action="ea-form"][data-kind="existing"]');
  err = await cikForm(F, { cik: '1750', name: 'SECOND FUND LP' });
  e = await edgar(F, id2);
  list = await steps(F);
  const skipped = list.filter((s) => s.state === 'skipped').map((s) => s.key);
  const first = list.find((s) => s.key === 'login') || {};
  await F.A.page.screenshot({ path: path.join(OUT, 'phone-existing.png'), fullPage: false });
  check('"The issuer already has a CIK" stores the CIK and the name and marks Form ID, notarizing, upload and granted as not needed', !err.trim() && e.cik === '1750' && e.name === 'SECOND FUND LP' && skipped.join() === 'formid,notarize,upload,granted' && list.filter((s) => s.state === 'skipped').every((s) => /Not needed/.test(s.pill)), { err, edgar: e, skipped });
  check('it keeps the Login.gov step, renamed for this path, with the line on setting up account administrators on the SEC\'s site, and the page opens at it', first.title === 'Account administrators sign in with Login.gov' && first.lines.some((l) => /no account administrators on the dashboard/.test(l) && /SEC's site/.test(l)) && current(list) === 'login', first);
  shown = await tabLine(F, id2);
  check('the tab\'s line for it says step 1 of 7', /Step 1 of 7/.test(shown), shown);
  await openSteps(F, id2);
  await L9.press(F, `${stepSel('login')} [data-action="ea-step"]`);
  list = await steps(F);
  check('once the sign-in is marked done the page opens at the delegation step', current(list) === 'delegate' && list.map((s) => s.key).join() === KEYS.join(), list.map((s) => `${s.key} ${s.state}`));
  check('the order on this path: Login.gov, then the delegation, then ready (F3)', list.filter((s) => s.state !== 'skipped').map((s) => s.key).join() === 'login,delegate,ready', list.map((s) => `${s.key} ${s.state}`));
  shown = await tabLine(F, id2);
  check('the tab\'s line says step 6 of 7', /Step 6 of 7/.test(shown), shown);
  check('the CIK of an issuer that already has one reaches the Form D notice', (await prefillCik(F, id2)) === '1750', await prefillCik(F, id2));
  const actions = await log(F);
  check('each change is in the change log', actions.some((a) => /^EDGAR access step marked done :: /.test(a)) && actions.some((a) => /CIK/.test(a) && a.indexOf('0001234567') >= 0) && actions.some((a) => /already has a CIK/.test(a)), actions.slice(0, 8));
  await openSteps(F, id2);
  await L9.wayOut(check, F, 'an issuer that already has a CIK', BACK);
  await L9.leak(check, F, 'an issuer that already has a CIK');
  await L9.quiet(check, F, 'after the reload');
  await F.A.context.close();
}

/** A clipboard that accepts, put in place before the page's scripts: what is written is kept in window.__copied. */
const acceptingClipboard = () => {
  window.__copied = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => (window.__copied.push(String(t)), Promise.resolve()) } });
};
const copied = (F) => F.fr.evaluate(() => (window.__copied || []).slice());
const AGENT_CIK = '0001999999';

/** The tracer's path at 1280x800; a team member; the filing agent's name and CIK in the delegation step, or the line without. */
async function stepsDesktop({ check, S }) {
  const F = await L9.framed(S, 'desktop', { absent: ABSENT });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 5, state: 'NY' }] });
  const id = seeded.offeringId;
  const today = seeded.today;
  let shown = await tabLine(F, id);
  check('the tab shows the EDGAR access line: step 1 of 7', /EDGAR access/.test(shown) && /Step 1 of 7/.test(shown), shown);
  await openSteps(F, id);
  let list = await steps(F);
  check('clicking it opens the seven steps in order, each with one or two lines', list.map((s) => s.key).join() === KEYS.join() && list.every((s) => s.lines.length >= 1 && s.lines.length <= 2) && current(list) === 'login', list.map((s) => `${s.key} ${s.state}`));
  const ready = list.find((s) => s.key === 'ready') || {};
  check('the ready step carries one line about the SEC\'s yearly account confirmation (F8)', ready.lines.filter((l) => /Each year/.test(l) && /confirms the account/.test(l)).length === 1, ready);
  const del = await L9.text(F, stepSel('delegate'));
  check('with no filing agent CIK configured, the delegation step says the number is sent when the order is reviewed, and shows no CIK', /sent when the order is reviewed/.test(del) && (await F.fr.locator(`${stepSel('delegate')} #ea-agent-cik`).count()) === 0 && (await F.fr.locator(`${stepSel('delegate')} [data-agent]`).count()) === 1, del);
  await L9.press(F, `${stepSel('login')} [data-action="ea-step"]`);
  list = await steps(F);
  check('Done on the first step marks it done with today\'s date; the next step is current', ((list.find((s) => s.key === 'login') || {}).state === 'done') && current(list) === 'formid' && ((await edgar(F, id)).steps.login || {}).at === today, list.map((s) => `${s.key} ${s.state}`));
  await L9.press(F, `${stepSel('granted')} [data-action="ea-form"]`);
  let err = await cikForm(F, { cik: '12345678901', name: 'HARBOR GROWTH FUND LP' });
  check('a CIK of 11 digits is refused in one sentence', err.trim().length > 0 && err.trim().split(/[.!?]\s/).length === 1 && (await edgar(F, id)).cik === '', err);
  err = await cikForm(F, { cik: '1234567', name: 'HARBOR GROWTH FUND LP' });
  check('a valid CIK with the name is stored, and the Form D prefill reads it', !err.trim() && (await edgar(F, id)).cik === '1234567' && (await prefillCik(F, id)) === '1234567', { err, cik: await prefillCik(F, id) });
  // a team member
  await L9.role(F, 'team');
  await openSteps(F, id);
  await L9.press(F, `${stepSel('formid')} [data-action="ea-step"]`);
  const e = await edgar(F, id);
  const entry = await F.fr.evaluate(() => {
    const x = (window.CVPortal.state.ws.audit || []).filter((a) => a.action === 'EDGAR access step marked done' && /Form ID/.test(a.detail || '')).pop();
    return x ? { detail: x.detail, actor: x.actor } : null;
  });
  check('a team member can mark a step done, and the change log names the step and the team member', !!(e.steps.formid && e.steps.formid.done) && !!entry && /team/.test(entry.actor || ''), { steps: e.steps, entry });
  shown = await tabLine(F, id);
  check('the tab\'s line follows: step 3 of 7', /Step 3 of 7/.test(shown), shown);
  await L9.role(F, 'admin');
  // the filing agent's CIK configured where the portal is published, and a clipboard that accepts
  await F.A.context.addInitScript((cik) => {
    window.CVPortalConfig = Object.assign({}, window.CVPortalConfig || {}, { filingAgent: { cik } });
  }, AGENT_CIK);
  await F.A.context.addInitScript(acceptingClipboard);
  await F.reload(`console-filings-access-${id}`);
  await F.fr.waitForSelector('.fl-section[data-part="access"] .fl-steps', { timeout: 20000 }).catch(() => {});
  const agent = await F.fr.evaluate((sel) => {
    const li = document.querySelector(sel);
    const a = li && li.querySelector('[data-agent]');
    return { name: a ? a.innerText.trim() : '', product: window.CVPortal.EDITION.product, cik: ((li && li.querySelector('#ea-agent-cik')) || {}).innerText || '', copy: !!(li && li.querySelector('[data-action="ea-copy"][data-for="ea-agent-cik"]')) };
  }, stepSel('delegate'));
  check('with the filing agent\'s CIK configured, the delegation step shows its name inside a data-agent element and that CIK with a copy control', agent.name === agent.product && agent.cik.trim() === AGENT_CIK && agent.copy && !/sent when the order is reviewed/.test(await L9.text(F, stepSel('delegate'))), agent);
  await L9.press(F, `${stepSel('delegate')} [data-action="ea-copy"]`);
  const got = await copied(F);
  const said = await L9.text(F, `${stepSel('delegate')} .ea-said`);
  check('Copy writes exactly the filing agent\'s CIK to a clipboard that accepts, and says so', got.length === 1 && got[0] === AGENT_CIK && /Copied/.test(said), { got, said });
  check('after the reload the steps marked done are still done', (await steps(F)).filter((s) => s.state === 'done').map((s) => s.key).join() === 'login,formid,granted', (await steps(F)).map((s) => `${s.key} ${s.state}`));
  await F.A.page.screenshot({ path: path.join(OUT, 'desktop-steps.png'), fullPage: false });
  await L9.wayOut(check, F, 'the steps', BACK);
  await L9.leak(check, F, 'the steps, the filing agent named inside data-agent only');
  await L9.quiet(check, F);
  await F.A.context.close();
}

/** The sheet's parts in order (their headings) and each answer field: { parts, fields: [ { name, value, copy, label } ] }. */
const sheet = (F) =>
  F.fr.evaluate(() => {
    const root = document.querySelector('.fl-section[data-part="access"] .ea-sheet');
    if (!root) return { parts: [], fields: [] };
    const labelOf = (el) => {
      const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map((x) => (document.getElementById(x) || {}).innerText || '');
      return [el.getAttribute('aria-label') || ''].concat(by, Array.from(el.labels || []).map((l) => l.innerText)).join(' ').trim();
    };
    return {
      parts: Array.from(root.querySelectorAll('[data-sheet-part]')).map((p) => `${p.getAttribute('data-sheet-part')} ${(p.querySelector('h3') || {}).innerText || ''}`.trim()),
      fields: Array.from(root.querySelectorAll('input:not([type=radio])')).map((i) => ({ name: i.name, value: i.value, copy: !!root.querySelector(`[data-action="ea-copy"][data-for="${i.id}"]`), label: labelOf(i) })),
      radios: Array.from(root.querySelectorAll('input[type=radio]')).map((i) => ({ name: i.name, value: i.value, checked: i.checked, label: labelOf(i) }))
    };
  });
const PARTS5 = ['1 Application for EDGAR access', '2 Company information', '3 Prospective account administrators', '4 Billing information', '5 Signature'];
const ISSUER = { street1: '1 Harbor Way', city: 'Boston', state: 'MA', zip: '02110', phone: '617-555-0100', signerName: 'Jane Quinn Public', signerTitle: 'Managing Member of the General Partner' };
/** The cautions that prevent a rejected application, each to be on the sheet exactly once. */
const CAUTIONS = [
  ['EDGAR shortens company names', /EDGAR shortens/g],
  ['a name matching an existing account', /matches an existing account/g],
  ['a general title is refused', /general title/g],
  ['never a Social Security number', /Social Security number/g],
  ['the notary is not an account administrator', /notary must not be one of the account administrators/g],
  ['the PDF\'s name', /32 characters or fewer/g]
];
const value = (fields, name) => (fields.find((f) => f.name === name) || {}).value;
async function openSheet(F, id) {
  await openSteps(F, id);
  await L9.press(F, `${stepSel('formid')} a[href="#console-filings-access-${id}-sheet"]`);
  await F.fr.waitForSelector('.fl-section[data-part="access"] .ea-sheet', { timeout: 20000 }).catch(() => {});
}
/** The issuer details the record holds, set through the record's own writer. */
const setIssuer = (F, id, patch) =>
  F.fr.evaluate(
    ({ id, patch }) => {
      const NS = window.CVPortal;
      NS.filings.setIssuer(NS.state.ws, id, patch);
      NS.app.save(true);
    },
    { id, patch }
  );

/** On the phone: the sheet's parts and answers, Copy where the frame refuses the clipboard, one or two administrators. */
async function sheetPhone({ check, S }) {
  const F = await L9.framed(S, 'phone', { absent: ABSENT });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 5, state: 'NY' }] });
  const id = seeded.offeringId;
  await setIssuer(F, id, ISSUER);
  // The page opens at the current step: five steps done, the delegation step is brought on screen.
  await F.fr.evaluate((id) => {
    const NS = window.CVPortal;
    const at = NS.dates.today();
    NS.filings.setEdgar(NS.state.ws, id, { steps: { login: { done: true, at }, formid: { done: true, at }, notarize: { done: true, at }, upload: { done: true, at }, granted: { done: true, at } } });
    NS.app.save(true);
  }, id);
  await openSteps(F, id);
  await F.fr.waitForTimeout(400);
  const seen = await F.fr.evaluate(() => {
    const li = document.querySelector('.fl-steps > li[aria-current="step"]');
    const r = li ? li.getBoundingClientRect() : null;
    return { key: li ? li.getAttribute('data-step') : '', top: r ? Math.round(r.top) : null, bottom: r ? Math.round(r.bottom) : null, screen: innerHeight };
  });
  check('the page opens at the current step: the delegation step is on screen', seen.key === 'delegate' && seen.top >= 0 && seen.bottom <= seen.screen, seen);
  await F.fr.evaluate((id) => {
    const NS = window.CVPortal;
    NS.filings.setEdgar(NS.state.ws, id, { steps: { formid: { done: false, at: '' }, notarize: { done: false, at: '' }, upload: { done: false, at: '' }, granted: { done: false, at: '' } } });
    NS.app.save(true);
  }, id);
  await openSheet(F, id);
  const at = await F.fr.evaluate(() => ({ hash: location.hash, title: ((document.querySelector('.fl-bar-title') || {}).innerText || '').trim() }));
  check('the Form ID step opens the answer sheet on its own page under the same bar', at.hash === `#console-filings-access-${id}-sheet` && at.title === NAME, at);
  let sh = await sheet(F);
  check('parts 1 to 5 are laid out in the dashboard\'s order', sh.parts.join('|') === PARTS5.join('|'), sh.parts);
  check('each answer the portal holds is filled in: the applicant name from the offering; the address, phone and signer from the record', value(sh.fields, 'applicantName') === NAME && Object.keys(ISSUER).every((k) => value(sh.fields, k) === ISSUER[k]), sh.fields.map((f) => `${f.name}=${f.value}`));
  check('every answer has a Copy control', sh.fields.length >= 14 && sh.fields.every((f) => f.copy), sh.fields.filter((f) => !f.copy).map((f) => f.name));
  const admins = (s) => s.fields.filter((f) => /^admin\dName$/.test(f.name)).length;
  check('two account administrators by default (the single-member question is not answered)', admins(sh) === 2, sh.fields.map((f) => f.name));
  const words = await L9.text(F, '.fl-section[data-part="access"] .ea-sheet');
  const counts = CAUTIONS.map(([what, re]) => [what, (words.match(re) || []).length]);
  check('the cautions are on the sheet once each: names shortened, an existing name, a general title, no Social Security number, the notary, the PDF\'s name', counts.every((c) => c[1] === 1), counts);
  check('the tax ID line says to have the EIN ready or use 00-0000000', /EIN/.test(words) && /00-0000000/.test(words), words.slice(0, 600));
  check('nothing on the sheet is required', (await F.fr.locator('.ea-sheet [required], .ea-sheet [aria-required="true"]').count()) === 0, 'required');
  // Copy where the frame refuses the clipboard
  await L9.press(F, '.ea-sheet [data-action="ea-copy"][data-for="ea-a-street1"]');
  await F.fr.waitForTimeout(300);
  const sel = await F.fr.evaluate(() => {
    const i = document.getElementById('ea-a-street1');
    const said = i && i.closest('.fl-sheet') ? (document.querySelector('[data-for="ea-a-street1"]').parentElement.querySelector('.ea-said') || {}).innerText || '' : '';
    return { start: i.selectionStart, end: i.selectionEnd, length: i.value.length, active: document.activeElement === i, readOnly: i.readOnly, said };
  });
  check('in the frame, where the clipboard is refused, Copy leaves the value selected with a short line saying so, and no error', sel.active && sel.start === 0 && sel.end === sel.length && sel.length > 0 && !sel.readOnly && /Selected/.test(sel.said) && sel.said.split(/[.!?]\s/).length === 1 && F.A.errors.length === 0, { sel, errors: F.A.errors });
  // a typed answer the record has no place for stays on screen; one it has a place for is saved
  await F.fr.fill('#ea-a-fiscalYearEnd', '12/31');
  await F.fr.fill('#ea-a-street2', 'Suite 5');
  await F.fr.locator('#ea-a-street2').blur();
  await F.fr.waitForTimeout(300);
  // the single-member question switches the administrators from two to one
  await L9.press(F, '.ea-sheet input[name="singleMember"][value="yes"]');
  sh = await sheet(F);
  const rec1 = await F.fr.evaluate((id) => JSON.parse(JSON.stringify(window.CVPortal.state.ws.filings.offerings[id])), id);
  check('answering yes to the single-member question shows one account administrator and is saved to the record', admins(sh) === 1 && rec1.edgar.singleMember === true, { admins: admins(sh), single: rec1.edgar.singleMember });
  check('a typed answer with a place in the record is saved to it (suite), one without stays on screen (fiscal year end)', rec1.issuer.street2 === 'Suite 5' && value(sh.fields, 'fiscalYearEnd') === '12/31', { street2: rec1.issuer.street2, fy: value(sh.fields, 'fiscalYearEnd') });
  await L9.press(F, '.ea-sheet input[name="singleMember"][value="no"]');
  sh = await sheet(F);
  check('answering no brings back the second administrator', admins(sh) === 2 && (await edgar(F, id)).singleMember === false, admins(sh));
  await F.A.page.screenshot({ path: path.join(OUT, 'phone-sheet.png'), fullPage: false });
  await L9.wayOut(check, F, 'the sheet: Back stays on screen at the top, middle and end', BACK);
  await L9.leak(check, F, 'the sheet');
  await L9.quiet(check, F, 'before the reload');
  await F.reload(`console-filings-access-${id}-sheet`);
  await F.fr.waitForSelector('.fl-section[data-part="access"] .ea-sheet', { timeout: 20000 }).catch(() => {});
  sh = await sheet(F);
  check('after a reload at the sheet\'s address the sheet is shown with what the record holds, and Back is on screen', sh.parts.length === 5 && value(sh.fields, 'street2') === 'Suite 5' && value(sh.fields, 'signerTitle') === ISSUER.signerTitle && (await F.fr.locator('.fl-bar a.fl-back').count()) === 1, sh.fields.map((f) => `${f.name}=${f.value}`));
  await L9.press(F, '.ea-sheet a[href^="#console-filings-access-"]');
  check('the sheet links back to the steps', (await F.fr.locator('.fl-section[data-part="access"] .fl-steps').count()) === 1, await F.fr.evaluate(() => location.hash));
  await L9.quiet(check, F, 'after the reload');
  await F.A.context.close();
}

/** Every storage key path (localStorage and IndexedDB, keys inside stored JSON included) whose name is one of a secret's. */
const secretKeys = (F) =>
  F.fr.evaluate(async () => {
    const bad = (k) => /ssn|social|tax|password|passphrase|one.?time/i.test(k) || /(^|[^a-zA-Z])[eE][iI][nN]($|[^a-z])|[a-z]Ein($|[A-Z])/.test(k);
    const out = [];
    const walk = (v, at) => {
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`));
      if (!v || typeof v !== 'object') return;
      Object.keys(v).forEach((k) => {
        if (bad(k)) out.push(`${at}.${k}`.replace(/\[\d+\]/g, '[]'));
        walk(v[k], `${at}.${k}`);
      });
    };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (bad(k)) out.push(`localStorage:${k}`);
      try {
        walk(JSON.parse(localStorage.getItem(k)), `localStorage:${k}`);
      } catch (e) {
        /* not JSON */
      }
    }
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    for (const d of dbs) {
      if (bad(d.name)) out.push(`idb:${d.name}`);
      const db = await new Promise((res) => {
        const r = indexedDB.open(d.name);
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      });
      if (!db) continue;
      for (const s of Array.from(db.objectStoreNames)) {
        if (bad(s)) out.push(`idb:${d.name}/${s}`);
        const rows = await new Promise((res) => {
          const q = db.transaction(s, 'readonly').objectStore(s).getAll();
          q.onsuccess = () => res(q.result);
          q.onerror = () => res([]);
        });
        walk(rows, `idb:${d.name}/${s}`);
      }
      db.close();
    }
    return Array.from(new Set(out)).sort();
  });

/** At 1280x800: Copy into a clipboard that accepts; no field for a secret, and none stored once the sheet is filled (F8). */
async function sheetDesktop({ check, S }) {
  const F = await L9.framed(S, 'desktop', { absent: ABSENT });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await L9.seed(F, { name: NAME, sales: [{ daysAgo: 5, state: 'NY' }] });
  const id = seeded.offeringId;
  await setIssuer(F, id, { street1: ISSUER.street1, city: ISSUER.city, state: ISSUER.state, zip: ISSUER.zip });
  await F.A.context.addInitScript(acceptingClipboard);
  await F.reload('console-filings');
  await openSheet(F, id);
  let sh = await sheet(F);
  check('parts 1 to 5 in the dashboard\'s order at 1280x800', sh.parts.join('|') === PARTS5.join('|'), sh.parts);
  check('an answer the record does not hold is an empty field the sponsor may type (phone, signer)', value(sh.fields, 'phone') === '' && value(sh.fields, 'signerName') === '' && value(sh.fields, 'street1') === ISSUER.street1, sh.fields.map((f) => `${f.name}=${f.value}`));
  await L9.press(F, '.ea-sheet [data-action="ea-copy"][data-for="ea-a-applicantName"]');
  await L9.press(F, '.ea-sheet [data-action="ea-copy"][data-for="ea-a-street1"]');
  const got = await copied(F);
  check('with a clipboard that accepts, Copy writes exactly the answer (the applicant name, the street)', got.length === 2 && got[0] === NAME && got[1] === ISSUER.street1, got);
  const words = await L9.text(F, '.fl-section[data-part="access"] .ea-sheet');
  const counts = CAUTIONS.map(([what, re]) => [what, (words.match(re) || []).length]);
  check('the cautions are on the sheet once each', counts.every((c) => c[1] === 1), counts);
  // F8: no field for a secret, and nothing secret stored
  const SECRET = /ssn|social|tax|\bein\b|password|passphrase|one.?time/i;
  const fields = await F.fr.evaluate(() => Array.from(document.querySelectorAll('.fl-section input, .fl-section select, .fl-section textarea')).map((i) => ({ name: i.name || '', autocomplete: i.getAttribute('autocomplete') || '', type: i.type, label: [i.getAttribute('aria-label') || ''].concat((i.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map((x) => (document.getElementById(x) || {}).innerText || ''), Array.from(i.labels || []).map((l) => l.innerText)).join(' ').trim() })));
  const hits = fields.filter((f) => SECRET.test(f.name) || SECRET.test(f.label) || SECRET.test(f.autocomplete) || f.type === 'password');
  check('no input whose name, label or autocomplete is a Social Security number, tax number, EIN, password, passphrase or one-time code (F8)', fields.length >= 14 && hits.length === 0 && fields.every((f) => f.label), { hits, unlabelled: fields.filter((f) => !f.label).map((f) => f.name) });
  const before = await secretKeys(F);
  for (const f of sh.fields) {
    await F.fr.fill(`#ea-a-${f.name}`, `${f.name} typed 9`);
    await F.fr.locator(`#ea-a-${f.name}`).blur();
  }
  await L9.press(F, '.ea-sheet input[name="singleMember"][value="yes"]');
  await F.fr.evaluate(() => window.CVPortal.app.save(true));
  await F.fr.waitForTimeout(500);
  const after = await secretKeys(F);
  const added = after.filter((k) => before.indexOf(k) < 0);
  const inFilings = after.filter((k) => /\.filings\b/.test(k));
  check('after the sheet is filled, localStorage and IndexedDB hold no new key named for a secret, and the filings record holds none at all (F8)', added.length === 0 && inFilings.length === 0, { added, inFilings });
  sh = await sheet(F);
  const rec = await F.fr.evaluate((id) => JSON.parse(JSON.stringify(window.CVPortal.state.ws.filings.offerings[id])), id);
  check('what the sponsor typed where the record has a place is saved there (phone, signer)', rec.issuer.phone === 'phone typed 9' && rec.issuer.signerName === 'signerName typed 9' && rec.issuer.signerTitle === 'signerTitle typed 9', rec.issuer);
  await F.A.page.screenshot({ path: path.join(OUT, 'desktop-sheet.png'), fullPage: false });
  await L9.wayOut(check, F, 'the sheet', BACK);
  await L9.leak(check, F, 'the sheet');
  await L9.quiet(check, F);
  await F.A.context.close();
}

const PARTS = {
  'steps-phone': stepsPhone,
  'steps-desktop': stepsDesktop,
  'sheet-phone': sheetPhone,
  'sheet-desktop': sheetDesktop
};

Lib.runParts(PARTS, { name: 'ACCESS FLOW', browser: true });
