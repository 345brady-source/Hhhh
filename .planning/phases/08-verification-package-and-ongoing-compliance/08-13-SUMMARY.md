---
phase: 08-verification-package-and-ongoing-compliance
plan: 13
subsystem: console Integrations page and invite list form (self-serve edition), phase 8 checks
tags: [verification-package, billing, card-on-file, list-payment, D-01, owner-preview]
status: complete
requires:
  - "08-06: NS.pkg (load, info, tierFor, priceLabel, box), checks/frame.js, checks/gate.sh"
  - "08-04: GET /v1/billing, POST /v1/billing/card/setup, DELETE /v1/billing/card, POST /v1/billing/entitlements, the cv-card-saved message"
provides:
  - "assets/js/package.js: NS.pkg.panel(ws) (the Verification package panel), actions pkg-card, pkg-card-remove, pkg-card-remove-confirm, NS.pkg.hold(on); box() also returns tier and cents when enabled"
  - "invite list form: control iv-bulkPackage (name bulkPackage), error line iv-bulk-error; one POST /v1/billing/entitlements per group of 200 package rows, before any of that group's invitations"
  - "create(ws, o) takes o.id as the invitation's id (P4)"
  - "checks/package-panel.js: GATE CHECK PACKAGE PANEL, 7 parts; checks/package-invite.js: parts list and list-declined (11 parts)"
affects: [08-05, 08-07, 08-12, 08-14, 08-16]
tech-stack:
  added: []
  patterns:
    - "the card is typed only into the integration server's own page, framed in the console's dialog; only that origin's message from that frame is believed"
    - "one function (packageBox) decides which list rows are paid, the label's total and the package on each invitation; the server's answer is held still while a list is paid and sent"
key-files:
  created:
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/package-panel.js
  modified:
    - assets/js/package.js
    - assets/js/integrations.js
    - assets/js/invitations.js
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/package-invite.js
    - server/help/guide.md
    - server/lib/help-guide.mjs
decisions:
  - "403 account_required (the shared token) shows the panel with the server's sentence in one line, 'Card payments need a sponsor account.' (08-CONTEXT, after 08-04); ready false or a server without billing shows no panel (plan)"
  - "The panel shows the prices of the two packages a sponsor chooses on the invite form (identity, full) when the server offers them; the reverify price is not shown"
  - "An investor on file follows the single form's rule on the list too (08-06, D-06): their row is paid and carries the package when the server offers their tier; P1's check uses an investor on file whose tier (full) the server does not offer"
  - "Each paid row's invitation id is made once and kept on the row, so a list sent again after a refused or unconfirmed payment pays for the same keys (the server never charges a key twice)"
  - "A list stopped by a refused group keeps the unsent rows on the form; the server's sentence is shown once in the form, no toast for it"
metrics:
  duration: "about 2 h 35 min wall time (18:45 to 21:20 UTC, 2026-11-19), most of it in the shared browser queue; the gate run took about 1 h 27 min"
  completed: 2026-11-19
actuals:
  tokens: 21600
  tasks: 3
  commits: 3
plan_head_before: 2163866402571e8f8b89e3347a98fce96416d3b4
plan_head_after: 24f849b09891d62ea1bb65b61a437a69ef64c8a3
---

# Phase 8 Plan 13: Verification package panel and the list payment Summary

The Integrations page has one panel, "Verification package", drawn from the integration server's GET /v1/billing: the prices, the card on file (brand, last four digits, expiry) with "Add card" or "Replace card" and "Remove", the credit when there is one, each charge with its date, the investor's account name and amount, and one line when a payment is being confirmed. The card is typed only into the server's own card page, framed inside the console's dialog. On "Import a list", one box pays for the whole list in one request (groups of 200) before any invitation is sent; a refused payment sends nothing.

Not done until the owner has checked it on his iPhone (human check below). The billing replies in the checks are stand-ins laid over the real integration server, built against 08-04's merged reply shapes and codes. No card has been saved or charged anywhere: the payment provider is still not connected (08-12).

## Failures first

- **A RED run was killed by my own cleanup.** While stopping a leftover queue entry from the stopped tracer run, I matched the scratch folder and killed the Task 3 RED run's queue entry instead (red3.txt then held only `EXIT=143`). It was run again from scratch; the result below is from that second run.
- **The separate Task 1 tracer run never ran.** It sat in the shared browser queue for 30 minutes and hit the background time limit. The panel part's pass on the Task 1 code comes from red2.txt instead. That run was made on a frozen copy of the Task 1 state with all 7 parts, and "panel" was not among the failed parts. The panel part also passed in the full GREEN run and in the gate.
- **RED3 stops at the first missing box.** On the base invitations.js the list parts fail because the box is absent (page.check timeout), so the money assertions were never reached there. They are proven by a separate mutation run (below): with the two money rules broken, 9 checks fail.
- In red2.txt, the Task 2 parts nocard, preview-desktop and preview-phone already passed on the Task 1 code, because Task 1's panel already drew those states. Their behaviour comes from Task 1, and red.txt is their RED (no panel at all).
- RED runs, the GREEN runs and the mutation run were made on frozen copies of the worktree (`SCRATCH/exec-08-13/frozen.sh`, `red3.sh`, `mut.sh`) rather than in the worktree itself. The queue waits ran to 30 minutes and more, so this let work go on while they waited. The gate ran in the worktree on the committed tree.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 (tracer) | the Integrations page shows one Verification package panel from the server's billing answer | cf6cd01 |
| 2 | add, replace and remove the card on the server's own page inside the console's dialog | 6070c41 |
| 3 | one payment for a list of invitations with the package, in groups of 200; guide sentence (P7) | 24f849b |

## RED runs (SCRATCH/exec-08-13)

- red.txt (Task 1, base code with the check): `PACKAGE PANEL: FAIL (parts run: 1) - panel`, 10 FAIL lines (no panel titled "Verification package", no prices, no card, no charges).
- red2.txt (Task 2, on the Task 1 code): `PACKAGE PANEL: FAIL (parts run: 7) - card, failures, dialog-phone`. There was no setup call and no dialog frame, the four failure sentences were missing, and no dialog opened on a tap.
- red3.txt (Task 3, the worktree with invitations.js at the base): `PACKAGE INVITE: FAIL (parts run: 2) - list, list-declined`. There was no list box, so nothing could be ticked.
- mut.txt (the committed tree with two money rules broken: every ticked row paid whatever packageBox says, and groups of 2000): `PACKAGE INVITE: FAIL (parts run: 2) - list, list-declined`, with 9 FAIL lines:
  - P1: the investor on file's key was in the payment, and 15600 cents were charged against a $57 label.
  - P5: one payment of 205 items was made, and 206 invitations were sent where only 200 should have been.

## Verification

Full GREEN before the gate: panel.txt `PACKAGE PANEL: PASS (parts run: 7)` (127 PASS); list.txt `PACKAGE INVITE: PASS (parts run: 2)` (66 PASS).

Task 3 verify, the full gate run as `P8_SERVER_TESTS=272 P8_OUT=SCRATCH/exec-08-13 bash checks/gate.sh`. The base count, 272, was measured by a run at 2163866 before any edit (`# tests 272 / # pass 272 / # fail 0`); the plan adds no server test. The gate's last lines, verbatim:

```
GATE ok   server tests # fail 0
GATE ok   server tests 272 (found 272)
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
GATE ok   phase-8 gate checks found (2)
GATE ok   PACKAGE INVITE (11)
GATE ok   PACKAGE PANEL (7)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 272
# pass 272
# fail 0
COUNTS server tests 272; PACKAGE INVITE 11; PACKAGE PANEL 7
GATE_EXIT=0
VERIFY3_EXIT=0
```

In the gate: PACKAGE INVITE had 235 PASS and 0 FAIL lines over its 11 parts (08-06's nine still pass with this plan's changes); PACKAGE PANEL had 127 PASS and 0 FAIL. `server/help` guide test after the guide edit: `# tests 8 / # pass 8 / # fail 0`. Base-tree copy, screenshots and PDFs were deleted after the gate.

## Plan-check additions applied (08-CONTEXT)

- **P1 (blocker): one function decides.** `bulkPackage` runs `packageBox` on each row, and its enabled rows make up both the label's count and total. The send action computes the payment's items from the same `packageBox` call per row, then creates those rows with `id` and `package: true`. While a list is paid for and sent, `NS.pkg.hold(true)` holds the billing answer still, so `create`'s own check gives the same answer. A paid row is also marked as carrying the package after create (a guard that only matters if the two ever disagreed). The check part `list` includes an investor on file whose tier (full) the server does not offer. It proves their key is in neither the entitlements body nor the total ($57, charged 5700). It also proves the invitations sent with package true are exactly the paid keys. When the server offers the full tier, the same investor is counted at $99 (label $156).
- **P2:** the base was measured by a run (272). The gate ran with `P8_SERVER_TESTS=272`. COUNTS line: see above.
- **P3:** closing the card dialog by any way (its X, Escape, browser back, or the card page's saved message) reads GET /v1/billing again. This is proven in parts card and dialog-phone.
- **P4:** in `create`, only `const id = o.id || uid('invt');` changed. The list makes each paid row's id with `uid('invt')` before paying.
- **P5:** package rows are paid in groups of 200, in order, and each group's invitations are sent before the next group is paid. A refused group stops the list there with the server's sentence, and its rows stay on the form. Part list-declined proves this with 205 rows and stubbed replies: payment of 200, then 200 invitations, then payment of 5 refused, then nothing more.
- **P6:** nothing was handed over; Task 3 is built.
- **P7:** one sentence in the guide's `console-integrations` entry; `node server/help/build.mjs` regenerated `server/lib/help-guide.mjs`.
- **P8:** `unresolved` shows as one line ("A payment of $99 on Nov 19, 2026 is being confirmed."). An empty list shows nothing, and so does a server that does not send the field. Part panel covers all three.
- **After 08-04:** with the shared token, the real server's own answer (403 account_required) gives the panel's one line "Card payments need a sponsor account." (part failures, against the real server, no stand-in).

## Deviations from Plan

1. **[Rule 2] Same keys on a resend.** Each paid row keeps its invitation id on the row until it is sent. Otherwise, after an unconfirmed payment (409 billing_unavailable), a resend would carry new keys and the server would settle the pending charge and also charge the new keys. Tested in list-declined: sent again, the same three keys.
2. **[Rule 2] The billing answer is held still during a list send** (`NS.pkg.hold`). Without it, a re-read during a long list could flip a row's box between the payment and `create`. That would happen, for example, when credit paid for the rows and the re-read shows no credit left. A paid row would then lose its package.
3. **[Rule 1] Prices over $999 get a thousands separator** ("$3,895"); before this, priceLabel printed "$3895". 08-06's labels ($19, $25, $99, $125.50) are unchanged.
4. **The hosted card page stand-in is a Playwright route** on the integration server's origin, not `stubServer`, because stubServer can only answer JSON.
5. **No "Loading" text.** The panel stays empty until the server answers, then it is drawn in place. A page render is avoided because a field on the Integrations page may be in use.
6. **The list label** reads "Add verification package to N invitations ($total)". It counts only the rows that will carry the package.
7. The first lines of package.js's hold logic (`held` inside load) went into the Task 1 commit. The `hold()` export, the tier and cents in box(), and the price format went into Task 3.
8. **Push:** to wip/08-13 only, as instructed. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched. VPK-01, VPK-02 and VPK-10 are left for the orchestrator.

## Lines changed in shared files (against 2163866)

- `assets/js/integrations.js`: one added line, 1044, in the console-integrations render, after `${summaryPanel(ws)}`: `${NS.pkg && NS.pkg.panel ? NS.pkg.panel(ws) : ''}`. Nothing else.
- `assets/js/invitations.js`:
  - line 203 in `create`: `const id = o.id || uid('invt');` (the only change in create);
  - 1398: the binder `inv8b` gains `package`;
  - after `syncPackage`, the added functions `bulkPackage`, `sendable`, `bulkPackageHtml` and `syncBulkPackage` (about 1452 to 1487);
  - 1504: one added line in `invitePanel` after the single form's `NS.pkg.load` line;
  - 1540 and 1541: two added lines in the list form after "Include tax form" (the box and the error line);
  - `checkBulk` resets `bulkPackage` and `bulkPayError`, and its table moved into `bulkTable` (about 1935 to 1946);
  - the self-serve `invite-bulk-add` action rewritten (2067 to 2141, with `PAY_GROUP` at 2141).
- `server/help/guide.md`: one added line, 331, at the end of `## console-integrations`.
- `server/lib/help-guide.mjs`: regenerated by `node server/help/build.mjs`, not edited by hand.

## New files a preview build must add

- `.planning/phases/08-verification-package-and-ongoing-compliance/checks/package-panel.js` (a check only). The portal itself gains no new file. The panel lives in the existing `assets/js/package.js`, already loaded by diy.html, index.html and portal.html.

## Human check (owner, not yet done)

In the published preview on the iPhone, open Console, then Integrations. Expected:
- one panel "Verification package" with the single line "Checks run once your portal is connected to its server."
- no button and no error text
- the page scrolls and the menu still leaves it

Also on the iPhone, open Investors, then Invite an investor, then Import a list. Paste two lines and choose "Check list". Expected: a greyed "Add verification package" box with the same line, and "Send 2 invitations" still works from your email app. Adding and replacing a card can only be seen on a connected portal, which plan 08-12 shows you.

## Known Stubs

None. With no server, the one-line panel and the switched-off list box are the intended behaviour. The billing replies are stand-ins only inside the checks.

## Threat Flags

None beyond the plan's threat model:
- T-08-33: only the connected server's origin and the dialog's own frame are believed, and the card shown comes only from GET /v1/billing.
- T-08-34: no card field or payment script in assets/js, and nothing from billing is saved to the workspace (checked in part card).
- T-08-35: the browser sends keys and tiers only, and the server prices them.

## Self-Check: PASSED

- FOUND: assets/js/package.js, assets/js/integrations.js, assets/js/invitations.js, checks/package-panel.js, checks/package-invite.js, server/help/guide.md, server/lib/help-guide.mjs
- FOUND in HEAD's history: cf6cd01, 6070c41, 24f849b
- `server/node_modules` was linked for runs only and is not staged
