---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 17
subsystem: investor onboarding tax step, tax form readers (Account page, console, audit package), official form fill
status: complete
tags: [tax-forms, w-9, d-30, backup-withholding, taxpayer-id, audit, onboarding]
requires: [06-16]
provides:
  - NS.inviteFlow.taxOnFile(investor): taxForm set and taxCert.signed !== false (the one on-file rule)
  - "<form> not signed" on the Account page, the console row, the audit register; the audit tax-forms check counts it as missing
  - NS.taxforms.fill answers.backupWithholding (W-9 only): item 2 crossed out along the map's strike2 strokes
  - emptied W-9 answers stay empty after "Change your answers" (d.w9Edit)
  - today's foreign certification blocks nothing and records signed false unless certified and signed
  - forms-flow.js cases unsigned, legacy, empty, tin, backup, foreign
affects: [06-18, 06-19, 06-20, 06-22]
tech-stack:
  added: []
  patterns:
    - "one rule exported on NS.inviteFlow and called at render time by the other modules (every page loads onboarding.js)"
    - "a drawn overlay on the official form that is not a field (strike2) is taken out of the answers before the field-name check"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-17-SUMMARY.md
  modified:
    - assets/js/onboarding.js
    - assets/js/taxforms.js
    - assets/js/audit.js
    - assets/js/portal.js
    - assets/js/console.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
decisions:
  - "Planner's choice applied: an unsigned tax form counts as missing in the audit's tax-forms check, listed as '<name> (<id>): W-9 not signed. Request a signed W-9 before year-end tax reporting.'"
  - "Today's foreign certification is recorded as signed only when it was ticked and signed with the investor's name; otherwise taxCert.signed false, so the on-file rule treats it like an unsigned W-9"
  - "A name typed on the foreign certification that is not the investor's is still pointed out ('or leave this empty'), as a part-typed taxpayer ID is; nothing else on it blocks"
metrics:
  duration: "about 25 min from recording the base (21:10 UTC) to the gate's end (21:34 UTC)"
  completed: 2026-11-15
  tasks: 2
  files: 6
actuals:
  tokens: 12600
  tasks: 2
  commits: 4
plan_head_before: 59a3319a05dbd711e7efbe64b0ec83562c4c6afd
plan_head_after: db31b21b79bf7170a1c1623f99a89ccdc678039d
---

# Phase 6 Plan 17: An unsigned W-9 is never reported as on file; item 2 crossed out for backup withholding; the full taxpayer ID only in memory and the form

An investor who finishes the W-9 without signing it now shows as "W-9 not signed" on their Account page, in the console row and in the audit register. The audit's tax-forms check lists them as missing. A record from before signing existed (a taxCert with no signed flag) still reads "W-9 on file". Ticking "The IRS has notified me that I am currently subject to backup withholding" now crosses out certification item 2 with a drawn line along each of its three printed lines, and the record keeps it. When the investor empties an answer under "Change your answers", it stays empty on the form; before this plan the form quietly put the old value back. Today's foreign certification no longer blocks the investor. A new case searched for the full taxpayer ID everywhere it could be saved, logged or printed and found it nowhere, so no code change was needed for it.

The owner has not checked any of this. It is not done until he has looked at it.

## Failures first

1. **The `empty` case was wrong as first written, and the mistake was in my check, not the product.** It cleared the SSN at Investor information. That step requires the number for a U.S. person ("Enter all nine digits."), so the walk got stuck there (SCRATCH/exec-06-17/red-t2.txt). The requirement predates this plan and is outside it, so I left it alone. The case now reloads the page between the steps instead, which takes the number out of memory (T-06-35), and then empties every answer. Its RED then failed on the real product gap: the name, "12 Elm Street" and "Austin, TX 78701" still printed after being emptied (SCRATCH/exec-06-17/red-t2-empty.txt).
2. **The `tin` case passed on the Task 1 code, before any Task 2 change.** It found no leak. The plan said "fix anything case tin finds", and it found nothing, so the case guards against regressions only; no product change came from it.
3. **The `legacy` case passed on the base code.** That is expected: the legacy behaviour was already right. It now guards the new rule against reading an old record as unsigned.
4. **Gate counts differ from the plan text, as the orchestrator said they would.** FORMS FLOW is 10 cases, not 9: the merged tree already had 4 (sign-w9, sign-w8ben, us-individual, investor-type), and this plan adds 6. STATUS FLOW is 25, not 29, and SERVER MODE is 8, not 10. The gate script (SCRATCH/exec-06-17/gate.sh) checks these exact numbers.
5. **Things I saw but did not change (out of scope):**
   - The esign step stamps the date place on an unsigned W-9 too ("11/15/2026" with no signature; this is 06-16 behaviour, visible in SCRATCH/exec-06-17/backup-crop.png).
   - The done screen has had no tax row since 06-15 (D-06), so it has nothing to reword. The `unsigned` case checks that it never says "W-9 on file" or "W-9 signed".

## RED runs (quoted)

Task 1, on the base code (SCRATCH/exec-06-17/red-t1-kept.txt): 20 PASS, 4 FAIL:
```
FAIL unsigned the investor’s Account page reads "W-9 not signed" :: W-9 on file
FAIL unsigned the audit register’s Tax form column reads "W-9 not signed" :: {...,"cell":"W-9 on file"}
FAIL unsigned the audit’s tax-forms check lists the investor as missing: "W-9 not signed" :: {..."items":["Sato Family Trust (KBC-1026): no tax form. Request a W-9 before year-end tax reporting."],...}
FAIL unsigned the check’s on-file count drops by one when the unsigned form replaces a form on file :: {"before":"W-9 or W-8 on file for 13 of 14 investors.","after":"W-9 or W-8 on file for 13 of 14 investors."}
FORMS FLOW: FAIL (cases run: 2) - unsigned
```
The console row already said "W-9 not signed" (06-16). It now uses the shared rule.

Task 2, on the Task 1 commit (SCRATCH/exec-06-17/red-t2.txt and red-t2-empty.txt):
```
FAIL backup a line is drawn along each printed line of item 2 at the strike2 strokes :: {"ink":[0,0,0],"lengthsPx":[729,732,224]}
FAIL backup the stored finished form keeps the cross-out :: [0,0,0]
FAIL foreign Continue with nothing filled shows no error and moves on :: {"errs":["Enter your foreign tax identifying number, or tick the box below it.","Certify the statements to continue.","Type your name exactly as Zoë Albrecht-Moreau."],"hd":"Tax certification"}
FAIL foreign the record says W-8BEN, not signed (nothing was certified) :: null
FAIL empty every answer field of the form stays empty (...) :: [["f1_01[0]","Tomasz Ellery-Nakamura"],["Address_ReadOrder[0].f1_07[0]","12 Elm Street"],["Address_ReadOrder[0].f1_08[0]","Austin, TX 78701"]]
```

## Gate

The Task 2 verify command, with this tree's counts (SCRATCH/exec-06-17/gate.sh). It passed on the first run. Last lines verbatim (SCRATCH/exec-06-17/gate.txt):
```
FORMS FLOW: PASS (cases run: 10)
STATUS FLOW: PASS (parts run: 25)
SERVER MODE: PASS (parts run: 8)
TWO PERSONS: PASS
MEASURE: PASS
GATE ok   server tests # fail 0
GATE ok   STATUS MATH
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (10)
GATE ok   STATUS FLOW (25)
GATE ok   SERVER MODE (8)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 178
# pass 178
# fail 0
GATE_EXIT=0
```
- Server tests: 178 pass, 0 fail. This plan added no server test because nothing server-side changed.
- STATUS MATH: 12 cases.
- PASS lines:
  - forms-flow: 179 (113 before). New cases: unsigned 16, legacy 8, empty 8, tin 19, backup 8, foreign 7.
  - status-flow: 388.
  - server-mode: 259.
- Owner walks A, B and C and the leak search passed. The walks finish the W-9 unsigned, so they now go through the unsigned path.
- The Task 1 tracer verify (`--case us-individual,unsigned,legacy`) printed `FORMS FLOW: PASS (cases run: 3)`.
- server/node_modules was linked for the runs, removed afterwards, and never staged.

## What each case measured

- **unsigned:**
  - An invited U.S. individual continues the W-9 and presses Finish without signing, and the flow moves on to Distribution payments.
  - The record: taxForm W-9, taxCert.signed false, signedBy empty. The change log has "Tax form completed without a signature".
  - The stored form has one Documents entry, no "Signed electronically" caption, and no new ink in the sign place (0 px).
  - The rest of the onboarding goes on to the agreement and the done screen. The done screen never says "W-9 on file" or "W-9 signed".
  - Account page: "W-9 not signed". Console row: "W-9 not signed", with no download.
  - The flow's record was placed on an investor holding capital in a fund. The audit register then reads "W-9 not signed", and the tax-forms check lists "<name> (<id>): W-9 not signed." Its on-file count drops from 13 to 12 of 14.
- **legacy:** a record with taxForm W-9 and a taxCert without signed. Account page "W-9 on file", register "W-9 on file". The check does not list the investor and its count is unchanged. The console row does not say "not signed".
- **empty:**
  - The page is reloaded between the steps, then every answer under "Change your answers" is emptied and backup is unticked.
  - Continue shows no error and builds the form. All 12 answer fields on page 1 print nothing: name, business name, both exemption codes, address, city, accounts, the SSN cells and the EIN cells. The requester stays, because it is the firm's name and not one of the investor's answers.
  - Finish moves on. The record says not signed, with tinLast4 empty.
- **tin** (SSN 468-02-3917):
  - Before anything is typed, no piece of the number is in the workspace or storage, so the search means something.
  - Between the steps, nothing saved holds more than the last four digits.
  - In the same session the step asks nothing, and the form prints 468 / 02 / 3917.
  - Once the form is built, nothing saved holds more than the last four digits.
  - Back from the form, the step asks for the number again, which shows it left memory. After a reload it asks again.
  - Continue with the field empty raises no error, and that form has no SSN. The earlier form, which held the number, is deleted from the file store.
  - Afterwards the number in any spacing, and any piece of it longer than the last four digits, is absent from all of these: the workspace JSON, local storage, session storage, the change log and every browser console message. The record keeps tinLast4 3917.
- **backup:**
  - The tick on "Change your answers" puts a drawn line along each strike2 stroke on the form. New ink against the blank form on the three strokes: line widths 729 / 732 / 224 px at 100 dpi, each with ink over more than a quarter of its width.
  - A form built by the portal without the tick has 0 px there, and there is no ink between the strokes.
  - The stored finished form keeps the cross-out, and taxCert.backupWithholding is true.
  - The render: SCRATCH/exec-06-17/backup-crop.png.
- **foreign:**
  - A foreign individual (the type the sponsor chose) sees the W-8BEN certification.
  - Continue with nothing filled shows no error and moves on to Distribution payments.
  - The record: W-8BEN, signed false, signedBy empty. The log has "Tax certification completed without a signature", not "signed".

Screens to look at:
- SCRATCH/exec-06-17/checks-out/forms-flow/unsigned/unsigned-console.png and unsigned-done.png
- SCRATCH/exec-06-17/checks-out/forms-flow/empty/empty-answers.png
- SCRATCH/exec-06-17/checks-out/forms-flow/tin/tin-asked-again.png
- SCRATCH/exec-06-17/checks-out/forms-flow/backup/backup-signing.png, plus finished.pdf

## Deviations from Plan

1. **[Rule 1 - Bug] Emptied W-9 answers came back.** The step's own text says "Change your answers", but an answer emptied there fell back to what Investor information gave. Now, once the investor opens "Change your answers" (`d.w9Edit`), the answers are used as given, an emptied one too. The edited answers stay on screen after Back or a reload. Investor information clears the flag when the investor changes their details there. Commit db31b21.
2. **[Rule 2] The foreign certification's signed flag.** Once the blocks were removed, the old save would have recorded an empty certification with no signed flag. The legacy rule would then have read it as on file. It now records signed false unless the box was ticked and the investor's name typed. Commit db31b21.
3. **[Rule 2] The activation log entry.** "W-9 and distribution account confirmed" was written even when the W-9 was not signed. That one entry now reads "W-9 not signed; distribution account confirmed" in that case. Commit 7f2a3dd.
4. **console.js was not in the plan's file list.** Its row is one of the readers in the plan's must-haves, so it now calls the shared rule (a one-line change).
5. **Done screen.** The plan says "the done summary" should read "W-9 not signed", but there has been no tax row there since 06-15 (D-06, no added text). I added nothing. The case checks that the screen never says the form is on file or signed.
6. **The self-serve tax on/off switch** ("Collect a substitute W-9 certification" in the console's settings, and the older self-serve flow it controls) was not touched by this plan, so it was neither kept nor removed here. Its removal stays with whichever plan touches it.
7. The ledger file under the git directory was not used (worktree guard). `commits` was measured from SCRATCH/exec-06-17/base-commit.txt.

## Known Stubs

None that block this plan's goal.
- "W-9 not signed" has no way for the sponsor to request a new signature from the console. That is a later plan's job.
- The foreign path is still today's typed certification until 06-18 (W-8BEN) and 06-20 (W-8BEN-E).

## Threat model

- **T-06-38:** the tin case searched the whole workspace JSON, local and session storage, the change log and every console message after the form was built. It found no piece of the number longer than its last four digits. The earlier unsigned form that held it was deleted from the file store.
- **T-06-39:** one rule, `taxForm && (taxCert || {}).signed !== false`, in every reader. The audit check counts an unsigned form as missing. The unsigned case covers each reader; legacy covers old records.

## Threat Flags

None. No new endpoint, storage or trust boundary.

## Self-Check: PASSED

- Files present: assets/js/onboarding.js, taxforms.js, audit.js, portal.js, console.js, checks/forms-flow.js, 06-17-SUMMARY.md.
- Commits 9b87b09, 7f2a3dd, 6d9314f and db31b21 are on HEAD.
- No untracked file is left. server/node_modules was removed after the runs and never staged.
