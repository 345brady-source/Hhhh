---
phase: 08-verification-package-and-ongoing-compliance
plan: 14
subsystem: payments
tags: [integration-server, billing, webhook, refunds, disputes, hold, node-test]
status: complete

requires:
  - phase: 08-verification-package-and-ongoing-compliance
    provides: "plan 08-04: billing.mjs (card on file, entitlements, ledger, payments, serial, credit, release, started, consume, view)"
  - phase: 08-verification-package-and-ongoing-compliance
    provides: "plan 08-06: checks/gate.sh and checks/frame.js (step 0 requires them)"
provides:
  - "POST /billing/webhook (inside billing.mjs; reached through 08-04's existing /billing/ hook line); env BILLING_WEBHOOK_SECRET"
  - "hold(entitlementId) -> finish(ok) on createBilling's returned object"
  - "entitlement statuses refunded and disputed; ledger types refund and dispute; ledger field refundRef"
  - "store events webhook_rejected { provider: 'billing' }, refund_unmatched { account }, payment_disputed { account, entitlements }"
  - "ASSUMED entries for the delivery, the event names (including the two payment events 08-16 needs), the object paths, the charge read-back and the payment read-back path"
affects: [08-12, 08-15, 08-16, 08-13]

tech-stack:
  added: []
  patterns:
    - "A delivery is believed only for which charge to read; what changes money is the provider's own record, read back with the secret key"
    - "A delivery is recorded as seen only after its actions are flushed; a duplicate is found by a read that records nothing"
    - "Every action on a delivery is idempotent on the store, so a retry or a second event for the same charge writes nothing"

key-files:
  created:
    - server/test/billing-webhook.test.mjs
    - server/test/fixtures/billing/webhook-refunded.json
    - server/test/fixtures/billing/webhook-dispute.json
    - server/test/fixtures/billing/charge-read.json
  modified:
    - server/lib/billing.mjs

key-decisions:
  - "The delivery's signature header is split with billing.mjs's own two fixed patterns, then each signature is checked by connector.mjs verify (HMAC over the exact bytes, freshness, constant-time compare); the connector's sandboxed pattern matcher refused genuine deliveries under load"
  - "A disputed package gets one card dispute line each; a credited one also gets a credit line for the credit actually removed"
  - "A partial refund matched to a package records the refund's own amount; a full refund records each package's price"
  - "Refunds whose status is failed or canceled are ignored (the money did not go back)"
  - "An event type this module does not act on, or one naming no charge, answers 200 and is not recorded as seen"

requirements-completed: []
requirements-addressed: [VPK-02, VPK-05]

actuals:
  tokens: 13535
  tasks: 3
  commits: 3
plan_head_before: 2163866402571e8f8b89e3347a98fce96416d3b4
plan_head_after: 123cd6303b23ac89a2663ef26eb15155decf5964

metrics:
  duration: "15 min from the first command (18:46:22Z) to the last code commit (19:00:59Z); 24 min to the end of Task 3's verify (19:10Z), about 9 of them waiting in the shared browser queue"
  completed: 2026-11-19
---

# Phase 08 Plan 14: The payment provider's deliveries, refunds, disputes and the hold Summary

**Refunds and disputes from the payment provider reach a sponsor's packages only when the delivery's signature and fresh signed time are good and the provider's own record of the charge, read back with the secret key, agrees. A refunded or disputed package, and any credit it gave, can no longer be used. A cancel during a check's start never credits a package whose check then runs. Built and tested against recorded replies only.**

Nothing here has been checked by the owner. No call was made to the payment provider and no key exists. No page of the provider's reference can be read from here, so every header, event name, path and field is an assumption in `ASSUMED`. Whether real deliveries are accepted is unknown until plan 08-12 runs against the provider's test mode.

## Failures and limits first

- **A genuine delivery was refused under load (found and fixed here).** The first build used `connector.mjs verify` with the signature patterns, as the plan says. The whole suite, run with `billing.test.mjs` beside it, failed once on a correctly signed delivery (401). The cause is the connector's pattern matcher. It runs patterns in a sandbox with a 50 ms limit, because those patterns are written by sponsors. On a busy machine that limit is missed and the header yields no signature. Measured with 24 processes at once on 4 cores: before the fix, 26 of 72 runs failed (10 detected as a genuine delivery answered 401; the rest were the same 401 seen through other assertions). After the fix, 0 of 72 failed. The fix: billing.mjs splits the header with its own two fixed, linear patterns, then hands each signature to `connector.mjs verify` for the HMAC over the exact bytes, the freshness and the constant-time comparison. There is no deterministic unit test for this, because it depends on load. The proof is the stress measurement (`SCRATCH/exec-08-14/stress-before.txt`, `stress-after.txt`).
- **The same latent fault is in the existing `POST /webhooks/:provider` route** for any connector that uses `pattern` or `timestampPattern`. A provider retries a 401, so a delivery is late, not lost. It is outside this plan's files and was not touched. It is listed for the orchestrator below.
- **Six of the eleven tests were already green when first run.** Each is proven instead by a mutation run: break the rule in billing.mjs, see the test fail, restore. Those six are the four N5 tests (Task 1's tracer code already did the N5 order), W6 and N8. Five have a true RED run: the tracer, the three N6 tests and "I2 hold". One mutation survived (see the table). It removes a guard that the connector itself repeats, so it is not a gap.
- **Credit already spent cannot be taken back.** A refund or dispute removes a credited package's credit down to 0, as N6 says. If that credit already paid for another package, that other package stays usable. The money behind it is gone, and nothing here records that.
- **A charge partly refunded with an unmatched refund, then wholly refunded,** writes each package's price as a refund line, on top of the earlier unmatched line. The ledger then over-counts the refunded amount by the unmatched refund. No entitlement is wrong.
- **The plan's "the vendor's name appears only in the API and SCRIPT constants" is not literally true.** `ASSUMED.webhook.header` holds the provider's signature header name. That is unavoidable, and 08-04's card page already names the provider's script function. No reply, event or log line holds it (W6 checks this, and a mutation that puts the header name in the rejected event makes W6 fail).
- **One process only:** holds live in memory, like the card sessions.

## Verify lines

Base: 2163866, measured by a run (`# tests 272`, `# pass 272`, `# fail 0`). That matches the expected 272.

Task 1 (`SCRATCH/exec-08-14/verify1.sh`):

```
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 251.448045
VERIFY EXIT: 0
```

Task 2 (`verify2.sh`, at afc5921):

```
COUNTS: base 272 + own 8 = 280; run 280
# cancelled 0
# skipped 0
# todo 0
# duration_ms 494.07704
VERIFY EXIT: 0
```

Task 3 (`verify3.sh`, at 123cd63; the plan's command exactly, run from a script file):

```
COUNTS: base 272 + own 11 = 283; run 283
FIXTURES: ok
FIXTURE CHECK FAILS ON A PLANTED FIXTURE: ok
==> .../exec-08-14/srvmode.txt <==
SERVER MODE: PASS (parts run: 15)

==> .../exec-08-14/waysout.txt <==
WAYS OUT: PASS (parts run: 7)
VERIFY EXIT: 0
```

The whole suite at 123cd63: `# tests 283`, `# pass 283`, `# fail 0`. Changed files against the base: exactly the plan's five. The ten billing fixtures (seven from 08-04, three here) all pass the folder loop.

Load measurement (`SCRATCH/exec-08-14/stress.sh 24 3`: 24 processes at once, 3 rounds, on 4 cores):

```
before the fix: STRESS: 72 runs, 26 with a failure, 10 with a genuine delivery answered 401
after the fix:  STRESS: 72 runs, 0 with a failure, 0 with a genuine delivery answered 401
```

## RED runs and mutations

Task 1 (`SCRATCH/exec-08-14/red.txt`, before any code):

```
not ok 1 - tracer: a signed full-refund delivery is verified, the charge is read back, and the refund reaches the sponsor's charges
  expected: 200
  actual: 404
# tests 1
# fail 1
```

Task 2 (`red2.txt`, against Task 1's commit f133944): `# tests 8 / # pass 5 / # fail 3`. The three that failed:

```
not ok 6 - N6 full refund: ... (the credited package's credit line was missing)
not ok 7 - N6 partial refund: ... ('paid' !== 'refunded')
not ok 8 - N6 dispute: ... ('consumed' !== 'disputed')
```

Task 3 (`red3.txt`, against Task 2's commit afc5921): `# tests 11 / # pass 10 / # fail 1`. The one that failed: `not ok 9 - I2 hold: ...` with the error `b.hold is not a function`.

Mutation runs (`SCRATCH/exec-08-14/mutations.txt`). One rule was broken at a time in billing.mjs, and the file was restored after each. Each line below is the "not ok" line of the test named:

| Rule broken | Test that failed |
|---|---|
| the signature is not checked | N5 forged |
| no duplicate check | N5 replay |
| a delivery with no event id is not known by the hash of its bytes | N5 replay |
| seen recorded before the read-back | N5 read-back fails |
| the delivery's body is acted on instead of the read-back | N5 body not trusted |
| a refunded package's credit is kept | N6 full refund |
| an unmatched refund is recorded on every delivery | N6 partial refund |
| credit removed below 0 | N6 dispute |
| a disputed package can still be credited | N6 dispute |
| the read-back's error text is passed on in the 503 reply | W6 no vendor text |
| the rejected-delivery event carries the signature header | W6 no vendor text |
| release does not wait for the hold | I2 hold |
| a fixture marked confirmed (planted copy, `BILLING_FIXTURE_DIR`) | N8 fixtures |
| (after the header split) the signature is not checked | N5 forged |
| (after the header split) the signed time may be a day old | N5 forged |
| (after the header split) the signed time is not part of the signed message | **survived**: `connector.mjs verify` refuses a missing time itself, so billing.mjs's `!!ts` guard is a second copy of that check |

## What was built

- **`POST /billing/webhook`** runs in this order (N5). It answers 404 while `BILLING_WEBHOOK_SECRET` is unset. Then: the raw bytes (256 KB limit), the signature and a fresh signed time (300 s), parse, and the event id (1 to 120 letters, digits, `_` or `-`; otherwise the SHA-256 of the raw bytes). Then the duplicate check, a read of the seen list that records nothing. Then the charge read back with the secret key (label "Card payment"), the action inside the account's queue, flush, and only then `seen('billing:' + id)`. A bad or stale signature answers 401 `{ error: 'Bad signature' }` and writes exactly `{ type: 'webhook_rejected', provider: 'billing' }`. A read-back that fails or answers another charge gives 503 `{ error: 'The payment could not be checked. Try again later.' }` and records nothing. Other replies are 200 `{ received: true }` or `{ received: true, duplicate: true }`.
- **Refunds (N6).** A charge read back as wholly refunded (the refunded flag, or amount refunded at least the amount) makes every package on that `chargeRef` `refunded`, started ones included. Each package gets one line `{ type: 'refund', by: 'card', cents: its price, refundRef }`. A credited one also loses its credit, down to 0, with a line `{ type: 'refund', by: 'credit', cents: removed }`. A partial refund is matched by `metadata.entitlement` and records the refund's own amount. One nobody can match writes one line `{ type: 'refund', entitlement: null, cents, refundRef }` and the event `refund_unmatched { account }`, once per refund id. A package already refunded writes nothing.
- **Disputes (N6, R6).** A charge read back as disputed makes every package on it with no `startedAt` `disputed`: paid ones on no invitation, consumed ones and credited ones alike. Each gets one line `{ type: 'dispute', by: 'card', cents }`. A credited one also gives back its credit, down to 0, with a line `{ type: 'dispute', by: 'credit', cents: removed }`. The event is `payment_disputed { account, entitlements: count }`, written only when something changed. A disputed package cannot be released, swept or consumed. `consume` answers 409 `package_used` "This package can no longer be used." for refunded and disputed packages. The operator restores a package by hand if the dispute is won.
- **The hold (I2).** `hold(entitlementId)` returns `finish(ok)`. While any hold is open, `release` answers false and remembers that it was asked, and `sweep` skips the package. `finish(true)` records the start. When the last hold finishes with no start, a remembered release is done then, once. Each `finish` acts only once.

## Assumptions added for plan 08-12 (in `ASSUMED`, each unconfirmed)

1. Delivery signature: header `Stripe-Signature` with the value `t=<unix seconds>,v1=<hex HMAC-SHA256>` (several `v1` while a secret rotates), signed over `<t>.<exact bytes>` with the signing secret used as plain text. Tolerance 300 s.
2. Event names: `charge.refunded` (full and partial), `charge.dispute.created`, and for 08-16 `payment_intent.succeeded` and `payment_intent.payment_failed`.
3. An event keeps its id in `id` and its object in `data.object`. A refund event's object is the charge (`id`). A dispute's object names the charge in `charge`. A payment event's object is the payment (`id`).
4. Charge read-back: `GET /charges/:id?expand[]=refunds`. Fields `id`, `payment_intent` (= this server's `chargeRef`), `amount`, `amount_refunded`, `refunded`, `disputed`, and `refunds.data[]` with `id`, `amount`, `status`, `metadata.entitlement`. Refund statuses `failed` and `canceled` did not return the money.
5. For 08-16: payment read-back `GET /payment_intents/:id`, with fields `status`, `amount` and `metadata.payment`.
6. The provider sends deliveries without an Origin header and retries on any non-2xx answer (429 from the rate limit, 401, 503).

## Task commits

1. `f133944` feat(08-14): a signed refund delivery is checked against the provider's own record before it reaches the sponsor's charges (tracer)
2. `afc5921` feat(08-14): forged, repeated and unconfirmed deliveries change nothing; refunds and disputes make a package and its credit unusable
3. `123cd63` feat(08-14): the hold while a check is starting; no vendor text in any reply, event or log; every billing fixture unconfirmed

## Deviations from Plan

1. **[Rule 1 - Bug] The header is split in billing.mjs, not by the connector's matcher** (above). `verify(` from `connector.mjs` is still what checks every signature, so the key link holds. Commit 123cd63.
2. **[R4] Task 1's verify uses an exact count:** `test "$(grep -c '/billing/webhook' server/lib/billing.mjs)" -eq 1` instead of "not 0".
3. **[Rule 2] Refund status.** Refunds whose `status` is `failed` or `canceled` are ignored. Otherwise a failed refund would make a package unusable while Carrow & Vale still holds the money. `status` was added to the read-back fixture's description and to `ASSUMED`.
4. **[Rule 2] `consume`'s sentence** for a refunded or disputed package is "This package can no longer be used.". Before this, it said "This package was returned as credit.", which is false for those packages. Same code `package_used`, same status 409.
5. **[Rule 2] `sweep` skips a held package**, so the 24-hour return cannot credit a package while its start is in flight.
6. **[Interpretation] Dispute lines.** Every disputed package gets a card dispute line. A credited one also gets the credit line N6 names. The plan's test text mentions only the credit line for the credited one.
7. **[Interpretation] Unacted events** (another type, or no charge named) answer 200 and are not recorded as seen, so a later plan that acts on them can still act on a retry.
8. **[R6] The dispute test also covers a paid package on no invitation.** It becomes disputed and can be neither consumed nor credited. So the event count is 3, not the plan's 2.
9. **Test helpers duplicated:** `gateway`, `j`, `account`, `saveCard`, `buy` and `tools` are copied into the new test file. Importing `billing.test.mjs` would run its tests. `server/test/billing.test.mjs` is unchanged.
10. **Push** to `wip/08-14` only, as the orchestrator instructed. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Lines added to shared files

None. `server/index.mjs`, `server/lib/store.mjs`, `server/lib/invitations.mjs` and `server/README.md` are untouched, and the names list in Task 3's verify proves it. The delivery route is reached through 08-04's existing `/billing/` hook line, which applies `limited(req)` to POSTs and skips the Origin check for `/billing/`.

## For the next plans and the orchestrator

- **08-15:** call `billing.hold(rec.package.entitlement)` before the provider's start call, and `finish(true)` once the provider has a session (this sets `startedAt`; do not also call `started`). Call `finish(false)` on a failed start. Call `release` from `endPackage` as usual: during a hold it answers false and is done when the last hold finishes. The gate (N3) must accept only `consumed`. `refunded`, `disputed` and 08-16's `refunding` are all unusable here. `finish` returns the release's result (true when the package was credited then).
- **08-16:** the payment events and the payment read-back are already in `ASSUMED` (`events.paymentSucceeded`, `events.paymentFailed`, `paymentOf`, `paymentRead`). `delivery()` dispatches on `ASSUMED.chargeOf`'s keys. Add the payment kinds next to it. They read back the payment, not a charge. Unacted types are not recorded as seen, so retries of payment events that arrive before 08-16 ships are acted on. The admin refund must set `metadata[entitlement]`, so its delivery matches it (`refundOne` writes nothing for a package already `refunded`, which gives "one ledger line, not two"). A refund the provider confirms while the admin call is still `refunding` becomes `refunded` by the delivery. The admin repeat must then write nothing. A definite refusal must not put a status back over `disputed` or `refunded`. A dispute marks a `refunding` package `disputed`. When an unresolved payment is settled as succeeded, read the charge back for refunded or disputed before committing usable packages.
- **08-12:** the six assumptions above. The delivery secret is `BILLING_WEBHOOK_SECRET`, and the endpoint is `<PUBLIC_URL>/billing/webhook`.
- **Orchestrator:** the existing `POST /webhooks/:provider` route has the same load fault for connectors with `pattern` or `timestampPattern` (the 50 ms sandbox limit in `connector.mjs match`). A provider's retry recovers it, but under the parallel gate it can make `connectors.test.mjs` flaky. Not touched here.
- **Test count after merge:** 272 + 11 + whatever 08-05 adds.

## Known Stubs

None.

## Self-Check

PASSED. The five plan files and this summary exist. Commits f133944, afc5921 and 123cd63 are on HEAD, directly after the base 2163866. `git diff --name-only` against the base lists exactly the plan's five files. `server/node_modules` was linked for the runs only and never staged. Screenshots and check outputs were deleted after the verify. No existing test file was modified.
