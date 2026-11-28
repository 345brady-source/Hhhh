---
status: awaiting_human_verify
trigger: "It doesent work after you sign the w-9 then click finish it says object cannot be found here"
created: 2026-11-16T08:20:00Z
updated: 2026-11-16T08:20:00Z
---

## Current Focus

status_note: fix applied in assets/js/operations.js; GREEN and clean-base RED runs of checks/safari-finish.js in progress, then the 06-30 gate
bug_class: Mandelbug (platform/state dependent: WebKit IndexedDB blob storage); SBFL skipped (no failing test before this session)
owner_environment: iPhone, Claude iOS app (WKWebView, iOS Safari engine), artifact in a sandboxed iframe (coordinator, 2026-11-16)
reasoning_checkpoint:
  hypothesis: "Finish fails because finishSigning reads the document it signs back from IndexedDB as a Blob (operations.js files() stored Blob objects), and on iOS WebKit that Blob's data can no longer be read, so blob.arrayBuffer() rejects with a message-less NotFoundError ('The object can not be found here.'); finishSigning's catch toasts err.message and the signature is never applied, so the flow stays on the tax step."
  confirming_evidence:
    - "Chromium in the artifact host's sandboxed frame, with Blobs from IndexedDB made unreadable from Finish on (NotFoundError, WebKit text): current code toasts exactly 'The object can not be found here.', stays on Tax certification, records no taxCert, keeps no signed W-9 (safari-finish.js w9-lost, red.txt)"
    - "The same toast and stuck flow when IndexedDB's transaction() throws NotFoundError from Finish on (w9-throws), and the agreement's Finish is stuck the same way (agreement-lost, first run on the unchanged code)"
    - "The owner's wording is WebKit's default NotFoundError text, which WebKit uses for failed Blob reads (FileReaderLoader errors) and not for its own IndexedDB transaction/objectStore errors (those carry long custom messages)"
  falsification_test: "If the toast text came from something other than a Blob read or IndexedDB (e.g. a DOM insertBefore on a detached node), the fixed code would still show it on the owner's iPhone; the check cannot falsify that on real WebKit because WebKit cannot be installed here (403 from the proxy)"
  fix_rationale: "files() now keeps bytes plus type (an ArrayBuffer is stored inside the IndexedDB value itself, no blob file that WebKit can lose), keeps a session copy of every file written this session (so Finish reads the document it just drew from memory), turns IndexedDB failures into plain-language errors instead of raw DOMException text, reopens the store after a failed transaction, and reads any Blob an earlier version stored at once so a lost one is reported in plain words"
  blind_spots: "Not run on real WebKit/iOS; whether WebKit actually loses the Blob (vs. another NotFoundError source) is inferred from the message text, the code path and WebKit bug reports. Data saved by build 16 on the owner's iPhone is still a stored Blob; if WebKit lost it, the W-9 of that unfinished invitation cannot be read (now a plain message) - the preview's one-time reset should be bumped so the owner starts fresh."
  candidate_causes:
    - "code: files() stores Blob objects in IndexedDB and returns IDB-backed Blobs (confirmed by simulation)"
    - "environment: WKWebView in a sandboxed third-party frame - IndexedDB unavailable, ephemeral, or its blob files dropped; connection closed when the app is backgrounded"
    - "code: DOM tree ops (insertBefore) in re-render - examined, reference nodes are direct children; not WebKit-specific"
  and_gate: "yes - the failure needs both the code storing Blobs in IndexedDB AND WebKit losing/refusing that blob data in the iOS app's frame; Chromium never loses it, which is why every earlier check passed"

## Symptoms

expected: after signing the W-9 and pressing Finish, the signed form is saved and the flow moves to the next step
actual: an error "object cannot be found here" is shown (Safari wording of DOMException NotFoundError)
errors: "The object can not be found here." (WebKit NotFoundError message), shown as a toast
reproduction: published preview build 16 (claude.ai artifact, sandboxed iframe), sign the W-9, press Finish; owner very likely on Safari
started: reported on build 16; Chromium checks never exercised WebKit

## Eliminated

## Evidence

- timestamp: 2026-11-16T08:18:00Z
  checked: npx playwright install webkit
  found: 403 from agent proxy, hosts cdn.playwright.dev and playwright.download.prss.microsoft.com not allowlisted
  implication: WebKit cannot be run here; reproduction must be by simulation in Chromium

- timestamp: 2026-11-16T08:19:00Z
  checked: scratchpad/build/b11/assets/js vs repo assets/js
  found: identical (cmp, no diffs)
  implication: repo HEAD b542fe3 is the code the owner ran

- timestamp: 2026-11-16T08:20:00Z
  checked: esign.js finishSigning (1190-1285)
  found: whole body in try/catch; catch shows U.toast(err.message). Ops: files().get(workDocId||docId), files().put(workDocId), files().put(signedDocId), NS.record.seal, signedHooks (each wrapped in try/catch), NS.app.save, NS.app.render
  implication: the toast text is a thrown error's message, so the NotFoundError came from inside the try before st.finished (files() / record / pdf / render)

- timestamp: 2026-11-16T08:30:00Z
  checked: operations.js files() (356-413)
  found: put stores the Blob object itself in IndexedDB ('cvp-documents'/'files'); get returns the Blob IndexedDB hands back; a refused put is held in memory; a failing get rejects with the raw DOMException (tx rejects with t.error, or a synchronous throw from d.transaction inside the Promise executor)
  implication: every Finish reads an IndexedDB-backed Blob (esign.js 1213-1215 files().get(...) then src.arrayBuffer()); no handling for a Blob whose data cannot be read

- timestamp: 2026-11-16T08:32:00Z
  checked: WebKit message source (Blob.arrayBuffer / FileReaderLoader reject with Exception{NotFoundError} without a message; DOMException default text for NotFoundError is "The object can not be found here."); web search
  found: WebKit bug reports with this exact text for IndexedDB-kept blobs (bugs.webkit.org 226050/216298 test runs "Unhandled Promise Rejection: NotFoundError: The object can not be found here" on blob-in-IDB tests; 235687 "Blobs retrieved from IndexedDB and re-saved causes WebkitBlobResource error 1"; 240216 blob read after IDB save fails). WebKit's own IDB NotFoundErrors (transaction/objectStore) carry long custom messages ("Failed to execute 'transaction' on 'IDBDatabase': One or more object stores were not found."), not the short default the owner saw.
  implication: the short default text points at a message-less NotFoundError: a Blob read (most likely) or a DOM tree op

- timestamp: 2026-11-16T08:35:00Z
  checked: DOM tree ops on the Finish path (render is innerHTML replace; signflow.js:140 insertBefore(hit, page.querySelector('.es-f')) with .es-f rendered as direct children of .es-page; esign.js:3792 row.parentNode.insertBefore(note,row); no removeChild/replaceChild; URL.revokeObjectURL never throws; history.pushState only for dialogs; Range only in a copy helper)
  found: every insertBefore reference node is a direct child of the parent it is used on; identical behavior in Chromium where these paths are covered by the gate
  implication: DOM ops are not a WebKit-specific NotFoundError source here

- timestamp: 2026-11-16T08:36:00Z
  checked: other Finish-path reads: record.prepare (try/catch), onboarding taxSigned (no file reads), completeFlow -> sendCompletion (server mode only: files.get in try/catch, then sendable()/blobB64 FileReader on the same IDB Blob - a NotFoundError there lands in o.finishError on the done page)
  implication: the same lost-Blob read can also surface on the done page in server mode; fixing files() covers both

- timestamp: 2026-11-16T08:55:00Z
  checked: checks/safari-finish.js on the current code (b542fe3), sandboxed frame, simulated WebKit conditions
  found: w9-lost and w9-throws - toast "The object can not be found here.", heading stays "Tax certification", taxCert null, no Documents entry; agreement-lost (first run, unchanged code) - done screen never reached, signer still "viewed"; w9-noidb passes (the existing in-memory hold covers a frame with no IndexedDB)
  implication: the owner's exact message and stuck flow reproduce whenever a Blob read back from IndexedDB cannot be read, or IndexedDB throws NotFoundError at Finish

- timestamp: 2026-11-16T09:00:00Z
  checked: coordinator relay of owner's environment
  found: iPhone, Claude iOS app (WKWebView), sandboxed iframe
  implication: the check gains iPhone parts (390x844, touch, iOS user agent, taps for signature/Adopt/Finish)

- timestamp: 2026-11-16T10:10:00Z
  checked: checks/safari-finish.js final version on an untouched b542fe3 tree (clean RED) and on the fix
  found: base - 5 of 6 parts FAIL, each with toast "The object can not be found here." and no next step (w9-lost, agreement-lost, iphone-w9-lost, iphone-w9-throws, iphone-agreement-lost); iphone-w9-noidb passes on base (in-memory hold already covered no IndexedDB). Fix - 6 of 6 PASS (desktop run 50 PASS; iPhone at 390 CSS px, touch taps, 38 PASS; 0 FAIL)
  implication: the check is RED-first and the fix turns it GREEN on desktop and iPhone touch in the sandboxed frame

- timestamp: 2026-11-16T10:40:00Z
  checked: 06-30 gate plus SAFARI FINISH (scratchpad/dbg-sf/gate.sh) on commit b3212c1
  found: GATE_EXIT=0. server tests 197/197; STATUS MATH 13; FORM MAPS 3; FORMS FLOW 34; STATUS FLOW 26; SERVER MODE 15; TWO PERSONS; MEASURE (walkA/B/C, leak); owner's folder; EMAIL DIALOG 3; AGREEMENT NAME; TAX REQUEST LEAVE 5; WAYS OUT 7; NO NETWORK 3; EMBED DATA 3; SAFARI FINISH 6; phase-4 signing base 75/0 vs plan 75/0; phase-5 record base 40/0 vs plan 40/0
  implication: no regression in the gated paths

## Resolution

root_cause: "operations.js files() kept every file as a Blob object in IndexedDB and handed that IndexedDB-backed Blob back on read; finishSigning (W-9 and agreement) reads the document it signs back from the store at Finish and calls blob.arrayBuffer(). On the owner's iPhone (Claude iOS app, WebKit, sandboxed frame) WebKit could not read that Blob's data and rejected with a message-less NotFoundError, whose WebKit text is 'The object can not be found here.'; finishSigning's catch showed err.message as a toast and never applied the signature. AND-gate: needs both the Blob-in-IndexedDB storage and WebKit losing or refusing that blob data in the iOS app's frame (Chromium never does, so every earlier check passed). Inferred from message text + code path + simulation; not observed on real WebKit."
fix: "files(): keep {type, bytes:ArrayBuffer} instead of a Blob; hold a session copy of every file written (64 MB cap, oldest out) and read it first; a failed transaction closes the connection and the next call reopens; a legacy Blob is read at once; any failed read rejects with a plain-language Error, never the browser's DOMException text"
verification: "Gate 06-30 + SAFARI FINISH: GATE_EXIT=0 (all lines ok). checks/safari-finish.js (6 parts: desktop w9-lost, agreement-lost; iPhone 390x844 touch iphone-w9-lost, iphone-w9-throws, iphone-w9-noidb, iphone-agreement-lost) in the artifact host's sandboxed frame: RED on b542fe3 (owner's exact toast, stuck on Tax certification / agreement), GREEN on the fix (50 PASS, 0 FAIL; iPhone at true device width 38 PASS, 0 FAIL). Gate: see Evidence. Real WebKit not run (download refused by the proxy)."
oracle_type: specified (next step heading, taxCert.signed, stored signed PDF opens with %PDF-, no NotFoundError text, no uncaught error)
files_changed: [assets/js/operations.js, .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/safari-finish.js]
