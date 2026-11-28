---
phase: 15-security
plan: 13
subsystem: server
tags: [security, csp, same-origin, security-txt, rfc9116]
status: complete
requires: []
provides:
  - "server/lib/pages.mjs: createPages({ env, root, now }) -> { enabled, has, serve, policy, origins, securityTxt, health }; buildSecurityTxt; outsideOrigins; INJECTED_SCRIPT"
affects:
  - "15-06 (mounts pages.serve before the API routes, /.well-known/security.txt, /health warnings)"
  - "15-10 (buildSecurityTxt for the static file)"
tech-stack:
  added: []
  patterns: ["fixed exact-path file list built at start-up", "CSP computed from the served files (inline-script hashes, outside origins by use)"]
key-files:
  created: [server/lib/pages.mjs, server/test/pages.test.mjs]
  modified: []
decisions:
  - "script-src carries 'wasm-unsafe-eval' (plan-check B4), never 'unsafe-eval'"
  - "fonts.gstatic.com is added to font-src only because fonts.googleapis.com is a style source (Google's stylesheets name their font files there); no other host is typed"
  - "every served answer also carries Cross-Origin-Resource-Policy: same-site and, when PUBLIC_URL is https, Strict-Transport-Security: max-age=31536000 (research 5.5 Headers row)"
  - "the outside-hosts test fails on any host outside cdnjs, jsdelivr and Google Fonts, so a new outside host is a decision, not an accident"
metrics:
  completed: 2026-11-26
  tasks: 3
  files: 2
estimate:
  tokens: 75000
actuals:
  tokens: 8660
  tasks: 3
  commits: 4
plan_head_before: a1338b462f5be391adca1a3056099d469a91dc2f
plan_head_after: eab218c21346f4c8bee8f98ede18578e66f6f056
---

# Phase 15 Plan 13: the server serves the portal pages, with security headers and the content security policy - Summary

With SERVE_PORTAL=1 the server answers portal.html (at / and /portal.html), security.html and disclosure.html when they exist, and the files under assets/ with a listed extension, from a fixed exact-path list read at start-up; every page gets the sign-in config script and a content security policy that hashes every inline script and names only the outside hosts the files really load from; security.txt is built from the settings or refused. The module is not mounted yet (15-06 mounts it). Nothing here has been checked by the owner.

## Failures and limits first

- **One test failure during GREEN (fixed in the test, not the code):** the fixed-list test first expected `//portal.html` to answer 404 over HTTP; it answered 200. Cause: the test server (like server/index.mjs) parses paths with `new URL(req.url, 'http://localhost')`, which reads `//portal.html` as a host and asks for `/`, the portal page itself. No file outside the list is reachable through it. The test now checks `//portal.html` on `has()` only (not listed) and keeps every other path on both `has()` and HTTP.
- **One mutation check did not fail:** removing the "skip symlinks" line in the folder walk leaves the tests passing, because `readdir` file types already report a symlink as neither file nor folder, so the walk never follows one either way. The property (a symlink is never listed) is tested and holds; that line is redundant safety. The other two mutations were caught: reading without O_NOFOLLOW fails "fixed list" (a listed file swapped for a symlink after start-up would be served), and dropping 'wasm-unsafe-eval' fails "headers".
- **Browser check is load-only (W6 for 15-06 still open):** Chromium opened the served portal.html under the policy with 0 `securitypolicyviolation` events and 0 page errors at load. E-sign preview, a document read, and WebKit were **not** run here; 15-06's gate run must still do those (W6).
- **`signInServer` is injected but no page script reads it yet** (grep of assets/js finds no reader); `demo:false` is read by assets/js/app.js:414. The page still shows its sign-up screen; wiring the sign-in server flag into the pages belongs to the later sign-in plans.
- **The policy is computed at start-up.** A page changed on disk while the server runs keeps the old inline-script hashes until restart (a deploy restarts the server).
- **The DejaVu font fallback fetch is refused by connect-src 'self'.** esign.js loads the shipped copy (assets/vendor/textfont) first and fetches cdn.jsdelivr.net only when that fails; on served pages the shipped copy is same-origin, so the fallback should never be needed, but if it were, the policy refuses it.
- No gate run: the plan's Task 3 says no full gate (the module is not mounted). gate15.sh was not needed.

## RED evidence

Task 1, `O/red-1.txt` (pages.mjs absent):
```
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/Hhhh/.claude/worktrees/agent-a75a58492117a217d/server/lib/pages.mjs' imported from /home/user/Hhhh/.claude/worktrees/agent-a75a58492117a217d/server/test/pages.test.mjs
not ok 1 - test/pages.test.mjs
# tests 1
# pass 0
# fail 1
```
Task 2, `O/red-2.txt` (buildSecurityTxt, securityTxt and health absent):
```
# SyntaxError: The requested module '../lib/pages.mjs' does not provide an export named 'buildSecurityTxt'
not ok 1 - test/pages.test.mjs
# tests 1
# pass 0
# fail 1
```

## Verify lines (verbatim)

Task 1 (`O/t1.txt`):
```
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 307.220364
VERIFY1_OK
```
Tracer feedback gate: verify re-run end-to-end and passed before expanding.

Task 2 (`O/t2.txt`):
```
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 616.650564
VERIFY2_OK
```

Task 3 (`O/all.txt`, full server suite):
```
# tests 429
# suites 0
# pass 429
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 19713.184896
```
`git diff --quiet a1338b4 HEAD -- server/index.mjs portal.html diy.html index.html assets` -> PAGES_UNCHANGED; VERIFY3_OK.

## Test counts

- Base (a1338b4): 422 tests, 422 pass (`O/base-count.txt` = 422, `O/base-suite.txt`).
- After: 429 tests, 429 pass, 0 fail = base + 7 (pages.test.mjs, first line `// gate: tests 7`).

## Browser check (Chromium, `O/chromium.txt`, script `O/csp-chromium.mjs`)

```
status 200
violations at load 0 []
console CSP lines at load 0 []
page errors 0 []
CVPortalConfig {"signInServer":true,"demo":false,"integrationServers":["http://127.0.0.1:38551"]}
probe {"wasm":"compiled","eval":"refused","inline":"refused"}
violations after probe (eval + inline script expected) 2 ["script-src eval :11","script-src-elem inline :18"]
not served (404) 0 []
```
WebAssembly compiles under the policy, `eval` and an unhashed inline script are refused, and every file the page asked for at load was on the list.

## The policy as built (from the files at a1338b4)

```
default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-rOW/wgNmq/SrvrcJjWuAPm9IzYLQ60XCVzFbCIKVv98=' 'sha256-7/9CrIANcuJso3n4ZUKMM34fLk6D7ZmjOd5xL4Yigmk=' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob: https://cdnjs.cloudflare.com; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'
```
The two hashes are the injected config script and portal.html's own `window.CVPortalEdition = 'selfserve';`.

## Outside hosts and where each comes from

| Host | Directives | Loaded from |
|------|-----------|-------------|
| https://cdnjs.cloudflare.com | script-src, worker-src | assets/js/esign.js:25-27 (pdf-lib, pdf.js, pdf.js worker) and assets/js/intake.js:20-26 (pdf.js, its worker, jszip, pdf-lib); fallbacks after the shipped copies in assets/vendor |
| https://cdn.jsdelivr.net | script-src, font-src | assets/js/esign.js:30 (fontkit script) and :31 (DejaVu .ttf, fetched; fallback after assets/vendor/textfont) |
| https://fonts.googleapis.com | style-src | portal.html:10 (stylesheet), assets/js/brand.js:128-166 (theme fonts), assets/js/signature.js:41 (signature faces) |
| https://fonts.gstatic.com | font-src | the font files Google's stylesheets name (portal.html:9 preconnects to it); added only because fonts.googleapis.com is a style source |

Not sources and not in the policy: www.irs.gov (tax1099-data.js, tax1099-ui.js page links), verify.yourfirm.example and verify.vendor.example (integrations.js placeholders).

## Deviations from Plan

1. **[Rule 2 - security] Headers from research 5.5 added on served answers:** `Cross-Origin-Resource-Policy: same-site` always and `Strict-Transport-Security: max-age=31536000` when PUBLIC_URL is https (the "headers" test asserts HSTS present on https and absent on http). Files: server/lib/pages.mjs. Commit 9d1a594.
2. **[Rule 2 - security] Files are opened with O_NOFOLLOW**, so a listed file replaced by a symlink after start-up answers 404; the fixed-list test covers it. Commit 9d1a594.
3. **[Rule 2 - security] security.txt refuses a contact with a line break or space** (it could add lines to the file); `buildSecurityTxt` takes an optional `now` (default Date.now()) so the 15-10 tool can never write an expired file. Expires is written as `YYYY-MM-DDTHH:MM:SSZ`. Commit eab218c.
4. **[Plan-check B4] 'wasm-unsafe-eval' in script-src**; the headers test asserts it present and the `'unsafe-eval'` token absent.
5. **Additions to the interface:** `origins()` (the outside origins by use, for the tests and this summary), and the exports `outsideOrigins` and `INJECTED_SCRIPT`.
6. **Health warning "security.txt is not served"** is given whenever security.txt would answer 404 because of the contact or the date (unset, invalid, or past), not only when SECURITY_CONTACT is unset; a past date gives this sentence instead of "expires on <date>".
7. **Test addition:** the outside-hosts test also fails if the policy names any host outside cdnjs, jsdelivr and Google Fonts.

## Known Stubs

None in the plan's files. `signInServer: true` is injected for later plans to read (see Failures and limits).

## Threat Flags

None beyond the plan's threat register (T-15-25..28 mitigated and tested; T-15-SC: no package installed).

## Commits

- e7d6297 test(15-13): RED tracer
- 9d1a594 feat(15-13): fixed list, serve, policy
- 8e66133 test(15-13): RED tests 2-7
- eab218c feat(15-13): security.txt and health warnings

## Self-Check: PASSED

- FOUND: server/lib/pages.mjs, server/test/pages.test.mjs
- FOUND (ancestors of HEAD): e7d6297, 9d1a594, 8e66133, eab218c
- server/index.mjs, portal.html, diy.html, index.html, assets/: unchanged from a1338b4
