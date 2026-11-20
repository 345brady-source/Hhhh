# Quick fix: walkthrough 3 items

**Not yet checked by the owner.**

## Failures and open points first
1. taxdocs-flow failed its first verify run (import-desktop): the check required all seven part files to be requested. It now requires the shipped parts and the absence of the two unbuilt ones. Rerun: PASS (14).
2. On the desktop, one "Signed in as" choice ("Team member · Harbor Ridge Capital") is still cut; the full name is in the menu's title. The check's "every choice fits" rule covers the phone only (stated in the check's header).
3. On the phone, the preview bar is about 191 px (was about 153 px), read off a screenshot. "Signed in as" now sits above its menu, so the whole name shows.
4. The commits are wip save commits without trailer lines.
5. Not tried: the "Add a connection" dialog X.

## What changed
- Tap areas: filings.css `.fl-detail a` and console.css (phone) `.cs-tbl td > a:not([class])` get the touch area pattern ("Open the answer sheet" 25 px; ACH offering links).
- Money: withholding.js money() prints like the portal's formatter ($5,000.00) in the foreign line's reason and the deposit's change-log line.
- "Signed in as": a title attribute in app.js demoHTML; on the phone the label stacks over the menu.
- Deliver: a refusal shows under the pressed button (taxdocs-ui.js); Telephone fields are rounded.
- tax1099-ui.js and taxlink.js are left out of the Tax parts list until 10-10 and 10-12 add them (comment, and a note in phase 10 deferred-items.md). No 404s.
- Filings: Form D, EDGAR access and State filings each open with an h1 heading (the names the help guide quotes).

## RED
WALK3 FIXES: FAIL (parts run: 9) on 4ebf319; then targets-phone, money and parts-load FAIL on 1a787ca after the check's own measurement faults were fixed.

## Verify
WALK3 FIXES: PASS (9); PHONE LAYOUT: PASS (8); SCREEN EDGES: PASS (5); FILINGS FLOW: PASS (9); ACCESS FLOW: PASS (4); TAXDOCS FLOW: PASS (14); DIST FLOW: PASS (7); TAXRECORD FLOW: PASS (5); TAX MATH: PASS (9); server tests 368 pass, 0 fail.
