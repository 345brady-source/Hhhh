---
phase: 13-email-overhaul
plan: 03
status: in_progress
---

# Phase 13 Plan 03: send as the sponsor, sealed sent log, delivery events (draft, evidence as produced)

## Evidence so far

RED 1 (red-1.txt, mail-events.test.mjs tracer before any code):
```
not ok 1 - tracer
  expected: 200
  actual: 404
# pass 0
# fail 1
```
Verify 1 (t1.txt): `# tests 1` `# pass 1` `# fail 0`.

RED 2 (red-2.txt). Task 1's code already held Task 2's behaviors, so the RED is shown two ways:
```
# RED 2 a: mail-sender.test.mjs against the base commit 8efaa5c (no 13-03 code)
not ok 1 - held
ok 2 - single sponsor            (today's behavior, kept)
not ok 3 - suppressed
not ok 4 - attachments
not ok 5 - note screen
not ok 6 - sender routes
# pass 1
# fail 5
# RED 2 b: each test against the plan's code with its behavior removed
without held (falls back to MAIL_FROM)          -> not ok 1 - held
without the single-sponsor rule (always held)  -> not ok 2 - single sponsor
without the suppression check                  -> not ok 3 - suppressed
without the attachments refusal                -> not ok 4 - attachments
without the note screen                        -> not ok 5 - note screen
without the workspace pin on the sender routes -> not ok 6 - sender routes
without the configure line for PUT             -> not ok 6 - sender routes
(each run: # pass 5, # fail 1)
```
Verify 2 (t2.txt): `# tests 7` `# pass 7` `# fail 0`; marker `// gate: tests 6`.
