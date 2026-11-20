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
```
FAIL leak investor screens: none of $19, $99, 1900, 9900, tier, entitlement :: ["Your verification package ($19) is paid."]
PACKAGE FLOW: FAIL (parts run: 1) - leak
```
(every other check line of that run passed: the scan fails on the planted price and on nothing else). No code was needed for Task 3: the package adds no step and no field (D-30), and the phone and preview parts pass on Task 2's code.

## Deviations from plan

### Auto-fixed issues
**1. [Rule 1 - Bug] A package screening never went through the package** (found by the tracer's RED, Task 1)
- Issue: integrations.js `complete` used the screening carried on the identity decision (`pre`) for any connection on for identity and screening. For the package connection the server then held no screening record, so `confirmChecks` marked the screening "not confirmed; screen again" and the console re-screened with its own connection (the sample's sandbox). The AML/KYC row read "No matches" although nothing was screened through the package (D-01: "the names are screened through the package").
- Fix: one changed line in `complete`: `pre` is not used for a connection whose `package` is true, so the investor's device screens through the server (`POST /v1/screenings`, the invitation's names, R11), which keeps the record the import confirms.
- Files: assets/js/integrations.js (this plan's own file). Commit f4e23ed (code first saved in a wip commit).

**2. Verify 3's file-list comparison leaves out this plan's own SUMMARY.** The owner's save rules require the SUMMARY to be committed and pushed as evidence is produced; the plan's verify compares every file this plan's commits touch with exactly its four code files. $O/verify-3.sh drops `08-07-SUMMARY.md` from that comparison and nothing else.

**3. Base counts differ from the plan's text (measured, not typed).** Server tests 368 (the plan said 358; the wave-5 additions in 08-CONTEXT record 368 after the phase 9, 10 and 11 merges); phase-8 gate checks 3, as expected.

**4. `api` precedence on 401.** As the plan says, the server's own sentence comes first; the 401 sentence ("did not accept the access token") is now only a fallback, the order invitations.js already uses. A wrong token on the console's Integrations page check now shows the server's "Not authorized". No gate check reads it.

**5. Planted-price RED (Task 3).** The four Task 3 parts already passed on Task 2's code (guards); per the plan's fallback, the leak part carries the planted-price proof and was shown failing on a planted copy (test-only switch PACKAGE_FLOW_PLANT=price, with GATE_FRESH=1).

## Found, not fixed here (another plan's file)
- **Provider failures other than 402/403 reach the investor with a status number.** `server/lib/invitations.mjs packageStart` maps only the provider's 402 and 403 to "This check could not start. Please try again later."; any other provider failure (a 5xx, a timeout) is rethrown with the plug-in's message ("Identity check answered 500", "Identity check could not be reached (timed out)"), and since `api` now shows the server's sentence, the investor reads that. Before this plan they read "Could not start the check: The integration server answered 502." (also a number). Read from the code; no check part exercises it. The fix belongs to the server (every provider failure on a package start answers the plain sentence): a follow-up quick task on server/lib/invitations.mjs.

## Provider behaviour the stand-ins assume (for 08-03 and 08-12; nothing here confirms any of it)
Identity and screening provider (the world's answers to server/plugins/idcheck.mjs; its fixtures are marked unconfirmed):
1. A session start (POST .../session/) answers 201 with a session id and an https address of the provider's own page; each start ("Start again") gives a new session id.
2. A refusal for the provider's own reasons (no credit, a key problem) answers 402 or 403 with the provider's own words in `detail`; the server shows its own sentence instead.
3. Until the investor finishes, reading the decision (GET .../session/{id}/decision/) answers the session's "Not Started"; once finished, "Approved" with every part approved, the screening part included.
4. A status delivery is signed as the plug-in's ASSUMED block says (HMAC-SHA256 hex of the raw body in the first signature header, the time in seconds inside the body) and names the session by `session_id`; the stand-in sends an empty `vendor_data`, so the server finds the record by the session id.
5. The stand-alone screening (POST .../aml/) is one call per name and answers a request id with `aml.status` "Approved" and no hits; whether each name is billed is unconfirmed (R11).
Payment provider (the world's answers to server/lib/billing.mjs):
6. An off-session charge (POST .../payment_intents) on the saved card answers 200 with `status: succeeded` and an id; a declined card answers the recorded 402 fixture.
7. A card on file is a customer id and a payment-method id as in the fixtures; the stand-in writes them into the store as the hosted card page would leave them (the card page itself is not exercised here).
Accreditation provider (checks/doubles/accredit.mjs):
8. Settings ACCREDIT_API_KEY and ACCREDIT_SECRET.
9. The investor works on the provider's own page in a new tab; submitting leaves the check pending; the result arrives later (days) and is read back by the server.
10. A verified result carries an expiry 90 days ahead, the method "Third-party verification letter" and one letter the server downloads as a PDF; a rejected result carries a one-line detail.
