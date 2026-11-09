import { all, get, run, json, tx, logActivity, getSetting } from './db.js';
import { getAccount, listAccounts, providerFor, resolveAccount, secretsOf } from './accounts.js';
import * as store from './store.js';
import { ensureBody, ensureRaw, syncAccount, events } from './sync.js';
import { buildRaw, parseRaw, addrList, formatAddr, escapeHtml, textToHtml, sanitizeHtml, parseAddressList, isValidEmail, htmlToText, makeSnippet } from './mailutil.js';
import { smtpSendRaw } from './providers/smtp.js';
import { recordSent } from './contacts.js';
import { parseInvite, userTz } from './calendar.js';
import { describe, parseDateTime, toZonedIso } from './time.js';

// Listing -----------------------------------------------------------------------------------------

const SUMMARY_SELECT = `
  SELECT m.id, m.account_id, m.folder_id, m.remote_id, m.subject, m.from_name, m.from_addr, m.to_json, m.cc_json, m.date, m.snippet,
         m.seen, m.flagged, m.answered, m.has_attachments, m.has_invite, m.thread_key, m.body_state,
         f.name AS folder_name, f.role AS folder_role, a.label AS acc_label, a.email AS acc_email, a.color AS acc_color, a.type AS acc_type
  FROM messages m JOIN folders f ON f.id = m.folder_id JOIN accounts a ON a.id = m.account_id`;

export function summary(r) {
  return {
    id: r.id,
    accountId: r.account_id,
    account: r.acc_label || r.acc_email,
    accountEmail: r.acc_email,
    accountColor: r.acc_color,
    folderId: r.folder_id,
    folder: r.folder_name,
    folderRole: r.folder_role,
    subject: r.subject || '(no subject)',
    from: { name: r.from_name || '', address: r.from_addr || '' },
    to: json(r.to_json, []),
    cc: json(r.cc_json, []),
    date: r.date,
    snippet: r.snippet || '',
    seen: !!r.seen,
    flagged: !!r.flagged,
    answered: !!r.answered,
    hasAttachments: !!r.has_attachments,
    hasInvite: !!r.has_invite,
    threadKey: r.thread_key,
  };
}

const ftsTerm = (w) => `"${w.replace(/"/g, '')}"*`;
const KNOWN_KEYS = new Set(['from', 'to', 'cc', 'subject', 'has', 'is', 'in', 'account', 'before', 'after', 'since', 'newer_than', 'older_than']);

/** Parse Gmail-style search: from:, to:, subject:, has:attachment, is:unread|read|flagged, in:, account:, before:, after:, newer_than:7d */
export function parseQuery(q) {
  const out = { words: [], from: [], to: [], subject: [], flags: {}, in: null, account: null, before: null, after: null };
  if (!q) return out;
  const tz = userTz();
  const tokens = String(q).match(/(\w+:)?("[^"]*"|\S+)/g) || [];
  for (const tok of tokens) {
    let m = tok.match(/^(\w+):(.*)$/);
    if (m && !KNOWN_KEYS.has(m[1].toLowerCase())) m = null; // e.g. "10:30" or "re:"
    const val = (m ? m[2] : tok).replace(/^"|"$/g, '');
    const key = m?.[1]?.toLowerCase();
    if (!val) continue;
    if (key === 'from') out.from.push(val.toLowerCase());
    else if (key === 'to' || key === 'cc') out.to.push(val.toLowerCase());
    else if (key === 'subject') out.subject.push(val.toLowerCase());
    else if (key === 'has' && /^attach/.test(val)) out.flags.attachment = true;
    else if (key === 'has' && /^(invite|calendar|meeting)/.test(val)) out.flags.invite = true;
    else if (key === 'is' && val === 'unread') out.flags.unread = true;
    else if (key === 'is' && val === 'read') out.flags.read = true;
    else if (key === 'is' && /^(flagged|starred)$/.test(val)) out.flags.flagged = true;
    else if (key === 'in') out.in = val.toLowerCase();
    else if (key === 'account') out.account = val;
    else if (key === 'before') out.before = parseDateTime(val, tz);
    else if (key === 'after' || key === 'since') out.after = parseDateTime(val, tz);
    else if (key === 'newer_than' || key === 'older_than') {
      const n = val.match(/^(\d+)([dwmy])$/);
      if (n) {
        const days = Number(n[1]) * { d: 1, w: 7, m: 30, y: 365 }[n[2]];
        const d = new Date(Date.now() - days * 86400_000);
        if (key === 'newer_than') out.after = d;
        else out.before = d;
      }
    } else out.words.push(...val.replace(/"/g, ' ').split(/\s+/).filter((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length));
  }
  return out;
}

/**
 * List messages. Scope by folderId, or by view: unified (all inboxes), unread, flagged, sent, all.
 * q uses Gmail-style search syntax.
 */
export function listMessages({ folderId, view = 'unified', accountId, q, limit = 50, offset = 0, unreadOnly, flaggedOnly } = {}) {
  const where = [];
  const params = [];
  let join = '';
  const pq = parseQuery(q);
  const searching = !!q && String(q).trim().length > 0;
  if (folderId) {
    where.push('m.folder_id = ?');
    params.push(folderId);
  } else if (!searching || view !== 'all') {
    if (view === 'unified') where.push("f.role = 'inbox'");
    else if (view === 'unread') where.push("m.seen = 0 AND coalesce(f.role,'') NOT IN ('trash','junk','sent','drafts')");
    else if (view === 'flagged') where.push("m.flagged = 1 AND coalesce(f.role,'') NOT IN ('trash')");
    else if (view === 'sent') where.push("f.role = 'sent'");
    else if (view === 'all' && !searching) where.push("coalesce(f.role,'') NOT IN ('trash','junk')");
  }
  if (searching && !folderId && view === 'all' && !pq.in) where.push("coalesce(f.role,'') NOT IN ('trash','junk')");
  const acc = accountId ? getAccount(accountId) : pq.account ? resolveAccount(pq.account) : null;
  if (acc) {
    where.push('m.account_id = ?');
    params.push(acc.id);
  }
  if (pq.in) {
    where.push('(lower(f.role) = ? OR lower(f.name) = ? OR lower(f.path) = ?)');
    params.push(pq.in, pq.in, pq.in);
  }
  for (const v of pq.from) {
    where.push("(lower(m.from_addr) LIKE ? OR lower(coalesce(m.from_name,'')) LIKE ?)");
    params.push(`%${v}%`, `%${v}%`);
  }
  for (const v of pq.to) {
    where.push("(lower(coalesce(m.to_json,'')) LIKE ? OR lower(coalesce(m.cc_json,'')) LIKE ?)");
    params.push(`%${v}%`, `%${v}%`);
  }
  for (const v of pq.subject) {
    where.push("lower(coalesce(m.subject,'')) LIKE ?");
    params.push(`%${v}%`);
  }
  if (pq.flags.attachment) where.push('m.has_attachments = 1');
  if (pq.flags.invite) where.push('m.has_invite = 1');
  if (pq.flags.unread || unreadOnly) where.push('m.seen = 0');
  if (pq.flags.read) where.push('m.seen = 1');
  if (pq.flags.flagged || flaggedOnly) where.push('m.flagged = 1');
  if (pq.before) {
    where.push('m.date < ?');
    params.push(pq.before.toISOString());
  }
  if (pq.after) {
    where.push('m.date >= ?');
    params.push(pq.after.toISOString());
  }
  if (pq.words.length) {
    join = 'JOIN messages_fts ON messages_fts.rowid = m.id';
    where.push('messages_fts MATCH ?');
    params.push(pq.words.map(ftsTerm).join(' '));
  }
  const sql = `${SUMMARY_SELECT} ${join} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.date DESC LIMIT ? OFFSET ?`;
  let rows;
  try {
    rows = all(sql, ...params, limit + 1, offset);
  } catch (e) {
    if (!pq.words.length) throw e;
    // Unusual input the full-text index can't parse: fall back to a plain substring match.
    const i = where.indexOf('messages_fts MATCH ?');
    where.splice(i, 1, ...pq.words.map(() => "(lower(coalesce(m.subject,'')) LIKE ? OR lower(coalesce(m.snippet,'')) LIKE ? OR lower(coalesce(m.body_text,'')) LIKE ?)"));
    const ftsIdx = params.length - 1;
    const like = pq.words.flatMap((w) => Array(3).fill(`%${w.toLowerCase()}%`));
    params.splice(ftsIdx, 1, ...like);
    rows = all(`${SUMMARY_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.date DESC LIMIT ? OFFSET ?`, ...params, limit + 1, offset);
  }
  const more = rows.length > limit;
  rows = rows.slice(0, limit);
  // Gmail labels mean the same message can sit in several folders; show it once in cross-folder views.
  if (!folderId) {
    const seen = new Set();
    rows = rows.filter((r) => {
      const k = `${r.account_id}:${r.acc_type === 'gmail' ? r.remote_id : r.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return { messages: rows.map(summary), more };
}

export function counts() {
  const unified = get("SELECT count(*) AS n FROM messages m JOIN folders f ON f.id = m.folder_id WHERE f.role = 'inbox' AND m.seen = 0").n;
  const flagged = get("SELECT count(DISTINCT m.account_id || ':' || m.remote_id) AS n FROM messages m JOIN folders f ON f.id = m.folder_id WHERE m.flagged = 1 AND coalesce(f.role,'') <> 'trash'").n;
  const drafts = get('SELECT count(*) AS n FROM drafts').n;
  return { unified, flagged, drafts };
}

// Reading -----------------------------------------------------------------------------------------

async function rawFor(row) {
  return ensureRaw(row);
}

export async function getMessage(id, { markRead = false, inlineImages = true } = {}) {
  let row = await ensureBody(id);
  if (markRead && !row.seen) await setFlags([id], { seen: true }, 'you').catch(() => {});
  row = store.messageRow(id);
  const s = summary(get(`${SUMMARY_SELECT} WHERE m.id = ?`, id));
  let html = row.body_html ? sanitizeHtml(row.body_html) : null;
  const attachments = json(row.attachments_json, []);
  if (html && inlineImages && /cid:/i.test(html)) {
    try {
      const parsed = await parseRaw(await rawFor(row));
      const byCid = new Map();
      let budget = 15 * 1024 * 1024;
      for (const a of parsed.parsed.attachments || []) {
        if (a.contentId && a.size < budget) {
          budget -= a.size;
          byCid.set(a.contentId.replace(/^<|>$/g, '').toLowerCase(), `data:${a.contentType};base64,${a.content.toString('base64')}`);
        }
      }
      html = html.replace(/cid:([^"'\s)>]+)/gi, (m, cid) => byCid.get(decodeURIComponent(cid).toLowerCase()) || m);
    } catch {}
  }
  let invite = null;
  if (row.has_invite) {
    try {
      const p = await parseRaw(await rawFor(row));
      if (p.invite) invite = parseInvite(p.invite);
    } catch {}
  }
  const thread = row.thread_key ? get('SELECT count(DISTINCT remote_id) AS n FROM messages WHERE account_id = ? AND thread_key = ?', row.account_id, row.thread_key).n : 1;
  return {
    ...s,
    bcc: json(row.bcc_json, []),
    replyTo: json(row.reply_to_json, []),
    messageId: row.message_id,
    text: row.body_text || '',
    html,
    attachments: attachments.filter((a) => !(a.inline && a.contentId && html?.includes('data:'))),
    invite,
    threadCount: thread,
  };
}

export async function getAttachment(messageId, index) {
  const row = store.messageRow(messageId);
  if (!row) throw new Error('Message not found');
  const parsed = await parseRaw(await rawFor(row));
  const a = parsed.parsed.attachments?.[Number(index)];
  if (!a) throw new Error('Attachment not found');
  return { filename: a.filename || `attachment-${Number(index) + 1}`, contentType: a.contentType || 'application/octet-stream', content: a.content };
}

export async function getRawSource(messageId) {
  const row = store.messageRow(messageId);
  if (!row) throw new Error('Message not found');
  return rawFor(row);
}

export function getThread(id) {
  const row = store.messageRow(id);
  if (!row) throw new Error('Message not found');
  if (!row.thread_key) return [summary(get(`${SUMMARY_SELECT} WHERE m.id = ?`, id))];
  const rows = all(`${SUMMARY_SELECT} WHERE m.account_id = ? AND m.thread_key = ? ORDER BY m.date`, row.account_id, row.thread_key);
  const seen = new Set();
  return rows
    .filter((r) => {
      const k = r.acc_type === 'gmail' ? r.remote_id : r.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map(summary);
}

// Actions -----------------------------------------------------------------------------------------

function groupByFolder(ids) {
  const groups = new Map();
  for (const id of ids) {
    const r = store.messageRow(Number(id));
    if (!r) continue;
    if (!groups.has(r.folder_id)) groups.set(r.folder_id, []);
    groups.get(r.folder_id).push(r);
  }
  return [...groups.entries()].map(([folderId, rows]) => ({ folder: store.folderById(folderId), rows, accountId: rows[0].account_id }));
}

export async function setFlags(ids, flags, actor = 'you') {
  const groups = groupByFolder(ids);
  for (const g of groups) {
    const provider = providerFor(g.accountId);
    if (!provider.localMail) await provider.setFlags(g.folder, g.rows.map((r) => r.remote_id), flags);
    const account = getAccount(g.accountId);
    for (const r of g.rows) store.setMessageFlags(account.type === 'gmail' ? null : g.folder.id, r.remote_id, flags);
    store.updateFolderCounts(g.accountId);
  }
  if (actor !== 'you') logActivity(actor, 'mail.flags', `${ids.length} message(s): ${JSON.stringify(flags)}`);
  events.emit('mail', { flags: true });
  return { updated: ids.length };
}

export async function moveMessages(ids, targetFolderId, actor = 'you') {
  const target = store.folderById(Number(targetFolderId));
  if (!target) throw new Error('Target folder not found');
  let moved = 0;
  for (const g of groupByFolder(ids)) {
    if (g.accountId !== target.account_id) throw new Error('Messages can only be moved to a folder in the same account.');
    if (g.folder.id === target.id) continue;
    const provider = providerFor(g.accountId);
    const map = await provider.move(g.folder, g.rows.map((r) => r.remote_id), target);
    const account = getAccount(g.accountId);
    tx(() => {
      for (const m of map) {
        const r = g.rows.find((x) => x.remote_id === m.from);
        if (!r) continue;
        if (m.to && !store.localMessages(target.id).has(m.to)) {
          run('UPDATE messages SET folder_id = ?, remote_id = ? WHERE id = ?', target.id, m.to, r.id);
          store.moveCache(g.accountId, store.cacheKey(account.type, g.folder.remote_id, m.from), store.cacheKey(account.type, target.remote_id, m.to));
        } else {
          run('DELETE FROM messages WHERE id = ?', r.id);
        }
      }
    });
    moved += g.rows.length;
    store.updateFolderCounts(g.accountId);
    if (map.some((m) => !m.to)) syncAccount(g.accountId, { again: true });
  }
  logActivity(actor, 'mail.move', `${moved} message(s) → ${target.name}`);
  events.emit('mail', { moved: true });
  return { moved, folder: target.name };
}

export async function archiveMessages(ids, actor = 'you') {
  let n = 0;
  for (const g of groupByFolder(ids)) {
    const provider = providerFor(g.accountId);
    if (g.folder.role === 'archive') continue;
    if (provider.archive) {
      await provider.archive(g.folder, g.rows.map((r) => r.remote_id));
      for (const r of g.rows) run('DELETE FROM messages WHERE id = ?', r.id);
      store.updateFolderCounts(g.accountId);
      n += g.rows.length;
      continue;
    }
    let archive = store.folderByRole(g.accountId, 'archive');
    if (!archive && provider.createFolder) {
      const f = await provider.createFolder('Archive');
      store.syncFolderList(g.accountId, await provider.listFolders());
      archive = store.folderByRemote(g.accountId, f.remote_id);
      if (archive && !archive.role) run("UPDATE folders SET role = 'archive' WHERE id = ?", archive.id);
    }
    if (!archive) throw new Error('This account has no Archive folder.');
    await moveMessages(g.rows.map((r) => r.id), archive.id, actor);
    n += g.rows.length;
  }
  if (n) logActivity(actor, 'mail.archive', `${n} message(s)`);
  events.emit('mail', { archived: true });
  return { archived: n };
}

/** Delete: moves to Deleted Items/Trash; deleting from there removes permanently. */
export async function deleteMessages(ids, actor = 'you', { permanent = false } = {}) {
  let trashed = 0;
  let removed = 0;
  for (const g of groupByFolder(ids)) {
    const provider = providerFor(g.accountId);
    const trash = store.folderByRole(g.accountId, 'trash');
    if (!permanent && trash && g.folder.id !== trash.id) {
      await moveMessages(g.rows.map((r) => r.id), trash.id, actor);
      trashed += g.rows.length;
      continue;
    }
    await provider.expunge(g.folder, g.rows.map((r) => r.remote_id), { accountState: () => store.accountState(g.accountId), saveAccountState: (s) => store.saveAccountState(g.accountId, s) });
    const account = getAccount(g.accountId);
    for (const r of g.rows) {
      store.deleteCache(g.accountId, store.cacheKey(account.type, g.folder.remote_id, r.remote_id));
      if (account.type === 'gmail') store.removeEverywhere(g.accountId, r.remote_id);
      else run('DELETE FROM messages WHERE id = ?', r.id);
    }
    store.updateFolderCounts(g.accountId);
    removed += g.rows.length;
  }
  logActivity(actor, 'mail.delete', `${trashed} moved to trash, ${removed} permanently deleted`);
  events.emit('mail', { deleted: true });
  return { trashed, removed };
}

export async function createFolder(accountId, name) {
  const provider = providerFor(accountId);
  if (provider.localMail) {
    run('INSERT INTO folders(account_id, remote_id, name, path, local_only) VALUES(?,?,?,?,1)', accountId, `local:${Date.now()}`, name, name);
  } else {
    if (!provider.createFolder) throw new Error('This account does not support creating folders.');
    await provider.createFolder(name);
    store.syncFolderList(accountId, await provider.listFolders());
  }
  events.emit('mail', { folders: true });
  return store.foldersOf(accountId).find((f) => f.name === name);
}

// Sending -----------------------------------------------------------------------------------------

function recipients(list) {
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [list];
  const out = [];
  for (const x of arr) {
    if (typeof x === 'string') out.push(...parseAddressList(x));
    else if (x && (x.address || x.email)) out.push({ name: x.name || '', address: x.address || x.email });
  }
  for (const r of out) if (!isValidEmail(r.address)) throw new Error(`"${r.address}" is not a valid email address.`);
  return out;
}

function quoteBlock(orig, text) {
  const tz = userTz();
  const when = orig.date ? describe(new Date(orig.date), tz) : '';
  const who = formatAddr({ name: orig.from_name, address: orig.from_addr });
  const body = orig.body_html ? sanitizeHtml(orig.body_html) : textToHtml(orig.body_text || '');
  return {
    html: `<br><div class="sb-quote"><div>On ${escapeHtml(when)}, ${escapeHtml(who)} wrote:</div><blockquote style="margin:0 0 0 .8ex;border-left:2px solid #ccc;padding-left:1ex">${body}</blockquote></div>`,
    text: `\n\nOn ${when}, ${who} wrote:\n${(orig.body_text || '').split('\n').map((l) => `> ${l}`).join('\n')}`,
  };
}

function forwardBlock(orig) {
  const tz = userTz();
  const header = [
    `From: ${formatAddr({ name: orig.from_name, address: orig.from_addr })}`,
    `Sent: ${orig.date ? describe(new Date(orig.date), tz) : ''}`,
    `To: ${json(orig.to_json, []).map(formatAddr).join(', ')}`,
    json(orig.cc_json, []).length ? `Cc: ${json(orig.cc_json, []).map(formatAddr).join(', ')}` : null,
    `Subject: ${orig.subject || ''}`,
  ].filter(Boolean);
  const body = orig.body_html ? sanitizeHtml(orig.body_html) : textToHtml(orig.body_text || '');
  return {
    html: `<br><div class="sb-forward"><div>---------- Forwarded message ----------</div>${header.map((h) => `<div>${escapeHtml(h)}</div>`).join('')}<br>${body}</div>`,
    text: `\n\n---------- Forwarded message ----------\n${header.join('\n')}\n\n${orig.body_text || ''}`,
  };
}

/**
 * Send an email. Accepts html and/or text (text may be light Markdown).
 * replyToId / forwardId thread the message and quote or attach the original.
 */
export async function sendMessage(input, actor = 'you') {
  const account = input.accountId ? getAccount(Number(input.accountId)) : resolveAccount(input.account) || defaultSendingAccount();
  if (!account) throw new Error(input.account ? `No account matches "${input.account}".` : 'Add an email account first.');
  if (account.status === 'auth_error') throw new Error(`${account.email} needs to be reconnected in Settings → Accounts before it can send.`);
  let to = recipients(input.to);
  let cc = recipients(input.cc);
  const bcc = recipients(input.bcc);
  let subject = input.subject ?? '';
  let html = input.html || (input.text != null ? textToHtml(input.text) : '');
  let text = input.text != null ? input.text : htmlToText(html);
  let inReplyTo;
  let references = [];
  let threadId;
  const attachments = (input.attachments || []).map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    content: a.content ?? Buffer.from(a.dataBase64 || '', 'base64'),
  }));

  let orig = null;
  if (input.replyToId) {
    orig = await ensureBody(Number(input.replyToId));
    inReplyTo = orig.message_id || undefined;
    references = [...String(orig.refs || '').split(/\s+/).filter(Boolean), orig.message_id].filter(Boolean);
    if (orig.thread_key?.startsWith('gm:') && account.type === 'gmail' && orig.account_id === account.id) threadId = orig.thread_key.slice(3);
    if (!input.subject) subject = /^re:/i.test(orig.subject || '') ? orig.subject : `Re: ${orig.subject || ''}`;
    if (!to.length) {
      const replyTo = json(orig.reply_to_json, []);
      const fromMe = orig.from_addr?.toLowerCase() === account.email.toLowerCase();
      to = fromMe ? json(orig.to_json, []) : replyTo.length ? replyTo : [{ name: orig.from_name, address: orig.from_addr }];
      if (input.replyAll) {
        const mine = new Set(listAccounts().map((a) => a.email.toLowerCase()));
        const already = new Set(to.map((x) => x.address.toLowerCase()));
        cc = [...cc, ...[...json(orig.to_json, []), ...json(orig.cc_json, [])].filter((x) => !mine.has(x.address.toLowerCase()) && !already.has(x.address.toLowerCase()))];
      }
    }
    if (input.quoteOriginal !== false) {
      const q = quoteBlock(orig);
      html += q.html;
      text += q.text;
    }
  } else if (input.forwardId) {
    orig = await ensureBody(Number(input.forwardId));
    if (!input.subject) subject = /^fwd?:/i.test(orig.subject || '') ? orig.subject : `Fwd: ${orig.subject || ''}`;
    if (input.quoteOriginal !== false) {
      const f = forwardBlock(orig);
      html += f.html;
      text += f.text;
    }
    if (input.includeAttachments !== false) {
      const parsed = await parseRaw(await rawFor(orig));
      for (const a of parsed.parsed.attachments || []) {
        attachments.push({ filename: a.filename, contentType: a.contentType, content: a.content, cid: a.related ? a.contentId?.replace(/^<|>$/g, '') : undefined });
      }
    }
  }
  if (input.appendSignature && account.signature) {
    html = `${html.split('<br><div class="sb-quote">')[0]}<br><div class="sb-signature">${account.signature}</div>${html.includes('<br><div class="sb-quote">') ? '<br><div class="sb-quote">' + html.split('<br><div class="sb-quote">').slice(1).join('') : ''}`;
    text = `${text}\n\n${htmlToText(account.signature)}`;
  }
  if (!to.length && !cc.length && !bcc.length) throw new Error('Add at least one recipient.');

  const from = { name: account.displayName || '', address: account.email };
  const { raw, messageId, envelope } = await buildRaw({
    from, to, cc, bcc, subject, text, html: html || undefined, inReplyTo, references, attachments, icalEvent: input.icalEvent,
  });
  const provider = providerFor(account.id);
  if (account.type === 'gmail' || account.type === 'microsoft') {
    await provider.sendRaw(raw, { threadId });
  } else {
    await smtpSendRaw(account, secretsOf(account.id), raw, envelope);
    const sent = store.folderByRole(account.id, 'sent');
    if (sent && account.type === 'imap' && !account.config.skipSentCopy) {
      await provider.append(sent, raw, ['\\Seen']).catch(() => {});
    } else if (sent && account.type === 'pop3') {
      const rid = `sent:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      store.writeCache(account.id, store.cacheKey('pop3', sent.remote_id, rid), raw);
      store.upsertMessages(account.id, sent.id, [{
        remote_id: rid, message_id: messageId, in_reply_to: inReplyTo, refs: references.join(' '),
        thread_key: references[0] || inReplyTo || messageId, subject, from, to, cc, bcc, date: new Date().toISOString(),
        snippet: makeSnippet(text), seen: true, has_attachments: attachments.length > 0,
        body: { text, html, attachments: attachments.map((a, i) => ({ index: i, filename: a.filename, contentType: a.contentType || 'application/octet-stream', size: a.content?.length || 0 })) },
      }]);
    }
  }
  if (orig && input.replyToId) {
    const of = store.folderById(orig.folder_id);
    try {
      if (account.type === 'imap' && orig.account_id === account.id) await provider.setFlags(of, [orig.remote_id], { answered: true });
    } catch {}
    store.setMessageFlags(of.id, orig.remote_id, { answered: true });
  }
  if (!input.skipContacts) recordSent([...to, ...cc, ...bcc]);
  if (input.draftId) run('DELETE FROM drafts WHERE id = ?', input.draftId);
  logActivity(actor, 'mail.send', `From ${account.email} to ${[...to, ...cc].map((x) => x.address).join(', ')} — ${subject}`);
  setTimeout(() => syncAccount(account.id, { again: true }), 2500).unref?.();
  return { sent: true, from: account.email, to: to.map(formatAddr), cc: cc.map(formatAddr), subject, messageId };
}

export function defaultSendingAccount() {
  const id = Number(getSetting('defaultAccountId', 0));
  const accounts = listAccounts({ includeDisabled: false });
  return accounts.find((a) => a.id === id) || accounts[0] || null;
}

// Drafts (kept on this computer) ------------------------------------------------------------------

export function listDrafts() {
  return all('SELECT * FROM drafts ORDER BY updated_at DESC').map(publicDraft);
}

export function getDraft(id) {
  return publicDraft(get('SELECT * FROM drafts WHERE id = ?', id));
}

function publicDraft(d) {
  if (!d) return null;
  const acc = d.account_id ? getAccount(d.account_id) : null;
  return {
    id: d.id,
    accountId: d.account_id,
    account: acc?.label || null,
    accountEmail: acc?.email || null,
    to: json(d.to_json, []),
    cc: json(d.cc_json, []),
    bcc: json(d.bcc_json, []),
    subject: d.subject || '',
    html: d.body_html || '',
    text: d.body_text || htmlToText(d.body_html || ''),
    replyToId: d.reply_to_message_id,
    forwardId: d.forward_message_id,
    attachments: json(d.attachments_json, []),
    createdBy: d.created_by,
    updatedAt: d.updated_at,
  };
}

export function saveDraft(input, actor = 'you') {
  const account = input.accountId ? getAccount(Number(input.accountId)) : resolveAccount(input.account) || defaultSendingAccount();
  const html = input.html || (input.text != null ? textToHtml(input.text) : '');
  const vals = [
    account?.id || null, JSON.stringify(recipientsLoose(input.to)), JSON.stringify(recipientsLoose(input.cc)), JSON.stringify(recipientsLoose(input.bcc)),
    input.subject || '', html, input.text ?? htmlToText(html), input.replyToId || null, input.forwardId || null, JSON.stringify(input.attachments || []),
  ];
  let id = input.id ? Number(input.id) : null;
  if (id && get('SELECT id FROM drafts WHERE id = ?', id)) {
    run(`UPDATE drafts SET account_id=?, to_json=?, cc_json=?, bcc_json=?, subject=?, body_html=?, body_text=?, reply_to_message_id=?, forward_message_id=?, attachments_json=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, ...vals, id);
  } else {
    id = Number(run('INSERT INTO drafts(account_id, to_json, cc_json, bcc_json, subject, body_html, body_text, reply_to_message_id, forward_message_id, attachments_json, created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)', ...vals, actor).lastInsertRowid);
  }
  if (actor !== 'you') logActivity(actor, 'draft.save', `${input.subject || '(no subject)'}`);
  events.emit('mail', { drafts: true });
  return getDraft(id);
}

function recipientsLoose(list) {
  try {
    return recipients(list);
  } catch {
    return addrList(Array.isArray(list) ? list.join(',') : list || '');
  }
}

export function deleteDraft(id) {
  run('DELETE FROM drafts WHERE id = ?', id);
  events.emit('mail', { drafts: true });
}

export async function sendDraft(id, actor = 'you') {
  const d = getDraft(id);
  if (!d) throw new Error('Draft not found');
  return sendMessage({ accountId: d.accountId, to: d.to, cc: d.cc, bcc: d.bcc, subject: d.subject, html: d.html, text: d.text, replyToId: d.replyToId, forwardId: d.forwardId, quoteOriginal: false, includeAttachments: true, draftId: id, attachments: d.attachments }, actor);
}

// Server-side search (beyond what is synced locally) ----------------------------------------------

export async function searchServer(query, { accountId, limit = 20 } = {}) {
  const accounts = accountId ? [getAccount(accountId)] : listAccounts({ includeDisabled: false });
  const ids = [];
  const errors = [];
  for (const account of accounts) {
    if (account.type === 'pop3') continue;
    try {
      const provider = providerFor(account.id);
      const searchFolder = ensureSearchFolder(account.id);
      if (account.type === 'imap') {
        for (const role of ['inbox', 'sent', 'archive']) {
          const f = store.folderByRole(account.id, role);
          if (!f) continue;
          const metas = await provider.search(f, query, limit);
          store.upsertMessages(account.id, f.id, metas);
          for (const m of metas) ids.push(store.localMessages(f.id).get(m.remote_id)?.id);
        }
      } else {
        const metas = await provider.search(query, limit);
        for (const m of metas) {
          let f = null;
          if (account.type === 'gmail') f = store.foldersOf(account.id).find((x) => !x.local_only && m.labelIds?.includes(x.remote_id));
          else if (m.parentFolderId) f = store.folderByRemote(account.id, m.parentFolderId);
          f = f || searchFolder;
          store.upsertMessages(account.id, f.id, [m]);
          ids.push(store.localMessages(f.id).get(m.remote_id)?.id);
        }
      }
    } catch (e) {
      errors.push(`${account.email}: ${e.message}`);
    }
  }
  const rows = ids.filter(Boolean).map((id) => get(`${SUMMARY_SELECT} WHERE m.id = ?`, id)).filter(Boolean);
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { messages: rows.map(summary), errors };
}

function ensureSearchFolder(accountId) {
  let f = store.folderByRemote(accountId, '__search');
  if (!f) {
    run("INSERT INTO folders(account_id, remote_id, name, path, role, local_only) VALUES(?, '__search', 'Search results', 'Search results', 'search', 1)", accountId);
    f = store.folderByRemote(accountId, '__search');
  }
  return f;
}

export function formatForClaude(s, tz = userTz()) {
  return {
    id: s.id,
    account: s.accountEmail,
    folder: s.folder,
    from: formatAddr(s.from),
    to: s.to.map(formatAddr).join(', '),
    ...(s.cc?.length ? { cc: s.cc.map(formatAddr).join(', ') } : {}),
    subject: s.subject,
    date: toZonedIso(s.date, tz),
    unread: !s.seen,
    ...(s.flagged ? { flagged: true } : {}),
    ...(s.hasAttachments ? { attachments: true } : {}),
    ...(s.hasInvite ? { meeting_invite: true } : {}),
    preview: s.snippet,
  };
}
