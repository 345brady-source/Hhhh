import { apiFetch } from './http.js';
import { cleanMessageId, mapLimit } from '../mailutil.js';
import { WINDOWS_ZONES, wallTimeToUtc, addDaysToDate, zonedParts, localDate } from '../time.js';
import { toGraphRecurrence } from '../recurrence.js';

const pad2 = (n) => String(n).padStart(2, '0');
/** Wall-clock "YYYY-MM-DDTHH:MM:SS" of an instant in a zone. */
function wall(date, tz) {
  const p = zonedParts(new Date(date), tz);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
}

const GRAPH = 'https://graph.microsoft.com/v1.0';
const WELL_KNOWN = { inbox: 'inbox', sentitems: 'sent', drafts: 'drafts', deleteditems: 'trash', junkemail: 'junk', archive: 'archive' };
const MSG_SELECT = 'id,subject,from,sender,toRecipients,ccRecipients,bccRecipients,replyTo,receivedDateTime,sentDateTime,isRead,flag,hasAttachments,bodyPreview,internetMessageId,conversationId,isDraft';
const EVENT_SELECT = 'id,iCalUId,subject,body,start,end,isAllDay,location,attendees,organizer,showAs,type,seriesMasterId,webLink,onlineMeeting,isOnlineMeeting,reminderMinutesBeforeStart,isReminderOn,isCancelled,responseStatus';

const IANA_TO_WINDOWS = Object.fromEntries(Object.entries(WINDOWS_ZONES).map(([w, i]) => [i, w]));

const ga = (r) => (r?.emailAddress?.address ? { name: r.emailAddress.name || '', address: r.emailAddress.address } : null);
const gaList = (list) => (list || []).map(ga).filter(Boolean);
const toRecipients = (list) => (list || []).map((a) => ({ emailAddress: { address: a.address || a.email, name: a.name || undefined } }));

export class GraphProvider {
  static type = 'microsoft';

  constructor(account, secrets, getToken) {
    this.account = account;
    this.secrets = secrets || {};
    this.getToken = getToken;
  }

  api(path, opts = {}) {
    return apiFetch(this.getToken, path.startsWith('http') ? path : GRAPH + path, opts);
  }

  async test() {
    const me = await this.api('/me?$select=mail,userPrincipalName,displayName');
    return { email: me.mail || me.userPrincipalName };
  }

  async listFolders() {
    const roles = {};
    await Promise.all(
      Object.entries(WELL_KNOWN).map(async ([wk, role]) => {
        try {
          const f = await this.api(`/me/mailFolders/${wk}?$select=id`);
          roles[f.id] = role;
        } catch {}
      }),
    );
    const out = [];
    const walk = async (url, parent) => {
      let next = url;
      while (next) {
        const r = await this.api(next);
        for (const f of r.value || []) {
          out.push({ remote_id: f.id, path: f.displayName, name: f.displayName, role: roles[f.id] || null, parent_remote_id: parent });
          if (f.childFolderCount > 0 && out.length < 500) await walk(`/me/mailFolders/${f.id}/childFolders?$top=100&$select=id,displayName,childFolderCount`, f.id);
        }
        next = r['@odata.nextLink'];
      }
    };
    await walk('/me/mailFolders?$top=100&$select=id,displayName,childFolderCount', null);
    // Hide folders that are not mail (Conversation History, Sync Issues, etc. have no role but are fine to show).
    return out;
  }

  mapMessage(m) {
    const from = ga(m.from) || ga(m.sender);
    return {
      remote_id: m.id,
      message_id: cleanMessageId(m.internetMessageId),
      in_reply_to: null,
      refs: '',
      thread_key: m.conversationId ? `ms:${m.conversationId}` : cleanMessageId(m.internetMessageId),
      subject: m.subject || '',
      from,
      to: gaList(m.toRecipients),
      cc: gaList(m.ccRecipients),
      bcc: gaList(m.bccRecipients),
      reply_to: gaList(m.replyTo),
      date: new Date(m.receivedDateTime || m.sentDateTime || Date.now()).toISOString(),
      snippet: (m.bodyPreview || '').replace(/\s+/g, ' ').slice(0, 200),
      seen: !!m.isRead,
      flagged: m.flag?.flagStatus === 'flagged',
      answered: false,
      has_attachments: !!m.hasAttachments,
      has_invite: false,
      size: null,
    };
  }

  /** Per-folder delta sync: picks up new, changed and deleted messages since the last run. */
  async syncFolder(folder, ctx) {
    const state = ctx.folderState(folder);
    let url = state.deltaLink;
    if (!url) {
      const since = new Date(Date.now() - ctx.windowDays * 86400_000).toISOString();
      url = `/me/mailFolders/${folder.remote_id}/messages/delta?$select=${MSG_SELECT}&$filter=${encodeURIComponent(`receivedDateTime ge ${since}`)}`;
      ctx.resetFolder(folder);
    }
    let added = 0;
    while (url) {
      let r;
      try {
        r = await this.api(url, { headers: { Prefer: 'odata.maxpagesize=100' } });
      } catch (e) {
        if ((e.status === 410 || e.status === 400) && state.deltaLink) {
          ctx.saveFolderState(folder, {});
          return this.syncFolder(folder, ctx);
        }
        throw e;
      }
      const batch = [];
      for (const m of r.value || []) {
        if (m['@removed']) ctx.remove(folder, m.id);
        else if (!m.isDraft || folder.role === 'drafts') batch.push(this.mapMessage(m));
      }
      ctx.upsertMany(folder, batch);
      added += batch.length;
      if (r['@odata.deltaLink']) {
        ctx.saveFolderState(folder, { deltaLink: r['@odata.deltaLink'] });
        break;
      }
      url = r['@odata.nextLink'];
    }
    return { changed: added > 0, added };
  }

  async fetchRaw(folder, remoteId) {
    return this.api(`/me/messages/${remoteId}/$value`, { raw: true });
  }

  async setFlags(folder, remoteIds, flags) {
    const body = {};
    if (flags.seen != null) body.isRead = !!flags.seen;
    if (flags.flagged != null) body.flag = { flagStatus: flags.flagged ? 'flagged' : 'notFlagged' };
    if (!Object.keys(body).length) return;
    await mapLimit(remoteIds, 4, (id) => this.api(`/me/messages/${id}`, { method: 'PATCH', json: body }));
  }

  async move(folder, remoteIds, target) {
    return mapLimit(remoteIds, 4, async (id) => {
      const r = await this.api(`/me/messages/${id}/move`, { method: 'POST', json: { destinationId: target.remote_id } });
      return { from: id, to: r?.id || null };
    });
  }

  /** Graph creates a draft from a base64 MIME body; there is no in-place update, so replace it. */
  async saveDraft(raw, prev, { messageId }) {
    const r = await this.api('/me/messages', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: raw.toString('base64') });
    if (prev?.id) await this.deleteDraft(prev).catch(() => {});
    return { type: 'graph', id: r.id, messageId };
  }

  async deleteDraft(ref) {
    if (ref?.id) await this.api(`/me/messages/${ref.id}`, { method: 'DELETE' }).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
  }

  /**
   * Messages over ~3.5 MB can't go through sendMail as MIME. Build a draft, upload attachments
   * (large ones through an upload session, in 3.2 MB chunks), then send it.
   */
  async sendLarge({ to, cc, bcc, subject, html, attachments = [], replyToRemoteId = null, replyAll = false }) {
    const msg = { subject, body: { contentType: 'HTML', content: html || '' }, toRecipients: toRecipients(to), ccRecipients: toRecipients(cc), bccRecipients: toRecipients(bcc) };
    let draft;
    if (replyToRemoteId) {
      draft = await this.api(`/me/messages/${replyToRemoteId}/${replyAll ? 'createReplyAll' : 'createReply'}`, { method: 'POST', json: {} });
      await this.api(`/me/messages/${draft.id}`, { method: 'PATCH', json: msg });
    } else {
      draft = await this.api('/me/messages', { method: 'POST', json: msg });
    }
    const CHUNK = 320 * 1024 * 10;
    for (const a of attachments) {
      const buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content || '');
      if (buf.length < 3 * 1024 * 1024) {
        await this.api(`/me/messages/${draft.id}/attachments`, {
          method: 'POST',
          json: { '@odata.type': '#microsoft.graph.fileAttachment', name: a.filename, contentType: a.contentType || 'application/octet-stream', contentBytes: buf.toString('base64'), ...(a.cid ? { isInline: true, contentId: a.cid } : {}) },
        });
        continue;
      }
      const session = await this.api(`/me/messages/${draft.id}/attachments/createUploadSession`, {
        method: 'POST',
        json: { AttachmentItem: { attachmentType: 'file', name: a.filename, size: buf.length, contentType: a.contentType || 'application/octet-stream' } },
      });
      for (let off = 0; off < buf.length; off += CHUNK) {
        const chunk = buf.subarray(off, Math.min(buf.length, off + CHUNK));
        const res = await fetch(session.uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${off}-${off + chunk.length - 1}/${buf.length}`, 'Content-Type': 'application/octet-stream' }, body: chunk });
        if (!res.ok) throw new Error(`Uploading ${a.filename} failed (HTTP ${res.status}).`);
      }
    }
    await this.api(`/me/messages/${draft.id}/send`, { method: 'POST' });
    return {};
  }

  async createFolder(name) {
    const r = await this.api('/me/mailFolders', { method: 'POST', json: { displayName: name } });
    return { remote_id: r.id };
  }

  async expunge(folder, remoteIds) {
    await mapLimit(remoteIds, 4, (id) => this.api(`/me/messages/${id}`, { method: 'DELETE' }).catch((e) => (e.status === 404 ? null : Promise.reject(e))));
  }

  /** Graph accepts a whole MIME message (base64) on sendMail, which keeps threading headers intact. */
  async sendRaw(raw) {
    await this.api('/me/sendMail', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: raw.toString('base64') });
    return {};
  }

  async search(query, limit = 25) {
    const r = await this.api(`/me/messages?$search=${encodeURIComponent(`"${query.replace(/"/g, '')}"`)}&$top=${limit}&$select=${MSG_SELECT},parentFolderId`);
    return (r.value || []).map((m) => ({ ...this.mapMessage(m), parentFolderId: m.parentFolderId }));
  }

  // Calendar --------------------------------------------------------------------------------

  async listCalendars() {
    const r = await this.api('/me/calendars?$top=100&$select=id,name,hexColor,color,canEdit,isDefaultCalendar');
    return (r.value || []).map((c) => ({
      remote_id: c.id,
      name: c.name,
      color: c.hexColor || null,
      read_only: !c.canEdit,
      is_primary: !!c.isDefaultCalendar,
      visible: 1,
    }));
  }

  async listEvents(cal, from, to, tz) {
    const out = [];
    let url = `/me/calendars/${cal.remote_id}/calendarView?startDateTime=${encodeURIComponent(from.toISOString())}&endDateTime=${encodeURIComponent(to.toISOString())}&$top=250&$select=${EVENT_SELECT}`;
    while (url) {
      const r = await this.api(url, { headers: { Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"' } });
      for (const e of r.value || []) if (!e.isCancelled) out.push(this.mapEvent(e, tz));
      url = r['@odata.nextLink'];
    }
    return out;
  }

  mapEvent(e, tz) {
    const utc = (d) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(d.dateTime) ? d.dateTime : `${d.dateTime}Z`);
    let start = utc(e.start);
    let end = utc(e.end);
    let startDate = null;
    let endDate = null;
    if (e.isAllDay) {
      // All-day events come back as midnight-to-midnight; keep the calendar dates.
      startDate = e.start.dateTime.slice(0, 10);
      endDate = e.end.dateTime.slice(0, 10);
      if (endDate <= startDate) endDate = addDaysToDate(startDate, 1);
      const [y, m, d] = startDate.split('-').map(Number);
      const [y2, m2, d2] = endDate.split('-').map(Number);
      start = wallTimeToUtc(y, m, d, 0, 0, 0, tz);
      end = wallTimeToUtc(y2, m2, d2, 0, 0, 0, tz);
    }
    return {
      remote_id: e.id,
      uid: e.iCalUId,
      title: e.subject || '(No title)',
      description: (e.body?.content || '').trim(),
      location: e.location?.displayName || null,
      start: start.toISOString(),
      end: end.toISOString(),
      all_day: !!e.isAllDay,
      start_date: startDate,
      end_date: endDate,
      timezone: null,
      attendees: (e.attendees || []).map((a) => ({ email: a.emailAddress?.address, name: a.emailAddress?.name || '', status: a.status?.response, type: a.type })),
      organizer: e.organizer?.emailAddress?.address || null,
      status: e.responseStatus?.response || null,
      show_as: e.showAs || 'busy',
      recurring: e.type === 'occurrence' || e.type === 'exception',
      series_id: e.seriesMasterId || null,
      reminder_minutes: e.isReminderOn ? e.reminderMinutesBeforeStart : null,
      web_link: e.webLink || null,
      online_meeting_url: e.onlineMeeting?.joinUrl || null,
      etag: null,
    };
  }

  eventBody(ev, tz) {
    const b = {};
    if (ev.title !== undefined) b.subject = ev.title;
    if (ev.description !== undefined) b.body = { contentType: 'text', content: ev.description || '' };
    if (ev.location !== undefined) b.location = { displayName: ev.location || '' };
    if (ev.start !== undefined || ev.start_date !== undefined) {
      if (ev.all_day) {
        const zone = IANA_TO_WINDOWS[tz] || tz || 'UTC';
        b.isAllDay = true;
        b.start = { dateTime: `${ev.start_date}T00:00:00`, timeZone: zone };
        b.end = { dateTime: `${ev.end_date}T00:00:00`, timeZone: zone };
      } else if (ev.rrule) {
        // Repeating events are expressed in local time so occurrences keep their time across DST changes.
        const zone = IANA_TO_WINDOWS[tz] || tz || 'UTC';
        b.isAllDay = false;
        b.start = { dateTime: wall(ev.start, tz), timeZone: zone };
        b.end = { dateTime: wall(ev.end, tz), timeZone: zone };
      } else {
        b.isAllDay = false;
        b.start = { dateTime: new Date(ev.start).toISOString().replace('Z', ''), timeZone: 'UTC' };
        b.end = { dateTime: new Date(ev.end).toISOString().replace('Z', ''), timeZone: 'UTC' };
      }
    }
    if (ev.rrule) b.recurrence = toGraphRecurrence(ev.rrule, ev.all_day ? wallTimeToUtc(...ev.start_date.split('-').map(Number), 12, 0, 0, tz).toISOString() : ev.start, tz);
    if (ev.attendees !== undefined) b.attendees = (ev.attendees || []).map((a) => ({ emailAddress: { address: a.email, name: a.name || undefined }, type: 'required' }));
    if (ev.reminder_minutes !== undefined) {
      b.isReminderOn = ev.reminder_minutes != null;
      if (ev.reminder_minutes != null) b.reminderMinutesBeforeStart = ev.reminder_minutes;
    }
    if (ev.show_as !== undefined) b.showAs = ev.show_as === 'free' ? 'free' : ev.show_as || 'busy';
    if (ev.online_meeting) b.isOnlineMeeting = true;
    return b;
  }

  async createEvent(cal, ev, tz) {
    const r = await this.api(`/me/calendars/${cal.remote_id}/events`, {
      method: 'POST',
      json: this.eventBody(ev, tz),
      headers: { Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"' },
    });
    return this.mapEvent(r, tz);
  }

  async updateEvent(cal, remoteId, patch, tz, { row, scope } = {}) {
    if (scope === 'series' && row?.series_id) return this.updateSeries(row, patch, tz);
    const r = await this.api(`/me/events/${remoteId}`, {
      method: 'PATCH',
      json: this.eventBody(patch, tz),
      headers: { Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"' },
    });
    return this.mapEvent(r, tz);
  }

  /** Change every occurrence by editing the series master. */
  async updateSeries(row, patch, tz) {
    const master = await this.api(`/me/events/${row.series_id}?$select=start,end,isAllDay,recurrence`, { headers: { Prefer: 'outlook.timezone="UTC"' } });
    const b = this.eventBody({ ...patch, start: undefined, end: undefined, start_date: undefined, rrule: undefined }, tz);
    const zone = IANA_TO_WINDOWS[tz] || tz || 'UTC';
    if (patch.start !== undefined && !patch.all_day) {
      const shift = Date.parse(patch.start) - Date.parse(row.start);
      const dur = Date.parse(patch.end) - Date.parse(patch.start);
      const ms = Date.parse(`${master.start.dateTime.replace(/Z$/, '')}Z`) + shift;
      b.start = { dateTime: wall(ms, tz), timeZone: zone };
      b.end = { dateTime: wall(ms + dur, tz), timeZone: zone };
      if (master.recurrence) b.recurrence = { ...master.recurrence, range: { ...master.recurrence.range, startDate: localDate(new Date(ms), tz) } };
    }
    if (patch.rrule) b.recurrence = toGraphRecurrence(patch.rrule, patch.start || `${master.start.dateTime.replace(/Z$/, '')}Z`, tz);
    await this.api(`/me/events/${row.series_id}`, { method: 'PATCH', json: b });
    return { resync: true };
  }

  async deleteEvent(cal, remoteId, { row, scope } = {}) {
    const id = scope === 'series' && row?.series_id ? row.series_id : remoteId;
    try {
      await this.api(`/me/events/${id}`, { method: 'DELETE' });
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    return scope === 'series' ? { resync: true } : null;
  }

  async respondToEvent(cal, remoteId, response) {
    const action = { accepted: 'accept', declined: 'decline', tentative: 'tentativelyAccept' }[response];
    await this.api(`/me/events/${remoteId}/${action}`, { method: 'POST', json: { sendResponse: true } });
    return null;
  }

  async close() {}
}
