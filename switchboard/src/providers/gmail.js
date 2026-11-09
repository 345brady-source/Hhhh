import { apiFetch } from './http.js';
import { cleanMessageId, decodeEntities, htmlToText, mapLimit, parseAddressList, parseReferences } from '../mailutil.js';
import { randomId } from '../crypto.js';
import { wallTimeToUtc } from '../time.js';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GCAL = 'https://www.googleapis.com/calendar/v3';
const META_HEADERS = ['From', 'To', 'Cc', 'Bcc', 'Reply-To', 'Subject', 'Date', 'Message-ID', 'In-Reply-To', 'References', 'Content-Type'];

const SYSTEM_LABELS = {
  INBOX: { name: 'Inbox', role: 'inbox' },
  DRAFT: { name: 'Drafts', role: 'drafts' },
  SENT: { name: 'Sent', role: 'sent' },
  SPAM: { name: 'Spam', role: 'junk' },
  TRASH: { name: 'Trash', role: 'trash' },
};

export class GmailProvider {
  static type = 'gmail';

  constructor(account, secrets, getToken) {
    this.account = account;
    this.secrets = secrets || {};
    this.getToken = getToken;
  }

  api(path, opts) {
    return apiFetch(this.getToken, path.startsWith('http') ? path : GMAIL + path, opts);
  }

  capi(path, opts) {
    return apiFetch(this.getToken, GCAL + path, opts);
  }

  async test() {
    const p = await this.api('/profile');
    return { email: p.emailAddress, messages: p.messagesTotal };
  }

  async listFolders() {
    const r = await this.api('/labels');
    const out = [];
    for (const l of r.labels || []) {
      if (SYSTEM_LABELS[l.id]) {
        out.push({ remote_id: l.id, path: l.id, name: SYSTEM_LABELS[l.id].name, role: SYSTEM_LABELS[l.id].role, parent_remote_id: null });
      } else if (l.type === 'user' && l.labelListVisibility !== 'labelHide') {
        const parts = l.name.split('/');
        out.push({ remote_id: l.id, path: l.name, name: parts[parts.length - 1], role: null, parent_remote_id: null, _fullName: l.name });
      }
    }
    // Nested labels are named "Parent/Child"; link children to their parent label.
    const byName = new Map(out.filter((f) => f._fullName).map((f) => [f._fullName, f.remote_id]));
    for (const f of out) {
      if (f._fullName?.includes('/')) f.parent_remote_id = byName.get(f._fullName.split('/').slice(0, -1).join('/')) || null;
      delete f._fullName;
    }
    return out;
  }

  async getMeta(id) {
    const q = META_HEADERS.map((h) => `metadataHeaders=${encodeURIComponent(h)}`).join('&');
    const m = await this.api(`/messages/${id}?format=metadata&${q}`);
    return this.mapMeta(m);
  }

  mapMeta(m) {
    const H = {};
    for (const h of m.payload?.headers || []) H[h.name.toLowerCase()] = h.value;
    const labels = m.labelIds || [];
    const ct = H['content-type'] || '';
    return {
      remote_id: m.id,
      message_id: cleanMessageId(H['message-id']),
      in_reply_to: cleanMessageId(H['in-reply-to']),
      refs: parseReferences(H.references).join(' '),
      thread_key: `gm:${m.threadId}`,
      subject: H.subject || '',
      from: parseAddressList(H.from || '')[0] || null,
      to: parseAddressList(H.to || ''),
      cc: parseAddressList(H.cc || ''),
      bcc: parseAddressList(H.bcc || ''),
      reply_to: parseAddressList(H['reply-to'] || ''),
      date: new Date(Number(m.internalDate) || Date.parse(H.date) || Date.now()).toISOString(),
      snippet: decodeEntities(m.snippet || ''),
      seen: !labels.includes('UNREAD'),
      flagged: labels.includes('STARRED'),
      answered: false,
      has_attachments: /multipart\/mixed/i.test(ct),
      has_invite: /text\/calendar/i.test(ct),
      size: m.sizeEstimate || null,
      labelIds: labels,
      threadId: m.threadId,
    };
  }

  applyMeta(ctx, folders, meta) {
    for (const f of folders) {
      if (meta.labelIds.includes(f.remote_id)) ctx.upsertMany(f, [meta]);
      else ctx.remove(f, meta.remote_id);
    }
  }

  async syncAccount(ctx) {
    const st = ctx.accountState();
    const folders = ctx.folders();
    if (!st.historyId) return this.fullSync(ctx, folders);
    const changed = new Set();
    const deleted = new Set();
    let historyId = st.historyId;
    let pageToken;
    try {
      do {
        const r = await this.api(`/history?startHistoryId=${st.historyId}&maxResults=500${pageToken ? `&pageToken=${pageToken}` : ''}`);
        historyId = r.historyId || historyId;
        for (const h of r.history || []) {
          for (const x of h.messagesAdded || []) changed.add(x.message.id);
          for (const x of h.labelsAdded || []) changed.add(x.message.id);
          for (const x of h.labelsRemoved || []) changed.add(x.message.id);
          for (const x of h.messagesDeleted || []) deleted.add(x.message.id);
        }
        pageToken = r.nextPageToken;
      } while (pageToken);
    } catch (e) {
      if (e.status === 404) return this.fullSync(ctx, folders); // history expired
      throw e;
    }
    for (const id of deleted) {
      changed.delete(id);
      ctx.removeEverywhere(id);
    }
    const metas = await mapLimit([...changed], 8, (id) =>
      this.getMeta(id).catch((e) => {
        if (e.status === 404) {
          ctx.removeEverywhere(id);
          return null;
        }
        throw e;
      }),
    );
    for (const m of metas) if (m) this.applyMeta(ctx, folders, m);
    ctx.saveAccountState({ ...st, historyId });
    return { added: changed.size };
  }

  async fullSync(ctx, folders) {
    const profile = await this.api('/profile');
    const need = new Set();
    for (const f of folders) {
      const max = ctx.maxPerFolder(f);
      const ids = [];
      let pageToken;
      do {
        const q = encodeURIComponent(`newer_than:${ctx.windowDays}d`);
        const r = await this.api(`/messages?labelIds=${encodeURIComponent(f.remote_id)}&maxResults=${Math.min(500, max)}&q=${q}&includeSpamTrash=true${pageToken ? `&pageToken=${pageToken}` : ''}`);
        ids.push(...(r.messages || []).map((m) => m.id));
        pageToken = r.nextPageToken;
      } while (pageToken && ids.length < max);
      const wanted = new Set(ids.slice(0, max));
      const local = ctx.localMessages(f);
      for (const rid of local.keys()) if (!wanted.has(rid)) ctx.remove(f, rid);
      for (const id of wanted) if (!local.has(id)) need.add(id);
    }
    const metas = await mapLimit([...need], 8, (id) => this.getMeta(id).catch((e) => (e.status === 404 ? null : Promise.reject(e))));
    for (const m of metas) if (m) this.applyMeta(ctx, folders, m);
    ctx.saveAccountState({ historyId: profile.historyId });
    return { added: need.size };
  }

  async fetchRaw(folder, remoteId) {
    const r = await this.api(`/messages/${remoteId}?format=raw`);
    return Buffer.from(r.raw, 'base64url');
  }

  async setFlags(folder, remoteIds, flags) {
    const add = [];
    const remove = [];
    if (flags.seen === true) remove.push('UNREAD');
    if (flags.seen === false) add.push('UNREAD');
    if (flags.flagged === true) add.push('STARRED');
    if (flags.flagged === false) remove.push('STARRED');
    if (!add.length && !remove.length) return;
    await this.api('/messages/batchModify', { method: 'POST', json: { ids: remoteIds, addLabelIds: add, removeLabelIds: remove } });
  }

  async move(folder, remoteIds, target) {
    if (target.role === 'trash') {
      await mapLimit(remoteIds, 5, (id) => this.api(`/messages/${id}/trash`, { method: 'POST' }));
    } else {
      const remove = ['INBOX', 'SPAM', 'TRASH'].includes(folder.remote_id) || folder.role == null ? [folder.remote_id] : [];
      if (folder.role === 'trash') await mapLimit(remoteIds, 5, (id) => this.api(`/messages/${id}/untrash`, { method: 'POST' }));
      await this.api('/messages/batchModify', { method: 'POST', json: { ids: remoteIds, addLabelIds: [target.remote_id], removeLabelIds: remove.filter((x) => x !== 'TRASH') } });
    }
    return remoteIds.map((id) => ({ from: id, to: id }));
  }

  /** Gmail has no Archive folder: archiving removes the Inbox label. */
  async archive(folder, remoteIds) {
    await this.api('/messages/batchModify', { method: 'POST', json: { ids: remoteIds, removeLabelIds: [folder.remote_id === 'INBOX' ? 'INBOX' : folder.remote_id] } });
  }

  async createFolder(name) {
    const r = await this.api('/labels', { method: 'POST', json: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' } });
    return { remote_id: r.id };
  }

  async expunge(folder, remoteIds) {
    await this.api('/messages/batchDelete', { method: 'POST', json: { ids: remoteIds } });
  }

  async sendRaw(raw, { threadId } = {}) {
    const r = await this.api('/messages/send', { method: 'POST', json: { raw: raw.toString('base64url'), ...(threadId ? { threadId } : {}) } });
    return { id: r.id };
  }

  async search(query, limit = 25) {
    const r = await this.api(`/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`);
    return (await mapLimit((r.messages || []).map((m) => m.id), 8, (id) => this.getMeta(id))).filter(Boolean);
  }

  // Calendar --------------------------------------------------------------------------------

  async listCalendars() {
    const r = await this.capi('/users/me/calendarList?maxResults=250');
    return (r.items || [])
      .filter((c) => !c.deleted && c.accessRole !== 'freeBusyReader')
      .map((c) => ({
        remote_id: c.id,
        name: c.summaryOverride || c.summary,
        color: c.backgroundColor || null,
        read_only: !['owner', 'writer'].includes(c.accessRole),
        is_primary: !!c.primary,
        visible: c.hidden ? 0 : 1,
      }));
  }

  async listEvents(cal, from, to, tz) {
    const out = [];
    let pageToken;
    do {
      const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', timeMin: from.toISOString(), timeMax: to.toISOString(), maxResults: '2500' });
      if (pageToken) q.set('pageToken', pageToken);
      const r = await this.capi(`/calendars/${encodeURIComponent(cal.remote_id)}/events?${q}`);
      for (const e of r.items || []) if (e.status !== 'cancelled') out.push(this.mapEvent(e, tz));
      pageToken = r.nextPageToken;
    } while (pageToken);
    return out;
  }

  mapEvent(e, tz) {
    const allDay = !!e.start?.date;
    const dateToUtc = (d) => {
      const [y, m, dd] = d.split('-').map(Number);
      return wallTimeToUtc(y, m, dd, 0, 0, 0, tz);
    };
    const desc = e.description || '';
    return {
      remote_id: e.id,
      uid: e.iCalUID,
      title: e.summary || '(No title)',
      description: /<[a-z][\s\S]*>/i.test(desc) ? htmlToText(desc) : desc,
      location: e.location || null,
      start: (allDay ? dateToUtc(e.start.date) : new Date(e.start.dateTime)).toISOString(),
      end: (allDay ? dateToUtc(e.end.date) : new Date(e.end.dateTime)).toISOString(),
      all_day: allDay,
      start_date: allDay ? e.start.date : null,
      end_date: allDay ? e.end.date : null,
      timezone: e.start?.timeZone || null,
      attendees: (e.attendees || []).map((a) => ({ email: a.email, name: a.displayName || '', status: a.responseStatus, organizer: !!a.organizer, self: !!a.self })),
      organizer: e.organizer?.email || null,
      status: e.status,
      show_as: e.transparency === 'transparent' ? 'free' : 'busy',
      recurring: !!e.recurringEventId,
      series_id: e.recurringEventId || null,
      reminder_minutes: e.reminders?.overrides?.[0]?.minutes ?? null,
      web_link: e.htmlLink || null,
      online_meeting_url: e.hangoutLink || e.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri || null,
      etag: e.etag,
    };
  }

  eventBody(ev) {
    const body = {};
    if (ev.title !== undefined) body.summary = ev.title;
    if (ev.description !== undefined) body.description = ev.description || '';
    if (ev.location !== undefined) body.location = ev.location || '';
    if (ev.start !== undefined || ev.start_date !== undefined) {
      body.start = ev.all_day ? { date: ev.start_date } : { dateTime: ev.start, timeZone: ev.timezone || 'UTC' };
      body.end = ev.all_day ? { date: ev.end_date } : { dateTime: ev.end, timeZone: ev.timezone || 'UTC' };
    }
    if (ev.attendees !== undefined) body.attendees = (ev.attendees || []).map((a) => ({ email: a.email, displayName: a.name || undefined }));
    if (ev.reminder_minutes !== undefined) {
      body.reminders = ev.reminder_minutes == null ? { useDefault: true } : { useDefault: false, overrides: [{ method: 'popup', minutes: ev.reminder_minutes }] };
    }
    if (ev.show_as !== undefined) body.transparency = ev.show_as === 'free' ? 'transparent' : 'opaque';
    if (ev.online_meeting) body.conferenceData = { createRequest: { requestId: randomId(8), conferenceSolutionKey: { type: 'hangoutsMeet' } } };
    return body;
  }

  async createEvent(cal, ev, tz) {
    const q = new URLSearchParams({ sendUpdates: ev.attendees?.length && ev.notify !== false ? 'all' : 'none' });
    if (ev.online_meeting) q.set('conferenceDataVersion', '1');
    const r = await this.capi(`/calendars/${encodeURIComponent(cal.remote_id)}/events?${q}`, { method: 'POST', json: this.eventBody(ev) });
    return this.mapEvent(r, tz);
  }

  async updateEvent(cal, remoteId, patch, tz) {
    const q = new URLSearchParams({ sendUpdates: patch.notify === false ? 'none' : 'all' });
    if (patch.online_meeting) q.set('conferenceDataVersion', '1');
    const r = await this.capi(`/calendars/${encodeURIComponent(cal.remote_id)}/events/${encodeURIComponent(remoteId)}?${q}`, { method: 'PATCH', json: this.eventBody(patch) });
    return this.mapEvent(r, tz);
  }

  async deleteEvent(cal, remoteId, { notify = true } = {}) {
    try {
      await this.capi(`/calendars/${encodeURIComponent(cal.remote_id)}/events/${encodeURIComponent(remoteId)}?sendUpdates=${notify ? 'all' : 'none'}`, { method: 'DELETE' });
    } catch (e) {
      if (e.status !== 410 && e.status !== 404) throw e;
    }
  }

  async respondToEvent(cal, remoteId, response, tz) {
    const ev = await this.capi(`/calendars/${encodeURIComponent(cal.remote_id)}/events/${encodeURIComponent(remoteId)}`);
    const attendees = (ev.attendees || []).map((a) => (a.self ? { ...a, responseStatus: response } : a));
    const r = await this.capi(`/calendars/${encodeURIComponent(cal.remote_id)}/events/${encodeURIComponent(remoteId)}?sendUpdates=all`, { method: 'PATCH', json: { attendees } });
    return this.mapEvent(r, tz);
  }

  async close() {}
}
