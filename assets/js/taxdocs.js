/*
 * Tax documents the sponsor's CPA prepared (Schedule K-1 and the like): a combined file's pages are cut into one package
 * per K-1, an investor is proposed for each by one written rule, a person confirms every match, and each confirmed
 * document is carried through delivery, consent, paper, amendment, withdrawal and opens.
 *
 * The rule this file exists for: nothing is delivered unconfirmed. A K-1 that reaches the wrong investor is a disclosure
 * of someone's tax data, so a proposal is only a convenience and `deliver` refuses a document no person confirmed.
 *
 * Taxpayer numbers: a number read from a page never leaves the reading functions. They return its last four digits and
 * nothing longer; nothing longer is stored or written to the change log.
 *
 * This file works on plain data only. It touches no document, window or screen when it loads, so it also loads outside
 * a browser (the checks, and module.exports under Node). It builds no HTML: every string it returns is plain text.
 * It reads pages that carry text. A scanned file (pictures of pages) is not read here and is never guessed at.
 */
(function (NS) {
  'use strict';

  const KINDS = {
    'k1-1065': { label: 'Schedule K-1 (Form 1065)', auto: true, access: 'k1' },
    'k1-other': { label: 'Schedule K-1 (other)', access: 'k1' },
    8805: { label: 'Form 8805', access: 'k1' },
    '1042-s': { label: 'Form 1042-S', access: 'oct15' },
    '1099-int': { label: 'Form 1099-INT', access: 'oct15' },
    '1099-div': { label: 'Form 1099-DIV', access: 'oct15' },
    letter: { label: 'Tax letter', access: 'k1' }
  };
  // Rev. Proc. 2012-17 section 7.01: these words, in capital letters, on the notice (the subject line of an email).
  const NOTICE_SUBJECT = 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE';
  const CONSENT = { version: '2026-11-19' };

  function refuse(msg) {
    throw new Error(msg);
  }

  /* ---------- dates (calendar dates as YYYY-MM-DD; a tax year is a calendar year) ---------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayOf = (at) => String(at || '').slice(0, 10);
  const stamp = (at) => at || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const iso = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  /** The same day n months later; the last day of that month when it has no such day (August 31 gives February 29). */
  function addMonths(day, n) {
    const [y, m, d] = dayOf(day).split('-').map(Number);
    const k = y * 12 + (m - 1) + n;
    const yy = Math.floor(k / 12);
    const mm = (k % 12) + 1;
    return iso(yy, mm, Math.min(d, daysIn(yy, mm)));
  }
  const later = (a, b) => (a > b ? a : b);
  /**
   * The day a delivered document may leave the portal. Schedule K-1 (Rev. Proc. 2012-17 section 9): twelve months after
   * the tax year ends or six months after it was issued, whichever is later. Forms 1099 and 1042-S: 15 October of the
   * year after the tax year, and never less than six months after it was issued.
   */
  function availableUntil(kind, year, issuedOn) {
    const K = KINDS[kind] || refuse('Unknown kind of tax document.');
    const y = Number(year);
    return later(K.access === 'oct15' ? iso(y + 1, 10, 15) : iso(y + 1, 12, 31), addMonths(issuedOn, 6));
  }

  /* ---------- reading a page ---------- */
  // Anything printed in the shape of a taxpayer number, whole or with its first five characters masked.
  const MASK = '[*#xX\\u2022]';
  const SHAPES = ['\\d{3}[- ]\\d{2}[- ]\\d{4}', '\\d{2}-\\d{7}', '\\d{9}', `${MASK}{3}[- ]?${MASK}{2}[- ]?\\d{4}`, `${MASK}{2}[- ]?${MASK}{3}[- ]?\\d{4}`];
  const EDGE = '0-9A-Za-z*#\\u2022-';
  const numberRe = () => new RegExp(`(^|[^${EDGE}])(${SHAPES.join('|')})(?![${EDGE}])`, 'g');
  /** The last four digits of every number-shaped piece of a text. Nothing longer than four characters is returned. */
  function lastFours(text) {
    const out = [];
    String(text == null ? '' : text).replace(numberRe(), (all, lead, number) => {
      out.push(number.replace(/\D/g, '').slice(-4));
      return all;
    });
    return out;
  }
  /**
   * The last four digits of the one number a text holds: a number of nine digits, or one printed with its first five
   * masked. '' when there is none, or more than one. Never more than four characters.
   */
  function last4(text) {
    const set = Array.from(new Set(lastFours(text)));
    return set.length === 1 && /^\d{4}$/.test(set[0]) ? set[0] : '';
  }
  /** A text with every number-shaped piece and every run of five or more digits taken out. */
  function clean(text) {
    return String(text == null ? '' : text)
      .replace(numberRe(), '$1 ')
      .replace(/\d{5,}/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
  const STOP = /^(llc|lp|inc|co|the|of|fbo|ttee|jr|sr)$/;
  /** A name's words: lower case, no accents or punctuation, without the words that do not tell two names apart. */
  function words(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w && !STOP.test(w));
  }

  /** Items sorted into lines of text, top to bottom. An item whose text has line breaks (a field) gives several lines. */
  function linesOf(items) {
    const flat = [];
    (items || []).forEach((it) => {
      const parts = String(it.s == null ? '' : it.s).split(/\r?\n/);
      const step = parts.length > 1 ? Math.max(0.01, (it.bottom - it.top) / parts.length) : 0;
      parts.forEach((s, k) => {
        if (s.trim()) flat.push({ s, x: it.x, w: parts.length > 1 ? 0 : it.w || 0, top: it.top + k * step, own: parts.length > 1 });
      });
    });
    flat.sort((a, b) => a.top - b.top || a.x - b.x);
    const lines = [];
    flat.forEach((it) => {
      const cur = lines[lines.length - 1];
      if (cur && !it.own && !cur.own && Math.abs(it.top - cur.top) < 3) cur.items.push(it);
      else lines.push({ top: it.top, own: it.own, items: [it] });
    });
    return lines.map((l) => {
      l.items.sort((a, b) => a.x - b.x);
      return l.items
        .reduce((s, it, k) => s + (k && !(l.items[k - 1].w && it.x - (l.items[k - 1].x + l.items[k - 1].w) < 1) ? ' ' : '') + it.s, '')
        .replace(/\s+/g, ' ')
        .trim();
    });
  }
  /**
   * What the portal's PDF reader returns for one page, as the items pageFacts takes: text items and the values of text
   * fields, each { s, x, w, top, bottom } in points from the top left. height is the page's height in points.
   */
  function pdfItems(height, textItems, annotations) {
    const text = (textItems || []).filter((it) => it && it.str && it.str.trim()).map((it) => ({ s: it.str, x: it.transform[4], w: it.width || 0, top: height - it.transform[5] - (it.height || 0), bottom: height - it.transform[5] }));
    const fields = (annotations || []).filter((a) => a && a.subtype === 'Widget' && a.fieldType === 'Tx' && a.fieldValue && a.rect).map((a) => ({ s: String(a.fieldValue), x: a.rect[0], w: 0, top: height - a.rect[3], bottom: height - a.rect[1] }));
    return { text, fields };
  }

  const LABEL = {
    A: /Partnership.s employer identification number/,
    B: /Partnership.s name, address/,
    E: /Partner.s SSN or TIN/,
    F: /Name, address, city, state, and ZIP code for partner/,
    G: /General partner or LLC/
  };
  /**
   * The facts of one page. A Schedule K-1 (Form 1065) first page carries the code 651123, "Schedule K-1", "Form 1065"
   * and "Information About the Partner"; on it, item E is what lies between its label and item F's label, item F between
   * its label and item G's, both in the left half of the page.
   *
   * Returns { first, last4, numberSeen, name, chars } and never the text of an item: last4 is the last four digits of
   * item E, numberSeen says item E holds a digit or a masking character at all, name is the first line of item F with
   * anything number-like taken out.
   */
  function pageFacts(textItems) {
    const items = (textItems || []).filter((it) => it && it.s != null && String(it.s).trim());
    const all = items.map((it) => it.s).join(' ');
    const out = { first: false, last4: '', numberSeen: false, name: '', chars: all.replace(/\s+/g, '').length };
    out.first = /651123/.test(all) && /Schedule\s+K-1/.test(all) && /Form\s+1065/.test(all) && /Information About the Partner\b/.test(all);
    if (!out.first) return out;
    const label = (re) => items.find((it) => re.test(it.s));
    const between = (a, b) => (a && b ? items.filter((it) => it !== a && it !== b && it.x < 300 && it.top >= a.bottom - 2 && it.bottom <= b.top + 3) : []);
    const itemE = linesOf(between(label(LABEL.E), label(LABEL.F))).join(' ');
    out.last4 = last4(itemE);
    out.numberSeen = /[0-9*#•]|[xX]{2}/.test(itemE);
    out.name = clean(linesOf(between(label(LABEL.F), label(LABEL.G)))[0] || '');
    return out;
  }

  /**
   * Pages (pageFacts results, in order) cut into packages: each runs from a K-1 first page to the page before the next
   * one. Pages before the first K-1 belong to no one. Page numbers count from 1.
   */
  function split(pages) {
    const list = pages || [];
    const firsts = [];
    list.forEach((p, i) => {
      if (p && p.first) firsts.push(i);
    });
    const packages = firsts.map((i, k) => {
      const end = (k + 1 < firsts.length ? firsts[k + 1] : list.length) - 1;
      return { first: i + 1, last: end + 1, last4: list[i].last4 || '', numberSeen: !!list[i].numberSeen, name: list[i].name || '' };
    });
    const loose = [];
    for (let n = 0; n < (firsts.length ? firsts[0] : list.length); n++) loose.push(n + 1);
    return { packages, loose, scan: false };
  }

  /* ---------- the workspace's records ---------- */
  const log = (ws, e) => (NS && NS.audit && NS.audit.log ? NS.audit.log(ws, e) : null);
  // Ids carry letters only, so no id can ever look like a number.
  let serial = 0;
  function letters(n) {
    let s = '';
    do {
      s = String.fromCharCode(97 + (n % 26)) + s;
      n = Math.floor(n / 26);
    } while (n > 0);
    return s;
  }
  const newId = (prefix) => `${prefix}-${letters(Date.now())}${letters(serial++)}`;

  function ensure(ws) {
    if (!ws.taxdocs || typeof ws.taxdocs !== 'object') ws.taxdocs = { v: 1, contact: { name: '', address: '', phone: '', email: '' }, batches: [] };
    const t = ws.taxdocs;
    if (!t.contact || typeof t.contact !== 'object') t.contact = { name: '', address: '', phone: '', email: '' };
    if (!Array.isArray(t.batches)) t.batches = [];
    if (!Array.isArray(ws.docs)) ws.docs = [];
    return t;
  }
  const CONTACT_PARTS = ['name', 'address', 'phone', 'email'];
  /** The person or department investors write to about tax documents (Rev. Proc. 2012-17 section 5.05). */
  function setContact(ws, patch) {
    const c = ensure(ws).contact;
    CONTACT_PARTS.forEach((k) => {
      if (patch && patch[k] != null) c[k] = String(patch[k]).trim();
    });
    log(ws, { action: 'Tax document contact changed', record: 'tax documents', detail: CONTACT_PARTS.filter((k) => c[k]).join(', ') || 'emptied' });
    return c;
  }
  const missingContact = (ws) => CONTACT_PARTS.filter((k) => !ensure(ws).contact[k]);

  const investorOf = (ws, id) => (ws.investors || []).find((i) => i.id === id) || null;
  const holds = (inv, offeringId) => !!inv && (inv.positions || []).some((p) => p.offeringId === offeringId);
  const batchOf = (ws, id) => ensure(ws).batches.find((b) => b.id === id) || refuse('That file is not in this workspace.');
  const pkgOf = (batch, id) => batch.packages.find((p) => p.id === id) || refuse('That package is not in this file.');
  const docOf = (ws, id) => {
    const d = (ws.docs || []).find((x) => x.id === id);
    return d && d.tax ? d : refuse('That tax document is not in this workspace.');
  };
  const pagesText = (p) => (p.first === p.last ? `page ${p.first}` : `pages ${p.first} to ${p.last}`);
  const nameOf = (ws, id) => {
    const i = investorOf(ws, id);
    return i ? `${i.title} (${i.id})` : id;
  };

  /** A combined file taken into the workspace: its packages, all open, none matched to anyone yet. */
  function addBatch(ws, a) {
    ensure(ws);
    const K = KINDS[a.kind] || refuse('Unknown kind of tax document.');
    if (!/^\d{4}$/.test(String(a.year))) refuse('The tax year must be four digits.');
    if (!a.offeringId) refuse('Choose the offering this file belongs to.');
    if (!a.by) refuse('The person adding the file must be named.');
    const at = stamp(a.at);
    const s = a.split || { packages: [], loose: [], scan: false };
    const batch = { id: newId('tb'), kind: a.kind, year: String(a.year), offeringId: a.offeringId, fileName: clean(a.fileName), sourceSha256: String(a.sourceSha256 || ''), pages: Number(a.pages) || 0, at, by: a.by, scan: !!s.scan, loose: (s.loose || []).slice(), packages: [] };
    (K.auto ? s.packages || [] : []).forEach((p, k) => {
      batch.packages.push({ id: `${batch.id}-p${k + 1}`, first: p.first, last: p.last, last4: /^\d{4}$/.test(p.last4) ? p.last4 : '', numberSeen: !!p.numberSeen, name: clean(p.name), otherPartnership: false, proposed: { investorId: '', basis: '' }, investorId: '', basis: '', state: 'open', confirmedBy: '', confirmedAt: '', docId: '' });
    });
    ws.taxdocs.batches.push(batch);
    log(ws, { action: 'Tax document file added', fund: batch.offeringId, record: batch.id, actor: a.by, at, detail: `${K.label} ${batch.year}: ${batch.fileName}, ${batch.pages} pages, ${batch.packages.length} found; SHA-256 ${batch.sourceSha256}` });
    return batch;
  }

  /** A person confirms that a package is this investor's. Recorded with who, when and on what basis. */
  function confirm(ws, batchId, pkgId, a) {
    const batch = batchOf(ws, batchId);
    const pkg = pkgOf(batch, pkgId);
    if (pkg.state === 'confirmed') refuse('This package is already confirmed.');
    if (pkg.state !== 'open') refuse('This package was set aside. Bring it back before confirming it.');
    if (!a || !a.by) refuse('The person confirming must be named.');
    const inv = investorOf(ws, a.investorId);
    if (!holds(inv, batch.offeringId)) refuse('That investor does not hold this offering.');
    pkg.investorId = inv.id;
    pkg.basis = pkg.proposed.investorId === inv.id && pkg.proposed.basis ? pkg.proposed.basis : 'by hand';
    pkg.state = 'confirmed';
    pkg.confirmedBy = a.by;
    pkg.confirmedAt = stamp(a.at);
    log(ws, { action: 'Tax document match confirmed', fund: batch.offeringId, record: pkg.id, actor: a.by, at: pkg.confirmedAt, detail: `${KINDS[batch.kind].label} ${batch.year}, ${pagesText(pkg)} of ${batch.fileName}, for ${nameOf(ws, inv.id)}; basis: ${pkg.basis}; source SHA-256 ${batch.sourceSha256}` });
    return pkg;
  }

  function taxBlock(kind, year, match) {
    return { kind, year: String(year), batch: '', pkg: '', pages: [], sourceSha256: '', match, state: 'confirmed', replaces: '', deliveredAt: '', availableUntil: '', notice: null, opens: { first: '', last: '', count: 0 }, paper: null, withdrawn: null };
  }
  function docRecord(a, offeringId, investorId, year, at) {
    return { id: a.id, title: clean(a.title), fileName: clean(a.fileName), type: 'application/pdf', size: Number(a.size) || 0, sha256: String(a.sha256 || ''), cat: 'Tax', offeringId, audience: 'investors', investors: [investorId], date: dayOf(at), taxYear: String(year), publishedAt: '', publishedBy: '', hidden: true };
  }
  /** A confirmed package's own file becomes a document: hidden, for its one investor, not yet delivered. */
  function toDocument(ws, batchId, pkgId, a) {
    const batch = batchOf(ws, batchId);
    const pkg = pkgOf(batch, pkgId);
    if (pkg.state !== 'confirmed' || !pkg.confirmedBy || !pkg.confirmedAt || !pkg.investorId) refuse('Nobody has confirmed whose document this is.');
    if (pkg.docId) refuse('This package already has its document.');
    if (!a || !a.id) refuse('The document needs an id.');
    if ((ws.docs || []).some((d) => d.id === a.id)) refuse('A document with that id already exists.');
    const at = stamp(a.at);
    const doc = docRecord(a, batch.offeringId, pkg.investorId, batch.year, at);
    doc.tax = Object.assign(taxBlock(batch.kind, batch.year, { basis: pkg.basis, confirmedBy: pkg.confirmedBy, confirmedAt: pkg.confirmedAt }), { batch: batch.id, pkg: pkg.id, pages: [pkg.first, pkg.last], sourceSha256: batch.sourceSha256 });
    ws.docs.push(doc);
    pkg.docId = doc.id;
    log(ws, { action: 'Tax document made', fund: doc.offeringId, record: doc.id, actor: a.by || pkg.confirmedBy, at, detail: `${KINDS[batch.kind].label} ${batch.year} for ${nameOf(ws, pkg.investorId)}, ${pagesText(pkg)} of ${batch.fileName}; not delivered yet` });
    return doc;
  }

  /* ---------- consent (Rev. Proc. 2012-17 sections 4 and 5) ---------- */
  const consentText = (ws) => `Consent to receive tax documents electronically (version ${CONSENT.version}).`;
  /** Consent is in effect when it was given, has not been withdrawn and is of the current version. */
  function inEffect(investor) {
    const c = investor && investor.taxDelivery;
    return !!(c && c.at && !c.withdrawnAt && c.version === CONSENT.version);
  }
  /** The investor consents. Every document of theirs that was waiting for consent is delivered. */
  function consent(ws, investorId, a) {
    const inv = investorOf(ws, investorId) || refuse('That investor is not in this workspace.');
    if (missingContact(ws).length) refuse(`The firm's contact for tax documents is not complete (${missingContact(ws).join(', ')}).`);
    const at = stamp(a && a.at);
    inv.taxDelivery = { at, version: CONSENT.version, text: consentText(ws), where: a && a.where === 'link' ? 'link' : 'portal', withdrawnAt: '' };
    log(ws, { action: 'Tax document consent given', record: inv.id, actor: `${inv.title} (investor)`, at, detail: `Electronic delivery of tax documents, version ${CONSENT.version}, given in the ${inv.taxDelivery.where}` });
    return (ws.docs || []).filter((d) => d.tax && d.tax.state === 'waiting' && (d.investors || [])[0] === inv.id).map((d) => release(ws, d, at, d.tax.waitingBy || '', 'email'));
  }

  /* ---------- delivery ---------- */
  function release(ws, doc, at, by, how) {
    const t = doc.tax;
    t.state = 'delivered';
    t.deliveredAt = at;
    t.availableUntil = availableUntil(t.kind, t.year, dayOf(at));
    t.notice = { at, how, bounced: '', paperBy: '' };
    doc.hidden = false;
    doc.publishedAt = at;
    doc.publishedBy = by;
    log(ws, { action: 'Tax document delivered', fund: doc.offeringId, record: doc.id, actor: by || undefined, at, detail: `${KINDS[t.kind].label} ${t.year} to ${nameOf(ws, doc.investors[0])}; notice by ${how}; available until ${t.availableUntil}; match confirmed by ${t.match.confirmedBy} (${t.match.basis})` });
    return doc;
  }
  const HOWS = ['email', 'own email', 'paper'];
  /**
   * Deliver a confirmed document to its one investor. Refused when no person confirmed the match. With the investor's
   * consent in effect it is shown to them; without it, it waits, hidden, on the paper list.
   */
  function deliver(ws, docId, a) {
    const doc = docOf(ws, docId);
    const t = doc.tax;
    if (!t.match || !t.match.confirmedBy || !t.match.confirmedAt) refuse('Nobody has confirmed whose document this is. It cannot be delivered.');
    if (t.state !== 'confirmed' && t.state !== 'waiting') refuse('This document is not waiting to be delivered.');
    if (missingContact(ws).length) refuse(`The firm's contact for tax documents is not complete (${missingContact(ws).join(', ')}).`);
    if (!a || !a.by) refuse('The person delivering must be named.');
    if (HOWS.indexOf(a.how) < 0) refuse('Say how the investor is told: email, own email or paper.');
    const inv = investorOf(ws, (doc.investors || [])[0]) || refuse('The investor of this document is not in this workspace.');
    const at = stamp(a.at);
    if (inEffect(inv)) return release(ws, doc, at, a.by, a.how);
    t.state = 'waiting';
    t.waitingBy = a.by;
    doc.hidden = true;
    log(ws, { action: 'Tax document waiting for consent', fund: doc.offeringId, record: doc.id, actor: a.by, at, detail: `${KINDS[t.kind].label} ${t.year} for ${nameOf(ws, inv.id)}: no consent to electronic delivery in effect, so it is owed on paper` });
    return doc;
  }

  const API = { KINDS, NOTICE_SUBJECT, CONSENT, pdfItems, pageFacts, split, last4, ensure, setContact, addBatch, confirm, toDocument, inEffect, consent, deliver, availableUntil };
  if (NS) NS.taxdocs = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
