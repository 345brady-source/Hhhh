---
phase: 10-investor-tax-documents-and-withholding
plan: 12
subsystem: tax document delivery to the investor's own device (self-serve, needs the server)
status: complete
tags: [k-1, delivery, consent, rev-proc-2012-17, server, link, opens]
requires: [10-02, 10-04, 10-06]
provides:
  - "server/lib/taxdocs.mjs: createTaxDocs (the sponsor's calls POST/GET /v1/taxdocs, withdraw, resend; the investor's GET /v1/taxdoc and POST /v1/taxdoc/open with X-Doc-Token; sealing, five tries, consent at the link, the access-period purge)"
  - "assets/js/taxlink.js: NS.taxUI.link (connected, send, rowLine, pull, withdraw, resend) and NS.views.taxdoc (the investor's one screen, #taxdoc-<token>)"
  - "server/test/taxdocs.test.mjs: 14 tests; checks/taxlink-flow.js: 6 parts"
affects: [10-10, 10-13]
tech-stack:
  added: []
  patterns: ["a link token with its own header and address prefix (X-Doc-Token, #taxdoc-), checked before the invitation token's block", "the purge runs after the call is answered, throttled to once a minute"]
key-files:
  created:
    - server/lib/taxdocs.mjs
    - server/test/taxdocs.test.mjs
    - assets/js/taxlink.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/taxlink-flow.js
  modified:
    - server/index.mjs
    - server/lib/store.mjs
    - server/lib/http.mjs
    - server/README.md
    - server/help/guide.md
    - server/lib/help-guide.mjs
    - assets/js/app.js
    - assets/js/taxdocs-ui.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/walk3-fixes.js
    - .planning/tools/preview/help-data.js
decisions:
  - "The server module takes the invitations' vault and mailer (one key, one outbox) and their portal-address test (PORTAL_ORIGIN)"
  - "A document waiting for consent is sent to the server too; its first message asks for consent and is not the section 7.01 notice"
  - "The section 7.01 notice sent after a consent at the link carries the link the investor is using (the token is in the request; it is never stored)"
  - "The investor's last four for the link: the W-9's, else the investor's, else (the only number on record) the foreign number's (planner's choice 5)"
  - "A replaced document keeps opening on the server until its own available-until date (C-09); only a withdrawn one stops at once"
metrics:
  completed: 2026-11-20
  tasks: 3
estimate:
  tokens: 118000
  tasks: 3
actuals:
  tokens: 26400     # chars/4 over the added lines since 92fda02 (code, tests, check, README, guide), help-guide.mjs and help-data.js (generated) and this summary left out
  tasks: 3
  commits: 12       # git rev-list --count 92fda02..9b91696 (6 named commits, 6 save commits); this summary is the 13th
plan_head_before: 92fda021277ede4bc2e72f777829e331dd0597a7
plan_head_after: 9b91696
---

# Phase 10 Plan 12: delivery to the investor's own device Summary

With the portal connected to the firm's server, delivering a tax document now also sends that one document to the server, sealed. The investor gets an email with a link; on any device the link opens one screen with the firm's name and the document's title, asks for the last four digits of the tax number on record, shows the consent's disclosure first where consent is missing, then draws the pages with Save. Opens and a consent given at the link come back to the sponsor's row the next time the Tax documents page is open. Everything here was measured against the real server code running in the check's own process, with a second browser at 390x844 as the investor's phone, on invented data. **None of it runs in the owner's no-server preview, and the owner has not checked any of it yet.**

## Failures and open points first

- **The phase gate ended `GATE_EXIT=1`.** It was killed once by the 2-hour limit of the background run (after K1 SPLIT) and resumed into the same folder on the same tree. Final failures, both caused by this plan and both fixed afterwards in 9b91696:
  - **WALK3 FIXES (9):** the 06 check `walk3-fixes.js` part parts-load asserted that taxlink.js is not in NS.taxUI.PARTS "until plan 10-12 adds it". The assertion now requires only that every listed part is shipped. Rerun alone on 9b91696: `WALK3 FIXES: PASS (parts run: 9)`.
  - **HELP PREVIEW (6):** the preview's copy of the help guide (`.planning/tools/preview/help-data.js`) was stale after the new guide entry (`help-data.js: STALE (server guide 20c644bdb361)`). Regenerated with `node .planning/tools/preview/make-help-data.mjs`. Rerun alone on 9b91696: `HELP PREVIEW: PASS (parts run: 6)`.
  - In the first run, MEASURE failed (`FAIL walkA (900 s): individual: 0 PASS, 0 FAIL`, `FAIL walkB (900 s): firm: 0 PASS, 0 FAIL`: the walks never got a browser while seven other heavy jobs held the shared queue) and CO-INVESTOR SERVER failed (`cosign-forged the same submission arriving again changes nothing ... {"said":[],"same":true}`, a fixed 2.5 s wait after "Check now"). Both passed in the resumed run on the same tree (`GATE ok   MEASURE`, `GATE ok   CO-INVESTOR SERVER (5)`).
  - The full gate was not run a third time on 9b91696 (it takes more than two hours here). The orchestrator's gate on the merged tree is the full proof.
- **Not built as the plan's truth reads: a returned notice does not reach the sponsor's own mailbox.** A bounce goes to the server's sending address (`MAIL_FROM`, the envelope sender), not to the firm's contact; the reply-to is the firm's contact, so replies reach the firm, bounces do not. The sponsor still marks a returned notice with plan 10-06's "Notice came back". Changing the envelope sender is a mail-module decision (deliverability), not made here. Invitations have the same behaviour today.
- **Replaced documents keep opening on the server** until their own available-until date (C-09, decided after the plan was first written); the plan's truth said "a withdrawn or replaced document stops opening at once". Withdrawn ones stop at once and their file is removed.
- **Disclosures: eight, not seven.** The investor's screen shows NS.taxdocs.CONSENT.lines, which has eight entries since 10-02 (B4: 5.01 to 5.08); the plan's part text said seven. The check compares with the portal's own list.
- **RED could not be shown on the tree for seven tests and two parts** whose behaviour the tracer had already built (sealed, tokens, workspaces, list, opens; parts wrong and noserver). Each was shown able to fail by a mutation of the code instead (below).
- **Not proven:** real mail delivery, a deployed server, an iPhone. The orchestrator's walk needs a deployed server; the owner's check (below) is pending.
- **The sponsor guide is near its limit:** 46,698 of 48,000 bytes (+412 for the taxdoc entry, which both guides carry). The investor guide is 15,436 of 20,000 (was 15,024). The entry is 520 bytes.
- **Planner's choices the owner may reverse:** the four-digit check (the alternative is the link alone, as an invitation works); five tries; 10 MB per document; an investor whose only number on record is foreign is checked against its last four.

## RED, then GREEN (outputs kept in SCRATCH/exec-10-12)

### Task 1
- red-1.txt (server tests, before any code):
  - `not ok 1 - create: the document is stored sealed and the answer has a link to the portal page that ends in taxdoc- and a token` (expected 200, actual 404)
  - `not ok 2 - the investor's GET with the link's token gives the firm, the title and what is needed, and nothing else` (expected 200, actual 401)
  - `not ok 3 - open with the right four digits and consent in effect returns the bytes uploaded, and the status becomes opened with one open` (expected 200, actual 401)
  - `# tests 3`, `# pass 0`, `# fail 3`
- red-1.txt (check, before any code):
  - `FAIL open-phone Deliver delivers the K-1 and sends it to the server: the document holds the link id and the email status :: {"state":"delivered","link":null}`
  - `FAIL open-phone the row says the link was sent to the investor's email :: Davis Family Trust · KBC-1001 · ending 6789 Pages 1 to 2 · Picked by hand · Check admin Available until May 20, 2027 · Not opened Notice Notice came back Withdraw Delivered`
  - `FAIL open-phone ran to the end :: TypeError: Cannot read properties of undefined (reading 'match')` (the check's own reader of the outbox failed on an empty outbox; fixed in the check before the code was written)
  - `TAXLINK FLOW: FAIL (parts run: 1) - open-phone`
- Task 1 verify (exit 0): unit.txt `# tests 3`, `# pass 3`, `# fail 0`; tracer.txt `TAXLINK FLOW: PASS (parts run: 1)` (15 PASS lines, among them `PASS open-phone with 6789 the pages are drawn in the page and Save is offered` and `PASS open-phone back on the console, opening Tax documents again shows the row as opened once on their device`). The tracer gate: the automated verify was run again end to end and passed before any expansion.

### Task 2
- The eleven rule tests were committed (save commit) before the rule code. red-2.txt: `# tests 14`, `# pass 8`, `# fail 6`; the failing ones:
  - `not ok 5 - notice: ...` (resend: `{"error":"Not found"}`), `not ok 7 - digits: ...`, `not ok 8 - consent: ...`, `not ok 9 - withdrawn: ...`, `not ok 10 - period: ...`, `not ok 12 - limits: ...` (a last4 given as a number instead of text was accepted: `200 !== 400`)
  - Five rule tests passed at once (sealed, tokens, workspaces, list, opens): the tracer's code already sealed the record, refused other tokens, pinned the workspace and counted opens. Each was then shown able to fail by a mutation of the module (red-2-mutations.txt; the module restored after each): `MUTATION sealed` (the name stored in plain) `not ok 1 - sealed: ...`; `MUTATION tokens` (the investor's paths accept anything) `not ok 1 - tokens: ...`; `MUTATION workspaces` (no pinning) `not ok 1 - workspaces: ...`; `MUTATION list` (the token's hash listed) `not ok 1 - list: ...`; `MUTATION opens` (the count stays 1) `not ok 1 - opens: ...`.
  - One test changed after RED, before GREEN: `period` first asked both the GET and the open for 410 on 2028-01-01; with the purge running right after each answer (W1), the first call's purge removes the record, so the test now asks the open for 410, purges, and then finds the link unknown (404).
- Task 2 verify (exit 0): `# tests 14`, `# pass 14`, `# fail 0`; the marker `// gate: tests 14`; server/lib/invitations.mjs unchanged.

### Task 3
- The five parts were committed (save commit) before the code. red-3.txt `TAXLINK FLOW: FAIL (parts run: 5) - consent-phone, withdrawn, notice`:
  - `FAIL consent-phone with no consent in effect, Deliver holds the K-1 back (waiting) and still sends it to the server :: {"state":"waiting","link":null,"consent":null,"hidden":true}`
  - `FAIL consent-phone the first message asks for consent and does not carry the section 7.01 subject :: []`
  - `FAIL consent-phone on the investor's device the screen shows the consent's 8 disclosures as the portal gives them, and the four-digit field :: {"shown":0,"want":8}`
  - `FAIL withdrawn Withdraw on the console withdraws the document there and on the server :: {"local":"withdrawn","server":["sent"]}`
  - `FAIL withdrawn its file is removed from the server :: 1`
  - `FAIL withdrawn the investor's link says in one line that the document is no longer available and shows nothing else :: {"main":["Schedule K-1 (Form 1065) 2025",...`
  - `FAIL notice the row says to send it on paper :: Davis Family Trust · KBC-1001 Pages 1 to 2 · Picked by hand · Check admin Withdraw Waiting for consent`
  - Parts wrong and noserver passed at once (the tracer's taxlink.js already drew the locked line and made no call without a server). Each was shown able to fail by a mutation of taxlink.js (red-3-mutations.txt, the file restored after): without the locked line, `FAIL wrong the sponsor's row reads locked, with Resend :: ... Link sent by email on November 20, 2026. ...`; with connected() always true, `FAIL noserver the policy refused nothing (no fetch, no outside script) :: ["connect-src http://127.0.0.1:44265/v1/taxdocs?workspace=kestrel-bay", ...]` and five other FAIL lines.
- One check line of mine was wrong after the code: consent-phone compared the screen's disclosures with NS.taxdocs.CONSENT.lines of an empty contact (`{"shown":8,"want":8}` but the 5.05 line differed); it now uses the firm's saved contact, which is what the console sends. consent-phone alone then: `TAXLINK FLOW: PASS (parts run: 1)` (12 PASS lines).
- Before the gate: `server/lib/help-guide.mjs is in sync with server/help/rules.md and server/help/guide.md`; help-guide tests `# tests 9`, `# pass 9`, `# fail 0`.

## Gate (GATE_OUT=SCRATCH/exec-10-12, base 92fda02, P10_ROOT unset; the resumed run's last lines, verbatim)

```
GATE ok   SCREEN EDGES (5) (kept from 2026-11-20 17:26:58 UTC)
GATE FAIL WALK3 FIXES (9)
GATE ok   TITLES AND EDITOR (4) (kept from 2026-11-20 17:28:19 UTC)
GATE ok   PRESS AND CO-INVESTOR (10) (kept from 2026-11-20 17:30:40 UTC)
GATE ok   CO-INVESTOR SERVER (5)
GATE FAIL HELP PREVIEW (6)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing-base (kept from 2026-11-20 17:34:22 UTC)
GATE ok   signing-plan (kept from 2026-11-20 17:41:28 UTC)
GATE ok   record-base (kept from 2026-11-20 17:44:35 UTC)
GATE ok   record-plan (kept from 2026-11-20 17:47:01 UTC)
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 382
# pass 382
# fail 0
GATE ok   base-server-tests (kept from 2026-11-20 17:47:22 UTC)
GATE ok   server tests 382 = base 368 + 14 declared
GATE ok   DIST FLOW (kept from 2026-11-20 17:52:50 UTC)
GATE ok   DIST RECORD (kept from 2026-11-20 17:52:52 UTC)
GATE ok   K1 SPLIT (kept from 2026-11-20 17:53:09 UTC)
GATE ok   SHIPPED LIBS
GATE ok   TAX 1099
GATE ok   TAX FORMS
GATE ok   TAX MATH
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXLINK FLOW
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE_EXIT=1
```

Every other reference step passed (server tests # fail 0, STATUS MATH 13, FORM MAPS 3, FORMS FLOW 34, STATUS FLOW 26, SERVER MODE 15, TWO PERSONS, MEASURE, the owner's folder, EMAIL DIALOG 3, AGREEMENT NAME, TAX REQUEST LEAVE 5, WAYS OUT 7, NO NETWORK 3, EMBED DATA 3, SAFARI FINISH 6, BANK STEP TYPING 2, HELP CHAT 10, REAL FIRM 9, SIGNING DOCUMENTS 8, PHONE LAYOUT 8, RECORD AND LOST AGREEMENT 7). The gate's run of this plan's check ended `TAXLINK FLOW: PASS (parts run: 6)` (58 PASS lines). Server tests: **382 = 368 at the base + 14 added**. After the fixes (9b91696): `WALK3 FIXES: PASS (parts run: 9)`, `HELP PREVIEW: PASS (parts run: 6)`.

## Deviations from Plan

1. **[Rule 3] server/lib/store.mjs** gains the `taxdocs` collection (one line): the store throws on a collection it does not know.
2. **[Rule 3] server/lib/http.mjs** allows the `X-Doc-Token` header across origins (one word in the CORS list): the portal page and the server are on different origins, and the browser refused the investor's call without it.
3. **[Rule 2] createTaxDocs** takes the invitations' vault, mailer and portal-address test (`returnTo`, PORTAL_ORIGIN) as well as the interface's arguments: one outbox, one key, and a link that can only point at the firm's own portal page.
4. **[Rule 3] assets/js/taxdocs-ui.js** (beyond B2 and B3): a placeholder `NS.views.taxdoc` ("Opening your tax document…") until taxlink.js loads. Without it, a link carrying `?server=` is read before taxlink.js has loaded and the app sends the browser to the invitation page, losing the token. A document waiting for consent is sent to the server when it is connected (otherwise TAX-06 at the link could not happen). B3's pull "on each render" would redraw forever, so it runs once each time the page is opened (reset on every address change), and the withdrawal on the server is awaited inside a try.
5. **[Rule 1] two gate steps that waited for this plan** (walk3-fixes.js parts-load, the preview's help-data.js), in 9b91696.
6. **The period test** asks the open for 410 on 2028-01-01, then purges and finds the link unknown, because the purge runs right after each answer (W1).
7. **The "mail server refuses the recipient" test** uses a small mail server written in the test (the shared stand-in has no refusal), refusing at RCPT and then accepting for the resend.
8. **Commits:** the tracer's code is in save commit 67af493 and later code in save commits (e06edd0, 64e3677, 25666d0, 9b8dc22), because the save rules commit work before each long run; history was not rewritten.
9. The interface's events: `taxdoc_created`, `taxdoc_opened`, `taxdoc_locked`, `taxdoc_consent`, `taxdoc_withdrawn`, `taxdoc_resent`, `taxdoc_purged`; each holds `at`, `type` and `id` only (test sealed).

## Commits

| Commit | What |
|---|---|
| 9d44d16 | save: tracer test and check |
| 178e351 | test(10-12): tracer RED: three server tests and part open-phone |
| 67af493 | save: the tracer's code (module, routes, taxlink.js, app.js prefix, PARTS) |
| 2f04c2f | feat(10-12): tracer: a delivered tax document reaches a second device through the server |
| c670321 | save: the eleven rule tests |
| 9c16307 | feat(10-12): the server's rules for tax-document links |
| 64e3677, e06edd0, 25666d0, 9b8dc22 | save: Task 3 parts, then code, guide, README, help-guide.mjs, a check fix |
| 02136e6 | feat(10-12): consent at the link, withdraw on the server, the guide entry and the README section |
| 9b91696 | fix(10-12): two gate steps that waited for this plan |

## Files a preview build must add

- `assets/js/taxlink.js` (shipped; loaded by taxdocs-ui.js's PARTS). It makes no call in the preview: no server is connected there.
- `server/lib/taxdocs.mjs` is server code (not part of the preview).

## Threat surface

All new surface is in the plan's threat model (T-10-35 to T-10-41): the two investor calls behind X-Doc-Token, the four sponsor calls behind the sponsor gate. The one change outside it: `X-Doc-Token` added to the CORS allowed headers (needed for the investor's page on the portal's origin).

## The owner's check (pending)

With a deployed server connected to the portal (the orchestrator sets this up): deliver a K-1 to an investor whose email is one of yours; open the email on your phone; follow the link; enter the last four digits; read and save the K-1; then look at the row on the console. Expected: the email's subject is the IRS's words; the link opens one screen; wrong digits show nothing of the document; the K-1's pages are drawn and it saves; the console shows it was opened.

## Self-Check: PASSED

- Files: server/lib/taxdocs.mjs, server/test/taxdocs.test.mjs, assets/js/taxlink.js, checks/taxlink-flow.js exist; `## Tax documents` in server/README.md and `## taxdoc` in server/help/guide.md; `node server/help/build.mjs --verify` in sync.
- Commits 178e351, 2f04c2f, 9c16307, 02136e6, 9b91696 are ancestors of HEAD and pushed to wip/10-12.
- server/lib/invitations.mjs, assets/js/invitations.js, assets/js/console.js, index.html, diy.html and portal.html are unchanged since 92fda02.
- No full taxpayer number anywhere: every number used is invented, and the only digits on record in tests and checks are invented last fours.
