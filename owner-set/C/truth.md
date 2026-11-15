# Answer sheet: document C (10 pages)

PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt above it. Cell: the centre lines of its four rules. Tick box: the printed square (ink).

pdfplumber characters and drawn lines of the PDF (geom.json); tick squares measured on a 400 dpi render (tick-ink.json); every page looked at at 100 dpi, the form pages again at 170 dpi; overlays looked at.

## For signing

A subscription agreement and investor questionnaire in one form. The investor completes and signs it; a joint investor signs beside them; a custodian, an adviser representative and the adviser firm sign their own sections where they apply; one acceptance block closes the document.

- Investor signature block: yes, page 7 (two boxed signatures with a date each, on one row: investor, and joint investor or second signer)
- Firm block: in doubt, page 10 (the only acceptance block is captioned for a managing dealer, not for the company)
- Second investor: yes, 5 places (pages 2 and 7)
- Third parties: 30 places: custodian (page 3); adviser representative and adviser firm (pages 8 and 10)
- Individual and entity: not separate signature blocks; separated only on page 5: four initials for a natural person, nine for an entity

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 4 | 2 | 0 | 2 | 0 | 0 | sure |
| 2 | 41 | 16 | 1 | 24 | 0 | 0 | sure (one judgement: the date-of-birth cell under two captions is one place) |
| 3 | 36 | 18 | 0 | 16 | 1 | 1 | sure of every place; the stamp box is a judgement (a place, a third party's) |
| 4 | 14 | 7 | 0 | 7 | 0 | 0 | sure |
| 5 | 13 | 0 | 13 | 0 | 0 | 0 | sure |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 7 | 4 | 0 | 0 | 0 | 2 | 2 | sure |
| 8 | 18 | 0 | 0 | 18 | 0 | 0 | sure |
| 9 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 10 | 8 | 0 | 0 | 1 | 4 | 3 | sure of every place; whose the acceptance block is, is the open question |
| all | 138 | 43 | 14 | 68 | 7 | 6 | |

By owner: co-investor 5, investor 88, investor-entity 9, investor-individual 4, third-party 30, unclear 2

## Places

### Page 1

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p01-investor-name | blank | name | investor | yes | 367.6, 304.4, 571.9, 314.4 | drawn rule at y=314.4 (box = the 10 pt of writing room above it) | Investor name (blank after its label, a drawn rule under tab space) |
| p01-amount | blank | amount | investor | yes | 33.4, 569.7, 168.4, 578.7 | underscore run of 30 | Total purchase amount (blank after a currency sign, words follow on the line) |
| p01-class-a | tickbox | tickbox | investor | no | 29.7, 597.2, 36.2, 603.7 | box character U+2610 (measured) | Unit class, first choice |
| p01-class-b | tickbox | tickbox | investor | no | 92.3, 597.2, 98.6, 603.7 | box character U+2610 (measured) | Unit class, second choice |

Must NOT get a field: the rule under the title block (y 99.2, full width); the printed wire and mailing details (already filled in by the sponsor); the underline drawn under the amount underscore run is the same blank, not a second one; page header and "page n of 10" footer.

### Page 2

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p02-pay-1 | tickbox | tickbox | investor | no | 29.7, 61.4, 36.2, 67.9 | box character U+2610 (measured) | Method of payment: funds enclosed |
| p02-pay-2 | tickbox | tickbox | investor | no | 101.7, 61.4, 108.2, 67.9 | box character U+2610 (measured) | Method of payment: funds wired |
| p02-pay-3 | tickbox | tickbox | investor | no | 173.7, 61.4, 180.2, 67.9 | box character U+2610 (measured) | Method of payment: issued by custodian |
| p02-cat-1 | tickbox | tickbox | investor | no | 29.7, 90.5, 36.2, 97.0 | box character U+2610 (measured) | Investor category: through an adviser, fee-based |
| p02-cat-2 | tickbox | tickbox | investor | no | 29.7, 103.5, 36.2, 110.0 | box character U+2610 (measured) | Investor category: institutional investor |
| p02-cat-3 | tickbox | tickbox | investor | no | 29.7, 116.5, 36.2, 122.9 | box character U+2610 (measured) | Investor category: participating adviser, own account or family |
| p02-cat-4 | tickbox | tickbox | investor | no | 29.7, 151.9, 36.2, 158.4 | box character U+2610 (measured) | Investor category: officer or employee of the company or manager, or family |
| p02-cat-3-relative | blank | text | investor | no | 303.3, 138.8, 456.3, 147.8 | underscore run of 34 | Relationship and name of relative (under category 3; blank at the end of an indented sentence) |
| p02-cat-4-relative | blank | text | investor | no | 296.5, 172.4, 449.5, 181.4 | underscore run of 34 | Relationship and name of relative (under category 4) |
| p02-title-1 | tickbox | tickbox | investor | no | 335.6, 219.3, 341.4, 225.0 | box character U+2610 (computed (a connector line touches the square)) | Title: Mr |
| p02-title-2 | tickbox | tickbox | investor | no | 371.6, 219.3, 377.4, 225.0 | box character U+2610 (computed (a connector line touches the square)) | Title: Mrs |
| p02-title-3 | tickbox | tickbox | investor | no | 412.1, 219.3, 417.9, 225.0 | box character U+2610 (computed (a connector line touches the square)) | Title: Ms |
| p02-title-4 | tickbox | tickbox | investor | no | 452.6, 219.3, 458.4, 225.0 | box character U+2610 (computed (a connector line touches the square)) | Title: Other |
| p02-title-other | blank | text | investor | no | 480.5, 219.6, 582.0, 226.6 | underscore run of 29 | Title: other, which (underscores after the last tick box, on the caption row above the name cell) |
| p02-name | blank | name | investor | yes | 37.9, 227.2, 583.2, 238.2 | drawn cell (four rules, 0.5 pt) | Name of investor, trustee or authorised signer |
| p02-joint-name | blank | name | co-investor | no | 37.9, 252.7, 583.2, 263.6 | drawn cell (four rules, 0.5 pt) | Name of joint investor (if applicable) |
| p02-entity-name | blank | name | investor (also right: investor-entity) | no | 37.9, 278.1, 583.2, 288.9 | drawn cell (four rules, 0.5 pt) | Name of trust, business or plan (if applicable) |
| p02-street | blank | address | investor | yes | 37.9, 315.9, 583.2, 328.6 | drawn cell (four rules, 0.5 pt) | Street address (no PO box) |
| p02-city | blank | text | investor | yes | 37.8, 341.5, 375.7, 352.8 | drawn cell (four rules, 1 pt) | City |
| p02-state | blank | text | investor | yes | 388.2, 341.5, 483.6, 352.8 | drawn cell (four rules, 1 pt) | State |
| p02-zip | blank | text | investor | yes | 496.1, 341.5, 583.2, 352.8 | drawn cell (four rules, 1 pt) | Zip code |
| p02-home-phone | blank | phone | investor | yes | 37.8, 365.9, 317.3, 377.2 | drawn cell (four rules, 1 pt) | Home phone |
| p02-business-phone | blank | phone | investor | no | 328.1, 365.9, 483.6, 377.2 | drawn cell (four rules, 1 pt) | Business phone |
| p02-phone-ext | blank | text | investor | no | 496.1, 365.9, 583.2, 377.2 | drawn cell (four rules, 1 pt) | Phone extension |
| p02-alt-address | blank | address | investor | no | 37.9, 404.4, 583.2, 416.9 | drawn cell (four rules, 0.5 pt) | Alternate mailing address or PO box (if applicable) |
| p02-alt-city | blank | text | investor | no | 37.8, 429.7, 375.7, 441.1 | drawn cell (four rules, 1 pt) | City (alternate address) |
| p02-alt-state | blank | text | investor | no | 388.2, 429.7, 483.6, 441.1 | drawn cell (four rules, 1 pt) | State (alternate address) |
| p02-alt-zip | blank | text | investor | no | 496.1, 429.7, 583.2, 441.1 | drawn cell (four rules, 1 pt) | Zip code (alternate address) |
| p02-dob | blank | date | investor | yes | 37.3, 484.9, 249.6, 495.1 | drawn cell (four rules, 1 pt) | Investor date of birth, or trust or entity date (one cell under two captions) |
| p02-joint-dob | blank | date | co-investor | no | 262.1, 484.9, 434.1, 495.1 | drawn cell (four rules, 1 pt) | Joint investor or authorised signer date of birth (if applicable) |
| p02-entity-tax-id | blank | tax number | investor (also right: investor-entity) | no | 446.6, 484.9, 583.2, 495.1 | drawn cell (four rules, 1 pt) | Entity tax ID number (if applicable) |
| p02-ssn | blank | tax number | investor | yes | 37.3, 525.4, 209.1, 535.6 | drawn cell (four rules, 1 pt) | Investor social security number |
| p02-joint-ssn | blank | tax number | co-investor | no | 221.5, 525.4, 393.6, 535.6 | drawn cell (four rules, 1 pt) | Joint investor or authorised signer social security number (if applicable) |
| p02-email | blank | email | investor | no | 406.0, 525.4, 583.2, 535.6 | drawn cell (four rules, 1 pt) | Email address |
| p02-citizen-1 | tickbox | tickbox | investor | no | 29.7, 574.4, 36.9, 581.6 | box character U+2610 (measured) | Citizenship: US citizen |
| p02-citizen-2 | tickbox | tickbox | investor | no | 146.7, 575.1, 153.2, 581.6 | box character U+2610 (measured) | Citizenship: resident alien |
| p02-citizen-3 | tickbox | tickbox | investor | no | 263.7, 575.1, 270.2, 581.6 | box character U+2610 (measured) | Citizenship: non-resident alien |
| p02-country | blank | text | investor | no | 428.2, 574.6, 581.2, 583.6 | underscore run of 34 | Country of origin (underscores after the third citizenship box) |
| p02-erisa-yes | tickbox | tickbox | investor | no | 479.7, 616.1, 486.2, 622.6 | box character U+2610 (measured) | ERISA plan: yes |
| p02-erisa-no | tickbox | tickbox | investor | no | 511.2, 616.1, 517.7, 622.6 | box character U+2610 (measured) | ERISA plan: no |
| p02-edelivery-initials | initials | initials | investor | no | 29.9, 648.6, 65.9, 684.6 | drawn square (one closed path, 36 x 36 pt) | Initials to choose electronic delivery (a 36 pt drawn square left of the paragraph; the heading says to insert initials in the box) |

Must NOT get a field: the section rule at y 190.1 (full width, drawn twice); the 12 pt gaps between cells of a row (they have a left and right rule only); the last line of the page: a caption ending in a colon with NO blank after it on this page; its box is the first thing on page 3; captions, headings, header and footer.

### Page 3

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p03-edelivery-email | blank | email | investor | no | 46.9, 48.1, 357.6, 70.2 | drawn cell (four rules, 0.5 pt) | Email address for electronic delivery (the caption is the last line of page 2; nothing is printed beside the box on this page) |
| p03-own-01 | tickbox | tickbox | investor | no | 29.7, 102.2, 35.3, 108.0 | box character U+2610 (measured) | Non-custodial ownership: individual |
| p03-own-02 | tickbox | tickbox | investor | no | 29.7, 122.9, 35.3, 128.7 | box character U+2610 (measured) | Non-custodial ownership: joint tenants with right of survivorship |
| p03-own-03 | tickbox | tickbox | investor | no | 29.7, 152.8, 35.3, 158.6 | box character U+2610 (measured) | Non-custodial ownership: tenants in common |
| p03-own-04 | tickbox | tickbox | investor | no | 29.7, 173.5, 35.3, 179.3 | box character U+2610 (measured) | Non-custodial ownership: community property |
| p03-own-05 | tickbox | tickbox | investor | no | 168.8, 102.2, 174.6, 108.0 | box character U+2610 (measured) | Non-custodial ownership: pension, profit sharing or 401k |
| p03-own-06 | tickbox | tickbox | investor | no | 168.9, 128.0, 174.6, 133.8 | box character U+2610 (computed (a connector line touches the square)) | Non-custodial ownership: trust |
| p03-own-07 | tickbox | tickbox | investor | no | 181.5, 166.0, 187.3, 171.8 | box character U+2610 (computed (a connector line touches the square)) | Non-custodial ownership: trust: currently revocable |
| p03-own-08 | tickbox | tickbox | investor | no | 181.5, 175.7, 187.3, 181.5 | box character U+2610 (computed (a connector line touches the square)) | Non-custodial ownership: trust: irrevocable |
| p03-own-09 | tickbox | tickbox | investor | no | 321.8, 102.2, 327.6, 108.0 | box character U+2610 (computed (a connector line touches the square)) | Non-custodial ownership: corporation |
| p03-own-10 | tickbox | tickbox | investor | no | 333.9, 133.3, 339.7, 139.1 | box character U+2610 (computed (a connector line touches the square)) | Non-custodial ownership: corporation: S |
| p03-own-11 | tickbox | tickbox | investor | no | 333.9, 143.0, 339.7, 148.8 | box character U+2610 (computed (a connector line touches the square)) | Non-custodial ownership: corporation: C |
| p03-own-12 | tickbox | tickbox | investor | no | 445.0, 102.2, 450.7, 108.0 | box character U+2610 (measured) | Non-custodial ownership: gift or transfers to minors |
| p03-own-13 | tickbox | tickbox | investor | no | 445.0, 129.1, 450.7, 134.8 | box character U+2610 (measured) | Non-custodial ownership: partnership or LLC |
| p03-own-14 | tickbox | tickbox | investor | no | 445.0, 162.9, 450.7, 168.7 | box character U+2610 (measured) | Non-custodial ownership: other |
| p03-trust-date | blank | date | investor (also right: investor-entity) | no | 253.7, 142.3, 312.1, 152.3 | drawn rule at y=152.3 (box = the 10 pt of writing room above it) | Date the trust was established (a short rule with its caption UNDER it) |
| p03-own-other | blank | text | investor | no | 478.5, 159.7, 579.6, 169.7 | drawn rule at y=169.7 (box = the 10 pt of writing room above it) | Other form of ownership, which (rule after the box label; "(specify)" under it) |
| p03-cust-1 | tickbox | tickbox | investor | no | 29.7, 209.5, 35.3, 215.3 | box character U+2610 (measured) | Custodial ownership: IRA |
| p03-cust-2 | tickbox | tickbox | investor | no | 155.7, 209.5, 161.3, 215.3 | box character U+2610 (measured) | Custodial ownership: qualified pension or profit sharing plan |
| p03-cust-3 | tickbox | tickbox | investor | no | 317.7, 209.5, 323.3, 215.3 | box character U+2610 (measured) | Custodial ownership: non-qualified custodian account |
| p03-cust-4 | tickbox | tickbox | investor | no | 461.7, 209.5, 467.3, 215.3 | box character U+2610 (measured) | Custodial ownership: other |
| p03-ira-type | blank | text | investor | no | 54.8, 209.0, 138.8, 217.0 | underscore run of 21 | Type of IRA (underscores after the box label; "(type)" under it) |
| p03-cust-other | blank | text | investor | no | 495.2, 209.0, 523.2, 217.0 | underscore run of 7 | Other custodial ownership, which (7 underscores; "(specify)" under it) |
| p03-custodian-name | blank | name | investor | no (custodial ownership chosen) | 28.4, 246.9, 384.5, 261.3 | drawn cell (four rules, 0.75 pt) | Name of custodian or trustee (printed "required", applies to custodial ownership only) |
| p03-inherited-name | blank | name | investor | no (custodial ownership chosen) | 397.8, 246.9, 583.1, 261.3 | drawn cell (four rules, 0.75 pt) | Inherited or beneficiary IRA: the deceased's name (printed "required", applies to an inherited IRA only) |
| p03-cust-address | blank | address | investor | no (custodial ownership chosen) | 29.2, 279.3, 582.4, 293.7 | drawn cell (four rules, 0.75 pt) | Custodian mailing address |
| p03-cust-city | blank | text | investor | no (custodial ownership chosen) | 28.4, 303.7, 384.5, 318.1 | drawn cell (four rules, 0.75 pt) | City (custodian) |
| p03-cust-state | blank | text | investor | no (custodial ownership chosen) | 397.1, 303.7, 479.0, 318.1 | drawn cell (four rules, 0.75 pt) | State (custodian) |
| p03-cust-zip | blank | text | investor | no (custodial ownership chosen) | 491.6, 303.7, 583.1, 318.1 | drawn cell (four rules, 0.75 pt) | Zip code (custodian) |
| p03-cust-phone | blank | phone | investor | no (custodial ownership chosen) | 28.9, 335.9, 213.6, 350.4 | drawn cell (four rules, 0.5 pt) | Business phone (custodian) |
| p03-custodian-tax-id | blank | tax number | third-party | no | 29.2, 398.9, 254.0, 413.3 | drawn cell (four rules, 0.75 pt) | Custodian tax ID (section the custodian completes) |
| p03-custodian-account | blank | text | third-party | no | 266.6, 398.9, 582.4, 413.3 | drawn cell (four rules, 0.75 pt) | Custodian account number |
| p03-custodian-admin-name | blank | name | third-party | no | 29.2, 422.1, 582.4, 436.5 | drawn cell (four rules, 0.75 pt) | Name of custodian or other administrator |
| p03-custodian-medallion | blank | stamp | third-party | no | 28.9, 445.6, 254.3, 503.4 | drawn cell (four rules, 1.5 pt) | Medallion signature guarantee (a 58 pt tall box for a bank stamp) |
| p03-custodian-signature | signature | signature | third-party | no | 266.6, 445.3, 460.4, 459.7 | drawn cell (four rules, 0.75 pt) | Signature of custodian (if applicable) |
| p03-custodian-date | date | date | third-party | no | 471.6, 445.3, 582.4, 459.7 | drawn cell (four rules, 0.75 pt) | Date beside the custodian signature |

Must NOT get a field: the two small brackets that join a parent box to its sub-choices (two 9 pt rules each at x 325-334 and x 172-182): connectors, not boxes; the section rules at y 196.7, 353.2 and 511.7 (full width); the small captions under blanks ("type", "specify", the note about documents); the bold note right of the stamp box; the 12 pt gaps between cells.

### Page 4

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p04-dist-cash | tickbox | tickbox | investor | no | 52.2, 83.3, 57.8, 89.1 | box character U+2610 (measured) | Distributions: all in cash (box at the start of an underlined sentence) |
| p04-dist-half | tickbox | tickbox | investor | no | 52.2, 108.2, 57.8, 113.9 | box character U+2610 (measured) | Distributions: half cash, half reinvested |
| p04-pay-1 | tickbox | tickbox | investor | no | 311.0, 172.8, 316.7, 178.6 | box character U+2610 (computed (a connector line touches the square)) | Cash distributions by: direct deposit |
| p04-pay-2 | tickbox | tickbox | investor | no | 321.9, 190.6, 327.7, 196.3 | box character U+2610 (computed (a connector line touches the square)) | Cash distributions by: direct deposit: checking |
| p04-pay-3 | tickbox | tickbox | investor | no | 321.9, 200.3, 327.7, 206.0 | box character U+2610 (computed (a connector line touches the square)) | Cash distributions by: direct deposit: savings |
| p04-pay-4 | tickbox | tickbox | investor | no | 311.0, 209.9, 316.6, 215.6 | box character U+2610 (measured) | Cash distributions by: mail to alternate address |
| p04-pay-5 | tickbox | tickbox | investor | no | 311.0, 219.7, 316.7, 225.4 | box character U+2610 (computed (a connector line touches the square)) | Cash distributions by: mail to street address |
| p04-bank-name | blank | name | investor | no (cash distributions chosen) | 38.2, 227.8, 582.4, 242.2 | drawn cell (four rules, 0.75 pt) | Name of bank, brokerage firm or individual (its caption is in the left column, 28 pt above, with tick boxes in the right column between) |
| p04-alt-address | blank | address | investor | no (cash distributions chosen) | 38.2, 252.2, 582.4, 266.6 | drawn cell (four rules, 0.75 pt) | Alternate address (optional) |
| p04-city | blank | text | investor | no (cash distributions chosen) | 37.5, 276.5, 407.2, 290.9 | drawn cell (four rules, 0.75 pt) | City |
| p04-state | blank | text | investor | no (cash distributions chosen) | 415.1, 276.5, 501.5, 290.9 | drawn cell (four rules, 0.75 pt) | State |
| p04-zip | blank | text | investor | no (cash distributions chosen) | 509.8, 276.5, 583.1, 290.9 | drawn cell (four rules, 0.75 pt) | Zip code |
| p04-aba | blank | text | investor | no (cash distributions chosen) | 37.5, 308.9, 226.6, 323.3 | drawn cell (four rules, 0.75 pt) | Bank routing number (two cells share one frame, split by a rule) |
| p04-account | blank | text | investor | no (cash distributions chosen) | 226.6, 308.9, 583.1, 323.3 | drawn cell (four rules, 0.75 pt) | Account number |

Must NOT get a field: four underlines of the two coloured sentences (y 90.1, 99.6, 115.0, 124.5): underlined words, not blanks; the bracket joining the deposit box to its two sub-choices (x 315-323); the underline of the run-in heading of the small-print paragraph (y 335.0); the large bold note under it.

### Page 5

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p05-init-1a | initials | initials | investor-individual | no | 55.9, 116.1, 82.6, 124.1 | underscore run of 7 | Accreditation, natural person, item a (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-1b | initials | initials | investor-individual | no | 55.9, 126.5, 82.6, 134.5 | underscore run of 7 | Accreditation, natural person, item b (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-1c | initials | initials | investor-individual | no | 55.9, 147.2, 82.6, 155.2 | underscore run of 7 | Accreditation, natural person, item c (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-1d | initials | initials | investor-individual | no | 55.9, 167.9, 82.6, 175.9 | underscore run of 7 | Accreditation, natural person, item d (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-2a | initials | initials | investor-entity | no | 55.9, 188.6, 82.6, 196.6 | underscore run of 7 | Accreditation, entity, item a (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-2b | initials | initials | investor-entity | no | 55.9, 281.7, 82.6, 289.7 | underscore run of 7 | Accreditation, entity, item b (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-2c | initials | initials | investor-entity | no | 55.9, 292.1, 82.6, 300.1 | underscore run of 7 | Accreditation, entity, item c (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-2d | initials | initials | investor-entity | no | 55.9, 323.1, 82.6, 331.1 | underscore run of 7 | Accreditation, entity, item d (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-2e | initials | initials | investor-entity | no | 55.9, 354.2, 82.6, 362.2 | underscore run of 7 | Accreditation, entity, item e (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-2f | initials | initials | investor-entity | no | 55.9, 374.9, 82.6, 382.9 | underscore run of 7 | Accreditation, entity, item f (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-2g | initials | initials | investor-entity | no | 55.9, 395.6, 82.6, 403.6 | underscore run of 7 | Accreditation, entity, item g (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-2h | initials | initials | investor-entity | no | 55.9, 416.3, 82.6, 424.3 | underscore run of 7 | Accreditation, entity, item h (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |
| p05-init-2i | initials | initials | investor-entity | no | 55.9, 457.7, 82.6, 465.7 | underscore run of 7 | Accreditation, entity, item i (7 bold underscores at the start of a list item; the heading says to initial as appropriate) |

Must NOT get a field: three underlines of words in the instructions (y 98.5, 112.9, 185.3); the rule drawn under each underscore run is the same blank; the footnote rule (y 654) and the two footnotes; four link annotations on the footnote marks (not form fields).

### Page 6

Must NOT get a field: prose only: no place on this page.

### Page 7

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p07-investor-signature | signature | signature | investor | yes | 28.4, 515.0, 182.0, 529.4 | drawn cell (four rules, 0.75 pt) | Signature of investor, trustee or authorised signer (three-line caption above the cell) |
| p07-investor-date | date | date | investor | yes | 194.7, 515.0, 276.5, 529.4 | drawn cell (four rules, 0.75 pt) | Date beside the investor signature |
| p07-joint-signature | signature | signature | co-investor | yes | 289.2, 515.0, 487.9, 529.4 | drawn cell (four rules, 0.75 pt) | Signature of joint investor, trustee, authorised signer or beneficial owner |
| p07-joint-date | date | date | co-investor | yes | 500.8, 515.0, 583.1, 529.4 | drawn cell (four rules, 0.75 pt) | Date beside the second signature |

Must NOT get a field: prose above; nothing else is printed to complete.

### Page 8

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p08-ria-firm-name | blank | name | third-party | no | 29.2, 122.6, 321.4, 137.0 | drawn cell (four rules, 0.75 pt) | Adviser firm name (section the adviser representative completes) |
| p08-ria-crd | blank | text | third-party | no | 334.2, 122.6, 582.4, 137.0 | drawn cell (four rules, 0.75 pt) | Adviser registration (CRD) number (section the adviser representative completes) |
| p08-ria-firm-address | blank | address | third-party | no | 29.2, 151.1, 582.4, 165.5 | drawn cell (four rules, 0.75 pt) | Adviser firm address (section the adviser representative completes) |
| p08-ria-firm-city | blank | text | third-party | no | 29.2, 182.6, 379.9, 197.0 | drawn cell (four rules, 0.75 pt) | City (section the adviser representative completes) |
| p08-ria-firm-state | blank | text | third-party | no | 392.6, 182.6, 479.0, 197.0 | drawn cell (four rules, 0.75 pt) | State (section the adviser representative completes) |
| p08-ria-firm-zip | blank | text | third-party | no | 491.6, 182.6, 582.4, 197.0 | drawn cell (four rules, 0.75 pt) | Zip code (section the adviser representative completes) |
| p08-ria-firm-phone | blank | phone | third-party | no | 29.2, 211.1, 379.9, 225.5 | drawn cell (four rules, 0.75 pt) | Business phone (section the adviser representative completes) |
| p08-ria-firm-fax | blank | phone | third-party | no | 392.6, 211.1, 582.4, 225.5 | drawn cell (four rules, 0.75 pt) | Fax number (section the adviser representative completes) |
| p08-ria-rep-name | blank | name | third-party | no | 29.2, 239.6, 411.4, 254.0 | drawn cell (four rules, 0.75 pt) | Representative name(s) (section the adviser representative completes) |
| p08-ria-rep-number | blank | text | third-party | no | 424.2, 239.6, 582.4, 254.0 | drawn cell (four rules, 0.75 pt) | Representative number (section the adviser representative completes) |
| p08-ria-rep-address | blank | address | third-party | no | 29.2, 268.1, 411.4, 282.5 | drawn cell (four rules, 0.75 pt) | Representative address (section the adviser representative completes) |
| p08-ria-branch | blank | text | third-party | no | 424.2, 268.1, 582.4, 282.5 | drawn cell (four rules, 0.75 pt) | Branch ID (section the adviser representative completes) |
| p08-ria-rep-city | blank | text | third-party | no | 29.2, 296.6, 379.9, 311.0 | drawn cell (four rules, 0.75 pt) | City (section the adviser representative completes) |
| p08-ria-rep-state | blank | text | third-party | no | 392.6, 296.6, 479.0, 311.0 | drawn cell (four rules, 0.75 pt) | State (section the adviser representative completes) |
| p08-ria-rep-zip | blank | text | third-party | no | 491.6, 296.6, 582.4, 311.0 | drawn cell (four rules, 0.75 pt) | Zip code (section the adviser representative completes) |
| p08-ria-rep-phone | blank | phone | third-party | no | 29.2, 325.1, 379.9, 339.5 | drawn cell (four rules, 0.75 pt) | Business phone (section the adviser representative completes) |
| p08-ria-rep-fax | blank | phone | third-party | no | 392.6, 325.1, 582.4, 339.5 | drawn cell (four rules, 0.75 pt) | Fax number (section the adviser representative completes) |
| p08-ria-rep-email | blank | email | third-party | no | 28.4, 353.6, 583.1, 368.0 | drawn cell (four rules, 0.75 pt) | Email address (section the adviser representative completes) |

Must NOT get a field: headings and the paragraph above; nothing else.

### Page 9

Must NOT get a field: prose only: no place on this page.

### Page 10

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p10-ria-rep-signature-1 | signature | signature | third-party | no | 28.4, 411.1, 190.9, 425.5 | drawn cell (four rules, 0.75 pt) | Signature of adviser representative, first box (a small x is printed inside) |
| p10-ria-rep-signature-2 | signature | signature | third-party | no | 194.7, 411.1, 339.4, 425.5 | drawn cell (four rules, 0.75 pt) | Signature of adviser representative, second box (a small x is printed inside) |
| p10-ria-investor-state | blank | text | third-party | no | 344.9, 411.1, 469.9, 425.5 | drawn cell (four rules, 0.75 pt) | Investor's state of residence, on the adviser's signature row |
| p10-ria-rep-date | date | date | third-party | no | 482.8, 411.1, 583.1, 425.5 | drawn cell (four rules, 0.75 pt) | Date beside the adviser representative signature |
| p10-ria-signature | signature | signature | third-party | no | 28.4, 468.2, 469.9, 482.6 | drawn cell (four rules, 0.75 pt) | Signature of the adviser firm (if required) |
| p10-ria-date | date | date | third-party | no | 482.8, 468.2, 583.1, 482.6 | drawn cell (four rules, 0.75 pt) | Date beside the adviser firm signature |
| p10-acceptance-signature | signature | signature | unclear (also right: firm, third-party) | no | 28.4, 597.6, 469.9, 612.0 | drawn cell (four rules, 0.75 pt) | Acceptance by a "managing dealer": the only acceptance block in the document |
| p10-acceptance-date | date | date | unclear (also right: firm, third-party) | no | 482.8, 597.6, 583.1, 612.0 | drawn cell (four rules, 0.75 pt) | Date beside the acceptance signature |

Must NOT get a field: the small x printed inside four signature boxes (a "sign here" mark, part of the box); the bold reminder between the blocks; prose above.
