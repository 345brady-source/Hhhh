# Answer sheet: d1 (15 pages)

File: `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/d1/doc.pdf`

PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt of writing room above it. Cell or box: its printed edges. Tick box: the printed square.

Picture pages: white boxes found as connected white regions in each embedded JPEG at its own resolution (2049x2651 px for page 1 of the form, 1700x2200 px for the others), edges refined to the white/grey transition and over any drawn edge; converted to PDF points through the image drawing matrix read from each page (image drawn at x 33.75-573.75 pt, 698.25 pt tall; page clip y 27.75-583.75). Every picture looked at in full; overlays at 100 dpi looked at.

## Who signs

Subscription agreement form (5 form pages, each a picture split over two landscape PDF pages). The investor and a co-owner complete and sign Section 5; Section 4 has its own owner/co-owner signatures for bank distributions; a custodian or trustee signs where applicable; the financial advisor and branch manager sign Section 6. No issuer acceptance block.

- Investor pages: [2, 3, 5, 8, 11]
- Firm pages: []
- Co-investor: True
- Third parties: custodian (custodian information, page 3; authorized signature, page 11); financial advisor and branch manager/RIA (Section 6, page 14)

Each form page is one JPEG drawn across two PDF pages: the first shows picture rows down to y 583.75 pt, the second the rest (from y 27.75 pt). No place is cut by a page break. Dates are printed as three boxes (month / day / year), each a place.

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 2 | 38 | 30 | 0 | 8 | 0 | 0 | sure of every place; the aggregate price box shows a printed 0 (kept as a place, marked) |
| 3 | 6 | 0 | 0 | 6 | 0 | 0 | sure |
| 4 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 5 | 52 | 8 | 0 | 44 | 0 | 0 | sure; the two "Retired" boxes are read as tick boxes (marked) |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 7 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 8 | 24 | 7 | 0 | 9 | 2 | 6 | sure; the sample check is not a place |
| 9 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 10 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 11 | 12 | 0 | 0 | 0 | 3 | 9 | sure; whose the custodian-or-trustee signature is, is a judgement (third party, marked) |
| 12 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 13 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 14 | 21 | 1 | 0 | 12 | 2 | 6 | sure (boxes measured from the picture pixels) |
| 15 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| all | 153 | 46 | 0 | 79 | 7 | 21 | |

By owner: co-investor 24, investor 93, investor-entity 5, third-party 31

## Doubtful places (5)

- `p02-aggregate` (page 2): the box shows a printed "0" left by the web form's calculation; not a real entry, so still a place
- `p05-inv-retired` (page 5): a small white box after "Retired:"; a tick box (could be read as a short blank)
- `p05-co-retired` (page 5): a small white box after "Retired:"; a tick box (could be read as a short blank)
- `p08-dist-owner-signature` (page 8): needed only when distributions go to a bank account
- `p11-custodian-signature` (page 11): captioned for a custodian or a trustee; a trustee may be the investor

## Places

### Page 1

Must NOT get a field: browser-print header only ("Exhibit 4.1"); no place.

### Page 2

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p02-share-aa1 | tickbox | tickbox | investor | no | 208.0, 162.6, 224.0, 178.7 | white box with a drawn 5 px edge (picture pixels 661-722 x 512-573) | Share selection: AA1 |
| p02-share-aa1-nav | tickbox | tickbox | investor | no | 372.7, 162.9, 389.0, 178.9 | white box with a drawn 5 px edge (picture pixels 1286-1348 x 513-574) | Share selection: AA1 (NAV), RIA/fee-based accounts |
| p02-share-mm1 | tickbox | tickbox | investor | no | 421.2, 162.6, 437.2, 178.7 | white box with a drawn 5 px edge (picture pixels 1470-1531 x 512-573) | Share selection: MM1 |
| p02-shares | blank | amount | investor | yes | 201.1, 185.3, 270.9, 196.3 | white box with a drawn 1 px edge (picture pixels 635-900 x 598-640) | Number of shares purchased |
| p02-price | blank | amount | investor | yes | 201.1, 196.1, 270.9, 207.1 | white box with a drawn 1 px edge (picture pixels 635-900 x 639-681) | Purchase price per unit (after a $ sign) |
| p02-aggregate | blank | amount | investor | yes | 201.1, 206.9, 270.9, 218.2 | white box with a drawn 1 px edge (picture pixels 635-900 x 680-723) | Aggregate purchase price (after a $ sign) (doubt: the box shows a printed "0" left by the web form's calculation; not a real entry, so still a place) |
| p02-additional | tickbox | tickbox | investor | no | 487.8, 192.9, 500.0, 204.7 | white box with a drawn 1 px edge (picture pixels 1723-1769 x 627-672) | Check here if this is an additional purchase |
| p02-account | blank | text | investor | no | 388.5, 219.0, 523.7, 232.1 | white box with a drawn 1 px edge (picture pixels 1346-1859 x 726-776) | Account number (if applicable) |
| p02-acct-individual | tickbox | tickbox | investor | no | 77.8, 308.8, 86.5, 317.2 | white disc of a printed round radio button (picture pixels 167-200 x 1067-1099) | Account type: Individual (round radio button) |
| p02-acct-jtwros | tickbox | tickbox | investor | no | 77.8, 323.8, 86.5, 332.5 | white disc of a printed round radio button (picture pixels 167-200 x 1124-1157) | Account type: Joint tenants WROS (round radio button) |
| p02-acct-tic | tickbox | tickbox | investor | no | 187.7, 323.8, 196.4, 332.5 | white disc of a printed round radio button (picture pixels 584-617 x 1124-1157) | Account type: Tenants in common (round radio button) |
| p02-acct-community | tickbox | tickbox | investor | no | 77.8, 334.9, 86.5, 343.6 | white disc of a printed round radio button (picture pixels 167-200 x 1166-1199) | Account type: Community property (round radio button) |
| p02-acct-trust | tickbox | tickbox | investor | no | 77.8, 349.1, 86.5, 357.8 | white disc of a printed round radio button (picture pixels 167-200 x 1220-1253) | Account type: Trust (round radio button) |
| p02-acct-estate | tickbox | tickbox | investor | no | 77.8, 363.3, 86.5, 372.0 | white disc of a printed round radio button (picture pixels 167-200 x 1274-1307) | Account type: Estate (round radio button) |
| p02-acct-custodial | tickbox | tickbox | investor | no | 77.8, 377.5, 86.5, 386.0 | white disc of a printed round radio button (picture pixels 167-200 x 1328-1360) | Account type: Custodial (round radio button) |
| p02-acct-corp | tickbox | tickbox | investor | no | 77.8, 391.8, 86.5, 400.2 | white disc of a printed round radio button (picture pixels 167-200 x 1382-1414) | Account type: Corporation (round radio button) |
| p02-acct-ccorp | tickbox | tickbox | investor | no | 162.9, 391.8, 171.6, 400.2 | white disc of a printed round radio button (picture pixels 490-523 x 1382-1414) | Account type: C Corp (round radio button) |
| p02-acct-scorp | tickbox | tickbox | investor | no | 228.8, 391.8, 237.5, 400.2 | white disc of a printed round radio button (picture pixels 740-773 x 1382-1414) | Account type: S Corp (round radio button) |
| p02-acct-llc | tickbox | tickbox | investor | no | 77.8, 406.2, 86.5, 414.7 | white disc of a printed round radio button (picture pixels 167-200 x 1437-1469) | Account type: LLC (round radio button) |
| p02-acct-partnership | tickbox | tickbox | investor | no | 77.8, 420.5, 86.5, 428.9 | white disc of a printed round radio button (picture pixels 167-200 x 1491-1523) | Account type: Partnership (round radio button) |
| p02-acct-nonprofit | tickbox | tickbox | investor | no | 77.8, 434.4, 86.5, 443.1 | white disc of a printed round radio button (picture pixels 167-200 x 1544-1577) | Account type: Non-profit organization (round radio button) |
| p02-acct-profit-sharing | tickbox | tickbox | investor | no | 77.8, 448.1, 86.5, 456.6 | white disc of a printed round radio button (picture pixels 167-200 x 1596-1628) | Account type: Profit sharing plan (round radio button) |
| p02-acct-defined-benefit | tickbox | tickbox | investor | no | 177.9, 448.1, 186.6, 456.6 | white disc of a printed round radio button (picture pixels 547-580 x 1596-1628) | Account type: Defined benefit plan (round radio button) |
| p02-acct-keogh | tickbox | tickbox | investor | no | 77.8, 460.2, 86.5, 468.9 | white disc of a printed round radio button (picture pixels 167-200 x 1642-1675) | Account type: KEOGH plan (round radio button) |
| p02-acct-trad-ira | tickbox | tickbox | investor | no | 77.8, 476.8, 86.5, 485.5 | white disc of a printed round radio button (picture pixels 167-200 x 1705-1738) | Account type: Traditional IRA (round radio button) |
| p02-acct-sep-ira | tickbox | tickbox | investor | no | 162.4, 476.8, 170.8, 485.5 | white disc of a printed round radio button (picture pixels 488-520 x 1705-1738) | Account type: SEP IRA (round radio button) |
| p02-acct-roth-ira | tickbox | tickbox | investor | no | 227.5, 476.8, 236.2, 485.5 | white disc of a printed round radio button (picture pixels 735-768 x 1705-1738) | Account type: ROTH IRA (round radio button) |
| p02-acct-simple-ira | tickbox | tickbox | investor | no | 77.8, 488.9, 86.5, 497.6 | white disc of a printed round radio button (picture pixels 167-200 x 1751-1784) | Account type: Simple IRA (round radio button) |
| p02-acct-inherited-ira | tickbox | tickbox | investor | no | 162.4, 488.9, 170.8, 497.6 | white disc of a printed round radio button (picture pixels 488-520 x 1751-1784) | Account type: Inherited/beneficial IRA (round radio button) |
| p02-acct-other | tickbox | tickbox | investor | no | 77.8, 505.5, 86.5, 514.2 | white disc of a printed round radio button (picture pixels 167-200 x 1814-1847) | Account type: Other (specify) (round radio button) |
| p02-tod-individual | tickbox | tickbox | investor | no | 314.4, 307.2, 322.6, 315.4 | white box with a drawn 1 px edge (picture pixels 1065-1096 x 1061-1092) | TOD (transfer on death), individual account row |
| p02-tod-joint | tickbox | tickbox | investor | no | 314.4, 328.0, 322.6, 336.2 | white box with a drawn 1 px edge (picture pixels 1065-1096 x 1140-1171) | TOD (transfer on death), joint account row |
| p02-ugma | tickbox | tickbox | investor | no | 137.6, 377.8, 145.8, 386.0 | white box with a drawn 1 px edge (picture pixels 394-425 x 1329-1360) | Custodial: UGMA |
| p02-ugma-state | blank | text | investor | no | 209.8, 374.6, 235.6, 388.9 | white box with a drawn 1 px edge (picture pixels 668-766 x 1317-1371) | UGMA: state of |
| p02-utma | tickbox | tickbox | investor | no | 244.6, 377.8, 252.8, 386.0 | white box with a drawn 1 px edge (picture pixels 800-831 x 1329-1360) | Custodial: UTMA |
| p02-utma-state | blank | text | investor | no | 316.8, 374.6, 342.6, 388.9 | white box with a drawn 1 px edge (picture pixels 1074-1172 x 1317-1371) | UTMA: state of |
| p02-decedent-name | blank | name | investor | no | 357.6, 486.6, 476.0, 497.6 | white box with a drawn 1 px edge (picture pixels 1229-1678 x 1742-1784) | Inherited IRA: decedent's name (right column) |
| p02-acct-other-specify | blank | text | investor | no | 162.1, 505.0, 280.4, 516.3 | white box with a drawn 1 px edge (picture pixels 487-936 x 1812-1855) | Other account type, specify |

Must NOT get a field: the five letters O in the printed footer line are white specks, not boxes; the dark title bars and column heading bars; table rules of the account-type grid; the "ADDITIONAL REQUIRED DOCUMENTATION" column text.

### Page 3

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p03-cust-tax-id | blank | tax number | third-party | no | 159.2, 45.4, 270.4, 56.0 | white box with a drawn 1 px edge (picture pixels 476-898 x 2180-2220) | Custodian tax ID (custodian information, "to be completed by custodian") |
| p03-cust-name | blank | name | third-party | no | 346.0, 45.4, 547.4, 56.0 | white box with a drawn 1 px edge (picture pixels 1185-1949 x 2180-2220) | Name of custodian (custodian information, "to be completed by custodian") |
| p03-cust-account | blank | text | third-party | no | 159.2, 58.3, 270.4, 69.1 | white box with a drawn 1 px edge (picture pixels 476-898 x 2229-2270) | Custodian account number (custodian information, "to be completed by custodian") |
| p03-cust-address | blank | address | third-party | no | 345.8, 58.1, 547.4, 68.9 | white box with a drawn 1 px edge (picture pixels 1184-1949 x 2228-2269) | Custodian mailing address (custodian information, "to be completed by custodian") |
| p03-cust-phone | blank | phone | third-party | no | 159.2, 71.5, 270.4, 82.1 | white box with a drawn 1 px edge (picture pixels 476-898 x 2279-2319) | Custodian phone (custodian information, "to be completed by custodian") |
| p03-cust-city-state-zip | blank | address | third-party | no | 345.3, 71.5, 547.4, 82.1 | white box with a drawn 1 px edge (picture pixels 1182-1949 x 2279-2319) | Custodian city, state, ZIP (custodian information, "to be completed by custodian") |

Must NOT get a field: the help bar and the footer line; the printed letters O in the footer.

### Page 4

Must NOT get a field: browser-print header only ("Exhibit 4.1"); no place.

### Page 5

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p05-inv-first-name | blank | name | investor | yes | 147.5, 98.2, 272.0, 110.3 | white box on grey, no drawn edge (picture pixels 358-750 x 222-260) | A. Investor/trustee: First name |
| p05-co-first-name | blank | name | co-investor | no | 399.4, 98.2, 523.9, 110.3 | white box on grey, no drawn edge (picture pixels 1151-1543 x 222-260) | B. Co-investor/co-trustee: First name |
| p05-inv-middle-name | blank | name | investor | no | 147.5, 111.5, 272.0, 123.9 | white box on grey, no drawn edge (picture pixels 358-750 x 264-303) | A. Investor/trustee: Middle name |
| p05-co-middle-name | blank | name | co-investor | no | 399.4, 111.5, 523.9, 123.9 | white box on grey, no drawn edge (picture pixels 1151-1543 x 264-303) | B. Co-investor/co-trustee: Middle name |
| p05-inv-last-name | blank | name | investor | yes | 147.5, 125.2, 272.0, 137.6 | white box on grey, no drawn edge (picture pixels 358-750 x 307-346) | A. Investor/trustee: Last name |
| p05-co-last-name | blank | name | co-investor | no | 399.4, 125.2, 523.9, 137.6 | white box on grey, no drawn edge (picture pixels 1151-1543 x 307-346) | B. Co-investor/co-trustee: Last name |
| p05-inv-tax-id | blank | tax number | investor | yes | 147.5, 138.8, 272.0, 150.9 | white box on grey, no drawn edge (picture pixels 358-750 x 350-388) | A. Investor/trustee: Tax ID or SSN |
| p05-co-tax-id | blank | tax number | co-investor | no | 399.4, 138.8, 523.9, 150.9 | white box on grey, no drawn edge (picture pixels 1151-1543 x 350-388) | B. Co-investor/co-trustee: Tax ID or SSN |
| p05-inv-street | blank | address | investor | yes | 147.5, 152.2, 272.0, 164.5 | white box on grey, no drawn edge (picture pixels 358-750 x 392-431) | A. Investor/trustee: Street address |
| p05-co-street | blank | address | co-investor | no | 399.4, 152.2, 523.9, 164.5 | white box on grey, no drawn edge (picture pixels 1151-1543 x 392-431) | B. Co-investor/co-trustee: Street address |
| p05-inv-city | blank | text | investor | yes | 147.5, 165.8, 272.0, 177.9 | white box on grey, no drawn edge (picture pixels 358-750 x 435-473) | A. Investor/trustee: City |
| p05-co-city | blank | text | co-investor | no | 399.4, 165.8, 523.9, 177.9 | white box on grey, no drawn edge (picture pixels 1151-1543 x 435-473) | B. Co-investor/co-trustee: City |
| p05-inv-state | blank | text | investor | yes | 147.5, 179.5, 272.0, 191.5 | white box on grey, no drawn edge (picture pixels 358-750 x 478-516) | A. Investor/trustee: State |
| p05-co-state | blank | text | co-investor | no | 399.4, 179.5, 523.9, 191.5 | white box on grey, no drawn edge (picture pixels 1151-1543 x 478-516) | B. Co-investor/co-trustee: State |
| p05-inv-zip | blank | text | investor | yes | 147.5, 192.8, 272.0, 205.2 | white box on grey, no drawn edge (picture pixels 358-750 x 520-559) | A. Investor/trustee: ZIP |
| p05-co-zip | blank | text | co-investor | no | 399.4, 192.8, 523.9, 204.9 | white box on grey, no drawn edge (picture pixels 1151-1543 x 520-558) | B. Co-investor/co-trustee: ZIP |
| p05-inv-phone | blank | phone | investor | yes | 147.5, 206.8, 272.0, 218.8 | white box on grey, no drawn edge (picture pixels 358-750 x 564-602) | A. Investor/trustee: Daytime phone |
| p05-co-phone | blank | phone | co-investor | no | 399.4, 206.8, 523.9, 218.8 | white box on grey, no drawn edge (picture pixels 1151-1543 x 564-602) | B. Co-investor/co-trustee: Daytime phone |
| p05-inv-email | blank | email | investor | no | 147.5, 220.4, 272.0, 232.5 | white box on grey, no drawn edge (picture pixels 358-750 x 607-645) | A. Investor/trustee: Email address |
| p05-co-email | blank | email | co-investor | no | 399.4, 220.4, 523.9, 232.5 | white box on grey, no drawn edge (picture pixels 1151-1543 x 607-645) | B. Co-investor/co-trustee: Email address |
| p05-inv-dob-month | blank | date | investor | yes | 147.5, 234.7, 183.7, 247.1 | white box on grey, no drawn edge (picture pixels 358-472 x 652-691) | A. Investor: date of birth, month (three boxes split by slashes) |
| p05-co-dob-month | blank | date | co-investor | no | 399.4, 234.7, 435.3, 247.1 | white box on grey, no drawn edge (picture pixels 1151-1264 x 652-691) | B. Co-investor: date of birth, month |
| p05-inv-dob-day | blank | date | investor | yes | 191.6, 234.7, 227.8, 247.1 | white box on grey, no drawn edge (picture pixels 497-611 x 652-691) | A. Investor: date of birth, day (three boxes split by slashes) |
| p05-co-dob-day | blank | date | co-investor | no | 443.5, 234.7, 479.7, 247.1 | white box on grey, no drawn edge (picture pixels 1290-1404 x 652-691) | B. Co-investor: date of birth, day |
| p05-inv-dob-year | blank | date | investor | yes | 236.1, 234.7, 272.0, 247.1 | white box on grey, no drawn edge (picture pixels 637-750 x 652-691) | A. Investor: date of birth, year (three boxes split by slashes) |
| p05-co-dob-year | blank | date | co-investor | no | 487.7, 234.7, 523.9, 247.1 | white box on grey, no drawn edge (picture pixels 1429-1543 x 652-691) | B. Co-investor: date of birth, year |
| p05-inv-employer | blank | name | investor | no | 147.5, 249.9, 272.0, 262.3 | white box on grey, no drawn edge (picture pixels 358-750 x 700-739) | A. Investor: employer |
| p05-co-employer | blank | name | co-investor | no | 399.4, 249.9, 523.9, 262.3 | white box on grey, no drawn edge (picture pixels 1151-1543 x 700-739) | B. Co-investor: employer |
| p05-inv-retired | tickbox | tickbox | investor | no | 147.5, 264.5, 159.5, 275.0 | white box on grey, no drawn edge (picture pixels 358-396 x 746-779) | A. Investor: retired (doubt: a small white box after "Retired:"; a tick box (could be read as a short blank)) |
| p05-co-retired | tickbox | tickbox | co-investor | no | 399.4, 264.5, 411.4, 275.0 | white box on grey, no drawn edge (picture pixels 1151-1189 x 746-779) | B. Co-investor: retired (doubt: a small white box after "Retired:"; a tick box (could be read as a short blank)) |
| p05-inv-citizenship | blank | text | investor | no | 147.5, 293.1, 272.0, 305.1 | white box on grey, no drawn edge (picture pixels 358-750 x 836-874) | A. Investor: if non-US citizen, country of citizenship |
| p05-co-citizenship | blank | text | co-investor | no | 399.4, 293.1, 523.9, 305.1 | white box on grey, no drawn edge (picture pixels 1151-1543 x 836-874) | B. Co-investor: if non-US citizen, country of citizenship |
| p05-entity-name | blank | name | investor-entity | no | 139.2, 338.8, 524.2, 351.2 | white box on grey, no drawn edge (picture pixels 332-1544 x 980-1019) | C. Trust/corporation/partnership: entity name or title of trust |
| p05-trust-date-month | blank | date | investor-entity | no | 139.8, 358.5, 176.4, 370.5 | white box on grey, no drawn edge (picture pixels 334-449 x 1042-1080) | C. Date of trust, month |
| p05-trust-date-day | blank | date | investor-entity | no | 184.0, 358.5, 220.2, 370.5 | white box on grey, no drawn edge (picture pixels 473-587 x 1042-1080) | C. Date of trust, day |
| p05-trust-date-year | blank | date | investor-entity | no | 228.1, 358.5, 264.4, 370.5 | white box on grey, no drawn edge (picture pixels 612-726 x 1042-1080) | C. Date of trust, year |
| p05-entity-tax-id | blank | tax number | investor-entity | no | 314.2, 358.5, 459.4, 370.5 | white box on grey, no drawn edge (picture pixels 883-1340 x 1042-1080) | C. Entity tax ID |
| p05-pob-city | blank | text | investor | no | 110.6, 431.1, 176.1, 443.2 | white box on grey, no drawn edge (picture pixels 242-448 x 1271-1309) | D. Government ID (foreign citizens only): Place of birth: city |
| p05-pob-state | blank | text | investor | no | 277.1, 431.1, 342.2, 443.2 | white box on grey, no drawn edge (picture pixels 766-971 x 1271-1309) | D. Government ID (foreign citizens only): Place of birth: state/province |
| p05-pob-country | blank | text | investor | no | 454.9, 431.1, 524.2, 443.2 | white box on grey, no drawn edge (picture pixels 1326-1544 x 1271-1309) | D. Government ID (foreign citizens only): Place of birth: country |
| p05-id-drivers-license | tickbox | tickbox | investor | no | 79.5, 491.1, 88.4, 499.7 | white disc of a printed round radio button (picture pixels 144-172 x 1460-1487) | D. Immigration status: U.S. driver's license (round radio button) |
| p05-id-green-card | tickbox | tickbox | investor | no | 146.2, 491.1, 155.1, 499.7 | white disc of a printed round radio button (picture pixels 354-382 x 1460-1487) | D. Immigration status: INS permanent resident alien card (round radio button) |
| p05-id-foreign-national | tickbox | tickbox | investor | no | 225.3, 491.1, 234.2, 499.7 | white disc of a printed round radio button (picture pixels 603-631 x 1460-1487) | D. Immigration status: Foreign national identity documents (round radio button) |
| p05-id-employment-auth | tickbox | tickbox | investor | no | 321.9, 491.1, 330.8, 499.7 | white disc of a printed round radio button (picture pixels 907-935 x 1460-1487) | D. Immigration status: Employee authorization document (round radio button) |
| p05-id-passport-no-visa | tickbox | tickbox | investor | no | 401.3, 491.1, 410.2, 499.7 | white disc of a printed round radio button (picture pixels 1157-1185 x 1460-1487) | D. Immigration status: Passport without U.S. visa (round radio button) |
| p05-id-passport-visa | tickbox | tickbox | investor | no | 472.1, 491.1, 481.0, 499.7 | white disc of a printed round radio button (picture pixels 1380-1408 x 1460-1487) | D. Immigration status: Passport with U.S. visa (round radio button) |
| p05-id-bank-name | blank | name | investor | no | 131.6, 520.0, 197.0, 532.1 | white box on grey, no drawn edge (picture pixels 308-514 x 1551-1589) | D. Government ID: Bank name |
| p05-id-bank-account | blank | text | investor | no | 258.0, 520.0, 352.0, 532.1 | white box on grey, no drawn edge (picture pixels 706-1002 x 1551-1589) | D. Government ID: Account number |
| p05-id-bank-address | blank | address | investor | no | 419.4, 519.7, 523.9, 532.1 | white box on grey, no drawn edge (picture pixels 1214-1543 x 1550-1589) | D. Government ID: Bank address |
| p05-id-bank-phone | blank | phone | investor | no | 131.6, 541.6, 197.0, 554.0 | white box on grey, no drawn edge (picture pixels 308-514 x 1619-1658) | D. Government ID: Bank phone |
| p05-id-doc-number | blank | text | investor | no | 313.3, 541.6, 352.0, 554.0 | white box on grey, no drawn edge (picture pixels 880-1002 x 1619-1658) | D. Government ID: Number for the document checked above |
| p05-id-doc-country | blank | text | investor | no | 443.5, 541.6, 523.9, 554.0 | white box on grey, no drawn edge (picture pixels 1290-1543 x 1619-1658) | D. Government ID: Country of issuance |

Must NOT get a field: the thin vertical rule between columns A and B; the horizontal rule under place of birth.

### Page 6

Must NOT get a field: grey panel, help bar and footer only.

### Page 7

Must NOT get a field: browser-print header only ("Exhibit 4.1"); no place.

### Page 8

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p08-dist-drip | tickbox | tickbox | investor | no | 80.1, 125.5, 88.7, 134.1 | white disc of a printed round radio button (picture pixels 146-173 x 308-335) | Distributions: dividend reinvestment plan (round radio button) |
| p08-dist-mail-check | tickbox | tickbox | investor | no | 77.9, 172.8, 86.5, 181.4 | white disc of a printed round radio button (picture pixels 139-166 x 457-484) | Distributions: mail check to the address of record |
| p08-dist-ach | tickbox | tickbox | investor | no | 239.3, 173.1, 247.8, 181.7 | white disc of a printed round radio button (picture pixels 647-674 x 458-485) | Distributions: direct via ACH deposit |
| p08-dist-mail-firm | tickbox | tickbox | investor | no | 415.6, 173.1, 424.1, 181.7 | white disc of a printed round radio button (picture pixels 1202-1229 x 458-485) | Distributions: mail check to clearing firm/financial institution listed below |
| p08-bank-name | blank | name | investor | no | 147.8, 254.4, 306.9, 266.7 | white box on grey, no drawn edge (picture pixels 359-860 x 714-753) | Distribution account: Name / entity name / financial institution |
| p08-bank-address | blank | address | investor | no | 399.0, 254.4, 522.9, 266.7 | white box on grey, no drawn edge (picture pixels 1150-1540 x 714-753) | Distribution account: Mailing address |
| p08-bank-city | blank | text | investor | no | 106.8, 285.5, 168.4, 297.8 | white box on grey, no drawn edge (picture pixels 230-424 x 812-851) | Distribution account: City |
| p08-bank-state | blank | text | investor | no | 221.5, 285.5, 252.3, 297.8 | white box on grey, no drawn edge (picture pixels 591-688 x 812-851) | Distribution account: State |
| p08-bank-zip | blank | text | investor | no | 308.8, 286.4, 354.9, 298.8 | white box on grey, no drawn edge (picture pixels 866-1011 x 815-854) | Distribution account: ZIP |
| p08-bank-phone | blank | phone | investor | no | 415.6, 285.5, 522.6, 297.8 | white box on grey, no drawn edge (picture pixels 1202-1539 x 812-851) | Distribution account: Phone |
| p08-acct-checking | tickbox | tickbox | investor | no | 145.9, 315.0, 154.8, 323.9 | white disc of a printed round radio button (picture pixels 353-381 x 905-933) | Your account: checking (round radio button) |
| p08-acct-savings | tickbox | tickbox | investor | no | 205.6, 314.3, 214.5, 323.2 | white disc of a printed round radio button (picture pixels 541-569 x 903-931) | Your account: savings |
| p08-acct-brokerage | tickbox | tickbox | investor | no | 205.6, 336.9, 214.5, 346.1 | white disc of a printed round radio button (picture pixels 541-569 x 974-1003) | Your account: brokerage |
| p08-acct-number | blank | text | investor | no | 265.3, 313.7, 377.1, 326.1 | white box on grey, no drawn edge (picture pixels 729-1081 x 901-940) | Your account number (row of checking/savings) |
| p08-acct-brokerage-number | blank | text | investor | no | 265.3, 336.2, 377.1, 348.6 | white box on grey, no drawn edge (picture pixels 729-1081 x 972-1011) | Brokerage account number |
| p08-aba | blank | text | investor | no | 448.9, 313.7, 524.2, 326.1 | white box on grey, no drawn edge (picture pixels 1307-1544 x 901-940) | ABA/routing number |
| p08-dist-owner-signature | signature | signature | investor | no | 166.2, 373.4, 273.6, 387.0 | white box on grey, no drawn edge (picture pixels 417-755 x 1089-1132) | Owner signature (distribution authorization) (doubt: needed only when distributions go to a bank account) |
| p08-dist-coowner-signature | signature | signature | co-investor | no | 414.9, 373.7, 522.3, 387.3 | white box on grey, no drawn edge (picture pixels 1200-1538 x 1090-1133) | Co-owner signature (if applicable) |
| p08-dist-owner-date-month | date | date | investor | no | 165.9, 394.0, 197.0, 407.7 | white box on grey, no drawn edge (picture pixels 416-514 x 1154-1197) | Date beside the owner signature, month (three boxes) |
| p08-dist-coowner-date-month | date | date | co-investor | no | 414.6, 394.6, 446.7, 408.6 | white box on grey, no drawn edge (picture pixels 1199-1300 x 1156-1200) | Date beside the co-owner signature, month |
| p08-dist-owner-date-day | date | date | investor | no | 204.0, 394.0, 235.5, 407.7 | white box on grey, no drawn edge (picture pixels 536-635 x 1154-1197) | Date beside the owner signature, day (three boxes) |
| p08-dist-coowner-date-day | date | date | co-investor | no | 452.7, 394.6, 483.5, 408.6 | white box on grey, no drawn edge (picture pixels 1319-1416 x 1156-1200) | Date beside the co-owner signature, day |
| p08-dist-owner-date-year | date | date | investor | no | 242.1, 394.0, 273.6, 407.7 | white box on grey, no drawn edge (picture pixels 656-755 x 1154-1197) | Date beside the owner signature, year (three boxes) |
| p08-dist-coowner-date-year | date | date | co-investor | no | 491.2, 394.6, 522.0, 408.3 | white box on grey, no drawn edge (picture pixels 1440-1537 x 1156-1199) | Date beside the co-owner signature, year |

Must NOT get a field: the sample voided check picture: its white face, its printed rules (Date, Pay to the order of, $, memo) and the red outlined routing/account/check number boxes are an illustration, not places; the horizontal section rules.

### Page 9

Must NOT get a field: the lower half of the sample check picture and its red callouts; help bar and footer.

### Page 10

Must NOT get a field: browser-print header only ("Exhibit 4.1"); no place.

### Page 11

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p11-owner-signature | signature | signature | investor | yes | 164.9, 398.1, 272.0, 411.5 | white box on grey, no drawn edge (picture pixels 413-750 x 1167-1209) | Section 5: owner signature |
| p11-coowner-signature | signature | signature | co-investor | no | 415.6, 398.1, 522.3, 411.8 | white box on grey, no drawn edge (picture pixels 1202-1538 x 1167-1210) | Section 5: co-owner signature (if applicable) |
| p11-owner-date-month | date | date | investor | yes | 164.9, 418.8, 195.4, 432.1 | white box on grey, no drawn edge (picture pixels 413-509 x 1232-1274) | Date beside the owner signature, month (three boxes) |
| p11-coowner-date-month | date | date | co-investor | no | 414.9, 419.4, 445.7, 432.7 | white box on grey, no drawn edge (picture pixels 1200-1297 x 1234-1276) | Date beside the co-owner signature, month |
| p11-owner-date-day | date | date | investor | yes | 203.1, 418.8, 233.5, 432.1 | white box on grey, no drawn edge (picture pixels 533-629 x 1232-1274) | Date beside the owner signature, day (three boxes) |
| p11-coowner-date-day | date | date | co-investor | no | 453.4, 419.4, 483.9, 432.7 | white box on grey, no drawn edge (picture pixels 1321-1417 x 1234-1276) | Date beside the co-owner signature, day |
| p11-owner-date-year | date | date | investor | yes | 241.2, 418.8, 272.0, 432.1 | white box on grey, no drawn edge (picture pixels 653-750 x 1232-1274) | Date beside the owner signature, year (three boxes) |
| p11-coowner-date-year | date | date | co-investor | no | 491.2, 419.4, 522.0, 432.7 | white box on grey, no drawn edge (picture pixels 1440-1537 x 1234-1276) | Date beside the co-owner signature, year |
| p11-custodian-signature | signature | signature | third-party | no | 164.9, 461.9, 272.0, 475.3 | white box on grey, no drawn edge (picture pixels 413-750 x 1368-1410) | Authorized signature of custodian or trustee (if applicable; current custodian must sign for an IRA) (doubt: captioned for a custodian or a trustee; a trustee may be the investor) |
| p11-custodian-date-month | date | date | third-party | no | 414.9, 461.9, 445.7, 475.3 | white box on grey, no drawn edge (picture pixels 1200-1297 x 1368-1410) | Date beside the custodian/trustee signature, month |
| p11-custodian-date-day | date | date | third-party | no | 452.1, 461.9, 483.9, 475.3 | white box on grey, no drawn edge (picture pixels 1317-1417 x 1368-1410) | Date beside the custodian/trustee signature, day |
| p11-custodian-date-year | date | date | third-party | no | 491.5, 461.9, 522.0, 475.3 | white box on grey, no drawn edge (picture pixels 1441-1537 x 1368-1410) | Date beside the custodian/trustee signature, year |

Must NOT get a field: the outlined W-9 certification box (text frame); items (a) to (g) have no box to tick.

### Page 12

Must NOT get a field: legal text, help bar and footer.

### Page 13

Must NOT get a field: browser-print header only ("Exhibit 4.1"); no place.

### Page 14

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |
|---|---|---|---|---|---|---|---|
| p14-fa-bd-ria | blank | name | third-party | no | 145.6, 118.8, 270.4, 130.9 | white box on grey, no drawn edge (picture pixels 352-745 x 287-325) | Section 6 financial advisor: Broker dealer/RIA |
| p14-fa-name | blank | name | third-party | no | 369.8, 118.8, 522.0, 130.9 | white box on grey, no drawn edge (picture pixels 1058-1537 x 287-325) | Section 6 financial advisor: Financial advisor name |
| p14-fa-address | blank | address | third-party | no | 145.9, 138.5, 270.4, 150.6 | white box on grey, no drawn edge (picture pixels 353-745 x 349-387) | Section 6 financial advisor: Mailing address |
| p14-fa-city | blank | text | third-party | no | 297.7, 138.5, 374.3, 150.6 | white box on grey, no drawn edge (picture pixels 831-1072 x 349-387) | Section 6 financial advisor: City |
| p14-fa-state | blank | text | third-party | no | 411.4, 138.5, 442.9, 150.6 | white box on grey, no drawn edge (picture pixels 1189-1288 x 349-387) | Section 6 financial advisor: State |
| p14-fa-zip | blank | text | third-party | no | 473.7, 138.5, 522.3, 150.6 | white box on grey, no drawn edge (picture pixels 1385-1538 x 349-387) | Section 6 financial advisor: Zip |
| p14-fa-email | blank | email | third-party | no | 145.6, 158.2, 270.4, 170.6 | white box on grey, no drawn edge (picture pixels 352-745 x 411-450) | Section 6 financial advisor: Email address |
| p14-fa-phone | blank | phone | third-party | no | 346.0, 158.2, 411.8, 170.6 | white box on grey, no drawn edge (picture pixels 983-1190 x 411-450) | Section 6 financial advisor: Business phone |
| p14-fa-fax | blank | phone | third-party | no | 447.3, 158.2, 522.0, 170.6 | white box on grey, no drawn edge (picture pixels 1302-1537 x 411-450) | Section 6 financial advisor: Fax |
| p14-fa-bd-crd | blank | text | third-party | no | 145.6, 179.1, 271.4, 191.2 | white box on grey, no drawn edge (picture pixels 352-748 x 477-515) | Section 6 financial advisor: Broker-dealer CRD number |
| p14-fa-advisor-number | blank | text | third-party | no | 316.8, 179.1, 382.8, 191.2 | white box on grey, no drawn edge (picture pixels 891-1099 x 477-515) | Section 6 financial advisor: Advisor number |
| p14-fa-crd | blank | text | third-party | no | 457.5, 179.1, 522.3, 191.2 | white box on grey, no drawn edge (picture pixels 1334-1538 x 477-515) | Section 6 financial advisor: Financial advisor CRD |
| p14-fa-ria-submission | tickbox | tickbox | third-party | no | 59.2, 208.3, 71.2, 220.1 | white box on grey, no drawn edge (picture pixels 80-118 x 569-606) | AA1 (NAV), MM1 only: RIA submission (the advisor checks it) |
| p14-fa-signature | signature | signature | third-party | no | 162.7, 290.9, 270.4, 304.5 | white box on grey, no drawn edge (picture pixels 406-745 x 829-872) | Financial advisor signature |
| p14-bm-signature | signature | signature | third-party | no | 414.3, 291.5, 522.3, 304.8 | white box on grey, no drawn edge (picture pixels 1198-1538 x 831-873) | Branch manager and/or RIA signature |
| p14-fa-date-month | date | date | third-party | no | 162.4, 305.8, 193.8, 319.1 | white box on grey, no drawn edge (picture pixels 405-504 x 876-918) | Date beside the financial advisor signature, month |
| p14-bm-date-month | date | date | third-party | no | 414.0, 306.4, 445.7, 319.7 | white box on grey, no drawn edge (picture pixels 1197-1297 x 878-920) | Date beside the branch manager signature, month |
| p14-fa-date-day | date | date | third-party | no | 200.5, 305.8, 232.0, 319.1 | white box on grey, no drawn edge (picture pixels 525-624 x 876-918) | Date beside the financial advisor signature, day |
| p14-bm-date-day | date | date | third-party | no | 452.1, 306.4, 483.9, 319.7 | white box on grey, no drawn edge (picture pixels 1317-1417 x 878-920) | Date beside the branch manager signature, day |
| p14-fa-date-year | date | date | third-party | no | 238.6, 305.8, 270.1, 319.1 | white box on grey, no drawn edge (picture pixels 645-744 x 876-918) | Date beside the financial advisor signature, year |
| p14-bm-date-year | date | date | third-party | no | 490.5, 306.4, 522.0, 319.7 | white box on grey, no drawn edge (picture pixels 1438-1537 x 878-920) | Date beside the branch manager signature, year |

Must NOT get a field: nothing else.

### Page 15

Must NOT get a field: Section 7 payment instructions: printed bank details already filled in, including "[Investor Name]" in the wire reference (an instruction, not a blank).
