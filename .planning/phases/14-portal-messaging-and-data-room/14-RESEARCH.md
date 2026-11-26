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
