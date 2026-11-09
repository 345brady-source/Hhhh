# Switchboard

An Outlook-style email and calendar app that holds all of your email accounts at once — Gmail, Microsoft (Outlook.com / Microsoft 365), and any IMAP or POP3 mailbox — merges every calendar into one master calendar, and is built to be driven by Claude.

- **Every account in one place.** No account limit. All inboxes merge into “All inboxes”; each account keeps its own folders, color and signature.
- **One master calendar.** Google Calendar, Outlook calendars, calendars kept on this computer (for IMAP/POP accounts) and web subscriptions, shown together. New events go to the calendar you choose: by account (“my work calendar”), by name, or your default.
- **Claude, two ways.** A Claude panel inside the app (Ctrl+K), and an MCP server, so Claude Desktop and Claude Code can read your mail and manage your calendar directly. “Add dentist Tuesday at 3 to my personal calendar” works from either.

It runs on your computer. Mail, tokens and passwords stay on your computer; passwords and tokens are stored encrypted.

## Quick start

Requires [Node.js](https://nodejs.org/) 22.13 or newer.

```sh
cd switchboard
npm install
npm start
```

Your browser opens at http://127.0.0.1:4545. Go to **Settings → Accounts → Add account**.

## Adding accounts

| Account | How it connects | What syncs |
|---|---|---|
| Gmail / Google Workspace | Google sign-in (OAuth) | Mail and labels (Gmail API), Google Calendar |
| Outlook.com, Hotmail, Live, Microsoft 365 | Microsoft sign-in (OAuth) | Mail and folders, Outlook calendars (Microsoft Graph) |
| IMAP (Yahoo, iCloud, AOL, Fastmail, Zoho, GMX, your domain…) | Server settings and password | Mail and folders, kept in sync both ways. A calendar on this computer |
| POP3 | Server settings and password | Mail downloaded to this computer. A calendar on this computer |

**IMAP and POP3.** Type the email address and Switchboard fills in the server settings from built-in presets, DNS records, or a best guess. Yahoo, iCloud, AOL and Fastmail require an *app password* (made in that provider’s security settings), not your normal password. Click **Test connection** before saving. If an address actually belongs to Google Workspace or Microsoft 365, Switchboard says so and offers the sign-in button instead.

**Gmail and Microsoft** sign in with OAuth, so Switchboard never sees those passwords. Each needs a free app registration, made once (about 5 minutes); the steps are also shown in the app.

<details>
<summary>Google: create the sign-in app</summary>

1. In [Google Cloud Console](https://console.cloud.google.com/projectcreate), create a project.
2. Enable the [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com) and the [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com).
3. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), set up the consent screen (External). Either add yourself as a test user, or publish the app. In testing mode, Google ends sign-ins after 7 days.
4. Under [Clients](https://console.cloud.google.com/auth/clients), create a **Desktop app** client.
5. In Switchboard: **Settings → Accounts → Set up Google**. Paste the client ID and secret. If you made a *Web application* client instead, add `http://127.0.0.1:4545/oauth/google/callback` as an authorized redirect URI.

Scopes requested: full Gmail access (`https://mail.google.com/`, needed to permanently delete from Trash) and Google Calendar.
</details>

<details>
<summary>Microsoft: create the sign-in app</summary>

1. In [Microsoft Entra → App registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade), click **New registration**.
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
3. Redirect URI: platform **Public client/native (mobile & desktop)**, value `http://localhost:4545/oauth/microsoft/callback`.
4. Copy the Application (client) ID into **Settings → Accounts → Set up Microsoft**. No secret is needed.

Permissions requested: `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, `User.Read`, `offline_access`. Some organizations require an admin to approve third-party apps.
</details>

You can also put the IDs in the environment instead: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`.

## Using Claude

### In the app

Open **Settings → Claude** and paste an [Anthropic API key](https://platform.claude.com/settings/keys) (or set `ANTHROPIC_API_KEY`). Then press **Ctrl+K** (⌘K), or use the buttons on any email (Summarize, Draft reply, Add to calendar, Action items). Claude sees which email or calendar day you have open.

Examples:

- “What’s on my calendar this week across everything?”
- “Add lunch with Sam tomorrow at noon to my personal calendar.”
- “Find a free hour Thursday or Friday afternoon and put a hold on my work calendar called ‘Planning’.”
- “Summarize unread mail from all my accounts. What needs a reply today?”
- “Draft a reply to Dana saying Tuesday works.”
- “Accept the planning meeting invite.”

Before Claude sends an email, deletes something, or answers an invitation, the panel shows the action for you to approve. For an email you can edit the text before sending. You can change this in Settings: ask before any change, or never ask.

The model defaults to Claude Opus 5.5. Sonnet 5.5, Haiku 5.5 and Fable 5.1 are available in Settings.

### From Claude Desktop or Claude Code

Switchboard is an MCP server. **Settings → Claude** shows the exact config for your computer.

**Claude Desktop** (Settings → Developer → Edit config):

```json
{
  "mcpServers": {
    "switchboard": {
      "command": "/path/to/node",
      "args": ["/path/to/switchboard/bin/mcp-stdio.js"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add --scope user switchboard -- node /path/to/switchboard/bin/mcp-stdio.js
```

If Switchboard is already running, `mcp-stdio.js` relays to it. If not, it starts Switchboard (web UI included) for as long as Claude is open. Claude Code can also connect over HTTP to `http://127.0.0.1:4545/mcp` with the bearer token shown in Settings.

**Tools Claude gets:** `get_overview`, `list_accounts`, `list_folders`, `list_emails`, `search_emails`, `read_email`, `read_thread`, `send_email`, `create_draft`, `update_emails`, `list_calendars`, `list_events`, `create_event`, `update_event`, `delete_event`, `find_free_time`, `add_invite_to_calendar`, `respond_to_invite`, `search_contacts`, `sync_now`.

Claude Desktop asks before running each tool. To have emails that Claude sends from Desktop/Code wait in Drafts instead, set “When Claude asks to send an email” to *Save it to Drafts* in Settings → Claude.

Everything Claude does, from either place, is listed in **Settings → Activity**.

## The master calendar

- Every calendar from every account is shown together, color-coded, and each can be shown or hidden.
- **Default calendar:** the ★ calendar receives new events, from you or from Claude, unless another is named. Set it in Settings → Calendar or from a calendar’s ⋯ menu.
- **Google and Microsoft calendars** sync both ways. Events Claude adds there appear on your phone too. Adding attendees sends real invitations. You can add a Google Meet or Teams link.
- **IMAP and POP3 accounts** get a calendar kept on this computer, as in Outlook. Inviting people to an event on one of these calendars emails them an iCalendar invitation from that account.
- **Invitations in email** show Accept / Tentative / Decline / Add to calendar. If the meeting is already on a synced calendar, Switchboard says so instead of adding a duplicate.
- **Subscriptions:** add any `webcal://` or `.ics` link (holidays, sports, school). Calendars can be exported as `.ics`.
- **Free time** is found across all calendars within your working hours (Settings → Calendar).

## Mail features

Unified inbox, per-account folders with unread counts, Unread / Flagged / Sent views across accounts, Gmail-style search (`from:` `to:` `subject:` `has:attachment` `has:invite` `is:unread` `is:flagged` `in:` `account:` `after:` `before:` `newer_than:7d`) with an option to also search the servers for older mail, conversation view, reply / reply all / forward with quoting, rich-text compose with attachments (drag and drop) and contact autocomplete, per-account signatures, drafts, multi-select, drag messages to folders, archive, move, flag, new folders, an address book built automatically from your mail, desktop notifications, light and dark themes, a phone-sized layout, and keyboard shortcuts (press `?`).

IMAP accounts get new mail instantly (IMAP IDLE). Other accounts are checked every 5 minutes by default.

## Privacy and security

- The server listens only on `127.0.0.1`. Every API call needs a random token that only the app page and the MCP bridge have. Requests carrying another `Host` header are refused, which blocks DNS-rebinding attacks.
- Passwords, OAuth tokens and the Anthropic key are encrypted with AES-256-GCM. The key is kept in the data folder with owner-only permissions.
- Email HTML has scripts and active content removed, then is shown in a sandboxed frame with no scripts. Pictures from the internet are blocked until you choose to show them (Settings → General changes the default).
- Claude is told that email content is untrusted and not to follow instructions written inside emails. Sends and deletes need your approval by default.

## Data

Everything lives in `~/.switchboard` (set `SWITCHBOARD_DATA_DIR` to move it): the SQLite database, cached messages, the encryption key and the API token. Back up this folder to keep your settings. Change the port with `SWITCHBOARD_PORT`. If you change the port, the OAuth redirect URIs change to match.

By default the last 90 days of mail are kept locally (Settings → General). Older mail stays on your servers and can be found with “Search the mail servers”.

## Known limitations

- Gmail and Microsoft support was built against the documented Gmail, Google Calendar and Microsoft Graph APIs and tested against mocked responses of those APIs, not live accounts. IMAP, POP3 and SMTP were tested against real servers. Report anything the first live sign-in turns up.
- Microsoft limits a sent message to about 4 MB including attachments when sending this way.
- Calendars for IMAP/POP3 accounts live on this computer. CalDAV sync (iCloud, Fastmail calendars) is not built yet; subscribe to their read-only `.ics` link meanwhile.
- Editing a recurring event changes that one occurrence, not the whole series.
- Gmail drafts made in other apps appear in Drafts but open as new messages. Switchboard’s own drafts are kept on this computer.
- Mail rules/filters and S/MIME are not built yet.

## Development

```
bin/            switchboard.js (launcher) and mcp-stdio.js (Claude Desktop/Code bridge)
src/            server, sync engine, mail/calendar/contacts services, iCalendar, time zones
src/providers/  imap, pop3, smtp, gmail, graph
src/claude/     tools.js (shared tool definitions), mcp.js, assistant.js
public/         the web app (no build step)
test/           unit, provider (mocked Gmail/Graph) and end-to-end tests
```

```sh
npm test
```

The end-to-end test runs against a local Dovecot IMAP/POP3 server and skips itself when Dovecot isn’t running. To run it, install Dovecot (`apt-get install dovecot-imapd dovecot-pop3d`), serve IMAPS on port 10993 and POP3S on 10995 for users `user1@test.local` … `user12@test.local` (passwords `pass1` … `pass12`), with the special-use folders Sent, Trash, Drafts, Archive and Junk. `test/helpers/servers.js` supplies the SMTP side. The end-to-end test connects all 12 accounts at once, checks that flags, archiving and deletion reach the IMAP server, sends mail between accounts, drives the MCP server over HTTP, and runs the in-app assistant (against a stand-in for the Claude API) through an approved send and a declined one.
