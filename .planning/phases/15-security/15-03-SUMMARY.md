---
phase: 15-security
plan: 03
subsystem: server (keys, backups, store)
status: complete
tags: [security, encryption, key-rotation, backup, SE-10, SE-11]
requires: [15-01 (merged into this branch before the gate), 15-12 (auditlog shape)]
provides:
  - "vault: DATA_KEY_PREVIOUS comma list (a wrong entry named by position), sealed values carry \"a\", keyIds()"
  - "store: <file>.lock, lockedByOther(), holdLock(), close(), pending write flushed on exit, SIGTERM (exit 0), SIGINT (exit 130)"
  - "server/tools/reseal.mjs: all-or-nothing re-seal of every field and blob, people's emailIndex recomputed as auth.mjs computes it, audit:<ws>:<seq> convention"
  - "server/tools/backup.mjs: create, verify, restore, prune"
affects: [15-01 auth.mjs (comma list of previous keys, see open items), 15-11 (restore drill on the merged tree), every module that seals]
tech-stack:
  added: []
  patterns: ["a sealed blob's additional data is its own blob key (rule for every module)", "a sealed value names its additional data in \"a\""]
key-files:
  created: [server/tools/backup.mjs, server/tools/reseal.mjs, server/test/backup.test.mjs]
  modified: [server/lib/vault.mjs, server/lib/store.mjs, server/README.md, server/test/filings-edgar.test.mjs]
decisions:
  - "Archive header sealed with additional data cvb:-1:header (the id lives inside the header, so it cannot be bound into its own piece); data pieces use cvb:<id>:<n>:end|more as planned"
  - "verify's <bytes> is the restored plaintext size (store.json plus blobs); create prints the archive size"
  - "Records = entries of every object collection in store.json (arrays such as events and seen are not records)"
  - "Prune periods are calendar days, ISO weeks and months in UTC counted back from now"
  - "reseal holds the store lock while it runs and changes nothing if a server took the lock or the file changed meanwhile"
metrics:
  completed: 2026-11-27
actuals:
  tasks: 3
  commits: 11
  tests_added: 10
  server_tests: "482 = 472 (merged base 45e1783) + 10"
plan_head_before: a1338b462f5be391adca1a3056099d469a91dc2f
gate_base: 45e1783aab635650b58b5529ffd584425ea69547
---

# Phase 15 Plan 03: Keys and backups Summary

You can now rotate keys: `DATA_KEY_PREVIOUS` takes several old keys, and an all-or-nothing re-seal tool moves everything to the current key. Backups are sealed with their own `BACKUP_KEY` in 1 MiB authenticated pieces. They are checked piece by piece, restored only into an empty folder, and pruned to 7 daily, 4 weekly and 12 monthly copies. The store keeps its last write when the process exits and holds a lock that the tools respect. Nothing here is called ready. The restore drill on the merged tree belongs to plan 15-11, and the owner checks it after that.

## Failures first

1. Before the 15-01 merge, the first full gate run had 7 browser steps fail: FORMS FLOW, STATUS FLOW, SERVER MODE, TWO PERSONS, MEASURE, owner's folder and PHONE LAYOUT. The errors were "Target crashed", "browser has been closed", a Playwright internal assertion, and walkA reaching its 900 s limit while it waited for a shared browser slot. Several other agents' gates were running at the same time (load about 5 on 4 cores). When I reran into the same folder, every one of them passed (MEASURE: walkA 877 s, 13 PASS). Two gate runs then hit the 2-hour background limit while waiting for browser slots. I stopped the third myself when the coordinator asked for the 15-01 merge. That tree's gate never finished, so I claim no result for it.
2. I committed a draft SUMMARY while that first gate ran. The gate noted "the tree changed while step ... ran" and did not keep those steps. After that I left the tree alone during gate runs.
3. RED-2 showed tests 2-4 (changed byte, keys apart, restore refuses) already passing before Task 2's code existed. Their behaviour was built in Task 1's backup.mjs. Only tests 5-9 were red.
4. In RED-2, tests 7 and 8 failed because of a bug in the test itself: there is no `inbox` collection until lib/inbox.mjs makes it through store.data(). That run therefore did not show the missing feature for those two tests; RED-2b below does.
5. The first full suite after Task 2 failed one test outside this plan's files. `server/test/filings-edgar.test.mjs:436` checked the exact keys of a sealed box (`['data','iv','kid','tag','v']`), and the plan's new "a" field broke it. I fixed it with a one-line change (Deviation 2).
6. My first email-index formula did not match 15-01's auth.mjs: it was missing the `email:` label. Test 10 (RED-3) caught it: after the reseal, the real sign-in still could not find a person who had signed up under the old key. Fixed in bea4c42.

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

red-2b.txt (the fixed test run against the RED commit's code, ec342b8, extracted to a scratch copy):
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

red-3.txt (after the 15-01 merge: test 10 "reseal people sign in" added, and test 7's helper changed to 15-01's real index formula):
```
not ok 7 - reseal
    + '152c25cf413b09110c82433f49176ec195c0151414d73dc4d9ea4ffa3588317e'   (emailIndex differs from 15-01's)
not ok 10 - reseal people sign in
    found after the reseal with only the new key
    401 !== 200
# tests 10
# pass 8
# fail 2
```
Test 10's control assertion passed at RED: with the old key dropped and no reseal, the person is not found (401).

## Verify and gate lines

- Base suite at a1338b4: `# tests 422`, `# pass 422`, `# fail 0`.
- Task 1 verify: `# pass 1`, `# fail 0` -> VERIFY=0.
- Task 2 verify, before the merge: `# tests 9`, `# pass 9`, `# fail 0`, marker `// gate: tests 9` -> VERIFY=0. The file now holds 10 tests and its marker says 10.
- Full suite before the merge: `# tests 431` = 422 + 9, `# fail 0`.
- After merging origin/claude/refract-reskin (45e1783, which brings in 15-01): `node --test test/backup.test.mjs` gives `# tests 10`, `# pass 10`, `# fail 0`. The full suite gives `# tests 482`, `# pass 482`, `# fail 0` (472 + 10). The gate measured the base at 472 on its own ("base 472").
- Task 3 verify, run as the plan writes it with these changes:
  - Plan-check B2 applied: `rm -f $O/gate.txt` first, and `|| exit 1` before `mkdir -p $O/gate`.
  - Base 45e1783, `+ 10 declared`, GATE_SERVER_TESTS=482.
  - The gate is gate13.sh with every phase, because gate15.sh is not on the base.

  It ended `VERIFY3_EXIT=0` on the fourth run into the same folder; the earlier runs hit the time limit or were stopped, as described above. The gate's own lines, verbatim:
```
GATE ok   server tests 482
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   server tests 482 = base 472 + 10 declared
GATE ok   phase 13 checks: none in this tree
GATE_EXIT=0
```
  The gate printed 91 `GATE ok` lines and 0 `GATE FAIL` lines. These include every reference step (FORMS FLOW (34), STATUS FLOW (26), SERVER MODE (15), TWO PERSONS, MEASURE, owner's folder, CO-INVESTOR SERVER (5), ...), the phase 08-12 checks, and the signing and record comparisons against the base.

Measured on the 2.5 MiB test (test 1, run as child processes on this shared machine): the archive is 2,625,983 bytes for 2.5 MiB plus 3,000 bytes of sealed blobs and the store file. Across runs, create took 52-178 ms and verify took 45-136 ms.

## What was built

- **`server/lib/vault.mjs`**
  - `DATA_KEY_PREVIOUS` is a comma-separated list. A wrong entry gives `DATA_KEY_PREVIOUS entry <n> must be 32 random bytes, base64-encoded ...`, naming the position, never the value.
  - `seal()` adds `a`, the additional data (not secret). `open()` refuses a box whose `a` differs from the one asked for, with the integrity sentence.
  - `keyIds()` returns the current key id, then the previous ones.
  - Rule for every module: a sealed blob's additional data is its own blob key.
- **`server/lib/store.mjs`**
  - A file store writes `<file>.lock` ({ pid, startedAt }). It removes the lock on close or exit, if the lock still names this process.
  - New exports: `lockedByOther(file)`, `holdLock(file)` (used by reseal) and `close()`.
  - A pending debounced write is flushed on `exit`, on SIGTERM (then exit 0) and on SIGINT (then exit 130). The handlers are hooked once per process.
- **`server/tools/reseal.mjs`**
  - Refuses while a server holds the store.
  - Opens each sealed value by its `a`, or else by the first convention that opens it: `<id>:<field>`, `<kind>:<id>:<field>`, `<kind>:<id>:sealed` (inbox, taxdocs, rooms), `issuer:<id>:ccc`, `outbox:<id>`, `person:<id>:<field>`, `audit:<workspace>:<seq>`. Each sealed blob opens by its key.
  - Re-seals everything in memory, with the blobs going into a new folder. If any value matches no rule, it prints `Not re-sealed: <n> value(s) could not be opened (first: <collection>/<id>/<field>). Nothing was changed.` and exits 1.
  - Otherwise it renames everything into place and prints `resealed <collection>: <n>`, `resealed blobs: <n>` and `Done. ...`.
  - Recomputes each person's `emailIndex` under the new key, exactly as auth.mjs does.
  - 15-12's change log keeps verifying after a reseal: its chain hashes `dh` (the SHA-256 of the sealed plaintext), and the re-sealed plaintext is the same JSON.
- **`server/tools/backup.mjs`**
  - `create --out`: requires BACKUP_KEY and refuses it when it equals DATA_KEY or any previous key. Reads store.json, then each blob. If a blob is removed mid-read it stops with `Backup not made: blob <key> was removed while the backup was read (the server was writing). Run create again.` and exits 1, leaving no archive.
  - `verify`: opens every piece and checks every hash.
  - `restore --to`: writes only into an empty or new folder, and only after a first pass has opened and matched the whole archive.
  - `prune --dir --keep 7d,4w,12m [--dry-run]`.
- **`server/README.md`**: a new "## Keys and backups" section after "Data protection". It covers:
  - making and keeping both keys
  - rotation step by step, and the lock
  - daily backups with a script, a systemd service and timer, and a cron line
  - pruning and the restore drill
  - copying archives off the server: $0 to the operator's own computer, or the R2 and B2 free tiers, marked "check the provider's page"

## Tests added (+10, server/test/backup.test.mjs)

- **round trip**: create, verify and restore a sealed store; the restored copy opens with its own key.
- **changed byte**: a flipped byte, the last piece cut, two pieces swapped, a cut inside a piece, and a wrong key.
- **keys apart**: BACKUP_KEY missing, or equal to DATA_KEY or a previous key, is refused; no plain value is in the archive.
- **restore refuses**: a folder that is not empty is refused and left unchanged.
- **prune**: 400 archive names plus notes.txt, checked against an independent rule, and a dry run.
- **previous keys**: several old keys open their values; a 16-byte entry is named by position; a mismatched `a` is refused.
- **reseal**: every convention, k3 alone opens everything, emailIndex, blobs, and a hand-built 15-12 chain that still verifies. A value no rule opens changes nothing, byte for byte.
- **reseal refuses**: refused while a live process holds the store; runs once the lock is released.
- **flush on exit**: on exit, SIGTERM and SIGINT.
- **reseal people sign in**: 15-01's real sign-up under k1. Sign-in fails with k1 dropped and no reseal, and succeeds after the reseal. 15-12's real change log verifies and opens under k2 alone.

## Commits (all pushed to wip/15-03)

- dc62b30 test(15-03): RED round trip backup create, verify, restore
- 8cc291e feat(15-03): backup create, verify and restore sealed with BACKUP_KEY; store close()
- ec342b8 test(15-03): RED changed byte, keys apart, restore refuses, prune, previous keys, reseal, reseal refuses, flush on exit
- a739454 wip(15-03): save (vault, store, test fix)
- d53b4e2 feat(15-03): several previous keys, re-seal tool, store lock, flush on exit, prune
- 779ecfc wip(15-03): save (Task 3: README section and the filings-edgar line, saved before the long run)
- 4f3b17d wip(15-03): save (draft summary)
- d5c45e0 merge of origin/claude/refract-reskin (15-01)
- 357a945 test(15-03): RED a person indexed under the previous key signs in after reseal with it dropped
- bea4c42 fix(15-03): reseal recomputes emailIndex exactly as 15-01's auth.mjs does
- 142ee0d test(15-03): reseal people sign in also proves 15-12's real change log verifies and opens under the new key alone
- 0d891c8 test(15-03): reseal covers lib/dataroom.mjs's rooms:<id>:sealed records (merged after planning)

## Deviations from Plan

1. [Coordinator request] I added a 10th test, "reseal people sign in", and changed the marker to `// gate: tests 10`. The gate's declared delta is therefore +10, not the plan's +9. The gate base moved to 45e1783 (the merged 15-01), and the server count went from 472 to 482.
2. [Rule 3 - blocking] `server/test/filings-edgar.test.mjs:436` is not in files_modified. Its expected sealed-box keys now include `'a'`, a direct consequence of the plan's interface. Nothing else in that file changed.
3. [Rule 1 - bug in the test] RED-2's reseal tests created the `inbox` collection through store.put. lib/inbox.mjs creates it through store.data(), and the test now does the same.
4. [Rule 1 - bug] The emailIndex formula now matches 15-01's auth.mjs: the `email:` label, then NFKC, trim and lower case.
5. [Plan rule "a module that seals has merged since planning"] I covered and tested lib/dataroom.mjs's `rooms:<id>:sealed` (by the generic `<kind>:<id>:sealed` rule) and lib/auditlog.mjs's `audit:<ws>:<seq>`.
6. The archive header's additional data is `cvb:-1:header`; the plan did not specify it.
7. STATE.md and ROADMAP.md were not updated in this worktree. Plans in this wave run in parallel, so the orchestrator records progress when it merges.

## Open items

- `server/lib/auth.mjs` (15-01's file, not this plan's) derives the email-index keys from `DATA_KEY_PREVIOUS` as one string. With a comma list it uses only the first entry, because base64 decoding stops at the first `=` (I checked this with node). So between a rotation and the reseal, a person indexed under the second or an older previous key cannot sign in. The README tells the operator to put the newest old key first, and reseal re-indexes everyone. The fix is one line for auth.mjs's owner: split DATA_KEY_PREVIOUS on commas.
- store.mjs's SIGTERM handler exits as soon as it has flushed. A later graceful-shutdown handler in index.mjs has to be combined with it, or replace its exit.
- If the disk is full at exit, the flush throws inside the exit handler. The lock is still released, but the change is lost, as it was before this plan.
- The existing Security notes in server/README.md contain the phrase "a basic-auth `user:password`". This plan did not write it and changed nothing else in that file.
- The restore drill on the merged tree (start a server on a restored copy and open an invitation) belongs to 15-11, and the owner checks it.

## Threat Flags

None beyond the plan's threat model. No network endpoint was added. The tools read keys from the environment and print only counts and names; the tests assert that no key and no sealed value appear in their output.

## Self-Check: PASSED

server/tools/backup.mjs, server/tools/reseal.mjs and server/test/backup.test.mjs exist, and every commit listed above is an ancestor of HEAD (checked before the final commit).
