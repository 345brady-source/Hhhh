---
phase: 08-verification-package-and-ongoing-compliance
plan: 06
subsystem: console invite form (self-serve edition), phase 8 checks
tags: [verification-package, invite, D-01, owner-preview, gate]
status: complete
requires: []
provides:
  - "assets/js/package.js: NS.pkg (load, info, tierFor, priceLabel, box(ws, offeringId, tier))"
  - "invite form control iv-package (name package); invitation.package and invitation.clientId sent to POST /v1/invitations only when ticked; row word Package"
  - "checks/frame.js: stubServer, SANDBOX, CSP, VIEW, framed, proveRefused, noRawError, VENDOR_WORDS, vendorScan, leakFree"
  - "checks/package-invite.js: GATE CHECK PACKAGE INVITE, 9 parts"
  - "checks/gate.sh: P8_OUT (required), P8_SERVER_TESTS (exact count), discovery marker '// GATE CHECK: <NAME>', COUNTS and GATE_EXIT lines"
affects: [08-04, 08-05, 08-09, 08-11, 08-13, 08-14]
tech-stack:
  added: []
  patterns:
    - "server replies stubbed per path with Playwright routes laid over the real integration server (stubServer)"
    - "phase gate finds its checks by a marker line; later plans add a check by dropping a file"
key-files:
  created:
    - assets/js/package.js
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/frame.js
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/package-invite.js
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/gate.sh
  modified:
    - assets/js/invitations.js
    - diy.html
    - index.html
    - portal.html
decisions:
  - "With no server the box is shown switched off with the one line 'Checks run once your portal is connected to its server.' (planner's choice, kept)"
  - "When the server does not offer the package (403 account_required, or available false for the tier) the box is not shown"
  - "An investor on file keeps the box (D-06: the invite form's controls do not change with the investor); the label's price follows what the snapshot sends (full when they hold a Rule 506(c) offering)"
  - "The no-card line links to the Integrations page only for someone who can open it (an admin); a team member gets the sentence without a link"
metrics:
  duration: "about 3 h 10 min of wall time across two agents (15:54 to about 18:40 UTC, 2026-11-19), most of it in the shared browser queue; the final gate run took 2829 s"
  completed: 2026-11-19
actuals:
  tokens: 20300
  tasks: 2
  commits: 4
plan_head_before: c4f3fb4d79db343178cadbe2fc53ac5632af3bc8
plan_head_after: 8e07eb0dc5397198d1ad5ca7fead0e6322f6be8d
---

# Phase 8 Plan 06: Verification package box on the invite form Summary

One tick box, "Add verification package ($19)" or "($99)", priced by the integration server's GET /v1/billing. When ticked, the invitation sends `package: true` and its `clientId` to POST /v1/invitations. In the owner's no-server preview the box is switched off with one plain line, and no connection is attempted. The plan also delivers the phase's reusable gate script and framed-check helpers.

Not done until the owner has checked it on his iPhone (the human check below). The server side (GET /v1/billing, the charge, the package row) is plans 08-04 and 08-05. Here it is a stand-in laid over the real integration server, built to the contract in the plan.

## Failures first

- **The first full gate run failed: FORMS FLOW, case include-tax** (gate-run1, 17:38 UTC). Its D-06 check found `iv-package` missing from the form for an investor on file. The box had been hidden for an investor on file's email, which the plan never asked for. Fixed in 8e07eb0: the box stays for every invitation. Part `single` now checks that a Rule 506(c) holder's label shows the full price. That check was run before the fix and failed (RED run 6 in red2.txt). After the fix, `forms-flow.js --case include-tax` passed. The final gate passed FORMS FLOW (34) with 0 FAIL lines.
- The first agent stopped on a usage limit while the second gate run was starting. That run left an empty gate.txt. The continuing agent ran the gate again on the committed tree (8e07eb0) with the stale owner/, checks-out/ and shots/ folders deleted first. Results are below.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 (tracer) | one tick box; a ticked invitation reaches the server with package and clientId | c57017e |
| 2 | the box in every state, the owner's preview at both sizes, managed edition, phase gate | 7d89f2d |
| fix | the no-card line's link only for someone who can open Integrations | f21b619 |
| fix | an investor on file keeps the box, priced for their invitation | 8e07eb0 |

## RED runs (SCRATCH/exec-08-06/red.txt, red2.txt)

- Task 1: part `single` against the base: 8 FAIL lines, then PASS after the code.
- Task 2 code was already written in Task 1, so the new parts passed against it as it stood (RED run 1). Each behaviour was then shown to fail with it taken out of the code:
  - RED run 2: box() cut down to one state.
  - RED run 3: a refused charge falls back to the email app; the form ignores the box; the edition is ignored.
- RED run 4: the server is asked again while the form is in use. The ticked box was lost; fixed in package.js (the last answer stands until a new one arrives).
- RED run 5: a team member was given a link they cannot open (fixed in f21b619).
- RED run 6: the FORMS FLOW include-tax failure above (fixed in 8e07eb0).

## Verification (run on 8e07eb0)

Task 1 verify: `PACKAGE INVITE: PASS (parts run: 1)`, VERIFY1_EXIT=0. Unknown part name (`--only nosuchpart`): `PACKAGE INVITE: FAIL (parts run: 0) - unknown: nosuchpart`, exit 1.

Task 2 verify (P8_SERVER_TESTS=197, measured on the base c4f3fb4: `# tests 197 / # pass 197 / # fail 0`; P6_OUT=$P8_OUT/checks-out). The gate's last lines, verbatim:

```
GATE ok   server tests # fail 0
GATE ok   server tests 197 (found 197)
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
GATE ok   phase-8 gate checks found (1)
GATE ok   PACKAGE INVITE (9)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 197
# pass 197
# fail 0
COUNTS server tests 197; PACKAGE INVITE 9
GATE_EXIT=0
VERIFY2_EXIT=0 (gate result R=0, gate without P8_OUT exit N=1)
```

PACKAGE INVITE: 169 PASS lines over its 9 parts: single, declined, nocard, notoffered, unreachable, preview-desktop, preview-phone, phone, managed. Each part ends with the leak check and the vendor scan; the vendor scan is first proved on planted words.

## Plan-check additions applied (08-CONTEXT C1 to C5)

- C1: gate.sh reads P8_SERVER_TESTS and requires `# tests` to equal it exactly; otherwise at least 197. The count is always in COUNTS.
- C2: the managed part first asserts the managed form's email field is visible, then checks for no `[name=package]` and no `#iv-package`. It also runs STATUS MATH's managed case (C-03).
- C3: gate.sh exports `P6_OUT="$P8_OUT/checks-out"` exactly.
- C4: no existing invite-form text is reworded. Nothing under server/help/ or in phase 6's checks is touched.
- C5: gate.sh fit in this plan, so nothing is handed to a follow-up.

## Deviations from Plan

1. **[Rule 1 - Bug] The ticked box was lost when the server was asked again** (found by RED run 4). package.js now keeps the last answer until the new one arrives. Commit 7d89f2d.
2. **[Rule 1 - Bug] A team member saw an Integrations link that sent them back to their home page.** They now get the sentence without a link. Commit f21b619.
3. **[Rule 1 - Bug] The box was hidden for an investor on file.** This broke phase 6's FORMS FLOW include-tax (D-06). The box is now always on the form, and its price follows the investor on file's holdings. Commit 8e07eb0.
4. The plan says "No push"; the orchestrator's prompt asked for a push to wip/08-06, and that was followed.
5. Commit trailers: the first agent's four commits carry the earlier trailer (Claude Fable 5.2). The summary commit carries the current one (Claude Opus 5.5), per the continue brief. Earlier commits were not rewritten.
6. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (AUTOPILOT.md: executors never touch STATE.md or ROADMAP.md). VPK-01 and VPK-10 are left for the orchestrator to mark.

## For the plans that depend on this one (08-11, 08-13, 08-05, 08-14)

- Add a gate check by dropping `checks/<name>.js` with `// GATE CHECK: <NAME>` in its first five lines. Its last line must be `<NAME>: PASS (parts run: N)`. Do not edit gate.sh.
- Run the gate as `P8_OUT=<folder holding base-commit.txt> P8_SERVER_TESTS=<base count + your new tests> bash checks/gate.sh`. It refuses to run without P8_OUT.
- frame.js exports stubServer, SANDBOX, CSP, VIEW, framed, proveRefused, noRawError, VENDOR_WORDS, vendorScan and leakFree.

## Human check (owner, not yet done)

In the published preview on the iPhone, open Console, then Investors, then Invite an investor. Expected:
- under the email field, one greyed box "Add verification package" with the line "Checks run once your portal is connected to its server."
- no error text
- the form still sends an invitation

## Known Stubs

None. Without a server, the box being switched off is the intended behaviour. The billing replies are stand-ins only inside the checks, until 08-04 and 08-05 build the server side.

## Threat Flags

None beyond the plan's threat model. T-08-18: package.js holds no price figure; prices come only from GET /v1/billing. T-08-19: noRawError and vendorScan run in every part.

## Self-Check: PASSED

- FOUND: assets/js/package.js, checks/frame.js, checks/package-invite.js, checks/gate.sh
- FOUND in HEAD's history: c57017e, 7d89f2d, f21b619, 8e07eb0
- diy.html, index.html and portal.html script lists are identical and each loads assets/js/package.js once
