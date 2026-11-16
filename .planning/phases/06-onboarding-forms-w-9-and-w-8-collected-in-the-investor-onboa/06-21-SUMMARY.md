---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 21
subsystem: investor onboarding tax step (upload of a form completed elsewhere), console investor row
status: complete
tags: [tax-forms, upload, w-8imy, w-9, d-01, d-06, d-30, form-05, wl-01, onboarding]
requires: [06-16, 06-17, 06-18, 06-19, 06-20]
provides:
  - tax step link "Upload it instead" on the W-9, W-8BEN and W-8BEN-E answers; the "Something else" routing line offers "Upload the completed form" instead of an address to email
  - upload view - which form it is (by account) and the file (PDF, PNG or JPEG by first bytes, at most 25 MB); Back returns to the answers
  - stored under tax-<investor id>-<time in base 36>; investor.taxForm the form named; investor.taxCert { form, uploaded true, fileId, fileName, at }
  - console row "<form> uploaded <date> · Download", the Download offered only for a file under the investor's own tax- id
  - voidUnsignedTax(c, reason) shared by the routed path and the upload
  - forms-flow.js cases upload, upload-ira, upload-refused; helpers samplePdf, samplePng, storedIds, uploadRecord, consoleTaxRow, chooseFile
affects: [06-22, 06-23]
tech-stack:
  added: []
  patterns:
    - "a chosen file checked by first bytes and size when chosen, held in page memory, checked again and stored only on Continue"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-21-SUMMARY.md
  modified:
    - assets/js/onboarding.js
    - assets/js/console.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
decisions:
  - "Owner's legal review (orchestrator removal accepted): no 'reviewed' mark on uploaded forms; the sponsor sees '<form> uploaded <date>' and downloads the file; taxCert has no reviewed field"
  - "The forms offered depend on the account: U.S. - Form W-9 (an IRA: 'The custodian's Form W-9') or another; foreign individual - W-8BEN, W-8ECI or another; foreign entity - W-8BEN-E, W-8IMY, W-8ECI, W-8EXP or another"
  - "The form the step would fill in is chosen to start (W-9, W-8BEN, W-8BEN-E); nothing is chosen for an entity routed by 'Something else'"
  - "'Another tax form' is recorded as taxForm 'Tax form'"
  - "Storing an upload voids an unsigned form built on the step (its files deleted); a form signed earlier stays completed with its Documents entry; Continue without a file changes nothing"
  - "A refused file leaves a file attached before it in place ('so it was not added' means nothing changed)"
metrics:
  duration: "28 min from recording the base (23:32:08 UTC) to the gate's end (00:00:31 UTC)"
  completed: 2026-11-16
  tasks: 2
  files: 3
actuals:
  tokens: 9400     # chars/4 over the 37,635 characters of added lines in 8da766e..02be586
  tasks: 2
  commits: 4       # git rev-list --count 8da766e..HEAD before this summary commit
plan_head_before: 8da766edc9157f123bf6ba7d84209d9b0ae86b05
plan_head_after: 02be58603799e5223c92290bdcf1fc2aa4a99fde
---

# Phase 6 Plan 21: Upload a completed tax form instead

On the tax step, an investor can now upload a form completed somewhere else instead of filling in the portal's form. One link sits under the answers of every form: "Already have a completed form? Upload it instead". For a foreign entity that picked "Something else", the routing line used to say "Send the completed form to Investor Relations at ir@...". It now says "Upload the completed form, or continue without it now."

The upload view asks two things:
- **Which form is it?** The choices depend on the account:
  - U.S.: Form W-9 (an IRA sees "The custodian's Form W-9"), or another tax form.
  - Foreign individual: W-8BEN, W-8ECI, or another.
  - Foreign entity: W-8BEN-E, W-8IMY, W-8ECI, W-8EXP, or another.
- **The completed, signed form:** a PDF, PNG or JPEG, at most 25 MB.

Back returns to the answers.

Continue stores the file under the investor's own id (tax-<investor id>-<time>). The record names the form, and the change log says "Tax form uploaded". The upload counts as on file everywhere: the Account page, the console row and the audit. In the sponsor's investor list the row reads, for example, "W-8IMY uploaded Nov 15, 2026 · Download", and Download gives back the same bytes. Nothing on the view is required (D-30): Continue without a file moves on.

Following the owner's legal review, there is no "reviewed" mark.

The owner has not checked any of this. It is not done until he has looked at it.

## Failures first

1. **No failure in the product or the gate.** The gate passed on its first run.
2. **Two of my checks were wrong on first writing; neither was a product fault.**
   - `upload-ira` read every `.field-error` on the page. It picked up an empty `role="alert"` paragraph that the signing dialog (signature.js `#es-adopt-err`) leaves in the page after the W-9 was signed. That paragraph is not on the tax form and holds no message. The check now reads only the step form's messages.
   - Its log check expected `:: Form W-9`, but every log detail starts with the account name. The pattern now allows for it.
   - Both were fixed before the RED commit, and the RED quoted below is from the corrected check.
3. **`upload-ira` passed on the Task 1 commit, so its RED was never shown.** The custodian's W-9 and the keep-signed rule are Task 1's work, so this case now only guards against regressions. Only `upload-refused` showed RED on the Task 1 commit.
4. **A space was dropped by mistake.** One Edit call removed the space in `const who = ira ? '' : \``. That is whitespace only. It was restored after the gate in commit 02be586; `git diff -w` was empty for it, and the line is identical to the base again. The owner-set leak search was re-run on the final HEAD and passed (419 files, 526 commit messages).
5. **Gate counts differ from the plan text.** The plan predates the merge.
   - FORMS FLOW is 29 cases, not 28: the merged tree had 26, and this plan adds 3.
   - STATUS FLOW is 25 parts, not 29. SERVER MODE is 8, not 10.
   - The gate script (SCRATCH/exec-06-21/gate.sh) checks these exact numbers, plus server tests 178 and STATUS MATH 12.
6. **Things seen and not changed:**
   - **"No file chosen" next to "Attached".** After a file is attached, the browser's own file control still says "No file chosen" beside "Attached: <name>", because the page redraws the control empty. The representative acknowledgment (06-15) and the ID upload behave the same. Changing it is a product-wide styling change, so it is left for the UI overhaul.
   - **Server mode.** An uploaded form stays in the investor's browser. The server allowance for tax- files is plan 06-23, and sending tax files is plan 06-22.
   - **Documents list.** The upload is not added to the investor's Documents list. The record, the Account page, the console row and the audit carry it.

## RED runs (quoted)

**Task 1** (tracer). The `upload` case run against the base product code with SCRATCH/exec-06-21/red-t1.sh (SCRATCH/exec-06-21/red-t1.txt): 2 PASS, then
```
FAIL upload the answers view has one link to upload a completed form instead :: []
FAIL upload the routing line offers the upload of the completed form: one link, no address to send it to :: {"line":["This status needs a form the portal does not fill in: usually Form W-8IMY (partnerships, grantor trusts and intermediaries), Form W-8ECI (income effectively connected with a U.S. tra
FAIL upload the link opens the upload view :: Kestrel Bay
FORMS FLOW: FAIL (cases run: 1) - upload
```

**Task 2.** The committed test 0cafe16 run against the Task 1 product code (SCRATCH/exec-06-21/red-t2b.txt): 32 PASS, 1 FAIL
```
FAIL upload-refused a refused file after it leaves the PDF attached, with the one sentence :: {"hint":"PDF, PNG or JPEG, up to 25 MB.","errors":["This file is not a PDF, PNG or JPEG, so it was not added."]}
FORMS FLOW: FAIL (cases run: 2) - upload-refused
```
The first run of the same cases, before my two check fixes, is in SCRATCH/exec-06-21/red-t2.txt.

## Gate

The Task 2 verify command, with this tree's counts, run from a script file (SCRATCH/exec-06-21/gate.sh). It passed on the first run. Last lines verbatim (SCRATCH/exec-06-21/gate.txt):
```
GATE ok   server tests # fail 0
GATE ok   server tests 178
GATE ok   STATUS MATH (12)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (29)
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
- **PASS lines, all with 0 FAIL:**
  - forms-flow: 701 (643 before). New: upload 25, upload-ira 18, upload-refused 15. route still has 18.
  - status-flow: 388.
  - server-mode: 259.
- **Owner walks and leak search:** walkA 13/0, walkB 10/0, walkC 17/0 (individual) and 17/0 (entity). The leak search passed.
- **Tracer:** the Task 1 verify (`--case upload`) printed `FORMS FLOW: PASS (cases run: 1)` on the committed tree before expanding (SCRATCH/exec-06-21/tracer.txt).
- **server/node_modules** was linked for the gate only, removed by the gate script, and never staged.

## What each case measured

- **upload** (25 checks): Kittiwake Point Partners LP, a foreign partnership invited as a foreign entity.
  - **Answers view.** It has exactly one "Upload it instead" link.
  - **Unsigned form first.** A W-8BEN-E (corporation, Active NFFE) is built and left unsigned, then the investor goes Back.
  - **Routing line.** Chapter 3 "Something else" shows the line. It ends "Upload the completed form, or continue without it now.", has no email address, and its link is the only upload link on the screen.
  - **Upload view.** It is the tax step with only the form radios and the file input, and the button reads Continue. The radios offer exactly W-8BEN-E, W-8IMY, W-8ECI, W-8EXP and another, with none chosen. The input accepts PDF, PNG and JPEG.
  - **Back** returns to the answers with "Something else" still chosen and the routing line shown.
  - **Choosing the file.** W-8IMY is picked and a real PDF is chosen. It shows as "Attached: W-8IMY Kittiwake Point.pdf", and nothing is stored before Continue.
  - **Continue** moves on to Distribution payments, and exactly one file is added under `tax-<investor id>-<base 36>`.
  - **Record.** taxForm is W-8IMY. taxCert has exactly the keys at, fileId, fileName, form and uploaded; there is no review mark. The stored bytes equal the chosen file (SHA-256). The upload is on file by the one rule, taxType is foreign-entity, and the log reads "Tax form uploaded ... Form W-8IMY".
  - **Earlier form.** The unsigned W-8BEN-E is voided and its file deleted. No new envelope was made.
  - **Readers.** The Account page reads "W-8IMY on file". The audit register reads "W-8IMY on file", and the tax-forms check does not list the investor.
  - **Sponsor's row.** It reads "W-8IMY uploaded Nov 15, 2026" with one Download, and the Download has the same SHA-256 as the chosen file.
  - **Another investor's file id.** A row whose record carries another investor's tax- file id names the form but offers no Download.
  - **White label.** No vendor name, no script error, and no outside request.
- **upload-ira** (18 checks): Harbor Trust Company Custodian FBO Bartholomew Achebe-Lindgren IRA.
  - **Signed W-9 first.** The IRA signs the W-9 the portal fills in, then goes Back to the tax step.
  - **Upload view.** It offers "The custodian's Form W-9", chosen to start, and "Another tax form".
  - **Choosing the file.** The PNG is a real PNG, rendered from a PDF by pdftoppm and checked by its 8 first bytes. It is attached, and Continue moves on.
  - **Record.** taxForm is W-9 and taxCert is uploaded with fileName custodian-w9.png. The stored bytes are the same, and the log names Form W-9.
  - **Signed W-9.** It stays completed, with its Documents entry and its file.
  - **Sponsor's row.** It reads "W-9 uploaded <date>" with one Download giving the same bytes, and it does not say "W-9 signed".
- **upload-refused** (15 checks): Ottoline Varga-Mbeki, a U.S. individual.
  - **Setup.** A W-9 is built and left unsigned, and the upload is opened. Form W-9 is chosen to start.
  - **Text file named my-w9.pdf.** Exactly one message: "This file is not a PDF, PNG or JPEG, so it was not added." Nothing is attached.
  - **26 MB PDF.** Exactly one message: "This file is 26 MB, more than the 25 MB this page accepts, so it was not added." Nothing is attached, and nothing is stored for either file.
  - **Refused file after a good one.** A good PDF is attached, then a refused file is chosen. The PDF stays attached and the one message shows.
  - **Back** and the link again: nothing is attached and no message shows.
  - **Continue without a file** moves on with no error. Nothing is on file and no tax- file is stored. The log reads "Tax form not completed ... without a file". The unsigned W-9 is left as it was.
- **route** (18 checks, from 06-20): its one check on the routing line now expects the upload sentence and no address.

Screens to look at (SCRATCH = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad):
- the routing line with the link: SCRATCH/exec-06-21/checks-out/forms-flow/upload/upload-route.png
- the upload view with a W-8IMY attached: SCRATCH/exec-06-21/checks-out/forms-flow/upload/upload-view.png
- the sponsor's row: SCRATCH/exec-06-21/checks-out/forms-flow/upload/upload-console.png
- the IRA's view: SCRATCH/exec-06-21/checks-out/forms-flow/upload-ira/upload-ira-view.png and upload-ira-console.png
- the refusals: SCRATCH/exec-06-21/checks-out/forms-flow/upload-refused/upload-refused-text.png and upload-refused-big.png

## Deviations from Plan

1. **No "reviewed" mark (owner's legal review; orchestrator removal accepted).** The plan's must-haves asked for "Uploaded <form>, not reviewed", a "Mark as reviewed" action logged with the team member's name, and `reviewed false` in taxCert. None of that was built. The row reads "<form> uploaded <date> · Download", and taxCert is { form, uploaded, fileId, fileName, at }. T-06-46 (repudiation of the review mark) no longer applies because the mark does not exist. Commit 8a6466f.
2. **[Rule 2] A refused file leaves the earlier attached file in place.** The refusal says "so it was not added". Dropping a good file attached before it would contradict that, and the investor would then continue without the form they had chosen. Built RED first: commit 0cafe16, then fix f35154a.
3. **[Rule 2] The console offers Download only for a file under the investor's own tax- id (T-06-45).** This uses the same naming test as the rep- files. The upload case proves that a record carrying another investor's file id gets no Download. Commit 8a6466f.
4. **[Rule 2] Storing an upload voids an unsigned form built on the step.** Without this, a form the investor turned away from would stay live to sign, the same reason as 06-20's T-06-43. A signed earlier form stays, by 06-18's keep rule; that is how "a stored upload replaces nothing signed earlier" is read here. The void code is now one helper, voidUnsignedTax, shared with the routed path, with no change in behaviour (route still passes). Commit 8a6466f.
5. **[Rule 2] Tax numbers leave page memory once an upload is stored.** That covers the W-9 TIN, a disregarded LLC owner's SSN, the foreign tax ID, U.S. TINs and owner TINs. This matches what finishing a form does (T-06-35, T-06-44). Commit 8a6466f.
6. **The form list depends on the account (D-06, nuance).** The plan lists W-9 (the custodian's), W-8IMY, W-8ECI, W-8EXP, a W-8BEN-E completed elsewhere, and other. Each account sees only the forms that can apply to it, as listed at the top, plus W-8BEN for a foreign individual.
7. **A validation pass is skipped on the upload view.** The answers behind the view are not on screen, so a part-typed number there must not block Continue (D-30).
8. **The route case's address check was replaced.** It now expects the upload sentence and no address. This is a deliberate change of behaviour, not a loosened check.
9. **Gate counts** follow the merged tree (Failures first, item 5).
10. **Whitespace-only style commit** 02be586 (Failures first, item 4).
11. **Ledger and state.** The ledger file under the git directory was not used (worktree guard). `commits` was measured from SCRATCH/exec-06-21/base-commit.txt with SCRATCH/exec-06-21/actuals.sh. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched, as instructed.

## TDD Gate Compliance (Task 2)

- RED: 0cafe16 `test(06-21): ... (red)`, run against the Task 1 product code: FORMS FLOW: FAIL (cases run: 2) - upload-refused (quoted above). upload-ira passed there (Failures first, item 3).
- GREEN: f35154a `fix(06-21): ...`. FORMS FLOW: PASS (cases run: 4) for upload, upload-ira, upload-refused and route (SCRATCH/exec-06-21/green-t2.txt), then the full gate.

## Known Stubs

None that block this plan's goal in local mode.
- **Server mode:** an uploaded form stays in the investor's browser. The completion does not send tax- files, and the server does not accept them yet; those are plans 06-22 and 06-23. That is the same state as the signed W-9, W-8BEN and W-8BEN-E today.

## Threat model

- **T-06-45 (uploaded tax form):**
  - The file is checked by its first bytes as a PDF, PNG or JPEG (sendable) and must be at most 25 MB. It is checked when chosen and again on Continue.
  - It is stored only under `tax-<investor id>-<time>`.
  - The console downloads only a file under that investor's own id.
  - It is shown as "uploaded", never "signed".
  - "Not reviewed" was removed with the review mark (deviation 1).
  - upload-refused proves both refusals and that nothing is stored; upload proves the id, the bytes and the own-id guard.
- **T-06-46:** not applicable; the review mark was not built (deviation 1).
- **T-06-SC:** no package was installed.

## Threat Flags

None. The upload uses the existing file store, the existing first-byte tests and the existing console download action. No new endpoint or trust boundary was added.

## Self-Check: PASSED

- Files present:
  - assets/js/onboarding.js
  - assets/js/console.js
  - checks/forms-flow.js
  - 06-21-SUMMARY.md
- Commits 8a6466f, 0cafe16, f35154a and 02be586 are on HEAD (git rev-list 8da766e..HEAD = 4).
- No untracked file is left. server/node_modules was removed after the gate and never staged. Nothing was written into assets/ apart from the two source files the plan names.
