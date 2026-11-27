---
status: investigating
trigger: "assets/js/invitations.js coMerge reads the co-investor's signing time from an object the signing step has already replaced, so the console never records that the co-investor signed; after every co-investor import the console cancels the finished sign-in (server 409) and the audit log gets 'Co-investor sign-in cancelled: ... had already ended on the server'; from the code the Investors row would show 'Sign-in emailed / in the server outbox' instead of 'Signed' (not yet captured in a run). Reported as a side finding of .planning/debug/coinvestor-server-flaky.md."
created: 2026-11-27T02:10:00Z
updated: 2026-11-27T02:10:00Z
start_commit: 47f25ae
bug_class: Bohrbug (deterministic, code reading; to confirm by run)
---

## Current Focus

hypothesis: coMerge captures coS (signer object) before importSignature; applySignature replaces env.signers with new objects (Object.assign(env, next)), so si.signedAt = coS.signedAt reads the stale object and stays empty; coSweep then cancels the finished sign-in.
test: run the co-investor-server.js check (its server mode) on the current tree and capture the Investors row text and the audit lines after the co-investor signs.
expecting: row says "Sign-in emailed / in the server outbox ..." (not "Signed ..."), and the audit holds "Co-investor sign-in cancelled: ... had already ended on the server".
next_action: read coMerge, coSweep, coinvestor.js signInText, esign.js applySignature, and the check's server mode.

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

## Resolution

root_cause:
fix:
verification:
files_changed: []
