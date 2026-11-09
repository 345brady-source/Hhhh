// Texts (iMessage and SMS) through the Messages app on a Mac.
// Apple has no iMessage API. On a Mac signed in to Messages, the history lives in ~/Library/Messages/chat.db,
// which Switchboard reads (read-only), and messages are sent by asking the Messages app to send them.
// SMS to non-Apple phones works when the iPhone has Text Message Forwarding turned on for this Mac.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR } from './config.js';
import { logActivity, getSetting, all as appAll, run as appRun } from './db.js';
import { nameFor } from './addressbook.js';
import { phoneKey } from './vcard.js';
import { events } from './bus.js';

const oops = (message, status = 400) => Object.assign(new Error(message), { status, friendly: true });
const APPLE_EPOCH_MS = 978307200000; // 2001-01-01T00:00:00Z
const REACTIONS = { 2000: 'loved', 2001: 'liked', 2002: 'disliked', 2003: 'laughed at', 2004: 'emphasized', 2005: 'questioned' };

const dbPath = () => process.env.SWITCHBOARD_MESSAGES_DB || path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
const osascript = () => process.env.SWITCHBOARD_OSASCRIPT || '/usr/bin/osascript';
const supported = () => process.platform === 'darwin' || !!process.env.SWITCHBOARD_MESSAGES_DB;

let db = null;
function open() {
  if (!db) db = new DatabaseSync(dbPath(), { readOnly: true });
  return db;
}

export function closeMessages() {
  stopWatching();
  try { db?.close(); } catch {}
  db = null;
}

/** Can texts work here, and if not, why. */
export function textsStatus() {
  if (!getSetting('textsEnabled', true)) {
    return { available: false, reason: 'off', message: 'Texts are turned off in Settings → Texts.' };
  }
  if (!supported()) {
    return { available: false, reason: 'not_mac', message: 'Texts work when Switchboard runs on a Mac that is signed in to Messages. Apple offers no other way to reach iMessage.' };
  }
  if (!fs.existsSync(path.dirname(dbPath()))) {
    return { available: false, reason: 'no_messages', message: 'Messages isn’t set up on this Mac yet. Open Messages and sign in with your Apple ID.' };
  }
  try {
    open().prepare('SELECT count(*) AS n FROM message').get();
    return { available: true, reason: null, message: null };
  } catch (e) {
    db = null;
    const denied = /EPERM|EACCES|authorization denied|not permitted|unable to open/i.test(`${e.code} ${e.message}`);
    return denied
      ? { available: false, reason: 'permission', message: 'macOS is blocking access to your Messages history. Give Full Disk Access to the app that runs Switchboard (System Settings → Privacy & Security → Full Disk Access → add Terminal, or Claude if Claude starts Switchboard), then restart Switchboard.' }
      : { available: false, reason: 'no_messages', message: `Messages history could not be read (${e.message}).` };
  }
}

/** Newer macOS keeps the text of many messages only in `attributedBody` (an archived NSAttributedString). */
export function decodeAttributedBody(blob) {
  if (!blob) return null;
  const b = Buffer.from(blob);
  let i = b.indexOf('NSString');
  if (i < 0) return null;
  i += 'NSString'.length + 5;
  if (i >= b.length) return null;
  let len = b[i];
  let start = i + 1;
  if (len === 0x81) {
    len = b.readUInt16LE(i + 1);
    start = i + 3;
  } else if (len === 0x82) {
    len = b.readUInt32LE(i + 1);
    start = i + 5;
  }
  if (start + len > b.length) return null;
  return b.subarray(start, start + len).toString('utf8');
}

// message.date is nanoseconds since 2001 on current macOS (seconds on very old versions). Nanosecond values
// don't fit in a JavaScript number, so convert to milliseconds inside SQLite.
const MS = (col) => `(CASE WHEN ${col} > 100000000000 THEN ${col} / 1000000 ELSE ${col} * 1000 END)`;
const toDate = (appleMs) => (appleMs ? new Date(Number(appleMs) + APPLE_EPOCH_MS).toISOString() : null);
const sinceMs = (ms) => ms - APPLE_EPOCH_MS;
const clean = (t) => (t || '').replace(/\uFFFC/g, '').replace(/\u200B/g, '').trim();
const textOf = (r) => clean(r.text) || clean(decodeAttributedBody(r.attributedBody)) || '';

export function prettyHandle(h) {
  if (!h) return '';
  if (h.includes('@')) return h;
  const d = h.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return h;
}
const who = (h) => nameFor(h) || prettyHandle(h);

const person = (h) => ({ handle: h, name: nameFor(h) || null, display: who(h), pretty: prettyHandle(h) });

// Messages' own read state lives in chat.db, which Switchboard only reads. Conversations opened in
// Switchboard are remembered here so their unread count clears.
function seenMap() {
  return new Map(appAll('SELECT chat_id, last_rowid FROM text_seen').map((r) => [r.chat_id, r.last_rowid]));
}

export function markSeen(chatId) {
  const max = open().prepare('SELECT max(message_id) AS m FROM chat_message_join WHERE chat_id = ?').get(Number(chatId))?.m || 0;
  appRun('INSERT INTO text_seen(chat_id, last_rowid) VALUES(?, ?) ON CONFLICT(chat_id) DO UPDATE SET last_rowid = max(last_rowid, excluded.last_rowid)', Number(chatId), max);
}

function participants(chatId) {
  return open().prepare('SELECT h.id FROM chat_handle_join j JOIN handle h ON h.ROWID = j.handle_id WHERE j.chat_id = ? ORDER BY h.id').all(chatId).map((r) => r.id);
}

function chatName(c, people) {
  if (c.display_name) return c.display_name;
  if (people.length) return people.map(who).join(', ');
  return prettyHandle(c.chat_identifier) || 'Conversation';
}

/** Recent conversations, newest first. */
export function listConversations({ limit = 50, unreadOnly = false } = {}) {
  const since = sinceMs(Date.now() - 45 * 86400_000);
  const rows = open().prepare(
    `SELECT c.ROWID AS id, c.guid, c.chat_identifier, c.display_name, c.service_name, c.style,
            m.ROWID AS last_id, m.text, m.attributedBody, m.is_from_me, ${MS('m.date')} AS date, m.cache_has_attachments, m.associated_message_type
     FROM chat c
     JOIN (SELECT chat_id, max(message_id) AS last_msg FROM chat_message_join GROUP BY chat_id) lj ON lj.chat_id = c.ROWID
     JOIN message m ON m.ROWID = lj.last_msg
     ORDER BY m.date DESC LIMIT ?`,
  ).all(unreadOnly ? 500 : limit);
  const unreadStmt = open().prepare(
    `SELECT count(*) AS n FROM chat_message_join j JOIN message m ON m.ROWID = j.message_id
     WHERE j.chat_id = ? AND m.is_read = 0 AND m.is_from_me = 0 AND m.item_type = 0 AND coalesce(m.associated_message_type, 0) = 0 AND ${MS('m.date')} > ? AND m.ROWID > ?`,
  );
  const seen = seenMap();
  const out = [];
  for (const c of rows) {
    const people = participants(c.id);
    const unread = unreadStmt.get(c.id, since, seen.get(c.id) || 0).n;
    if (unreadOnly && !unread) continue;
    const last = textOf(c) || (c.cache_has_attachments ? 'Attachment' : '');
    out.push({
      id: c.id,
      name: chatName(c, people),
      group: c.style === 43 || people.length > 1,
      participants: people.map(person),
      service: c.service_name || 'iMessage',
      lastMessage: (c.is_from_me ? 'You: ' : '') + last,
      lastAt: toDate(c.date),
      unread,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function attachmentsFor(messageId) {
  return open().prepare(
    `SELECT a.ROWID AS id, a.filename, a.mime_type, a.transfer_name, a.total_bytes
     FROM message_attachment_join j JOIN attachment a ON a.ROWID = j.attachment_id WHERE j.message_id = ?`,
  ).all(messageId).map((a) => ({ id: a.id, name: a.transfer_name || path.basename(a.filename || 'attachment'), type: a.mime_type || 'application/octet-stream', size: a.total_bytes || 0 }));
}

/** Messages in one conversation, oldest first. */
export function getConversation(chatId, { limit = 60, before = null } = {}) {
  const c = open().prepare('SELECT ROWID AS id, guid, chat_identifier, display_name, service_name, style FROM chat WHERE ROWID = ?').get(Number(chatId));
  if (!c) throw oops('Conversation not found', 404);
  const people = participants(c.id);
  const rows = open().prepare(
    `SELECT m.ROWID AS id, m.guid, m.text, m.attributedBody, m.is_from_me, ${MS('m.date')} AS date, m.is_read, m.service, m.cache_has_attachments,
            m.associated_message_type, m.associated_message_guid, m.item_type, h.id AS handle
     FROM chat_message_join j JOIN message m ON m.ROWID = j.message_id LEFT JOIN handle h ON h.ROWID = m.handle_id
     WHERE j.chat_id = ? AND (? IS NULL OR m.ROWID < ?)
     ORDER BY m.date DESC, m.ROWID DESC LIMIT ?`,
  ).all(c.id, before, before, limit);
  const byGuid = new Map();
  const messages = [];
  for (const r of rows.reverse()) {
    if (r.item_type && r.item_type !== 0) continue; // group renames, members joining, etc.
    const at = toDate(r.date);
    const from = r.is_from_me ? 'me' : who(r.handle || c.chat_identifier);
    const assoc = Number(r.associated_message_type || 0);
    if (assoc >= 2000 && assoc < 3000) {
      const target = byGuid.get(String(r.associated_message_guid || '').replace(/^(p:\d+\/|bp:)/, ''));
      messages.push({ id: r.id, kind: 'reaction', fromMe: !!r.is_from_me, from, at, text: `${r.is_from_me ? 'You' : from} ${REACTIONS[assoc] || 'reacted to'} ${target ? `“${target.text.slice(0, 60)}”` : 'a message'}` });
      continue;
    }
    if (assoc >= 3000) continue;
    const m = { id: r.id, kind: 'message', fromMe: !!r.is_from_me, from, handle: r.handle || null, at, text: textOf(r), service: r.service || c.service_name || 'iMessage', read: !!r.is_read, attachments: r.cache_has_attachments ? attachmentsFor(r.id) : [] };
    byGuid.set(r.guid, m);
    messages.push(m);
  }
  return {
    id: c.id,
    name: chatName(c, people),
    group: c.style === 43 || people.length > 1,
    service: c.service_name || 'iMessage',
    participants: people.map(person),
    messages,
    more: rows.length === limit,
  };
}

/** Search recent texts (the newest 25,000 messages). */
export function searchTexts(query, { limit = 30 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const rows = open().prepare(
    `SELECT m.ROWID AS id, m.text, m.attributedBody, m.is_from_me, ${MS('m.date')} AS date, h.id AS handle, j.chat_id
     FROM message m JOIN chat_message_join j ON j.message_id = m.ROWID LEFT JOIN handle h ON h.ROWID = m.handle_id
     WHERE m.item_type = 0 AND coalesce(m.associated_message_type, 0) = 0
     ORDER BY m.ROWID DESC LIMIT 25000`,
  ).all();
  const names = new Map();
  const out = [];
  for (const r of rows) {
    const text = textOf(r);
    const from = r.is_from_me ? 'me' : who(r.handle);
    if (!text.toLowerCase().includes(q) && !String(from).toLowerCase().includes(q)) continue;
    if (!names.has(r.chat_id)) {
      const c = open().prepare('SELECT ROWID AS id, chat_identifier, display_name FROM chat WHERE ROWID = ?').get(r.chat_id);
      names.set(r.chat_id, c ? chatName(c, participants(c.id)) : '');
    }
    out.push({ id: r.id, conversationId: r.chat_id, conversation: names.get(r.chat_id), from, text, at: toDate(r.date) });
    if (out.length >= limit) break;
  }
  return out;
}

export function attachmentFile(id) {
  const a = open().prepare('SELECT filename, mime_type, transfer_name FROM attachment WHERE ROWID = ?').get(Number(id));
  if (!a?.filename) throw oops('Attachment not found', 404);
  const file = a.filename.replace(/^~(?=\/)/, os.homedir());
  if (!fs.existsSync(file)) throw oops('The attachment is no longer on this Mac.', 404);
  return { file, type: a.mime_type || 'application/octet-stream', name: a.transfer_name || path.basename(file) };
}

/** Find the conversation for a phone number or email, if one exists. */
export function conversationWith(handle) {
  const key = handle.includes('@') ? handle.toLowerCase() : phoneKey(handle);
  const chats = open().prepare("SELECT c.ROWID AS id, c.chat_identifier, c.style FROM chat c WHERE c.style <> 43").all();
  const match = chats.find((c) => {
    const ids = [c.chat_identifier, ...participants(c.id)];
    return ids.some((h) => h && (h.includes('@') ? h.toLowerCase() === key : phoneKey(h) === key));
  });
  return match ? match.id : null;
}

// Sending ------------------------------------------------------------------------------------------

const SEND_SCRIPT = `on run argv
	set theText to item 1 of argv
	set theTarget to item 2 of argv
	set mode to item 3 of argv
	tell application "Messages"
		if mode is "chat" then
			send theText to chat id theTarget
			return "sent"
		end if
		try
			send theText to participant theTarget of (1st account whose service type = iMessage)
		on error
			try
				send theText to participant theTarget of (1st account whose service type = SMS)
			on error
				send theText to buddy theTarget of (1st service whose service type = iMessage)
			end try
		end try
	end tell
	return "sent"
end run
`;

function scriptFile() {
  const f = path.join(DATA_DIR, 'send-text.applescript');
  try {
    if (fs.readFileSync(f, 'utf8') === SEND_SCRIPT) return f;
  } catch {}
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(f, SEND_SCRIPT, { mode: 0o600 });
  return f;
}

function runOsascript(args) {
  return new Promise((resolve, reject) => {
    execFile(osascript(), args, { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = `${stderr || err.message}`;
        if (/-1743|not authori[sz]ed|Not allowed to send Apple events/i.test(msg)) return reject(oops('macOS needs your permission for Switchboard to use Messages. Approve the prompt, or allow it in System Settings → Privacy & Security → Automation (Messages).', 403));
        if (/Can.t get participant|Can.t get buddy|-1728/i.test(msg)) return reject(oops('Messages couldn’t reach that number or address. Check it, and for SMS make sure Text Message Forwarding is on in your iPhone’s Messages settings.'));
        return reject(oops(`Messages didn’t send it: ${msg.trim().slice(0, 200)}`, 502));
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Send a text. Give conversationId to reply in an existing conversation (works for groups), or `to`
 * (a phone number or email) to text someone.
 */
export async function sendText({ conversationId, to, text }, actor = 'you') {
  const body = String(text || '').trim();
  if (!body) throw oops('Write a message to send.');
  if (body.length > 10000) throw oops('That message is too long to text.');
  let target;
  let mode;
  let label;
  if (conversationId) {
    const c = open().prepare('SELECT guid, chat_identifier, display_name FROM chat WHERE ROWID = ?').get(Number(conversationId));
    if (!c) throw oops('Conversation not found.', 404);
    target = c.guid;
    mode = 'chat';
    label = chatName(c, participants(Number(conversationId)));
  } else {
    const h = String(to || '').trim();
    if (!h) throw oops('Say who to text: a phone number or an email address.');
    if (!h.includes('@') && phoneKey(h).length < 7) throw oops(`"${h}" doesn’t look like a phone number.`);
    const existing = conversationWith(h);
    if (existing) return sendText({ conversationId: existing, text: body }, actor);
    target = h.includes('@') ? h : h.replace(/[^\d+]/g, '');
    mode = 'handle';
    label = who(target);
  }
  await runOsascript([scriptFile(), body, target, mode]);
  logActivity(actor, 'text.send', `To ${label}: ${body.slice(0, 80)}`);
  setTimeout(checkForNew, 1500).unref?.();
  return { sent: true, to: label, text: body };
}

// Watching for new texts ---------------------------------------------------------------------------

let watchTimer = null;
let lastRowId = 0;

function checkForNew() {
  if (!db) return;
  try {
    const max = open().prepare('SELECT max(ROWID) AS m FROM message').get().m || 0;
    if (!lastRowId) {
      lastRowId = max;
      return;
    }
    if (max <= lastRowId) return;
    const fresh = open().prepare(
      `SELECT m.ROWID AS id, m.text, m.attributedBody, m.is_from_me, h.id AS handle, j.chat_id
       FROM message m LEFT JOIN handle h ON h.ROWID = m.handle_id LEFT JOIN chat_message_join j ON j.message_id = m.ROWID
       WHERE m.ROWID > ? AND m.item_type = 0 AND coalesce(m.associated_message_type, 0) = 0 ORDER BY m.ROWID`,
    ).all(lastRowId);
    lastRowId = max;
    events.emit('texts', { count: fresh.length });
    for (const r of fresh) {
      if (r.is_from_me) continue;
      events.emit('newtext', { conversationId: r.chat_id, from: who(r.handle), text: textOf(r).slice(0, 140) });
    }
  } catch {}
}

export function startWatching() {
  if (watchTimer || !textsStatus().available) return;
  checkForNew();
  watchTimer = setInterval(checkForNew, 4000);
  watchTimer.unref?.();
}

export function stopWatching() {
  clearInterval(watchTimer);
  watchTimer = null;
  lastRowId = 0;
}

export function unreadTextCount() {
  try {
    return listConversations({ limit: 200 }).reduce((n, c) => n + c.unread, 0);
  } catch {
    return 0;
  }
}
