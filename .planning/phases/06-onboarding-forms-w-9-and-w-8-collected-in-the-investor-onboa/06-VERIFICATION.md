---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
scope: "Investor-status part only (plans 06-01 to 06-07, merged at 19dac08 on claude/refract-reskin). The tax-form part (plans 06-08 to 06-12: official IRS W-9 / W-8 filled and e-signed) is NOT built and NOT verified here: it waits for the IRS PDFs and the owner's in-house or outside-service choice."
verified: 2026-11-15T17:20:00Z
status: gaps_found
score: 36/39 must-haves verified (status part)
covered_files: [".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-01-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-01-SUMMARY.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-02-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-02-SUMMARY.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-03-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-03-SUMMARY.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-04-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-04-SUMMARY.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-05-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-05-SUMMARY.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-06-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-06-SUMMARY.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-07-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-07-SUMMARY.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-08-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-09-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-10-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-11-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-12-PLAN.md", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-math.js", ".planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/deferred-items.md", "assets/js/console.js", "assets/js/eligibility.js", "assets/js/invitations.js", "assets/js/onboarding.js", "assets/js/portal.js", "diy.html", "index.html", "portal.html", "server/lib/invitations.mjs", "server/test/invitations-status.test.mjs"]
covered_digest: "v4:sha256:8f34560af3089fb5bf8303d6137a787f643022887d07fa239b0ea72402280c5e"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "06-01 / C-05 / D-30: the forced 'accredited' answer is gone; nothing an investor answers about accreditation is required; a non-accredited investor can subscribe"
    status: failed
    reason: "Fixed in the invitation flow only. The investor portal's own subscribe page (portal.js NS.views.subscribe, DIY edition) still REQUIRES the tick '<name> is an accredited investor (<ground>) and this remains accurate' and writes no status answers on the request. An investor already on file reaches that page from the firm's offering link (diy.js line 258 sends a complete investor straight to #subscribe-<offering>) and from 'Open for investment' on Investments. Reproduced on 19dac08: a not-accredited investor on file (no ground) sees 'is an accredited investor () and this remains accurate'; submitting without the tick gives 'Confirm your accreditation to continue.'; ticking it creates a request with no qual. That makes a non-accredited investor certify a false statement to subscribe to a 506(b) offering, skips the 506(b), Regulation A and benefit plan questions, and leaves the purchaser out of the 35 count (it shows only as 'no status answer')."
    artifacts:
      - path: "assets/js/portal.js"
        issue: "line 420 renders the accredited tick; line 450 'if (!u.accredited) e.accredited = ...' makes it mandatory; submitSubscription at line 456 sets no request.qual"
      - path: "assets/js/diy.js"
        issue: "line 258: an investor on file who signs up from the offering link is sent to the portal subscribe page, not to the status step"
    missing:
      - "Route the DIY portal subscribe page through the investor status step (or remove the accredited tick and ask the status questions there), so request.qual is set and nothing is required"
      - "A check: an investor on file who is not accredited subscribes from the offering link to a 506(b) offering without certifying accreditation, and is counted in N of 35"
  - truth: "06-07 server-mode parity: the console's merge keeps the status answers the link collected for an investor on file"
    status: partial
    reason: "Deferred item 1, reproduced on 19dac08. An investor on file with a self-certified ground answers 'not accredited' in server mode. The device withdraws the ground (local withdrawGround), the request arrives with accredited false, but the console's investor record keeps the ground: after import it reads {basis: 'Licensed professional (Series 7, 65 or 82)', date: '2026-04-16'}. Local mode clears it. The record is what the portal's subscribe page states as accredited, what the investor profile shows, and what the next invitation prefills as 'yes'. The 506(b) count is right (it reads the request)."
    artifacts:
      - path: "assets/js/invitations.js"
        issue: "merge, on-file branch (lines ~823-832): takes a self-certified ground only on accredited true; never withdraws one on accredited false"
    missing:
      - "On import, mirror withdrawGround when the request's qual says accredited false and no third-party verification exists (clear basis and date, keep superseded, withdraw the self-certification verification record)"
      - "A server-mode check of the investor on file answering 'not accredited'"
  - truth: "Roadmap / 06-03 C-01: the sponsor sees Regulation A Tier 2 over-limit flags, the limit measured against everything the investor buys in the offering, and the investor is warned"
    status: partial
    reason: "Rule 251(d)(2)(i)(C) limits the aggregate purchase price in the offering. committedCents (eligibility.js line 63) adds only subscription requests made in the portal. (a) A holder whose earlier purchase in the same Tier 2 offering is on the books as a position without a portal request is not counted: probe on 19dac08, $10,000 position plus a $5,000 subscription against a $12,000 limit gives total $5,000, not over, no flag. The panel's note says the limit is 'set against all their subscriptions to this offering'. (b) In server mode the investor's device holds no earlier requests, so an investor on file adding to a Tier 2 holding is never warned on the subscribe step (the console still flags requests it can see)."
    artifacts:
      - path: "assets/js/eligibility.js"
        issue: "committedCents counts ws.requests only, not positions in the offering"
      - path: "assets/js/onboarding.js"
        issue: "raSubLine uses committedCents(c.ws, ...) on the device; in server mode c.ws has no earlier requests and the snapshot carries no committed figure"
    missing:
      - "Count the investor's positions in the offering that no portal request accounts for (not counting a funded request twice)"
      - "Carry the investor's committed amount in the offering in the on-file snapshot summary (one number about them only) so the device can warn"
behavior_unverified_items: []
human_verification:
  - test: "Open /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-07/shots/index.txt and look at the 87 screenshots (30 parts) of the status step, warnings, done rows and console figures"
    expected: "Every screen reads plainly, nothing is required, no provider name or the forbidden word appears, the figures (N of 35, Tier 2 limits, benefit plan percentages) match the cases described"
    why_human: "CLAUDE.md: nothing is done until the owner has checked it; visual and wording quality cannot be proven by grep"
  - test: "Have securities counsel (or the owner) read the investor-facing wording: the twelve Rule 501(a) grounds (written fresh), the sophistication and purchaser representative questions, the Regulation A lede and limit sentence, the benefit plan questions, the Rule 502(b) reminder and the 90-day note"
    expected: "Wording is accurate for the 2020 amendments to Rule 501(a), Rule 251(d)(2)(i)(C) and 29 CFR 2510.3-101(f)"
    why_human: "Legal adequacy of fresh wording is a judgment, not a test"
  - test: "Owner decision on two planner choices in the figures: (1) a holder with no benefit plan answer counts as NOT a benefit plan investor (this can understate the 25 percent figure; listed by name in the panel); (2) Rule 501(e) relatives sharing a home are not excluded from the 35 (overstates)"
    expected: "The owner accepts or changes each choice"
    why_human: "Risk choice for the sponsor's compliance, not a code fact"
---

# Phase 6: Onboarding forms (investor-status part) Verification Report

**Phase goal (ROADMAP):** An invited investor answers the investor-status questions their offering's exemption calls for and fills and e-signs the official IRS W-9 or W-8 inside onboarding, with nothing mandatory; the sponsor sees the Rule 506(b) non-accredited count against 35, Regulation A Tier 2 over-limit flags and the benefit-plan percentage per class against 25 percent, and receives the signed tax form.

**Verified:** 2026-11-15, on the merged tree 19dac08 (main checkout, claude/refract-reskin)
**Status:** gaps_found
**Re-verification:** No, initial verification

**Scope:** only the investor-status half (plans 06-01 to 06-07). The tax-form half of the goal (official W-9 / W-8, signed form to the sponsor; plans 06-08 to 06-12) is not built. The phase goal as a whole is therefore not achieved yet, independent of the gaps below.

## Failures first

1. **A forced "accredited" tick is still in the product (BLOCKER).** The invitation flow is fixed, but the DIY investor portal's own subscribe page still requires "is an accredited investor ... and this remains accurate" and sends no status answers. An investor already on file reaches it from the firm's offering link. Reproduced in the browser on 19dac08 (output below).
2. **Server mode does not withdraw a self-certified ground when an investor on file answers "not accredited" (gap, reproduced).** The device clears it, but after import the console's record still holds "Licensed professional (Series 7, 65 or 82)". Local mode clears it. This is deferred item 1, now proven by a run.
3. **The Regulation A Tier 2 limit misses part of the aggregate (gap, probe).** A position already held in the same offering, with no portal request behind it, is not counted. In server mode, an investor on file adding to a holding is not warned on their device.
4. **My owner-gate run printed MEASURE: FAIL (walkA and walkC). That is a fault in the gate tool, not the product.** walk_diff.py renders a page only when the PNG is not already in its folder (line 24). On the main checkout's folder it compared today's finished PDFs with renders cached on Nov 14 (the cached "signed" pages are byte-identical to the originals, so every signature scored 0 points). With fresh renders the same PDFs pass: walkA's three signatures score 1651, 1547 and 1550 points against a minimum of 12. On walkC every filled place scores 38 or more and every empty one scores 0. Identical code on the 06-07 worktree gave walkA PASS 13/0. walkB and the leak row passed outright. Anyone running the owner gate from the main checkout gets the same false FAIL until the cache is cleared for each run.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Invited investor answers the status questions their exemption calls for; nothing mandatory | ✓ VERIFIED | onboarding.js accAsked/statusStep/fStatus; validateFlow has no 'status' rule; status-flow 24 parts, 316 PASS / 0 FAIL |
| 2 | Sponsor sees Rule 506(b) "Non-accredited purchasers: N of 35" with accepted/pending | ✓ VERIFIED | console.js exemptionPanel; my probe: 35 counted once each, declined, accredited and other offering left out |
| 3 | Sponsor sees Regulation A Tier 2 over-limit flags against the aggregate; investor warned | ✗ PARTIAL | Correct for portal requests in local mode and on the console (device flag ignored: probe and server-mode regA). Positions without a request are not counted; in server mode the device does not know earlier purchases (gap 3) |
| 4 | Sponsor sees benefit-plan percentage per class against 25 percent, red at 25+, if-accepted figures, flag never blocks | ✓ VERIFIED | eligibility.erisa; console bpiPanel; probe: per class, 25.0 flagged, 24.96 shows 24.9 |
| 5 | 506(b) step: accredited yes/no, 2020 Rule 501(a) grounds, sophistication and purchaser representative questions | ✓ VERIFIED | eligibility.js BASES (12 grounds cover every 501(a) category); fStatus |
| 6 | The forced "accredited" answer is gone; a non-accredited investor can subscribe | ✗ FAILED | Invitation subscribe step fixed (subAcc follows the answer, not required). portal.js lines 420/450 still force it on the DIY portal subscribe page; reproduced (gap 1) |
| 7 | D-30: nothing on the status step or the invitation subscribe tick is required | ✓ VERIFIED | validateFlow; refused acknowledgment file is not a field error (status-flow repack) |
| 8 | Answers kept on the request (request.qual) | ✓ VERIFIED | qualFrom wired at subscribe and on pending corrections |
| 9 | "Offering details" headings; no vendor name or the forbidden word on screens | ✓ VERIFIED | status-math titles case; leak row PASS (388 files, 429 commits); the word appears only in two older code comments (console.js 821, invitations.js 3) |
| 10 | Rule 506(c) unchanged; earlier gates green | ✓ VERIFIED | signing-step 75/0, record-check 40/0, two-persons PASS, server 177/177 on 19dac08; walk rows pass on fresh renders (see Failures first, 4) |
| 11 | Unanswered: continues, accredited null, panel lists it apart | ✓ VERIFIED | status-flow unanswered; console unansweredLine |
| 12 | C-01: 36th warned (no count or name), flagged, never blocked; declined leaves; one investor counted once | ✓ VERIFIED | probe; status-flow full; flags() |
| 13 | 90-day integration note; Rule 502(b) reminder when count > 0 | ✓ VERIFIED | console.js exemptionPanel |
| 14 | Rule 501(i) acknowledgment upload (optional) and download | ✓ VERIFIED | status-flow repack; server-mode repack (bytes equal end to end) |
| 15 | Investor on file gets the step; pending correction updates qual with a log entry; old saved step resumes at status | ✓ VERIFIED | status-flow existing, back, resume |
| 16 | Other exemptions; done row reads the status answer | ✓ VERIFIED | status-flow other, tier1, listed; openKind for Reg CF / Reg S |
| 17 | C-03 managed edition onboarding unchanged | ✓ VERIFIED | status-math managed: 7 slices hash as at 414fd9a2, plus self-test; invitation flow gated by ED.diy |
| 18 | C-04 tiers; untiered treated as Tier 2 with a hint | ✓ VERIFIED | EXEMPTIONS, exemptionHint; probe regime cases (Tier II = 2, Tier I = 1, Reg A+ = 2) |
| 19 | Tier 2 figures (person income/net worth; organization revenue/net assets), limit 10 percent of the greater | ✓ VERIFIED | regALimitCents; probe ($85,000 / $120,000 gives $12,000) |
| 20 | Accredited, Tier 1, listed: no limit questions, no warning | ✓ VERIFIED | probe; status-flow accredited2, tier1, listed |
| 21 | qual.regA kept; console recomputes, never trusts the device flag | ✓ VERIFIED | regAStatus; server-mode regA (stored flag tampered, console still flags) |
| 22 | No figures: limit unknown, no warning, "have not given figures" | ✓ VERIFIED | status-flow nofigures |
| 23 | Benefit plan questions on every invitation with an offering, 506(c) included | ✓ VERIFIED | statusStep; status-flow erisa |
| 24 | Question set (Title I, 4975 with IRA prefill, plan-asset entity with percent, governmental/church/non-US, none, control or paid advice) | ✓ VERIFIED | planQuestions, erisaFrom |
| 25 | Answers on request (share) and on investor.erisa | ✓ VERIFIED | qualFrom, status save |
| 26 | Every walker passes the new step; phase 4 step count updated | ✓ VERIFIED | 04 lib.js, 05 flow.js, walk.js additive only; SIGN-02 "Step 10 of 11" passes |
| 27 | Sponsor marks controlling persons and affiliates; each mark logged | ✓ VERIFIED | bpi-ctrl action with audit(); status-flow controlling |
| 28 | Controlling non-plan value left out; controlling plan investor counted | ✓ VERIFIED | probe: 20/70 = 28.6 percent; controlling IRA still counted (29 CFR 2510.3-101(f)(1)) |
| 29 | Plan-asset entity at its percentage; bad percentage = not answered | ✓ VERIFIED | probe 45 percent; 140 percent and a stored share ignored |
| 30 | Each class on its own; value basis named | ✓ VERIFIED | probe classes A/B; bpiPanel basis text |
| 31 | Unanswered holders count 0 and are listed | ✓ VERIFIED | status-flow erisa-unanswered |
| 32 | Investor on file sees earlier plan answers prefilled | ✓ VERIFIED | status-flow erisa-prefill; server-mode existing |
| 33 | Server mode: answers travel unchanged and are counted as in local mode | ✓ VERIFIED | server-mode b506, regA (device qual = server qual = console qual) |
| 34 | Proof uses the real server in process and two separate contexts | ✓ VERIFIED | checks/lib.js serverPortal; commonChecks |
| 35 | Existing server behaviour unchanged | ✓ VERIFIED | server tests 177/177 |
| 36 | C-01 server mode: one boolean in the snapshot, nothing else about other investors | ✓ VERIFIED | server-mode full, clean; server cleanOffering keeps only true/false |
| 37 | On-file prefill both ways; merge keeps the answers the link collected | ✗ PARTIAL | erisa and "yes" ground both ways verified; "not accredited" not applied to the console record (gap 2, reproduced) |
| 38 | rep- acknowledgment through the allowlist; other rep- files dropped | ✓ VERIFIED | server-mode repack; server test with forged ids |
| 39 | Owner gets the screenshot set, failures first | ✓ VERIFIED | exec-06-07/shots/index.txt: 87 screenshots, 30 parts, no failed parts. His check is pending (human item 1) |

**Score:** 36/39 truths verified (0 present but behavior-unverified)

### Not verified here (not built)

| Item | Plans | Why |
|------|-------|-----|
| Official IRS W-9 / W-8BEN / W-8BEN-E filled through their own fields, e-signed, delivered to the sponsor (FORM-01 to FORM-09) | 06-08 to 06-12 | Waiting for the IRS PDFs and the owner's in-house or outside-service choice. The tax step today is still the existing substitute certification |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| assets/js/eligibility.js | ✓ VERIFIED | 395 lines, real logic, loaded in diy/index/portal.html, used by onboarding, console and invitations |
| assets/js/onboarding.js (status step, qual, warnings, upload, withdrawGround) | ✓ VERIFIED | wired into flowSteps, the save step and sendCompletion |
| assets/js/console.js (panels, flags, bpi-ctrl, tiers) | ✓ VERIFIED | eligibilityPanel in the editable DIY offering view; flags on request rows |
| assets/js/invitations.js (snapshot boolean, on-file summary, merge, dates) | ⚠️ PARTIAL | the merge does not withdraw a ground (gap 2) |
| server/lib/invitations.mjs | ✓ VERIFIED | boolean, cleaned summary, rep- allowance |
| checks/lib.js, status-flow.js, status-math.js, server-mode.js; server/test/invitations-status.test.mjs | ✓ VERIFIED | gsd verify.artifacts: 22/22 across plans 01-07 |

### Key Link Verification

The gsd key-link tool could not resolve these links because the plans name the source as a description, not a file path. Each pattern was checked by hand on 19dac08:

| From | To | Status |
|------|----|--------|
| onboarding flowSteps | statusStep(c) | WIRED (3 hits) |
| subscribe save | `.qual = qualFrom` | WIRED (2) |
| console offering view | eligibilityPanel(o) | WIRED |
| console requests row | eligibility.flags( | WIRED |
| status step | rep- file id | WIRED |
| console EXEMPTIONS | 'Regulation A Tier 2, exchange-listed' | WIRED |
| fSubscribe | regALimitCents | WIRED |
| eligibilityPanel | regAStatus, eligibility.erisa( | WIRED |
| controlling list | offering.erisaControlling | WIRED (console 2, eligibility 3) |
| invitations snapshot / summary | nonAccreditedFull, accBasis → server cleanInvestor/cleanOffering → onboarding prefill | WIRED |

### Behavioral Spot-Checks (run by the verifier on 19dac08)

| Check | Result | Status |
|-------|--------|--------|
| `npm --prefix server test` | tests 177, pass 177, fail 0 | ✓ PASS |
| `node checks/status-math.js` | STATUS MATH: PASS (cases run: 13), 154 PASS / 0 FAIL | ✓ PASS |
| `heavy.sh node checks/status-flow.js` | STATUS FLOW: PASS (parts run: 24), 316 PASS / 0 FAIL | ✓ PASS |
| `heavy.sh node checks/server-mode.js` | SERVER MODE: PASS (parts run: 6) | ✓ PASS |
| `heavy.sh node 01.4/checks/two-persons.js` | TWO PERSONS: PASS | ✓ PASS |
| `heavy.sh measure.js --run walkA,walkB,walkC,leak` | walkB PASS 10/0, leak PASS; walkA, walkC FAIL from stale cached renders (Failures first, 4); fresh re-score passes; 06-07 worktree walkA PASS 13/0 | ✓ PASS (product), tool defect noted |
| phase 4 signing-step.js | 75/75 passed | ✓ PASS |
| phase 5 record-check.js | 40/40 passed | ✓ PASS |
| Verifier probe of eligibility.js (my own cases, outside the phase's checks) | 40 PASS / 0 FAIL (506(b), Reg A, ERISA) | ✓ PASS |
| Verifier repro: DIY portal subscribe page, investor not accredited | "Confirm your accreditation to continue."; request qual "(none)" | ✗ FAIL (gap 1) |
| Verifier repro: server mode, investor on file answers not accredited | device basis ''; console basis "Licensed professional (Series 7, 65 or 82)" | ✗ FAIL (gap 2) |
| Verifier probe: Tier 2 holder with a $10,000 position adds $5,000, limit $12,000 | total counted $5,000, not flagged | ✗ FAIL (gap 3) |

Verifier scripts and outputs: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/verify-06/ (fast.sh, browser.sh, probe-math.js, probe-rega-positions.js, repro-existing-no.js, repro-portal-subscribe.js, fresh-diff.sh and their .txt outputs).

### Legal correctness review

| Rule | Implementation | Finding |
|------|----------------|---------|
| Rule 506(b)(2)(i): no more than 35 non-accredited purchasers | per offering; one per investor; declined out; places ranked accepted then pending; the 36th flagged, never blocked; 90-day integration note (C-02) | Correct. Rule 501(e) exclusions not asked, so the count can only err high (owner decision item) |
| Rule 501(a) as amended 2020 | 12 grounds cover every category (institutions, plans, entities over $5M, insiders, net worth, income, trusts, all-accredited owners, investments over $5M, Series 7/65/82, family office and client, knowledgeable employee) | Correct coverage; fresh wording for counsel review |
| Rule 251(d)(2)(i)(C): Tier 2, 10 percent of the greater of income or net worth (person) or revenue or net assets (organization); not for accredited investors or exchange-listed securities | regALimitCents, regAStatus; Tier 1 and listed have no limit | Formula correct. Aggregate misses positions without a request; server-mode device not warned on an addition (gap 3) |
| 29 CFR 2510.3-101(f): 25 percent of any class held by benefit plan investors; controlling persons and affiliates (other than benefit plan investors) disregarded; plan-asset entities count only to their percentage (ERISA 3(42)) | erisa(): per class, controlling non-plan value removed from the base, controlling plan investor kept, plan-asset share at its percent, governmental/church/non-US not counted, if-accepted figures on each pending request | Correct. Unanswered holders count as not plan investors (can understate; owner decision item) |

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| STAT-01 (506(b) count) | 01, 02, 06, 07 | ⚠️ PARTIAL | Correct in the invitation flow; the DIY portal subscribe page creates requests without answers (gap 1) |
| STAT-02 (Reg A Tier 2 limit) | 03, 06 | ⚠️ PARTIAL | gap 3 |
| STAT-03 (ERISA 25 percent) | 04, 05, 06, 07 | ✓ SATISFIED | truths 23-32 |
| STAT-04 | 01, 02, 03, 06, 07 | ? UNDEFINED | STAT-04 is not defined in REQUIREMENTS.md or 06-RESEARCH.md. STAT-01 to 03, FORM-01 to 09 and WL-01 are also missing from REQUIREMENTS.md's traceability table (only in 06-RESEARCH.md) |
| WL-01 (no vendor names, never the forbidden word) | all | ✓ SATISFIED | leak row PASS; titles case; status-flow leak checks |
| FORM-01 to FORM-09 | 08-12 | NOT BUILT | out of this verification's scope |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| assets/js/portal.js | 450 | mandatory accreditation statement on a subscribe path | 🛑 Blocker | gap 1 |
| (phase files) | - | TBD / FIXME / XXX / placeholder | none found | - |

### Warnings (not gaps)

1. **The Regulation A panel does not mention Tier 2 subscribers who left the accredited question open.** They are neither counted nor listed, so the sponsor cannot tell them apart from accredited investors. The 506(b) panel has an unanswered line; Tier 2 has none (probe on 19dac08).
2. **The eligibility and benefit plan panels appear only in the editable offering view.** A team member who cannot configure the offering does not see the 35 count or the 25 percent figure in the read-only view.
3. **nonAccreditedFull is fixed when the invitation is sent.** If the offering fills afterwards, the investor is not warned. The console still recomputes and flags the request.
4. **Deferred item 2:** signedAt and signedBy on imported requests still come from the device. They belong in the phase's security pass.
5. **Benefit plan classes:** an investor holding positions in two classes of one offering is assigned to a single class (structures.classOf), so their value is counted in one class only.
6. **The owner-gate tool** (walk_diff.py line 24) reuses cached page renders across runs. Clear the pages folder for each run, or the main-checkout walk rows report a false FAIL.
7. **Requirement IDs:** STAT-04 is undefined, and the phase's IDs are missing from REQUIREMENTS.md.

### Human Verification Required

1. **Owner's screenshot check.** Test: open /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-07/shots/index.txt and the 87 screenshots. Expected: plain wording, nothing required, no provider name or the forbidden word, figures as described. Why human: CLAUDE.md requires the owner's own check before anything is called done. Note: the screenshots are now from the verifier's re-runs on identical code (19dac08 and e680295 differ only in the SUMMARY). My two repro parts briefly entered that index; they were moved to verify-06/repro-owner-shots and the index rebuilt (87 from 30, none failed).
2. **Legal wording review** of the grounds, questions, lede, 502(b) reminder and 90-day note.
3. **Owner decisions:** unanswered benefit plan holders counted as not plan investors; Rule 501(e) exclusions not asked.

### Gaps Summary

The investor-status step, the three sponsor figures and the server-mode transport are built, wired and pass every phase check on the merged tree. My own legal-math probe confirms the 35 count, the Tier 2 formula and the ERISA 25 percent rules, including controlling persons left out.

Three gaps remain:

- **Gap 1 (blocker, root cause: a second subscribe path the phase did not touch).** The DIY portal's own subscribe page still forces an investor to state that they are accredited and records no status answers. That contradicts C-05's purpose, D-30 and the 506(b) count.
- **Gap 2 (server-mode parity).** A "not accredited" answer from an investor on file does not clear their old ground on the console's record.
- **Gap 3 (Regulation A aggregate).** The limit ignores positions held without a portal request, and in server mode the investor's device does not know earlier purchases.

Gaps 1 and 2 share one concern: the investor record and every subscribe path must follow the status answer.

The tax-form half of the phase goal is not built.

---

_Verified: 2026-11-15_
_Verifier: Claude (gsd-verifier)_
