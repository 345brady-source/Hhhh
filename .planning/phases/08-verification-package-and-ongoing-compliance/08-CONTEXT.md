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
