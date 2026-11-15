# Answer sheet: a009 (15 pages)

PDF points, origin top-left, y grows downward (page 612.2 x 792.5). Rule in the picture: its x extent, y1 = bottom of the rule, y0 = y1 - 10.

Each page is one scanned picture (1284 x 1662 px, 151 ppi) drawn over the whole page (0,0)-(612.2,792.5); an OCR text layer lies over it. Rules were found in the picture's own pixels (rows of dark pixels, 40 px or longer) and converted to points through the drawing matrix (x * 612.238/1284, y * 792.477/1662); caption words checked against both the pixels and the OCR words; every page looked at; overlays looked at.

## For signing

Scanned signature pages: the subscriber gives the amounts on page 11 and signs on page 12; a framed joint-subscriber column beside it ("both Subscribers must sign"); the company accepts at the foot of page 12.

- Investor signs on page(s): [12]
- Firm signs on page(s): [12]
- Co-investor places: yes
- Third parties: none

## Doubts and judgements

- Scanned pictures with an OCR text layer: every box comes from the picture's pixels, not from the OCR words.
- The rule beside (c)(ii) on page 11 has no caption; kept as the place to mark (ii).
- The company's "Name:" and "Title:" under "By:" have no printed line; kept as places beside the captions (doubt).

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
| 11 | 5 | 0 | 0 | 5 | 0 | 0 | sure of the places; the rule beside (c)(ii) has no caption (doubt on what is written there) |
| 12 | 20 | 0 | 0 | 15 | 3 | 2 | sure of the 16 subscriber rules and the acceptance date and signature; the company's name and title have no printed line (doubt) |
| 13 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 14 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| 15 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place) |
| all | 25 | 0 | 0 | 20 | 3 | 2 | |

By owner: co-investor 8, firm 4, investor 13

## Places

### Page 3

Must NOT get a field: underlined headings found as short strokes on pages 3-9 (e.g. "1. Subscription.", "(d) No filings."): underlined words, not blanks; "[DATE]" in (d) on page 3: bracketed text the company completes

### Page 11

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p11-shares | blank | amount | investor | yes | 460.6, 233.2, 532.1, 243.2 | rule in the picture (px x 966-1116, y 509-509); box = the rule's x extent and the 10 pt above its bottom | (a) Number of common shares subscribed for (caption "(print number of Securities)" under it) ("print number of Securities") |  |
| p11-price | blank | amount | investor | yes | 460.6, 321.9, 532.1, 331.9 | rule in the picture (px x 966-1116, y 695-695); box = the rule's x extent and the 10 pt above its bottom | (b) Aggregate purchase price (a "$" prints one line above the rule) ("print aggregate purchase price") |  |
| p11-accredited-para | blank | text | investor | no | 460.6, 410.1, 532.1, 420.1 | rule in the picture (px x 966-1116, y 880-880); box = the rule's x extent and the 10 pt above its bottom | (c)(i) Accredited investor: the applicable paragraph number(s) from Appendix A ("print applicable number from Appendix A") |  |
| p11-not-over-10pct | blank | text | investor | no | 460.6, 486.4, 532.6, 496.4 | rule in the picture (px x 966-1117, y 1040-1040); box = the rule's x extent and the 10 pt above its bottom | (c)(ii) Mark that the purchase is within 10% of net worth or income (a rule beside the statement, no caption) | no caption says what goes on this rule; read as the place to mark (or initial) that (ii) applies |
| p11-owner-name | blank | name | investor | yes | 72.0, 550.7, 276.1, 560.7 | rule in the picture (px x 151-579, y 1175-1175); box = the rule's x extent and the 10 pt above its bottom | (d) Name of the owner or joint owners for the company's books (caption under the rule) ("print name of owner or joint owners") |  |

Must NOT get a field: the thick bar under the page number (y 105-109, the scan's page rule)

### Page 12

| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |
|---|---|---|---|---|---|---|---|---|
| p12-signature | signature | signature | investor | yes | 72.0, 166.4, 306.6, 176.4 | rule in the picture (px x 151-643, y 368-369); box = the rule's x extent and the 10 pt above its bottom | Subscriber: Signature (caption under the rule) ("Signature") |  |
| p12-joint-signature | signature | signature | co-investor | no | 324.7, 166.4, 531.7, 176.4 | rule in the picture (px x 681-1115, y 368-369); box = the rule's x extent and the 10 pt above its bottom | Joint subscriber: Signature (inside the joint box) ("Signature") |  |
| p12-name | blank | name | investor | yes | 72.0, 192.6, 306.6, 202.6 | rule in the picture (px x 151-643, y 423-424); box = the rule's x extent and the 10 pt above its bottom | Subscriber: Name (Please Print) (caption under the rule) ("Name (Please Print)") |  |
| p12-joint-name | blank | name | co-investor | no | 324.7, 192.6, 531.2, 202.6 | rule in the picture (px x 681-1114, y 423-424); box = the rule's x extent and the 10 pt above its bottom | Joint subscriber: Name (Please Print) (inside the joint box) ("Name (Please Print)") |  |
| p12-email | blank | email | investor | yes | 72.0, 218.4, 306.6, 228.4 | rule in the picture (px x 151-643, y 477-478); box = the rule's x extent and the 10 pt above its bottom | Subscriber: Email address (caption under the rule) ("Email address") |  |
| p12-joint-email | blank | email | co-investor | no | 324.7, 218.4, 531.2, 228.4 | rule in the picture (px x 681-1114, y 477-478); box = the rule's x extent and the 10 pt above its bottom | Joint subscriber: Email address (inside the joint box) ("Email address") |  |
| p12-address | blank | address | investor | yes | 72.0, 244.6, 306.6, 254.6 | rule in the picture (px x 151-643, y 532-533); box = the rule's x extent and the 10 pt above its bottom | Subscriber: Address (caption under the rule) ("Address") |  |
| p12-joint-address | blank | address | co-investor | no | 324.7, 244.6, 531.2, 254.6 | rule in the picture (px x 681-1114, y 532-533); box = the rule's x extent and the 10 pt above its bottom | Joint subscriber: Address (inside the joint box) ("Address") |  |
| p12-address-2 | blank | address | investor | no | 72.0, 270.4, 306.6, 280.4 | rule in the picture (px x 151-643, y 586-587); box = the rule's x extent and the 10 pt above its bottom | Subscriber: second address line (no caption) (caption under the rule) |  |
| p12-joint-address-2 | blank | address | co-investor | no | 324.7, 270.4, 531.2, 280.4 | rule in the picture (px x 681-1114, y 586-587); box = the rule's x extent and the 10 pt above its bottom | Joint subscriber: second address line (no caption) (inside the joint box) |  |
| p12-phone | blank | phone | investor | yes | 72.0, 284.2, 306.6, 294.2 | rule in the picture (px x 151-643, y 615-616); box = the rule's x extent and the 10 pt above its bottom | Subscriber: Telephone Number (caption under the rule) ("Telephone Number") |  |
| p12-joint-phone | blank | phone | co-investor | no | 324.7, 284.2, 531.2, 294.2 | rule in the picture (px x 681-1114, y 615-616); box = the rule's x extent and the 10 pt above its bottom | Joint subscriber: Telephone Number (inside the joint box) ("Telephone Number") |  |
| p12-tin | blank | tax number | investor | yes | 72.0, 310.4, 306.6, 320.4 | rule in the picture (px x 151-643, y 670-671); box = the rule's x extent and the 10 pt above its bottom | Subscriber: Social Security Number/EIN (caption under the rule) ("Social Security Number/EIN") |  |
| p12-joint-tin | blank | tax number | co-investor | no | 324.7, 310.4, 531.2, 320.4 | rule in the picture (px x 681-1114, y 670-671); box = the rule's x extent and the 10 pt above its bottom | Joint subscriber: Social Security Number/EIN (printed "Social Security Number") (inside the joint box) ("Social Security Number") |  |
| p12-date | date | date | investor | yes | 72.0, 336.2, 306.6, 346.2 | rule in the picture (px x 151-643, y 724-725); box = the rule's x extent and the 10 pt above its bottom | Subscriber: Date (caption under the rule) ("Date") |  |
| p12-joint-date | date | date | co-investor | no | 324.7, 336.2, 531.2, 346.2 | rule in the picture (px x 681-1114, y 724-725); box = the rule's x extent and the 10 pt above its bottom | Joint subscriber: Date (inside the joint box) ("Date") |  |
| p12-accept-date | blank | date | firm | yes | 85.8, 440.6, 157.4, 450.6 | rule in the picture (px x 180-330, y 944-944); box = the rule's x extent and the 10 pt above its bottom | Date the company accepts (year 2016 printed) ("This Subscription is accepted on") |  |
| p12-accept-signature | signature | signature | firm | yes | 343.8, 441.5, 540.2, 451.5 | rule in the picture (px x 721-1133, y 945-946); box = the rule's x extent and the 10 pt above its bottom | Signature for the company ("By:") |  |
| p12-accept-name | blank | name | firm | yes | 374.9, 465.8, 540.2, 476.2 | no printed line: the room right of "Name:" (OCR word and pixels agree) to the end of the By rule | Name of the person signing for the company (no rule printed) ("Name:") | no printed line; box is the room beside the caption |
| p12-accept-title | blank | title | firm | yes | 369.7, 491.1, 540.2, 501.5 | no printed line: the room right of "Title:" to the end of the By rule | Title of the person signing for the company (no rule printed) ("Title:") | no printed line; box is the room beside the caption |

Must NOT get a field: the frame of the joint-subscriber box (top y 137, bottom y 359, and its sides); the thick bar under the page number; the row of five asterisks

