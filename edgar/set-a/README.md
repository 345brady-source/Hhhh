# Set A: Regulation A, Regulation D exhibits and small-company S-1/SB-2 subscription agreements

110 real subscription agreements from SEC EDGAR (110 distinct issuers, 1607 PDF pages in all), collected for phase 01.4 (D-02, D-08, D-10). Funds (N-2, interval funds, BDCs, non-traded REITs, LP/LLC funds) are deliberately excluded; they are set B.

Each folder `a001` ... `a110` holds:

- `source.<ext>`: the exhibit exactly as EDGAR serves it (HTML exhibits keep EDGAR's SGML header lines, which a browser shows at the top of the page). Picture files the exhibit refers to sit beside it under their filed names.
- `doc.pdf`: what the reader gets. Filed PDFs are copied as filed; HTML and text exhibits were printed by headless Chromium (Letter, 0.4 in margins, scale 100%) the way a sponsor would print them from a browser.
- `meta.json`: url, cik, issuer, form, file date, exhibit type and description, offering kind, how the PDF was made, print settings, page count, per-page content kinds, layout notes, crude layout features and the source's sha256.

`index.json` lists every meta.json.

## Counts

### Filing year

| | Documents |
|---|---|
| 1998-2000 | 6 |
| 2001-2004 | 8 |
| 2005-2008 | 13 |
| 2009-2012 | 10 |
| 2013-2015 | 15 |
| 2016-2018 | 24 |
| 2019-2021 | 18 |
| 2022-2026 | 16 |


### Offering kind

| | Documents |
|---|---|
| Regulation A | 33 |
| Regulation D / private placement exhibit | 36 |
| small-company registered offering (S-1/SB-2) | 41 |


### Form of the filing (as EDGAR records it)

| | Documents |
|---|---|
| 1-A | 1 |
| 1-A/A | 32 |
| 8-K | 10 |
| 8-K/A | 26 |
| S-1/A | 24 |
| SB-2 | 6 |
| SB-2/A | 11 |


### Exhibit type

| | Documents |
|---|---|
| EX-1 | 1 |
| EX-1.1 | 3 |
| EX-10 | 11 |
| EX-10.1 | 21 |
| EX-10.12 | 2 |
| EX-10.16 | 1 |
| EX-10.2 | 2 |
| EX-10.3 | 5 |
| EX-10.4 | 1 |
| EX-10.5 | 1 |
| EX-10.6 | 1 |
| EX-10.7 | 1 |
| EX-10.82 | 1 |
| EX-20 | 1 |
| EX-3.3 | 3 |
| EX-3.7 | 1 |
| EX-4.1 | 3 |
| EX-4.2 | 2 |
| EX-4.6 | 1 |
| EX-96 | 1 |
| EX-99 | 6 |
| EX-99.1 | 6 |
| EX-99.2 | 2 |
| EX-99.3 | 1 |
| EX1A-4 | 30 |
| EX1A-6 | 1 |
| n/a | 1 |


### File form as filed

| | Documents |
|---|---|
| HTM | 82 |
| PDF | 12 |
| TXT | 16 |


### How doc.pdf was made

| | Documents |
|---|---|
| filed-pdf | 8 |
| printed-landscape | 15 |
| printed-portrait | 83 |
| scanned | 4 |


### Print options (printed documents only)

| | Documents |
|---|---|
| background graphics off, headers and footers off | 59 |
| background graphics off, headers and footers on | 29 |
| background graphics on, headers and footers off | 6 |
| background graphics on, headers and footers on | 4 |


### Page content

| | Documents |
|---|---|
| mixed: 34 text, 11 little or no text, 33 picture | 1 |
| pictures (no text layer) | 4 |
| pictures with a text layer (OCR or hidden text) | 4 |
| real text | 62 |
| real text (some pages blank or nearly blank) | 37 |
| real text (some pages blank or nearly blank) with some picture pages | 1 |
| real text with some picture pages | 1 |


### Pages in doc.pdf

| | Documents |
|---|---|
| 1 | 3 |
| 2-3 | 22 |
| 4-6 | 13 |
| 7-12 | 24 |
| 13-20 | 21 |
| 21-40 | 22 |
| 41+ | 5 |


## Layouts seen

Counts are of documents whose layout shows the feature (found by simple text and markup checks, then spot-checked by eye on rendered pages).

| Feature | Documents |
|---|---|
| underscore fill-in lines | 84 |
| fill-in lines drawn as table cell borders | 64 |
| issuer acceptance / countersignature block | 63 |
| joint / co-owner registration options | 48 |
| investor questionnaire | 39 |
| heavily table-based layout | 24 |
| tick boxes as Unicode box characters | 19 |
| plain-text exhibit (monospace when printed) | 16 |
| tick boxes as Wingdings characters | 13 |
| entity signature block | 10 |
| pre-2001 filing: the exhibit is a document inside the complete submission text file (url); source.txt is that document's text as filed | 6 |
| filed as page pictures inside an HTML exhibit (scanned executed copy: entries and signatures already filled in by hand) | 3 |
| scanned pages with an OCR text layer | 2 |
| signature and fill-in lines are thin line pictures | 2 |
| subscription agreement with one named subscriber, blank signature lines for subscriber and company | 1 |
| scanned pages with an OCR text layer (OCR errors in the text) | 1 |
| one-page subscription form, underscore tick blanks | 1 |
| tick boxes drawn as small pictures | 1 |
| unofficial PDF copy filed alongside the official exhibit | 1 |
| scanned pictures, no text; one page has rotated text | 1 |
| bank conversion offering mailing packet: designed stock order form and certification among letters and Q&A | 1 |

What these mean for the reader:

- **Signature and fill-in lines** come as underscores in text, as table-cell borders (top or bottom), as short `<hr>` rules, as tiny line pictures (a106 ECRID, Asiafin), and in plain-text exhibits as underscore runs in monospace.
- **Tick boxes** come as Wingdings characters, Unicode boxes, `[ ]` in text, underscore blanks before a word (`__ joint tenants`), and as small box pictures (a012 True Leaf).
- **Signature pages** range from one name-and-signature line to multi-column blocks for individual, joint, entity and custodian subscribers, with notary blocks (Allin), issuer acceptance/countersignature, and broker-dealer "office use" boxes (Alphacom).
- **Pictures:** HTML exhibits made only of page pictures (a057 Probe, a059 Toga, a060 Webstar: scanned executed copies already filled in by hand; printed in landscape, so each tall page picture splits across two PDF pages, as in the owner's file), page pictures with a hidden text layer (a066 Wejo), filed PDFs that are scans with an OCR layer (a006 Bofat, a008 Viva, a009 Alliance), and a scan with no text at all, including a page with rotated text (a078 Stratabid).
- **Background graphics:** with it on, some EDGAR pages print on a grey ground (for example a005); the ten documents marked `background_graphics: true` were picked from those that set a background colour.
- **Headers and footers:** about a third of the printed PDFs carry the browser's date/title header and URL/page-number footer, as Chrome adds them by default.
- **Blank and nearly blank pages** happen where the HTML forces page breaks or a tall picture spills over; they are kept, because a sponsor's print would have them too.
- Styles range from 1-page forms (a tick list and a signature) to 40-page institutional PIPE agreements and 97-page printed exhibits, from 1998 plain-text SB-2 exhibits to 2026 Regulation A forms.

## What could not be had

- EDGAR full-text search starts in 2001. The six 1998-2000 documents were found by walking EDGAR's quarterly form indexes and opening SB-2 complete submission files. For those, `source.txt` is the exhibit's own text taken out of the submission file named in `url`.
- PDF exhibits are rare in these filing kinds (EDGAR took PDF only as an unofficial copy until Regulation A+ in 2015). 12 filed PDFs were found; 4 of them are scans.
- Unsigned scans in HTML are rare. The three picture-only HTML exhibits found are executed copies (entries and signatures filled in). They are kept because their pages carry the same printed lines and boxes.
- EDGAR's search ranking favours amendments (1-A/A, 8-K/A, S-1/A), so most filings in the set are amendments. The agreements themselves are complete.

## How to get more of each kind

The scripts are in `../seta-work/scripts/`. All of them identify themselves only as `SubDocResearch research-bot@example.org` and wait at least 0.34 s between requests (`sec.py`). Run them with `python3 -I` from any folder.

1. `harvest.py`: EDGAR full-text search over queries × form groups × date bands, appending hits to `cands.jsonl`. To get more, add queries, forms or bands, or page with `from=100,200,...` (as `pdfhunt.py` does).
2. `select_cands.py`: filters to exhibit files, drops funds (by name and SIC), and makes a stratified shortlist (`shortlist.json`). Raise `take>=22` for more per stratum.
3. `download.py <list.json> <out.jsonl>`: fetches each exhibit and the pictures it uses into `raw/`, and records layout features.
4. `screen.py`: keeps documents titled as a subscription agreement that have a place to sign or fill in, and drops executed copies with conformed `/s/` signatures.
5. `pick.py`: picks by quota per offering kind and year band, at most 2 per issuer, drops near-duplicate templates (word-shingle Jaccard > 0.5), and favours layout combinations not yet in the set.
6. Kind-specific finders: `pdfhunt.py` (PDF exhibits through full-text search), `regapdf.py` (walks 1-A filing indexes for PDF exhibits, including scans that search cannot see), `scanhunt.py` (finds filings whose exhibits are page pictures), `oldtxt.py` (1998-2000 SB-2 submissions).
7. `assemble.py` → `chosen.json`, then `build.py chosen.json` (copies, prints with `print.js`, writes meta and index), `pages.py` (per-page text/picture/blank analysis), `readme.py` (this file).

To grow the set, start numbering after the last folder (`build.py` numbers from 1, so append to `chosen.json` or change its start), and keep the same rules: at most 3 per issuer, no funds, exhibits only, varied layouts.
