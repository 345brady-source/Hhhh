# Phase 07: Help chatbot - Context

## Decisions (owner, 2026-11-15, from 01.4-RESUME "Portal help chatbot")
- D-01: a help chatbot inside the portal, through the server's own model connection (server/lib/model.mjs); pay for usage only, no per-conversation pricing.
- D-02: model claude-haiku-5-5 (a larger model only if measured answers miss).
- D-03: a help guide drafted from the portal's real screens, sent as cached context; the bot knows which page the person is on.
- D-04: portal questions only; no investment, legal or tax advice; never sees or reveals investor data; a support-email fallback when it cannot answer.
- D-05: white label: no vendor or model names anywhere a sponsor or investor can see.
- D-06: measured on real questions before launch (the orchestrator runs the paid measurement with a small spend cap; agents never get the key).
- Carried: D-30 nothing mandatory; lean screens; the owner's iPhone/sandboxed-frame conditions in .planning/AUTOPILOT.md (without a server the chat must fail soft: say help is unavailable and show the support email, never a raw error).

## Orchestrator choices (2026-11-19; the owner may override)
- C-01: the preview has no server, so the dialog fails soft with one sentence ("Help is available once the portal is connected.") and the support contact; no `sample` transport (D-36 precedent in phase 01.4: production and preview behave the same).
- C-02: the sponsor support address is a page setting (window.CVPortalConfig.supportEmail). Until the owner names one: an admin sees no contact line (he would be told to contact himself), a team member sees "Contact your administrator."
- C-03: research Open Questions are resolved by the plans (config address; measured transcript for the owner; privacy wording is a launch item; no starter questions). The separate validation file is waived as in phase 06: every task has an automated check that can fail.

## Plan-check additions (executors apply these with their plan; plan checker a7041a, 0 blockers)
- 07-01: the "white label and sizes" test also applies copies of VENDORS and VENDOR_RE from phase 6 checks/lib.js (lines ~548-549) to both guides and the rules.
- 07-02: (a) server/README.md documents CARROWVALE_HELP_MODEL as "leave unset; used only for measurement" with no model names, and Task 3's verify adds: ! grep -Eiq 'anthropic|claude|sonnet|haiku|opus|fable|mythos' server/README.md || exit 1; (b) a test that guard(line, audience) passes every non-empty line of GUIDE.sponsor and GUIDE.investor unchanged, and the example answers in the rules; (c) the invitation-token test also asserts the note says the person is an investor.
- 07-03: role admin with no valid supportEmail shows no contact line; "Contact your administrator." only for team; nosrv-desktop asserts the admin dialog is exactly the heading and the sentence; the support part gains a team-role assertion.
- 07-04: Task 3 (the paid run) waits until 07-02 and 07-03 are merged.
- 07-01 is estimated slightly over budget: if the executor runs short, stop cleanly after Task 2's commit and report.

## Paid measurement (owner approved by push reply "Yes", 2026-11-19 18:3x UTC; cap $1.00; model of the route as configured; key used inline only)
- Smoke: 4 calls, all 200, the cached prefix read on the second call of each audience. $0.0027.
- Development set (24 cases, twice), first run: bars FAIL, 23/24 each run. Both failures were the scorer's patterns, not the answers: a correct refusal ("no QuickBooks connection") tripped a forbidden pattern, and a correct answer ("choose Raise, then Investors") missed a too-narrow pattern. The two patterns were corrected (each still catches a wrong answer, shown) and the set rerun: bars PASS in both runs, 23/24 each (the remaining miss, ic-finish-later, is again a narrow pattern on a correct answer; left as is, tuning stopped). $0.0101 per run of the set.
- Held-out set (48 unseen cases, written by an agent who built nothing, frozen by SHA-256; run once, twice over): bars FAIL, 43/48 in each run. 100% in both runs on advice refused (5/5), injection refused (5/5), white label (52/52 answers), no personal data repeated (3/3), no cut-off answer; median 1.2 s, slowest 4.3 s. The orchestrator read the failures:
  - Real gaps in the guide (2): how to add a second holder or signer to an investor (the portal has co-investors; the answer sent the sponsor to invite her as a new investor); how a taxpayer number is typed (the answer said it did not know).
  - Right content, wrong kind label (3): it said a zip download and another not-covered feature do not exist but labelled the reply an answer; it labelled one "is that the final signed copy" reply cannot while explaining countersigning.
  - Right answer, narrow pattern (1): bank account typed twice, the pattern wanted the label "Confirm account number".
- Total spent: $0.0439 of the $3.72 credit.
- Next: add the two missing guide entries (co-investor / second holder; taxpayer number format). The held-out set has now been read by the orchestrator, so it no longer measures unseen questions; a fresh unseen set is written before launch to re-measure.

## Owner decision, 2026-11-27
- Paid unseen-question run (fresh set of 48, cap $1.00): owner answered "Not now". HELP-06 stays open; the fresh set is being written and frozen (outside the repo) so it is ready when the owner says yes. No paid call is made until then.
- Fresh unseen set ready (written by an agent that never read the guide; kept outside the repository; LINT: PASS, 48 cases: sponsor 27, investor 21; 16 sponsor-covered, 12 investor-covered, 8 not-covered, 5 advice, 3 injection, 2 personal data, 1 two-turn conversation, 1 unrelated). Frozen SHA-256 dd00390965e3fcb2ebaf836bcf2850f279d22ee125d95e6ed3af8495b415dc6f; verify the hash before the run. Its patterns were tried only on made-up answers. It lives in the session scratchpad, so a reboot could lose it; it would then be rewritten the same way.
