---
phase: 16-nacha-ach-and-the-zero-cost-money-path
plan: 02
subsystem: payments (NACHA file record, console Distributions)
tags: [nacha, ach, file-record, payment-release, both-editions]
status: gate-failed
requires: [16-01 gate16.sh, 16-05 builder checks/blocked, 13-05 page script lines]
provides: [NS.achRecord (assets/js/achrecord.js), FILE RECORD (6), ACH FLOW (5)]
affects: [16-07 (adds to achrecord.js), 15-08 (canPay, masked preview), 16-13 (guide line), 13-09 and 15-17 (console.js, diy.html, portal.html)]
key-files:
  created: [assets/js/achrecord.js, .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/file-record.js, .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/ach-flow.js]
  modified: [assets/js/console.js, diy.html, index.html, portal.html]
decisions:
  - "16-CONTEXT wave 1 B4 applied over the plan's interfaces: a recorded, non-cancelled run with no file record is treated as paid; a draft loaded from the History targets { runId } whatever is edited (d.forRun, kept apart from fromRun, which phase 10 checks drop on edit)"
  - "W5: a person without canPay gets the preview with every account shown as * plus the last four (field view too) and no Download, Copy or Build again buttons (not rendered), with 'Only an admin can download or copy a payment file.'"
  - "The same file already on record may be downloaded or copied again (same bytes, same file ID) with a change-log entry and no new record; a second, different file needs Build again"
  - "A draft key is kept on every distribution record, so a new draft for the same offering and payment date as a recorded run's file also needs Build again (unless that run is cancelled)"
server_tests: "567 = base 567 + 0 declared (measured by gate16.sh in this run)"
start_commit: 38a85ea0f5f3c62e74a629ef7589a67846d6751f
---

# Phase 16 Plan 02: payment file record Summary

One file per payment in both editions: every NACHA file the console lets out is recorded (who, when, file ID, per investor the trace, amount, code and account ending; never a full account number or the file's text), a file ID is taken only when a file leaves, a second file for a distribution needs "Build again" with a reason, a red check keeps Download and Copy closed, and only an admin (self-serve) releases a file.

Nothing here is ready until the owner has checked it.

## FAILURES FIRST

1. **gate16.sh ended GATE_EXIT=1.** Four steps failed; the plan's own checks and every step the plan names passed.
   - **AUDIT FLOW, BOOKS FLOW, PACKAGE FLOW (phase 11), part `managed` of each: caused by this plan.** Each asserts that index.html is unchanged against the base commit (audit-flow.js: `git diff --quiet <base> HEAD -- index.html`; books-flow.js and package-flow.js: index.html byte for byte equal to the base tree, 3029 vs 3078 bytes). This plan adds one line to index.html, `<script src="assets/js/achrecord.js"></script>` after nacha.js, as the plan requires (files_modified lists index.html; C-12 makes AC-06 a builder fix in both editions; Task 1's verify checks the line in index.html; part managed-desktop proves the managed record). Every other check in those three parts passed. Since 11-07, no plan has changed index.html, so this plan is the first to meet these guards. The plan's rule is that a check of another phase is not edited here: **stopped and reported. Decision needed** (options at the end).
   - **SECTIONS (phase 15, case keys): not caused by this plan.** `mailLog (emails.js)` has no SECTIONS line. The start tree 38a85ea fails it the same way (run separately on an extracted start tree: `FAIL keys every key found (26) has a SECTIONS line :: mailLog (emails.js)`). It comes from 13-05's emails.js script line meeting 15-06's SECTIONS table. Logged in deferred-items.md.
2. ach-flow.js on this tree failed once before passing. It was a fault in the check, not in the product: the sample's change log is seeded on first use, so the baseline was read before the log existed. Fixed in the check (NS.audit.ensureLog before the baseline).
3. The first owner screenshots showed only messages over the top of the page. Fixed in the check: messages are cleared and the file section is scrolled into view before each shot.

## Gate (Task 3; 16-CONTEXT re-check B1 prefix and B2: gate16.sh, GATE16_PHASES="12 13 15")

verify3 (O/gate.sh): B1 prefix passed (rec.txt and flow.txt PASS lines, achrecord.js present, no `log.push({ date: todayIso, modifier` in console.js), then `GATE16_PHASES="12 13 15" GATE_OUT=O bash $P/checks/gate16.sh`.

Required lines (all present):
```
GATE ok   server tests 567 = base 567 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   WITHHOLDING FLOW
GATE ok   AUDIT SAME
GATE ok   ROLES TABLE
GATE ok   ACH FLOW
GATE ok   ACH LEAK
GATE ok   FILE RECORD
GATE ok   MOBILE SYNC
```
Failed lines:
```
GATE FAIL AUDIT FLOW
  audit-flow.js: the last line was:       AUDIT FLOW: FAIL (parts run: 4) - managed
GATE FAIL BOOKS FLOW
  books-flow.js: the last line was:       BOOKS FLOW: FAIL (parts run: 8) - managed
GATE FAIL PACKAGE FLOW
  package-flow.js: the last line was:       PACKAGE FLOW: FAIL (parts run: 6) - managed
GATE FAIL SECTIONS
  sections.js: the last line was:       SECTIONS: FAIL (cases run: 2) - keys
```
The gate's last 15 lines:
```
GATE FAIL SECTIONS
  sections.js: the last line should be: SECTIONS: PASS (cases run: 2)
  sections.js: the last line was:       SECTIONS: FAIL (cases run: 2) - keys
GATE ok   SERVED PORTAL
GATE ok   TOTP FRAME
GATE ok   ACH FLOW
GATE ok   ACH LEAK
GATE ok   FILE RECORD
GATE ok   HOLIDAYS
GATE ok   MOBILE SYNC
GATE ok   NACHA BUILD
GATE ok   POSTING RETURNS
GATE ok   INDEPENDENT READER
GATE ok   RETURNS READ
GATE_EXIT=1
```
GATE_EXIT=1 (89 "GATE ok" lines, 4 "GATE FAIL" steps). VERIFY3_EXIT=1. The reference gate passed every step it runs. Server tests: 567 on this tree = 567 on the start tree + 0 declared (this plan adds no server test).

## Evidence (pasted as produced)

### RED 1 (Task 1, `node file-record.js --case record`, before achrecord.js exists; O/red-1.txt)

```
FAIL record NS.achRecord is loaded with the portal
PASS record the fixture file has no red check
FAIL record B4: a recorded run with no file record is refused a file without a reason :: Cannot read properties of undefined (reading 'recordFile')
FAIL record ran to the end :: TypeError: Cannot read properties of undefined (reading 'ensure')
FILE RECORD: FAIL (cases run: 1) - record
```

### Task 1 verify (verify1.sh = the plan's Task 1 automated line)

```
PASS record a second file for that run without a reason is refused with the sentence
PASS record and nothing more is stored
FILE RECORD: PASS (cases run: 1)
VERIFY1_EXIT=0
```

### RED 2 (Task 2: both checks run on the start tree 38a85ea with this plan's check files copied in; O/red-2.txt, FAIL lines and last lines only, long digit runs cut to their last four)

```
# file-record.js (6 cases) on the start tree 38a85ea with this plan's check files copied in
FAIL record NS.achRecord is loaded with the portal
FAIL record B4: a recorded run with no file record is refused a file without a reason :: Cannot read properties of undefined (reading 'recordFile')
FAIL record ran to the end :: TypeError: Cannot read properties of undefined (reading 'ensure')
FAIL modifier ran to the end :: TypeError: Cannot read properties of undefined (reading 'modifierFor')
FAIL draft ran to the end :: TypeError: Cannot read properties of undefined (reading 'recordFile')
FAIL again ran to the end :: TypeError: Cannot read properties of undefined (reading 'recordFile')
FAIL refuse no person ("") is refused with its sentence :: Cannot read properties of undefined (reading 'recordFile')
FAIL refuse no person ("   ") is refused with its sentence :: Cannot read properties of undefined (reading 'recordFile')
FAIL refuse no person (null) is refused with its sentence :: Cannot read properties of undefined (reading 'recordFile')
FAIL refuse no person (undefined) is refused with its sentence :: Cannot read properties of undefined (reading 'recordFile')
FAIL refuse ran to the end :: TypeError: Cannot read properties of undefined (reading 'ensure')
FAIL canpay ran to the end :: TypeError: Cannot read properties of undefined (reading 'canPay')
FILE RECORD: FAIL (cases run: 6) - record, modifier, draft, again, refuse, canpay
# ach-flow.js (5 parts) on the start tree 38a85ea with this plan's check files copied in
FAIL history-phone Generate NACHA file pressed three times builds the file (file ID A) and writes nothing to ws.achLog :: {"g":{"name":"KB_FUND_II_LP_20261120_C.ach","modifier":"C"},"before":0,"after":3}
FAIL history-phone and no change-log entry (a preview is not an event) :: ["Offering set up","Capital call issued",...]
FAIL history-phone Download leaves one file and records it with file ID A :: {"got":true}
FAIL history-phone the downloaded bytes equal the record’s entries by trace and amount :: {"n":11}
FAIL history-phone the record is kept by offering and payment date, by the signed-in person
FAIL history-phone Record distribution records the run and puts the file on it :: {"run":"kb-fund-ii-2026-11-20-mwni01nd"}
FAIL history-phone the History’s "ACH file" shows the record: sent, by whom, file ID, and no file text :: ACH file KB_FUND_II_LP_20261120_D.ach Download file Copy file ...
FAIL history-phone each entry shows its account ending and trace :: 0
FAIL history-phone no new file is built for it
FAIL history-phone the record: no full bank account number on the page (19 known) :: ["ending 3307","ending 1138","ending 1327","ending 7313","ending 2613","ending 6210","ending 3684","ending 3700","ending 3171","ending 2538","ending 1477"]
FAIL history-phone ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FAIL gating-desktop Download and Copy are disabled with "Fix the checks marked in red first." :: {"text":"ACH file KB_FUND_II_LP_20261225_B.ach Download file Copy file ...
FAIL gating-desktop nacha-download pressed through the action is refused with the reason :: Downloading KB_FUND_II_LP_20261225_B.ach
FAIL gating-desktop nacha-copy pressed through the action is refused with the reason :: Copy is blocked here. The text is selected; press Ctrl+C or Cmd+C.
FAIL gating-desktop nothing left: no download, no record, no change-log entry :: {"downloads":1,"ach":0,"audit":1}
FAIL draft-desktop a draft’s file is downloaded and recorded with no run
FAIL draft-desktop the new draft opens with the already-sent sentence :: ACH file KB_FUND_II_LP_20261120_B.ach Download file Copy file ...
FAIL draft-desktop its Download and Copy wait for Build again :: {"text":"ACH file KB_FUND_II_LP_20261120_B.ach Download file Copy file ...
FAIL draft-desktop pressed through the action it is refused with the sentence and nothing is recorded :: Downloading KB_FUND_II_LP_20261120_B.ach
FAIL draft-desktop ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FAIL team-phone no Download, Copy or Build again for a team member, with the admin sentence :: {"text":"ACH file KB_FUND_II_LP_20261120_A.ach Download file Copy file ...
FAIL team-phone the preview shows each account by its last four (the rest masked), records still 94 characters :: {"n":11,"all":false}
FAIL team-phone the preview and its field view: no full bank account number on the page (19 known) :: ["ending 3307","ending 1138",...]
FAIL team-phone nacha-download pressed through the action is refused with the admin sentence :: Downloading KB_FUND_II_LP_20261120_A.ach
FAIL team-phone nacha-copy pressed through the action is refused with the admin sentence :: Copy is blocked here. The text is selected; press Ctrl+C or Cmd+C.
FAIL team-phone ran to the end :: frame.evaluate: TypeError: window.CVPortal.actions[a] is not a function
FAIL managed-desktop Generate writes nothing in the managed edition too
FAIL managed-desktop Download records the file (file ID A) and the bytes equal the record
FAIL managed-desktop the History shows the record of the file sent, with Build again, and no second file :: ACH file KB_FUND_II_LP_20261120_B.ach Download file Copy file ...
ACH FLOW: FAIL (parts run: 5) - history-phone, gating-desktop, draft-desktop, team-phone, managed-desktop
```
What the start tree did, as measured above: it let a file with a red check (Christmas Day) download, and a team member download and copy. Each preview took a file ID (three Generates gave C). The History built a brand-new file (file ID D) for a run already paid.

On this tree the six file-record cases passed on their first run. achrecord.js was written whole in Task 1 to the interfaces block, so their RED is the start-tree run above.

### Task 2 verify (verify2.sh = the plan's Task 2 automated line; rerun on the committed checks before the gate)

```
PASS canpay managed: an investor may not
FILE RECORD: PASS (cases run: 6)
PASS managed-desktop no script error in the browser
PASS managed-desktop no request outside the page's origin
ACH FLOW: PASS (parts run: 5)
VERIFY2_EXIT=0
```

## Test counts

- FILE RECORD: 6 cases (record, modifier, draft, again, refuse, canpay), PASS.
- ACH FLOW: 5 parts (history-phone, gating-desktop, draft-desktop, team-phone, managed-desktop), 81 PASS lines, PASS. Both phone (390x844, touch) and desktop (1280x800), in the frame that refuses every connection.
- Server tests: 567 = base 567 + 0 (measured by gate16.sh).

## What was built

- assets/js/achrecord.js (NS.achRecord), loaded right after nacha.js in diy.html, index.html and portal.html (portal.html and diy.html keep 13-05's emails.js line).
- console.js, cited by function name:
  - `buildFile` takes `modifierFor(today)` and writes nothing (the `log.push` and `NS.app.save()` are gone). It sets file.target, file.sent, file.paidRun and file.again.
  - `fileSection` adds the already-sent or recorded-as-paid notice and keeps Download and Copy disabled while a check is red ('Fix the checks marked in red first.') or while the file waits for Build again. A person without canPay gets the masked preview and the admin sentence.
  - `sentSection` is the History's "ACH file" on a run whose file was sent.
  - `releaseFile` (nacha-download, nacha-copy) refuses in the three cases. It takes the file ID again and, if another file took it, builds once more and redraws before anything leaves. It then records the file, writes the change log entry ('NACHA file downloaded' or 'NACHA file copied': name, entries, total, effective date, file ID, 'built again: <reason>') and releases exactly file.text.
  - `againDialog`, nacha-again and nacha-again-go: 'Why is a second file needed?', 300 characters, Close, Cancel and Build again; an empty reason is refused with 'Enter the reason a second file is needed.'
  - nacha-build writes no change-log entry. dist-record attaches the draft's unattached files to the new run. dist-load sets forRun and shows the record when a file was sent; otherwise it builds the file from the stored net amounts as before, with the B4 notice.
- Phase 10's DIST FLOW, DIST RECORD and WITHHOLDING FLOW pass unchanged (the History still builds the file from the stored net amounts for runs with no file record; editing a field still drops fromRun).

## Interface 16-07 builds on (NS.achRecord)

Storage: `ws.achLog` (array). `ensure(ws)` creates it with the `ws.achLog = ... ws.achLog` idiom that SECTIONS finds. Entries from before this plan are `{ date, modifier, filename }`: they count as files of their date for every origin and destination.

File record (kind 'file'):
`{ id: 'af-<n>', kind: 'file', for: 'distribution'|'redemption'|'prenote'|'repay', runId: ''|id, offeringId, effective, draftKey: ''|'<offeringId>|<effective>', refs: {}, date (header creation date, YYYY-MM-DD), time (HHMM), modifier, origin, destination (from the header, no spaces), name, entries: [{ investorId, trace, cents, code, kind: 'credit'|'prenote', last4 }], credit, how: 'download'|'copy', by, at, again: null|{ why, of } }`.
Entries are read from the file's own type-6 records. The offsetting debit (individual id OFFSET, codes 27/37) is left out. No full account number and no file text is stored.

Functions (pure over the workspace except canPay):
- `ensure(ws)` → ws.achLog
- `keyOf(tenant | tenant.ach)` → `{ origin, destination }` (the destination falls back to odfiRouting; spaces removed; 10 characters)
- `modifierFor(ws, tenant, date)` → the first free letter of `MODIFIERS` ('A-Z0-9') for that origin, destination and date, or null (the 37th)
- `targetOf(meta)` → `{ runId }` | null for 'prenote', 'redemption' or 'repay' | `{ draftKey, for }`
- `filesOf(ws, target)` → newest first. A draft key matches records with that key whose run is absent or not cancelled.
- `sentFor(ws, target)` → the newest of filesOf, or null
- `paidRun(ws, runId)` → the run when it is recorded, not cancelled and has no file record (B4: treated as paid), else null
- `recordFile(ws, file, meta)` → the stored record; meta is `{ for, runId, offeringId, effective, how, by, at, again, tenant, refs }`. Refusals (an Error, nothing stored):
  - 'Sending a payment file needs the name of the person doing it.'
  - 'This file ID was used by another file today; build the file again.'
  - 'A file for this distribution was already sent on <Mon D, YYYY> (<name>). Use "Build again" and give the reason.'
  - B4: 'This distribution is recorded as paid on <Mon D, YYYY>. Use "Build again" and give the reason.'
  - 'This payment file has no file header; build the file again.'
  - With a null target (pre-note, redemption, repay), only the person, header and file ID rules apply. 16-07, 16-11 and 16-12 keep their own rule through refs.
- `attach(ws, recordId, runId)` → the record. Refused for an unknown id ('There is no record of that payment file.') or a record on another run ('That payment file is already on record for another distribution.').
- `canPay()` → managed edition: `NS.app.can('console')`; self-serve: `NS.app.can('pay') || NS.app.can('configure')`
- `sentOn(rec)` → the local day the file left; `longDay(iso)` → 'Nov 19, 2026'

## W5 note for 15-08

- canPay() is the one release test in phase 16. It already reads `NS.app.can('pay')`, so once 15-08's roles map gives Owner and Admin 'pay', nothing in achrecord.js or console.js needs pointing (I1).
- Built this way:
  - Generate NACHA file (nacha-build) stays an operate action.
  - A team member gets the preview with every type-6 account shown as `*` plus the last four, the field view too.
  - Download, Copy and Build again are not rendered for them, and the page shows 'Only an admin can download or copy a payment file.'
  - The actions refuse with that sentence when called directly.
  - Part team-phone asserts all of this.
- 15-08 may align the sentence with roles.js REFUSALS.pay. If it does, `ACH_ADMIN` in console.js and `ADMIN` at the top of ach-flow.js change together.
- ws.achLog is never written by a preview. It is written by Download and Copy (recordFile, canPay only) and by dist-record (attach). **Open:** dist-record by a team member attaches a draft's file to the new run, which writes achLog. With 15-06's server SECTIONS (`achLog: write 'pay'`), that save would be refused in server mode. 15-08 should decide whether the attach moves onto the run or a team member's recording may write it.

## Guide line for 16-13 (no guide bytes in this plan)

server/lib/help-guide.mjs, the Distributions entry, is untrue now: '"History" lists past distributions; "ACH file" beside one builds its file again.' Proposed:
'"History" lists past distributions; "ACH file" beside one shows the file sent for it: who sent it and when, its file ID, and each payment by account ending and trace. A second file needs "Build again" and a reason. Only an admin downloads or copies a payment file, and only while no check is red.'
'"Generate NACHA file" builds the bank's file' stays true. The change log no longer records a preview, only 'NACHA file downloaded' and 'NACHA file copied'.

## Deviations from Plan

1. **[16-CONTEXT wave 1 B4 wins over the interfaces block]**
   - A recorded run with no file record is treated as paid: the panel says 'This distribution is recorded as paid on <date>. A second upload pays every investor twice.', and recordFile refuses that run without again.why (again.of null).
   - Case record therefore records the file for the draft and attaches it to the run, instead of recording it on the run directly. Case draft and part history-phone cover a seeded sample run. Counts unchanged (6, 5).
2. **[16-CONTEXT W5 over the plan's "a team member can still generate and read the file"]** The team member's preview is masked to the last four. Download, Copy and Build again are not rendered (the plan said disabled).
3. **[Re-check B2]** Closed with gate16.sh and GATE16_PHASES="12 13 15", not gate11.sh. The B1 prefix ran before the gate.
4. **[Rule 2]** Further additions:
   - An amber-only file is proven not to block (gating-desktop).
   - The same file on record may leave again with no new record.
   - attach of an unknown record is refused.
   - A cancelled run's file no longer blocks a new draft for its offering and date.
   - A failed check in ach-flow prints no run of nine or more digits (company IDs, traces, accounts cut to their last four).
5. "lib10.leak finds no full account number" is done by the check's own `noAccounts`, because lib10.leak looks only for vendor names. It reads the page's text against every full account number of the sample (19). For someone who may release the file, it leaves out the file's own records, which W5 lets them read.

## Threat model

T-16-05 to T-16-09 are mitigated as planned:
- T-16-05: file record per run and per draft key; Build again only with a reason.
- T-16-06: file ID taken again at release; the 37th file of a day refused.
- T-16-07: canPay on Download, Copy and Build again.
- T-16-08: last four only; no file text stored; ACH LEAK passes over the new checks.
- T-16-09: red check blocks release.

## Open items

- **Decision needed: phase 11's managed index.html guards.** Options:
  - (a) Recommended: a small debugger or quick task (RED first) lets the three phase 11 managed parts accept lines added after phase 11 by plans that name index.html, or narrows them to phase 11's own files, as books-flow's first managed check already does ("index.html names none of this plan's files"). Then rerun gate16 into the same GATE_OUT; every step that passed is kept.
  - (b) Leave index.html untouched. The managed edition would then have no file record, which breaks C-12 and AC-06 in the managed edition and fails part managed-desktop. Not recommended.
- SECTIONS `mailLog` (13-05 and 15-06): exists at the start tree; needs a SECTIONS line in server/lib/workspace.mjs (15-xx owner).
- 16-07 adds parts to ach-flow.js; its marker line changes with them.
- The owner's check of the builder (16-05's open item) can follow once this plan merges.

## Owner's screenshots

Kept in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-16-02/shots (index.txt names each):
- the sent record on the phone
- the file built again
- a sample run recorded as paid
- the red check on Christmas Day
- the already-sent sentence on a new draft
- the team member's masked preview
- the managed record

## Self-Check

- FOUND: assets/js/achrecord.js, checks/file-record.js, checks/ach-flow.js; the achrecord.js line after nacha.js in diy.html, index.html, portal.html.
- Commits on wip/16-02: 52c49d1 (RED), de11f05 (Task 1), b6410cb (Task 2), plus save commits 3bd00d8, bbfab32, 1611c5b, de1b169.
- Self-Check: PASSED for files and commits. The plan's done criterion (gate16 GATE_EXIT=0) is NOT met: see Failures first.
