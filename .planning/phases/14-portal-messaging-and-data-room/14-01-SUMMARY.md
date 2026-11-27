---
phase: 14-portal-messaging-and-data-room
plan: 01
subsystem: messaging model (self-serve edition) and the phase 14 gate
status: complete
tags: [inbox, hash-chain, record-export, gate]
requires: [assets/js/audit.js (sha256, zip, log), assets/js/operations.js (recipientsOf), .planning/checks/gate-lib.sh, P13/checks/gate13.sh]
provides: [NS.inbox (assets/js/inbox.js), checks/inbox-model.js (11 cases), checks/gate14.sh (self-test 8)]
affects: [14-03, 14-04, 14-05, 14-06, 14-08, 14-09, 14-10, 14-11, 15-06]
tech-stack:
  added: []
  patterns: [append-only hash chain on audit.js entryText's recipe, part loader copied from taxdocs-ui.js, resumable gate steps]
key-files:
  created: [assets/js/inbox.js, .planning/phases/14-portal-messaging-and-data-room/checks/inbox-model.js, .planning/phases/14-portal-messaging-and-data-room/checks/gate14.sh]
  modified: []
decisions:
  - "Messages kept under one workspace key ws.inbox { v, threads, messages } (planner's choice, owner may reverse)"
  - "A file sent in a broadcast is written once in the record zip, under the first message carrying it (README says so); the plan's text reads one copy per message, which would put up to 25 MB times every recipient in browser memory"
  - "Record zip name carries the scope id: <firm>_messages_investor_<id>_<day>.zip / _offering_<id>_ / _all_"
  - "messages.csv cells starting with = + - @ ' tab or CR get one ' added (audit.js cellText's guard, widened to ' so the rule is reversible); README says to remove it before checking a hash"
metrics:
  completed: 2026-11-27
actuals:
  tokens: 27000
  tasks: 3
  commits: 8
plan_head_before: 864a799bfa0886be55286472f748478276f3ecb9
plan_head_after: the commit that adds this summary (HEAD of wip/14-01, 8 commits after the base)
---

# Phase 14 Plan 01: the inbox model and the phase gate gate14.sh Summary

NS.inbox: a message record that only grows. It holds threads per investor and offering, broadcasts, corrections and
read times. A SHA-256 chain over every message lets verify() name the first altered entry. Attachment and screening
rules follow C-17 and C-11, at most one notice per unread thread per hour (C-06), and a record zip carries its own
chain line and manifest. gate14.sh is the phase gate. Nothing is on screen yet: no page loads inbox.js until plan 14-04,
and nothing is ready until the owner has checked the finished pages.

Base commit: 864a799bfa0886be55286472f748478276f3ecb9 (contains 1b54700; the worktree was fresh, no other plan's commits).

## Failures first

1. **Gate run 1 (stopped at the 2-hour limit), GATE_EXIT=1.** Four reference-gate steps failed: SERVER MODE (15)
   (`page.click: Target crashed` in three parts), MEASURE (`walkA (900 s): individual: 0 PASS, 0 FAIL`), EMAIL DIALOG (3)
   (phone 390x844 frame: 7 of 11 paragraphs seen whole) and CO-INVESTOR SERVER (5) (two cosign-forged audit-line checks).
   The disk was at 100% (181 MB free) during that run. This plan changes no page, server file or script any page loads
   (`git diff --quiet 864a799 HEAD -- server diy.html portal.html index.html assets/js/console.js assets/js/portal.js` holds,
   and no page lists inbox.js). Run 2 reran the four steps on the same tree, with no change, and all four passed. I freed this
   run's own screenshots and page captures (368 MB, which the gate's finish step deletes anyway) before run 2.
2. **Gate run 2 also stopped at the time limit** (in phase 11, PDF OUT). **Run 3** into the same folder finished: GATE_EXIT=0.
3. The phase 13 checks folder holds only gate13.sh (no .js), so step 3 prints no line for phase 13. It prints neither
   "none in this tree" nor a check. gate13.sh behaves the same way for such a folder. Phase 13's checks are judged
   once they exist.
4. RED of Task 2: cases parts and selfcheck already passed at RED. The plan has Task 1 build the part loader, and
   selfcheck tests runParts' own flag rules. The other 8 new cases failed.

## Evidence

### Task 1 RED (SCRATCH/exec-14-01/red-1.txt)
```
FAIL thread ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a6ba32702e0d592fc/assets/js/inbox.js'
INBOX MODEL: FAIL (cases run: 1) - thread
```

### Task 1 verify (SCRATCH/exec-14-01/thread.txt; the plan's command, exit 0)
```
PASS thread NS.audit.verify(ws) is ok
PASS thread no change-log entry holds either body
INBOX MODEL: PASS (cases run: 1)
```

### Task 2 RED (SCRATCH/exec-14-01/red-2.txt)
```
FAIL chain ran to the end :: TypeError: I.correct is not a function
FAIL broadcast ran to the end :: TypeError: I.broadcast is not a function
FAIL correct ran to the end :: TypeError: I.correct is not a function
FAIL attach TYPES are the allow-lists per side
FAIL attach ran to the end :: TypeError: I.fileKind is not a function
FAIL screen ran to the end :: TypeError: Cannot read properties of undefined (reading 'map')
FAIL notice ran to the end :: TypeError: I.noticeDue is not a function
FAIL export ran to the end :: TypeError: I.broadcast is not a function
FAIL nodelete ran to the end :: TypeError: I.broadcast is not a function
INBOX MODEL: FAIL (cases run: 11) - chain, broadcast, correct, attach, screen, notice, export, nodelete
```

### Task 2 verify (SCRATCH/exec-14-01/model.txt; the plan's command, exit 0)
```
PASS selfcheck an empty list exits 1 with a FAIL line
PASS selfcheck there are eleven cases
INBOX MODEL: PASS (cases run: 11)
```
135 PASS lines, 0 FAIL.

Mutation probes (SCRATCH/exec-14-01/mutate.sh). Each probe edited inbox.js, ran one case, then restored the file. All 7
edits were caught by their case: the notice rule never blocking; the CSV formula guard removed; the hash comparison
removed from verify; the investor warning skipped; OOXML detection off; the broadcast log action renamed; the
correction side rule off.

The export case also follows the README's chain recipe from messages.csv alone, using node's own SHA-256 (not the
portal's). Every hash recomputes.

### Task 3 RED (SCRATCH/exec-14-01/red-3.txt): gate13.sh renamed, its GATE14_PHASES stand-in naming phase 13
```
SELF-TEST FAIL GATE14_PHASES naming a phase (13) whose check's last line differs
GATE14 SELF-TEST: FAIL - phases
    GATE FAIL GATE14_PHASES names "13" (allowed: 08 09 10 11 12, or the word none); no other phase was run
```

### Task 3 verify (SCRATCH/exec-14-01/verify3.out; the plan's command, exit 0)
```
SELF-TEST ok   GATE14_PHASES naming a phase (13) whose check's last line differs
GATE14 SELF-TEST: PASS (8)
# tests 408
# pass 408
# fail 0
VERIFY3_EXIT=0
```
The self-test also has one control that is not counted (plan-check W1). Rerunning into the same folder with the same
base keeps the passed steps. With another base it prints `GATE note: base commit changed; every step runs again` and
keeps nothing.

### Full gate14.sh run (GATE_OUT=SCRATCH/exec-14-01, GATE_SERVER_TESTS=408; run 3, SCRATCH/exec-14-01/gate14-run.txt)
Runs 1 and 2 are kept as gate14-run-1.txt and gate14-run-2.txt. Run 3's last lines:
```
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 408
# pass 408
# fail 0
GATE ok   server tests 408 = base 408 + 0 declared
GATE ok   REPORTS XLSX
GATE ok   INBOX MODEL
GATE_EXIT=0
```
0 GATE FAIL lines in run 3. 67 steps were kept from runs 1 and 2, which ran on the same tree. The reference gate passed
every step. Phases 08, 09, 10, 11 and 12 passed all their checks, and phase 14 ran INBOX MODEL. Server tests: 408 on the
base and 408 here, and this plan adds none. The gate removed the base tree, the screenshots, the checks' page captures
and the node_modules link it made.

## NS.inbox as built (plans 14-03, 14-04, 14-08, 14-09 and 14-10 rely on these)

- Storage: `ws.inbox = { v: 1, threads, messages }`; `ensure(ws)` fills only missing keys.
- Thread `{ id: 'th-<n>', party: { kind, id }, offeringId, roomId, createdAt }`. `threadFor(ws, party, offeringId, at)`
  finds or makes the thread. It refuses a party not in the workspace, an investor's offering thread with no position
  and a prospect thread for another offering. A prospect's room is found from `ws.rooms[].prospects`.
- Message `{ id: 'm-<n>', seq, threadId, from, author, at, body, attachments: [{ id, name, type, size, sha256 }],
  broadcastId, correctionOf, readAt, notice, prev, hash }`.
- `chainText(prev, m)` returns the joined text, and `hash = NS.audit.sha256(chainText(prev, m))` (W3: 14-03 compares both
  text and hash).
- `send(ws, { threadId, from, author, body, attachments, at, correctionOf, broadcastId, anyway })`. An attachment may
  carry `bytes`. Its kind, size and SHA-256 are then read from the bytes and the bytes are dropped. Without bytes it must
  carry `type` (or `kind`), `size` and a 64-hex `sha256`. The id must match `/^[\w.-]{1,120}$/`.
- Refusal sentences:
  - 'This conversation does not exist.'
  - 'A message is from the firm or from the investor.'
  - 'Name the person sending.'
  - 'Write a message or attach a file.'
  - 'A message can be at most 4,000 characters.'
  - the checkFiles sentences
  - '<name> could not be read. Attach it again.'
  - the screen sentences (an investor's is thrown with err.warn = true unless anyway is set)
  - 'A correction names an earlier message of the same conversation and the same side.'
- The change log gets 'Message sent' or 'Message received' (fund, record = message id, actor = author,
  'thread <id>; <n> attachment(s)'). For a party message, NS.invitations.notify is called when it exists.
- `correct`, `broadcast` (one 'Broadcast sent' entry; refusals 'Choose who receives the message.', 'Choose an
  offering.', 'No investors match this audience.'; every check runs before anything is written), `readBy`, `markRead`,
  `unread`, `noticeDue`, `setNotice` (statuses simulated, sent, outbox, held, failed, suppressed, off; an unknown one is
  refused), `verify`.
- `fileKind`, `checkFiles`, `screen`, `LIMITS`, `TYPES`, `PATTERNS`, `GENESIS`.
- `exportRecord(ws, { scope, id }, getBytes)`: refusals 'Choose an investor.', 'Choose an offering.' and 'Choose all
  messages, one investor or one offering.'. It logs 'Message record exported' with the scope, rows, files and the zip's
  SHA-256.
  - README.txt lists files not held in this browser, and files whose bytes no longer match their recorded SHA-256.
- `PARTS = Object.freeze([])` and `ready` (a Promise). The loader starts on DOMContentLoaded, or at once when the page
  has already loaded. NS.app.render() runs once when a part registered the view on screen, judged by NS.state.route or
  the address.
- The managed edition has no NS.inbox.

## Deviations from Plan

1. [Rule 2 - memory] A broadcast's file is written once in the record zip, not once per recipient (see decisions).
   Checked in case export. README.txt says so.
2. [Rule 2 - security] messages.csv guards formula cells, as audit.js cellText does, and also guards a leading `'`,
   so the rule can be undone. README.txt says how to undo it before checking a hash.
3. [Rule 2 - integrity] exportRecord compares each file's bytes with its recorded SHA-256 and lists any mismatch in
   README.txt.
4. The zip name carries the scope id (see decisions).
5. [Rule 3] In the check, fresh() calls NS.audit.ensureLog(ws), so cases can count change-log entries before the first
   message (found at the first RED run, before any code).
6. gate14.sh adds one control to the self-test, which is not counted: the W1 base-change rule. The count stays 8.

No package was installed. No page, server file, console.js or portal.js was touched. All fixtures use never-issued
numbers (000-12-3456, 00-1234567, 190000017, 99001234567).

## Commits (wip/14-01)

- 7fe2662 test(14-01): RED case thread of the inbox model check
- 7c826fb feat(14-01): NS.inbox threads, send, read times and the hash chain
- 5999935 test(14-01): RED cases chain to selfcheck of the inbox model check
- 803843a feat(14-01): broadcasts, corrections, attachments, screening, notices and the record export
- 5dcabf3 test(14-01): RED gate14.sh as gate13.sh renamed, its self-test naming phase 13
- 09d87df feat(14-01): gate14.sh, the phase 14 gate, with phase 13 among the other phases
- 2d173d7 wip(14-01): save (summary draft)
- this summary

## Self-Check: PASSED

The three created files exist. All seven commits above are ancestors of HEAD. The plan's three verify commands and
gate14.sh (GATE_EXIT=0) pass on this tree.
