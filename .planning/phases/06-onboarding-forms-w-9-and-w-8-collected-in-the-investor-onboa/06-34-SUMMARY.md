---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 34
status: in progress (written as it goes; owner check pending)
---

# Phase 6 Plan 34: one tax form per investor (walkthrough-2 N1) and no investor stuck on an agreement this browser lost (failure 1)

## Failures first

(filled in as the run goes)

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

<!-- gsd:write-continue -->
