# Set B: subscription agreements of funds and pooled vehicles (SEC EDGAR)

110 documents, one folder each (`b001` to `b110`). In each folder: `source.<ext>` (the document as filed; for a prospectus appendix, the whole prospectus file), any pictures the document uses, `doc.pdf` (what the reader gets) and `meta.json`. `index.json` lists them all.

Scope: N-2 closed-end, interval and tender-offer funds, BDCs, non-traded REITs (S-11, post-effective amendments, 424B3 supplements), LP and LLC funds (managed futures, equipment leasing, mortgage funds, real estate programs), oil and gas drilling programs, feeder/fund-of-funds, and agreements filed as PDF or as pictures. Regulation A, Regulation D exhibits and small-company S-1s are in the other builder's set.

All requests used the generic User-Agent `SubDocResearch research-bot@example.org`, at under 3 requests a second.

## How the PDFs were made

- `filed-pdf`: the PDF as filed on EDGAR (cut to the subscription pages with pypdf when the PDF is a whole prospectus).
- `printed-portrait` / `printed-landscape`: the HTML or TXT document opened in Chromium (Playwright) and printed to US Letter, 0.4in margins.
- `pictures-printed`: an HTML document whose form pages are JPG/GIF pictures, printed the same way so the pictures are in the PDF; tall pictures split across pages, and EDGAR page-break rules leave near-empty pages between them, as in the owner's file.
- Some prints have background graphics on, some have the browser header/footer (date, file name, URL, page x/y).
- Prospectus appendices were cut out of the full prospectus at the appendix heading and the next appendix heading, so the PDF is the appendix only. Where a back cover followed on its own pages, those pages were dropped (`trimmed_trailing_pages` in meta).

Source files: 73 HTML, 29 TXT, 8 PDF. Printed in landscape: 15. Background graphics on: 11. Browser header/footer: 11.

## Counts

### By filing year
| years | docs |
|---|---|
| 1998-2000 | 4 |
| 2001-2005 | 40 |
| 2006-2010 | 20 |
| 2011-2015 | 18 |
| 2016-2020 | 10 |
| 2021-2026 | 18 |

### By form type of the filing
| form | docs |
|---|---|
| S-11 | 39 |
| N-2 | 33 |
| S-1 | 14 |
| 424B3 | 13 |
| 10-K | 5 |
| POS AM | 5 |
| POS 8C | 1 |

### By how the PDF was made
| made | docs |
|---|---|
| printed-portrait | 84 |
| printed-landscape | 13 |
| filed-pdf | 8 |
| pictures-printed | 5 |

### Detail (with print options)
| made | docs |
|---|---|
| printed-portrait | 62 |
| printed-landscape | 13 |
| printed-portrait + background graphics | 11 |
| printed-portrait + header/footer | 11 |
| filed-pdf | 8 |
| pictures-printed | 5 |

### Exhibit or appendix
| source | docs |
|---|---|
| exhibit (whole document) | 55 |
| appendix cut from prospectus | 55 |

### By page count of doc.pdf
| pages | docs |
|---|---|
| 1-3 | 5 |
| 4-8 | 30 |
| 9-15 | 52 |
| 16-25 | 15 |
| 26+ | 8 |

### Page content
| content | docs |
|---|---|
| text | 99 |
| mixed | 6 |
| pictures | 4 |
| vector-drawn form: text is outlined graphics, no text layer | 1 |

### Layout features (detected from text and source, checked by eye on contact sheets)
| feature | docs |
|---|---|
| entity investors | 98 |
| broker-dealer block | 89 |
| custodian section | 89 |
| IRA | 85 |
| tables | 85 |
| joint investors | 84 |
| tick boxes | 82 |
| W-9 certification | 74 |
| power of attorney | 70 |
| shaded cells/bands | 64 |
| underscore fill lines | 52 |
| countersignature/acceptance block | 51 |
| browser header/footer | 11 |
| picture pages | 9 |
| mixed text+pictures | 1 |
| vector-outlined form (no text layer) | 1 |

## Kinds of layout seen

- Brokerage-style REIT forms (2004-2026): numbered sections (1. Investment, 2. Ownership type, 3. Investor information, ... Broker-dealer, Signatures) in boxed tables, often with grey or coloured section bands and white fill-in cells, rows of tick boxes for account type (individual, joint tenants, tenants in common, community property, IRA, Keogh, trust, corporation, UGMA/UTMA), custodian/IRA blocks, distribution-reinvestment choices, bank details for direct deposit, a page of state suitability statements with "initials" columns, and investor, co-investor and custodian signature lines, then a registered-representative and principal certification.
- Watermarked forms: "Sample" printed diagonally over the form (Blackstone and J.P. Morgan REIT appendices).
- Forms filed as pictures: whole pages as JPGs (Corporate Capital Trust II, Flat Rock, Oxford Park, StratCap, Wells REIT II pages, AMG Pantheon pages, GC Net Lease pages, VII Peaks); some with grey fields and white boxes, some with character-cell comb boxes and coloured bands. These are clean renderings of the paper form, not photographed or skewed scans.
- Pages built as a full-page JPG background with text laid over it (Carter Validus 2011, Monroe 2026).
- A filed PDF whose form text is drawn as outlines with no text layer (Quadriga Superfund 2002: grey side band, boxed fields, logos).
- 1998-2005 plain-text forms: monospaced, dashed and underscored fill lines, `[ ]` and `/ /` tick boxes, `<PAGE>` markers and page numbers like B-3; some are printed from complete submission text files.
- Private-fund subscription booklets (N-2 tender-offer/interval funds and BDC private offerings, 2004-2026): long representations, investor questionnaires (accredited investor, qualified client, ERISA, FATCA/CRS), entity and individual signature pages, power of attorney, and fund acceptance/countersignature blocks.
- LP programs (oil and gas, managed futures, equipment leasing): subscription agreement plus power of attorney signature pages, "RR / FC / AE" broker codes, managing general partner acceptance blocks.
- Seed-capital letter agreements (closed-end funds): one to three pages, "By: / Name: / Title:" blocks for the adviser and the fund.
- An update form for existing investors (Morgan Stanley Spectrum) and an order form style (Carey Credit Income Fund).

## What could not be found

- No photographed or skewed paper scan of a fund subscription agreement turned up. EDGAR full-text search only indexes documents with text, so image-only PDFs cannot be searched for; the picture forms in this set are rendered images of the form.
- EDGAR full-text search starts in 2001. The four 1998-2000 documents came from the quarterly form index and complete submission text files.
