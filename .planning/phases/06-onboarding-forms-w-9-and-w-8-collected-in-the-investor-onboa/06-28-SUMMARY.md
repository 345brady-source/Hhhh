---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 28
subsystem: offering intake (built-in reader path) and the offering's agreement dialog
status: complete
tags: [d-11, content-recognition, intake, agreement-dialog, d-44, d-46, quick-task]
requires: [06-CONTEXT D-11, 01.4 D-44 (readPart), 01.4 D-46 (tax forms)]
provides:
  - NS.intake.recognise(pages) -> { kind agreement | combined | none, firstPage, lastPage, pages, score }
  - NS.intake.recogniseFile(blob) (text layer; a mostly-picture file has up to 5 pages read by NS.textengine)
  - NS.intake.agreementChoice(docs), NS.intake.cutPages(blob, a, b), NS.intake.REC_VERSION; ws.docs[].recognised
  - intake without a reading server: whole agreement prepared as before; agreement inside a combined file cut and read in the background (D-44 path)
  - agreement dialog: pre-selection by content, reading of stored documents when it opens, "Its pages a to b read as the subscription agreement", a combined file gives only those pages
  - the file-name rule removed (AGREEMENT_NAME, NS.intake.agreementName)
affects: [owner check of the intake and the agreement dialog]
tech-stack:
  added: []
  patterns:
    - "documents are recognised from page text, never from file names; the decision (not the text) is kept on the document"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/recognition-measure.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-28-SUMMARY.md
  modified:
    - assets/js/intake.js
    - assets/js/esign.js
    - .planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/checks/agreement-name.js
decisions:
  - "With a reading server (automatic reading) its answer decides exactly as before: no agreement in the answer, or the sponsor unticking it, means none is prepared. Before this plan the name rule ran as a fallback after automatic reading; that fallback is gone with the name rule, not replaced by content"
  - "Recognition runs on the text layer the intake already extracts; picture pages are read by the built-in reader only when at least half the file's pages carry no text, at most 5 pages per file (the first ones and the last one), so a PPM with a few chart pages never waits for picture reading"
  - "A file is 'combined' only when another document is visible outside the agreement pages (offering headings, another document's title and the pages after it, issuer 'we' pages beyond 15 percent of the file); otherwise the whole file is the agreement and is used as uploaded (no cut)"
  - "The dialog keeps what it decides on the document (ws.docs[].recognised, decision only, no page text) and saves the workspace once after reading"
metrics:
  completed: 2026-11-16
  duration: "base commit 05:45 UTC, RED commit 06:22 UTC, last code commit 06:59 UTC"
  tasks: 3
actuals:
  tokens: 18500
  tasks: 3
  commits: 4
plan_head_before: 154ee2dcfacd5cff9f03616641232641b9e8e98b
plan_head_after: 9a635c8532f690ae0845bf089b195f1a81f33736
---

# Phase 6 Plan 28: documents recognised by content, never by file name (D-11) Summary

The intake without a reading server and the agreement dialog now decide which PDF is the subscription agreement, and
which pages of a PPM or offering circular are, from what the pages say. The same bytes under any name give the same
result; the file name is shown, never read.

## Failures first

Measured on documents the rules were not tuned on (held-out agreements, and downloads set aside by issuer before tuning):

1. **c241 (held-out agreement, 19 pages) is read as "part of a file", pages 1 to 1.** The intake would cut it to its first
   page and lose 18 pages of the agreement. Only one such case among 88 held-out text agreements.
2. **6 held-out text agreements are not recognised**: a083 (24 pages), b002 (11), b035 (2), b052 (10), b105 (8), c007 (14).
   a054 (19) is also missed, but the held-out file itself records it as "not a subscription form (a registration rights
   agreement)".
3. **1 held-out picture-only agreement is not recognised**: c024 (23 pages), after its pictures were read.
4. **c27 was labelled a non-agreement before tuning and is recognised (pages 24 to 43).** Looking after the run: pages 26
   to 36 are a Common Stock Purchase Agreement used as the subscription form ("the subscription described therein"),
   followed by an investors' rights agreement. The label was wrong; the range found is 2 pages early and 7 late.
5. **Combined files: the range is exact in 12 of 20.** Off: c18 starts 7 pages late (the subscription instructions pages
   are left out), p06 starts 3 early, c25 ends 4 late (a services contract after the agreement kept), c01, c12, c38 end 1
   early, c39 1 off at each end; p07 (a 5-page PPM with its subscription booklet) is read as a whole agreement, so it
   would not be cut.
6. **Ambiguous files** (reported apart, labelled before tuning as neither): c15, an offering circular whose exhibits hold
   two note subscription agreements, is read as a whole agreement (pages 21 to 43 of 77): the whole 77-page file would
   be used as the agreement. c41 (a supplement that is almost all subscription forms) the same, c37 (a rights card) none.
7. **Not measured:** picture-only non-agreements (a scanned PPM) and a text PPM with a scanned agreement inside (picture
   pages are read only when at least half the file is pictures, so that agreement would not be found).
8. **Unchanged limit, outside this plan's files:** a picture-only PDF uploaded alone to the intake without a reading
   server still stops at "No readable text was found" (console.js decides that before any recognition).
9. Server tests in this worktree fail 23 of 191 without `server/node_modules` (no SDK installed in the worktree); with the
   main checkout's `node_modules` linked in for the run: 191 of 191 pass. The link was removed after.

## Measurements

Rules tuned only on set-a..d agreements that are not held out and on this plan's tune downloads. Final numbers are on
documents never used for tuning: the held-out ids (held-out.json, held-out-b.json) and the downloads whose split
(a fixed hash of the issuer's CIK, set before any download was opened) is "final". Combined ranges were labelled by hand
from page text before the recogniser existed. EDGAR's own header lines (SGML tags and the exhibit tag line, which carry
the filer's label for the file, like a file name) are removed before reading.

| Class (final, unseen) | Result |
|---|---|
| Agreements, text layer (held-out) | **81/88** recognised (80 as the whole file, 1 as part of a file: c241, wrong) |
| Agreements, picture-only (held-out, pictures read by the built-in reader in the browser) | **14/15** recognised, all as the whole file; 4 to 64 s per file |
| Non-agreements (12 offering circulars or supplements, 1 PPM, 4 operating agreements, 1 prospectus supplement) | **1/18** wrongly recognised (c27, label wrong, see failure 4) |
| Combined files (offering circulars, PPMs, 424B prospectuses and 10-K/10-Q filings with the agreement inside) | agreement found **20/20**; range exact **12/20**; within 1 page at both ends 16/20; largest page error 7 (first page of c18) |

Tune set (seen while tuning, for comparison): agreements 390/404 (text), non-agreements wrongly recognised 0/28,
combined found 11/11 with 9 exact; picture-only set-d and picture set-c agreements 26/31 recognised (the run of 59
stopped at 31 when my measuring script ran out of memory passing large PDFs; the held-out picture run used a fixed
script).

Check documents (public, used by the agreement-name check, so seen): RockStep Hometown America Fund I PPM none; Worcester
Fund PPM none; Blackcommerce PPM found its own agreement on pages 104 to 112; RockStep plus the hedge-fund template found
pages 70 to 87 (exact); the owner's first agreement as the whole file. The two fund PPMs were first wrongly read as
agreements; that is what the running-header rule fixed ("Confidential Private Placement Memorandum" on every page counts
as an offering heading).

Downloads (public EDGAR only, no blind CIK, at most one request every 0.4 s, User-Agent as required): 75 PDFs in
SCRATCH/d11/dl (source HTML deleted after printing), list.json, truth.json and page texts in SCRATCH/d11. Never
committed. The blind/ folder was never opened.

## What changed

- `assets/js/intake.js`: `recognise(pages)` and its page signals; `recogniseFile` (text layer, picture pages through
  NS.textengine when the file is mostly pictures); `readFile` as the intake calls it keeps each PDF's recognition by
  SHA-256; `agreementAmong` gives the documents this intake stored their recognition and picks the agreement;
  `prepareAgreement` prepares a whole agreement as before or sends an agreement found inside a combined file to `readPart`
  (the D-44 background reading, which now cuts with the shared `cutPages`); the cut document carries
  `recognised.kind = 'agreement'`; `agreementDoc` decides by the kept recognition; with automatic reading (a reading
  server) nothing is prepared beyond the server's answer. `AGREEMENT_NAME` and `NS.intake.agreementName` removed.
- `assets/js/esign.js` (agreement dialog only): pre-selection by `agreementChoice`; `agrRead` reads stored documents with no
  recognition once the dialog is open, then selects unless the sponsor has chosen (`data-read="done"` when finished); a
  line says what the chosen document's pages read as; a combined document gives only its agreement pages on Continue.
- Checks: `agreement-name.js` rewritten (gone, intake, memo, combined, dialog); `recognition-measure.js` added.

## Gate (last lines verbatim)

- `agreement-name.js` (all parts): `AGREEMENT NAME: PASS` (RED before the change: `AGREEMENT NAME: FAIL - gone, intake, memo, combined, dialog`)
- `intake-server.js --only unchanged,api,fallback,failures,unreadable,retry,wholetext,mixedpages,combined`: 94 PASS, `INTAKE SERVER: PASS` (no slice re-pinned: `unchanged 13/13 protected slices byte-identical`)
- `server-read-unit.js`: `SERVER READ UNIT: PASS`
- `two-persons.js`: `TWO PERSONS: PASS`
- `status-math.js`: `STATUS MATH: PASS (cases run: 13)`
- `server` `node --test`: `# pass 191`, `# fail 0` (with node_modules linked in; 168/191 without, see failure 9)
- `recognition-measure.js --split final`: `RECOGNITION: final agreements 81/88, non-agreements wrongly recognised 1/18, combined found 20/20 (exact range 12)`
- Phase 6 forms-flow and status-flow: no case touches the intake or the agreement dialog (they seed the agreement template
  directly in lib.js; grep for the intake and dialog selectors finds none), so none were run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Content recognition ran after automatic reading**
- **Found during:** the intake-server.js gate (combined untick, none, bad: 6 FAIL)
- **Issue:** with a reading server whose answer had no agreement (or the sponsor unticked it), prepareAgreement fell through to the new content recognition and made an agreement; D-11 says nothing changes with a reading server
- **Fix:** prepareAgreement returns when `opts.method === 'auto'`
- **Files modified:** assets/js/intake.js
- **Commit:** 9a635c8

**2. [Rule 3 - Blocking] Dialog wording against the check**
- The first wording ("Pages 70 to 87 of this document ...") did not match the check's "pages 70 to 87"; the wording became
  "Its pages 70 to 87 read as the subscription agreement; only those pages are used." Commit 73bef24.

Behaviour change to note for the owner: with a reading server, a separately uploaded agreement that the model does not
report is no longer picked up by its file name (that fallback was the name rule D-11 removes).

## Known Stubs

None.

## Threat Flags

None: no new network endpoint; the dialog reads stored files from the browser's own store; picture reading uses the
portal's own text reader with no request.

## Self-Check: PASSED

- FOUND: assets/js/intake.js, assets/js/esign.js, checks/agreement-name.js, checks/recognition-measure.js
- FOUND commits: 99d60f7, 73bef24, 9add8ef, 9a635c8
