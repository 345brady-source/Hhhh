# Answer sheet: a095 (2 pages)

PDF points, origin top-left, y grows downward. Underscore run: the character box. Drawn rule: x extent, y1 = bottom of the rule, y0 = y1 - 10. Box glyph: the character box.

pdfplumber characters and thin filled rectangles (Chromium draws table borders as rectangles); both pages looked at at 100 dpi; overlays looked at.

## For signing

The buyer completes page 1 and signs on page 2; a joint buyer gives name, tax ID, e-mail and address on page 1 but has no signature line; the company accepts on page 2.

- Investor signs on page(s): [2]
- Firm signs on page(s): [2]
- Co-investor places: yes
- Third parties: none

## Doubts and judgements

- Tick boxes are Wingdings boxes that printed as "¨" (no Wingdings font in the print); each gets the character box.
- Page 2 left column: three captions and two rules; read as caption above rule. The date has no printed line.
- The joint buyer has no printed signature place.

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 27 | 9 | 0 | 18 | 0 | 0 | sure (the corporation choice has no printed box, so it gets none) |
| 2 | 8 | 0 | 0 | 5 | 2 | 1 | sure of every place; which side of the two left rules each caption belongs to is a judgement (see doubt) |
| all | 35 | 9 | 0 | 23 | 2 | 1 | |

By owner: co-investor 4, firm 5, investor 26

## Places

### Page 1

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p01-shares | blank | amount | investor | yes | 215.0, 115.2, 260.0, 125.2 | underscore run of 9 | Number of shares subscribed for ("subscribes for ___ Shares") |  |
| p01-total | blank | amount | investor | yes | 282.4, 139.2, 342.4, 149.2 | underscore run of 12 | Total subscription price in dollars ("Total subscription price") |  |
| p01-name | blank | name | investor | yes | 33.7, 222.5, 306.0, 232.5 | drawn rule at y=232.5 (thin filled rectangle 0; box = the 10 pt of writing room above it) | Investor name (caption above the rule) ("Name (type or print)") |  |
| p01-tin | blank | tax number | investor | yes | 311.2, 222.5, 578.2, 232.5 | drawn rule at y=232.5 (thin filled rectangle 1; box = the 10 pt of writing room above it) | Investor SSN / EIN / taxpayer ID (caption above the rule) ("SSN/EIN/Taxpayer I.D.") |  |
| p01-email | blank | email | investor | no | 104.2, 246.5, 294.7, 256.5 | drawn rule at y=256.5 (thin filled rectangle 2; box = the 10 pt of writing room above it) | Investor e-mail address ("E-mail address:") |  |
| p01-address | blank | address | investor | yes | 77.2, 271.2, 311.2, 281.2 | drawn rule at y=281.2 (thin filled rectangle 3; box = the 10 pt of writing room above it) | Investor address ("Address:") |  |
| p01-joint-name | blank | name | co-investor | no | 33.7, 318.5, 306.0, 328.5 | drawn rule at y=328.5 (thin filled rectangle 4; box = the 10 pt of writing room above it) | Joint investor name (caption above the rule) ("Joint Name (type or print)") |  |
| p01-joint-tin | blank | tax number | co-investor | no | 311.2, 318.5, 578.2, 328.5 | drawn rule at y=328.5 (thin filled rectangle 5; box = the 10 pt of writing room above it) | Joint investor SSN / EIN / taxpayer ID ("SSN/EIN/Taxpayer I.D.") |  |
| p01-joint-email | blank | email | co-investor | no | 96.0, 343.2, 291.0, 353.2 | drawn rule at y=353.2 (thin filled rectangle 6; box = the 10 pt of writing room above it) | Joint investor e-mail address ("E-mail address:") |  |
| p01-joint-address | blank | address | co-investor | no | 72.0, 367.2, 294.7, 377.2 | drawn rule at y=377.2 (thin filled rectangle 7; box = the 10 pt of writing room above it) | Joint investor address ("Address:") |  |
| p01-mail-street | blank | address | investor | no | 219.0, 392.0, 289.5, 402.0 | drawn rule at y=402.0 (thin filled rectangle 8; box = the 10 pt of writing room above it) | Mailing address if different: street (caption under the rule segment) ("Street") |  |
| p01-mail-city | blank | text | investor | no | 289.5, 392.0, 523.5, 402.0 | drawn rule at y=402.0 (thin filled rectangle 9; box = the 10 pt of writing room above it) | Mailing address if different: city / state ("City/State") |  |
| p01-mail-zip | blank | text | investor | no | 523.5, 392.0, 578.2, 402.0 | drawn rule at y=402.0 (thin filled rectangle 10; box = the 10 pt of writing room above it) | Mailing address if different: zip ("Zip") |  |
| p01-business-phone | blank | phone | investor | no | 132.0, 428.0, 284.2, 438.0 | drawn rule at y=438.0 (thin filled rectangle 11; box = the 10 pt of writing room above it) | Business phone (area code goes between the printed brackets before the rule) ("Business Phone: ( )") |  |
| p01-home-phone | blank | phone | investor | no | 371.2, 428.0, 578.2, 438.0 | drawn rule at y=438.0 (thin filled rectangle 12; box = the 10 pt of writing room above it) | Home phone (area code between the printed brackets) ("Home Phone: ( )") |  |
| p01-own-individual | tickbox | tickbox | investor | no | 33.7, 475.2, 37.1, 485.2 | Wingdings box character printed as '¨' (the print had no Wingdings font); box = the character's box | Type of ownership: Individual ("Individual") |  |
| p01-own-custodian | tickbox | tickbox | investor | no | 197.1, 487.2, 200.4, 497.2 | Wingdings box character printed as '¨' (the print had no Wingdings font); box = the character's box | Type of ownership: Custodian for ("Custodian for") |  |
| p01-custodian-for | blank | name | investor | no | 284.3, 487.2, 394.2, 497.2 | underscore run of 22 | Custodian for: whom ("Custodian for:") |  |
| p01-own-tic | tickbox | tickbox | investor | no | 33.7, 499.2, 37.1, 509.2 | Wingdings box character printed as '¨' (the print had no Wingdings font); box = the character's box | Type of ownership: Tenants in Common ("Tenants in Common") |  |
| p01-own-ugma | tickbox | tickbox | investor | no | 197.1, 511.2, 200.4, 521.2 | Wingdings box character printed as '¨' (the print had no Wingdings font); box = the character's box | Type of ownership: Uniform Gifts to Minors Act ("Uniform Gifts to Minors Act") |  |
| p01-ugma-state | blank | text | investor | no | 403.4, 511.2, 458.4, 521.2 | underscore run of 11 | Uniform Gifts to Minors Act: which state ("of the State of:") |  |
| p01-own-jtwros | tickbox | tickbox | investor | no | 33.7, 547.2, 37.1, 557.2 | Wingdings box character printed as '¨' (the print had no Wingdings font); box = the character's box | Type of ownership: Joint Tenants with rights of Survivorship ("Joint Tenants with rights of Survivorship") |  |
| p01-own-partnership | tickbox | tickbox | investor | no | 33.7, 559.2, 37.1, 569.2 | Wingdings box character printed as '¨' (the print had no Wingdings font); box = the character's box | Type of ownership: Partnership ("Partnership") |  |
| p01-own-trust | tickbox | tickbox | investor | no | 33.7, 571.2, 37.1, 581.2 | Wingdings box character printed as '¨' (the print had no Wingdings font); box = the character's box | Type of ownership: Trust ("Trust") |  |
| p01-own-community | tickbox | tickbox | investor | no | 33.7, 583.2, 37.1, 593.2 | Wingdings box character printed as '¨' (the print had no Wingdings font); box = the character's box | Type of ownership: Community Property ("Community Property") |  |
| p01-own-other | tickbox | tickbox | investor | no | 33.7, 595.2, 37.1, 605.2 | Wingdings box character printed as '¨' (the print had no Wingdings font); box = the character's box | Type of ownership: Other (please explain) ("Other (please explain)") |  |
| p01-own-other-text | blank | text | investor | no | 136.2, 595.2, 286.1, 605.2 | underscore run of 30 | Other type of ownership, explained ("Other (please explain):") |  |

Must NOT get a field: the title and section-heading underlines (y 64, 100, 196, 460, 640); the "Corporation (Inc., LLC, LP) Please List all officers..." lines: no box and no blank is printed for them; browser header and footer (date, file name, URL, page n/2), and the stray underscore in the browser header and in the EX-99.2 line

### Page 2

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p02-accept-day | blank | date | firm | yes | 384.8, 385.2, 399.8, 395.2 | underscore run of 3 | Acceptance date: day ("Accepted this ___ day") |  |
| p02-accept-month | blank | date | firm | yes | 430.1, 385.2, 470.1, 395.2 | underscore run of 8 | Acceptance date: month ("day of ________") |  |
| p02-accept-year | blank | date | firm | yes | 490.1, 385.2, 495.1, 395.2 | underscore run of 1 | Acceptance date: last digit of the year ("201_") |  |
| p02-signature | signature | signature | investor | yes | 33.7, 397.2, 279.0, 407.2 | drawn rule at y=407.2 (thin filled rectangle 0; box = the 10 pt of writing room above it) | Signature of buyer (caption "Signature of Buyer" above, 35 pt of room down to the rule) ("Signature of Buyer") | caption side: the captions "Printed Name" and "Date:" print just UNDER the two rules; read here as captions above their rules (signature caption, room, rule; name caption, rule; date caption with no rule) |
| p02-printed-name | blank | name | investor | yes | 33.7, 433.2, 279.0, 443.2 | drawn rule at y=443.2 (thin filled rectangle 1; box = the 10 pt of writing room above it) | Printed name of buyer ("Printed Name") | could be read as the rule above the caption (y 406.5) instead; see p02-signature |
| p02-date | date | date | investor | yes | 58.0, 444.4, 279.0, 454.4 | no printed line: the room right of the caption "Date:" to the end of the column (x 279) | Date beside the buyer signature (caption with a colon, no rule printed) ("Date:") | no printed line; box is the room beside the caption |
| p02-accept-signature | signature | signature | firm | yes | 327.7, 479.0, 501.7, 489.0 | drawn rule at y=489.0 (thin filled rectangles [2, 3] joined; box = the 10 pt of writing room above it) | Signature accepting for the company (rule under "Accepted by:") ("Accepted by:") |  |
| p02-accept-title | blank | title | firm | yes | 349.5, 502.2, 501.7, 512.2 | drawn rule at y=512.2 (thin filled rectangle 4; box = the 10 pt of writing room above it) | Title of the person accepting for the company ("Title:") |  |

Must NOT get a field: section-heading underlines (y 154, 274); the company name and delivery address (printed); browser header and footer

