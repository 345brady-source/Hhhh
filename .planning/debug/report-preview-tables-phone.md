---
status: verifying
trigger: "Report preview tables with 4+ columns squeeze text columns to 27-36 px at 390 px phone frame; words wrap one or two letters per line (143 broken words across five previews); Holdings and Net performance overflow the preview box (343-544 px in a 308 px box); Holdings header cut off at '% of net as'. Found by plan 12-09 walkthrough (walk12.js), 12-WALKTHROUGH.md Failures item 1."
created: 2026-11-27T00:00:00Z
updated: 2026-11-27T00:00:00Z
---

## Current Focus

bug_class: Bohrbug (deterministic: same counts every run, base probe reproduced the walk's 60/22/40 exactly)
hypothesis: CONFIRMED - `.rb-doc { overflow-wrap: anywhere }` (assets/css/reports.css:41) is inherited by every preview table cell; `anywhere` counts a break between any two letters when the browser sizes a column's narrowest width, so the auto table layout squeezes text columns to one letter (27-36 px) and gives the room to the nowrap number columns. Contributing: a hyphenated word ('Single-name') splits at its hyphen when its column sits at its narrowest width.
next_action: apply fix in reports.css (+ hyphen span in reports-ui.js tableHTML), run probe phone+desktop, pixel-diff desktop, then walk12 and the listed checks

reasoning_checkpoint:
  hypothesis: "Text columns of 4+ column preview tables collapse to one letter on the phone because .rb-doc's inherited overflow-wrap: anywhere makes each text cell's min-content one glyph; with number cells nowrap, the auto table layout at 308 px gives text columns their min-content."
  confirming_evidence:
    - "Base probe at 390x844 reproduces the walk: 60 (KB), 22 (AR), 40 (PB) broken words, text columns 27-36 px, numbers 49-111 px."
    - "Injecting only `.rb-tbl th, .rb-tbl td { overflow-wrap: normal }` via CSSOM (no other change) takes the counts to 0, 0, 1 and text columns to their longest word (58-104 px)."
    - "The one remaining split is 'Single-name' at its hyphen (a break opportunity that exists regardless of overflow-wrap) in a 75 px column; a phone min-width of 8em on text cells makes it 0."
  falsification_test: "If overflow-wrap: normal on the cells had left words split mid-letter, or if the counts had not moved, the cause would be elsewhere (e.g. table-layout or width rules). They went 125 -> 1, and the 1 is a hyphen break, not a mid-letter break."
  fix_rationale: "Removing the inherited anywhere from table cells restores each column's true narrowest width (its longest word), which is exactly what the scroll box (.tbl-scroll, overflow-x: auto) was built to handle; the phone-only rules for 4+ column tables (title and first column fixed while scrolling, text columns 8em) make the scrolled table readable, and the hyphen span guarantees hyphenated words stay whole for any sponsor's data."
  blind_spots: "Real WebKit (iPhone Safari) not installed - Chromium stand-in only; sticky table cells with collapsed borders are supported in Safari 15+ but not seen here. Fund A previews are covered by the walk, not the probe. Very long hyphenated or unspaced names would widen the fixed first column."
  candidate_causes:
    - "code (CSS): inherited overflow-wrap: anywhere on .rb-doc reaches th/td - CONFIRMED"
    - "data: hyphenated words (Single-name) in a column at its narrowest width - CONFIRMED contributing (1 of 125)"
    - "code (markup): tableHTML missing a scroll wrapper - ELIMINATED (wrapper present, scrolls)"
    - "environment: phone frame width/zoom differs from 390 - ELIMINATED (frame checked 390x844; box 308 px = 390 - page and doc padding)"
  and_gate: "yes, partly: the mid-letter breaks need only the inherited anywhere (single cause); the hyphen split needs a hyphenated word AND a column at its narrowest width. root_cause is the set of the two."

## Symptoms

expected: At 390 px phone frame, every preview table readable: every word whole on one line, numbers right-aligned and never cut; 3-col tables already fine.
actual: 4+ column preview tables squeeze text columns to 27-36 px; 'Investment' wraps over 8 lines; 143 broken words in five previews (Kestrel Bay Holdings+Net performance 60, Ashwell Ridge Distributions/Totals/Net performance 22, Pellbrook Holdings 40, fund A statement Distributions/Totals 9, fund A summary Net performance/Holdings 12); Holdings and Net performance 343-544 px wide in a 308 px box; Holdings header cut at '% of net as'.
errors: `WALK12: FAIL (steps run: 28) - kb-open, kb-preview, ar-letter, ar-preview-pdf, pb-letter, fa-statement, fa-holdings` (kb-open, ar-letter, pb-letter also/only fail on W5 font host requests, a separate queued fault)
reproduction: `node .planning/phases/12-report-builder/checks/walk12.js` (117 s, phone frame)
started: since phase 12 report preview (plan 12-06); caught first by 12-09 walk (commit cf89610 added the assertion)

## Eliminated

- hypothesis: the table markup in reports-ui.js (tableHTML) is malformed or missing a scroll box
  evidence: markup already wraps every table in `.tbl-scroll` (overflow-x: auto); the overflowing tables do scroll inside it (base probe: scroll 365-544 in box 308). Text columns are squeezed by the min-content collapse, not by missing markup. Injecting only `overflow-wrap: normal` (no markup change) removed 125 of 125 squeezed-word breaks.
  timestamp: 2026-11-27T14:25:00Z

## Evidence

- timestamp: 2026-11-27T00:00:00Z
  checked: assets/css/reports.css (preview styles) and assets/js/reports-ui.js:915-919 tableHTML
  found: table markup is `<div class="tbl-scroll rb-tblwrap"><table class="rb-tbl">` with `.num` cells (`white-space: nowrap; text-align: right`). `.rb-doc` (reports.css:41) sets `overflow-wrap: anywhere`, inherited by th/td. `.rb-tbl { width: 100% }`, no min-width or white-space on text cells. `.tbl-scroll` (console.css:296, portal.css:198) is `overflow-x: auto`.
  implication: candidate cause in code (CSS): `overflow-wrap: anywhere` collapses text-cell min-content to one glyph; auto table layout then gives the slack to nowrap number columns.

- timestamp: 2026-11-27T14:10:00Z
  checked: server tests on base b8d8613 (`cd server && node --test`, output scratchpad/debug-report-tables/server-base.txt)
  found: "# tests 567 / # pass 567 / # fail 0" (not 584: the base count is 567)
  implication: GREEN target for server tests is 567/567.

- timestamp: 2026-11-27T14:20:00Z
  checked: probe scratchpad/debug-report-tables/probe/probe-tables.js, phone 390x844, base CSS (probe-base-phone.txt)
  found: reproduced exactly: KB PE letter 60 broken (Holdings 5 cols 365 px in 308 box, Investment=27 Security=27 px; Net performance 8 cols 544 px, Investment=27 px, 'Kestrel Bay Fund II, L.P.' over 16 lines); AR RE letter 22 (Distributions Date=36 Type=29 px, Totals Period=50); PB open-ended 40 (Holdings 381 px, 'Total return swaps (2 counterparties)' over 34 lines). KB statement Totals 3 broken. Number columns are 49-111 px and never cut (nowrap).
  implication: RED reproduced outside the 117 s walk; text columns sit at a one-glyph min-content.

- timestamp: 2026-11-27T14:25:00Z
  checked: same probe with one rule injected through CSSOM: `.rb-tbl th, .rb-tbl td { overflow-wrap: normal; }` (probe-h1-phone.txt)
  found: broken words 60->0 (KB), 3->0 (KB stmt), 22->0 (AR), 40->1 (PB). Text columns now at their longest word (Investment 80-104 px, Security 69-75, Date 75, Type 58, Period 68). Tables wider than the box now scroll inside it: Holdings 461/506 px, Net performance 587/596 px, Distributions 375, Totals 326 in a 308 px box. Rows shrink (KB Holdings 2878 -> 574 px tall). One word still split in PB Holdings (to identify).
  implication: CONFIRMS the cause: inherited `overflow-wrap: anywhere` (reports.css:41 .rb-doc) sets each text cell's min-content to one glyph, and the auto table layout gives the room to the nowrap number columns. Removing it from the cells alone fixes nearly all; one remaining break is a different mechanism (likely a hyphen/slash break opportunity, not anywhere).

- timestamp: 2026-11-27T14:40:00Z
  checked: the one word still split after h1 (probe prints each broken word)
  found: PB Holdings 'Single-name' split at its hyphen ('Single-' / 'name and basket swaps') in a 75 px Security column. A hyphen (and a slash) is a normal break opportunity, independent of overflow-wrap.
  implication: second, smaller contributing condition (data: hyphenated words in a column at its min-content). Needs either a wider text column or the hyphenated word kept on one line.

- timestamp: 2026-11-27T14:45:00Z
  checked: desktop 1280x800, base CSS (probe-base-desktop.txt)
  found: every preview table fits its 930 px box with every cell on one line (0 broken words; e.g. KB Holdings Investment=283 Security=234; Net performance Investment=207). When a table is wider than the sum of its cells' widest content, auto layout splits the extra by the widest content, not the narrowest, so a change to the narrowest (min-content) width cannot move desktop columns.
  implication: the root-cause rule (overflow-wrap: normal in cells) should leave desktop unchanged; to be proven by measurement + pixel diff.

- timestamp: 2026-11-27T14:55:00Z
  checked: variant h2 (phone): root rule + phone-only `min-width: 8em` on text cells + sticky first column (white, 1 px divider) (probe-h2-phone.txt, shots h2-*)
  found: 0 broken words in all four previews ('Single-name' now whole in a 96 px column); min-width on cells honoured (96 px); first column stays at x 0 when scrolled to the end; numbers never cut (scrollWidth<=clientWidth on every .num). But the caption ('Holdings') scrolls away with the table, and min-width also widened the fine 2-column table (Month 153->174 px).
  implication: caption must stay too; scope the phone rules to tables of 4+ columns so the fine tables keep their exact look.

- timestamp: 2026-11-27T15:05:00Z
  checked: variant h3 (phone): h2 + `.rb-tblwrap { container-type: inline-size }` + `caption { position: sticky; left: 0; width: 100cqw }` (probe-h3-phone.txt)
  found: caption stays at x 0, 308 px wide, in every scrolled table; first column stays; 0 broken words. Screens h3-phone-kb-pe-t3.png (Holdings: names on 3 lines, whole words) and h3-phone-kb-pe-t2-scrolled.png (Net performance scrolled: Investment column and title in place, Net IRR/TVPI/DPI/RVPI whole).
  implication: chosen design: sideways scroll in the table's own box, first column and title fixed, text columns 8em minimum, phone only, 4+ columns only; root rule at all widths.

- timestamp: 2026-11-27T15:40:00Z
  checked: fix applied in files (reports.css root rule + phone rules scoped to 4+ columns; reports-ui.js tableHTML wraps hyphen/dash/slash words in span.rb-nw), probe after2 phone + desktop vs clean before runs
  found: phone: broken words 60->0 (KB PE), 3->0 (KB statement), 22->0 (AR RE), 40->0 (PB open-ended); first column and title stay at x 0 when scrolled to the end; 0 numbers cut (no .num with scrollWidth>clientWidth); 2- and 3-column tables pixel-identical to before (8 of 8 shots). Desktop 1280: every table/column measurement identical; 17 of 19 screenshots pixel-identical; PB Holdings differs in 46 pixels in one 11x7 px patch (max grey difference 59/255) inside 'Single-name and basket swaps, net unrealized': sub-pixel anti-aliasing because the span starts a new text run; columns, lines and positions unchanged.
  implication: GREEN on the probe; desktop look unchanged (sub-pixel only, reported plainly).

- timestamp: 2026-11-27T15:45:00Z
  checked: first phone screens after the fix (after-phone-kb-pe-t2.png): Net performance at scroll 0
  found: three columns fill the 308 px box exactly; nothing showed that five more columns are to the right.
  implication: added a right-edge shade (white end with background-attachment: local covers it at the end) on 4+ column table boxes, phone only: h4/after2 shots show the shade at scroll 0 and none at the end.

- timestamp: 2026-11-27T15:46:00Z
  checked: Totals scrolled to its end (after-phone-ar-re-t3-scrolled.png)
  found: the table is 46 px wider than its box; at the far right the Gross column slides under the fixed first column (reads ')0.00'); at scroll 0 every Gross figure is whole.
  implication: inherent to a fixed first column (every figure can be read whole at some scroll position; none is truncated by the layout). Reported as a trade-off, not hidden.

- timestamp: 2026-11-27T16:00:00Z
  checked: GREEN walk `node .planning/phases/12-report-builder/checks/walk12.js` (scratchpad/debug-report-tables/walk12.txt, 129 s)
  found: last line `WALK12: FAIL (steps run: 28) - kb-open, ar-letter, pb-letter`. 244 PASS, 3 FAIL (base 239 PASS, 8 FAIL). The 3 failures are all W5 (fonts.googleapis.com requests: kb-open 2, ar-letter 1, pb-letter 1), the separate queued fault. Broken-word assertion PASS (0 broken) in kb-preview, ar-preview-pdf, pb-letter, fa-statement, fa-holdings. compare-walk.py: 0 base-passing checks lost. Tables now: Holdings 482-527 px and Net performance 578-613 px scroll inside the 308 px box; Distributions 434, Totals 338-354.
  implication: RED -> GREEN for this fault; kb-preview, ar-preview-pdf, fa-statement, fa-holdings pass fully; pb-letter fails only on W5.

- timestamp: 2026-11-27T16:00:30Z
  checked: REPORTS FLOW (scratchpad/debug-report-tables/reports-flow.txt, 135 s)
  found: `REPORTS FLOW: PASS (parts run: 8)` (includes preview-pdf: every preview word in the PDF's words, counted)
  implication: preview text unchanged by the spans.

- timestamp: 2026-11-27T16:20:00Z
  checked: the other listed checks after the fix (outputs in scratchpad/debug-report-tables/)
  found: deliver-flow.txt `DELIVER FLOW: PASS (parts run: 8)` (82 s); reports-sweep.txt `REPORTS SWEEP: PASS (parts run: 4)` (51 s); report-fixes.txt `REPORT FIXES: PASS (parts run: 5)` (49 s); phone-layout.txt `PHONE LAYOUT: PASS (parts run: 8)` (335 s); screen-edges.txt `SCREEN EDGES: PASS (parts run: 5)` (107 s)
  implication: no regression in the report builder flows, the sweep (no vendor name / forbidden word added), phone layout or screen edges.

- timestamp: 2026-11-27T16:40:00Z
  checked: the generated PDFs' multi-column tables (never looked at before): Download PDF for KB PE letter, KB statement, AR RE letter, PB open-ended letter (scratchpad/debug-report-tables/pdf/*.pdf), every page drawn with pdftoppm at 110 dpi and the Net performance tables at 220 dpi
  found: all 3 pages of each drawn. Page 2/3 tables are whole and readable: Net performance (8 columns) fits the page width, every figure whole and right-aligned, no overlap ('$6,375,000.00 $1,976,250.00' about one space apart, tight but clear); names wrap on whole words ('The Residences at Cedar / Row', 'Brightline Packaging / Holdings, LLC'); Holdings (5 columns) splits across pages 2-3 in the KB letter with its header row repeated on page 3; Distributions (5), Totals (4) whole. No word broken mid-letter in any PDF table.
  implication: the PDF composer does not share the fault; reports-pdf.js left unchanged. Side observation outside this fault: KB statement page 2 'Your distributions by quarter' with no distributions draws an empty chart with '$0.00' as both its top and bottom axis label.

- timestamp: 2026-11-27T17:00:00Z
  checked: regression assertions added: reports-flow.js tableLayout() (shared); REPORTS FLOW open-phone: no broken word + each wide table keeps title and first column in place scrolled to its end, no figure cut; REPORTS FLOW preview-pdf (1280 px): every table fits its box, no broken word, no cut figure, no fixed column; walk12 layout(): the same held-in-place check in its 5 preview steps. walk12-final.txt (552 s, machine loaded)
  found: `WALK12: FAIL (steps run: 28) - kb-open, ar-letter, pb-letter`; 249 PASS, 3 FAIL (all W5); 5 new held-in-place checks PASS; compare-walk.py: 0 base-passing checks lost.
  implication: walk GREEN for this fault with the stronger guard.

## Resolution

root_cause: "assets/css/reports.css:41 `.rb-doc { overflow-wrap: anywhere }` is inherited by the preview's table cells; `anywhere` (unlike break-word) counts a break between any two letters in a cell's narrowest (min-content) width, so the automatic table layout at the phone's 308 px squeezed text columns to one letter (27-36 px) and gave the width to the nowrap number columns; tables whose number columns alone exceeded 308 px also overflowed (343-544 px). Contributing (AND): a hyphenated word ('Single-name') breaks at its hyphen whenever its column sits at its narrowest width."
fix: "reports.css: `.rb-tbl th, .rb-tbl td { overflow-wrap: normal }` (all widths) and `.rb-nw { white-space: nowrap }`; phone only (max-width 640px) for tables of 4+ columns: the table box is a size container with its own stacking context and a right-edge shade while columns remain; caption sticky at left 0, 100cqw wide; text cells min-width 8em; first column sticky at left 0, white, 1 px divider. reports-ui.js tableHTML: words with a hyphen, dash or slash in text cells wrapped in span.rb-nw (text unchanged)."
verification: "(pending walk12 and the listed checks)"
files_changed: [assets/css/reports.css, assets/js/reports-ui.js]
