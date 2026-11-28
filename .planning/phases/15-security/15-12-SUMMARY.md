---
phase: 15-security
plan: 12
subsystem: security (roles and the server change log)
status: complete
tags: [roles, permissions, audit-log, hash-chain, SE-05, SE-08]
requires: []
provides:
  - "assets/js/roles.js: NS.roles / module.exports ROLES, LABELS, LINES, PERMISSIONS, allows, permissionsOf, PAGES, DEFAULT_PAGES, pageAccess, REFUSALS"
  - "server/lib/roles.mjs: the same table through createRequire (15-05 adds ROUTES and guard())"
  - "server/lib/auditlog.mjs: createAuditLog({ store, vault, now }) -> append, list, verify, exportAll, removeWorkspace; SERVER, ZERO, entryId, aadOf, hashOf"
  - ".planning/phases/15-security/checks/roles-table.js: ROLES TABLE: PASS (cases run: 3)"
affects: [15-03, 15-05, 15-06, 15-07, 15-08, 15-16]
tech-stack:
  added: []
  patterns: ["UMD table shared by browser and server (as formd.js)", "per-workspace hash chain over dh, the SHA-256 of a salted sealed plaintext (15-CONTEXT B3)"]
key-files:
  created: [assets/js/roles.js, server/lib/roles.mjs, server/lib/auditlog.mjs, server/test/roles-table.test.mjs, server/test/auditlog.test.mjs, .planning/phases/15-security/checks/roles-table.js]
  modified: []
decisions:
  - "The chain hashes dh (SHA-256 of the sealed plaintext JSON, which carries a 16-byte random salt s), not the box; list and exportAll refuse an entry whose box does not open or does not hash to dh (B3)"
  - "PAGES also has rows for two sub-pages, console-offering (as Offerings) and console-envelope (as E-sign), so the default never gives Staff 'act' on a detail page whose list page is 'read', or the Accountant a page its list hides"
  - "The report builder (12-06) is the Investor reports tab of console-reports, not a view key; it reads the console-reports row (Accountant 'read'). console-books (11-13) has its own row"
  - "DEFAULT_PAGES is empty: every console page today has an explicit row"
  - "append refuses when the vault may not store personal data (no DATA_KEY outside test mode)"
metrics:
  completed: 2026-11-26
  tasks: 3
actuals:
  tokens: 10700
  tasks: 3
  commits: 5
plan_head_before: a1338b462f5be391adca1a3056099d469a91dc2f
plan_head_after: ecb45768cf50a8c87686bc33df577b8e12f25793
---

# Phase 15 Plan 12: one permission table and the server change log Summary

One role table (assets/js/roles.js) that the browser and the server both load, matching 15-RESEARCH 4.1-4.3 cell for cell, and a server change log that is append-only, hash-chained per workspace over salted digests of sealed details, with no cap; nothing is mounted or on screen yet (15-05, 15-07, 15-08 are the first users).

## Failures and open items (first)

- No test failed in the final runs. The full server suite is 434 = base 422 + 12, none failing.
- No gate was run: the plan's done criterion runs no gate ("No full gate: nothing is mounted and no page loads these files"), and gate15.sh is not on this base (15-02 builds it in parallel).
- The "keys" case checks the sample workspaces' team roles, but the four sample workspaces hold 0 team members today, so that line proves nothing yet about saved members; it proves today's self-serve keys (admin, team) are in ROLES.
- The report builder has no view key of its own (12-06 adds an 'investor' tab inside console-reports, shown when NS.app.can('operate')); W5 asked for a row "for the report-builder view key". The Accountant reads console-reports; whether the Accountant sees the Investor reports tab is decided by 12-06's own can('operate') test (today the Accountant has no operate), not by this table. Recorded for 15-08.
- Nothing here is called ready: no page loads roles.js and no route writes the change log until 15-05 and 15-07; the owner has not checked it.

## What was built

- assets/js/roles.js (IIFE, sets NS.roles in a page and module.exports in Node, touches nothing on load, every export frozen): ROLES owner, admin, team, readonly, accountant; LABELS Owner, Admin, Staff, Read-only, Accountant; LINES word for word from 4.1; the ten PERMISSIONS; allows() per 4.2 (investor only 'portal'; any other role, an inherited name such as 'constructor', or a capitalised key is false); PAGES per 4.3 plus console-books, console-offering, console-envelope and console-security; pageAccess() with the default owner/admin/team 'act', readonly 'read', accountant 'hidden', and 'hidden' for any unknown role; REFUSALS one sentence per permission plus 'never'.
- server/lib/roles.mjs: `export const { ... } = createRequire(import.meta.url)('../../assets/js/roles.js')`.
- server/lib/auditlog.mjs: entries `aud_<workspace>_<seq>` in collection 'auditlog' with { id, workspace, seq, at, personId, action, box, dh, prev, hash }; box = vault.seal({ s, personName, record, detail }, `audit:<workspace>:<seq>`); dh = sha256 hex of that plaintext's JSON; hash = sha256 hex of JSON.stringify([prev, workspace, seq, at, personId, action, dh]); prev of seq 1 = 64 zeros; head { id: workspace, seq, hash } in 'auditheads'. verify() needs no key and fails on an edited, removed, reordered or re-hashed entry, a head that does not match, or an entry beyond the head. Workspace must match /^[A-Za-z0-9][\w-]{0,119}$/ (15-01's ids are lower-case letters, digits and '-'); action 1-80 characters with no control characters or < >; person an object with a non-empty id (the request body is never read). For 15-03's reseal: the box carries no field the chain depends on, so re-sealing every box under a new key leaves verify() and the dh checks intact.

## RED outputs (as produced)

Task 1, O/red-1.txt (server/lib/roles.mjs did not exist):
```
not ok 1 - test/roles-table.test.mjs
# tests 1
# pass 0
# fail 1
```
Task 2, O/red-2.txt (list, exportAll and removeWorkspace did not exist; the table tests already passed because Task 1 wrote the whole table):
```
ok 1 - chain: three appends verify, each entry points at the previous hash, the first at 64 zeros
not ok 2 - tamper: an edited, removed, reordered or re-hashed entry fails verify at the first bad seq; a swapped box is refused on reading
not ok 3 - sealed: the store holds neither the detail nor the name; verify needs no key, reading does
not ok 4 - person only from the caller: no person, no action or a person given as text is refused; the stored id is the caller's
not ok 5 - per workspace: two chains are independent, list never mixes them, removeWorkspace removes one only
not ok 6 - not capped: 6,000 appends are all kept and the chain verifies
not ok 7 - export: oldest first and opened, head is the last hash and verified; list pages newest first
ok 8 - tracer: ...
ok 9 - matrix: ...  ok 10 - pages: ...  ok 11 - labels: ...  ok 12 - refusals: ...
# tests 12
# pass 6
# fail 6
```
Task 3, O/red-3.txt (`node checks/roles-table.js --case pages --without console-team`, exit 1):
```
FAIL pages every menu page has a row or is listed as taking the default :: console-team has no row and is not in DEFAULT_PAGES
FAIL pages every self-serve console page a script of diy.html registers (22) is covered :: console-team has no row and is not in DEFAULT_PAGES
ROLES TABLE: FAIL (cases run: 1) - pages
```
An unknown case: `FAIL unknown case name: nope (known: keys, pages, words)` / `ROLES TABLE: FAIL (cases run: 0) - unknown: nope`.

## Verify lines (verbatim)

- Task 1 (O/t1.txt): `# tests 1` `# pass 1` `# fail 0`
- Task 2 (O/t2.txt): `# tests 12` `# pass 12` `# fail 0`; markers `// gate: tests 5` and `// gate: tests 7`
- Task 3 (O/table.txt): `ROLES TABLE: PASS (cases run: 3)` (20 PASS lines, 0 FAIL)
- Full suite (O/all.txt): `# tests 434` `# pass 434` `# fail 0` (base O/base-all.txt: `# tests 422` `# pass 422` `# fail 0`)
- `git diff --quiet a1338b4 HEAD -- server/index.mjs diy.html portal.html index.html`: no change

## Menu pages

The plain run found no menu page the Task 2 table neither names nor lists: all 21 NAV keys of console.js (Tax documents included) and all 22 self-serve console pages the scripts of diy.html register have rows. Pages given rows beyond 4.3's list: console-books (11-13, W5; Accountant read), console-offering (one offering, as Offerings), console-envelope (one envelope, as E-sign). Pages left on the default: none (DEFAULT_PAGES is empty).

## Tests added

+12 server tests: roles-table.test.mjs 5 (tracer, matrix, pages, labels, refusals), auditlog.test.mjs 7 (chain, tamper, sealed, person only from the caller, per workspace, not capped, export). The check roles-table.js has 3 cases.

## Commits

- 6260795 test(15-12): RED tracer
- 147a562 feat(15-12): one role table for browser and server, and a hash-chained server change log
- 7eb8d3c test(15-12): RED matrix, pages, labels, refusals and the change log tests
- f57199a feat(15-12): change log list, export and workspace removal, each entry checked against its dh
- ecb4576 test(15-12): ROLES TABLE check with --without

## Deviations from Plan

1. [15-CONTEXT B3, applied as instructed] The chain hashes dh, not the box (the plan's interfaces block and key_links still say "the chain hashes the sealed box"). Stored entries gain `dh`; the sealed plaintext gains the salt `s`. The tamper test adds two swapped-box cases (a box from another entry, refused by its additional data; a box sealed correctly for the same seq with other content, refused by dh), plus a re-hashed edit (brokenAt 3) and an edited dh (brokenAt 1).
2. [15-CONTEXT W5, applied] DEFAULT_PAGES is exported and the check reads it instead of the summary; console-books has a row. The report builder has no view key (see open items).
3. [Rule 2, T-15-21] Rows for console-offering and console-envelope, so their default does not exceed their list page for Staff or the Accountant.
4. [Rule 2] The "pages" case also covers every self-serve console page registered by a script of diy.html (read from the scripts' text, because the scripts after operations.js need a real browser to load in Node), not only the NAV; the "keys" case also proves the page's copy and Node's copy are the same table with the same allows() grid.
5. exportAll returns `brokenAt` beside `verified`, and throws (500, "Change log entry N failed its check and was not read.") when a box fails, as list does, rather than exporting an entry it cannot vouch for.
6. STATE.md and ROADMAP.md were not updated: this plan runs in a parallel wave in its own worktree and its files_modified do not include them; the orchestrator records it at merge.

## Threat surface

No new surface beyond the plan's threat model: nothing is mounted and no page loads these files.

## Self-Check: PASSED

All six created files exist at HEAD ecb4576; commits 6260795, 147a562, 7eb8d3c, f57199a, ecb4576 are ancestors of HEAD; server/node_modules link removed.
