---
phase: 13-email-overhaul
plan: 07
subsystem: tax-document email
status: complete
tags: [email, tax-documents, sent-log, bounces, rev-proc-2012-17]
requires: [13-03, 13-05, 13-11, 10-12]
provides: [tax notice and consent request on emails.js (server and console), bounced emailStatus with bouncedAt on GET /v1/taxdocs, automatic notice-came-back marking, workspace sent-log entries for tax notices, checks/tax-notice.js]
affects: [13-10, 10-13]
tech-stack:
  added: []
  patterns: [taxdocs.mjs builds its own createMailLog over the shared store and reads list() by refId, the console renders the same message the server sent to log it]
key-files:
  created: [server/test/taxdocs-mail.test.mjs, .planning/phases/13-email-overhaul/checks/tax-notice.js]
  modified: [server/lib/taxdocs.mjs, assets/js/taxlink.js, assets/js/taxdocs.js, .planning/phases/10-investor-tax-documents-and-withholding/checks/taxdocs-math.js]
decisions:
  - "Only the latest notice entry (subject IMPORTANT TAX RETURN DOCUMENT AVAILABLE) of a document counts: a bounced consent request, or an earlier notice followed by a resend that went out, does not mark the notice as came back"
  - "The day the notice came back is the console's own calendar day of the bounce time (as NS.dates.today reads today), so the 30 days for paper never start later than the sponsor's own date"
  - "A row whose notice bounced offers no Resend: the address is on the bounce list, so a new link to it would not be sent; the row says to send on paper"
metrics:
  completed: 2026-11-27
actuals:
  tokens: 13500    # chars/4 over the realized diff of the six changed files (54,103 characters); the estimate was 85,000
  tasks: 3
  commits: 7       # git rev-list --count 75b2fc5..fb6fe0e; this summary's final commit is the 8th
plan_head_before: 75b2fc5e6d774cdbd74370c34b8c7e445b6b8415
plan_head_after: fb6fe0e7d412d804c74154b31b9f122fbe6339c0
---

# Phase 13 Plan 07: tax-document notices through the shared mailer and sent log Summary

Every tax notice now comes from the one template set (assets/js/emails.js). That covers the notice the sponsor copies or opens in their own email app, and the notice and consent request the server sends. The Questions line never prints an empty slot. When the server's notice comes back as a signed permanent bounce, the Tax documents page marks the notice as came back by itself the next time it opens, and the 30 days for paper start (Rev. Proc. 2012-17 section 7.02).

All of this was proven against local stand-ins only: a local relay and a locally signed bounce. Real bounces need the owner's provider account at 13-10, and live sending stays "To be confirmed". Nothing here is ready until the owner has checked it.

## Failures and shortfalls first

- **The TDD order broke in Task 2 on the server side.** Task 1's GREEN already moved both server messages onto emails.js and passed investorId and refId to the mailer, so Task 2's three new server tests (consent, transient, log) passed as soon as they were written. To show they catch what they test, they were also run against the base server/lib/taxdocs.mjs (75b2fc5): tracer, consent and log fail there. Transient passes there, because it guards that a transient bounce changes nothing, and the base never marked anything. Task 2's browser parts did have a true RED (below).
- **The RED and GREEN code for Tasks 1 and 2 sit in "wip(13-07): save" commits** (save rule 2: commit before every long run). The task commits a96fd1c and 0f4f56f carry no files of their own; they name the code in the save commit before them. Order: e141a26 (RED 1), 3511b7a (code 1), a96fd1c (Task 1 marker), 4f8d616 (RED 2), bae14e2 (code 2), 0f4f56f (Task 2 marker).
- **Deviation outside the plan's assertion rule (P10 taxdocs-math.js).** Its vm portal loaded data.js, audit.js, operations.js and taxdocs.js only, with no emails.js, so NS.taxdocs.notice refused: "dates ran to the end :: Error: The email templates are not loaded." Its setup() now loads emails.js before taxdocs.js, as diy.html and portal.html do. That is one setup line beyond the one assertion the plan names. The case count stays 11.
- **Not covered:** the notice the server sends after an investor consents at the link gets an entry in the server's sent log but none in the workspace's log, because the console never sees that message. Only the server's log has it.
- **Gate run 1 stopped at the two-hour background limit.** It was in the phase 10 checks, after "GATE ok TAX1099 FLOW" and before TAXDOCS FLOW, with no GATE FAIL up to that point (run 1's output is in SCRATCH/exec-13-07/gate-run1.txt). Run 2 went into the same GATE_OUT and kept every step that had passed. It ran TAXDOCS FLOW, TAXDOCS MATH, TAXLINK FLOW, TAXRECORD FLOW, WITHHOLDING FLOW and the three phase 13 checks fresh. It ended GATE_EXIT=0 with 57 "GATE ok" and 0 "GATE FAIL".
- The first run was slow because other executors' browser checks shared the three heavy.sh slots. No timing was measured beyond that.

## RED evidence (as produced)

red-1.txt (Task 1), server tracer against the code before Task 1:
```
not ok 1 - tracer
# pass 0
# fail 1
    the notice is emails.js tax_notice (link variant) for the same data
    + 'Harbor Ridge Capital has posted a tax document for you: Schedule K-1 (Form 1065) 2026.\n' +
    - 'Dear Zelda,\n' +
```
red-1.txt, checks/tax-notice.js --only bounce-phone:
```
PASS bounce-phone the signed permanent bounce is taken by the server (received 1)
FAIL bounce-phone the server's list says the notice bounced, with when :: {..."status":"sent",...,"emailStatus":"sent","availableUntil":"2027-05-27"}
FAIL bounce-phone the notice is marked as came back on 2026-11-27, paper due by 2026-12-27 (30 calendar days, section 7.02) :: {"at":"2026-11-27T14:33:22Z","how":"email","bounced":"","paperBy":""}
FAIL bounce-phone the Send on paper list has the row "Notice came back on November 27, 2026 · paper due by December 27, 2026" ::
FAIL bounce-phone one change-log entry records that the notice came back :: 0
FAIL bounce-phone opening the page again marks nothing twice :: 0
TAX NOTICE: FAIL (parts run: 1) - bounce-phone
```
red-2.txt (Task 2), server tests 2 to 4 against the base server/lib/taxdocs.mjs (on the tree after Task 1 all four pass; see failures):
```
not ok 1 - tracer
not ok 2 - consent      (the consent request is emails.js tax_consent for the same data)
ok 3 - transient
not ok 4 - log          ('' !== 'HRC-0007': no investorId on the sent-log entry)
# pass 1
# fail 3
```
red-2.txt, checks/tax-notice.js --only mailto-desktop,empty-slots,log-noserver:
```
FAIL mailto-desktop the notice shows emails.js tax_notice (portal variant) for the same data, block for block
FAIL mailto-desktop its Email link opens the sponsor's own email with that subject and the render's text, byte for byte
FAIL empty-slots the Questions line lists only what is there: "Questions: Kestrel Bay Investor Relations, 1 Market Street, Wilmington, DE 19801." :: Questions: Kestrel Bay Investor Relations, 1 Market Street, Wilmington, DE 19801, telephone , email .
FAIL empty-slots no empty slot anywhere in the notice: no 'telephone ,', no 'email .', no double space
FAIL empty-slots and it is the render for the same data
FAIL log-noserver with the server, the delivery's notice leaves one workspace sent-log entry with the server's status :: {"log":[],"link":{...,"emailStatus":"outbox",...}}
FAIL log-noserver its text is the server's message with the personal link replaced by [personal link]
TAX NOTICE: FAIL (parts run: 3) - mailto-desktop, empty-slots, log-noserver
```
P10 taxdocs-math.js after taxdocs.js moved onto emails.js, before its two edits:
```
FAIL dates ran to the end :: Error: The email templates are not loaded.
TAXDOCS MATH: FAIL (cases run: 11) - dates
```

## Verify lines

Task 1 verify (VERIFY_EXIT=0):
```
# pass 1
# fail 0
TAX NOTICE: PASS (parts run: 1)
```
Task 2 verify (VERIFY_EXIT=0): taxdocs-mail.test.mjs and 10-12's taxdocs.test.mjs together:
```
# tests 18
# pass 18
# fail 0
TAXDOCS MATH: PASS (cases run: 11)
TAX NOTICE: PASS (parts run: 4)
```
10-12's server/test/taxdocs.test.mjs passed unchanged (14 of 14). None of its assertions states the old text exactly, so none changed.

## Gate (Task 3)

Command: `GATE13_PHASES="10" GATE_OUT=SCRATCH/exec-13-07 bash .planning/phases/13-email-overhaul/checks/gate13.sh`. base-commit.txt is 75b2fc5. Before the gate, `git diff 75b2fc5 HEAD -- assets/js/taxdocs-ui.js assets/js/onboarding.js server/index.mjs server/lib/mail.mjs` was empty. Task 3 verify: VERIFY_EXIT=0.

The gate's last lines, verbatim (run 2):
```
GATE ok   base-server-tests (kept from 2026-11-27 16:31:09 UTC)
GATE ok   server tests 588 = base 584 + 4 declared
GATE ok   DIST FLOW (kept from 2026-11-27 16:33:35 UTC)
GATE ok   DIST RECORD (kept from 2026-11-27 16:33:37 UTC)
GATE ok   K1 SPLIT (kept from 2026-11-27 16:33:56 UTC)
GATE ok   SHIPPED LIBS (kept from 2026-11-27 16:36:18 UTC)
GATE ok   TAX 1099 (kept from 2026-11-27 16:36:20 UTC)
GATE ok   TAX FORMS (kept from 2026-11-27 16:36:22 UTC)
GATE ok   TAX MATH (kept from 2026-11-27 16:36:23 UTC)
GATE ok   TAX1099 FLOW (kept from 2026-11-27 16:42:27 UTC)
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXLINK FLOW
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE ok   EMAILS PARITY
GATE ok   INVITE MAIL
GATE ok   TAX NOTICE
GATE_EXIT=0
```
GATE_EXIT=0.

## Assertions changed in earlier plans' tests and checks

- server/test/taxdocs.test.mjs (10-12): none.
- .planning/phases/10-investor-tax-documents-and-withholding/checks/taxdocs-math.js, case dates (case count 11 unchanged):
  - old: `[CONTACT.name, CONTACT.address, CONTACT.phone, CONTACT.email, a.tax.availableUntil].every((s) => n.body.indexOf(s) >= 0)`. This matched the ISO date "2027-09-10".
  - new: the same list with `untilWords`, the date in words the render prints: `new Date(`${a.tax.availableUntil}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })`, for example "September 10, 2027".
  - setup() (not an assertion): `B.portal()` became `B.portal(['data.js', 'audit.js', 'operations.js', 'emails.js', 'taxdocs.js'])`.

## Test counts

- Server tests at base 75b2fc5, measured here: 584 of 584 (base-count.txt).
- This plan adds server/test/taxdocs-mail.test.mjs, first line `// gate: tests 4`, with 4 tests: tracer, consent, transient, log. Expected total: 588.
- Measured on this tree by the gate: "GATE ok   server tests 588 = base 584 + 4 declared". The reference gate's own run: "# fail 0", 588.

## Interfaces

- **server/lib/taxdocs.mjs**
  - noticeMessage(rec, s, url) is `emails.render('tax_notice', { variant: 'link', firm: { name }, investor: { name }, doc: { title, availableUntil }, link, contact })`.
  - consentMessage is `render('tax_consent', same data)`. Both return { subject, text, html, inline (Buffers), link }.
  - mail() calls mailer.send with kind 'taxdoc', refId rec.id, investorId rec.investorId and link. invitationId is no longer passed.
  - GET /v1/taxdocs: a document whose latest notice entry in the sent log (createMailLog({ store, vault, env, now }).list(workspace, { refId })) is bounced with a permanent bounce event answers `emailStatus: 'bounced', bouncedAt: <the event's time>`. Every other document keeps the 8 keys it had. There is no index.mjs change.
- **assets/js/taxdocs.js** notice(ws, doc) returns { subject: NOTICE_SUBJECT, body: render('tax_notice', { variant 'portal', firm: firmFromTenant(ws.tenant), investor: { name }, doc: { label, year, replaces, availableUntil }, contact }).text }. emails.js comes from NS.emails, or from require('./emails.js') under Node. If neither is there, notice refuses with "The email templates are not loaded."
- **assets/js/taxlink.js**
  - pull(ws): a delivered document whose server row says emailStatus bounced, whose notice is not yet marked came back and which is not yet sent on paper calls NS.taxdocs.bounced(ws, doc.id, <bouncedAt's local day>) once and saves.
  - rowLine: 'The email with the link came back on <date>: send it on paper.'
  - send() and resend(): one NS.emails.log entry each, kind tax_notice (or tax_consent while consent is not in effect), with the server's emailStatus and the render's text with the link replaced. doc.tax.link.mail keeps { title, availableUntil, firm, contact, name, to } as sent.

## Commits

- e141a26 wip(13-07): save (Task 1 RED: taxdocs-mail.test.mjs tracer, tax-notice.js bounce-phone)
- 3511b7a wip(13-07): save (Task 1 code: taxdocs.mjs, taxlink.js)
- a96fd1c feat(13-07): tax notice through emails.js; a signed permanent bounce marks the notice as came back
- 4f8d616 test(13-07): RED for the mailto notice, the consent request, empty slots and the sent log
- bae14e2 wip(13-07): save (Task 2 code: taxdocs.js, taxlink.js, P10 taxdocs-math.js)
- 0f4f56f feat(13-07): the console's tax notice on emails.js, no empty slots, sent-log entries with the server's status

## Deviations from Plan

1. [Rule 3, blocking] P10 taxdocs-math.js setup loads emails.js (see failures). Files: that check only.
2. [Rule 2, honest row] taxlink.js rowLine gained a line for a bounced link email. Without it, the row kept saying "Link sent by email on ..." after the notice came back.
3. [Rule 2] The bounced row offers no Resend, because a new link to an address on the bounce list would not be sent.

## Threat model

- T-13-23 (forged bounce): only events the adapter verified reach the log (13-03). Only an entry whose status is bounced and that carries a permanent bounce event marks the notice. The transient test proves a transient bounce changes nothing.
- T-13-24 (taxpayer digits): the renders hold no digits of the number on record. The tests check the message text with stripLinkTokens and the log entries' text and subject for the literal 4721, which appears in no date, telephone number or amount of the fixtures.

## Self-Check: PASSED

- Files found: server/test/taxdocs-mail.test.mjs, .planning/phases/13-email-overhaul/checks/tax-notice.js.
- Commits found (git log 75b2fc5..HEAD): e141a26, 3511b7a, a96fd1c, 4f8d616, bae14e2, 0f4f56f, fb6fe0e.
- Cleanup: the screenshots and page captures of the direct check runs (SCRATCH/exec-13-07/checks-out, shots) are deleted; the gate removed its base tree, shots and checks-out itself; the server/node_modules link is removed.

## Owner checks waiting

- Real bounces and live sending at 13-10 (the owner's provider account). Until then, "To be confirmed".
- The owner's read of the notice wording and of the "came back" row.
