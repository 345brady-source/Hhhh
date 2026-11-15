# Answer sheet: a084 (11 pages)

PDF points, origin top-left, y grows downward. Underscore run: the character box. Drawn rule: x extent, y1 = bottom of the rule, y0 = y1 - 10.

pdfplumber characters and thin filled rectangles; the HTML source read where a rule's purpose was unclear; every page looked at at 100 dpi; overlays looked at.

## For signing

The subscriber signs the agreement (page 7) with its details running onto page 8, the company accepts on page 9, and the subscriber initials the accredited categories and signs the questionnaire (pages 10-11) in an entity block or an individual block.

- Investor signs on page(s): [7, 11]
- Firm signs on page(s): [9]
- Co-investor places: no
- Third parties: none

## Doubts and judgements

- Questionnaire signature blocks are separate for an entity and an individual (page 11): owners investor-entity / investor-individual.
- The country line on page 8 is already filled in ("United States of America"): not a place.
- Price per share on page 1 kept as the subscriber's place (doubt).

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 0 | 0 | 3 | 0 | 0 | sure (one judgement: the price-per-share blank is kept as the subscriber's) |
| 2 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 3 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 4 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 5 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 7 | 6 | 0 | 0 | 5 | 1 | 0 | sure |
| 8 | 3 | 0 | 0 | 3 | 0 | 0 | sure |
| 9 | 4 | 0 | 0 | 3 | 1 | 0 | sure |
| 10 | 4 | 0 | 4 | 0 | 0 | 0 | sure |
| 11 | 12 | 0 | 4 | 6 | 2 | 0 | sure |
| all | 32 | 0 | 8 | 20 | 4 | 0 | |

By owner: firm 4, investor 22, investor-entity 3, investor-individual 3

## Places

### Page 1

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p01-shares | blank | amount | investor | yes | 488.9, 266.7, 568.9, 276.7 | underscore run of 16 | Number of common shares subscribed for |  |
| p01-price-per-share | blank | amount | investor | no | 166.8, 278.7, 186.8, 288.7 | underscore run of 4 | Price per share in US$ (4 underscores after "US$") ("at a price of US$") | a form: the company may set the price before sending; kept as a place since nothing marks it as the company's |
| p01-total | blank | amount | investor | yes | 679.1, 278.7, 739.1, 288.7 | underscore run of 12 | Total purchase price in US$ ("total purchase price of US$") |  |

Must NOT get a field: the double rule under the browser header line (y 60) and the page-end frames on every page (white box with a black outline, about y 520-570); underlined headings

### Page 7

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p07-delivery-1 | blank | address | investor | no | 69.7, 332.7, 758.2, 342.7 | drawn rule at y=342.7 (thin filled rectangle 0; box = the 10 pt of writing room above it) | Delivery of share certificates to: first line ("Delivery - please deliver the Share certificates to:") |  |
| p07-delivery-2 | blank | address | investor | no | 69.7, 357.5, 758.2, 367.5 | drawn rule at y=367.5 (thin filled rectangle 1; box = the 10 pt of writing room above it) | Delivery of share certificates to: second line |  |
| p07-reg-name | blank | name | investor | yes | 69.7, 394.2, 758.2, 404.2 | drawn rule at y=404.2 (thin filled rectangle 2; box = the 10 pt of writing room above it) | Registration of certificates: name (caption under the rule) ("(name)") |  |
| p07-reg-address | blank | address | investor | yes | 69.7, 419.0, 758.2, 429.0 | drawn rule at y=429.0 (thin filled rectangle 3; box = the 10 pt of writing room above it) | Registration of certificates: address (caption under the rule) ("(address)") |  |
| p07-name | blank | name | investor | yes | 396.0, 491.7, 758.2, 501.7 | drawn rule at y=501.7 (thin filled rectangle 4; box = the 10 pt of writing room above it) | Name of subscriber, typed or printed (caption under the rule) ("(Name of Subscriber - Please type or print)") |  |
| p07-signature | signature | signature | investor | yes | 396.0, 528.5, 758.2, 538.5 | drawn rule at y=538.5 (thin filled rectangle 5; box = the 10 pt of writing room above it) | Subscriber signature and, if applicable, office ("(Signature and, if applicable, Office)") |  |

Must NOT get a field: the underline of the heading "DELIVERY AND REGISTRATION INSTRUCTIONS" (y 294); underlined section headings 15-17

### Page 8

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p08-address | blank | address | investor | yes | 396.0, 60.5, 758.2, 70.5 | drawn rule at y=70.5 (thin filled rectangle 0; box = the 10 pt of writing room above it) | Address of subscriber ("(Address of Subscriber)") |  |
| p08-city | blank | address | investor | yes | 396.0, 97.2, 758.2, 107.2 | drawn rule at y=107.2 (thin filled rectangle 1; box = the 10 pt of writing room above it) | City, state and zip code of subscriber ("(City, State, and Zip Code of Subscriber)") |  |
| p08-fax | blank | phone | investor | no | 396.0, 170.7, 758.2, 180.7 | drawn rule at y=180.7 (thin filled rectangle 3; box = the 10 pt of writing room above it) | Fax number ("(Fax Number)") |  |

Must NOT get a field: the country rule (y 143): already filled in with "United States of America"

### Page 9

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p09-accept-place | blank | text | firm | yes | 78.7, 103.2, 228.7, 113.2 | underscore run of 30 | Acceptance: place where dated ("DATED at") |  |
| p09-accept-day | blank | date | firm | yes | 248.4, 103.2, 273.4, 113.2 | underscore run of 5 | Acceptance: day ("the _____ day") |  |
| p09-accept-month | blank | date | firm | yes | 303.6, 103.2, 368.6, 113.2 | underscore run of 13 | Acceptance: month (year 2006 printed) ("day of") |  |
| p09-accept-signature | signature | signature | firm | yes | 62.3, 169.2, 247.3, 179.2 | underscore run of 37 | Company: authorized signatory ("Per: / Authorized Signatory") |  |

### Page 10

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p10-cat-1 | initials | initials | investor | no | 33.7, 265.2, 53.7, 275.2 | underscore run of 4 | Accredited investor category 1: initial if it applies ("Category 1") |  |
| p10-cat-2 | initials | initials | investor | no | 33.7, 301.2, 53.7, 311.2 | underscore run of 4 | Accredited investor category 2: initial if it applies ("Category 2") |  |
| p10-cat-3 | initials | initials | investor | no | 33.7, 325.2, 53.7, 335.2 | underscore run of 4 | Accredited investor category 3: initial if it applies ("Category 3") |  |
| p10-cat-4 | initials | initials | investor | no | 33.7, 361.2, 53.7, 371.2 | underscore run of 4 | Accredited investor category 4: initial if it applies ("Category 4") |  |

Must NOT get a field: the heading underline (y 68)

### Page 11

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p11-cat-5 | initials | initials | investor | no | 33.7, 94.9, 53.7, 104.9 | underscore run of 4 | Accredited investor category 5: initial if it applies ("Category 5") |  |
| p11-cat-6 | initials | initials | investor | no | 33.7, 118.9, 53.7, 128.9 | underscore run of 4 | Accredited investor category 6: initial if it applies ("Category 6") |  |
| p11-cat-7 | initials | initials | investor | no | 33.7, 142.9, 53.7, 152.9 | underscore run of 4 | Accredited investor category 7: initial if it applies ("Category 7") |  |
| p11-cat-8 | initials | initials | investor | no | 33.7, 178.9, 53.7, 188.9 | underscore run of 4 | Accredited investor category 8: initial if it applies ("Category 8") |  |
| p11-q-day | blank | date | investor | yes | 376.5, 325.9, 391.5, 335.9 | underscore run of 3 | Questionnaire executed: day ("as of the ___ day") |  |
| p11-q-month | blank | date | investor | yes | 421.8, 325.9, 496.8, 335.9 | underscore run of 15 | Questionnaire executed: month (year 2006 printed) ("day of") |  |
| p11-ent-name | blank | name | investor-entity | yes | 33.7, 385.2, 352.5, 395.2 | drawn rule at y=395.2 (thin filled rectangle 4; box = the 10 pt of writing room above it) | Entity: name of entity, typed or printed ("Print of Type Name of Entity") |  |
| p11-ind-signature | signature | signature | investor-individual | yes | 453.7, 385.2, 758.2, 395.2 | drawn rule at y=395.2 (thin filled rectangle 5; box = the 10 pt of writing room above it) | Individual: signature ("Signature") |  |
| p11-ent-signature | signature | signature | investor-entity | yes | 33.7, 422.0, 352.5, 432.0 | drawn rule at y=432.0 (thin filled rectangle 6; box = the 10 pt of writing room above it) | Entity: signature of authorized signatory ("Signature of Authorized Signatory") |  |
| p11-ind-name | blank | name | investor-individual | yes | 453.7, 422.0, 758.2, 432.0 | drawn rule at y=432.0 (thin filled rectangle 7; box = the 10 pt of writing room above it) | Individual: name, printed or typed ("Print or Type Name") |  |
| p11-ent-type | blank | text | investor-entity | yes | 33.7, 458.7, 352.5, 468.7 | drawn rule at y=468.7 (thin filled rectangle 8; box = the 10 pt of writing room above it) | Entity: type of entity ("Type of Entity") |  |
| p11-ind-tin | blank | tax number | investor-individual | yes | 453.7, 458.7, 758.2, 468.7 | drawn rule at y=468.7 (thin filled rectangle 9; box = the 10 pt of writing room above it) | Individual: social security / tax ID number ("Social Security/Tax I.D. No.") |  |

Must NOT get a field: the full-width rule under the request for equity owners' details (y 268): an <hr> separator in the source, no room to write (the details go on a separate sheet)

