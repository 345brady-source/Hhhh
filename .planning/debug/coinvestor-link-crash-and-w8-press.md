---
status: investigating
trigger: "Walkthrough 3 (b14): (1) co-investor sign-in link sticks on 'Opening your agreement…' with TypeError null.signedAt at esign.js:3271 mineHTML; (2) N4: W-8BEN Finish redrawn under the press at CPU 4x, press lost."
created: 2026-11-20
updated: 2026-11-20
---

## Current Focus

hypothesis: (1) mineHTML dereferences flowSigner(e, inv.id) without a null check; a co-investor viewer on an envelope with no co-investor signer gets null. (2) unknown yet
test: read esign.js mineHTML/flowSigner/investorDocsHTML, coinvestor.js, portal.js earlyDocuments
expecting: unguarded flowSigner() result
next_action: read esign.js around line 3271 and portal.js:1003

## Symptoms

expected: (1) co-investor link never crashes; if nothing to sign, page says so plainly with a way out; console explains (no co-investor places; how to add). (2) W-8BEN Finish pressed the moment it appears works on the first press at CPU 4x.
actual: (1) stuck on "Opening your agreement…", TypeError: Cannot read properties of null (reading 'signedAt') at esign.js:3271 (mineHTML <- investorDocsHTML <- portal.js:1003 earlyDocuments). 4 of 4 tries. (2) iphone-a2: Finish redrawn under the press, second press worked (1 of 1 W-8BEN fast-Finish runs; W-9 fast-Finish runs fine).
errors: TypeError: Cannot read properties of null (reading 'signedAt') at esign.js:3271
reproduction: (1) account investor signed agreement awaiting countersign, agreement has no co-investor places; Investors > Account > Add co-investor > Open the co-investor's link. (2) CPU 4x, foreign individual, W-8BEN answers filled, press Finish the moment it appears.
started: 06-37/06-39 code paths

## Eliminated

## Evidence

## Resolution

root_cause:
fix:
verification:
files_changed: []
