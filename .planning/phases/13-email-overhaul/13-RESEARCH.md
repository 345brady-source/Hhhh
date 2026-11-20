# Phase 13: Email overhaul - Research

**Researched:** 2026-11-20
**Domain:** Transactional email (templates, white label, deliverability, sending providers) for a zero-dependency Node integration server and a no-server browser preview
**Confidence:** HIGH for the in-repo inventory (every file opened this session); MEDIUM for provider prices (vendor pages fetched this session, prices change); see per-claim tags.

<user_constraints>
## User Constraints

No 13-CONTEXT.md exists (discuss-phase has not run). The binding inputs are the owner's own decisions recorded elsewhere, copied verbatim:

### Locked Decisions (owner, from .planning/phases/01.4-*/01.4-RESUME.md and .planning/ROADMAP.md)
- "5a. Email system overhaul (owner, 2026-11-15): reliable delivery through an outside email provider (options and costs to the owner first), white-label sending from the sponsor's domain, branded templates for every portal email, delivery tracking and bounces." (01.4-RESUME.md line 101)
- ROADMAP Phase 13 goal: "Every email the portal and its server send is reviewed and rebuilt into one system: one template set in the firm's branding (white label: the firm's name and colors, never the platform's or a vendor's), plain-text and HTML parts, clear subject lines, one action per message, the investor's or sponsor's name, mobile layout, unsubscribe and notification preferences where the law requires them (CAN-SPAM for non-transactional mail), deliverability basics the sponsor's sending domain needs (SPF, DKIM, DMARC guidance), a preview of every message in the console, a sent log per investor, and the server's mail path (server/lib/mail.mjs) using it; no message holds a taxpayer number, password or bank number; works with the server's existing mail settings and stays honest in the no-server preview ("simulated in this demo"). Nothing is called ready before the owner has checked it."
- Password reset gap (01.4-RESUME.md line 168): "'Forgot your password?' only shows a placeholder message (assets/js/portal.js, no reset email is sent). To build with the security step (step 10) or the email overhaul (step 8), whichever comes first; the guide promises no email until then."
- AUTOPILOT.md standing rules: white label (no vendor, model or library names in anything a sponsor or investor sees; the word "basic" never appears); nothing mandatory for investors (D-30); managed (Carrow & Vale) edition unchanged unless a plan says otherwise; no fetch()/XHR on any path that must work without a server; checks run at 390x844 in a sandboxed iframe with connect-src blocked; RED-first; owner has no budget for monthly fees, so a $0 path comes first; outside services are presented with cost, accuracy, speed and trade-offs before building in-house.
- Owner, 2026-11-20 (AUTOPILOT.md): "work around whatever bullshit you think you need me for" - owner inputs are worked around with a recorded assumption, marked "To be confirmed" where a sponsor would rely on it.

### Claude's Discretion
- Template engine shape, file layout, provider default, preference model, which missing messages to add (within "build only what the law or the task needs").

### Deferred Ideas (OUT OF SCOPE)
- Portal messaging / secure inbox (launch step 9, "5b") - phase 13 only reserves the "new message" notice template slot, it does not build messaging.
- The in-house reader (D-33).
- A server-side identity service (sign-up email verification, two-step sign-in) - security step (launch step 10). See Open Question 3 for the password reset email.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Use GSD agents for every step; test on real documents/messages; show the owner the real result; never call anything ready before the owner has checked it.
- Outside API or service that could do the job better: present it with cost, accuracy, speed and trade-offs before building in-house (section 3 below does this for email sending).
- Work economically; no waste; match effort to the situation.
- Do not cut corners; deliver market-ready work.
- Never put the owner's name, email or private details in a web search or outside request (honoured: all searches in this research are generic vendor/law queries).

<!-- Notes as I go: CONTEXT.md absent; owner decision 5a is the governing direction. -->

## Summary

The product sends or pretends to send **31 kinds of email**: 13 message types (28 wording variants) built and sent by the server's own SMTP client in `server/lib/mail.mjs` (invitations, resends, sponsor notifications and reminders, filing orders to staff), and 18 client-side paths that are either `mailto:` drafts or simulated toasts (manual invitations, co-investor sign-in, notices, capital calls, e-sign, tax document notices, forgot password, team invitations). The server's message layout is sound (firm-branded, text + HTML, escaped, no platform names, no taxpayer or bank data), but the system around it is not: the browser and the server keep **two separate template sets**, so the console's "The email your integration server sends" preview shows different words from what the server sends; one global `MAIL_FROM` is shared by every sponsor on a multi-sponsor server (a white-label and DMARC-alignment failure); nothing records delivery, bounces or complaints; notices, capital calls, e-sign and tax document notices have no server path at all, even though a bounced tax notice has a legal consequence (paper within 30 days under Rev. Proc. 2012-17); and the no-server preview uses five different "not really sent" wordings plus one toast that falsely says a team invitation was sent.

The fix is one shared renderer (`assets/js/emails.js`, loaded by the browser and by the server through `createRequire`, exactly as the server already loads `formd.js`), a per-sponsor sender on the sponsor's own verified domain, a sealed per-investor sent log with bounce/complaint states and suppression, one server route for the messages that have none, a console page previewing every message, investor preferences with one-click unsubscribe only where CAN-SPAM's commercial rules may apply, and one honest "(simulated in this demo)" sentence everywhere without a server.

For sending, Amazon SES is the only outside option that fits the owner's cost limit (about $1-2 a month at 40 sponsors x 300 messages, pay per use, no minimum, 10,000 domains per region, bounce/complaint events); Postmark is the quality runner-up at about $15-19 a month. SMTP stays the only send path, so the code is provider-neutral: changing provider changes settings, and a small adapter handles domain records and delivery events.

**Primary recommendation:** Build `assets/js/emails.js` first and make both the server and the console render through it; then add per-sponsor senders, the sent log and events (SES adapter, SMTP send path unchanged); prove every message with golden renders, banned-word and sensitive-pattern scans, preview-equals-server parity and phone-size checks; live delivery waits for one owner checkpoint (AWS account), marked "To be confirmed" until then.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Message wording and layout (all kinds) | Shared module (`assets/js/emails.js`, plain data) | Browser + API both call it | One source of truth; preview must equal what is sent |
| Sending, sender choice, refusal of unready domains | API / Backend (`server/lib/mail.mjs`) | Outside provider (SMTP) | Credentials and the sponsor's domain status live on the server |
| Domain records and status | API / Backend (`server/mailers/*`) | Console shows them | Provider API calls need secrets |
| Delivery events (bounce, complaint) | API / Backend (webhook) | Console shows status | Provider posts to the server; signature checked there |
| Sent log | API / Backend (sealed store) | Browser workspace (simulated/manual entries) | Addresses never stored in plain text on the server |
| Free-text screening (TIN/bank) | Browser (immediate message) | API (authoritative 422) | The server must not trust the browser |
| Preview of every message | Browser (console page) | - | Renders locally, works with no server |
| Preferences and unsubscribe | API / Backend (token route, honoured at send) | Browser (portal Account page) | Must work from the email with no sign-in |
| Honest no-server behaviour | Browser | - | No network allowed on that path |

## 1. Inventory: every email the product sends today

Every file below was opened with Read/sed this session. Line numbers are on tree c8b65e7.

### 1.1 Server mail path (server/lib/mail.mjs)

`createMailer({ env, store, vault, now, tls })` [VERIFIED: server/lib/mail.mjs:358-403] sends one message per call. Without `SMTP_HOST` the message is sealed into an encrypted outbox (`store.put('outbox', rec)`, readable at `GET /v1/outbox`) instead of being sent; with it, it builds a MIME message and sends it with its own zero-dependency SMTP client (`node:net`/`node:tls`, STARTTLS required unless `SMTP_ALLOW_PLAIN=1`, AUTH PLAIN/LOGIN, credentials scrubbed from errors, recipient addresses redacted from stored errors).

Settings read [VERIFIED: server/lib/mail.mjs:337-350, 361-366, 375], verbatim names: `SMTP_HOST`, `SMTP_PORT` (default `587`), `MAIL_FROM`, `SMTP_SECURE` (`'1'`; default `port === 465`), `SMTP_USER`, `SMTP_PASS`, `SMTP_ALLOW_PLAIN` (`'1'`), `SMTP_HELO` (default the domain of `MAIL_FROM`), `SMTP_TIMEOUT_MS` (default `20000`), `MAIL_REPLY_TO`, `OUTBOX_DAYS` (1-365, default `30`). Filings also needs `FILINGS_STAFF_EMAIL` [VERIFIED: server/lib/filings.mjs:85].

Message shape [VERIFIED: server/lib/mail.mjs:100-140]: `From: "<firm name>" <MAIL_FROM>`, `Reply-To: <firm support email>`, RFC 2047 subject, `Message-ID` on the `MAIL_FROM` domain, `multipart/alternative` (text + HTML, quoted-printable), `multipart/related` when an inline logo exists. Return values: `emailStatus: 'sent' | 'outbox' | 'failed'` [VERIFIED: server/lib/mail.mjs:355].

Shared layout `compose(firm, subject, parts)` [VERIFIED: server/lib/mail.mjs:436-468]: one HTML table layout (600 px max, firm primary colour bar, logo as `cid:logo@firm` or the firm name, greeting, paragraphs, quoted sponsor note, key/value rows, one button with the raw link under it, footer = legal name + disclaimer) and a plain-text twin built from the same parts. This is the right foundation; phase 13 extends it rather than replacing it.

Callers and every message type the server builds (kinds quoted verbatim from the `mailer.send` calls):

| # | Message | Trigger | Recipient | `kind` | Subject (verbatim template) | Built in |
|---|---------|---------|-----------|--------|------------------------------|----------|
| S-01 | Invitation, new investor (with or without offering) | `POST /v1/invitations` | investor | `'invitation'` | `${offering.name}: complete your investor onboarding` / `Complete your investor onboarding with ${firm.name}` | mail.mjs:473-496; sent invitations.mjs:1189-1196 |
| S-02 | Invitation, investor on file, new offering (optional included tax form) | same | investor | `'invitation'` | `${offering.name}: your subscription` | mail.mjs:548-563 |
| S-03 | Portal access link (investor added from paper) | same | investor | `'invitation'` | `${firm.name}: your investor portal` | mail.mjs:499-510 |
| S-04 | Tax form request (W-9 / W-8BEN / W-8BEN-E) | same | investor | `'invitation'` | `${firm.name}: your ${form}` | mail.mjs:515-527 |
| S-05 | Co-investor sign-in (sign one agreement) | same | co-investor | `'invitation'` | `${firm.name}: sign the subscription agreement for ${account}` | mail.mjs:533-545 |
| S-06..S-10 | Resend of S-01..S-05 (new link, old link dead; "started" variant for S-01/S-02) | `POST /v1/invitations/:id/resend` | investor / co-investor | `'invitation_resent'` | each prefixed `Reminder: ` | mail.mjs:566-593 |
| S-11 | Sponsor notification, 9 variants (onboarding finished; subscription finished; no subscription; portal opened; co-investor signed / did not sign; tax form returned / finished without signing / without a form) | `POST /v1/invite/complete` | sponsor `notifyEmail` | `'sponsor_notification'` (+ `Auto-Submitted: auto-generated`) | e.g. `${who} finished onboarding for ${offering}` | mail.mjs:647-707; invitations.mjs:1130-1137 |
| S-12 | Sponsor reminder before an un-imported submission is deleted, 4 variants | purge timer, once, a week before `SUBMISSION_DAYS` ends | sponsor `notifyEmail` | `'submission_reminder'` | `Waiting in your console: ${who}'s onboarding` (etc.) | mail.mjs:600-644; invitations.mjs:818-834 |
| S-13 | Filing order placed / changed | `POST` filing order | platform filing staff `FILINGS_STAFF_EMAIL` | `'filing_order'` | `Filing order ${id}: ${service}` / `Filing order changed ...` | filings.mjs:193-197, 235, 248 |

Server total: **13 message types, 28 wording variants.** Billing (server/lib/billing.mjs), help (server/lib/help.mjs) and sponsor accounts (server/lib/accounts.mjs) send **no email** [VERIFIED: grep of the three files this session, no `mailer` reference]. The verification package sends no message of its own; it rides on S-01/S-02 [VERIFIED: assets/js/package.js:1-8 header].

### 1.2 Client-side paths (assets/js), all no-server or simulated

| # | Message | Trigger | Recipient | What happens today | Built in |
|---|---------|---------|-----------|--------------------|----------|
| C-01 | Invitation (4 variants: offering new/existing, access, tax request) for the manual path, also shown as the preview of what the server sends | Invite / Email / Resend with no server | investor | Dialog with the message, Copy link, `mailto:` "Open in your email app", "Mark as sent" | invitations.js:277-314 (`emailFor`, `mailtoFor`), dialog 2425-2466 |
| C-02 | Co-investor sign-in email | co-investor added, no server | co-investor | Dialog + `mailto:` + Mark as sent | coinvestor.js:100-113 (`emailOf`) |
| C-03 | "emailed ... the agreement to sign (simulated in this demo)" | co-investor added to an account | co-investor | Toast only | coinvestor.js:345 |
| C-04 | Legacy activation email preview, subject `Activate your ${shortName} ${portalName}` | "Invitation" button (managed edition; self-serve is overridden by C-01 at invitations.js:2612-2617) | investor | Dialog; hint "In this demo no email is sent" | console.js:1030-1050, hint 915 |
| C-05 | Reminder | "Remind" (managed) | investor | Toast `Reminder prepared for ... No email is sent in this demo.` | console.js:1057-1060 |
| C-06 | Notice: quarterly report | Notices composer | investors | Posted to portal; toast `Email delivery is not connected in this demo.`; preview with footer "You receive this because you are an investor of record." | data.js:311-323, console.js:1611-1629, 1716-1727 |
| C-07 | Notice: new documents | composer, or "notify" on document publish | investors | same | data.js:317-321, console.js:2405-2412 |
| C-08 | Notice: custom message | composer | investors | same | data.js:322 |
| C-09 | Capital call notice | capital call issued | investors in the call | posted as a notice | operations.js:144, 610-625 |
| C-10 | Capital call reminder | reminder on a call | unpaid investors | posted as a notice | operations.js:143 |
| C-11 | Signature request (also: co-investor's address changed, re-sent) | envelope sent | each signer | event "Email sent" in envelope history; toast `... (simulated in this demo).` | esign.js:185-188, 684, 709, 993 |
| C-12 | Signature reminder | Remind on envelope | unsigned signers | history + toast `(simulated).` | esign.js:716-720 |
| C-13 | Envelope voided | Void | signers who received it | history + toast `(simulated).` | esign.js:731-734 |
| C-14 | Signer declined | investor declines | sponsor support address | history only | esign.js:1447 |
| C-15 | Next signer / completed copy to all parties | signature applied | next signer / all | toast only (`... emailed to all parties (simulated).`) | esign.js:1428 |
| C-16 | Tax document notice (Rev. Proc. 2012-17 s.7.01), subject `IMPORTANT TAX RETURN DOCUMENT AVAILABLE` | tax document delivered | investor | Copy + `mailto:` only; the server "link" hook is never set, so the connected path never exists | taxdocs.js:28-29, 693-706; taxdocs-ui.js:212-223, 601-611, 690-713 |
| C-17 | Forgot password | "Forgot your password?" | investor | Toast `A password reset link would be emailed to the address on file.` | portal.js:1266 |
| C-18 | Team member invitation and resend | Team page | team member | Toast `Invitation sent to ${email}` - nothing is sent and the toast does not say so | diy.js:324, 350, 369 |

Client total: **18 paths.** Grand total inventoried: **31 message types/paths (13 server, 18 client).**

`onboarding.js` sends nothing itself: its only mail-related lines are in-page promises ("A copy of the signed agreement is in your Documents now", onboarding.js:2593-2594) and support contact lines; the "(simulated in this demo)" at onboarding.js:578 is a code comment about screening. `filings*.js`, `package.js`, `withholding*.js`, `amlprogram.js` send nothing [VERIFIED: grep this session].

### 1.3 Findings: inconsistencies, missing messages, wording, white label, sensitive data

**F1 - The console preview misrepresents what the server sends (honesty bug, HIGH).** With a server connected the invitation dialog says "The email your integration server sends." (invitations.js:2438) but renders the browser's own `emailFor` text, which differs from the server's `invitationMessage`:

| Item | Browser `emailFor` (invitations.js:287-308) | Server (mail.mjs:479-494) |
|------|------|------|
| Subject, new investor with offering | `${t.name}: your invitation to invest in ${off.name}` | `${offering.name}: complete your investor onboarding` |
| Greeting | `Dear ${first},` (given name, handles "Shah, Anita") | `Dear ${investor.contact}` (full name) |
| Button, no offering | `Set up your account` | `Start your onboarding` |
| Co-investor button | `Open the agreement` (coinvestor.js:111) | `Review and sign` (mail.mjs:542) |
| Resend | same text as the first email (manual resend re-shows `emailFor`) | "Here is a new link ... Any earlier link we sent no longer works." |
| Sender | "`${sentBy} at ${t.name}`" | `invitation.senderName` only inside the quoted note label |

Root cause: two template sets (browser and server) written separately. Fix: **one template module** loadable by both (see Architecture).

**F2 - Missing server paths (the "connected" edition still cannot email):**
- Tax document notice (C-16): Rev. Proc. 2012-17 section 7 notice by email is the legal delivery step for electronic tax statements; today the sponsor must click Email per investor even with a server. Section 7.02 (a notice that comes back undeliverable → paper due within 30 days, already modelled at taxdocs.js:658) makes **bounce handling legally relevant**, not just nice-to-have.
- Investor notices C-06..C-10 (quarterly report, documents, custom, capital call, call reminder): posted to the portal only.
- E-sign C-11..C-15: all simulated; on the server path only the co-investor sign-in (S-05) is real.
- Investor confirmation after onboarding/subscription/signing: none exists, while the e-sign toast promises "the completed copy was emailed to all parties". The investor has no email record that their subscription was received.
- Team invitation (C-18), password reset (C-17), sign-up verification (diy.js:10-13 comment): no server identity service exists (accounts.mjs is token-only), so these cannot be sent for real yet.
- Sponsor-side: no email when a Form D is accepted/filed (S-13 goes to platform staff only).

**F3 - Honesty of the no-server preview:** five different wordings for "not really sent": `(simulated in this demo)`, `(simulated)`, `No email is sent in this demo`, `Email delivery is not connected in this demo`, `would be emailed`; and C-18 `Invitation sent to ${email}` with no qualifier at all (false). One sentence, one helper.

**F4 - Wording problems:** server subjects start with the offering name for S-01/S-02 (the firm is only in From); `Reminder:` is used for every resend, including a sponsor re-sending because a link was lost; fallback greeting `Dear investor,`; S-01 body is long (STEPS_SENTENCE, mail.mjs:470); console hint "Each investor receives an email from ${support.email}" (console.js:915) is wrong - messages come from `MAIL_FROM` with the support address as Reply-To; notices' `{first_name}` is `contact.split(' ')[0]` (data.js:328), so "Shah, Anita" becomes "Shah," while invitations.js handles it; `NS.MERGE_FIELDS` (data.js:324) omits `call_number`, `call_amount`, `due_date` though `mergeNotice` fills them; tax notice prints empty slots ("telephone , email .") if the contact is incomplete (taxdocs.js:701).

**F5 - Branding gaps:** `cleanFirm` accepts WebP and SVG logos (invitations.mjs:84) but `logoPart` embeds only PNG/JPEG/GIF (mail.mjs:422-425), so those firms silently get a text name; the firm accent colour is used for button background with white text and no contrast check (a light brand colour gives an unreadable button).

**F6 - White label:** no email names the platform or a vendor today: From is the firm name, Reply-To the firm's support address, footer the firm's legal name [VERIFIED: mail.mjs:1-4, 431-433]. Watch-items: S-13 uses `fromName: 'Filings'` (staff-only, acceptable); `Message-ID` and HELO use the `MAIL_FROM` domain, so a sponsor who leaves `MAIL_FROM` on a platform/vendor domain leaks it in headers - the domain setup guidance must cover it. Outside email: the self-serve audit line "`${firm} signed up for Carrow & Vale`" (diy.js:144) is sponsor-visible (noted for the reorganize step, not phase 13).

**F7 - Sensitive data:** no built message contains a taxpayer number, bank/account number or password [VERIFIED: every builder in 1.1/1.2 read this session; the sponsor notification rows are name, email, account, investing as, offering, commitment, verification states, agreement, tax form state - invitations.mjs:537-571]. Risks that remain: (a) free text - the sponsor's invitation note (`invitation.note`), custom notice bodies and capital-call text - can carry a TIN or account number typed by a person, and nothing screens it; (b) attachments: none today, and must stay none (a signed subscription agreement or W-9 can carry a TIN; deliver by portal link only); (c) wire instructions are rightly never emailed ("We never change wire instructions by email", operations.js:144) - keep as a rule.

**F8 - No sent log, no delivery state:** invitation records keep `emailStatus`/`notifyStatus` (invitations.mjs:1172-1174); envelopes keep "Email sent" events; notices keep `recipients`. There is no per-investor list of messages, no delivered/bounced/complained state, no suppression list, no `List-Unsubscribe`, and no way to see a message's exact text after it was sent (outbox holds it only when SMTP is off, 30 days).

<!-- section 1 done -->

## 2. What a good transactional email system needs (and what this product needs of it)

Measured against the product as it stands (section 1). "Needed" = law, the owner's goal text, or a market-ready product requires it; "not needed" items are listed so the planner does not build them.

### 2.1 One template set
- **One module, both sides.** Every message is a pure function `render(kind, data) -> { subject, preheader, text, html, inline }` in one plain-data file loadable as a browser script and by the server through `createRequire` - the pattern the server already uses for `assets/js/formd.js` and `assets/js/filings.js` [VERIFIED: server/lib/filings.mjs:69-72 `formd = require(join(dir, 'formd.js')); lib = require(join(dir, 'filings.js'));`; UMD tail of assets/js/formd.js `if (typeof module !== 'undefined' && module && module.exports) module.exports = API;`]. This kills F1 at the root: the console preview, the mailto path and the server send the same words.
- **HTML + plain text from the same parts**, as `compose()` already does (mail.mjs:436-468). The mailto path can only carry plain text (RFC 6068 `body=`), so the text part must read well on its own.
- **Inputs are data, never markup.** Every value escaped in HTML; header values stripped of control characters (mail.mjs:16 `oneLine` already does it). Sponsor free text (note, custom notice) is text, with line breaks only.

### 2.2 Branding per firm (white label)
- From display name = the firm's name; From address on the **firm's own domain** (owner decision 5a); Reply-To = the firm's support address; footer = legal name, **postal address**, disclaimer. Nothing names the platform or a vendor in any header, body, footer, link domain or image URL. Link domain = the firm's portal address (already: links are built from `snap.portalUrl`, invitations.mjs:1190).
- **The current server has one global `MAIL_FROM`** [VERIFIED: server/lib/mail.mjs:375-376 `buildMessage({ from: { name: m.fromName, address: env.MAIL_FROM }, ...`] while **one server serves several sponsors** [CITED: server/README.md:408 "One server can serve several sponsors, each with its own token."]. So every self-serve sponsor on a shared server sends from the same address today: a white-label failure and a DMARC-alignment failure for every sponsor whose name is not that domain. Needed: a per-workspace sender (from address + domain status) chosen by the server from the sponsor account, falling back to `MAIL_FROM` only for the single-sponsor case.
- Logo: PNG/JPEG/GIF inline (cid), as now; SVG/WebP logos must be rasterised by the console before sending (draw to a canvas, export PNG) or the text name is used **and the console says so** (F5).
- Colour: firm primary for the top rule; the button colour must pass 4.5:1 contrast against its text - pick white or near-black text by computed contrast, or fall back to a dark neutral [ASSUMED: WCAG 2.x contrast formula, standard].
- Firm postal address: not stored today (TENANT_TEMPLATE has `legalName`, `support`, `disclaimer`, no address [VERIFIED: assets/js/tenants.js:40-57, keys `name`, `shortName`, `tagline`, `legalName`, `portalName`, `domain`, `logo`, `colors`, `font`, `radius`, `nav`, `appearance`, `support`, `disclaimer`, `signin`, `home`, `onboarding`, `ach`]); the tax-document contact has one (taxdocs.js:291-298). Needed for CAN-SPAM commercial messages (2.6) and good practice in every footer.

### 2.3 Subject lines, one action, names
- Pattern: `<Firm>: <what the reader must do or now has>` - firm first, because the offering name alone does not tell the reader who wrote (F4). Keep under about 60 characters where the data allows; the required tax wording `IMPORTANT TAX RETURN DOCUMENT AVAILABLE` stays exactly as the rule sets it (taxdocs.js:28-29).
- Preheader (hidden first line): one sentence that completes the subject; absent today.
- **One action per message**: one button, its link also printed as text (already in `compose`). Sponsor notifications: one button "Open the console".
- Greeting: given name for investors with the "Shah, Anita" handling invitations.js:281-284 already has, moved into the shared module and used by notices too (F4). Fallback "Hello," - never "Dear investor,".
- "Reminder:" only for a real reminder; a re-sent link says "New link:" (F4).

### 2.4 Mobile layout and accessibility
- Single column, max 600 px, fluid below; body 16 px; button a full-width-on-phone block at least 44 px tall built as a table cell so Outlook desktop keeps its padding ("bulletproof button"); inline styles only (many clients drop `<style>`); `lang`, `<title>`, `role="presentation"` on layout tables, logo `alt` = firm name (all but the button cell already present in `compose`) [ASSUMED: common email-client behaviour, not re-tested this session].
- `<meta name="color-scheme" content="light dark">` and colours that survive forced dark mode; no text in images; link text says where it goes.
- Keep the HTML well under 100 KB so Gmail does not clip it [ASSUMED: Gmail clips at about 102 KB].
- Proof: render every message at 390 px and 1280 px in the existing sandboxed-iframe harness (AUTOPILOT checks), plus an HTML structure check (one button, `alt` present, contrast computed).

### 2.5 Link expiry wording
- Every link message states the expiry date in words, in one place, the same sentence everywhere: "This link is personal to you; please do not forward it. It expires on <Month D, YYYY>." (both template sets use near-identical wording today; unify).
- A re-sent link says the earlier link no longer works (server does; manual path does not - F1).
- The email must not promise anything the expired-link landing does not do.

### 2.6 Law: CAN-SPAM, transactional exemption, state rules
- CAN-SPAM's full duties (working opt-out honoured promptly, valid physical postal address, identification as an advertisement unless prior consent, non-deceptive headers and subject) apply to **commercial** messages; a **transactional or relationship** message (primary purpose: facilitate, complete or confirm a transaction the recipient already agreed to; notice of a change in terms or in the recipient's standing or status; periodic account balance or statement information; delivery of goods or services the recipient is entitled to) must only avoid false or misleading header information [CITED: 15 U.S.C. 7702(17) via uscode.house.gov search excerpt; 16 CFR 316.3 via ecfr.gov search excerpt]. Opt-out timing (10 business days) and the 30-day working period of the opt-out mechanism are [ASSUMED from training: ftc.gov and law.cornell.edu could not be fetched from this session - the hosts are not allowed in the session's network settings].
- Mixed messages are commercial when the subject line would make a reasonable reader think the message is commercial and the transactional content is not at the start of the body [CITED: 16 CFR 316.3(a) as summarised in the FDIC Consumer Compliance Examination Manual VIII-4, search excerpt].
- Classification for this product (recommendation; **counsel to confirm** - Open Question 2):

| Class | Messages | Unsubscribe? |
|-------|----------|--------------|
| Transactional / relationship | invitation links for a commitment or onboarding the investor agreed to, portal access link, tax form request, co-investor signing, signature requests/reminders/void/completed, tax document notice, capital call and call reminder, quarterly report and new-document notices to an investor of record, investor confirmations, all sponsor and staff notices, password reset | No (required notices cannot be opted out of); a preference may turn off the *optional* "documents available" and "quarterly report" notices |
| Possibly commercial | invitation to a **new** offering for an investor on file (S-02) or for a person with no commitment yet; a custom notice the sponsor marks as offering news | Yes: one-click unsubscribe from offering invitations (`List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, RFC 8058), postal address in the footer, honoured at once and recorded |

- State laws: most state anti-spam statutes are preempted by CAN-SPAM except provisions against falsity or deception (e.g. California B&P 17529.5 on misleading headers) [ASSUMED]. The product's headers are truthful by construction; no extra state mechanism is needed.
- Rev. Proc. 2012-17 section 7 (implemented today as a mailto notice): the email notice with the required subject words, and paper within 30 days when the email notice comes back undeliverable (taxdocs.js:658 models the second half). A server send plus **hard bounce -> "notice came back"** closes the loop automatically.
- Never in any message (owner rule + phishing safety): taxpayer numbers, bank, account or routing numbers, passwords, one-time codes, wire instructions, attachments of signed documents. Deliver by portal link only.

### 2.7 Deliverability
- **Authentication of the firm's own domain**: SPF (or the provider's return-path domain), DKIM with the firm's domain as `d=`, DMARC published (start `p=none`, move to `quarantine`), From aligned with the SPF or DKIM domain. Google requires SPF or DKIM for all senders, and SPF + DKIM + DMARC with alignment, TLS, and DKIM keys of at least 1024 bits for bulk senders (close to 5,000+ messages in 24 hours to personal Gmail; the classification is permanent) [CITED: support.google.com/a/answer/81126 and support.google.com/a/answer/14229414, search excerpts]. One-click unsubscribe and a spam rate under 0.3% for bulk senders [ASSUMED: vendor blog only in this session]. A sponsor will rarely be "bulk", but aligned SPF/DKIM/DMARC is what keeps invitations out of spam.
- **Bounce and complaint handling**: hard bounce -> mark the address bad on the investor, stop sending to it (suppression), tell the sponsor on the investor row and the invitations list; complaint -> suppress optional mail at once; soft bounce -> provider retries, record. For tax notices a hard bounce sets the Rev. Proc. 2012-17 "notice came back" state.
- `Auto-Submitted: auto-generated` on automatic mail (already on sponsor notifications, invitations.mjs:829, 1134); `Message-ID` on the firm's domain; no link shorteners or tracking redirects. Open/click tracking **off**: tracking pixels and rewritten links put a vendor domain in the message (white-label leak) and add nothing the portal's own "opened" step does not already record.

### 2.8 Sent log, preview, resend
- **Sent log per investor**: every message (server or simulated) leaves one entry: when, kind, subject, recipient, status (`sent`, `outbox`, `failed`, later `delivered`, `bounced`, `complained`; browser-only `simulated`, and `manual` for mailto + Mark as sent) and the rendered text with the personal link replaced by "[personal link]" so it can be kept after the link dies. Server side sealed in the vault like the outbox (the store keeps no addresses in plain text, mail.mjs:381-383); browser side in the workspace. Shown on the investor's record in the console.
- **Preview of every message in the console**: one "Emails" page listing every message kind with its subject and a rendered preview (HTML at phone and desktop width, plus the plain text) using the firm's brand and a sample investor; the same renderer the server uses, so the preview is the message.
- **Resend**: invitations already resend with a new token (server) or re-show the email (manual). Add "Send again" for a single notice or tax notice to one investor; a bounced address must be corrected first.

### 2.9 Preferences and unsubscribe
- Investor portal -> Account -> "Email": optional notices (new documents, quarterly reports, offering invitations) on/off; required notices listed as always sent. Default all on (nothing mandatory for investors to set, D-30).
- Unsubscribe link only on possibly-commercial mail (2.6): one click, no sign-in, signed token; it turns off "offering invitations" for that investor and records it.
- **Not needed**: a marketing list manager, campaigns, A/B tests, open/click analytics, scheduled sends, a drag-and-drop template editor. The sponsor edits only the custom-notice text and the invitation note, as today.

<!-- section 2 done -->

## 3. Sending infrastructure

### 3.1 What the server uses now
- Its own zero-dependency SMTP submission client (section 1.1): any provider that offers SMTP works today by setting `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` [VERIFIED: server/lib/mail.mjs:337-350; CITED: server/README.md:44-51, 354]. Without `SMTP_HOST`, the sealed outbox (`GET /v1/outbox`, purged after `OUTBOX_DAYS`).
- Gaps for a multi-sponsor, white-label product: (1) one `MAIL_FROM` for every sponsor on the server (2.2); (2) no domain onboarding - a self-serve sponsor gets no DNS records to add and no check that SPF/DKIM/DMARC are right; (3) no delivery events: `emailStatus` stops at `sent` (accepted by the relay), so a bounce is invisible; (4) no suppression; (5) only `invitations.mjs` and `filings.mjs` call the mailer; notices, e-sign, tax notices have no server route at all.
- The only server dependency is `@anthropic-ai/sdk` [VERIFIED: server/package.json `"dependencies": { "@anthropic-ai/sdk": "1.8.0" }`]. The project's style is zero-dependency (SMTP, MIME, connectors all hand-built on node built-ins). **No package needs to be installed for this phase**: SigV4 signing, SNS signature checks and DNS lookups all exist in `node:crypto` (`createHmac`, `X509Certificate`, `verify`) and `node:dns/promises` [ASSUMED: Node >= 18 built-ins, per `"engines": { "node": ">=18" }` in server/package.json].

### 3.2 Outside options (per CLAUDE.md: cost, deliverability, speed, setup, webhooks, trade-offs)

Volume model for cost: 40 self-serve sponsors, about 300 messages each a month = **12,000 messages/month**, each sponsor on its own domain. Prices from vendor pages and third-party summaries found by search this session (fetching vendor pages directly was not possible from this session for some hosts); every price is **to be re-checked on the vendor page before the owner commits**.

| Option | Price | Est. cost at 12k/mo, 40 domains | Free allowance | Many sponsor domains in one account | Bounce/complaint events | Setup burden for a self-serve sponsor | Trade-offs |
|--------|-------|-------------------------------|----------------|-------------------------------------|-------------------------|----------------------------------------|------------|
| **Amazon SES** | à la carte $0.10 per 1,000 (+$0.12/GB); new accounts since 2026-07-21 start on "Essentials" ($0.16 per 1,000), à la carte selectable [CITED: aws.amazon.com/ses/pricing and AWS "SES introduces pricing plans" 2026-07, search excerpts; Essentials rate from a third-party summary] | **about $1.20-$1.92/month**, no minimum | $200 AWS credits for new AWS customers (first 6 months) [CITED: AWS blog excerpt]; old 3,000/month SES free tier closed to new accounts [CITED: third-party excerpt, unconfirmed by AWS page] | Yes: 10,000 identities per region [CITED: docs.aws.amazon.com/ses/latest/dg/quotas.html excerpt] | Yes: SNS to an HTTPS endpoint (or EventBridge); per-message bounce/complaint/delivery | Add 3 DKIM CNAMEs (values from the API's `SigningHostedZone`, not hard-coded [CITED: AWS docs excerpt]), optional custom MAIL FROM (MX + SPF TXT), DMARC TXT | Cheapest by far; SMTP endpoint works with the existing client unchanged; new accounts start in a sandbox (200 messages/24 h, 1/s) until production access is granted [CITED: AWS quotas excerpt] - AWS reviews the use case; SigV4 API for domain setup; SNS message signature checking to build |
| **Postmark** | Basic $15/month for 10,000 (overage about $1.80 per 1,000); Pro about $16.50 at 10k [CITED: postmarkapp.com blog/pricing excerpts] | **about $18-19/month** | 100/month forever (Developer) | Domains are account-wide; Domains API returns DKIM + Return-Path records [CITED: postmarkapp.com/developer/api/domains-api excerpt]; "unlimited domains" only from a third-party doc [ASSUMED] | Yes: bounce, spam complaint, delivery webhooks per message stream [CITED: Postmark excerpt] | DKIM TXT + Return-Path CNAME (`pm.mtasv.net`) + DMARC | Strongest transactional-only reputation and simplest API/webhooks; a monthly fee from day one, which the owner has said he cannot carry before revenue |
| **Zoho ZeptoMail** | $2.50 per 10,000 (credits valid 6 months, no monthly fee) [CITED: zoho.com/zeptomail/pricing excerpt + third-party] | **about $2.50-$5/month** | 10,000 trial emails | Multiple domains supported; no cap found [ASSUMED] | Webhooks exist [ASSUMED] | DKIM + bounce CNAME | Cheap and transactional-only; less documented domain API for platform use; credit expiry |
| **Resend** | Free 3,000/month (100/day); Pro $20/month for 50,000 [CITED: resend.com/pricing excerpt] | $20+/month and Pro allows **10 domains** - too few for 40 sponsors [CITED: resend.com/pricing excerpt] | 3,000/month, 1-3 domains | No (domain cap per plan) | Yes (signed webhooks) | DKIM/SPF records | Good developer experience; domain caps make it a poor fit for per-sponsor domains |
| **Mailgun** | Basic $15/month (10,000) [CITED: third-party 2026 summary] | about $15+/month | 100/day free | Domain limits per plan [ASSUMED] | Yes | DKIM/SPF/CNAME | Mid-price; SMTP credentials are per domain (more setup per sponsor) [ASSUMED] |
| **SendGrid** | from $19.95/month; free plan retired May 2025 [CITED: third-party 2026 summaries] | about $20/month | trial only | Yes | Yes | DKIM CNAMEs | No advantage here; monthly fee |
| **SMTP2GO** | free 1,000/month (200/day) [CITED: third-party + vendor blog excerpts]; paid tiers [ASSUMED about $10-15] | over the free cap | 1,000/month | [ASSUMED] | Yes | DKIM/SPF | Free tier too small for 40 sponsors |
| **Brevo** | free 300/day | - | 300/day | - | - | - | **Disqualified**: free plan adds the vendor's branding to emails [CITED: third-party excerpt] (white-label breach) |
| **Sponsor's own mailbox (Google Workspace / Microsoft 365 SMTP)** - the current SMTP path | $0 to the platform | $0 | n/a | n/a (each sponsor sets its own) | **None** (bounces land in the mailbox) | Sponsor creates an app password (Google, needs 2-Step Verification, revoked on password change) [CITED: third-party guides excerpt]; Microsoft turns off SMTP AUTH basic auth by default for existing tenants at the end of December 2026, OAuth required after [CITED: techcommunity.microsoft.com excerpt] | Aligned by default if the firm's domain already signs mail; about 2,000/day Workspace limit [ASSUMED]; no events; Microsoft path will need XOAUTH2, which the client lacks |
| **Current outbox (no SMTP)** | $0 | $0 | - | - | - | none | Nothing is delivered; honest only as a demo/testing mode |

### 3.3 Recommendation
- **Default: Amazon SES, on one platform account, sending through the existing SMTP client** (SES SMTP endpoint, port 587, STARTTLS - no new transport code), with two small provider adapters: (a) **domain setup** through the SES v2 API (create identity, read DKIM records, read status) signed with SigV4 from `node:crypto`; (b) **delivery events** from SNS over HTTPS (subscription confirm + message signature verified with `X509Certificate`). Cost at the owner's 40-account model is about $1-2 a month, pay-per-use, no minimum - the only option that fits "no budget for monthly fees". [Cost: CITED excerpts above; build approach: ASSUMED, to be proven by the plan's tests against a local fake SES/SNS.]
- **Keep the code provider-neutral**: SMTP stays the only send path (every candidate offers SMTP submission, so switching provider = changing five settings); domain setup and events sit behind one small adapter interface (`server/mailers/<id>.mjs`, mirroring `server/providers/`): `records(domain)`, `status(domain)`, `events(req) -> [{ messageId, type: 'delivered'|'bounced'|'complained', permanent, at }]`. Ship `smtp` (generic: shows SPF/DKIM/DMARC guidance and checks them with `node:dns`, no events) and `ses`. A Postmark adapter is the documented second choice if deliverability support becomes worth $15+/month.
- **Correlation**: put our own `Message-ID` on every message (already done, mail.mjs:110) and store it with the sent-log entry; SES notifications carry the original headers' Message-ID [ASSUMED: SES `mail.commonHeaders.messageId`], Postmark returns its own MessageID [ASSUMED]; the adapter maps provider ids back.
- **Per-sponsor sender**: the sponsor console's Integrations page gets "Email sending": the from address (`notices@<firm domain>` by default), the DNS records to add, a "Check" button and the status (Not set up / Waiting for DNS / Ready). Until Ready, the server **does not send as that domain**: it keeps the message in the outbox and tells the sponsor why (never falls back to a platform domain, which would be a white-label leak).
- **Live proof needs the owner's account**: agents hold no API keys (AUTOPILOT). Plans build and test against local fakes (as `mail.test.mjs` already does with a fake SMTP server); one owner checkpoint creates the AWS account and requests production access; until then the console marks live email "To be confirmed".

<!-- section 3 done -->

## 4. Validation Architecture (how every message is proven)

`workflow.nyquist_validation` is `true` in .planning/config.json, so this section is required.

### 4.1 Test framework

| Property | Value |
|----------|-------|
| Server framework | `node --test` (Node built-in runner); script `"test": "node --test"` [VERIFIED: server/package.json] |
| Server tests today | **368** on c8b65e7, all passing - measured this session: `# tests 368 / # pass 368 / # fail 0` (`node --test` in server/, 16.1 s) |
| Existing mail tests | server/test/mail.test.mjs, 14 tests, including a fake SMTP server (plain, STARTTLS, implicit TLS) and a template test that already bans product names: `for (const banned of [/carrow/i, /vale\b/i, /powered by/i, /DIY Portal/i])` [VERIFIED: server/test/mail.test.mjs:216-236] |
| Browser checks | Playwright scripts in .planning/phases/06-*/checks/ (e.g. `email-dialog.js`, `no-network.js`, `safari-finish.js`, `ways-out.js`, shared `lib.js`), run through the shared queue SCRATCH/exec-011/heavy.sh; full gate .planning/checks/gate-reference.sh with exact `GATE_SERVER_TESTS` |
| Quick run | `cd server && node --test test/mail.test.mjs test/emails*.test.mjs` |
| Full suite | `cd server && node --test` then the reference gate |

### 4.2 Proof per message type (every kind in the inventory, both sides)

1. **Golden render per kind** (server test, new `server/test/emails-render.test.mjs`): render every kind and variant from `emails.js` with one fixed sample (firm, investor, offering, fixed dates and link) and compare the text part and the HTML to committed golden files `server/test/fixtures/emails/<kind>.txt|.html`. A wording change is a visible diff the verifier and the owner read; goldens are updated only on purpose (an env flag, never automatically in the gate).
2. **No vendor or platform name, ever** (all kinds, subject + text + HTML + headers built by `buildMessage`): extend the existing banned list to `carrow`, `vale\b`, `powered by`, `DIY Portal`, `amazon`, `aws`, `\bses\b`, `postmark`, `sendgrid`, `mailgun`, `zepto`, `zoho`, `resend\b`, `brevo`, `smtp2go`, `anthropic`, `claude`, and the word `basic`. Run it also with an SVG-logo firm and with an empty firm field set (fallback wording).
3. **No taxpayer, bank or password pattern** (all kinds): feed sample data in which every free-text field (note, custom notice body, firm disclaimer, names) carries an SSN `123-45-6789`, an EIN `12-3456789`, a valid-checksum ABA routing number, a 12-digit account number and `password: hunter2`; assert (a) the renderer's structured fields never print a TIN/account field at all (the data shape has none), and (b) the free-text screen refuses the input with one plain sentence at the console and at the server route (HTTP 422), so nothing with those shapes is ever sent. Regexes live in one place (`emails.js`), reused by the console and the server (help.mjs already strips tax numbers and digit runs from questions with a similar list - reuse its patterns, server/lib/help.mjs:42-50).
4. **Links valid**: every `href` in the HTML is either the message's own action link (equal to the input link, `https:`) or `mailto:` the firm's support address; the text part contains the same action link; no other domain appears; the personal link never appears in the sent log (replaced by "[personal link]").
5. **Structure and mobile**: per kind - exactly one primary button, `lang`, `<title>`, `color-scheme` meta, logo `alt`, HTML under 100 KB, button contrast >= 4.5:1 computed from the firm colour (test with a light brand colour like `#FFE066`), no `<style>`-only formatting; browser check renders each kind at **390x844 (touch) and 1280x800** inside the sandboxed iframe with connect-src blocked and asserts nothing overflows horizontally and the button is >= 44 px tall.
6. **Preview equals what is sent** (the F1 bug): a browser check loads the console, renders kind X through `NS.emails` and compares its text part byte-for-byte to the server's render of the same input (the check runs Node's `require('assets/js/emails.js')` with the same fixture). RED before: today the invitation subject differs (`... your invitation to invest in ...` vs `...: complete your investor onboarding`).
7. **Both editions**: self-serve renders all kinds; managed edition output unchanged (its legacy activation preview C-04 and reminder C-05 compared against the base tree text), honouring the C-03 slice guard in status-math.
8. **The no-server preview stays honest**: a browser check, with no server connected and network blocked, triggers every client path in 1.2 (invite, co-investor add, notice, capital call, document publish with notify, e-sign send/remind/void/sign, tax notice, forgot password, team invite) and asserts each toast/dialog contains the one sentence "(simulated in this demo)" or offers the mailto path, never a bare "sent"/"emailed"; each leaves a sent-log entry with status `simulated` or `manual`; zero network requests (no-network.js pattern).
9. **Server transport and events**: fake SES API (local HTTPS with a test CA, as the STARTTLS test does) proves SigV4 headers and the DNS records returned; fake SNS posts prove subscription confirmation only for an allowed host, signature verification (a self-signed test cert passed through the adapter's injectable trust), bounce -> suppression + sent-log status, complaint -> optional mail off; a spoofed or unsigned post is refused (401) and changes nothing.
10. **Live deliverability (owner checkpoint, not automatable here)**: once an SES account exists, one message of each kind to Gmail, Outlook.com and iCloud inboxes; headers show `spf=pass dkim=pass dmarc=pass` for the firm's test domain; the owner opens them on his iPhone. Until then the console says live email is "To be confirmed".

### 4.3 Phase requirements -> test map

| Req | Behaviour | Type | Command | Exists? |
|-----|-----------|------|---------|---------|
| EM-01 | one renderer, all kinds | unit | `node --test server/test/emails-render.test.mjs` | Wave 0 |
| EM-02 | wording, subjects, greeting, expiry | unit (golden) | same | Wave 0 |
| EM-03 | white label, branding, contrast | unit | `node --test server/test/emails-render.test.mjs` | partly (mail.test.mjs:216) |
| EM-04 | no TIN/bank/password | unit + route | `node --test server/test/emails-guard.test.mjs` | Wave 0 |
| EM-05 | mobile/accessible HTML | browser | `node .planning/phases/13-*/checks/emails-preview.js` | Wave 0 |
| EM-06 | per-sponsor sender, DNS records, no unverified sending | unit | `node --test server/test/senders.test.mjs` | Wave 0 |
| EM-07 | SES adapter + SNS events | unit with fakes | `node --test server/test/mailer-ses.test.mjs` | Wave 0 |
| EM-08 | sent log, suppression, statuses | unit + browser | `node --test server/test/maillog.test.mjs` | Wave 0 |
| EM-09 | server sends notices/tax/e-sign notices | route | `node --test server/test/messages.test.mjs` | Wave 0 |
| EM-10 | investor confirmation | route | `node --test server/test/invitations-confirm-mail.test.mjs` | Wave 0 |
| EM-11 | preferences + one-click unsubscribe | route + browser | `node --test server/test/unsubscribe.test.mjs` | Wave 0 |
| EM-12 | console Emails page previews every kind | browser | `emails-preview.js` | Wave 0 |
| EM-13 | honest no-server preview | browser | `node .planning/phases/13-*/checks/emails-honest.js` | Wave 0 |
| EM-14 | preview == server text | browser + node | `node .planning/phases/13-*/checks/emails-parity.js` | Wave 0 |

### 4.4 Server test count
368 today. Each plan states its exact delta in its PLAN and SUMMARY (new tests added, existing assertions changed - the subject assertions in mail.test.mjs:221 and :228, and any invitations*.test.mjs that match old subjects, will change and must be listed, not silently deleted). The gate's `GATE_SERVER_TESTS` is set to the merged total after each merge.

### 4.5 Sampling
- Per task commit: the plan's own quick tests.
- Per wave merge: `node --test` (full server) + the phase's browser checks.
- Phase gate: the full reference gate on the merged tree, the owner-path walkthrough of the preview (phone sizes), then the owner's own check.

### 4.6 Wave 0 gaps
- `server/test/emails-render.test.mjs`, `server/test/fixtures/emails/` (goldens), `server/test/emails-guard.test.mjs`
- `server/test/senders.test.mjs`, `server/test/mailer-ses.test.mjs` (fake SES/SNS with a test CA)
- `server/test/maillog.test.mjs`, `server/test/messages.test.mjs`, `server/test/unsubscribe.test.mjs`
- `.planning/phases/13-email-overhaul/checks/` - `emails-preview.js`, `emails-honest.js`, `emails-parity.js` reusing 06's `lib.js`
- No framework install needed.

<!-- section 4 done -->

## 5. Requirements and recommended plan breakdown

<phase_requirements>
### 5.1 Requirements (EM-01 ... EM-14), each traced

| ID | Requirement | Traced to | Research support |
|----|-------------|-----------|------------------|
| EM-01 | One shared template module `assets/js/emails.js` (UMD, plain data, no DOM, loads in the browser and in the server via `createRequire`) renders every message kind in the inventory to `{ subject, preheader, text, html, inline }`; `server/lib/mail.mjs` builders delegate to it; the browser's `emailFor`/`emailOf`/notice/tax-notice builders delegate to it. | ROADMAP goal "one template set"; F1 | 2.1; 1.1-1.2; formd.js precedent |
| EM-02 | Consistent wording: subject `<Firm>: <what to do/what is ready>`, preheader, given-name greeting (handles "Last, First"), one action and one button per message with the link also in text, one expiry sentence, "New link:" for a re-sent link and "Reminder:" only for real reminders, one support line. | ROADMAP "clear subject lines, one action per message, the investor's or sponsor's name"; F1, F4 | 2.3, 2.5 |
| EM-03 | White label and firm branding: From name = firm, From address on the firm's domain, Reply-To = firm support, footer = legal name + postal address (new optional brand field) + disclaimer; PNG/JPEG/GIF logo inline, SVG/WebP rasterised by the console or text name used and said; button text colour chosen for >= 4.5:1 contrast; no platform, vendor or library name and never the word "basic" anywhere in a message. | ROADMAP white label; AUTOPILOT; F5, F6 | 2.2, 4.2(2) |
| EM-04 | No message can carry a taxpayer number, bank/routing/account number, password or attachment: structured data has no such fields; sponsor free text (invitation note, custom notice, capital-call text) is screened in the console and refused by the server (422) when it matches the shared patterns. | ROADMAP "no message holds a taxpayer number, password or bank number"; F7 | 2.6, 4.2(3); help.mjs:43-44 patterns |
| EM-05 | Mobile and accessible HTML: single column 600 px, bulletproof button >= 44 px, inline styles, `lang`/`title`/`alt`/`color-scheme`, under 100 KB; proven at 390x844 and 1280x800 in the sandboxed iframe. | ROADMAP "mobile layout"; AUTOPILOT iPhone rules | 2.4, 4.2(5) |
| EM-06 | Per-sponsor sender: a sponsor account holds its from address and domain status; the console's Integrations page shows the SPF/DKIM/DMARC records to add, a Check button and the status; the server never sends as a domain that is not ready (keeps the message in the outbox and says why) and never falls back to a platform domain; single-sponsor servers keep `MAIL_FROM`. | Owner 5a "white-label sending from the sponsor's domain"; ROADMAP deliverability basics | 2.2, 2.7, 3.3 |
| EM-07 | Provider-neutral mail adapters `server/mailers/<id>.mjs` (`records`, `status`, `events`): `smtp` (DNS checks through `node:dns`, no events) and `ses` (SES v2 domain identity via SigV4; SNS HTTPS events with subscription confirm and signature verification); SMTP stays the only send path. | Owner 5a "outside email provider", "delivery tracking and bounces"; CLAUDE.md outside-service rule | 3.2, 3.3 |
| EM-08 | Sent log per investor: every message (sent, outbox, failed, delivered, bounced, complained, simulated, manual) recorded with time, kind, subject, recipient, status and the text with the personal link redacted; server copy sealed in the vault; shown on the investor's record in the console; hard bounce suppresses the address and shows on the investor row and invitations list until the email is corrected. | ROADMAP "a sent log per investor"; owner 5a bounces; F8 | 2.7, 2.8 |
| EM-09 | Server route to send the messages that have no server path today: investor notices (quarterly report, new documents, custom), capital call and call reminder, tax document notice, e-sign notices (request, reminder, voided, completed - each a portal link, no token); per-recipient status back to the console; rate-limited per workspace. | F2; ROADMAP "every email ... rebuilt into one system" | 1.3 F2, 2.6 |
| EM-10 | Investor confirmation: one message to the investor when an onboarding, subscription, tax-form request or co-investor signing is received (what was received, what happens next, portal link; nothing sensitive). Replaces the false "completed copy was emailed" promise. | F2 missing message | 1.3 F2 |
| EM-11 | Preferences and unsubscribe: investor Account page lets the investor turn off optional notices (documents available, quarterly reports, offering invitations); possibly-commercial messages carry `List-Unsubscribe` + `List-Unsubscribe-Post` one-click and a footer link; the server honours both at once and records them; required notices always go out. | ROADMAP "unsubscribe and notification preferences where the law requires them" | 2.6, 2.9 |
| EM-12 | Console "Emails" page: every message kind with its subject and a preview (phone and desktop width, and the plain text) in the firm's brand with sample data, using the same renderer; includes password reset and team invitation templates marked as sent once sign-in accounts are connected. | ROADMAP "a preview of every message in the console"; password-reset gap | 2.8 |
| EM-13 | Honest no-server preview: one helper sentence "(simulated in this demo)" on every client path that would email (C-03, C-05..C-15, C-17, C-18), the wrong "from ${support.email}" hint fixed, the team-invite toast no longer claims a send; every simulated send leaves a `simulated` sent-log entry; no network request. | ROADMAP "stays honest in the no-server preview"; F3 | 1.2, 4.2(8) |
| EM-14 | Proof: golden render per kind, banned-word and sensitive-pattern scans over all kinds, link validity, preview == server parity, both editions, browser checks, server test count declared per plan, gate lines added; live deliverability check on real inboxes as an owner checkpoint. | CLAUDE.md "never call anything ready before the owner has checked it" | section 4 |
</phase_requirements>

### 5.2 Recommended plans, waves and file ownership

Ownership rule: a file is edited by one plan per wave; files many earlier plans touched (`invitations.js`, `onboarding.js`, `esign.js`, `console.js`) each get **one owner plan** in this phase. `onboarding.js` is **not edited** in phase 13 (the investor confirmation is server-sent; the on-screen "copy is in your Documents" lines are already correct).

| Wave | Plan | Delivers | Owns (edits) | Depends on |
|------|------|----------|--------------|------------|
| 1 | **13-01 Shared renderer** | `assets/js/emails.js` (all kinds, guard patterns, greeting, contrast, browser sent-log helper `NS.emails.log`), `mail.mjs` builders (lines 405-707) delegate to it, script tag in `diy.html`, `index.html`, `portal.html`, preview build file list; golden + banned + guard + link + structure tests | `assets/js/emails.js` (new), `server/lib/mail.mjs` (builders only), `server/test/mail.test.mjs`, `server/test/emails-*.test.mjs` (new), `server/test/fixtures/emails/` (new), the 3 HTML pages (one line each), `.planning/tools/preview/` file list | - |
| 1 | **13-02 Mail adapters** | `server/mailers/index.mjs`, `smtp.mjs` (DNS record list + `node:dns` checks, injectable resolver), `ses.mjs` (SigV4, SES v2 identity, SNS confirm + signature verify, injectable transport/trust); tests with local fakes | `server/mailers/*` (new), `server/test/senders.test.mjs`, `server/test/mailer-ses.test.mjs` (new) | - |
| 2 | **13-03 Server sender, log, events, confirmation** | per-workspace sender on accounts, `createMailer` picks sender + refuses unready domains, sealed sent log `server/lib/maillog.mjs`, suppression, events route mounted, `GET /v1/messages/log`, investor confirmation at `POST /v1/invite/complete`, README Email section | `server/lib/mail.mjs` (createMailer, lines 336-403), `server/lib/maillog.mjs` (new), `server/lib/accounts.mjs`, `server/lib/invitations.mjs` (send + complete paths), `server/index.mjs`, `server/README.md`, their tests | 13-01, 13-02 |
| 2 | **13-05 Console invitations on the renderer** | `invitations.js` `emailFor` and `coinvestor.js` `emailOf` call `NS.emails`; server-path dialog shows the server's exact text; manual resend says "New link"; sent-log entries for manual/outbox/sent; simulated helper in these two files; parity check | `assets/js/invitations.js`, `assets/js/coinvestor.js`, `.planning/phases/13-email-overhaul/checks/emails-parity.js` (new) | 13-01 |
| 3 | **13-04 Server messages route + unsubscribe** | `POST /v1/messages` (notices, capital calls, tax notice, e-sign notices; per-recipient status; rate limit; preferences + suppression honoured), one-click unsubscribe route with signed token, `List-Unsubscribe` headers | `server/lib/messages.mjs` (new), `server/index.mjs` (mount), `server/test/messages.test.mjs`, `server/test/unsubscribe.test.mjs` (new) | 13-03 |
| 3 | **13-06 Notices and capital calls** | `data.js` templates -> `emails.js` kinds (merge fields incl. `call_number`, `call_amount`, `due_date`; given-name fix), `console.js` notice preview + send through the server when connected, honest wording in console.js (915, 1059, 1727, C-04 managed text kept), `operations.js` capital-call notices | `assets/js/console.js`, `assets/js/data.js`, `assets/js/operations.js` | 13-01, 13-04 (route contract only; can stub until merged) |
| 3 | **13-08 E-sign, team, password, portal preferences** | `esign.js` simulated helper + server notices when connected; `diy.js` team-invite honesty; `portal.js` forgot-password honesty + Account "Email" preferences (optional notices) | `assets/js/esign.js`, `assets/js/diy.js`, `assets/js/portal.js` | 13-01, 13-04 |
| 4 | **13-07 Tax document notices** | `taxdocs.js` `notice()` through `emails.js` (subject words unchanged), `taxdocs-ui.js` sets the server link (`API.link`) so connected workspaces send through `POST /v1/messages`; hard bounce -> "notice came back" -> paper due date | `assets/js/taxdocs.js`, `assets/js/taxdocs-ui.js` | 13-04 |
| 4 | **13-09 Console Emails page + Email sending setup** | `assets/js/emails-ui.js` (preview every kind at phone/desktop + text), Integrations "Email sending" (from address, DNS records, Check, status, "To be confirmed" until live), firm postal address brand field, nav entry | `assets/js/emails-ui.js` (new), `assets/js/integrations.js`, `assets/js/console.js` (the "Portal and brand" view `console-brand` for the postal address field, and one nav line; console.js:56, :65) - after 13-06 has merged. `assets/js/brand.js` is the colour engine with WCAG contrast math: reuse its formula, do not edit it | 13-01, 13-03, 13-06 |
| 5 | **13-10 Proof and owner check** | browser checks `emails-preview.js`, `emails-honest.js`, gate lines and exact `GATE_SERVER_TESTS`, preview rebuild + phone walkthrough, owner checkpoint: AWS account + live sends to real inboxes (Gmail/Outlook/iCloud) + owner's iPhone check | `.planning/phases/13-email-overhaul/checks/*`, `.planning/checks/gate-reference.sh` (lines only) | all |

Parallelism: wave 1 two plans; wave 2 two; wave 3 three; wave 4 two; wave 5 one. Each sized to about 100k tokens; 13-01 is the largest (every kind) and may be split into 13-01a (investor kinds) and 13-01b (sponsor/staff/notice kinds) if the planner measures it over budget - both in wave 1, same new file, so split by kind into `emails.js` + `emails-sponsor.js` only if needed.

<!-- section 5 done -->

## Standard Stack

### Core
| Component | Version | Purpose | Why |
|-----------|---------|---------|-----|
| Node.js built-ins (`node:net`, `node:tls`, `node:crypto`, `node:dns/promises`) | Node >= 18 declared; v22.23.4 installed here | SMTP send (existing), SigV4 HMAC, SNS signature check (`X509Certificate`, `crypto.verify`), DNS record checks | The server is zero-dependency by design; everything needed is built in |
| Existing `server/lib/mail.mjs` SMTP client + MIME builder | in repo | the only send path | Tested (14 tests), STARTTLS/implicit TLS, header-injection safe |
| `assets/js/emails.js` (new, UMD like `formd.js`) | in repo | all wording and layout | One renderer for browser and server |
| `node --test` | built in | server tests | Existing runner (368 tests) |
| Playwright (global) | installed at /opt/node22/lib/node_modules | browser checks | Existing check harness |

### Outside service (not a package)
| Service | Role | Default? |
|---------|------|----------|
| Amazon SES (SMTP endpoint + SES v2 API + SNS) | sending, domain identities, delivery events | **Default** (owner to confirm the account) |
| Postmark | same | documented second adapter |
| The sponsor's own SMTP | sending only, no events | kept (single-sponsor/self-hosted) |

**Installation:** none. No npm package is added in this phase.

## Package Legitimacy Audit

No external package is installed by this phase (all code uses Node built-ins and in-repo modules). Audit not applicable. **Packages removed:** none. **Packages flagged:** none. If a planner proposes an email library (for example an MJML or SMTP package), it must go through the legitimacy gate first; this research recommends against it (the in-repo client and `compose()` already cover the need).

## Architecture Patterns

### System architecture

```
 Console (browser)                         Integration server                          Outside
 ------------------                        ------------------                          -------
 sponsor action ──► NS.emails.render ──┐
 (invite, notice,     (same module)    │ preview / mailto / "simulated" + sent-log entry (no server)
  tax notice, ...)                     │
                                       └─► POST /v1/invitations | /v1/messages ──► screen free text (422 on TIN/bank)
                                                                                    │
                                                                emails.js render ◄──┘ (createRequire, same words)
                                                                       │
                                                  sender for workspace ? ready ──no──► outbox + reason to console
                                                                       │yes
                                                  suppressed address ? ──yes──► skip, log "suppressed"
                                                                       │no
                                                  buildMessage + smtpSend ───────────► provider SMTP (SES) ──► inbox
                                                                       │                         │
                                                  sealed sent log (link redacted)               │ bounce/complaint
                                                                       ▲                         ▼
                                                  POST /v1/mail/events ◄── adapter verifies signature (SNS)
                                                                       │
                                                  status -> investor row, invitations list, tax "notice came back"
 Investor inbox ──► one-click unsubscribe (POST, signed token) ──► preferences honoured on next send
```

### Recommended structure
```
assets/js/emails.js          # every kind: subject, preheader, text, html; guard patterns; greeting; contrast; NS.emails.log
assets/js/emails-ui.js       # console "Emails" page (preview every kind) + Email sending setup panel
server/lib/mail.mjs          # transport (SMTP), MIME, createMailer(sender per workspace); builders become thin wrappers
server/lib/maillog.mjs       # sealed sent log, suppression list
server/lib/messages.mjs      # POST /v1/messages, unsubscribe route
server/mailers/index.mjs     # adapter registry
server/mailers/smtp.mjs      # generic: DNS guidance + checks, no events
server/mailers/ses.mjs       # SES v2 identities (SigV4) + SNS events
```

### Pattern 1: one UMD renderer loaded on both sides
**What:** `emails.js` touches nothing at load, exports `{ KINDS, render, guard, greeting, log }`; browser reads `window.CVPortal.emails`, server `createRequire(import.meta.url)(join(dir, 'emails.js'))`.
**When:** every message.
**Example (the in-repo precedent, verbatim):**
```js
// assets/js/formd.js (tail)
const API = { LISTS, blank, prefill, validate, toXml, fromXml, snapshot };
if (NS) NS.formD = API;
if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
// server/lib/filings.mjs:69-72
const dir = assetsDir || fileURLToPath(new URL('../../assets/js/', import.meta.url));
const require = createRequire(import.meta.url);
formd = require(join(dir, 'formd.js'));
```

### Pattern 2: sensitive-data guard shared with help
**Example (in-repo patterns, verbatim, server/lib/help.mjs:43-44):**
```js
/** Tax-number shapes (two-seven and three-two-four digits) and any run of 8 or more digits. */
const NUMBERS = [/\b\d{2}-\d{7}\b/, /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, /\d{8,}/];
```
Move these into `emails.js` (exported), add a password shape (`/\bpass(word|code)?\s*[:=]/i`), and use them to **refuse** sponsor free text (not silently strip it: the sponsor must know).

### Pattern 3: adapter interface (mirrors `server/providers/`)
```js
// server/mailers/<id>.mjs  [ASSUMED shape - planner fixes the final names]
export default {
  id: 'ses',
  configured(env) {},                 // true when its settings are present
  async records(domain, env) {},      // [{ type: 'CNAME'|'TXT'|'MX', name, value, purpose }]
  async status(domain, env) {},       // 'pending' | 'ready' | 'failed'
  async events(req, rawBody, env) {}  // [{ messageId, type: 'delivered'|'bounced'|'complained', permanent, at }] or throws 401
};
```

### Anti-patterns to avoid
- **Two template sets** (today's root bug). Never add wording in invitations.js/coinvestor.js/console.js again; call `NS.emails`.
- **Falling back to a platform domain** when the sponsor's domain is not ready: white-label leak and DMARC failure. Keep in outbox, say why.
- **Open/click tracking or link rewriting**: vendor domain in the message.
- **Attachments**: signed documents carry TINs. Portal links only.
- **Emailing a hard-bounced address again**: hurts the shared sending reputation of every sponsor.
- **Trusting an SNS post without signature check, or fetching a `SubscribeURL`/`SigningCertURL` on any host**: SSRF and spoofed bounces. Only `https://sns.<region>.amazonaws.com/` hosts.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Delivering mail to inboxes (IP reputation, retries, feedback loops) | your own MTA / direct-to-MX sending | an outside provider over SMTP (SES default) | Reputation, retries, ISP feedback loops are the provider's job |
| SMTP client / MIME | a new library | the existing `mail.mjs` | Already built and tested (14 tests) |
| Bounce parsing from DSN mails | parsing returned mail | provider events (SNS/webhook JSON) | DSN formats vary; providers normalise |
| WCAG contrast | a new formula | the formula already in `assets/js/brand.js` ("Color math ... WCAG contrast") | Already in the product |
| TIN/digit patterns | new regexes in each file | one export in `emails.js` from help.mjs's list | One definition, tested once |
| Templates engine (MJML, Handlebars) | a template language | plain functions in `emails.js` like `compose()` | No dependency, escaping already right |

**Key insight:** the hard parts of email are reputation, authentication and feedback, which belong to the provider and the sponsor's DNS; the product's job is truthful wording, one renderer, the right sender, and listening to bounces.

## Common Pitfalls

### Pitfall 1: preview drifts from the sent message again
**What goes wrong:** a later plan adds wording in a UI file. **Avoid:** the parity check (4.2-6) in the gate. **Warning sign:** any string literal subject outside `emails.js`.

### Pitfall 2: golden files updated blindly
**What goes wrong:** an executor regenerates goldens to make a test pass and a wording regression ships. **Avoid:** goldens regenerate only with an explicit flag; SUMMARY must paste the golden diff.

### Pitfall 3: SES sandbox mistaken for "working"
**What goes wrong:** sends to verified test addresses succeed, real investors get nothing (sandbox: 200/day, verified recipients only). **Avoid:** the console shows "To be confirmed" until production access is granted and a send to an unverified address succeeds.

### Pitfall 4: DKIM records hard-coded
**What goes wrong:** SES DKIM hosted zones differ per region and identity; hard-coded CNAME targets fail. **Avoid:** build records from the API's returned tokens and `SigningHostedZone` [CITED: AWS docs excerpt].

### Pitfall 5: the free-text guard blocks normal text
**What goes wrong:** `/\d{8,}/` would also catch a long reference number a sponsor legitimately types. **Avoid:** refuse with a sentence that says what to remove ("Remove the long number: emails never carry account or tax numbers") and keep the pattern list identical to help.mjs so behaviour is predictable.

### Pitfall 6: managed edition changed by accident
**What goes wrong:** `console.js` notice preview is shared by both editions; switching it to `emails.js` changes managed output. **Avoid:** managed edition golden of C-04/C-05/notice preview compared with the base tree (status-math C-03 slice guard).

### Pitfall 7: the no-server path makes a request
**What goes wrong:** a "send" helper calls fetch with no server. **Avoid:** no-network check over every simulated path (4.2-8).

### Pitfall 8: logo formats
**What goes wrong:** SVG/WebP logos silently drop to text. **Avoid:** rasterise in the console to PNG before the invitation snapshot, or show "Your logo appears as your firm's name in emails" on the Emails page.

## Code Examples

The current shared layout to extend (verbatim signature, server/lib/mail.mjs:435-436):
```js
/** Shared layout: text and HTML from the same parts. parts: { greeting, paras, note, rows, button, after }. */
function compose(firm, subject, parts) {
```
The current mailer call contract to keep (verbatim, server/lib/invitations.mjs:1194):
```js
const r = await mailer.send(Object.assign({ kind: kind === 'resend' ? 'invitation_resent' : 'invitation', invitationId: rec.id, workspace: rec.workspace, fromName: snap.firm.name, replyTo: snap.firm.supportEmail, to: snap.investor.email, toName: snap.investor.contact }, msg));
```
The tax notice subject that must not change (verbatim, assets/js/taxdocs.js:28-29):
```js
// Rev. Proc. 2012-17 section 7.01: these words, in capital letters, on the notice (the subject line of an email).
const NOTICE_SUBJECT = 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE';
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Any authentication optional | Gmail: SPF or DKIM for all senders; SPF+DKIM+DMARC aligned for bulk | 2024, enforcement progressive [CITED: Google sender guidelines excerpt] | Sponsor domains must be authenticated |
| Exchange Online SMTP basic auth | off by default for existing tenants end of Dec 2026; OAuth needed | revised Jan 2026 [CITED: Microsoft Tech Community excerpt] | "Send through your Microsoft 365 mailbox" stops working without XOAUTH2 |
| SendGrid free plan | retired May 2025 | [CITED: third-party] | Not a $0 option |
| SES flat $0.10/1,000 | plans (Essentials $0.16/1,000 default for new accounts), à la carte still selectable | 2026-07-21 [CITED: AWS what's-new excerpt] | Still cheapest |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | CAN-SPAM opt-out timing (10 business days) and 30-day mechanism life | 2.6 | Low: design honours opt-outs at once |
| A2 | Invitations to a new offering may be "commercial" under CAN-SPAM; the rest transactional | 2.6 | Medium: counsel may classify differently; design supports both (unsubscribe only on flagged kinds) |
| A3 | State anti-spam laws preempted except for falsity | 2.6 | Low |
| A4 | Gmail one-click unsubscribe + 0.3% spam threshold for bulk senders | 2.7 | Low (sponsors rarely bulk) |
| A5 | Email client behaviours (Outlook padding, `<style>` stripping, Gmail 102 KB clipping) | 2.4 | Low: checks cover rendering |
| A6 | Postmark unlimited domains; ZeptoMail domain/webhook support; Mailgun per-domain SMTP; SMTP2GO paid price | 3.2 | Low: only affects the alternatives |
| A7 | SES notifications carry the original Message-ID (`mail.commonHeaders.messageId`) for correlation | 3.3 | Medium: else store the SES message id from the SMTP `250 Ok <id>` reply (smtpSend already returns the reply text) |
| A8 | Google Workspace 2,000/day SMTP limit | 3.2 | Low |
| A9 | Adapter shape names in Pattern 3 | Architecture | None (planner decides) |
| A10 | SES production access is granted for a platform sending on behalf of sponsors | 3.3 | Medium: if refused, Postmark adapter is the fallback ($15+/month) |
| A11 | Sent-log retention default (see Open Question 7) | 2.8 | Low |

## Open Questions (each with the default to use if the owner does not answer)

1. **Which sending provider?** Default: **Amazon SES** on one platform account (pay per use, about $1-2/month at 40 sponsors). Build and test against fakes now; the owner creates the AWS account and requests production access at the phase's owner checkpoint; live email marked "To be confirmed" until then. Fallback if AWS refuses production access: Postmark adapter.
2. **CAN-SPAM classification.** Default: treat invitations to a new offering (S-02 and new-investor invitations with no commitment) and custom notices the sponsor marks "offering news" as possibly commercial: postal address in the footer, one-click unsubscribe from offering invitations; all other messages transactional with no unsubscribe. Shown in the help guide as "To be confirmed with counsel".
3. **Password reset and team invitation emails** (no server identity service exists; accounts.mjs is token-only). Default: templates and console previews now (EM-12), honest "simulated in this demo" toasts now (EM-13); real sending lands with the security step's sign-in accounts.
4. **E-sign emails on the server.** Default: request/reminder/voided/completed as notices with a portal link (no per-envelope token links); the co-investor's own signing link stays the existing invitation `coSign` path.
5. **Managed (Carrow & Vale) edition.** Default: unchanged output (its texts already say no email is sent); `emails.js` loads there but managed renders stay byte-identical (C-03 slice guard).
6. **Firm postal address.** Default: new optional brand field; required only before a possibly-commercial message is sent (the server refuses those without it, with a sentence); printed in every footer when present.
7. **Sent-log retention.** Default: kept while the investor/workspace exists, capped by a server setting `MAIL_LOG_DAYS` defaulting to 2,555 days (7 years) [ASSUMED common records period]; texts kept with personal links redacted.
8. **Automatic investor reminders before a link expires.** Default: not built in phase 13 (the sponsor resends; fewer unsolicited emails); revisit after launch.
9. **Investor confirmation email (EM-10).** Default: build it (one message; replaces a false promise).
10. **Open/click tracking.** Default: off (white label; no value over the portal's own "opened" step).

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | server, tests | yes | v22.23.4 | - |
| Playwright (global) | browser checks | yes | /opt/node22/lib/node_modules/playwright | - |
| Shared check queue | browser checks | yes | SCRATCH/exec-011/heavy.sh | - |
| server/node_modules | server tests | link from /home/user/Hhhh/server/node_modules (SAVE-RULES 7) | - | - |
| Amazon SES account | live sending, live domain records | **no** | - | Fakes for all automated tests; owner checkpoint; outbox meanwhile |
| Outbound network to vendor/law sites | research | partial (ftc.gov, law.cornell.edu not reachable from this session) | - | Search excerpts; claims tagged |
| Disk | builds/checks | 4.7 GB free | - | delete outputs after runs (AUTOPILOT) |

**Missing with no fallback:** none for building and testing. **Missing with fallback:** the SES account (live proof only).

## Security Domain

`security_enforcement: true`, ASVS level 1.

### Applicable ASVS categories
| Category | Applies | Control |
|----------|---------|---------|
| V2 Authentication | yes (webhook, unsubscribe) | SNS signature verification; HMAC-signed unsubscribe tokens (`node:crypto`), constant-time compare (`safeEqual` in crypto.mjs) |
| V3 Session | no | - |
| V4 Access control | yes | sponsor token pins workspace (existing `pinned(auth)` pattern); sent log readable only by its workspace |
| V5 Input validation | yes | header values via `oneLine`; HTML escaped; free-text TIN/bank guard (422); address validation `validAddress` |
| V6 Cryptography | yes | SigV4 HMAC-SHA256; vault seal for the sent log (existing `vault.seal`); never hand-roll ciphers |
| V7 Errors and logging | yes | credentials scrubbed (existing `scrub`), recipient addresses redacted (`redactAddresses`) |
| V8 Data protection | yes | sent log sealed; personal links redacted; no attachments; no TIN/bank in any message |
| V13 API | yes | webhook body size limit, method checks, rate limit on `/v1/messages` |

### Known threat patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Spoofed bounce/complaint webhook | Spoofing/Tampering | Verify SNS signature; cert URL host must be `sns.<region>.amazonaws.com`; reject unsigned |
| SSRF via `SubscribeURL`/`SigningCertURL` | Elevation | Fetch only exact allowed hosts over https |
| Header injection via names/subjects | Tampering | Existing `oneLine` + encoded-words (tested) |
| HTML/script injection via sponsor note | Tampering | `esc()` on every value (tested) |
| Mail-bombing through `/v1/messages` | DoS | Per-workspace rate limit and recipient cap; only the workspace's own investors |
| Unsubscribe token forgery / enumeration | Spoofing/Info disclosure | HMAC token over (workspace, investor, kind); same response for valid/invalid |
| Phishing look-alike (links to other domains) | Spoofing | Only the portal link and `mailto:` support; no tracking redirects |
| PII in logs | Info disclosure | Sealed log, redacted addresses in errors |

## Sources

### Primary (in-repo, read this session)
- server/lib/mail.mjs (whole file), server/lib/invitations.mjs (77-102, 496-600, 800-860, 1100-1210), server/lib/filings.mjs (49, 69-85, 150-250), server/lib/help.mjs (38-52), server/lib/accounts.mjs (1-40), server/README.md (Email, Sponsor accounts), server/package.json, server/test/mail.test.mjs (216-236)
- assets/js/invitations.js (276-330, 2425-2470, 2532-2626), coinvestor.js (86-113, 345, 410-420), console.js (905-918, 1020-1062, 1600-1630, 1715-1730, 2400-2415), data.js (305-384), operations.js (130-150, 600-625), esign.js (180-190, 684-734, 993, 1395-1450), taxdocs.js (20-40, 685-720), taxdocs-ui.js (205-225, 600-612, 640-713), portal.js (1266), diy.js (1-30, 140-160, 324-369), package.js (1-40), tenants.js (40-70), formd.js (head, tail), brand.js (head)
- .planning/ROADMAP.md (Phase 13), .planning/AUTOPILOT.md, .planning/SAVE-RULES.md, .planning/phases/01.4-*/01.4-RESUME.md (lines 98-125, 166-170), .planning/config.json

### Secondary (web search excerpts this session; vendor/official pages)
- [uscode.house.gov 15 U.S.C. 7702](https://uscode.house.gov/us/usc/119-121/t15/s7702/), [eCFR 16 CFR 316.3](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-316/section-316.3), [FDIC manual VIII-4](https://www.fdic.gov/consumer-compliance-examination-manual/viii-4-controlling-assault-non-solicited-pornography-and)
- [Google sender guidelines](https://support.google.com/a/answer/81126), [Google sender FAQ](https://support.google.com/a/answer/14229414)
- [Amazon SES pricing](https://aws.amazon.com/ses/pricing/), [SES pricing plans announcement](https://aws.amazon.com/about-aws/whats-new/2026/07/amazon-ses-pricing-plans/), [SES quotas](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/quotas.html)
- [Postmark pricing](https://postmarkapp.com/pricing), [Postmark Domains API](https://postmarkapp.com/developer/api/domains-api)
- [Resend pricing](https://resend.com/pricing), [ZeptoMail pricing](https://www.zoho.com/zeptomail/pricing.html)
- [Microsoft: SMTP AUTH basic auth timeline](https://techcommunity.microsoft.com/blog/exchange/updated-exchange-online-smtp-auth-basic-authentication-deprecation-timeline/4489835)

### Tertiary (third-party summaries, LOW)
- costbench.com, usecarly.com, automationatlas.io (SendGrid/Mailgun prices), dev.to and classmethod.jp (SES plan rates), sendlayer.com / emailvendorselection.com (SMTP2GO, Brevo, MailerSend free tiers), reply.io / nylas (Gmail SMTP app passwords)

## Metadata

**Confidence breakdown:**
- Inventory and findings: HIGH - every builder and caller read this session; server test count measured (368).
- Architecture (one renderer, per-sponsor sender, adapters): HIGH for fit with the codebase (precedents read); MEDIUM for SES adapter details (to be proven against fakes, then live).
- Provider prices: MEDIUM/LOW - search excerpts; re-check vendor pages before the owner pays.
- Law: MEDIUM for the CAN-SPAM transactional/commercial split (statute excerpts); LOW for timing details and state law (training); classification needs counsel.

**Research date:** 2026-11-20
**Valid until:** 2026-12-20 for prices and vendor terms; in-repo findings valid until the files change.
