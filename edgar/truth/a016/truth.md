# Answer sheet: a016 (6 pages)

Source: https://www.sec.gov/Archives/edgar/data/1733443/000165495418005888/chosen_ex4.htm

PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt of writing room above it. Cell: the cell's own rules. Tick box: the printed square (ink at 400 dpi). Picture pages: measured on the picture's own pixels and converted through the page's drawing matrix.

pdfplumber characters and drawn rectangles (geom.json in work-g1); tick squares from ink at 400 dpi; every page looked at at 100 dpi; overlays drawn and looked at.

## Who signs

The investor completes the information and ownership pages, initials one eligibility line and signs on the last page (the name may be typed); a joint owner signs below; a custodian completes its own section for custodial accounts; the company accepts on the last page.

- Investor pages: [1, 2, 4, 6]
- Firm pages: [6]
- Co-investor: True
- Third parties: custodian (page 2, "to be completed by custodian")

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 29 | 0 | 0 | 29 | 0 | 0 | sure of the places; the boxes of the 27 caption-only cells are the empty room after each caption (nothing printed); the circular date is likely the issuer's |
| 2 | 28 | 16 | 0 | 12 | 0 | 0 | sure (one judgement: the State / Zip Code rule is split in two) |
| 3 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 4 | 3 | 0 | 3 | 0 | 0 | 0 | sure |
| 5 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 6 | 8 | 0 | 0 | 2 | 3 | 3 | sure (judgement: each date made of several underscore runs is one place; its parts are listed) |
| all | 68 | 16 | 3 | 43 | 3 | 3 | |

By owner: co-investor 11, firm 3, investor 35, investor-entity 9, investor-individual 1, third-party 8, unclear 1

## Doubtful (30)

- p01-circular-date (p1, blank, unclear): the date of the issuer's own offering circular: most likely completed by the issuer before sending, not by the investor
- p01-ind-name (p1, blank, investor): no line is printed: the empty table cell after the caption is the writing room
- p01-ind-ssn (p1, blank, investor): no line is printed: the empty table cell after the caption is the writing room
- p01-ind-dob (p1, blank, investor): no line is printed: the empty table cell after the caption is the writing room
- p01-ind-street (p1, blank, investor): no line is printed: the empty table cell after the caption is the writing room
- p01-ind-city (p1, blank, investor): no line is printed: the empty table cell after the caption is the writing room
- p01-ind-state (p1, blank, investor): no line is printed: the empty table cell after the caption is the writing room
- p01-ind-zip (p1, blank, investor): no line is printed: the empty table cell after the caption is the writing room
- p01-ind-phone (p1, blank, investor): no line is printed: the empty table cell after the caption is the writing room
- p01-ind-citizenship (p1, blank, investor): no line is printed: the empty table cell after the caption is the writing room
- p01-ind-email (p1, blank, investor): no line is printed: the empty table cell after the caption is the writing room
- p01-joint-name (p1, blank, co-investor): no line is printed: the empty table cell after the caption is the writing room
- p01-joint-ssn (p1, blank, co-investor): no line is printed: the empty table cell after the caption is the writing room
- p01-joint-dob (p1, blank, co-investor): no line is printed: the empty table cell after the caption is the writing room
- p01-joint-street (p1, blank, co-investor): no line is printed: the empty table cell after the caption is the writing room
- p01-joint-city (p1, blank, co-investor): no line is printed: the empty table cell after the caption is the writing room
- p01-joint-state (p1, blank, co-investor): no line is printed: the empty table cell after the caption is the writing room
- p01-joint-zip (p1, blank, co-investor): no line is printed: the empty table cell after the caption is the writing room
- p01-joint-phone (p1, blank, co-investor): no line is printed: the empty table cell after the caption is the writing room
- p01-joint-citizenship (p1, blank, co-investor): no line is printed: the empty table cell after the caption is the writing room
- p01-ent-name (p1, blank, investor-entity): no line is printed: the empty table cell after the caption is the writing room
- p01-ent-tax-id (p1, blank, investor-entity): no line is printed: the empty table cell after the caption is the writing room
- p01-ent-formed (p1, blank, investor-entity): no line is printed: the empty table cell after the caption is the writing room
- p01-ent-officers (p1, blank, investor-entity): no line is printed: the empty table cell after the caption is the writing room
- p01-ent-street (p1, blank, investor-entity): no line is printed: the empty table cell after the caption is the writing room
- p01-ent-city (p1, blank, investor-entity): no line is printed: the empty table cell after the caption is the writing room
- p01-ent-state (p1, blank, investor-entity): no line is printed: the empty table cell after the caption is the writing room
- p01-ent-zip (p1, blank, investor-entity): no line is printed: the empty table cell after the caption is the writing room
- p02-cust-state (p2, blank, third-party): one rule carries two captions (State, Zip Code): split at the second caption
- p02-cust-zip (p2, blank, third-party): one rule carries two captions (State, Zip Code): split at the second caption

## Places

### Page 1

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p01-amount | blank | amount | investor | yes | 314.0, 143.1, 348.1, 152.9 | underscore run of 7 | Subscription price in dollars (blank inside the opening sentence, after a dollar sign) |
| p01-circular-date | blank | date | unclear | no | 460.5, 167.1, 519.0, 176.9 | underscore run of 12 | Date of the final offering circular (blank inside the opening sentence) |
| p01-ind-name | blank | name | investor | yes | 136.8, 396.8, 248.2, 408.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual / beneficial owner: first, middle, last name |
| p01-ind-ssn | blank | tax number | investor | yes | 319.6, 396.8, 424.5, 408.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual: social security number |
| p01-ind-dob | blank | date | investor | yes | 480.4, 396.8, 578.2, 408.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual: date of birth |
| p01-ind-street | blank | address | investor | yes | 95.0, 408.8, 248.2, 420.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual: street address (permanent; no PO box) |
| p01-ind-city | blank | address | investor | yes | 269.7, 408.8, 424.5, 420.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual: city |
| p01-ind-state | blank | address | investor | yes | 448.4, 408.8, 507.0, 420.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual: state |
| p01-ind-zip | blank | address | investor | yes | 548.0, 408.8, 578.2, 420.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual: zip code |
| p01-ind-phone | blank | phone | investor | yes | 106.2, 420.8, 248.2, 432.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual: daytime phone |
| p01-ind-citizenship | blank | text | investor | no | 457.4, 420.8, 578.2, 432.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual: country of citizenship if not a US citizen |
| p01-ind-email | blank | email | investor | no | 98.8, 432.8, 578.2, 444.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual: email address |
| p01-joint-name | blank | name | co-investor | no | 136.8, 483.8, 248.2, 495.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint owner / minor: first, middle, last name |
| p01-joint-ssn | blank | tax number | co-investor | no | 319.6, 483.8, 424.5, 495.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint owner: social security number |
| p01-joint-dob | blank | date | co-investor | no | 480.4, 483.8, 578.2, 495.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint owner: date of birth |
| p01-joint-street | blank | address | co-investor | no | 95.0, 495.8, 248.2, 507.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint owner: street address |
| p01-joint-city | blank | address | co-investor | no | 269.7, 495.8, 424.5, 507.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint owner: city |
| p01-joint-state | blank | address | co-investor | no | 448.4, 495.8, 507.0, 507.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint owner: state |
| p01-joint-zip | blank | address | co-investor | no | 548.0, 495.8, 578.2, 507.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint owner: zip code |
| p01-joint-phone | blank | phone | co-investor | no | 106.2, 507.8, 248.2, 519.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint owner: daytime phone |
| p01-joint-citizenship | blank | text | co-investor | no | 457.4, 507.8, 578.2, 519.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint owner: country of citizenship if not a US citizen |
| p01-ent-name | blank | name | investor-entity | no | 88.0, 558.8, 248.2, 570.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Corporation / partnership / other: entity name |
| p01-ent-tax-id | blank | tax number | investor-entity | no | 287.5, 558.8, 424.5, 570.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity: tax ID number |
| p01-ent-formed | blank | date | investor-entity | no | 527.2, 558.8, 578.2, 570.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity: date of formation |
| p01-ent-officers | blank | name | investor-entity | no | 176.6, 570.8, 578.2, 594.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity: name of officer(s), general partner or other authorised person(s) (caption on two lines) |
| p01-ent-street | blank | address | investor-entity | no | 95.0, 594.8, 248.2, 606.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity: street address |
| p01-ent-city | blank | address | investor-entity | no | 269.7, 594.8, 424.5, 606.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity: city |
| p01-ent-state | blank | address | investor-entity | no | 448.4, 594.8, 507.0, 606.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity: state |
| p01-ent-zip | blank | address | investor-entity | no | 548.0, 594.8, 578.2, 606.8 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity: zip code |

Must NOT get a field: the underscore in the filing header line ("chosen_ex4.htm", y 35): part of a file name; the heavy rules above and below the three block captions (Individual, Joint-Owner, Corporation): caption frames; the captions themselves (text, not places).

### Page 2

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p02-own-01 | tickbox | tickbox | investor | no | 34.6, 104.4, 41.6, 111.6 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Individual |
| p02-own-02 | tickbox | tickbox | investor | no | 34.6, 116.5, 41.6, 123.7 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Joint Tenants with Rights of Survivorship |
| p02-own-03 | tickbox | tickbox | investor | no | 34.6, 128.5, 41.6, 135.7 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Community Property |
| p02-own-04 | tickbox | tickbox | investor | no | 34.6, 140.4, 42.8, 147.6 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Tenants in Common |
| p02-own-05 | tickbox | tickbox | investor | no | 34.6, 152.5, 42.8, 159.7 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Uniform Gift to Minors Act |
| p02-own-06 | tickbox | tickbox | investor | no | 34.6, 176.4, 42.8, 183.6 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Uniform Transfer to Minors Act |
| p02-own-07 | tickbox | tickbox | investor | no | 34.6, 188.5, 41.6, 195.7 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Qualified Pension or Profit Sharing Plan |
| p02-own-08 | tickbox | tickbox | investor | no | 34.6, 200.5, 42.8, 207.7 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Trust |
| p02-own-09 | tickbox | tickbox | investor | no | 34.6, 212.4, 41.6, 219.6 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Corporation |
| p02-own-10 | tickbox | tickbox | investor | no | 34.6, 224.5, 42.8, 231.7 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Partnership |
| p02-own-11 | tickbox | tickbox | investor | no | 34.6, 248.4, 41.6, 255.6 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Other (Specify) |
| p02-own-12 | tickbox | tickbox | investor | no | 34.6, 299.5, 42.8, 306.7 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Traditional IRA (custodial) |
| p02-own-13 | tickbox | tickbox | investor | no | 34.6, 311.4, 42.8, 318.6 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Roth IRA (custodial) |
| p02-own-14 | tickbox | tickbox | investor | no | 34.6, 323.5, 41.6, 330.7 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Simplified Employee Pension/Trust (SEP) (custodial) |
| p02-own-15 | tickbox | tickbox | investor | no | 34.6, 347.4, 42.8, 354.6 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): KEOGH (custodial) |
| p02-own-16 | tickbox | tickbox | investor | no | 34.6, 359.5, 41.6, 366.7 | box character U+2610 (printed square measured at 400 dpi) | Type of ownership (select only one): Other (custodial) |
| p02-ugma-state | blank | text | investor | no | 197.9, 152.1, 227.2, 161.9 | underscore run of 6 | Uniform Gift to Minors Act: state |
| p02-utma-state | blank | text | investor | no | 216.9, 176.1, 251.0, 185.9 | underscore run of 7 | Uniform Transfer to Minors Act: state |
| p02-other-specify | blank | text | investor | no | 116.2, 248.1, 238.1, 257.9 | underscore run of 25 | Other non-custodial ownership: which |
| p02-cust-other | blank | text | investor | no | 75.5, 359.1, 231.5, 368.9 | underscore run of 32 | Other custodial ownership: which |
| p02-cust-name | blank | name | third-party | no | 33.8, 446.8, 306.0, 456.8 | drawn rule at y=456.8 (box = the 10 pt of writing room above it) | Name of custodian (section "to be completed by custodian") |
| p02-cust-address | blank | address | third-party | no | 33.8, 484.2, 306.0, 494.2 | drawn rule at y=494.2 (box = the 10 pt of writing room above it) | Custodian mailing address (section "to be completed by custodian") |
| p02-cust-city | blank | address | third-party | no | 33.8, 521.8, 306.0, 531.8 | drawn rule at y=531.8 (box = the 10 pt of writing room above it) | Custodian city (section "to be completed by custodian") |
| p02-cust-state | blank | address | third-party | no | 33.8, 559.2, 84.2, 569.2 | drawn rule at y=569.2 (box = the 10 pt of writing room above it) | Custodian state (one rule under two captions; left part) |
| p02-cust-zip | blank | address | third-party | no | 84.2, 559.2, 306.0, 569.2 | drawn rule at y=569.2 (box = the 10 pt of writing room above it) | Custodian zip code (one rule under two captions; right part) |
| p02-cust-tax-id | blank | tax number | third-party | no | 33.8, 596.8, 306.0, 606.8 | drawn rule at y=606.8 (box = the 10 pt of writing room above it) | Custodian tax ID number (section "to be completed by custodian") |
| p02-cust-account | blank | text | third-party | no | 33.8, 634.2, 306.0, 644.2 | drawn rule at y=644.2 (box = the 10 pt of writing room above it) | Custodian account number (section "to be completed by custodian") |
| p02-cust-phone | blank | phone | third-party | no | 33.8, 671.8, 306.0, 681.8 | drawn rule at y=681.8 (box = the 10 pt of writing room above it) | Custodian phone (section "to be completed by custodian") |

Must NOT get a field: the heavy rules above and below the section captions (Non-Custodial Ownership, Custodial Ownership, Custodian Information); the captions above the custodian rules.

### Page 3

### Page 4

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p04-init-natural | initials | initials | investor-individual | no | 33.8, 145.4, 58.1, 155.1 | underscore run of 5 | Initials: a natural person, investing no more than 10% of net worth or income (one of three) |
| p04-init-non-natural | initials | initials | investor-entity | no | 33.8, 193.4, 58.1, 203.1 | underscore run of 5 | Initials: a non-natural person, investing no more than 10% of revenues or net assets (one of three) |
| p04-init-accredited | initials | initials | investor | no | 33.8, 217.4, 58.1, 227.1 | underscore run of 5 | Initials: an accredited investor (one of three) |

Must NOT get a field: the underline of the run-in heading "Operating Agreement" (y 294).

### Page 5

### Page 6

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p06-executed-date | blank | date | investor | no | 89.0, 117.6, 186.8, 127.4 | 3 underscore runs (day, month, year) read as one date; parts give each run | Date of execution: "Executed this __ day of ____, 20__" |
| p06-inv-signature | signature | signature | investor | yes | 33.8, 173.9, 180.0, 183.6 | underscore run of 30 | Signature of investor or authorised signatory (says the name may be typed) |
| p06-inv-date | date | date | investor | no | 62.2, 197.9, 140.2, 207.6 | 2 underscore runs (month and day, year) read as one date; parts give each run | Date beside the investor signature ("Dated: ____, 20__") |
| p06-joint-signature | signature | signature | co-investor | no | 33.8, 233.9, 180.0, 243.6 | underscore run of 30 | Joint signature (investor or authorised signatory) |
| p06-joint-date | date | date | co-investor | no | 62.2, 257.9, 145.1, 267.6 | 2 underscore runs (month and day, year) read as one date; parts give each run | Date beside the joint signature |
| p06-firm-signature | signature | signature | firm | no | 50.3, 365.9, 191.7, 375.6 | underscore run of 29 | Acceptance by the company: signature (may be typed) |
| p06-firm-title | blank | title | firm | no | 48.6, 377.9, 190.0, 387.6 | underscore run of 29 | Acceptance by the company: title of the signer |
| p06-firm-date | date | date | firm | no | 57.3, 389.9, 188.9, 399.6 | underscore run of 27 | Acceptance by the company: date |

Must NOT get a field: the printed words "PLEASE TYPE YOUR NAME TO SIGN" and "SUBSCRIPTION ACCEPTED", the company name and description.
