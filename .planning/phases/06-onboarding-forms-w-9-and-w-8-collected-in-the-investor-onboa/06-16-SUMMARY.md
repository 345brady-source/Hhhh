---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 16
subsystem: investor onboarding tax step, sponsor invite forms, integration server snapshot
status: complete
tags: [tax-forms, w-9, d-04, d-06, d-09, e-sign, onboarding, server-mode]
requires: [06-10, 06-13, 06-15]
provides:
  - tax step in two views for a U.S. person (answers, then the official W-9 signed on the page)
  - investor.taxCert { form, revision, envelopeId, at, signed, signedBy, tinLast4, backupWithholding }
  - console investor row line "W-9 signed <date>" with download, or "W-9 not signed"
  - D-09 investor type (NS.INVESTOR_TYPES, NS.investorKind) on invite form, CSV/Excel import, manual add, snapshot, server cleaning
  - NS.esign.void(ws, id, reason, { quiet, actor })
  - forms-flow.js cases us-individual and investor-type; lib.js walk until, finishTaxForm
affects: [06-17, 06-18, 06-19, 06-20, 06-22, 06-23]
tech-stack:
  added: []
  patterns:
    - "a step with two views: the form is built by an action (Continue), never while rendering; applyFlowStep returns true to stay on the step"
    - "the full taxpayer ID lives in a module-level map from the profile step until the form is built"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-16-SUMMARY.md
  modified:
    - assets/js/onboarding.js
    - assets/js/console.js
    - assets/js/esign.js
    - assets/js/data.js
    - assets/js/invitations.js
    - server/lib/invitations.mjs
    - server/test/invitations-existing.test.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
    - .planning/phases/04-signing-inside-onboarding/checks/lib.js
    - .planning/phases/04-signing-inside-onboarding/checks/signing-step.js
    - .planning/phases/05-signed-record/checks/flow.js
    - .planning/phases/01-accurate-field-placement/checks/harness.js
decisions:
  - "D-09 (owner-directed, included in this plan by the orchestrator): one Investor type select where investors are created: U.S. individual (default); U.S. entity: LLC or corporation, Trust, IRA, Joint account; Foreign individual; Foreign entity. It sets investor.type (the account pre-selected on Investor information) and investor.taxType (which form the tax step shows). It replaces the old optional Investing as select on the invite and manual-add forms and sits beside the name and email, not under More options."
  - "The investor corrects the type with one plain line on the tax step: Not a U.S. person for tax purposes? Use the form for foreign investors (or the reverse: Use Form W-9). An IRA has no such line (its custodian is a U.S. person)."
  - "A foreign type starts Investor information with another citizenship and no country chosen; the foreign types keep the existing foreign certification until 06-18 and 06-20."
  - "Continue on the W-9 answers prepares the form first, then voids (quietly: no email, no message) and deletes the file of an unsigned earlier W-9 of the flow, then creates the new envelope; a failure leaves the earlier one as it was."
  - "A taxpayer ID typed only in part on the tax step is pointed out (Enter all nine digits, or leave this empty), as Investor information does; nothing on the W-9 is required."
  - "The requester box carries the firm's legal name only: the tenant record has no firm address."
metrics:
  duration: "44 min (base recorded 20:13:06 UTC, summary 20:57 UTC)"
  completed: 2026-11-15
actuals:
  tokens: 13800    # chars/4 over the 55,045 characters of added lines in 764fe0a..39808e5
  tasks: 2
  commits: 4       # git rev-list --count 764fe0a..HEAD before this summary commit
plan_head_before: 764fe0a6816c0c6ad7abf8602ce301ee5bc9801f
plan_head_after: 39808e54223ced9409e39e3d20bf06608a622b6f
---

# Phase 6 Plan 16: A U.S. person signs the pre-filled official W-9 inside onboarding; the sponsor picks the investor type (D-09)

A U.S. individual reaching the tax step now sees one sentence and a "Continue to the form" button. There are no questions. Continue fills the official IRS W-9 (Rev. March 2024) from what onboarding already has: the name, the address, the SSN typed at Investor information (held only in this page's memory), the individual box, and the firm as requester. The investor signs it on the page and moves on. The sponsor's investor list shows "W-9 signed <date>" with a download, and the download has the same bytes as the stored copy. The sponsor now picks an investor type when inviting, importing a list or adding an investor manually. That type decides the tax form and pre-selects the account.

The owner has not checked any of this. It is not done until he has looked at it.

## Failures first

1. **Gate run 1 failed in two places.** Output: SCRATCH/exec-06-16/gate-run1-fail.txt.
   - SERVER MODE `clean` failed: "the investor in the snapshot is the invited investor alone". That part allows a fixed list of investor keys, and `taxType` is a new key D-09 adds on purpose. I added it to the allowed list.
   - TWO PERSONS crashed: it waited 60 s for `.ivf-tax-sign .es-finish`. The phase 1 harness that two-persons uses blocks every outside address except the PDF libraries. The W-9 needs the Unicode font library and the font, so preparing the form failed and the signing view never appeared. The phase 1 harness now serves those files from the same local copies the phase 4, 5 and 6 checks already use.
   - Because the gate is one chain of `&&`, it stopped there. It printed `run2: command not found` and skipped the phase 4 and 5 comparison.
2. **Gate run 2 failed on one new FAIL in phase 4:** `SIGN-02 the agreement was prepared and sent by the flow itself when the investor subscribed :: {"n":2,...}`. That check counts every envelope in the workspace and expects 1. The W-9 is now a second envelope (kind `tax`). The check now counts envelopes that are not tax forms, so it still tests what it was written for. After that, the phase 4 and 5 comparison was re-run on its own (gate-p45.sh), because every other part of run 2 had already passed. Output: SCRATCH/exec-06-16/gate-run2-fail.txt.
3. **First tracer run: 3 FAILs, all in my own check, none in the product.**
   - The box-ink test counted 10 pixels in the LLC box. That was the blank form drawing the box frame slightly differently. The rendered page shows only "Individual/sole proprietor" ticked. The test now measures 2 pt inside each box.
   - The console row was read from the Invitations table instead of the investor table. The locator now picks the table with the "Paid by" column.
   - The check rendered the blank W-9 next to the file inside the repository. That left `assets/forms/fw9-2024-03-g1.pgm` untracked. I deleted that file before any commit, and the check now renders a copy in its output folder.
4. **RED order for D-09:** the `investor-type` case was written after the D-09 code. Its RED was then proven on a copy of the base tree: 1 PASS, 3 FAIL, run ended (SCRATCH/exec-06-16/red-type.txt). The `us-individual` case was committed before any code (ffd14ce). The server D-09 test was run against the base server library first: `# fail 1` (SCRATCH/exec-06-16/red-server.txt).
5. **Gate counts differ from the plan text, as the orchestrator said they would.**
   - FORMS FLOW is 4 cases, not 3: sign-w9 and sign-w8ben, plus us-individual and investor-type. investor-type is the D-09 case, added for the owner-directed scope.
   - STATUS FLOW is 25 parts, not 29, and SERVER MODE is 8, not 10. 06-14 was skipped and 06-15 removed parts.
   - The gate script (SCRATCH/exec-06-16/gate.sh) checks these exact numbers.

## RED runs (quoted)

- us-individual on the base code (SCRATCH/exec-06-16/red.txt):
  `FAIL us-individual the tax step asks no question (nothing missing) :: ["ob-usPerson","ob-usPerson","ob-backup","ob-w9","ob-taxSig"]` … `FORMS FLOW: FAIL (cases run: 1) - us-individual`
- Server D-09 test against the base library: `not ok 1 - D-09: the investor type the sponsor chose reaches the investor link; …` with `expected: 'us-individual'`, `# fail 1`. With the new library: `# pass 1`.
- investor-type on the base tree: `FAIL investor-type the invite form shows "Investor type" with the name and email (not under More options) :: {"visible":false,"label":"","chosen":"individual","options":["Individual","Joint account","Trust","LLC, partnership or corporation","IRA (through a custodian)"]}`

## Gate

Gate run 2 (SCRATCH/exec-06-16/gate.txt), last lines verbatim:
```
==> .../exec-06-16/math.txt <==
PASS gate a case list of blanks exits 1 with FAIL
STATUS MATH: PASS (cases run: 12)
==> .../exec-06-16/maps.txt <==
PASS W-8BEN-E only the signature label lies between sign and the caption under it
FORM MAPS: PASS (forms run: 3)
==> .../exec-06-16/forms.txt <==
PASS investor-type no request left the check server
FORMS FLOW: PASS (cases run: 4)
==> .../exec-06-16/status.txt <==
PASS lean Regulation A Tier 1 with the accredited question off: no accreditation tick on Subscription
STATUS FLOW: PASS (parts run: 25)
==> .../exec-06-16/srvmode.txt <==
PASS clean the investor's device reached nothing outside but the integration server
SERVER MODE: PASS (parts run: 8)
==> .../exec-06-16/persons.txt <==
PASS  errors signing: no page errors (0)
TWO PERSONS: PASS
==> .../exec-06-16/owner.txt <==
PASS leak (3 s): 414 files and 483 commit messages searched: no name of the list, no run of eight words outside the allowed list; …
MEASURE: PASS
NEW FAIL in signing: FAIL SIGN-02 the agreement was prepared and sent by the flow itself when the investor subscribed
GATE_EXIT=1
```
After the SIGN-02 fix, the phase 4 and 5 comparison (SCRATCH/exec-06-16/gate-p45.txt), verbatim:
```
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
GATE P4/P5: PASS
EXIT=0
```
Also measured:
- Server tests: 178 pass, 0 fail (177 before, plus the D-09 test).
- forms-flow: 113 PASS lines.
- status-flow: 388 PASS lines.
- server-mode: 259 PASS lines (247 before; each server-mode flow now also checks that the snapshot and the device keep the investor type).
- Owner walks A, B and C passed through the new tax step.
- server/node_modules was linked for the runs and was never staged.

## What each case measured

**us-individual** (32 checks, all PASS). A fresh Kestrel Bay portal. Renée Zoë Ångström is invited as a U.S. individual, and the walk types SSN 123456789 at Investor information.
- The tax step shows no visible field: one lede and the button "Continue to the form".
- Continue builds a tax envelope ("Form W-9 - Renée Zoë Ångström") with one signer. The signing view keeps the heading "Tax certification".
- She adopts a signature, presses Finish, and reaches "Distribution payments".
- `investor.taxForm` is `W-9`. taxCert has form W-9, revision Rev. March 2024, the envelope id, an ISO time, signed true, signedBy her name, tinLast4 6789 and backupWithholding false.
- The change log has "Tax form signed". No log entry, and nothing in the saved workspace or local storage, holds 123456789 or 123-45-6789.
- There is one Documents entry: category Tax, for her alone. The stored file equals sha256Signed.
- Signed PDF:
  - Zero form fields. The certificate is page 7.
  - Name, "12 Elm Street", "Austin, TX 78701" and the firm's legal name each print inside their own field rectangle.
  - The SSN prints as 123 / 45 / 6789 in its three comb cells.
  - The EIN, account numbers, line 2 and the exemption fields are empty.
  - Only the individual box has a tick.
  - Signature ink is inside the sign place.
  - The caption reads "Signed electronically <today UTC> <HH:MM> UTC".
- The console investor row reads "W-9 signed Nov 15, 2026". Its Download produced a file with the same SHA-256 as the stored copy.
- White label passes on the tax screens. No script error, and no outside request.

**investor-type** (16 checks, all PASS):
- The invite form shows "Investor type" beside the name and email. The options are U.S. individual; U.S. entity: LLC or corporation / Trust / IRA / Joint account; Foreign individual; Foreign entity. The default is U.S. individual.
- An invite as Foreign individual gives type individual and taxType foreign-individual.
- An imported list with "Foreign entity", "U.S. entity (LLC, corporation, trust, IRA, joint)", "trust" and an empty type cell gives entity/foreign-entity, entity/us-entity, trust/us-entity and individual/us-individual. The preview names each type.
- A manual add as Foreign entity gives entity/foreign-entity.
- The foreign individual's Investor information starts with another citizenship, no country, and an individual account.
- Her tax step shows the W-8BEN certification with no U.S. status question, plus the line "A U.S. citizen or resident, or a U.S. entity? Use Form W-9".
- Clicking it shows the W-9 view asking nothing ("Continue to the form"). Clicking again goes back.

**Server mode (D-09):** each server-mode flow checks that the snapshot from GET /v1/invite carries `taxType: us-individual` for a new investor and nothing for an investor already on file. The device's record keeps the same value. The server unit test covers all four types and drops anything else ('foreign', 'US individual', markup, a number, null).

Screens to look at:
- SCRATCH/exec-06-16/checks-out/forms-flow/us-individual/: us-individual-answers.png, us-individual-signing.png, us-individual-console.png, plus signed.pdf and filled.pdf
- SCRATCH/exec-06-16/checks-out/forms-flow/investor-type-foreign-tax.png

## Owner decision applied: D-09 (owner-directed)

The owner's words: "keep both, just have the sponsor select what type of investor is recieving the onboarding and have the workflow correspond with there choices".
- Where investors are created, the sponsor picks the investor type: the invite form, the CSV or Excel import (the type column), and Add manually.
- The onboarding uses it to choose the form and to pre-select the kind of account. The investor is never asked which form applies.
- With no type given, the investor is a U.S. individual, and the investor can change it.
- U.S. types lead to the W-9 in this plan. Foreign types go to the existing foreign certification until 06-18 (W-8BEN) and 06-20 (W-8BEN-E).
- One plain line on the tax step corrects a wrong type.
- Server mode carries the type: the browser snapshot, the server's cleanInvestor, and the investor's device. A test covers it.

## Deviations from Plan

1. **[Owner-directed scope, D-09]** Added in data.js (NS.INVESTOR_TYPES and its helpers), invitations.js (the forms, the import, manual add, the snapshot, re-invite) and server/lib/invitations.mjs, with the server test and the investor-type case. The tax step's U.S. status radio is replaced by the type and the one-line correction.
2. **[Rule 2] Quiet void.** `NS.esign.void` now takes `{ quiet, actor }`. Without it, an investor who changed an answer would have received a "Voided" email and seen a sponsor-style message about their own unsigned form.
3. **[Rule 2] A partly typed taxpayer ID is pointed out** on the tax step, as on Investor information. Otherwise the fill would throw, or the number would be silently dropped. Nothing is required.
4. **[Rule 3] Phase 1 harness** serves the font library and font locally (TWO PERSONS crashed without them). **Phase 4 SIGN-02** counts agreement envelopes only. **server-mode clean** allows `taxType`. These are check changes caused by the new behaviour; none of them weakens what the check was written to prove.
5. **[Rule 3] Investor information country select** shows "Choose a country" when no country is set, which is now the case for a foreign type.
6. The plan's ledger file under the git dir was not used (worktree guard). `commits` was measured from SCRATCH/exec-06-16/base-commit.txt.

## Known Stubs (each owned by a later plan)

- The "subject to backup withholding" tick (Change your answers) is recorded in taxCert.backupWithholding and the change log. Item 2 is not yet struck through on the PDF. 06-17 draws strike2 (RED-first there).
- A U.S. entity gets the W-9 with name, address, EIN, requester and, for a trust, the trust box. The classification for an LLC, corporation, IRA or joint account is not asked yet. That is 06-19.
- In server mode the signed W-9 stays on the investor's device. 06-22 carries it to the console.
- "W-9 not signed" has no download. 06-17 covers every reader of an unsigned W-9.
- After Back from the signing view, the SSN is asked again, because the number left memory once the first form was built (T-06-35). This is by design and is not required.

## Threat model

- **T-06-35:**
  - The SSN is held in `TINS` only, then deleted when the form is built. SECRET keeps `tin` out of saved answers. The record keeps the last four digits.
  - The us-individual case searched the whole workspace JSON and local storage for the number and found nothing.
  - The voided earlier form's file (which holds the full number) is deleted.
- **T-06-36:** every Continue voids the unsigned earlier W-9 and deletes its file before the new envelope.
- **T-06-37:** the download is the Documents entry's file, for that investor only. The SHA-256 was compared.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input | server/lib/invitations.mjs | New snapshot field investor.taxType from the console; allow-listed to four values, anything else dropped (tested) |

## Self-Check: PASSED

- All modified files are present. Commits ffd14ce, 22180f5, 1004661 and 39808e5 are on HEAD.
- No untracked file is left (the stray render was removed). server/node_modules is a symlink and was never staged.
- No TODO or FIXME was added.
