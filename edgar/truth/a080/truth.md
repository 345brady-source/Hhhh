# Answer sheet: a080 (3 pages)

Source: https://www.sec.gov/Archives/edgar/data/1320691/000132069105000011/subscriptionagreement.pdf

PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt of writing room above it. Cell: the cell's own rules. Tick box: the printed square (ink at 400 dpi). Picture pages: measured on the picture's own pixels and converted through the page's drawing matrix.

pdfplumber characters and drawn rectangles (geom.json in work-g1); tick squares from ink at 400 dpi; every page looked at at 100 dpi; overlays drawn and looked at.

## Who signs

The subscriber fills the registration table and the kind-of-subscriber choices, ticks how payment is made and signs with the date and printed name; a second subscriber line is printed under the first; the company accepts with a date and the director's signature.

- Investor pages: [2, 3]
- Firm pages: [3]
- Co-investor: True
- Third parties: none

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: instructions and prose) |
| 2 | 26 | 9 | 0 | 17 | 0 | 0 | sure (judgements: the nine "( )" pairs are tick boxes; the state after "the State of :" is a place with nothing printed) |
| 3 | 9 | 2 | 0 | 2 | 3 | 2 | sure (judgement: the second signature and print-name lines belong to a second subscriber) |
| all | 35 | 11 | 0 | 19 | 3 | 2 | |

By owner: co-investor 2, firm 2, investor 31

## Doubtful (1)

- p02-ugma-state (p2, blank, investor): no line printed: the box is the empty room after "the State of :" to the cell edge

## Places

### Page 1

### Page 2

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p02-name | blank | name | investor | yes | 198.0, 279.2, 527.4, 307.4 | drawn table cell right of its caption cell (0.4 pt rules; box = centre lines) | Name of subscriber |
| p02-street | blank | address | investor | yes | 198.0, 307.4, 527.4, 321.6 | drawn table cell right of its caption cell (0.4 pt rules; box = centre lines) | Street address |
| p02-city | blank | address | investor | yes | 198.0, 321.6, 527.4, 335.9 | drawn table cell right of its caption cell (0.4 pt rules; box = centre lines) | City |
| p02-ssn | blank | tax number | investor | no | 198.0, 350.2, 527.4, 364.5 | drawn table cell right of its caption cell (0.4 pt rules; box = centre lines) | Social security number |
| p02-business-number | blank | tax number | investor | no | 198.0, 364.5, 527.4, 378.9 | drawn table cell right of its caption cell (0.4 pt rules; box = centre lines) | Business number (for a subscriber that is a business) |
| p02-shares | blank | text | investor | yes | 198.0, 378.9, 527.4, 393.1 | drawn table cell right of its caption cell (0.4 pt rules; box = centre lines) | Number of shares purchased |
| p02-amount | blank | amount | investor | yes | 198.0, 393.1, 527.4, 407.4 | drawn table cell right of its caption cell (0.4 pt rules; box = centre lines) | Amount enclosed (a dollar sign is printed at the start of the cell) |
| p02-register-as | blank | name | investor | no | 198.0, 407.4, 527.4, 435.6 | drawn table cell right of its caption cell (0.4 pt rules; box = centre lines) | Register shares as (only if different from the subscriber name) |
| p02-state | blank | address | investor | yes | 198.0, 335.9, 351.0, 350.2 | drawn table cell right of its caption cell (0.4 pt rules; box = centre lines) | Province or state |
| p02-zip | blank | address | investor | yes | 423.0, 335.9, 527.4, 350.2 | drawn table cell right of the caption cell "Postal \ Zip" (0.4 pt rules; box = centre lines) | Postal or zip code |
| p02-is-corporation | tickbox | tickbox | investor | no | 90.5, 478.1, 103.3, 488.9 | a pair of round brackets with a space between, "( )" (ink of the pair) | The subscriber is (check one): corporation |
| p02-is-single | tickbox | tickbox | investor | no | 90.5, 492.3, 103.3, 503.1 | a pair of round brackets with a space between, "( )" (ink of the pair) | The subscriber is (check one): a single person |
| p02-is-community | tickbox | tickbox | investor | no | 89.8, 506.5, 104.2, 517.9 | a pair of round brackets with a space between, "( )" (ink of the pair) | The subscriber is (check one): husband and wife, community property |
| p02-is-joint | tickbox | tickbox | investor | no | 90.5, 520.9, 103.3, 531.7 | a pair of round brackets with a space between, "( )" (ink of the pair) | The subscriber is (check one): joint tenants |
| p02-is-separate | tickbox | tickbox | investor | no | 90.5, 535.1, 103.3, 545.9 | a pair of round brackets with a space between, "( )" (ink of the pair) | The subscriber is (check one): a married man or woman as separate property |
| p02-is-tic | tickbox | tickbox | investor | no | 90.5, 565.9, 100.3, 576.7 | a pair of round brackets with a space between, "( )" (ink of the pair) | The subscriber is (check one): tenants in common |
| p02-is-other | tickbox | tickbox | investor | no | 90.5, 600.7, 100.3, 611.5 | a pair of round brackets with a space between, "( )" (ink of the pair) | The subscriber is (check one): other |
| p02-is-trust | tickbox | tickbox | investor | no | 311.9, 478.1, 321.8, 488.9 | a pair of round brackets with a space between, "( )" (ink of the pair) | The subscriber is (check one): trust |
| p02-is-custodian | tickbox | tickbox | investor | no | 311.8, 565.7, 321.7, 576.5 | a pair of round brackets with a space between, "( )" (ink of the pair) | The subscriber is (check one): custodian under the Uniform Gift to Minors Act |
| p02-other-which | blank | text | investor | no | 131.3, 599.7, 299.4, 611.7 | underscore run of 28 | Other kind of subscriber: which |
| p02-trustees | blank | name | investor | no | 364.7, 491.3, 508.8, 503.3 | underscore run of 24 | Trust: trustee(s) |
| p02-trust-date | blank | date | investor | no | 365.4, 505.6, 509.4, 517.6 | underscore run of 24 | Trust: trust date |
| p02-trust-name | blank | name | investor | no | 384.4, 519.9, 510.4, 531.9 | underscore run of 21 | Trust: name of trust |
| p02-trust-benefit | blank | name | investor | no | 397.1, 534.2, 511.1, 546.2 | underscore run of 19 | Trust: for the benefit of |
| p02-custodian-for | blank | name | investor | no | 391.1, 564.8, 499.1, 576.8 | underscore run of 18 | Custodian for (the minor) under the Uniform Gift to Minors Act |
| p02-ugma-state | blank | text | investor | no | 374.4, 592.4, 527.4, 604.4 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Uniform Gift to Minors Act: the state (caption ends in a colon; nothing printed after it) |

Must NOT get a field: the bracketed words "(man) (woman)" and "(his) (her)" inside one choice: words to strike, not tick boxes; the parentheses inside the word "Trustees(s)"; the caption cells of the registration table (left column, and the "Postal \ Zip" caption cell); the dollar sign printed at the start of the amount cell (part of that blank); the table frames of section 5 (the choices sit inside them); the footnote line under the registration table.

### Page 3

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p03-pay-check | tickbox | tickbox | investor | no | 90.4, 101.9, 98.8, 110.5 | box glyph (MonotypeSorts, a square with a shadow; ink of the glyph) | Payment: My check is enclosed |
| p03-pay-money-order | tickbox | tickbox | investor | no | 270.4, 101.9, 278.8, 110.5 | box glyph (MonotypeSorts, a square with a shadow; ink of the glyph) | Payment: Money order or certified check or bank draft is enclosed |
| p03-inv-signature | signature | signature | investor | yes | 306.0, 186.1, 510.0, 198.1 | underscore run of 34 | Signature of subscriber (first line) |
| p03-inv-date | date | date | investor | yes | 119.0, 225.4, 209.0, 237.4 | underscore run of 15 | Date (left of the signatures, under the heading "Signature(s):") |
| p03-co-signature | signature | signature | co-investor | no | 306.0, 225.4, 522.0, 237.4 | underscore run of 36 | Signature of subscriber (second line, for a second subscriber) |
| p03-inv-name | blank | name | investor | yes | 306.0, 264.5, 522.0, 276.5 | underscore run of 36 | Printed name of subscriber (first line) |
| p03-co-name | blank | name | co-investor | no | 306.0, 303.6, 522.0, 315.6 | underscore run of 36 | Printed name of subscriber (second line) |
| p03-firm-date | date | date | firm | no | 219.0, 414.0, 447.3, 426.0 | 3 underscore runs (day, month, year) read as one date; parts give each run | Acceptance by the company: "accepted this __ day of ____, ____" |
| p03-firm-signature | signature | signature | firm | no | 90.0, 483.0, 342.0, 495.0 | underscore run of 42 | Acceptance by the company: signature of the named director |

Must NOT get a field: the printed name and title of the company director under the acceptance line (already printed); the headings "Signature(s):" and "Acceptance by Company:".
