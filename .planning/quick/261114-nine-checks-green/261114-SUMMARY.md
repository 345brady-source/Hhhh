---
quick: "261114-nine-checks-green"
phase: "01.3"
plan: "261114-nine-checks-green"
subsystem: checks
tags: [checks, co-investor, signatures, wave-0]
requires: []
provides: [nine check files green on the unchanged reader]
affects: [01.2, 01.3]
key-files:
  modified:
    - .planning/phases/01-accurate-field-placement/checks/fixtures.js
    - .planning/phases/01-accurate-field-placement/checks/labels.js
    - .planning/phases/03-signatures/checks/signatures.js
decisions:
  - "A second investor's printed place (joint subscriber, co-investor) is expected to be the co-investor's own field: required, not marked. Witness and notary lines keep the optional, marked expectation."
  - "The SIG-01 letter-coverage check waits until the browser has no face loading before judging; its assertion is unchanged."
metrics:
  completed: "2026-11-14"
  duration: "about 35 minutes"
status: complete
actuals:
  tokens: 1100
  tasks: 4
  commits: 3
plan_head_before: f063542d70f3117773ce6d3292399d63c4dfec72
---

# Quick 261114: the nine check files are green again before any reader change

Three red check files traced to two causes: four out-of-date co-investor expectations, and a fixed 500 ms wait in the signature check that loses to a cold font cache. Expectations were corrected only where the owner's co-investor decision made them wrong. The check timing now waits for the faces to arrive. No reader file and no portal file changed. Nothing was deleted, skipped or loosened.

## Gate (verbatim, run from the worktree)

`NODE_PATH=$(npm root -g) node measure.js --root <worktree> --run proof7,proof1,proof5,leak`

```
PASS proof7 (152 s): 9 passed, 0 failed
PASS proof1 (9 s): 7 passed, 0 failed
PASS proof5 (87 s): 15 passed, 0 failed
PASS leak (2 s): 201 files and 18 commit messages searched: no name of the list, no run of eight words outside the allowed list
MEASURE: PASS
```

proof1 and proof5 hold the pins (first agreement 47 fields, 0 marked; public documents unchanged), so the pins did not move.

## Cause of each failure (proven before any change)

### accuracy.js: grid, heldout3, heldout4 (was 203/209, 4 mistakes, 3 of 18 layouts failing)
Failing lines, verbatim:
- `grid: confident mistake: the signature field at high confidence on p1 signature/investor at x 269-540  line y 226 is wrong: required, not optional`, plus `0 field(s) marked for review, not 1` and `saved for onboarding although something should hold it`. These three follow from the same place.
- `heldout3: ... p2 signature/investor at x 72-302  line y 235 is wrong: required, not optional` (the joint subscriber's line).
- `heldout4: ... p1 signature/investor at x 373-506 ... wrong: required, not optional` and `... p1 name/investor at x 379-507 ... wrong: required, not optional` (the CO-INVESTOR block).

For each of these, the field the reader placed is the right type, on the right line, kept apart as a second signer's, and labelled `Co-investor ...`. The only differences are required vs optional and the missing review mark. That is exactly the behaviour commit 3bf7f1f introduced on purpose. Nothing was missing, nothing landed in the wrong box, no type was wrong and there were no strays. The notary line in heldout3 also uses `second` and was not failing, so it keeps its optional, marked expectation.

**Change:** I added a `coInv` helper beside `second`: `{ second: true, required: true }`, with no `flag`. It is used for the four places, and each one carries a one-line comment saying a second investor's place is the co-investor's own. The grid fixture changes from `saves: false, marks: 1, todo` to `saves: true, clean: true`, because its one mark was that line. The expectation keeps role `investor` because `harness.js` reports every signer that is not the firm as `investor`, and this plan may not edit `harness.js`. The co-investor role itself (`co`) is asserted in labels.js.

**After:** `NOW: 207 of 209 printed places have the right field on them; 0 mistakes ...; 0 of 18 layouts fail.` / `PASSED`. The 2 places still not right are heldout4's two firm places, which were recorded as allowed (`measured: 2`).

### labels.js: 189/190
Failing line, verbatim: `FAIL the joint subscriber’s row gets a second signer’s field: optional and marked low :: signature/investor/high@271,120 signature/investor/medium@271,150 signature/co/high/second@271,180`. The reader gives the row a co-investor signature (`co`, high confidence, second). That is the same out-of-date expectation.

**Change:** the expectation is now role `co`, type signature, kept apart, high confidence, required. This is stricter than before, since it now pins the role and the type. **After:** `190/190 passed`.

### signatures.js: 69/70 (SIG-01)
Failing line, verbatim: `FAIL SIG-01 a style whose face lacks a letter of the name is set aside, and the chosen style can always write it :: [... flowing whole:false off:false ..., quick whole:false off:false ..., bold whole:false off:false checked:true ...]`.

**Measurement:**
- The faces really do lack letters for the test name. The cached stylesheets show that the latin-ext parts of the Flowing and Bold faces are about 2 KB stubs and the Quick face has no latin-ext part at all. So the check's "whole" verdict is correct.
- On a cold font cache (a fresh output folder, which is also what every proof run uses) the run failed 69/70. Rerunning the same code with the cache warm passed 70/70.
- **Cause:** the check judged the styles a fixed 500 ms after typing the name. On a cold cache, the check's own route handler downloads each new font part with a blocking `curl` (`execFileSync`), so the portal had not yet received the parts. The portal deliberately does not judge a face before its parts arrive (`covers()` in signature.js: "A face that never arrived is not judged"), and it sets the style aside once they do. The fault was in the check, not the portal.

**Change:** after typing, the check now waits until `document.fonts.status === 'loaded'` and `document.fonts.ready` (30 s limit; a timeout fails the run loudly). It then keeps the original 500 ms and asserts exactly what it asserted before. **After:** `PASS SIG-01 a style whose face lacks a letter of the name is set aside, ...` and `70/70 passed` on a fresh, empty cache, the condition that failed before.

## Deviations from Plan

- **assets/js/signature.js was not changed** (it is listed in `files_modified`). The diagnosis showed the check was at fault, so the plan's rule said to change the check instead.
- **The plan's wording asks for role `co` in the fixtures expectation.** That is not possible in accuracy.js without editing `harness.js`, which is forbidden, so fixtures.js keeps `investor` and labels.js asserts `co` (see above).
- To run signatures.js alone I served the worktree on a private local port (`python3 -m http.server`, `SIGN_PORT`), as the check's own header describes. The server was stopped afterwards.

## For the orchestrator and the owner

- **Reader observation (no change made; Phase 01.3 territory):** on heldout4, the co-investor's "Print name" field is labelled `Co-investor field`, not `Co-investor name`. The field type `name` is right, and the fixture does not compare labels there, so no check fails. The label comes from `coInvestor()` in placement.js, which works out the name from the label text it was given. Worth a look when the text reading is changed.
- No check was deleted, skipped or loosened. No reader file (`anchors.js`, `placement.js`, `esign.js`, `textread.js`, `picturepage.js`) changed. Only these three check files changed.

## Commits

- b534daf: fix(261114): a second investor's place is the co-investor's own field in the checks
- 820181c: fix(261114): the SIG-01 letter check waits for the faces, not a fixed time
- (this SUMMARY): docs(261114)

## Self-Check: PASSED
- Files modified exist and are committed: fixtures.js, labels.js, signatures.js (b534daf, 820181c ancestors of HEAD).
- Gate run from the worktree: MEASURE: PASS.
