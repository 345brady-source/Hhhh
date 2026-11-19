// gate: browser
// last "FORMD FLOW: PASS (parts run: 4)"
// Plan 09-04: the Form D section of the Filings tab, as the owner tests it: inside a sandboxed iframe whose policy refuses
// every connection, with no server, on a 390x844 touch screen (-phone) and at 1280x800 (-desktop). The section's own two
// files (formd.js, formd-ui.js) are served from the tree; the other sections' files are answered 404, so the check
// measures the Form D section alone and stays valid after those plans land.
//   order-phone, order-desktop    the pre-filled form (every figure the one NS.filings.facts gives, each with where it came
//                                 from), completed by touch or click; a reload half way and after Review keeps it; Review
//                                 by item with no error; the admin's sign-off; the order with "$100 due"; the file built
//                                 from the signed notice validates against the SEC schema with xmllint
//   errors-phone, errors-desktop  a P.O. box street line of 41 characters, no related person, a remaining amount changed
//                                 by hand and a signature date tomorrow: one message per field (F2), each naming its item
//                                 and linking to it, no sign-off until each is fixed; a warning that does not block; an
//                                 offering in another currency; no CIK (with and without the EDGAR access section).
//                                 Desktop: related persons and recipients, the one exemption, a team member, angle
//                                 brackets shown as text, a signed notice never edited (F6)
//   amend-phone, amend-desktop    the line "Amendment due <date>: Start" (annual) or "Amendment needed: Start" (a change)
//                                 (F1); a D/A from the portal's own filed notice, or from the file or pasted text of a
//                                 notice filed elsewhere (a masked filed notice); a file that is not a notice refused;
//                                 the previous accession number; the $50 order; the file validates as a D/A
//   NODE_PATH=$(npm root -g) node formd-flow.js [--only order-phone,order-desktop,errors-phone,errors-desktop,amend-phone,amend-desktop]
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
      items: Array.from(document.querySelectorAll('.fl-section .fd-review .fl-item h3')).map((x) => x.innerText.trim()),
      pairs: box ? box.querySelectorAll('dt').length : 0,
      empty: box ? Array.from(box.querySelectorAll('dd')).filter((d) => !d.innerText.trim() || d.innerText.trim() === 'Not given').length : -1,
      sign: document.querySelectorAll('.fl-section form[data-form="fd-signoff"]').length,
      terms: (document.querySelector('.fl-section .fd-terms') || {}).innerText || '',
      pdf: document.querySelectorAll('embed, object, iframe').length
    };
  });
  check('Review lists no error and shows every item (1 to 16 and the signature) as label and value, on the page', review.errors === 0 && review.items.length === 17 && review.pairs >= 30 && review.empty === 0 && review.pdf === 0, review);
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

/** A stand-in for plan 09-06's section: registered under the key access, so the CIK message can link to it. */
const ACCESS_STUB = "window.CVPortal.filingsUI.part('access', { order: 20, title: 'EDGAR access', summary: () => '', render: () => '<p class=\"probe-access\">EDGAR access steps</p>' });";
/** Review: the messages on screen, one entry per line: { text, field, item, go } (go: it has its link). */
async function openReview(F) {
  await L9.press(F, '.fl-section a[data-go="review"]');
  await F.fr.waitForSelector('.fl-section .fd-review', { timeout: 20000 }).catch(() => {});
  return reviewState(F);
}
const reviewState = (F) =>
  F.fr.evaluate(() => {
    const read = (sel) =>
      Array.from(document.querySelectorAll(sel)).map((li) => {
        const b = li.querySelector('[data-action="fd-go"]');
        return { text: li.innerText.replace(/\s+/g, ' ').trim(), field: b ? b.getAttribute('data-field') : '', item: b ? b.getAttribute('data-item') : '', go: !!b, links: Array.from(li.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')) };
      });
    return { errors: read('.fl-section .fl-errors li'), warnings: read('.fl-section .fd-warnings li'), sign: document.querySelectorAll('.fl-section form[data-form="fd-signoff"]').length, review: (document.querySelector('.fl-section .fd-review') || {}).innerText || '', bold: document.querySelectorAll('.fl-section .fd-review b').length };
  });
const toForm = async (F) => {
  await L9.press(F, '.fl-section a[href^="#console-filings-formd-"]:not([data-go])');
  await F.fr.waitForSelector('.fl-section .fd-form', { timeout: 20000 }).catch(() => {});
};
const onField = (r, field) => r.errors.concat(r.warnings).filter((m) => m.field === field);
const STREET = 'primaryIssuer.issuerAddress.street1';
const PO41 = 'P.O. Box 4410, North Harbor Office Park 2';

/**
 * Errors in plain words by item (F2: one message per field), the links to the items, no sign-off while an error stands, a
 * warning that does not block, an offering in another currency, an issuer with no CIK. Desktop adds the lists, the
 * exemption, a team member, text with angle brackets and editing after sign-off (F6).
 */
async function errors(size, { check, S }) {
  const desktop = size === 'desktop';
  const F = await L9.framed(S, size, desktop ? { absent: OTHERS.slice(1), scripts: { 'edgar-access.js': ACCESS_STUB } } : { absent: OTHERS });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await setup(F);
  const id = seeded.offeringId;
  const f = await factsOf(F, id);
  if (!(await openSection(F, id))) {
    check('the Form D section opens', false);
    return F.A.context.close();
  }
  await fillIssuer(F);
  await fillOffering(F);
  check('the P.O. box line of the case is 41 characters long', PO41.length === 41, PO41.length);
  await typeIn(F, STREET, PO41);
  await typeIn(F, `${P}.offeringSalesAmounts.totalRemaining`, '12345');
  await typeIn(F, `${SIG}.signatureDate`, L9.iso(seeded.today, 1));
  let r = await openReview(F);
  const street = onField(r, STREET);
  check('F2: one message for the street line, the P.O. box sentence (EDGAR\'s rule), although it is also too long', street.length === 1 && /P\.O\. box/.test(street[0].text) && /^Item 2:/.test(street[0].text), r.errors.map((m) => `${m.field} :: ${m.text}`));
  const fields = r.errors.map((m) => m.field);
  check('F2: no field carries two messages', fields.length === new Set(fields).size, fields);
  const person = r.errors.find((m) => m.field === 'relatedPersonsList');
  const left = r.errors.find((m) => m.field === `${P}.offeringSalesAmounts.totalRemaining`);
  const signed = r.errors.find((m) => m.field === `${SIG}.signatureDate`);
  check('no related person, the remaining amount changed by hand and a signature date tomorrow are each listed in a sentence that names its item', !!person && /^Item 3: add at least one related person/.test(person.text) && !!left && /^Item 13: /.test(left.text) && !!signed && /^Signature: the date signed is in the future/.test(signed.text), { person, left, signed });
  check('every message links to its item', r.errors.length >= 4 && r.errors.every((m) => m.go), r.errors.map((m) => m.text));
  check('the notice cannot be signed off while an error stands', r.sign === 0, r.sign);
  await L9.press(F, '.fl-section .fl-errors li [data-action="fd-go"][data-field="relatedPersonsList"]');
  await F.fr.waitForTimeout(500);
  const went = await F.fr.evaluate(() => {
    const el = document.getElementById('fd-i3');
    const b = el && el.getBoundingClientRect();
    return { hash: location.hash, form: document.querySelectorAll('.fd-form').length, top: b ? Math.round(b.top) : null, bottom: b ? Math.round(b.bottom) : null, screen: innerHeight };
  });
  check('the link opens the form at Item 3', went.form === 1 && went.hash === `#console-filings-formd-${id}` && went.top !== null && went.top < went.screen && went.bottom > 0, went);
  // fixing the length alone leaves the P.O. box; fixing both clears it
  await typeIn(F, STREET, 'P.O. Box 4410');
  r = await openReview(F);
  let s2 = onField(r, STREET);
  check('F2: with the length fixed the P.O. box message stays, alone', s2.length === 1 && /P\.O\. box/.test(s2[0].text), s2);
  await toForm(F);
  await typeIn(F, STREET, '200 Harbor Street');
  await L9.press(F, '.fl-section [data-action="fd-person-add"]');
  await fillPerson(F, 0, desktop ? '<b>Ann</b>' : 'Dana');
  await typeIn(F, `${P}.offeringSalesAmounts.totalRemaining`, f.total === 'Indefinite' ? 'Indefinite' : String(f.total - f.sold));
  await typeIn(F, `${SIG}.signatureDate`, seeded.today);
  r = await openReview(F);
  check('fixing each clears it: no error is left and the sign-off is offered', r.errors.length === 0 && r.sign === 1, r.errors.map((m) => m.text));
  // a warning is shown and does not block
  await toForm(F);
  await tick(F, `${P}.investors.hasNonAccreditedInvestors`, 'true');
  await typeIn(F, `${P}.investors.numberNonAccreditedInvestors`, '36');
  r = await openReview(F);
  const warn = r.warnings.find((m) => /35 non-accredited/.test(m.text));
  check('36 non-accredited investors under Rule 506(b): a warning naming Item 14 is shown, and the sign-off is still offered', !!warn && /^Item 14:/.test(warn.text) && r.errors.length === 0 && r.sign === 1, r);
  if (desktop) await desktopExtras(F, check, seeded, f);
  await L9.wayOut(check, F, 'the review', BACK);
  await L9.leak(check, F, 'the review');
  // an offering in another currency
  const euro = await setup(F, { name: 'Euro Feeder Fund, L.P.', shortName: 'Euro Feeder' });
  await F.fr.evaluate((oid) => {
    const o = window.CVPortal.state.ws.offerings.find((x) => x.id === oid);
    o.currency = 'EUR';
    window.CVPortal.app.save(true);
  }, euro.offeringId);
  await L9.goto(F, `console-filings-formd-${euro.offeringId}`, '.fl-section .fd-form');
  const amounts = {};
  for (const k of ['minimumInvestmentAccepted', 'offeringSalesAmounts.totalOfferingAmount', 'offeringSalesAmounts.totalAmountSold', 'offeringSalesAmounts.totalRemaining']) amounts[k] = await valueOf(F, `${P}.${k}`);
  const usd = await L9.text(F, '.fl-section .fd-usd');
  check('an offering in another currency has its amounts empty, with a line asking for the U.S. dollar figures', Object.keys(amounts).every((k) => amounts[k] === '') && /U\.S\. dollars/.test(usd), { amounts, usd });
  // an issuer with no CIK on record
  const bare = await setup(F, { name: 'New Issuer Fund, L.P.', shortName: 'New Issuer', noCik: true });
  await L9.goto(F, `console-filings-formd-${bare.offeringId}-review`, '.fl-section .fd-review');
  r = await reviewState(F);
  const cik = r.errors.find((m) => m.field === 'primaryIssuer.cik');
  const link = `#console-filings-access-${bare.offeringId}`;
  if (desktop) {
    check('with no CIK the list says the issuer\'s CIK is needed and, with the EDGAR access section loaded, links to it', !!cik && /^Item 1: the issuer's CIK is missing/.test(cik.text) && cik.links.indexOf(link) >= 0, cik);
    await L9.press(F, `.fl-section .fl-errors a[href="${link}"]`);
    await F.fr.waitForSelector('.probe-access', { timeout: 10000 }).catch(() => {});
    check('the link opens the EDGAR access section', (await F.fr.locator('.fl-section[data-part="access"] .probe-access').count()) === 1, await F.fr.evaluate(() => location.hash));
  } else check('with no CIK the list says the issuer\'s CIK is needed; with the EDGAR access section not loaded there is no link to it', !!cik && /^Item 1: the issuer's CIK is missing/.test(cik.text) && cik.links.length === 0, cik);
  await L9.quiet(check, F);
  await F.A.context.close();
}

/** errors-desktop: the related persons and recipients lists, the exemption, a team member, angle brackets, F6. */
async function desktopExtras(F, check, seeded, f) {
  const id = seeded.offeringId;
  let r = await reviewState(F);
  check('text typed with angle brackets is shown as text in the review', /<b>Ann<\/b>/.test(r.review) && r.bold === 0, r.review.slice(0, 300));
  await toForm(F);
  // related persons: one to three relationships, add and remove, up to 100
  const rels = await F.fr.locator(F_('relatedPersonsList[0].relatedPersonRelationshipList')).count();
  await tick(F, 'relatedPersonsList[0].relatedPersonRelationshipList', 'Director');
  await L9.press(F, '.fl-section [data-action="fd-person-add"]');
  await typeIn(F, 'relatedPersonsList[1].relatedPersonName.firstName', 'Second');
  await F.fr.waitForTimeout(400);
  await L9.press(F, '.fl-section [data-action="fd-person-rm"][data-k="1"]');
  let st = await store(F, id);
  let d = st.rec.formD.filter((x) => x.status === 'draft').pop().draft;
  check('related persons: three relationships to tick, a person added and removed (first, middle, last name, address, relationships, a note)', rels === 3 && d.relatedPersonsList.length === 1 && d.relatedPersonsList[0].relatedPersonRelationshipList.join() === 'Executive Officer,Director' && (await F.fr.locator(F_('relatedPersonsList[0].relatedPersonName.middleName')).count()) === 1 && (await F.fr.locator(F_('relatedPersonsList[0].relationshipClarification')).count()) === 1, d.relatedPersonsList);
  await F.fr.evaluate((oid) => {
    const NS = window.CVPortal;
    const e = NS.state.ws.filings.offerings[oid].formD.filter((x) => x.status === 'draft').pop();
    const one = e.draft.relatedPersonsList[0];
    while (e.draft.relatedPersonsList.length < 99) e.draft.relatedPersonsList.push(JSON.parse(JSON.stringify(one)));
    NS.app.render();
  }, id);
  const at99 = await F.fr.locator('.fl-section [data-action="fd-person-add"]').count();
  await L9.press(F, '.fl-section [data-action="fd-person-add"]');
  const at100 = await F.fr.locator('.fl-section [data-action="fd-person-add"]').count();
  check('up to 100 related persons: the add control is there at 99 and gone at 100', at99 === 1 && at100 === 0 && (await F.fr.locator('.fl-section .fd-person').count()) === 100, { at99, at100 });
  await F.fr.evaluate((oid) => {
    const NS = window.CVPortal;
    const e = NS.state.ws.filings.offerings[oid].formD.filter((x) => x.status === 'draft').pop();
    e.draft.relatedPersonsList.length = 1;
    NS.app.save(true);
    NS.app.render();
  }, id);
  // sales compensation
  const none = await L9.text(F, '.fl-section [data-show="no-recipient"]');
  await L9.press(F, '.fl-section [data-action="fd-rcpt-add"]');
  await typeIn(F, `${P}.salesCompensationList[0].recipientName`, 'Harbor Placement LLC');
  r = await openReview(F);
  const part = r.errors.find((m) => m.field === `${P}.salesCompensationList[0]`);
  check('"No one is paid to sell" is the default; a recipient added with a name only is refused in plain words', /No one is paid to sell/.test(none) && !!part && /^Item 12: recipient 1: every part of a recipient must be filled in/.test(part.text) && r.sign === 0, { none, part });
  await toForm(F);
  const R = `${P}.salesCompensationList[0]`;
  await typeIn(F, `${R}.recipientCRDNumber`, 'None');
  await typeIn(F, `${R}.associatedBDName`, 'None');
  await typeIn(F, `${R}.associatedBDCRDNumber`, 'None');
  await typeIn(F, `${R}.recipientAddress.street1`, '10 Pier Road');
  await typeIn(F, `${R}.recipientAddress.city`, 'Albany');
  await choose(F, `${R}.recipientAddress.stateOrCountry`, 'NY');
  await typeIn(F, `${R}.recipientAddress.zipCode`, '12207');
  const states = await F.fr.locator(F_(`${R}.statesOfSolicitationList.state`)).count();
  await tick(F, `${R}.statesOfSolicitationList.allStates`);
  r = await openReview(F);
  check('with every part the rules need (CRD numbers, broker or dealer, address, states) the recipient is accepted', states === 52 && r.errors.length === 0 && /All states/.test(r.review) && /Harbor Placement LLC/.test(r.review), r.errors.map((m) => m.text));
  // the exemption: one, from the offering
  const one = await L9.text(F, '.fl-section .fd-review');
  await F.fr.evaluate((oid) => {
    const NS = window.CVPortal;
    NS.state.ws.offerings.find((x) => x.id === oid).structure.exemption = 'Rule 506(c)';
    NS.app.render();
  }, id);
  await toForm(F);
  const c = await L9.text(F, '.fl-section [data-show="exemption"]');
  st = await store(F, id);
  const ex = await F.fr.evaluate((oid) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const o = ws.offerings.find((x) => x.id === oid);
    const e = ws.filings.offerings[oid].formD.filter((x) => x.status === 'draft').pop();
    return NS.formD.prefill(o, NS.filings.facts(ws, o), ws.filings.offerings[oid]).draft.offeringData.federalExemptionsExclusions.concat(e.draft.offeringData.federalExemptionsExclusions);
  }, id);
  check('exactly one of Rule 506(b) and 506(c) is shown, from the offering, with nothing to choose', /Exemptions\s*Rule 506\(b\)/.test(one) && !/506\(c\)/.test(one) && /Rule 506\(c\)/.test(c) && !/506\(b\)/.test(c) && ex[0] === '06c' && (await F.fr.locator(`.fl-section input[value="06b"], .fl-section input[value="06c"]`).count()) === 0, { one: (one.match(/Exemptions[^\n]*\n?[^\n]*/) || [''])[0], c, ex });
  await F.fr.evaluate((oid) => {
    const NS = window.CVPortal;
    NS.state.ws.offerings.find((x) => x.id === oid).structure.exemption = 'Rule 506(b)';
    NS.app.save(true);
    NS.app.render();
  }, id);
  // a team member fills the form and sees no sign-off
  await L9.role(F, 'team');
  await L9.goto(F, `console-filings-formd-${id}`, '.fl-section .fd-form');
  await typeIn(F, `${P}.offeringSalesAmounts.clarificationOfResponse`, 'Commitments of limited partners');
  await F.fr.waitForTimeout(500);
  r = await openReview(F);
  st = await store(F, id);
  d = st.rec.formD.filter((x) => x.status === 'draft').pop().draft;
  check('a team member can fill the form, and sees no sign-off', d.offeringData.offeringSalesAmounts.clarificationOfResponse === 'Commitments of limited partners' && r.errors.length === 0 && r.sign === 0 && (await F.fr.locator('.fl-section .fd-sign').count()) === 0, { sign: r.sign });
  await L9.role(F, 'admin');
  await L9.goto(F, `console-filings-formd-${id}-review`, '.fl-section form[data-form="fd-signoff"]');
  // F6: a signed-off notice is never edited; a change is made on a copy
  await L9.press(F, '.fl-section form[data-form="fd-signoff"] button[type=submit]');
  await F.fr.waitForSelector('.fl-section .fd-signed', { timeout: 20000 }).catch(() => {});
  st = await store(F, id);
  const signedBefore = JSON.stringify(st.rec.formD.find((x) => x.status === 'ordered'));
  await L9.press(F, '.fl-section [data-action="fd-edit"]');
  await F.fr.waitForSelector('.fl-section .fd-form', { timeout: 20000 }).catch(() => {});
  await typeIn(F, `${P}.offeringSalesAmounts.clarificationOfResponse`, 'Changed after the sign-off');
  await F.fr.waitForTimeout(500);
  st = await store(F, id);
  const signedAfter = JSON.stringify(st.rec.formD.find((x) => x.status === 'ordered'));
  const copy = st.rec.formD.filter((x) => x.status === 'draft').pop();
  check('F6: editing after the sign-off leaves the signed entry byte-identical; the change is on a new draft that names it', signedBefore === signedAfter && !!copy && copy.replaces === JSON.parse(signedBefore).id && copy.draft.offeringData.offeringSalesAmounts.clarificationOfResponse === 'Changed after the sign-off', { copy: copy && { replaces: copy.replaces, status: copy.status } });
  await L9.goto(F, `console-filings-formd-${id}-review`, '.fl-section form[data-form="fd-signoff"]');
  await L9.press(F, '.fl-section form[data-form="fd-signoff"] button[type=submit]');
  await F.fr.waitForSelector('.fl-section .fd-signed', { timeout: 20000 }).catch(() => {});
  st = await store(F, id);
  const ordered = st.rec.formD.filter((x) => x.status === 'ordered');
  check('signing off the corrected copy keeps the one order (no second $100)', ordered.length === 2 && ordered[1].orderId === ordered[0].orderId && st.orders.length === 1 && JSON.stringify(ordered[0]) === signedBefore, { orders: st.orders.length, ids: ordered.map((x) => x.orderId) });
}

/** A masked notice EDGAR accepted (plan 09-02's fixtures): the notice filed before, by the portal or elsewhere. */
const REAL = fs.readFileSync(path.join(Lib.ROOT, 'server/test/fixtures/formd/real/real-09-D.xml'), 'utf8');
const REAL_D = require(path.join(Lib.ROOT, 'assets/js/formd.js')).fromXml(REAL);
const annualDue = (filedOn) => require(path.join(Lib.ROOT, 'assets/js/filings.js')).businessDay(`${Number(filedOn.slice(0, 4)) + 1}${filedOn.slice(4)}`);
const lineOf = (id) => `.fl-off[data-offering="${id}"] .fl-part[data-part="formd"] a`;
/** Review, sign-off and the $50 order of an amendment; the built file validates as a D/A. */
async function signAmendment(F, check, id, size, accession) {
  let r = await openReview(F);
  check('the amendment reviews with no error and the sign-off is offered', r.errors.length === 0 && r.sign === 1, r.errors.map((m) => m.text));
  await L9.press(F, '.fl-section form[data-form="fd-signoff"] button[type=submit]');
  await F.fr.waitForSelector('.fl-section .fd-signed', { timeout: 20000 }).catch(() => {});
  const done = await sectionText(F);
  const st = await store(F, id);
  const e = st.rec.formD.filter((x) => x.status === 'ordered').pop();
  const o = st.orders.find((x) => e && x.id === e.orderId) || {};
  check('signing off records an order of kind formd-amendment with "$50 due"', /\$50 due/.test(done) && !!e && e.type === 'D/A' && o.kind === 'formd-amendment' && o.dueCents === 5000 && st.orders.length === 1, { done: done.slice(0, 300), orders: st.orders });
  const v = await validates(F, id, `${size}-amendment`);
  check('the file built from the signed amendment validates against the SEC schema as a D/A with the previous accession number', /validates$/.test(v.out) && /<submissionType>D\/A<\/submissionType>/.test(v.xml) && /<isAmendment>true<\/isAmendment>/.test(v.xml) && v.xml.indexOf(`<previousAccessionNumber>${accession}</previousAccessionNumber>`) >= 0, v.out);
  r = await F.fr.evaluate(() => (window.CVPortal.state.ws.audit || []).map((x) => x.action));
  check('the amendment\'s start and sign-off are in the change log', r.indexOf('Form D amendment started') >= 0 && r.indexOf('Form D amendment signed off') >= 0, r.slice(0, 8));
}

/**
 * amend-phone: the portal's own filed notice, its annual reminder: the line "Amendment due <date>: Start", then "Start an
 * amendment". amend-desktop: a notice the sponsor filed themselves, the reminder for a change (minimum lowered by 12
 * percent): its file chosen (a masked filed notice) or its text pasted; a file that is not a Form D notice refused.
 */
async function amend(size, { check, S }) {
  const F = await L9.framed(S, size, { absent: OTHERS });
  await L9.proveRefused(check, F);
  await L9.sample(F);
  const seeded = await setup(F);
  const id = seeded.offeringId;
  const today = seeded.today;
  const phone = size === 'phone';
  const acc = '0001234567-25-000321';
  const filedOn = L9.iso(today, phone ? -350 : -200);
  // the notice the portal filed, read in Node (formd.js loads in the page only with the tab)
  const snap = require(path.join(Lib.ROOT, 'assets/js/formd.js')).snapshot(REAL_D);
  await F.fr.evaluate(([oid, d, snap, filedOn, acc, phone]) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    if (phone) {
      NS.filings.recordFiled(ws, oid, { type: 'D', filedOn, accession: acc, draft: d, snapshot: snap, source: 'portal' });
    } else {
      ws.offerings.find((x) => x.id === oid).minimum = 88000;
      NS.filings.recordFiled(ws, oid, { type: 'D', filedOn, accession: '', snapshot: { minimumInvestment: 100000 }, source: 'self' });
    }
    NS.app.save(true);
    NS.app.render();
  }, [id, REAL_D, snap, filedOn, acc, phone]);
  await L9.press(F, NAV);
  await F.fr.waitForSelector(lineOf(id), { timeout: 30000 }).catch(() => {});
  const line = await L9.text(F, lineOf(id));
  const want = phone ? `Amendment due ${L9.label(annualDue(filedOn))}: Start` : 'Amendment needed: Start';
  check(`F1: the Form D line carries the action: "${want}"`, line.indexOf(want) >= 0, line);
  if (line.indexOf(want) < 0) return F.A.context.close();
  await L9.press(F, lineOf(id));
  await F.fr.waitForSelector('.fl-section[data-part="formd"]', { timeout: 20000 }).catch(() => {});
  const before = (await store(F, id)).rec.formD.length;
  if (phone) {
    const start = await sectionText(F);
    check('the section names the last notice filed and offers "Start an amendment"', start.indexOf(L9.label(filedOn)) >= 0 && (await F.fr.locator('.fl-section [data-action="fd-amend"]').innerText().catch(() => '')).trim() === 'Start an amendment', start.slice(0, 300));
    await L9.press(F, '.fl-section [data-action="fd-amend"]');
  } else {
    const input = '.fl-section input[type="file"]';
    check('a notice filed elsewhere: its file can be chosen or its text pasted', (await F.fr.locator(input).count()) === 1 && (await F.fr.locator('.fl-section textarea[name="fd-paste"]').count()) === 1, await sectionText(F));
    await F.fr.setInputFiles(input, { name: 'notice.xml', mimeType: 'text/xml', buffer: Buffer.from('<?xml version="1.0"?>\n<invoice><total>5</total></invoice>\n') });
    await F.fr.waitForTimeout(600);
    let err = await L9.text(F, '.fl-section .fd-import-error');
    check('a file that is not a Form D notice gives one plain sentence and changes nothing', /not a Form D file/.test(err) && err.trim().split(/\.\s+\S/).length === 1 && (await store(F, id)).rec.formD.length === before, err);
    await F.fr.fill('.fl-section textarea[name="fd-paste"]', 'Minutes of the partners meeting');
    await L9.press(F, '.fl-section [data-action="fd-paste"]');
    err = await L9.text(F, '.fl-section .fd-import-error');
    check('pasted text that is not a Form D notice gives one plain sentence and changes nothing', /not a Form D file/.test(err) && (await store(F, id)).rec.formD.length === before, err);
    await F.fr.setInputFiles(input, { name: 'real-09-D.xml', mimeType: 'text/xml', buffer: Buffer.from(REAL) });
    await F.fr.waitForTimeout(800);
  }
  await F.fr.waitForSelector('.fl-section .fd-form', { timeout: 20000 }).catch(() => {});
  const f = await factsOf(F, id);
  let st = await store(F, id);
  const e = st.rec.formD.filter((x) => x.status === 'draft').pop();
  const shown = { type: await L9.text(F, '#fd-i7 p'), accession: await valueOf(F, `${P}.typeOfFiling.newOrAmendment.previousAccessionNumber`), sold: await valueOf(F, `${P}.offeringSalesAmounts.totalAmountSold`), investors: await valueOf(F, `${P}.investors.totalNumberAlreadyInvested`), minimum: await valueOf(F, `${P}.minimumInvestmentAccepted`), persons: await F.fr.locator('.fl-section .fd-person').count(), industry: await valueOf(F, `${P}.industryGroup.industryGroupType`) };
  check('a D/A draft holds the last notice\'s answers (its related persons, its industry group) with today\'s figures from the offering laid over them', !!e && e.type === 'D/A' && e.draft.submissionType === 'D/A' && e.draft.offeringData.typeOfFiling.newOrAmendment.isAmendment === true && /^Amendment/.test(shown.type) && shown.persons === REAL_D.relatedPersonsList.length && shown.industry === REAL_D.offeringData.industryGroup.industryGroupType && shown.sold === String(f.sold) && shown.investors === String(f.investors) && shown.minimum === (f.minimum == null ? REAL_D.offeringData.minimumInvestmentAccepted : String(f.minimum)) && shown.sold !== REAL_D.offeringData.offeringSalesAmounts.totalAmountSold, { shown, facts: { sold: f.sold, investors: f.investors, minimum: f.minimum } });
  if (phone) check('the previous accession number is filled from the record', shown.accession === acc, shown.accession);
  else {
    check('the record has no accession number, so it is asked: empty on the form, and Review names it', shown.accession === '', shown.accession);
    const r = await openReview(F);
    const a = r.errors.find((m) => m.field === `${P}.typeOfFiling.newOrAmendment.previousAccessionNumber`);
    check('Review lists the missing accession number under Item 7, with no other error', !!a && /^Item 7: /.test(a.text) && r.errors.length === 1, r.errors.map((m) => m.text));
    await toForm(F);
    await typeIn(F, `${P}.typeOfFiling.newOrAmendment.previousAccessionNumber`, acc);
    await F.fr.waitForTimeout(400);
  }
  await L9.wayOut(check, F, 'the amendment form: Back on screen', BACK);
  await L9.leak(check, F, 'the amendment form');
  await signAmendment(F, check, id, size, acc);
  if (!phone) {
    // the pasted text of a filed notice, on a second offering
    const other = await setup(F, { name: 'Second Harbor Fund, L.P.', shortName: 'Second Harbor' });
    await F.fr.evaluate((oid) => {
      const NS = window.CVPortal;
      NS.filings.recordFiled(NS.state.ws, oid, { type: 'D', filedOn: NS.dates.today(), accession: '', source: 'self' });
      NS.app.render();
    }, other.offeringId);
    await L9.goto(F, `console-filings-formd-${other.offeringId}`, '.fl-section textarea[name="fd-paste"]');
    await F.fr.fill('.fl-section textarea[name="fd-paste"]', REAL);
    await L9.press(F, '.fl-section [data-action="fd-paste"]');
    await F.fr.waitForSelector('.fl-section .fd-form', { timeout: 20000 }).catch(() => {});
    st = await store(F, other.offeringId);
    const p = st.rec.formD.filter((x) => x.status === 'draft').pop();
    check('the pasted text of the filed notice fills the amendment the same way', !!p && p.type === 'D/A' && p.draft.relatedPersonsList.length === REAL_D.relatedPersonsList.length && (await F.fr.locator('.fl-section .fd-person').count()) === REAL_D.relatedPersonsList.length, p && p.type);
  }
  await L9.wayOut(check, F, 'after the sign-off: Back on screen', BACK);
  await L9.quiet(check, F);
  await F.A.context.close();
}

const PARTS = {
  'order-phone': (ctx) => order('phone', ctx),
  'order-desktop': (ctx) => order('desktop', ctx),
  'errors-phone': (ctx) => errors('phone', ctx),
  'errors-desktop': (ctx) => errors('desktop', ctx),
  'amend-phone': (ctx) => amend('phone', ctx),
  'amend-desktop': (ctx) => amend('desktop', ctx)
};

Lib.runParts(PARTS, { name: 'FORMD FLOW', browser: true });
