---
phase: 15-security
plan: 02
subsystem: security / two-step sign-in
tags: [totp, rfc6238, rfc4226, hmac-sha1, gate]
status: blocked
blocked_by: "WebKit is not installed on this machine: TOTP FRAME's two WebKit parts fail, so Task 2's verify and gate15 (GATE_EXIT=1) fail on that one step"
requires: []
provides:
  - "assets/js/totp.js: window.CVPortal.totp / module.exports (base32, hotp, totp, verify, newKey, formatKey, otpauth, recovery codes, browserHmac, usesWebCrypto, demoHmacSha1)"
  - ".planning/phases/15-security/checks/gate15.sh: the phase 15 gate (self-test PASS (9))"
affects: ["15-04 (server loads totp.js with createRequire)", "15-07 (first page to load it)", "every later phase 15 plan (closes with gate15.sh)"]
tech-stack:
  added: []
  patterns: ["UMD file shared by page and server (as formd.js)", "HMAC injected by the caller: node:crypto on the server, WebCrypto or the preview's own in a page"]
key-files:
  created: [assets/js/totp.js, server/test/totp.test.mjs, .planning/phases/15-security/checks/totp-frame.js, .planning/phases/15-security/checks/gate15.sh]
  modified: []
decisions:
  - "verify computes every candidate step and compares all six characters with no early exit, then returns the first match after lastStep"
  - "recovery characters are drawn without bias (bytes at or above 248 are drawn again for the 31-character alphabet)"
  - "totp-frame.js serves its host page, frame page and totp.js from its own loopback server and names that server in script-src (frame with no same origin)"
  - "totp-frame.js always runs every part (GATE_FRESH=1 inside, as phase 14's watermark.js does) so the 'frame WebCrypto' lines always print"
  - "gate15.sh: a phase 13 or 14 folder holding no check prints 'phase NN checks: none in this tree'"
metrics:
  completed: 2026-11-27
  tasks: "3 of 3 built; Task 2's verify and the gate fail on WebKit only"
actuals:
  tokens: 14600
  tasks: 3
  commits: 11
plan_head_before: a1338b462f5be391adca1a3056099d469a91dc2f
---

# Phase 15 Plan 02: the two-step code module and the phase gate

One file, assets/js/totp.js, computes and checks authenticator-app codes for both the browser and the server. The RFCs'
published test values pass on the server (node:crypto) and in Chromium inside a sandboxed frame with no network, with
WebCrypto and with WebCrypto removed. gate15.sh is the phase gate (self-test PASS (9)). WebKit could not be run here, so
the plan is **not complete**: the gate run ends GATE_EXIT=1 on that one step.

Base commit: a1338b462f5be391adca1a3056099d469a91dc2f (a1338b4). Server tests measured on the base: 422 (`# tests 422`, `# fail 0`).
Nothing is on screen yet: no page loads totp.js (15-07 adds the first one; 15-04 is the first server user).

## Failures first

0. **gate15.sh run on this tree: GATE_EXIT=1.** 88 `GATE ok` lines and one `GATE FAIL TOTP FRAME`. The cause is item 1.
1. **WebKit is not installed on this machine, so the frame check's two WebKit parts fail** (`webkit-subtle`, `webkit-fallback`):
   `browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2359/pw_run.sh`. Playwright 1.63.0 is installed with
   Chromium only (`/opt/pw-browsers`: chromium-1243, chromium_headless_shell-1243, ffmpeg). Installing WebKit is a download
   (`playwright install webkit`, from cdn.playwright.dev, plus its system libraries) that the plan rules out ("No package is
   installed") and the disk could not hold (free space on / went from 294 MB to 9 MB and back to about 440 MB during this
   run, shared with the other builds). Not installed. So `TOTP FRAME` ends `FAIL (parts run: 4) - webkit-subtle, webkit-fallback`
   and Task 2's verify does not pass. The WebKit answer to Open Question 1 is therefore NOT measured.
2. Two check bugs found by the first GREEN runs and fixed in the check (not in totp.js): in a frame with no same origin, totp.js
   did not load at all. (a) The frame's origin is opaque, which `'self'` does not match, so the check server is named in
   script-src; (b) Chromium then refused the script by its local-network rule, because pages Playwright fulfils itself carry no
   network address; the check now serves its host page, frame page and totp.js from its own loopback server. A new check line
   ("the page loaded with nothing refused ... and no script error") would have caught both at once.

## RED evidence (verbatim last lines)

### Task 1 RED (O/red-1.txt), no assets/js/totp.js yet

```
=== server: node --test --test-name-pattern='rfc 6238' test/totp.test.mjs (no assets/js/totp.js yet)
# Error: Cannot find module '/home/user/Hhhh/.claude/worktrees/agent-a45c65148bdab00f4/assets/js/totp.js'
not ok 1 - test/totp.test.mjs
# tests 1
# pass 0
# fail 1
=== frame: totp-frame.js --part chromium-subtle (no assets/js/totp.js yet)
FAIL chromium-subtle assets/js/totp.js loads in the frame (window.CVPortal.totp) :: {"loaded":false}
TOTP FRAME: FAIL (parts run: 1) - chromium-subtle
```

### Task 2 RED (O/red-2.txt), Task 1's totp.js only

```
ok 1 - rfc 6238
ok 2 - rfc 4226
ok 3 - base32
not ok 4 - window          error: 'T.newKey is not a function'
not ok 5 - replay          error: 'T.newKey is not a function'
not ok 6 - set-up address  error: 'T.newKey is not a function'
not ok 7 - recovery
not ok 8 - fallback hmac
# tests 8
# pass 3
# fail 5
```
rfc 4226 and base32 already pass here because Task 1's GREEN built hotp and base32 (as the plan assigns); their RED is Task 1's (no file).

### Task 3 RED (O/red-3.txt), gate15.sh as gate13.sh renamed, plus the p13 case

```
SELF-TEST FAIL GATE15_PHASES naming phase 13 whose check's last line differs
    GATE FAIL GATE15_PHASES names "13" (allowed: 08 09 10 11 12, or the word none); no other phase was run
GATE15 SELF-TEST: FAIL - p13
```

## Verify lines

### Task 1 (server test and chromium-subtle)

```
# tests 1
# pass 1
# fail 0
PASS chromium-subtle every value was computed with WebCrypto
TOTP FRAME: FAIL (parts run: 2) - chromium-fallback      <- run of chromium-subtle,chromium-fallback with Task 1's totp.js:
                                                           chromium-subtle passed all 12 lines; chromium-fallback is Task 2's RED
FAIL chromium-fallback ran to the end :: frame.evaluate: Error: This page offers no WebCrypto.
```

### Task 2 RED, frame parts (Task 1's totp.js)

```
FAIL chromium-fallback ran to the end :: frame.evaluate: Error: This page offers no WebCrypto.
FAIL webkit-subtle webkit starts :: browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2359/pw_run.sh
FAIL webkit-fallback webkit starts :: browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2359/pw_run.sh
```

### Task 2 (O/t2.txt, O/frame.txt)

```
ok 1 - rfc 6238
ok 2 - rfc 4226
ok 3 - base32
ok 4 - window
ok 5 - replay
ok 6 - set-up address
ok 7 - recovery
ok 8 - fallback hmac
# tests 8
# pass 8
# fail 0
```
```
frame WebCrypto: yes (chromium, secure context: yes)
PASS chromium-subtle RFC 6238's six SHA-1 values (8 digits) are computed exactly
PASS chromium-subtle RFC 4226's ten HOTP values are computed exactly
PASS chromium-subtle every value was computed with WebCrypto
PASS chromium-fallback crypto.subtle is gone inside the frame before the call
PASS chromium-fallback RFC 6238's six SHA-1 values (8 digits) are computed exactly
PASS chromium-fallback RFC 4226's ten HOTP values are computed exactly
PASS chromium-fallback the preview's own HMAC computed every value (WebCrypto removed)
PASS chromium-fallback no request was tried while the codes were computed (no refused connection, no request at all)
FAIL webkit-subtle webkit starts :: browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2359/pw_run.sh
FAIL webkit-fallback webkit starts :: browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2359/pw_run.sh
TOTP FRAME: FAIL (parts run: 4) - webkit-subtle, webkit-fallback
```
Task 2 verify: FAILS on the frame line only (WebKit missing). The server half passes.

### Task 3 (O/self.txt, O/all.txt; verify plus B1's `grep -q 'GATE_FRESH=1'`: VERIFY3 EXIT=0)

```
SELF-TEST ok   GATE15_PHASES naming a phase (12) whose check's last line differs
SELF-TEST ok   GATE15_PHASES naming phase 13 whose check's last line differs
GATE15 SELF-TEST: PASS (9)
# tests 430
# pass 430
# fail 0
```
430 = base 422 + 8. No page or server module changed (git diff --quiet against a1338b4 for diy.html, portal.html, index.html,
server/lib, server/index.mjs).

B1 checked by hand on a stand-in run: GATE_OUT/gate/base-commit.txt "old", GATE_OUT/base-commit.txt "new" prints
`GATE note  base commit changed: every step runs again` first; the same base prints no note.

## Open Question 1 (does the owner's kind of frame offer WebCrypto?)

- Chromium (sandbox="allow-scripts", no same origin, connect-src 'none', 390x844 touch): **yes**, and it is a secure context.
- WebKit: **not measured** (WebKit is not installed here; see Failures first).

## Gate run (GATE_OUT=SCRATCH/exec-15-02, base-commit.txt = a1338b4, HEAD 6d06a94, default phases 08 to 14)

It took three runs into the same folder. Runs 1 and 2 were stopped at the two-hour limit for background commands, and
each rerun kept every step that had passed. Run 1 also had **one failure that did not come back**: CO-INVESTOR SERVER,
part cosign-forged ("the same submission arriving again changes nothing ... and an audit line says so ::
{"said":[],"same":true}"). Run 2 ran it again on the same tree and it passed (`GATE ok   CO-INVESTOR SERVER (5)`). The
check also passes in 15-03's gate on the same base, and this plan changes nothing it uses, so it looks flaky under load.
That is not proven. Run 1's output is kept in SCRATCH/exec-15-02/coserver-run1.txt.

Last lines of run 3 (O/gate.txt):

```
GATE ok   HELP PREVIEW (6) (kept from 2026-11-27 00:15:19 UTC)
GATE ok   signing: no FAIL the base lacks
GATE ok   record: no FAIL the base lacks
GATE ok   base-server-tests (kept from 2026-11-27 00:50:56 UTC)
GATE ok   server tests 430 = base 422 + 8 declared
GATE ok   AML RECORD (7)
...
GATE ok   REPORTS XLSX
GATE ok   phase 13 checks: none in this tree
GATE ok   DATAROOM MODEL
GATE ok   WATERMARK
GATE FAIL TOTP FRAME
  totp-frame.js: the last line should be: TOTP FRAME: PASS (parts run: 4)
  totp-frame.js: the last line was:       TOTP FRAME: FAIL (parts run: 4) - webkit-subtle, webkit-fallback
GATE_EXIT=1
```

Every reference gate step passed (its own GATE_EXIT=0): the 28 named steps from STATUS MATH (13) to HELP PREVIEW (6),
plus the phase 4 signing and phase 5 record comparisons with the base. Phase 08's six checks, phase 09's eight, phase 10's
thirteen, phase 11's twelve, phase 12's seven and phase 14's two all passed. Phase 13 has no check in this tree.

GATE_EXIT=1

## What is needed to finish (for the orchestrator; the owner's choice)

- **Option A, install WebKit for the checks ($0):** `node $(npm root -g)/playwright/cli.js install webkit` (WebKit 26.6,
  Playwright build v2359, into /opt/pw-browsers) and `... install-deps webkit` (apt, as root). Most of WebKit's system
  libraries are missing here: ldconfig does not find libgtk-4, libwoff2dec, libavif, libenchant-2, libsecret-1, libmanette,
  libwpe, libsoup-3 or libgstgl. There is room now (about 8.8 GB free at the end of the run). Then rerun
  `GATE_OUT=SCRATCH/exec-15-02 bash .planning/phases/15-security/checks/gate15.sh` on the HEAD the gate judged (6d06a94).
  Every passed step is kept and only TOTP FRAME runs again. Plans 15-07, 15-09, 15-10, 15-11, 15-16, 15-18, 15-19 and
  15-20 also call for WebKit.
- **Option B, Chromium stands in for WebKit** (as phase 6's checks did: "Real WebKit is not installed here"): the WebKit
  parts would be removed, or changed to Chromium with an iPhone profile. The WebKit answer to Open Question 1 would stay
  unknown until the owner's own iPhone check. This needs a plan change and was not done here.

## Commits (on wip/15-02; not merged)

| Commit | What |
|--------|------|
| 22482fc | test: RED rfc 6238 test and the frame part chromium-subtle |
| 5e22c89 | test: RED gate15.sh (gate13.sh renamed) plus the p13 self-test case |
| 9201568 | feat: gate15.sh, self-test PASS (9), B1 GATE_FRESH note |
| 7a3cc9a | feat: totp.js base32, hotp, totp, WebCrypto HMAC (Task 1 GREEN) |
| 5c7a212 | test: RED tests 2-8 and three more frame parts |
| 7da9120 | wip: summary with RED evidence |
| 976d933 | fix: totp-frame names the check server in script-src |
| 698f32b | fix: totp-frame serves its pages from a real loopback server |
| a9159c3 | feat: totp.js verify, set-up key and address, recovery codes, the preview's own HMAC (Task 2 GREEN) |
| 6d06a94 | wip: summary with verify lines (the HEAD the gate judged) |
| (next) | docs: this summary with the gate result |

## Deviations from Plan

1. **[Rule 1, check bug] totp-frame.js frame set-up.** The plan said to copy no-network.js's frame set-up, which uses
   allow-same-origin and pages Playwright fulfils itself. With the plan's sandbox (scripts only), that set-up never loaded
   totp.js: the origin is opaque, and Chromium's local-network rule refused the script. The check now runs its own loopback
   server for the three files and names it in script-src. Commits 976d933 and 698f32b.
2. **[Rule 2] gate15.sh other phases:** a phase whose checks folder exists but holds no check (phase 13 holds only
   gate13.sh) prints "GATE ok   phase NN checks: none in this tree" instead of printing nothing.
3. **Order of commits:** Task 3's RED and gate15.sh were committed while Task 1's frame run waited in the shared browser
   queue. Each task still has its own RED commit before its GREEN commit.
4. **The plan's Task 3 note "A full gate run is not needed here":** the orchestrator required a full run. It was done (above).
5. **Test 1's marker reads "// gate: tests 8" from Task 1 on**, as the plan says. Until Task 2 the file declared 8 tests
   while it held 1.
6. **Not done, by the rules of this run:** STATE.md, ROADMAP.md, REQUIREMENTS.md and .planning/WINDOWS.md are not touched.
   AUTOPILOT says executors never touch STATE.md or ROADMAP.md, and only the plan's files plus this summary are changed.

## Threat model check

- T-15-09: exact RFC values, one step either side, steps at or before lastStep refused (tests window and replay).
- T-15-10: verify compares six characters with no early exit, for every candidate step.
- T-15-11: demoHmacSha1 is reachable only through browserHmac and says it is the preview's only fallback (the fallback
  hmac test checks that the comment is there). The server test passes node:crypto.
- T-15-12: otpauth's issuer is whatever the caller passes (the firm's name); the set-up address test uses "Harbor Ridge".
  totp.js passes phase 6's VENDORS, VENDOR_RE and WORD_RE patterns.
- T-15-13: gate15's self-test has nine faults, including the phase 13 stand-in.
- No new network endpoint, sign-in path or schema: no threat flags.

## Known Stubs

None. totp.js is complete for the plan's interface. It is not wired to any screen or route yet (15-04 and 15-07 do that).

## Self-Check

- FOUND: assets/js/totp.js, server/test/totp.test.mjs, .planning/phases/15-security/checks/totp-frame.js,
  .planning/phases/15-security/checks/gate15.sh
- FOUND (ancestors of HEAD): 22482fc 5e22c89 9201568 7a3cc9a 5c7a212 7da9120 976d933 698f32b a9159c3 6d06a94
- server/node_modules link removed from the worktree.

## Self-Check: PASSED (files and commits). The plan's own done criteria are NOT met (WebKit).
