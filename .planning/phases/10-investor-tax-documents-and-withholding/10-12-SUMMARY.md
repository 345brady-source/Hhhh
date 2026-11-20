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
