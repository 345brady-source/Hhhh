/*
 * The data room (self-serve edition, 14-02: D-02, MS-10 to MS-14, MS-08): one room per offering with an NDA, PDF
 * documents, prospects, views, indications of interest and the room's record, as pure functions on the workspace.
 *
 * The rules this model keeps (each a draft the screens mark "To be confirmed" until counsel reads them, C-08):
 *   - Rooms are for Rule 506(b), Rule 506(c) and other exemptions; Regulation A offerings are refused (C-10).
 *   - A 506(b) room never has a shareable link, and refuses a prospect until the sponsor records how they know the
 *     person, since when, and that they know enough to judge suitability; a relationship dated on or after the room
 *     opened is kept with a warning (C-03).
 *   - The click-through NDA records the text's SHA-256 version, the name typed, the box ticked, the time and (given by
 *     the server) the address and browser; documents are listed only after the current version is agreed (C-04).
 *   - Nothing in a room is ever deleted: a document is hidden, an access is ended; no function here removes anything
 *     (C-05).
 *   - An indication of interest is an optional amount, class and note, changed or withdrawn by new entries; the
 *     pipeline is kept apart from capital raised, and prospects never enter ws.investors or the 506(b) count (C-16).
 *
 * The record of a room is its own append-only, hash-chained event list (room.events, the change log's recipe); the
 * prospect and document fields beside it are kept in step with it, and verify() checks both.
 *
 *   ensure(ws)                                   ws.rooms = [] when missing
 *   RULES                                        { MAX_DOCS, MAX_BYTES, DAYS, NOTE_MAX }
 *   allowed(o)                                   { ok: true, regime } | { ok: false, reason }
 *   open(ws, offeringId, { ndaText, ndaTitle, ndaMode, download, by, at })                  → room
 *   setNda(ws, roomId, { text, title, by, at })                                            → room
 *   addDoc(ws, roomId, { id, title, fileName, type, size, sha256, pages, by, at })         → doc (bytes: the caller's)
 *   hideDoc(ws, roomId, docId, { by, why, at })                                            → doc
 *   addProspect(ws, roomId, { name, email, basis, days, by, at })                          → { prospect, warning }
 *   setOpenLink(ws, roomId, on, { by, at })                                                → room
 *   joinOpen(ws, roomId, { name, email, days, at })                                        → prospect
 *   endAccess(ws, roomId, prospectId, { by, at })                                          → prospect
 *   access(ws, roomId, prospectId, at)                                                     → { ok } | { ok: false, reason }
 *   agree(ws, roomId, prospectId, { name, ticked, at, ip, agent, envelopeId })             → assent
 *   agreed(room, prospect)                                                                 → true | false
 *   docsFor(ws, roomId, prospectId, at)                                                    → [doc]
 *   view(ws, roomId, prospectId, { docId, at, seconds, pages, viewId, how })               → view
 *   viewsOf(room)                                → [{ prospectId, docId, opens, first, last, seconds, pages }]
 *   indicate(ws, roomId, prospectId, { kind, cents, cls, note, at })                       → interest
 *   current(prospect)                                                                      → interest | null
 *   pipeline(ws, offeringId)                                                               → { prospects, indicated, cents }
 *   inviteDraft(ws, roomId, prospectId)          the invitation form's draft (invitations.js draft()) for this prospect
 *   markSubscribeInvited(ws, roomId, prospectId, { by, at })                               → prospect
 *   verify(ws, roomId)                           { ok: true, events } | { ok: false, brokenAt, reason }
 *   roomRecord(ws, roomId, getBytes)             Promise<{ name, bytes, hash, files, chain }>: the record as one zip
 *   eventText(prev, e), GENESIS                  the chain's recipe
 * Every refusal is an Error with one plain sentence. Times are ISO strings in UTC ('2027-01-20T09:00:00Z').
 */
(function (NS) {
  'use strict';
  if (!NS || !NS.EDITION || !NS.EDITION.diy) return;

  const RULES = { MAX_DOCS: 30, MAX_BYTES: 26214400, DAYS: 90, NOTE_MAX: 500 };
  const GENESIS = '0'.repeat(64);
  const KINDS = ['investor', 'relationship', 'introduced', 'other'];
  const PATTERNS = [/\b\d{2}-\d{7}\b/, /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, /\d{8,}/, /\bpass(word|code)?\s*[:=]/i];
  const S506B = 'Record how you know this person before inviting them (Rule 506(b)).';
  const LATE = 'A relationship that began with this offering is not pre-existing.';
  const GONE = 'This link is no longer active.';
  const KEPT = 'Messages and data room activity are kept unchanged and can be downloaded with a check that nothing was altered.';

  const fail = (m) => {
    throw new Error(m);
  };
  const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const when = (at) => {
    if (at == null || at === '') return now();
    const s = typeof at === 'object' && typeof at.toISOString === 'function' ? at.toISOString().replace(/\.\d{3}Z$/, 'Z') : String(at);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/.test(s) || isNaN(Date.parse(s))) fail('The time is not valid.');
    return s;
  };
  const str = (v) => String(v == null ? '' : v).trim();
  const isEmail = (s) => /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]{2,}$/.test(String(s || ''));
  const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  const whole = (n) => typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0;
  const sha = (x) => NS.audit.sha256(x);
  const plus = (at, days) => new Date(Date.parse(at) + days * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');

  function ensure(ws) {
    if (!Array.isArray(ws.rooms)) ws.rooms = [];
    return ws.rooms;
  }
  function allowed(o) {
    const r = NS.eligibility && NS.eligibility.regime ? NS.eligibility.regime(o) : '';
    if (r === '506b' || r === '506c' || r === 'other') return { ok: true, regime: r };
    if (!r) return { ok: false, reason: "Choose the offering's exemption first." };
    return { ok: false, reason: 'Data rooms are not offered for Regulation A offerings.' };
  }
  function roomOf(ws, roomId) {
    const r = ensure(ws).find((x) => x.id === roomId);
    if (!r) fail('No such data room.');
    return r;
  }
  function prospectOf(room, prospectId) {
    const p = room.prospects.find((x) => x.id === prospectId);
    if (!p) fail('No such prospect in this data room.');
    return p;
  }
  /** The next free id with this prefix across every room of the workspace. */
  function nextId(ws, prefix, pick) {
    const used = new Set();
    ensure(ws).forEach((r) => pick(r).forEach((x) => used.add(x.id)));
    let n = used.size + 1;
    while (used.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }
  const logIt = (ws, room, action, record, detail, actor) =>
    NS.audit && NS.audit.log && NS.audit.log(ws, Object.assign({ action, fund: room.offeringId, record, detail }, actor ? { actor } : {}));

  /* ---------- The room's own chain ---------- */
  function eventText(prev, e) {
    return [prev, e.seq, e.at, e.kind, e.prospectId || '', e.docId || '', JSON.stringify(e.data)].join('|');
  }
  function record(room, at, kind, prospectId, docId, data) {
    const list = room.events;
    const e = { seq: list.length + 1, at, kind, prospectId: prospectId || '', docId: docId || '', data };
    e.prev = list.length ? list[list.length - 1].hash : GENESIS;
    e.hash = sha(eventText(e.prev, e));
    list.push(e);
    return e;
  }

  /* ---------- Rooms and the NDA ---------- */
  function open(ws, offeringId, opts) {
    const o = opts || {};
    const off = (ws.offerings || []).find((x) => x.id === offeringId);
    if (!off) fail('No such offering.');
    const ok = allowed(off);
    if (!ok.ok) fail(ok.reason);
    if (ensure(ws).some((r) => r.offeringId === offeringId)) fail('This offering already has a data room.');
    const by = str(o.by);
    if (!by) fail('Name the person opening the room.');
    const text = String(o.ndaText == null ? '' : o.ndaText);
    if (!text.trim()) fail('Add the NDA text.');
    const download = o.download == null || o.download === '' ? 'off' : o.download;
    if (download !== 'off' && download !== 'watermarked') fail('Choose whether documents can be downloaded: off or watermarked.');
    const mode = o.ndaMode == null || o.ndaMode === '' ? 'click' : o.ndaMode;
    if (mode !== 'click' && mode !== 'esign') fail('Choose how the NDA is agreed: click-through or e-signed.');
    const at = when(o.at);
    const title = str(o.ndaTitle) || 'Confidentiality agreement';
    const version = sha(text);
    const room = {
      id: nextId(ws, 'rm-', (r) => [r]),
      offeringId,
      regime: ok.regime,
      openedAt: at,
      openedBy: by,
      nda: { mode, title, text, version, templateId: '' },
      ndaVersions: [{ version, title, text, at, by }],
      download,
      openLink: false,
      docs: [],
      prospects: [],
      events: []
    };
    record(room, at, 'opened', '', '', { offeringId, regime: ok.regime, download, mode, version, title, by });
    ws.rooms.push(room);
    logIt(ws, room, 'Data room opened', room.id, `${ok.regime}; download ${download}`, by);
    return room;
  }
  function setNda(ws, roomId, opts) {
    const o = opts || {};
    const room = roomOf(ws, roomId);
    const by = str(o.by);
    if (!by) fail('Name the person changing the NDA.');
    const text = String(o.text == null ? '' : o.text);
    if (!text.trim()) fail('Add the NDA text.');
    const version = sha(text);
    if (version === room.nda.version) fail('This is the NDA already in use.');
    const at = when(o.at);
    const title = str(o.title) || room.nda.title;
    room.ndaVersions.push({ version, title, text, at, by });
    room.nda = { mode: room.nda.mode, title, text, version, templateId: room.nda.templateId || '' };
    record(room, at, 'nda_text', '', '', { version, title, by });
    logIt(ws, room, 'NDA changed', room.id, `version ${room.ndaVersions.length}`, by);
    return room;
  }

  /* ---------- Documents: added, hidden, never removed ---------- */
  const shown = (room) => room.docs.filter((d) => !d.hiddenAt);
  function addDoc(ws, roomId, opts) {
    const o = opts || {};
    const room = roomOf(ws, roomId);
    const by = str(o.by);
    if (!by) fail('Name the person adding the document.');
    const fileName = str(o.fileName);
    if (!fileName) fail('Choose the document file.');
    if (o.type !== 'application/pdf') fail('Data room documents are PDF files.');
    if (!whole(o.size)) fail('The document size is missing.');
    if (o.size > RULES.MAX_BYTES) fail(`${fileName} is larger than 25 MB.`);
    if (shown(room).length >= RULES.MAX_DOCS) fail('A data room shows at most 30 documents.');
    const digest = String(o.sha256 || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(digest)) fail('The document fingerprint (SHA-256) is missing.');
    if (o.pages != null && !whole(o.pages)) fail('The page count is a whole number.');
    let id = str(o.id);
    if (id) {
      if (!/^[\w-]{1,120}$/.test(id)) fail('The document id is not valid.');
      if (ensure(ws).some((r) => r.docs.some((d) => d.id === id))) fail('This document is already in a data room.');
    } else id = nextId(ws, 'rd-', (r) => r.docs);
    const at = when(o.at);
    const doc = { id, title: str(o.title) || fileName, fileName, type: 'application/pdf', size: o.size, sha256: digest, pages: o.pages == null ? 0 : o.pages, addedAt: at, addedBy: by, hiddenAt: '', hiddenBy: '', hiddenWhy: '' };
    room.docs.push(doc);
    record(room, at, 'doc_added', '', id, { title: doc.title, fileName, size: doc.size, sha256: digest, pages: doc.pages, by });
    logIt(ws, room, 'Document added', id, `room ${room.id}; ${doc.pages} pages`, by);
    return doc;
  }
  function hideDoc(ws, roomId, docId, opts) {
    const o = opts || {};
    const room = roomOf(ws, roomId);
    const doc = room.docs.find((d) => d.id === docId);
    if (!doc) fail('No such document in this data room.');
    if (doc.hiddenAt) fail('This document is already hidden.');
    const by = str(o.by);
    if (!by) fail('Name the person hiding the document.');
    const at = when(o.at);
    doc.hiddenAt = at;
    doc.hiddenBy = by;
    doc.hiddenWhy = str(o.why);
    record(room, at, 'doc_hidden', '', docId, { by, why: doc.hiddenWhy });
    logIt(ws, room, 'Document hidden', docId, `room ${room.id}`, by);
    return doc;
  }

  /* ---------- Prospects ---------- */
  function basisOf(room, b, by, at) {
    const x = b && typeof b === 'object' ? b : null;
    if (room.regime === '506b') {
      const kind = x && x.kind;
      const bad =
        !x ||
        KINDS.indexOf(kind) < 0 ||
        !isDay(x.since) ||
        x.enough !== true ||
        (kind === 'introduced' && !str(x.introducedBy)) ||
        (kind === 'other' && !str(x.note));
      if (bad) fail(S506B);
    }
    if (!x) return null;
    return { kind: str(x.kind) || 'other', since: str(x.since), introducedBy: str(x.introducedBy), note: str(x.note), enough: x.enough === true, recordedBy: by, at };
  }
  function newProspect(ws, room, name, email, basis, days, at, by) {
    return {
      id: nextId(ws, 'pr-', (r) => r.prospects),
      name,
      email,
      basis,
      invitedAt: at,
      invitedBy: by,
      expiresAt: plus(at, days),
      endedAt: '',
      endedBy: '',
      assents: [],
      views: [],
      interest: [],
      subscribeInvitedAt: ''
    };
  }
  function checkPerson(room, name, email, days) {
    if (!name) fail("Type the prospect's name.");
    if (!isEmail(email)) fail('Enter a valid email address.');
    if (room.prospects.some((p) => p.email.toLowerCase() === email.toLowerCase())) fail('This email already has access to this data room.');
    if (!(whole(days) && days >= 1 && days <= 3650)) fail('Access lasts a whole number of days, from 1 to 3650.');
  }
  function addProspect(ws, roomId, opts) {
    const o = opts || {};
    const room = roomOf(ws, roomId);
    const by = str(o.by);
    if (!by) fail('Name the person inviting the prospect.');
    const name = str(o.name);
    const email = str(o.email);
    const days = o.days == null || o.days === '' ? RULES.DAYS : Number(o.days);
    checkPerson(room, name, email, days);
    const at = when(o.at);
    const basis = basisOf(room, o.basis, by, at);
    const warning = room.regime === '506b' && basis && basis.since >= room.openedAt.slice(0, 10) ? LATE : '';
    const p = newProspect(ws, room, name, email, basis, days, at, by);
    room.prospects.push(p);
    record(room, at, 'prospect_invited', p.id, '', { name, email, basis, expiresAt: p.expiresAt, by });
    logIt(ws, room, 'Prospect invited', p.id, `room ${room.id}; basis ${basis ? basis.kind : 'none'}${warning ? '; relationship dated on or after the room opened' : ''}`, by);
    return { prospect: p, warning };
  }
  function setOpenLink(ws, roomId, on, opts) {
    const o = opts || {};
    const room = roomOf(ws, roomId);
    if (room.regime === '506b') fail('A 506(b) room has personal links only.');
    const by = str(o.by);
    if (!by) fail('Name the person changing the link.');
    const at = when(o.at);
    room.openLink = on === true;
    record(room, at, 'link', '', '', { on: room.openLink, by });
    return room;
  }
  function joinOpen(ws, roomId, opts) {
    const o = opts || {};
    const room = roomOf(ws, roomId);
    if (room.regime === '506b' || !room.openLink) fail('This room has no open link.');
    const name = str(o.name);
    const email = str(o.email);
    const days = o.days == null || o.days === '' ? RULES.DAYS : Number(o.days);
    checkPerson(room, name, email, days);
    const at = when(o.at);
    const basis = { kind: 'open' };
    const p = newProspect(ws, room, name, email, basis, days, at, '');
    room.prospects.push(p);
    record(room, at, 'prospect_invited', p.id, '', { name, email, basis, expiresAt: p.expiresAt, by: '' });
    logIt(ws, room, 'Prospect invited', p.id, `room ${room.id}; open link`, `Prospect ${p.id}`);
    return p;
  }
  function endAccess(ws, roomId, prospectId, opts) {
    const o = opts || {};
    const room = roomOf(ws, roomId);
    const p = prospectOf(room, prospectId);
    if (p.endedAt) fail("This prospect's access has already ended.");
    const by = str(o.by);
    if (!by) fail('Name the person ending the access.');
    const at = when(o.at);
    p.endedAt = at;
    p.endedBy = by;
    record(room, at, 'prospect_ended', p.id, '', { by });
    logIt(ws, room, 'Prospect access ended', p.id, `room ${room.id}`, by);
    return p;
  }
  function access(ws, roomId, prospectId, at) {
    const room = ensure(ws).find((r) => r.id === roomId);
    const p = room && room.prospects.find((x) => x.id === prospectId);
    if (!p || p.endedAt || Date.parse(when(at)) >= Date.parse(p.expiresAt)) return { ok: false, reason: GONE };
    return { ok: true };
  }
  function mustAccess(ws, roomId, prospectId, at) {
    const a = access(ws, roomId, prospectId, at);
    if (!a.ok) fail(a.reason);
  }

  /* ---------- The NDA agreed ---------- */
  function agreed(room, prospect) {
    const last = prospect && prospect.assents && prospect.assents[prospect.assents.length - 1];
    return !!(room && last && last.version === room.nda.version);
  }
  function agree(ws, roomId, prospectId, opts) {
    const o = opts || {};
    const room = roomOf(ws, roomId);
    const p = prospectOf(room, prospectId);
    const at = when(o.at);
    mustAccess(ws, roomId, prospectId, at);
    if (o.ticked !== true) fail('Tick the box to agree.');
    const name = str(o.name);
    if (!name) fail('Type your full name.');
    const a = { version: room.nda.version, mode: room.nda.mode, name, email: p.email, at, ip: str(o.ip), agent: str(o.agent), envelopeId: str(o.envelopeId) };
    p.assents.push(a);
    record(room, at, 'assent', p.id, '', { version: a.version, mode: a.mode, name, email: a.email, ip: a.ip, agent: a.agent, envelopeId: a.envelopeId });
    logIt(ws, room, 'NDA accepted', p.id, `room ${room.id}; version ${room.ndaVersions.length}`, `Prospect ${p.id}`);
    return a;
  }
  function docsFor(ws, roomId, prospectId, at) {
    const room = ensure(ws).find((r) => r.id === roomId);
    const p = room && room.prospects.find((x) => x.id === prospectId);
    if (!p || !access(ws, roomId, prospectId, at).ok || !agreed(room, p)) return [];
    return shown(room);
  }

  /* ---------- Views (kept on the room only) ---------- */
  function view(ws, roomId, prospectId, opts) {
    const o = opts || {};
    const room = roomOf(ws, roomId);
    const p = prospectOf(room, prospectId);
    const at = when(o.at);
    mustAccess(ws, roomId, prospectId, at);
    if (!agreed(room, p)) fail('Agree to the NDA first.');
    const doc = room.docs.find((d) => d.id === o.docId);
    if (!doc || doc.hiddenAt) fail('This document is not available.');
    const seconds = o.seconds == null ? 0 : o.seconds;
    const pages = o.pages == null ? 0 : o.pages;
    if (!whole(seconds) || !whole(pages)) fail('Seconds and pages are whole numbers.');
    const how = o.how == null || o.how === '' ? 'page' : o.how;
    if (how !== 'page' && how !== 'served') fail('A view is either in the page or served.');
    const viewId = str(o.viewId) || sha([room.id, p.id, doc.id, at, p.views.length].join('|')).slice(0, 10);
    const v = { docId: doc.id, at, seconds, pages, viewId, how };
    p.views.push(v);
    record(room, at, 'view', p.id, doc.id, { seconds, pages, viewId, how });
    return v;
  }
  function viewsOf(room) {
    const out = [];
    const by = new Map();
    (room.prospects || []).forEach((p) =>
      (p.views || []).forEach((v) => {
        const k = `${p.id}|${v.docId}`;
        let t = by.get(k);
        if (!t) {
          t = { prospectId: p.id, docId: v.docId, opens: 0, first: v.at, last: v.at, seconds: 0, pages: 0 };
          by.set(k, t);
          out.push(t);
        }
        t.opens++;
        if (v.at < t.first) t.first = v.at;
        if (v.at > t.last) t.last = v.at;
        t.seconds += v.seconds;
        t.pages = Math.max(t.pages, v.pages);
      })
    );
    return out;
  }

  /* ---------- Indications of interest: never a subscription ---------- */
  function screened(note) {
    if (NS.inbox && typeof NS.inbox.screen === 'function') return !!NS.inbox.screen(note, 'party');
    return PATTERNS.some((re) => re.test(note));
  }
  function current(prospect) {
    const list = (prospect && prospect.interest) || [];
    const last = list[list.length - 1];
    return last && last.kind !== 'withdrawn' ? last : null;
  }
  function indicate(ws, roomId, prospectId, opts) {
    const o = opts || {};
    if (Object.keys(o).some((k) => ['kind', 'cents', 'cls', 'note', 'at'].indexOf(k) < 0)) fail('Only an amount, a class and a note are recorded.');
    const room = roomOf(ws, roomId);
    const p = prospectOf(room, prospectId);
    const at = when(o.at);
    mustAccess(ws, roomId, prospectId, at);
    if (!agreed(room, p)) fail('Agree to the NDA first.');
    const had = current(p);
    const kind = o.kind == null || o.kind === '' ? (had ? 'changed' : 'indicated') : o.kind;
    if (['indicated', 'changed', 'withdrawn'].indexOf(kind) < 0) fail('An indication is made, changed or withdrawn.');
    if (kind === 'withdrawn' && !had) fail('There is no indication to withdraw.');
    const cents = o.cents == null || o.cents === '' ? null : o.cents;
    if (cents !== null && !whole(cents)) fail('Enter the amount as a whole number of cents, or leave it blank.');
    const note = String(o.note == null ? '' : o.note).trim();
    if (note.length > RULES.NOTE_MAX) fail('Keep the note to 500 characters.');
    if (note && screened(note)) fail('Bank and taxpayer numbers are not asked for here.');
    const cls = str(o.cls).slice(0, 80);
    const i = kind === 'withdrawn' ? { at, kind, cents: null, cls: '', note } : { at, kind, cents, cls, note };
    p.interest.push(i);
    record(room, at, 'interest', p.id, '', { kind: i.kind, cents: i.cents, cls: i.cls, note: i.note });
    logIt(ws, room, 'Indication of interest recorded', p.id, `room ${room.id}; ${kind}`, `Prospect ${p.id}`);
    return i;
  }
  /** The indications on an offering's rooms, kept apart from capital raised: it reads ws.rooms only. */
  function pipeline(ws, offeringId) {
    let prospects = 0;
    let indicated = 0;
    let cents = 0;
    ensure(ws)
      .filter((r) => r.offeringId === offeringId)
      .forEach((r) =>
        r.prospects.forEach((p) => {
          prospects++;
          const c = current(p);
          if (c) {
            indicated++;
            cents += c.cents || 0;
          }
        })
      );
    return { prospects, indicated, cents };
  }

  /* ---------- Invite to subscribe: the existing invitation form ---------- */
  function inviteDraft(ws, roomId, prospectId) {
    const room = roomOf(ws, roomId);
    const p = prospectOf(room, prospectId);
    const words = p.name.split(/\s+/).filter(Boolean);
    const c = current(p);
    const amount = c && c.cents != null ? (c.cents % 100 ? (c.cents / 100).toFixed(2) : String(c.cents / 100)) : '';
    return { first: words[0] || '', last: words.slice(1).join(' '), name: p.name, email: p.email, type: 'individual', account: '', offeringId: room.offeringId, amount, cls: (c && c.cls) || '', note: '', errors: {}, busy: false };
  }
  function markSubscribeInvited(ws, roomId, prospectId, opts) {
    const o = opts || {};
    const room = roomOf(ws, roomId);
    const p = prospectOf(room, prospectId);
    const by = str(o.by);
    if (!by) fail('Name the person sending the invitation.');
    const at = when(o.at);
    p.subscribeInvitedAt = at;
    record(room, at, 'subscribe_invited', p.id, '', { by });
    logIt(ws, room, 'Invited to subscribe', p.id, `room ${room.id}`, by);
    return p;
  }

  /* ---------- The record: the chain, and the fields beside it equal to what it records ---------- */
  function replay(room) {
    const E = { ndaVersions: [], openLink: false, docs: [], prospects: [] };
    const doc = (id) => E.docs.find((d) => d.id === id);
    const pro = (id) => E.prospects.find((p) => p.id === id);
    room.events.forEach((e) => {
      const d = e.data || {};
      const p = e.prospectId ? pro(e.prospectId) : null;
      switch (e.kind) {
        case 'opened':
          E.room = { offeringId: d.offeringId, regime: d.regime, openedAt: e.at, openedBy: d.by, download: d.download };
          E.ndaVersions.push({ version: d.version, title: d.title, at: e.at, by: d.by });
          break;
        case 'nda_text':
          E.ndaVersions.push({ version: d.version, title: d.title, at: e.at, by: d.by });
          break;
        case 'doc_added':
          E.docs.push({ id: e.docId, title: d.title, fileName: d.fileName, type: 'application/pdf', size: d.size, sha256: d.sha256, pages: d.pages, addedAt: e.at, addedBy: d.by, hiddenAt: '', hiddenBy: '', hiddenWhy: '' });
          break;
        case 'doc_hidden':
          if (doc(e.docId)) Object.assign(doc(e.docId), { hiddenAt: e.at, hiddenBy: d.by, hiddenWhy: d.why });
          break;
        case 'prospect_invited':
          E.prospects.push({ id: e.prospectId, name: d.name, email: d.email, basis: d.basis, invitedAt: e.at, invitedBy: d.by, expiresAt: d.expiresAt, endedAt: '', endedBy: '', assents: [], views: [], interest: [], subscribeInvitedAt: '' });
          break;
        case 'prospect_ended':
          if (p) Object.assign(p, { endedAt: e.at, endedBy: d.by });
          break;
        case 'link':
          E.openLink = d.on === true;
          break;
        case 'assent':
          if (p) p.assents.push({ version: d.version, mode: d.mode, name: d.name, email: d.email, at: e.at, ip: d.ip, agent: d.agent, envelopeId: d.envelopeId });
          break;
        case 'view':
          if (p) p.views.push({ docId: e.docId, at: e.at, seconds: d.seconds, pages: d.pages, viewId: d.viewId, how: d.how });
          break;
        case 'interest':
          if (p) p.interest.push({ at: e.at, kind: d.kind, cents: d.cents, cls: d.cls, note: d.note });
          break;
        case 'subscribe_invited':
          if (p) p.subscribeInvitedAt = e.at;
          break;
        default:
          E.unknown = E.unknown || e.seq;
      }
    });
    return E;
  }
  const same = (a, b, keys) => keys.every((k) => JSON.stringify(a == null ? null : a[k]) === JSON.stringify(b == null ? null : b[k]));
  const DOC_KEYS = ['id', 'title', 'fileName', 'type', 'size', 'sha256', 'pages', 'addedAt', 'addedBy', 'hiddenAt', 'hiddenBy', 'hiddenWhy'];
  const P_KEYS = ['id', 'name', 'email', 'basis', 'invitedAt', 'invitedBy', 'expiresAt', 'endedAt', 'endedBy', 'subscribeInvitedAt'];
  const LISTS = {
    assents: ['version', 'mode', 'name', 'email', 'at', 'ip', 'agent', 'envelopeId'],
    views: ['docId', 'at', 'seconds', 'pages', 'viewId', 'how'],
    interest: ['at', 'kind', 'cents', 'cls', 'note']
  };
  const sameList = (a, b, keys) => (a || []).length === (b || []).length && (a || []).every((x, i) => same(x, b[i], keys));
  function verify(ws, roomId) {
    const room = roomOf(ws, roomId);
    const list = room.events || [];
    let prev = GENESIS;
    for (let n = 0; n < list.length; n++) {
      const e = list[n];
      if (e.seq !== n + 1 || e.prev !== prev || sha(eventText(prev, e)) !== e.hash) return { ok: false, brokenAt: n + 1, reason: `Entry ${n + 1} of the room's record does not match its hash.` };
      prev = e.hash;
    }
    const bad = (reason) => ({ ok: false, brokenAt: 0, reason });
    const E = replay(room);
    if (!list.length || list[0].kind !== 'opened' || !E.room) return bad("The room's record does not start with its opening.");
    if (E.unknown) return bad(`Entry ${E.unknown} of the room's record is of an unknown kind.`);
    if (!same(room, E.room, ['offeringId', 'regime', 'openedAt', 'openedBy', 'download'])) return bad("The room's opening details differ from the record.");
    if (room.openLink !== E.openLink) return bad("The room's open link differs from the record.");
    const nv = room.ndaVersions || [];
    if (nv.length !== E.ndaVersions.length || nv.some((v, i) => !same(v, E.ndaVersions[i], ['version', 'title', 'at', 'by']) || sha(String(v.text)) !== v.version))
      return bad('The NDA versions differ from the record.');
    const lastV = nv[nv.length - 1];
    if (!room.nda || room.nda.version !== lastV.version || room.nda.text !== lastV.text) return bad('The NDA in use is not the latest recorded version.');
    if (room.docs.length !== E.docs.length) return bad('The documents differ from the record.');
    for (let i = 0; i < room.docs.length; i++) if (!same(room.docs[i], E.docs[i], DOC_KEYS)) return bad(`Document ${room.docs[i].id} differs from the record.`);
    if (room.prospects.length !== E.prospects.length) return bad('The prospects differ from the record.');
    for (let i = 0; i < room.prospects.length; i++) {
      const p = room.prospects[i];
      const q = E.prospects[i];
      if (!same(p, q, P_KEYS)) return bad(`Prospect ${p.id} differs from the record.`);
      for (const k of Object.keys(LISTS)) if (!sameList(p[k], q[k], LISTS[k])) return bad(`The ${k} of ${p.id} differ from the record.`);
    }
    return { ok: true, events: list.length };
  }

  /* ---------- The room's record as one zip (MS-08) ---------- */
  function csv(head, rows) {
    const cell = (v) => {
      if (v == null) return '';
      if (typeof v === 'number') return String(v);
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + [head].concat(rows).map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  const units = (c) => (c == null ? '' : c % 100 ? (c / 100).toFixed(2) : String(c / 100));
  const slug = (s) => String(s || '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const safeName = (s) => String(s || 'document.pdf').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_');
  async function roomRecord(ws, roomId, getBytes) {
    const room = roomOf(ws, roomId);
    const off = (ws.offerings || []).find((o) => o.id === room.offeringId) || { name: room.offeringId };
    const chain = verify(ws, roomId);
    const enc = (s) => new TextEncoder().encode(s);
    const files = [];
    const P = room.prospects;
    files.push({
      name: 'prospects.csv',
      data: csv(
        ['id', 'name', 'email', 'basis kind', 'since', 'introduced by', 'note', 'recorded by', 'recorded at', 'invited', 'expires', 'ended'],
        P.map((p) => {
          const b = p.basis || {};
          return [p.id, p.name, p.email, b.kind || '', b.since || '', b.introducedBy || '', b.note || '', b.recordedBy || '', b.at || '', p.invitedAt, p.expiresAt, p.endedAt];
        })
      )
    });
    files.push({
      name: 'nda.csv',
      data: csv(['prospect', 'name typed', 'email', 'version', 'mode', 'at', 'address', 'browser', 'envelope'], [].concat(...P.map((p) => p.assents.map((a) => [p.id, a.name, a.email, a.version, a.mode, a.at, a.ip, a.agent, a.envelopeId]))))
    });
    files.push({ name: 'views.csv', data: csv(['prospect', 'document', 'at', 'seconds', 'pages', 'view id', 'how'], [].concat(...P.map((p) => p.views.map((v) => [p.id, v.docId, v.at, v.seconds, v.pages, v.viewId, v.how])))) });
    files.push({ name: 'interest.csv', data: csv(['prospect', 'at', 'kind', 'amount', 'class', 'note'], [].concat(...P.map((p) => p.interest.map((i) => [p.id, i.at, i.kind, units(i.cents), i.cls, i.note])))) });
    files.push({
      name: 'documents.csv',
      data: csv(['id', 'title', 'file', 'size', 'sha256', 'pages', 'added', 'hidden at', 'hidden by', 'why'], room.docs.map((d) => [d.id, d.title, d.fileName, d.size, d.sha256, d.pages, d.addedAt, d.hiddenAt, d.hiddenBy, d.hiddenWhy]))
    });
    files.push({ name: 'events.csv', data: csv(['seq', 'at', 'kind', 'prospect', 'doc', 'data', 'previous_hash', 'hash'], room.events.map((e) => [e.seq, e.at, e.kind, e.prospectId, e.docId, JSON.stringify(e.data), e.prev, e.hash])) });
    room.ndaVersions.forEach((v) => files.push({ name: `nda/${v.version}.txt`, data: v.text }));
    let added = 0;
    for (const d of room.docs) {
      const b = getBytes ? await getBytes(d.id, d) : null;
      if (b && typeof b.length === 'number') {
        files.push({ name: `documents/${d.id}-${safeName(d.fileName)}`, data: b });
        added++;
      }
    }
    const chainLine = chain.ok ? `Chain verified (${chain.events} events).` : chain.brokenAt ? `Chain broken at entry ${chain.brokenAt}.` : `Record check failed: ${chain.reason}`;
    const readme = [
      `Data room record: ${off.name}`,
      `Firm: ${(ws.tenant && ws.tenant.name) || ''}`,
      `Room ${room.id}, opened ${room.openedAt} by ${room.openedBy}; exemption ${room.regime}; download ${room.download}.`,
      `Prospects: ${P.length}. NDA versions: ${room.ndaVersions.length}. Documents: ${room.docs.length} (${room.docs.filter((d) => d.hiddenAt).length} hidden; ${added} files included). Events: ${room.events.length}.`,
      chainLine,
      KEPT,
      '',
      'prospects.csv, nda.csv, views.csv, interest.csv, documents.csv: the room as recorded.',
      "events.csv: the room's record, each entry hashed with the one before (SHA-256).",
      'nda/<version>.txt: every NDA text, named by its SHA-256. documents/: the documents as uploaded.',
      'MANIFEST.sha256: the SHA-256 of every other file in this zip.',
      'Indications of interest are not subscriptions and are not counted in capital raised.'
    ].join('\r\n') + '\r\n';
    files.push({ name: 'README.txt', data: readme });
    const data = files.map((f) => ({ name: f.name, data: typeof f.data === 'string' ? enc(f.data) : f.data }));
    data.push({ name: 'MANIFEST.sha256', data: enc(data.map((f) => `${sha(f.data)}  ${f.name}`).join('\n') + '\n') });
    const bytes = NS.audit.zip(data, new Date());
    const hash = sha(bytes);
    const name = `${slug(ws.tenant && ws.tenant.shortName) || 'Firm'}_${slug(off.shortName || off.name)}_data_room_record_${now().slice(0, 10)}.zip`;
    logIt(ws, room, 'Data room record exported', room.id, `${data.length} files; ${room.events.length} events; SHA-256 ${hash}`);
    return { name, bytes, hash, files: data.map((f) => ({ name: f.name, size: f.data.length })), chain };
  }

  NS.dataroom = {
    RULES,
    GENESIS,
    ensure,
    allowed,
    open,
    setNda,
    addDoc,
    hideDoc,
    addProspect,
    setOpenLink,
    joinOpen,
    endAccess,
    access,
    agree,
    agreed,
    docsFor,
    view,
    viewsOf,
    indicate,
    current,
    pipeline,
    inviteDraft,
    markSubscribeInvited,
    verify,
    roomRecord,
    eventText
  };
})(window.CVPortal);
