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
  commits: 10
plan_head_before: af0b7b95adf50f66c70a26af75430fd9e0bd746c
---

# Phase 15 Plan 06: Workspace on the server Summary

The firm's workspace is now held on the server, sealed with DATA_KEY, one blob per version (last 10), and every save is checked section by section against the person's role. Bank numbers are masked for roles without pay and change only with pay and a fresh sign-in. The change log only grows, files are sealed, and no full taxpayer number can be stored. The portal pages, security.txt and the /health warnings are mounted. Nothing here is ready for the owner until 15-17 moves the console onto these routes and the owner has checked it.

## Failures first

- GATE: see "Gate" below (filled in when the run ends).
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

(filled in when the run ends)

<!-- gsd:write-continue -->
