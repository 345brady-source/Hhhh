---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 39
status: in progress
---

# Phase 06 Plan 39: co-investor sign-in with the integration server (draft, filled in as the work goes)

## RED on the base (57a26d8, the tree with 06-34, 06-37 and 06-38 merged), produced 2026-11-20

Base commit: SCRATCH/exec-06-39/base-commit.txt = 57a26d8. Check file f371adb, run on the unchanged product.
`checks/co-investor-server.js`: 24 PASS, 25 FAIL. Last line:

```
CO-INVESTOR SERVER: FAIL (parts run: 5) - cosign-desktop, cosign-phone, cosign-later, cosign-change-remove, cosign-forged
```

FAIL lines (cut at 260 characters):

```
FAIL cosign-desktop "Add co-investor" with the server connected opens the Account window, not the email to send by hand :: {"open":true,"h2":"Co-investor sign-in email","text":"Co-investor sign-in email\n\nSend it from your email app. The portal prepared it wi
FAIL cosign-desktop the sign-in record is the server kind, with no link token of its own and nothing sent yet :: {"name":"Theodora Mbeki-Larsen","email":"theodora.ml@example.net","signIn":{"token":"2Tx8VB8m7F3n8Dbd0FJ-RaDJAsvQIxqUEIxJ4qaZ-PE","link":"http://12
FAIL cosign-desktop the investors row says "Sign-in is emailed once Daniel Whitaker has signed" :: Daniel Whitaker Daniel Whitaker · daniel.whitaker@example.com Co-investor: Theodora Mbeki-Larsen · Sign-in link ready to send Individual $100,000 1 investment
FAIL cosign-desktop ran to the end :: page.click: Timeout 30000ms exceeded.
FAIL cosign-phone "Add co-investor" with the server connected opens the Account window, not the email to send by hand :: {"open":true,"h2":"Co-investor sign-in email","text":"Co-investor sign-in email\n\nSend it from your email app. The portal prepared it with
FAIL cosign-phone the sign-in record is the server kind, with no link token of its own and nothing sent yet :: {"name":"Ingrid Vasquez-Holm","email":"ingrid.vh@example.net","signIn":{"token":"lWXri8FQS8koeZjQOB5GTqQyFOiv4g5TfhaaK6nwvZk","link":"http://127.0.0.
FAIL cosign-phone the investors row says "Sign-in is emailed once Daniel Whitaker has signed" :: Daniel Whitaker Daniel Whitaker · daniel.whitaker@example.com Co-investor: Ingrid Vasquez-Holm · Sign-in link ready to send Individual $100,000 1 investment Acti
FAIL cosign-phone ran to the end :: page.click: Timeout 30000ms exceeded.
FAIL cosign-later "Add co-investor" after the investor signed opens the Account window, not the email to send by hand :: {"open":true,"h2":"Co-investor sign-in email","text":"Co-investor sign-in email\n\nSend it from your email app. The portal prepared it with
FAIL cosign-later the co-investor became a signer on the agreement waiting for them, and the server sign-in was created at once for it :: {"signIn":{"token":"7sN4A36CAobZ_JAE1Kczzt6VAPAdpMSmpGcGc1igkWc","link":"http://127.0.0.1:35545/diy.html?tenant=kestrel-ba
FAIL cosign-later the Account window says when the sign-in was emailed :: Co-investor sign-in email
FAIL cosign-later the outbox holds one email for this sign-in, to the co-investor, with the subject "<firm>: sign the subscription agreement for <account>" :: []
FAIL cosign-later its text greets the co-investor, asks them to sign as co-investor, has "Review and sign" and the link the console holds ::
FAIL cosign-later the email never carries the investor’s taxpayer number ::
FAIL cosign-later the snapshot is a co-investor sign-in for this agreement: coSign, the envelope id, no offering, the account named :: {}
FAIL cosign-later W2: the PDF the co-investor receives has no full SSN or EIN in its text, and still shows the investor’s other values :: {"hit":null,"len":0,"sample":""}
FAIL cosign-later the emailed link loads the co-investor’s agreement from the server :: {"status":401}
FAIL cosign-change-remove the first sign-in was created on the server :: {"token":"Rklytsu0ZC48xO5rm4D_TL2vekHflT5Pm5219dScUgw","link":"http://127.0.0.1:35545/diy.html?tenant=kestrel-bay#co-Rklytsu0ZC48xO5rm4D_TL2vekHflT5Pm5219dScUgw","createdAt":"2026-11-20T0
FAIL cosign-change-remove the old link answers the server’s cancelled message :: {"status":401,"body":{"error":"This link is not valid. Ask the firm that invited you for a new one."}}
FAIL cosign-change-remove the server shows the old sign-in cancelled and a new one sent :: [{"id":"ivt_l48tsvvN61Tl","status":"completed"}]
FAIL cosign-change-remove the new sign-in is emailed to the new address :: []
FAIL cosign-change-remove the device opening the old link says it no longer works :: We could not find this sign-in link
FAIL cosign-change-remove "Remove co-investor" takes the co-investor off and cancels their sign-in on the server :: {"co":null,"status":401,"body":{"error":"This link is not valid. Ask the firm that invited you for a new one."}}
FAIL cosign-change-remove the change and the removal are in the audit log :: ["Envelope signer added: Subscription Agreement - Daniel Whitaker: Marguerite Achterberg (co-investor)","Co-investor added: Daniel Whitaker: Marguerite Achterberg <marguerite.a@exampl
FAIL cosign-forged the sign-in was created on the server :: {"token":"WJSYV5OPjldXpXyu356JHDDp9dT6PzS-tIvtXh91arM","link":"http://127.0.0.1:35545/diy.html?tenant=kestrel-bay#co-WJSYV5OPjldXpXyu356JHDDp9dT6PzS-tIvtXh91arM","createdAt":"2026-11-20T04:03:55.804Z"
```

What the RED shows: on the base, a co-investor added with the integration server connected gets only the preview's
hand-sent link (the "Co-investor sign-in email" dialog, a local token that works only in that browser); nothing is created on
the server, nothing is emailed, the link on another device is "not valid". cosign-desktop and cosign-phone stop at
"ran to the end" because the preview dialog stays open over the console. Raw output: SCRATCH/exec-06-39/red.txt.

## Task 1 verify (tree f7c5e59)

```
CO-INVESTOR SERVER: PASS (parts run: 2)        (t1.txt: cosign-desktop, cosign-phone; 81 PASS, 0 FAIL)
```
One check change after RED, before it passed: the check closes the Account window left open by "Add co-investor" before
inviting (the first fix run stopped there: `page.click: Timeout` on "Invite an investor" under the open window). Then a
check addition: the account investor adopts a signature too, and the copy the co-investor receives must carry the same
number of pictures as the console's own copy (the re-stamped W2 copy keeps the investor's signature).

<!-- gsd:write-continue -->
