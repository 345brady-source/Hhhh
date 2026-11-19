---
phase: 08-verification-package-and-ongoing-compliance
plan: 04
subsystem: payments
tags: [integration-server, card-on-file, billing, idempotency, credit, node-test]

requires:
  - phase: 08-verification-package-and-ongoing-compliance
    provides: "plan 08-01: sponsor accounts; sponsorAuth(req) and auth.account in server/index.mjs"
provides:
  - "server/lib/billing.mjs: createBilling({ env, store, fetch, now, providers, publicUrl, origins }) -> { ready, prices, available, view, entitle, find, consume, started, release, handle }; export ASSUMED"
  - "store tables billing, entitlements, ledger, payments"
  - "routes GET /v1/billing, POST /v1/billing/card/setup, DELETE /v1/billing/card, POST /v1/billing/entitlements, GET /billing/card/:session, POST /billing/card/:session/done"
  - "env BILLING_SECRET_KEY, BILLING_PUBLISHABLE_KEY, PACKAGE_PRICE_FULL_CENTS, PACKAGE_PRICE_IDENTITY_CENTS, PACKAGE_PRICE_REVERIFY_CENTS, PACKAGE_IDENTITY_PROVIDER, PACKAGE_ACCREDITATION_PROVIDER"
  - "message type cv-card-saved (posted by the card page to the portal origin that asked for it)"
affects: [08-05, 08-06, 08-12, 08-13, 08-14]

actuals:
  tokens: 24575
  tasks: 2
  commits: 3
plan_head_before: 036773c309ada6b39b95bb8b4ce37847ce0408d4
plan_head_after: 64d53811f56f2d73574c8c9a4f065a20c9d9e327

tech-stack:
  added: []
  patterns:
    - "A payment is written to the store file, pending, before the provider is called; its outcome is written right after"
    - "Only a definite answer from the provider changes a payment: paid, refused, or not known (left pending and repeated with the same key)"
    - "Every header, path, field and value taken on trust from the provider sits in one exported block, ASSUMED"
    - "Every sentence a caller reads is this module's own; the provider's text never leaves billing.mjs"

key-files:
  created:
    - server/lib/billing.mjs
    - server/test/billing.test.mjs
    - server/test/fixtures/billing/customer-created.json
    - server/test/fixtures/billing/setup-created.json
    - server/test/fixtures/billing/setup-succeeded.json
    - server/test/fixtures/billing/payment-method.json
    - server/test/fixtures/billing/charge-succeeded.json
    - server/test/fixtures/billing/error-card-declined.json
    - server/test/fixtures/billing/error-authentication-required.json
  modified:
    - server/index.mjs
    - server/lib/store.mjs

key-decisions:
  - "A charge whose outcome is not known answers 409 billing_unavailable with its own sentence, which does not say that nothing was charged"
  - "The attempt number in the idempotency key counts every closed payment for the key set (failed, unresolved, succeeded), not only the failed ones"
  - "A refused payment found when a pending one is repeated is closed, and the call goes on to work out a new payment"
  - "chargedCents includes what the call confirmed by repeating an earlier pending payment"

requirements-completed: []  # none claimed: VPK-02 and VPK-05 are worked on here; nothing was run against the payment provider
requirements-addressed: [VPK-02, VPK-05]

duration: 34min
completed: 2026-11-19
status: complete
---

# Phase 08 Plan 04: Charging the sponsor's card Summary

**A sponsor account keeps one card on file and pays for verification packages at the server's own price, credit first, with a record on disk before every charge; built and tested only against recorded replies, with nothing confirmed against the payment provider.**

Nothing here has been checked by the owner, no call was made to the payment provider, no key was used, and the card page was never opened in a browser (the provider's script cannot be loaded from here). The proof so far is the server's own tests with a stand-in for the provider. Whether a real card is charged correctly is not known until plan 08-12 runs this against the provider's test mode.

## Failures and limits first

- **No page of the provider's reference could be read.** Fourteen pages were tried once each; every connection was refused by this environment's network rules (the proxy answered 403). So all seven fixtures start `unconfirmed`, and every header, path, field and value the code depends on was written from the research's quotes and general knowledge of the interface, not from a page. They are in one block, `ASSUMED`, at the top of `server/lib/billing.mjs` (list below).
- **A charge that stays unknown for 23 hours may have been taken with no package recorded.** The code then marks the payment `unresolved`, writes the event `payment_unresolved` (account and payment id) and never sends it again. Nobody is told on any screen, and nothing reads the charge back from the provider. A person, or plan 08-14's payment webhook, has to settle those. This is the one place where a sponsor could pay and get nothing until someone acts.
- **Four of the 25 tests were already green in the RED run of Task 2** (tracer, list, who, errors), because the tracer's code already behaved that way. Their proof is a mutation run each (below), not a RED run. One block of assertions (refused when repeated, in "M1 c") was written after the code; it too is proven by a mutation run.
- **The contract's sentence for an unknown outcome was not used** (deviation 1): "Nothing was charged" is not known to be true after a timeout.
- **One edge keeps an inexact sentence:** if a pending payment for a key is confirmed by the repeat and the same call asks for that key at another level, the reply is `tier_mismatch` with "Nothing was charged", although that call did confirm the earlier charge. `GET /v1/billing` shows the charge.
- **Not documented yet:** `server/README.md` and the route list at the top of `server/index.mjs` say nothing about billing or its settings. The plan gives README to plans 08-05 and 08-14.
- **One process only:** card sessions and the one-at-a-time queue per account live in memory. A restart only means asking for the card page again; two server processes on one store would not queue each other (the JSON store is single-process already).
- **Committed before the browser check came back:** Task 2 was committed and pushed while the server-mode check waited about 12 minutes in the shared browser queue, so the work was safe on `wip/08-04`. The check then passed on that commit, and again on the final one.
- Nothing was handed to a follow-up under M11: `DELETE /v1/billing/card` and the reverify price are both built and tested.

## Measured

- Duration: 34 minutes from the first command to the last code commit (start 2026-11-19T16:37:17Z, last commit 17:11:41Z), about 12 of them waiting for the shared browser queue.
- Server tests: base 227 (run at 036773c before any edit), 25 top-level tests in `server/test/billing.test.mjs`, 252 run, 252 pass, 0 fail.
- Server-mode browser check: `SERVER MODE: PASS (parts run: 15)`.
- Realized diff: 98,301 characters (24,575 tokens at chars/4) against an estimate of 110,000 tokens.

## RED runs

Task 1 (`SCRATCH/exec-08-04/red.txt`, before any code):

```
not ok 1 - tracer: a sponsor saves a card through the hosted card page and pays for one package; GET /v1/billing shows the card and the charge
  expected: 200
  actual: 404
# tests 1
# pass 0
# fail 1
```

Task 2 (`SCRATCH/exec-08-04/red2.txt`, against Task 1's commit 847fafb): 21 of 25 failed, every money rule among them (server price, credit first, idempotent, declined, unavailable, prices, M1 a to e, the 23-hour rule, the new-key rule, M2, M3, release, consume, available, card page, remove and replace, older stores).

```
# tests 25
# pass 4
# fail 21
```

Mutation runs (`SCRATCH/exec-08-04/mutations.txt`; one rule broken at a time in `billing.mjs`, the file restored after each):

| Rule broken | Tests that then fail |
|---|---|
| a call without an account is served | who |
| the provider's text is passed on in a reply | unavailable, remove and replace, errors |
| only the first package of a list is charged | server price, list, M1 a, M1 b, M1 e |
| no write to the file before the provider is called | M1 e |
| a closed payment keeps its key | M1 c, the 23-hour rule, the new-key rule |
| unused packages are never returned | M3 |
| the tier is not compared | M2 |
| credit is spent before the charge is known | credit first, declined, M1 d, M2, M3 |
| a refusal on the repeat is left pending | M1 c |

## Verify commands, last lines

Task 1:

```
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 213.894378
VERIFY EXIT: 0
```

Task 2 (the plan's command plus M4's exact count and M5's fixture loop, `SCRATCH/exec-08-04/verify2.sh`). Run twice: at 7ec68d8, and again at the final commit 64d5381. Both ended the same apart from the duration line; the second run:

```
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11184.55443
PASS include-tax include-tax: white label: the emails, the done screen and the console row pass the leak check
SERVER MODE: PASS (parts run: 15)
COUNTS: base 227 + own 25 = 252; run 252
# tests 252
# pass 252
# fail 0
# cancelled 0
# skipped 0
# todo 0
FIXTURES: 7 files, every _source https, every _status starts unconfirmed (no page was read): ok
VERIFY EXIT: 0
```

## What was built

- **Card on file.** `POST /v1/billing/card/setup` makes the provider's customer for the account when it has none, makes a card setup for later charges, and answers the address of a card page on this server for one session of 15 minutes. The page shows "Card", the provider's card-only field (no wallet or one-click button), the button "Save card" and one line for an error in this server's own words. It may be framed only by the portal origin that asked for it and tells only that origin `cv-card-saved` (M7). `POST …/done` believes nothing the page says: it reads the setup back from the provider with the secret key and requires it finished and for this account's customer, then keeps the brand, the last four digits, the expiry and the provider's ids. A used or expired session answers 404. Replacing a card detaches the old one at the provider (M12); `DELETE /v1/billing/card` detaches and clears it.
- **Paying.** `POST /v1/billing/entitlements { items: [{ key, tier }] }`: the price is the server's setting for the tier, whatever else the request holds. Credit pays whole packages first, in list order; the card is charged once for the rest; each package gets one entitlement and one ledger line. A key that is already paid charges nothing. At most 200 packages a call.
- **A record before the charge (M1).** The payment (items, amount, card, attempt number, key, the exact form) goes to the store file as `pending` before the provider is called, and its outcome right after. A refusal closes it (`failed`) and records no package and no credit change; the next try is a new payment with a new key. An outcome that is not known (no answer, 409, 429, 5xx) leaves it pending and answers 409; the next call for that account repeats exactly that call with the stored key and form before working out anything new. After 23 hours it is marked `unresolved` and never repeated.
- **One level per key (M2).** A key that holds a paid or used package of another tier answers 409 `tier_mismatch` with no provider call; one such key refuses the whole list.
- **Unused packages come back (M3).** A paid package not put on an invitation within 24 hours of `paidAt` is returned as credit, once, when the account next pays or reads. `release` does the same on request; a package whose check has started is never credited. `consume` ties a package to one invitation and refuses a second with 409. `GET /v1/billing` shows each charge's invitation from its entitlement (M9).
- **Switched off safely.** Without both keys, or with any price that is not a whole number of cents of at least 50 (M10), `ready` is false and the POST routes answer 409.
- **Who.** Only a sponsor's own account token reaches `/v1/billing`; the shared token answers 403 `account_required` on every route there, an invitation token 401. The account is taken from `auth.account` only. Calls for one account run one after another.
- **What a caller can read.** Every refusal is one of this module's own sentences. A test sends replies holding the vendor's name, its domain and the secret key through every route and asserts none of them is in any reply, event or log line.

Codes and sentences: `account_required` 403; `billing_unavailable` 409 (two sentences, see deviation 1); `no_card` 402; `card_declined` 402; `authentication_required` 402 (M8's sentence); `tier_mismatch` 409; `card_not_saved` 409 "The card was not saved." (on `/done`).

## Assumptions waiting for plan 08-12 (the `ASSUMED` block)

None of these was read from the provider's reference in this run.

1. The secret key is sent as `Authorization: Bearer …`.
2. The header `Idempotency-Key`; the provider remembers a key for 24 hours; a repeat with the same key and form answers with the first call's saved result (a refusal included) and charges nothing more; a repeat with another form is an error; a call that never arrived runs as new.
3. Paths: `/customers`, `/setup_intents` (and `/setup_intents/:id`), `/payment_methods/:id`, `/payment_methods/:id/detach`, `/payment_intents`; bodies form-encoded.
4. Customer form `metadata[account]`; reply field `id`.
5. Setup form `customer`, `usage=off_session`, `payment_method_types[]=card`; reply fields `id`, `client_secret`; when read back: `status`, `customer`, `payment_method` (an id, not an object).
6. Card fields: `card.brand`, `card.last4`, `card.exp_month`, `card.exp_year`.
7. Charge form `amount`, `currency`, `customer`, `payment_method`, `off_session=true`, `confirm=true`, `payment_method_types[]=card`, `metadata[payment]`; reply fields `id`, `status`.
8. The status `succeeded` for a finished setup and a finished charge; a card charge made this way answers at once (never left "processing").
9. A 2xx charge reply with `requires_payment_method`, `requires_action`, `requires_confirmation` or `canceled` was not charged.
10. HTTP 400, 401, 402, 403 and 404 mean nothing was charged; 402 is the card's refusal, with `error.code`, and the code `authentication_required` means the bank wants the cardholder. Everything else is treated as not known.
11. The card page's browser calls: the script address, the global function with the publishable key, `elements()`, `create('card', { disableLink: true })`, `mount`, `confirmCardSetup(clientSecret, { payment_method: { card } })` answering `{ error }` or `{ setupIntent }`; and that this field shows no wallet or one-click button and no vendor branding (research A6).
12. The provider's script runs inside a page framed by the portal with only `frame-ancestors` set.

## Provider pages

Read: none.

Not read (tried once each, connection refused): the pages for saving and reusing a card; the setup object and its creation; customer creation; the payment method object and detaching one; creating a payment and the payment object; errors; idempotent requests; authentication; confirming a card setup in the browser; the card field; error codes.

## Task commits

1. **Task 1 (tracer)**: `847fafb` feat(08-04): a sponsor saves a card on the hosted card page and pays for one package (tracer)
2. **Task 2**: `7ec68d8` feat(08-04): the money rules for charging a sponsor's card
3. **Test addition**: `64d5381` test(08-04): a payment refused when it is repeated is closed and the next one carries a new key

## Deviations from Plan

1. **[Rule 1] An unknown outcome has its own sentence.** The contract's sentence for `billing_unavailable` ends "Nothing was charged." After a timeout or an outage that is not known. The code and the status are unchanged (409 `billing_unavailable`, which is what plans 08-05, 08-06 and 08-13 read); the sentence in that one case is "The payment could not be confirmed. Try again in a few minutes." Where nothing can have been charged (payments switched off, the provider refusing the request itself, a failed card setup) the contract's sentence is used.
2. **[Rule 1] The attempt number counts every closed payment for the key set**, not only the failed ones as M1 words it. With failed ones only, a key paid by card, released, its credit spent elsewhere and then paid by card again would carry the first payment's key; inside the provider's 24 hours that is answered with the first result and no new charge, so the package would be given away. Counting unresolved ones is what makes "never repeats it" true. Tested ("a key paid by card, released and paid by card again").
3. **[M1 over the plan text] A refused charge leaves a record in `payments`** (status `failed`). The plan's "records nothing" holds for packages, the ledger and the credit, which the declined test asserts.
4. **[Rule 2] Answers the plan does not name.** HTTP 400, 401, 403 and 404 from the provider close the payment as refused (nothing was charged), write the event `payment_refused` with the status number, and answer `billing_unavailable`. A 2xx reply that is not `succeeded` is refused when its status means the bank wants the cardholder, otherwise not known.
5. **[Rule 2] A refusal met while repeating a pending payment closes it and the call goes on** to work out the new payment, so one old refused attempt never blocks a sponsor.
6. **[Rule 2] `chargedCents` includes what the call confirmed by repeating an earlier pending payment**, so the figure is what the card was charged that the sponsor had not been told about.
7. **[Rule 2] Two codes outside the contract's list:** `card_not_saved` (409) when `/done` finds the setup unfinished or for another customer, and `package_used` (409) from `consume`. `consume` answers 404 for an unknown id and 400 for an empty invitation id.
8. **[Rule 2] `/done` and `DELETE /v1/billing/card` go through the account's queue**, so a card never changes in the middle of a payment. If the provider cannot detach on DELETE the card stays on file and the answer is 409; if it cannot detach the old card after a replacement, the new card is kept and the event `card_detach_failed` is written.
9. **[Rule 2] Events added** for the operator, each without any provider text: `billing_error` (status number), `payment_refused`, `payment_unresolved`, `card_detach_failed`.
10. **A list with one key twice** at the same tier is one package; at two tiers it answers 400.
11. **`server/index.mjs`**: four added lines (import, createBilling, two hooks) and one changed word in the `ownPage` line (`billing` added to the pattern); that line could not be extended by adding a line.
12. **Task 1's stored-digits assertion** was loosened in Task 2 from five digits to eight, because a stored payment holds its amount in cents (seven digits for 200 full packages).
13. **The fixture rule (M5) is also a test**, besides the loop in the verify command.
14. **Push**: the plan says no push; the orchestrator's instruction (push to `wip/08-04` only) was followed. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## For the merge and the next plans (orchestrator)

- **`server/index.mjs`**: the import after `createAccounts`'s; `const billing = …` after `const accounts = …`; the `/billing/` hook right after the sandbox block; the `/v1/billing` hook right after the rate-limit line that follows the `auth` line. `billing` is not attached to the server object: plan 08-05 passes it to the invitation code.
- **`server/lib/store.mjs`**: one new line after the defaults line, adding four tables (the three in the plan and `payments`).
- **08-05**: `find(account, key)` returns a copy of the newest entitlement or null; `consume` throws an Error with `.status`; `entitle` throws an Error with `.status`, `.code` and the sentence as `.message`. A package paid more than 24 hours before it is consumed has gone back to credit: `consume` then answers 409 and a new `entitle` pays it from that credit.
- **08-13**: with the shared token every `/v1/billing` route answers 403 `account_required`. The card page posts `{ type: "cv-card-saved" }` to the origin that called `card/setup`.
- **08-14**: unresolved payments (above) need the webhook or a person; `metadata[payment]` on each charge carries this server's payment id, and `chargeRef` on the entitlement, the ledger line and the payment is the provider's id for the charge. README is still to write.
- **Test count after the merge**: 227 + 25 + whatever the other plans add.

## Known Stubs

None.

## Self-Check

PASSED. The eleven server files and this summary exist; commits 847fafb, 7ec68d8 and 64d5381 are ancestors of HEAD; `git diff --name-only` against the base lists only this plan's files (`server/index.mjs`: four lines added, one changed; `server/lib/store.mjs`: one line added); `billing.handle` is called twice in `server/index.mjs`; `server/node_modules` was linked for the runs only and never staged. No existing test file was modified.
