---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 34
subsystem: tax forms (onboarding.js, esign.js), console import (invitations.js), requests (operations.js, console.js)
tags: [walkthrough-2, N1, failure-1, B1, B2, tax-form, lost-file, sandboxed-iframe, iphone]
requires: [06-WALKTHROUGH-2, 06-32]
provides:
  - "one tax form per investor in Documents, the console and the record: the signed one when there is one"
  - "a replaced signed tax form kept as superseded with its signed copy (B1)"
  - "Continue and sign later on an agreement this browser lost; re-issue when the firm adds it again"
  - "an unsigned subscription is never approved or funded (B2)"
  - "checks/record-and-lost-agreement.js (7 parts)"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/record-and-lost-agreement.js
  modified:
    - assets/js/esign.js
    - assets/js/onboarding.js
    - assets/js/invitations.js
    - assets/js/operations.js
    - assets/js/console.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/signing-documents.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
status: complete (awaiting owner check)
actuals:
  tokens: 28600
  tasks: 3
  commits: 13
plan_head_before: 12c55c992fdcf7fe7c4f198ea5b5ea687aab3b6f
---

# Phase 6 Plan 34: one tax form per investor (walkthrough-2 N1) and no investor stuck on an agreement this browser lost (failure 1)

## Failures first

1. **My first B2 rule was wrong and broke the normal path.** B2 says "refuse a subscription whose `r.envelopeId` has no
   `r.signedAt`". esign.js sets `signedAt` only once everyone has signed, i.e. after the firm countersigns; the firm approves
   *before* it countersigns. Taken literally the rule refused every normal approval: the first GREEN run failed lost-phone and
   lost-desktop at "B2: once the investor has signed, Approve works" (toast "The subscription agreement is not signed yet."
   with the investor signed). Fixed: the investor's own signer on the request's envelope decides (`signedAt` still counts,
   which the server-mode import sets from the investor's signature). The check's own line that wanted `signedAt` right after
   the investor signed was wrong for the same reason and was corrected.
2. **Existing checks that encoded the defects failed on the fix and were changed, each with the reason written above it:**
   - forms-flow `editsigned`: the last two checks required both W-9s to stay listed and nothing voided (the duplicate). Now:
     the record and Documents keep the earlier signed form; the new unsigned one is voided with the reason, files gone.
   - forms-flow `unsigned`: "the finished form is kept in Documents (one entry)" listed an unsigned form under "Signed
     documents" with a "_signed" name. Now: not listed, its finished copy kept with its envelope.
   - forms-flow `flowTaxEnv` (used by `backup`): it read the finished form through its Documents listing; now from the
     envelope's own copy (the same file for a signed form).
   - signing-documents `lost-files` and `viewer`: they open "the signed W-9" but walked with the W-9 finished unsigned; they
     now sign it on the way. Their assertions are unchanged.
   - signing-documents `countersign`: its "agreement with no field for the firm" sub-case approved a subscription the investor
     had never signed. Now: Approve is refused first (a B2 line), the investor signs, then it is recorded (the portal's
     automatic acceptance or Countersign).
   - status-flow `back`: it approved an unsigned subscription to make it "no longer pending"; it now declines it (same test).
   The signing-documents `lost-files` part never asserted "Back only", so nothing there needed changing for the new button.
3. **A run of mine raced itself.** I started a second full forms-flow while the final batch's forms-flow was still running,
   both writing the same output file, and my wait loop read an older file. I stopped both and reran forms-flow alone (the
   line below is from that clean run). One earlier `backup` failure ("no stored form") came from the run before the
   flowTaxEnv change; the case passes alone on the fix.
4. **console.js was touched (one line), against the plan-check note.** B2 asks that the Requests row read "Agreement not
   signed"; that row is drawn in console.js, which 10-07 edits. The change is one expression in the requests view (line
   ~2113). `git merge-tree HEAD origin/wip/10-07` auto-merges console.js cleanly (its only conflict is
   server/lib/help-guide.mjs, which this plan does not touch). The approval rule itself is in operations.js as asked.
5. **Plan deviation: import-desktop cannot run in the refusing frame**: it needs the integration server. It runs on the
   server-mode harness (console and device reach nothing but the integration server, asserted). server-mode.js gained a
   module export (run directly it is unchanged) so the harness could be reused.
6. **Not tested:** real WebKit / the iPhone (Chromium with the iPhone size, touch and user agent stands in), the Claude app's
   own frame. The re-issue in server mode (the console re-adding an agreement for a device subscription) is not covered.
7. **The owner has not checked any of this.** Screenshots: SCRATCH/exec-06-34/owner/index.txt.

## RED on the base (12c55c9), produced before any product change

Run from a copy of the base tree (git archive of 12c55c9, the check and server-mode.js's export added), so the edits in the
worktree could not leak into the RED run:
`RECORD AND LOST AGREEMENT: FAIL (parts run: 7) - request-desktop, request-phone, unsigned-twice-desktop, signed-kept-desktop, import-desktop, lost-phone, lost-desktop`
(111 PASS, 35 FAIL). The FAIL lines, verbatim (cut at 330 characters):

```
FAIL request-desktop a W-9 finished without a signature is not published to Documents (no listing, no "_signed" file name) :: [{"id":"env-mwoea13vco7aa-signed","envelopeId":"env-mwoea13vco7aa","title":"Form W-9 - Bartholomew Achterberg","fileName":"Form_W_9_Bartholomew_Achterberg_signed.pdf"}]
FAIL request-desktop Documents before the request: no tax form row under "Signed documents" :: {"taxRows":["Nov 20, 2026 Form W-9 - Bartholomew Achterberg Form_W_9_Bartholomew_Achterberg_signed.pdf · with certificate of completion Download"],"signedSection":true,"opens":[{"text":"Form W-9 - Bartholomew Achterberg","id":"env-mwoea13vco7aa-signed"}]}
FAIL request-desktop the earlier unsigned W-9 is voided with "Replaced by the Form W-9 … on <date>" :: {"id":"env-mwoea13vco7aa","status":"completed","investorSigned":false,"voidReason":"","supersededBy":"","supersedeReason":"","sha256Signed":"df4c150bda5d9d1006622c2d1e88a46065b2f1798b593afba565d63a69614493","files":{"-orig":true,"-work":true,"-signed":true}}
FAIL request-desktop the earlier unsigned W-9’s files (filled form, work and signed copies, which hold the taxpayer ID) are gone :: {"-orig":true,"-work":true,"-signed":true}
FAIL request-desktop the change log says the tax form was replaced :: ["Tax form completed without a signature: Bartholomew Achterberg: Form W-9 (Rev. March 2024)","Invitation to subscribe finished: Bartholomew Achterberg: subscription of $100,000 submitted from the invitation link; Form W-9 not signed","Tax form requested: Bartholomew Achterberg (bartholomew.achterberg@example.com): Form W-9, the
FAIL request-desktop the workspace holds exactly one tax listing for this investor, the signed one :: [{"id":"env-mwoea13vco7aa-signed","envelopeId":"env-mwoea13vco7aa","title":"Form W-9 - Bartholomew Achterberg","fileName":"Form_W_9_Bartholomew_Achterberg_signed.pdf"},{"id":"env-mwoea56gubfln-signed","envelopeId":"env-mwoea56gubfln","title":"Form W-9 - Bartholomew Achterberg","fileName":"Form_W_9
FAIL request-desktop Documents lists exactly one "Form W-9 - Bartholomew Achterberg" row :: {"taxRows":["Nov 20, 2026 Form W-9 - Bartholomew Achterberg Form_W_9_Bartholomew_Achterberg_signed.pdf · with certificate of completion Download","Nov 20, 2026 Form W-9 - Bartholomew Achterberg Form_W_9_Bartholomew_Achterberg_signed.pdf · with certificate of completion Download"],"signedSection":true,"ope
FAIL request-desktop no "_signed" file name is listed for an unsigned form :: ["Nov 20, 2026 Form W-9 - Bartholomew Achterberg Form_W_9_Bartholomew_Achterberg_signed.pdf · with certificate of completion Download","Nov 20, 2026 Form W-9 - Bartholomew Achterberg Form_W_9_Bartholomew_Achterberg_signed.pdf · with certificate of completion Download"]
FAIL request-phone (the same eight lines for Ottoline Ferreira-Nakamura; first envelope env-mwoeafelbabbe, completed, investorSigned false, listed as Form_W_9_Ottoline_Ferreira_Nakamura_signed.pdf)
FAIL unsigned-twice-desktop a W-9 finished without a signature is not published to Documents (no listing, no "_signed" file name) :: [{"id":"env-mwoeau5funwx8-signed",…,"fileName":"Form_W_9_Cosima_Vald_s_Ruiz_signed.pdf"}]
FAIL unsigned-twice-desktop Documents before the request: no tax form row under "Signed documents"
FAIL unsigned-twice-desktop the earlier unsigned W-9 is voided with "Replaced by the Form W-9 … on <date>" :: {"id":"env-mwoeau5funwx8","status":"completed","investorSigned":false,"voidReason":"",…,"files":{"-orig":true,"-work":true,"-signed":true}}
FAIL unsigned-twice-desktop the earlier unsigned W-9’s files (filled form, work and signed copies, which hold the taxpayer ID) are gone :: {"-orig":true,"-work":true,"-signed":true}
FAIL unsigned-twice-desktop the change log says the tax form was replaced
FAIL unsigned-twice-desktop no tax listing for this investor (neither form is signed) :: [{"id":"env-mwoeau5funwx8-signed",…},{"id":"env-mwoeay76oiu1v-signed",…}]
FAIL unsigned-twice-desktop Documents lists no tax form row :: {"taxRows":["… Form_W_9_Cosima_Vald_s_Ruiz_signed.pdf · with certificate of completion Download","… Form_W_9_Cosima_Vald_s_Ruiz_signed.pdf · with certificate of completion Download"],…}
FAIL signed-kept-desktop the record still points at the signed W-9 (signed true) and it is on file :: {"form":"W-9","revision":"Rev. March 2024","envelopeId":"env-mwoeba696tqsz","at":"2026-11-20T03:04:34.570Z","signed":false,"signedBy":"","tinLast4":"","backupWithholding":false}
FAIL signed-kept-desktop the new unsigned W-9 is voided with "Finished without a signature; the signed Form W-9 on file stays" :: {"id":"env-mwoeba696tqsz","status":"completed","investorSigned":false,"voidReason":"",…,"files":{"-orig":true,"-work":true,"-signed":true}}
FAIL signed-kept-desktop the new unsigned W-9’s files are gone :: {"-orig":true,"-work":true,"-signed":true}
FAIL signed-kept-desktop one tax listing, the signed W-9 :: [{"id":"env-mwoeb56f2k0ut-signed",…},{"id":"env-mwoeba696tqsz-signed",…}]
FAIL signed-kept-desktop Documents lists exactly one "Form W-9 - Leopoldine Okonkwo-Hartmann" row, the signed one :: {"taxRows":["… Form_W_9_Leopoldine_Okonkwo_Hartmann_signed.pdf · with certificate of completion Download","… Form_W_9_Leopoldine_Okonkwo_Hartmann_signed.pdf · with certificate of co…
FAIL signed-kept-desktop the firm’s row reads "W-9 signed … Download" :: Leopoldine Okonkwo-Hartmann Leopoldine Okonkwo-Hartmann · leopoldine.okonkwo@example.com Individual $0 0 investments Active since Nov 20, 2026 W-9 not signed Check Account Request tax form View portal
FAIL import-desktop the console lists exactly one tax form for the investor, the new one :: [{"id":"env-taxold-check-signed","envelopeId":"env-taxold-check"},{"id":"env-mwoebg7m582s1-signed","envelopeId":"env-mwoebg7m582s1"}]
FAIL import-desktop B1: the earlier signed W-9 is kept as superseded (by the new one, with the reason), not voided or deleted :: {"status":"completed","supersededBy":"","reason":"","voidReason":""}
FAIL import-desktop B1: the earlier signed copy is still stored on the console, and not listed :: {"file":true,"docs":[{"id":"env-taxold-check-signed","envelopeId":"env-taxold-check"},{"id":"env-mwoebg7m582s1-signed","envelopeId":"env-mwoebg7m582s1"}]}
FAIL import-desktop the change log says the tax form was replaced
FAIL lost-phone the step offers a primary "Continue and sign later" :: [{"text":"Back","primary":false,"action":"ivf-back"}]
FAIL lost-desktop the step offers a primary "Continue and sign later" :: [{"text":"Back","primary":false,"action":"ivf-back"}]
```

**What the RED lines confirm (the plan's root cause):**
1. The W-9 finished without a signature is completed and listed: `env-mwoea13vco7aa` has `investorSigned: false` and is listed
   as `Form_W_9_Bartholomew_Achterberg_signed.pdf` before the request (esign.js finishSigning publishes every completed
   envelope with an investor signer).
2. After the request and the signature there are two listings, `env-mwoea13vco7aa` (no signature) and `env-mwoea56gubfln`
   (signed), and two identical rows on screen: nothing retires the earlier tax form (onboarding.js taxSigned only points
   i.taxCert at the newest).
3. signed-kept: an unsigned new form replaced the signed one in the record (`"signed": false` on `env-mwoeba696tqsz`), so the
   firm's row says "W-9 not signed" and offers "Request tax form" while a signed W-9 exists.
4. import-desktop: the console's import listed the new signed form beside the earlier signed one (two Tax listings).
5. lost-*: the agreement step offers Back only. The lost parts stop there on the base, so the B2 lines (Approve refused,
   "Agreement not signed") and the re-issue lines were not reached on the base; they are first measured on the fix.

Parts that passed lines on the base: the honest lost-file line, Back, no Finish/Decline (06-32), the signed W-9 opening and
downloading by the same SHA-256, and the import recording the new signed form as signed. These are behaviours that already
worked and must keep working.

## GREEN on the fix (verify lines, verbatim)

```
RECORD AND LOST AGREEMENT: PASS (parts run: 7)        180 PASS / 0 FAIL
RECORD AND LOST AGREEMENT: PASS (parts run: 2)        --only request-desktop,request-phone (Task 1 verify)
RECORD AND LOST AGREEMENT: PASS (parts run: 3)        --only unsigned-twice-desktop,signed-kept-desktop,import-desktop (Task 2)
FORMS FLOW: PASS (cases run: 4)                       --case editsigned,unsigned,edit,sign-w9, fix (75 PASS)
FORMS FLOW: PASS (cases run: 4)                       same cases on the base tree 12c55c9 (75 PASS; the old assertions encoded the old behaviour)
SIGNING DOCUMENTS: PASS (parts run: 8)                246 PASS / 0 FAIL
TAX REQUEST LEAVE: PASS (parts run: 5)                43 PASS / 0 FAIL
SERVER MODE: PASS (parts run: 15)                     461 PASS / 0 FAIL
STATUS FLOW: PASS (parts run: 2)                      --only back,erisa
server tests: # tests 368 / # pass 368 / # fail 0
FORMS FLOW: PASS (cases run: 34)                      983 PASS / 0 FAIL (full run, alone)
```

Owner-facing screenshots (failures first): SCRATCH/exec-06-34/owner/index.txt.

## What changed

**N1, listing half (esign.js finishSigning).** A completed tax envelope whose investor left every signature field empty gets
no Documents listing. The record, Account and the console keep saying "W-9 not signed".

**N1, record half (onboarding.js taxSigned, retireTax; esign.js retire).** One tax form per investor:
- a new signed form: every other tax form of the investor is retired and the record points at the new one;
- a new unsigned form while a signed form is on file (a signed envelope here, a signed record whose envelope this browser
  does not hold, or an uploaded form): the new one is retired with "Finished without a signature; the signed Form W-9 on
  file stays" and the record is unchanged;
- a new unsigned form over an unsigned one: the earlier is retired, the record moves to the new one.
Retiring (B1): a signed form is kept as `superseded` (supersededBy, supersededAt, supersedeReason, an event and a change-log
entry), its signed copy kept, only its listing and its drafts (filled form, work copy) removed; an unsigned form is voided
with the reason and every file of it deleted (they hold the full taxpayer ID). One change-log line per retired form
("Tax form replaced" / "Tax form kept") names the form, its date and the reason. E-sign shows "Superseded".

**Console import (invitations.js merge).** After the imported signed tax form is listed, every other tax form of that
investor held by the console is retired the same way (a signed one superseded and kept). Also: a device record that keeps a
signed form the console already holds is no longer marked "copy not received".

**Failure 1 (onboarding.js, esign.js).** `NS.esign.fileLost(env)`; on the agreement step, when the file is lost, a primary
"Continue and sign later" beside Back. It records nothing as signed, logs "Subscription agreement not shown: this browser
did not keep its file" (naming the investor, saying to add it again from the offering page), notifies the firm ("<investor>
could not see the subscription agreement", opening the offering page) and finishes the flow; the done screen reads "Thank
you. One document is still to sign" / "Your subscription is recorded. The subscription agreement could not be shown in this
browser, and <team> has been told. Once they add it again, it waits for your signature under Documents." When the firm saves
the agreement again, `reissueLost` gives every unsigned subscription of that offering whose own file this browser does not
have a new envelope from the saved agreement (prefilled as resign() does), points the request at it and voids the old one
with "This browser did not keep the agreement’s file; a new copy was prepared from the agreement added again". An envelope
whose file is here is untouched (asserted).

**B2 (operations.js decide, markFunded; console.js row).** An e-signature subscription whose investor has not signed is
never approved or funded ("The subscription agreement is not signed yet."); declining still works. The Requests row reads
"Agreement not signed" instead of "E-signed by …" while that holds.

## Decisions (owner may override)

- One tax form per investor; a form finished without a signature never replaces a signed one (the plan's decisions).
- An uploaded completed form counts as a signed form on file for that rule (left as it is, consistent with "uploaded forms
  are left as they are"); a legacy record with no signed flag does not, so it is replaced as before.
- B2 is judged by the investor's own signature on the envelope, not by `signedAt` (see failure 1).
- The superseded form's drafts (the filled form and the work copy) are deleted; its signed copy (with certificate) is the
  retained record.

## Files

- assets/js/esign.js, assets/js/onboarding.js, assets/js/invitations.js, assets/js/operations.js, assets/js/console.js (one line)
- checks: record-and-lost-agreement.js (new), forms-flow.js, signing-documents.js, status-flow.js, server-mode.js (export only)

## Gate line for the orchestrator

`RECORD AND LOST AGREEMENT (7)`: `node .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/record-and-lost-agreement.js`, last line `RECORD AND LOST AGREEMENT: PASS (parts run: 7)`. Server tests stay 368. The check needs server/node_modules (import-desktop starts the integration server).

## Commits

Every code change was saved in `wip(06-34): save` commits as it was made (owner's save rule), so the task commits are not
separate: 83f1dcc (the check, server-mode.js export), 0ddf1ee test(06-34) red evidence, then a5810c6, 6007a23, dc4746e,
c8eb6bd, b7e914f, 0a23968, 37cd87e, e8b7f7f, a70993d, 0f260c5 (product and check changes, in the order made), and the final
commit with this summary. Branch: wip/06-34.

## Self-Check: PASSED

The new check file exists; the 12 commits listed are ancestors of HEAD (git log 12c55c9..HEAD); RED (base) and GREEN (fix) outputs are in SCRATCH/exec-06-34/ (red.txt, green.txt, forms.txt, sigdocs.txt, taxleave.txt, srvmode.txt, statusflow.txt, server.txt).
