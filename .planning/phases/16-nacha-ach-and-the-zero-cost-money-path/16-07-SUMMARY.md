---
phase: 16-nacha-ach-and-the-zero-cost-money-path
plan: 07
subsystem: payments (NACHA / ACH, international wires)
status: paused
tags: [ach, nacha, prenote, wire, iban, bic, redemption, payee-holds, d-04]
requires: [16-01 (nextBankingDay holiday rule), 16-02 (NS.achRecord file records), 16-04 (line.ach shape), 16-05 (pre-note entries in the builder)]
provides: [NS.achRecord payee rules: checkOf, setCheck, markNew, confirmChange, prenotesOn, prenotesDue, prenoteEntries, prenotesSent, fileEntries, redemptionPayees, bicValid, ibanValid, wireDetails, wireMasked, wiresDue, markWireSent, wireCsv, lineStatus]
affects: [15-15 (writes 'unconfirmed', calls confirmChange), 16-08 (writes bank.pending and returns), 16-09 (console), 16-10 (investor side, wire details), 16-11, 16-12 (redemption files)]
tech-stack:
  added: []
  patterns: [pure functions over the workspace, account state stored only in investor.payment.bank.check, last-four-only sentences]
key-files:
  created:
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/payees.js
  modified:
    - assets/js/achrecord.js
decisions:
  - "lineStatus has a sixth status 'held' ('Not paid yet') for an ACH payee left out of the run's sent file, and method '' ('Paid') for a wire payee's payment made before its wire details were saved"
  - "wiresDue and markWireSent take only runs with stored lines recorded or dated on or after the day the wire details were saved"
  - "setCheck cuts runs of 5+ digits in a typed reason to 'ending NNNN'"
metrics:
  completed: not yet (paused 2026-11-27 before the gate finished)
actuals:
  tokens: 19300
  tasks: 2
  commits: 6
plan_head_before: 5e80342879682afe5ca8d25266ce501e8a5c9d32
plan_head_after: dc036b9
---

# Phase 16 Plan 07: payee states and holds Summary

## Paused (owner's indefinite pause, 2026-11-27)

**The plan is not done.** gate16.sh has not finished, so there is no GATE_EXIT.

**What is done:**
- All nine cases of the payees check pass on dc036b9: `PAYEES: PASS (cases run: 9)`, 126 PASS lines.
- The eighteen functions are built in assets/js/achrecord.js.
- FILE RECORD (6), MOBILE SYNC (3) and NACHA BUILD (11) pass on this tree.
- Everything is committed and pushed to wip/16-07. Nothing is uncommitted. The server/node_modules link is removed.

**Gate state:**
- Run 1 was on 80f94c1. I stopped it myself after the reader step to fix two lineStatus bugs (see "Failures first").
- Run 2 was on dc036b9, into the same folder. The coordinator asked me to stop it for the pause, and I did; it had not finished. Its lines so far:
  ```
  GATE ok   independent reader achcli v1.69.1
  ```
- Inside the reference step, these had passed when it was stopped:
  ```
  GATE ok   server tests # fail 0
  GATE ok   server tests 605
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
  ```
- Not reached:
  - the rest of the reference step;
  - gate16's own server count line (base 605, declared +0);
  - phase 10, 11 and 16 checks (PAYEES, FILE RECORD, ACH LEAK, MOBILE SYNC and the rest).
- I deleted the gate's base tree, screenshots, owner folder and page captures to free disk. The step outputs (*.txt) are still in scratchpad exec-16-07/gate/.

**Exact next step to resume:**
1. In a worktree at wip/16-07 (head dc036b9), run `ln -s /home/user/Hhhh/server/node_modules server/node_modules`.
2. Check that `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-16-07/base-commit.txt` still holds 5e80342879682afe5ca8d25266ce501e8a5c9d32.
3. In the background (timeout 7200000), run the Task 2 verify into the same folder: `rm -f $O/gate.txt $O/all.txt; node $P/checks/payees.js > $O/all.txt; GATE_OUT=$O bash $P/checks/gate16.sh > $O/gate.txt 2>&1`. Then require:
   - GATE_EXIT=0;
   - `^GATE ok +PAYEES`, `^GATE ok +FILE RECORD`, `^GATE ok +ACH LEAK` and `^GATE ok +MOBILE SYNC`.
   - Steps that passed under the same key are kept. HEAD, the base commit and the command line are unchanged, so the reference steps above should show "(kept …)".
4. Paste the gate's last 15 lines here and set status: complete.
5. Remove the link, then commit and push.

## Failures first

- **The gate has not passed.** It has not finished (see Paused).
- **After the first green run, a self-review found two wrong payment lines. Both are fixed, RED first.**
  - lineStatus said "Paid by ACH to the checking account ending 0006" for an investor held out of the run's sent file, so no money had moved. It now says "Not paid yet" (status 'held').
  - A wire payee's payment from before their wire details existed said "Paid by check". It now says "Paid", because how it was paid is not on record.
  - RED (scratchpad exec-16-07/red-3.txt; commit 5bf8aab, fix dc036b9):
    ```
    FAIL status a line held out of the run's sent file: 'held', 'Not paid yet' (never 'Paid by ACH') :: {"status":"paid","method":"ach","ending":"0006","code":"","date":"2026-11-18","words":"Paid by ACH to the checking account ending 0006","wireSent":null}
    FAIL status a payment made before the investor's wire details were saved: 'Paid', method unknown (not wire, not check) :: {"status":"paid","method":"check","ending":"","code":"","date":"2026-09-24","words":"Paid by check","wireSent":null}
    PAYEES: FAIL (cases run: 1) - status
    ```
- **Two bugs in the check itself, caught before GREEN was committed.**
  - In the privacy case, `keep(a) || keep(b)` never ran its second call, because push returns a number.
  - The privacy case also read statuses on a day before the run's date.
  - Both are fixed in the check.
- The prenotes case passed in Task 2's RED. It tests Task 1's functions, which were already built, so this is expected. The other six Task 2 cases failed.
- Both gate stops were of my own process group only, found through its output folder and its working directory in this worktree. No other agent's process was touched.

## RED evidence

Task 1 (`exec-16-07/red-1.txt`; the named grep `^PAYEES: FAIL \(cases run: 2\) - .*(states|entries)` holds):
```
FAIL states NS.achRecord has the payee functions :: ["checkOf","setCheck","markNew","confirmChange","prenotesOn","prenotesDue","prenoteEntries","prenotesSent","fileEntries"]
FAIL states ran to the end :: TypeError: R.checkOf is not a function
FAIL entries ran to the end :: TypeError: R.markNew is not a function
PAYEES: FAIL (cases run: 2) - states, entries
```
Task 2 (`exec-16-07/red-2.txt`; the named grep for bic|iban|wires|status|redemptions|privacy holds):
```
FAIL bic ran to the end :: TypeError: R.bicValid is not a function
FAIL iban ran to the end :: TypeError: R.ibanValid is not a function
FAIL wires ran to the end :: TypeError: R.wireDetails is not a function
FAIL status ran to the end :: TypeError: R.lineStatus is not a function
FAIL redemptions ran to the end :: TypeError: R.redemptionPayees is not a function
FAIL privacy ran to the end :: TypeError: R.wiresDue is not a function
PAYEES: FAIL (cases run: 9) - bic, iban, wires, status, redemptions, privacy
```

## Verify lines

Task 1 verify (passed):
```
PASS entries managed edition: pre-notes are off
PASS entries managed edition: a new account is paid, both unconfirmed accounts are held with their reason
PAYEES: PASS (cases run: 2)
VERIFY1_OK
```
Task 2, on dc036b9: 126 PASS lines, and no output line holds a run of 5 or more digits.
```
PAYEES: PASS (cases run: 9)
```
Other checks run on this tree: `FILE RECORD: PASS (cases run: 6)`, `MOBILE SYNC: PASS (cases run: 3)`, `NACHA BUILD: PASS (cases run: 11)`.

GATE_EXIT: none yet (paused).

## The states and holds, as the screens will show them (for the owner to read)

What an account's state reads (checkOf words):

| State | When | Sentence |
|---|---|---|
| ready | paid before, or its pre-note's wait is over | Ready to be paid. |
| new | added or changed (markNew), or never paid | A pre-note checks this account first: build it on the ACH origination page. (Pre-notes off, or the managed edition: Ready to be paid.) |
| prenote-sent | pre-note sent, wait not over | Can be paid from Jul 6, 2029, three banking days after its pre-note. |
| unconfirmed (D-04) | the investor changed the account | The investor changed this account: an admin confirms it before it is paid. |
| pending, still paid | the bank sent a change; under 6 banking days, or no payment since | A change from the bank waits for an admin since Nov 2. The account on file is still paid for now. |
| pending, held | after 6 banking days AND a later sent file paid this investor | A change from the bank waits for an admin since Nov 2. |
| returned | the bank returned a payment | Returned by the bank (R03, Nov 10): waits for new bank details. |
| blocked | an admin's reason | the reason as typed, with any long number cut to "ending NNNN" |
| wire | foreign investor (D-04) | Paid by international wire: see "Wires". |
| none | no bank account | No bank account on file: paid by check. |

What a payment file holds back (fileEntries reasons, exact):
- `Paid by international wire: see "Wires".`
- `A pre-note checks this account first: build it on the ACH origination page.`
- `Can be paid from <Mon D, YYYY>, three banking days after its pre-note.` (when the payment date is before that day)
- `Returned by the bank (<code>, <Mon D>): waits for new bank details.`
- `<the stored reason>` (blocked)
- `A change from the bank waits for an admin since <Mon D>.`
- `The investor changed this account: an admin confirms it before it is paid.` (held in both editions, pre-notes on or off)

Check payees are neither paid in the file nor held: the console keeps listing them as checks.

What an investor's payment line reads (lineStatus words):
- Paid by ACH to the checking account ending NNNN (or "savings account")
- Paid by wire to the account ending NNNN (once marked sent)
- To be paid by wire to the account ending NNNN (not marked sent yet)
- Paid by check
- Scheduled for Dec 15, 2026
- Cancelled
- Returned by your bank on Nov 20, 2026
- Paid again on Nov 27, 2026
- Not paid yet (held out of the run's sent file)
- Paid (a wire payee's payment from before their wire details existed)

Refusals (one sentence each, nothing written):
- confirmChange with no person: "Confirming a bank account change needs the name of the person doing it."
- confirmChange with no change waiting: "This account has no change waiting for an admin."
- markWireSent with no person: "Marking a wire sent needs the name of the person doing it."
- markWireSent with a bad date: "The day the wire was sent must be a date written YYYY-MM-DD." It also refuses 2026-02-30.
- markWireSent on a line not paid by wire: "This investor is not paid by international wire."
- markWireSent a second time: "This wire was already marked sent on Nov 20, 2026 by Pat Admin."
- prenotesSent on any file but a pre-note file: "Only a pre-note file marks accounts as pre-noted."
- setCheck for an investor with no bank account: "This investor has no bank account on file for ACH."

Measured on the samples:
- Kestrel Bay, Ashwell Ridge and Greywater have no pre-note due.
- **Pellbrook has 10 ACH investors never paid** (PBP-1003, 1004, 1006, 1009, 1011, 1013, 1014, 1017, 1018, 1019). Under C-03 each is offered a pre-note and held from a file until it is sent. This becomes visible once 16-09 shows the rule.

## Interface for 15-15 and 16-08 to 16-12 (as built)

Stored (no new top-level workspace key):
- `investor.payment.bank.check` holds one of two shapes:
  - `{ state: 'new' | 'prenote-sent' | 'returned' | 'blocked', code, date, until, fileId, why, at, by }`, written by setCheck. markNew writes `{ state: 'new', at }`.
  - `{ state: 'unconfirmed', at, by: 'investor' }`, written by 15-15. confirmChange turns it into `{ state: 'new', at, by }`.
- `investor.payment.bank.pending = { code, routing?, account?, type?, holder?, date, at }`, written by 16-08.
- `investor.payment = { method: 'wire', bank: null, wire: { beneficiary, address, bankName, country, bic, iban, account, intermediary: null | { name, bic }, at } }`, written by 16-10.
  - Only runs recorded or dated on or after `wire.at` count as wires to send.
- `run.lines[k].wire = { sentOn, by, at }`.
- `tenant.ach.prenotes === false` turns pre-notes off. The managed edition never has them.

Functions (NS.achRecord):

**Account state and pre-notes**
- `prenotesOn(ws)`
- `checkOf(ws, inv, today)` gives `{ state, code, date, until, why, words }`.
  - A pending state also gives `held`; an unconfirmed one gives `at` and `by`.
  - States are checked in this order: wire, none, unconfirmed, pending, returned or blocked, then prenote-sent, new or ready.
- `setCheck(ws, inv, state, info)`
- `markNew(inv, at)`
- `confirmChange(ws, inv, { by, at })`
  - Refused with no person or with no change waiting.
  - It does not check canPay(); the calling screen does.
- `prenotesDue(ws, today)`
- `prenoteEntries(ws, today)`
- `prenotesSent(ws, record, { by, at })` gives the investors it marked.
  - It skips an investor whose account's last four changed since the pre-note, and one waiting for an admin.

**Payment files**
- `fileEntries(ws, rows, { today, effective })`
  - Each row is `{ investor, cents, ref?, request? }`.
  - It gives `{ entries, held }`, with held items `{ investor, cents, kind, reason, until, ref?, request? }`.
  - An entry's `sec` is undefined for an unknown investor type, so the builder leaves it out with 'No SEC type'.
- `redemptionPayees(ws, requests, { today, effective })` gives `{ entries, held, wires, checks }`.
  - entries carry ref = the request id; held items carry the request.
  - wires are `{ request, investor, cents, details }`; checks are `{ request, investor, cents }`.
  - Only approved redemptions count, with `r.dealing <= NS.audit.lastMonthEnd(today)` and a numeric `NS.ops.redemptionAmount`.

**Wires**
- `bicValid(s)` and `ibanValid(s)` check the shape and mod 97 only. **This is an assumed rule (16-RESEARCH A10), with no country table.**
- `wireDetails(inv)`
- `wireMasked(inv)` gives `{ bankName, country, ending }`.
- `wiresDue(ws)` gives `{ runId, offeringId, date, investorId, name, cents (net), reference: '<offering short name> <run date> <investor id>', details }`, oldest first.
- `markWireSent(ws, runId, investorId, { sentOn, by, at })`
- `wireCsv(rows)`
  - Columns: Investor, Investor ID, Amount, Beneficiary, Address, Bank, Country, BIC, IBAN or account, Intermediary, Reference.
  - A cell starting with =, +, -, @, tab or return gets a leading '.
  - **It holds the full IBAN or account, because the sponsor's bank needs it. 16-09 must gate it on canPay().**

**Payment lines**
- `lineStatus(ws, run | runId, investorId, today)` gives `{ status, method, ending, code, date, words, wireSent }`, or null when the investor has no line.
  - status is 'scheduled', 'paid', 'held', 'returned', 'repaid' or 'cancelled'.
  - method is 'ach', 'wire', 'check' or ''.

## Deviations from Plan

1. **[Binding re-check B1, B3, B4, W1-W5] applied over the plan text:**
   - the 2029-07-02 pre-note is ready on 2029-07-06;
   - 'unconfirmed' and confirmChange are added (eighteen functions);
   - a pending change is held only after 6 banking days AND a later sent file;
   - checkOf follows the W5 order;
   - the privacy case adds the W3 test.
2. **[Scope] The states and entries cases were written in full in Task 1.** The plan put "the remaining states" in Task 2, but written in full there those assertions could fail RED against the real interface.
3. **[Rule 1 - Bug] lineStatus 'held' and method ''.** With only the interface's five statuses and three methods, a held investor would read "Paid by ACH" and a payment from before the wire details "Paid by check". Commits 5bf8aab and dc036b9.
4. **[Rule 2] wiresDue and markWireSent take only runs with stored lines recorded or dated on or after `wire.at`.** Without this, an investor who later moves to wire would see every past distribution listed as a wire to send.
5. **[Rule 2, T-16-28] setCheck masks runs of 5+ digits in a typed reason.** It also requires:
   - a reason for 'blocked';
   - a code and a date for 'returned';
   - both dates for 'prenote-sent'.
6. **[Rule 2] markWireSent** refuses a day that does not exist (such as 2026-02-30) and a cancelled distribution.
7. The interface has `wiresDue(ws, { today })`. The function takes `(ws)`, because no rule uses today.

## Known Stubs

None. The functions are complete. No screen calls them yet; that is 16-09, 16-10 and 16-12's work.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: data-export | assets/js/achrecord.js | wireCsv returns full IBAN or account numbers (the sponsor's bank needs them); the download screen (16-09) must gate it on canPay(), like full ACH numbers (W5). |

## Open items

- **The gate has to be rerun** (see Paused).
- **The owner's check** (nothing is ready before it):
  - the sentences above;
  - Pellbrook's 10 accounts that need pre-notes;
  - "To be paid by wire …" for a wire not marked sent;
  - "Not paid yet" for a held line.
- markNew leaves an old bank.pending in place. 16-08 or 16-09 should clear it when an admin changes the details by hand.
- A sent wire on a run dated in the future reads "Scheduled for <date>" until that date.
- IBAN and BIC checks are shape and mod 97 only (A10, assumed).

## Commits (wip/16-07)

- eb30f8a test(16-07): RED states and entries cases of the payees check
- 089e961 feat(16-07): account states, pre-notes and held entries in NS.achRecord
- f2f9271 test(16-07): RED prenotes, bic, iban, wires, status, redemptions and privacy cases
- 80f94c1 feat(16-07): wires, line status and redemption payees in NS.achRecord
- 5bf8aab test(16-07): RED lineStatus said 'Paid by ACH' for a line held out of its file
- dc036b9 fix(16-07): lineStatus reads 'Not paid yet' for a line held out of its sent file

## Self-Check: PASSED (files and commits); the gate is not yet run to the end
