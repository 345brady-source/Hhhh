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
  /** The digits of every number-shaped piece of a text. Used inside this file only; never returned or stored. */
  function numberPieces(text) {
    const out = [];
    String(text == null ? '' : text).replace(numberRe(), (all, lead, number) => {
      out.push(number.replace(/\D/g, ''));
      return all;
    });
    return out;
  }
  /** The last four digits of every number-shaped piece of a text. Nothing longer than four characters is returned. */
  const lastFours = (text) => numberPieces(text).map((d) => d.slice(-4));
  /** Ids and marks carry letters only, so none can ever look like a number. */
  function letters(n) {
    let s = '';
    do {
      s = String.fromCharCode(97 + (n % 26)) + s;
      n = Math.floor(n / 26);
    } while (n > 0);
    return s;
  }
  // A mark tells two numbers apart without keeping either. It is salted afresh each time this file loads, so a mark
  // cannot be worked back to its number by trying every number; marks are compared within one reading and never stored.
  const SALT = `${Math.random()}|${Date.now()}`;
  function mark(digits) {
    const s = `${SALT}|${digits}`;
    let h1 = 0x811c9dc5;
    let h2 = 0x9747b28c;
    for (let k = 0; k < s.length; k++) {
      const c = s.charCodeAt(k);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
    }
    return letters(h1) + letters(h2);
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
  // A page with fewer characters of text than this is taken for a picture of a page.
  const MIN_TEXT = 40;
  /**
   * The facts of one page, from its text items and the values of its form fields together. A Schedule K-1 (Form 1065)
   * first page carries the code 651123, "Schedule K-1", "Form 1065" and "Information About the Partner"; on it, item E
   * is what lies between its label and item F's label, item F between its label and item G's, item A between its label
   * and item B's, all in the left half of the page. The codes of other K-1s (661117, 671124) are not matched.
   *
   * Returns { first, last4, numberSeen, name, partnership, chars, numbers, lines } and never the text of an item:
   * last4 is the last four digits of item E; numberSeen says item E holds a digit or a masking character at all; name is
   * the first line of item F with anything number-like taken out; partnership is a mark of item A's number (see mark).
   * On any other page, numbers holds { last4, mark } for each number-shaped piece and lines the words of each line with
   * anything number-like taken out: what the split needs to say a package has a page someone should look at.
   */
  function pageFacts(textItems, fieldItems) {
    const items = [].concat(textItems || [], fieldItems || []).filter((it) => it && it.s != null && String(it.s).trim());
    const all = items.map((it) => it.s).join(' ');
    const out = { first: false, last4: '', numberSeen: false, name: '', partnership: '', chars: all.replace(/\s+/g, '').length, numbers: [], lines: [] };
    out.first = /651123/.test(all) && /Schedule\s+K-1/.test(all) && /Form\s+1065/.test(all) && /Information About the Partner\b/.test(all);
    if (!out.first) {
      const lines = linesOf(items);
      out.numbers = numberPieces(lines.join('\n')).map((d) => ({ last4: d.slice(-4), mark: mark(d) }));
      out.lines = lines.map((l) => words(clean(l))).filter((w) => w.length);
      return out;
    }
    const label = (re) => items.find((it) => re.test(it.s));
    const between = (a, b) => (a && b ? items.filter((it) => it !== a && it !== b && it.x < 300 && it.top >= a.bottom - 2 && it.bottom <= b.top + 3) : []);
    const itemE = linesOf(between(label(LABEL.E), label(LABEL.F))).join(' ');
    out.last4 = last4(itemE);
    out.numberSeen = /[0-9*#•]|[xX]{2}/.test(itemE);
    out.name = clean(linesOf(between(label(LABEL.F), label(LABEL.G)))[0] || '');
    const a = numberPieces(linesOf(between(label(LABEL.A), label(LABEL.B))).join(' '));
    out.partnership = a.length ? mark(a[0]) : '';
    return out;
  }

  /** One plain sentence for a file whose pages are pictures. */
  const SCAN_TEXT = 'This file is a scan: its pages are pictures with no text to read, so no K-1 is found in it. Give each investor their pages by hand.';
  /**
   * Pages (pageFacts results, in order) cut into packages: each runs from a K-1 first page to the page before the next
   * one. Pages before the first K-1 belong to no one. Page numbers count from 1. A file in which no page has text is a
   * scan: nothing is cut or proposed.
   *
   * A package is marked to be looked at (look, with lookWhy: { page, why }) when a page after its K-1 page has no text
   * ('no text': a picture, perhaps of another partner's K-1) or carries a number whose last four are not the package's
   * own and that is not the partnership's ('another number'). The test for another holder's name ('another name') needs
   * the investors, so it is made when the file is taken in (addBatch); `later` carries those pages' words for it and is
   * never stored.
   */
  function split(pages) {
    const list = pages || [];
    const scan = list.length > 0 && list.every((p) => !p || (p.chars || 0) < MIN_TEXT);
    const firsts = [];
    if (!scan) {
      list.forEach((p, i) => {
        if (p && p.first) firsts.push(i);
      });
    }
    const packages = firsts.map((i, k) => {
      const end = (k + 1 < firsts.length ? firsts[k + 1] : list.length) - 1;
      const f = list[i];
      const lookWhy = [];
      const later = [];
      for (let n = i + 1; n <= end; n++) {
        const p = list[n] || {};
        if ((p.chars || 0) < MIN_TEXT) lookWhy.push({ page: n + 1, why: 'no text' });
        else if ((p.numbers || []).some((x) => !(f.partnership && x.mark === f.partnership) && x.last4 !== (f.last4 || ''))) lookWhy.push({ page: n + 1, why: 'another number' });
        else later.push({ page: n + 1, lines: p.lines || [] });
      }
      return { first: i + 1, last: end + 1, last4: f.last4 || '', numberSeen: !!f.numberSeen, name: f.name || '', partnership: f.partnership || '', look: lookWhy.length > 0, lookWhy, later };
    });
    const loose = [];
    for (let n = 0; n < (firsts.length ? firsts[0] : list.length); n++) loose.push(n + 1);
    return { packages, loose, scan };
  }

  /* ---------- the proposal (the one rule) ---------- */
  const holdersOf = (investors, offeringId) => (investors || []).filter((inv) => inv && (inv.positions || []).some((p) => p.offeringId === offeringId));
  // The last four on record: from the investor's Form W-9 when there is one, else as entered. Never a foreign number.
  const recordLast4 = (inv) => {
    const v = String((inv.taxCert && inv.taxCert.tinLast4) || inv.tinLast4 || '');
    return /^\d{4}$/.test(v) ? v : '';
  };
  const sameSet = (a, b) => a.length > 0 && b.length > 0 && a.every((w) => b.indexOf(w) >= 0) && b.every((w) => a.indexOf(w) >= 0);
  const within = (part, whole) => part.length > 0 && part.every((w) => whole.indexOf(w) >= 0);
  const namesOf = (inv) => [words(inv.title), words(inv.contact)].filter((w) => w.length);
  /**
   * Among the investors holding the offering (redeemed or not): N, those whose last four on record equal the package's;
   * M, those whose account title or contact name has the same words as the first line of item F. Exactly one in both:
   * 'number and name'. Otherwise exactly one in N and none in M: 'number only'. Otherwise, when no number is printed at
   * all, exactly one in M: 'name only'. Anything else: no proposal. A printed number that cannot be read, or that is
   * read and fits nobody, never lets the name decide alone.
   */
  function propose(pkg, investors, offeringId) {
    const none = { investorId: '', basis: '' };
    if (!pkg) return none;
    const holders = holdersOf(investors, offeringId);
    const own = words(pkg.name);
    const N = pkg.last4 ? holders.filter((inv) => recordLast4(inv) === pkg.last4) : [];
    const M = own.length ? holders.filter((inv) => namesOf(inv).some((w) => sameSet(w, own))) : [];
    const both = N.filter((inv) => M.indexOf(inv) >= 0);
    if (both.length === 1) return { investorId: both[0].id, basis: 'number and name' };
    if (N.length === 1 && M.length === 0) return { investorId: N[0].id, basis: 'number only' };
    if (!pkg.last4 && !pkg.numberSeen && M.length === 1) return { investorId: M[0].id, basis: 'name only' };
    return none;
  }
  /** Pages after the K-1 page that carry the name of a holder other than the proposed one and not part of the package's own name. */
  function otherNames(pkg, holders, proposedId) {
    const own = words(pkg.name);
    const others = holders.filter((inv) => inv.id !== proposedId).map(namesOf).reduce((a, b) => a.concat(b), []).filter((w) => !within(w, own));
    return (pkg.later || []).filter((pg) => (pg.lines || []).some((line) => others.some((w) => within(w, line)))).map((pg) => ({ page: pg.page, why: 'another name' }));
  }

  /* ---------- the workspace's records ---------- */
  const log = (ws, e) => (NS && NS.audit && NS.audit.log ? NS.audit.log(ws, e) : null);
  let serial = 0;
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

  /** The pages of a file that belong to no package (a package set aside gives its pages back). */
  function looseOf(batch) {
    const used = {};
    batch.packages.forEach((p) => {
      if (p.state !== 'aside') for (let n = p.first; n <= p.last; n++) used[n] = true;
    });
    const out = [];
    for (let n = 1; n <= batch.pages; n++) if (!used[n]) out.push(n);
    return out;
  }
  const overlaps = (batch, first, last, except) => batch.packages.some((p) => p !== except && p.state !== 'aside' && p.first <= last && first <= p.last);
  function newPackage(batch, p) {
    return { id: `${batch.id}-p${batch.packages.length + 1}`, first: p.first, last: p.last, last4: /^\d{4}$/.test(p.last4 || '') ? p.last4 : '', numberSeen: !!p.numberSeen, name: clean(p.name), otherPartnership: false, look: false, lookWhy: [], proposed: { investorId: '', basis: '' }, investorId: '', basis: '', state: 'open', confirmedBy: '', confirmedAt: '', docId: '' };
  }

  /**
   * A combined file taken into the workspace: its packages, all open, each with the investor the rule proposes (if
   * any), none matched to anyone yet. Only a Schedule K-1 (Form 1065) file is cut and proposed; any other kind, and a
   * scan, is taken in whole and its packages are made by hand (addPackage).
   */
  function addBatch(ws, a) {
    ensure(ws);
    const K = KINDS[a.kind] || refuse('Unknown kind of tax document.');
    if (!/^\d{4}$/.test(String(a.year))) refuse('The tax year must be four digits.');
    if (!a.offeringId) refuse('Choose the offering this file belongs to.');
    if (!a.by) refuse('The person adding the file must be named.');
    const at = stamp(a.at);
    const s = a.split || { packages: [], loose: [], scan: false };
    const found = K.auto && !s.scan ? s.packages || [] : [];
    const top = found.reduce((m, p) => Math.max(m, p.last || 0), (s.loose || []).reduce((m, n) => Math.max(m, n), 0));
    const batch = { id: newId('tb'), kind: a.kind, year: String(a.year), offeringId: a.offeringId, fileName: clean(a.fileName), sourceSha256: String(a.sourceSha256 || ''), pages: Number(a.pages) || top, at, by: a.by, scan: !!s.scan, loose: [], packages: [] };
    const holders = holdersOf(ws.investors, batch.offeringId);
    // The partnership most packages name; a package naming another one is marked (its K-1 may be in the wrong file).
    const count = {};
    found.forEach((p) => {
      if (p.partnership) count[p.partnership] = (count[p.partnership] || 0) + 1;
    });
    const most = Math.max(0, ...Object.values(count));
    const common = Object.keys(count).filter((k) => count[k] === most);
    found.forEach((p) => {
      const pkg = newPackage(batch, p);
      pkg.proposed = propose(pkg, ws.investors, batch.offeringId);
      pkg.otherPartnership = !!p.partnership && (common.length !== 1 || p.partnership !== common[0]);
      pkg.lookWhy = (p.lookWhy || []).map((w) => ({ page: w.page, why: w.why })).concat(otherNames(Object.assign({}, p, { name: pkg.name }), holders, pkg.proposed.investorId)).sort((x, y) => x.page - y.page);
      pkg.look = pkg.lookWhy.length > 0;
      batch.packages.push(pkg);
    });
    batch.loose = looseOf(batch);
    ws.taxdocs.batches.push(batch);
    const proposed = batch.packages.filter((p) => p.proposed.investorId).length;
    log(ws, { action: 'Tax document file added', fund: batch.offeringId, record: batch.id, actor: a.by, at, detail: `${K.label} ${batch.year}: ${batch.fileName}, ${batch.pages} pages, ${batch.packages.length} found, ${proposed} with a proposed investor${batch.scan ? '; a scan, nothing read' : ''}; SHA-256 ${batch.sourceSha256}` });
    return batch;
  }

  /**
   * A package made by hand from a page range of the file. It is open. It has no proposal, unless the page names the
   * investor whose account id is in the file's name (proposeId): proposed on 'account ID in the file name' when that
   * investor holds the offering, and confirmed one at a time like every package that is not 'number and name'.
   */
  function addPackage(ws, batchId, a) {
    const batch = batchOf(ws, batchId);
    const first = Number(a && a.first);
    const last = Number(a && a.last);
    if (!Number.isInteger(first) || !Number.isInteger(last)) refuse('Give the first and last page as whole page numbers.');
    if (first < 1 || last > batch.pages || first > last) refuse(`The pages must run forwards within the file's ${batch.pages} pages.`);
    if (overlaps(batch, first, last)) refuse('Those pages are already in another package.');
    const pkg = newPackage(batch, { first, last });
    if (a && a.proposeId && holds(investorOf(ws, a.proposeId), batch.offeringId)) pkg.proposed = { investorId: a.proposeId, basis: 'account ID in the file name' };
    batch.packages.push(pkg);
    batch.loose = looseOf(batch);
    log(ws, { action: 'Tax document package made by hand', fund: batch.offeringId, record: pkg.id, actor: (a && a.by) || undefined, at: a && a.at ? a.at : undefined, detail: `${pagesText(pkg)} of ${batch.fileName}; source SHA-256 ${batch.sourceSha256}` });
    return pkg;
  }
  /** An open package is put aside (not anyone's); its pages belong to no one again. */
  function setAside(ws, batchId, pkgId, a) {
    const batch = batchOf(ws, batchId);
    const pkg = pkgOf(batch, pkgId);
    if (pkg.state !== 'open') refuse('Only an open package can be set aside.');
    pkg.state = 'aside';
    batch.loose = looseOf(batch);
    log(ws, { action: 'Tax document package set aside', fund: batch.offeringId, record: pkg.id, actor: (a && a.by) || undefined, at: a && a.at ? a.at : undefined, detail: `${pagesText(pkg)} of ${batch.fileName}` });
    return pkg;
  }
  /** "Not this one": an open package leaves the together list and is confirmed one at a time (who and when kept). */
  function notTogether(ws, batchId, pkgId, a) {
    const batch = batchOf(ws, batchId);
    const pkg = pkgOf(batch, pkgId);
    if (pkg.state !== 'open') refuse('Only an open package can be taken out of the list.');
    if (!a || !a.by) refuse('The person taking it out must be named.');
    Object.assign(pkg, { single: true, singleBy: a.by, singleAt: stamp(a.at) });
    log(ws, { action: 'Tax document package taken out of confirm together', fund: batch.offeringId, record: pkg.id, actor: a.by, at: pkg.singleAt, detail: `${pagesText(pkg)} of ${batch.fileName}; to be confirmed on its own` });
    return pkg;
  }
  /**
   * A package set aside, or confirmed with no document made yet, is open again; a "Not this one" mark is cleared. Refused when its pages are now in
   * another package, or when its document exists.
   */
  function reopen(ws, batchId, pkgId, a) {
    const batch = batchOf(ws, batchId);
    const pkg = pkgOf(batch, pkgId);
    if (pkg.docId) refuse('This package already has its document.');
    if (pkg.state === 'aside' && overlaps(batch, pkg.first, pkg.last, pkg)) refuse('Its pages are now in another package.');
    if (pkg.state !== 'aside' && pkg.state !== 'confirmed') refuse('This package is already open.');
    const was = pkg.state === 'confirmed' ? `confirmed for ${nameOf(ws, pkg.investorId)}` : 'set aside';
    Object.assign(pkg, { state: 'open', investorId: '', basis: '', confirmedBy: '', confirmedAt: '', single: false, singleBy: '', singleAt: '' });
    batch.loose = looseOf(batch);
    log(ws, { action: 'Tax document package opened again', fund: batch.offeringId, record: pkg.id, actor: (a && a.by) || undefined, at: a && a.at ? a.at : undefined, detail: `${pagesText(pkg)} of ${batch.fileName}; it was ${was}` });
    return pkg;
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
    log(ws, { action: 'Tax document match confirmed', fund: batch.offeringId, record: pkg.id, actor: a.by, at: pkg.confirmedAt, detail: `${KINDS[batch.kind].label} ${batch.year}, ${pagesText(pkg)} of ${batch.fileName}, for ${nameOf(ws, inv.id)}; basis: ${pkg.basis}${a.together ? ' (confirmed together)' : ''}; source SHA-256 ${batch.sourceSha256}` });
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

  /* ---------- documents made by the portal itself ---------- */
  /**
   * A document the portal made for one investor from figures a person confirmed (the Form 1099 recipient copies of
   * plans 10-10 and 10-11). Refused without the person who confirmed. It is confirmed and hidden, like a confirmed
   * package's document, and goes through delivery by the same functions.
   */
  function addGenerated(ws, a) {
    ensure(ws);
    if (!a) refuse('Nothing to add.');
    if (!KINDS[a.kind]) refuse('Unknown kind of tax document.');
    if (!/^\d{4}$/.test(String(a.year))) refuse('The tax year must be four digits.');
    if (!a.confirmedBy) refuse('The person who confirmed the figures must be named.');
    const inv = investorOf(ws, a.investorId);
    if (!holds(inv, a.offeringId)) refuse('That investor does not hold this offering.');
    if (!a.id) refuse('The document needs an id.');
    if (ws.docs.some((d) => d.id === a.id)) refuse('A document with that id already exists.');
    const at = stamp(a.confirmedAt);
    const doc = docRecord(a, a.offeringId, inv.id, a.year, at);
    doc.tax = taxBlock(a.kind, a.year, { basis: 'made for this investor', confirmedBy: a.confirmedBy, confirmedAt: at });
    ws.docs.push(doc);
    log(ws, { action: 'Tax document made', fund: doc.offeringId, record: doc.id, actor: a.confirmedBy, at, detail: `${KINDS[a.kind].label} ${doc.tax.year} for ${nameOf(ws, inv.id)}, made by the portal from figures confirmed by ${a.confirmedBy}; not delivered yet` });
    return doc;
  }

  /* ---------- confirming together (C-06) ---------- */
  // A document counts for its investor, offering, kind and year in these states (withdrawn and replaced ones do not).
  const LIVE = ['confirmed', 'waiting', 'delivered', 'paper'];
  // ...and has been given to the investor (or is owed to them) in these.
  const GIVEN = ['waiting', 'delivered', 'paper'];
  const sameSlot = (d, investorId, offeringId, kind, year) => d.tax && (d.investors || [])[0] === investorId && d.offeringId === offeringId && d.tax.kind === kind && d.tax.year === String(year);
  const docsIn = (ws, states, investorId, offeringId, kind, year) => (ws.docs || []).filter((d) => sameSlot(d, investorId, offeringId, kind, year) && states.indexOf(d.tax.state) >= 0);
  /**
   * The open packages of a file that may be confirmed in one step: proposed on 'number and name' and nobody needs to look
   * at them: not taken out by "Not this one" (single), not marked (look), not of another partnership, its investor proposed for no other package of the file, with
   * no live document of that kind and year and no package confirmed for them in another file. confirmTogether confirms
   * exactly these, and the page draws its together list from this alone.
   */
  function togetherIds(ws, batchId) {
    const batch = batchOf(ws, batchId);
    const proposedFor = {};
    batch.packages.forEach((p) => {
      if (p.proposed.investorId) proposedFor[p.proposed.investorId] = (proposedFor[p.proposed.investorId] || 0) + 1;
    });
    const confirmedIn = (id) => ensure(ws).batches.some((b) => b.offeringId === batch.offeringId && b.kind === batch.kind && b.year === batch.year && b.packages.some((p) => p.state === 'confirmed' && !p.docId && p.investorId === id));
    return batch.packages
      .filter((p) => {
        const id = p.proposed.investorId;
        return p.state === 'open' && id && !p.single && p.proposed.basis === 'number and name' && !p.look && !p.otherPartnership && proposedFor[id] === 1 && !docsIn(ws, LIVE, id, batch.offeringId, batch.kind, batch.year).length && !confirmedIn(id);
      })
      .map((p) => p.id);
  }
  /** Confirm every package of togetherIds in one step; every other package stays open. Returns the number confirmed. */
  function confirmTogether(ws, batchId, a) {
    const batch = batchOf(ws, batchId);
    if (!a || !a.by) refuse('The person confirming must be named.');
    const at = stamp(a.at);
    const ids = togetherIds(ws, batchId);
    ids.forEach((id) => confirm(ws, batchId, id, { investorId: pkgOf(batch, id).proposed.investorId, by: a.by, at, together: true }));
    return ids.length;
  }

  /* ---------- consent (Rev. Proc. 2012-17 sections 4 and 5) ---------- */
  /**
   * The disclosure shown with the consent: how to open and print a document (section 5.01), then one entry for each of
   * sections 5.02 to 5.08, in that order. Nothing else. Choices made here: one consent covers every kind of tax
   * document; asking for a paper copy does not withdraw it; a withdrawal takes effect the day it is received.
   */
  CONSENT.lines = function (contact) {
    const c = contact || {};
    const who = `${c.name || ''}, ${c.address || ''}, telephone ${c.phone || ''}, email ${c.email || ''}`;
    return [
      { rule: '5.01', text: 'Your tax documents are posted on the Documents page of this portal. Tap a document to open it, and use Download to save or print it.' },
      { rule: '5.02', text: 'If you do not consent, your tax documents will be sent to you on paper.' },
      { rule: '5.03', text: 'This consent covers every tax document we furnish to you, such as Schedules K-1, Forms 1099 and 1042-S and tax letters, from today until you withdraw it.' },
      { rule: '5.04', text: 'You can ask for a paper copy of any tax document at any time by writing to the contact below. Asking for a paper copy does not withdraw this consent.' },
      { rule: '5.05', text: `You can withdraw this consent at any time by writing, by email or on paper, to ${who}. A withdrawal takes effect on the day we receive it, we will confirm it and that date to you in writing, and documents delivered electronically before that day stay delivered.` },
      { rule: '5.06', text: 'We will stop delivering tax documents electronically if you withdraw this consent, if you no longer hold an interest in any of our offerings, or if we stop offering electronic delivery, and you will then receive them on paper.' },
      { rule: '5.07', text: 'To update your email address or other contact details, change them on your Account page or write to the contact above. We will tell you if our contact details change.' },
      { rule: '5.08', text: 'You need a device with a current web browser to open tax documents and a PDF reader to print and keep them; each document shows the date it leaves the portal, which for a Schedule K-1 is at least twelve months after the end of its tax year or six months after it was posted, whichever is later, and for Forms 1099 and 1042-S at least 15 October of the following year. A tax document may have to be printed and attached to a federal, state or local income tax return.' }
    ];
  };
  const consentText = (ws) => CONSENT.lines(ensure(ws).contact).map((l) => l.text).join('\n\n');
  /** Consent is in effect when it was given, has not been withdrawn and is of the current version. */
  function inEffect(investor) {
    const c = investor && investor.taxDelivery;
    return !!(c && c.at && !c.withdrawnAt && c.version === CONSENT.version);
  }
  /** The investor consents, to the full text shown. Every document of theirs that was waiting for consent is delivered. */
  function consent(ws, investorId, a) {
    const inv = investorOf(ws, investorId) || refuse('That investor is not in this workspace.');
    if (missingContact(ws).length) refuse(`The firm's contact for tax documents is not complete (${missingContact(ws).join(', ')}).`);
    const at = stamp(a && a.at);
    inv.taxDelivery = { at, version: CONSENT.version, text: consentText(ws), where: a && a.where === 'link' ? 'link' : 'portal', withdrawnAt: '' };
    log(ws, { action: 'Tax document consent given', record: inv.id, actor: `${inv.title} (investor)`, at, detail: `Electronic delivery of tax documents, version ${CONSENT.version}, given in the ${inv.taxDelivery.where}` });
    return (ws.docs || []).filter((d) => d.tax && d.tax.state === 'waiting' && (d.investors || [])[0] === inv.id).map((d) => release(ws, d, at, d.tax.waitingBy || '', d.tax.waitingHow || 'email'));
  }
  /**
   * The investor withdraws consent. It takes effect the day it is made (section 4.02). Documents delivered before stay
   * delivered (section 5.05(4)); the next delivery waits for paper. withdrawalConfirmed is for the written confirmation
   * section 5.05(3) requires (plan 10-06 fills it).
   */
  function withdrawConsent(ws, investorId, a) {
    const inv = investorOf(ws, investorId) || refuse('That investor is not in this workspace.');
    const c = inv.taxDelivery;
    if (!c || !c.at || c.withdrawnAt) refuse('There is no consent in effect to withdraw.');
    c.withdrawnAt = stamp(a && a.at);
    c.withdrawalConfirmed = { at: '', how: '' };
    // Made in the portal, the withdrawal is confirmed there in writing with its date (section 5.05(3)).
    if (a && a.where === 'portal') c.withdrawalConfirmed = { at: c.withdrawnAt, how: 'portal' };
    log(ws, { action: 'Tax document consent withdrawn', record: inv.id, actor: (a && a.by) || `${inv.title} (investor)`, at: c.withdrawnAt, detail: `Electronic delivery of tax documents withdrawn, effective ${dayOf(c.withdrawnAt)}; later tax documents are owed on paper` });
    return inv;
  }

  /* ---------- delivery ---------- */
  function addDays(day, n) {
    const [y, m, d] = dayOf(day).split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  function release(ws, doc, at, by, how) {
    const t = doc.tax;
    t.state = 'delivered';
    t.deliveredAt = at;
    t.availableUntil = availableUntil(t.kind, t.year, dayOf(at));
    t.notice = { at, how, bounced: '', paperBy: '' };
    doc.hidden = false;
    doc.publishedAt = at;
    doc.publishedBy = by;
    log(ws, { action: 'Tax document delivered', fund: doc.offeringId, record: doc.id, actor: by || undefined, at, detail: `${KINDS[t.kind].label} ${t.year} to ${nameOf(ws, doc.investors[0])}; notice by ${how}; available until ${t.availableUntil}; match confirmed by ${t.match.confirmedBy} (${t.match.basis})${t.replaces ? `; replaces ${t.replaces}` : ''}` });
    return doc;
  }
  const HOWS = ['email', 'own email', 'paper'];
  /**
   * Deliver a confirmed document to its one investor. Refused when no person confirmed the match, when the firm's
   * contact is incomplete, and when the investor already has a document for that offering, kind and year unless
   * `replaces` names it (an amended document replaces the earlier one; C-09: a delivered earlier one stays beside it,
   * marked replaced, until its own access period ends: see replaceEarlier). With the investor's consent in effect it is
   * shown to them; without it, it waits, hidden, on the paper list.
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
    const earlier = docsIn(ws, GIVEN, inv.id, doc.offeringId, t.kind, t.year).filter((d) => d !== doc);
    let old = null;
    if (a.replaces) old = earlier.find((d) => d.id === a.replaces) || refuse('The document it replaces must be the one this investor has now for the same offering, kind and year.');
    else if (earlier.length) refuse(`${inv.title} already has a ${KINDS[t.kind].label} for ${t.year}. Say which document this one replaces.`);
    const at = stamp(a.at);
    if (old) {
      replaceEarlier(old, doc, at);
      t.replaces = old.id;
      log(ws, { action: 'Tax document replaced', fund: old.offeringId, record: old.id, actor: a.by, at, detail: `${KINDS[t.kind].label} ${t.year} for ${nameOf(ws, inv.id)} replaced by ${doc.id}; ${old.hidden ? 'it was never shown to the investor' : `it stays in the investor's list, marked replaced, until ${old.tax.availableUntil}`}; it keeps its record of opens` });
    }
    if (inEffect(inv)) return release(ws, doc, at, a.by, a.how);
    t.state = 'waiting';
    t.waitingBy = a.by;
    t.waitingHow = a.how;
    doc.hidden = true;
    log(ws, { action: 'Tax document waiting for consent', fund: doc.offeringId, record: doc.id, actor: a.by, at, detail: `${KINDS[t.kind].label} ${t.year} for ${nameOf(ws, inv.id)}: no consent to electronic delivery in effect, so it is owed on paper` });
    return doc;
  }

  /** A document owed on paper is marked sent: one waiting for consent, or a delivered one whose notice came back. */
  function markPaper(ws, docId, a) {
    const doc = docOf(ws, docId);
    const t = doc.tax;
    if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(String(a.sentOn || ''))) refuse('Give the date it was sent on paper.');
    if (!a.by) refuse('The person who sent it must be named.');
    const bouncedOpen = t.state === 'delivered' && t.notice && t.notice.bounced && !t.paper;
    if (t.state !== 'waiting' && !bouncedOpen) refuse('This document is not owed on paper.');
    t.paper = { sentOn: a.sentOn, by: a.by };
    if (t.state === 'waiting') {
      t.state = 'paper';
      doc.hidden = true;
    }
    log(ws, { action: 'Tax document sent on paper', fund: doc.offeringId, record: doc.id, actor: a.by, at: stamp(a.at), detail: `${KINDS[t.kind].label} ${t.year} for ${nameOf(ws, doc.investors[0])} sent on paper on ${a.sentOn}${bouncedOpen ? ' after the notice came back' : ''}` });
    return doc;
  }
  /** The email notice of a delivered document came back: paper is due 30 calendar days later (section 7.02). */
  function bounced(ws, docId, date) {
    const doc = docOf(ws, docId);
    const t = doc.tax;
    if (t.state !== 'delivered' || !t.notice) refuse('Only the notice of a delivered document can come back.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) refuse('Give the date the notice came back.');
    t.notice.bounced = date;
    t.notice.paperBy = addDays(date, 30);
    t.paper = null;
    log(ws, { action: 'Tax document notice came back', fund: doc.offeringId, record: doc.id, at: stamp(), detail: `${KINDS[t.kind].label} ${t.year} for ${nameOf(ws, doc.investors[0])}: the notice came back on ${date}; a paper notice is due by ${t.notice.paperBy}` });
    return doc;
  }
  /** The sponsor takes a document back: it leaves the investor's list; its record, and its record of opens, stay. */
  function withdraw(ws, docId, a) {
    const doc = docOf(ws, docId);
    const t = doc.tax;
    if (['confirmed', 'waiting', 'delivered'].indexOf(t.state) < 0) refuse('This document cannot be withdrawn.');
    if (!a || !a.by) refuse('The person withdrawing it must be named.');
    if (!a.why || !String(a.why).trim()) refuse('Say why it is withdrawn.');
    const at = stamp(a.at);
    t.state = 'withdrawn';
    t.withdrawn = { at, by: a.by, why: String(a.why).trim() };
    doc.hidden = true;
    log(ws, { action: 'Tax document withdrawn', fund: doc.offeringId, record: doc.id, actor: a.by, at, detail: `${KINDS[t.kind].label} ${t.year} for ${nameOf(ws, doc.investors[0])} withdrawn: ${t.withdrawn.why}; opened ${t.opens.count} times` });
    return doc;
  }
  /** The investor opened a delivered document. Anything else (hidden, withdrawn, replaced) changes nothing. */
  function opened(ws, docId, at) {
    const doc = (ws.docs || []).find((d) => d.id === docId);
    if (!doc || !doc.tax || doc.hidden || (doc.tax.state !== 'delivered' && doc.tax.state !== 'replaced')) return doc || null;
    const o = doc.tax.opens;
    const when = stamp(at);
    if (!o.first) o.first = when;
    o.last = when;
    o.count += 1;
    const inv = investorOf(ws, doc.investors[0]);
    log(ws, { action: 'Tax document opened', fund: doc.offeringId, record: doc.id, actor: inv ? `${inv.title} (investor)` : undefined, at: when, detail: `${KINDS[doc.tax.kind].label} ${doc.tax.year}, open number ${o.count}` });
    return doc;
  }

  /** The notice of section 7.01: the required words as its subject; how to open and print; the firm's contact. */
  function notice(ws, doc) {
    const t = doc.tax;
    const c = ensure(ws).contact;
    const body = [
      `A tax document is available for you in the investor portal: ${KINDS[t.kind].label} for ${t.year}${t.replaces ? ', which replaces the one posted earlier' : ''}.`,
      'To open it, sign in, go to Documents and tap it. Use Download to save or print it.',
      t.availableUntil ? `It stays available in the portal until ${t.availableUntil}.` : '',
      `Questions: ${c.name}, ${c.address}, telephone ${c.phone}, email ${c.email}.`
    ].filter(Boolean);
    return { subject: NOTICE_SUBJECT, body: body.join('\n\n') };
  }

  /**
   * One offering's tax documents of a kind and year, sorted: packages open and set aside, documents confirmed and
   * delivered, documents owed on paper (waiting for consent, or delivered with a notice that came back; dueBy is the
   * date paper is due where the rule gives one), and the investors holding the offering with no live document.
   */
  function lists(ws, q) {
    const t = ensure(ws);
    const year = String(q.year);
    const batches = t.batches.filter((b) => b.offeringId === q.offeringId && b.kind === q.kind && b.year === year);
    const packages = (state) => batches.reduce((out, b) => out.concat(b.packages.filter((p) => p.state === state)), []);
    const docs = ws.docs.filter((d) => d.tax && d.offeringId === q.offeringId && d.tax.kind === q.kind && d.tax.year === year);
    const paper = [];
    docs.forEach((d) => {
      if (d.tax.state === 'waiting') {
        const c = (investorOf(ws, d.investors[0]) || {}).taxDelivery;
        paper.push({ doc: d, why: 'no consent', dueBy: c && c.withdrawnAt ? addDays(c.withdrawnAt, 30) : '' });
      } else if (d.tax.state === 'delivered' && d.tax.notice && d.tax.notice.bounced && !d.tax.paper) paper.push({ doc: d, why: 'notice came back', dueBy: d.tax.notice.paperBy });
    });
    const live = (id) => docs.some((d) => (d.investors || [])[0] === id && LIVE.indexOf(d.tax.state) >= 0);
    return {
      open: packages('open'),
      confirmed: docs.filter((d) => d.tax.state === 'confirmed'),
      delivered: docs.filter((d) => d.tax.state === 'delivered'),
      paper,
      missing: holdersOf(ws.investors, q.offeringId).filter((inv) => !live(inv.id)),
      aside: packages('aside'),
      replaced: docs.filter((d) => d.tax.state === 'replaced'),
      withdrawn: docs.filter((d) => d.tax.state === 'withdrawn')
    };
  }

  /* ---------- an amended document beside the earlier one (C-09, plan 10-06) ---------- */
  /**
   * Rev. Proc. 2012-17 section 9.01: a K-1 or amended K-1 furnished on a website stays there for its access period. The
   * earlier document is marked replaced (by which document, when) and its title says so; one that was delivered stays
   * in its investor's list until its own availableUntil, one that was never shown stays hidden.
   */
  function replaceEarlier(old, doc, at) {
    old.tax.state = 'replaced';
    old.tax.replacedBy = doc.id;
    old.tax.replacedAt = at;
    if (!old.tax.deliveredAt) old.hidden = true;
    if (!/\(replaced\)$/.test(old.title)) old.title = `${old.title} (replaced)`;
  }
  /**
   * A replaced document whose access period has ended (today is after its availableUntil) leaves its investor's list;
   * its record and its opens stay. Returns how many left. A current document is never taken away here.
   */
  function expire(ws, today) {
    const day = dayOf(today);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 0;
    let n = 0;
    (ws.docs || []).forEach((d) => {
      if (!d.tax || d.tax.state !== 'replaced' || d.hidden || !d.tax.availableUntil || !(day > d.tax.availableUntil)) return;
      d.hidden = true;
      n += 1;
      log(ws, { action: 'Tax document access period ended', fund: d.offeringId, record: d.id, at: stamp(), detail: `${KINDS[d.tax.kind].label} ${d.tax.year} for ${nameOf(ws, d.investors[0])}, replaced by ${d.tax.replacedBy}: available until ${d.tax.availableUntil}, so it leaves the investor's list; it keeps its record of opens` });
    });
    return n;
  }

  const API = { KINDS, NOTICE_SUBJECT, CONSENT, SCAN_TEXT, pdfItems, pageFacts, split, last4, propose, ensure, setContact, addBatch, addPackage, setAside, notTogether, reopen, confirm, togetherIds, confirmTogether, toDocument, addGenerated, inEffect, consent, withdrawConsent, deliver, markPaper, bounced, withdraw, opened, notice, lists, availableUntil, expire };
  if (NS) NS.taxdocs = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
