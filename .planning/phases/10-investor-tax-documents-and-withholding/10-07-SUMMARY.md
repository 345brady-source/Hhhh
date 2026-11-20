---
phase: 10-investor-tax-documents-and-withholding
plan: 07
subsystem: distribution screen (tax withheld), offering page, investor tax record, History, investor Distributions headline
tags: [withholding, backup-withholding, foreign, distributions, cancel, tax]
status: complete
requires: ["10-01 (buildLines, recordRun, cancelRun, runRows)", "10-04 (NS.taxUI PARTS loader)", "10-05 (NS.withholding)"]
provides:
  - "NS.withholdingUI (assets/js/withholding-ui.js): block, withheld, blocked, reset, reportingField, paperLine"
  - "console.js: the tax withheld block, net column, net ACH entries, withheld lines into the record, Cancel in History (both editions)"
  - "checks/withholding-flow.js: WITHHOLDING FLOW, 9 parts"
affects: [10-08, 10-10, 10-11, phase 11]
tech-stack:
  added: []
  patterns: ["the screen draws the module's drafts and records decisions; it works out no amount", "one set of lines for table, file and record"]
key-files:
  created:
    - assets/js/withholding-ui.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/withholding-flow.js
  modified:
    - assets/js/console.js
    - assets/js/data.js
    - server/help/guide.md
    - server/lib/help-guide.mjs
decisions:
  - "Sample W-9s get a signature record { signed: true, source: 'sample' } (C-10). Not 'paper', so the sample's 90 investor rows do not each gain a line and an Undo"
  - "A foreign investor's row offers the 30% amount whatever the W-8's state, and shows the W-8 facts (valid until, expired after, not signed)"
  - "Cancel is offered to the role that may configure, in both editions (the self-serve admin; Carrow & Vale staff)"
  - "The investor's headline line 'Tax withheld $X' is drawn by withholding-ui.js, because portal.js belongs to 10-06 in this wave"
  - "'W-9 signed on paper' is not offered for an IRA or a payee marked exempt (backup withholding is never proposed for them)"
metrics:
  completed: 2026-11-20
  tasks: 3
estimate:
  tokens: 104000
  tasks: 3
actuals:
  tokens: 20700     # chars/4 over the added lines since the merged base, help-guide.mjs (generated) left out
  tasks: 3
  commits: 9        # git rev-list --count --first-parent 6061fce..a55ef3b (6 plan commits, 1 merge, 2 summary saves); this summary is the 10th
plan_head_before: 6061fce0b5d43bced41eb84c3c7c6375d1d97f27
plan_head_after: a55ef3b8f5baf57789ca2b6bef11e022a9af49b3
---

# Phase 10 Plan 07: tax withheld at the distribution Summary

When a distribution is drafted for a fund set to notes or to corporation or REIT, the screen now lists each backup withholding line the rules propose (24%). A foreign investor gets 30% of an amount the sponsor enters, or the rate the CPA gave. The four kinds only a CPA can work out are entered with a reason, each under its stop sentence. Nothing is withheld until a person confirms the line, and the ACH file and the record wait until every line is decided. The file pays the net. The record stores gross, each withheld line with who and when, and net. The investor sees the amount, the tax withheld and the amount paid. The offering page has Tax reporting (admins), the investor's tax record has "W-9 signed on paper" (D2), and History has Cancel. **The owner has not checked any of it.**

## Failures first

- **The first gate run failed:** it ended `GATE_EXIT=1` on one line, `GATE FAIL FORMS FLOW (34)`, case upload-ira. An IRA custodian's uploaded W-9 row gained "W-9 signed on paper", and that case requires no "W-9 signed" text in the row. The fix (73c6821): no paper action for an IRA or an exempt payee, since backup withholding is never proposed for either. After it, `FORMS FLOW: PASS (cases run: 2)` (upload, upload-ira) and `WITHHOLDING FLOW: PASS (parts run: 1)` (paper-w9, now asserting an IRA gets no action). The second full gate passed (below). The first run's output is kept in SCRATCH/exec-10-07/gate-1.txt.
- **Part propose-desktop did not fail first.** Remove, the reset when the total changes and A-1001's second line were all in the tracer's code before the part existed.
- **red-3's second FAIL line is not meaningful.** Part managed was run on an extracted tree of 888eeac (before Cancel). Its git line failed there only because that folder is not a repository.
- **One recorded-distribution bug from 10-01, fixed here:** at recording, the stale-file test compared the ACH file with gross amounts (`buildLines` was called without the withheld lines). Every file built with tax withheld would have been refused.
- **Not confirmed (owner or CPA):** research assumption A6 (no minimum payment before backup withholding). The eight stop sentences have not been read by a CPA. A foreign investor whose W-8 has expired is proposed a backup line (10-05's rule), and the screen still offers the 30% amount. Not measured on an iPhone, only in the headless browser at 390x844 with touch.

## Gate (second run, base 36bc42a = claude/refract-reskin merged in; last lines verbatim)

```
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 368
# pass 368
# fail 0
GATE ok   server tests 368 = base 368 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX 1099
GATE ok   TAX FORMS
GATE ok   TAX MATH
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   WITHHOLDING FLOW
GATE_EXIT=0
```

Every reference line above these reads ok as well, including FORMS FLOW (34), PHONE LAYOUT (8) and WAYS OUT (7). The gate's own run of this check ended `WITHHOLDING FLOW: PASS (parts run: 9)` (157 PASS lines). Task 3's verify conditions, read from this run: `VERIFY3_EXIT=0`. index.html, diy.html, portal.html and assets/css/tax.css are unchanged since both the starting base (6061fce) and the merged base (36bc42a), and no commit of this plan touches them. `node server/help/build.mjs --verify`: in sync.

## RED outputs (kept in SCRATCH/exec-10-07)

- red-1.txt (Task 1, part propose-phone, before any code): 10 FAIL lines and `WITHHOLDING FLOW: FAIL (parts run: 1) - propose-phone`. There was no block, the buttons did not wait, the file's credits were $10,000.00, and A-1002 was stored with nothing withheld.
- red-2.txt (Task 2's parts on the tracer's code): 24 FAIL lines and `WITHHOLDING FLOW: FAIL (parts run: 7) - type, foreign, stops, netfile, cancel, paper-w9`.
- red-3.txt (part managed on 888eeac): `FAIL managed History has Cancel for Carrow & Vale staff`.
- gate-1.txt: the FORMS FLOW failure above, which was the RED for 73c6821.

## Verify lines

- Task 1: `WITHHOLDING FLOW: PASS (parts run: 1)`, `VERIFY1_EXIT=0`
- Task 2's seven parts plus paper-w9 on the Task 2 code: `WITHHOLDING FLOW: PASS (parts run: 8)` (141 PASS lines). All nine parts ran again in the gate.
- The help guide's tests: `# pass 9`, `# fail 0`
- **MEASURED (D2):** each sample firm with every offering set to notes. Still drawing a backup line: kestrel-bay 2 of 23, ashwell-ridge 2 of 24, greywater 1 of 23, pellbrook 2 of 24. Every one of them has no tax form, and none has a W-9 with its last four. 10-05 measured 86 of 94 before this change.

## Example B on screen, to the cent (both sizes, sandboxed frame, connections refused)

- A-1002 is proposed 24%, $800.00, with the item-2 reason. Confirmed, the table shows $3,333.33, $800.00 and $2,533.33. The file pays A-1002 253,333 cents, $9,200.00 in all.
- A-1003 with $1,666.67 entered is proposed $500.00 at 30%. A rate of 10 gives $166.67, marked as the CPA's rate. $2,000.00 is refused in one line.
- With both lines confirmed, the file pays 500,000, 253,333 and 116,667 cents, $8,700.00 in all. The record holds [500,000/0/500,000], [333,333/80,000/253,333], [166,667/50,000/116,667]. After A-1003's position is edited, "ACH file" on that run builds the same three entries.
- A-1002's page shows $3,333.33, "Tax withheld $800.00" and "Amount paid $2,533.33". The headline "Total received" stays $3,333.33, with one line under it, "Tax withheld $800.00".

## Commits

| Commit | What |
|---|---|
| 135655c | test: part propose-phone (RED) |
| 888eeac | feat: tax withheld block, net column, net file, withheld into the record; stale-file fix (tracer) |
| 9bc0b46 | test: type, propose-desktop, foreign, stops, netfile, cancel, paper-w9 (RED) |
| fc4d67a | feat: Tax reporting, foreign and entered lines, Cancel, W-9 signed on paper, sample signature records, headline line, guide |
| 6145fe6 | test: part managed; marker 9 parts |
| 73c4dad | merge of claude/refract-reskin (36bc42a) before the gate |
| ad1ae6d, a55ef3b | summary saves |
| 73c6821 | fix: no paper action for an IRA or an exempt payee |

## Deviations from Plan

1. **[D10] Seven existing lines of console.js were changed, not only added to.** Six take a short added expression: `canFile`, `why`, the Record button's `disabled`, the History cell (Cancel), `taxLine` (the paper line) and the stale-file `buildLines` call (Rule 1 fix). Each was a `const` or a single template line that an added line could not reach. No on-screen text was reworded. Everything else is added lines, plus one named block, "Tax withheld at a distribution (plan 10-07)", which also wraps `NS.binders.dist` and `nacha-build`.
2. **[D2] assets/js/data.js (10-06's file in this wave):** three added lines in `makeInvestor`/`genRoster` only, far from the investorDocs lines 10-06 edits. D2 puts the sample data in this plan.
3. **[D3] The headline line is drawn from withholding-ui.js** (it chains the portal view's `after`), so portal.js, which 10-06 owns, was not edited.
4. **WITHHOLDING FLOW has 9 parts** (D2 adds paper-w9). The marker reads 9.
5. **The gate's base is 36bc42a,** the merged claude/refract-reskin, so that server test counts compare like with like. The starting base 6061fce is kept in base-commit-start.txt.
6. **The paper-w9 part reads quiet before it switches firms.** Each sample firm loads its own typefaces from the font host, as 10-03 noted. Script errors are still checked after the switch.

Not touched: STATE.md, ROADMAP.md, REQUIREMENTS.md, index.html, diy.html, portal.html, tax.css, the other wave 3 plans' files except D2's data.js lines.

## Files a preview build must publish

- `assets/js/withholding-ui.js` (new)
- `assets/js/withholding.js` (10-05; it loads only now, through NS.taxUI PARTS)

## Known Stubs

None.

## Threat model

- T-10-20: the file and the record wait while `blocked` gives a reason, the actions refuse too, and a change of amount drops decisions. Proven in propose-phone and propose-desktop.
- T-10-21: lines are stored once with who and when; Cancel takes a reason and is logged. Proven in netfile and cancel.
- T-10-22: Tax reporting, Cancel and the paper action are admin-only. A team member sees none of them (type, cancel). Sponsor staff in the managed edition have no Cancel (managed).

## Owner's check (pending)

On the iPhone, in the published preview:
1. On an offering's page, set Tax reporting to Notes.
2. On Distributions, draft a payment for that fund.
3. Read the proposed line, confirm it, generate the file and record.
4. Open the portal as that investor and read the payment.
5. Cancel a distribution in History.

## Self-Check: PASSED

- FOUND: assets/js/withholding-ui.js, checks/withholding-flow.js
- Commits 135655c, 888eeac, 9bc0b46, fc4d67a, 6145fe6, 73c4dad, 73c6821 are ancestors of HEAD.
