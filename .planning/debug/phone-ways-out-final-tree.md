---
status: awaiting_human_verify
trigger: "Final merged tree (claude/refract-reskin a178206), phase 9/10 checks rerun: A. phone long console pages lose every way out partway down (dist-flow record-phone, withheld-phone; taxdocs-flow import-phone; withholding-flow propose-phone, foreign, cancel). B. filings-flow published: empty band between menu and short page {menu:120,bar:285,note:449,screen:844}. C. withholding-flow managed: git shows index.html changed since the plan's base."
created: 2026-11-20
updated: 2026-11-20
---

## Current Focus

bug_class: Bohrbug (deterministic layout)
reasoning_checkpoint:
  hypothesis: "A: on a phone the console's menu (.cs-nav) is position relative and scrolls away; the only way out at mid/end was the preview bar fixed at the bottom, which 06-35 put in the page's flow at the top; so partway down a long console page nothing that leaves the view is on screen. B: the filings check measures the page's absolute top and counts the preview bar (now above the menu) as an empty band. C: the managed assertion counts 11-07's commit as 10-07's."
  confirming_evidence:
    - "probe HEAD: mid/end n=0; .cs-nav relative; .demo-bar static 153 px at top"
    - "probe with the 06-35 base console.css: mid/end n=1, only #demo-sponsor of the fixed bar"
    - "probe HEAD filings: menu 153..273, fl-bar 285 (12 px under the menu, as on the base: 120 -> 132)"
    - "git log 6061fce..HEAD -- index.html = 6f838bc feat(11-07) only"
  falsification_test: "A: with the menu row kept on screen on phones, record-phone/withheld-phone/import-phone/propose-phone/foreign/cancel pass with 06-35's bar still in flow (screen-edges 5 still passes); if they still fail, the cause is elsewhere. B: relative to the menu's top the old thresholds hold (bar 132 < 220, note 296 < 422); if the gap under the menu were large they would fail."
  fix_rationale: "A: keep the console's own menu row on screen on phones (sticky .cs-nav with the firm's name lifted off the top, measured by console.js), which is the real product's way out in every build, preview bar or not; 06-35's bar stays in flow. B and C: change only the out-of-date assertion (origin at the menu's top; commits of plan 10-07 only)."
  blind_spots: "Real iPhone Safari not available (Chromium stands in); 641-900 px and desktop sidebar without the preview bar still scroll away (not part of this regression); other phone checks in the full gate may tap controls that now pass under the pinned row (Playwright retries scroll positions)."
  candidate_causes:
    - "code: console.css/diy.css never pin the console menu on phones (long-standing)"
    - "code (06-35): the preview bar's way out moved into the page's flow"
    - "check/data: B's absolute thresholds and C's commit filter assume the tree as it was when written"
  and_gate: "yes for A: needs both the unpinned menu (old) and the bar no longer fixed (06-35); either alone would leave a way out in the preview. B and C: single cause each (out-of-date assertion)."
next_action: orchestrator merges wip/debug-phone and runs the full gate; owner checks on the iPhone that a long console page (Distributions, History "Show all") keeps the menu row (Overview, Notifications, ...) at the top while scrolling, and the preview bar still sits at the top and scrolls away

## Symptoms

expected: on a 390px phone, a long console page keeps a way out (sticky header/menu) on screen at top, middle and end; the short published filings page starts right under the menu; index.html check reflects the current history.
actual: n=0 ways out at mid and end on 6 phone parts; published: menu bottom 120, bar 285, note 449 (empty band); managed: git log shows commit 6f838bc touching index.html since base.
errors: see trigger; outputs in scratchpad final-phase-checks/{dist,taxdocs,withholding,filings}-flow.txt
reproduction: run the four phase checks through .planning/tools/heavy.sh on a178206
started: after today's merges (each passed when its plan merged)

## Eliminated

- hypothesis: 06-35 un-stuck a sticky console header/menu on phones
  evidence: on the 06-35 base (console.css of 50d2d63 served in place of HEAD's) the console's .cs-nav is position relative and scrolls away too (nav top -3419 at mid-page); the console never had a sticky menu on a phone. The only thing on screen at mid/end on the base was the floating preview bar's #demo-sponsor ("Kestrel Bay Capital", n=1).
  timestamp: 2026-11-20

## Evidence

- timestamp: 2026-11-20
  checked: probe (scratchpad debug-phone/probe.js) on a178206, 390x844 touch, Kestrel Bay admin, console-distributions with History "Show all"
  found: y=0 n=5 (Overview, Notifications, Offerings, #demo-sponsor, #demo-role); y=3463 n=0; y=6926 n=0. .cs-nav position relative (120 px: 12 pad + 59 firm lockup + 8 gap + 40 menu row + 1 line); .demo-bar position static, 153 px at the top (06-35).
  implication: reproduces A exactly; partway down a 7.5k px page a sponsor on a phone has no link, menu or role control on screen.
- timestamp: 2026-11-20
  checked: same probe with console.css of the 06-35 base (50d2d63) served
  found: y=3419 and y=6837: n=1 each, the only one being #demo-sponsor in the preview bar fixed at the bottom (top 780, 50 px). Menu scrolls away as on HEAD.
  implication: A's two conditions together (AND): the console's menu was never kept on screen on a phone, and 06-35 removed the floating preview bar that was the only way out at mid/end. In a build without the preview bar (production, server mode) the console never had a way out partway down on a phone. Product fault, exposed by 06-35.
- timestamp: 2026-11-20
  checked: probe on HEAD, console-filings (the short Filings page) at y=0
  found: demo bar 0..153, .cs-nav 153..273 (120 px), .fl-bar top 285 (12 px under the menu: .cs-main padding). Base: menu 0..120, .fl-bar 132.
  implication: B's 285 is the preview bar's 153 px (in the page's flow by 06-35's decision) above the menu, not an empty band: the page starts 12 px under the menu as before. The check measures the bar's absolute top (<220) and so assumes nothing above the menu: out of date after 06-35.
- timestamp: 2026-11-20
  checked: withholding-flow.js:690-696 (part managed) and git log 6061fce..HEAD -- index.html
  found: the assertion lists every non-merge commit since 10-07's base that touches index.html; the only one is 6f838bc "feat(11-07): both editions load the journal and the posting module" (two script lines, books.js and books-post.js). No (10-07) commit touches index.html; working tree clean.
  implication: C is an out-of-date assertion: its intent (D6, "no commit of the plan") is about plan 10-07's own commits; 11-07 changed index.html later, by its own plan.
- timestamp: 2026-11-20
  checked: RED in this worktree on a178206 (scratchpad debug-phone/red-*.txt)
  found: "DIST FLOW: FAIL (parts run: 1) - record-phone" (y 3602 n 0, y 7203 n 0); "FILINGS FLOW: FAIL (parts run: 1) - published" {menu 120, bar 285, note 449, screen 844}; "WITHHOLDING FLOW: FAIL (parts run: 1) - managed" {log 6f838bc}.
  implication: all three reproduce here.
- timestamp: 2026-11-20
  checked: diy.css:243 `.cs-nav { position: relative; }` (loaded after console.css, for the bell/help placed absolutely); diy.css:318-327 help button absolute at the top right of the menu at <=900 px
  implication: a sticky rule in console.css needs more weight than `.cs-nav` (use `.cs > .cs-nav`); sticky keeps the bell/help's containing block.

## Resolution

root_cause: "A (product): the console's menu (.cs-nav, console.css:525 at <=900 px; diy.css:243 position relative) was never kept on screen on a phone, AND 06-35 (console.css:113-124, a7feb14) put the preview bar, whose sponsor/role controls were the only way out at mid/end, into the page's flow at the top; so partway down a long console page on a phone nothing that leaves the view is on screen; B (check): filings-flow.js:256-257 measures from the screen's top and counts the preview bar above the menu (06-35) as a band; C (check): withholding-flow.js:694-696 counts every commit since 10-07's base, and 11-07's 6f838bc touched index.html"
fix: "A: console.css (<=640 px) `.cs > .cs-nav` sticky with top = safe area - --cs-nav-lift (the firm's name, bell and Help scroll away; the 40 px menu row stays), z-index sticky-nav; .fl-bar/.tx-bar top under the row (--cs-nav-pin); scroll-padding-top on the console page; console.js pinMenu() measures lift/pin after each shell render (microtask), on resize and when fonts are ready. B: distances from the menu's top with the same limits, plus the menu must start where the preview bar ends (0 without one). C: only commits whose subject is <type>(10-07): count."
verification:
  target_test: { result: pass, lines: ["DIST FLOW: PASS (parts run: 7) (110 PASS, 0 FAIL)", "TAXDOCS FLOW: PASS (parts run: 14) (349 PASS, 0 FAIL)", "WITHHOLDING FLOW: PASS (parts run: 9) (157 PASS, 0 FAIL)", "FILINGS FLOW: PASS (parts run: 9) (168 PASS, 0 FAIL)"] }
  mutation_check: { result: skipped, reason_if_skipped: "no Stryker for CSS/browser checks; stand-ins: A differential (06-35 base console.css: n=1 from the fixed bar only; HEAD before fix n=0; after fix n=3 from the menu row); B mutant (band-mutant.txt): as is PASS, band under the menu FAIL (bar 252), band above the menu FAIL (at 243 vs above 153), menu stretched FAIL (menu 260); C: the filter matches all 9 (10-07) commits and not 6f838bc" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, note: "A adds behaviour; B keeps its three limits with the origin at the menu's top and adds one (menu starts where the preview bar ends); C narrows to the plan's own commits per its D6 comment" }
  adjacent_tests: { result: pass, lines: ["SCREEN EDGES: PASS (parts run: 5) (145 PASS, 0 FAIL)", "PHONE LAYOUT: PASS (parts run: 8) (209 PASS, 0 FAIL)", "WAYS OUT: PASS (parts run: 7) (102 PASS, 0 FAIL)", "server: # tests 368 # pass 368 # fail 0"], skipped: "status-flow --only lean: not touched (investor onboarding at desktop; the change is console at <=640 px)" }
  revert_and_reconfirm: { result: pass, note: "RED on a178206 (no fix): record-phone/published/managed FAIL; with the fix: PASS" }
  guardrail_verdict: accepted
files_changed: [assets/css/console.css, assets/js/console.js, .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/filings-flow.js, .planning/phases/10-investor-tax-documents-and-withholding/checks/withholding-flow.js]

## Commits (wip/debug-phone)

- 7f13934 wip(debug-phone): save -- assets/css/console.css, assets/js/console.js (fix A)
- 7b129f9 wip(debug-phone): save -- filings-flow.js (B), withholding-flow.js (C)
- 1a67dce wip(debug-phone): save -- withholding-flow.js: `ours` (the first C edit reused the name `mine`, a syntax error caught by the first verify run)
- b2b97c1 fix(debug-phone): the record; its message names 7b129f9 and 1a67dce as holding the code, and leaves out 7f13934, which holds fix A
