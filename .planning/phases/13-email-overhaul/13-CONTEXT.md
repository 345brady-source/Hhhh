# Phase 13 context: Email overhaul

Why this is built: the self-serve portal is the funnel that brings sponsors to Carrow & Vale. Every email an investor gets carries the sponsor's firm (white label) and must arrive; a sponsor whose invitations land in spam leaves.

Owner instruction (2026-11-20, verbatim): "work around whatever bullshit you think you need me for". Open questions take the researcher's recommended defaults below. Anything needing counsel shows "To be confirmed with counsel"; anything needing the owner's account shows "To be confirmed" and is never faked.

## Choices (orchestrator, 2026-11-20, from 13-RESEARCH.md)
- C-01 Provider: Amazon SES on one platform account, as the default (about $1.20-1.92 a month at 12,000 messages; Postmark is the fallback if AWS refuses production access). Code stays provider-neutral: SMTP remains the only send path; adapters in server/mailers/{smtp,ses}.mjs handle domain records, status and delivery events. Built and tested against fakes; live sending waits for the owner's AWS account at the 13-10 checkpoint, and the console shows "To be confirmed" until then. The outside-option table in 13-RESEARCH.md is reported to the owner.
- C-02 CAN-SPAM split: invitations to a new offering and "offering news" custom notices count as possibly commercial (postal address in the footer, one-click unsubscribe); everything else is transactional. "To be confirmed with counsel".
- C-03 Password reset and team invitation: templates, previews and honest toasts now; real sending comes with the security step's sign-in accounts.
- C-04 E-sign server emails are sent as notices with a portal link; the co-investor keeps the existing sign-in link path.
- C-05 The managed edition's output stays byte-identical.
- C-06 The firm's postal address is a new optional brand field, required only before possibly commercial mail is sent.
- C-07 Sent log retention: while the investor or workspace exists, capped by MAIL_LOG_DAYS (default 2,555 days, assumed 7 years).
- C-08 No automatic expiry reminders to investors in this phase.
- C-09 Build the investor confirmation email (an e-sign toast already claims the completed copy was emailed).
- C-10 Open and click tracking: off.
- C-11 Never fall back to a platform domain when a sponsor's domain is not ready: keep the message in the outbox and tell the sponsor why.
- C-12 No attachments, ever (signed documents carry taxpayer numbers). Sponsor free text is screened; the server refuses with 422.
- C-13 onboarding.js is not edited in this phase; invitations.js, esign.js and console.js each have one owner plan per wave.

## Plan-check additions, wave 1 (13-01, 13-02; checked 2026-11-20; 1 blocker, 5 warnings). Executors apply these with their plan. Findings: scratchpad checks-13-wave1.md.
- Decision: 13-01 keeps its wait for 08-09 (otherwise 08-09 and 13-01 collide in mail.mjs). 13-02 starts now.
- B1 (blocker, 13-01 Tasks 2 and 3): .planning/phases/06-*/checks/co-investor-server.js joins 13-01's files. Line 499 becomes ``text.indexOf(`Dear ${F.coFirst},`) >= 0`` (coFirst is already set at line 562), because the new rule greets by given name only. List the change with the other assertion edits.
- W2 (13-01 Task 2): also change server/test/invitations-cosign.test.mjs:132 (the old support line) and server/test/mail.test.mjs:222 ('Dear Ann Lee,' and the Investor Relations line) to "Dear Ann," and the supportSentence wording.
- W3 (13-01 Task 2, tests 5 and 6): "exactly one data-button whose href equals data.link, cell at least 44 px" applies to investor messages only. For sponsor messages: at most one button, and when there is one, href === consoleUrl (mail.mjs:614-692 has no button when consoleUrl is null).
- W5 (13-02, gate13 self-test): the wording becomes "each of the eight faults (gate11's six plus the phase 08 and GATE13_PHASES stand-ins) ends GATE FAIL and GATE_EXIT=1; the control is not counted", expecting PASS (8).
- W6 (13-02 Task 2): join each TXT record's pieces before comparing (a 2048-bit DKIM key is split into strings of at most 255 characters; resolveTxt returns arrays) in smtp.mjs and wherever ses.mjs checks DNS. "Check ready" adds a fake resolver returning the DKIM record in two pieces.
- Note for the 13-10 checkpoint: with bring-your-own-key DKIM and no custom MAIL FROM, raw headers carry the provider's Return-Path and a second DKIM signature in the provider's domain. The visible message and the DNS records the sponsor copies stay white label; the provider's name appears only in "show original".
- Server test count today: 368. After 13-02: 386.
