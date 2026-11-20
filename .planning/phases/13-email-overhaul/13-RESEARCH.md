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
