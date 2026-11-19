// gate: browser
// last "FORMD FLOW: PASS (parts run: 1)"
// Plan 09-04: the Form D section of the Filings tab, as the owner tests it: inside a sandboxed iframe whose policy refuses
// every connection, with no server, on a 390x844 touch screen (-phone) and at 1280x800 (-desktop). The section's own two
// files (formd.js, formd-ui.js) are served from the tree; the other sections' files are answered 404, so the check
// measures the Form D section alone and stays valid after those plans land.
//   order-phone, order-desktop    the pre-filled form (every figure the one NS.filings.facts gives, each with where it came
//                                 from), completed by touch or click; a reload half way and after Review keeps it; Review
//                                 by item with no error; the admin's sign-off; the order with "$100 due"; the file built
//                                 from the signed notice validates against the SEC schema with xmllint
//   NODE_PATH=$(npm root -g) node formd-flow.js [--only order-phone,order-desktop]
// The last line is "FORMD FLOW: PASS (parts run: N)" or "FORMD FLOW: FAIL (parts run: N) - <failed parts>". The two
// marker lines above are read by gate9.sh.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const L9 = require('./lib9.js');

const OUT = path.join(Lib.OUT, 'formd-flow');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-form\.png$/, 'The Form D section as it opens: the figures the portal holds already filled in, each saying where it came from.'],
  [/-review\.png$/, 'Review: the whole notice by item on the page, with nothing left to fix, and the sign-off under the SEC\'s Terms of Submission.'],
  [/-signed\.png$/, 'After the sign-off: who signed and when, the order with the amount due, and the line about sending it to be filed.']
]);

const SCHEMA = path.join(Lib.ROOT, 'server/test/fixtures/formd/schema/formDSubmission.xsd.xml');
/** The other sections' files, answered 404 (their own plans measure them). */
const OTHERS = ['edgar-access.js', 'bluesky-data.js', 'bluesky.js', 'filings-remote.js'];
const NAV = '.cs-nav a[href="#console-filings"]';
const BACK = { selector: '.fl-bar a.fl-back' };
const NAME = 'Harbor <b>Growth</b> Fund, L.P.';
const EDGAR_NAME = 'Harbor Growth Fund, L.P.';
const CIK = '1234567';
const P = 'offeringData';
const SIG = `${P}.signatureBlock.signature[0]`;
/** A field of the form, by the draft field it fills. */
const F_ = (field) => `.fl-section[data-part="formd"] [data-field="${field}"]`;

async function typeIn(F, field, value) {
  const loc = F.fr.locator(F_(field)).first();
  await loc.scrollIntoViewIfNeeded();
  if (F.phone) await loc.tap();
  else await loc.click();
  await loc.fill(value);
  await F.fr.waitForTimeout(120);
}
async function choose(F, field, value) {
  const loc = F.fr.locator(F_(field)).first();
  await loc.scrollIntoViewIfNeeded();
  await loc.selectOption(value);
  await F.fr.waitForTimeout(300);
}
/** A radio button or a box to tick, by its field and (for radio buttons and lists) its value. */
async function tick(F, field, value) {
  await L9.press(F, value == null ? F_(field) : `${F_(field)}[value="${value}"]`);
  await F.fr.waitForTimeout(150);
}
const valueOf = (F, field) => F.fr.locator(F_(field)).first().inputValue({ timeout: 3000 }).catch(() => null);
/** The hint under a field: where its value came from. */
const hintOf = (F, field) =>
  F.fr.evaluate((sel) => {
    const el = document.querySelector(sel);
    const box = el && el.closest('.cs-field');
    const hint = box && box.querySelector('.cs-hint');
    return hint ? hint.innerText.trim() : '';
  }, F_(field));
const store = (F, id) => F.fr.evaluate((oid) => JSON.parse(JSON.stringify({ rec: ((window.CVPortal.state.ws.filings || {}).offerings || {})[oid] || null, orders: ((window.CVPortal.state.ws.filings || {}).orders || []).filter((x) => x.offeringId === oid) })), id);
const factsOf = (F, id) =>
  F.fr.evaluate((oid) => {
    const NS = window.CVPortal;
    return JSON.parse(JSON.stringify(NS.filings.facts(NS.state.ws, NS.state.ws.offerings.find((o) => o.id === oid))));
  }, id);
const sectionText = (F) => L9.text(F, '.fl-section[data-part="formd"]');

/** The seeded offering with its EDGAR identity on the record (plan 09-06 writes it the same way). */
async function setup(F, spec) {
  const seeded = await L9.seed(F, Object.assign({ name: NAME, sales: [{ daysAgo: 30, state: 'NY', funded: true, amount: 250000 }, { daysAgo: 20, state: 'NY', amount: 150000 }, { daysAgo: 10, state: 'CA', funded: true, amount: 100000 }] }, spec || {}));
  if (!(spec && spec.noCik)) await F.fr.evaluate(([id, cik, name]) => window.CVPortal.filings.setEdgar(window.CVPortal.state.ws, id, { cik, name }), [seeded.offeringId, CIK, EDGAR_NAME]);
  return seeded;
}
/** The tab, then the Form D line under the offering. */
async function openSection(F, id) {
  await L9.press(F, NAV);
  await F.fr.waitForSelector('.fl', { timeout: 20000 });
  const line = `.fl-off[data-offering="${id}"] .fl-part[data-part="formd"] a`;
  await F.fr.waitForSelector(line, { timeout: 30000 }).catch(() => {});
  const shown = await L9.text(F, line);
  if (shown) {
    await L9.press(F, line);
    await F.fr.waitForSelector('.fl-section[data-part="formd"]', { timeout: 20000 }).catch(() => {});
  }
  return shown;
}

/** What the portal does not hold, entered by touch or click; the reload half way is the caller's. */
async function fillIssuer(F) {
  await typeIn(F, 'primaryIssuer.issuerAddress.street1', '200 Harbor Street');
  await typeIn(F, 'primaryIssuer.issuerAddress.city', 'Albany');
  await choose(F, 'primaryIssuer.issuerAddress.stateOrCountry', 'NY');
  await typeIn(F, 'primaryIssuer.issuerAddress.zipCode', '12207');
  await typeIn(F, 'primaryIssuer.issuerPhoneNumber', '518-555-0100');
  await choose(F, 'primaryIssuer.entityType', 'Limited Partnership');
  await tick(F, 'primaryIssuer.yearOfInc.kind', 'overFiveYears');
}
async function fillPerson(F, k, first) {
  const p = `relatedPersonsList[${k}]`;
  await typeIn(F, `${p}.relatedPersonName.firstName`, first || 'Dana');
  await typeIn(F, `${p}.relatedPersonName.lastName`, 'Reyes');
  await typeIn(F, `${p}.relatedPersonAddress.street1`, '200 Harbor Street');
  await typeIn(F, `${p}.relatedPersonAddress.city`, 'Albany');
  await choose(F, `${p}.relatedPersonAddress.stateOrCountry`, 'NY');
  await typeIn(F, `${p}.relatedPersonAddress.zipCode`, '12207');
  await tick(F, `${p}.relatedPersonRelationshipList`, 'Executive Officer');
}
async function fillOffering(F) {
  await choose(F, `${P}.industryGroup.industryGroupType`, 'Pooled Investment Fund');
  await choose(F, `${P}.industryGroup.investmentFundInfo.investmentFundType`, 'Private Equity Fund');
  await tick(F, `${P}.industryGroup.investmentFundInfo.is40Act`, 'false');
  await choose(F, `${P}.issuerSize.revenueRange`, 'Decline to Disclose');
  await tick(F, `${P}.durationOfOffering.moreThanOneYear`, 'true');
  await tick(F, `${P}.typesOfSecuritiesOffered.isPooledInvestmentFundType`);
  await tick(F, `${P}.businessCombinationTransaction.isBusinessCombinationTransaction`, 'false');
  if ((await F.fr.locator(`${F_(`${P}.investors.hasNonAccreditedInvestors`)}:checked`).count()) === 0) await tick(F, `${P}.investors.hasNonAccreditedInvestors`, 'false');
  await typeIn(F, `${P}.salesCommissionsFindersFees.salesCommissions.dollarAmount`, '0');
  await typeIn(F, `${P}.salesCommissionsFindersFees.findersFees.dollarAmount`, '0');
  await typeIn(F, `${P}.useOfProceeds.grossProceedsUsed.dollarAmount`, '0');
  await typeIn(F, `${SIG}.nameOfSigner`, 'Dana Reyes');
  await typeIn(F, `${SIG}.signatureTitle`, 'Managing Member of the General Partner');
}

/** The file of a signed notice, built in the page (TEST, an invented CCC and contact), checked by xmllint. */
async function validates(F, id, name) {
  const xml = await F.fr.evaluate((oid) => {
    const NS = window.CVPortal;
    const list = NS.state.ws.filings.offerings[oid].formD;
    const e = list.filter((x) => x.status === 'ordered').pop();
    return e ? NS.formD.toXml(e.draft, { mode: 'TEST', ccc: 'ab12CD34', contact: { name: 'Check Contact', phone: '555-0100', email: 'contact@example.com' } }) : '';
  }, id);
  const file = path.join(OUT, `${name}.xml`);
  fs.writeFileSync(file, xml);
  let out = '';
  try {
    out = execFileSync('xmllint', ['--noout', '--schema', SCHEMA, file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    out = out || `${path.basename(file)} validates`;
  } catch (e) {
    out = String(e.stderr || e.message).trim();
  }
  return { xml, out: out.split('\n').slice(-3).join(' | ') };
}

/** The tracer: the pre-filled form completed, reviewed, signed off; the order recorded; the file validates. */
async function order(size, { check, S }) {
  const F = await L9.framed(S, size, { absent: OTHERS });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await setup(F);
  const id = seeded.offeringId;
  const line = await openSection(F, id);
  check('the offering shows a Form D line on the tab, and it opens the Form D section', /Form D/.test(line) && (await F.fr.locator('.fl-section[data-part="formd"]').count()) === 1, line);
  if (!line) return F.A.context.close();
  // F7: every figure is the one facts() gives; one sale is approved and not funded, and it counts
  const f = await factsOf(F, id);
  const want = {
    [`${P}.offeringSalesAmounts.totalOfferingAmount`]: f.total == null ? '' : String(f.total),
    [`${P}.offeringSalesAmounts.totalAmountSold`]: String(f.sold),
    [`${P}.investors.totalNumberAlreadyInvested`]: String(f.investors),
    [`${P}.investors.numberNonAccreditedInvestors`]: String(f.nonAccredited.count),
    [`${P}.minimumInvestmentAccepted`]: f.minimum == null ? '' : String(f.minimum),
    [`${P}.typeOfFiling.dateOfFirstSale.value`]: f.firstSale
  };
  const got = {};
  const hints = {};
  for (const k of Object.keys(want)) {
    got[k] = await valueOf(F, k);
    hints[k] = await hintOf(F, k);
  }
  check('every pre-filled figure is the one NS.filings.facts gives in the page (amount sold, investors, non-accredited, total, minimum, first sale)', Object.keys(want).every((k) => got[k] === want[k]), { want, got });
  check('the approved, unfunded subscription counts: three investors and $500,000 sold', f.investors === 3 && f.sold === 500000 && f.firstSale === seeded.sales[0].date, f);
  check('each pre-filled figure says where it came from', Object.keys(want).every((k) => !want[k] || /^From the /.test(hints[k])), hints);
  const exempt = await L9.text(F, '.fl-section [data-show="exemption"]');
  check('the exemption is Rule 506(b), from the offering, and is not a choice', /Rule 506\(b\)/.test(exempt) && !/506\(c\)/.test(exempt) && (await F.fr.locator(F_(`${P}.federalExemptionsExclusions`)).count()) === 0, exempt);
  const cik = await valueOf(F, 'primaryIssuer.cik');
  check('the issuer\'s CIK and the EDGAR name come from the record', cik === CIK && (await valueOf(F, `${SIG}.issuerName`)) === EDGAR_NAME, { cik });
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-form.png`), fullPage: false });
  await L9.wayOut(check, F, 'the form: Back stays on screen at its top, middle and end', BACK);
  await L9.leak(check, F, 'the form');
  await fillIssuer(F);
  await L9.press(F, '.fl-section [data-action="fd-person-add"]');
  await fillPerson(F, 0);
  // W-3: a reload half way through the form keeps what was typed
  await F.fr.waitForTimeout(600);
  const hash = await F.fr.evaluate(() => location.hash.slice(1));
  await F.reload(hash);
  await F.fr.waitForSelector(F_('primaryIssuer.issuerAddress.street1'), { timeout: 30000 }).catch(() => {});
  const kept = { street: await valueOf(F, 'primaryIssuer.issuerAddress.street1'), person: await valueOf(F, 'relatedPersonsList[0].relatedPersonName.firstName'), rel: await F.fr.locator(`${F_('relatedPersonsList[0].relatedPersonRelationshipList')}[value="Executive Officer"]:checked`).count() };
  check('a reload half way through the form keeps every value typed', kept.street === '200 Harbor Street' && kept.person === 'Dana' && kept.rel === 1, kept);
  await L9.wayOut(check, F, 'the form after a reload: Back on screen', BACK);
  await fillOffering(F);
  await L9.press(F, '.fl-section a[data-go="review"]');
  await F.fr.waitForSelector('.fl-section .fd-review', { timeout: 20000 }).catch(() => {});
  const review = await F.fr.evaluate(() => {
    const box = document.querySelector('.fl-section .fd-review');
    return {
      errors: document.querySelectorAll('.fl-section .fl-errors li').length,
      items: Array.from(document.querySelectorAll('.fl-section .fd-review .fl-item > h3')).map((x) => x.innerText.trim()),
      pairs: box ? box.querySelectorAll('dt').length : 0,
      empty: box ? Array.from(box.querySelectorAll('dd')).filter((d) => !d.innerText.trim()).length : -1,
      sign: document.querySelectorAll('.fl-section form[data-form="fd-signoff"]').length,
      terms: (document.querySelector('.fl-section .fd-terms') || {}).innerText || '',
      pdf: document.querySelectorAll('embed, object, iframe').length
    };
  });
  check('Review lists no error and shows every item (1 to 16 and the signature) as label and value, on the page', review.errors === 0 && review.items.length === 17 && review.pairs >= 40 && review.empty === 0 && review.pdf === 0, review);
  check('the sign-off is offered to the admin under the SEC\'s Terms of Submission', review.sign === 1 && /Irrevocably appointing each of the Secretary of the SEC/.test(review.terms) && /Rule 506\(d\)/.test(review.terms), review.terms.slice(0, 200));
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-review.png`), fullPage: false });
  // W-3: a reload after Review shows the review again, from what is saved
  await F.fr.waitForTimeout(600);
  await F.reload(await F.fr.evaluate(() => location.hash.slice(1)));
  await F.fr.waitForSelector('.fl-section .fd-review', { timeout: 30000 }).catch(() => {});
  const again = await F.fr.evaluate(() => ({ errors: document.querySelectorAll('.fl-section .fl-errors li').length, sign: document.querySelectorAll('.fl-section form[data-form="fd-signoff"]').length, text: (document.querySelector('.fl-section .fd-review') || {}).innerText || '' }));
  check('a reload after Review shows the same review, with the typed values', again.errors === 0 && again.sign === 1 && /200 Harbor Street/.test(again.text) && /Dana/.test(again.text), { errors: again.errors, sign: again.sign });
  await L9.wayOut(check, F, 'the review: Back on screen', BACK);
  await L9.leak(check, F, 'the review');
  // the sign-off
  const signer = { name: await F.fr.locator('.fl-section form[data-form="fd-signoff"] [name="name"]').inputValue().catch(() => ''), title: await F.fr.locator('.fl-section form[data-form="fd-signoff"] [name="title"]').inputValue().catch(() => '') };
  check('the sign-off holds the signer named on the form', signer.name === 'Dana Reyes' && /Managing Member/.test(signer.title), signer);
  await L9.press(F, '.fl-section form[data-form="fd-signoff"] button[type=submit]');
  await F.fr.waitForSelector('.fl-section .fd-signed', { timeout: 20000 }).catch(() => {});
  const done = await sectionText(F);
  const connect = await L9.text(F, '.fl-section .fd-connect');
  check('the page shows the order as recorded with "$100 due"', /Signed off by Dana Reyes/.test(done) && /\$100 due/.test(done) && /Recorded/.test(done), done.slice(0, 400));
  check('one plain line says that sending it to be filed needs the portal connected', /connected/.test(connect) && connect.split('\n').length === 1, connect);
  const st = await store(F, id);
  const entry = st.rec && st.rec.formD.filter((x) => x.status === 'ordered')[0];
  const o = st.orders[0] || {};
  check('the record holds the notice as ordered with its sign-off, and one order of kind formd with 10000 cents due', !!entry && entry.type === 'D' && entry.signoff && entry.signoff.name === 'Dana Reyes' && /admin/.test(entry.signoff.by) && /^\d{4}-\d\d-\d\dT/.test(entry.signoff.at) && st.orders.length === 1 && o.kind === 'formd' && o.dueCents === 10000 && o.status === 'recorded' && entry.orderId === o.id, { entry: entry && { type: entry.type, status: entry.status, signoff: entry.signoff, orderId: entry.orderId }, orders: st.orders });
  check('the signature carries the signer, the title, today\'s date and the EDGAR name', !!entry && entry.draft.offeringData.signatureBlock.signature[0].signatureName === 'Dana Reyes' && entry.draft.offeringData.signatureBlock.signature[0].signatureDate === seeded.today && entry.draft.offeringData.signatureBlock.signature[0].issuerName === EDGAR_NAME, entry && entry.draft.offeringData.signatureBlock);
  const v = await validates(F, id, `${size}-order`);
  check('the file built from the signed-off notice (TEST, CCC and contact added) validates against the SEC schema', /validates$/.test(v.out) && /<testOrLive>TEST<\/testOrLive>/.test(v.xml) && /<submissionType>D<\/submissionType>/.test(v.xml), v.out);
  const log = await F.fr.evaluate(() => (window.CVPortal.state.ws.audit || []).map((e) => e.action));
  check('the sign-off and the order are in the change log', log.indexOf('Form D signed off') >= 0 && log.indexOf('Filing order recorded') >= 0, log.slice(0, 8));
  await F.A.page.screenshot({ path: path.join(OUT, `${size}-signed.png`), fullPage: false });
  await L9.wayOut(check, F, 'after the sign-off: Back on screen', BACK);
  await L9.leak(check, F, 'after the sign-off');
  await L9.quiet(check, F);
  await F.A.context.close();
}

const PARTS = {
  'order-phone': (ctx) => order('phone', ctx),
  'order-desktop': (ctx) => order('desktop', ctx)
};

Lib.runParts(PARTS, { name: 'FORMD FLOW', browser: true });
