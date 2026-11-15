# Answer sheet: a029 (10 pages)

PDF points, origin top-left, y grows downward. Underscore run: the character box. Drawn rule: x extent, y1 = bottom of the rule, y0 = y1 - 10.

pdfplumber characters and filled rectangles of the filed PDF; every page looked at at 100 dpi; overlays looked at.

## For signing

One investor completes and signs the signature page (page 9); the company accepts under it. Page 10 is the offering statement's own signatures page, already signed.

- Investor signs on page(s): [9]
- Firm signs on page(s): [9]
- Co-investor places: no
- Third parties: none

## Doubts and judgements

- The underscore blanks on pages 2, 4 and 6 are the company's (offering dates, circular link, its own wire details highlighted yellow) and are left out.
- Page 10 belongs to the Form 1-A filing (officers' /s/ signatures and a date blank), not to the investor.

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 2 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 3 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 4 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 5 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 7 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 8 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 9 | 11 | 0 | 0 | 9 | 2 | 0 | sure |
| 10 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: the filing's own signatures, already made) |
| all | 11 | 0 | 0 | 9 | 2 | 0 | |

By owner: firm 2, investor 9

## Places

### Page 1

Must NOT get a field: the title underline (y 117)

### Page 2

Must NOT get a field: "February __, 2024", "August __, 2024", "October __, 2023" (twice): dates in the prose that the company completes (offering circular and termination dates)

### Page 4

Must NOT get a field: "___________________." and "qualified by the SEC on ______________, 2023": the company's blanks for the offering circular link and qualification date; the yellow highlight of a paragraph (y 359-440): a drafting mark

### Page 6

Must NOT get a field: the wire instructions block (highlighted yellow): ABA #, Account# and three bank lines are the company's own bank details to fill in, not the investor's

### Page 9

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p09-exec-day | blank | date | investor | yes | 429.5, 349.6, 459.6, 359.5 | underscore run of 6 | Date of execution: day (witness clause) ("executed as of the ______ day") |  |
| p09-exec-month | blank | date | investor | yes | 492.5, 349.6, 537.6, 359.5 | underscore run of 9 | Date of execution: month (the year 2023 is printed) ("day of _________") |  |
| p09-tokens | blank | amount | investor | yes | 250.7, 385.4, 540.0, 395.4 | drawn rule at y=395.4 (thin filled rectangle 0; box = the 10 pt of writing room above it) | Number of tokens subscribed for (caption left, rule in the right column) ("Number of Tokens Subscribed For:") |  |
| p09-price | blank | amount | investor | yes | 250.7, 409.9, 540.0, 419.9 | drawn rule at y=419.9 (thin filled rectangle 1; box = the 10 pt of writing room above it) | Total purchase price (a "$" prints at the start of the rule) (caption left, rule in the right column) ("Total Purchase Price:") |  |
| p09-signature | signature | signature | investor | yes | 250.7, 434.4, 540.0, 444.4 | drawn rule at y=444.4 (thin filled rectangle 2; box = the 10 pt of writing room above it) | Investor signature (caption left, rule in the right column) ("Signature of Investor:") |  |
| p09-name | blank | name | investor | yes | 250.7, 459.0, 540.0, 469.0 | drawn rule at y=469.0 (thin filled rectangle 3; box = the 10 pt of writing room above it) | Investor name (caption left, rule in the right column) ("Name of Investor:") |  |
| p09-address | blank | address | investor | yes | 250.7, 483.4, 540.0, 493.4 | drawn rule at y=493.4 (thin filled rectangle 4; box = the 10 pt of writing room above it) | Investor address (caption left, rule in the right column) ("Address of Investor:") |  |
| p09-email | blank | email | investor | yes | 250.7, 507.9, 540.0, 517.9 | drawn rule at y=517.9 (thin filled rectangle 5; box = the 10 pt of writing room above it) | Investor e-mail address (caption left, rule in the right column) ("Electronic Mail Address:") |  |
| p09-tin | blank | tax number | investor | yes | 250.0, 532.5, 540.0, 542.5 | drawn rule at y=542.5 (thin filled rectangle 6; box = the 10 pt of writing room above it) | Investor social security or tax ID number (caption left, rule in the right column) ("Investor's SS# or Tax ID#:") |  |
| p09-accept-signature | signature | signature | firm | yes | 215.3, 578.5, 385.1, 588.5 | underscore run of 34 | Signature of the company's authorized signatory (name printed on the next line) ("Signature of Authorized Signatory:") |  |
| p09-accept-date | blank | date | firm | yes | 156.1, 624.5, 241.1, 634.4 | underscore run of 17 | Date of acceptance (the year 2023 is printed) ("Date of Acceptance:") |  |

Must NOT get a field: "Name of Authorized Signatory: Turaj Belgameh, CEO" (printed); the bracketed page caption

### Page 10

Must NOT get a field: the Form 1-A signatures page of the offering statement: the company's officers, already signed /s/; "Date: September __, 2023" belongs to it; the rules under the /s/ names

