---
status: investigating
trigger: "SERVER MODE printed once `SERVER MODE: FAIL (parts run: 15) - tax-request` at 75b2fc5 (after merging 13-03); two immediate reruns PASS; failing run's detail not kept"
created: 2026-11-27T00:00:00Z
updated: 2026-11-27T00:00:00Z
---

## Current Focus

hypothesis: (none yet) gathering initial evidence
bug_class: Heisenbug (observed once in 3 runs; first run under 3-4 concurrent gates)
test: read tax-request part (server-mode.js:1550-1651) and the product path it drives
expecting: list of assertions that can be timing- or random-token-sensitive
next_action: read lib.js runParts/serverPortal/leakCheck and the product tax-request path; then start 20+ repro runs of `--only tax-request`

## Symptoms

expected: `SERVER MODE: PASS (parts run: 15)` on every run of server-mode.js at 75b2fc5
actual: one run printed `SERVER MODE: FAIL (parts run: 15) - tax-request`; two immediate reruns on the same tree PASS
errors: failing check line(s) not kept
reproduction: `node .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js` (through heavy.sh), first failure while 3-4 other gates ran
started: first seen at 75b2fc5 (13-03 merged); 13-03's own gate on base 8efaa5c passed SERVER MODE

## Eliminated

## Evidence

- timestamp: 2026-11-27T15:00Z
  checked: scratchpad mt-1303-out/results.txt, sm1.txt, sm2.txt; exec-06-01/checks-out/.parts/server-mode-731c48c544/*.json (the merged tree mt-1303's part store)
  found: the failing run's lines are gone - runParts saves a failed part (ok:false) to .parts and the rerun sm1 overwrote tax-request-f3ac6a0f.json with ok:true at 14:34:01. sm1/sm2 KEPT the other 14 parts and re-ran only tax-request, so "two reruns PASS" means tax-request alone passed twice. In the failing run the stamps give tax-w8ben 14:27:59 -> include-tax 14:28:26 = 27 s for tax-request + include-tax together; on 7 other trees the same pair takes 13-14 s + 14-16 s = 27-30 s.
  implication: the failing tax-request ran its normal length (~12-13 s): it did not return early at server-mode.js:1609 and did not hit a 30 s wait timeout; the fail was a check line that evaluates and goes on (an assertion on a value read at a moment), not a hang.

## Resolution

root_cause:
fix:
verification:
files_changed: []
