import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CACHE_DIR } from './config.js';
import { all, get, run, tx, json } from './db.js';
import { ROLE_ORDER } from './mailutil.js';

// Folders --------------------------------------------------------------------------------------

export function foldersOf(accountId) {
  return all('SELECT * FROM folders WHERE account_id = ?', accountId).sort(folderSort);
}

export function folderSort(a, b) {
  const ra = a.role ? ROLE_ORDER.indexOf(a.role) : 99;
  const rb = b.role ? ROLE_ORDER.indexOf(b.role) : 99;
  if (ra !== rb) return (ra < 0 ? 98 : ra) - (rb < 0 ? 98 : rb);
  return String(a.path || a.name).localeCompare(String(b.path || b.name));
}

export function folderById(id) {
  return get('SELECT * FROM folders WHERE id = ?', id);
}

export function folderByRemote(accountId, remoteId) {
  return get('SELECT * FROM folders WHERE account_id = ? AND remote_id = ?', accountId, remoteId);
}

export function folderByRole(accountId, role) {
  return get('SELECT * FROM folders WHERE account_id = ? AND role = ? ORDER BY id LIMIT 1', accountId, role);
}

/** Bring the folder table in line with what the server reports. */
export function syncFolderList(accountId, remoteFolders) {
  tx(() => {
    const existing = new Map(foldersOf(accountId).map((f) => [f.remote_id, f]));
    const seen = new Set();
    // Only one folder per role.
    const roleTaken = new Set();
    for (const f of remoteFolders) {
      let role = f.role || null;
      if (role && roleTaken.has(role)) role = null;
      if (role) roleTaken.add(role);
      seen.add(f.remote_id);
      const cur = existing.get(f.remote_id);
      if (cur) {
        run('UPDATE folders SET name = ?, path = ?, role = ?, parent_remote_id = ?, local_only = ? WHERE id = ?', f.name, f.path || f.name, role, f.parent_remote_id || null, f.local_only ? 1 : 0, cur.id);
      } else {
        run('INSERT INTO folders(account_id, remote_id, name, path, role, parent_remote_id, local_only) VALUES(?,?,?,?,?,?,?)', accountId, f.remote_id, f.name, f.path || f.name, role, f.parent_remote_id || null, f.local_only ? 1 : 0);
      }
    }
    for (const [rid, f] of existing) if (!seen.has(rid) && !f.local_only) run('DELETE FROM folders WHERE id = ?', f.id);
  });
}

export function updateFolderCounts(accountId) {
  run(
    `UPDATE folders SET
       unread_count = (SELECT count(*) FROM messages m WHERE m.folder_id = folders.id AND m.seen = 0),
       total_count  = (SELECT count(*) FROM messages m WHERE m.folder_id = folders.id)
     WHERE account_id = ?`,
    accountId,
  );
}

// Messages -------------------------------------------------------------------------------------

export function localMessages(folderId) {
  const map = new Map();
  for (const r of all('SELECT id, remote_id, seen, flagged, answered, body_state FROM messages WHERE folder_id = ?', folderId)) {
    map.set(r.remote_id, { id: r.id, seen: !!r.seen, flagged: !!r.flagged, answered: !!r.answered, body_state: r.body_state });
  }
  return map;
}

const J = (v) => (v == null ? null : JSON.stringify(v));

/** Insert new messages / refresh metadata of known ones (keeps any cached body). Returns [{id, meta}] for new rows. */
export function upsertMessages(accountId, folderId, metas) {
  const inserted = [];
  if (!metas.length) return inserted;
  tx(() => {
    for (const m of metas) {
      const cur = get('SELECT id FROM messages WHERE folder_id = ? AND remote_id = ?', folderId, m.remote_id);
      if (cur) {
        run(
          `UPDATE messages SET seen = ?, flagged = ?, answered = coalesce(?, answered), subject = coalesce(?, subject),
             snippet = CASE WHEN body_state = 1 THEN snippet ELSE coalesce(?, snippet) END, thread_key = coalesce(?, thread_key)
           WHERE id = ?`,
          m.seen ? 1 : 0, m.flagged ? 1 : 0, m.answered == null ? null : m.answered ? 1 : 0, m.subject ?? null, m.snippet ?? null, m.thread_key ?? null, cur.id,
        );
      } else {
        const r = run(
          `INSERT INTO messages(account_id, folder_id, remote_id, message_id, in_reply_to, refs, thread_key, subject, from_name, from_addr,
             to_json, cc_json, bcc_json, reply_to_json, date, snippet, seen, flagged, answered, has_attachments, size, has_invite,
             body_state, body_text, body_html, attachments_json)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          accountId, folderId, m.remote_id, m.message_id || null, m.in_reply_to || null, m.refs || null, m.thread_key || null,
          m.subject || '', m.from?.name || '', m.from?.address || '', J(m.to || []), J(m.cc || []), J(m.bcc || []), J(m.reply_to || []),
          m.date || new Date().toISOString(), m.snippet || '', m.seen ? 1 : 0, m.flagged ? 1 : 0, m.answered ? 1 : 0,
          m.has_attachments ? 1 : 0, m.size || null, m.has_invite ? 1 : 0,
          m.body ? 1 : 0, m.body?.text ?? null, m.body?.html ?? null, m.body ? J(m.body.attachments) : null,
        );
        inserted.push({ id: Number(r.lastInsertRowid), meta: m });
      }
    }
  });
  return inserted;
}

export function removeMessage(folderId, remoteId) {
  run('DELETE FROM messages WHERE folder_id = ? AND remote_id = ?', folderId, remoteId);
}

export function removeEverywhere(accountId, remoteId) {
  run('DELETE FROM messages WHERE account_id = ? AND remote_id = ?', accountId, remoteId);
}

export function setMessageFlags(folderId, remoteId, flags) {
  const sets = [];
  const vals = [];
  for (const k of ['seen', 'flagged', 'answered']) {
    if (flags[k] != null) {
      sets.push(`${k} = ?`);
      vals.push(flags[k] ? 1 : 0);
    }
  }
  if (!sets.length) return;
  if (folderId == null) run(`UPDATE messages SET ${sets.join(', ')} WHERE remote_id = ?`, ...vals, remoteId);
  else run(`UPDATE messages SET ${sets.join(', ')} WHERE folder_id = ? AND remote_id = ?`, ...vals, folderId, remoteId);
}

export function resetFolderMessages(folderId) {
  run('DELETE FROM messages WHERE folder_id = ?', folderId);
}

export function messageRow(id) {
  return get('SELECT * FROM messages WHERE id = ?', id);
}

export function saveBody(id, parsed, extra = {}) {
  run(
    `UPDATE messages SET body_state = 1, body_text = ?, body_html = ?, attachments_json = ?, snippet = ?,
       has_attachments = ?, has_invite = ?, in_reply_to = coalesce(in_reply_to, ?), refs = CASE WHEN coalesce(refs,'') = '' THEN ? ELSE refs END,
       message_id = coalesce(message_id, ?)
     WHERE id = ?`,
    parsed.text || '',
    parsed.html || null,
    JSON.stringify(parsed.attachments || []),
    parsed.snippet || extra.snippet || '',
    (parsed.attachments || []).some((a) => !a.inline && !a.calendar) ? 1 : 0,
    parsed.invite ? 1 : 0,
    parsed.inReplyTo || null,
    (parsed.references || []).join(' '),
    parsed.messageId || null,
    id,
  );
}

// Raw message cache ------------------------------------------------------------------------------

export function cacheKey(accountType, folderRemoteId, remoteId) {
  const basis = accountType === 'imap' ? `${folderRemoteId}\u0000${remoteId}` : String(remoteId);
  return crypto.createHash('sha1').update(basis).digest('hex');
}

export function cachePath(accountId, key) {
  return path.join(CACHE_DIR, String(accountId), `${key}.eml`);
}

export function readCache(accountId, key) {
  try {
    return fs.readFileSync(cachePath(accountId, key));
  } catch {
    return null;
  }
}

export function writeCache(accountId, key, raw) {
  const p = cachePath(accountId, key);
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  fs.writeFileSync(p, raw, { mode: 0o600 });
}

export function moveCache(accountId, fromKey, toKey) {
  if (fromKey === toKey) return;
  try { fs.renameSync(cachePath(accountId, fromKey), cachePath(accountId, toKey)); } catch {}
}

export function deleteCache(accountId, key) {
  try { fs.unlinkSync(cachePath(accountId, key)); } catch {}
}

export function removeAccountCache(accountId) {
  try { fs.rmSync(path.join(CACHE_DIR, String(accountId)), { recursive: true, force: true }); } catch {}
}

export function folderState(folder) {
  return json(get('SELECT sync_state FROM folders WHERE id = ?', folder.id)?.sync_state, {}) || {};
}

export function saveFolderState(folder, state) {
  run('UPDATE folders SET sync_state = ? WHERE id = ?', JSON.stringify(state || {}), folder.id);
}

export function accountState(accountId) {
  return json(get('SELECT sync_state FROM accounts WHERE id = ?', accountId)?.sync_state, {}) || {};
}

export function saveAccountState(accountId, state) {
  run('UPDATE accounts SET sync_state = ? WHERE id = ?', JSON.stringify(state || {}), accountId);
}
