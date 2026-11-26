# Phase 14: Portal messaging and the data room - Research

**Researched:** 2026-11-26
**Domain:** Secure in-portal messaging (threads, attachments, read status, broadcast, email notices) and a prospect data room (NDA gate, view tracking, watermarking, soft commitments) for a white-label portal that runs both with no server (browser storage) and with a zero-dependency Node integration server
**Confidence:** HIGH for the in-repo picture (every file named was opened this session; one probe run); MEDIUM for law (law-firm summaries and SEC page titles found by search; the SEC, eCFR and vendor pages themselves could not be opened from this session); LOW to MEDIUM for outside prices (search excerpts only; see section 1).

<user_constraints>
## User Constraints (from 14-CONTEXT.md, verbatim)

### Locked Decisions (owner)
- D-01 (2026-11-15, 01.4-RESUME 5b): investor and sponsor messaging inside the portal: secure inbox, threads per investor and per offering, attachments, read status, sponsor broadcast, an email notice of each new message (never the message text in the email when it could hold private data), everything kept for the record.
- D-02 (2026-11-16, roadmap additions): with messaging, a data room for prospects: NDA-gated documents, view tracking, soft commitments.
- Carried: outside-API check first (CLAUDE.md: options with cost, accuracy, speed and trade-offs before building in-house; no budget for monthly fees, so a $0 path comes first); white label (no provider, vendor or model names on any screen); the preview runs with no server, so every screen works from the browser's own storage and says honestly what a server adds; never the word "basic"; lean screens; nothing called ready before the owner checks it.
- Owner (2026-11-26): build everything through step 11 that can be built without him; ask with a push notification and take the default after 15 minutes.

### Questions the research must answer (from 14-CONTEXT.md)
- What exists: notices (console Notices), documents (investor Documents), emails (phase 13 renderer and sent log), e-sign consent, investor records, the server's routes and storage. What a thread, message and attachment need on top.
- Record keeping: what a sponsor (often an exempt reporting adviser or none) must keep for investor communications; Rule 204-2 / 17a-4 relevance for this audience; what "kept for the record" must mean (no deletion, export).
- Data room: NDA click-through vs e-signed NDA (reuse the built-in e-signature), per-document view tracking, watermarking, download control, soft commitments (indication of interest, not a subscription), 506(b) general-solicitation limits (a data room for 506(b) must not be a public offer: prospects need a pre-existing relationship; 506(c) can be open with verification later).
- Outside services (secure messaging, virtual data rooms) with real prices vs in-house.

### Claude's Discretion
- Not stated in 14-CONTEXT.md. By the project's practice: data shapes, file layout, routes, limits and the order of plans, within "build only what the law or the task needs" (AUTOPILOT.md). Each open choice is listed in section 8 as C-01... with a default.

### Deferred Ideas (OUT OF SCOPE)
- None listed in 14-CONTEXT.md. From the roadmap and AUTOPILOT.md: signed-in investor sessions, two-factor sign-in and roles (phase 15, Security); reorganizing the console menus (launch step 12); transfers and secondary sales (01.4-RESUME: "only if a transfer agent offers an API"); the in-house reader (D-33).
</user_constraints>

## Project Constraints (from CLAUDE.md and AUTOPILOT.md)

- Everything through GSD agents: researcher, planner, plan checker, executors in isolated worktrees, verifier. Test on real documents and show the owner the real result; nothing is called ready, working or done before the owner has checked it.
- Outside API or service that could do the job: present cost, accuracy, speed and trade-offs before building in-house (section 1). No budget for monthly fees: the $0 path first.
- Work economically: no waste, no bloat; match effort to what the case needs.
- White label: no vendor, model, library or platform name in anything a sponsor or investor sees; the word "basic" never appears (help guide tests enforce both: server/test/help-guide.test.mjs).
- Nothing mandatory for investors (D-30). Managed (Carrow & Vale) edition unchanged unless a plan says so (C-03 slice guard in status-math).
- No fetch()/XHR on any path that must work without a server; checks run in a sandboxed iframe with connect-src blocked at 390x844 (touch) and 1280x800; no Blob stored in IndexedDB (bytes only); no browser PDF viewer (pages drawn in the page); every view has an on-screen way out; dialogs scroll.
- RED-first: every behaviour change has a check that fails before and passes after; the full gate is .planning/checks/gate-reference.sh with an exact server test count.
- Save rules: commit and push each finished file or section; executors push wip branches after every commit.
- Never open SCRATCH/blind/. Never commit confidential documents or personal data. No paid API calls by agents; no API keys.
- Never put the owner's name or private details in outside requests (honoured: every search in this research was a generic vendor or law query).

## Summary

The portal has most of the parts already, but not the thing itself. Investors see one-way **Notices** (console.js:1630, portal.js:117 and the Updates page) and published **Documents** (console.js:2318; bytes kept as bytes in the browser's file store, operations.js:389). The console keeps a **hash-chained change log** (audit.js:1002-1167, SHA-256 of the previous hash plus the entry) and a **zip writer with a SHA-256 manifest** (audit.js:943, 1744-1756). E-signature records consent under ESIGN/UETA (esign.js:2614-2624, 3100) and can be embedded in another page (esign.js `embed`, onboarding uses it). The server has a pattern for investor-facing records on the investor's own device: tax documents delivered by a sealed link with a token whose SHA-256 alone is stored, files sealed with AES-256-GCM, opens reported back to the console (server/lib/taxdocs.mjs:1-80). What does not exist: any two-way message, thread, read state or reply; any prospect record (a prospect today is either an investor record created by the sign-up link, diy.js:155-251, or nothing); any NDA, view tracking, watermark or indication of interest.

Two facts shape the design. First, **the server is an integration server, not the portal's database**: the sponsor's workspace lives in the sponsor's browser even in server mode, and an investor on another device reaches only what a link token opens (invitations, tax documents). So in server mode, messages and data room activity must live on the server (sealed) and be merged into the console by polling, exactly as invitations are (invitations.js:2813-2832, 60-second poll). Second, **phase 13 is not merged yet**: only 13-02 (mail adapters) is in the tree; `assets/js/emails.js`, the sent log and `POST /v1/messages` do not exist on b36ace7/5b85eee. Phase 14's email notices therefore wait for 13-01, 13-03 and 13-11; everything else (the model, the screens in the preview, the server modules unmounted) can start now.

No outside service fits the owner's limit: chat services start around $279-$499 a month, data rooms around $30 per admin per month (with NDA and watermarking only on higher tiers) to $150-$300 a month, and none is white-label for a firm's investors at $0 (section 1). The in-house path costs $0 and reuses the browser file store, the change log's hash chain, the zip export, e-sign consent, the phase 13 renderer and sent log, and the shipped PDF writer, which this session proved also runs on the server with no new dependency (probe in section 2.4).

**Primary recommendation:** Build messaging and the data room in-house on two new model files (`assets/js/inbox.js`, `assets/js/dataroom.js`) whose records are append-only and hash-chained, two screen files, one shared watermark module, and two server modules (`server/lib/inbox.mjs`, `server/lib/dataroom.mjs`) that follow the tax-document link pattern; gate every 506(b) room on a recorded pre-existing relationship and personal links only; email notices through the phase 13 renderer with fixed wording and no message text; prove it on the phone frame, then the owner's check.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Threads, messages, read state, broadcast fan-out (preview) | Browser workspace (`inbox.js`, localStorage metadata, file store bytes) | - | The preview has no server; console and portal share one workspace in one browser |
| Threads, messages, read state (server mode) | API / Backend (`server/lib/inbox.mjs`, sealed store) | Browser console merges by polling | Investor and sponsor are on different devices; the server is the only shared place |
| Investor's access to their inbox on their own device | API / Backend (link token, SHA-256 stored) | Phase 15 replaces with sign-in sessions | Same pattern as invitations and tax documents today |
| Attachments | Browser file store (preview) / sealed blobs (server) | - | Bytes, never Blob (Safari loses Blobs) |
| Email notice of a new message | API / Backend (phase 13 renderer + mailer) | Browser (simulated + sent log entry) | Credentials and sender domain live on the server |
| Record: tamper evidence, no deletion, export | Browser model (hash chain, zip) | Server keeps the authoritative copy in server mode | Browser storage alone is not a durable record (section 3) |
| Data room documents, NDA assent, views, indications of interest | Browser (preview) / API (server mode) | - | Prospects are outside the sponsor's browser in real use |
| Watermark stamping | Shared UMD module (`assets/js/watermark.js`) used by browser and server | Shipped PDF writer | One stamp, both modes; server stamping means the clean file never leaves the server |
| 506(b) gate (relationship recorded, personal links only) | Browser console (refuses before a link exists) | API refuses a room link without the recorded basis | The server must not trust the browser |
| Help guide entries | `server/help/guide.md` -> generated module | Preview help data | Size-capped (section 7.3) |

<!-- section: summary done -->
