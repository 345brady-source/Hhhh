---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 02
subsystem: fund accounting / bank reconciliation input
status: partial
tags: [bank-files, csv, ofx, qfx, bai2, cents, refusals]
requires: []
provides:
  - "NS.bankFiles (assets/js/bankfiles.js): LIMITS, detect, parse, csvGuess, csvRows, cents, lineIds"
  - "checks/bank-files.js: BANK FILES: PASS (cases run: 12)"
  - "checks/fixtures/bank/: fund A's 2026 statement in five formats, expect.json, a bad-trailer BAI2, two real BAI2 files with their licence"
affects: ["11-08 (stores and matches lines)", "11-15 (upload screen)", "11-17 (the owner's real bank export)"]
tech-stack:
  added: []
  patterns: ["pure module on window.CVPortal, loaded by no page yet", "one tokenizer for both OFX layouts", "every BAI2 trailer checked before anything is returned"]
key-files:
  created:
    - assets/js/bankfiles.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/bank-files.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/expect.json
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/fund-a-signed.csv
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/fund-a-inout.csv
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/fund-a.qfx
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/fund-a.ofx
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/fund-a.bai
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/fund-a-bad-trailer.bai
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/real/sample1.txt
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/real/sample2.txt
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/real/SOURCE.txt
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/real/LICENSE
  modified: []
decisions:
  - "The BAI2 control-total rule comes from the two real files: the specification file the plan named is a saved '404: Not Found' page"
  - "A file holding several accounts returns every line tagged with its account's last four; opts.account keeps one account"
  - "A bank id (OFX FITID, BAI2 bank reference) that two lines in one file share is not used; those lines get hashed ids"
  - "A BAI2 transaction type code outside 100-699 refuses the file; no direction is guessed"
  - "parse uses csvGuess when a CSV arrives with no map; the map the sponsor confirms (plan 11-15) is passed in"
metrics:
  completed: 2026-11-19
  tasks: 2
  files: 13
estimate:
  tokens: 82000
actuals:
  tokens: 23200
  tasks: 2
  commits: 4
plan_head_before: 211ad705f245243a207f85c8886e43a92bebfdd7
plan_head_after: e54b521a3903f3688240e2e1e6384ef76e31edf9
---

# Phase 11 Plan 02: Reading bank statement files Summary

A bank statement downloaded as CSV, OFX (the older layout and the newer one, also named QFX or QBO) or BAI2 is read in the browser, with no network and no outside library, into lines of date, amount in whole cents (money in positive), description and reference, each with an id that is the same every time the file is read. A BAI2 file whose control totals or record counts do not add up is refused in one sentence and nothing is returned. This is tested on made-up files and on two real BAI2 files from an open-source project. No bank's own export has been tried yet. The owner has not checked this, so it is not called working.

## Failures first

- **The reference gate did not finish, so the plan's own verify is not met: there is no `GATE_EXIT` line.** gate9.sh started at 19:07 UTC and was stopped at 21:07 by the two-hour limit on background commands. Three other agents' gates (10-14, 11-01, 11-03) were in the shared browser queue at the same time. It was stopped during the phase-4 signing step on this tree, so that step, the phase-5 record check on this tree, gate9's own server-count step and the phase-9 checks never ran. The harness says a command that already had the longest limit is not restarted, so I did not restart it; the orchestrator has to run it. Everything below that finished passed (the full lines are in "The gate"). This plan changes no file any of those checks reads: every file is new, and no page loads bankfiles.js. The gate's leftovers (base tree, screenshots, the server/node_modules link) were removed by hand, because its own cleanup never ran.
- The specification file the plan pointed to for the BAI2 control-total rule (`SCRATCH/r11/gh/moov-io_bai2_master_docs_specifications_00-file-format.md`) is empty apart from the text `404: Not Found`. The research saved an error page, not the specification. As the plan allows, the rule was taken from what the two real files show, and both files agree with it at every trailer (see "Control-total rule" below). It is still not confirmed against the specification text.
- While Task 2 was being built, the new checks found two faults in Task 1's OFX code. An older-layout file cut off in the middle of a tag was refused with "a tag that cannot be read" instead of saying the file was cut short. The cut-short message was also two sentences. Both are fixed in e54b521. Each OFX file is now cut at every position before `</OFX>` (2,264 positions in the older layout, 3,598 in the newer one) and every cut is refused.
- No other failures. Everything else below was measured.

## What was measured

- `BANK FILES: PASS (cases run: 12)`: 210 PASS lines, 0 FAIL. Cases: detect, csv-signed, csv-inout, csv-guess, ofx2, ofx1, bai2, bai2-real, bai2-bad, ids, limits, selfcheck.
- Fund A's statement is written in five formats (signed CSV, money-in/money-out CSV, older OFX, newer OFX, BAI2). All five read to the same nine lines of expect.json, to the cent. The closing balance is 3,500,000 cents ($35,000.00) in every format that carries one. BAI2 also gives opening 0.
- Real BAI2 files (measured on the first passing run, kept in `SCRATCH/exec-11-02/real-base.txt`; the constants had been worked out by hand from the files before that run, and the run gave the same numbers):
  - sample1.txt: 17 lines, sum 0, money in 320,000, money out -320,000, 1 account (two 03 sections), trailers checked: account 2, group 1, file 1.
  - sample2.txt: 4 lines, sum 30,950,000, money in 30,950,000, 5 accounts, trailers checked: account 5, group 4, file 1.
- Refusals (each throws one sentence and returns nothing). These are the exact sentences:
  - fund-a-bad-trailer.bai: "The account trailer for the account ending 6789 says its amounts add up to 1,813,000.01, but they add up to 1,813,000.00: the file is damaged or incomplete, so nothing was read."
  - 49 record count +1: "The account trailer for the account ending 6789 says it has 13 records, but 12 were read: the file is damaged or incomplete, so nothing was read."
  - 98 control total +1 cent: "The group trailer on line 15 says its amounts add up to 1,813,000.01, but they add up to 1,813,000.00: the file is damaged or incomplete, so nothing was read."
  - 99 record count +1: "The file trailer says it has 17 records, but 16 were read: the file is damaged or incomplete, so nothing was read."
  - The real sample1.txt with one amount changed by a cent is refused, naming the account trailer.
  - fund-a.bai cut after each of its first 15 records is refused every time.
  - A dropped 16 record, an unknown type code (890), a value date that does not exist (261232), 02/30/2026 in a CSV, and the amounts '12.345', '1,2,3', '--5' and 'abc' are each refused in one sentence.
  - A text of LIMITS.bytes + 1 UTF-8 bytes is refused; the test text has fewer characters than bytes, which proves bytes are counted. A text of exactly 2,000,000 bytes is read.
  - A text of LIMITS.lines + 1 lines is refused; one of exactly 20,000 lines is read.
- Mutation proof (run by hand, not kept in the check): the account-trailer total comparison was switched off, and bai2-bad and bai2-real failed. Separately, the "no non-zero digit after the cents" rule was removed, and limits failed. The module was restored byte for byte both times (cmp).

## RED evidence

- Task 1, `SCRATCH/exec-11-02/red-1.txt` (before bankfiles.js existed):
  `FAIL ofx2 ran to the end :: Error: ENOENT: no such file or directory, open '.../assets/js/bankfiles.js'` / `BANK FILES: FAIL (cases run: 1) - ofx2`
- Task 2, `SCRATCH/exec-11-02/red-2.txt` (Task 1's code only): 24 FAIL lines, last line
  `BANK FILES: FAIL (cases run: 12) - detect, csv-signed, csv-inout, csv-guess, ofx1, bai2, bai2-real, bai2-bad, ids, limits`
  (for example `FAIL csv-signed ran to the end :: TypeError: B.csvGuess is not a function`, `FAIL bai2-bad ... the sentence names account trailer :: This file is not a bank statement the portal can read; ...`).

## The gate

Not finished (see Failures first). Command: `GATE_OUT=SCRATCH/exec-11-02 bash .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/gate9.sh`. Its own output file is empty, because gate9 prints only at the end. The lines the reference step had written to `SCRATCH/exec-11-02/gate/reference.txt` when it was stopped, verbatim:

```
GATE ok   server tests # fail 0
GATE FAIL server tests 197
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3)
GATE ok   AGREEMENT NAME
GATE ok   TAX REQUEST LEAVE (5)
GATE ok   WAYS OUT (7)
GATE ok   NO NETWORK (3)
GATE ok   EMBED DATA (3)
GATE ok   SAFARI FINISH (6)
GATE ok   HELP CHAT (10)
GATE ok   base is an ancestor of HEAD and HEAD moved
```

"GATE FAIL server tests 197" is the reference gate's own server-test count line. gate9 drops that line and replaces it with its step 2 (this tree's tests against the base tree's count plus the declared tests), and step 2 had not run when the gate was stopped. The server run itself shows `# fail 0`. The base-side signing and record runs finished: signing-base 75/75 passed, record-base 40/40 passed. The signing-plan run on this tree was cut off. Not run at all: the record check on this tree, gate9 step 2 and gate9 step 3 (the phase-9 checks).

## Control-total rule used, and where it came from

Taken from the two real BAI2 files `real/sample1.txt` and `real/sample2.txt`, and checked by hand at every trailer of both. The specification file was a 404 page.
- Account trailer (49), field 1: the signed sum of every amount in the account's 03 summaries (88 continuations included) plus every 16 transaction amount. Item counts are not added. Funds-availability amounts (the three figures after funds type S, and the distribution amounts after D) are not added either. Field 2: the account's records from its 03 to its 49, every 88 included.
- Group trailer (98): the sum of its accounts' totals; the number of 03 accounts; its records from the 02 to the 98.
- File trailer (99): the sum of its groups' totals; the number of groups; every record from the 01 to the 99.
- An 88 record carries on the field list of the record before it. sample2.txt proves this: the 03 record ends with `190/` and its amount, `500000`, opens the next 88. A 16 record's text runs to the end of its record. When the text continues in an 88 it is joined with one space; that join is my choice and is not confirmed.

## What is assumed and not confirmed

These are stated in the module's header comment as well:
- The older OFX layout (a plain-text header, then values with no closing tags) comes from general knowledge of the format. No bank's own OFX or QFX file has been read; fund-a.qfx is my own example of that layout.
- BAI2 type codes 100 to 399 are taken as money in and 400 to 699 as money out. Any other code in a 16 record refuses the whole file. The two real files agree with this (108, 115, 195 and 218 in; 409 out), but the specification was not read.
- BAI2 summary code 010 is taken as the opening ledger balance and 015 as the closing one. 040 and 045, the available balances, are not used. sample1.txt carries only 040 and 045, so it reads with both balances null.
- A 16 record with funds type V gives the line's date from its own value date. Without V, the group's as-of date is used. Two-digit years are read as 20YY.
- fund-a.bai uses type 475 (check paid) for the law firm payment. The plan named types only for wires and ACH.
- CSV: a footer or preamble row (account details above the header, totals below) is refused with the row number, not skipped. Month names ("Jan 15, 2026") and "CR"/"DR" amount suffixes are not read. A CSV has no trailer, so a CSV that has been cut short cannot be detected.
- No bank's own export has been read in any format. A real export from the owner's bank, with its numbers masked, is still owed (plan 11-17) before this is called working.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] OFX cut-short refusals (found during Task 2 by the new ofx1 case)**
- Issue: a file cut inside a tag gave a "tag cannot be read" sentence; the cut-short sentence was two sentences.
- Fix: a tag with no closing `>` before the end of the text is reported as cut short; one sentence. Exhaustive cut tests were added to ofx1 and bai2-bad.
- Files: assets/js/bankfiles.js, checks/bank-files.js. Commit: e54b521.

### Additions beyond the plan's interface (needed for the real files and for safety)

**2. [Rule 2] Several accounts in one file.** sample2.txt holds five accounts, and treasury BAI2 files often do. Mixing their lines into one statement would put one account's money into another's reconciliation. parse now returns `accounts` (last four, currency and balances of each). When there is more than one account, every line carries `last4` and the top level has no account or balances. `opts.account` keeps one account. OFX uses the same path.
**3. [Rule 2] Duplicate bank ids.** If two lines in one file share a FITID or bank reference, the id is not used for either of them; they get hashed ids. Without this, plan 11-08 would skip the second line as "already imported" and money would go missing.
**4. Lines carry `bankId`** (the FITID or BAI2 bank reference) so that `lineIds(lines)` can be called on its own, as the interface says. For BAI2, `ref` is the customer reference, or the bank reference when there is no customer reference.
**5. `parse` returns `trailers: { account, group, file }` for BAI2**, so the checks can prove the trailers were checked and not skipped.
**6. `csvRows` is exported** so that the screen (11-15) can show rows and pass them to `csvGuess`. `csvGuess` takes either rows or text.
**7. The CSV opening balance is null.** The plan allowed "where the format carries them"; a CSV carries balances after each row, not an opening balance, and none is derived.
**8. SOURCE.txt names the copyright holder.** It is "The Moov Authors", taken from the project's source file headers, which were fetched read-only from the project's public repository on 2026-11-19. The same fetch confirmed both samples' SHA-256 values and that the project has no NOTICE file. LICENSE is the orchestrator's apache.org copy (11,358 bytes, 202 lines), per W2.
**9. Checks beyond the plan's list, all inside the twelve cases:** every truncation of both OFX files and of fund-a.bai; entity decoding (only the five named entities, decoded once); a newest-first CSV; turning "money out shown as negative" off; a no-header CSV; a static check that bankfiles.js holds no fetch, XHR, DOMParser, eval, storage or URL; the gate marker equal to the number of cases.

Plan-check additions applied: W1 (49 count, 98 total and 99 count variants in bai2-bad, each naming its trailer and returning nothing), W2 (LICENSE and SOURCE.txt), I2 (the module says LIMITS.bytes counts UTF-8 bytes; case limits proves it), I3 (lineIds gives ids only; duplicate-import detection stays with 11-08, as the module says).

## Known Stubs

None. bankfiles.js is not loaded by any page yet; plan 11-15 loads it on demand.

## Threat Flags

None beyond the plan's threat model. T-11-04: limits are checked before parsing. T-11-05: tokenizer only, five entities, no XML parser, no eval (static check). T-11-06: every trailer is checked. T-11-07: text is kept verbatim. T-11-08: the fixtures are made up, and the real files are public test data.

## Commits

- f610395 test(11-02): bank files check, case ofx2, fund A's expected statement and its newer OFX file (RED)
- 05e0d15 feat(11-02): read OFX statement files into lines in cents with stable ids
- 7c76e4f test(11-02): twelve bank file cases, fund A in CSV, older OFX and BAI2, two real BAI2 samples (RED)
- e54b521 feat(11-02): read CSV with a column map and BAI2 with every trailer checked; refusals in plain words

The owner has not checked this. It is not called done until the owner has checked it and his bank's own export has been read.

## Self-Check: PASSED (files and commits); plan verify NOT met (gate not finished)

All 13 created files are present. Commits f610395, 05e0d15, 7c76e4f and e54b521 are ancestors of HEAD. The real samples are byte-identical (cmp) to the files the research saved. `BANK FILES: PASS (cases run: 12)` was re-run after the gate. server/node_modules is not present. Missing: the gate's `GATE_EXIT=0` line.
