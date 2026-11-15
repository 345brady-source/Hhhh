# Answer sheet: a025 (13 pages)

PDF points, origin top-left, y grows downward. Cell: the centre lines of its four rules (or the room right of a caption inside it).

pdfplumber words and thin filled rectangles (table borders); cell boxes are the centre lines of the rules; every page looked at at 100 dpi, the signature table again at 200 dpi; the HTML source read for the table structure; overlays looked at.

## For signing

The purchaser completes the signature page (page 11): details for everyone, then either the individual block (joint purchasers share its boxes) or the entity block, whose date box runs onto page 12; the company accepts on page 13.

- Investor signs on page(s): [11, 12]
- Firm signs on page(s): [13]
- Co-investor places: no
- Third parties: none

## Doubts and judgements

- Individual and entity blocks are separate on page 11: owners investor-individual and investor-entity.
- Joint purchasers have no separate place: "Print Name(s)" and "Signature(s) of Purchaser(s)" are shared boxes, so co_investor is false.
- Cells holding a caption get the room right of the caption.
- The entity "By" cell prints "Name:" and "Title:"; it is split into name, title and signature rooms (judgement).
- The cell beside "Purchasers:" is read as a place (doubt); the other empty table-1 cells are not.

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
| 9 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 10 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 11 | 15 | 0 | 0 | 12 | 2 | 1 | sure of the boxes; judgements: the cell beside "Purchasers:" is a place, the empty table-1 cells under "Purchase Price:" are not, and the split of the entity "By" cell |
| 12 | 1 | 0 | 0 | 0 | 0 | 1 | sure |
| 13 | 3 | 0 | 0 | 1 | 1 | 1 | sure |
| all | 19 | 0 | 0 | 13 | 3 | 3 | |

By owner: firm 3, investor 8, investor-entity 5, investor-individual 3

## Places

### Page 1

Must NOT get a field: "$[Ÿ]" and "[Ÿ]" (price per share, offering circular date, gross proceeds): bracketed placeholders the company completes, printed with a Wingdings bullet; underlined section headings; browser header and footer on every page

### Page 5

Must NOT get a field: the questionnaire representations on pages 5-9 are prose: no box, no blank, no initials place is printed

### Page 11

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p11-purchasers | blank | name | investor | no | 396.4, 192.4, 757.9, 206.6 | drawn cell (centre lines of its four rules, 0.75 pt) | Purchasers: the empty cell right of the caption ("Purchasers:") | "Purchasers:" may be only a heading for the table; the cell beside it is empty and bordered, so it is read as the place for the purchaser name(s) |
| p11-name | blank | name | investor | yes | 68.5, 220.9, 396.4, 233.6 | drawn cell holding its caption; box = the room right of the caption to the cell's right rule (centre lines) | Purchaser name ("Name:") |  |
| p11-shares | blank | amount | investor | yes | 461.2, 220.9, 757.9, 233.6 | drawn cell holding its caption; box = the room right of the caption to the cell's right rule (centre lines) | Number of shares ("No. of Shares:") |  |
| p11-address | blank | address | investor | yes | 77.4, 233.6, 396.4, 246.4 | drawn cell holding its caption; box = the room right of the caption to the cell's right rule (centre lines) | Address, first line ("Address:") |  |
| p11-price | blank | amount | investor | yes | 465.7, 233.6, 757.9, 246.4 | drawn cell holding its caption; box = the room right of the caption to the cell's right rule (centre lines) | Purchase price ("Purchase Price:") |  |
| p11-address-2 | blank | address | investor | no | 34.1, 246.4, 396.4, 260.6 | drawn cell (centre lines of its four rules, 0.75 pt) | Address, second line (empty cell under "Address:") |  |
| p11-address-3 | blank | address | investor | no | 34.1, 260.6, 396.4, 274.9 | drawn cell (centre lines of its four rules, 0.75 pt) | Address, third line (empty cell) |  |
| p11-email | blank | email | investor | yes | 68.5, 274.9, 396.4, 289.1 | drawn cell holding its caption; box = the room right of the caption to the cell's right rule (centre lines) | E-mail address ("Email:") |  |
| p11-ind-names | blank | name | investor-individual | yes | 396.4, 325.9, 757.9, 364.1 | drawn cell (centre lines of its four rules, 0.75 pt) | Individual purchaser(s): printed name(s) (joint purchasers share this box) ("Print Name(s)") |  |
| p11-ind-signature | signature | signature | investor-individual | yes | 396.4, 379.9, 757.9, 418.1 | drawn cell (centre lines of its four rules, 0.75 pt) | Individual purchaser(s): signature(s) (joint purchasers share this box) ("Signature(s) of Purchaser(s)") |  |
| p11-ind-date | date | date | investor-individual | yes | 396.4, 433.9, 757.9, 460.1 | drawn cell (centre lines of its four rules, 0.75 pt) | Individual purchaser(s): date ("Date") |  |
| p11-ent-name | blank | name | investor-entity | yes | 396.4, 484.9, 757.9, 511.1 | drawn cell (centre lines of its four rules, 0.75 pt) | Entity purchaser: name of the entity ("Name of Entity") |  |
| p11-ent-signer-name | blank | name | investor-entity | yes | 427.4, 526.9, 577.0, 540.2 | one drawn cell (396.4, 526.9, 757.9, 553.1) printing "Name:" and "Title:" on two lines beside the caption "By"; split here into name, title and signature rooms | Entity purchaser: name of the person signing (after "Name:") ("Name:") | inside the "By" cell; the split of the cell between name, title and signature is a judgement |
| p11-ent-signature | signature | signature | investor-entity | yes | 577.0, 526.9, 757.9, 553.1 | one drawn cell (396.4, 526.9, 757.9, 553.1) printing "Name:" and "Title:" on two lines beside the caption "By"; split here into name, title and signature rooms | Entity purchaser: signature (caption "By" left of the cell) ("By") | the "By" cell also holds Name: and Title:; the signature room is read as the empty right part of the cell |
| p11-ent-signer-title | blank | title | investor-entity | yes | 422.3, 540.2, 577.0, 553.1 | one drawn cell (396.4, 526.9, 757.9, 553.1) printing "Name:" and "Title:" on two lines beside the caption "By"; split here into name, title and signature rooms | Entity purchaser: title of the person signing (after "Title:") ("Title:") | inside the "By" cell; see p11-ent-signer-name |

Must NOT get a field: the caption cells of the left column ("Print Name(s)", "Signature(s) of Purchaser(s)", "Date", "Name of Entity", "By"): open on the right, no room of their own; the narrow spacer rows between the boxes of the right column (open on the left); table 1: the empty second row (spacer under "Purchasers:") and the empty right cells under "Purchase Price:" and beside "Email:" (no caption, no purpose)

### Page 12

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p12-ent-date | date | date | investor-entity | yes | 396.4, 36.4, 757.9, 62.6 | drawn cell (centre lines of its four rules, 0.75 pt) | Entity purchaser: date (the entity table continues from page 11) ("Date") |  |

Must NOT get a field: the left caption cell "Date"; the footer rule (y 93)

### Page 13

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p13-accept-name | blank | name | firm | yes | 396.4, 120.4, 757.9, 158.6 | drawn cell (centre lines of its four rules, 0.75 pt) | Company acceptance: name of the authorized officer ("Name of Authorized Officer") |  |
| p13-accept-signature | signature | signature | firm | yes | 396.4, 174.4, 757.9, 212.6 | drawn cell (centre lines of its four rules, 0.75 pt) | Company acceptance: signature of the authorized officer ("Signature of Authorized Officer") |  |
| p13-accept-date | date | date | firm | yes | 396.4, 228.4, 757.9, 266.6 | drawn cell (centre lines of its four rules, 0.75 pt) | Company acceptance: date ("Date") |  |

Must NOT get a field: the left caption cells; the footer rule (y 297)

