# Answer sheet: b083 (30 pages)

File: `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b083/doc.pdf`

PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt of writing room above it. Cell or box: its printed edges. Tick box: the printed square.

Embedded pictures decoded at their own resolution (pdfimages) and mapped through each image's placement; combs, squares and light rules found as ink components and white cells on grey (picfields.py); text-layer rules from pdfplumber; shadow squares measured on 200 dpi renders; overlays looked at.

## Who signs

Superfund Gold L.P. subscription documents (Exhibit D-G of a prospectus): RIA page, subscription agreement and power of attorney, suitability form with 14 initial boxes, dollar-cost-averaging addendum, request for transfer, additional-investment form and series-exchange form. Form fields are pictures (combs) inside a text PDF. The general partner's acceptance is not a signature place.

- Investor pages: [4, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 21, 23, 24, 25, 27]
- Firm pages: []
- Co-investor: True
- Third parties: registered investment advisor (page 4); broker-dealer: registered representative and principal (pages 9, 19, 24, 28); transferee in the request for transfer (page 21)

Combs printed as pictures; each comb (or each group split by dashes or commas) is one place. Several small choice boxes are shadow squares drawn on the text layer.

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 2 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 3 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 4 | 20 | 3 | 0 | 13 | 2 | 2 | sure; the RIA rows are captioned "to be completed by registered investment advisor" (third party) |
| 5 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 7 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 8 | 80 | 22 | 0 | 58 | 0 | 0 | sure of every place; combs split where the printed comb is interrupted (city/state/zip, phone groups) |
| 9 | 10 | 0 | 0 | 2 | 4 | 4 | sure |
| 10 | 4 | 4 | 0 | 0 | 0 | 0 | sure |
| 11 | 4 | 0 | 0 | 0 | 2 | 2 | sure |
| 12 | 27 | 14 | 0 | 13 | 0 | 0 | sure |
| 13 | 13 | 3 | 0 | 4 | 3 | 3 | sure |
| 14 | 10 | 0 | 10 | 0 | 0 | 0 | sure; one grey box at the foot of the left column has no text beside it (kept, marked) |
| 15 | 7 | 0 | 5 | 2 | 0 | 0 | sure |
| 16 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 17 | 8 | 4 | 0 | 4 | 0 | 0 | sure; the four small choice boxes are drawn as shadow squares on the text layer (measured on a render) |
| 18 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 19 | 37 | 9 | 0 | 20 | 5 | 3 | sure |
| 20 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 21 | 43 | 2 | 0 | 29 | 6 | 6 | sure of the places; whose the transferee places are (third party: the person receiving the units) is a judgement |
| 22 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 23 | 63 | 5 | 0 | 58 | 0 | 0 | sure; the five choice boxes in the paragraphs are shadow squares measured on a render |
| 24 | 27 | 17 | 0 | 2 | 4 | 4 | sure |
| 25 | 18 | 2 | 0 | 16 | 0 | 0 | sure |
| 26 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 27 | 8 | 2 | 0 | 2 | 2 | 2 | sure |
| 28 | 7 | 0 | 0 | 3 | 2 | 2 | sure |
| 29 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| 30 | 0 | 0 | 0 | 0 | 0 | 0 | sure |
| all | 386 | 87 | 15 | 226 | 30 | 28 | |

By owner: co-investor 65, investor 219, investor-entity 36, third-party 66

## Doubtful places (11)

- `p09-joint-signature` (page 9): captioned joint limited partner OR custodian
- `p10-units-a` (page 10): letter "o" in running text used as a choice box
- `p10-units-b` (page 10): letter "o" in running text used as a choice box
- `p10-escrow-a` (page 10): letter "o" in running text used as a choice box
- `p10-escrow-b` (page 10): letter "o" in running text used as a choice box
- `p14-init-orphan` (page 14): no representation printed beside it (item 7 starts the next page with its own box); a stray box
- `p19-joint-last-name` (page 19): captioned joint limited partner OR custodian
- `p19-bd-firm-2` (page 19): an uncaptioned second row under the firm name
- `p27-joint-name` (page 27): captioned joint LP OR custodian OR trustee
- `p27-bd-series-a` (page 27): inside the broker-dealer certification
- `p27-bd-series-b` (page 27): inside the broker-dealer certification

## Places

### Page 1

Must NOT get a field: "prospectus dated ____, 2008": the issuer completes it.

### Page 2

Must NOT get a field: prose, instructions or logos only; no place.

### Page 3

Must NOT get a field: prose, instructions or logos only; no place.

### Page 4

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p04-ria-investor-name | blank | name | third-party | no | 203.8, 280.3, 541.8, 293.7 | comb/box printed in a picture (im-001.png pixels [179, 0, 634, 18]) | To be completed by the registered investment advisor: Investor name |
| p04-ria-firm | blank | name | third-party | no | 203.8, 291.5, 541.8, 304.1 | comb/box printed in a picture (im-001.png pixels [179, 15, 634, 32]) | To be completed by the registered investment advisor: Investment advisor firm name |
| p04-ria-reg-number | blank | text | third-party | no | 203.8, 304.9, 541.8, 316.0 | comb/box printed in a picture (im-001.png pixels [179, 33, 634, 48]) | To be completed by the registered investment advisor: Investment advisor registration number |
| p04-ria-rep-name | blank | name | third-party | no | 203.8, 316.7, 541.8, 329.4 | comb/box printed in a picture (im-001.png pixels [179, 49, 634, 66]) | To be completed by the registered investment advisor: Investment advisor representative name |
| p04-ria-street | blank | address | third-party | no | 204.6, 327.1, 541.8, 341.2 | comb/box printed in a picture (im-001.png pixels [180, 63, 634, 82]) | To be completed by the registered investment advisor: Address: street |
| p04-ria-phone-fax | blank | phone | third-party | no | 203.8, 353.1, 541.8, 365.8 | comb/box printed in a picture (im-001.png pixels [179, 98, 634, 115]) | To be completed by the registered investment advisor: Phone/fax (one comb row) |
| p04-ria-email | blank | email | third-party | no | 203.8, 363.5, 541.8, 376.2 | comb/box printed in a picture (im-001.png pixels [179, 112, 634, 129]) | To be completed by the registered investment advisor: E-mail address |
| p04-ria-city | blank | text | third-party | no | 203.8, 339.8, 464.6, 352.4 | comb/box printed in a picture (im-001.png pixels [179, 80, 530, 97]) | To be completed by the registered investment advisor: city |
| p04-ria-state | blank | text | third-party | no | 467.5, 339.8, 488.3, 352.4 | comb/box printed in a picture (im-001.png pixels [534, 80, 562, 97]) | To be completed by the registered investment advisor: state |
| p04-ria-zip | blank | text | third-party | no | 491.3, 339.8, 541.8, 352.4 | comb/box printed in a picture (im-001.png pixels [566, 80, 634, 97]) | To be completed by the registered investment advisor: zip |
| p04-ria-amount | blank | amount | third-party | no | 151.8, 434.9, 310.8, 446.7 | comb/box printed in a picture (im-002.png pixels [4, 0, 218, 16]) | RIA certification: an investment of not more than $ ___ is suitable |
| p04-ria-print-name | blank | name | third-party | no | 165.2, 477.9, 383.6, 489.8 | comb/box printed in a picture (im-003.png pixels [51, 0, 345, 16]) | RIA: print name |
| p04-ria-date | date | date | third-party | no | 405.1, 477.9, 485.4, 489.8 | comb/box printed in a picture (im-003.png pixels [374, 0, 482, 16]) | RIA: date |
| p04-ria-signature | signature | signature | third-party | no | 221.0, 503.2, 331.0, 513.2 | drawn rule at y=513.2 (box = the 10 pt of writing room above it) | Investment advisor signature |
| p04-share-monthly | tickbox | tickbox | investor | no | 178.6, 583.4, 187.5, 592.3 | tick square printed in a picture (im-004.png pixels [87, 0, 99, 12]) | Investor authorization to share: Monthly reports |
| p04-share-annual | tickbox | tickbox | investor | no | 260.3, 583.4, 269.2, 592.3 | tick square printed in a picture (im-004.png pixels [197, 0, 209, 12]) | Investor authorization to share: Annual reports |
| p04-share-k1 | tickbox | tickbox | investor | no | 342.7, 583.4, 351.6, 592.3 | tick square printed in a picture (im-004.png pixels [308, 0, 320, 12]) | Investor authorization to share: K-1 |
| p04-inv-print-name | blank | name | investor | no | 178.6, 605.0, 397.0, 616.1 | comb/box printed in a picture (im-004.png pixels [87, 29, 381, 44]) | Investor print name (authorization to share financial information, optional) |
| p04-inv-date | date | date | investor | no | 418.5, 605.0, 498.7, 616.1 | comb/box printed in a picture (im-004.png pixels [410, 29, 518, 44]) | Date beside the investor print name (authorization) |
| p04-inv-signature | signature | signature | investor | no | 318.1, 641.4, 428.1, 651.4 | drawn rule at y=651.4 (box = the 10 pt of writing room above it) | Investor signature (authorization to share financial information, optional) |

Must NOT get a field: the logo letters and stripes (pictures); the faint "MMDDYYYY" letters inside the date combs (guides, part of the date place).

### Page 5

Must NOT get a field: prose, instructions or logos only; no place.

### Page 6

Must NOT get a field: prose, instructions or logos only; no place.

### Page 7

Must NOT get a field: prose, instructions or logos only; no place.

### Page 8

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p08-addition | tickbox | tickbox | investor | no | 237.2, 210.5, 246.2, 219.4 | tick square printed in a picture (im-009.png pixels [242, 7, 254, 19]) | Check here if this is an addition to an existing account |
| p08-lp-number | blank | text | investor | no | 476.4, 207.5, 536.6, 219.4 | comb/box printed in a picture (im-009.png pixels [564, 3, 645, 19]) | Limited partner # (existing account) |
| p08-lp-last-name | blank | name | investor | yes | 133.2, 238.0, 332.3, 251.4 | comb/box printed in a picture (im-009.png pixels [102, 44, 370, 62]) | LP: last name |
| p08-lp-first-name | blank | name | investor | yes | 133.2, 249.1, 331.6, 263.2 | comb/box printed in a picture (im-009.png pixels [102, 59, 369, 78]) | LP: first name |
| p08-lp-residence | blank | address | investor | yes | 133.2, 261.0, 332.3, 273.6 | comb/box printed in a picture (im-009.png pixels [102, 75, 370, 92]) | LP: residence address, street |
| p08-lp-res-city | blank | text | investor | yes | 133.2, 274.4, 254.3, 287.0 | comb/box printed in a picture (im-009.png pixels [102, 93, 265, 110]) | LP: residence city |
| p08-lp-res-state | blank | text | investor | yes | 258.0, 274.4, 278.8, 287.0 | comb/box printed in a picture (im-009.png pixels [270, 93, 298, 110]) | LP: residence state |
| p08-lp-res-zip | blank | text | investor | yes | 281.8, 274.4, 332.3, 287.0 | comb/box printed in a picture (im-009.png pixels [302, 93, 370, 110]) | LP: residence zip |
| p08-lp-addl-1 | blank | text | investor-entity | no | 133.2, 284.8, 331.6, 298.9 | comb/box printed in a picture (im-009.png pixels [102, 107, 369, 126]) | LP: additional information (for estates, partnerships, trusts and corporations), line 1 |
| p08-lp-addl-2 | blank | text | investor-entity | no | 133.2, 296.7, 331.6, 311.5 | comb/box printed in a picture (im-009.png pixels [102, 123, 369, 143]) | LP: additional information, line 2 |
| p08-lp-mailing | blank | address | investor | no | 133.2, 308.6, 332.3, 323.4 | comb/box printed in a picture (im-009.png pixels [102, 139, 370, 159]) | LP: mailing address (if different) |
| p08-lp-mail-city | blank | text | investor | no | 133.2, 321.2, 254.3, 333.8 | comb/box printed in a picture (im-009.png pixels [102, 156, 265, 173]) | LP: mailing city |
| p08-lp-mail-state | blank | text | investor | no | 258.0, 321.2, 278.8, 333.8 | comb/box printed in a picture (im-009.png pixels [270, 156, 298, 173]) | LP: mailing state |
| p08-lp-mail-zip | blank | text | investor | no | 281.8, 321.2, 332.3, 333.8 | comb/box printed in a picture (im-009.png pixels [302, 156, 370, 173]) | LP: mailing zip |
| p08-lp-email | blank | email | investor | no | 133.2, 335.7, 332.3, 345.7 | rule printed in a picture (im-009.png pixels [102, 188, 370, 189]); box = the rule and 10 pt above it | LP: e-mail address (a light rule) |
| p08-lp-phone-area | blank | phone | investor | yes | 133.2, 346.4, 163.7, 358.3 | comb/box printed in a picture (im-009.png pixels [102, 190, 143, 206]) | LP: telephone (area group) |
| p08-lp-phone-exchange | blank | phone | investor | yes | 175.6, 346.4, 206.0, 358.3 | comb/box printed in a picture (im-009.png pixels [159, 190, 200, 206]) | LP: telephone (exchange group) |
| p08-lp-phone-number | blank | phone | investor | yes | 217.9, 346.4, 258.8, 358.3 | comb/box printed in a picture (im-009.png pixels [216, 190, 271, 206]) | LP: telephone (number group) |
| p08-lp-dob | blank | date | investor | yes | 270.7, 346.4, 330.9, 358.3 | comb/box printed in a picture (im-009.png pixels [287, 190, 368, 206]) | LP: date of birth (MMDDYY) |
| p08-lp-cust-name | blank | name | investor | no | 133.2, 364.3, 331.6, 377.6 | comb/box printed in a picture (im-009.png pixels [102, 214, 369, 232]) | LP: custodian name |
| p08-lp-cust-address | blank | address | investor | no | 133.2, 375.4, 331.6, 389.5 | comb/box printed in a picture (im-009.png pixels [102, 229, 369, 248]) | LP: custodian mailing address |
| p08-lp-cust-city | blank | text | investor | no | 133.2, 387.3, 254.3, 400.7 | comb/box printed in a picture (im-009.png pixels [102, 245, 265, 263]) | LP: custodian city |
| p08-lp-cust-state | blank | text | investor | no | 258.0, 387.3, 278.1, 400.7 | comb/box printed in a picture (im-009.png pixels [270, 245, 297, 263]) | LP: custodian state |
| p08-lp-cust-zip | blank | text | investor | no | 282.6, 387.3, 331.6, 400.7 | comb/box printed in a picture (im-009.png pixels [303, 245, 369, 263]) | LP: custodian zip |
| p08-joint-last-name | blank | name | co-investor | no | 337.5, 238.0, 536.6, 251.4 | comb/box printed in a picture (im-009.png pixels [377, 44, 645, 62]) | JOINT: last name |
| p08-joint-first-name | blank | name | co-investor | no | 337.5, 249.1, 536.6, 263.2 | comb/box printed in a picture (im-009.png pixels [377, 59, 645, 78]) | JOINT: first name |
| p08-joint-residence | blank | address | co-investor | no | 337.5, 261.0, 536.6, 273.6 | comb/box printed in a picture (im-009.png pixels [377, 75, 645, 92]) | JOINT: residence address, street |
| p08-joint-res-city | blank | text | co-investor | no | 337.5, 274.4, 458.6, 287.0 | comb/box printed in a picture (im-009.png pixels [377, 93, 540, 110]) | JOINT: residence city |
| p08-joint-res-state | blank | text | co-investor | no | 462.3, 274.4, 483.1, 287.0 | comb/box printed in a picture (im-009.png pixels [545, 93, 573, 110]) | JOINT: residence state |
| p08-joint-res-zip | blank | text | co-investor | no | 486.1, 274.4, 536.6, 287.0 | comb/box printed in a picture (im-009.png pixels [577, 93, 645, 110]) | JOINT: residence zip |
| p08-joint-addl-1 | blank | text | co-investor | no | 337.5, 284.8, 536.6, 298.9 | comb/box printed in a picture (im-009.png pixels [377, 107, 645, 126]) | JOINT: additional information (for estates, partnerships, trusts and corporations), line 1 |
| p08-joint-addl-2 | blank | text | co-investor | no | 337.5, 296.7, 536.6, 311.5 | comb/box printed in a picture (im-009.png pixels [377, 123, 645, 143]) | JOINT: additional information, line 2 |
| p08-joint-mailing | blank | address | co-investor | no | 337.5, 308.6, 536.6, 323.4 | comb/box printed in a picture (im-009.png pixels [377, 139, 645, 159]) | JOINT: mailing address (if different) |
| p08-joint-mail-city | blank | text | co-investor | no | 337.5, 321.2, 459.4, 333.8 | comb/box printed in a picture (im-009.png pixels [377, 156, 541, 173]) | JOINT: mailing city |
| p08-joint-mail-state | blank | text | co-investor | no | 462.3, 321.2, 483.1, 333.8 | comb/box printed in a picture (im-009.png pixels [545, 156, 573, 173]) | JOINT: mailing state |
| p08-joint-mail-zip | blank | text | co-investor | no | 486.1, 321.2, 536.6, 333.8 | comb/box printed in a picture (im-009.png pixels [577, 156, 645, 173]) | JOINT: mailing zip |
| p08-joint-email | blank | email | co-investor | no | 337.5, 335.7, 536.6, 345.7 | rule printed in a picture (im-009.png pixels [377, 188, 645, 189]); box = the rule and 10 pt above it | JOINT: e-mail address (a light rule) |
| p08-joint-phone-area | blank | phone | co-investor | no | 338.3, 346.4, 369.5, 358.3 | comb/box printed in a picture (im-009.png pixels [378, 190, 420, 206]) | JOINT: telephone (area group) |
| p08-joint-phone-exchange | blank | phone | co-investor | no | 381.4, 346.4, 411.8, 358.3 | comb/box printed in a picture (im-009.png pixels [436, 190, 477, 206]) | JOINT: telephone (exchange group) |
| p08-joint-phone-number | blank | phone | co-investor | no | 423.7, 346.4, 464.6, 358.3 | comb/box printed in a picture (im-009.png pixels [493, 190, 548, 206]) | JOINT: telephone (number group) |
| p08-joint-dob | blank | date | co-investor | no | 476.4, 346.4, 536.6, 358.3 | comb/box printed in a picture (im-009.png pixels [564, 190, 645, 206]) | JOINT: date of birth (MMDDYY) |
| p08-joint-cust-name | blank | name | co-investor | no | 337.5, 364.3, 536.6, 377.6 | comb/box printed in a picture (im-009.png pixels [377, 214, 645, 232]) | JOINT: custodian name |
| p08-joint-cust-address | blank | address | co-investor | no | 338.3, 375.4, 535.9, 389.5 | comb/box printed in a picture (im-009.png pixels [378, 229, 644, 248]) | JOINT: custodian mailing address |
| p08-joint-cust-city | blank | text | co-investor | no | 338.3, 387.3, 458.6, 400.7 | comb/box printed in a picture (im-009.png pixels [378, 245, 540, 263]) | JOINT: custodian city |
| p08-joint-cust-state | blank | text | co-investor | no | 463.1, 387.3, 482.4, 400.7 | comb/box printed in a picture (im-009.png pixels [546, 245, 572, 263]) | JOINT: custodian state |
| p08-joint-cust-zip | blank | text | co-investor | no | 486.9, 387.3, 535.9, 400.7 | comb/box printed in a picture (im-009.png pixels [578, 245, 644, 263]) | JOINT: custodian zip |
| p08-pay-a | tickbox | tickbox | investor | no | 157.0, 421.5, 165.2, 429.6 | tick square printed in a picture (im-009.png pixels [134, 291, 145, 302]) | Payment: check or wire to "Superfund Gold, L.P. Series A" |
| p08-pay-b | tickbox | tickbox | investor | no | 178.6, 421.5, 187.5, 429.6 | tick square printed in a picture (im-009.png pixels [163, 291, 175, 302]) | Payment: Series B escrow account |
| p08-series-a | tickbox | tickbox | investor | no | 394.0, 431.9, 402.9, 440.8 | tick square printed in a picture (im-009.png pixels [453, 305, 465, 317]) | Subscribes for Series A units |
| p08-series-b | tickbox | tickbox | investor | no | 414.8, 431.9, 423.7, 440.8 | tick square printed in a picture (im-009.png pixels [481, 305, 493, 317]) | Subscribes for Series B units |
| p08-prospectus-date | blank | date | investor | yes | 308.6, 456.4, 369.5, 468.3 | comb/box printed in a picture (im-009.png pixels [338, 338, 420, 354]) | Date of the Fund's prospectus received (MMDDYY) |
| p08-total | blank | amount | investor | yes | 165.2, 497.2, 267.7, 508.4 | comb/box printed in a picture (im-010.png pixels [170, 4, 308, 19]) | Total amount $ (dollars) |
| p08-total-cents | blank | amount | investor | no | 272.2, 497.2, 291.5, 508.4 | comb/box printed in a picture (im-010.png pixels [314, 4, 340, 19]) | Total amount: cents |
| p08-series-a-amount | blank | amount | investor | no | 356.1, 497.2, 430.4, 509.1 | comb/box printed in a picture (im-010.png pixels [427, 4, 527, 20]) | Thereof Series A (dollars) |
| p08-series-a-cents | blank | amount | investor | no | 435.6, 497.2, 454.9, 509.1 | comb/box printed in a picture (im-010.png pixels [534, 4, 560, 20]) | Thereof Series A: cents |
| p08-series-b-amount | blank | amount | investor | no | 356.1, 507.6, 430.4, 519.5 | comb/box printed in a picture (im-010.png pixels [427, 18, 527, 34]) | Series B (dollars) |
| p08-series-b-cents | blank | amount | investor | no | 435.6, 507.6, 454.9, 519.5 | comb/box printed in a picture (im-010.png pixels [534, 18, 560, 34]) | Series B: cents |
| p08-brokerage | blank | text | investor | no | 165.9, 519.5, 276.6, 532.2 | comb/box printed in a picture (im-010.png pixels [171, 34, 320, 51]) | Brokerage account # |
| p08-ssn-1 | blank | tax number | investor | no | 165.2, 529.9, 194.2, 541.8 | comb/box printed in a picture (im-010.png pixels [170, 48, 209, 64]) | Social security # (group 1 of 3) |
| p08-ssn-2 | blank | tax number | investor | no | 205.3, 529.9, 224.6, 541.8 | comb/box printed in a picture (im-010.png pixels [224, 48, 250, 64]) | Social security # (group 2 of 3) |
| p08-ssn-3 | blank | tax number | investor | no | 235.8, 529.9, 272.9, 541.8 | comb/box printed in a picture (im-010.png pixels [265, 48, 315, 64]) | Social security # (group 3 of 3) |
| p08-taxpayer-id-1 | blank | tax number | investor-entity | no | 356.1, 530.7, 375.4, 541.8 | comb/box printed in a picture (im-010.png pixels [427, 49, 453, 64]) | Taxpayer ID #, first group |
| p08-taxpayer-id-2 | blank | tax number | investor-entity | no | 386.6, 530.7, 451.9, 541.8 | comb/box printed in a picture (im-010.png pixels [468, 49, 556, 64]) | Taxpayer ID #, second group |
| p08-type-01 | tickbox | tickbox | investor | no | 76.8, 567.8, 85.0, 576.7 | tick square printed in a picture (im-011.png pixels [0, 12, 11, 24]) | Investor type (check one): Individual ownership |
| p08-type-02 | tickbox | tickbox | investor-entity | no | 76.8, 579.7, 85.0, 588.6 | tick square printed in a picture (im-011.png pixels [0, 28, 11, 40]) | Investor type (check one): Partnership |
| p08-type-03 | tickbox | tickbox | investor-entity | no | 76.8, 591.6, 85.0, 600.5 | tick square printed in a picture (im-011.png pixels [0, 44, 11, 56]) | Investor type (check one): Corporation |
| p08-type-04 | tickbox | tickbox | investor | no | 76.8, 604.2, 85.0, 612.4 | tick square printed in a picture (im-011.png pixels [0, 61, 11, 72]) | Investor type (check one): Tenants in common |
| p08-type-05 | tickbox | tickbox | investor | no | 76.8, 616.1, 85.0, 624.3 | tick square printed in a picture (im-011.png pixels [0, 77, 11, 88]) | Investor type (check one): Joint tenants with right of survivorship |
| p08-type-06 | tickbox | tickbox | investor | no | 187.5, 567.8, 196.4, 576.7 | tick square printed in a picture (im-011.png pixels [149, 12, 161, 24]) | Investor type (check one): Community property |
| p08-type-07 | tickbox | tickbox | investor-entity | no | 187.5, 579.7, 196.4, 588.6 | tick square printed in a picture (im-011.png pixels [149, 28, 161, 40]) | Investor type (check one): Estate |
| p08-type-08 | tickbox | tickbox | investor-entity | no | 187.5, 591.6, 196.4, 600.5 | tick square printed in a picture (im-011.png pixels [149, 44, 161, 56]) | Investor type (check one): Grantor or other revocable trust |
| p08-type-09 | tickbox | tickbox | investor-entity | no | 187.5, 604.2, 196.4, 612.4 | tick square printed in a picture (im-011.png pixels [149, 61, 161, 72]) | Investor type (check one): Trust other than a grantor or revocable trust |
| p08-type-10 | tickbox | tickbox | investor | no | 187.5, 616.1, 196.4, 624.3 | tick square printed in a picture (im-011.png pixels [149, 77, 161, 88]) | Investor type (check one): UGMA/UTMA (minor) |
| p08-type-11 | tickbox | tickbox | investor | no | 321.2, 567.8, 330.1, 576.7 | tick square printed in a picture (im-011.png pixels [329, 12, 341, 24]) | Investor type (check one): IRA |
| p08-type-12 | tickbox | tickbox | investor | no | 321.2, 579.7, 330.1, 588.6 | tick square printed in a picture (im-011.png pixels [329, 28, 341, 40]) | Investor type (check one): IRA rollover |
| p08-type-13 | tickbox | tickbox | investor-entity | no | 321.2, 591.6, 330.1, 600.5 | tick square printed in a picture (im-011.png pixels [329, 44, 341, 56]) | Investor type (check one): Profit sharing |
| p08-type-14 | tickbox | tickbox | investor-entity | no | 402.9, 567.8, 411.8, 576.7 | tick square printed in a picture (im-011.png pixels [439, 12, 451, 24]) | Investor type (check one): Defined benefit |
| p08-type-15 | tickbox | tickbox | investor-entity | no | 402.9, 579.7, 411.8, 588.6 | tick square printed in a picture (im-011.png pixels [439, 28, 451, 40]) | Investor type (check one): Pension |
| p08-type-16 | tickbox | tickbox | investor | no | 402.9, 591.6, 411.8, 600.5 | tick square printed in a picture (im-011.png pixels [439, 44, 451, 56]) | Investor type (check one): SEP |
| p08-type-17 | tickbox | tickbox | investor | no | 485.4, 567.8, 494.3, 576.7 | tick square printed in a picture (im-011.png pixels [550, 12, 562, 24]) | Investor type (check one): Other (specify) |

Must NOT get a field: the broker-dealer information block at the top right (printed text, completed by the issuer/dealer before use); two specks read as small squares in the payment paragraph (no box printed); the faint MMDDYY guides inside date combs; logo pictures.

### Page 9

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p09-lp-date | date | date | investor | yes | 77.5, 115.4, 105.0, 125.4 | drawn rule at y=125.4 (box = the 10 pt of writing room above it) | Date beside the limited partner signature |
| p09-lp-signature | signature | signature | investor | yes | 122.8, 115.4, 268.4, 125.4 | drawn rule at y=125.4 (box = the 10 pt of writing room above it) | Signature of limited partner |
| p09-joint-date | date | date | co-investor | no | 287.0, 115.4, 308.6, 125.4 | drawn rule at y=125.4 (box = the 10 pt of writing room above it) | Date beside the joint signature |
| p09-joint-signature | signature | signature | co-investor | no | 319.7, 115.4, 578.2, 125.4 | drawn rule at y=125.4 (box = the 10 pt of writing room above it) | Signature of joint limited partner (if any) or custodian (doubt: captioned joint limited partner OR custodian) |
| p09-bd-date | date | date | third-party | no | 77.5, 257.3, 102.8, 267.3 | drawn rule at y=267.3 (box = the 10 pt of writing room above it) | Date beside the registered representative signature |
| p09-rr-signature | signature | signature | third-party | no | 116.9, 257.3, 249.1, 267.3 | drawn rule at y=267.3 (box = the 10 pt of writing room above it) | Registered representative signature |
| p09-principal-date | date | date | third-party | no | 263.2, 257.3, 284.8, 267.3 | drawn rule at y=267.3 (box = the 10 pt of writing room above it) | Date beside the principal signature |
| p09-principal-signature | signature | signature | third-party | no | 293.7, 257.3, 578.2, 267.3 | drawn rule at y=267.3 (box = the 10 pt of writing room above it) | Principal signature (if required by selling agent procedures) |
| p09-rr-print-name | blank | name | third-party | no | 110.2, 310.1, 299.6, 321.9 | comb/box printed in a picture (im-013.png pixels [55, 0, 310, 16]) | Registered representative: print name |
| p09-principal-print-name | blank | name | third-party | no | 354.6, 310.1, 543.3, 321.9 | comb/box printed in a picture (im-013.png pixels [384, 0, 638, 16]) | Principal: print name |

Must NOT get a field: certification text.

### Page 10

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p10-units-a | tickbox | tickbox | investor | no | 396.9, 251.8, 401.0, 256.7 | letter "o" printed as a tick box (ink measured at 400 dpi) | Subscription for units in Series A (doubt: letter "o" in running text used as a choice box) |
| p10-units-b | tickbox | tickbox | investor | no | 416.2, 251.8, 420.3, 256.7 | letter "o" printed as a tick box (ink measured at 400 dpi) | Subscription for units in Series B (doubt: letter "o" in running text used as a choice box) |
| p10-escrow-a | tickbox | tickbox | investor | no | 520.2, 274.9, 524.3, 279.7 | letter "o" printed as a tick box (ink measured at 400 dpi) | Check payable: Series A (doubt: letter "o" in running text used as a choice box) |
| p10-escrow-b | tickbox | tickbox | investor | no | 538.0, 274.9, 542.2, 279.7 | letter "o" printed as a tick box (ink measured at 400 dpi) | Check payable: Series B escrow account (doubt: letter "o" in running text used as a choice box) |

Must NOT get a field: prose; letterhead.

### Page 11

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p11-edel-lp-date | date | date | investor | no | 33.7, 611.7, 89.4, 621.7 | drawn rule at y=621.7 (box = the 10 pt of writing room above it) | Electronic delivery consent: date |
| p11-edel-lp-signature | signature | signature | investor | no | 94.6, 611.7, 233.5, 621.7 | drawn rule at y=621.7 (box = the 10 pt of writing room above it) | Electronic delivery consent: signature of limited partner |
| p11-edel-joint-date | date | date | co-investor | no | 239.5, 611.7, 294.4, 621.7 | drawn rule at y=621.7 (box = the 10 pt of writing room above it) | Electronic delivery consent: date (joint) |
| p11-edel-joint-signature | signature | signature | co-investor | no | 300.4, 611.7, 578.2, 621.7 | drawn rule at y=621.7 (box = the 10 pt of writing room above it) | Electronic delivery consent: signature of joint limited partner (if any) or custodian |

Must NOT get a field: bulleted list markers ("4" glyphs are bullets).

### Page 12

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p12-series-a | tickbox | tickbox | investor | no | 353.2, 249.2, 362.0, 258.7 | white comb cells on grey (im-018.png pixels [372, 0, 382, 11]) | Suitability form: series A |
| p12-series-b | tickbox | tickbox | investor | no | 382.9, 249.2, 391.7, 258.7 | white comb cells on grey (im-018.png pixels [412, 0, 422, 11]) | Suitability form: series B |
| p12-title-mr | tickbox | tickbox | investor | no | 258.0, 270.7, 267.0, 279.6 | tick square printed in a picture (im-018.png pixels [243, 28, 255, 40]) | Limited partner title: Mr |
| p12-title-mrs | tickbox | tickbox | investor | no | 288.5, 270.7, 297.4, 279.6 | tick square printed in a picture (im-018.png pixels [284, 28, 296, 40]) | Limited partner title: Mrs |
| p12-title-ms | tickbox | tickbox | investor | no | 321.2, 270.7, 330.1, 279.6 | tick square printed in a picture (im-018.png pixels [328, 28, 340, 40]) | Limited partner title: Ms |
| p12-last-name | blank | name | investor | yes | 125.8, 280.3, 344.2, 293.0 | comb/box printed in a picture (im-018.png pixels [65, 41, 359, 58]) | Suitability: last name |
| p12-first-name | blank | name | investor | yes | 125.8, 291.5, 344.2, 305.6 | comb/box printed in a picture (im-018.png pixels [65, 56, 359, 75]) | Suitability: first name |
| p12-street | blank | address | investor | yes | 125.8, 303.4, 344.2, 316.0 | comb/box printed in a picture (im-018.png pixels [65, 72, 359, 89]) | Suitability: address street |
| p12-city | blank | text | investor | yes | 125.8, 316.7, 265.5, 327.9 | comb/box printed in a picture (im-018.png pixels [65, 90, 253, 105]) | Suitability: city |
| p12-state | blank | text | investor | yes | 270.7, 316.7, 290.7, 327.9 | comb/box printed in a picture (im-018.png pixels [260, 90, 287, 105]) | Suitability: state |
| p12-zip | blank | text | investor | yes | 294.4, 316.7, 345.0, 327.9 | comb/box printed in a picture (im-018.png pixels [292, 90, 360, 105]) | Suitability: zip |
| p12-email | blank | email | investor | no | 125.8, 328.6, 344.2, 340.5 | comb/box printed in a picture (im-018.png pixels [65, 106, 359, 122]) | Suitability: e-mail |
| p12-phone | blank | phone | investor | yes | 397.0, 280.3, 497.2, 293.0 | comb/box printed in a picture (im-018.png pixels [430, 41, 565, 58]) | Suitability: telephone |
| p12-dob | blank | date | investor | yes | 397.0, 291.5, 477.2, 304.1 | comb/box printed in a picture (im-018.png pixels [430, 56, 538, 73]) | Suitability: date of birth |
| p12-male | tickbox | tickbox | investor | no | 397.0, 307.1, 405.9, 315.2 | tick square printed in a picture (im-018.png pixels [430, 77, 442, 88]) | Sex: male |
| p12-female | tickbox | tickbox | investor | no | 431.9, 307.1, 440.1, 315.2 | tick square printed in a picture (im-018.png pixels [477, 77, 488, 88]) | Sex: female |
| p12-occupation | blank | text | investor | no | 397.0, 316.7, 546.3, 327.9 | comb/box printed in a picture (im-018.png pixels [430, 90, 631, 105]) | Occupation |
| p12-family-married | tickbox | tickbox | investor | no | 397.0, 330.9, 405.9, 339.8 | tick square printed in a picture (im-018.png pixels [430, 109, 442, 121]) | Family status: married |
| p12-family-divorced | tickbox | tickbox | investor | no | 437.1, 330.9, 446.0, 339.8 | tick square printed in a picture (im-018.png pixels [484, 109, 496, 121]) | Family status: divorced |
| p12-family-single | tickbox | tickbox | investor | no | 478.7, 330.9, 486.9, 339.8 | tick square printed in a picture (im-018.png pixels [540, 109, 551, 121]) | Family status: single |
| p12-family-widowed | tickbox | tickbox | investor | no | 512.1, 330.9, 521.0, 339.8 | tick square printed in a picture (im-018.png pixels [585, 109, 597, 121]) | Family status: widowed |
| p12-additional | blank | text | investor-entity | no | 125.8, 352.4, 542.6, 364.3 | comb/box printed in a picture (im-018.png pixels [65, 138, 626, 154]) | Additional information (for estates, partnerships, trusts and corporations) |
| p12-income | blank | amount | investor | yes | 184.5, 376.9, 344.2, 388.1 | comb/box printed in a picture (im-018.png pixels [144, 171, 359, 186]) | Annual income (AI) |
| p12-net-worth | blank | amount | investor | yes | 343.5, 388.8, 502.4, 400.7 | comb/box printed in a picture (im-018.png pixels [358, 187, 572, 203]) | Approximate net worth (NW) exclusive of residence and automobiles |
| p12-finance-own | tickbox | tickbox | investor | no | 455.6, 379.1, 464.6, 388.1 | tick square printed in a picture (im-018.png pixels [509, 174, 521, 186]) | How the investment is financed: own |
| p12-finance-loan | tickbox | tickbox | investor | no | 501.7, 379.1, 510.6, 388.1 | tick square printed in a picture (im-018.png pixels [571, 174, 583, 186]) | How the investment is financed: loan |
| p12-finance-other | tickbox | tickbox | investor | no | 527.7, 379.1, 536.6, 388.1 | tick square printed in a picture (im-018.png pixels [606, 174, 618, 186]) | How the investment is financed: other |

Must NOT get a field: state suitability list (no box); logo pictures.

### Page 13

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p13-sig-title-mr | tickbox | tickbox | investor | no | 296.7, 164.4, 305.6, 172.6 | tick square printed in a picture (im-020.png pixels [295, 0, 307, 11]) | Signature block (individuals) title: Mr |
| p13-sig-title-mrs | tickbox | tickbox | investor | no | 329.4, 164.4, 338.3, 172.6 | tick square printed in a picture (im-020.png pixels [339, 0, 351, 11]) | Signature block (individuals) title: Mrs |
| p13-sig-title-ms | tickbox | tickbox | investor | no | 364.3, 164.4, 372.4, 172.6 | tick square printed in a picture (im-020.png pixels [386, 0, 397, 11]) | Signature block (individuals) title: Ms |
| p13-lp-name | blank | name | investor | yes | 187.5, 173.4, 406.6, 185.2 | comb/box printed in a picture (im-020.png pixels [148, 12, 443, 28]) | Name of limited partner (print or type) |
| p13-lp-date | date | date | investor | yes | 428.2, 173.4, 507.6, 185.2 | comb/box printed in a picture (im-020.png pixels [472, 12, 579, 28]) | Date (limited partner) |
| p13-lp-signature | signature | signature | investor | yes | 188.2, 190.1, 405.9, 200.1 | rule printed in a picture (im-020.png pixels [149, 46, 442, 48]); box = the rule and 10 pt above it | Signature of limited partner (a double rule) |
| p13-joint-name | blank | name | co-investor | no | 187.5, 203.8, 406.6, 215.7 | comb/box printed in a picture (im-020.png pixels [148, 53, 443, 69]) | Name of joint limited partner |
| p13-joint-date | date | date | co-investor | no | 428.2, 203.8, 507.6, 215.7 | comb/box printed in a picture (im-020.png pixels [472, 53, 579, 69]) | Date (joint limited partner) |
| p13-joint-signature | signature | signature | co-investor | no | 188.2, 221.3, 405.9, 231.3 | rule printed in a picture (im-020.png pixels [149, 89, 442, 90]); box = the rule and 10 pt above it | Signature of joint limited partner |
| p13-entity-name | blank | name | investor-entity | no | 187.5, 245.4, 405.9, 258.8 | comb/box printed in a picture (im-020.png pixels [148, 109, 442, 127]) | Signature if limited partner is an entity: name of entity |
| p13-entity-date | date | date | investor-entity | no | 428.2, 245.4, 507.6, 257.3 | comb/box printed in a picture (im-020.png pixels [472, 109, 579, 125]) | Date (entity) |
| p13-signatory-name | blank | name | investor-entity | no | 187.5, 256.6, 406.6, 269.2 | comb/box printed in a picture (im-020.png pixels [148, 124, 443, 141]) | Name of signatory (entity) |
| p13-entity-signature | signature | signature | investor-entity | no | 188.2, 276.3, 405.9, 286.3 | rule printed in a picture (im-020.png pixels [149, 162, 442, 164]); box = the rule and 10 pt above it | By: authorized signatory (entity) |

Must NOT get a field: the S logo and stripe pictures in the margin; logo.

### Page 14

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p14-init-01 | initials | initials | investor | yes | 37.4, 286.3, 60.4, 307.8 | grey square picture (im-023.png) | Representation 1: initial box |
| p14-init-02 | initials | initials | investor | yes | 37.4, 321.2, 60.4, 342.7 | grey square picture (im-024.png) | Representation 2: initial box |
| p14-init-03 | initials | initials | investor | yes | 37.4, 365.8, 60.4, 387.3 | grey square picture (im-025.png) | Representation 3: initial box |
| p14-init-04 | initials | initials | investor | yes | 37.4, 499.5, 60.4, 521.0 | grey square picture (im-026.png) | Representation 4: initial box |
| p14-init-05 | initials | initials | investor | yes | 37.4, 577.5, 60.4, 599.0 | grey square picture (im-027.png) | Representation 5: initial box |
| p14-init-06 | initials | initials | investor | yes | 37.4, 700.1, 60.4, 721.6 | grey square picture (im-028.png) | Representation 6: initial box |
| p14-init-09 | initials | initials | investor | no | 311.5, 286.3, 334.6, 307.8 | grey square picture (im-030.png) | Representation 9: initial box |
| p14-init-10 | initials | initials | investor | no | 311.5, 576.0, 334.6, 597.5 | grey square picture (im-031.png) | Representation 10: initial box |
| p14-init-11 | initials | initials | investor | no | 311.5, 665.1, 334.6, 686.7 | grey square picture (im-032.png) | Representation 11: initial box |
| p14-init-orphan | initials | initials | investor | no | 37.4, 764.0, 60.4, 785.5 | grey square picture (im-029.png) | Grey initial box at the foot of the left column with no text beside it (doubt: no representation printed beside it (item 7 starts the next page with its own box); a stray box) |

Must NOT get a field: letters of the title picture read as boxes.

### Page 15

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p15-init-07 | initials | initials | investor | yes | 37.4, 27.8, 60.4, 49.3 | grey square picture (im-033.png) | Representation 7: initial box |
| p15-init-12 | initials | initials | investor | no | 311.5, 61.2, 334.6, 82.7 | grey square picture (im-035.png) | Representation 12: initial box |
| p15-init-13 | initials | initials | investor | no | 311.5, 206.0, 334.6, 227.6 | grey square picture (im-036.png) | Representation 13: initial box |
| p15-init-14 | initials | initials | investor | no | 311.5, 317.5, 334.6, 339.0 | grey square picture (im-037.png) | Representation 14: initial box |
| p15-init-08 | initials | initials | investor | yes | 37.4, 674.1, 60.4, 695.6 | grey square picture (im-034.png) | Representation 8: initial box |
| p15-nfa-id | blank | text | investor-entity | no | 197.6, 295.2, 260.9, 305.2 | drawn rule at y=305.2 (box = the 10 pt of writing room above it) | Entity that is a commodity pool: provide NFA ID |
| p15-exemption | blank | text | investor-entity | no | 231.7, 473.5, 300.5, 483.5 | drawn rule at y=483.5 (box = the 10 pt of writing room above it) | Entity exempt from CPO registration: state the exemption claimed |

### Page 16

Must NOT get a field: prose, instructions or logos only; no place.

### Page 17

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p17-series-a | tickbox | tickbox | investor | no | 274.3, 310.7, 282.6, 319.3 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | Addendum: Series A |
| p17-series-b | tickbox | tickbox | investor | no | 311.4, 310.7, 320.0, 319.3 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | Addendum: Series B |
| p17-total | blank | amount | investor | no | 343.5, 361.3, 423.7, 373.2 | comb/box printed in a picture (im-041.png pixels [4, 0, 112, 16]) | Addendum item 2: total subscription (USD) |
| p17-initial | blank | amount | investor | no | 477.2, 404.4, 556.7, 416.3 | comb/box printed in a picture (im-042.png pixels [5, 0, 112, 16]) | Addendum item 3: initial issuance amount (USD) |
| p17-periodic | blank | amount | investor | no | 311.5, 447.5, 391.0, 459.4 | comb/box printed in a picture (im-043.png pixels [5, 0, 112, 16]) | Addendum item 4: amount per period (USD) |
| p17-month-end | tickbox | tickbox | investor | no | 124.2, 462.2, 132.8, 470.5 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | Addendum item 4: month-end |
| p17-quarter-end | tickbox | tickbox | investor | no | 205.9, 462.2, 214.6, 470.5 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | Addendum item 4: calendar quarter-end |
| p17-broker | blank | name | investor | no | 241.0, 501.7, 440.1, 513.6 | comb/box printed in a picture (im-046.png pixels [0, 0, 268, 16]) | Addendum item 5: broker-dealer name |

Must NOT get a field: title picture letters.

### Page 18

Must NOT get a field: prose, instructions or logos only; no place.

### Page 19

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p19-lp-number | blank | text | investor | no | 222.4, 261.8, 282.6, 272.9 | comb/box printed in a picture (im-050.png pixels [166, 22, 247, 37]) | Addendum: limited partner # |
| p19-title-mr | tickbox | tickbox | investor | no | 306.3, 264.0, 315.2, 272.9 | tick square printed in a picture (im-050.png pixels [279, 25, 291, 37]) | Addendum LP title: mr |
| p19-title-mrs | tickbox | tickbox | investor | no | 332.3, 264.0, 341.2, 272.9 | tick square printed in a picture (im-050.png pixels [314, 25, 326, 37]) | Addendum LP title: mrs |
| p19-title-ms | tickbox | tickbox | investor | no | 359.8, 264.0, 368.7, 272.9 | tick square printed in a picture (im-050.png pixels [351, 25, 363, 37]) | Addendum LP title: ms |
| p19-last-name | blank | name | investor | no | 162.2, 279.6, 380.6, 291.5 | comb/box printed in a picture (im-050.png pixels [85, 46, 379, 62]) | Addendum: Last name |
| p19-first-name | blank | name | investor | no | 162.2, 297.4, 380.6, 309.3 | comb/box printed in a picture (im-050.png pixels [85, 70, 379, 86]) | Addendum: First name |
| p19-street | blank | address | investor | no | 162.2, 316.0, 381.4, 327.1 | comb/box printed in a picture (im-050.png pixels [85, 95, 380, 110]) | Addendum: Address street |
| p19-city | blank | text | investor | no | 162.2, 333.8, 380.6, 345.7 | comb/box printed in a picture (im-050.png pixels [85, 119, 379, 135]) | Addendum: City |
| p19-email | blank | email | investor | no | 162.2, 405.9, 380.6, 417.8 | comb/box printed in a picture (im-050.png pixels [85, 216, 379, 232]) | Addendum: E-mail |
| p19-state | blank | text | investor | no | 162.2, 351.6, 183.0, 363.5 | comb/box printed in a picture (im-050.png pixels [85, 143, 113, 159]) | Addendum: state |
| p19-zip | blank | text | investor | no | 186.0, 351.6, 236.5, 363.5 | comb/box printed in a picture (im-050.png pixels [117, 143, 185, 159]) | Addendum: ZIP |
| p19-phone-area | blank | phone | investor | no | 162.2, 369.5, 192.7, 381.4 | comb/box printed in a picture (im-050.png pixels [85, 167, 126, 183]) | Addendum telephone (area group) |
| p19-fax-area | blank | phone | investor | no | 162.2, 388.1, 192.7, 399.9 | comb/box printed in a picture (im-050.png pixels [85, 192, 126, 208]) | Addendum fax (area group) |
| p19-phone-exchange | blank | phone | investor | no | 204.6, 369.5, 235.0, 381.4 | comb/box printed in a picture (im-050.png pixels [142, 167, 183, 183]) | Addendum telephone (exchange group) |
| p19-fax-exchange | blank | phone | investor | no | 204.6, 388.1, 235.0, 399.9 | comb/box printed in a picture (im-050.png pixels [142, 192, 183, 208]) | Addendum fax (exchange group) |
| p19-phone-number | blank | phone | investor | no | 246.9, 369.5, 287.8, 381.4 | comb/box printed in a picture (im-050.png pixels [199, 167, 254, 183]) | Addendum telephone (number group) |
| p19-fax-number | blank | phone | investor | no | 246.9, 388.1, 287.8, 399.9 | comb/box printed in a picture (im-050.png pixels [199, 192, 254, 208]) | Addendum fax (number group) |
| p19-date | date | date | investor | no | 405.1, 388.1, 465.3, 399.9 | comb/box printed in a picture (im-050.png pixels [412, 192, 493, 208]) | Addendum: date (investor) |
| p19-signature | signature | signature | investor | no | 420.7, 406.3, 584.9, 416.3 | rule printed in a picture (im-050.png pixels [433, 229, 654, 230]); box = the rule and 10 pt above it | Addendum: signature (investor) |
| p19-joint-title-mr | tickbox | tickbox | co-investor | no | 305.6, 450.4, 314.5, 459.4 | tick square printed in a picture (im-050.png pixels [278, 276, 290, 288]) | Addendum joint LP/custodian title: mr |
| p19-joint-title-mrs | tickbox | tickbox | co-investor | no | 332.3, 450.4, 340.5, 459.4 | tick square printed in a picture (im-050.png pixels [314, 276, 325, 288]) | Addendum joint LP/custodian title: mrs |
| p19-joint-title-ms | tickbox | tickbox | co-investor | no | 359.8, 450.4, 368.7, 459.4 | tick square printed in a picture (im-050.png pixels [351, 276, 363, 288]) | Addendum joint LP/custodian title: ms |
| p19-joint-last-name | blank | name | co-investor | no | 162.2, 466.1, 380.6, 477.9 | comb/box printed in a picture (im-050.png pixels [85, 297, 379, 313]) | Addendum joint LP or custodian: last name (doubt: captioned joint limited partner OR custodian) |
| p19-joint-first-name | blank | name | co-investor | no | 162.2, 483.9, 381.4, 495.8 | comb/box printed in a picture (im-050.png pixels [85, 321, 380, 337]) | Addendum joint LP or custodian: first name |
| p19-joint-date | date | date | co-investor | no | 405.1, 466.1, 465.3, 477.9 | comb/box printed in a picture (im-050.png pixels [412, 297, 493, 313]) | Addendum joint: date |
| p19-joint-signature | signature | signature | co-investor | no | 420.7, 485.0, 584.9, 495.0 | rule printed in a picture (im-050.png pixels [433, 334, 654, 336]); box = the rule and 10 pt above it | Addendum joint: signature |
| p19-bd-title-mr | tickbox | tickbox | third-party | no | 305.6, 510.6, 314.5, 519.5 | tick square printed in a picture (im-050.png pixels [278, 357, 290, 369]) | Broker dealer acknowledgement title: mr |
| p19-bd-title-mrs | tickbox | tickbox | third-party | no | 332.3, 510.6, 340.5, 519.5 | tick square printed in a picture (im-050.png pixels [314, 357, 325, 369]) | Broker dealer acknowledgement title: mrs |
| p19-bd-title-ms | tickbox | tickbox | third-party | no | 359.8, 510.6, 368.7, 519.5 | tick square printed in a picture (im-050.png pixels [351, 357, 363, 369]) | Broker dealer acknowledgement title: ms |
| p19-bd-firm | blank | name | third-party | no | 162.2, 526.2, 380.6, 538.1 | comb/box printed in a picture (im-050.png pixels [85, 378, 379, 394]) | Broker dealer firm name |
| p19-bd-firm-2 | blank | name | third-party | no | 162.2, 544.8, 381.4, 556.7 | comb/box printed in a picture (im-050.png pixels [85, 403, 380, 419]) | Broker dealer firm name, second comb row (doubt: an uncaptioned second row under the firm name) |
| p19-bd-date | date | date | third-party | no | 405.1, 526.2, 465.3, 538.1 | comb/box printed in a picture (im-050.png pixels [412, 378, 493, 394]) | Broker dealer: date |
| p19-bd-signature | signature | signature | third-party | no | 420.7, 545.2, 584.9, 555.2 | rule printed in a picture (im-050.png pixels [433, 416, 654, 417]); box = the rule and 10 pt above it | Broker dealer signature (beside the second firm-name row) |
| p19-rr-name | blank | name | third-party | no | 162.2, 562.6, 380.6, 574.5 | comb/box printed in a picture (im-050.png pixels [85, 427, 379, 443]) | Name of registered representative |
| p19-rr-signature | signature | signature | third-party | no | 420.7, 563.0, 584.9, 573.0 | rule printed in a picture (im-050.png pixels [433, 440, 654, 441]); box = the rule and 10 pt above it | Registered representative signature |
| p19-principal-name | blank | name | third-party | no | 162.2, 580.5, 380.6, 592.3 | comb/box printed in a picture (im-050.png pixels [85, 451, 379, 467]) | Name of principal |
| p19-principal-signature | signature | signature | third-party | no | 420.7, 580.9, 584.9, 590.9 | rule printed in a picture (im-050.png pixels [433, 464, 654, 465]); box = the rule and 10 pt above it | Principal signature |

Must NOT get a field: the note "Broker Dealer to retain a copy".

### Page 20

Must NOT get a field: prose, instructions or logos only; no place.

### Page 21

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p21-units | blank | amount | investor | no | 283.3, 261.8, 402.9, 273.6 | comb/box printed in a picture (im-054.png pixels [0, 0, 161, 16]) | Transfer request: number of units |
| p21-series-a | tickbox | tickbox | investor | no | 475.6, 265.3, 484.2, 274.0 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | Transfer request: Series A |
| p21-series-b | tickbox | tickbox | investor | no | 537.8, 265.3, 546.5, 274.0 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | Transfer request: Series B |
| p21-from-name-1 | blank | name | investor | no | 137.7, 347.9, 366.5, 359.1 | comb/box printed in a picture (im-057.png pixels [81, 14, 389, 29]) | Transferor: name of limited partner (line 1) |
| p21-from-name-2 | blank | name | investor | no | 137.7, 359.8, 366.5, 372.4 | comb/box printed in a picture (im-057.png pixels [81, 30, 389, 47]) | Transferor: name of limited partner (line 2) |
| p21-from-lp-number | blank | text | investor | no | 438.6, 347.9, 498.7, 359.1 | comb/box printed in a picture (im-057.png pixels [486, 14, 567, 29]) | Transferor: limited partner # (if applicable) |
| p21-from-entity-1 | blank | name | investor-entity | no | 137.7, 371.0, 365.8, 384.3 | comb/box printed in a picture (im-057.png pixels [81, 45, 388, 63]) | Transferor: name of entity (line 1) |
| p21-from-entity-2 | blank | name | investor-entity | no | 137.7, 382.9, 366.5, 395.5 | comb/box printed in a picture (im-057.png pixels [81, 61, 389, 78]) | Transferor: name of entity (line 2) |
| p21-from-phone | blank | phone | investor | no | 438.6, 371.7, 548.5, 384.3 | comb/box printed in a picture (im-057.png pixels [486, 46, 634, 63]) | Transferor: telephone |
| p21-from-tax-id-1 | blank | tax number | investor | no | 438.6, 382.9, 459.4, 395.5 | comb/box printed in a picture (im-057.png pixels [486, 61, 514, 78]) | Transferor: tax ID # (group 1) |
| p21-from-tax-id-2 | blank | tax number | investor | no | 471.2, 382.9, 541.1, 395.5 | comb/box printed in a picture (im-057.png pixels [530, 61, 624, 78]) | Transferor: tax ID # (group 2) |
| p21-from-street | blank | address | investor | no | 137.7, 396.2, 366.5, 407.4 | comb/box printed in a picture (im-057.png pixels [81, 79, 389, 94]) | Transferor: address street |
| p21-from-account-type | blank | text | investor | no | 438.6, 396.2, 548.5, 407.4 | comb/box printed in a picture (im-057.png pixels [486, 79, 634, 94]) | Transferor: account type |
| p21-from-city | blank | text | investor | no | 137.7, 408.1, 287.0, 420.0 | comb/box printed in a picture (im-057.png pixels [81, 95, 282, 111]) | Transferor: city |
| p21-from-state | blank | text | investor | no | 292.2, 408.1, 313.0, 420.0 | comb/box printed in a picture (im-057.png pixels [289, 95, 317, 111]) | Transferor: state |
| p21-from-zip | blank | text | investor | no | 316.0, 408.1, 366.5, 420.0 | comb/box printed in a picture (im-057.png pixels [321, 95, 389, 111]) | Transferor: zip |
| p21-to-name-1 | blank | name | third-party | no | 137.7, 462.3, 366.5, 475.0 | comb/box printed in a picture (im-057.png pixels [81, 168, 389, 185]) | Transferee: name of limited partner (line 1) |
| p21-to-name-2 | blank | name | third-party | no | 137.7, 472.7, 365.8, 486.9 | comb/box printed in a picture (im-057.png pixels [81, 182, 388, 201]) | Transferee: name of limited partner (line 2) |
| p21-to-lp-number | blank | text | third-party | no | 438.6, 462.3, 498.7, 474.2 | comb/box printed in a picture (im-057.png pixels [486, 168, 567, 184]) | Transferee: limited partner # (if applicable) |
| p21-to-entity-1 | blank | name | third-party | no | 137.7, 484.6, 365.8, 499.5 | comb/box printed in a picture (im-057.png pixels [81, 198, 388, 218]) | Transferee: name of entity (line 1) |
| p21-to-entity-2 | blank | name | third-party | no | 137.7, 497.2, 365.8, 511.4 | comb/box printed in a picture (im-057.png pixels [81, 215, 388, 234]) | Transferee: name of entity (line 2) |
| p21-to-phone | blank | phone | third-party | no | 438.6, 486.1, 548.5, 499.5 | comb/box printed in a picture (im-057.png pixels [486, 200, 634, 218]) | Transferee: telephone |
| p21-to-tax-id-1 | blank | tax number | third-party | no | 438.6, 497.2, 459.4, 511.4 | comb/box printed in a picture (im-057.png pixels [486, 215, 514, 234]) | Transferee: tax ID # (group 1) |
| p21-to-tax-id-2 | blank | tax number | third-party | no | 471.2, 497.2, 541.1, 511.4 | comb/box printed in a picture (im-057.png pixels [530, 215, 624, 234]) | Transferee: tax ID # (group 2) |
| p21-to-street | blank | address | third-party | no | 137.7, 509.1, 366.5, 521.8 | comb/box printed in a picture (im-057.png pixels [81, 231, 389, 248]) | Transferee: address street |
| p21-to-account-type | blank | text | third-party | no | 438.6, 509.1, 548.5, 521.8 | one comb printed in a picture (im-057.png), joined from 1 pieces split by a neighbouring row | Transferee: account type |
| p21-to-city | blank | text | third-party | no | 137.7, 522.5, 287.0, 534.4 | comb/box printed in a picture (im-057.png pixels [81, 249, 282, 265]) | Transferee: city |
| p21-to-state | blank | text | third-party | no | 292.2, 522.5, 313.0, 534.4 | comb/box printed in a picture (im-057.png pixels [289, 249, 317, 265]) | Transferee: state |
| p21-to-zip | blank | text | third-party | no | 316.0, 522.5, 366.5, 534.4 | comb/box printed in a picture (im-057.png pixels [321, 249, 389, 265]) | Transferee: zip |
| p21-from-date | date | date | investor | no | 77.5, 574.5, 135.5, 584.5 | drawn rule at y=584.5 (box = the 10 pt of writing room above it) | Transferor: date |
| p21-from-signature | signature | signature | investor | no | 142.9, 574.5, 287.8, 584.5 | drawn rule at y=584.5 (box = the 10 pt of writing room above it) | Signature of limited partner (transferor) |
| p21-from-joint-date | date | date | co-investor | no | 295.2, 574.5, 353.1, 584.5 | drawn rule at y=584.5 (box = the 10 pt of writing room above it) | Transferor joint: date |
| p21-from-joint-signature | signature | signature | co-investor | no | 360.6, 574.5, 578.2, 584.5 | drawn rule at y=584.5 (box = the 10 pt of writing room above it) | Signature of joint limited partner (if any) or custodian (transferor) |
| p21-from-auth-date | date | date | investor-entity | no | 77.5, 609.5, 136.2, 619.5 | drawn rule at y=619.5 (box = the 10 pt of writing room above it) | Transferor entity: date |
| p21-from-auth-signature | signature | signature | investor-entity | no | 143.6, 609.5, 290.7, 619.5 | drawn rule at y=619.5 (box = the 10 pt of writing room above it) | Authorized signatory (corporate officer, partner, custodian or trustee) for the transferor |
| p21-from-auth-title | blank | title | investor-entity | no | 298.2, 609.5, 578.2, 619.5 | drawn rule at y=619.5 (box = the 10 pt of writing room above it) | Title of the authorized signatory (transferor) |
| p21-to-date | date | date | third-party | no | 77.5, 700.8, 135.5, 710.8 | drawn rule at y=710.8 (box = the 10 pt of writing room above it) | Transferee: date |
| p21-to-signature | signature | signature | third-party | no | 142.9, 700.8, 287.8, 710.8 | drawn rule at y=710.8 (box = the 10 pt of writing room above it) | Signature of transferee |
| p21-to-joint-date | date | date | third-party | no | 295.2, 700.8, 353.1, 710.8 | drawn rule at y=710.8 (box = the 10 pt of writing room above it) | Joint transferee: date |
| p21-to-joint-signature | signature | signature | third-party | no | 360.6, 700.8, 578.2, 710.8 | drawn rule at y=710.8 (box = the 10 pt of writing room above it) | Signature of joint transferee (if applicable) |
| p21-to-auth-date | date | date | third-party | no | 77.5, 724.6, 136.2, 734.6 | drawn rule at y=734.6 (box = the 10 pt of writing room above it) | Transferee entity: date |
| p21-to-auth-signature | signature | signature | third-party | no | 143.6, 724.6, 290.7, 734.6 | drawn rule at y=734.6 (box = the 10 pt of writing room above it) | Authorized signatory (transferee) |
| p21-to-auth-title | blank | title | third-party | no | 298.2, 724.6, 578.2, 734.6 | drawn rule at y=734.6 (box = the 10 pt of writing room above it) | Title of the authorized signatory (transferee) |

Must NOT get a field: two specks read as small squares near the captions; the title picture letter.

### Page 22

Must NOT get a field: prose, instructions or logos only; no place.

### Page 23

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p23-lp-number | blank | text | investor | yes | 275.2, 201.6, 335.3, 212.7 | white comb cells on grey (im-061.png pixels [297, 1, 376, 14]) | Additional investment: limited partner # |
| p23-lp-last-name | blank | name | investor | yes | 136.2, 213.5, 335.3, 226.1 | comb/box printed in a picture (im-061.png pixels [109, 16, 377, 33]) | LP: last name |
| p23-lp-first-name | blank | name | investor | yes | 136.2, 223.9, 334.6, 238.7 | comb/box printed in a picture (im-061.png pixels [109, 30, 376, 50]) | LP: first name |
| p23-lp-residence | blank | address | investor | yes | 136.2, 236.5, 335.3, 249.1 | comb/box printed in a picture (im-061.png pixels [109, 47, 377, 64]) | LP: residence address, street |
| p23-lp-res-city | blank | text | investor | yes | 136.2, 249.9, 257.3, 262.5 | comb/box printed in a picture (im-061.png pixels [109, 65, 272, 82]) | LP: residence city |
| p23-lp-res-state | blank | text | investor | yes | 261.0, 249.9, 281.8, 262.5 | comb/box printed in a picture (im-061.png pixels [277, 65, 305, 82]) | LP: residence state |
| p23-lp-res-zip | blank | text | investor | yes | 284.8, 249.9, 335.3, 262.5 | comb/box printed in a picture (im-061.png pixels [309, 65, 377, 82]) | LP: residence zip |
| p23-lp-addl-1 | blank | text | investor-entity | no | 136.2, 260.3, 334.6, 274.4 | comb/box printed in a picture (im-061.png pixels [109, 79, 376, 98]) | LP: additional information (for estates, partnerships, trusts and corporations), line 1 |
| p23-lp-addl-2 | blank | text | investor-entity | no | 136.2, 272.2, 335.3, 287.0 | comb/box printed in a picture (im-061.png pixels [109, 95, 377, 115]) | LP: additional information, line 2 |
| p23-lp-mailing | blank | address | investor | no | 136.2, 284.8, 335.3, 298.9 | comb/box printed in a picture (im-061.png pixels [109, 112, 377, 131]) | LP: mailing address (if different) |
| p23-lp-mail-city | blank | text | investor | no | 136.2, 296.7, 257.3, 309.3 | comb/box printed in a picture (im-061.png pixels [109, 128, 272, 145]) | LP: mailing city |
| p23-lp-mail-state | blank | text | investor | no | 261.0, 296.7, 281.8, 309.3 | comb/box printed in a picture (im-061.png pixels [277, 128, 305, 145]) | LP: mailing state |
| p23-lp-mail-zip | blank | text | investor | no | 284.8, 296.7, 335.3, 309.3 | comb/box printed in a picture (im-061.png pixels [309, 128, 377, 145]) | LP: mailing zip |
| p23-lp-email | blank | email | investor | no | 136.2, 311.2, 335.3, 321.2 | rule printed in a picture (im-061.png pixels [109, 160, 377, 161]); box = the rule and 10 pt above it | LP: e-mail address (a light rule) |
| p23-lp-phone-area | blank | phone | investor | yes | 136.2, 321.9, 166.7, 333.8 | comb/box printed in a picture (im-061.png pixels [109, 162, 150, 178]) | LP: telephone (area group) |
| p23-lp-phone-exchange | blank | phone | investor | yes | 178.6, 321.9, 209.0, 333.8 | comb/box printed in a picture (im-061.png pixels [166, 162, 207, 178]) | LP: telephone (exchange group) |
| p23-lp-phone-number | blank | phone | investor | yes | 220.9, 321.9, 261.8, 333.8 | comb/box printed in a picture (im-061.png pixels [223, 162, 278, 178]) | LP: telephone (number group) |
| p23-lp-dob | blank | date | investor | yes | 273.6, 321.9, 333.8, 333.8 | comb/box printed in a picture (im-061.png pixels [294, 162, 375, 178]) | LP: date of birth (MMDDYY) |
| p23-lp-cust-name | blank | name | investor | no | 136.2, 339.8, 335.3, 353.1 | comb/box printed in a picture (im-061.png pixels [109, 186, 377, 204]) | LP: custodian name |
| p23-lp-cust-address | blank | address | investor | no | 136.2, 350.9, 335.3, 363.5 | comb/box printed in a picture (im-061.png pixels [109, 201, 377, 218]) | LP: custodian mailing address |
| p23-lp-cust-city | blank | text | investor | no | 136.2, 364.3, 255.8, 375.4 | comb/box printed in a picture (im-061.png pixels [109, 219, 270, 234]) | LP: custodian city |
| p23-lp-cust-state | blank | text | investor | no | 261.0, 364.3, 281.8, 375.4 | comb/box printed in a picture (im-061.png pixels [277, 219, 305, 234]) | LP: custodian state |
| p23-lp-cust-zip | blank | text | investor | no | 284.8, 364.3, 335.3, 375.4 | comb/box printed in a picture (im-061.png pixels [309, 219, 377, 234]) | LP: custodian zip |
| p23-joint-last-name | blank | name | co-investor | no | 340.5, 213.5, 539.6, 226.1 | comb/box printed in a picture (im-061.png pixels [384, 16, 652, 33]) | JOINT: last name |
| p23-joint-first-name | blank | name | co-investor | no | 340.5, 223.9, 539.6, 238.7 | comb/box printed in a picture (im-061.png pixels [384, 30, 652, 50]) | JOINT: first name |
| p23-joint-residence | blank | address | co-investor | no | 340.5, 236.5, 539.6, 249.1 | comb/box printed in a picture (im-061.png pixels [384, 47, 652, 64]) | JOINT: residence address, street |
| p23-joint-res-city | blank | text | co-investor | no | 340.5, 249.9, 461.6, 262.5 | comb/box printed in a picture (im-061.png pixels [384, 65, 547, 82]) | JOINT: residence city |
| p23-joint-res-state | blank | text | co-investor | no | 465.3, 249.9, 486.1, 262.5 | comb/box printed in a picture (im-061.png pixels [552, 65, 580, 82]) | JOINT: residence state |
| p23-joint-res-zip | blank | text | co-investor | no | 489.1, 249.9, 539.6, 262.5 | comb/box printed in a picture (im-061.png pixels [584, 65, 652, 82]) | JOINT: residence zip |
| p23-joint-addl-1 | blank | text | co-investor | no | 341.2, 260.3, 539.6, 274.4 | comb/box printed in a picture (im-061.png pixels [385, 79, 652, 98]) | JOINT: additional information (for estates, partnerships, trusts and corporations), line 1 |
| p23-joint-addl-2 | blank | text | co-investor | no | 340.5, 272.2, 539.6, 287.0 | comb/box printed in a picture (im-061.png pixels [384, 95, 652, 115]) | JOINT: additional information, line 2 |
| p23-joint-mailing | blank | address | co-investor | no | 340.5, 284.8, 539.6, 298.9 | comb/box printed in a picture (im-061.png pixels [384, 112, 652, 131]) | JOINT: mailing address (if different) |
| p23-joint-mail-city | blank | text | co-investor | no | 340.5, 296.7, 462.3, 309.3 | comb/box printed in a picture (im-061.png pixels [384, 128, 548, 145]) | JOINT: mailing city |
| p23-joint-mail-state | blank | text | co-investor | no | 465.3, 296.7, 486.1, 309.3 | comb/box printed in a picture (im-061.png pixels [552, 128, 580, 145]) | JOINT: mailing state |
| p23-joint-mail-zip | blank | text | co-investor | no | 489.1, 296.7, 539.6, 309.3 | comb/box printed in a picture (im-061.png pixels [584, 128, 652, 145]) | JOINT: mailing zip |
| p23-joint-email | blank | email | co-investor | no | 340.5, 311.2, 539.6, 321.2 | rule printed in a picture (im-061.png pixels [384, 160, 652, 161]); box = the rule and 10 pt above it | JOINT: e-mail address (a light rule) |
| p23-joint-phone-area | blank | phone | co-investor | no | 342.0, 321.9, 372.4, 333.8 | comb/box printed in a picture (im-061.png pixels [386, 162, 427, 178]) | JOINT: telephone (area group) |
| p23-joint-phone-exchange | blank | phone | co-investor | no | 384.3, 321.9, 414.8, 333.8 | comb/box printed in a picture (im-061.png pixels [443, 162, 484, 178]) | JOINT: telephone (exchange group) |
| p23-joint-phone-number | blank | phone | co-investor | no | 426.7, 321.9, 467.5, 333.8 | comb/box printed in a picture (im-061.png pixels [500, 162, 555, 178]) | JOINT: telephone (number group) |
| p23-joint-dob | blank | date | co-investor | no | 479.4, 321.9, 539.6, 333.8 | comb/box printed in a picture (im-061.png pixels [571, 162, 652, 178]) | JOINT: date of birth (MMDDYY) |
| p23-joint-cust-name | blank | name | co-investor | no | 340.5, 339.8, 539.6, 353.1 | comb/box printed in a picture (im-061.png pixels [384, 186, 652, 204]) | JOINT: custodian name |
| p23-joint-cust-address | blank | address | co-investor | no | 340.5, 350.9, 539.6, 363.5 | comb/box printed in a picture (im-061.png pixels [384, 201, 652, 218]) | JOINT: custodian mailing address |
| p23-joint-cust-city | blank | text | co-investor | no | 340.5, 364.3, 460.1, 375.4 | comb/box printed in a picture (im-061.png pixels [384, 219, 545, 234]) | JOINT: custodian city |
| p23-joint-cust-state | blank | text | co-investor | no | 465.3, 364.3, 486.1, 375.4 | comb/box printed in a picture (im-061.png pixels [552, 219, 580, 234]) | JOINT: custodian state |
| p23-joint-cust-zip | blank | text | co-investor | no | 489.1, 364.3, 539.6, 375.4 | comb/box printed in a picture (im-061.png pixels [584, 219, 652, 234]) | JOINT: custodian zip |
| p23-pay-a | tickbox | tickbox | investor | no | 133.9, 441.4, 142.2, 450.0 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | Additional: payment to Series A |
| p23-pay-b | tickbox | tickbox | investor | no | 154.4, 441.4, 163.1, 450.0 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | Additional: Series B escrow account |
| p23-series-a | tickbox | tickbox | investor | no | 263.9, 497.2, 272.2, 505.4 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | Additional: Series A units |
| p23-series-b | tickbox | tickbox | investor | no | 284.0, 497.2, 292.3, 505.4 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | Additional: Series B units |
| p23-agree | tickbox | tickbox | investor | no | 535.0, 597.2, 543.6, 605.9 | tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi) | I agree (no change in financial circumstances) |
| p23-prospectus-date | blank | date | investor | yes | 75.3, 558.2, 134.7, 570.0 | comb/box printed in a picture (im-067.png pixels [0, 0, 80, 16]) | Additional: prospectus dated (MMDDYY) |
| p23-total | blank | amount | investor | yes | 170.4, 640.6, 272.9, 651.8 | comb/box printed in a picture (im-062.png pixels [177, 2, 315, 17]) | Additional: total amount $ |
| p23-total-cents | blank | amount | investor | no | 277.4, 640.6, 296.7, 651.8 | comb/box printed in a picture (im-062.png pixels [321, 2, 347, 17]) | Additional: total amount cents |
| p23-series-a-amount | blank | amount | investor | no | 361.3, 640.6, 435.6, 652.5 | comb/box printed in a picture (im-062.png pixels [434, 2, 534, 18]) | Additional: thereof Series A |
| p23-series-a-cents | blank | amount | investor | no | 440.8, 640.6, 460.1, 652.5 | comb/box printed in a picture (im-062.png pixels [541, 2, 567, 18]) | Additional: Series A cents |
| p23-series-b-amount | blank | amount | investor | no | 361.3, 651.0, 435.6, 662.9 | comb/box printed in a picture (im-062.png pixels [434, 16, 534, 32]) | Additional: Series B |
| p23-series-b-cents | blank | amount | investor | no | 440.8, 651.0, 460.1, 662.9 | comb/box printed in a picture (im-062.png pixels [541, 16, 567, 32]) | Additional: Series B cents |
| p23-brokerage | blank | text | investor | no | 171.1, 662.9, 281.8, 675.5 | comb/box printed in a picture (im-062.png pixels [178, 32, 327, 49]) | Additional: brokerage account # |
| p23-ssn-1 | blank | tax number | investor | no | 170.4, 673.3, 199.4, 685.2 | comb/box printed in a picture (im-062.png pixels [177, 46, 216, 62]) | Additional: social security # (group 1 of 3) |
| p23-ssn-2 | blank | tax number | investor | no | 210.5, 673.3, 229.8, 685.2 | comb/box printed in a picture (im-062.png pixels [231, 46, 257, 62]) | Additional: social security # (group 2 of 3) |
| p23-ssn-3 | blank | tax number | investor | no | 241.0, 673.3, 278.1, 685.2 | comb/box printed in a picture (im-062.png pixels [272, 46, 322, 62]) | Additional: social security # (group 3 of 3) |
| p23-taxpayer-id-1 | blank | tax number | investor-entity | no | 361.3, 674.1, 380.6, 685.2 | comb/box printed in a picture (im-062.png pixels [434, 47, 460, 62]) | Additional: taxpayer ID # (group 1) |
| p23-taxpayer-id-2 | blank | tax number | investor-entity | no | 391.8, 674.1, 457.1, 685.2 | comb/box printed in a picture (im-062.png pixels [475, 47, 563, 62]) | Additional: taxpayer ID # (group 2) |

Must NOT get a field: broker-dealer header block (printed); title picture letter.

### Page 24

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p24-type-01 | tickbox | tickbox | investor | no | 76.8, 36.7, 85.0, 45.6 | tick square printed in a picture (im-070.png pixels [0, 12, 11, 24]) | Investor type (check one): Individual ownership |
| p24-type-02 | tickbox | tickbox | investor-entity | no | 76.8, 48.5, 85.0, 57.5 | tick square printed in a picture (im-070.png pixels [0, 28, 11, 40]) | Investor type (check one): Partnership |
| p24-type-03 | tickbox | tickbox | investor-entity | no | 76.8, 60.4, 85.0, 69.3 | tick square printed in a picture (im-070.png pixels [0, 44, 11, 56]) | Investor type (check one): Corporation |
| p24-type-04 | tickbox | tickbox | investor | no | 76.8, 73.1, 85.0, 81.2 | tick square printed in a picture (im-070.png pixels [0, 61, 11, 72]) | Investor type (check one): Tenants in common |
| p24-type-05 | tickbox | tickbox | investor | no | 76.8, 85.0, 85.0, 93.1 | tick square printed in a picture (im-070.png pixels [0, 77, 11, 88]) | Investor type (check one): Joint tenants with right of survivorship |
| p24-type-06 | tickbox | tickbox | investor | no | 187.5, 36.7, 196.4, 45.6 | tick square printed in a picture (im-070.png pixels [149, 12, 161, 24]) | Investor type (check one): Community property |
| p24-type-07 | tickbox | tickbox | investor-entity | no | 187.5, 48.5, 196.4, 57.5 | tick square printed in a picture (im-070.png pixels [149, 28, 161, 40]) | Investor type (check one): Estate |
| p24-type-08 | tickbox | tickbox | investor-entity | no | 187.5, 60.4, 196.4, 69.3 | tick square printed in a picture (im-070.png pixels [149, 44, 161, 56]) | Investor type (check one): Grantor or other revocable trust |
| p24-type-09 | tickbox | tickbox | investor-entity | no | 187.5, 73.1, 196.4, 81.2 | tick square printed in a picture (im-070.png pixels [149, 61, 161, 72]) | Investor type (check one): Trust other than a grantor or revocable trust |
| p24-type-10 | tickbox | tickbox | investor | no | 187.5, 85.0, 196.4, 93.1 | tick square printed in a picture (im-070.png pixels [149, 77, 161, 88]) | Investor type (check one): UGMA/UTMA (minor) |
| p24-type-11 | tickbox | tickbox | investor | no | 321.2, 36.7, 330.1, 45.6 | tick square printed in a picture (im-070.png pixels [329, 12, 341, 24]) | Investor type (check one): IRA |
| p24-type-12 | tickbox | tickbox | investor | no | 321.2, 48.5, 330.1, 57.5 | tick square printed in a picture (im-070.png pixels [329, 28, 341, 40]) | Investor type (check one): IRA rollover |
| p24-type-13 | tickbox | tickbox | investor-entity | no | 321.2, 60.4, 330.1, 69.3 | tick square printed in a picture (im-070.png pixels [329, 44, 341, 56]) | Investor type (check one): Profit sharing |
| p24-type-14 | tickbox | tickbox | investor-entity | no | 402.9, 36.7, 411.8, 45.6 | tick square printed in a picture (im-070.png pixels [439, 12, 451, 24]) | Investor type (check one): Defined benefit |
| p24-type-15 | tickbox | tickbox | investor-entity | no | 402.9, 48.5, 411.8, 57.5 | tick square printed in a picture (im-070.png pixels [439, 28, 451, 40]) | Investor type (check one): Pension |
| p24-type-16 | tickbox | tickbox | investor | no | 402.9, 60.4, 411.8, 69.3 | tick square printed in a picture (im-070.png pixels [439, 44, 451, 56]) | Investor type (check one): SEP |
| p24-type-17 | tickbox | tickbox | investor | no | 485.4, 36.7, 493.5, 45.6 | tick square printed in a picture (im-070.png pixels [550, 12, 561, 24]) | Investor type (check one): Other (specify) |
| p24-lp-date | date | date | investor | no | 77.5, 286.3, 135.5, 296.3 | drawn rule at y=296.3 (box = the 10 pt of writing room above it) | Additional: date beside the limited partner signature |
| p24-lp-signature | signature | signature | investor | no | 142.9, 286.3, 287.8, 296.3 | drawn rule at y=296.3 (box = the 10 pt of writing room above it) | Additional: signature of limited partner |
| p24-joint-date | date | date | co-investor | no | 295.2, 286.3, 353.1, 296.3 | drawn rule at y=296.3 (box = the 10 pt of writing room above it) | Additional: date (joint) |
| p24-joint-signature | signature | signature | co-investor | no | 360.6, 286.3, 578.2, 296.3 | drawn rule at y=296.3 (box = the 10 pt of writing room above it) | Additional: signature of joint limited partner (if any) or custodian |
| p24-bd-date | date | date | third-party | no | 77.5, 433.4, 135.5, 443.4 | drawn rule at y=443.4 (box = the 10 pt of writing room above it) | Additional: date beside the registered representative signature |
| p24-rr-signature | signature | signature | third-party | no | 142.9, 433.4, 287.8, 443.4 | drawn rule at y=443.4 (box = the 10 pt of writing room above it) | Additional: registered representative signature |
| p24-principal-date | date | date | third-party | no | 295.2, 433.4, 353.1, 443.4 | drawn rule at y=443.4 (box = the 10 pt of writing room above it) | Additional: date beside the principal signature |
| p24-principal-signature | signature | signature | third-party | no | 360.6, 433.4, 578.2, 443.4 | drawn rule at y=443.4 (box = the 10 pt of writing room above it) | Additional: principal signature |
| p24-rr-print-name | blank | name | third-party | no | 111.0, 484.6, 299.6, 496.5 | comb/box printed in a picture (im-071.png pixels [58, 0, 312, 16]) | Additional: registered representative print name |
| p24-principal-print-name | blank | name | third-party | no | 355.4, 484.6, 544.0, 496.5 | comb/box printed in a picture (im-071.png pixels [387, 0, 641, 16]) | Additional: principal print name |

Must NOT get a field: the S logo and stripes in the margin.

### Page 25

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p25-prospectus-date | blank | date | investor | no | 475.0, 440.1, 534.4, 451.9 | comb/box printed in a picture (im-074.png pixels [0, 0, 80, 16]) | Exchange: prospectus dated (MMDDYY) |
| p25-dollar-amount | blank | amount | investor | no | 93.9, 604.2, 213.5, 616.1 | comb/box printed in a picture (im-073.png pixels [81, 22, 242, 38]) | Exchange election: dollar amount |
| p25-units | blank | amount | investor | no | 93.9, 640.6, 213.5, 652.5 | comb/box printed in a picture (im-073.png pixels [81, 71, 242, 87]) | Exchange election: number of units |
| p25-from-a | tickbox | tickbox | investor | no | 158.5, 661.4, 167.4, 670.3 | tick square printed in a picture (im-073.png pixels [168, 99, 180, 111]) | Redeemed from Series A |
| p25-from-b | tickbox | tickbox | investor | no | 209.8, 661.4, 218.7, 670.3 | tick square printed in a picture (im-073.png pixels [237, 99, 249, 111]) | Redeemed from Series B |
| p25-name | blank | name | investor | no | 93.9, 706.7, 312.3, 718.6 | comb/box printed in a picture (im-073.png pixels [81, 160, 375, 176]) | Exchange account information: name |
| p25-lp-number | blank | text | investor | no | 93.9, 717.9, 312.3, 732.0 | comb/box printed in a picture (im-073.png pixels [81, 175, 375, 194]) | Exchange: limited partner # |
| p25-street | blank | address | investor | no | 93.9, 730.5, 312.3, 742.4 | comb/box printed in a picture (im-073.png pixels [81, 192, 375, 208]) | Exchange: address street |
| p25-city | blank | text | investor | no | 93.9, 743.1, 235.0, 755.0 | comb/box printed in a picture (im-073.png pixels [81, 209, 271, 225]) | Exchange: city |
| p25-state | blank | text | investor | no | 238.0, 743.1, 258.8, 755.0 | comb/box printed in a picture (im-073.png pixels [275, 209, 303, 225]) | Exchange: state |
| p25-zip | blank | text | investor | no | 262.5, 743.1, 313.0, 755.0 | comb/box printed in a picture (im-073.png pixels [308, 209, 376, 225]) | Exchange: zip |
| p25-phone-area | blank | phone | investor | no | 362.1, 706.7, 392.5, 720.1 | comb/box printed in a picture (im-073.png pixels [442, 160, 483, 178]) | Exchange telephone (area group) |
| p25-phone-exchange | blank | phone | investor | no | 404.4, 706.7, 434.9, 720.1 | comb/box printed in a picture (im-073.png pixels [499, 160, 540, 178]) | Exchange telephone (exchange group) |
| p25-phone-number | blank | phone | investor | no | 446.7, 706.7, 487.6, 720.1 | comb/box printed in a picture (im-073.png pixels [556, 160, 611, 178]) | Exchange telephone (number group) |
| p25-fax-area | blank | phone | investor | no | 362.1, 717.9, 392.5, 732.0 | comb/box printed in a picture (im-073.png pixels [442, 175, 483, 194]) | Exchange fax (area group) |
| p25-fax-exchange | blank | phone | investor | no | 404.4, 717.9, 434.9, 732.0 | comb/box printed in a picture (im-073.png pixels [499, 175, 540, 194]) | Exchange fax (exchange group) |
| p25-fax-number | blank | phone | investor | no | 446.7, 717.9, 487.6, 732.0 | comb/box printed in a picture (im-073.png pixels [556, 175, 611, 194]) | Exchange fax (number group) |
| p25-email | blank | email | investor | no | 362.1, 729.8, 511.4, 742.4 | one comb printed in a picture (im-073.png), joined from 1 pieces split by a neighbouring row | Exchange: e-mail |

Must NOT get a field: title picture letter.

### Page 26

Must NOT get a field: prose, instructions or logos only; no place.

### Page 27

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p27-lp-name | blank | name | investor | yes | 144.4, 486.1, 363.5, 497.2 | comb/box printed in a picture (im-078.png pixels [149, 28, 444, 43]) | Exchange signatures: name of limited partner |
| p27-lp-date | date | date | investor | yes | 385.1, 486.1, 465.3, 497.2 | comb/box printed in a picture (im-078.png pixels [473, 28, 581, 43]) | Exchange: date (limited partner) |
| p27-lp-signature | signature | signature | investor | yes | 145.1, 513.2, 362.8, 523.2 | rule printed in a picture (im-078.png pixels [150, 77, 443, 78]); box = the rule and 10 pt above it | Exchange: signature (limited partner) |
| p27-joint-name | blank | name | co-investor | no | 144.4, 528.5, 363.5, 539.6 | comb/box printed in a picture (im-078.png pixels [149, 85, 444, 100]) | Exchange: name of joint limited partner (or custodian or trustee) (doubt: captioned joint LP OR custodian OR trustee) |
| p27-joint-date | date | date | co-investor | no | 385.1, 528.5, 465.3, 539.6 | comb/box printed in a picture (im-078.png pixels [473, 85, 581, 100]) | Exchange: date (joint) |
| p27-joint-signature | signature | signature | co-investor | no | 145.1, 561.5, 362.8, 571.5 | rule printed in a picture (im-078.png pixels [150, 142, 443, 143]); box = the rule and 10 pt above it | Exchange: signature (joint) |
| p27-bd-series-a | tickbox | tickbox | third-party | no | 412.9, 681.1, 417.1, 686.0 | letter "o" printed as a tick box (ink measured at 400 dpi) | Broker-dealer certification: exchange from Series A (check applicable box) (doubt: inside the broker-dealer certification) |
| p27-bd-series-b | tickbox | tickbox | third-party | no | 443.0, 681.1, 447.1, 686.0 | letter "o" printed as a tick box (ink measured at 400 dpi) | Broker-dealer certification: exchange from Series B (doubt: inside the broker-dealer certification) |

### Page 28

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p28-bd-firm | blank | name | third-party | no | 143.6, 50.0, 461.6, 61.2 | comb/box printed in a picture (im-079.png pixels [148, 30, 576, 45]) | Exchange: broker-dealer firm name |
| p28-rr-name | blank | name | third-party | no | 143.6, 67.9, 362.1, 79.8 | comb/box printed in a picture (im-079.png pixels [148, 54, 442, 70]) | Exchange: name of registered representative |
| p28-rr-date | date | date | third-party | no | 384.3, 67.9, 463.8, 79.8 | comb/box printed in a picture (im-079.png pixels [472, 54, 579, 70]) | Exchange: date (representative) |
| p28-rr-signature | signature | signature | third-party | no | 144.4, 92.0, 362.1, 102.0 | rule printed in a picture (im-079.png pixels [149, 99, 442, 100]); box = the rule and 10 pt above it | Exchange: representative signature |
| p28-principal-name | blank | name | third-party | no | 143.6, 110.2, 362.1, 122.1 | comb/box printed in a picture (im-079.png pixels [148, 111, 442, 127]) | Exchange: name of principal |
| p28-principal-date | date | date | third-party | no | 384.3, 110.2, 463.8, 122.1 | comb/box printed in a picture (im-079.png pixels [472, 111, 579, 127]) | Exchange: date (principal) |
| p28-principal-signature | signature | signature | third-party | no | 144.4, 134.4, 362.1, 144.4 | rule printed in a picture (im-079.png pixels [149, 156, 442, 157]); box = the rule and 10 pt above it | Exchange: principal signature |

### Page 29

Must NOT get a field: prose, instructions or logos only; no place.

### Page 30

Must NOT get a field: prose, instructions or logos only; no place.
