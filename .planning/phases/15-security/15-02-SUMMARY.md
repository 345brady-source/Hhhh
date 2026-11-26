---
phase: 15-security
plan: 02
status: in-progress
---

# Phase 15 Plan 02: the two-step code module and the phase gate (in progress)

Base commit: a1338b462f5be391adca1a3056099d469a91dc2f (a1338b4). Server tests on the base, measured: 422 (`# tests 422`, `# fail 0`).

## Failures first

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
