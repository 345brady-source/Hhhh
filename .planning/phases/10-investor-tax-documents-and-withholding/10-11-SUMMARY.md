---
phase: 10-investor-tax-documents-and-withholding
plan: 11
subsystem: Form 1099-DIV (funds set to corporation or REIT) in the Form 1099 section of Tax documents; help guide lines
status: complete
tags: [tax, 1099-DIV, IRIS, copy-b, split, d-02, c-07, tax-09, tax-11, tax-12, tax-18]
requires: ["10-09 (NS.tax1099, NS.tax1099data)", "10-10 (tax1099-ui.js, TAX1099 FLOW)", "10-05 (NS.withholding)", "10-01 (stored lines)"]
provides:
  - "NS.tax1099.setSplit, setYearSplit, clearYearSplit, wholeDividend, splitOf, divShare, divRuns, figuresDiv, formTypeOf, figuresFor; COPY_B_OF; DIV_RULES, DIV_STOP, DIV_TEXT"
  - "NS.tax1099data.IRIS.columns['1099-DIV'] (69 columns, A to BQ), IRIS.boxes, MAPS['1099-DIV 2024-01 Copy B']"
  - "assets/forms/1099/f1099div-2024-01.pdf (pinned) and its entry in forms1099-data.js"
  - "checks: TAX 1099 14 cases, TAX FORMS 2 forms, TAX1099 FLOW 11 parts"
affects: [10-13]
tech-stack:
  added: []
  patterns: ["exact integer split arithmetic (BigInt) with largest remainder and a named tie-break", "one form type threaded through row, Copy B, confirm, file and receipt"]
key-files:
  created:
    - assets/forms/1099/f1099div-2024-01.pdf
  modified:
    - assets/js/tax1099.js
    - assets/js/tax1099-data.js
    - assets/js/tax1099-ui.js
    - assets/forms/1099/SHA256SUMS
    - assets/forms/1099/forms1099-data.js
    - server/help/guide.md
    - server/lib/help-guide.mjs
    - .planning/tools/preview/help-data.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/tax-1099.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/tax-forms.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/tax1099-flow.js
    - .planning/phases/10-investor-tax-documents-and-withholding/10-13-PLAN.md
decisions:
  - "A portion box (1b, 2e, 5 of 1a; 2b, 2c, 2d, 2f of 2a) is the investor's own parent box shared out in the split's proportions with the rest of the parent (largest remainder, ties to the portion). For a single portion this is the parent box times its share, half a cent up; a portion can never exceed its parent and 2b + 2c + 2d never exceeds 2a."
  - "Odd cents of 1a, 2a and 3 go to the largest remainders; ties in box order 1a, 2a, 3."
  - "Every paid distribution of a corporation or REIT fund needs a split, whatever its type; none is guessed."
  - "Anyone who may confirm totals (NS.app.can('operate')) may enter a split, as with answering whether a payment is interest; the numbers, copies and file stay admin-only."
  - "A year's split applies to every paid distribution of that year, including one recorded later; a distribution's own split wins over it."
metrics:
  completed: 2026-11-27
  tasks: 3
estimate:
  tokens: 110000
  tasks: 3
actuals:
  tokens: 34000     # chars/4 over the added lines (127,508 chars without the embedded PDF data and generated files), plus this summary
  tasks: 3
  commits: 9        # git rev-list --count d243c4f..1169cce; this summary is the 10th
plan_head_before: d243c4fd5c95ae4a8736ab9b17dd133ba32d821f
plan_head_after: 1169cce
---

# Phase 10 Plan 11: Form 1099-DIV Summary

For a fund set to corporation or REIT, Tax documents, then Form 1099, now lists each distribution paid in the year under "Split from your CPA". The sponsor types the split the CPA gives (as percents or amounts, with boxes 1b to 2f and 5 behind "More boxes from your CPA"). The portal never proposes one. A split that breaks an arithmetic rule is refused in one line that names the rule. Each investor's boxes are their stored amount of each distribution shared out by that distribution's split, to the cent: 1a + 2a + 3 equals exactly what they were paid. An investor who joined mid-year gets the mix of the distributions they were paid in. From there, the confirm, numbers, recipient copies (the official Form 1099-DIV Copy B), IRS file (69 columns) and receipt steps work as Form 1099-INT's do. Measured on hand-worked example E to the cent, in the sandboxed frame at 390x844 with touch and at 1280x800, on invented numbers only. **The owner has not checked any of it, and no CPA has read any of it.**

## Failures and unconfirmed points first

- **Cases div-rules, div-stops and div-rows passed at RED.** I wrote the whole module in Task 1's code commit (e4133b1), before those cases existed, so they have no RED of their own. That breaks the RED-first rule. To show they still measure something, I planted 12 bugs one at a time in a scratch copy of tax1099.js. The cases caught all 12 (list below). The three browser parts did fail at RED.
- **The gate needed four runs into the same folder.** Each of the first three hit the 2-hour limit in the shared browser queue.
  - Run 1 also had `GATE FAIL MEASURE` (walkA and walkB each waited 900 s, then walkC crashed with "Target crashed") and `GATE FAIL EMAIL DIALOG (3)` (in the phone frame, the email footer line was not seen whole).
  - Neither check touches a file this plan changed. Both passed when run again in run 2, on the same commit.
  - Run 3 finished the reference gate with every step ok. Run 4 ran the phase 10 checks and ended `GATE_EXIT=0`.
- **The base branch was not merged before the gate** (D11). Since d243c4f it gained 08-19's code: assets/js/integrations.js, server/index.mjs, server/lib/invitations.mjs and the new server/test/package-names.test.mjs. None of these is a file of this plan.
  - The new test file has no `// gate: tests N` marker. On a merged tree the gate's server count would therefore read base 403 + 0 declared against more tests, and fail for a reason outside this plan.
  - The orchestrator merges and reruns.
- **Two first GREEN failures were bugs in the check, not the product.**
  - The part read example D's fund's year record instead of example E's.
  - The year-split box was looked for after every split was saved, when no split form is open any more.
- **Not proven, stated plainly:**
  - No CPA has read the box list, the split's entry, the stops or the rules (the list for 10-13 is below).
  - No file has been uploaded to the IRS. The file's header text and its cents are not compared with a real IRS template: `headerPinned` and `centsConfirmed` stay false, and the screen shows "The file's header has not yet been compared with the IRS's own template." for the DIV file too.
  - Tax year 2026's DIV columns are assumed equal to the 2025 guidelines.
  - Nothing has been run on an iPhone.
- **Seen on the screenshots (taken, looked at, deleted after the gate as the plan's rules say):**
  - On the phone, the preview's "Signed in as admin" notice briefly covers the "Report the whole payment as a dividend" button. This is the existing demo-bar toast, not added here.
  - Every input in the split form has a one-word label ("1a", "2a", "3").
- **Not built:**
  - Liquidating distributions (boxes 9 and 10): not prepared, and no screen line says so. Left to the CPA (planner's choice 2).
  - An amended 1099-DIV: as for 1099-INT, a copy is made only for a form with no live copy.

## Evidence as produced

### RED 1 (SCRATCH/exec-10-11/red-1.txt; checks and pinned form committed in 514f3c7, before the code)
```
FAIL div-split div-split: ran to the end :: TypeError: NS.tax1099.setSplit is not a function | at splitE (...checks/tax-1099.js:276:14)
FAIL div-split odd line: ran to the end :: TypeError: T.setSplit is not a function | at ...checks/tax-1099.js:773:9
TAX 1099: FAIL (cases run: 1) - div-split
FAIL 1099-DIV the Copy B map exists :: 1099-DIV 2024-01 Copy B
TAX FORMS: FAIL (forms run: 2) - 1099-DIV
```

### Task 1 verify (code e4133b1)
```
TAX 1099: PASS (cases run: 1)        (tracer.txt, case div-split: 28 PASS, 0 FAIL)
TAX FORMS: PASS (forms run: 2)       (forms.txt)
f1099int-2024-01.pdf: OK
f1099div-2024-01.pdf: OK             (pin.txt, sha256sum -c SHA256SUMS)
```
On e4133b1, plan 10-09's ten cases plus div-split gave `TAX 1099: PASS (cases run: 11)`, 0 FAIL.

### RED 2 (SCRATCH/exec-10-11/red-2.txt; checks in save commit 3730d60, before the screen code)
The module cases passed (`TAX 1099: PASS (cases run: 3)`, see above). The planted bugs (SCRATCH/exec-10-11/planted.txt):
```
CAUGHT rule 1b not checked: 13 FAIL
CAUGHT rule 2b+2c+2d not checked: 10 FAIL
CAUGHT odd-cent tie to the later box: 2 FAIL
CAUGHT percent sum not checked: 16 FAIL
CAUGHT five decimals accepted: 1 FAIL
CAUGHT $10 line on 1a instead of cash: 3 FAIL
CAUGHT box 4 not the backup withheld: 1 FAIL
CAUGHT other withholding not stopped (the DIV copy of the line): 1 FAIL
CAUGHT own split loses to the year: 1 FAIL
CAUGHT confirmed ignores the boxes: 1 FAIL
CAUGHT box 4 written in AQ: 1 FAIL
CAUGHT a split stored without a person: 2 FAIL
```
The three browser parts:
```
FAIL div-split-phone as admin, Tax documents shows the Form 1099 line for a fund set to corporation or REIT
FAIL div-split-phone before any split, the two distributions are listed with "Split from your CPA" :: []
FAIL div-split-phone the IRS's whole-payment rule is one line with its button :: {"n":0,"text":"","buttons":0}
FAIL div-split-phone the boxes beyond 1a, 2a and 3 are behind "More boxes from your CPA", closed
FAIL div-split-phone ran to the end :: frame.fill: Timeout 30000ms exceeded.
(the same five for div-split-desktop)
FAIL div-file S-2002's number is read from the signed W-9: 'ending 6602'
FAIL div-file ran to the end :: frame.fill: Timeout 30000ms exceeded.
TAX1099 FLOW: FAIL (parts run: 3) - div-split-phone, div-split-desktop, div-file
```

### Task 2 verify (screen code in save commit cd03f58, check fixes in 20be6fe; SCRATCH/exec-10-11/verify2.txt)
```
TAX 1099: PASS (cases run: 14)          cases.txt: 278 PASS, 0 FAIL
TAX1099 FLOW: PASS (parts run: 3)       parts.txt: 83 PASS, 0 FAIL
VERIFY2_EXIT=0                          (no dashed taxpayer-number shape in either output)
```

### Task 3 (f09f153): the guide
- **Sponsor guide (GUIDE.sponsor):** 46,698 bytes before, 47,082 after, so +384 against the 400 cap.
- **Where it changed:** only the console-taxdocs entry, with two paragraphs inserted after line 288 and before "To deliver:". One is for "Tax withheld" ("Mark deposited", "Download worksheet for your CPA", "Record notice"). The other is for "Form 1099" ("Confirm", the numbers, "Create recipient copies", "Download the IRS file", "Record the IRS receipt", and for a corporation or REIT the CPA's split per distribution, "Save split"; none is proposed).
- **Built and checked:**
  - `node server/help/build.mjs --verify`: in sync.
  - help-data.js regenerated; `--verify` reports it current.
  - `node --test test/help-guide.test.mjs`: 9 pass, 0 fail.
- **Pre-gate lines (verify3.sh with E2, E3 and E4):** the unchanged-file and guide-changed tests read only `git log $BASE..HEAD --no-merges` (SCRATCH/exec-10-11/touched.txt). "Form 1099" and "Tax withheld" are found inside the console-taxdocs section (taxdocs-entry.txt). The script printed `sponsor guide bytes: before 46698, after 47082, rise 384` and `pre-gate checks: ok`.

## Gate (GATE_OUT=SCRATCH/exec-10-11, base d243c4f, run 4 of 4 into the same folder; last lines verbatim)
```
GATE ok   HELP PREVIEW (6) (kept from 2026-11-27 02:12:05 UTC)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing-base (kept from 2026-11-27 02:17:59 UTC)
GATE ok   signing-plan (kept from 2026-11-27 02:42:01 UTC)
GATE ok   record-base (kept from 2026-11-27 02:43:57 UTC)
GATE ok   record-plan (kept from 2026-11-27 02:44:13 UTC)
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 403
# pass 403
# fail 0
GATE ok   base-server-tests (kept from 2026-11-27 02:44:37 UTC)
GATE ok   server tests 403 = base 403 + 0 declared
GATE ok   DIST FLOW (kept from 2026-11-27 02:50:33 UTC)
GATE ok   DIST RECORD (kept from 2026-11-27 02:50:36 UTC)
GATE ok   K1 SPLIT (kept from 2026-11-27 02:50:57 UTC)
GATE ok   SHIPPED LIBS
GATE ok   TAX 1099
GATE ok   TAX FORMS
GATE ok   TAX MATH
GATE ok   TAX1099 FLOW
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXLINK FLOW
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE_EXIT=0
VERIFY3_EXIT=0
```
- Every reference line above HELP PREVIEW also reads `GATE ok`: server tests 403, STATUS MATH, FORM MAPS, FORMS FLOW, STATUS FLOW, SERVER MODE, TWO PERSONS, MEASURE, the owner's folder, EMAIL DIALOG, AGREEMENT NAME, TAX REQUEST LEAVE, WAYS OUT, NO NETWORK, EMBED DATA, SAFARI FINISH, BANK STEP TYPING, HELP CHAT, REAL FIRM, SIGNING DOCUMENTS, PHONE LAYOUT, RECORD AND LOST AGREEMENT, SCREEN EDGES, WALK3 FIXES, TITLES AND EDITOR, PRESS AND CO-INVESTOR, CO-INVESTOR SERVER.
- MEASURE and EMAIL DIALOG failed in run 1 and passed in run 2 (see Failures).
- In the gate's own runs:
  - `TAX 1099: PASS (cases run: 14)`.
  - `TAX FORMS: PASS (forms run: 2)`.
  - `TAX1099 FLOW: PASS (parts run: 11)`: 262 PASS, 0 FAIL. Plan 10-10's eight parts still pass on the changed screen.
  - No dashed taxpayer-number shape appears in either output.

## What the checks prove (example E, plan file lines 113-121)

- **div-split:** the CPA's splits stored as amounts (700,000 / 100,000 / 200,000 with box 5 at 700,000; 300,000 / 0 / 300,000 with box 5 at 300,000).
  - S-2001: 400,000 / 40,000 / 200,000, box 5 at 400,000, cash 640,000.
  - S-2002: 60,000 / 0 / 60,000, cash 120,000.
  - S-2003: 540,000 / 60,000 / 240,000, cash 840,000.
  - Fund: 1a 1,000,000, 2a 100,000, 3 500,000, cash 1,600,000.
  - The odd line: 233,333 / 33,333 / 66,667, with 5 at 233,333 and 1b at 116,667.
  - S-2001's row by the DIV letters: AM 4000.00, AO 400.00, AU 2000.00, AW 4000.00; AN, AP to AT and AV empty; the other box columns to BQ empty; no fault.
  - A two-page Copy B showing ***-**-6601. The figures stand with every position set to zero (nothing is read from the capital-account engine).
- **div-rules:** each rule refused by name with nothing stored: sum (percent and amount), 1b, 5, 2e, 2b+2c+2d, 2f, negative (percent, amount, portion), five decimals, parts of a cent, another fund's distribution, a fund not set to corporation or REIT, no named person.
  - 33.3333 / 33.3333 / 33.3334 stores 333,333 / 333,333 / 334.
  - The tie-break is in box order.
  - The year's split marks each distribution "year", and a distribution's own split wins.
  - With no split, figuresDiv stores nothing and stops.
  - wholeDividend stores source irs-default with the person, and it is logged.
- **div-stops:** reporting for notes, partnership and no type; split (naming the date); stored. A cancelled distribution or one in another year stops nothing.
  - Form 1099-INT's six leave-outs, worded for Form 1099-DIV, with the $10 line on cash paid.
  - Box 4 equals NS.withholding.withheldFor.
  - other-withholding is tested (E6): a 30% line on an included investor stops the forms, while the same line on a foreign investor, who is left out, does not.
  - confirmTotals stores every box, and the confirmation is withdrawn when a split changes.
- **div-rows:** the header has 69 names, A to BQ, each sourced to the 1099-DIV guidelines, with the box columns as E5 lists them. The three rows are right and pass. Box 4 goes in AV. The 15 faults of case faults are caught on DIV rows. 237 rows give files of 100, 100 and 37. markFiled records 1099-div.
- **TAX FORMS 1099-DIV:** the pin; the data file holds one entry per pinned form; Copy B is page 4 and the instructions page 5. All 34 fields of the Copy B page are mapped (18) or listed as unused (16), checked both ways, each beside its printed label. A changed file is refused. The sample fills each field inside its rectangle and prints nothing else.
- **div-split-phone / div-split-desktop:**
  - The fund is listed.
  - Before any split: "Split from your CPA" on both distributions, and no forms.
  - The whole-payment rule is one line with its button, and it is not applied until pressed. Nothing proposes a split (every field empty), and the extra boxes sit behind a closed "More boxes from your CPA".
  - 70 / 10 / 10 is refused in one line.
  - The splits give example E's dollars on three forms, with the one Form 5452 line.
  - Confirm on one form confirms that form only and stores every box.
  - Desktop only: a third distribution withdraws the forms until "Report the whole payment as a dividend" is pressed (S-2001's 1a becomes $4,400.00), and the change log holds the splits, the confirmations and the choice.
  - Both sizes: quiet, leak and way out.
- **div-file:** S-2002's number is read from its W-9; the others are typed.
  - The .csv `1099-DIV-2026-part-1-of-1.csv` has the 69-name header and three rows with AM, AO, AU and AW as in example E, and AV empty.
  - The template-not-confirmed line is shown. The SHA-256 and the row count 3 are on the year record.
  - Three 1099-div copies are made. S-2001 (consented) has its copy delivered, available until 2027-10-15; the others are on the send-on-paper list. The copy has two pages, ***-**-6601, and $4,000.00, $400.00 and $2,000.00. S-2001 opens it in Documents.
  - Afterwards, storage, the workspace, the change log, the page and its fields hold none of the numbers and no new nine-digit run.

## Rules no CPA has read (also added to 10-13's CPA list, b53095f)

1. The $10 line on cash paid (1a + 2a + 3); any amount when backup withholding was taken.
2. The IRS's whole-payment rule as worded on screen ("IRS rule: if you are unable to determine whether any part of a payment is a dividend by the time you must file Form 1099-DIV, the entire payment must be reported as a dividend."), applied only when the sponsor presses it and recorded as their choice.
3. The Form 5452 line: "A corporation that paid nondividend distributions (box 3) files Form 5452; ask your CPA."
4. Liquidating distributions (boxes 9 and 10) are not prepared; left to the CPA.
5. 1b, 2e and 5 each no more than 1a; 2b + 2c + 2d and 2f each no more than 2a.
6. Percents of at most four decimals. The odd cent goes to the largest remainder, with ties in box order 1a, 2a, 3. Each portion is shared out of the investor's own parent box.
7. Every paid distribution of a corporation or REIT fund is treated as a distribution on stock whatever its type, including one typed Interest.
8. A year's split applies to every distribution of that year, including one recorded later.
9. Form 1099-INT's leave-outs (IRA, exempt, valid W-8 to 1042-S, no signed W-9, expired W-8) and its other-withholding stop are reused unchanged.

## Commits

- 514f3c7 test: RED 1 checks and the pinned Form 1099-DIV.
- e4133b1 feat: the module, the data and the embedded form.
- 875ab83, 3730d60, cd03f58, 20be6fe, 1169cce wip saves:
  - the summary draft;
  - the RED 2 checks (3730d60);
  - the screen code (cd03f58);
  - the check fixes (20be6fe);
  - the summary evidence (1169cce).
- f09f153 docs: the guide lines, the rebuilt module, the preview help data and the 11-part marker.
- b53095f docs: the 10-13 CPA list line.
- All of them are on wip/10-11.

## Deviations from Plan

1. **[Process] No RED of their own for the three module cases**, replaced by the 12 planted bugs (see Failures).
2. **[Rule 1] The portion rule.** The interface's "gross times its cents over the total, half a cent up, never more than the parent" could put 2b + 2c + 2d one cent above 2a. A portion is instead shared out of the investor's own parent box by largest remainder. That is still half a cent up for a single portion, and the plan's 116,667 holds.
3. **[Plan check E2, E3, E4] Guide and verify.**
   - Only console-taxdocs was edited. The console-offering and console-distributions lines were already written by 10-07.
   - The verify's greps are scoped to that section, and the unchanged-file tests read this plan's non-merge commits.
4. **[Plan check E6]** The 'other-withholding' stop is kept and tested.
5. **tax-forms.js** became one generic check per form. The data file's test changed from "holds one entry" to "one entry per pinned form", and `--embed` writes every pinned form.
6. **The tax1099-ui.js stop panel.** The split stop has no sentence of its own: each distribution's row in the split panel carries `data-stop="split"` and "Split from your CPA". This avoids drawing the same thing twice.
7. **Base branch not merged** (see Failures).
8. The screen code and the RED 2 checks are in save commits (save rule 2), as in 10-10.

## Known Stubs

None.

## Threat Flags

None new. T-10-33 is mitigated:
- No split is stored without a named person.
- Every broken rule is refused (div-rules).
- A distribution with no split stops the forms (div-stops).
- The whole-payment rule needs its own press and is stored as irs-default with the person.

T-10-34 is mitigated: div-file repeats plan 10-10's search of storage, the workspace, the change log, the page and its fields, and the copy shows only the last four.

## New shipped files a preview build must add

- **assets/forms/1099/f1099div-2024-01.pdf** (new, 542,425 bytes, pinned).
- **assets/forms/1099/forms1099-data.js** now carries both forms (1,442,025 bytes, up from 718,742).
- build.py copies every tracked file under assets/.

## Owner's check (pending)

On the iPhone, in the published preview:
1. Set a fund's Tax reporting to Corporation or REIT and record two distributions.
2. Open Form 1099 on Tax documents.
3. Enter a split for each, trying one that does not add up.
4. Confirm a form, create the copies and download the file.

Expected:
- A split that does not add up is refused with the rule named.
- The boxes add up to what each investor was paid.
- Nothing proposes a split.
- The screen is no heavier than it must be.

Whether a CPA would hand over the split in this form has not been asked.

## Self-Check: PASSED

- FOUND: assets/forms/1099/f1099div-2024-01.pdf, assets/js/tax1099.js, assets/js/tax1099-data.js, assets/js/tax1099-ui.js.
- FOUND as ancestors of HEAD: 514f3c7, e4133b1, 3730d60, cd03f58, 20be6fe, f09f153, b53095f, 1169cce.
