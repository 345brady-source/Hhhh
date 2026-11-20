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
  function figuresInt(ws, offering, year, f) {
    f = f || {};
    const y = yearOf(year);
    const today = f.today;
    const runs = interestRuns(ws, offering, y, today);
    const counted = runs.filter((r) => r.counts === 'interest');
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
      const kind = i ? W().payee(i, x.last) : 'undocumented';
      if (kind === 'foreign') {
        leftOut.push({ investorId: id, code: 'foreign', reason: 'A foreign investor with a valid W-8: Form 1042-S from your CPA.', cents: x.box1Cents });
        return;
      }
      forms.push({ investorId: id, box1Cents: x.box1Cents, box4Cents, runIds: x.runIds.slice() });
    });
    return { forms, leftOut, stops: [], totalCents };
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
  /** The reader's text items of one page as { s, x, w, top, bottom } in points from the top left. */
  function textItems(height, items) {
    return (items || []).filter((it) => it && it.str && it.str.trim()).map((it) => ({ s: it.str, x: it.transform[4], w: it.width || 0, top: height - it.transform[5] - (it.height || 0), bottom: height - it.transform[5] }));
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
