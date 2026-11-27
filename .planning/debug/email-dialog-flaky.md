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

## Resolution

root_cause:
fix:
verification:
files_changed: []
