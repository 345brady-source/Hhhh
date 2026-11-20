# Phase 08 Plan 17: evidence log (written as produced; the full summary replaces this at the end)

## Step 0 (G2)
- base commit 38ffa1203e1438a640a975df6de4f44f02cd997f; server suite `# tests 368`, `# fail 0` (base-count 368); phase-8 gate checks found: 3 (AML RECORD, PACKAGE INVITE, PACKAGE PANEL). Both numbers as the plan-check Info item expects (368 rather than the plan's 358: phases 06/09/10/11 merged since the plan was written).

## Task 1 RED (red.txt, unchanged invitations.js, 20 PASS / 10 FAIL)
```
FAIL package-used the old invitation is closed in the console :: {... "status":"sent", "emailStatus":"failed","emailError":"This package belongs to another invitation.","pkg":true ...}
FAIL package-used one new invitation for the same investor, offering, amount and class, with a new id
FAIL package-used the new invitation holds the package choice before it is sent :: {}
FAIL package-used the new invitation reads "Not sent yet" on the list ::
FAIL package-used on "All", the old invitation's row shows the server's sentence word for word :: ... Not sent yet ... Could not send: This package belongs to another invitation. Resend Cancel
FAIL package-used one audit entry "Invitation replaced" with the server's sentence :: 0
FAIL package-used sending the new one posts its own id as the client id, with the package :: null
FAIL package-used the server holds it with a new package of its own :: {"held":null}
FAIL package-used the balance dropped by exactly the tier's price ($99), one new entitlement, no payment to a card
FAIL package-used its row no longer reads "Not sent yet" ::
PACKAGE CONSOLE: FAIL (parts run: 1) - package-used
```
The set-up lines already passed on the base: "the real server stored it and paid its package from the balance", "sent again, the real server answered 409 package_used with a sentence of its own", "the refused send charged nothing".

## Task 1 verify (verify-1.sh, exit 0; tracer.txt 30 PASS, 0 FAIL)
```
PASS package-used every screen of this part: no vendor, library or forbidden word (leak check)
PASS package-used every screen of this part: no provider name or address (vendor scan)
PACKAGE CONSOLE: PASS (parts run: 1)
VERIFY1_EXIT=0
```

## Task 2 RED (red2.txt, against Task 1's commit b1c0ea8, 44 PASS / 7 FAIL)
```
FAIL credit-owed the single form: the box shown, switched off, unticked, with the server's price in its label :: {"present":true,"shown":true,"disabled":false,...}
FAIL credit-owed the single form: its one line is the server's sentence word for word :: {"line":"","OWED":"A refunded payment left an amount owed. Settle it before adding packages."}
FAIL credit-owed the single form: it cannot be ticked :: {... "disabled":false,"checked":true ...}
FAIL credit-owed "Send invitation" still sends: without the package (no flag, no client id), the real server holds it with none :: {"one":{"ticked":true, ... "emailStatus":"failed","emailError":"A refunded payment left a...
FAIL credit-owed the list form: the box shown, switched off, unticked, with the same sentence word for word :: {"shown":true,"disabled":false,...,"label":"Add verification package to 2 invitations ($38)","line":""}
FAIL returned the toast is the server's sentence alone, word for word :: {"shown":[..., "Could not resend: This invitation's package was returned. Send a new invitation."], ...}
FAIL returned the invitation's row shows the server's sentence alone, word for word :: {"line":[],"row":"... Sent Not opened yet ... In the server outbox Copy link Resend Cancel"}
PACKAGE CONSOLE: FAIL (parts run: 3) - credit-owed, returned
```
An earlier red2 run (red2-first.txt) failed credit-owed's probe on a check bug (the direct POST lacked firm.name; the server answered 400). Fixed in the check, then red2.txt was run again; the lines above are from that second run.

tier-mismatch already passed on Task 1's code (the row already shows `it.emailError`), so it is a guard. Mutation run (red2-mutation.txt: the row's Email column with `it.emailError` removed, reverted after):
```
FAIL tier-mismatch the invitation's row shows the server's sentence word for word and still reads "Not sent yet" :: Ottilie Varga ... Not sent yet The email could not be sent ... Could not send Resend Cancel
PACKAGE CONSOLE: FAIL (parts run: 1) - tier-mismatch
```

## Task 2 verify (verify-2.sh, exit 0; flow2.txt 81 PASS, 0 FAIL, no part kept from an earlier run)
```
PASS returned every screen of this part: no vendor, library or forbidden word (leak check)
PASS returned every screen of this part: no provider name or address (vendor scan)
PACKAGE CONSOLE: PASS (parts run: 4)
VERIFY2_EXIT=0
```
