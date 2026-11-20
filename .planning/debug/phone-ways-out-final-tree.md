---
status: investigating
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
next_action: add sticky menu row on phones (console.css + console.js pinMenu), then fix B and C assertions

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

root_cause:
fix:
verification:
files_changed: []
