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

## 1. Outside services first (CLAUDE.md rule): options, real prices, fit

**How prices were read.** The vendors' own pricing pages could not be opened from this session: `docsend.com`, `papermark.com` and `getstream.io` failed to resolve (outside the session's allowed network), so, per the tool's instruction, no further vendor sites were fetched. Every figure below comes from web-search excerpts of the vendor's page or of third-party listings, read on 2026-11-26. **Each price is MEDIUM at best and must be re-read on the vendor's page before the owner relies on it.** Where no price could be read, the table says so.

### 1.1 Secure messaging services (in-app chat or encrypted email)

| Option | Price found (2026-11-26) | Fit for D-01 | Speed to build | Trade-offs |
|--------|--------------------------|--------------|----------------|-----------|
| **In-house (recommended)** | **$0** software; server mode runs on the sponsor's existing integration server; email notices ride on the phase 13 sender (Amazon SES default, about $0.10 per 1,000 emails, already chosen in 13-CONTEXT C-01) | Full: threads per investor and per offering, attachments, read status, broadcast, notice emails with no text, append-only record, export, white label by construction | The longest path (about 10 plans, section 7) | We own correctness and security; no real-time push (60-second poll, same as invitations today); the record in server mode depends on the server's store and its backups (section 3) |
| Stream (in-app chat API) | Free "Build" tier for development; paid tiers by monthly active users; overage about $0.09 per MAU on some plans; a third-party profile puts plans "from ~$499/mo for ~10,000 MAU" [CITED: search excerpt of getstream.io/pricing and apis.io profile] | Chat only; no record-keeping export to our format, no data room; the chat UI and SDK would need hiding to stay white label | Fast for chat (days), slower to make it look like the portal | Monthly fee after free tier; investor messages held by a third party (a new processor of investor data); a vendor SDK loaded from a CDN breaks the no-network preview rule |
| Sendbird | Older listings: Starter about $349-$399 a month for 5,000 MAU; one change log says the MAU plans were restructured in 2024 and the 5K Starter removed; current status could not be confirmed [CITED: search excerpts of sendbird.com/pricing/chat, featurebase, pricingsaas] | As Stream | As Stream | As Stream; pricing in flux |
| TalkJS | $279 a month (10,000 MAU, $0.04 per extra MAU); Growth $569 a month (25,000 MAU) [CITED: search excerpt of talkjs.com/pricing, toolradar, cometchat] | Chat UI with threads and attachments; no data room; white label only by styling | Fast | $3,348 a year minimum; same processor and CDN issues |
| Encrypted email (Paubox, Virtru) | Paubox about $29-$79 a month for small teams; Virtru Starter $119 per 5 users a month [CITED: search excerpts of G2 and TrustRadius listings] | Poor: it encrypts email; it is not an inbox inside the portal, has no per-offering threads, no read status in the portal, no broadcast with private replies | Fast to buy | Investors must open a vendor's message page (a vendor name in front of investors breaks white label); monthly fee per sponsor |

**Accuracy and speed of chat services:** all deliver messages in real time (seconds); our poll is up to 60 seconds in server mode and instant in the preview. For investor relations (a handful of messages a week per firm) a minute is not a product problem. [ASSUMED: usage volume for 40 sponsors]

**Verdict:** no chat service fits a $0 budget past its free tier, none provides the record the law-facing design needs (section 3) or a data room, and each adds a processor of investor data and a CDN script that breaks the no-network preview. Build in-house.

### 1.2 Virtual data rooms

| Option | Price found (2026-11-26) | NDA gate / watermark / view tracking | Fit for D-02 | Trade-offs |
|--------|--------------------------|--------------------------------------|--------------|-----------|
| **In-house (recommended)** | **$0** (shipped PDF writer and viewer; server stamping proven this session with no new dependency, section 2.4) | Click-through NDA with full assent record, or the built-in e-signature; per-prospect watermark on every page; views per document per prospect (opened, pages seen, time); download off or watermarked | Full, plus what no data room does for us: the 506(b) relationship gate, indications of interest feeding the offering, conversion to an invitation and subscription in the same portal | A determined viewer can still photograph a screen (true of every data room); we own the security of the server path |
| Peony | Free $0 (up to about 50 documents, analytics kept 30 days); Business $30 per admin a month (annual; $44 monthly); Data Room $52 ($75 monthly); Deal Team $64 ($89 monthly); viewers free [CITED: search excerpt of peony.ink docs "Plans and Pricing", dated 2026-11-05] | NDA gating and watermarks appear on paid tiers, not confirmed on Free | Separate product; prospects see the vendor's pages | Lowest paid entry found; NDA on Free not confirmed; data outside the portal; no link to subscriptions |
| DocSend | Personal $10-$15 per user a month; Standard $45-$65 per user a month (no data rooms); Advanced about $150 a month annual or $250 monthly (3 users, light data rooms); Advanced Data Rooms about $180 annual or $300 monthly; extra users about $60-$90 a month; no free plan [CITED: search excerpts of docsend.com/pricing and third-party reviews; figures disagree by billing period] | Yes on data-room tiers | Separate product | $1,800-$3,600 a year per sponsor |
| Papermark | Hosted Data Rooms plan about €99 / $99 a month; code is open source under AGPL; self-hosting is free in licence terms but third parties estimate $20-$50 a month of infrastructure, and the vendor ties managed self-hosting to an Enterprise quote [CITED: search excerpts of papermark.com/pricing.md and ellty.com] | Yes | Self-hosting means running a second application (database, storage) beside ours | AGPL: modifying and serving it to prospects obliges publishing our changes; its own vendor name and look; a second stack to secure |
| Digify | Pro about $120-$150 a month; Team about $300; Business about $1,200 (listings disagree) [CITED: search excerpts of Capterra, Software Advice, SaaSworthy] | Yes | Separate product | Monthly fee |
| Firmex, iDeals, Intralinks, Datasite | Quote only; one buyer guide cites Firmex at about $7,800 a year on average [CITED: search excerpt of peony.ink comparison; competitor source] | Yes, deal-grade | Built for M&A, not small private raises | Far above budget |
| Investor-portal suites with data rooms (SyndicationPro, Cash Flow Portal and similar) | Mostly "pricing on request"; listings show about $99 to $650 a month [CITED: search excerpts of Capterra, G2] | Varies | They are competing portals, not components | Would replace the product, not serve it |

**Verdict:** the only $0 outside option (Peony Free) does not confirm NDA gating or watermarks on its free tier, keeps analytics 30 days (short of any record period, section 3), and shows prospects another company's product. Every option with the needed features costs $30-$300 a month per sponsor and none ties a soft commitment to the sponsor's subscription flow or enforces the 506(b) relationship rule. Build in-house; if a sponsor later needs deal-grade controls (for a sale of the company, not a fund raise) the owner can recommend a quote-only data room as an outside referral, not an integration.

### 1.3 What the owner is asked (or the default taken)

One question with a recommended default, sent with a push notification (CLAUDE.md): "Messaging and the data room: build in-house at $0 (about 10 plans), or pay an outside service (about $279-$499 a month for chat, $30-$300 a month for a data room, per sponsor)?" Default after 15 minutes: **in-house** (C-01, section 8).

<!-- section: outside services done -->

## 2. What the code has today, and the smallest design that delivers D-01 and D-02

### 2.1 Inventory (opened this session; tree 5b85eee)

| Part | Where | What it gives phase 14 | Limit found |
|------|-------|------------------------|-------------|
| Console Notices | `assets/js/console.js:1630-1700` (`NS.views['console-notices']`, `notice-send`) | Audience picker (all, one offering, selected investors via `pickerHTML`), confirm step, `w.notices[]` with `recipients`, change-log entry "Notice sent", toast "Email delivery is not connected in this demo." | One-way; no reply; no read state for the sponsor |
| Portal notices and Updates | `assets/js/portal.js:117-150` (`noticesHTML`, `markRead` pushes to `inv.noticesRead`), `:636-700` (Updates feed) | Unread mechanism per investor; a feed layout | Read state is the investor's only; the sponsor never sees it |
| Portal menu | `assets/js/portal.js:52-59`, verbatim: `['overview', 'Home'], ['investments', 'Investments'], ['distributions', 'Distributions'], ['documents', 'Documents'], ['updates', 'Updates'], ['account', 'Account']` [VERIFIED: portal.js:52-59] | One line adds "Messages" | Seven items on a phone menu |
| Console menu | `assets/js/console.js:37-69`; groups Raise / Operate / Report / Settings; items shown only when the view exists: `NAV.filter(([k]) => keys.indexOf(k) >= 0 && NS.views[k] && NS.app.allowed(k))` [VERIFIED: console.js:108] | Menu lines for views registered by later files are hidden until those files load, so one wiring edit can add both new pages | `console.js` is 252 KB and edited by many plans: one owner per wave |
| Edition guard | `assets/js/app.js:438-446`, verbatim: `if (v && v.edition && v.edition !== E.id) return false;` [VERIFIED: app.js:440] | `edition: 'diy'` on a view keeps it out of the managed edition with no other change | - |
| Documents (sponsor publish, investor view) | `console.js:2318-2431` (`docs-publish`, `docs-remove`), `portal.js:985-1052` | Upload, SHA-256 per file, audience rules, change-log entries | **"Remove" deletes the bytes**: `OPS().files.del(doc.id)` [VERIFIED: console.js:2427]. A data room must hide, never delete (section 3). Upload limit verbatim: `f.size > 25 * 1024 * 1024` [VERIFIED: console.js:2366] |
| Browser file store | `assets/js/operations.js:389-520` (`files.put/get/del`): IndexedDB `indexedDB.open('cvp-documents', 1)` [VERIFIED: operations.js:434]; bytes and type, never a Blob; files the browser refuses are held in memory and the person is told (`storageNote`) | Attachment and data room bytes in the preview | Survives only in this browser; a sandboxed frame may refuse IndexedDB (then memory only) |
| Workspace storage | `assets/js/workspace.js:9-48`: localStorage under `const PREFIX = NS.EDITION ? NS.EDITION.storagePrefix : 'cvp2:';` [VERIFIED: workspace.js:9]; self-serve prefix `storagePrefix: diy ? 'sdesk1:' : 'cvp2:'` [VERIFIED: edition.js:42] | Thread and message metadata live in the workspace JSON | localStorage is small (a few MB per origin in common browsers [ASSUMED]); message bodies count against it, attachments must not |
| Change log | `assets/js/audit.js:1002` entry text verbatim: `const entryText = (prev, e) => [prev, e.seq, e.at, e.actor, e.action, e.fund \|\| '', e.record \|\| '', e.detail \|\| ''].join('\|');`; `append`, `log`, `verify` (audit.js:1121-1167); exported in `NS.audit` with `sha256` and `zip` (audit.js:1759-1784) [VERIFIED: audit.js:1002, 1759-1784] | The hash-chain recipe and the verifier for messages; the zip writer and manifest for export | The change log is not the place for message text (it is exported into audit packages, 15_Change_log.csv); log ids and counts only |
| Audit package export | `audit.js:1744-1756` (`exportPackage`: schedules + README + `MANIFEST.sha256`, logs "Audit package exported") | The export pattern to copy for "Download the message record" | - |
| E-signature | `assets/js/esign.js`: consent screen (2603-2624), `send` (696), `createFromTemplate` (853), `embed(envId, investorId, back)` (signing inside another page), signers made by `makeSigner` with `role: o.investorId ? 'investor' : 'countersigner'` [VERIFIED: esign.js:626-640] | An e-signed NDA reuses the envelope, consent, certificate and signed copy | `embed` finds the signer by investor id (`flowSigner`), so a prospect with no investor record cannot sign without one small esign.js addition (C-04) |
| PDF writer and viewer (shipped) | `assets/vendor/pdfwrite/write.js` (pdf-lib 1.17.1, MIT, SOURCE.txt), `assets/vendor/pdfview/` (in-page page drawing), `NS.esign.viewPdf` | Watermark stamping and in-page viewing with no browser PDF viewer | - |
| Offering sign-up link | `assets/js/diy.js:155-251` (`join-link`, `NS.views.join`): offered for every raising offering; dialog text "Share this link in your offering emails or on your website" | Prospect intake shape (name, email, type, consent) | **Offered for Rule 506(b) offerings too** (console.js:609, 680 show the button whenever `o.status === 'Raising'`): sharing it on a website is general solicitation for a 506(b) offering (section 4.1). C-09 |
| Exemption reading | `assets/js/eligibility.js:20-32` `regime(o)`: `'506c'`, `'506b'`, `'regA1'`, `'regA2listed'`, `'regA2'`, `'other'`, `''` [VERIFIED: eligibility.js:16-32] | The room's rules per exemption | - |
| Console polling (server mode) | `assets/js/invitations.js:2813-2832`, `const POLL_MS = 60000;` [VERIFIED: invitations.js:38] | The same tick merges new messages and room activity | One minute delay |
| Console server client | `assets/js/integrations.js:294-310` `api(ws, method, path, body)` with the sponsor's bearer token; refusals carry the server's own sentence | All server calls | - |
| Server store | `server/lib/store.mjs` (JSON file + blobs, `put/get/list/remove/putBlob/getBlob/removeBlob`, blob key `/^[\w-]{1,120}$/` [VERIFIED: store.mjs:7]) | New collections `inbox`, `rooms` | JSON file store: "Replace with your database in production" (store.mjs:3) |
| Server vault | `server/lib/vault.mjs` (AES-256-GCM, record id and field bound as additional data, `seal/open/sealBytes/openBytes`) | Message bodies, attachments, prospect details, NDA assents sealed | Needs `DATA_KEY` (or test mode) |
| Investor link pattern | `server/lib/taxdocs.mjs:1-80` (32-byte token, only SHA-256 stored, constant-time lookup, `#taxdoc-<token>` link with `?server=`, `X-Doc-Token` header scoped to two calls, limits `TAXDOC_LIMITS = { pdf: 10 * MB, ... }` [VERIFIED: taxdocs.mjs:18]); dispatch in `server/index.mjs:846-870` by token header before the sponsor gate | The exact pattern for `X-Inbox-Token` and `X-Room-Token` | Bearer links: whoever holds the link opens it (as invitations today) until phase 15's sign-in |
| Mail | `server/lib/mail.mjs`, `server/mailers/` (13-02 merged); `assets/js/emails.js` **not in the tree** (13-01 not merged) | Notice emails after 13-01/13-03/13-11 | Phase 14 notice kinds wait for phase 13 |
| Phase 13 promises | 13-CONTEXT C-10 "Open and click tracking: off"; C-12 "No attachments, ever"; C-07 sent log kept up to `MAIL_LOG_DAYS` (2,555 days) | Notices carry no attachment and no tracking pixel | - |
| Help guide | `server/help/guide.md` -> `server/lib/help-guide.mjs`; caps verbatim `bytes(GUIDE.sponsor) <= 48000`, `bytes(GUIDE.investor) <= 20000` [VERIFIED: server/test/help-guide.test.mjs:130-131]; measured now: sponsor **46,698**, investor **15,436**, rules 3,400 | Every new route needs a section or a `skip` line | Sponsor guide nearly full (section 7.3) |
| Server tests | `cd server && node --test` on 5b85eee: `# tests 403 / # pass 403 / # fail 0` (measured this session) | Baseline for `GATE_SERVER_TESTS` | - |

**What a thread, a message and an attachment need on top:** a party (investor or prospect), an offering or none, an author on each message (the investor, or the named team member), a time, a body, attachments with name, type, size and SHA-256, a read time per side, a broadcast id when one message went to many, a sequence and a hash chained to the previous message of the workspace, and no edit or delete operation at all.

### 2.2 The data shapes (both modes; proposed names, not yet in the tree)

```js
// Workspace (preview: localStorage JSON; server mode: merged from the server). Append-only.
w.threads = [{ id: 'th-…', party: { kind: 'investor' | 'prospect', id }, offeringId: '' | 'off-…', roomId: '' | 'rm-…', createdAt }]
w.messages = [{ id: 'm-…', seq, threadId, from: 'firm' | 'party', author, at, body, attachments: [{ id, name, type, size, sha256 }],
                broadcastId: '' | 'bc-…', replyTo: '' | 'm-…', correctionOf: '' | 'm-…', readAt: '', notice: { status, at } , prev, hash }]
w.rooms = [{ id: 'rm-…', offeringId, nda: { mode: 'click' | 'esign', title, text, version /* SHA-256 of text */, templateId },
             docs: [{ id, title, fileName, type, size, sha256, pages, addedAt, hiddenAt: '' }], download: 'off' | 'watermarked',
             prospects: [{ id: 'pr-…', name, email, basis: { kind, since, note, recordedBy, at } /* 506(b) */, invitedAt, ndaAt, ndaName,
                           ndaVersion, envelopeId, views: [{ docId, at, seconds, pages }], interest: [{ at, cents, cls, note, withdrawnAt }] }] }]
```

- **Threads per investor and per offering (D-01):** one thread per (party, offering) pair plus one general thread per party (`offeringId: ''`). A sponsor opening "Message" on an investor's row in an offering opens or creates that pair's thread; an investor's "New message" asks "About" (general or one of their offerings).
- **Broadcast (D-01):** the sponsor writes once to "All investors", "Investors in <offering>" or picked investors (reuse the Notices audience picker, console.js `pickerHTML`); the model writes one message per recipient thread with one `broadcastId`. Replies land in that investor's own thread, private. The sponsor's list shows the broadcast once with "Read by N of M".
- **Read status:** `readAt` is set when the other side opens the thread with that message on screen; the sponsor sees "Read <date, time>" under its own messages; the investor sees "Read" under theirs. Unread counts go in both menus (console "Messages", portal "Messages") and the console's Notifications page.
- **Corrections, never edits:** a sent message cannot be changed or removed; "Correct" sends a new message linked by `correctionOf`, shown under the original. (Section 3.)
- **Hash chain:** `hash = sha256([prev, seq, at, threadId, from, author, body, attachments' sha256 list, broadcastId, correctionOf].join('|'))`, the change log's recipe (audit.js:1002) on its own chain, so a message changed later breaks the chain and the export says so. Read times are not in the chain (they change once, later); they are recorded as their own append-only events in server mode.
- **Change log entries** (`NS.audit.log`): "Message sent" / "Broadcast sent" / "Message received" with thread id, counts and attachment count, **never the body** (the change log is exported into audit packages); "Message record exported"; data room: "Data room opened", "Prospect invited", "NDA accepted", "Document added", "Document hidden", "Indication of interest recorded"; views are kept on the room (too many for the change log).

### 2.3 Preview mode (no server): one browser, honest wording

- Console "Messages" page (`console-messages`, `edition: 'diy'`): thread list (party, offering, last message, unread), the thread with a composer (text up to 4,000 characters, attachments), "New broadcast". Portal "Messages" page (`messages`): the investor's threads, composer, attachments. Data room page (`console-dataroom`) and the prospect's room page (`room-<roomId>-<prospectId>`), opened from the console with "Open as this prospect" (the preview has one browser, so the sponsor plays the prospect there; the planner should reuse however the self-serve preview opens the investor portal today, app.js `state.viewer`, rather than add a new switcher [ASSUMED: the exact entry point was not traced]).
- The email notice is shown as the phase 13 message preview, marked with the one phase 13 sentence "(simulated in this demo)" (13-RESEARCH EM-13), and leaves a `simulated` sent-log entry (13-01 `NS.emails.log`).
- One plain line on each page when no server is connected: "Messages are kept in this browser only. With your server connected they are kept there and reach investors on their own devices." (exact wording for the planner to fix once; no vendor name).
- Zero network requests (no-network.js pattern), bytes in the file store, metadata in the workspace.

### 2.4 Server mode: the tax-document link pattern, twice

- **`server/lib/inbox.mjs`** (new; mounted in `server/index.mjs`): sponsor calls behind the existing sponsor gate (`API_TOKEN` or the sponsor account's token, workspace pinned): `POST /v1/inbox/messages` (one message or a broadcast: party snapshots with id, name, email; body; attachments base64), `GET /v1/inbox/updates?workspace=&since=` (new investor messages, read events, notice statuses since a sequence number), `GET /v1/inbox/attachments/:id`, `POST /v1/inbox/links/:investorId` (a new link; revokes the old). Investor calls with `X-Inbox-Token` only: `GET /v1/my-inbox` (the firm, the investor's threads and messages), `POST /v1/my-inbox/messages`, `POST /v1/my-inbox/read`, `GET /v1/my-inbox/attachments/:id`. Route names avoid `/v1/messages`, which phase 13's 13-04 takes for email messages.
- **`server/lib/dataroom.mjs`** (new): sponsor `POST /v1/rooms` (offering snapshot with exemption, NDA text or e-sign template, documents base64, download setting), `POST /v1/rooms/:id/prospects` (refused with 422 for a 506(b) room unless the relationship basis is in the body), `POST /v1/rooms/:id/documents`, `POST /v1/rooms/:id/documents/:doc/hide`, `GET /v1/rooms/:id/activity?since=`. Prospect calls with `X-Room-Token`: `GET /v1/room`, `POST /v1/room/nda`, `GET /v1/room/documents/:doc` (the watermarked PDF), `POST /v1/room/views`, `POST /v1/room/interest`, `POST /v1/room/messages` (questions, the same thread model).
- **Tokens:** 32 random bytes, only SHA-256 stored, constant-time lookup, link `<portalUrl>?server=<server>#inbox-<token>` or `#room-<token>`, portal page must list the server (`integrationServers`, server/README.md "Publishing the portal for invitations"). Scope: the inbox token opens one investor's inbox; the room token opens one prospect's view of one room; both are refused everywhere else (401), as invitation and tax-document tokens are (index.mjs:846-870).
- **Sealing:** bodies, attachment bytes, names, emails, NDA assents and IP addresses sealed with the vault; events hold ids and types only.
- **The console merges, the server keeps:** unlike invitation submissions (deleted after import), messages and room records are **never deleted** by the server; the console merges them into the workspace by the 60-second tick and keeps its own copy; the server copy is the record in server mode.
- **Server watermarking with no new dependency (probe run this session):** the shipped writer loads in Node with `require` and stamps every page. Output of `node scratchpad/wm-test.cjs /home/user/Hhhh/assets/vendor/pdfwrite/write.js`: `node watermark ok 860 -> 1357 pages 1` [VERIFIED: probe run 2026-11-26 against assets/vendor/pdfwrite/write.js, pdf-lib 1.17.1]. So `assets/js/watermark.js` (UMD, like the phase 13 `emails.js` and the existing `formd.js` that the server already loads) can stamp on the server, and the clean file never leaves the server. Stamped text: the prospect's name, email, date and "Confidential", diagonal, light, on every page; plus a footer line with the room and a short view id.
- **Real-time:** none. The console polls; the investor's page refreshes its inbox when opened and every 60 seconds while open (C-06).

### 2.5 What is deliberately not built

- No editing, deleting or "unsend" of messages; no typing indicators or presence; no reactions; no group chats between investors (investors never see one another, a privacy rule for fund investors [ASSUMED: standard practice]); no open or click tracking in emails (13-CONTEXT C-10); no attachments in emails (C-12); no public data room listing; no money, no subscription agreement and no signature of a subscription in the data room (section 4.3).

<!-- section: design done -->

## 3. Record keeping: what "kept for the record" must mean for this audience

### 3.1 Who the sponsors are, and which rules reach them

| Sponsor type | Books-and-records rule | What it says about investor communications | Source |
|--------------|-----------------------|---------------------------------------------|--------|
| SEC-registered investment adviser (some sponsors, and any fund manager that grows past the private fund adviser exemption) | Advisers Act Rule 204-2 | Applies to advisers "registered or required to be registered"; (a)(7) covers written communications sent and received relating to advice or recommendations, receipt or disbursement of funds or securities, and placing orders; kept at least five years, the first two in an easily accessible place; electronic storage allowed under conditions in 204-2(g) | [CITED: search excerpts of 17 CFR 275.204-2 (law.cornell.edu, ecfr.gov), Smarsh and SIFMA summaries; the eCFR text itself could not be opened here] |
| Exempt reporting adviser (ERA: venture fund advisers and private fund advisers under $150 million in the U.S.) | Rule 204-2 by its own text reaches registered advisers, not ERAs; the SEC keeps authority under section 204(a) to require records and reports and to examine; ERAs file parts of Form ADV (Rule 204-4) and remain under the antifraud rules (section 206, Rule 206(4)-8 for pooled vehicles) | No specific communications-retention rule found for ERAs | [CITED: search excerpts of IA-3222 (2011 exemptions release) on section 204(a) authority; IA-3297 on ERAs and Form ADV] / [ASSUMED: no ERA-specific retention rule; the 2011 adopting release text was not opened] |
| Unregistered sponsor that is not an adviser (most real estate syndicators selling LLC interests) | No Advisers Act record rule | None from the SEC; antifraud (Rule 10b-5) and state law still apply; records are the sponsor's evidence that disclosures were made and no general solicitation occurred in a 506(b) raise | [ASSUMED] |
| Broker-dealer | Exchange Act Rule 17a-4 (communications kept 3 years, specific electronic-storage conditions) | Not this audience: the product does not act as a broker-dealer and the sponsor is not one; a sponsor that uses a placement agent relies on the agent's own archive | [ASSUMED: from training knowledge; not re-read this session] |
| Privacy rules | Regulation S-P (as amended in 2024) covers registered advisers, not ERAs or state-registered advisers; private fund advisers outside S-P may fall under the FTC's Safeguards Rule; state breach-notice laws apply to all | Messages can hold personal financial information: encrypt at rest, limit access, plan for incidents (phase 15) | [CITED: search excerpts of Cleary Gottlieb, Foley Hoag and DWT alerts on the 2024 Regulation S-P amendments; smaller-entity compliance date June 3, 2026] |
| Electronic records generally | ESIGN Act (15 U.S.C. 7001(d)) and UETA: where a law requires a record be retained, an electronic record satisfies it if it accurately reflects the information and stays accessible for later reference | The export must reproduce exactly what was sent, with attachments | [ASSUMED: from training knowledge; the statute was not re-read this session] |

**Off-channel lesson:** the SEC's 2021-2024 enforcement sweep fined registered firms for business messages on personal texting apps that were not kept. A portal inbox that keeps everything is the remedy, which is a real selling point for sponsors who are or may become registered. [ASSUMED: from training knowledge; not searched this session]

### 3.2 The standard to build to: the highest likely one, at $0

Because some sponsors are registered and others may become registered, and because the same records are the sponsor's evidence in a dispute or an examination of a 506(b) raise, the design meets Rule 204-2's electronic-records conditions for everyone. It costs nothing extra:

1. **Nothing is deleted or changed.** No delete, edit or unsend operation exists in the model, the screens or the server routes (no `DELETE` on any phase 14 route; the server's `store.remove` is never called for `inbox` or `rooms`). A correction is a new message linked to the original. A data room document is **hidden** from prospects (with who and when), never removed: its bytes and every view record stay. This differs from Documents' "Remove" today, which deletes bytes (console.js:2427); the data room must not reuse that action.
2. **Tamper-evident.** Each message carries `seq`, `prev` and `hash` (section 2.2); the export recomputes the chain and prints "Chain verified" or the first broken entry, exactly as the audit package does for the change log (audit.js:1297, 1603).
3. **Complete.** The record holds what the investor saw: the body, each attachment's bytes and SHA-256, the author, the time, the thread and offering, broadcast id, read times, the notice email's status (sent, simulated, bounced) from the phase 13 sent log; for the data room, the NDA text version and each assent, each document's SHA-256, every view, every indication of interest and its withdrawal.
4. **Indexed and promptly produced.** "Download the message record" on the Messages page (whole workspace, one investor, or one offering) builds one zip with `messages.csv` (seq, time UTC, thread, offering, from, author, to, body, attachment names, attachment SHA-256, correction of, read at, notice status, previous hash, hash), `attachments/<message id>/<file>`, `README.txt` (what each column means and how to check the chain), `MANIFEST.sha256` (audit.js `zip` + manifest pattern); "Download the data room record" builds `nda.csv`, `views.csv`, `interest.csv`, `documents.csv`, the NDA text versions and documents. Both exports are written to the change log. (CSV, not a proprietary format: any examiner can open it.)
5. **Kept for at least seven years in server mode.** The server never deletes phase 14 records; no retention setting is offered in this phase (C-05). Seven years covers 204-2's five years from the end of the fiscal year of the last entry with room, and matches phase 13's sent-log default (13-CONTEXT C-07, 2,555 days).
6. **Access limited.** Server records sealed with the vault; links scoped to one investor or one prospect; sponsor routes behind the sponsor gate with the workspace pinned; phase 15 adds sign-in, roles and an access log.
7. **Honest about the preview.** Browser storage is not a record: a browser can clear it, a private window loses it, and the sandboxed preview frame may refuse it (then everything is held in memory until the page closes, already said by `storageNote`). The Messages page says so in one line with no server, and offers the export (section 2.3). With a server, the server copy is the record and must be backed up with `DATA_KEY` (server/README.md "Data protection").

### 3.3 What the product must not claim

No screen may say the product makes a sponsor "compliant with Rule 204-2" or "SEC-compliant archiving". The honest sentence (for the guide and the export README): "Messages and data room activity are kept unchanged and can be downloaded with a check that nothing was altered." [ASSUMED: wording; counsel-level claims are out of scope]

<!-- section: record keeping done -->

## 4. Data room law (what the room may and may not do)

All law here is from law-firm summaries and SEC page titles found by search; the SEC's and eCFR's own pages could not be opened from this session. Every on-screen rule sentence must be marked "To be confirmed" until counsel or the owner confirms (AUTOPILOT work-around rule).

### 4.1 Rule 506(b): no general solicitation, so the room is never public

- A pre-existing, substantive relationship with each offeree is one way, not the only way, to show no general solicitation occurred; there is no fixed waiting period; a check-box self-certification of accredited status does not create one; an "enter your email to see the deck" page does not satisfy 506(b). [CITED: search excerpts of Akin Gump, McGuireWoods and Mondaq summaries of SEC C&DI 256.29-256.33 and the 2015 Citizen VC no-action letter]
- "Substantive" means the issuer (or someone acting for it) has enough information to judge the offeree's financial circumstances and sophistication; "pre-existing" means formed before the offeree was approached about this offering. [CITED: same summaries] / [ASSUMED: the exact C&DI wording was not read]
- Even with relationships, the SEC has found general solicitation (KCD Financial). [CITED: Mondaq summary]
- A January 2026 C&DI addresses investors first solicited through a 506(c) offering and later offered a 506(b) offering: generally not allowed unless a substantive relationship existed before, or they were not solicited through the 506(c) offering. [CITED: search excerpt of thecorporatecounsel.net, 2026-01-26] / [ASSUMED: exact text]

**What the product does for a 506(b) room (C-03):**
1. No shareable or public link, ever: one personal link per prospect, created by the sponsor.
2. Before a link is created the sponsor records the basis, per prospect: "How you know this person" (an investor in an earlier offering of the firm; a personal or business relationship; introduced by someone the firm knows, with their name; other, with a note), "Since" (a date before the offering), and a tick "I know enough about this person's finances and investing experience to judge whether this offering suits them". Stored on the prospect with who recorded it and when; the server refuses the link (422) without it. A date on or after the room's opening shows a warning ("A relationship that began with this offering is not pre-existing.") and is not blocked (the sponsor's counsel decides; never mandatory blocking of a sponsor's judgment beyond the record) [ASSUMED: warn-not-block, consistent with the 506(b) 36th-purchaser warning in phase 06].
3. The room page shows the offering's legend (C-08) and no "invest now".
4. **Existing gap found:** the offering sign-up link (diy.js:155-251) is offered for 506(b) offerings with the words "Share this link in your offering emails or on your website". For a 506(b) offering that invites general solicitation. Fix in this phase (C-09): for a 506(b) offering the dialog says the link is for people the firm already knows, never a website or public post, and the room is the recommended path.

### 4.2 Rule 506(c): open is allowed, verification before the sale

- General solicitation is allowed; every purchaser must be an accredited investor and the issuer must take reasonable steps to verify. A March 12, 2025 SEC staff no-action letter (Latham & Watkins) allows reliance on a high minimum investment (reported thresholds: at least $200,000 for individuals, $1,000,000 for entities) plus written representations that the purchaser is accredited and the minimum is not financed by a third party; new C&DIs 256.35 and 256.36. [CITED: SEC letter title at sec.gov "latham-watkins-503c-031225" and summaries by Alston, Dechert, Nixon Peabody, Morgan Lewis]
- **What the product does:** a 506(c) room may have a shareable link (prospect enters name and email, then the NDA); verification stays where it is today (integrations.js, at subscription), never in the room. The room never states or implies the prospect is accredited.

### 4.3 Soft commitments: an indication of interest, never a subscription

- Under Rule 241 (testing the waters before choosing an exemption) an indication of interest must involve "no obligation or commitment of any kind", the materials must state that no money is solicited or accepted, and a Rule 241 communication can itself be general solicitation. [CITED: search excerpts of O'Melveny, Troutman summaries of SEC Release 33-10884 and 17 CFR 230.241] The data room is inside an offering already under way (the sponsor chose Rule 506), so Rule 241 is not the rule that governs it; its conditions are still the right model for a non-binding indication. [ASSUMED: applying 241's conditions by analogy]
- An indication of interest is not a sale. Form D is due 15 days after the first sale, the date the first investor is irrevocably contractually committed, so indications do not start the Form D clock (phase 09). [ASSUMED: from training knowledge of Form D C&DI 257.03; not re-read]
- **What the indication may be:** an optional amount and share class, an optional note, changeable or withdrawn at any time by the prospect, shown to the sponsor as a pipeline total per offering beside (never inside) "raised".
- **What it may not be:** no signature, no subscription agreement, no bank details, no payment instructions, no "commit" wording, no deadline pressure, no count toward the 506(b) 35 non-accredited purchasers or toward raised capital; never turned into a subscription by the sponsor. The prospect becomes an investor only through the existing invitation (the sponsor's "Invite to subscribe" from the prospect's row creates a normal invitation, invitations.js), which brings the subscription agreement, status questions and e-signature.
- **Legend on the indication form (C-08):** "This is not an offer to sell or a commitment to buy. No money is requested or accepted. You can change or withdraw this at any time." [ASSUMED: wording, To be confirmed]

### 4.4 The NDA: click-through or e-signed

- U.S. courts generally enforce clickwrap terms when the person had notice and affirmatively assented (an unticked box they tick, a button that says what it does), and the record ties a specific person, time and version to the assent; pre-ticked boxes weaken it. [CITED: search excerpts of Wilson Sonsini and Ironclad summaries] ESIGN and UETA give electronic signatures and records the same effect as paper. [ASSUMED: statute not re-read] No court decision squarely on a data-room clickwrap NDA was found. [CITED: search found none]
- **Click-through (default, C-04):** the NDA text is shown in full and scrolls; the prospect types their full name and ticks "I agree to keep these documents confidential under the agreement above" (never pre-ticked); "Agree and open the documents". Recorded: the NDA's SHA-256 version, the name typed, the email of the link, time (server time in server mode), IP address and browser (server mode, sealed), and the room. The prospect can download a copy of the agreed text with their name and time.
- **E-signed (option per room):** the sponsor uploads its own NDA PDF; it becomes an e-sign template (esign.js) and the prospect signs it in the room through the existing signing experience (consent screen, certificate of completion, signed copy). Needs one esign.js addition so a signer without an investor record can sign inside the room page (`embed` today finds the signer by investor id). Heavier for the prospect (more screens on a phone) and for the build (a shared, very large file, 285 KB).

### 4.5 View tracking, watermarking, download control

- **View tracking:** per prospect and document: first and last opened, number of opens, pages drawn, seconds on screen (counted while the page is visible); shown to the sponsor per prospect and per document; in server mode reported by the room page (`POST /v1/room/views`) and also counted by the server when it serves a document (so a viewer that blocks reporting is still logged as opened). No tracking in emails (13-CONTEXT C-10). The room says so: "Your views of these documents are recorded for <Firm>." (privacy notice; required honesty, one line) [ASSUMED: wording].
- **Watermark:** every page stamped with the prospect's name, email, date and "Confidential", diagonal and light, plus a footer with a short view id; server mode stamps on the server so the clean file never leaves it; the preview stamps in the browser (the clean file is already in that browser, so it is a demonstration, and says nothing more).
- **Download:** off by default (pages drawn in the page, no browser PDF viewer, as the product already does); the sponsor may allow watermarked download per room. Honest line in the console: "Viewing in the page does not stop screenshots or photos; the watermark shows whose copy it was." [ASSUMED: wording]
- **Hiding and expiry:** a document can be hidden (never deleted); a prospect's access can be ended (link revoked) or set to expire; both logged.

### 4.6 Regulation A and other exemptions

- Regulation A offerings have their own testing-the-waters rule (Rule 255) with legends and filing of materials; a room for them is not built in this phase: the "Data room" button is offered for 506(b) and 506(c) offerings only, and for "other" with no rule text (C-10). [CITED: search excerpt naming 17 CFR 230.255] / [ASSUMED: scope decision]

<!-- section: data room law done -->

## 5. Privacy: what may never be in an email, and attachment limits

### 5.1 Email notices hold no message content (D-01)

The notice is built from fixed wording only, so no sponsor or investor text can reach an inbox through it:

| Notice (new phase 13 renderer kinds, added after 13-11 merges) | To | Subject | Body | Never contains |
|------|----|---------|------|----------------|
| `message_notice` | investor | "<Firm>: you have a new message" | "<Firm> sent you a message in your investor portal." + one button "Open your messages" (the inbox link in server mode; the portal sign-in in the preview) + the phase 13 footer | The message text, its subject, attachment names or count, the author's name, the offering's name, amounts |
| `message_received` | the firm's notification address | "<Firm>: <investor or prospect name> sent a message" | "Open it on the Messages page." + console link | The message text, attachment names |
| `room_invite` | prospect | "<Firm>: documents for <offering>" | One line, one button "Review the documents", the expiry sentence | Nothing beyond the firm, offering name and link |
| `room_activity` (optional, C-07) | the firm's notification address | "<Firm>: <prospect> agreed to the NDA" or "... indicated interest" | Link to the Data room page | The amount indicated |

- A broadcast sends one notice per recipient, each with the same fixed text.
- **Coalescing (C-06):** one notice per new message, except that no second notice goes to the same investor for the same thread while an earlier notice's message is still unread and less than one hour old. Prevents a burst of emails from a conversation; the next unread message after that hour gets a notice.
- **Every notice is transactional** (it tells an existing investor or a prospect the firm invited that something is waiting in their account), so no unsubscribe is required by CAN-SPAM; the investor's portal preference may still turn message notices off (they then see the unread count only). [ASSUMED: CAN-SPAM transactional classification; phase 13 C-02 treats only offering news and invitations to new offerings as possibly commercial] The `room_invite` to a prospect who is not yet an investor is the borderline case: treat it as possibly commercial (postal address in the footer, one-click unsubscribe), as phase 13 does for invitations to a new offering (13-CONTEXT C-02).
- **Links:** the inbox link is a bearer link (whoever has the email can open that investor's inbox, as with invitations today). The email says "This link opens your messages. Do not forward this email." [ASSUMED: wording] Phase 15 replaces it with signed-in sessions.

### 5.2 Message bodies: screening, not storage of secrets

- Sponsor-to-investor messages that match the phase 13 shared patterns (`emails.js PATTERNS`: taxpayer numbers, routing and account numbers, passwords) are **refused** with one plain sentence: "Bank and taxpayer numbers are not sent in messages. Payment instructions are on the capital call." The reason is fraud, not only privacy: changed wire instructions in a message are the classic payment-diversion attack, and the capital call already carries the firm's wire box (portal.js `wireBox`). [ASSUMED: threat model]
- Investor-to-sponsor messages that match are **warned once** ("Do not send taxpayer or bank numbers in a message; your Account page is the place for them.") with "Send anyway" (D-30: nothing mandatory for investors; the server copy is sealed). C-11.
- The server never logs a body, a subject line or an attachment name; events carry ids and types only (taxdocs.mjs header practice). The help chatbot never reads messages (its context is the guide only).
- Data room prospect data is the minimum: name, email, relationship basis note, NDA assent (with IP address and browser in server mode, sealed), views, indications. Nothing else is asked.

### 5.3 Attachment limits

| Where | Limit (proposed) | Why |
|-------|------------------|-----|
| Each message attachment | 10 MB | The server's tax-document limit is `pdf: 10 * MB` (taxdocs.mjs:18); a phone uploading over mobile data; base64 inflation keeps one message call under the 16 KB-to-40 MB body caps already used |
| Per message | 5 files, 25 MB together | Same as an invitation submission's "25 MB together" (server/README.md, Investor calls) |
| File types | Investor: PDF, PNG, JPEG (checked by first bytes, as the server does for submissions); sponsor: those plus XLSX, CSV, DOCX (checked by first bytes or text); never ZIP, HTML, SVG or executables | Files sponsors need for investor relations; nothing that runs code or hides files |
| Data room document | 25 MB each, PDF only, up to 30 documents | The Documents upload limit is `25 * 1024 * 1024` (console.js:2366); PDF only because the watermark and the in-page viewer need PDF |
| Preview: bytes held in memory when the browser refuses its file store | New attachments refused past 50 MB held in memory this session, with "This browser is not keeping files. Connect your server or try a smaller file." | The file store's in-memory fallback has no cap except the recent-copy cache `RECENT_MAX` (64 MB, operations.js:399); an iPhone frame can run out of memory [ASSUMED: threshold; measure on the phone frame] |
| Preview: all attachments in this browser | A plain line on the Messages page past 200 MB in the file store: "This browser holds <n> MB of message files." | Browser quotas differ; no silent failure [ASSUMED: threshold] |
| Server: watermarking time | Measured by the plan on a 25 MB PDF before the limit is fixed | pdf-lib loads the whole file in memory; a slow stamp on a large memorandum is a real risk (Pitfall 4) |

No attachment ever goes in an email (13-CONTEXT C-12).

<!-- section: privacy done -->

## 6. Validation Architecture

`workflow.nyquist_validation` is `true` in .planning/config.json, so this section is required.

### 6.1 Test framework

| Property | Value |
|----------|-------|
| Server framework | `node --test` (built-in runner); `"test": "node --test"` [VERIFIED: server/package.json] |
| Server tests today | **403**, all passing, measured this session on 5b85eee (`# tests 403 / # pass 403 / # fail 0`) |
| Model checks (browser files, no browser) | Node scripts that load `assets/js/*.js` into a `vm` context with a stub `window.CVPortal`, as phase 10 and 12 model checks do (e.g. `.planning/phases/12-report-builder/checks/reports-model.js`, `.planning/phases/10-*/checks/tax-math.js`) |
| Browser checks | Playwright scripts reusing `.planning/phases/06-*/checks/lib.js`, `no-network.js` (connect-src blocked), `safari-finish.js`, `ways-out.js`, `email-dialog.js`; run through the shared queue SCRATCH/exec-011/heavy.sh; 390x844 touch and 1280x800 inside the sandboxed iframe |
| Phase checks folder | `.planning/phases/14-portal-messaging-and-data-room/checks/` (new) |
| Quick run | `cd server && node --test test/inbox.test.mjs test/dataroom.test.mjs` and `node .planning/phases/14-portal-messaging-and-data-room/checks/inbox-model.js` |
| Full suite | `cd server && node --test`, then `.planning/checks/gate-reference.sh` with the exact `GATE_SERVER_TESTS` |

### 6.2 Proof per behaviour (what each check asserts; RED before, GREEN after)

1. **Append-only record** (model, `checks/inbox-model.js`): no exported function edits or deletes a message; after 50 random sends, replies, broadcasts and corrections, `verify()` is ok; changing one body, one attachment SHA-256 or one time breaks the chain at exactly that `seq`; a correction leaves the original byte-identical. Same for the data room's assents, views and indications (`checks/dataroom-model.js`). RED: the functions do not exist.
2. **Threads per investor and per offering**: sending to (investor A, offering X) twice uses one thread; (A, X) and (A, general) are two; an investor never sees another investor's thread (portal render for B contains none of A's text); a broadcast to "Investors in X" creates exactly one message per holder of X, one `broadcastId`, and B's reply lands only in B's thread.
3. **Read status**: opening a thread sets `readAt` only on the other side's messages, once; unread counts in both menus and the Notifications page drop accordingly; read times are not part of the hash.
4. **Attachments** (model + browser): 10 MB accepted, 10 MB + 1 byte refused with the sentence; 6th file refused; a file named `.pdf` whose first bytes are not `%PDF-` refused; investor XLSX refused, sponsor XLSX accepted; bytes stored as `{ type, bytes }` (never a Blob) and read back byte-identical (SHA-256 equal); with IndexedDB refused (sandbox), the 50 MB in-memory cap message appears.
5. **Email notices** (server unit + golden): kinds `message_notice`, `message_received`, `room_invite`, `room_activity` rendered by `emails.js` against goldens; a body made of an SSN, an EIN, a valid ABA routing number, a 12-digit account number, `password: hunter2` and an attachment named `Smith SSN 123-45-6789.pdf` produces a notice in which **none** of those strings appear (subject, text, HTML); the phase 13 banned-word list passes (no vendor or platform name, no "basic"); coalescing: three messages in ten minutes to one unread thread send one notice; preview path: toast/dialog has "(simulated in this demo)" and a `simulated` sent-log entry, zero requests.
6. **Screening**: sponsor message with a routing and account number refused (console sentence and server 422, nothing stored or sent); investor message with an SSN shows the warning, "Send anyway" stores it sealed.
7. **Server inbox** (`server/test/inbox.test.mjs`): token returned once, only SHA-256 stored, constant-time lookup; `X-Inbox-Token` opens only `/v1/my-inbox*` for that investor (another investor's attachment id answers 404); the token is refused on sponsor routes even with `API_TOKEN`; bodies and attachments sealed (the store file contains no body text); no `DELETE` route answers anything but 404/405; `updates?since=` returns each investor message exactly once in order; a rotated link stops the old one (401); body caps answer 413; rate limit 429.
8. **Server data room** (`server/test/dataroom.test.mjs`): a 506(b) room refuses a prospect without the basis (422) and never issues a shareable link; a 506(c) room may; `GET /v1/room/documents/:doc` refuses before the NDA (403) and after it returns a PDF whose every page carries the prospect's name and email (extract text with the shipped writer or by searching the content stream) and whose bytes differ from the original; hidden documents answer 404 to the prospect and stay in the sponsor's record; views and indications recorded and returned by `activity?since=`; an indication with bank-like fields is refused; nothing is deleted.
9. **506(b) gate in the console** (browser): a 506(b) offering's room shows no shareable link; inviting a prospect without the basis keeps the button disabled with the reason; the sign-up link dialog for a 506(b) offering has no "website" wording (RED today: diy.js:165 says "on your website").
10. **NDA** (browser + model): the box is not pre-ticked; documents are not listed before assent; assent records version, typed name, time; changing the NDA text changes the version and asks again; the e-signed path produces a completed envelope with the certificate, and the room opens after it.
11. **View tracking and watermark** (browser): opening a document draws pages in the page (no browser PDF viewer), records an open with pages and seconds; download is absent when the room says off; when on, the downloaded file carries the watermark text.
12. **Indication of interest**: the form carries the legend; amount optional; change and withdraw recorded, never deleted; the offering's pipeline total changes and "raised" and the 506(b) count do not; "Invite to subscribe" opens the normal invitation with name and email prefilled.
13. **Export**: the zip opens; `messages.csv` row count equals messages; each attachment's SHA-256 matches the manifest; `README.txt` says "Chain verified"; a tampered workspace gives "Chain broken at entry N"; the export is in the change log.
14. **White label and words**: a sweep of every new screen's rendered text and both new guide entries for vendor names, library names, the product name and "basic" (help-guide test patterns plus the phase 13 banned list).
15. **Phone and honesty**: every new page at 390x844 and 1280x800 in the sandboxed frame with connect-src blocked: zero requests, no horizontal overflow, a way out on screen (ways-out.js), dialogs scroll (email-dialog.js), the "kept in this browser only" line present with no server and absent with one.
16. **Managed edition unchanged**: the managed console and portal render byte-identical menus and pages (the views carry `edition: 'diy'`); status-math C-03 slice guard passes.
17. **Owner checkpoint (not automatable)**: on his iPhone in the preview, the owner sends a message as the firm, reads and replies as the investor, sees "Read", opens a data room as a prospect, agrees to the NDA, views a watermarked document, indicates interest, and downloads both records. Live email waits for phase 13's live checkpoint.

### 6.3 Phase requirements -> test map

| Req | Behaviour | Type | Command | Exists? |
|-----|-----------|------|---------|---------|
| MS-01 | threads, append-only, chain, corrections | model | `node .planning/phases/14-*/checks/inbox-model.js` | Wave 0 |
| MS-02 | attachments limits, types, bytes | model + browser | `inbox-model.js`, `checks/messages-flow.js` | Wave 0 |
| MS-03 | read status, unread counts | model + browser | same | Wave 0 |
| MS-04 | broadcast, private replies | model | `inbox-model.js` | Wave 0 |
| MS-05 | Messages pages, phone | browser | `node .planning/phases/14-*/checks/messages-flow.js` | Wave 0 |
| MS-06 | email notices, no content, coalescing, simulated | unit + golden | `cd server && node --test test/inbox-notice.test.mjs` | Wave 0 |
| MS-07 | server inbox routes and tokens | unit | `cd server && node --test test/inbox.test.mjs` | Wave 0 |
| MS-08 | record export | model + browser | `checks/record-export.js` | Wave 0 |
| MS-09 | screening | model + unit | `inbox-model.js`, `inbox.test.mjs` | Wave 0 |
| MS-10 | data room model and console page | model + browser | `checks/dataroom-model.js`, `checks/dataroom-flow.js` | Wave 0 |
| MS-11 | 506(b) gate, 506(c) link, sign-up link wording | model + unit + browser | `dataroom-model.js`, `dataroom.test.mjs`, `dataroom-flow.js` | Wave 0 |
| MS-12 | NDA click-through and e-signed | model + browser | `dataroom-model.js`, `checks/nda-esign.js` | Wave 0 |
| MS-13 | views, watermark, download control | unit + browser | `dataroom.test.mjs`, `checks/watermark.js`, `dataroom-flow.js` | Wave 0 |
| MS-14 | indications of interest, invite to subscribe | model + browser | `dataroom-model.js`, `dataroom-flow.js` | Wave 0 |
| MS-15 | server data room routes | unit | `cd server && node --test test/dataroom.test.mjs` | Wave 0 |
| MS-16 | white label, honesty, no network, phone, managed unchanged, guide, gate, owner check | browser + gate | `checks/phase14-honest.js`, reference gate | Wave 0 |

### 6.4 Sampling

- Per task commit: the plan's own model check or server test file.
- Per wave merge: `cd server && node --test` plus the phase 14 checks of the merged plans.
- Phase gate: the full reference gate on the merged tree with the phase 14 lines added, the preview built, the owner-path walkthrough on the phone frame, then the owner's check. Server count: 403 plus each plan's declared delta (each plan states its exact count in its header and SUMMARY, as phase 13 plans do).

### 6.5 Wave 0 gaps

- `.planning/phases/14-portal-messaging-and-data-room/checks/` with `inbox-model.js`, `dataroom-model.js`, `watermark.js` (node), `messages-flow.js`, `dataroom-flow.js`, `nda-esign.js`, `record-export.js`, `phase14-honest.js` (browser, reusing 06's `lib.js`)
- `server/test/inbox.test.mjs`, `server/test/inbox-notice.test.mjs`, `server/test/dataroom.test.mjs`; goldens under the phase 13 fixtures folder for the four new kinds
- A small fixture PDF (two pages, standard fonts, no personal data) committed for watermark tests; a 25 MB synthetic PDF generated at test time (never committed) for the timing measurement
- No framework install needed.

<!-- section: validation done -->

## 7. Requirements and recommended plan breakdown

<phase_requirements>
### 7.1 Phase Requirements (MS-01 ... MS-16)

| ID | Requirement | Traced to | Research support |
|----|-------------|-----------|------------------|
| MS-01 | Threads per investor and per offering (plus one general thread per party), messages with author, time, body (up to 4,000 characters), append-only: no edit, delete or unsend anywhere; corrections as linked new messages; every message hash-chained (`seq`, `prev`, `hash`) with a verifier. | D-01 "threads per investor and per offering", "kept for the record" | 2.2, 3.2 |
| MS-02 | Attachments: up to 5 per message, 10 MB each, 25 MB together; investor PDF/PNG/JPEG, sponsor also XLSX/CSV/DOCX, checked by first bytes; bytes in the browser file store as bytes (preview) or sealed blobs (server); SHA-256 per file; the in-memory cap when the browser refuses its store. | D-01 "attachments" | 5.3, 2.1 file store |
| MS-03 | Read status both ways (`readAt` shown as "Read <time>"), unread counts on the console and portal menus and on the console's Notifications page. | D-01 "read status" | 2.2 |
| MS-04 | Sponsor broadcast to all investors, one offering's investors or picked investors (the Notices picker reused): one message per recipient thread with one broadcast id; replies private; "Read by N of M". | D-01 "sponsor broadcast" | 2.2 |
| MS-05 | Console "Messages" page and portal "Messages" page (self-serve edition only), lean, white label, working with no server from the workspace and file store, with the one honest line about where messages are kept; phone and desktop. | D-01; carried preview rule | 2.3 |
| MS-06 | Email notice of each new message through the phase 13 renderer (`message_notice`, `message_received`): fixed wording, no message text, subject, attachment names, author or amounts; coalesced per unread thread per hour; sent-log entry; "(simulated in this demo)" with no server; the investor's preference can turn notices off. | D-01 "an email notice of each new message (never the message text...)" | 5.1 |
| MS-07 | Server inbox (`server/lib/inbox.mjs`): sponsor routes behind the sponsor gate, investor routes with `X-Inbox-Token` only, token hashed and scoped, sealed bodies and attachments, `updates?since=` for the console's 60-second merge, link rotation, never deleted, caps and rate limits. | D-01 on real devices; tax-document pattern | 2.4 |
| MS-08 | "Download the message record" (whole workspace, one investor, one offering) and "Download the data room record": zip with CSV files, attachments and documents, README, SHA-256 manifest, chain verified or the first break named; each export in the change log. | D-01 "kept for the record"; CONTEXT "no deletion, export" | 3.2 |
| MS-09 | Message screening: sponsor messages with bank or taxpayer number shapes refused (console sentence, server 422); investor messages warned once with "Send anyway". | Privacy; payment-diversion fraud | 5.2 |
| MS-10 | Data room per offering (self-serve): NDA, documents (PDF, 25 MB each, up to 30), hide never delete, prospects with access end or expiry, download off or watermarked; console "Data room" page with activity per prospect and per document. | D-02 | 2.2, 4.5 |
| MS-11 | 506(b) rooms: personal links only, the relationship basis recorded per prospect before a link exists (server refuses without it), warning for a basis that starts with the offering; 506(c) rooms may also have a shareable link; Regulation A not offered; the offering sign-up link's dialog for a 506(b) offering no longer suggests a website. | CONTEXT data room bullet; 506(b) law | 4.1, 4.2, 4.6 |
| MS-12 | NDA gate: click-through (full text, typed name, unticked box, version hash, time, IP and browser in server mode) by default; e-signed NDA as a per-room option through the existing e-signature, with its certificate and signed copy. | D-02 "NDA-gated documents"; CONTEXT "reuse the built-in e-signature" | 4.4 |
| MS-13 | View tracking per prospect and document (opens, pages, seconds; server counts serves too) and a watermark on every page (name, email, date, "Confidential", view id) from one shared module, stamped on the server in server mode; pages drawn in the page; the privacy line on the room. | D-02 "view tracking"; CONTEXT watermarking, download control | 4.5, 2.4 probe |
| MS-14 | Indications of interest: optional amount and class and note, the non-binding legend, change and withdraw recorded; a pipeline total per offering kept apart from raised and from the 506(b) count; "Invite to subscribe" hands off to the existing invitation. Prospect questions use the same thread model. | D-02 "soft commitments"; "with messaging" | 4.3 |
| MS-15 | Server data room (`server/lib/dataroom.mjs`): sponsor and `X-Room-Token` routes as in 2.4, NDA before documents (403), watermarked document per prospect, views and indications recorded, activity for the console, nothing deleted. | D-02 on real devices | 2.4 |
| MS-16 | Proof: white-label and word sweep, zero requests with no server, phone frame, ways out, managed edition unchanged, guide entries within the byte budget, server count declared per plan, phase checks in the reference gate, preview built and walked, then the owner's check. | CLAUDE.md; AUTOPILOT | 6.2 |
</phase_requirements>

### 7.2 Recommended plans, waves and file ownership

**Ownership rule (as phase 13):** a file is edited by one plan per wave; widely shared files (`console.js`, `portal.js`, `diy.html`, `portal.html`, `esign.js`, `diy.js`, `server/index.mjs`, `assets/js/emails.js`, the help guide, the preview build list) each get **one owner plan** in this phase, and that plan waits while another phase's plan editing the same file is running. New files are created by one plan and only edited later by plans that name them.

**Loading:** `diy.html` and `portal.html` get **one** new line each, `<script src="assets/js/inbox.js"></script>` after `taxdocs-ui.js`; `inbox.js` loads its parts on demand (`inbox-ui.js`, `dataroom.js`, `dataroom-ui.js`, `watermark.js`) with the same part loader `taxdocs-ui.js` uses (taxdocs-ui.js:155-186, a placeholder view until the part loads, taxdocs-ui.js:835). `index.html` (managed edition) gets nothing.

| Wave | Plan | Delivers | Owns (edits) | Depends on / waits |
|------|------|----------|--------------|--------------------|
| 1 | **14-01 Inbox model** | `NS.inbox`: threads, messages, broadcast fan-out, read state, corrections, hash chain and `verify`, attachment rules (limits, first-byte types), the export builder (CSV rows, README text, manifest via `NS.audit.zip`), the screening hook (uses `NS.emails.screen` when present); part loader in `inbox.js` | `assets/js/inbox.js` (new), `checks/inbox-model.js` (new) | none; can start now |
| 1 | **14-02 Watermark and data room model** | `assets/js/watermark.js` (UMD, browser and `createRequire` on the server, stamps with the shipped writer); `NS.dataroom`: rooms, documents with hide, prospects, the 506(b) basis rule by `NS.eligibility.regime`, click-through assent record, views, indications with withdraw, pipeline totals, room record export rows | `assets/js/watermark.js`, `assets/js/dataroom.js` (new), `checks/dataroom-model.js`, `checks/watermark.js` (new), a two-page fixture PDF | none; can start now |
| 1 | **14-03 Server inbox module** | `createInbox({ env, store, vault, notify, now, limited })` with every route in 2.4, sealed records, tokens, `updates?since=`, rotation, caps; tested by mounting it on a test server inside the test file (not yet in `index.mjs`); notices through an injected `notify` (no mailer yet) | `server/lib/inbox.mjs`, `server/test/inbox.test.mjs` (new) | none; can start now |
| 2 | **14-04 Messages screens and wiring** | `inbox-ui.js`: console Messages page (list, thread, composer, attachments, broadcast with the picker, read times, unread counts, export button), portal Messages page, the honest no-server line, simulated notices; wiring: the two menu lines (Messages under Operate, Data room under Raise; hidden until the views exist, console.js:108), the Notifications count, the portal menu line, the script line on both pages, the preview build file list for every phase 14 file | `assets/js/inbox-ui.js` (new), `assets/js/console.js` (menu lines and one count hook only), `assets/js/portal.js` (one menu line), `diy.html`, `portal.html`, `.planning/tools/preview/` file list, `checks/messages-flow.js` | 14-01; waits while a phase 8/10/11/12/13 plan editing console.js, portal.js or the pages is running |
| 2 | **14-05 Server data room module** | `createDataRoom(...)` with every route in 2.4, the 506(b) refusal, NDA before documents, per-prospect server stamping through `watermark.js`, views, indications, activity, hide; the 25 MB stamping time measured and the limit fixed from it | `server/lib/dataroom.mjs`, `server/test/dataroom.test.mjs` (new) | 14-02 |
| 3 | **14-06 Data room screens** | `dataroom-ui.js`: console Data room page (open a room for a 506(b)/506(c) offering, NDA text, documents, prospects with the basis form, activity, pipeline, download setting, "Invite to subscribe" hand-off, "Open as this prospect"), prospect room page (NDA click-through, document list, in-page viewer with views and watermark, indication form with the legend, questions), preview mode | `assets/js/dataroom-ui.js` (new), `checks/dataroom-flow.js` | 14-02, 14-04 |
| 3 | **14-07 E-signed NDA and the 506(b) sign-up link** | one `esign.js` addition so a prospect signer (no investor record) signs inside the room (`embed` by signer id), the room's e-sign option wired to it; `diy.js` join-link dialog wording for 506(b) offerings | `assets/js/esign.js` (one function and its export), `assets/js/diy.js` (dialog text), `checks/nda-esign.js` | 14-06's room page contract (can stub); waits for 13-08 (owns `esign.js` and `diy.js` in phase 13) to merge |
| 4 | **14-08 Server mode: mounting and notices** | `index.mjs` mounts inbox and data room with the token dispatch (`x-inbox-token`, `x-room-token`) beside the invitation and tax-document ones; the four notice kinds in `emails.js` with goldens; the server sends notices through the phase 13 mailer and sent log, with coalescing; README sections "Portal messages" and "Data room" | `server/index.mjs`, `assets/js/emails.js` (kinds only), server goldens, `server/README.md`, `server/test/inbox-notice.test.mjs` (new) | 14-03, 14-05; phase 13's 13-01, 13-03, 13-04, 13-11 merged |
| 4 | **14-09 Console and portal on the server** | `inbox-ui.js` and `dataroom-ui.js` call the server when connected (`NS.integrations.api`), the 60-second merge of messages, reads, views and indications (own timer, invitations.js untouched), the investor's `#inbox-<token>` page and the prospect's `#room-<token>` page (standalone views, as taxlink.js:353), screening sentences on both sides | `assets/js/inbox-ui.js`, `assets/js/dataroom-ui.js`, `checks/server-flow.js` (new) | 14-04, 14-06, 14-08 (route contract) |
| 5 | **14-10 Record export screens and the guide** | the two "Download ... record" buttons wired to the model exports, `checks/record-export.js`; guide entries (section 7.3) and `skip` lines, rebuilt `help-guide.mjs`, regenerated preview help data | `assets/js/inbox-ui.js`, `assets/js/dataroom-ui.js` (buttons only), `server/help/guide.md`, `server/lib/help-guide.mjs`, `.planning/tools/preview/help-data.js` | 14-09; the guide-trim quick task merged (section 7.3) |
| 6 | **14-11 Proof and the owner's check** | `checks/phase14-honest.js`, white-label sweep, gate lines and exact `GATE_SERVER_TESTS`, full gate on the merged tree, preview built and walked on the phone frame; checkpoint: the owner's iPhone walk (6.2 item 17) | `.planning/phases/14-*/checks/*`, `.planning/checks/gate-reference.sh` (lines only) | all (not autonomous) |

**Parallelism:** waves 1 (three plans) and 2 (two) can start now, before phase 13 finishes, because they touch no phase 13 file; wave 3's 14-07 and wave 4 wait on phase 13 merges. Each plan sized to about 100k tokens; 14-04 and 14-06 are the largest (screens) and may split into console and portal halves if the planner measures them over budget (each half owning its own new file).

**Shared files and their single phase 14 owner:** `console.js` 14-04 · `portal.js` 14-04 · `diy.html` / `portal.html` 14-04 · preview file list 14-04 · `esign.js` 14-07 · `diy.js` 14-07 · `server/index.mjs` 14-08 · `emails.js` 14-08 · `server/README.md` 14-08 · help guide (`guide.md`, `help-guide.mjs`, preview `help-data.js`) 14-10 · `gate-reference.sh` 14-11. Not edited at all: `invitations.js` (the "Invite to subscribe" hand-off calls its existing public entry; the planner traces the function name), `onboarding.js`, `operations.js`, `audit.js`, `app.js`, `server/lib/store.mjs` (new collections are created by the modules: `data.inbox = data.inbox || {}` style lines belong in store.mjs, so either 14-03 owns one line there or the module keeps records under an existing generic collection; the planner picks, C-12).

### 7.3 Help guide entries: bytes per entry, as small as possible

Measured now: sponsor guide **46,698 of 48,000** bytes (1,302 left on 5b85eee, already promised to 11-13, 12-06, 08-18 and later plans, AUTOPILOT "Choice recorded ... help guide room": about 480 bytes remain after those, for 11-15, 11-16, 10-11, 12-08, 13-09 and 13-10); investor guide **15,436 of 20,000** (4,564 left). An entry costs its header, about **66 bytes** for a console page (`## The console page "Messages"` and `In the menu: Operate, then Messages.`, measured on the Notices entry), plus its text and two newlines. `skip` lines are not sent (measured: not in `GUIDE.sponsor` or `GUIDE.investor`).

| Entry | Audience | Budget (whole entry, bytes) | Text budget | Must say (names exactly as on screen) |
|-------|----------|-----------------------------|-------------|----------------------------------------|
| `console-messages` | sponsor | **300** | about 230 | where it is; one thread per investor and offering; "New broadcast"; "Read"; messages cannot be changed or deleted, "Correct" adds one; "Download the message record" |
| `console-dataroom` | sponsor | **340** | about 270 | open a room for a 506(b) or 506(c) offering; NDA; for 506(b) record how you know each prospect before inviting; views and indications; "Invite to subscribe" |
| `messages` | investor | **280** | about 215 | write to the firm about an offering or in general; attachments; you get an email when a message arrives, without its text |
| `room` | investor (prospect page) | **300** | about 235 | agree to the NDA to open the documents; views are recorded; an indication of interest is not a commitment and can be withdrawn |
| `inbox`, `room` link placeholders, `message-<id>` sub-routes | - | `skip` lines (0 bytes sent) | - | the reason in one line each |

**Sponsor total: 640 bytes**, which the sponsor guide does not have. The orchestrator already chose (AUTOPILOT, 2026-11-20) a guide-trim quick task that shortens existing wording only; 14-10 waits for it and the trim must free at least 640 bytes beyond the earlier plans' needs, or the orchestrator decides again (C-13). Investor total 580 bytes fits.

<!-- section: plans done -->

## 8. Choices the orchestrator must make (each with a recommended default and why)

Per CLAUDE.md, each question goes to the owner with a push notification; after 15 minutes the default is taken and recorded in 14-CONTEXT.md. C-01 is the only one that needs his money decision; the others are product defaults he can change at his check.

| # | Choice | Recommended default | Why |
|---|--------|---------------------|-----|
| **C-01** | Build in-house or use an outside chat service and data room | **In-house, $0** | No outside option fits $0 past a free tier (chat $279-$499 a month, data rooms $30-$300 a month per sponsor, section 1); none keeps the record we need, ties indications to subscriptions or enforces the 506(b) rule; each adds a processor of investor data and breaks the no-network preview |
| **C-02** | How an investor opens their inbox on their own device before phase 15 brings sign-in | **A personal link in each notice (`#inbox-<token>`), scoped to that investor's inbox, valid 90 days from issue, re-issued when expired, revocable from the console ("Send a new link")**; phase 15 replaces it with sign-in | Same proven pattern as invitations and tax documents; without it server-mode messaging cannot reach investors until phase 15; the risk (a forwarded email opens the inbox) is said in the email and is the same as for invitation links today |
| **C-03** | 506(b) rooms | **Personal links only; the relationship basis recorded per prospect before a link exists; server refuses without it; a basis dated on or after the room's opening warns, does not block** | The law requires no general solicitation and a substantive, pre-existing relationship is the usual proof (4.1); the record is the sponsor's evidence; blocking the sponsor's own judgment would be a legal conclusion the product cannot make |
| **C-04** | NDA method | **Click-through by default (typed name, unticked box, version hash, time, IP in server mode); e-signed NDA as a per-room option (plan 14-07)** | Clickwrap with affirmative assent and a full record is generally enforced (4.4) and takes one screen on a phone; the e-signed option reuses the built-in e-signature for sponsors whose counsel wants a signed PDF |
| **C-05** | Retention and deletion | **Nothing in phase 14 is ever deleted by the product; no retention setting in this phase; server keeps every record at least seven years (in practice indefinitely); hidden, never removed, for data room documents** | "Kept for the record" (D-01); Rule 204-2's five years plus margin for sponsors that are or become registered (3.1); a deletion setting can come with phase 15's data minimization if counsel asks |
| **C-06** | Notice cadence and refresh | **One email per new message, coalesced: no second notice for the same unread thread within one hour; console and open investor pages refresh every 60 seconds** | Avoids an email per line of a conversation; 60 seconds is the console's existing invitation poll (invitations.js:38) |
| **C-07** | Emails to the firm about data room activity | **On: one email when a prospect agrees to the NDA and when they indicate or change interest (no amount in the email); views are not emailed** | The sponsor needs to act on these; views are frequent and belong on the page |
| **C-08** | Legends on the room and the indication form | **Use the drafted sentences (4.3, 4.5) marked "To be confirmed" on screen until counsel or the owner confirms** | AUTOPILOT work-around rule; the wording carries legal weight |
| **C-09** | Fix the offering sign-up link for 506(b) offerings | **Yes, in 14-07: for 506(b) the dialog says it is for people the firm already knows, never a website or public post** | Today's text ("on your website") invites general solicitation for a 506(b) offering (diy.js:165); fixing it is one sentence |
| **C-10** | Exemptions offered a data room | **506(b) and 506(c); "other" with no rule text; Regulation A not offered in this phase** | Regulation A testing-the-waters has its own legends and filing (Rule 255); building it is outside this phase's need |
| **C-11** | Investor messages with taxpayer or bank number shapes | **Warn once, "Send anyway" allowed; sponsor messages with them refused** | D-30 (nothing mandatory or blocked for investors); the server copy is sealed; sponsor refusal stops payment-diversion fraud (5.2) |
| **C-12** | Where server records live | **Two new store collections (`inbox`, `rooms`) with one line each in `server/lib/store.mjs`, owned by 14-03** | Matches how 10-12 added `taxdocs` (store.mjs:20); keeps records separate from the invitation data that is deleted after import |
| **C-13** | Sponsor guide room (640 bytes needed) | **Wait for the guide-trim quick task already chosen on 2026-11-20 and require it to free the extra 640 bytes; do not raise the 48,000 cap** | The recorded choice's reason still holds: the whole guide is sent with every help question and the paid help test was measured at this size |
| **C-14** | Editions | **Self-serve only (`edition: 'diy'` on every new view); managed edition unchanged** | AUTOPILOT: managed unchanged unless a plan says otherwise; the self-serve portal is the funnel |
| **C-15** | Broadcast versus Notices | **Broadcast lives on the Messages page (investors can reply privately); Notices stay as they are this phase** | No change to a working page; merging them belongs to launch step 12 (reorganize) |
| **C-16** | Where a prospect lives | **On the room (`w.rooms[].prospects`), not in `w.investors`, until "Invite to subscribe" creates the normal invitation** | Investor counts, the register, Form D and the 506(b) count read `w.investors` and requests; a prospect must not appear in them |
| **C-17** | Attachment limits and types | **As in 5.3: 10 MB each, 5 per message, 25 MB together; investor PDF/PNG/JPEG; sponsor adds XLSX/CSV/DOCX; data room PDF 25 MB each, 30 per room** | Matches the server's existing limits and the phone's memory; nothing executable |
| **C-18** | Data room download | **Off by default; per room, the sponsor may allow watermarked download** | Viewing in the page with a watermark deters copying; the console states that nothing stops a screenshot |

<!-- section: choices done -->
