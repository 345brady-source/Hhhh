# Writes set-a/README.md from set-a/index.json. Re-run after any rebuild.
import json, os, collections
SET=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','set-a'))
ix=json.load(open(os.path.join(SET,'index.json')))
def band(y):
    y=int(y); return '1998-2000' if y<=2000 else '2001-2004' if y<=2004 else '2005-2008' if y<=2008 else '2009-2012' if y<=2012 else '2013-2015' if y<=2015 else '2016-2018' if y<=2018 else '2019-2021' if y<=2021 else '2022-2026'
def pb(n): return '1' if n==1 else '2-3' if n<=3 else '4-6' if n<=6 else '7-12' if n<=12 else '13-20' if n<=20 else '21-40' if n<=40 else '41+'
def table(title, c, order=None):
    keys = order or sorted(c)
    s=f'\n### {title}\n\n| | Documents |\n|---|---|\n'
    for k in keys:
        if k in c: s+=f'| {k} | {c[k]} |\n'
    return s
C=collections.Counter
notes=C(n for m in ix for n in m['layout_notes'])
pagesum=sum(m['pages'] for m in ix)
out=f"""# Set A: Regulation A, Regulation D exhibits and small-company S-1/SB-2 subscription agreements

{len(ix)} real subscription agreements from SEC EDGAR ({len(set(m['cik'] for m in ix))} distinct issuers, {pagesum} PDF pages in all), collected for phase 01.4 (D-02, D-08, D-10). Funds (N-2, interval funds, BDCs, non-traded REITs, LP/LLC funds) are deliberately excluded; they are set B.

Each folder `a001` ... `a{len(ix):03d}` holds:

- `source.<ext>`: the exhibit exactly as EDGAR serves it (HTML exhibits keep EDGAR's SGML header lines, which a browser shows at the top of the page). Picture files the exhibit refers to sit beside it under their filed names.
- `doc.pdf`: what the reader gets. Filed PDFs are copied as filed; HTML and text exhibits were printed by headless Chromium (Letter, 0.4 in margins, scale 100%) the way a sponsor would print them from a browser.
- `meta.json`: url, cik, issuer, form, file date, exhibit type and description, offering kind, how the PDF was made, print settings, page count, per-page content kinds, layout notes, crude layout features and the source's sha256.

`index.json` lists every meta.json.

## Counts
{table('Filing year', C(band(m['file_date'][:4]) for m in ix))}
{table('Offering kind', C(m['offering_kind'] for m in ix))}
{table('Form of the filing (as EDGAR records it)', C(m['form'] for m in ix))}
{table('Exhibit type', C((m['exhibit'] or 'n/a').split(' ')[0] for m in ix))}
{table('File form as filed', C(m['source_file'].split('.')[-1].upper() for m in ix))}
{table('How doc.pdf was made', C(m['pdf_made'] for m in ix))}
{table('Print options (printed documents only)', C(('background graphics on' if m['print_settings']['background_graphics'] else 'background graphics off')+', '+('headers and footers on' if m['print_settings']['headers_and_footers'] else 'headers and footers off') for m in ix if 'print_settings' in m))}
{table('Page content', C(m['page_content'] for m in ix))}
{table('Pages in doc.pdf', C(pb(m['pages']) for m in ix), ['1','2-3','4-6','7-12','13-20','21-40','41+'])}

## Layouts seen

Counts are of documents whose layout shows the feature (found by simple text and markup checks, then spot-checked by eye on rendered pages).

| Feature | Documents |
|---|---|
""" + ''.join(f'| {k} | {v} |\n' for k,v in notes.most_common()) + """
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
"""
open(os.path.join(SET,'README.md'),'w').write(out)
print('ok', len(out))
