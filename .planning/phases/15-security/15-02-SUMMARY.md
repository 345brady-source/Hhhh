---
phase: 15-security
plan: 02
status: in-progress
---

# Phase 15 Plan 02: the two-step code module and the phase gate (in progress)

Base commit: a1338b462f5be391adca1a3056099d469a91dc2f (a1338b4). Server tests on the base, measured: 422 (`# tests 422`, `# fail 0`).

## Failures first

(filled in as runs end)

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

(filled in as runs end)
