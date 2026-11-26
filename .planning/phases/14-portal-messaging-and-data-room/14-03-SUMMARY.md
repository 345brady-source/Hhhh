# Phase 14 Plan 03: the server inbox module - Summary (in progress)

Evidence is pasted here as it is produced (SAVE-RULES rule 5). Base commit 864a799bfa0886be55286472f748478276f3ecb9; base server suite: `# tests 408`, `# fail 0`.

## Task 1 (tracer)

RED (red-1.txt, server/lib/inbox.mjs did not exist):
```
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../server/lib/inbox.mjs' imported from .../server/test/inbox.test.mjs
not ok 1 - test/inbox.test.mjs
# tests 1
# pass 0
# fail 1
```

Verify (Task 1 command, verbatim tail):
```
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 239.759823
VERIFY1_EXIT=0
```
## Task 2 (scope, workspaces, sealed, attachments, types, screen)

RED (red-2.txt). Three of the six new tests failed; three passed on first run, because the tracer's code (Task 1) already
pinned every query to the context and sealed every field, which could not be left out of a tracer that stores investor
data. Reported as it happened, not hidden:
```
ok 1 - tracer: ...
ok 2 - scope: an investor sees only their own threads, messages and files; a prospect is kept apart from investors
ok 3 - workspaces: every query is pinned to the context workspace; a workspace or party in a query or body changes nothing
ok 4 - sealed: the store and its blobs hold no body, author, file name, name, email or firm address
not ok 5 - attachments: 10 MB each, 5 files, 25 MB together, strict base64; a refusal stores nothing
    201 !== 413
not ok 6 - types: the kind is read from the first bytes; investors send PDF, PNG or JPEG, the firm also XLSX, CSV or DOCX
    Expected values to be strictly deep-equal
not ok 7 - screen: the firm is refused bank, taxpayer and password shapes; an investor is warned and may send anyway
    201 !== 422
# tests 7
# pass 4
# fail 3
```

Verify (Task 2 command, verbatim tail):
```
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1563.731477
VERIFY2_EXIT=0
```
## Task 3 (broadcast, updates, chain, notices, prefs, nodelete, limits)

RED (red-3.txt). Four of the seven new tests failed; chain, notices and nodelete passed on first run because the tracer's
code already had the chain, the notice coalescing and the 405 answers (the tracer needed a notice decision and a chain to
pass its own verify; the 405 branch is the fall-through of each router). Reported as it happened:
```
not ok 8 - broadcast: one send to three investors, one copy each with its own files; a repeated clientId stores nothing new
    (the repeated clientId stored a second broadcast: deep-equal failed)
not ok 9 - updates: every investor message, read and notice comes back once, in order, across since values; more when cut at 500
    501 !== 500
ok 10 - chain: the browser recipe; a re-sealed body or a changed time names that message
ok 11 - notices: one per unread thread per hour; again after a read or after an hour; a failing notify still stores
not ok 12 - prefs: an investor turns notices off and on; the sponsor sending again keeps the choice
    405 !== 200
ok 13 - nodelete: no route removes or changes a record; the module never calls a store removal
not ok 14 - limits: 4,000 characters, request and small-call caps, the rate limit on every POST; nothing written to the console
    201 !== 422
# tests 14
# pass 10
# fail 4
```
<!-- gsd:write-continue -->
