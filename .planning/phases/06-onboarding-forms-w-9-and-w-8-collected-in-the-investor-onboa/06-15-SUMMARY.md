---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 15
subsystem: investor onboarding (self-serve), sponsor benefit plan panel
tags: [D-06, D-08, onboarding, erisa, rule-506b, regulation-a, white-label]
status: complete
requires: [06-08, 06-09, 06-11, 06-13]
provides: [lean investor onboarding screens, NS.eligibility.planInvestors, checks/onboarding-items.json, status-flow part lean]
affects: [06-16..06-21 (tax step rebuild keeps the payment fields and the tax step untouched here)]
tech-stack:
  added: []
  patterns: [item record (onboarding-items.json) held on screen by a check part]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/onboarding-items.json
  modified:
    - assets/js/onboarding.js
    - assets/js/eligibility.js
    - assets/js/console.js
    - assets/js/invitations.js
    - server/lib/invitations.mjs
    - server/test/invitations-status.test.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-math.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
decisions:
  - "D-08 (2): the 506(b) sophistication questions are one question (alone / with a purchaser representative / no) plus the representative's name and the optional written acknowledgment; experience, education and the representative's firm removed"
  - "D-08 (1): one benefit plan question plus the plan-asset share; the sponsor's panel is a plain list of who answered yes with committed and pending amounts; per-class percentages, if-accepted figures and flags, value basis, controlling marks and the control question removed"
  - "Owner removals applied: the investor-side 506(b) may-be-full warning (and the snapshot boolean nonAccreditedFull, browser and server) and the note shown where no accreditation statement is asked"
  - "No step folded: each candidate fold was judged and kept apart with its reason (consent before the login record; identity check runs on saved details; status corrections while a request is pending; agreement prepared from the saved commitment)"
metrics:
  duration: "55 min (measured: from the base-commit.txt record, written at the start, to this summary)"
  completed: 2026-11-15
actuals:
  tokens: 25300    # chars/4 over the lines added in the diff ecbae77..6bbe732 (101,077 characters)
  tasks: 3
  commits: 4      # git rev-list --count ecbae77..HEAD before this summary commit
plan_head_before: ecbae772f6978def24faeada8cd39bfee99a3cbf
plan_head_after: 6bbe7325df05d2b5ca29d085baad6dbdf7c9b808
---

# Phase 6 Plan 15: Investor onboarding screens cut to what the law or the step needs (D-06, D-08)

Every item on the self-serve investor onboarding screens was judged once, with a reason recorded for each (140 items on 12 screens, in checks/onboarding-items.json): 87 kept, 52 removed, 1 folded into another question. The investor status step now asks only what the law needs. Under Rule 506(b) that is the accredited question, then for a "no" one question taken from Rule 506(b)(2)(ii): whether the investor has the knowledge and experience, alone or with a purchaser representative. With a representative, the investor gives the name and can upload the written acknowledgment. The benefit plan part is one question ("Is <account> a benefit plan investor?") plus, for an entity holding plan assets, its share. The sponsor's Benefit plan investors panel is now a plain list of who answered yes, with committed and pending amounts. It shows no percentages, no "if accepted" figures, no flags and no controlling marks. The tax step and the payment fields were not touched (later plans rebuild them). Sponsor-side text was not touched except the benefit plan panel (D-08).

The owner has not checked any of this. It is not done until he has looked at the before and after screenshots below and the list of removals and keeps.

## Failures first

1. **Gate run 1 failed: the owner-set leak check.** It found 4 places where an eight-word run matched the owner's documents. All 4 were the new Rule 506(b)(2)(ii) question, which used the rule's own phrasing; those documents use the same phrasing. I reworded it to "Does <account>, alone or with a purchaser representative, have enough knowledge and experience of business and financial matters to judge the merits and risks of this investment?" It has the same legal meaning. Commit 6bbe732. Output: SCRATCH/exec-06-15/gate-run1-fail.txt.
2. **Gate run 2 failed for the same reason, this time in a commit message.** My fix commit's message quoted the old wording. I amended that message; the commit was not pushed and is my own. The leak check then passed: 412 files and 473 commit messages searched. Output: SCRATCH/exec-06-15/gate-run2-fail.txt. Every other check in runs 1 and 2 passed.
3. **The lean part failed twice, both times in my own step-count check, not in the product.** First, I expected 11 steps for a new 506(b) individual; the real count is 10 (11 is for Rule 506(c)). Second, I split the headings on commas, and "Welcome, Daniel" contains a comma. Both checks were fixed. On both runs all 147 item and walk pairs passed.
4. **The plan's exact counts do not hold, and here is why.** STATUS FLOW has 25 parts, not 29. The base had 26. The parts `controlling` and `classes` were removed because D-08 removed what they tested (controlling marks; per-class percentages). The part `lean` was added. SERVER MODE has 8 parts, not 10: plan 06-14 was skipped, so its 2 parts do not exist. FORM MAPS has 2 forms, not 3: plan 06-12 runs in parallel and is not merged into this tree. STATUS MATH has 12 cases, not 13: `bpishare` and `erisa` were replaced by `erisa-list`. The gate script checks these exact numbers.
5. **Nothing was folded and no walker needed a change.** No step was removed or merged, so phase 4's step count is unchanged. Phase 4 lib.js, phase 5 flow.js, SCRATCH/owner-set/walk.js and SCRATCH/build/proof/proof.js fill nothing I removed: their phone, accAttest and similar fields are all kept. Their only waits are on `.ivf-done` and on headings that are unchanged. I added no reasons.txt lines, because no outside walker changed. The full gate below runs them.

## RED (new behaviour: the sponsor's benefit plan list)

Commit 439608f added the status-math case `erisa-list` before any code. Run on the base code, it printed (SCRATCH/exec-06-15/red-math.txt):

```
FAIL erisa-list eligibility.js exports planInvestors :: ["regime","LIMIT_506B","BASES","qualOf","nonAccredited","place","flags","usd","RA_NOT_ATTESTED","regAStatus","BPI_LIMIT","planPct","bpiShare","pctText","controllingMarks","erisa"]
STATUS MATH: FAIL (cases run: 12) - erisa-list
```

After ea44835: `STATUS MATH: PASS (cases run: 12)`. All 10 checks of the case pass. It checks who is listed, committed and pending amounts, a later "no" replacing a recorded "yes", an invalid plan-asset share shown as not given, no flag from a benefit plan answer, and that erisa(), bpiShare, pctText, controllingMarks and BPI_LIMIT are gone.

## Gate (Task 3 verify, run from SCRATCH/exec-06-15/gate.sh with this tree's real counts)

Last lines, verbatim (SCRATCH/exec-06-15/gate.txt, run 3):

```
==> /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-15/server.txt <==
# todo 0
# duration_ms 9639.144145

==> /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-15/math.txt <==
PASS gate a case list of blanks exits 1 with FAIL
STATUS MATH: PASS (cases run: 12)

==> /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-15/maps.txt <==
PASS W-8BEN the date label is printed just under date
FORM MAPS: PASS (forms run: 2)

==> /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-15/forms.txt <==
PASS sign-w8ben no request left the check server
FORMS FLOW: PASS (cases run: 2)

==> /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-15/status.txt <==
PASS lean Regulation A Tier 1 with the accredited question off: no accreditation tick on Subscription
STATUS FLOW: PASS (parts run: 25)

==> /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-15/srvmode.txt <==
PASS clean the investor’s device reached nothing outside but the integration server
SERVER MODE: PASS (parts run: 8)

==> /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-15/persons.txt <==
PASS  errors signing: no page errors (0)
TWO PERSONS: PASS

==> /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-15/owner.txt <==
PASS leak (3 s): 412 files and 473 commit messages searched: no name of the list, no run of eight words outside the allowed list; no vendor or library name in assets/js, the pages, names under assets/ or our files beside the runtime (one line allowed: app.js's test and call of the host runtime's property on window); the vendored runtime as recorded
MEASURE: PASS
GATE: PASS
GATE_EXIT=0
```

Phase 4 and 5 checks against a copy of the base tree (no FAIL the base lacks):

- signing (base tree ecbae77): 75 PASS, 0 FAIL
- signing (this plan): 75 PASS, 0 FAIL
- record (base tree ecbae77): 40 PASS, 0 FAIL
- record (this plan): 40 PASS, 0 FAIL

Also measured: server tests 177 of 177 pass; status-flow 388 PASS lines, 0 FAIL; server-mode 247 PASS lines, 0 FAIL; part lean holds 147 item and walk pairs.

## Before and after screenshots of each investor step

Five walks, each captured before (base ecbae77) and after (this plan). Each walk has every step, with the status step shown both empty and answered. Both folders use the same file names, and the index is SCRATCH/exec-06-15/before-after-index.txt.

- Before: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-15/before/
- After: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-15/after/
- The walks: `a-individual-506b` (new individual, Rule 506(b), not accredited, purchaser representative), `b-entity-rega2` (new LLC, Regulation A Tier 2, not accredited, entity holding plan assets at 40 percent), `c-ira-506c` (new IRA, Rule 506(c), with the verification step), `d-onfile-506b` (investor on file), `e-individual-rega1` (new individual, Regulation A Tier 1).
- The lean part also saves its own screens as SCRATCH/exec-06-15/checks-out/status-shots/lean-*.png.

Words on each screen, before and after. This is the whole step's text, including its buttons and the 70-entry country list on Investor information. Measured from the capture's text files in SCRATCH/exec-06-15/words.txt:

| Step (walk a unless named) | Before | After |
|---|---|---|
| Welcome | 314 | 213 |
| Create your login | 68 | 32 |
| Investor information | 205 | 173 |
| Identity verification | 100 | 52 |
| Investor status, answered (506(b), not accredited, with representative) | 290 | 155 |
| Investor status, answered (walk b, Reg A Tier 2 entity) | 332 | 211 |
| Investor status (walk c, Rule 506(c), benefit plan only) | 219 | 92 |
| Accredited investor verification (walk c) | 99 | 75 |
| Tax certification (not judged here) | 295 | 295 |
| Distribution payments (fields not judged here) | 97 | 97 |
| Subscription | 157 | 76 |
| Subscription agreement (wrapper and fields) | 122 | 110 |
| Done | 136 | 94 |

Steps before and after for each path (the same; nothing was folded):
- New individual, Rule 506(b): Welcome, Create your login, Investor information, Identity verification, Investor status, Tax certification, Distribution payments, Subscription, Subscription agreement, Done (10).
- New account, Rule 506(c): the same with Accredited investor verification before Investor status (11).
- Investor on file: Welcome, Investor status, Subscription, Subscription agreement, Done (5).

## Owner decisions applied (they take precedence over the plan text)

- **D-06**: each item was judged on its own and the reason recorded. Nothing was moved behind a link, and no screen-count or word-count rule was used. The sponsor's panels and their explanations are unchanged, except the benefit plan panel (D-08).
- **D-08 (1) ERISA**: the investor answers one question: yes as a Title I plan, yes as a section 4975 plan or account, yes as an entity holding plan assets, or no. An entity holding plan assets also gives the share of its equity held by benefit plan investors. request.qual.erisa is exactly { plan, planPct }. The sponsor's panel lists who answered yes, with committed and pending amounts. Removed: per-class percentages, if-accepted figures and the request flag (bpiFlags), the value basis (capital balances or commitments), controlling-person marks (offering.erisaControlling and the bpi-ctrl action), the control question (stCtrl, erisa.controlling), and erisa(), bpiShare, pctText, controllingMarks, capitalAt and BPI_LIMIT. Also removed: controlling from the snapshot's on-file summary, in the browser (invitations.js cleanErisa) and on the server (server/lib/invitations.mjs cleanErisa). An earlier "governmental, church or non-U.S. plan" answer still reads as not a benefit plan investor and stays visible until changed.
- **D-08 (2) 506(b) sophistication**: one question (Yes, alone / Yes, with a purchaser representative / No). With a representative, the investor gives the name and can upload the written acknowledgment (optional, as before). request.qual.sophistication is { knowledge, rep: { name, fileId?, fileName? } | null }. Removed: investment experience, education or profession, the separate yes/no representative question (folded into the one question), and the representative's firm. A firm saved by an earlier version still shows on the sponsor's request row. An earlier saved "representative: yes" reads as "with a representative".
- **Proposed removals applied**: the investor-side "506(b) may be full" warning is gone, in local and server mode. The browser no longer sends offering.nonAccreditedFull in the snapshot, the server no longer keeps it, and the investor's device no longer stores it. The sponsor's N of 35 count and the "Would be non-accredited purchaser 36 of the 35" flag stay, and status-flow `full` and server-mode `full` still check them. Also gone: the sentence shown where no accreditation statement is asked (Regulation A Tier 1, listed Tier 2, Regulation Crowdfunding, Regulation S); the tick is simply left out.
- **Tax step excluded**: fTax and the payment step's fields are unchanged.

## Removed and kept, item by item (from checks/onboarding-items.json)

### Welcome

| Item | Decision | Reason |
|------|----------|--------|
| Heading "Welcome, <first name>" | keep | The screen needs a heading; it greets the person the invitation is for. |
| First sentence: who invited the investor and to what (the account named when it is not the person) | keep | The investor needs to know who is asking and for which offering and account before consenting. |
| The account named for an entity account in the first sentence | keep | Replaces the removed "Account" row: an entity investor sees which account the invitation is for. |
| "This page takes you through every step, from creating your login to signing your subscription documents." | remove | Describes the page; the steps themselves and the step counter show it. |
| On file: "Your account details are already on file." | keep | Tells an investor on file why they are not asked for their details again. |
| On file: "so this page takes you through the subscription: the offering documents, your commitment and the subscription agreement." | remove | Describes the page; not needed to give consent. |
| Facts row "Invited by" | remove | Repeats the first sentence. |
| Facts row "Account" (name and kind) | remove | Not needed to consent; an entity account is named in the first sentence and the kind of account is chosen on Investor information. |
| Facts row "Offering" (name and type) | remove | The offering is named in the first sentence; its type is in the offering documents. |
| Facts row "Commitment" (when the firm set the amount) | remove | The amount is shown where the investor commits, on Subscription. |
| The firm's own note to this investor (when the sponsor wrote one) | keep | The sponsor's message to this investor can carry instructions the investor needs; it is the sponsor's text, not the portal's. |
| Closed-offering note ("is no longer accepting subscriptions, so this page sets up your account only") | keep | Tells the investor no subscription can be made, which changes what they are doing. |
| "What you will need" heading | remove | Each step asks for what it needs when it needs it. |
| "A government-issued photo ID ..." / entity: "Where the account was formed ..." | remove | The identity and investor information steps ask for these themselves. |
| Entity list item "Where the account was formed, and the name of anyone who owns 25% or more of it" | remove | Investor information asks for these itself. |
| "Your Social Security number, or your foreign tax number ..." | remove | Investor information asks for it itself. |
| "Your bank's routing number and your account number, for distributions" | remove | The payment step asks for them itself. |
| "About 10-15 minutes. Your progress is saved after each step ..." | remove | A time no one measured; "progress is saved" is already on every step. |
| On file: "About 5 minutes. Your investor information, tax form and distribution account stay as they are on file." | remove | A time no one measured; the sentence kept above says the details are on file. |
| Consent box title "Consent to electronic records and signatures" | keep | E-SIGN Act (15 U.S.C. 7001(c)): consent to electronic records must be given after the required disclosures; the title names what is consented to. |
| Consent scope ("asks to provide your account documents to you electronically and to have you sign them electronically, under ... ESIGN ... UETA") | keep | E-SIGN 7001(c)(1)(B)(ii): the consumer is told what the consent applies to. |
| "Your electronic signature is binding." | keep | States the legal effect of what the investor consents to (ESIGN, UETA). |
| "Paper copies." (how to get one, at no charge) | keep | E-SIGN 7001(c)(1)(B)(iv): how to obtain a paper copy and any fee. |
| "Withdrawing consent." | keep | E-SIGN 7001(c)(1)(B)(i), (iii): the right to withdraw consent and how. |
| "What you need." (browser that shows PDFs, email access, tell us if it changes) | keep | E-SIGN 7001(c)(1)(C)(i) and (B)(iii): hardware and software requirements and updating contact information. |
| Tick "I agree to use electronic records and signatures, and I have read the information above." | keep | The E-SIGN consent itself; nothing electronic can be signed without it. |
| Tick "I consent to receive statements, tax documents and notices electronically ..." (when the firm requires electronic delivery) | keep | Consent to electronic delivery the firm requires for this portal (E-SIGN; IRS rules for electronic tax statements need affirmative consent). |

### Create your login

| Item | Decision | Reason |
|------|----------|--------|
| Heading "Create your login" | keep | The screen needs a heading. |
| Lede "You will sign in to <portal> with this email and password." | remove | Repeats the heading. |
| First and last name of the person signing in | keep | Who the login belongs to; the step cannot be completed without them. |
| Email (read only) | keep | The username the investor signs in with. |
| Password, hint "At least 10 characters" | keep | The password, and the rule it must meet to be accepted. |
| Confirm password | keep | The step checks the two match, so a mistyped password is caught before the investor is locked out. |
| Note "Each time you sign in from a new device you will also enter a 6-digit code ..." | remove | Not needed to create the login; the code is asked for when it is needed. |

### Investor information

| Item | Decision | Reason |
|------|----------|--------|
| Heading "Investor information" | keep | The screen needs a heading. |
| Lede "This appears on your account, your subscription documents and your tax forms." | remove | Explains where the details go; not needed to give them. |
| "Investing as" (kind of account) | keep | Decides which identity details, beneficial owners and tax form apply (CIP, CDD rule). |
| Legal name fields, hint "Your legal name, as on your government ID" | keep | CIP (31 CFR 1010.230, 1020.220) needs the legal name; the hint says which name, so the identity check matches. |
| Entity legal name, hint "The legal name of the entity" | keep | CDD rule: the legal entity's name. |
| Country, mailing address, city, state, ZIP or postal code | keep | CIP requires an address. |
| Phone | keep | Carried into the subscription agreement the investor signs; without it the investor types it into the agreement. |
| Date of birth | keep | CIP requires the date of birth of an individual. |
| Citizenship | keep | Decides U.S. person status for the tax form and the identity check. |
| State or country of formation (entity, trust) / custodian (IRA) | keep | CDD rule and the identity check for an account that is not a person. |
| Controlling person / trustee (read only) | keep | CDD rule: one individual with control of the entity. |
| Beneficial owners instruction ("list each person who owns 25% or more ... If no one does, list the person who controls the account") | keep | CDD rule (31 CFR 1010.230(d)): the instruction the investor needs to fill the owners correctly. |
| Beneficial owner names and ownership percentages | keep | CDD rule: each 25 percent owner. |
| Taxpayer ID, hint "Nine digits." | keep | CIP requires an identification number; the hint is the format the step accepts. |
| Hint "Stored encrypted; only the last four are shown again." | remove | Reassurance; not needed to enter the number. |
| Optional taxpayer ID hint: "Only if you have one." kept, "You give your foreign tax number in the tax step." removed | remove | The second sentence describes a later step (rebuilt by the tax plans). |
| Politically exposed person question | keep | The firm's AML program needs it to decide on enhanced due diligence. |
| Option hint "<team> will contact you for enhanced due diligence" | remove | Not needed to answer the question. |

### Identity verification

| Item | Decision | Reason |
|------|----------|--------|
| Heading "Identity verification" | keep | The screen needs a heading. |
| Lede "<firm> is required to verify the identity of every investor before accepting an investment." | remove | Explains the firm's own duty (sponsor-facing); not needed to do the check. |
| Entity: "The check is for <person>, who controls the account." | keep | Tells the investor whose ID to use; without it the wrong person may verify. |
| The identity check panel ("Identity check", instructions, "Verify my identity") | keep | The check itself. Its text (including "It takes about two minutes") comes from the identity panel shared with the managed edition, which C-03 leaves unchanged; listed for the owner. |
| Note "Sanctions and politically exposed person screening ... runs automatically ... nothing to fill in ..." | remove | Describes something the investor has nothing to do for. |

### Accredited investor verification (Rule 506(c))

| Item | Decision | Reason |
|------|----------|--------|
| Heading "Accredited investor verification" | keep | The screen needs a heading. |
| Lede "<firm> offers interests only to verified accredited investors (Rule 506(c)), so your accredited status is confirmed by a third party ..." | remove | Explains the firm's reason; the panel says what to do. |
| The accreditation check panel ("Accreditation check", "Verify my accreditation") | keep | Rule 506(c)(2)(ii): the issuer must take reasonable steps to verify; this is the verification. |
| Tick "I confirm the information I provide is accurate and will tell <firm> if it changes." | keep | The purchaser's written representation the verification methods rely on (Rule 506(c)(2)(ii)(B) asks for one under the net worth method). |
| Note when the step appears late ("A self-certification is not enough for this offering ...") | keep | Tells the investor why they were sent back to this step before subscribing. |

### Investor status

| Item | Decision | Reason |
|------|----------|--------|
| Heading "Investor status" | keep | The screen needs a heading. |
| Rule 506(b) lede ("<firm> may accept a limited number of investors who are not accredited, so it asks about your status ...") | remove | Explains the firm's reasons; the questions speak for themselves. |
| "You may leave any question unanswered." | remove | Nothing on the step is required (D-30); the investor finds that out by continuing, and the sentence is needed by no one. |
| Regulation A Tier 2 notice: "<offering> is offered under Tier 2 of Regulation A. If you are not an accredited investor, what you may put into this offering is limited to 10 percent ..." | keep | Rule 251(d)(2)(i)(C): the investor is told of the limit before investing. |
| Regulation A Tier 2: "<firm> asks you to confirm that your investment is within that limit." | remove | The statement to tick asks it; this sentence repeats it. |
| Lede when the firm asks the accredited question ("<firm> asks each investor whether they are an accredited investor under Regulation D.") | remove | Repeats the question. |
| Lede when only the benefit plan question is asked ("Your accreditation is verified in its own step, so this step asks only whether ...") | remove | Describes the step. |
| Lede with the firm's accredited question off ("This step asks only whether ...") | remove | Describes the step. |
| Question "Is <account> an accredited investor?" | keep | Rule 506(b): the 35 count needs the answer; Regulation A Tier 2: the limit applies only when not accredited. |
| "Which ground applies?" (after yes) | keep | Rule 506(b): the issuer's reasonable belief rests on a Rule 501(a) ground. |
| Warning "This offering may already have as many investors who are not accredited as it is able to accept ..." | remove | Owner (proposed removal applied): the sponsor's N of 35 flag stays; the server-mode snapshot boolean nonAccreditedFull goes with it. |
| Regulation A Tier 2 statement to tick ("The total ... is not more than 10 percent of ...") | keep | D-07, Rule 251(d)(2)(i)(D): the investor's representation the issuer may rely on. |
| "Your investment experience" with its hint | remove | D-08 (2): not required by Rule 506(b)(2)(ii) or Rule 501(i). |
| "Your education or profession" | remove | D-08 (2): not required by Rule 506(b)(2)(ii) or Rule 501(i). |
| "Is a purchaser representative advising you on this investment?" | folded | D-08 (2): folded into the one Rule 506(b)(2)(ii) question below, whose answers are alone, with a representative, or no. |
| Question "Does <account>, alone or with a purchaser representative, have enough knowledge and experience of business and financial matters to judge the merits and risks of this investment?" (Yes, alone / Yes, with a purchaser representative / No) | keep | Rule 506(b)(2)(ii): each non-accredited purchaser, alone or with a purchaser representative, has that knowledge and experience (D-08 (2)). |
| "Purchaser representative's name" (with a representative) | keep | Rule 501(i): who the representative is. |
| "Representative's firm" | remove | D-08 (2): the name identifies the representative; the firm is not required. |
| Upload "Your written acknowledgment that this person is your purchaser representative" (optional), hint "PDF, PNG or JPEG, up to 25 MB." | keep | Rule 501(i)(3): the purchaser acknowledges the representative in writing; the hint says which files are accepted. |
| Subheading "Benefit plans" (when it follows the accredited questions) | keep | Separates the second question from the accredited questions on the same screen; left out when it is the only question. |
| Benefit plan explanation ("When benefit plan investors come to hold 25 percent or more ... uses these answers to follow that share.") | remove | Explains the firm's own test (sponsor-facing). |
| Question "Is <account> a benefit plan investor?" (Yes: Title I plan / Yes: section 4975 plan or account / Yes: entity holding plan assets / No) | keep | D-08 (1), 29 CFR 2510.3-101(f): the 25 percent test needs to know who is a benefit plan investor. |
| Choice hints "Such as a company pension or 401(k) plan", "Such as an IRA or a Keogh plan", "Such as a fund or account in which benefit plans invest" | keep | An IRA holder or plan sponsor needs the example to know which answer is theirs. |
| Choice "A governmental, church or non-U.S. plan" | remove | Such a plan is not a benefit plan investor: the answer is No. An earlier answer of this kind stays visible until changed. |
| "Share of the entity's equity held by benefit plan investors (%)" (entity holding plan assets) | keep | D-08 (1): the 25 percent count needs the share. |
| Share hint "From 0 to 100. Only that part of this investment is counted as plan money." | remove | The field takes a percentage by its label; the rest explains the firm's count. |
| Question "Does <account>, or an affiliate, have discretionary authority or control over this offering's assets, or give paid investment advice about them?" | remove | D-08 (1): the controlling-person marks are removed; the sponsor judges. |
| Note "Your answers are kept with your subscription and shared only with <firm>." | remove | Reassurance; not needed to answer. |

### Distribution payments (surrounding text)

| Item | Decision | Reason |
|------|----------|--------|
| Heading "Distribution payments" | keep | The screen needs a heading. |
| Lede "<firm> pays distributions by direct deposit (ACH) to a U.S. bank account." | keep | Tells the investor a U.S. bank account is needed; the renderer is shared with the managed edition (C-03). |
| Account fields and the ACH authorization | keep | Not judged here: left to the tax plans 06-16 to 06-21 (plan 06-15 scope). |

### Subscription

| Item | Decision | Reason |
|------|----------|--------|
| Heading "Subscription" | keep | The screen needs a heading. |
| Offering name | keep | Which offering the investor is subscribing to. |
| Offering type and summary after the name ("Private equity fund · Lower middle-market buyout fund") | remove | Marketing; it is in the offering documents. |
| Facts "Minimum commitment" | remove | Repeats the hint under the commitment field. |
| Facts "First close ... (targeted)" | remove | Not needed to subscribe; it is in the offering documents. |
| Facts: the offering's terms the sponsor marked to show (strategy, fund size, term, portfolio) | remove | Summary of the offering documents, not needed to subscribe; the documents carry the terms. |
| "Offering documents" heading and list | keep | The investor represents having read them; they must be able to open them here. |
| Commitment field, hint "Minimum <amount>." | keep | The amount, and the minimum the step checks. |
| Hint "Set by <firm> for this invitation." under a commitment or class the firm set | remove | The field is read only; the investor does not need to be told why. |
| Regulation A Tier 2 warning, first sentence "You have not confirmed that your total investment in this offering is within your limit ..." | keep | C-01 and the Tier 2 notice: the investor learns the limit statement is missing before subscribing. |
| Regulation A Tier 2 warning, second sentence "You can still subscribe: <firm> reviews every subscription ..." | remove | The Continue button shows they can go on. |
| Share class select (more than one class) | keep | The investor chooses the class they subscribe to. |
| "Investing as" (read only) | remove | The account is filled into the agreement; not needed here. |
| Accreditation statement to tick ("<account> is not an accredited investor, and the answers given under Investor status remain accurate." / "... is an accredited investor (<ground>), and this remains accurate.") | keep | The investor's representation the 506(b) count and the issuer's reasonable belief rest on. |
| On file: "<account> is an accredited investor (<ground>), and this remains accurate." | keep | The same representation for an accredited investor. |
| Note where no accreditation statement is asked ("Regulation A does not limit this offering to accredited investors ..." and the Regulation Crowdfunding and Regulation S notes) | remove | Owner (proposed removal applied): the tick is just left out. |
| Tick "I have received and read the offering documents listed above, including the subscription agreement, and I make the representations in the subscription agreement." | keep | The investor's receipt and representations the subscription rests on. |
| Electronic signature tick and typed name (offering without an agreement template) | keep | The signature on the subscription when there is no agreement to sign. |
| Note "Next you sign <firm>'s subscription agreement on this page, with your commitment and details filled in." | remove | The button says "Continue to the agreement". |
| Note "No money is due now; <firm> will send wire instructions when capital is called." (or the open-ended wording) | remove | Said on the done screen under "What happens next". |
| Submitted view (commitment, submitted date, how to change it) | keep | An investor who comes back after subscribing needs to see what was submitted and whom to contact. |

### Subscription agreement

| Item | Decision | Reason |
|------|----------|--------|
| Heading "Subscription agreement" | keep | The screen needs a heading. |
| "Review <firm>'s subscription agreement. Your commitment and details are filled in." | remove | Describes the screen. |
| "Select Start to go to each field that needs you, then Finish." | keep | How to complete the signing. |
| Note when signing again ("The copy you signed earlier could not be sent from this device ...") | keep | Tells the investor why they are signing a second time. |
| Declined text ("You declined to sign. <team> has been told ...") | keep | Tells the investor what happens after declining. |
| The agreement with its fields | keep | The document the investor signs. |

### Done

| Item | Decision | Reason |
|------|----------|--------|
| Heading ("You're all set" / "Thank you. Your subscription is submitted" / "Thank you. Your paperwork is complete") | keep | Tells the investor they have finished. |
| Lede ("Your account with <firm> is active." / review in progress) | keep | The state of the account, including whether the firm is still reviewing. |
| Summary list (Account, Identity, Sanctions screening, Accreditation, Tax form, Distributions, Subscription, Subscription agreement) | remove | Repeats what the investor just did; what is still open is under "What happens next". |
| Summary row "Tax form W-9" | remove | Part of the summary list removed above. |
| Summary row "Accreditation ..." | remove | Part of the summary list removed above. |
| Summary row "Subscription agreement: Signed; waiting for <firm>'s countersignature" | remove | Part of the summary list; "What happens next" says the firm countersigns. |
| "What happens next" heading | keep | Heads the list of what is still to come. |
| Next: "<firm> reviews your subscription and countersigns the agreement. Its status is shown in your portal under Investments." | keep | What happens to the subscription and where to follow it. |
| Next: "A copy of the agreement you signed is in your Documents now ..." | keep | Where the signed copy is (ESIGN: the record is available to the signer). |
| Next: "No money is due now. When capital is called ..." (or the open-ended wording) | keep | When and how money is due. |
| Next: verification still running / evidence not sent (when they apply) | keep | Tells the investor something is still open or must be sent again. |
| Next: "Questions? <team> at <email> or <phone>." | keep | Whom to contact. |
| Button "Go to your portal" | keep | The way out of onboarding into the portal. |

### Every step

| Item | Decision | Reason |
|------|----------|--------|
| Step counter "Step N of M: <step>" | keep | Shows where the investor is and how much is left. |
| "Your progress is saved. You can come back with your invitation link at any time." | keep | The investor can stop and come back with the same link; without it they may think they must finish in one sitting. |

### Steps folded or kept apart (Task 3)

| Item | Decision | Reason |
|------|----------|--------|
| Welcome and Create your login: kept as two steps | keep | The consent must be given, and logged with its time, before the login record is created; on one screen the order would be lost. |
| Investor information and Identity verification: kept as two steps | keep | The identity check runs on the details saved by Investor information (IV().finishOnboarding at that step), so it cannot be on the same screen. |
| Investor status with only the benefit plan question (Rule 506(c), offerings open to all) and Subscription: kept as two steps | keep | An investor corrects a status answer on its own step while the subscription is pending (the request then carries the new answer); on the subscribe screen, which turns read only once submitted, that correction would be lost. |
| Subscription and Subscription agreement: kept as two steps | keep | The agreement is prepared from the commitment the subscribe step saves; it cannot be signed before that. |
| Accredited investor verification and Investor status (Rule 506(c)): kept as two steps | keep | The verification is a third-party check the investor completes in its own panel; the benefit plan question is a different matter, answered by everyone with an offering. |

## Deviations from Plan

1. **[Owner decisions] D-08 and the proposed removals were applied on top of the plan text** (listed above). They reach outside the plan's files list: assets/js/eligibility.js, assets/js/console.js (the benefit plan panel and the removed bpi-ctrl action), assets/js/invitations.js, server/lib/invitations.mjs and server/test/invitations-status.test.mjs. In the server test, the nonAccreditedFull test now checks that the flag is never kept, and the on-file summary test expects { plan, planPct }. Server tests: 177 pass, 0 fail.
2. **[Plan structure] Task 1's commit did not contain part lean.** Part lean covers every screen, so it would have failed against Task 1's code, which changes only the status step. Task 1's commit ea44835 passed the full status-flow run (24 parts) and server-mode run (8 parts) with the status-step checks rewritten. Lean arrived with Task 2 (2ede71e), together with the item record.
3. **[Rule 1] Status-flow parts removed and rewritten.** `controlling` and `classes` tested only things D-08 removed, so they are gone. `erisa`, `planassets` and `erisa-unanswered` now test the plain list instead of percentages. `erisa-prefill` no longer tests the control answer. `b506`, `full`, `other`, `repack`, `regA`, `tier1`, `listed` and `portal-506b` follow the new text. Each changed assertion carries a one-line comment naming D-06 or D-08 and plan 06-15.
4. **[Rule 1] The phase 6 lib.js walker** knows the new sophistication question (a.soph; a.rep 'yes' reads as 'rep', 'no' as 'alone'), and fills the representative's firm only where the field exists. finishAgreement waits for `.ivf-done .ivf-need` or `.ivf-done .ivf-summary`, so it works on both trees.
5. **[Rule 1] Reworded the Rule 506(b)(2)(ii) question** after the leak check (see Failures first, items 1 and 2).
6. **The GSD plan ledger file under the git directory was not used** (as in 06-13: the worktree guard refuses that path). `commits` was measured from SCRATCH/exec-06-15/base-commit.txt with `git rev-list --count ecbae77..HEAD`.

## Open items for the owner

- **The identity panel says "It takes about two minutes".** It comes from the identity provider panel, which is shared with the managed edition, and C-03 leaves that edition unchanged. It is kept and listed, not changed.
- **The payment step's lede and fields are kept.** The fields belong to the tax plans; the lede says a U.S. bank account is needed.
- **The sponsor's offering "terms" no longer show to investors during onboarding** (removed as a summary of the offering documents). The sponsor's "show" setting still controls the portal's own offering pages.

## Known Stubs

None. No placeholder text and no empty value flows to a screen.

## Threat Flags

None. No new network endpoint, auth path or file access. The server now keeps fewer fields: no nonAccreditedFull, and no controlling in the on-file summary.

## Self-Check
- FOUND: .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/onboarding-items.json
- FOUND: commit 439608f
- FOUND: commit ea44835
- FOUND: commit 2ede71e
- FOUND: commit 6bbe732
- before/: 51 screenshots
- after/: 51 screenshots

## Self-Check: PASSED
