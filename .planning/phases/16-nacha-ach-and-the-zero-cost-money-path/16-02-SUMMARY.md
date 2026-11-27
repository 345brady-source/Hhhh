---
phase: 16-nacha-ach-and-the-zero-cost-money-path
plan: 02
status: in-progress
---

# Phase 16 Plan 02: payment file record (in progress)

Start commit: 38a85ea0f5f3c62e74a629ef7589a67846d6751f

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
FAIL history-phone and no change-log entry (a preview is not an event) :: ["Offering set up","Capital call issued","Subscription accepted","Subscription accepted","Subscription accepted","Subscription accepted","Capital call payment received","Subscription accepted","Capital call payment received","
FAIL history-phone Download leaves one file and records it with file ID A :: {"got":true}
FAIL history-phone the downloaded bytes equal the record’s entries by trace and amount :: {"n":11}
FAIL history-phone the record is kept by offering and payment date, by the signed-in person
FAIL history-phone Record distribution records the run and puts the file on it :: {"run":"kb-fund-ii-2026-11-20-mwni01nd"}
FAIL history-phone the History’s "ACH file" shows the record: sent, by whom, file ID, and no file text :: ACH file KB_FUND_II_LP_20261120_D.ach Download file Copy file Company KB FUND II LP · 1…9921 Effective date Nov 20, 2026 Batch 1 · PPD 7 entries · $5,294.12 Batch 2 · CCD 4 entries · $2,549.02 T
FAIL history-phone each entry shows its account ending and trace :: 0
FAIL history-phone no new file is built for it
FAIL history-phone the record: no full bank account number on the page (19 known) :: ["ending 3307","ending 1138","ending 1327","ending 7313","ending 2613","ending 6210","ending 3684","ending 3700","ending 3171","ending 2538","ending 1477"]
FAIL history-phone ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FAIL gating-desktop Download and Copy are disabled with "Fix the checks marked in red first." :: {"text":"ACH file KB_FUND_II_LP_20261225_B.ach Download file Copy file Company KB FUND II LP · 1…9921 Effective date Dec 25, 2026 Batch 1 · PPD 7 entries · $2,647.06 Batch 2 · CCD 4 entries · $1,274.52 T
FAIL gating-desktop nacha-download pressed through the action is refused with the reason :: Downloading KB_FUND_II_LP_20261225_B.ach
FAIL gating-desktop nacha-copy pressed through the action is refused with the reason :: Copy is blocked here. The text is selected; press Ctrl+C or Cmd+C.
FAIL gating-desktop nothing left: no download, no record, no change-log entry :: {"downloads":1,"ach":0,"audit":1}
FAIL draft-desktop a draft’s file is downloaded and recorded with no run
FAIL draft-desktop the new draft opens with the already-sent sentence :: ACH file KB_FUND_II_LP_20261120_B.ach Download file Copy file Company KB FUND II LP · 1…9921 Effective date Nov 20, 2026 Batch 1 · PPD 7 entries · $3,970.60 Batch 2 · CCD 4 entries · $1,911.76 Total credits $5,882.36 Entry hash
FAIL draft-desktop its Download and Copy wait for Build again :: {"text":"ACH file KB_FUND_II_LP_20261120_B.ach Download file Copy file Company KB FUND II LP · 1…9921 Effective date Nov 20, 2026 Batch 1 · PPD 7 entries · $3,970.60 Batch 2 · CCD 4 entries · $1,911.76 Total credits $5,882.36 Entry has
FAIL draft-desktop pressed through the action it is refused with the sentence and nothing is recorded :: Downloading KB_FUND_II_LP_20261120_B.ach
FAIL draft-desktop ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FAIL team-phone no Download, Copy or Build again for a team member, with the admin sentence :: {"text":"ACH file KB_FUND_II_LP_20261120_A.ach Download file Copy file Company KB FUND II LP · 1…9921 Effective date Nov 20, 2026 Batch 1 · PPD 7 entries · $5,294.12 Batch 2 · CCD 4 entries · $2,549.02 Tot
FAIL team-phone the preview shows each account by its last four (the rest masked), records still 94 characters :: {"n":11,"all":false}
FAIL team-phone the preview and its field view: no full bank account number on the page (19 known) :: ["ending 3307","ending 1138","ending 1327","ending 7313","ending 2613","ending 6210","ending 3684","ending 3700","ending 3171","ending 2538","ending 1477"]
FAIL team-phone nacha-download pressed through the action is refused with the admin sentence :: Downloading KB_FUND_II_LP_20261120_A.ach
FAIL team-phone nacha-copy pressed through the action is refused with the admin sentence :: Copy is blocked here. The text is selected; press Ctrl+C or Cmd+C.
FAIL team-phone ran to the end :: frame.evaluate: TypeError: window.CVPortal.actions[a] is not a function
FAIL managed-desktop Generate writes nothing in the managed edition too
FAIL managed-desktop Download records the file (file ID A) and the bytes equal the record
FAIL managed-desktop the History shows the record of the file sent, with Build again, and no second file :: ACH file KB_FUND_II_LP_20261120_B.ach Download file Copy file Company KB FUND II LP · 1…9921 Effective date Nov 20, 2026 Batch 1 · PPD 7 entries · $5,294.12 Batch 2 · CCD 4 entries · $2,549.02
ACH FLOW: FAIL (parts run: 5) - history-phone, gating-desktop, draft-desktop, team-phone, managed-desktop
```

The six file-record cases passed on the first run on this tree: achrecord.js was written whole in Task 1 to the interfaces block, so Task 2's RED for them is the start tree above. ach-flow.js on this tree failed once first (a check fault, not a product fault: the change log is seeded on first use, so the baseline was taken before it existed); fixed in the check by calling NS.audit.ensureLog before the baseline.

### Task 2 verify (verify2.sh = the plan's Task 2 automated line)

```
PASS canpay managed: an investor may not
FILE RECORD: PASS (cases run: 6)
PASS managed-desktop no script error in the browser
PASS managed-desktop no request outside the page's origin
ACH FLOW: PASS (parts run: 5)
VERIFY2_EXIT=0
```
