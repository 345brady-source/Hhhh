# Phase 8 Plan 20 (draft, in progress): evidence as produced

Start commit (base): 5745e39a840271eaa9178a1a2a10786bdf97f6f7. Step 0: server tests 484, `# fail 0`; phase-8 gate checks 8;
REVERIFY parts at the base 4 (local, server, leave, button).

## Task 1 RED (red.txt, part package against the base code)

```
PASS package the taxpayer-number scan finds the number in a planted copy of a file
PASS package the console uses the integration server with the sponsor account's token
PASS package GET /v1/billing (the account's token) offers the reverify tier at a price of its own
FAIL package the dialog holds "Add verification package ($99)" (the server's reverify price), switched on and unticked :: {"present":false,"shown":false,"enabled":false,"checked":false,"label":"","line":"","link":""}
REVERIFY: FAIL (parts run: 1) - package
```

## Task 1 first GREEN attempt (verify-1.sh exit 1)

One FAIL, the check's own read: the console keeps the server's word on the package as an object ({ tier, status }), and
the check looked for `package === true`. Fixed in the check (`!!y.package`). Found while reading that code: invitations.js
`create` kept a package only when the invite form's box (identity or full tier) allowed it, never asking about the reverify
tier; fixed in the same line (a re-verification asks the dialog's own box).

## Task 1 verify (verify-1.sh, exit 0, after the fix)

```
PASS package the typed taxpayer number is in no world record
PASS package the typed taxpayer number is in no server output (store, events, anything this process printed) and on no screen
REVERIFY: PASS (parts run: 1)
VERIFY1_EXIT=0
```
Tracer gate: the verify re-ran end to end on the fixed code and passed; expanding.

## Task 2 RED (red2.txt, part server with G6 against Task 1's code 1b356ae; 57 PASS)

```
FAIL server an amount owed: no status number, "answered" or vendor word in the dialog :: ["506"]
FAIL server tier_mismatch: the dialog shows the server's sentence word for word, alone :: {"said":"","SENT":"This invitation's package was paid at another level. Nothing was charged."}
FAIL server package_used: the dialog shows the server's sentence word for word, alone :: {"said":"","SENT":"This package belongs to another invitation."}
FAIL server package_used: one new request for the same investor with a different id, still a re-verification (reverify, on file, no offering), with the package choice, not sent :: {"one":"invt-mwym4yd3ij6ci","fresh":[]}
REVERIFY: FAIL (parts run: 1) - server
```
- The first FAIL is the check's own: its status-number scan matched "506" in "A Rule 506(c) subscription needs a current
  verification." Fixed in the check (a number after "Rule " is the exemption, not a status).
- The other three needed code: the dialog closed and showed a refusal only in a toast with a prefix; and replaceUsed made
  no new request for a re-verification, because `validate` refuses an account-only invitation for an investor with an
  active account ("Choose an offering to invite them to subscribe"). A used package on a re-verification left no request.
- Passing before the code (guards): the shared token (account_required sentence), unreachable, no card (with and without
  the link), the amount owed (switched off with the real credit_owed sentence, sent without the package, nothing charged),
  tier_mismatch's row sentence and nothing charged, package_used's old row sentence and nothing charged.

## Task 2 mutation (red2-mut.txt: a copy of 1b356ae whose dialog ignores the box's state; 52 PASS)

```
FAIL server the shared token: the dialog's box shown switched off, unticked, with exactly the server's account_required sentence :: {"sb":{"present":true,"shown":true,"enabled":true,...,"line":"Card payments need a sponsor account."},...}
FAIL server unreachable: the box shown switched off, unticked, with "The integration server could not be reached." :: {...,"enabled":true,...}
FAIL server no card: the box shown switched off with "Add a card on the Integrations page to use it." leading to the Integrations page (an admin) :: {...,"enabled":true,...}
FAIL server no card: for someone who cannot open Integrations, the same line with no link :: {...,"enabled":true,...}
FAIL server an amount owed: the box shown switched off, unticked, with the server's price and exactly its credit_owed sentence :: {"b":{...,"enabled":true,...}}
FAIL server an amount owed: no status number, "answered" or vendor word in the dialog :: ["506"]
FAIL server tier_mismatch: the dialog shows the server's sentence word for word, alone :: ...
FAIL server package_used: the dialog shows the server's sentence word for word, alone :: ...
FAIL server package_used: one new request ... :: {"one":"invt-mwym5skl1ovqj","fresh":[]}
REVERIFY: FAIL (parts run: 1) - server
```
The guard states fail when the dialog ignores the box's state, so they measure the dialog, not only package.js.

## Task 2 verify (verify-2.sh, exit 0; flow2.txt 107 PASS, 0 FAIL)

```
PASS package the typed taxpayer number is in no world record
PASS package the typed taxpayer number is in no server output (store, events, anything this process printed) and on no screen
REVERIFY: PASS (parts run: 3)
VERIFY2_EXIT=0
```
