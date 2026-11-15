# Answer sheet: a013 (10 pages)

Source: https://www.sec.gov/Archives/edgar/data/1697746/000169774618000004/exh17.4subagmtbfi.pdf

PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt of writing room above it. Cell: the cell's own rules. Tick box: the printed square (ink at 400 dpi). Picture pages: measured on the picture's own pixels and converted through the page's drawing matrix.

pdfplumber characters and drawn rectangles (geom.json in work-g1); tick squares from ink at 400 dpi; every page looked at at 100 dpi; overlays drawn and looked at.

## Who signs

The purchaser signs page 8 as an individual (with a joint title owner if any) or as an entity, gives tax numbers, domicile and amount; Appendix A repeats shares and price; a blank IRS Form W-9 (a picture) is attached for the investor; the company accepts on page 8 with the number of shares and its signature.

- Investor pages: [8, 9, 10]
- Firm pages: [8]
- Co-investor: True
- Third parties: none

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 2 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 3 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 4 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 5 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 7 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 8 | 19 | 0 | 0 | 15 | 4 | 0 | sure (judgements: the execution date over two lines is two places; the third tax number line is the joint subscribers') |
| 9 | 2 | 0 | 0 | 2 | 0 | 0 | sure |
| 10 | 23 | 7 | 0 | 14 | 1 | 1 | sure of the places; boxes measured on a 612 x 792 px picture (about 0.8 pt a pixel, so within 1 pixel = 0.8 pt); SSN and EIN taken as digit groups (3 + 2), not single cells |
| all | 44 | 7 | 0 | 31 | 5 | 1 | |

By owner: co-investor 3, firm 5, investor 28, investor-entity 5, investor-individual 3

## Doubtful (4)

- p08-executed-day (p8, blank, investor): one date printed over two lines (day on the first, month and year on the second): recorded as two places
- p08-executed-month-year (p8, blank, investor): one date printed over two lines (day on the first, month and year on the second): recorded as two places
- p08-joint-tax-id (p8, blank, co-investor): the caption names the purchaser and any joint subscribers: taken as the joint subscribers' tax numbers
- p10-w9-requester (p10, blank, firm): the requester is the issuer collecting the form: taken as the firm's place

## Places

### Page 1

Must NOT get a field: the grey header and footer rules and the page number; short black rules under headings and defined terms (underlined words).

### Page 2

Must NOT get a field: the grey header and footer rules and the page number; short black rules under headings and defined terms (underlined words).

### Page 3

Must NOT get a field: the grey header and footer rules and the page number; short black rules under headings and defined terms (underlined words).

### Page 4

Must NOT get a field: the grey header and footer rules and the page number; short black rules under headings and defined terms (underlined words).

### Page 5

Must NOT get a field: the grey header and footer rules and the page number; short black rules under headings and defined terms (underlined words).

### Page 6

Must NOT get a field: the grey header and footer rules and the page number; short black rules under headings and defined terms (underlined words).

### Page 7

Must NOT get a field: the grey header and footer rules and the page number; short black rules under headings and defined terms (underlined words).

### Page 8

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p08-executed-day | blank | date | investor | no | 420.2, 107.2, 455.3, 117.1 | underscore run of 7 | Date of execution: the day ("this ___ OF") |
| p08-executed-month-year | blank | date | investor | no | 54.0, 130.2, 258.7, 140.2 | 2 underscore runs (month, year) read as one date; parts give each run | Date of execution: month and year ("____, 20__") |
| p08-ind-signature | signature | signature | investor-individual | no | 73.9, 187.7, 254.0, 197.7 | underscore run of 36 | Purchaser (if an individual): signature (By:) |
| p08-ind-name | blank | name | investor-individual | no | 86.2, 210.7, 256.2, 220.7 | underscore run of 34 | Purchaser (if an individual): name |
| p08-joint-signature | signature | signature | co-investor | no | 71.4, 268.2, 256.7, 278.2 | underscore run of 37 | Joint title owner (if title will be joint): signature (By:) |
| p08-joint-name | blank | name | co-investor | no | 141.7, 291.3, 256.7, 301.2 | underscore run of 23 | Joint title owner: name (please print) |
| p08-ent-name | blank | name | investor-entity | no | 282.2, 187.7, 482.2, 197.7 | underscore run of 40 | Purchaser (if an entity): legal name of entity (caption under the line) |
| p08-ent-signature | signature | signature | investor-entity | no | 296.5, 233.7, 486.6, 243.6 | underscore run of 38 | Purchaser (if an entity): signature (By:) |
| p08-ent-signer | blank | name | investor-entity | no | 366.8, 256.7, 486.7, 266.7 | underscore run of 24 | Purchaser (if an entity): name of the signer (please print) |
| p08-ent-title | blank | title | investor-entity | no | 306.4, 279.8, 491.2, 289.7 | underscore run of 37 | Purchaser (if an entity): title of the signer |
| p08-ind-tax-id | blank | tax number | investor-individual | no | 57.1, 325.7, 271.9, 335.7 | underscore run of 43 | Social security or tax ID number of purchaser (individual column; caption under the line) |
| p08-ent-tax-id | blank | tax number | investor-entity | no | 282.2, 325.7, 497.0, 335.7 | underscore run of 43 | Social security or tax ID number of entity purchaser (caption under the line) |
| p08-joint-tax-id | blank | tax number | co-investor | no | 54.0, 360.2, 268.8, 370.1 | underscore run of 43 | Social security or tax ID number of purchaser and any joint subscribers (caption under the line) |
| p08-domicile | blank | text | investor | yes | 220.1, 406.2, 410.0, 416.2 | underscore run of 38 | State or country of domicile or formation |
| p08-amount | blank | amount | investor | yes | 206.8, 429.2, 411.6, 439.1 | underscore run of 41 | Aggregate subscription amount in US dollars |
| p08-firm-shares | blank | text | firm | no | 453.9, 452.2, 504.0, 462.2 | underscore run of 10 | Company acceptance: number of shares accepted |
| p08-firm-signature | signature | signature | firm | no | 299.0, 521.2, 444.1, 531.2 | underscore run of 29 | Company acceptance: signature (By:) |
| p08-firm-name | blank | name | firm | no | 311.2, 544.3, 446.2, 554.2 | underscore run of 27 | Company acceptance: name of the signer |
| p08-firm-title | blank | title | firm | no | 306.4, 567.2, 446.2, 577.1 | underscore run of 28 | Company acceptance: title of the signer |

Must NOT get a field: the grey header and footer rules and the page number; the captions printed under lines; the company name "BIO FIL INC".

### Page 9

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p09-shares | blank | text | investor | yes | 57.1, 184.7, 102.1, 194.7 | underscore run of 9 | Appendix A: number of shares of common stock to be acquired ($10 per share) |
| p09-price | blank | amount | investor | yes | 302.4, 184.7, 427.4, 194.7 | underscore run of 25 | Appendix A: aggregate purchase price to be paid (US$) |

Must NOT get a field: the grey header and footer rules and the page number; the two underlined column headings (rules under words).

### Page 10

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p10-w9-name | blank | name | investor | yes | 100.7, 159.6, 521.5, 179.1 | picture: drawn cell (its rules located on the picture's pixels; box = centre lines) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 1: name as shown on the income tax return (caption at the top of the cell) |
| p10-w9-business-name | blank | name | investor | no | 100.7, 179.1, 521.5, 197.8 | picture: drawn cell (its rules located on the picture's pixels; box = centre lines) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 2: business name / disregarded entity name, if different |
| p10-w9-class-1 | tickbox | tickbox | investor | no | 106.8, 218.4, 114.1, 225.4 | picture: printed square found on the picture's pixels (ink) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 3 federal tax classification: individual / sole proprietor or single-member LLC |
| p10-w9-class-2 | tickbox | tickbox | investor | no | 200.0, 216.9, 207.3, 223.9 | picture: printed square found on the picture's pixels (ink) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 3 federal tax classification: C corporation |
| p10-w9-class-3 | tickbox | tickbox | investor | no | 258.4, 216.9, 265.7, 223.9 | picture: printed square found on the picture's pixels (ink) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 3 federal tax classification: S corporation |
| p10-w9-class-4 | tickbox | tickbox | investor | no | 316.8, 216.9, 324.1, 223.9 | picture: printed square found on the picture's pixels (ink) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 3 federal tax classification: partnership |
| p10-w9-class-5 | tickbox | tickbox | investor | no | 375.2, 216.9, 382.5, 223.9 | picture: printed square found on the picture's pixels (ink) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 3 federal tax classification: trust / estate |
| p10-w9-class-6 | tickbox | tickbox | investor | no | 106.8, 237.1, 114.1, 244.1 | picture: printed square found on the picture's pixels (ink) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 3 federal tax classification: limited liability company |
| p10-w9-class-7 | tickbox | tickbox | investor | no | 106.8, 273.7, 114.1, 280.7 | picture: printed square found on the picture's pixels (ink) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 3 federal tax classification: other (see instructions) |
| p10-w9-llc-class | blank | text | investor | no | 388.1, 233.7, 416.5, 243.7 | picture: drawn line (pixels; box = line and 10 pt above) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 3: tax classification of the LLC (C, S or P), after an arrow |
| p10-w9-exempt-payee | blank | text | investor | no | 492.7, 224.4, 521.9, 234.4 | picture: drawn line (pixels; box = line and 10 pt above) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 box 4: exempt payee code (if any) |
| p10-w9-fatca | blank | text | investor | no | 462.7, 252.4, 521.9, 262.4 | picture: drawn line (pixels; box = line and 10 pt above) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 box 4: exemption from FATCA reporting code (if any) |
| p10-w9-address | blank | address | investor | yes | 100.7, 281.9, 369.1, 300.6 | picture: drawn cell (its rules located on the picture's pixels; box = centre lines) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 5: address (number, street, apt or suite) |
| p10-w9-requester | blank | address | firm | no | 369.1, 281.9, 521.5, 319.3 | picture: drawn cell (its rules located on the picture's pixels; box = centre lines) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9: requester's name and address (optional; the requester is the company) |
| p10-w9-city | blank | address | investor | yes | 100.7, 300.6, 369.1, 319.3 | picture: drawn cell (its rules located on the picture's pixels; box = centre lines) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 6: city, state and ZIP code |
| p10-w9-accounts | blank | text | investor | no | 100.7, 319.3, 521.5, 337.2 | picture: drawn cell (its rules located on the picture's pixels; box = centre lines) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 line 7: list account number(s) here (optional) |
| p10-w9-ssn-1 | blank | tax number | investor | no | 392.6, 356.7, 427.5, 375.4 | picture: a row of 3 drawn digit cells (pixels; box = outer rules) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 Part I: social security number, group 1 of 3 (3 digit cells) |
| p10-w9-ssn-2 | blank | tax number | investor | no | 439.6, 356.7, 463.1, 375.4 | picture: a row of 2 drawn digit cells (pixels; box = outer rules) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 Part I: social security number, group 2 of 3 (2 digit cells) |
| p10-w9-ssn-3 | blank | tax number | investor | no | 474.5, 356.7, 521.5, 375.4 | picture: a row of 4 drawn digit cells (pixels; box = outer rules) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 Part I: social security number, group 3 of 3 (4 digit cells) |
| p10-w9-ein-1 | blank | tax number | investor | no | 392.6, 394.1, 416.1, 412.8 | picture: a row of 2 drawn digit cells (pixels; box = outer rules) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 Part I: employer identification number, group 1 of 2 (2 digit cells) |
| p10-w9-ein-2 | blank | tax number | investor | no | 427.5, 394.1, 509.4, 412.8 | picture: a row of 7 drawn digit cells (pixels; box = outer rules) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 Part I: employer identification number, group 2 of 2 (7 digit cells) |
| p10-w9-signature | signature | signature | investor | yes | 154.6, 515.7, 367.1, 534.4 | picture: the room between the caption arrow and "Date" in the drawn signature row (pixels) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 Part II: signature of U.S. person ("Sign Here") |
| p10-w9-date | date | date | investor | yes | 387.3, 515.7, 521.5, 534.4 | picture: the room after "Date" in the drawn signature row (pixels) [picture 612x792 px drawn at x 54.06-550.32, y 94.52-711.66 pt (0.8109 x 0.7792 pt per pixel)] | W-9 Part II: date beside the signature |

Must NOT get a field: the grey header and footer rules and the page number; the W-9 header boxes (form number, title, "Give form to the requester"); the heavy section bars "Part I" and "Part II"; the dashes between the digit groups; the general instructions under the signature row (text); the side caption "Print or type".
