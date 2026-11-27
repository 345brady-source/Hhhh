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
