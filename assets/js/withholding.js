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
 * This file works on plain data only and needs nothing when it loads, so it also loads outside a browser (the checks,
 * and module.exports under Node). It moves no money and works out no due date.
 */
(function (NS) {
  'use strict';

  /* ---------- the offering's tax reporting type (only a person sets it) ---------- */
  const REPORTING = {
    partnership: { label: 'Partnership: Schedule K-1', backup: false, form: '' },
    notes: { label: 'Notes: Form 1099-INT', backup: true, form: '1099-int' },
    corp: { label: 'Corporation or REIT: Form 1099-DIV', backup: true, form: '1099-div' },
    other: { label: 'Other: documents from your CPA', backup: false, form: '' }
  };
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  const whole = (n) => typeof n === 'number' && Number.isInteger(n) && n > 0;
  const who = (by, what) => {
    if (typeof by !== 'string' || !by.trim()) throw new Error(`${what} needs the name of the person doing it.`);
    return by.trim();
  };
  const log = (ws, e) => (NS && NS.audit && NS.audit.log ? NS.audit.log(ws, e) : null);
  const offeringOf = (ws, id) => {
    const o = ((ws && ws.offerings) || []).find((x) => x.id === id);
    if (!o) throw new Error('No offering with this id.');
    return o;
  };

  /** The offering's reporting type, or '' until a person has set it. */
  function reporting(offering) {
    const k = offering && offering.tax && offering.tax.reporting;
    return REPORTING[k] ? k : '';
  }
  /** Set an offering's reporting type: one of the four keys, with who and when; one change-log entry. */
  function setReporting(ws, offeringId, key, opts) {
    opts = opts || {};
    if (!Object.prototype.hasOwnProperty.call(REPORTING, key)) throw new Error(`The tax reporting type must be one of: ${Object.keys(REPORTING).join(', ')}.`);
    const o = offeringOf(ws, offeringId);
    const by = who(opts.by, 'Setting the tax reporting type');
    const was = reporting(o);
    o.tax = Object.assign({}, o.tax || {}, { reporting: key, setBy: by, setAt: opts.at || new Date().toISOString() });
    log(ws, { action: 'Tax reporting type set', record: o.id, fund: o.id, detail: `${o.shortName || o.name || o.id}: ${REPORTING[key].label}${was && was !== key ? ` (was ${REPORTING[was].label})` : ''}`, actor: by });
    return o;
  }

  /* ---------- amounts ---------- */
  const RATE = { backup: 24, foreign: 30 };
  /**
   * The tax on an amount, in whole cents; half a cent rounds up. ratePct is a number from 0 to 100 (up to four decimal
   * places). Worked in integers: cents = round half up (basisCents x rate x 10,000 / 1,000,000).
   */
  function amount(basisCents, ratePct) {
    if (!Number.isInteger(basisCents) || basisCents < 0) throw new Error('The amount the tax is worked out on must be a whole number of cents.');
    const r = Number(ratePct);
    if (!(r >= 0 && r <= 100)) throw new Error('A rate must be between 0 and 100.');
    const scaled = BigInt(Math.round(r * 10000));
    const num = BigInt(basisCents) * scaled; // cents x rate x 10,000
    return Number((num * 2n + 1000000n) / 2000000n);
  }

  /* ---------- who the payee is ---------- */
  const taxOnFile = (i) => {
    const f = NS && NS.inviteFlow && NS.inviteFlow.taxOnFile;
    if (typeof f !== 'function') throw new Error('The rule for a tax form on file (onboarding) is not loaded.');
    return f(i);
  };
  const cert = (i) => (i && i.taxCert && typeof i.taxCert === 'object' ? i.taxCert : {});
  /** The last four digits of the U.S. taxpayer number on record (never a foreign number), or ''. */
  const last4 = (i) => {
    const v = String(cert(i).tinLast4 || (i && i.tinLast4) || '');
    return /^\d{4}$/.test(v) ? v : '';
  };
  /** A signed W-9 with a number on file (plan-check C4). */
  const signedW9 = (i) => !!i && taxOnFile(i) && i.taxForm === 'W-9' && cert(i).signed === true && !!last4(i);

  /** 'ira' | 'exempt' | 'foreign' | 'us' | 'undocumented' on a day. */
  function payee(i, date) {
    if (i && i.type === 'ira') return 'ira';
    if (i && i.exempt1099) return 'exempt';
    if (signedW9(i)) return 'us';
    return 'undocumented';
  }

  /* ---------- the proposal ---------- */
  const draft = (investorId, kind, basisCents, ratePct, cents, source, why) => ({ investorId, kind, basisCents, ratePct, cents, source, why, decided: '' });
  /**
   * Backup lines for an offering set to notes or to a corporation or REIT: one draft per payee on whom a listed condition
   * is true on the payment date (opts.date). lines: the distribution's lines (investorId, grossCents).
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
      if (p !== 'us') return;
      const why = [];
      if (cert(i).backupWithholding === true) why.push('The W-9 on file has certification item 2 crossed out: the investor has told you the IRS notified them they are subject to backup withholding.');
      if (!why.length) return;
      const cents = amount(line.grossCents, RATE.backup);
      if (cents > 0) out.push(draft(i.id, 'backup', line.grossCents, RATE.backup, cents, 'rule', why.join(' ')));
    });
    return out;
  }

  /* ---------- deciding ---------- */
  /** A confirmed draft: the w that plan 10-01's record stores, with the investor's id beside it. */
  function confirm(d, opts) {
    opts = opts || {};
    if (!d || d.decided === 'removed') throw new Error('A removed line cannot be confirmed.');
    const by = who(opts.by, 'Confirming tax withheld');
    d.decided = 'confirmed';
    return { investorId: d.investorId, kind: d.kind, cents: d.cents, basisCents: d.basisCents, ratePct: d.ratePct == null ? null : d.ratePct, source: d.source, why: d.why, confirmedBy: by, confirmedAt: opts.at || new Date().toISOString() };
  }
  /** Confirmed lines keyed by investor, the shape NS.data.buildLines takes; refuses anything not confirmed by a person. */
  function toWithheld(list) {
    const out = {};
    (list || []).forEach((w) => {
      if (!w || !w.investorId || !w.confirmedBy || !w.confirmedAt) throw new Error('Only a line a person has confirmed can be withheld.');
      (out[w.investorId] = out[w.investorId] || []).push({ kind: w.kind, cents: w.cents, basisCents: w.basisCents, ratePct: w.ratePct, source: w.source, why: w.why, confirmedBy: w.confirmedBy, confirmedAt: w.confirmedAt });
    });
    return out;
  }
  /** True while any draft is neither confirmed nor removed. */
  const undecided = (drafts) => (drafts || []).some((d) => !d.decided);

  const API = { REPORTING, reporting, setReporting, RATE, amount, payee, propose, confirm, toWithheld, undecided };
  if (NS) NS.withholding = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
