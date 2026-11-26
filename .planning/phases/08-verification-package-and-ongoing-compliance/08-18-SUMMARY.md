---
phase: 08-verification-package-and-ongoing-compliance
plan: 18
subsystem: verification-package (accreditation result in the console)
tags: [package, accreditation, rule-506c, letter, console, help-guide, stand-ins]
status: complete
requires: [08-07]
provides:
  - "console.js kycLetter(w, i, x, kind): the waiting line for a server-run accreditation still pending, one Download letter per letter once verified, nothing without a server"
  - "console.js action kyc-evidence: GET /v1/verifications/:id/evidence/:n with the sponsor's token, saved with U.download; one plain sentence on any failure"
  - "server/help/guide.md: one line in ## console-kyc naming Download letter (module and the preview's help data regenerated)"
  - "checks/package-flow.js parts full, letter-phone, letter-none (PACKAGE FLOW 10)"
affects: [08-12, 08-20]
tech-stack:
  added: []
  patterns: ["a resumed gate prints kept steps with '(kept from <time>)'; verify scripts that match lines exactly must allow it"]
key-files:
  created: []
  modified:
    - assets/js/console.js
    - server/help/guide.md
    - server/lib/help-guide.mjs
    - .planning/tools/preview/help-data.js
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/package-flow.js
decisions:
  - "A cleared investor whose accreditation runs through the server (pending, or verified with letters) gets the existing Details button, or the waiting line and Download letter could never be reached"
  - "The letter's file name is the server's when the browser can read it; the server does not expose Content-Disposition to another origin, so the console names it <label>-<investor>.pdf"
  - "The waiting line and Download letter show only while a server is connected (the owner's preview shows neither)"
metrics:
  started: "2026-11-20 (step 0)"
  completed: "2026-11-26 (merged-tree checks and the owner's screens)"
  duration: "two sessions; work stopped by the owner on 2026-11-20 and resumed 2026-11-26; most of the time is the shared browser queue and the 2-hour limit on the gate"
actuals:
  tokens: 8200
  tasks: 2
  commits: 12
plan_head_before: b90ca2a72407ad17849a314c2831f2d990deacde
plan_head_after: "the commit holding this SUMMARY (last on wip/08-18)"
---

# Phase 8 Plan 18: the accreditation result and the reviewer's letter reach the sponsor, proven against stand-ins

One line: an investor in a Rule 506(c) offering with the package (charged $99 to the sponsor, never shown to the investor) verifies identity and starts the accreditation check on the provider's page, then finishes onboarding without waiting; the console's AML/KYC details say "waiting for the result" with one line that the reviewer's letter takes about two business days; when the result arrives the details turn to verified, valid until and the method by themselves, and "Download letter" saves the third party's letter (SHA-256 equal to the stand-in's file). Proven against stand-ins only; no real provider has confirmed anything (08-12 does that). Not done until the owner has checked it.

## Failures first
1. The first full gate failed one step, HELP PREVIEW: the guide line made the owner's preview copy of the help data stale (.planning/tools/preview/help-data.js, a file outside the plan's four). Regenerated with make-help-data.mjs; the gate then passed (details below).
2. verify-2 as written exits 1 on a resumed gate: the gate was stopped by the 2-hour limit and resumed, and kept steps print "(kept from <time>)", which the verify's exact matches reject. Every condition holds with the suffix allowed ($O/verify-2-tail.sh exit 0); 0 GATE FAIL lines, GATE_EXIT=0.
3. The full phase gate was NOT rerun on the merged tree (435a066: 08-19 and everything merged since). Every step the merge touches was rerun there instead (server suite, help guide test, preview help data, HELP CHAT, HELP PREVIEW and all six phase-8 checks): all pass (below). The disk was 99-100% full (135 MB free at one point), too tight for a full gate's base tree and screenshots; the orchestrator decides whether a full merged gate is wanted.
4. Found, not fixed (other plans' files): see "Found, not fixed".

## Step 0 (base, measured)
- base commit b90ca2a72407ad17849a314c2831f2d990deacde
- server tests at base: 387 (`# tests 387`, `# pass 387`, `# fail 0`). The plan expected 358; 08-CONTEXT wave-6 W1 records 387 as today's count (13-02 and later merges).
- phase-8 gate checks at base: 4 (08-17 not merged yet; W1 says 4 now, 5 once 08-17 merges).
- base parts of PACKAGE FLOW: 7, from `--only nosuchpart`:
```
FAIL unknown only name: nosuchpart (known: identity, refused, start-limit, phone, preview-desktop, preview-phone, leak)
PACKAGE FLOW: FAIL (parts run: 0) - unknown: nosuchpart
```

## Task 1 RED (`--only full` against the unchanged console.js, $O/red.txt)
46 PASS lines (the whole investor flow through the package works on the base), then:
```
FAIL full the AML/KYC details read "Accreditation: waiting for the result" :: 
FAIL full the AML/KYC details show the line "A reviewer's letter usually arrives within two business days; this page updates when it does." :: 
FAIL full with no button pressed, the details turn to "Accreditation: verified" :: 
FAIL full "valid until" shows the stand-in's date, or the firm's cap if earlier :: {"rec":{"status":"verified","expiresAt":"2027-02-18","shown":"Feb 18, 2027","method":"Third-party verification letter","evidence":1,"validDays":90},"given":"2027-02-18","capDay":"2027-02-18","line":""}
FAIL full the method reads "Third-party verification letter" :: 
FAIL full one "Download letter" for the one letter :: {"buttons":0,"evidence":1}
FAIL full "Download letter" saves exactly one file :: []
FAIL full the saved file is the third party's letter (its SHA-256 equals the stand-in's PDF) :: []
FAIL full the server fetched the letter from the provider once :: ["session","submitted","result"]
PACKAGE FLOW: FAIL (parts run: 1) - full
```
A diagnostic rerun ($O/dbg1.txt) showed why the details never opened: the investor's row reads "Cleared" with only "Re-screen", so a cleared investor whose accreditation is pending through the server (or verified with a letter) had no way to open the details at all:
```
FAIL full the AML/KYC details read "Accreditation: waiting for the result" :: {"open":false,"text":"","acc":"","letters":0,"row":["Leocadia Ferreira KBC-1027 · Individual Low Nov 20, 2026 Identity check (ref ver_R2S6rMsW9MbW) No matches Nov 20, 2026 Dec 20, 2026 Leocadia Ferreira Cleared Re-screen"]}
```

## Task 1 GREEN
Code: console.js `kycLetter` (added block above the view), the `kyc-evidence` action (added block after `kyc-screen-due`), the `ivLine` line gains the call, and one more changed line (the Details button for a cleared investor; see Deviations). `--only full` then: 55 PASS, `PACKAGE FLOW: PASS (parts run: 1)` ($O/dbg2.txt).

verify-1 ($O/verify-1.sh, exactly as the plan gives it), last lines of $O/tracer.txt:
```
PASS full the typed taxpayer number is in no server output (event log, anything this process printed)
PASS full the typed taxpayer number is in no file this part writes (2)
PACKAGE FLOW: PASS (parts run: 1)
```
verify-1 exit 0.

## Task 2: letter-phone and letter-none (guards), the mutation, the guide line
Both parts against Task 1's commit 42cd627 ($O/red2.txt): 62 PASS, `PACKAGE FLOW: PASS (parts run: 2)`. The phone layout needed no code (the details row already stacks at 390 px), so letter-phone passed as a guard; letter-none passes because the control exists only with a server.
Mutation (kycLetter without its server condition, reverted with `git checkout -- assets/js/console.js` right after; $O/red2-mutation.txt):
```
FAIL letter-none no "Download letter" without a server :: [1,0]
FAIL letter-none no waiting line without a server :: ["Accreditation: verified · Accreditation check · Third-party verification letter · ref ver_standin_acc · valid until Jan 19, 2027 · Download letter","Accreditation: waiting for the result · Accreditation check · ref ver_standin_acc2 A reviewer's letter usually arrives within two business days; this page updates when it does."]
FAIL letter-none no "Download letter" without a server :: [1,0]
FAIL letter-none no waiting line without a server :: [...the same at 390x844...]
PACKAGE FLOW: FAIL (parts run: 1) - letter-none
```
Guide: one added line at the end of the bullets of `## console-kyc`, then `node server/help/build.mjs` ("wrote server/lib/help-guide.mjs (77997 bytes)"). help-guide.test.mjs: `# tests 9`, `# pass 9`, `# fail 0`. Sponsor guide 46,452 bytes of 48,000 (was 46,286; +166).

## Final verify, first full gate (on a445ed8): FAILED on one step, HELP PREVIEW
`npm --prefix server test` alone first: `# tests 387`, `# pass 387`, `# fail 0` (23.8 s).
The first verify-2 run was killed when the owner stopped all work on 2026-11-20 (last line then: `GATE ok   SIGNING DOCUMENTS (8)`); it was rerun into the same folder on 2026-11-26 and kept the passed steps. Result: verify-2 exit 1, `GATE_EXIT=1`, one GATE FAIL:
```
FAIL preview-sponsor the request carries the rules and the sponsor's guide, and not the investor's guide :: {"len":49958}
FAIL preview-sponsor the rules and the sponsor's guide still go with it
FAIL files help-data.js matches the server guide (make-help-data.mjs --verify passes) :: help-data.js: STALE (server guide b3e3b59755f1); run node .planning/tools/preview/make-help-data.mjs
HELP PREVIEW: FAIL (parts run: 6) - preview-sponsor, files
GATE FAIL HELP PREVIEW (6)
```
Every other step ok, among them `GATE ok   server tests 387 (found 387)`, `GATE ok   phase-8 gate checks found (4)`, `GATE ok   PACKAGE FLOW (10)`, `GATE ok   PACKAGE INVITE (12)`, `GATE ok   PACKAGE PANEL (7)`, `GATE ok   AML RECORD (7)`, and `COUNTS server tests 387; AML RECORD 7; PACKAGE FLOW 10; PACKAGE INVITE 12; PACKAGE PANEL 7`.
Cause: the guide line changed the server guide, and the owner's preview carries its own copy (.planning/tools/preview/help-data.js), which phase 7's check requires to match. Fix: `node .planning/tools/preview/make-help-data.mjs` ("wrote .planning/tools/preview/help-data.js (guide b3e3b59755f1, 72940 bytes)"; `--verify`: "help-data.js: current (guide b3e3b59755f1)"). The gate is rerun on the commit holding it. help-preview.js alone on that commit: `HELP PREVIEW: PASS (parts run: 6)`.

## Final verify, second full gate (on 774e2ee, before merging 08-19): PASSED, with one note
Run fresh on the new commit from 20:00 UTC (2026-11-26); it reached the base comparison and was stopped by the 2-hour limit; rerun into the same folder, every step was kept and the base comparison finished. 0 GATE FAIL lines, 42 GATE ok lines, `GATE_EXIT=0`. verify-2 itself exited 1 only because a resumed gate prints kept steps as "GATE ok   <step> (kept from <time>)" and the plan's verify matches those lines exactly (`grep -qx`); the same conditions with the suffix allowed ($O/verify-2-tail.sh: GATE_EXIT=0, server tests 387 (found 387), COUNTS, phase-8 gate checks found (4), PACKAGE FLOW (10), the file list) exit 0. The gate's last lines:
```
GATE ok   PACKAGE PANEL (7) (kept from 2026-11-26 21:35:09 UTC)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing-base (kept from 2026-11-26 21:48:07 UTC)
GATE ok   signing-plan (kept from 2026-11-26 21:53:53 UTC)
GATE ok   record-base (kept from 2026-11-26 21:54:57 UTC)
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 16 PASS / 5 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 387
# pass 387
# fail 0
COUNTS server tests 387; AML RECORD 7; PACKAGE FLOW 10; PACKAGE INVITE 12; PACKAGE PANEL 7
GATE_EXIT=0
```
Note: the phase-4 signing check on the base tree had 5 FAIL lines this time (08-07's run had 75/0 on its base); this plan's tree had 75 PASS / 0 FAIL, so the gate's rule (no FAIL the base lacks) holds. The base run's failures are not this plan's code.

## Merged tree (origin/claude/refract-reskin 085b7ce merged, 435a066; 08-19 included)
Conflicts only in the two generated files: server/lib/help-guide.mjs rebuilt with `node server/help/build.mjs` ("wrote server/lib/help-guide.mjs (78997 bytes)"), help-data.js with make-help-data.mjs ("guide dc9a040f8819, 73884 bytes"). Nothing written by hand.
Step 0 on the merged line: server tests at the merged base 085b7ce, measured in a full archive copy of that commit: `# tests 456`, `# pass 456`, `# fail 0` (more than the 408 quoted for fb84451: 10-10, 10-12, 11-10, 11-18 and others merged since). Merged tree: 456 (this plan adds no server test). Phase-8 gate checks on the merged tree: 6 (AML RECORD, PACKAGE CONSOLE, PACKAGE FLOW, PACKAGE INVITE, PACKAGE NAMES, PACKAGE PANEL). Sponsor guide 46,864 bytes of 48,000.
The gate steps the merge touches, rerun on 435a066 ($O/merged-checks.sh, $O/merged-checks.out):
```
MERGED ok   server tests 456 (expected 456), # fail 0
MERGED ok   # fail 0
MERGED ok   help-data.js: current (guide dc9a040f8819)
MERGED ok   HELP CHAT: PASS (parts run: 10)
MERGED ok   HELP PREVIEW: PASS (parts run: 6)
MERGED ok   AML RECORD: PASS (parts run: 7)
MERGED ok   PACKAGE CONSOLE: PASS (parts run: 7)
MERGED ok   PACKAGE FLOW: PASS (parts run: 10)
MERGED ok   PACKAGE INVITE: PASS (parts run: 12)
MERGED ok   PACKAGE NAMES: PASS (parts run: 4)
MERGED ok   PACKAGE PANEL: PASS (parts run: 7)
MERGED_EXIT=0 on 435a0660719fe18c90662664171f67a4e0220a37
```

## The owner's screens (merged tree)
A separate run, `--only full,letter-phone,letter-none` with P6_SHOTS=$O/owner-shots: `PACKAGE FLOW: PASS (parts run: 3)` (117 PASS). Kept with index.txt in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-08-18/owner-shots: the accreditation step through the package (1280x800), the waiting line and the verified details with "Download letter" (1280x800 and 390x844), and the preview without a server at both sizes (no control, no error).
Owner check still owed (the plan's human-check): in the published preview on the iPhone, Console, AML/KYC, an investor's details look as before, with no "Download letter" and no error text. The letter itself needs a connected portal; 08-12 shows it with the real providers.

## Exact lines added
console.js (diff against the base):
- added block directly above `NS.views['console-kyc']`: the `kycLetter(w, i, x, kind)` function (11 lines with its comment); its waiting line is `A reviewer's letter usually arrives within two business days; this page updates when it does.` in `<span class="sub kyc-wait">`; its button is `<button class="link-btn" type="button" data-action="kyc-evidence" data-id=".." data-n="..">Download letter</button>`
- the `ivLine` line: `${kycLetter(w, i, x, kind)}` inserted before the record buttons (its one change)
- one more changed line (deviation 1): `if (ivd && (rec.length || kycLetter(w, i, ivd.accreditation, 'accreditation')) && (lab.key === 'cleared' || lab.key === 'due')) act += ...Details...` (was `if (ivd && rec.length && ...)`)
- added block directly after `NS.actions['kyc-screen-due']`: `NS.actions['kyc-evidence']` (26 lines): fetch with `Authorization: Bearer <sponsor token>`, bytes to `U.download`, `The letter could not be downloaded. Try again.` on any failure

guide.md, one added line at the end of the bullets of `## console-kyc`:
`- "Download letter" in an investor's details saves the accreditation letter the reviewer sent; it shows only while the portal is connected to its integration server.`

## Deviations from plan
**1. [Rule 2 - missing functionality] One more changed line in console.js: the Details button.** The plan allows only the ivLine line plus two added blocks. The RED's diagnostic showed a cleared investor whose accreditation runs through the server had only "Re-screen": the details (and so the waiting line and "Download letter") could not be opened at all, because the decision is approved on identity and screening while the 506(c) accreditation is pending (the subscription is gated separately). The existing Details button is now offered when kycLetter has something to show; with no server nothing changes. The line is inside the AML/KYC view, which no other plan in this wave edits.

**2. [Rule 3 - blocking] .planning/tools/preview/help-data.js regenerated** (outside the plan's four files), because phase 7's HELP PREVIEW gate step requires it to match the server guide. verify-2's file list was extended by this one file.

**3. verify-2's final file list filters the plan's own SUMMARY** (wave-6 B2), and a resumed gate's "(kept from ...)" suffix is allowed in $O/verify-2-tail.sh (failure 2 above).

**4. Base counts differ from the plan's text (measured).** Server tests 387 at the plan's base (plan: 358; wave-6 W1 records 387); phase-8 checks 4 (08-17 not yet merged then); 456 and 6 on the merged tree.

**5. The letter's file name.** The server sends `Content-Disposition` but does not list it in `Access-Control-Expose-Headers`, so the console cannot read it from another origin; it names the file from the letter's label and the investor ("verification-letter-<investor>.pdf"). The check asserts the bytes (SHA-256), not the name.

## Found, not fixed (other plans' files; for the orchestrator)
- **A result that arrives before the import has no letter.** server/lib/invitations.mjs `confirmChecks` copies status, method and dates of the server's check onto the imported record, not `evidence`; the console polls only pending checks, so an accreditation already verified when the sponsor imports shows verified with no "Download letter". Read from the code (around line 928 at the base); no part exercises it. The fix belongs to the server (copy `evidence` with the other result fields) or integrations.js.
- **Content-Disposition not exposed** (server/lib/http.mjs `cors`): adding `Access-Control-Expose-Headers: Content-Disposition` would let the console use the provider's file name.
- The waiting line's "two business days" is the plan's wording, an assumption about the accreditation provider's usual turnaround (not confirmed; for 08-03 and 08-12).
- integrations.js (08-19's file): no fault found by these parts.

## Known stubs
None. The stand-ins are test-only (checks/doubles/).

## Threat flags
None beyond the plan's model: the letter is fetched only through the token-guarded evidence route (T-08-21); no link is rendered for investors; letter-none proves no control without a server; part full proves no "verified by" with the platform's or the product's name (T-08-53).

## Cleanup
$O/base-tree, $O/checks-out, $O/shots and $O/owner deleted after the gate; the merged run's checks-out and shots and the owner run's output folder deleted; owner-shots kept for the walkthrough. The server/node_modules link is removed at the end.

## Self-Check: PASSED
- FOUND: assets/js/console.js (kycLetter, kyc-evidence), server/help/guide.md (Download letter line), server/lib/help-guide.mjs, .planning/tools/preview/help-data.js, checks/package-flow.js (full, letter-phone, letter-none)
- FOUND on origin/wip/08-18: 17258bc f5a0d05 9869eab 2479e4f 42cd627 372929e a445ed8 0a8c9b5 774e2ee 252ca14 435a066
