# Phase 14: Portal messaging and the data room - Context

## Decisions (owner)
- D-01 (2026-11-15, 01.4-RESUME 5b): investor and sponsor messaging inside the portal: secure inbox, threads per investor and per offering, attachments, read status, sponsor broadcast, an email notice of each new message (never the message text in the email when it could hold private data), everything kept for the record.
- D-02 (2026-11-16, roadmap additions): with messaging, a data room for prospects: NDA-gated documents, view tracking, soft commitments.
- Carried: outside-API check first (CLAUDE.md: options with cost, accuracy, speed and trade-offs before building in-house; no budget for monthly fees, so a $0 path comes first); white label (no provider, vendor or model names on any screen); the preview runs with no server, so every screen works from the browser's own storage and says honestly what a server adds; never the word "basic"; lean screens; nothing called ready before the owner checks it.
- Owner (2026-11-26): build everything through step 11 that can be built without him; ask with a push notification and take the default after 15 minutes.

## Questions the research must answer
- What exists: notices (console Notices), documents (investor Documents), emails (phase 13 renderer and sent log), e-sign consent, investor records, the server's routes and storage. What a thread, message and attachment need on top.
- Record keeping: what a sponsor (often an exempt reporting adviser or none) must keep for investor communications; Rule 204-2 / 17a-4 relevance for this audience; what "kept for the record" must mean (no deletion, export).
- Data room: NDA click-through vs e-signed NDA (reuse the built-in e-signature), per-document view tracking, watermarking, download control, soft commitments (indication of interest, not a subscription), 506(b) general-solicitation limits (a data room for 506(b) must not be a public offer: prospects need a pre-existing relationship; 506(c) can be open with verification later).
- Outside services (secure messaging, virtual data rooms) with real prices vs in-house.

## Owner decision (2026-11-26)
- D-03 (C-01): build in-house at $0 (owner chose "Build in-house, $0" over outside chat and data room services). Prices shown to him were from search snippets (14-RESEARCH.md).

## Orchestrator choices (2026-11-26, research defaults adopted under the owner's work-around rule; he may override any)
- C-02..C-18 as recommended in 14-RESEARCH.md: personal links (90 days, revocable) until phase 15 sign-in; 506(b) rooms by personal link only with the relationship basis recorded first (server refuses a link without it; a basis dated on or after the room opened warns); click-through NDA by default, e-signed NDA per room; nothing deleted, records kept at least 7 years, room documents hidden never removed; one notice per new message, at most one per unread thread per hour, 60-second refresh; firm emailed on NDA agreement and indication of interest (no amount), views not emailed; legends drafted and marked "To be confirmed"; 506(b) sign-up link wording fixed (C-09); rooms for 506(b) and 506(c) only; tax/bank numbers in investor messages warn with "Send anyway", in sponsor messages refused; server collections inbox and rooms; 14-10 waits for the guide trim (cap not raised); self-serve edition only; broadcast on the Messages page; prospects kept on the room; attachment limits as C-17; room download off by default, watermarked download per room.
- Why: each is the research's recommended default with its reason in 14-RESEARCH.md; they keep cost at $0 and follow the law summaries, which stay "To be confirmed" on screen until counsel reads them.

## After planning (2026-11-26; 13 plans, 7 waves; ROADMAP 1f0d962)
- Planner's choice (owner may reverse): investors sign in through phase 15, so C-02's investor inbox link is dropped; only prospects keep personal room links (90 days, revocable).
- Orchestrator choice: Documents' "Remove" (console.js:2427) becomes hide-only in a later small fix so nothing is deleted anywhere in the portal (records rule, C-05); not part of phase 14's plans.
- Watermark time on a 25 MB file is measured in 14-02 and 14-05; over 30 seconds, the orchestrator lowers C-17's limit.
- Phase 15's planner was given the four facts 14-08 needs (section and route tables extendable by added lines; investor-session and room-token routes; prospects keep link tokens; access for investors added before phase 15).
