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

## Task 2 (refusals)
RED2 (parts refused and start-limit against Task 1's code, $O/red2.txt):
```
FAIL refused the step shows exactly "This check could not start. Please try again later." :: []
FAIL refused the line stays on the step once the toast has gone (not only a toast) :: []
FAIL refused a start shows "This check is not part of this invitation" followed by the firm's contact as its settings hold it :: {"refusal":[],"contact":{"team":"Kestrel Bay Investor Relations","email":"ir@kestrelbaycap.com","phone":"(212) 555-0148","hours":""}}
FAIL start-limit the fourth start shows "This check was already started." followed by the firm's contact as the page holds it :: {"refusal":[],"contact":{"team":"Kestrel Bay Investor Relations","email":"ir@kestrelbaycap.com","phone":"(212) 555-0148","hours":""}}
PACKAGE FLOW: FAIL (parts run: 2) - refused, start-limit
```
verify-2 (GREEN, $O/flow2.txt last lines):
```
PASS start-limit every investor screen of this part: no vendor, library or forbidden word (leak check)
PASS start-limit every investor screen of this part: no provider name or address (vendor scan)
PACKAGE FLOW: PASS (parts run: 3)
```
verify-2 exit 0.

## Task 3 (phone, preview, leak)
The four new parts run against Task 2's code first ($O/red3-guards.txt): all four already pass, so they are guards, not RED:
```
PACKAGE FLOW: PASS (parts run: 4)
PASS leak the price scan catches a planted "$19", a tier and an amount in cents, and passes a clean screen
PASS leak scanned 18 investor screens, 5 investor emails, 6 GET /v1/invite replies, 8 console screens, 8 account replies (each above zero)
PASS leak the new tabs' own addresses (6) are the one place outside the portal and the server: https, on neither origin
PASS leak the typed taxpayer number is in no world record
PASS leak the typed taxpayer number is in no server output (event log, anything this process printed)
PASS leak the typed taxpayer number is in no file this part writes
```
As the plan says for this case, the leak part carries the planted-price proof first and is shown failing on a planted copy (PACKAGE_FLOW_PLANT=price adds "Your verification package ($19) is paid." to one investor screen; GATE_FRESH=1 so no kept result is reused), $O/red3.txt:
