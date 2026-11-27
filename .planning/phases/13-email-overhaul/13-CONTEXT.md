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

## After 13-02 (merged 2026-11-20; server tests 387)
- Every .mjs under server/test counts as at least one test with node --test, so helper files count one each (ses-fake.mjs carries `// gate: tests 1`). Later plans count helper files the same way.
- Owner-run items for 13-10: the provider's v2 request and response shapes, the private-key encoding (base64 PKCS#1 DER), the event fields (mail.commonHeaders.messageId with angle brackets), and the certificate host pattern.
- A domain already used by another workspace is refused with 409. A domain the provider already holds gets the new key (PUT .../dkim/signing). A DMARC record is offered only when the lookup proves none exists (ENOTFOUND or ENODATA), never after a timeout.

## From phase 16 (2026-11-27)
- 13-01-PLAN.md:174 and 13-06-PLAN.md:115 use a real bank routing number (ending 0021) as test data. Executors use its never-issued image instead (prefix 13, same last seven digits, as 16-03 swapped it in server/test/invitations.test.mjs); ACH LEAK must keep passing.

## Plan-check additions, 13-01 re-check (checked 2026-11-27 against a4e2a54; 3 blockers fixed here, 7 warnings). Executors apply these with their plan. Findings: scratchpad checks-13-01-recheck.md.
- B1 (Task 3): .planning/phases/13-email-overhaul/checks/gate13.sh joins 13-01's files. Before `cp "$GATE_OUT/base-commit.txt" "$G/base-commit.txt"` add gate14.sh's rule: a different base commit than GATE_OUT/gate/base-commit.txt sets `export GATE_FRESH=1` and prints "GATE note: base commit changed; every step runs again". `--self-test` still ends PASS (8).
- B2 (Task 2 RED): build base-sponsor.json from `git show $BASE:server/lib/mail.mjs > $O/base/lib/mail.mjs` and `git show $BASE:server/lib/crypto.mjs > $O/base/lib/crypto.mjs` (mail.mjs imports ./crypto.mjs); never from the working tree.
- B3: test 1 of the guard file uses '131000021', never '021000021' (as "From phase 16").
- W1 (Task 3 verify): starts `rm -f $O/gate.txt;`; `G=$P/checks/gate13.sh; [ -f $G ] || exit 1;` before the gate (no gate10 fallback).
- W2: GATE13_PHASES="08 09 10" (08's reverify.js reads the server's reverify email).
- W3: Task 1 verify adds `[ "$(cat $O/base-count.txt)" -ge 478 ] || exit 1;`. From a4e2a54: 478 -> 486 (Task 2) -> 490 (Task 3).
- W4 (08-09 variants): invitation and invitation_resent gain reverify (resend subject 'New link: <Firm>: verify your accredited investor status'; text keeps "verify your accredited investor status again", button "Verify your accreditation"); submission_reminder = onboarding, subscription, taxRequest, reverify, coSign; sponsor_notification includes reverify-reverified and reverify-finished; base-sponsor.json and test 3 hold every one.
- W5 (assertions; line numbers stale, find by grep): invitations-reverify.test.mjs:150 'Reminder: Harbor Ridge Capital: verify your accredited investor status' -> 'New link: Harbor Ridge Capital: verify your accredited investor status'; co-investor-server.js:535 `Dear ${F.coName}` -> `Dear ${F.coFirst},` (wave-1 B1 moved).
- W6 (Task 3 verify): also `node .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/ach-leak.js --case checks > $O/ach.txt 2>&1 && grep -q '^ACH LEAK: PASS' $O/ach.txt`.
- W7: EM-01 here covers the four builders and reverifyMessage; taxdocs.mjs messages move in 13-07; filing_order and package_alert are staff-only and stay out.
- Start: now, with these. No running build edits 13-01's files; no guide line (any goes to GUIDE-PASS.md).

## Plan-check additions, wave 2 (13-03, 13-05, 13-11), checked against 392bbbc, 2026-11-27
Binding on the executors (full text with each fix: scratchpad checks-13-wave2.md).
- B1 (13-03): starts after 15-05 merges. Adds server/lib/roles.mjs to its files with ROUTES lines: GET /v1/mail/sender 'view'; PUT /v1/mail/sender 'configure'; POST /v1/mail/sender/check 'configure'; GET /v1/messages/log with the permission that already guards personal data; other('POST', '/v1/mail/events', 'public', signature checked by the adapter). A test: a signed-in person whose role lacks configure gets 403 on PUT /v1/mail/sender.
- B2 (all three): test numbers from never-issued ranges: '000-12-3456' (not '123-45-6789') and '991234567890' (not '000123456789'). Both still match 13-01's patterns.
- B3 (13-11): adds server/test/emails-render.test.mjs and emails-guard.test.mjs to its files (read 13-01's merged tests first): the expiry rule covers only messages with a personal link; allowed hrefs are link, portalUrl, consoleUrl and unsubscribeUrl; the "Reminder:" subject ban covers invitation and resend subjects only. Test counts unchanged.
- B4 (13-11 Task 2 verify): use `! grep -l 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE' server/test/fixtures/emails/tax_consent*.txt`.
- W1 (all three): final gate verify starts `rm -f $O/gate.txt;` and `G=$P/checks/gate13.sh; [ -f $G ] || exit 1;` before `bash $G`.
- W2 (13-03): server/README.md "## Email" found by grep (not line 352); keep 15-05's `auth.can` check in invitations.mjs.
- W3 (13-05 tracer): the invite gives a commitment (e.g. cents 25000000) or a postal address, so the outbox is reached.
- W4 (13-11 test 6): the base staff-email output is built from a base-tree worktree with a FILINGS=1 server, or from lines 193-196 of `git show $BASE:server/lib/filings.mjs`.
- W5 (13-11 Task 2): at least one golden per new kind, besides the 55 total.
- W6 (13-03, 13-11 Task 1): `[ "$(cat $O/base-count.txt)" -ge 518 ] || exit 1;` (measured base, 506 now plus 13-01's).
- Start: 13-03 after 13-01 and 15-05 merge; 13-05 after 13-01, 08-20 and 11-16 merge; 13-11 after 13-01 merges (09-08 not running).

## After 13-01 (merged 323fae3, 2026-11-27)
- Gate13 GATE_EXIT=0 (GATE13_PHASES="08 09 10"); plan tree 490 = 478 + 12. Merged tree 533 of 533; one conflict in server/test/mail.test.mjs resolved by keeping both (13-01's BANNED + model names, scanned through stripLinkTokens).
- Interface change for later plans: emails.js's BANNED no longer holds the model maker's two names (no line of assets/js may spell them); tests that check renders add them on the test side (MODEL_NAMES in emails-guard.test.mjs).
- emails.js uses the server's address rule for the support mailto (an address ending `&cc=x` no longer becomes a link).
- 37 variants with .txt and .html goldens; sponsor messages byte-identical to the base builders.
- Seen once, not 13-01's: server/test/auth-gate.test.mjs "operator" failed in one full run because a random id matched its `/pw|.../` scan (6 reruns pass). Same random-text class as scan-tokens; queued.
- Owner's read of the wording at 13-10 (sponsor messages name the investor as the console holds the name, e.g. "Shah, Anita").
- Wave 2 can start: 13-11 now; 13-03 now (15-05 merged); 13-05 after 11-16 merges.
