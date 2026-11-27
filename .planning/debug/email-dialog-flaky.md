---
status: verifying
trigger: "EMAIL DIALOG (3) fails its phone part under load: 'n of 11 paragraphs seen whole' in the phone frame (4, 7 and 10 of 11 across runs) in the gates of 10-11, 11-15, 14-01 and 11-14 (twice); passes when rerun unchanged."
created: 2026-11-27T05:40Z
updated: 2026-11-27T05:46Z
start_commit: ba62432
bug_class: Heisenbug as seen (travel per look set by touch timing under load); deterministic once the stroke has no momentum
---

## Current Focus

hypothesis: CONFIRMED (H1). In the check, not the product: readThrough looks once per finger stroke, a fixed 250 ms after the lift; how far a stroke carries the dialog depends on the momentum the browser derives from the timing of the check's synthetic touch events, which under load is large and still running at the look, so one look can land 330-518px past the previous one and skip every part whole only in between.
test: fix the check (no momentum, wait for rest, bounded), then unfixed vs fixed under RATE=6, 20 fixed runs.
expecting: unfixed fails some frame520px views under RATE=6; fixed passes 20 of 20 under the same.
next_action: edit readThrough in email-dialog.js: finger held still 200 ms before lifting; after each stroke or wheel notch wait until the body's scrollTop is unchanged for 5 animation frames (5 s bound, clear message); missed parts reported with their whole-range and the looks.

reasoning_checkpoint:
  hypothesis: "frame520px misses a part because readThrough samples once per stroke after a fixed 250 ms, and a stroke's travel (120px drag + browser momentum from the touch velocity) exceeds the part's slack (window 391px minus its height: 234px for the 157px paragraph) when the touch events reach the page bunched under load; the dialog itself shows every part whole at positions between the looks"
  confirming_evidence:
    - "rate6-unfixed: looks at 150 then 480 (330px) skip the paragraph whole only for 152..386; scroll events at 165..373 had it whole; same FAIL line as the saved failures"
    - "rate6-unfixed10: looks at 324 then 842 (518px) skip inv8-raw and two paragraphs; the momentum after the lift is visible in the scroll events (44-51px per frame)"
    - "unloaded run0: ~140px per look, 35px momentum dying within 200 ms; pass"
    - "every failing run passes 'card shows all of its content' and 'reaches its end'; every target is shorter than the window"
  falsification_test: "if the fixed check (no momentum, look only at rest) still misses a part under RATE=6, or a look-to-look travel exceeds ~120px, the hypothesis is incomplete (e.g. a stroke applied late, or a real clip)"
  fix_rationale: "with the finger held still before it lifts, the browser starts no momentum, so every stroke moves the body by the finger's 120px whatever the timing; waiting for the body to stop moving replaces the 250 ms guess; then looks are at most ~120px apart, under every part's slack (234px at the smallest), at every load"
  blind_spots: "Chrome's velocity tracker internals (assume-stopped ~40 ms, horizon ~100 ms) are inferred, verified only by traces; a future taller paragraph (slack under 120px) could again fall between looks: the failure detail will then name the range and the looks; real-font layout in production (fonts are empty in the check) is not exercised here"
  candidate_causes:
    - "code (check): one look per stroke after a fixed 250 ms while momentum carries the body an uncontrolled distance (confirmed)"
    - "code (product): the dialog clips a paragraph on a phone when slow (eliminated: card scrollH = clientH in every failing run, every target shorter than the window, scroll events show each missed part whole)"
    - "environment: CPU load changes the touch events' timing and so the momentum (the trigger, not a cause to fix)"
    - "data: a web font swapping late and reflowing (eliminated for the check: fonts.googleapis.com answered with an empty stylesheet)"
  and_gate: "yes: needs the check's sparse sampling (code) AND load-driven momentum (environment); removing the momentum and looking only at rest removes the failure at any load"

## Symptoms

expected: EMAIL DIALOG: PASS (parts run: 3) on every run, loaded or not.
actual: under load the phone part fails one assertion: "every paragraph of the email, its footer and the buttons were seen whole (n of 11)"; a rerun unchanged passes.
errors: (saved outputs in the scratchpad)
  exec-10-14/gate/email.txt:  FAIL phone phone-390x844-frame520px: ... seen whole (7 of 11) :: ["inv8-raw: http://127.0.0.1:41725/diy.html?tenant=k","p: This link is personal to you; please do ","p: Questions? Contact Kestrel Bay Investor ","email-foot: Kestrel Bay Capital Management, LLC"]
  exec-11-04/gate/email.txt, exec-15-02/gate/email.txt, exec-15-02/email-run4.txt:  FAIL phone phone-390x844-frame520px: ... seen whole (10 of 11) :: ["p: The link below takes you through everyth"]
  (exec-11-14 gate runs 1 and 2 failed; their email.txt was overwritten by the passing run 3)
reproduction: run the check (--only phone) under CPU throttling (CDP Emulation.setCPUThrottlingRate) or beside other browser checks through heavy.sh.
started: seen in the gates of 10-11, 11-15, 14-01, 11-14 (twice).

## Eliminated

## Evidence

- timestamp: 2026-11-27T05:40Z
  checked: worktree HEAD
  found: HEAD = ba62432 (docs(11): after 11-14; EMAIL DIALOG flake noted), equal to the required commit; no reset needed. Start commit ba62432.
  implication: fresh tree.

- timestamp: 2026-11-27T05:42Z
  checked: every saved email.txt in the scratchpad with a FAIL line (4 files)
  found: every failure is the same view, phone-390x844-frame520px (the phone at 390x844 with the framed page 520px tall), and the same assertion. In every failing run the other phone assertions pass, including "scrolling the dialog (finger) reaches its end (964 of 964px)" and "the email card shows all of its content (card 756px tall for 756px of email)". The phone at frame 100% and both desktop views never failed in the saved outputs.
  implication: the dialog reaches its end and the card is not clipped in the failing runs; the misses are parts the finger-scroll skipped between two looks. Points at the sampling in readThrough (finger gesture then a fixed 250 ms wait, then one look), not at clipping.

- timestamp: 2026-11-27T05:44Z
  checked: email-dialog.js readThrough (lines 96-134) and the product's dialog CSS (portal.css .dlg / .dlg-body, diy.css .inv8-email, console.css .dlg-email)
  found: the check takes ONE look per gesture: a finger drag (touchStart, 8 touchMoves of 15px, touchEnd, sent by CDP without timestamps) then a fixed waitForTimeout(250) then inViewNow. A target counts only if it is whole at one of those looks. How far the body travels between two looks is not controlled: the drag plus whatever momentum (fling) the browser adds from the touch velocity, until the next touchStart stops it. Product: .dlg max-height calc(100dvh - 40px), the .dlg-body scrolls (overflow:auto), the card keeps its full height (flex-shrink:0). The check routes fonts.googleapis.com to an empty stylesheet, so no web font loads or swaps during the check (fonts are not a factor in the check).
  implication: a target is missed whenever one gesture carries the body past the whole window in which that target is whole. Under load, the time from touchEnd to the look (and to the next touchStart that stops a fling) grows, so momentum carries further.

- timestamp: 2026-11-27T05:37Z
  checked: unfixed check (frozen copy emflaky/base/email-dialog.js, sha256 6408d7a9...), part phone once, traced, through heavy.sh, load average 6.8-8.2 on 4 cores (scratchpad emflaky/run0/run.txt)
  found: PASS 11 of 11 in both frames. Frame 520px: body 391px visible (dialog 480 = head 89 + body 391), content 1336px, max scrollTop 945. Targets by content offset: p "Dear Dana" 294..316, p "Kestrel Bay Capital has invited" 329..374, p "The link below takes you through" 386..543 (157px, the tallest), p "Have a government-issued photo" 554..599, p "Set up your account" 611..649, inv8-raw 661..719, p "This link is personal" 731..798, p "Questions? Contact" 810..877, email-head 205..275, email-foot 897..941, inv8-actions 1122..1258. Every target is shorter than the 391px window: each one CAN be seen whole. Looks at scrollTop 0, 156, 261, 398, 535, 674, 817, 945, 945: each gesture moved 105-143px. The scroll events show each drag (15px steps ~33 ms apart) followed by ~35px of momentum dying out within ~200 ms, before the look.
  implication: unloaded, the travel per look (~140px) is well under the slack of the tallest target (391 - 157 = 234px), so nothing is skipped.

- timestamp: 2026-11-27T05:39Z
  checked: unfixed check, part phone 3 times in one browser, CDP Emulation.setCPUThrottlingRate 6 on every page (trace.js RATE=6), outside the queue, load average 7.3-8.0 on 4 cores (scratchpad emflaky/rate6-unfixed/)
  found: COUNTS rate6-unfixed frame520px: pass=2 fail=1 of 3; framefull pass=3 of 3. The failing view: "FAIL phone phone-390x844-frame520px: ... seen whole (10 of 11) :: ["p: The link below takes you through everyth"]", character for character the saved failure of exec-11-04, exec-15-02 (gate and run4). Its trace: looks at scrollTop 0, 150, 480, 613, 885, 964, 964. Gesture 2 carried the body 330px (150 -> 480): its touchMoves reached the page bunched (scroll events 15-36px apart every ~16 ms instead of 15px every ~33 ms unloaded), and momentum went on after the lift: the look at page time 5639 read 480 while the body was still moving (487 at 5663, 494 at 5672, then the next drag). The 157px paragraph is whole only for scrollTop 152..386: the look at 150 missed it by 2px, the next look was at 480. All other assertions passed (card 756px for 756px, end reached 964 of 964).
  implication: H1 reproduced: the check looks once per gesture after a fixed 250 ms; how far a gesture carries the body depends on how the browser times the synthetic touch events (momentum from their velocity), and under load the look is taken mid-momentum and 330px further on. The product layout did not clip anything: every target is shorter than the window, and the paragraph scrolled through whole positions between two looks (scroll events at 165..373 all had it whole). The misses in the saved failures need travel between two looks of >= 235px (10 of 11, the 157px paragraph, window of scrollTop 152..386) and >= 570px (7 of 11: inv8-raw, two paragraphs and the footer, whole only for scrollTop 328..897, all skipped by one jump). The 4 of 11 run needs a still larger jump. Layout clipping is not needed to explain any saved failure.

- timestamp: 2026-11-27T05:43Z
  checked: unfixed check, part phone 10 times in one browser, RATE=6, outside the queue, 05:40:12-05:42:50 UTC, load average 5.7-9.8 on 4 cores (scratchpad emflaky/rate6-unfixed10/)
  found: COUNTS rate6-unfixed10 frame520px: pass=8 fail=2 of 10; framefull pass=10 of 10; no other FAIL line. Failures: "(8 of 11) :: [inv8-raw, p: This link is personal, p: Questions? Contact]" (looks at scrollTop 0, 324, 842, 964: stroke 2 carried the body 518px; its scroll events climb 449, 493, 544, 572 ... 842 in ~250 ms after the lift, i.e. momentum of ~2000 px/s; all three missed parts were whole at scroll events 352..661) and "(10 of 11) :: [p: The link below takes you through]" again. With the first batch: 3 of 13 unfixed frame520px views fail under RATE=6; 0 of 13 framefull (its window is 715px, slack 558px).
  implication: the RED reproduces the two saved signatures (10 of 11; and the 7-of-11 family: the parts between scrollTop ~330 and ~900 jumped). The failing quantity is the travel between two looks, set by momentum the check does not control.

- timestamp: 2026-11-27T05:45Z
  checked: product dialog opening (assets/js/app.js dialog(): innerHTML, showModal, focus the first [autofocus] or button) and the CSS for any dialog animation
  found: no opening animation or transition on .dlg; the email card and body are laid out once; first look in every trace is at scrollTop 0 with the same target offsets as at the end.
  implication: no layout settling after the open to wait for in the check; the only moving thing is the scroll itself.

- timestamp: 2026-11-27T05:48Z
  checked: the fix (email-dialog.js readThrough only, working tree saved as a wip commit): each finger stroke = touchStart, the same 8 touchMoves of 15px, the finger held still 200 ms, touchEnd; every look (the first, and after every stroke or wheel notch) waits for atRest(): the body's scrollTop unchanged over 5 animation frames, bounded 5 s; the fixed 250 ms and 60 ms waits are gone. New check line "<view>: the dialog came to rest after every finger stroke|wheel notch before it was looked at (within 5 s each)". The "seen whole" detail now names each missed part with its height, the window and the scrollTop range in which it is whole, plus every look's scrollTop. Its pass condition is unchanged: every one of the 11 (10 for tax-request) targets whole at some look.
  found: fixed check, part phone 3 times, RATE=6, outside the queue, load average 3.6-6.3 (scratchpad emflaky/rate6-fixed3/): COUNTS frame520px pass=3 of 3, framefull pass=3 of 3. Looks at scrollTop 0, 113, 225, 337, 450, 555, 667, 779, 884, 945, 945: 94-113px per stroke in every view; the scroll events show each stroke's last event inside the drag (e.g. 113 at 5124, next event 5519 at the next stroke): no momentum after the lift, even when touchMoves reached the page bunched (22-30px jumps).
  implication: travel per look is now the finger's travel, independent of timing, under every part's slack (234px at the smallest). Falsification test passed so far; next the 20-run proof.

## Resolution

root_cause:
fix:
verification:
files_changed: []
