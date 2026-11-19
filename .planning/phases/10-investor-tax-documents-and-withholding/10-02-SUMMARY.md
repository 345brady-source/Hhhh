---
phase: 10-investor-tax-documents-and-withholding
plan: 02
subsystem: investor tax documents (K-1 split core)
status: complete
tags: [k-1, tax-documents, electronic-delivery, rev-proc-2012-17, taxpayer-numbers]
requires: []
provides:
  - "NS.taxdocs (assets/js/taxdocs.js): page facts, split, proposal, batches, confirmation, confirm together, the delivery record, consent, notice, access dates, lists"
  - "checks/k1-build.js: builds combined K-1 files from the IRS's blank 2025 form (for 10-04's browser check too)"
  - "checks/k1-split.js (7 cases, plus --real <folder>) and checks/taxdocs-math.js (9 cases)"
affects: [10-04, 10-06, 10-10, 10-11, 10-12, 10-13, 10-14]
tech-stack:
  added: []
  patterns: ["IIFE module that loads in the browser and under Node (as meaning.js)", "salted, letters-only marks compared within one reading and never stored"]
key-files:
  created:
    - assets/js/taxdocs.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/k1-build.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/k1-split.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/taxdocs-math.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/fixtures/f1065sk1-2025.pdf
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/fixtures/SHA256SUMS
  modified: []
decisions:
  - "An amended document replaces the earlier one when deliver is called, even if the new one then waits for consent"
  - "deliver needs all four parts of the firm's contact (name, address, phone, email), not only the address"
  - "confirmTogether also leaves open a package whose investor already has a confirmed package (no document yet) in another file of the same kind and year"
  - "A document waiting because consent was withdrawn shows paper due 30 days after the withdrawal (section 10); otherwise no due date is given"
  - "Every open of a delivered document writes a change-log entry"
metrics:
  started: 2026-11-19T17:33:59Z
  completed: 2026-11-19T18:08:00Z
estimate:
  tokens: 104000
  tasks: 3
actuals:
  tokens: 31400
  tasks: 3
  commits: 7
plan_head_before: 3234eb5260e7ebfe4d866997781d9a3ffa8eb2be
plan_head_after: see the final commit of this summary (the 7th commit after the base)
---

# Phase 10 Plan 02: the K-1 split core Summary

A pure module (assets/js/taxdocs.js, no screen) that cuts a combined Schedule K-1 file into one package per partner, proposes an investor for each by one written rule (last four of the taxpayer number and the name), records a named person's confirmation, and carries each confirmed document through delivery, consent, paper, amendment, withdrawal and opens with the dates and words of Rev. Proc. 2012-17. Nothing is delivered unconfirmed. Measured only on files built from the IRS's blank 2025 form with invented partners: no file from a CPA's tax software has been tried. Nothing here is done until the owner has checked it.

## Failures and open points first

- No check failed at the end. Along the way, one check was wrong: case `nostore` expected a 30-page file, but the file it builds has 31 pages (27 for the twelve, plus 2, 1 and 1 for the three extra K-1s). The count in the check was corrected before the code was written (commit 9ca650f), and the RED run was taken again.
- **Unmeasured:** any K-1 made by a CPA's tax software (the field positions, the masking and the statement pages may differ); a scanned file is refused, not read; other K-1 forms (codes 661117 and 671124) are never matched automatically. The `--real <folder>` mode exists for the day real files are supplied. It prints counts only.
- **A legal point for the owner (not decided here):** Rev. Proc. 2012-17 section 9.01 says a K-1 *or amended K-1* posted on a website must stay there for the access period. The plan says an amended document replaces the earlier one and never sits beside it, so the module hides the earlier one. If the original must stay reachable until its own `availableUntil`, that rule changes in one place (`deliver`, where `replaces` is applied).
- B7 hand-over: not needed. All nine delivery cases were built (`paper`, `amended` and `withdraw` included).

## What was measured (each built file)

| Built file (from the IRS's blank form, invented partners) | K-1s found | Packages at the recorded pages | Proposals right / wrong / none | By basis (number and name / number only / name only) |
|---|---|---|---|---|
| 27 pages, values printed on the page | 12 of 12 | 12 of 12, page 1 belongs to no one | 12 / 0 / 0 | 10 / 1 / 1 |
| 27 pages, values left in form fields | 12 of 12 | 12 of 12 | 12 / 0 / 0 | 10 / 1 / 1 |
| The same file with the form fields hidden from the reader | 12 of 12 | 12 of 12 | every last four and name empty (shows the fields are what gets read) | n/a |
| 8 pages, a one-line page before each K-1 naming the next partner | 3 of 3 | 3 of 3, pages 1 and 2 belong to no one | 3 / 0 / 0 | 2 packages flagged to be looked at ("another name"), the last one not flagged |
| 2 K-1s, a statement page carrying another partner's number | 2 of 2 | 2 of 2 | n/a | the first package flagged ("another number") |
| 3 K-1s, the middle one only a picture | 2 of 3 (the picture can't be read) | the picture page sits in the package before it | 2 / 0 / none for the picture | that package flagged ("no text"); after it was set aside, both K-1s were given pages by hand |
| 3 picture-only pages | 0 (a scan) | none; every page belongs to no one | none | refused in one sentence; a package can still be made by hand |
| 31 pages: the twelve, plus one K-1 from another partnership and two with a number next to the name in item F | 15 of 15 | n/a | n/a | only the other partnership's K-1 is flagged; the names are kept without the number |
| `--real` trial on two built 27-page files and a 2-page scan (with registers) | 12, 12, 0 | 12, 12, 0 | 10/1/1 proposals on each, none for the scan | the scan reported as "a scan: it cannot be read" |

Mutation proof (each guard broken on purpose, then the check run): deliver without a confirmation, confirm-together ignoring the look flag, confirm-together ignoring a live document, name-only although a number is printed, last4 keeping every digit, the name kept with its number, consent of any version, a second document without `replaces`. **8 of 8 were caught.** The file was restored from git after each run.

## The verify and gate lines (verbatim)

- Task 1: `K1 SPLIT: PASS (cases run: 2)`, then `TRACER VERIFY EXIT=0`; the fixture matches SHA256SUMS
- Task 2: `K1 SPLIT: PASS (cases run: 7)`; `K1 REAL: 0 files read` on an empty folder; the output holds no full-number shape
- Task 3 (the closing proof, with the consent count 8 per B4): `TAXDOCS MATH: PASS (cases run: 9)`, `K1 SPLIT: PASS (cases run: 7)`, `# tests 252`, `# pass 252`, `# fail 0` (252 measured on the untouched tree at step 0, commit 3234eb5), `STATUS MATH: PASS (cases run: 13)`, `EMBED DATA: PASS (files: 3)`, the changed paths since the base are 6, all additions (`A`), `VERIFY EXIT=0`
- Every check output (tracer, split, math10, real) was searched for `[0-9]{9}`, `ddd-dd-dddd` and `dd-ddddddd`: none found.

RED runs (each kept in SCRATCH/exec-10-02):
- red-1.txt: `K1 SPLIT: FAIL (cases run: 2) - printed` (taxdocs.js did not exist)
- red-2.txt: `K1 SPLIT: FAIL (cases run: 7) - printed, fields, propose, byhand, nostore` (13 FAIL lines; `T.propose is not a function`, `T.addPackage is not a function`, last fours not read from fields)
- red-3.txt: `TAXDOCS MATH: FAIL (cases run: 9) - confirm, together, deliver, consent, paper, amended, withdraw, dates`

Libraries the checks used: the copies in the scratch folder (the reader 3.11.174 browser build and the writer 1.17.1, which the portal loads today). The assets/vendor copies from plan 10-03 are not in this worktree yet. k1-build.js switches to them on its own once they are.

## Tasks

| Task | What | Commits |
|---|---|---|
| 1 (tracer, earlier agent) | The 27-page printed file cut into 12 packages at the recorded pages; one package confirmed, consented and delivered to its one investor, and refused without the confirmation | cb2cbd8 (RED), bccc31c |
| 2 | Form fields read, the proposal rule, look flags (B2), number seen (B3), scans, by-hand packages, other kinds, otherPartnership, nothing longer than four digits kept (B1, B6), `--real` mode | 9ca650f (RED), 98660a3 |
| 3 | confirmTogether, addGenerated, the eight-entry consent (B4), withdrawConsent with a slot for the written confirmation, deliver with `replaces`, markPaper, bounced, withdraw, opened, notice, lists | 1113ce5 (RED), 324b5ce |

## How the plan-check additions were met

- B1: `nostore` searches the page facts, the split, ws.taxdocs, ws.docs and the change log for each invented number (as printed, as digits only, and its first five digits next to its last four), both shapes, and nine or more digits outside a hex string, with the SHA-256 values taken out first. It also proves the search can fail: each number put into a copy is found. Module ids are letters only.
- B2: `split` and `addBatch` set `look` with `lookWhy` ({ page, why }: 'no text', 'another number', 'another name'). `confirmTogether` leaves open packages with look, otherPartnership, an investor proposed twice, or an investor who already has a live document. The builder makes the picture-between-text file and the cover-page file.
- B3: `numberSeen`. A number that is printed but unreadable never proposes; "name only" needs no number printed at all.
- B4: eight consent entries, 5.01 first, each checked for what its section asks.
- B5: built files go to a folder named with the process id, removed on exit, pass or fail.
- B6: `pageFacts` returns last4, numberSeen, name and a salted mark of item A, never an item's text. The name has number shapes and runs of five or more digits removed.
- B7: not needed.
- B8: the last four on record is taxCert.tinLast4, else tinLast4; never taxW8.ftinLast4 (a check proves a foreign number is never compared).

## Deviations from Plan

1. **[Rule 1 - check bug] nostore page count 30 changed to 31.** Found in Task 2's RED run; the builder's pages add up to 31. Commit 9ca650f.
2. **[Plan-check B4] Task 3's verify asks for 8 consent entries, not 7.** The command was run from SCRATCH/exec-10-02/verify3.sh with that one change.
3. **[Rule 2 - correctness] Marks are salted per load.** The digest of item A (B6) and the number marks on statement pages use a salt made fresh each time the module loads, and they are letters only. Without the salt, someone could recover a nine-digit number by trying every one. Marks are compared within one reading and never stored.
4. **Choices the interfaces block left open** (listed in `decisions` above): replacement happens when deliver is called; deliver needs the full contact; the extra confirm-together exclusion; the due date for paper after a withdrawal; a log entry for every open. Additive keys: `numberSeen`, `look`, `lookWhy` and `basis` on a package; `waitingBy` and `waitingHow` on a waiting document's tax block. `lists().confirmed` holds documents only. A package confirmed without a document yet is in no list (plan 10-04 makes the document right after confirming).
5. **Earlier agent:** stopped on a usage limit after Task 1 and its uncommitted Task 2 check. That check was copied into this worktree, corrected (deviation 1) and committed as Task 2's RED.

Not touched: STATE.md, ROADMAP.md and REQUIREMENTS.md (AUTOPILOT: never touch STATE or ROADMAP; TAX-01 to TAX-06 stay open until the owner has checked the screens of plans 10-04 and 10-06). The in-house agreement reader was not read or used.

## Known Stubs

None. The module has no screen; plans 10-04 and 10-06 show it.

## Threat Flags

None beyond the plan's threat model (T-10-04 to T-10-07 are each covered by the cases named there and by the mutation proof).

## Self-Check: PASSED

- FOUND: assets/js/taxdocs.js, checks/k1-build.js, checks/k1-split.js, checks/taxdocs-math.js, checks/fixtures/f1065sk1-2025.pdf, checks/fixtures/SHA256SUMS
- FOUND in HEAD's history: cb2cbd8, bccc31c, 9ca650f, 98660a3, 1113ce5, 324b5ce
