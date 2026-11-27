---
phase: 13-email-overhaul
plan: 04
subsystem: server email
status: gate-running
tags: [email, notices, capital-calls, esign, unsubscribe, can-spam, confirmation]
requires: [13-03, 13-05, 13-11, 15-05, 15-06]
provides: [POST /v1/messages, GET /v1/messages/preferences, POST/GET /unsubscribe/<token>, createUnsubscribe, investor confirmation email]
affects: [13-06, 13-08, 13-09, 13-10, 13-12, 15-14]
key-files:
  created: [server/lib/messages.mjs, server/test/messages.test.mjs, server/test/unsubscribe.test.mjs, server/test/confirm-mail.test.mjs]
  modified: [server/index.mjs, server/lib/invitations.mjs, server/lib/roles.mjs]
plan_head_before: 75b2fc5e6d774cdbd74370c34b8c7e445b6b8415
---

# Phase 13 Plan 04: Server messages, one-click unsubscribe and the investor's confirmation Summary

The server now emails notices, capital calls and e-sign notices for up to 500 investors per call (each rendered by
emails.js, each with its own status, each logged), refuses screened text and postal-less offering news with 422, caps a
workspace at MAIL_RATE_PER_HOUR recipients, honours one-click unsubscribe (signed tokens, header to the server, footer to
the portal page), and sends the investor a confirmation when their onboarding, subscription, tax form, co-investor
signature or re-verification is completed. Tested against the outbox and local SMTP stand-ins only. Nothing here is ready
for anyone until the owner's live check (13-10); live sending stays "To be confirmed"; the commercial classification stays
"To be confirmed with counsel".

## Failures first

<!-- gate result goes here -->

- RED runs failed as intended (below). No test of an existing file was changed.
- One test-side slip found and fixed during GREEN, not a product failure: confirm-mail "nothing sensitive" first looked for
  the substring '3456' (the never-issued number's last four) and matched the firm's colour '#123456' in the HTML. It now
  looks for the account number's last four '7890', which appear in no date, phone or colour of the fixture firm.

## RED evidence (as produced)

- Task 1, red-1.txt: `not ok 1 - tracer` / `expected: 200` / `actual: 404` / `# tests 1` `# pass 0` `# fail 1`
- Task 2, red-2.txt: `ok 1 - tracer`, `not ok 2 - kinds`, `not ok 3 - screen`, `not ok 4 - postal`, `not ok 5 - limits`,
  `not ok 6 - workspaces`, `ok 7 - statuses` (the notice path already gave suppressed and held), `not ok 8 - bad input`,
  `not ok 9 - one click`, `not ok 10 - invitation`, `not ok 11 - forged`, `not ok 12 - get`,
  `not ok 13 - nothing stored in plain` / `# tests 13` `# pass 2` `# fail 11`
- Task 3, red-3.txt: `not ok 1 - onboarding and subscription`, `not ok 2 - tax form and co-investor`,
  `not ok 3 - nothing sensitive`, `not ok 4 - failure does not fail` / `# tests 4` `# pass 0` `# fail 4`

## Verify lines

- Task 1 verify: base-count.txt 584 (measured on 75b2fc5: `# tests 584`, `# pass 584`, `# fail 0`); t1.txt `# tests 1`
  `# pass 1` `# fail 0`; VERIFY1_OK.
- Task 2 verify: t2.txt `# tests 13` `# pass 13` `# fail 0`; unsubscribe.test.mjs first line `// gate: tests 5`; VERIFY2_OK.
- Full server suite after Task 2: `# tests 597` `# pass 597` `# fail 0` (584 + 13).
- Full server suite after Task 3: `# tests 601` `# pass 601` `# fail 0` (584 + 17: messages 8, unsubscribe 5, confirm-mail 4).
- mail.mjs, maillog.mjs, store.mjs, workspace.mjs, assets/, diy.html, portal.html, index.html: no change from 75b2fc5.

## Gate

<!-- gate lines go here -->

## Interfaces for later plans (13-06, 13-08, 13-09, 13-12, 15-14)

POST /v1/messages (sponsor gate; ROUTES `team('POST', {path:'/v1/messages'}, 'operate', true)`; body at most 1 MB)
- `{ workspace, kind, variant, firm, portalUrl, offeringNews, recipients: [ { investorId, name, email, subject, body, data: { activated, envelope: { title }, signer: { name } } } ] }` (exactly what emails.js dispatch posts).
- kind: notice | capital_call | capital_call_reminder | esign_request | esign_reminder | esign_voided | esign_completed.
  variant: one of emails.js KINDS[kind].variants, the first when absent. `offeringNews: true` makes a notice variant
  offeringNews (possibly commercial); on any other kind it is 400.
- A sponsor account's or session's call acts on its own workspace whatever it names; the shared token names it.
- 200 `{ results: [ { investorId, emailStatus, error } ] }`, emailStatus sent | outbox | held | failed | suppressed |
  unsubscribed, error '' when none ('This investor turned off emails about new offerings.' for unsubscribed).
- 400: unknown kind or variant, firm (cleanFirm), portalUrl not https (http only on localhost / 127.0.0.1 / [::1]; and on
  PORTAL_ORIGIN when set), recipients not 1 to 500, a recipient without a valid id or address, a notice or call recipient
  without a subject and a text.
- 422 `{ error, field }`: screen()'s sentence and the field (`recipients[n].subject`, `recipients[n].body`,
  `recipients[n].data.envelope.title`); or offering news without the firm's postal address:
  `{ error: "Add your firm's postal address before sending invitations to a new offering.", field: 'firm.postalAddress' }`.
  Nothing is sent or logged.
- 429 `{ error: 'This workspace may email at most N people an hour. Try again later.' }`: MAIL_RATE_PER_HOUR (whole
  number 1 to 100,000; 2,000 by default) recipients per workspace in the last rolling hour, counting this call; nothing of
  it is sent. The count is kept in memory (a restart starts it again).
- Each recipient: `render(kind, { variant, firm, investor: { id, contact: name }, subject, body, portalUrl, activated, envelope, signer, unsubscribeUrl: footer when commercial })` then `mailer.send({ kind, workspace, investorId, refId: '', fromName: firm.name, replyTo: firm.supportEmail, to, toName, subject, text, html, inline, headers, link: footer, optional: notice documents|quarterly, commercial })`.
- Commercial: headers = `Object.assign({}, rendered.headers, { 'List-Unsubscribe': '<PUBLIC_URL/unsubscribe/<token>>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })`;
  the footer's stop link is the portal page. The sent log redacts the footer link as '[personal link]'.

GET /v1/messages/preferences?workspace= (ROUTES 'view') → `{ preferences: [ { investorId, offering, at, how } ] }` for the
caller's own workspace (an account or session ignores the query). `how` is 'link' today. 13-06 reads this.

Unsubscribe (server/lib/messages.mjs `createUnsubscribe({ store, vault, publicUrl, now })`, used by messages.mjs and
invitations.mjs):
- token = `base64url(JSON {w, i, h}) + '.' + base64url(HMAC-SHA256(key, that))`, h = lib/maillog.mjs emailHash(address);
  key = 32 random bytes made once with node:crypto, stored sealed with vault.seal in store record `mailprefs/_key`
  (additional data 'mailprefs:_key'; the re-seal tool moves it like any sealed value). Compared with safeEqual.
- `urls(workspace, investorId, email, portalUrl)` → `{ token, header: '<PUBLIC_URL>/unsubscribe/<token>', footer: '<portal page without its own server=>?…&server=<PUBLIC_URL encoded>#unsubscribe-<token>' }`
  (the footer is built the way lib/invitations.mjs builds an invitation link).
- POST /unsubscribe/<token> (no firm token; before the sponsor gate; per-client limit MAIL_EVENTS_PER_MIN, 600 a minute by
  default, like delivery events; body at most 8 KB, 'List-Unsubscribe=One-Click' or JSON {}; ROUTES
  `other('*', {prefix:'/unsubscribe'}, 'public', …)`) → 200 `{}` for every token. A valid one stores
  `mailprefs { id: '<w>:<h>', workspace: w, investorId: i, offering: false, at, how: 'link' }` and the event
  `{ type: 'unsubscribed', workspace }` (no address, no investor id). A forged, altered, foreign-key or random token changes
  nothing.
- GET (and HEAD) /unsubscribe/<token> → 200 text 'Use the link in the email to stop these emails.'; nothing changes.
- For 13-08 (the portal screen): the footer opens `portal.html?…&server=<server>#unsubscribe-<token>`; the screen POSTs
  JSON `{}` to `<server>/unsubscribe/<token>` and shows its own sentence (the server answers `{}` for every token, so the
  screen cannot and must not say whether the token was valid). Turning offering news back on is not built (no route).
- `offeringOff(workspace, email)`: the choice is per workspace and address, so any message to that address in that
  workspace that is possibly commercial answers unsubscribed, whichever investor id it carries.

invitations.mjs (keep for 15-14, which edits this file next; every change is listed):
1. `export function cleanFirm` (the word `export` added).
2. Imports `createUnsubscribe, stopHeaders, POSTAL, UNSUBSCRIBED` from ./messages.mjs and `render` beside `screen` from
   emails.js.
3. `createInvitations({ …, firmRecord = () => null })`: index.mjs passes `(ws) => the workspace's stored tenant` (lib/
   workspace.mjs get(ws).ws.tenant, server mode) or null.
4. `const unsub = createUnsubscribe(...)` after the mailer.
5. `sendInvite`: a possibly commercial invitation or new link to an address that turned offering news off is logged
   'unsubscribed' and answers `emailStatus: 'unsubscribed'` (the invitation is still made, with its link); otherwise it is
   re-rendered with `unsubscribeUrl` = the footer and sent with the one-click headers.
6. `create`: before any payment, 422 `{ error: POSTAL }` when the email would be sent (`sendEmail !== false`), the
   firm's stored record holds a `postalAddress` field, and render('invitation', …).needs includes 'postalAddress'.
7. `confirm(rec, snap, summary, completedAt)`, called after the sponsor notification in POST /v1/invite/complete.

Confirmation (POST /v1/invite/complete): `render('confirmation', { variant, firm, investor: { id, contact, title, taxType }, offering, invitation: {}, portalUrl, completedAt })`,
`mailer.send({ kind: 'confirmation', refId: <invitation id>, investorId, workspace, to: snap.investor.email, headers: { 'Auto-Submitted': 'auto-generated' } … })`.
variant: coSign when the co-investor signed (to the co-investor; no portal button); taxForm when a form came back
(signed or uploaded; W-8BEN / W-8BEN-E named by the returned form); reverify when a result came; subscription when the
invitation has an offering and a request came back; otherwise onboarding; a portal-access link sends none. Not tied to
the invitation in the outbox (`invitationId` empty, so `/v1/outbox?invitation=` lists the invitation's own messages as
before); the sent log has it under the invitation's refId. A mail failure or a render error never fails the completion.

## Decisions and deviations

1. [B7 applied] The unsubscribe key is a random 32-byte secret sealed in the store (no vault.mjs change). "Forged" is
   tested as a token signed by another server's key, an altered character, random text and an extra segment.
2. [Rule 2 / 13-05 rule, judgment] C-06 on POST /v1/invitations applies only once the firm's own record on this server
   holds the postalAddress field (server mode, lib/workspace.mjs tenant), plus W5 (only when the email would be sent).
   Reason: the console's firmOf always sends `postalAddress: ''` (13-05), every tenant lacks the setting until 13-09, and
   SERVER MODE and other reference checks invite a new investor to an offering with no commitment through the server; a
   refusal on the sent value alone would block them and every sponsor before 13-09 exists. POST /v1/messages refuses
   postal-less offering news always (as the console's dispatch already does). For 13-09/15-17: once the console's
   workspace lives on the server with the field, the server enforces it; a sponsor using only the shared token and no
   stored workspace is held by the console's own check.
3. [Judgment] Confirmations only for what was actually received (a co-investor who did not sign, a tax request finished
   without a form, a re-verification with no result, a portal link: none), so no email claims something that did not happen.
4. [Judgment] The unsubscribe route has the delivery events' larger per-client limit (MAIL_EVENTS_PER_MIN, 600 a minute)
   rather than the general 60: mail providers send one-click POSTs from a few addresses.
5. [Judgment] `offeringNews: true` turns a notice into the offeringNews variant whatever variant it names, so a
   commercial notice can never go without its footer and headers.
6. Commits: the Task 2 code landed in save commit 15c1e7e (an empty commit e2fcabf carries its message); the Task 3
   confirm() code landed in save commit 44e59ee (283044a holds the last test change and the message).

## Open items

- 13-08/13-09: the console's Invitation dialog shows "reply to this email." in the stop line of a possibly commercial
  invitation, while the server's message carries the stop link (the console cannot know the token). Its byte-for-byte
  claim holds for non-commercial invitations only; the dialog could show the outbox text for these.
- server/README.md "## Email" does not yet name MAIL_RATE_PER_HOUR, /unsubscribe or the confirmation (README is not in
  this plan's files); for the next plan that owns it (13-10 or 15-14).
- Turning offering news back on (portal Account choices, 13-08) has no server route yet.
- The hourly count is in memory: a restart begins it again.
- Commercial classification (C-02): "To be confirmed with counsel". Live delivery, bounces and real one-click behaviour at
  mail providers: the owner's 13-10 run. Nothing here is called working before the owner has checked it.

## Self-Check

<!-- self-check goes here -->
