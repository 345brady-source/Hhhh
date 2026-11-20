---
phase: 08-verification-package-and-ongoing-compliance
plan: 07
subsystem: verification-package (investor side)
tags: [package, identity, screening, white-label, refusals, stand-ins]
status: complete
requires: [08-02, 08-05, 08-06, 08-13, 08-15, 08-16]
provides:
  - "checks/doubles/world.js: world() (payment and identity providers as one injected fetch, signed deliveries) and startServer() (the real server, a sponsor account, a card on file, the accredit stand-in), for 08-18, 08-19, 08-08, 08-20"
  - "checks/doubles/accredit.mjs: the stand-in accreditation provider"
  - "checks/package-flow.js: GATE CHECK PACKAGE FLOW, 7 parts"
  - "integrations.js: the neutral package sentence; api keeps the server's sentence, status and code; the refusal line with the firm's contact; a package connection screens through the server"
affects: [08-17, 08-18, 08-19, 08-08, 08-20, 08-12]
tech-stack:
  added: []
  patterns: ["checks own an in-process server with an injected fetch world; every outside call refused and recorded"]
key-files:
  created:
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/package-flow.js
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/doubles/world.js
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/doubles/accredit.mjs
  modified:
    - assets/js/integrations.js
decisions:
  - "A package connection never uses the screening carried on the identity decision: its names are screened through the server so the import confirms them"
  - "A refusal line under the step's button holds the server's sentence; 403 and 409 add 'Contact <team> at <email>.' from the workspace; kept in memory only"
metrics:
  started: "2026-11-20 15:22 UTC (step 0)"
  completed: "2026-11-20 (owner's screens run after the gate)"
  duration: "about 2 h 50 min, most of it waiting for the shared browser queue"
actuals:
  tokens: 16100
  tasks: 3
  commits: 13
plan_head_before: 38ffa1203e1438a640a975df6de4f44f02cd997f
plan_head_after: 560c49f0ddf11ee5787605a5477650e47817e5bd
---

# Phase 8 Plan 07: the verification package from the investor's side, proven end to end against stand-ins

One line: a sponsor ticks the box, the stand-in payment provider takes $19, the investor verifies identity inside onboarding through the package on a page in a new tab (the step names no one), the signed result returns, the invitation's names are screened through the package, the console imports a verified, screened investor; every refusal is the server's own plain sentence, with the firm's contact where it cannot be retried. Proven against stand-ins only: no real provider has confirmed anything (08-12 does that). Not done until the owner has checked it.

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

## Final verify (verify-3: the whole server suite, then the full phase gate)
`npm --prefix server test` alone first: `# tests 368`, `# pass 368`, `# fail 0` (duration 16.9 s).
verify-3: the suite again at the base count (`# tests 368`, `# fail 0`), then `P8_SERVER_TESTS=368 P8_OUT=$O bash checks/gate.sh`. Every gate step ok (0 GATE FAIL lines), among them `GATE ok   phase-8 gate checks found (4)`, `GATE ok   PACKAGE FLOW (7)`, `GATE ok   PACKAGE INVITE (12)`, `GATE ok   PACKAGE PANEL (7)`, `GATE ok   AML RECORD (7)`. The gate's last lines:
```
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 368
# pass 368
# fail 0
COUNTS server tests 368; AML RECORD 7; PACKAGE FLOW 7; PACKAGE INVITE 12; PACKAGE PANEL 7
GATE_EXIT=0
```
verify-3 exit 0 (gate run on eb47bca). The gate's leak part scanned 18 investor screens, 5 investor emails, 6 GET /v1/invite replies, 8 console screens and 8 account replies.

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

## After the gate
- One check-only change after the gate (560c49f): the owner's AML/KYC screenshot scrolls the investor's row into view and waits for the import's notices to fade (the first screenshot showed other investors under three notices). No assertion changed. Proven by a full run of the check afterwards: `PACKAGE FLOW: PASS (parts run: 7)` ($O/owner-shots.txt). The full phase gate itself ran on eb47bca, not rerun for this change.
- Gate outputs deleted as the plan says ($O/base-tree, $O/checks-out, $O/shots, $O/owner).
- The owner's screens, kept for the orchestrator's walkthrough, with index.txt: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-08-07/owner-shots (identity step at 1280x800 and at 390x844, the step after the result arrived, the refusal line at 390x844, the AML/KYC row after the import, and the owner's preview's AML/KYC page and sandbox identity step at both sizes).
- Owner check still owed (human-check of the plan): in the published preview on the iPhone, an investor's identity step and Console, AML/KYC look as before, with no error text, and Back leaves the step. The package's own step needs a connected portal; 08-12 shows it with the real providers.

## Out of scope, seen during the gate
- Phase 6's FORMS FLOW reference check prints a stand-in foreign tax ID (a test value, line 6a of the W-8BEN) in one PASS line of its output (forms.txt). Not this plan's file; listed for the orchestrator.
- The investor's chip reads "Verified· Identity check" (no space before the dot) on desktop; pre-existing styling of the chip, not changed here.

## Known stubs
None. The stand-ins are test-only (checks/doubles/); no product file holds a stand-in value.

## Threat flags
None beyond the plan's threat model (no new route, no new outside address; the browser now shows the server's own refusal sentences, which the server writes without provider text, except the 5xx path noted above).

## Self-Check: PASSED
- FOUND: checks/package-flow.js, checks/doubles/world.js, checks/doubles/accredit.mjs, assets/js/integrations.js
- FOUND in history and on origin/wip/08-07 (head 560c49f): 93c1724 e78f1db 0201466 f4e23ed 75f767b 2ee8b7e ae4c2c2 b2572d4 f08cc49 0d3561f eb47bca b6e88a3 560c49f
