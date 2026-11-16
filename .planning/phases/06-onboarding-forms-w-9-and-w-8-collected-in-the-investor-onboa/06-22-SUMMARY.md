---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 22
subsystem: investor onboarding in server mode (integration server), sponsor console import, tax forms
status: complete
tags: [server-mode, integration-server, tax-forms, w-9, d-01, d-30, form-08, form-06, t-06-47, t-06-48, t-06-49]
requires: [06-06, 06-07, 06-09, 06-16, 06-20, 06-21]
provides:
  - payload.taxEnvelope and files['<tax envelope id>-signed'] on a server-mode completion (signed forms only)
  - server cleanSubmission taxEnvelope (id pattern, kind 'tax', the invitation's investor as its one signer, not the agreement's id, not for an investor on file); the signed copy allowed as a PDF only when completed, dropped (never refused) otherwise; one Tax listing rebuilt for that investor alone; returned by the pickup
  - console merge taxCheck, the signed copy stored with its SHA-256 worked out by the console, the envelope kept and listed under Tax for that investor; taxCert.signed read from the kept envelope; taxCert.received false when a signed form's copy did not arrive
  - console row "<form> signed, copy not received: ask the investor for it"
  - unsent tax copy reported like unsent evidence (taxCert note on the firm's copy, change-log entry "Signed tax form not sent", one done-screen line)
  - server/test/invitations-taxform.test.mjs (5 tests); server-mode.js parts tax-w9 and tax-unsigned (10 parts in all)
affects: [06-23]
tech-stack:
  added: []
  patterns:
    - "a file that must never stop the completion is dropped on the server, not refused, and its envelope is then not complete"
key-files:
  created:
    - server/test/invitations-taxform.test.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-22-SUMMARY.md
  modified:
    - assets/js/onboarding.js
    - assets/js/invitations.js
    - assets/js/console.js
    - server/lib/invitations.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
decisions:
  - "A form finished without a signature sends no tax envelope and no file (the plan's 'no signed file sent'); the firm's copy of taxCert says signed false and the row reads 'W-9 not signed'"
  - "Planner's choice applied: the tax copy goes after the agreement and before evidence; one that does not fit, is missing or is not a PDF is reported like unsent evidence, in its own change-log entry 'Signed tax form not sent'"
  - "The console does not take the device's word that a form is signed: with the envelope it reads the signature field; without the envelope and copy it marks the record received false, the row says to ask the investor, and taxOnFile is false"
  - "A non-PDF or oversized tax copy is dropped by the server rather than refusing the whole submission (the subscription must not fail for the tax form)"
  - "An invitation to an investor already on file brings back no tax envelope, on the server and in the console"
requirements: [FORM-08, FORM-06]
metrics:
  duration: "32 min from recording the base (00:09:15 UTC) to the gate's end (about 00:41 UTC)"
  completed: 2026-11-16
  tasks: 2
  files: 7
actuals:
  tokens: 11600    # chars/4 over the 46,497 characters of added lines in 97747a6..134623b
  tasks: 2
  commits: 4       # git rev-list --count 97747a6..HEAD before this summary commit
plan_head_before: 97747a66e0174f3ba0fe98d20133608c9146f812
plan_head_after: 134623bcc18ddfd5ad15568fbb3acd5bde0d7f6b
---

# Phase 6 Plan 22: The signed tax form through the integration server

In server mode an investor who signs the W-9 on their own device now has it reach the sponsor. The signed copy leaves the device with the completion and passes the integration server's allowlist. The server seals it like the agreement and the console imports it. The sponsor's investor row reads "W-9 signed Nov 16, 2026 · Download", and the Download returns exactly the bytes the device produced (SHA-256 compared).

Every forged variant is dropped, and the subscription still arrives unchanged: another investor's envelope, a countersigner, another kind, the agreement's own id, a copy that is not a PDF, a copy for an envelope that is not completed, and an investor already on file.

A form finished without a signature sends nothing, and the row reads "W-9 not signed". A signed copy that cannot be sent never stops the completion. The firm's record, its change log and the investor's done screen each say so in one line. The row then reads "W-9 signed, copy not received: ask the investor for it".

Uploaded tax forms in server mode and the device wipe are plan 06-23.

The owner has not checked any of this. It is not done until he has looked at it.

## Failures first

1. **No failure in the product or the gate.** The full gate passed on its first run.
2. **My check was wrong once (not a product fault).** In the first tax-w9 run, the walk reported empty field errors on "Distribution payments" and "Subscription". That was the empty `role="alert"` paragraph the signing dialog leaves in the page after a signature (signature.js `#es-adopt-err`), which 06-21 also found. lib.js `fieldErrors` now ignores messages with no text. That is the only change to how the walk reads errors.
3. **Some forged cases did not show RED against Task 1.** Task 1 already did what the plan's Task 1 asked: the id pattern, kind 'tax' and the one-investor signer test. So against Task 1, the forged cases for another investor, a countersigner, two signers or none, and another kind all passed. Test 3 failed on the agreement's-own-id case. Test 4 failed on the first non-PDF copy (the server refused the whole completion with 400). Test 5 failed because an on-file investor kept the tax envelope. Test 4 stopped at its first failure, so its sent, voided, missing-copy and not-base64 cases were first proven on the fix.
4. **Gate counts differ from the plan text, as the orchestrator said.** SERVER MODE is 10 parts, not 12 (the merged tree had 8, and this plan adds 2). FORMS FLOW is 29, not 28. STATUS FLOW is 25, not 29. There are 183 server tests (178 plus 5). The gate script checks exactly these numbers.
5. **Seen and not changed:**
   - After sending, the device still holds the tax envelope and its files. The wipe is plan 06-23.
   - The firm's note says "...with the rest of their details, so it was not sent with their details". That repeats the wording of the 06-07 acknowledgment note, kept the same for consistency.

## RED runs (quoted)

**Task 1**, committed test 604e79e run against the base product code:
- Server (SCRATCH/exec-06-22/red-t1-srv.txt): `not ok 1 ... error: 'the pickup carries the tax envelope'`, `not ok 2 ... - 'env-t1-signed'` missing from the files, `# pass 0`, `# fail 2`.
- Browser (SCRATCH/exec-06-22/red-t1-browser.txt), 17 PASS, then:
```
FAIL tax-w9 the server holds the tax envelope, completed, pointing at its signed copy :: null
FAIL tax-w9 the server holds the signed W-9 byte for byte as the device produced it :: {"server":["env-mwiij9i82uyrm-work"],"device":"53a1e22f..."}
FAIL tax-w9 the server lists it once, category Tax, for this investor alone :: []
FAIL tax-w9 the console imported the tax envelope, completed, with only its signed copy :: null
FAIL tax-w9 the console stored the signed W-9 byte for byte :: {"console":"","device":"53a1e22f..."}
FAIL tax-w9 the console lists it once, category Tax, for this investor alone :: []
FAIL tax-w9 the investor row reads "W-9 signed <date>" with one Download :: ... W-9 signed Nov 16, 2026 ACH ...
FAIL tax-w9 the Download returns exactly the bytes the device produced :: {"download":"no Download in the row",...}
SERVER MODE: FAIL (parts run: 1) - tax-w9
```
(The ninth FAIL in that file is the empty-error walk artifact, failure 2 above.)

**Task 2**, committed test f7ee31c run against Task 1 commit 337e5ff:
- Server (red-t2-srv.txt): tests 1 and 2 ok. `not ok 3` "the agreement's id: the tax envelope is not kept". `not ok 4` "a PNG: the completion still succeeds ({"error":"files.env-t1-signed is not a PDF"})". `not ok 5`: the tax envelope was kept for an investor on file. Result: `# pass 2`, `# fail 3`.
- Browser (red-t2-browser.txt): 28 PASS. The unsigned run passed (Task 1 already sends nothing for an unsigned form). The too-large run failed:
```
FAIL tax-unsigned toolarge: the firm’s copy of the record says in one line that the signed W-9 did not fit and to ask for it :: {"form":"W-9",...,"signed":true,...}
FAIL tax-unsigned toolarge: the firm’s change log records it in one entry :: []
FAIL tax-unsigned toolarge: the done screen tells the investor in one line :: You’re all set
FAIL tax-unsigned toolarge: the investor row says the signed copy was not received, with no Download :: ... W-9 signed Nov 16, 2026 ...
SERVER MODE: FAIL (parts run: 1) - tax-unsigned
```
- GREEN, on 134623b: `SERVER MODE: PASS (parts run: 2)`, 58 PASS (green-t2.txt), and the server file 5/5.

## Gate

The Task 2 verify command was run from SCRATCH/exec-06-22/gate.sh with this tree's counts. Every step runs, and each result is printed. It passed on the first run. Last lines verbatim (SCRATCH/exec-06-22/gate.txt):
```
GATE ok   server tests # fail 0
GATE ok   server tests 183
GATE ok   STATUS MATH (12)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (29)
GATE ok   STATUS FLOW (25)
GATE ok   SERVER MODE (10)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 183
# pass 183
# fail 0
GATE_EXIT=0
```
- **PASS lines, all with 0 FAIL:** forms-flow 701, status-flow 388, server-mode 317 (259 before).
- **Owner walks:** walkA 13/0, walkB 10/0, walkC 17/0 (individual) and 17/0 (entity). The leak search passed (421 files, 532 commit messages).
- **Tracer:** the Task 1 verify, plus the full server suite, ran on the committed tree before expanding: `SERVER MODE: PASS (parts run: 1)`, new server tests `# fail 0`, suite 180/180 (tracer.sh, tracer.txt).

## What each part and test measured

**tax-w9** (26 checks): Dana Whitfield, a U.S. individual, in server mode with Rule 506(b). She signs the W-9 on the tax step of her own device.
- **Device, before sending:** taxCert.signed is true, and the tax envelope is completed with her as its one signer. The SHA-256 of the signed copy is read on the device.
- **Server:** the server holds taxEnvelope (completed, signedDocId `<id>-signed`) and the copy with the same SHA-256. It lists the copy once, as `cat 'Tax'`, `audience 'investors'`, `investors [her id]`, `offeringId null`.
- **Console:** the envelope is imported with docId and workDocId null. The copy is stored with the same SHA-256 and listed once under Tax for her alone. The record names the signed W-9.
- **Investor row:** "W-9 signed <date>" with one Download, whose SHA-256 equals the device's.
- **Common:** the common server-mode checks (isolation, nothing outside, the request and qual through) and the white-label check pass.

**tax-unsigned** (32 checks), two runs:
- **unsigned.** The W-9 is finished without a signature.
  - No tax envelope and no tax file reach the server, and no Tax listing.
  - The firm's taxCert says signed false.
  - The console has no tax envelope or listing.
  - The row reads "W-9 not signed" with no Download.
- **toolarge.** The W-9 is signed, then its stored copy is made 25 MB on the device.
  - The completion still goes, with the agreement only and no taxEnvelope.
  - The firm's taxCert note reads exactly "The Form W-9 the investor signed did not fit in the 25 MB that can be sent from the investor’s browser with the rest of their details, so it was not sent with their details. Ask the investor for it."
  - There is one change-log entry, "Signed tax form not sent".
  - The done screen has one line: "The Form W-9 you signed could not be sent with your details, so Kestrel Bay Investor Relations may ask you for it again."
  - The row reads "W-9 signed, copy not received: ask the investor for it" with no Download.

**Server tests (5 new, invitations-taxform.test.mjs):**
1. **Positive case.** The pickup carries the tax envelope and the copy byte for byte, beside the agreement. There is exactly one listing, rebuilt from known fields. The device's listing named another investor and audience 'all'; the rebuilt one names this investor alone. Both blobs and the stored record are sealed (the marker and the title are not readable at rest).
2. **Other file ids** are dropped unread: `-work`, `-orig`, another envelope's `-signed`, a `tax-` upload, a lookalike, and an id that is not base64.
3. **Forged envelopes.** Another investor, a countersigner, the investor twice, no signer, a signer with no investor id, kind agreement / missing / TAX, and the agreement's own id. Each gives taxEnvelope null, no file and no listing. The subscription envelope, its file and the request are unaffected.
4. **Bad or unearned copies.**
   - A copy that is a PNG, plain words, or not base64 is dropped, and the completion is 200.
   - A `-signed` file for a sent or voided envelope, or one under another copy name, is dropped.
   - A completed envelope whose copy did not come is kept as sent, pointing at nothing.
5. **An investor already on file** brings back no tax envelope, file or listing.

Screens to look at (SCRATCH = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad):
- SCRATCH/exec-06-22/checks-out/server-shots/tax-w9-console.png: the row with the Download, at the bottom of the investor list.
- SCRATCH/exec-06-22/checks-out/server-shots/tax-unsigned-console.png
- SCRATCH/exec-06-22/checks-out/server-shots/tax-toolarge-console.png
- SCRATCH/exec-06-22/checks-out/server-shots/tax-toolarge-done.png
- Crops of the three rows: SCRATCH/exec-06-22/crop-tax-w9-console.png, crop-tax-unsigned-console.png, crop-tax-toolarge-console.png
- The owner index: SCRATCH/exec-06-22/shots/index.txt

## Deviations from Plan

1. **[Rule 2 - Correctness] A non-PDF, unreadable or oversized tax copy is dropped by the server, not refused.** The plan's Task 1 text allowed the copy "as 'agreement'", which refuses the whole submission when the file is not a PDF. The plan's forged truth requires that the subscription is unaffected, so the copy now has its own class, 'tax'. RED test 4, fix in 134623b.
2. **[Rule 2 - Security] A tax envelope carrying the agreement's own id is refused** on the server and in the console. Without this, the agreement's signed copy could pass as a tax form. RED test 3, fix in 134623b.
3. **[Rule 2 - Correctness] An investor already on file brings back no tax envelope** (the server, and the console's `!onFile`). This matches "an investor already on file keeps the tax form the console holds". RED test 5, fix in 134623b.
4. **[Rule 2 - Security, the 06-09 rule] The console does not trust the device's "signed".**
   - With the envelope, signed is read from its signature field.
   - Without the envelope and copy, the record gets `received: false`.
   - console.js taxLine says "signed, copy not received: ask the investor for it". console.js is a file outside the plan's list.
   - onboarding.js taxOnFile treats such a form as not on file.
   - Commit 134623b.
5. **The console works out the tax copy's SHA-256 itself** from the stored bytes, instead of taking the device's sha256Signed (337e5ff).
6. **A form finished without a signature sends no envelope.** This follows the plan's "no signed file sent". The record carries signed false, so "W-9 not signed" needs no file.
7. **The "Signed tax form not sent" change-log entry is separate** from "Uploaded evidence not sent", because a signed form is not uploaded evidence.
8. **lib.js (check helper, outside the plan's list):**
   - walk takes `a.taxSign` so a server-mode walk can sign the W-9.
   - fieldErrors ignores empty error paragraphs (failure 2).
   - server-mode.js serverFlow has two optional hooks, `onAnyStep` and `taxSign`. Existing parts do not use them.
9. **The toolarge case runs inside tax-unsigned**, as the plan allows. It makes the device's stored copy 25 MB, rather than building a 25 MB agreement.
10. **Gate counts** follow the merged tree (failures first, item 4).
11. **Ledger and state.**
    - `commits` was measured from SCRATCH/exec-06-22/base-commit.txt with actuals.sh. The worktree guard refuses compound git commands, so the ledger under the git directory was not used.
    - STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched, as instructed.

## TDD Gate Compliance

| Task | RED | GREEN |
| ---- | --- | ----- |
| 1 (tracer) | 604e79e | 337e5ff |
| 2 | f7ee31c | 134623b |

The RED runs are quoted above.

## Known Stubs

None that block this plan's goal.
- **Uploaded tax forms (06-21) in server mode:** they are not sent, and the server drops `tax-` files. This is plan 06-23, as before.

## Threat model

- **T-06-47:**
  - The server and the console each apply these tests: the exact id pattern, kind 'tax', the invitation's investor as the one signer (no countersigner), not the agreement's id, not for an investor on file, and the one `<id>-signed` file as a PDF for a completed envelope only.
  - Everything else is dropped unread, or dropped after a PDF test.
  - Forged cases: server tests 2 to 5.
- **T-06-48:** the copy is stored through the same putBlob and vault as the agreement (AES-256-GCM with DATA_KEY). Server test 1 reads the raw blobs and the store: no marker, no title.
- **T-06-49:**
  - The listing is rebuilt on the server from known fields, with `investors [the record's investor]`, `audience 'investors'` and `offeringId null`.
  - The console rebuilds it again for `inv.id` alone.
  - Server test 1 sends a device listing naming another investor; tax-w9 checks both sides.
- **T-06-SC:** no package was installed.

## Threat Flags

None. No new endpoint. The pickup's response gains one field, taxEnvelope, behind the existing API token.

## Self-Check: PASSED

- **Files present:** server/test/invitations-taxform.test.mjs, assets/js/onboarding.js, assets/js/invitations.js, assets/js/console.js, server/lib/invitations.mjs, checks/server-mode.js, checks/lib.js.
- **Commits:** 604e79e, 337e5ff, f7ee31c and 134623b are on HEAD (git rev-list 97747a6..HEAD = 4, before this summary's commit).
- **Clean tree:** no untracked file. server/node_modules is a link used for the runs only and never staged. Nothing was written into assets/ apart from the three source files named above.
