---
phase: 10-investor-tax-documents-and-withholding
plan: 12
status: in-progress
---

# Phase 10 Plan 12: delivery to the investor's own device (draft, filled in as evidence is produced)

Base commit: 92fda021277ede4bc2e72f777829e331dd0597a7 (SCRATCH/exec-10-12/base-commit.txt).

## RED, then GREEN (outputs kept in SCRATCH/exec-10-12)

### Task 1
- red-1.txt (server tests, before any code):
  - `not ok 1 - create: the document is stored sealed and the answer has a link to the portal page that ends in taxdoc- and a token` (expected 200, actual 404)
  - `not ok 2 - the investor's GET with the link's token gives the firm, the title and what is needed, and nothing else` (expected 200, actual 401)
  - `not ok 3 - open with the right four digits and consent in effect returns the bytes uploaded, and the status becomes opened with one open` (expected 200, actual 401)
  - `# tests 3`, `# pass 0`, `# fail 3`
- red-1.txt (check, before any code):
  - `FAIL open-phone Deliver delivers the K-1 and sends it to the server: the document holds the link id and the email status :: {"state":"delivered","link":null}`
  - `FAIL open-phone the row says the link was sent to the investor's email :: Davis Family Trust · KBC-1001 · ending 6789 Pages 1 to 2 · Picked by hand · Check admin Available until May 20, 2027 · Not opened Notice Notice came back Withdraw Delivered`
  - `FAIL open-phone ran to the end :: TypeError: Cannot read properties of undefined (reading 'match')` (the check's own reader of the outbox failed on an empty outbox; fixed in the check before the code was written)
  - `TAXLINK FLOW: FAIL (parts run: 1) - open-phone`
- Task 1 verify (exit 0): unit.txt `# tests 3`, `# pass 3`, `# fail 0`; tracer.txt `TAXLINK FLOW: PASS (parts run: 1)` (15 PASS lines, among them `PASS open-phone with 6789 the pages are drawn in the page and Save is offered` and `PASS open-phone back on the console, opening Tax documents again shows the row as opened once on their device`). The tracer gate: the automated verify was run again end to end and passed before any expansion.
### Task 2
- The eleven rule tests were committed (save commit) before the rule code. red-2.txt: `# tests 14`, `# pass 8`, `# fail 6`; the failing ones:
  - `not ok 5 - notice: ...` (resend: `{"error":"Not found"}`), `not ok 7 - digits: ...`, `not ok 8 - consent: ...`, `not ok 9 - withdrawn: ...`, `not ok 10 - period: ...`, `not ok 12 - limits: ...` (a last4 given as the number 6789 instead of text was accepted: `200 !== 400`)
  - Five rule tests passed at once (sealed, tokens, workspaces, list, opens): the tracer's code already sealed the record, refused other tokens, pinned the workspace and counted opens. Each was then shown able to fail by a mutation of the module (red-2-mutations.txt; the module restored after each): `MUTATION sealed` (the name stored in plain) `not ok 1 - sealed: ...`; `MUTATION tokens` (the investor's paths accept anything) `not ok 1 - tokens: ...`; `MUTATION workspaces` (no pinning) `not ok 1 - workspaces: ...`; `MUTATION list` (the token's hash listed) `not ok 1 - list: ...`; `MUTATION opens` (the count stays 1) `not ok 1 - opens: ...`.
  - One test changed after RED, before GREEN: `period` first asked both the GET and the open for 410 on 2028-01-01; with the purge running right after each answer (W1), the first call's purge removes the record, so the test now asks the open for 410, purges, and then finds the link unknown (404).
- Task 2 verify (exit 0): `# tests 14`, `# pass 14`, `# fail 0`; the marker `// gate: tests 14`; server/lib/invitations.mjs unchanged.
- The tracer's code landed in commit 67af493 (a save commit named `wip(10-12): save`, made under the save rules before the browser run; history is not rewritten).
