---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 30
subsystem: tax forms (taxforms.js), signing fonts (esign.js), shipped data files
status: complete
tags: [tax-forms, w-9, w-8ben, w-8ben-e, sandboxed-iframe, csp, owner-report, preview]
requires: [06-29]
provides:
  - "the three official forms shipped as a script (assets/forms/forms-data.js), loaded on the first form built; the pin is still checked on the decoded bytes"
  - "the Unicode font, regular and bold, shipped as scripts (assets/vendor/textfont/text-regular.js, text-bold.js) with its license"
  - "no fetch()/XHR anywhere on the tax-form or signing path in the preview (fetch kept only as a fallback when a shipped script cannot load)"
  - "checks/no-network.js (3 parts, 30 checks) and checks/embed-data.js (writes and verifies the data files)"
affects: [owner check, preview publishing (new files below), phase 6 verification]
tech-stack:
  added: []
  patterns:
    - "binary assets the preview needs ship as base64 scripts loaded on demand beside the loader's own script; fetch only as fallback"
key-files:
  created:
    - assets/forms/forms-data.js
    - assets/vendor/textfont/DejaVuSans.ttf
    - assets/vendor/textfont/DejaVuSans-Bold.ttf
    - assets/vendor/textfont/LICENSE-font.txt
    - assets/vendor/textfont/SHA256SUMS
    - assets/vendor/textfont/SOURCE.txt
    - assets/vendor/textfont/text-regular.js
    - assets/vendor/textfont/text-bold.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/no-network.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/embed-data.js
  modified:
    - assets/js/taxforms.js
    - assets/js/esign.js
decisions:
  - "The data scripts are loaded on demand (the first tax form built, the first Unicode text written), not by a static tag: the three pages do not download 2.6 MB on every visit. The address is taken beside the loading script's own file, so diy.html, index.html and portal.html all resolve it the same way. No HTML page changed."
  - "One forms script for all three forms (698 KB) as the brief named it; the fonts are two scripts so the regular weight alone is loaded when only the tax form is filled."
  - "The fonts came from the npm registry tarball of dejavu-fonts-ttf 2.37.3 (integrity sha512 matched), the same package jsdelivr serves at the old address; cdn.jsdelivr.net is refused by this session's network (403)."
requirements: []
metrics:
  duration: "29 min, from recording the base (08:16:36 UTC) to the summary (08:45:38 UTC)"
  completed: 2026-11-16
  tasks: 3
  files: 12
actuals:
  tokens: 5800    # chars/4 over the added lines of the code, checks and notes (about 23,200 characters); the generated base64 files and the font files are not counted
  tasks: 3
  commits: 3      # git rev-list --count 76dd943..HEAD before this summary commit
plan_head_before: 76dd943282fd6920b2dc83e66797dc0c1c0b8066
plan_head_after: 05dacf1791a6294c2c12b1f7e0feca61ae0b4fbd
---

# Phase 6 Plan 30: the tax forms build with no fetch, so "Failed to fetch" is gone in the preview

The owner reported: "it says failed to fetch when trying to go to the tax form, where it says its been pre filled the screen doesent work, error message failed to fetch". I reproduced it exactly. I loaded the portal in a sandboxed frame whose content security policy refuses every fetch, and pressed "Continue to the form": the screen showed "Failed to fetch" for the W-9, the W-8BEN and the W-8BEN-E. With this plan the same check opens the filled form, signs it and finishes it for all three, with no fetch attempted. The owner has not checked this in the published preview, so it is not ready until he has.

## Failures first

1. **cdn.jsdelivr.net is refused from this machine (403 from the network gateway).** The brief said it was reachable. I took the font files from the npm registry tarball of the same package and version that jsdelivr serves at the old address (dejavu-fonts-ttf 2.37.3). Its sha512 matched the registry's published integrity value. Both files are byte-identical to the copies the checks have always served for that address (SHA-256 7da195a7… regular, e6476c1b… bold).
2. **My first GREEN run failed 6 checks because of a mistake in my check.** I expected the embedded font to be named `/DejaVuSans`, but the PDF writer names a subset `/DejaVuSans-2163`. The forms were filled and signed correctly in that run (the fonts were present). I fixed the pattern, ran GREEN again (30 PASS, 0 FAIL), then ran RED again on the base with the final check: 12 PASS, 15 FAIL, the same "Failed to fetch".
3. **Not tested:** the real claude.ai artifact host. My frame uses the policy the brief gave (`connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:`). If the host's real policy differs in some other way (for example, it refuses same-origin scripts added after the page loads), only the published preview will show it. The new files below must be published for this to work.
4. **Not tested:** WebKit/Safari, phones. The check runs at 1280x800 in Chromium.

## What changed

1. **The official forms (taxforms.js).**
   - **Before:** `prepare` fetched `assets/forms/<form>.pdf`. The preview refuses fetch, so the step showed "Failed to fetch".
   - **Now:** the form's bytes come from `assets/forms/forms-data.js`. That script holds the three pinned PDFs in base64, keyed by the map's file path. It is loaded on the first form built, from beside taxforms.js.
   - The SHA-256 pin is still checked on the decoded bytes before anything is filled (`fill`, step 1, unchanged).
   - The file is fetched only if that script cannot load. If that also fails, the investor sees "This tax form could not be loaded. Check the connection and try again." instead of the raw "Failed to fetch".
2. **The Unicode font (esign.js).**
   - **Before:** `unicodeFont` (used to fill the tax forms) and `fontsFor` (used to stamp a non-Latin-1 name on any signed document and its certificate) fetched DejaVu Sans from the CDN.
   - **Now:** the font comes from `assets/vendor/textfont/text-regular.js` and `text-bold.js`, loaded on first use from beside esign.js. The CDN address remains only as a fallback.
   - Before this change, `fontsFor` failed silently in the preview: names such as Łukasz were drawn as pictures. They now print as real text in the embedded font. The check confirms DejaVuSans and DejaVuSans-Bold in every signed copy.
   - fontkit still loads by script tag from jsdelivr, unchanged.
3. **The data files are generated, not hand-made.** `checks/embed-data.js` reads the three forms (each checked against taxmaps.js and assets/forms/SHA256SUMS) and the two fonts (checked against assets/vendor/textfont/SHA256SUMS), then writes the three scripts. With `--verify` it runs each script as the browser would and requires every entry to decode to exactly its pinned source. This step is in the gate.
4. **Font license.** `assets/vendor/textfont/LICENSE-font.txt` is the package's own LICENSE (Bitstream Vera, Arev, DejaVu public-domain changes), beside the unmodified font files. SOURCE.txt records where they came from.

## Other fetch()/XHR in assets/js (item 3 of the brief)

None of these is on the tax or signing path in the preview. Each one runs only when a server is configured:

| File:line | What it is | When it runs |
|---|---|---|
| integrations.js:299 `api()` | the integration server (identity, accreditation, OFAC, email) | only with an integration server URL set (server mode) |
| onboarding.js:855 `remoteCall()` | the investor's device talking to the integration server | only for a server-mode invitation |
| invitations.js:405 and :2410 | invitation calls to the integration server | only in server mode |
| intake.js:577 `readingFetch()`, used by intake.js:633 (`/v1/intake`) and esign.js:3415 (`/v1/read`) | the sponsor's reading server, for the intake reader and field placement | only with a reading server URL configured; otherwise the local reader is used |
| assets/vendor/textread/textread-boot.js:22 | the text reader's worker answers its language-data request from memory and passes any other request on | inside the worker, sponsor intake only |

Now none of the paths the brief named makes a fetch: signing, the PDF view dialogs (drawn with pdf.js from bytes since 06-29), the agreement dialog, Documents, and onboarding's intake as an investor sees it. pdf.js is always given bytes (`getDocument({ data })`), never a URL.

## RED and GREEN (quoted)

- **RED** (76dd943 code with the final no-network.js, red-final.txt): 12 PASS, 15 FAIL.
  - Each part: `Continue opens the signing view … :: {"signing":false,"pages":0,"error":"Failed to fetch","h1":"Tax certification"}`.
  - Refused connection: `["connect-src http://127.0.0.1:35233/assets/forms/fw9-2024-03.pdf"]` (and fw8ben-2021-10.pdf, fw8bene-2021-10.pdf).
  - Last line: `NO NETWORK: FAIL (parts run: 3) - w9, w8ben, w8bene`.
- **GREEN** (in the gate): 30 PASS, 0 FAIL, `NO NETWORK: PASS (parts run: 3)`.
  - In each part the frame first proves it refuses a fetch of a file that exists.
  - The filled form is drawn on the page with no error and no form field left. Its fields are written in the embedded DejaVuSans.
  - Signing and Finish move on to "Distribution payments". The signed copy carries DejaVuSans and DejaVuSans-Bold.
  - No connection was refused, there was no script error, and no request left the check server.

## Gate

SCRATCH/exec-06-30/gate.sh is the 06-29 gate plus no-network and `embed-data.js --verify`. Last lines verbatim:
```
GATE ok   server tests # fail 0
GATE ok   server tests 197
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3)
GATE ok   AGREEMENT NAME
GATE ok   TAX REQUEST LEAVE (5)
GATE ok   WAYS OUT (7)
GATE ok   NO NETWORK (3)
GATE ok   EMBED DATA (3)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 197
# pass 197
# fail 0
GATE_EXIT=0
```
PASS lines, all with 0 FAIL:
- forms-flow 983
- status-flow 414
- server-mode 461
- tax-request-leave 43
- email-dialog 54
- ways-out 102
- no-network 30

The leak row (MEASURE, which includes leak) passes. The new names under assets/ contain no vendor or library name. The data scripts are outside the text-scanned folders (assets/js, the pages, assets/vendor/formread).

## Files the preview must publish (new)

- `assets/forms/forms-data.js` (698 KB)
- `assets/vendor/textfont/text-regular.js` (1.0 MB)
- `assets/vendor/textfont/text-bold.js` (941 KB)
- `assets/js/taxforms.js` and `assets/js/esign.js` (changed)

These keep the same relative paths as the pages. `assets/vendor/textfont/LICENSE-font.txt` should be published beside them for the font license. The .ttf files, SHA256SUMS and SOURCE.txt are sources for the generator and are not loaded by the page.

## Screens

SCRATCH/exec-06-30/checks-out/no-network/w9-signing.png, w8ben-signing.png and w8bene-signing.png show the filled forms opened in the refusing frame (SCRATCH = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad).

## Deviations from Plan

1. **[Rule 3] Font source.** jsdelivr is refused here, so I used the npm registry tarball of the same package (see Failures 1).
2. **[Rule 1] Plain message on a failed fallback.** taxforms.js no longer shows the raw "Failed to fetch". If both the shipped script and the file fail, it says the form could not be loaded.
3. **No script tag added to the pages.** The data loads on demand beside the loading script (the brief's "lazily if practical"), so diy.html, index.html and portal.html are unchanged.
4. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Known Stubs

None.

## Self-Check: PASSED

- All created files exist.
- Commits d6831e8, 7ebb7c0 and 05dacf1 are ancestors of HEAD.
- `embed-data.js --verify` passes.
