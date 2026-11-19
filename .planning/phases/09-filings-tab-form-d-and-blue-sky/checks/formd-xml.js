// gate: node
// last "FORMD XML: PASS (cases run: 3)"
// The Form D builder (assets/js/formd.js) against the SEC's own schema files, which are pinned by SHA-256 and checked
// before anything else. Pure: no browser, no network, no filing. Every file the builder writes, and every fixture, is
// passed to xmllint with server/test/fixtures/formd/schema/formDSubmission.xsd.xml.
//   node formd-xml.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "FORMD XML: PASS (cases run: N)" or
// "FORMD XML: FAIL (cases run: N) - <failed cases>". Without xmllint it prints NOT RUN and exits 2.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const FIX = path.join(L.ROOT, 'server/test/fixtures/formd');
const XSD = path.join(FIX, 'schema/formDSubmission.xsd.xml');
const MODULE = path.join(L.ROOT, 'assets/js/formd.js');
const PINS = {
  'formDSubmission.xsd.xml': '799c31edf928b32b7c1f1e3d96dff25ccf202c750e50da84939d91018758eb1b',
  'formDStateCodes.xsd.xml': '272042a7b552bf203c15defc3d52cbf2f85985dcf227fece3faf1e03d46301af',
  'statesOfSolicitationCodes.xsd.xml': 'ca7d7903fa52ff78ea68a794a788851c73cdba1cf21a59afd4c5facf96c928e9'
};
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const copy = (x) => JSON.parse(JSON.stringify(x));

if (spawnSync('xmllint', ['--version']).error) {
  console.log('NOT RUN: xmllint is not installed (the check passes every file to it with the SEC schema)');
  process.exit(2);
}
// the pins are checked before every run, whichever cases were asked for
const sums = {};
fs.readFileSync(path.join(FIX, 'schema/SHA256SUMS'), 'utf8')
  .split('\n')
  .forEach((l) => {
    const m = l.match(/^([0-9a-f]{64})\s+\*?(.+)$/);
    if (m) sums[m[2].trim()] = m[1];
  });
const pinState = Object.keys(PINS).map((f) => {
  const h = sha(fs.readFileSync(path.join(FIX, 'schema', f)));
  return { f, ok: h === PINS[f] && sums[f] === PINS[f], h };
});
if (pinState.some((p) => !p.ok)) {
  pinState.filter((p) => !p.ok).forEach((p) => console.log(`FAIL pins ${p.f} does not match its pin (${p.h.slice(0, 12)})`));
  console.log('FORMD XML: FAIL (cases run: 0) - a schema file differs from its pin');
  process.exit(1);
}

const TMP = process.env.FORMD_OUT || path.join(L.SCRATCH, `formd-xml-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });
process.on('exit', () => {
  if (!process.env.FORMD_OUT) fs.rmSync(TMP, { recursive: true, force: true });
});

/** The module as the browser loads it: a script that attaches to window.CVPortal. Loaded inside each case. */
function load() {
  const window = { CVPortal: {} };
  vm.runInContext(fs.readFileSync(MODULE, 'utf8'), vm.createContext({ window }), { filename: 'formd.js' });
  if (!window.CVPortal.formD) throw new Error('assets/js/formd.js did not attach NS.formD');
  return window.CVPortal.formD;
}
/** xmllint with the pinned schema over files (paths) → { path: true | false }. One process for the whole list. */
function lint(files) {
  const out = {};
  for (let i = 0; i < files.length; i += 200) {
    const part = files.slice(i, i + 200);
    const r = spawnSync('xmllint', ['--noout', '--schema', XSD].concat(part), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const ok = new Set(
      String(r.stderr || '')
        .split('\n')
        .filter((l) => / validates$/.test(l))
        .map((l) => l.replace(/ validates$/, ''))
    );
    part.forEach((f) => (out[f] = ok.has(f)));
  }
  return out;
}
let seq = 0;
/** Texts → the SEC schema's verdict on each, in order. */
function valid(texts) {
  const files = texts.map((t) => {
    const f = path.join(TMP, `t${++seq}.xml`);
    fs.writeFileSync(f, t);
    return f;
  });
  const v = lint(files);
  const out = files.map((f) => v[f]);
  files.forEach((f) => fs.rmSync(f, { force: true }));
  return out;
}
const fixtures = () =>
  ['samples', 'real']
    .map((d) => path.join(FIX, d))
    .filter((d) => fs.existsSync(d))
    .reduce((a, d) => a.concat(fs.readdirSync(d).filter((f) => /\.xml$/.test(f)).sort().map((f) => path.join(d, f))), []);
const rel = (f) => path.relative(FIX, f);

const CONTACT = { name: 'Filing Desk', phone: '212-555-0100', email: 'filings@example.com' };
const CCC = 'abcd#123';
const ADDRESS = { street1: '100 Main Street', street2: '', city: 'New York', stateOrCountry: 'NY', zipCode: '10001' };
/** An invented new notice with every required item, built from blank(). */
function invented(FD) {
  const d = FD.blank();
  d.submissionType = 'D';
  Object.assign(d.primaryIssuer, { cik: '1234567890', issuerPhoneNumber: '212-555-0100', entityType: 'Limited Partnership' });
  Object.assign(d.primaryIssuer.issuerAddress, ADDRESS);
  d.primaryIssuer.issuerPreviousNameList.none = true;
  Object.assign(d.primaryIssuer.yearOfInc, { kind: 'withinFiveYears', value: '2026' });
  d.relatedPersonsList.push({
    relatedPersonName: { firstName: 'Jane', middleName: '', lastName: 'Example' },
    relatedPersonAddress: copy(ADDRESS),
    relatedPersonRelationshipList: ['Executive Officer'],
    relationshipClarification: ''
  });
  const o = d.offeringData;
  o.industryGroup.industryGroupType = 'Pooled Investment Fund';
  o.industryGroup.investmentFundInfo = { investmentFundType: 'Private Equity Fund', is40Act: false };
  o.issuerSize.revenueRange = 'Decline to Disclose';
  o.federalExemptionsExclusions = ['06b', '3C', '3C.1'];
  o.typeOfFiling.newOrAmendment.isAmendment = false;
  o.typeOfFiling.dateOfFirstSale.value = '2026-11-02';
  o.durationOfOffering.moreThanOneYear = true;
  o.typesOfSecuritiesOffered.isPooledInvestmentFundType = true;
  o.businessCombinationTransaction.isBusinessCombinationTransaction = false;
  o.minimumInvestmentAccepted = '250000';
  Object.assign(o.offeringSalesAmounts, { totalOfferingAmount: '50000000', totalAmountSold: '1250000', totalRemaining: '48750000' });
  Object.assign(o.investors, { hasNonAccreditedInvestors: false, totalNumberAlreadyInvested: '3' });
  o.salesCommissionsFindersFees.salesCommissions.dollarAmount = '0';
  o.salesCommissionsFindersFees.findersFees.dollarAmount = '0';
  o.useOfProceeds.grossProceedsUsed.dollarAmount = '0';
  o.signatureBlock.authorizedRepresentative = false;
  o.signatureBlock.signature.push({ issuerName: 'EXAMPLE FUND I LP', signatureName: 'Jane Example', nameOfSigner: 'Jane Example', signatureTitle: 'Managing Member of the General Partner', signatureDate: '2026-11-10' });
  return d;
}
/** The enumeration values of a simple type in a schema file's text; a union gives its member types' values in order. */
function enumOf(xsd, name) {
  const m = xsd.match(new RegExp(`<xs:simpleType name="${name}">([\\s\\S]*?)</xs:simpleType>`));
  if (!m) return null;
  const u = m[1].match(/<xs:union memberTypes="([^"]+)"/);
  if (u) return u[1].split(/\s+/).reduce((a, t) => a.concat(enumOf(xsd, t)), []);
  return Array.from(m[1].matchAll(/<xs:enumeration value="([^"]*)"\/>/g)).map((x) => x[1]);
}
/** Does fromXml refuse this text in plain words (an Error whose message names Form D and no program term)? */
function refused(FD, text) {
  try {
    FD.fromXml(text);
    return 'read without an error';
  } catch (e) {
    const msg = String((e && e.message) || e);
    return /Form D/.test(msg) && !/undefined|null|TypeError|Cannot read|is not a function|NaN/.test(msg) ? '' : `not plain words: ${msg.slice(0, 160)}`;
  }
}

const cases = {
  async pins({ check }) {
    const FD = load();
    pinState.forEach((p) => check(`${p.f} equals its pin in SHA256SUMS and in this check`, p.ok));
    const api = require(MODULE);
    const KEYS = ['LISTS', 'blank', 'prefill', 'validate', 'toXml', 'fromXml', 'snapshot'];
    check('the module gives the same seven names in the page and under Node', KEYS.every((k) => k in FD && k in api), Object.keys(FD));
    const main = fs.readFileSync(XSD, 'utf8');
    const states = fs.readFileSync(path.join(FIX, 'schema/formDStateCodes.xsd.xml'), 'utf8');
    const sol = fs.readFileSync(path.join(FIX, 'schema/statesOfSolicitationCodes.xsd.xml'), 'utf8');
    const want = {
      entityType: enumOf(main, 'ENTITY_TYPE_TYPE'),
      relationship: enumOf(main, 'RELATIONSHIP_TYPE'),
      exemption: enumOf(main, 'FEDERAL_EXEMPTION_LIST'),
      industryGroup: enumOf(main, 'INDUSTRY_GROUP_LIST'),
      investmentFund: enumOf(main, 'INVESTMENT_FUND_LIST'),
      revenueRange: enumOf(main, 'REVENUE_RANGE_TYPE'),
      aggregateNetAssetValueRange: enumOf(main, 'AGGREGATE_NET_ASSET_VALUE_RANGE_TYPE'),
      stateOrCountry: enumOf(states, 'STATE_COUNTRY_CODE'),
      stateOfSolicitation: enumOf(sol, 'STATE_SOLICITATION_CODE')
    };
    Object.keys(want).forEach((k) => check(`LISTS.${k} equals the schema's list (${(want[k] || []).length} values)`, want[k] && want[k].length > 0 && same(FD.LISTS[k], want[k]), { got: (FD.LISTS[k] || []).length }));
    const names = {};
    Array.from(states.matchAll(/<xs:enumeration value="([^"]*)"\/>\s*<!--\s*(.*?)\s*-->/g)).forEach((x) => (names[x[1]] = x[2]));
    check(`LISTS.stateOrCountryName names every code as the schema file's comments do (${Object.keys(names).length})`, Object.keys(names).length === want.stateOrCountry.length && same(FD.LISTS.stateOrCountryName, names));
    check('LISTS holds no list this case does not compare', same(Object.keys(FD.LISTS).sort(), Object.keys(want).concat('stateOrCountryName').sort()), Object.keys(FD.LISTS));
  },

  async samples({ check }) {
    const files = ['SampleFormD.xml', 'SampleFormD_A.xml'].map((f) => path.join(FIX, 'samples', f));
    const v = lint(files);
    files.forEach((f) => check(`${rel(f)} validates against the pinned schema`, v[f] === true));
  },

  async roundtrip({ check }) {
    const FD = load();
    const files = fixtures();
    check(`fixtures to read back: ${files.length}`, files.length >= 2);
    const built = [];
    files.forEach((f) => {
      const d = FD.fromXml(fs.readFileSync(f, 'utf8'));
      const x = FD.toXml(d);
      const again = FD.fromXml(x);
      check(`${rel(f)}: reading the rebuilt file gives the same draft`, same(again, d));
      const text = JSON.stringify(d);
      check(`${rel(f)}: the draft holds no CCC, contact, notification address, TEST or LIVE, or return copy`, !/"(ccc|contactData|notificationAddressList|testOrLive|returnCopy)"/.test(text) && text.indexOf('pa$$w0rd') < 0 && text.indexOf('joe.filer') < 0);
      built.push(x, FD.toXml(d, { mode: 'TEST', ccc: Object.assign({}, ...[d.primaryIssuer].concat(d.issuerList).map((i) => ({ [i.cik]: CCC }))), contact: CONTACT }));
    });
    const v = valid(built);
    files.forEach((f, i) => {
      check(`${rel(f)}: the rebuilt file validates`, v[2 * i] === true);
      check(`${rel(f)}: the rebuilt file with a CCC and a contact validates`, v[2 * i + 1] === true);
    });

    const d = invented(FD);
    const test = FD.toXml(d, { mode: 'TEST', ccc: CCC, contact: CONTACT });
    const review = FD.toXml(d);
    const iv = valid([test, review]);
    check('an invented new notice validates in TEST mode with a contact and an eight-character CCC', iv[0] === true);
    check('the same notice validates as a review copy', iv[1] === true);
    check('the TEST file says TEST and holds the CCC and the contact', test.indexOf('<testOrLive>TEST</testOrLive>') > 0 && test.indexOf(`<ccc>${CCC}</ccc>`) > 0 && test.indexOf('<contactEmailAddress>filings@example.com</contactEmailAddress>') > 0);
    check('the review copy holds no CCC, no contact and no TEST or LIVE', !/<ccc>|<contactData>|<testOrLive>/.test(review));
    check('the invented notice comes back as the same draft', same(FD.fromXml(test), d) && same(FD.fromXml(review), d));

    // what fromXml refuses (T-09-04, B1), each in plain words
    const ok = review;
    const root = (attrs) => ok.replace('<edgarSubmission>', `<edgarSubmission${attrs}>`);
    const SEC_ROOT = ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="formDSubmission.xsd.xml"';
    check('the SEC samples\' two root attributes and comments are read and dropped', same(FD.fromXml(root(SEC_ROOT).replace('<submissionType>', '<!-- a comment -->\n<submissionType>')), d));
    const bad = {
      'a document type declaration': ok.replace('<edgarSubmission>', '<!DOCTYPE edgarSubmission SYSTEM "x.dtd">\n<edgarSubmission>'),
      'an entity declaration': ok.replace('<edgarSubmission>', '<!DOCTYPE edgarSubmission [<!ENTITY a "aaaa">]>\n<edgarSubmission>'),
      'an entity that is not one of the five': ok.replace('Jane Example', 'Jane &a; Example'),
      'any other attribute on the root': root(' xmlns="http://example.com/x"'),
      'an attribute on an inner element': ok.replace('<cik>', '<cik type="x">'),
      'a stylesheet instruction': ok.replace('<edgarSubmission>', '<?xml-stylesheet type="text/xsl" href="x.xsl"?>\n<edgarSubmission>'),
      'an unknown root': ok.replace(/edgarSubmission>/g, 'ownershipDocument>'),
      'an element Form D does not have': ok.replace('<relatedPersonsList>', '<somethingElse>1</somethingElse>\n<relatedPersonsList>'),
      'an element closed by another name': ok.replace('</cik>', '</ccc>'),
      'a file that stops early': ok.slice(0, Math.floor(ok.length / 2)),
      'text that is not XML': 'Form D notice, typed by hand',
      'an empty file': '',
      'text after the notice': ok + '\n<edgarSubmission></edgarSubmission>'
    };
    Object.keys(bad).forEach((k) => {
      const why = refused(FD, bad[k]);
      check(`fromXml refuses ${k}, in plain words`, why === '', why);
    });
  }
};

L.runParts(cases, { name: 'FORMD XML', unit: 'cases', flag: '--case' });
