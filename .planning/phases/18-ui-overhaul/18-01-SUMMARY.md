---
phase: 18-ui-overhaul
plan: 01
subsystem: checks (phase 18 proof tools)
status: complete
tags: [same-screens, gate18, D-02, UI-10]
requires: ["13-08", "15-14", "16-07", "small-fixes-c"]
provides:
  - .planning/phases/18-ui-overhaul/checks/lib18.js (gate: none)
  - .planning/phases/18-ui-overhaul/checks/screens18.js (gate: none)
  - .planning/phases/18-ui-overhaul/checks/same-screens.js ("SAME SCREENS: PASS (parts run: 11)")
  - .planning/phases/18-ui-overhaul/checks/gate18.sh ("GATE18 SELF-TEST: PASS (10)")
affects: [18-02, 18-03, 18-04, 18-05, 18-06, 18-07, 18-08, 18-09, 18-10, 18-11, 18-12]
tech-stack:
  added: []
  patterns: [base tree against plan tree in one process, exact rule transforms, stand-in faults built from a pinned commit, resumable gate steps]
key-files:
  created:
    - .planning/phases/18-ui-overhaul/checks/lib18.js
    - .planning/phases/18-ui-overhaul/checks/screens18.js
    - .planning/phases/18-ui-overhaul/checks/same-screens.js
    - .planning/phases/18-ui-overhaul/checks/gate18.sh
  modified: []
decisions:
  - "SAME SCREENS lines are grouped by tag, not split from innerText (a restyle changes innerText without changing a word)"
  - "compare() accepts the base with any subset of the applicable rules applied in table order, so C1..C7 and M can land one plan at a time"
  - "Selftest stand-ins are built from P18_SELFTEST_COMMIT (default d36521b) so they keep proving the comparison after later plans change this tree"
  - "DIALOGS rows are keyed file#nth (ordinal), compared per file with the U.dialog( grep at run time"
  - "Vendor names and outside requests fail only when this tree adds them; ones the base tree shows too are NOTE lines"
metrics:
  completed: 2026-11-28
  tasks: 3
  files: 4
actuals:
  tokens: 32150
  tasks: 3
  commits: 19
plan_head_before: d36521bc4a0a9bf259dc67324c8802985d78bd5c
plan_head_after: fdf6ea6e6e91560ec57b57075fdc2fb3cd4820ea
---

# Phase 18 Plan 01: SAME SCREENS and gate18 Summary

SAME SCREENS records every console page (both editions), every investor tab, the invitation walk step by step, the signing
views, the field editor, the report builder, sign-in, sign-up and all 34 `U.dialog(` call sites, on the base tree and on
this tree, at 1280 and 390 (iPhone 13 profile on Chromium). It fails on any changed word, action, field value, placeholder,
heading or chart figure that is not one of the spec's exact transforms. gate18.sh is the gate every later phase 18 plan
closes with. This plan changed no product file. These are check tools. Nothing here is a product change for the owner to
look at; his check of the phase comes with 18-12.

## Failures first

- **None in the final runs.** Every verify passes on fdf6ea6 (lines below).
- **The first full gate run was stopped on purpose.** Two DIALOGS openers used a class scope (`.pt-main`, `.es-doc-sign`),
  and the plan says openers never use a class. I killed the run, changed both to `#main` plus the attribute, reran the two
  rows on both trees at both sizes (PASS) and committed fdf6ea6. Then I ran the gate again from the start, into the same
  folder.
- **The development runs failed before they passed.** Each failure and its fix is under Deviations:
  - ids from `tm-`, `invt-` and `tb-` that ID_RE did not cover;
  - the check servers' ports inside links;
  - the walk's seconds in the e-sign history;
  - the demo bar missing on standalone pages;
  - recorded runs whose NACHA file cannot be built in the past;
  - the desktop editor's hidden re-read button;
  - the tax batch page link.
  None of these failures was in a check I did not touch.
- **Two findings for the owner (product, both trees, not changed here):**
  - The signature adoption dialog asks fonts.googleapis.com for its signature faces. That is an outside font host, so it
    belongs to the own-fonts work.
  - The managed console and the sponsor sign-up page say "Carrow & Vale".

## Start

- Start commit (O/base-commit.txt): d36521bc4a0a9bf259dc67324c8802985d78bd5c
- Waits: `git merge-base --is-ancestor <c> HEAD` returned 0 for dcf002f, aeed1ab, 4277aa8 and adba2c8 (and 0abb5e6).
  O/waits.txt is empty.
- Measured server count at the start commit (O/st-base.txt, O/base-count.txt): `# tests 622`, `# pass 622`, `# fail 0`.
  The count is **622**. This plan declares +0.

## RED lines (each pasted when it was produced)

Task 1 (O/red-1.txt; compare() stubbed always ok; content in a4217c4, marked by 9c24769):
```
FAIL selftest fault word caught: nothing failed (PASS console-desktop admin console-offerings)
FAIL selftest control c1-help passes (C1): PASS console-desktop admin console
FAIL selftest fault c1-wrong caught: nothing failed (PASS console-desktop admin console-offerings)
SAME SCREENS: FAIL (parts run: 2) - selftest
```
Task 2 (O/red-2.txt; the new self-test against gate16's steps):
```
SELF-TEST FAIL control: the stand-ins pass when nothing is wrong
SELF-TEST FAIL a reference whose folder line is missing
SELF-TEST FAIL a phase 12 check (run without being named) whose last line differs from its marker
SELF-TEST FAIL GATE18_PHASES naming a phase outside 08 09 10 11
SELF-TEST FAIL a phase 08 gate check that prints no PASS line
SELF-TEST FAIL a PHONE LAYOUT desktop comparison whose last line is not PHONE LAYOUT: PASS (parts run: 4)
SELF-TEST FAIL a phase-18-only run
GATE18 SELF-TEST: FAIL - control nofolder p12 phases p08 phone only
```
Task 3 (O/red-3.txt; every part written, DIALOGS emptied, commit a16dffc; the two dialogs parts):
```
FAIL dialogs-desktop the DIALOGS table names every call site: 0 rows for 34 call sites :: {"without":[{"file":"coinvestor.js","calls":6,"rows":0,...
FAIL dialogs-desktop call sites without a row: 34 :: ["coinvestor.js: 6 calls, 0 rows","console.js: 3 calls, 0 rows",...
FAIL dialogs-phone the DIALOGS table names every call site: 0 rows for 34 call sites :: ...
FAIL dialogs-phone call sites without a row: 34 :: ...
SAME SCREENS: FAIL (parts run: 2) - dialogs-desktop, dialogs-phone
```

## Verify and gate lines (final HEAD fdf6ea6)

Task 1 verify (O/verify12.txt): `SAME SCREENS: PASS (parts run: 2)` with word and c1-wrong caught, the NOTE line and no
product file changed. Result: `VERIFY1_PASS`.

Task 2 verify (O/verify12.txt): `GATE18 SELF-TEST: PASS (10)`, the control ok and no SELF-TEST FAIL. Result: `VERIFY2_PASS`.

Task 3 verify (O/verify3.txt, the plan's closing verify verbatim; its gate rerun kept the steps of the run before it):
`VERIFY_PASS`.

Server count line, measured in the gate run (the base tree measured in the same run):
```
GATE ok   server tests 622 = base 622 + 0 declared
```

The first full gate run on fdf6ea6 (O/gate-run1.txt), last 40 lines:
```
# tests 622
# pass 622
# fail 0
GATE ok   server tests 622 = base 622 + 0 declared
GATE ok   DELIVER FLOW
GATE ok   REPORT FIXES
GATE ok   REPORTS FLOW
GATE ok   REPORTS MATH
GATE ok   REPORTS MODEL
GATE ok   REPORTS PDF
GATE ok   REPORTS RECORD
GATE ok   REPORTS RUN
GATE ok   REPORTS STARTERS
GATE ok   REPORTS SWEEP
GATE ok   REPORTS XLSX
GATE ok   EMAIL SENDING
GATE ok   EMAILS PARITY
GATE ok   INVITE MAIL
GATE ok   PORTAL MAIL
GATE ok   TAX NOTICE
GATE ok   DATAROOM MODEL
GATE ok   INBOX MODEL
GATE ok   WATERMARK
GATE ok   ROLES TABLE
GATE ok   SECTIONS
GATE ok   SERVED PORTAL
GATE ok   TOTP FRAME
GATE ok   ACH FLOW
GATE ok   ACH LEAK
GATE ok   FILE RECORD
GATE ok   HOLIDAYS
GATE ok   MOBILE SYNC
GATE ok   NACHA BUILD
GATE ok   PAYEES
GATE ok   POSTING RETURNS
GATE ok   INDEPENDENT READER
GATE ok   RETURNS READ
GATE ok   PHONE LAYOUT DESKTOP vs base
GATE ok   SAME SCREENS
GATE_EXIT=0
```
Before those lines the reference gate passed all 36 of its steps: STATUS MATH (13) through DELIVER FLOW (8), signing
75/75 against 75/75, record 40/40 against 40/40. GATE18_PHASES was unset, so phases 08 to 11 did not run, as the plan says.
The gate's SAME SCREENS (O/gate/same-screens.txt) printed `SAME SCREENS: PASS (parts run: 11)` with 335 PASS lines and 0
FAIL lines. It printed `PASS dialogs-desktop the DIALOGS table names every call site: 34 rows for 34 call sites` (and the
same for dialogs-phone) and the WebKit NOTE. The base tree was removed at the end.

SAME SCREENS selftest lines (from the gate's run):
```
PASS selftest fault word caught: FAIL console-desktop admin console-offerings: content lines #2 of 39/39: base "Each investment is configured separately: …" plan "Each investment is set up separately: …"
PASS selftest control c1-help passes (C1): PASS console-desktop admin console (C1)
PASS selftest fault c1-wrong caught: FAIL console-desktop admin console-offerings: content lines #4 of 39/39: base "Add offering" plan "Ask me anything"
PASS selftest fault action caught: FAIL console-desktop admin console-offerings: content actions #2 of 5/5: … "off-add" … "off-add2" …
PASS selftest fault href caught: FAIL console-desktop admin console: frame actions 1 gone, 1 added: … "#console-team" … "#console-team-x" …
PASS selftest fault line caught: FAIL console-desktop admin console-offerings: content lines #2 of 39/40: … plan "One more sentence on the page."
PASS selftest fault menu caught: FAIL console-desktop admin console: frame lines 1 gone, 0 added: base "Investors" plan "(none)"
PASS selftest fault chart caught: FAIL investor-desktop investor distributions: charts #1 note: base "$0 | $20K | $40K | $60K | 2023 | 2024 | 2025 | 2026 YTD | $37.75K" plan "$37.75K of $987,654"
PASS selftest fault placeholder caught: FAIL console-desktop admin console-docs: content actions #6 of 9/9: … "placeholder":"Q3 2026 Investor Update" …
PASS selftest fault value caught: FAIL console-desktop admin console-distributions: content actions #7 of 35/35: … "value":"DISTRIB" …
PASS selftest fault dialog-word caught in dialogs-desktop: FAIL dialogs-desktop esign.js#10 diy: content lines #2 of 8/8: … "you place the fields once." plan … "you set the fields once."
PASS selftest fault dialog-word caught in dialogs-phone: FAIL dialogs-phone esign.js#10 diy: content lines #2 of 8/8: …
PASS selftest fault phone-only caught: FAIL console-phone admin console-offerings: content lines #4 of 39/38: base "Add offering" plan "Offering"
PASS selftest fault managed caught: FAIL managed-desktop staff console: frame actions 1 gone, 1 added: … "op-client" … (Add a client… -> Add a new client…)
PASS selftest fault c6-wrong caught: FAIL console-desktop admin console-brand: content actions #36 of 62/62: base … "AaBrygada & Ysabeau","checked":false … plan … checked …
PASS selftest fault empty caught: FAIL console-desktop admin console: empty record
PASS selftest control c3 passes (C3): PASS dialogs-desktop help.js#1 diy (no server) / PASS dialogs-desktop help.js#1 diy (C3)
PASS selftest control c4 passes (C4): PASS console-desktop admin console (C4)
PASS selftest control c6-q4 passes (C6): PASS console-desktop admin console-brand (C6)
```

## What SAME SCREENS records (screens × edition × size, both trees each)

| Part | Screens | Recorded at |
|---|---|---|
| console-desktop / console-phone | diy.html as admin: the 22 menu pages (Overview, Notifications, Offerings, Offering intake (its upload step), Investors, E-sign, Capital calls, Distributions, Requests, Notices, Documents, Tax documents, Accounting, Reports, Audit, AML/KYC, AML program, Filings, Integrations, ACH origination, Portal and brand, Team), one offering; team member: Overview, Offerings (25 screens; the sample has no envelope, the flows parts record one) | 1280 and 390 |
| managed-desktop / managed-phone | index.html as Carrow & Vale staff: the 15 menu pages; sponsor staff: Overview, Offerings (17) | 1280 and 390 |
| investor-desktop / investor-phone | diy.html and index.html as the sample investor: Home, Investments, Distributions, Documents, Updates, Account, one investment, portfolio, preferences, subscribe-<id>, sign-in; on the phone also the menu opened (22 at 1280, 24 at 390) | 1280 and 390 |
| flows-desktop / flows-phone | diy-start; join-<id> (open offering); field editor; report builder list and a starter template open; a new invitation: Welcome, Create your login, Investor information, Identity verification, Investor status, Tax certification, the W-9 signing view, the W-9 page, Distribution payments, Subscription, Subscription agreement, the agreement signing view, done; activation; bank update; e-sign list; the e-sign envelope (22) | 1280 and 390 |
| dialogs-desktop / dialogs-phone | 34 rows: 34 on diy.html (35 recordings: Help twice), 16 on index.html; 50 row × edition per size | 1280 and 390 |

### The DIALOGS table (rows × edition × size; PASS = recorded on both trees and the same)

| # | Call site (d36521b) | Dialog | Setup | Opened by | diy 1280 | diy 390 | managed 1280 | managed 390 |
|---|---|---|---|---|---|---|---|---|
| 1 | help.js:171 (#1) | Help (recorded with no server, then with the preview's stand-in) | helpPreview (first none) | `#console → [data-action="help-open"]` | PASS | PASS | n/a | n/a |
| 2 | invitations.js:2949 (#5) | Notifications (the bell) | none | `#console → [data-action="inv8-bell"]` | PASS | PASS | n/a | n/a |
| 3 | console.js:1047 (#1) | Invitation email (an investor invited before invitations were recorded) | none | `#console-investors → [data-action="invite-preview"][data-id="{invited}"]` | PASS | PASS | PASS | PASS |
| 4 | coinvestor.js:270 (#3) | Account (an investor on file) | none | `#console-investors → [data-action="co-record"][data-id="{inv}"]` | PASS | PASS | PASS | PASS |
| 5 | coinvestor.js:295 (#4) | Add co-investor | none | `… co-record → #dlg [data-action="co-add"]` | PASS | PASS | PASS | PASS |
| 6 | coinvestor.js:306 (#5) | Add co-investor with its field messages | none | `… co-add → fill #co-first, #co-last, #co-email '' → #dlg [data-form="co-save"] button[type="submit"]` | PASS | PASS | PASS | PASS |
| 7 | coinvestor.js:130 (#2) | Co-investor sign-in email | coSignIn | `… co-record → #dlg [data-action="co-link"]` | PASS | PASS | n/a | n/a |
| 8 | coinvestor.js:355 (#6) | Remove the co-investor? | coSignIn | `… co-record → #dlg [data-action="co-remove"]` | PASS | PASS | PASS | PASS |
| 9 | coinvestor.js:122 (#1) | Co-investor sign-in email, the link expired | coExpired | `… co-record → #dlg [data-action="co-link"]` | PASS | PASS | n/a | n/a |
| 10 | console.js:1677 (#3) | Cancel this distribution (early) | none | `#console-distributions → [data-action="dist-cancel"]` | PASS | PASS | PASS | PASS |
| 11 | console.js:1505 (#2) | Build the file again (early) | nachaReleased | `[data-action="nacha-again"]` | PASS | PASS | PASS | PASS |
| 12 | diy.js:162 (#1) | Investor sign-up link | none | `#console-offering-{raising} → [data-action="join-link"]` | PASS | PASS | n/a | n/a |
| 13 | esign.js:4484 (#11) | Remove the subscription agreement? | none | `#console-offering-{raising} → [data-action="es-agreement-remove"]` | PASS | PASS | PASS | PASS |
| 14 | esign.js:4170 (#10) | Subscription agreement (an offering without one) | none | `#console-offering-{plain} → [data-action="es-agreement-new"]` | PASS | PASS | PASS | PASS |
| 15 | invitations.js:2669 (#3) | Ask to re-verify | none | `#console-investors → [data-action="reverify-request"]` | PASS | PASS | n/a | n/a |
| 16 | integrations.js:1627 (#2) | Add a connection | none | `#console-integrations → [data-action="iv-conn-add"]` | PASS | PASS | n/a | n/a |
| 17 | integrations.js:1734 (#3) | Remove a connection? | connection | `#console-integrations → [data-action="iv-conn-remove"][data-id="{conn}"]` | PASS | PASS | n/a | n/a |
| 18 | invitations.js:2591 (#2) | Invitation email (an open invitation) | invitation | `#console-investors → [data-action="invite-preview"][data-id="{newInv}"]` | PASS | PASS | n/a | n/a |
| 19 | invitations.js:2780 (#4) | Cancel this invitation? | none | `#console-investors → [data-action="inv8-cancel"][data-id="{it}"]` | PASS | PASS | n/a | n/a |
| 20 | invitations.js:2575 (#1) | Invitation cancelled | invitationClosed | `#console-investors → [data-action="invite-preview"][data-id="{newInv}"]` | PASS | PASS | n/a | n/a |
| 21 | esign.js:1726 (#1) | Delete this template? | templatesTab | `[data-action="es-tpl-del"]` | PASS | PASS | PASS | PASS |
| 22 | esign.js:2182 (#3) | Read the PDF again? | editorRead | `[data-action="es-reread"]:visible` | PASS | PASS | PASS | PASS |
| 23 | esign.js:2480 (#4) | Delete this draft? | draft | `#console-envelope-{draft} → [data-action="es-delete"]` | PASS | PASS | PASS | PASS |
| 24 | esign.js:2506 (#5) | Review and send | draftFields | `#console-envelope-{draft} → [data-action="es-review"]` | PASS | PASS | PASS | PASS |
| 25 | esign.js:2543 (#6) | Save as template | none | `#console-envelope-{draft} → [data-action="es-save-tpl"]` | PASS | PASS | PASS | PASS |
| 26 | taxdocs-ui.js:537 (#1) | Tax document pages | taxImport | `[data-action="tx-view"]` | PASS | PASS | n/a | n/a |
| 27 | integrations.js:914 (#1) | Verification (Verify now) | asInvestor | `#account → #main [data-action="iv-start"]` | PASS | PASS | n/a | n/a |
| 28 | portal.js:1160 (#2) | A document (investor Documents) | asInvestor | `#documents → [data-action="open-doc"]` | PASS | PASS | PASS | PASS |
| 29 | portal.js:1102 (#1) | An uploaded document | uploadedDoc | `#documents → [data-action="open-doc"][data-id="doc-p18-upload"]` | PASS | PASS | PASS | PASS |
| 30 | esign.js:2890 (#7) | Decline to sign (W-9 signing view) | w9View | `[data-action="es-decline"]` | PASS | PASS | n/a | n/a |
| 31 | signature.js:673 (#1) | Adopt your signature (W-9) | w9Consent | `#main [data-fid="{sigField}"]` | PASS | PASS | n/a | n/a |
| 32 | esign.js:3465 (#9) | Signed by you, waiting for countersignature | onboarded | `#documents → [data-action="es-open-mine"]` | PASS | PASS | n/a | n/a |
| 33 | esign.js:3040 (#8) | A signed document with its certificate | signedDoc | `#documents → [data-action="es-open-doc"]` | PASS | PASS | n/a | n/a |
| 34 | esign.js:1915 (#2) | Void the agreement? | asAdminEnvelope | `#console-envelope-{agrEnv} → [data-action="es-void"]` | PASS | PASS | n/a | n/a |

(The table comes from the final full run, O/full-1.txt, and matches the gate's run. Rows 31 and 27 used a class scope in
that run and were changed to `#main` in fdf6ea6, then rerun at both sizes on both trees: PASS. The gate's run on fdf6ea6
passed all 50 row × edition at each size.)

### Dialogs that needed a state helper (no click in these steps sends, deletes or saves, except as listed)

- Every session starts from P6 setupPortal's agreement state, written without its reload: a raising offering with phase
  4's agreement and fields, set to Rule 506(c) for the re-verify row and back to 506(b) for the invitation walk. The rows
  marked early run first, on the sample as it is.
- coinvestor #2, #6 and #1: a co-investor with a sign-in link is written onto an investor. For #1 the link's expiry is moved
  into the past.
- coinvestor #5: an empty Add co-investor form is submitted. Its own checks refuse it and nothing is saved.
- console #2: a recorded distribution is loaded whose ACH file the sample already holds as sent. No file is built.
- integrations #3: a hosted-link connection is written into the workspace.
- invitations #2, #4 and #1: P6 createInvitation makes an invitation record. For #1 that record is then marked cancelled.
- esign #4, #5 and #6: a draft envelope is made from the agreement template (Use, one signer ticked, the countersigner named,
  "Continue to place fields"). This step keeps a draft.
- esign #3: the agreement draft is opened with Edit fields and given a reading and its file id.
- taxdocs #1: P10's K-1 fixture is imported (Import keeps a batch) and its page is opened.
- portal #1 and esign #8: the document records are written for the investor.
- esign #7, signature #1, esign #9 and esign #2: P6 createInvitation, then P6 walk submits each step up to the W-9 view.
  Consent is given, the W-9 is finished unsigned (D-30) and the agreement is finished.
- flows: Create on the report builder keeps the new report. The builder has no other way to open a starter template.

## The SAME SCREENS interface the later plans use

Run it (the gate does this as step 6 with P18_BASE = GATE_OUT/gate/base-tree):
```
P18_BASE=<dir holding index.html> | P18_BASE_COMMIT=<commit> NODE_PATH=$(npm root -g) P6_OUT=<dir> P6_SHOTS=<dir> \
  bash $S/exec-011/heavy.sh node .planning/phases/18-ui-overhaul/checks/same-screens.js [--only selftest,console-desktop,...]
```

**Output.** The last line is `SAME SCREENS: PASS (parts run: 11)`. Each screen prints one line:
- `PASS <part> <key>[ (<rules applied>)]`, or
- `FAIL <part> <key>: <region> <where>: base "…" plan "…"`, with runs of 6 or more digits masked.

Regions:
- `frame lines` and `frame actions` are multisets, so a control may move between the bar, the rail, the header and the
  footer;
- `content lines`, `content actions` and `heads` are ordered;
- `charts` follow the §7.11 rule (CH);
- `dialog` and `empty record`.

**lib18.js** (`// gate: none`):
- ROOT, P6, P10, P13, L, T, L13, S18;
- baseRoot(), archiveTree(commit), removeTree(t), serveDir(dir);
- framedAt(S, size, { root, origin, page, freeze, clock, policy }), PHONE, notePhone(), freeze(context, day),
  clockScript(day);
- record(fr, { key, size, root, wait }), readScreen;
- mask(s), noVendor(text);
- style(fr, sel, props), rect(fr, sel), contrast(fg, bg), panelOk(fr, sel).

**screens18.js** (`// gate: none`):
- normalize(raw);
- the named patterns ID_RE, HASH_TOKEN_RE, ORIGIN_RE, TIME_RE and ISO_TIME_RE;
- RULES C1, C2, C3, C4, C5, C6 (with the Q4 switch), C7 and M; chartsSame (CH);
- compare(base, plan, { rules, ctx: { baseByKey } }), which returns { ok, diffs, applied | tried };
- line(part, key, res);
- DIALOGS, MARKS24, MARK_MAP, FONT_LABELS, NEW_FONT.

**How a later plan uses it:**
- A restyle that changes no word, action, heading or chart passes with no rule applied.
- A plan that lands one of C1..C7 or M passes when every difference is exactly one of those transforms. Any subset of the
  applicable rules is accepted, in table order. `opts.rules` limits which rules may apply.
- A plan that adds a `U.dialog(` call must add its DIALOGS row (`file`, `nth`, editions, setup, open steps by data-action
  or id).
- The selftest builds its stand-ins from P18_SELFTEST_COMMIT (d36521b). A plan that changes a rule reruns the selftest.
- `P18_DIALOGS_ONLY=<file#nth,...>` runs only some rows, for debugging. Such a run always fails.

## gate18.sh

`GATE_OUT=<dir> bash .planning/phases/18-ui-overhaul/checks/gate18.sh [--self-test | --only-phase18]`. It runs six steps:
1. The reference gate, rewritten to this checkout and GATE_OUT/gate.
2. The server count: this tree against the base tree measured in the same run, plus the declared markers.
3. Phases 12, 13, 14, 15 and 16, always.
4. GATE18_PHASES (from 08 09 10 11; 08 by its `// GATE CHECK` rule).
5. PHONE LAYOUT desktop against a base-commit copy that holds this tree's phase 6 checks (PHONE_LAYOUT_BASE,
   PHONE_LAYOUT_18=1). It passes on exactly `PHONE LAYOUT: PASS (parts run: 4)`.
6. Every phase 18 check, with P18_BASE and P10_BASE..P16_BASE set to the base tree.

The steps are resumable through gate-lib.sh. The self-test ends `GATE18 SELF-TEST: PASS (10)`.

## Deviations from Plan

**1. [Rule 1 - Bug] Lines are grouped by tag, not split from innerText.**
innerText follows computed display and text-transform, so a pure restyle would report word changes that are not there.
Instead, a run of text inside phrasing elements (span, strong, em, code …) is one line, and every other element (or a
`<br>`) ends a line. The words and the DOM order are the same. Text in `<svg>` and `[role="img"]` is left out of the lines;
charts keep the `[role="img"]` text.

**2. [Rule 2 - Missing] The frame also holds `#opbar`, `#demo` and `#notes`.**
§11 lists the operator bar and the preview bar as part of the frame.

**3. [Rule 1 - Bug] More random parts are normalized, each by a named pattern.**
- ID_RE now covers the portal's other id makers: the uid() prefixes invt, tm, fd, ntf, tf, sg, n, mail, dep and aml; taxdocs
  `tb-`; connection ids `c_`; and any prefix followed by a 13-digit Date.now(). Before this, `tm-…` and `invt-…` failed
  the console Team page and the invitation dialogs on an unchanged tree.
- `co-` is replaced only when it holds a digit, so "co-investor" and "Co-Investment" stay words (the plan's form masked
  them).
- ORIGIN_RE and ORIGIN_ENC_RE replace each tree's own port. HASH_TOKEN_RE also covers `#co-`. mailto: links are compared
  decoded.
- TIME_RE and ISO_TIME_RE cover the time of day. The clock is lib10's: the day is frozen and the clock runs on from noon,
  so the two walks reach a step some seconds apart ("12:00:16 PM" against "12:00:15 PM" in the envelope history). The
  date is still compared.

**4. [Rule 1 - Bug] Vendor-name and outside-request checks fail only on what this tree adds.**
In the plan's form these checks cannot pass on an unchanged tree, because of the two product findings above. A name or
request that the base tree shows too is printed as a NOTE.

**5. [Rule 2 - Missing] compare() accepts any subset of the applicable rules.**
The rules land in different plans: 18-03 (C6, C7), 18-06 (C1 to C3) and 18-08 (C4, C5, M).

**6. [Rule 3 - Blocking] The selftest uses stand-ins built from a pinned commit, and a stand-in may make several edits.**
Copies of this tree stop matching their literal replaces once a later plan changes those lines (for example, C1 removes
"Help"). c6-wrong and c6-q4 each need two files edited.

**7. [Rule 2 - Missing] Records and parts check more than the plan listed.**
Each record holds every data-* attribute, the id, select options, readonly, required and aria-current. Each part also fails
on a script error that this tree has and the base tree does not.

**8. DIALOGS rows are keyed `file#nth`, with the line at d36521b kept for reference.**
13-09 is editing these files now, so the line numbers will shift. The dialogs parts print today's lines.

**9. Editions: 16 rows run on both editions, 18 on diy.html only.**
index.html has none of the following: Help, the bell, the co-investor sign-in emails, the sign-up link, the Integrations
page, re-verify, the invitations list, Tax documents, or Verify now on Account. The W-9, signed-document and void rows need
the self-serve invitation walk, which index.html does not have. The plan named the integrations.js and invitations.js
dialogs as reachable on index.html; they are not.

**10. The closed-offering join page is not recorded.**
It has no action at all, so the empty-record rule would fail it on an unchanged tree. The open-offering join page is
recorded.

**11. The Task 3 RED ran the two dialogs parts only.**
The verify greps only their FAIL line.

**12. Marker commits.**
- 9c24769 marks the Task 1 RED; its content is in a4217c4.
- f37603d marks the Task 3 GREEN; its content is in the saves after a16dffc.

**13. The phone profile is Playwright's devices['iPhone 13'], as the plan says.**
Its viewport is 390x664, on a 390x844 screen.

**14. STATE.md, ROADMAP.md and REQUIREMENTS.md were not updated in this worktree.**
The orchestrator merges; the plan prompt said to write the SUMMARY and push.

## Known open items

- Rules M (D-05), C5, C2 and C7 are written as exact transforms, but no stand-in exercises them; the plan's selftest list
  does not name them. 18-03 (C7) and 18-08 (M, C5) should add a control on their own trees.
- §11 screens not walked, because the plan's part lists do not name them:
  - the standalone signer page `sign-<id>`;
  - the co-investor page `co-<token>`;
  - `taxdoc-<id>`;
  - unsubscribe;
  - the managed New client page.
  The plans that touch these screens (18-04 signer, 18-10/18-11) should add them.
- The phone parts run Chromium with the iPhone profile. Safari is covered only by the owner's iPhone check.

## Self-Check: PASSED

- FOUND: the four check files under .planning/phases/18-ui-overhaul/checks/.
- FOUND in HEAD's history: 9c24769, 3ba688c, bf6b39e, 27b3bb0, a16dffc, f37603d, fdf6ea6.
- No product file changed against d36521b (`git diff --quiet d36521b HEAD -- assets index.html diy.html portal.html
  server mobile`).
