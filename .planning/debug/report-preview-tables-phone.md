---
status: investigating
trigger: "Report preview tables with 4+ columns squeeze text columns to 27-36 px at 390 px phone frame; words wrap one or two letters per line (143 broken words across five previews); Holdings and Net performance overflow the preview box (343-544 px in a 308 px box); Holdings header cut off at '% of net as'. Found by plan 12-09 walkthrough (walk12.js), 12-WALKTHROUGH.md Failures item 1."
created: 2026-11-27T00:00:00Z
updated: 2026-11-27T00:00:00Z
---

## Current Focus

hypothesis: (forming) `.rb-doc { overflow-wrap: anywhere }` (assets/css/reports.css:41) is inherited by every preview table cell; `anywhere` (unlike `break-word`) adds soft-wrap opportunities to the min-content size, so the auto table layout can shrink text columns to one glyph while `.num` cells keep `white-space: nowrap` full width.
test: read walk12 assertions; measure min-content of text cells in a check browser with/without overflow-wrap: anywhere on the table
expecting: with `overflow-wrap: normal` on .rb-tbl cells the text columns keep word width
next_action: read walk12.js broken-word / table-width assertions, measure base counts (server tests, walk12 RED)

## Symptoms

expected: At 390 px phone frame, every preview table readable: every word whole on one line, numbers right-aligned and never cut; 3-col tables already fine.
actual: 4+ column preview tables squeeze text columns to 27-36 px; 'Investment' wraps over 8 lines; 143 broken words in five previews (Kestrel Bay Holdings+Net performance 60, Ashwell Ridge Distributions/Totals/Net performance 22, Pellbrook Holdings 40, fund A statement Distributions/Totals 9, fund A summary Net performance/Holdings 12); Holdings and Net performance 343-544 px wide in a 308 px box; Holdings header cut at '% of net as'.
errors: `WALK12: FAIL (steps run: 28) - kb-open, kb-preview, ar-letter, ar-preview-pdf, pb-letter, fa-statement, fa-holdings` (kb-open, ar-letter, pb-letter also/only fail on W5 font host requests, a separate queued fault)
reproduction: `node .planning/phases/12-report-builder/checks/walk12.js` (117 s, phone frame)
started: since phase 12 report preview (plan 12-06); caught first by 12-09 walk (commit cf89610 added the assertion)

## Eliminated

## Evidence

- timestamp: 2026-11-27T00:00:00Z
  checked: assets/css/reports.css (preview styles) and assets/js/reports-ui.js:915-919 tableHTML
  found: table markup is `<div class="tbl-scroll rb-tblwrap"><table class="rb-tbl">` with `.num` cells (`white-space: nowrap; text-align: right`). `.rb-doc` (reports.css:41) sets `overflow-wrap: anywhere`, inherited by th/td. `.rb-tbl { width: 100% }`, no min-width or white-space on text cells. `.tbl-scroll` (console.css:296, portal.css:198) is `overflow-x: auto`.
  implication: candidate cause in code (CSS): `overflow-wrap: anywhere` collapses text-cell min-content to one glyph; auto table layout then gives the slack to nowrap number columns.

## Resolution

root_cause:
fix:
verification:
files_changed: []
