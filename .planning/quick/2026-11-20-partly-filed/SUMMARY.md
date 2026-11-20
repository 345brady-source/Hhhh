# Quick fix: a state notice order with some states filed reads "Partly filed (n of m)"

**Not yet checked by the owner.**

## Failures and open items first
1. The first server test run failed 41 of 368 because the worktree had no server/node_modules. With the folder linked (as gate9.sh does), 368 of 368 pass.
2. The fix is in "wip(partly-filed): save" commits (36533e0, e3a26b9). One history rewrite (a soft reset) was refused on push. It was joined with a same-tree merge (fae2fc0) and never force-pushed.
3. The owner's preview has no server, so the partly filed screen is seen only in the check's screenshot until a filing server is hosted.
4. On a connected portal, "Still open: California." sits above the server's "Filed in New York.". Putting filed first may read better; that is the owner's call.

## What changed
- assets/js/bluesky.js: progress(), resultStatus() and orderStatus() added. resultStatus() gives 'partly-filed' while any ordered state has no result, 'filed' once all have one with a fee still open, and 'done' once every fee is known. recordResult sets the status through resultStatus.
- assets/js/filings-remote.js: a state order's status comes from its results, whatever the server says.
- assets/js/filings-ui.js: the order card shows the label and "Still open: ...".
- Checks: bluesky-math.js gains case `partly` (marker 6 to 7); `results` now expects partly-filed for one of two states, where it used to assert the bug. filings-server.js part `states` records New York first and requires "Partly filed (1 of 2)" with California open.

## RED (before the fix, on 0764991)
- BLUESKY MATH: FAIL (cases run: 7) - results, partly
- FILINGS SERVER: FAIL (parts run: 1) - states. The tab read "Filed" while the server held the order as received.

## Verify (on e3a26b9)
- BLUESKY MATH: PASS (cases run: 7), 74/0
- FILINGS MATH: PASS (cases run: 10), 187/0
- FORMD XML: PASS (cases run: 9), 270/0
- FILINGS SERVER: PASS (parts run: 7), 101/0
- BLUESKY FLOW: PASS (parts run: 4), 100/0
- Server tests: 368 pass, 0 fail.
- Full gate not run; the merged-tree gate covers it.
