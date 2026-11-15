# Set C: more subscription agreements where the reader is weakest (phase 01.4, D-02, D-21)

308 real subscription agreements from SEC EDGAR, 308 distinct issuers (one document per issuer), none from an issuer
in set-a or set-b (so no issuer-and-sha pair repeats), no two with the same source sha256, near-identical text templates
(word 6-shingle Jaccard over 0.5) kept once. All requests used the generic client identity
`SubDocResearch research-bot@example.org` at no more than 3 requests a second (`../setc-work/scripts/sec.py`).

Each folder `c001` ... `c308` holds `source.<ext>` (the document as filed; for a prospectus appendix the whole
prospectus), the pictures an HTML exhibit uses, `doc.pdf` (what the reader gets) and `meta.json`. `index.json` lists
them (`docs`: id, pdf path, how made, collected as, offering kind, form, year, pages, page content, owner method,
broker-dealer flag, scan-or-picture flag).

## Minimums of the plan (D-02, D-21)

| Kind | Documents | Minimum | Met |
|---|---|---|---|
| scanned or picture-only (scan, picture-print, or collected as a scan) | 55 | 80 | NO |
| broker-dealer-style forms | 84 | 60 | yes |
| filed as born-digital PDF | 51 | 40 | yes |
| landscape or picture prints by the owner's method | 95 | 40 | yes |
| general spread (collected as general) | 89 | 60 | yes |
| total | 308 | 300 | yes |

The kinds overlap (a picture print is also an owner's-method print; some scans are broker-dealer forms); `collected_as`
gives each document exactly one kind: {'scan': 44, 'bd': 75, 'pdf': 50, 'landscape': 50, 'general': 89}.
Filed PDFs with AcroForm fields: 0 (none of the filed PDFs found carries form fields).
Landscape text prints by the owner's method: 50; picture prints by the owner's method: 45.

## How doc.pdf was made

- `filed-pdf`: the PDF as filed (born digital). `scan`: a filed PDF whose pages are page-sized pictures (with or without an OCR layer).
- `picture-print`: an HTML exhibit whose pages are pictures, printed by the owner's method: headless Chromium, Letter,
  landscape, background graphics on, the EDGAR page as served, so each tall page picture splits across PDF pages.
- `browser-landscape`: an HTML or text exhibit printed the same way (owner's method).
- `browser-portrait`: printed portrait Letter, 0.4 in margins, as set-a (some with background graphics, some with the browser header and footer).
- Prospectus appendices (broker-dealer forms) are cut out of the prospectus at the appendix heading and printed portrait.

### How made

| | Documents |
|---|---|
| browser-landscape | 50 |
| browser-portrait | 153 |
| filed-pdf | 51 |
| picture-print | 45 |
| scan | 9 |


### Collected as

| | Documents |
|---|---|
| bd | 75 |
| general | 89 |
| landscape | 50 |
| pdf | 50 |
| scan | 44 |


### Offering kind

| | Documents |
|---|---|
| Regulation A | 39 |
| Regulation Crowdfunding | 52 |
| Regulation D / private placement exhibit | 51 |
| fund or LP/LLC program | 49 |
| non-traded REIT / BDC / interval or registered fund (broker-dealer form) | 75 |
| small-company registered offering (S-1/SB-2) | 42 |


### Filing year

| | Documents |
|---|---|
| 2001-2005 | 42 |
| 2006-2010 | 40 |
| 2011-2015 | 52 |
| 2016-2020 | 73 |
| 2021-2026 | 101 |


### Form of the filing

| | Documents |
|---|---|
| 1-A | 34 |
| 1-A/A | 9 |
| 10-K | 8 |
| 424B3 | 32 |
| 8-K | 63 |
| 8-K/A | 2 |
| C/A | 53 |
| N-2 | 4 |
| N-2/A | 15 |
| POS 8C | 2 |
| POS AM | 14 |
| S-1 | 25 |
| S-1/A | 32 |
| S-11 | 4 |
| S-11/A | 11 |


### Page content

| | Documents |
|---|---|
| mixed | 2 |
| pictures (no text layer) | 40 |
| pictures with a text layer (OCR or hidden text) | 9 |
| real text | 257 |


### Pages in doc.pdf

| | Documents |
|---|---|
| 1 | 1 |
| 2-3 | 34 |
| 4-6 | 47 |
| 7-12 | 65 |
| 13-20 | 75 |
| 21-40 | 63 |
| 41+ | 23 |


## How they were found (scripts in ../setc-work/scripts/, progress and decisions in ../setc-work/progress.jsonl)

- `regawalk.py`: every Regulation A issuer (1-A, 1-A/A, 1-A POS, 2015 Q3 to 2026 Q3) from the quarterly form indexes; the
  filing index page names the subscription agreement exhibit (EX1A-4).
- `cands_hits.py`, `appx.py`: the set-b collector's full-text hits: fund exhibits, and REIT/BDC/fund prospectuses whose
  subscription agreement appendix is found by the set-b appendix rule (`htmlcut.py`).
- `pdfsearch.py`: full-text search for subscription agreements filed as PDF (Regulation Crowdfunding Form C attachments,
  Regulation A and others).
- `picwalk.py`: filings whose main document matched a subscription-agreement query but none of whose exhibits did (an
  exhibit with no text): the filing index page shows PDF exhibits or HTML exhibits made of pictures.
- `dl.py` fetches and screens (as set-a's screen.py: titled as a subscription agreement/booklet/form with a place to sign or
  fill in; executed copies with conformed /s/ signatures, purchase agreements and registration-rights agreements dropped).
  Scans and picture exhibits have no text to screen: each was looked at on a contact sheet of its first pages
  (`sheet.py`, decisions in `scan_review.json`) and kept only if it is a subscription agreement or form.
- `pick_c.py` picks by kind and year band, `build_c.py` copies and prints, `readme_c.py` writes this file.

## What could not be had

- Scanned and picture-only subscription agreements are rare on EDGAR and invisible to full-text search. Every Regulation A
  issuer, every Form C full-text PDF hit and about 5,400 filings found by `picwalk.py` were looked through; 55 were found
  and kept, short of the 80 the plan asks for.
- No filed PDF found carries AcroForm fields.
