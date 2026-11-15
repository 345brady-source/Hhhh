# Answer sheet: document B (32 pages)

A limited partnership agreement. It is signed in this file only by the sponsor side: the managing (general) partner entity and the Class B partner entity, both by the same named manager. There is NO investor signature page, no joinder page, no counterpart signature page for limited partners, no blank for an investor anywhere. The text says an investor becomes a partner by executing a subscription agreement and a counterpart of this agreement, and grants the managing partner a power of attorney; the place where the investor signs is in the separate subscription document, not here.

- Investor signature block: none. Firm block: page 31 (two signature lines). Second investor: none. Third parties: none.
- Total places: 2 (2 signature, both firm, both required). Every other page: 0.

| id | page | kind | owner | must | box x0,y0,x1,y1 | label |
|---|---|---|---|---|---|---|
| p31-01 | 31 | signature | firm | required | 303.84, 507.48, 540.0, 507.96 | Managing partner (the general partner entity): signature line after "By:"; the signatory's name and title are already printed under the line |
| p31-02 | 31 | signature | firm | required | 303.84, 658.92, 540.0, 659.4 | Class B partner (the sponsor's own entity): signature line after "By:"; the signatory's name and title are already printed under the line |

## Per page (places / confidence)

p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, p8: 0, p9: 0, p10: 0, p11: 0, p12: 0, p13: 0, p14: 0, p15: 0, p16: 0, p17: 0, p18: 0, p19: 0, p20: 0, p21: 0, p22: 0, p23: 0, p24: 0, p25: 0, p26: 0, p27: 0, p28: 0, p29: 0, p30: 0, p31: 2, p32: 0. Confidence: certain on every page (no page has a doubtful place).

## What must NOT get a field

**Page 1**
- cover: a logo picture (it contains two short horizontal strokes beside a word, part of the picture), title lines. No place.

**Page 2**
- table of contents: 39 dot-leader lines with page numbers, each a link annotation. Dot leaders are not blanks.

**Page 3**
- table of contents continued: 31 dot-leader lines, link annotations. Not blanks.

**Page 16**
- one drawn rule [126.48, 630.12, 530.88, 630.6]: the underline of a sentence of prose (emphasis). Text sits directly on it. Not a blank.
- running prose; footer

**Page 31**
- the effective-date sentence above the blocks has its date printed (already filled in): no date field
- block headings in bold capitals and the two printed entity names: no field
- the printed name and title under each rule ("name, title" already filled in): no name field, no title field
- there is NO date line, NO name line, NO title line beside either signature; none may be invented
- footer (two lines and a page number)

**Page 32**
- six drawn rules under the three column headings (two lines each): [319.56,202.92,355.44,203.4] [325.56,216.6,349.44,217.08] [378.6,202.92,426.72,203.4] [378.72,216.6,426.72,217.08] [445.8,202.92,530.52,203.4] [470.16,216.6,506.16,217.08]: underlined headings, text sits on each. Not blanks.
- table cells are clip rectangles only (no drawn frame): not boxes
- cells holding a placeholder word ("to be determined") for three classes of holder, and cells holding a hyphen or "N/A": printed values the sponsor maintains (the agreement lets the managing partner update this exhibit); no field
- the word standing for the investors in three rows: printed text, no blank
- printed entity names and addresses; footer

**Pages 4 to 30 except 16**: running prose with headings and a footer; nothing drawn; no field.

## How measured

drawn rules from the page content streams (pdfplumber and a raw pypdf read of the "re ... f" operators, both agree to 0.01 pt); words from pdftotext -bbox; every page rendered at 100 dpi and looked at; machine sweep of all 32 pages for underscores (0), box or symbol-font characters (0), stroked paths (0), form fields (0), filled rectangles (9: 1 on page 16, 2 on page 31, 6 on page 32)

A signature place is recorded as its rule (a hairline). A field belongs to it when the field stands on the rule: see score.js (the writing zone is the rule widened upward by 36 pt and downward by 4 pt).
