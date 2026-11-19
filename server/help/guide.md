# The help guide (the one source)

Everything above the first section is a note for authors and is not sent to the assistant.

- One section per page and per step of the self-serve portal, written from the screen itself. Run `node server/help/build.mjs` after every change; `npm --prefix server test` fails when a page has no section, when the generated module is stale, or when a quoted name is no longer in the portal's source.
- Fields sit directly under the heading: audience (sponsor, investor, both), kind (console, portal, step, page), title, menu (optional), and one or more anchor lines (a text the screen shows, verbatim in the file that registers the route). Then a blank line and the text.
- Put a name in straight double quotes only when it is exactly the text on the screen. Write nothing the screen does not show.
- No vendor, model or product name, no email address, no advice. Investor sections never mention the sponsor's side.
- Routes and steps left out go in the last section, skip, each with its reason.

## console
audience: sponsor
kind: console
title: Overview
menu: Overview, at the top
anchor: Needs attention
anchor: Recent distributions

The first page of the console. The menu on every console page has Overview and Notifications at the top, then four groups: Raise (Offerings, Offering intake, Investors, E-sign), Operate (Capital calls, Distributions, Requests, Notices, Documents), Report (Reports, Audit, AML/KYC) and Settings (Portal and brand, Integrations, ACH origination, Team). A team member's menu has no Offering intake, Portal and brand, Integrations or Team: only an admin opens those four pages, so a team member asks an admin.

Overview shows:
- "Setup": a checklist for a new portal. Choose "Start" or "Review" beside an item to open its page, or "Remove" to take the item off the list.
- Four totals: active offerings, investors, capital raised, and the amount distributed in the last 12 months.
- "Funds": each fund's net assets, investors, contributed and distributed amounts, with a link to "Audit schedules".
- "Needs attention": what is waiting, for example investors who have not finished activating, envelopes waiting for a countersignature, requests waiting for approval and screening matches to review. Choose a line to open the page where it is handled.
- "Recent distributions", with "All distributions".

## console-notifications
audience: sponsor
kind: console
title: Notifications
menu: Notifications, at the top
anchor: Investors opening their invitation, finishing onboarding and signing, verifications held for review and subscriptions accepted.
anchor: Mark all read

Notifications tell the firm when an investor opens their invitation, starts or finishes onboarding or signs, when a verification is held for review and when a subscription is accepted. The number beside Notifications in the menu is the count of unread ones.

- The bell at the top of the menu opens the latest notifications in a small window; "All notifications" there opens this page.
- Filter the list with All and Unread.
- Choose a notification to open the page it is about; it is then marked as read.
- "Mark all read" marks every notification as read.

## console-offerings
audience: sponsor
kind: console
title: Offerings
menu: Raise, then Offerings
anchor: Each investment is configured separately: how exit is defined, how often it pays, and which terms investors see.
anchor: Set up from documents
anchor: Add offering

The list of the firm's offerings with type, closing date, amount raised, investors, distributions, exit and status (Raising, Active or Exited). Choose an offering's name to open its page.

To add an offering:
1. Choose "Add offering". A new offering is created and its page opens.
2. Fill in "Offering details" and the other sections on that page.

To have the portal fill in an offering from its documents instead, choose "Set up from documents"; it opens Offering intake. Offerings are set up by an admin; for a team member they are read-only.

## console-offering
audience: sponsor
kind: console
title: Offering
menu: Raise, then Offerings, then the offering's name
anchor: Offering details
anchor: Exit timing
anchor: Remove offering

One offering's settings. The page ends with "What investors see", a preview of the offering as investors see it. Its sections:
- "Offering details": "Offering name", "Short name", "Type", "Status", "Closing date", "One-line description", "Minimum investment ($)" and "Securities exemption".
- "Investor eligibility" and "Benefit plan investors": counts from investors' own answers, shown for the firm to judge.
- "Subscription agreement": choose "Add the subscription agreement" to upload the agreement once and place the fields investors fill in and sign. Every investor invited to the offering then signs it online during onboarding. Once it is there, "Edit fields", "Replace the PDF" and "Remove" change it.
- "Exit timing": "How exit is defined", its dates, and "Note shown to investors".
- "Distributions": "Frequency", "Default payment type" and "Target or rate shown to investors".
- "Fund accounting" and "Structure" (with "Edit structure"): fees, carried interest, preferred return, auditor and waterfall, used for the audit package.
- "Key terms shown to investors": tick "Show" for each term investors see; "Add term" adds one.
- "Latest update": text shown on the investor's investment page.
- "ACH originator for this offering": a company name and ID when the offering pays from its own bank account.
- "Remove offering": only an offering with no investors can be removed.

At the top, "Investor sign-up link" gives a link investors use to sign up for this offering on their own, and "Preview as investor" shows the offering in the investor portal.

## console-intake
audience: sponsor
kind: console
title: Offering intake
menu: Raise, then Offering intake
anchor: Offering intake
anchor: Read documents

Only an admin opens this page; a team member asks an admin. Here the portal reads a fund's offering documents and sets up the offering from them. Every term is shown for review, with the passage it came from, before anything changes.

1. Under "Documents", upload the private placement memorandum, the partnership or operating agreement, the subscription documents or a term sheet (PDF, Word or text), or use "Or paste the summary of terms". A scanned PDF with no text layer needs OCR first.
2. Under "Apply to", choose "A new offering" or the offering to update.
3. Optional: tick the box that makes the uploaded documents available to investors in the offering.
4. Choose "Read documents", then review the terms that were filled in.

## console-investors
audience: sponsor
kind: console
title: Investors
menu: Raise, then Investors
anchor: Invite investors with one link, follow their progress, and see how each investor is paid.
anchor: Invite an investor

This page lists every investor with their type, amount invested, activation and how they are paid. The filters above the table are All, Not activated and Paid by check.

To invite an investor:
1. Choose "Invite an investor" at the top of the page.
2. Stay on "One investor" and fill in "First name", "Last name" and "Email".
3. Check "Investor type": it decides the tax form the investor is shown, and the investor can correct it during onboarding.
4. Optional: open "More options (optional)" to set the account name, the offering, the commitment or a personal note. With no offering chosen, the investor sets up their account only.
5. Choose "Send invitation".

The investor gets one link that walks them through every step. To invite several investors at once, choose "Import a list", upload a CSV or Excel file or paste the list, choose "Check list", then send. "Add manually" is for an investor onboarded offline on paper documents: they are added as an active investor and are not sent the onboarding link.

Under "Invitations", follow each invitation with In progress, Completed and All; ticking "Accept subscriptions automatically once the agreement is countersigned and the investor is verified" accepts a subscription without a separate approval. In the investor table, "View portal" shows the portal as that investor sees it; an investor who has not activated has "Invitation" and "Send reminder" instead. With no integration server connected, the firm sends each invitation from its own email app: the portal prepares the email with the link.

## console-esign
audience: sponsor
kind: console
title: E-sign
menu: Raise, then E-sign
anchor: New envelope
anchor: Continue to place fields

Send PDFs for electronic signature, track who has viewed and signed, and keep the signed copy with a certificate of completion. The page has two lists, Envelopes and Templates.

To send a document for signature:
1. Choose "New envelope".
2. Under "Document", choose "Upload a PDF" (one PDF, up to 25 MB), "Use a template" or "Published document".
3. Enter a "Title" and, if it belongs to one, the offering.
4. Under "Signers from the investor roster", pick the investors who sign. Tick "Add a sponsor countersigner" if the firm signs too.
5. Choose the "Signing order": "In order" or "Any order".
6. Choose "Continue to place fields". The envelope's page opens, where the fields are placed and the envelope is sent.

In the Envelopes list, "Open" opens an envelope, "Remind" emails the signers who have not signed, "Void" cancels an envelope that is out for signature, and a completed envelope has "Signed PDF" and "Certificate". An envelope that waits for the firm's signature shows "Countersign". A template is made from an envelope with "Save as template".

## console-envelope
audience: sponsor
kind: console
title: Envelope
menu: Raise, then E-sign, then Open beside an envelope
anchor: Recipients
anchor: Review and send
anchor: Save as template

One envelope: a document, its signers and its status.
- "Recipients": each signer with their order, role, status and when they viewed and signed.
- "Details": status, file, signing order and the dates it was sent and completed.
- "Document": the Show pages button previews the pages with each signer's fields and what has been filled so far.
- A completed envelope also has "Signed record" (the record ID and the SHA-256 of the original and the signed PDF), "Verify a signed copy" (choose "Choose a PDF" to check a file against the stored record; the file is read in the browser only) and "Audit trail", the list of every event.

A draft envelope is where fields are placed for each signer. When the fields are placed, send it with "Review and send"; "Save as template" keeps the PDF and its fields for reuse. When the firm is a signer and its turn has come, "Sign as sponsor" opens the document to countersign. A completed envelope has "Signed PDF" and "Certificate" at the top.

## console-calls
audience: sponsor
kind: console
title: Capital calls
menu: Operate, then Capital calls
anchor: New capital call
anchor: Issue call and notify investors

Call capital from investors in drawdown funds. Each investor's share is pro rata to their commitment. Investors get the notice and wire instructions in their portal, and every payment is tracked until the call is fully funded. "Commitments" shows each fund's commitments, contributed, called and unfunded amounts; "Calls" lists every call with its status.

To issue a call:
1. Choose "New capital call". The button shows only when a fund has unfunded commitments.
2. Choose the "Fund", then enter "Percent of commitments" or "Total amount ($)", the "Due date" and the "Purpose".
3. Check "Allocation by investor".
4. Choose "Issue call and notify investors".

To record money received, choose the call in "Calls", then "Record payment" beside an investor or "Record all as received". Recording a payment adds the contribution to the investor's capital account. From the same page a reminder can be sent to the investors who have not paid.

## console-distributions
audience: sponsor
kind: console
title: Distributions
menu: Operate, then Distributions
anchor: Allocate a payment pro rata by amount invested, then generate the NACHA file for the bank.
anchor: Generate NACHA file
anchor: Record distribution

Allocate a payment to an offering's investors pro rata by amount invested, then make the NACHA file for the bank.

Under "New distribution":
1. Choose the "Offering" and the "Payment type".
2. Set the "Payment (effective) date". Banking days only; most banks need files 1 to 2 banking days ahead.
3. Under "Amount", choose "Annualized rate" or "Total amount" and enter the figure.
4. Optional: change "Bank statement description (10)", up to 10 characters.
5. Check the table: each investor's share, amount and how they are paid (ACH or check).
6. Choose "Generate NACHA file" to download the file for the bank, and "Record distribution" to record the payment.

"History" lists past distributions; "ACH file" beside one downloads its file again. The bank details in the file come from the ACH origination page.

## console-requests
audience: sponsor
kind: console
title: Requests
menu: Operate, then Requests
anchor: Investor requests
anchor: Approve
anchor: Decline

The page's heading is "Investor requests". It lists the redemptions and subscriptions investors submit and e-sign in their portal. The number beside Requests in the menu is the count waiting.

1. Use Open or All above the list to filter.
2. Choose "Approve" or "Decline" beside a request.
3. After approving, record the payment or the funding from the same row when it happens. The investor register, capital accounts and audit schedules then update automatically.

Redemptions are paid at net asset value on the dealing date, which follows the fund's notice period and lock-up; the payment can be recorded once that month's valuation is final.

## console-notices
audience: sponsor
kind: console
title: Notices
menu: Operate, then Notices
anchor: Email investors when reports or documents are posted.
anchor: New notice
anchor: Sent notices

Email investors when reports or documents are posted. Each email is personalized and also appears as a notice in the investor's portal.

Under "New notice":
1. Choose a "Template": "Quarterly report available", "New documents uploaded" or "Custom message".
2. Under "Send to", choose all investors or the investors in one offering. To send to particular people only, pick them under "Specific investors"; the notice then goes only to them.
3. Optional: tick "Include investors who have not activated their accounts". Their email links to account activation instead of sign-in.
4. Check the "Subject" and "Message". The words in braces listed under the message are replaced for each investor.
5. Read the preview beside the form, then choose the send button, which names the number of investors.

"Sent notices" lists what was sent, to whom and by whom.

## console-docs
audience: sponsor
kind: console
title: Documents
menu: Operate, then Documents
anchor: Publish documents
anchor: Match investor IDs in file names

Publish quarterly reports, capital account statements, tax documents and notices to investor portals.

Under "Publish documents":
1. Under "Files", choose the files. PDF is preferred, up to 25 MB each.
2. Choose the "Type" (Reports, Statements, Tax, Legal, Notices or Other) and the "Fund".
3. Under "Who receives each file", choose "All investors", or "Match investor IDs in file names" to send each file only to the investor whose ID is in its name.
4. Enter a "Title" and the "Document date".
5. Optional: tick "Notify recipients that new documents are in their portal".
6. Choose "Publish".

"Published" lists every document with its recipients; "Remove" takes one out of the investors' portals. Investors find published documents on their Documents page.

## console-reports
audience: sponsor
kind: console
title: Reports
menu: Report, then Reports
anchor: Distribution reports for any period and investor contact lists.
anchor: Download CSV

Distribution reports for any period, and investor contact lists. Downloads are CSV files.

1. Choose "Distributions" or "Contacts" at the top.
2. For distributions, choose the "Period" (for example "This quarter", "Year to date" or "Custom dates"), the "Offering" and the "View": "By investor", "By payment" or "By offering". Tick "Include scheduled payments" to add payments not yet made.
3. Choose "Download CSV".

## console-audit
audience: sponsor
kind: console
title: Audit
menu: Report, then Audit
anchor: Download audit package
anchor: Audit readiness

Audit-ready records for each fund: financial statements, capital accounts, investor register, capital activity, schedule of investments, fees, performance and a change log.

1. Choose the "Fund" and the "Period".
2. Read "Audit readiness": each check says Pass or lists its exceptions, for example an investor with no tax form on file.
3. Under "Audit package", "Preview" shows a schedule on the page and each file can be downloaded on its own.
4. Choose "Download audit package" for one .zip with every schedule as a CSV, a README and a SHA-256 manifest. Every download is recorded in the change log.

## console-kyc
audience: sponsor
kind: console
title: AML/KYC
menu: Report, then AML/KYC
anchor: AML/KYC
anchor: Review match
anchor: Re-screen

Identity verification, sanctions and PEP screening and accredited investor checks run automatically through the connections set on the Integrations page. Anything flagged, and any check waiting on the team, waits here. The number beside AML/KYC in the menu is the count waiting.

- The four totals are Cleared, Needs review, Re-screening due, and In progress or not started.
- Filter the table with "Needs attention" or "All investors".
- "Review match" beside an investor opens a potential screening match for the team to decide.
- "Re-screen" beside an investor runs the screening again; the button at the top of the page re-screens every investor whose re-screening is due.

How often investors are re-screened is set on the Integrations page.

## console-brand
audience: sponsor
kind: console
title: Portal and brand
menu: Settings, then Portal and brand
anchor: How your portal looks to investors, and what onboarding asks of them.
anchor: Support and disclosures

Only an admin opens this page; a team member asks an admin. It sets how the portal looks to investors and what onboarding asks of them. "Investor portal preview" beside the settings shows the result.
- "Identity": "Firm name", "Short name", "Logo tagline", "Legal entity", "Portal name" and "Custom domain".
- "Logo": a monogram or another mark, or "Upload image" for a logo file (PNG, SVG, JPG or WebP under 400 KB).
- "Color": "Primary" and "Accent".
- "Investor home page": the "Hero image", "About your firm" and up to three headline figures.
- "Type and layout": "Typeface", "Header", "Corners" and "Appearance".
- "Investor onboarding": "Ask for accreditation", "Require consent to electronic delivery", and "Direct deposit" as "Required" or "Optional (check allowed)".
- "Support and disclosures": the support "Team name", "Email", "Phone" and "Hours" investors see, the "Sign-in heading", "Sign-in text" and "Footer disclosure".
- "Configuration": "Copy JSON" copies the portal's configuration for backup.

## console-integrations
audience: sponsor
kind: console
title: Integrations
menu: Settings, then Integrations
anchor: Add a connection
anchor: Approval rules
anchor: Check connection

Only an admin opens this page; a team member asks an admin. Investors are verified while they onboard: identity, sanctions and PEP screening, and accredited investor status. This page sets which verification services run and the rules for approval. Choose "Save" at the top after a change.
- "What runs for each check": the connections that are on for "Identity verification", "Sanctions and PEP screening" and "Accredited investor verification".
- "Connections": "Add a connection" adds a verification service the firm uses. Two are built in and cannot be removed, only turned off: "Sandbox" (simulated results for trying the flow; turn it off before inviting real investors) and "Upload for your team to review" (investors upload an ID or a verification letter and the team records the result on the AML/KYC page).
- "Approval rules": "Approve investors automatically when every check passes", "Require verified accreditation", "Accreditation valid for (days)", "Re-screen investors every (days)" and "Hold politically exposed persons for enhanced due diligence".
- "Integration server": enter the "Server address" and, if one is set, the "Access token", then choose "Check connection". With a server connected, invitations are emailed automatically and investors can onboard on any device.

## console-ach
audience: sponsor
kind: console
title: ACH origination
menu: Settings, then ACH origination
anchor: Bank details used to build NACHA files for distributions.
anchor: Paying entity by offering

The bank details used to build NACHA files for distributions. Copy them from the bank's ACH origination agreement. The page says "Ready to generate files" when the details are complete.
- "Originating bank (ODFI)": "Bank name" and "Routing number".
- "File header": "Immediate destination routing" (usually the same as the ODFI routing number), "Immediate destination name", "Immediate origin" (assigned by the bank) and "Immediate origin name".
- "Batch defaults": "Company name" (shown on investors' bank statements), "Company ID" and "Entry description".
- "SEC codes": PPD for individuals, joint accounts and trusts; CCD for entities and IRA custodians. Files are split into one batch per code.
- "Balanced files": adds an offsetting debit to each batch. Some banks require this; most do not.
- "Paying entity by offering": the company name and ID each offering pays under. To change one, open the offering's page and fill in "ACH originator for this offering".

## console-team
audience: sponsor
kind: console
title: Team
menu: Settings, then Team
anchor: Who can sign in to your console, and what each person can do.
anchor: Invite someone

Only an admin opens this page; a team member asks an admin. It lists who can sign in to the console, with each person's role and status.

To add a person, under "Invite someone":
1. Enter "First name", "Last name" and "Email".
2. Choose the "Role": "Admin" or "Team member".
3. Choose "Send invitation". They get an email to set a password and turn on two-step sign-in.

An admin has everything: offerings, brand, integrations and team, plus all operations. A team member has operations: investors, e-sign, capital calls, distributions, requests, documents, notices, reports, audit and AML/KYC review; offerings, brand and integrations are read-only.

## diy-start
audience: sponsor
kind: page
title: Create your portal
anchor: Create your portal
anchor: Create my portal

The sign-up page for a firm.
1. Enter "Firm name", "First name", "Last name", "Work email" and a "Password" of at least 10 characters.
2. Answer "What do you raise?".
3. Choose a "Brand color" and, if wanted, upload a logo (PNG, JPG or SVG). Both can be changed later.
4. Choose "Create my portal". No card is needed to start.

"Explore a sample portal" opens a sample firm's portal to look around. Investors only ever see the firm's own brand.

## skip
console-new-client: the managed edition's page for adding a client; the self-serve edition does not have it
