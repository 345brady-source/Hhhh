# Phase 6: owner-path walkthrough of the preview (2026-11-19)

Acceptance walk of the investor portal the way the owner uses it: the published preview's files in a sandboxed iframe with no
server and no fetch, on an iPhone-sized touch screen and on a desktop. No product code was changed. Nothing here is "done":
these are results for the owner to check.

**Real WebKit could not be installed on this machine.** Every result below comes from Chromium standing in for the iPhone's
WKWebView (390x844, touch, iOS user agent). Anything that only WebKit does is listed under "Could not be tested".

## What was walked

- **Build:** the 60 files of `SCRATCH/build/b12-files.txt` copied from `claude/refract-reskin` at `43773a4`, and the page
  `SCRATCH/artifact/diy-portal.html` wrapped in a UTF-8 skeleton. At the end of the walk the 60 files were compared again with
  the checkout (then at `3cfb4dc`): all identical. The checkout has one new file, `assets/js/formd.js`, which is not in the
  list and is not loaded by the page.
- **Frame:** `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"`, served with
  the policy of `checks/no-network.js` (`connect-src 'none'`). Every run first proved a fetch of a file that exists is refused
  ("Failed to fetch").
- **Devices:** 390x844 with touch and an iOS user agent (taps, finger drags, a signature drawn with a finger), and 1280x800
  with a mouse. deviceScaleFactor 1.
- **Storage simulations (from `checks/safari-finish.js`, active from the first script):** Blobs read back from IndexedDB
  unreadable ("lost"), and separately IndexedDB absent ("noidb"). Both at the phone size, the whole walk each.
- **Runs:** 28 runs, 5,286 screens audited (screenshot plus measurements), 90 investor flows walked to a done screen, 1 not
  (failure 1). Each screen was checked for: content wider than the screen, cut-off text, covered controls, small tap targets,
  a way out or forward, raw error text, console errors, uncaught errors, refused connections, outside requests, files missing
  from the build, error toasts, vendor names.
- **Scripts and outputs:** `W` = `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/walk-owner`
  (`walk.js`, `flow.js`, `wlib.js`; one folder per run under `W/out/` with `log.jsonl`, `failures.json`, `notes.json`).
  Screenshot paths below are under `W/out/`. The served copy was deleted at the end.

In all 28 runs: **no console error, no uncaught error, no refused connection, no request outside the frame, no file missing
from the build, no error toast, no raw error text, no vendor name on screen.**

## Failures

Severity is one of: blocks the flow / wrong / cosmetic.

### 1. With IndexedDB absent, reopening the preview loses every stored PDF (blocks the flow, under that simulation only)

- **Where:** sponsor's field editor, investor's "Subscription agreement" step, investor's Documents.
- **What happened:** with the "IndexedDB absent" simulation on, everything works inside one page load (the full walk passed).
  After the frame is loaded again: "Edit fields" draws no pages; the investor's agreement step shows a red box "This document
  is stored in a different browser. In production, envelopes are kept in the document vault." with "Try again", while the bar
  still reads "Ready to finish" and Finish is enabled; a document opened from Documents says "This file was published from a
  different browser…"; "Download" of the signed W-9 gives no file. The portal does show "This browser is not letting the portal
  save. Your work will be lost when you close this page." at the top. The message about "a different browser" is not what
  happened.
- **Steps:** IndexedDB absent → Create your portal → offering from Document.pdf → save the agreement → reload the frame →
  Edit fields; invite an investor → open the link → reload → walk to the agreement.
- **Not seen:** in the plain frame and with "Blobs unreadable" the same steps pass on phone and desktop (agreement draws
  after every reload, onboarding finishes, signed W-9 downloads). Whether the owner's iPhone frame has IndexedDB is not known
  from here.
- **Screenshots:** `iphone-noidb-reload/003-reload-editor-after-reload.jpg`, `iphone-noidb-reload/025-reload-individual-agreement-open.jpg`,
  `iphone-noidb-reload/028-reload-doc-0.jpg`, `iphone-noidb-reload/029-reload-download-signed.jpg`.

### 2. An investor of a brand-new sponsor is shown documents the sponsor never published, a 1900 maturity date and "Matured" (wrong)

- **Where:** investor portal (Home "Recent documents", Documents, Investments) once the sponsor has pressed Approve and
  Countersign on the investor's subscription.
- **What happened:** Documents lists six items. Two are real (the uploaded agreement and the investor's W-9). Four were never
  uploaded by anyone: "Note Purchase Agreement" (Nov 19, 2026, 38 pages, "Executed November 19, 2026"), "Q3 2026 Investor
  Update" (Nov 3, 2026, 8 pages), "Capital Account Statement, Q3 2026" (Oct 15, 2026, "Quarter ended September 30, 2026"),
  "Q2 2026 Investor Update" (Aug 12, 2026). Each opens as a branded document "Prepared for" the investor; both updates print
  "Maturity Jan 1, 1900". Investments shows the holding as "Time to redemption: Matured". The portal was created the same day
  and the offering is common stock.
- **Steps:** Create your portal → offering from Document.pdf → save the agreement → invite and onboard an investor → Requests:
  Approve, Countersign → as that investor open Documents, each "View", and Investments.
- **Seen in:** every run that reached it (phone and desktop, all three exemptions, both simulations).
- **Screenshots:** `iphone-b/345-b-investor-after-portal-documents.jpg`, `iphone-b/352-b-investor-after-portal-documents-q3-2026-investor-update.jpg`,
  `iphone-b/347-b-investor-after-portal-documents-note-purchase-agreement.jpg`, `iphone-b/339-b-investor-after-portal-investments.jpg`,
  `desktop-b/344-b-investor-after-portal-documents.jpg`.

### 3. "Countersign" on the Requests page does not sign the agreement, and the investor's signed copy drops out of Documents (wrong)

- **Where:** sponsor Requests page; sponsor E-sign page; investor Documents.
- **What happened:** after Approve then Countersign the toast reads "Subscription countersigned. The commitment is on the
  investor register." The agreement itself stays unsigned by the firm: E-sign lists it as "Out for signature · 1 of 2 signed"
  (envelope: investor signed, countersigner not). From that moment the investor's Documents page changes to the table of
  failure 2 and no longer lists "Signed by you" (the copy the done screen says "is in your Documents now"). The firm can
  really sign from E-sign → Open → "Sign as sponsor" → Finish; then the envelope reads "Countersigned" and the signed copy is
  listed for the investor again. Nothing on the Requests page says that second step exists.
- **Steps:** onboard an investor → Requests: Approve, Countersign → E-sign page; as the investor open Documents.
- **Screenshots:** `desktop-cs/025-cs-requests-after-countersign.jpg`, `desktop-cs/026-cs-esign-after-countersign.jpg`,
  `desktop-cs/024-cs-investor-documents-before.jpg`, `desktop-b/344-b-investor-after-portal-documents.jpg` (after Countersign, no signed copy),
  `desktop-cs/031-cs-firm-finished.jpg`, `desktop-cs/032-cs-investor-documents-after.jpg`.

### 4. Investors see a placeholder phone number, office hours and "[Regulatory disclosures to be provided by counsel.]" (wrong)

- **Where:** every onboarding screen's footer, the done screen ("Questions? Investor Relations at … or (212) 555-0100"), the
  invitation and tax-form-request emails, the investor's Account page, every generated document's header.
- **What happened:** a sponsor who signs up enters no phone, hours or disclosure. Investors are shown "(212) 555-0100",
  "Mon–Fri, 9:00 a.m.–5:00 p.m. ET" and the bracketed placeholder sentence. The console's Setup list shows "Brand the investor
  portal: logo, colors, domain, support contact and disclosures" as complete from the first second (it is judged only on the
  domain and email, `console.js` line 218).
- **Steps:** Create your portal → invite an investor → read the email to its end → open the link.
- **Screenshots:** `iphone-b/044-b-individual-done.jpg`, `iphone-b/019-b-individual-invite-email-end.jpg`, `iphone-b/002-console-after-signup.jpg`.

### 5. On the phone, Approve / Decline and the investor rows' actions are off the right edge of the screen (wrong)

- **Where:** sponsor Requests page and Investors page at 390 px.
- **What happened:** Requests: "Approve" starts 764 px from the left and "Decline" 858 px, on a 390 px screen; the table shows
  Submitted, Investor, Fund and a cut "Req…" column. Investors: "Download" (tax form) at 423 px, "View portal" at 630 px,
  "Account" at 650 px. They are reached only by dragging the table sideways; nothing shows there is more to the right.
- **Steps:** on the phone open Requests (or Investors) with at least one row.
- **Screenshots:** `iphone-b/245-b-requests.jpg`, `iphone-b/220-b-investors-rows.jpg`.

### 6. The offering is named and set up from words the agreement does not say (wrong; reader and intake, held by D-33)

- **Where:** Offering intake review and "is set up" screens; then Requests, the Account dialog, the audit package, the
  investor's capital call notice.
- **What happened:** from the Elio Motors, Inc. agreement the intake proposes the name "MOTORS, INC., an Arizona corporation",
  type "Private credit", "1% management fee on contributed capital" and a waterfall; the agreement is for common stock and
  names no fee. Correcting the Name on the review screen leaves the Short name, so "MOTORS, INC., an Arizona" still shows in
  the Requests "Fund" column, the Account dialog's "Offerings" and the audit package file name
  (`Harbor_Ridge_Capital_MOTORS_INC_an_Arizona_audit_package_…zip`). The "Private credit" type is what produces "Note
  Purchase Agreement" and "Matured" in failure 2. No work on the reader was done or proposed here (D-33); this is for the
  owner's decision.
- **Steps:** Offering intake → choose Document.pdf → Read documents → Create the offering.
- **Screenshots:** `iphone-b/005-intake-review.jpg`, `iphone-b/007-intake-set-up.jpg`, `iphone-b/245-b-requests.jpg`.

### 7. The agreement is titled by its file name wherever it appears (wrong)

- **Where:** sponsor E-sign page; investor Subscription step, Documents, Home.
- **What happened:** with the file named "Document.pdf" and the agreement taken from the intake: E-sign lists "Document -
  Maya Okonkwo"; the investor's own signed copy is "Document - Maya Okonkwo"; the Subscription step and Documents list the
  offering document "Document". Added through the offering's "Add the subscription agreement" button instead, the same file
  is titled "Subscription Agreement - Maya Okonkwo". The agreement is recognised whatever the file is called (that passed);
  the name still becomes its title on one of the two paths. The owner's words for D-11: "The name of the file should have
  nothing to do with anything."
- **Screenshots:** `iphone-b/267-b-own-console-esign.jpg`, `iphone-b/059-b-individual-portal-documents.jpg`, `desktop-cs/024-cs-investor-documents-before.jpg`.

### 8. The Setup list loses "Prepare your subscription agreement" as soon as an offering exists (wrong)

- **Where:** console Overview, Setup.
- **What happened:** after sign-up the list has 8 steps ("1 of 8 complete"). Once the first offering exists it has 7: step 5,
  "Prepare your subscription agreement", is gone whether or not an agreement was added (the step's link becomes
  `console-offering-<id>`, which the list's filter does not know as a page, `console.js` lines 225 and 237). A sponsor who
  pressed "Discard" on the draft agreement gets no reminder.
- **Screenshots:** `iphone-b/002-console-after-signup.jpg` (8 steps), `iphone-b/252-b-own-console.jpg` (7 steps), `desktop-b/251-b-own-console.jpg`.

### 9. Fields under 16 px: an iPhone enlarges the page when they are tapped (wrong on the device; measured here, not reproduced)

- **Where:** "Create your portal" (all five fields, 14 px), every sponsor console form (14 px: offering, invite, add manually,
  ACH, distributions, capital call, notices, brand, team, integrations, audit, reports), the preview bar's two selects
  (12 px), and the blanks inside the agreement on the investor's signing view (4.7 to 6.3 px at the fitted size).
- **What happened:** iOS Safari zooms the page when a field with text under 16 px takes focus and does not zoom back. The
  investor onboarding fields are 16 px on the phone (correct, `portal.css` line 558); the ones above are not. Chromium does
  not do this, so it was measured, not seen.
- **Screenshots:** `iphone-b/001-first-screen.jpg`, `iphone-b/040-b-individual-agreement-open.jpg`.

### 10. A document opened on the phone cannot be read: pages 328 px wide and no zoom control (wrong)

- **Where:** investor Documents and Home (any "View" or document title), at 390 px.
- **What happened:** the document is drawn in the page (no browser viewer, as required) at 328 px wide: a Letter page's text
  is about 3 px tall. The dialog has Download and Close only. The signing views have zoom buttons; this view has none.
  Whether a pinch enlarges it inside the Claude app could not be tested.
- **Screenshot:** `iphone-b/064-b-individual-portal-documents-document.jpg`.

### 11. Field editor on the phone: the text points to a list that is not there; fields are 5 to 9 px tall (cosmetic)

- **Where:** field editor at 390 px.
- **What happened:** the summary says "Fields marked Review are listed on the left: confirm each one…". On the phone the list
  is hidden (`esign.css`: `.fe-sec-review { display: none }` up to 640 px), so each of the 10 marked fields is confirmed by
  tapping the field, then the sliders icon, then "Confirm this field". All 10 could be confirmed and the agreement saved. At
  "Fit" the placed fields are 5x5 to 48x9 px. "Read the PDF again" is 17 px tall.
- **Screenshots:** `iphone-b/008-field-editor-open.jpg`, `iphone-b/011-field-editor-properties.jpg`.

### 12. Content wider than the phone screen (cosmetic)

- "Hedge fund: master-feeder, three share classes, side pockets" (Offering intake): the button is 446 px wide and is cut at the
  screen edge. `iphone-b/003-intake.jpg`
- "Add the standard terms for Real estate s…" (new offering): 373 px, ends at 405 px. `iphone-front/021-sample-console-offerings-add-offering.jpg`
- Audit page after a download: the file name is 446 px wide, and the "Downloading …" toast runs from 63 px left of the screen
  to 63 px right of it. `iphone-b/291-b-own-console-audit-download-audit-package.jpg`

### 13. The preview bar and toasts cover the bottom of the screen (cosmetic)

- **Where:** every sponsor page and every investor portal page, phone and desktop ("Demo · sponsor", "Signed in as", "New
  sign-up").
- **What happened:** the bar floats over the last 60 px; controls under it are reached by scrolling a little further (every
  one could be). On the phone only the first of its three controls fits; the rest scroll sideways. Toasts stack above it.
- **Screenshots:** `iphone-b/001-first-screen.jpg`, `iphone-b/220-b-investors-rows.jpg`.

### 14. Smaller items (cosmetic)

- "Create the offering" with no name (a scanned agreement gives none) answers only with a 4-second toast "Enter the offering
  name."; the field is not marked and does not take focus. `iphone-scan2/003-scan-create-without-name.jpg`
- Distributions: "Enter an amount." stays on screen after an amount is typed and the allocation is shown, until the next
  press. `iphone-money/033-money-distribution-entered.jpg`
- Signing bar: "Nothing is required. Star…" (phone) and "Start goes to each em…" (desktop) are cut. `iphone-b/031-b-individual-tax-form-open.jpg`
- The investor's Account page (Tax and accreditation) does not mention a pending tax-form request; Home does.
  `iphone-b/317-b-tax-request-portal-account.jpg`
- "Add a connection" dialog on the phone: the close X wraps under the title. `iphone-b/301-b-own-console-integrations-add-a-connection.jpg`
- Tap targets under 24 px high on the phone: "Remove" on each Setup step (22), "Offerings" back link (21), "Read the PDF
  again" (17), "Update bank account" (22), "Verify now" (22), "Back to console" (20), "Integrations" (17), the support email
  link (22).

## What passed

1. **Sign-up and sample.** "Create your portal" (empty-form messages, then sign-up to the console) and "Explore a sample
   portal", phone and desktop. All 18 console pages of the sample and of a new sponsor opened, were scrolled to their end by
   finger or wheel, and their controls pressed.
2. **Offering from documents.** "Document.pdf" (set A, a003, not held out) was taken as the subscription agreement on every
   run: 8 pages, 16 fields placed, 10 marked for review, 2 signature lines. The editor opened from the intake and from the
   offering's "Add the subscription agreement" button; zoom, adding a field, undo, the properties sheet, confirming all 10,
   Save, reopening with "Edit fields" and leaving all worked. A 14-page scanned agreement (a006) was also taken: 14 fields,
   all 14 marked for review.
3. **Invitations.** U.S. individual, U.S. LLC, foreign individual and foreign entity under Rule 506(b), Rule 506(c) and
   Regulation A Tier 2, and two investors on file (added by hand) with and without "Include tax form". Every email dialog
   scrolled to its end and closed by X, Escape (desktop) or "Mark as sent", and reopened from the row's "Email". With the box
   ticked the investor on file got the tax step; without it, not.
4. **Onboarding.** All 12 new-investor flows and both on-file flows reached the done screen on the phone, on the desktop and
   under both simulations. Every step had a forward button, and a Back button after the first. Tax form: W-9, W-8BEN and
   W-8BEN-E opened with no fetch; signed with a finger-drawn signature, a typed one, and finished unsigned; Back returned to
   the answers; "Upload it instead" took a PDF; Finish moved on every time. Browser back from the tax form lands on the
   investor's home, whose "Continue account setup" leads back in. Escape does nothing on the tax form (Back is on screen).
   Bank, subscription, agreement signing and done all passed. Under Regulation A a non-accredited investor could go on
   without the 10 percent attestation and the sponsor's panel then listed them as "Not attested".
5. **Sponsor.** Investor rows; tax form "Download" (a PDF each time); "Request tax form" and its email; Requests Approve and
   Decline; eligibility panels (506(b) count "1 of 35", Reg A attested and not attested) and the benefit plan panel (the
   entity that answered yes listed); "View portal" with "Back to console"; ACH origination filled to "Ready to generate
   files"; a capital call issued and received; a distribution with its NACHA file downloaded on the sponsor's own data
   (`HARBOR_RIDGE_20270219_A.ach`, 960 bytes, starts `101`) and on the sample (`KB_FUND_II_LP_20261123_B.ach`); Documents,
   Audit (package and CSV downloaded), AML/KYC, Integrations, Brand, Team, Notifications, E-sign with "Sign as sponsor"
   (phone and desktop).
6. **Investor portal.** Home, Investments, Distributions, Documents, Updates, Account behind "Menu" on the phone; each kind
   of document opened in the page and closed; signed W-9 downloaded; "Update bank account" opened and cancelled. A pending
   tax-form request showed on Home with "Complete your tax form", could be left with Back, then was signed and finished, and
   the notice went away.
7. **Storage.** "Blobs unreadable": the walk never read a Blob back from IndexedDB (0 hits), so the condition could not bite
   and everything passed, reload included. "IndexedDB absent": everything passed inside one page load (failure 1 is after a
   reload).

## Could not be tested

- **The iPhone itself.** No WebKit here. Not covered: the focus zoom of failure 9, the on-screen keyboard over fixed bars,
  the file picker inside the app's frame, whether a download of a generated file is offered at all, "Open in your email app"
  (mailto) from a sandboxed frame, "Copy link" in a frame of another origin, pinch zoom, safe-area insets, and whether the
  app's frame keeps localStorage and IndexedDB between visits.
- **The host's real policy.** The frame used the checks' policy and sandbox, not the Claude app's own. A stricter host could
  refuse things this one allowed.
- **Fonts.** The check browser answers the Google Fonts stylesheet with nothing, so text was measured in fallback fonts;
  widths on the device may differ by a few pixels.
- **Email delivery and an integration server:** none exists in the preview.
- **One unexplained event:** in the first run of the scanned agreement at the phone size the page closed while waiting on the
  review screen. Two repeats of the same steps did not close. No cause found.

## Deviations

- Four chapters were added to the six items of the brief because the walk pointed at them: reload of the frame, a scanned
  agreement, the money path (capital call to NACHA) on the sponsor's own data, and the firm's countersignature.
- "Investor on file" was walked as an investor added by hand under "Add manually". Inviting an investor whose subscription is
  still pending is refused by the form ("already has a subscription … waiting for review"), which is why.
- Faults in the walk's own scripts were found and fixed during the work (wrong selectors, a scroll check that read the wrong
  element, a tap sent during a fling); none is counted above. Final runs: phone and desktop 506(b) on the last script; the
  desktop 506(c) and Reg A runs predate the last two additions (pending-request completion and the accepted investor's
  pages), which the phone runs and desktop 506(b) cover.
- Screenshots were pruned to stay under 100 MB: the full sets of `iphone-b` and `desktop-b`, every screenshot cited here, and
  each run's logs are kept.
