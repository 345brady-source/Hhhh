/*
 * Tax withheld at a distribution (phase 10): the offering's tax reporting type, the two lines the portal may propose,
 * the stops where it must not, the record of tax withheld with the deposits the sponsor marks, and the worksheet for
 * the CPA about foreign investors.
 *
 * The portal proposes only what a published IRS rule makes mechanical, and a person confirms every line:
 *   - backup withholding at 24%, on the conditions Publication 1099 (2026) part N lists, for an offering whose
 *     investors get a Form 1099 (notes, or a corporation or REIT); never on a partnership's distributions, whose income
 *     is reported on a Schedule K-1 and must not be repeated on a Form 1099 (Publication 1099 (2026), part B);
 *   - 30% for a foreign investor, on the amount the sponsor enters as subject to withholding (Publication 515 (2026));
 *     another rate only when the sponsor enters it.
 * Everything else is a stop that names the CPA and takes only an entered figure.
 *
 * Every sum of tax withheld is read from the stored lines of paid distributions (NS.data.paidLines, plan 10-01); the
 * capital-account engine is never read here (its income and gains are sample numbers). Every function that depends on a
 * day is given that day, so the same records give the same answer on any day.
 *
 * Stored (all additive):
 *   offering.tax = { reporting: '' | 'partnership' | 'notes' | 'corp' | 'other', setBy, setAt }   other plans add keys
 *   investor.irsNotice = { kind: 'wrong-number' | 'underreporting', received, ended, by, at, endedBy, endedAt }
 *   investor.exempt1099 = { by, at }                       the sponsor's mark for an exempt recipient
 *   ws.taxDeposits = [ { id, offeringId, kind, year, cents, date, confirmation, by, at } ]
 * A draft (never stored): { investorId, kind, basisCents, ratePct, cents, source: 'rule' | 'entered', why, decided }.
 *
 * This file works on plain data only and needs nothing when it loads, so it also loads outside a browser (the checks,
 * and module.exports under Node). It moves no money and works out no due date.
 */
(function (NS) {
  'use strict';

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  const whole = (n) => typeof n === 'number' && Number.isInteger(n) && n > 0;
  const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const who = (by, what) => {
    if (typeof by !== 'string' || !by.trim()) throw new Error(`${what} needs the name of the person doing it.`);
    return by.trim();
  };
  const nowIso = () => new Date().toISOString();
  const log = (ws, e) => (NS && NS.audit && NS.audit.log ? NS.audit.log(ws, e) : null);
  const offeringOf = (ws, id) => {
    const o = ((ws && ws.offerings) || []).find((x) => x.id === id);
    if (!o) throw new Error('No offering with this id.');
    return o;
  };
  const investorOf = (ws, id) => {
    const i = ((ws && ws.investors) || []).find((x) => x.id === id);
    if (!i) throw new Error('No investor with this id.');
    return i;
  };
  const yearOf = (y) => {
    const s = String(y == null ? '' : y);
    if (!/^\d{4}$/.test(s)) throw new Error('A tax year is written YYYY.');
    return s;
  };
  const dollars = (c) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
  // An amount in words a person reads, as the portal's money formatter prints it (NS.ui.usdc: "$5,000.00"). This file also
  // runs under Node, so it does not reach for NS.ui. The worksheet's CSV keeps dollars() (no thousands separator).
  const money = (c) => `$${String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(c % 100).padStart(2, '0')}`;

  /* ---------- the offering's tax reporting type (only a person sets it) ---------- */
  const REPORTING = {
    partnership: { label: 'Partnership: Schedule K-1', backup: false, form: '' },
    notes: { label: 'Notes: Form 1099-INT', backup: true, form: '1099-int' },
    corp: { label: 'Corporation or REIT: Form 1099-DIV', backup: true, form: '1099-div' },
    other: { label: 'Other: documents from your CPA', backup: false, form: '' }
  };
  /** The offering's reporting type, or '' until a person has set it. */
  function reporting(offering) {
    const k = offering && offering.tax && offering.tax.reporting;
    return has(REPORTING, k) ? k : '';
  }
  /** Set an offering's reporting type: one of the four keys, with who and when; one change-log entry. */
  function setReporting(ws, offeringId, key, opts) {
    opts = opts || {};
    if (!has(REPORTING, key)) throw new Error(`The tax reporting type must be one of: ${Object.keys(REPORTING).join(', ')}.`);
    const o = offeringOf(ws, offeringId);
    const by = who(opts.by, 'Setting the tax reporting type');
    const was = reporting(o);
    o.tax = Object.assign({}, o.tax || {}, { reporting: key, setBy: by, setAt: opts.at || nowIso() });
    log(ws, { action: 'Tax reporting type set', record: o.id, fund: o.id, detail: `${o.shortName || o.name || o.id}: ${REPORTING[key].label}${was && was !== key ? ` (was ${REPORTING[was].label})` : ''}`, actor: by });
    return o;
  }

  /* ---------- amounts ---------- */
  const RATE = { backup: 24, foreign: 30 };
  /**
   * The tax on an amount, in whole cents; half a cent rounds up. ratePct is a number from 0 to 100 (up to four decimal
   * places). Worked in exact integers: with r = rate x 10,000 and basis = hi x 1,000,000 + lo,
   * cents = hi x r + round half up (lo x r / 1,000,000).
   */
  function amount(basisCents, ratePct) {
    if (!Number.isInteger(basisCents) || basisCents < 0) throw new Error('The amount the tax is worked out on must be a whole number of cents.');
    const rate = Number(ratePct);
    if (ratePct === null || ratePct === '' || !(rate >= 0 && rate <= 100)) throw new Error('A rate must be between 0 and 100.');
    const r = Math.round(rate * 10000);
    const hi = Math.floor(basisCents / 1000000);
    const lo = basisCents - hi * 1000000;
    return hi * r + Math.floor((2 * lo * r + 1000000) / 2000000);
  }

  /* ---------- what kinds of tax withheld there are, and the stops ---------- */
  const STOPS = {
    'us-source': 'How much of this payment is income from sources in the United States of the kinds subject to withholding is a question for your CPA, and the portal withholds only on the amount you enter.',
    'portfolio-interest': 'Whether interest on the notes paid to this foreign investor is exempt as portfolio interest is for your CPA to decide.',
    treaty: 'Whether a tax treaty lowers the rate for this investor, and to what rate, is for your CPA to decide, so the portal uses another rate only when you enter it.',
    partnership: 'Withholding on a foreign partner’s share of the partnership’s business income follows the income rather than the distributions, so your CPA works it out and you enter the figure.',
    'real-property': 'Withholding on real property interests, such as a corporation’s or REIT’s distributions to foreign shareholders or a foreign partner’s sale of an interest, is for your CPA to work out, and you enter the figure.',
    fatca: 'Withholding under FATCA on a foreign entity whose form shows a status that draws it is for your CPA to decide, and you enter the figure.',
    state: 'State withholding on out-of-state or foreign investors depends on each state’s rules, so your CPA works it out and you enter the figure.',
    'irs-notice': 'When the IRS writes to you about an investor’s taxpayer number or unreported income, record the day the letter arrived, and ask your CPA about anything the letter asks beyond backup withholding.'
  };
  const KINDS = {
    backup: { label: 'Backup withholding', rule: true },
    foreign: { label: 'Withholding on a foreign investor', rule: true },
    partnership: { label: 'Partnership withholding on business income', stop: STOPS.partnership },
    'real-property': { label: 'Withholding on real property interests', stop: STOPS['real-property'] },
    fatca: { label: 'FATCA withholding', stop: STOPS.fatca },
    state: { label: 'State withholding', stop: STOPS.state }
  };
  const STOP_KINDS = ['partnership', 'real-property', 'fatca', 'state'];
  /** One sentence for each deposit rule, with its source; the module computes no due date (C-08). */
  const DEPOSIT_RULES = {
    backup: {
      text: 'Backup withholding is reported on Form 945 under the same EIN as the 1099s and is always deposited electronically: under $2,500 for the year it is paid with the return; otherwise a new filer deposits each month’s tax by the 15th of the next month, and a larger filer’s schedule is shorter (your CPA confirms which applies).',
      source: 'Instructions for Form 945 (2026); Publication 15 (2026)'
    },
    foreign: {
      text: 'Tax withheld from foreign investors is reported on Form 1042 and is always deposited electronically: $2,000 or more not yet deposited at the end of a quarter-monthly period (the 7th, 15th, 22nd and last day of the month) within 3 business days; $200 to under $2,000 at a month’s end by the 15th of the next month; under $200 at the year’s end with the return.',
      source: 'Instructions for Form 1042 (2025); Publication 515 (2026)'
    }
  };

  /* ---------- who the payee is ---------- */
  /** onboarding.js's one rule for "a tax form is on file", called, never copied. */
  const taxOnFile = (i) => {
    const f = NS && NS.inviteFlow && NS.inviteFlow.taxOnFile;
    if (typeof f !== 'function') throw new Error('The rule for a tax form on file (onboarding) is not loaded.');
    return f(i);
  };
  const cert = (i) => (i && i.taxCert && typeof i.taxCert === 'object' ? i.taxCert : {});
  /** The last four digits of the U.S. taxpayer number on record (taxCert first, then the record; never a foreign number), or ''. */
  const last4 = (i) => {
    const v = String(cert(i).tinLast4 || (i && i.tinLast4) || '');
    return /^\d{4}$/.test(v) ? v : '';
  };
  /** Plan-check C4: a signed W-9 with a number on file, exactly. */
  const signedW9 = (i) => !!i && taxOnFile(i) && i.taxForm === 'W-9' && cert(i).signed === true && !!last4(i);
  const isW8 = (i) => /^W-8/.test(String((i && i.taxForm) || ''));

  /**
   * What a foreign investor's W-8 says on a day (Instructions for the Requester of Forms W-8): signed; valid through
   * validUntil (the last day of the third calendar year after signing); a foreign tax number, or the box saying none is
   * legally required. valid = signed and not expired. A U.S. investor answers foreign false.
   */
  function w8(i, date) {
    const form = String((i && i.taxForm) || '');
    const foreign = isW8(i) || (form !== 'W-9' && /^foreign-/.test(String((i && i.taxType) || '')));
    if (!foreign) return { foreign: false, form, signed: false, validUntil: '', valid: false, ftin: '', flags: [] };
    const c = cert(i);
    const signed = isW8(i) && taxOnFile(i) && c.signed === true;
    const validUntil = ISO_DAY.test(String(c.validUntil || '')) ? c.validUntil : '';
    const expired = signed && (!validUntil || String(date || '') > validUntil);
    const ftin = c.ftinLast4 ? 'on file' : c.noFtin ? 'not required' : '';
    const flags = [];
    if (!signed) flags.push('not signed');
    if (expired) flags.push('expired');
    if (isW8(i) && !ftin) flags.push('no foreign tax number');
    return { foreign: true, form, signed, validUntil, valid: signed && !expired, ftin, flags };
  }
  /** 'ira' | 'exempt' | 'foreign' | 'us' | 'undocumented' on a day. */
  function payee(i, date) {
    if (i && i.type === 'ira') return 'ira';
    if (i && i.exempt1099) return 'exempt';
    const f = w8(i, date);
    if (f.foreign) return f.valid ? 'foreign' : 'undocumented';
    return signedW9(i) ? 'us' : 'undocumented';
  }
  /** Why the first condition holds: no signed W-9 with a taxpayer number is on file, and what is on file instead. */
  function noW9Why(i, date) {
    const head = 'No signed W-9 with a taxpayer number is on file';
    const f = w8(i, date);
    if (f.foreign) {
      if (!isW8(i)) return `${head}, and no W-8 either.`;
      if (!f.signed) return `${head}, and the ${f.form} on file is not signed.`;
      return `${head}, and the ${f.form} on file expired: it was valid until ${f.validUntil || 'a date not on record'}.`;
    }
    if (!i.taxForm) return `${head}: no tax form is on file.`;
    if (i.taxForm !== 'W-9') return `${head}: the form on file is not a W-9.`;
    if (cert(i).uploaded === true) return `${head}: the W-9 on file was uploaded and the portal has no record of its signature.`;
    if (!taxOnFile(i) || cert(i).signed === false) return `${head}: the W-9 on file is not signed.`;
    if (cert(i).signed !== true) return `${head}: the portal has no record of the W-9’s signature.`;
    return `${head}: the W-9 on file carries no taxpayer number.`;
  }
  /** The IRS notice recorded for the investor, when it is in effect on the day (arrived on or before it, not ended by it). */
  function noticeOn(i, date) {
    const n = i && i.irsNotice;
    if (!n || !ISO_DAY.test(String(n.received || '')) || n.received > date) return null;
    if (n.ended && n.ended <= date) return null;
    return n;
  }
  const NOTICE_KINDS = { 'wrong-number': 'the taxpayer number is wrong', underreporting: 'the investor underreported interest or dividends' };

  /* ---------- the proposal ---------- */
  const draft = (investorId, kind, basisCents, ratePct, cents, source, why) => ({ investorId, kind, basisCents, ratePct, cents, source, why, decided: '' });
  /**
   * Backup lines for an offering set to notes or to a corporation or REIT (Publication 1099 part N): for a payee who is not
   * an IRA, not marked exempt and not documented foreign by a valid W-8 on the payment date, one draft at 24% of the
   * payment when any of these is true on that date: (1) no signed W-9 with a taxpayer number is on file; (2) the W-9 has
   * certification item 2 crossed out; (3) an IRS notice the sponsor recorded is in effect. A line that would be 0 cents is
   * not offered. opts.date: the payment date. lines: the distribution's lines (investorId, grossCents).
   */
  function propose(ws, offering, lines, opts) {
    opts = opts || {};
    const date = String(opts.date || '');
    if (!ISO_DAY.test(date)) throw new Error('A proposal needs the payment date (YYYY-MM-DD).');
    const k = reporting(offering);
    if (!k || !REPORTING[k].backup) return [];
    const out = [];
    (lines || []).forEach((line) => {
      const i = ((ws && ws.investors) || []).find((x) => x.id === line.investorId);
      if (!i || !whole(line.grossCents)) return;
      const p = payee(i, date);
      if (p !== 'us' && p !== 'undocumented') return;
      const why = [];
      if (!signedW9(i)) why.push(noW9Why(i, date));
      if (i.taxForm === 'W-9' && cert(i).backupWithholding === true) why.push('The W-9 on file has certification item 2 crossed out: the investor has told you the IRS notified them they are subject to backup withholding.');
      const n = noticeOn(i, date);
      if (n) why.push(`An IRS notice that ${NOTICE_KINDS[n.kind] || 'concerns this investor'}, received ${n.received}, is in effect.`);
      if (!why.length) return;
      const cents = amount(line.grossCents, RATE.backup);
      if (cents > 0) out.push(draft(i.id, 'backup', line.grossCents, RATE.backup, cents, 'rule', why.join(' ')));
    });
    return out;
  }
  /**
   * The line for a foreign investor: 30% of the amount the sponsor enters as subject to withholding (Publication 515), or
   * the rate the sponsor enters. Refuses an amount that is not whole, below 2 cents or above the line's gross, a rate
   * outside 0 to 100, and a line that would be 0 cents.
   */
  function foreignDraft(line, opts) {
    opts = opts || {};
    if (!line || !line.investorId || !whole(line.grossCents)) throw new Error('A line needs the investor and the amount of the payment.');
    const subject = opts.subjectCents;
    if (!Number.isInteger(subject) || subject < 2) throw new Error('The amount subject to withholding must be a whole number of cents, at least 2.');
    if (subject > line.grossCents) throw new Error('The amount subject to withholding cannot be more than the payment.');
    const entered = opts.ratePct != null && opts.ratePct !== '';
    const rate = entered ? Number(opts.ratePct) : RATE.foreign;
    if (!(rate >= 0 && rate <= 100)) throw new Error('A rate must be between 0 and 100.');
    const cents = amount(subject, rate);
    if (cents < 1) throw new Error('At this amount and rate nothing would be withheld.');
    const source = rate === RATE.foreign ? 'rule' : 'entered';
    const why = source === 'rule' ? `${RATE.foreign}% of the amount you entered as subject to withholding (${money(subject)}).` : `A rate of ${rate}% that you entered, on the amount you entered as subject to withholding (${money(subject)}).`;
    return draft(line.investorId, 'foreign', subject, rate, cents, source, why);
  }
  /**
   * A figure the sponsor enters for one of the stop kinds (the CPA works it out): a positive whole amount no larger than
   * the amount it is worked on, which is a positive whole amount no larger than the line's gross, and a reason. Never a
   * rate; always source entered. opts: { investorId, grossCents } or { line }, and { cents, basisCents, why }.
   */
  function enteredDraft(kind, opts) {
    opts = opts || {};
    if (STOP_KINDS.indexOf(kind) < 0) throw new Error(`An entered figure is for one of these kinds: ${STOP_KINDS.join(', ')}.`);
    const line = opts.line || {};
    const investorId = String(opts.investorId || line.investorId || '');
    const gross = opts.line ? line.grossCents : opts.grossCents;
    if (!investorId) throw new Error('An entered figure needs the investor.');
    if (!whole(gross)) throw new Error('An entered figure needs the amount of the payment it is taken from.');
    if (!whole(opts.basisCents) || opts.basisCents > gross) throw new Error('The amount the figure is worked on must be a positive whole number of cents, no more than the payment.');
    if (!whole(opts.cents) || opts.cents > opts.basisCents) throw new Error('The figure must be a positive whole number of cents, no more than the amount it is worked on.');
    const why = String(opts.why || '').trim();
    if (!why) throw new Error('An entered figure needs a reason.');
    return draft(investorId, kind, opts.basisCents, null, opts.cents, 'entered', why);
  }

  /* ---------- deciding ---------- */
  /** A confirmed draft: the w that plan 10-01's record stores, with the investor's id beside it. */
  function confirm(d, opts) {
    opts = opts || {};
    if (!d || d.decided === 'removed') throw new Error('A removed line cannot be confirmed.');
    if (d.decided === 'confirmed') throw new Error('This line is already confirmed.');
    if (!has(KINDS, d.kind) || !whole(d.cents) || !whole(d.basisCents) || !d.investorId) throw new Error('This line is not complete.');
    const by = who(opts.by, 'Confirming tax withheld');
    d.decided = 'confirmed';
    return { investorId: d.investorId, kind: d.kind, cents: d.cents, basisCents: d.basisCents, ratePct: d.ratePct == null ? null : d.ratePct, source: d.source, why: d.why, confirmedBy: by, confirmedAt: opts.at || nowIso() };
  }
  /** A proposed line taken off by a person; it can no longer be confirmed. */
  function remove(d, opts) {
    opts = opts || {};
    if (!d) throw new Error('No line to remove.');
    if (d.decided === 'confirmed') throw new Error('A confirmed line is not removed here.');
    d.removedBy = who(opts.by, 'Removing a proposed line');
    d.removedAt = opts.at || nowIso();
    d.decided = 'removed';
    return d;
  }
  /** Confirmed lines keyed by investor, the shape NS.data.buildLines takes; refuses anything not confirmed by a person. */
  function toWithheld(list) {
    const out = {};
    (list || []).forEach((w) => {
      if (!w || !w.investorId || !w.confirmedBy || !w.confirmedAt) throw new Error('Only a line a person has confirmed can be withheld.');
      (out[w.investorId] = out[w.investorId] || []).push({ kind: w.kind, cents: w.cents, basisCents: w.basisCents, ratePct: w.ratePct == null ? null : w.ratePct, source: w.source, why: w.why, confirmedBy: w.confirmedBy, confirmedAt: w.confirmedAt });
    });
    return out;
  }
  /** True while any draft is neither confirmed nor removed. */
  const undecided = (drafts) => (drafts || []).some((d) => !d.decided);

  /* ---------- the sponsor's marks on a payee ---------- */
  function addNotice(ws, investorId, opts) {
    opts = opts || {};
    if (!has(NOTICE_KINDS, opts.kind)) throw new Error('An IRS notice is about a wrong taxpayer number or about underreporting.');
    if (!ISO_DAY.test(String(opts.received || ''))) throw new Error('An IRS notice needs the day it arrived (YYYY-MM-DD).');
    const i = investorOf(ws, investorId);
    const by = who(opts.by, 'Recording an IRS notice');
    i.irsNotice = { kind: opts.kind, received: opts.received, ended: '', by, at: opts.at || nowIso() };
    log(ws, { action: 'IRS notice recorded', record: i.id, detail: `${i.title || i.id}: ${NOTICE_KINDS[opts.kind]}; received ${opts.received}`, actor: by });
    return i.irsNotice;
  }
  function endNotice(ws, investorId, opts) {
    opts = opts || {};
    const i = investorOf(ws, investorId);
    const n = i.irsNotice;
    if (!n) throw new Error('No IRS notice is recorded for this investor.');
    if (!ISO_DAY.test(String(opts.ended || '')) || opts.ended < n.received) throw new Error('The day the notice ended must be written YYYY-MM-DD and not before the day it arrived.');
    const by = who(opts.by, 'Ending an IRS notice');
    Object.assign(n, { ended: opts.ended, endedBy: by, endedAt: opts.at || nowIso() });
    log(ws, { action: 'IRS notice ended', record: i.id, detail: `${i.title || i.id}: the notice received ${n.received} ended ${opts.ended}`, actor: by });
    return n;
  }
  function markExempt(ws, investorId, opts) {
    opts = opts || {};
    const i = investorOf(ws, investorId);
    const by = who(opts.by, 'Marking an exempt recipient');
    i.exempt1099 = { by, at: opts.at || nowIso() };
    log(ws, { action: 'Marked exempt from backup withholding', record: i.id, detail: `${i.title || i.id}`, actor: by });
    return i.exempt1099;
  }
  function unmarkExempt(ws, investorId, opts) {
    opts = opts || {};
    const i = investorOf(ws, investorId);
    delete i.exempt1099;
    log(ws, Object.assign({ action: 'Exempt mark removed', record: i.id, detail: `${i.title || i.id}` }, opts.by ? { actor: opts.by } : {}));
  }

  /* ---------- the record of tax withheld ---------- */
  /** The withheld entries of a year's paid lines: [ { run, line, w, stored } ], from NS.data.paidLines only. */
  function entries(ws, f) {
    const y = yearOf(f.year);
    const out = [];
    NS.data.paidLines(ws, { offeringId: f.offeringId, investorId: f.investorId, from: `${y}-01-01`, to: `${y}-12-31`, today: f.today }).forEach((p) => {
      (p.line.withheld || []).forEach((w) => out.push({ run: p.run, line: p.line, w, stored: p.stored }));
    });
    return out;
  }
  /**
   * The one sum of tax withheld (also box 4 of a 1099 when kind is backup): stored lines of paid distributions dated
   * 1 January to 31 December of the year. f: { investorId, offeringId, year, kind, today }; no kind: every kind.
   */
  function withheldFor(ws, f) {
    f = f || {};
    return entries(ws, f)
      .filter((e) => !f.kind || e.w.kind === f.kind)
      .reduce((a, e) => a + e.w.cents, 0);
  }
  /**
   * Tax withheld by kind for a year, less the deposits the sponsor marked: { [kind]: { withheldCents, depositedCents,
   * undepositedCents, items: [ { runId, date, investorId, cents, recomputed } ], recomputedRuns: [ runId ] } }.
   * recomputedRuns names the paid runs of the year saved before the record existed (their amounts are worked out again
   * and carry no tax withheld). f: { offeringId, year, today }.
   */
  function totals(ws, f) {
    f = f || {};
    const y = yearOf(f.year);
    const all = entries(ws, { offeringId: f.offeringId, year: y, today: f.today });
    const recomputedRuns = [];
    NS.data.paidLines(ws, { offeringId: f.offeringId, from: `${y}-01-01`, to: `${y}-12-31`, today: f.today }).forEach((p) => {
      if (!p.stored && recomputedRuns.indexOf(p.run.id) < 0) recomputedRuns.push(p.run.id);
    });
    const out = {};
    Object.keys(KINDS).forEach((k) => {
      const items = all.filter((e) => e.w.kind === k).map((e) => ({ runId: e.run.id, date: e.run.date, investorId: e.line.investorId, cents: e.w.cents, recomputed: !e.stored }));
      const withheldCents = items.reduce((a, x) => a + x.cents, 0);
      const depositedCents = (ws.taxDeposits || []).filter((d) => d.kind === k && d.year === y && (!f.offeringId || d.offeringId === f.offeringId)).reduce((a, d) => a + d.cents, 0);
      out[k] = { withheldCents, depositedCents, undepositedCents: withheldCents - depositedCents, items, recomputedRuns: recomputedRuns.slice() };
    });
    return out;
  }
  let serial = 0;
  /** A deposit the sponsor made (the portal moves no money): offering, kind, year, cents, date, confirmation number, who. */
  function addDeposit(ws, d) {
    d = d || {};
    offeringOf(ws, d.offeringId);
    if (!has(KINDS, d.kind)) throw new Error(`A deposit is for one of these kinds: ${Object.keys(KINDS).join(', ')}.`);
    const year = yearOf(d.year);
    if (!whole(d.cents)) throw new Error('A deposit must be a positive whole number of cents.');
    if (!ISO_DAY.test(String(d.date || ''))) throw new Error('A deposit needs the day it was made (YYYY-MM-DD).');
    const confirmation = String(d.confirmation || '').trim();
    if (!confirmation) throw new Error('A deposit needs its confirmation number.');
    const by = who(d.by, 'Marking a deposit');
    const entry = { id: `dep-${Date.now().toString(36)}${(serial++).toString(36)}`, offeringId: d.offeringId, kind: d.kind, year, cents: d.cents, date: d.date, confirmation, by, at: d.at || nowIso() };
    if (!Array.isArray(ws.taxDeposits)) ws.taxDeposits = [];
    ws.taxDeposits.push(entry);
    log(ws, { action: 'Tax deposit marked', record: entry.id, fund: d.offeringId, detail: `${KINDS[d.kind].label} for ${year}: ${money(d.cents)} deposited ${d.date}, confirmation ${confirmation}`, actor: by });
    return entry;
  }

  /* ---------- the worksheet for the CPA (foreign investors) ---------- */
  /** A CSV cell: one a spreadsheet would run as a formula is written after an apostrophe; quoted when it must be. */
  const cell = (v) => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const CSV_HEADER = ['Investor ID', 'Investor', 'Country', 'Form', 'Signed', 'Valid until', 'Foreign tax number', 'Date paid', 'Type', 'Amount paid', 'Tax withheld', 'Kind of tax withheld', 'Amount worked out again'];
  /**
   * Each foreign investor of an offering with the W-8 facts on file and each amount paid and withheld in the year, from
   * the stored lines of paid distributions; a payment worked out again (a run saved before the record existed) is marked
   * recomputed. f: { offeringId, year, today }.
   */
  function worksheet(ws, f) {
    f = f || {};
    const y = yearOf(f.year);
    const paid = NS.data.paidLines(ws, { offeringId: f.offeringId, from: `${y}-01-01`, to: `${y}-12-31`, today: f.today });
    const rows = (ws.investors || [])
      .filter((i) => i.type !== 'ira' && w8(i, f.today).foreign && ((i.positions || []).some((p) => p.offeringId === f.offeringId) || paid.some((p) => p.line.investorId === i.id)))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((i) => {
        const facts = w8(i, f.today);
        const mine = paid.filter((p) => p.line.investorId === i.id);
        return {
          investorId: i.id,
          name: i.title || i.contact || i.id,
          country: String(cert(i).country || ''),
          form: facts.form,
          signed: facts.signed,
          validUntil: facts.validUntil,
          ftinOnFile: facts.ftin,
          paid: mine.map((p) => ({ date: p.run.date, type: p.run.type || '', grossCents: p.line.grossCents, recomputed: !p.stored, runId: p.run.id })),
          withheld: mine.reduce((a, p) => a.concat((p.line.withheld || []).map((w) => ({ date: p.run.date, kind: w.kind, cents: w.cents, runId: p.run.id }))), [])
        };
      });
    const lines = [CSV_HEADER.map(cell).join(',')];
    rows.forEach((r) => {
      const head = [r.investorId, r.name, r.country, r.form, r.signed ? 'yes' : 'no', r.validUntil, r.ftinOnFile || 'not on file'];
      if (!r.paid.length) lines.push(head.concat(['', '', '', '', '', '']).map(cell).join(','));
      r.paid.forEach((p) => {
        const w = r.withheld.filter((x) => x.runId === p.runId);
        lines.push(head.concat([p.date, p.type, dollars(p.grossCents), dollars(w.reduce((a, x) => a + x.cents, 0)), w.map((x) => x.kind).join('; '), p.recomputed ? 'yes' : '']).map(cell).join(','));
      });
    });
    rows.forEach((r) => {
      r.paid.forEach((p) => delete p.runId);
      r.withheld.forEach((x) => delete x.runId);
    });
    return { rows, csv: lines.join('\r\n') + '\r\n' };
  }

  const API = { REPORTING, reporting, setReporting, RATE, amount, KINDS, STOPS, DEPOSIT_RULES, w8, payee, propose, foreignDraft, enteredDraft, confirm, remove, toWithheld, undecided, addNotice, endNotice, markExempt, unmarkExempt, withheldFor, totals, addDeposit, worksheet };
  if (NS) NS.withholding = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
