// gate: node
// last "FORMD XML: PASS (cases run: 9)"
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
/** obj's value at a path such as 'relatedPersonsList[0].relatedPersonName.firstName' is set to value. */
function at(obj, p, value) {
  const keys = p.replace(/\[(\d+)\]/g, '.$1').split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k) => (o = o[k]));
  o[keys[keys.length - 1]] = value;
}
/** The invented notice with every optional part too: a second street line, a middle name, a clarification, a recipient. */
function full(FD) {
  const d = invented(FD);
  d.primaryIssuer.issuerAddress.street2 = 'Suite 5';
  d.relatedPersonsList[0].relatedPersonName.middleName = 'Q';
  d.relatedPersonsList[0].relationshipClarification = 'Managing member of the general partner';
  d.offeringData.salesCompensationList.push({ recipientName: 'Example Placement LLC', recipientCRDNumber: '123456', associatedBDName: 'None', associatedBDCRDNumber: 'None', recipientAddress: Object.assign(copy(ADDRESS), { street2: 'Floor 2' }), statesOfSolicitationList: { allStates: false, state: ['NY', 'CA'] }, foreignSolicitation: false });
  return d;
}
/** What the server passes when it writes the file to file: TEST, the issuer's CCC and the filer contact. */
const OPTS = { mode: 'TEST', ccc: CCC, contact: Object.assign({ notify: ['desk@example.com'] }, CONTACT), submission: true, today: '2026-11-19' };
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

  async real({ check }) {
    const FD = load();
    const dir = path.join(FIX, 'real');
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^real-\d\d-(D|DA)\.xml$/.test(f)).sort() : [];
    check(`twelve masked filings are stored (found ${names.length})`, names.length === 12);
    check('six are Form D and six are Form D/A', names.filter((f) => /-D\.xml$/.test(f)).length === 6 && names.filter((f) => /-DA\.xml$/.test(f)).length === 6);
    const structure = {};
    (fs.existsSync(path.join(dir, 'STRUCTURE.txt')) ? fs.readFileSync(path.join(dir, 'STRUCTURE.txt'), 'utf8') : '').split('\n').forEach((l) => {
      const m = l.match(/^([0-9a-f]{64})\s+(\d+)\s+(\S+)$/);
      if (m) structure[m[3]] = { hash: m[1], count: Number(m[2]) };
    });
    check('STRUCTURE.txt lists exactly the twelve files', names.length === 12 && same(Object.keys(structure).sort(), names));
    const main = fs.readFileSync(XSD, 'utf8');
    // words of the schema's own choice lists (never the two-letter codes), which say nothing about anyone
    const WORDS = new Set(['true', 'false'].concat(Array.from(main.matchAll(/<xs:enumeration value="([^"]*)"\/>/g)).map((x) => x[1])));
    const NUMBER = /^[0-9]+$/;
    const DATE = /^\d{4}-\d\d-\d\d$/;
    // the masking set of mask-formd.js, written out again here so the tool cannot loosen its own proof
    const ENTITY = /^Masked Entity \d{2,3}$/;
    const SIGNER = /^Masked Signer \d{2,3}$/;
    const TEXT = /^Masked text \d{2,3}$/;
    const CRD = /^9000\d{2,3}$/;
    const ALLOWED = {
      schemaVersion: (v) => /^X\d{4}$/.test(v),
      submissionType: (v) => v === 'D' || v === 'D/A',
      testOrLive: (v) => v === 'LIVE' || v === 'TEST',
      cik: (v) => /^90000000\d\d$/.test(v),
      entityName: (v) => ENTITY.test(v),
      issuerName: (v) => ENTITY.test(v),
      previousName: (v) => ENTITY.test(v),
      recipientName: (v) => ENTITY.test(v),
      associatedBDName: (v) => ENTITY.test(v),
      firstName: (v) => /^Given\d{2,3}$/.test(v),
      middleName: (v) => /^Middle\d{2,3}$/.test(v),
      lastName: (v) => /^Family\d{2,3}$/.test(v),
      street1: (v) => /^\d{2,3} Masked Street$/.test(v),
      street2: (v) => /^Suite \d{2,3}$/.test(v),
      city: (v) => /^Masked City \d{2,3}$/.test(v),
      zipCode: (v) => /^000\d\d$/.test(v),
      issuerPhoneNumber: (v) => /^\(555\) 010-0\d{3}$/.test(v),
      stateOrCountry: (v) => FD.LISTS.stateOrCountry.indexOf(v) >= 0,
      state: (v) => FD.LISTS.stateOfSolicitation.indexOf(v) >= 0,
      'yearOfInc/value': (v) => /^2\d\d\d$/.test(v),
      'dateOfFirstSale/value': (v) => DATE.test(v),
      'statesOfSolicitationList/value': (v) => v === 'All States',
      signatureDate: (v) => DATE.test(v),
      previousAccessionNumber: (v) => /^9000000000-00-000\d{3}$/.test(v),
      recipientCRDNumber: (v) => CRD.test(v),
      associatedBDCRDNumber: (v) => CRD.test(v),
      minimumInvestmentAccepted: (v) => NUMBER.test(v),
      totalOfferingAmount: (v) => NUMBER.test(v) || v === 'Indefinite',
      totalAmountSold: (v) => NUMBER.test(v),
      totalRemaining: (v) => NUMBER.test(v) || v === 'Indefinite',
      numberNonAccreditedInvestors: (v) => NUMBER.test(v),
      totalNumberAlreadyInvested: (v) => NUMBER.test(v),
      dollarAmount: (v) => NUMBER.test(v),
      signatureName: (v) => SIGNER.test(v),
      nameOfSigner: (v) => SIGNER.test(v)
    };
    const files = names.map((f) => path.join(dir, f));
    const v = lint(files);
    files.forEach((f, i) => {
      const name = names[i];
      const text = fs.readFileSync(f, 'utf8');
      check(`${name} validates against the pinned schema`, v[f] === true);
      const body = text.replace(/^<\?xml version="1\.0"\?>\s*/, '');
      const marks = (body.match(/<[^>]*>/g) || []).filter((t) => !/^<\/?[A-Za-z0-9]+>$/.test(t));
      check(`${name} holds no comment, attribute or instruction`, marks.length === 0 && body.indexOf('<?') < 0 && body.indexOf('<!') < 0 && /^<\?xml version="1\.0"\?>/.test(text), { found: marks.length });
      // every text value: on a miss the element is named, never the value itself
      const stack = [];
      const missed = [];
      const tags = [];
      let last = '';
      let value = '';
      (body.match(/<[^>]*>|[^<]+/g) || []).forEach((t) => {
        if (t.charAt(0) !== '<') {
          value = t;
          return;
        }
        if (t.charAt(1) === '/') {
          const leaf = last === 'open';
          const n = stack.pop();
          if (leaf) {
            const val = value.trim();
            const rule = ALLOWED[`${stack[stack.length - 1]}/${n}`] || ALLOWED[n];
            const ok = val === '' || WORDS.has(val) || (rule ? rule(val) : TEXT.test(val));
            if (!ok || val !== value) missed.push(stack.concat(n).slice(1).join('/'));
          } else if (value.trim() !== '') missed.push(`${stack.concat(n).slice(1).join('/')} (text beside elements)`);
          last = 'close';
        } else {
          if (value.trim() !== '') missed.push(`${stack.slice(1).join('/')} (text beside elements)`);
          stack.push(t.slice(1, -1));
          tags.push(t.slice(1, -1));
          last = 'open';
        }
        value = '';
      });
      check(`${name}: every text value is a schema value, a number or date in its own element, or a member of the masking set`, missed.length === 0, Array.from(new Set(missed)).slice(0, 12));
      const type = (text.match(/<submissionType>([^<]*)<\/submissionType>/) || [])[1];
      check(`${name} is the form type its name says`, type === (/-DA\.xml$/.test(name) ? 'D/A' : 'D'));
      const s = structure[name];
      check(`${name} has the elements the tool counted in the original (${s ? s.count : 'not listed'})`, !!s && s.count === tags.length && s.hash === sha(tags.join('\n')));
    });
  },

  async roundtrip({ check }) {
    const FD = load();
    const files = fixtures();
    check(`all fourteen fixtures are read back: the SEC's two samples and twelve masked filings (found ${files.length})`, files.length === 14);
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
  },

  async agree({ check }) {
    const FD = load();
    const base = full(FD);
    const all = (list, layer, level) => list.filter((e) => (!layer || e.layer === layer) && (!level || e.level === level));
    const first = FD.validate(base, copy(OPTS));
    check('the complete notice draws no error and no warning', first.length === 0, first.slice(0, 5));
    const S = (p, v) => (d) => at(d, p, v);
    const X = (n, ch) => (ch || 'x').repeat(n);
    const many = (row, n) => Array.from({ length: n }, () => copy(row));
    const P0 = 'relatedPersonsList[0]';
    const OD = 'offeringData';
    const R0 = `${OD}.salesCompensationList[0]`;
    const G0 = `${OD}.signatureBlock.signature[0]`;
    const AM = `${OD}.offeringSalesAmounts`;
    const rows = [];
    // each row of the research's lengths table: at its limit (the schema accepts) and one past it (the schema refuses)
    [
      ['primaryIssuer.issuerAddress.street1', 40], ['primaryIssuer.issuerAddress.street2', 40], ['primaryIssuer.issuerAddress.city', 30], ['primaryIssuer.issuerAddress.zipCode', 10, '1'],
      ['primaryIssuer.issuerPhoneNumber', 20], [`${G0}.issuerName`, 150], [`${P0}.relatedPersonName.firstName`, 150], [`${P0}.relatedPersonName.middleName`, 150], [`${P0}.relatedPersonName.lastName`, 200],
      [`${P0}.relationshipClarification`, 255], [`${G0}.signatureName`, 30], [`${G0}.signatureTitle`, 60], [`${G0}.nameOfSigner`, 150], [`${OD}.minimumInvestmentAccepted`, 12, '9'], [`${AM}.totalAmountSold`, 12, '9'],
      [`${AM}.totalOfferingAmount`, 12, '9'], [`${AM}.totalRemaining`, 12, '9'], [`${OD}.salesCommissionsFindersFees.salesCommissions.dollarAmount`, 12, '9'], [`${OD}.salesCommissionsFindersFees.findersFees.dollarAmount`, 12, '9'],
      [`${OD}.useOfProceeds.grossProceedsUsed.dollarAmount`, 12, '9'], [`${OD}.investors.totalNumberAlreadyInvested`, 12, '9'], ['primaryIssuer.cik', 10, '1'], [`${R0}.recipientCRDNumber`, 9, '1'], [`${R0}.associatedBDCRDNumber`, 9, '1'],
      [`${R0}.recipientName`, 200], [`${R0}.associatedBDName`, 200], [`${R0}.recipientAddress.street1`, 40], [`${R0}.recipientAddress.city`, 30], [`${OD}.typesOfSecuritiesOffered.descriptionOfOtherType`, 255],
      [`${OD}.businessCombinationTransaction.clarificationOfResponse`, 255], [`${AM}.clarificationOfResponse`, 255], ['primaryIssuer.entityTypeOtherDesc', 255], [`${P0}.relatedPersonAddress.street1`, 40], [`${P0}.relatedPersonAddress.zipCode`, 10, 'A']
    ].forEach(([p, n, ch]) => {
      rows.push([`${p} of ${n} characters`, true, S(p, X(n, ch))]);
      rows.push([`${p} of ${n + 1} characters`, false, S(p, X(n + 1, ch))]);
    });
    const O = (k, v) => (d, o) => at(o, k, v);
    rows.push(['a contact name of 30', true, O('contact.name', X(30))], ['a contact name of 31', false, O('contact.name', X(31))], ['a contact phone of 20', true, O('contact.phone', X(20, '5'))], ['a contact phone of 21', false, O('contact.phone', X(21, '5'))]);
    rows.push(['a CCC of 8 characters with a space', true, O('ccc', 'ab cd#12')], ['a CCC of 7 characters', false, O('ccc', 'abcd#12')], ['a CCC of 9 characters', false, O('ccc', 'abcd#1234')]);
    rows.push(['three notification addresses', true, O('contact.notify', ['a@example.com', 'b@example.com', 'c@example.com'])], ['four notification addresses', false, O('contact.notify', ['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com'])]);
    rows.push(['a contact email that is not one', false, O('contact.email', 'not-an-email')], ['a contact with no phone', false, O('contact.phone', '')], ['a contact with no name', false, O('contact.name', '   ')], ['a contact with no email', false, O('contact.email', '')], ['TEST or LIVE set to BETA', false, O('mode', 'BETA')], ['LIVE', true, O('mode', 'LIVE')]);
    // how many of each list the schema takes
    const person = base.relatedPersonsList[0];
    const recipient = base.offeringData.salesCompensationList[0];
    const signature = base.offeringData.signatureBlock.signature[0];
    rows.push(['100 related persons', true, S('relatedPersonsList', many(person, 100))], ['101 related persons', false, S('relatedPersonsList', many(person, 101))], ['no related person', false, S('relatedPersonsList', [])]);
    rows.push(['three relationships', true, S(`${P0}.relatedPersonRelationshipList`, ['Director', 'Promoter', 'Executive Officer'])], ['four relationships', false, S(`${P0}.relatedPersonRelationshipList`, ['Director', 'Promoter', 'Executive Officer', 'Director'])], ['no relationship', false, S(`${P0}.relatedPersonRelationshipList`, [])]);
    rows.push(['21 exemption items', true, S(`${OD}.federalExemptionsExclusions`, FD.LISTS.exemption.slice(3))], ['22 exemption items', false, S(`${OD}.federalExemptionsExclusions`, FD.LISTS.exemption.slice(2))], ['no exemption item', false, S(`${OD}.federalExemptionsExclusions`, [])]);
    rows.push(['100 recipients', true, S(`${OD}.salesCompensationList`, many(recipient, 100))], ['101 recipients', false, S(`${OD}.salesCompensationList`, many(recipient, 101))], ['no recipient', true, S(`${OD}.salesCompensationList`, [])]);
    rows.push(['101 signatures', true, S(`${OD}.signatureBlock.signature`, many(signature, 101))], ['102 signatures', false, S(`${OD}.signatureBlock.signature`, many(signature, 102))], ['no signature', false, S(`${OD}.signatureBlock.signature`, [])]);
    rows.push(['99 additional issuers', true, S('issuerList', many(base.primaryIssuer, 99))], ['100 additional issuers', false, S('issuerList', many(base.primaryIssuer, 100))]);
    rows.push(['three previous names', true, S('primaryIssuer.issuerPreviousNameList.previousName', ['A', 'B', 'C'])], ['four previous names', false, S('primaryIssuer.issuerPreviousNameList.previousName', ['A', 'B', 'C', 'D'])], ['a previous name of 151', false, S('primaryIssuer.issuerPreviousNameList.previousName', [X(151)])]);
    rows.push(['every state of solicitation', true, S(`${R0}.statesOfSolicitationList.state`, FD.LISTS.stateOfSolicitation)], ['All States together with a list of states', false, S(`${R0}.statesOfSolicitationList.allStates`, true)], ['All States alone', true, (d) => at(d, `${R0}.statesOfSolicitationList`, { allStates: true, state: [] })], ['no state of solicitation', true, S(`${R0}.statesOfSolicitationList.state`, [])]);
    // a value outside each choice list
    [
      ['primaryIssuer.entityType', 'Partnership'], [`${P0}.relatedPersonRelationshipList`, ['Owner']], [`${OD}.federalExemptionsExclusions`, ['06d']], [`${OD}.industryGroup.industryGroupType`, 'Real Estate'], [`${OD}.industryGroup.investmentFundInfo.investmentFundType`, 'Fund'],
      [`${OD}.issuerSize.revenueRange`, '$1 - $2'], ['primaryIssuer.issuerAddress.stateOrCountry', 'ZZ'], [`${P0}.relatedPersonAddress.stateOrCountry`, 'ny'], [`${R0}.statesOfSolicitationList.state`, ['NY', 'ZZ']], ['submissionType', 'D/B'],
      [`${OD}.industryGroup.investmentFundInfo.is40Act`, 'yes'], [`${OD}.durationOfOffering.moreThanOneYear`, 'maybe'], [`${OD}.businessCombinationTransaction.isBusinessCombinationTransaction`, 'no'], [`${OD}.investors.hasNonAccreditedInvestors`, 'some'],
      [`${R0}.foreignSolicitation`, 'maybe'], [`${OD}.typeOfFiling.newOrAmendment.isAmendment`, 'new'], [`${OD}.typesOfSecuritiesOffered.isEquityType`, 'yes'], [`${OD}.salesCommissionsFindersFees.salesCommissions.isEstimate`, 'about'],
      ['primaryIssuer.yearOfInc.value', '1999'], ['primaryIssuer.yearOfInc.value', '20x6'], [`${OD}.signatureBlock.authorizedRepresentative`, 'x'], ['over100PersonsFlag', 'many'], [`${R0}.recipientAddress.stateOrCountry`, 'New York']
    ].forEach(([p, v]) => rows.push([`${p} set to ${JSON.stringify(v)}`, false, S(p, v)]));
    rows.push(['a net asset value range that is not on the list', false, (d) => at(d, `${OD}.issuerSize`, { revenueRange: '', aggregateNetAssetValueRange: 'Lots' })], ['a net asset value range in place of the revenue range', true, (d) => at(d, `${OD}.issuerSize`, { revenueRange: '', aggregateNetAssetValueRange: 'Decline to Disclose' })]);
    rows.push(['both a revenue range and a net asset value range', false, S(`${OD}.issuerSize.aggregateNetAssetValueRange`, 'Decline to Disclose')], ['neither range', false, S(`${OD}.issuerSize.revenueRange`, '')]);
    rows.push(['a date of first sale together with yet to occur', false, S(`${OD}.typeOfFiling.dateOfFirstSale.yetToOccur`, true)], ['neither a date of first sale nor yet to occur', false, S(`${OD}.typeOfFiling.dateOfFirstSale.value`, '')], ['yet to occur alone', true, (d) => at(d, `${OD}.typeOfFiling.dateOfFirstSale`, { value: '', yetToOccur: true })]);
    // each required element removed
    [
      'submissionType', 'primaryIssuer.cik', 'primaryIssuer.issuerAddress.street1', 'primaryIssuer.issuerAddress.city', 'primaryIssuer.issuerAddress.stateOrCountry', 'primaryIssuer.issuerAddress.zipCode', 'primaryIssuer.issuerPhoneNumber', 'primaryIssuer.entityType',
      'primaryIssuer.yearOfInc.kind', `${P0}.relatedPersonName.firstName`, `${P0}.relatedPersonName.lastName`, `${P0}.relatedPersonAddress.street1`, `${P0}.relatedPersonAddress.city`, `${P0}.relatedPersonAddress.stateOrCountry`, `${P0}.relatedPersonAddress.zipCode`,
      `${OD}.industryGroup.industryGroupType`, `${OD}.industryGroup.investmentFundInfo.investmentFundType`, `${OD}.minimumInvestmentAccepted`, `${AM}.totalOfferingAmount`, `${AM}.totalAmountSold`, `${AM}.totalRemaining`, `${OD}.investors.totalNumberAlreadyInvested`,
      `${OD}.salesCommissionsFindersFees.salesCommissions.dollarAmount`, `${OD}.salesCommissionsFindersFees.findersFees.dollarAmount`, `${OD}.useOfProceeds.grossProceedsUsed.dollarAmount`, `${G0}.issuerName`, `${G0}.signatureName`, `${G0}.nameOfSigner`, `${G0}.signatureTitle`,
      `${G0}.signatureDate`, `${R0}.recipientName`, `${R0}.recipientCRDNumber`, `${R0}.associatedBDName`, `${R0}.associatedBDCRDNumber`, `${R0}.recipientAddress.street1`, `${R0}.recipientAddress.city`, `${R0}.recipientAddress.stateOrCountry`, `${R0}.recipientAddress.zipCode`
    ].forEach((p) => rows.push([`${p} left out`, false, S(p, '')]));
    [`${OD}.industryGroup.investmentFundInfo.is40Act`, `${OD}.typeOfFiling.newOrAmendment.isAmendment`, `${OD}.durationOfOffering.moreThanOneYear`, `${OD}.businessCombinationTransaction.isBusinessCombinationTransaction`, `${OD}.investors.hasNonAccreditedInvestors`].forEach((p) => rows.push([`${p} not answered`, false, S(p, null)]));
    rows.push(['a city of spaces only', false, S('primaryIssuer.issuerAddress.city', '   ')], ['no second street line, no middle name, no clarification', true, (d) => { at(d, 'primaryIssuer.issuerAddress.street2', ''); at(d, `${P0}.relatedPersonName.middleName`, ' '); at(d, `${P0}.relationshipClarification`, ''); }]);
    // patterns
    [
      ['primaryIssuer.issuerAddress.zipCode', 'AB*12', false], ['primaryIssuer.issuerAddress.zipCode', 'ab 12-#', true], ['primaryIssuer.issuerAddress.zipCode', '10001-1234', true], ['primaryIssuer.cik', '12345A', false], ['primaryIssuer.cik', '7', true],
      [`${G0}.signatureDate`, '2026-02-30', false], [`${G0}.signatureDate`, '11/10/2026', false], [`${G0}.signatureDate`, '2024-02-29', true], [`${G0}.signatureDate`, '2026-11-10Z', undefined], [`${OD}.typeOfFiling.dateOfFirstSale.value`, '2026-13-01', false], [`${OD}.typeOfFiling.dateOfFirstSale.value`, '2026-1-1', false],
      [`${OD}.minimumInvestmentAccepted`, 'ten', false], [`${OD}.minimumInvestmentAccepted`, '1.5', false], [`${OD}.minimumInvestmentAccepted`, '-5', false], [`${OD}.minimumInvestmentAccepted`, '1,000', false], [`${OD}.minimumInvestmentAccepted`, '$1000', false],
      [`${OD}.minimumInvestmentAccepted`, '+5', undefined], [`${OD}.minimumInvestmentAccepted`, '-0', undefined], [`${OD}.minimumInvestmentAccepted`, '007', undefined], [`${OD}.minimumInvestmentAccepted`, 250000, true], [`${OD}.minimumInvestmentAccepted`, 0, true],
      [`${AM}.totalOfferingAmount`, 'indefinite', false], [`${AM}.totalOfferingAmount`, 'Indefinite', true], [`${AM}.totalOfferingAmount`, '+5', false], [`${AM}.totalOfferingAmount`, '1.5', false], [`${AM}.totalAmountSold`, 'Indefinite', false], [`${AM}.totalRemaining`, 'Indefinite', true],
      [`${AM}.totalOfferingAmount`, String.fromCharCode(0x661, 0x662, 0x663), undefined], [`${OD}.investors.numberNonAccreditedInvestors`, '4', true], [`${OD}.investors.numberNonAccreditedInvestors`, 'four', false],
      [`${R0}.recipientCRDNumber`, 'none', false], [`${R0}.recipientCRDNumber`, 'None', true], [`${R0}.recipientCRDNumber`, '12-34', false], [`${OD}.typeOfFiling.newOrAmendment.previousAccessionNumber`, '0001234567-26-000123', true],
      [`${OD}.typeOfFiling.newOrAmendment.previousAccessionNumber`, '123', false], [`${OD}.typeOfFiling.newOrAmendment.previousAccessionNumber`, '00012345678-26-000123', false], [`${OD}.typeOfFiling.newOrAmendment.previousAccessionNumber`, '0001234567-26-0001234', false],
      [`${P0}.relatedPersonName.lastName`, 'O\'Neil & Sons <"Fund">', true], [`${P0}.relatedPersonName.lastName`, 'Line one\nline two\ttabbed', true], ['primaryIssuer.issuerPhoneNumber', '+44 (0)20 7946 0000', true]
    ].forEach(([p, v, ok]) => rows.push([`${p} set to ${JSON.stringify(v)}`, ok, S(p, v)]));
    rows.push(['a fund block with no fund type', false, (d) => at(d, `${OD}.industryGroup.investmentFundInfo`, { investmentFundType: '', is40Act: false })], ['no fund block', true, S(`${OD}.industryGroup.investmentFundInfo`, null)]);

    const built = rows.map(([name, expect, edit]) => {
      const d = copy(base);
      const o = copy(OPTS);
      edit(d, o);
      return { name, expect, xml: FD.toXml(d, o), errors: all(FD.validate(d, o), 'schema', 'error') };
    });
    const verdict = valid(built.map((b) => b.xml));
    const apart = built.filter((b, i) => (b.errors.length === 0) !== verdict[i]).map((b, i) => `${b.name} (the rule table says ${b.errors.length ? 'not valid' : 'valid'})`);
    const surprise = built.filter((b, i) => b.expect !== undefined && b.expect !== verdict[i]).map((b) => b.name);
    const faults = verdict.filter((v) => v === false).length;
    check(`the rule table and the SEC schema give the same verdict on every variant (variants run: ${built.length}, faults the schema refuses: ${faults})`, apart.length === 0, apart.slice(0, 12));
    check(`at least 60 single faults were run (${faults})`, faults >= 60);
    check('the schema accepts each at-the-limit variant and refuses each fault, as this case expects', surprise.length === 0, surprise.slice(0, 12));
    const messages = built.reduce((a, b) => a.concat(b.errors), []);
    check('every schema-layer message names its item in plain words and its field', messages.length >= faults && messages.every((m) => /^(Item ([1-9]|1[0-6])|Signature|Filer|File): [^<>{}]+\.$/.test(m.message) && !/undefined|null|NaN|[a-z][A-Z]/.test(m.message) && typeof m.field === 'string' && m.field !== '' && m.level === 'error'), messages.filter((m) => !/^(Item ([1-9]|1[0-6])|Signature|Filer|File): [^<>{}]+\.$/.test(m.message) || /undefined|null|NaN|[a-z][A-Z]/.test(m.message)).slice(0, 5));
  },

  async rules({ check }) {
    const FD = load();
    const base = full(FD);
    const OD = 'offeringData';
    const R0 = `${OD}.salesCompensationList[0]`;
    const AM = `${OD}.offeringSalesAmounts`;
    const run = (edit, opts) => {
      const d = copy(base);
      const o = Object.assign({ today: '2026-11-19' }, opts);
      if (edit) edit(d);
      return FD.validate(d, o);
    };
    const has = (list, level, item, words) => list.some((e) => e.layer === 'edgar' && e.level === level && e.item === item && words.test(e.message) && e.message.indexOf(typeof item === 'number' ? `Item ${item}: ` : '') === 0);
    const errors = (list) => list.filter((e) => e.level === 'error');
    check('the complete notice draws nothing', run().length === 0, run().slice(0, 3));
    // [what, the item named, words the message must hold, the edit, options]
    const refusedRows = [
      ['Rule 506(b) together with Rule 506(c)', 6, /506\(b\).*506\(c\)/, (d) => at(d, `${OD}.federalExemptionsExclusions`, ['06b', '06c'])],
      ['a P.O. box as the principal place of business', 2, /P\.O\. box/, (d) => at(d, 'primaryIssuer.issuerAddress.street1', 'P.O. Box 1234')],
      ['PO BOX in the second street line', 2, /P\.O\. box/, (d) => at(d, 'primaryIssuer.issuerAddress.street2', 'PO BOX 9')],
      ['Post Office Box', 2, /P\.O\. box/, (d) => at(d, 'primaryIssuer.issuerAddress.street1', 'Post Office Box 77')],
      ['a total remaining that is not total minus sold', 13, /minus/, (d) => at(d, `${AM}.totalRemaining`, '1')],
      ['more sold than offered', 13, /more than the total offering amount/, (d) => at(d, `${AM}.totalAmountSold`, '50000001')],
      ['an Indefinite total with a numbered remaining', 13, /Indefinite/, (d) => at(d, `${AM}.totalOfferingAmount`, 'Indefinite')],
      ['a numbered total with an Indefinite remaining', 13, /minus/, (d) => at(d, `${AM}.totalRemaining`, 'Indefinite')],
      ['a signature dated after today', 'signature', /future/, (d) => at(d, `${OD}.signatureBlock.signature[0].signatureDate`, '2026-11-20')],
      ['no year of formation when formed within five years', 1, /year/, (d) => at(d, 'primaryIssuer.yearOfInc.value', '')],
      ['a pooled investment fund without its fund type', 4, /type of fund/, (d) => at(d, `${OD}.industryGroup.investmentFundInfo`, null)],
      ['a hedge fund without a net asset value range', 5, /net asset value/, (d) => at(d, `${OD}.industryGroup.investmentFundInfo.investmentFundType`, 'Hedge Fund')],
      ['another investment fund without a net asset value range', 5, /net asset value/, (d) => at(d, `${OD}.industryGroup.investmentFundInfo.investmentFundType`, 'Other Investment Fund')],
      ['an issuer that is no hedge fund without a revenue range', 5, /revenue range/, (d) => at(d, `${OD}.issuerSize`, { revenueRange: '', aggregateNetAssetValueRange: 'Decline to Disclose' })],
      ['entity type Other without its description', 1, /describe/i, (d) => at(d, 'primaryIssuer.entityType', 'Other')],
      ['securities type Other without its description', 9, /describe/i, (d) => at(d, `${OD}.typesOfSecuritiesOffered.isOtherType`, true)],
      ['no type of security', 9, /at least one/, (d) => at(d, `${OD}.typesOfSecuritiesOffered.isPooledInvestmentFundType`, false)],
      ['a new notice with an accession number', 7, /new notice/, (d) => at(d, `${OD}.typeOfFiling.newOrAmendment.previousAccessionNumber`, '0001234567-26-000123')],
      ['a new notice marked as an amendment', 7, /new notice/, (d) => at(d, `${OD}.typeOfFiling.newOrAmendment.isAmendment`, true)],
      ['an amendment without its previous accession number', 7, /accession number/, (d) => { at(d, 'submissionType', 'D/A'); at(d, `${OD}.typeOfFiling.newOrAmendment.isAmendment`, true); }],
      ['an amendment not marked as one', 7, /amendment/, (d) => { at(d, 'submissionType', 'D/A'); at(d, `${OD}.typeOfFiling.newOrAmendment.previousAccessionNumber`, '0001234567-26-000123'); }],
      ['a recipient with no CRD number', 12, /recipient 1: .*except the second street line/, (d) => at(d, `${R0}.recipientCRDNumber`, '')],
      ['a recipient with no city', 12, /except the second street line/, (d) => at(d, `${R0}.recipientAddress.city`, '')],
      ['a recipient with no name', 12, /except the second street line/, (d) => at(d, `${R0}.recipientName`, '')],
      ['a required value of spaces only', 2, /only spaces/, (d) => at(d, 'primaryIssuer.issuerAddress.city', '   ')],
      ['neither previous names nor None', 1, /previous names/, (d) => at(d, 'primaryIssuer.issuerPreviousNameList', { none: false, previousName: [] })],
      ['an amount with a plus sign', 11, /digits 0 to 9/, (d) => at(d, `${OD}.minimumInvestmentAccepted`, '+5')],
      ['a more-than-100 mark with one related person', 3, /100/, (d) => at(d, 'over100PersonsFlag', true)],
      ['no filer contact when the file is for submission', 'filer', /contact/, null, { submission: true, contact: null }],
      ['an empty filer contact when the file is for submission', 'filer', /contact/, null, { submission: true, contact: { name: '', phone: '', email: '' } }],
      ['no CCC when the file is for submission and a CCC was asked for', 'filer', /CCC/, null, { submission: true, ccc: '' }],
      ['a second issuer without its own CCC', 'filer', /additional issuer 1.*CCC/, (d) => at(d, 'issuerList', [copy(base.primaryIssuer)]), { submission: true, ccc: CCC }]
    ];
    refusedRows.forEach(([what, item, words, edit, opts]) => {
      const list = run(edit, opts);
      check(`refused, naming ${typeof item === 'number' ? `Item ${item}` : `the ${item}`}: ${what}`, has(list, 'error', item, words), list.filter((e) => e.layer === 'edgar').map((e) => e.message).slice(0, 3));
    });
    const amended = (d) => { at(d, 'submissionType', 'D/A'); at(d, `${OD}.typeOfFiling.newOrAmendment`, { isAmendment: true, previousAccessionNumber: '0001234567-26-000123' }); };
    const fine = [
      ['a recipient with no second street line', (d) => at(d, `${R0}.recipientAddress.street2`, '')],
      ['an amendment with its accession number', amended],
      ['Indefinite total and Indefinite remaining', (d) => { at(d, `${AM}.totalOfferingAmount`, 'Indefinite'); at(d, `${AM}.totalRemaining`, 'Indefinite'); }],
      ['a signature dated today', (d) => at(d, `${OD}.signatureBlock.signature[0].signatureDate`, '2026-11-19')],
      ['Boxwood Lane and Polo Box Road as street lines', (d) => { at(d, 'primaryIssuer.issuerAddress.street1', '12 Boxwood Lane'); at(d, 'primaryIssuer.issuerAddress.street2', '1 Polo Box Road'); }],
      ['a hedge fund with a net asset value range', (d) => { at(d, `${OD}.industryGroup.investmentFundInfo.investmentFundType`, 'Hedge Fund'); at(d, `${OD}.issuerSize`, { revenueRange: '', aggregateNetAssetValueRange: 'Decline to Disclose' }); }],
      ['formed over five years ago, with no year', (d) => at(d, 'primaryIssuer.yearOfInc', { kind: 'overFiveYears', value: '' })],
      ['for submission, with nothing said about a contact or a CCC (the short form)', null, { submission: true }],
      ['for submission with a contact and a CCC', null, { submission: true, contact: CONTACT, ccc: CCC }]
    ];
    fine.forEach(([what, edit, opts]) => {
      const list = run(edit, opts);
      check(`not refused: ${what}`, errors(list).length === 0, errors(list).map((e) => e.message).slice(0, 3));
    });
    const warned = [
      ['36 non-accredited investors under Rule 506(b)', 14, /35/, (d) => at(d, `${OD}.investors`, { hasNonAccreditedInvestors: true, numberNonAccreditedInvestors: '36', totalNumberAlreadyInvested: '40' })],
      ['an offering amount of 0', 13, /\$0/, (d) => { at(d, `${AM}.totalOfferingAmount`, '0'); at(d, `${AM}.totalAmountSold`, '0'); at(d, `${AM}.totalRemaining`, '0'); }],
      ['a 3(c) exclusion without pooled investment fund interests', 6, /pooled investment fund/, (d) => { at(d, `${OD}.typesOfSecuritiesOffered.isPooledInvestmentFundType`, false); at(d, `${OD}.typesOfSecuritiesOffered.isEquityType`, true); }],
      ['Rule 504 above $10,000,000', 6, /10,000,000/, (d) => { at(d, `${OD}.federalExemptionsExclusions`, ['04']); at(d, `${AM}.totalOfferingAmount`, '10000001'); at(d, `${AM}.totalRemaining`, '8750001'); at(d, `${OD}.typesOfSecuritiesOffered.isEquityType`, true); }]
    ];
    warned.forEach(([what, item, words, edit]) => {
      const list = run(edit);
      check(`a warning, never an error: ${what}`, has(list, 'warning', item, words) && errors(list).length === 0, list.map((e) => `${e.level}: ${e.message}`).slice(0, 3));
    });
    const quiet = [
      ['35 non-accredited investors under Rule 506(b)', (d) => at(d, `${OD}.investors`, { hasNonAccreditedInvestors: true, numberNonAccreditedInvestors: '35', totalNumberAlreadyInvested: '40' })],
      ['Rule 504 at exactly $10,000,000', (d) => { at(d, `${OD}.federalExemptionsExclusions`, ['04']); at(d, `${AM}.totalOfferingAmount`, '10000000'); at(d, `${AM}.totalRemaining`, '8750000'); }]
    ];
    quiet.forEach(([what, edit]) => check(`no warning: ${what}`, run(edit).length === 0, run(edit).slice(0, 2)));
    const every = refusedRows.concat(warned).reduce((a, r) => a.concat(run(r[3], r[4])), []);
    check('every message is a plain sentence that starts with its item', every.length > 0 && every.every((m) => /^(Item ([1-9]|1[0-6])|Signature|Filer|File): [^<>{}]+\.$/.test(m.message) && !/undefined|null|NaN|[a-z][A-Z]/.test(m.message)), every.filter((m) => !/^(Item ([1-9]|1[0-6])|Signature|Filer|File): [^<>{}]+\.$/.test(m.message) || /undefined|null|NaN|[a-z][A-Z]/.test(m.message)).map((m) => m.message).slice(0, 5));
    // the twelve notices EDGAR accepted: the rule table must not refuse what the SEC took
    fixtures().filter((f) => /real-/.test(f)).forEach((f) => {
      const list = errors(FD.validate(FD.fromXml(fs.readFileSync(f, 'utf8')), { today: '2099-01-01' }));
      check(`${rel(f)}, which EDGAR accepted, draws no error`, list.length === 0, list.map((e) => e.message).slice(0, 4));
    });
  },

  async output({ check }) {
    const FD = load();
    const d = full(FD);
    const NAME = 'O\'Neil & Sons <"Fund"> LP';
    d.relatedPersonsList[0].relatedPersonName.lastName = NAME;
    d.offeringData.signatureBlock.signature[0].issuerName = NAME;
    d.primaryIssuer.issuerAddress.city = '  New York  ';
    d.relatedPersonsList[0].relationshipClarification = 'Line one\r\nline two\ttabbed';
    d.offeringData.minimumInvestmentAccepted = 250000;
    d.offeringData.salesCompensationList = [];
    const test = FD.toXml(d, { mode: 'TEST', ccc: CCC, contact: CONTACT });
    const review = FD.toXml(d);
    const v = valid([test, review]);
    check('the file with awkward characters validates, for filing and as a review copy', v[0] === true && v[1] === true);
    check('the first bytes are the XML declaration', test.indexOf('<?xml version="1.0"?>\n<edgarSubmission>\n') === 0);
    check('the file holds none of the elements EDGAR fills itself', !/<(schemaVersion|entityName|jurisdictionOfInc|edgarPreviousNameList|stateOrCountryDescription|description)>/.test(test + review));
    check('the file holds no stylesheet line, no comment and no attribute', (test.match(/<\?/g) || []).length === 1 && test.indexOf('<!') < 0 && !/<[A-Za-z0-9]+\s[^>]*>/.test(test) && test.indexOf('stylesheet') < 0);
    const lines = test.split('\n').filter((l) => l !== '');
    check(`each element is on one line with its value (${lines.length} lines)`, lines.length > 80 && lines.slice(1).every((l) => /^ *(<[A-Za-z0-9]+>[^<>\r\n\t]*<\/[A-Za-z0-9]+>|<\/?[A-Za-z0-9]+>)$/.test(l)));
    check('a value typed over two lines is written on one', test.indexOf('<relationshipClarification>Line one line two tabbed</relationshipClarification>') > 0);
    check('values are trimmed', test.indexOf('<city>New York</city>') > 0);
    check('the five XML characters are escaped in the file', test.indexOf('<lastName>O&apos;Neil &amp; Sons &lt;&quot;Fund&quot;&gt; LP</lastName>') > 0);
    const back = FD.fromXml(test);
    check('an ampersand, angle brackets and both quote characters in a name come back unchanged', back.relatedPersonsList[0].relatedPersonName.lastName === NAME && back.offeringData.signatureBlock.signature[0].issuerName === NAME);
    check('the CCC appears once when passed, and the review copy holds none', (test.match(/<ccc>/g) || []).length === 1 && test.indexOf(`<ccc>${CCC}</ccc>`) > 0 && review.indexOf('ccc') < 0 && review.indexOf(CCC) < 0);
    check('the review copy holds no contact and no TEST or LIVE line', !/<contactData>|<testOrLive>|<notificationAddressList>/.test(review));
    const amounts = Array.from(test.matchAll(/<(minimumInvestmentAccepted|totalOfferingAmount|totalAmountSold|totalRemaining|dollarAmount|totalNumberAlreadyInvested)>([^<]*)</g)).map((m) => m[2]);
    check(`amounts are whole dollars (${amounts.length})`, amounts.length === 8 && amounts.every((a) => /^[0-9]+$/.test(a)) && test.indexOf('<minimumInvestmentAccepted>250000</minimumInvestmentAccepted>') > 0);
    check('an amount with cents is refused', FD.validate(Object.assign(copy(d), { offeringData: Object.assign(copy(d.offeringData), { minimumInvestmentAccepted: '250000.50' }) }), { today: '2026-11-19' }).some((e) => e.level === 'error' && e.item === 11));
    check('an empty list is written as an empty element on one line', test.indexOf('\n        <salesCompensationList></salesCompensationList>\n') > 0);
    check('a draft with parts missing is still written, and validate says what is missing', typeof FD.toXml({}) === 'string' && FD.validate({}, { today: '2026-11-19' }).filter((e) => e.level === 'error').length > 10);
  },

  async prefill({ check }) {
    const FD = load();
    // facts and rec as plan 09-01 gives them (NS.filings.facts and NS.filings.rec), written out here
    const offering = { id: 'off-1', name: 'Example Fund I LP', structure: { exemption: 'Rule 506(b)' } };
    const facts = { regime: '506b', usd: true, firstSale: '2026-10-05', sold: 1250000, investors: 3, nonAccredited: { count: 2, pending: 1, unanswered: 0 }, total: 50000000, minimum: 250000, byState: { NY: 2, CA: 1 }, outsideUS: 0 };
    const rec = { firstSale: '2026-10-01', issuer: { street1: '100 Main Street', street2: 'Suite 5', city: 'New York', state: 'NY', zip: '10001', phone: '212-555-0100', entityType: 'Limited Partnership', entityTypeOther: '', yearKind: 'withinFiveYears', yearFormed: '2026', previousNames: [], signerName: 'Jane Example', signerTitle: 'Managing Member' }, edgar: { cik: '1234567890', name: 'EXAMPLE FUND I LP' }, formD: [] };
    const p = FD.prefill(offering, facts, rec);
    const d = p.draft;
    const o = d.offeringData;
    check('a Rule 506(b) offering gives exactly the 06b item', same(o.federalExemptionsExclusions, ['06b']) && p.sources['offeringData.federalExemptionsExclusions'] === 'offering');
    const c = FD.prefill(offering, Object.assign({}, facts, { regime: '506c', nonAccredited: { count: 0, pending: 0, unanswered: 0 } }), rec);
    check('a Rule 506(c) offering gives exactly the 06c item, and no sale to non-accredited investors', same(c.draft.offeringData.federalExemptionsExclusions, ['06c']) && c.draft.offeringData.investors.hasNonAccreditedInvestors === false && c.draft.offeringData.investors.numberNonAccreditedInvestors === '');
    check('the total offering amount is the facts\' total, and the remaining is total minus sold', o.offeringSalesAmounts.totalOfferingAmount === '50000000' && o.offeringSalesAmounts.totalRemaining === '48750000' && p.sources['offeringData.offeringSalesAmounts.totalOfferingAmount'] === 'offering');
    const ind = FD.prefill(offering, Object.assign({}, facts, { total: 'Indefinite' }), rec).draft.offeringData.offeringSalesAmounts;
    check('a total of Indefinite gives Indefinite for the total and the remaining', ind.totalOfferingAmount === 'Indefinite' && ind.totalRemaining === 'Indefinite' && ind.totalAmountSold === '1250000');
    const open = FD.prefill(offering, Object.assign({}, facts, { total: null }), rec);
    check('no total leaves the amount for the sponsor and lists it as missing', open.draft.offeringData.offeringSalesAmounts.totalOfferingAmount === '' && open.missing.indexOf('offeringData.offeringSalesAmounts.totalOfferingAmount') >= 0 && !('offeringData.offeringSalesAmounts.totalOfferingAmount' in open.sources));
    check('the amount sold and the total investors are the facts\' (a drawdown fund\'s commitments)', o.offeringSalesAmounts.totalAmountSold === '1250000' && o.investors.totalNumberAlreadyInvested === '3' && p.sources['offeringData.offeringSalesAmounts.totalAmountSold'] === 'investors' && p.sources['offeringData.investors.totalNumberAlreadyInvested'] === 'investors');
    check('the non-accredited count is the facts\' count of investors who have invested', o.investors.numberNonAccreditedInvestors === '2' && o.investors.hasNonAccreditedInvestors === true);
    check('the minimum investment is the offering\'s', o.minimumInvestmentAccepted === '250000' && p.sources['offeringData.minimumInvestmentAccepted'] === 'offering');
    check('the date of first sale is the one on the record', o.typeOfFiling.dateOfFirstSale.value === '2026-10-01' && p.sources['offeringData.typeOfFiling.dateOfFirstSale.value'] === 'record');
    const noRec = FD.prefill(offering, facts, Object.assign({}, rec, { firstSale: '' }));
    check('with none on the record, the date of first sale is the facts\' suggestion', noRec.draft.offeringData.typeOfFiling.dateOfFirstSale.value === '2026-10-05' && noRec.sources['offeringData.typeOfFiling.dateOfFirstSale.value'] === 'investors');
    const noSale = FD.prefill(offering, Object.assign({}, facts, { firstSale: null, sold: 0, investors: 0, nonAccredited: { count: 0, pending: 0, unanswered: 0 } }), Object.assign({}, rec, { firstSale: '' }));
    check('with no sale at all, the first sale is suggested as yet to occur', noSale.draft.offeringData.typeOfFiling.dateOfFirstSale.yetToOccur === true && noSale.draft.offeringData.typeOfFiling.dateOfFirstSale.value === '');
    const i = d.primaryIssuer;
    check('the issuer\'s address, phone, entity type and year come from the record', same(i.issuerAddress, { street1: '100 Main Street', street2: 'Suite 5', city: 'New York', stateOrCountry: 'NY', zipCode: '10001' }) && i.issuerPhoneNumber === '212-555-0100' && i.entityType === 'Limited Partnership' && same(i.yearOfInc, { kind: 'withinFiveYears', value: '2026' }) && i.issuerPreviousNameList.none === true && p.sources['primaryIssuer.issuerAddress.street1'] === 'record');
    const g = o.signatureBlock.signature;
    check('the CIK and the name for the signature come from the record of the EDGAR account, the signer from the issuer\'s record', i.cik === '1234567890' && g.length === 1 && g[0].issuerName === 'EXAMPLE FUND I LP' && g[0].signatureName === 'Jane Example' && g[0].nameOfSigner === 'Jane Example' && g[0].signatureTitle === 'Managing Member' && g[0].signatureDate === '');
    const fx = FD.prefill(offering, Object.assign({}, facts, { usd: false }), rec);
    const AMOUNTS = ['offeringData.minimumInvestmentAccepted', 'offeringData.offeringSalesAmounts.totalOfferingAmount', 'offeringData.offeringSalesAmounts.totalAmountSold', 'offeringData.offeringSalesAmounts.totalRemaining'];
    const fo = fx.draft.offeringData;
    check('an offering not in US dollars leaves every amount for the sponsor and lists them as missing', fo.minimumInvestmentAccepted === '' && fo.offeringSalesAmounts.totalOfferingAmount === '' && fo.offeringSalesAmounts.totalAmountSold === '' && fo.offeringSalesAmounts.totalRemaining === '' && AMOUNTS.every((k) => fx.missing.indexOf(k) >= 0 && !(k in fx.sources)) && fo.investors.totalNumberAlreadyInvested === '3');
    check('every source is the offering, the investors or the record, and nothing is both filled and missing', Object.keys(p.sources).length >= 18 && Object.keys(p.sources).every((k) => ['offering', 'investors', 'record'].indexOf(p.sources[k]) >= 0 && p.missing.indexOf(k) < 0));
    const bare = FD.prefill(offering, facts, {});
    check('with nothing on the record, the issuer\'s details are listed as missing', ['primaryIssuer.cik', 'primaryIssuer.issuerAddress.street1', 'primaryIssuer.issuerPhoneNumber', 'primaryIssuer.entityType', 'offeringData.signatureBlock.signature[0].issuerName'].every((k) => bare.missing.indexOf(k) >= 0));
    check('an offering under any other exemption returns nothing to pre-fill', FD.prefill(offering, Object.assign({}, facts, { regime: 'rega' }), rec) === null && FD.prefill(offering, {}, rec) === null);
    const rest = FD.validate(d, { today: '2026-11-19' }).filter((e) => e.level === 'error');
    check('what is left for the sponsor is only what the portal does not hold', rest.length > 0 && rest.every((e) => !(e.field in p.sources)), rest.filter((e) => e.field in p.sources).map((e) => e.message).slice(0, 4));

    // snapshot: the values an amendment is decided on (the contract plan 09-01's changeNeeded compares)
    const a = full(FD);
    const s = FD.snapshot(a);
    check('snapshot has exactly the contract\'s keys', same(Object.keys(s).sort(), ['commissions', 'findersFees', 'material', 'minimumInvestment', 'nonAccredited', 'proceedsToInsiders', 'relatedPersons', 'totalOffering']));
    check('snapshot gives the amounts as numbers and the related persons as lower-case names', s.minimumInvestment === 250000 && s.totalOffering === 50000000 && s.nonAccredited === 0 && s.commissions === 0 && s.findersFees === 0 && s.proceedsToInsiders === 0 && same(s.relatedPersons, ['jane|q|example']) && typeof s.material === 'string' && s.material.length > 20);
    const b = copy(a);
    b.relatedPersonsList[0].relatedPersonAddress.street1 = '9 Other Road';
    b.relatedPersonsList[0].relatedPersonRelationshipList = ['Director'];
    b.offeringData.offeringSalesAmounts.totalAmountSold = '2000000';
    b.offeringData.offeringSalesAmounts.totalRemaining = '48000000';
    b.offeringData.issuerSize.revenueRange = 'No Revenues';
    b.offeringData.investors.totalNumberAlreadyInvested = '9';
    b.offeringData.salesCompensationList[0].recipientAddress.city = 'Boston';
    b.offeringData.salesCompensationList[0].statesOfSolicitationList.state = ['MA'];
    check('the same snapshot when only a related person\'s address or relationship, the amount sold, the issuer\'s size, the investor total or a recipient\'s address and states differ', same(FD.snapshot(b), s));
    const more = copy(a);
    more.relatedPersonsList.push(Object.assign(copy(a.relatedPersonsList[0]), { relatedPersonName: { firstName: 'John', middleName: '', lastName: 'Sample' } }));
    check('a different snapshot when a related person is added', !same(FD.snapshot(more).relatedPersons, s.relatedPersons) && same(FD.snapshot(more).relatedPersons, ['jane|q|example', 'john||sample']) && FD.snapshot(more).material === s.material);
    const changes = {
      'the exemption': (x) => (x.offeringData.federalExemptionsExclusions = ['06c']),
      'the issuer\'s street address': (x) => (x.primaryIssuer.issuerAddress.street1 = '200 Main Street'),
      'the industry group': (x) => (x.offeringData.industryGroup.industryGroupType = 'Residential'),
      'the duration': (x) => (x.offeringData.durationOfOffering.moreThanOneYear = false),
      'the types of securities': (x) => (x.offeringData.typesOfSecuritiesOffered.isDebtType = true),
      'the business combination answer': (x) => (x.offeringData.businessCombinationTransaction.isBusinessCombinationTransaction = true),
      'who receives sales compensation': (x) => (x.offeringData.salesCompensationList[0].recipientName = 'Another Placement LLC')
    };
    Object.keys(changes).forEach((k) => {
      const x = copy(a);
      changes[k](x);
      check(`the material text changes with ${k}`, FD.snapshot(x).material !== s.material);
    });
    const ind2 = copy(a);
    ind2.offeringData.offeringSalesAmounts.totalOfferingAmount = 'Indefinite';
    check('an Indefinite total is given as the word, a blank amount as null', FD.snapshot(ind2).totalOffering === 'Indefinite' && FD.snapshot(FD.blank()).minimumInvestment === null);
  },

  async selfcheck({ check }) {
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const unknown = run(['--case', 'nope']);
    check('an unknown --case name exits 1 with FAIL', unknown.status === 1 && /^FAIL /m.test(unknown.stdout) && /FORMD XML: FAIL/.test(unknown.stdout));
    const none = run(['--case', '']);
    check('an empty --case list exits 1 with FAIL', none.status === 1 && /^FAIL /m.test(none.stdout) && /FORMD XML: FAIL/.test(none.stdout));
    const one = run(['--case', 'samples']);
    check('one named case runs alone', one.status === 0 && /FORMD XML: PASS \(cases run: 1\)/.test(one.stdout));
  }
};

L.runParts(cases, { name: 'FORMD XML', unit: 'cases', flag: '--case' });
