---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 35
subsystem: phone layout (preview bar), signing bar, signing views on the phone
status: complete
tags: [phone, iphone, preview-bar, signing, touch, walkthrough-2]
requires: [06-WALKTHROUGH-2, 06-33]
provides:
  - "at 640 px and under the preview bar stands in the page's flow at the top and covers nothing"
  - "the signing bar's hint in full at every size"
  - "checks/screen-edges.js: SCREEN EDGES (5)"
affects: [owner check, preview build (console.css, esign.css changed; no new product file)]
tech-stack:
  added: []
  patterns: ["#app:has(> #demo .demo-bar) column layout at 640 px and under"]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/screen-edges.js
  modified:
    - assets/css/console.css
    - assets/css/esign.css
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/phone-layout.js
decisions:
  - "Phone preview bar at the top in the page's flow (641 px and over unchanged)"
  - "Signing hint wraps at every size; the desktop bar grows by a line"
  - "N3 and the signing-view blanks: no product change, proved on the base (44 px touch layers, 16 px tray)"
metrics:
  completed: 2026-11-21
actuals:
  tokens: 16000
  tasks: 3
  commits: 6
plan_head_before: 50d2d63a86d6bd324578a1cee37db181652480d1
---

# Phase 6 Plan 35: screen edges (preview bar on the phone, desktop signing hint, signature and blanks on the phone) Summary

On a 390 px touch screen the preview bar no longer floats over the bottom of the page: it sits at the top in the page's
flow and scrolls away; on the desktop the signing hint is said in full. The signature fields and the document blanks on the
phone were proved reachable and readable on the base, so they were not changed. Nothing here is ready until the owner has
checked it on his iPhone.

## Failures and limits first

1. **Real WebKit is not installed here**: Chromium stands in for the iPhone (390x844, touch, iOS user agent) in a sandboxed
   frame that refuses every connection.
2. **The W-9 has no blank the investor types** (0 unlocked text fields): every value on it is filled in and locked, so the
   blanks part proves the tray on the agreement only (5 blanks).
3. **The phone bar now takes three rows** on console and portal pages (sponsor picker; "Signed in as"; New sign-up), about
   145 px at the top of each page until it scrolls away. Two rows are possible if the selects may cut their text.
4. **The desktop comparison of PHONE LAYOUT** (run with the base geometry, beyond the plan's verify): firms, sample and editor
   unchanged; owner-desktop shows the three intended signing-screen changes (accepted by the new named entry) and one other
   screen, "investors with an open invitation", whose "Sent <date, time>" text is narrower (153 to 145 px) because the base
   run was made at 12:5x AM and the fix runs at 2:xx AM (invitations.js `when`: the clock, not the layout; same difference in
   two fix runs). The plan's verify run of PHONE LAYOUT (no base, as the gate runs it) passed.
5. **The check's own faults, corrected before the second RED run** (see Deviations): the first full RED run also failed
   blanks-phone and the countersign Finish line because of how the check tapped, not because of the product.
6. Not changed (fieldeditor.js belongs to 06-36): on a phone the field editor still leaves 72 px under itself for a bar
   that no longer floats; harmless (the editor is a little shorter than the screen).

## RED on the base (50d2d63), all 5 parts

`SCRATCH/exec-06-35/red.txt` (the second full run; the first, `red-first.txt`, was made before two check corrections
listed under Deviations, and one later run was killed by a container restart):

```
SCREEN EDGES: FAIL (parts run: 5) - bar-phone, hint-desktop
115 PASS, 30 FAIL
```

FAIL lines on the base, quoted (long data cut at the end of each line):

```
FAIL bar-phone the sign-up page: the preview bar is neither fixed nor sticky :: {"position":"fixed"}
FAIL bar-phone the sign-up page: at the top of the page the bar ends above the page’s first content :: {"barTop":780,"barBottom":830,"first":"view","firstTop":0}
FAIL bar-phone the sign-up page: scrolled to its end in 2 stops, no control or text box lies under the bar (18 controls on screen counted) :: {"n":1,...
FAIL bar-phone the sign-up page: and the hit test at each control’s middle never lands on the bar :: {"n":1,...
FAIL bar-phone the console Overview: the preview bar is neither fixed nor sticky :: {"position":"fixed"}
FAIL bar-phone the console Overview: at the top of the page the bar ends above the page’s first content :: {"barTop":780,"barBottom":830,...
FAIL bar-phone the console Overview: the bar’s controls all lie inside the screen, with no sideways scroll :: (New sign-up at 588-696 px on a 390 px screen; bar scrollWidth 684, clientWidth 362)
FAIL bar-phone Investors with the invite form open: the preview bar is neither fixed nor sticky :: {"position":"fixed"}
FAIL bar-phone Investors with the invite form open: at the top of the page the bar ends above the page’s first content
FAIL bar-phone Investors with the invite form open: the bar’s controls all lie inside the screen, with no sideways scroll
FAIL bar-phone Investors with the invite form open: scrolled to its end in 10 stops, no control or text box lies under the bar (82 controls on screen counted) :: {"n":3, input#iv-email, Account, View portal}
FAIL bar-phone Investors with the invite form open: and the hit test at each control’s middle never lands on the bar :: {"n":1, input#iv-email}
FAIL bar-phone the investor’s Home: the preview bar is neither fixed nor sticky / ends above the first content / controls inside the screen
FAIL bar-phone the investor’s Home: scrolled to its end in 5 stops, no control or text box lies under the bar (39 controls on screen counted) :: {"n":3,...}
FAIL bar-phone the investor’s Home: and the hit test at each control’s middle never lands on the bar :: {"n":1, ir@kestrelbaycap.com}
FAIL bar-phone the investor’s Documents: (the same three bar lines)
FAIL bar-phone the investor’s Documents: scrolled to its end in 3 stops, no control or text box lies under the bar (45 controls on screen counted) :: {"n":4,...}
FAIL bar-phone the investor’s Documents: and the hit test at each control’s middle never lands on the bar :: {"n":2, a document link and its View}
FAIL bar-phone the field editor: (the same three bar lines)
FAIL bar-phone the field editor: scrolled to its end in 2 stops, no control or text box lies under the bar (44 controls on screen counted) :: {"n":7, Undo, Redo, zoom, page controls}
FAIL bar-phone the field editor: and the hit test at each control’s middle never lands on the bar :: {"n":6,...}
FAIL hint-desktop the W-9 signing view: the signing bar’s hint shows its whole sentence ("Nothing is required. Start goes to each empty field.") :: {"cut":true,"whiteSpace":"nowrap","textOverflow":"ellipsis","width":299,"needs":337}
FAIL hint-desktop the investor’s agreement: the signing bar’s hint shows its whole sentence ("Nothing is required. Start goes to each empty field.") :: {"cut":true,"width":299,"needs":337}
FAIL hint-desktop the firm’s countersign view: Finish presses :: locator.click: Timeout 8000ms exceeded (finAt: aria-disabled "true", hit test on the button) -- a fault of the check, corrected after this run (Deviations)
```

sign-touch-phone and blanks-phone PASS on the base. bar-desktop PASS (it recorded `bar-desktop-base.json` on the base in the
first debugging run).

## What the walkthrough measured, and what a finger hits (N3 and the signing-view half of failures 9 and 11)

Both parts passed on the base, so nothing was changed for them (signflow.js is not in any commit).

- **N3, the signature fields (sign-touch-phone, 390x844, touch).** The walkthrough's 146x12 px is the button's drawn box.
  Around every signer field lies a touch layer of max(44 px, the field's height). The browser's hit test at the middle and
  20 px above and below, then a finger's tap 20 px off the middle that opened the signature dialog (the signature was adopted
  and filled the field):

  | Signing view | Drawn box | Touch layer | Tap that opened the dialog |
  |---|---|---|---|
  | W-9 (U.S. individual) | 146x11.6 px | 146x44 px | 20 px below the middle |
  | W-8BEN (foreign individual) | 179x6.8 px | 179x44 px | 20 px below |
  | W-8BEN-E (foreign entity) | 126x13.6 px | 126x44 px | 20 px below |
  | Investor's agreement | 130x20.3 px | 130x44 px | 20 px above (the Name line is nearer the point 20 px below, and a tap there is the Name line's) |
  | Firm's countersign view | 133x20.8 px | 133x44 px | 20 px above (the same: the firm's name line lies just below) |

  The envelope's field rectangles and the page's boxes were the same before and after on every view: nothing printed changed.
- **Failures 9 and 11 on the signing views (blanks-phone).** The 4.7 to 6.3 px the walkthrough counted are the page's drawn
  blanks (7 px here). On the phone they are read-only with no keyboard of their own; a tap moves the typing into the tray
  above the keyboard, at 16 px. On the agreement all 5 of the investor's blanks: tapped, each opened in the tray at 16 px with
  its own label ("Commitment amount (optional)", "Investor name", "Mailing address", "Name", "Title"), what was typed there
  filled the blank, every touch layer 44 px tall; 3 were also tapped 18 px off the middle (into the tray as well), 2 lie
  closer than 18 px to another field on both sides and were tapped on themselves only. **The W-9 has no blank the investor
  types:** all its text fields are filled in for the investor from the answers and locked (0 unlocked blanks), so the small
  text the walkthrough measured on the W-9 is printed values, not places to type.

## Decisions

- Failure 13, as planned: at 640 px and under the bar stands in the page's flow at the top (above the portal's own header)
  and scrolls away; its three controls wrap onto three rows on the console (sponsor picker; "Signed in as"; New sign-up),
  every word of each select's choice visible. 641 px and over keep the floating bar exactly as it was (bar-desktop: the
  same box and bottom padding as the base on four screens).
- Failure 14's rest: the hint wraps at every size; on the desktop the bar grows by one line where the sentence needs it
  ("Nothing is required. Start goes to each / empty field.").
- N3 and failures 9/11 on the signing views: no product change (both proved on the base).

## What changed

- `assets/css/console.css`, a new block at 640 px and under: `#app:has(> #demo .demo-bar)` becomes a flex column with
  `#demo` first; `.demo-bar` static, full width, wrapping, page-coloured with a hairline under it (top padding takes the
  safe area); the sponsor picker takes its own row, each select grows to show its choice; no float shadows; the bottom room
  for a floating bar (`#view`, `.cs-main`) is not applied.
- `assets/css/esign.css`: `.sf-hint` without `nowrap`/ellipsis (wraps at every size); the phone's lift of the signing guide
  above the bar removed; at 640 px and under the field editor's 72 px bottom room becomes `--space-lg`.
- `checks/phone-layout.js`: one entry in its named list of intended desktop changes (the signing screens: the bar grows by
  the hint's line, the elements around it taller by that line, the elements below moved down by it; tested by `hintLine`).
  The comparison accepts an entry's own test where it has one; nothing else changed.
- No markup, script or help-guide text changed; no new file the preview build must add (console.css and esign.css are
  already in it).

## Verification (verify lines verbatim)

Task 1 (on the fix, before the hint change): `SCREEN EDGES: PASS (parts run: 2)` (bar-phone, bar-desktop).
Task 2: `SCREEN EDGES: PASS (parts run: 1)` (hint-desktop, 20 PASS); `PHONE LAYOUT: PASS (parts run: 8)` (209 PASS, 0 FAIL).
Task 3, all on the final tree:

```
SCREEN EDGES: PASS (parts run: 5)      (145 PASS, 0 FAIL)
SAFARI FINISH: PASS (parts run: 6)     (54 PASS)
WAYS OUT: PASS (parts run: 7)          (102 PASS)
BANK STEP TYPING: PASS (parts run: 2)  (18 PASS)
```

`npm --prefix server test`: 358 tests, 358 pass, 0 fail. The full reference gate was not run (the orchestrator runs it on
the merged tree). Gate line to add after the merge: `SCREEN EDGES (5)` = `NODE_PATH=$GN bash $S/exec-011/heavy.sh node
$P/checks/screen-edges.js > $O/edges.txt 2>&1` and `ok 'SCREEN EDGES (5)' "grep -qx 'SCREEN EDGES: PASS (parts run: 5)'
$O/edges.txt"`. bar-desktop compares with `SCRATCH/exec-06-35/bar-desktop-base.json` (keep that file, or set
`SCREEN_EDGES_BAR_BASE`; with neither, the first run records itself).

Owner's check (pending): screenshots in `SCRATCH/exec-06-35/owner/index.txt`, limits first. On the iPhone: the bar at the
top of each page and nothing at the bottom covered; on a desktop the signing hint in full; the W-9's "Sign (optional)"
opens with a tap just above or below it.

## Deviations

- **Check corrections after the first RED run** (`red-first.txt`; the corrected check's RED is `red.txt`): (a) blanks-phone
  tapped 18 px above "Name" on the agreement, where the signature line above is nearer; the tap went to the signature (as a
  finger's tap goes to the nearest control in WebKit and Chromium), so the off-middle tap is now made on a side where the
  blank is the nearest field, and neighbours closer on both sides are tapped on their middle only (2 of 5); (b) the same
  rule for the signatures: on the agreement and the countersign view the point 20 px below the signature is the name line's,
  so the tap is made 20 px above; (c) Finish on the countersign view carries aria-disabled while the firm's signature is
  missing and the automation refused to press it: it is pressed where the browser's hit test finds it.
- bar-phone fails a control only when the bar covers it; controls under the page's own sticky header or signing guide are
  listed in NOTE lines (they are not the bar's doing).
- The sign-up page names the platform (the managed service offered there); the vendor search leaves that name out on that
  one page only; library, model and signing-vendor names and the forbidden word are searched everywhere.
- An onboarding step and the W-9 signing view show no preview bar (an investor's invitation never has one): bar-phone says
  so on those two screens instead of measuring a bar.
- Task 2's change and the check's later corrections are in `wip(06-35): save` commits (the save rule, mid-task), not in a
  separate `fix(06-35)` commit; the branch was not rewritten.
- A container restart killed one RED run; it was run again from the same tree.

## Commits (wip/06-35)

- `9856ea4` test(06-35): screen-edges check ... (red)
- `a7feb14` fix(06-35): on a phone the preview bar sits in the page's flow and covers nothing (failure 13)
- `2646ce3`, `b3c1fbd`, `fbcdc08` wip(06-35): save (the hint wraps at every size, phone-layout's named entry, check corrections, this summary)
- docs(06-35): this summary completed (the last commit)

## Self-Check: PASSED

screen-edges.js, console.css, esign.css, phone-layout.js changes present at HEAD; commits 9856ea4 and a7feb14 are ancestors of HEAD.
