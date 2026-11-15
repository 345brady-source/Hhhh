# Set D: scanned and picture-only subscription agreements (training only)

**Rule: set-d is training only. It is never held out, never measured as a held-out set, and the final fresh draw must
exclude every issuer (CIK) listed in set-d/index.json.**

Collected 2026-11-15. 35 documents, 35 distinct issuers (one document per issuer), 1097 PDF pages.
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
through ../setd-work/scripts/sec.py (in-process gap plus the fixed file lock): 17440 requests, at most 3 in any
one-second window.

## Layout

Each folder `d001` ... `d035` holds `source.<ext>` (the exhibit as filed), the page pictures an HTML exhibit uses,
`doc.pdf` (what the reader gets) and `meta.json` (set-c's fields plus `kind`, `found_by`, `layout_notes`). `index.json`
lists them with set-c's index fields plus `kind`, `cik`, `issuer`, `source_sha256`, `doc_sha256`.

- `picture-print`: an HTML exhibit made of page pictures (scans), printed as set-c printed its picture exhibits, by the
  owner's method: headless Chromium, Letter, landscape, background graphics on, 0.4 in margins.
- `scan`: a filed PDF whose pages are pictures with no text layer, copied as filed.

## Counts

| Kind | Documents |
|---|---|
| picture-only HTML exhibit (page pictures) printed by the owner's method | 34 |
| scanned PDF (page pictures, no usable text layer) | 1 |

| Decade filed | Documents |
|---|---|
| 2000s | 16 |
| 2010s | 12 |
| 2020s | 7 |

| Form of the filing | Documents |
|---|---|
| 8-K | 31 |
| 8-K/A | 1 |
| S-1 | 1 |
| S-1/A | 1 |
| SB-2/A | 1 |

| How made | Documents |
|---|---|
| picture-print | 34 |
| scan | 1 |

Broker-dealer-style forms among them: 2. Page content of every doc.pdf: {'pictures (no text layer)': 35}.

## Sources tried (scripts in ../setd-work/scripts, log in ../setd-work/progress.jsonl)

Full-text search cannot see a picture exhibit, so each source is a list of filings whose main document mentions a
subscription agreement (EDGAR full-text search, every year 2001-2026) but none of whose agreement exhibits matched; each
filing index was opened and an EX-10/EX-4/EX-99 exhibit kept for a look when it was a PDF made of page pictures, or an HTML
exhibit of under 12 KB in a filing holding page pictures, with under about 25 words a picture.

| Source | Filings in list | Filings opened | Picture-only candidates | Kept | Kept per filing opened |
|---|---|---|---|---|---|
| Form C issuers (first Form C filing index) | all Form C issuers (9,107 eligible), seeded sample | 120 | 0 | 0 | 0.0 % |
| 8-K, main document says "subscription agreement", no exhibit matched | 3611 | 2813 | 43 | 25 | 0.89 % |
| 8-K, main document says "subscription agreements", no exhibit matched | 3517 | 1848 | 12 | 4 | 0.22 % |
| 8-K item 1.01/3.02, main document says "subscription", no exhibit matched | 2266 | 1589 | 21 | 0 | 0.0 % |
| 8-K, main document says "subscription agreement(s)", only press-release (EX-99) exhibits matched | 480 | 427 | 3 | 0 | 0.0 % |
| 8-K, an exhibit itself matched "subscription agreement(s)" (smaller filing agents only) | 6287 | 1000 | 6 | 3 | 0.3 % |
| SB-2 (and /A), no exhibit matched | 5673 | 1500 | 13 | 1 | 0.07 % |
| S-1 (and /A), no exhibit matched | 17080 | 1500 | 15 | 2 | 0.13 % |
| 10-Q, no exhibit matched | 22721 | 1773 | 13 | 0 | 0.0 % |
| **Total** | | **12570** | | **35** | |

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
