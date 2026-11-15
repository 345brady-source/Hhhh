# Adds the broker-dealer flag to set-c meta.json/index.json and writes set-c/README.md (counts only, no document text).
# broker_dealer (class rule on metadata): collected as a broker-dealer form, or a scan/picture exhibit whose text
# features show a broker-dealer and custodian/IRA block, or whose filing is a fund or LP/LLC program offering.
import json, os, collections
E = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar"
SETC = E + '/set-c'
ixd = json.load(open(SETC + '/index.json'))
ix = ixd['docs']
for d in ix:
    p = os.path.join(SETC, d['id'], 'meta.json'); m = json.load(open(p)); f = m.get('features', {})
    m['broker_dealer'] = m['collected_as'] == 'bd' or (m['collected_as'] == 'scan' and (bool(f.get('brokerdealer') and (f.get('custodian') or f.get('ira'))) or m['offering_kind'].startswith(('fund', 'non-traded'))))
    json.dump(m, open(p, 'w'), indent=2)
    d['broker_dealer'] = m['broker_dealer']
    d['scan_or_picture'] = m['how_made'] in ('scan', 'picture-print') or m['collected_as'] == 'scan'
json.dump(ixd, open(SETC + '/index.json', 'w'), indent=1)
M = [json.load(open(os.path.join(SETC, d['id'], 'meta.json'))) for d in ix]
C = collections.Counter
def band(y): return '2001-2005' if y <= 2005 else '2006-2010' if y <= 2010 else '2011-2015' if y <= 2015 else '2016-2020' if y <= 2020 else '2021-2026'
def pb(n): return '1' if n == 1 else '2-3' if n <= 3 else '4-6' if n <= 6 else '7-12' if n <= 12 else '13-20' if n <= 20 else '21-40' if n <= 40 else '41+'
def table(title, c, order=None):
    s = f'\n### {title}\n\n| | Documents |\n|---|---|\n'
    for k in (order or sorted(c)):
        if k in c: s += f'| {k} | {c[k]} |\n'
    return s
n = len(M)
scanpic = sum(1 for m in M if m['how_made'] in ('scan', 'picture-print') or m['collected_as'] == 'scan')
bdn = sum(1 for m in M if m['broker_dealer'])
pdf_bd = sum(1 for m in M if m['how_made'] == 'filed-pdf')
fields = sum(1 for m in M if (m.get('features', {}).get('fields') or 0) > 0)
owner = sum(1 for m in M if m.get('owner_method'))
owner_land = sum(1 for m in M if m['how_made'] == 'browser-landscape' and m.get('owner_method'))
general = sum(1 for m in M if m['collected_as'] == 'general')
mins = [('scanned or picture-only (scan, picture-print, or collected as a scan)', scanpic, 80),
        ('broker-dealer-style forms', bdn, 60), ('filed as born-digital PDF', pdf_bd, 40),
        ('landscape or picture prints by the owner\'s method', owner, 40), ('general spread (collected as general)', general, 60)]
out = f"""# Set C: more subscription agreements where the reader is weakest (phase 01.4, D-02, D-21)

{n} real subscription agreements from SEC EDGAR, {len(set(m['cik'] for m in M))} distinct issuers (one document per issuer), none from an issuer
in set-a or set-b (so no issuer-and-sha pair repeats), no two with the same source sha256, near-identical text templates
(word 6-shingle Jaccard over 0.5) kept once. All requests used the generic client identity
`SubDocResearch research-bot@example.org` at no more than 3 requests a second (`../setc-work/scripts/sec.py`).

Each folder `c001` ... `c{n:03d}` holds `source.<ext>` (the document as filed; for a prospectus appendix the whole
prospectus), the pictures an HTML exhibit uses, `doc.pdf` (what the reader gets) and `meta.json`. `index.json` lists
them (`docs`: id, pdf path, how made, collected as, offering kind, form, year, pages, page content, owner method,
broker-dealer flag, scan-or-picture flag).

## Minimums of the plan (D-02, D-21)

| Kind | Documents | Minimum | Met |
|---|---|---|---|
""" + ''.join(f'| {a} | {b} | {c} | {"yes" if b >= c else "NO"} |\n' for a, b, c in mins) + f"""| total | {n} | 300 | {"yes" if n >= 300 else "NO"} |

The kinds overlap (a picture print is also an owner's-method print; some scans are broker-dealer forms); `collected_as`
gives each document exactly one kind: {dict(C(m['collected_as'] for m in M))}.
Filed PDFs with AcroForm fields: {fields} (none of the filed PDFs found carries form fields).
Landscape text prints by the owner's method: {owner_land}; picture prints by the owner's method: {owner - owner_land}.

## How doc.pdf was made

- `filed-pdf`: the PDF as filed (born digital). `scan`: a filed PDF whose pages are page-sized pictures (with or without an OCR layer).
- `picture-print`: an HTML exhibit whose pages are pictures, printed by the owner's method: headless Chromium, Letter,
  landscape, background graphics on, the EDGAR page as served, so each tall page picture splits across PDF pages.
- `browser-landscape`: an HTML or text exhibit printed the same way (owner's method).
- `browser-portrait`: printed portrait Letter, 0.4 in margins, as set-a (some with background graphics, some with the browser header and footer).
- Prospectus appendices (broker-dealer forms) are cut out of the prospectus at the appendix heading and printed portrait.
{table('How made', C(m['how_made'] for m in M))}
{table('Collected as', C(m['collected_as'] for m in M))}
{table('Offering kind', C(m['offering_kind'] for m in M))}
{table('Filing year', C(band(m['year']) for m in M))}
{table('Form of the filing', C(m['form'] for m in M))}
{table('Page content', C(m['page_content'].split(':')[0] for m in M))}
{table('Pages in doc.pdf', C(pb(m['pages']) for m in M), ['1', '2-3', '4-6', '7-12', '13-20', '21-40', '41+'])}

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
  issuer, every Form C full-text PDF hit and about 5,400 filings found by `picwalk.py` were looked through; {scanpic} were found
  and kept, short of the 80 the plan asks for.
- No filed PDF found carries AcroForm fields.
"""
open(SETC + '/README.md', 'w').write(out)
print('ok', n, 'scan/picture', scanpic, 'bd', bdn, 'pdf', pdf_bd, 'owner', owner, 'owner landscape', owner_land, 'general', general, 'fields', fields)
