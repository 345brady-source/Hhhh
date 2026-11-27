---
status: investigating
trigger: "EMAIL DIALOG (3) fails its phone part under load: 'n of 11 paragraphs seen whole' in the phone frame (4, 7 and 10 of 11 across runs) in the gates of 10-11, 11-15, 14-01 and 11-14 (twice); passes when rerun unchanged."
created: 2026-11-27T05:40Z
updated: 2026-11-27T05:40Z
start_commit: ba62432
bug_class: (to classify)
---

## Current Focus

hypothesis: (none yet)
test: gather initial evidence: saved failing outputs, the check's read-through loop, the dialog's layout
expecting: a place where the check reads the page before it settles, or a layout that clips when slow
next_action: read the dialog's CSS/markup and the check's readThrough sampling; reproduce with CPU throttling

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
  implication: unloaded, the travel per look (~140px) is well under the slack of the tallest target (391 - 157 = 234px), so nothing is skipped. The misses in the saved failures need travel between two looks of >= 235px (10 of 11, the 157px paragraph, window of scrollTop 152..386) and >= 570px (7 of 11: inv8-raw, two paragraphs and the footer, whole only for scrollTop 328..897, all skipped by one jump). The 4 of 11 run needs a still larger jump. Layout clipping is not needed to explain any saved failure.

## Resolution

root_cause:
fix:
verification:
files_changed: []
