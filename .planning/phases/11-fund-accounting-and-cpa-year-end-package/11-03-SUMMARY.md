---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 03
subsystem: files
tags: [xlsx, workbook, cpa-package, zip, openpyxl, libreoffice]
status: complete
requires:
  - phase: audit engine (assets/js/audit.js)
    provides: schedule objects, NS.audit.zip
provides:
  - "NS.files.workbook(sheets, opts) -> Uint8Array (.xlsx built in the browser, nothing fetched)"
  - "NS.files.sheetName(title, used)"
  - "checks/workbook.js (7 cases) and checks/read-xlsx.py"
affects: [11-06 (PDF writer joins NS.files), 11-14 and 11-16 (CPA package), report builder]
actuals:
  tokens: 8525
  tasks: 2
  commits: 5
plan_head_before: 211ad705f245243a207f85c8886e43a92bebfdd7
plan_head_after: see the final commit of this summary (the four code and check commits end at 7c49408)
tech-stack:
  added: []
  patterns: ["office file parts written as strings, encoded by the module's own UTF-8 encoder, stored with NS.audit.zip"]
key-files:
  created:
    - assets/js/filesout.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/workbook.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/read-xlsx.py
  modified: []
key-decisions:
  - "Money that is not whole cents, or a number that is not finite, stops the workbook with an error naming the sheet and cell instead of writing a wrong number"
  - "Sheet names are unique ignoring case (Excel treats 'Trial balance' and 'TRIAL BALANCE' as the same sheet); apostrophes at either end are removed"
  - "Characters XML 1.0 cannot carry are dropped from text and a lone surrogate becomes U+FFFD, so one stray character cannot make the file unreadable"
  - "qty: a number is written as a number (General format); text (the audit engine's '1.25000000' style quantities) stays text"
requirements-completed: [FA-10]
---

# Phase 11 Plan 03: the workbook writer Summary

An .xlsx writer in the browser (assets/js/filesout.js, 243 lines, no library, nothing fetched) that turns the Audit page's schedule objects into a workbook; it reads back to the cent in openpyxl and in LibreOffice.

## Failures first

- **The first LibreOffice run of case `libre` failed on 4 of its 10 checks, all in the Share (percent) column.** The money values came out exactly as the hand-worked sheet says (32000, 7500, 1.23, 0.01, 32001.23, 7500.01; the large sheet's last line 20010). The percent cells came out as `25%`, `50%`, `12.5%`, `87.5%`, not the `0.25`, `0.5`, `0.125`, `0.875` the check expected. That expectation was my own addition: B1 sets no expected value for that column. LibreOffice writes a percent-formatted cell with its % sign even when raw values are asked for. It drops the format's fixed decimals (12.5%, not 12.50%), which shows the raw value was used. The check now expects LibreOffice's exact text (commit 7c49408). B1's expected values were not changed. The first run's output is kept in `SCRATCH/exec-11-03/libre-first-run.txt`.
- The first run of all seven cases was stopped by my own `timeout 900` while case `libre` waited for a slot in the shared queue. A stopped run left its temporary folder behind, so the check now removes it on SIGTERM, SIGINT and SIGHUP too. I deleted the left-behind folder by hand.
- Not proven: Microsoft Excel and Apple Numbers are not on this machine. Whether they open the file without a repair notice is the owner's check in plan 11-17. No page loads filesout.js yet; plan 11-16 loads it and owns the proof that the download works in the preview.

## Verify lines (verbatim)

Task 1:
```
PASS one no cell holds a formula (openpyxl)
PASS one no <f> element in any worksheet part
WORKBOOK: PASS (cases run: 1)
```
(verify exit 0)

Task 2 (exit 0; workbook check 159 PASS, 0 FAIL; then the reference gate through gate9.sh):
```
PASS selfcheck filesout.js uses the audit zip writer and its own UTF-8 encoder
PASS selfcheck the scan finds what it looks for (controls)
WORKBOOK: PASS (cases run: 7)
GATE ok   server tests # fail 0
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
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 272
# pass 272
# fail 0
GATE ok   server tests 272 = base 272 + 0 declared
GATE ok   FILINGS MATH
GATE ok   FORMD XML
GATE_EXIT=0
VERIFY_EXIT=0
```
The check's output folder was empty afterwards, the base tree was removed, and server/node_modules was not left behind. All three are tested by the verify line.

LibreOffice CSV (B1's filter options, raw values, one CSV per sheet), as the passing run wrote it, field by field:
- Trial balance row 1: `Account | Debit (USD) | Credit (USD) | Share (%)`
- row 2: `1000 Cash | 32000 | (empty) | 25%`
- row 3: `=SUM(A1) & <Co> "X" ’ | (empty) | 7500 | 50%`
- row 4: `Łukasz Ż | 1.23 | 0.01 | 12.5%`
- row 5 (total): `Total | 32001.23 | 7500.01 | 87.5%`
- Large: 2,002 lines; line 2001 `Line 2000 | 20`; last line `Total | 20010`

## RED evidence

- Task 1: `SCRATCH/exec-11-03/red-1.txt`: `FAIL one ran to the end :: Error: ENOENT ... assets/js/filesout.js` / `WORKBOOK: FAIL (cases run: 1) - one`.
- Task 2: `SCRATCH/exec-11-03/red-2.txt`. The six new cases were written after Task 1's writer existed, and on that writer five passed at once (all but `libre`; see Failures first). The RED run is therefore the full seven-case check run against the base commit's own files (211ad70: tenants.js, data.js, audit.js, P6 lib.js, no filesout.js), copied by `SCRATCH/exec-11-03/mirror.sh`: `WORKBOOK: FAIL (cases run: 7) - one, types, text-safe, names, large, libre, selfcheck`, exit 1. The two child-process checks of `selfcheck` (unknown name, empty list) pass there by design, because they test the check runner, not the writer.

## What the seven cases prove

| Case | Proves |
|------|--------|
| one | Hand-worked trial balance in openpyxl: B2 32000.0, C3 7500.0, B4 1.23, C4 0.01, D2 0.25 (0.00%), B5 32001.23, C5 7500.01, D5 0.875; A3 the formula-like text as text; Łukasz Ż; nulls absent; header and total bold; no formula (openpyxl and a count of `<f>` in the XML); exactly the six parts of a one-sheet workbook |
| types | every column type and format (money -1 cent → -0.01; 900719925474099 cents → 9007199254740.99; pct, ratio, price, int, date as text 2026-12-31, qty number and text); zeros kept, null and '' absent; the currency in the money heading (EUR); non-whole cents, NaN and an empty sheet list throw |
| text-safe | = + - @ tab, `=HYPERLINK(...)`, markup that tries to close the cell and open a formula, & < > " ’ and straight quotes, Łukasz Ż, an emoji (4-byte UTF-8), new lines, CR LF and edge spaces all read back as the same text; no formula anywhere; control characters dropped |
| names | 40 characters → 31; `A/B:C?D*[E]` → `ABCDE`; backslash removed; duplicates → `(2)`, `(3)` ignoring case, inside 31; `Łukasz & <Co> "X" ’` survives; openpyxl reads the same names |
| large | 2,000 money rows plus total: 2,002 rows, every row exactly its cents, the sum equal to 2,001,000 cents, last row 20010.0 |
| libre | LibreOffice values above (B1) |
| selfcheck | unknown and empty `--case` exit 1 with FAIL (child process); W3: filesout.js holds none of `fetch(`, `XMLHttpRequest`, `import(`, `require(`, `new Worker`, `createElement('script')`, `http://`, `https://`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts` once the seven XML namespace strings (listed by value) are taken out; it calls `NS.audit.zip(` and its own `utf8`, never TextEncoder; the scan catches each forbidden string when it is added (controls) |

## Extra evidence (ad hoc, not part of the gate)

Every sample firm's every offering (15 offerings, 4 firms): the full Audit schedule list for the fund's whole life was written as one workbook and read back with read-xlsx.py. Result: 15 workbooks, 232 sheets, 61,675 non-empty cells, 0 mismatches against the schedule values (money compared in cents), 0 formulas, nothing thrown. Script: `SCRATCH/exec-11-03/adhoc/real.js`. It stubs `NS.inviteFlow.taxOnFile` with onboarding.js's one-line rule, because onboarding.js needs a page to load.

## Commits

- a85a323 test(11-03): workbook check case one and the openpyxl reader (RED)
- e7e1440 feat(11-03): NS.files.workbook writes an .xlsx in the browser over the audit zip writer
- 1afaba5 test(11-03): cases types, text-safe, names, large, libre and selfcheck
- 7c49408 test(11-03): libre case expects LibreOffice's exact percent output; money values unchanged
- (this summary)

## Deviations from Plan

1. **[Rule 1 - check expectation] The libre case's percent column.** The plan names no value for it. My first expectation (0.25) did not match LibreOffice's raw-mode output (25%). The check now expects the exact output. B1's values (32000; 32001.23 and 7500.01; 20010) are unchanged and passed on the first run.
2. **[Rule 2 - correctness] Additions beyond the interfaces block.** These are: sheet names unique ignoring case; no apostrophe at either end; 'Sheet' for an empty title; characters XML cannot carry are dropped; a carriage return is kept as `&#13;`; money that is not whole cents or a number that is not finite throws instead of being written wrong. qty is written as a number when it is a number and as text otherwise (the interfaces block does not name its format). Each is tested in types, text-safe or names.
3. **[Rule 2] Signal cleanup in the check.** The check removes its temporary folder on SIGTERM, SIGINT and SIGHUP, as well as on a normal exit.
4. **Task 2 RED came from the base tree** (see RED evidence), because five of the six new cases passed at once on Task 1's writer.
5. `opts.title` is accepted but not written into the file. docProps are not required, and the file name carries the title in 11-16. `opts.when` sets the zip entry date.
6. Formats 0.00%, 0.00 and 0 use the spreadsheet's built-in format numbers 10, 2 and 1. Only the money format is a custom entry (164). openpyxl reports all four by their format strings.

## Known Stubs

None.

## Threat Flags

None. No network, no new endpoint. Text typed by anyone is written as inline strings that never run as formulas (T-11-09), with & < > " escaped (T-11-10). Both are tested in case text-safe.

## Self-Check: PASSED

- FOUND: assets/js/filesout.js, checks/workbook.js, checks/read-xlsx.py
- FOUND commits: a85a323, e7e1440, 1afaba5, 7c49408 (ancestors of HEAD)

Nothing here is "done" until the owner has checked it. Excel and Numbers are untried (plan 11-17), and no page loads filesout.js yet (plan 11-16).
