---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 24
subsystem: console settings (self-serve), typed activation, investor done screen in server mode, forms-flow owner set
status: complete
tags: [tax-forms, w-9, w-8ben, w-8ben-e, c-03, d-04, d-06, owner-check, server-mode]
requires: [06-23]
provides:
  - self-serve edition with no on/off switch for the tax step (owner-accepted removal); managed edition unchanged (C-03)
  - onboarding.js substituteW9() (always in self-serve, the firm setting in managed)
  - self-serve accreditation hint stating which offerings always ask
  - network failures marked err.network in inviteCall / remoteCall; one plain sentence on "Almost done"
  - forms-flow cases toggle-off and owner-set (31 cases); usIndividualCase, foreignIndividualCase builders; US_LLC, FOREIGN_ENTITY specs; w9AccountCase spec.console; spec.finish hook
  - lib.js walk a.profile
  - the owner's folder SCRATCH/exec-06-24/owner/ with index.txt (failures first)
affects: [phase 6 verification, owner check]
tech-stack:
  added: []
  patterns:
    - "a case builder with the old case's answers as defaults, reused by the owner set with answers written for that run"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-24-SUMMARY.md
  modified:
    - assets/js/console.js
    - assets/js/onboarding.js
    - assets/js/invitations.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/deferred-items.md
decisions:
  - "Owner-accepted removal replaces the plan's relabelled toggle: the self-serve edition has no tax-step switch at all; a firm saved with onboarding.taxForm false still gets the tax step and the typed activation's W-9 certification"
  - "Self-serve accreditation hint: 'Rule 506(b) and Regulation A Tier 2 offerings always ask, and Rule 506(c) offerings verify it. Turn this on to ask in every other invitation too.' Managed hint unchanged"
  - "A fetch with no answer becomes err.network ('The connection failed.'); the done screen says 'We could not reach <firm> to send your details, but nothing you entered is lost: check your connection, then try again.' with Try again"
  - "Owner-set investors finish the whole invitation after the tax form, so the console row the owner sees is a finished investor"
requirements: [FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, WL-01]
metrics:
  duration: "43 min from recording the base (01:31:53 UTC) to the gate's end (02:14:52 UTC)"
  completed: 2026-11-16
  tasks: 2
  files: 7
actuals:
  tokens: 8200     # chars/4 over the 32,938 characters of added lines in 33e5389..4ce593d
  tasks: 2
  commits: 5       # git rev-list --count 33e5389..HEAD before this summary commit
plan_head_before: 33e5389f673bdb94d6a94d3f0c2e24451451be9c
plan_head_after: 4ce593d46acc21aacd09c704d68f5cc9bf49948e
---

# Phase 6 Plan 24: No tax-step switch in the self-serve edition, a plain sentence when the server cannot be reached, and the owner's four signed forms

The self-serve console no longer has a "Collect a substitute W-9 certification" switch. Every investor needs a W-9 or a W-8 before distributions. A firm saved earlier with that switch off still gets the tax step in every invitation, with the same step list. It also still gets the W-9 certification in the older typed activation, which is used when an investor has no open invitation. The accreditation toggle's hint now says which offerings always ask. The managed edition keeps its switch, its hint and its behavior (C-03).

When the firm's server cannot be reached, the "Almost done" screen now shows one plain sentence with Try again. It no longer shows the browser's "Failed to fetch".

Four official forms were signed through the real invitation flow, on answers written for this run only, and copied to the owner's folder with an index. The owner has not checked them. Nothing here is ready until he has.

## Failures first

1. **No failure in the product or the gate.** The final gate passed on its first run (GATE_EXIT=0).
2. **The plan's tracer verify could not run as written.** It calls `status-math.js --case managed`, and plan 06-15 removed that case. The run printed `STATUS MATH: FAIL (cases run: 0) - unknown: managed` (SCRATCH/exec-06-24/managed.txt). In its place, the toggle-off case proves the managed edition unchanged in the browser with 6 checks: the toggle is there and bound to onboarding.taxForm, the hint is unchanged, the certification is absent with the toggle off and present with it on, no script error and no outside request. The full STATUS MATH still passes 12 cases.
3. **Gate counts follow the merged tree, not the plan text.**
   - FORMS FLOW is 31 (29 + toggle-off + owner-set), not 30.
   - STATUS FLOW is 25, not 29. SERVER MODE is 13, not 15.
   - There are 186 server tests. No server code changed, so none were added.
4. **Part of toggle-off could not show RED.** The invitation flow already always pushed the tax step. Before this plan the switch only governed the typed activation's certification and the settings screen. So the invitation checks passed on the base, and the RED came from the settings (3) and the typed activation (1).
5. **Two new items found, not fixed (deferred-items.md, "From plan 06-24"):**
   - The self-serve typed-activation fallback still uses the typed U.S.-only substitute certification, which a foreign investor cannot complete truthfully.
   - With the integrations rule "Require verified accreditation: Never" and the toggle off, a Rule 506(c) investor is not asked about accreditation and is recorded as accredited. So the new hint's "Rule 506(c) offerings verify it" holds under the default rule only.

## RED runs (quoted)

**Task 1** (test 078305a against the base, SCRATCH/exec-06-24/red-t1.txt): 14 PASS, 4 FAIL.
```
FAIL toggle-off self-serve settings: no "Collect a substitute W-9 certification" toggle and no switch bound to onboarding.taxForm :: Investor onboarding Ask for accreditation Regulation D 506(b) and 506(c) offerings. Collect a substitute W-9 certific...
FAIL toggle-off self-serve settings: no other tax-form switch in the Investor onboarding panel
FAIL toggle-off self-serve settings: the accreditation toggle's hint reads "Rule 506(b) and Regulation A Tier 2 offerings always ask, ..."
FAIL toggle-off switch saved off: the typed activation (no open invitation) still asks for the W-9 certification
FORMS FLOW: FAIL (cases run: 1) - toggle-off
```
GREEN on a55e5d3: `FORMS FLOW: PASS (cases run: 1)`, 18 PASS (green-t1.txt).

**Network sentence** (test a12e2a4 against a55e5d3, red-t2.txt): 412 PASS, 2 FAIL in tax-wipe. The page read "We could not send your details to Kestrel Bay Capital: Failed to fetch. Check your connection, then try again. Nothing you entered is lost." GREEN on 7de0672: `SERVER MODE: PASS (parts run: 13)`, 414 PASS (green-t2.txt).

## Gate

Run from SCRATCH/exec-06-24/gate.sh: the plan's Task 2 verify command with this tree's counts, every step run and printed. Last lines verbatim (gate.txt):
```
GATE ok   server tests # fail 0
GATE ok   server tests 186
GATE ok   STATUS MATH (12)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (31)
GATE ok   STATUS FLOW (25)
GATE ok   SERVER MODE (13)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 186
# pass 186
# fail 0
GATE_EXIT=0
```
- **PASS lines, all with 0 FAIL:** forms-flow 871 (701 before), status-flow 388, server-mode 414 (412 before).
- **Owner walks:** walkA 13/0, walkB 10/0, walkC 17/0 (individual) and 17/0 (entity).
- **Leak search:** passed (423 files, 545 commit messages).
- **server/node_modules:** linked for the runs and removed by the scripts. It was never staged.

## What each case measured

**toggle-off** (18 checks):
- **Self-serve settings.** The Investor onboarding panel has no substitute W-9 switch and nothing bound to onboarding.taxForm. It names no W-9, W-8 or tax form. The accreditation hint is the new sentence. Electronic delivery and direct deposit are still there.
- **Two invitations.** Two U.S. individuals were invited, one with onboarding.taxForm saved false and one with it true. Both reach "Tax certification", and the form step leads to the official W-9. The progress lines of every screen up to the tax step (number, label, total of 10) are identical. The invitation's whole step list, from NS.inviteFlow.steps, has 'tax' and is identical.
- **Typed activation.** With the switch saved off, the typed activation's Review step still has "Substitute Form W-9 certification" and #ob-w9.
- **Managed edition.** 6 checks (Failures first, item 2).
- Screens: toggle-off-selfserve-settings.png, toggle-off-managed-settings.png, toggle-off-tax-step.png and toggle-off-selfserve-typed-review.png, in SCRATCH/exec-06-24/checks-out/forms-flow/toggle-off/.

**server-mode tax-wipe keep** (2 new checks):
- With the server stopped, the alert reads exactly "We could not reach Kestrel Bay Capital to send your details, but nothing you entered is lost: check your connection, then try again." with Try again.
- No "Failed to fetch", "NetworkError", "Load failed" or "TypeError" is on the page.
- The keep checks (nothing deleted, Try again sends the same file) are unchanged and pass. Screenshot: SCRATCH/exec-06-24/checks-out/server-shots/tax-keep-failed.png.

**owner-set** (152 checks, 0 failed, in the gate run):
- **Four new investors.** The names, addresses, taxpayer IDs and dates appear in no other repository file (SCRATCH/exec-06-24/unused.sh printed 0 for each of 22 values).
- **Same checks as the original cases.** Each investor walks the whole invitation, and every check of the matching case runs on that investor's output:
  - W-9 U.S. individual: 34 checks.
  - W-9 LLC taxed as a partnership with foreign partners: 33.
  - W-8BEN foreign individual: 40.
  - W-8BEN-E Active NFFE: 44.
- **What those checks read.** Each value inside its own field, nothing else filled, exactly the expected boxes, signature ink, caption and date. Also: zero form fields, the sealed copy, the record, no full taxpayer ID saved anywhere, and the console row with a Download of the same bytes.
- **Walked to the end.** Each investor then finishes payments, the subscription and the agreement to the done screen (2 more checks each).
- **What I looked at.** I opened page 1 of the LLC's W-9, the W-8BEN, and pages 1 and 8 of the W-8BEN-E, and two console screenshots. Each answer is in its box: LLC with P and line 3b ticked, EIN 47-3810562; "Joaquín Peñalosa Ibáñez" printed exactly, line 8 09-23-1974, line 9 Spain; Corporation and Active NFFE ticked, capacity box ticked, signed on page 8. This is my reading, not the owner's.

## The owner's check (pending)

Folder: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-24/owner/. There are 38 files; open index.txt first. It lists failures first (none), the checks run on each form, each file and what it shows, and the answers each form must carry.
- **Signed PDFs:**
  - 1-W-9-us-individual-signed.pdf
  - 2-W-9-us-llc-partnership-signed.pdf
  - 3-W-8BEN-foreign-individual-signed.pdf
  - 4-W-8BEN-E-active-nffe-signed.pdf
- **Page images:**
  - 1-…-page-1.png and 1-…-page-7.png (certificate)
  - 2-…-page-1.png and 2-…-page-7.png
  - 3-…-page-1.png and 3-…-page-2.png
  - 4-…-page-1.png to 4-…-page-8.png, and 4-…-page-9.png (certificate)
- **Screens, for each form:** -tax-step.png, -tax-step-answered.png (LLC and W-8BEN-E), -signing.png, -done.png and -console.png.

Notes for the owner, also in the index:
- The bank account (ending 6789) and the $100,000 subscription are the check walker's usual answers. They appear on no tax form.
- The subscription is pending, so the console row shows 0 investments.
- Toast messages ("Account activated", "Signed in as admin") overlap the bottom of some console screenshots.

## Deviations from Plan

1. **Owner-accepted removal (instead of the plan's relabelled toggle).** The plan said to relabel the switch "Collect W-9 and W-8 tax forms in investor invitations" and have the invitation honor it. Instead the self-serve edition has no switch.
   - The self-serve console no longer shows "Collect a substitute W-9 certification".
   - The one code path that skipped a tax certification because of it (the typed activation's Review step, its check and `i.taxForm = 'W-9'`) now always applies in self-serve (`substituteW9()`).
   - The invitation flow already always had the tax step.
   - The managed edition is unchanged (C-03).
   - The toggle-off case tests this behavior, not the plan's. Commits 078305a and a55e5d3.
2. **[Rule 1 - Bug] Raw "Failed to fetch" on "Almost done" (deferred from 06-23), fixed.** A fetch with no answer is marked `err.network` in invitations.js `inviteCall` and onboarding.js `remoteCall`, and the screen shows one plain sentence with Try again.
   - invitations.js is outside the plan's file list.
   - The invitation load page and the step-save toast now read "The connection failed." in place of the browser's text.
   - Commits a12e2a4 (RED) and 7de0672.
3. **status-math `--case managed` replaced by managed checks in toggle-off** (Failures first, item 2).
4. **Check helpers outside the plan's list:**
   - lib.js walk `a.profile`.
   - forms-flow builders: usIndividualCase, foreignIndividualCase, the US_LLC and FOREIGN_ENTITY specs, w9AccountCase `spec.console`, the `spec.finish` hook, and toW8Step country/city/zip/dob.
   - Console rows are scrolled into view before their screenshot.
   - The original cases keep their answers as defaults and still pass inside the 31.
5. **Owner-set investors walk the whole invitation**, so the console row is a finished investor and not "Step 7 of 10".
6. **Gate counts** follow the merged tree (Failures first, item 3).
7. **Ledger and state.** `commits` was measured from SCRATCH/exec-06-24/base-commit.txt with actuals.sh. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched, as instructed.

## TDD Gate Compliance

| Change | RED | GREEN |
| ------ | --- | ----- |
| no tax-step switch, hint | 078305a | a55e5d3 |
| plain network sentence | a12e2a4 | 7de0672 |
| owner set (a check, no behavior change) | 4ce593d | n/a |

## Known Stubs

None.

## Threat model

- **T-06-52:** both console changes are gated on `E.diy`, and `substituteW9()` returns the firm setting in the managed edition. The managed checks in toggle-off prove this.
- **T-06-53:** the answers are invented and live in the session scratchpad. The SSN is 987-65-4326, from the range the SSA reserves for examples.
- **T-06-SC:** no package was installed.

## Threat Flags

None. There is no new endpoint, storage or trust boundary. The network marking only changes the error text.

## Self-Check: PASSED

- **Files present:** assets/js/console.js, assets/js/onboarding.js, assets/js/invitations.js, checks/forms-flow.js, checks/server-mode.js, checks/lib.js, deferred-items.md, and SCRATCH/exec-06-24/owner/index.txt with the four signed PDFs.
- **Commits on HEAD:** 078305a, a55e5d3, a12e2a4, 7de0672, 4ce593d (git rev-list 33e5389..HEAD = 5, before this summary's commit).
- **Clean tree:** server/node_modules was removed and never staged. Nothing was written into assets/ apart from the three source files.
