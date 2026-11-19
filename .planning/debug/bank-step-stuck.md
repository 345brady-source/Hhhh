---
status: awaiting_human_verify
trigger: "Intermittent: phase 4 signing-step check stuck on onboarding step 'Distribution payments' with 'Enter the account number (4 to 17 digits).' after typing bank details, on a heavily loaded machine; re-run passes."
created: 2026-11-19T00:00:00Z
updated: 2026-11-19T22:20:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "esign.js pagesOf() redraws the whole page (NS.app.render) when a document's page images finish, whatever is on screen by then; when Finish on the W-9 is pressed before its pages are drawn (slow device), that redraw lands on the bank step and replaces the input being typed in, so focus falls to <body> and later keystrokes are lost"
  confirming_evidence:
    - "diag.js at throttle 6 (2/2 runs): a render with stack 'esign.js:496:63' arrives while the heading is 'Distribution payments'; none at throttle 1"
    - "bank-step-typing.js on base: account '1234' of '123456789', focus BODY, at 390x844 touch and 1280x800, exactly when the held W-9 image is released mid-typing"
  falsification_test: "with the redraw guarded (only when that document's 'Loading document...' placeholder is still on screen), bank-step-typing.js must pass with the same hold/release; if it still fails, another redraw source exists"
  fix_rationale: "the redraw exists only to replace the placeholder with the pages; when the placeholder is gone (the screen moved on), nothing on screen needs it, so skipping it removes the cause instead of patching focus afterwards"
  blind_spots: "other background completions that call NS.app.render unconditionally (record.js already route-guards; integrations.js sandbox finish renders after 600 ms but the investor is on that step); a screen that waits for pages without showing pagesHTML's placeholder (checked: signHTML and the field editor's pendingHTML both use pagesHTML)"
  candidate_causes:
    - "code: esign.js pagesOf unconditional NS.app.render (confirmed)"
    - "environment/harness: Playwright fill() two round trips, typing before the field exists (fill race is real but only exposed by the redraw; typing-too-early ruled out because routing landed)"
  and_gate: "yes, two conditions: (1) Finish pressed before the W-9 pages are drawn (slow device / loaded machine) AND (2) typing in progress when the drawing ends. Only (1)+(2) together lose input; the fix removes the redraw, which breaks the AND."

bug_class: Bohrbug triggered by timing (a late, unconditional full-page redraw), not a data race inside the step
hypothesis: H1 - after Finish on the W-9 signing view, the W-9 page images (esign.js pagesOf -> loadPages(...).then(() => NS.app.render())) can finish loading AFTER the flow has moved to "Distribution payments"; that unconditional NS.app.render() redraws the bank step (#view innerHTML) while the account number is being typed. The focused input is replaced, focus falls to <body>, and keystrokes after the redraw go nowhere (a phone keyboard closes). Playwright fill() = focus+select, then a separate Input.insertText to the focused element, so a redraw between the two drops the whole value silently.
next_action: owner check on the iPhone (published preview): on the tax step press Finish as soon as it shows, then type the bank details at once; every digit must stay and Continue must move on. Then archive this session.

## Hypotheses (candidates, >=2 categories)
- code (product): stray late redraw from esign.js pagesOf after the W-9 step has moved on (H1)
- code (product): binder/value read before the input event lands (eliminated by reading: app.js onBind writes ob().d on every input event; validate reads ob().d; stepPayment redraws value from ob().d)
- environment/harness: the check types before the field exists (unlikely: walker waits for the heading of the bank step, and the fields are rendered in the same innerHTML as the heading)
- harness: Playwright fill() is two round trips (select+focus, then insertText to document.activeElement) - a redraw between them drops the text silently (confirmed by reading playwright-core 1.63 coreBundle.js: `if (result2 === "needsinput") await this._page.keyboard.insertText(...)`)

## Symptoms

expected: after the check types routing + account number on "Distribution payments" and presses continue, onboarding advances to step 9
actual: step stays on "Distribution payments" showing "Enter the account number (4 to 17 digits)." (twice, under ~10 agents on 4 cores); re-run passes 75/0
errors: "FAIL 390px: the investor reaches the signing step :: [... \"Step 8 of 11: Distribution payments | Distribution payments\",\"STUCK: \"]"; "FAIL investor onboards and signs the agreement inside onboarding :: [... \"Distribution payments\",\"STUCK: Enter the account number (4 to 17 digits).\"]"
reproduction: intermittent under heavy CPU load (natural); deterministic with bank-step-typing.js (W-9 page image held until the account number is half typed)
started: seen twice on 2026-11-19

## Eliminated

- hypothesis: the check types before the bank step's fields are ready (harness timing fault)
  evidence: the walkers wait for the step's heading, which is drawn in the same innerHTML as the fields; in the failing record run the routing number (typed first) landed and only the account number was lost; diag.js shows the loss coincides with a redraw from esign.js:496, not with the step appearing
  timestamp: 2026-11-19T20:45Z

- hypothesis: the step reads a value before its input event lands (binder timing)
  evidence: app.js onBind writes ob().d on every input event synchronously; validate() and the redraw both read ob().d; the bank step itself never redraws while typing (routing updates #routing-status in place)
  timestamp: 2026-11-19T20:25Z

## Evidence

- timestamp: 2026-11-19T20:20Z
  checked: the two failing logs
  found: record-check (phase 5 flow.js walk) STUCK with only "Enter the account number (4 to 17 digits)." - routing kept, achAuth kept, account empty (account2 is not compared when account is short, validate() else-if). signing-step (phase 4 lib walkToAgreement, 390px) STUCK with no field error text.
  implication: exactly one typed value was lost (account), the others landed; not "typed before the step existed" (that would lose routing first)

- timestamp: 2026-11-19T20:25Z
  checked: assets/js/app.js onBind (lines 558-576), onboarding.js NS.binders.ob (647-686), validate payment (527-535), stepPayment (435-456), NS.forms['ivf-step'] (3372-3405)
  found: every input event writes ob().d[path]; the step's HTML is rebuilt from ob().d on each render; validation reads ob().d. Nothing on the bank step itself renders while typing (routing updates only #routing-status in place).
  implication: a value can be lost only if the input event never reaches document (text inserted into nothing because the input was replaced)

- timestamp: 2026-11-19T20:30Z
  checked: esign.js pagesOf (line 495-498), signHTML (2414-2482), finishSigning (1190-1285), onboarding.js W-9 onSigned hook (3221-3228)
  found: pagesOf starts loadPages(docId) and on completion calls NS.app.render() unconditionally, whatever is on screen by then. The signing guide with Finish is drawn while the pages still show "Loading document...", so Finish can be pressed (D-30: nothing required) before the W-9 page images are ready; finishSigning then moves the flow to the bank step (taxSigned + render).
  implication: if the page images finish after finishSigning, a full redraw lands on the bank step at an arbitrary moment (more likely on a slow device)

- timestamp: 2026-11-19T20:35Z
  checked: playwright-core 1.63 fill() (coreBundle.js ~line 20390-20410)
  found: fill = evaluate(checkElementStates + injected.fill -> select()+focus()) then a separate keyboard.insertText(value) into whatever is focused
  implication: a redraw between those two round trips drops the whole value and fill still returns "done" - matches "account empty, others kept"

- timestamp: 2026-11-19T20:45Z
  checked: scratch diag.js (NS.app.render wrapped to log heading + stack), base e7f3721, sandboxed frame with CSP connect-src 'none', 390x844 touch iPhone UA, phase 6 walk to the bank step, then 8 s idle
  found: throttle 1 (1 run): no render on the bank step (the W-9 pages were drawn before Finish). Throttle 6 (2 runs): in both, after finishSigning's own render moved the flow on, ONE more render arrived while the heading was "Distribution payments", 148 ms and 608 ms after the walk returned, stack "at esign.js:496:63" (pagesOf's loadPages(...).then(() => NS.app.render())), focus was on the step's H1 at that moment. No other source of renders on the bank step.
  implication: H1 confirmed directly: a late, unconditional redraw from the W-9 page-image load lands on the bank step on a slow device, in the window where the walkers type

- timestamp: 2026-11-19T21:00Z
  checked: new check bank-step-typing.js on base e7f3721 (W-9 page image held until half-way through the account number, then released; phone-style typing one key every 60 ms; sandboxed frame, CSP connect-src 'none'; 390x844 touch and 1280x800)
  found: both parts FAIL the same way - after the redraw: account "1234" (the 5 digits typed after it went nowhere), focus BODY, Continue -> "The account numbers do not match." Preconditions PASS (W-9 still "Loading document..." at Finish; the W-9 finished drawing while the account number was typed).
  implication: product bug, user-visible: a person typing on a slow phone loses the keyboard and every digit after the redraw. The gate's fill() variant of the same redraw drops the whole value ("Enter the account number").

- timestamp: 2026-11-19T21:20Z
  checked: scratch diag-press.js on a base-tree copy (e7f3721), sandboxed frame 390x844 isMobile/hasTouch (as signing-step.js's 390px run): bank step filled as the walkers fill it, mouse button down on Continue, the held W-9 page image released (the late redraw lands), mouse button up
  found: {"heading":"Distribution payments","submits":0,"clicks":[],"errors":[],"account":"123456789"} - no click event reached anything, no submit, no field error, every value present. The automation's hit-target guard only checks the first pointer event, so it reports the click done.
  implication: the second symptom ("STUCK: " with no message, 390px signing-step run) is the same late redraw landing between the press and the release of Continue. Same root cause; one fix covers both.

- timestamp: 2026-11-19T21:45Z
  checked: bank-step-typing.js and diag-press.js on the fixed tree (esign.js pagesOf guarded), same hold/release
  found: BANK STEP TYPING: PASS (parts run: 2), 18/18 (iphone and desktop: all 9 digits in the field, focus stays on ob-account, Continue moves on with no field error). diag-press: {"heading":"Subscription","submits":1,"clicks":["BUTTON.btn btn-primary"],"errors":[]}.
  implication: both symptoms gone with the one change; falsification test of the reasoning checkpoint passed (no other redraw source)

- timestamp: 2026-11-19T21:55Z
  checked: diag.js on the fixed tree, natural slowing only (no hold): CPU throttle 6, sandboxed frame, 390x844 touch, 2 runs
  found: same timeline as base (Finish pressed while the W-9 was still drawing: no page-image redraw on the tax view; finishSigning's renders at ~9.0/10.2 s and ~8.5/9.8 s), and "onBank": [] in both runs - the late redraw that hit the bank step in 2/2 base runs is gone
  implication: the fix holds under the real slowing, not only under the check's injected hold

## Resolution

verdict: PRODUCT BUG (not the check's fault). The check exposed it because it presses Finish on the W-9 as soon as it is offered, which a person on a slow phone can also do (D-30: nothing on the W-9 is required).

root_cause: assets/js/esign.js pagesOf() (base e7f3721 line 496) - `if (!pageCache[docId]) loadPages(docId).then(() => NS.app.render(), () => NS.app.render());` redraws the whole page when a document's page images finish, whatever is on screen by then. On a slow device the W-9's pages are still drawing when Finish is pressed; finishSigning moves the flow to "Distribution payments"; the drawing ends a moment later and the redraw replaces the bank step's inputs while the investor types. Focus falls to <body> (a phone's keyboard closes) and every key after that goes nowhere. AND-gate: (1) Finish before the W-9 is drawn AND (2) typing when the drawing ends.

fix: esign.js pagesOf() redraws only while the page still shows that document's "Loading document..." placeholder (pagesHTML now marks it with data-doc="<docId>"); once the screen has moved on, nothing on it needs the pages, so no redraw. No on-screen text changed; no other file changed.

files_changed: [assets/js/esign.js]
check_added: .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/bank-step-typing.js (BANK STEP TYPING, parts iphone + desktop), added to .planning/checks/gate-reference.sh
oracle_type: specified (every typed digit stays in the field; focus stays in it; Continue moves on with no field error)

verification:
  - signal reproduce-before: bank-step-typing.js on e7f3721 -> "BANK STEP TYPING: FAIL (parts run: 2) - iphone, desktop" (account "1234", focus BODY, "The account numbers do not match.")
  - signal fixed-after: same check on ab70688 -> "BANK STEP TYPING: PASS (parts run: 2)", 18/18, iphone 390x844 touch and desktop 1280x800, both in the sandboxed frame with connect-src 'none'
  - signal second-symptom: diag-press on base = no click, no submit, no error (the "STUCK: " case); on the fix = 1 click, 1 submit, heading "Subscription"
  - signal natural-slowing: diag.js CPU throttle 6, 2 runs each: base 2/2 runs had the late redraw on the bank step (esign.js:496); fixed 0/2
  - signal no-text-change: diff is esign.js only, a data-doc attribute on the existing placeholder and the redraw condition; no string shown on screen changed
  - signal regression: reference gate (GATE_SERVER_TESTS=314) with BANK STEP TYPING added -> GATE_EXIT=0; signing base 75/0, plan 75/0; record base 40/0, plan 40/0; server tests 314/314
  guardrail_verdict: accepted (pending the owner's own check)
why_not_caught: the phase 4/5 walkers press Finish on the W-9 at once, so they could catch it, but only when the machine was slow enough that the W-9 pages outlived finishSigning; no check held the drawing on purpose. Now bank-step-typing.js does, in the gate.
recurrence_guard: .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/bank-step-typing.js (BANK STEP TYPING, 2 parts) in .planning/checks/gate-reference.sh
