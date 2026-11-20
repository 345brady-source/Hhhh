---
phase: 10-investor-tax-documents-and-withholding
plan: 04
subsystem: Tax documents page (self-serve console)
status: complete
tags: [k-1, tax-documents, c-06, console, owner-preview]
requires: [10-01, 10-02, 10-03, 10-14]
provides:
  - "NS.views['console-taxdocs'] (self-serve only): import, the split, confirm together (togetherIds only) and one by one beside each K-1's picture, by hand, page ranges"
  - "NS.taxUI: part(key, spec), PARTS (loaded beside taxdocs-ui.js), refresh(), link (null until 10-12), reader(), pagePicture(bytes, page, crop)"
  - "assets/css/tax.css: every tx- class of the plan's interfaces block"
  - "NS.taxdocs.togetherIds, notTogether (the single mark), addPackage proposeId"
  - "checks/taxdocs-flow.js: TAXDOCS FLOW, 8 parts; taxdocs-math.js case single (10 cases)"
affects: [10-06, 10-07, 10-08, 10-10, 10-12, 10-13]
tech-stack:
  added: []
  patterns: ["parts registry beside the page's own script (as filings-ui.js)", "pictures drawn after the page, one at a time, kept in memory only"]
key-files:
  created:
    - assets/js/taxdocs-ui.js
    - assets/css/tax.css
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/taxdocs-flow.js
  modified:
    - assets/js/taxdocs.js
    - assets/js/console.js
    - assets/js/app.js
    - diy.html
    - portal.html
    - server/help/guide.md
    - server/lib/help-guide.mjs
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/taxdocs-math.js
decisions:
  - "Each CPA file is its own import. Any kind other than Schedule K-1 (Form 1065) is one package per file. An account ID in the file name proposes that investor (basis 'account ID in the file name'); such a package is never confirmed together"
  - "The combined file leaves the file store when no package is open and no page outside a package needs one. A K-1 file's pages before its first K-1 do not count. A set-aside package keeps the file, so it can still be reopened"
  - "At phone width the picture is capped at 340 px, so Part I and items E to G stay in view beside the proposal. View pages shows every page whole"
metrics:
  completed: 2026-11-20
  tasks: 3
estimate:
  tokens: 112000
  tasks: 3
actuals:
  tokens: 24700     # chars/4 over the added lines since the merged base, help-guide.mjs (generated) left out
  tasks: 3
  commits: 10       # git rev-list --count --first-parent plan_head_before..plan_head_after (9 plan commits and 1 merge; 34 counting the merged base commits); this summary is the 11th
plan_head_before: 4ff262ad96340d6d4ae390c92426ef4ae4dd75a8
plan_head_after: 7b89a8e3f2300bef95896066afe3c41f1a7fce66
---

# Phase 10 Plan 04: the Tax documents page Summary

The self-serve console has a Tax documents page. The sponsor picks the fund, the type and the year and imports the CPA's file. A combined Schedule K-1 file is cut into one package per K-1 inside the browser. A package goes into the together list only if NS.taxdocs.togetherIds names it. Every other package is confirmed on its own, beside a picture of that K-1's Part I and Part II. Nothing is delivered. All of this is measured only on files built from the IRS's blank 2025 form with invented partners. **The owner has not checked any of it yet.**

## Failures and open points first

- **No check failed at the end.** The gate ended `GATE_EXIT=0` and Task 3's verify `VERIFY3_EXIT=0`.
- **Not measured:**
  - A K-1 file from a CPA's tax software (layouts, masking and statement pages may differ).
  - Any run on an iPhone. The long-file time below comes from this machine's headless browser.
  - The phone's own file picker.
- **W8, "set aside for good":** there is no separate final action. The combined file (it holds every partner's K-1 as printed) is deleted once no package is open and no page outside a package needs one. A set-aside package's pages count as outside a package, so while any package is set aside the file stays in this browser's file store. That keeps Reopen working. The owner may want a "done with this file" action instead.
- **Bigger than the plan:** the gate ran on a tree with the latest claude/refract-reskin merged in (1114672: 08-11, 08-16, 11-01, the R11 fix). The base for every comparison is that merged commit, not 4ff262a.

## Gate (last lines, verbatim)

```
GATE ok   server tests # fail 0
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
GATE ok   BANK STEP TYPING (2)
GATE ok   HELP CHAT (10)
GATE ok   REAL FIRM (9)
GATE ok   SIGNING DOCUMENTS (8)
GATE ok   PHONE LAYOUT (8)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 358
# pass 358
# fail 0
GATE ok   server tests 358 = base 358 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX MATH
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE_EXIT=0
VERIFY3_EXIT=0
```

The gate's own run of this plan's check ended `TAXDOCS FLOW: PASS (parts run: 8)`.

## My own checks, run alone before the gate (verbatim)

- Task 1 verify: `TAXDOCS FLOW: PASS (parts run: 1)` (21 PASS lines)
- Task 2 verify, run as written: `TAXDOCS FLOW: PASS (parts run: 7)`, `TASK2 VERIFY EXIT=0` (163 PASS lines). This run came after Task 3's check additions, so import-desktop also carried Task 3's checks.
- Part managed: `TAXDOCS FLOW: PASS (parts run: 1)` (15 PASS lines)
- `TAXDOCS MATH: PASS (cases run: 10)`, `K1 SPLIT: PASS (cases run: 7)`
- After the last two display commits (the phone picture cap and the crop's top edge), confirm-phone was run alone again: `TAXDOCS FLOW: PASS (parts run: 1)`. The gate then ran all 8 parts on the final code.
- The guide's tests: `# pass 9`, `# fail 0`. `node server/help/build.mjs --verify` says the module is in sync. The sponsor guide is 38,941 bytes of its 48,000; the new entry is 1,300 bytes.

**Measured (part long):** `MEASURED long: 120 K-1s, 381 pages, 8273758 bytes, taken in in 3.6 s by this machine's headless browser at 390x844 (not an iPhone)`. In my own run it was 3.3 s for the same file. This is not a figure for a phone.

## RED, then GREEN (kept in SCRATCH/exec-10-04)

- red-1.txt: `FAIL import-phone tapping it opens the Tax documents page`, then `TAXDOCS FLOW: FAIL (parts run: 1) - import-phone`
- red-2.txt:
  - `FAIL confirm-phone the together list has 10 rows and its button says Confirm 10 :: {"n":10,"button":""}`
  - `FAIL byhand Form 1042-S, two files: each file is one import of one package` (packages 0)
  - `FAIL published portal.html: the console menu has Tax documents`
  - `TAXDOCS FLOW: FAIL (parts run: 4) - confirm-phone, byhand, published`
  - taxdocs-math: `FAIL single ran to the end :: TypeError: T.notTogether is not a function`
- red-3.txt: `FAIL import-desktop the seven files of later plans were asked for beside taxdocs-ui.js and, answered 404, show no section and no error :: {"asked":0,...,"api":"undefined"...}`, then `TAXDOCS FLOW: FAIL (parts run: 2) - import-desktop`. Part managed passed in RED. That is expected: it is a guard, and index.html is never edited.

## What the parts prove (each in the sandboxed frame that refuses every connection, scripts from the portal only, the later plans' seven files answered 404)

- **import-phone** (390x844, touch, printed file) and **import-desktop** (1280x800, the form-field file):
  - The menu entry "Tax documents" opens the page.
  - The 27-page file gives 12 packages, and its row says "12 to confirm".
  - 10 packages are in the together list and 2 are one by one. Each row shows the K-1's name line and "ending" with four digits.
  - Page 1 is listed under Pages with no package.
  - No document is added and no investor sees one.
  - The C3 search finds nothing (details below) and is shown to fail when a number is planted.
  - The fund's name with `<b>LP</b>` in it is shown as text.
- **import-desktop** also proves:
  - The seven PARTS files were asked for and answered 404, and no section or error is shown.
  - A probe section registered from the check gets its line and its page at console-taxdocs-probe, under a sticky bar with Back. Back and the browser's back both return to the list.
  - With NS.taxUI.link connected, its rowLine is drawn on each of the 10 confirmed rows.
  - A team member has the entry, imports a file and confirms.
  - An investor cannot open the address.
- **confirm-phone / confirm-desktop:**
  - "Not this one" turns "Confirm 10" into "Confirm 9", and that button confirms exactly those 9.
  - Each of the 9 becomes a hidden, confirmed document whose own PDF is in the file store. Its page count, read back with the reader, equals its package's, and its SHA-256 matches its record.
  - The change log gains 9 entries, each with the investor, the basis, the source SHA-256 and the pages.
  - Each of the 3 one-by-one rows has a loaded picture beside the proposed investor's title, account ID, "ending" four digits and the basis in words.
  - View pages draws the 2 pages in a dialog that scrolls and closes.
  - Set aside and Reopen work.
  - The number-only row is confirmed for its investor. The name-only row is given to another investor of the fund and records "by hand".
  - The fund's investors with no K-1 are listed.
  - A reload keeps every decision.
  - The combined file is kept while a package is open and deleted after the last one.
  - The two flagged packages of the cover-page file never appear in the together list.
  - The console's Documents page keeps its count and the signed tax form, and its remove action ignores a tax document.
  - The investor's Documents list shows none of them.
- **byhand:**
  - For Form 1042-S, two files give two one-package imports. The one whose name carries an account ID proposes that investor; the other proposes nobody. There is no together list, and each is confirmed.
  - Form 8805 and Tax letter behave the same way.
  - A K-1 file with no text shows the one line "No text can be read in this file: ask the CPA for the file as the tax software saves it, or make each package from its pages below."
  - A page range outside the file is refused with one line, and so is a range that overlaps another package. Ranges 1 to 2 and 3 to 3 make two packages with no proposal.
- **long:** 120 K-1s (381 pages) give 120 packages, with no page error.
- **published:** portal.html at 390x844 has the same entry and page: 12 packages, 10 and 2.
- **managed:** this is index.html at 1280x800, as staff and as sponsor staff.
  - The Documents page is visible.
  - The menu has no Tax documents entry.
  - console-taxdocs and console-taxdocs-batch-x fall back to the default page with no error.
  - Neither the page nor its source names any file of this plan.
- **Every part:** quiet (nothing refused, no script error, no outside request), leak (no vendor or model name and not the forbidden word), and a way out on screen at the top, middle and end of the page.

**C3 search, as built:** the twelve invented numbers (as printed, as digits only, and first five beside last four) are searched in everything this browser saved. Both number shapes and nine-digit runs are searched, after the SHA-256 values are taken out, in ws.taxdocs, the tax documents, the change-log entries added and the page's text. The shapes are not searched in the whole saved workspace, because the sample firm itself holds nine-digit bank routing numbers, so that search would always hit.

## Commits

| Commit | What |
|---|---|
| f14a7ca | test: part import-phone (RED) |
| 32b4061 | feat: the page, import, cut, the two lists; togetherIds; menu, route and diy.html lines (tracer) |
| 7b5461e | test: parts import-desktop, confirm-*, byhand, long, published; taxdocs-math case single (RED) |
| 9080e97 | feat: confirming together and one by one, pictures, by hand, ranges, file removal, Documents page lines, portal.html |
| 9ed8598 | test: registry, link, roles, managed; marker 8 parts (RED) |
| a9d5d7e | feat: NS.taxUI registry and loader, link seam, guide entry, help-guide.mjs |
| a1aacb0 | merge of claude/refract-reskin (guide conflict resolved, module regenerated) |
| f1d3bee | fix: a "Working…" line while an action runs; a typed range is read before the page redraws |
| 873b15e | fix: at phone width the picture keeps Part I and items E to G in view |
| 7b89a8e | fix: the K-1 picture starts at Part I's top edge |

## Lines added to shared files

- `assets/js/console.js`: 3 added lines, no line changed:
  - the menu line after Filings' own line (NAV entry after Documents and the Operate key);
  - one line in the Documents page that leaves out a document with a tax block;
  - one line in its remove action that ignores one.
- `assets/js/app.js`: 1 line (`['console-taxdocs-', 'console-taxdocs']`).
- `diy.html`, `portal.html`: 3 lines each (tax.css after filings.css; taxdocs.js and taxdocs-ui.js after filings-ui.js). `git diff <base> -- diy.html portal.html | grep -c '^-[^-]'` gives 0.
- `server/help/guide.md`: the `## console-taxdocs` entry, plus "Tax documents" added to the Overview's Operate list (that one line changed, and it was merged with 08-11's line). `server/lib/help-guide.mjs` was regenerated, never edited by hand.
- `assets/js/taxdocs.js` (10-02's module, part of this plan's files by C2): togetherIds; notTogether (single, with who and when, logged); reopen clears the mark; addPackage proposeId.
- `checks/taxdocs-math.js`: case single; the marker now reads 10 cases.

## Files a preview build must publish (new to the pages)

- `assets/js/taxdocs-ui.js` (new)
- `assets/css/tax.css` (new)
- `assets/js/taxdocs.js` (from 10-02; no page loaded it until now)
- It also needs 10-03's `assets/vendor/pdfview/view.js`, `view-worker.js` and `assets/vendor/pdfwrite/write.js`.

## Deviations from Plan

1. **[Rule 3] tax.css and the route prefix came in Task 1, not Task 2.** The batch page's address needs the prefix, and its sticky Back bar needs the stylesheet, before the tracer could pass its way-out check.
2. **The reader: NS.esignKit.reader() only.** 10-03 was merged before this plan started, so the loadScript fallback branch the plan describes for "this plan's own tree" was not written. Every part uses lib10's `policy: 'self'`, which refuses both outside hosts.
3. **[Rule 2] addPackage proposeId.** The byhand behaviour needs a proposal for the 1042-S file named with an account ID. NS.taxdocs records it (basis "account ID in the file name"). togetherIds never includes it, as case single proves.
4. **C3 search scope:** the shapes are searched in what the page added and in the page's text (see above), not in the whole saved workspace.
5. **W8:** the combined file is removed when nothing is left to confirm. There is no separate "set aside for good" action (see Failures).
6. **The phone picture is capped at 340 px.** C-06 says "its own Part II beside the investor". At 390 px wide, the full crop from Part I through Part II is about 680 px tall, which pushed the proposal a full screen down. Part I and Part II's identity items (E, F, G) stay in view; View pages shows every page whole. Desktop shows the whole crop beside the proposal.
7. **[Rule 2] A "Working…" status line during an action.** Cutting many packages takes a moment, so the page shows it is working. The typed page range is now read before that redraw; without this, the redraw would have emptied the typed range.
8. **Merge:** the latest claude/refract-reskin was merged (not rebased) before the gate, as the context file asks. The guide conflict was resolved by keeping 08-11's Report list and adding Tax documents to Operate. base-commit.txt for the gate is that merged commit; the starting base, 4ff262a, is kept in base-commit-start.txt.
9. **Planner's choice 3** (the address console-taxdocs-batch-&lt;id&gt;) is kept as written. No menu count was added beside Tax documents.

Not touched: STATE.md, ROADMAP.md, REQUIREMENTS.md, index.html, the in-house agreement reader. No package was installed and no paid call was made.

## Known Stubs

None. `NS.taxUI.link` is null by design until plan 10-12 sets it. A confirmed document shows "Not delivered" until plan 10-06 delivers it.

## Threat model

- T-10-10: covered by the together list (togetherIds only, "Not this one", a look package never offered), the single confirmations with pictures, and hidden documents. Proven in confirm-phone and confirm-desktop.
- T-10-11: the 25 MB limit and the `%PDF-` signature are checked before reading; the reader runs with `isEvalSupported: false`; the fund name with angle brackets is shown as text.
- T-10-12: last fours only, and the C3 search passes.
- T-10-13: self-serve only, investors refused, the managed edition untouched. The part file names are a fixed list.

## Owner's check (pending)

On the iPhone, in the published preview:
1. Open the console menu and tap Tax documents.
2. Import a K-1 file from your CPA, or the 27-page sample built by `checks/k1-build.js`.
3. Open the import and confirm the together list.
4. Confirm one of the others while looking at its picture.

Expected: the file is cut into the right K-1s; each picture is that K-1's own top section; every proposed investor is right or absent, never wrong; there is always a visible way back.

## Self-Check: PASSED

- FOUND: assets/js/taxdocs-ui.js, assets/css/tax.css, checks/taxdocs-flow.js
- FOUND in HEAD's history: f14a7ca, 32b4061, 7b5461e, 9080e97, 9ed8598, a9d5d7e, a1aacb0, f1d3bee, 873b15e, 7b89a8e
