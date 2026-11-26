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

The first page of the console. The menu on every console page has Overview and Notifications at the top, then four groups: Raise (Offerings, Offering intake, Investors, E-sign), Operate (Capital calls, Distributions, Requests, Notices, Documents, Tax documents, Accounting), Report (Reports, Audit, AML/KYC, AML program, Filings) and Settings (Portal and brand, Integrations, ACH origination, Team). A team member's menu has no Offering intake, Portal and brand, Integrations or Team: only an admin opens those four pages, so a team member asks an admin.

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
- "Subscription agreement": choose "Add the subscription agreement" to upload the agreement once and place the fields investors fill in and sign. Every investor invited to the offering then signs it online during onboarding. When it has places for a co-investor, the section says so and names the investors with no co-investor on their account. Once it is there, "Edit fields", "Replace the PDF" and "Remove" change it.
- "Exit timing": "How exit is defined", its dates, and "Note shown to investors".
- "Distributions": "Frequency", "Default payment type" and "Target or rate shown to investors".
- "Fund accounting" and "Structure" (with "Edit structure"): fees, carried interest, preferred return, auditor and waterfall, used for the audit package.
- "Key terms shown to investors": tick "Show" for each term investors see; "Add term" adds one.
- "Latest update": text shown on the investor's investment page.
- "ACH originator for this offering": a company name and ID when the offering pays from its own bank account.
- "Remove offering": only an offering with no investors can be removed.

At the top, "Investor sign-up link" gives a link investors use to sign up for this offering on their own, and "Preview as investor" shows the offering in the investor portal.

"Tax reporting", in "Offering details", says how the offering reports its investors' tax: Schedule K-1, Form 1099-INT, Form 1099-DIV or documents from the CPA. Only admins set it. Until it is set, and for a partnership or other, no backup withholding is proposed at a distribution.

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

Under "Invitations", follow each invitation with In progress, Completed and All; the tick box "Accept subscriptions automatically once the agreement is countersigned and the investor is verified" turns that on. An invitation whose agreement waits for the firm's signature has "Countersign". In the investor table, "View portal" shows the portal as that investor sees it; an investor who has not activated has "Invitation" and "Send reminder" instead. With no integration server connected, the firm sends each invitation from its own email app: the portal prepares the email with the link.

A second person on an investor's account, for example a spouse investing jointly, is a co-investor, and one can be added to an investor already on file: choose "Account" beside the investor in the table, then "Add co-investor", fill in "First name", "Last name" and "Email" (their own email, not the investor's) and choose "Add co-investor". An account has one co-investor, who signs their own places on the account's agreements with their own sign-in. After "Add co-investor" the "Co-investor sign-in email" opens with the co-investor's own link, which opens only their places: send it from your own email app with "Open in your email app" (or "Copy link"), then choose "Mark as sent"; the row says "Sign-in link ready to send" until then, and "Sign-in link" in the "Account" window opens the email again. A changed email gives a new link, and the earlier one stops working.

With the integration server connected, nothing is sent by hand: the server emails the co-investor their sign-in once the investor has signed, and the row says "Sign-in emailed" with the date (before that, "Sign-in is emailed once" the investor "has signed"); a changed email or "Remove co-investor" cancels the link sent.

An admin records a W-9 the investor signed on paper, or a completed W-9 they uploaded that shows the last four digits of the taxpayer number, with "W-9 signed on paper" under the investor's activation; "Undo" takes the record away. Without it, a distribution of an offering set to notes or to a corporation or REIT proposes backup withholding for that investor.

An agreement still out for signature that has places for a co-investor gets them as a signer, after the investor and before the firm; the investor does not sign again. An agreement everyone has already signed stays as it is. The "Account" window also has "Change co-investor" and "Remove co-investor". When an offering's agreement has places for a co-investor and the account has none, the row says "Agreement has places for a co-investor", and the "Account" window has "This investor has no co-investor" to say there is none.

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

In the Envelopes list, "Open" opens an envelope, "Remind" sends a reminder to the signers who have not signed, "Void" cancels an envelope that is out for signature, and a completed envelope has "Signed PDF" and "Certificate". To countersign, open the envelope and choose "Sign as sponsor". A template is made from an envelope with "Save as template".

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
6. Choose "Generate NACHA file" to build the file for the bank, and "Record distribution" to record the payment.

"History" lists past distributions; "ACH file" beside one builds its file again. The bank details in the file come from the ACH origination page.

Under the table, "Tax withheld" lists each line the portal proposes, with the investor, the reason, the rate and the amount: backup withholding at 24% when the offering's "Tax reporting" is notes or a corporation or REIT, and for a foreign investor 30% of the "Amount subject to withholding" you enter, or the "Rate from your CPA (%)". Nothing is withheld until you choose "Confirm"; "Remove" takes a line off. "Add tax withheld" enters a figure your CPA gives for the other kinds, with a reason. The two buttons wait until every line is confirmed or removed; the file then pays each investor the amount less tax withheld. Changing the offering, the date or the amount clears the decisions.

An admin's "Cancel" in "History" cancels a distribution recorded by mistake, with a reason: it then reads "Cancelled" and is paid nowhere.

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
3. After approving, the same row has "Record payment" for a redemption or "Record funding" for a subscription to an open-ended fund: choose it when the money has moved. For a commitment it has "Countersign": when the subscription agreement still waits for the firm's signature, it opens the agreement to sign as the firm, and the commitment goes on the investor register once that signing is finished. The investor register, capital accounts and audit schedules then update automatically.

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

## console-taxdocs
audience: sponsor
kind: console
title: Tax documents
menu: Operate, then Tax documents
anchor: Confirm together
anchor: Not this one

Take in the tax documents the CPA prepared and confirm whose each one is. A confirmed document shows "Not delivered": investors do not see it yet.

To import:
1. Under "Import", choose the "Fund", the "Type" and the "Tax year".
2. Under "Files", choose the CPA's PDF files, up to 25 MB each.
3. Choose "Import". The file is listed under "Imports" with the number to confirm; choose it to open it.

A Schedule K-1 (Form 1065) file is cut into one package per K-1, and an investor of the fund is proposed where the last four digits of the taxpayer number or the name agree. Any other type is one package per file.

To confirm:
1. Under "Confirm together", check each row; "Not this one" moves a row to the others. Then choose the button "Confirm" with the count.
2. Under "One by one", compare the picture with the investor proposed, change the "Investor" if needed, then choose "Confirm". "View pages" shows every page; "Set aside" and "Reopen" put a package aside and bring it back.
3. For a file with no text, type the "First page" and "Last page" and choose "Make package".

"Pages with no package" and "No K-1 in this file" list what is left.

To deliver:
1. Under "Contact for tax documents", enter the "Mailing address" and choose "Save".
2. In the import, choose "Deliver", check the list, then "Deliver to these".
3. "Notice" on a delivered row gives the notice to copy or email.

"Send on paper" lists documents owed on paper: enter the date and choose "Mark sent on paper". "Notice came back" on a row adds one there.

To withdraw a document, an admin chooses "Withdraw", enters a "Reason" and chooses "Withdraw document". For an amended document, tick "This replaces the document delivered on" before delivering.

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

## console-aml
audience: sponsor
kind: console
title: AML program
menu: Report, then AML program
anchor: AML program
anchor: Sanctions records are kept for ten years.

A record of the firm's AML program to show a bank, fund administrator, auditor or investor who asks for it. It has eight sections:
- "Policy": "Statement", "Scope", "Adopted on" and "Approved by".
- "Responsible person": "Name", "Title" and "Designated on".
- "Risk assessment": "Investor types, countries and offerings".
- "Procedures in force": filled in from the Integrations page (which connections run each check, how often investors are re-screened, when verified accreditation is required and for how long it is valid, the hold for politically exposed persons, and whether approval is automatic). Change them on the Integrations page.
- "Screening log": every screening and every review of a possible match from the change log, newest first, with the date, the investor, what happened and who did it.
- "Escalation": "Who is told of a possible match and what is reported".
- "Training and independent review": "Training" entries and "Independent reviews" entries.
- "Retention": "Sanctions records are kept for ten years."

Choose "Save" to keep what was typed. Only an admin can change the record; a team member sees it read-only. "Export" saves the whole record as one file that opens in any browser and prints; each export is written to the change log.

## console-filings
audience: sponsor
kind: console
title: Filings
menu: Report, then Filings
anchor: First Form D notice
anchor: Silence
anchor: I filed this myself

Filings lists each offering under Rule 506(b) or Rule 506(c) with what is due for its Form D and its state notices: the date and the reason beside each. The number beside Filings in the menu is the count that is due or overdue and not silenced. An offering under another exemption, or with none set, is not listed; the exemption is set in the offering's settings. Nothing on the page is required.

- "First Form D notice" is shown once the offering has a first sale, with its due date, 15 days after the first sale. "Form D annual amendment" is shown once a notice is on record, due one year after the latest one.
- A state notice is shown for each state with a sale, with the date of the first sale in that state. Several states show as one row, "State notices", that opens to the states.
- "Silence" turns a reminder off: it stays on the page, greyed, with its date, and is no longer counted. "Turn back on" restores it. "Silence all" and "Turn all back on" do the same for every reminder of the offering.
- "I filed this myself" records a Form D the firm filed, with its date and, if the firm has it, the accession number. "Filed" beside a state records that state's notice, and "Record all as filed" records all the offering's state notices with one date.
- "Options" under an offering: "First sale" confirms another first sale date, "Offering ended" records the date the offering ended, "Recorded as filed" lists what the firm recorded with "Remove" beside each, and "Not filing for this offering" turns the offering's reminders off until "Turn reminders back on".
- "Form D" under an offering opens its notice by item, pre-filled from the offering and its subscriptions: total offering amount, minimum investment, amount sold, the number of investors and of non-accredited investors, and the date of first sale. Each pre-filled value says where it came from ("From the offering", "From the subscriptions"); a value you change is kept. "Review" shows the whole notice and, under "To fix before it can be signed off", what EDGAR would refuse, each with "Go to it". An admin signs off with name and title under the SEC's Terms of Submission; "Sign off" records an order: $100 for a Form D, $50 for an amendment. The page itself charges nothing and files nothing: "Sending it to be filed needs the portal connected to its server." "Make changes" starts a new draft from a signed notice. Once a notice is filed, "Start an amendment" begins one from it, or from the file or text of a notice filed elsewhere.
- "EDGAR access" under an offering shows how far an issuer with no EDGAR account is through seven steps: each person's own sign-in, Form ID on the SEC dashboard, the printout signed before a notary, the upload, the CIK, the delegation to the filing agent and its acceptance. "Done" marks a step with its date; "Undo" takes it back. "Open the answer sheet" lays out the Form ID answers part by part, with "Copy" beside each, to enter on the SEC dashboard yourself: the portal files no Form ID and never asks for a password, tax number or Social Security number. "The issuer already has a CIK" records the CIK and the name as EDGAR shows it and skips the application steps. The CIK and name fill the Form D notice. "Ready to file" shows once the delegation is accepted.
- "State filings" under an offering ticks each state where its investors live, with the first sale date there; untick a state, or add one with "Add a state". Investors with no state on file are counted in one line and tick no state. An investor in a U.S. territory other than Puerto Rico gets a state notice reminder, but a territory cannot be ordered. State notices are filed from the filed Form D: with none on record, enter its date and accession number. Every state fee and the filing system fee shows "To be confirmed" until it is confirmed. An admin's "Order state filings" records one order, $100 for any number of states plus the state fees once confirmed; the page itself charges nothing and files nothing. "Record result" enters a state's filing date, filing ID, fee paid and renewal date; "Order renewal" records a $50 renewal order.
- An order is shown with its lines, the amount due and its status. An admin cancels a recorded order with "Cancel order".

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
- "Verification package": once the portal is connected to its server, it shows the prices of the checks a sponsor can add to invitations, the card they are charged to ("Add card", "Replace card" or "Remove"), any credit and each charge.

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

## overview
audience: investor
kind: portal
title: Home
menu: Home
anchor: Capital calls due
anchor: Recent documents

The first page after signing in. The menu has Home, Investments, Distributions, Documents, Updates and Account, and "Sign out". The firm's contact details are at the bottom of every page. Home shows the account's name and number, then:
- "Capital calls due": calls waiting for payment, when there are any.
- "Portfolio": the amounts contributed, committed and distributed, and the current value (unaudited).
- "Investments": each investment with the amount invested, distributions, value and time to exit. "All investments" opens Investments.
- "Latest updates" and "Recent documents", with "All updates" and "All documents".
- "Your requests": requests made and their status, when there are any.

A notice at the top, for example that new documents are available, has "View documents" and "Dismiss".

## investments
audience: investor
kind: portal
title: Investments
menu: Investments
anchor: Current investments
anchor: Completed investments

Every investment in the account, with three totals at the top: invested, distributions received to date and received this year.
- "Current investments": each investment with the amount invested, distributions received, date invested and time to redemption or exit. Choose an investment's name to open its page.
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
- "Your capital account": the value of the investment at the latest valuation, unaudited. The quarterly capital account statement is in Documents.
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

Every payment received. The line under the heading says how distributions are paid, for example by ACH to the bank account on file, shown by its last four digits. The totals are total received, received this year and scheduled. "Received by year" is a chart. Under "Payment history", filter with "Year" and "Investment"; each row has the payment date, investment, type, amount and status.

To change the bank account distributions are paid to, open Account and choose "Update bank account".

A payment with tax withheld also shows "Tax withheld" and "Amount paid", what reached you after tax withheld. Total received counts payments before tax withheld, with the tax withheld in all on the line under it.

## documents
audience: investor
kind: portal
title: Documents
menu: Documents
anchor: Reports, tax documents, statements and agreements for your account
anchor: Offering documents

Reports, tax documents, statements and agreements for the account. Documents the firm publishes appear here.

To open or download a document:
1. Open Documents in the menu.
2. Narrow the list with "Investment" and "Type" if needed.
3. Choose "View" beside the document. It opens in a window; choose "Download" there to save it.

"Waiting for your signature" lists documents the firm sent to sign: choose the document's name to open and sign it. "Signed documents" lists what has been signed.

"Electronic delivery of tax documents" is optional: without it, tax documents are sent to you on paper and everything else works the same. To receive them here, choose "Review and consent", read the terms and choose "I consent"; a tax document waiting for you then appears in the list. An opened tax document shows the date it leaves the portal. To stop, choose "Withdraw consent": the date is shown, and "Consent again" restarts it.

A second person who signs too, for example a joint owner, is added to the account by the firm as its co-investor: ask the firm's team. The co-investor has their own sign-in and is asked only for their own places, under "Waiting for your signature".

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

The account's details.
- "Investor": account title, type, primary contact, email, phone and mailing address. These cannot be edited on the page: to change them, contact the firm's team named there.
- "Distribution payments": the payment method and the bank account on file. To change the bank account, choose "Update bank account", enter the new account and choose "Save bank account".
- "Tax and accreditation": the tax form on file, the last digits of the taxpayer ID and the accreditation on file. When a verification has expired, "Verify again" starts a new one.
- "Sign-in and delivery": electronic delivery, two-step verification and the date the account was activated.
- "Appearance": "Light", "Dark" or "Match this device". The choice is saved in this browser.

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

The page for subscribing to an offering. It shows the offering and one button: "Continue your subscription" goes to the offering's documents and the subscription agreement, and "Continue account setup" shows instead when the account setup is not finished, because the subscription is its last step. After signing, the page says "Subscription documents signed". No money is due at signing: the firm reviews the subscription, and a notice with the amount and wire instructions follows when money is due.

## sign
audience: investor
kind: portal
title: Sign a document
anchor: Decline to sign
anchor: Finish

A document the firm sent to sign.
1. Open it from the notice on Home, or from "Waiting for your signature" on the Documents page.
2. Choose "Start". It goes to each field that needs you: a signature, initials, a date or a blank to fill in.
3. Choose "Finish" when the fields are done.

"Decline to sign" tells the firm you will not sign. The signed copy is kept on the Documents page under "Signed documents".

## sign-in
audience: investor
kind: portal
title: Sign in
anchor: Need help signing in?
anchor: Forgot your password?

Enter "Email" and "Password" and choose "Sign in". For a forgotten password, choose "Forgot your password?"; if that does not help, use the contact details on the page. "First time here? Activate your account" shows for an investor whose account is not active yet and starts the account setup. Under "Need help signing in?" are the contact details of the firm's team.

## join
audience: investor
kind: page
title: Investor sign-up
anchor: Investor sign-up
anchor: Create my account

The page an offering's sign-up link opens. It shows the offering and its key terms.
1. Enter "First name", "Last name" and "Email".
2. Choose "Investing as": an individual, a joint account, a trust, a company or an IRA.
3. Tick the box to agree to receive account notices and documents electronically.
4. Choose "Create my account".

The account setup then opens and goes step by step from the login to the subscription documents.

## invite
audience: investor
kind: page
title: Account setup
anchor: Your progress is saved. You can come back with your invitation link at any time.
anchor: This invitation has expired
anchor: This invitation was cancelled

The account setup opens from the link in the invitation email. It goes one step at a time; the top of the page lists the steps and says which one is open, for example Step 3 of 10. Which steps appear depends on the invitation: an investor already on file is asked only for what is new, and a request for a tax form holds the tax step only. "Back" returns to the previous step. Progress is saved, and the invitation link opens the setup again where it stopped.

When the link does not open the setup, the page says why:
- "This invitation link does not work here": open the link from the invitation email again, or contact the firm.
- "This invitation link no longer works", "This invitation was cancelled" or "This invitation has expired": ask the firm for a new link.
- "We could not find this invitation": open the link from the invitation email again, or contact the firm.
- "We could not open your invitation": check the connection and try again.

## invite/welcome
audience: investor
kind: step
title: Welcome
anchor: Consent to electronic records and signatures
anchor: Get started

The first step. It says which firm sent the invitation and for which offering, then shows "Consent to electronic records and signatures": what signing electronically means, how to ask for paper copies and how to withdraw consent. Tick the box that says you agree to use electronic records and signatures, tick the box about receiving statements and notices electronically if it is shown, and choose "Get started".

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

Details of the investor.
1. Choose "Investing as": an individual, a joint account, a trust, a company or an IRA. The fields below change with the choice.
2. Enter the legal name as on the government ID, the "Country of mailing address", the address and the "Phone". A joint account asks for "Your first name", "Your last name", "Second owner’s first name", "Second owner’s last name" and "How you hold the account".
3. For a person, enter the "Date of birth" and "Citizenship". A trust, company or IRA is asked for its own details instead.
4. Enter the taxpayer number the page asks for: "Social Security number", "Employer ID number (EIN)" for a company or IRA, or "Taxpayer ID (SSN or EIN of the trust)". Type the nine digits, with or without dashes or spaces: only the digits count, and the field takes up to 11 characters. Fewer than nine digits shows "Enter all nine digits." When the field says "Only if you have one.", leave it empty or give all nine digits. A number already on file shows its last four digits; leave the field empty to keep it.
5. Answer the question about senior political figures and choose "Continue".

## invite/identity
audience: investor
kind: step
title: Identity verification
anchor: Identity verification

Choose "Verify my identity" and follow the check: a photo of a government-issued ID and a quick selfie, about two minutes. "Identity check" shows the result. When it is done, choose "Continue".

## invite/accreditation
audience: investor
kind: step
title: Accreditation
anchor: Accredited investor verification

This step is named "Accredited investor verification" when the offering needs a verification. Choose "Verify my accreditation" and follow the check; "Accreditation check" shows the result. It can be shown with income, net worth, a letter from a CPA, attorney or adviser, or an existing verification. Tick the box confirming the information is accurate and choose "Continue". Whether a person qualifies is not something this help can say: that is for the investor's own adviser or the firm.

## invite/status
audience: investor
kind: step
title: Investor status
anchor: Investor status
anchor: Benefit plans

The step asks whether the investor is an accredited investor, "Yes" or "No", and may ask more depending on the answer. Under "Benefit plans" it asks whether the investor is a benefit plan investor, with three kinds of "Yes" and "No". Answer and choose "Continue". Whether a person or an account qualifies as any of these is not something this help can say: that is for the investor's own adviser or the firm.

## invite/tax
audience: investor
kind: step
title: Tax certification
anchor: Change your answers
anchor: Continue to the form

The step first names the tax form and says it is filled in from the answers given earlier.
1. Choose "Continue to the form". The filled form opens on the page.
2. Check the form, sign it on the page and choose "Finish".

When the taxpayer number is not known at this point, the step asks for it ("Social Security number" or "Employer identification number"): nine digits, with or without dashes or spaces. The number may be left empty, but one with fewer than nine digits shows "Enter all nine digits, or leave this empty." On the form for foreign investors, a U.S. taxpayer number is optional and also nine digits, and "Foreign tax identifying number" is the number as the country of residence issued it.

"Change your answers" goes back to correct what the form was filled from. Beside "Already have a completed form?", "Upload it instead" takes a form that is already completed. Beside "Not a U.S. person for tax purposes?", "Use the form for foreign investors" changes to the form for foreign investors. Which form or tax status applies to someone is decided by the firm or the investor's own tax adviser, not by this help.

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

The step shows the offering and its "Offering documents": choose a document to read it. Enter the commitment; the page shows the minimum, and an amount set by the firm cannot be changed. Tick the boxes confirming that you have received and read the offering documents and, where it is shown, that your investor status remains accurate. Then choose "Continue to the agreement".

## invite/agreement
audience: investor
kind: step
title: Subscription agreement
anchor: Subscription agreement
anchor: Select Start to go to each field that needs you, then Finish.

The subscription agreement opens on the page with the investor's name and commitment filled in.
1. Choose "Start". It goes to each field: a signature, initials, a tick box or a blank.
2. Choose "Finish".

The fields marked for the firm are signed by the firm afterwards. "Decline to sign" tells the firm you will not sign.

## invite/done
audience: investor
kind: step
title: Done
anchor: What happens next
anchor: Go to your portal

The last step: the account is active. "What happens next" says that the firm reviews the subscription and countersigns the agreement, that its status is shown in the portal under Investments, that a copy of the signed agreement is in Documents and the fully signed copy is added once it is countersigned, and that no money is due now: when capital is called, a notice in the portal gives the amount, the due date and wire instructions. Choose "Go to your portal".

## onboarding
audience: investor
kind: page
title: Update bank account
anchor: Update bank account
anchor: Save bank account

The page for changing the bank account distributions are paid to. It opens from the Account page with "Update bank account" and has one step, Distribution payments. "Cancel" leaves without a change.

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

The page the link in a tax document email opens, on any device. Enter the last four digits of the tax number you gave the firm and choose "Open document". If asked, read how electronic delivery works and tick the box to consent first. The pages then show; "Save" keeps a copy, and the saved file can be printed. After five wrong tries the link locks: ask the firm for a new one.

## skip
co: the co-investor's sign-in link; it signs the co-investor in and opens their agreement on its signing page, with no screen of its own beyond two plain messages for a link that does not work
console-new-client: the managed edition's page for adding a client; the self-serve edition does not have it
onboarding/login: a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account
onboarding/profile: a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account
onboarding/identity: a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account
onboarding/accreditation: a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account
onboarding/review: a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account
