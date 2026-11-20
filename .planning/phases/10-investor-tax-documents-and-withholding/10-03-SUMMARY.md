---
phase: 10-investor-tax-documents-and-withholding
plan: 03
subsystem: PDF libraries (assets/vendor/pdfview, assets/vendor/pdfwrite, esign.js loaders)
tags: [pdf, vendor, offline, preview, F-6, TAX-18]
status: complete
requires: [10-01]
provides:
  - "assets/vendor/pdfview/view.js, view-worker.js (pdfjs-dist 3.11.174) and assets/vendor/pdfwrite/write.js (pdf-lib 1.17.1), fonts.js (@pdf-lib/fontkit 1.1.1), pinned, licensed, sourced"
  - "NS.esignKit.reader() (new), writer() and unicodeFont() (same names), all loading the shipped copies first"
  - "checks/shipped-libs.js: SHIPPED LIBS, 5 parts (pins, view-phone, taxform, fallback, managed)"
affects: [10-04, 10-06, 10-10, 10-11, phase 11 (statements, C-02: uses NS.esignKit and adds no library)]
tech-stack:
  added: ["the four library files the portal already loaded at run time, now in the repository (no package installed)"]
  patterns: ["shipped copy first, outside address as fallback (shippedFirst), as the font data already did"]
key-files:
  created:
    - assets/vendor/pdfview/view.js
    - assets/vendor/pdfview/view-worker.js
    - assets/vendor/pdfview/LICENSE-view.txt
    - assets/vendor/pdfview/SHA256SUMS
    - assets/vendor/pdfview/SOURCE.txt
    - assets/vendor/pdfwrite/write.js
    - assets/vendor/pdfwrite/fonts.js
    - assets/vendor/pdfwrite/LICENSE-write.md
    - assets/vendor/pdfwrite/LICENSE-fonts.txt
    - assets/vendor/pdfwrite/SHA256SUMS
    - assets/vendor/pdfwrite/SOURCE.txt
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/shipped-libs.js
    - .planning/phases/10-investor-tax-documents-and-withholding/deferred-items.md
  modified:
    - assets/js/esign.js
decisions:
  - "The shipped files keep neutral names (view.js, view-worker.js, write.js, fonts.js); bytes unchanged; SOURCE.txt names each published file (P-5)"
  - "The outside addresses stay as the fallback; a failed shipped load is forgotten and tried again next time"
  - "unicodeFont() now fails with the writer's own sentence instead of the loader's raw 'load failed: <address>' text"
metrics:
  completed: 2026-11-19
  tasks: 2
actuals:
  tokens: 9000      # chars/4 over the hand-written diff (esign.js, the check, the two SOURCE.txt); the copied library bytes (2,690,755) are not counted
  tasks: 2
  commits: 6        # git rev-list --count --first-parent plan_head_before..plan_head_after: 5 plan commits and the merge of claude/refract-reskin (38 counting the merged base commits)
plan_head_before: 5f5e22b6dc61703b884ced939fa7dbc122bacf2e
plan_head_after: 3fdb508
---

# Phase 10 Plan 03: the PDF libraries shipped in the repository Summary

The PDF reader, its worker, the PDF writer and the font embedder are in the repository byte for byte (the versions the portal already ran from two outside hosts), pinned by SHA-256 with their licences, and esign.js loads them first; viewing, filling, signing and the managed page now work in a frame that refuses both outside hosts.

## Failures first

1. **The gate ended `GATE_EXIT=1`** on one line, `GATE FAIL PHONE LAYOUT (8)` (parts firms-phone and owner-phone, failure 14: offering links on the console's Filings page are 17 px high on the phone). The same two parts fail the same way on the base tree (claude/refract-reskin at 8e38555, no 10-03 change): `PHONE LAYOUT: FAIL (parts run: 2) - firms-phone, owner-phone`. This plan changes no console page or stylesheet. It comes from phase 9's Filings page meeting the 06-33 phone rules after both were merged. Logged in deferred-items.md and not fixed here.
2. **gate10.sh (plan 10-14) was not merged** when the gate ran (checked at 8e38555), so the plan's Task 2 verify command could not run as written. As the brief says, I ran the reference gate instead: `.planning/checks/gate-reference.sh` as merged, with only its folder lines rewritten, `GATE_SERVER_TESTS=329`, and this plan's SHIPPED LIBS full run added before the base comparison. The base for the phase 4 signing-step and phase 5 record comparison is 8e38555, the base commit merged in, so any difference there comes from this plan alone.
3. **Not covered by this plan:** `assets/js/intake.js` (the document reader's loader, kept unchanged under D-33 and the plan) still loads the reader and writer from the outside host. Reading an uploaded file in the import and intake screens therefore still needs the network in the preview. Every esign.js path does not.
4. **The owner's iPhone check is still pending.** Nothing here is called done until he has checked it.

## Gate (last lines, verbatim)

```
GATE ok   server tests # fail 0
GATE ok   server tests 329
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
GATE ok   SAFARI FINISH (6)
GATE ok   HELP CHAT (10)
GATE ok   REAL FIRM (9)
GATE ok   SIGNING DOCUMENTS (8)
GATE FAIL PHONE LAYOUT (8)
PASS managed no request outside the page's origin
SHIPPED LIBS: PASS (parts run: 5)
GATE ok   SHIPPED LIBS (5)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 329
# pass 329
# fail 0
GATE_EXIT=1
```

Task 1 verify (run as written): `SHIPPED LIBS: PASS (parts run: 2)`, `VERIFY1_EXIT=0`; `sha256sum -c` reports OK for all seven pinned files.
Task 2 verify, the parts that do not need gate10.sh: red-2.txt holds FAIL lines; `git diff --quiet 5f5e22b HEAD -- index.html assets/vendor/formread assets/vendor/textread assets/vendor/textfont assets/js/intake.js` reports no change; esign.js names both `vendor/pdfview` and `vendor/pdfwrite`.

## RED, then GREEN

- red-1 (SCRATCH/exec-10-03/red-1.txt, before the reader change): `FAIL view-phone as that investor, Documents, the document: both pages are drawn in the dialog :: {"open":true,"drawn":0,"said":"This PDF cannot be shown here. Use Download to open it."}`. The frame refused `script-src-elem https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js`. `SHIPPED LIBS: FAIL (parts run: 2) - view-phone`.
- red-2 (red-2.txt, before the writer change): `FAIL taxform "Continue to the form" opens the signing view ... :: {"signing":false,"pages":0,"error":"Could not load the PDF writer. Check the connection and try again."}`. Also `FAIL fallback the reader, the writer and the font embedder were each asked of the shipped address first ... [{"what":"the writer","shipped":-1,...},{"what":"the font embedder","shipped":-1,...}]` and `FAIL managed NS.esignKit.writer(), unicodeFont() and reader() write a PDF ... "error":"Could not load the PDF writer..."`. `SHIPPED LIBS: FAIL (parts run: 3) - taxform, fallback, managed`.
- After the change: all five parts pass, both separately and in the gate's full run.

What the parts prove:
- **pins** (no browser): every file's SHA-256 matches its SHA256SUMS line and the plan's constants. The three licence files hold "Apache License" and "Permission is hereby granted" (twice). Each SOURCE.txt names its package and version.
- **view-phone**: 390x844 with touch, scripts from the portal's own address only, both outside hosts refused. An admin publishes a two-page PDF (written with the shipped writer under Node) to one investor through the Documents page. That investor opens it from Documents and both pages are drawn. The screenshot was checked by eye: both pages are drawn. The shipped reader and worker scripts are on the page, and nothing was asked of either outside host.
- **taxform**: the same frame at 1280x800. Łucja Brennan-Okafor signs the subscription agreement, reaches the tax step and sees the filled W-9 drawn (Ł printed; screenshot checked). She signs and finishes. The signed copy's text uses the embedded DejaVuSans regular and bold, and nothing was asked of either outside host.
- **fallback** (W1, default policy): the four shipped addresses answer 404. The published PDF is still drawn and the W-9 still fills with no error on screen. The reader, writer and font embedder were each asked for at the shipped address before the outside one. The worker came from the outside address (it is not asked for at the shipped address once view.js is missing).
- **managed**: index.html as staff shows the Documents page. A PDF published there is drawn from the investor's Documents list. In the page, `NS.esignKit.writer()`, `unicodeFont()` and `reader()` write "Łucja Brennan-Okafor" in the embedded font and read the same text back. All four shipped files were loaded, and nothing was asked of either outside host.

## For phase 11

The libraries are in the repository: use `NS.esignKit.writer()` (the PDF writer object), `NS.esignKit.unicodeFont()` (`{ fontkit, fontBytes }`) and `NS.esignKit.reader()` (the PDF reader object, worker registered). Do not add any library file again.

## Files a preview build must publish (new in this plan)

| Path | Bytes |
|------|------:|
| assets/vendor/pdfview/view.js | 320,004 |
| assets/vendor/pdfview/view-worker.js | 1,087,212 |
| assets/vendor/pdfview/LICENSE-view.txt | 10,174 |
| assets/vendor/pdfview/SHA256SUMS | 238 |
| assets/vendor/pdfview/SOURCE.txt | 981 |
| assets/vendor/pdfwrite/write.js | 525,099 |
| assets/vendor/pdfwrite/fonts.js | 758,440 |
| assets/vendor/pdfwrite/LICENSE-write.md | 1,070 |
| assets/vendor/pdfwrite/LICENSE-fonts.txt | 1,077 |
| assets/vendor/pdfwrite/SHA256SUMS | 317 |
| assets/vendor/pdfwrite/SOURCE.txt | 1,894 |

The four libraries come to 2,690,755 bytes, and all eleven files to 2,706,506. The page needs only the four .js files. The rest are licences and records. The plan said ten files; C1 adds LICENSE-fonts.txt, which makes eleven.

## Deviations from Plan

1. **[C1, plan-check blocker] LICENSE-fonts.txt added.** It is the upstream foliojs/fontkit MIT licence, copied unchanged (SHA-256 cf22b819…, checked before the copy). SOURCE.txt says where it came from and why, SHA256SUMS pins it, and part pins checks it.
2. **[W1] fallback uses lib10's default policy**, as the plan check required.
3. **[Rule 3] Gate:** the reference gate replaced gate10.sh, which is not merged yet (see Failures 2).
4. **[Rule 1] unicodeFont()'s error.** It used to pass on the loader's raw text, `load failed: https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit...`, which names a library host and could reach the screen through the tax form. It now gives the writer's own sentence.
5. **The check's quiet for taxform:** taxform loads the page again (Lib.setupPortal) and signs. lib10's quiet would count the page's typography stylesheets from fonts.googleapis.com, which lib10 itself clears after a page load. Its local `quietReloaded` allows only those stylesheets and prints how many there were (5). Every other part uses lib10's quiet as it is, except fallback, where outside library requests are expected. These stylesheets are not PDF libraries. They are logged in deferred-items.md.
6. **Gate base:** the signing and record comparison used 8e38555 (the base merged in before the gate), not 5f5e22b, so a difference there could only come from this plan.

## Threat model

- T-10-08: each file was copied only after its SHA-256 matched the plan's value (copy script in SCRATCH/exec-10-03/copy.sh), and part pins compares them on every gate run.
- T-10-09: the outside addresses remain the fallback, part fallback proves it, and the files to publish are listed above.
- T-10-SC: no package manager ran.

## Owner's check (pending)

On the iPhone, in the published preview, put the phone in airplane mode after the page has loaded. Then open a document from Documents and sign a tax form from an invitation. Expected: the pages are drawn and the form signs as before.

## Self-Check: PASSED

All eleven shipped files, the check, the deferred-items file and assets/js/esign.js are present. Commits d3673c7, cb8f942, 0083837, 144493e, 0b46a43 and 3fdb508 are ancestors of HEAD.
