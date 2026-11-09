// The tools Claude uses to work with mail and the master calendar.
// The same definitions back the MCP server (Claude Desktop / Claude Code) and the in-app assistant.

import { listAccounts, resolveAccount } from '../accounts.js';
import { foldersOf, folderByRole } from '../store.js';
import { get, getSetting, json } from '../db.js';
import * as mail from '../mail.js';
import * as cal from '../calendar.js';
import { searchContacts } from '../contacts.js';
import * as rules from '../rules.js';
import { syncAccount, syncAll, ensureBody } from '../sync.js';
import { describe, localDate, toZonedIso, weekdayName, addDaysToDate, parseDateTime } from '../time.js';
import { formatAddr } from '../mailutil.js';

const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const int = (description, extra = {}) => ({ type: 'integer', description, ...extra });
const bool = (description) => ({ type: 'boolean', description });
const arr = (description, items = { type: 'string' }) => ({ type: 'array', items, description });
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

const RECURRENCE = {
  type: 'object',
  description: 'Make it repeat. E.g. {"frequency":"weekly","days":["MO","WE"],"count":10}, {"frequency":"weekdays"}, {"frequency":"monthly","until":"2027-06-30"}, {"frequency":"monthly","days":["-1FR"]} (last Friday).',
  properties: {
    frequency: { type: 'string', enum: ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'] },
    interval: { type: 'integer', minimum: 1, description: 'Every N days/weeks/months/years (default 1).' },
    days: { type: 'array', items: { type: 'string' }, description: 'Weekdays as MO TU WE TH FR SA SU; for monthly, a position prefix like 1MO (first Monday) or -1FR (last Friday).' },
    count: { type: 'integer', minimum: 1, description: 'Stop after this many occurrences.' },
    until: { type: 'string', description: 'Last date, YYYY-MM-DD.' },
  },
  required: ['frequency'],
  additionalProperties: false,
};
const SCOPE = { type: 'string', enum: ['occurrence', 'series'], description: 'For repeating events: "occurrence" (default) changes only this one; "series" changes every occurrence.' };

const TIME_HELP = 'Use ISO 8601. "2026-11-12T14:30" is read in the user\'s time zone; an explicit offset ("...-05:00") or "Z" is honored. A date alone ("2026-11-12") means that whole day.';

function account(ref) {
  if (ref == null || ref === '') return null;
  const a = resolveAccount(ref);
  if (!a) throw new Error(`No account matches "${ref}". Accounts: ${listAccounts().map((x) => `${x.email} (${x.label})`).join(', ')}`);
  return a;
}

function folderFor(acc, ref) {
  if (!ref) return null;
  const s = String(ref).toLowerCase();
  const folders = foldersOf(acc.id);
  const f = folders.find((x) => String(x.id) === s) || folders.find((x) => x.role === s) || folders.find((x) => x.name.toLowerCase() === s) || folders.find((x) => (x.path || '').toLowerCase() === s) || folders.find((x) => x.name.toLowerCase().includes(s));
  if (!f) throw new Error(`No folder "${ref}" in ${acc.email}. Folders: ${folders.filter((x) => x.role !== 'search').map((x) => x.name).join(', ')}`);
  return f;
}

function clip(text, max = 30000) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}\n\n[… truncated ${text.length - max} characters]` : text;
}

const VIEW_MAP = { inbox: 'unified', unified: 'unified', unread: 'unread', flagged: 'flagged', sent: 'sent', all: 'all' };

export const TOOLS = [
  {
    name: 'get_overview',
    description:
      "Snapshot of the user's mail and calendar: current date/time and time zone, every connected account with unread counts and sync status, today's agenda across the master calendar, the next few days, and the default calendar. Call this first in a conversation to orient yourself (especially to resolve relative dates like 'next Tuesday').",
    input_schema: obj({}),
    readOnly: true,
    run: () => {
      const tz = cal.userTz();
      const now = new Date();
      const today = localDate(now, tz);
      const accounts = listAccounts().map((a) => {
        const inbox = folderByRole(a.id, 'inbox');
        return {
          account: a.email,
          label: a.label,
          type: { gmail: 'Gmail', microsoft: 'Microsoft 365 / Outlook.com', imap: 'IMAP', pop3: 'POP3' }[a.type],
          unread_in_inbox: inbox ? inbox.unread_count : 0,
          status: a.enabled ? a.status : 'disabled',
          ...(a.lastError ? { problem: a.lastError } : {}),
        };
      });
      const { from, to } = cal.dayRange(today, 1);
      const next = cal.dayRange(addDaysToDate(today, 1), 6);
      const def = cal.defaultCalendar();
      const c = mail.counts();
      return {
        now: toZonedIso(now, tz),
        today: `${weekdayName(today)}, ${today}`,
        time_zone: tz,
        accounts,
        total_unread_in_inboxes: c.unified,
        flagged_messages: c.flagged,
        drafts_waiting: c.drafts,
        default_calendar: def ? `${def.account} · ${def.name} (id ${def.id})` : null,
        today_agenda: cal.listEvents({ from, to }).map(eventForClaude),
        next_6_days: cal.listEvents({ from: next.from, to: next.to, limit: 60 }).map((e) => ({ id: e.id, title: e.title, when: e.when, calendar: `${e.account} · ${e.calendar}` })),
      };
    },
  },
  {
    name: 'list_accounts',
    description: 'List all connected email accounts (Gmail, Microsoft, IMAP, POP3) with their email address, label, type, status and unread count.',
    input_schema: obj({}),
    readOnly: true,
    run: () =>
      listAccounts().map((a) => ({
        id: a.id,
        email: a.email,
        label: a.label,
        name: a.displayName,
        type: a.type,
        status: a.enabled ? a.status : 'disabled',
        unread_in_inbox: folderByRole(a.id, 'inbox')?.unread_count || 0,
        last_sync: a.lastSyncAt,
        ...(a.lastError ? { problem: a.lastError } : {}),
      })),
  },
  {
    name: 'list_folders',
    description: 'List the folders (or Gmail labels) of one account, with unread and total counts.',
    input_schema: obj({ account: str('Account email address or label.') }, ['account']),
    readOnly: true,
    run: ({ account: ref }) => {
      const a = account(ref);
      return foldersOf(a.id).filter((f) => f.role !== 'search').map((f) => ({ id: f.id, name: f.name, path: f.path, role: f.role, unread: f.unread_count, total: f.total_count }));
    },
  },
  {
    name: 'list_emails',
    description:
      'List recent emails, newest first. view "inbox" is the unified inbox across all accounts; "unread", "flagged" and "sent" also span all accounts. Narrow with account and/or folder. Returns ids for read_email.',
    input_schema: obj({
      view: str('inbox (default), unread, flagged, sent, or all', { enum: ['inbox', 'unread', 'flagged', 'sent', 'all'] }),
      account: str('Only this account (email address or label).'),
      folder: str('Folder name or role (inbox, sent, archive, trash, junk, drafts) within the account. Requires account.'),
      limit: int('How many (default 20, max 100).', { minimum: 1, maximum: 100 }),
      offset: int('Skip this many, for paging.', { minimum: 0 }),
    }),
    readOnly: true,
    run: ({ view = 'inbox', account: ref, folder, limit = 20, offset = 0 }) => {
      const a = account(ref);
      if (folder && !a) throw new Error('Give an account when choosing a folder.');
      const f = a && folder ? folderFor(a, folder) : null;
      const r = mail.listMessages({ view: VIEW_MAP[view] || 'unified', accountId: a?.id, folderId: f?.id, limit: Math.min(limit, 100), offset });
      return { emails: r.messages.map((m) => mail.formatForClaude(m)), more_available: r.more };
    },
  },
  {
    name: 'search_emails',
    description:
      'Search mail across all accounts. Supports words/phrases plus Gmail-style operators: from:, to:, subject:, has:attachment, has:invite, is:unread, is:read, is:flagged, in:<folder>, account:<email or label>, after:YYYY-MM-DD, before:YYYY-MM-DD, newer_than:7d, older_than:1y. Searches the locally synced mail (recent months); set search_server to also ask the mail servers for older messages.',
    input_schema: obj(
      {
        query: str('Search query, e.g. "from:dana invoice after:2026-10-01".'),
        account: str('Limit to one account (email or label).'),
        limit: int('Max results (default 20, max 100).', { minimum: 1, maximum: 100 }),
        search_server: bool('Also search the mail servers (slower; finds mail older than the local sync window).'),
      },
      ['query'],
    ),
    readOnly: true,
    run: async ({ query, account: ref, limit = 20, search_server = false }) => {
      const a = account(ref);
      const local = mail.listMessages({ view: 'all', q: query, accountId: a?.id, limit: Math.min(limit, 100) });
      let results = local.messages;
      const out = {};
      if (search_server) {
        const plain = query.replace(/\b\w+:("[^"]*"|\S+)/g, '').trim() || query;
        const remote = await mail.searchServer(plain, { accountId: a?.id, limit: Math.min(limit, 50) });
        const ids = new Set(results.map((m) => m.id));
        results = [...results, ...remote.messages.filter((m) => !ids.has(m.id))].sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, limit);
        if (remote.errors.length) out.server_errors = remote.errors;
      }
      return { ...out, count: results.length, emails: results.map((m) => mail.formatForClaude(m)) };
    },
  },
  {
    name: 'read_email',
    description: 'Read one email in full: headers, plain-text body, attachment names, and meeting-invitation details if it contains one. Does not mark it as read unless mark_read is true.',
    input_schema: obj({ id: int('Email id from list_emails or search_emails.'), mark_read: bool('Also mark it as read.') }, ['id']),
    readOnly: true,
    run: async ({ id, mark_read = false }) => {
      const m = await mail.getMessage(id, { markRead: mark_read, inlineImages: false });
      return {
        ...mail.formatForClaude(m),
        reply_to: m.replyTo?.length ? m.replyTo.map(formatAddr).join(', ') : undefined,
        messages_in_conversation: m.threadCount,
        attachments: m.attachments.filter((a) => !a.inline).map((a) => ({ name: a.filename, type: a.contentType, size_kb: Math.round(a.size / 1024) })),
        meeting_invite: m.invite
          ? {
              title: m.invite.title, when: m.invite.when, start: m.invite.startLocal, end: m.invite.endLocal, all_day: m.invite.allDay,
              location: m.invite.location, organizer: m.invite.organizer, recurring: m.invite.recurring, online_meeting: m.invite.onlineMeetingUrl,
              cancelled: m.invite.cancelled, already_on_calendar: m.invite.existingCalendar,
            }
          : undefined,
        body: clip(m.text),
      };
    },
  },
  {
    name: 'read_thread',
    description: 'Read a whole email conversation (all messages in the thread, oldest first) given the id of any message in it.',
    input_schema: obj({ id: int('Id of any email in the conversation.') }, ['id']),
    readOnly: true,
    run: async ({ id }) => {
      const thread = mail.getThread(id);
      const out = [];
      let budget = 60000;
      for (const s of thread) {
        const row = await ensureBody(s.id).catch(() => null);
        const body = row?.body_text || s.snippet;
        const piece = clip(body.replace(/\n>.*$/gm, '').trim(), Math.max(2000, Math.floor(budget / thread.length)));
        budget -= piece.length;
        out.push({ ...mail.formatForClaude(s), body: piece });
      }
      return { messages: out };
    },
  },
  {
    name: 'send_email',
    description:
      'Send an email now from one of the connected accounts. For replies give reply_to_id (threads correctly, quotes the original, and defaults the recipients and "Re:" subject); for forwards give forward_id (includes the original and its attachments). body is plain text; simple Markdown (**bold**, bullet lists, links) is rendered. The account signature is added automatically. If the user has not clearly asked to send, use create_draft instead.',
    input_schema: obj(
      {
        from_account: str('Account to send from (email or label). Defaults to the account that received the email being replied to/forwarded, else the default account.'),
        to: arr('Recipients, e.g. ["Dana Lee <dana@example.com>"] or ["dana@example.com"]. Optional for replies.'),
        cc: arr('Cc recipients.'),
        bcc: arr('Bcc recipients.'),
        subject: str('Subject. Optional for replies/forwards.'),
        body: str('Message body (plain text or light Markdown). Do not include the quoted original; it is added for you.'),
        reply_to_id: int('Id of the email being replied to.'),
        reply_all: bool('With reply_to_id: also reply to everyone on the original.'),
        forward_id: int('Id of the email being forwarded.'),
        send_at: str(`Send later instead of now, e.g. "2026-11-12T08:00". ${'Read in the user\'s time zone.'}`),
      },
      ['body'],
    ),
    sends: true,
    destructive: true,
    run: async (input, ctx) => {
      const p = await sendParams(input);
      if (ctx.mcp && getSetting('mcpSendMode', 'send') === 'draft') {
        const d = mail.saveDraft(p, ctx.actor);
        return { sent: false, saved_as_draft: true, draft_id: d.id, note: 'Sending from Claude is set to "save as draft" in Switchboard settings. The draft is waiting in Drafts for the user to review and send.' };
      }
      return mail.sendMessage({ ...p, appendSignature: true, sendAt: input.send_at }, ctx.actor);
    },
  },
  {
    name: 'list_scheduled_emails',
    description: 'List emails waiting to be sent later (scheduled with send_at), with their ids.',
    input_schema: obj({}),
    readOnly: true,
    run: () => mail.listOutbox().map((o) => ({ id: o.id, status: o.status, send_at: o.when, from: o.account, to: o.to.join(', '), subject: o.subject, ...(o.error ? { error: o.error } : {}) })),
  },
  {
    name: 'cancel_scheduled_email',
    description: 'Cancel an email scheduled to be sent later.',
    input_schema: obj({ id: int('Scheduled email id from list_scheduled_emails.') }, ['id']),
    destructive: true,
    run: ({ id }, ctx) => mail.cancelOutbox(id, ctx.actor),
  },
  {
    name: 'create_draft',
    description: 'Write an email and save it to Drafts for the user to review, edit and send themselves. Same fields as send_email. Use this when the user asks you to draft or prepare a message.',
    input_schema: obj(
      {
        from_account: str('Account to send from (email or label).'),
        to: arr('Recipients.'),
        cc: arr('Cc recipients.'),
        bcc: arr('Bcc recipients.'),
        subject: str('Subject.'),
        body: str('Message body (plain text or light Markdown).'),
        reply_to_id: int('Id of the email this replies to.'),
        reply_all: bool('Reply to everyone on the original.'),
        forward_id: int('Id of the email being forwarded.'),
      },
      ['body'],
    ),
    run: async (input, ctx) => {
      const p = await sendParams(input);
      if (p.replyToId && (!p.to || !p.to.length)) {
        const orig = await ensureBody(p.replyToId);
        const acc = listAccounts().find((a) => a.id === p.accountId);
        const fromMe = acc && orig.from_addr?.toLowerCase() === acc.email.toLowerCase();
        const replyTo = json(orig.reply_to_json, []);
        p.to = fromMe ? json(orig.to_json, []) : replyTo.length ? replyTo : [{ name: orig.from_name, address: orig.from_addr }];
        if (input.reply_all) p.cc = [...(p.cc || []), ...json(orig.cc_json, []), ...json(orig.to_json, []).filter((x) => x.address.toLowerCase() !== acc?.email.toLowerCase())];
        if (!p.subject) p.subject = /^re:/i.test(orig.subject || '') ? orig.subject : `Re: ${orig.subject || ''}`;
      }
      if (p.forwardId && !p.subject) {
        const orig = await ensureBody(p.forwardId);
        p.subject = /^fwd?:/i.test(orig.subject || '') ? orig.subject : `Fwd: ${orig.subject || ''}`;
      }
      const d = mail.saveDraft(p, ctx.actor);
      return { saved: true, draft_id: d.id, from: d.accountEmail, to: d.to.map(formatAddr), subject: d.subject, note: 'Saved in Drafts in Switchboard for the user to review and send.' };
    },
  },
  {
    name: 'update_emails',
    description: 'Change emails: mark_read, mark_unread, flag, unflag, archive, delete (moves to Deleted Items/Trash; deleting from Trash is permanent), or move (to a folder in the same account).',
    input_schema: obj(
      {
        ids: arr('Email ids.', { type: 'integer' }),
        action: str('What to do.', { enum: ['mark_read', 'mark_unread', 'flag', 'unflag', 'archive', 'delete', 'move'] }),
        folder: str('For move: target folder name or role (e.g. "archive", "Receipts").'),
      },
      ['ids', 'action'],
    ),
    destructiveWhen: (i) => i.action === 'delete',
    run: async ({ ids, action, folder }, ctx) => {
      if (!ids.length) throw new Error('No ids given.');
      switch (action) {
        case 'mark_read': return mail.setFlags(ids, { seen: true }, ctx.actor);
        case 'mark_unread': return mail.setFlags(ids, { seen: false }, ctx.actor);
        case 'flag': return mail.setFlags(ids, { flagged: true }, ctx.actor);
        case 'unflag': return mail.setFlags(ids, { flagged: false }, ctx.actor);
        case 'archive': return mail.archiveMessages(ids, ctx.actor);
        case 'delete': return mail.deleteMessages(ids, ctx.actor);
        case 'move': {
          if (!folder) throw new Error('Give a folder to move to.');
          const first = get('SELECT account_id FROM messages WHERE id = ?', ids[0]);
          if (!first) throw new Error('Email not found.');
          const acc = listAccounts().find((a) => a.id === first.account_id);
          return mail.moveMessages(ids, folderFor(acc, folder).id, ctx.actor);
        }
        default: throw new Error('Unknown action');
      }
    },
  },
  {
    name: 'list_calendars',
    description: 'List every calendar in the master calendar (from all accounts, plus calendars kept on this computer and subscriptions), with ids, which account each belongs to, and which is the default for new events.',
    input_schema: obj({}),
    readOnly: true,
    run: () => cal.listCalendars().map((c) => ({ id: c.id, name: c.name, account: c.accountEmail || c.account, writable: !c.readOnly, shown: c.visible, default: c.isDefault || c.id === cal.defaultCalendar()?.id, primary: c.isPrimary })),
  },
  {
    name: 'list_events',
    description: `List events on the master calendar (all accounts merged) between start and end. Defaults to today through 7 days from now. ${TIME_HELP}`,
    input_schema: obj({
      start: str('Range start.'),
      end: str('Range end (exclusive). A date alone means up to the start of that day; to include a whole day pass the next day.'),
      query: str('Only events whose title, location, description or attendees contain this text.'),
      calendar: str('Only this calendar (id, name, or account email).'),
      limit: int('Max events (default 100).', { minimum: 1, maximum: 500 }),
    }),
    readOnly: true,
    run: ({ start, end, query, calendar, limit = 100 }) => {
      const tz = cal.userTz();
      const from = start ? parseDateTime(start, tz) : cal.dayRange().from;
      const to = end ? parseDateTime(end, tz) : new Date(from.getTime() + 7 * 86400_000);
      if (!from || !to) throw new Error('Could not read the start or end. ' + TIME_HELP);
      const c = calendar ? cal.resolveCalendar(calendar, { writable: false }) : null;
      if (calendar && !c) throw new Error(`No calendar matches "${calendar}".`);
      const evs = cal.listEvents({ from, to, query, calendarIds: c ? [c.id] : undefined, limit });
      return { range: `${describe(from, tz)} → ${describe(to, tz)}`, time_zone: tz, count: evs.length, events: evs.map(eventForClaude) };
    },
  },
  {
    name: 'create_event',
    description: `Add an event to the user's calendar. Without "calendar" it goes on the default calendar; pass an account email/label (e.g. "work") or calendar name/id to choose. Events on Google or Microsoft calendars sync to those services and invitations go to attendees. Returns the saved event and any overlapping events so you can mention conflicts. ${TIME_HELP}`,
    input_schema: obj(
      {
        title: str('Event title.'),
        start: str('Start, e.g. "2026-11-12T14:30" (or "2026-11-12" for an all-day event).'),
        end: str('End time. For all-day events, the LAST day (inclusive). Omit to use duration_minutes (default 60 minutes).'),
        duration_minutes: int('Length when end is omitted.', { minimum: 1 }),
        all_day: bool('All-day event. Inferred when start is a date without a time.'),
        calendar: str('Calendar id, calendar name, or account email/label. Defaults to the default calendar.'),
        location: str('Location or address.'),
        description: str('Notes.'),
        attendees: arr('Attendee email addresses to invite.'),
        reminder_minutes: int('Reminder this many minutes before (e.g. 15).', { minimum: 0 }),
        online_meeting: bool('Add a Google Meet / Teams link (Google and Microsoft calendars only).'),
        show_as: str('busy (default) or free.', { enum: ['busy', 'free', 'tentative'] }),
        timezone: str('IANA time zone for start/end if not the user\'s, e.g. "Europe/London".'),
        source_email_id: int('Id of the email this event came from, to link them.'),
        recurrence: RECURRENCE,
      },
      ['title', 'start'],
    ),
    run: async (input, ctx) => {
      const res = await cal.createEvent({ ...input, source_message_id: input.source_email_id }, ctx.actor);
      return { created: eventForClaude(res.event), conflicts: res.conflicts.filter((c) => c.id !== res.event.id).map((c) => ({ id: c.id, title: c.title, when: c.when, calendar: `${c.account} · ${c.calendar}` })) };
    },
  },
  {
    name: 'update_event',
    description: `Change an event (title, time, place, notes, attendees, reminder) or move it to another calendar. Only the fields given change; changing start alone keeps the duration. ${TIME_HELP}`,
    input_schema: obj(
      {
        id: int('Event id from list_events.'),
        title: str('New title.'),
        start: str('New start.'),
        end: str('New end (for all-day events, the last day).'),
        duration_minutes: int('New length (with or instead of end).', { minimum: 1 }),
        all_day: bool('Make it all-day (true) or timed (false).'),
        location: str('New location ("" to clear).'),
        description: str('New notes ("" to clear).'),
        attendees: arr('Full new attendee list (replaces the old list).'),
        reminder_minutes: int('Reminder minutes before.', { minimum: 0 }),
        calendar: str('Move to this calendar (id, name or account).'),
        timezone: str('IANA time zone for start/end if not the user\'s.'),
        notify_attendees: bool('Send updates to attendees (default true).'),
        scope: SCOPE,
        recurrence: { ...RECURRENCE, description: 'New repeat pattern (with scope "series"), or omit to keep it.' },
      },
      ['id'],
    ),
    run: async ({ id, notify_attendees, ...rest }, ctx) => {
      const res = await cal.updateEvent(id, { ...rest, notify: notify_attendees }, ctx.actor);
      return { updated: eventForClaude(res.event), conflicts: (res.conflicts || []).map((c) => ({ id: c.id, title: c.title, when: c.when })) };
    },
  },
  {
    name: 'delete_event',
    description: 'Delete an event from its calendar (and cancel it for attendees if the user organized it).',
    input_schema: obj({ id: int('Event id.'), notify_attendees: bool('Tell attendees (default true).'), scope: SCOPE }, ['id']),
    destructive: true,
    run: async ({ id, notify_attendees = true, scope = 'occurrence' }, ctx) => {
      const r = await cal.deleteEvent(id, ctx.actor, { notify: notify_attendees, scope });
      return { deleted: { title: r.deleted.title, when: r.deleted.when, calendar: `${r.deleted.account} · ${r.deleted.calendar}` } };
    },
  },
  {
    name: 'find_free_time',
    description: `Find open slots across ALL of the user's calendars (every account merged) within working hours. ${TIME_HELP}`,
    input_schema: obj(
      {
        start: str('Search from (default now).'),
        end: str('Search until (default 7 days later).'),
        duration_minutes: int('Minimum slot length (default 30).', { minimum: 5 }),
        work_start: str('Earliest time of day, "HH:MM" (default from settings, usually 09:00).'),
        work_end: str('Latest time of day, "HH:MM" (default 17:00).'),
        include_weekends: bool('Include Saturdays and Sundays.'),
        limit: int('Max slots (default 15).', { minimum: 1, maximum: 50 }),
      },
    ),
    readOnly: true,
    run: ({ start, end, duration_minutes = 30, work_start, work_end, include_weekends = false, limit = 15 }) => ({
      time_zone: cal.userTz(),
      slots: cal.findFreeTime({ from: start, to: end, durationMinutes: duration_minutes, workStart: work_start, workEnd: work_end, includeWeekends: include_weekends, limit }),
    }),
  },
  {
    name: 'add_invite_to_calendar',
    description: 'Put the meeting from an email invitation (.ics) onto a calendar without replying to the organizer. If the meeting is already on a calendar, says so instead of duplicating it.',
    input_schema: obj({ email_id: int('Id of the email containing the invitation.'), calendar: str('Calendar or account to add it to (default: the default calendar).') }, ['email_id']),
    run: async ({ email_id, calendar }, ctx) => {
      const m = await mail.getMessage(email_id, { inlineImages: false });
      if (!m.invite) throw new Error('That email has no calendar invitation. Read it and use create_event with the details instead.');
      const r = await cal.addInviteToCalendar(m.invite, { calendar, sourceMessageId: email_id, actor: ctx.actor });
      return { added: !r.alreadyThere, already_on_calendar: !!r.alreadyThere, event: eventForClaude(r.event), conflicts: (r.conflicts || []).filter((c) => c.id !== r.event.id).map((c) => ({ title: c.title, when: c.when })) };
    },
  },
  {
    name: 'respond_to_invite',
    description: 'Accept, decline or tentatively accept a meeting invitation in an email. Replies to the organizer and updates the calendar (accepting adds it; declining removes it).',
    input_schema: obj({ email_id: int('Id of the invitation email.'), response: str('Your answer.', { enum: ['accept', 'decline', 'tentative'] }) }, ['email_id', 'response']),
    sends: true,
    run: async ({ email_id, response }, ctx) => {
      const r = await cal.respondToInvite(email_id, response, ctx.actor);
      return { response: r.response, event: r.event ? eventForClaude(r.event) : null };
    },
  },
  {
    name: 'list_rules',
    description: 'List the mail rules that sort incoming mail automatically.',
    input_schema: obj({}),
    readOnly: true,
    run: () => rules.listRules().map((r) => ({ id: r.id, name: r.name, enabled: r.enabled, account: r.account, rule: r.summary, times_applied: r.timesApplied })),
  },
  {
    name: 'create_rule',
    description:
      'Create a mail rule that runs on new mail as it arrives. Conditions test from / to / subject / body / any (contains, not_contains, is, ends_with) or has_attachment. Actions: move (to a folder, created if missing), mark_read, flag, archive, delete, forward (to an address). Example: newsletters → {"conditions":[{"field":"from","value":"newsletter"}],"actions":[{"type":"move","folder":"Newsletters"},{"type":"mark_read"}]}.',
    input_schema: obj(
      {
        name: str('Short name for the rule.'),
        account: str('Only for this account (email or label). Omit for every account.'),
        match: str('Whether all conditions must match (default) or any.', { enum: ['all', 'any'] }),
        conditions: arr('Conditions.', obj({ field: str('Field.', { enum: ['from', 'to', 'subject', 'body', 'any', 'has_attachment'] }), op: str('Comparison (default contains).', { enum: ['contains', 'not_contains', 'is', 'ends_with'] }), value: str('Text to look for (not needed for has_attachment).') }, ['field'])),
        actions: arr('Actions.', obj({ type: str('Action.', { enum: ['move', 'mark_read', 'flag', 'archive', 'delete', 'forward'] }), folder: str('Folder name for move.'), to: str('Address for forward.') }, ['type'])),
        stop: bool('Stop checking later rules when this one matches.'),
        apply_to_existing: bool('Also run it now on inbox mail from the last 30 days.'),
      },
      ['name', 'conditions', 'actions'],
    ),
    run: async ({ apply_to_existing, ...input }, ctx) => {
      const rule = rules.saveRule(input, ctx.actor);
      const out = { created: { id: rule.id, name: rule.name, rule: rule.summary, account: rule.account } };
      if (apply_to_existing) out.ran_on_existing = await rules.runRulesNow({ ruleId: rule.id });
      return out;
    },
  },
  {
    name: 'delete_rule',
    description: 'Delete a mail rule by id (see list_rules). Mail the rule already moved stays where it is.',
    input_schema: obj({ id: int('Rule id from list_rules.') }, ['id']),
    destructive: true,
    run: ({ id }, ctx) => rules.deleteRule(id, ctx.actor),
  },
  {
    name: 'search_contacts',
    description: 'Look up people by name, email or company in the address book (built automatically from mail the user sends and receives). Use it to find an email address before sending or inviting.',
    input_schema: obj({ query: str('Name, email or company.'), limit: int('Max results (default 10).', { minimum: 1, maximum: 50 }) }, ['query']),
    readOnly: true,
    run: ({ query, limit = 10 }) => searchContacts(query, limit).map((c) => ({ name: c.name, email: c.email, company: c.company || undefined, phone: c.phone || undefined, emails_sent_to: c.timesSent, emails_received_from: c.timesReceived, last_contact: c.lastSeen })),
  },
  {
    name: 'sync_now',
    description: 'Check for new mail and calendar changes now (all accounts, or one).',
    input_schema: obj({ account: str('Only this account (email or label).') }),
    readOnly: true,
    run: async ({ account: ref }) => {
      const a = account(ref);
      if (a) await syncAccount(a.id);
      else await syncAll();
      return listAccounts().filter((x) => !a || x.id === a.id).map((x) => ({ account: x.email, status: x.status, problem: x.lastError || undefined, unread_in_inbox: folderByRole(x.id, 'inbox')?.unread_count || 0 }));
    },
  },
];

async function sendParams(input) {
  let acc = input.from_account ? account(input.from_account) : null;
  const origId = input.reply_to_id || input.forward_id;
  if (!acc && origId) {
    const row = get('SELECT account_id FROM messages WHERE id = ?', origId);
    if (!row) throw new Error(`Email ${origId} not found.`);
    acc = listAccounts().find((a) => a.id === row.account_id);
  }
  if (!acc) acc = mail.defaultSendingAccount();
  if (!acc) throw new Error('No email account is connected.');
  return {
    accountId: acc.id,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    text: input.body,
    replyToId: input.reply_to_id,
    replyAll: input.reply_all,
    forwardId: input.forward_id,
  };
}

export function eventForClaude(e) {
  if (!e) return null;
  return {
    id: e.id,
    title: e.title,
    when: e.when,
    start: e.startLocal,
    end: e.endLocal,
    ...(e.allDay ? { all_day: true } : {}),
    calendar: `${e.account} · ${e.calendar}`,
    ...(e.location ? { location: e.location } : {}),
    ...(e.attendees?.length ? { attendees: e.attendees.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email) + (a.status ? ` (${a.status})` : '')) } : {}),
    ...(e.onlineMeetingUrl ? { meeting_link: e.onlineMeetingUrl } : {}),
    ...(e.recurring ? { repeats: e.repeats || true } : {}),
    ...(e.description ? { notes: e.description.slice(0, 1500) } : {}),
  };
}

// Validation ---------------------------------------------------------------------------------

function typeOk(v, schema) {
  switch (schema.type) {
    case 'string': return typeof v === 'string';
    case 'integer': return Number.isInteger(v) || (typeof v === 'string' && /^-?\d+$/.test(v));
    case 'number': return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
    case 'boolean': return typeof v === 'boolean' || v === 'true' || v === 'false';
    case 'array': return Array.isArray(v) || typeof v === 'string';
    case 'object': return v && typeof v === 'object' && !Array.isArray(v);
    default: return true;
  }
}

function coerce(v, schema) {
  if (v == null) return v;
  if (schema.type === 'integer' && typeof v === 'string') return Number(v);
  if (schema.type === 'number' && typeof v === 'string') return Number(v);
  if (schema.type === 'boolean' && typeof v === 'string') return v === 'true';
  if (schema.type === 'array') {
    const list = Array.isArray(v) ? v : String(v).split(/\s*[,;]\s*/).filter(Boolean);
    return schema.items ? list.map((x) => coerce(x, schema.items)) : list;
  }
  return v;
}

/** Validate (and lightly coerce) tool input against its schema. Throws a readable error. */
export function validateInput(tool, input) {
  const schema = tool.input_schema;
  const data = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const req of schema.required || []) {
    if (data[req] == null || data[req] === '') throw new Error(`Missing required field "${req}".`);
  }
  for (const [k, v] of Object.entries(data)) {
    const ps = schema.properties[k];
    if (!ps) continue; // ignore unknown fields
    if (v == null) continue;
    if (!typeOk(v, ps)) throw new Error(`Field "${k}" should be ${ps.type}.`);
    const c = coerce(v, ps);
    if (ps.enum && !ps.enum.includes(c)) throw new Error(`Field "${k}" must be one of: ${ps.enum.join(', ')}.`);
    if (ps.type === 'array' && ps.items?.type === 'integer' && c.some((x) => !Number.isInteger(x))) throw new Error(`Field "${k}" should be a list of integers.`);
    out[k] = c;
  }
  return out;
}

export function findTool(name) {
  return TOOLS.find((t) => t.name === name);
}

export function needsConfirmation(tool, input) {
  const policy = getSetting('assistantConfirm', 'send_delete');
  if (policy === 'never') return false;
  if (policy === 'all_changes') return !tool.readOnly;
  return !!(tool.sends || tool.destructive || tool.destructiveWhen?.(input));
}

/** Run a tool by name. Returns a JSON-serializable result; throws on error. */
export async function runTool(name, input, ctx) {
  const tool = findTool(name);
  if (!tool) throw new Error(`Unknown tool ${name}`);
  const clean = validateInput(tool, input);
  return tool.run(clean, ctx);
}
