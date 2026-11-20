# Phase 6: second owner-path walkthrough of the preview (build b13, 2026-11-19)

The next preview of the self-serve investor portal, walked the way the owner uses it before it is published to him: the
build's files in a sandboxed iframe with no server and no fetch, on an iPhone-sized touch screen and on a desktop. No product
code was changed. None of this is "done": these are results for the owner to check.

**Real WebKit cannot be installed on this machine.** Every result comes from Chromium standing in for the iPhone's WKWebView
(390x844, touch, iOS user agent). What only WebKit does is listed under "Could not be tested".

## The walked build is not the newest tree

The build walked here is `claude/refract-reskin` at `844e6a1` (73 files). While the walk ran, more was merged (HEAD
`b8e6b69` when this report was written): plan 09-04 (`assets/js/formd-ui.js`, the Form D section), plan 09-06
(`assets/js/edgar-access.js`), plan 08-11 (`assets/js/amlprogram.js`, now listed in `diy.html`), plan 11-01
(`assets/js/books.js`), and changes to `console.js` and `package.js`. None of these is in b13 or was walked. Publishing b13
as it is leaves them out; publishing the newer tree needs a new build and a walk of at least the Filings tab and AML program.
On the newer tree two of the four missing files of N2 exist (`formd-ui.js`, `edgar-access.js`); `bluesky-data.js`,
`bluesky.js` and `filings-remote.js` still do not.

## Failures first

### New failures (not in the first walkthrough)

**N1. An investor who finished the W-9 without signing, and then signed it when the firm asked, sees two identical rows
"Form W-9 - <name>" under "Signed documents", one of them unsigned (wrong).**

- Both rows read "Form W-9 - Priya Raman · Form_W_9_Priya_Raman_signed.pdf · with certificate of completion", each with
  Download. One is the form finished without a signature (157 KB; the record shows no signature), the other the signed one
  (180 KB). Nothing says which is current, and the unsigned one is listed as signed under a "_signed" file name.
- Steps: investor on file invited with "Include tax form" → on the tax form press Finish without signing (nothing is
  required, D-30) → onboarding to the done screen → sponsor: Investors, "Request tax form" → investor signs and finishes →
  investor's Documents.
- Seen in every 506(b), 506(c) and Reg A run (phone and desktop: the walk took this path for the first time; the first
  walkthrough's request went to an investor with no tax form). Reproduced alone on the desktop with both rows opened.
- Screenshots: `repro-w9-desktop/017-w9-documents.jpg`, `repro-w9-desktop/018-w9-doc-0.jpg`,
  `repro-w9-desktop/019-w9-doc-1.jpg`, `iphone-b/349-b-investor-after-portal-documents.jpg`.

**N2. The Filings tab asks for four files that are not on the tree (cosmetic: nothing broken on screen).**

- On its first opening per page load the tab loads its sections (`filings-ui.js` parts registry). Of the six files listed
  there only `formd.js` exists; `formd-ui.js`, `edgar-access.js`, `bluesky-data.js` and `filings-remote.js` are requested and
  refused (`bluesky.js` is not asked for because the file before it failed). The tab then shows no Form D preparation section,
  no EDGAR access section and no server link; reminders, "I filed this myself", Silence and Options all work (below). In the
  owner's host these are four failed requests on each first visit to the tab.
- Seen in all four runs that opened Filings. Screenshot: `iphone-new/012-filings-before-sale-filings.jpg`.

**N3. On the phone the signature field of the tax form is 12 px tall (cosmetic).**

- On the W-9 / W-8 drawn to fit the phone, "Sign (optional)" is a 146x12 px target (the firm's countersignature field
  146x15 px). It could be tapped every time in the walk. It was measured in the first walkthrough's data too, but not listed
  there.
- Screenshot: `iphone-b/031-b-individual-tax-form-open.jpg`.

**N4. A control redrawn at the moment it is pressed: the press is lost (cosmetic, seen twice).**

- Phone, CPU slowed four times: Finish on the W-8BEN, pressed the moment it appeared, was replaced under the press; the
  second press worked (`iphone-a2`, foreign individual, notes). Phone: the console's "Investors" link, pressed right after
  switching back to Admin, was replaced under the press (`iphone-cs-run1/001-cannot-press.jpg`); the rerun pressed it on the
  second try. On a phone this would be a tap that does nothing and must be repeated.

**Seen once, not reproduced:** on the phone the sample portal's "Add a connection" dialog stayed open after its X once during
the control-by-control sweep (`iphone-front/085-dialog-stays.jpg`). Ten targeted tries (plain, scrolled to the end, after a
choice, after "Save and turn on") closed it every time. Probably a tap sent while the dialog was still moving; not counted.

### Earlier failures still failing

| # | Earlier failure | Status | Evidence |
|---|---|---|---|
| 1 | IndexedDB absent: reopening the preview loses every stored PDF | **Still failing** (that simulation only); the messages are now honest | After a reload with IndexedDB absent: "Edit fields" draws no page while the offering still says "Ready"; the investor's agreement step shows "This browser did not keep the agreement's file. Ask Investor Relations at investors@harborridge.example to send it again." with Back only (no Finish now, so the investor cannot go on); a document opened from Documents says "This browser did not keep this document's file…"; Download of the signed W-9 gives no file. The plain-frame reload passes (agreement draws, onboarding finishes, signed W-9 downloads, 184 KB). `iphone-noidb-reload/003-reload-editor-after-reload.jpg`, `025-reload-individual-agreement-open.jpg`, `028-reload-doc-0.jpg`, `029-reload-download-signed.jpg` |
| 7 | The agreement titled by its file name | **Still failing on one path** | Intake path: E-sign, the investor's copy and Documents all read "Subscription Agreement…" (fixed). Path where the intake's draft agreement is discarded and the agreement is added from the offering page: the document the intake published to investors is still listed under "Offering documents" as "Document" (from "Document.pdf"). `iphone-c/054-c-individual-portal-documents.jpg`, `iphone-c/057-c-individual-portal-documents-document.jpg` |
| 9 | Fields under 16 px (iPhone zooms the page) | **Partly fixed** | Every console form, sign-up field and the preview bar's selects measure 16 px on the phone (0 flagged). Still under 16 px: the blanks inside the agreement and the tax form on the investor's signing views, 4.7, 5.6 and 6.3 px at the fitted size (576 measurements, all `es-f-input`). `iphone-b/039-b-individual-subscription-agreement.jpg` |
| 11 | Field editor on the phone | **Partly fixed** | The sentence now reads "Fields marked Review: tap each, then the sliders button and "Confirm this field"…"; "Read the PDF again" now has a full touch area. The placed fields at Fit are still 5x5 to 48x8 px. `iphone-b/008-field-editor-open.jpg` |
| 13 | The preview bar covers the bottom of the screen | **Still failing** (left as it is by plan 06-33) | 253 records of a control under the bar across the runs; every one could be scrolled clear. `iphone-new/014-package-invite-form-package.jpg` |
| 14 | Smaller items | **Fixed on the phone; one desktop item left** | On the desktop the signing bar's hint is still cut: "Nothing is required. Start goes to each em…" (06-33 left the desktop unchanged). `desktop-b/031-b-individual-tax-form-open.jpg` |

## The 14 earlier failures

| # | Failure | Status | Evidence (screenshots under `W/out/`) |
|---|---|---|---|
| 1 | IndexedDB absent: reopening loses stored PDFs | Still failing (honest messages now) | See above. `iphone-noidb-reload/025-reload-individual-agreement-open.jpg` |
| 2 | Generated documents, 1900 maturity, "Matured" | Fixed | No screen of the firm that signed itself up (3,117 screens, sample excluded) shows "Note Purchase Agreement", an "Investor Update", a "Capital Account Statement", "1900" or "Matured"; Documents after Countersign lists only the agreement, the W-9 and the signed agreement ("3 of 3 documents"); Investments has no redemption line. `iphone-new/072-new-investor-documents-after.jpg`, `iphone-b/337-b-investor-after-portal-investments.jpg` |
| 3 | Countersign does not sign; signed copy drops out | Fixed | Countersign opens "Countersign electronically" (consent, sign, Finish); the envelope then reads "completed; investor=signed, countersigner=signed" in all 14 runs that countersigned; before it, the investor's Documents shows "Signed by you · Waiting for Harbor Ridge Capital's countersignature", after it the fully signed copy. `iphone-new/050-new-countersign-opened.jpg`, `iphone-new/053-new-countersign-finished.jpg`, `iphone-new/045-new-investor-documents-before.jpg` |
| 4 | Placeholder phone, hours, disclosure | Fixed | None of the three appears on any screen of the new firm; the done screen reads "Questions? Investor Relations at investors@harborridge.example."; the footer shows the team and email only. `iphone-b/044-b-individual-done.jpg` |
| 5 | Approve / Decline and row actions off the phone's screen | Fixed | No row action outside the 390 px screen on Requests or Investors in any phone run; Approve, Countersign and Decline tapped where they stand. `iphone-b/242-b-requests.jpg`, `iphone-b/217-b-investors-rows.jpg` |
| 6 | Offering named from words the agreement does not say | Second half fixed; first half not worked on (D-33) | The review still proposes "MOTORS, INC., an Arizona corporation" (the reader, held by D-33). After correcting the Name, Requests "Fund" and the audit package carry it: `Harbor_Ridge_Capital_Elio_Motors_Shares_audit_package_…zip`. `iphone-b/005-intake-review.jpg`, `iphone-b/282-b-own-console-requests.jpg` |
| 7 | Agreement titled by its file name | Still failing on one path | See above. `iphone-c/057-c-individual-portal-documents-document.jpg` |
| 8 | Setup list loses "Prepare your subscription agreement" | Fixed | Setup totals seen: 0 of 8, 2 of 8 (offering and agreement), 3 of 8, 4 of 8: always 8. `iphone-b/253-b-own-console.jpg` |
| 9 | Fields under 16 px | Partly fixed | See above. |
| 10 | Document viewer on the phone: no zoom | Fixed | Viewer has Zoom out / percentage / Zoom in; pages open 328 px wide and reach 656 px, and the zoomed page scrolls sideways by finger (phone); 832 to 1664 px on the desktop. `iphone-new/046-new-before-doc-0-open.jpg`, `iphone-new/047-new-before-doc-0-zoomed.jpg` |
| 11 | Field editor on the phone | Partly fixed | See above. |
| 12 | Content wider than the phone | Fixed | Nothing wider than the screen on any of the 3,117 screens (the hedge fund sample button now wraps). `iphone-new-strict/004-intake-review.jpg` |
| 13 | Preview bar covers the bottom | Still failing (not in any fix) | See above. |
| 14 | Smaller items | Fixed on the phone; desktop hint still cut | "Create the offering" with no name marks the field (aria-invalid) and puts focus in it (the 4-second toast "Enter the offering name." is still shown too), `iphone-new/005-intake-create-without-name.jpg`; Distributions: Generate and Record stay disabled until an amount is typed, and no "Enter an amount." is left after typing, `iphone-money/036-money-distribution-entered.jpg`; the phone's signing hint wraps in full, `iphone-c/118-c-foreign-individual-tax-form-open.jpg`; the Account page offers "Complete your tax form" for a pending request, `iphone-b/318-b-tax-request-portal-account.jpg`; the connection dialog's X sits beside its title, `iphone-front/085-dialog-stays.jpg`; the eight short tap targets all have a full touch area now (measured by the browser's hit test 11.95 px either side of each one's middle, with the control scrolled to the middle of the screen). |

## What passed (new since the first walkthrough)

1. **Help, no server.** Sponsor (console bar): "Help is available once the portal is connected." with no contact line (an
   admin, by design) and no question field. Investor (footer, on onboarding and in the portal): the same sentence and "Contact
   Investor Relations at investors@harborridge.example." Closed by its X. No request was made. `iphone-new/003-sponsor-console-help-open.jpg`,
   `iphone-new/024-investor-onboarding-help-open.jpg`, `iphone-new/043-investor-portal-help-open.jpg`.
2. **Package box on the invite form.** "Add verification package · Checks run once your portal is connected to its server.",
   switched off, a tap does not tick it (phone and desktop). The list import's package box only appears with an imported list
   and was not reached. `desktop-new-strict/014-package-invite-form-package.jpg`.
3. **Integrations.** The "Verification package" panel reads "Checks run once your portal is connected to its server."; the page
   scrolled to its end and its controls pressed with nothing broken. `iphone-new/015-integrations-package-panel.jpg`.
4. **Filings (Report, then Filings), offering under Rule 506(b).** The navigation's Report section holds Reports, Audit,
   AML/KYC, Filings. Before any sale: "No sale on record yet." with Options. After an accepted subscription: "First sale Nov
   19, 2026 (the earliest sale on record) · 1 investor", "First Form D notice · 15 days after the first sale · Due Dec 4, 2026",
   "State notice: Texas · To file", the menu count 2 and the overview's "1 filing due or overdue". A first sale date confirmed
   in Options; "I filed this myself" with a wrong accession number answers "An accession number has 18 digits, written as 10,
   2 and 6 with hyphens between."; with a right one the row becomes "Form D annual amendment · Due Nov 19, 2027" and the count
   drops to 1; Silence / Turn back on and Silence all / Turn all back on work. `iphone-new/057-filings-after-sale-filings.jpg`.
5. **Distribution record and ACH file (phone and desktop).** Capital call issued and received, $5,000 entered, NACHA file
   generated and downloaded (`HARBOR_RIDGE_20270219_A.ach`, 960 bytes, 10 records of 94 characters, types 1-5-6-8-9, one
   credit of 500000 cents to routing 021000021 account 123456789 "MAYA OKONKWO"), Record distribution. The stored record holds
   the amounts: total 500000, line HR-1001 gross 500000, withheld none, net 500000, linked to the ACH file. History shows it;
   the investor's Distributions page shows "Scheduled $5,000.00". `iphone-money/037-money-nacha-generated.jpg`,
   `iphone-money/039-money-distribution-recorded.jpg`, `iphone-money/043-money-investor-distributions.jpg`.
6. **Bank step typed straight after Finish on the tax form (the esign.js fix).** In 14 flows Finish was pressed the moment it
   appeared (phone runs with the CPU slowed four times, 0 pages drawn by then) and the routing and account numbers typed key by
   key at once: every digit stayed and Continue moved on each time. All other flows typed the bank details key by key too: no
   digit lost in 45 flows. `iphone-new/034-new-individual-bank-typed-straight-after-finish.jpg`.
7. **Outside script hosts refused as well (plan 10-03).** With `script-src 'self' 'unsafe-inline'` (both outside hosts
   refused), phone and desktop: the agreement opened in the field editor (8 pages, 16 fields), the investor's W-9 opened
   filled, was signed with a drawn signature (finger on the phone, mouse on the desktop) and finished, the agreement was signed and countersigned, each document
   drew in the viewer with zoom, and the signed W-9 (184 and 188 KB) and signed agreement (155 and 158 KB) downloaded as PDFs. No outside
   request on any of these paths. `iphone-new-strict/` (full set).
8. **The owner's path as before:** sign-up; offering from Document.pdf with its agreement; 4 invited investors (U.S.
   individual, U.S. LLC, foreign individual, foreign entity) under Rule 506(b), Rule 506(c) and Regulation A Tier 2 and two
   investors on file with and without "Include tax form", each to the done screen, on phone and desktop (36 flows, plus 9 in
   the other chapters: 45 reached the done screen; 1 did not, in the IndexedDB-absent reload, failure 1). With the box ticked
   the investor on file got the tax step; without it, not. Approve, Countersign with the firm's typed signature, Decline;
   the investor's Documents and the viewer; the sample portal's 18 console pages and investor portal.

### What the offering intake does with no outside script host (not counted as new)

With both outside hosts refused, "Read documents" never reaches the review: after 90 s the page shows "No readable text was
found. A scanned PDF needs OCR first, or paste the summary of terms." for a PDF that has text. The reader's library comes from
an outside host and was refused; the sentence names the wrong cause. The offering was then made by hand ("Add offering",
"Add the subscription agreement"), which works with no outside host. `iphone-new-strict/004-intake-review.jpg`.

## How it was walked

- **Build:** `SCRATCH/build/b13/`, 73 files, listed in `SCRATCH/build/b13-files.txt`, copied from `claude/refract-reskin` at
  `844e6a1` (the b12 list, plus `filings.css`, `package.js`, `help.js`, `filings.js`, `filings-ui.js`, `formd.js`, and plan
  10-03's `view.js`, `view-worker.js`, `write.js`, `fonts.js` with their three licence files; `esign.js` copied again after the
  bank-step fix and 10-03). Every file compared byte for byte with the checkout. No file without an extension. Not included
  because they are not on the tree: `formd-ui.js`, `edgar-access.js`, `bluesky-data.js`, `bluesky.js`, `filings-remote.js`.
  Not included because the page does not load them: `bankfiles.js`, `filesout.js`, `taxdocs.js`, `withholding.js`.
- **Page:** `SCRATCH/artifact/diy-portal.html`, rewritten from `diy.html`'s current stylesheet and script lists in the same form
  as before, the one-time reset key changed to `fresh-5` (the previous page is kept as `diy-portal-b12.html`). Smoke test
  (`SCRATCH/build/smoke-b7.js`, UTF-8 skeleton): 0 errors, the first screen's text, `SCRATCH/build/b13-smoke.png`.
- **Frame:** `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"`, policy
  `connect-src 'none'` (the checks' policy; outside script hosts allowed, as before) and, for the strict runs, both outside
  script hosts refused too. Every run first proved a fetch of a file that exists is refused ("Failed to fetch").
- **Devices:** 390x844 with touch and an iOS user agent (finger taps, drags and a drawn signature; the CPU slowed four times
  for the Finish-then-type flows), and 1280x800 with a mouse.
- **Runs:** 18 runs in the final set, 3,117 screens audited (screenshot plus measurements of width, cut text, covered controls,
  touch areas, field text size, ways out, console and uncaught errors, refused connections, outside requests, missing files,
  error toasts, raw error text, vendor names, placeholder text). Chapters: `new` (Help, package box, Integrations, Filings,
  Countersign, viewer) on both sizes plus both again with outside hosts refused; `b`, `c`, `a2` on both sizes; `money` and
  `cs` on both sizes; `front` (sample portal) on both sizes; `reload` plain and with IndexedDB absent on the phone. Outside the
  items above: no console error, no uncaught error, no outside request, no error toast, no raw error text and no vendor name
  on any screen.
- **Queue:** 27 recorded runs (final set, reruns and replaced runs): 11 through `SCRATCH/exec-011/heavy.sh`'s slots and 16
  directly because all three slots were held by other agents' gates; 3 trial runs and 3 small probes also ran directly.
- **Scripts and outputs:** `W` = `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/walk-b13`
  (the first walkthrough's `walk.js`, `flow.js`, `wlib.js`, `common.js`, extended: chapter `new`, the Countersign helper,
  Help, package box, Filings and viewer checks, bank typing key by key, Finish as soon as it appears, the stored distribution
  and ACH file checks, `STRICT=1`, a placeholder-text check, the touch-area hit test; `runall.sh`, `analyze.py`, `show.py`,
  `repro-w9.js`, `repro-conn.js`, `probe-tap.js`). One folder per run under `W/out/` with `log.jsonl`, `failures.json` and
  `notes.json`; screenshot paths above are under `W/out/`. The served copy was deleted at the end.

## Could not be tested

- **The iPhone itself.** No WebKit here: the focus zoom of failure 9, the on-screen keyboard over fixed bars, the file picker
  inside the app's frame, whether a generated file is offered for download, mailto and "Copy link" from the frame, pinch zoom,
  safe-area insets, and whether the app's frame keeps localStorage and IndexedDB between visits (which decides whether failure
  1 can happen to the owner).
- **The host's real policy.** The frame used the checks' policy and sandbox; the strict runs show what happens when outside
  script hosts are refused, but the Claude app's own policy is not known from here.
- **Fonts.** The font stylesheet is answered with nothing here; text was measured in fallback fonts.
- **A server.** Help answers, the package's checks, Filings orders sent to be filed and email delivery need one; none exists
  in the preview.
- **The list import's package box** (needs an imported list) was not reached.

## Deviations and faults in the walk's own scripts

- The orchestrator's two later messages were applied: `esign.js` copied again (bank-step fix, then 10-03), 10-03's shipped
  libraries added to the build, Finish pressed as soon as it appears with the bank details typed at once, and runs with both
  outside script hosts refused.
- Faults in the walk's own checks, found and corrected, none counted above: the Countersign check read the agreement
  template's draft envelope instead of the signed one (6 false records; the signed envelopes read "completed" in every run);
  the Investors page check counted the console's sideways navigation tabs as row actions (3 false records; recomputed from the
  logs: no row action off the screen); the first touch-area measure judged controls that were off the screen (the four phone
  runs `b`, `front`, `new`, `money` were run again with the control scrolled to the middle); `iphone-money` and `iphone-cs`
  were run again after the walk pressed too early (the second runs passed). The replaced runs are kept as `*-run1` logs.
- Known before and not counted: Escape does nothing on the desktop tax form (Back is on screen); the sample's notice form
  under its open investor picker and the sample's empty "All 0" tab (both in the first walkthrough's data, not listed there).
- Screenshots were pruned to stay under 100 MB: the full sets of `iphone-b`, `desktop-b`, `iphone-new`, `iphone-new-strict`,
  `desktop-new`, `desktop-new-strict`, `iphone-money`, `iphone-cs`, `iphone-reload`, `iphone-noidb-reload` and
  `repro-w9-desktop`, every screenshot cited here, and every run's logs are kept.
