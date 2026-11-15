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

  NS.taxmaps = maps;
})((window.CVPortal = window.CVPortal || {}));
