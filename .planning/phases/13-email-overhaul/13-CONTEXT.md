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
- Combined merged tree af0b7b9 (15-05 + 13-01 + 15-04): EMAIL DIALOG 3, CO-INVESTOR SERVER 5, SERVER MODE 15 pass; GATE13 SELF-TEST PASS (8); server tests 544/544.

## After 13-11 (merged 2026-11-27)
- Gate13 (GATE13_PHASES="09", as the plan names) GATE_EXIT=0; plan tree 554 = 544 + 10. Merged tree: run 1 553/554 (auth-gate.test.mjs "operator": its `/pw|emailIndex|salt|hash|session/i` scan over the whole response text matched a random id; second time today), run 2 554/554. A quick task fixes that test (auth-gate-scan).
- 24 new variants, 61 text goldens; staff filing email byte-identical to the base and rendered through emails.js; commercial footer (postal address + a way to stop) on subscribe invitations, offering invitations with no commitment, their new-link resends and offering-news notices ("To be confirmed with counsel"); dispatch refuses a possibly commercial message when the firm has no postal address.
- Deviations: password reset button reads 'Open the reset page' (the text version "Choose a new password:" tripped the password scan); tax notice link and consent emails put the URL in the button and add a greeting and long dates (13-07 checks its tests against these goldens); 'unsubscribed' added to the mail log statuses.
- Open: List-Unsubscribe headers are rendered but mail.mjs does not pass headers through yet (13-03 or 13-04); co-investor confirmation's 'Open your portal' button: the caller passes no portalUrl when the co-investor has no portal login; owner's read at 13-10; counsel on the commercial classification.
- Unblocked: 15-14 needs 13-03 too; 14-13 (after 13-01 and 13-11, while no plan edits emails.js; it waits for 15-14 per 15's roadmap line).

## Plan-check additions, wave 3 (13-04, 13-07, 13-09, 13-12), checked against 8100e81, 2026-11-27
Binding on the executors (full text: scratchpad checks-13-wave3.md).
- B1 (13-04): add server/lib/roles.mjs (lines only): team('POST',{path:'/v1/messages'},'operate',true); team('GET',{path:'/v1/messages/preferences'},'view',true); the /unsubscribe page outside /v1 rate-limited by 13-04 itself (an other() line if the walk sees it). A test: a role without operate gets 403 on POST /v1/messages (count stays +17).
- B2, B3: 13-04 and 13-07 depend on 13-03, 13-05 and 13-11.
- B4 (13-12 api-export): use 13-03's note screen (POST /v1/invitations with a note holding '000-12-3456' answers 422 with screen()'s sentence), not 13-04's route.
- B5 (13-04, 13-12): fixtures '000-12-3456' and '991234567890'.
- B6 (13-04): render gets the footer address (portal page `#unsubscribe-<token>`); mailer.send headers = Object.assign({}, r.headers, {'List-Unsubscribe': '<'+header+'>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'}) with the server's POST endpoint; tests read the header from the fake SMTP raw message and the footer from the text and assert they differ.
- B7 (13-04), orchestrator's choice: the unsubscribe signing key is a random 32-byte secret made once with node:crypto and stored through vault.seal in a store record (no vault.mjs change); "forged" means signed by another server's key.
- W1 (all four): final gate verify starts `rm -f $O/gate.txt;` and has `G=$P/checks/gate13.sh; [ -f $G ] || exit 1;`.
- W2 (13-04, 13-07): `[ "$(cat $O/base-count.txt)" -ge <measured base> ] || exit 1;` (555 today, plus 13-03's 17 once merged).
- W3 (13-07): taxdocs.mjs builds createMailLog({store, vault, env, now}) itself and filters list() by refId (no index.mjs change).
- W4, orchestrator's choice: 13-03 accepts 'unsubscribed' in maillog.mjs's status set (13-03 has not started; this is binding on it), so 13-04 needs no maillog.mjs edit.
- W5 (13-04): an invitation is refused 422 for the postal rule only when an email is actually sent and needs includes 'postalAddress'.
- W6 (13-09): emails-ui.js makes its own fetch to serverUrl(ws) with the console's token (as taxlink.js does), using NS.integrations.api only when present.
- W7 (13-09): measure GUIDE.sponsor in the Task 3 verify (44,766 of 48,000 now); lines that do not fit go to .planning/GUIDE-PASS.md; the summary reports the size.
- W8: no whole-text word scan over random content: 13-12 cuts the DKIM record values out before the BANNED scan (or the fakes use a fixed key); 13-04 names its token-shape regex, applied after stripLinkTokens; 13-07 uses a literal last four that appears in no date, phone or amount.
- W9 (13-09, 13-12): BANNED.concat(MODEL_NAMES) with [/anthropic/i, /claude/i], as emails-guard.test.mjs does.
- I5 (13-09): 'sponsor' audience kinds go under "To your team"; the preview is drawn from the body's inner content keeping its inline background.
- Start: 13-04 after 13-03, 13-05, 13-11 merge (shares index.mjs, invitations.mjs, roles.mjs with 13-03 and 15-06). 13-07 after 13-03 and 13-05. 13-09 after 13-03 and 13-05, and not beside 16-02 (console.js, diy.html, portal.html). 13-12 after 13-03 and 13-05.
- Addition for 13-03 (binding, from W4): maillog.mjs's status set includes 'unsubscribed'.
- Merged tree 8100e81: FILINGS SERVER 7, EMAIL DIALOG 3, SERVER MODE 15 pass; GATE13 SELF-TEST PASS (8).
