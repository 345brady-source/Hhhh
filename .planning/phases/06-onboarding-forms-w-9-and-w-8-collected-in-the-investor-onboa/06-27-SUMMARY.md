---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 27
subsystem: sponsor console (invite form, list import, Invite again), investor short flow (investor on file), integration server (snapshot, submission, notices)
status: complete
tags: [tax-forms, w-9, d-10, d-09, d-30, d-06, c-03, server-mode, owner-decisions]
requires: [06-26]
provides:
  - "\"Include tax form\" box on the invite form (unticked, shown only while the email is an investor on file's) and on a list import that reaches an investor on file"
  - "invitation.includeTax (existing, with an offering): short flow welcome, status, tax, subscribe, agreement, done"
  - "\"Invite again\" keeps the cancelled invitation's choice; the investor's own portal entry points never add the tax step"
  - "server: includeTax and the 06-26 tax pre-fill kept for an invitation to subscribe of an investor on file only; tax envelope, signed copy or upload kept beside the subscription and agreement; sponsor notice row \"Tax form\""
  - "forms-flow case include-tax (34 cases); server-mode part include-tax (15 parts); server/test/invitations-includetax.test.mjs (197 server tests)"
affects: [phase 6 verification, owner check]
tech-stack:
  added: []
  patterns:
    - "a sponsor choice on an invitation to an investor on file adds one step to the short flow and reuses the 06-26 pre-fill and return path"
key-files:
  created:
    - server/test/invitations-includetax.test.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-27-SUMMARY.md
  modified:
    - assets/js/invitations.js
    - assets/js/onboarding.js
    - server/lib/invitations.mjs
    - server/lib/mail.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/deferred-items.md
decisions:
  - "The box shows only while the typed email belongs to an active investor (the only case where the short flow applies); it is shown or hidden in place while typing, with no re-render"
  - "List import: one box under the checked list, shown only when the list reaches an investor on file; it applies to those rows only (a new investor's onboarding has its tax step anyway); unticked again for each list checked"
  - "Invite again (a one-click button, no form): carries the includeTax choice of the cancelled invitation, as it already carries the offering, commitment and note"
  - "The tax step goes right before subscribe (after the accreditation and status steps); the tax form follows the investor's type on the record (taxFormFor), as for the 06-26 request"
  - "Server mode: includeTax is kept only for existing + offering + not a tax-form request; the pre-fill only for such an invitation or a 06-26 request; the console takes the returned form with the same checks as a request, and still imports the subscription and agreement"
  - "No new line on the investor's welcome or done screens (the new-investor done screen does not name the tax form either); the email names it in the list of what the link covers"
requirements: [FORM-01, FORM-02, FORM-03, FORM-05, FORM-06, FORM-08]
metrics:
  duration: "37 min, from recording the base (05:36:18 UTC) to the gate's end (06:13 UTC)"
  completed: 2026-11-16
  tasks: 3
  files: 9
actuals:
  tokens: 13530    # chars/4 over the 54,121 characters of added lines in c50cb7e..611aed4
  tasks: 3
  commits: 4       # git rev-list --count c50cb7e..HEAD before this summary commit
plan_head_before: c50cb7e6639d6db246491099effa6a53c89dc309
plan_head_after: 8cc0aa2325b696edfe9ecf1e75818cd3ae638e9a
---

# Phase 6 Plan 27: "Include tax form" when the sponsor invites an investor on file (D-10)

The sponsor can now tick **"Include tax form"** when inviting an investor already on file. The box starts unticked.

- **Ticked:** the investor's short flow is welcome, status, **tax**, subscribe, agreement, done. The tax step is the official form for the investor's type (D-09), pre-filled from the record. A U.S. individual is asked only for the taxpayer ID. The investor signs on the page or uploads a form, and nothing is required (D-30). The signed form reaches the record, the Investors row and its Download.
- **Not ticked:** the flow is unchanged.

The same box appears when an imported list reaches an investor on file. "Invite again" keeps the choice made on the cancelled invitation. The investor's own subscribe entry points in the portal never add the tax step. The managed edition has no box, and the C-03 guard stays green (STATUS MATH 13).

In server mode the choice travels in the snapshot with the 06-26 pre-fill. The signed W-9 comes back beside the subscription and the agreement, the device wipe applies, and the console imports the form byte for byte.

The owner has not checked any of this. Nothing here is ready until he has.

## Failures first

1. **No failure in the product or the final gate.** The gate passed on its first run (GATE_EXIT=0).
2. **My first GREEN run of include-tax failed because of a mistake in my check.** The product was fine. The sample offering is named "Kestrel Bay Fund II, L.P.", with a comma, and my pasted list did not quote it. Every row was refused as an unknown offering. As a result, the "list of new investors only shows no box" check passed in the RED run for the wrong reason. Commit f0b607c quotes the name, and both list checks then ran on valid lists.
3. **An unexplained failure in one run of the full server suite.** During development, one full run of the 197 server tests ended "# pass 196, # fail 1". I re-ran it to see which test had failed, and that run passed. Nine more full runs, the gate's run among them, all passed 197/197. I did not find which test failed or why. Load from other executors on this machine is a likely cause, but I have not proven it.
4. **RED runs that stopped part-way.** The local RED stopped at the missing box after 2 failures, by design: the walk cannot tick a box that is not there. Its later checks were first proven on the fix. Three server tests pass on the base: 2 (no box, no flag), 3 (no flag for a new investor or without an offering) and 6 (without the flag an investor on file's tax form is still dropped). They guard behavior that must not change.
5. **Not built (outside this task), logged in deferred-items.md.** For an investor on file, the invite form's "Investor type" select still shows, with the hint "Decides the tax form they are shown", but it does not apply to that investor. The tax step follows the type on the record. The investor can still switch forms on the tax step (D-09), so no wrong form is forced. Hiding the select would change the form beyond the one box D-10 asked for, so it is left for the owner.

## RED runs (quoted)

- **Local** (forms-flow include-tax on c714d43 code = base c50cb7e, red-local.txt):
```
PASS include-tax four active investors on file with no open invitation
PASS include-tax a new investor’s email shows no "Include tax form" box (their onboarding has the tax step anyway)
FAIL include-tax an investor on file shows one "Include tax form" box, unticked by default :: {"ids":["iv-contact","iv-last","iv-email","iv-type","iv-title","iv-off","iv-amt","iv-note"],"box":false,"checked":false,"label":""}
FAIL include-tax D-06 (the 06-15 standard): the only control added for an investor on file is that one box :: {"fresh":[...],"onFile":[...]}
FORMS FLOW: FAIL (cases run: 1) - include-tax
```
- **Server mode** (red-srv.txt): 17 PASS, 9 FAIL. Among them:
  - "the snapshot carries the flag, the offering and the form’s pre-fill" (the invitation had no includeTax).
  - "the device’s short flow is welcome, status, tax, subscribe, agreement, done" (seen: "Step 1 of 5: Welcome … Step 4 of 5: Subscription agreement").
  - "the console stored the signed W-9 …" (taxCert still `env-old-unsigned`, signed false).
  - The row "W-9 not signed".
  - The email without the tax form.
  - `SERVER MODE: FAIL (parts run: 1) - include-tax`.
- **Server tests** (red-unit.txt): `# pass 3`, `# fail 3`. Tests 1 (flag and pre-fill reach the link), 4 (signed form kept beside subscription and agreement) and 5 (upload / unsigned notice) failed.
- **GREEN** on 611aed4: include-tax 31 PASS / 0 FAIL; server-mode include-tax 26 PASS / 0 FAIL; server file 6/6.

## Gate

SCRATCH/exec-06-27/gate.sh is the 06-26 gate with this tree's counts. It covers the server tests, status-math, form-maps, forms-flow, status-flow and server-mode, then two persons, the owner walks and leak search, the owner's folder, and the phase-4 signing and phase-5 record checks run on the base tree (c50cb7e) and on this tree. Last lines verbatim (gate.txt):
```
GATE ok   server tests # fail 0
GATE ok   server tests 197
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
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
# tests 197
# pass 197
# fail 0
GATE_EXIT=0
```
- **Counts against the merged tree:**
  - status-math 13 (unchanged; the managed slice guard is green).
  - form-maps 3.
  - forms-flow 33 → 34 (+include-tax).
  - status-flow 26.
  - server-mode 14 → 15 (+include-tax).
  - server tests 191 → 197 (+6).
- **PASS lines, all with 0 FAIL:** forms-flow 983 (952 before, +31); status-flow 414 (unchanged); server-mode 461 (435 before, +26).
- **Owner walks:** walkA 13/0, walkB 10/0, walkC 17/0 and 17/0. The leak search passed (428 files, 569 commit messages).
- **Clean-up:** server/node_modules was linked for the runs only, never staged, and removed afterwards. My base-tree and base.tar copies were deleted after the gate.

## What the new checks measured

**forms-flow include-tax** (31 checks, local mode):
- **Invite form.**
  - A new investor's email shows no box.
  - An on-file investor's email shows one box, labeled exactly "Include tax form", unticked.
  - The only control added is `iv-includeTax`.
  - The next invitation starts unticked again.
- **Ticked invitation (Ingrid Achterberg-Sowell, U.S. individual, W-9 not signed on file).**
  - It is existing, marked includeTax, with the offering.
  - Steps are `welcome, status, tax, subscribe, agreement, done`.
  - The change log reads "Investor invited to subscribe … tax form included (Form W-9)".
  - The email lists "the offering documents, your tax form, your commitment and the subscription agreement".
- **Not ticked.** The invitation is unmarked, with steps `welcome, status, subscribe, agreement, done`, and the email does not mention a tax form.
- **The walk.**
  - Six steps: Welcome, Investor status, Tax certification ("Step 3 of 6"), Subscription, Subscription agreement, with no field error.
  - The W-9 asks only for the SSN. She signs, signs the agreement, and the subscription is submitted.
- **Record after.**
  - The W-9 signed on this invitation is on file.
  - Address and status are unchanged.
  - One pending subscription.
  - The log reads "Invitation to subscribe finished … subscription of $75,000 …; Form W-9 signed".
  - No full SSN is stored anywhere.
  - The row reads "W-9 signed <date>", and its Download has the stored copy's SHA-256.
- **List import.**
  - A list of new investors only shows no box.
  - A list with an investor on file shows one unticked "Include tax form".
  - Ticked, the on-file investor's invitation includes the tax step, and the new investor's invitation is unmarked.
- **Invite again.** It keeps includeTax for a cancelled invitation that had it, and does not add it to one that did not.
- **Investor's own portal subscribe entry point** (selfInvite, existing): no tax step.
- **Always.** The leak check passes, with no script error and no outside request.
- **Managed (C-03).** Its invite form has no box, and no "Include tax form" text.

**server-mode include-tax** (26 checks):
- **Console.** The invitation has the box ticked and goes to the integration server.
- **Snapshot.** It carries `includeTax: true`, `existing: true`, the offering, and the pre-fill address "73 Cottonwood Bend, Bozeman, MT 59715". It carries no tinLast4, no SSN digits and no bank fields. D-09: the type us-individual travels.
- **Device.**
  - Steps `welcome, status, tax, subscribe, agreement, done`, with "Step 3 of 6" on the tax step.
  - Only `ob-tin` is asked.
  - The completed tax envelope has this investor as its one signer, with a signed copy.
- **Server.** It holds the signed W-9 byte for byte beside the request and the agreement envelope.
- **After the confirmed send.** The device holds no file of the form, no Documents entry and no run of the SSN.
- **Console import.**
  - The signed W-9 is stored byte for byte, and the record is signed and on file.
  - The row reads "W-9 signed <date>", and its Download equals the device's bytes.
  - The request is imported pending, its qual deep-equals the server's copy, and the server copy is deleted (the common server-mode checks).
- **Emails.** The investor email names "your tax form". The sponsor notice has "Tax form: Form W-9, signed".
- **Always.** The leak check passes.

**server tests** (invitations-includetax.test.mjs, 6):
1. Flag and exact pre-fill reach the link, with no SSN or bank number. The email lists the tax form.
2. Without the flag: no pre-fill, and no tax form in the email.
3. No flag or pre-fill for a new investor or without an offering.
4. The signed form, its copy and one Tax listing come back with the subscription, the agreement and its file. The notice has "Tax form: Form W-9, signed".
5. An upload comes back ("uploaded"); an unsigned one is reported as "not signed".
6. Without the flag an investor on file's tax envelope and copy are still dropped.

## Screens to look at

SCRATCH = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad

- **Local** (SCRATCH/exec-06-27/checks-out/forms-flow/include-tax/):
  - include-tax-invite-form.png (the box under the email);
  - include-tax-email.png;
  - include-tax-w9-step.png ("Step 3 of 6: Tax certification", SSN only);
  - include-tax-w9-signing.png;
  - include-tax-done.png;
  - include-tax-console-after.png;
  - include-tax-list.png (the box under a checked list).
- **Server mode** (SCRATCH/exec-06-27/checks-out/server-shots/): include-tax-step.png, include-tax-done.png, include-tax-console.png.

I looked at the invite form, the W-9 step, the list and the server-mode done screen. They read plainly. The toasts ("Signed in as admin…") overlap some screenshots, as in earlier plans.

## New screen items, judged by the 06-15 standard (D-06)

| Screen | Item | Decision | Reason |
|---|---|---|---|
| console invite form | "Include tax form" box | keep | The owner's D-10 choice; one box and its label, shown only where it applies. |
| console list import | "Include tax form" box | keep | The same choice where a list reaches an investor on file; shown only then. |
| investor email | "your tax form," in the list of what the link covers | keep | Without it the email would understate what the link asks; a word in an existing sentence. |
| investor flow | tax step in the short flow | keep | What D-10 asks; the existing step, unchanged. |
| welcome / done | no new line | none added | The step list names the tax step; the new-investor done screen does not name it either. |

## Deviations from Plan

1. **[Rule 2 - Correctness] The completion notice, the sponsor email notice and the change log name the tax form.** The local completion notice and the "Invitation to subscribe finished" change-log entry append the form and how it came back. The server notice adds a "Tax form" row, and its closing sentence lists the tax form among what the console adds. Without these, the sponsor would not know whether the form came back. The 06-26 tax-request wording is reused (taxText).
2. **Invite again carries the choice.** It is a one-click button with no form. Keeping the cancelled invitation's choice is how it already treats the offering, commitment and note.
3. **Check fix** (Failures first, 2).
4. **Check support:** lib.js inviteFromConsole ticks the box when asked (a tree without it is left as it is). serverFlow takes `o.wantType` for the D-09 type check.
5. **Ledger and state.** `commits` was measured with git rev-list from SCRATCH/exec-06-27/base-commit.txt. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched, as instructed.

## TDD Gate Compliance

| Change | RED | GREEN |
| ------ | --- | ----- |
| "Include tax form" (local, server mode, server) | c714d43 (check fix f0b607c) | 611aed4 |

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new data in transit | assets/js/invitations.js, server/lib/invitations.mjs | An invitation to subscribe with "Include tax form" carries investor.taxPrefill: the address, the country, U.S./other citizenship, an earlier W-8BEN citizenship and the consent date (the 06-26 set). It is sealed at rest like every snapshot. The server keeps it only for existing + offering + includeTax, or a 06-26 request. It never carries a taxpayer ID or bank detail (server tests 1-3; server-mode snapshot check). |
| threat_flag: on-file import widened | assets/js/invitations.js merge, server cleanSubmission | For such an invitation, the investor on file's tax envelope, signed copy or upload is accepted with the same id, kind, signer, completed and PDF checks as a new investor's (06-22/06-23). Without the flag it is still dropped (server test 6). |

## Self-Check: PASSED

- **Files present:** server/test/invitations-includetax.test.mjs; assets/js/invitations.js and onboarding.js; server/lib/invitations.mjs and mail.mjs; checks/forms-flow.js, server-mode.js and lib.js; deferred-items.md.
- **Commits on HEAD:** c714d43, f0b607c, 611aed4, 8cc0aa2 (git rev-list c50cb7e..HEAD = 4, before this summary's commit).
- **Clean tree:** server/node_modules was removed and never staged. My base-tree and base.tar copies were deleted.
