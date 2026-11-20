---
phase: 08-verification-package-and-ongoing-compliance
plan: 07
status: in-progress
---

# Phase 8 Plan 07 (draft, filled in as evidence is produced)

## Step 0 (base, measured)
- base commit 38ffa1203e1438a640a975df6de4f44f02cd997f
- server tests at base: 368 (`# tests 368`, `# pass 368`, `# fail 0`). The plan expected 358; the difference is the merges since the plan was written (phase 9, 10 and 11 server work and the 06-3x fixes); 08-CONTEXT "Plan-check additions, wave 5" records 368 as today's count.
- phase-8 gate checks at base: 3 (AML RECORD, PACKAGE INVITE, PACKAGE PANEL), as expected.

## Task 1 (tracer)
RED (`--only identity` against the unchanged integrations.js, $O/red.txt):
```
FAIL identity the identity step reads "A secure page opens in a new tab for this step." :: Identity check
FAIL identity the identity step names no one: no "Handled by" :: Identity check
FAIL identity the invitation's names are screened through the package: one screening call per name :: {"names":1,"calls":0,"same":false}
FAIL identity the imported record: identity passed and screening clear on the server's own screening records :: {"identity":"passed","aml":"clear","refs":[false],"decision":"approved"}
PACKAGE FLOW: FAIL (parts run: 1) - identity
```
The last two FAIL lines are a real product fault the tracer exposed: the investor's device took the screening carried on the identity decision instead of screening through the server, so the server held no screening record, the import marked the screening unconfirmed and the console re-screened with its own (sandbox) connection. The AML/KYC row read "No matches" without any screening through the package.

verify-1 (GREEN, $O/tracer.txt last lines):
```
PASS identity every investor screen of this part: no vendor, library or forbidden word (leak check)
PASS identity every investor screen of this part: no provider name or address (vendor scan)
PACKAGE FLOW: PASS (parts run: 1)
```
verify-1 exit 0.
