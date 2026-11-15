# Answer sheet: a078 (6 pages)

PDF points, origin top-left, y grows downward. Rule in the picture: its x extent, y1 = bottom of the rule, y0 = y1 - 10.

Each page is one scanned picture (623 px wide, 96 ppi) with no text layer. The drawing matrix flips the stored picture vertically (page 1: 467.04 0 0 -482.88 72 696.96 cm; pages 2-4: 467.52 0 0 -604.8 72 720; pages 5-6: 467.28 0 0 -604.32 72 720), so the picture was flipped back and mapped as x = 72 + col * w/623, y = top + row * h/H (page 1 top 95.04, h 482.88, H 644; page 5 top 72, h 604.32, H 806). Rules found in the pixels (rows darker than 200, 12 px or longer); every page looked at at 100 and 130 dpi; overlays looked at.

## For signing

Scanned subscription form: the purchaser completes and signs page 1 (individual or authorized signatory line), the company accepts at its foot; the purchaser also signs the risk acknowledgement form on page 5.

- Investor signs on page(s): [1, 5]
- Firm signs on page(s): [1]
- Co-investor places: no
- Third parties: none

## Doubts and judgements

- No text layer: every box measured from the pictures' pixels; the stored pictures are upside down and the page matrix flips them, which the mapping accounts for.
- Individual and entity signature lines are separate on page 1 (investor-individual / investor-entity).

## Counts

| page | places | tick boxes | initials | blanks | signatures | dates | how sure |
|---|---|---|---|---|---|---|---|
| 1 | 25 | 0 | 0 | 22 | 3 | 0 | sure (the two caption-less rules are read as second lines of the address above them) |
| 2 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 3 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 4 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 5 | 4 | 0 | 0 | 2 | 1 | 1 | sure |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| all | 29 | 0 | 0 | 24 | 4 | 1 | |

By owner: firm 4, investor 22, investor-entity 2, investor-individual 1

## Places

### Page 1

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p01-shares | blank | amount | investor | yes | 130.5, 168.3, 191.2, 178.3 | rule in the picture (px x 78-159, y 109-110 of the upright picture); box = its x extent and the 10 pt above its bottom | Number of shares subscribed for (blank at the start of the boxed sentence) |  |
| p01-total | blank | amount | investor | yes | 271.4, 183.3, 319.4, 193.3 | rule in the picture (px x 266-330, y 129-130 of the upright picture); box = its x extent and the 10 pt above its bottom | Total subscription price in US$ ("total subscription price of US$") |  |
| p01-reg-1 | blank | name | investor | yes | 126.7, 253.7, 291.7, 263.7 | rule in the picture (px x 73-293, y 224-224 of the upright picture); box = its x extent and the 10 pt above its bottom | Registration: name to appear on certificate (caption under the rule) ("Name to appear on certificate") |  |
| p01-del-1 | blank | name | investor | no | 308.9, 253.7, 474.6, 263.7 | rule in the picture (px x 316-537, y 224-224 of the upright picture); box = its x extent and the 10 pt above its bottom | Delivery: name and account reference, if applicable (caption under the rule) ("Name and account reference, if applicable") |  |
| p01-reg-2 | blank | text | investor | no | 126.7, 280.0, 291.7, 290.0 | rule in the picture (px x 73-293, y 259-259 of the upright picture); box = its x extent and the 10 pt above its bottom | Registration: account reference, if applicable (caption under the rule) ("Account reference, if applicable") |  |
| p01-del-2 | blank | name | investor | no | 308.9, 280.0, 474.6, 290.0 | rule in the picture (px x 316-537, y 259-259 of the upright picture); box = its x extent and the 10 pt above its bottom | Delivery: contact name (caption under the rule) ("Contact name") |  |
| p01-reg-3 | blank | address | investor | yes | 126.7, 306.2, 291.7, 316.2 | rule in the picture (px x 73-293, y 294-294 of the upright picture); box = its x extent and the 10 pt above its bottom | Registration: address (caption under the rule) ("Address") |  |
| p01-del-3 | blank | address | investor | no | 308.9, 306.2, 474.6, 316.2 | rule in the picture (px x 316-537, y 294-294 of the upright picture); box = its x extent and the 10 pt above its bottom | Delivery: address (caption under the rule) ("Address") |  |
| p01-reg-4 | blank | address | investor | no | 126.7, 332.5, 291.7, 342.5 | rule in the picture (px x 73-293, y 329-329 of the upright picture); box = its x extent and the 10 pt above its bottom | Registration: address, second line (no caption) (caption under the rule) |  |
| p01-del-4 | blank | phone | investor | no | 308.9, 332.5, 474.6, 342.5 | rule in the picture (px x 316-537, y 329-329 of the upright picture); box = its x extent and the 10 pt above its bottom | Delivery: telephone number (caption under the rule) ("Telephone number") |  |
| p01-exec-day | blank | date | investor | yes | 249.7, 355.0, 264.7, 365.0 | rule in the picture (px x 237-257, y 359-359 of the upright picture); box = its x extent and the 10 pt above its bottom | Executed by the purchaser: day ("EXECUTED by the Purchaser this ___ day") |  |
| p01-exec-month | blank | date | investor | yes | 290.9, 355.0, 347.9, 365.0 | rule in the picture (px x 292-368, y 359-359 of the upright picture); box = its x extent and the 10 pt above its bottom | Executed by the purchaser: month ("day of") |  |
| p01-exec-year | blank | date | investor | yes | 363.6, 355.0, 374.1, 365.0 | rule in the picture (px x 389-403, y 359-359 of the upright picture); box = its x extent and the 10 pt above its bottom | Executed by the purchaser: last digits of the year (after "200") ("200__") |  |
| p01-ind-signature | signature | signature | investor-individual | yes | 133.5, 377.5, 291.7, 387.5 | rule in the picture (px x 82-293, y 389-389 of the upright picture); box = its x extent and the 10 pt above its bottom | Signature of individual, if the purchaser is a natural person (a printed "X" starts the line) ("Signature of individual (if Purchaser is a natural person)") |  |
| p01-address | blank | address | investor | yes | 308.9, 378.2, 474.6, 388.2 | rule in the picture (px x 316-537, y 389-390 of the upright picture); box = its x extent and the 10 pt above its bottom | Address of purchaser (residence if a natural person) ("Address of Purchaser (residence if a natural person)") |  |
| p01-ent-signature | signature | signature | investor-entity | yes | 133.5, 412.7, 291.7, 422.7 | rule in the picture (px x 82-293, y 435-436 of the upright picture); box = its x extent and the 10 pt above its bottom | Authorized signatory, if the purchaser is not a natural person (a printed "X" starts the line) ("Authorized signatory (if Purchaser is not a natural person)") |  |
| p01-address-2 | blank | address | investor | no | 308.9, 412.7, 474.6, 422.7 | rule in the picture (px x 316-537, y 435-436 of the upright picture); box = its x extent and the 10 pt above its bottom | Address of purchaser, second line (no caption) |  |
| p01-name | blank | name | investor | yes | 126.7, 447.9, 291.7, 457.9 | rule in the picture (px x 73-293, y 482-483 of the upright picture); box = its x extent and the 10 pt above its bottom | Name of purchaser, printed ("Name of Purchaser (please print)") |  |
| p01-phone | blank | phone | investor | yes | 308.9, 447.9, 474.6, 457.9 | rule in the picture (px x 316-537, y 482-483 of the upright picture); box = its x extent and the 10 pt above its bottom | Telephone number of purchaser ("Telephone Number of Purchaser") |  |
| p01-ent-signer-name | blank | name | investor-entity | no | 126.7, 474.2, 291.7, 484.2 | rule in the picture (px x 73-293, y 517-518 of the upright picture); box = its x extent and the 10 pt above its bottom | Name of authorized signatory, printed ("Name of authorized signatory (please print)") |  |
| p01-email | blank | email | investor | no | 308.9, 474.2, 474.6, 484.2 | rule in the picture (px x 316-537, y 517-518 of the upright picture); box = its x extent and the 10 pt above its bottom | E-mail address of purchaser ("E-mail Address of Purchaser") |  |
| p01-accept-day | blank | date | firm | yes | 184.4, 502.7, 212.2, 512.7 | rule in the picture (px x 150-187, y 556-556 of the upright picture); box = its x extent and the 10 pt above its bottom | Accepted: day ("ACCEPTED this ______ day") |  |
| p01-accept-month | blank | date | firm | yes | 236.2, 502.7, 265.4, 512.7 | rule in the picture (px x 219-258, y 556-556 of the upright picture); box = its x extent and the 10 pt above its bottom | Accepted: month ("day of") |  |
| p01-accept-year | blank | date | firm | yes | 281.2, 502.7, 291.7, 512.7 | rule in the picture (px x 279-293, y 556-556 of the upright picture); box = its x extent and the 10 pt above its bottom | Accepted: last digits of the year (after "200") ("200__") |  |
| p01-accept-signature | signature | signature | firm | yes | 126.7, 546.9, 291.7, 556.9 | rule in the picture (px x 73-293, y 614-615 of the upright picture); box = its x extent and the 10 pt above its bottom | Company: authorized signatory (caption under the rule) ("Per: / Authorized signatory") |  |

Must NOT get a field: the frames: the thick box around the share sentence (y about 154 and 200), the box of the registration/delivery instructions and the box of the signature block (their edges at y about 228, 352, 370, 493); "EXHIBIT 99.1" (a real text line above the picture)

### Page 4

Must NOT get a field: "Offering Memorandum of the Issuer dated ●" on page 2 and similar bullet placeholders: the issuer's, completed before sending

### Page 5

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p05-amount | blank | amount | investor | yes | 216.0, 268.9, 272.3, 278.9 | rule in the picture (px x 192-267, y 274-275 of the upright picture); box = its x extent and the 10 pt above its bottom | Risk acknowledgement: amount the purchaser is investing (after "$") ("I am investing $") |  |
| p05-date | date | date | investor | yes | 153.0, 336.4, 236.3, 346.4 | rule in the picture (px x 108-219, y 364-365 of the upright picture); box = its x extent and the 10 pt above its bottom | Risk acknowledgement: date (caption under the rule, left of the signature) ("Date") |  |
| p05-signature | signature | signature | investor | yes | 318.0, 336.4, 429.0, 346.4 | rule in the picture (px x 328-476, y 364-365 of the upright picture); box = its x extent and the 10 pt above its bottom | Risk acknowledgement: signature of purchaser ("Signature of Purchaser") |  |
| p05-name | blank | name | investor | yes | 318.0, 365.7, 429.0, 375.7 | rule in the picture (px x 328-476, y 403-404 of the upright picture); box = its x extent and the 10 pt above its bottom | Risk acknowledgement: printed name of purchaser ("Print Name of Purchaser") |  |

Must NOT get a field: the frame of the form (top y about 147, bottom y about 421) and the rotated word "WARNING" beside it (its letters show as short strokes); the underlined e-mail address of the issuer in the cancellation notice (a link, printed)

