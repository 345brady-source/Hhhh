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

<!-- gsd:write-continue -->
