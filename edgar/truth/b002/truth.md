# Answer sheet: b002 (11 pages)

File: `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b002/doc.pdf`

PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt of writing room above it. Cell or box: its printed edges. Tick box: the printed square.

pdfplumber characters and drawn rules (cand/b002.json); "o" boxes measured as ink at 400 dpi; caption cells measured from caption bottom to rule; every page looked at at 100 dpi; overlays looked at.

## Who signs

Order form (Carey Credit Income Fund - I) converted to landscape pages. The investor and a joint investor initial twelve representations in two labelled columns and sign page 8; the custodian signs and guarantees on page 9; the registered representative completes and signs pages 9-10. No issuer acceptance block.

- Investor pages: [1, 2, 3, 4, 5, 7, 8]
- Firm pages: []
- Co-investor: True
- Third parties: custodian (pages 5 and 9); registered representative / broker-dealer (pages 9-10)

Tick boxes and initials places are printed as the letter "o" (12 pt for tick boxes, 24 pt for initials).

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 6 | 5 | 0 | 1 | 0 | 0 | sure |
| 2 | 15 | 0 | 0 | 14 | 1 | 0 | sure |
| 3 | 5 | 3 | 0 | 2 | 0 | 0 | sure |
| 4 | 35 | 24 | 0 | 11 | 0 | 0 | sure of the tick boxes and the named blanks; two extra short rules (under the UGMA state blank and under "Other") are kept, marked |
| 5 | 19 | 7 | 0 | 12 | 0 | 0 | sure |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 7 | 20 | 0 | 20 | 0 | 0 | 0 | sure |
| 8 | 8 | 0 | 4 | 0 | 2 | 2 | sure |
| 9 | 13 | 0 | 0 | 10 | 2 | 1 | sure; the medallion guarantee rule is read as a third-party signature place (marked) |
| 10 | 2 | 0 | 0 | 0 | 1 | 1 | sure |
| 11 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| all | 123 | 39 | 24 | 50 | 6 | 4 | |

By owner: co-investor 17, investor 70, investor-entity 18, third-party 18

## Doubtful places (3)

- `p04-ugma-state-2` (page 4): a second short rule under "of ____" with no caption of its own; may be the rest of the same blank
- `p04-other-2` (page 4): two rules for one "Other" choice; the second carries the "Please specify" caption
- `p09-medallion` (page 9): a medallion stamp place: a third party's signature guarantee

## Places

### Page 1

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p01-initial | tickbox | tickbox | investor | no | 214.0, 327.2, 219.2, 333.0 | letter "o" printed as a tick box (ink measured at 400 dpi) | Initial investment |
| p01-additional | tickbox | tickbox | investor | no | 214.0, 340.7, 219.2, 346.5 | letter "o" printed as a tick box (ink measured at 400 dpi) | Additional investment |
| p01-check | tickbox | tickbox | investor | no | 214.0, 387.4, 219.2, 393.1 | letter "o" printed as a tick box (ink measured at 400 dpi) | Payment: enclosed check |
| p01-wired | tickbox | tickbox | investor | no | 214.0, 400.9, 219.2, 406.6 | letter "o" printed as a tick box (ink measured at 400 dpi) | Payment: funds wired |
| p01-follow | tickbox | tickbox | investor | no | 214.0, 414.4, 219.2, 420.1 | letter "o" printed as a tick box (ink measured at 400 dpi) | Payment: funds to follow |
| p01-amount | blank | amount | investor | yes | 287.7, 355.6, 372.1, 365.6 | drawn rule at y=365.6 (box = the 10 pt of writing room above it) | Amount of investment |

Must NOT get a field: "FOR PROSPECTUS DATED ____": the issuer completes it before sending; the short rule after the section number "1." and the long rule after the section title (decorative); the vertical column rule.

### Page 2

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p02-inv-name | blank | name | investor | yes | 195.0, 162.9, 556.5, 189.4 | cell: rule at y=189.4 with its caption above it; box = from the caption's bottom down to the rule | Name of investor or trustee |
| p02-inv-ssn | blank | tax number | investor | yes | 565.5, 162.9, 677.2, 189.4 | cell: rule at y=189.4 with its caption above it; box = from the caption's bottom down to the rule | Investor social security number/TIN |
| p02-inv-dob | blank | date | investor | yes | 686.2, 162.9, 758.2, 189.4 | cell: rule at y=189.4 with its caption above it; box = from the caption's bottom down to the rule | Investor date of birth |
| p02-joint-name | blank | name | co-investor | no | 195.0, 206.4, 556.5, 232.9 | cell: rule at y=232.9 with its caption above it; box = from the caption's bottom down to the rule | Name of joint investor or trustee (if applicable) |
| p02-joint-ssn | blank | tax number | co-investor | no | 565.5, 206.4, 677.2, 232.9 | cell: rule at y=232.9 with its caption above it; box = from the caption's bottom down to the rule | Joint investor social security number/TIN |
| p02-joint-dob | blank | date | co-investor | no | 686.2, 206.4, 758.2, 232.9 | cell: rule at y=232.9 with its caption above it; box = from the caption's bottom down to the rule | Joint investor date of birth |
| p02-address | blank | address | investor | yes | 195.0, 255.1, 758.2, 265.1 | cell: rule at y=265.1 with its caption above it; box = from the caption's bottom down to the rule | Residential address (no P.O. boxes) |
| p02-city | blank | text | investor | yes | 195.0, 273.9, 556.5, 292.1 | cell: rule at y=292.1 with its caption above it; box = from the caption's bottom down to the rule | City |
| p02-state | blank | text | investor | yes | 565.5, 273.9, 677.2, 292.1 | cell: rule at y=292.1 with its caption above it; box = from the caption's bottom down to the rule | State |
| p02-zip | blank | text | investor | yes | 686.2, 273.9, 758.2, 292.1 | cell: rule at y=292.1 with its caption above it; box = from the caption's bottom down to the rule | ZIP |
| p02-home-phone | blank | phone | investor | no | 195.0, 300.9, 556.5, 316.1 | cell: rule at y=316.1 with its caption above it; box = from the caption's bottom down to the rule | Home phone |
| p02-alt-phone | blank | phone | investor | no | 565.5, 300.9, 758.2, 316.1 | cell: rule at y=316.1 with its caption above it; box = from the caption's bottom down to the rule | Alternate phone |
| p02-email | blank | email | investor | no | 195.0, 324.9, 758.2, 343.1 | cell: rule at y=343.1 with its caption above it; box = from the caption's bottom down to the rule | Email address |
| p02-paperless-signature | signature | signature | investor | no | 300.0, 474.1, 483.7, 484.1 | drawn rule at y=484.1 (box = the 10 pt of writing room above it) | GO PAPERLESS: signature of investor/trustee to receive documents by e-mail (optional) |
| p02-bd-account | blank | text | investor | no | 339.6, 527.4, 759.7, 537.4 | drawn rule at y=537.4, caption on the rule's left end; box = after the caption, 10 pt above the rule | Investor's account number with broker/dealer (if any) |

Must NOT get a field: section rules after "2." and the title; the short vertical tick marks at the left of each cell (cell edges, part of the cells).

### Page 3

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p03-resident-alien | tickbox | tickbox | investor | no | 225.2, 32.6, 230.4, 38.3 | letter "o" printed as a tick box (ink measured at 400 dpi) | Check if you are a resident alien |
| p03-nonresident-alien | tickbox | tickbox | investor | no | 406.4, 32.6, 411.7, 38.3 | letter "o" printed as a tick box (ink measured at 400 dpi) | Check if you are a non-resident alien (Form W-8BEN required) |
| p03-withholding | tickbox | tickbox | investor | no | 587.7, 32.6, 592.9, 38.3 | letter "o" printed as a tick box (ink measured at 400 dpi) | Check if you are subject to withholding |
| p03-exempt-payee | blank | text | investor | no | 330.5, 69.1, 414.8, 79.1 | drawn rule at y=79.1 (box = the 10 pt of writing room above it) | Exemption payee code (if any) |
| p03-fatca | blank | text | investor | no | 381.6, 90.9, 466.0, 100.9 | drawn rule at y=100.9 (box = the 10 pt of writing room above it) | Exemption from FATCA reporting code (if any) |

Must NOT get a field: footer (mailing addresses) and its rule.

### Page 4

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p04-own-individual | tickbox | tickbox | investor | no | 198.7, 130.1, 203.9, 135.9 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Individual |
| p04-own-jtwros | tickbox | tickbox | investor | no | 458.1, 130.1, 463.3, 135.9 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Joint tenants with right of survivorship |
| p04-own-ugma | tickbox | tickbox | investor | no | 617.9, 130.1, 623.2, 135.9 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Uniform gift / transfers to minors |
| p04-own-tod | tickbox | tickbox | investor | no | 220.3, 146.5, 225.5, 152.3 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Individual: transfer on death |
| p04-own-jtwros-tod | tickbox | tickbox | investor | no | 479.9, 146.5, 485.1, 152.3 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Joint tenants: transfer on death |
| p04-own-community | tickbox | tickbox | investor | no | 198.7, 213.3, 203.9, 219.1 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Community property |
| p04-own-tic | tickbox | tickbox | investor | no | 458.1, 213.3, 463.3, 219.1 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Tenants in common |
| p04-own-other | tickbox | tickbox | investor | no | 617.9, 213.3, 623.2, 219.1 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Other |
| p04-own-taxable-trust | tickbox | tickbox | investor-entity | no | 198.7, 276.3, 203.9, 282.1 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Trust: taxable trust |
| p04-own-exempt-trust | tickbox | tickbox | investor-entity | no | 458.1, 276.3, 463.3, 282.1 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Trust: tax-exempt trust |
| p04-own-pension | tickbox | tickbox | investor-entity | no | 198.7, 392.6, 203.9, 398.3 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Pension or profit sharing plan |
| p04-own-pension-taxable | tickbox | tickbox | investor-entity | no | 325.4, 392.6, 330.7, 398.3 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Pension plan: taxable |
| p04-own-pension-501a | tickbox | tickbox | investor-entity | no | 367.6, 392.6, 372.8, 398.3 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Pension plan: exempt under 501A |
| p04-own-corporation | tickbox | tickbox | investor-entity | no | 198.7, 423.4, 203.9, 429.1 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Corporation |
| p04-own-s-corp | tickbox | tickbox | investor-entity | no | 264.6, 423.4, 269.8, 429.1 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Corporation: S-Corp |
| p04-own-c-corp | tickbox | tickbox | investor-entity | no | 304.6, 423.4, 309.8, 429.1 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Corporation: C-Corp |
| p04-own-partnership | tickbox | tickbox | investor-entity | no | 198.7, 454.1, 203.9, 459.9 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Partnership |
| p04-own-nonprofit | tickbox | tickbox | investor-entity | no | 198.7, 484.7, 203.9, 490.5 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Non-profit organization |
| p04-own-entity-other | tickbox | tickbox | investor-entity | no | 198.7, 507.2, 203.9, 513.0 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Entity: other |
| p04-own-trad-ira | tickbox | tickbox | investor | no | 198.7, 561.2, 203.9, 567.0 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Qualified: traditional IRA |
| p04-own-roth-ira | tickbox | tickbox | investor | no | 272.3, 561.2, 277.6, 567.0 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Qualified: ROTH IRA |
| p04-own-sep-ira | tickbox | tickbox | investor | no | 326.0, 561.2, 331.2, 567.0 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Qualified: SEP IRA |
| p04-own-rollover-ira | tickbox | tickbox | investor | no | 372.1, 561.2, 377.3, 567.0 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Qualified: rollover IRA |
| p04-own-beneficial-ira | tickbox | tickbox | investor | no | 431.5, 561.2, 436.7, 567.0 | letter "o" printed as a tick box (ink measured at 400 dpi) | Form of ownership: Qualified: beneficial IRA |
| p04-ugma-state | blank | text | investor | no | 644.1, 156.1, 719.1, 166.1 | drawn rule at y=166.1 (box = the 10 pt of writing room above it) | Uniform gift/transfers to minors act: state of |
| p04-ugma-state-2 | blank | text | investor | no | 636.0, 164.4, 690.4, 174.4 | drawn rule at y=174.4 (box = the 10 pt of writing room above it) | Second short rule under the UGMA state blank (uncaptioned) (doubt: a second short rule under "of ____" with no caption of its own; may be the rest of the same blank) |
| p04-other | blank | text | investor | no | 657.0, 206.4, 726.4, 216.4 | drawn rule at y=216.4 (box = the 10 pt of writing room above it) | Other form of ownership, which |
| p04-other-2 | blank | text | investor | no | 636.0, 214.6, 681.0, 224.6 | drawn rule at y=224.6 (box = the 10 pt of writing room above it) | Other form of ownership: second rule, "Please specify" under it (doubt: two rules for one "Other" choice; the second carries the "Please specify" caption) |
| p04-trust-name | blank | name | investor-entity | no | 243.0, 291.9, 535.5, 301.9 | drawn rule at y=301.9 (box = the 10 pt of writing room above it) | Name of trust |
| p04-trust-tax-id | blank | tax number | investor-entity | no | 224.5, 309.1, 267.7, 319.1 | drawn rule at y=319.1 (box = the 10 pt of writing room above it) | Trust tax ID # |
| p04-trust-date | blank | date | investor-entity | no | 532.1, 309.1, 603.3, 319.1 | drawn rule at y=319.1 (box = the 10 pt of writing room above it) | Trust date established |
| p04-entity-name | blank | name | investor-entity | no | 413.8, 343.6, 633.2, 353.6 | drawn rule at y=353.6 (box = the 10 pt of writing room above it) | Name of retirement plan, corporation, partnership or other entity |
| p04-entity-tax-id | blank | tax number | investor-entity | no | 224.5, 365.4, 267.7, 375.4 | drawn rule at y=375.4 (box = the 10 pt of writing room above it) | Entity tax ID # |
| p04-entity-date | blank | date | investor-entity | no | 532.1, 365.4, 603.3, 375.4 | drawn rule at y=375.4 (box = the 10 pt of writing room above it) | Entity date established |
| p04-entity-other | blank | text | investor-entity | no | 237.8, 500.4, 309.0, 510.4 | drawn rule at y=510.4 (box = the 10 pt of writing room above it) | Other entity type, please specify |

Must NOT get a field: underlined headings (Non-Qualified Account, Trust Ownership, Entity Ownership, Qualified Account) and the underlined word "one"; section rules; the rule under the entity block (a separator).

### Page 5

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p05-decedent-name | blank | name | investor | no | 236.5, 42.9, 307.8, 52.9 | drawn rule at y=52.9 (box = the 10 pt of writing room above it) | Beneficial IRA decedent name (continues the qualified-account line of the page before) |
| p05-cust-name | blank | name | investor | no | 293.8, 180.9, 411.9, 190.9 | drawn rule at y=190.9 (box = the 10 pt of writing room above it) | Custodian information: custodian name |
| p05-cust-address | blank | address | investor | no | 293.3, 189.1, 411.5, 199.1 | drawn rule at y=199.1 (box = the 10 pt of writing room above it) | Custodian information: mailing address |
| p05-cust-city | blank | address | investor | no | 286.9, 197.4, 412.5, 207.4 | drawn rule at y=207.4 (box = the 10 pt of writing room above it) | Custodian information: city/state/ZIP |
| p05-cust-tax-id | blank | tax number | third-party | no | 567.4, 180.9, 687.4, 190.9 | drawn rule at y=190.9 (box = the 10 pt of writing room above it) | To be completed by the custodian: custodian tax ID # |
| p05-cust-account | blank | text | third-party | no | 571.6, 189.1, 700.9, 199.1 | drawn rule at y=199.1 (box = the 10 pt of writing room above it) | To be completed by the custodian: custodian account # |
| p05-cust-phone | blank | phone | third-party | no | 565.3, 197.4, 685.3, 207.4 | drawn rule at y=207.4 (box = the 10 pt of writing room above it) | To be completed by the custodian: custodian phone # |
| p05-dist-mail | tickbox | tickbox | investor | no | 257.6, 350.6, 262.8, 356.4 | letter "o" printed as a tick box (ink measured at 400 dpi) | Distributions: (a) Mail to investor address (non-custodial) |
| p05-dist-custodial | tickbox | tickbox | investor | no | 257.6, 364.1, 262.8, 369.9 | letter "o" printed as a tick box (ink measured at 400 dpi) | Distributions: (a) Pay to custodial account |
| p05-dist-drip | tickbox | tickbox | investor | no | 257.6, 385.7, 262.8, 391.5 | letter "o" printed as a tick box (ink measured at 400 dpi) | Distributions: (b) Reinvest under the DRIP |
| p05-dist-directed | tickbox | tickbox | investor | no | 257.6, 424.1, 262.8, 429.8 | letter "o" printed as a tick box (ink measured at 400 dpi) | Distributions: (c) Distributions directed to (bank, brokerage firm or person) |
| p05-dist-ach | tickbox | tickbox | investor | no | 461.5, 424.1, 466.7, 429.8 | letter "o" printed as a tick box (ink measured at 400 dpi) | Distributions: (c) Via electronic deposit (ACH) |
| p05-dist-checking | tickbox | tickbox | investor | no | 474.7, 437.6, 479.9, 443.3 | letter "o" printed as a tick box (ink measured at 400 dpi) | Distributions: Checking (attach voided check) |
| p05-dist-savings | tickbox | tickbox | investor | no | 601.7, 437.6, 607.0, 443.3 | letter "o" printed as a tick box (ink measured at 400 dpi) | Distributions: Savings |
| p05-pay-payee | blank | name | investor | no | 331.4, 461.4, 550.7, 471.4 | drawn rule at y=471.4 (box = the 10 pt of writing room above it) | Distributions directed to: Bank, brokerage firm or person |
| p05-pay-address | blank | address | investor | no | 283.5, 469.6, 502.8, 479.6 | drawn rule at y=479.6 (box = the 10 pt of writing room above it) | Distributions directed to: Mailing address |
| p05-pay-city | blank | address | investor | no | 277.0, 477.9, 496.4, 487.9 | drawn rule at y=487.9 (box = the 10 pt of writing room above it) | Distributions directed to: City/state/ZIP |
| p05-pay-account | blank | text | investor | no | 264.7, 486.1, 367.8, 496.1 | drawn rule at y=496.1 (box = the 10 pt of writing room above it) | Distributions directed to: Account # |
| p05-pay-aba | blank | text | investor | no | 476.5, 486.1, 579.6, 496.1 | drawn rule at y=496.1 (box = the 10 pt of writing room above it) | Distributions directed to: Bank ABA # (for ACH only) |

Must NOT get a field: section rules; the second, thicker rule drawn under each "City/State/ZIP" rule is the same blank.

### Page 6

Must NOT get a field: footer only.

### Page 7

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p07-init-a-investor | initials | initials | investor | yes | 203.8, 127.3, 214.0, 138.8 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (a): investor initials (column "Investor") |
| p07-init-a-joint | initials | initials | co-investor | no | 240.5, 127.3, 250.7, 138.8 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (a): joint investor initials (column "Joint Investor") |
| p07-init-b-investor | initials | initials | investor | yes | 203.8, 163.3, 214.0, 174.8 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (b): investor initials (column "Investor") |
| p07-init-b-joint | initials | initials | co-investor | no | 240.5, 163.3, 250.7, 174.8 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (b): joint investor initials (column "Joint Investor") |
| p07-init-c-investor | initials | initials | investor | yes | 203.8, 199.3, 214.0, 210.8 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (c): investor initials (column "Investor") |
| p07-init-c-joint | initials | initials | co-investor | no | 240.5, 199.3, 250.7, 210.8 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (c): joint investor initials (column "Joint Investor") |
| p07-init-d-investor | initials | initials | investor | yes | 203.8, 235.3, 214.0, 246.8 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (d): investor initials (column "Investor") |
| p07-init-d-joint | initials | initials | co-investor | no | 240.5, 235.3, 250.7, 246.8 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (d): joint investor initials (column "Joint Investor") |
| p07-init-e-investor | initials | initials | investor | no | 203.8, 275.0, 214.0, 286.6 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (e): investor initials (column "Investor") |
| p07-init-e-joint | initials | initials | co-investor | no | 240.5, 275.0, 250.7, 286.6 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (e): joint investor initials (column "Joint Investor") |
| p07-init-f-investor | initials | initials | investor | no | 203.8, 311.0, 214.0, 322.6 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (f): investor initials (column "Investor") |
| p07-init-f-joint | initials | initials | co-investor | no | 240.5, 311.0, 250.7, 322.6 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (f): joint investor initials (column "Joint Investor") |
| p07-init-g-investor | initials | initials | investor | no | 203.8, 374.0, 214.0, 385.6 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (g): investor initials (column "Investor") |
| p07-init-g-joint | initials | initials | co-investor | no | 240.5, 374.0, 250.7, 385.6 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (g): joint investor initials (column "Joint Investor") |
| p07-init-h-investor | initials | initials | investor | no | 203.8, 428.8, 214.0, 440.3 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (h): investor initials (column "Investor") |
| p07-init-h-joint | initials | initials | co-investor | no | 240.5, 428.8, 250.7, 440.3 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (h): joint investor initials (column "Joint Investor") |
| p07-init-i-investor | initials | initials | investor | no | 203.8, 478.3, 214.0, 489.8 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (i): investor initials (column "Investor") |
| p07-init-i-joint | initials | initials | co-investor | no | 240.5, 478.3, 250.7, 489.8 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (i): joint investor initials (column "Joint Investor") |
| p07-init-j-investor | initials | initials | investor | no | 203.8, 527.8, 214.0, 539.3 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (j): investor initials (column "Investor") |
| p07-init-j-joint | initials | initials | co-investor | no | 240.5, 527.8, 250.7, 539.3 | large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi) | Representation (j): joint investor initials (column "Joint Investor") |

Must NOT get a field: state-specific notes in the left column; the rule between the general and state-specific representations.

### Page 8

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p08-init-k-investor | initials | initials | investor | no | 203.8, 51.5, 214.0, 63.0 | large letter "o" printed as the initials place (ink measured at 400 dpi) | Representation (k): investor initials |
| p08-init-k-joint | initials | initials | co-investor | no | 240.5, 51.5, 250.7, 63.0 | large letter "o" printed as the initials place (ink measured at 400 dpi) | Representation (k): joint investor initials |
| p08-init-l-investor | initials | initials | investor | no | 203.8, 101.0, 214.0, 112.5 | large letter "o" printed as the initials place (ink measured at 400 dpi) | Representation (l): investor initials |
| p08-init-l-joint | initials | initials | co-investor | no | 240.5, 101.0, 250.7, 112.5 | large letter "o" printed as the initials place (ink measured at 400 dpi) | Representation (l): joint investor initials |
| p08-inv-signature | signature | signature | investor | yes | 307.5, 390.9, 478.1, 400.9 | drawn rule at y=400.9 (box = the 10 pt of writing room above it) | Signature of investor/trustee |
| p08-inv-date | date | date | investor | yes | 686.2, 387.1, 759.7, 397.1 | drawn rule at y=397.1 (box = the 10 pt of writing room above it) | Date beside the investor signature |
| p08-joint-signature | signature | signature | co-investor | no | 307.5, 432.9, 478.1, 442.9 | drawn rule at y=442.9 (box = the 10 pt of writing room above it) | Signature of joint investor/trustee (if applicable) |
| p08-joint-date | date | date | co-investor | no | 686.2, 429.1, 759.7, 439.1 | drawn rule at y=439.1 (box = the 10 pt of writing room above it) | Date beside the joint signature |

Must NOT get a field: bulleted acknowledgements (no box); footer.

### Page 9

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p09-cust-signature | signature | signature | third-party | no | 276.0, 111.9, 446.6, 121.9 | drawn rule at y=121.9 (box = the 10 pt of writing room above it) | Signature of custodian (custodial investments only) |
| p09-cust-date | date | date | third-party | no | 686.2, 108.1, 759.7, 118.1 | drawn rule at y=118.1 (box = the 10 pt of writing room above it) | Date beside the custodian signature |
| p09-medallion | signature | signature | third-party | no | 431.8, 207.9, 602.4, 217.9 | drawn rule at y=217.9 (box = the 10 pt of writing room above it) | Custodian medallion signature guarantee as agent (rule for the stamp/signature) (doubt: a medallion stamp place: a third party's signature guarantee) |
| p09-rr-name | blank | name | third-party | no | 191.2, 303.1, 758.2, 313.1 | cell: rule at y=313.1 with its caption above it; box = from the caption's bottom down to the rule | Registered representative information: Registered representative name(s) |
| p09-bd-name | blank | name | third-party | no | 191.2, 330.1, 758.2, 340.9 | cell: rule at y=340.9 with its caption above it; box = from the caption's bottom down to the rule | Registered representative information: Broker/dealer name |
| p09-rr-number | blank | text | third-party | no | 191.2, 366.9, 342.7, 385.9 | cell: rule at y=385.9 with its caption above it; box = from the caption's bottom down to the rule | Registered representative information: Representative number/ID |
| p09-crd | blank | text | third-party | no | 351.7, 366.9, 758.2, 385.9 | cell: rule at y=385.9 with its caption above it; box = from the caption's bottom down to the rule | Registered representative information: FINRA CRD number (if applicable) |
| p09-rr-address | blank | address | third-party | no | 191.2, 402.9, 758.2, 413.6 | cell: rule at y=413.6 with its caption above it; box = from the caption's bottom down to the rule | Registered representative information: Registered representative address |
| p09-rr-city | blank | text | third-party | no | 191.2, 430.6, 342.7, 441.4 | cell: rule at y=441.4 with its caption above it; box = from the caption's bottom down to the rule | Registered representative information: City |
| p09-rr-state | blank | text | third-party | no | 351.7, 430.6, 470.2, 441.4 | cell: rule at y=441.4 with its caption above it; box = from the caption's bottom down to the rule | Registered representative information: State |
| p09-rr-zip | blank | text | third-party | no | 503.2, 430.6, 758.2, 441.4 | cell: rule at y=441.4 with its caption above it; box = from the caption's bottom down to the rule | Registered representative information: ZIP |
| p09-rr-phone | blank | phone | third-party | no | 191.2, 458.4, 342.7, 468.4 | cell: rule at y=468.4 with its caption above it; box = from the caption's bottom down to the rule | Registered representative information: Telephone number |
| p09-rr-email | blank | email | third-party | no | 351.7, 458.4, 758.2, 468.4 | cell: rule at y=468.4 with its caption above it; box = from the caption's bottom down to the rule | Registered representative information: Email address |

Must NOT get a field: section rules.

### Page 10

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p10-rr-signature | signature | signature | third-party | no | 351.7, 27.1, 447.7, 37.1 | drawn rule at y=37.1 (box = the 10 pt of writing room above it) | Signature of registered representative or advisor |
| p10-rr-date | date | date | third-party | no | 503.2, 27.1, 759.7, 37.1 | drawn rule at y=37.1 (box = the 10 pt of writing room above it) | Date beside the representative signature |

Must NOT get a field: the underline of "the original" (underlined words); mailing addresses (printed).

### Page 11

Must NOT get a field: blank page.
