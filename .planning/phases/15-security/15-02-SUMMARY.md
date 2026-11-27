---
phase: 15-security
plan: 02
subsystem: security / two-step sign-in
tags: [totp, rfc6238, rfc4226, hmac-sha1, gate]
status: complete
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
  - "orchestrator (2026-11-27, Option B): no WebKit in this container; totp-frame.js runs its WebKit parts only where WebKit starts, prints one NOTE line otherwise, Chromium parts use phase 6's iPhone profile; marker TOTP FRAME: PASS (parts run: 2)"
metrics:
  completed: 2026-11-27
  tasks: 3
actuals:
  tokens: 15000
  tasks: 3
  commits: 13
plan_head_before: a1338b462f5be391adca1a3056099d469a91dc2f
gate_head: 5b0146f
---

# Phase 15 Plan 02: the two-step code module and the phase gate

One file, assets/js/totp.js, computes and checks authenticator-app codes for both the browser and the server. The RFCs'
published test values pass on the server (node:crypto) and in Chromium (iPhone profile) inside a sandboxed frame with no
network, with WebCrypto and with WebCrypto removed. gate15.sh is the phase gate: self-test PASS (9), and its full run on
this tree ends GATE_EXIT=0. Nothing here is on screen yet and nothing is called ready: no page loads totp.js (15-07 adds
the first one; 15-04 is the first server user), and the owner's iPhone check is still to come.

Base commit: a1338b462f5be391adca1a3056099d469a91dc2f (a1338b4). Server tests measured on the base: 422 (`# tests 422`, `# fail 0`).

## Failures first

1. **WebKit is not installed in this container, so nothing here ran in real WebKit.** Playwright 1.63.0 has Chromium only
   (/opt/pw-browsers), and WebKit would also need system libraries that are missing (ldconfig does not find libgtk-4,
   libwoff2dec, libavif, libenchant-2, libsecret-1, libmanette, libwpe, libsoup-3 or libgstgl). The first version of the
   frame check had two WebKit parts, and they failed:
   `FAIL webkit-subtle webkit starts :: browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2359/pw_run.sh`.
   That made the gate run on 6d06a94 end `GATE_EXIT=1` (88 ok, one `GATE FAIL TOTP FRAME`).
   **Decision (orchestrator, 2026-11-27, 15-CONTEXT "no WebKit in this container", Option B):** do not install WebKit.
   Chromium with phase 6's iPhone profile stands in. Where WebKit cannot start with "Executable doesn't exist", the check
   prints exactly one line, `NOTE WebKit not installed here: the owner's iPhone check covers WebCrypto and the fallback in the frame`,
   and does not count the WebKit parts. The marker is `TOTP FRAME: PASS (parts run: 2)`. Where WebKit is present, its two
   parts still run (and the full count is 4). **The WebKit answer to Open Question 1 is not measured;** the owner's iPhone
   check (15-11) is the only WebKit test.
2. **EMAIL DIALOG (a reference gate step, phase 6) failed twice on 5b0146f, then passed** on a third run of the same tree:
   `FAIL phone phone-390x844-frame520px: every paragraph of the email, its footer and the buttons were seen whole (10 of 11) :: ["p: The link below takes you through everyth"]`.
   It passed in all three runs on 6d06a94, and this plan changes nothing it uses (only totp-frame.js changed between the
   two trees). Another tree failed the same way at about the same time (exec-report-fixes, 06:06), and a scratchpad
   folder `emflaky/` shows the flakiness is being looked into. Kept: SCRATCH/exec-15-02/email-run4.txt and email-run5.txt.
3. **CO-INVESTOR SERVER (reference gate, phase 6), part cosign-forged, failed once** in the first run on 6d06a94 ("an
   audit line says so :: {"said":[],"same":true}"), then passed on a rerun of the same tree. It passes in 15-03's gate too,
   so it looks flaky under load. That is not proven. Kept: SCRATCH/exec-15-02/coserver-run1.txt.
4. **Check bugs found by the first GREEN runs, fixed in the check (not in totp.js).** With a frame that has no same origin,
   totp.js did not load at all. (a) The frame's origin is opaque, which `'self'` does not match, so the check server is
   named in script-src. (b) Chromium then refused the script by its local-network rule, because pages Playwright fulfils
   itself carry no network address; the check now serves its host page, frame page and totp.js from its own loopback
   server. A new check line ("the page loaded with nothing refused ... and no script error") catches both.

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
- WebKit: **not measured here** (WebKit is not installed in this container). Orchestrator decision 2026-11-27: the owner's
  iPhone check (15-11) covers WebCrypto and the fallback in the frame in Safari.

## The check still fails when totp.js is broken (after the WebKit change)

A planted bug (hotp's offset `& 15` changed to `& 14`, uncommitted) was run through the changed check, then reverted with
`git checkout -- assets/js/totp.js` (status clean again at 5b0146f). Output (SCRATCH/exec-15-02/planted.txt):

```
NOTE WebKit not installed here: the owner's iPhone check covers WebCrypto and the fallback in the frame
PASS chromium-subtle the page runs in a sandboxed frame with no same origin, on a 390x844 touch screen with an iPhone's user agent
FAIL chromium-subtle RFC 6238's six SHA-1 values (8 digits) are computed exactly :: {"got":["80435326","07081804","19292136","70034533","09409713","65353130"],...
FAIL chromium-subtle RFC 4226's ten HOTP values are computed exactly :: {"got":["755224","435326","359152","969429","338314","254676","287922","162583","516548","905116"],...
FAIL chromium-fallback RFC 6238's six SHA-1 values (8 digits) are computed exactly :: ...
FAIL chromium-fallback RFC 4226's ten HOTP values are computed exactly :: ...
TOTP FRAME: FAIL (parts run: 2) - chromium-subtle, chromium-fallback
```

## Gate run on 5b0146f (GATE_OUT=SCRATCH/exec-15-02, base-commit.txt = a1338b4, GATE_SERVER_TESTS=430, phases 08 to 14)

The new commit changed the tree key (HEAD), so every step ran again; nothing from the 6d06a94 runs was kept. It took
three runs into the same folder: the first ran every step and failed only EMAIL DIALOG; the second reran only EMAIL
DIALOG and it failed again; the third reran it and it passed (see Failures first, item 2). Last lines of the third run
(O/gate.txt):

```
GATE ok   EMAIL DIALOG (3)
...
GATE ok   server tests 430 = base 422 + 8 declared
...
GATE ok   REPORTS XLSX (kept from 2026-11-27 06:11:01 UTC)
GATE ok   phase 13 checks: none in this tree
GATE ok   DATAROOM MODEL (kept from 2026-11-27 06:11:07 UTC)
GATE ok   WATERMARK (kept from 2026-11-27 06:11:10 UTC)
GATE ok   TOTP FRAME (kept from 2026-11-27 06:11:13 UTC)
GATE_EXIT=0
```

89 `GATE ok` lines, 0 `GATE FAIL`. The reference gate's own count line is `GATE ok   server tests 430` (GATE_SERVER_TESTS=430)
and its own GATE_EXIT is 0. Phase 08's 6 checks, 09's 8, 10's 13, 11's 12, 12's 7, 14's 2 and phase 15's TOTP FRAME all
passed; phase 13 has no check in this tree. The frame check's lines in the gate (O/gate/totp-frame.txt):

```
NOTE WebKit not installed here: the owner's iPhone check covers WebCrypto and the fallback in the frame
frame WebCrypto: yes (chromium, secure context: yes)
frame WebCrypto: yes (chromium, secure context: yes)
TOTP FRAME: PASS (parts run: 2)
```

GATE_EXIT=0

Earlier gate runs on 6d06a94 (before the decision): reference passed, every other phase's checks passed, and
`GATE FAIL TOTP FRAME` (`TOTP FRAME: FAIL (parts run: 4) - webkit-subtle, webkit-fallback`) gave GATE_EXIT=1.

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
| 6d06a94 | wip: summary with verify lines |
| 93f875c | docs: summary with the first gate result (GATE_EXIT=1, WebKit) |
| 5b0146f | fix: totp-frame runs WebKit parts only where WebKit is installed; Chromium iPhone profile (the HEAD the gate judged) |
| (next) | docs: this summary |

## Deviations from Plan

1. **[Orchestrator decision, Option B] WebKit parts.** The plan's truth SE-13 asks for Chromium and WebKit. WebKit is not
   installed here, so the WebKit parts run only where WebKit starts. Chromium now uses phase 6's iPhone profile (390x844,
   device scale 3, touch, iOS user agent; the check asserts the user agent). The marker counts 2 parts. Commit 5b0146f.
2. **[Rule 1, check bug] totp-frame.js frame set-up.** The plan said to copy no-network.js's frame set-up, which uses
   allow-same-origin and pages Playwright fulfils itself. With the plan's sandbox (scripts only), that set-up never loaded
   totp.js. The check now runs its own loopback server for the three files and names it in script-src. Commits 976d933
   and 698f32b.
3. **[Rule 2] gate15.sh other phases:** a phase whose checks folder exists but holds no check (phase 13 holds only
   gate13.sh) prints "GATE ok   phase NN checks: none in this tree" instead of printing nothing.
4. **Order of commits:** Task 3's RED and gate15.sh were committed while Task 1's frame run waited in the shared browser
   queue. Each task still has its own RED commit before its GREEN commit.
5. **The plan's Task 3 note "A full gate run is not needed here":** the orchestrator required a full run. It was done (above).
6. **Test 1's marker reads "// gate: tests 8" from Task 1 on**, as the plan says. Until Task 2 the file declared 8 tests
   while it held 1.
7. **Not done, by the rules of this run:** STATE.md, ROADMAP.md, REQUIREMENTS.md and .planning/WINDOWS.md are not touched.
   AUTOPILOT says executors never touch STATE.md or ROADMAP.md, and only the plan's files plus this summary are changed.
8. **Base kept at a1338b4.** The gate judged 5b0146f on that base; claude/refract-reskin has moved since (df80f88). This
   branch was not rebased.

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

## Open items

- WebKit is not measured. The owner's iPhone check (15-11) covers WebCrypto and the fallback in the frame in Safari.
- EMAIL DIALOG's phone part and CO-INVESTOR SERVER's cosign-forged part each failed under load and passed on a rerun of the
  same tree; neither is caused by this plan.

## Self-Check

- FOUND: assets/js/totp.js, server/test/totp.test.mjs, .planning/phases/15-security/checks/totp-frame.js,
  .planning/phases/15-security/checks/gate15.sh
- FOUND (ancestors of HEAD): 22482fc 5e22c89 9201568 7a3cc9a 5c7a212 7da9120 976d933 698f32b a9159c3 6d06a94 93f875c 5b0146f
- server/node_modules link removed from the worktree; the planted bug reverted (git status clean before this summary).

## Self-Check: PASSED
