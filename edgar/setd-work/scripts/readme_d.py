# Write set-d/README.md from set-d/index.json, setd-work/stats.json and the request log.
import json, os, collections
W = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work'
S = os.path.dirname(W) + '/set-d'
docs = json.load(open(S + '/index.json'))['docs']; st = json.load(open(W + '/stats.json'))
reqs = [json.loads(l)['start'] for l in open(W + '/progress.jsonl') if '"ev": "req"' in l]
reqs.sort(); mx = j = 0
for i in range(len(reqs)):
    while reqs[i] - reqs[j] >= 1.0: j += 1
    mx = max(mx, i - j + 1)
def tab(c, h):
    return f'| {h} | Documents |\n|---|---|\n' + ''.join(f'| {k} | {v} |\n' for k, v in sorted(c.items()))
dec = collections.Counter(f"{d['year'] // 10 * 10}s" for d in docs)
kind = collections.Counter(d['kind'] for d in docs)
form = collections.Counter(d['form'] for d in docs)
pages = sum(d['pages'] for d in docs)
rows = ''.join(f"| {v['source']} | {v['list_size'] if v['list_size'] is not None else 'all Form C issuers (9,107 eligible), seeded sample'} | {v['opened']} | {v['candidates']} | {v['kept']} | {v['yield_pct']} % |\n" for t, v in st.items())
opened = sum(v['opened'] for v in st.values())
txt = f"""# Set D: scanned and picture-only subscription agreements (training only)

**Rule: set-d is training only. It is never held out, never measured as a held-out set, and the final fresh draw must
exclude every issuer (CIK) listed in set-d/index.json.**

Collected 2026-11-15. {len(docs)} documents, {len(docs)} distinct issuers (one document per issuer), {pages} PDF pages.
Short of the 100 asked for: collection stopped because every remaining source measured at or under about 0.3 % kept per
filing opened (table below).

Every document is the subscription agreement itself (or the subscription booklet), with its signature page, and its pages
are pictures: the PDF text layer is near zero (at most 81 characters on any page, which is the EDGAR exhibit tag line on
page 1; 2 to 4 characters a page on average). Each was looked at on a contact sheet (first, second and last page) and,
where the signature page was not on the sheet, on a grid of every page (decisions in ../setd-work/review.json).

None comes from an issuer in set-a, set-b or set-c, and no source or doc.pdf sha256 equals one recorded for those sets.
Issuers and hashes were taken from set-a/index.json and set-b/index.json; set-c/index.json has no CIK or hash field, so its
ids were mapped to CIK and source sha256 through the set-c collector's pick list (../setc-work/chosen.json, outside set-c).
No file inside set-a, set-b, set-c, truth or a held-out document was opened. Filings the set-c collector had already
opened (6,877) and all 1,803 Regulation A issuers it walked were not reopened.

All requests used the generic identity `SubDocResearch research-bot@example.org`, from one collection process at a time,
through ../setd-work/scripts/sec.py (in-process gap plus the fixed file lock): {len(reqs)} requests, at most {mx} in any
one-second window.

## Layout

Each folder `d001` ... `d{len(docs):03d}` holds `source.<ext>` (the exhibit as filed), the page pictures an HTML exhibit uses,
`doc.pdf` (what the reader gets) and `meta.json` (set-c's fields plus `kind`, `found_by`, `layout_notes`). `index.json`
lists them with set-c's index fields plus `kind`, `cik`, `issuer`, `source_sha256`, `doc_sha256`.

- `picture-print`: an HTML exhibit made of page pictures (scans), printed as set-c printed its picture exhibits, by the
  owner's method: headless Chromium, Letter, landscape, background graphics on, 0.4 in margins.
- `scan`: a filed PDF whose pages are pictures with no text layer, copied as filed.

## Counts

{tab(kind, 'Kind')}
{tab(dec, 'Decade filed')}
{tab(form, 'Form of the filing')}
{tab(collections.Counter(d['how_made'] for d in docs), 'How made')}
Broker-dealer-style forms among them: {sum(d['broker_dealer'] for d in docs)}. Page content of every doc.pdf: {dict(collections.Counter(d['page_content'] for d in docs))}.

## Sources tried (scripts in ../setd-work/scripts, log in ../setd-work/progress.jsonl)

Full-text search cannot see a picture exhibit, so each source is a list of filings whose main document mentions a
subscription agreement (EDGAR full-text search, every year 2001-2026) but none of whose agreement exhibits matched; each
filing index was opened and an EX-10/EX-4/EX-99 exhibit kept for a look when it was a PDF made of page pictures, or an HTML
exhibit of under 12 KB in a filing holding page pictures, with under about 25 words a picture.

| Source | Filings in list | Filings opened | Picture-only candidates | Kept | Kept per filing opened |
|---|---|---|---|---|---|
{rows}| **Total** | | **{opened}** | | **{len(docs)}** | |

Notes:
- Filings by the large filing agents (Donnelley, Toppan Merrill, EdgarAgents, Workiva and similar) gave 0 kept of 3,048
  opened, and self-filed filings 1 of 745; later walks skipped both. The 8-K "subscription agreement" list is worked out for
  the smaller agents (up to 4 filings per issuer); what is left of it is large-agent filings.
- Form C: of 120 issuers sampled, 1 filing names a subscription agreement attachment; most attach one bundled offering
  PDF or unnamed `document_N.pdf` files of several MB, so a subscription agreement cannot be targeted without downloading
  every attachment. Stopped.
- 10-K: not walked; the set-c collector measured it under 0.3 % on about 2,000 filings.
- The rejected candidates were mostly other scanned agreements (purchase, consulting, employment, lease, notes,
  certificates of designation, stock certificate specimens, presentations).
- Remaining at about 0.3 %: the 8-K list where an exhibit matched (8ke) has about 5,300 filings unopened (3 kept of 1,000).
"""
open(S + '/README.md', 'w').write(txt); print(txt[:400])
