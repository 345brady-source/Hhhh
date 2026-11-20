# Phase 6 Plan 35: screen edges (preview bar on the phone, desktop signing hint, signature and blanks on the phone) Summary

(Being written as the work runs; sections below are filled as results exist.)

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

<!-- gsd:write-continue -->
