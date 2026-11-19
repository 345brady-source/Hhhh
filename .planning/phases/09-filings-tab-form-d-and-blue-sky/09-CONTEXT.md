# Phase 09: Filings tab - Context

## Decisions (owner, 2026-11-16, from 01.4-RESUME "Step 4")
- D-01: a new console tab "Filings" holding everything below; all optional (sponsors can still file themselves).
- D-02: Form D filed by the portal through the SEC's EDGAR APIs (EDGAR Next), Carrow & Vale as filing agent. $100 per Form D including EDGAR access setup for new issuers (pre-filled Form ID ready to notarize, a guide for login.gov and naming Carrow & Vale as filing agent, progress tracking). Form D amendments $50.
- D-03: blue sky notice filings done by Carrow & Vale: the portal collects the sponsor's information and each state's fee; $100 per filing covering any number of states; renewals $50; state fees passed through at cost. NASAA EFD has no known public API: research it.
- D-04: reminders when filings are due (first Form D within 15 days of first sale, annual amendment, state deadlines and renewals); the sponsor can silence reminders.
- D-05: payments for these services depend on the payments provider chosen in phase 08; until then the portal records the order and the amount due.
- Carried: white label; lean screens; .planning/AUTOPILOT.md conditions. Filing itself needs Carrow & Vale's EDGAR filing-agent access (the owner is applying); build and test against the SEC's test/beta environment or recorded fixtures, never a live filing.

## Orchestrator choices (2026-11-19; asked by push, no answer within 15 minutes; the owner may override any of them)
- C-01: the first working filing route is a Carrow & Vale person uploading the portal-built Form D file on EDGAR. Why: the SEC's API needs two technical administrators and a manual token renewal every 30 days; the upload route needs neither and can be proven now. The API route stays planned behind the same interface.
- C-02: the sponsor completes Form ID on the SEC's site from the portal's answer sheet. Why: the SEC accepts Form ID only when typed into its own dashboard, and doing it on a sponsor's behalf needs a notarized power of attorney and a lawyer's wording.
- C-03: the EFD system fee is passed through at cost with the state fees. Why: consistent with D-03 (state fees at cost).
- C-04: Carrow & Vale staff see and work orders by email plus token-protected server calls. Why: the self-serve edition has no staff role, and a staff console is out of scope for this phase.
- Open for the owner: a second person for Carrow & Vale's EDGAR account (opens the API route); the official NASAA fee matrix (network host blocked from this session).

## Plan-check additions, wave 1 (executors apply these with their plan; checked 2026-11-19, 3 blockers fixed here, 7 warnings)

### 09-01 (filings record and due dates)
- A1 (blocker): one definition of a sale. A sale is (a) a request with type subscription and status approved, funded or accepted (amount `r.cents / 100`, date `r.decided`), or (b) a position whose ref is not such a request (commitment where present, otherwise amount; date `p.date`). `firstSale`, `sold`, `investors`, `byState` and `outsideUS` are all computed from that one list; a position and its request are never both counted; redeemed positions still count; declined requests and redemptions never count. Case `facts` adds: an approved, unfunded subscription gives `sold` equal to its amount and `investors` 1.
- A2 (blocker): the non-accredited figure counts only investors who have invested. `nonAccredited: { count: the accepted list's length, pending: the pending list's length, unanswered }` (not `eligibility.nonAccredited().count`, which is accepted plus pending). Case `facts` adds: one accepted and one pending non-accredited investor gives count 1, pending 1.
- A3: the annual and the change reminders are both absent once `rec.ended` is set and not after today (the Form D instructions exempt a change after the offering terminates), with a case.
- A4: case `change` adds: commissions, finders' fees and proceeds to insiders (up 10 percent no, up 11 percent yes, down no); non-accredited 36 to 36 no, 36 to 37 yes, 36 to 35 no; total offering between a number and Indefinite, either way, yes; a base of 0 (minimum 0 to any amount no; total, commissions, fees or proceeds 0 to any positive amount yes, with no division by zero).
- A5: case `holidays` adds: `businessDay('2027-12-31')` is `2028-01-03`, and `holidays(2027)` includes `2027-12-31` (1 January 2028 is a Saturday).
- A6: `gate9.sh` step 1 drops lines matching `^GATE (ok|FAIL) +server tests [0-9]+$` and does not count them; step 4 adds a fifth stand-in where the tree's test count differs from base plus markers, ending `GATE9 SELF-TEST: PASS (5)`; the verify grep and the done line match.
- A7: once the last line is known, `gate9.sh` removes `GATE_OUT/gate/base-tree` and `GATE_OUT/gate/shots`.
- A8: each check loads its module inside each case, so a RED run prints a `FAIL` line and not a bare stack trace.

### 09-02 (Form D builder)
- B1 (blocker): `fromXml` accepts and drops comments, and on the root element only the two attributes `xmlns:xsi` and `xsi:noNamespaceSchemaLocation`; it refuses any other attribute, a document type or entity declaration, a processing instruction other than the XML declaration, and an unknown root. It never returns a ccc: `ccc`, `contactData`, `notificationAddressList`, `testOrLive` and `returnCopy` are dropped, because they come from `toXml`'s options.
- B2: `validate(draft, { today, submission, ccc, contact })`; ccc and contact are checked only when passed (09-05 calls the short form).
- B3 (masking proof): the `real` allow-list also holds the four-digit year in `yearOfInc/value` and the schema's fixed values `None` and `All States`; the case fails on any comment, attribute or processing instruction other than the XML declaration; the masking tool writes every replaced original value of four or more characters to `$O/originals.txt` (never printed, never committed) and the verify runs `! grep -rFqf $O/originals.txt server/test/fixtures/formd/real/`; `SOURCE.txt` and the summary never name the twelve filings' CIKs, accession numbers or addresses; `list.txt` stays in SCRATCH.
- B4: case `prefill` builds `facts` and `rec` as literals (`assets/js/filings.js` belongs to 09-01 and is not in this worktree).
- B5: as A8.
- B6: a notice with several issuers needs one CCC per issuer; that belongs to 09-05. If the plan runs short of room, say what is left in the summary.

## After 09-02 (merged 8d56b7a, 2026-11-19)
- Proven on the merged tree: FORMD XML 9 cases; the builder's own files pass the SEC schema; the twelve masked filings draw no error from the rule table; the independent masking proof finds none of the 295 replaced values in the fixtures; server tests 205.
- For 09-04: `assets/js/formd.js` is loaded by no page yet; one field can carry both a schema message and an EDGAR-rule message, show one per field; the rule "an additional issuer gives previous names or None" is an error that the SEC's two sample files themselves trip (the twelve accepted filings do not): keep it as an error unless a TEST upload shows EDGAR accepts the blank.
- For 09-05: a notice with several issuers needs one CCC per issuer (`ccc` may already be one text or a map by CIK).
- Orchestrator choice: the masked fixtures keep their amounts, dates and state codes. Why: they are public SEC filings with every name and address replaced, and fixtures that are unlike real filings prove less. The owner may ask for rounding and date shifts.
- Not proven until Carrow & Vale has filing access: EDGAR's own checks that only a TEST upload shows (issuer name against EDGAR's record, the CIK and CCC pair, an amended notice's accession number).
