---
status: awaiting_human_verify
trigger: "PACKAGE INVITE (08-06's check) fails on the merged tree after 08-05: PACKAGE INVITE: FAIL (parts run: 9) - single, declined, phone"
created: 2026-11-19T22:10:00Z
updated: 2026-11-20T00:30:00Z
---

## Current Focus

hypothesis: CONFIRMED (check side) - ticked packages are sent with the shared API_TOKEN, which the server now refuses 403 account_required. Console side - box() hides the box on 403 account_required instead of showing it switched off with the server's sentence
test: package-invite.js: single, declined, phone on a sponsor account token with a balance; new part `account` (shared token, the real server's own 403) asserting the box shown off with "Card payments need a sponsor account.", untickable, invitation sent without the package; notoffered keeps "no box" for a server without billing (404 stand-in) and available.full false
expecting: RED run on the merged tree with the unchanged console: FAIL (parts run: 12) - account, list-declined; after the fix in package.js box(): PASS (parts run: 12)
result: RED "FAIL (parts run: 12) - account, list, list-declined" (list was a check helper, fixed in 288e3dc); GREEN "PASS (parts run: 12)"
next_action: owner check in a server-connected console with the shared token (Investors, Invite an investor): the box greyed with "Card payments need a sponsor account.", cannot be ticked, the invitation still sends

bug_class: Bohrbug (deterministic: every run, the same three parts; the server's refusal is a fixed rule)

reasoning_checkpoint:
  hypothesis: "(check) single, declined and phone fail because the check sends ticked packages with the shared API_TOKEN, which plan 08-05's server refuses with 403 account_required by design. (console) with the shared token GET /v1/billing answers 403 account_required and box() returns show:false, so the box is hidden instead of shown switched off with the server's sentence"
  confirming_evidence:
    - "pkg.txt: every FAIL carries emailError 'Card payments need a sponsor account.' and serverId ''; every assertion about what the console sent passes"
    - "repro.mjs: shared token + package -> 403 account_required; account token with a balance -> 200, rec.package stored, entitlement consumed by credit 9900, payments 0, outside calls []"
    - "package.js box(): `if (i.status !== 'ok') return off;` after the unreachable branch: status 'none' (any refusal, code account_required included) gives show false"
  falsification_test: "with the account token the three parts still fail (would mean another cause); the new part `account` passes on the unchanged console (would mean no console change is needed)"
  fix_rationale: "the check now uses the path the contract defines (a sponsor account buys the package); the console shows the account_required state the way it shows no-card and unreachable (switched off, one line), using the server's own sentence, so a sponsor on the operator's token knows why"
  blind_spots: "the account's balance is written straight into the server's store (no admin route adds credit; a card needs the payment provider); the card path itself is covered by server/test/package.test.mjs, not here"
  candidate_causes:
    - "code (check): shared token used for ticked packages - confirmed"
    - "config (server env): billing settings missing so even an account is refused (402 no_card / 409 package_unavailable) - real for an account with no balance (repro: 402 no_card); handled by a balance and the built-in sandbox provider"
    - "code (console): box() hides the account_required state - confirmed by reading; RED run pending"
  and_gate: "no for the FAIL itself (one cause: the shared token); the console change is a separate requirement found while proving the shared-token path"

## Symptoms

expected: PACKAGE INVITE: PASS (parts run: 9)
actual: PACKAGE INVITE: FAIL (parts run: 9) - single, declined, phone
errors: emailError "Card payments need a sponsor account.", serverId "" (single, phone); declined: the resend never reaches the server ("rows":0)
reproduction: NODE_PATH=$(npm root -g) node .planning/phases/08-verification-package-and-ongoing-compliance/checks/package-invite.js (output SCRATCH/merge-0805/pkg.txt)
started: merge of plan 08-05 (7d12a96); passed on 08-06's own tree (8e07eb0)

## Eliminated

## Evidence

- timestamp: 2026-11-19T22:05:00Z
  checked: SCRATCH/merge-0805/pkg.txt FAIL lines
  found: single "ticked: the box was ticked and the invitation went to the integration server" and "the real server holds the invitation" fail with emailError "Card payments need a sponsor account."; declined "the server now holds it" fails (rows 0); phone "the sent request carries the flag" fails (serverId "")
  implication: every failure is the real server refusing a ticked POST /v1/invitations; every assertion about what the console sent passes

- timestamp: 2026-11-19T22:08:00Z
  checked: server/lib/invitations.mjs create (package path) and lib/billing.mjs
  found: wantsPackage && !auth.account -> refusePackage('account_required') 403; with an account: tier worked out by the server, billing.entitle (credit first, card only for the rest; a payment record is written before any provider call), consume after store.put, rec.package = { entitlement, tier, account, key }
  implication: the check must use a sponsor account token for ticked packages; a balance on the account lets the real server pay with no provider call

- timestamp: 2026-11-19T22:09:00Z
  checked: assets/js/package.js box() with GET /v1/billing 403 account_required
  found: load() keeps status 'none', error = the server's sentence, code 'account_required'; box() returns show false for every status other than ok/unreachable/no server
  implication: today the console hides the box when the shared token is used; the required behaviour (shown switched off with the server's sentence, cannot be ticked) is NOT there: a console change is needed (RED-first)

- timestamp: 2026-11-19T22:20:00Z
  checked: SCRATCH/exec-pkgacct/repro.mjs (real server in process, outside calls refused and recorded)
  found: shared token + package -> 403 {"error":"Card payments need a sponsor account.","code":"account_required"}; shared token GET /v1/billing -> the same 403; account made through POST /v1/admin/accounts with ADMIN_TOKEN (workspace kestrel-bay); account with no card and no balance + package -> 402 no_card; account with a balance + package -> 200, stored package {tier full, account, key = clientId}, entitlement consumed by that invitation, paid by credit 9900; the shared-token list reports package {tier full, status paid}; payments 0; outside calls []
  implication: hypothesis confirmed. The check needs a sponsor account token and a balance on it (billing settings filled with stand-in values; the server's built-in sandbox provider named for both checks); then the real server takes the package with no provider call

- timestamp: 2026-11-19T23:00:00Z
  checked: orchestrator message (08-13 merged into claude/refract-reskin, e3ccadc); merged it into this branch (29ecbbf, a merge, not a rebase)
  found: one conflict (the check's header). 08-13 was built on 2163866 (before 08-05): its parts list and list-declined also send ticked packages with the shared token to the real server, which now refuses them. 08-13's list box is derived from packageBox (NS.pkg.box) per row, so it follows the single form's rule; its assertion "403 account_required: no box on the list form" encodes the old single-form rule
  implication: list and list-declined need the account token too; once box() shows the account_required state, the list box shows it the same way (consistent with 08-13's own design), so that one assertion changes with the rule (stricter: shown, switched off, the sentence, no link, cannot be ticked)

- timestamp: 2026-11-19T23:02:00Z
  checked: npm --prefix server test on the merged tree (29ecbbf)
  found: "# tests 329 / # pass 329 / # fail 0"
  implication: no server change in this branch; count as the orchestrator stated

- timestamp: 2026-11-19T23:40:00Z
  checked: RED run on the merged tree, console unchanged (SCRATCH/exec-pkgacct/red.txt)
  found: "PACKAGE INVITE: FAIL (parts run: 12) - account, list, list-declined", 274 PASS / 9 FAIL. account: 6 FAIL (desktop and phone: box not shown, no line, same for Rule 506(c)), as predicted. list-declined: the 403 step (box not shown), as predicted. Not predicted: list "the console's records agree: three invitations carry the package" and list-declined "sent again: ... they are the invitations' ids" read pkg false. single, declined, phone and both list parts PASS their new "the server took the package" checks (stored package, consumed, paid by credit at the server's price, payments 0, no outside call)
  implication: the check side of item 1 is fixed. The unpredicted two: 08-13's byEmails counted only the sponsor's tick (package === true); now that the real server takes the package, its list reports { tier, status } and the console replaces the tick with it (08-06's rule). A check assumption from a pre-08-05 server, not a console fault

## Resolution

root_cause: "(1) The check sent ticked packages with the shared API_TOKEN; since 08-05 the real server refuses those with 403 account_required (correct: card payments belong to a sponsor account). 08-13's list parts, built before 08-05, had the same assumption, and their byEmails helper counted only the sponsor's tick, not the server's word that replaces it. (2) Console: package.js box() hid the box on 403 account_required instead of showing it switched off with the server's sentence"
fix: "Check: a sponsor account made through POST /v1/admin/accounts with ADMIN_TOKEN for the console's workspace, with a balance written to its billing record, for every part that sends a ticked package (single, declined, phone, list, list-declined); billing settings filled with stand-in values and the built-in sandbox provider named for both checks; GET /v1/billing, the refused charge and the list payment stay stubbed; every call leaving the machine is refused and must be none; the stored invitation's package is read. New part account (shared token, the real server's own 403) at 1280x800 and 390x844 with touch. notoffered: server without billing (404) and available.full false keep no box. Console: one line in box(): status none with code account_required -> shown, switched off, line = the server's sentence"
verification: "Green run at 007eb1b through heavy.sh (SCRATCH/exec-pkgacct/green.txt): PACKAGE INVITE: PASS (parts run: 12), 283 PASS / 0 FAIL. account passes at 1280x800 and at 390x844 with touch; preview-desktop and preview-phone (sandboxed frame refusing every connection, no server) pass unchanged. PACKAGE PANEL (08-13) once on the same tree: PACKAGE PANEL: PASS (parts run: 7), 127 PASS / 0 FAIL. npm --prefix server test on the merged tree: # tests 329 / # pass 329 / # fail 0. Screenshots deleted after the runs. Not run: the full phase gate. Not done: the owner's check"
files_changed: [.planning/phases/08-verification-package-and-ongoing-compliance/checks/package-invite.js, assets/js/package.js]
oracle_type: specified (the orchestrator's stated behaviour and plan 08-05's reply contract)
