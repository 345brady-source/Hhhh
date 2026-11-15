/*
 * The official tax forms the portal fills (data only).
 *
 * One entry per form revision. Each entry pins the bundled file (its SHA-256, also in assets/forms/SHA256SUMS) and names
 * every fillable field of that file exactly as the file itself names it; no name here is guessed. The names were read
 * from the bundled file's own field list and every run of checks/form-maps.js reads that list again from the file and
 * fails when a name here is missing from it, or a name in it is missing here.
 *
 *   fields   portal key -> { name: the field's full name in the file, kind: 'text' | 'check' | 'comb',
 *            on: the box's on-value (check boxes), max: the field's own length limit when it has one }
 *   groups   a taxpayer number split over the file's comb fields, in printed order (the fill splits the digits by each
 *            field's max)
 *   unused   reason -> [field names the portal never fills]
 *   removeBeforeFlatten   field names taken out of the file before it is flattened (signature fields the writer cannot fill)
 *   overlays places the e-sign step draws on, as fractions of the page: { page (1 = first), x, y (from the top), w, h };
 *            sign, date (fmt when the form asks for one), caption (the "signed electronically" line) and, on the W-9,
 *            strike2: the cross-out of certification item 2, with one stroke per printed line ({ x0, x1, y }).
 *
 * A new revision of a form is a new entry with its own file and pin; an entry is never pointed at a different file.
 */
(function (NS) {
  'use strict';

  /** A place measured in PDF points from the top-left of a page of size pw x ph, as page fractions. */
  function place(pw, ph, page, x, yTop, w, h, extra) {
    const r = { page, x: x / pw, y: yTop / ph, w: w / pw, h: h / ph };
    return Object.assign(r, extra || {});
  }
  /** A stroke from x0 to x1 at height y (points from the top), as page fractions. */
  function stroke(pw, ph, x0, x1, y) {
    return { x0: x0 / pw, x1: x1 / pw, y: y / ph };
  }

  const maps = NS.taxmaps || {};

  // W-9, March 2024 revision: 6 pages, 23 fields, all on page 1 (15 text, 8 boxes); no signature or date field.
  const W9 = 'topmostSubform[0].Page1[0].';
  const W9_W = 611.976;
  const W9_H = 791.968;
  maps['W-9 2024-03'] = {
    form: 'W-9',
    revision: 'Rev. March 2024',
    file: 'assets/forms/fw9-2024-03.pdf',
    sha256: '2d420cbb4123dcf1fb82595b2359cfbb5d81f00b9df9d359fcc7af361d093f53',
    fields: {
      name: { name: W9 + 'f1_01[0]', kind: 'text' }, // line 1: the taxpayer's own name
      business: { name: W9 + 'f1_02[0]', kind: 'text' }, // line 2: trade name or the name of an entity that is disregarded
      // line 3a: one box per federal tax classification, in the order printed
      individual: { name: W9 + 'Boxes3a-b_ReadOrder[0].c1_1[0]', kind: 'check', on: '1' },
      ccorp: { name: W9 + 'Boxes3a-b_ReadOrder[0].c1_1[1]', kind: 'check', on: '2' },
      scorp: { name: W9 + 'Boxes3a-b_ReadOrder[0].c1_1[2]', kind: 'check', on: '3' },
      partnership: { name: W9 + 'Boxes3a-b_ReadOrder[0].c1_1[3]', kind: 'check', on: '4' },
      trust: { name: W9 + 'Boxes3a-b_ReadOrder[0].c1_1[4]', kind: 'check', on: '5' },
      llc: { name: W9 + 'Boxes3a-b_ReadOrder[0].c1_1[5]', kind: 'check', on: '6' },
      other: { name: W9 + 'Boxes3a-b_ReadOrder[0].c1_1[6]', kind: 'check', on: '7' },
      llcLetter: { name: W9 + 'Boxes3a-b_ReadOrder[0].f1_03[0]', kind: 'text', max: 1 }, // how the LLC is taxed: C, S or P
      otherText: { name: W9 + 'Boxes3a-b_ReadOrder[0].f1_04[0]', kind: 'text' }, // the classification written out for "other"
      foreignOwners: { name: W9 + 'Boxes3a-b_ReadOrder[0].c1_2[0]', kind: 'check', on: '1' }, // line 3b: a pass-through entity with owners abroad
      exemptPayee: { name: W9 + 'f1_05[0]', kind: 'text' }, // line 4: payee exemption code
      fatcaCode: { name: W9 + 'f1_06[0]', kind: 'text' }, // line 4: reporting exemption code
      address: { name: W9 + 'Address_ReadOrder[0].f1_07[0]', kind: 'text' }, // line 5: street and unit
      cityStateZip: { name: W9 + 'Address_ReadOrder[0].f1_08[0]', kind: 'text' }, // line 6: city, state and postcode
      requester: { name: W9 + 'f1_09[0]', kind: 'text' }, // the box at the right of lines 5-6: who asked for the form
      accounts: { name: W9 + 'f1_10[0]', kind: 'text' }, // line 7: account numbers
      ssn1: { name: W9 + 'f1_11[0]', kind: 'comb', max: 3 }, // Part I: social security number in three cells
      ssn2: { name: W9 + 'f1_12[0]', kind: 'comb', max: 2 },
      ssn3: { name: W9 + 'f1_13[0]', kind: 'comb', max: 4 },
      ein1: { name: W9 + 'f1_14[0]', kind: 'comb', max: 2 }, // Part I: employer number in two cells
      ein2: { name: W9 + 'f1_15[0]', kind: 'comb', max: 7 }
    },
    groups: { ssn: ['ssn1', 'ssn2', 'ssn3'], ein: ['ein1', 'ein2'] },
    unused: {},
    removeBeforeFlatten: [],
    // Measured with pdftotext -bbox on page 1 of the bundled file (points, from the top). The label beside the signature
    // ends at x 116.7 (lines at y 580.8-597.5) and the date label spans x 385.6-401.3 (y 589.2-597.5); the box they sit in
    // runs from below the paragraph above (its last line ends at y 574.9) to y 598, and the next printed text starts at
    // y 608. Item 2 of the certification is three printed lines: x 36-560.6 at y 480.9-490.2, x 45-572.3 at y 490.5-499.8
    // and x 45-206.5 at y 500.1-509.4 (its first word "2." at x 36; it ends before item 3 at y 512.1); one stroke per line
    // through the middle of the line.
    overlays: {
      sign: place(W9_W, W9_H, 1, 122, 577.5, 258, 20.5),
      date: place(W9_W, W9_H, 1, 404, 582, 172, 16),
      caption: place(W9_W, W9_H, 1, 122, 599, 258, 7),
      strike2: place(W9_W, W9_H, 1, 36, 480.9, 536.3, 28.5, {
        lines: [stroke(W9_W, W9_H, 36, 560.6, 485.56), stroke(W9_W, W9_H, 45, 572.3, 495.16), stroke(W9_W, W9_H, 45, 206.5, 504.76)]
      })
    }
  };

  // W-8BEN, October 2021 revision: 1 page, 23 fields (20 text, 2 boxes, 1 signature field).
  const W8 = 'topmostSubform[0].Page1[0].';
  const W8_W = 612;
  const W8_H = 792.008;
  maps['W-8BEN 2021-10'] = {
    form: 'W-8BEN',
    revision: 'Rev. October 2021',
    file: 'assets/forms/fw8ben-2021-10.pdf',
    sha256: 'b821dc1172c91b348a65675529cc792782f11fc1ae8579df92d627113203f918',
    fields: {
      name: { name: W8 + 'f_1[0]', kind: 'text' }, // line 1: the individual who owns the income
      citizenship: { name: W8 + 'f_2[0]', kind: 'text' }, // line 2: country of nationality
      street: { name: W8 + 'f_3[0]', kind: 'text' }, // line 3: home street address abroad
      cityLine: { name: W8 + 'f_4[0]', kind: 'text' }, // line 3: city, region and postcode of that home
      country: { name: W8 + 'f_5[0]', kind: 'text' }, // line 3: country of that home
      mailStreet: { name: W8 + 'f_6[0]', kind: 'text' }, // line 4: postal street, only when it differs
      mailCityLine: { name: W8 + 'f_7[0]', kind: 'text' }, // line 4: postal city, region and postcode
      mailCountry: { name: W8 + 'f_8[0]', kind: 'text' }, // line 4: postal country
      usTin: { name: W8 + 'f_9[0]', kind: 'text', max: 11 }, // line 5: a US number (SSN or ITIN) when the owner has one
      ftin: { name: W8 + 'f_10[0]', kind: 'text' }, // line 6a: the home country's tax number
      noFtin: { name: W8 + 'c1_01[0]', kind: 'check', on: '1' }, // line 6b: the home country issues no such number
      reference: { name: W8 + 'f_11[0]', kind: 'text' }, // line 7: the requester's own reference
      birthDate: { name: W8 + 'f_12[0]', kind: 'text', max: 10 }, // line 8: born on, month-day-year
      treatyCountry: { name: W8 + 'f_13[0]', kind: 'text' }, // line 9: the treaty partner country
      treatyArticle: { name: W8 + 'f_14[0]', kind: 'text' }, // line 10: which article and paragraph is relied on
      treatyRate: { name: W8 + 'f_15[0]', kind: 'text' }, // line 10: the reduced percentage
      treatyIncome: { name: W8 + 'f_16[0]', kind: 'text' }, // line 10: what kind of payment the rate covers
      treatyExplain1: { name: W8 + 'f_17[0]', kind: 'text' }, // line 10: the conditions met, start (short slot at line end)
      treatyExplain2: { name: W8 + 'f_18[0]', kind: 'text' }, // line 10: the conditions met, continued on the next line
      capacity: { name: W8 + 'c1_02[0]', kind: 'check', on: '1' }, // Part III: the signer may sign for the owner
      printName: { name: W8 + 'f_21[0]', kind: 'text' } // Part III: the signer's name in print
    },
    groups: {},
    unused: {
      'the signing date is stamped by the e-sign date overlay at this rectangle, on the day of signing, after the form is flattened': [W8 + 'Date[0]']
    },
    // the signature field has no appearance: the writer cannot fill it and flattening fails while it is there
    removeBeforeFlatten: [W8 + 'f_20[0]'],
    // sign and date are the signature field's and the date field's own rectangles (x 108 y 72 w 316.8 h 12 and x 432
    // y 72.01 w 144 h 12 in points from the bottom). The caption goes in the free band just above the signature place:
    // the printed label under it starts at y 720.9 from the top and the print-name field follows at 732, while the
    // capacity line above ends by y 695.
    overlays: {
      sign: place(W8_W, W8_H, 1, 108, W8_H - 72 - 12, 316.8, 12),
      date: place(W8_W, W8_H, 1, 432, W8_H - 72.01 - 12, 144, 12, { fmt: 'MM-DD-YYYY' }),
      caption: place(W8_W, W8_H, 1, 108, 699, 316.8, 7)
    }
  };

  // W-8BEN-E, October 2021 revision: 8 pages, 179 fields (66 text, 112 boxes, 1 signature field). The fields an entity
  // in a supported status fills are mapped; every other field is listed under unused with the Part it lies in.
  const E = 'topmostSubform[0].';
  const E1 = E + 'Page1[0].';
  const E2 = E + 'Page2[0].';
  const E7 = E + 'Page7[0].';
  const E8 = E + 'Page8[0].';
  const E_W = 612;
  const E_H = 792.008;
  const box = (name, on) => ({ name, kind: 'check', on: String(on) });
  const text = (name, max) => (max ? { name, kind: 'text', max } : { name, kind: 'text' });
  maps['W-8BEN-E 2021-10'] = {
    form: 'W-8BEN-E',
    revision: 'Rev. October 2021',
    file: 'assets/forms/fw8bene-2021-10.pdf',
    sha256: 'd67fc5abae5af11df5d6168a60f7a7e7f27044efa63f660cb76c0e47a241ef6e',
    fields: {
      // Part I, page 1
      name: text(E1 + 'f1_1[0]'), // line 1: name of the organization that is the beneficial owner
      country: text(E1 + 'f1_2[0]'), // line 2: country of incorporation or organization
      disregardedName: text(E1 + 'f1_3[0]'), // line 3: name of a disregarded entity receiving the payment
      // line 4: chapter 3 status, one box per entity type, in the order printed (on-values 1 to 13)
      ch3Corporation: box(E1 + 'c1_1[0]', 1),
      ch3Partnership: box(E1 + 'c1_1[1]', 2),
      ch3SimpleTrust: box(E1 + 'c1_1[2]', 3),
      ch3TaxExempt: box(E1 + 'c1_1[3]', 4),
      ch3ComplexTrust: box(E1 + 'c1_1[4]', 5),
      ch3GovControlled: box(E1 + 'c1_1[5]', 6),
      ch3CentralBank: box(E1 + 'c1_1[6]', 7),
      ch3PrivateFoundation: box(E1 + 'c1_1[7]', 8),
      ch3Estate: box(E1 + 'c1_1[8]', 9),
      ch3GovIntegral: box(E1 + 'c1_1[9]', 10),
      ch3GrantorTrust: box(E1 + 'c1_1[10]', 11),
      ch3Disregarded: box(E1 + 'c1_1[11]', 12),
      ch3IntlOrg: box(E1 + 'c1_1[12]', 13),
      // line 4: a disregarded entity, partnership, simple trust or grantor trust: is it a hybrid making a treaty claim
      hybridYes: box(E1 + 'c1_2[0]', 1),
      hybridNo: box(E1 + 'c1_2[1]', 2),
      // line 5: chapter 4 status, left column (on-values 1 to 13) then right column (14 to 32), in the order printed
      ch4NonparticipatingFfi: box(E1 + 'Col1[0].c1_3[0]', 1),
      ch4ParticipatingFfi: box(E1 + 'Col1[0].c1_3[1]', 2),
      ch4ReportingModel1Ffi: box(E1 + 'Col1[0].c1_3[2]', 3),
      ch4ReportingModel2Ffi: box(E1 + 'Col1[0].c1_3[3]', 4),
      ch4RegisteredDeemedCompliant: box(E1 + 'Col1[0].c1_3[4]', 5),
      ch4SponsoredFfi: box(E1 + 'Col1[0].c1_3[5]', 6),
      ch4NonregisteringLocalBank: box(E1 + 'Col1[0].c1_3[6]', 7),
      ch4LowValueAccounts: box(E1 + 'Col1[0].c1_3[7]', 8),
      ch4SponsoredCloselyHeld: box(E1 + 'Col1[0].c1_3[8]', 9),
      ch4LimitedLifeDebt: box(E1 + 'Col1[0].c1_3[9]', 10),
      ch4InvestmentNoAccounts: box(E1 + 'Col1[0].c1_3[10]', 11),
      ch4OwnerDocumentedFfi: box(E1 + 'Col1[0].c1_3[11]', 12),
      ch4RestrictedDistributor: box(E1 + 'Col1[0].c1_3[12]', 13),
      ch4NonreportingIgaFfi: box(E1 + 'Col2[0].c1_3[0]', 14),
      ch4ForeignGovernment: box(E1 + 'Col2[0].c1_3[1]', 15),
      ch4IntlOrg: box(E1 + 'Col2[0].c1_3[2]', 16),
      ch4ExemptRetirementPlan: box(E1 + 'Col2[0].c1_3[3]', 17),
      ch4OwnedByExemptOwners: box(E1 + 'Col2[0].c1_3[4]', 18),
      ch4TerritoryFi: box(E1 + 'Col2[0].c1_3[5]', 19),
      ch4ExceptedGroupEntity: box(E1 + 'Col2[0].c1_3[6]', 20),
      ch4ExceptedStartUp: box(E1 + 'Col2[0].c1_3[7]', 21),
      ch4ExceptedLiquidation: box(E1 + 'Col2[0].c1_3[8]', 22),
      ch4Org501c: box(E1 + 'Col2[0].c1_3[9]', 23),
      ch4Nonprofit: box(E1 + 'Col2[0].c1_3[10]', 24),
      ch4PubliclyTradedNffe: box(E1 + 'Col2[0].c1_3[11]', 25),
      ch4ExceptedTerritoryNffe: box(E1 + 'Col2[0].c1_3[12]', 26),
      ch4ActiveNffe: box(E1 + 'Col2[0].c1_3[13]', 27),
      ch4PassiveNffe: box(E1 + 'Col2[0].c1_3[14]', 28),
      ch4InterAffiliateFfi: box(E1 + 'Col2[0].c1_3[15]', 29),
      ch4DirectReportingNffe: box(E1 + 'Col2[0].c1_3[16]', 30),
      ch4SponsoredDirectReportingNffe: box(E1 + 'Col2[0].c1_3[17]', 31),
      ch4NotFinancialAccount: box(E1 + 'Col2[0].c1_3[18]', 32),
      street: text(E1 + 'f1_4[0]'), // line 6: permanent residence address, street
      cityLine: text(E1 + 'f1_5[0]'), // line 6: city or town, state or province, postal code
      residenceCountry: text(E1 + 'f1_6[0]'), // line 6: country
      mailStreet: text(E1 + 'f1_7[0]'), // line 7: mailing address, only when it differs
      mailCityLine: text(E1 + 'f1_8[0]'), // line 7: city or town, state or province, postal code
      mailCountry: text(E1 + 'f1_9[0]'), // line 7: country
      // Part I continued, page 2
      usTin: text(E2 + 'f2_1[0]', 11), // line 8: U.S. taxpayer identification number, when the entity has one
      giin: text(E2 + 'Line9a_ReadOrder[0].f2_2[0]'), // line 9a: GIIN
      ftin: text(E2 + 'Line9b_ReadOrder[0].f2_3[0]'), // line 9b: foreign TIN
      noFtin: box(E2 + 'c2_1[0]', 1), // line 9c: FTIN not legally required
      reference: text(E2 + 'f2_4[0]', 19), // line 10: reference number(s)
      // Part III, page 2: claim of tax treaty benefits
      treatyResident: box(E2 + 'c2_3[0]', 1), // line 14a: the beneficial owner is a resident of the country named
      treatyCountry: text(E2 + 'f2_9[0]'), // line 14a: the treaty country
      treatyLob: box(E2 + 'c2_4[0]', 1), // line 14b: derives the income and meets the limitation on benefits article
      // line 14b: the type of limitation on benefits provision met, left column (on-values 1 to 5) then right (6 to 11)
      lobGovernment: box(E2 + 'CheckboxesLine14b_ReadOrder[0].c2_5[0]', 1),
      lobPension: box(E2 + 'CheckboxesLine14b_ReadOrder[0].c2_5[1]', 2),
      lobTaxExempt: box(E2 + 'CheckboxesLine14b_ReadOrder[0].c2_5[2]', 3),
      lobPubliclyTraded: box(E2 + 'CheckboxesLine14b_ReadOrder[0].c2_5[3]', 4),
      lobSubsidiary: box(E2 + 'CheckboxesLine14b_ReadOrder[0].c2_5[4]', 5),
      lobOwnershipBaseErosion: box(E2 + 'c2_5[0]', 6),
      lobDerivative: box(E2 + 'c2_5[1]', 7),
      lobActiveTrade: box(E2 + 'c2_5[2]', 8),
      lobDiscretionary: box(E2 + 'c2_5[3]', 9),
      lobNoArticle: box(E2 + 'c2_5[4]', 10),
      lobOther: box(E2 + 'c2_5[5]', 11),
      lobOtherText: text(E2 + 'f2_10[0]'), // line 14b: "Other": the article and paragraph
      treatyUsSource: box(E2 + 'c2_6[0]', 1), // line 14c: treaty benefits for U.S. source dividends from a foreign corporation
      treatyArticle: text(E2 + 'f2_11[0]'), // line 15: article and paragraph
      treatyRate: text(E2 + 'f2_12[0]'), // line 15: the percentage rate of withholding
      treatyIncome: text(E2 + 'f2_13[0]'), // line 15: the type of income
      treatyExplain1: text(E2 + 'f2_14[0]'), // line 15: the additional conditions met, start (short slot at line end)
      treatyExplain2: text(E2 + 'f2_15[0]'), // line 15: continued on the next line
      treatyExplain3: text(E2 + 'f2_16[0]'), // line 15: and the line after
      // Part XXV, page 7: Active NFFE
      activeNffe: box(E7 + 'c7_5[0]', 1), // line 39
      // Part XXVI, page 7: Passive NFFE
      passiveNffe: box(E7 + 'c7_6[0]', 1), // line 40a
      passiveNoOwners: box(E7 + 'c7_7[0]', 1), // line 40b: no substantial U.S. owners (or controlling U.S. persons)
      passiveOwnersListed: box(E7 + 'c7_7[1]', 2), // line 40c: each substantial U.S. owner is listed in Part XXIX
      // Part XXIX, page 8: substantial U.S. owners of the passive NFFE, nine rows of name, address and TIN
      owner1Name: text(E8 + 'Table_Part29[0].BodyRow1[0].f8_3[0]'),
      owner1Address: text(E8 + 'Table_Part29[0].BodyRow1[0].f8_4[0]'),
      owner1Tin: text(E8 + 'Table_Part29[0].BodyRow1[0].f8_5[0]', 11),
      owner2Name: text(E8 + 'Table_Part29[0].BodyRow2[0].f8_6[0]'),
      owner2Address: text(E8 + 'Table_Part29[0].BodyRow2[0].f8_7[0]'),
      owner2Tin: text(E8 + 'Table_Part29[0].BodyRow2[0].f8_8[0]', 11),
      owner3Name: text(E8 + 'Table_Part29[0].BodyRow3[0].f8_9[0]'),
      owner3Address: text(E8 + 'Table_Part29[0].BodyRow3[0].f8_10[0]'),
      owner3Tin: text(E8 + 'Table_Part29[0].BodyRow3[0].f8_11[0]', 11),
      owner4Name: text(E8 + 'Table_Part29[0].BodyRow4[0].f8_12[0]'),
      owner4Address: text(E8 + 'Table_Part29[0].BodyRow4[0].f8_13[0]'),
      owner4Tin: text(E8 + 'Table_Part29[0].BodyRow4[0].f8_14[0]', 11),
      owner5Name: text(E8 + 'Table_Part29[0].BodyRow5[0].f8_15[0]'),
      owner5Address: text(E8 + 'Table_Part29[0].BodyRow5[0].f8_16[0]'),
      owner5Tin: text(E8 + 'Table_Part29[0].BodyRow5[0].f8_17[0]', 11),
      owner6Name: text(E8 + 'Table_Part29[0].BodyRow6[0].f8_18[0]'),
      owner6Address: text(E8 + 'Table_Part29[0].BodyRow6[0].f8_19[0]'),
      owner6Tin: text(E8 + 'Table_Part29[0].BodyRow6[0].f8_20[0]', 11),
      owner7Name: text(E8 + 'Table_Part29[0].BodyRow7[0].f8_21[0]'),
      owner7Address: text(E8 + 'Table_Part29[0].BodyRow7[0].f8_22[0]'),
      owner7Tin: text(E8 + 'Table_Part29[0].BodyRow7[0].f8_23[0]', 11),
      owner8Name: text(E8 + 'Table_Part29[0].BodyRow8[0].f8_24[0]'),
      owner8Address: text(E8 + 'Table_Part29[0].BodyRow8[0].f8_25[0]'),
      owner8Tin: text(E8 + 'Table_Part29[0].BodyRow8[0].f8_26[0]', 11),
      owner9Name: text(E8 + 'Table_Part29[0].BodyRow9[0].f8_27[0]'),
      owner9Address: text(E8 + 'Table_Part29[0].BodyRow9[0].f8_28[0]'),
      owner9Tin: text(E8 + 'Table_Part29[0].BodyRow9[0].f8_29[0]', 11),
      // Part XXX, page 8: certification
      capacity: box(E8 + 'c8_3[0]', 1), // the signer has the capacity to sign for the entity on line 1
      printName: text(E8 + 'f8_31[0]') // print name of the individual signing
    },
    groups: {},
    unused: {
      'Part XXX, the signing date: stamped by the e-sign date overlay at this rectangle on the day of signing, after the form is flattened': [E8 + 'f8_32[0]'],
      'Part II, disregarded entity or branch receiving payment: filled only when a branch or disregarded entity with its own chapter 4 status receives the payment; the portal fills the form for the entity itself, and an investor paid through such a branch uploads a completed form instead': [
        E2 + 'CheckboxesCol1_ReadOrder[0].c2_2[0]', E2 + 'CheckboxesCol1_ReadOrder[0].c2_2[1]',
        E2 + 'CheckboxesCol2_ReadOrder[0].c2_2[0]', E2 + 'CheckboxesCol2_ReadOrder[0].c2_2[1]', E2 + 'c2_2[0]', E2 + 'f2_5[0]',
        E2 + 'f2_6[0]', E2 + 'f2_7[0]', E2 + 'f2_8[0]'
      ],
      'Part IV, sponsored FFI: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E2 + 'f2_17[0]', E2 + 'c2_7[0]', E2 + 'c2_8[0]'
      ],
      'Part V, certified deemed-compliant nonregistering local bank: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page3[0].c3_1[0]'
      ],
      'Part VI, certified deemed-compliant FFI with only low-value accounts: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page3[0].c3_2[0]'
      ],
      'Part VII, certified deemed-compliant sponsored, closely held investment vehicle: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page3[0].f3_1[0]', E + 'Page3[0].c3_3[0]'
      ],
      'Part VIII, certified deemed-compliant limited life debt investment entity: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page3[0].c3_4[0]'
      ],
      'Part IX, certain investment entities that do not maintain financial accounts: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page3[0].c3_5[0]'
      ],
      'Part X, owner-documented FFI: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page3[0].c3_6[0]', E + 'Page4[0].c4_1[0]', E + 'Page4[0].c4_1[1]', E + 'Page4[0].c4_2[0]'
      ],
      'Part XI, restricted distributor: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page4[0].c4_3[0]', E + 'Page4[0].c4_4[0]', E + 'Page4[0].c4_4[1]'
      ],
      'Part XII, nonreporting IGA FFI: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page5[0].c5_1[0]', E + 'Page5[0].BulletedList1[0].Bullet1[0].f5_01[0]',
        E + 'Page5[0].BulletedList1[0].Bullet1[0].c5_2[0]', E + 'Page5[0].BulletedList1[0].Bullet1[0].c5_2[1]',
        E + 'Page5[0].BulletedList1[0].Bullet1[0].f5_2[0]', E + 'Page5[0].BulletedList1[0].Bullet2[0].f5_03[0]',
        E + 'Page5[0].BulletedList1[0].Bullet2[0].c5_3[0]', E + 'Page5[0].BulletedList1[0].Bullet2[0].c5_3[1]'
      ],
      'Part XIII, foreign government, government of a U.S. possession or foreign central bank of issue: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page5[0].c5_4[0]'
      ],
      'Part XIV, international organization: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page5[0].c5_5[0]', E + 'Page5[0].c5_5[1]'
      ],
      'Part XV, exempt retirement plans (lines 29a to 29f, over pages 5 and 6): not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page5[0].c5_6[0]', E + 'Page5[0].c5_6[1]', E + 'Page5[0].c5_6[2]', E + 'Page6[0].c5_6[0]', E + 'Page6[0].c5_6[1]',
        E + 'Page6[0].c5_6[2]'
      ],
      'Part XVI, entity wholly owned by exempt beneficial owners: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page6[0].c6_1[0]'
      ],
      'Part XVII, territory financial institution: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page6[0].c6_2[0]'
      ],
      'Part XVIII, excepted nonfinancial group entity: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page6[0].c6_3[0]'
      ],
      'Part XIX, excepted nonfinancial start-up company: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page6[0].c6_4[0]', E + 'Page6[0].BulletList4[0].Bullet1[0].f6_1[0]'
      ],
      'Part XX, excepted nonfinancial entity in liquidation or bankruptcy: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E + 'Page6[0].c6_5[0]', E + 'Page6[0].BulletList5[0].Bullet1[0].f6_2[0]'
      ],
      'Part XXI, 501(c) organization: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E7 + 'c7_1[0]', E7 + 'BulletList1[0].Bullet1[0].f7_1[0]'
      ],
      'Part XXII, nonprofit organization: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E7 + 'c7_2[0]'
      ],
      'Part XXIII, publicly traded NFFE or NFFE affiliate of a publicly traded corporation: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E7 + 'c7_3[0]', E7 + 'BulletList3[0].Bullet2[0].f7_2[0]', E7 + 'c7_3[1]', E7 + 'BulletList4[0].Bullet3[0].f7_3[0]',
        E7 + 'BulletList4[0].Bullet4[0].f7_4[0]'
      ],
      'Part XXIV, excepted territory NFFE: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E7 + 'c7_4[0]'
      ],
      'Part XXVII, excepted inter-affiliate FFI: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E8 + 'c8_1[0]'
      ],
      'Part XXVIII, sponsored direct reporting NFFE: not a status the portal fills in; an investor in this status uploads a completed form instead': [
        E8 + 'f8_1[0]', E8 + 'c8_2[0]'
      ]
    },
    // the signature field has no appearance: the writer cannot fill it and flattening fails while it is there
    removeBeforeFlatten: [E8 + 'f8_30[0]'],
    // Page 8, points from the bottom: signature field f8_30 x 100.8 y 108 w 223.2 h 24.01, date field f8_32 x 496.8 y 108
    // w 79.2 h 12.01. Directly under the signature place (y 684 from the top) the printed label "Signature of individual
    // authorized to sign for beneficial owner" runs y 685.8-694 (x 117-307.8); the band under that label is free to
    // y 708 (the form's footer starts at x 459.6), so the caption goes there, at y 695-702 from the top.
    overlays: {
      sign: place(E_W, E_H, 8, 100.8, E_H - 108 - 24.01, 223.2, 24.01),
      date: place(E_W, E_H, 8, 496.8, E_H - 108 - 12.01, 79.2, 12.01, { fmt: 'MM-DD-YYYY' }),
      caption: place(E_W, E_H, 8, 100.8, 695, 223.2, 7)
    }
  };

  NS.taxmaps = maps;
})((window.CVPortal = window.CVPortal || {}));
