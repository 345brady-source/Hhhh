/*
 * Posting from records: every money record the portal already keeps becomes journal entries, once, keyed by the record.
 *
 * desired(ws, o, { today }) works out every entry the records call for; sync(ws, { today, by }) brings each fund's
 * journal in step with it. Which records count is the capital-account engine's decision (NS.audit.ledger) and the
 * distribution record's (NS.data.runRows, plan 10-01); nothing here decides it again, so the journal and the capital
 * accounts count the same events.
 *
 *   call:<callId>:<investorId>   a capital call payment          [1000 +][3000 - investor]
 *   pos:<investorId>:<date>:<n>  a funded subscription or closing [1000 +][3000 - investor]
 *   run:<runId>                  a paid distribution              [3100 + investor] per investor (gross),
 *                                [1000 -] the total paid by ACH, [1000 - investor] each payment made otherwise
 *   fee:<offeringId>:<YYYY-MM>   the month's management fee       [5000 +][2100 -]
 *
 * Amounts are whole cents throughout. The books are written only through NS.books.post, so a src that already has a
 * live entry is never posted twice. Nothing here writes the change log.
 */
(function (root) {
  'use strict';
  const NS = (root.CVPortal = root.CVPortal || {});
  const B = NS.books;
  if (!B) return;

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const AUTO = 'Portal (automatic)';
  const ln = (code, cents, partner) => (partner ? [code, cents, partner] : [code, cents]);
  function endOf(k) {
    const [y, m] = k.split('-').map(Number);
    return NS.dates.isoOf(new Date(Date.UTC(y, m, 0)));
  }
  const monthLabel = (k) => `${MON[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
  const offeringOf = (ws, o) => (o && typeof o === 'object' ? o : ((ws && ws.offerings) || []).find((x) => x && x.id === o) || null);
  const byDateSrc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.src < b.src ? -1 : a.src > b.src ? 1 : 0);
  /** ACH with a bank on file: the test the audit engine's bank evidence uses (runEvidence). */
  const paysByAch = (inv) => !!(inv && inv.payment && inv.payment.method === 'ach' && inv.payment.bank);
  /** The fund's books start date ('' when the books run from inception). Reads only. */
  function startOf(ws, id) {
    const f = ws && ws.books && ws.books.funds && ws.books.funds[id];
    return f && typeof f.start === 'string' ? f.start : '';
  }
  /** Add a listed item to fund.exceptions once (the same item already there is not added again). */
  function note(f, item) {
    const key = JSON.stringify(Object.assign({}, item, { found: undefined }));
    if (f.exceptions.some((x) => JSON.stringify(Object.assign({}, x, { found: undefined })) === key)) return false;
    f.exceptions.push(item);
    return true;
  }

  /** { entries, notes } for one offering: notes are the records the books list for a person to look at. */
  function plan(ws, o, opts) {
    opts = opts || {};
    const today = NS.dates.today();
    if (opts.today != null && opts.today !== '' && opts.today !== today) throw new Error(`The books are posted as of the portal's day (${today}); ${opts.today} was given.`);
    if (!o) throw new Error('There is no such offering in this workspace.');
    const L = NS.audit.ledger(ws, o);
    const entries = [];
    const notes = [];
    const used = new Set();
    const add = (src, date, memo, lines) => {
      used.add(src);
      // A record holding an amount that is not whole cents is not posted; it is listed instead.
      const odd = lines.find((l) => !Number.isSafeInteger(l[1]));
      if (odd) return notes.push({ src, kind: 'amount', account: odd[0], value: String(odd[1]) });
      const kept = lines.filter((l) => l[1] !== 0);
      if (kept.length < 2) return;
      entries.push({ src, date, memo, lines: kept });
    };

    // Contributions: call payments and funded positions, as the engine counts them.
    const calls = (ws.calls || []).filter((c) => c && c.offeringId === o.id);
    const nth = {};
    L.contribs.forEach((c) => {
      const id = c.inv.id;
      let src;
      if (c.call != null) {
        const paid = (x) => (x.items || []).some((it) => it && it.investorId === id && it.received === c.date && it.cents === c.cents);
        const call = calls.find((x) => x.number === c.call && paid(x) && !used.has(`call:${x.id}:${id}`)) || calls.find((x) => x.number === c.call && paid(x)) || calls.find((x) => x.number === c.call);
        src = `call:${call ? call.id : c.call}:${id}`;
        for (let n = 2; used.has(src); n++) src = `call:${call ? call.id : c.call}:${id}:${n}`;
      } else {
        const k = id + '|' + c.date;
        const n = nth[k] || 0;
        nth[k] = n + 1;
        src = `pos:${id}:${c.date}:${n}`;
      }
      add(src, c.date, `${c.kind}: ${id}`, [ln('1000', c.cents), ln('3000', -c.cents, id)]);
    });

    // Distributions: the engine's paid runs (L.dists, and L.strays for a line whose investor no longer holds the fund),
    // gross from the engine, withheld and net from the stored lines.
    const runs = new Map();
    const group = (run) => runs.get(run.id) || runs.set(run.id, { run, gross: new Map(), strays: [] }).get(run.id);
    L.dists.forEach((d) => {
      const g = group(d.run);
      g.gross.set(d.inv.id, (g.gross.get(d.inv.id) || 0) + d.cents);
    });
    (L.strays || []).forEach((s) => {
      const g = group(s.run);
      g.gross.set(s.investorId, (g.gross.get(s.investorId) || 0) + s.cents);
      g.strays.push(s);
    });
    Array.from(runs.values())
      .sort((a, b) => (a.run.date < b.run.date ? -1 : a.run.date > b.run.date ? 1 : a.run.id < b.run.id ? -1 : a.run.id > b.run.id ? 1 : 0))
      .forEach((g) => {
        const run = g.run;
        const src = `run:${run.id}`;
        const rows = NS.data.runRows(ws, run).filter((r) => g.gross.has(r.investor.id));
        const lines = [];
        // Gross to each investor's capital; tax withheld owed until it is paid over; then the cash that left the fund.
        rows.forEach((r) => lines.push(ln('3100', g.gross.get(r.investor.id), r.investor.id)));
        rows.forEach((r) => lines.push(ln('2400', -(g.gross.get(r.investor.id) - r.netCents), r.investor.id)));
        let ach = 0;
        const other = [];
        rows.forEach((r) => {
          const inv = (ws.investors || []).find((i) => i.id === r.investor.id) || r.investor;
          if (paysByAch(inv)) ach += r.netCents;
          else other.push(ln('1000', -r.netCents, r.investor.id));
        });
        lines.push(ln('1000', -ach));
        other.forEach((l) => lines.push(l));
        // The general partner's share paid with the distribution (carried interest), deducted from nobody's capital.
        if (run.gp > 0) lines.push(ln('3300', run.gp), ln('1000', -run.gp));
        g.strays.forEach((s) => notes.push({ src, kind: 'stray', investorId: s.investorId, cents: s.cents }));
        add(src, run.date, `Distribution ${run.id}`, lines);
      });

    // Redemptions: capital out at the dealing date (owed), then the payment. The engine's cents are posted; a payment
    // recorded above them is listed for a person to look at.
    (L.redemptions || []).forEach((x) => {
      const q = x.req;
      const id = x.inv.id;
      add(`req:${q.id}`, x.date, `Redemption ${q.id}: ${id}`, [ln('3100', x.cents, id), ln('2200', -x.cents)]);
      if (q.status === 'paid' && q.paid) {
        add(`reqpaid:${q.id}`, q.paid, `Redemption paid ${q.id}: ${id}`, [ln('2200', x.cents), ln('1000', -x.cents, id)]);
        if (q.paidCents != null && q.paidCents > x.cents) notes.push({ src: `reqpaid:${q.id}`, kind: 'overpaid', investorId: id, cents: q.paidCents - x.cents });
      }
    });

    // Management fees and the general partner's crystallized share, month by month, as the engine works them out.
    const gpWord = L.S && L.S.open ? 'Incentive allocation' : 'Carried interest';
    L.keys.forEach((k) => {
      const F = L.byKey[k];
      if (!F) return;
      if (F.fee > 0) add(`fee:${o.id}:${k}`, endOf(k), `Management fee ${monthLabel(k)}`, [ln('5000', F.fee), ln('2100', -F.fee)]);
      if (F.gpOut > 0) add(`gp:${o.id}:${k}`, endOf(k), `${gpWord} ${monthLabel(k)}`, [ln('3300', F.gpOut), ln('2600', -F.gpOut)]);
    });

    // Books started part-way: nothing dated before the start is posted from records.
    const start = startOf(ws, o.id);
    const kept = start ? entries.filter((e) => e.date >= start) : entries;
    kept.sort(byDateSrc);
    return { entries: kept, notes: start ? notes.filter((n) => kept.some((e) => e.src === n.src)) : notes };
  }

  /** Every entry the records of offering o call for, by date then src. Reads only. */
  function desired(ws, o, opts) {
    return plan(ws, offeringOf(ws, o), opts).entries;
  }

  /** Bring every fund's journal in step with its records. Returns counts { posted, reversed, exceptions }. */
  function sync(ws, opts) {
    opts = opts || {};
    const who = { by: opts.by || AUTO, at: opts.at };
    const out = { posted: 0, reversed: 0, exceptions: 0 };
    if (typeof NS.clearCaches === 'function') NS.clearCaches();
    const found = opts.today || NS.dates.today();
    ((ws && ws.offerings) || []).forEach((o) => {
      if (!o || !o.id) return;
      const P = plan(ws, o, opts);
      P.entries.forEach((d) => {
        const f = ws.books && ws.books.funds && ws.books.funds[o.id];
        if (f && B.live(f, d.src)) return;
        B.post(ws, o.id, d, who);
        out.posted++;
      });
      if (P.notes.length) {
        const f = B.fund(ws, o.id);
        P.notes.forEach((n) => note(f, Object.assign({}, n, { found })) && out.exceptions++);
      }
    });
    if ((out.posted || out.reversed || out.exceptions) && NS.workspace && typeof NS.workspace.save === 'function') NS.workspace.save(ws);
    return out;
  }

  Object.assign(B, { desired, sync });
})(typeof window !== 'undefined' ? window : globalThis);
