# The help guide (the one source)

Everything above the first section is a note for authors and is not sent to the assistant.

- One section per page and per step of the self-serve portal, written from the screen itself. Run `node server/help/build.mjs` after every change; `npm --prefix server test` fails when a page has no section, when the generated module is stale, or when a quoted name is no longer in the portal's source.
- Fields sit directly under the heading: audience (sponsor, investor, both), kind (console, portal, step, page), title, menu (optional), and one or more anchor lines (a text the screen shows, verbatim in the file that registers the route). Then a blank line and the text.
- Put a name in straight double quotes only when it is exactly the text on the screen. Write nothing the screen does not show.
- No vendor, model or product name, no email address, no advice. Investor sections never mention the sponsor's side.
- Routes and steps left out go in the last section, skip, each with its reason.

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
4. Optional: open "More options (optional)" to set the account name, the offering, the commitment or a personal note.
5. Choose "Send invitation".

The investor gets one link that walks them through every step. To invite several investors at once, choose "Import a list", upload a CSV or Excel file or paste the list, choose "Check list", then send. "Add manually" is for an investor onboarded offline on paper documents: they are added as an active investor and are not sent the onboarding link.
