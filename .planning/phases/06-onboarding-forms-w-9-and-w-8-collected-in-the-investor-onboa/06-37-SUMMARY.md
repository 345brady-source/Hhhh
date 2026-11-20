---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 37
subsystem: app shell (app.js render), co-investor (coinvestor.js), help guide
status: complete
owner_check: pending
tags: [walkthrough-2, N4, press, redraw, co-investor, sign-in, iphone, sandboxed-iframe]
requires: [06-WALKTHROUGH-2, 01.4-RESUME 2026-11-19]
provides:
  - "a render asked for outside a user input event is held while a press is pending, then run once or dropped"
  - "the co-investor's own sign-in in the self-serve edition (inv.coInvestor.signIn, the sign-in email dialog, #co-<token>)"
  - "NS.coInvestor.hooks { added, removed } for plan 06-39"
  - "checks/press-and-co-investor.js: PRESS AND CO-INVESTOR: PASS (parts run: 7)"
affects: [06-39, preview build (app.js, coinvestor.js), gate-reference.sh (orchestrator adds PRESS AND CO-INVESTOR (7))]
tech-stack:
  added: []
  patterns: ["render held under a pending press (capture listeners, window.event)", "retired links remembered by sha256 only"]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/press-and-co-investor.js
  modified:
    - assets/js/app.js
    - assets/js/coinvestor.js
    - server/help/guide.md
    - server/lib/help-guide.mjs
decisions:
  - "The real redraw on the walkthrough's console-link path is app.js's own hashchange render queued by the press before (Save's go()); no file, timer or page-drawing completion redraws on that path. It is held under a pending press like any redraw outside a user input event."
  - "A press also ends at pointerup when the pointer moved more than 10 px or the pressed control was already redrawn by the person's own input (a drag has no click to keep); otherwise at its click, pointercancel, 500 ms after pointerup, or 1 s after pointerdown."
  - "Only trusted events start or end a press: a click made by code is not a person's press."
  - "A replaced or removed co-investor link is remembered by the sha256 of its token only (ws.coSignInRetired, last 200), so its page says 'This sign-in link no longer works' and a made-up one 'We could not find this sign-in link'."
  - "An expired, never-opened link offers 'Make a new link' in the sign-in email dialog (the 30-day expiry needs a way back)."
  - "A hook in NS.coInvestor.hooks.added counts as 'sent by the server' only when it returns exactly true (a Promise does not count)."
metrics:
  completed: 2026-11-20
actuals:
  tokens: 70000
  tasks: 3
  commits: 13
plan_head_before: 12c55c992fdcf7fe7c4f198ea5b5ea687aab3b6f
plan_head_after: (the docs commit that adds this file; see the return report)
---

# Phase 06 Plan 37: presses lost to a redraw (N4) and the co-investor's own sign-in (preview) Summary

A press is no longer lost when the page is redrawn under it, and a co-investor added to an account in the self-serve edition
gets their own sign-in link that opens only their places. Both were measured on the base first (RED) and pass on the fix in the
host's refusing sandboxed frame at 390x844 with touch and 1280x800. **Nothing here is ready until the owner has checked it in
the preview** (SCRATCH/exec-06-37/owner/index.txt).

## Failures and limits first

1. **Two failures on the way, both fixed and rerun:** press-tax-phone failed on the first fix run (the check held the finger
   down past the guard's 1 s limit under the slowed CPU; check corrected, see Task 2), and the phase-2 field editor check
   failed 2 lines the base passes (the guard held a code redraw after a drag; product corrected, see W3). Final runs: no FAIL.
2. **Not tested on a real iPhone** (no WebKit here). The phone is Chromium with touch, an iOS user agent and the CPU slowed
   four times around the tax-form presses. The guard reads `window.event`, which WebKit supports.
3. **The co-investor's link works only in the browser holding the portal** (the preview has no server); elsewhere it says "We
   could not find this sign-in link". Sending it to the co-investor's own device is 06-39.
4. The guard's product code went in with save commits (4f456c5, 3d4685e) before the Task 2 commit (1cf790e), which records the
   verify results: the save rules made every edit round a commit.

## RED on the unchanged tree (12c55c9), produced 2026-11-20

`checks/press-and-co-investor.js` run on the base tree: 43 PASS, 32 FAIL. Last line:

```
PRESS AND CO-INVESTOR: FAIL (parts run: 7) - press-tax-desktop, press-tax-phone, press-nav-desktop, press-nav-phone, co-link-desktop, co-link-phone
```

co-managed passes on the base, as the plan expects (the managed edition must stay as it is).

The FAIL lines (cut at 260 characters):

```
FAIL press-tax-desktop the step after the tax step (Distribution payments) is on screen after this one press :: {"at":"Tax certification","press":{"label":"Finish","upConnected":false,"clickConnected":null,"clickOnIt":null,"clicks":0}}
FAIL press-tax-desktop the Finish pressed was still in the page when the mouse button was released and its click landed on it :: {"label":"Finish","upConnected":false,"clickConnected":null,"clickOnIt":null,"clicks":0}
FAIL press-tax-phone the step after the tax step (Distribution payments) is on screen after this one press :: {"at":"Tax certification","press":{"label":"Finish","upConnected":null,"clickConnected":false,"clickOnIt":false,"clicks":1}}
FAIL press-tax-phone the Finish pressed was still in the page when the finger lifted and its click landed on it :: {"label":"Finish","upConnected":null,"clickConnected":false,"clickOnIt":false,"clicks":1}
FAIL press-nav-desktop Investors is open after this one press on the console’s Investors link :: {"hash":"#console","press":{"label":"Investors","upConnected":false,"clickConnected":null,"clickOnIt":null,"clicks":0}}
FAIL press-nav-desktop the link pressed stayed in the page until its click and the click landed on it :: {"label":"Investors","upConnected":false,"clickConnected":null,"clickOnIt":null,"clicks":0}
FAIL press-nav-phone Investors is open after this one press on the console’s Investors link :: {"hash":"#console-notifications","press":{"label":"Investors","upConnected":null,"clickConnected":false,"clickOnIt":false,"clicks":1}}
FAIL press-nav-phone the link pressed stayed in the page until its click and the click landed on it :: {"label":"Investors","upConnected":null,"clickConnected":false,"clickOnIt":false,"clicks":1}
FAIL co-link-desktop after "Add co-investor" the "Co-investor sign-in email" opens :: {"h2":"Marisol Quenneville","toasts":["Theodora Mbeki-Larsen was added to the account and emailed the agreement to sign (simulated in this demo). Marisol Quenneville does not
FAIL co-link-desktop it is addressed to the co-investor, with the subject "<firm>: sign the subscription agreement for <account>" :: Marisol Quenneville
FAIL co-link-desktop its text greets the co-investor, says what is asked, that the link is personal and when it expires, and whom to ask :: {"missing":["Dear Theodora,","asks you to sign the subscription agreement for Marisol Quenneville as co-investor.","The
FAIL co-link-desktop the link field holds the co-investor’s link (…?tenant=<firm>#co-<43-character token>), the same as the account’s sign-in record :: {"link":"","signIn":null}
FAIL co-link-desktop Copy link, Open in your email app (a mailto to the co-investor), Mark as sent and "Open the co-investor’s link" are offered :: {"copy":false,"sent":false,"open2":false,"mailto":""}
FAIL co-link-desktop nothing says an email was sent (the preview sends none) :: {"toasts":["Theodora Mbeki-Larsen was added to the account and emailed the agreement to sign (simulated in this demo). Marisol Quenneville does not sign again."]}
FAIL co-link-desktop the sign-in record has its 30-day expiry and is not marked sent or opened :: null
FAIL co-link-desktop the investors row reads "Sign-in link ready to send" :: Marisol Quenneville Marisol Quenneville · marisol@example.org Co-investor: Theodora Mbeki-Larsen Individual $0 0 investments Active since Nov 20, 2026 W-9 not signed ACH · Checking
FAIL co-link-desktop the Account window says the same :: Marisol Quenneville
FAIL co-link-desktop its "Sign-in link" reopens the sign-in email with the same link :: {"h2":"Marisol Quenneville","link":""}
FAIL co-link-desktop after Mark as sent the row reads "Sign-in sent <date>" :: {"row":"Marisol Quenneville Marisol Quenneville · marisol@example.org Co-investor: Theodora Mbeki-Larsen Individual $0 0 investments Active since Nov 20, 2026 W-9 not signed ACH ·
FAIL co-link-desktop ran to the end :: locator.click: Timeout 30000ms exceeded.
FAIL co-link-phone (the same eleven lines as co-link-desktop, with Ingrid Vasquez-Holm on Leopold Haverkamp's account)
PRESS AND CO-INVESTOR: FAIL (parts run: 7) - press-tax-desktop, press-tax-phone, press-nav-desktop, press-nav-phone, co-link-desktop, co-link-phone
```

What the RED shows, plainly:

- **N4 is reproduced, and on the phone it is worse than "lost".** With a mouse the replaced Finish (or Investors link) gets no
  click at all (`clicks: 0`): the press does nothing. With touch the tap lands on whatever is under the finger after the
  redraw: on the tax form nothing happened; on the console the tap opened **Notifications instead of Investors**
  (`"hash":"#console-notifications"`). The plan expected the touch case might still work by chance; it did not.
- On touch, `upConnected: null` means the finger-up event never reached the page: it was sent to the replaced (detached) control.
- The cancelled-press lines pass on the base (nothing held there, so the pages are drawn at once): they guard the fix against
  holding a redraw forever.
- The co-link parts stop with "ran to the end" on the base because the Account window stays open (no "Sign-in link" in it to
  press); everything before that failed for the reason named in each line.
- Raw output: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-37/red.txt

## Task 1 verify (co-investor sign-in, on the fix)

```
KEPT co-link-desktop (from 2026-11-20 03:05:21 UTC)
PRESS AND CO-INVESTOR: PASS (parts run: 3)
```
(co-link-desktop ran once on this same tree just before, 29 PASS 0 FAIL; the rerun kept it. co-link-phone and co-managed ran in
this run.) Check change after RED, before any product change was tested: `investorsPage` closes a window left open first (on the
base the Account window stayed open and covered the page, which stopped the part with "ran to the end").

## Task 2: the real background redraw on the console-link path (render-sources.txt)

A scratch run (not committed: SCRATCH/exec-06-37/render-sources.js) repeated the walkthrough's sequence (Edit fields, Save, the
bar to the investor, back to Admin) on desktop and phone, recording every call to the portal's render and every rewrite of
`#view` with its stack and the event it ran in. Result:

- **No call through `NS.app.render` at all** on this path (no file, timer or page-drawing completion).
- **Every redraw is app.js's own `hashchange` render** (`render < onRoute`, event `hashchange`), one per action: Save calls
  `go('console-offering-…')`, which only sets the address; the whole page is redrawn a task later, when the browser delivers
  `hashchange`. The walkthrough's script found the Investors link on the field editor's page right after Save, and that queued
  redraw replaced the page under it ("Element is not attached to the DOM").
- So the source is **the navigation queued by the press before** (on a slow phone, a quick second tap right after Save).
  Under the plan's rule `hashchange` is not a user-input event, so this redraw is held under a pending press like any other.

press-nav-* got this real sequence as part (a): the Investors link pressed down on the field editor, Save run by code during
the press (its navigation redraws a task later), released. Part (b) is the plan's timer redraw.

A check problem found on the first fix run: **press-tax-phone failed on the fix** because, with the CPU slowed four times,
drawing all six W-9 pages after the release took longer than the guard's 1 s press limit: the check held the finger down far
longer than any tap, the press ended at 1 s and the held redraw ran under the finger. The check now draws every page but the
last before the press and lets only the last go during it; measured press length after the change: desktop 210 ms, phone
362 ms. The 1 s limit in the product is as the plan set it.

### RED of the revised press parts on the base tree (SCRATCH/exec-06-37/red-press-v2.txt)

```
NOTE desktop: Finish held down for 228 ms (all pages but the last drawn before: true)
FAIL press-tax-desktop the step after the tax step (Distribution payments) is on screen after this one press :: {"at":"Tax certification","press":{"label":"Finish","upConnected":false,"clickConnected":null,"clickOnIt":null,"clicks":0}}
FAIL press-tax-desktop the Finish pressed was still in the page when the mouse button was released and its click landed on it :: {"label":"Finish","upConnected":false,"clickConnected":null,"clickOnIt":null,"clicks":0}
NOTE phone: Finish held down for 399 ms (all pages but the last drawn before: true)
FAIL press-tax-phone the step after the tax step (Distribution payments) is on screen after this one press :: {"at":"Tax certification","press":{"label":"Finish","upConnected":null,"clickConnected":false,"clickOnIt":false,"clicks":1}}
FAIL press-tax-phone the Finish pressed was still in the page when the finger lifted and its click landed on it :: {"label":"Finish","upConnected":null,"clickConnected":false,"clickOnIt":false,"clicks":1}
FAIL press-tax-phone ran to the end :: TypeError: Cannot read properties of null (reading 'x')
FAIL press-nav-desktop pressed while the editor’s Save navigates (a redraw a task later): the agreement is saved and Investors is open after this one press :: {"hash":"#console-offering-kb-fund-ii","during":"#console-offering-kb-fund-ii","saved":true,"press":{"label":"Investors","upConnected":false,...
FAIL press-nav-desktop that link stayed in the page until its click and the click landed on it :: {"label":"Investors","upConnected":false,"clickConnected":null,"clickOnIt":null,"clicks":0}
FAIL press-nav-desktop Investors is open after this one press on the console’s Investors link :: {"hash":"#console","press":{"label":"Investors","upConnected":false,"clickConnected":null,"clickOnIt":null,"clicks":0}}
FAIL press-nav-desktop the link pressed stayed in the page until its click and the click landed on it :: {"label":"Investors","upConnected":false,"clickConnected":null,"clickOnIt":null,"clicks":0}
FAIL press-nav-phone pressed while the editor’s Save navigates (a redraw a task later): the agreement is saved and Investors is open after this one press :: {"hash":"#console-notifications","during":"#console-offering-kb-fund-ii","saved":true,"press":{"label":"Investors","upConnected":null,"clickConnected":false,...
FAIL press-nav-phone that link stayed in the page until its click and the click landed on it :: {"label":"Investors","upConnected":null,"clickConnected":false,"clickOnIt":false,"clicks":1}
FAIL press-nav-phone Investors is open after this one press on the console’s Investors link :: {"hash":"#console-notifications","press":{"label":"Investors","upConnected":null,"clickConnected":false,"clickOnIt":false,"clicks":1}}
FAIL press-nav-phone the link pressed stayed in the page until its click and the click landed on it :: {"label":"Investors","upConnected":null,"clickConnected":false,"clickOnIt":false,"clicks":1}
PRESS AND CO-INVESTOR: FAIL (parts run: 4) - press-tax-desktop, press-tax-phone, press-nav-desktop, press-nav-phone
```
(The base's "ran to the end" on press-tax-phone: after the lost tap the first form stayed on screen and the second investor's
Finish could not be found; it does not occur on the fix.)

## Task 2 verify (on the fix)

```
PRESS AND CO-INVESTOR: PASS (parts run: 4)          (t2.txt; NOTE desktop 210 ms, phone 362 ms held)
BANK STEP TYPING: PASS (parts run: 2)               (bank.txt)
```
W3, base tree 12c55c9: phase-2 field editor `104/104 passed`, phase-3 signatures `70/70 passed` (no FAIL line on the base).

### W3 failure on the first fix run, and its fix

**The phase-2 field editor check failed 2 lines on the fix that the base does not fail** (`102/104 passed`; the W3 diff
showed 2 new FAIL lines, 0 gone; signatures 70/70 on both):

```
FAIL a field placement was unsure of is marked on the page and listed in the left column :: {"flag":false,"tag":false,"list":0,"needs":true}
FAIL a field placement was unsure of is confirmed by being moved (and unconfirmed again by undo), keeping its confidence and reason :: ...
```

Cause: the check drags a field (mouse down, move, up) and at once redraws from code (as another part of the portal would). The
editor redraws during the drag, so the field pressed is replaced and no click follows; the guard kept the press pending for
its 500 ms wait after pointerup and held the code's redraw past the moment the check read the page. A drag has no click to
keep. Fix in the guard: at pointerup the press ends at once when the pointer moved more than 10 px, or when the control
pressed was already redrawn by the person's own input. Rerun results below.

### Rerun on the corrected guard (tree with 3d4685e)

```
PRESS AND CO-INVESTOR: PASS (parts run: 7)          (green.txt, 103 PASS, 0 FAIL; NOTE desktop 244 ms, phone 396 ms held)
BANK STEP TYPING: PASS (parts run: 2)               (bank.txt)
W3 field editor:  base 104/104 passed, fix 104/104 passed, new FAIL lines: 0, gone: 0
W3 signatures:    base 70/70 passed,   fix 70/70 passed,   new FAIL lines: 0, gone: 0
server tests:     # tests 368 / # pass 368 / # fail 0   (with the guide change)
```
(The diff is `diff <(grep '^FAIL' base-<check>.txt | sort) <(grep '^FAIL' fix-<check>.txt | sort)`, files w3-editor.diff and
w3-signatures.diff in SCRATCH/exec-06-37/.)

## Task 3 verify (final runs, tree 624466c)

```
# tests 368 / # pass 368 / # fail 0                     (server.txt)
PRESS AND CO-INVESTOR: PASS (parts run: 7)             (green.txt: 103 PASS, 0 FAIL; NOTE desktop 217 ms, phone 369 ms held)
SAFARI FINISH: PASS (parts run: 6)
WAYS OUT: PASS (parts run: 7)
HELP CHAT: PASS (parts run: 10)
PHONE LAYOUT: PASS (parts run: 8)
SIGNING DOCUMENTS: PASS (parts run: 8)
BANK STEP TYPING: PASS (parts run: 2)
```
The only change to the check after the Task 2 runs: it scrolls the account's row into view before the owner's two row
screenshots (the phone shots showed the top of the page).

## What changed

**app.js (the press guard, N4).** Capture listeners on the document (boot): a trusted primary pointerdown starts a press; it
ends at its trusted click, pointercancel, at pointerup for a drag (moved > 10 px, or the pressed control already redrawn by the
person's input), 500 ms after pointerup with no click, or 1 s after pointerdown. `render()` called while a press is pending and
not inside a pointer, mouse, touch, click, key, input, change, submit or focus event returns false and is held; when the press
ends it runs once on the next task unless a render ran since. `onRoute` places the new page's top and focus after a held render
draws. Typing, the field editor's dragging and the signature pad render at once as before (bank step 2/2, field editor 104/104,
signatures 70/70).

**app.js (routes).** `PREFIXED` gains `['co-', 'co']`; `setClient` with no stored portal renders the `co` page like `invite`.

**coinvestor.js (self-serve edition only; the managed edition is unchanged, co-managed passes on base and fix).**
- `inv.coInvestor.signIn = { token, link, createdAt, expiresAt, sentAt, openedAt }`: token 32 random bytes base64url, link
  `<page>?tenant=<id>#co-<token>`, 30 days. Made at "Add co-investor" and at "Save co-investor" when the email changes (the old
  token is retired); kept when only the name changes; retired at "Remove co-investor".
- The "Co-investor sign-in email" dialog in the invitation email's layout (From, To, Subject, the text the plan gives, the link
  field, Copy link, Open in your email app (mailto, CRLF), Mark as sent, "This link opens the portal in this browser only.",
  "Open the co-investor’s link" in the preview). The self-serve toast no longer says anything was emailed.
- Row and Account window: "Sign-in link ready to send", "Sign-in sent <date>", "Sign-in link expired"; with 06-39's `serverId`:
  "Sign-in emailed <date>" or "Sign-in is emailed once <investor> has signed". "Sign-in link" in the Account window reopens it.
- `NS.views.co` (standalone, edition diy): a live token signs in as investor with `co: true` on that account, records `openedAt`
  once (audit line), and opens the first agreement waiting for the co-investor (`NS.esign.pendingFor`) or Documents. Unknown
  token: "We could not find this sign-in link"; replaced, removed or expired: "This sign-in link no longer works"; both with the
  firm's team, email and phone. esign.js already limits the co-investor to their own places (asserted: own fields on screen =
  the co-investor's fields in the envelope, none of the investor's).

**Help guide.** One sentence in the Investors entry's co-investor paragraph; `co` added to the skip section with its reason;
`server/lib/help-guide.mjs` regenerated with `node server/help/build.mjs`.

## The data contract and hooks 06-39 builds on

- Record: `inv.coInvestor.signIn` as above. 06-39 adds `serverId`, `envelopeId`, `emailStatus`, `error` to the same object and
  may set `sentAt` when the server emailed it; the row text switches on `serverId`; the dialog then shows "The email your
  integration server sends." with Done.
- `NS.coInvestor.hooks.added.push(fn(ws, inv, was))`: called after "Add co-investor" or a changed email, after the record and
  the new `signIn` are saved; return exactly `true` when the server sent it (the local dialog is then not opened; the Account
  window opens instead). `was` is the previous co-investor (with its old `signIn`) or null.
- `NS.coInvestor.hooks.removed.push(fn(ws, inv, removed))`: called at "Remove co-investor" before the record is deleted.
- Also exported: `NS.coInvestor.signInOf(inv)`, `signInText(inv)`, `showSignIn(inv)`.

## Deviations from Plan

1. **[Rule 1 - Bug] Drags kept the press pending** (found by W3): fixed in the guard (pointerup ends the press for a drag).
2. **[Rule 1 - Check defect] press-tax-phone held the finger down for the whole six-page drawing** under the slowed CPU, longer
   than any tap and than the plan's 1 s limit: the check now draws all pages but the last before the press (press 369 ms).
3. **[Rule 2] Only trusted events count as a press**, so a click made by code does not end a person's press.
4. **[Rule 2] Retired links are remembered by hash** so a replaced or removed link reads "no longer works" (telling the two
   messages apart needs it). Expired, never-opened links get "Make a new link" in the dialog.
5. **press-nav-* got the real source as part (a)** (as the plan allows), besides the timer redraw (b). The co-link parts give
   the co-investor a place by adding a second investor signature to the stored template, then reassigning it to "Co-investor
   (if any)" in the real field editor (Signer select) and saving it there.
6. The email's "Questions?" line follows the plan (team and email, no phone); the link pages also give the phone.

## The gate line to add (orchestrator)

```
PRESS AND CO-INVESTOR (7): NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/press-and-co-investor.js > $O/press-co.txt 2>&1   expecting   PRESS AND CO-INVESTOR: PASS (parts run: 7)
```
Server tests unchanged by this plan: 368.

## Files a preview build must carry

No new runtime file. Changed: `assets/js/app.js`, `assets/js/coinvestor.js` (both already in the build's lists). The check file
is new and not part of the preview.

## Threat model

T-06-62 (token): 32 random bytes, one per co-investor, replaced on a new email, ended on remove, 30 days; acts only on a token
of the loaded workspace; old and made-up tokens refused (co-link-*). T-06-63: role investor with `co`, own fields only
(asserted). T-06-64: renders in input events never held; a press ends at most 1 s after pointerdown; bank step, field editor and
signature checks pass. T-06-65: white label checked on every screen of the parts (vendor list and the forbidden word).

## Owner check (pending)

In the next preview: add a co-investor to an account whose agreement has a co-investor place, see the sign-in email and link,
open the link, see only the co-investor's places and sign; on the iPhone, Finish on the tax form moves on with one tap and the
console's links open on the first tap. Screenshots: SCRATCH/exec-06-37/owner/index.txt.

## Self-Check: PASSED

Files present: checks/press-and-co-investor.js, assets/js/app.js, assets/js/coinvestor.js, server/help/guide.md,
server/lib/help-guide.mjs. Commits ca4821b, 9919282, 1cf790e are ancestors of HEAD (checked before this commit).
