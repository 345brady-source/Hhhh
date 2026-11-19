---
status: awaiting_human_verify
trigger: "Find the root cause of, and fix, four failures the owner-path walkthrough found in the investor portal: failures 2, 4, 6 (second half) and 8 of 06-WALKTHROUGH.md"
created: 2026-11-19T17:40:00Z
updated: 2026-11-19T18:40:00Z
---

## Current Focus

bug_class: Bohrbug (each failure is seen in every run of the walkthrough that reached it)
hypothesis: four separate causes, one per failure (Resolution); each confirmed by checks/real-firm.js RED on a0f0e63 and GREEN after the fix
test: checks/real-firm.js, 9 parts (phone 390x844 touch, desktop 1280x800, sandboxed frame refusing connections)
expecting: RED on the base with the walkthrough's words; GREEN on the merged tree; the reference gate as on the base
next_action: owner check of the published preview (status awaiting_human_verify)
reasoning_checkpoint:
  hypothesis: "(2) investorDocs builds demo documents for every firm and an empty exit date is formatted as 1900; (4) sign-up keeps the template's sample phone/hours/disclosure and six investor places print them unconditionally; (6) the review binder writes only the edited path; (8) the Setup filter drops a step whose link is console-offering-<id>"
  confirming_evidence:
    - "RED run on a0f0e63: 58 FAIL lines carrying the walkthrough's words (Setup 2 of 7; short name NORTHGATE MOTORS, INC.,; (212) 555-0100, Mon-Fri, the bracketed disclosure; Note Purchase Agreement, Q3/Q2 Investor Update, Capital Account Statement; Maturity Jan 1, 1900; Matured)"
    - "GREEN run with only these changes: REAL FIRM: PASS (parts run: 9), 0 FAIL"
  falsification_test: "any FAIL in the GREEN run, or a part passing on the base"
  fix_rationale: "each change is at the cause: the generator gated to sample firms and the managed edition, the empty date never formatted, the template lines cleared at sign-up, the Short name set in the binder, the step filter told the offering page's name"
  blind_spots: "real WebKit (Chromium stands in); invitations already sent before the fix carry the old lines in their snapshot"
  candidate_causes:
    - "code: the generator, the formatter, the binder, the filter"
    - "data: the template's placeholder lines stored in every firm created before the fix (cleared on load)"
  and_gate: "yes for 4: the template lines AND the unconditional printing both had to hold; both are fixed"

## Symptoms

expected: an investor of a firm that signed up itself sees only what the firm entered or published; the Setup list tells the truth; correcting an offering's Name on review corrects its Short name
actual: (2) four generated documents, "Maturity Jan 1, 1900", "Time to redemption: Matured"; (4) "(212) 555-0100", "Mon–Fri, 9:00 a.m.–5:00 p.m. ET" and "[Regulatory disclosures to be provided by counsel.]" on investor screens, emails and document headers, and "Brand the investor portal" complete from sign-up; (6) the Short name keeps the reader's words after the Name is corrected; (8) "Prepare your subscription agreement" leaves the Setup list once an offering exists
errors: none (no console error in any of the 28 walkthrough runs)
reproduction: 06-WALKTHROUGH.md, failures 2, 4, 6 and 8 ("Steps")
started: seen 2026-11-19 on claude/refract-reskin at 43773a4; the code paths are older

## Eliminated

## Evidence

- timestamp: 2026-11-19T17:40:00Z
  checked: knowledge base (.planning/debug/knowledge-base.md)
  found: no knowledge base file; no semantic recall service in this session
  implication: no known-pattern candidate; proceed from the code

- timestamp: 2026-11-19T17:40:00Z
  checked: assets/js/data.js NS.investorDocs (601-622), portal.js allDocs (1044-1049)
  found: investorDocs builds "Q3/Q2 Investor Update", "Capital Account Statement", a tax document and "Note Purchase Agreement"/"Subscription Agreement" from the investor's positions for every firm; allDocs joins them with the published files
  implication: candidate cause of failure 2 (documents)

- timestamp: 2026-11-19T17:40:00Z
  checked: data.js parse (30-33), exitInfo (429-465), portal.js redemption (474-503), intake.js apply (1109-1113)
  found: parse('') is Date.UTC(0, 0, 1), which JavaScript reads as 1 January 1900; apply writes exit { basis: 'maturity', date: '' } when the review gives no maturity date; exitInfo and redemption format e.date with no check that it is there ('range' with empty from/to prints "1900" the same way)
  implication: candidate cause of failure 2 (maturity)

- timestamp: 2026-11-19T17:40:00Z
  checked: tenants.js TENANT_TEMPLATE (56-57), workspace.js create (152) and normalize (66), diy.js sign-up (129), console.js 218
  found: the template carries a sample phone, hours and a bracketed disclosure; create and normalize merge the template into every firm; sign-up replaces only the domain and the email; "branded" compares only those two with the template
  implication: candidate cause of failure 4

- timestamp: 2026-11-19T17:40:00Z
  checked: console.js NS.binders.ik (2660-2666), intake.js normalize (1003)
  found: the Short name is derived from the Name once, when the reading is normalized; the review form's binder writes the edited path only
  implication: candidate cause of failure 6 (second half)

- timestamp: 2026-11-19T17:40:00Z
  checked: console.js 225 and 237, app.js PREFIXED (357-365)
  found: the step's link becomes console-offering-<id> once an offering exists; the list keeps only steps whose link is a key of NS.views, and the offering page is registered as console-offering
  implication: candidate cause of failure 8

- timestamp: 2026-11-19T18:05:00Z
  checked: (continuation) portal.js footer (84-85), overviewHTML (541), wireBox (172), account (1146), sign-in help (1240), documents.js head (16), data.js mergeNotice (329); invitations.js 293, onboarding.js 1529/2475/2513/2555, record.js 350, esign.js 2463
  found: the portal's footer, Home contact block, wire note, Account line, sign-in help and generated document header print support.phone, support.hours and disclaimer unconditionally; the invitation/tax-request email, done screen, consent and certificate already leave an empty phone out
  implication: clearing the template's lines at sign-up is the cause's fix; the six unconditional places must leave an empty line out
- timestamp: 2026-11-19T18:05:00Z
  checked: portal.js investment page key terms (844), intake.js apply (1164-1165)
  found: a "Private credit" offering gets the type's key terms with empty values (Coupon, Payment schedule, Security, Maturity), shown to investors as labels with no value
  implication: not a generated document or a date (no 1900); it is what apply adds for the type and the sponsor controls each term's "show"; left as it is (managed edition shows them the same way); the check reads the figures, the term section and Time to redemption, and requires no date or 1900 in key terms

## Resolution

root_cause: "(2) assets/js/data.js NS.investorDocs built investor updates, a capital account statement and a Note Purchase Agreement from the positions for every firm (portal.js allDocs joins them with what was published); data.js NS.exitInfo case 'maturity' and portal.js redemption formatted an empty exit date (parse('') is 1 January 1900), giving 'Maturity Jan 1, 1900' and 'Matured' ('range' the same way). (4) tenants.js TENANT_TEMPLATE lines 56-57 (sample phone, hours, bracketed disclosure) are merged into every new firm by workspace.js create; diy.js sign-up replaced only the domain and email; portal.js footer, overviewHTML, wireBox, account, sign-in help and documents.js head print them unconditionally; console.js 218 judged the Brand step on the domain and email only. (6) console.js NS.binders.ik wrote only the edited path; the Short name is derived once in intake.js normalize. (8) console.js 237 kept only steps whose link is a key of NS.views; the step's link console-offering-<id> is a prefixed route (app.js PREFIXED), so it was dropped once an offering existed."
fix: "investorDocs returns nothing for a firm that is not a sample in the self-serve edition; exitInfo and redemption return Not set for a missing date; the investment page leaves out an empty term section. Sign-up starts phone, hours and disclosure empty, normalize clears the template's lines from a self-serve firm saved before; the six places leave an empty line out (the Account line and the managed invitation line fall back to the email, notices' {phone} too). Brand step needs a support phone in the self-serve edition. The ik binder sets the Short name from the corrected Name (intake.shortOf) until the sponsor types one. The Setup filter maps console-offering-<id> to the console-offering page."
verification: "checks/real-firm.js RED on a0f0e63 (74 PASS / 58 FAIL), GREEN on the fix (148 PASS / 0 FAIL); final runs and the gate in 06-31-SUMMARY.md"
files_changed: [assets/js/console.js, assets/js/data.js, assets/js/portal.js, assets/js/diy.js, assets/js/workspace.js, assets/js/documents.js, assets/js/intake.js, .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/real-firm.js]
oracle_type: specified (the walkthrough's words and the brief's statements of what must be true)
