import { all, getSetting, logActivity, run } from './db.js';
import { getAccount, getAccountRow, listAccounts, providerFor, setStatus, friendlyError } from './accounts.js';
import * as store from './store.js';
import { parseRaw, mapLimit } from './mailutil.js';
import { recordReceived } from './contacts.js';
import { syncAccountCalendars, refreshSubscriptions } from './calendar.js';

import { events } from './bus.js';

export { events };

const running = new Map(); // accountId -> Promise
const rerun = new Set();
const cycles = new Map();
let timer = null;

export function syncSettings() {
  return {
    windowDays: Number(getSetting('syncWindowDays', 90)) || 90,
    maxInbox: Number(getSetting('syncMaxInbox', 2000)) || 2000,
    maxOther: Number(getSetting('syncMaxOther', 300)) || 300,
    intervalMinutes: Number(getSetting('syncIntervalMinutes', 5)) || 5,
    prefetch: Number(getSetting('prefetchBodies', 200)) || 0,
  };
}

function makeCtx(account, opts) {
  const s = syncSettings();
  const newInbox = [];
  const newIds = [];
  const ctx = {
    account,
    windowDays: s.windowDays,
    refreshFlags: opts.refreshFlags,
    maxPerFolder: (f) => (f.role === 'inbox' || f.role === 'sent' ? s.maxInbox : s.maxOther),
    folders: () => store.foldersOf(account.id).filter((f) => !f.local_only),
    folderByRemote: (rid) => store.folderByRemote(account.id, rid),
    folderState: (f) => store.folderState(f),
    saveFolderState: (f, st) => store.saveFolderState(f, st),
    accountState: () => store.accountState(account.id),
    saveAccountState: (st) => store.saveAccountState(account.id, st),
    localMessages: (f) => store.localMessages(f.id),
    resetFolder: (f) => store.resetFolderMessages(f.id),
    upsertMany: (f, metas) => {
      const inserted = store.upsertMessages(account.id, f.id, metas);
      if (inserted.length && f.role === 'inbox') {
        recordReceived(inserted.map((x) => x.meta));
        // Notify only for mail that arrived since the last sync (not the initial download).
        const since = account.lastSyncAt ? Date.parse(account.lastSyncAt) - 10 * 60_000 : Infinity;
        newInbox.push(...inserted.map((x) => x.meta).filter((m) => !m.seen && Date.parse(m.date) >= since));
        // Rules run on mail that arrives after the account's first sync.
        if (account.lastSyncAt) newIds.push(...inserted.map((x) => x.id));
      }
    },
    remove: (f, rid) => store.removeMessage(f.id, rid),
    removeEverywhere: (rid) => store.removeEverywhere(account.id, rid),
    setFlags: (f, rid, flags) => store.setMessageFlags(f ? f.id : null, rid, flags),
    storeRaw: async (f, rid, raw) => {
      const key = store.cacheKey(account.type, f.remote_id, rid);
      store.writeCache(account.id, key, raw);
      const p = await parseRaw(raw);
      const meta = {
        remote_id: rid, message_id: p.messageId, in_reply_to: p.inReplyTo, refs: p.references.join(' '),
        thread_key: p.references[0] || p.inReplyTo || p.messageId, subject: p.subject, from: p.from, to: p.to, cc: p.cc,
        reply_to: p.replyTo, date: p.date || new Date().toISOString(), snippet: p.snippet, seen: false, flagged: false,
        has_attachments: p.attachments.some((a) => !a.inline && !a.calendar), has_invite: !!p.invite, size: raw.length,
        body: { text: p.text, html: p.html, attachments: p.attachments },
      };
      ctx.upsertMany(f, [meta]);
    },
    newInbox,
    newIds,
  };
  return ctx;
}

/** Sync one account. Concurrent calls share the run in progress (and queue one more if asked). */
export function syncAccount(id, opts = {}) {
  id = Number(id);
  if (running.has(id)) {
    if (opts.again) rerun.add(id);
    return running.get(id);
  }
  const p = doSync(id, opts)
    .catch(() => {})
    .finally(() => {
      running.delete(id);
      if (rerun.delete(id)) syncAccount(id, opts);
    });
  running.set(id, p);
  return p;
}

export function isSyncing(id) {
  return running.has(Number(id));
}

async function doSync(id, { inboxOnly = false, calendars = true, folderId = null } = {}) {
  const row = getAccountRow(id);
  if (!row || !row.enabled) return;
  const account = getAccount(id);
  const cycle = (cycles.get(id) || 0) + 1;
  cycles.set(id, cycle);
  setStatus(id, 'syncing', null);
  events.emit('account', { id, status: 'syncing' });
  const provider = providerFor(id);
  const ctx = makeCtx(account, { refreshFlags: inboxOnly || cycle % 3 === 1 });
  let error = null;
  try {
    if ((!inboxOnly && !folderId) || !store.foldersOf(id).length) store.syncFolderList(id, await provider.listFolders());
    if (provider.syncAccount) {
      await provider.syncAccount(ctx);
    } else {
      for (const folder of store.foldersOf(id)) {
        if (folder.local_only) continue;
        if (folderId && folder.id !== folderId) continue;
        if (inboxOnly && folder.role !== 'inbox') continue;
        // Inbox, Sent and Drafts every run; other folders every other run (and whenever they are opened).
        if (!folderId && !inboxOnly && !['inbox', 'sent', 'drafts'].includes(folder.role) && cycle % 2 === 0) continue;
        try {
          await provider.syncFolder(folder, ctx);
        } catch (e) {
          if (/NONEXISTENT|doesn't exist|not found|ErrorItemNotFound|404/i.test(`${e.message} ${e.status || ''}`)) continue;
          throw e;
        }
      }
    }
    if (ctx.newIds.length) {
      const { applyRules } = await import('./rules.js');
      await applyRules(ctx.newIds).catch(() => {});
    }
    store.updateFolderCounts(id);
    events.emit('mail', { accountId: id });
    if (ctx.newInbox.length) {
      events.emit('newmail', {
        accountId: id,
        count: ctx.newInbox.length,
        latest: ctx.newInbox.slice(-3).map((m) => ({ from: m.from?.name || m.from?.address, subject: m.subject })),
      });
    }
  } catch (e) {
    error = e;
  }
  if (!error && calendars && !inboxOnly && !folderId) {
    try {
      await syncAccountCalendars(id);
      events.emit('calendar', { accountId: id });
    } catch (e) {
      error = Object.assign(e, { calendar: true });
    }
  }
  if (error) {
    const msg = (error.calendar ? 'Calendar: ' : '') + friendlyError(error);
    const status = error.auth || error.authenticationFailed || error.status === 401 ? 'auth_error' : 'error';
    setStatus(id, getAccountRow(id)?.status === 'auth_error' ? 'auth_error' : status, msg);
  } else {
    setStatus(id, 'ok', null);
  }
  run('UPDATE accounts SET last_sync_at = ? WHERE id = ?', new Date().toISOString(), id);
  events.emit('account', { id, status: getAccountRow(id)?.status, error: error ? friendlyError(error) : null });
  if (!error && provider.watch && !provider.watcher && getSetting('imapPush', true)) {
    const inbox = store.folderByRole(id, 'inbox');
    if (inbox) provider.watch(inbox.remote_id, () => syncAccount(id, { inboxOnly: true, again: true })).catch(() => {});
  }
  if (!error) await prefetchBodies(id).catch(() => {});
}

/** Download bodies of recent messages so search and Claude see full text without waiting. */
export async function prefetchBodies(accountId, limit = syncSettings().prefetch) {
  if (!limit) return;
  const rows = all(
    `SELECT m.id FROM messages m JOIN folders f ON f.id = m.folder_id
     WHERE m.account_id = ? AND m.body_state = 0 AND coalesce(m.size, 0) < 3000000 AND f.local_only = 0
     ORDER BY CASE f.role WHEN 'inbox' THEN 0 WHEN 'sent' THEN 1 ELSE 2 END, m.date DESC LIMIT ?`,
    accountId, limit,
  );
  const account = getAccount(accountId);
  const conc = account.type === 'imap' ? 1 : 4;
  await mapLimit(rows, conc, (r) => ensureBody(r.id).catch(() => null));
  events.emit('mail', { accountId, bodies: true });
}

/** The message's original RFC 822 source, from the local cache or (re)downloaded from the server. */
export async function ensureRaw(row) {
  const account = getAccount(row.account_id);
  const folder = store.folderById(row.folder_id);
  const key = store.cacheKey(account.type, folder.remote_id, row.remote_id);
  let raw = store.readCache(row.account_id, key);
  if (!raw) {
    raw = await providerFor(row.account_id).fetchRaw(folder, row.remote_id);
    store.writeCache(row.account_id, key, raw);
  }
  return raw;
}

/** Make sure a message's body is cached locally; returns the updated row. */
export async function ensureBody(messageId) {
  const row = store.messageRow(messageId);
  if (!row) throw new Error('Message not found');
  if (row.body_state === 1) return row;
  const parsed = await parseRaw(await ensureRaw(row));
  store.saveBody(row.id, parsed, { snippet: row.snippet });
  return store.messageRow(messageId);
}

export function syncAll(opts = {}) {
  const accounts = listAccounts({ includeDisabled: false });
  refreshSubscriptions().catch(() => {});
  return mapLimit(accounts, 4, (a) => syncAccount(a.id, opts));
}

let minuteTimer = null;

/** Every 20 seconds: send scheduled mail that is due, and announce event reminders. */
async function minuteTick() {
  try {
    const { processOutbox } = await import('./mail.js');
    await processOutbox();
  } catch {}
  try {
    const { dueReminders } = await import('./calendar.js');
    for (const r of dueReminders()) events.emit('reminder', r);
  } catch {}
}

export function startScheduler() {
  stopScheduler();
  minuteTimer = setInterval(minuteTick, 20_000);
  minuteTimer.unref?.();
  setTimeout(minuteTick, 3000).unref?.();
  const tick = () => {
    syncAll().catch(() => {});
    timer = setTimeout(tick, syncSettings().intervalMinutes * 60_000);
    timer.unref?.();
  };
  timer = setTimeout(tick, 1500);
  timer.unref?.();
}

export function stopScheduler() {
  clearInterval(minuteTimer);
  clearTimeout(timer);
  timer = null;
}

export function logSync(detail) {
  logActivity('sync', 'sync', detail);
}
