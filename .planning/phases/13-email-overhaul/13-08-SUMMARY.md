---
phase: 13-email-overhaul
plan: 08
subsystem: email (e-sign notices, honest toasts, investor email choices, unsubscribe page)
status: partial
tags: [email, esign, unsubscribe, self-serve, honesty]
requires: [13-04, 13-11, 13-12]
provides:
  - e-sign notices (esign_request, esign_reminder, esign_voided, esign_completed) through POST /v1/messages in the self-serve console
  - the investor's Account "Email" switches (inv.emailPrefs)
  - the page an unsubscribe link opens (#unsubscribe-<token>)
  - GET /unsubscribe/<token> with Accept JSON answers { firm } (the firm's name, signed inside the token)
affects: [13-06, 13-09, 13-10, 15-14, 15-17]
key-files:
  created:
    - .planning/phases/13-email-overhaul/checks/portal-mail.js
  modified:
    - assets/js/esign.js
    - assets/js/diy.js
    - assets/js/portal.js
    - assets/js/app.js
    - server/lib/messages.mjs
    - server/test/unsubscribe.test.mjs
decisions:
  - "I2 rule: a signer with no investor record (the firm's countersigner) or a co-investor keeps today's simulated path, with a simulated sent-log entry, in both modes"
  - "A quiet send (signing inside onboarding) sends no server email, as it shows no toast today"
  - "The unsubscribe page reads the firm's name from the server: the name travels signed inside the token; GET with Accept JSON returns it"
  - "B2 (investor-credential route) not built: it needs index.mjs to mount it (the stated stop condition) and the browser has no investor server session"
metrics:
  completed: 2026-11-27
actuals:
  tokens: 18817
  tasks: 2
  commits: 7
plan_head_before: 6d2481af8cf1d9f06d73ea7a14297526af328955
plan_head_after: see the final commit of this summary
---

# Phase 13 Plan 08: e-sign notices and portal emails Summary

## Paused (owner's indefinite pause, 2026-11-27)

**Failures first.**
- **The gate is not finished: no GATE_EXIT.** It was killed at the pause, partway through phase 08's checks; phase 10 and phase 13 checks had not run. At that point it had printed 36 "GATE ok" lines and 1 "GATE FAIL".
- **The one FAIL is CO-INVESTOR SERVER (5)**, part cosign-forged. The check was not edited by this plan; it may be affected by this plan's void change (with a server, void now also posts to /v1/messages). The exact line, from GATE_OUT/gate/coserver.txt:
  `FAIL cosign-forged after the firm voided the agreement, the submission changes nothing and the audit line says it is no longer out for signature :: {"said":["Co-investor signature not used: Daniel Whitaker: the agreement signed on Oluwaseun Brightwater's device came back, but Oluwaseun Brightwater has already signed it; nothing was changed","Co-investor signature not used: Daniel Whitaker: the agreement signed on Oluwaseun Brightwater's device came back, but the agreement is no longer out for signature (voided); nothing was changed"],"status":"voided","check":{"finished":true,"toast":"Checked. Nothing new."}}`
  It has not yet been rerun alone. That is required and still owed, before anything is called noise.
- **The guide prose is still untrue.** server/help/guide.md line 471 (console-team) still says "They get an email to set a password and turn on two-step sign-in." That is 13-10's text, not this plan's.

**The orchestrator's three decisions ("Decision during 13-08"): all three are built and pass on this tree.**
1. **Server-mode line in place of the switch: done.** With a server, the Account page shows no "Invitations to new offerings" switch. In its place it shows "To stop invitations to new offerings, use the link at the bottom of any such email." The change handler also refuses that key in server mode. With no server, the three switches stay as built.
2. **Guide skip line: done** (commit 52f7681). It is exactly one line under `## skip`. `node server/help/build.mjs` regenerated server/lib/help-guide.mjs with no byte change, and `--verify` says it is in sync. The help tests pass 9 of 9.
3. **Honest dialog words: done, self-serve only; managed-same passes, byte-identical.**
   - Void dialog with a server: "Reason (kept with the envelope, not emailed)".
   - Review dialog with a server: no "Email subject" field, and the message is labelled "Message (shown on the signing page)". es-send keeps the existing subject when the field is absent.
   - Team hint without a server: "They get an email to set a password and turn on two-step sign-in (simulated in this demo)."
   - Team hint with a server: "The invitation is saved here; it is emailed once sign-in accounts are connected."
   - B2 itself moved to 15-17; index.mjs and roles.mjs were not touched.

**Last RED, GREEN and verify lines.**
- RED (red-3.txt; the check was committed in d55b213, then the void label was narrowed to the wording above in ecd6661):
  - `FAIL team-honest no server: the Team page hint says "They get an email to set a password and turn on two-step sign-in (simulated in this demo)." :: They get an email to set a password and turn on two-step sign-in.`
  - `FAIL server-words with a server: the review dialog has no "Email subject" field (the server's notice has its own subject) :: ["Email subject","Message (shown in the email and on the signing page)","Recipients"]`
  - `FAIL server-words ran to the end :: page.evaluate: TypeError: Cannot read properties of undefined (reading 'value') at NS.forms.es-send`
  - `PORTAL MAIL: FAIL (parts run: 2) - team-honest, server-words`
- GREEN (portal-2.txt, code in ecd6661): `PORTAL MAIL: PASS (parts run: 9)`, 115 PASS lines, 0 FAIL. The check now has 9 parts: server-words was added, and its `// last` line says 9.
- **Server tests: 606 of 606 pass** (base 605 + 1 declared). The gate's own step agreed: `GATE ok   server tests 606 = base 605 + 1 declared`.
- Gate lines that passed before the stop include: SIGNING DOCUMENTS (8), PRESS AND CO-INVESTOR (10), RECORD AND LOST AGREEMENT (7), "signing/record: no FAIL the base lacks", and AML RECORD (7).

**Next step to resume.**
1. Rerun CO-INVESTOR SERVER alone twice through heavy.sh, with server/node_modules linked: `NODE_PATH=$(npm root -g) bash <scratchpad>/exec-011/heavy.sh node .planning/phases/06-*/checks/co-investor-server.js --only cosign-forged`. Report both results with the exact lines.
2. If it fails because of this plan's void change, fix it in esign.js (RED first).
3. Rerun the gate into the same folder: `rm -f $O/gate.txt; GATE13_PHASES="08 10" GATE_OUT=<scratchpad>/exec-13-08 bash .planning/phases/13-email-overhaul/checks/gate13.sh`, in the background with timeout 7200000. Steps that already passed are kept. Stay with it until GATE_EXIT.
4. Update this summary, push wip/13-08, and hand back. Do not merge.

The self-serve console's e-sign moments now go through the firm's integration server as portal-link notices (no document, no signing link), every toast that claimed a send that never happened is honest, the investor has three email switches on the Account page, and an unsubscribe link opens a page on the firm's own portal. PORTAL MAIL passes 8 of 8 parts. The plan is NOT complete: B2 is not built, one server test fails because of the new page, and the gate was not run. Nothing here is ready until the owner has checked it.

## Failures and what is not done (first)

1. **B2 not built (stopped as instructed).** The binding plan-check item B2 asks for an investor-credential route (`PUT /v1/my-mail-preferences`, who: investor) in messages.mjs that the Account switch calls in server mode. Two facts stop it:
   - index.mjs has no investor-session dispatch at all: every `/v1/` request without a sponsor token answers 401 at the sponsor gate (index.mjs ~1027), and `guards.guardInvestor` is never called (the my-inbox lines in ROUTES are unmounted). Mounting the route needs index.mjs to change (one block before the sponsor gate). The instruction was: if index.mjs must change, stop and report first. Reported here; index.mjs was not touched.
   - The browser has no investor server session to send: no file in assets/js calls `/v1/invite/login`, and in the demo the portal page only holds the sponsor's token. So "the Account switch calls it in server mode" has no investor credential until the portal sign-in moves onto the server (15-17 / 15-18).
   - Effect today: with a server connected, the Account switch changes `inv.emailPrefs` only (the console's own sends honour it through prefsAllow), but the server's mailprefs record is not changed, so server-sent invitations (invitations.mjs reads mailprefs only) still go to an investor who turned the switch off. Also, an investor who unsubscribed by link cannot turn offering news back on.
   - No ROUTES line was added (roles.mjs is untouched), so no merge block with 15-14 exists.
2. **One server test fails on this tree: 606 tests, 605 pass, 1 fail.** `server/test/help-guide.test.mjs` "every route the portal registers has a guide entry or a skip reason": `routes with no entry and no skip reason in server/help/guide.md: unsubscribe`. The cause is this plan's new view `NS.views.unsubscribe`. The fix is one line in server/help/guide.md (an entry, or a line under `## skip`) and regenerating server/lib/help-guide.mjs (`node server/help/build.mjs`). The rules for this run say "no guide bytes", so I did not write it. A proposed skip line: `unsubscribe: the page an unsubscribe link in an offering email opens; one button to stop invitations to new offerings and a link back to the portal`. 13-10 may prefer an investor entry instead.
3. **The gate was not run.** With the failure in point 2 it would end GATE_EXIT=1 every time (server tests step), and any fix for points 1 or 2 changes the tree, so a run now would be thrown away. GATE_EXIT: none.
4. **Two parts never failed.** `esign-simulated-phone` was written after Task 1's code, which already covers it, so no RED exists for it. `managed-same` passes on purpose (the managed edition is unchanged). The RED evidence is for esign-server, team-honest, forgot-honest, prefs-phone, unsubscribe-phone, nonet and the server test.
5. **Task 2's code is in a save commit.** Commit baad278 is labelled `wip(13-08): save` (save rule 2, before the long check run). It is Task 2's GREEN code: diy.js, portal.js, app.js, messages.mjs.

## RED lines (as produced)

red-1.txt (Task 1, esign-server, before any code):
```
FAIL esign-server Send: the outbox holds one signature request per signer, subject as emails.js renders esign_request :: {"got":[],"want":[["hannah.sato@example.com","Kestrel Bay Capital: please sign Side letter for Fund II"],["jordan.davis@example.com","Kestrel Bay Capital: please sign Side letter for Fund II"]]}
FAIL esign-server Send: the toast is summary()'s connected sentence ("No email was sent. 2 are in the server’s outbox: no sending service is set up yet.") :: Signature request emailed to Jordan Davis, Hannah Sato (simulated in this demo).
FAIL esign-server Send: the envelope history says each email waits on the server (its outbox), not that it was sent :: ["Sent","Email sent","Email sent"]
FAIL esign-server Remind: one reminder per signer, subject as emails.js renders esign_reminder :: []
FAIL esign-server Remind: the toast is summary()'s connected sentence :: Reminder emailed to Jordan Davis, Hannah Sato (simulated).
FAIL esign-server Completed: one "signed by everyone" notice per signer, subject as emails.js renders esign_completed :: []
FAIL esign-server Void: one withdrawn notice, to the signer who had it, subject as emails.js renders esign_voided :: []
FAIL esign-server Void: the toast starts "Envelope voided." and is summary()'s connected sentence after it :: Envelope voided. Signers who had received it were notified (simulated).
PORTAL MAIL: FAIL (parts run: 1) - esign-server
```
(One line of red-1, the completion toast, read the role switch's toast "Signed in as ..."; the check was corrected to read the toast after Finish before the RED commit.)

red-2.txt (Task 2, before diy.js, portal.js, app.js and messages.mjs changed):
```
FAIL team-honest no server: inviting says "Invitation to rosa.delgado@kestrel.example (simulated in this demo)." :: Invitation sent to rosa.delgado@kestrel.example
FAIL team-honest no server: Resend invite says the same :: Invitation sent again to rosa.delgado@kestrel.example
FAIL team-honest with a server: inviting says "Invitation to rosa.server@kestrel.example saved; it is emailed once sign-in accounts are connected." :: Invitation sent to rosa.server@kestrel.example
FAIL team-honest no toast says "Invitation sent" :: ["Invitation sent to rosa.server@kestrel.example","Invitation sent again to rosa.server@kestrel.example"]
FAIL forgot-honest 'Forgot your password?' says "Password reset email (simulated in this demo). If you cannot sign in, contact Kestrel Bay Investor Relations." :: A password reset link would be emailed to the address on file.
FAIL prefs-phone the Account page has an "Email" section :: null
FAIL unsubscribe-phone the page names the firm ("Kestrel Bay Capital") ::
FAIL unsubscribe-phone one button: "Stop invitations to new offerings" :: {"text":"This invitation link no longer works ...
FAIL nonet the unsubscribe page with no server says "This link works only from the email you received." :: Kestrel Bay ...
PORTAL MAIL: FAIL (parts run: 7) - team-honest, forgot-honest, prefs-phone, unsubscribe-phone, nonet
```

red-server.txt (unsubscribe.test.mjs 'firm name', before messages.mjs changed):
```
not ok 6 - firm name
  error: `Unexpected token 'U', "Use the li"... is not valid JSON`
# tests 6
# pass 5
# fail 1
```

## Verify lines

- Tracer (Task 1): `PORTAL MAIL: PASS (parts run: 1)` (tracer.txt, esign-server only).
- Task 2: `PORTAL MAIL: PASS (parts run: 8)`, 103 PASS lines, 0 FAIL (portal.txt). `grep -v '^\s*//' assets/js/diy.js | grep -c 'Invitation sent'` = 0.
- Server tests on this tree: `# tests 606`, `# pass 605`, `# fail 1` (help-guide, point 2 above). Base 6d2481a measured from a `git archive` of server and assets: `# tests 605`. Its 6 failures there come from the archive leaving out the page files (served-page tests), not from the code. Addition: +1, declared (`// gate: tests 6` in unsubscribe.test.mjs, was 5).
- `node --test server/test/unsubscribe.test.mjs server/test/messages.test.mjs`: 14 of 14 pass.
- Phone: every phone part ran in Chromium with the iPhone profile at 390x844 with touch (`NOTE WebKit not installed here`). WebKit was not run, so the owner's iPhone check covers Safari.

## What was built

- **esign.js (self-serve only, managed byte-identical):** with a server, send, remind, void and the last signature dispatch through `NS.emails.dispatch` with `api: (m, p, b) => NS.integrations.api(ws, m, p, b)` and `connected: true` (B1). Each investor signer gets the notice with the portal link only. The envelope history records the server's answer once it arrives: "Email sent", "Email waiting to send" (outbox or held) or "Email not sent". The toast is summary()'s sentence. With no server, the toasts use the one simulated sentence, each moment leaves simulated sent-log entries, and the history keeps "Email sent". The "Emails are simulated in this demo" hint is hidden when a server is connected. The signer's done screen no longer promises an emailed copy (B3).
- **diy.js:** Team invite and Resend toasts.
- **portal.js:** the forgot-password toast; the Account "Email" section (three switches, on by default, kept on `inv.emailPrefs`, each row at least 44 px high); the unsubscribe view `{ standalone: true, edition: 'diy' }`.
- **app.js:** `['unsubscribe-', 'unsubscribe']` in PREFIXED. The `?server=` trust test is unchanged.
- **messages.mjs:** the token can carry the firm's name (`f`, signed); `urls(..., firmName)`; POST /v1/messages passes `firm.name`; `GET /unsubscribe/<token>` with `Accept: application/json` answers `{ firm }`, which is `''` for an altered or unknown token. A plain GET and every POST answer exactly as before. Older tokens without `f` still verify.

## Wording changes for the owner to read

E-sign toasts, self-serve:
- With a server: summary()'s sentence, e.g. "No email was sent. 2 are in the server’s outbox: no sending service is set up yet." or "Emailed to 2 investors."; void: "Envelope voided. " + that sentence; last signature: "Signed. Everyone has signed, and the signed copy is in each party’s portal. " + that sentence; next signer: "Signed. " + that sentence. For a countersigner or co-investor: " Email to <names> (simulated in this demo)."
- With no server: "Reminder emailed to <names> (simulated in this demo)."; "Envelope voided. Signers who had received it were notified (simulated in this demo)."; "Signed. Everyone has signed, and the signed copy is in each party’s portal. Everyone was emailed that it is signed (simulated in this demo)."; "Signed. The next signer was emailed (simulated in this demo)."
- If the server cannot be reached: "The integration server could not be reached." (13-12's words).

Envelope history (server mode): "Email waiting to send", "Email not sent".

Signer's done screen: "Once everyone has signed, the signed copy will be in your Documents." (countersigner: "... is saved with the envelope.").

Team: "Invitation to <email> (simulated in this demo)." / "Invitation to <email> saved; it is emailed once sign-in accounts are connected."

Forgot password: "Password reset email (simulated in this demo). If you cannot sign in, contact <support team>."

Account: "Email", "New documents", "Quarterly reports", "Invitations to new offerings", "Notices you must receive, such as capital calls and tax documents, are always emailed."

Unsubscribe page: the firm's name, "Invitations to new offerings", button "Stop invitations to new offerings", then "Done. Invitations to new offerings will no longer be emailed to you."; untrusted or missing server: "This link works only from the email you received."; way out: "Go to the investor portal". C-02 commercial classification "To be confirmed with counsel".

## Deviations

- [Rule 2] messages.mjs gained the signed firm name and the JSON GET: the plan has the page show "the firm's name", and the second device has no portal data, so only the server can supply it. Server tests: +1 (the plan said 0).
- [Rule 1] The I2 rule above; a quiet send (onboarding) sends no server email.
- PHONE is the hand-made iPhone profile of email-sending.js (390x844, scale 3, touch, iPhone user agent), set as lib10's phone in this check's process. Playwright's iPhone 13 profile is 390x664.
- W9: the second context trusts `?server=` through `CVPortalConfig.integrationServers` (srv.init), as the part states.

## Open items

- B2 (point 1): an index.mjs mount and a browser investor session are needed (15-17/15-18), or the orchestrator picks another credential.
- The help-guide line (point 2), then the gate with GATE13_PHASES="08 10".
- For 15-14 (owns invitations.mjs): `unsub.urls(rec.workspace, snap.investor.id, snap.investor.email, snap.portalUrl)` at invitations.mjs ~1304 should pass the firm's name as a fifth argument. Until then the unsubscribe page from an invitation's footer shows no firm name.
- Words this plan did not change that are now untrue with a server: the void dialog's "Reason (sent to signers)" (the notice does not carry the reason); the review dialog's "Email subject" and "Message (shown in the email ...)" (the server's notice uses its own subject and no message); the Team page hint "They get an email to set a password and turn on two-step sign-in." (guide-anchored).
- summary() says "investor(s)" for e-sign signers (emails.js belongs to 15-14).
- The owner's iPhone check (13-10).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: info-oracle | server/lib/messages.mjs | GET /unsubscribe/<token> with Accept JSON returns a name only for a token this server signed, so it shows whether a token is valid. Only someone who already holds the token learns anything; POST still answers the same for every token. |

## Commits

- 6f4fd5d test(13-08): PORTAL MAIL esign-server part (RED)
- e70c455 feat(13-08): e-sign notices through the integration server (self-serve)
- 590f6e8 wip(13-08): save (parts 2-8 written)
- 6d16690 test(13-08): PORTAL MAIL parts 2-8 and the firm-name unsubscribe test (RED)
- baad278 wip(13-08): save (Task 2 GREEN code)
- this summary

## Self-Check: PASSED
Files exist: portal-mail.js, esign.js, diy.js, portal.js, app.js, messages.mjs, unsubscribe.test.mjs. Commits 6f4fd5d, e70c455, 590f6e8, 6d16690 and baad278 are on HEAD.
