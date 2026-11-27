---
status: investigating
trigger: "assets/js/invitations.js coMerge reads the co-investor's signing time from an object the signing step has already replaced, so the console never records that the co-investor signed; after every co-investor import the console cancels the finished sign-in (server 409) and the audit log gets 'Co-investor sign-in cancelled: ... had already ended on the server'; from the code the Investors row would show 'Sign-in emailed / in the server outbox' instead of 'Signed' (not yet captured in a run). Reported as a side finding of .planning/debug/coinvestor-server-flaky.md."
created: 2026-11-27T02:10:00Z
updated: 2026-11-27T02:10:00Z
start_commit: 47f25ae
bug_class: Bohrbug (deterministic, code reading; to confirm by run)
---

## Current Focus

hypothesis: CONFIRMED by the RED run (02:12Z): coMerge captures coS (signer object) before importSignature; applySignature replaces env.signers with new objects (Object.assign(env, next)), so si.signedAt = coS.signedAt reads the stale object and stays empty; coSweep then cancels the finished sign-in.
test: fix coMerge (read the co-investor's signer again from env after the import), rerun the RED parts.
expecting: both new assertions pass in cosign-desktop and cosign-phone; whole check 5 parts PASS.
next_action: edit invitations.js coMerge line 849 only; rerun co-investor-server.js --only cosign-desktop,cosign-phone.

reasoning_checkpoint:
  hypothesis: "si.signedAt stays empty because coMerge reads signedAt from coS, the signer object it found before importSignature; applySignature's Object.assign(env, next) puts a new signers array (deep copy, signed) on the same env, so coS is detached and unsigned; coSweep then sees !si.signedAt with an agreement that no longer waits for the co-investor and cancels the finished sign-in (409, 'had already ended' line); signInText shows the email/outbox line because si.signedAt is empty"
  confirming_evidence:
    - "RED run: signedAt '' on the record while the agreement's co-investor signer has signedAt 2026-11-27T02:11:13.889Z"
    - "RED run: POST .../cancel for that sign-in, cancelledAt set within the same Check now, audit 'Co-investor sign-in cancelled: ... had already ended on the server (the agreement no longer waits for the co-investor)'"
    - "RED run: row 'Co-investor: Theodora Mbeki-Larsen · Sign-in in the server outbox Nov 27, 2026'"
    - "code: esign.js 1333 deep copy, 1386 Object.assign(env, next); importSignature's s is signerById(env, id) === coS (envById returns the stored object)"
  falsification_test: "if, with coMerge reading the signer from env after the import, the record's signedAt is still empty, or a cancel is still sent, or the row still lacks 'Signed <date>', the hypothesis is wrong or incomplete"
  fix_rationale: "the stale reference is the cause; reading the co-investor's signer from env.signers after importSignature gives the signed object and its signedAt (the time the import stamped), so the record says the co-investor signed; coSweep's !si.signedAt guard and the removed hook's !si.signedAt guard then hold, so no cancel; signInText says 'Signed <date>'"
  blind_spots: "other stale-reference readers after applySignature in esign.js finishSigning paths (not this defect; grep shows invitations.js reads no other signer object across importSignature); the preview (no server) path has no coMerge and its row design (06-37) has no 'Signed' text: measured separately"
  candidate_causes:
    - "code (product): stale signer reference in coMerge (confirmed)"
    - "code (product): applySignature replacing env.signers by design (the work-on-a-copy rule; not changed: it is what keeps a failed stamp from touching the envelope)"
    - "data/server: the server's 409 on cancel (correct: the invitation is completed; a consequence, not a cause)"
    - "config/environment: none (the check's server has no SMTP, which only chooses 'outbox' vs 'emailed' wording)"
  and_gate: "no: the stale read alone empties signedAt in every import; coSweep's cancel follows deterministically from that"

## Symptoms

expected: after the co-investor signs on their own device and the console's Check now imports the signature, the Investors row says the co-investor signed (Signed <date>), the console records si.signedAt, and no cancel is sent for the finished sign-in.
actual: (reported from code and traces) si.signedAt stays empty; the console POSTs .../cancel right after every co-investor import (server 409); audit "Co-investor sign-in cancelled: ... had already ended on the server"; row text expected to read "Sign-in emailed / in the server outbox" (not captured yet).
errors: server 409 on POST .../cancel; audit "Co-investor sign-in cancelled: ... had already ended on the server".
reproduction: co-investor-server.js check (server mode), a co-investor signing flow; traces in scratchpad coflaky/run0-plain.txt (+15.53 s cancel) and e2-delay400.txt (+16.84 s).
started: since coMerge was written (to confirm with git log).

## Eliminated

## Evidence

- timestamp: 2026-11-27T02:10Z
  checked: worktree HEAD
  found: HEAD = 47f25ae (docs: state (coinvestor flake fixed; coMerge defect)), equal to origin/claude/refract-reskin; no reset needed. Start commit 47f25ae.
  implication: fresh tree.

- timestamp: 2026-11-27T02:20Z
  checked: assets/js/invitations.js coMerge (830-853), coSweep (786-818), coCancel (763-780), importCompleted (1541-1592); assets/js/esign.js importSignature (3157-3201), applySignature (1329-1386); assets/js/coinvestor.js signInText (76-91)
  found: coMerge takes coS = env.signers.find(co signer) before the import. importSignature finds the same object (s === coS), sets viewedAt/consentAt on it, then applySignature signs a deep copy (next) and ends with Object.assign(env, next): env keeps its identity but env.signers is now next.signers, new objects. coS is no longer in env.signers and was never marked signed, so `si.signedAt = coS.signedAt` stores undefined. In the same Check now, after the DELETE, coSweep reaches `si.serverId && !si.cancelledAt && !si.signedAt && !(held && waitingCo(held) ...)`: the agreement no longer waits for the co-investor (they signed), so coCancel runs: retireCo, si.cancelledAt = now, POST /v1/invitations/<id>/cancel; the server answers 409 (completed) and the catch logs "Co-investor sign-in cancelled: <account>: the link sent to <co-investor> had already ended on the server (the agreement no longer waits for the co-investor)". signInText (server kind) shows "Signed <date>" only when si.signedAt is set, so it falls through to "Sign-in in the server outbox <date>" (outbox, as the check's server has no mail settings) or "Sign-in emailed <date>".
  implication: H1 holds by code reading; deterministic (no timing involved). Other readers of si.signedAt: the removed hook (907, `!si.signedAt` -> it would also send a cancel when the co-investor is removed after signing) and coPrint (2819, the poll's change fingerprint). Bug present since 06-39 (git log -S: 3349687 wip(06-39)).

- timestamp: 2026-11-27T02:22Z
  checked: co-investor-server.js cosign() part (589-649) and press-and-co-investor.js co-link part (690-830)
  found: the server check never reads the Investors row or the audit after the co-investor's import (the row read at 636 follows a route change to the envelope and feeds only the white-label check). The preview check (no server) reads the row only before signing ("Sign-in link ready to send", "Sign-in sent <date>"). 06-37's plan defines the local (preview) row text as only "Sign-in link ready to send" / "Sign-in sent <date>"; 06-39's summary defines the server row text "Signed <date>" first.
  implication: no gate existed for this. RED goes into cosign() (desktop and phone): after the import, on Investors, the row says "Signed <date>", the record's signedAt equals the co-investor signer's, no POST .../cancel for that sign-in, no "Co-investor sign-in cancelled" audit line, no cancelledAt. Preview path to be measured by a run (row text after the co-investor signs).

- timestamp: 2026-11-27T02:12Z
  checked: RED, commit 3892ff7 (check only; product unchanged = 47f25ae's invitations.js), co-investor-server.js --only cosign-desktop,cosign-phone through heavy.sh, GATE_FRESH=1, the check's own server mode (in-process server/index.mjs, NODE_ENV=test, no SMTP settings, so emails go to the outbox), 02:03:00-02:11:37 UTC (scratchpad comerge/red/run.txt)
  found: "CO-INVESTOR SERVER: FAIL (parts run: 2) - cosign-desktop, cosign-phone"; 83 PASS, 4 FAIL, the 4 being the new ones:
    FAIL cosign-desktop after the import the investors row says the co-investor signed ("Signed <date>"), and the sign-in record has when they signed :: {"row":"Daniel Whitaker Daniel Whitaker · daniel.whitaker@example.com Co-investor: Theodora Mbeki-Larsen · Sign-in in the server outbox Nov 27, 2026 Individual $100,000 1 investment Active since Jan 24, 2022 ACH · Savings ••8756 Account View portal","signedAt":"","signer":"2026-11-27T02:11:13.889Z"}
    FAIL cosign-desktop the console sends no cancel for the sign-in the co-investor finished, and the audit has no "sign-in cancelled" line :: {"cancels":["POST http://127.0.0.1:39245/v1/invitations/ivt_u9_zuPfMy2Cx/cancel"],"cancelledAt":"2026-11-27T02:11:15Z","audit":["Co-investor sign-in emailed: Daniel Whitaker: Theodora Mbeki-Larsen <theodora.ml@example.net>, for Subscription Agreement - Daniel Whitaker: kept in the server outbox (no SMTP settings); the copy sent to the co-investor leaves out the taxpayer number","Co-investor sign-in cancelled: Daniel Whitaker: the link sent to Theodora Mbeki-Larsen had already ended on the server (the agreement no longer waits for the co-investor)"]}
    FAIL cosign-phone (same two, co-investor Ingrid Vasquez-Holm, row "... Co-investor: Ingrid Vasquez-Holm · Sign-in in the server outbox Nov 27, 2026 ...", signedAt "", signer 2026-11-27T02:11:32.867Z; cancels ["POST .../v1/invitations/ivt_g2kwRaYldqQt/cancel"], same "had already ended on the server" line)
  implication: SYMPTOM CONFIRMED BY RUN. The row says "Sign-in in the server outbox Nov 27, 2026" after the co-investor signed (the agreement's signer is signed at 02:11:13.889Z, the sign-in record's signedAt is empty), the console POSTs the cancel for the finished sign-in, sets cancelledAt, and logs "Co-investor sign-in cancelled: Daniel Whitaker: the link sent to Theodora Mbeki-Larsen had already ended on the server (the agreement no longer waits for the co-investor)". Every older assertion of both parts still passes, so the RED isolates this defect. No taxpayer-number pattern in the output (grep 0).

- timestamp: 2026-11-27T02:17Z
  checked: the fix, commit ebe8b55 (assets/js/invitations.js coMerge only, +3 -1: after importSignature the co-investor's signer is read again from env.signers; si.signedAt = its signedAt, or now if it were missing); npm --prefix server test on ebe8b55 (scratchpad comerge/server-tests.txt)
  found: "# tests 456", "# pass 456", "# fail 0".
  implication: server tests unchanged. Browser GREEN runs started (whole CO-INVESTOR SERVER; preview co-link-desktop with a temporary measurement probe, commit 733ff1f, to be removed).

- timestamp: 2026-11-27T02:17Z (run 02:13:28-02:16:44 UTC by the run's own clock)
  checked: GREEN, whole co-investor-server.js on ebe8b55 (fix + the RED assertions), through heavy.sh, GATE_FRESH=1 (scratchpad comerge/green-coserver/run.txt)
  found: "CO-INVESTOR SERVER: PASS (parts run: 5)"; 132 PASS, 0 FAIL (128 before + the 4 new); per part: cosign-desktop 44, cosign-phone 43, cosign-later 18, cosign-change-remove 14, cosign-forged 13. Now PASS: "cosign-desktop after the import the investors row says the co-investor signed ("Signed <date>"), and the sign-in record has when they signed", "cosign-desktop the console sends no cancel for the sign-in the co-investor finished, and the audit has no "sign-in cancelled" line", and the same two for cosign-phone. cosign-change-remove still cancels on a changed email and on Remove (its audit check passes); cosign-forged's replays still say "already signed" and "no longer out for signature".
  implication: the RED passes with the fix; nothing else in the check changed. The row's text matched /Co-investor: <name> · Signed [A-Z][a-z]{2} \d{1,2}, \d{4}/ and the record's signedAt equals the signer's.

- timestamp: 2026-11-27T02:20Z (run 02:14:19-02:19:13 UTC)
  checked: the no-server preview path, press-and-co-investor.js --only co-link-desktop on 733ff1f (fix + a temporary PROBE printing the Investors row, the local sign-in record and the co-investor audit lines right after the co-investor signed through their #co- link, before the countersign), heavy.sh, GATE_FRESH=1 (scratchpad comerge/preview-probe/run.txt)
  found: "PRESS AND CO-INVESTOR: PASS (parts run: 1)", 29 PASS (incl. "the co-investor signs, and the firm has the notification that they signed as co-investor"). PROBE: row "Marisol Quenneville Marisol Quenneville · marisol@example.org Co-investor: Theodora Mbeki-Larsen · Sign-in sent Nov 27, 2026 Individual $0 0 investments ..."; the local record { token, link, createdAt, expiresAt, sentAt, openedAt } (no signedAt field in this kind); audit lines only "Co-investor added", "Co-investor sign-in sent: ... from the sender's own email app", "Co-investor sign-in opened" (no cancel, no "not used").
  implication: the preview has no coMerge, sends nothing and logs no false cancel: that part is correct. But it does NOT behave the same: after the co-investor signed, its row still says "Sign-in sent Nov 27, 2026", while the server path (after the fix) says "Signed Nov 27, 2026". Cause: coinvestor.js signInText's local branch has only "Sign-in link ready to send" / "Sign-in sent <date>" / "Sign-in link expired" (06-37's design never had a signed state for the account-wide local link). Separate from the coMerge defect (a design gap, not a stale read). The owner's own walkthroughs run in the preview, so this is the row he would see. Decision: fix as its own atomic commit (coinvestor.js only; 08-09 does not touch coinvestor.js), RED first in press-and-co-investor.js co-link parts; the probe is replaced by that assertion.

## Resolution

root_cause:
fix:
verification:
files_changed: []
