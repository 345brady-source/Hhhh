---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 39
subsystem: co-investor sign-in in server mode (invitations.js, onboarding.js, esign.js, coinvestor.js), help guide
status: complete
owner_check: pending
tags: [co-investor, e-sign, integration-server, W2, white-label, iphone]
requires: [06-34, 06-37, 06-38]
provides:
  - "with the integration server connected, the co-investor's sign-in is created on the server and emailed once an agreement waits for them"
  - "the co-sign flow on the co-investor's own device (welcome with consent, agreement with only their places, done)"
  - "the console signs its own copy for the co-investor from what their device sent (esign.js importSignature)"
  - "the copy sent to the co-investor never holds the account investor's taxpayer number (esign.js coCopy, W2)"
  - "checks/co-investor-server.js: CO-INVESTOR SERVER: PASS (parts run: 5)"
affects: [gate-reference.sh (orchestrator adds CO-INVESTOR SERVER (5)), preview build (changed assets only)]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/co-investor-server.js
  modified:
    - assets/js/invitations.js
    - assets/js/onboarding.js
    - assets/js/esign.js
    - assets/js/coinvestor.js
    - server/help/guide.md
    - server/lib/help-guide.mjs
decisions:
  - "The console never takes the co-investor's PDF: it stamps the co-investor's consent, adopted marks and own values onto its own work copy (closes PDF tampering from the device, and W2 needs it)"
  - "W2: the snapshot carries only the co-investor's places; when another place holds a full SSN or EIN, the co-investor's PDF is re-stamped from the original without it"
  - "A server without mail settings: the row says 'Sign-in in the server outbox <date>', not 'emailed'"
  - "A sign-in for an agreement that no longer waits for the co-investor (voided, co-investor taken off) is cancelled on the next check"
metrics:
  completed: 2026-11-20
actuals:
  tokens: 34400
  tasks: 3
  commits: 18
plan_head_before: 57a26d8d
plan_head_after: (the docs commit that adds this file; see the return report)
---

# Phase 06 Plan 39: co-investor sign-in with the integration server Summary

With the integration server connected, a co-investor now gets their own emailed sign-in once the investor has signed. They sign
only their own places on their own device, and the signature reaches the firm's console, which countersigns as for any
agreement. Proven on the base first (RED: 25 FAIL), then 128 PASS / 0 FAIL on the fix, desktop and iPhone-sized phone, plus the
targeted checks and the server tests. **Nothing here is ready until the owner has checked it**
(SCRATCH/exec-06-39/owner/index.txt).

## Failures and limits first

1. **Three failures on the way, all fixed and rerun:**
   - The first fix run stopped at `page.click: Timeout` twice. My check left the Account window open over "Invite an investor"
     and "Check now". This was a check defect, fixed in the check.
   - The server tests failed 1 of 368 after my guide sentence: "sponsor guide has a line longer than 1,000 characters". I had
     appended the sentence to the co-investor paragraph. It is now a paragraph of its own: 368 of 368 pass.
   - Looking at the screenshots, I found a product defect the check did not catch. The co-investor's welcome had "Back", which
     opened an investor portal built from the device's temporary copy. The co-investor has no portal. Back is removed, the
     action refuses a co-investor sign-in, and a check line now asserts it.
2. **Not tested on a real iPhone or in the Claude app.** The phone is Chromium at 390x844 with touch and an iOS user agent.
   This feature needs the integration server, so it cannot run in the preview inside the Claude app.
3. **Real email was not tested.** The check's server has no mail settings, so the email sits in its outbox (the 06-38
   subject and text are asserted there). With mail settings the row says "Sign-in emailed <date>".
4. **Not built:** renewing an expired (30-day) co-investor link from the console. Removing the co-investor and adding them
   again works. The co-investor's welcome has no way out but closing the page (like a new investor's welcome).
5. **Task 2's product code went in with Task 1's commit (f7c5e59).** I wrote all five parts first and ran one RED for all,
   then built the hooks, the cancellation and the refusals in one pass. Commit 5b770eb records Task 2's verify.

## RED on the base (57a26d8, the tree with 06-34, 06-37 and 06-38 merged), produced 2026-11-20

Base commit: SCRATCH/exec-06-39/base-commit.txt = 57a26d8. Check file f371adb, run on the unchanged product.
`checks/co-investor-server.js`: 24 PASS, 25 FAIL. Last line:

```
CO-INVESTOR SERVER: FAIL (parts run: 5) - cosign-desktop, cosign-phone, cosign-later, cosign-change-remove, cosign-forged
```

FAIL lines (cut at 260 characters):

```
FAIL cosign-desktop "Add co-investor" with the server connected opens the Account window, not the email to send by hand :: {"open":true,"h2":"Co-investor sign-in email","text":"Co-investor sign-in email\n\nSend it from your email app. The portal prepared it wi
FAIL cosign-desktop the sign-in record is the server kind, with no link token of its own and nothing sent yet :: {"name":"Theodora Mbeki-Larsen","email":"theodora.ml@example.net","signIn":{"token":"2Tx8VB8m7F3n8Dbd0FJ-RaDJAsvQIxqUEIxJ4qaZ-PE","link":"http://12
FAIL cosign-desktop the investors row says "Sign-in is emailed once Daniel Whitaker has signed" :: Daniel Whitaker Daniel Whitaker · daniel.whitaker@example.com Co-investor: Theodora Mbeki-Larsen · Sign-in link ready to send Individual $100,000 1 investment
FAIL cosign-desktop ran to the end :: page.click: Timeout 30000ms exceeded.
FAIL cosign-phone "Add co-investor" with the server connected opens the Account window, not the email to send by hand :: {"open":true,"h2":"Co-investor sign-in email","text":"Co-investor sign-in email\n\nSend it from your email app. The portal prepared it with
FAIL cosign-phone the sign-in record is the server kind, with no link token of its own and nothing sent yet :: {"name":"Ingrid Vasquez-Holm","email":"ingrid.vh@example.net","signIn":{"token":"lWXri8FQS8koeZjQOB5GTqQyFOiv4g5TfhaaK6nwvZk","link":"http://127.0.0.
FAIL cosign-phone the investors row says "Sign-in is emailed once Daniel Whitaker has signed" :: Daniel Whitaker Daniel Whitaker · daniel.whitaker@example.com Co-investor: Ingrid Vasquez-Holm · Sign-in link ready to send Individual $100,000 1 investment Acti
FAIL cosign-phone ran to the end :: page.click: Timeout 30000ms exceeded.
FAIL cosign-later "Add co-investor" after the investor signed opens the Account window, not the email to send by hand :: {"open":true,"h2":"Co-investor sign-in email","text":"Co-investor sign-in email\n\nSend it from your email app. The portal prepared it with
FAIL cosign-later the co-investor became a signer on the agreement waiting for them, and the server sign-in was created at once for it :: {"signIn":{"token":"7sN4A36CAobZ_JAE1Kczzt6VAPAdpMSmpGcGc1igkWc","link":"http://127.0.0.1:35545/diy.html?tenant=kestrel-ba
FAIL cosign-later the Account window says when the sign-in was emailed :: Co-investor sign-in email
FAIL cosign-later the outbox holds one email for this sign-in, to the co-investor, with the subject "<firm>: sign the subscription agreement for <account>" :: []
FAIL cosign-later its text greets the co-investor, asks them to sign as co-investor, has "Review and sign" and the link the console holds ::
FAIL cosign-later the email never carries the investor’s taxpayer number ::
FAIL cosign-later the snapshot is a co-investor sign-in for this agreement: coSign, the envelope id, no offering, the account named :: {}
FAIL cosign-later W2: the PDF the co-investor receives has no full SSN or EIN in its text, and still shows the investor’s other values :: {"hit":null,"len":0,"sample":""}
FAIL cosign-later the emailed link loads the co-investor’s agreement from the server :: {"status":401}
FAIL cosign-change-remove the first sign-in was created on the server :: {"token":"Rklytsu0ZC48xO5rm4D_TL2vekHflT5Pm5219dScUgw","link":"http://127.0.0.1:35545/diy.html?tenant=kestrel-bay#co-Rklytsu0ZC48xO5rm4D_TL2vekHflT5Pm5219dScUgw","createdAt":"2026-11-20T0
FAIL cosign-change-remove the old link answers the server’s cancelled message :: {"status":401,"body":{"error":"This link is not valid. Ask the firm that invited you for a new one."}}
FAIL cosign-change-remove the server shows the old sign-in cancelled and a new one sent :: [{"id":"ivt_l48tsvvN61Tl","status":"completed"}]
FAIL cosign-change-remove the new sign-in is emailed to the new address :: []
FAIL cosign-change-remove the device opening the old link says it no longer works :: We could not find this sign-in link
FAIL cosign-change-remove "Remove co-investor" takes the co-investor off and cancels their sign-in on the server :: {"co":null,"status":401,"body":{"error":"This link is not valid. Ask the firm that invited you for a new one."}}
FAIL cosign-change-remove the change and the removal are in the audit log :: ["Envelope signer added: Subscription Agreement - Daniel Whitaker: Marguerite Achterberg (co-investor)","Co-investor added: Daniel Whitaker: Marguerite Achterberg <marguerite.a@exampl
FAIL cosign-forged the sign-in was created on the server :: {"token":"WJSYV5OPjldXpXyu356JHDDp9dT6PzS-tIvtXh91arM","link":"http://127.0.0.1:35545/diy.html?tenant=kestrel-bay#co-WJSYV5OPjldXpXyu356JHDDp9dT6PzS-tIvtXh91arM","createdAt":"2026-11-20T04:03:55.804Z"
```

What the RED shows: on the base, a co-investor added with the integration server connected gets only the preview's
hand-sent link (the "Co-investor sign-in email" dialog, a local token that works only in that browser); nothing is created on
the server, nothing is emailed, the link on another device is "not valid". cosign-desktop and cosign-phone stop at
"ran to the end" because the preview dialog stays open over the console. Raw output: SCRATCH/exec-06-39/red.txt.

## Task 1 verify (tree f7c5e59)

```
CO-INVESTOR SERVER: PASS (parts run: 2)        (t1.txt: cosign-desktop, cosign-phone; 81 PASS, 0 FAIL)
```
One check change after RED, before it passed: the check closes the Account window left open by "Add co-investor" before
inviting (the first fix run stopped there: `page.click: Timeout` on "Invite an investor" under the open window). Then a
check addition: the account investor adopts a signature too, and the copy the co-investor receives must carry the same
number of pictures as the console's own copy (the re-stamped W2 copy keeps the investor's signature).
## Task 2 verify (tree 3e19171)

```
CO-INVESTOR SERVER: PASS (parts run: 3)        (t2.txt: cosign-later, cosign-change-remove, cosign-forged; 45 PASS, 0 FAIL)
```
(first run: cosign-forged `ran to the end :: page.click: Timeout` under the open Account window; check fixed, rerun.)

## Task 3 verify (tree 1ae4a58, every part run, none kept)

```
# tests 368 / # pass 368 / # fail 0                 (server.txt; rerun after the guide fix, tree a35a41e's content)
CO-INVESTOR SERVER: PASS (parts run: 5)            (green.txt: 128 PASS, 0 FAIL)
SERVER MODE: PASS (parts run: 15)                  (srvmode.txt: 461 PASS)
PRESS AND CO-INVESTOR: PASS (parts run: 2)         (colocal.txt: co-link-desktop, co-managed; 36 PASS)
RECORD AND LOST AGREEMENT: PASS (parts run: 2)     (record.txt: import-desktop, request-desktop; 43 PASS)
SIGNING DOCUMENTS: PASS (parts run: 2)             (sigdocs.txt: countersign-desktop, countersign-phone; 66 PASS)
```
All targeted checks were green on the fix, so no base-tree runs of them were needed. Owner index:
SCRATCH/exec-06-39/owner/index.txt (failures first, the screenshots, how to check it).

## What changed

**invitations.js (console).**
- `coSignIn(ws, inv, env)` posts the 06-38 body. That is the account and the co-investor's name and email, `invitation
  { existing, coSign, envelopeId, senderName, expiresAt }`, no offering, and `esign` from `coCopy`.
- It fills `inv.coInvestor.signIn` with `{ server: true, token: '', link (the server's), serverId, envelopeId, emailStatus,
  error, expiresAt, sentAt, openedAt, signedAt, importedAt }`.
- It runs at "Add co-investor" or a changed email (hooks.added returns exactly true) when an agreement already waits for the
  co-investor. Otherwise it runs at the next check after the investor's signed copy is imported. The co-investor is attached
  to the imported agreement (`coSigning.coAttach`), and `coSweep` creates the sign-in.
- hooks.removed and a changed email cancel the old sign-in (`POST /v1/invitations/<id>/cancel`). A cancellation that cannot
  reach the server is retried on each check. A sign-in for an agreement that no longer waits for the co-investor is cancelled.
- importCompleted: server rows whose id is an account's `signIn.serverId` go to `coRow` → `coMerge`. Only the co-investor's
  signer state and own field values are passed to `esign.importSignature`. Then come the audit line "Co-investor signed", the
  signed hook's notification ("<name> signed the subscription agreement as co-investor") and DELETE of the submission.
- A submission for an agreement no longer out for signature, already signed by the co-investor, or for a replaced or removed
  sign-in changes nothing: "Co-investor signature not used: … because …".
- `firmOf(ws)` is shared with the invitation snapshot.
- "Send the sign-in again" appears in the Account window when a refusal stopped it. A connection failure is retried
  automatically.

**esign.js.**
- `flowSigner` follows `state.co`.
- The signing core is split out of `finishSigning` (`applySignature`, `runSignedHooks`). It behaves the same for every
  existing signer: the countersign and server-mode checks pass.
- `coCopy` builds the envelope reduced to every signer's order and status plus only the co-investor's places, with no events
  and no other signer's signature, email or device. When another place holds a full SSN or EIN, the PDF is re-stamped from the
  original without it.
- `importSignature` checks that the agreement is sent, it is the co-investor's turn and they have not signed. It needs a
  consent time and a PNG mark of bounded size, and keeps times between when the link was sent and now. It records Viewed and
  Consent given, then stamps the console's own work copy.

**onboarding.js (the co-investor's device).**
- `fromSnapshot` → `coSnapshot` builds the agreement, with its current copy stored as `<id>-work` and drawn as its pages.
  The account is held with the co-investor as the person signing in.
- The flow is welcome (consent, recorded on the co-investor's signer only), then agreement, then done ("Thank you, <name>.
  Your signature is recorded and sent to <firm>."). `state.co` is set by ensureFlow.
- `sendCoSign` sends exactly the contract: the envelope, `files { '<id>-work' }` (plus `-signed` only when complete),
  `investor { id }` and `request: null`.
- After the confirmed send, the device deletes the envelope and its copies.

**coinvestor.js (06-37's file, edited for the server kind of record):**
- `signInOf` accepts `server: true`.
- Row text: "Signed <date>", "Emailing the sign-in…", "Sign-in not sent: <reason>", "Sign-in emailed <date>" or
  "Sign-in in the server outbox <date>", and "Sign-in is emailed once <investor> has signed".
- No local-email dialog for a server sign-in not yet created.
- Hooks are registered through `NS.coInvestorReady`, because invitations.js loads first.

**Help guide.** One paragraph after the co-investor paragraph. `server/lib/help-guide.mjs` was regenerated with
`node server/help/build.mjs`.

## Deviations from Plan

1. **[Rule 2 - Security, T-06-70] The console does not store the co-investor's PDF.** The plan said to store the submitted
   work copy. A device could alter that PDF (for example the printed commitment), and the firm would countersign it. W2 also
   makes the device's copy unusable as the record. So the console stamps the co-investor's part onto its own work copy. The
   check asserts the new copy carries the co-investor's name, still holds the investor's taxpayer number, and that every
   other place is unchanged.
2. **[Rule 2 - W2] The snapshot carries only the co-investor's places.** The PDF is re-stamped from the original when another
   place holds a full SSN or EIN. The check types a real SSN in a "Taxpayer ID" place. It asserts that the console's copy holds
   it (control), and that the snapshot JSON and the PDF text sent do not. It also asserts the investor's adopted signature is
   still on the copy sent.
3. **[Rule 1 - honesty] Outbox wording.** A server without mail settings gives "Sign-in in the server outbox <date>" instead of
   "Sign-in emailed <date>". The check accepts exactly the line matching the returned emailStatus.
4. **The console's events for the co-investor are its own** ("Viewed", "Consent given", "Signed" at the device's times, kept in
   order and within range). The device's event list is not copied.
5. **[Rule 3] coinvestor.js edited** (not in files_modified). 06-37's `signInOf` required a token, which a server sign-in has
   none of.
6. **The record keeps the server's link** (`signIn.link`), as the console's invitations do, so "Sign-in link" shows the email
   with it. The token stays empty.
7. **Create answers 200** (06-38 note). Nothing in the console depends on 201.

## Gate line to add (orchestrator)

```
CO-INVESTOR SERVER (5): NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/co-investor-server.js > $O/co-server.txt 2>&1   expecting   CO-INVESTOR SERVER: PASS (parts run: 5)
```
Needs server/node_modules (it runs the real server). GATE_SERVER_TESTS stays 368: this plan adds no server test.

## Files a preview build must carry

No new runtime file. Changed: `assets/js/invitations.js`, `assets/js/onboarding.js`, `assets/js/esign.js`,
`assets/js/coinvestor.js` (all already in the build's lists). The check is new and not part of the preview. The help guide
changed on the server side only (`server/lib/help-guide.mjs`): refresh help-chat's guide.json from it.

## Threat model

- T-06-70: handled as in deviation 1 and asserted by cosign-forged. The device's forged envelope changed the investor's and
  the firm's values, marked the firm signed, renamed the investor, added a signer and a field and said "completed", and the
  stored submission was altered the same way. The console took only the co-investor's part. A replay was refused with an
  audit line, and so was a submission after a void.
- T-06-71: the device deletes the agreement and its copies after a confirmed send, and the snapshot holds no other signer's
  signature, email or device.
- T-06-72: consent sits on the co-investor's signer with its time, the events and the audit line are recorded, and the
  user agent is kept.
- T-06-73: a changed email or removal cancels the server sign-in. The old link answers 410 "This invitation was cancelled".
- T-06-SC: no package was installed.

## Owner check (pending)

With the integration server connected: add a co-investor, invite and sign as the investor, then "Check now". The row says the
sign-in went out. Open the co-investor's email on a second device, sign only their places, then "Check now" again: the
signature is in the console. Countersign it. Steps and screenshots: SCRATCH/exec-06-39/owner/index.txt.


## Self-Check: PASSED

Files present: checks/co-investor-server.js, assets/js/invitations.js, onboarding.js, esign.js, coinvestor.js, server/lib/help-guide.mjs. Commits 8c845c3, f7c5e59, 5b770eb, a35a41e are ancestors of HEAD (checked before this commit).
