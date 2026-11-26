# Phase 16: NACHA/ACH upgrades and the $0 money path - Context

## Decisions (owner)
- D-01 (2026-11-15, 01.4-RESUME build order 9): fixes: bank holidays computed for any year, file ID modifier stepping (A-Z, 0-9 per day), entries with no SEC type, the same-day ACH $1M per-entry warning; plus international ACH (IAT) or wire instructions for foreign investors; pre-notes; reading bank return and notification-of-change (NOC) files back in.
- D-02 (2026-11-16, verbatim: "Ok let's go with the 0$ launch path you recommended"): no paid provider at launch. The portal builds the NACHA file, the sponsor uploads it to its own bank; bank accounts checked with pre-notes; return files uploaded back and matched to investors. Carrow & Vale never holds funds. Later, with revenue: Stripe (capital calls) and Dwolla (both directions), fees passed to sponsors.
- D-03 (2026-11-16): transfers and secondary sales only if a transfer agent offers an API; research it when this step is done (recorded, not built here).
- Carried: outside-API check first; white label; works in the no-server preview; never the word "basic"; full bank numbers never in logs, events, fixtures or summaries (fixtures use never-issued routing and account numbers); nothing called ready before the owner checks it.
- Owner (2026-11-26): build everything through step 11 that can be built without him; ask with a push notification and take the default after 15 minutes.

## Questions the research must answer
- What exists: the NACHA builder (assets/js), distributions and capital calls, phase 10 withholding (net paid), phase 11 bank reconciliation (statement upload, C-03), the ACH settings and their current defects.
- The NACHA Operating Rules as they apply: file and batch headers, SEC codes (PPD, CCD, WEB for investor-authorized debits), pre-note timing, return reason codes (R01-R85 that matter) and NOC codes (C01-C14), same-day limits and windows, the Federal Reserve holiday rules for any year, IAT for foreign accounts (and when a wire is the honest answer instead).
- Debits for capital calls: authorization requirements (WEB/PPD), what the investor must agree to, and whether the portal should build debit files at launch.
- Return and NOC file formats banks give back (NACHA return entries, CSV exports) and matching them to the investor and the distribution.
- Outside services with real prices for later (bank file transfer, Dwolla, Stripe, Modern Treasury, Moov) vs the $0 path.

## Owner decisions (2026-11-26, after 16-RESEARCH.md)
- D-04 (C-04): foreign investors are paid by international wire from the sponsor's own bank, listed in the portal ("Wire list"); no IAT at launch.
- D-05 (C-06): no ACH debit files for capital calls at launch; calls stay on wire.
- D-06 (C-13): redemption payment files are built in this phase, on the same builder as distributions.

## Orchestrator choices (2026-11-26, research defaults adopted; the owner may override)
- C-01 holidays by rule plus an empty one-off list; C-02 modifier used only on download/copy, counted per origin, destination and day, 37th file refused; C-03 pre-notes on by default for new or changed accounts with a 3-banking-day wait, accounts already paid exempt, sponsor can turn off; C-05 per entry trace, amount and last four stored, never the file text; C-07 returned distributions in account 2000; C-08 no routing first-digit check (fixtures still use never-issuable numbers); C-09 every real bank number in fixtures and sample data replaced in one plan with its gate run, phase 11's two BAI2 samples (outside project test data) kept and the owner told; C-10 uploaded return file keeps only name, size and SHA-256; C-11 no return-rate figure; C-12 builder fixes in both editions, pre-notes, returns and wires self-serve only; C-14 other business-day helpers left; C-15 pre-notes in their own file; C-16 investor notice in the portal now, email through phase 13 later.
- Owner inputs worked around ("To be confirmed"): his bank's ACH implementation guide; a masked return/NOC report export from his bank.

## After planning (2026-11-26; 14 plans, 6 waves; ROADMAP 2233bf1)
- AC-16 added at planning for D-06: redemption payment files built on the distribution builder (16-12).
- Validator: checks/achcli.sh installs moov-io/ach achcli v1.69.1 through Go's checksum database (hash h1:v+nHTd9qN4vYBmp+4mRf+8E/yztxoxxUtgMxgTGGtbo=), cached in $HOME/.cache/cv-checks/; if it cannot be had, one SKIP line that fails the gate on every tree.
- Orchestrator choices on the planner's open questions (owner may override): (1) phase 11's two BAI2 samples kept (outside project's published test data), owner told; (2) redemption files and the Wires list self-serve only, managed edition gets a truthful payment method in "Redemption paid"; (3) self-serve team members lose Download/Copy of payment files now (C-10); (4) an unconfirmed NOC: old details paid for up to 6 banking days or before the next payment, whichever is later, then held (the Nacha timing as read from excerpts; "To be confirmed"); (7) previewing a NACHA file no longer writes "NACHA file generated"; only download and copy are logged.
- Merged-tree gate note: if its base is older than 16-03's merge, AUDIT SAME differs only by the moved routing prefixes; use 16-03's product commit as that check's base.
- Not built: mobile app returned payments (sample data only); audit file using stored trace numbers for real funds.

## Plan-check additions, wave 1 (16-01..16-04; checked 2026-11-26 against 9b05658; 4 blockers fixed here, 2 warnings). Executors apply these with their plan. Findings: scratchpad checks-16-wave1.md.
- Measured: go1.24.7, proxy and sum.golang.org reachable; sum.golang.org gives the pinned h1 hash; a scratchpad install of achcli v1.69.1 (go switches to 1.26.11) shows the pinned mod line. The holiday rule gives moov-io/base v0.68.3's 112 closures 2025-2035 and the old table's 39 dates.
- B1 (16-01 gate16.sh): before copying base-commit.txt into GATE_OUT/gate, when GATE_OUT/gate/base-commit.txt exists and differs, print "NOTE base commit changed (<old> -> <new>): every step runs again" and export GATE_FRESH=1 (as 14 W1). Self-test stays 9; Task 3 verify adds grep -q 'export GATE_FRESH=1' on gate16.sh.
- B2 (16-03 ach-leak scan): exclude assets/vendor/ and assets/forms/ (third-party, hash-pinned; the rule as written flags view-worker.js:22 and forms1099-data.js:4) and name them in the NOTE line with the BAI2 samples.
- B3 (16-03 swap): replace every digit-bounded occurrence in a file of a number found in that file (server/test/invitations.test.mjs:371's secrets list holds the line-46 number with no routing word; left alone, its "not stored in plain text" assertion tests a number no longer in the fixture). Case checks reports such leftovers; Task 2 verify proves line 371 holds the new line-46 number.
- B4 (16-02 F-7): a draft loaded from the History targets { runId: fromRun } whatever is edited; a recorded, non-cancelled run with no file record (every run recorded before 16-02, all sample runs) is treated as sent: the panel says 'This distribution is recorded as paid on <date>. A second upload pays every investor twice.', Download and Copy wait for Build again, and recordFile refuses that run without again.why (again.of null). Case draft and part history-phone cover a seeded run; counts unchanged (6, 5).
- W1 (16-03 packages): substitution on the base side only, digit-bounded (9-digit base routing numbers; first 8 of a 15-digit trace equal to a base originating prefix); a substituted entry's MANIFEST line must be the tree entry's SHA-256 (audit-same.js rule); selfcheck adds two reported proofs on a tree copy (one cent on a sample fund; one non-prefix trace digit).
- W2 (16-04): books-post.js sample() tracks no 2000; add case sample (Kestrel Bay, one line returned: books balance, unbalanced list and exceptions unchanged, cash up by the net); POSTING RETURNS 10 cases in both verify lines.
- Info: also refuse GONOSUMDB/GOPRIVATE/GOINSECURE matching moov-io in achcli.sh; PREFIX_SWAP has no image for 00/61-72/80 (stop with FAIL if met); a merged-tree AUDIT SAME base must contain 11-12's and 11-18's merges too; planning docs still hold real numbers (mask on next edit).
- Start now: 16-01 yes; 16-03 yes (with B2, B3); 16-04 yes; 16-02 no: waits for 08-18, 11-13 and 12-06 (console.js, diy.html, portal.html).
