---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 38
subsystem: integration-server invitations
status: complete
tags: [co-investor, e-sign, invitations, email, white-label, server]
requires: []
provides:
  - "POST /v1/invitations with invitation.coSign (server half of the co-investor sign-in)"
  - "GET /v1/invite coSign snapshot (invitation.coSign, invitation.envelopeId, esign { template, pdf })"
  - "POST /v1/invite/complete coSign rules"
  - "summarize/notification for coSign"
affects: [06-39]
tech-stack:
  added: []
  patterns: ["coSign branch beside the taxRequest branch (plan 06-26)", "envelope rebuilt from the snapshot template, only the co signer's signing state taken from the device"]
key-files:
  created:
    - server/test/invitations-cosign.test.mjs
  modified:
    - server/lib/invitations.mjs
    - server/lib/mail.mjs
decisions:
  - "W2 applied on the server: in a coSign snapshot, any field value not belonging to the co signer that holds a full SSN or EIN (ddd-dd-dddd, ddd dd dddd, dd-ddddddd, or nine bare digits) is blanked and marked withheld: true"
  - "The co-investor's device can change only the co signer's signing state (status, viewedAt, consentAt, signedAt, declinedReason, signature, initials, userAgent) and the values of the co signer's own unlocked fields; every other signer and field comes back as the snapshot's copy; signers or fields the device adds are dropped"
  - "A coSign snapshot carries verification {}, cents 0, cls '' and an investor of { id, contact, title, type, email } only (the account investor's existing flags, taxType and taxPrefill are dropped)"
metrics:
  duration: "about 35 minutes"
  completed: 2026-11-20
actuals:
  tokens: 12000
  tasks: 2
  commits: 3
plan_head_before: 50d2d63a86d6bd324578a1cee37db181652480d1
plan_head_after: 1ad0f2a5b4565a16f361b3ecb6234321ef09b7a2
---

# Phase 06 Plan 38: Co-investor sign-in, server part Summary

With the integration server connected, the server now accepts a co-investor sign-in from the console, emails the co-investor their own link in the firm's name, serves a snapshot holding only that agreement, its current copy and the account's name, and takes back only the co-investor's signature on that agreement. Proven by 10 node tests (9 failed on the base tree, all 10 pass) and the full server suite: 368 of 368 pass (base was 358). No browser check runs in this plan (node-only). The console and the device are plan 06-39.

## Where the build differs from the plan's contract (read first, 06-39 depends on it)

1. **Create answers 200, not 201.** The plan's Task 1 behaviour says 201. The existing `POST /v1/invitations` route answers 200 for every kind of invitation, and the contract says "as for other invitations", so coSign also answers 200 with `{ id, token, link, emailStatus, expiresAt }`.
2. **W2 on the server (not in the plan's contract).** In a coSign snapshot, a field value that is not the co signer's and holds a full SSN or EIN is blanked (`value: ''`) and marked `withheld: true`. The PDF itself is not changed: the server cannot rewrite it, so 06-39's check that the PDF text holds no taxpayer number still has to pass on the console side.
3. **What comes back is limited more tightly than the contract says** (T-06-66, Rule 2). The contract says "cleanEnvelope's forged-signer reset applies". The server also rebuilds the returned envelope's `signers` and `fields` from the snapshot's template. Only the co signer's signing state and the values of the co signer's own unlocked fields come from the device, so the device cannot change the commitment written in the investor's fields, undo the investor's signature, or add signers or fields. Non-co fields come back as the snapshot's copy, so a withheld field comes back blank with `withheld: true`. **06-39 must merge only the co signer and the co signer's fields into the console's envelope and keep its own copy of every other signer and field.**
4. **More is dropped from the snapshot**: `verification` is `{}`, `invitation.cents` is 0, `cls` is ''. The investor is `{ id, contact, title, type, email }` (the account investor's `existing` flags, `taxType` and `taxPrefill` are dropped).
5. **`investor` may be left out of the completion body** for coSign. If it is sent, its id must still match (400 otherwise). It is stored as `{ id }`, and no verification checks run (`checks: null`).

## The contract as built

**Create (POST /v1/invitations, staff token):**
- The body is as the plan says: `investor { id, contact: co-investor name, title: account title, email: co-investor email, type }`, `invitation { existing: true, coSign: true, envelopeId, senderName, expiresAt }`, `firm`, `offering: null`, `esign { template, pdf }`, `sendEmail`, `portalUrl`.
- The server refuses the following with 400 and `{ error }`. These are the exact sentences:
  - no `existing`: "A co-investor sign-in is only for an account already on file."
  - with an offering: "A co-investor sign-in has no offering: the co-investor signs the agreement already sent."
  - `envelopeId` not matching `/^[\w.-]{1,70}$/`, no template, or not equal to `esign.template.id`: "invitation.envelopeId must be the id of the agreement sent in esign.template."
  - no `esign.pdf`: "A co-investor sign-in needs the agreement’s current copy as a PDF (esign.pdf)."
  - a pdf that is not a PDF: "esign.pdf is not a PDF" (the existing sentence).
- Nothing is stored for a refused request.
- coSign drops access, taxRequest, includeTax, package (no payment is attempted, even with `package: true`) and taxPrefill.

**Snapshot (GET /v1/invite):**
- `invitation { cents: 0, cls: '', note, senderName, existing: true, coSign: true, envelopeId, expiresAt }`
- `offering: null`
- `investor` as above
- `verification: {}`
- `esign { template (TINs withheld), pdf (base64, byte for byte as sent) }`

**Completion (POST /v1/invite/complete):**
- 400 "A co-investor sign-in brings back no subscription request." when `request` is not null.
- 400 "envelope is required: the co-investor’s signature travels on the agreement." when there is no envelope.
- 400 "envelope.id does not match the agreement on this invitation." when the id differs.
- The files kept are only `<envelopeId>-work`, plus `<envelopeId>-signed` when the envelope is completed. Anything else is dropped, including kyc-, tax-, another envelope's copies and a tax envelope's signed copy.
- `taxEnvelope` is null.
- `docs` holds at most the one Legal listing of a completed agreement's signed copy, for the account's investor id.
- cleanEnvelope applies as today: a countersigner marked signed is reset, and an envelope with a countersigner goes back to `sent`.

**Summary and sponsor's email:**
- rows `[['Co-investor signature', 'Signed' | 'Not signed']]`. These are read from the signer with `co: true`.
- next: "Next: countersign the subscription agreement in the console." when signed, "Next: ask the co-investor to sign." otherwise.
- The summary also carries `coSign: true`, `coSigned`, `account` and `agreement`.
- Notification subject: "<co-investor> signed the subscription agreement for <account>" or "<co-investor> did not sign the subscription agreement for <account>". Paragraph: "<co-investor>, co-investor on <account>, went through your request to sign the subscription agreement on <date>." After it: the next line, then "Nothing else in the account’s investor record changes."

**Co-investor email (coSignMessage):**
- subject "<firm>: sign the subscription agreement for <account>"
- "Dear <co-investor>,"
- the two paragraphs of the contract
- the button "Review and sign"
- the link, the personal-link and expiry line, and "Questions? Reply to this email or contact <support line>."
- The resend uses "Reminder: " + the same subject, with "Here is a new link to sign the subscription agreement for <account> as co-investor. Any earlier link we sent no longer works."
- The console reminder (reminderMessage, coSign) has the subject "Waiting in your console: <co-investor>’s signature for <account>".
- Every email in the tests is checked for no vendor name, never "basic", and no SSN/EIN pattern.

## Verification (outputs in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-38/)

- base-commit.txt: 50d2d63a86d6bd324578a1cee37db181652480d1
- base-server.txt: `# tests 358`, `# pass 358`, `# fail 0`
- red.txt (new file on the unchanged tree): `# tests 10`, `# pass 1`, `# fail 9`. The one that passed is the completed-agreement case, which the base already handled for agreements; it is kept as a guard.
- t1.txt (Task 1 verify, name pattern create|snapshot|email|refus): `# tests 5`, `# pass 5`, `# fail 0`
- cosign.txt: `# tests 10`, `# pass 10`, `# fail 0`
- server.txt: `# tests 368`, `# pass 368`, `# fail 0`. **GATE_SERVER_TESTS = 368** (358 + 10).

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (red) | cc33086 | test(06-38): co-investor sign-in server cases (red) |
| 1 | b8209e8 | feat(06-38): the server takes and emails a co-investor's sign-in |
| 2 | 1ad0f2a | feat(06-38): a co-investor's device brings back only their signature on that agreement |

## Deviations from Plan

**1. [Rule 2 - Security] The returned envelope is rebuilt from the snapshot template (T-06-66).** Found during Task 2. On its own, cleanEnvelope lets a device change the investor's field values (for example the commitment) or the investor's signer. Only the co signer's signing state and the co signer's own unlocked field values are now taken from the device. Files: server/lib/invitations.mjs (coSignEnvelope). Commit: 1ad0f2a.

**2. [Rule 2 - Security] W2 applied on the server.** The account investor's SSN/EIN in other signers' field values is withheld from the co-investor's snapshot. Files: server/lib/invitations.mjs (withholdTins). Commit: b8209e8.

**3. [Rule 1 - Bug] confirmChecks skipped for coSign.** It writes `verify: {}` into the investor, which would have broken the "investor is { id } only" rule. Commit: 1ad0f2a.

**4. Create answers 200 (plan text said 201)**, as every invitation does today.

STATE.md and ROADMAP.md were not touched (orchestrator instruction).

## Known Stubs

None.

## Self-Check: PASSED

- server/test/invitations-cosign.test.mjs: found
- commits cc33086, b8209e8, 1ad0f2a: found in HEAD's history
