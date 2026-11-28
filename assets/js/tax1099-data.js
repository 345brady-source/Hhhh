/*
 * Forms 1099-INT's (plan 10-09) and 1099-DIV's (plan 10-11) data, data only: the rules of the IRS's upload file for each
 * form, column by column, and the map of each official form's Copy B.
 *
 * Form 1099-DIV's columns (69, A to BQ) are typed in the same way from "1099-DIV Template Formatting Guidelines" (IRS,
 * March 6, 2025), from the same zip file, read on 2026-11-26: A to AL are Form 1099-INT's (same names and rules), then
 * the boxes from AM (box 1a) to BD (box 13), the combined filing column BE and the two states BF to BQ. The same three
 * points are unconfirmed for it (header text, cents, tax year 2026's columns).
 *
 * IRIS: the columns of the IRS's comma-separated template for Form 1099-INT on its IRIS site (the Taxpayer Portal), in
 * the IRS's order, A to BN, typed from "1099-INT Template Formatting Guidelines" (IRS, March 6, 2025), one of the files
 * in https://www.irs.gov/pub/irs-efile/ty2025-template-formatting-guidelines.zip (updated January 14, 2026), read on
 * 2026-11-19. Every rule NS.tax1099.iris.validate applies is in this table with its source; the module holds no rule of
 * its own. An asterisk in the IRS's list marks a required field; it is recorded as `required` here and is not part of
 * a name.
 *   Not confirmed (research assumptions A3, A4, A5), until the IRS's own template is in hand (plan 10-13):
 *     - the exact text of the template's header row (headerPinned stays false; the names below are the IRS's field
 *       names as printed in the guidelines);
 *     - whether amounts carry cents (the guidelines' examples show 847 and 1500.00; amounts are written with two
 *       decimals here; centsConfirmed stays false);
 *     - that tax year 2026's columns equal tax year 2025's (taxYearOfRules '2025').
 *   Column entry: { col, name, required, requiredIf: [ { col, equals } | { col, filled: true } ], max, pattern (the whole
 *   cell), patternBy: { col, patterns: { [that column's value or '*']: pattern } }, values, trim (no leading, trailing or
 *   doubled spaces), notSame: [cols], needsOneOf: [cols], rule (the IRS's words, shortened), source }.
 *
 * MAPS: the official Forms 1099-INT and 1099-DIV (each Rev. January 2024), pinned by SHA-256 (also in assets/forms/1099/SHA256SUMS), in
 * the shape NS.taxforms.fill takes. fields and unused together name every field of the Copy B page exactly as the file
 * names them (checks/tax-forms.js reads the file's own field list and compares both ways). pages: the Copy B page and
 * the recipient's instructions (Form 1099-INT: page 5 and their continuation on page 7; Form 1099-DIV: page 5), the pages
 * of the recipient's copy.
 *
 * Works on plain data only and needs nothing when it loads (module.exports under Node).
 */
(function (NS) {
  'use strict';

  const SRC_OF = (form) => (c) => `${form} Template Formatting Guidelines (IRS, March 6, 2025), column ${c}`;
  const SRC = SRC_OF('1099-INT');
  const STATE_SRC = 'Two-letter abbreviations of the states, the District of Columbia, the territories and the military post offices (the USPS list the guidelines link to: irs.gov/pub/irs-utl/zip_code_and_state_abbreviations.pdf, not itself read)';
  const STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'AS', 'GU', 'MP', 'PR', 'VI', 'FM', 'MH', 'PW', 'AA', 'AE', 'AP'];
  const STATE_RE = `^(${STATES.join('|')})$`;

  // the character rules the guidelines repeat for each kind of column
  const BIZ1 = { max: 40, pattern: "^[A-Za-z0-9 #()&'-]*$", trim: true, rule: "Max 40 characters; letters, numbers, spaces, hyphen, pound, parentheses, ampersand and apostrophe only; no leading, trailing or adjacent spaces" };
  const BIZ2 = { max: 40, pattern: "^[A-Za-z0-9 #()&'/%-]*$", trim: true, rule: "Max 40 characters; letters, numbers, spaces, hyphen, pound, parentheses, ampersand, apostrophe, slash and percent only; no leading, trailing or adjacent spaces" };
  const PERSON = { max: 20, pattern: '^[A-Za-z -]*$', trim: true, rule: 'Max 20 characters; letters, spaces and hyphens only; no leading, trailing or adjacent spaces' };
  const ADDRESS = { max: 35, pattern: '^[A-Za-z0-9 /-]*$', trim: true, rule: 'Max 35 characters; letters, numbers, hyphen, slash and space only; no leading, trailing or adjacent spaces' };
  const CITY = { max: 40, pattern: '^[A-Za-z ]*$', trim: true, rule: 'Max 40 characters; letters and spaces only; no leading, trailing or adjacent spaces' };
  const COUNTRY = { pattern: '^[A-Z]{2}$', rule: 'The IRS country abbreviation (two capital letters; the IRS list at irs.gov/e-file-providers/foreign-country-code-listing-for-modernized-e-file is not embedded here)' };
  const AMOUNT = { pattern: '^\\d{1,15}(\\.\\d{1,2})?$', rule: 'From $0 to $999,999,999,999,999; not negative; digits only except one decimal point, with no more than two digits after it (no scientific notation)' };
  const SPECIAL = { max: 60, pattern: "^[A-Za-z0-9 !\"#$%&'()*+,\\-./:;<>=?@{|}~£§ÁÉÍÑÓ×ÚÜáéíñóúü]*$", trim: true, rule: 'Max 60 characters; letters, numbers and the listed special characters; no leading or trailing spaces and never more than one space in a row' };
  const STATE_DOMESTIC = { rule:'Domestic: the two-letter abbreviation. Foreign: max 17 characters, A-Z, 0-9 and spaces only, no leading, trailing or adjacent spaces' };
  const ZIP_RULE = 'Domestic: exactly 5, 9 or 12 digits, digits only. Foreign: max 9 characters, A-Z and 0-9 only';
  const SSN_RE = '^\\d{3}-\\d{2}-\\d{4}$';
  const EIN_RE = '^\\d{2}-\\d{7}$';
  const c = (col, name, more) => Object.assign({ col, name, required: false, source: SRC(col) }, more);
  const box = (col, name) => c(col, name, AMOUNT);
  /** The same column, its source moved to another form's guidelines (the payer, recipient and account columns A to AL). */
  const asForm = (form, x) => {
    const S = SRC_OF(form);
    const out = Object.assign({}, x, { source: x.source.replace(SRC(x.col), S(x.col)) });
    if (x.col === 'A') out.values = [form];
    return out;
  };

  const columns = [
    c('A', 'Form Type', { required: true, values: ['1099-INT'], rule: 'The form type of this template', source: SRC('A') + ' (example value; the template is for one form type)' }),
    c('B', 'Tax Year', { required: true, pattern: '^\\d{4}$', rule: 'The tax year, four digits', source: SRC('B') + ' (example value)' }),
    c('C', 'Payer TIN Type', { required: true, values: ['SSN', 'EIN'], rule: 'Must be entered as "SSN" or "EIN"' }),
    c('D', 'Payer Taxpayer ID Number', { required: true, patternBy: { col: 'C', patterns: { SSN: SSN_RE, EIN: EIN_RE } }, rule: 'Digits and dashes only; an EIN as XX-XXXXXXX, an SSN as XXX-XX-XXXX' }),
    c('E', 'Payer Name Type', { required: true, values: ['B', 'I'], rule: 'Must be entered as "B" for Business Name or "I" for Individual' }),
    c('F', 'Payer Business or Entity Name Line 1', Object.assign({ requiredIf: [{ col: 'E', equals: 'B' }] }, BIZ1, { rule: 'Required if Name Type = "B". ' + BIZ1.rule })),
    c('G', 'Payer Business or Entity Name Line 2', BIZ2),
    c('H', 'Payer First Name', Object.assign({ requiredIf: [{ col: 'E', equals: 'I' }, { col: 'J', filled: true }] }, PERSON, { rule: 'Required if Name Type = "I" or the last name is filled out. ' + PERSON.rule })),
    c('I', 'Payer Middle Name', PERSON),
    c('J', 'Payer Last Name (Surname)', Object.assign({ requiredIf: [{ col: 'E', equals: 'I' }, { col: 'H', filled: true }] }, PERSON, { rule: 'Required if Name Type = "I" or the first name is filled out. ' + PERSON.rule })),
    c('K', 'Payer Suffix', PERSON),
    c('L', 'Payer Country', Object.assign({ required: true }, COUNTRY)),
    c('M', 'Payer Address Line 1', Object.assign({ required: true }, ADDRESS)),
    c('N', 'Payer Address Line 2', ADDRESS),
    c('O', 'Payer City/Town', Object.assign({ required: true }, CITY)),
    c('P', 'Payer State/Province/Territory', Object.assign({}, STATE_DOMESTIC, { required: true, trim: true, patternBy: { col: 'L', patterns: { US: STATE_RE, '*': '^[A-Z0-9 ]{1,17}$' } }, source: SRC('P') + '; ' + STATE_SRC })),
    c('Q', 'Payer ZIP/Postal Code', { required: true, patternBy: { col: 'L', patterns: { US: '^(\\d{5}|\\d{9}|\\d{12})$', '*': '^[A-Z0-9]{1,9}$' } }, rule: ZIP_RULE }),
    c('R', 'Payer Phone Type', { values: ['D', 'I'], rule: 'Must be entered as "D" for Domestic or "I" for International' }),
    c('S', 'Payer Phone', { patternBy: { col: 'R', patterns: { D: '^(\\d{10}|\\d{3}-\\d{3}-\\d{4}|\\(\\d{3}\\) \\d{3}-\\d{4})$', I: '^\\+?\\d{1,15}$' } }, rule: 'Domestic: 1231231234, 123-123-1234 or (123) 123-1234. International: 15 digits or less, a "+" only at the beginning (the portal writes no "+": see the formula rule)' }),
    c('T', 'Recipient TIN Type', { requiredIf: [{ col: 'U', filled: true }], values: ['SSN', 'EIN', 'ATIN', 'ITIN', 'QI-EIN', 'UND'], rule: 'Required if the Taxpayer ID Number is entered; "SSN", "EIN", "ATIN", "ITIN", "QI-EIN" or "UND"' }),
    c('U', 'Recipient Taxpayer ID Number', { patternBy: { col: 'T', patterns: { SSN: SSN_RE, ITIN: SSN_RE, ATIN: SSN_RE, EIN: EIN_RE, 'QI-EIN': EIN_RE, UND: '^\\d{9}$' } }, rule: 'An EIN or QI-EIN as XX-XXXXXXX; an SSN, ITIN or ATIN as XXX-XX-XXXX; UND as XXXXXXXXX' }),
    c('V', 'Recipient Name Type', { required: true, values: ['B', 'I'], rule: 'Must be entered as "B" for Business Name or "I" for Individual' }),
    c('W', 'Recipient Business or Entity Name Line 1', Object.assign({ requiredIf: [{ col: 'V', equals: 'B' }] }, BIZ1, { rule: 'Required if Name Type = "B". ' + BIZ1.rule })),
    c('X', 'Recipient Business or Entity Name Line 2', BIZ2),
    c('Y', 'Recipient First Name', Object.assign({ requiredIf: [{ col: 'V', equals: 'I' }, { col: 'AA', filled: true }] }, PERSON, { rule: 'Required if Name Type = "I" or the last name is filled out. ' + PERSON.rule })),
    c('Z', 'Recipient Middle Name', PERSON),
    c('AA', 'Recipient Last Name (Surname)', Object.assign({ requiredIf: [{ col: 'V', equals: 'I' }, { col: 'Y', filled: true }] }, PERSON, { rule: 'Required if Name Type = "I" or the first name is filled out. ' + PERSON.rule })),
    c('AB', 'Recipient Suffix', PERSON),
    c('AC', 'Recipient Country', Object.assign({ required: true }, COUNTRY)),
    c('AD', 'Recipient Address Line 1', Object.assign({ required: true }, ADDRESS)),
    c('AE', 'Recipient Address Line 2', ADDRESS),
    c('AF', 'Recipient City/Town', Object.assign({ required: true }, CITY)),
    c('AG', 'Recipient State/Province/Territory', Object.assign({}, STATE_DOMESTIC, { required: true, trim: true, patternBy: { col: 'AC', patterns: { US: STATE_RE, '*': '^[A-Z0-9 ]{1,17}$' } }, source: SRC('AG') + '; ' + STATE_SRC })),
    c('AH', 'Recipient ZIP/Postal Code', { required: true, patternBy: { col: 'AC', patterns: { US: '^(\\d{5}|\\d{9}|\\d{12})$', '*': '^[A-Z0-9]{1,9}$' } }, rule: ZIP_RULE }),
    c('AI', 'Office Code', { pattern: '^\\d{4}$', rule: 'Exactly 4 digits' }),
    c('AJ', 'Form Account Number', { max: 20, notSame: ['D', 'U'], rule: 'Max 20 characters; not the same as the payer\'s or the recipient\'s taxpayer number' }),
    c('AK', 'FATCA Filing Requirements', { values: ['Y', 'N'], rule: '"Y" for checked or "N" for unchecked' }),
    c('AL', '2nd TIN Notice', { values: ['Y', 'N'], rule: '"Y" for checked or "N" for unchecked' }),
    c('AM', "Payer's RTN", { pattern: '^(0[1-9]|1[0-2]|2[1-9]|3[0-2])\\d{7}$', rule: 'Exactly 9 digits, beginning 01 through 12 or 21 through 32' }),
    box('AN', 'Box 1 - Interest Income'),
    box('AO', 'Box 2 - Early withdrawal penalty'),
    box('AP', 'Box 3 - Interest on U.S. Savings Bonds and Treasury obligations'),
    box('AQ', 'Box 4 - Federal income tax withheld'),
    box('AR', 'Box 5 - Investment expenses'),
    box('AS', 'Box 6 - Foreign tax paid'),
    c('AT', 'Box 7 - Foreign country or U.S. territory', COUNTRY),
    box('AU', 'Box 8 - Tax-exempt interest'),
    box('AV', 'Box 9 - Specified private activity bond interest'),
    box('AW', 'Box 10 - Market discount'),
    box('AX', 'Box 11 - Bond premium'),
    box('AY', 'Box 12 - Bond premium on Treasury obligations'),
    box('AZ', 'Box 13 - Bond premium on tax-exempt bond'),
    c('BA', 'Box 14 - Tax-exempt and tax credit bond CUSIP no.', { pattern: '^[A-Z0-9]{1,9}$', rule: 'Max 9 characters, A-Z and 0-9 only' }),
    c('BB', 'Combined Federal/State Filing (CF/SF)', { pattern: '^"[A-Za-z ,]*"$', rule: 'State abbreviations separated by commas inside quotation marks (the portal never fills it; the file rules refuse its quotation marks)' }),
    c('BC', 'State 1', { requiredIf: [{ col: 'BD', filled: true }, { col: 'BE', filled: true }, { col: 'BF', filled: true }, { col: 'BG', filled: true }, { col: 'BH', filled: true }], needsOneOf: ['BD', 'BF', 'BG'], pattern: STATE_RE, rule: 'Required if a field of State 1 is filled in; the two-letter abbreviation; one or more amounts must be entered if State 1 is selected', source: SRC('BC') + ' and BD; ' + STATE_SRC }),
    box('BD', 'State 1 - State Tax Withheld'),
    c('BE', 'State 1 - State/Payer state number', { pattern: '^[A-Za-z0-9]{1,24}$', rule: 'Max 24 characters; letters and numbers only, no spaces or special characters' }),
    box('BF', 'State 1 - State income'),
    box('BG', 'State 1 - Local income tax withheld'),
    c('BH', 'State 1 - Special Data Entries', SPECIAL),
    c('BI', 'State 2', { requiredIf: [{ col: 'BJ', filled: true }, { col: 'BK', filled: true }, { col: 'BL', filled: true }, { col: 'BM', filled: true }, { col: 'BN', filled: true }], needsOneOf: ['BJ', 'BL', 'BM'], pattern: STATE_RE, rule: 'Required if a field of State 2 is filled in; the two-letter abbreviation; one or more amounts must be entered if State 2 is selected', source: SRC('BI') + ' and BJ; ' + STATE_SRC }),
    box('BJ', 'State 2 - State Tax Withheld'),
    c('BK', 'State 2 - State/Payer state number', { pattern: '^[A-Za-z0-9]{1,24}$', rule: 'Max 24 characters; letters and numbers only, no spaces or special characters' }),
    box('BL', 'State 2 - State income'),
    box('BM', 'State 2 - Local income tax withheld'),
    c('BN', 'State 2 - Special Data Entries', SPECIAL)
  ];

  // Form 1099-DIV: A to AL as Form 1099-INT's, then its own boxes (1099-DIV Template Formatting Guidelines)
  const D = SRC_OF('1099-DIV');
  const d = (col, name, more) => Object.assign({ col, name, required: false, source: D(col) }, more);
  const dbox = (col, name) => d(col, name, AMOUNT);
  const STATE_GROUP = (st, cols, amounts) =>
    d(st, cols.name, { requiredIf: cols.all.map((x) => ({ col: x, filled: true })), needsOneOf: amounts, pattern: STATE_RE, rule: `Required if a field of ${cols.name} is filled in; the two-letter abbreviation; one or more amounts must be entered if ${cols.name} is selected`, source: D(st) + ` and ${amounts[0]}; ` + STATE_SRC });
  const columnsDiv = columns
    .filter((x) => x.col <= 'AL' || x.col.length === 1)
    .map((x) => asForm('1099-DIV', x))
    .concat([
      dbox('AM', 'Box 1a - Total ordinary dividends'),
      dbox('AN', 'Box 1b - Qualified dividends'),
      dbox('AO', 'Box 2a - Total capital gain distribution'),
      dbox('AP', 'Box 2b - Unrecap. Sec. 1250 gain'),
      dbox('AQ', 'Box 2c - Section 1202 gain'),
      dbox('AR', 'Box 2d - Collectibles (28%) gain'),
      dbox('AS', 'Box 2e - Section 897 ordinary dividends'),
      dbox('AT', 'Box 2f - Section 897 capital gain'),
      dbox('AU', 'Box 3 - Nondividend distributions'),
      dbox('AV', 'Box 4 - Federal income tax withheld'),
      dbox('AW', 'Box 5 - Section 199A dividends'),
      dbox('AX', 'Box 6 - Investment expenses'),
      dbox('AY', 'Box 7 - Foreign tax paid'),
      d('AZ', 'Box 8 - Foreign country or U.S. possession', COUNTRY),
      dbox('BA', 'Box 9 - Cash liquidation distributions'),
      dbox('BB', 'Box 10 - Noncash liquidation distributions'),
      dbox('BC', 'Box 12 - Exempt-interest dividends'),
      dbox('BD', 'Box 13 - Specified private activity bond interest dividends'),
      d('BE', 'Combined Federal/State Filing (CF/SF)', { pattern: '^"[A-Za-z ,]*"$', rule: 'State abbreviations separated by commas inside quotation marks (the portal never fills it; the file rules refuse its quotation marks)' }),
      STATE_GROUP('BF', { name: 'State 1', all: ['BG', 'BH', 'BI', 'BJ', 'BK'] }, ['BG', 'BI', 'BJ']),
      dbox('BG', 'State 1 - State Tax Withheld'),
      d('BH', 'State 1 - State/Payer state number', { pattern: '^[A-Za-z0-9]{1,24}$', rule: 'Max 24 characters; letters and numbers only, no spaces or special characters' }),
      dbox('BI', 'State 1 - State income'),
      dbox('BJ', 'State 1 - Local income tax withheld'),
      d('BK', 'State 1 - Special Data Entries', SPECIAL),
      STATE_GROUP('BL', { name: 'State 2', all: ['BM', 'BN', 'BO', 'BP', 'BQ'] }, ['BM', 'BO', 'BP']),
      dbox('BM', 'State 2 - State Tax Withheld'),
      d('BN', 'State 2 - State/Payer state number', { pattern: '^[A-Za-z0-9]{1,24}$', rule: 'Max 24 characters; letters and numbers only, no spaces or special characters' }),
      dbox('BO', 'State 2 - State income'),
      dbox('BP', 'State 2 - Local income tax withheld'),
      d('BQ', 'State 2 - Special Data Entries', SPECIAL)
    ]);

  const IRIS = {
    source: 'IRS, "1099-INT Template Formatting Guidelines" (March 6, 2025), in https://www.irs.gov/pub/irs-efile/ty2025-template-formatting-guidelines.zip (updated January 14, 2026); Publication 5717 (Rev. 9-2026)',
    read: '2026-11-19',
    taxYearOfRules: '2025',
    headerPinned: false,
    centsConfirmed: false,
    maxRows: 100,
    maxRowsSource: 'Publication 5717 (Rev. 9-2026): up to 100 forms per submission (an upload file holds at most 250 records; the stricter number is kept)',
    // Rules for every cell the portal writes, beyond each column's own.
    rules: [
      { id: 'formula', pattern: '^[=+\\-@]', why: 'starts with =, +, - or @, which a spreadsheet would run as a formula', source: 'Threat T-10-28 of plan 10-09. The IRS character rules never allow =, + or @ in a column the portal fills (a "+" only at the start of an international phone number, which the portal writes without it) and allow a hyphen in names and addresses, where no real one starts with it; refused so the file never carries a cell a spreadsheet would run' },
      { id: 'csv', pattern: '[,"\\r\\n]', why: 'holds a comma, a quotation mark or a line break, which would move the cells of the file', source: 'The IRIS template is a comma-separated file (Publication 5717); no column the portal fills allows these characters' },
      { id: 'plain', pattern: '[^\\x20-\\x7E]', why: 'holds a character other than plain letters, digits, spaces and punctuation (an accented letter, for example)', source: 'No column the portal fills allows an accented or other non-plain character (the IRS character rules above)' }
    ],
    states: STATES,
    statesSource: STATE_SRC,
    columns: { '1099-INT': columns, '1099-DIV': columnsDiv },
    // the column of each box the portal fills, per form (NS.tax1099.iris.row writes these and leaves every other box empty)
    boxes: {
      '1099-INT': { 1: 'AN', 4: 'AQ' },
      '1099-DIV': { '1a': 'AM', '1b': 'AN', '2a': 'AO', '2b': 'AP', '2c': 'AQ', '2d': 'AR', '2e': 'AS', '2f': 'AT', 3: 'AU', 4: 'AV', 5: 'AW' }
    },
    sourceOf: {
      '1099-INT': 'IRS, "1099-INT Template Formatting Guidelines" (March 6, 2025), read 2026-11-19',
      '1099-DIV': 'IRS, "1099-DIV Template Formatting Guidelines" (March 6, 2025), in the same zip file, read 2026-11-26'
    }
  };

  const CB = 'topmostSubform[0].CopyB[0].';
  const LEFT = CB + 'LeftColumn[0].';
  const RIGHT = CB + 'RghtColumn[0].';
  // Form 1099-DIV's Copy B names its columns differently (LeftCol, RghtCol, CopyHeader)
  const DCB = 'topmostSubform[0].CopyB[0].';
  const DLEFT = DCB + 'LeftCol[0].';
  const DRIGHT = DCB + 'RghtCol[0].';
  const MAPS = {
    // Form 1099-INT, Rev. January 2024 (continuous use): 7 pages, 129 fields; the Copy B page (page 4) has 31 (29 text,
    // 2 boxes), read from the file's own field list on 2026-11-19 (checks/tax-forms.js reads it again on every run).
    '1099-INT 2024-01 Copy B': {
      form: '1099-INT',
      revision: 'Rev. January 2024',
      copy: 'B',
      file: 'assets/forms/1099/f1099int-2024-01.pdf',
      sha256: 'ee7697c9b29374596fd9645b157b7312d121ae3c2f76bebf68908c3fc2b739e6',
      source: 'https://www.irs.gov/pub/irs-pdf/f1099int.pdf (538,774 bytes), read 2026-11-19',
      pages: [4, 5, 7],
      fields: {
        year: { name: CB + 'CopyBHeader[0].CalendarYear2_1[0]', kind: 'text', max: 4 }, // "For calendar year"
        payerBlock: { name: LEFT + 'f2_1[0]', kind: 'text' }, // payer's name, street address, city, state, ZIP and telephone (several lines)
        payerTin: { name: LEFT + 'f2_2[0]', kind: 'text', max: 11 }, // PAYER'S TIN, never truncated
        recipientTin: { name: LEFT + 'f2_3[0]', kind: 'text', max: 11 }, // RECIPIENT'S TIN, the last four only
        recipientName: { name: LEFT + 'f2_4[0]', kind: 'text' }, // RECIPIENT'S name (line 1 of the W-9)
        recipientStreet: { name: LEFT + 'f2_5[0]', kind: 'text' }, // Street address (including apt. no.)
        recipientCity: { name: LEFT + 'f2_6[0]', kind: 'text' }, // City or town, state or province, country, and ZIP
        box1: { name: RIGHT + 'Box1[0].f2_9[0]', kind: 'text' }, // 1 Interest income
        box4: { name: RIGHT + 'Box4[0].f2_12[0]', kind: 'text' } // 4 Federal income tax withheld
      },
      unused: {
        'Never filled by the portal (D-02; the research table for Form 1099-INT): the payer\'s RTN, the FATCA filing requirement, boxes 2, 3 and 5 to 14 and the state boxes 15 to 17, figures only the CPA can give': [
          RIGHT + 'f2_8[0]',
          LEFT + 'c2_2[0]',
          RIGHT + 'Box2[0].f2_10[0]',
          RIGHT + 'Box3[0].f2_11[0]',
          RIGHT + 'Box5[0].f2_13[0]',
          RIGHT + 'Box6[0].f2_14[0]',
          RIGHT + 'f2_15[0]',
          RIGHT + 'Box8[0].f2_16[0]',
          RIGHT + 'Box9[0].f2_17[0]',
          RIGHT + 'Box10[0].f2_18[0]',
          RIGHT + 'Box11[0].f2_19[0]',
          RIGHT + 'Box12[0].f2_20[0]',
          RIGHT + 'Box13[0].f2_21[0]',
          RIGHT + 'Box14[0].f2_22[0]',
          RIGHT + 'Boxes15_16_17[0].f2_23[0]',
          RIGHT + 'Boxes15_16_17[0].f2_24[0]',
          RIGHT + 'Boxes15_16_17[0].f2_25[0]',
          RIGHT + 'Boxes15_16_17[0].f2_26[0]',
          RIGHT + 'Boxes15_16_17[0].f2_27[0]',
          RIGHT + 'Boxes15_16_17[0].f2_28[0]'
        ],
        'The account number box stays empty (planner\'s choice 4; it is optional when the payer files one form per recipient)': [LEFT + 'f2_7[0]'],
        'CORRECTED (if checked): the portal prepares original forms only; a corrected form is a question for the CPA': [CB + 'CopyBHeader[0].c2_1[0]']
      },
      removeBeforeFlatten: []
    },
    // Form 1099-DIV, Rev. January 2024 (continuous use): 6 pages, 140 fields; the Copy B page (page 4) has 34 (32 text,
    // 2 boxes), read from the file's own field list on 2026-11-26 (checks/tax-forms.js reads it again on every run). The
    // recipient's instructions are page 5 only (the file has no continuation page).
    '1099-DIV 2024-01 Copy B': {
      form: '1099-DIV',
      revision: 'Rev. January 2024',
      copy: 'B',
      file: 'assets/forms/1099/f1099div-2024-01.pdf',
      sha256: '4ea1de804ff1db921753bd6319beeccfe4647299e03d79816e04d852a9cd1435',
      source: 'https://www.irs.gov/pub/irs-pdf/f1099div.pdf (542,425 bytes), read 2026-11-19',
      pages: [4, 5],
      fields: {
        year: { name: DCB + 'CopyHeader[0].CalendarYear[0].f2_1[0]', kind: 'text', max: 4 }, // "For calendar year"
        payerBlock: { name: DLEFT + 'f2_2[0]', kind: 'text' }, // payer's name, street address, city, state, ZIP and telephone
        payerTin: { name: DLEFT + 'f2_3[0]', kind: 'text', max: 11 }, // PAYER'S TIN, never truncated
        recipientTin: { name: DLEFT + 'f2_4[0]', kind: 'text', max: 11 }, // RECIPIENT'S TIN, the last four only
        recipientName: { name: DLEFT + 'f2_5[0]', kind: 'text' }, // RECIPIENT'S name
        recipientStreet: { name: DLEFT + 'f2_6[0]', kind: 'text' }, // Street address (including apt. no.)
        recipientCity: { name: DLEFT + 'f2_7[0]', kind: 'text' }, // City or town, state or province, country, and ZIP
        box1a: { name: DRIGHT + 'f2_9[0]', kind: 'text' }, // 1a Total ordinary dividends
        box1b: { name: DRIGHT + 'f2_10[0]', kind: 'text' }, // 1b Qualified dividends
        box2a: { name: DRIGHT + 'Box2a_ReadOrder[0].f2_11[0]', kind: 'text' }, // 2a Total capital gain distr.
        box2b: { name: DRIGHT + 'f2_12[0]', kind: 'text' }, // 2b Unrecap. Sec. 1250 gain
        box2c: { name: DRIGHT + 'Box2c_ReadOrder[0].f2_13[0]', kind: 'text' }, // 2c Section 1202 gain
        box2d: { name: DRIGHT + 'f2_14[0]', kind: 'text' }, // 2d Collectibles (28%) gain
        box2e: { name: DRIGHT + 'Box2e_ReadOrder[0].f2_15[0]', kind: 'text' }, // 2e Section 897 ordinary dividends
        box2f: { name: DRIGHT + 'f2_16[0]', kind: 'text' }, // 2f Section 897 capital gain
        box3: { name: DRIGHT + 'Box3_ReadOrder[0].f2_17[0]', kind: 'text' }, // 3 Nondividend distributions
        box4: { name: DRIGHT + 'f2_18[0]', kind: 'text' }, // 4 Federal income tax withheld
        box5: { name: DRIGHT + 'Box5_ReadOrder[0].f2_19[0]', kind: 'text' } // 5 Section 199A dividends
      },
      unused: {
        'Never filled by the portal (D-02; the research table for Form 1099-DIV): boxes 6 to 8 (expenses and foreign tax), 9 and 10 (liquidation distributions, sent to the CPA), 11 (FATCA), 12 and 13 (exempt-interest dividends) and the state boxes 14 to 16, figures only the CPA can give': [
          DRIGHT + 'f2_20[0]',
          DRIGHT + 'Box7_ReadOrder[0].f2_21[0]',
          DRIGHT + 'f2_22[0]',
          DRIGHT + 'Box9_ReadOrder[0].f2_23[0]',
          DRIGHT + 'f2_24[0]',
          DRIGHT + 'TagCorrectingSubform[0].c2_3[0]',
          DRIGHT + 'Box12_ReadOrder[0].f2_25[0]',
          DRIGHT + 'f2_26[0]',
          DRIGHT + 'Box14_ReadOrder[0].f2_27[0]',
          DRIGHT + 'Box14_ReadOrder[0].f2_28[0]',
          DRIGHT + 'Box15_ReadOrder[0].f2_29[0]',
          DRIGHT + 'Box15_ReadOrder[0].f2_30[0]',
          DRIGHT + 'f2_31[0]',
          DRIGHT + 'f2_32[0]'
        ],
        'The account number box stays empty (planner\'s choice 4 of plan 10-09; it is optional when the payer files one form per recipient)': [DLEFT + 'f2_8[0]'],
        'CORRECTED (if checked): the portal prepares original forms only; a corrected form is a question for the CPA': [DCB + 'CopyHeader[0].c2_1[0]']
      },
      removeBeforeFlatten: []
    }
  };

  const API = { IRIS, MAPS };
  if (NS) NS.tax1099data = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
