---
status: awaiting_human_verify
trigger: "when you invite an investor and the invite email pops up it cannot be read, it only shows the top part of the email and cannot be scrolled down, why is this now fucked?"
created: 2026-11-16T06:00:00Z
updated: 2026-11-16T07:35:00Z
---

## Current Focus

status_note: fix committed on branch fix/invite-email-dialog-scroll (worktree scratchpad/dlg-dbg/wt), pushed to wip/fix/invite-email-dialog-scroll; waiting for the owner to check the email dialog in a rebuilt preview
bug_class: Bohrbug (deterministic CSS layout)
next_action: owner opens the rebuilt preview, invites an investor, scrolls the email dialog to its end on desktop and phone; on "confirmed fixed" archive this session and add the knowledge-base entry

reasoning_checkpoint:
  hypothesis: "The email card is cut off because .email has overflow:hidden (b85eb15) and is a flex item of the flex-column .dlg-body.inv8-email inside the height-capped flex-column dialog; overflow:hidden makes its automatic min-height 0, so flex-shrink squashes it to the leftover height and hides the rest, leaving the body nothing to scroll."
  confirming_evidence:
    - "b8 and b7 probes: card clientHeight 310/110/116 of 561-756px scrollHeight, body scrollHeight == clientHeight, at 1280x800, 1280x600, 390x844, framed and not"
    - "2948083 (before b85eb15) passes every viewport; b85eb15 fails identically; b85eb15 with only `overflow: hidden` removed from .email passes"
    - "email-dialog.js fails before the fix (16 failures) and passes after (54/54); fails again with the fix reverted"
  falsification_test: "If adding flex-shrink:0 to the card (keeping overflow:hidden) left the card clipped or the body unscrollable at any viewport, the hypothesis would be wrong. It did not."
  fix_rationale: "flex-shrink:0 stops the flex column from shrinking the card below its content, so the overflow goes to the dialog body (overflow:auto), which scrolls. overflow:hidden stays, so the rounded corners still clip the brand header; the email markup and text are untouched."
  blind_spots: "Real iOS Safari / Android Chrome touch scrolling inside a <dialog> in the claude.ai iframe is not testable here (emulated with raw CDP touch drags in Chromium). Identity-verification dialogs (.iv-dlg) are also flex-column bodies; no overflow:hidden child found by grep, not opened in a browser."
  candidate_causes:
    - "code (CSS): .email overflow:hidden + flex-shrink in .inv8-email flex column (confirmed)"
    - "environment: claude.ai iframe height / page scroll lock (eliminated)"
    - "code (JS/markup): plan 06-26 heading change or other phase-06 invite code (eliminated)"
  and_gate: "yes: needs both the flex-column body (2907027, 2026-11-10) and overflow:hidden on the card (b85eb15, 2026-11-11); either alone works. Fix removes the shrink at the card, the narrowest point."

## Symptoms

expected: After inviting an investor, the invitation email dialog shows the whole email; the dialog body scrolls when the email is taller than the window, and the action buttons are reachable.
actual: Only the top part of the email shows; the rest cannot be scrolled to.
errors: none reported
reproduction: Published preview (build 13, diy-portal.html in a claude.ai sandboxed iframe), create a portal, invite an investor, the email dialog opens.
started: Owner says "now" (reported on build 13).

## Eliminated

- hypothesis: Plan 06-26 (Tax form request email heading) or other phase-06 invite changes broke the dialog
  evidence: Build 12 (b7, before 06-26's taxmaps/taxforms) fails identically; CSS and app.js byte-identical b7/b8; git archive of b85eb15 (2026-11-11, before phase 06 work) already fails
  timestamp: 2026-11-16T06:25:00Z

- hypothesis: The claude.ai iframe (height or a page scroll lock) stops the dialog from scrolling
  evidence: Same failure on a top-level page and in a sandboxed iframe of 100% and 520px; html/body computed overflow is clip-x/visible-y, not hidden; .dlg-body has overflow:auto but scrollHeight == clientHeight
  timestamp: 2026-11-16T06:25:00Z

## Evidence

- timestamp: 2026-11-16T06:00:00Z
  checked: assets/js/invitations.js showEmail() and assets/js/app.js dialog(); CSS portal.css .dlg/.dlg-body, diy.css .inv8-email, console.css .email
  found: dialog markup lives in invitations.js (not onboarding.js). .dlg {max-height: calc(100dvh - 40px)}; .dlg[open]{display:flex;flex-direction:column}; .dlg-body{overflow:auto}; .inv8-email{display:flex;flex-direction:column}; .email{overflow:hidden}.
  implication: The article is a shrinkable flex item (overflow:hidden makes min-height:auto resolve to 0), candidate for being squashed instead of overflowing.

- timestamp: 2026-11-16T06:10:00Z
  checked: Playwright repro on build b8 (scratchpad/dlg-dbg/probe.js; skeleton page + sandboxed iframe frame.html), sample Kestrel Bay portal, invite Dana Whitfield, 1280x800 / 1280x600 / 390x844, top-level, framed 100%, framed 520px
  found: All 9 runs: article.email clientHeight < scrollHeight (1280x800: 310 of 561; 1280x600: 110 of 561; phone 390x844: 116 of 756; framed 520px: 30 / 0) while .dlg-body scrollHeight == clientHeight (nothing to scroll); after 12 wheel steps scrollTop 0/0, email footer never readable. Buttons stay visible (they are not shrunk). Screenshot shows the email cut through its button, exactly the owner's report.
  implication: Bug reproduced deterministically; the email article is squashed by flex-shrink, not the dialog failing to scroll per se.

- timestamp: 2026-11-16T06:20:00Z
  checked: Same probe on build 12 (scratchpad/build/b7 with artifact/diy-portal-b7.html)
  found: Identical failure in all 9 runs (article 310 of 561 at 1280x800, nothing to scroll). b7 and b8 have byte-identical diy.css, console.css, portal.css, base.css and app.js; only invitations.js differs.
  implication: Not caused by plan 06-26 (heading text) or the other phase-06 invite changes; build 12 was already broken.

- timestamp: 2026-11-16T06:25:00Z
  checked: git log -S/-G and blame on .inv8-email and .email rules; probe on git archive of 2948083 (parent of the restyle) and b85eb15 (Refract restyle), each with its own diy.html
  found: 2907027 (2026-11-10, turnkey onboarding) made .inv8-email a flex column; .email then had no overflow rule. b85eb15 (2026-11-11, "WIP: Refract restyle of the investor portal, flows and console") added border-radius + overflow:hidden to .email in console.css. Probe: 2948083 passes all 9 runs (article not clipped, body scrolls 206-816px, footer readable); b85eb15 fails all 9 exactly like b8.
  implication: Broke on 2026-11-11 with the Refract restyle commit b85eb15; every preview built since (including builds 12 and 13) has it.

- timestamp: 2026-11-16T06:30:00Z
  checked: Differential on the b85eb15 archive with only `overflow: hidden` removed from .email
  found: article no longer clipped at any viewport, body scrolls (452px at 1280x600, 964px at phone in a 520px frame). (The probe's footer-visible flag was measured only at the bottom scroll position, so it misreported the tallest case; the check below scans every scroll position.)
  implication: Mechanism confirmed: overflow:hidden on the flex item makes its automatic minimum height 0, so flex-shrink squashes it inside the height-capped flex-column dialog body.

- timestamp: 2026-11-16T06:55:00Z
  checked: New check email-dialog.js (phase 6 checks folder) in the worktree, before and after the fix; CDP touch experiment
  found: Before the fix 16 checks fail (card clipped + paragraphs/footer never seen) in all 3 parts (desktop 1280x800/1280x600, phone 390x844, tax request), each framed full-height and 520px. After `flex-shrink: 0` on `.inv8-email .email`: 54/54 pass; card full height (561/561 desktop, 737-756 phone), body scrolls to its end (252-964px), all 11 targets seen. Harness note: Chromium headless ignores Input.synthesizeScrollGesture even on a plain scrollable div (0px), while raw Input.dispatchTouchEvent drags scroll a <dialog> in a sandboxed iframe (~180px); the check uses raw touch drags on the phone.
  implication: Fix confirmed; the bug returns when the declaration is removed (revert-and-reconfirm).

## Resolution

root_cause: In the self-serve invitation email dialog, .dlg-body.inv8-email is a flex column (diy.css, since 2907027) inside the height-capped flex-column dialog (portal.css .dlg max-height 100dvh-40px). The Refract restyle (b85eb15, 2026-11-11) gave the email card .email `overflow: hidden` (console.css) to clip its rounded corners; a flex item with overflow other than visible has an automatic minimum height of 0, so flex-shrink squashes the card to whatever height is left after the other rows, and the card hides the rest of the email. The body then has nothing left to scroll.
fix: assets/css/diy.css `.inv8-email .email { width: 100%; flex-shrink: 0; }` (one declaration + a comment). The card keeps its full height and rounded-corner clipping; the dialog body (overflow:auto) scrolls. No markup or email text changed.
verification:
  target_test: { result: pass, check: ".planning/phases/06-.../checks/email-dialog.js (54/54 after, 16 failures before)" }
  mutation_check: { result: skipped, reason_if_skipped: "CSS, no Stryker; the only meaningful mutant at the fix site (flex-shrink back to 1 / removed) is the revert below, which the check kills" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: n/a (additive declaration) }
  adjacent_tests: { result: pass, suites_run: ["server npm test: 191/191", "forms-flow.js --case tax-request: PASS 37 checks", "server-mode.js --only full,clean,tax-request: PASS 80 checks", "two-persons.js (all parts): PASS 17 checks", "status-flow.js (all 26 parts): PASS 414 checks"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  preview_build_check: "published b8 page + b8 files with only the fixed diy.css: card 561/561 (desktop) and 737-756 (phone), body scrolls 252-964px, top-level and framed"
  guardrail_verdict: accepted
  oracle_type: specified (owner's requirement: whole email readable and scrollable, actions reachable)
files_changed: [assets/css/diy.css, .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/email-dialog.js]
