---
phase: 13-email-overhaul
plan: 11
subsystem: email
tags: [email, templates, white-label, can-spam, dispatch, umd]
requires: [13-01]
provides: [the remaining message kinds in assets/js/emails.js, the possibly commercial footer, dispatch, summary, prefsAllow, applyPrefs, firmFromTenant, the staff filing order email through emails.js]
affects: [13-04, 13-06, 13-07, 13-08, 13-09, 13-10]
tech-stack:
  added: []
  patterns: [one hand-off function (dispatch) with the caller's api injected, render(kind, data) reading data.variant for kinds with named variants]
key-files:
  created: [server/test/emails-kinds.test.mjs, server/test/fixtures/emails/base-filing.json, server/test/fixtures/emails/ (24 new variants, a .txt and an .html each)]
  modified: [assets/js/emails.js, server/lib/filings.mjs, server/test/emails-render.test.mjs, server/test/emails-guard.test.mjs, server/test/fixtures/emails/ (the 4 commercial invitation goldens and notice-offeringNews, changed on purpose)]
decisions:
  - "Kinds with named variants read data.variant, and fall back to their first variant. For every 13-11 kind the sample key is the render variant."
  - "The expiry sentence goes only in messages whose link expires (data.link and data.expiresAt): invitations, password reset and team invitation. The tax notice link keeps 10-12's 'It stays available until' and has no expiry sentence."
  - "The password reset button reads 'Open the reset page', not 'Choose a new password'. In the text version, 'Choose a new password:' matches the password pattern that every render is scanned with."
  - "Notices and capital calls carry the sponsor's text as typed, with its own greeting and sign-off. render adds no greeting and no support sentence to them."
  - "Tax notice link variant: the URL moves from the sentence into the one button ('To open it on any device, use the link below.'). The text version prints the URL right under that line."
  - "dispatch also refuses a possibly commercial message when the firm has no postal address. It refuses before any request is made or anything is logged."
  - "summary goes beyond the four named sentences with two more: outbox ('no sending service is set up yet') and failed ('try again later'). When nothing was sent it says 'No email was sent.'"
  - "prefsAllow takes an optional fourth argument, the render's commercial flag. This makes an invitation to an offering with no commitment count as commercial."
  - "The staff filing order email keeps its plain one-paragraph HTML, byte-identical to the base. The render test's layout and structure rules skip the staff audience."
metrics:
  completed: 2026-11-27
status: complete
actuals:
  tokens: 52000
  tasks: 3
  commits: 5
plan_head_before: af0b7b95adf50f66c70a26af75430fd9e0bd746c
plan_head_after: ca649eeb20393a25cd980bdf9d63de65f78524bc
---

# Phase 13 Plan 11: every other message in the renderer Summary

assets/js/emails.js now writes every message in the inventory except the managed edition's C-04 and C-05. That covers:

- notices
- capital calls and call reminders
- the tax notice and the consent request
- the four e-sign notices and the "signer declined" message to the sponsor
- the investor confirmation
- the password reset and team invitation templates
- the staff filing order

It also adds the possibly commercial footer and dispatch(), the console's one hand-off to POST /v1/messages. The owner has not checked any of it yet. The wording waits for his read at 13-10. The commercial classification is **To be confirmed with counsel**. Live sending stays **To be confirmed** until 13-10.

## Failures first

1. Task 1 verify, first run: `# fail 1`, a ReferenceError (`data is not defined`). My edit to 13-01's wording loop used `data` without adding it to the loop's destructuring. Fixed, and the rerun passed: `# tests 13`, `# fail 0`.
2. Task 2 verify, first run: `# tests 33`, `# pass 30`, `# fail 3`.
   - Guard test 2: `password_reset investor: /\bpass(word|code)?\s*[:=]/i in password:`. The text line of the "Choose a new password" button tripped the password pattern. The button now reads "Open the reset page".
   - Guard test 4: `tax_notice portal: a domain [ 'harborridge.example' ]`. The tax contact's own email address is printed in the "Questions" line, and the guard did not allow it when the sample firm had no support address. The guard now also allows `data.contact.email`.
   - Render test "wording": `password_reset investor: the expiry sentence once, 0 !== 1`. The test compared against the invitation's fixed expiry date. It now compares against each message's own `expiresAt`.
   - Rerun: `# tests 33`, `# pass 33`, `# fail 0`.
3. Not run, not proven: no message has been read in a real mail client or on a phone. The goldens are text and HTML files only. The List-Unsubscribe headers exist in the render output, but server/lib/mail.mjs (13-03's file) does not pass `headers` through yet. No server sends them until 13-03 or 13-04 wires them.

## RED evidence (as produced)

red-1.txt (Task 1):
```
not ok 1 - tracer: a quarterly notice in the firm’s layout, handed to a stand-in server by dispatch and logged with its status
  name: 'TypeError'
# tests 1
# pass 0
# fail 1
```
red-2.txt (Task 2). Tests 8 and 10 already passed because Task 1's tracer built dispatch and summary:
```
ok 1 - tracer: ...
not ok 2 - inventory: ...            (error: 'S-13: no kind filing_order')
not ok 3 - tax notice: ...
not ok 4 - commercial: ...
not ok 5 - e-sign and confirmation: ...
not ok 6 - staff email: ...
not ok 7 - prefsAllow, applyPrefs and firmFromTenant: ...
ok 8 - dispatch without a server: ...
not ok 9 - dispatch refuses: ...
ok 10 - summary: ...
# tests 10
# pass 3
# fail 7
```

## Verify lines

- Base server count: measured on af0b7b9, 544 (`[ 544 -ge 518 ]`, W6).
- Task 1, `node --test` of emails-kinds, emails-render and emails-guard: `# tests 13`, `# pass 13`, `# fail 0`. VERIFY=0.
- Task 2, the same three files plus filings.test.mjs: `# tests 33`, `# pass 33`, `# fail 0`. The other checks:
  - `test -n "$(ls tax_consent*.txt)"` passes.
  - `! grep -l 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE' server/test/fixtures/emails/tax_consent*.txt` passes (B4).
  - 61 text goldens (at least 55 required).
  - Each of the 14 new kinds has at least one golden (W5).
  - VERIFY=0.
- Full server suite on the plan tree: `# tests 554`, `# pass 554`, `# fail 0`.
- Task 3:
  - `head -n 1 server/test/emails-kinds.test.mjs` is `// gate: tests 10`.
  - `git diff af0b7b9 HEAD` is empty for server/lib/mail.mjs, server/lib/taxdocs.mjs, server/index.mjs and assets/js/onboarding.js. It is also empty for 15-06's files: server/lib/roles.mjs, server/lib/workspace.mjs and server/README.md.

## Gate

Command:

```
rm -f $O/gate.txt; G=$P/checks/gate13.sh; [ -f $G ] || exit 1; GATE13_PHASES="09" GATE_OUT=$O bash $G
```

O is scratchpad/exec-13-11, and base-commit.txt is af0b7b9. There were 43 "GATE ok" lines, no "GATE FAIL" and no note line. The last lines, verbatim:
```
GATE ok   server tests 554 = base 544 + 10 declared
GATE ok   ACCESS FLOW
GATE ok   BLUESKY FLOW
GATE ok   BLUESKY MATH
GATE ok   FILINGS FLOW
GATE ok   FILINGS MATH
GATE ok   FILINGS SERVER
GATE ok   FORMD FLOW
GATE ok   FORMD XML
GATE ok   phase 13 checks: none in this tree
GATE_EXIT=0
```
GATE_EXIT=0. Server tests: 554 = 544 + 10.

## What was built

| Kind | Audience | Variants | Subject (sample) |
|------|----------|----------|------------------|
| notice | investor | quarterly, documents, custom, offeringNews | the sponsor's own |
| capital_call | investor | call | the sponsor's own (operations.js wording) |
| capital_call_reminder | investor | reminder | the sponsor's own ("Reminder: capital call 2 ...") |
| confirmation | investor | onboarding, subscription, taxForm, coSign, reverify | `Harbor Ridge Capital: we received your ...` |
| tax_notice | investor | portal, link | `IMPORTANT TAX RETURN DOCUMENT AVAILABLE` |
| tax_consent | investor | link | `Your consent to receive tax documents electronically` |
| esign_request / esign_reminder / esign_voided / esign_completed | investor | portal | `<firm>: please sign <title>` / `reminder to sign` / `<title> was withdrawn` / `<title> is signed by everyone` |
| esign_declined | sponsor | console | `<signer> declined to sign <title>` |
| password_reset | investor | investor, team | `<firm>: reset your password` |
| team_invitation | team | team | `<firm>: you are invited to the console` |
| filing_order | staff | placed, changed | the base text, byte for byte |

Messages that count as possibly commercial (C-02, "To be confirmed with counsel"):

- invitation and invitation_resent `subscribe`
- `new` with an offering and a commitment of 0
- notice `offeringNews`

Their footer adds the firm's postal address and one line telling the investor how to stop these emails:

- With `data.unsubscribeUrl`, the line is `To stop invitations to new offerings from <firm>, use this link: <url>`, and the render adds the `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers.
- Without one, the line is `To stop invitations to new offerings from <firm>, reply to this email.`
- When the firm has no postal address, render returns `needs: ['postalAddress']`.

Every other message is transactional: `commercial: false`, `headers: {}`, `needs: []`. The quarterly and documents notices end with `To stop these notices, open Account in your portal and change your email choices.` (13-08 builds those switches).

The other functions:

- **dispatch(...)**
  - It screens every item's subject and body with screen(). A refused item rejects the whole send with screen()'s sentence, before any request is made or anything is logged.
  - It refuses a commercial message when the firm has no postal address.
  - It marks investors whose preference is off as `unsubscribed` and does not send to them.
  - With a server, it makes one `api('POST', '/v1/messages', { workspace, kind, variant, firm, portalUrl, offeringNews, recipients })` call. Each result is logged with the server's status and the locally rendered text, with the personal link redacted.
  - Without a server, it makes no request and logs each item as `simulated`.
- **summary(counts, connected)**: one sentence. For example "Emailed to 3 investors. 1 is waiting: your sending domain is not ready." Without a server: "Email to 3 investors (simulated in this demo)."
- **filings.mjs notifyStaff(rec, 'placed' | 'changed')** renders through `emails.render('filing_order', ...)`. The old SERVICE table, htmlOf and the money import are removed from filings.mjs.

Test counts: server/test/emails-kinds.test.mjs has 10 tests (`// gate: tests 10`). The emails-render (8) and emails-guard (4) counts are unchanged.

## Edits to 13-01's loop tests (plan-check B3, counts unchanged)

**emails-render.test.mjs**
- VARIANTS holds every new kind, so goldens, buttons and structure cover them.
- The builder comparison runs only for the four kinds that have a mail.mjs builder.
- The "Reminder:" ban applies to invitation and invitation_resent subjects only.
- The expiry sentence must appear exactly once, with the message's own date, when the data has a link and an `expiresAt`; otherwise "This link is personal to you" must not appear.
- The support sentence appears once with an expiring link, otherwise at most once.
- The button may lead to data.link, data.portalUrl or data.consoleUrl.
- The structure test skips the staff audience.

**emails-guard.test.mjs**
- The allowed links are link, portalUrl, consoleUrl and unsubscribeUrl, in both their plain and escaped forms. The pattern scan and the link and domain scan both take them out first.
- A tax notice's contact address may be printed.

## Goldens

New (24 variants, a .txt and an .html each):
- capital_call-call
- capital_call_reminder-reminder
- confirmation-onboarding, confirmation-subscription, confirmation-taxForm, confirmation-coSign, confirmation-reverify
- esign_request-portal, esign_reminder-portal, esign_voided-portal, esign_completed-portal, esign_declined-console
- filing_order-placed, filing_order-changed
- notice-quarterly, notice-documents, notice-custom, notice-offeringNews
- password_reset-investor, password_reset-team
- tax_consent-link
- tax_notice-portal, tax_notice-link
- team_invitation-team

base-filing.json is the base tree's staff email (W4). It was built from lines 193-196 of `git show af0b7b9:server/lib/filings.mjs` and run with that commit's mail.mjs money(), all copied out with git show and never taken from the working tree. The fixture records the base commit.

Changed on purpose: the commercial invitation goldens. The diff is the same for all four .txt files (invitation-subscribe, invitation-subscribe-tax, invitation_resent-subscribe, invitation_resent-subscribe-tax), and the .html files follow it:
```
 --
 Harbor Ridge Capital Management LLC

+1 Harbor Way, Boston, MA 02110
+
 This message is not an offer to sell securities.
+
+To stop invitations to new offerings from Harbor Ridge Capital, reply to this email.
```
The samples behind those goldens now give the firm a postal address. notice-offeringNews was regenerated in Task 2 when the footer landed: it now has the address and the one-click stop link. No other 13-01 golden changed.

Three goldens in full:

notice-quarterly.txt
```
Subject: Q3 2026 report for Harbor Ridge Fund II is now available
Preheader: The Q3 2026 quarterly report for Harbor Ridge Fund II has been posted to your Harbor Ridge Investor Portal. Sign in and open Documents to read it.

Dear Anita,

The Q3 2026 quarterly report for Harbor Ridge Fund II has been posted to your Harbor Ridge Investor Portal. Sign in and open Documents to read it.

If you have any questions, contact Investor Relations at +1 212 555 0100.

Harbor Ridge Capital

Sign in to Harbor Ridge Investor Portal:
https://portal.example/portal.html

To stop these notices, open Account in your portal and change your email choices.

--
Harbor Ridge Capital Management LLC

This message is not an offer to sell securities.
```

tax_notice-link.txt
```
Subject: IMPORTANT TAX RETURN DOCUMENT AVAILABLE
Preheader: Harbor Ridge Capital has posted a tax document for you: Schedule K-1 for 2026, Harbor Ridge Fund II.

Dear Anita,

Harbor Ridge Capital has posted a tax document for you: Schedule K-1 for 2026, Harbor Ridge Fund II.

To open it on any device, use the link below.

Open your tax document:
https://portal.example/portal.html?server=https%3A%2F%2Fapi.example#taxdoc-sample

You will be asked for the last four digits of the tax number you gave Harbor Ridge Capital. Once the document is open, use Save to keep a copy, and print the saved file.

It stays available until October 15, 2027.

Questions: Investor Relations, Harbor Ridge Capital, 1 Harbor Way, Boston, MA 02110, telephone +1 212 555 0100, email ir@harborridge.example.

--
Harbor Ridge Capital Management LLC

This message is not an offer to sell securities.
```

confirmation-onboarding.txt
```
Subject: Harbor Ridge Capital: we received your onboarding
Preheader: Thank you. Harbor Ridge Capital received your completed investor onboarding for Harbor Ridge Fund II on November 10, 2026.

Dear Anita,

Thank you. Harbor Ridge Capital received your completed investor onboarding for Harbor Ridge Fund II on November 10, 2026.

What happens next: Harbor Ridge Capital reviews it and will contact you if anything else is needed. Nothing is due from you now.

Open your portal:
https://portal.example/portal.html

Questions? Contact Investor Relations at ir@harborridge.example or +1 212 555 0100.

--
Harbor Ridge Capital Management LLC

This message is not an offer to sell securities.
```

## Deviations from Plan

1. **Tracer button label.** The plan's tracer expected 'Sign in to Harbor Ridge Portal'. The sample firm's portal is named 'Harbor Ridge Investor Portal' (13-01's SAMPLE_FIRM, which feeds every golden), so the test asserts `Sign in to ${firm.portalName}`.
2. **[Rule 1] Password reset button.** It reads 'Open the reset page' instead of 'Choose a new password' (see Failures first, item 2).
3. **[Rule 2] Postal address refusal.** dispatch refuses a commercial message without a postal address, so the console cannot hand one over. This is asserted in test 9.
4. **[Rule 2] Two more summary sentences.** summary has sentences for `outbox` and `failed`, so an unsent message is never reported as emailed.
5. **New log status.** `'unsubscribed'` joined emails.js STATUSES, because dispatch logs it.
6. **Tax wording.** The tax notice link variant and tax_consent move the URL into the button ("use the link below") and add a greeting. The portal variant formats the date as a long date. Otherwise the 10-12 wording is kept sentence for sentence. 13-07 wires taxdocs.mjs to these kinds in wave 3 and should compare its own tests against these goldens.
7. **Staff audience.** The staff audience is exempt from the layout and structure test. The staff email's HTML is the base's one paragraph, byte for byte.

No new package. No account or key was used. No guide bytes changed. No file of 15-06 was touched.

## Open items

- The wording of every new kind waits for the owner's read at 13-10.
- The commercial classification is **To be confirmed with counsel**.
- List-Unsubscribe headers are rendered but not yet sent: mail.mjs builders and sends drop `headers` (13-03 or 13-04).
- The co-investor confirmation carries an 'Open your portal' button. A co-investor may have no portal login. The caller (13-07 or 13-09) should pass no portalUrl then, and the message then has no button.
- Password reset and team invitation are templates only (C-03). Nothing sends them in this phase.
- The "Account > email choices" stop line points to the switches 13-08 builds.

## Self-Check: PASSED

- FOUND: assets/js/emails.js, server/lib/filings.mjs, server/test/emails-kinds.test.mjs, server/test/fixtures/emails/base-filing.json, the 24 new golden pairs.
- FOUND commits: 2fc4c9f, 222e138, 33e5f4a, ca649ee, all ancestors of HEAD.
