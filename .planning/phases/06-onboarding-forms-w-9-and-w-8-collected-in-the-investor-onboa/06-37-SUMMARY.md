---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 37
status: in progress
plan_head_before: 12c55c992fdcf7fe7c4f198ea5b5ea687aab3b6f
---

# Phase 06 Plan 37: presses lost to a redraw (N4) and the co-investor's own sign-in (preview) Summary

(Written as the work goes, per the save rules. Not finished yet.)

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

<!-- gsd:write-continue -->
