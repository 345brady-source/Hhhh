---
phase: 08-verification-package-and-ongoing-compliance
plan: 20
subsystem: sponsor console (the re-verify dialog), the investor's portal (subscribe screen), phase checks
status: complete
tags: [package, re-verification, accreditation, rule-506c, d-01, g6, d-30, white-label, stand-ins]
requires: [08-07, 08-09, 08-17]
provides:
  - the "Add verification package" box in the "Ask to re-verify" dialog, priced by the server's reverify tier, in every state the invite form's box has
  - requestReverify with the package (kept only while the box allows it); a used package leaves a new re-verification request, nothing charged
  - refusals (tier_mismatch, package_used, any send failure) shown in the dialog as the server's own sentence, alone, and on the request's row
  - the subscribe screen's offer of the open re-verification request ("Verify your accreditation"), or "<firm> will send you a link to verify again."
  - checks/reverify.js parts package, subscribe, phone, preview-desktop, preview-phone; part server extended (G6): REVERIFY 9
affects: [the guide pass (one proposed line below), 13-01 and small-fixes-a (other hunks of invitations.js)]
tech-stack:
  added: []
  patterns:
    - "a dialog's package box is package.js box(ws, null, tier), drawn again in place when GET /v1/billing answers, as the invite form's"
key-files:
  created: []
  modified:
    - assets/js/invitations.js
    - assets/js/portal.js
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/reverify.js
decisions:
  - "The box shows only when no request is open: an open request is sent again as it is (its package choice stays with it), so nothing is paid twice"
  - "A refusal stays in the open dialog as the server's sentence alone (the earlier toast with a prefix is gone); the request's row shows it too"
  - "The subscribe offer sits on the self-serve subscribe screen and on the screen that says the agreement cannot be signed online yet; the plan's named banner line is never reached in the self-serve edition and is unchanged"
  - "A check the portal can run itself = an accreditation connection the firm turned on, other than self-certification (the fallback upload, shown when none is on, does not count)"
requirements: [VPK-01, VPK-02, VPK-08, VPK-10]
metrics:
  duration: "about 3 h 15 min, from step 0 (06:02 UTC) to GATE_EXIT=0 (09:16 UTC), 2026-11-27; gate run 1 failed MEASURE (see Failures), run 2 passed"
  completed: 2026-11-27
  tasks: 3
  files: 3
actuals:
  tokens: 16977    # chars/4 over the 67,907 characters of added lines in assets/ and checks/ (summary excluded)
  tasks: 3
  commits: 10      # git rev-list --count 5745e39..HEAD before this summary commit
plan_head_before: 5745e39a840271eaa9178a1a2a10786bdf97f6f7
plan_head_after: 55ea3bf32ab024a76d0869d60799880b095d5014
---

# Phase 8 Plan 20: the package on a re-verification request, and the investor's way to it Summary

**The "Ask to re-verify" dialog now carries "Add verification package ($99)" (the server's reverify price). Ticked, the
card is charged once, before the email, and the investor re-verifies through the package. The box shows every state the
invite form's box shows, and every refusal appears word for word as the server sends it. An investor stopped on the
subscribe screen now sees the open request ("Verify your accreditation"), or is told the firm will send a link.** All of
this was tested on the sample portal against stand-ins only: the payment provider and the accreditation provider are the
phase's test doubles, and no provider was called. Nothing here is confirmed with a real provider. It is not done until the
owner has checked it on his phone.

## Failures first

1. **Gate run 1 failed one step, MEASURE.** walkC's entity walk produced no result: it ran 943 s against a 900 s limit
   while the three browser slots were held by other builds' gates. Its log line: `FAIL walkC (943 s): individual: 17 PASS,
   0 FAIL, RESULT: PASS; entity: 0 PASS, 0 FAIL, RESULT: FAIL`. Every other step passed. Run 2, in the same folder, ran
   MEASURE again and it passed (`PASS walkC (90 s): ... entity: 17 PASS, 0 FAIL, RESULT: PASS`); the other steps are shown
   as kept. This plan does not touch the walks. I count it as a failure caused by load, and have not proven more than that.
2. **The plan named a dead line for the subscribe offer.** portal.js's banner line (`gate ? … iv-banner …`) is never
   reached in the self-serve edition. Since 06-08 the self-serve subscribe screen returns earlier ("Your subscription takes
   you through the documents…"), and in the managed edition subscribeGate is off. A probe showed the self-serve screen with
   no banner. The offer went onto the self-serve screen instead. Then the first GREEN run found that the owner's preview has
   no stored agreement for the sample offering, so its subscribe screen is the "not available to sign online yet" one. The
   offer is on that screen too: **portal.js has two changed lines, not one** (see Deviations).
3. **A failure in the plan's own measurement:** summing numstat across commits counts a later commit that revises an
   earlier line twice. portal.js read "28 changed" lines (7 + 21 added, 1 + 7 deleted) when the net change is 2. My verify-3
   measures the net change (`git diff --numstat $BASE HEAD`); its first run stopped there, before the gate.
4. **Three faults of my own check, found on the way and fixed:** the console keeps the server's word on the package as an
   object, and the check read `package === true` (Task 1's first GREEN run); the status-number scan matched "506" in "Rule
   506(c)" (red2.txt); the drafted preview part expected the subscribe screen that has the agreement.
5. **Two faults in the code, found by the checks and fixed:** `create` kept a re-verification's package by the invite
   form's identity/full box, never by the reverify tier. `replaceUsed` made no new request after a used package on a
   re-verification, because `validate` refuses an account-only invitation for an active investor. A used package there left
   no request at all.

## RED lines, verify lines (as produced)

## Task 1 RED (red.txt, part package against the base code)

```
PASS package the taxpayer-number scan finds the number in a planted copy of a file
PASS package the console uses the integration server with the sponsor account's token
PASS package GET /v1/billing (the account's token) offers the reverify tier at a price of its own
FAIL package the dialog holds "Add verification package ($99)" (the server's reverify price), switched on and unticked :: {"present":false,"shown":false,"enabled":false,"checked":false,"label":"","line":"","link":""}
REVERIFY: FAIL (parts run: 1) - package
```

## Task 1 first GREEN attempt (verify-1.sh exit 1)

One FAIL, the check's own read: the console keeps the server's word on the package as an object ({ tier, status }), and
the check looked for `package === true`. Fixed in the check (`!!y.package`). Found while reading that code: invitations.js
`create` kept a package only when the invite form's box (identity or full tier) allowed it, never asking about the reverify
tier; fixed in the same line (a re-verification asks the dialog's own box).

## Task 1 verify (verify-1.sh, exit 0, after the fix)

```
PASS package the typed taxpayer number is in no world record
PASS package the typed taxpayer number is in no server output (store, events, anything this process printed) and on no screen
REVERIFY: PASS (parts run: 1)
VERIFY1_EXIT=0
```
Tracer gate: the verify re-ran end to end on the fixed code and passed; expanding.

## Task 2 RED (red2.txt, part server with G6 against Task 1's code 1b356ae; 57 PASS)

```
FAIL server an amount owed: no status number, "answered" or vendor word in the dialog :: ["506"]
FAIL server tier_mismatch: the dialog shows the server's sentence word for word, alone :: {"said":"","SENT":"This invitation's package was paid at another level. Nothing was charged."}
FAIL server package_used: the dialog shows the server's sentence word for word, alone :: {"said":"","SENT":"This package belongs to another invitation."}
FAIL server package_used: one new request for the same investor with a different id, still a re-verification (reverify, on file, no offering), with the package choice, not sent :: {"one":"invt-mwym4yd3ij6ci","fresh":[]}
REVERIFY: FAIL (parts run: 1) - server
```
- The first FAIL is the check's own: its status-number scan matched "506" in "A Rule 506(c) subscription needs a current
  verification." Fixed in the check (a number after "Rule " is the exemption, not a status).
- The other three needed code: the dialog closed and showed a refusal only in a toast with a prefix; and replaceUsed made
  no new request for a re-verification, because `validate` refuses an account-only invitation for an investor with an
  active account ("Choose an offering to invite them to subscribe"). A used package on a re-verification left no request.
- Passing before the code (guards): the shared token (account_required sentence), unreachable, no card (with and without
  the link), the amount owed (switched off with the real credit_owed sentence, sent without the package, nothing charged),
  tier_mismatch's row sentence and nothing charged, package_used's old row sentence and nothing charged.

## Task 2 mutation (red2-mut.txt: a copy of 1b356ae whose dialog ignores the box's state; 52 PASS)

```
FAIL server the shared token: the dialog's box shown switched off, unticked, with exactly the server's account_required sentence :: {"sb":{"present":true,"shown":true,"enabled":true,...,"line":"Card payments need a sponsor account."},...}
FAIL server unreachable: the box shown switched off, unticked, with "The integration server could not be reached." :: {...,"enabled":true,...}
FAIL server no card: the box shown switched off with "Add a card on the Integrations page to use it." leading to the Integrations page (an admin) :: {...,"enabled":true,...}
FAIL server no card: for someone who cannot open Integrations, the same line with no link :: {...,"enabled":true,...}
FAIL server an amount owed: the box shown switched off, unticked, with the server's price and exactly its credit_owed sentence :: {"b":{...,"enabled":true,...}}
FAIL server an amount owed: no status number, "answered" or vendor word in the dialog :: ["506"]
FAIL server tier_mismatch: the dialog shows the server's sentence word for word, alone :: ...
FAIL server package_used: the dialog shows the server's sentence word for word, alone :: ...
FAIL server package_used: one new request ... :: {"one":"invt-mwym5skl1ovqj","fresh":[]}
REVERIFY: FAIL (parts run: 1) - server
```
The guard states fail when the dialog ignores the box's state, so they measure the dialog, not only package.js.

## Task 2 verify (verify-2.sh, exit 0; flow2.txt 107 PASS, 0 FAIL)

```
PASS package the typed taxpayer number is in no world record
PASS package the typed taxpayer number is in no server output (store, events, anything this process printed) and on no screen
REVERIFY: PASS (parts run: 3)
VERIFY2_EXIT=0
```

## Task 3 RED (red3.txt: parts subscribe, phone, preview-desktop, preview-phone against Task 2's code 1f037db, run from an archive of it; 60 PASS)

```
FAIL subscribe an open re-verification request: the banner shows the reason and "Verify your accreditation", which leads to the request's link :: {"text":"...Subscribe to Kestrel Bay Fund II, L.P.\n\nYour subscription takes you through the documents and the subscription agreement.\n\nContinue your subscription..."}
FAIL subscribe no open request and no accreditation check the portal can run: the banner shows the reason and "Kestrel Bay will send you a link to verify again.", with no button :: {"text":"..."}
FAIL phone the subscribe screen on a phone offers "Verify your accreditation" :: {"text":"...Your subscription takes you through the documents and the subscription agreement..."}
FAIL phone the subscribe banner fits the phone's width (no sideways scroll) :: null
FAIL phone its link is on screen and can be tapped :: {"ok":false,"why":"not there"}
FAIL preview-desktop the subscribe screen offers "Verify your accreditation", leading to the request :: {"text":"...The subscription agreement for Kestrel Bay Fund II, L.P. is not available to sign online yet..."}
FAIL preview-phone the subscribe screen offers "Verify your accreditation", leading to the request :: {"text":"..."}
FAIL preview-phone the subscribe banner fits the width :: null
REVERIFY: FAIL (parts run: 4) - subscribe, phone, preview-desktop, preview-phone
```
Guards that passed before the code: the firm's own check (the subscribe screen as today, no banner); the phone dialog with
its box (fits, scrolls to "Send request", closes with its X, Escape and the browser's back) and the investor's phone step
with Back on screen; the preview's dialog (switched off with package.js's no-server line, cannot be ticked), the sponsor's
own email, the two steps with the firm's own connection, no refused connection.

Found by the first GREEN run (green3.txt; subscribe and phone passed, the two preview parts failed): the owner's preview
has no stored agreement for the sample offering, so its subscribe screen is the one saying "The subscription agreement ...
is not available to sign online yet", and the offer was not on it. The offer now shows on that screen too (a second
changed line in portal.js; see Deviations).

## Task 3 GREEN (green3b.txt, parts subscribe, phone, preview-desktop, preview-phone on the final code; 89 PASS, 0 FAIL)

```
REVERIFY: PASS (parts run: 4)
```

## Task 3 verify and the phase gate

verify-3.sh follows the orchestrator's 08-20 additions: it starts with `rm -f $O/gate.txt;`. The pre-gate conditions run as
one `&&` list ending `|| exit 1;`: the base commit exists; red3.txt holds "FAIL subscribe "; guide.md, help-guide.mjs and
help-data.js have no diff from the base; no added line under assets or server holds the owner's forbidden word; portal.js's
net change deletes 2 lines; the whole server suite runs exactly 484 tests with `# fail 0`; the file list (first-parent,
this summary filtered) is reverify.js, invitations.js and portal.js (console.js allowed, not touched). Then the gate runs,
then its greps, each allowing the kept suffix. It never removes $O/owner, $O/checks-out, $O/shots or $O/base-tree.

Server suite alone before the gate (server3.txt): `# tests 484`, `# pass 484`, `# fail 0`. No server test was added.

Gate run 1 ended GATE_EXIT=1, with MEASURE as its only failure (Failures 1). Run 2 (same folder) ended GATE_EXIT=0, and
VERIFY3_EXIT=0. Its GATE lines, verbatim:

```
GATE ok   server tests # fail 0 (kept from 2026-11-27 07:11:38 UTC)
GATE ok   server tests 484 (found 484) (kept from 2026-11-27 07:11:38 UTC)
GATE ok   STATUS MATH (13) (kept from 2026-11-27 07:11:39 UTC)
GATE ok   FORM MAPS (3) (kept from 2026-11-27 07:12:04 UTC)
GATE ok   FORMS FLOW (34) (kept from 2026-11-27 07:22:59 UTC)
GATE ok   STATUS FLOW (26) (kept from 2026-11-27 07:28:48 UTC)
GATE ok   SERVER MODE (15) (kept from 2026-11-27 07:33:49 UTC)
GATE ok   TWO PERSONS (kept from 2026-11-27 07:34:06 UTC)
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3) (kept from 2026-11-27 07:52:15 UTC)
GATE ok   AGREEMENT NAME (kept from 2026-11-27 07:52:49 UTC)
GATE ok   TAX REQUEST LEAVE (5) (kept from 2026-11-27 07:53:13 UTC)
GATE ok   WAYS OUT (7) (kept from 2026-11-27 07:54:50 UTC)
GATE ok   NO NETWORK (3) (kept from 2026-11-27 07:55:14 UTC)
GATE ok   EMBED DATA (3) (kept from 2026-11-27 07:55:14 UTC)
GATE ok   SAFARI FINISH (6) (kept from 2026-11-27 07:55:56 UTC)
GATE ok   BANK STEP TYPING (2) (kept from 2026-11-27 07:56:12 UTC)
GATE ok   HELP CHAT (10) (kept from 2026-11-27 07:57:51 UTC)
GATE ok   REAL FIRM (9) (kept from 2026-11-27 08:00:29 UTC)
GATE ok   SIGNING DOCUMENTS (8) (kept from 2026-11-27 08:03:40 UTC)
GATE ok   PHONE LAYOUT (8) (kept from 2026-11-27 08:09:07 UTC)
GATE ok   RECORD AND LOST AGREEMENT (7) (kept from 2026-11-27 08:11:23 UTC)
GATE ok   SCREEN EDGES (5) (kept from 2026-11-27 08:13:31 UTC)
GATE ok   WALK3 FIXES (9) (kept from 2026-11-27 08:13:58 UTC)
GATE ok   TITLES AND EDITOR (4) (kept from 2026-11-27 08:14:52 UTC)
GATE ok   PRESS AND CO-INVESTOR (10) (kept from 2026-11-27 08:17:21 UTC)
GATE ok   CO-INVESTOR SERVER (5) (kept from 2026-11-27 08:18:42 UTC)
GATE ok   HELP PREVIEW (6) (kept from 2026-11-27 08:32:28 UTC)
GATE ok   phase-8 gate checks found (8)
GATE ok   AML RECORD (7) (kept from 2026-11-27 08:33:00 UTC)
GATE ok   MONITORING (8) (kept from 2026-11-27 08:34:52 UTC)
GATE ok   PACKAGE CONSOLE (7) (kept from 2026-11-27 08:36:08 UTC)
GATE ok   PACKAGE FLOW (10) (kept from 2026-11-27 08:43:27 UTC)
GATE ok   PACKAGE INVITE (12) (kept from 2026-11-27 08:45:27 UTC)
GATE ok   PACKAGE NAMES (4) (kept from 2026-11-27 08:46:09 UTC)
GATE ok   PACKAGE PANEL (7) (kept from 2026-11-27 08:48:46 UTC)
GATE ok   REVERIFY (9) (kept from 2026-11-27 08:50:23 UTC)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing-base (kept from 2026-11-27 08:51:48 UTC)
GATE ok   signing-plan (kept from 2026-11-27 08:58:57 UTC)
GATE ok   record-base (kept from 2026-11-27 09:07:45 UTC)
GATE ok   record-plan (kept from 2026-11-27 09:07:59 UTC)
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
COUNTS server tests 484; AML RECORD 7; MONITORING 8; PACKAGE CONSOLE 7; PACKAGE FLOW 10; PACKAGE INVITE 12; PACKAGE NAMES 4; PACKAGE PANEL 7; REVERIFY 9
GATE_EXIT=0
```

GATE_EXIT=0 with P8_SERVER_TESTS=484 (GATE_SERVER_TESTS). The phase-8 gate checks number 8, the same as the base (no new
check file). REVERIFY has 9 parts = base 4 + 5 (package, subscribe, phone, preview-desktop, preview-phone). EMAIL DIALOG
(3), the known flake, passed in run 1.

Taxpayer-number scan (W3), after the gate: a planted copy holds 1 hit. Over the 68 files $O/*.txt, the only hit is
forms.txt (phase 6's check, not this plan's), where an 11-digit foreign tax ID contains the run, as 08-09 also found. The
gate's REVERIFY output (p8-reverify.txt), red.txt, tracer.txt, red2.txt, red2-mut.txt, flow2.txt, red3.txt, green3.txt and
green3b.txt hold 0 each. Inside the check, parts package and server (G6) also assert that the number is absent from the
world's record, the server's store and events, everything the process printed, and every screen; each scan is proven on a
planted copy first.

## The lines added to portal.js

One added helper block (`function reverifyOffer(inv, o)`, 20 lines, right before `NS.views.subscribe`) and two changed
lines in the subscribe view. Each changed line gains `${reverifyOffer(inv, o)}` right after the title:
- the self-serve line (`return shell(…Your subscription takes you through the documents…`, the screen an active investor
  sees);
- the agreement-missing line (`if (agr === false) return shell(…is not available to sign online yet…`, the screen the
  owner's preview shows).
The managed-edition banner line and `NS.forms['sub-submit']` are unchanged.

## The lines changed in invitations.js

- `create`: one changed line. The package is kept by `reverifyPackage(ws)` for a re-verification, by `packageBox` otherwise.
- `requestReverify`: one changed line plus its comment. `opts.package` is kept only while `reverifyPackage(ws).enabled`.
- `replaceUsed`: one changed line plus a comment. A re-verification is made again for an active investor without
  `validate`'s offering rule.
- After the tax-request action, beside the dialog: `reverifyPackage`, `reverifyBoxHtml`, `syncReverifyPackage`,
  `reverifySaid`. In `reverifyDialog`: the box (when no request is open), the `#rv-said` line and the load. In
  `reverify-send`: it reads the tick, and a refusal goes to `reverifySaid` instead of the old toast.
small-fixes-a's activity label and 13-01's emailFor are in other hunks and were not touched.

## Guide lines for the guide pass

No guide bytes: guide.md, help-guide.mjs and help-data.js have no diff from the base (the verify asserts this).
.planning/GUIDE-PASS.md already holds 08-09's `## investments` line, which names "Verify your accreditation". One line is
proposed for the "will send you a link" case (73 bytes with its newline):

| Section | Line | Bytes |
|---------|------|-------|
| `## investments` | `With no request open, the subscribe page says the firm will send a link.` | 73 |

## Deviations from Plan

1. **[Orchestrator B1] The box is in invitations.js `reverifyDialog`**, and `reverify-send` passes `{ package: ticked }`.
   console.js is untouched; the phone part needed no fix.
2. **[Orchestrator B2] No guide bytes**; the one proposed line is above.
3. **[Rule 1, plan defect] The subscribe offer is not on the plan's named banner line**, which is dead in the self-serve
   edition (Failures 2). It is on the self-serve subscribe line and on the agreement-missing line. That makes portal.js
   one added block and **two** changed lines; the plan allowed one. Without the second line, the owner's preview (the
   condition he checks) would not show the offer. verify-3 measures 2 deleted lines.
4. **[Measurement] verify-3 measures portal.js by its net change against the base**, not the per-commit sum, which counts
   a revised line twice (Failures 3). Everything else in verify-3 follows the plan and B3-B6, W4.
5. **[Rule 1] `create`'s package rule for a re-verification** (Failures 5): one changed line in invitations.js.
6. **[Rule 1] `replaceUsed` for a re-verification** (Failures 5): one changed line. Without it, a used package on a
   re-verification left no request at all.
7. **[Design] A refusal no longer closes the dialog with a prefixed toast.** It stays in the dialog as the server's
   sentence alone. If the dialog was closed meanwhile, the old toast is kept.
8. **[Design] The box is drawn only when no request is open.** Pressing "Send request" then sends the open request again,
   with its own package choice. Nothing is paid twice, and an open request's choice cannot be changed afterwards.
9. **[Check] RED3 ran from an archive of Task 2's commit (1f037db)** while the portal code was written in the worktree.
   The mutation run for Task 2 likewise ran from an archive of 1b356ae with the dialog ignoring the box's state.
10. **[Commits] Task code landed in save commits** (rule 2: save after every edit round), and each task commit records its
    passing verify. History was never rewritten (no force push).

## Owner's check (not done: the owner has not checked anything here)

On the iPhone, in the published preview:
1. Console, Investors. Pick an investor whose verification has lapsed while a Rule 506(c) offering is raising (the 08-09
   note: the sample has several), then "Ask to re-verify".
   Expected: the dialog shows "Add verification package", greyed, with the one line "Checks run once your portal is
   connected to its server."; it cannot be ticked; the dialog closes with its X. No error text.
2. "Send request" (the email for your own email app opens), then close it. Switch "Signed in as" to that investor and open
   the offering's subscribe page (Investments, or the offering's address).
   Expected: a banner with "Your accreditation verification expired on …" and the button "Verify your accreditation";
   pressing it opens the link at "Step 1 of 2". No error text.

The owner's screens (a separate run after the gate, `REVERIFY: PASS (parts run: 5)`, 13 screenshots with index.txt):
/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-08-20/owner-shots
They show the dialog with its box at both sizes (server mode with the price; the preview greyed with its line), the
subscribe screen in its three forms (open request, "Kestrel Bay will send you a link to verify again.", the firm's own
check as today), the investor's phone step with Back, and the request's row reading "Package". Toasts left over from the
fixture's setup cover the footer of some screenshots. In phone-dialog.png, two words in the dialog's text look selected,
left by the check's tap; this is not the page's own state.

## Known Stubs

None. The reverify price is the server's setting (PACKAGE_PRICE_REVERIFY_CENTS, default 9900 = the full package),
read from GET /v1/billing in every run. The payment and accreditation providers are stand-ins (W5); nothing is claimed
as confirmed with a provider.

## Threat Flags

None beyond the plan's register. T-08-57 is mitigated: a reused request is sent again with nothing paid; the refused
sends (tier_mismatch, package_used) charged nothing, asserted against the server's own payments and entitlements; a used
package leaves one new unsent request. T-08-58 is mitigated: part package scans the investor's screens, the request's
email and GET /v1/invite for $19, $99, 1900, 9900, tier and entitlement, and finds 0.

## Open items

- The guided subscription's own accreditation step (onboarding.js, outside this plan's files) does not mention an open
  re-verification request. Investors who reach a subscription through Investments' "Review and subscribe" go straight
  there, skipping the subscribe screen. The Overview and Investments box from 08-09 does offer the request.
- The guide pass: the one line above.
- Merge order: small-fixes-a and 13-01 edit other hunks of invitations.js. Whichever merges second reruns step 0 and the
  final verify on the merged tree. This branch was not merged.
- MEASURE's walkC timed out once under browser-slot load (Failures 1); watch it in the merged-tree gate.

## Self-Check: PASSED

- FOUND: assets/js/invitations.js, assets/js/portal.js and checks/reverify.js changed. reverify.js keeps
  "// GATE CHECK: REVERIFY" in its first five lines, and an unknown part name lists 9 parts.
- FOUND: task commits 1b356ae, 54daa69 and 55ea3bf are ancestors of HEAD, and base 5745e39 is an ancestor.
- guide.md, help-guide.mjs and help-data.js have no diff from the base. console.js is untouched.
- STATE.md, ROADMAP.md and REQUIREMENTS.md are not touched here (the orchestrator updates them at merge, as for 08-09).
