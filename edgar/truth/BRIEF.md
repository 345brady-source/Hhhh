# Answer-sheet brief — Phase 01.4 held-out set

You write exact answer sheets for real subscription agreements from EDGAR. They are the held-out test the portal's reader is judged on (frozen in `SCRATCH/edgar/held-out.json`; never used to tune rules or train models). A wrong answer sheet is worse than a slow one. These are public filings, but nothing goes into the repository.

SCRATCH = `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad`.
Documents: `SCRATCH/edgar/set-a/<id>/doc.pdf` and `SCRATCH/edgar/set-b/<id>/doc.pdf` (meta.json beside each), and `SCRATCH/edgar/d1/doc.pdf` (the owner's failing file: a browser print of the EDGAR page in landscape; form pages are pictures split across two PDF pages; white boxes on grey).
Write each sheet to `SCRATCH/edgar/truth/<id>/truth.json` plus `truth-overlay-pNN.png` for each page that has places, and `truth.md` (counts per page, how sure, anything doubtful).

## Format (same as the owner's document C sheet, `SCRATCH/owner-set/C/truth.json`; read it and its builder `build_truth.py`, `geom.py`, `cells.py` for how boxes are measured)
`{ "file", "pages", "page_size_pt", "coordinates": "PDF points, origin top-left", "signing": { "investor_pages", "firm_pages", "co_investor": bool, "third_parties": [...], "kind": "who signs this document" }, "counts_per_page", "counts_total", "counts_by_owner", "sure_per_page", "not_fields": { "<page>": ["what must NOT get a field"] }, "places": [ ... ], "may_fill": [ids] }`
Each place: `id`, `page`, `kind` (`tickbox`, `initials`, `blank`, `signature`, `date` only for a date beside a signature), `what` for blanks (amount, percentage, email, phone, tax number, address, name, title, text, date), `owner` (`investor`, `investor-individual`, `investor-entity`, `co-investor`, `firm`, `third-party`, `unclear`), `label` (your words), `printed_label` (the document's own short label words, if printed), `must` (a person must complete it, true/false), `x0,y0,x1,y1` (the printed blank: the underscore run or drawn rule with the writing room above it, the printed square, the cell, the form widget; exact to 1 pt on text pages, from the PDF's own geometry — `pdfplumber`/`pypdf`/`pdftotext -bbox-layout` are installed), `printed_as`, and `doubt` when you are not sure.

## Rules
- Every place a person is meant to complete gets an entry; nothing else does. Not fields: decorative rules, underlined headings, table frames, footers, bracketed text the issuer completes before sending (e.g. [Name of Fund]), blanks already filled in, places for the issuer's lawyer before execution, signatures already made (on executed copies: the printed place still counts, mark `doubt: "executed copy"`).
- Picture pages: measure boxes from the picture's own pixels at its resolution, converted to PDF points through how the picture is drawn on the page (read the page's drawing matrix; for a picture split across two PDF pages, each PDF page shows only part of it — record places on the PDF page where they appear, and a place cut by the page break on BOTH pages with `doubt: "split by page break"`).
- Owner: decided from the document's own headings and captions (investor's block, joint/co-subscriber block, entity block, the issuer's acceptance block = firm, custodian / broker-dealer / adviser / notary / witness = third-party, "for office use only" = third-party). Individual vs entity only where the document separates them.
- Draw every sheet over its pages (`pdftoppm -r 100`) and LOOK at the overlays: boxes must sit on the printed places. Fix and redraw until they do.
- Write no personal email address anywhere; never print one. If a document prints personal data (executed copies), do not copy it into the sheet.
- Return a short report: per document, places total by kind and owner, how sure, and any document you could not do and why.

## Conventions settled by the orchestrator (2026-11-15), apply to every sheet
- Blanks the issuer completes before the agreement is sent (prospectus or offering-circular date, closing date, offering amount in the recitals, deal terms in a two-party agreement), bracketed or not, are NOT places: list them under not_fields. The owner's rule: only the fields a signer must fill in.
- A line or digit comb cut by a page break or a printed line wrap: one place per piece, each with the doubt "split by page break" / "split by line wrap".
- A datum printed in segments on one line (area code and number, a hyphenated tax number, month/day/year boxes) is ONE place with its segments under `parts` when the tool supports it, otherwise one place covering the whole run.
- Choices with no printed box (circle one, a word list with "check one"): tick-box places with a doubt.
- "For office / internal / partnership / company use only" blocks: third-party with firm also accepted; the issuer's acceptance signature inside one is firm.
- Labels are not judged (owner, D-24); write them anyway, briefly.
- Exhibits that are separate instruments: places only if the exhibit is signed by the subscriber at the same closing (e.g. an escrow or joinder agreement with blank subscriber blocks). Not places: exhibits already signed (/s/), blanks the issuer fills, and forms used only on a later event (conversion, exercise, assignment, redemption request).
- A place a person must fill that has no printed line (a gap before a period, an empty cell under a column heading): a place, with a doubt naming the missing line.

### Further conventions settled by the orchestrator (2026-11-15, after PS01)
- A box the issuer printed already checked is not a place (like an issuer-filled blank). Empty boxes in the same choice stay places, with a doubt.
- Custodian and broker-dealer blocks are third-party; a row captioned only "Broker/Dealer" or "Account Executive" is a name blank with a doubt.
- A tax or status certificate the subscriber signs as part of the same subscription package (even if dated before closing) counts, with must=false where the form says it is only for some holders; recital blanks whose filler is not printed are owner unclear with a doubt.
