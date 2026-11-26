---
phase: 15-security
plan: 03
subsystem: server (keys, backups, store)
status: in-progress
tags: [security, encryption, key-rotation, backup, SE-10, SE-11]
requires: []
provides:
  - "vault: DATA_KEY_PREVIOUS comma list, sealed values carry \"a\", keyIds()"
  - "store: <file>.lock, lockedByOther(), holdLock(), close(), flush on exit/SIGTERM/SIGINT"
  - "server/tools/reseal.mjs (all-or-nothing re-seal, email index recomputed, audit:<ws>:<seq> convention)"
  - "server/tools/backup.mjs create, verify, restore, prune"
affects: [15-01 (emailIndex normalization), 15-12 (auditlog dh survives reseal), 15-11 (restore drill), every module that seals]
---

# Phase 15 Plan 03: Keys and backups Summary

Draft written while the gate runs; final lines are added when it ends.

## Failures first

- RED-2 shows tests 2-4 (changed byte, keys apart, restore refuses) already passing before Task 2's code: their behaviour (verify, refusals) was built in Task 1's backup.mjs. Only 5-9 were red.
- The first full-suite run after Task 2 failed 1 test outside this plan's files: `server/test/filings-edgar.test.mjs:436` asserted the exact keys of a sealed box (`['data','iv','kid','tag','v']`); the plan's new "a" field broke it. Fixed with a one-line change to `['a','data','iv','kid','tag','v']` (see Deviations).

## RED outputs (verbatim)

red-1.txt (Task 1, `node --test --test-name-pattern='round trip' test/backup.test.mjs`):
```
not ok 1 - round trip
  error: 'st.close is not a function'
# tests 1
# pass 0
# fail 1
```

red-2.txt (Task 2, `node --test test/backup.test.mjs`):
```
ok 1 - round trip
ok 2 - changed byte
ok 3 - keys apart
ok 4 - restore refuses
not ok 5 - prune
    Use: backup.mjs create --out <dir> | verify <file> | restore <file> --to <empty dir> | prune --dir <dir> --keep 7d,4w,12m [--dry-run]
not ok 6 - previous keys
  error: 'This record was encrypted with a different DATA_KEY. Set the key it was sealed with as DATA_KEY or DATA_KEY_PREVIOUS.'
not ok 7 - reseal
  error: "Cannot read properties of undefined (reading 'ixm_1')"
not ok 8 - reseal refuses
  error: "Cannot read properties of undefined (reading 'ixm_1')"
not ok 9 - flush on exit
  error: "ENOENT: no such file or directory, open '/tmp/cv-backup-slQyBk/a/store.json'"
# tests 9
# pass 4
# fail 5
```
7 and 8 failed there on a bug in the test itself (the store has no `inbox` collection until lib/inbox.mjs makes it through store.data(); the test now does the same), so that run did not show the missing feature for them. Re-run with the fixed test against the RED commit's code (ec342b8, extracted to a scratch copy), red-2b.txt:
```
not ok 1 - reseal
  error: |-
    node:internal/modules/cjs/loader:1433      (server/tools/reseal.mjs does not exist)
not ok 2 - reseal refuses
  error: |-
    The expression evaluated to a falsy value:
      assert.ok(existsSync(`${file}.lock`))
# tests 2
# pass 0
# fail 2
```

## Verify lines

- Task 1 verify: `# pass 1`, `# fail 0` -> VERIFY=0.
- Task 2 verify: `# tests 9`, `# pass 9`, `# fail 0`, marker `// gate: tests 9` -> VERIFY=0.
- Base server suite (a1338b4): `# tests 422`, `# pass 422`, `# fail 0`.

<!-- gsd:write-continue -->
