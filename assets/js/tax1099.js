/*
 * Form 1099-INT (plan 10-09, D-02): the figures, who is left out and why, where the portal must stop and name the CPA,
 * the recipient's number read from the signed W-9 and never kept (finding F-3, C-05), the recipient's Copy B, and the
 * rows of the IRS's upload file with every published rule checked (C-01). No screen (plan 10-10 shows it).
 *
 * Every figure comes from what the portal's own records prove:
 *   box 1 = the gross amounts stored on the investor's lines of interest payments paid in the calendar year
 *           (NS.data.paidLines, plan 10-01);
 *   box 4 = the backup withholding stored on the investor's lines in that year (NS.withholding.withheldFor, kind backup,
 *           plan 10-05; one definition), which the stop "backup-not-interest" keeps equal to the backup withholding on
 *           the form's own interest payments;
 *   every other box stays empty. The capital-account engine is never read and no share is worked out from positions
 *   (F-5).
 * Instructions for Forms 1099-INT and 1099-OID (Rev. January 2024): boxes 1 and 4, the $10 rule for interest on notes
 * in registered form or of a type offered to the public (any amount when backup withholding was taken), exempt
 * recipients; interest added to principal or notes issued at a discount are original issue discount (Form 1099-OID,
 * not prepared here). Publication 1099 (2026) part J: the name and number are the W-9's; the recipient's number may be
 * truncated on the recipient's copy, never on what goes to the IRS; the payer's number is never truncated.
 *
 * Stored (all additive):
 *   offering.tax.payer = { name, name2, address1, address2, city, state, zip, phone, tinLast4, registeredForm,
 *                          paidInMoney, confirmedBy, confirmedAt, setBy, setAt }       never a full taxpayer number
 *   offering.tax.years = { [year]: { confirmed: { [investorId]: { box1Cents, box4Cents, by, at } },
 *                                    copyB: { [investorId]: docId }, filed: [ { form, receiptId, date, sha256, rows, by, at } ] } }
 *   run.tax = { interest: boolean, by, at }       a person's answer for a payment whose type does not settle it
 * The payer and recipient objects the functions below take ({ tinType, tin, nameType, name, name2, first, middle, last,
 * suffix, country, address1, address2, city, state, zip, phone }) are built by the caller for one file or copy and
 * dropped. No function of this module stores or logs an object that carries a taxpayer number.
 *
 * Works on plain data only and needs nothing when it loads (module.exports under Node).
 */
(function (NS) {
  'use strict';

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const who = (by, what) => {
    if (typeof by !== 'string' || !by.trim()) throw new Error(`${what} needs the name of the person doing it.`);
    return by.trim();
  };
  const nowIso = () => new Date().toISOString();
  const log = (ws, e) => (NS && NS.audit && NS.audit.log ? NS.audit.log(ws, e) : null);
  const yearOf = (y) => {
    const s = String(y == null ? '' : y);
    if (!/^\d{4}$/.test(s)) throw new Error('A tax year is written YYYY.');
    return s;
  };
  const offeringOf = (ws, id) => {
    const o = ((ws && ws.offerings) || []).find((x) => x.id === id);
    if (!o) throw new Error('No offering with this id.');
    return o;
  };
  const W = () => NS.withholding;
  const D = () => NS.data;
  /** Whole cents as dollars with two decimals and no separator: 1333332 -> '13333.32'. */
  const dollars = (c) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
  /** Whole cents as dollars for a person to read: 1333332 -> '13,333.32'. */
  const money = (c) => `${String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(c % 100).padStart(2, '0')}`;
  const digitsOf = (s) => String(s == null ? '' : s).replace(/[\s-]/g, '');

  /* ---------- which payments are interest ---------- */
  const INTEREST_TYPES = ['Interest'];
  const NOT_INTEREST_TYPES = ['Principal', 'Return of capital'];
  /**
   * The offering's payments paid in the year (not cancelled, dated 1 January to 31 December and on or before today):
   * [ { run, counts: 'interest' | 'not-interest' | 'ask', why, stored } ]. A payment counts as interest only when its
   * type is Interest or a person has said so for it; Principal and Return of capital never count; any other type is
   * 'ask' until a person answers.
   */
  function interestRuns(ws, offering, year, today) {
    const y = yearOf(year);
    return (ws.runs || [])
      .filter((r) => r.offeringId === offering.id && r.date >= `${y}-01-01` && r.date <= `${y}-12-31` && D().runPaid(r, today))
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))
      .map((run) => {
        const type = String(run.type || '');
        const stored = D().runLines(ws, run).stored;
        if (INTEREST_TYPES.indexOf(type) >= 0) return { run, counts: 'interest', why: 'The payment type is Interest.', stored };
        if (NOT_INTEREST_TYPES.indexOf(type) >= 0) return { run, counts: 'not-interest', why: `The payment type is ${type}, which is never interest.`, stored };
        const t = run.tax && typeof run.tax.interest === 'boolean' ? run.tax : null;
        if (t) return { run, counts: t.interest ? 'interest' : 'not-interest', why: `${t.by} said this payment ${t.interest ? 'is' : 'is not'} interest.`, stored };
        return { run, counts: 'ask', why: `The payment type is ${type || 'not set'}; say whether this payment is interest.`, stored };
      });
  }

  /* ---------- the payer (never the full number) ---------- */
  const PAYER_TEXT = ['name', 'name2', 'address1', 'address2', 'city', 'state', 'zip', 'phone'];
  const PAYER_FLAGS = ['registeredForm', 'paidInMoney'];
  /** Change what is stored about the payer: text fields, the last four of its number, the two confirmations. */
  function setPayer(ws, offeringId, patch, opts) {
    opts = opts || {};
    patch = patch || {};
    const o = offeringOf(ws, offeringId);
    const by = who(opts.by, 'Changing the payer');
    const at = opts.at || nowIso();
    const next = Object.assign({}, (o.tax && o.tax.payer) || {});
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (PAYER_TEXT.indexOf(k) >= 0) {
        const s = String(v == null ? '' : v).trim();
        if (/\d{9}/.test(s.replace(/[\s-]/g, '')) && k !== 'phone') throw new Error('A taxpayer number is never stored; only its last four digits are.');
        next[k] = s;
      } else if (k === 'tinLast4') {
        const s = String(v == null ? '' : v);
        if (s && !/^\d{4}$/.test(s)) throw new Error('The last four digits of the payer’s taxpayer number are four digits.');
        next.tinLast4 = s;
      } else if (PAYER_FLAGS.indexOf(k) >= 0) {
        if (typeof v !== 'boolean') throw new Error(`${k} is yes or no.`);
        next[k] = v;
        next.confirmedBy = by;
        next.confirmedAt = at;
      } else throw new Error(`The payer has no field named "${k}"; a full taxpayer number is never stored.`);
    });
    next.setBy = by;
    next.setAt = at;
    o.tax = Object.assign({}, o.tax || {}, { payer: next });
    log(ws, { action: 'Payer for Form 1099 changed', record: o.id, fund: o.id, detail: `${o.shortName || o.name || o.id}: ${Object.keys(patch).join(', ')}`, actor: by });
    return next;
  }
  const payerOf = (offering) => (offering && offering.tax && offering.tax.payer) || {};

  /* ---------- the figures ---------- */
  /** The last four digits of the U.S. taxpayer number on record (taxCert first, then the record; never a foreign number). */
  function last4Of(i) {
    const c = i && i.taxCert && typeof i.taxCert === 'object' ? i.taxCert : {};
    const v = String(c.tinLast4 || (i && i.tinLast4) || '');
    return /^\d{4}$/.test(v) ? v : '';
  }
  /**
   * The forms of Form 1099-INT for an offering and year: { forms: [ { investorId, box1Cents, box4Cents, runIds } ],
   * leftOut: [ { investorId, code, reason, cents } ], stops: [ { code, text, runId } ], totalCents }. While any stop
   * stands, forms is empty. f: { today }.
   */
  const STOP_TEXT = {
    reporting: 'Form 1099-INT is prepared here only for a fund whose tax reporting type is notes; ask your CPA which tax forms this fund’s investors receive.',
    registered: 'Confirm that the notes are in registered form or of a type offered to the public, or ask your CPA, because otherwise the threshold for Form 1099-INT is another one ($2,000 from tax year 2026).',
    'in-money': 'Confirm that interest was paid in money and not added to principal, because interest added to principal, or notes issued at a discount, is original issue discount on Form 1099-OID, which your CPA prepares.',
    kind: (r) => `Say whether the ${r.type || 'untyped'} payment of ${r.date} is interest (ask your CPA if you are not sure); until then no Form 1099-INT is prepared.`,
    stored: (r) => `The investors’ amounts of the interest payment of ${r.date} were not stored when it was recorded; confirm them on that distribution, or ask your CPA, before any Form 1099-INT is prepared.`,
    'other-withholding': (r, name, kind) => `The payment of ${r.date} to ${name} carries tax withheld of another kind than backup withholding (${kind}), which box 4 does not hold; ask your CPA how it is reported.`,
    'backup-not-interest': (r) => `Backup withholding is stored on the ${r.type || 'untyped'} payment of ${r.date}, which is not interest; ask your CPA how it is reported before any Form 1099-INT is prepared.`
  };
  /** Why an investor gets no form, one sentence each (code -> text; no-form takes the W-8 facts). */
  const LEFT_TEXT = {
    ira: 'An IRA is an exempt recipient: no Form 1099-INT.',
    exempt: 'You marked this investor as an exempt recipient: no Form 1099-INT.',
    foreign: 'A foreign investor with a valid W-8: Form 1042-S from your CPA.',
    'under-10': 'Interest under $10 with nothing withheld: no Form 1099-INT is required.',
    'no-w9': 'No signed W-9 on file: a Form 1099-INT is still due, so record the signed W-9 or ask your CPA how to file without the number.',
    'no-form': (f) => `No valid W-8 or signed W-9 on file (the ${f.form || 'W-8'} ${f.signed ? `expired on ${f.validUntil || 'a date not on record'}` : 'is not signed'}): ask your CPA whether this investor gets Form 1099-INT or Form 1042-S.`
  };
  function figuresInt(ws, offering, year, f) {
    f = f || {};
    const y = yearOf(year);
    const today = f.today;
    const stops = [];
    const stop = (code, text, runId) => {
      if (!stops.some((s) => s.code === code && s.runId === runId)) stops.push(Object.assign({ code, text }, runId ? { runId } : {}));
    };
    if (W().reporting(offering) !== 'notes') stop('reporting', STOP_TEXT.reporting);
    const payer = payerOf(offering);
    if (payer.registeredForm !== true) stop('registered', STOP_TEXT.registered);
    if (payer.paidInMoney !== true) stop('in-money', STOP_TEXT['in-money']);
    const runs = interestRuns(ws, offering, y, today);
    runs.forEach((r) => {
      if (r.counts === 'ask') stop('kind', STOP_TEXT.kind(r.run), r.run.id);
      else if (r.counts === 'interest' && !r.stored) stop('stored', STOP_TEXT.stored(r.run), r.run.id);
    });
    const countsOf = {};
    runs.forEach((r) => (countsOf[r.run.id] = r.counts));
    const yearLines = D().paidLines(ws, { offeringId: offering.id, from: `${y}-01-01`, to: `${y}-12-31`, today });
    // backup withholding on a payment that does not count as interest would make box 4 more than the form's own
    yearLines.forEach((p) => {
      if (countsOf[p.run.id] === 'not-interest' && (p.line.withheld || []).some((w) => w.kind === 'backup')) stop('backup-not-interest', STOP_TEXT['backup-not-interest'](p.run), p.run.id);
    });
    const counted = runs.filter((r) => r.counts === 'interest' && r.stored);
    const ids = counted.map((r) => r.run.id);
    const per = {};
    const order = [];
    D()
      .paidLines(ws, { offeringId: offering.id, from: `${y}-01-01`, to: `${y}-12-31`, today })
      .forEach((p) => {
        if (ids.indexOf(p.run.id) < 0) return;
        const id = p.line.investorId;
        if (!per[id]) {
          per[id] = { investorId: id, box1Cents: 0, runIds: [], last: '' };
          order.push(id);
        }
        per[id].box1Cents += p.line.grossCents;
        per[id].runIds.push(p.run.id);
        per[id].last = p.run.date;
      });
    const forms = [];
    const leftOut = [];
    let totalCents = 0;
    order.sort().forEach((id) => {
      const x = per[id];
      totalCents += x.box1Cents;
      const i = (ws.investors || []).find((v) => v.id === id);
      const box4Cents = W().withheldFor(ws, { investorId: id, offeringId: offering.id, year: y, kind: 'backup', today });
      const out = (code, reason) => leftOut.push({ investorId: id, code, reason, cents: x.box1Cents });
      // the payee as of the last interest payment of the year (a W-8 valid then was valid at every earlier one)
      const kind = i ? W().payee(i, x.last) : 'undocumented';
      if (kind === 'ira' || kind === 'exempt' || kind === 'foreign') return out(kind, LEFT_TEXT[kind]);
      if (x.box1Cents < 1000 && box4Cents === 0) return out('under-10', LEFT_TEXT['under-10']);
      if (kind !== 'us') {
        const w8 = i ? W().w8(i, x.last) : { foreign: false };
        return w8.foreign ? out('no-form', LEFT_TEXT['no-form'](w8)) : out('no-w9', LEFT_TEXT['no-w9']);
      }
      // an included investor: tax withheld of any kind but backup has no box on this form
      yearLines.forEach((p) => {
        if (p.line.investorId !== id) return;
        const odd = (p.line.withheld || []).find((w) => w.kind !== 'backup');
        if (odd) stop('other-withholding', STOP_TEXT['other-withholding'](p.run, (i && (i.title || i.contact)) || id, odd.kind), p.run.id);
      });
      forms.push({ investorId: id, box1Cents: x.box1Cents, box4Cents, runIds: x.runIds.slice() });
    });
    return { forms: stops.length ? [] : forms, leftOut, stops, totalCents };
  }

  /* ---------- a person's answers ---------- */
  const runOf = (ws, runId) => {
    const r = (ws.runs || []).find((x) => x.id === runId);
    if (!r) throw new Error('No distribution with this id is recorded.');
    return r;
  };
  /** A person says whether a payment whose type does not settle it is interest. opts: { by, at }. */
  function setInterest(ws, runId, yes, opts) {
    opts = opts || {};
    const run = runOf(ws, runId);
    const by = who(opts.by, 'Saying whether a payment is interest');
    if (INTEREST_TYPES.indexOf(run.type) >= 0 || NOT_INTEREST_TYPES.indexOf(run.type) >= 0) throw new Error(`A payment of type ${run.type} is settled by its type.`);
    if (typeof yes !== 'boolean') throw new Error('Whether a payment is interest is yes or no.');
    run.tax = Object.assign({}, run.tax || {}, { interest: yes, by, at: opts.at || nowIso() });
    log(ws, { action: 'Payment marked for Form 1099-INT', record: run.id, fund: run.offeringId, detail: `The ${run.type || 'untyped'} payment of ${run.date} ${yes ? 'is' : 'is not'} interest`, actor: by });
    return run.tax;
  }
  const yearRec = (o, y) => {
    o.tax = o.tax || {};
    o.tax.years = o.tax.years || {};
    const r = (o.tax.years[y] = o.tax.years[y] || {});
    r.confirmed = r.confirmed || {};
    r.copyB = r.copyB || {};
    r.filed = r.filed || [];
    return r;
  };
  /** The sponsor confirms an investor's two box amounts against the bank: stored with who and when. opts: { by, at, today }. */
  function confirmTotals(ws, offeringId, year, investorId, opts) {
    opts = opts || {};
    const y = yearOf(year);
    const o = offeringOf(ws, offeringId);
    const by = who(opts.by, 'Confirming the totals of a Form 1099-INT');
    const F = figuresInt(ws, o, y, { today: opts.today });
    if (F.stops.length) throw new Error(F.stops[0].text);
    const form = F.forms.find((x) => x.investorId === investorId);
    if (!form) throw new Error('This investor has no Form 1099-INT for the year.');
    const entry = { box1Cents: form.box1Cents, box4Cents: form.box4Cents, by, at: opts.at || nowIso() };
    yearRec(o, y).confirmed[investorId] = entry;
    log(ws, { action: 'Form 1099-INT totals confirmed', record: investorId, fund: o.id, detail: `${y}: box 1 $${money(form.box1Cents)}, box 4 $${money(form.box4Cents)}`, actor: by });
    return entry;
  }
  /** True while the confirmed amounts equal the form's figures; false again once they differ. */
  function confirmed(ws, offering, year, form) {
    const c = (((((offering || {}).tax || {}).years || {})[yearOf(year)] || {}).confirmed || {})[form && form.investorId];
    return !!c && c.box1Cents === form.box1Cents && c.box4Cents === form.box4Cents;
  }

  /* ---------- the recipient's number, from the signed W-9 (held by the caller, never stored) ---------- */
  /** The pinned blank W-9's own rectangles for the lines and number boxes the reading needs (points, top left). */
  async function w9Rects(L, blankBytes, map, opts) {
    opts = opts || {};
    const hash = opts.sha256 || (NS.audit && NS.audit.sha256);
    if (typeof hash !== 'function') throw new Error('No SHA-256 function is available to check the form file.');
    if (String(await hash(blankBytes)).toLowerCase() !== String(map.sha256).toLowerCase()) throw Object.assign(new Error(`The ${map.form} file does not match its pinned fingerprint (${map.revision}).`), { pin: true });
    const pdf = await L.PDFDocument.load(blankBytes, { updateMetadata: false });
    const form = pdf.getForm();
    const h = pdf.getPage(0).getHeight();
    const rect = (k) => {
      const r = form.getField(map.fields[k].name).acroField.getWidgets()[0].getRectangle();
      return { x: r.x, top: h - r.y - r.height, w: r.width, h: r.height };
    };
    return { name: rect('name'), business: rect('business'), address: rect('address'), cityStateZip: rect('cityStateZip'), ssn: map.groups.ssn.map(rect), ein: map.groups.ein.map(rect) };
  }
  /**
   * What a signed, flattened W-9's page 1 shows in its own boxes: items are the page's text items ({ s, x, w, top,
   * bottom }, see textItems), rects come from w9Rects. tin is nine digits from exactly one of the two number boxes, or ''.
   */
  function readW9(items, rects) {
    const inside = (it, r) => {
      if (it.rot) return false; // a filled value is written left to right; the form's sideways margin label is not one
      const cx = it.x + (it.w || 0) / 2;
      const cy = (it.top + it.bottom) / 2;
      return cx >= r.x - 1 && cx <= r.x + r.w + 1 && cy >= r.top - 1 && cy <= r.top + r.h + 1;
    };
    const text = (r) =>
      (items || [])
        .filter((it) => inside(it, r))
        .sort((a, b) => a.top - b.top || a.x - b.x)
        .map((it) => it.s)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    const digits = (rs) => rs.map((r) => text(r).replace(/\D/g, '')).join('');
    const ssn = digits(rects.ssn);
    const ein = digits(rects.ein);
    let tin = '';
    let tinType = '';
    if (/^\d{9}$/.test(ssn) && !ein) [tin, tinType] = [ssn, 'SSN'];
    else if (/^\d{9}$/.test(ein) && !ssn) [tin, tinType] = [ein, 'EIN'];
    return { name: text(rects.name), business: text(rects.business), address: text(rects.address), cityStateZip: text(rects.cityStateZip), tin, tinType };
  }
  /** A number read or typed, accepted only as nine digits ending in the four on record: { ok, why, digits }. */
  function checkTin(digits, last4) {
    const s = String(digits == null ? '' : digits).trim();
    if (!/^\d{4}$/.test(String(last4 == null ? '' : last4))) return { ok: false, why: 'No last four digits of a U.S. taxpayer number are on record for this investor, so the number cannot be checked.' };
    if (/[^\d\s-]/.test(s)) return { ok: false, why: 'A taxpayer number holds digits only (dashes and spaces may stand between them).' };
    const d = s.replace(/[\s-]/g, '');
    if (d.length !== 9) return { ok: false, why: `A taxpayer number has nine digits; this one has ${d.length}.` };
    if (d.slice(5) !== String(last4)) return { ok: false, why: 'The number does not end in the four digits on record; check it against the signed W-9.' };
    return { ok: true, why: '', digits: d };
  }
  /** A proposal for the IRS's name cells from the W-9's name line, which the sponsor corrects: plain letters only. */
  function splitName(line) {
    const plain = String(line == null ? '' : line)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const w = plain ? plain.split(' ') : [];
    const suffix = w.length > 2 && /^(jr|sr|ii|iii|iv|v)$/i.test(w[w.length - 1]) ? w.pop() : '';
    const first = w.shift() || '';
    const last = w.pop() || '';
    return { first, middle: w.join(' '), last, suffix };
  }
  /** A proposal for city, state and ZIP from the W-9's city line ("Austin, TX 78701-1234"). */
  function splitCityStateZip(line) {
    const s = String(line == null ? '' : line).trim();
    const m = /^(.*?)[\s,]+([A-Za-z]{2})[\s,]+(\d{5})(?:-?(\d{4}))?$/.exec(s);
    if (!m) return { city: s, state: '', zip: '' };
    return { city: m[1].replace(/,\s*$/, '').trim(), state: m[2].toUpperCase(), zip: m[3] + (m[4] || '') };
  }

  /* ---------- numbers ---------- */
  /** The recipient's number with all but its last four masked: '***-**-1234' (SSN) or '**-***1234' (EIN). */
  function truncate(digits, tinType) {
    const d = digitsOf(digits);
    if (!/^\d{9}$/.test(d)) throw new Error('A taxpayer number has nine digits.');
    return tinType === 'EIN' || tinType === 'QI-EIN' ? `**-***${d.slice(5)}` : `***-**-${d.slice(5)}`;
  }
  /** The full number in the IRS's dashed shape: XX-XXXXXXX for an EIN, XXX-XX-XXXX otherwise. */
  function dashed(digits, tinType) {
    const d = digitsOf(digits);
    if (!/^\d{9}$/.test(d)) throw new Error('A taxpayer number has nine digits.');
    return tinType === 'EIN' || tinType === 'QI-EIN' ? `${d.slice(0, 2)}-${d.slice(2)}` : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  }

  /* ---------- Copy B, the recipient's copy ---------- */
  const COPY_B = '1099-INT 2024-01 Copy B';
  /** The answers NS.taxforms.fill takes for Copy B: the payer in full, the recipient's number truncated, boxes 1 and 4. */
  function copyBAnswers(form, payer, recipient, year) {
    const y = yearOf(year);
    const cityLine = (p) => [[p.city, p.state].filter(Boolean).join(', '), p.zip].filter(Boolean).join(' ') + (p.country && p.country !== 'US' ? ` ${p.country}` : '');
    const payerLines = [payer.name, payer.name2, [payer.address1, payer.address2].filter(Boolean).join(' '), cityLine(payer), payer.phone].filter((s) => s && String(s).trim());
    return {
      year: y,
      payerBlock: payerLines.join('\n'),
      payerTin: dashed(payer.tin, payer.tinType),
      recipientTin: truncate(recipient.tin, recipient.tinType),
      recipientName: recipient.name || [recipient.first, recipient.middle, recipient.last, recipient.suffix].filter(Boolean).join(' '),
      recipientStreet: [recipient.address1, recipient.address2].filter(Boolean).join(' '),
      recipientCity: cityLine(recipient),
      box1: money(form.box1Cents),
      box4: form.box4Cents > 0 ? money(form.box4Cents) : ''
    };
  }
  /**
   * The recipient's copy: the official form filled through its own fields by NS.taxforms.fill (the pin is checked
   * before anything is filled) and flattened, keeping only the map's pages (Copy B and the recipient's instructions).
   * L is the PDF writer library object; opts are NS.taxforms.fill's ({ fontkit, fontBytes, sha256 }).
   */
  async function recipientCopy(L, formBytes, map, answers, opts) {
    const filled = await NS.taxforms.fill(L, formBytes, map, answers, opts);
    const src = await L.PDFDocument.load(filled, { updateMetadata: false });
    const out = await L.PDFDocument.create();
    // the page numbers kept, in the file's order (filtered from the library's own list, so the library gets its own
    // kind of array when this file runs in another realm than the library, as in the checks)
    const want = (map.pages || []).map((p) => p - 1);
    const pages = await out.copyPages(
      src,
      src.getPageIndices().filter((k) => want.indexOf(k) >= 0)
    );
    pages.forEach((pg) => out.addPage(pg));
    return out.save();
  }

  /* ---------- the IRS upload file (IRIS) ---------- */
  const columnsOf = (formType) => {
    const cols = NS.tax1099data && NS.tax1099data.IRIS.columns[formType];
    if (!cols) throw new Error(`No IRS upload columns for ${formType}.`);
    return cols;
  };
  const header = (formType) => columnsOf(formType).map((c) => c.name);
  /** One row of the upload file for one form, in the IRS's column order; every cell the portal does not fill is empty. */
  function row(formType, year, form, payer, recipient) {
    const cols = columnsOf(formType);
    const at = {};
    cols.forEach((c, k) => (at[c.col] = k));
    const out = cols.map(() => '');
    const put = (col, v) => (out[at[col]] = v == null ? '' : String(v));
    const person = (p, first, middle, last, suffix) => {
      put(first, p.first);
      put(middle, p.middle);
      put(last, p.last);
      put(suffix, p.suffix);
    };
    put('A', formType);
    put('B', yearOf(year));
    put('C', payer.tinType);
    put('D', dashed(payer.tin, payer.tinType));
    put('E', payer.nameType);
    if (payer.nameType === 'B') {
      put('F', payer.name);
      put('G', payer.name2);
    } else person(payer, 'H', 'I', 'J', 'K');
    put('L', payer.country || 'US');
    put('M', payer.address1);
    put('N', payer.address2);
    put('O', payer.city);
    put('P', payer.state);
    put('Q', payer.zip);
    if (payer.phone) {
      put('R', 'D');
      put('S', payer.phone);
    }
    put('T', recipient.tinType);
    put('U', dashed(recipient.tin, recipient.tinType));
    put('V', recipient.nameType);
    if (recipient.nameType === 'B') {
      put('W', recipient.name);
      put('X', recipient.name2);
    } else person(recipient, 'Y', 'Z', 'AA', 'AB');
    put('AC', recipient.country || 'US');
    put('AD', recipient.address1);
    put('AE', recipient.address2);
    put('AF', recipient.city);
    put('AG', recipient.state);
    put('AH', recipient.zip);
    put('AN', dollars(form.box1Cents));
    put('AQ', form.box4Cents > 0 ? dollars(form.box4Cents) : '');
    return out;
  }
  /** Every fault of the rows against the published rules: [ { row (from 1), col, name, why } ]. */
  function validate(formType, rows) {
    const data = NS.tax1099data.IRIS;
    const cols = columnsOf(formType);
    const at = {};
    cols.forEach((c, k) => (at[c.col] = k));
    const faults = [];
    (rows || []).forEach((r, n) => {
      const rowNo = n + 1;
      if (!Array.isArray(r) || r.length !== cols.length) {
        faults.push({ row: rowNo, col: '', name: '', why: `has ${Array.isArray(r) ? r.length : 0} cells; the template has ${cols.length}` });
        return;
      }
      const cell = (col) => String(r[at[col]] == null ? '' : r[at[col]]);
      cols.forEach((c) => {
        const v = cell(c.col);
        const fault = (why) => faults.push({ row: rowNo, col: c.col, name: c.name, why });
        const req = c.required || (c.requiredIf || []).some((q) => (q.filled ? cell(q.col) !== '' : cell(q.col) === q.equals));
        if (v === '') {
          if (req) fault(`is required (${c.rule || 'a required field'})`);
          return;
        }
        data.rules.forEach((x) => {
          if (new RegExp(x.pattern).test(v)) fault(x.why);
        });
        if (c.max && v.length > c.max) fault(`is longer than ${c.max} characters (it has ${v.length})`);
        if (c.values && c.values.indexOf(v) < 0) fault(`is not one of: ${c.values.join(', ')}`);
        let p = c.pattern;
        if (c.patternBy) {
          const key = cell(c.patternBy.col);
          p = has(c.patternBy.patterns, key) ? c.patternBy.patterns[key] : c.patternBy.patterns['*'];
        }
        if (p && !new RegExp(p).test(v)) fault(`does not follow the rule: ${c.rule}`);
      });
    });
    return faults;
  }

  /* ---------- reading a page's text ---------- */
  /** The reader's text items of one page as { s, x, w, top, bottom, rot } in points from the top left. */
  function textItems(height, items) {
    // rot: the item is not written left to right on the line (a margin label printed sideways, for example)
    return (items || []).filter((it) => it && it.str && it.str.trim()).map((it) => Object.assign({ s: it.str, x: it.transform[4], w: it.width || 0, top: height - it.transform[5] - (it.height || 0), bottom: height - it.transform[5] }, Math.abs(it.transform[1]) > 0.01 || Math.abs(it.transform[2]) > 0.01 ? { rot: true } : {}));
  }

  const API = {
    INTEREST_TYPES,
    NOT_INTEREST_TYPES,
    COPY_B,
    interestRuns,
    setPayer,
    payerOf,
    last4Of,
    figuresInt,
    STOP_TEXT,
    LEFT_TEXT,
    setInterest,
    confirmTotals,
    confirmed,
    w9Rects,
    readW9,
    checkTin,
    splitName,
    splitCityStateZip,
    truncate,
    dashed,
    copyBAnswers,
    recipientCopy,
    textItems,
    iris: { header, row, validate }
  };
  if (NS) NS.tax1099 = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
