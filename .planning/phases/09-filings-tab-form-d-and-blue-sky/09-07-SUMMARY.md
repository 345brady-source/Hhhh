---
phase: 09-filings-tab-form-d-and-blue-sky
plan: 07
subsystem: filings
tags: [blue-sky, state-notices, fees, package, renewals, reminders, sandboxed-frame, phone]
status: complete

requires:
  - phase: 09-01
    provides: "assets/js/filings.js (facts with one list of sales, recordState, orderLines, addOrder, due, silence)"
  - phase: 09-02
    provides: "server/test/fixtures/formd/schema/statesOfSolicitationCodes.xsd.xml (the 52 codes)"
  - phase: 09-03
    provides: "assets/js/filings-ui.js (NS.filingsUI.part, the section page, the State notices row), checks/lib9.js"
provides:
  - "assets/js/bluesky-data.js: NS.blueskyData, the 52 jurisdictions, every row unconfirmed"
  - "assets/js/bluesky.js: NS.bluesky (problems, pick, fees, pack, placeOrder, recordResult, difference, latestNotice) and the Filings tab's part states, titled State filings"
  - "checks/bluesky-math.js: BLUESKY MATH, 6 cases; checks/bluesky-flow.js: BLUESKY FLOW, 4 parts"
affects: [09-09, 09-10]

actuals:
  tokens: 22260
  tasks: 3
  commits: 7
plan_head_before: 7b560dfed68ce36cfb8aacbfe5f9d95302d744a5
plan_head_after: c5112a9dba1874983b9ab86c848dd9dca6333998

tech-stack:
  added: []
  patterns:
    - "a fee is an amount only when its row is confirmed with a source and the date it was read; otherwise the line carries null and the screen says To be confirmed"
    - "an order keeps the quote per state (quotedCents) apart from its pass-through lines, which take the fee paid when the result is recorded"

key-files:
  created:
    - assets/js/bluesky-data.js
    - assets/js/bluesky.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/bluesky-math.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/bluesky-flow.js
  modified:
    - assets/js/filings.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/filings-math.js

key-decisions:
  - "Ticked states are not stored until they are ordered: a reload shows the states with sales ticked again (W-3)"
  - "A renewal order is the $50 service fee plus that state's line; the filing system's line is added to a renewal only where a confirmed table says the fee applies to renewals"
  - "With no team list on record (the sample portal until Team is opened) the package names the firm's support contact"
  - "Only the 52 jurisdictions of the Form D list can be ticked or ordered (the server refuses any other code)"

requirements-completed: [D-03, D-04, D-05]
duration: "22:41 UTC to 00:14 UTC on 2026-11-20 (gate included), most of it waiting in the shared browser queue"
completed: 2026-11-19
---

# Phase 9 Plan 07: State notice filings Summary

The Filings tab's State filings section: the states where an offering's investors live (09-01's one list of sales) come ticked with the first sale date in each; the sponsor adds or removes states and the admin orders at $100 for any number of states. Every state fee and the filing system's fee shows "To be confirmed", and the order records them as lines with no amount, because no row of the state table has been read from the official fee matrix yet. The package staff file from by hand is on the page. Each state's result (date, filing ID, fee paid, renewal date) is recorded on the section, quoted and paid fees are shown side by side, and a renewal can be ordered at $50 or silenced from the tab's reminder. Proven inside the sandboxed frame that refuses every connection, at 390x844 with touch and at 1280x800. The managed edition does not load these files.

**Not yet checked by the owner.** Nothing here is called done until he has opened it on his iPhone.

## Failures and open items first

No check fails on this tree: the full gate ended `GATE_EXIT=0` on c5112a9 (below), within the two-hour limit. What follows is what is not proven or not perfect.

1. **No state fee or deadline is in the table.** All 52 rows ship unconfirmed (fee, days and renewal null, no source, no date read), and so does the filing system's fee. Sponsors see "To be confirmed" for every state fee, no due date on a state notice reminder, and "State fees and the filing system's fee are confirmed when the order is reviewed." Plan 09-10 fills the rows once the owner supplies the official matrix; fees() and the reminders then use them with no code change. The fee arithmetic (fixed, tiered on the amount offered or sold in the state, percent with minimum and maximum) is proven only on test rows with invented sources.
2. **Partial RED, said plainly.** In Task 2's RED run, case `package` failed on one check only (the contact): pack() had to exist for the tracer. In Task 3's RED run, `selfcheck`'s two runner checks already passed (the runner is shared); its marker check failed. Part `order-desktop`'s team-member check was written after the order control was already limited to the admin.
3. **Two check mistakes found and fixed while running** (the code was right): the amount pattern took the comma after "$100" as part of the amount; the results case forgot that Texas, not ordered, keeps its own first notice. One code fault was found by a RED part and fixed: on the sample portal (no team list until Team is opened) the package's contact had no name (commit 6e4ed9d).
4. **Not proven against the real states' filing system**: whether the package holds everything a filer types there. That is the owner's check below.

## Verify and gate lines (verbatim)

Task 1 verify (verify-1.sh):
```
BLUESKY MATH: PASS (cases run: 2)
BLUESKY FLOW: PASS (parts run: 1)
VERIFY1_OK
```
Task 2 verify (run-2b.sh, after the contact fix):
```
BLUESKY MATH: PASS (cases run: 4)
BLUESKY FLOW: PASS (parts run: 2)
VERIFY2_OK
```
Each check alone and in full before the gate (W-2), at c5112a9:
```
BLUESKY MATH: PASS (cases run: 6)      (64 PASS, 0 FAIL)
FILINGS MATH: PASS (cases run: 10)
BLUESKY FLOW: PASS (parts run: 4)      (100 PASS, 0 FAIL)
FILINGS FLOW: PASS (parts run: 9)      (168 PASS, 0 FAIL)
```
Task 3 verify, the full gate (`GATE_OUT=SCRATCH/exec-09-07 bash checks/gate9.sh`):
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
GATE ok   BANK STEP TYPING (2)
GATE ok   HELP CHAT (10)
GATE ok   REAL FIRM (9)
GATE ok   SIGNING DOCUMENTS (8)
GATE ok   PHONE LAYOUT (8)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 345
# pass 345
# fail 0
GATE ok   server tests 345 = base 345 + 0 declared
GATE ok   BLUESKY FLOW
GATE ok   BLUESKY MATH
GATE ok   FILINGS FLOW
GATE ok   FILINGS MATH
GATE ok   FORMD XML
GATE_EXIT=0
VERIFY3_OK
```

RED runs, kept in SCRATCH/exec-09-07:
- red-1.txt: `FAIL table ran to the end :: Error: ENOENT ... assets/js/bluesky-data.js`, `BLUESKY MATH: FAIL (cases run: 2) - table, pick`; `FAIL order-phone the tab shows the offering's State filings line, with the states that have sales`, `BLUESKY FLOW: FAIL (parts run: 1) - order-phone`.
- red-2.txt: 9 FAIL lines in `fees` (e.g. `FAIL fees a fixed fee gives its cents (New York $300)`), `FAIL package the admin's contact`, `BLUESKY MATH: FAIL (cases run: 2) - fees, package`; `FAIL order-desktop one line says an investor has no state on file and is not ticked, with the way to the investor list :: null`, `FAIL order-desktop with no Form D on record the section asks for the date and accession number ...`, `BLUESKY FLOW: FAIL (parts run: 1) - order-desktop`.
- red-3.txt: `FAIL results ran to the end :: TypeError: B.placeOrder is not a function`, `FAIL selfcheck the flow check's markers say a browser check of four parts`, `BLUESKY MATH: FAIL (cases run: 2) - results, selfcheck`; `FAIL states an offering ended before today, or today, has no renewal reminder ...`, `FILINGS MATH: FAIL (cases run: 1) - states`; `FAIL results-phone ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.` (no Record result control), the same for results-desktop, `BLUESKY FLOW: FAIL (parts run: 2) - results-phone, results-desktop`.

## What was built

- **assets/js/bluesky-data.js** (new shipped file): the 52 jurisdictions of the Form D list (50 states, DC, Puerto Rico), names matching filings.js's table, every row `confirmed: false` with no fee, days, renewal, source or date; the header says a row is filled only from the official matrix with its source and date read. A script, never fetched.
- **assets/js/bluesky.js** (new shipped file):
  - `problems(data)`: the rule both checks enforce (a confirmed row has a source, a real date read and a valid fee or `noticeRequired: false`; an unconfirmed row holds no fee, deadline or renewal; the system fee likewise).
  - `pick(facts)` is exactly `Object.keys(facts.byState).sort()` (F4 (1)): an approved, unfunded subscription in Texas ticks TX; an investor abroad or with no state on file adds none.
  - `fees(data, states, facts, { renewal })`: one line per state needing a notice and one for the filing system's fee; an amount only from a confirmed row with source and date (T-09-21); `none` lists states a confirmed row says need no notice; `open` while any line has no amount.
  - `pack(ws, offering, states)`: issuer name and CIK, the latest filed notice's accession number and date, the amount offered, each state's first sale, amount sold and investors, the contact; no investor name or address (T-09-22).
  - `placeOrder` (F9): `addOrder({ kind: 'bluesky' | 'bluesky-renewal' })` with every pass-through line at null; the quote kept as `quotedCents` per state on the record and in the package; each state recorded as ordered (or renewal-ordered).
  - `recordResult`: the state filed with its date, filing ID, fee paid and renewal date; the fee paid becomes that state's line of the order it belongs to (the latest still open whose line has no amount), the filing system's fee when given; the order is done once every state is filed and every fee known (as the server does). `difference()` reports fee paid less fee quoted.
  - The section (part `states`, title "State filings", registered only when `NS.filingsUI` exists): the line under the offering ("2 states with sales · 1 ordered · 1 filed"); on the page, one line for investors with no state on file linking to the investor list (F4 (2)); the Form D the notices are filed from, or a form for the date and accession number of the notice the sponsor filed (stored through `recordFiled`); the picker with "Add a state"; the fee lines with "To be confirmed"; Order (admin only); the states ordered and filed with Record result (team and admin) and Order renewal (admin); the orders with their package.
- **assets/js/filings.js** (F4 (3)): in `due()`, no state-renewal once `rec.ended` is set and not after today; the header says so. 11 lines added, 9 removed (the renewal loop re-indented under `if (!ended)`, one comment line, two header lines).
- **checks/filings-math.js**: one check added inside the existing `states` case (FILINGS MATH's count and marker unchanged), seen failing first.

## Task commits

| Task | What | Commits |
| ---- | ---- | ------- |
| 1 (tracer) | Picker from sales, Texas by hand, $100 with fees to be confirmed, order, package, in the frame at 390x844 touch | a2bdec7 (RED), 8af9d5f |
| 2 | Fee amounts only from confirmed rows, the sponsor's own Form D, the unplaced line, contact, the desktop and a team member | 9ebbcf4 (RED), a982943, 6e4ed9d (fix) |
| 3 | Results, renewals and their reminders, F4 (3), the gate | 4364ead (RED), c5112a9 |

## New shipped files a preview build must add

- `assets/js/bluesky-data.js`
- `assets/js/bluesky.js`

Neither is in any page's script list: filings-ui.js loads both from its fixed part list on the tab's first render. No shared file was edited (no change to filings-ui.js, filings.css, the pages, or server/help/guide.md, W-1).

## Deviations from Plan

1. **[F9 and the server's shape] Pure `placeOrder` and `recordResult`** in bluesky.js (not named in the interfaces block), so the math check proves the order and the results without a browser; the section's buttons call them.
2. **[Rule 1] The firm's support contact** when no team list is on record (commit 6e4ed9d), found by part order-desktop on the sample portal.
3. **Renewal fee shape**: `renewal: { months, fee? }` (the plan has `{ months }`), so 09-10 can give a renewal fee where the matrix lists one; with none the renewal line has no amount.
4. **The filing system's fee on renewals**: left off a renewal order unless a confirmed `systemFee.appliesTo` is `all` (the plan's results case: "the $50 service fee plus that state's pass-through line"). The server (09-05) adds a filing system line to renewal orders too; staff can leave it unpaid. To settle with 09-10 when the system fee is read.
5. **Ticks are kept on the page, not stored** (W-3 allows either): a reload shows the states with sales ticked again; what was added by hand comes back only once ordered.
6. **Only the 52 Form D jurisdictions are offered.** facts() also places investors in the Virgin Islands, Guam, American Samoa and the Northern Mariana Islands; `pick` returns them (F4 (1) asks for exactly byState), but the section lists and orders only the 52, because the server refuses other codes. Such an investor would get a state reminder on the tab and no line in the picker.
7. **Labels**: state lines read "State filing fee, <state name>" and "Filing system fee" (the server writes the code, not the name; it rebuilds the lines anyway).
8. Orchestrator's instructions over the executor defaults: STATE.md, ROADMAP.md and REQUIREMENTS.md untouched; nothing written to the cross-phase ledger; pushed to `wip/09-07` only.

## Known stubs

None that blocks the plan's goal. The empty fee table is intentional and owned by plan 09-10 (the official matrix, waiting on the owner).

## Threat flags

None beyond the register: T-09-21 (amounts only from a confirmed row; case table fails on a confirmed row without source or date and on an unconfirmed row holding an amount; order-phone asserts no amount but $100 on screen), T-09-22 (case package asserts no investor name or address). New stored writes go through filings.js's writers; every typed value is shown through `h` (an accession number and a filing ID with angle brackets are shown as text).

## The owner's check (pending)

On the iPhone, in the published preview: Filings, then State filings for an offering with investors in two states; add a state, order, read the package; record one state's result with a renewal date and look at the reminder on the tab. Expected: the right states are ticked; the order shows $100 due and says state fees are confirmed when the order is reviewed, with no state amount anywhere; the package has what you would need to file by hand; the renewal reminder shows its date. The same screens are in SCRATCH/exec-09-07/shots with an index.txt (W-7).

## Self-Check: PASSED

- FOUND: assets/js/bluesky-data.js, assets/js/bluesky.js, checks/bluesky-math.js, checks/bluesky-flow.js
- FOUND on HEAD: a2bdec7, 8af9d5f, 9ebbcf4, a982943, 6e4ed9d, 4364ead, c5112a9 (7 commits from 7b560df to c5112a9; this summary's commit follows)
- `git diff --quiet 7b560df HEAD -- index.html assets/js/filings-ui.js server/help/guide.md assets/css/filings.css diy.html portal.html` holds: none of the shared files was edited
- The owner's screens: a separate full run after the gate, `BLUESKY FLOW: PASS (parts run: 4)`, 8 screenshots and index.txt in SCRATCH/exec-09-07/shots (kept for the walkthrough). The gate's base tree, shots, checks-out and owner PDFs were removed; server/node_modules link removed.
