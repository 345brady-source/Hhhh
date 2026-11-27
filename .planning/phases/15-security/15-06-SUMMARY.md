---
phase: 15-security
plan: 06
subsystem: server (workspace, pages)
tags: [security, workspace, encryption-at-rest, roles, masking, csp, security-txt]
status: complete
requires: [15-01, 15-03, 15-04, 15-05, 15-12, 15-13]
provides:
  - server/lib/workspace.mjs (createWorkspaces, SECTIONS, mask, get/put for 15-15)
  - GET/PUT /v1/workspace, GET/PUT/DELETE /v1/workspace/files/:id
  - lib/pages.mjs mounted (SERVE_PORTAL=1), GET /.well-known/security.txt, /health warnings
affects: [15-14, 15-15, 15-17, 15-18, 15-20, 13-03, 14-08, phase 16]
tech-stack:
  added: []
  patterns: [one sealed blob per version, section table with sub-key permissions, read projection and its inverse on save]
key-files:
  created:
    - server/lib/workspace.mjs
    - server/test/workspace.test.mjs
    - server/test/serve.test.mjs
    - .planning/phases/15-security/checks/sections.js
    - .planning/phases/15-security/checks/served-portal.js
  modified:
    - server/index.mjs
    - server/lib/roles.mjs
    - server/README.md
decisions:
  - "The workspace routes take people only: an account token or the shared API_TOKEN is refused 403 'This needs a person signed in.' even for a firm with no people (the section rules need a role and a session)"
  - "A first bank account on a new investor also needs pay and a fresh sign-in; 'Bank account changed' is logged only for an investor already stored"
  - "The firm's own originating bank details (tenant.ach routing, account, immediate origin, company id) and an offering's ACH company id are masked like investors' numbers and change only with pay and a fresh sign-in"
  - "A save that changes nothing stores no version and answers the current one"
  - "File names and types are sealed in the store; file blobs are wsf-<ws>-<sha256(fileId), 40 hex> because store.mjs blob keys allow no '.'"
  - "The Accountant's read of ws.team carries no emails; the other roles see their colleagues' emails"
metrics:
  completed: 2026-11-27
actuals:
  tokens: 24000
  tasks: 3
  commits: 11
plan_head_before: af0b7b95adf50f66c70a26af75430fd9e0bd746c
plan_head_after: 72c7a5e (the gate ran here; the SUMMARY commit follows it)
---

# Phase 15 Plan 06: Workspace on the server Summary

The firm's workspace is now held on the server, sealed with DATA_KEY, one blob per version (last 10), and every save is checked section by section against the person's role. Bank numbers are masked for roles without pay and change only with pay and a fresh sign-in. The change log only grows, files are sealed, and no full taxpayer number can be stored. The portal pages, security.txt and the /health warnings are mounted. Nothing here is ready for the owner until 15-17 moves the console onto these routes and the owner has checked it.

## Failures first

- Gate: no failure. The first run on 72c7a5e ended GATE_EXIT=0 with 99 GATE ok lines and no GATE FAIL.
- The text reader is not covered by the page policy in Chromium. I measured this with `--plant no-wasm`: the text reader still started and read the document after 'wasm-unsafe-eval' was taken out of the page's policy. Its worker takes no policy from the page, because the worker script is served without a CSP header. What fails without 'wasm-unsafe-eval' is WebAssembly compiled in the page itself, plus the header check and the violation count. So in Chromium, 'wasm-unsafe-eval' is not what lets the reader run. WebKit may treat workers differently, so this goes to the owner's iPhone check.
- 'versions' (test 2) passed already in the Task 2 RED run. Task 1 built versions and the ten-version limit, as the plan's Task 1 says. All other new tests failed first.
- 15-04 open item NOT closed: an invitation made with the shared token, for a workspace with no record, gives an investor sign-in with no firm rule and an empty issuer. The fix belongs in POST /v1/invite/login in server/lib/auth.mjs, which 15-14 owns in this wave and which this plan's diff gate keeps unchanged. It is recorded for 15-14. Nothing in this plan makes it worse: the workspace routes refuse tokens, and a session's workspace always has its record.

## RED (saved as produced)

Task 1, `O/red-1.txt` (tracer, before workspace.mjs existed):
```
not ok 1 - tracer
    + undefined
    - 'empty'
# tests 1
# pass 0
# fail 1
```
Task 2, `O/red-2.txt` (tests 2-9 and the check, before SECTIONS existed):
```
ok 1 - tracer
ok 2 - versions
not ok 3 - sections by role
not ok 4 - bank rule
not ok 5 - masking
not ok 6 - accountant
not ok 7 - log only grows
not ok 8 - files
not ok 9 - minimization
# tests 9
# pass 2
# fail 7
=== node sections.js
FAIL keys ran to the end :: TypeError: Cannot convert undefined or null to object
FAIL mask ran to the end :: TypeError: W.mask is not a function
SECTIONS: FAIL (cases run: 2) - keys, mask
=== node sections.js --case keys --without books
SECTIONS: FAIL (cases run: 1) - keys
```
After GREEN, `O/red-2-without-books.txt` (the case fails on a real table with one line dropped):
```
FAIL keys every key found (25) has a SECTIONS line :: books (books.js)
SECTIONS: FAIL (cases run: 1) - keys
```
Task 3, `O/red-3.txt` (before the mounting):
```
not ok 1 - served page        expected: 200  actual: 404
not ok 2 - security.txt route expected: 200  actual: 404
not ok 3 - health warnings    + undefined  - [ 'security.txt is not served: set SECURITY_CONTACT and SECURITY_TXT_EXPIRES.' ]
# tests 3
# pass 0
# fail 3
```
B3, `O/red-3-served-portal.txt` (`--plant no-wasm`):
```
FAIL chromium-desktop the policy allows WebAssembly ('wasm-unsafe-eval') and never 'unsafe-eval'
PASS chromium-desktop a document read: the text reader starts and reads the agreement's title
FAIL chromium-desktop WebAssembly compiles in the served page :: refused: WebAssembly.compile(): Compiling or instantiating WebAssembly module violates the following Content Security policy directive because 'unsafe-eval' is not an allowed source of script ...
FAIL chromium-desktop 0 securitypolicyviolation events :: ["script-src wasm-eval :3"]
(the same three FAILs for chromium-iphone)
SERVED PORTAL: FAIL (parts run: 2) - chromium-desktop, chromium-iphone
```

## Verify lines

Task 1 (`O/t1.txt`): `# tests 1` `# pass 1` `# fail 0`.
Task 2 (`O/t2.txt`, `O/sections.txt`): `# tests 9` `# pass 9` `# fail 0`; `SECTIONS: PASS (cases run: 2)`; marker `// gate: tests 9`.
Task 3: serve.test.mjs `# tests 3` all pass; full suite (`O/all.txt`):
```
# tests 556
# suites 0
# pass 556
# fail 0
```
556 = base 544 (measured at af0b7b9, `O/base-count.txt`) + 12 (workspace 9, serve 3).
SERVED PORTAL (`O/served-portal.txt`): every line PASS in both parts, `SERVED PORTAL: PASS (parts run: 2)`, after the line `NOTE WebKit not installed here: the owner's iPhone check covers the served portal under the policy (e-sign preview, document read)`.
`git diff --quiet af0b7b9 HEAD -- server/lib/auth.mjs assets diy.html portal.html index.html` → unchanged.

## Gate

`GATE_SERVER_TESTS=556 GATE_OUT=SCRATCH/exec-15-06 bash .planning/phases/15-security/checks/gate15.sh` ran on 72c7a5e, base commit af0b7b9. It was run by `SCRATCH/exec-15-06/verify3.sh`, which is the plan's Task 3 verify with wave 3 B1 applied: `rm -f $O/gate.txt` first, and `|| exit 1` after the `git diff --quiet ... index.html` step. The added grep `^GATE ok +SERVED PORTAL` is B3. It passed on the first run. The last lines of `O/gate.txt`, verbatim:
```
GATE ok   phase 13 checks: none in this tree
GATE ok   DATAROOM MODEL
GATE ok   INBOX MODEL
GATE ok   WATERMARK
GATE ok   ROLES TABLE
GATE ok   SECTIONS
GATE ok   SERVED PORTAL
GATE ok   TOTP FRAME
GATE_EXIT=0
```
It also printed `GATE ok   server tests 556 = base 544 + 12 declared`, then 99 `GATE ok` lines in all, no `GATE FAIL` and no base-change note. The reference gate (`O/gate/reference.txt`) ended `GATE_EXIT=0`. The verify printed `VERIFY3_OK`.

GATE_EXIT=0.

## Test counts

- Base at af0b7b9: 544 tests, all 544 pass (`O/base-all.txt`; `O/base-count.txt` = 544).
- This tree: 556 tests, all 556 pass, 0 fail. That is 544 + 12: server/test/workspace.test.mjs (`// gate: tests 9`) and server/test/serve.test.mjs (`// gate: tests 3`). GATE_SERVER_TESTS=556.
- Checks added: SECTIONS (node, 2 cases) and SERVED PORTAL (browser, 2 parts).

## The SECTIONS table as built (server/lib/workspace.mjs; later plans add lines only)

```
tenant           write configure, fields { ach: pay }, masked ach.odfiRouting ach.destinationRouting ach.immediateOrigin ach.companyId ach.offset.routing ach.offset.account
offerings        write configure, masked achOverride.companyId
integrations     write configure
invitationRules  write configure
amlProgram       write configure
esignTemplates   write configure
setup            write configure
investors        write operate, each { payment: pay }, masked payment.bank.routing payment.bank.account, read { personalFields: email phone address contact }
runs calls requests notices envelopes taxdocs taxDeposits books reports notifications invitations filings
coSignInCancel coSignInRetired coServerRetired v opsV       write operate
docs             write operate, read { personalItems: a doc whose cat is Identity or Verification }
achLog           write pay
audit            write operate, grow true
team             write server
```
What each line can hold:
- `write`: a permission, 'server' or 'never'.
- `read`: a permission, or { personalFields, personalItems }.
- `grow`: true, or a function (stored, next) → '' | a sentence.
- `fields` (object section) and `each` (array section, items paired by id): sub-keys that need their own permission.
- `masked`: paths shown as '****' and the last four digits to a role without pay.

A change that needs 'pay' also needs a sign-in in the last 10 minutes. A key with no line is refused (REFUSALS.never). 'invite' never has a line, so the console (15-17) must leave ws.invite out of a save.

The keys case found 25 keys, all with lines. It looked in three places: the four sample workspaces after NS.integrations.ensure; a new workspace after NS.integrations.ensure and NS.ops.ensure; and the keys that every script diy.html loads creates with the "make it when missing" idiom. Three keys are created only by scripts diy.html does not load yet. The check prints them as NOTE lines:
- `rooms` (dataroom.js) and `inbox` (inbox.js). The sample workspaces hold neither, so under the plan header's rule this plan did not add them. 14-08 adds both lines: write operate, read personal, and a grow function that keeps earlier messages and room events. grow takes `(stored, next) → '' | sentence`. 14-08 then runs `node .planning/phases/15-security/checks/sections.js`.
- `mailLog` (emails.js, 13-01). The plan that loads emails.js into the console adds its line.

## Routes 15-15 and 15-17 build on

- `GET /v1/workspace` → `{ version, ws }`. ws is mask(stored, role), and ws.team is the server's people `{ id, name, email, role, status, owner, endsOn }` (the Accountant gets no emails). Before the first save it answers 404 `{ code: 'empty' }`.
- `PUT /v1/workspace { version, ws }` → `{ version }`. Refusals:
  - 409 `version`: the save started from an older version.
  - 400 `tin`: a full taxpayer number.
  - 403 `section`: the role may not change that section (the REFUSALS sentence).
  - 403 `grow`: the change log would shrink or change.
  - 401 `fresh`: a pay change without a recent sign-in.
  - 403 `person`: a token instead of a person.

  The console sends back what it read, masked values included. The server restores the masked values and puts back, from the stored version, any fields or documents the role could not read.
- `GET|PUT|DELETE /v1/workspace/files/:id`, where the id is 1-120 letters, digits, '.', '_' or '-'.
  - PUT `{ name, type, base64 }` → `{ id, size, sha256 }`.
  - GET serves the file as an attachment with `Content-Security-Policy: default-src 'none'; sandbox` and nosniff.
  - DELETE needs `Content-Type: application/json` from the server's own origin, like every cookie write; the console sends `{}`.
- For 15-15: `server.workspaces.get(id)` → `{ ws, version } | null`, unmasked. `put(id, ws, version, person)` saves with no role check but keeps the version check and the taxpayer rule, and logs 'Workspace saved' and 'Bank account changed'.

## Deviations from plan

1. [Orchestrator rule] Fixtures. The plan named routing 500000005 and accounts 000123456789 and 000987654321. This run's rule requires routing prefix 19 and accounts starting 99, so the tests use:
   - routing 190000004 (prefix 19 is never issued; the check digit is valid);
   - accounts 990012346789, 990098764321 and 990055501234;
   - new values 190000017 and 990011112222;
   - taxpayer values 000-12-3456, 00-1234567 and 000123456, only in cases that must be refused.

   The masked values in the tests are therefore '****0004', '****6789' and '****4321'.
2. [Rule 3] The file blob key is `wsf-<ws>-<sha256(fileId), 40 hex>` instead of `wsf-<ws>-<fileId>`. store.mjs's BLOB_KEY refuses '.', and file ids may contain one.
3. [Rule 2] File names and types are sealed in the store (`workspaces:<id>:file:<fileId>`). Otherwise a file name like "Form_W-9_<investor>.pdf" would put an investor's name in store.json in plain text (T-15-42). The files test checks this.
4. [Rule 2] Files are served as attachments with `default-src 'none'; sandbox` and nosniff. The pages now share an origin with the API, so an uploaded HTML file must never run as a page.
5. [Rule 2] Masking also covers tenant.ach.immediateOrigin, tenant.ach.companyId and offerings[*].achOverride.companyId. The mask case found 10-digit runs in those fields in every sample.
6. [Rule 2] The taxpayer rule also covers `ein`, `itin`, `usTin` and `e8Owner<n>Tin` (onboarding.js's own secret field names), on top of the six the plan names.
7. [Rule 2] A role without 'operate' gets REFUSALS.operate for any change, even a change to a configure section. This matches the test's rule that Read-only and the Accountant get REFUSALS.operate for anything.
8. Interface: createWorkspaces takes no `team` argument. team.mjs exports no people list, and 15-14 owns team.mjs in this wave, so the module reads people through signin.people the same way team.mjs does. `purge` is not built, because nothing in the workspace expires: versions are trimmed at each save, and 15-20 deletes a closed portal.
9. Interface: createServer takes `opts.pages`. The SERVED PORTAL check uses it for `--plant`.
10. ROUTES: besides the five workspace lines, public lines were added for `/.well-known/security.txt`, `/`, `/portal.html`, `/security.html`, `/disclosure.html` and the `/assets` prefix. They document what is reachable before the guard; the guard reads only /v1/ lines.
11. GATE_OUT is O (`exec-15-06`), as the orchestrator set it, instead of the plan's O/gate.
12. README: two wordings that used the word the project rules forbid were changed: one in Security notes (an Authorization header example) and one in Investor invitations (the investor's name and details). The connector auth type name at line 179 is a value in code, so it was left as is.
13. SERVED PORTAL's e-sign preview step draws a one-page agreement with NS.esign.viewPdf, the same page-drawing code the e-sign preview and signing screens use. It does not click through the console's E-sign page: the served portal starts signed out, with no demo control.

## Decisions (owner may reverse)

- The last 10 versions are kept (C-04). A version blob's additional data is its key (15-03's rule). A saved 'team' is ignored, and a read gives the server's people.
- The workspace routes are for people only; tokens are refused.
- Adding a new investor with a bank account needs pay and a fresh sign-in. Staff can add an investor without bank details. This reaches 15-17: when Staff import an onboarding submission that carries a bank account, the save is refused until 15-15's pending flow (D-04) holds the investor's own account.
- I7: an Owner or Admin who changes a bank account with a fresh sign-in is the firm's own confirmation. Phase 16's pre-note rule still applies.
- A save that changes nothing stores nothing.

## For later plans

- 15-17: the first save after the move needs a sign-in in the last 10 minutes (pay plus fresh) if the workspace holds tenant.ach or investors' bank accounts. Run the move right after sign-in, or after `POST /v1/auth/confirm-password`. Leave ws.invite out of the save. /v1/workspace is not under the 60-writes-per-minute limit (it sits with the team routes, before the limiter).
- 15-18: cors() and PORTAL_ORIGIN for the served origin, unchanged here. Also decide whether worker scripts get a policy header of their own (Threat flags).
- 15-14: close the 15-04 open item above.
- The SECTIONS check runs on every gate. A new script in diy.html that creates a workspace key fails it until that key has a line.

## Threat flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: same-origin files | server/lib/workspace.mjs | Uploaded files are served from the portal's origin, so they go out as attachments with `default-src 'none'; sandbox` and nosniff (deviation 4). |
| threat_flag: worker policy | server/lib/pages.mjs (unchanged) | Scripts under assets/ are served without a policy header. A worker started from them (the text reader) runs under no policy in Chromium (measured with --plant no-wasm). |

## Known stubs

None.

## Guide lines (for .planning/GUIDE-PASS.md; no guide bytes written)

- Workspace on the server: in server mode the firm's data lives on the firm's server, encrypted, and the last 10 saved versions are kept. If two people save at once, the second sees "Someone else saved changes. Reload to see them."
- Bank accounts: only an Admin or the Owner can change an investor's or the firm's bank account, and only within 10 minutes of entering the password. Staff, Read-only and the Accountant see '****' and the last four digits.
- The Accountant sees no investor's email, phone, address or contact name, sees no identity or verification document, and cannot open a signed tax form.
- The change log can only grow. Nothing in it can be removed or edited.
- A full taxpayer number cannot be saved in the workspace. Only the last four digits are kept.

## State files

STATE.md, ROADMAP.md and REQUIREMENTS.md are not updated in this worktree. The orchestrator writes them when it merges, as for 15-04 and 15-05.

## Commits (wip/15-06)

- 8759db3 test(15-06): RED tracer
- 173af8f feat(15-06): the workspace held sealed on the server, one blob per version, last 10 kept
- 304116c test(15-06): RED sections by role, bank rule, masking, accountant, growing log, files, minimization; SECTIONS check
- df7a5ff feat(15-06): every save checked by role and section; bank numbers masked and protected; log only grows; files sealed; no full taxpayer number
- fec78de test(15-06): RED served page, security.txt route, health warnings
- 3cb3e9e feat(15-06): pages, security.txt and health warnings mounted; README Workspace on the server
- 537c0a4 wip(15-06): save served-portal check draft
- 4e84060 test(15-06): SERVED PORTAL check (B3)
- 3aa03ec fix(15-06): an offering's ACH company id masked without pay; a file of a workspace with nothing saved needs personal
- 72c7a5e wip(15-06): save SUMMARY draft before the gate
- this SUMMARY commit

## Self-Check: PASSED

The created files exist. Every commit above is an ancestor of HEAD. `git diff --quiet af0b7b9 HEAD -- server/lib/auth.mjs assets diy.html portal.html index.html` shows no change. The server/node_modules link was removed. The gate removed the base tree, the shots and checks-out, and the check's own output folders were deleted.
