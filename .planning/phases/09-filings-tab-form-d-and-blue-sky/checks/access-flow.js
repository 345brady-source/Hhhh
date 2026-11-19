// gate: browser
// last "ACCESS FLOW: PASS (parts run: 1)"
// Plan 09-06: EDGAR access for a new issuer, the EDGAR access section of the Filings tab (assets/js/edgar-access.js), as
// the owner tests it: inside a sandboxed iframe whose policy refuses every connection, with no server, on a 390x844 touch
// screen (-phone) and at 1280x800 (-desktop). The part files of the other phase 9 sections are answered 404, except
// formd.js, whose prefill is how the CIK entered here reaches the Form D notice.
//   steps-phone    the tab's EDGAR access line with how far the issuer is; the seven steps in order with their how-to;
//                  a step marked done with today's date, kept after a reload; a CIK of letters or of 11 digits refused in
//                  one sentence, a valid one stored with the name and read by the Form D prefill; an issuer that already
//                  has a CIK skips the four application steps and starts at the Login.gov sign-in, then the delegation
//   NODE_PATH=$(npm root -g) node access-flow.js [--only steps-phone]
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

const PARTS = {
  'steps-phone': stepsPhone
};

Lib.runParts(PARTS, { name: 'ACCESS FLOW', browser: true });
