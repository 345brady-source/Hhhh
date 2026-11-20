---
phase: 12-report-builder
plan: 02
status: in-progress
---

# Phase 12 Plan 02: Report model (evidence, written as produced)

Base commit: 96bbdf6800f8b9190a02bf66f1483a2884717598

## RED outputs (verbatim)

### Task 1 RED (red-1.txt, `node checks/reports-model.js --case resolve`, before reports.js existed)

```
FAIL resolve ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-ac2f7134af2f3e0d4/assets/js/reports.js'
    at Object.readFileSync (node:fs:440:20)
...
REPORTS MODEL: FAIL (cases run: 1) - resolve
```

### Task 1 verify (verbatim tail, VERIFY_EXIT=0)

```
PASS resolve the last blocks are the disclosures with the tenant disclaimer
PASS resolve no HTML anywhere in the model
REPORTS MODEL: PASS (cases run: 1)
VERIFY_EXIT=0
```

### Task 2 RED (red-2.txt, `--case resolve,template,richtext,merge,split`, before the Task 2 code; FAIL lines and the last line, each cut at 200 characters)

```
FAIL template ran to the end :: TypeError: R.startFrom is not a function
FAIL richtext ran to the end :: TypeError: R.sanitize is not a function
FAIL merge MERGE_FIELDS is exactly the 12 names :: {"expected":["first_name","account_name","investment","firm","team","phone","period","period_end","ending_capital","distributions_period","commitment
FAIL merge ran to the end :: TypeError: Cannot read properties of undefined (reading 'map')
FAIL split SPLIT_LABELS :: {"expected":["Return of capital","Income","Interest","Capital gain","Other"]}
FAIL split ran to the end :: TypeError: R.setSplit is not a function
REPORTS MODEL: FAIL (cases run: 5) - template, richtext, merge, split
```

### Task 2 verify (verbatim tail, VERIFY_EXIT=0)

```
PASS split ws.runs is unchanged (JSON before and after)
PASS split the split lives in ws.reports.splits only
REPORTS MODEL: PASS (cases run: 5)
VERIFY_EXIT=0
```

### Task 3 RED (red-3.txt, all 11 cases with P6_OUT=$O/checks-out, before the Task 3 code; 28 FAIL lines, each cut at 200 characters; selfcheck already passes because runParts itself refuses an unknown or empty --case)

```
FAIL consolidated two summary tables, one per currency :: {"actual":[],"expected":[["Summary (USD)","USD"],["Summary (EUR)","EUR"]]}
FAIL leak ran to the end :: TypeError: R.othersIn is not a function
FAIL formats a null IRR prints 'Not meaningful yet' with no number :: {"expected":[null,"Not meaningful yet"]}
FAIL formats performance says net
FAIL formats Regulation A Tier 2, annual for a year: 'Annual report to investors' :: {"actual":"Annual review","expected":"Annual report to investors"}
FAIL formats the SEC note block right after the cover :: {"actual":{"k":"table","title":"Your capital account","currency":"USD","cols":[{"h":"Line item","t":"text"},{"h":"2026","t":"money"},{"h":"Year
FAIL formats six months: 'Semiannual report to investors' :: {"actual":["Annual review","Six months ended December 31, 2026"],"expected":["Semiannual report to investors","Six months ended December 31
FAIL formats a six-month quarterly for Regulation A :: {"actual":["Quarterly report",null],"expected":["Semiannual report to investors","This report is not the offering’s filing with the SEC (Form 1
FAIL formats six months otherwise: 'Semiannual report' :: {"actual":"Quarterly report","expected":"Semiannual report"}
FAIL formats notice title, subtitle and period :: {"actual":["Distribution notice","",{"from":"NaN-NaN-01","to":"NaN-NaN-NaN"}],"expected":["Distribution notice","Paid December 15, 2026",{"from":"2026
FAIL formats notice tiles :: {"expected":[["Gross amount","$6,000.00",600000],["Tax withheld","$0.00",0],["Net amount paid","$6,000.00",600000]]}
FAIL formats payment details :: {"expected":[["Payment date","Type","Payment method","Distributions to date"],["December 15, 2026","Realization proceeds","ACH","$6,000.00"]]}
FAIL formats the recipient's own split :: {"expected":[["Return of capital","$3,000.00"],["Capital gain","$3,000.00"],["Total","$6,000.00"]]}
FAIL formats split note :: []
FAIL formats tax title and subtitle :: {"actual":["Tax-season summary","",{"from":"NaN-NaN-01","to":"NaN-NaN-NaN"}],"expected":["Tax-season summary","Tax year 2026",{"from":"2026-01-01","to":"2026-12-
FAIL formats tax summary :: {"expected":[["Fund","Gross distributions","Tax withheld","Net paid"],[["Fund A, L.P.","$6,000.00","$0.00","$6,000.00"]],["Total","$6,000.00","$0.00","$6,000.00"]]}
FAIL formats tax summary note :: []
FAIL formats tax documents and their states :: {"expected":[["Document","Fund","Status","Available until"],[["Schedule K-1 (Form 1065)","Fund A, L.P.","In your Documents","October 15, 2027"],["Form 10
FAIL formats 'Expected: ...' when typed :: []
FAIL formats 'No tax documents for 2026 yet.' when none is listed :: []
FAIL formats ran to the end :: TypeError: Cannot read properties of undefined (reading 'rows')
FAIL charts dist: one columns chart :: {"actual":[],"expected":["columns"]}
FAIL charts capital: one line chart :: {"actual":[],"expected":["line"]}
FAIL charts allocation over three funds in one currency: one bar100 :: {"actual":[],"expected":[["bar100",3]]}
FAIL charts allocation over two currencies: one bar per currency :: {"actual":[],"expected":[["bar100",["Fund A, L.P.","Open Fund, L.P."]],["bar100",["Rhine Property Fund SCSp"]]]}
FAIL charts allocation for one fund: fair value by holding :: {"actual":[],"expected":[["bar100",["Portfolio Co X"],[1]]]}
FAIL charts dist in a letter: the fund's distributions :: {"actual":[],"expected":[[0,0,0,900000]]}
FAIL sheets ran to the end :: TypeError: R.sheets is not a function
REPORTS MODEL: FAIL (cases run: 11) - consolidated, leak, formats, charts, sheets
```
