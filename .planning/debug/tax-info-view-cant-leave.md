---
status: awaiting_human_verify
trigger: "when viewing the tax info that was filled in the onboarding workflow you cant leave the page, its broken" (owner, published preview https://claude.ai/artifact/GPhQRgiF3Kkne2A5VHqDxP, build 13, files from scratchpad/build/b8)
created: 2026-11-16T08:00:00Z
updated: 2026-11-16T10:45:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED - the tax-form request (plan 06-26, "Request tax form") opens a flow whose first step is the tax step ('tax','done'); the invitation page draws Back only for steps after the first (onboarding.js invite render, `back` needs n > 0) and is a standalone page (no portal nav, no demo bar, no "Back to console" preview bar, logo not a link). So on the request's tax step - the W-9 pre-filled from what onboarding recorded - nothing on the page leads anywhere except finishing the form; the form view's Back only returns to those answers.
test: RED-first framed check (sandboxed iframe) in phase 06 checks: on the request's first step a Back returns to the portal; content of the step unchanged
expecting: RED on 282865d (no Back on Step 1 of 2), GREEN after the fix
next_action: orchestrator merges wip/fix/tax-request-leave, publishes a preview build; owner opens a tax-form request (Request tax form on an investor whose W-9 is not signed, then Complete your tax form as the investor) and checks Back leaves it; asks the owner which screen he was on (push notification); on 'confirmed fixed' archive this session and add the knowledge-base entry
bug_class: Bohrbug (deterministic: every tax-form request, every viewport, framed or not)
reasoning_checkpoint:
  hypothesis: "On a tax-form request the tax step is step 1 of 2, and the invitation page draws its Back button only when n > 0; with no nav, no demo bar and no preview bar on that standalone page, the investor (or the sponsor previewing as the investor) viewing the pre-filled W-9 has no in-page way to leave without finishing the form."
  confirming_evidence:
    - "Repro (b8 files, sandboxed iframe and top-level, desktop and phone): W-9 finished without a signature (the view says Nothing is required) -> console row 'W-9 not signed - Request tax form' -> request -> portal 'Complete your tax form' -> 'Step 1 of 2: Tax certification'. Buttons on screen: Change your answers, Upload it instead, Use the form for foreign investors, Continue to the form. No Back, no links, no demo bar (demoBar false, nav [])."
    - "Form view of the request: Back (ivf-taxanswers) at the bottom of 6 pages returns to the same answers view; Escape does nothing."
    - "From the sponsor's own 'View portal' preview the same request page drops the 'Back to console' bar (previewBar false)."
    - "Code: onboarding.js invite render `const back = upView ? ... : n > 0 && key !== 'done' && ... ? ivf-back : ''`; flowSteps returns ['tax','done'] (or ['welcome','tax','done']) for c.it.taxRequest; app.js demoHTML shows no demo controls on standalone pages."
  falsification_test: "If a Back to the portal on the request's first step is present and works in the framed page but the owner still cannot leave the tax info view, the trap is elsewhere (e.g. host-only behaviour of the investor's W-9 dialog)."
  fix_rationale: "The request is opened from the portal ('Complete your tax form') and its done screen returns to the portal ('Go to your portal'); giving its first step the same Back the other steps have, pointed at the portal, removes the dead end at its source without changing the form, the answers or any other flow."
  blind_spots: "The owner's exact screen is not known (real host needs his sign-in). Other views were checked and have exits, but WebKit/Safari could not be run. In the sandboxed preview the investor's W-9 dialog shows 'This page has been blocked' (PDF viewer refused in sandboxed frames) - X and Escape still close it; separate defect, reported, not fixed here."
  candidate_causes:
    - "code: Back drawn only for n > 0; a tax request's tax step is n = 0; standalone invitation page has no nav/demo/preview bar"
    - "data: a request exists only when the W-9 is not on file (finished unsigned, copy not received, none) - the sign view invites finishing unsigned"
    - "environment: the artifact preview has no address bar; browser back (which does step back the frame's hash history) is not an obvious control there"
  and_gate: "yes - needs a tax-form request (data: W-9 not on file + the sponsor asks) AND the first-step-without-Back on a standalone page (code)."

## Session Loop

goal: find_and_fix (minimal, isolated worktree, RED-first framed browser check, push wip/<branch> only)
symptoms_prefilled: true

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: After viewing the tax information (W-9 / W-8BEN / W-8BEN-E) filled in during investor onboarding, the user can leave the view (back, close, nav links, browser back, Escape).
actual: Owner: "when viewing the tax info that was filled in the onboarding workflow you cant leave the page, its broken".
errors: none given
reproduction: Published preview build 13 (scratchpad/build/b8). Create sample portal, invite investor, complete onboarding incl. signing the W-9, then view the tax info (console row, Documents Tax entry, investor Account, onboarding tax step).
started: reported 2026-11-16 on build 13 (phase 06 plans 06-10..06-26).

## Eliminated
<!-- APPEND only -->

## Evidence
<!-- APPEND only -->

- timestamp: 2026-11-16T08:00:00Z
  checked: knowledge base
  found: .planning/debug/knowledge-base.md does not exist; no MemPalace. No prior resolved session on tax views.
  implication: no known-pattern candidate.

- timestamp: 2026-11-16T08:20:00Z
  checked: published files vs HEAD (cmp of the 51 files in scratchpad/build/b8-files.txt)
  found: only assets/js/esign.js and assets/js/intake.js differ (the agreement-name fix 2404da1, merged after build 13). taxforms/onboarding/console/portal/record/signature/signflow/documents/app are byte-identical.
  implication: HEAD reproduces build 13 for every tax view.

- timestamp: 2026-11-16T08:35:00Z
  checked: repro harness scratchpad/taxview/work/repro.js (b8 files only, wrapper in a UTF-8 skeleton, host page with sandboxed iframe allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads; Kestrel Bay sample, invited individual, onboarding walked, W-9 signed through the e-sign view, agreement signed). Headless shell and full Chromium (channel chromium, has the PDF viewer); desktop 1440x900 and phone 390x844 touch.
  found: |
    - Investor portal Home and Documents "Form W-9 - <name>" (esign.js es-open-doc) opens #dlg (dlg-doc) with the PDF in a blob: iframe. In the sandboxed frame full Chromium shows "This page has been blocked by Chromium" inside the dialog (PDF viewer refused in sandboxed frames; the headless shell downloads the file instead). Escape closes, the X closes (desktop and phone; X is the topmost element at its point). Nav links are inert while the modal is open (expected). Browser back changes the route underneath (to the invite done page) while the dialog stays open.
    - Console Investors row "W-9 signed ... Download" (kyc-iv-file): download only, no navigation. Row "Account" (co-record dialog): Escape closes. "View portal": portal opens with the "Investor preview ... Back to console" bar; Account shows "Tax form W-9 on file", "Back to console" works.
    - Console e-sign envelope page of the W-9 (+ Show pages): E-sign back link, sidebar links, browser back all leave. Signed PDF / Certificate: downloads only.
    - Onboarding tax step revisited with Back after signing: answers view, "Continue to the form" moves on (form kept).
    - Onboarding W-9 signing view (before Finish): Escape does nothing (no dialog); the only way back is a "Back" button (ivf-taxanswers) BELOW all 6 pages (y=6749 of a 7152 px page at desktop); a sticky bar offers Start and Finish only.
  implication: no view so far leaves the user with NO way out in Chromium. Remaining: tax step revisited after "Change your answers" or after a reload (BUILT is memory only: a new W-9 envelope is built), top-level mode with the PDF viewer, Request tax form flow.

- timestamp: 2026-11-16T09:10:00Z
  checked: Request tax form path under the same emulation (UNSIGNED=1: W-9 finished without a signature; console Investors row; demo bar to the investor; portal "Complete your tax form"), frame desktop, frame phone, top-level desktop; and via the sponsor's "View portal" preview. Scripts scratchpad/taxview/work/explore10.js, explore11.js; screenshots scratchpad/taxview/out/frame-desktop/92-taxreq-answers.png, 93-taxreq-form.png.
  found: |
    - Row reads "W-9 not signed ... Request tax form"; the request opens the email dialog; as the investor the portal shows "Kestrel Bay asked you for your tax form. Complete your tax form".
    - The link opens "Step 1 of 2: Tax certification" (W-9 pre-filled from the record, asks the SSN only). On screen: Change your answers, Upload it instead, Use the form for foreign investors, Continue to the form. No Back, no nav link, no demo bar, header logo is a span. Same in all three conditions.
    - Continue to the form: the pre-filled W-9; Escape does nothing; Back (bottom) returns to the answers view above - the loop has no exit but Finish/Upload. Browser back (hash history) is the only other exit.
    - From the sponsor's own preview ("View portal") the request page has no "Back to console" bar either.
  implication: CONFIRMED trap - the tax-form request's tax step cannot be left from the page. Root cause in onboarding.js invite render (Back only for n > 0) for a flow whose first step is the tax step.

- timestamp: 2026-11-16T09:40:00Z
  checked: RED-first framed check (worktree scratchpad/taxview/wt, branch fix/tax-request-leave from origin/claude/refract-reskin 72a8ac9): .planning/phases/06-.../checks/tax-request-leave.js, portal in a sandboxed iframe; parts request, phone, preview, welcome, onboarding.
  found: |
    - RED on 72a8ac9 (commit 00a35a0): 28 PASS, 8 FAIL - request/phone: no Back on "Step 1 of 2: Tax certification", form Back returns to the same answers; preview: same from the sponsor's own preview; welcome: a request starting on Welcome has no Back. onboarding control PASS (new investor: no Back on Welcome, Back on step 2).
    - Fix (commit 663de47, onboarding.js +9/-1): the first step of a tax-form request draws the same Back button as other steps (data-action ivf-leave -> NS.app.go('overview')).
    - GREEN: 43 PASS, 0 FAIL (scratchpad/taxview/out/green.log). The step's text, its one question (ob-tin), its links and Continue to the form unchanged (asserted).
    - Preview assertion revised after the first GREEN run: opening any invitation signs in as its investor (onboarding.js ensureFlow sets role investor, pre-existing), so Back lands on the investor's portal with the demo bar's "Signed in as" (which returns to the console), not on the "Back to console" bar. Revised part re-run without the fix: still FAIL (no Back).
    - Manual mutants (Stryker not configured): Back action does nothing -> request part FAIL (killed); Back on every first step -> onboarding part FAIL (killed).
    - server/ node --test: 191 pass, 0 fail.
  implication: the fix removes the dead end; regression runs (forms-flow relevant cases, status-flow, server-mode tax parts, two-persons) next.

- timestamp: 2026-11-16T10:45:00Z
  checked: regression runs on the worktree (fix/tax-request-leave, 663de47) and the owner's path on the fixed files behind the artifact wrapper
  found: |
    - forms-flow --case tax-request,us-individual,unsigned,upload,edit,editsigned,route,typed-route: 183 PASS, 0 FAIL ("FORMS FLOW: PASS (cases run: 8)").
    - status-flow (all 26 parts): 414 PASS, 0 FAIL (same count as plan 06-26).
    - server-mode --only tax-request,tax-unsigned,tax-upload,tax-w9: 115 PASS, 0 FAIL.
    - server/ node --test: 191 pass, 0 fail. two-persons (persons, optional, autofill): 17 PASS, "TWO PERSONS: PASS".
    - Phase 4 signing-step and phase 5 record-check not run: esign.js and record.js unchanged (the changed branch needs c.it.taxRequest; every other flow renders as before, asserted by the onboarding part and status-flow).
    - Server mode probe (scratchpad/taxview/work/remote-probe.js): on the investor's own device the request shows Back; it leads to the device's portal page (the page the done screen's "Go to your portal" opens), no script error; the emailed link opens the request again at Step 1. That portal page does not offer "Complete your tax form" on the device (the request is reopened from the email link, as the step's footer says).
    - Owner's path behind the artifact wrapper (fixed files, sandboxed iframe, desktop and phone): Step 1 of 2 shows Change your answers, Upload it instead, Use the form for foreign investors, Back, Continue to the form; Back -> #overview portal with the demo bar; from the form, Back then Back -> portal. Screenshot scratchpad/taxview/out/fixed-phone/A0-fixed-taxreq-step.png.
  implication: fix accepted by the guardrail; awaiting the owner's check in a new preview build.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "A tax-form request (plan 06-26, Request tax form) starts on its tax step (steps tax, done; or welcome, tax, done) and the invitation page drew Back only for steps after the first (onboarding.js invite render, n > 0). The invitation page is standalone - no portal menu, no demo bar, no Back to console bar, logo not a link - so the request's W-9, pre-filled from what onboarding recorded, could not be left without finishing it (the form's Back returns to the answers; the answers had no way out). AND-gate: needs a request (W-9 not on file, e.g. finished unsigned as the form view allows) AND the first-step-without-Back."
fix: "onboarding.js: on the first step of a tax-form request (not done) the actions row draws the same Back button as other steps (data-action ivf-leave), which returns to the portal (#overview) the request is opened from and where its done screen goes."
verification:
  target_test:        { result: pass, detail: "tax-request-leave.js 43 PASS 0 FAIL in a sandboxed iframe; RED 28 PASS 8 FAIL on 72a8ac9" }
  mutation_check:     { result: pass, reason_if_skipped: "Stryker not configured; two manual mutants instead", mutant_killed: "Back does nothing -> request FAIL; Back on every first step -> onboarding FAIL" }
  no_op_deletion:     { result: pass, deletion_justified_by_rca: n/a (additive: one branch, one action) }
  adjacent_tests:     { result: pass, detail: "forms-flow 8 cases 183 PASS; status-flow 414 PASS; server-mode 4 tax parts 115 PASS; server 191 pass; two-persons PASS" }
  revert_reconfirm:   { result: pass, detail: "fix stashed -> preview part FAIL (no Back); reapplied -> PASS" }
  guardrail_verdict:  accepted
  oracle_type:        specified (the owner's report: the view must be leavable; plan 06-26's step content asserted unchanged)
files_changed: [assets/js/onboarding.js, .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/tax-request-leave.js]
