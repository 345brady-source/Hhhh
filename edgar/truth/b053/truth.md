# Answer sheet: b053 (18 pages)

File: `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b053/doc.pdf`

PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt of writing room above it. Cell or box: its printed edges. Tick box: the printed square.

Picture pages: cells, squares and rules found as ink in each embedded picture at its own resolution (inklist.py), thin boxes snapped to their printed edges (snap.py), converted through the drawing matrix; every picture looked at; overlays looked at.

## Who signs

Oxford Park Income Fund investor application printed from a browser: six form pages, each one picture (1700x2200 px) on its own PDF page, plus a W-9. The investor and joint investor sign form page 4; the fund accepts beside it (firm); the custodian signs and guarantees on page 3; the broker-dealer/RIA completes and signs page 5.

- Investor pages: [2, 5, 8, 11, 17]
- Firm pages: [11]
- Co-investor: True
- Third parties: custodian (page 8); broker-dealer / RIA representative and supervisor (page 14)

Pictures drawn at x 32.17-584.25, y 36.58-750.98 with a page clip at y 735.75; nothing printed falls below the clip except footers.

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 2 | 6 | 6 | 0 | 0 | 0 | 0 | sure (boxes measured from the picture pixels) |
| 3 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 4 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 5 | 44 | 20 | 0 | 24 | 0 | 0 | sure (boxes measured from the picture pixels) |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 7 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 8 | 52 | 27 | 1 | 21 | 2 | 1 | sure; the bottom row (ABA/account) may be cut near the page clip (check) |
| 9 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 10 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 11 | 8 | 0 | 0 | 2 | 3 | 3 | sure (boxes measured from the picture pixels) |
| 12 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 13 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 14 | 26 | 0 | 0 | 21 | 3 | 2 | sure (boxes measured from the picture pixels) |
| 15 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 16 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 17 | 22 | 7 | 0 | 13 | 1 | 1 | sure; W-9 rows measured from the picture's own rules; the sign row has no rule (signature and date boxes taken in the row, marked) |
| 18 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| all | 158 | 60 | 1 | 81 | 9 | 7 | |

By owner: co-investor 5, firm 4, investor 105, investor-entity 12, third-party 32

## Doubtful places (6)

- `p05-gov-id` (page 5): a box printed before an instruction; read as a tick box confirming the ID is attached
- `p08-edelivery-initials` (page 8): an uncaptioned box beside the consent paragraph; read as an initials box
- `p08-edelivery-email` (page 8): the only rule after the caption is the full-width section rule
- `p08-cust-medallion` (page 8): a stamp place of the custodian
- `p17-w9-signature` (page 17): the W-9 sign row has no rule: box taken in the row after the caption
- `p17-w9-date` (page 17): as above

## Places

### Page 1

Must NOT get a field: browser-print page with no picture.

### Page 2

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p02-inv-initial | tickbox | tickbox | investor | no | 68.9, 263.6, 75.4, 270.1 | square printed in the picture (picture im-000 pixels x 113-133, y 699-719) | Investment type: initial investment |
| p02-inv-additional | tickbox | tickbox | investor | no | 68.9, 280.5, 75.4, 286.9 | square printed in the picture (picture im-000 pixels x 113-133, y 751-771) | Investment type: additional purchase |
| p02-acct-brokerage | tickbox | tickbox | investor | no | 277.0, 263.6, 283.5, 270.1 | square printed in the picture (picture im-000 pixels x 754-774, y 699-719) | Account type: Brokerage account |
| p02-acct-ria | tickbox | tickbox | investor | no | 277.0, 280.5, 283.5, 286.9 | square printed in the picture (picture im-000 pixels x 754-774, y 751-771) | Account type: Registered investment adviser (unaffiliated) |
| p02-acct-advisory | tickbox | tickbox | investor | no | 386.8, 263.6, 393.3, 270.1 | square printed in the picture (picture im-000 pixels x 1092-1112, y 699-719) | Account type: Advisory account |
| p02-acct-other | tickbox | tickbox | investor | no | 386.8, 298.0, 393.3, 304.5 | square printed in the picture (picture im-000 pixels x 1092-1112, y 805-825) | Account type: Other (discuss with your B/D) |

Must NOT get a field: "Prospectus dated (insert date)": the issuer completes it; "FBO: Investor Name: ____" in the wire instructions: a reference to write on the wire, not a place on the form; letters O read as squares in the headings.

### Page 3

Must NOT get a field: browser-print page with no picture.

### Page 4

Must NOT get a field: browser-print page with no picture.

### Page 5

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p05-class-a | tickbox | tickbox | investor | no | 128.3, 90.2, 135.1, 97.6 | printed box in the picture (edges measured as ink rows/columns) (picture im-001 pixels x 296-317, y 165-188) | Your investment: share class A |
| p05-class-c | tickbox | tickbox | investor | no | 186.4, 90.2, 193.2, 97.6 | printed box in the picture (edges measured as ink rows/columns) (picture im-001 pixels x 475-496, y 165-188) | Your investment: share class C |
| p05-class-i | tickbox | tickbox | investor | no | 251.1, 92.1, 258.2, 98.6 | square printed in the picture (picture im-001 pixels x 674-696, y 171-191) | Your investment: share class I |
| p05-amount | blank | amount | investor | yes | 65.0, 106.1, 110.4, 116.1 | rule printed in the picture; box = 10 pt above it (picture im-001 pixels x 101-241, y 214-245) | Total purchase amount (after "$") |
| p05-pay-enclosed | tickbox | tickbox | investor | no | 69.5, 147.6, 76.7, 154.5 | square printed in the picture (picture im-001 pixels x 115-137, y 342-363) | Method of payment: Funds enclosed |
| p05-pay-wired | tickbox | tickbox | investor | no | 152.0, 145.7, 158.8, 152.2 | square printed in the picture (picture im-001 pixels x 369-390, y 336-356) | Method of payment: Funds wired |
| p05-pay-custodian | tickbox | tickbox | investor | no | 214.4, 146.7, 221.5, 153.5 | square printed in the picture (picture im-001 pixels x 561-583, y 339-360) | Method of payment: Issued by custodian |
| p05-pay-transfer | tickbox | tickbox | investor | no | 297.5, 145.7, 304.3, 152.2 | square printed in the picture (picture im-001 pixels x 817-838, y 336-356) | Method of payment: Asset transfer |
| p05-waiver-ria | tickbox | tickbox | investor | no | 68.2, 169.4, 75.4, 175.9 | square printed in the picture (picture im-001 pixels x 111-133, y 409-429) | Waiver: registered investment advisors (RIA), waiver of commission only |
| p05-waiver-ria-affiliated | tickbox | tickbox | investor | no | 86.4, 188.6, 93.2, 195.4 | square printed in the picture (picture im-001 pixels x 167-188, y 468-489) | RIA waiver: RIA affiliated with a broker-dealer |
| p05-waiver-ria-unaffiliated | tickbox | tickbox | investor | no | 86.4, 205.1, 93.2, 211.9 | square printed in the picture (picture im-001 pixels x 167-188, y 519-540) | RIA waiver: RIA not affiliated with a broker-dealer |
| p05-waiver-rr | tickbox | tickbox | investor | no | 68.2, 228.8, 75.4, 235.6 | square printed in the picture (picture im-001 pixels x 111-133, y 592-613) | Registered representative: waiver or reduction of commission |
| p05-waiver-dm | tickbox | tickbox | investor | no | 68.2, 246.7, 75.0, 253.5 | square printed in the picture (picture im-001 pixels x 111-132, y 647-668) | Waiver of commission and dealer manager fee |
| p05-relative | blank | text | investor | no | 384.5, 333.1, 545.0, 343.1 | rule printed in the picture; box = 10 pt above it (picture im-001 pixels x 1085-1579, y 913-944) | Family member: relationship and name of relative |
| p05-title-mr | tickbox | tickbox | investor | no | 316.3, 376.2, 323.5, 383.1 | square printed in the picture (picture im-001 pixels x 875-897, y 1046-1067) | Title: Mr |
| p05-title-mrs | tickbox | tickbox | investor | no | 346.9, 376.2, 353.7, 383.1 | square printed in the picture (picture im-001 pixels x 969-990, y 1046-1067) | Title: Mrs |
| p05-title-ms | tickbox | tickbox | investor | no | 381.0, 376.2, 387.8, 383.1 | square printed in the picture (picture im-001 pixels x 1074-1095, y 1046-1067) | Title: Ms |
| p05-title-other | tickbox | tickbox | investor | no | 412.8, 376.2, 419.6, 383.1 | square printed in the picture (picture im-001 pixels x 1172-1193, y 1046-1067) | Title: Other |
| p05-title-other-which | blank | text | investor | no | 444.9, 373.1, 560.2, 383.1 | rule printed in the picture; box = 10 pt above it (picture im-001 pixels x 1271-1626, y 1036-1067) | Title: other, which |
| p05-name | blank | name | investor | yes | 67.2, 384.4, 559.2, 396.1 | cell drawn in the picture (four rules) (picture im-001 pixels x 108-1623, y 1071-1107) | Name of investor, trustee or authorized signer (required) |
| p05-joint-name | blank | name | co-investor | no | 67.2, 405.5, 559.2, 417.2 | cell drawn in the picture (four rules) (picture im-001 pixels x 108-1623, y 1136-1172) | Name of joint investor |
| p05-entity-name | blank | name | investor-entity | no | 67.2, 426.3, 559.2, 437.9 | cell drawn in the picture (four rules) (picture im-001 pixels x 108-1623, y 1200-1236) | Name of trust, business or plan |
| p05-street | blank | address | investor | yes | 67.2, 463.3, 559.2, 475.0 | cell drawn in the picture (four rules) (picture im-001 pixels x 108-1623, y 1314-1350) | Street address (no P.O. box, required) |
| p05-city | blank | text | investor | yes | 67.2, 483.4, 407.3, 495.1 | cell drawn in the picture (four rules) (picture im-001 pixels x 108-1155, y 1376-1412) | City |
| p05-state | blank | text | investor | yes | 415.1, 483.4, 482.0, 495.1 | cell drawn in the picture (four rules) (picture im-001 pixels x 1179-1385, y 1376-1412) | State |
| p05-zip | blank | text | investor | yes | 491.0, 483.4, 559.6, 495.1 | cell drawn in the picture (four rules) (picture im-001 pixels x 1413-1624, y 1376-1412) | Zip code |
| p05-home-phone | blank | phone | investor | yes | 67.2, 503.2, 260.8, 515.2 | cell drawn in the picture (four rules) (picture im-001 pixels x 108-704, y 1437-1474) | Home phone (required) |
| p05-business-phone | blank | phone | investor | no | 323.5, 503.2, 482.0, 515.2 | cell drawn in the picture (four rules) (picture im-001 pixels x 897-1385, y 1437-1474) | Business phone |
| p05-phone-ext | blank | text | investor | no | 491.0, 503.2, 559.6, 515.2 | cell drawn in the picture (four rules) (picture im-001 pixels x 1413-1624, y 1437-1474) | Phone extension |
| p05-alt-address | blank | address | investor | no | 67.2, 537.0, 559.2, 549.0 | cell drawn in the picture (four rules) (picture im-001 pixels x 108-1623, y 1541-1578) | Alternate mailing address or P.O. box |
| p05-alt-city | blank | text | investor | no | 67.2, 557.4, 407.3, 569.1 | cell drawn in the picture (four rules) (picture im-001 pixels x 108-1155, y 1604-1640) | City (alternate) |
| p05-alt-state | blank | text | investor | no | 415.1, 557.4, 482.0, 569.1 | cell drawn in the picture (four rules) (picture im-001 pixels x 1179-1385, y 1604-1640) | State (alternate) |
| p05-alt-zip | blank | text | investor | no | 491.0, 557.4, 559.6, 569.1 | cell drawn in the picture (four rules) (picture im-001 pixels x 1413-1624, y 1604-1640) | Zip code (alternate) |
| p05-dob | blank | date | investor | yes | 67.2, 596.7, 223.4, 608.7 | cell drawn in the picture (four rules) (picture im-001 pixels x 108-589, y 1725-1762) | Investor date of birth (or trust/entity date) (required) |
| p05-joint-dob | blank | date | co-investor | no | 241.6, 596.7, 397.5, 608.7 | cell drawn in the picture (four rules) (picture im-001 pixels x 645-1125, y 1725-1762) | Joint investor / authorized signer date of birth |
| p05-entity-tax-id | blank | tax number | investor-entity | no | 415.4, 596.7, 559.6, 608.7 | cell drawn in the picture (four rules) (picture im-001 pixels x 1180-1624, y 1725-1762) | Entity tax ID # (if applicable) |
| p05-ssn | blank | tax number | investor | yes | 67.2, 624.0, 223.4, 635.7 | cell drawn in the picture (four rules) (picture im-001 pixels x 108-589, y 1809-1845) | Investor SSN (required) |
| p05-joint-ssn | blank | tax number | co-investor | no | 241.6, 624.0, 397.5, 635.7 | cell drawn in the picture (four rules) (picture im-001 pixels x 645-1125, y 1809-1845) | Joint investor / authorized signer SSN |
| p05-email | blank | email | investor | no | 415.4, 624.0, 559.6, 635.7 | cell drawn in the picture (four rules) (picture im-001 pixels x 1180-1624, y 1809-1845) | Email address |
| p05-cit-us | tickbox | tickbox | investor | no | 69.2, 669.1, 76.3, 676.0 | square printed in the picture (picture im-001 pixels x 114-136, y 1948-1969) | Citizenship: U.S. citizen |
| p05-cit-resident | tickbox | tickbox | investor | no | 169.5, 669.1, 176.4, 676.0 | square printed in the picture (picture im-001 pixels x 423-444, y 1948-1969) | Citizenship: resident alien |
| p05-cit-nonresident | tickbox | tickbox | investor | no | 282.9, 669.1, 289.7, 676.0 | square printed in the picture (picture im-001 pixels x 772-793, y 1948-1969) | Citizenship: non-resident alien |
| p05-country | blank | text | investor | no | 415.1, 668.9, 560.2, 678.9 | rule printed in the picture; box = 10 pt above it (picture im-001 pixels x 1179-1626, y 1947-1978) | Non-resident alien: country of origin |
| p05-gov-id | tickbox | tickbox | investor | no | 68.5, 697.1, 75.4, 703.9 | square printed in the picture (picture im-001 pixels x 112-133, y 2034-2055) | Please attach acceptable government-issued ID (a box before the instruction) (doubt: a box printed before an instruction; read as a tick box confirming the ID is attached) |

Must NOT get a field: underlined words (check one, only if, and, indicate); letters O and D read as squares; the section rule under the waiver block.

### Page 6

Must NOT get a field: browser-print page with no picture.

### Page 7

Must NOT get a field: browser-print page with no picture.

### Page 8

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p08-edelivery-initials | initials | initials | investor | no | 61.1, 114.5, 91.6, 144.4 | cell drawn in the picture (four rules) (picture im-002 pixels x 89-183, y 240-332) | Electronic delivery consent: a box left of the paragraph (initial to consent) (doubt: an uncaptioned box beside the consent paragraph; read as an initials box) |
| p08-edelivery-email | blank | email | investor | no | 266.0, 163.9, 559.9, 173.9 | rule printed in the picture; box = 10 pt above it (picture im-002 pixels x 720-1625, y 392-423) | Electronic delivery: e-mail address (after the caption, on the section rule) (doubt: the only rule after the caption is the full-width section rule) |
| p08-own-individual | tickbox | tickbox | investor | no | 57.8, 189.5, 65.0, 195.7 | square printed in the picture (picture im-002 pixels x 79-101, y 471-490) | Non-custodial ownership: Individual |
| p08-own-jtwros | tickbox | tickbox | investor | no | 57.8, 211.9, 65.0, 218.1 | square printed in the picture (picture im-002 pixels x 79-101, y 540-559) | Non-custodial ownership: Joint tenants with right of survivorship |
| p08-own-tic | tickbox | tickbox | investor | no | 57.8, 224.9, 65.0, 231.1 | square printed in the picture (picture im-002 pixels x 79-101, y 580-599) | Non-custodial ownership: Tenants in common |
| p08-own-community | tickbox | tickbox | investor | no | 57.8, 239.2, 65.0, 245.4 | square printed in the picture (picture im-002 pixels x 79-101, y 624-643) | Non-custodial ownership: Community property |
| p08-own-pension | tickbox | tickbox | investor-entity | no | 184.5, 189.5, 191.3, 195.7 | square printed in the picture (picture im-002 pixels x 469-490, y 471-490) | Non-custodial ownership: Pension, profit sharing plan or 401K |
| p08-own-trust | tickbox | tickbox | investor-entity | no | 184.5, 206.4, 191.3, 212.6 | square printed in the picture (picture im-002 pixels x 469-490, y 523-542) | Non-custodial ownership: Trust |
| p08-own-ugma | tickbox | tickbox | investor | no | 435.5, 198.0, 442.7, 204.1 | square printed in the picture (picture im-002 pixels x 1242-1264, y 497-516) | Non-custodial ownership: Uniform Gift / Transfers to Minors Act |
| p08-own-partnership | tickbox | tickbox | investor-entity | no | 435.5, 219.7, 442.7, 225.9 | square printed in the picture (picture im-002 pixels x 1242-1264, y 564-583) | Non-custodial ownership: Partnership or LLC |
| p08-own-other | tickbox | tickbox | investor | no | 435.5, 244.1, 442.7, 250.3 | square printed in the picture (picture im-002 pixels x 1242-1264, y 639-658) | Non-custodial ownership: Other |
| p08-own-corporation | tickbox | tickbox | investor-entity | no | 325.1, 203.2, 331.6, 209.3 | printed box in the picture (edges measured as ink rows/columns) (picture im-002 pixels x 902-922, y 513-532) | Non-custodial ownership: corporation |
| p08-own-s-corp | tickbox | tickbox | investor-entity | no | 334.2, 229.8, 341.0, 235.6 | printed box in the picture (edges measured as ink rows/columns) (picture im-002 pixels x 930-951, y 595-613) | Corporation: S-Corp |
| p08-own-c-corp | tickbox | tickbox | investor-entity | no | 334.2, 237.3, 341.0, 243.1 | printed box in the picture (edges measured as ink rows/columns) (picture im-002 pixels x 930-951, y 618-636) | Corporation: C-Corp |
| p08-own-trust-revocable | tickbox | tickbox | investor-entity | no | 194.2, 233.7, 200.7, 239.2 | printed box in the picture (edges measured as ink rows/columns) (picture im-002 pixels x 499-519, y 607-624) | Trust: currently revocable |
| p08-own-trust-irrevocable | tickbox | tickbox | investor-entity | no | 194.2, 241.8, 200.7, 248.0 | printed box in the picture (edges measured as ink rows/columns) (picture im-002 pixels x 499-519, y 632-651) | Trust: irrevocable |
| p08-own-other-specify | blank | text | investor | no | 464.7, 249.0, 555.3, 259.0 | rule printed in the picture; box = 10 pt above it (picture im-002 pixels x 1332-1611, y 654-685) | Other ownership: specify |
| p08-cust-ira | tickbox | tickbox | investor | no | 60.4, 267.1, 67.2, 273.3 | square printed in the picture (picture im-002 pixels x 87-108, y 710-729) | Custodial ownership: IRA |
| p08-cust-ira-type | blank | text | investor | no | 81.5, 264.0, 150.1, 274.0 | rule printed in the picture; box = 10 pt above it (picture im-002 pixels x 152-363, y 700-731) | IRA: type |
| p08-cust-qualified | tickbox | tickbox | investor | no | 159.8, 266.5, 166.6, 272.7 | square printed in the picture (picture im-002 pixels x 393-414, y 708-727) | Custodial ownership: qualified pension or profit sharing plan |
| p08-cust-nonqualified | tickbox | tickbox | investor | no | 324.4, 268.8, 331.3, 274.9 | square printed in the picture (picture im-002 pixels x 900-921, y 715-734) | Custodial ownership: non-qualified custodian account |
| p08-cust-other | tickbox | tickbox | investor | no | 460.5, 269.1, 467.7, 275.3 | square printed in the picture (picture im-002 pixels x 1319-1341, y 716-735) | Custodial ownership: other |
| p08-cust-other-specify | blank | text | investor | no | 491.0, 271.4, 555.3, 281.4 | rule printed in the picture; box = 10 pt above it (picture im-002 pixels x 1413-1611, y 723-754) | Custodial other: which |
| p08-cust-inherited | tickbox | tickbox | investor | no | 393.9, 287.3, 399.5, 291.8 | printed box in the picture (edges measured as ink rows/columns) (picture im-002 pixels x 1114-1131, y 772-786) | Inherited/beneficiary IRA |
| p08-cust-name | blank | name | investor | no | 57.2, 294.7, 391.0, 305.1 | cell drawn in the picture (four rules) (picture im-002 pixels x 77-1105, y 795-827) | Name of custodian or trustee |
| p08-cust-deceased | blank | name | investor | no | 393.9, 294.7, 559.6, 305.5 | cell drawn in the picture (four rules) (picture im-002 pixels x 1114-1624, y 795-828) | Inherited IRA: deceased's name (required) |
| p08-cust-address | blank | address | investor | no | 56.9, 312.9, 558.9, 323.6 | cell drawn in the picture (four rules) (picture im-002 pixels x 76-1622, y 851-884) | Custodian mailing address |
| p08-cust-city | blank | text | investor | no | 56.5, 331.8, 403.4, 342.1 | cell drawn in the picture (four rules) (picture im-002 pixels x 75-1143, y 909-941) | Custodian city |
| p08-cust-state | blank | text | investor | no | 423.2, 332.7, 480.7, 343.4 | cell drawn in the picture (four rules) (picture im-002 pixels x 1204-1381, y 912-945) | Custodian state |
| p08-cust-zip | blank | text | investor | no | 489.7, 332.7, 558.3, 343.4 | cell drawn in the picture (four rules) (picture im-002 pixels x 1409-1620, y 912-945) | Custodian zip code |
| p08-cust-phone | blank | phone | investor | no | 56.5, 350.6, 254.0, 361.3 | cell drawn in the picture (four rules) (picture im-002 pixels x 75-683, y 967-1000) | Custodian business phone |
| p08-cust-tax-id | blank | tax number | third-party | no | 56.2, 373.0, 253.7, 383.4 | cell drawn in the picture (four rules) (picture im-002 pixels x 74-682, y 1036-1068) | Custodian tax ID |
| p08-cust-account | blank | text | third-party | no | 265.0, 373.0, 557.6, 383.4 | cell drawn in the picture (four rules) (picture im-002 pixels x 717-1618, y 1036-1068) | Custodian account # |
| p08-cust-admin-name | blank | name | third-party | no | 56.9, 390.5, 558.9, 400.9 | cell drawn in the picture (four rules) (picture im-002 pixels x 76-1622, y 1090-1122) | Name of custodian or other administrator |
| p08-cust-medallion | signature | signature | third-party | no | 58.8, 415.2, 202.0, 436.3 | cell drawn in the picture (four rules) (picture im-002 pixels x 82-523, y 1166-1231) | Custodian medallion signature guarantee (stamp box) (doubt: a stamp place of the custodian) |
| p08-cust-signature | signature | signature | third-party | no | 210.5, 416.5, 463.1, 427.2 | cell drawn in the picture (four rules) (picture im-002 pixels x 549-1327, y 1170-1203) | Signature of custodian (if applicable) |
| p08-cust-date | date | date | third-party | no | 473.5, 416.5, 559.9, 427.2 | cell drawn in the picture (four rules) (picture im-002 pixels x 1359-1625, y 1170-1203) | Date beside the custodian signature (required) |
| p08-dd-checking | tickbox | tickbox | investor | no | 348.8, 450.9, 355.6, 457.8 | square printed in the picture (picture im-002 pixels x 975-996, y 1276-1297) | Distribution account: checking |
| p08-dd-savings | tickbox | tickbox | investor | no | 388.1, 450.9, 394.9, 457.8 | square printed in the picture (picture im-002 pixels x 1096-1117, y 1276-1297) | Distribution account: savings |
| p08-dd-brokerage | tickbox | tickbox | investor | no | 421.9, 452.2, 428.7, 459.1 | square printed in the picture (picture im-002 pixels x 1200-1221, y 1280-1301) | Distribution account: brokerage |
| p08-dist-ach | tickbox | tickbox | investor | no | 106.9, 540.6, 113.7, 548.0 | printed box in the picture (edges measured as ink rows/columns) (picture im-002 pixels x 230-251, y 1552-1575) | Cash distributions: via direct deposit (ACH) |
| p08-dist-ach-checking | tickbox | tickbox | investor | no | 123.1, 550.3, 129.9, 557.8 | printed box in the picture (edges measured as ink rows/columns) (picture im-002 pixels x 280-301, y 1582-1605) | Direct deposit: checking (enclose voided check) |
| p08-dist-ach-savings | tickbox | tickbox | investor | no | 123.1, 560.7, 129.9, 568.2 | printed box in the picture (edges measured as ink rows/columns) (picture im-002 pixels x 280-301, y 1614-1637) | Direct deposit: savings |
| p08-dist-alt-address | tickbox | tickbox | investor | no | 106.2, 569.1, 113.0, 576.9 | square printed in the picture (picture im-002 pixels x 228-249, y 1640-1664) | Cash distributions: mail to alternate address (specify below) |
| p08-dist-street | tickbox | tickbox | investor | no | 106.2, 581.8, 113.0, 589.6 | square printed in the picture (picture im-002 pixels x 228-249, y 1679-1703) | Cash distributions: mail to street address |
| p08-bank-name | blank | name | investor | no | 57.2, 612.3, 558.3, 625.6 | cell drawn in the picture (four rules) (picture im-002 pixels x 77-1620, y 1773-1814) | Cash distributions directed to: Name of bank, brokerage firm or individual |
| p08-bank-alt-address | blank | address | investor | no | 58.2, 634.4, 559.2, 646.1 | cell drawn in the picture (four rules) (picture im-002 pixels x 80-1623, y 1841-1877) | Cash distributions directed to: Alternate address (optional) |
| p08-bank-city | blank | text | investor | no | 58.2, 654.9, 404.3, 666.6 | cell drawn in the picture (four rules) (picture im-002 pixels x 80-1146, y 1904-1940) | Cash distributions directed to: City |
| p08-bank-state | blank | text | investor | no | 415.1, 654.9, 482.0, 666.6 | cell drawn in the picture (four rules) (picture im-002 pixels x 1179-1385, y 1904-1940) | Cash distributions directed to: State |
| p08-bank-zip | blank | text | investor | no | 491.0, 654.9, 559.6, 666.6 | cell drawn in the picture (four rules) (picture im-002 pixels x 1413-1624, y 1904-1940) | Cash distributions directed to: Zip code |
| p08-bank-aba | blank | text | investor | no | 58.2, 675.0, 255.0, 686.7 | cell drawn in the picture (four rules) (picture im-002 pixels x 80-686, y 1966-2002) | Cash distributions directed to: Bank ABA# (for ACH only) |
| p08-bank-account | blank | text | investor | no | 269.6, 675.0, 559.2, 686.7 | cell drawn in the picture (four rules) (picture im-002 pixels x 731-1623, y 1966-2002) | Cash distributions directed to: Account # |

Must NOT get a field: the sample check picture (a cell drawn around it, an illustration); letters O and D read as squares; underlined ACH heading.

### Page 9

Must NOT get a field: browser-print page with no picture.

### Page 10

Must NOT get a field: browser-print page with no picture.

### Page 11

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p11-inv-signature | signature | signature | investor | yes | 57.2, 621.1, 230.3, 632.8 | cell drawn in the picture (four rules) (picture im-003 pixels x 77-610, y 1800-1836) | Signature of investor, trustee or authorized signer (required) |
| p11-inv-date | date | date | investor | yes | 234.8, 621.1, 299.8, 632.8 | cell drawn in the picture (four rules) (picture im-003 pixels x 624-824, y 1800-1836) | Date (required) |
| p11-joint-signature | signature | signature | co-investor | no | 305.9, 621.1, 478.7, 632.8 | cell drawn in the picture (four rules) (picture im-003 pixels x 843-1375, y 1800-1836) | Signature of joint investor, trustee, authorized signer or beneficial owner (required) |
| p11-joint-date | date | date | co-investor | no | 485.5, 621.1, 562.8, 632.8 | cell drawn in the picture (four rules) (picture im-003 pixels x 1396-1634, y 1800-1836) | Date beside the joint signature (required) |
| p11-accept-signature | signature | signature | firm | no | 57.2, 662.7, 229.0, 674.7 | cell drawn in the picture (four rules) (picture im-003 pixels x 77-606, y 1928-1965) | Subscription accepted: Oxford Park Income Fund signature |
| p11-accept-date | date | date | firm | no | 233.8, 662.7, 305.3, 674.7 | cell drawn in the picture (four rules) (picture im-003 pixels x 621-841, y 1928-1965) | Acceptance date |
| p11-accept-name | blank | name | firm | no | 57.2, 688.0, 229.0, 699.7 | cell drawn in the picture (four rules) (picture im-003 pixels x 77-606, y 2006-2042) | Acceptance: name |
| p11-accept-title | blank | title | firm | no | 233.5, 688.0, 475.5, 699.7 | cell drawn in the picture (four rules) (picture im-003 pixels x 620-1365, y 2006-2042) | Acceptance: title |

Must NOT get a field: certification prose; letters read as squares.

### Page 12

Must NOT get a field: browser-print page with no picture.

### Page 13

Must NOT get a field: browser-print page with no picture.

### Page 14

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p14-bd-name | blank | name | third-party | no | 57.2, 152.5, 355.3, 164.2 | cell drawn in the picture (four rules) (picture im-004 pixels x 77-995, y 357-393) | Broker-dealer / advisor section: Broker-dealer or RIA firm name (required) |
| p14-bd-crd | blank | text | third-party | no | 365.7, 152.5, 558.6, 164.2 | cell drawn in the picture (four rules) (picture im-004 pixels x 1027-1621, y 357-393) | Broker-dealer / advisor section: CRD # |
| p14-bd-address | blank | address | third-party | no | 57.2, 177.8, 559.2, 189.5 | cell drawn in the picture (four rules) (picture im-004 pixels x 77-1623, y 435-471) | Broker-dealer / advisor section: Broker-dealer or RIA firm address or P.O. box |
| p14-bd-city | blank | text | third-party | no | 57.2, 203.2, 404.0, 215.2 | cell drawn in the picture (four rules) (picture im-004 pixels x 77-1145, y 513-550) | Broker-dealer / advisor section: City |
| p14-bd-state | blank | text | third-party | no | 416.0, 203.2, 464.1, 215.2 | cell drawn in the picture (four rules) (picture im-004 pixels x 1182-1330, y 513-550) | Broker-dealer / advisor section: State |
| p14-bd-zip | blank | text | third-party | no | 475.1, 203.2, 559.6, 215.2 | cell drawn in the picture (four rules) (picture im-004 pixels x 1364-1624, y 513-550) | Broker-dealer / advisor section: Zip code |
| p14-bd-phone | blank | phone | third-party | no | 57.5, 229.5, 305.3, 241.2 | cell drawn in the picture (four rules) (picture im-004 pixels x 78-841, y 594-630) | Broker-dealer / advisor section: Business phone (required) |
| p14-bd-fax | blank | phone | third-party | no | 316.0, 229.5, 558.6, 241.2 | cell drawn in the picture (four rules) (picture im-004 pixels x 874-1621, y 594-630) | Broker-dealer / advisor section: Fax # |
| p14-rr-name | blank | name | third-party | no | 57.2, 255.8, 355.3, 267.5 | cell drawn in the picture (four rules) (picture im-004 pixels x 77-995, y 675-711) | Broker-dealer / advisor section: Registered representative(s) or advisor(s) name(s) (required) |
| p14-rr-number | blank | text | third-party | no | 365.7, 255.8, 558.6, 267.5 | cell drawn in the picture (four rules) (picture im-004 pixels x 1027-1621, y 675-711) | Broker-dealer / advisor section: Representative # / advisor # / team ID |
| p14-rr-address | blank | address | third-party | no | 57.2, 281.1, 404.0, 292.8 | cell drawn in the picture (four rules) (picture im-004 pixels x 77-1145, y 753-789) | Broker-dealer / advisor section: Representative address or P.O. box |
| p14-rr-branch | blank | text | third-party | no | 416.4, 281.1, 559.2, 292.8 | cell drawn in the picture (four rules) (picture im-004 pixels x 1183-1623, y 753-789) | Broker-dealer / advisor section: Branch ID # |
| p14-rr-city | blank | text | third-party | no | 57.2, 306.4, 404.0, 318.1 | cell drawn in the picture (four rules) (picture im-004 pixels x 77-1145, y 831-867) | Broker-dealer / advisor section: City |
| p14-rr-state | blank | text | third-party | no | 416.0, 306.4, 464.1, 318.1 | cell drawn in the picture (four rules) (picture im-004 pixels x 1182-1330, y 831-867) | Broker-dealer / advisor section: State |
| p14-rr-zip | blank | text | third-party | no | 475.1, 306.4, 559.6, 318.1 | cell drawn in the picture (four rules) (picture im-004 pixels x 1364-1624, y 831-867) | Broker-dealer / advisor section: Zip code |
| p14-rr-phone | blank | phone | third-party | no | 57.5, 331.8, 305.3, 343.4 | cell drawn in the picture (four rules) (picture im-004 pixels x 78-841, y 909-945) | Broker-dealer / advisor section: Business phone (required) |
| p14-rr-fax | blank | phone | third-party | no | 316.0, 331.8, 558.6, 343.4 | cell drawn in the picture (four rules) (picture im-004 pixels x 874-1621, y 909-945) | Broker-dealer / advisor section: Fax # |
| p14-rr-email | blank | email | third-party | no | 57.2, 357.1, 559.2, 368.8 | cell drawn in the picture (four rules) (picture im-004 pixels x 77-1623, y 987-1023) | Broker-dealer / advisor section: Representative(s) or advisor(s) email address |
| p14-inv-state | blank | text | third-party | no | 376.7, 390.5, 459.9, 415.2 | cell drawn in the picture (four rules) (picture im-004 pixels x 1061-1317, y 1090-1166) | Broker-dealer / advisor section: Investor state of residence (required), on the representative signature row |
| p14-rr-date | date | date | third-party | no | 476.4, 390.5, 559.9, 415.2 | cell drawn in the picture (four rules) (picture im-004 pixels x 1368-1625, y 1090-1166) | Broker-dealer / advisor section: Date beside the representative signatures (required) |
| p14-supervisor-name | blank | name | third-party | no | 55.2, 438.3, 370.2, 458.4 | cell drawn in the picture (four rules) (picture im-004 pixels x 71-1041, y 1237-1299) | Broker-dealer / advisor section: Printed name of supervisor, broker-dealer or RIA (if required) |
| p14-supervisor-signature | signature | signature | third-party | no | 55.2, 458.7, 370.2, 479.5 | cell drawn in the picture (four rules) (picture im-004 pixels x 71-1041, y 1300-1364) | Broker-dealer / advisor section: Signature of supervisor, broker-dealer or RIA (if required) |
| p14-supervisor-date | date | date | third-party | no | 376.7, 459.1, 459.9, 480.2 | cell drawn in the picture (four rules) (picture im-004 pixels x 1061-1317, y 1301-1366) | Broker-dealer / advisor section: Date beside the supervisor signature (required) |
| p14-comments | blank | text | third-party | no | 54.3, 507.1, 548.9, 623.0 | cell drawn in the picture (four rules) (picture im-004 pixels x 68-1591, y 1449-1806) | Broker-dealer / advisor section: Additional comments |
| p14-rr-signature-1 | signature | signature | third-party | no | 54.9, 391.5, 208.5, 416.5 | box edges measured as ink columns/rows in the picture (picture im-004 pixels x 70-543, y 1093-1170) | Signature of registered representative or advisor (first box, a printed X) |
| p14-rr-signature-2 | signature | signature | third-party | no | 216.0, 391.5, 369.9, 416.5 | box edges measured as ink columns/rows in the picture (picture im-004 pixels x 566-1040, y 1093-1170) | Signature of registered representative or advisor (second box, a printed X) |

Must NOT get a field: the printed X in signature boxes; letters read as squares.

### Page 15

Must NOT get a field: browser-print page with no picture.

### Page 16

Must NOT get a field: browser-print page with no picture.

### Page 17

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p17-w9-name | blank | name | investor | no | 111.1, 156.1, 525.1, 175.2 | W-9 line between rules (picture im-005 pixels x 243-1518, y 368-427) | W-9 line 1: name (as shown on your income tax return) |
| p17-w9-business-name | blank | name | investor | no | 111.1, 175.2, 525.1, 194.4 |  (picture im-005 pixels x 243-1518, y 427-486) | W-9 line 2: business name/disregarded entity name |
| p17-w9-individual | tickbox | tickbox | investor | no | 117.6, 215.8, 124.4, 223.0 | square printed in the picture (picture im-005 pixels x 263-284, y 552-574) | W-9 tax classification: Individual/sole proprietor or single-member LLC |
| p17-w9-c-corp | tickbox | tickbox | investor | no | 208.8, 214.9, 215.7, 221.7 | square printed in the picture (picture im-005 pixels x 544-565, y 549-570) | W-9 tax classification: C Corporation |
| p17-w9-s-corp | tickbox | tickbox | investor | no | 266.0, 214.9, 273.1, 221.7 | square printed in the picture (picture im-005 pixels x 720-742, y 549-570) | W-9 tax classification: S Corporation |
| p17-w9-partnership | tickbox | tickbox | investor | no | 323.5, 214.9, 330.3, 221.7 | square printed in the picture (picture im-005 pixels x 897-918, y 549-570) | W-9 tax classification: Partnership |
| p17-w9-trust | tickbox | tickbox | investor | no | 381.0, 214.9, 387.8, 221.7 | square printed in the picture (picture im-005 pixels x 1074-1095, y 549-570) | W-9 tax classification: Trust/estate |
| p17-w9-llc | tickbox | tickbox | investor | no | 117.6, 235.0, 124.4, 242.1 | square printed in the picture (picture im-005 pixels x 263-284, y 611-633) | W-9 tax classification: Limited liability company |
| p17-w9-other | tickbox | tickbox | investor | no | 117.6, 272.7, 124.4, 279.5 | square printed in the picture (picture im-005 pixels x 263-284, y 727-748) | W-9 tax classification: Other (see instructions) |
| p17-w9-llc-class | blank | text | investor | no | 394.6, 232.5, 421.5, 242.5 | rule printed in the picture; box = 10 pt above it (picture im-005 pixels x 1116-1199, y 603-634) | W-9: LLC tax classification (C, S or P) |
| p17-w9-exempt-payee | blank | text | investor | no | 496.9, 222.7, 525.1, 232.7 | rule printed in the picture; box = 10 pt above it (picture im-005 pixels x 1431-1518, y 573-604) | W-9: exempt payee code (if any) |
| p17-w9-fatca | blank | text | investor | no | 467.3, 251.6, 525.1, 261.6 | rule printed in the picture; box = 10 pt above it (picture im-005 pixels x 1340-1518, y 662-693) | W-9: exemption from FATCA reporting code (if any) |
| p17-w9-address | blank | address | investor | no | 111.7, 280.8, 375.1, 299.3 | cell drawn in the picture (four rules) (picture im-005 pixels x 245-1056, y 752-809) | W-9 line 5: address (number, street, apt. or suite) |
| p17-w9-city | blank | address | investor | no | 111.7, 299.9, 375.1, 318.4 | cell drawn in the picture (four rules) (picture im-005 pixels x 245-1056, y 811-868) | W-9 line 6: city, state and ZIP code |
| p17-w9-account-numbers | blank | text | investor | no | 111.1, 318.8, 375.8, 337.9 |  (picture im-005 pixels x 243-1058, y 869-928) | W-9 line 7: list account number(s) here (optional) |
| p17-w9-ssn-1 | blank | tax number | investor | no | 398.8, 357.1, 432.6, 375.9 | digit cells printed in the picture (picture im-005 pixels x 1129-1233, y 987-1045) | W-9 Part I: social security number (group 1) |
| p17-w9-ssn-2 | blank | tax number | investor | no | 444.6, 357.1, 467.0, 375.9 | digit cells printed in the picture (picture im-005 pixels x 1270-1339, y 987-1045) | W-9 Part I: social security number (group 2) |
| p17-w9-ssn-3 | blank | tax number | investor | no | 479.0, 357.1, 524.5, 375.9 | digit cells printed in the picture (picture im-005 pixels x 1376-1516, y 987-1045) | W-9 Part I: social security number (group 3) |
| p17-w9-ein-1 | blank | tax number | investor-entity | no | 398.2, 395.1, 421.5, 414.2 | digit cells printed in the picture (picture im-005 pixels x 1127-1199, y 1104-1163) | W-9 Part I: employer identification number (group 1) |
| p17-w9-ein-2 | blank | tax number | investor-entity | no | 432.6, 395.1, 513.5, 414.2 | digit cells printed in the picture (picture im-005 pixels x 1233-1482, y 1104-1163) | W-9 Part I: employer identification number (group 2) |
| p17-w9-signature | signature | signature | investor | no | 171.8, 519.4, 369.9, 538.6 | sign row of the W-9 picture (picture im-005 pixels x 430-1040, y 1487-1546) | W-9: signature of U.S. person (doubt: the W-9 sign row has no rule: box taken in the row after the caption) |
| p17-w9-date | date | date | investor | no | 389.4, 519.4, 525.1, 538.6 | sign row of the W-9 picture (picture im-005 pixels x 1100-1518, y 1487-1546) | W-9: date (doubt: as above) |

Must NOT get a field: W-9 requester's name and address (completed by the requester); the general instructions; the Form W-9 title block.

### Page 18

Must NOT get a field: browser-print page with no picture.
