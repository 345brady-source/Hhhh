# Switchboard

An Outlook-style email and calendar app that holds all of your email accounts at once — Gmail, Microsoft (Outlook.com / Microsoft 365), any IMAP or POP3 mailbox, and CalDAV calendars (iCloud, Fastmail, Nextcloud…) — merges every calendar into one master calendar, and is built to be driven by Claude.

- **Every account in one place.** No account limit. All inboxes merge into “All inboxes”; each account keeps its own folders, color and signature.
- **One master calendar.** Google, Outlook and CalDAV calendars, calendars kept on this computer, and web subscriptions, shown together and edited in place. Repeating events, reminders, invitations.
- **Claude, two ways.** A Claude panel inside the app (Ctrl+K), and an MCP server, so Claude Desktop and Claude Code can read your mail and manage your calendar directly. “Add dentist Tuesday at 3 to my personal calendar” works from either.

Mail, tokens and passwords stay on the computer that runs Switchboard; passwords and tokens are stored encrypted.

## Quick start

Requires [Node.js](https://nodejs.org/) 22.13 or newer.

```sh
cd switchboard
npm install
npm start
```

Your browser opens at http://127.0.0.1:4545. Go to **Settings → Accounts → Add account**.

## Running and hosting

| Where | How | Who can reach it |
|---|---|---|
| Your computer, on demand | `npm start` | Only this computer |
| Your computer, always on | `npm run service:install` | Only this computer; starts at login |
| A home server or VPS | Docker + `deploy/docker-compose.yml` | You, from anywhere, over HTTPS with a password |
| Claude Desktop only | Point Claude Desktop at `bin/mcp-stdio.js` | Starts with Claude; the web UI runs while Claude is open |

### On your computer

`npm start` runs Switchboard until you press Ctrl+C. To have it start by itself at login and run in the background:

```sh
npm run service:install     # macOS (launchd), Linux (systemd --user) or Windows (Startup folder)
npm run service:uninstall
```

Then open http://127.0.0.1:4545 whenever you like (bookmark it, or “Install app” from Chrome/Edge to give it its own window and dock icon).

### On a server, reachable from anywhere

Switchboard listens only on `127.0.0.1` by default. To host it for yourself on a home server or a small VPS:

1. Point a domain at the server (for example `mail.example.com`) and open ports 80 and 443.
2. `cp deploy/.env.example deploy/.env` and fill it in. At minimum set `SWITCHBOARD_DOMAIN` and a long `SWITCHBOARD_PASSWORD`.
3. Start it:
   ```sh
   docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
   ```
   Caddy fetches an HTTPS certificate automatically and forwards to Switchboard. Data lives in the `switchboard-data` Docker volume.
4. Open `https://mail.example.com`, sign in with the password, and add accounts.

Without Docker, the same settings work as environment variables behind any HTTPS reverse proxy (Caddy, nginx, Cloudflare Tunnel, Tailscale Serve):

| Variable | Meaning |
|---|---|
| `SWITCHBOARD_HOST` | Interface to listen on. `127.0.0.1` (default) or `0.0.0.0` |
| `SWITCHBOARD_PORT` | Port (default 4545) |
| `SWITCHBOARD_PASSWORD` | Login password. **Required** whenever `SWITCHBOARD_HOST` is not `127.0.0.1`; Switchboard refuses to start exposed without one |
| `SWITCHBOARD_PUBLIC_URL` | The public address, e.g. `https://mail.example.com`. Used for sign-in redirects and allowed as a host name |
| `SWITCHBOARD_ALLOWED_HOSTS` | Extra host names to accept, comma-separated |
| `SWITCHBOARD_DATA_DIR` | Where data is kept (default `~/.switchboard`, `/data` in Docker) |

When hosted, every page asks for the password once per device (30-day session, `HttpOnly`/`Secure` cookie; repeated wrong passwords are slowed down). Register these redirect URIs for Gmail and Microsoft: `https://<your domain>/oauth/google/callback` (Google “Web application” client) and `https://<your domain>/oauth/microsoft/callback` (Microsoft “Web” platform with a client secret, `MICROSOFT_CLIENT_SECRET`).

Hosting is meant for one person’s own mail. Don’t share the password; anyone who has it can read every connected account.

## Adding accounts

| Account | How it connects | What syncs |
|---|---|---|
| Gmail / Google Workspace | Google sign-in (OAuth) | Mail and labels (Gmail API), Google Calendar, drafts |
| Outlook.com, Hotmail, Live, Microsoft 365 | Microsoft sign-in (OAuth) | Mail and folders, Outlook calendars, drafts (Microsoft Graph) |
| IMAP (Yahoo, iCloud, AOL, Fastmail, Zoho, GMX, your domain…) | Server settings and password | Mail, folders and drafts both ways. Calendars over CalDAV when available, else a calendar on this computer |
| POP3 | Server settings and password | Mail downloaded to this computer. Calendar over CalDAV, or on this computer |
| CalDAV calendar only (iCloud, Fastmail, Nextcloud, Radicale…) | Server address and password | Calendars, both ways |

**IMAP and POP3.** Type the email address and Switchboard fills in the mail server settings and, for iCloud, Yahoo, Fastmail, Zoho and AOL, the CalDAV calendar server, from built-in presets, DNS records, or a best guess. Yahoo, iCloud, AOL and Fastmail require an *app password*. Click **Test connection** before saving. If an address actually belongs to Google Workspace or Microsoft 365, Switchboard says so and offers the sign-in button instead.

**Gmail and Microsoft** sign in with OAuth, so Switchboard never sees those passwords. Each needs a free app registration, made once (about 5 minutes); the steps are also shown in the app.

<details>
<summary>Google: create the sign-in app</summary>

1. In [Google Cloud Console](https://console.cloud.google.com/projectcreate), create a project.
2. Enable the [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com) and the [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com).
3. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), set up the consent screen (External). Either add yourself as a test user, or publish the app. In testing mode, Google ends sign-ins after 7 days.
4. Under [Clients](https://console.cloud.google.com/auth/clients), create a **Desktop app** client (or a **Web application** client when hosted, with the redirect URI above).
5. In Switchboard: **Settings → Accounts → Set up Google**. Paste the client ID and secret.

Scopes requested: full Gmail access (`https://mail.google.com/`, needed to permanently delete from Trash) and Google Calendar.
</details>

<details>
<summary>Microsoft: create the sign-in app</summary>

1. In [Microsoft Entra → App registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade), click **New registration**.
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
3. Redirect URI: platform **Public client/native (mobile & desktop)**, value `http://localhost:4545/oauth/microsoft/callback`. (Hosted: platform **Web**, `https://<your domain>/oauth/microsoft/callback`, and create a client secret.)
4. Copy the Application (client) ID into **Settings → Accounts → Set up Microsoft**.

Permissions requested: `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, `User.Read`, `offline_access`. Some organizations require an admin to approve third-party apps.
</details>

The IDs can also come from the environment: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`.

## Using Claude

### In the app

Open **Settings → Claude** and paste an [Anthropic API key](https://platform.claude.com/settings/keys) (or set `ANTHROPIC_API_KEY`). Then press **Ctrl+K** (⌘K), or use the buttons on any email (Summarize, Draft reply, Add to calendar, Action items). Claude sees which email or calendar day you have open.

Examples:

- “What’s on my calendar this week across everything?”
- “Add lunch with Sam tomorrow at noon to my personal calendar.”
- “Put swim lessons on the family calendar every Tuesday at 5 until the end of the year.”
- “Find a free hour Thursday or Friday afternoon and put a hold on my work calendar called ‘Planning’.”
- “Summarize unread mail from all my accounts. What needs a reply today?”
- “Reply to Dana that Tuesday works, and send it tomorrow at 8am.”
- “Move anything from LinkedIn into a Social folder and mark it read — from now on, too.”
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

If Switchboard is already running, `mcp-stdio.js` relays to it. If not, it starts Switchboard (web UI included) for as long as Claude is open. Claude Code can also connect over HTTP to `http://127.0.0.1:4545/mcp` (or `https://<your domain>/mcp` when hosted) with the bearer token shown in Settings.

**Tools Claude gets (25):** `get_overview`, `list_accounts`, `list_folders`, `list_emails`, `search_emails`, `read_email`, `read_thread`, `send_email` (now or later), `list_scheduled_emails`, `cancel_scheduled_email`, `create_draft`, `update_emails`, `list_calendars`, `list_events`, `create_event` (including repeating events), `update_event` and `delete_event` (one occurrence or the whole series), `find_free_time`, `add_invite_to_calendar`, `respond_to_invite`, `list_rules`, `create_rule`, `delete_rule`, `search_contacts`, `sync_now`.

Claude Desktop asks before running each tool. To have emails that Claude sends from Desktop/Code wait in Drafts instead, set “When Claude asks to send an email” to *Save it to Drafts* in Settings → Claude.

Everything Claude does, from either place, is listed in **Settings → Activity**.

## The master calendar

- Every calendar from every account is shown together, color-coded, and each can be shown or hidden. Day, work week, week, month and agenda views.
- **Default calendar:** the ★ calendar receives new events, from you or from Claude, unless another is named.
- **Google, Microsoft and CalDAV calendars** sync both ways; events Claude adds appear on your phone too. Adding attendees sends real invitations. You can add a Google Meet or Teams link.
- **Repeating events** (daily, weekdays, weekly on chosen days, monthly — including “last Friday” — and yearly; ending after a count or on a date) work on every calendar type. Changing or deleting one asks whether you mean this occurrence or the whole series.
- **Reminders** pop up as desktop notifications (with a Join button for online meetings). Events without their own reminder use a default (Settings → General).
- **IMAP and POP3 accounts** without CalDAV get a calendar kept on this computer, as in Outlook. Inviting people to an event there emails them an iCalendar invitation.
- **Invitations in email** show Accept / Tentative / Decline / Add to calendar, and don’t duplicate meetings already on a synced calendar.
- **Subscriptions:** any `webcal://` or `.ics` link. Calendars can be exported as `.ics`.
- **Free time** is found across all calendars within your working hours.

## Mail features

Unified inbox, per-account folders with unread counts, Unread / Flagged / Sent / Drafts / Scheduled views across accounts, Gmail-style search (`from:` `to:` `subject:` `has:attachment` `has:invite` `is:unread` `is:flagged` `in:` `account:` `after:` `before:` `newer_than:7d`) with an option to also search the servers for older mail, conversation view, reply / reply all / forward, rich-text compose with attachments (drag and drop) and contact autocomplete, per-account signatures, **undo send**, **send later**, **drafts kept in the account’s Drafts folder** (start on your phone, finish here), **rules** that sort new mail (move, mark read, flag, archive, delete, forward), multi-select, drag to folders, archive, move, flag, new folders, an address book built from your mail, desktop notifications, light and dark themes, a phone-sized layout, and keyboard shortcuts (press `?`).

IMAP accounts get new mail instantly (IMAP IDLE); others are checked every 5 minutes by default, and a folder refreshes when you open it. Large attachments on Microsoft accounts are uploaded in chunks, so messages over 4 MB send fine.

## Privacy and security

- By default the server listens only on `127.0.0.1`. Every API call needs a random token that only the app page and the MCP bridge have. Requests carrying another `Host` header are refused, which blocks DNS-rebinding attacks. When hosted, a password login sits in front of everything as well.
- Passwords, OAuth tokens and the Anthropic key are encrypted with AES-256-GCM. The key is kept in the data folder with owner-only permissions.
- Email HTML has scripts and active content removed, then is shown in a sandboxed frame with no scripts. Pictures from the internet are blocked until you choose to show them.
- Claude is told that email content is untrusted and not to follow instructions written inside emails. Sends and deletes need your approval by default.

## Data

Everything lives in `~/.switchboard` (or `SWITCHBOARD_DATA_DIR`): the SQLite database, cached messages, the encryption key and the API token. Back up this folder to keep your settings. By default the last 90 days of mail are kept locally (Settings → General); older mail stays on your servers and can be found with “Search the mail servers”.

## Known limitations

- Gmail and Microsoft support was built against the documented Gmail, Google Calendar and Microsoft Graph APIs and tested against mocked responses of those APIs, not live accounts. IMAP, POP3, SMTP and CalDAV were tested against real servers. Report anything the first live sign-in turns up.
- The Docker image and compose file follow standard practice but were not built in the development environment (it has no Docker daemon); `npm start` and `service install` paths were run.
- S/MIME encryption and signing are not supported.

## Demo

`demo/` holds a self-contained demo: the real web app plus `demo/backend.js`, which stands in for the server in the browser with sample data for ten accounts. When the demo is opened as a claude.ai artifact, its Claude panel uses the viewer's own Claude (through the artifact runtime) with the demo's mail and calendar as tools. Build it with `node scripts/build-demo.mjs` (output in `demo/dist/`).

## Development

```
bin/            switchboard.js (launcher, service install) and mcp-stdio.js (Claude Desktop/Code bridge)
src/            server, sync engine, mail/calendar/contacts/rules services, iCalendar, recurrence, time zones
src/providers/  imap, pop3, smtp, gmail, graph, caldav
src/claude/     tools.js (shared tool definitions), mcp.js, assistant.js
public/         the web app (no build step)
demo/           in-browser demo backend and page shell; scripts/build-demo.mjs assembles demo/dist
deploy/         docker-compose.yml (with Caddy for HTTPS) and .env.example
test/           unit, feature, provider (mocked Gmail/Graph), CalDAV, end-to-end, hosting and browser tests
```

```sh
sudo npm run test:servers   # once per machine (Debian/Ubuntu): Dovecot IMAP/POP3 + Radicale CalDAV test servers
npm test
```

`test/setup-servers.sh` installs and starts Dovecot (IMAPS 10993, POP3S 10995, users `user1@test.local`…`user12@test.local`) and Radicale (CalDAV on 5232). Tests that need those servers, or Playwright for the browser tests, skip themselves when they are missing. The full suite (49 tests) connects 12 accounts at once, checks flags/moves/deletes/rules/drafts on the IMAP server, sends mail between accounts, syncs CalDAV both ways with repeating events and conflicting edits, drives the MCP server, runs the in-app assistant against a stand-in for the Claude API (approved and declined sends), checks the hosted login, and clicks through the UI in Chromium.
