import { ImapFlow } from 'imapflow';
import { addrList, cleanMessageId, guessRole, parseReferences, threadKeyFor } from '../mailutil.js';

const IDLE_CLOSE_MS = 90_000;

export function imapOptions(cfg, user, pass) {
  const security = cfg.imapSecurity || (Number(cfg.imapPort) === 143 ? 'starttls' : 'ssl');
  return {
    host: cfg.imapHost,
    port: Number(cfg.imapPort) || (security === 'ssl' ? 993 : 143),
    secure: security === 'ssl',
    doSTARTTLS: security === 'starttls' ? true : security === 'none' ? false : undefined,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized: !cfg.allowSelfSigned },
    connectionTimeout: 30_000,
    greetingTimeout: 20_000,
    socketTimeout: 5 * 60_000,
  };
}

function walkStructure(node, out = { attachments: false, invite: false }) {
  if (!node) return out;
  const type = String(node.type || '').toLowerCase();
  const disp = String(node.disposition || '').toLowerCase();
  const filename = node.dispositionParameters?.filename || node.parameters?.name;
  if (type === 'text/calendar' || type === 'application/ics') out.invite = true;
  if (disp === 'attachment' || (filename && !type.startsWith('multipart/') && disp !== 'inline')) out.attachments = true;
  if (Array.isArray(node.childNodes)) node.childNodes.forEach((c) => walkStructure(c, out));
  return out;
}

function headerValue(headersBuf, name) {
  if (!headersBuf) return null;
  const text = headersBuf.toString('utf8').replace(/\r?\n[ \t]+/g, ' ');
  const m = text.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'));
  return m ? m[1].trim() : null;
}

export class ImapProvider {
  static type = 'imap';

  constructor(account, secrets) {
    this.account = account;
    this.cfg = account.config || {};
    this.secrets = secrets || {};
    this.conn = null;
    this.closeTimer = null;
    this.queue = Promise.resolve();
  }

  get user() {
    return this.cfg.imapUser || this.account.email;
  }

  remoteId(uidValidity, uid) {
    return `${uidValidity}:${uid}`;
  }

  uidOf(remoteId) {
    return Number(String(remoteId).split(':')[1]);
  }

  async open() {
    const client = new ImapFlow(imapOptions(this.cfg, this.user, this.secrets.password));
    client.on('error', () => {}); // errors surface through the awaiting call
    await client.connect();
    return client;
  }

  /** Run fn with a shared connection, one operation at a time, reconnecting once if it dropped. */
  withClient(fn) {
    const job = this.queue.then(async () => {
      clearTimeout(this.closeTimer);
      for (let attempt = 0; ; attempt++) {
        try {
          if (!this.conn || !this.conn.usable) {
            try { this.conn?.close(); } catch {}
            this.conn = await this.open();
          }
          return await fn(this.conn);
        } catch (err) {
          const dropped = !this.conn?.usable || /ECONNRESET|EPIPE|ETIMEDOUT|NoConnection|Connection not available|closed/i.test(`${err.code} ${err.message}`);
          if (dropped) {
            try { this.conn?.close(); } catch {}
            this.conn = null;
          }
          if (attempt === 0 && dropped && !err.authenticationFailed) continue;
          throw err;
        }
      }
    });
    this.queue = job.catch(() => {}).then(() => {
      clearTimeout(this.closeTimer);
      this.closeTimer = setTimeout(() => this.close(), IDLE_CLOSE_MS);
      this.closeTimer.unref?.();
    });
    return job;
  }

  async close() {
    clearTimeout(this.closeTimer);
    const c = this.conn;
    this.conn = null;
    if (c) {
      try { await c.logout(); } catch { try { c.close(); } catch {} }
    }
    await this.stopWatching();
  }

  async test() {
    const c = await this.open();
    try {
      const list = await c.list();
      return { folders: list.length };
    } finally {
      try { await c.logout(); } catch {}
    }
  }

  async listFolders() {
    return this.withClient(async (c) => {
      const list = await c.list();
      return list
        .filter((f) => !f.flags?.has('\\Noselect') && !f.flags?.has('\\NonExistent'))
        .map((f) => {
          const delim = f.delimiter || '/';
          const idx = f.path.lastIndexOf(delim);
          return {
            remote_id: f.path,
            path: f.path,
            name: f.path.toUpperCase() === 'INBOX' ? 'Inbox' : f.name,
            role: f.path.toUpperCase() === 'INBOX' ? 'inbox' : guessRole(f.path, f.specialUse),
            parent_remote_id: idx > 0 ? f.path.slice(0, idx) : null,
          };
        })
        .filter((f) => f.role !== 'all'); // "[Gmail]/All Mail" style folders duplicate everything
    });
  }

  mapMessage(msg, uidValidity) {
    const env = msg.envelope || {};
    const refs = parseReferences(headerValue(msg.headers, 'references'));
    const struct = walkStructure(msg.bodyStructure);
    const from = addrList(env.from)[0] || addrList(env.sender)[0] || null;
    const date = env.date instanceof Date && !isNaN(env.date) ? env.date : msg.internalDate;
    return {
      remote_id: this.remoteId(uidValidity, msg.uid),
      message_id: cleanMessageId(env.messageId),
      in_reply_to: cleanMessageId(env.inReplyTo),
      refs: refs.join(' '),
      thread_key: threadKeyFor({ references: refs, inReplyTo: env.inReplyTo, messageId: env.messageId, subject: env.subject }),
      subject: env.subject || '',
      from,
      to: addrList(env.to),
      cc: addrList(env.cc),
      bcc: addrList(env.bcc),
      reply_to: addrList(env.replyTo),
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      seen: msg.flags?.has('\\Seen') || false,
      flagged: msg.flags?.has('\\Flagged') || false,
      answered: msg.flags?.has('\\Answered') || false,
      has_attachments: struct.attachments,
      has_invite: struct.invite,
      size: msg.size || null,
    };
  }

  /**
   * Sync one folder. ctx gives access to local state; see sync.js.
   * Fetches headers for new messages within the sync window, refreshes flags, and drops
   * messages that were deleted on the server (or aged out of the window).
   */
  async syncFolder(folder, ctx) {
    return this.withClient(async (c) => {
      const lock = await c.getMailboxLock(folder.remote_id);
      try {
        const mb = c.mailbox;
        const uv = String(mb.uidValidity);
        const state = ctx.folderState(folder);
        if (state.uidValidity && state.uidValidity !== uv) ctx.resetFolder(folder);
        const unchanged =
          state.uidValidity === uv &&
          String(state.uidNext) === String(mb.uidNext) &&
          Number(state.exists) === Number(mb.exists) &&
          (mb.highestModseq ? String(state.modseq) === String(mb.highestModseq) : !ctx.refreshFlags);
        if (unchanged) return { changed: false };

        const since = new Date(Date.now() - ctx.windowDays * 86400_000);
        let uids = mb.exists ? (await c.search({ since }, { uid: true })) || [] : [];
        uids = uids.sort((a, b) => a - b).slice(-ctx.maxPerFolder(folder));
        const wanted = new Set(uids.map((u) => this.remoteId(uv, u)));
        const local = ctx.localMessages(folder); // Map(remote_id -> {seen, flagged, answered})

        // Removed on server or aged out of the window.
        for (const rid of local.keys()) if (!wanted.has(rid)) ctx.remove(folder, rid);

        // New messages: headers only (bodies are fetched in the background or on open).
        const fresh = uids.filter((u) => !local.has(this.remoteId(uv, u)));
        let added = 0;
        for (let i = 0; i < fresh.length; i += 200) {
          const chunk = fresh.slice(i, i + 200);
          const batch = [];
          for await (const msg of c.fetch(chunk, { uid: true, flags: true, envelope: true, bodyStructure: true, size: true, internalDate: true, headers: ['references'] }, { uid: true })) {
            batch.push(this.mapMessage(msg, uv));
          }
          ctx.upsertMany(folder, batch);
          added += batch.length;
        }

        // Flag changes on messages we already have.
        const existing = uids.filter((u) => local.has(this.remoteId(uv, u)));
        if (existing.length && (ctx.refreshFlags || mb.highestModseq)) {
          const changedSince = mb.highestModseq && state.modseq && state.uidValidity === uv ? BigInt(state.modseq) : undefined;
          const opts = changedSince ? { uid: true, changedSince } : { uid: true };
          for (let i = 0; i < existing.length; i += 500) {
            for await (const msg of c.fetch(existing.slice(i, i + 500), { uid: true, flags: true }, opts)) {
              const rid = this.remoteId(uv, msg.uid);
              const prev = local.get(rid);
              const next = { seen: msg.flags.has('\\Seen'), flagged: msg.flags.has('\\Flagged'), answered: msg.flags.has('\\Answered') };
              if (!prev || prev.seen !== next.seen || prev.flagged !== next.flagged || prev.answered !== next.answered) ctx.setFlags(folder, rid, next);
            }
          }
        }

        ctx.saveFolderState(folder, { uidValidity: uv, uidNext: String(mb.uidNext), exists: mb.exists, modseq: mb.highestModseq ? String(mb.highestModseq) : null });
        return { changed: true, added };
      } finally {
        lock.release();
      }
    });
  }

  async fetchRaw(folder, remoteId) {
    return this.withClient(async (c) => {
      const lock = await c.getMailboxLock(folder.remote_id);
      try {
        const msg = await c.fetchOne(String(this.uidOf(remoteId)), { uid: true, source: true }, { uid: true });
        if (!msg || !msg.source) throw new Error('The message is no longer on the server.');
        return msg.source;
      } finally {
        lock.release();
      }
    });
  }

  async setFlags(folder, remoteIds, flags) {
    const uids = remoteIds.map((r) => this.uidOf(r));
    return this.withClient(async (c) => {
      const lock = await c.getMailboxLock(folder.remote_id);
      try {
        const map = { seen: '\\Seen', flagged: '\\Flagged', answered: '\\Answered' };
        for (const [k, v] of Object.entries(flags)) {
          if (!map[k] || v == null) continue;
          if (v) await c.messageFlagsAdd(uids, [map[k]], { uid: true });
          else await c.messageFlagsRemove(uids, [map[k]], { uid: true });
        }
      } finally {
        lock.release();
      }
    });
  }

  /** Move messages. Returns [{from, to}] where to is the new remote id when the server reports it. */
  async move(folder, remoteIds, target) {
    const uids = remoteIds.map((r) => this.uidOf(r));
    return this.withClient(async (c) => {
      const lock = await c.getMailboxLock(folder.remote_id);
      try {
        const res = await c.messageMove(uids, target.remote_id, { uid: true });
        const destUv = res?.uidValidity ? String(res.uidValidity) : null;
        return remoteIds.map((rid) => {
          const newUid = res?.uidMap?.get?.(this.uidOf(rid));
          return { from: rid, to: newUid && destUv ? this.remoteId(destUv, newUid) : null };
        });
      } finally {
        lock.release();
      }
    });
  }

  /** Permanently delete (used for messages already in Trash, or when there is no Trash). */
  async expunge(folder, remoteIds) {
    const uids = remoteIds.map((r) => this.uidOf(r));
    return this.withClient(async (c) => {
      const lock = await c.getMailboxLock(folder.remote_id);
      try {
        await c.messageDelete(uids, { uid: true });
      } finally {
        lock.release();
      }
    });
  }

  async createFolder(name) {
    return this.withClient(async (c) => {
      const r = await c.mailboxCreate(name);
      return { remote_id: r.path };
    });
  }

  async append(folder, raw, flags = ['\\Seen']) {
    return this.withClient(async (c) => {
      await c.append(folder.remote_id, raw, flags);
    });
  }

  /** Server-side search, for mail outside the local sync window. Returns metadata. */
  async search(folder, query, limit = 25) {
    return this.withClient(async (c) => {
      const lock = await c.getMailboxLock(folder.remote_id);
      try {
        const uv = String(c.mailbox.uidValidity);
        let uids = (await c.search({ or: [{ subject: query }, { from: query }, { body: query }] }, { uid: true })) || [];
        uids = uids.sort((a, b) => b - a).slice(0, limit);
        const out = [];
        if (uids.length) {
          for await (const msg of c.fetch(uids, { uid: true, flags: true, envelope: true, bodyStructure: true, size: true, internalDate: true, headers: ['references'] }, { uid: true })) {
            out.push(this.mapMessage(msg, uv));
          }
        }
        return out;
      } finally {
        lock.release();
      }
    });
  }

  /** Keep a second connection idling on the inbox so new mail shows up right away. */
  async watch(inboxPath, onChange) {
    await this.stopWatching();
    const client = new ImapFlow({ ...imapOptions(this.cfg, this.user, this.secrets.password), socketTimeout: 30 * 60_000 });
    client.on('error', () => {});
    let timer;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, 1500);
    };
    client.on('exists', fire);
    client.on('expunge', fire);
    client.on('flags', fire);
    client.on('close', () => {
      if (this.watcher === client) {
        this.watcher = null;
        // Reconnect later; the scheduler's regular sync covers the gap.
        this.watchRetry = setTimeout(() => this.watch(inboxPath, onChange).catch(() => {}), 60_000);
        this.watchRetry.unref?.();
      }
    });
    await client.connect();
    await client.mailboxOpen(inboxPath, { readOnly: true });
    this.watcher = client;
  }

  async stopWatching() {
    clearTimeout(this.watchRetry);
    const w = this.watcher;
    this.watcher = null;
    if (w) {
      try { await w.logout(); } catch { try { w.close(); } catch {} }
    }
  }
}
