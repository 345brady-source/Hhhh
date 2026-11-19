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
