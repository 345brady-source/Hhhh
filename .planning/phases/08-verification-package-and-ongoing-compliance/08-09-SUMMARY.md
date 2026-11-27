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

### Task 2 RED, against Task 1's code (959392b; server files as at the base)

Server tests (red2.txt):
```
not ok 1 - reverify flag: kept only for an investor on file with no offering, no tax-form request and no portal link; the link carries it
not ok 2 - reverify email: the invitation, the resend and the reminder ask to verify accredited investor status again, for that step only; no vendor word
not ok 3 - reverify summary: the sponsor’s finished summary has a re-verification row with the accreditation result and no onboarding rows
not ok 4 - reverify tier: with the package a sponsor account is charged the server’s reverify price from credit; the link runs accreditation only and is refused identity
not ok 5 - reverify plain: without the package nothing is charged and the firm’s own accreditation connection is used
ok 6 - reverify snapshot: the stored snapshot of a request carries no address, taxpayer number, bank detail or tax pre-fill
# tests 6
# pass 1
# fail 5
```
Test 6 passed before the code: the base already keeps no address, taxpayer number, bank detail or pre-fill on such an
invitation. It stays as a guard; its last assertion proves the scan fails on a planted copy. My first RED run of test 3 failed
for a reason of the test's own (403 "This check is not part of this invitation": its "firm's own" provider had the package
provider's name); the test now uses a separate stand-in for the firm's own connection, and the lines above are the rerun.

Part server (red2-part.txt):
```
FAIL server the server stored the request: an investor on file, no offering, marked reverify :: {"cents":0,"cls":"","note":"","senderName":"Kestrel Bay Investor Relations","existing":true,"expiresAt":"2026-12-27T00:58:59.431Z"}
FAIL server the server's email asks the investor to verify their accredited investor status again :: ["Complete your investor onboarding with Kestrel Bay Capital"]
FAIL server the investor's device opens on step 1 of 2; the steps are accreditation and done; the request's own line :: {"count":"Step 1 of 2: Welcome","steps":["welcome","done"]}
REVERIFY: FAIL (parts run: 1) - server
```
