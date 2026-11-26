# Phase 8 Plan 18 (in progress): evidence as it is produced

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
