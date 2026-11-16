---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 23
subsystem: investor onboarding in server mode (device wipe, uploaded tax forms, W-8BEN), integration server, sponsor console import
status: complete
tags: [server-mode, integration-server, tax-forms, pitfall-2, upload, w-8ben, d-01, d-30, form-08, form-05, t-06-50, t-06-51]
requires: [06-21, 06-22]
provides:
  - onboarding.js wipeTax, run in sendCompletion only after remote.complete resolves. It deletes every file of the investor's tax envelopes (original, work, signed, the files of a voided form) and the uploaded tax form, and drops their Documents entries and the tax envelopes
  - an upload replaced by a second one leaves the device's file store when the second is stored
  - sendCompletion sends the uploaded tax form (tax-<investor id>-<time>, named by taxCert.fileId) after the agreement and the signed tax form, within 25 MB. One that cannot go is reported in one line each place (the firm's taxCert note, change-log entry "Uploaded tax form not sent", the done screen) and is named by no file
  - server cleanSubmission allows the upload as 'evidence' (PDF, PNG or JPEG) only for an uploaded taxCert under the record's investor id, never for an investor on file
  - console merge keeps the upload and the taxCert pointer only under the investor's own tax- name. Otherwise it sets received false, and the row reads "<form> uploaded, copy not received: ask the investor for it" with no Download
  - server-mode.js parts tax-wipe, tax-upload, tax-w8ben (13 parts in all); serverFlow hooks onFilledAny, taxStep, finish; lib.js walk a.tin and a.taxStep, inviteFromConsole o.account
  - invitations-taxform.test.mjs tests 6 to 8 (186 server tests in all)
affects: [06-24]
tech-stack:
  added: []
  patterns:
    - "delete only after the other side confirms receipt; a failed send keeps every file for Try again"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-23-SUMMARY.md
  modified:
    - assets/js/onboarding.js
    - assets/js/invitations.js
    - assets/js/console.js
    - server/lib/invitations.mjs
    - server/test/invitations-taxform.test.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/deferred-items.md
decisions:
  - "After a confirmed send the device also removes its tax envelopes, not only their files: an envelope left behind would offer a download of a file that is gone. The envelopes hold no taxpayer ID."
  - "A tax form that could not be sent (too large, unreadable) is still deleted from the device after the confirmed send. Pitfall 2 comes first, and the done screen already tells the investor the firm may ask for it again."
  - "No 'not reviewed' mark on uploads. The owner's legal review removed the review mark (06-21), so the console row reads '<form> uploaded <date> · Download', not the plan's 'Uploaded <form>, not reviewed'."
  - "An upload is allowed by the server and the console only when taxCert.uploaded is true and the investor is not on file. This matches the signed tax form rules of 06-22."
  - "An uploaded form that did not reach the console is marked received false, like a signed form whose copy did not arrive (06-22): not on file, and the row says to ask the investor for it."
requirements: [FORM-08, FORM-05]
metrics:
  duration: "36 min from recording the base (00:47:40 UTC) to the gate's end (01:23:41 UTC)"
  completed: 2026-11-16
  tasks: 2
  files: 8
actuals:
  tokens: 11600    # chars/4 over the 46,331 characters of added lines in f21508a..530d66b
  tasks: 2
  commits: 4       # git rev-list --count f21508a..HEAD before this summary commit
plan_head_before: f21508a84196d72149c52786abbad2bcc94e5190
plan_head_after: 530d66b699aab09f1b4ba8012b6b34ab939f091a
---

# Phase 6 Plan 23: No full taxpayer ID left on the investor's device; uploaded forms and the W-8BEN through the integration server

An investor in server mode may finish onboarding on a shared computer. Once the integration server confirms it has their details, the device now deletes every copy that carries the full taxpayer ID:
- the filled tax form, its work copy and its signed copy;
- the files of a form voided on the way;
- the tax form the investor uploaded instead.

Their Documents entries go too. Before the send is confirmed nothing is deleted. With the server stopped, the send failed, every file stayed, and Try again sent the same signed W-9 (SHA-256 equal).

An uploaded tax form now reaches the sponsor in server mode. A W-8IMY uploaded by a foreign partnership passes the server and arrives in the console. The row reads "W-8IMY uploaded Nov 16, 2026 · Download", and the Download returns the bytes the investor chose. Every forged tax- file is dropped. An upload too large to send is reported in one line on the firm's record, in its change log and on the done screen. The row then says "W-9 uploaded, copy not received: ask the investor for it".

A W-8BEN signed in server mode arrives with its validity date. The row reads "W-8BEN signed Nov 16, 2026, valid until Dec 31, 2029 · Download".

The owner has not checked any of this. It is not done until he has looked at it.

## Failures first

1. **No failure in the product or the gate.** The full gate passed on its first run.
2. **tax-w8ben never showed RED.** It passed on the Task 1 commit: 23 PASS, 0 FAIL (SCRATCH/exec-06-23/red-t2-browser.txt). The 06-22 tax envelope code already carries any signed form and its taxCert, including validUntil, and the console row already prints "valid until". The part now guards against regressions only. It also proves the wipe for a W-8BEN, with no run of the foreign tax ID left.
3. **Server test 7 (forged tax- ids dropped) passed on the base.** The server already dropped every tax- file. The test now guards the new allowance, so that it stays limited to the named file.
4. **A real bug found by the RED run (fixed).** Before this plan, the console showed "W-9 uploaded · Download" for an upload that never reached it. Clicking Download did nothing (the download wait timed out). Fixed in 530d66b, with the row now saying the copy was not received.
5. **Gate counts differ from the plan text, as the orchestrator said.**
   - SERVER MODE is 13, not 15: the merged tree had 10, and this plan adds 3.
   - FORMS FLOW is 29, not 28. STATUS FLOW is 25, not 29.
   - There are 186 server tests (183 plus 3).
   - The gate script checks exactly these numbers.
6. **Seen and not changed (logged in deferred-items.md):** with the server unreachable, the "Almost done" screen shows the browser's raw error, "Failed to fetch". This predates the plan.

## RED runs (quoted)

**Task 1.** Committed test 7ff0bd7, run against the base product code (SCRATCH/exec-06-23/red-t1.txt): 31 PASS, then
```
FAIL tax-wipe wipe: after the confirmed send the device’s file store holds no file of any tax envelope (original, work, signed, voided) and no tax upload :: {"left":["env-mwijwyeljchid-orig","env-mwijwyeljchid-signed","env-mwijwyeljchid-work"],...}
FAIL tax-wipe wipe: after the confirmed send the device’s Documents list has no tax entry :: ["env-mwijwyeljchid-signed"]
FAIL tax-wipe wipe: no tax envelope on the device points at a file any more :: [{"id":"env-mwijwx8vxc1pr","status":"voided","docId":"env-mwijwx8vxc1pr-orig",...},{"id":"env-mwijwyeljchid","status":"completed",...}]
FAIL tax-wipe keep: once that send is confirmed the tax files and the Documents entry are gone from the device :: {"left":["env-mwijxabrx1m30-orig","env-mwijxabrx1m30-signed","env-mwijxabrx1m30-work"],"taxDocs":["env-mwijxabrx1m30-signed"]}
SERVER MODE: FAIL (parts run: 1) - tax-wipe
```
The "keep" checks already passed there: nothing was deleted before the confirmed send, and Try again sent the same file. They now guard the wipe so it never runs early.

GREEN on 30865cd: `SERVER MODE: PASS (parts run: 2)` for tax-wipe and tax-w9 (green-t1.txt). The tracer verify then ran on the committed tree (tracer.txt):
```
PASS tax-w9 white label: the done screen and the console row pass the leak check
SERVER MODE: PASS (parts run: 2)
TRACER_EXIT=0
```

**Task 2.** Committed tests afb057d, run against the Task 1 commit 30865cd.
- Server (red-t2-srv.txt): `not ok 6` "a PDF: the upload comes back byte for byte" (actual undefined); `not ok 8` "200 !== 400"; `# pass 6`, `# fail 2`.
- Browser (red-t2-browser.txt): 50 PASS, 10 FAIL in tax-upload, among them
```
FAIL tax-upload upload: the replaced first file left the device when the second was stored (one tax- file) :: ["tax-KBC-1027-mwik554z","tax-KBC-1027-mwik55vd"]
FAIL tax-upload upload: the server holds the uploaded W-8IMY byte for byte, and only it beside the agreement :: {"server":["env-mwik56j88tlka-work"],...}
FAIL tax-upload upload: after the confirmed send the device holds no tax- file :: {...,"after":[...,"tax-KBC-1027-mwik554z",...]}
FAIL tax-upload upbig: the firm’s copy of the record says in one line that the uploaded W-9 did not fit and to ask for it, and names no file :: {"form":"W-9","uploaded":true,"fileId":"tax-KBC-1027-mwik5sta",...}
FAIL tax-upload upbig: the done screen tells the investor in one line :: You’re all set
FAIL tax-upload upbig: the investor row says the uploaded W-9 was not received, with no Download :: ... W-9 uploaded Nov 16, 2026 · Download ...
SERVER MODE: FAIL (parts run: 2) - tax-upload
```
- GREEN on 530d66b: server file 8/8 (green-t2-srv.txt), and `SERVER MODE: PASS (parts run: 5)` for tax-upload, tax-w8ben, tax-wipe, tax-w9 and tax-unsigned, with 153 PASS (green-t2-browser.txt).

## Gate

The Task 2 verify command was run from SCRATCH/exec-06-23/gate.sh with this tree's counts. Every step runs and each result is printed. It passed on the first run. Last lines verbatim (SCRATCH/exec-06-23/gate.txt):
```
GATE ok   server tests # fail 0
GATE ok   server tests 186
GATE ok   STATUS MATH (12)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (29)
GATE ok   STATUS FLOW (25)
GATE ok   SERVER MODE (13)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 186
# pass 186
# fail 0
GATE_EXIT=0
```
- **PASS lines, all with 0 FAIL:** forms-flow 701, status-flow 388, server-mode 412 (317 before).
- **Owner walks:** walkA 13/0, walkB 10/0, walkC 17/0 (individual) and 17/0 (entity). The leak search passed (422 files, 538 commit messages).
- **server/node_modules** was linked for each run and removed by the scripts. It was never staged.

## What each part and test measured

**tax-wipe** (35 checks), two runs in server mode.
- **wipe.** A U.S. individual types SSN 468-02-3917 (a number no other answer of the walk contains). She builds the W-9, goes Back, types the number again (the first form is voided), signs the second and completes.
  - Before sending, the device holds one voided and one signed W-9. The signed W-9's -orig and -signed files are in its file store and listed under Documents. Nothing outside the file store holds a run of the number.
  - The server holds the signed W-9 with the device's SHA-256.
  - After the confirmed send:
    - No file-store id begins with either tax envelope's id, and there is no tax- file.
    - There is no tax Documents entry, and no tax envelope points at a file.
    - The workspace JSON, local storage and session storage hold no run of the number (the five patterns of forms-flow `tin`).
    - The agreement's own copy stays.
  - The console row reads "W-9 signed <date>", and its Download returns the bytes sent.
- **keep.** The integration server is stopped in place (its store kept), and the agreement is finished.
  - The page says "We could not send your details ... Check your connection, then try again." with Try again.
  - Every tax file, the Documents entry and the signed copy's SHA-256 are unchanged.
  - The server is started again on the same address, and Try again is pressed. The server receives the same SHA-256.
  - Only then are the tax files and the entry gone.
  - No script error on either side.

**tax-upload** (37 checks), two runs.
- **upload.** Kittiwake Point Partners LP, invited as a foreign entity, uploads a W-8IMY instead of the W-8BEN-E. It goes Back and uploads a corrected W-8IMY.
  - The record names the second file under `tax-<investor id>-<base 36>`. Only one tax- file is left on the device.
  - The server holds that file byte for byte, and its copy of the record names it.
  - The console stored the same bytes. Its record names the upload with no `received` flag, and the form counts as on file.
  - The row reads "W-8IMY uploaded <date>" with one Download giving the same bytes. There is no review wording and no "not received".
  - After the confirmed send the device holds no tax- file.
  - White label: the done screen and the console row pass the leak check.
- **upbig.** A U.S. individual uploads a W-9, which is then made 25 MB on the device.
  - The completion goes with the agreement only.
  - The firm's taxCert note reads exactly "The Form W-9 the investor uploaded (my-w9.pdf) did not fit in the 25 MB that can be sent from the investor’s browser with the rest of their details, so it was not sent with their details. Ask the investor for it." and names no file.
  - There is one change-log entry, "Uploaded tax form not sent".
  - The done screen has one line: "The Form W-9 you uploaded could not be sent with your details, so Kestrel Bay Investor Relations may ask you for it again."
  - The console sets received false, and the form is not on file.
  - The row reads "W-9 uploaded, copy not received: ask the investor for it" with no Download.

**tax-w8ben** (23 checks). A foreign individual living in Germany, invited as a foreign individual, enters a foreign tax ID and signs the W-8BEN.
- On the device: taxCert is signed, validUntil 2029-12-31, ftinLast4 0937. The tax envelope is completed, with this investor alone as signer.
- The server holds the completed W-8BEN envelope and the copy byte for byte, and its record carries validUntil.
- The console stored the same bytes and keeps validUntil, and the form is on file.
- The row reads "W-8BEN signed <date>, valid until Dec 31, 2029" with a Download of the same bytes.
- After the confirmed send there is no tax file, no Documents entry, and no run of the foreign tax ID in the workspace or local storage.

**Server tests (3 new, invitations-taxform.test.mjs):**
6. An upload named by `investor.taxCert.fileId` under the record's investor id comes back byte for byte as a PDF, a PNG and a JPEG. The record still names it, the agreement is intact, and the stored blobs are sealed (no marker readable).
7. Each of these is dropped while the completion succeeds and the agreement arrives alone: another investor's id, a file the record does not name, no file named, an uppercase id, an empty suffix, a lookalike prefix (`tax-HRC-00420-...`), not marked uploaded, and an investor on file.
8. A named upload that is none of the three formats is refused: 400 "files.tax-HRC-0042-mh2x1q is not a PDF, PNG or JPEG".

Screens to look at (SCRATCH = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad), all in SCRATCH/exec-06-23/checks-out/server-shots/:
- tax-keep-failed.png: the failed send with Try again.
- tax-upload-console.png: the W-8IMY row with its Download, at the bottom of the investor list.
- tax-upbig-done.png and tax-upbig-console.png. A crop of the done screen is SCRATCH/exec-06-23/crop-upbig-done.png.
- tax-w8ben-console.png: the row with "valid until".
- tax-wipe-console.png.

The owner index is SCRATCH/exec-06-23/shots/index.txt.

## Deviations from Plan

1. **No "not reviewed" mark (owner's legal review, accepted in 06-21).** The plan's truth says the console shows "Uploaded <form>, not reviewed". The row reads "W-8IMY uploaded <date> · Download", which is the 06-21 wording.
2. **[Rule 2 - Correctness] The console no longer offers a Download for an upload that did not arrive.** With received false, the row says to ask the investor for it. console.js is outside the plan's file list. Commit 530d66b.
3. **[Rule 2 - Correctness] An upload that cannot be sent is reported**, as a signed form is (06-22): the firm's taxCert note, the change-log entry "Uploaded tax form not sent", and one done-screen line. The firm's copy then names no file. Commit 530d66b.
4. **[Rule 2 - Security, Pitfall 2] A replaced upload is deleted when its replacement is stored.** Without this, a first upload carrying the full SSN stayed on the device after the wipe (RED above). Commit 530d66b.
5. **The tax envelopes are removed from the device with their files**, so nothing points at a deleted file (decision 1). Commit 30865cd.
6. **Check helpers outside the plan's list:**
   - lib.js: walk `a.tin` and `a.taxStep`; inviteFromConsole `o.account`.
   - server-mode.js serverFlow: `onFilledAny`, `taxStep` and `finish` hooks.
   - serverFlow's D-09 check now expects the investor type the part invited, where it used to assume U.S. individual. Existing parts invite with no type, so their checks are unchanged.
7. **Gate counts** follow the merged tree (Failures first, item 5).
8. **Ledger and state.**
   - `commits` was measured from SCRATCH/exec-06-23/base-commit.txt with actuals.sh. The worktree guard refuses compound git commands, so the ledger under the git directory was not used.
   - STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched, as instructed.

## TDD Gate Compliance

| Task | RED | GREEN |
| ---- | --- | ----- |
| 1 (tracer) | 7ff0bd7 | 30865cd |
| 2 | afb057d | 530d66b |

The RED runs are quoted above. tax-w8ben and server test 7 passed before their GREEN commit (Failures first, items 2 and 3).

## Known Stubs

None.

## Threat model

- **T-06-50 (full taxpayer ID on the device):**
  - wipeTax deletes every file of the investor's tax envelopes and the upload, and drops their Documents entries and envelopes. It runs only after `remote.complete` resolves.
  - A replaced upload is deleted when the new one is stored.
  - tax-wipe searches the file store ids, the workspace JSON, local storage and session storage. tax-w8ben does the same for the foreign tax ID.
  - The keep run proves nothing is deleted before a confirmed send.
- **T-06-51 (uploaded tax file through the server):**
  - Allowed only as `tax-<record investor id>-[a-z0-9]+`, named by an uploaded taxCert, PDF, PNG or JPEG, and not for an investor on file.
  - The console applies the same name test.
  - Server tests 6 to 8 cover forged ids, formats and the investor on file.
- **T-06-SC:** no package was installed.

## Threat Flags

None. There is no new endpoint. The completion carries one more allowed file under an existing rule ('evidence').

## Self-Check: PASSED

- **Files present:** assets/js/onboarding.js, assets/js/invitations.js, assets/js/console.js, server/lib/invitations.mjs, server/test/invitations-taxform.test.mjs, checks/server-mode.js, checks/lib.js, deferred-items.md.
- **Commits:** 7ff0bd7, 30865cd, afb057d and 530d66b are on HEAD (git rev-list f21508a..HEAD = 4, before this summary's commit).
- **Clean tree:** no untracked file after the gate. server/node_modules was removed and never staged. Nothing was written into assets/ apart from the three source files named above.
