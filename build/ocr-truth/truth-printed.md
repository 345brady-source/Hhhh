# Answer sheet: printed-no-text.pdf (8 pages)

Made by looking at every page and measuring in the page image. Independent of the text-recognition work.

**How the file is built (matters for reading it):** each page is a browser print of a web page. The whole form is one picture per page (JPEG, 742 x 960 px, about 107 dots per inch). The only drawn outlines are the browser header and footer, one grey rule near the top, and a microscopic line of hidden text under the picture. So no box or line of the form exists as a vector shape; they exist only as pixels.

**Coordinates:** PDF points, origin top-left, `x0,y0,x1,y1` = outer edge of the printed box. Accuracy about 1 pt; judge with 2 pt tolerance (the developer may place a field slightly inside the box; overlap of 80 % or more of the smaller box is a fair pass rule).

## Counts

| page | tick boxes | initials | blanks | signatures | dates | total | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 37 | 0 | 24 | 0 | 0 | **61** | high |
| 2 | 20 | 0 | 56 | 0 | 0 | **76** | high |
| 3 | 4 | 1 | 14 | 0 | 0 | **19** | high |
| 4 | 0 | 14 | 0 | 0 | 0 | **14** | high |
| 5 | 0 | 2 | 13 | 2 | 2 | **19** | high |
| 6 | 0 | 0 | 0 | 2 | 2 | **4** | high |
| 7 | 0 | 32 | 0 | 0 | 0 | **32** | high |
| 8 | 0 | 16 | 0 | 0 | 0 | **16** | high |
| all | 61 | 65 | 107 | 4 | 4 | **241** | |

By owner: investor 168, co-investor/second signer 52, firm 0, unclear 21.

Notes on judgement:
- `unclear` is used for places a third party completes (custodian; broker-dealer / registered rep / branch manager). They are neither the investor nor the fund. Giving them to the investor is wrong; leaving them unassigned or giving them to a separate party is right. No field on this form belongs to the fund itself (`firm` = 0): the form has no countersignature block.
- Date of birth and date of trust are listed as `blank` (data the person types); `date` is used only for the four dates that go with a signature.
- "Custodian Stamp Here" (page 1) is listed but marked optional.
- The four SECONDARY ___ % places on page 2 are short printed rules, not boxes.
- Pages 4, 7, 8 and the top of 5: every statement has two initials boxes, INVESTOR (left) and CO-INVESTOR (right). The word INITIALS under each box is a caption.

## Page 1: 61 places  (sure: high)

61 closed boxes found by image analysis and each one checked by eye on a 2x overlay. One (Custodian Stamp Here) is a judgement call, marked optional.

| id | kind | whose | label | x0 | y0 | x1 | y1 |
|---|---|---|---|---|---|---|---|
| p1-01 | blank | investor | A. Investment Amount $ | 214.2 | 166.2 | 255.4 | 176.3 |
| p1-02 | tickbox | investor | Initial Investment ($2,500 minimum) | 273.6 | 167.5 | 281.0 | 175.0 |
| p1-03 | tickbox | investor | Subsequent Purchase ($500 minimum) | 395.9 | 167.5 | 402.7 | 175.0 |
| p1-04 | tickbox | investor | B. By wire | 157.4 | 189.8 | 164.1 | 197.3 |
| p1-05 | tickbox | investor | B. By mail (check attached) | 343.9 | 189.8 | 351.3 | 196.6 |
| p1-06 | tickbox | investor | B. Broker-Dealer/Registered Rep will make payment | 343.9 | 207.4 | 351.3 | 214.1 |
| p1-07 | tickbox | investor | C. Series I | 157.4 | 247.2 | 164.1 | 254.0 |
| p1-08 | tickbox | investor | C. Series II | 343.9 | 247.2 | 351.3 | 254.0 |
| p1-09 | tickbox | investor | D. S SHARE | 156.0 | 281.0 | 163.5 | 288.4 |
| p1-10 | tickbox | investor | D. A-I SHARE | 343.2 | 281.0 | 350.6 | 288.4 |
| p1-11 | tickbox | investor | D. I SHARE | 156.0 | 289.1 | 163.5 | 296.5 |
| p1-12 | tickbox | investor | D. A-II SHARE | 343.2 | 295.8 | 350.6 | 302.6 |
| p1-13 | tickbox | investor | D. F-S SHARE | 156.0 | 297.2 | 163.5 | 304.6 |
| p1-14 | tickbox | investor | D. E SHARE | 343.2 | 310.0 | 350.0 | 317.4 |
| p1-15 | tickbox | investor | D. F-I SHARE | 156.0 | 318.8 | 163.5 | 325.6 |
| p1-16 | blank | investor | Brokerage Account Number | 230.4 | 351.2 | 309.4 | 361.3 |
| p1-17 | blank | investor | Custodian Account Number | 395.9 | 351.2 | 477.7 | 361.3 |
| p1-18 | tickbox | investor | Individual or Joint Tenant With Rights of Survivorship | 157.4 | 364.0 | 164.1 | 370.8 |
| p1-19 | tickbox | investor | IRA | 320.9 | 365.4 | 327.7 | 371.5 |
| p1-20 | tickbox | investor | Transfer on Death | 165.5 | 372.1 | 172.9 | 379.6 |
| p1-21 | tickbox | investor | Roth IRA | 320.9 | 373.5 | 327.7 | 380.2 |
| p1-22 | tickbox | investor | Tenants in Common | 157.4 | 385.6 | 164.8 | 393.1 |
| p1-23 | tickbox | investor | SEP IRA | 320.9 | 381.6 | 327.7 | 388.4 |
| p1-24 | tickbox | investor | Simple IRA | 320.9 | 389.7 | 327.7 | 396.5 |
| p1-25 | tickbox | investor | Community Property | 157.4 | 394.4 | 164.8 | 401.2 |
| p1-26 | tickbox | investor | Pension/Profit Sharing Plan | 320.9 | 397.8 | 327.7 | 404.6 |
| p1-27 | tickbox | investor | Uniform Gift/Transfer to Minors | 157.4 | 402.5 | 164.8 | 410.0 |
| p1-28 | blank | investor | State of | 188.5 | 408.6 | 247.3 | 418.7 |
| p1-29 | tickbox | investor | Rollover IRA | 320.9 | 413.3 | 327.7 | 419.4 |
| p1-30 | tickbox | investor | Inherited IRA | 320.9 | 421.4 | 327.7 | 428.2 |
| p1-31 | tickbox | investor | Trust (taxable account type) | 157.4 | 425.5 | 164.8 | 432.9 |
| p1-32 | blank | investor | Other (non-taxable account type), write-in | 347.3 | 428.2 | 473.6 | 439.0 |
| p1-33 | tickbox | investor | Corporation / Partnership / Other | 157.4 | 433.6 | 164.8 | 441.0 |
| p1-34 | tickbox | investor | Other (non-taxable account type) | 320.9 | 429.5 | 327.7 | 436.3 |
| p1-35 | tickbox | investor | Estate | 157.4 | 449.1 | 164.8 | 455.9 |
| p1-36 | blank | unclear | Custodian Stamp Here (optional) | 328.3 | 470.1 | 503.3 | 511.2 |
| p1-37 | blank | unclear | Custodian Name | 209.4 | 474.1 | 314.2 | 484.2 |
| p1-38 | blank | unclear | Custodian Tax ID # | 209.4 | 488.3 | 314.2 | 498.4 |
| p1-39 | blank | unclear | Custodian Phone # | 209.4 | 501.8 | 314.2 | 512.6 |
| p1-40 | blank | investor | ENTITY NAME | 156.7 | 536.2 | 286.4 | 546.4 |
| p1-41 | blank | investor | TAX ID NUMBER | 291.2 | 536.2 | 347.9 | 546.4 |
| p1-42 | blank | investor | DATE OF TRUST | 352.7 | 536.2 | 400.6 | 546.4 |
| p1-43 | blank | investor | ENTITY ADDRESS (legal address) | 156.7 | 554.5 | 400.6 | 564.6 |
| p1-44 | blank | investor | EXEMPTIONS | 406.0 | 555.1 | 516.2 | 564.6 |
| p1-45 | blank | investor | Entity Type: Other, write-in | 457.4 | 572.0 | 516.9 | 582.1 |
| p1-46 | tickbox | investor | Entity Type: Retirement Plan | 157.4 | 574.7 | 164.1 | 581.5 |
| p1-47 | tickbox | investor | Entity Type: Trust | 219.6 | 574.7 | 227.0 | 581.5 |
| p1-48 | tickbox | investor | Entity Type: S-Corp | 256.0 | 574.7 | 263.5 | 581.5 |
| p1-49 | tickbox | investor | Entity Type: C-Corp | 298.6 | 574.7 | 306.0 | 581.5 |
| p1-50 | tickbox | investor | Entity Type: LLC | 342.5 | 574.7 | 349.3 | 581.5 |
| p1-51 | tickbox | investor | Entity Type: Partnership | 375.0 | 574.7 | 382.4 | 581.5 |
| p1-52 | tickbox | investor | Entity Type: Other | 432.4 | 574.7 | 439.8 | 581.5 |
| p1-53 | blank | investor | Jurisdiction (if Non-U.S.) | 221.6 | 585.5 | 278.3 | 595.7 |
| p1-54 | blank | investor | Exempt payee code (if any) | 356.0 | 585.5 | 412.8 | 595.7 |
| p1-55 | blank | investor | Exemption from FATCA reporting code (if any) | 437.1 | 595.0 | 516.2 | 605.1 |
| p1-56 | blank | investor | 3A FIRST NAME | 155.4 | 639.5 | 286.4 | 649.7 |
| p1-57 | blank | investor | 3A (MI) | 291.2 | 639.5 | 314.2 | 649.7 |
| p1-58 | blank | investor | 3A LAST NAME | 317.5 | 639.5 | 419.6 | 649.7 |
| p1-59 | blank | investor | 3A SOCIAL SECURITY NUMBER / TAX ID | 155.4 | 659.8 | 286.4 | 669.9 |
| p1-60 | blank | investor | 3A DATE OF BIRTH | 291.2 | 659.8 | 415.5 | 669.9 |
| p1-61 | blank | investor | 3A DAYTIME PHONE NUMBER | 418.2 | 659.8 | 516.2 | 669.9 |

Must NOT get a field on this page:
- "Exhibit 4.1" and the file-name line at the top
- wire instructions (Name, Bank Name, ABA, Account, Ref): pre-printed values, nothing to fill
- the introduction paragraph in italics
- plus everything in the "all pages" list below

## Page 2: 76 places  (sure: high)

71 boxes found automatically, 1 small PRIMARY box (beneficiary 2) added from its pixels by hand, 4 short SECONDARY ___% rules added from pixel rows; all checked by eye.

| id | kind | whose | label | x0 | y0 | x1 | y1 |
|---|---|---|---|---|---|---|---|
| p2-01 | blank | investor | 3A RESIDENTIAL STREET ADDRESS | 133.8 | 118.9 | 264.9 | 129.0 |
| p2-02 | blank | investor | 3A CITY | 269.6 | 118.9 | 356.7 | 129.0 |
| p2-03 | blank | investor | 3A STATE | 361.5 | 118.9 | 396.6 | 129.0 |
| p2-04 | blank | investor | 3A ZIP | 401.3 | 118.9 | 489.8 | 129.0 |
| p2-05 | blank | investor | 3A EMAIL ADDRESS | 133.8 | 137.1 | 489.8 | 147.9 |
| p2-06 | blank | investor | 3A Country of Citizenship | 383.1 | 158.1 | 489.8 | 168.2 |
| p2-07 | tickbox | investor | 3A Resident Alien | 137.9 | 160.8 | 144.6 | 168.2 |
| p2-08 | tickbox | investor | 3A Non-Resident Alien | 186.5 | 160.8 | 193.9 | 168.2 |
| p2-09 | tickbox | investor | 3A Apollo employee or Immediate Family Member | 137.9 | 190.5 | 144.6 | 197.9 |
| p2-10 | tickbox | investor | 3A AIC officer or director or Immediate Family Member | 223.0 | 190.5 | 229.7 | 197.9 |
| p2-11 | tickbox | investor | 3A Apollo affiliate or Immediate Family Member | 312.2 | 190.5 | 318.9 | 197.9 |
| p2-12 | tickbox | investor | 3A Not Applicable | 404.7 | 190.5 | 411.5 | 197.9 |
| p2-13 | blank | co-investor/second signer | 3B co-investor FIRST NAME | 133.8 | 230.3 | 211.5 | 240.4 |
| p2-14 | blank | co-investor/second signer | 3B co-investor (MI) | 215.6 | 230.3 | 244.6 | 240.4 |
| p2-15 | blank | co-investor/second signer | 3B co-investor LAST NAME | 249.3 | 230.3 | 336.5 | 240.4 |
| p2-16 | blank | co-investor/second signer | 3B co-investor SOCIAL SECURITY NUMBER / TAX ID | 133.8 | 249.2 | 241.9 | 260.0 |
| p2-17 | blank | co-investor/second signer | 3B co-investor DATE OF BIRTH | 246.6 | 249.2 | 336.5 | 260.0 |
| p2-18 | blank | co-investor/second signer | 3B co-investor DAYTIME PHONE NUMBER | 341.9 | 249.2 | 489.8 | 260.0 |
| p2-19 | blank | co-investor/second signer | 3B co-investor RESIDENTIAL STREET ADDRESS | 133.8 | 268.8 | 264.9 | 278.9 |
| p2-20 | blank | co-investor/second signer | 3B co-investor CITY | 269.6 | 268.8 | 356.7 | 278.9 |
| p2-21 | blank | co-investor/second signer | 3B co-investor STATE | 361.5 | 268.8 | 396.6 | 278.9 |
| p2-22 | blank | co-investor/second signer | 3B co-investor ZIP | 401.3 | 268.8 | 489.8 | 278.9 |
| p2-23 | blank | co-investor/second signer | 3B co-investor EMAIL ADDRESS | 133.8 | 288.4 | 489.8 | 299.2 |
| p2-24 | blank | co-investor/second signer | 3B co-investor Country of Citizenship | 383.1 | 308.6 | 489.8 | 318.8 |
| p2-25 | tickbox | co-investor/second signer | 3B co-investor Resident Alien | 137.9 | 311.3 | 144.6 | 318.1 |
| p2-26 | tickbox | co-investor/second signer | 3B co-investor Non-Resident Alien | 186.5 | 311.3 | 193.9 | 318.1 |
| p2-27 | tickbox | co-investor/second signer | 3B co-investor Apollo employee or Immediate Family Member | 137.9 | 341.0 | 144.6 | 348.5 |
| p2-28 | tickbox | co-investor/second signer | 3B co-investor AIC officer or director or Immediate Family Member | 223.0 | 341.0 | 229.7 | 348.5 |
| p2-29 | tickbox | co-investor/second signer | 3B co-investor Apollo affiliate or Immediate Family Member | 312.2 | 341.0 | 318.9 | 348.5 |
| p2-30 | tickbox | co-investor/second signer | 3B co-investor Not Applicable | 404.7 | 341.0 | 411.5 | 348.5 |
| p2-31 | tickbox | investor | 3C beneficiary 1 PRIMARY | 431.0 | 395.0 | 437.8 | 401.1 |
| p2-32 | blank | investor | 3C beneficiary 1 FIRST NAME | 136.5 | 401.1 | 199.3 | 411.9 |
| p2-33 | blank | investor | 3C beneficiary 1 (MI) | 204.1 | 401.1 | 227.7 | 411.9 |
| p2-34 | blank | investor | 3C beneficiary 1 LAST NAME | 233.1 | 401.1 | 318.9 | 411.9 |
| p2-35 | blank | investor | 3C beneficiary 1 SSN | 325.0 | 401.1 | 378.4 | 411.9 |
| p2-36 | blank | investor | 3C beneficiary 1 DATE OF BIRTH | 383.8 | 401.1 | 427.0 | 411.9 |
| p2-37 | blank | investor | 3C beneficiary 1 SECONDARY ____ % (percentage) (rule, not a box) | 474.3 | 403.1 | 496.6 | 411.9 |
| p2-38 | tickbox | investor | 3C beneficiary 1 SECONDARY | 431.7 | 405.2 | 437.8 | 411.9 |
| p2-39 | tickbox | investor | 3C beneficiary 2 PRIMARY | 431.0 | 420.7 | 437.8 | 427.5 |
| p2-40 | blank | investor | 3C beneficiary 2 FIRST NAME | 136.5 | 427.5 | 199.3 | 438.3 |
| p2-41 | blank | investor | 3C beneficiary 2 (MI) | 204.1 | 427.5 | 227.7 | 438.3 |
| p2-42 | blank | investor | 3C beneficiary 2 LAST NAME | 233.1 | 427.5 | 318.9 | 438.3 |
| p2-43 | blank | investor | 3C beneficiary 2 SSN | 325.0 | 427.5 | 378.4 | 438.3 |
| p2-44 | blank | investor | 3C beneficiary 2 DATE OF BIRTH | 383.8 | 427.5 | 427.0 | 438.3 |
| p2-45 | tickbox | investor | 3C beneficiary 2 SECONDARY | 431.7 | 431.5 | 437.8 | 437.6 |
| p2-46 | blank | investor | 3C beneficiary 2 SECONDARY ____ % (percentage) (rule, not a box) | 474.3 | 429.5 | 496.6 | 437.6 |
| p2-47 | tickbox | investor | 3C beneficiary 3 PRIMARY | 431.7 | 447.0 | 437.8 | 453.8 |
| p2-48 | blank | investor | 3C beneficiary 3 FIRST NAME | 136.5 | 453.8 | 199.3 | 464.6 |
| p2-49 | blank | investor | 3C beneficiary 3 (MI) | 204.1 | 453.8 | 227.7 | 464.6 |
| p2-50 | blank | investor | 3C beneficiary 3 LAST NAME | 233.1 | 453.8 | 318.9 | 464.6 |
| p2-51 | blank | investor | 3C beneficiary 3 SSN | 325.0 | 453.8 | 378.4 | 464.6 |
| p2-52 | blank | investor | 3C beneficiary 3 DATE OF BIRTH | 383.8 | 453.8 | 427.0 | 464.6 |
| p2-53 | tickbox | investor | 3C beneficiary 3 SECONDARY | 431.7 | 457.8 | 437.8 | 463.9 |
| p2-54 | blank | investor | 3C beneficiary 3 SECONDARY ____ % (percentage) (rule, not a box) | 474.3 | 455.8 | 496.6 | 463.9 |
| p2-55 | tickbox | investor | 3C beneficiary 4 PRIMARY | 431.7 | 472.0 | 437.8 | 478.1 |
| p2-56 | blank | investor | 3C beneficiary 4 FIRST NAME | 136.5 | 479.4 | 199.3 | 489.6 |
| p2-57 | blank | investor | 3C beneficiary 4 (MI) | 204.1 | 479.4 | 227.7 | 489.6 |
| p2-58 | blank | investor | 3C beneficiary 4 LAST NAME | 233.1 | 479.4 | 318.9 | 489.6 |
| p2-59 | blank | investor | 3C beneficiary 4 SSN | 325.0 | 479.4 | 378.4 | 489.6 |
| p2-60 | blank | investor | 3C beneficiary 4 DATE OF BIRTH | 383.8 | 479.4 | 427.0 | 489.6 |
| p2-61 | tickbox | investor | 3C beneficiary 4 SECONDARY | 431.7 | 482.1 | 437.8 | 488.9 |
| p2-62 | blank | investor | 3C beneficiary 4 SECONDARY ____ % (percentage) (rule, not a box) | 474.3 | 480.1 | 496.6 | 488.9 |
| p2-63 | blank | investor | Custodian/Guardian (for a minor Beneficiary) | 135.2 | 507.1 | 489.8 | 517.2 |
| p2-64 | blank | investor | (4) EMAIL ADDRESS | 134.5 | 531.4 | 489.1 | 541.5 |
| p2-65 | blank | investor | (4) MAILING STREET ADDRESS | 133.8 | 552.3 | 264.9 | 562.5 |
| p2-66 | blank | investor | (4) CITY | 269.6 | 552.3 | 356.7 | 562.5 |
| p2-67 | blank | investor | (4) STATE | 361.5 | 552.3 | 396.6 | 562.5 |
| p2-68 | blank | investor | (4) ZIP | 401.3 | 552.3 | 489.8 | 562.5 |
| p2-69 | blank | investor | (5) interested party FIRST NAME | 133.8 | 590.2 | 196.6 | 601.0 |
| p2-70 | blank | investor | (5) (MI) | 199.3 | 590.2 | 223.0 | 601.0 |
| p2-71 | blank | investor | (5) LAST NAME | 226.4 | 590.2 | 316.2 | 601.0 |
| p2-72 | blank | investor | (5) DAY TIME PHONE NUMBER | 319.6 | 590.2 | 408.8 | 601.0 |
| p2-73 | blank | investor | (5) RESIDENTIAL STREET ADDRESS | 133.8 | 611.1 | 264.9 | 621.2 |
| p2-74 | blank | investor | (5) CITY | 269.6 | 611.1 | 356.7 | 621.2 |
| p2-75 | blank | investor | (5) STATE | 361.5 | 611.1 | 396.6 | 621.2 |
| p2-76 | blank | investor | (5) ZIP | 401.3 | 611.1 | 490.5 | 621.2 |

Must NOT get a field on this page:
- short rule above footnote 1 and the footnote text
- the words "Country of Citizenship" under the blank (a caption, the field is the box above it)
- plus everything in the "all pages" list below

## Page 3: 19 places  (sure: high)

19 boxes, each checked by eye.

| id | kind | whose | label | x0 | y0 | x1 | y1 |
|---|---|---|---|---|---|---|---|
| p3-01 | tickbox | investor | 6A opt out of Distribution Reinvestment Plan: check this box | 419.6 | 127.7 | 426.3 | 134.4 |
| p3-02 | tickbox | investor | 6B 1. Cash/Check Mailed to the address set forth above | 143.3 | 168.9 | 149.4 | 175.6 |
| p3-03 | tickbox | investor | 6B 2. Cash/Check Mailed to Third Party/Custodian | 143.3 | 180.4 | 149.4 | 187.1 |
| p3-04 | blank | investor | NAME / ENTITY NAME / FINANCIAL INSTITUTION | 136.5 | 196.6 | 297.3 | 207.4 |
| p3-05 | blank | investor | MAILING ADDRESS (third party) | 301.3 | 196.6 | 505.4 | 207.4 |
| p3-06 | blank | investor | CITY (third party) | 136.5 | 216.1 | 206.8 | 226.3 |
| p3-07 | blank | investor | STATE (third party) | 210.8 | 216.1 | 250.7 | 226.3 |
| p3-08 | blank | investor | ZIP (third party) | 254.7 | 216.1 | 293.9 | 226.3 |
| p3-09 | blank | investor | ACCOUNT NUMBER (required) | 301.3 | 216.1 | 505.4 | 226.3 |
| p3-10 | tickbox | investor | 6B 3. Cash/Direct Deposit | 144.6 | 232.3 | 151.4 | 239.1 |
| p3-11 | blank | investor | FINANCIAL INSTITUTION NAME | 136.5 | 277.6 | 228.4 | 287.7 |
| p3-12 | blank | investor | MAILING ADDRESS (bank) | 233.1 | 277.6 | 325.0 | 287.7 |
| p3-13 | blank | investor | CITY (bank) | 328.4 | 277.6 | 399.3 | 287.7 |
| p3-14 | blank | investor | STATE (bank) | 403.4 | 277.6 | 442.5 | 287.7 |
| p3-15 | blank | investor | ZIP (bank) | 449.3 | 277.6 | 506.0 | 287.7 |
| p3-16 | blank | investor | YOUR BANK'S ABA ROUTING NUMBER | 136.5 | 296.5 | 325.0 | 306.6 |
| p3-17 | blank | investor | YOUR BANK ACCOUNT NUMBER | 328.4 | 296.5 | 506.0 | 306.6 |
| p3-18 | initials | investor | (7) Please initial to consent to electronic delivery | 253.4 | 406.5 | 276.4 | 416.6 |
| p3-19 | blank | investor | (7) EMAIL (if blank, email from Section 4 or 3.A is used) | 136.5 | 427.5 | 506.0 | 437.6 |

Must NOT get a field on this page:
- the underlined words "pre-printed voided check" (underline is emphasis, not a blank)
- (8) Power of Attorney: running prose A to F, no field
- plus everything in the "all pages" list below

## Page 4: 14 places  (sure: high)

7 rows x 2 initials boxes; count and columns checked by eye.

| id | kind | whose | label | x0 | y0 | x1 | y1 |
|---|---|---|---|---|---|---|---|
| p4-01 | initials | investor | INVESTOR INITIALS - I have received a copy of the PPM | 414.2 | 451.8 | 456.7 | 459.9 |
| p4-02 | initials | co-investor/second signer | CO-INVESTOR INITIALS - I have received a copy of the PPM | 462.8 | 451.8 | 506.0 | 459.9 |
| p4-03 | initials | investor | INVESTOR INITIALS - I am an "accredited investor" (Rule 501) | 414.2 | 474.0 | 456.7 | 482.1 |
| p4-04 | initials | co-investor/second signer | CO-INVESTOR INITIALS - I am an "accredited investor" (Rule 501) | 462.8 | 474.0 | 506.0 | 482.1 |
| p4-05 | initials | investor | INVESTOR INITIALS - no public market for the Shares / not liquid | 414.2 | 497.7 | 456.7 | 505.8 |
| p4-06 | initials | co-investor/second signer | CO-INVESTOR INITIALS - no public market for the Shares / not liquid | 462.8 | 497.7 | 506.0 | 505.8 |
| p4-07 | initials | investor | INVESTOR INITIALS - Shares have not been registered | 414.2 | 523.3 | 456.7 | 531.4 |
| p4-08 | initials | co-investor/second signer | CO-INVESTOR INITIALS - Shares have not been registered | 462.8 | 523.3 | 506.0 | 531.4 |
| p4-09 | initials | investor | INVESTOR INITIALS - purchasing the Shares for my own account | 414.2 | 549.0 | 456.7 | 557.1 |
| p4-10 | initials | co-investor/second signer | CO-INVESTOR INITIALS - purchasing the Shares for my own account | 462.8 | 549.0 | 506.0 | 557.1 |
| p4-11 | initials | investor | INVESTOR INITIALS - transaction price per Share made available on website | 414.2 | 574.6 | 456.7 | 582.7 |
| p4-12 | initials | co-investor/second signer | CO-INVESTOR INITIALS - transaction price per Share made available on website | 462.8 | 574.6 | 506.0 | 582.7 |
| p4-13 | initials | investor | INVESTOR INITIALS - not committed to purchase / may cancel subscription | 414.2 | 597.6 | 456.7 | 605.7 |
| p4-14 | initials | co-investor/second signer | CO-INVESTOR INITIALS - not committed to purchase / may cancel subscription | 462.8 | 597.6 | 506.0 | 605.7 |

Must NOT get a field on this page:
- sections (8) to (11): running prose
- column headings INVESTOR / CO-INVESTOR and the small word INITIALS under each box (captions, not separate fields)
- plus everything in the "all pages" list below

## Page 5: 19 places  (sure: high)

19 boxes, each checked by eye. Whether the broker-dealer blanks get fields is a product decision; they are printed places to complete, so they are listed.

| id | kind | whose | label | x0 | y0 | x1 | y1 |
|---|---|---|---|---|---|---|---|
| p5-01 | initials | investor | ERISA benefit plan investor (initial ONLY if applicable) - INVESTOR INITIALS | 414.2 | 116.2 | 456.7 | 124.3 |
| p5-02 | initials | co-investor/second signer | ERISA benefit plan investor - CO-INVESTOR INITIALS | 462.8 | 116.2 | 505.4 | 124.3 |
| p5-03 | signature | investor | SIGNATURE OF INVESTOR | 133.8 | 291.1 | 292.6 | 301.2 |
| p5-04 | date | investor | DATE (investor signature) | 297.3 | 291.1 | 330.4 | 301.2 |
| p5-05 | signature | co-investor/second signer | SIGNATURE OF CO-INVESTOR OR CUSTODIAN (if applicable) | 335.1 | 291.1 | 467.5 | 301.2 |
| p5-06 | date | co-investor/second signer | DATE (co-investor/custodian signature) | 472.3 | 291.1 | 505.4 | 301.2 |
| p5-07 | blank | unclear | BROKER DEALER OR RIA FIRM | 133.8 | 337.0 | 310.1 | 347.1 |
| p5-08 | blank | unclear | REGISTERED REP OR INVESTMENT ADVISOR REP NAME | 314.2 | 337.0 | 505.4 | 347.1 |
| p5-09 | blank | unclear | ADVISOR MAILING ADDRESS | 133.8 | 356.6 | 505.4 | 366.7 |
| p5-10 | blank | unclear | CITY (advisor) | 133.8 | 373.4 | 277.7 | 383.6 |
| p5-11 | blank | unclear | STATE (advisor) | 281.1 | 374.1 | 388.5 | 383.6 |
| p5-12 | blank | unclear | ZIP (advisor) | 391.9 | 374.1 | 505.4 | 383.6 |
| p5-13 | blank | unclear | FIRM CRD NUMBER | 133.8 | 393.0 | 260.1 | 403.1 |
| p5-14 | blank | unclear | REP/RIA NUMBER | 263.5 | 393.0 | 354.7 | 403.1 |
| p5-15 | blank | unclear | TELEPHONE NUMBER (advisor) | 358.1 | 393.0 | 505.4 | 403.1 |
| p5-16 | blank | unclear | E-MAIL ADDRESS (advisor) | 133.8 | 412.6 | 325.7 | 422.7 |
| p5-17 | blank | unclear | FAX NUMBER (advisor) | 329.7 | 412.6 | 505.4 | 422.7 |
| p5-18 | blank | unclear | OPERATIONS CONTACT NAME | 133.8 | 430.2 | 325.7 | 440.3 |
| p5-19 | blank | unclear | OPERATIONS CONTACT E-MAIL ADDRESS | 329.7 | 430.2 | 505.4 | 440.3 |

Must NOT get a field on this page:
- W-9 certification text (1) to (4)
- short rule above footnote 2, the footnote, "Continued next page"
- column headings INVESTOR / CO-INVESTOR
- plus everything in the "all pages" list below

## Page 6: 4 places  (sure: high)

4 boxes, checked by eye.

| id | kind | whose | label | x0 | y0 | x1 | y1 |
|---|---|---|---|---|---|---|---|
| p6-01 | signature | unclear | REGISTERED REP OR INVESTMENT ADVISOR SIGNATURE | 133.8 | 164.2 | 292.6 | 174.3 |
| p6-02 | date | unclear | DATE (registered rep signature) | 295.9 | 164.2 | 329.7 | 174.3 |
| p6-03 | signature | unclear | BRANCH MANAGER SIGNATURE (if required by Broker-Dealer) | 334.4 | 164.2 | 449.3 | 174.3 |
| p6-04 | date | unclear | DATE (branch manager signature) | 454.0 | 164.2 | 506.0 | 174.3 |

Must NOT get a field on this page:
- rule under "Return the completed Subscription Agreement to:" and the two address blocks (pre-printed)
- the investor-relations phone and e-mail line (pre-printed)
- the empty lower half of the page
- plus everything in the "all pages" list below

## Page 7: 32 places  (sure: high)

16 rows x 2 initials boxes; count matches the 16 statements read by eye.

| id | kind | whose | label | x0 | y0 | x1 | y1 |
|---|---|---|---|---|---|---|---|
| p7-01 | initials | investor | INVESTOR INITIALS - individual: net worth in excess of $1 million | 413.5 | 124.3 | 456.0 | 132.4 |
| p7-02 | initials | co-investor/second signer | CO-INVESTOR INITIALS - individual: net worth in excess of $1 million | 462.1 | 124.3 | 505.4 | 132.4 |
| p7-03 | initials | investor | INVESTOR INITIALS - individual: income in excess of $200,000 | 413.5 | 177.0 | 456.0 | 185.1 |
| p7-04 | initials | co-investor/second signer | CO-INVESTOR INITIALS - individual: income in excess of $200,000 | 462.1 | 177.0 | 505.4 | 185.1 |
| p7-05 | initials | investor | INVESTOR INITIALS - individual: joint income in excess of $300,000 | 413.5 | 202.0 | 456.0 | 210.1 |
| p7-06 | initials | co-investor/second signer | CO-INVESTOR INITIALS - individual: joint income in excess of $300,000 | 462.1 | 202.0 | 505.4 | 210.1 |
| p7-07 | initials | investor | INVESTOR INITIALS - individual: holds Series 7 / 82 / 65 licence | 413.5 | 227.6 | 456.0 | 235.7 |
| p7-08 | initials | co-investor/second signer | CO-INVESTOR INITIALS - individual: holds Series 7 / 82 / 65 licence | 462.1 | 227.6 | 505.4 | 235.7 |
| p7-09 | initials | investor | INVESTOR INITIALS - entity: state plan, total assets in excess of $5 million | 413.5 | 297.2 | 456.0 | 304.6 |
| p7-10 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: state plan, total assets in excess of $5 million | 462.1 | 297.2 | 505.4 | 304.6 |
| p7-11 | initials | investor | INVESTOR INITIALS - entity: all equity owners are accredited investors | 413.5 | 330.2 | 456.0 | 337.7 |
| p7-12 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: all equity owners are accredited investors | 462.1 | 330.2 | 505.4 | 338.3 |
| p7-13 | initials | investor | INVESTOR INITIALS - entity: bank / savings and loan association | 413.5 | 363.3 | 456.0 | 370.7 |
| p7-14 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: bank / savings and loan association | 462.1 | 363.3 | 505.4 | 370.7 |
| p7-15 | initials | investor | INVESTOR INITIALS - entity: insurance company | 413.5 | 394.4 | 456.0 | 402.5 |
| p7-16 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: insurance company | 462.1 | 394.4 | 505.4 | 402.5 |
| p7-17 | initials | investor | INVESTOR INITIALS - entity: broker-dealer (1934 Act) | 413.5 | 418.0 | 456.0 | 426.1 |
| p7-18 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: broker-dealer (1934 Act) | 462.1 | 418.0 | 504.7 | 426.1 |
| p7-19 | initials | investor | INVESTOR INITIALS - entity: investment company (1940 Act) | 413.5 | 438.9 | 456.0 | 446.4 |
| p7-20 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: investment company (1940 Act) | 462.1 | 438.9 | 505.4 | 446.4 |
| p7-21 | initials | investor | INVESTOR INITIALS - entity: business development company | 413.5 | 468.0 | 456.0 | 476.1 |
| p7-22 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: business development company | 462.1 | 468.0 | 505.4 | 476.1 |
| p7-23 | initials | investor | INVESTOR INITIALS - entity: Small Business Investment Company | 413.5 | 492.3 | 456.0 | 499.7 |
| p7-24 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: Small Business Investment Company | 462.1 | 492.3 | 505.4 | 499.7 |
| p7-25 | initials | investor | INVESTOR INITIALS - entity: private business development company | 413.5 | 522.0 | 456.0 | 530.1 |
| p7-26 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: private business development company | 462.1 | 522.0 | 505.4 | 530.1 |
| p7-27 | initials | investor | INVESTOR INITIALS - entity: 501(c)(3) corporation / trust / partnership over $5 million | 413.5 | 550.3 | 456.0 | 558.4 |
| p7-28 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: 501(c)(3) corporation / trust / partnership over $5 million | 462.1 | 550.3 | 505.4 | 558.4 |
| p7-29 | initials | investor | INVESTOR INITIALS - entity: trust with total assets in excess of $5 million | 413.5 | 577.3 | 456.0 | 585.4 |
| p7-30 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: trust with total assets in excess of $5 million | 462.1 | 577.3 | 505.4 | 585.4 |
| p7-31 | initials | investor | INVESTOR INITIALS - entity: employee benefit plan (ERISA) | 412.8 | 603.0 | 456.0 | 611.1 |
| p7-32 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: employee benefit plan (ERISA) | 462.1 | 603.0 | 504.7 | 611.1 |

Must NOT get a field on this page:
- headings "FOR INDIVIDUALS" / "FOR ENTITIES", "(Continued on next page)"
- column headings INVESTOR / CO-INVESTOR and the captions INITIALS
- plus everything in the "all pages" list below

## Page 8: 16 places  (sure: high)

8 rows x 2 initials boxes; count matches the 8 statements.

| id | kind | whose | label | x0 | y0 | x1 | y1 |
|---|---|---|---|---|---|---|---|
| p8-01 | initials | investor | INVESTOR INITIALS - entity: state plan, total assets in excess of $5 million (repeated) | 435.8 | 124.3 | 478.3 | 132.4 |
| p8-02 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: state plan, total assets in excess of $5 million (repeated) | 484.4 | 124.3 | 527.7 | 132.4 |
| p8-03 | initials | investor | INVESTOR INITIALS - entity: Rural Business Investment Company | 435.8 | 148.6 | 478.3 | 156.7 |
| p8-04 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: Rural Business Investment Company | 484.4 | 148.6 | 527.7 | 156.7 |
| p8-05 | initials | investor | INVESTOR INITIALS - entity: investment adviser registered (Section 203) | 435.8 | 168.2 | 478.3 | 176.3 |
| p8-06 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: investment adviser registered (Section 203) | 484.4 | 168.2 | 527.7 | 176.3 |
| p8-07 | initials | investor | INVESTOR INITIALS - entity: investment adviser relying on exemption (203(l) or (m)) | 435.8 | 188.5 | 478.3 | 195.9 |
| p8-08 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: investment adviser relying on exemption (203(l) or (m)) | 484.4 | 188.5 | 527.7 | 195.9 |
| p8-09 | initials | investor | INVESTOR INITIALS - entity: not listed above, investments in excess of $5,000,000 | 435.8 | 208.0 | 478.3 | 216.1 |
| p8-10 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: not listed above, investments in excess of $5,000,000 | 484.4 | 208.0 | 527.7 | 216.1 |
| p8-11 | initials | investor | INVESTOR INITIALS - entity: "family office" | 435.8 | 237.1 | 478.3 | 245.2 |
| p8-12 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: "family office" | 484.4 | 237.1 | 527.7 | 245.2 |
| p8-13 | initials | investor | INVESTOR INITIALS - entity: "family client" | 435.8 | 278.9 | 478.3 | 287.0 |
| p8-14 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity: "family client" | 484.4 | 278.9 | 527.7 | 287.0 |
| p8-15 | initials | investor | INVESTOR INITIALS - entity formed for the purpose: each owner meets suitability | 435.8 | 305.3 | 478.3 | 313.4 |
| p8-16 | initials | co-investor/second signer | CO-INVESTOR INITIALS - entity formed for the purpose: each owner meets suitability | 484.4 | 305.3 | 527.7 | 313.4 |

Must NOT get a field on this page:
- the long vertical rule down the left side and the empty lower two thirds of the page
- closing paragraph "In the case of sales to fiduciary accounts..."
- column headings INVESTOR / CO-INVESTOR and the captions INITIALS
- plus everything in the "all pages" list below

## Must NOT get a field, all pages

- browser print header at the very top: date/time (left) and "EX-4.1" (centre); footer: the sec.gov address (left) and "n/8" (right)
- thin grey rule across the page under the browser header (pages 2-8; about y=40 pt)
- faint dotted-looking rule just under the form image (about y=712 pt on page 1, y=696 pt on pages 2-8): it is microscopic hidden text, not a line to write on
- APOLLO logo (green letters) and the title "Apollo Infrastructure Company LLC Subscription Agreement"
- left column with the section number and section title, and the vertical rule that separates it from the form
- horizontal rules that separate the sections
- the black "PAGE n OF 8" bar, the rule it sits on, and the form code "AIC-IU233450 (1223)"
