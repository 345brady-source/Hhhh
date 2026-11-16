---
status: awaiting_human_verify
trigger: "It's broken, it won't read this" (owner, with a 13-page Reg S subscription agreement PDF, byte-identical to scratchpad/real-agreement/agreement.pdf; confidential, kept only at its upload path and scratchpad copies; its file name misspells Subscription as 'Subscrpition')
created: 2026-11-16T05:20:00Z
updated: 2026-11-16T07:05:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED (intake path) - with no reading server, an agreement uploaded through "Set up from documents" becomes the offering's agreement only when its NAME passes agreementDoc's regex, and the follow-up dialog pre-selects only names passing /subscri/; the owner's misspelled "Subscrpition" passes neither, so the portal never reads it and the next click is refused. NOT REPRODUCED (direct path) - the offering dialog reads this file (47 fields) in every emulated preview condition and locally with a key-less server.
test: done - RED on ff65aa1, GREEN on 2404da1 (branch fix/agreement-name-tolerant, pushed as wip/fix-agreement-name-tolerant)
expecting: owner confirms which screen he used and that the agreement is read after a preview build with the fix
next_action: orchestrator asks the owner (push notification) the two questions in Resolution.open_questions; on 'confirmed fixed', merge, publish a preview build, archive this session and append the knowledge base
bug_class: Bohrbug (deterministic: same bytes, the file name alone decides)
reasoning_checkpoint:
  hypothesis: "An intake upload is recognised as the subscription agreement only by its name (agreementDoc regex) and the dialog pre-selects only /subscri/; the owner's misspelled file name 'Subscrpition' fails both, so with no reading server the portal never reads the agreement and the obvious recovery click is refused."
  confirming_evidence:
    - "Same PDF bytes: correct spelling -> agreement prepared and saved (panel 'Ready ... countersigned by your firm'); owner's spelling -> nothing, 'Add the subscription agreement', dialog 'None' selected, Continue -> 'Choose the subscription agreement PDF.' (out/intake-named-ok vs out/intake-named)"
    - "Code: prepareAgreement without opts.agreement calls agreementDoc only; agreementDoc's regex and the dialog's /subscri/i both fail on 'Subscrpition'"
  falsification_test: "If the fixed name rule still leaves the misspelled upload without an agreement, or the correctly named upload changes behaviour, the hypothesis is wrong."
  fix_rationale: "One shared, tolerant name rule (stem 'subscr', plus 'sub' + docs/agreement/booklet/packet after any non-letter, underscores included) used by both agreementDoc and the dialog removes the name mismatch at its source; reading itself is untouched."
  blind_spots: "Which screen the owner actually used and what he saw is unknown (real host needs his sign-in); the direct path was not reproduced, so a host-only failure there remains possible. A file whose name says nothing about subscription (e.g. 'Document.pdf') is still not recognised without a server - content-based recognition is a separate decision."
  candidate_causes:
    - "code: name-only recognition (agreementDoc) and a second narrower name test in the dialog"
    - "data: the owner's file name misspells 'Subscription'"
    - "environment: no reading server in the preview, so the model's page-range path (agreementPart) never runs"
  and_gate: "yes - needs the no-server intake path AND a name the rule misses; with a server the range path finds it regardless of name, with a correct name the rule finds it."
tdd_checkpoint: null

## Session Loop

goal: find_and_fix (only if contained; stop at diagnosis if a decision is needed, e.g. hosting a reading server)
symptoms_prefilled: true

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Uploading the agreement on an offering (published preview, build 13, no reading server) reads the document and places fields on its blanks, boxes and signature lines (or, if the in-page reader is used as fallback, the 48-field result measured locally on 2026-11-13).
actual: Owner: "It's broken, it won't read this".
errors: unknown (owner gave none)
reproduction: Published preview https://claude.ai/artifact/GPhQRgiF3Kkne2A5VHqDxP (build 13, files from scratchpad/build/b8), sponsor uploads the PDF as an offering's subscription agreement (possibly via the PPM intake).
started: reported 2026-11-16 on build 13 (server reading since D-31/D-32). The same file (byte-identical, scratchpad/real-agreement/agreement.pdf) gave 48 fields locally with the in-page reader on 2026-11-13 (see placement-real-agreement.md).

## Eliminated
<!-- APPEND only -->

## Evidence
<!-- APPEND only -->

- timestamp: 2026-11-16T05:20:00Z
  checked: knowledge base (.planning/debug/knowledge-base.md) and prior sessions
  found: No knowledge base file exists. Prior session placement-real-agreement.md (diagnosed, not resolved) covers this exact file (byte-identical, cmp). It measured 48 fields locally with the in-page reader and found no difference under emulated sandbox/CSP conditions; it could not reach the real artifact host.
  implication: The in-page reader could read this file as of 2026-11-13. What changed since is the server-reading path (D-31/D-32) and the b8 build; test those first.

- timestamp: 2026-11-16T05:35:00Z
  checked: every file in scratchpad/build/b8-files.txt against the repository at HEAD (cmp)
  found: All 51 published files are byte-identical to the repository. Files the code can load at run time that are NOT in the published list: assets/js/placemodel.js and assets/vendor/formread/* (textread.js loads placemodel.js only for pages read from their picture; failure is caught and logged with console.info "read by the rules alone").
  implication: The preview runs current code. The missing place model only matters for picture pages; this PDF has text on all 13 pages (layout below), so it is not the cause here.

- timestamp: 2026-11-16T05:45:00Z
  checked: Upload through the offering's "Add the subscription agreement" dialog, Playwright Chromium, wrapper page artifact/diy-portal.html in a UTF-8 skeleton, ONLY the 51 published b8 files served (anything else 404 and logged), pdf.js/pdf-lib from local copies at their cdnjs URLs, every other outside request aborted. Modes - top-level page; sandboxed iframe with allow-same-origin + CSP (script-src self unsafe-inline + 3 CDNs, connect-src 'none', worker-src 'none'); sandboxed iframe WITHOUT allow-same-origin (opaque origin, localStorage and IndexedDB throw) + CSP. Script: scratchpad/agr-1116/work/repro.js, output scratchpad/agr-1116/out/b8/.
  found: All three modes identical - editor opens, toast "47 fields were placed, each on a place the agreement prints. Check them, then save.", 0 marked for review, per page p2:1 p4:2 p5:6 p6:5 p7:6 p9:5 p11:16 p12:6 (matches the 47-field ground truth count in placement-real-agreement.md), signatures p11 investor x2 and p12 firm. No console error, no CSP violation, no 404, no request to any reading server (no server configured -> serverReading returns 'no-server' at once).
  implication: The direct-upload path with the in-page fallback reads this file in every emulated preview condition. "It won't read this" is not reproduced on this path; the remaining candidates are a different upload path (PPM intake), the real host's policy differing from the emulation, or state in the owner's preview workspace.

- timestamp: 2026-11-16T06:05:00Z
  checked: The PPM intake under the same preview emulation (sandboxed iframe + CSP, b8 files only, no server), with the file under its real upload name (which misspells Subscription as 'Subscrpition') - Offerings > "Set up from documents" (also where the dashboard's "Add your first offering" goes), choose the file, "Read documents", "Create the offering", open the offering, "Add the subscription agreement". Script scratchpad/agr-1116/work/intake.js, screenshots scratchpad/agr-1116/out/intake-named/.
  found: |
    - Reading takes 0.6 s with the built-in rules reader ("Read with the built-in reader ... 11 terms found"; not found: management fee, carried interest, preferred return, fund term, minimum commitment). No console error, no network request.
    - The subscription agreement is NOT recognised and NOT read for fields: the review screen has no agreement section, the done screen and the offering's panel say "Upload the subscription agreement once ... Add the subscription agreement". The file is only attached to the offering as a document.
    - console.js ik-read sets st.agreement only when method === 'auto' (the reading server answered); intake.js prepareAgreement/agreementPart need the server's subscriptionAgreement page range. Plan 01.4-71 states this by design: "the built-in reader leaves no range, so no subscription reading starts".
    - Clicking "Add the subscription agreement": the dialog's "Or use a document already on this offering" select shows "None" selected, because the pre-selection test /subscri/i (esign.js es-agreement-new) does not match the file's misspelled name "Subscrpition". Pressing "Continue to place fields" as offered gives the toast "Choose the subscription agreement PDF." and nothing is read.
    - Choosing the attached document by hand in that select: editor opens, 47 fields, same as the direct upload.
  implication: Through the intake path, under preview conditions, the portal never reads the agreement for fields, says nothing about it, and the obvious next click is refused with "Choose the subscription agreement PDF." This matches "it won't read this" without any error. The direct path reads it fine.

- timestamp: 2026-11-16T06:10:00Z
  checked: The real published preview, opened in headless Chromium through the agent proxy.
  found: claude.ai/artifact/GPhQRgiF3Kkne2A5VHqDxP returns the viewer shell (200), but its /api/frame/<id> call returns 403 (needs the owner's sign-in) and the shell's scripts on assets-proxy.anthropic.com are blocked by the egress proxy (ERR_TUNNEL_CONNECTION_FAILED); the page shows "Couldn't load artifact". The frame origin is <id>.frame.claudeusercontent.com; its real content security policy for the artifact document cannot be read without the owner's session. WebKit (Safari engine) could not be installed (download blocked); only Chromium was run.
  implication: The real host cannot be tested from here; the emulation stays the best available evidence. A host-specific failure of the in-page reading cannot be ruled out, only shown absent under every emulated condition.

- timestamp: 2026-11-16T06:20:00Z
  checked: Local run, repository checkout (diy.html, top-level), server/index.mjs started with env -i (no key of any kind; /health says reader:false) on port 8799 and entered as the workspace's integration server. Direct upload and intake, same scripts (work/local-direct.js, work/local-intake.js), output out/local and out/local-intake.
  found: Direct upload - /v1/read answers 503 three times (readingFetch retries after 2 s and 6 s), then the in-page reading stands: 47 fields, the same per-page counts, 10.7 s from Continue to the editor. Intake - /v1/intake 503 three times, then the built-in reader with the note "Reading could not finish. The built-in reader was used instead."; the agreement again is not recognised; the dialog again has "None" pre-selected; choosing the document by hand gives 47 fields (the /v1/read 503s then fall back).
  implication: The server-unreachable / key-less path falls back correctly; it is not the cause. The intake behaviour is identical with and without a key-less server.

- timestamp: 2026-11-16T06:25:00Z
  checked: intake.js prepareAgreement and agreementDoc (the no-server way an intake upload becomes the offering's agreement), and the dialog pre-selection in esign.js es-agreement-new
  found: Without a server range, prepareAgreement takes the uploaded PDF as the agreement ONLY if agreementDoc's name test matches its title or file name - /subscri(ption|ber)|\bsub[\s_.-]*(agreement|agmt|docs?)\b/i. The dialog uses a second, different test, /subscri/i. The owner's file name contains "Subscrpition" (misspelled), so neither test matches.
  implication: Candidate root cause for the intake path: name-only recognition that fails on the misspelled name.

- timestamp: 2026-11-16T06:50:00Z
  checked: Fix applied in worktree scratchpad/agr-1116/wt (branch fix/agreement-name-tolerant from ff65aa1); RED commit 7d22991, fix commit 2404da1 (rewritten from 8c422e4/7838224 to drop the fund's file name from the messages), pushed to origin wip/fix-agreement-name-tolerant
  found: |
    - checks/agreement-name.js: FAIL on ff65aa1 (names, intake, dialog), PASS 12/12 after the fix. Mutant (old name parts restored) -> intake and dialog FAIL again.
    - Regression on the fix branch: server tests 191/191; server-read-unit PASS; server-read PASS (48 lines); mixed-boxes PASS (34); two-persons PASS (first agreement 47 fields, places hash unchanged 64d41c889c478037); intake-server --only unchanged,api,fallback,failures,combined PASS (42 lines, protected slices 13/13 byte-identical).
    - The owner's exact file and name through the intake under preview emulation, served from the fix branch: offering panel "Ready ... 13 pages ... countersigned by your firm", dialog pre-selects it, 47 fields.
  implication: The intake path now reads the owner's agreement with no reading server. Placement is untouched (same 47 fields, same places hash).

- timestamp: 2026-11-16T06:30:00Z
  checked: Differential - the same bytes renamed to the same name with Subscription spelt correctly, same intake run under preview emulation (out/intake-named-ok)
  found: Correct spelling - the intake prepares and saves the agreement at once: offering panel "Ready ... 13 pages ... countersigned by your firm", and the dialog pre-selects it. Misspelled (the owner's name) - nothing, "Add the subscription agreement", "None" pre-selected, Continue refused with "Choose the subscription agreement PDF.".
  implication: CONFIRMED for the intake path: the only difference is the file name, and it decides whether the agreement is read. Two of the owner's own uploads miss the dialog's /subscri/ test (this one, and "E_-_Riviera_Capital_Sub_Docs.pdf" whose title "... Sub Docs" fails /subscri/; agreementDoc does catch the latter through its title).

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "Intake path (reproduced): with no reading server (the published preview), an agreement uploaded through 'Set up from documents' becomes the offering's agreement only when its title or file name passes intake.js agreementDoc's regex, and the offering's agreement dialog pre-selects only names matching /subscri/i; the owner's file name misspells 'Subscription' as 'Subscrpition', so neither matches - the portal never reads the agreement, says nothing, and the obvious next click (Continue with 'None' selected) is refused with 'Choose the subscription agreement PDF.'; AND-gate: also requires the no-server path (with a server the model's page range finds it whatever its name). Direct-dialog path: NOT reproduced (47 fields in every emulated preview condition and locally with a key-less server)."
fix: "One shared, tolerant name rule AGREEMENT_NAME in intake.js (stem 'subscr' after a non-letter, or 'sub' + agreement/agmt/doc(s)/document(s)/booklet/packet/package after a non-letter, underscores counted as separators; the old 'subscription'/'subscriber' anywhere kept), used by agreementDoc and exported as NS.intake.agreementName; the dialog's pre-selection in esign.js uses /subscri/i OR that rule. Reading and placement untouched."
verification: "RED-first: checks/agreement-name.js FAILS on ff65aa1 (names, intake: misspelled name -> no agreement, 0 fields vs 47 with the right spelling; dialog: misspelled and _Sub_Docs -> None) and PASSES after the fix (12/12). Mutation: restoring the old name parts kills the intake and dialog lines. Against the owner's 15 real upload names (names only): only the misspelt agreement name changes (now read); PPMs, the LPA, neutral names unchanged. Regression suite: see Evidence."
files_changed: [assets/js/intake.js, assets/js/esign.js, .planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/checks/agreement-name.js]
open_questions:
  - "Which screen did you upload it on: the offering's 'Add the subscription agreement' button, or 'Set up from documents' (Offering intake, also where 'Add your first offering' on the overview goes)?"
  - "What did the screen say after the upload (the exact words of the message or the line under the buttons), and on which device/browser?"
oracle_type: specified (the offering must hold an agreement with the same 47 fields as the correctly named upload; the dialog must pre-select the document)
