---
phase: 08-verification-package-and-ongoing-compliance
plan: 11
subsystem: console (self-serve edition), help guide, phase 8 checks
tags: [aml-program, D-04, VPK-09, owner-preview, gate]
status: complete
requires: ["08-06"]
provides:
  - "assets/js/amlprogram.js: NS.views['console-aml'] (edition diy), NS.amlProgram (record, procedures, screeningLog, exportHtml, RETENTION, NONE), form aml-save, actions aml-add, aml-remove, aml-export"
  - "workspace field ws.amlProgram { policy { statement, scope, adoptedOn, approvedBy }, officer { name, title, designatedOn }, risk, escalation, training [{ id, who, on }], reviews [{ id, who, on, findings }] }"
  - "menu entry console-aml 'AML program' under Report, after AML/KYC"
  - "audit actions 'AML program record updated' and 'AML program record exported'"
  - "help guide entry console-aml; server/lib/help-guide.mjs regenerated"
  - "checks/aml-record.js: GATE CHECK AML RECORD, 7 parts"
affects: [09 (Filings goes after AML program in the menu), 08-13 (guide.md)]
tech-stack:
  added: []
  patterns:
    - "a page's form wraps its panels with display:contents so the panels keep the page's spacing"
    - "field errors written into the form in place (no re-render), so typed text is never lost"
key-files:
  created:
    - assets/js/amlprogram.js
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/aml-record.js
  modified:
    - assets/js/console.js
    - diy.html
    - index.html
    - portal.html
    - server/help/guide.md
    - server/lib/help-guide.mjs
decisions:
  - "The screening log is compiled from the audit log's screening and review entries (every screening of every investor, with its date, connections, result, reviewer and note), not only each investor's latest result: the audit log is the full, hash-chained history"
  - "Typed fields are saved with one Save button; adding or removing an entry saves the typed fields with it, so nothing typed is lost"
  - "Dates use the console's own date fields; a date the browser cannot read, or that is not a real calendar date, shows 'Enter a real date.' under the field and nothing is stored"
  - "The export is one self-contained HTML file (no script, nothing loaded from outside); its audit entry holds the file name and its SHA-256"
metrics:
  duration: "about 3 h 45 min of wall time (18:47 to about 22:35 UTC, 2026-11-19), most of it waiting in the shared browser queue; the gate run itself took about 2 h (20:35 to 22:32)"
  completed: 2026-11-19
actuals:
  tokens: 13500
  tasks: 2
  commits: 2
plan_head_before: 2163866402571e8f8b89e3347a98fce96416d3b4
plan_head_after: 54ea6cb9e431e68ecd2c032b909bfbf7b67fde06
---

# Phase 8 Plan 11: The AML program record Summary

One console page, Report then "AML program", self-serve edition only. Eight sections: Policy, Responsible person, Risk assessment, Procedures in force, Screening log, Escalation, Training and independent review, Retention. The sponsor types only what nobody else can know. The procedures come from the Integrations settings, and the screening log comes from the audit log. "Export" saves the whole record as one HTML file that opens and prints anywhere, and writes an audit entry with the file's SHA-256. Everything works with no server.

Not done until the owner has checked it on his iPhone (human check below).

## Failures first

- No gate failure. The full gate passed on its first run (GATE_EXIT=0).
- The first tracer run was stopped by the 30-minute background limit before it got a slot in the shared browser queue. It never ran. It was started again with a longer limit and passed.
- The RED run for Task 2 (red2.txt) failed only in part `entries`. Parts empty-roles, managed, preview-desktop and preview-phone passed against Task 1's code, because Task 1 already shipped read-only fields for a team member, the edition guard and the no-server page. To show those parts are not empty checks, a mutation run (red2-mutation.txt) ignored the role and the edition. empty-roles failed (9 typed fields editable for a team member). managed failed 4 checks: "AML program" in the managed menu, in its Report section and on #console-aml, and allowed() true.
- One visual fault was found in the first screenshot and fixed before Task 2: the panels sat with no gap between them, because the form wrapping them was not part of the page's layout. The form now uses display:contents. Every later run was on the fixed code.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 (tracer) | the page, compiled procedures and screening log, one-file export, menu entry, script tags, help guide entry | 1fc726b |
| 2 | entries (add, remove, newest first), date errors, roles, owner's preview, managed edition, full gate | 54ea6cb |

## RED runs (SCRATCH/exec-08-11)

- red.txt, base 2163866: `AML RECORD: FAIL (parts run: 2) - record, export`, 0 PASS lines. The Report menu was ["Reports","Audit","AML/KYC"] and there was no page.
- tracer.txt, after Task 1: `AML RECORD: PASS (parts run: 2)`, 37 PASS lines.
- red2.txt, Task 2 parts on Task 1's code: `AML RECORD: FAIL (parts run: 5) - entries` (page.fill timed out: no entry fields). 76 PASS lines in the other four parts.
- red2-mutation.txt (role and edition ignored): `AML RECORD: FAIL (parts run: 2) - empty-roles, managed`.
- green2.txt, Task 2: `AML RECORD: PASS (parts run: 7)`, 134 PASS lines.

## Verification

Task 1 verify: `AML RECORD: PASS (parts run: 2)`. The three entry pages each hold amlprogram.js once, and their script lists are identical. R1: `(cd server && node --test test/help-guide.test.mjs)` gave `# tests 8`, `# pass 8`, `# fail 0`.

Task 2 verify (R2: `P8_SERVER_TESTS=272`, measured by a run on the base: `# tests 272 / # pass 272 / # fail 0`; this plan adds no server test). The gate's last lines, verbatim:

```
GATE ok   server tests # fail 0
GATE ok   server tests 272 (found 272)
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
GATE ok   phase-8 gate checks found (2)
GATE ok   AML RECORD (7)
GATE ok   PACKAGE INVITE (9)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 272
# pass 272
# fail 0
COUNTS server tests 272; AML RECORD 7; PACKAGE INVITE 9
GATE_EXIT=0
VERIFY2_EXIT=0 (gate exit 0)
```

What AML RECORD proves, by part:
- record (1280x800): "AML program" comes right after "AML/KYC" in Report. The page shows eight headed sections in order. Typed values are kept after Save and a page reload. A re-screen interval of 45 saved on Integrations reads "Every 45 days". The procedures name the connections in use for each check, the accreditation rule, the validity period, the PEP hold and the approval rule. A sample investor re-screened from the AML/KYC page shows today's date, "Sandbox: no matches" and the entry name. A potential match cleared on the AML/KYC page with a note shows the reviewer, the decision and the note. Newest entries come first. The retention line is "Sanctions records are kept for ten years."
- export: one .html file with no script and nothing loaded from outside. Read from the saved file: the eight headings in order, every typed value, every procedures line, the screening-log rows identical to the page's, and the retention line. One audit entry "AML program record exported" naming the file.
- entries: three training entries listed newest first. A review entry with findings is added; one training entry and the review are removed (from the page and the record). A date typed as 02/30/2026 or 13/45/2026 shows "Enter a real date." under the field, and nothing is stored. The typed statement stays in its field. With a real date it saves. Escaping: a statement holding `</textarea><script>` and an `<img onerror>`, and a name `<script>alert(1)</script>`, show as text on the page and in the export. Nothing ran and no dialog opened, and the file holds no script and no image.
- empty-roles: on an untouched record, the page shows empty fields with the compiled sections filled. The export holds "Not recorded" exactly 11 times (9 typed fields and 2 empty lists). A team member sees every field read-only with no Save, Add or Remove, can export, and the export is logged in their name. A forced submit changes nothing. An investor opening #console-aml gets no AML program page.
- managed: the managed menu has no "AML program", and its Report section is still Reports, Audit, AML/KYC. #console-aml shows nothing new, and allowed('console-aml') is false. STATUS MATH's managed slices pass (C-03).
- preview-desktop and preview-phone (sandboxed frame, connect-src none, no server; 1280x800, and 390x844 with touch): the frame refuses fetch(). The page opens from the menu (by tap on the phone) with its eight headings. A typed statement is saved. The screening log scrolls inside its own box, with no sideways page scroll. Export gives exactly one download. The menu leaves the page, and the statement is still there on return. No refused connection was recorded, no raw error appeared, and nothing outside the page was requested.
- Every part ends with phase 6's leak check and frame.js's vendor scan of everything it saw. The vendor scan is first proved on planted words.

## Plan-check additions applied (08-CONTEXT R1 to R3)

- R1: `## console-aml` added to server/help/guide.md (audience sponsor, kind console, title AML program, menu "Report, then AML program"). Its anchors are "AML program" and "Sanctions records are kept for ten years." (41 characters, held verbatim in amlprogram.js). Every quoted name is screen text. "AML program" was added to the Report list in `## console`. The module was regenerated with `node server/help/build.mjs`, and the help-guide test passes 8/8. No on-screen text was reworded.
- R2: the base count was measured by a run (272) into base-count.txt, the gate was run with `P8_SERVER_TESTS=272`, and the COUNTS line is quoted above.
- R3: the NAV entry is on its own line after console-kyc. The script tag is on its own line after console.js in each entry page. The generated module was regenerated, never hand-edited.

## Lines added to shared files

- assets/js/console.js, NAV: added line `    ['console-aml', 'AML program'],` directly after `    ['console-kyc', 'AML/KYC'],`.
- assets/js/console.js, NAV_SECTIONS: the one Report line changed to `    ['Report', ['console-reports', 'console-audit', 'console-kyc', 'console-aml']],` (phase 09 appends Filings to this same line; merge by keeping both, order AML/KYC, AML program, Filings).
- diy.html, index.html, portal.html: added line `  <script src="assets/js/amlprogram.js"></script>` directly after `  <script src="assets/js/console.js"></script>`.
- server/help/guide.md: new section `## console-aml` between `## console-kyc` and `## console-brand`. In `## console`, "Report (Reports, Audit, AML/KYC)" became "Report (Reports, Audit, AML/KYC, AML program)".
- server/lib/help-guide.mjs: regenerated, not hand-edited. At merge, run `node server/help/build.mjs` again after guide.md is merged.

## Deviations from Plan

1. **[Rule 1 - Bug] Panels had no gap between them** (seen in the tracer screenshot). The form wrapping the panels now uses display:contents. Commit 54ea6cb.
2. **[Rule 2 - Correctness] Entries carry an `id`** (`{ id, who, on }`, `{ id, who, on, findings }`), so Remove takes away exactly the entry chosen. The plan's data shape had no id.
3. **Saves are logged.** Each save writes one audit entry "AML program record updated" listing the fields that changed. A change to an AML program record should leave a trace; the plan only asked for the export entry.
4. The plan says "No push"; the orchestrator's prompt asks for a push to wip/08-11, and that was followed.
5. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (AUTOPILOT.md). VPK-09 and VPK-10 are left for the orchestrator to mark.

## Human check (owner, not yet done)

In the published preview on the iPhone: Console, then the menu, then Report, then AML program. Type a policy statement, choose Save, then choose Export. Expected:
- eight short sections with no paragraphs of explanation
- the typed text still there after leaving the page and coming back
- Export saves or offers one file
- the menu leaves the page
- no error text

## New files a preview build must add

- assets/js/amlprogram.js (loaded by diy.html, index.html and portal.html).

## Known Stubs

None. "Not recorded" is the export's text for a field the sponsor left empty, by design.

## Threat Flags

None beyond the plan's threat model. T-08-30: every typed and compiled value goes through h() on the page and in the export, the export holds no script, and each export writes an audit entry. Proved by the escaping checks in part entries and by part export.

## Self-Check: PASSED

- FOUND: assets/js/amlprogram.js, checks/aml-record.js
- FOUND in HEAD's history: 1fc726b, 54ea6cb
- diy.html, index.html and portal.html script lists are identical and each loads assets/js/amlprogram.js once
