---
phase: 18-ui-overhaul
plan: 01
status: in-progress
---

# Phase 18 Plan 01: SAME SCREENS and gate18 (evidence log, written as it is produced)

## Start

- Start commit (O/base-commit.txt): d36521bc4a0a9bf259dc67324c8802985d78bd5c
- Waits (each `git merge-base --is-ancestor <c> HEAD` exit 0; O/waits.txt empty): dcf002f, aeed1ab, 4277aa8, adba2c8
- Server tests at the start commit (O/st-base.txt, O/base-count.txt): `# tests 622`, `# pass 622`, `# fail 0` -> 622

## Task 1 RED (O/red-1.txt, compare() stubbed to always ok; content committed in a4217c4, marked by the empty test commit before 3ba688c)

```
NOTE WebKit not run: Chromium with the iPhone profile stands in; the owner's iPhone check covers Safari
FAIL selftest fault word caught: nothing failed (PASS console-desktop admin console-offerings)
FAIL selftest control c1-help passes (C1): PASS console-desktop admin console
FAIL selftest fault c1-wrong caught: nothing failed (PASS console-desktop admin console-offerings)
PASS console-desktop admin console
PASS console-desktop no request left the page's origin on this tree (1 screens)
PASS console-desktop screens recorded on both trees: 1
SAME SCREENS: FAIL (parts run: 2) - selftest
```

## Task 1 GREEN (O/t1.txt)

```
NOTE WebKit not run: Chromium with the iPhone profile stands in; the owner's iPhone check covers Safari
PASS selftest fault word caught: FAIL console-desktop admin console-offerings: content lines #2 of 39/39: base "Each investment is configured separately: how exit is defined, how often it pays, and which terms investors see." plan "Each investment is set up separately: how exit is defined, how often it pays, and which terms investors see."
PASS selftest control c1-help passes (C1): PASS console-desktop admin console (C1)
PASS selftest fault c1-wrong caught: FAIL console-desktop admin console-offerings: content lines #4 of 39/39: base "Add offering" plan "Ask me anything"
PASS console-desktop admin console
PASS console-desktop no request left the page's origin on this tree (1 screens)
PASS console-desktop screens recorded on both trees: 1
SAME SCREENS: PASS (parts run: 2)
```

Task 1 verify: every condition held (base-commit, count 622 >= 622, waits empty, red-1 last line, t1 PASS (2), word and
c1-wrong caught, NOTE line, no product file changed against the start commit).
