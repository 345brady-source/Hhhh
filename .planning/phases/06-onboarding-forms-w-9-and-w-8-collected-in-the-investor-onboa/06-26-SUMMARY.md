---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 26
subsystem: sponsor console (Investors page, invitations), investor tax step (W-8BEN), integration server (tax-form request), signed record certificate, phase checks
status: complete
tags: [tax-forms, w-9, w-8ben, w-8ben-e, d-09, d-30, c-03, server-mode, owner-decisions, gap-closure]
requires: [06-25]
provides:
  - "Request tax form" on an active investor's row when the tax form is missing, not signed or "copy not received" (self-serve only)
  - invitation existing + taxRequest (no offering): the tax step and the done screen; the consent screen first only when no consent is on the record
  - NS.invitations.requestTax / openTaxRequest / taxFormFor; "Tax form requested" change-log entry and row line
  - server: taxRequest flag and investor.taxPrefill kept for such a request only; tax envelope / upload brought back; no agreement kept; emails and sponsor notice by form
  - W-8BEN country of citizenship asked (one country choice), pre-selected only from the investor's earlier W-8BEN (taxCert.citizenship)
  - tax-form certificates name the form ("the last page of the signed Form W-9"); console Type column shows the D-09 foreign type
  - status-math case managed (C-03 slice guard against base 414fd9a2, substituteW9() change accepted only where made)
  - forms-flow case tax-request (33 cases); server-mode part tax-request (14 parts); server/test/invitations-taxrequest.test.mjs (191 server tests)
affects: [phase 6 verification, owner check]
tech-stack:
  added: []
  patterns:
    - "a request for one document is an invitation to an investor on file whose flow holds that step only"
key-files:
  created:
    - server/test/invitations-taxrequest.test.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-26-SUMMARY.md
  modified:
    - assets/js/onboarding.js
    - assets/js/invitations.js
    - assets/js/console.js
    - assets/js/portal.js
    - assets/js/record.js
    - server/lib/invitations.mjs
    - server/lib/mail.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-math.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
decisions:
  - "A tax-form request is an invitation to the investor on file (existing: true) marked taxRequest with no offering, so it travels, expires, resends and imports like every other invitation"
  - "The request's steps are the tax step and the done screen. The signature uses the e-sign consent already on the investor's record (recorded on the form's envelope, as the welcome step does); only when none is on record is the consent screen shown first, because the signature needs it and an unconsented signing view has no way to finish unsigned (D-30)"
  - "Server mode: the snapshot of a request carries only what the form prints and the console holds (address, country, U.S./other citizenship, an earlier W-8BEN citizenship, the consent date); never a taxpayer ID or bank detail; the server drops this pre-fill from any other invitation"
  - "The console takes the request's tax form with the same checks as a new investor's (plans 06-22, 06-23); nothing else of the record changes; no subscription or agreement is imported from a request"
  - "One open request per investor: a second click reuses it (local: same link; server: resent with a new link)"
  - "W-8BEN line 2: always asked as one country choice; pre-selected only from the citizenship the investor gave on an earlier W-8BEN; the treaty country (line 9) still follows the residence"
  - "Console Type column: 'Foreign individual' / 'Foreign entity' for the D-09 foreign types, '<account> (foreign)' for another foreign account (a foreign joint account); U.S. investors unchanged"
requirements: [FORM-01, FORM-02, FORM-03, FORM-05, FORM-06, FORM-08]
metrics:
  duration: "56 min, from recording the base (02:53:38 UTC) to the gate's end (03:48 UTC)"
  completed: 2026-11-16
  tasks: 4
  files: 11
actuals:
  tokens: 22050    # chars/4 over the 88,199 characters of added lines in 2397f26..fe41c09
  tasks: 4
  commits: 7       # git rev-list --count 2397f26..HEAD before this summary commit
plan_head_before: 2397f266ac2320c5b7f9df1e53738021e43a700c
plan_head_after: fe41c0974ed3d97886d24d21e3432fa3b0a248ff
---

# Phase 6 Plan 26: Request a tax form again, ask the W-8BEN citizenship, restore the C-03 guard, and two small fixes

**1. Request a tax form again.** On the sponsor's Investors page, an active investor whose tax form is missing, not signed, or "copy not received" now has a "Request tax form" button. It makes one invitation for that investor, or reuses an open one. The invitation holds only the tax step and the done screen. The tax step is the official form for the investor's type (D-09), pre-filled from the record, signed on the page or uploaded. Nothing on it is required (D-30). The request is logged ("Tax form requested") and shown on the row.

It works in local mode and server mode. In server mode the request travels like any other invitation, the signed form comes back as in 06-22/06-23, and the device wipe applies. The managed edition has no button (C-03).

**2. W-8BEN citizenship.** The step now asks the country of citizenship as one country choice. It is pre-selected only when the investor gave it on an earlier W-8BEN. The residence country is never copied into line 2, and the treaty country still follows the residence.

**3. C-03 guard restored** as status-math case `managed`, and the gate now runs it (STATUS MATH 13).

**4. Small fixes.**
- Tax-form certificates now read "This certificate is the last page of the signed Form W-9." (or W-8BEN, W-8BEN-E).
- The console Type column reads "Foreign individual" for a foreign individual.

The owner has not checked any of this. Nothing here is ready until he has.

## Failures first

1. **No failure in the product or the final gate.** The gate passed on its first run (GATE_EXIT=0).
2. **My first GREEN run of tax-request failed on my own code, and I fixed the product.** The flow always started on "welcome" (`currentKey` defaulted to it), so the request opened on "Welcome, Theodora / Step 0 of 2". `currentKey` now starts on the flow's first step. Both tax-request runs then passed.
3. **One of my new server tests was wrong, and I fixed the test.** Its portal address contained "diy.html", which the email leak check reads. The address now uses portal.html, as invitations-existing.test.mjs does.
4. **RED runs that stopped part-way.**
   - The tax-request RED runs stopped where the "Request tax form" button was missing (local: after 2 FAILs; server mode: click timeout). Their later checks were first proven on the fix.
   - Server test 3 (the flag and pre-fill only for a request) passed on the base: the base already dropped both. It now guards the new allowance.
5. **The C-03 guard cannot fail on the current code**, because C-03 holds. Its RED is the missing case (`STATUS MATH: FAIL (cases run: 0) - unknown: managed`). It also checks itself in place: a one-character change, a second `substituteW9()`, and a changed `substituteW9()` each fail.
6. **Not built (outside this task):**
   - W-8 renewal at validUntil (the verifier noted it for later).
   - In server mode, a reused request is resent with a new link. That path is the existing resend and was not walked in a browser here.
   - The lean-check walks (status-flow `lean`, onboarding-items.json) do not cover the new request screens. I judged each new item by hand instead (table below).

## RED runs (quoted)

- **managed** (status-math of the base, red-managed.txt): `STATUS MATH: FAIL (cases run: 0) - unknown: managed`.
- **small fixes** (test 135ae62 on the base, red-t4.txt): 143 PASS, then
```
FAIL sign-w9 the certificate says it is the last page of the signed Form W-9, and does not call the form an agreement :: This certificate is the last page of the signed agreement.
FAIL us-individual the certificate says it is the last page of the signed Form W-9, ...
FAIL foreign-individual the certificate says it is the last page of the signed Form W-8BEN, ...
FAIL foreign-individual the console type column shows the investor type the sponsor chose (D-09): "Foreign individual", not "Individual" :: Individual
FAIL foreign-entity the certificate says it is the last page of the signed Form W-8BEN-E, ...
FORMS FLOW: FAIL (cases run: 4) - sign-w9, us-individual, foreign-individual, foreign-entity
```
  GREEN on 8d95edb: `FORMS FLOW: PASS (cases run: 5)`, 182 PASS (sign-w8ben added).
- **citizenship** (test b240066 on 8d95edb, red-t2.txt, red-t2-srv.txt):
```
FAIL foreign-individual the tax step asks the country of citizenship (one country choice, nothing chosen: ...) :: {"shown":["ob-ftin","ob-noFtin"],"citPick":"(no country of citizenship asked)"}
FAIL foreign-individual the step says the form is the W-8BEN, ... and no sentence takes the country where the investor lives as the citizenship :: ... It gives Germany, where you live, as your country of
FAIL foreign-individual investor.taxCert keeps the country of citizenship the investor chose (Austria), ...
FAIL foreign-individual line 2 country of citizenship (the country chosen): "Austria" prints inside its own field :: {"field":"f_2[0]","inside":"Germany"}
FAIL typed-route the tax step is the invitation's: ... not taking Belgium where she lives :: {"lede":"... It gives Belgium, w
FAIL tax-w8ben w8ben: the tax step asked the country of citizenship with nothing chosen; ... :: {"asked":"(not asked)","country":"Germany","treaty":"Germany"}
```
  The server-mode RED ran all 13 parts by mistake (`--part` instead of `--only`). It showed 12 parts passing and only tax-w8ben failing. GREEN on c2bcc70: 7 forms-flow cases (foreign-individual, typed-route, noftin, edit, editsigned, foreign, investor-type) 126 PASS; tax-w8ben 24 PASS.
- **tax request** (test 8f62e23 on c2bcc70):
  - Server (red-t1-unit.txt): `# pass 1`, `# fail 4`. Tests 1, 2, 4 and 5 failed; for example 4 failed with "the tax envelope comes back".
  - Browser:
```
FAIL tax-request the row of an investor whose W-9 is not signed reads "W-9 not signed" and offers "Request tax form" :: ...
FAIL tax-request the row of an investor whose signed W-8BEN was not received offers "Request tax form" :: ...
FORMS FLOW: FAIL (cases run: 1) - tax-request
FAIL tax-request tax-request: the row reads "W-9 signed, copy not received" and offers "Request tax form" :: ...
FAIL tax-request ran to the end :: locator.click: Timeout 30000ms exceeded.
SERVER MODE: FAIL (parts run: 1) - tax-request
```
  GREEN on fe41c09: tax-request 37 PASS, server-mode tax-request 20 PASS, server file 5/5.

## Gate

SCRATCH/exec-06-26/gate.sh: the 06-25 gate with this tree's counts. Last lines verbatim (gate.txt):
```
GATE ok   server tests # fail 0
GATE ok   server tests 191
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (33)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (14)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 191
# pass 191
# fail 0
GATE_EXIT=0
```
- **Counts against the merged tree:**
  - status-math 12 → 13 (+managed); form-maps 3; forms-flow 32 → 33 (+tax-request); status-flow 26; server-mode 13 → 14 (+tax-request).
  - server tests 186 → 191 (+5).
- **PASS lines, all with 0 FAIL:** forms-flow 952 (899 before), status-flow 414, server-mode 435 (414 before).
- **Owner walks:** walkA 13/0, walkB 10/0, walkC 17/0 and 17/0.
- **Leak search:** passed (426 files, 562 commit messages).
- **Clean-up:** server/node_modules was linked for the runs, never staged, and removed afterwards. My base-tree and base.tar copies were deleted after the gate.

## What the new checks measured

**forms-flow tax-request** (37 checks, local mode):
- **Rows.** "Request tax form" shows on these rows:
  - Theodora (W-9 not signed);
  - Zoë (W-8BEN signed, copy not received; Type column "Foreign individual");
  - an investor with no tax form and no consent on record.
  It does not show for an investor with a W-9 on file.
- **The request.** The email dialog asks for "your Form W-9" only, with no photo ID, bank, onboarding or subscription. One invitation is made (existing, no offering), with steps `['tax','done']`. "Tax form requested … Form W-9" is logged and the row says "Tax form requested <date>". A second click reuses the same invitation.
- **The investor (W-9).**
  - The link opens on "Step 1 of 2: Tax certification". One line reads "Kestrel Bay Capital asked you for your tax form; this link covers that form only." Only the SSN is asked; name and address come from the record.
  - She signs. The done screen reads "Thank you. Your tax form is complete / Your Form W-9 is signed. A copy of the signed form is in your Documents."
  - The record now holds the new signed W-9 (on file). The request is completed. Address, status and positions are unchanged.
  - "Tax form request finished … Form W-9 signed" is logged. No full SSN is stored anywhere.
- **The console after.** The row reads "W-9 signed <date>" with a Download whose SHA-256 equals the stored copy, and no button. The PDF's certificate says "signed Form W-9".
- **Zoë (W-8BEN).**
  - The step has Austria (her earlier answer) chosen. On the form, line 2 is Austria; street "Königsallee 27", city line "Düsseldorf 40212" and residence Germany come from the record; line 9 is Germany.
  - She finishes unsigned. The done screen says she finished without signing and the firm may ask again. The row reads "W-8BEN not signed" and offers the button again.
- **No consent on record.** The steps are `['welcome','tax','done']`. The welcome says "asks you for your tax form" and shows the consent.
- **Managed (C-03).** No "Request tax form" on its Investors page, even for an investor whose W-9 is not signed.
- **Always.** The leak check passes, with no script error and no outside request.

**server-mode tax-request** (20 checks):
- **Console.** Marisol's row reads "W-9 signed, copy not received". The request goes to the integration server (ivt_ id), is logged, and the server's email subject is "Kestrel Bay Capital: your Form W-9".
- **Snapshot.** taxRequest, no offering, and the address pre-fill. No taxpayer ID digits and no bank fields.
- **Device.**
  - Opens on "Step 1 of 2"; steps `['tax','done']`; only the SSN asked. She signs.
  - The done screen reads "Your Form W-9 is signed and sent to Kestrel Bay Capital."
  - The completion carried the completed tax envelope and copy, with no request and no agreement.
  - After the confirmed send there is no file of the form, no Documents entry and no run of the SSN on the device.
- **Server.** It holds the same bytes, with request null and envelope null.
- **Console import.** The bytes are equal; the record is signed and on file, and "received: false" is gone. The row reads "W-9 signed <date>" with a Download of the device's bytes and no button. The rest of the record is deep-equal to before, with no subscription added. The log shows "Tax form requested" and "Tax form imported". The server copy is deleted.

**server tests** (invitations-taxrequest.test.mjs, 5):
1. The flag and the exact pre-fill reach the link, with no SSN or bank number. The email asks for the Form W-9 only; the reminder subject starts "Reminder:".
2. The form follows the type: W-8BEN for a foreign individual, W-8BEN-E for a foreign entity.
3. Neither the flag nor the pre-fill travels with an invitation to subscribe or to a new investor.
4. The signed form comes back with one Tax listing. A sent agreement and its file are not kept. The sponsor notice reads "Dana Whitfield returned their Form W-9 / Tax form: Form W-9, signed".
5. An uploaded form comes back ("uploaded"). An unsigned one is reported ("finished your tax form request without signing").

**status-math managed** (12 checks): eight slices hash as at 414fd9a2. stepReview, validate and applyToInvestor are compared with substituteW9() turned back into the setting it replaced there. substituteW9() still returns the firm setting in the managed edition. The three self-tests pass.

## Screens to look at

SCRATCH = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad

- **Local request** (SCRATCH/exec-06-26/checks-out/forms-flow/tax-request/):
  - console before, the email, and the W-9 step;
  - the W-9 signing and done screens;
  - the W-8BEN step, the consent welcome, and the console after.
- **Server mode** (SCRATCH/exec-06-26/checks-out/server-shots/): tax-request-step.png, tax-request-done.png, tax-request-console.png.
- **W-8BEN citizenship question:** SCRATCH/exec-06-26/checks-out/forms-flow/foreign-individual/foreign-individual-answers.png
- **Owner's folder** (four signed forms re-made by this gate, with the new certificate wording and the citizenship question): SCRATCH/exec-06-26/owner/index.txt

I looked at the console row, the email, the W-9 step, the done screens (local and server) and the W-8BEN steps. They read plainly. One thing remains: the toasts ("Signed in as admin…") overlap some screenshots, as in earlier plans.

## New screen items, judged by the 06-15 standard (D-06)

| Screen | Item | Decision | Reason |
|---|---|---|---|
| tax (request) | "<Firm> asked you for your tax form; this link covers that form only." | keep | Without a welcome screen the investor needs to know why the page asks for a tax form. One line. |
| welcome (request, no consent on record) | "<Firm> asks you for your tax form. This link covers that form only." plus the consent | keep | The e-signature needs the ESIGN/UETA consent. Shown only when none is on record. |
| done (request) | Heading, one lede (signed / uploaded / not signed / none), copy or privacy line, questions line | keep | The investor needs to know whether the form went and what happens next; no other summary. |
| W-8BEN | "Country of citizenship" choice | keep | Line 2 of a form signed under penalties of perjury. The residence country is not always the citizenship. |
| W-8BEN | "It gives <country>, where you live, as your country of citizenship." | remove | It described an assumption that is no longer made. |
| header | "Tax form" instead of "Account setup" on a request | keep | A request does not set up an account. |

## Deviations from Plan

1. **[Rule 2 - Correctness] The consent screen when no consent is on record.** The task asked for the tax step and the done screen only. That is what an investor with e-sign consent on record gets (every investor onboarded through the portal). An investor added by hand with no consent gets the consent screen first. Without it the signing view shows its own consent card, which cannot finish unsigned (D-30). Checked in tax-request.
2. **[Rule 2 - Correctness] A foreign address on file split into the form's fields** (onboarding.js splitAddressFor). The old split read only U.S. addresses, so a request for a foreign investor would have put the whole address in the street line.
3. **[Rule 1 - Bug, found in my own GREEN] `currentKey` started every flow on "welcome".** It now starts on the flow's first step; it is unchanged for every flow that has a welcome step.
4. **Additions so the request reads right where it shows:**
   - the portal Investments banner ("asked you for your tax form" with a link) instead of "Continue account setup";
   - the invitations list "Tax form only";
   - the email dialog heading "Tax form request email";
   - the header note "Tax form".
5. **Server notice and reminder emails for a request**, so the sponsor is told which form came back and how.
6. **The C-03 guard covers applyToInvestor too.** It is the eighth slice, and the third place where the substituteW9() change was made. The other seven are the slices 06-15 removed.
7. **Check fix** (Failures first, 3), and the citizenship RED run of all 13 server-mode parts (Failures first, 4).
8. **Ledger and state.** `commits` was measured from SCRATCH/exec-06-26/base-commit.txt. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched, as instructed.

## TDD Gate Compliance

| Change | RED | GREEN |
| ------ | --- | ----- |
| C-03 guard (a check; its RED is the missing case) | 280f822 | 280f822 |
| certificate wording, Type column | 135ae62 | 8d95edb |
| W-8BEN citizenship | b240066 | c2bcc70 |
| request a tax form again | 8f62e23 | fe41c09 |

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new data in transit | assets/js/invitations.js, server/lib/invitations.mjs | A tax-form request's snapshot carries investor.taxPrefill: the address, the country, U.S./other citizenship, an earlier W-8BEN citizenship and the consent date. It is sealed at rest like every snapshot and readable with the invitation token. The server keeps it only for an existing + taxRequest invitation with no offering and drops it from any other. It never carries a taxpayer ID or bank detail (server tests 1 and 3; server-mode snapshot check). |
| threat_flag: on-file import widened | assets/js/invitations.js merge, server cleanSubmission | For a tax-form request, an investor on file's tax envelope, signed copy or upload is now accepted. It passes the same id, kind, signer, completed and PDF checks as a new investor's (06-22/06-23). Request and agreement envelope are dropped on both sides. |

## Self-Check: PASSED

- **Files present:** server/test/invitations-taxrequest.test.mjs; assets/js/onboarding.js, invitations.js, console.js, portal.js and record.js; server/lib/invitations.mjs and mail.mjs; checks/status-math.js, forms-flow.js and server-mode.js.
- **Commits on HEAD:** 280f822, 135ae62, 8d95edb, b240066, c2bcc70, 8f62e23, fe41c09 (git rev-list 2397f26..HEAD = 7, before this summary's commit).
- **Clean tree:** server/node_modules was removed and never staged. My base-tree and base.tar copies were deleted.
