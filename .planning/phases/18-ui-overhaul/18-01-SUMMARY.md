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

## Task 2 RED (O/red-2.txt: the new self-test run against gate16's steps, GATE18_* stand-in names read into them)

```
SELF-TEST FAIL control: the stand-ins pass when nothing is wrong
SELF-TEST ok   a phase 18 check whose last line differs from its marker
SELF-TEST ok   a phase 18 check file with no marker
SELF-TEST FAIL a reference whose folder line is missing
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
SELF-TEST FAIL a phase 12 check (run without being named) whose last line differs from its marker
SELF-TEST FAIL GATE18_PHASES naming a phase outside 08 09 10 11
SELF-TEST FAIL a phase 08 gate check that prints no PASS line
SELF-TEST FAIL a PHONE LAYOUT desktop comparison whose last line is not PHONE LAYOUT: PASS (parts run: 4)
SELF-TEST FAIL a phase-18-only run
GATE18 SELF-TEST: FAIL - control nofolder p12 phases p08 phone only
```

## Task 2 GREEN (O/self.txt)

```
SELF-TEST ok   control: the stand-ins pass when nothing is wrong (base tree passed to every check, phases 12..16 always, 08 and 09 as named, the phone comparison against its base; never the line of a real gate)
SELF-TEST ok   a phase 18 check whose last line differs from its marker
SELF-TEST ok   a phase 18 check file with no marker
SELF-TEST ok   a reference whose folder line is missing (and nothing was run)
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
SELF-TEST ok   a phase 12 check (run without being named) whose last line differs from its marker
SELF-TEST ok   GATE18_PHASES naming a phase outside 08 09 10 11
SELF-TEST ok   a phase 08 gate check that prints no PASS line
SELF-TEST ok   a PHONE LAYOUT desktop comparison whose last line is not PHONE LAYOUT: PASS (parts run: 4)
SELF-TEST ok   a phase-18-only run ends 'GATE_EXIT=0 (phase 18 checks only)' with no reference step and no server test line, and 'GATE_EXIT=1' when a phase 18 check fails
GATE18 SELF-TEST: PASS (10)
```

Task 2 verify: every condition held. `--only-phase18` run before Task 3 wrote the other nine parts (O/only18-t2.txt; a
FAIL was expected then; it showed the gate extracts the base tree, runs SAME SCREENS with P18_BASE, judges its last line
and removes the base tree):

```
GATE FAIL SAME SCREENS
  same-screens.js: the last line should be: SAME SCREENS: PASS (parts run: 11)
  same-screens.js: the last line was:       SAME SCREENS: FAIL (parts run: 11) - console-phone, managed-desktop, managed-phone, investor-desktop, investor-phone, flows-desktop, flows-phone, dialogs-desktop, dialogs-phone
GATE_EXIT=1
```

## Task 3 RED (O/red-3.txt: every part written, the DIALOGS table emptied; commit a16dffc; the dialogs parts only)

```
FAIL dialogs-desktop the DIALOGS table names every call site: 0 rows for 34 call sites :: {"without":[{"file":"coinvestor.js","calls":6,"rows":0,"lines":[122,130,270,295,306,355]},{"file":"console.js","calls":3,"rows":0,"lines":[1047,1505,1677]},...
FAIL dialogs-desktop call sites without a row: 34 :: ["coinvestor.js: 6 calls, 0 rows","console.js: 3 calls, 0 rows","diy.js: 1 calls, 0 rows","esign.js: 11 calls, 0 rows","help.js: 1 calls, 0 rows",...
FAIL dialogs-phone the DIALOGS table names every call site: 0 rows for 34 call sites :: ...
FAIL dialogs-phone call sites without a row: 34 :: ...
SAME SCREENS: FAIL (parts run: 2) - dialogs-desktop, dialogs-phone
```
