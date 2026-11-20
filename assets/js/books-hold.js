/*
 * The inputs a sponsor types into the books (with bank decisions): fair values, opening balances and closing a month.
 *
 *   value(ws, offeringId, { holding, date, fvCents, doc }, { by, at }) → mark
 *       A fair value for an investment at a date. The change since its carrying amount at that date (1100 + 1150 for the
 *       holding) is posted as 'mark:<id>' [1150 +change, holding][6100 -change]; no entry when it has not changed. The
 *       mark { id, holding, date, fvCents, doc, at, by } is stored either way. An investment with no value stays at cost.
 *
 * Amounts are whole cents. The journal is written only through NS.books.post, so a closed period is refused by the
 * journal itself as well. Nothing is stored when anything is refused.
 */
(function (root) {
  'use strict';
  const NS = (root.CVPortal = root.CVPortal || {});
  const B = NS.books;
  if (!B) return;

  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  function isDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return NS.dates.isoOf(NS.dates.parse(s)) === s;
  }
  /** Cents as dollars for a memo, by integer arithmetic only. */
  function dollars(c) {
    const a = Math.abs(c);
    const whole = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (c < 0 ? '-$' : '$') + whole + '.' + String(a % 100).padStart(2, '0');
  }
  const stored = (ws, id) => {
    const f = ws && ws.books && ws.books.funds && ws.books.funds[id];
    return f && typeof f === 'object' ? f : null;
  };
  const listOf = (f, k) => (f && Array.isArray(f[k]) ? f[k] : []);
  /** A sentence for a closed period: the books are closed through `through`. */
  function closedSentence(through) {
    return `The books are closed through ${through}; reopen them to enter anything dated on or before that day.`;
  }

  /* ---------- Fair values (FA-05) ---------- */
  function value(ws, offeringId, v, who) {
    v = v || {};
    who = who || {};
    const f0 = stored(ws, offeringId);
    const h = listOf(f0, 'holdings').find((x) => x && x.id === v.holding);
    if (!h) throw new Error(`There is no investment ${v.holding} in this fund.`);
    if (!isDate(v.date)) throw new Error('The date is not a real calendar date written YYYY-MM-DD.');
    const fv = v.fvCents;
    if (typeof fv !== 'number' || !Number.isSafeInteger(fv) || fv < 0) throw new Error('A fair value must be a whole number of cents, not below zero.');
    if (v.doc != null && typeof v.doc !== 'string') throw new Error('The supporting document must be named in text.');
    const ct = B.closedThrough(ws, offeringId);
    if (ct && v.date <= ct) throw new Error(closedSentence(ct));
    // Values are entered in date order: a value dated before the holding's latest one would change what that one posted.
    let latest = '';
    listOf(f0, 'marks').forEach((m) => {
      if (m && m.holding === h.id && typeof m.date === 'string' && m.date > latest) latest = m.date;
    });
    if (latest && v.date < latest) throw new Error(`A later value exists (${latest}); enter values in date order.`);
    const carrying = B.balance(ws, offeringId, ['1100', '1150'], v.date, { holding: h.id });
    const change = fv - carrying;
    if (!Number.isSafeInteger(change)) throw new Error('The change in value is too large to be held exactly.');
    const f = B.fund(ws, offeringId);
    // An id is never reused, not even one whose entry is in the journal without its mark.
    const used = new Set(f.marks.map((m) => m && m.id));
    f.journal.forEach((e) => e && typeof e.src === 'string' && e.src.indexOf('mark:') === 0 && used.add(e.src.slice(5)));
    let n = f.marks.length + 1;
    while (used.has('m-' + n.toString(36))) n++;
    const mark = { id: 'm-' + n.toString(36), holding: h.id, date: v.date, fvCents: fv, doc: v.doc == null ? '' : v.doc, at: who.at || new Date().toISOString(), by: who.by || '' };
    // Posted first: when the journal refuses it, no mark is stored.
    if (change !== 0) B.post(ws, offeringId, { date: v.date, memo: `${h.name} valued at ${dollars(fv)}`, src: 'mark:' + mark.id, lines: [['1150', change, '', h.id], ['6100', -change]] }, who);
    f.marks.push(mark);
    return clone(mark);
  }

  Object.assign(B, { value });
})(typeof window !== 'undefined' ? window : globalThis);
