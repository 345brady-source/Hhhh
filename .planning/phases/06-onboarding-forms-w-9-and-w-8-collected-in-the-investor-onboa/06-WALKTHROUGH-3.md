# Phase 6: third owner-path walkthrough of the preview (build b14, 2026-11-20)

This is the next preview build of the self-serve investor portal, walked the way the owner will use it, before it is
published to him. The build's files were served at their relative paths inside a sandboxed iframe. A strict policy
refused every outside connection: scripts, styles, fonts, images, frames and fetch. The walk used an iPhone-sized touch
screen and a desktop. No product code was changed. None of this is "done": these are results for the owner to check.

**Real WebKit cannot be installed on this machine.** Chromium stood in for the iPhone (390x844, touch, iOS user agent,
CPU slowed four times for the press cases). What only WebKit or the Claude app can show is listed under "Could not be
tested".

**The build matches the branch.** b14 has 105 files. Every asset is byte-identical to `claude/refract-reskin` at
`e16a96e`, and both help preview files are identical to `.planning/tools/preview/`. The page's script and style lists
equal `diy.html`'s. `help-data.js` is current (guide `1903ba0908b1`). The reset key is `fresh-6`.

Screenshot paths below are under `W/out/`, where
`W = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/walk-b14`.

## Failures first

### 1. The offering intake cannot read the documents when the host refuses outside scripts (wrong; blocks the owner's first step)

- **What happened.** Sign-up, then Offering intake with `Document.pdf` (a PDF that has text), then "Read documents".
  The review never appears. The page says "No readable text was found. A scanned PDF needs OCR first, or paste the
  summary of terms." That message gives the wrong cause.
- **Why.** `intake.js` still loads its PDF reader from `https://cdnjs.cloudflare.com` (pdf.js and its worker, jszip,
  pdf-lib), and the policy refuses it (`script-src-elem`). `esign.js` still names cdnjs and jsdelivr copies as fallbacks,
  but signing worked without them.
- **Where it was seen.** Every run under the strict policy, on phone and desktop (9 of 9 attempts in the final runs).
- **With cdnjs allowed** (the variant runs `iphone-b-cdn` and `iphone-c-cdn`, where pdf.js was answered from the checks'
  local copy), the review appears: "Review the setup … 14 terms found".
- **Whether the owner meets it** depends on whether the Claude app's frame lets cdnjs scripts load. That is not known
  from here. Walkthrough 2 saw the same thing in its strict runs and did not count it.
- **How the rest was walked.** Under the strict policy the walk added the offering by hand: Offerings, "Add offering",
  then "Add the subscription agreement" with `Document.pdf`. That path works (field editor: 16 fields, 10 for review,
  2 signature fields).
- Screenshot: `iphone-b-2/005-intake-review.jpg`.

### 2. Opening a co-investor's sign-in link crashes the page (wrong)

- **What happened.** On the Investors page: "Account" on Maya Okonkwo's row, then "Add co-investor" (Ruth Okonkwo,
  `ruth.okonkwo.b@example.com`), then "Add co-investor". The "Co-investor sign-in email" dialog opens with the sign-in
  link (`…/diy-portal.html?tenant=harbor-ridge-capital#co-<43 characters>`), Copy link, Open in your email app and Mark
  as sent. That part is right.
- **The crash.** "Open the co-investor's link" lands on a page that says only "Opening your agreement…". It has no way
  out, and a script error is thrown: `TypeError: Cannot read properties of null (reading 'signedAt')` at
  `esign.js:3271` (`mineHTML`, from `investorDocsHTML`, from `portal.js:1003 earlyDocuments`). `flowSigner(e, inv.id)`
  returns null for a co-investor on an envelope that has no co-investor signer.
- **When it happens.** The account investor has signed an agreement that waits for the firm's countersignature, and that
  agreement has no co-investor places.
- **How often.** 4 of 4 tries: `iphone-a2` (Priya's account), `iphone-b-2`, `iphone-b-cdn` and `iphone-c-cdn` (Maya's account).
- Screenshots: `iphone-b-2/362-b-coinvestor-after-save.jpg` (the link shown, right),
  `iphone-b-2/365-b-coinvestor-link-opened.jpg` (stuck).

### 3. Typed signatures lose their script styles when Google Fonts is refused (wrong-looking)

- **What happened.** In "Adopt your signature", the Type tab shows six "Style" choices that are all the same plain
  serif. The typed signature and initials come out as plain serif text.
- **Why.** The script faces (Pinyon Script, Mrs Saint Delafield, Caveat, Nothing You Could Do, Bad Script, Mr Dafoe)
  come only from `fonts.googleapis.com` (`signature.js` FACES_URL). None of them is in the build, and the policy refuses
  the stylesheet.
- **Where it was seen.** Every signing dialog in every run.
- Screenshot: `iphone-b-2/086-b-entity-tax-signature-type.jpg`.

### 4. Two files that are not in the build and not on the branch are requested on every page load (cosmetic)

- **What happened.** `assets/js/tax1099-ui.js` and `assets/js/taxlink.js` are both refused with a 404, which also
  writes a console error.
- **Why.** `taxdocs-ui.js` loads a fixed list of parts when the page starts, not when Tax documents is opened, and these
  two are on the list.
- **Effect.** Nothing breaks on screen. In the owner's host this is two failed requests every time the preview opens.
  Walkthrough 2's N2 is fixed (below); this is the same pattern in a new place.
- **Count.** 20 times each across the final runs (once per page load).
- Screenshot: `iphone-b-2/001-first-screen.jpg`.

### 5. Outside font stylesheets on every load (cosmetic; these are the walk's outside requests)

- **On every page load**, the page's own `<link>` and `brand.js` each ask for a Funnel Display stylesheet from
  `fonts.googleapis.com`. The page also preconnects to `fonts.googleapis.com` and `fonts.gstatic.com`.
- **On the first signing dialog of each load**, `signature.js` asks for the script-faces stylesheet.
- All of them were refused by the policy, each with a console error, and text was drawn in fallback fonts.
- Counts are under "Outside requests and script errors".

### 6. Tax documents, "Deliver" on the phone: nothing visible happens (cosmetic)

- **What happened.** On the K-1 package page on the phone, "Deliver 2" was pressed before the Contact for tax documents
  was saved. The reason ("Before delivering, save the Contact for tax documents with its name, mailing address,
  telephone and email.") is written at the top of the page, out of view (measured at -200 px). The screen stays at the
  button, so the press looks dead.
- **On the desktop** the message is in view (top 146 px).
- **Also seen.** In the contact form, Telephone is drawn as a square box, unlike the rounded fields around it.
- Screenshots: `iphone-x3/080-x3-taxdocs-deliver-list.jpg`, `iphone-x3-2/091-x3-taxdocs-deliver-without-contact.jpg`.

### 7. A control redrawn at the moment it is pressed (walkthrough-2 N4, still seen once; cosmetic)

- **What happened.** On the phone, with the CPU slowed four times, a foreign individual's W-8BEN "Finish" was pressed the
  moment it appeared. It was redrawn under the press, and the second press worked. This is the same case as in
  walkthrough 2.
- **Run:** `iphone-a2`. The retry is logged after `117-a2-foreign-individual-tax-answers-filled.jpg`; the next screen is
  `118-a2-foreign-individual-bank-typed-straight-after-finish.jpg`.
- **The other fast-Finish flows** (the W-9 in `iphone-b`, `iphone-b-2`, `iphone-c`, `iphone-b-cdn`, the desktop) worked
  on the first press.
- **The console-link case** did not recur in `iphone-cs-cpu4`, which ran the whole chapter at CPU 4x with 0 presses
  lost.

### 8. The preview bar's "Signed in as" choice is cut on the phone (cosmetic)

- The bar now stands at the top of the page in three rows, as 06-35 intended. But the select reads "Admin · Harbor Ridge
  Capit" and "Co-investor · Ruth Okonkw".
- Screenshots: `iphone-b-2/002-console-after-signup.jpg`, `iphone-b-2/365-b-coinvestor-link-opened.jpg`.

### 9. Two tap targets under 24 px on the phone (cosmetic)

- EDGAR access: "Open the answer sheet" is 153x17 px (`iphone-x3-2/103-x3-edgar-access.jpg`).
- ACH origination, "Paying entity by offering": an offering link on one line is 85x17 px
  (`iphone-front/090-sample-console-ach-end.jpg`).
- Nothing else on the phone is under 24 px, with each field's own touch layer counted (see N3).

### 10. The Filings section pages do not say which section they are (cosmetic)

- Form D, EDGAR access and State filings each open with only "Back" and the offering's name ("New offering"). No
  heading says "Form D" or "State filings".
- Screenshots: `iphone-x3-2/098-x3-formd-open.jpg`, `iphone-x3-2/108-x3-state-notices.jpg`.

### 11. "$5000.00" without the thousands separator (cosmetic)

- The withholding proposal reads "30% of the amount you entered as subject to withholding ($5000.00)." The same line
  also shows "$5,000.00".
- Screenshot: `iphone-x3-2/071-x3-distribution-withholding-proposed-after-amount.jpg`.

### 12. The "Add a connection" dialog stayed open after its X once more (cosmetic)

- This happened on Integrations during the walk's control sweep, phone, `iphone-a2/292-dialog-stays.jpg`.
- Walkthrough 2 saw it once and could not reproduce it. This is the second time.

### 13. Desktop: the floating preview bar still covers controls until the page is scrolled (cosmetic; failure 13, desktop half)

- It covers the console navigation's "AML program" link, the investor footer's "Help", the ACH company name field and
  the field editor's lower tools. These are 134 records, and every one could be scrolled clear. 06-35 left the desktop
  bar unchanged.
- Screenshot: `desktop-b/002-console-after-signup.jpg`.

### For the owner to judge (not counted as failures)

- **A foreign investor is paid gross unless the sponsor types an amount.** On a distribution, the Tax withheld block
  shows the W-8BEN investor with empty "Amount subject to withholding" and "Rate from your CPA" fields. Nothing is
  proposed until an amount is typed, and "Generate NACHA file" works with the field empty. The first desktop run paid
  Zoë Müller the full $5,000.00 in the ACH file (`desktop-x3`). This matches the design text ("30% of the amount the
  sponsor enters"). Whether a W-8BEN investor should be paid gross with no prompt is a decision for the owner and the
  CPA.
- **The Tax withheld section counts paid distributions only.** After a $1,500 withholding was recorded on a distribution
  scheduled for Dec 21, 2026, Tax documents > Tax withheld still says "Nothing was withheld from this fund's
  distributions paid in 2026." This is probably by design, but it may confuse.
- **The preview bar offers one investor.** "Signed in as" offers only the latest investor. To see the K-1 as Maya, the
  walk opened her own invitation link by its address.

## The earlier failures (walkthrough 2: 1 to 14, N1 to N4)

| # | Earlier failure | Status now | Evidence |
|---|---|---|---|
| 1 | IndexedDB absent: reopening loses stored PDFs | **Partly fixed** | The investor is no longer stuck. The agreement step shows "This browser did not keep the agreement's file…" with Back and a primary "Continue and sign later". That leads to "Thank you. One document is still to sign / … Investor Relations has been told", and the firm's Notifications read "… could not see the subscription agreement". A banner says "This browser is not letting the portal save. Your work will be lost when you close this page." The files are still lost after a reload: "Edit fields" draws no page, and "Download" of the signed W-9 gives no file. The re-issue after the firm adds the agreement again was not walked. `iphone-noidb-reload/029-reload-individual-agreement-open.jpg`, `iphone-noidb-reload-2/*-reload-continue-and-sign-later.jpg`, `iphone-noidb-reload/032-reload-download-signed.jpg`. Plain reload: onboarding finishes and the signed W-9 downloads (184,049 B). |
| 2 | Generated documents, 1900, "Matured" | Fixed | No placeholder text on any of the 2,818 screens of the firm that signed itself up. |
| 3 | Countersign does not sign | Fixed | Every Countersign ended "completed; investor=signed, countersigner=signed" (b, c, a2, desktop b, cs, new, x3 x2, cdn). `iphone-b-2/246-b-countersign-finished.jpg` |
| 4 | Placeholder phone, hours, disclosure | Fixed | None on any screen. The footer shows "Investor Relations · investors@harborridge.example". |
| 5 | Row actions off the phone's screen | Fixed | No row action outside the 390 px screen on Investors or Requests in any phone run. |
| 6 | Offering named from words the agreement does not say | Second half fixed; first half unchanged (D-33) | With cdnjs allowed, the Name is still "Inferred" from "ELIO MOTORS, INC., an Arizona corporation"; after renaming, "Elio Motors Shares is set up". Under the strict policy the intake does not read at all (failure 1 above). `iphone-b-cdn/005-intake-review.jpg` |
| 7 | Agreement titled by its file name | Fixed | Offering documents lists "Subscription Agreement · Elio Motors Shares" on the intake path and on the path that discards the draft and adds the agreement from the offering page. `iphone-c-cdn/054-c-individual-portal-documents.jpg` |
| 8 | Setup list loses an item | Fixed | Totals seen were 0 of 8, 3 of 8 and 4 of 8. |
| 9 | Fields under 16 px (iPhone zoom) | Fixed for every field a person types into | 0 fields under 16 px on the 2,325 phone screens. The agreement's blanks on the signing view are read-only on the phone (06-35 moves typing to a tray). The tray itself was not measured in this walk. |
| 10 | Viewer on the phone: no zoom | Fixed | Pages 328 px, zoomed to 656 px, scroll sideways by finger. `iphone-new/` |
| 11 | Field editor on the phone | Partly fixed | At Fit the 16 fields are still drawn 5x5 to 305x24 px. A tap 15 px below a field selected it for 2 of 3 fields (33x6 and 40x8 px). The third (305x7 px) was not selected because a neighbouring field is nearer. `probe-fe-iphone/003-fe-tap-beside-0.jpg` … `005` |
| 12 | Content wider than the phone | Fixed | 0 sideways overflow on 2,325 phone screens. |
| 13 | Preview bar covers the bottom | Fixed on the phone; desktop unchanged | Phone: the bar stands in the page at the top, and 0 controls were under it. Desktop: 134 records, all scrollable clear (failure 13 above). |
| 14 | Smaller items (desktop hint cut) | Fixed | The desktop signing bar hint wraps in full ("Nothing is required. Start goes to each / empty field."). No cut text anywhere. `desktop-b/031-b-individual-tax-form-open.jpg` |
| N1 | Two W-9 rows, one unsigned | Fixed | Priya Raman, an investor on file invited with "Include tax form", finished the W-9 unsigned. The firm used "Request tax form" and she signed it. Documents then lists exactly one row, "Form W-9 - Priya Raman · Form_W_9_Priya_Raman_signed.pdf". The unsigned envelope is voided "Replaced by the Form W-9 signed on November 20, 2026". Seen in 7 of 7 runs (`iphone-b`, `iphone-b-2`, `iphone-c`, `iphone-a2`, `desktop-b`, `iphone-b-cdn`, `iphone-c-cdn`). `iphone-b-2/329-b-tax-request-documents-w9-rows.jpg` |
| N2 | Filings asks for four missing files | Fixed | `formd-ui.js`, `edgar-access.js`, `bluesky-data.js`, `bluesky.js` and `filings-remote.js` are in the build, and Filings requests nothing missing. The same pattern now sits in Tax documents (failure 4). |
| N3 | Tax-form signature field 12 px | Fixed (touch layer) | The drawn boxes are still 7 to 15 px. The browser's hit test 11.95 px above and below each one's middle lands on its own touch layer, so no signature field is reported short. |
| N4 | Press lost to a redraw | Partly fixed | The console-link case did not recur (CPU 4x whole run). The W-8BEN "Finish" case recurred once (failure 7 above). |

## What worked

1. **Sponsor sign-up to first investor done, three exemptions, phone, plus once on desktop.** Under Rule 506(b) (phone
   twice, desktop), Rule 506(c) and Regulation A Tier 2:
   - Sign-up, the offering by hand with its agreement, and the fields confirmed and saved.
   - Four invited investors (U.S. individual, U.S. LLC, foreign individual, foreign entity) and two investors on file,
     with and without "Include tax form".
   - All 6 reached the done screen in every run (24 of 24 on the strict runs, plus 12 of 12 in the two cdnjs variants). The
     tax step appeared only when the box was ticked.
   - Approve, Countersign and Decline worked.
   - The W-9 signed late through "Request tax form" leaves one signed W-9 row (N1).
   - A co-investor added shows the sign-in email and its link (failure 2 is what happens when the link is opened).
2. **Filings** (phone and desktop):
   - The tab shows "First sale Nov 20, 2026 · 2 investors", "First Form D notice · Due Dec 7, 2026" and "State notice:
     Texas · To file", with a menu count of 2.
   - **Form D on screen**, typed in as a sponsor would (CIK, issuer, address, related person, industry, revenue range,
     items 8 to 16, signer). Review gave "0 to fix", then Sign off (the terms shown in full, then name and title). The
     result was "Signed off by Dana Whitfield, Managing Member, on Nov 20, 2026 · Form D filing, EDGAR access setup
     included $100 · Recorded · $100 due · Sending it to be filed needs the portal connected to its server."
     `iphone-x3-2/100`, `101`, `102`.
   - **EDGAR access:** 7 steps from "Step 1 of 7: Login.gov sign-in", each "Done", plus the Form ID answer sheet.
     `iphone-x3-2/103` to `107`.
   - **State filings:** Texas, with the order lines "State notice filings, any number of states $100 · State filing fee,
     Texas: To be confirmed · Filing system fee: To be confirmed · Due $100, fees to be confirmed".
     `iphone-x3-2/108`, `109`.
   - "I filed this myself": a wrong accession number answers "An accession number has 18 digits…". A right one moves the
     row to "Form D annual amendment · Due Nov 22, 2027".
3. **AML program page.** It shows the policy, the procedures in force, the screening log (both investors' automatic
   screening, "Sandbox: no matches"), training and reviews. Export gives an HTML file (3,176 B). `iphone-x3-2/110`,
   `113`.
4. **Tax documents.**
   - A K-1 package built for this walk (4 pages: a cover page, Maya's K-1 with one statement page, then Zoe's K-1) was
     imported on the phone. The reader had never seen it.
   - It was split into 2 packages with page 1 left loose. Maya was proposed "Last four and name agree" (Confirm
     together). Zoë was proposed "Name agrees; no number on the K-1" (one by one). Both were confirmed.
   - Once the contact was saved: "Deliver to these 2", then both "Waiting for consent". `iphone-x3-2/085` to `094`.
5. **The investor sees the tax document with consent.**
   - Before consent, Documents shows "Electronic delivery of tax documents · A tax document is waiting for you · Review
     and consent", with no title of the document.
   - The consent text is shown in full. After "I consent": "You consented on November 20, 2026 · Withdraw consent", and
     "Schedule K-1 (Form 1065) 2025" is listed.
   - It opens in the viewer ("k1-1065-2025-HR-1001.pdf · 69 KB · Available in the portal until May 20, 2027", 2 pages,
     Download).
   - Seen for Maya and Zoë, on phone and desktop. `iphone-x3-2/116`, `117`, `118`, `119`.
6. **Distributions with tax withheld and the ACH file.**
   - A $10,000 distribution was split $5,000 / $5,000. Typing 5,000 as Zoë's amount subject to withholding proposed
     "Withholding on a foreign investor · 30% of $5,000.00 · $1,500.00".
   - The file and the record waited ("A proposed tax withheld line is waiting: confirm or remove it.").
   - After Confirm, the table read Tax withheld $1,500.00 and Net $3,500.00 (totals $10,000 / $1,500 / $8,500).
   - ACH file `HARBOR_RIDGE_20261221_A.ach`: 10 records of 94 characters, with credits MAYA OKONKWO 500000 and ZOE
     MULLER 350000 cents (net). The batch control total was 850000.
   - The stored record keeps the withheld line with who confirmed it and when.
   - Zoë's Distributions page: "Dec 21, 2026 · $5,000.00 · Tax withheld $1,500.00 · Amount paid $3,500.00 · Scheduled".
   - Same on the desktop. `iphone-x3-2/071`, `072`, `129`.
7. **Tax withheld section.** It lists the foreign investor ("W-8BEN · signed · valid until December 31, 2029 · foreign
   tax number on file"). "Download worksheet for your CPA" gives a 224 B CSV. There is an IRS notices form.
   `iphone-x3-2/078`, `081`.
8. **Help inside the preview, with a stand-in for `window.claude`.**
   - **The stand-in.** It answers `use('sample')` with the real contract's function, which takes turns and returns
     `{text, truncated}`. The text is the JSON `{kind, answer}`, where the answer is the guide sentence sharing the most
     words with the question. It answers `use('permissions')` as granted.
   - **Sponsor (console bar Help) and investor (footer Help, on onboarding and in the portal).** The dialog shows the
     question field and Send. The question shows while waiting. The answer is drawn in the log, newest first, as the real
     dialog shows a server's answer.
   - **The request.** It carried the right audience's guide and not the other: the sponsor guide for an admin and the
     investor guide for an investor. The rules came first, and the note said "The person is an investor, on the investor
     portal page …". The options were model quick/low, no cache, and an abort signal.
   - **With the capability absent**, the field and Send still show, and the reply is "Help is not available right now."
     (an admin gets no contact line).
   - No vendor name appeared on any screen. The page also asks `use('downloads')` (answered null).
   - `iphone-new/006`, `010`, `034`, `056`; `iphone-x3-2/133`.
   - **Real answers can only be judged by the owner in the Claude app.** The stand-in proves the dialog, the request and
     the wiring, not the quality of an answer.
9. **Phone layout** (2,325 phone screens):
   - No control under the preview bar.
   - No sideways scroll.
   - No cut text measured. The one cut text seen was the bar's select (failure 8).
   - No field under 16 px.
   - Every tap target at least 24 px tall, or with a touch area of that size, except the two in failure 9.
10. **Countersign, viewer and downloads.** The firm's typed signature and Finish gave a completed envelope. The viewer
    zoomed to 2x. The signed agreement (154,629 B) and signed W-9s (about 184 KB) downloaded as PDFs.

## Outside requests and script errors

The counts cover 13 walk runs plus one first-load smoke check, 2,818 screens (`W/count3.py`). The policy refused every
outside request, and nothing reached the network (0 requests at the network layer).

| Refused request | Count | When |
|---|---|---|
| `fonts.googleapis.com` script faces stylesheet (signature.js) | 59 | first signing dialog of each page load |
| `fonts.googleapis.com` Funnel Display stylesheet (page `<link>`, brand.js) | 14 | 2 per page load (the walk counts loads after the first; the smoke check shows both on the first) |
| `cdnjs.cloudflare.com` pdf.js (intake.js) | 10 | each "Read documents" |
| Preconnects to `fonts.googleapis.com` / `fonts.gstatic.com` | not countable here | every load (a hint, not a request the policy reports) |

- **Missing files:** `tax1099-ui.js` and `taxlink.js`, 20 each.
- **Script errors** other than the policy refusals and those 404s: the co-investor `TypeError` (failure 2), 4 runs.
- No error toast, no raw error text, no placeholder text, and no vendor name on any screen.

## Could not be tested

- **The iPhone itself.** No WebKit here, so the following were not seen:
  - the focus zoom and the blank-to-tray behaviour of failure 9;
  - the on-screen keyboard;
  - the file picker in the app's frame;
  - whether a generated file is offered for download;
  - mailto and Copy link from the frame;
  - pinch zoom and safe areas;
  - whether the app's frame keeps localStorage and IndexedDB, which decides whether failure 1 can happen to the owner.
- **The Claude app's real policy.** Whether it lets cdnjs scripts (failure 1) and Google Fonts (failures 3 and 5) load
  decides how much of this the owner sees. The walk used the strictest reading.
- **Real Help answers.** These need the Claude app's `sample` capability; only the owner can judge them there.
- **A server.** Sending Form D or state filings to be filed, emailing the co-investor and sending invitations by email
  all need one.
- **Not walked:**
  - re-issuing an agreement after "Continue and sign later";
  - backup withholding (offerings set to notes or a corporation);
  - the list import's package box;
  - the co-investor link on an account whose agreement is fully countersigned or has co-investor places.

## How it was walked

- **Frame.** `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"`, served
  from the build folder at its relative paths, with this policy:
  `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; form-action 'none'`.
  Every run first proved that a fetch of a file that exists is refused ("Failed to fetch"). The browser context answered
  nothing outside, and counted any outside request.
- **The cdnjs variant runs** (`iphone-b-cdn`, `iphone-c-cdn`) allowed only the two script hosts. pdf.js was answered from
  the checks' local copy, to walk the intake.
- **Devices.** 390x844 with touch and an iOS user agent: finger taps and drawn signatures. The CPU was slowed 4x for the
  Finish-then-type flows and for the whole `cs` run. The desktop was 1280x800 with a mouse.
- **Runs** (final set; screens):

  | Run | Screens |
  |---|---|
  | `iphone-b-2` (506(b)) | 365 |
  | `iphone-c` (506(c)) | 353 |
  | `iphone-a2` (Reg A) | 355 |
  | `desktop-b` | 359 |
  | `iphone-x3-2` (new sections) | 134 |
  | `desktop-x3-2` (new sections) | 133 |
  | `iphone-new` (Help, package, Filings, viewer) | 101 |
  | `iphone-cs-cpu4` | 35 |
  | `iphone-front` (sample portal) | 182 |
  | `iphone-reload` | 37 |
  | `iphone-noidb-reload-2` | 34 |
  | `iphone-b-cdn` | 366 |
  | `iphone-c-cdn` | 363 |

  Probes:
  - `smoke-iphone` (first load);
  - `iphone-fdtest` (Form D alone);
  - `probe-fe-iphone` (field editor finger reach).

  Earlier runs replaced by these are kept: `iphone-b-run1`, `iphone-b`, `iphone-x3`, `desktop-x3`,
  `iphone-noidb-reload`, `iphone-x3-2-killed`.
- **Queue.** Browser runs went through `.planning/tools/heavy.sh`. The three probes ran directly.
- **Scripts.** `W/` holds `walk.js`, `wlib.js`, `flow.js` and `common.js`, extended from walkthrough 2:
  - the strict frame on b14, and a stand-in `window.claude`;
  - Help through the stand-in;
  - the N1 row check and the co-investor step;
  - chapter `x3` (withholding, Tax documents, Filings with the Form D filler, EDGAR access, state notices, AML, consent);
  - the by-hand offering fallback.

  Analysis is in `lg.py`, `agg3.py` and `count3.py`, findings as found in `W/findings.md`, and per-run logs in
  `W/out/<run>/log.jsonl`.

## Faults in the walk's own scripts (found and corrected; none counted above)

- **x3 distribution.** The first `x3` run skipped the capital call, so Distributions said "No investors hold this
  offering". It also did not save the tax contact, so Deliver was refused, which is how failure 6 was found.
- **Form D filler.** The first filler lost its fields when the form redrew. It was rewritten to find each field by its
  `data-field`, and the `fdtest` probe proved it.
- **Co-investor step.** The first version did not find Maya's "Account" because the walk's own sweep had left the
  Investors filter on a two-investor tab. It now presses "All" first. Failure 2 was then reproduced on Maya's account.
- **x3 Help.** In the first `x3` run Maya's portal was reached as admin, so its Help correctly sent the sponsor guide. The
  record "help-wrong-guide" there is the walk's own fault.
- **Earlier audit.** The audit used for `iphone-b`, `iphone-x3` and the first `x3` runs counted read-only blanks as typed
  fields and ignored signature touch layers. It was corrected before the final runs; the earlier records of those two
  kinds are not counted.

_Walked: 2026-11-20. Walker: Claude (owner-path walkthrough, read only)._
