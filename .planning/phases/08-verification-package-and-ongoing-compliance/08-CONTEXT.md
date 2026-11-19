# Phase 08: Verification package and ongoing compliance - Context

## Decisions (owner, 2026-11-15/16, from 01.4-RESUME)
- D-01: a KYC + AML + accreditation package, completely optional (sponsors may run their own checks); the sponsor adds it per investor when sending the invite; the sponsor's card on file is charged then; Carrow & Vale receives the funds and pays the providers (prepaid credits or a card the provider charges when the investor completes the checks inside the automated onboarding). The investor never pays.
- D-02: Didit for KYC and AML. Accreditation provider and the payments provider are still to choose: research real prices and approval steps, present options, $0-monthly options first.
- D-03: the portal already has provider-neutral connectors (server/providers, server/plugins, assets/js/integrations.js): reuse them.
- D-04: ongoing compliance in the same step: repeat sanctions screening of existing investors, 506(c) accreditation re-checks (about every 90 days while an offering is open), a record of the AML program.
- Open for the owner: the package price; refund or credit when an invited investor never completes the check.
- Carried: white label; D-30; lean screens; .planning/AUTOPILOT.md conditions.

## Orchestrator choices (2026-11-19; asked by push, no answer within 15 minutes; the owner may override any of them)
- C-01: the ID and AML provider's free plan, with its own page and name visible for that one step. Why: full white label costs $299 a month and the owner has no budget for monthly fees. Recorded as the one white-label exception; everything else stays neutral.
- C-02: VerifyInvestor for accreditation ($69 list, no monthly minimum, price read through search results, unconfirmed). Why: the only option found with a published price and no minimum. One email to North Capital about its possible $30 price is left for the owner.
- C-03: Stripe for charging the sponsor's card (2.9% + 30 cents, no monthly fee), embedded card field. Approval for this business is unknown until the owner applies.
- C-04: prices $99 full package, $19 identity + screening only, set in server config. Why: about $26 and $17.55 margin per investor at list costs; the owner may change the figures at any time without code changes.
- C-05: full platform credit when an invitation ends with no check started; none once a check started; card refund on request.
- C-06: 506(c) accreditation checked at each new subscription with a 90-day validity (already how the portal works); no calendar re-checks. Investors outside the package are re-screened free against the official Treasury list.
- C-07 (orchestrator, 2026-11-19): plan 08-10 (the two free accreditation methods, built switched off until counsel confirms) is deferred, not built now. Why: it is speculative work nobody can use until a lawyer signs off, and the owner wants nothing built that is not needed. It can be added later without changing the other plans.

## Plan-check additions, wave 1 (executors apply these with their plan; checked 2026-11-19, 1 blocker fixed here, 8 warnings)

### 08-01 (accounts and sponsor tokens)
- A1: the admin routes sit after the invite-token refusal in `server/index.mjs` (after the `investorPath` refusal, before the sponsor gate), with their own `limited(req)`. Test: a valid `ADMIN_TOKEN` bearer plus an `X-Invite-Token` answers 401 and the accounts table is unchanged.
- A2: the foreign-record behaviour also covers `DELETE /v1/invitations/:id/submission`: with another account's token it answers 404, and `hasSubmission` and the blobs are unchanged.
- A3: server test count is exact against the base. Step 0 writes the number after `# tests ` to `$O/base-count.txt`; Task 2's verify requires base + the number of top-level `test(` calls in the plan's own test file. If the base is not 197, the summary says which phase 07 plans were in the base.
- A4 (merge note): if phase 07's `POST /v1/help` is in the base, it goes through the sponsor gate and its session owner is the account id, not the constant `'sponsor'`. If it is not in the base, say so in the summary so the orchestrator handles it at merge.

### 08-02 (ID-check plug-in)
- B1 (blocker): a screening hit never rejects an investor automatically. In `fetchResult`, when the session is `Declined` or `In Review`, the non-screening parts (`id_verifications`, `liveness_checks`, `face_matches`) are not declined, and an `aml_screenings` entry is `Declined` or `In Review`, return `{ status: 'review', screening: { status: 'potential_match', hits } }`. Return `failed` only when a non-screening part is declined. The per-part status field name goes in `ASSUMED` for 08-12. New fixture `server/test/fixtures/idcheck/decision-declined-screening.json`. New behaviour "declined by screening only": a previously passed check, after a signed `status.updated`, reads `review` with screening `potential_match`, never `failed`.
- B2: exact server test count as A3.
- B3: Task 2's verify also runs, through `heavy.sh` with `P6_OUT`/`P6_SHOTS` under `exec-08-02`, `server-mode.js` ending `SERVER MODE: PASS (parts run: 15)` and `ways-out.js` ending `WAYS OUT: PASS (parts run: 7)` (the plug-in loads into every server's default registry).
- B4: no provider text reaches a caller or an event. The mocked 403 and 402 bodies contain the vendor's name and domain in `detail`; the plug-in catches the request error and rethrows `Identity check answered <status>` with status 502 and no provider text; the test asserts that and that the `refresh_failed` event holds no vendor word.
- B5: the verify loops over every `server/test/fixtures/idcheck/*.json` and requires `_source` to start with `https://` and `_status` to start with `unconfirmed`. The 60-second limit test spies on `globalThis.setTimeout` (three timers of 60000, none of 15000); it never sleeps.
- B6: an alert with no `event_id` uses the SHA-256 of the raw body as its id, so a repeat is still dropped.
- For 08-05 or 08-13 (not this plan): every server-connected sponsor will see an "Identity check · not set up" row on Integrations and in "Add a connection" that they cannot use. One of those plans hides it.

### 08-06 (package choice on the invite)
- C1: `gate.sh` reads `P8_SERVER_TESTS`; when set, `# tests` must equal it, otherwise at least 197; the count is always printed in the `COUNTS` line. The plan's own run passes the base count.
- C2: the managed part first asserts the managed form's email field is visible, then no `[name=package]` and no `#iv-package`.
- C3: `gate.sh` sets `P6_OUT=$P8_OUT/checks-out` exactly (the owner's folder step writes beside it).
- C4: no existing text on the invite form is reworded (phase 07's guide check quotes it); nothing under `server/help/` is touched.
- C5: if the plan runs short of room, `gate.sh` is the piece to hand to a follow-up; say so in the summary.

## Plan-check additions, wave 2 (executors apply these with their plan; checked 2026-11-19 against 1a4ebf5; 4 blockers fixed here, 10 warnings)

### 08-04 (charging the sponsor's card)
- M1 (blocker): a payment attempt is recorded before the provider is called.
  - New store table `payments` (with the other three): id `pay_…`, account, items [{ key, tier, cents }], cardCents, method, attempt, idempotencyKey, status `pending` | `succeeded` | `failed` | `unresolved`, chargeRef, at.
  - entitle writes the pending record and calls `store.flush()` before the charge call, and flushes again after the commit.
  - The idempotency key is the SHA-256 of the account id, the sorted card-paid keys, the payment method id and the attempt number. The attempt number is the count of failed payments for that key set.
  - A definite refusal (declined, authentication required) marks the payment failed, so the next try uses a new key. An unknown outcome (timeout, network error, provider 5xx) leaves it pending and answers 409 billing_unavailable.
  - Before working out any new payment, entitle settles the account's pending payment: younger than 23 hours (injected `now`), it repeats that exact call with the stored key and form and commits its entitlements if it succeeded; older, it marks it `unresolved`, writes the store event `payment_unresolved` (account and payment id only) and never repeats it.
  - A key whose newest entitlement is `credited` or `refunded` is a new purchase: credit first, new entitlement, `find` returns the newest.
  - The provider's page on idempotent requests could not be read from here: the key lifetime and the replay-of-errors rule go in `ASSUMED` for 08-12.
  - Tests: (a) timeout then the same list: two provider calls with one key, one set of entitlements; (b) timeout then a longer list: the stored call is repeated first, then one charge for the added keys only; (c) declined, card replaced, retry: a different key and the charge is recorded; (d) k1 released then entitled again: paid from the credit, no provider call, credit back to 0; (e) the pending record is in the store before the mock provider is called.
- M2 (blocker; carried into 08-05): entitle for a key that already has a paid or consumed entitlement of a different tier answers 409 `{ code: "tier_mismatch", error: "This invitation's package was paid at another level. Nothing was charged." }` and makes no provider call. Test in `billing.test.mjs`. For 08-05: `rec.package.tier` is the entitlement's tier, and create refuses when it differs from the tier the server worked out.
- M3 (blocker, with P1): a paid entitlement not consumed within 24 hours of `paidAt` is released to credit by billing itself, once, when entitle or view next runs for that account (injected `now`; no timer). Test: paid, 25 hours later `GET /v1/billing` shows the credit and one credit ledger line; a second read adds nothing; consumed within the 24 hours is untouched.
- M4: exact server count. Step 0 writes the base's `# tests` number to `$O/base-count.txt`; Task 2's verify requires base + the number of top-level `test(` calls in `server/test/billing.test.mjs` and prints `COUNTS: base N + own M = T; run T`.
- M5: Task 2's verify loops over `server/test/fixtures/billing/*.json` and requires `_source` to start with `https://` and `_status` to be non-empty; where the page was not read in this run, `_status` starts with `unconfirmed`. The summary lists which pages were read.
- M6: read `server/index.mjs` by name, not by the plan's line numbers (createServer and `sponsorAuth`, `route` and `ownPage`, the invite-token refusal, the admin line, the `auth` line, the rate limit). `send`, `readRaw` and `parseJson` come from `server/lib/http.mjs`; `billing.mjs` writes its own `parseObject`. The `/billing/` hook line applies `limited(req)` to POSTs before calling `billing.handle`. The `/v1/billing` hook goes below the `auth` line and its handler takes the account only from `auth.account`.
- M7: `POST /v1/billing/card/setup` stores the request's Origin in the session (it has already passed `cors`); the card page's `frame-ancestors` and its postMessage target are that origin. Test with two origins configured.
- M8: the authentication-required sentence is "The card's bank asks for confirmation. Replace the card on the Integrations page, then try again."
- M9: `view()` takes each charge's `invitationId` from its entitlement. Test: entitle, consume, then `GET /v1/billing` shows the id.
- M10: a price that is not a whole number of cents of at least 50 makes `ready()` false and the POST routes answer 409 billing_unavailable. Test.
- M11: if the plan runs short of room, `DELETE /v1/billing/card` and the reverify price are what is handed to a follow-up, never a money rule; say so first in the summary.
- M12: "no reply contains the vendor's domain" is scoped to JSON replies, events and the card page's visible text (the page's own script tag must name it). A card-only field with no wallet or one-click button. Replacing a card detaches the old one at the provider.
- Shared lines: `store.mjs` tables are added on their own new line after the defaults, leaving the defaults line untouched (09-05 does the same); in `index.mjs`, one line per hook, nothing else moved.

### 08-11 (the AML program record)
- R1 (blocker): files also include `server/help/guide.md` and `server/lib/help-guide.mjs`. Task 1 step 3 adds a section `## console-aml` (audience sponsor, kind console, title `AML program`, menu `Report, then AML program`, at least one `anchor:` that is text `assets/js/amlprogram.js` holds verbatim, 40 or more characters, every quoted name exactly as on the screen), adds "AML program" to the Report list in the `## console` section, then runs `node server/help/build.mjs`. No existing on-screen text is reworded. Task 1's verify also runs `(cd server && node --test test/help-guide.test.mjs)` and requires `# fail 0`.
- R2: step 0 measures the base's `# tests` into `$O/base-count.txt`; the gate is run as `P8_SERVER_TESTS=$(cat $O/base-count.txt) P8_OUT=$O bash …/gate.sh` (the plan adds no server test); the summary quotes the COUNTS line.
- R3: the NAV entry goes on its own line after `console-kyc`; phase 09 adds Filings after it (order: AML/KYC, AML program, Filings). The script tag goes on its own line. The generated guide module is never hand-merged.

### 08-13 (the package panel and the list payment)
- P1 (blocker): the rows in the list payment are exactly the rows whose invitation will carry the package: one function (08-06's `packageBox`, enabled) decides the payment's items, the label's total and `package: true` in create. Check part `list` includes one investor on file and asserts their key is not in the entitlements body and not in the total.
- P2: as R2.
- P3: closing the card dialog by any route reads `GET /v1/billing` again.
- P4: the plan may change the one line of `create` in `assets/js/invitations.js` to `const id = o.id || uid('invt');` and nothing else in create; the list action makes each id with `uid('invt')` before paying.
- P5: with more than 200 package rows the list is paid in groups of 200 in order; each group's invitations are sent before the next group is paid; a refused group stops the list there with the server's sentence. A check part asserts the 200 boundary with stubbed replies.
- P6: if the plan runs short of room, Task 3 (the list form) is the piece to hand over.
- P7: one sentence about the package panel in the guide's `console-integrations` entry, then `node server/help/build.mjs`.

## After 08-04 (merged 2026-11-19; server tests 252 on the merged tree)
- Built and tested against a stand-in only. No page of the payments provider could be read from here (all 14 refused by the network rules); all 7 fixtures are marked unconfirmed and every assumption is in `ASSUMED` in `server/lib/billing.mjs` for 08-12. No card can be charged until the owner has an account and 08-12 runs against the provider's test mode.
- For 08-14 (carried as an addition): a payment whose outcome stays unknown for 23 hours is marked `unresolved` and never sent again; the money may have been taken with no package recorded. 08-14 settles these from the provider's delivery of the charge's result (or by reading the charge back), records the package or the refund, and the sponsor's billing view shows an unresolved payment in one line until it is settled. A test proves an unresolved payment that the provider reports as succeeded ends as a recorded package and one that it reports as failed ends closed with nothing owed.
- For 08-14: when a pending payment is confirmed by the repeat and the same call asks for that key at another level, the reply must not say "Nothing was charged."; README gains the billing settings.
- For 08-05: `billing` is passed to the invitation code (it is not on the server object); a package paid more than 24 hours before it is used has gone back to credit, `consume` answers 409 and a new `entitle` pays from that credit.
- For 08-13: with the shared token every `/v1/billing` route answers 403 `account_required`; the panel says so in one line.
- Limits: card sessions and the per-account queue are in memory (one server process).
