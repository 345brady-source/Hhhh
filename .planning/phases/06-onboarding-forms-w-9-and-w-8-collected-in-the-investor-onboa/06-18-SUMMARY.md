---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 18
subsystem: investor onboarding tax step (W-8BEN), console investor row
status: complete
tags: [tax-forms, w-8ben, d-01, d-04, d-06, d-09, d-30, form-07, onboarding]
requires: [06-10, 06-13, 06-16, 06-17]
provides:
  - tax step for a foreign individual or foreign joint account - official W-8BEN (Rev. October 2021), pre-filled, signed on the page
  - investor.taxCert for a W-8BEN { form, revision, envelopeId, at, signed, signedBy, country, ftinLast4, noFtin, treatyCountry, validUntil }
  - console row "W-8BEN signed <date>, valid until <date>" (or "W-8BEN not signed")
  - keep-or-rebuild rule on the tax step for W-9 and W-8BEN (research FORM-07), compared in page memory only
  - forms-flow.js cases foreign-individual, noftin, edit, editsigned; foreign updated; investor-type reads the new view
affects: [06-19, 06-20, 06-22]
tech-stack:
  added: []
  patterns:
    - "the answers a form was built from are kept in page memory by envelope id, without the tax numbers; a tax number typed again counts as a change"
    - "a W-8BEN country is picked from the fixed list; a typed name only beside 'Another country'"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-18-SUMMARY.md
  modified:
    - assets/js/onboarding.js
    - assets/js/console.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
decisions:
  - "Country of citizenship on the W-8BEN: Investor information only asks United States or Another country, so for another citizenship the form gives the residence country, and the step says so in one sentence ('It gives Germany, where you live, as your country of citizenship.'); the investor changes it under Change your answers"
  - "Treaty country (line 9) is pre-filled only for the 38 countries of the portal's list that have a U.S. income tax treaty in force, taken from the IRS A-to-Z treaty list (irs.gov, last reviewed 3 Jan 2026); Hungary is left out (treaty terminated effective 8 Jan 2023)"
  - "Planner's choices applied: a foreign joint account gets one W-8BEN for the first holder (one line says whose form it is); the capacity box stays unticked and sits under Change your answers"
  - "An unsigned form whose answers did not change is shown again on Continue (not voided and rebuilt); a signed one is kept and the flow moves on"
  - "The foreign tax ID and a U.S. TIN typed on the W-8BEN stay in page memory until the form is finished, so a corrected answer rebuilds the form with them; they are never saved"
metrics:
  duration: "31 min from recording the base (21:39 UTC) to the gate's end (22:10 UTC)"
  completed: 2026-11-15
  tasks: 2
  files: 3
actuals:
  tokens: 11700    # chars/4 over the 46,790 characters of added lines in 87f4af7..71eaa9f
  tasks: 2
  commits: 4       # git rev-list --count 87f4af7..HEAD before this summary commit
plan_head_before: 87f4af7c01d5add4f97e1a753d1a52cbfb2a434e
plan_head_after: 71eaa9fda39d721821409e6b3bd8a8903c335f2a
---

# Phase 6 Plan 18: A foreign individual signs the pre-filled official W-8BEN; an edited answer always reaches the form

When the sponsor invites someone as a foreign individual, the tax step now leads to the official IRS Form W-8BEN (Rev. October 2021). It no longer shows the typed certification. The only question on the step is the foreign tax ID, or a tick saying one is not legally required. Everything else comes from onboarding: name, country of citizenship, home street, city line and country, date of birth as MM-DD-YYYY, the treaty country, and the print name. The investor signs the form on the page. The date beside the signature is today, written MM-DD-YYYY. The record keeps the validity date, and the sponsor's investor row reads "W-8BEN signed Nov 15, 2026, valid until Dec 31, 2029". Back from the form plus a changed answer voids the unsigned form and builds a new one. Back on a signed form with nothing changed keeps it.

The owner has not checked any of this. It is not done until he has looked at it.

## Failures first

1. **My own check would not load on its first run.** I had put an `await` inside a plain `map` in the new `taxEnvelopes` helper. Node refused the file with a syntax error, so no case ran. I fixed the helper before the RED run that counts. No product code was involved.
2. **The `noftin` case passed on the Task 1 commit, so its RED was never shown.** The not-required tick is part of Task 1's W-8BEN view, and the plan puts the case in Task 2. It now guards against regressions only.
3. **Gate counts differ from the plan text, as the orchestrator said they would.**
   - FORMS FLOW is 14 cases, not 13: the merged tree had 10, and this plan adds 4.
   - STATUS FLOW is 25 parts, not 29. SERVER MODE is 8, not 10.
   - The gate script (SCRATCH/exec-06-18/gate.sh) checks these exact numbers.
4. **Known limit: a reload empties the comparison.** What a form was built from is kept in page memory only, as the plan asks (no stored fingerprint). After a page reload, Back and Continue on a signed form therefore builds a new form to sign even when nothing changed. That is what happened every time before this plan. Without a reload the signed form is kept (case `editsigned`).
5. **Known limit carried from 06-16 (W-9).** The SSN leaves memory once it is in a form. If the investor goes Back, changes another answer and does not type the SSN again, the new W-9 has no SSN. The step asks for the number in that state. Going Back without changing anything keeps the signed or unsigned form that has the SSN.
6. **The investor-type case (06-16) was changed.** Two of its checks looked for the old typed certification on the foreign tax step. They now look for the W-8BEN view. The behaviour changed on purpose, so the checks were updated to it, not loosened.
7. **Two things for the owner to judge.**
   - **Country of citizenship.** Investor information only asks "United States" or "Another country", so it never learns which country. The W-8BEN therefore gives the residence country, and the step says so in one sentence. An investor who is a citizen elsewhere changes it under "Change your answers".
   - **Treaty country.** Line 9 is pre-filled from the IRS treaty list (fetched from irs.gov, allowed by D-05). It is a treaty claim that the investor signs. They see it on the form before signing and can clear it.

## RED runs (quoted)

Task 1, on the base code (SCRATCH/exec-06-18/red-t1.txt): 6 PASS, 7 FAIL, ending:
```
FAIL foreign-individual the tax step asks only for the foreign tax ID or the not-required tick :: ["ob-taxCountry","ob-ftin","ob-noFtin","ob-treaty","ob-w8","ob-taxSig"]
FAIL foreign-individual the button goes to the form :: Continue
FAIL foreign-individual ran to the end :: page.waitForSelector: Timeout 60000ms exceeded.
FAIL foreign the record says W-8BEN, not signed, no validity date :: {"form":"W-8BEN","at":"2026-11-15T21:46:26Z","signed":false,"signedBy":"","country":"Germany",...}
FORMS FLOW: FAIL (cases run: 2) - foreign-individual, foreign
```
Task 2, on the Task 1 commit (SCRATCH/exec-06-18/red-t2.txt): 22 PASS, 4 FAIL:
```
FAIL edit the first envelope is voided with the reason "answers changed before signing" :: {...,"voidReason":"The investor changed their answers before signing; a new form was prepared",...}
FAIL edit Back and Continue with nothing changed keeps the same form (no new envelope, nothing voided) :: [["env-mwidgovfe74ao","voided"],["env-mwidgpfd3jot8","voided"],["env-mwidgq0eriui3","sent"]]
FAIL editsigned Continue with no change keeps the signed form and moves on :: {"heading":"Tax certification","list":[["env-mwidgstrhpgjy","completed"],["env-mwidgujdlx7q1","sent"]]}
FAIL editsigned ran to the end :: page.click: Timeout 30000ms exceeded.
FORMS FLOW: FAIL (cases run: 3) - edit, editsigned
```

## Gate

The Task 2 verify command, with this tree's counts (SCRATCH/exec-06-18/gate.sh). It passed on the first run. Last lines verbatim (SCRATCH/exec-06-18/gate.txt):
```
GATE ok   server tests # fail 0
GATE ok   STATUS MATH
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (14)
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
- Server tests: 178 pass, 0 fail. No server test was added because nothing server-side changed.
- STATUS MATH: 12 cases. FORM MAPS: 3 forms.
- PASS lines, all with 0 FAIL:
  - forms-flow: 251 (179 before).
  - status-flow: 388.
  - server-mode: 259.
- Owner walks: walkA 13/0, walkB 10/0, walkC 17/0 and 17/0. The leak search passed (416 files, 504 commit messages).
- The Task 1 tracer verify (`--case foreign-individual,foreign`) printed `FORMS FLOW: PASS (cases run: 2)`.
- server/node_modules was linked for the gate only, removed afterwards, and never staged.

## What each case measured

- **foreign-individual** (38 checks). Zoë Müller-Łukasz is invited as a foreign individual. She is a citizen of Germany and lives at Königsallee 27, Düsseldorf 40212. Her date of birth is 1980-04-02.
  - The tax step shows exactly two inputs: the foreign tax ID and the not-required tick.
  - The step names the W-8BEN and says it gives Germany, where she lives, as her country of citizenship. The button reads "Continue to the form".
  - Continue builds a tax envelope titled "Form W-8BEN - Zoë Müller-Łukasz" (W-8BEN, Rev. October 2021) with her as the one signer. The full foreign tax ID is saved nowhere.
  - She signs, presses Finish and reaches Distribution payments.
  - Record:
    - taxForm W-8BEN.
    - taxCert: form, revision, envelope, ISO time, signed true, signedBy her name, country Germany, ftinLast4 8901, noFtin false, treatyCountry Germany, validUntil 2029-12-31.
    - The change log says "Tax form signed".
    - There is one Documents entry: category Tax, for her alone. The stored file equals sha256Signed.
  - Signed PDF:
    - Zero form fields. The certificate is page 2.
    - Each value prints inside its own field rectangle: line 1 name, line 2 Germany, line 3 street, city line and Germany, line 6a 12345678901, line 8 04-02-1980, line 9 Germany, and the print name.
    - Nothing prints in lines 4, 5, 7 or 10.
    - The name prints exactly.
    - The 6b box and the capacity box have no ink.
    - The Date place reads 11-15-2026.
    - The caption reads "Signed electronically 2026-11-15 HH:MM UTC".
    - Signature ink is inside the sign place.
  - The console row reads "W-8BEN signed Nov 15, 2026, valid until Dec 31, 2029". Its Download has the same SHA-256 as the stored copy.
  - White label holds, with no script error and no outside request.
- **foreign** (8 checks, 06-17's case brought to the W-8BEN path).
  - Continue with nothing filled shows no error and builds the form. Finish without a signature moves on.
  - The record is W-8BEN, signed false, signedBy empty, with no validUntil.
  - The log says "Tax form completed without a signature".
- **noftin** (7 checks).
  - The tick takes the foreign tax ID field off the step.
  - On the form, the 6b box has ink and line 6a is empty.
  - The record has noFtin true and ftinLast4 empty.
- **edit** (12 checks, W-8BEN).
  - She types her foreign tax ID and continues, then goes Back. "Change your answers" shows "Königsallee 27", which she changes to "Kaiserswerther Straße 115" before continuing.
  - The first envelope is voided: "Answers changed before signing; a new form was prepared". Its stored file is gone.
  - Exactly one tax envelope of the flow is not voided.
  - The new form prints the new street, and still has the foreign tax ID typed before, without her typing it again.
  - Back and Continue with nothing changed shows the same form: no new envelope, nothing more voided.
  - Afterwards the foreign tax ID is saved nowhere.
- **editsigned** (14 checks, W-9).
  - He signs the W-9 and reaches Distribution payments. Back shows the tax answers.
  - Continue with no change keeps the signed form, voids nothing and moves on.
  - Back again, a new street and Continue: a new form to sign that prints "480 Canal Street Apt 9".
  - The earlier signed form is still completed and still in the record (taxCert, signed true) until the new form is finished. It stays in Documents with its file, also after the new form is finished.

Screens to look at:
- SCRATCH/exec-06-18/checks-out/forms-flow/foreign-individual/foreign-individual-answers.png (the one question)
- SCRATCH/exec-06-18/checks-out/forms-flow/foreign-individual/foreign-individual-signing.png
- SCRATCH/exec-06-18/view-signed.png (the signed W-8BEN page at 80 dpi), plus signed.pdf in the same case folder

## Deviations from Plan

1. **[Rule 2] An unchanged unsigned form is shown again, not voided and rebuilt.** The plan's truths need one live tax envelope and a void only when answers change. Rebuilding on every Continue (the 06-16 behaviour) voided a form that nothing had changed. The edit case covers this. Commit 71eaa9f.
2. **[Rule 2] Tax numbers on the W-8BEN.**
   - The foreign tax ID and a U.S. TIN typed there stay in page memory until the form is finished. Otherwise a correction to the street would have dropped them from the rebuilt form.
   - They are never saved: `w8UsTin` was added to SECRET, and `ftin` was already in it.
   - A number typed again counts as a change. One not typed again does not.
   - Commits a530633 and 71eaa9f.
3. **[Rule 1] The earlier form's files are deleted before the new envelope is made.** Before, the deletion ran without being awaited. Now it is awaited, so the void and the delete have both finished before the next form exists. Commit 71eaa9f.
4. **The void reason was reworded for the W-9 too.** It now reads "Answers changed before signing; a new form was prepared". No check outside this plan matched the old wording (searched).
5. **T-06-40 and "Another country".** Countries come from the fixed list. The list ends with "Another country", and for that choice only, a typed country name (at most 40 characters) appears beside it. Without it, a resident of a country not on the list would get a W-8BEN with no country.
6. **Treaty list.** No treaty list existed in the code, so I fetched the IRS A-to-Z page (irs.gov, allowed by D-05). I kept the 38 countries of the portal's list that have a treaty in force and left Hungary out, because the IRS Hungary page states the treaty was terminated.
7. **The validUntil year** is taken from the date stamped beside the signature on the form, or today's date when none is stamped.
8. **The keep-or-rebuild rule was held back from the Task 1 commit.** It went into the Task 2 commit, so that Task 2's RED ran against Task 1 as the plan asks.
9. **Ledger.** The ledger file under the git directory was not used (worktree guard). `commits` was measured from SCRATCH/exec-06-18/base-commit.txt.

## Known Stubs

None that block this plan's goal.
- A foreign entity still gets today's typed certification. Plan 06-20 brings the W-8BEN-E.
- In server mode the signed W-8BEN stays on the investor's device, as the W-9 does. That is plan 06-22's job.

## Threat model

- **T-06-40:**
  - Dates come from the date input (Investor information, or the date field under "Change your answers") and are written as MM-DD-YYYY.
  - Countries come from the fixed list, with a typed name of at most 40 characters only beside "Another country".
  - The fill cuts every value to its field's MaxLen (U.S. TIN 11, date of birth 10), and the inputs carry maxlength.
- **T-06-41:** an unsigned earlier form is voided and its files are deleted before the new one is made. The edit case proves there is one live envelope and that it carries the new street. The editsigned case proves a signed form is never voided.
- **T-06-SC:** no package was installed.

## Threat Flags

None. No new endpoint, storage, or trust boundary. The new answers are written only into the official form and the investor record (the last four characters of tax numbers only).

## Self-Check: PASSED

- Files present:
  - assets/js/onboarding.js
  - assets/js/console.js
  - checks/forms-flow.js
  - 06-18-SUMMARY.md
- Commits 68f8d7c, a530633, 9009bca and 71eaa9f are on HEAD.
- No untracked file is left. server/node_modules was removed after the gate and never staged. Nothing was written into assets/.
