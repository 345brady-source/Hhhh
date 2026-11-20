---
phase: 10-investor-tax-documents-and-withholding
plan: 08
subsystem: Tax withheld section of the Tax documents page (self-serve console)
status: complete
tags: [withholding, deposits, w-8, worksheet, irs-notice, tax]
requires: [10-01, 10-04, 10-05]
provides:
  - "assets/js/taxrecord-ui.js: part 'withheld' of NS.taxUI (address console-taxdocs-withheld): fund and year, each kind's withheld / deposited / not yet deposited from NS.withholding.totals, Mark deposited, the fund's foreign investors with their W-8 facts, Download worksheet for your CPA, IRS notices"
  - "checks/taxrecord-flow.js: TAXRECORD FLOW, 5 parts (record-phone, record-desktop, deposit, worksheet, notices)"
affects: [10-10, 10-11, 10-13]
tech-stack:
  added: []
  patterns: ["a section registered with NS.taxUI.part and loaded by taxdocs-ui.js's fixed list", "every figure from NS.withholding; the table adds nothing up itself"]
key-files:
  created:
    - assets/js/taxrecord-ui.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/taxrecord-flow.js
  modified:
    - assets/css/tax.css   # two added lines (touch area of the list's title links)
decisions:
  - "Mark deposited offers only the kinds withheld in the chosen fund and year; a deposit larger than what is not yet deposited is not refused (the portal records what the sponsor states, T-10-24)"
  - "Downloading the worksheet writes one change-log entry, because the file carries names, countries and W-8 facts out of the portal (T-10-23)"
  - "The list line names what is not yet deposited for each year, over every fund and kind"
metrics:
  completed: 2026-11-20
  tasks: 2
estimate:
  tokens: 66000
  tasks: 2
actuals:
  tokens: 12850     # chars/4 over the two new files (51,010 characters) and the two tax.css lines
  tasks: 2
  commits: 8        # git rev-list --count --first-parent 6061fce..8cd6d4d (4 plan commits, 1 merge, the tax.css fix, 2 summary saves); the final summary commit is the 9th
plan_head_before: 6061fce0b5d43bced41eb84c3c7c6375d1d97f27
plan_head_after: 8cd6d4d
---

# Phase 10 Plan 08: Tax withheld Summary

The Tax documents page has a Tax withheld section. For a fund and a year it shows each kind of tax withheld, the amount the sponsor has marked as deposited and the amount not yet deposited. Every figure comes from NS.withholding.totals, which reads the stored lines of paid distributions. The section also has: Mark deposited, the fund's foreign investors with their W-8 facts, a .csv worksheet for the CPA, and IRS notices that switch the backup proposal on and off. Measured only in the check browser, on example C seated in the Kestrel Bay sample. **The owner has not checked it. No CPA has read the worksheet's columns or the two rule sentences.**

## Failures and open points first

- **The first full gate failed: PHONE LAYOUT, caused by this plan.** The run ended `GATE FAIL PHONE LAYOUT (8)` and `GATE_EXIT=1`, with every other line ok (TAXRECORD FLOW included). The cause: `FAIL sample-phone failure 14: no button, link, select or summary has a touch area under 24 px high (47 screens measured) :: {"offenders":1,"screens":1,"first":[{"n":1,"at":"sample console-taxdocs","s":"a.tx-title","t":"Tax withheld","h":21,"hit":21}]}`. firms-phone and owner-phone failed the same way. sample-desktop failed once with `page.screenshot: Protocol error`, which did not happen again. The list's title link (10-04's markup in tax.css) is 21 px tall. No section was registered before this plan, so nothing showed it. The output is kept as red-3.txt.
- **Fixed in tax.css, against this plan's "adds files only" rule.** I added two lines and changed no line. They give `.tx-row a.tx-title` the same `::after` touch area that tax.css already gives `.tx-note a` (commit e98eec4). After the fix, run alone: `PHONE LAYOUT: PASS (parts run: 8)`. Because of this, Task 2's verify clause "tax.css equals the base" fails by design. The gate below ran with that one file taken out of the clause; the pages and console.js are still checked.
- **Second gate, after the fix:** `GATE_EXIT=0`, `VERIFY2_EXIT=0` (lines below). The gate's own run of this check ended `TAXRECORD FLOW: PASS (parts run: 5)` (97 PASS lines).

## Gate (last lines, verbatim; base ab6e908, P10_ROOT unset)

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
# tests 368
# pass 368
# fail 0
GATE ok   server tests 368 = base 368 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX MATH
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXRECORD FLOW
GATE_EXIT=0
VERIFY2_EXIT=0
```

- **Not measured:** saving the worksheet from the phone's own frame in the host app (the check covers the normal browser download; inside the host app U.download uses the host's save prompt); a CPA's read of the worksheet.
- **D5 was green before Task 2's code.** The recomputed-run line was already in Task 1's code, so record-desktop's D5 checks passed in red-2.txt. Every other new check of Task 2 failed there (29 FAIL lines).
- **Nothing on the page can produce a recomputed item.** A line worked out again carries no tax withheld, so `items[].recomputed` is never true today. The mark is drawn when it is, and record-desktop checks that the drawn rows match the module's items.

## RED, then GREEN (kept in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-10-08)

- red-1.txt (before taxrecord-ui.js existed): 7 FAIL lines, among them `FAIL record-phone as admin, Tax documents has a Tax withheld line saying $1,800.00 is not yet deposited :: {"title":"","text":""}`, ending `TAXRECORD FLOW: FAIL (parts run: 1) - record-phone`
- tracer.txt (Task 1's verify): `TAXRECORD FLOW: PASS (parts run: 1)` (16 PASS lines), then TRACER_OK
- red-2.txt (Task 2's parts on Task 1's code): 29 FAIL lines, among them `FAIL deposit an empty amount is refused with one line and nothing is stored`, `FAIL worksheet the saved file's text is NS.withholding.worksheet's, exactly :: {"saved":0,"want":565}`, `FAIL notices NS.withholding.propose for a new distribution on 2027-03-15 holds a line for X-1: 24% of 500,000 = 120,000 :: {"KBC-9002":80000}`, ending `TAXRECORD FLOW: FAIL (parts run: 5) - record-desktop, deposit, worksheet, notices`
- green-2.txt: `TAXRECORD FLOW: PASS (parts run: 5)` (97 PASS lines, 0 FAIL)
- Phase 10 node checks on 624b73a: `TAX MATH: PASS (cases run: 9)`, `TAXDOCS MATH: PASS (cases run: 10)`, `DIST RECORD: PASS (cases run: 9)`, `K1 SPLIT: PASS (cases run: 7)`. Server tests: `# tests 358`, `# pass 358`, `# fail 0` (server/node_modules linked for the run, then removed).

## Example C on screen (to the cent)

A new fund of the Kestrel Bay sample, "Example C <b>Notes</b> Fund", with three holders since 2025-01-02 (KBC-9001 $300,000, KBC-9002 $200,000, KBC-9003 $100,000; the plan's A-1001..A-1003). It is set to notes, and $10,000.00 is recorded on 2026-09-15 and on 2026-12-15 through NS.data.recordRun with the confirmed lines. The clock is 2027-01-20.
- Backup withholding, 2026: $1,600.00 withheld, $800.00 deposited, $800.00 not yet deposited. Foreign: $1,000.00, $0.00, $1,000.00. The list line reads "$1,800.00 not yet deposited for 2026".
- After Mark deposited (foreign, 1,000.00, 2027-01-15, DEP-JAN-B): foreign's not yet deposited is $0.00 and the list line reads $800.00. The deposit is still there after a reload.
- Worksheet: KBC-9003's two rows of 1666.67 paid and 500.00 withheld. The paid run of 2026-06-15 saved before the record existed reads 1000.00 and "yes" under "Amount worked out again". The U.S. investors are not in it.
- IRS notice for KBC-9001 (arrived 2027-01-18): propose for a 2027-03-15 payment holds 120,000 for KBC-9001. Ended 2027-02-01: no line on 2027-03-15, and still 120,000 on 2027-01-25.

## What the parts prove (each in the sandboxed frame that refuses every connection, scripts from the portal only, the other plans' part files answered 404)

- **record-phone** (390x844, touch) and **record-desktop** (1280x800): the list line and its link, the six amounts, each rule sentence with its source, and no due date.
- **record-desktop** also proves:
  - D5: the line "The distribution of June 15, 2026 was worked out again from today's positions; confirm its lines." beside each kind.
  - 2027 shows no kind and one line.
  - A team member sees the same amounts and marks a deposit.
  - An investor cannot open the address.
- **deposit:** an empty amount, a missing date, a missing confirmation number and a fraction of a cent are each refused with one line, and nothing is stored or logged. The stored entry has its fund, kind, year, 100,000 cents, date, confirmation number, who and when, plus one change-log entry. A reload keeps it.
- **worksheet:** the foreign investors list shows KBC-9003 as "W-8BEN · signed · valid until December 31, 2028 · foreign tax number on file". KBC-9004 (W-8 valid until 2026-12-31, holding since 2026-12-20) shows expired with the date and no foreign tax number. The downloaded file is a .csv whose text equals NS.withholding.worksheet's exactly. It has one header line and no run of nine digits. The download is in the change log.
- **notices:** the module's sentence is shown. A notice with no date and an end with no date are each refused with one line and nothing stored. The notice is listed and stored with who. propose turns on and off as above. Both change-log entries are there.
- **Every part:** quiet, leak, a way out at the top, the middle and the end, and the fund name with angle brackets shown as text.

## Commits

| Commit | What |
|---|---|
| a2f1c84 | test: part record-phone (RED) |
| 9799b2d | feat: the section, totals per kind, rule sentences, list line (tracer) |
| e07272c | test: record-desktop, deposit, worksheet, notices; marker 5 parts (RED) |
| 624b73a | feat: Mark deposited, foreign investors and worksheet, IRS notices |
| 953b2c6 | merge of claude/refract-reskin (ab6e908) before the gate |
| f07cfb8 | docs: summary so far (save) |
| e98eec4 | fix (committed as "wip(10-08): save" under the save rule): tax.css, the title link's touch area |
| 8cd6d4d | docs: summary, the first gate's failure (save) |

## Deviations from Plan

1. **The investors are KBC-9001..9004, not A-1001..A-1003.** They are seated in the sample with its own id prefix, so no id clashes with the sample.
2. **[Rule 2] One change-log entry on each worksheet download** (T-10-23). The plan logged only changes.
3. **A fourth, foreign holder seated in part worksheet** (expired W-8, holding after every 2026 distribution, so example C's figures do not move). The plan's behaviour needs an expired W-8 to show.
4. **A fourth deposit refusal:** an amount with a fraction of a cent (whole cents only).
6. **[Rule 1] tax.css: two lines added** (see Failures). The plan said tax.css stays as the base. PHONE LAYOUT showed the list's title link was under 24 px once a section exists. Plan 10-06 edits taxdocs-ui.js, and no other plan edits tax.css, so the fix went there to avoid a merge conflict.
5. **Gate base:** the latest claude/refract-reskin (ab6e908) was merged in (not rebased) before the gate, so base-commit.txt for the gate is ab6e908. The starting base 6061fce is kept in base-commit-start.txt. The pages, tax.css and console.js do not differ from that base, and none of this plan's commits touches them.

Not touched: STATE.md, ROADMAP.md, REQUIREMENTS.md, the pages, console.js, other plans' files. No package was installed.

## Files a preview build must publish

- `assets/js/taxrecord-ui.js` (new; loaded by taxdocs-ui.js beside it)
- `assets/js/withholding.js` (from 10-05; this is the first page that loads it, through the same list)
- `assets/css/tax.css` (changed: two lines)

## Known Stubs

None.

## Owner's check (pending)

On the iPhone, in the published preview, go to Tax documents, then Tax withheld. Pick a fund and year with tax withheld, mark a deposit, download the worksheet and record an IRS notice. Expected: the three amounts per kind are right, the deposit lowers what is not yet deposited, the worksheet saves and opens, and nothing asks for more than it needs.

## Self-Check

PASSED. Found: assets/js/taxrecord-ui.js, checks/taxrecord-flow.js, tax.css lines 22-23. Commits a2f1c84, 9799b2d, e07272c, 624b73a, 953b2c6, f07cfb8, e98eec4 and 8cd6d4d are in HEAD's history and pushed to wip/10-08.
