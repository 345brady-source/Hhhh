---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 06
subsystem: files
tags: [pdf, cpa-package, offline, preview, FA-10]
status: complete
requires:
  - phase: 10 (plan 10-03)
    provides: "NS.esignKit.writer(), NS.esignKit.unicodeFont() and the shipped writer, font embedder and font data"
  - phase: 11 (plans 11-03, 11-04)
    provides: "assets/js/filesout.js (NS.files.workbook), checks/load11.js, checks/gate11.sh"
provides:
  - "NS.files.pdf(doc, kit) -> Promise<Uint8Array> (with .missing): schedule objects as a multi-page US Letter landscape PDF, nothing fetched"
  - "checks/pdf-out.js: PDF OUT, 6 cases (one, pages, formats, text, frame, selfcheck)"
affects: [11-14 and 11-16 (the CPA package PDF), report builder]
tech-stack:
  added: []
  patterns: ["tables laid out with the shipped writer and Unicode font; figures never wrap; sheets too wide for a page print in parts that repeat the leading text columns"]
key-files:
  created:
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/pdf-out.js
  modified:
    - assets/js/filesout.js
key-decisions:
  - "Money, percentages, numbers and dates never wrap; text wraps between words; only a word wider than 20 type sizes (a 64-character hash) is broken"
  - "A sheet whose narrowest columns do not fit at 6 points prints at 7 points in parts (\"Investor register, part 1 of 2\"), each beginning with the sheet's leading text columns (at most two, at most a third of the width), the columns spread evenly over the parts"
  - "Each sheet starts a new page; every page carries doc.title (left) and doc.subtitle (right) above the sheet title"
  - "The total row is bold: the bold font when its data is on the page, otherwise the regular font filled and outlined (unicodeFont gives the regular font only)"
  - "The file's Producer and Creator are the firm's name (doc.footer, else doc.title), never the library's"
  - "Money that is not whole cents stops the PDF with an error naming the sheet and row, as the workbook does"
requirements-completed: [FA-10]
metrics:
  completed: 2026-11-20
estimate:
  tokens: 70000
actuals:
  tokens: 10200      # chars/4 over the added lines of the two files (40,649 characters)
  tasks: 2
  commits: 5         # git rev-list --count plan_head_before..plan_head_after, before this summary's own commit
plan_head_before: 3e3ac3295538bf15137bce15ea208cf3d1af155e
plan_head_after: 7ff6e5ac11ee8f08508cf176838858e0194da5fe
---

# Phase 11 Plan 06: the PDF writer for tables Summary

NS.files.pdf writes the Audit page's schedule objects as a printable PDF in the browser, using the writer and Unicode font phase 10 ships in the repository. It adds no library and fetches nothing. It was built in the phone-sized sandboxed frame with no outside request, and every figure reads back from the PDF text. The owner has not checked this.

## Failures first

1. **The first writer failed on real data.** Case one and the plan's other cases passed on the first writer (commit 70a7173). I then ran it on every sample fund's full Audit schedule list, data the cases had never seen, and 7,637 words and figures did not read back. The 19-column investor register printed money broken mid-figure ("$750,0" / "00.00"), dates split over three lines, statuses split into letters ("Missi"/"ng") and headings one letter per line ("Ne/xt/KY/C"). The plan's cases did not catch this because none had a sheet wider than the page. Fixed in 7ff6e5a: figures never wrap, the type steps down to 6 points, and a sheet still too wide prints in parts. The case `pages` now prints a 19-column sheet of the same shape. On the first writer it fails 5 checks (`SCRATCH/exec-11-06/red-3-wide.txt`); on the fix it passes. After the fix, all 15 funds read back with nothing missing (see Real data below).
2. **The plan's character "the font lacks" is in the font.** The shipped DejaVu Sans has U+1F600. It prints as typed, and pdf.missing came back 0 instead of the plan's 1. Case `text` now uses U+1F680, which the case itself proves absent from the shipped font's character set (and U+1F600 present). It checks that U+1F680 prints as '?' with pdf.missing 1, and that U+1F600 prints as typed.
3. **One mutation survives.** Treating dates as text that may wrap (`fixed` without `c.t === 'date'`) passes all six cases. A date column always gets its full width first, so only a sheet with dozens of columns that each need a little width could wrap a date. Nine other mutations each fail a case: no parentheses, no repeated headings, no '?' for a missing glyph, no wrapping, money left-aligned, "Page k" without "of N", the library's name left in the file properties, no parts, and no repeated id column. The list is in `SCRATCH/exec-11-06/mutations.txt`.
4. **Not proven:** how the pages look when printed, or opened in the iPhone preview's own viewer. No page loads filesout.js yet; plan 11-16 adds the package button and owns the in-preview download. The owner's readability check is pending (see below).

## Verify lines (verbatim)

Task 1 (run as written; exit 0):
```
PASS one the debit amounts are right-aligned
PASS one the credit amounts are right-aligned
PDF OUT: PASS (cases run: 1)
```

Task 2 (run as written through `SCRATCH/exec-11-06/verify2.sh`; the six cases through heavy.sh, then `GATE_OUT=SCRATCH/exec-11-06 bash .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/gate11.sh`; 74 PASS, 0 FAIL in the check; the gate's whole output is 44 lines):
```
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty --case list exits 1 with a FAIL line
PDF OUT: PASS (cases run: 6)
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
GATE ok   BANK STEP TYPING (2)
GATE ok   HELP CHAT (10)
GATE ok   REAL FIRM (9)
GATE ok   SIGNING DOCUMENTS (8)
GATE ok   PHONE LAYOUT (8)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 358
# pass 358
# fail 0
GATE ok   server tests 358 = base 358 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX MATH
GATE ok   TAXDOCS MATH
GATE ok   AUDIT SAME
GATE ok   BANK FILES
GATE ok   BOOKS CORE
GATE ok   PDF OUT
GATE ok   WORKBOOK
GATE_EXIT=0
VERIFY_EXIT=0
```
The gate removed the base tree. server/node_modules was not left behind. The verify line tests both.

## RED evidence

- Task 1: `SCRATCH/exec-11-06/red-1.txt`: `FAIL one NS.files.pdf exists`, `FAIL one ran to the end :: TypeError: NS.files.pdf is not a function`, `PDF OUT: FAIL (cases run: 1) - one`.
- Task 2: `SCRATCH/exec-11-06/red-2.txt`. Task 1's writer already existed, so the RED run is the six-case check run against the base tree (3e3ac32, filesout.js without pdf), extracted with git archive. Node cases: `PDF OUT: FAIL (cases run: 5) - one, pages, formats, text` (selfcheck tests the runner, so it passes there by design). Frame case through heavy.sh: `FAIL frame ran to the end :: frame.evaluate: TypeError: window.CVPortal.files.pdf is not a function`, `PDF OUT: FAIL (cases run: 1) - frame`. On the current tree, case pages also failed until the page count was entered: `FAIL pages 0 pages (the first passing run's count) :: {"text":9,"info":"9"}` (`SCRATCH/exec-11-06/pages-base.txt`).
- Wide sheets: `SCRATCH/exec-11-06/red-3-wide.txt`. The new checks run on 70a7173's writer: 5 FAIL (figures broken, heading words broken, no parts, ids not repeated, text words broken).

## What the six cases prove

| Case | Proves |
|------|--------|
| one | The hand-worked trial balance: %PDF- bytes; pdftotext's text holds $32,000.00, $7,500.00, $1.23, $0.01, 25.00%, $32,001.23, $7,500.01, Łukasz Ż and `=SUM(A1) & <Co> "X" ’`. One 792 x 612 pt page, the document title in the properties, no library name in Producer or Creator, "Page 1 of 1" and the footer. Debit and credit amounts right-aligned (right edges within 0.6 pt, read with pdftotext -bbox) |
| pages | 300 rows of 1..300 cents on 9 pages (the first passing run's count). Every page repeats "Line Amount" and carries "Page k of 9" once; pages 2-9 say "Ledger (continued)". Counted with `\bRow k\b` (W5): Row 1 x1, Row 150 x1, Row 300 x1, and every Row k exactly once. $451.50 only on the last page. All 300 lines read back with their own cents, adding up to 45,150. Then a 19-column sheet: every figure and date whole, no heading word broken, "Wide, part k of K", every investor id in every part, every text word whole |
| formats | -450,000 cents prints ($4,500.00) and no "−" or "-$" appears (I4). 0.125 prints 12.50%. 1.50x, $12.50 and 1,234 print as NS.audit.display gives them. 2026-12-31 prints "Dec 31, 2026". Zero prints $0.00 and 0.00%. Two sheets go on two pages, each starting with its own title under the document title and subtitle; Page 1 of 2 and 2 of 2 |
| text | The 400-character description prints as one line cut with "…". The 200-character cell wraps onto several lines with every word present. A 120-character token is broken across lines and its pieces rejoin exactly. U+1F680 prints as '?' with pdf.missing 1; U+1F600 prints as typed. Nothing is drawn outside the 0.5 inch margins, and the memo text stays left of the amount column |
| frame | lib10 framed at 390x844 with touch, policy 'self'. The frame refuses fetch(). The check adds filesout.js to the page and calls NS.files.pdf with the hand-worked sheet and no kit. The result is a Uint8Array starting %PDF-. The shipped write.js, fonts.js and text-regular.js were loaded from the portal's own address, and neither outside host was asked. The PDF reads back with all nine strings and nothing missing. lib10's quiet holds: nothing refused, no script error, no outside request |
| selfcheck | An unknown --case name and an empty list each exit 1 with a FAIL line (child processes) |

## Real data (ad hoc, not part of the gate)

`SCRATCH/exec-11-06/real.js` builds every sample firm's every offering (15 funds, 4 firms) over its whole life, NS.audit.build with preset itd, today 2026-11-19. Each fund's full schedule list was written as one PDF and read back with pdftotext. On the final writer:
- 15 PDFs, 232 sheets, 536 pages, nothing thrown, 0 characters missing from the font.
- 15,110 money figures, each found as printed (with parentheses for negatives) at least as often as the sheet holds it. 99,777 words of the other cells all found whole, except the 64-character SHA-256 hashes of the change log, which wrap. `SCRATCH/exec-11-06/longcheck2.js` rebuilt all 154 distinct broken hashes of the kept fund from their pieces, line by line within their column.
- Time to build each fund's PDF in Node: 182 ms to 4,468 ms (27 s for all 15). Measured once on this shared machine, not in a phone browser.

## Owner's check (pending)

Open `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-11-06/sample.pdf`, 11 pages: the hand-worked trial balance with a negative line, a 300-row ledger, and a sheet with a long memo and a long token. Also open `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-11-06/sample-real-fund.pdf`, 30 pages: Kestrel Bay Fund II's full Audit schedule list, including the investor register in two parts and the change log. Expected: headings on every page, amounts lined up on the right, names printed as typed, nothing cut off. Nothing here is done until he has checked it.

## Commits

- a77c41b test(11-06): PDF OUT case one, the hand-worked trial balance read back (RED)
- 70a7173 feat(11-06): NS.files.pdf writes tables as a PDF with the shipped writer and Unicode font
- a541b7b test(11-06): PDF OUT cases pages, formats, text, frame and selfcheck (six cases)
- eb0b5d2 test(11-06): case pages also prints a 19-column sheet (RED on the first writer)
- 7ff6e5a fix(11-06): wide sheets print whole figures, in parts when they cannot fit one page
- (this summary)

## Deviations from Plan

1. **[Rule 1 - bug found on real data] Wide sheets** (Failures 1). The wide-sheet checks went into case `pages`, so the count stays at six as the plan and the gate marker say.
2. **[Rule 1 - plan fact] U+1F680 in place of U+1F600** (Failures 2). The check proves which character the font lacks instead of assuming it.
3. **[Rule 2] Additions beyond the interfaces block, each tested:**
   - the document title and subtitle above every sheet;
   - "(continued)" on continuation pages and ", part k of K" on parts;
   - a hairline under each row, and a heavier rule and bold text for the total;
   - "None" printed for a sheet with no rows;
   - the file properties set to the firm's name (otherwise pdf-lib names itself, which breaks the white-label rule);
   - money that is not whole cents throws;
   - a row taller than a page is cut with "…";
   - ligatures switched off, so every character is its own glyph and the text reads back as typed;
   - doc.when sets the file's dates.
4. **Bold weight (I4):** the total row uses the bold font only when its data is already on the page (kit.boldBytes or NS.fontData.bold). Otherwise the regular font is filled and outlined. The text reads back the same either way.
5. **Money headings** add the currency only when it is not USD ("Debit", not "Debit (USD)"). The amounts already carry "$", and percentages carry "%".
6. **Task 2 RED came from the base tree** (see RED evidence), because Task 1's writer existed when the cases were written. The wide-sheet RED came from the committed first writer.
7. No STATE.md, ROADMAP.md or REQUIREMENTS.md change, as the brief says. No library, vendor file or package was added: the diff from 3e3ac32 is assets/js/filesout.js, checks/pdf-out.js and this summary.

## Known Stubs

None.

## Threat Flags

None. No network path, no endpoint, no file access. T-11-17: long cells wrap and a missing glyph prints '?' (case text). T-11-18: only the writer plan 10-03 pinned is used, and the frame case refuses both outside hosts and proves the shipped files were the ones loaded. T-11-SC: nothing installed.

## Self-Check: PASSED

assets/js/filesout.js and checks/pdf-out.js are present. Commits a77c41b, 70a7173, a541b7b, eb0b5d2 and 7ff6e5a are ancestors of HEAD. Both sample PDFs exist.
