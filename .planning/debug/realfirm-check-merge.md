---
status: awaiting_human_verify
trigger: "real-firm.js (plan 06-31's check) fails on the merged tree f0a4d88: REAL FIRM: FAIL (parts run: 9) - contact-desktop, contact-phone, documents-desktop, documents-phone. Orchestrator's reading: footer gained a Help button (07-03); Countersign now opens the firm's signing view (06-32)."
created: 2026-11-19
updated: 2026-11-19
---

## Current Focus

hypothesis: (1) contact parts fail because 07-03 added a "Help" button to the self-serve investor footer and the check compares the footer's whole text to a fixed string; (2) documents parts fail because 06-32 makes Countersign open the firm's signing view when the agreement awaits the firm, so no position exists until the firm signs, and the check expects the position right after pressing Countersign.
bug_class: Bohrbug (deterministic: same lines fail on desktop and phone; the cause is a check that encodes pre-merge flow)
reasoning_checkpoint:
  hypothesis: "real-firm.js fails on f0a4d88 because (a) 07-03 added a self-serve-only Help button to the investor footer and the check compares the footer's whole text to strings without it, and (b) 06-32 makes Countersign open the firm's signing view when the agreement waits for the firm, so the position (and, once signed, a third real document: the fully signed agreement) appears only after the firm signs, which the check never did."
  confirming_evidence:
    - "failing footer texts equal the expected strings plus ' Help' in the support row; portal.js:84 renders the Help button only when NS.EDITION.diy"
    - "exp1: with the firm's signing completed on screen, 'holds the offering' passes and the request is accepted; the only failures left are the two document-set lines, listing the completed envelope's signed copy 'Subscription Agreement - Tomás Vidal' (env-...-signed)"
  falsification_test: "if the check, updated only for the Help button and the firm's signing (and the signed agreement once completed), still failed any line in contact/documents, or if a product mutant (placeholder phone in the footer, Help in the managed footer, an invented document for the investor) passed the updated check, the hypothesis (or the update) would be wrong"
  fix_rationale: "the product behaviour is intended (07-03 Help button; 06-32 Countersign = firm signs, fully signed copy joins Documents); the check must walk the new flow and expect exactly the new real content, keeping every 06-31 guard (placeholders, generated titles, 1900, Matured, exact document ids) as strict as before"
  blind_spots: "real WebKit/iPhone not tested (Chromium stands in, as for every phase-6 check); the 'records at once' branch of Countersign is not exercised by this flow (the agreement always waits for the firm here)"
  candidate_causes:
    - "code (check): fixed footer string and pre-06-32 Countersign assumption in real-firm.js"
    - "code (product): a real regression of 06-31's fix (placeholder contact lines, invented documents) - eliminated by exp1: every placeholder/generated/1900/Matured line passes"
    - "environment: shared-queue timeouts or stale vendor files - eliminated: identical failures on both devices, deterministic, zero script errors"
  and_gate: "yes - two independent merged changes (07-03 and 06-32) each break different parts; both must be handled for PASS"
test: done. Final check run on the merged tree (all 9 parts). A mutation run on a copy of the tree, which the updated check must fail. signing-documents.js once.
expecting: met. "REAL FIRM: PASS (parts run: 9)". Each of the three mutants killed. "SIGNING DOCUMENTS: PASS (parts run: 8)".
next_action: orchestrator merges wip/fix-realfirm-check; the owner checks it. The session moves to resolved/ only after that check.

## Symptoms

expected: real-firm.js ends "REAL FIRM: PASS (parts run: 9)" on the merged tree, as it did on plan 06-31's tree.
actual: ends "REAL FIRM: FAIL (parts run: 9) - contact-desktop, contact-phone, documents-desktop, documents-phone".
errors: |
  FAIL contact-desktop the footer holds nothing else (team, email, the legal line) :: Investor Relations investors@harborridge.example Help © 2026 Harbor Ridge Capital, LLC
  FAIL contact-desktop and the investor's footer shows exactly what the sponsor entered :: Investor Relations (646) 867-5309 investors@harborridge.example Weekdays, 9 to 5 Eastern Help Shares are offered to accredited investors only. © 2026 Harbor Ridge Capital, LLC
  (same two for contact-phone)
  FAIL documents-desktop after Approve and Countersign the investor holds the offering :: {"positions":0,"docs":[{"id":"env-...-signed","title":"Form W-9 - Tomás Vidal"}]}
  then every later documents assertion that needs the position fails (docs, Home, Investments, investment page Documents, maturity) (same for documents-phone)
reproduction: run real-firm.js through SCRATCH/exec-011/heavy.sh on f0a4d88 (failing output in SCRATCH/merge-fixa/realfirm.txt)
started: after merging plans 07-03 (footer Help button) and 06-32 (Countersign opens firm signing) with 06-31

## Eliminated

## Evidence

- timestamp: 2026-11-19 (code read on f0a4d88)
  checked: assets/js/portal.js line 84 (footer row)
  found: the footer row is team, phone, email, hours, then `NS.EDITION.diy ? '<button class="pt-foot-help" ... data-action="help-open">Help</button>' : ''`. The failing footer texts differ from the check's fixed strings only by the word "Help" after the support row and before the disclosure/legal line.
  implication: contact parts fail on a fixed-string comparison, not on a placeholder; every placeholder assertion in those parts passed.

- timestamp: 2026-11-19
  checked: assets/js/console.js NS.actions['req-funded'] (line 2148) and assets/js/esign.js countersign() (line 2811) and its signedHooks entry
  found: Countersign first calls NS.esign.countersign(ws, r); for an approved subscription whose envelope is 'sent' with a countersigner who has fields and whose turn it is, it routes to '#console-envelope-<id>' with signAs set and returns true, so markFunded is not called. The hook calls markFunded only when the countersigner's signing completes the envelope.
  implication: in real-firm's documents part (investor signed the saved agreement during onboarding, envelope waits for the firm) Countersign opens the firm's signing view and no position exists until the firm finishes; matches the failing detail {"positions":0}.

- timestamp: 2026-11-19
  checked: esign.js finishSigning completion (line 1276-1281), operations.js docsFor (line 493), esign.js documentsTop hook (line 2764) and the comment "the fully signed copy joins the table below once the firm signs"
  found: when the envelope completes, ws.docs gets the fully signed copy (audience 'investors', investors [the investor], offeringId the offering, cat 'Legal', title = envelope title); docsFor returns it, so the investor's Documents table (and the investment page) will list it.
  implication: once the check completes the firm's signing, the investor holds three real documents (published summary, their W-9, the fully signed subscription agreement). On 06-31's tree the firm never signed (markFunded at once), so the agreement never completed and the investor's own signed copy was not listed (06-32's failure 7 root cause). Prediction to test: after the firm signs, "two real documents" and the two Documents-list lines fail on a third, real document, not an invented one.

- timestamp: 2026-11-19 (exp1: SCRATCH/fix-realfirm/exp1.txt, --only contact-desktop,documents-desktop, footer expectation updated and firm signing added, document-set lines unchanged)
  checked: the two parts on f0a4d88 with the check's first two changes
  found: contact-desktop all PASS (footer lines with the Help button pass; every placeholder line passes). documents-desktop: "Countersign opens the firm's signing of the agreement, and the firm finishes it on screen" PASS (request accepted), "after Approve and Countersign the investor holds the offering" PASS; then exactly two FAILs: "two real documents exist ..." with docs [Offering summary, Form W-9 - Tomás Vidal, Subscription Agreement - Tomás Vidal (id env-...-signed)] and "lists only the published summary under Documents" with ["Offering summary","Subscription Agreement - Tomás Vidal"]. Every other line passes: Documents/Home list the same ids as docsFor, nothing generated, each opens as the file itself (the agreement included), no 1900, no "Matured", "Not set", maturity shown once entered, sample firm unchanged, no connection/script error/external request.
  implication: hypothesis 2 confirmed (the position comes once the firm finishes signing). The third document is the completed envelope's signed copy that 06-32 publishes to the investor (its intended "fully signed copy joins the table"), not an invented document; it opens as the real signed file. No product failure in these parts.

- timestamp: 2026-11-19 (final: SCRATCH/fix-realfirm/final.txt, all 9 parts, commit 6ed9518 on f0a4d88)
  checked: the updated real-firm.js through heavy.sh, P6_OUT under SCRATCH/fix-realfirm
  found: 150 PASS, 0 FAIL, last line "REAL FIRM: PASS (parts run: 9)". Against the failing run (148 lines): no line removed; 13 lines relabelled (the 4 footer lines, the 8 document-set lines, the managed footer line); 2 added ("Countersign opens the firm's signing of the agreement, and the firm finishes it on screen", desktop and phone).
  implication: target signal green on both devices.

- timestamp: 2026-11-19 (mutants: SCRATCH/fix-realfirm/mutants.txt, the updated check on a copy of the tree with three product mutants, --only contact-desktop,documents-desktop,managed; copy deleted after)
  checked: M1 the self-serve footer prints "(212) 555-0100" when no phone was entered; M2 the footer's Help button in every edition; M3 docsFor gives the accepted investor an invented "Q3 Investor Update"
  found: "REAL FIRM: FAIL (parts run: 3) - contact-desktop, documents-desktop, managed". M1 killed by "the footer holds nothing else (team, email, the Help button, the legal line)" (and by the onboarding-screens, done-screen, Home, Account and sign-in placeholder lines). M2 killed by "its portal footer prints them, as before, with no Help button". M3 killed by "the real documents exist ... nothing else", "Documents lists exactly those", "Home's Recent documents lists the same ones", "each opens as the file itself" and the investment page's list.
  implication: every updated assertion still bites on the regression it guards; the update did not loosen 06-31's guards, and the new managed line holds 07-03's "self-serve only".

## Resolution

root_cause: "The check encoded the flow as it was before two merged plans, and 06-31's fix did not regress. (a) Plan 07-03 adds a Help button at the end of the self-serve investor footer's contact row (portal.js:84, NS.EDITION.diy only). The contact parts compared the footer's whole text to fixed strings without it. (b) Plan 06-32 makes Countersign on Requests open the firm's signing of the agreement when it waits for the firm (esign.js countersign()), and records the commitment only when that signing completes (signedHooks -> markFunded). The completed envelope's signed copy is then published to the investor (esign.js:1281), so docsFor returns it. The documents parts pressed Countersign, expected a position at once and expected exactly two documents. On 06-31's tree the firm never signed, so the agreement never completed and the investor's signed copy was not listed (06-32's failure 7)."
fix: "Only checks/real-firm.js changed (commit 6ed9518). Contact parts: the footer must equal team, email, 'Help', legal line (and, once entered, team, phone, email, hours, 'Help', disclosure, legal line). The 'Help' must be the footer's single help-open button. Managed part: its footer must also have no Help button. Documents parts: after Countersign, if the firm's signing view opens, the firm signs on screen as signing-documents.js's firmSigns does (consent, adopt signature, name if empty, Finish). A new line checks that the view finishes and the request is accepted. If no view opens, Countersign records at once as before. The document set stays exact: summary, W-9 and, only when the agreement is completed, the doc whose envelopeId and title are that agreement's. The investment page must list exactly the summary plus that agreement. GENERATED_RE, the 1900, 'Matured' and maturity lines, the placeholder lines and the exact id comparisons are unchanged."
verification:
  target_test: { result: pass, evidence: "SCRATCH/fix-realfirm/final.txt: 150 PASS, 0 FAIL, 'REAL FIRM: PASS (parts run: 9)'" }
  mutation_check: { result: pass, tool: "manual product mutants (no Stryker for browser checks)", mutant_killed: "M1 placeholder phone in self-serve footer; M2 Help in every edition; M3 invented 'Q3 Investor Update' in docsFor: all three killed (SCRATCH/fix-realfirm/mutants.txt)" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, note: "no assertion removed (148 -> 150 lines). Expected footer strings gain 'Help', plus a check that it is the help-open button. The document set gains exactly the completed agreement's signed copy, only when the agreement is completed. Every guard stays an exact comparison." }
  adjacent_tests: { result: pass, evidence: "signing-documents.js once on the same tree, after the real-firm run: 244 PASS, 0 FAIL, 'SIGNING DOCUMENTS: PASS (parts run: 8)' (SCRATCH/fix-realfirm/signing.txt)" }
  revert_and_reconfirm: { result: pass, evidence: "the unchanged check on f0a4d88 fails exactly these 4 parts (SCRATCH/merge-fixa/realfirm.txt). exp1 shows the documents part passes 'holds the offering' only once the firm signs. The updated check passes all 9." }
  product_regression: "none: f0a4d88..6ed9518 changes only real-firm.js (git diff --stat). In the four parts every line guarding 06-31's fix passed in exp1 and final. Newer base 7d12a96 changes nothing under assets/, diy.html, index.html or the phase-4/phase-6 check folders."
  guardrail_verdict: accepted (every signal passed). Not tested: real WebKit/iPhone (Chromium stands in, as for every phase-6 check). Countersign's "records at once" branch is not exercised by this flow, because the agreement always waits for the firm here. Screenshots deleted after the runs; logs kept in SCRATCH/fix-realfirm/.
oracle_type: specified (exact footer strings, exact document id sets, exact request status)
files_changed: [.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/real-firm.js]
