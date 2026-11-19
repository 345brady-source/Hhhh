---
phase: 08-verification-package-and-ongoing-compliance
plan: 16
subsystem: payments
tags: [integration-server, billing, unresolved-payments, refunds, credit-owed, readme, node-test]
status: complete

requires:
  - phase: 08-verification-package-and-ongoing-compliance
    provides: "08-04 billing.mjs (payments, settle, closePaid, commit, serial); 08-14 deliveries, refunds, disputes, hold; 08-06 gate.sh and frame.js; 08-13 the package panel"
provides:
  - "payment deliveries (succeeded and failed) settled from the payment read back with the secret key: metadata.payment, customer and amount must match; closePaid inside the account's queue"
  - "GET /v1/billing: unresolved [{ at, cents }] and owedCents"
  - "POST /billing/admin/refund { entitlement } (ADMIN_TOKEN only); codes refund_not_allowed, refund_refused, refund_unconfirmed; entitlement status refunding; fields refundPrevious, refundAttempt, refundKey, refundCreditCents"
  - "billing record field owedCents; code credit_owed (409); store event credit_owed { account, cents }"
  - "createBilling's returned object gains refund(entitlementId)"
  - "the tier_mismatch sentence after a charge confirmed in the same call: \"This invitation's package was paid at another level.\""
  - "README section 'Verification package (for the operator)'"
affects: [08-07, 08-12, 08-13, 08-15]

tech-stack:
  added: []
  patterns:
    - "A payment nobody could confirm is settled only from the provider's own record of it, and its charge is checked for refunds and disputes in the same step"
    - "Credit already spent when its money goes back is owed, never silently lost: the balance stays at 0 or above and owedCents carries the rest"
    - "The operator's refund is on disk as refunding before the provider hears of it; the key changes only after a definite refusal"

key-files:
  created:
    - server/test/billing-settle.test.mjs
    - server/test/fixtures/billing/webhook-payment-succeeded.json
    - server/test/fixtures/billing/webhook-payment-failed.json
    - server/test/fixtures/billing/refund-created.json
  modified:
    - server/lib/billing.mjs
    - server/README.md
    - server/test/billing.test.mjs
    - assets/js/package.js
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/package-panel.js

key-decisions:
  - "The amount owed (R9) is a separate owedCents on the account's billing record, not a negative creditCents: 08-14's merged dispute test asserts the credit balance never goes below 0, and this plan may not edit it. The meaning is the same: balance = creditCents - owedCents"
  - "find() returns a key's newest usable package before a newer credited duplicate (bug found by the settlement test)"
  - "The payment read-back asks for the latest charge with its refunds in the same call, so a settlement is one read-back and R8 needs no second call"
  - "An operator refund already confirmed (by the route or by the provider's delivery) answers 200 again with no provider call; a package refunded only by a delivery answers refund_not_allowed"

requirements-completed: []
requirements-addressed: [VPK-02, VPK-05]

actuals:
  tokens: 16587
  tasks: 3
  commits: 3
plan_head_before: e3ccadc815493c21e08c3f1ad586ed608f765330
plan_head_after: c96dd563b686f4e24f1e30346ebf705635c3f658

metrics:
  duration: "20 min from the first command (21:24:06Z) to the last code commit (21:43:53Z); Task 3's verify and the phase gate ran until 22:33Z, mostly waiting in the shared browser queue; the base check of PACKAGE INVITE ended 22:39Z"
  completed: 2026-11-19
---

# Phase 08 Plan 16: Settling unresolved payments, the operator's card refund, credit owed, the operator's README Summary

**A payment whose outcome stayed unknown is now settled from the payment provider's own record, read back with the secret key, in both directions: paid becomes the packages it paid for, failed is closed with nothing owed. The sponsor sees such a payment in one line until then. Credit that was already spent when its money is refunded or disputed becomes an amount owed, and no new package is paid while anything is owed. The operator can refund an unused package to the card behind `ADMIN_TOKEN` only, with the refund written to disk before the provider is called. The operator's README section is written.**

Nothing here has been checked by the owner. No provider was called and no key was used. Every request, reply and delivery is a recorded example marked unconfirmed. Whether any of it matches the real provider is unknown until plan 08-12 runs it against the provider's test mode.

## Failures and limits first

1. **The phase gate ended `GATE_EXIT=1`, and the cause is in the base, not this plan.** The only failing step is `PACKAGE INVITE` (parts single, declined, phone, list). Each of them fails because the check sends a package invitation with the shared token, and the server refuses that with "Card payments need a sponsor account." (08-05's N1 rule). I ran the same check on a copy of the base e3ccadc, through the same queue. It printed the same last line, `PACKAGE INVITE: FAIL (parts run: 11) - single, declined, phone, list`, and the same five FAIL lines (`SCRATCH/exec-08-16/gate/invite-base.txt`). 08-05's summary already reported single, declined and phone. "list" was added later by 08-13 and has the same cause. The fix belongs in `checks/package-invite.js`, which this plan does not own (see 08-05's summary, "For the orchestrator").
2. **The gate did not hit the two-hour limit.** It ran from 21:44:40Z to 22:33:54Z.
3. **Bug found and fixed (Rule 1): `find()` could return a credited duplicate.** When a payment is settled after the sponsor has already bought the same key again, 08-04's twin rule credits the settled duplicate. That duplicate is newer, so `find` and `pay` read the key as unpaid. That would have broken 08-05's N3 gate and charged the key a third time. `newest()` now returns the newest usable entitlement first. Test "N7 unresolved then reported succeeded:" failed on exactly this in the RED run.
4. **The amount owed is not a negative credit (deviation from R9's wording).** It is stored as `owedCents` beside `creditCents`. The reason: 08-14's merged dispute test asserts that the credit balance goes to 0 and never below, and the plan forbids editing that file. The rule R9 asks for holds: it is owed, it blocks new packages (409 `credit_owed`), and the view shows it.
5. **An owed amount has no settle route.** Credit that comes back pays it first. Otherwise the operator must set `owedCents` to 0 in the store file while the server is stopped. The README says so. The same applies to restoring a package after a won dispute (08-14). A small admin route would remove this, but it is not in any plan.
6. **The invitation form still offers the package box while an amount is owed.** The server refuses with the `credit_owed` sentence. 08-07 shows the server's sentences, per R7.
7. **Defensive only, not testable by interleaving:** the R8 rule "a refusal never puts a status back over disputed or refunded". A delivery's action runs in the same per-account queue as the admin refund, so it cannot land during the provider call. The guard re-reads the status before putting it back anyway.
8. **One process only**, as before: card sessions, the per-account queue and holds live in memory.

## Verify lines (run from script files in `SCRATCH/exec-08-16/`)

Base: e3ccadc. Measured by a run: `# tests 329`, `# pass 329`, `# fail 0`. That matches the orchestrator's 329. The plan's expected 298 predates 08-05, 08-13, 09-05 and other merges.

Task 1 (`verify1.sh`; R4: `test "$(grep -c 'unresolved:' server/lib/billing.mjs)" -eq 1`):
```
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 279.023013
VERIFY EXIT: 0
```

Task 2 (`verify2.sh`, the plan's command exactly, at e41b235):
```
COUNTS: base 329 + own 6 = 335; run 335
# cancelled 0
# skipped 0
# todo 0
# duration_ms 796.890697
VERIFY EXIT: 0
```

Task 3 (`verify3.sh`, at c96dd56; the plan's command with 13 own tests, two more RED names, R5's `vendorScan`, and nine changed files):
```
COUNTS: base 329 + own 13 = 342; run 342
FIXTURES: ok
FIXTURE CHECK FAILS ON A PLANTED FIXTURE: ok
README SCAN (added lines): clean
README SCAN FAILS ON A PLANTED WORD: ok
README SHAPE: ok
1	1	assets/js/package.js
1	1	server/test/billing.test.mjs
SERVER MODE: PASS (parts run: 15)
WAYS OUT: PASS (parts run: 7)
VERIFY EXIT: 0
```

Phase gate (`gate-run.sh`: `P8_SERVER_TESTS=342 P8_OUT=SCRATCH/exec-08-16/gate bash checks/gate.sh`, at c96dd56), every GATE line:
```
GATE ok   server tests # fail 0
GATE ok   server tests 342 (found 342)
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3)
GATE ok   AGREEMENT NAME
GATE ok   TAX REQUEST LEAVE (5)
GATE ok   WAYS OUT (7)
GATE ok   NO NETWORK (3)
GATE ok   EMBED DATA (3)
GATE ok   SAFARI FINISH (6)
GATE ok   phase-8 gate checks found (2)
GATE FAIL PACKAGE INVITE (not passed)
GATE ok   PACKAGE PANEL (7)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
COUNTS server tests 342; PACKAGE INVITE 0; PACKAGE PANEL 7
GATE_EXIT=1
```

## RED runs and mutations

- Task 1 (`red.txt`): `not ok 1 - tracer: an unresolved payment shows in the sponsor’s billing view and is settled into a recorded package by the provider’s payment delivery` (`unresolved` was undefined). R1: after the code, before the one-line edit, `billing.test.mjs` failed with `not ok 1 - tracer: a sponsor saves a card ...` (`r1-red.txt`, 24 of 25 passing).
- Task 2 (`red2.txt`, against 922a470): `# tests 6 / # pass 4 / # fail 2`. These two failed: `not ok 2 - N7 unresolved then reported succeeded:` (the `find` bug above) and `not ok 6 - N7 wording:`.
- Task 3 (`red3.txt`, against e41b235): `# tests 13 / # pass 6 / # fail 7`. All seven new tests failed: N6 admin refund, N6 admin refund refused and unknown, N6 admin refund then delivery, W7 admin only, W6 no vendor text, credit owed, R10 refund counted once.
- Panel check part (owed line): run against the base `package.js`, it printed `FAIL panel an amount owed: one line "Amount owed $19"` and `PACKAGE PANEL: FAIL (parts run: 1) - panel`. With the change, the whole check printed `PACKAGE PANEL: PASS (parts run: 7)`.

Mutations (`mutations.txt`: one rule broken at a time in billing.mjs, then restored; 22 run, 0 survived):

| Rule broken | Test that failed |
|---|---|
| a payment read back as not charged is not closed | N7 unresolved then reported failed |
| the amount is not compared / the customer is not compared / a closed payment is settled again | N7 mismatch (each) |
| a pending payment is not settled by a delivery | N7 pending reported succeeded |
| find returns a credited duplicate | N7 unresolved then reported succeeded |
| R8: the settled charge is not checked for refunds / for a dispute | N7 unresolved then reported succeeded (each) |
| the old sentence after a charge confirmed in the same call | N7 wording |
| refunding not flushed before the provider call / a started package refundable / spent credit refundable | N6 admin refund (each) |
| a refusal keeps the key / an unknown outcome treated as refused / refused credit not put back | N6 admin refund refused and unknown (each) |
| the operator's repeat after the delivery confirmed it calls the provider | N6 admin refund then delivery |
| X-Invite-Token beside ADMIN_TOKEN let through | W7 admin only |
| the provider's error text written to an event | W6 no vendor text |
| owed does not block / spent credit not owed / returned credit does not pay owed first | credit owed (each) |
| a full refund writes each price on top of earlier refund lines | R10 refund counted once |

## What was built

- **Payment deliveries (N7).** A `payment_intent.succeeded` or `payment_intent.payment_failed` delivery (names in `ASSUMED`) is checked like any delivery: signature, freshness, duplicate check. Then the payment is read back. The event type in the body is not believed; only the read-back's status counts. The read-back must name one of this server's payment records in `metadata.payment`, for that account's customer and for exactly its card amount. Otherwise nothing changes, it answers 200 and it is recorded as seen. Inside the account's queue, a `pending` or `unresolved` record read back as `succeeded` goes through `closePaid` once. A key bought again meanwhile is credited by the twin rule. Then its charge, included in the same read-back, is passed to 08-14's refund and dispute actions (R8), so a package whose money already went back is never left usable. A read-back status in `paymentFailed` closes the record as `failed` with nothing recorded. A succeeded or failed record is never changed. A failed read-back answers 503 and records nothing.
- **`GET /v1/billing`** gains `unresolved: [{ at, cents }]` (no id; `[]` when none) and `owedCents`.
- **Wording.** When `settle` confirmed a charge in the same call and the key is then refused for its level, the reply is 409 `tier_mismatch` "This invitation's package was paid at another level.". A plain mismatch keeps "... Nothing was charged.".
- **Operator refund (N6, W7).** `POST /billing/admin/refund { entitlement }` is checked in this order: POST only (else 405); 404 without `ADMIN_TOKEN`; 401 for any `X-Invite-Token`; 401 unless the bearer equals `ADMIN_TOKEN` (constant time); 404 for an unknown id. It is allowed only for a package paid by card with a charge, whose check has not started and is not being started (hold), and that is paid, consumed, or credited with its whole credit still in the balance. Otherwise it answers 409 `refund_not_allowed` with no provider call. The package is then written as `refunding`, and a credited one's credit leaves the balance now. That is flushed before `POST /refunds` (form `payment_intent`, `amount`, `metadata[entitlement]`; key = SHA-256 of `refund`, the id and the attempt number). Success: `refunded`, with one card line (plus one credit line for a credited one), and 200 `{ refunded: true, cents }`. A definite refusal puts the previous status and the credit back, adds 1 to the attempt number, and answers 409 `refund_refused`. Anything else stays `refunding` and answers 409 `refund_unconfirmed`, and the next call repeats the same key. The provider's refund delivery makes a `refunding` package `refunded` and writes nothing for one already refunded.
- **Credit owed (R9).** When a refund or dispute takes back credit that was partly or wholly spent, the balance goes to 0. The spent part is added to `owedCents`, with the event `credit_owed { account, cents }`. While `owedCents` is above 0, `entitle` refuses any call that needs a new package with 409 `credit_owed` "A refunded payment left an amount owed. Settle it before adding packages.", before any charge. Keys already paid still answer 200 with nothing charged. Credit returned later pays the owed amount first.
- **Refunds counted once (R10).** A full refund writes card refund lines up to the charge's amount, less what earlier refund lines for that charge already hold.
- **Panel.** `assets/js/package.js`: one changed line shows `Amount owed $X` (id `pkg-owed`) when `owedCents` is above 0. The unresolved line was already built by 08-13. Check part added in `checks/package-panel.js` (part `panel`).
- **README.** One block, "## Verification package (for the operator)", directly above "## Data protection" (32 lines added, none removed, one region). It holds every billing and package setting with its default, the two addresses to register, the rules, the refund route and the limits. Neutral names only; the vendor scan of the added lines is clean and fails on a planted word.

## Assumptions added for plan 08-12 (in `ASSUMED`, each unconfirmed)

1. Payment read-back: `GET /payment_intents/:id?expand[]=latest_charge.refunds`. This changes 08-14's entry, which had no expand and which nothing used. Fields: `id`, `status`, `amount`, `customer`, `metadata.payment`, and `latest_charge` as a charge object with the fields of `chargeRead`.
2. A payment read back with `requires_payment_method`, `requires_action`, `requires_confirmation` or `canceled` was not charged. Any other status but `succeeded` (for example `processing`) is left alone.
3. A payment event's object is the payment, with its id in `id` (08-14's `paymentOf`).
4. Refund call: `POST /refunds`, form-encoded `payment_intent`, `amount`, `metadata[entitlement]`, with the idempotency header (same key rules as charges). Reply fields `id`, `status`. `succeeded` means the money went back. `failed` or `canceled` means it did not (08-14's `refundNotGone`). Any other status (`pending`) is not known yet. HTTP 400, 401, 402, 403 and 404 mean the refund was refused and nothing went back.
5. Fixtures: `webhook-payment-succeeded.json` and `webhook-payment-failed.json` (the event object also stands for the read-back), and `refund-created.json`. All three `_status` start with `unconfirmed`.

## Task commits

1. `922a470` feat(08-16): an unresolved payment shows in the sponsor's billing view and is settled by the provider's payment delivery (tracer)
2. `e41b235` feat(08-16): every settlement rule for unresolved payments, and no 'Nothing was charged' after a confirmed charge
3. `c96dd56` feat(08-16): the operator's card refund behind ADMIN_TOKEN, credit owed after a refund of spent credit, refunds counted once, the operator's README section

## Deviations from Plan

1. **[Rule 1] `newest()` prefers the newest usable entitlement** (Failure 3). Commit e41b235.
2. **[R9, R10, added by 08-CONTEXT] Two more top-level tests:** "credit owed:" and "R10 refund counted once:". There are 13 own tests, not 11. R8 is asserted inside "N7 unresolved then reported succeeded:", with two mutations of its own.
3. **[R1] `billing.test.mjs` line 152** is the one changed line (numstat `1	1`). It gains `'unresolved'`, as R1 allows, and also `'owedCents'`, which R9 needs for the view to show the amount owed. Still one line. No test count changed.
4. **[Orchestrator] Two files outside the plan's six:** `assets/js/package.js` (one changed line, the owed line) and `checks/package-panel.js` (one check block of 9 lines and one comment line changed). With `billing.test.mjs`, nine files changed. Task 3's names list was adjusted to those nine.
5. **[R5] The README scan uses `frame.js`'s `vendorScan`,** not the plan's raw `new RegExp(word)`.
6. **[R4] Task 1's check is exact:** `grep -c 'unresolved:'` equals 1.
7. **[Interpretation] `refund(entitlementId)` is exported on createBilling's object,** so the "held by a start" case can be tested on the same instance that holds the hold.
8. **[Rule 2] Settlement throws 503 when a succeeded read-back has no charge object**, rather than recording packages it cannot check for refunds (R8).
9. **Duplicate test helpers** (`gateway`, `j`, `account`, `saveCard`, `buy`), as 08-14 did, because importing another test file would run its tests.
10. **Push** to `wip/08-16` only. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Lines added to shared files

- `server/test/billing.test.mjs`: line 152 changed (key list + `'unresolved', 'owedCents'`).
- `assets/js/package.js`: one changed line in `panelBody`'s template (`${Number(d.owedCents) > 0 ? '<p class="cs-error" id="pkg-owed">Amount owed …</p>' : ''}` after the credit line).
- `.planning/phases/08-.../checks/package-panel.js`: 9 lines added in part `panel` after the unresolved checks, 1 comment line changed.
- `server/README.md`: 32 lines added in one block between "## Filings"'s end and "## Data protection". No row in the shared settings table.
- `server/index.mjs`, `server/lib/invitations.mjs`, `server/lib/store.mjs`: untouched.

## For the orchestrator and the next plans

- **08-15 (parallel):** `refunding` is unusable like `refunded` and `disputed`. The N3 gate already accepts only `consumed`. `find` now returns the usable entitlement before a newer credited duplicate. That makes 08-15's check (`e.id === rec.package.entitlement`) hold after a settlement.
- **08-07:** show `credit_owed` and the new `tier_mismatch` sentence as sent. Consider disabling the package box while `owedCents` is above 0.
- **08-12:** the five assumptions above. Register `<PUBLIC_URL>/billing/webhook` for `payment_intent.succeeded` and `payment_intent.payment_failed` as well as the refund and dispute events.
- **PACKAGE INVITE:** fails the same way on the base (Failure 1). It needs a plan that may edit `checks/package-invite.js`.
- **Test count after merge:** 329 + 13, plus whatever 08-15 adds.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: server/test/billing-settle.test.mjs, the three fixtures, server/lib/billing.mjs, server/README.md
- FOUND commits 922a470, e41b235, c96dd56 (ancestors of HEAD)
- `server/node_modules` linked for runs only, never staged. Screenshots, check folders and the base-tree copy were deleted after the gate.
