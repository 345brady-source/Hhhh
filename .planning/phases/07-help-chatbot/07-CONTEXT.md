# Phase 07: Help chatbot - Context

## Decisions (owner, 2026-11-15, from 01.4-RESUME "Portal help chatbot")
- D-01: a help chatbot inside the portal, through the server's own model connection (server/lib/model.mjs); pay for usage only, no per-conversation pricing.
- D-02: model claude-haiku-5-5 (a larger model only if measured answers miss).
- D-03: a help guide drafted from the portal's real screens, sent as cached context; the bot knows which page the person is on.
- D-04: portal questions only; no investment, legal or tax advice; never sees or reveals investor data; a support-email fallback when it cannot answer.
- D-05: white label: no vendor or model names anywhere a sponsor or investor can see.
- D-06: measured on real questions before launch (the orchestrator runs the paid measurement with a small spend cap; agents never get the key).
- Carried: D-30 nothing mandatory; lean screens; the owner's iPhone/sandboxed-frame conditions in .planning/AUTOPILOT.md (without a server the chat must fail soft: say help is unavailable and show the support email, never a raw error).
