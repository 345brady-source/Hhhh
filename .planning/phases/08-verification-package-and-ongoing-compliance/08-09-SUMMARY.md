---
phase: 08-verification-package-and-ongoing-compliance
plan: 09
status: in-progress
---

# Phase 8 Plan 09: Ask to re-verify (draft, evidence pasted as it is produced)

Base commit: 8eff49a61ec66c195cc8fae06e067d0fcec68073. Step 0: server tests 456 (`# fail 0`), phase-8 gate checks with a marker 6.

## RED lines (as produced)

### Task 1, part local, against the base tree (red.txt)

```
PASS local the investor's verification by a third party lapsed yesterday and their Rule 506(c) subscription is pending
PASS local before: Approve is refused with the existing "expired" sentence ("Your accreditation verification expired on ...")
FAIL local the investor's row offers "Ask to re-verify" :: (no button)
REVERIFY: FAIL (parts run: 1) - local
```

### Task 1 verify (verify-1.sh, exit 0)

```
REVERIFY: PASS (parts run: 1)
STATUS MATH: PASS (cases run: 13)
```
Two failures of my own on the way to GREEN, both fixed: the simulated check answers about a second after it starts, so at
Finish the result was still pending and "Accreditation re-verified" was never written (fixed: the entry is written once the
result is in, by `refresh` on the console's Investors page, as well as at finish and at import); and the check's pending
subscription had an agreement waiting for a signature, so Approve was refused for that reason (fixed in the check's fixture:
the subscription is recorded as signed).
