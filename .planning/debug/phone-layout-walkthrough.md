---
status: awaiting_human_verify
trigger: "Fix the phone-layout failures the owner-path walkthrough found in the investor portal: failures 5, 9, 11, 12 and 14 of 06-WALKTHROUGH.md (13 for context). The owner tests on an iPhone inside an app's web view."
created: 2026-11-19T00:00:00Z
updated: 2026-11-19T19:40:00Z
---

## Current Focus

hypothesis: confirmed: the five failures are layout faults at phone widths (no phone rule for console tables, field text, long buttons, file names, the toast, one dialog head, the signing hint), plus three small behaviour faults of failure 14 (intake name, "Enter an amount.", Account page) and one sentence (failure 11)
test: checks/phone-layout.js on the base (a0f0e63 and the merged tip 0bfddca) and on the fix (merged), through SCRATCH/exec-011/heavy.sh
expecting: base FAIL, fix PASS on all 8 parts, desktop elements unchanged against the base tip
next_action: owner checks the published preview on his iPhone (see 06-33-SUMMARY.md); then archive this session
bug_class: Bohrbug (deterministic layout)
reasoning_checkpoint:
  hypothesis: "At 390 px the console's tables keep their desktop columns inside a sideways scroller, so the last column (the row actions) starts past the screen; every field rule sets 12-14 px text and none raises it on phones; four long items have nowrap or no break opportunity; the connection dialog's head wraps its X; the signing hint is nowrap with an ellipsis"
  confirming_evidence:
    - "RED on a0f0e63: 786 table controls past an edge, 824 of 850 fields under 16 px, 7 items wider than the screen, 1 dialog X under its title, 52 touch areas under 24 px (147 phone screens)"
    - "the same 147 screens on the fix: 0 of each"
  falsification_test: "a stacked table whose actions still land past 390 px, or a field still under 16 px, on any of the 147 screens"
  fix_rationale: "each fault gets the phone rule it lacked (the portal's own stacked-table pattern, one 16 px field rule, wrapping, a dialog head as the email dialog has, a wrapping hint); desktop rules untouched, proved by element-by-element comparison"
  blind_spots: "real WebKit is not installed: the focus zoom itself is not observed, only the 16 px that prevents it; tables not reached by the walk with other data could still overflow"
  candidate_causes:
    - "code (stylesheets): missing phone rules (confirmed)"
    - "data: long sample names (not the cause: the same rows fit once stacked; long names now wrap)"
  and_gate: "no: each fault has one cause; the three behaviour faults of failure 14 are independent JS gaps"

## Symptoms

expected: at 390x844 with touch every row action on the sponsor's tables is reachable without dragging sideways; no field text under 16 px on sign-up or console forms; nothing wider than the screen; the field editor's Review sentence does not point to a hidden list; the small items of failure 14 hold; 1280x800 unchanged
actual: Approve at 764 px and Decline at 858 px on a 390 px screen; Download 423, View portal 630, Account 650 on Investors; sign-up and console fields at 14 px, the preview bar's selects at 12 px; three items wider than the screen; "Fields marked Review are listed on the left" with the list hidden; eight tap targets under 24 px; four other small items
errors: none (no console error in the walkthrough)
reproduction: the preview in a sandboxed iframe at 390x844 with touch: Requests, Investors, every console form, Offering intake, new offering, Audit after a download, the field editor, Distributions, the signing bar, the investor's Account page, "Add a connection"
started: found by the owner-path walkthrough of 2026-11-19 (06-WALKTHROUGH.md); never fixed before

## Eliminated

- hypothesis: the walkthrough's eight small tap targets are all under 24 px for a finger
  evidence: six of them already had a touch area of 41 to 46 px laid over them by an absolutely placed ::after (the walkthrough measured the box only); the browser's hit test 11.95 px above and below their middle lands on them on the base. Only the support email (23.7 px) and "Read the PDF again" (17.4 px) were short.
  timestamp: 2026-11-19

## Evidence

- timestamp: 2026-11-19
  checked: knowledge base (.planning/debug/knowledge-base.md)
  found: no knowledge base file exists; no prior resolved session to match
  implication: no known-pattern candidate

- timestamp: 2026-11-19
  checked: stylesheets for an existing narrow-screen table pattern
  found: two exist. portal.css `.tbl-stack` (max-width 640px): thead hidden, each row a two-column grid, each cell labelled from data-label, `.td-action` placed in the row. diy.css `.iv-conns` (max-width 720px, the console's Integrations connections table): thead hidden, every cell a block, labels from data-label. No other `.cs-tbl` stacks: they sit in `.tbl-scroll` (overflow-x auto).
  implication: the portal's own pattern is "hide the header, stack the row, label each cell from data-label"; console tables other than Integrations have no data-label

- timestamp: 2026-11-19 (continuation)
  checked: the stylesheets behind the walkthrough's eight small tap targets
  found: six of the eight already carry a touch area laid over them with an absolutely placed ::after (cs-step-rm inset -6/-16, cs-back -12, a.cs-link -12, .sec-head .link-btn -12, .terms dd .link-btn -12, pvbar-back -12); the walkthrough measured the box only. The support email's ::after is -1px (23.7 px); "Read the PDF again" has none (17.4 px)
  implication: the check measures the touch area (box or ::before/::after over it) and proves it with the browser's hit test on the eight; only the real short ones need a rule

- timestamp: 2026-11-19 (continuation)
  checked: SCRATCH/fix-walk-c/explore-phone.json (the earlier agent's sample-firm sweep at 390 px) and the RED run
  found: tables with row actions past the right edge: Investors, Requests, Invitations, Distributions history, Documents, AML/KYC, Audit files, E-sign templates, Offering intake's editable lists
  implication: these tables stack on the phone with labelled cells (cs-stack); tables without row actions keep their sideways scroll

- timestamp: 2026-11-19 (continuation)
  checked: RED on a0f0e63 (SCRATCH/fix-walk-c/red-base) and on the merged tip 0bfddca (red-base-merged, red-base-merged2); fix on the merged tree (fix-merged-phone, the gate)
  found: base PHONE LAYOUT: FAIL (parts run: 8); fix phone parts PASS (parts run: 4), 0 offenders on 147 phone screens
  implication: confirmed

## Resolution

root_cause: no phone rule for the console's tables (their row actions sat in a sideways scroller past the screen), for field text (12-14 px everywhere but investor onboarding), for four long items (nowrap buttons, an unbreakable file name, the toast), for the connection dialog's head and for the signing bar's hint; plus three JS gaps (intake name not marked, the amount hint not refreshed, the Account page not offering the open tax-form request) and one sentence pointing to a list the phone hides
fix: phone-only stylesheet rules (base.css, console.css, portal.css, diy.css, esign.css) and data-label/cs-stack markup on nine tables; console.js ik-apply and NS.binders.ik, distWhy and NS.binders.dist; onboarding.js taxAsk and portal.js account; esign.js editorHTML's phone sentence
verification: see .planning/phases/06-*/06-33-SUMMARY.md (check counts, gate lines)
files_changed: [assets/css/base.css, assets/css/console.css, assets/css/diy.css, assets/css/esign.css, assets/css/portal.css, assets/js/console.js, assets/js/esign.js, assets/js/invitations.js, assets/js/onboarding.js, assets/js/portal.js]
oracle_type: specified (the walkthrough's numbers and the owner's 16 px / 24 px / screen-width limits)
