---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 13
subsystem: tax-forms
status: complete
tags: [tax-forms, w-9, w-8ben, e-sign, d-04]
requires: [06-10]
provides:
  - NS.taxforms.prepare(formKey, answers) -> filled, flattened PDF Blob
  - NS.esign.createFromPdf(ws, { blob, title, fileName, investorId, taxForm, overlays }) -> sent investor-only tax envelope
  - NS.esignKit.unicodeFont() -> { fontkit, fontBytes }
  - finishSigning, kind 'tax' only: the "Signed electronically <YYYY-MM-DD HH:MM> UTC" caption and Documents category Tax
  - date fields with fmt 'MM-DD-YYYY' filled in that format at signing
  - checks/forms-flow.js (cases sign-w9, sign-w8ben)
affects: [06-16]
tech-stack:
  added: []
  patterns:
    - "a filled official form becomes an ordinary envelope: the existing signing, certificate and seal apply unchanged"
    - "tax-only behaviour in finishSigning is gated on env.kind === 'tax'"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
  modified:
    - assets/js/taxforms.js
    - assets/js/esign.js
decisions:
  - "fill() marks a pin mismatch with err.pin, so prepare rewrites only that error into the support-team sentence; other errors (unknown answer key, wrong digit count) keep their own message"
  - "The caption time is the signer's signedAt (UTC), the same instant the envelope records for the signature"
  - "Page sizes for the tax envelope are read with the PDF writer (rotation-aware); no page render is needed to create it"
metrics:
  duration: "18 min (base recorded 18:40 UTC, gate finished 18:58 UTC)"
  completed: 2026-11-15
actuals:
  tokens: 8000
  tasks: 2
  commits: 3
plan_head_before: 3d1997dded96d1f457b003a45c328f294fbba70a
plan_head_after: 7668219ce8c736bd508f8f1e5a6854702e191fb9
---

# Phase 6 Plan 13: Official W-9 and W-8BEN filled in the browser and signed through the portal's e-signature

The browser can now fill a bundled IRS form with `NS.taxforms.prepare` and turn it into an envelope for one investor with `NS.esign.createFromPdf`. The signature and date go at the form's own places. The investor signs through the portal's existing signing, and the existing certificate page and seal are added. The signed copy shows "Signed electronically <date time> UTC" beside the signature on the form page and is listed under Tax for that investor only. All of this was tested on a W-9 and a W-8BEN outside onboarding. Plan 06-16 adds it to the tax step.

## Failures first

- No check failed except the planned RED: the sign-w8ben case was committed first, and its date checks failed as expected. It printed `11/15/2026` where `11-15-2026` was required. Output: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-13/red-w8ben.txt (2 FAIL, exit 1).
- The full gate exited 0.
- Not yet checked by the owner. The signed pages were rendered and viewed by the executor only:
  - W-9: the signature sits on the "Signature of U.S. person" line, `11/15/2026` is after "Date", and the caption is under the signature.
  - W-8BEN: the caption is above the signature line, the signature is on it, and `11-15-2026` is above "Date (MM-DD-YYYY)".
- Known look, not changed: on the W-9 the caption sits just under the box's bottom rule, in the 7-point band the 06-10 map gives it. It does not cover any printed word (the check found no new ink outside the sign, date and caption places).

## What each case measured (FORMS FLOW: PASS (cases run: 2), 65 PASS lines, 0 FAIL)

Each case runs on a fresh Kestrel Bay self-serve portal (`setupPortal`) with the first investor on file. The browser prepares the form and creates the envelope. The investor then opens `#sign-<id>` in the portal, gives consent, adopts a signature on the field and finishes. The stored signed PDF from the Documents entry is then read back:

| Measured | sign-w9 (Renée Zoë Ångström, individual, SSN) | sign-w8ben (Zoë Müller-Łukasz, Germany) |
|----------|-----------------------------------------------|-----------------------------------------|
| Envelope: kind tax, form and revision, original = SHA-256 of the filled form, one investor signer, sent | PASS | PASS |
| Signature and date fields at the map's places, both optional (D-30), date fmt copied | PASS (no fmt) | PASS (fmt MM-DD-YYYY) |
| Documents entry: exactly one, cat Tax, investors exactly [that investor], audience investors | PASS | PASS |
| Stored file = env.sha256Signed (the sealed copy) | PASS | PASS |
| Zero form fields; certificate page after the form pages | PASS | PASS |
| Values inside their own field rectangles (pdftotext -bbox, rectangles read from the bundled form) | name, street, city line, SSN 123 / 45 / 6789 in their three comb cells | name, citizenship, street, city line, print name |
| Accented text prints exactly | PASS | PASS |
| Date place | `11/15/2026` (portal's usual format) | `11-15-2026`, also inside the Date[0] rectangle itself |
| Caption `Signed electronically <signedAt date> <HH:MM> UTC` inside the caption place; date = today UTC | PASS | PASS |
| Signature ink: new dark pixels (100 dpi, signed vs filled unsigned) inside the sign place; zero new ink outside the sign, date and caption places | PASS | PASS (sign place = f_20 rectangle within 0.5 pt) |
| White label: signing screens, and words in the signed PDF that are not on the blank form | PASS | PASS |
| No script error; no request left the check server | PASS | PASS |
| Pin mismatch: "This tax form could not be prepared. Contact Kestrel Bay Investor Relations." and no envelope created | PASS | (W-9 case only) |

The unknown case `--case nope` exits 1. Task 1's tracer verify printed `FORMS FLOW: PASS (cases run: 1)`.

## Deviations from Plan

1. **[Rule 2] Pin refusal proven inside sign-w9.** The plan's truths require the support-team sentence on a pin mismatch, but no case named it. sign-w9 now also prepares a copy of the W-9 map with a wrong pin and asserts the exact sentence and that no envelope was created.
2. **Pin error identification.** `fill()` now tags its pin error with `pin: true` (message unchanged), so `prepare` rewrites only that error. form-maps.js still passes (forms run: 2).
3. **Plan-check fixes applied (from the orchestrator).** The gate used `grep -Eq '^FORM MAPS: PASS \(forms run: [23]\)$'`, `grep -Eq '^STATUS FLOW: PASS \(parts run: (26|28)\)$'` and `grep -Eq '^SERVER MODE: PASS \(parts run: (6|8)\)$'`. Both verify commands ran from script files.
4. The GSD plan ledger file under the git dir could not be written (the worktree guard refuses that path). Instead, `commits` was measured from the base in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-13/base-commit.txt: `git rev-list --count 3d1997d..HEAD` = 3 before this summary.

## TDD Gate Compliance

- RED: 6fc39aa `test(06-13): sign-w8ben case ...`, which failed only on the two date checks (exit 1).
- GREEN: 7668219 `feat(06-13): a date field with fmt MM-DD-YYYY ...`. sign-w8ben passes, and the subscription-agreement date fields keep MM/DD/YYYY (phase 4 and 5 checks below).

## Gate

Task 2's verify command (with the plan-check fixes) exited 0. Its last lines:

```
==> server.txt <==     # todo 0 / # duration_ms 9242.289235   (# pass 177, # fail 0)
==> math.txt <==       STATUS MATH: PASS (cases run: 13)
==> maps.txt <==       FORM MAPS: PASS (forms run: 2)
==> forms.txt <==      FORMS FLOW: PASS (cases run: 2)
==> status.txt <==     STATUS FLOW: PASS (parts run: 26)
==> srvmode.txt <==    SERVER MODE: PASS (parts run: 8)
==> persons.txt <==    TWO PERSONS: PASS
==> owner.txt <==      walkA 13/0, walkB 10/0, walkC 17/0 + 17/0, leak PASS (409 files, 462 commit messages); MEASURE: PASS
GATE EXIT 0
```

Phase 4 and 5 checks, base tree (3d1997d) against this plan's tree:
- signing-step: 75 PASS / 0 FAIL on both.
- record-check: 40 PASS / 0 FAIL on both.

No new FAIL. server/node_modules was linked for the run, removed after, and never staged.

Outputs are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-13/:
- signed and filled PDFs: checks-out/forms-flow/<case>/
- screenshots: shots/

## Threat model

- T-06-28: the caption, the certificate and the envelope events are all asserted.
- T-06-29: the original is the filled form's SHA-256, and the stored copy matches sha256Signed. Both are asserted.
- T-06-30: investors is exactly [that investor], asserted in both cases.

No new surface beyond the plan.

## Self-Check: PASSED

- forms-flow.js, taxforms.js and esign.js are present.
- Commits bf8a6b7, 6fc39aa and 7668219 are on HEAD.
- No TODO, FIXME or placeholder was added.
