---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 19
subsystem: investor onboarding tax step (W-9 for every U.S. account type)
status: complete
tags: [tax-forms, w-9, d-01, d-04, d-06, d-09, d-30, onboarding]
requires: [06-10, 06-16, 06-17, 06-18]
provides:
  - W-9 line 3a classification asked as radios for an entity's or an IRA's account; LLC tax letter; "other" text; line 3b for a partnership, trust or estate, or LLC taxed as a partnership
  - disregarded LLC on the W-9 - line 1 the owner (the controlling person on file), line 2 the LLC, individual box, the owner's SSN (memory only)
  - IRA W-9 with exempt payee code 1 pre-filled (editable); trust W-9 with trust or estate pre-ticked; joint W-9 for the first holder, with one line saying so
  - "Change your answers" on the W-9 adds line 2 and, for an organisation's account, whether the number is an EIN or an SSN
  - forms-flow.js w9AccountCase helper and cases us-llc, us-ccorp, us-trust, us-disregarded, us-ira, us-joint
affects: [06-21, 06-22]
tech-stack:
  added: []
  patterns:
    - "the classification answers carry the account type they were given for (w9ClassFor); a changed account type starts them again"
    - "a W-9 read back field by field with the blank form's own printed words taken out, so a field that overlaps a printed label is still checked as empty or filled"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-19-SUMMARY.md
  modified:
    - assets/js/onboarding.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
decisions:
  - "D-09 pre-selection of the classification: joint -> individual (no question); trust -> trust or estate (no question); IRA -> trust or estate chosen, radios shown so it can be changed; LLC or corporation -> LLC chosen only when the account name ends in LLC (C or S for a corporation is not known, so nothing is chosen)"
  - "Line 3b is never offered for an IRA (a tax-exempt account, not a flow-through entity) or a person's account"
  - "A disregarded LLC's owner is taken to be the controlling person on file (an individual): individual box and that person's SSN, asked on the step; the LLC's EIN from Investor information is not put on the form"
  - "A trust's number goes into the EIN boxes unless the investor says it is an SSN under Change your answers (Investor information asks 'SSN or EIN of the trust')"
metrics:
  duration: "26 min from recording the base (22:16:59 UTC) to the gate's end (22:42 UTC)"
  completed: 2026-11-15
  tasks: 2
  files: 2
actuals:
  tokens: 7500     # chars/4 over the 29,931 characters of added lines in 5af1666..1775075
  tasks: 2
  commits: 4       # git rev-list --count 5af1666..HEAD before this summary commit
plan_head_before: 5af1666ece56afa9bfadcf3787ed14b7686dc888
plan_head_after: 1775075be7221496aeb92bd385aa0446ec1d2687
---

# Phase 6 Plan 19: The W-9 for every U.S. account type

Every U.S. account type now gets the official W-9 (Rev. March 2024), filled in from onboarding. The step asks only what onboarding does not already know.

- **Entity (LLC or corporation):** the step asks the federal tax classification once, as seven radios in the form's order. For an account named "... LLC", LLC is already chosen.
  - An LLC is asked how it is taxed (C, S or P), and whether it is disregarded for U.S. tax.
  - "Other" asks for the text the form should print.
- **Line 3b** (foreign partners, owners or beneficiaries) is offered only for a partnership, a trust or estate, or an LLC taxed as a partnership.
- **Disregarded LLC:** line 1 is the owner (the controlling person on file) and line 2 is the LLC. The individual box is ticked, and the owner's SSN is asked on the step. It stays in page memory only and is never saved.
- **Trust:** trust or estate is ticked without a question, and line 3b is offered unticked.
- **IRA:** the classification is asked like an entity's, with trust or estate chosen to start. Exempt payee code 1 is pre-filled. It can be changed or emptied under "Change your answers", and when emptied nothing prints.
- **Joint account:** the form is the first holder's, and one line on the step says so.
- **Taxpayer ID:** the number goes into the SSN boxes or the EIN boxes according to the account's answers.
- **Nothing is required (D-30).**

The owner has not checked any of this. It is not done until he has looked at it.

## Failures first

1. **us-ccorp passed on the Task 1 commit, so it never showed RED.** The entity classification, which is what it tests, is Task 1's work. It guards against regressions only. The other four Task 2 cases failed on the Task 1 commit (quoted below).
2. **Gate counts differ from the plan text, as the orchestrator said they would.**
   - FORMS FLOW is 20 cases, not 19: the merged tree had 14, and this plan adds 6.
   - STATUS FLOW is 25 parts, not 29. SERVER MODE is 8, not 10.
   - The gate script (SCRATCH/exec-06-19/gate.sh) checks these exact numbers.
3. **Known limit carried from 06-16:** a taxpayer number leaves page memory once it is in a form. The same now holds for a disregarded LLC owner's SSN. After Back and a changed answer, the step asks for the number again; if it is left empty, the new form has none. The us-ira case types the EIN again for that reason.
4. **Four choices for the owner to judge.** Each is a planner's choice or a D-09 reading, not settled law.
   - **IRA classification.** Trust or estate is pre-chosen. Custodians use either "Trust/estate" or "Other: IRA"; the radios stay on screen so the investor can change it. Plan 06-21 adds uploading the custodian's own form.
   - **"Ends in LLC".** That pre-selects LLC. The tax letter is still asked, and the LLC choice can be changed.
   - **Disregarded LLC owner.** The owner is taken to be the controlling person on file, an individual. An LLC owned by another entity would need that entity's name and EIN. That can be done under "Change your answers" (line 1, line 2, and EIN or SSN), but the step does not offer it directly.
   - **Trust taxpayer ID.** A trust's number goes into the EIN boxes. A grantor trust that gave an SSN has to say so under "Change your answers".

## RED runs (quoted)

Task 1, us-llc on the base code (SCRATCH/exec-06-19/red-t1.txt):
```
FAIL us-llc the step asks the federal tax classification once, as radios (individual, C corp, S corp, partnership, trust or estate, LLC, other) :: {"values":[],"chosen":""}
FAIL us-llc LLC is chosen already, because the account’s name ends in LLC :: 
FAIL us-llc the step asks only about the classification (the EIN given at Investor information is known) :: []
FAIL us-llc ran to the end :: page.check: Timeout 30000ms exceeded.
FORMS FLOW: FAIL (cases run: 2) - us-llc
```
Task 2, on the Task 1 commit (SCRATCH/exec-06-19/red-t2.txt): 104 PASS, 10 FAIL:
```
FAIL us-trust the step offers line 3b for the trust, and only that :: []
FAIL us-disregarded "disregarded for U.S. tax?" is asked for the LLC
FAIL us-ira the IRA’s classification is asked as radios, trust or estate chosen to start :: {"values":[],"chosen":""}
FAIL us-ira signed W-9: "1" prints inside its own field (exemptPayee) :: {"field":"f1_05[0]","inside":""}
FAIL us-ira signed W-9: ticked boxes are exactly ["trust"] :: {"individual":0,"ccorp":0,"scorp":0,"partnership":0,"trust":0,"llc":0,"other":0,"foreignOwners":0}
FAIL us-joint one line says the form is the first holder’s :: Your Form W-9 is filled in from your answers. You check it and sign it on the next screen. ...
FORMS FLOW: FAIL (cases run: 5) - us-trust, us-disregarded, us-ira, us-joint
```
The us-ira RED shows a real gap that existed before this plan: an IRA's W-9 had no classification box ticked at all.

## Gate

The Task 2 verify command, with this tree's counts (SCRATCH/exec-06-19/gate.sh). It passed on the first run. Last lines verbatim (SCRATCH/exec-06-19/gate.txt):
```
GATE ok   server tests # fail 0
GATE ok   STATUS MATH
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (20)
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
- **Server tests:** 178 pass, 0 fail. No server code changed.
- **STATUS MATH:** 12 cases. **FORM MAPS:** 3 forms.
- **PASS lines, all with 0 FAIL:**
  - forms-flow: 420 (251 before).
  - status-flow: 388.
  - server-mode: 259.
- **Owner walks:** walkA 13/0, walkB 10/0, walkC 17/0 (individual) and 17/0 (entity). The leak search passed (417 files, 511 commit messages).
- **Tracer:** the Task 1 verify (`--case us-llc,us-individual`) printed `FORMS FLOW: PASS (cases run: 2)`.
- **server/node_modules** was linked for the gate only, removed afterwards, and never staged.

## What each case measured

Every case goes the same way:
1. The sponsor invites the investor with the investor type.
2. The walk reaches the tax step with no field errors.
3. Continue builds a W-9 tax envelope with that investor as its one signer, and the investor signs and finishes.
4. The record keeps the signed W-9 and only the last four digits of the number. No full number is in the workspace or local storage.
5. There is one Documents entry: category Tax, for that investor alone. The stored file equals sha256Signed.

The stored signed PDF is then read back:
- Zero form fields.
- Each expected value prints inside its own field rectangle, with the blank form's own printed words taken out.
- Every other text field prints nothing.
- Exactly the expected boxes have ink. A box counts when it has more than 10 px at 100 dpi, and no other box has any ink.
- Signature ink is inside the sign place, and the caption "Signed electronically <date> <time> UTC" is on page 1.
- White label holds, with no script error and no outside request.

The cases:
- **us-llc** (29 checks). Lakeshore Ridge Holdings LLC, controlling person Søren Ibáñez-Holt.
  - The step asks only the classification radios: seven, in the form's order, with LLC already chosen.
  - Picking LLC asks for the letter (C, S, P). Line 3b is not offered until the letter is P, and is offered after.
  - Form: line 1 "Lakeshore Ridge Holdings LLC", letter P in its own field, EIN 12 / 3456789 in the EIN cells. Boxes: LLC and 3b.
- **us-ccorp** (24 checks). Northgate Precision Tools, Inc.
  - The classification is asked with nothing chosen. After C corporation, nothing more is asked.
  - Form: line 1 the name, EIN in the EIN cells. Box: C corporation.
- **us-trust** (26 checks). Castellanos-Moore Family Trust.
  - No classification question. The only input on the step is the 3b tick, and it starts unticked.
  - Form: line 1 the trust, the EIN. Box: trust or estate only.
- **us-disregarded** (29 checks). Brightwater Studio LLC, owner Mireille Østergaard-Nwosu.
  - The "disregarded" tick is shown for the LLC. Ticking it removes the letter radios and 3b, and asks "Social Security number of Mireille Østergaard-Nwosu, the LLC’s owner".
  - The tick disappears for S corporation. Back on LLC, the tick and the typed SSN are as given.
  - Form: line 1 the owner, line 2 the LLC, SSN 512 / 40 / 7386. The EIN cells are empty. Box: individual.
  - The record has tinLast4 7386.
- **us-ira** (36 checks). Harbor Trust Company Custodian FBO Thandiwe Abernathy-Ruiz IRA.
  - The classification radios show with trust or estate chosen. No 3b, nothing else asked.
  - Signed form: line 1 the IRA, exempt payee code "1" in line 4, the EIN. Box: trust.
  - Then Back from Distribution payments and "Change your answers". It shows code 1, which is emptied, and the EIN is typed again.
  - The new form has nothing on line 4 and everything else as before. Finish moves on.
- **us-joint** (25 checks). Joaquín Ferreira-Lund and Maëlle Ferreira-Lund, JTWROS.
  - Nothing is asked on the step. One line reads "This is the form of Joaquín Ferreira-Lund, the first holder of the account."
  - Form: line 1 Joaquín Ferreira-Lund, SSN 123 / 45 / 6789. Box: individual.

Screens to look at:
- SCRATCH/exec-06-19/checks-out/forms-flow/<case>/<case>-answers.png and <case>-answered.png (the step before and after answering), plus <case>-signing.png.
- Signed forms: SCRATCH/exec-06-19/checks-out/forms-flow/<case>/signed.pdf.
- Renders of page 1: SCRATCH/exec-06-19/view-us-llc.png, view-us-disregarded.png, view-us-ira.png, view-us-trust.png, view-us-joint.png, view-us-ccorp.png, and view-us-ira-emptied.png (the IRA's second form, with line 4 empty).

## Deviations from Plan

1. **[Rule 2] Line 2 and the EIN-or-SSN choice under "Change your answers".**
   - Without line 2 the investor could not correct the disregarded LLC's name.
   - Without the EIN-or-SSN choice, a grantor trust that gave its SSN (Investor information asks "SSN or EIN of the trust") would have it printed in the EIN boxes.
   - Both are in the edit view only, so the first view stays lean. Commit 1775075.
2. **[Rule 2] The disregarded LLC's owner SSN is a separate in-memory answer (`ownerTin`, added to SECRET).** The number typed at Investor information is the LLC's EIN, and it must not go on the form. A part-typed owner SSN is pointed out ("Enter all nine digits, or leave this empty"), as the other tax numbers are. Commit 1775075.
3. **[Rule 1] taxCert.tinLast4 is now taken from the number the form carries,** not the one typed at Investor information, so a disregarded LLC's record names the owner's SSN digits. Commit 1775075.
4. **Line 3b is not offered for an IRA.** The plan offers it for a "trust or estate", and an IRA starts on that classification. An IRA is a tax-exempt account, not a flow-through entity, so it is left out.
5. **Gate counts** follow the merged tree (Failures first, item 2).
6. **Ledger:** the ledger file under the git directory was not used (worktree guard). `commits` was measured from SCRATCH/exec-06-19/base-commit.txt with SCRATCH/exec-06-19/actuals.sh.

## Known Stubs

None that block this plan's goal.
- Uploading an IRA custodian's own W-9 is plan 06-21.
- In server mode the signed W-9 stays on the investor's device, as before. That is plan 06-22's job.

## Threat model

- **T-06-42:**
  - Digits only.
  - The box set is chosen by the account's answers: a disregarded LLC uses the owner's SSN, a person's account uses the SSN, and an organisation uses the EIN unless the investor says SSN.
  - The fill splits the number by the form's own comb fields.
  - Every case checks that each group lands in its own field and that the other group's cells are empty.
- **T-06-SC:** no package was installed.

## Threat Flags

None. No new endpoint, storage, or trust boundary. The owner's SSN lives only in page memory until the form is built, and only its last four digits reach the record.

## Self-Check: PASSED

- Files present: assets/js/onboarding.js, checks/forms-flow.js, 06-19-SUMMARY.md.
- Commits 481abaf, 3a3222d, d18c96a and 1775075 are on HEAD.
- No untracked file is left. server/node_modules was removed after the gate and never staged. Nothing was written into assets/.
