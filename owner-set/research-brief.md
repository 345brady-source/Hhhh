# Research brief — Phase 01.3, one document per researcher

Three researchers work at the same time, one per document. You take the ONE document named in your prompt. Read first:

- `/home/user/Hhhh/CLAUDE.md` (the owner's rules; usage is limited: work economically, about 40 minutes, experiments over reading)
- `/home/user/Hhhh/.planning/phases/01.3-the-owner-s-text-agreements-are-read-100-percent/01.3-CONTEXT.md` (USER DECISIONS — locked; the owner's words: "i need you to get 100% correct on all of these")
- `/home/user/Hhhh/.planning/REQUIREMENTS.md` (SET-01 to SET-04) and `/home/user/Hhhh/.planning/STATE.md`

Scratchpad root (everything outside the repository): `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad` — called SCRATCH below.

## The documents (confidential)
- Document A: `SCRATCH/owner-set/reszi.pdf` — 21-page subscription document, made by Word with a PDF maker.
- Document B: `SCRATCH/owner-set/shp-lpa.pdf` — 32-page limited partnership agreement, same maker.
- Document C: `SCRATCH/owner-set/cascara.pdf` — 10 pages, made here by a word processor from the owner's Word file `cascara.docx` (subscription agreement with accredited investor questionnaire).

They are the owner's real documents. Never copy them or pictures of them into the repository. In your research file, and in anything committed, write NO text from them: refer to the document by its letter and to places by page and kind ("page 14, signature line for an entity's authorised signatory"). In your own scratch files you may record labels.

## What the portal does
A static vanilla-JS investor portal at `/home/user/Hhhh`. A sponsor uploads a subscription agreement PDF; the portal reads it and places e-signature fields: `assets/js/anchors.js` (characters, drawn rules, rectangles and form fields from pdf.js operator lists → printed places), `assets/js/placement.js` (places → fields: label, kind, signer, individual/entity, co-investor role `'co'`, fill-in from onboarding, review marks, the read summary), the reading adapter and upload dialog in `assets/js/esign.js`. Rules it must obey: a field only on a printed place (blank line, tick box, signature line, form field); every printed place gets its field; an unclear one is marked for review, never dropped silently; investor block and firm (countersignature) block recognised separately; individual and entity blocks told apart; a second investor's places are the co-investor's; third parties (witness, notary, spouse, adviser) are optional and marked; nothing fitted to one document — every rule is a convention class.

## Your three deliverables

### 1. The answer sheet for your document (independent of the portal)
In `SCRATCH/owner-set/<letter>/` write `truth.json` and `truth.md`. Render every page (`pdftoppm -r 100 -png`) and LOOK at each one. List every printed place a person is meant to complete: `id`, `page`, `kind` (`tickbox`, `initials`, `blank`, `signature`, `date` only for a date beside a signature), finer `what` (amount, percentage, email, phone, tax number, address, name, title, text), `owner` (`investor`, `investor-individual`, `investor-entity`, `co-investor`, `firm`, `third-party`, `unclear`), a short label in your own words, whether a person must complete it or it is optional, and its box in PDF points, origin top-left, exact to 1 pt: `x0,y0,x1,y1` of the printed blank (the underscore run or drawn rule; for a tick box the printed square). Get boxes from the PDF itself, not by eye: `pdftotext -bbox-layout` for underscore runs and box characters; drawn rules and rectangles from the content stream (python `pypdf` is installed) — then match to what you see. Also list, per page, what must NOT get a field (rules that decorate or separate, underlined headings, footers, table frames, bracketed text the sponsor completes before sending, blanks already filled in). State for the whole document: is there an investor signature block (pages), a firm block (pages), places for a second investor, third parties; and what kind of document it is for signing purposes (who signs it). Give counts per page and total, and how sure you are per page. Draw the answer sheet over the pages (`truth-overlay-pNN.png`) and look at the overlays to confirm boxes sit on the printed places. This is the most important deliverable: 100% is judged against it, so a wrong answer sheet is worse than a slow one.

### 2. What the portal does with it today
Upload the document through the real upload dialog and read the placed fields back from the editor. Helpers exist: `SCRATCH/build/proof/proof.js` (its helpers are importable; see how `SCRATCH/build/proof/score-notext.js` imports them, uploads a PDF as a sponsor, reads fields — page, box, kind, signer, required, review mark, label — matches them to an answer sheet and draws compare pictures). Write your own small scorer `SCRATCH/owner-set/<letter>/score.js` on that model (do not edit the shared files), serve the repository yourself on the port given in your prompt and stop the server after, one browser at a time (run as `NODE_PATH=$(npm root -g) node score.js`). Record: places with a field, places without (listed), fields on no place (listed with boxes), kind differences, owner differences, overlaps, fields marked for review, the exact read-summary sentence, edge distances, and one editor picture per page with the answer sheet drawn over it (found green, missed red, strays orange). Look at every compare picture.

### 3. Why, and what would fix it
For every difference, the cause in the reader (file and function, the rule that fired or did not) and the convention class it belongs to ("a blank after a label in a table cell", "a signature line whose caption is in the line below in small capitals", "a tick box drawn as a symbol-font character"), and the change that would fix that class without breaking documents the reader already reads. Check each proposed change against the rule "never fitted to one document". Do not change application code and do not commit.

## Your research file
Write `/home/user/Hhhh/.planning/phases/01.3-the-owner-s-text-agreements-are-read-100-percent/01.3-RESEARCH-<letter>.md` with: Summary (score today in one table), What kind of document this is for signing, Differences by convention class (cause → fix), Things that already work, Risks to other documents, Open questions for the owner (only real ones), and `## Validation Architecture` (the command that scores this document against its answer sheet, what PASS means: every place found, zero strays, zero overlaps, zero kind and owner differences, marked only where the answer sheet says a place is unclear or a third party's; and when it runs). No text from the document in this file.

Never print, use or send any personal email address. Return a short report: the answer sheet's totals, the score today, the convention classes that fail, and anything you could not do.
