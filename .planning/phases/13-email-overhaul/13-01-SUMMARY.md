---
phase: 13-email-overhaul
plan: 01
status: in-progress
---

# Phase 13 Plan 01: the one template set (draft, written as the work goes)

Start commit (base): e87b658070a52ee78055d9fcce0fe9d3ef1d6e72. Base server tests: 478.

## Evidence as produced

### gate13.sh base-change rule (re-check B1)
`GATE_OUT=<scratch> bash .planning/phases/13-email-overhaul/checks/gate13.sh --self-test` last line after the edit:
```
GATE13 SELF-TEST: PASS (8)
```

### Task 1 RED (SCRATCH/exec-13-01/red-1.txt)
```
not ok 1 - tracer: the invitation the server keeps in its outbox is emails.js’s render of the same snapshot
    Cannot find module '../../assets/js/emails.js'
# tests 1
# pass 0
# fail 1
```

### Task 1 verify (t1.txt)
```
# tests 1
# pass 1
# fail 0
```
VERIFY1=0 (base-count.txt 478 >= 478; red-1.txt has a failing line; first line "// gate: tests 8").
