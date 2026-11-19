---
phase: 09-filings-tab-form-d-and-blue-sky
plan: 03
subsystem: filings
tags: [filings-tab, reminders, silencing, self-serve-console, sandboxed-frame, phone]
status: complete

requires:
  - phase: 09-01
    provides: "assets/js/filings.js (NS.filings: facts, due, count, silence, recordFiled, recordState, orders), checks/gate9.sh"
  - phase: 06-onboarding-forms
    provides: "checks/lib.js (runParts, leak scan), no-network.js (the sandboxed frame), ways-out.js (the on-screen test)"
provides:
  - "assets/js/filings-ui.js: NS.views['console-filings'] (self-serve edition only), NS.filingsUI { part, PARTS, refresh, link }, the menu count and the overview's item"
  - "assets/css/filings.css: the fl- classes every Filings section uses"
  - "checks/lib9.js: framed, proveRefused, sample, seed, press, quiet, leak, wayOut for every phase 9 browser check"
  - "checks/filings-flow.js: FILINGS FLOW, 9 parts"
affects: [09-04, 09-06, 09-07, 09-09, 09-10]

actuals:
  tokens: 27518
  tasks: 3
  commits: 8
plan_head_before: f76e3f500ceb215ec728c8e3367250c4fa07ff5c
plan_head_after: a7f8469598cc896e98185f598e8bf4006e8552ed

tech-stack:
  added: []
  patterns:
    - "a Filings section is its own script from a fixed list beside filings-ui.js, loaded once on the tab's first render; one that does not load is skipped"
    - "a prefixed address applies only where its page is registered, so an edition without the page falls back to its default"

key-files:
  created:
    - assets/js/filings-ui.js
    - assets/css/filings.css
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/lib9.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/filings-flow.js
  modified:
    - assets/js/console.js
    - assets/js/app.js
    - assets/js/filings.js
    - diy.html
    - portal.html
    - server/help/guide.md
    - server/lib/help-guide.mjs

key-decisions:
  - "Several state reminders of one offering show as one row, State notices, that opens to the states; they can be recorded as filed one by one or together with one date (C6)"
  - "What the sponsor recorded as filed can be taken off the record (Remove), so a mistaken date never has to be lived with"
  - "filings.js gained stateName(code) so the tab writes a state's name from the one table, not a second copy"
  - "The filings-flow check has nine parts, not the plan's eight: C6 added filed-long-ago (twenty states)"

requirements-completed: [D-01, D-04]

duration: 2h34m wall clock (17:19 to 19:53 UTC), most of it waiting in the shared browser queue
completed: 2026-11-19
---

# Phase 9 Plan 03: The Filings tab Summary

The self-serve console's Filings tab: each Rule 506(b)/506(c) offering with what is due for its Form D and state notices, when and why; one-tap silencing per reminder or per offering; "I filed this myself"; confirmed first sale, end date, not filing; orders with the amount due. It also gives the parts registry that the later Filings plans plug into. Proven inside a sandboxed frame that refuses every connection, at 390x844 with touch and at 1280x800, on diy.html and on the published portal.html. The managed edition (index.html) is byte-for-byte unchanged.

**Not yet checked by the owner.** Nothing here is called done until he has opened it on his iPhone.

## Failures and open items first

1. **The full gate did not reach its last line.** `gate9.sh` was stopped by the background run's two-hour limit (the longest allowed) at 19:52 UTC. That was 19 minutes after its last step, the phase 9 checks, started; filings-flow.txt was still empty, so it was waiting for a slot in the shared browser queue. There is no `GATE_EXIT` line and the verify command did not finish. It was not restarted, because the limit was already the maximum. All of its reference steps had passed and are quoted below. The three phase 9 checks that step 3 runs were then measured on the same commit: filings-flow is the full nine-part run made at a7f8469 just before the gate; filings-math and formd-xml were run again after it. Each ends on the exact line its gate marker requires. To close this, the orchestrator runs `GATE_OUT=SCRATCH/exec-09-03 bash .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/gate9.sh` on the merged tree without the two-hour cap.
2. The gate's base tree, the screenshots and the owner folder were deleted by hand, because the gate's own cleanup never ran. The screenshots the owner's check refers to are therefore gone. The orchestrator's walkthrough or a fresh run of filings-flow.js remakes them.
3. Open (from 09-01, unchanged here): state renewals keep showing after an offering has ended. This gets settled with 09-07's state data.

## The gate (lines it printed before it was stopped, verbatim)

```
GATE ok   server tests # fail 0
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3)
GATE ok   AGREEMENT NAME
GATE ok   TAX REQUEST LEAVE (5)
GATE ok   WAYS OUT (7)
GATE ok   NO NETWORK (3)
GATE ok   EMBED DATA (3)
GATE ok   SAFARI FINISH (6)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 227
# pass 227
# fail 0
GATE ok   server tests 227 = base 227 + 0 declared
```

Step 3, measured separately at a7f8469:
```
FILINGS FLOW: PASS (parts run: 9)      (168 PASS, 0 FAIL)
FILINGS MATH: PASS (cases run: 10)
FORMD XML: PASS (cases run: 9)
```
`git diff --quiet f76e3f5 HEAD -- index.html` holds: index.html is unchanged since the base.

## What was measured

- Full check at HEAD a7f8469, before the gate: `FILINGS FLOW: PASS (parts run: 9)`, 168 PASS, 0 FAIL (tab-phone, tab-desktop, silence-phone, silence-desktop, own-phone, own-desktop, published, filed-long-ago, managed).
- Help guide test: 8 tests, 8 pass, 0 fail; the sponsor guide is 41,479 bytes (limit 48,000). FILINGS MATH: PASS (cases run: 10).
- RED runs (each on a clean copy of the test commit, kept in SCRATCH/exec-09-03):
  - red-1.txt (commit 373d47e): `FAIL tab-phone the console menu has Filings with the count 2 ... {"there":false,"label":"","count":""}`, `FILINGS FLOW: FAIL (parts run: 1) - tab-phone`.
  - red-2.txt (commit 715fdf8): 11 FAIL lines, e.g. `FAIL tab-desktop the overview's Needs attention has one item linking to the tab, with the count :: []`; `FILINGS FLOW: FAIL (parts run: 8) - tab-desktop, silence-phone, silence-desktop, own-phone, own-desktop, published, filed-long-ago`.
  - red-3.txt (commit bbaa63b): `FAIL tab-phone the one part file that loads shows its line under the offering ... {"shown":"","renders":0}`, `FAIL tab-desktop ran to the end :: ... Cannot set properties of undefined (setting 'link')`; `FILINGS FLOW: FAIL (parts run: 3) - tab-phone, tab-desktop`.
  - red-3-managed.txt: part managed is proven able to fail: with the app.js guard removed (`&& NS.views[key]`), both managed checks fail (`console-filings-formd-x` lands on route console-filings in index.html).
  - red-c7.txt and red-band.txt (on the snapshot before a7f8469): the no-exemption line was laid out as separate pieces, and a short Filings page on the phone had an empty band under the menu (`{"menu":342,"bar":354,"note":518}`); both pass after a7f8469.

## Tasks

| Task | What | Commits |
| ---- | ---- | ------- |
| 1 (tracer) | The Filings entry with its count, the page, the overdue first Form D and the New York notice, in the frame at 390x844 touch; the guide entry | 373d47e (RED), e17fbf5 |
| 2 | Silencing, what the sponsor filed, first sale, closing, not filing, orders with "$100 due" and the one-line server notice, the styles, the published page, twenty states as one row | 715fdf8 (RED), f64d8c0 |
| 3 | NS.filingsUI (parts, loader, section pages under a bar with Back, link), the app.js prefix and its guard, roles, the managed edition; the no-exemption line and the short page on the phone | bbaa63b (RED), 4a3e454, 4205c8e (RED), a7f8469 |

## Lines added to shared files (for the merge)

- `assets/js/console.js`: in NAV after `['console-kyc', 'AML/KYC'],`:
  `    ['console-filings', 'Filings'],`
  and after the NAV_SECTIONS array:
  `  NAV_SECTIONS.find((g) => g[0] === 'Report')[1].push('console-filings'); // Filings (filings-ui.js) closes the Report section; kept on its own line`
- `assets/js/app.js`: in PREFIXED after `['console-envelope-', 'console-envelope'],`:
  `    ['console-filings-', 'console-filings'],`
  and the prefix loop changed to apply only where the page is registered (C3):
  `    for (const [p, key] of PREFIXED) if (raw.indexOf(p) === 0 && NS.views[key]) return { key, param: raw.slice(p.length) };`
- `diy.html` and `portal.html` (same three lines in each): after `<link rel="stylesheet" href="assets/css/diy.css">`:
  `  <link rel="stylesheet" href="assets/css/filings.css">`
  and after `<script src="assets/js/coinvestor.js"></script>`:
  `  <script src="assets/js/filings.js"></script>`
  `  <script src="assets/js/filings-ui.js"></script>`
- `assets/js/filings.js`: after the API line, `API.stateName = (code) => ...` with its comment (two lines).
- `server/help/guide.md`: the `## console-filings` entry after `## console-kyc` (18 lines); `server/lib/help-guide.mjs` regenerated with `node server/help/build.mjs`.
- `index.html`: not edited.

## New shipped files a preview build must add

- `assets/js/filings.js` (merged with 09-01, first loaded by a page in this plan)
- `assets/js/filings-ui.js`
- `assets/css/filings.css`

## Deviations from Plan

1. **[Plan-check C6] Nine parts, not eight.** Part filed-long-ago proves an offering sold in twenty states: one row that opens to the states, one recorded alone and nineteen together, the Form D filed 410 days ago (annual amendment overdue), the amendment filed 40 days ago (nothing counted), and a mistaken state taken off the record. The check's gate marker and the verify's last grep ask for nine.
2. **[Rule 2] filings.js gained `stateName(code)`** (two lines) so the tab names a state from 09-01's own table.
3. **[Rule 2] "Remove" beside what the sponsor recorded as filed**, so a wrong date can be taken back (C6 asks that one action records it; nothing else would undo it).
4. **[Rule 1] a7f8469**: the no-exemption line (C7) is plain text, and the console menu keeps its height on a short Filings page at phone width.
5. The work was continued on Opus 5.5 in a fresh worktree after the first agent stopped on a usage limit; its eight commits carry the earlier trailer, later commits the new one.

## Known stubs

None. `NS.filingsUI.link` is null until plan 09-09 sets it; until then the tab shows its one-line notice, which is the intended behaviour.

## Threat flags

None beyond the plan's register: T-09-06 (order cancel only with can('configure'); investors cannot open the route; team member checked in tab-desktop), T-09-07 (every stored value through `h`; the seeded name `Harbor <b>Growth</b> Fund, L.P.` is shown as text), T-09-08 (PARTS is a frozen list resolved beside filings-ui.js; no name from data or the address).

## The owner's check (pending)

On the iPhone, in the published preview: open the console menu, tap Filings; read what is due for an offering with a first sale; tap Silence on one reminder, then Turn back on; record a notice filed yourself. Expected: no error, plain dates and reasons, the count beside Filings follows what is silenced, nothing asks for more than it needs, a way back always on screen.

## Self-Check: PASSED

The five created or changed files exist; the eight commits 373d47e, e17fbf5, 715fdf8, f64d8c0, bbaa63b, 4a3e454, 4205c8e and a7f8469 are on HEAD; index.html is unchanged since f76e3f5. The full gate's last line is still owed (see Failures, item 1).
