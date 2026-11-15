---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 20
subsystem: investor onboarding tax step (W-8BEN-E for a foreign entity or trust)
status: complete
tags: [tax-forms, w-8ben-e, d-01, d-04, d-06, d-09, d-30, form-04, onboarding]
requires: [06-12, 06-16, 06-17, 06-18, 06-19]
provides:
  - tax step for a foreign entity or trust - official W-8BEN-E (Rev. October 2021), pre-filled, signed on page 8
  - chapter 3 (corporation, simple trust, complex trust, estate) and chapter 4 (Active NFFE, Passive NFFE, Participating FFI, Reporting Model 1 FFI, Reporting Model 2 FFI) asked as one radio answer each
  - Passive NFFE owners statement with Part XXIX rows; FFI GIIN on line 9a; Part III treaty lines under "Change your answers"
  - routing line for "Something else" (W-8IMY, W-8ECI, W-8EXP, or a W-8BEN-E completed for that status); no envelope built
  - investor.taxCert for a W-8BEN-E { form, revision, envelopeId, at, signed, signedBy, chapter3, chapter4, country, ftinLast4, noFtin, validUntil }
  - forms-flow.js w8eCase builder and cases foreign-entity, passive-owners, passive-none, ffi-giin, treaty-entity, route
affects: [06-21, 06-22]
tech-stack:
  added: []
  patterns:
    - "a filled form read back over every page: each mapped text field checked as expected or empty, each mapped box as ticked or clean, with the blank form's printed words taken out"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-20-SUMMARY.md
  modified:
    - assets/js/onboarding.js
    - assets/js/console.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
decisions:
  - "Line 2 (country of organization) is taken from the formation answer only when the whole answer, or its part after the last comma, is a country on the portal's list; otherwise the step asks it"
  - "Line 8 (U.S. TIN) is pre-filled from a U.S. taxpayer ID given at Investor information, printed as an EIN (XX-XXXXXXX)"
  - "A simple trust answers line 4's hybrid question Yes exactly when it claims a treaty in Part III, otherwise No (judgment for the owner)"
  - "Part III is not pre-filled for an entity: a treaty claim needs the limitation on benefits provision, which onboarding cannot know; line 14c is not offered"
  - "'Something else' leaves nothing on file (no taxForm, no taxCert) and logs 'Tax form not completed'; the line tells the investor where to send the completed form until plan 06-21 adds upload"
metrics:
  duration: "32 min from recording the base (22:50:54 UTC) to the gate's end (23:22:57 UTC)"
  completed: 2026-11-15
  tasks: 2
  files: 3
actuals:
  tokens: 15700    # chars/4 over the 62,809 characters of added lines in ebde9ae..7fde641
  tasks: 2
  commits: 3       # git rev-list --count ebde9ae..HEAD before this summary commit
plan_head_before: ebde9ae7d82ae6d56b02e46f5141fca62c100afa
plan_head_after: 7fde641cd8307488622b2e897fec7d3d6117b42e
---

# Phase 6 Plan 20: A foreign entity or trust signs the pre-filled official W-8BEN-E

When the sponsor invites someone as a foreign entity, the tax step now leads to the official IRS Form W-8BEN-E (Rev. October 2021). Before this plan it showed a typed certification. That certification is removed.

The step asks only:
- the chapter 3 status, one radio answer;
- the chapter 4 status, one radio answer;
- the foreign tax ID, or a tick saying none is legally required;
- for an FFI, its GIIN;
- for a Passive NFFE, the owners statement and, when owners are listed, their rows.

Everything else comes from onboarding: line 1 the account name, line 2 the country named by the formation answer, line 6 the address, line 8 a U.S. TIN given at Investor information, and the controlling person as print name with the capacity box ticked. The mailing address, U.S. TIN, reference and treaty lines are under "Change your answers".

The controlling person signs on page 8. The date beside the signature is written MM-DD-YYYY. The sponsor's row reads "W-8BEN-E signed Nov 15, 2026, valid until Dec 31, 2029".

"Something else" on either status builds no form. One line names the form that usually applies and where to send it.

Nothing on the step is required (D-30). The owner has not checked any of this. It is not done until he has looked at it.

## Failures first

1. **No failure in the product or the gate.** The gate passed on its first run. Each case passed on its first run after its code was written.
2. **One layout flaw found by looking at the screen, and fixed before the commit.** In the first Passive NFFE screenshot, owner 1's TIN field and owner 2's name field sat side by side on one row. A reader could not tell which number belonged to which owner. Each owner's name is now full width, so every owner is its own group. I viewed the re-run screenshot.
3. **Gate counts differ from the plan text, as the orchestrator said they would.**
   - FORMS FLOW is 26 cases, not 25: the merged tree had 20, and this plan adds 6.
   - STATUS FLOW is 25 parts, not 29. SERVER MODE is 8, not 10.
   - The gate script (SCRATCH/exec-06-20/gate.sh) checks these exact numbers.
4. **Until plan 06-21 there is no upload.** A routed investor is told to send the completed form to the firm's support address, and can continue without it. Nothing is on file for them.
5. **Choices for the owner to judge.** Each is my reading, not settled law.
   - **Simple trust, line 4.** The hybrid question is answered Yes when the trust claims a treaty in Part III, otherwise No.
   - **Line 2 from the formation answer.** It is used only when the answer is a listed country, or ends with one after a comma ("Düsseldorf, Germany"). "BVI" or "Grand Cayman" is not read as a country; the step then asks for it.
   - **Line 8.** It is pre-filled from a U.S. TIN given at Investor information. The W-8BEN (06-18) does not do this, so the two forms differ here.
   - **Owner rows.** These are pre-filled from the beneficial owners that onboarding collects at 25 percent. A Passive NFFE has to list U.S. owners above 10 percent. The step says which owners to list, rows can be emptied, and "Add a U.S. owner" goes up to nine rows.
   - **Part III is not pre-filled for an entity**, and line 14c is not offered. Line 14c covers dividends from a foreign corporation and interest from a foreign corporation's U.S. trade or business, which do not apply to a fund investment.
6. **Known limit carried from 06-16 and 06-18.** The owners' TINs, the entity's U.S. TIN and the foreign tax ID stay in page memory only until the form is finished. If the investor goes Back after finishing and changes something, the new form does not have them unless they are typed again. The step's hints say "Leave empty to keep it" only while the numbers are still in memory.

## RED runs (quoted)

Task 1, the foreign-entity case run against the base code (SCRATCH/exec-06-20/red-t1.txt). 1 PASS, then:
```
FAIL foreign-entity the step says the form is the W-8BEN-E, filled in from the answers :: Kestrel Bay needs a tax form on file before paying distributions. A U.S. citizen or resident, or a U.S. entity? Use Form W-9
FAIL foreign-entity the step asks only the two statuses (as one group of radios each) and the foreign tax ID or its tick :: ["ob-taxCountry","ob-ftin","ob-noFtin","ob-treaty","ob-w8","ob-taxSig"]
FAIL foreign-entity the chapter 3 radios offer corporation, simple trust, complex trust and estate, in the form’s order, nothing chosen :: {"values":[],"chosen":""}
FAIL foreign-entity the chapter 4 radios offer Active NFFE, Passive NFFE, Participating FFI, Reporting Model 1 FFI and Reporting Model 2 FFI, nothing chosen :: {"values":[],"chosen":""}
FAIL foreign-entity ran to the end :: page.check: Timeout 30000ms exceeded.
FORMS FLOW: FAIL (cases run: 1) - foreign-entity
```
Task 2, the five new cases run against the Task 1 commit 2c1038e (SCRATCH/exec-06-20/red-t2.txt). 13 PASS, 9 FAIL:
```
FAIL passive-owners a Passive NFFE is asked the owners statement: none, or listed :: {"values":[],"chosen":""}
FAIL passive-owners ran to the end :: page.check: Timeout 30000ms exceeded.
FAIL passive-none ran to the end :: page.check: Timeout 30000ms exceeded.
FAIL ffi-giin a Reporting Model 1 FFI is asked the GIIN, and nothing about owners :: [...,"ob-ftin","ob-noFtin"]
FAIL ffi-giin ran to the end :: page.fill: Timeout 30000ms exceeded.
FAIL treaty-entity ran to the end :: page.inputValue: Timeout 30000ms exceeded.
FAIL route chapter 3 offers exactly corporation, simple trust, complex trust, estate, or something else :: {"values":["corporation","simpleTrust","complexTrust","estate"],"chosen":""}
FAIL route chapter 4 offers exactly ... or something else :: {"values":["activeNffe","passiveNffe","participatingFfi","model1Ffi","model2Ffi"],"chosen":""}
FAIL route ran to the end :: page.check: Timeout 30000ms exceeded.
FORMS FLOW: FAIL (cases run: 5) - passive-owners, passive-none, ffi-giin, treaty-entity, route
```

## Gate

The Task 2 verify command, with this tree's counts (SCRATCH/exec-06-20/gate.sh), run from a script file. It passed on the first run. Last lines verbatim (SCRATCH/exec-06-20/gate.txt):
```
GATE ok   server tests # fail 0
GATE ok   STATUS MATH
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (26)
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
- **Server tests:** 178 pass, 0 fail. No server code changed, so no server test was added.
- **STATUS MATH:** 12 cases. **FORM MAPS:** 3 forms.
- **PASS lines, all with 0 FAIL:**
  - forms-flow: 643 (420 before).
  - status-flow: 388.
  - server-mode: 259.
- **Owner walks:** walkA 13/0, walkB 10/0, walkC 17/0 (individual) and 17/0 (entity). The leak search passed (418 files, 520 commit messages).
- **Tracer:** the Task 1 verify (`--case foreign-entity`) printed `FORMS FLOW: PASS (cases run: 1)`. It was re-run on the committed tree before expanding.
- **server/node_modules** was linked for the gate only, removed afterwards, and never staged.

## What each case measured

Every W-8BEN-E case (w8eCase) runs the same way:
1. The sponsor invites the entity as a foreign entity.
2. The walk reaches the tax step with no field errors.
3. Continue builds a tax envelope titled "Form W-8BEN-E - <account>", with that investor as its one signer. The signature and date sit on page 8.
4. The controlling person signs and finishes.
5. The record and the one Documents entry (category Tax) are checked. The stored file equals sha256Signed.

The stored signed PDF is then read back over all 8 pages:
- zero form fields, and the certificate as page 9;
- every expected value inside its own field, with the blank form's printed words taken out;
- every other mapped text field (49) empty;
- exactly the expected boxes have ink, and the other 67 mapped boxes have none;
- the date at page 8's date place is MM-DD-YYYY;
- the caption "Signed electronically <date> <time> UTC" is on page 8;
- signature ink is inside the sign place;
- no typed tax number is saved anywhere;
- white label holds, with no script error and no outside request.

The cases:
- **foreign-entity** (41 checks). Coral Reef Capital Ltd., a Cayman Islands corporation and Active NFFE.
  - Only the two status questions and the foreign tax ID are asked.
  - Form: lines 1, 2, 6 and 9b. Boxes: corporation, Active NFFE, Part XXV and capacity. Print name Annika Lindqvist-Barros.
  - Console row: "W-8BEN-E signed Nov 15, 2026, valid until Dec 31, 2029". Its Download has the same SHA-256 as the stored copy.
- **passive-owners** (46 checks). Maison Verdier Holding SAS, France, a Passive NFFE.
  - The owners statement is asked. "Listed" shows two rows, with names pre-filled from the beneficial owners.
  - Form: Part XXVI 40a and 40c. Part XXIX rows 1 and 2 have the name, address and TIN in their own cells; owner 2's name was edited.
  - The TINs print as 987-65-4321 and 876-54-3219. Neither TIN, in any spacing, is in the workspace or in storage.
- **passive-none** (34 checks). Tanjong Pagar Family Trust, Singapore, a simple trust and Passive NFFE.
  - Owners "none" and line 9c ticked.
  - Boxes: simple trust, hybrid No, Passive NFFE, 40a, 40b, 9c and capacity. Part XXIX is empty.
- **ffi-giin** (38 checks). Nordhavn Kapital A/S, Denmark, a Reporting Model 1 FFI.
  - The GIIN is not asked of an NFFE.
  - A GIIN typed in part is pointed out with one sentence, and the step stays.
  - "98Q96B.00000.LE.250" prints on line 9a. Boxes: corporation, Model 1 FFI and capacity. No NFFE part is ticked.
- **treaty-entity** (46 checks). Rheinwerk Beteiligungen GmbH, formation "Düsseldorf, Germany", an Active NFFE.
  - No treaty question on the first view.
  - "Change your answers" shows every answer as the form would carry it. The limitation on benefits question appears only once a treaty country is picked: one answer of eleven.
  - Form: Part III 14a with Germany, 14b, the active trade box, and line 15's article, rate, income and two condition lines.
- **route** (18 checks).
  - Chapter 3 offers exactly 5 answers and chapter 4 exactly 6, each ending in "Something else".
  - An unsigned W-8BEN-E is built first, then the investor goes Back.
  - Chapter 4 "Something else" shows one line naming W-8IMY, W-8ECI and W-8EXP and the firm's address. Nothing else is asked, and there is no "Change your answers".
  - Two supported statuses remove the line again. Chapter 3 "Something else" shows it again.
  - The button reads Continue, and Continue moves on. The unsigned envelope is voided, and no new one is made.
  - Nothing is on file. The log reads "Tax form not completed".

Screens and forms to look at (SCRATCH = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad):
- the steps: SCRATCH/exec-06-20/checks-out/forms-flow/<case>/<case>-answers.png and <case>-answered.png; route/route-answers.png
- the signed forms: SCRATCH/exec-06-20/checks-out/forms-flow/<case>/signed.pdf
- renders I viewed:
  - SCRATCH/exec-06-20/view-fe-p1.png and view-fe-p8.png
  - SCRATCH/exec-06-20/view-po-p7.png and view-po-p8.png
  - SCRATCH/exec-06-20/view-pn-p1.png
  - SCRATCH/exec-06-20/view-te-p2.png
  - SCRATCH/exec-06-20/owners-crop.png (the owner rows after the layout fix)

## Deviations from Plan

1. **[Rule 2] The typed foreign certification was removed.** It was the stand-in for the W-8BEN-E. With the W-8BEN-E in place, nothing reaches it. This also removed its unused answers (taxCountry, the w8 tick, taxSig) and its validation. Commit 2c1038e.
2. **[Rule 2] An unsigned W-8BEN-E is voided when the investor then picks "Something else".** Otherwise a form with the wrong status would stay live to sign (T-06-43). Its files are deleted. A signed earlier form stays, by 06-18's keep rule. Commit 7fde641.
3. **[Rule 2] Hybrid question for a simple trust.** Line 4 asks it of a simple trust. Leaving it blank would leave the form incomplete. Commit 7fde641.
4. **[Rule 2] Malformed input is pointed out, never required (D-30).** A GIIN that is not 19 characters in its layout gets one sentence. So does a part-typed owner TIN or entity U.S. TIN.
5. **The routing line names a send-to address, not an upload.** Upload is plan 06-21.
6. **console.js** needed only its comment changed. The 06-18 row already prints the form name and validUntil for any W-8.
7. **Gate counts** follow the merged tree (Failures first, item 3).
8. **Ledger.** The ledger file under the git directory was not used (worktree guard). `commits` was measured from SCRATCH/exec-06-20/base-commit.txt with SCRATCH/exec-06-20/actuals.sh.

## TDD Gate Compliance (Task 2)

- RED: cb85a08 `test(06-20): ... (red)`. Run against 2c1038e: FORMS FLOW: FAIL (cases run: 5), every case failing (quoted above).
- GREEN: 7fde641 `feat(06-20): ...`. FORMS FLOW: PASS (cases run: 6) for the six W-8BEN-E cases, then the full gate.

## Known Stubs

None that block this plan's goal.
- Uploading a W-8IMY, W-8ECI or W-8EXP is plan 06-21. Until then, the routing line gives the firm's address.
- In server mode the signed W-8BEN-E stays on the investor's device, like the W-9 and W-8BEN. That is plan 06-22.

## Threat model

- **T-06-43:**
  - Only the nine supported statuses (4 + 5) build a W-8BEN-E.
  - Each status is one radio answer and ticks exactly one box. The route case proves the answer lists; the other cases prove that exactly the expected boxes are ticked.
  - "Something else" builds nothing, and an unsigned earlier form is voided.
  - Only map keys are filled, and every case checks that all other mapped fields are empty.
- **T-06-44:**
  - The owners' TINs, typed by row, are in SECRET. After the form is built they live only in page memory, and they are deleted when the form is finished.
  - passive-owners proves that neither TIN, in either spacing, is in the workspace, local or session storage, or the change log.
- **T-06-SC:** no package was installed.

## Threat Flags

None. No new endpoint, storage, or trust boundary.

## Self-Check: PASSED

- Files present:
  - assets/js/onboarding.js
  - assets/js/console.js
  - checks/forms-flow.js
  - 06-20-SUMMARY.md
- Commits 2c1038e, cb85a08 and 7fde641 are on HEAD (git rev-list ebde9ae..HEAD = 3).
- No untracked file is left. server/node_modules was removed after the gate and never staged. Nothing was written into assets/ apart from the two source files the plan names.
