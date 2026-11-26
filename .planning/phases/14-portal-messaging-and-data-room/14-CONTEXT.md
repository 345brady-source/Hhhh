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

## Plan-check additions, wave 1 (14-01, 14-02, 14-03, 14-13; checked 2026-11-26 against 1ea96e3; 1 blockers fixed here, 6 warnings). Executors apply these with their plan. Findings: scratchpad checks-14-wave1.md.
- B1 (14-02): stamp() loads with { updateMetadata: false } and sets Producer and Creator to the folded firm name (as record.js does); case every-page asserts the stamped bytes hold neither 'pdf-lib' nor 'Hopding'.
- W1 (14-01): gate14.sh sets GATE_FRESH=1 with a note when GATE_OUT/gate/base-commit.txt differs from GATE_OUT/base-commit.txt (kept steps are not keyed by the base); self-test stays 8.
- W2 (14-02): case big asserts 25,000,000 <= input bytes <= 26,214,400 and prints 'stamp input: <n> bytes'.
- W3 (14-03): inbox.mjs chainText returns the joined text, identical to NS.inbox.chainText; the hash is sha256 of it.
- W4 (14-03): the test store copies store.mjs signatures and blob-key rule, and its put throws on a second write of a thread, message, read, notice or client id.
- W5 (14-03): one test calls post() for a prospect party (kept apart from investors); count stays 14.
- W6 (14-13): Task 1 runs 13-01's render and guard tests without a name pattern. 14-13 cannot start until 13-01 and 13-11 merge (no assets/js/emails.js yet).
- C-02's inbox link is replaced by phase 15 sign-in (15-CONTEXT C-15); 14-03 builds no token.

## After 14-02 (merged 2026-11-26)
- watermark.js and dataroom.js merged as new files no page loads yet (until 14-06). WATERMARK 5 cases (B1: Producer/Creator the firm, no library name in plain, hex or UTF-16), DATAROOM MODEL 13 cases; server tests 408, all pass.
- Stamp time measured in the container (not on a phone): 25.6 MB / 41 pages 87-181 ms; a heavier 25.3 MB / 400-page file 373-427 ms, peak 307 MB. Far under 30 seconds: C-17's limit stays.
- No full gate ran for 14-02 (gate14.sh arrives with 14-01 and no page loads the files). The reference gate runs on the merged tree when 14-01 merges.
- API differences from the plan's interfaces are listed in 14-02-SUMMARY.md (verify brokenAt 0 with a field reason; viewsOf sums seconds; docsFor optional time; NS.dataroom undefined in the managed edition). Legal sentences are drafts: 14-06 marks them "To be confirmed".

## After 14-03 (merged 2026-11-26)
- server/lib/inbox.mjs merged, not mounted (index.mjs and store.mjs unchanged); 14 tests; server tests 422 on the merged tree, all pass; GATE_SERVER_TESTS=422 from here.
- Executor deviations accepted: notice grouping counts only notices actually sent; firm notices follow the one-per-hour rule per side; optional clientId (ids and notice status only, never the body); correctionOf checked; duplicate recipients collapsed; fileKind, checkFiles, screen, TYPES, GENESIS exported for 14-08.
- Orchestrator choice (disk): a broadcast stores one sealed copy of each attachment, not one per recipient (a 25 MB file to 500 investors would be about 12.5 GB). 14-08 or 14-09 changes the storage to one blob per attachment per send, keyed by its SHA-256, with each recipient's message referencing it; access is still checked per recipient, and nothing is deleted. The executor of whichever plan first mounts broadcasts applies this.
- 14-08 must map party.prefs.notices to inv.emailPrefs.messages, add the 'inbox' collection line to store.mjs, build the context only from the phase 15 session, and compare both the chain text and the hash with the browser.

## Plan-check additions, 14-05 (checked 2026-11-26 against 9b05658; 1 blockers fixed here, 8 warnings). Executors apply these with their plan. Findings: scratchpad checks-14-05.md.
- B1: nothing is rewritten. Room, doc, prospect, event, assent and link records are written once; a new NDA, a new or revoked link, an end, a hide and the open link are new events (14-02's kinds) or new write-once records (e.g. rl_<id> { prospectId or open, tokenHash, expiresAt }); current state is read from them. The test store copies 14-03's (W4): store.mjs signatures and blob-key rule, put throws on any second write of an id, putBlob on a second write of a key, remove/removeBlob throw, afterEach asserts nothing refused and counts only grew. findByToken scans link records in constant time.
- W1: verify(roomId) as NS.dataroom.verify: { ok: true, events } | { ok: false, brokenAt: seq, reason } | { ok: false, brokenAt: 0, reason naming the field }; event text exactly 14-02's eventText with its kind names; nodelete tests both forms.
- W2: base-count.txt holds the number N only; Task 3's target is base + 15 (its action's "+ 14" is wrong).
- W3: stamp's firm option is sealed.firm.name; test stamp asserts Producer and Creator are the firm name and no 'pdf-lib' or 'Hopding' in the served bytes.
- W4: regime is read with eligibility.js's rule on the posted exemption string (regime({ structure: { exemption } })).
- W5: the test server also routes /v1/inbox* to a real inbox.sponsor on the same store for test questions.
- W6: address = rightmost X-Forwarded-For entry only when env.TRUST_PROXY === '1', else the socket's; test nda shows a spoofed header without TRUST_PROXY is not recorded.
- W7: the interest fixture uses 'routing 190000018' (fails the ABA checksum) instead of 190000017 (passes it).
- W8: LIMITS.nda = Math.ceil(20 MB * 4 / 3) + 256 KB for the e-sign assent; test esign: a 10 MB + 1 byte PDF → 413.
- I1: days over 90 refused (422) or clamped, stated in the summary. I2: a cached copy keeps the first serve's view id in its footer; the summary says so.
