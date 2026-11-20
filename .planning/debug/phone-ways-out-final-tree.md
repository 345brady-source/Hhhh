---
status: investigating
trigger: "Final merged tree (claude/refract-reskin a178206), phase 9/10 checks rerun: A. phone long console pages lose every way out partway down (dist-flow record-phone, withheld-phone; taxdocs-flow import-phone; withholding-flow propose-phone, foreign, cancel). B. filings-flow published: empty band between menu and short page {menu:120,bar:285,note:449,screen:844}. C. withholding-flow managed: git shows index.html changed since the plan's base."
created: 2026-11-20
updated: 2026-11-20
---

## Current Focus

hypothesis: A and B come from plan 06-35's console.css block at 640px and under (#app:has(> #demo .demo-bar) column layout) un-sticking the console header/menu or adding the bar above the menu; C is an out-of-date assertion (11-07 added script lines to index.html after 10-07's base).
test: read 06-35 diff to console.css, the failing check assertions, and reproduce on a178206 vs 06-35's base
expecting: way-out sticky element loses stickiness inside the flex column (or its scroll container changes)
next_action: git show a7feb14 -- assets/css/console.css; read the way-out assertion in the dist-flow check

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

## Resolution

root_cause:
fix:
verification:
files_changed: []
