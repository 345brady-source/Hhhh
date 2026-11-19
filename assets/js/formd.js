/*
 * Form D, the SEC's notice of an exempt offering: pre-fill a notice from an offering, check it, write the XML file
 * EDGAR accepts, and read a filed notice back.
 *
 * This file works on plain data only. It touches nothing when it loads, so it also loads outside a browser (the checks
 * and the server: module.exports under Node). It makes no filing and holds no secret: the issuer's CCC is passed in by
 * the server when the file to file is written, and is never part of a draft.
 *
 *   LISTS                          the SEC schema's choice lists, word for word
 *   blank(kind)                    an empty draft; with kind 'issuer', 'address', 'person', 'fund', 'recipient' or
 *                                  'signature', an empty row of that kind
 *   prefill(offering, facts, rec)  { draft, sources, missing } for a Rule 506(b) or 506(c) offering, null for any other
 *   validate(draft, opts)          [ { item, field, level, layer, message } ]; opts { today, submission, ccc, contact }
 *   toXml(draft, opts)             the file's text; opts { mode: 'TEST' | 'LIVE', ccc, contact }; without them it is the
 *                                  review copy (no CCC, no contact, no TEST or LIVE line)
 *   fromXml(text)                  a draft read from a Form D file; throws an Error in plain words on anything else
 *   snapshot(draft)                the values an amendment is decided on
 *
 * The draft follows the SEC schema's own element names, in the schema's order. Every value is text unless marked:
 *   submissionType                 'D' | 'D/A'
 *   primaryIssuer                  an issuer:
 *     cik, issuerAddress { street1, street2, city, stateOrCountry, zipCode }, issuerPhoneNumber,
 *     issuerPreviousNameList { none: true | false, previousName: [text] }, entityType, entityTypeOtherDesc,
 *     yearOfInc { kind: 'withinFiveYears' | 'yetToBeFormed' | 'overFiveYears' | '', value: 'YYYY' }
 *   issuerList [issuer], over100IssuerFlag (true | false)
 *   relatedPersonsList [ { relatedPersonName { firstName, middleName, lastName }, relatedPersonAddress (an address),
 *     relatedPersonRelationshipList [text], relationshipClarification } ], over100PersonsFlag (true | false)
 *   offeringData
 *     industryGroup { industryGroupType, investmentFundInfo: null | { investmentFundType, is40Act: true | false | null } }
 *     issuerSize { revenueRange, aggregateNetAssetValueRange }                        one of the two
 *     federalExemptionsExclusions [code]                                              LISTS.exemption
 *     typeOfFiling { newOrAmendment { isAmendment: true | false, previousAccessionNumber },
 *                    dateOfFirstSale { value: 'YYYY-MM-DD', yetToOccur: true | false } }
 *     durationOfOffering { moreThanOneYear: true | false | null }
 *     typesOfSecuritiesOffered { isEquityType, isDebtType, isOptionToAcquireType, isSecurityToBeAcquiredType,
 *       isPooledInvestmentFundType, isTenantInCommonType, isMineralPropertyType, isOtherType (each true | false),
 *       descriptionOfOtherType }
 *     businessCombinationTransaction { isBusinessCombinationTransaction: true | false | null, clarificationOfResponse }
 *     minimumInvestmentAccepted                                                       whole dollars, as digits
 *     salesCompensationList [ { recipientName, recipientCRDNumber, associatedBDName, associatedBDCRDNumber,
 *       recipientAddress (an address), statesOfSolicitationList { allStates: true | false, state: [code] },
 *       foreignSolicitation: true | false | null } ], over100RecipientFlag (true | false)
 *     offeringSalesAmounts { totalOfferingAmount (digits or 'Indefinite'), totalAmountSold, totalRemaining,
 *       clarificationOfResponse }
 *     investors { hasNonAccreditedInvestors: true | false | null, numberNonAccreditedInvestors,
 *       totalNumberAlreadyInvested }
 *     salesCommissionsFindersFees { salesCommissions { dollarAmount, isEstimate: true | false },
 *       findersFees { dollarAmount, isEstimate }, clarificationOfResponse }
 *     useOfProceeds { grossProceedsUsed { dollarAmount, isEstimate }, clarificationOfResponse }
 *     signatureBlock { authorizedRepresentative: true | false | null,
 *       signature [ { issuerName, signatureName, nameOfSigner, signatureTitle, signatureDate: 'YYYY-MM-DD' } ] }
 * A true | false | null value is null until it has been answered.
 *
 * What the file never carries, because EDGAR fills it from its own records and warns or discards if it is sent:
 * schemaVersion, entityName, jurisdictionOfInc, edgarPreviousNameList, and the state and country descriptions.
 * fromXml reads past them, and past the CCC, the filer contact, the notification addresses, the TEST or LIVE line and
 * the return copy line, which belong to toXml's options and never to a draft.
 */
(function (NS) {
  'use strict';

  const CODES = "AL=ALABAMA|AK=ALASKA|AZ=ARIZONA|AR=ARKANSAS|CA=CALIFORNIA|CO=COLORADO|CT=CONNECTICUT|DE=DELAWARE|DC=DISTRICT OF COLUMBIA|FL=FLORIDA|GA=GEORGIA|HI=HAWAII|ID=IDAHO|IL=ILLINOIS|IN=INDIANA|IA=IOWA|KS=KANSAS|KY=KENTUCKY|LA=LOUISIANA|ME=MAINE|MD=MARYLAND|MA=MASSACHUSETTS|MI=MICHIGAN|MN=MINNESOTA|MS=MISSISSIPPI|MO=MISSOURI|MT=MONTANA|NE=NEBRASKA|NV=NEVADA|NH=NEW HAMPSHIRE|NJ=NEW JERSEY|NM=NEW MEXICO|NY=NEW YORK|NC=NORTH CAROLINA|ND=NORTH DAKOTA|OH=OHIO|OK=OKLAHOMA|OR=OREGON|PA=PENNSYLVANIA|RI=RHODE ISLAND|SC=SOUTH CAROLINA|SD=SOUTH DAKOTA|TN=TENNESSEE|TX=TEXAS|X1=UNITED STATES|UT=UTAH|VT=VERMONT|VA=VIRGINIA|WA=WASHINGTON|WV=WEST VIRGINIA|WI=WISCONSIN|WY=WYOMING|A0=ALBERTA, CANADA|A1=BRITISH COLUMBIA, CANADA|A2=MANITOBA, CANADA|A3=NEW BRUNSWICK, CANADA|A4=NEWFOUNDLAND, CANADA|A5=NOVA SCOTIA, CANADA|A6=ONTARIO, CANADA|A7=PRINCE EDWARD ISLAND, CANADA|A8=QUEBEC, CANADA|A9=SASKATCHEWAN, CANADA|B0=YUKON, CANADA|Z4=CANADA (FEDERAL LEVEL)|B2=AFGHANISTAN|Y6=ALAND ISLANDS|B3=ALBANIA|B4=ALGERIA|B5=AMERICAN SAMOA|B6=ANDORRA|B7=ANGOLA|1A=ANGUILLA|B8=ANTARCTICA|B9=ANTIGUA AND BARBUDA|C1=ARGENTINA|1B=ARMENIA|1C=ARUBA|C3=AUSTRALIA|C4=AUSTRIA|1D=AZERBAIJAN|C5=BAHAMAS|C6=BAHRAIN|C7=BANGLADESH|C8=BARBADOS|1F=BELARUS|C9=BELGIUM|D1=BELIZE|G6=BENIN|D0=BERMUDA|D2=BHUTAN|D3=BOLIVIA|1E=BOSNIA AND HERZEGOVINA|B1=BOTSWANA|D4=BOUVET ISLAND|D5=BRAZIL|D6=BRITISH INDIAN OCEAN TERRITORY|D9=BRUNEI DARUSSALAM|E0=BULGARIA|X2=BURKINA FASO|E2=BURUNDI|E3=CAMBODIA|E4=CAMEROON|E8=CAPE VERDE|E9=CAYMAN ISLANDS|F0=CENTRAL AFRICAN REPUBLIC|F2=CHAD|F3=CHILE|F4=CHINA|F6=CHRISTMAS ISLAND|F7=COCOS (KEELING) ISLANDS|F8=COLOMBIA|F9=COMOROS|G0=CONGO|Y3=CONGO, THE DEMOCRATIC REPUBLIC OF THE|G1=COOK ISLANDS|G2=COSTA RICA|L7=COTE D'IVOIRE|1M=CROATIA|G3=CUBA|G4=CYPRUS|2N=CZECH REPUBLIC|G7=DENMARK|1G=DJIBOUTI|G9=DOMINICA|G8=DOMINICAN REPUBLIC|H1=ECUADOR|H2=EGYPT|H3=EL SALVADOR|H4=EQUATORIAL GUINEA|1J=ERITREA|1H=ESTONIA|H5=ETHIOPIA|H7=FALKLAND ISLANDS (MALVINAS)|H6=FAROE ISLANDS|H8=FIJI|H9=FINLAND|I0=FRANCE|I3=FRENCH GUIANA|I4=FRENCH POLYNESIA|2C=FRENCH SOUTHERN TERRITORIES|I5=GABON|I6=GAMBIA|2Q=GEORGIA (COUNTRY)|2M=GERMANY|J0=GHANA|J1=GIBRALTAR|J3=GREECE|J4=GREENLAND|J5=GRENADA|J6=GUADELOUPE|GU=GUAM|J8=GUATEMALA|Y7=GUERNSEY|J9=GUINEA|S0=GUINEA-BISSAU|K0=GUYANA|K1=HAITI|K4=HEARD ISLAND AND MCDONALD ISLANDS|X4=HOLY SEE (VATICAN CITY STATE)|K2=HONDURAS|K3=HONG KONG|K5=HUNGARY|K6=ICELAND|K7=INDIA|K8=INDONESIA|K9=IRAN, ISLAMIC REPUBLIC OF|L0=IRAQ|L2=IRELAND|Y8=ISLE OF MAN|L3=ISRAEL|L6=ITALY|L8=JAMAICA|M0=JAPAN|Y9=JERSEY|M2=JORDAN|1P=KAZAKSTAN|M3=KENYA|J2=KIRIBATI|M4=KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF|M5=KOREA, REPUBLIC OF|M6=KUWAIT|1N=KYRGYZSTAN|M7=LAO PEOPLE'S DEMOCRATIC REPUBLIC|1R=LATVIA|M8=LEBANON|M9=LESOTHO|N0=LIBERIA|N1=LIBYAN ARAB JAMAHIRIYA|N2=LIECHTENSTEIN|1Q=LITHUANIA|N4=LUXEMBOURG|N5=MACAU|1U=MACEDONIA, THE FORMER YUGOSLAV REPUBLIC OF|N6=MADAGASCAR|N7=MALAWI|N8=MALAYSIA|N9=MALDIVES|O0=MALI|O1=MALTA|1T=MARSHALL ISLANDS|O2=MARTINIQUE|O3=MAURITANIA|O4=MAURITIUS|2P=MAYOTTE|O5=MEXICO|1K=MICRONESIA, FEDERATED STATES OF|1S=MOLDOVA, REPUBLIC OF|O9=MONACO|P0=MONGOLIA|Z5=MONTENEGRO|P1=MONTSERRAT|P2=MOROCCO|P3=MOZAMBIQUE|E1=MYANMAR|T6=NAMIBIA|P5=NAURU|P6=NEPAL|P7=NETHERLANDS|P8=NETHERLANDS ANTILLES|1W=NEW CALEDONIA|Q2=NEW ZEALAND|Q3=NICARAGUA|Q4=NIGER|Q5=NIGERIA|Q6=NIUE|Q7=NORFOLK ISLAND|1V=NORTHERN MARIANA ISLANDS|Q8=NORWAY|P4=OMAN|R0=PAKISTAN|1Y=PALAU|1X=PALESTINIAN TERRITORY, OCCUPIED|R1=PANAMA|R2=PAPUA NEW GUINEA|R4=PARAGUAY|R5=PERU|R6=PHILIPPINES|R8=PITCAIRN|R9=POLAND|S1=PORTUGAL|PR=PUERTO RICO|S3=QATAR|S4=REUNION|S5=ROMANIA|1Z=RUSSIAN FEDERATION|S6=RWANDA|Z0=SAINT BARTHELEMY|U8=SAINT HELENA|U7=SAINT KITTS AND NEVIS|U9=SAINT LUCIA|Z1=SAINT MARTIN|V0=SAINT PIERRE AND MIQUELON|V1=SAINT VINCENT AND THE GRENADINES|Y0=SAMOA|S8=SAN MARINO|S9=SAO TOME AND PRINCIPE|T0=SAUDI ARABIA|T1=SENEGAL|Z2=SERBIA|T2=SEYCHELLES|T8=SIERRA LEONE|U0=SINGAPORE|2B=SLOVAKIA|2A=SLOVENIA|D7=SOLOMON ISLANDS|U1=SOMALIA|T3=SOUTH AFRICA|1L=SOUTH GEORGIA AND THE SOUTH SANDWICH ISLANDS|U3=SPAIN|F1=SRI LANKA|V2=SUDAN|V3=SURINAME|L9=SVALBARD AND JAN MAYEN|V6=SWAZILAND|V7=SWEDEN|V8=SWITZERLAND|V9=SYRIAN ARAB REPUBLIC|F5=TAIWAN|2D=TAJIKISTAN|W0=TANZANIA, UNITED REPUBLIC OF|W1=THAILAND|Z3=TIMOR-LESTE|W2=TOGO|W3=TOKELAU|W4=TONGA|W5=TRINIDAD AND TOBAGO|W6=TUNISIA|W8=TURKEY|2E=TURKMENISTAN|W7=TURKS AND CAICOS ISLANDS|2G=TUVALU|W9=UGANDA|2H=UKRAINE|C0=UNITED ARAB EMIRATES|X0=UNITED KINGDOM|2J=UNITED STATES MINOR OUTLYING ISLANDS|X3=URUGUAY|2K=UZBEKISTAN|2L=VANUATU|X5=VENEZUELA|Q1=VIET NAM|D8=VIRGIN ISLANDS, BRITISH|VI=VIRGIN ISLANDS, U.S.|X8=WALLIS AND FUTUNA|U5=WESTERN SAHARA|T7=YEMEN|Y4=ZAMBIA|Y5=ZIMBABWE|XX=UNKNOWN";
  const stateOrCountryName = {};
  CODES.split('|').forEach((x) => {
    const i = x.indexOf('=');
    stateOrCountryName[x.slice(0, i)] = x.slice(i + 1);
  });
  const LISTS = {
    entityType: ['Corporation', 'Limited Partnership', 'Limited Liability Company', 'General Partnership', 'Business Trust', 'Other'],
    relationship: ['Executive Officer', 'Director', 'Promoter'],
    exemption: ['04', '04.1', '04.2', '04.3', '05', '06', '06b', '06c', '46', '4a5', '3C', '3C.1', '3C.2', '3C.3', '3C.4', '3C.5', '3C.6', '3C.7', '3C.9', '3C.10', '3C.11', '3C.12', '3C.13', '3C.14'],
    industryGroup: [
      'Agriculture',
      'Commercial Banking', 'Insurance', 'Investing', 'Investment Banking', 'Pooled Investment Fund', 'Other Banking and Financial Services',
      'Business Services',
      'Coal Mining', 'Electric Utilities', 'Energy Conservation', 'Environmental Services', 'Oil and Gas', 'Other Energy',
      'Biotechnology', 'Health Insurance', 'Hospitals and Physicians', 'Pharmaceuticals', 'Other Health Care',
      'Manufacturing',
      'Commercial', 'Construction', 'REITS and Finance', 'Residential', 'Other Real Estate',
      'Retailing',
      'Restaurants',
      'Computers', 'Telecommunications', 'Other Technology',
      'Airlines and Airports', 'Lodging and Conventions', 'Tourism and Travel Services', 'Other Travel',
      'Other'
    ],
    investmentFund: ['Hedge Fund', 'Private Equity Fund', 'Venture Capital Fund', 'Other Investment Fund'],
    revenueRange: ['No Revenues', '$1 - $1,000,000', '$1,000,001 - $5,000,000', '$5,000,001 - $25,000,000', '$25,000,001 - $100,000,000', 'Over $100,000,000', 'Decline to Disclose', 'Not Applicable'],
    aggregateNetAssetValueRange: ['No Aggregate Net Asset Value', '$1 - $5,000,000', '$5,000,001 - $25,000,000', '$25,000,001 - $50,000,000', '$50,000,001 - $100,000,000', 'Over $100,000,000', 'Decline to Disclose', 'Not Applicable'],
    stateOrCountry: Object.keys(stateOrCountryName),
    stateOfSolicitation: 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(' '),
    stateOrCountryName
  };

  // ---------------------------------------------------------------------------------------------------------------
  // The rule table: the SEC schema (formDSubmission.xsd.xml, version X0808) written out by hand. The check proves it
  // against the schema itself: on every generated fault it gives the verdict xmllint gives.
  // ---------------------------------------------------------------------------------------------------------------
  const DIGITS = /^\p{Nd}+$/u; // the schema's \d is any decimal digit; the plain 0 to 9 rule is EDGAR's, below
  const TYPES = {
    street: { min: 1, max: 40 },
    city: { min: 1, max: 30 },
    zip: { min: 1, max: 10, re: /^[0-9A-Za-z #-]*$/, say: 'may hold only letters, digits, spaces, # and -' },
    phone: { min: 1, max: 20 },
    name150: { min: 1, max: 150 },
    name200: { min: 1, max: 200 },
    text255: { max: 255 },
    text50: { max: 50 },
    sigName: { min: 1, max: 30 },
    sigTitle: { min: 1, max: 60 },
    contactName: { min: 1, max: 30 },
    cik: { min: 1, max: 10, re: /^[0-9]+$/, say: 'must be 1 to 10 digits' },
    ccc: { len: 8, say: 'must be exactly 8 characters' },
    version: { len: 5, say: 'must be exactly 5 characters' },
    money: { int: true, say: 'must be a whole number from 0 to 999,999,999,999' },
    amount: { max: 12, test: (v) => v === 'Indefinite' || DIGITS.test(v), say: 'must be a whole number of dollars of up to 12 digits, or Indefinite' },
    crd: { max: 9, test: (v) => v === 'None' || DIGITS.test(v), say: 'must be a number of up to 9 digits, or None' },
    accession: { re: /^([0-9]{1,10}-[0-9]{1,2}-[0-9]{1,6})?$/, say: 'must look like 0001234567-26-000123' },
    date: { date: true, say: 'must be a date' },
    year: { test: (v) => Array.from(v).length === 4 && v.charAt(0) === '2' && DIGITS.test(v), say: 'must be a four-digit year from 2000 on' },
    email: { min: 1, re: /^([a-zA-Z0-9_\-.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([a-zA-Z0-9-]+\.)+))([a-zA-Z]{2,7}|[0-9]{1,3})(\]?)$/, say: 'is not an email address the SEC accepts' },
    bool: { in: ['true', 'false'] },
    yes: { in: ['true'] },
    subType: { in: ['D', 'D/A'] },
    liveTest: { in: ['LIVE', 'TEST'] },
    none: { in: ['None'] },
    allStates: { in: ['All States'] }
  };
  ['entityType', 'relationship', 'exemption', 'industryGroup', 'investmentFund', 'revenueRange', 'aggregateNetAssetValueRange', 'stateOrCountry', 'stateOfSolicitation'].forEach((k) => (TYPES[k] = { in: LISTS[k] }));

  const MANY = Infinity;
  const FLAGS = ['isEquityType', 'isDebtType', 'isOptionToAcquireType', 'isSecurityToBeAcquiredType', 'isPooledInvestmentFundType', 'isTenantInCommonType', 'isMineralPropertyType', 'isOtherType'];
  const YEAR_KINDS = ['withinFiveYears', 'yetToBeFormed', 'overFiveYears'];
  // each element: [name, type ('@x' is the group x below), fewest, most]; one: exactly one of these; most: not two of these
  const MODEL = {
    edgarSubmission: { seq: [['schemaVersion', 'version', 0, 1], ['submissionType', 'subType', 1, 1], ['testOrLive', 'liveTest', 0, 1], ['returnCopy', 'bool', 0, 1], ['contactData', '@contact', 0, 1], ['notificationAddressList', '@notify', 0, 1], ['primaryIssuer', '@issuer', 1, 1], ['issuerList', '@issuers', 0, 1], ['relatedPersonsList', '@persons', 1, 1], ['offeringData', '@offering', 1, 1]] },
    contact: { seq: [['contactName', 'contactName', 1, 1], ['contactPhoneNumber', 'phone', 1, 1], ['contactEmailAddress', 'email', 1, 1]] },
    notify: { seq: [['notificationEmailAddress', 'email', 0, 3]] },
    issuer: { seq: [['cik', 'cik', 1, 1], ['ccc', 'ccc', 0, 1], ['entityName', 'name150', 0, 1], ['issuerAddress', '@address', 1, 1], ['issuerPhoneNumber', 'phone', 1, 1], ['jurisdictionOfInc', 'text50', 0, 1], ['issuerPreviousNameList', '@names', 0, 1], ['edgarPreviousNameList', '@names', 0, 1], ['entityType', 'entityType', 1, 1], ['entityTypeOtherDesc', 'text255', 0, 1], ['yearOfInc', '@year', 1, 1]] },
    address: { seq: [['street1', 'street', 1, 1], ['street2', 'street', 0, 1], ['city', 'city', 1, 1], ['stateOrCountry', 'stateOrCountry', 1, 1], ['stateOrCountryDescription', 'text50', 0, 1], ['zipCode', 'zip', 1, 1]] },
    names: { seq: [['value', 'none', 0, 1], ['previousName', 'name150', 0, 3]], most: [['value', 'previousName']] },
    year: { seq: [['withinFiveYears', 'yes', 0, 1], ['yetToBeFormed', 'yes', 0, 1], ['overFiveYears', 'yes', 0, 1], ['value', 'year', 0, 1]], one: [YEAR_KINDS] },
    issuers: { seq: [['issuer', '@issuer', 1, 99], ['over100IssuerFlag', 'yes', 0, 1]] },
    persons: { seq: [['relatedPersonInfo', '@person', 1, 100], ['over100PersonsFlag', 'yes', 0, 1]] },
    person: { seq: [['relatedPersonName', '@personName', 1, 1], ['relatedPersonAddress', '@address', 1, 1], ['relatedPersonRelationshipList', '@relationships', 1, 1], ['relationshipClarification', 'text255', 0, 1]] },
    personName: { seq: [['firstName', 'name150', 1, 1], ['middleName', 'name150', 0, 1], ['lastName', 'name200', 1, 1]] },
    relationships: { seq: [['relationship', 'relationship', 1, 3]] },
    offering: { seq: [['industryGroup', '@industry', 1, 1], ['issuerSize', '@size', 1, 1], ['federalExemptionsExclusions', '@exemptions', 1, 1], ['typeOfFiling', '@filing', 1, 1], ['durationOfOffering', '@duration', 1, 1], ['typesOfSecuritiesOffered', '@securities', 1, 1], ['businessCombinationTransaction', '@combination', 1, 1], ['minimumInvestmentAccepted', 'money', 1, 1], ['salesCompensationList', '@recipients', 1, 1], ['offeringSalesAmounts', '@amounts', 1, 1], ['investors', '@investors', 1, 1], ['salesCommissionsFindersFees', '@fees', 1, 1], ['useOfProceeds', '@proceeds', 1, 1], ['signatureBlock', '@signatures', 1, 1]] },
    industry: { seq: [['industryGroupType', 'industryGroup', 1, 1], ['investmentFundInfo', '@fund', 0, 1]] },
    fund: { seq: [['investmentFundType', 'investmentFund', 1, 1], ['is40Act', 'bool', 1, 1]] },
    size: { seq: [['revenueRange', 'revenueRange', 0, 1], ['aggregateNetAssetValueRange', 'aggregateNetAssetValueRange', 0, 1]], one: [['revenueRange', 'aggregateNetAssetValueRange']] },
    exemptions: { seq: [['item', 'exemption', 1, 21]] },
    filing: { seq: [['newOrAmendment', '@amendment', 1, 1], ['dateOfFirstSale', '@firstSale', 1, 1]] },
    amendment: { seq: [['isAmendment', 'bool', 1, 1], ['previousAccessionNumber', 'accession', 0, 1]] },
    firstSale: { seq: [['value', 'date', 0, 1], ['yetToOccur', 'yes', 0, 1]], one: [['value', 'yetToOccur']] },
    duration: { seq: [['moreThanOneYear', 'bool', 1, 1]] },
    securities: { seq: FLAGS.map((f) => [f, 'yes', 0, 1]).concat([['descriptionOfOtherType', 'text255', 0, 1]]) },
    combination: { seq: [['isBusinessCombinationTransaction', 'bool', 1, 1], ['clarificationOfResponse', 'text255', 0, 1]] },
    recipients: { seq: [['recipient', '@recipient', 0, 100], ['over100RecipientFlag', 'yes', 0, 1]] },
    recipient: { seq: [['recipientName', 'name200', 1, 1], ['recipientCRDNumber', 'crd', 1, 1], ['associatedBDName', 'name200', 1, 1], ['associatedBDCRDNumber', 'crd', 1, 1], ['recipientAddress', '@address', 1, 1], ['statesOfSolicitationList', '@states', 1, 1], ['foreignSolicitation', 'bool', 0, 1]] },
    states: { seq: [['state', 'stateOfSolicitation', 0, MANY], ['description', 'text50', 0, MANY], ['value', 'allStates', 0, 1]], most: [['state', 'value']] },
    amounts: { seq: [['totalOfferingAmount', 'amount', 1, 1], ['totalAmountSold', 'money', 1, 1], ['totalRemaining', 'amount', 1, 1], ['clarificationOfResponse', 'text255', 0, 1]] },
    investors: { seq: [['hasNonAccreditedInvestors', 'bool', 1, 1], ['numberNonAccreditedInvestors', 'money', 0, 1], ['totalNumberAlreadyInvested', 'money', 1, 1]] },
    fees: { seq: [['salesCommissions', '@estimate', 1, 1], ['findersFees', '@estimate', 1, 1], ['clarificationOfResponse', 'text255', 0, 1]] },
    estimate: { seq: [['dollarAmount', 'money', 1, 1], ['isEstimate', 'yes', 0, 1]] },
    proceeds: { seq: [['grossProceedsUsed', '@estimate', 1, 1], ['clarificationOfResponse', 'text255', 0, 1]] },
    signatures: { seq: [['authorizedRepresentative', 'bool', 0, 1], ['signature', '@signature', 1, 101]] },
    signature: { seq: [['issuerName', 'name150', 1, 1], ['signatureName', 'sigName', 1, 1], ['nameOfSigner', 'name150', 1, 1], ['signatureTitle', 'sigTitle', 1, 1], ['signatureDate', 'date', 1, 1]] }
  };
  const entry = (group, name) => MODEL[group].seq.filter((e) => e[0] === name)[0] || null;

  // line breaks and control characters (U+0000 to U+001F, U+007F, U+0085, U+2028, U+2029), and what XML cannot carry
  // (half of a surrogate pair, U+FFFE, U+FFFF); built from numbers so this file stays plain ASCII
  const BREAKS = new RegExp('[\\x00-\\x1f\\x7f\\x85' + String.fromCharCode(0x2028, 0x2029) + ']+', 'g');
  const ODD = new RegExp('[\\ud800-\\udfff' + String.fromCharCode(0xfffe, 0xffff) + ']');
  /** One value as the file carries it: text, line breaks and control characters as single spaces, no outer spaces. */
  function clean(v) {
    let s = v == null ? '' : String(v);
    s = s.replace(BREAKS, ' ');
    if (ODD.test(s)) s = Array.from(s).filter((ch) => !(ch.length === 1 && ODD.test(ch))).join('');
    return s.trim();
  }
  const size = (v) => Array.from(v).length;
  function isDate(v) {
    const m = /^-?(\d{4,})-(\d\d)-(\d\d)(Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)?$/.exec(v);
    if (!m || /^0+$/.test(m[1]) || (m[1].length > 4 && m[1].charAt(0) === '0')) return false;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return mo >= 1 && mo <= 12 && d >= 1 && d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  }
  /** Why a value breaks its type: 'missing', 'long', 'choice', 'form', or '' when it does not. */
  function wrong(type, v) {
    const T = TYPES[type];
    if (T.in) return T.in.indexOf(v) >= 0 ? '' : v === '' ? 'missing' : 'choice';
    const n = size(v);
    if (n === 0 && (T.min || T.len || T.int || T.date || T.test)) return 'missing';
    if (T.len != null && n !== T.len) return 'form';
    if (T.max != null && n > T.max) return 'long';
    if (T.re && !T.re.test(v)) return n === 0 ? 'missing' : 'form';
    if (T.test && !T.test(v)) return 'form';
    if (T.int) {
      const m = /^([+-]?)0*([0-9]*)$/.exec(v);
      if (!m || !/[0-9]$/.test(v)) return 'form';
      if (m[2].length > 12 || (m[1] === '-' && m[2] !== '')) return 'form';
    }
    if (T.date && !isDate(v)) return 'form';
    return '';
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The draft
  // ---------------------------------------------------------------------------------------------------------------
  const ROWS = {
    address: () => ({ street1: '', street2: '', city: '', stateOrCountry: '', zipCode: '' }),
    issuer: () => ({ cik: '', issuerAddress: ROWS.address(), issuerPhoneNumber: '', issuerPreviousNameList: { none: false, previousName: [] }, entityType: '', entityTypeOtherDesc: '', yearOfInc: { kind: '', value: '' } }),
    person: () => ({ relatedPersonName: { firstName: '', middleName: '', lastName: '' }, relatedPersonAddress: ROWS.address(), relatedPersonRelationshipList: [], relationshipClarification: '' }),
    fund: () => ({ investmentFundType: '', is40Act: null }),
    recipient: () => ({ recipientName: '', recipientCRDNumber: '', associatedBDName: '', associatedBDCRDNumber: '', recipientAddress: ROWS.address(), statesOfSolicitationList: { allStates: false, state: [] }, foreignSolicitation: null }),
    signature: () => ({ issuerName: '', signatureName: '', nameOfSigner: '', signatureTitle: '', signatureDate: '' })
  };
  function blank(kind) {
    if (kind) {
      if (!ROWS[kind]) throw new Error(`Form D has no row called ${kind}.`);
      return ROWS[kind]();
    }
    const securities = {};
    FLAGS.forEach((f) => (securities[f] = false));
    securities.descriptionOfOtherType = '';
    return {
      submissionType: 'D',
      primaryIssuer: ROWS.issuer(),
      issuerList: [],
      over100IssuerFlag: false,
      relatedPersonsList: [],
      over100PersonsFlag: false,
      offeringData: {
        industryGroup: { industryGroupType: '', investmentFundInfo: null },
        issuerSize: { revenueRange: '', aggregateNetAssetValueRange: '' },
        federalExemptionsExclusions: [],
        typeOfFiling: { newOrAmendment: { isAmendment: false, previousAccessionNumber: '' }, dateOfFirstSale: { value: '', yetToOccur: false } },
        durationOfOffering: { moreThanOneYear: null },
        typesOfSecuritiesOffered: securities,
        businessCombinationTransaction: { isBusinessCombinationTransaction: null, clarificationOfResponse: '' },
        minimumInvestmentAccepted: '',
        salesCompensationList: [],
        over100RecipientFlag: false,
        offeringSalesAmounts: { totalOfferingAmount: '', totalAmountSold: '', totalRemaining: '', clarificationOfResponse: '' },
        investors: { hasNonAccreditedInvestors: null, numberNonAccreditedInvestors: '', totalNumberAlreadyInvested: '' },
        salesCommissionsFindersFees: { salesCommissions: { dollarAmount: '', isEstimate: false }, findersFees: { dollarAmount: '', isEstimate: false }, clarificationOfResponse: '' },
        useOfProceeds: { grossProceedsUsed: { dollarAmount: '', isEstimate: false }, clarificationOfResponse: '' },
        signatureBlock: { authorizedRepresentative: false, signature: [] }
      }
    };
  }
  const list = (v) => (Array.isArray(v) ? v : []);
  /** v laid over the shape of base: every key of base, in base's order, and nothing else. Lists are taken as given. */
  function over(base, v) {
    if (Array.isArray(base)) return Array.isArray(v) ? v.slice() : base;
    if (base && typeof base === 'object') {
      const out = {};
      Object.keys(base).forEach((k) => (out[k] = over(base[k], v && typeof v === 'object' ? v[k] : undefined)));
      return out;
    }
    return v === undefined ? base : v;
  }
  /** A draft in the full shape, whatever was stored: missing parts blank, keys in the schema's order. */
  function shape(d) {
    d = d && typeof d === 'object' ? d : {};
    const n = over(blank(), d);
    n.issuerList = list(d.issuerList).map((i) => over(ROWS.issuer(), i));
    n.relatedPersonsList = list(d.relatedPersonsList).map((p) => over(ROWS.person(), p));
    const o = d.offeringData && typeof d.offeringData === 'object' ? d.offeringData : {};
    const fund = o.industryGroup && o.industryGroup.investmentFundInfo;
    n.offeringData.industryGroup.investmentFundInfo = fund && typeof fund === 'object' ? over(ROWS.fund(), fund) : null;
    n.offeringData.salesCompensationList = list(o.salesCompensationList).map((r) => over(ROWS.recipient(), r));
    n.offeringData.signatureBlock.signature = list(o.signatureBlock && o.signatureBlock.signature).map((s) => over(ROWS.signature(), s));
    return n;
  }
  const issuersOf = (d) => [d.primaryIssuer].concat(d.issuerList);
  /** Is this a filer contact with anything in it? { name, phone, email, notify: [up to three email addresses] } */
  const hasContact = (c) => !!c && typeof c === 'object' && (clean(c.name) !== '' || clean(c.phone) !== '' || clean(c.email) !== '');

  // ---------------------------------------------------------------------------------------------------------------
  // Draft to the file's elements, in the schema's order. Each element is { n: name, v: text } or { n, c: [elements] },
  // with f (the draft field it came from), and item and who for the messages.
  // ---------------------------------------------------------------------------------------------------------------
  function elements(d, o) {
    o = o || {};
    const E = (n, c, f, more) => Object.assign({ n, c: c.filter(Boolean), f }, more);
    const V = (n, v, f, more) => Object.assign({ n, v: clean(v), f, raw: v }, more);
    const O = (n, v, f) => (clean(v) === '' ? null : V(n, v, f));
    const B = (n, v, f) => V(n, v === true ? 'true' : v === false ? 'false' : v, f);
    const Y = (n, v, f) => (v === true || v === 'true' ? V(n, 'true', f) : v == null || v === false || v === 'false' || clean(v) === '' ? null : V(n, v, f));
    const address = (n, a, f, more) => E(n, [V('street1', a.street1, `${f}.street1`), O('street2', a.street2, `${f}.street2`), V('city', a.city, `${f}.city`), V('stateOrCountry', a.stateOrCountry, `${f}.stateOrCountry`), V('zipCode', a.zipCode, `${f}.zipCode`)], f, more);
    const cccOf = (i, first) => clean(typeof o.ccc === 'string' ? (first ? o.ccc : '') : o.ccc && typeof o.ccc === 'object' ? o.ccc[clean(i.cik)] : '');
    const issuer = (n, i, f, first, more) => {
      const names = list(i.issuerPreviousNameList.previousName).filter((x) => clean(x) !== '');
      const kind = YEAR_KINDS.indexOf(i.yearOfInc.kind) >= 0 ? i.yearOfInc.kind : '';
      const ccc = cccOf(i, first);
      return E(
        n,
        [
          V('cik', i.cik, `${f}.cik`),
          ccc ? V('ccc', ccc, 'ccc', { item: 'filer' }) : null,
          address('issuerAddress', i.issuerAddress, `${f}.issuerAddress`, { item: 2 }),
          V('issuerPhoneNumber', i.issuerPhoneNumber, `${f}.issuerPhoneNumber`, { item: 2 }),
          names.length ? E('issuerPreviousNameList', names.map((x, k) => V('previousName', x, `${f}.issuerPreviousNameList.previousName[${k}]`)), `${f}.issuerPreviousNameList`) : i.issuerPreviousNameList.none === true ? E('issuerPreviousNameList', [V('value', 'None', `${f}.issuerPreviousNameList`)], `${f}.issuerPreviousNameList`) : null,
          V('entityType', i.entityType, `${f}.entityType`),
          O('entityTypeOtherDesc', i.entityTypeOtherDesc, `${f}.entityTypeOtherDesc`),
          E('yearOfInc', [kind ? V(kind, 'true', `${f}.yearOfInc.kind`) : null, O('value', i.yearOfInc.value, `${f}.yearOfInc.value`)], `${f}.yearOfInc`)
        ],
        f,
        more
      );
    };
    const estimate = (n, e, f) => E(n, [V('dollarAmount', e.dollarAmount, `${f}.dollarAmount`), Y('isEstimate', e.isEstimate, `${f}.isEstimate`)], f);
    const x = d.offeringData;
    const P = 'offeringData';
    const notify = o.contact && typeof o.contact === 'object' ? list(o.contact.notify).filter((e) => clean(e) !== '') : [];
    const contact = hasContact(o.contact) || notify.length ? o.contact : null;
    const several = x.signatureBlock.signature.length > 1;
    return E(
      'edgarSubmission',
      [
        V('submissionType', d.submissionType, 'submissionType', { item: 'file' }),
        clean(o.mode) ? V('testOrLive', o.mode, 'mode', { item: 'file' }) : null,
        contact ? E('contactData', [V('contactName', contact.name, 'contact.name'), V('contactPhoneNumber', contact.phone, 'contact.phone'), V('contactEmailAddress', contact.email, 'contact.email')], 'contact', { item: 'filer' }) : null,
        notify.length ? E('notificationAddressList', notify.map((e, k) => V('notificationEmailAddress', e, `contact.notify[${k}]`)), 'contact.notify', { item: 'filer' }) : null,
        issuer('primaryIssuer', d.primaryIssuer, 'primaryIssuer', true, { item: 1 }),
        d.issuerList.length || d.over100IssuerFlag === true ? E('issuerList', d.issuerList.map((i, k) => issuer('issuer', i, `issuerList[${k}]`, false, { who: `additional issuer ${k + 1}` })).concat(Y('over100IssuerFlag', d.over100IssuerFlag, 'over100IssuerFlag')), 'issuerList', { item: 1 }) : null,
        E(
          'relatedPersonsList',
          d.relatedPersonsList
            .map((p, k) => {
              const f = `relatedPersonsList[${k}]`;
              return E(
                'relatedPersonInfo',
                [
                  E('relatedPersonName', [V('firstName', p.relatedPersonName.firstName, `${f}.relatedPersonName.firstName`), O('middleName', p.relatedPersonName.middleName, `${f}.relatedPersonName.middleName`), V('lastName', p.relatedPersonName.lastName, `${f}.relatedPersonName.lastName`)], `${f}.relatedPersonName`),
                  address('relatedPersonAddress', p.relatedPersonAddress, `${f}.relatedPersonAddress`),
                  E('relatedPersonRelationshipList', list(p.relatedPersonRelationshipList).map((r, j) => V('relationship', r, `${f}.relatedPersonRelationshipList[${j}]`)), `${f}.relatedPersonRelationshipList`),
                  O('relationshipClarification', p.relationshipClarification, `${f}.relationshipClarification`)
                ],
                f,
                { who: `related person ${k + 1}` }
              );
            })
            .concat(Y('over100PersonsFlag', d.over100PersonsFlag, 'over100PersonsFlag')),
          'relatedPersonsList',
          { item: 3 }
        ),
        E(
          'offeringData',
          [
            E('industryGroup', [V('industryGroupType', x.industryGroup.industryGroupType, `${P}.industryGroup.industryGroupType`), x.industryGroup.investmentFundInfo ? E('investmentFundInfo', [V('investmentFundType', x.industryGroup.investmentFundInfo.investmentFundType, `${P}.industryGroup.investmentFundInfo.investmentFundType`), B('is40Act', x.industryGroup.investmentFundInfo.is40Act, `${P}.industryGroup.investmentFundInfo.is40Act`)], `${P}.industryGroup.investmentFundInfo`) : null], `${P}.industryGroup`, { item: 4 }),
            E('issuerSize', [O('revenueRange', x.issuerSize.revenueRange, `${P}.issuerSize.revenueRange`), O('aggregateNetAssetValueRange', x.issuerSize.aggregateNetAssetValueRange, `${P}.issuerSize.aggregateNetAssetValueRange`)], `${P}.issuerSize`, { item: 5 }),
            E('federalExemptionsExclusions', list(x.federalExemptionsExclusions).map((c, k) => V('item', c, `${P}.federalExemptionsExclusions[${k}]`)), `${P}.federalExemptionsExclusions`, { item: 6 }),
            E('typeOfFiling', [E('newOrAmendment', [B('isAmendment', x.typeOfFiling.newOrAmendment.isAmendment, `${P}.typeOfFiling.newOrAmendment.isAmendment`), O('previousAccessionNumber', x.typeOfFiling.newOrAmendment.previousAccessionNumber, `${P}.typeOfFiling.newOrAmendment.previousAccessionNumber`)], `${P}.typeOfFiling.newOrAmendment`), E('dateOfFirstSale', [O('value', x.typeOfFiling.dateOfFirstSale.value, `${P}.typeOfFiling.dateOfFirstSale.value`), Y('yetToOccur', x.typeOfFiling.dateOfFirstSale.yetToOccur, `${P}.typeOfFiling.dateOfFirstSale.yetToOccur`)], `${P}.typeOfFiling.dateOfFirstSale`)], `${P}.typeOfFiling`, { item: 7 }),
            E('durationOfOffering', [B('moreThanOneYear', x.durationOfOffering.moreThanOneYear, `${P}.durationOfOffering.moreThanOneYear`)], `${P}.durationOfOffering`, { item: 8 }),
            E('typesOfSecuritiesOffered', FLAGS.map((k) => Y(k, x.typesOfSecuritiesOffered[k], `${P}.typesOfSecuritiesOffered.${k}`)).concat(O('descriptionOfOtherType', x.typesOfSecuritiesOffered.descriptionOfOtherType, `${P}.typesOfSecuritiesOffered.descriptionOfOtherType`)), `${P}.typesOfSecuritiesOffered`, { item: 9 }),
            E('businessCombinationTransaction', [B('isBusinessCombinationTransaction', x.businessCombinationTransaction.isBusinessCombinationTransaction, `${P}.businessCombinationTransaction.isBusinessCombinationTransaction`), O('clarificationOfResponse', x.businessCombinationTransaction.clarificationOfResponse, `${P}.businessCombinationTransaction.clarificationOfResponse`)], `${P}.businessCombinationTransaction`, { item: 10 }),
            V('minimumInvestmentAccepted', x.minimumInvestmentAccepted, `${P}.minimumInvestmentAccepted`, { item: 11 }),
            E(
              'salesCompensationList',
              x.salesCompensationList
                .map((r, k) => {
                  const f = `${P}.salesCompensationList[${k}]`;
                  const s = r.statesOfSolicitationList;
                  return E(
                    'recipient',
                    [
                      V('recipientName', r.recipientName, `${f}.recipientName`),
                      V('recipientCRDNumber', r.recipientCRDNumber, `${f}.recipientCRDNumber`),
                      V('associatedBDName', r.associatedBDName, `${f}.associatedBDName`),
                      V('associatedBDCRDNumber', r.associatedBDCRDNumber, `${f}.associatedBDCRDNumber`),
                      address('recipientAddress', r.recipientAddress, `${f}.recipientAddress`),
                      E('statesOfSolicitationList', list(s.state).map((c, j) => V('state', c, `${f}.statesOfSolicitationList.state[${j}]`)).concat(s.allStates === true ? V('value', 'All States', `${f}.statesOfSolicitationList`) : null), `${f}.statesOfSolicitationList`),
                      r.foreignSolicitation == null ? null : B('foreignSolicitation', r.foreignSolicitation, `${f}.foreignSolicitation`)
                    ],
                    f,
                    { who: `recipient ${k + 1}` }
                  );
                })
                .concat(Y('over100RecipientFlag', x.over100RecipientFlag, `${P}.over100RecipientFlag`)),
              `${P}.salesCompensationList`,
              { item: 12 }
            ),
            E('offeringSalesAmounts', [V('totalOfferingAmount', x.offeringSalesAmounts.totalOfferingAmount, `${P}.offeringSalesAmounts.totalOfferingAmount`), V('totalAmountSold', x.offeringSalesAmounts.totalAmountSold, `${P}.offeringSalesAmounts.totalAmountSold`), V('totalRemaining', x.offeringSalesAmounts.totalRemaining, `${P}.offeringSalesAmounts.totalRemaining`), O('clarificationOfResponse', x.offeringSalesAmounts.clarificationOfResponse, `${P}.offeringSalesAmounts.clarificationOfResponse`)], `${P}.offeringSalesAmounts`, { item: 13 }),
            E('investors', [B('hasNonAccreditedInvestors', x.investors.hasNonAccreditedInvestors, `${P}.investors.hasNonAccreditedInvestors`), O('numberNonAccreditedInvestors', x.investors.numberNonAccreditedInvestors, `${P}.investors.numberNonAccreditedInvestors`), V('totalNumberAlreadyInvested', x.investors.totalNumberAlreadyInvested, `${P}.investors.totalNumberAlreadyInvested`)], `${P}.investors`, { item: 14 }),
            E('salesCommissionsFindersFees', [estimate('salesCommissions', x.salesCommissionsFindersFees.salesCommissions, `${P}.salesCommissionsFindersFees.salesCommissions`), estimate('findersFees', x.salesCommissionsFindersFees.findersFees, `${P}.salesCommissionsFindersFees.findersFees`), O('clarificationOfResponse', x.salesCommissionsFindersFees.clarificationOfResponse, `${P}.salesCommissionsFindersFees.clarificationOfResponse`)], `${P}.salesCommissionsFindersFees`, { item: 15 }),
            E('useOfProceeds', [estimate('grossProceedsUsed', x.useOfProceeds.grossProceedsUsed, `${P}.useOfProceeds.grossProceedsUsed`), O('clarificationOfResponse', x.useOfProceeds.clarificationOfResponse, `${P}.useOfProceeds.clarificationOfResponse`)], `${P}.useOfProceeds`, { item: 16 }),
            E(
              'signatureBlock',
              [x.signatureBlock.authorizedRepresentative == null ? null : B('authorizedRepresentative', x.signatureBlock.authorizedRepresentative, `${P}.signatureBlock.authorizedRepresentative`)].concat(
                x.signatureBlock.signature.map((s, k) => {
                  const f = `${P}.signatureBlock.signature[${k}]`;
                  return E('signature', [V('issuerName', s.issuerName, `${f}.issuerName`), V('signatureName', s.signatureName, `${f}.signatureName`), V('nameOfSigner', s.nameOfSigner, `${f}.nameOfSigner`), V('signatureTitle', s.signatureTitle, `${f}.signatureTitle`), V('signatureDate', s.signatureDate, `${f}.signatureDate`)], f, several ? { who: `signature ${k + 1}` } : null);
                })
              ),
              `${P}.signatureBlock`,
              { item: 'signature' }
            )
          ],
          P
        )
      ],
      ''
    );
  }

  // ---------------------------------------------------------------------------------------------------------------
  // toXml
  // ---------------------------------------------------------------------------------------------------------------
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
  const esc = (v) => v.replace(/[&<>"']/g, (ch) => ESC[ch]);
  function toXml(draft, opts) {
    const out = ['<?xml version="1.0"?>'];
    (function write(e, depth) {
      const pad = '    '.repeat(depth);
      if (!e.c) out.push(`${pad}<${e.n}>${esc(e.v)}</${e.n}>`);
      else if (!e.c.length) out.push(`${pad}<${e.n}></${e.n}>`);
      else {
        out.push(`${pad}<${e.n}>`);
        e.c.forEach((c) => write(c, depth + 1));
        out.push(`${pad}</${e.n}>`);
      }
    })(elements(shape(draft), opts), 0);
    return out.join('\n') + '\n';
  }

  // ---------------------------------------------------------------------------------------------------------------
  // fromXml: a reader for this one format. Elements and text only; no document type, no entity beyond the five XML
  // has built in, no attribute but the two the SEC's own samples carry on the root, no instruction to a program.
  // ---------------------------------------------------------------------------------------------------------------
  const no = (why) => new Error(`This is not a Form D file the portal can read: ${why}.`);
  const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const ROOT_ATTRIBUTES = ['xmlns:xsi', 'xsi:noNamespaceSchemaLocation'];
  function decode(s) {
    return s.replace(/&([^;&]*)(;?)/g, (m, name, end) => {
      if (!end) throw no('it has an & that does not start one of the five XML character names');
      if (Object.prototype.hasOwnProperty.call(NAMED, name)) return NAMED[name];
      const num = /^#x([0-9a-fA-F]{1,6})$/.exec(name) || /^#([0-9]{1,7})$/.exec(name);
      const code = num ? parseInt(num[1], name.charAt(1) === 'x' ? 16 : 10) : -1;
      if (code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) return String.fromCodePoint(code);
      throw no(`it uses "&${name.slice(0, 30)};", which is not one of the five XML character names`);
    });
  }
  function parse(text) {
    if (typeof text !== 'string') throw no('it is not text');
    if (text.length > 4000000) throw no('it is far larger than any Form D notice');
    let s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    if (/<!DOCTYPE/i.test(s)) throw no('it has a document type declaration');
    if (/<!ENTITY/i.test(s)) throw no('it declares an entity');
    const decl = /^<\?xml\s[^?]*\?>/.exec(s);
    if (decl) s = s.slice(decl[0].length);
    let i = 0;
    let root = null;
    const stack = [];
    const textTo = (t, raw) => {
      const top = stack[stack.length - 1];
      if (top) top.v += raw ? t : decode(t);
      else if (t.trim() !== '') throw no(root ? 'there is text after the notice' : 'it does not start with a Form D notice');
    };
    while (i < s.length) {
      const lt = s.indexOf('<', i);
      if (lt < 0) {
        textTo(s.slice(i));
        break;
      }
      if (lt > i) textTo(s.slice(i, lt));
      if (s.startsWith('<!--', lt)) {
        const end = s.indexOf('-->', lt + 4);
        if (end < 0) throw no('a comment in it never ends');
        i = end + 3;
      } else if (s.startsWith('<![CDATA[', lt)) {
        const end = s.indexOf(']]>', lt + 9);
        if (end < 0 || !stack.length) throw no('it is cut short or damaged');
        textTo(s.slice(lt + 9, end), true);
        i = end + 3;
      } else if (s.startsWith('<?', lt)) {
        throw no('it carries an instruction to a program (a stylesheet line, for one), which a Form D file must not have');
      } else if (s.startsWith('<!', lt)) {
        throw no('it has a declaration a Form D file does not have');
      } else if (s.startsWith('</', lt)) {
        const m = /^<\/([A-Za-z_][\w.:-]*)\s*>/.exec(s.slice(lt, lt + 200));
        const top = stack.pop();
        if (!m || !top || top.n !== m[1]) throw no(`an element is closed by another name${top ? ` (<${top.n}>)` : ''}`);
        if (top.group && top.v.trim() !== '') throw no(`<${top.n}> holds text where Form D has only elements`);
        if (top.group) delete top.v;
        i = lt + m[0].length;
      } else {
        const m = /^<([A-Za-z_][\w.:-]*)((?:\s+[^<>]*?)?)\s*(\/?)>/.exec(s.slice(lt, lt + 2000));
        if (!m) throw no('it is cut short or damaged');
        const name = m[1];
        const top = stack[stack.length - 1];
        let attrs = m[2];
        if (attrs.trim() !== '') {
          attrs = attrs.replace(/\s*([^\s=]+)\s*=\s*("[^"]*"|'[^']*')/g, (all, a) => {
            if (stack.length || root || ROOT_ATTRIBUTES.indexOf(a) < 0) throw no(`<${name}> carries the attribute ${a.slice(0, 40)}, and a Form D file has none`);
            return '';
          });
          if (attrs.trim() !== '') throw no('it is cut short or damaged');
        }
        let type;
        if (!top) {
          if (root) throw no('there is a second notice after the first');
          if (name !== 'edgarSubmission') throw no(`it starts with <${name.slice(0, 40)}>, and a Form D notice starts with <edgarSubmission>`);
          type = '@edgarSubmission';
        } else {
          const e = top.group ? entry(top.group, name) : null;
          if (!e) throw no(`it has <${name.slice(0, 40)}> inside <${top.n}>, which Form D does not have`);
          type = e[1];
        }
        const node = { n: name, c: [], v: '', group: type.charAt(0) === '@' ? type.slice(1) : '' };
        if (top) top.c.push(node);
        else root = node;
        if (m[3]) {
          if (node.group) delete node.v;
        } else stack.push(node);
        i = lt + m[0].length;
      }
    }
    if (stack.length) throw no('it stops before the notice ends');
    if (!root) throw no('it does not start with a Form D notice');
    return root;
  }
  function fromXml(text) {
    const root = parse(text);
    const all = (e, n) => (e ? e.c.filter((c) => c.n === n) : []);
    const one = (e, n) => {
      const k = all(e, n);
      if (k.length > 1) throw no(`<${n}> appears more than once inside <${e.n}>`);
      return k[0] || null;
    };
    const text1 = (e, n) => {
      const k = one(e, n);
      return k ? clean(k.v) : '';
    };
    const bool = (e, n) => {
      const t = text1(e, n);
      return t === 'true' ? true : t === 'false' ? false : t === '' ? null : t;
    };
    const yes = (e, n) => {
      const t = text1(e, n);
      return t === 'true' ? true : t === '' || t === 'false' ? false : t;
    };
    const address = (e) => (e ? { street1: text1(e, 'street1'), street2: text1(e, 'street2'), city: text1(e, 'city'), stateOrCountry: text1(e, 'stateOrCountry'), zipCode: text1(e, 'zipCode') } : {});
    const issuer = (e) => {
      const names = one(e, 'issuerPreviousNameList');
      const year = one(e, 'yearOfInc');
      const previous = all(names, 'previousName').map((p) => clean(p.v));
      return {
        cik: text1(e, 'cik'),
        issuerAddress: address(one(e, 'issuerAddress')),
        issuerPhoneNumber: text1(e, 'issuerPhoneNumber'),
        issuerPreviousNameList: { none: !previous.length && text1(names, 'value') === 'None', previousName: previous },
        entityType: text1(e, 'entityType'),
        entityTypeOtherDesc: text1(e, 'entityTypeOtherDesc'),
        yearOfInc: { kind: YEAR_KINDS.filter((k) => yes(year, k) === true)[0] || '', value: text1(year, 'value') }
      };
    };
    const estimate = (e) => ({ dollarAmount: text1(e, 'dollarAmount'), isEstimate: yes(e, 'isEstimate') });
    const x = one(root, 'offeringData');
    const industry = one(x, 'industryGroup');
    const fund = one(industry, 'investmentFundInfo');
    const size1 = one(x, 'issuerSize');
    const filing = one(x, 'typeOfFiling');
    const amendment = one(filing, 'newOrAmendment');
    const first = one(filing, 'dateOfFirstSale');
    const securities = one(x, 'typesOfSecuritiesOffered');
    const combination = one(x, 'businessCombinationTransaction');
    const amounts = one(x, 'offeringSalesAmounts');
    const investors = one(x, 'investors');
    const fees = one(x, 'salesCommissionsFindersFees');
    const proceeds = one(x, 'useOfProceeds');
    const block = one(x, 'signatureBlock');
    const types = { descriptionOfOtherType: text1(securities, 'descriptionOfOtherType') };
    FLAGS.forEach((f) => (types[f] = yes(securities, f)));
    const isAmendment = bool(amendment, 'isAmendment');
    return shape({
      submissionType: text1(root, 'submissionType'),
      primaryIssuer: issuer(one(root, 'primaryIssuer') || { n: 'primaryIssuer', c: [] }),
      issuerList: all(one(root, 'issuerList'), 'issuer').map(issuer),
      over100IssuerFlag: yes(one(root, 'issuerList'), 'over100IssuerFlag'),
      relatedPersonsList: all(one(root, 'relatedPersonsList'), 'relatedPersonInfo').map((p) => {
        const name = one(p, 'relatedPersonName');
        return { relatedPersonName: { firstName: text1(name, 'firstName'), middleName: text1(name, 'middleName'), lastName: text1(name, 'lastName') }, relatedPersonAddress: address(one(p, 'relatedPersonAddress')), relatedPersonRelationshipList: all(one(p, 'relatedPersonRelationshipList'), 'relationship').map((r) => clean(r.v)), relationshipClarification: text1(p, 'relationshipClarification') };
      }),
      over100PersonsFlag: yes(one(root, 'relatedPersonsList'), 'over100PersonsFlag'),
      offeringData: {
        industryGroup: { industryGroupType: text1(industry, 'industryGroupType'), investmentFundInfo: fund ? { investmentFundType: text1(fund, 'investmentFundType'), is40Act: bool(fund, 'is40Act') } : null },
        issuerSize: { revenueRange: text1(size1, 'revenueRange'), aggregateNetAssetValueRange: text1(size1, 'aggregateNetAssetValueRange') },
        federalExemptionsExclusions: all(one(x, 'federalExemptionsExclusions'), 'item').map((c) => clean(c.v)),
        typeOfFiling: { newOrAmendment: { isAmendment: isAmendment === null ? false : isAmendment, previousAccessionNumber: text1(amendment, 'previousAccessionNumber') }, dateOfFirstSale: { value: text1(first, 'value'), yetToOccur: yes(first, 'yetToOccur') } },
        durationOfOffering: { moreThanOneYear: bool(one(x, 'durationOfOffering'), 'moreThanOneYear') },
        typesOfSecuritiesOffered: types,
        businessCombinationTransaction: { isBusinessCombinationTransaction: bool(combination, 'isBusinessCombinationTransaction'), clarificationOfResponse: text1(combination, 'clarificationOfResponse') },
        minimumInvestmentAccepted: text1(x, 'minimumInvestmentAccepted'),
        salesCompensationList: all(one(x, 'salesCompensationList'), 'recipient').map((r) => {
          const states = one(r, 'statesOfSolicitationList');
          return { recipientName: text1(r, 'recipientName'), recipientCRDNumber: text1(r, 'recipientCRDNumber'), associatedBDName: text1(r, 'associatedBDName'), associatedBDCRDNumber: text1(r, 'associatedBDCRDNumber'), recipientAddress: address(one(r, 'recipientAddress')), statesOfSolicitationList: { allStates: text1(states, 'value') === 'All States', state: all(states, 'state').map((c) => clean(c.v)) }, foreignSolicitation: bool(r, 'foreignSolicitation') };
        }),
        over100RecipientFlag: yes(one(x, 'salesCompensationList'), 'over100RecipientFlag'),
        offeringSalesAmounts: { totalOfferingAmount: text1(amounts, 'totalOfferingAmount'), totalAmountSold: text1(amounts, 'totalAmountSold'), totalRemaining: text1(amounts, 'totalRemaining'), clarificationOfResponse: text1(amounts, 'clarificationOfResponse') },
        investors: { hasNonAccreditedInvestors: bool(investors, 'hasNonAccreditedInvestors'), numberNonAccreditedInvestors: text1(investors, 'numberNonAccreditedInvestors'), totalNumberAlreadyInvested: text1(investors, 'totalNumberAlreadyInvested') },
        salesCommissionsFindersFees: { salesCommissions: estimate(one(fees, 'salesCommissions')), findersFees: estimate(one(fees, 'findersFees')), clarificationOfResponse: text1(fees, 'clarificationOfResponse') },
        useOfProceeds: { grossProceedsUsed: estimate(one(proceeds, 'grossProceedsUsed')), clarificationOfResponse: text1(proceeds, 'clarificationOfResponse') },
        signatureBlock: { authorizedRepresentative: bool(block, 'authorizedRepresentative'), signature: all(block, 'signature').map((g) => ({ issuerName: text1(g, 'issuerName'), signatureName: text1(g, 'signatureName'), nameOfSigner: text1(g, 'nameOfSigner'), signatureTitle: text1(g, 'signatureTitle'), signatureDate: text1(g, 'signatureDate') })) }
      }
    });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // validate: the schema's rules (the table above, on the very elements toXml writes) and EDGAR's own rules, which the
  // schema does not hold (the SEC's Form D XML Technical Specification, sections 3.3, 5 and 6). Every message is a plain
  // sentence that starts with the item it is about.
  //   item     1 to 16, or 'signature', 'filer' (the CCC and the filer contact) or 'file'
  //   field    the draft field, as in sources and missing of prefill ('primaryIssuer.issuerAddress.city')
  //   level    'error' (EDGAR would suspend the notice) or 'warning' (EDGAR accepts it and says so)
  //   layer    'schema' or 'edgar'
  // opts: today ('YYYY-MM-DD'; the signature date may not be later), submission (true when the file is to be filed),
  // ccc and contact (checked only when the key is passed: the browser never holds a CCC).
  // ---------------------------------------------------------------------------------------------------------------
  const HEAD = { signature: 'Signature', filer: 'Filer', file: 'File' };
  const LABEL = {
    submissionType: 'the form type',
    testOrLive: 'the TEST or LIVE setting',
    contactName: "the contact's name",
    contactPhoneNumber: "the contact's phone number",
    contactEmailAddress: "the contact's email address",
    notificationEmailAddress: 'a notification email address',
    cik: "the issuer's CIK",
    ccc: 'the CCC',
    street1: 'the street address',
    street2: 'the second street line',
    city: 'the city',
    stateOrCountry: 'the state or country',
    zipCode: 'the postal code',
    issuerPhoneNumber: 'the phone number',
    previousName: 'a previous name',
    entityType: 'the entity type',
    entityTypeOtherDesc: 'the description of the entity type',
    'yearOfInc.value': 'the year of formation',
    firstName: 'the first name',
    middleName: 'the middle name',
    lastName: 'the last name',
    relationship: 'a relationship',
    relationshipClarification: 'the clarification',
    industryGroupType: 'the industry group',
    investmentFundType: 'the type of fund',
    is40Act: 'the answer on registration under the Investment Company Act',
    revenueRange: 'the revenue range',
    aggregateNetAssetValueRange: 'the net asset value range',
    item: 'an exemption',
    isAmendment: 'the answer on new notice or amendment',
    previousAccessionNumber: "the previous notice's accession number",
    'dateOfFirstSale.value': 'the date of first sale',
    yetToOccur: 'the yet to occur mark',
    moreThanOneYear: 'the answer on whether the offering lasts more than one year',
    descriptionOfOtherType: 'the description of the other type of security',
    isBusinessCombinationTransaction: 'the answer on a business combination',
    clarificationOfResponse: 'the clarification',
    minimumInvestmentAccepted: 'the minimum investment',
    recipientName: "the recipient's name",
    recipientCRDNumber: "the recipient's CRD number",
    associatedBDName: "the name of the recipient's broker or dealer",
    associatedBDCRDNumber: "the CRD number of the recipient's broker or dealer",
    state: 'a state of solicitation',
    foreignSolicitation: 'the answer on solicitation outside the United States',
    totalOfferingAmount: 'the total offering amount',
    totalAmountSold: 'the total amount sold',
    totalRemaining: 'the total remaining to be sold',
    hasNonAccreditedInvestors: 'the answer on non-accredited investors',
    numberNonAccreditedInvestors: 'the number of non-accredited investors',
    totalNumberAlreadyInvested: 'the total number of investors',
    'salesCommissions.dollarAmount': 'the amount of sales commissions',
    'findersFees.dollarAmount': "the amount of finders' fees",
    'grossProceedsUsed.dollarAmount': 'the amount paid to executive officers, directors and promoters',
    isEstimate: 'the estimate mark',
    authorizedRepresentative: 'the answer on signing for every issuer',
    issuerName: "the issuer's name",
    signatureName: 'the signature',
    nameOfSigner: "the signer's name",
    signatureTitle: "the signer's title",
    signatureDate: 'the date signed'
  };
  const MANY_OF = { relatedPersonInfo: ['related person', 'related persons'], relationship: ['relationship', 'relationships'], item: ['exemption', 'exemptions'], signature: ['signature', 'signatures'], previousName: ['previous name', 'previous names'], recipient: ['recipient', 'recipients'], issuer: ['additional issuer', 'additional issuers'], notificationEmailAddress: ['notification email address', 'notification email addresses'] };
  // [when none is given, when two are]
  const CHOOSE = {
    yearOfInc: ['say when the issuer was formed', 'give one answer on when the issuer was formed'],
    issuerSize: ['choose a revenue range or a net asset value range', 'give a revenue range or a net asset value range, not both'],
    dateOfFirstSale: ['give the date of first sale, or say it has yet to occur', 'give the date of first sale or say it has yet to occur, not both'],
    statesOfSolicitationList: ['', 'choose All States or list the states, not both'],
    issuerPreviousNameList: ['', 'list the previous names or say None, not both']
  };
  const AMOUNTS = [
    [11, 'offeringData.minimumInvestmentAccepted', (x) => x.minimumInvestmentAccepted],
    [13, 'offeringData.offeringSalesAmounts.totalOfferingAmount', (x) => x.offeringSalesAmounts.totalOfferingAmount, true],
    [13, 'offeringData.offeringSalesAmounts.totalAmountSold', (x) => x.offeringSalesAmounts.totalAmountSold],
    [13, 'offeringData.offeringSalesAmounts.totalRemaining', (x) => x.offeringSalesAmounts.totalRemaining, true],
    [14, 'offeringData.investors.numberNonAccreditedInvestors', (x) => x.investors.numberNonAccreditedInvestors],
    [14, 'offeringData.investors.totalNumberAlreadyInvested', (x) => x.investors.totalNumberAlreadyInvested],
    [15, 'offeringData.salesCommissionsFindersFees.salesCommissions.dollarAmount', (x) => x.salesCommissionsFindersFees.salesCommissions.dollarAmount],
    [15, 'offeringData.salesCommissionsFindersFees.findersFees.dollarAmount', (x) => x.salesCommissionsFindersFees.findersFees.dollarAmount],
    [16, 'offeringData.useOfProceeds.grossProceedsUsed.dollarAmount', (x) => x.useOfProceeds.grossProceedsUsed.dollarAmount]
  ];
  const PLAIN = /^[0-9]+$/;
  const PO_BOX = /\bp\.?\s?o\.?\s?box\b|\bpost\s+office\s+box\b|\bpob\s*\d|^box\s+\d/i;
  const CARE_OF = /\bc\/o\b|\bin care of\b/i;
  const RULE_504 = ['04', '04.1', '04.2', '04.3'];
  function localToday() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }
  function validate(draft, opts) {
    opts = opts || {};
    const d = shape(draft);
    const out = [];
    const add = (level, layer, item, field, who, text) => out.push({ item, field, level, layer, message: `${typeof item === 'number' ? `Item ${item}` : HEAD[item] || 'File'}: ${who ? `${who}: ` : ''}${text}.` });

    // the schema's rules, on the elements toXml writes
    (function walk(e, group, up) {
      const here = { item: e.item != null ? e.item : up.item, who: e.who != null ? e.who : up.who };
      const model = MODEL[group];
      const count = {};
      e.c.forEach((c) => (count[c.n] = (count[c.n] || 0) + 1));
      const fail = (text, field) => add('error', 'schema', here.item, field || e.f, here.who, text);
      model.seq.forEach((s) => {
        const n = count[s[0]] || 0;
        const words = MANY_OF[s[0]];
        if (n < s[2]) fail(words ? `add at least one ${words[0]}` : `${LABEL[s[0]] || 'a required part'} is missing`);
        if (n > s[3]) fail(words ? `there are ${n} ${words[1]}, and the form takes at most ${s[3]}` : `${LABEL[s[0]] || 'a part'} is given more than once`);
      });
      (model.one || []).forEach((names) => {
        const n = names.reduce((a, k) => a + (count[k] || 0), 0);
        if (n !== 1) fail((CHOOSE[e.n] || ['choose one', 'choose only one'])[n ? 1 : 0]);
      });
      (model.most || []).forEach((names) => {
        if (names.filter((k) => count[k]).length > 1) fail((CHOOSE[e.n] || ['', 'choose only one'])[1]);
      });
      e.c.forEach((c) => {
        const type = entry(group, c.n)[1];
        if (type.charAt(0) === '@') return walk(c, type.slice(1), here);
        const why = wrong(type, c.v);
        if (!why) return undefined;
        const at = { item: c.item != null ? c.item : here.item, who: here.who };
        const label = LABEL[`${e.n}.${c.n}`] || LABEL[c.n] || 'a value';
        const T = TYPES[type];
        const text = why === 'missing' ? `${label} is missing` : why === 'long' ? `${label} is longer than ${T.max} characters` : why === 'choice' ? `${label} is not one of the form's choices` : `${label} ${T.say || 'is not in the form the SEC accepts'}`;
        add('error', 'schema', at.item, c.f, at.who, text);
        if (why === 'missing' && typeof c.raw === 'string' && c.raw !== '') add('error', 'edgar', at.item, c.f, at.who, `${label} holds only spaces`);
        return undefined;
      });
    })(elements(d, opts), 'edgarSubmission', { item: 'file', who: '' });

    // EDGAR's own rules
    const E = (item, field, text, who) => add('error', 'edgar', item, field, who || '', text);
    const W = (item, field, text, who) => add('warning', 'edgar', item, field, who || '', text);
    const x = d.offeringData;
    const P = 'offeringData';
    const codes = list(x.federalExemptionsExclusions).map(clean);
    const claims = (c) => codes.indexOf(c) >= 0;
    issuersOf(d).forEach((i, k) => {
      const f = k ? `issuerList[${k - 1}]` : 'primaryIssuer';
      const who = k ? `additional issuer ${k}` : '';
      ['street1', 'street2'].forEach((s) => {
        const line = clean(i.issuerAddress[s]);
        if (PO_BOX.test(line)) E(2, `${f}.issuerAddress.${s}`, 'a P.O. box cannot be the principal place of business; give the street address', who);
        else if (CARE_OF.test(line)) W(2, `${f}.issuerAddress.${s}`, 'the principal place of business should be the issuer\'s own street address, not an "in care of" address', who);
      });
      if (i.yearOfInc.kind === 'withinFiveYears' && clean(i.yearOfInc.value) === '') E(1, `${f}.yearOfInc.value`, 'give the year the issuer was formed, because it was formed within the last five years', who);
      if (clean(i.entityType) === 'Other' && clean(i.entityTypeOtherDesc) === '') E(1, `${f}.entityTypeOtherDesc`, 'describe the entity type, because Other was chosen', who);
      if (i.issuerPreviousNameList.none !== true && !list(i.issuerPreviousNameList.previousName).some((n) => clean(n) !== '')) E(1, `${f}.issuerPreviousNameList`, "list the issuer's previous names of the last five years, or say None", who);
    });
    if (d.over100IssuerFlag === true && d.issuerList.length < 99) E(1, 'over100IssuerFlag', 'the more-than-100 mark needs 100 issuers listed');
    if (d.over100PersonsFlag === true && d.relatedPersonsList.length < 100) E(3, 'over100PersonsFlag', 'the more-than-100 mark needs 100 related persons listed');
    if (x.over100RecipientFlag === true && x.salesCompensationList.length < 100) E(12, `${P}.over100RecipientFlag`, 'the more-than-100 mark needs 100 recipients listed');

    const fund = x.industryGroup.investmentFundInfo;
    const fundType = fund ? clean(fund.investmentFundType) : '';
    if (clean(x.industryGroup.industryGroupType) === 'Pooled Investment Fund' && !fund) E(4, `${P}.industryGroup.investmentFundInfo.investmentFundType`, 'a pooled investment fund must say which type of fund it is');
    const revenue = clean(x.issuerSize.revenueRange);
    const nav = clean(x.issuerSize.aggregateNetAssetValueRange);
    if ((revenue === '') !== (nav === '')) {
      const byNav = fundType === 'Hedge Fund' || fundType === 'Other Investment Fund';
      if (byNav && nav === '') E(5, `${P}.issuerSize.aggregateNetAssetValueRange`, 'a hedge fund or other investment fund gives its aggregate net asset value range, not a revenue range');
      if (!byNav && revenue === '') E(5, `${P}.issuerSize.revenueRange`, 'give the revenue range; only a hedge fund or other investment fund gives a net asset value range instead');
    }
    if (claims('06b') && claims('06c')) E(6, `${P}.federalExemptionsExclusions`, 'Rule 506(b) and Rule 506(c) cannot both be claimed in one notice');
    const pooled = x.typesOfSecuritiesOffered.isPooledInvestmentFundType === true;
    if (codes.some((c) => c === '3C' || c.indexOf('3C.') === 0) && !pooled) W(6, `${P}.federalExemptionsExclusions`, 'an Investment Company Act Section 3(c) exclusion is claimed, but pooled investment fund interests are not among the types of securities in Item 9');

    const type = clean(d.submissionType);
    const amendment = x.typeOfFiling.newOrAmendment;
    const accession = clean(amendment.previousAccessionNumber);
    if (type === 'D' && (amendment.isAmendment === true || accession !== '')) E(7, `${P}.typeOfFiling.newOrAmendment.previousAccessionNumber`, 'a new notice is not marked as an amendment and carries no previous accession number');
    if (type === 'D/A' && amendment.isAmendment !== true) E(7, `${P}.typeOfFiling.newOrAmendment.isAmendment`, 'an amendment must be marked as an amendment');
    if (type === 'D/A' && accession === '') E(7, `${P}.typeOfFiling.newOrAmendment.previousAccessionNumber`, 'an amendment must give the accession number of the notice it amends');

    if (!FLAGS.some((k) => x.typesOfSecuritiesOffered[k] === true)) E(9, `${P}.typesOfSecuritiesOffered`, 'choose at least one type of security');
    if (x.typesOfSecuritiesOffered.isOtherType === true && clean(x.typesOfSecuritiesOffered.descriptionOfOtherType) === '') E(9, `${P}.typesOfSecuritiesOffered.descriptionOfOtherType`, 'describe the other type of security, because Other was chosen');

    x.salesCompensationList.forEach((r, k) => {
      const parts = [r.recipientName, r.recipientCRDNumber, r.associatedBDName, r.associatedBDCRDNumber, r.recipientAddress.street1, r.recipientAddress.city, r.recipientAddress.stateOrCountry, r.recipientAddress.zipCode];
      const empty = parts.filter((p) => clean(p) === '').length;
      if (empty) E(12, `${P}.salesCompensationList[${k}]`, `every part of a recipient must be filled in except the second street line (${empty} missing; write None where there is no CRD number or no broker or dealer)`, `recipient ${k + 1}`);
    });

    const total = clean(x.offeringSalesAmounts.totalOfferingAmount);
    const sold = clean(x.offeringSalesAmounts.totalAmountSold);
    const remaining = clean(x.offeringSalesAmounts.totalRemaining);
    AMOUNTS.forEach((a) => {
      const v = clean(a[2](x));
      if (v !== '' && !PLAIN.test(v) && !(a[3] && v === 'Indefinite') && wrong(a[3] ? 'amount' : 'money', v) === '') E(a[0], a[1], 'amounts and counts are whole numbers written with the digits 0 to 9 only');
    });
    if (total === 'Indefinite' && remaining !== '' && remaining !== 'Indefinite') E(13, `${P}.offeringSalesAmounts.totalRemaining`, 'when the total offering amount is Indefinite, the total remaining is Indefinite too');
    if (PLAIN.test(total) && PLAIN.test(sold) && remaining !== '') {
      const left = Number(total) - Number(sold);
      if (left < 0) E(13, `${P}.offeringSalesAmounts.totalAmountSold`, 'the total amount sold is more than the total offering amount');
      else if (!PLAIN.test(remaining) || Number(remaining) !== left) E(13, `${P}.offeringSalesAmounts.totalRemaining`, `the total remaining must be the total offering amount minus the total amount sold, which is ${left}`);
    }
    if (PLAIN.test(total) && Number(total) === 0) W(13, `${P}.offeringSalesAmounts.totalOfferingAmount`, 'the total offering amount is $0');
    if (RULE_504.some(claims) && PLAIN.test(total) && Number(total) > 10000000) W(6, `${P}.federalExemptionsExclusions`, 'Rule 504 permits no more than $10,000,000 of securities in a 12-month period');
    const non = clean(x.investors.numberNonAccreditedInvestors);
    if (claims('06b') && PLAIN.test(non) && Number(non) > 35) W(14, `${P}.investors.numberNonAccreditedInvestors`, 'no more than 35 non-accredited investors are permitted in a Rule 506(b) offering');

    const today = clean(opts.today) || localToday();
    const signatures = x.signatureBlock.signature;
    signatures.forEach((s, k) => {
      const date = clean(s.signatureDate);
      if (/^\d{4}-\d\d-\d\d$/.test(date) && date > today) E('signature', `${P}.signatureBlock.signature[${k}].signatureDate`, 'the date signed is in the future', signatures.length > 1 ? `signature ${k + 1}` : '');
    });
    const issuers = issuersOf(d).length;
    if (signatures.length && issuers > 1 && signatures.length !== (x.signatureBlock.authorizedRepresentative === true ? 1 : issuers)) W('signature', `${P}.signatureBlock.signature`, x.signatureBlock.authorizedRepresentative === true ? 'when one person signs for every issuer, the notice carries one signature' : `the notice names ${issuers} issuers and carries ${signatures.length} ${signatures.length === 1 ? 'signature' : 'signatures'}; each issuer signs unless one person signs for all`);

    if (opts.submission) {
      if ('contact' in opts) {
        if (!hasContact(opts.contact)) E('filer', 'contact', 'the filer contact is missing, and a notice sent without one is suspended');
        else if (size(clean(opts.contact.email)) > 80) E('filer', 'contact.email', "the contact's email address is longer than 80 characters");
      }
      if ('ccc' in opts) {
        issuersOf(d).forEach((i, k) => {
          const ccc = clean(typeof opts.ccc === 'string' ? (k ? '' : opts.ccc) : opts.ccc && typeof opts.ccc === 'object' ? opts.ccc[clean(i.cik)] : '');
          if (ccc === '') E('filer', 'ccc', k ? 'this issuer needs its own CCC' : "the issuer's CCC is missing", k ? `additional issuer ${k}` : '');
        });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // prefill: a first draft from what the portal holds. offering is the offering record; facts is NS.filings.facts(ws,
  // offering) and rec is NS.filings.rec(ws, offeringId), passed in (this file never reads the workspace). Every value
  // is a suggestion the sponsor confirms. sources says where each filled field came from ('offering', 'investors' or
  // 'record'); missing lists the fields the portal would fill but holds nothing for. Any field in neither is one the
  // portal does not hold at all (industry group, related persons, fees), which the sponsor enters.
  // ---------------------------------------------------------------------------------------------------------------
  function prefill(offering, facts, rec) {
    facts = facts || {};
    rec = rec || {};
    const code = facts.regime === '506b' ? '06b' : facts.regime === '506c' ? '06c' : '';
    if (!code) return null;
    const d = blank();
    const sources = {};
    const missing = [];
    const setAt = (path, value) => {
      const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
      let o = d;
      keys.slice(0, -1).forEach((k) => (o = o[k]));
      o[keys[keys.length - 1]] = value;
    };
    /** Fill a field, or list it as missing when there is no value (optional: say nothing). */
    const put = (path, value, source, optional) => {
      const none = value == null || (typeof value === 'string' && clean(value) === '');
      if (none) {
        if (!optional) missing.push(path);
        return;
      }
      setAt(path, typeof value === 'string' ? clean(value) : value);
      sources[path] = source;
    };
    const whole = (n) => (typeof n === 'number' && isFinite(n) && n >= 0 ? String(Math.round(n)) : typeof n === 'string' && PLAIN.test(clean(n)) ? clean(n) : '');
    const P = 'offeringData';
    put(`${P}.federalExemptionsExclusions`, [code], 'offering');

    // amounts are whole US dollars; an offering in another currency is left for the sponsor's own dollar figures
    const usd = facts.usd !== false;
    const total = !usd ? '' : facts.total === 'Indefinite' ? 'Indefinite' : whole(facts.total);
    const sold = usd ? whole(facts.sold) : '';
    put(`${P}.minimumInvestmentAccepted`, usd ? whole(facts.minimum) : '', 'offering');
    put(`${P}.offeringSalesAmounts.totalOfferingAmount`, total, 'offering');
    put(`${P}.offeringSalesAmounts.totalAmountSold`, sold, 'investors');
    put(`${P}.offeringSalesAmounts.totalRemaining`, total === 'Indefinite' ? 'Indefinite' : total !== '' && sold !== '' && Number(total) >= Number(sold) ? String(Number(total) - Number(sold)) : '', 'offering');
    put(`${P}.investors.totalNumberAlreadyInvested`, whole(facts.investors), 'investors');
    const non = facts.nonAccredited ? whole(facts.nonAccredited.count) : '';
    if (code === '06c') put(`${P}.investors.hasNonAccreditedInvestors`, false, 'offering');
    else {
      put(`${P}.investors.numberNonAccreditedInvestors`, non, 'investors');
      put(`${P}.investors.hasNonAccreditedInvestors`, non !== '' && Number(non) > 0 ? true : null, 'investors');
    }
    if (rec.firstSale) put(`${P}.typeOfFiling.dateOfFirstSale.value`, rec.firstSale, 'record');
    else if (facts.firstSale) put(`${P}.typeOfFiling.dateOfFirstSale.value`, facts.firstSale, 'investors');
    else if (facts.investors === 0) put(`${P}.typeOfFiling.dateOfFirstSale.yetToOccur`, true, 'investors');
    else missing.push(`${P}.typeOfFiling.dateOfFirstSale.value`);

    const i = rec.issuer || {};
    const edgar = rec.edgar || {};
    put('primaryIssuer.cik', edgar.cik, 'record');
    put('primaryIssuer.issuerAddress.street1', i.street1, 'record');
    put('primaryIssuer.issuerAddress.street2', i.street2, 'record', true);
    put('primaryIssuer.issuerAddress.city', i.city, 'record');
    put('primaryIssuer.issuerAddress.stateOrCountry', i.state, 'record');
    put('primaryIssuer.issuerAddress.zipCode', i.zip, 'record');
    put('primaryIssuer.issuerPhoneNumber', i.phone, 'record');
    put('primaryIssuer.entityType', i.entityType, 'record');
    put('primaryIssuer.entityTypeOtherDesc', i.entityTypeOther, 'record', clean(i.entityType) !== 'Other');
    const kind = YEAR_KINDS.indexOf(i.yearKind) >= 0 ? i.yearKind : '';
    put('primaryIssuer.yearOfInc.kind', kind, 'record');
    put('primaryIssuer.yearOfInc.value', i.yearFormed == null ? '' : String(i.yearFormed), 'record', kind !== 'withinFiveYears');
    const names = Array.isArray(i.previousNames) ? i.previousNames.map(clean).filter(Boolean) : typeof i.previousNames === 'string' && !/^none$/i.test(clean(i.previousNames)) ? i.previousNames.split(/[\n;]+/).map(clean).filter(Boolean) : [];
    if (names.length) put('primaryIssuer.issuerPreviousNameList.previousName', names, 'record');
    else if (i.previousNames != null) put('primaryIssuer.issuerPreviousNameList.none', true, 'record');
    else missing.push('primaryIssuer.issuerPreviousNameList');

    // the signature block names the issuer exactly as EDGAR's record of the CIK does, or the notice is suspended
    d.offeringData.signatureBlock.signature.push(ROWS.signature());
    const G = `${P}.signatureBlock.signature[0]`;
    put(`${G}.issuerName`, edgar.name, 'record');
    put(`${G}.signatureName`, i.signerName, 'record');
    put(`${G}.nameOfSigner`, i.signerName, 'record');
    put(`${G}.signatureTitle`, i.signerTitle, 'record');
    return { draft: d, sources, missing };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // snapshot: the values that decide whether a filed notice needs an amendment. The amounts are numbers (the total may
  // be the word Indefinite; null when blank), the related persons are names only, and material is one stable text of
  // everything else whose change calls for an amendment: who the issuer is and where its principal place of business
  // is, the industry group, the exemptions, the duration, the types of securities, the business combination answer and
  // who receives sales compensation. It leaves out what the Form D instructions say needs no amendment on its own:
  // related persons' addresses and relationships, the issuer's size, the addresses and states in Item 12, the amount
  // sold and remaining, and the total number of investors.
  // ---------------------------------------------------------------------------------------------------------------
  function snapshot(draft) {
    const d = shape(draft);
    const x = d.offeringData;
    const number = (v) => (PLAIN.test(clean(v)) ? Number(clean(v)) : null);
    const low = (v) => clean(v).replace(/\s+/g, ' ').toLowerCase();
    const total = clean(x.offeringSalesAmounts.totalOfferingAmount);
    const fund = x.industryGroup.investmentFundInfo;
    const material = {
      issuers: issuersOf(d).map((i) => [low(i.cik), low(i.entityType), low(i.entityTypeOtherDesc), i.yearOfInc.kind, low(i.yearOfInc.value), list(i.issuerPreviousNameList.previousName).map(low).filter(Boolean).sort(), [low(i.issuerAddress.street1), low(i.issuerAddress.street2), low(i.issuerAddress.city), low(i.issuerAddress.stateOrCountry), low(i.issuerAddress.zipCode), low(i.issuerPhoneNumber)]]),
      industry: [low(x.industryGroup.industryGroupType), fund ? low(fund.investmentFundType) : '', fund ? fund.is40Act === true : false],
      exemptions: list(x.federalExemptionsExclusions).map(clean).sort(),
      moreThanOneYear: x.durationOfOffering.moreThanOneYear,
      securities: FLAGS.filter((k) => x.typesOfSecuritiesOffered[k] === true).concat(low(x.typesOfSecuritiesOffered.descriptionOfOtherType)),
      businessCombination: x.businessCombinationTransaction.isBusinessCombinationTransaction,
      recipients: x.salesCompensationList.map((r) => [low(r.recipientName), low(r.recipientCRDNumber), low(r.associatedBDName), low(r.associatedBDCRDNumber)].join('|')).sort()
    };
    return {
      minimumInvestment: number(x.minimumInvestmentAccepted),
      totalOffering: total === 'Indefinite' ? 'Indefinite' : number(total),
      nonAccredited: number(x.investors.numberNonAccreditedInvestors) || 0,
      commissions: number(x.salesCommissionsFindersFees.salesCommissions.dollarAmount),
      findersFees: number(x.salesCommissionsFindersFees.findersFees.dollarAmount),
      proceedsToInsiders: number(x.useOfProceeds.grossProceedsUsed.dollarAmount),
      relatedPersons: d.relatedPersonsList.map((p) => [low(p.relatedPersonName.firstName), low(p.relatedPersonName.middleName), low(p.relatedPersonName.lastName)].join('|')).sort(),
      material: JSON.stringify(material)
    };
  }

  const API = { LISTS, blank, prefill, validate, toXml, fromXml, snapshot };
  if (NS) NS.formD = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
