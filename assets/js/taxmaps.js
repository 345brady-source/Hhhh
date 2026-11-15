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

  NS.taxmaps = maps;
})((window.CVPortal = window.CVPortal || {}));
