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

The console's first page. Every console page's menu: Overview and Notifications at the top, then four groups, Raise (Offerings, Offering intake, Investors, E-sign), Operate (Capital calls, Distributions, Requests, Notices, Documents, Tax documents, Accounting), Report (Reports, Audit, AML/KYC, AML program, Filings) and Settings (Portal and brand, Integrations, ACH origination, Team). A team member's menu lacks Offering intake, Portal and brand, Integrations and Team (admin only), so a team member asks an admin.

Overview shows:
- "Setup": a new portal's checklist. "Start" or "Review" beside an item opens its page; "Remove" takes it off the list.
- Four totals: active offerings, investors, capital raised and amount distributed in the last 12 months.
- "Funds": each fund's net assets, investors, contributed and distributed, with a link to "Audit schedules".
- "Needs attention": what waits, such as unfinished activations, envelopes to countersign, requests to approve and screening matches to review; a line opens the page handling it.
- "Recent distributions", with "All distributions".

## console-notifications
audience: sponsor
kind: console
title: Notifications
menu: Notifications, at the top
anchor: Investors opening their invitation, finishing onboarding and signing, verifications held for review and subscriptions accepted.
anchor: Mark all read

They tell the firm when an investor opens their invitation, starts or finishes onboarding or signs, when a verification is held for review and when a subscription is accepted. The number beside Notifications in the menu counts unread ones.

- The bell at the top of the menu shows the latest in a small window; its "All notifications" opens this page.
- Filter with All and Unread.
- A notification opens the page it is about and is marked read.
- "Mark all read" marks them all read.

## console-offerings
audience: sponsor
kind: console
title: Offerings
menu: Raise, then Offerings
anchor: Each investment is configured separately: how exit is defined, how often it pays, and which terms investors see.
anchor: Set up from documents
anchor: Add offering

The firm's offerings with type, closing date, amount raised, investors, distributions, exit and status (Raising, Active or Exited). An offering's name opens its page.

To add one:
1. Choose "Add offering": a new offering is created and its page opens.
2. Fill in "Offering details" and the page's other sections.

Or "Set up from documents" opens Offering intake to fill in an offering from its documents. Offerings are set up by an admin; a team member sees them read-only.

## console-offering
audience: sponsor
kind: console
title: Offering
menu: Raise, then Offerings, then the offering's name
anchor: Offering details
anchor: Exit timing
anchor: Remove offering

One offering's settings, ending with "What investors see", a preview as investors see it. Sections:
- "Offering details": "Offering name", "Short name", "Type", "Status", "Closing date", "One-line description", "Minimum investment ($)" and "Securities exemption".
- "Investor eligibility" and "Benefit plan investors": counts from investors' own answers, for the firm to judge.
- "Subscription agreement": "Add the subscription agreement" uploads it once and places the fields investors fill in and sign; every investor invited to the offering then signs it online in onboarding. If it has co-investor places, the section says so and names investors with no co-investor on their account. "Edit fields", "Replace the PDF" and "Remove" change it.
- "Exit timing": "How exit is defined", its dates, and "Note shown to investors".
- "Distributions": "Frequency", "Default payment type" and "Target or rate shown to investors".
- "Fund accounting" and "Structure" (with "Edit structure"): fees, carried interest, preferred return, auditor and waterfall, for the audit package.
- "Key terms shown to investors": tick "Show" for each term investors see; "Add term" adds one.
- "Latest update": text shown on the investor's investment page.
- "ACH originator for this offering": a company name and ID when the offering pays from its own bank account.
- "Remove offering": only for an offering with no investors.

At the top, "Investor sign-up link" gives investors a link to sign up on their own; "Preview as investor" shows the offering in the investor portal.

"Tax reporting", in "Offering details", sets how the offering reports investors' tax: Schedule K-1, Form 1099-INT, Form 1099-DIV or documents from the CPA. Only admins set it. While it is unset, and for a partnership or other, a distribution proposes no backup withholding.

## console-intake
audience: sponsor
kind: console
title: Offering intake
menu: Raise, then Offering intake
anchor: Offering intake
anchor: Read documents

Admin only; a team member asks an admin. The portal reads a fund's offering documents and sets up the offering, showing every term with the passage it came from for review before anything changes.

1. Under "Documents", upload the private placement memorandum, partnership or operating agreement, subscription documents or a term sheet (PDF, Word or text), or use "Or paste the summary of terms". A scanned PDF with no text layer needs OCR first.
2. Under "Apply to", choose "A new offering" or the offering to update.
3. Optional: tick the box to make the uploaded documents available to the offering's investors.
4. Choose "Read documents", then review the terms filled in.

## console-investors
audience: sponsor
kind: console
title: Investors
menu: Raise, then Investors
anchor: Invite investors with one link, follow their progress, and see how each investor is paid.
anchor: Invite an investor

Every investor with their type, amount invested, activation and how they are paid. Filters above the table: All, Not activated and Paid by check.

To invite an investor:
1. Choose "Invite an investor" at the top.
2. Stay on "One investor" and fill in "First name", "Last name" and "Email".
3. Check "Investor type": it decides the tax form shown, and the investor can correct it in onboarding.
4. Optional: "More options (optional)" sets the account name, offering, commitment or a personal note. With no offering, the investor only sets up their account.
5. Choose "Send invitation".

The investor gets one link for every step. To invite several, choose "Import a list", upload a CSV or Excel file or paste the list, choose "Check list", then send. "Add manually" adds an investor onboarded offline on paper as active, sending no onboarding link.

"Invitations" tracks each invitation (In progress, Completed, All); ticking "Accept subscriptions automatically once the agreement is countersigned and the investor is verified" turns that on. An invitation whose agreement waits for the firm's signature has "Countersign". In the table, "View portal" shows the portal as that investor sees it; an investor not yet activated has "Invitation" and "Send reminder" instead. With no integration server connected, the firm sends each invitation, prepared with its link, from its own email app.

A co-investor is a second person on an investor's account, for example a spouse investing jointly. To add one to an investor on file: choose "Account" beside the investor in the table, then "Add co-investor", fill in "First name", "Last name" and "Email" (their own, not the investor's) and choose "Add co-investor". An account has one co-investor, who signs their own places on its agreements with their own sign-in. The "Co-investor sign-in email" then opens with their link, which opens only their places: send it with "Open in your email app" (or "Copy link"), then choose "Mark as sent"; until then the row says "Sign-in link ready to send". "Sign-in link" in the "Account" window reopens the email. A changed email gives a new link and stops the old one.

With the integration server connected, nothing is sent by hand: the co-investor's sign-in is emailed once the investor has signed, and the row says "Sign-in emailed" with the date (before that, "Sign-in is emailed once" the investor "has signed"); a changed email or "Remove co-investor" cancels the link sent.

An admin records a W-9 the investor signed on paper, or an uploaded completed W-9 showing the last four digits of the taxpayer number, with "W-9 signed on paper" under the investor's activation; "Undo" removes the record. Without it, a distribution of an offering set to notes or to a corporation or REIT proposes backup withholding for that investor.

An agreement still out for signature with co-investor places adds the co-investor as a signer after the investor and before the firm; the investor does not sign again. Fully signed agreements stay as they are. The "Account" window also has "Change co-investor" and "Remove co-investor". When an offering's agreement has co-investor places but the account has none, the row says "Agreement has places for a co-investor", and "This investor has no co-investor" in the "Account" window says there is none.

## console-esign
audience: sponsor
kind: console
title: E-sign
menu: Raise, then E-sign
anchor: New envelope
anchor: Continue to place fields

Send PDFs for electronic signature, track who has viewed and signed, and keep the signed copy with a certificate of completion. Two lists: Envelopes and Templates.

To send for signature:
1. Choose "New envelope".
2. Under "Document", choose "Upload a PDF" (one PDF, up to 25 MB), "Use a template" or "Published document".
3. Enter a "Title" and, if it belongs to one, the offering.
4. Under "Signers from the investor roster", pick the signing investors; tick "Add a sponsor countersigner" if the firm signs too.
5. Choose the "Signing order": "In order" or "Any order".
6. Choose "Continue to place fields": the envelope's page opens to place fields and send.

In Envelopes, "Open" opens an envelope, "Remind" reminds signers who have not signed, "Void" cancels one out for signature, and a completed one has "Signed PDF" and "Certificate". Open the envelope to countersign ("Sign as sponsor") or make a template ("Save as template").

## console-envelope
audience: sponsor
kind: console
title: Envelope
menu: Raise, then E-sign, then Open beside an envelope
anchor: Recipients
anchor: Review and send
anchor: Save as template

One envelope: its document, signers and status.
- "Recipients": each signer's order, role, status and when they viewed and signed.
- "Details": status, file, signing order and dates sent and completed.
- "Document": the Show pages button previews the pages with each signer's fields and what is filled.
- A completed envelope also has "Signed record" (record ID and SHA-256 of the original and signed PDF), "Verify a signed copy" ("Choose a PDF" checks a file against the stored record, reading it in the browser only) and "Audit trail", every event.

In a draft, place each signer's fields, then send with "Review and send"; "Save as template" keeps the PDF and its fields for reuse. When it is the firm's turn to sign, "Sign as sponsor" opens the document to countersign. A completed envelope has "Signed PDF" and "Certificate" at the top.

## console-calls
audience: sponsor
kind: console
title: Capital calls
menu: Operate, then Capital calls
anchor: New capital call
anchor: Issue call and notify investors

Call capital from investors in drawdown funds, pro rata to each investor's commitment. Investors get the notice and wire instructions in their portal; every payment is tracked until the call is fully funded. "Commitments" shows each fund's commitments, contributed, called and unfunded amounts; "Calls" lists every call with its status.

To issue a call:
1. Choose "New capital call" (shown only when a fund has unfunded commitments).
2. Choose the "Fund", then enter "Percent of commitments" or "Total amount ($)", "Due date" and "Purpose".
3. Check "Allocation by investor".
4. Choose "Issue call and notify investors".

To record money received, choose the call in "Calls", then "Record payment" beside an investor or "Record all as received"; the contribution is added to the investor's capital account. A reminder can be sent from there to investors who have not paid.

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
1. Choose the "Offering" and "Payment type".
2. Set the "Payment (effective) date": banking days only; most banks need files 1 to 2 banking days ahead.
3. Under "Amount", choose "Annualized rate" or "Total amount" and enter the figure.
4. Optional: change "Bank statement description (10)", up to 10 characters.
5. Check the table: each investor's share, amount and how they are paid (ACH or check).
6. "Generate NACHA file" builds the bank's file; "Record distribution" records the payment.

"History" lists past distributions; "ACH file" beside one builds its file again. The file's bank details come from the ACH origination page.

Under the table, "Tax withheld" lists each proposed line (investor, reason, rate, amount): backup withholding at 24% when the offering's "Tax reporting" is notes or a corporation or REIT, and for a foreign investor 30% of the "Amount subject to withholding" you enter, or the "Rate from your CPA (%)". Nothing is withheld until you choose "Confirm"; "Remove" takes a line off. "Add tax withheld" enters a figure your CPA gives for other kinds, with a reason. The two buttons wait until every line is confirmed or removed; the file then pays each investor the amount less tax withheld. Changing the offering, date or amount clears the decisions.

An admin's "Cancel" in "History" cancels a distribution recorded by mistake, with a reason: it then reads "Cancelled" and is paid nowhere.

## console-requests
audience: sponsor
kind: console
title: Requests
menu: Operate, then Requests
anchor: Investor requests
anchor: Approve
anchor: Decline

Headed "Investor requests": the redemptions and subscriptions investors submit and e-sign in their portal. The number beside Requests in the menu counts those waiting.

1. Filter with Open or All above the list.
2. Choose "Approve" or "Decline" beside a request.
3. After approving, the row has "Record payment" for a redemption or "Record funding" for a subscription to an open-ended fund: choose it once the money has moved. For a commitment whose subscription agreement still waits for the firm's signature, it has "Countersign", which opens the agreement to sign as the firm; once signed, the commitment goes on the investor register. The register, capital accounts and audit schedules then update automatically.

Redemptions are paid at net asset value on the dealing date, which follows the fund's notice period and lock-up; the payment can be recorded once that month's valuation is final.

## console-notices
audience: sponsor
kind: console
title: Notices
menu: Operate, then Notices
anchor: Email investors when reports or documents are posted.
anchor: New notice
anchor: Sent notices

Email investors when reports or documents are posted. Each email is personalized and also shows as a notice in the investor's portal.

Under "New notice":
1. Choose a "Template": "Quarterly report available", "New documents uploaded" or "Custom message".
2. Under "Send to", choose all investors or one offering's investors, or pick people under "Specific investors" to send to them only.
3. Optional: tick "Include investors who have not activated their accounts"; their email links to account activation instead of sign-in.
4. Check "Subject" and "Message"; the words in braces listed under the message are replaced for each investor.
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
1. Under "Files", choose the files: PDF preferred, up to 25 MB each.
2. Choose the "Type" (Reports, Statements, Tax, Legal, Notices or Other) and "Fund".
3. Under "Who receives each file", choose "All investors", or "Match investor IDs in file names" to send each file only to the investor whose ID is in its name.
4. Enter a "Title" and "Document date".
5. Optional: tick "Notify recipients that new documents are in their portal".
6. Choose "Publish".

"Published" lists every document with its recipients; "Remove" takes one out of the investors' portals. Investors see them on their Documents page.

## console-taxdocs
audience: sponsor
kind: console
title: Tax documents
menu: Operate, then Tax documents
anchor: Confirm together
anchor: Not this one

Take in the tax documents the CPA prepared and confirm whose each one is. A confirmed document shows "Not delivered": investors do not see it yet.

To import:
1. Under "Import", choose the "Fund", "Type" and "Tax year".
2. Under "Files", choose the CPA's PDF files, up to 25 MB each.
3. Choose "Import": the file is listed under "Imports" with the number to confirm; choose it to open it.

A Schedule K-1 (Form 1065) file is cut into one package per K-1, each proposed to the fund's investor whose name or taxpayer number's last four digits agree. Any other type is one package per file.

To confirm:
1. Under "Confirm together", check each row; "Not this one" moves a row to the others. Then choose "Confirm" with the count.
2. Under "One by one", compare the picture with the investor proposed, change the "Investor" if needed, then choose "Confirm". "View pages" shows every page; "Set aside" and "Reopen" put a package aside and bring it back.
3. For a file with no text, type the "First page" and "Last page" and choose "Make package".

"Pages with no package" and "No K-1 in this file" list what is left.

"Tax withheld": "Mark deposited" records a deposit, "Download worksheet for your CPA" saves the worksheet, "Record notice" an IRS notice.

"Form 1099": "Confirm" each form, give the numbers, then "Create recipient copies", "Download the IRS file" and "Record the IRS receipt". A corporation or REIT first needs your CPA's split of each distribution ("Save split"); none is proposed.

To deliver:
1. Under "Contact for tax documents", enter the "Mailing address" and choose "Save".
2. In the import, choose "Deliver", check the list, then "Deliver to these".
3. "Notice" on a delivered row gives the notice to copy or email.

"Send on paper" lists documents owed on paper: enter the date and choose "Mark sent on paper". "Notice came back" on a row adds one there.

An admin withdraws a document with "Withdraw", a "Reason" and "Withdraw document". For an amended document, tick "This replaces the document delivered on" before delivering.

## console-books
audience: sponsor
kind: console
title: Accounting
menu: Operate, then Accounting
anchor: Add entry
anchor: Enter value

The fund's manual inputs: entries the bank does not show, investment values, opening balances and closing a month.

1. Choose the "Fund".
2. "Add entry": a date, a memo and lines; it saves only when debits equal credits.
3. "Enter value" records an investment's fair value at a date.
4. An owner closes a month with "Close through".

## console-reports
audience: sponsor
kind: console
title: Reports
menu: Report, then Reports
anchor: Distribution reports for any period and investor contact lists.
anchor: Download CSV

Distribution reports for any period, and investor contact lists. Downloads are CSV files.

1. Choose "Distributions", "Contacts" or "Investor reports" at the top.
2. For distributions, choose the "Period" (such as "This quarter", "Year to date" or "Custom dates"), "Offering" and "View": "By investor", "By payment" or "By offering". Tick "Include scheduled payments" to add payments not yet made.
3. Choose "Download CSV".
4. In "Investor reports", choose the "Report type" and "Start from", then "Create". Turn sections on or off, use "Move up", and check the preview. "See the PDF" shows the file; "Download PDF" saves it.

## console-audit
audience: sponsor
kind: console
title: Audit
menu: Report, then Audit
anchor: Download audit package
anchor: Audit readiness

Audit-ready records for each fund: financial statements, capital accounts, investor register, capital activity, schedule of investments, fees, performance and a change log.

1. Choose the "Fund" and "Period".
2. Read "Audit readiness": each check says Pass or lists its exceptions, such as an investor with no tax form on file.
3. Under "Audit package", "Preview" shows a schedule on the page; each file can be downloaded on its own.
4. Choose "Download audit package" for one .zip with every schedule as a CSV, a README and a SHA-256 manifest; every download goes in the change log.

## console-kyc
audience: sponsor
kind: console
title: AML/KYC
menu: Report, then AML/KYC
anchor: AML/KYC
anchor: Review match
anchor: Re-screen

Identity verification, sanctions and PEP screening and accredited investor checks run automatically through the connections set on the Integrations page, which also sets how often investors are re-screened. Anything flagged, and any check waiting on the team, waits here; the number beside AML/KYC in the menu counts them.

- The four totals: Cleared, Needs review, Re-screening due, and In progress or not started.
- Filter the table with "Needs attention" or "All investors".
- "Review match" beside an investor opens a potential screening match for the team to decide.
- "Re-screen" beside an investor runs the screening again; the button at the top re-screens every investor due for it.
- "Download letter" in an investor's details saves the accreditation letter the reviewer sent, shown only while the portal is connected to its integration server.

## console-aml
audience: sponsor
kind: console
title: AML program
menu: Report, then AML program
anchor: AML program
anchor: Sanctions records are kept for ten years.

The firm's AML program on record, to show a bank, fund administrator, auditor or investor who asks. It has eight sections:
- "Policy": "Statement", "Scope", "Adopted on" and "Approved by".
- "Responsible person": "Name", "Title" and "Designated on".
- "Risk assessment": "Investor types, countries and offerings".
- "Procedures in force": the connections that run each check and the approval rules, filled in from the Integrations page and changed there.
- "Screening log": every screening and possible-match review from the change log, newest first, with date, investor, what happened and who did it.
- "Escalation": "Who is told of a possible match and what is reported".
- "Training and independent review": "Training" entries and "Independent reviews" entries.
- "Retention": "Sanctions records are kept for ten years."

"Save" keeps what was typed. Only an admin can change the record; a team member sees it read-only. "Export" saves the whole record as one file that opens in any browser and prints; each export goes in the change log.

## console-filings
audience: sponsor
kind: console
title: Filings
menu: Report, then Filings
anchor: First Form D notice
anchor: Silence
anchor: I filed this myself

Each offering under Rule 506(b) or Rule 506(c), with what is due for its Form D and state notices, each with its date and reason. The number beside Filings in the menu counts what is due or overdue and not silenced. An offering under another exemption or none (set in the offering's settings) is not listed. Nothing on the page is required, and the page itself charges and files nothing.

- "First Form D notice" shows once the offering has a first sale, due 15 days after it. "Form D annual amendment" shows once a notice is on record, due one year after the latest one.
- Each state with a sale shows a state notice with that state's first sale date. Several show as one row, "State notices", that opens to them.
- "Silence" turns a reminder off: it stays, greyed, with its date, but is no longer counted; "Turn back on" restores it. "Silence all" and "Turn all back on" do the same for all the offering's reminders.
- "I filed this myself" records a Form D the firm filed: its date and, if known, accession number. "Filed" beside a state records its notice; "Record all as filed" records all the offering's state notices with one date.
- "Options" under an offering: "First sale" confirms another first sale date, "Offering ended" records its end date, "Recorded as filed" lists what the firm recorded, each with "Remove", and "Not filing for this offering" turns its reminders off until "Turn reminders back on".
- "Form D" under an offering opens its notice by item, pre-filled (total offering amount, minimum investment, amount sold, number of investors and of non-accredited investors, date of first sale), each value marked "From the offering" or "From the subscriptions"; a value you change is kept. "Review" shows the whole notice and, under "To fix before it can be signed off", what EDGAR would refuse, each with "Go to it". An admin signs off with name and title under the SEC's Terms of Submission; "Sign off" records an order: $100 for a Form D, $50 for an amendment; the page says "Sending it to be filed needs the portal connected to its server." "Make changes" starts a new draft from a signed notice. Once a notice is filed, "Start an amendment" begins one from it, or from the file or text of a notice filed elsewhere.
- "EDGAR access" under an offering tracks an issuer with no EDGAR account through seven steps: each person's own sign-in, Form ID on the SEC dashboard, the printout signed before a notary, the upload, the CIK, the delegation to the filing agent and its acceptance. "Done" marks a step with its date; "Undo" takes it back. "Open the answer sheet" lays out the Form ID answers part by part, each with "Copy", to enter on the SEC dashboard yourself: the portal files no Form ID and never asks for a password, tax number or Social Security number. "The issuer already has a CIK" records the CIK and the name as EDGAR shows it, skipping the application steps; both fill the Form D notice. "Ready to file" shows once the delegation is accepted.
- "State filings" under an offering ticks each state where its investors live, with its first sale date; untick a state, or add one with "Add a state". Investors with no state on file are counted in one line and tick none. An investor in a U.S. territory other than Puerto Rico gets a state notice reminder, but a territory cannot be ordered. State notices are filed from the filed Form D; with none on record, enter its date and accession number. Every state fee and the filing system fee shows "To be confirmed" until confirmed. An admin's "Order state filings" records one order: $100 for any number of states, plus the state fees once confirmed. "Record result" enters a state's filing date, filing ID, fee paid and renewal date; "Order renewal" records a $50 renewal order.
- An order shows its lines, amount due and status; an admin cancels a recorded order with "Cancel order".

## console-brand
audience: sponsor
kind: console
title: Portal and brand
menu: Settings, then Portal and brand
anchor: How your portal looks to investors, and what onboarding asks of them.
anchor: Support and disclosures

Admin only; a team member asks an admin. It sets how the portal looks to investors and what onboarding asks of them; "Investor portal preview" beside the settings shows the result.
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

Admin only; a team member asks an admin. It sets which verification services check investors while they onboard, and the approval rules. Choose "Save" at the top after a change.
- "What runs for each check": the connections that are on for "Identity verification", "Sanctions and PEP screening" and "Accredited investor verification".
- "Connections": "Add a connection" adds a verification service the firm uses. Two are built in and can only be turned off, not removed: "Sandbox" (simulated results for trying the flow; turn it off before inviting real investors) and "Upload for your team to review" (investors upload an ID or a verification letter and the team records the result on the AML/KYC page).
- "Approval rules": "Approve investors automatically when every check passes", "Require verified accreditation", "Accreditation valid for (days)", "Re-screen investors every (days)" and "Hold politically exposed persons for enhanced due diligence".
- "Integration server": enter the "Server address" and, if one is set, the "Access token", then choose "Check connection". With a server connected, invitations are emailed automatically and investors can onboard on any device.
- "Verification package": once connected to the server, the prices of the checks a sponsor can add to invitations, the card they are charged to ("Add card", "Replace card" or "Remove"), any credit and each charge.

## console-ach
audience: sponsor
kind: console
title: ACH origination
menu: Settings, then ACH origination
anchor: Bank details used to build NACHA files for distributions.
anchor: Paying entity by offering

The bank details used to build NACHA files for distributions, copied from the bank's ACH origination agreement. The page says "Ready to generate files" once they are complete.
- "Originating bank (ODFI)": "Bank name" and "Routing number".
- "File header": "Immediate destination routing" (usually the ODFI routing number), "Immediate destination name", "Immediate origin" (assigned by the bank) and "Immediate origin name".
- "Batch defaults": "Company name" (shown on investors' bank statements), "Company ID" and "Entry description".
- "SEC codes": PPD for individuals, joint accounts and trusts; CCD for entities and IRA custodians. Files get one batch per code.
- "Balanced files": adds an offsetting debit to each batch; some banks require this, most do not.
- "Paying entity by offering": the company name and ID each offering pays under, changed with "ACH originator for this offering" on the offering's page.

## console-team
audience: sponsor
kind: console
title: Team
menu: Settings, then Team
anchor: Who can sign in to your console, and what each person can do.
anchor: Invite someone

Admin only; a team member asks an admin. Who can sign in to the console, with each person's role and status.

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

A firm's sign-up page.
1. Enter "Firm name", "First name", "Last name", "Work email" and a "Password" of at least 10 characters.
2. Answer "What do you raise?".
3. Choose a "Brand color" and, if wanted, upload a logo (PNG, JPG or SVG). Both can be changed later.
4. Choose "Create my portal". No card is needed to start.

"Explore a sample portal" opens a sample firm's portal to look around. Investors only ever see the firm's own brand.

## overview
audience: investor
kind: portal
title: Home
menu: Home
anchor: Capital calls due
anchor: Recent documents

The first page after signing in. The menu has Home, Investments, Distributions, Documents, Updates and Account, and "Sign out"; the firm's contact details are at the bottom of every page. Home shows the account's name and number, then:
- "Capital calls due": calls awaiting payment, if any.
- "Portfolio": the amounts contributed, committed and distributed, and the current value (unaudited).
- "Investments": each investment with the amount invested, distributions, value and time to exit. "All investments" opens Investments.
- "Latest updates" and "Recent documents", with "All updates" and "All documents".
- "Your requests": requests made and their status, if any.

A notice at the top, for example that new documents are available, has "View documents" and "Dismiss".

## investments
audience: investor
kind: portal
title: Investments
menu: Investments
anchor: Current investments
anchor: Completed investments

Every investment in the account, with three totals at the top: invested, distributions received to date and received this year.
- "Current investments": each investment with the amount invested, distributions received, date invested and time to redemption or exit; an investment's name opens its page.
- "Completed investments": investments that have ended.
- "Your requests": requests in progress and their status.
- "Recent distributions": the last and next distribution of each investment, with "All distributions".

## investment
audience: investor
kind: portal
title: Investment
menu: Investments, then the investment's name
anchor: Your capital account
anchor: Liquidity
anchor: Distributions from this investment

One investment: the amount invested, distributions received, how often it pays and the projected exit. Below that:
- "Your capital account": the investment's value at the latest valuation, unaudited; the quarterly capital account statement is in Documents.
- "Capital calls": each call with its notice date, due date, amount and status.
- "Key terms" and "Latest update" from the firm.
- "Liquidity", on funds that offer it: choose "Request a redemption" or "Add to this investment", enter the amount, type your full name to sign and choose "Sign and submit request". The firm then reviews the request; its status is under "Your requests".
- "Distributions from this investment" and "Documents" for this investment.

## distributions
audience: investor
kind: portal
title: Distributions
menu: Distributions
anchor: Received by year
anchor: Payment history

Every payment received. The line under the heading says how distributions are paid, for example by ACH to the bank account on file (its last four digits). Totals: total received, received this year and scheduled. "Received by year" is a chart. Under "Payment history", filter with "Year" and "Investment"; each row has the payment date, investment, type, amount and status.

The bank account is changed on Account with "Update bank account".

A payment with tax withheld also shows "Tax withheld" and "Amount paid", what reached you after it. Total received counts payments before tax withheld, with all the tax withheld on the line under it.

## documents
audience: investor
kind: portal
title: Documents
menu: Documents
anchor: Reports, tax documents, statements and agreements for your account
anchor: Offering documents

Reports, tax documents, statements and agreements for the account, including what the firm publishes.

To open or download a document:
1. Open Documents in the menu.
2. Narrow the list with "Investment" and "Type" if needed.
3. Choose "View" beside the document: it opens in a window, where "Download" saves it.

"Waiting for your signature" lists documents the firm sent to sign: a document's name opens it to sign. "Signed documents" lists what has been signed.

"Electronic delivery of tax documents" is optional: without it, tax documents come on paper and all else works the same. To receive them here, choose "Review and consent", read the terms and choose "I consent"; a tax document waiting for you then appears in the list. An opened tax document shows the date it leaves the portal. To stop, choose "Withdraw consent": the date is shown, and "Consent again" restarts it.

The firm adds a second signer, for example a joint owner, as the account's co-investor: ask the firm's team. The co-investor has their own sign-in and is asked only for their own places, under "Waiting for your signature".

## updates
audience: investor
kind: portal
title: Updates
menu: Updates
anchor: News, notices and reports from
anchor: View investment

News, notices and reports from the firm, newest first. A notice about documents has "View documents"; an investment update has "View investment", which opens that investment's page.

## account
audience: investor
kind: portal
title: Account
menu: Account
anchor: Tax and accreditation
anchor: Update bank account
anchor: Sign-in and delivery

- "Investor": account title, type, primary contact, email, phone and mailing address, not editable here: to change them, contact the firm's team named there.
- "Distribution payments": the payment method and the bank account on file; to change the account, choose "Update bank account", enter the new one and choose "Save bank account".
- "Tax and accreditation": the tax form, the last digits of the taxpayer ID and the accreditation on file. When a verification has expired, "Verify again" starts a new one.
- "Sign-in and delivery": electronic delivery, two-step verification and the activation date.
- "Appearance": "Light", "Dark" or "Match this device", saved in this browser.

## preferences
audience: investor
kind: portal
title: Settings
anchor: Preferences for this device
anchor: Appearance

Preferences for this device. Under "Appearance", choose "Light", "Dark" or "Match this device", which follows the device's light or dark setting. The choice is saved in this browser only.

## subscribe
audience: investor
kind: portal
title: Subscribe
anchor: Continue your subscription
anchor: Subscription documents signed

For subscribing to an offering. It shows the offering and one button: "Continue your subscription" goes to the offering's documents and the subscription agreement; "Continue account setup" shows instead while the account setup is unfinished, since the subscription is its last step. After signing, the page says "Subscription documents signed". No money is due at signing: the firm reviews the subscription, and a notice with the amount and wire instructions follows when money is due.

## sign
audience: investor
kind: portal
title: Sign a document
anchor: Decline to sign
anchor: Finish

A document the firm sent to sign.
1. Open it from the notice on Home, or from "Waiting for your signature" on the Documents page.
2. Choose "Start": it goes to each field that needs you, a signature, initials, a date or a blank to fill in.
3. Choose "Finish" when the fields are done.

"Decline to sign" tells the firm you will not sign. The signed copy is under "Signed documents" on the Documents page.

## sign-in
audience: investor
kind: portal
title: Sign in
anchor: Need help signing in?
anchor: Forgot your password?

Enter "Email" and "Password" and choose "Sign in". For a forgotten password, choose "Forgot your password?"; if that does not help, use the contact details of the firm's team under "Need help signing in?". "First time here? Activate your account" shows for an investor whose account is not active yet and starts the account setup.

## join
audience: investor
kind: page
title: Investor sign-up
anchor: Investor sign-up
anchor: Create my account

Opened by an offering's sign-up link; it shows the offering and its key terms.
1. Enter "First name", "Last name" and "Email".
2. Choose "Investing as": an individual, a joint account, a trust, a company or an IRA.
3. Tick the box to agree to receive account notices and documents electronically.
4. Choose "Create my account".

The account setup then opens, step by step from the login to the subscription documents.

## invite
audience: investor
kind: page
title: Account setup
anchor: Your progress is saved. You can come back with your invitation link at any time.
anchor: This invitation has expired
anchor: This invitation was cancelled

The account setup opens from the link in the invitation email and goes one step at a time; the top lists the steps and which one is open, for example Step 3 of 10. The steps depend on the invitation: an investor already on file is asked only for what is new, and a request for a tax form holds the tax step only. "Back" returns to the previous step. Progress is saved; the invitation link reopens the setup where it stopped.

When the link does not open the setup, the page says why:
- "This invitation link does not work here" or "We could not find this invitation": open the link from the invitation email again, or contact the firm.
- "This invitation link no longer works", "This invitation was cancelled" or "This invitation has expired": ask the firm for a new link.
- "We could not open your invitation": check the connection and try again.

## invite/welcome
audience: investor
kind: step
title: Welcome
anchor: Consent to electronic records and signatures
anchor: Get started

The first step. It names the firm that sent the invitation and the offering, then shows "Consent to electronic records and signatures": what signing electronically means, how to ask for paper copies and how to withdraw consent. Tick the box agreeing to use electronic records and signatures, and the box about receiving statements and notices electronically if shown, then choose "Get started".

## invite/login
audience: investor
kind: step
title: Create your login
anchor: Confirm password
anchor: At least 10 characters

Check "First name", "Last name" and "Email", enter a "Password" of at least 10 characters, enter it again under "Confirm password" and choose "Continue".

## invite/profile
audience: investor
kind: step
title: Investor information
anchor: Investing as
anchor: Country of mailing address

1. Choose "Investing as": an individual, a joint account, a trust, a company or an IRA. The fields below change with the choice.
2. Enter the legal name as on the government ID, the "Country of mailing address", the address and the "Phone". A joint account asks for "Your first name", "Your last name", "Second owner’s first name", "Second owner’s last name" and "How you hold the account".
3. For a person, enter the "Date of birth" and "Citizenship". A trust, company or IRA is asked for its own details instead.
4. Enter the taxpayer number the page asks for: "Social Security number", "Employer ID number (EIN)" for a company or IRA, or "Taxpayer ID (SSN or EIN of the trust)". Type the nine digits, with or without dashes or spaces: only digits count, up to 11 characters. Fewer digits show "Enter all nine digits." Where the field says "Only if you have one.", leave it empty or give all nine digits. A number on file shows its last four digits; leave the field empty to keep it.
5. Answer the question about senior political figures and choose "Continue".

## invite/identity
audience: investor
kind: step
title: Identity verification
anchor: Identity verification

Choose "Verify my identity" and follow the check: a photo of a government-issued ID and a quick selfie, about two minutes. "Identity check" shows the result. Then choose "Continue".

## invite/accreditation
audience: investor
kind: step
title: Accreditation
anchor: Accredited investor verification

This step is named "Accredited investor verification" when the offering needs a verification. Choose "Verify my accreditation" and follow the check; "Accreditation check" shows the result. It can be shown by income, net worth, a letter from a CPA, attorney or adviser, or an existing verification. Tick the box confirming the information is accurate and choose "Continue". Whether a person qualifies is for the investor's own adviser or the firm, not this help.

## invite/status
audience: investor
kind: step
title: Investor status
anchor: Investor status
anchor: Benefit plans

It asks whether the investor is an accredited investor, "Yes" or "No", and may ask more depending on the answer. Under "Benefit plans" it asks whether the investor is a benefit plan investor, with three kinds of "Yes" and "No". Answer and choose "Continue". Whether a person or an account qualifies is for the investor's own adviser or the firm, not this help.

## invite/tax
audience: investor
kind: step
title: Tax certification
anchor: Change your answers
anchor: Continue to the form

The step names the tax form, filled in from the earlier answers.
1. Choose "Continue to the form": the filled form opens on the page.
2. Check it, sign it on the page and choose "Finish".

When the taxpayer number is not yet known, the step asks for it ("Social Security number" or "Employer identification number"): nine digits, with or without dashes or spaces. It may be left empty, but fewer than nine digits shows "Enter all nine digits, or leave this empty." On the form for foreign investors, a U.S. taxpayer number is optional and also nine digits, and "Foreign tax identifying number" is the number as the country of residence issued it.

"Change your answers" goes back to correct what the form was filled from. Beside "Already have a completed form?", "Upload it instead" takes a form already completed. Beside "Not a U.S. person for tax purposes?", "Use the form for foreign investors" changes to that form. Which form or tax status applies is for the firm or the investor's own tax adviser, not this help.

## invite/payment
audience: investor
kind: step
title: Distribution payments
anchor: Routing number
anchor: Confirm account number

The bank account distributions are paid to, by direct deposit (ACH) to a U.S. bank account.
1. Enter the account holder's first and last name, exactly as the bank has it.
2. Enter the "Routing number": nine digits, printed at the bottom left of a check.
3. Choose the "Account type", "Checking" or "Savings", and enter the "Account number" twice.
4. Tick the authorization and choose "Continue".

## invite/subscribe
audience: investor
kind: step
title: Subscription
anchor: Offering documents
anchor: Continue to the agreement

It shows the offering and its "Offering documents": choose one to read it. Enter the commitment; the page shows the minimum, and an amount set by the firm cannot be changed. Tick the boxes confirming you have received and read the offering documents and, where shown, that your investor status remains accurate, then choose "Continue to the agreement".

## invite/agreement
audience: investor
kind: step
title: Subscription agreement
anchor: Subscription agreement
anchor: Select Start to go to each field that needs you, then Finish.

The subscription agreement opens on the page with the investor's name and commitment filled in.
1. Choose "Start": it goes to each field, a signature, initials, a tick box or a blank.
2. Choose "Finish".

The firm signs the fields marked for it afterwards. "Decline to sign" tells the firm you will not sign.

## invite/done
audience: investor
kind: step
title: Done
anchor: What happens next
anchor: Go to your portal

The last step: the account is active. "What happens next" says the firm reviews the subscription and countersigns the agreement; its status shows under Investments; a copy of the signed agreement is in Documents, with the fully signed copy added once countersigned; and no money is due now: when capital is called, a portal notice gives the amount, due date and wire instructions. Choose "Go to your portal".

## onboarding
audience: investor
kind: page
title: Update bank account
anchor: Update bank account
anchor: Save bank account

Changes the bank account distributions are paid to. "Update bank account" on the Account page opens it; its one step is Distribution payments. "Cancel" leaves without a change.

## onboarding/payment
audience: investor
kind: step
title: Distribution payments
anchor: Update your bank account
anchor: Save bank account

The heading is "Update your bank account".
1. Enter the account holder's first and last name, exactly as the bank has it.
2. Enter the "Routing number", choose the "Account type" and enter the "Account number" twice.
3. Tick the authorization and choose "Save bank account".

## taxdoc
audience: investor
kind: page
title: Your tax document
anchor: Last four digits of the tax number you gave
anchor: Open document

Opened by the link in a tax document email, on any device. Enter the last four digits of the tax number you gave the firm and choose "Open document". If asked, first read how electronic delivery works and tick the box to consent. The pages then show; "Save" keeps a copy, which can be printed. After five wrong tries the link locks: ask the firm for a new one.

## skip
co: the co-investor's sign-in link; it signs the co-investor in and opens their agreement on its signing page, with no screen of its own beyond two plain messages for a link that does not work
console-new-client: the managed edition's page for adding a client; the self-serve edition does not have it
onboarding/login: a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account
onboarding/profile: a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account
onboarding/identity: a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account
onboarding/accreditation: a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account
onboarding/review: a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account
