// CalDAV calendars (iCloud, Fastmail, Yahoo, Zoho, Nextcloud, Radicale, …).
import { parseXml, findAll, find, textOf } from '../xml.js';
import { parseIcs, buildIcs, parseComponents } from '../ics.js';
import { randomId } from '../crypto.js';
import { addDaysToDate } from '../time.js';

const PROPS_HOME = '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:resourcetype/><d:current-user-principal/><c:calendar-home-set/><d:displayname/></d:prop></d:propfind>';
const PROPS_CALS = '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:ic="http://apple.com/ns/ical/"><d:prop><d:resourcetype/><d:displayname/><ic:calendar-color/><c:supported-calendar-component-set/><d:current-user-privilege-set/><cs:getctag/></d:prop></d:propfind>';

const icsStamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export class CalDavError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    if (status === 401 || status === 403) this.auth = true;
  }
}

export class CalDavClient {
  constructor({ url, user, pass }) {
    this.base = url;
    this.auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }

  async req(method, url, { depth, body, headers = {}, okStatuses = [200, 201, 204, 207] } = {}) {
    let target = url;
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(target, {
        method,
        redirect: 'manual',
        headers: {
          Authorization: this.auth,
          ...(depth != null ? { Depth: String(depth) } : {}),
          ...(body ? { 'Content-Type': 'application/xml; charset=utf-8' } : {}),
          ...headers,
        },
        body,
      });
      if ([301, 302, 307, 308].includes(res.status) && res.headers.get('location')) {
        target = new URL(res.headers.get('location'), target).toString();
        continue;
      }
      const text = await res.text();
      if (!okStatuses.includes(res.status)) {
        if (res.status === 401 || res.status === 403) throw new CalDavError('The calendar server rejected the username or password (use an app password for iCloud, Fastmail and Yahoo).', res.status);
        if (res.status === 412) throw new CalDavError('The event changed on the server since it was last synced. Sync and try again.', 412);
        throw new CalDavError(`CalDAV ${method} failed: HTTP ${res.status}`, res.status);
      }
      return { status: res.status, text, headers: res.headers, url: target };
    }
    throw new CalDavError('Too many redirects', 0);
  }

  async propfind(url, depth, body) {
    const r = await this.req('PROPFIND', url, { depth, body, okStatuses: [207] });
    const xml = parseXml(r.text);
    return findAll(xml, 'response').map((resp) => ({
      href: new URL(textOf(find(resp, 'href')), r.url).toString(),
      // Only properties from a 2xx propstat count.
      props: findAll(resp, 'propstat').filter((ps) => /\s2\d\d\s/.test(` ${textOf(find(ps, 'status'))} `)).map((ps) => find(ps, 'prop')).filter(Boolean),
      url: r.url,
    }));
  }

  /** Find the user's calendars starting from a server, principal, home or calendar URL. */
  async discover() {
    let first;
    try {
      first = await this.propfind(this.base, 0, PROPS_HOME);
    } catch (e) {
      if (e.auth) throw e;
      const wk = new URL('/.well-known/caldav', this.base).toString();
      first = await this.propfind(wk, 0, PROPS_HOME);
    }
    const r0 = first[0];
    const has = (r, name) => r.props.some((p) => find(p, name));
    const hrefIn = (r, name) => {
      for (const p of r.props) {
        const n = find(p, name);
        const h = n && find(n, 'href');
        if (h) return new URL(textOf(h), r.url).toString();
      }
      return null;
    };
    if (r0 && r0.props.some((p) => find(p, 'resourcetype') && find(find(p, 'resourcetype'), 'calendar'))) {
      return (await this.propfind(r0.href, 0, PROPS_CALS)).map((r) => this.calendarFrom(r)).filter(Boolean);
    }
    let home = r0 && hrefIn(r0, 'calendar-home-set');
    if (!home) {
      const principal = r0 && hrefIn(r0, 'current-user-principal');
      if (principal) {
        const p = await this.propfind(principal, 0, PROPS_HOME);
        home = p[0] && hrefIn(p[0], 'calendar-home-set');
      }
    }
    if (!home && r0 && has(r0, 'resourcetype')) home = r0.href;
    if (!home) throw new CalDavError('No calendars were found at this address.', 404);
    const list = await this.propfind(home, 1, PROPS_CALS);
    return list.map((r) => this.calendarFrom(r)).filter(Boolean);
  }

  calendarFrom(r) {
    const prop = (name) => r.props.map((p) => find(p, name)).find(Boolean);
    const rt = prop('resourcetype');
    if (!rt || !find(rt, 'calendar')) return null;
    const comps = prop('supported-calendar-component-set');
    if (comps && !findAll(comps, 'comp').some((c) => (c.attrs.name || '').toUpperCase() === 'VEVENT')) return null;
    const privs = prop('current-user-privilege-set');
    const writable = !privs || ['write', 'write-content', 'all'].some((n) => findAll(privs, n).length);
    let color = textOf(prop('calendar-color')) || null;
    if (color && /^#[0-9a-f]{8}$/i.test(color)) color = color.slice(0, 7);
    return {
      remote_id: r.href.endsWith('/') ? r.href : `${r.href}/`,
      name: textOf(prop('displayname')) || decodeURIComponent(r.href.replace(/\/$/, '').split('/').pop()),
      color,
      read_only: !writable,
      ctag: textOf(prop('getctag')) || null,
    };
  }

  /** Raw resources (href, etag, ics) with events in [from, to). */
  async query(calUrl, from, to) {
    const body = `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${icsStamp(from)}" end="${icsStamp(to)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
    const r = await this.req('REPORT', calUrl, { depth: 1, body, okStatuses: [207] });
    const xml = parseXml(r.text);
    return findAll(xml, 'response')
      .map((resp) => ({
        href: new URL(textOf(find(resp, 'href')), r.url).toString(),
        etag: textOf(find(resp, 'getetag')) || null,
        ics: find(resp, 'calendar-data')?.text || '',
      }))
      .filter((x) => x.ics.includes('BEGIN:VEVENT'));
  }

  async get(href) {
    const r = await this.req('GET', href, { okStatuses: [200] });
    return { ics: r.text, etag: r.headers.get('etag') };
  }

  async put(href, ics, { etag, create = false } = {}) {
    const headers = { 'Content-Type': 'text/calendar; charset=utf-8' };
    if (create) headers['If-None-Match'] = '*';
    else if (etag) headers['If-Match'] = etag;
    const r = await this.req('PUT', href, { body: ics, headers, okStatuses: [200, 201, 204] });
    return r.headers.get('etag');
  }

  async del(href, etag) {
    await this.req('DELETE', href, { headers: etag ? { 'If-Match': etag } : {}, okStatuses: [200, 204, 404] });
  }
}

/** Calendar side of an account that syncs over CalDAV. Same calendar interface as the Google/Microsoft providers. */
export class CalDavProvider {
  static type = 'caldav';

  constructor(account, secrets) {
    this.account = account;
    const cfg = account.config || {};
    this.client = new CalDavClient({ url: cfg.caldavUrl, user: cfg.caldavUser || cfg.imapUser || cfg.popUser || account.email, pass: secrets.caldavPassword || secrets.password });
  }

  async test() {
    const cals = await this.client.discover();
    return { calendars: cals.length };
  }

  async listCalendars() {
    const cals = await this.client.discover();
    const writable = cals.filter((c) => !c.read_only);
    const rank = (c) => {
      const i = ['calendar', 'home', 'personal', 'default', 'main', 'work'].indexOf(c.name.toLowerCase());
      return i < 0 ? 99 : i;
    };
    const primary = [...writable].sort((x, y) => rank(x) - rank(y))[0];
    return cals.map((c) => ({ ...c, is_primary: c === primary, visible: 1 }));
  }

  async listEvents(cal, from, to, tz) {
    const out = [];
    for (const res of await this.client.query(cal.remote_id, from, to)) {
      const { events } = parseIcs(res.ics, { tz, from, to });
      for (const e of events) {
        if (e.status === 'cancelled') continue;
        const instance = e.remote_id.includes('::') ? e.remote_id.split('::')[1] : null;
        out.push({ ...e, remote_id: instance ? `${res.href}::${instance}` : res.href, href: res.href, etag: res.etag, series_id: e.recurring ? res.href : null });
      }
    }
    return out;
  }

  /** Read the master VEVENT of a resource back into our event shape. */
  async master(href, tz) {
    const { ics, etag } = await this.client.get(href);
    const { events } = parseIcs(ics, { tz });
    const master = events.find((e) => !e.remote_id.includes('::')) || events[0];
    const overrides = parseComponents(ics).children.flatMap((c) => c.children).filter((c) => c.type === 'VEVENT' && c.props['RECURRENCE-ID']);
    return { master, etag, ics, overrides };
  }

  toIcs(ev, extra = {}) {
    return buildIcs([{ ...ev, ...extra }], { calName: null, organizer: ev.organizer ? { email: ev.organizer } : null });
  }

  async createEvent(cal, ev) {
    const uid = `${randomId(12)}@switchboard`;
    const href = new URL(`${encodeURIComponent(uid.replace(/@.*/, ''))}.ics`, cal.remote_id).toString();
    await this.client.put(href, this.toIcs({ ...ev, uid, organizer: null }), { create: true });
    return { resync: true, uid };
  }

  /**
   * Update an event. For one occurrence of a series the occurrence is split off as its own event
   * (the series gets an EXDATE); for the whole series the master is changed.
   */
  async updateEvent(cal, remoteId, patch, tz, { row, scope = 'occurrence' } = {}) {
    const href = row?.href || String(remoteId).split('::')[0];
    const { master, etag } = await this.master(href, tz);
    if (!master) throw new Error('Event not found on the calendar server.');
    const isInstance = String(remoteId).includes('::');
    const merged = (base) => ({
      uid: base.uid, title: base.title, description: base.description, location: base.location, start: base.start, end: base.end,
      all_day: base.all_day, start_date: base.start_date, end_date: base.end_date, attendees: base.attendees, reminder_minutes: base.reminder_minutes,
      show_as: base.show_as, organizer: base.organizer, rrule: base.rrule, exdates: base.exdates,
    });
    if (isInstance && scope !== 'series') {
      const instStart = row.all_day ? row.start_date : row.start;
      await this.client.put(href, this.toIcs({ ...merged(master), exdates: [...(master.exdates || []), instStart], sequence: (master.sequence || 0) + 1 }), { etag });
      const single = { ...merged({ ...master, start: row.start, end: row.end, start_date: row.start_date, end_date: row.end_date, all_day: !!row.all_day }), rrule: null, exdates: [], ...stripUndefined(patch) };
      single.uid = `${randomId(12)}@switchboard`;
      await this.client.put(new URL(`${single.uid.replace(/@.*/, '')}.ics`, cal.remote_id).toString(), this.toIcs(single), { create: true });
      return { resync: true, uid: single.uid };
    }
    let next = { ...merged(master), ...stripUndefined(patch), uid: master.uid, rrule: patch.rrule !== undefined ? patch.rrule : master.rrule };
    if (isInstance && patch.start !== undefined) {
      // Shift the whole series by the change made to this occurrence.
      const shift = Date.parse(patch.start) - Date.parse(row.start);
      const dur = Date.parse(patch.end) - Date.parse(patch.start);
      next.start = new Date(Date.parse(master.start) + shift).toISOString();
      next.end = new Date(Date.parse(next.start) + dur).toISOString();
      const days = Math.round(shift / 86400_000);
      if (patch.all_day) {
        next.start_date = addDaysToDate(master.start_date, days);
        next.end_date = addDaysToDate(next.start_date, Math.round((Date.parse(patch.end_date) - Date.parse(patch.start_date)) / 86400_000));
      }
      // Occurrences already removed from the series stay removed after the shift.
      next.exdates = (master.exdates || []).map((x) => (/^\d{4}-\d{2}-\d{2}$/.test(x) ? addDaysToDate(x, days) : new Date(Date.parse(x) + shift).toISOString()));
    }
    await this.client.put(href, this.toIcs({ ...next, sequence: (master.sequence || 0) + 1 }), { etag });
    return { resync: true, uid: master.uid };
  }

  async deleteEvent(cal, remoteId, { row, scope = 'occurrence' } = {}) {
    const href = row?.href || String(remoteId).split('::')[0];
    if (String(remoteId).includes('::') && scope !== 'series') {
      const { master, etag } = await this.master(href, 'UTC');
      const instStart = row.all_day ? row.start_date : row.start;
      await this.client.put(href, this.toIcs({ ...master, exdates: [...(master.exdates || []), instStart], sequence: (master.sequence || 0) + 1 }), { etag });
    } else {
      await this.client.del(href, row?.etag);
    }
    return { resync: true };
  }

  async close() {}
}

function stripUndefined(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
