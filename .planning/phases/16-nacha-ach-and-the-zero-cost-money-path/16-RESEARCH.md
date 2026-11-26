# Phase 16: NACHA/ACH upgrades and the $0 money path - Research

**Researched:** 2026-11-26
**Domain:** NACHA file origination (credits, pre-notes), returns and notifications of change read back in, foreign payees (IAT or wire), ACH debits for capital calls, all in the browser with no server and no paid provider
**Confidence:** HIGH for the in-repo inventory and the file-format claims (every file opened this session; generated files parsed by an independent open-source NACHA reader this session); MEDIUM for Nacha and Federal Reserve rules (public pages read through search excerpts only: nacha.org, frbservices.org and the vendors' own pricing pages could not be opened from this session, see "Sources"); LOW for outside prices (search excerpts, several from third parties). Every claim carries its tag.

<user_constraints>
## User Constraints (from 16-CONTEXT.md, copied verbatim)

### Locked Decisions
- D-01 (2026-11-15, 01.4-RESUME build order 9): fixes: bank holidays computed for any year, file ID modifier stepping (A-Z, 0-9 per day), entries with no SEC type, the same-day ACH $1M per-entry warning; plus international ACH (IAT) or wire instructions for foreign investors; pre-notes; reading bank return and notification-of-change (NOC) files back in.
- D-02 (2026-11-16, verbatim: "Ok let's go with the 0$ launch path you recommended"): no paid provider at launch. The portal builds the NACHA file, the sponsor uploads it to its own bank; bank accounts checked with pre-notes; return files uploaded back and matched to investors. Carrow & Vale never holds funds. Later, with revenue: Stripe (capital calls) and Dwolla (both directions), fees passed to sponsors.
- D-03 (2026-11-16): transfers and secondary sales only if a transfer agent offers an API; research it when this step is done (recorded, not built here).
- Carried: outside-API check first; white label; works in the no-server preview; never the word "basic"; full bank numbers never in logs, events, fixtures or summaries (fixtures use never-issued routing and account numbers); nothing called ready before the owner checks it.
- Owner (2026-11-26): build everything through step 11 that can be built without him; ask with a push notification and take the default after 15 minutes.

### Claude's Discretion
16-CONTEXT.md has no discretion section. The orchestrator's choices are listed in section 9 below (C-01 ... C-14), each with a recommended default, so the 15-minute default rule can be applied.

### Deferred Ideas (OUT OF SCOPE)
- D-03: transfers and secondary sales (transfer agent API) - recorded, not built in this phase.
- Paid providers (Stripe for capital calls, Dwolla both directions) - "later, with revenue" (D-02). Section 1 lists their prices for that later decision only.
</user_constraints>

## Project Constraints (from CLAUDE.md and .planning/AUTOPILOT.md)

- GSD agents for every step; test on real documents; show the owner the real result; never call anything ready, working or done before the owner has checked it. Report failures first.
- Outside API or service that could do the job better: present it with cost, accuracy, speed and trade-offs before building in-house (section 1; D-02 already chose the $0 path).
- Work economically: build only what the law or the task needs; no extra text on screens; nothing mandatory for investors (D-30).
- White label: no vendor, provider, library or model name in anything a sponsor or investor sees; never the word "basic".
- No-server preview: no fetch()/XHR on any path that must work without a server; checks run in a sandboxed iframe with connect-src blocked at 390x844 (touch) and 1280x800; no Blob in IndexedDB; every view has an on-screen way out; dialogs scroll.
- Managed (Carrow & Vale) edition unchanged unless a plan says otherwise (C-03 slice guard in status-math).
- RED-first: every behaviour change has a check that fails before and passes after; the full gate is `.planning/checks/gate-reference.sh`; counts follow the merged tree.
- Never open SCRATCH/blind/; never commit confidential documents or personal data; no agent is given an API key; no paid API calls by agents.
- Full bank numbers never in logs, events, fixtures or summaries (16-CONTEXT carried rule).
- Disk is limited (about 5 GB free): keep outputs small.
- The sponsor help guide is capped at 48,000 bytes (`server/test/help-guide.test.mjs:130`); raising the cap was not chosen (AUTOPILOT.md lines 76-78).

## Summary

The portal already builds a structurally correct NACHA credit file: an independent open-source NACHA reader (moov-io/ach v1.69.1, Apache-2.0, built offline this session) parses and validates the builder's PPD, CCD and balanced output without error. What is wrong is everything around the structure. The holiday table stops at 2028, so every 2029 holiday is treated as a banking day (`isBankingDay('2029-07-04')` returned `true` this session). An entry whose SEC type is missing is silently left out of the file with no reason given. A same-day file can carry a $1.5 million entry with no warning, although Nacha's limit is $1 million per payment until September 17, 2027. The file ID modifier steps per build, including every preview rebuild, wraps silently after 36 files a day, and is never validated (a lower-case modifier makes the independent reader refuse the whole file). The settlement (offset) account of a balanced file is never validated, so a short routing number produces an 88-character record that is still offered for download: the Download button ignores failed checks. The history's "ACH file" button rebuilds an already-paid distribution as a brand-new file with a new modifier, so uploading it again would pay every investor twice and the bank's duplicate-file check would not catch it. No trace number is stored, so a return could not be matched back to a payment by the bank's own reference. Fixtures and sample data carry real bank routing numbers (021000021, a large national bank's, in five check files and a server test).

The $0 path the owner chose (D-02) needs four additions on top of the fixes, all pure browser code with no outside service: a holiday rule for any year (it reproduces all 39 hand-listed dates for 2025-2028 exactly, measured this session), pre-notes (zero-dollar entries, transaction codes 23/33, a three-banking-day wait before live entries), a reader for the bank's return and notification-of-change files (NACHA addenda 99 and 98, plus a CSV report with a column map and a by-hand entry), and a wire list for foreign investors. Returns change three records: the distribution line (returned, with code and date; the amount is owed again), the investor's bank account (waits for new details or takes the bank's corrected data), and the books (cash back in, a payable until it is paid again). IAT origination is not recommended at launch: it needs the sponsor's bank to hold a gateway agreement and OFAC screening, carries seven mandatory addenda, and few small banks offer it; an international wire from the sponsor's own bank is the honest answer for a foreign account. ACH debit files for capital calls are not recommended at launch either: debit origination needs the bank's separate approval, Regulation E's signed authorization and copy for consumer accounts, Nacha's WEB account-validation and fraud rules, and exposure to R01/R10 returns; capital calls stay on wire, as today, and the paid provider path (Stripe for calls, D-02) handles debits later.

**Primary recommendation:** Fix the builder first (`assets/js/nacha.js` pure functions with the independent reader run in every check), then add the run's file record (trace per entry), pre-notes, the return/NOC reader and its effects on the line, the account and the books, and the foreign-investor wire list; keep debits and IAT off at launch; prove each file in the independent reader and each screen in the sandboxed frame at phone size.

## 1. Outside-API check (owner rule; D-02 already chose the $0 path at launch)

D-02 is locked: no paid provider at launch. This table is for the later decision ("with revenue"), so the owner sees what each would cost. **None of the vendors' own pricing pages could be opened from this session** (stripe.com, dwolla.com, moov.io and moderntreasury.com all failed to resolve: they are outside this session's allowed network hosts). Every price below is from search-engine excerpts of those pages or of third-party reviews, and is tagged accordingly; each must be read on the vendor's own page before the owner relies on it.

| Option | What it does for this product | Price (as read) | Speed | Fit and trade-offs |
|--------|-------------------------------|-----------------|-------|--------------------|
| **$0 path (chosen, D-02)**: portal builds the NACHA file, sponsor uploads it in its own bank's online banking | Distributions (credits), pre-notes, returns read back | $0 to the platform. The sponsor pays its own bank's ACH fees. Examples of small-bank schedules from search excerpts: $35/month + $5/batch + $0.15/item + $150 setup (one bank); $10/month per company ID + $1/file + $0.15/item + $10/month file upload (another); $25/month + $5/file + $1.50 per same-day item (another); $0.15 per item and $1.00 same-day (another) [CITED: search excerpts of those banks' fee schedules, 2026-11-26]. The Federal Reserve charges banks about $0.0035 per item [CITED: search excerpt of frbservices.org FedACH 2026 fee schedule] | Next banking day, or same day before the bank's cut-off | No funds held by the platform; works with no server; the sponsor needs ACH origination enabled at its bank (an agreement, often an exposure limit). Returns and NOCs arrive in the bank's portal and must be uploaded back. |
| **Bank file transfer (SFTP direct transmission)** | The same files, sent by machine to the bank instead of uploaded by hand | No published price found; banks quote it inside treasury-management agreements. The one schedule with a line for it showed "$10 per month for its file upload service" [CITED: search excerpt, Forbright Bank fee schedule] | Same as the $0 path | Needs a server (holds the SSH key), a per-bank onboarding and test cycle, and the bank's approval; useful only at volume. Not for launch. |
| **Stripe** (owner's later choice for capital calls) | ACH debits from investors (capital calls); payouts to connected accounts for distributions | ACH Direct Debit 0.8%, capped at $5.00; $4 per failed debit; $15 per disputed debit [CITED: search excerpt of stripe.com/pricing and NerdWallet's Stripe fee guide]. Connect, when the platform sets pricing: $2 per monthly active account and 0.25% + 25 cents per payout [CITED: search excerpt of stripe.com/connect/pricing]. Settlement about 4 business days for ACH debits [CITED: search excerpt] | About 4 business days for debits | Handles the debit authorization and bank-account verification itself; the cap makes large calls cheap ($5 on a $100,000 call). Payouts route through the provider's balance, so "Carrow & Vale never holds funds" depends on the Connect structure: to be confirmed with the provider before use. |
| **Dwolla** (owner's later choice, both directions) | ACH credits and debits through an API; white-label | Pay-as-you-go 0.5% per transfer, minimum 5 cents, maximum $5, no setup or monthly minimum [CITED: NerdWallet review excerpt; the same range on a competitor's comparison page]. Monthly plans: "Launch" from $250/month; $1,000 and $2,000 tiers are reported only by a competitor and an aggregator [CITED: search excerpts, treat as unconfirmed]. Same-day appears tied to annual contracts; **no same-day price could be read** | Standard 3-4 business days on pay-as-you-go per the excerpt; next-day and same-day with an annual contract | Verified bank accounts, returns and NOCs handled by the provider; webhooks need the server. |
| **Moov** | ACH credits and debits through an API | ACH credits: 25 cents next-day, 40 cents same-day; ACH debits 0.50%, minimum 25 cents, cap $5.00; $15 per unauthorized return [CITED: search excerpt of moov.io/pricing] | Next day or same day | Lowest list price found for credits (40 investors x 4 quarters = $40/year at 25 cents). Needs the server and an account per sponsor. |
| **Modern Treasury** | Payment operations over the sponsor's own bank (files, reconciliation) | **No price published**: the official pricing page is a "talk to us" page [CITED: search excerpt]. Third-party figures ($400/month platform; $0.25 per ACH) could not be reconciled with each other [CITED: search excerpts, unconfirmed] | Bank's own timing | Built for larger treasuries; priced above this product's sponsors. Not recommended. |
| **Instant account verification** (alternative to pre-notes) | Confirms the account owner and number on the spot instead of waiting 3 banking days | **No price published** for pay-as-you-go: Plaid shows rates only inside its production-access request; third-party estimates $1.00-$2.00 per link [CITED: search excerpt of plaid.com/docs/account/billing and third-party pages] | Instant | Needs the server and an API key; pre-notes do the same job for $0 (only the bank's per-item fee) with a 3-banking-day wait. |
| **International payouts provider** (for foreign investors) | Pays foreign accounts in local currency | Wise states no cross-border fee on its batch payments tool; no per-payment price could be read [CITED: search excerpt of wise.com batch payments pages] | Not read [ASSUMED: 1-2 days] | An option for the sponsor to use itself; the portal's wire list (section 4) works with any bank or provider the sponsor already has. |

**Recommendation for the owner:** keep the $0 path at launch (D-02). When revenue allows, Moov's list price is the cheapest for distribution credits, Stripe's 0.8%/$5 cap fits capital-call debits; both need the integration server and each sponsor's own account. Prices must be re-read on the vendors' pages first (they could not be opened from this session).

<!-- section 1 done -->

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Building NACHA files (credits, pre-notes), holiday rule, field checks | Browser (pure functions in `assets/js/nacha.js`) | Mobile copy (`mobile/src/core/nacha.js`, generated) | Must work with no server; the sponsor downloads the file and uploads it to its own bank |
| The run's file record (trace per entry, modifier, creation stamp) | Browser workspace (`ws.runs[].ach`, `ws.achLog`) | - | The return reader matches by the bank's own reference; only last four digits stored beside it |
| Pre-note state per bank account | Browser workspace (investor record `payment.bank.check`) | - | Decides whether a live entry may go in a file |
| Reading return and NOC files (NACHA, CSV, by hand) | Browser (pure reader, new file) | Phase 11's CSV helpers (`NS.bankFiles.csvRows`, `csvGuess`) | Same no-network rules as the statement reader |
| Effects of a return: line returned, amount owed again, account waits | Browser data layer (new pure module over `ws`) | Books (`books-post.js` posts cash back and a payable) | One source of truth; journal posts from records, never by hand |
| Investor sees a returned payment and is asked to update the account | Browser (investor portal, `portal.js`, `onboarding.js` bank step) | - | Investor-facing, white label |
| Foreign investor's wire details and the sponsor's wire list | Browser (onboarding bank step, console Distributions) | - | No IAT at launch (section 4); the sponsor sends wires at its own bank |
| Independent check of every generated and fixture file | Check scripts (`.planning/phases/16-*/checks/`) running a pinned open-source NACHA reader | - | An outside reader, not the builder's own checks, proves the format |
| Integration server | Not touched | - | No server code uses ACH today (grep of `server/lib` found none besides the help guide) [VERIFIED: grep this session] |

## 2. Every current defect (file:line, measured where marked)

Measured this session by loading `assets/js/nacha.js` in Node with a fixed clock and fixture numbers with an unassigned prefix (190000017, 190000020, ODFI 190000091), then parsing each output with moov-io/ach `achcli` v1.69.1 (`-validate-file`, `-validate-totals`). Probe scripts were kept in the scratchpad only.

**What is already correct (independent reader, this session):** 94-character records, block-of-10 fill with `9` records, entry hash (sum of the 8-digit RDFI numbers, rightmost 10 digits), batch and file entry counts, debit and credit totals, service class 220 (credits only) and 200 (mixed, balanced file), the check digit split (positions 4-11 and 12), trace numbers (ODFI 8 digits + 7-digit sequence), record layouts 1/5/6/8/9, the descriptive date. `achcli -validate-file` and `-validate-totals` printed nothing and exited 0 for the PPD+CCD file, the balanced file and the same-day file [VERIFIED: achcli v1.69.1 run this session].

| # | Defect | Where | Evidence | Fix |
|---|--------|-------|----------|-----|
| F-1 | Holidays only for 2025-2028; every later holiday is a banking day, and every earlier one too | `assets/js/nacha.js:17-23` (`FED_HOLIDAYS`), read by `isBankingDay` :26-30, `nextBankingDay` :31-39, `bankingDayReason` :40-45; used by `assets/js/console.js:1086, 1223, 1238, 1323, 1401` and the schedule's `bankingOnOrAfter` `assets/js/data.js:682-687` | `isBankingDay('2029-07-04')` and `isBankingDay('2029-12-25')` returned `true` [VERIFIED: probe this session] | A rule for any year (section 3.1). The rule reproduces all 39 hand-listed dates for 2025-2028 with no difference either way [VERIFIED: probe `hol.js` this session: "in list not rule: [] in rule not list: [] list size 39 rule size 39"] |
| F-2 | An entry with no SEC type (or any value other than PPD/CCD) is silently left out: no batch, no "left out" reason | `assets/js/nacha.js:97-104` keeps it as valid; :118-120 builds only `['PPD', 'CCD']` batches | 4 entries in, 3 in the file, `excluded.length` 0; only the check "Batch and file totals equal the sum of entries" turned false, with no reason [VERIFIED: probe this session] | Refuse it into `excluded` with "No SEC type"; console fallback `console.js:1134` (`|| { sec: 'PPD' }`) replaced by an explicit refusal for an unknown investor type |
| F-3 | No same-day $1M per-entry warning | `assets/js/nacha.js:164` (only "Effective date is today (same-day ACH)" as a warning) | A same-day file with a $1,500,000.00 entry: no check failed or warned [VERIFIED: probe this session]. Nacha: entries above the limit are not rejected; the ACH Operator moves them to the next-day window [CITED: search excerpt of nacha.org/million] | A warning per entry over $1,000,000.00 when the effective date is today ("settles next banking day"); the limit becomes $10,000,000 on 2027-09-17 [CITED: search excerpt of nacha.org rule page], so the limit is a dated table, not a constant |
| F-4 | File ID modifier: not validated; wraps silently after 36; consumed by every preview and history rebuild | `assets/js/nacha.js:109` (`opts.modifier || 'A'` unchecked); `assets/js/console.js:1135-1139` (`used % 36` over `ws.achLog` entries dated today), :1159 (a log entry per build); builds on every "Generate NACHA file" press :1339-1342 and every history "ACH file" press :1398-1405 | A lower-case `'a'` made the independent reader refuse the file: `FileIDModifier a is not uppercase A-Z or 0-9: a` [VERIFIED: achcli this session]. The 37th file of a day reuses `A` [VERIFIED: code read, console.js:1139] | Validate `[A-Z0-9]`; step only when a file is downloaded or copied (not when previewed); refuse a 37th file in one day with one plain sentence; key the counter on (immediate origin, immediate destination, creation date) [ASSUMED: banks key duplicate-file detection on these fields with the modifier] |
| F-5 | The settlement (offset) account of a balanced file is never validated; `achReady` does not require it | `assets/js/nacha.js:141-144`; `assets/js/console.js:136-137` | Offset routing `'123'` produced an 88-character record; the independent reader: `RecordWrongLengthErr must be 94 characters and found 88` [VERIFIED: probe this session] | `abaValid` and the account rule applied to the offset; `achReady` requires both when "Balanced files" is ticked |
| F-6 | Download and Copy are offered even when a check failed | `assets/js/console.js:1185` (buttons always drawn), checks drawn :1167 | Code read | Download and Copy disabled while any check is red, with the reason; a warning (amber) does not block |
| F-7 | The history's "ACH file" rebuilds a recorded distribution as a new file (new modifier and time) and writes "NACHA file generated" each time | `assets/js/console.js:1398-1405` ("Rebuilding a past date is allowed for reference"), :1343 | Code read. A rebuilt file differs from the first in header fields, so the bank's duplicate-file check would not stop a second upload, and every investor would be paid twice [ASSUMED: duplicate detection keys on header fields] | A recorded run keeps its file record (C-05); "ACH file" shows that record and its copy is marked as already sent; a new file for the same run needs an explicit "Build again" with the reason (for example, the bank rejected the first) |
| F-8 | No trace number is stored, so a return cannot be matched by the bank's own reference | `assets/js/console.js:1158` stores `file.paid` as `{ id, cents }` only; the run keeps the file name only (`assets/js/data.js:502-504`: `file: spec.file || ''`) | Code read | The run's file record (section 6.4): per entry investor id, trace, amount, kind, last four of the account; never the full number |
| F-9 | An offering's Company ID override is not required to be 10 characters | `assets/js/console.js:726` (max 10, no exact check); `achReady` checks the firm's only (:136-137); used by `companyFor` :1120-1124 | Code read | Same rule as the firm's ID (10 characters) on the override, shown on the offering page and refused at build |
| F-10 | Zero amounts refused, so pre-notes cannot be built; only codes 22/32 and offset 27/37 exist | `assets/js/nacha.js:101` ("Amount is zero"), :138, :142 | Code read | Pre-note entries 23 (checking) and 33 (savings) at $0 (section 3.3); the independent reader accepted a synthesized pre-note file this session [VERIFIED: achcli this session] |
| F-11 | The entry description accepts Nacha's reserved words | `assets/js/console.js:1248` (free 10 characters), `:3247` default | Code read. Reserved descriptions include "PAYROLL" and "PURCHASE" (required for those uses from 2026-03-20) and "ACCTVERIFY" (micro-entries) [CITED: search excerpts of nacha.org rule pages]; "REVERSAL", "RETURN FEE", "RECLAIM", "NONSETTLED", "RETRY PYMT", "AUTOENROLL", "REDEPCHECK", "HCCLAIMPMT" [ASSUMED] | Refuse those words in the distribution description with one sentence |
| F-12 | A checksum-valid routing number with a prefix no routing number has is accepted | `assets/js/nacha.js:48-53` | `abaValid('190000017')` returned `true` [VERIFIED: probe]. Routing numbers start with 00-12, 21-32, 61-72 or 80 [CITED: search excerpt of the Wikipedia "Routing transit number" article] | See C-08: the recommended default keeps the builder permissive (fixtures rely on those prefixes) and adds the prefix test to the investor's typing only |
| F-13 | Real bank routing numbers in fixtures, checks and sample data | `server/test/invitations.test.mjs:46` and `.planning/phases/01-*/checks/fixtures.js`, `04-*/checks/lib.js`, `05-*/checks/flow.js`, `06-*/checks/lib.js`, `06-*/checks/bank-step-typing.js` use `021000021`; `assets/js/data.js:210` and phase 11 fixtures `checks/fixtures/fund-a.js`, `fund-b.js`, `fund-c.js`, `checks/posting.js` use `044003186`; `assets/js/tenants.js:105, 217` and two more sample firms use `021305810`, `061002157`, `112000781`, `121088639`; `assets/js/data.js:96-100` `fakeRouting` draws random numbers with real district prefixes | `021000021` is a large national bank's published routing number [CITED: search excerpts, several lookup sites]. For `044003186` the search returned no observation (no result named it) [no observation]. The others were not looked up | C-09: replace with never-issued numbers (unassigned prefixes) in one hygiene plan, with the gate run; sample data may keep its look with an unassigned prefix |
| F-14 | Foreign investors cannot give a foreign account | `assets/js/onboarding.js:442` ("by direct deposit (ACH) to a U.S. bank account"), :527-534 (routing must pass `abaValid`) | Code read | Section 4: an international wire method (bank name and country, SWIFT/BIC, IBAN or account number, beneficiary name and address) |
| F-15 | The investor portal says "Paid by ACH to ... account ending" with no way to show a returned payment | `assets/js/portal.js:916-917`, :1131-1156 | Code read | A returned line reads "Returned by your bank" and the Account page asks for new details (section 6) |
| F-16 | Redemptions are logged "by ACH" but no file is ever built for them | `assets/js/operations.js:308` | Code read | Out of D-01's list; C-13 |
| F-17 | Business-day helpers elsewhere ignore holidays | `assets/js/operations.js:28-35` (`businessDays`, weekends only; call notice dates, request decisions), `assets/js/books-bank.js:63-71` (`businessBack`) | Code read | Not money movement; C-14 (leave unless a plan touches the file anyway) |
| F-18 | Any change to `nacha.js` or `data.js` must regenerate the mobile copy | `mobile/scripts/sync-core.js:9` (`const FILES = ['brand.js', 'tenants.js', 'data.js', 'nacha.js'];`) [VERIFIED: file read this session] | - | Each plan that edits those files runs `npm run sync-core` in `mobile/` and commits the generated file |

Smaller observations, not defects: the creation date and time come from the local clock (`nacha.js:72-75`), which is what banks expect; the settlement date field is left blank (correct: the ACH Operator fills it); originator status code `1` (correct for an ODFI) [ASSUMED for the last two, standard layout knowledge]; the capital-call wire instructions take the account number from the balanced-file settlement account (`assets/js/operations.js:207-216`), so a sponsor without balanced files shows "on file with investor relations": worth a separate "wire-in account" field when the planner is in that page anyway (not money out, not in D-01).

<!-- section 2 done -->

## 3. The rules that apply

nacha.org and frbservices.org could not be opened from this session (hosts outside the allowed network); the rule statements below come from search-engine excerpts of those sites and of banks' rule summaries, tagged [CITED: search excerpt ...]. The Nacha Operating Rules book itself is sold, not public; where only a bank's or a study guide's summary was found it says so. A sponsor's bank's ACH origination agreement and implementation guide are the final word on its own cut-offs and fields; the screens keep the existing line "Confirm values against your bank's ACH implementation guide before the first upload" (`console.js:1200`).

### 3.1 Federal Reserve holidays for any year

- The Federal Reserve Banks observe eleven holidays: New Year's Day (January 1), Birthday of Martin Luther King Jr. (third Monday of January), Washington's Birthday (third Monday of February), Memorial Day (last Monday of May), Juneteenth (June 19), Independence Day (July 4), Labor Day (first Monday of September), Columbus Day (second Monday of October), Veterans Day (November 11), Thanksgiving Day (fourth Thursday of November), Christmas Day (December 25) [ASSUMED: list from training knowledge; it reproduces the code's own 2025-2028 table exactly, measured below].
- Weekend rule: "For holidays falling on Saturday, Federal Reserve Banks and Branches will be open the preceding Friday"; a holiday falling on Sunday is observed the following Monday [CITED: search excerpt of the Federal Reserve holiday schedule pages, frbservices.org and federalreserve.gov K.8]. So a Saturday holiday closes nothing (Saturday is not a banking day anyway) and a Sunday holiday closes the Monday.
- FedACH follows that schedule (for Thanksgiving 2026: processing ends Nov. 25 at 11:30 p.m. ET and resumes Nov. 26 at 5:30 p.m. ET, for the next banking day) [CITED: search excerpt of frbservices.org 2026 FedACH holiday notice].
- Measured: the rule above (Sunday to Monday, Saturday dropped) gives exactly the 39 dates of `nacha.js:18-22` for 2025-2028; for 2029 it gives `2029-01-01 2029-01-15 2029-02-19 2029-05-28 2029-06-19 2029-07-04 2029-09-03 2029-10-08 2029-11-12 2029-11-22 2029-12-25` (Veterans Day 2029 falls on a Sunday, so Monday 2029-11-12) [VERIFIED: probe `hol.js` this session].
- One-off closures (a national day of mourning, for example) are announced by the Federal Reserve case by case [ASSUMED]. Keep a short dated list of extra closed days next to the rule, empty at launch, so one line fixes such a day.

### 3.2 File structure, SEC codes, fields

- Records as the builder writes them (`assets/js/nacha.js:182-188`, quoted verbatim from `LAYOUT`): file header `[1, 1, 'Record type'], [2, 3, 'Priority'], [4, 13, 'Immediate destination'], [14, 23, 'Immediate origin'], [24, 29, 'Creation date'], [30, 33, 'Creation time'], [34, 34, 'File ID modifier'], [35, 37, 'Record size'], [38, 39, 'Blocking factor'], [40, 40, 'Format code'], [41, 63, 'Destination name'], [64, 86, 'Origin name'], [87, 94, 'Reference']`; batch header `... [51, 53, 'SEC code'], [54, 63, 'Entry description'], [64, 69, 'Descriptive date'], [70, 75, 'Effective date'], [76, 78, 'Settlement date'], [79, 79, 'Originator status'], [80, 87, 'ODFI'], [88, 94, 'Batch number']`; entry `[2, 3, 'Transaction code'], [4, 11, 'Receiving DFI'], [12, 12, 'Check digit'], [13, 29, 'Account number'], [30, 39, 'Amount'], [40, 54, 'Individual ID'], [55, 76, 'Individual name'], [77, 78, 'Discretionary'], [79, 79, 'Addenda'], [80, 94, 'Trace number']` [VERIFIED: assets/js/nacha.js:182-188]. The independent reader agreed with every field (section 2).
- File ID modifier: upper-case A-Z or 0-9 [VERIFIED: achcli error text this session, "FileIDModifier a is not uppercase A-Z or 0-9"]; it distinguishes files created the same day for the same origin and destination [ASSUMED].
- SEC codes this product uses: **PPD** (consumer accounts: individuals, joint, a trust's account at a bank), **CCD** (business accounts: entities, an IRA custodian), **WEB** (a debit to a consumer account authorized over the internet; only relevant if debits are ever built, section 5), **COR** (the bank's notification-of-change batches coming back, never sent by the portal), **IAT** (section 4). The mapping in `assets/js/data.js:108-113` is quoted verbatim: `individual: { label: 'Individual', sec: 'PPD' }`, `joint: { label: 'Joint account', sec: 'PPD' }`, `trust: { label: 'Trust', sec: 'PPD' }`, `entity: { label: 'LLC, partnership or corporation', sec: 'CCD' }`, `ira: { label: 'IRA (through a custodian)', sec: 'CCD' }` [VERIFIED: assets/js/data.js:108-113]. A trust's account may be a business account at some banks [ASSUMED]; keep PPD (a credit to the wrong class is not returned for that reason in practice [ASSUMED]).
- Transaction codes used: 22/32 checking/savings credit, 23/33 checking/savings credit pre-note, 27/37 checking/savings debit (the offset), 21/31 the returns and NOCs of 22/23 and 32/33 coming back [VERIFIED: achcli printed "21 (Checking Return NOC Credit)" for a synthesized return; 22 "Checking Credit", 32 "Savings Credit" for the builder's file this session]; 28/38 debit pre-notes [ASSUMED].
- Company entry descriptions with set meanings: "PAYROLL" for PPD credits of wages, and "PURCHASE" for consumer e-commerce debits, both from 2026-03-20 [CITED: search excerpt of nacha.org "Risk Management Topics - Company Entry Descriptions"]; "ACCTVERIFY" for micro-entries [CITED: search excerpt of nacha.org micro-entries pages]. A distribution is neither; the builder must refuse those words (F-11).

### 3.3 Pre-notes

- A pre-note is a zero-dollar entry (codes 23/33 for a credit account) that asks the receiving bank to confirm the account [ASSUMED for the code numbers' wording; the reader accepted code 23 with amount 0 this session, VERIFIED].
- Waiting period: "Prenotifications include a waiting period of three Banking Days before initiating additional Entries" [CITED: search excerpt of nacha.org "Request for Information - Definition of Banking Day"]; counted from the pre-note's settlement date per a study guide [CITED: search excerpt, secondary]. Reduced from six banking days in 2014 [CITED: bank rule summary excerpt].
- From 2024-06-21 a pre-note may be sent at any time, not only before the first entry, so it can re-check an account later [CITED: search excerpt of a bank's 2024 Nacha rules summary].
- Pre-notes are optional for credits; when an Originator chooses to send one, it must wait the period before the first live entry to that account [CITED: same excerpts; the "must wait" reading is the rule's wording "waiting period ... before initiating additional Entries"].
- The receiving bank answers a bad pre-note with a return (for example R03, R04) or a NOC (C01-C07), in the same file formats as section 6 [ASSUMED].
- Portal rule (recommended, C-03): an account gets a pre-note when it is added or changed; a live entry to it is held out of a file, with the date it can be paid, until three banking days after the pre-note's effective date; an account with an earlier successful payment and no change needs none (that history is what Nacha accepts as validation for WEB debits too [CITED: search excerpt of nacha.org "Supplementing Fraud Detection Standards for WEB Debits"]).

### 3.4 Return reason codes that matter and what the portal does

Return codes and their Nacha titles below are quoted from moov-io/ach v1.69.1's table, which copies Nacha's list [CITED: moov-io/ach addenda99.go:344-422, read this session; Apache-2.0]. Most returns must reach the ODFI within two banking days of settlement; unauthorized consumer debit returns (R05, R07, R10, R11) within 60 days [CITED: search excerpts of nacha.org and bank summaries]. Return-rate levels Nacha watches over 60 days: unauthorized 0.5%, administrative (R02, R03, R04) 3.0%, overall 15% [CITED: search excerpt of nacha.org unauthorized-return-rate material].

| Code (Nacha title) | Applies to this product's credits? | What the portal does |
|---|---|---|
| R02 Account Closed; R03 No Account/Unable to Locate Account; R04 Invalid Account Number; R20 Non-payment bank account | Yes | Line returned (amount owed again); the account is marked "returned, needs new details" and left out of every later file with that reason; investor asked to update; counts toward the 3% administrative rate |
| R14 Representative payee deceased...; R15 Beneficiary or bank account holder (deceased) | Yes | Line returned; account blocked; sponsor told to contact the investor's representative (no automatic message to the investor) |
| R16 Bank account frozen | Yes | Line returned; account blocked until the sponsor confirms it is cleared |
| R23 Credit entry refused by receiver | Yes | Line returned; account blocked until the investor gives details again |
| R17 File Record Edit Criteria / questionable circumstances | Yes | Line returned; account blocked; sponsor told the bank flagged it (possible fraud: check the change log for a recent bank-detail change) |
| R06 Returned per ODFI's Request; R24 Duplicate entry | Yes | Line returned; no account change; R24 points at a file sent twice (F-7) |
| R12 Branch Sold to Another DFI; R13 RDFI not qualified to participate; R28 Transit routing number check digit error | Yes | Line returned; account marked "needs new details" |
| R18, R19, R25, R26, R27 (format errors) | Only if a file is wrong | Line returned; shown as "the file had a field error: contact support" (should never happen after this phase; the independent reader proves the format) |
| R61, R62, R67-R77 (misrouted, dishonored, contested returns) | Bank-to-bank | Shown as text only; nothing changes |
| R80-R85 (IAT) | Only if IAT is built (section 4) | Same handling as R03 for that account |
| R01 Insufficient Funds; R05; R07 Authorization Revoked; R08 Payment Stopped; R09; R10; R11; R29 | Debits only | Only if debits are built (section 5); unauthorized ones count toward the 0.5% rate |

Any code not in the table is shown with its code, the investor and the amount, the line is marked returned, and the account is left as it is (the sponsor decides).

### 3.5 Notification-of-change codes

Change codes quoted from moov-io/ach v1.69.1 [CITED: moov-io/ach addenda98.go:246-266]. The Originator must make the change "within six banking days of receipt of the NOC information or prior to initiating another ACH Entry to the account, whichever is later" (Subsection 2.12.1) [CITED: search excerpt of a bank's ACH rules page quoting the Nacha rule]; the ODFI gives the NOC to the Originator within two banking days of settlement [CITED: same excerpt].

| Code | Meaning (moov table) | What the portal does |
|---|---|---|
| C01 | Incorrect bank account number | Proposes the corrected account number; the sponsor confirms; the investor's account record takes it (full number stored like any account number; logs show only "ending 1234") and the investor gets a notice that payments now go to the account ending in those digits |
| C02 | Incorrect transit/routing number | Same, for the routing number |
| C03 | Incorrect routing number and account number | Both |
| C04 | Bank account name change | Proposes the holder name |
| C05 | Incorrect transaction code (checking vs savings) | Proposes the account type |
| C06 | Account number and transaction code | Both |
| C07 | Routing number, account number and transaction code | All three |
| C09 | Incorrect individual ID number | Shows it; nothing changes (the ID is the investor's portal ID, so this points at the bank's error) |
| C13 | Addenda format error | Shows it (the portal sends no addenda at launch) |
| C14 | Incorrect SEC code for outbound IAT payment | Shows it: the account is abroad; the investor is moved to "international wire" (section 4) after the sponsor confirms |
| C61-C69 | Refused NOCs (ODFI to RDFI) | Never reach the sponsor; ignored |

A NOC does not return money: the payment was made [ASSUMED: NOC entries carry a zero amount; a synthesized NOC with amount 0 was accepted by the independent reader this session, VERIFIED]. The corrected data is parsed by whitespace-separated parts, as the open-source reader does (`addenda98.go:326-436`), because banks pad it differently [CITED: moov-io/ach addenda98.go].

### 3.6 Same-day ACH windows and limits

- FedACH same-day file deadlines: 10:30 a.m. ET and 2:45 p.m. ET, and a final same-day deadline of 4:45 p.m. ET [CITED: search excerpt of frbservices.org Same Day ACH FAQ]; settlement for the 4:45 p.m. window at 6:00 p.m. ET per a processor's table [CITED: search excerpt]; the bank's own cut-off is earlier than the Fed's [CITED: same excerpts]. Extensions are not allowed [CITED: frbservices FAQ excerpt].
- Limit: $1,000,000 per payment since 2022-03-18; entries above it are not rejected but settle next day; no limit on a batch or file total; splitting a payment to get under the limit is prohibited [CITED: search excerpts of nacha.org/million and its $1M guidance]. The limit becomes $10,000,000 on 2027-09-17 (approved, announced 2026-04-27) [CITED: search excerpt of nacha.org rule page and news release].
- A same-day entry is one whose effective date is the day the file is sent; the builder already treats "effective date is today" as same-day (`nacha.js:164`). IAT entries are not eligible for same-day [ASSUMED].
- Portal: warn (amber) per entry above the limit of the effective date's table, and say it will settle the next banking day; never split it.

### 3.7 2026 rule changes that touch a sponsor

- Fraud monitoring: non-consumer Originators (a fund sponsor is one) must have risk-based processes to identify entries initiated due to fraud (for example, payments sent to an account a fraudster changed by email); compliance by 2026-06-22 for all remaining Originators [CITED: search excerpts of bank summaries and nacha.org; dates differ between sources, 2026-03-20 for the largest Originators]. Not a portal obligation, but the portal supports it: every bank-detail change is logged with who and when (already true, `onboarding.js:553`), and C-03's pre-note after every change plus a notice to the investor's email of record give the sponsor a written control.
- Banking day definition updated 2026-01-01 [CITED: search excerpt of nacha.org RFI page]; no effect on the builder.

<!-- section 3 done -->

## 4. Foreign investors: IAT or wire

**What IAT requires.** An outbound IAT entry (a payment to an account at a financial institution outside the United States) must carry seven mandatory addenda records (types 710-716, up to 12 in all) holding the payment amount, the originator's name and address, the receiver's name and address, the receiver's account number and the foreign bank's identification, and must be screened for OFAC; a pre-note for IAT needs the same seven addenda [CITED: search excerpt of nacha.org IAT FAQ and frbservices.org IAT FAQ]. An ODFI that offers IAT needs an agreement with a Gateway Operator, and works with it on the destination country's rules [CITED: same]. A payment to a foreign investor's **U.S.** bank account is not IAT: it is an ordinary PPD or CCD entry [ASSUMED: IAT turns on the location of the financial institution, not the payee's nationality].

**What a small sponsor's bank usually accepts.** No source was found stating how many community banks originate outbound IAT; offering cross-border payments "requires a significant investment in technology, compliance, monitoring, and reporting" [CITED: search excerpt of a banking FAQ], and community banks commonly reach foreign countries through a correspondent's international **wire** service [CITED: search excerpt of correspondent-bank service pages]. Every bank that offers ACH origination also sends outgoing wires from online banking [ASSUMED]. An outgoing international wire typically costs the sender about $35-$50 at a U.S. bank [ASSUMED].

**Honest recommendation (C-04): wire, not IAT, at launch.** Building IAT files would cost a plan or two (seven addenda, an OFAC flag, country and currency codes) for files most sponsors' banks cannot accept, and an IAT that the bank refuses is worse than no option. The portal instead:

1. Lets an investor whose account is outside the United States choose "International wire" in the bank step (`onboarding.js` payment step), entering: beneficiary name and address, bank name and country, SWIFT/BIC, IBAN (or the account number where the country has no IBAN), and an optional intermediary bank. Checked as typed: BIC shape (8 or 11 characters: 4 letters, 2-letter country, 2 letters or digits, optional 3 letters or digits) and the IBAN check digits (ISO 13616 mod 97) [ASSUMED: formats from training knowledge; no standards page was opened this session]. Stored like the U.S. account (full number in the investor's record, last four everywhere else).
2. On the Distributions page, lists the wires to send for a distribution ("Wires"): investor, net amount after phase 10's withholding (`netCents`), beneficiary and bank details, and a reference (offering, distribution date, investor ID). The sponsor can copy each one into its bank's wire screen or download the list for its own files (the download holds full account numbers like the NACHA file does; nothing is logged but "ending 1234").
3. Records each wire as sent by the sponsor ("Mark sent", who and when). The investor's portal shows "Paid by wire to account ending 1234". The books post it as cash paid like an ACH line (one cash line per wire, so the statement's wire line matches it in reconciliation).
4. Keeps the NACHA builder refusing an entry whose investor pays by wire (it never reaches a file).

IAT stays a recorded option (C-04 alternative) for a sponsor whose bank asks for it.

## 5. Capital call debits

**Authorization.**
- Consumer account (an individual or joint account): Regulation E requires that preauthorized transfers from a consumer's account be "authorized only by a writing signed or similarly authenticated by the consumer", and "the person that obtains the authorization shall provide a copy to the consumer" (12 CFR 1005.10(b)); "similarly authenticated" allows an electronic authorization that confirms the consumer's identity and assent; the terms must be clear and readily understandable [CITED: search excerpt of consumerfinance.gov Regulation E 1005.10 and its commentary]. Varying amounts (every capital call differs) need a notice of the amount and date before each debit, at least 10 days ahead unless the consumer chose a range [ASSUMED: 1005.10(d) from training knowledge].
- An authorization obtained over the internet for a consumer debit is a **WEB** entry; the Originator must validate the account before its first use and before any change ("account validation" inside a commercially reasonable fraud detection system, effective 2021-03-19); an account with a proven history of successful payments satisfies it [CITED: search excerpt of nacha.org "Supplementing Fraud Detection Standards for WEB Debits"]. A pre-note or micro-entries are accepted ways to validate [CITED: search excerpt of a card network's article on the rule; vendor source].
- Business account (entity, IRA custodian): **CCD**, under an agreement between the Originator and the receiving company [ASSUMED].
- What the investor must agree to (if debits are ever built): the account; that each debit is the amount of a capital call notice issued under the offering's documents; the date (on or after the call's due date); the notice before each debit; how to revoke and how far ahead; that a copy is given (sent and kept in the investor's documents) [ASSUMED: composed from the rules above, to be read by counsel].

**Bank side.** Debit origination is approved separately from credit origination and usually needs a credit review and an exposure limit, because consumer debits can come back as unauthorized for 60 days [ASSUMED for the bank practice; the 60 days CITED in section 3.4]. Capital calls are large; an R01 (insufficient funds) or R10 return moves the default back onto the sponsor after the due date.

**Recommendation (C-06): no debit files at launch.** Capital calls stay on wire, as today (`operations.js:207-216` wire instructions, call reminders). The owner's later choice for calls is Stripe (D-02), which carries the authorization, verification and return handling itself. Nothing in the builder blocks debits later: transaction codes 27/37 already exist for the offset.

## 6. Return and NOC files back in

### 6.1 The NACHA return and NOC layout (what the bank sends back)

- A return file is an ordinary NACHA file sent by the ODFI to the Originator. "When a Return Entry is prepared, the original Company/Batch Header Record, the original Entry Detail Record, and the Company/Batch Control Record are copied for return to the Originator"; the return entry gets new batch and trace numbers [CITED: moov-io/ach addenda99.go:26-31, quoting Nacha Appendix Four]. So the batch header still carries the sponsor's company name, company ID, SEC code, description and effective date; the entry carries the investor's account number, amount, the Individual ID (positions 40-54: the portal writes the investor's ID there, `nacha.js:133` `alpha(id, 15)`) and the name; the addenda indicator is `1`.
- Return entries for the portal's credits use transaction code 21 (checking) or 31 (savings) [VERIFIED: achcli this session printed "21 (Checking Return NOC Credit)"].
- **Addenda 99 (return)**, positions as parsed by the open-source reader: 1 `7`; 2-3 `99`; 4-6 return reason code; 7-21 original entry trace number; 22-27 date of death (blank or YYMMDD); 28-35 original receiving DFI; 36-79 addenda information; 80-94 trace number [VERIFIED: moov-io/ach addenda99.go:97-149, read this session].
- **Addenda 98 (NOC)**, in a batch with SEC code `COR`, amount zero: 1 `7`; 2-3 `98`; 4-6 change code; 7-21 original entry trace number; 22-27 reserved; 28-35 original receiving DFI; 36-64 corrected data; 65-70 reserved (IAT corrections); 71-79 reserved; 80-94 trace number [VERIFIED: moov-io/ach addenda98.go:118-143].
- Both synthesized fixtures (an R03 return and a C01 NOC with never-issued numbers) passed `achcli -validate-file` this session, and `achcli -mask` printed `R03 190000090000001 ... 19000009` and `C01 190000090000001 19000009 ******0011` [VERIFIED: achcli this session].

### 6.2 What banks hand back

There is no standard for the report form. Banks offer returns and NOCs in online banking as a downloadable NACHA file, a report (CSV or spreadsheet) or a PDF, and by email notice; column names differ per bank [ASSUMED: no bank's export was read this session; phase 11 is still owed a masked export from the owner's bank, `11-17`]. The money of a returned credit also appears on the bank statement as one credit line [ASSUMED].

So the reader takes three inputs, in the order of exactness:
1. **A NACHA return/NOC file** (detected from content: lines of 94 characters, the first starting `101`); exact matching by original trace number.
2. **A CSV report**, through a column map guessed from the header and confirmed by the sponsor, exactly as phase 11's statement CSV works: date, return or change code, investor ID or name, amount, original trace (optional), corrected data (NOCs). Reuse `NS.bankFiles.csvRows` and the `csvGuess` approach (`assets/js/bankfiles.js:140-255`), and `LIMITS` (`bankfiles.js:31`: `const LIMITS = { bytes: 2000000, lines: 20000 };`) [VERIFIED: file read this session]. A PDF report is refused with one sentence that says to download the CSV or to enter it by hand.
3. **By hand**: a dialog on a distribution line: code (chosen from the table of section 3.4/3.5), date, and for a NOC the corrected data.

Phase 11's `bankfiles.js` and `books-bank.js` are **not loaded by any page yet** (grep this session: only phase 11's checks load them; their screen is plan 11-15, not built) [VERIFIED: grep this session]. Phase 16 reuses `bankfiles.js` as a library (one script tag or the parts loader), and does not wait for 11-15.

### 6.3 Matching to the investor and the payment

1. By the original trace number (addenda 99/98 positions 7-21) against the run's stored file record (section 6.4): one hit is a match when the amount and the Individual ID also agree; a trace that hits but disagrees on amount or ID is shown, never applied.
2. Otherwise by Individual ID (the investor's ID) + amount + the effective date of the original batch: exactly one candidate in an unreturned line is proposed; the sponsor confirms. Two or more candidates are never matched automatically (the same rule as phase 11's bank matching, `books-bank.js` header: "Two or more candidates are never matched automatically") [VERIFIED: assets/js/books-bank.js:17-18].
3. A pre-note return matches the account's pre-note record instead of a payment.
4. Each applied return or NOC is stored once (key: original trace + code), so uploading the same file twice changes nothing the second time.

### 6.4 What changes on the records

- **The run's file record** (new, C-05): `run.ach = { files: [ { name, modifier, created, effective, entries: [ { investorId, trace, cents, kind: 'credit' | 'prenote', last4 } ] } ] }`, written when a file is downloaded or copied for that run. No full account number is stored here.
- **The distribution line** (`run.lines[]`, the record phase 10 owns, `data.js:433-444`): gains `ach: { status: 'returned', code, date, trace, by, at, source }`; `grossCents`, `withheld` and `netCents` do not change (the investor was still distributed to and the tax was still withheld; the money is owed again) [ASSUMED: accounting reading, for the CPA to confirm]. A line is "paid again" by a new entry (in a later file, after the account is fixed and pre-noted) or by check; the second payment is stored on the same line.
- **The investor's bank account** (`investor.payment.bank`): gains `check: { state: 'new' | 'prenote-sent' | 'ready' | 'returned', code, date }` and, for a NOC, `pending: { code, routing?, account?, type?, holder? }` until the sponsor confirms. A returned account is left out of every later file with its reason. The investor's portal shows the returned payment and asks for new details; new details reset the state to `new` (a pre-note follows).
- **The books** (`books-post.js`, phase 11's desired-entries engine): a return posts cash back in and a payable to the investor (`1000 +` / a payable `-`); paying it again posts the payable off and cash out. Which liability account (`2000 Accounts payable and accrued expenses` exists; a new "Distributions payable" changes the chart) is C-07. The statement's return credit then matches the posted cash line in phase 11's reconciliation, with no new matching code.
- **The change log**: "ACH return R03 for HRC-0007, $1,250.00, distribution 2029-07-05" and "Bank details corrected (C01): account ending 0011" - never a full number.
- **Return rates**: the Distributions page can show the last 60 days' administrative return rate against Nacha's 3.0% (a small figure, no new screen); optional (C-11).

### 6.5 Privacy

A return or NOC file holds full account numbers. The reader keeps them in memory only: the stored records carry the last four digits, except a NOC's corrected number confirmed into the investor's bank record (where the full number already lives). The uploaded file itself is not kept (C-10: keep only its name, size and SHA-256, unlike phase 11's statements, which hold no full account numbers).

## 7. Test fixtures and an independent validator

- **Routing numbers that can never belong to a bank.** Routing numbers begin with 00-12, 21-32, 61-72 or 80; anything outside those ranges "is not a routing number at all" [CITED: search excerpts of the Wikipedia "Routing transit number" article and a validator page]. With a correct check digit, numbers such as `190000017`, `190000020` and `190000091` pass `abaValid` and the independent reader, yet no bank can have them [VERIFIED: computed and parsed this session]. Use only such numbers in fixtures, checks, server tests and sample data (C-09). Account numbers in fixtures start `99` and are paired only with those routing numbers, so no real account can be addressed.
- **No documented test routing number exists from the Federal Reserve or Nacha** [no observation: none found in this session's searches]; payment providers publish sandbox numbers, but none states it is unissued, so they are not used.
- **Never the open-source project's own test files**: moov-io/ach's `test/testdata/cor-example.ach` carries `231380104` and `121042882` (published routing numbers of real banks) [VERIFIED: file read this session], so return and NOC fixtures are synthesized from the portal's own generated files (copy the original entry, set code 21/31, add addenda 99 or 98) and each fixture is itself parsed by the independent reader.
- **The independent validator**: moov-io/ach `achcli` v1.69.1 (Apache License 2.0; module LICENSE and NOTICE read this session), installed with `GOFLAGS=-mod=mod GOBIN=<dir> go install github.com/moov-io/ach/cmd/achcli@v1.69.1`; the module is verified by Go's checksum database on download (module hash `h1:v+nHTd9qN4vYBmp+4mRf+8E/yztxoxxUtgMxgTGGtbo=` from `go version -m`) [VERIFIED: installed and run this session]. The module needs Go 1.26 (`go.mod`: `go 1.26.0`); this machine has Go 1.24.7, and the first install downloaded the newer toolchain automatically through the proxy [VERIFIED: this session]. After that one install it runs with no network. Commands: `achcli -validate-file f.ach` (prints nothing and exits 0 when the file is valid), `achcli -validate-totals f.ach`, and `achcli -mask f.ach` for any printed summary, so a check's output never shows a full account number or name. The binary (7.4 MB) is not committed; the check fails (it never skips) with the install line when the binary is missing.
- **An independent holiday calendar**: moov-io/base v0.68.3 (`time.go` `IsBankingDay`, over the rickar/cal U.S. holiday list) lists the same 112 weekday closures as the rule of section 3.1 for 2025-2035, with no difference either way [VERIFIED: a 20-line Go program run this session; output compared by script]. Commit that list (generated once, with its provenance) as the holiday fixture; the check compares the portal's rule to it and to the code's old 2025-2028 table.
- The phase 11 bank fixtures under `.planning/phases/11-*/checks/fixtures/bank/` are BAI2/OFX/CSV statements; the two real BAI2 samples from moov-io/bai2 are copied byte for byte (their SOURCE.txt), and `sample2.txt` carries two nine-digit identifiers in its 01/02 headers that pass the routing check digit with assigned prefixes (`071207890`, `122099999`); whether a bank holds them was not looked up [no observation; VERIFIED that they pass the check digit, scan this session]. Phase 16 copies nothing from them and adds its own `checks/fixtures/ach/`; C-09 lists them for the owner's decision (they are an outside project's published test data, not the portal's).

<!-- sections 4-7 done -->

## Standard Stack

### Core (all in the repository already; nothing is installed into the product)

| Module | Version | Purpose | Why |
|--------|---------|---------|-----|
| `assets/js/nacha.js` | in repo | The builder (credits, offset, now pre-notes), holiday rule, field checks, `LAYOUT` | Already produces files an independent reader accepts; fix in place |
| `assets/js/bankfiles.js` (phase 11) | in repo | `csvRows`, the column-map approach, `LIMITS`, plain-sentence refusals | Same no-network reading rules; return CSV reports are the same problem |
| `assets/js/books-post.js` (phase 11) | in repo | Journal entries derived from records (`desired`/`sync`) | Returns post through it, never by hand |
| `assets/js/data.js` (phase 10 record) | in repo | `run.lines` with `grossCents`, `withheld`, `netCents`; `runRows`, `runPaid` | The line a return marks; net amount is what the bank returns |
| `NS.audit.sha256`, `NS.audit.log` | in repo | Fingerprint of an uploaded file; change log | Existing helpers (`bankfiles.js:652` requires `NS.audit.sha256`) |

### Supporting (checks only, never shipped)

| Tool | Version | Purpose | When to use |
|------|---------|---------|-------------|
| moov-io/ach `achcli` | v1.69.1 (Go module, Apache-2.0) | Independent NACHA reader and validator: `-validate-file`, `-validate-totals`, `-mask` | Every generated file and every fixture in every check |
| moov-io/base | v0.68.3 (Go module, Apache-2.0) | Independent U.S. banking-day calendar (`IsBankingDay`) | Once, to generate the committed holiday fixture for 2025-2035 (and again to extend it) |
| Playwright + phase 06 `checks/lib.js` | in repo | Browser checks in the sandboxed frame, 390x844 and 1280x800, connect-src blocked | Every screen plan |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Our builder | moov-io/ach in a server | The product must work with no server; the builder is already correct in structure |
| Wire list | IAT files | Few small banks accept IAT; seven addenda and OFAC data (section 4) |
| Pre-notes | Instant account verification through a paid provider | Instant, but needs the server, an API key and a per-check fee (section 1) |

**Installation:** none for the product. Checks: `GOFLAGS=-mod=mod GOBIN=$HOME/go/bin go install github.com/moov-io/ach/cmd/achcli@v1.69.1` (first run downloads the Go 1.26 toolchain through the proxy).

## Package Legitimacy Audit

No npm, PyPI or crates package is installed by this phase. The only outside code is a Go module run by the checks (never shipped to a sponsor or investor), so the npm/PyPI/crates legitimacy seam does not apply.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| github.com/moov-io/ach (cmd/achcli) v1.69.1 | proxy.golang.org (checksum database verified on download) | Project since 2018 (NOTICE: "Copyright 2018-2020 The Moov Authors") [VERIFIED: module NOTICE read] | not measured | github.com/moov-io/ach | n/a (not an npm/PyPI/crates package) | Approved for checks only; the plan adds a `checkpoint:human-verify` only if the owner wants one before a Go tool runs in the gate |
| github.com/moov-io/base v0.68.3 | proxy.golang.org | same project family | not measured | github.com/moov-io/base | n/a | Used once to generate a committed fixture |

**Packages removed due to [SLOP] verdict:** none. **Packages flagged [SUS]:** none.

## Architecture Patterns

### System architecture

```
 Sponsor: Distributions page                      Investor: onboarding bank step / Account page
   | amount, date, offering                          | U.S. account (routing, account, type) or international wire details
   v                                                 v
 data.js record (phase 10: gross, withheld, net) <-- investor.payment.bank { ..., check: new|prenote-sent|ready|returned, pending }
   |
   v
 achrecord.js: which entries may go in a file?  -- held: pre-note waiting (date), returned account, wire payee, no SEC
   |                                    \-- wire payees --> "Wires" list (net amount, beneficiary, BIC, IBAN) --> sponsor's bank (wire)
   v
 nacha.js build(): batches by SEC, holiday rule, same-day limit, field checks (red blocks download, amber warns)
   |  result: lines + per-entry trace
   v
 Download / Copy --> achrecord: file record on the run (modifier, created, entries with trace + last4) --> ws.achLog counter
   |
   v
 Sponsor uploads the file at its own bank (outside the portal) ... bank settles ... bank sends returns and NOCs
   |
   v
 Upload return/NOC: NACHA file | CSV report (column map) | by hand
   |
   v
 achreturns.js parse() (pure, limits, no network)  --> [{ kind: return|noc, code, originalTrace, individualId, cents, corrected }]
   |
   v
 achrecord.js match(): original trace -> run file record; else ID + amount + date (one candidate only, sponsor confirms)
   |
   +--> return: line.ach = returned; account.check = returned (or blocked); amount owed again
   |        \--> books-post.js desired(): cash back in, payable; paid again: payable off, cash out
   |                 \--> phase 11 reconciliation matches the statement's return credit to the posted cash line
   +--> NOC: account.pending (sponsor confirms, admin) --> account updated, pre-note, investor notice
   |
   v
 Investor portal: "Returned by your bank", Account asks for new details -> new details -> pre-note -> paid again
```

### Recommended structure

```
assets/js/
  nacha.js          builder + holiday rule + checks (pure; synced to mobile/src/core/nacha.js)
  achreturns.js     NEW: reads return/NOC files (NACHA, CSV) to plain records (pure)
  achrecord.js      NEW: file record on runs, modifier counter, account check states, pre-notes, apply/confirm returns and NOCs,
                    paid again, wires (pure over the workspace; no DOM)
  ach-ui.js         NEW: Returns and Wires blocks drawn into the console's Distributions page (self-serve edition), like withholding-ui.js
  console.js        Distributions and ACH origination pages (file gating, history record, pre-notes panel, held entries)
  books-post.js     returns and paid-again entries
  onboarding.js     bank step: international wire; new details after a return
  portal.js         returned payment, paid by wire, Account prompt
.planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/
  lib16.js, achcli.sh, gate16.sh, nacha-build.js, holidays.js, achreturns.js, achrecord.js, posting-returns.js, ach-flow.js, ach-leak.js
  fixtures/ach/     holidays-2025-2035.txt (+ make-holidays.go), synthesized .ach and .csv fixtures (+ make-fixtures.js)
```

### Pattern 1: pure modules over the workspace, screens separate
**What:** every rule is a pure function (`nacha.js`, `achreturns.js`, `achrecord.js`) loaded into a fresh `vm` context by Node checks, as phase 11 does (`.planning/phases/11-*/checks/bank-files.js:1-20`: "Every case loads the modules into a fresh context of its own"). Screens call them and save.
**When:** all of phase 16 except the three screen plans.

### Pattern 2: a part file that draws into a console page (withholding-ui.js precedent)
**What:** `console.js` calls `NS.withholdingUI` only when it is loaded (`console.js:1415-1421`: "withholding-ui.js (self-serve edition only) draws the tax withheld block ... Without it (the managed edition) none of this changes the screen"). `ach-ui.js` does the same for Returns and Wires, so the managed edition is unchanged and `console.js` has one owner plan.

### Pattern 3: one stored record, read everywhere
**What:** the line's return status lives on `run.lines[].ach`, the account's state on `investor.payment.bank.check`; the investor portal, the console, the books and the next file all read those, never a copy (phase 10's "one test for is this run paid" rule).

### Anti-patterns to avoid
- Rebuilding a sent file as a new one (F-7): duplicate payments.
- Storing the NACHA or return file text: it holds every full account number.
- Matching on name or amount alone, or matching automatically when two lines fit.
- Applying a NOC without an admin's confirmation: an uploaded fake NOC would redirect payments.
- Printing a fixture or generated file in a check's output without `-mask`.
- A holiday table that ends.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Proving a file is valid NACHA | Self-checks only (the builder grading itself) | `achcli -validate-file` / `-validate-totals` in every check | An outside reader catches what the builder's own checks share as blind spots (it caught F-4 and F-5 this session) |
| A banking-day calendar to test against | A second hand-written list | The list generated once from moov-io/base's calendar | Independent source; already agrees for 2025-2035 |
| CSV splitting and column guessing | A new CSV parser | `NS.bankFiles.csvRows` and the `csvGuess` approach | Quotes, BOM, separators already handled and tested in phase 11 |
| SHA-256 of an upload | A new hash | `NS.audit.sha256` | Existing, tested |
| Journal entries for returns | Writing journal lines from the screen | `books-post.js` desired-entries engine | Closed periods, reversals and ties already enforced |

**Key insight:** NACHA's structure is easy; the expensive mistakes are around it (a duplicate file, a wrong date, a redirected account). Every safeguard is a record or a refusal, not more format code.

## Common Pitfalls

### Pitfall 1: a preview consumes a file ID modifier
**What goes wrong:** the 37th preview of a day wraps to `A`; the real file then collides with an earlier one. **How to avoid:** step only on download or copy (C-02). **Warning sign:** `ws.achLog` grows on every "Generate" press.

### Pitfall 2: a rebuilt history file paid twice
**What goes wrong:** "ACH file" on a paid distribution gives a fresh file. **How to avoid:** the file record (C-05); the rebuilt copy is marked and needs "Build again" with a reason. **Warning sign:** two file names for one run.

### Pitfall 3: the holiday rule drops a Saturday holiday onto Friday
**What goes wrong:** treating Friday 2026-07-03 as closed (the Board of Governors closes, the Reserve Banks and FedACH do not) [CITED: search excerpt of federalreserve.gov K.8]. **How to avoid:** Sunday to Monday only; the fixture from the independent calendar has no 2026-07-03.

### Pitfall 4: full account numbers leak through a return
**What goes wrong:** a change-log line, a toast or a check's output prints the corrected number from a NOC. **How to avoid:** last four only outside `investor.payment.bank`; `ach-leak.js` scans the change log, toasts, `achLog`, run records and check output. **Warning sign:** any run of 5+ digits next to "account".

### Pitfall 5: a return changes the gross
**What goes wrong:** marking the distribution unpaid moves the investor's capital account and the 1099 figures. **How to avoid:** `grossCents`, `withheld`, `netCents` never change; the return is cash and a payable only (C-07).

### Pitfall 6: the sample funds' year-end packages change
**What goes wrong:** a new chart account or a changed sample routing number changes the bytes of the 15 sample funds' packages (phase 11's `audit-same.js` byte-identical check). **How to avoid:** C-07 default (existing account 2000); C-09 plan runs `audit-same.js` and records any intended difference.

### Pitfall 7: the mobile copy drifts
**What goes wrong:** `mobile/src/core/nacha.js` keeps the old table. **How to avoid:** `npm run sync-core` in `mobile/` in every plan that edits `nacha.js`, `data.js` or `tenants.js`; a check compares the two files minus the generated header line.

### Pitfall 8: same-day warning on the wrong day
**What goes wrong:** the $1M warning shown for a next-day file, or the limit hard-coded at $1M after 2027-09-17. **How to avoid:** the warning keys on effective date == creation date and reads a dated limit table.

## Code Examples

### Holiday rule (verified by the probe this session against the old table and moov-io/base)
```javascript
// Federal Reserve holidays of a year as 'YYYY-MM-DD': Sunday -> Monday, Saturday -> no closure (Reserve Banks open Friday).
function fedHolidays(y) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const nth = (m, wd, n) => { const d = new Date(Date.UTC(y, m, 1)); while (d.getUTCDay() !== wd) d.setUTCDate(d.getUTCDate() + 1); d.setUTCDate(d.getUTCDate() + 7 * (n - 1)); return d; };
  const lastMon = (m) => { const d = new Date(Date.UTC(y, m + 1, 0)); while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() - 1); return d; };
  const fixed = (m, day) => { const d = new Date(Date.UTC(y, m, day)); const w = d.getUTCDay(); if (w === 6) return null; if (w === 0) d.setUTCDate(d.getUTCDate() + 1); return d; };
  return [fixed(0, 1), nth(0, 1, 3), nth(1, 1, 3), lastMon(4), fixed(5, 19), fixed(6, 4), nth(8, 1, 1), nth(9, 1, 2), fixed(10, 11), nth(10, 4, 4), fixed(11, 25)]
    .filter(Boolean).map(iso);
}
```
Juneteenth is a Federal Reserve holiday from 2021 [ASSUMED]; the rule is only used for 2025 onward (the console refuses past dates), so no year switch is needed.

### Pre-note entry (accepted by the independent reader this session)
```javascript
// Same record as a credit, transaction code 23 (checking) or 33 (savings), amount 0, addenda indicator 0.
lines.push('6' + (acctType === 'savings' ? '33' : '23') + r.slice(0, 8) + r.slice(8, 9) + alpha(account, 17) + num(0, 10) +
  alpha(investorId, 15) + alpha(name, 22) + '  ' + '0' + odfi8 + num(trace, 7));
```

### Reading an addenda 99 / 98 record (positions from moov-io/ach addenda99.go:97-149 and addenda98.go:118-143)
```javascript
function addenda(rec) {
  if (rec.length !== 94 || rec[0] !== '7') return null;
  const type = rec.slice(1, 3);
  if (type === '99') return { kind: 'return', code: rec.slice(3, 6), originalTrace: rec.slice(6, 21).trim(), deathDate: rec.slice(21, 27).trim(), originalRdfi: rec.slice(27, 35).trim(), info: rec.slice(35, 79).trim(), trace: rec.slice(79, 94).trim() };
  if (type === '98') return { kind: 'noc', code: rec.slice(3, 6), originalTrace: rec.slice(6, 21).trim(), originalRdfi: rec.slice(27, 35).trim(), corrected: rec.slice(35, 64).trim().split(/\s+/), trace: rec.slice(79, 94).trim() };
  return null;
}
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Same-day limit $100,000 per payment | $1,000,000 | 2022-03-18 [CITED] | The warning threshold |
| $1,000,000 | $10,000,000 | 2027-09-17 [CITED] | Dated limit table |
| Pre-note wait six banking days | Three banking days | 2014 [CITED] | Held-entry date |
| Pre-notes only before the first entry | Any time (re-validation) | 2024-06-21 [CITED] | A pre-note after every bank change is allowed |
| Free entry descriptions | "PAYROLL" (wages) and "PURCHASE" (consumer e-commerce debits) required | 2026-03-20 [CITED] | Refuse those words for distributions |
| No originator fraud-monitoring duty | Risk-based fraud monitoring for non-consumer Originators | by 2026-06-22 [CITED, dates differ across sources] | The portal's bank-change controls support the sponsor |

**Deprecated/outdated:** a hand-written holiday table (replaced by the rule); one modifier per build.

<!-- patterns, stack, pitfalls done -->

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` [VERIFIED: file read this session], so this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Pure-module checks | Node scripts in `.planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/`, each loading `assets/js/*.js` into a fresh `vm` context (phase 11 pattern, `11-*/checks/bank-files.js`), one PASS/FAIL line per case and a last line `<NAME>: PASS (cases run: N)` |
| Independent reader | `achcli` v1.69.1, called by `lib16.js` on every generated and fixture file: `-validate-file` and `-validate-totals` must print nothing and exit 0 (or fail with the expected error for refusal cases); summaries only through `-mask` |
| Browser checks | Playwright through `SCRATCH/exec-011/heavy.sh`, phase 06 `checks/lib.js` helpers, sandboxed iframe with connect-src blocked (`06-*/checks/no-network.js` pattern), 390x844 touch and 1280x800, `ways-out.js` |
| Server tests | `cd server && node --test`; phase 16 adds none and changes one fixture value (C-09: `server/test/invitations.test.mjs:46`); the count stays the merged tree's |
| Phase gate | `checks/gate16.sh` (phase 11's `gate11.sh` shape) plus `.planning/checks/gate-reference.sh` on the merged tree |
| Quick run | `node .planning/phases/16-*/checks/nacha-build.js && node .planning/phases/16-*/checks/achreturns.js && node .planning/phases/16-*/checks/achrecord.js` |
| Full suite | `bash .planning/phases/16-*/checks/gate16.sh` then the reference gate |

### Phase Requirements -> Test Map

| Req | Behaviour | Type | Command | Exists? |
|-----|-----------|------|---------|---------|
| AC-01 | Holiday rule = independent calendar 2025-2035 and = old table 2025-2028; next banking day; the schedule and the console use it | unit | `node checks/holidays.js` | Wave 0 |
| AC-02 | Modifier `[A-Z0-9]` only; steps on download/copy only; 37th file of a day refused; counter per origin, destination and date | unit + browser | `node checks/nacha-build.js --case modifier` | Wave 0 |
| AC-03 | No SEC type, unknown investor type or a wire payee: left out with a reason, never silent | unit | `node checks/nacha-build.js --case sec` | Wave 0 |
| AC-04 | Same-day entry above the dated limit warns (amber), not split; $1,000,000.00 no warning, $1,000,000.01 warns; from 2027-09-17 the limit is $10M | unit | `node checks/nacha-build.js --case sameday` | Wave 0 |
| AC-05 | Offset validated and required when balanced; override company ID 10 characters; reserved descriptions refused; Download and Copy disabled while a check is red | unit + browser | `nacha-build.js --case fields`, `ach-flow.js --case gating` | Wave 0 |
| AC-06 | File record on the run (trace per entry, last four only); history shows the sent file; "Build again" needs a reason; the record-time net comparison unchanged | unit + browser | `node checks/achrecord.js --case filerecord` | Wave 0 |
| AC-07 | Pre-notes: new or changed account -> pre-note file (23/33, $0) valid in the independent reader; live entry held until 3 banking days after; history exempts | unit + browser | `achrecord.js --case prenote`, `ach-flow.js --case prenote` | Wave 0 |
| AC-08 | Return/NOC reader: NACHA (addenda 99/98), CSV with column map, by hand; size and line limits; malformed refused with one sentence; no network | unit | `node checks/achreturns.js` | Wave 0 |
| AC-09 | Matching by trace, then ID + amount + date with one candidate; idempotent; line returned; account state; NOC pending until an admin confirms | unit | `achrecord.js --case returns,noc` | Wave 0 |
| AC-10 | Books: return = cash in + payable; paid again = payable off + cash out; reconciliation matches the return credit; the 15 sample funds' packages byte-identical | unit | `node checks/posting-returns.js`, phase 11 `audit-same.js` | Wave 0 (audit-same exists) |
| AC-11 | Investor sees "Returned by your bank" and the Account prompt; new details reset to pre-note; "Paid by wire" | browser | `ach-flow.js --case investor` | Wave 0 |
| AC-12 | International wire details (BIC shape, IBAN mod 97), Wires list with net amounts, Mark sent, books cash line | unit + browser | `achrecord.js --case wires`, `ach-flow.js --case wires` | Wave 0 |
| AC-13 | No checksum-valid routing number with an assigned prefix in fixtures, checks, server tests or sample data (except the listed BAI2 samples if C-09 keeps them) | scan | `node checks/ach-leak.js --case fixtures` | Wave 0 |
| AC-14 | No full account or routing number in the change log, toasts, `achLog`, run records, help guide or check output; white label (no provider, vendor or tool name; never "basic"); mobile copy in sync; managed edition unchanged | scan + browser | `node checks/ach-leak.js`, status-math in the reference gate | Wave 0 |
| AC-15 | Help guide entries within the caps (sponsor 48,000, investor 20,000 bytes) | server test | `cd server && node --test test/help-guide.test.mjs` | exists |

### Sampling Rate
- **Per task commit:** the plan's own check(s) (under 30 s each, no browser).
- **Per wave merge:** `gate16.sh` (all phase 16 checks + `audit-same.js` + server tests).
- **Phase gate:** the reference gate on the merged tree, preview build, owner-path walkthrough at phone size, then the owner's own check.

### Wave 0 Gaps
- `checks/lib16.js` (vm loader, never-issued number helper, `achcli` runner with `-mask`), `checks/achcli.sh` (pinned install, fails with the install line when missing)
- `checks/fixtures/ach/holidays-2025-2035.txt` + `make-holidays.go` (provenance), `checks/fixtures/ach/make-fixtures.js` + the synthesized `.ach` and `.csv` files
- `checks/nacha-build.js`, `holidays.js`, `achreturns.js`, `achrecord.js`, `posting-returns.js`, `ach-flow.js`, `ach-leak.js`, `gate16.sh`
- No framework install for the product; Go 1.26 toolchain is fetched once by `achcli.sh`.

<phase_requirements>
## Phase Requirements

| ID | Description | Traced to | Research support |
|----|-------------|-----------|------------------|
| AC-01 | Banking days for any year: the Federal Reserve's eleven holidays by rule (Sunday to Monday, Saturday no closure) plus a dated list of extra closed days (empty at launch); `isBankingDay`, `nextBankingDay`, `bankingDayReason` and the distribution schedule (`data.js` `bankingOnOrAfter`) use it; the 2025-2028 table removed | D-01 "bank holidays computed for any year"; F-1 | 3.1; probes `hol.js`, `holgo` |
| AC-02 | File ID modifier: only `A-Z`, `0-9`; consumed when a file is downloaded or copied, not when previewed; counted per immediate origin, immediate destination and creation date; the 37th file of a day refused with one sentence | D-01 "file ID modifier stepping"; F-4; C-02 | 2 F-4; 3.2 |
| AC-03 | Every entry is either in a batch of its SEC code or in "left out" with a reason: no SEC type, an investor type with no SEC code, a payee paid by wire, a held account (pre-note waiting, returned) | D-01 "entries with no SEC type"; F-2 | 2 F-2; 3.2 |
| AC-04 | Same-day: when the effective date is the creation date, each entry above the limit for that date ($1,000,000.00 until 2027-09-16, $10,000,000.00 from 2027-09-17) gets an amber warning saying it settles the next banking day; nothing is split | D-01 "same-day ACH $1M per-entry warning"; F-3 | 3.6 |
| AC-05 | Field checks complete and binding: settlement routing and account validated and required when "Balanced files" is ticked; an offering's company ID 10 characters; Nacha's reserved descriptions refused; Download and Copy disabled with the reason while any check is red | F-5, F-6, F-9, F-11 | 2; 3.2 |
| AC-06 | The run's file record: when a file for a distribution is downloaded or copied, the run stores its name, modifier, creation stamp and each entry's investor, trace, amount, kind and last four; the history's "ACH file" shows that record and marks any copy as already sent; a new file for a recorded distribution needs "Build again" with a reason | F-7, F-8; C-05 | 2; 6.4 |
| AC-07 | Pre-notes: an account added or changed is "new"; the ACH origination page builds a pre-note file ($0, codes 23/33) for every new account; a live entry to an account waits until three banking days after its pre-note's effective date (shown with that date); an account with a successful payment and no change needs none; the sponsor can turn pre-notes off | D-02 "bank accounts checked with pre-notes"; D-01 "pre-notes"; C-03, C-15 | 3.3 |
| AC-08 | Reading returns and NOCs: a NACHA return/NOC file (addenda 99 and 98), a CSV report through a confirmed column map, or one entered by hand; refusals in one plain sentence (size, lines, not a return file, PDF); full numbers kept in memory only | D-01 "reading bank return and NOC files back in"; D-02 "return files uploaded back and matched to investors" | 6.1, 6.2, 6.5 |
| AC-09 | Matching and effects: original trace first, then investor ID + amount + date with exactly one candidate (sponsor confirms); the same return applied once; the line marked returned with code and date; the account state per section 3.4; a NOC proposed and applied only when an admin confirms (old and new last four shown), followed by a pre-note and a notice to the investor | D-02; 3.4, 3.5 | 6.3, 6.4 |
| AC-10 | Books and reconciliation: a returned line posts cash back in and a payable (C-07); paying it again (new entry or check) clears the payable; gross, tax withheld and net never change; phase 11's reconciliation matches the statement's return credit; the 15 sample funds' packages stay byte-identical | Phase 11 dependency (ROADMAP "Depends on"); 6.4 | 6.4; Pitfalls 5, 6 |
| AC-11 | Investor side: a returned payment reads "Returned by your bank" with the date; the Account page asks for new bank details and the bank step takes them (new account, pre-note follows); a wire-paid line reads "Paid by wire to account ending NNNN" | D-02; F-15 | 6.4 |
| AC-12 | Foreign accounts: "International wire" in the bank step (beneficiary, address, bank, country, BIC, IBAN or account, optional intermediary; BIC shape and IBAN check digits checked); the Distributions page's "Wires" list with each investor's net amount, details and reference, copy and download; "Mark sent" by who and when; one cash line per wire in the books | D-01 "IAT or wire instructions for foreign investors"; C-04; F-14 | 4 |
| AC-13 | Fixture hygiene: never-issued routing numbers (unassigned prefixes, valid check digit) and `99`-prefixed account numbers in every phase 16 fixture, in the earlier checks and server test that use a bank's published number, and in the sample firms and investors | 16-CONTEXT carried rule; F-13; C-09 | 7 |
| AC-14 | Proof and limits: the independent reader on every generated and fixture file; no full number in logs, events, toasts, run records, the guide or check output; white label (no provider, vendor or tool name, never "basic"); the mobile copy regenerated; the managed edition gets the builder fixes only (C-12); works in the no-server preview | CLAUDE.md; AUTOPILOT; F-18 | 7; Validation |
| AC-15 | Help guide: the smallest entries that let the help chat answer the new buttons (about 440 bytes sponsor, 110 investor; section 8) | AUTOPILOT help guide cap | 8 |
</phase_requirements>

## 8. Recommended plan breakdown (waves, files)

Ownership rule (as phases 10-13): a file is edited by one plan per wave; `console.js`, `portal.js`, `onboarding.js`, the three HTML pages and the help guide each have one owner plan in this phase. Plans sized for about 100k tokens each.

| Wave | Plan | Delivers (requirements) | Owns (edits) | Depends on |
|------|------|-------------------------|--------------|------------|
| 1 | **16-01 Builder fixes** | Holiday rule + extra-days list; modifier validation; SEC refusal; same-day dated limit warning; offset validation; reserved descriptions; pre-note entries; per-entry trace in the result; `checks` split into blocking and warning; mobile copy synced; `lib16.js`, `achcli.sh`, holiday fixture from the independent calendar, `nacha-build.js`, `holidays.js` (AC-01, AC-02 builder part, AC-03, AC-04, AC-05 builder part, AC-07 entry, AC-14 reader runs) | `assets/js/nacha.js`, `mobile/src/core/nacha.js` (generated), `checks/lib16.js`, `checks/achcli.sh`, `checks/nacha-build.js`, `checks/holidays.js`, `checks/fixtures/ach/holidays-*` | - |
| 1 | **16-02 Return and NOC reader** | `assets/js/achreturns.js` (detect, NACHA addenda 99/98, CSV column map over `NS.bankFiles.csvRows`, code tables in plain words, corrected data, limits); fixtures synthesized and each passed through the independent reader (AC-08) | `assets/js/achreturns.js` (new), `checks/achreturns.js`, `checks/fixtures/ach/make-fixtures.js` and its `.ach`/`.csv` outputs | - (uses `bankfiles.js` read-only) |
| 1 | **16-03 Fixture hygiene** (C-09) | Never-issued numbers in `server/test/invitations.test.mjs`, the phase 01/04/05/06 checks, phase 11 fixtures `fund-a/b/c.js` and `posting.js`, `assets/js/tenants.js`, `assets/js/data.js` (`fakeRouting` prefixes, the sample trust's number); mobile copy synced; reference gate and `audit-same.js` run, any intended byte difference recorded; `ach-leak.js --case fixtures` (AC-13) | those files, `mobile/src/core/data.js`, `mobile/src/core/tenants.js` (generated), `checks/ach-leak.js` | - |
| 2 | **16-04 ACH record** | `assets/js/achrecord.js`: file record on runs, modifier counter, account check states, pre-note eligibility (three banking days via `nacha.nextBankingDay`), match/apply returns and NOCs, admin confirmation, paid again, wires and Mark sent, which entries a file may hold (AC-02 counter, AC-06, AC-07 rules, AC-09, AC-12 record) | `assets/js/achrecord.js` (new), `checks/achrecord.js` | 16-01 (trace output), 16-02 (parsed record shape) |
| 2 | **16-05 Books for returns** | `books-post.js` desired entries for a returned line and its second payment (C-07), reconciliation sees the cash line, sample packages unchanged (AC-10) | `assets/js/books-post.js`, `checks/posting-returns.js` | 16-04's interface block (shape only; may stub) |
| 3 | **16-06 Console: files and pre-notes** | Distributions: gating, held entries with reasons and dates, same-day warnings, history file record and "Build again"; ACH origination: offset required, pre-notes panel and file, pre-note setting; offering override check; one hook for `ach-ui.js`; script tag for `achrecord.js` (AC-02, AC-05, AC-06, AC-07 screens) | `assets/js/console.js`, `diy.html`, `index.html`, `portal.html` (one line each), `.planning/tools/preview/` file list | 16-01, 16-04 |
| 3 | **16-07 Investor side** | Bank step: international wire (BIC, IBAN mod 97), new details after a return; portal: returned payment, paid by wire, Account prompt (AC-11, AC-12 investor part) | `assets/js/onboarding.js`, `assets/js/portal.js` | 16-04 |
| 4 | **16-08 Returns and wires screens** | `assets/js/ach-ui.js` (self-serve): Returns block on Distributions (upload NACHA or CSV with column confirmation, by-hand dialog, list, NOC confirmation by an admin), Wires block (list, copy, download with CSV formula guard, Mark sent); script tags for `bankfiles.js`, `achreturns.js`, `ach-ui.js` (AC-08 screen, AC-09 screen, AC-12 screen) | `assets/js/ach-ui.js` (new), `diy.html`, `index.html`, `portal.html` (script lines), preview file list | 16-02, 16-04, 16-06 (the hook) |
| 5 | **16-09 Guide, proof and owner check** | Help guide lines (below), `help-data.js` regenerated; `ach-flow.js` (sandboxed frame, both sizes, no network, ways out), `ach-leak.js` full scan, white-label scan, `gate16.sh`, reference gate lines; preview build; owner checkpoint (AC-14, AC-15) | `server/lib/help-guide.mjs`, `.planning/tools/preview/help-data.js` (generated), `checks/ach-flow.js`, `checks/ach-leak.js` (extends), `checks/gate16.sh`, `.planning/checks/gate-reference.sh` (lines only) | all |
| 6 | **16-10 The owner's inputs** (waits for the owner, as 11-17 does) | His bank's ACH origination guide (immediate origin, company ID form, balanced or not), a masked return/NOC report export from his bank (CSV map and wording), and, if he wants, a test upload at his bank; each applied when it arrives | as each input needs | 16-09 |

Shared files and their single owners: `console.js` 16-06; `portal.js`, `onboarding.js` 16-07; `diy.html`/`index.html`/`portal.html` 16-06 (wave 3) and 16-08 (wave 4), different waves; `data.js`/`tenants.js` 16-03; `books-post.js` 16-05; help guide 16-09. `mobile/src/core/*` regenerated by the plan that edits the source.

**Help guide (sponsor guide at 46,698 of 48,000 bytes on this tree, measured this session; investor guide 15,436 of 20,000; other phases' pending entries compete for the same 1,302 bytes, AUTOPILOT.md lines 76-78).** Recommended lines, measured at 451 bytes for the three sponsor lines as source strings (about 440 bytes of guide text) and 120 bytes for the investor line:
- Distributions entry: `"Pre-notes" builds a $0 file that checks new bank accounts; an account is paid 3 banking days after its pre-note, unless the bank returns it.`
- Distributions entry: `"Returns" reads the bank's return or change file (or enter one by hand): a returned payment is owed again and its account waits for new details; a change updates the account.`
- Distributions entry: `Foreign investors paid by wire are listed in "Wires" with the amount and bank details to enter at your bank.`
- Investor guide: `If your bank sends back a payment, Account asks you to update your bank details; the payment is then sent again.`
If the sponsor guide test fails at 16-09's merge, the guide-trim quick task recorded in AUTOPILOT.md runs first; the cap is not raised.

## 9. Choices the orchestrator must make (each with the recommended default)

| ID | Choice | Recommended default | Why |
|----|--------|---------------------|-----|
| C-01 | Holiday source | The rule plus an empty dated list of extra closed days | Works for any year (D-01); reproduces the old table exactly; agrees with an independent calendar 2025-2035 |
| C-02 | When a file ID modifier is used | On download or copy only; counted per origin, destination and creation date; the 37th file of a day refused | Previews never collide with real files; no silent wrap |
| C-03 | Pre-notes | On by default: every new or changed account gets one; live entries wait three banking days after its effective date; accounts with a successful payment and no change exempt; a sponsor setting turns them off | D-02 chose pre-notes to check accounts; the wait is the rule once one is sent; the after-change pre-note is the sponsor's fraud control (3.7) |
| C-04 | Foreign accounts | International wire details and a Wires list; no IAT files at launch | Most small banks cannot accept IAT; a wire works at every bank (section 4) |
| C-05 | What a recorded distribution keeps of its file | The file record (name, modifier, stamp, per entry investor, trace, amount, kind, last four); never the file text | Matching returns needs the trace; the text holds every full number |
| C-06 | Debit files for capital calls | Not at launch; calls stay on wire | Regulation E authorization and copy, Nacha WEB validation, the bank's debit approval, R01/R10 risk; Stripe later (D-02) |
| C-07 | Where a returned distribution sits in the books | Existing `2000 Accounts payable and accrued expenses` (memo "Returned distribution"), cleared when paid again | No chart change, so the sample funds' packages stay byte-identical; a CPA's read (11-17) can move it to its own account later |
| C-08 | Routing-number prefix test | Not added (checksum only, as today) | The check digit already catches every single-digit typo; a prefix test would refuse the never-issued fixture numbers the owner's rule requires |
| C-09 | Fixture hygiene scope | Replace every bank-published routing number in the portal's own fixtures, checks, server test and sample data in one plan with the gate run (16-03); keep phase 11's two BAI2 samples byte for byte (an outside project's published test data under its licence) and tell the owner | Owner rule: never a real bank number in fixtures; the BAI2 samples are proven only as copied |
| C-10 | Keep the uploaded return file? | No: name, size and SHA-256 only | It holds full account numbers |
| C-11 | Show a return-rate figure | No (no extra text on screens); the sponsor's bank monitors Nacha's rates | Owner's rule against bloat |
| C-12 | Editions | Builder fixes (AC-01 to AC-06) in both editions; pre-notes, returns and wires in the self-serve edition only, through `ach-ui.js` | Fixes prevent wrong or duplicate files everywhere; the managed edition stays unchanged otherwise (status-math slice guard) |
| C-13 | Redemption payouts by NACHA file (`operations.js:308` says "by ACH" but builds no file) | Not in this phase; recorded for the owner | Not in D-01's list; one more plan if he wants it |
| C-14 | Holiday-aware business days in `operations.js` and `books-bank.js` | Leave as they are | Not money movement; changing them moves phase 11 checks |
| C-15 | Where pre-notes go | Their own pre-note file from the ACH origination page (count shown), not mixed into distribution files | One purpose per file; the sponsor sees exactly what is being checked |
| C-16 | How the investor hears of a bank change or a returned payment | A portal notice plus the change log; an email through phase 13's renderer once that is merged and a server is connected | Works with no server; nothing claims an email was sent |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The eleven Federal Reserve holidays as listed | 3.1 | Low: reproduces the code's table and an independent calendar |
| A2 | Banks key duplicate-file detection on origin, destination, date and modifier | 2 F-4, F-7 | A rebuilt file could still be caught or missed differently; the file record makes it moot |
| A3 | Reserved descriptions beyond PAYROLL, PURCHASE, ACCTVERIFY | 2 F-11 | A word refused needlessly, or one missed |
| A4 | A trust account stays PPD | 3.2 | A bank could prefer CCD; no return expected for it |
| A5 | Debit pre-note codes 28/38; pre-note returns come back as R/C codes like payments | 3.2, 3.3 | Only matters for debits (not built) and the reader's tables |
| A6 | IAT entries are not same-day eligible; few small banks originate IAT; international wire fee $35-$50 | 3.6, 4 | Only affects wording and the C-04 rationale |
| A7 | Regulation E 1005.10(d) notice of varying amounts (10 days) | 5 | Only if debits are built |
| A8 | Banks' return report formats (NACHA, CSV, PDF) and the statement showing one return credit | 6.2 | The CSV map may need the owner's bank export (16-10) |
| A9 | A return leaves gross, withheld and net unchanged; the amount is a payable | 6.4 | A CPA may want another treatment (11-17 read) |
| A10 | BIC shape and IBAN mod 97 rules | 4 | A valid foreign number refused or a wrong one accepted |
| A11 | Juneteenth from 2021 | Code Examples | None for 2025 onward |
| A12 | Wise delivery time 1-2 days | 1 | Information only |

## Open Questions (each with the default used if the owner does not answer in 15 minutes)

1. **His bank's ACH implementation guide** (immediate origin form, company ID, balanced or not). What we know: the builder's fields match the standard and an independent reader. Unclear: the owner's bank's preferences. Default: build to the standard; 16-10 applies the guide when it arrives.
2. **A masked return/NOC report from his bank.** Default: the CSV map is guessed and confirmed by the sponsor; NACHA return files are read exactly.
3. **Keep phase 11's two BAI2 samples (C-09)?** Default: keep (outside project's published test data, byte for byte, licensed).
4. **Redemptions by file (C-13)?** Default: not in this phase.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all checks | yes | v22.23.4 | - |
| Go | `achcli.sh` (independent reader), holiday fixture generation | yes | go1.24.7, fetched go1.26 toolchain automatically | none: the check fails with the install line |
| proxy.golang.org | first `achcli` install only | yes (install succeeded this session) | - | a pre-built binary path via `ACHCLI=` |
| Playwright / Chromium | browser checks | yes (phases 06-13 checks use it) | not measured | - |
| Python 3 | phase 11 workbook checks (unchanged) | yes | 3.13.18 | - |
| Vendor pricing pages (stripe.com, dwolla.com, moov.io, moderntreasury.com), nacha.org, frbservices.org | research only | no (hosts outside this session's allowed network) | - | search excerpts, tagged; to be re-read by the owner before any paid choice |

**Missing dependencies with no fallback:** none for building. **With fallback:** the vendor and rule pages (search excerpts used).

## Security Domain

| ASVS Category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no (unchanged) | - |
| V4 Access Control | yes | Applying a NOC, marking an account fixed, "Build again" and "Mark sent": admin in the self-serve edition (the role that may configure), logged with who and when |
| V5 Input Validation | yes | Return/NOC reader: size and line limits before parsing, 94-character records, codes from fixed tables, no eval, no DOM parser; CSV through the existing splitter; IBAN/BIC/routing checks; wire-list CSV cells starting with `=`, `+`, `-`, `@` prefixed with `'` |
| V6 Cryptography | yes (fingerprint only) | `NS.audit.sha256`; never hand-rolled |
| V7 Errors and Logging | yes | Change log and toasts carry last four only; check output through `achcli -mask` |
| V8 Data Protection | yes | Full numbers only in `investor.payment.bank`; files never stored |

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| Email-borne bank-detail change (payment fraud) | Spoofing | Pre-note after every change (C-03), notice to the investor, change log |
| A forged NOC file redirecting payments | Tampering | NOCs only proposed; an admin confirms with old and new last four; pre-note follows |
| The same file uploaded twice at the bank | Repudiation / financial loss | File record per run; marked copies; "Build again" with a reason |
| A crafted return or CSV file | Denial of service / injection | Limits, fixed tables, no evaluation; refusal in one sentence |
| Full numbers in logs or check output | Information disclosure | Last four only; `ach-leak.js`; `-mask` |

## Sources

### Primary (read in full this session)
- Repository files: `assets/js/nacha.js`, `assets/js/console.js` (lines 15, 136-137, 726, 1067-1500, 3211-3280), `assets/js/data.js` (96-140, 185, 200-232, 425-610, 675-700), `assets/js/operations.js` (1-40, 200-225, 280-312), `assets/js/onboarding.js` (429-470, 527-569), `assets/js/portal.js` (171, 916-917, 1131-1156), `assets/js/bankfiles.js`, `assets/js/books-bank.js` (1-71), `assets/js/books-post.js` (headers), `assets/js/tenants.js` (ACH blocks), `mobile/scripts/sync-core.js`, `server/lib/help-guide.mjs`, `server/test/help-guide.test.mjs:120-135`, `.planning/phases/11-*/checks/fixtures/bank/real/SOURCE.txt`, `.planning/config.json`, `.planning/AUTOPILOT.md`, `.planning/ROADMAP.md` (phases 10, 11, 16), `16-CONTEXT.md`.
- moov-io/ach v1.69.1 module (Apache-2.0): `addenda99.go` (layout, return codes 344-422), `addenda98.go` (layout 118-143, change codes 246-266, corrected data 326-480), `LICENSE`, `NOTICE`, `go.mod`, `test/testdata/cor-example.ach`; `achcli` run on generated and synthesized files.
- moov-io/base v0.68.3 `time.go` (`IsBankingDay`), run against the holiday rule for 2025-2035.

### Secondary (search excerpts; the pages themselves could not be opened from this session)
- Nacha: [Same Day ACH $1M rule](https://www.nacha.org/million), [$1M guidance](https://www.nacha.org/sites/default/files/2022-03/Same_Day_ACH_Guidance_%241M.pdf), [$10M rule](https://www.nacha.org/rules/increasing-same-day-ach-dollar-limit-10-million-0), [$10M news](https://www.nacha.org/news/same-day-ach-payment-limit-increase-10-million), [Banking day RFI (pre-note wait)](https://www.nacha.org/rules/request-information-definition-banking-day-and-related-operational-topics), [Company entry descriptions](https://www.nacha.org/rules/risk-management-topics-company-entry-descriptions), [Micro-entries](https://www.nacha.org/micro-entries), [WEB debit fraud detection](https://nacha.org/rules/supplementing-fraud-detection-standards-web-debits), [IAT FAQ](https://www.nacha.org/content/international-ach-transactions-faqs), [Unauthorized return rate](https://www.nacha.org/system/files/2021-03/Unauthorized-Return-Rate-Mar-2021.pdf), [Summary of upcoming rule changes](https://www.nacha.org/content/summary-upcoming-rule-changes)
- Federal Reserve: [Holiday schedules](https://www.frbservices.org/about/holiday-schedules), [K.8 holidays](https://www.federalreserve.gov/aboutthefed/k8.htm), [2026 FedACH holiday notice](https://frbservices.org/news/fed360/issues/121625/ach-2026-holiday-schedule), [Same Day ACH FAQ](https://frbservices.org/resources/financial-services/ach/faq/same-day-ach.html), [FedACH processing schedule](https://frbservices.org/resources/resource-centers/same-day-ach/fedach-processing-schedule.html), [IAT FAQ](https://www.frbservices.org/resources/financial-services/ach/faq/iat.html), [FedACH 2026 fees](https://frbservices.org/resources/fees/ach-2026)
- CFPB: [Regulation E 1005.10](https://www.consumerfinance.gov/rules-policy/regulations/1005/10/) and [its commentary](https://www.consumerfinance.gov/rules-policy/regulations/1005/interp-10/)
- Bank rule summaries: [Capitol Federal NOC rules](https://www.capfed.com/business/treasury-management/true-blue-online-business/ach-rules), [Regions 2026 changes](https://www.regions.com/insights/commercial/article/2026-nacha-rule-changes), [JPMorgan rule changes](https://www.jpmorgan.com/payments/client-resource-center/industry/nacha-rule-changes), [FNBO 2024 rules](https://fnbo.com/content/dam/fnbo/documents/commercial/2024-nacha-rules-update.pdf)
- Prices: [Stripe pricing](https://stripe.com/pricing), [Stripe Connect pricing](https://stripe.com/connect/pricing), [NerdWallet Stripe fees](https://www.nerdwallet.com/business/software/learn/stripe-fees), [Dwolla pricing](https://dwolla.com/pricing), [NerdWallet Dwolla review](https://www.nerdwallet.com/business/software/learn/dwolla), [Moov pricing](https://moov.io/pricing), [Modern Treasury pricing](https://moderntreasury.com/pricing), [Plaid billing](https://plaid.com/docs/account/billing/), [Wise batch payments](https://wise.com/us/blog/everything-about-batch-payments), bank fee schedules ([Baker Boyer](https://www.bakerboyer.com/business-banking/cash-management-services/ach-origination-services), [Forbright](https://www.forbrightbank.com/business-banking/fee-schedule/), [NVB](https://www.nvb.com/cash-management-fee-schedule), [Grasshopper](https://www.grasshopper.bank/forward-checking-commercial-fee-schedule/))
- Routing numbers: [Routing transit number (Wikipedia)](https://en.wikipedia.org/wiki/Routing_transit_number); lookup sites for 021000021 (e.g. [bank-code.net](https://bank-code.net/routing-numbers/021000021-jpmorgan-chase))

### Tertiary (low confidence, marked where used)
- Study-guide and vendor-marketing pages quoted by the search excerpts (open-exam-prep.com, card-network articles, competitor comparison pages).

## Metadata

**Confidence breakdown:**
- In-repo defects and the file format: HIGH - every file read; generated files parsed by an independent reader.
- Holiday rule: HIGH - matches the old table and an independent calendar for 2025-2035.
- Nacha and Federal Reserve rules: MEDIUM - search excerpts of the official pages; the pages themselves could not be opened.
- Prices: LOW - search excerpts, several third-party; re-read on vendor pages before a paid choice.
- IAT vs wire and debits: MEDIUM - rules cited; bank practice assumed.

**Research date:** 2026-11-26
**Valid until:** 2026-12-26 for prices and rules (Nacha changes take effect in March, June and September; the $10M limit on 2027-09-17).

<!-- research complete -->
