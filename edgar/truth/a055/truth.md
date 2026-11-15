# Answer sheet: a055 (24 pages)

Source: https://www.sec.gov/Archives/edgar/data/1414628/000141462816000026/seriesdsubscriptionagreeme.htm

PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt of writing room above it. Cell: the cell's own rules. Tick box: the printed square (ink at 400 dpi). Picture pages: measured on the picture's own pixels and converted through the page's drawing matrix.

pdfplumber characters and rectangles (geom.json in work-g1); every form page looked at at 100 dpi; the filing's HTML read to confirm that no lines were ever printed on the caption-only rows; overlays drawn and looked at.

## Who signs

A unit subscription agreement whose form pages lost their printed lines and boxes in the filing: the investor fills an information page and a signature page (individual, joint or entity), then an individual certificate (pages 17-20) or an entity certificate (pages 20-24) with initials, yes/no answers and its own signature; a FINRA member firm signs an acknowledgment if the investor is a registered representative. No company acceptance block is printed (the company accepts by signing counterparts).

- Investor pages: [14, 16, 17, 18, 19, 20, 21, 22, 23, 24]
- Firm pages: []
- Co-investor: True
- Third parties: FINRA member firm acknowledgment (pages 19 and 23)

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
| 8 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 9 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 10 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 11 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 12 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 13 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: agreement text) |
| 14 | 22 | 0 | 0 | 22 | 0 | 0 | sure which captions ask for an entry; every box is a judgement (no line printed); the delivery choices and yes/no have no printed box and are left out |
| 15 | 0 | 0 | 0 | 0 | 0 | 0 | sure (no place: the signature page's opening paragraph) |
| 16 | 17 | 0 | 0 | 13 | 3 | 1 | sure which captions ask for an entry; boxes are judgements (no line printed; room up to the middle of the table) except the printed units run |
| 17 | 8 | 0 | 3 | 5 | 0 | 0 | sure of the printed runs; the three initials places are judgements (nothing printed) |
| 18 | 14 | 11 | 0 | 3 | 0 | 0 | sure of every run; the grid runs are taken as mark places (judgement) |
| 19 | 14 | 10 | 0 | 2 | 1 | 1 | sure (the describe place has a caption only) |
| 20 | 11 | 0 | 0 | 7 | 2 | 2 | sure of the printed runs and which captions ask for an entry; caption boxes are judgements; the choices without boxes are left out |
| 21 | 13 | 0 | 11 | 2 | 0 | 0 | sure of the printed runs; the eleven initials places are judgements (five have a tiny caption, six have nothing printed) |
| 22 | 12 | 11 | 0 | 1 | 0 | 0 | sure of every run; grid runs taken as mark places (judgement) |
| 23 | 15 | 10 | 0 | 3 | 1 | 1 | sure |
| 24 | 5 | 0 | 0 | 3 | 1 | 1 | sure which captions ask for an entry; boxes are judgements (no line printed) |
| all | 131 | 42 | 14 | 61 | 8 | 6 | |

By owner: co-investor 6, investor 25, investor-entity 55, investor-individual 39, third-party 6

## Doubtful (109)

- p14-names (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-executing (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-tax-id (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-marital (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-dob (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-joint-dob (p14, blank, co-investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-experience (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-organized (p14, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-total-assets (p14, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-street (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-city (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-home-phone (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-home-fax (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-mobile (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-email (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-employer (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-business-type (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-bus-street (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-bus-city (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-bus-phone (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-bus-fax (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p14-delivery-address (p14, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-ind-name (p16, blank, investor-individual): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-ind-signature (p16, signature, investor-individual): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-ind-tax-id (p16, blank, investor-individual): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-joint-name (p16, blank, co-investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-joint-signature (p16, signature, co-investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-joint-tax-id (p16, blank, co-investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-ent-signer (p16, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-ent-signature (p16, signature, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-ent-title (p16, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-ent-phone (p16, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-ent-tax-id (p16, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-street (p16, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-street2 (p16, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-city (p16, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-aggregate (p16, blank, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p16-date (p16, date, investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p17-init-1 (p17, initials, investor-individual): nothing printed at all on this row's initials column (the instruction asks to initial each applicable category): the box is that column right of the number
- p17-init-2 (p17, initials, investor-individual): nothing printed but a tiny "(Initial if Applicable)" caption: the box is the initials column on that row
- p17-init-3 (p17, initials, investor-individual): nothing printed but a tiny "(Initial if Applicable)" caption: the box is the initials column on that row
- p18-qd-yes (p18, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p18-qd-no (p18, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p18-qe-frequently-1 (p18, tickbox, investor-individual): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p18-qe-frequently-2 (p18, tickbox, investor-individual): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p18-qe-frequently-3 (p18, tickbox, investor-individual): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p18-qe-occasionally-1 (p18, tickbox, investor-individual): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p18-qe-occasionally-2 (p18, tickbox, investor-individual): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p18-qe-occasionally-3 (p18, tickbox, investor-individual): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p18-qe-never-1 (p18, tickbox, investor-individual): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p18-qe-never-2 (p18, tickbox, investor-individual): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p18-qe-never-3 (p18, tickbox, investor-individual): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p19-qf-yes (p19, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p19-qf-no (p19, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p19-qg-yes (p19, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p19-qg-no (p19, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p19-qh-yes (p19, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p19-qh-no (p19, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p19-qi-yes (p19, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p19-qi-no (p19, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p19-qj-yes (p19, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p19-qj-no (p19, tickbox, investor-individual): a short underscore run after YES or NO, used as a mark place (no square printed)
- p19-qj-describe (p19, blank, investor-individual): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p20-ind-name (p20, blank, investor-individual): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p20-ind-signature (p20, signature, investor-individual): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p20-joint-signature (p20, signature, co-investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p20-ind-date (p20, date, investor-individual): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p20-joint-date (p20, date, co-investor): caption only: the filing lost the form's lines; the box is the empty room after the caption
- p20-erisa-plan-name (p20, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption (lines are only 8 pt apart; room capped at 250 pt)
- p20-erisa-plan-number (p20, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption (lines are only 8 pt apart; room capped at 250 pt)
- p20-erisa-sponsor (p20, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption (lines are only 8 pt apart; room capped at 250 pt)
- p20-erisa-sponsor-ein (p20, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption (lines are only 8 pt apart; room capped at 250 pt)
- p21-init-1 (p21, initials, investor-entity): nothing printed but a tiny "(Initial if Applicable)" caption: the box is the initials column on that row
- p21-init-2 (p21, initials, investor-entity): nothing printed but a tiny "(Initial if Applicable)" caption: the box is the initials column on that row
- p21-init-3 (p21, initials, investor-entity): nothing printed but a tiny "(Initial if Applicable)" caption: the box is the initials column on that row
- p21-init-4 (p21, initials, investor-entity): nothing printed at all on this row's initials column (the instruction asks to initial each applicable category): the box is that column right of the number
- p21-init-5 (p21, initials, investor-entity): nothing printed at all on this row's initials column (the instruction asks to initial each applicable category): the box is that column right of the number
- p21-init-6 (p21, initials, investor-entity): nothing printed at all on this row's initials column (the instruction asks to initial each applicable category): the box is that column right of the number
- p21-init-7 (p21, initials, investor-entity): nothing printed at all on this row's initials column (the instruction asks to initial each applicable category): the box is that column right of the number
- p21-init-8 (p21, initials, investor-entity): nothing printed at all on this row's initials column (the instruction asks to initial each applicable category): the box is that column right of the number
- p21-init-9 (p21, initials, investor-entity): nothing printed but a tiny "(Initial if Applicable)" caption: the box is the initials column on that row
- p21-init-10 (p21, initials, investor-entity): nothing printed but a tiny "(Initial if Applicable)" caption: the box is the initials column on that row
- p21-init-11 (p21, initials, investor-entity): nothing printed at all on this row's initials column (the instruction asks to initial each applicable category): the box is that column right of the number
- p22-qb-yes (p22, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p22-qb-no (p22, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p22-qc-frequently-1 (p22, tickbox, investor-entity): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p22-qc-frequently-2 (p22, tickbox, investor-entity): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p22-qc-frequently-3 (p22, tickbox, investor-entity): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p22-qc-occasionally-1 (p22, tickbox, investor-entity): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p22-qc-occasionally-2 (p22, tickbox, investor-entity): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p22-qc-occasionally-3 (p22, tickbox, investor-entity): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p22-qc-never-1 (p22, tickbox, investor-entity): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p22-qc-never-2 (p22, tickbox, investor-entity): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p22-qc-never-3 (p22, tickbox, investor-entity): underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs
- p23-qd-yes (p23, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p23-qd-no (p23, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p23-qe-yes (p23, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p23-qe-no (p23, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p23-qf-yes (p23, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p23-qf-no (p23, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p23-qg-yes (p23, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p23-qg-no (p23, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p23-qh-yes (p23, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p23-qh-no (p23, tickbox, investor-entity): a short underscore run after YES or NO, used as a mark place (no square printed)
- p24-ent-name (p24, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption (room capped at 250 pt)
- p24-ent-signature (p24, signature, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption (room capped at 250 pt)
- p24-ent-signer (p24, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption (room capped at 250 pt)
- p24-ent-title (p24, blank, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption (room capped at 250 pt)
- p24-ent-date (p24, date, investor-entity): caption only: the filing lost the form's lines; the box is the empty room after the caption (room capped at 250 pt)

## Places

### Page 1

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 2

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 3

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 4

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 5

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 6

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 7

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 8

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 9

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 10

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 11

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 12

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 13

Must NOT get a field: short rules under headings and defined terms (underlined words); the grey full-width rule where the web page breaks.

### Page 14

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p14-names | blank | name | investor | yes | 123.6, 68.0, 720.3, 76.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Investor name(s), as they will appear on the securities |
| p14-executing | blank | name | investor | no | 222.6, 86.0, 720.3, 94.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual executing the profile, or trustee (if applicable) |
| p14-tax-id | blank | tax number | investor | yes | 129.7, 96.0, 398.9, 104.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Social security or federal ID number |
| p14-marital | blank | text | investor | no | 444.6, 96.0, 720.3, 104.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Marital status |
| p14-dob | blank | date | investor | no | 112.3, 106.0, 398.9, 114.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Date of birth |
| p14-joint-dob | blank | date | co-investor | no | 472.6, 106.0, 720.3, 114.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint party date of birth |
| p14-experience | blank | text | investor | no | 159.3, 116.0, 398.9, 124.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Investment experience in years |
| p14-organized | blank | date | investor-entity | no | 158.6, 126.0, 720.3, 134.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Date of organization (entities) |
| p14-total-assets | blank | amount | investor-entity | no | 235.6, 136.0, 720.3, 144.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Total assets (entities and irrevocable trusts only) |
| p14-street | blank | address | investor | yes | 138.9, 150.0, 720.3, 158.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Primary street address |
| p14-city | blank | address | investor | yes | 161.5, 160.0, 720.3, 168.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Primary city, state and zip code |
| p14-home-phone | blank | phone | investor | no | 111.7, 170.0, 398.9, 178.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Home phone |
| p14-home-fax | blank | phone | investor | no | 435.0, 170.0, 720.3, 178.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Home fax |
| p14-mobile | blank | phone | investor | no | 114.7, 180.0, 398.9, 188.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Mobile phone |
| p14-email | blank | email | investor | no | 423.0, 180.0, 720.3, 188.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Email |
| p14-employer | blank | text | investor | no | 103.4, 198.0, 720.3, 206.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Employer |
| p14-business-type | blank | text | investor | no | 122.9, 208.0, 720.3, 216.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Type of business |
| p14-bus-street | blank | address | investor | no | 141.2, 218.0, 720.3, 226.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Business street address |
| p14-bus-city | blank | address | investor | no | 163.7, 228.0, 720.3, 236.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Business city, state and zip code |
| p14-bus-phone | blank | phone | investor | no | 119.2, 238.0, 398.9, 246.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Business phone |
| p14-bus-fax | blank | phone | investor | no | 442.4, 238.0, 720.3, 246.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Business fax |
| p14-delivery-address | blank | address | investor | no | 217.2, 306.0, 720.3, 314.7 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Securities delivery: deliver to the following address (the third delivery choice; caption only) |

Must NOT get a field: underlined captions (the underline is part of the caption, not a line to write on); "Joint Party is Spouse? yes no": two choice words with no printed box; the three securities delivery choices ("Check One"): no box is printed beside any of them; the headings and "[Signature Page Follows]".

### Page 15

### Page 16

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p16-ind-name | blank | name | investor-individual | no | 102.0, 82.0, 389.4, 90.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual investor: print name |
| p16-ind-signature | signature | signature | investor-individual | no | 97.0, 98.0, 389.4, 106.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual investor: signature |
| p16-ind-tax-id | blank | tax number | investor-individual | no | 149.5, 114.0, 389.4, 122.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual investor: social security or federal ID number |
| p16-joint-name | blank | name | co-investor | no | 146.3, 130.0, 389.4, 138.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint investor: print name (if joint investment) |
| p16-joint-signature | signature | signature | co-investor | no | 97.0, 146.0, 389.4, 154.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint investor: signature |
| p16-joint-tax-id | blank | tax number | co-investor | no | 147.7, 162.0, 389.4, 170.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Joint investor: social security or federal ID number |
| p16-ent-signer | blank | name | investor-entity | no | 122.2, 202.0, 389.4, 210.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity investor: name of signatory |
| p16-ent-signature | signature | signature | investor-entity | no | 97.0, 218.0, 389.4, 226.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity investor: signature |
| p16-ent-title | blank | title | investor-entity | no | 83.8, 234.0, 389.4, 242.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity investor: title |
| p16-ent-phone | blank | phone | investor-entity | no | 108.7, 250.0, 389.4, 258.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity investor: telephone number |
| p16-ent-tax-id | blank | tax number | investor-entity | no | 147.7, 266.0, 389.4, 274.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity investor: social security or federal ID number |
| p16-street | blank | address | investor | yes | 108.3, 290.0, 389.4, 298.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Street address |
| p16-street2 | blank | address | investor | no | 133.5, 306.0, 389.4, 314.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Street address, second line |
| p16-city | blank | address | investor | yes | 109.9, 322.0, 389.4, 330.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | City, state, zip |
| p16-aggregate | blank | amount | investor | yes | 140.3, 370.0, 389.4, 378.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Aggregate purchase price |
| p16-units | blank | text | investor | yes | 145.3, 354.5, 208.6, 361.2 | underscore run of 19 | Number of units purchased |
| p16-date | date | date | investor | yes | 84.0, 378.0, 389.4, 386.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Date of the signature page |

Must NOT get a field: "Purchase Price Per Unit: $1,000.00" (already printed); the underlined headings "If Investor is an Individual:", "If Investor is an entity:", "Investment Amount:"; the "EXHIBIT A / Accredited investor Certification" heading; the grey page-break rule.

### Page 17

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p17-grantor | blank | text | investor-individual | no | 328.9, 135.5, 594.8, 142.2 | 2 underscore runs (two adjoining runs on one line) read as one text; parts give each run | Grantor of a revocable trust: identify each grantor and when the trust is revocable (first line) |
| p17-grantor-2 | blank | text | investor-individual | no | 33.0, 143.5, 382.9, 150.2 | underscore run of 105 | Grantor of a revocable trust: continuation line |
| p17-income | blank | amount | investor-individual | no | 33.0, 197.5, 139.6, 204.2 | underscore run of 32 | Annual income |
| p17-net-worth | blank | amount | investor-individual | no | 280.3, 197.5, 387.0, 204.2 | underscore run of 32 | Net worth |
| p17-liquid | blank | amount | investor-individual | no | 520.4, 197.5, 627.0, 204.2 | underscore run of 32 | Liquid net worth |
| p17-init-1 | initials | initials | investor-individual | no | 95.0, 231.0, 140.0, 241.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: net worth over $1 million (category 1) |
| p17-init-2 | initials | initials | investor-individual | no | 76.0, 241.0, 126.0, 251.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: income over $200,000 / $300,000 (category 2) |
| p17-init-3 | initials | initials | investor-individual | no | 76.0, 259.0, 126.0, 269.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: director or executive officer of the company (category 3) |

Must NOT get a field: the six forms of ownership (Individual, Joint Tenants, IRA, Tenants in Common, Tenants in the Entirety, Community Property): no box is printed beside any of them; "Check if any Grantor is deceased, disabled or legally incompetent.": no box printed; the framed bold note about joint investments (a drawn frame around text); the underline of "initial each category" and of the section heading.

### Page 18

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p18-qa | blank | text | investor-individual | no | 32.8, 66.5, 765.8, 73.2 | underscore run of 220 | Question (a): current employment, employer and its business |
| p18-qb | blank | text | investor-individual | no | 32.8, 90.5, 765.8, 97.2 | underscore run of 220 | Question (b): college or graduate degrees |
| p18-qc | blank | text | investor-individual | no | 32.8, 114.5, 765.8, 121.2 | underscore run of 220 | Question (c): types of prior investments |
| p18-qd-yes | tickbox | tickbox | investor-individual | no | 45.3, 146.5, 68.7, 153.2 | underscore run of 7 | Question (d) participated in private placements before: YES |
| p18-qd-no | tickbox | tickbox | investor-individual | no | 78.3, 146.5, 101.6, 153.2 | underscore run of 7 | Question (d) participated in private placements before: NO |
| p18-qe-frequently-1 | tickbox | tickbox | investor-individual | no | 51.8, 252.5, 91.7, 259.2 | underscore run of 12 | Question (e) frequency of prior private placements: frequently, public companies |
| p18-qe-frequently-2 | tickbox | tickbox | investor-individual | no | 51.8, 264.5, 91.7, 271.2 | underscore run of 12 | Question (e) frequency of prior private placements: frequently, private companies |
| p18-qe-frequently-3 | tickbox | tickbox | investor-individual | no | 51.8, 276.5, 91.7, 283.2 | underscore run of 12 | Question (e) frequency of prior private placements: frequently, public or private financial services companies |
| p18-qe-occasionally-1 | tickbox | tickbox | investor-individual | no | 51.8, 310.5, 91.7, 317.2 | underscore run of 12 | Question (e) frequency of prior private placements: occasionally, public companies |
| p18-qe-occasionally-2 | tickbox | tickbox | investor-individual | no | 51.8, 322.5, 91.7, 329.2 | underscore run of 12 | Question (e) frequency of prior private placements: occasionally, private companies |
| p18-qe-occasionally-3 | tickbox | tickbox | investor-individual | no | 51.8, 334.5, 91.7, 341.2 | underscore run of 12 | Question (e) frequency of prior private placements: occasionally, public or private financial services companies |
| p18-qe-never-1 | tickbox | tickbox | investor-individual | no | 51.8, 368.5, 91.7, 375.2 | underscore run of 12 | Question (e) frequency of prior private placements: never, public companies |
| p18-qe-never-2 | tickbox | tickbox | investor-individual | no | 51.8, 384.5, 91.7, 391.2 | underscore run of 12 | Question (e) frequency of prior private placements: never, private companies |
| p18-qe-never-3 | tickbox | tickbox | investor-individual | no | 51.8, 400.5, 91.7, 407.2 | underscore run of 12 | Question (e) frequency of prior private placements: never, public or private financial services companies |

Must NOT get a field: the displaced column captions "Public Companies / Private Companies / Public or Private Financial Services Companies"; the full-width runs are answer lines, not decoration (they ARE places).

### Page 19

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p19-qf-yes | tickbox | tickbox | investor-individual | no | 45.3, 82.5, 68.7, 89.2 | underscore run of 7 | Question (f) expects income to decrease significantly: YES |
| p19-qf-no | tickbox | tickbox | investor-individual | no | 78.3, 82.5, 101.6, 89.2 | underscore run of 7 | Question (f) expects income to decrease significantly: NO |
| p19-qg-yes | tickbox | tickbox | investor-individual | no | 45.3, 122.5, 68.7, 129.2 | underscore run of 7 | Question (g) other investments or liabilities needing sudden cash: YES |
| p19-qg-no | tickbox | tickbox | investor-individual | no | 78.3, 122.5, 101.6, 129.2 | underscore run of 7 | Question (g) other investments or liabilities needing sudden cash: NO |
| p19-qh-yes | tickbox | tickbox | investor-individual | no | 45.3, 154.5, 68.7, 161.2 | underscore run of 7 | Question (h) familiar with the risk and illiquidity: YES |
| p19-qh-no | tickbox | tickbox | investor-individual | no | 78.3, 154.5, 101.6, 161.2 | underscore run of 7 | Question (h) familiar with the risk and illiquidity: NO |
| p19-qi-yes | tickbox | tickbox | investor-individual | no | 45.3, 194.5, 68.7, 201.2 | underscore run of 7 | Question (i) understands the entire investment may be lost: YES |
| p19-qi-no | tickbox | tickbox | investor-individual | no | 78.3, 194.5, 101.6, 201.2 | underscore run of 7 | Question (i) understands the entire investment may be lost: NO |
| p19-qj-yes | tickbox | tickbox | investor-individual | no | 45.3, 291.5, 68.7, 298.2 | underscore run of 7 | Question (j) affiliated with a FINRA member firm: YES |
| p19-qj-no | tickbox | tickbox | investor-individual | no | 78.3, 291.5, 101.6, 298.2 | underscore run of 7 | Question (j) affiliated with a FINRA member firm: NO |
| p19-qj-describe | blank | text | investor-individual | no | 147.0, 307.0, 397.0, 315.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Question (j): if yes, describe (caption only) |
| p19-finra-name | blank | name | third-party | no | 60.8, 387.5, 180.7, 394.2 | underscore run of 36 | FINRA member firm acknowledgment: name of the member firm |
| p19-finra-signature | signature | signature | third-party | no | 72.0, 419.5, 152.0, 426.2 | underscore run of 24 | FINRA member firm acknowledgment: signature of authorised officer (By:) |
| p19-finra-date | date | date | third-party | no | 169.8, 419.5, 206.4, 426.2 | underscore run of 11 | FINRA member firm acknowledgment: date |

Must NOT get a field: the underlined section heading.

### Page 20

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p20-ind-name | blank | name | investor-individual | yes | 76.0, 102.0, 372.0, 110.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual certification: investor name |
| p20-ind-signature | signature | signature | investor-individual | yes | 77.7, 112.0, 372.0, 120.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual certification: signature (left) |
| p20-joint-signature | signature | signature | co-investor | no | 419.9, 112.0, 720.0, 120.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual certification: second signature (right column, for a joint investor) |
| p20-ind-date | date | date | investor-individual | yes | 49.2, 122.0, 372.0, 130.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual certification: date (left) |
| p20-joint-date | date | date | co-investor | no | 391.3, 122.0, 720.0, 130.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Individual certification: date (right column) |
| p20-other-org | blank | text | investor-entity | no | 110.0, 227.5, 379.9, 234.2 | underscore run of 81 | Entity certificate: other form of organization |
| p20-formed | blank | date | investor-entity | no | 209.3, 237.5, 385.9, 244.2 | underscore run of 53 | Entity certificate: approximate date the entity was formed |
| p20-erisa-plan-name | blank | name | investor-entity | no | 105.4, 430.5, 353.4, 437.7 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | ERISA: investor's plan name (only if the plan answered yes) |
| p20-erisa-plan-number | blank | text | investor-entity | no | 111.3, 438.5, 359.3, 445.7 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | ERISA: investor's plan number (only if the plan answered yes) |
| p20-erisa-sponsor | blank | name | investor-entity | no | 108.3, 446.5, 356.3, 453.7 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | ERISA: name of plan sponsor (only if the plan answered yes) |
| p20-erisa-sponsor-ein | blank | tax number | investor-entity | no | 103.5, 454.5, 351.5, 461.7 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | ERISA: EIN of plan sponsor (only if the plan answered yes) |

Must NOT get a field: the forms of organization (Limited Partnership, LLC, Corporation, Irrevocable Trust, Pension plan): no box printed beside any of them; ERISA "yesno" and "yes *no": choice words with no printed box; the three ERISA statements "please check each box": no box is printed; the drawn frames around the NOTE line and the ERISA section; underlines of "IS" and "IS NOT" in the statements; the underlined heading.

### Page 21

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p21-pay-other | blank | text | investor-entity | no | 49.8, 70.5, 113.1, 77.2 | underscore run of 19 | Entity form of payment: other (specify form of payment) |
| p21-init-1 | initials | initials | investor-entity | no | 90.0, 125.0, 141.0, 135.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 1 (bank) |
| p21-init-2 | initials | initials | investor-entity | no | 90.0, 135.0, 141.0, 145.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 2 (broker or dealer) |
| p21-init-3 | initials | initials | investor-entity | no | 90.0, 145.0, 141.0, 155.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 3 (insurance company) |
| p21-init-4 | initials | initials | investor-entity | no | 103.0, 155.0, 160.0, 165.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 4 (registered investment company or BDC) |
| p21-init-5 | initials | initials | investor-entity | no | 103.0, 165.0, 160.0, 175.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 5 (small business investment company) |
| p21-init-6 | initials | initials | investor-entity | no | 103.0, 183.0, 160.0, 193.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 6 (state plan over $5,000,000) |
| p21-init-7 | initials | initials | investor-entity | no | 103.0, 209.0, 160.0, 219.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 7 (ERISA employee benefit plan) |
| p21-init-8 | initials | initials | investor-entity | no | 103.0, 219.0, 160.0, 229.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 8 (private business development company) |
| p21-init-9 | initials | initials | investor-entity | no | 90.0, 237.0, 141.0, 247.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 9 (501(c)(3) or company over $5,000,000) |
| p21-init-10 | initials | initials | investor-entity | no | 90.0, 251.0, 141.0, 261.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 10 (trust over $5,000,000 directed by a sophisticated person) |
| p21-init-11 | initials | initials | investor-entity | no | 90.0, 281.0, 141.0, 291.0 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Initials: entity investor status category 11 (entity whose equity owners are all accredited) |
| p21-equity-owners | blank | text | investor-entity | no | 163.8, 298.0, 736.9, 304.7 | underscore run of 172 | Category 11: list the equity owners |

Must NOT get a field: "Wire funds will be made from my outside account...": a payment choice with no printed box; the underlined wording of several categories (underlined text, not lines); the underline of "initial each category" and of the section heading; the category numbers.

### Page 22

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p22-qa | blank | text | investor-entity | no | 32.8, 66.5, 765.8, 73.2 | underscore run of 220 | Question (a): types of prior investments |
| p22-qb-yes | tickbox | tickbox | investor-entity | no | 45.3, 98.5, 68.7, 105.2 | underscore run of 7 | Question (b) participated in private placements before: YES |
| p22-qb-no | tickbox | tickbox | investor-entity | no | 78.3, 98.5, 101.6, 105.2 | underscore run of 7 | Question (b) participated in private placements before: NO |
| p22-qc-frequently-1 | tickbox | tickbox | investor-entity | no | 51.8, 204.5, 91.7, 211.2 | underscore run of 12 | Question (c) frequency of prior private placements: frequently, public companies |
| p22-qc-frequently-2 | tickbox | tickbox | investor-entity | no | 51.8, 216.5, 91.7, 223.2 | underscore run of 12 | Question (c) frequency of prior private placements: frequently, private companies |
| p22-qc-frequently-3 | tickbox | tickbox | investor-entity | no | 51.8, 228.5, 91.7, 235.2 | underscore run of 12 | Question (c) frequency of prior private placements: frequently, public or private financial services companies |
| p22-qc-occasionally-1 | tickbox | tickbox | investor-entity | no | 51.8, 262.5, 91.7, 269.2 | underscore run of 12 | Question (c) frequency of prior private placements: occasionally, public companies |
| p22-qc-occasionally-2 | tickbox | tickbox | investor-entity | no | 51.8, 274.5, 91.7, 281.2 | underscore run of 12 | Question (c) frequency of prior private placements: occasionally, private companies |
| p22-qc-occasionally-3 | tickbox | tickbox | investor-entity | no | 51.8, 286.5, 91.7, 293.2 | underscore run of 12 | Question (c) frequency of prior private placements: occasionally, public or private financial services companies |
| p22-qc-never-1 | tickbox | tickbox | investor-entity | no | 51.8, 320.5, 91.7, 327.2 | underscore run of 12 | Question (c) frequency of prior private placements: never, public companies |
| p22-qc-never-2 | tickbox | tickbox | investor-entity | no | 51.8, 336.5, 91.7, 343.2 | underscore run of 12 | Question (c) frequency of prior private placements: never, private companies |
| p22-qc-never-3 | tickbox | tickbox | investor-entity | no | 51.8, 352.5, 91.7, 359.2 | underscore run of 12 | Question (c) frequency of prior private placements: never, public or private financial services companies |

Must NOT get a field: the displaced column captions of the frequency grid.

### Page 23

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p23-qd-yes | tickbox | tickbox | investor-entity | no | 45.3, 90.5, 68.7, 97.2 | underscore run of 7 | Question (d) expects total assets to decrease significantly: YES |
| p23-qd-no | tickbox | tickbox | investor-entity | no | 78.3, 90.5, 101.6, 97.2 | underscore run of 7 | Question (d) expects total assets to decrease significantly: NO |
| p23-qe-yes | tickbox | tickbox | investor-entity | no | 45.3, 130.5, 68.7, 137.2 | underscore run of 7 | Question (e) other investments or liabilities needing sudden cash: YES |
| p23-qe-no | tickbox | tickbox | investor-entity | no | 78.3, 130.5, 101.6, 137.2 | underscore run of 7 | Question (e) other investments or liabilities needing sudden cash: NO |
| p23-qf-yes | tickbox | tickbox | investor-entity | no | 45.3, 170.5, 68.7, 177.2 | underscore run of 7 | Question (f) familiar with the risk and illiquidity: YES |
| p23-qf-no | tickbox | tickbox | investor-entity | no | 78.3, 170.5, 101.6, 177.2 | underscore run of 7 | Question (f) familiar with the risk and illiquidity: NO |
| p23-qg-yes | tickbox | tickbox | investor-entity | no | 45.3, 210.5, 68.7, 217.2 | underscore run of 7 | Question (g) understands the entire investment may be lost: YES |
| p23-qg-no | tickbox | tickbox | investor-entity | no | 78.3, 210.5, 101.6, 217.2 | underscore run of 7 | Question (g) understands the entire investment may be lost: NO |
| p23-qh-yes | tickbox | tickbox | investor-entity | no | 45.3, 311.5, 68.7, 318.2 | underscore run of 7 | Question (h) affiliated with a FINRA member firm: YES |
| p23-qh-no | tickbox | tickbox | investor-entity | no | 78.3, 311.5, 101.6, 318.2 | underscore run of 7 | Question (h) affiliated with a FINRA member firm: NO |
| p23-qh-describe-1 | blank | text | investor-entity | no | 84.8, 343.5, 318.0, 350.2 | underscore run of 70 | Question (h): if yes, describe (first line) |
| p23-qh-describe-2 | blank | text | investor-entity | no | 84.8, 351.5, 318.0, 358.2 | underscore run of 70 | Question (h): if yes, describe (second line) |
| p23-finra-name | blank | name | third-party | no | 60.8, 407.5, 180.7, 414.2 | underscore run of 36 | FINRA member firm acknowledgment (entities): name of the member firm |
| p23-finra-signature | signature | signature | third-party | no | 72.0, 439.5, 152.0, 446.2 | underscore run of 24 | FINRA member firm acknowledgment (entities): signature of authorised officer |
| p23-finra-date | date | date | third-party | no | 169.8, 439.5, 206.4, 446.2 | underscore run of 11 | FINRA member firm acknowledgment (entities): date |

Must NOT get a field: the underlined section heading; "[Remainder of page intentionally left blank]".

### Page 24

| id | kind | what | owner | must | box | printed as | label |
|---|---|---|---|---|---|---|---|
| p24-ent-name | blank | name | investor-entity | yes | 76.0, 144.0, 324.0, 152.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity certification: investor name |
| p24-ent-signature | signature | signature | investor-entity | yes | 76.0, 154.0, 324.0, 162.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity certification: signature |
| p24-ent-signer | blank | name | investor-entity | yes | 71.6, 164.0, 319.6, 172.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity certification: printed name of the signer |
| p24-ent-title | blank | title | investor-entity | no | 49.0, 174.0, 297.0, 182.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity certification: title |
| p24-ent-date | date | date | investor-entity | yes | 49.2, 184.0, 297.2, 192.2 | nothing printed: the empty writing room after the label, up to the next caption (text line height) | Entity certification: date |

Must NOT get a field: the underlined heading.
