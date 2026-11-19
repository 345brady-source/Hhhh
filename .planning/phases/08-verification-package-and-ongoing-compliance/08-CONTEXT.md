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
