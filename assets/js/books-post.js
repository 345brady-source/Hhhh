/*
 * Posting from records: every money record the portal already keeps becomes journal entries, once, keyed by the record.
 *
 * desired(ws, o, { today }) works out every entry the records call for; sync(ws, { today, by }) brings each fund's
 * journal in step with it. Which records count is the capital-account engine's decision (NS.audit.ledger) and the
 * distribution record's (NS.data.runRows, plan 10-01); nothing here decides it again, so the journal and the capital
 * accounts count the same events.
 *
 *   call:<callId>:<investorId>   a capital call payment, dated the day received   [1000 +][3000 - investor]
 *   pos:<investorId>:<date>:<n>  a funded subscription or closing (n counts that investor's positions above zero in
 *                                this offering on that date, from 0, in stored order)   [1000 +][3000 - investor]
 *   run:<runId>                  a paid distribution: [3100 + investor] gross per investor; [2400 - investor] tax
 *                                withheld, owed until paid over; [1000 -] the total paid by ACH; [1000 - investor] each
 *                                payment made otherwise; [3300 +][1000 -] the general partner's share (run.gp)
 *   ret:<runId>:<investorId>     a paid run's line the bank returned (line.ach, status 'returned' or 'repaid'), dated
 *                                the return day: cash back in, owed to that investor until paid again (C-07)
 *                                [1000 + investor][2000 - investor]; the run's own entry is not changed
 *   repaid:<runId>:<investorId>  that line paid again (ach.repaid: a new file, a check or a wire), on the day paid
 *                                [2000 + investor][1000 - investor]
 *   req:<requestId>              a redemption at its dealing date                  [3100 + investor][2200 -]
 *   reqpaid:<requestId>          its payment, on the day paid                       [2200 +][1000 - investor]
 *   reqret:<requestId>           a paid redemption's payment the bank returned (request.ach), dated the return day
 *                                [1000 + investor][2200 -]
 *   reqrepaid:<requestId>        that payment made again, on the day paid           [2200 +][1000 - investor]
 *                                The four return kinds post ach.cents, which must be the line's netCents (the request's
 *                                paidCents), and sit on top of a sample fund's generated figures (sample()).
 *   fee:<offeringId>:<YYYY-MM>   the month's management fee, at the month-end      [5000 +][2100 -]
 *   gp:<offeringId>:<YYYY-MM>    the general partner's share crystallized that month, less what was paid with a
 *                                distribution that month (already in its run: entry), owed until paid [3300 +][2600 -]
 *   sim:<offeringId>:<YYYY-MM>   sample funds only (NS.audit.generated): the generator's income [4090 -] and gain
 *                                [6100 -], and the balance sheet moved to the one the Audit page shows at the month-end;
 *                                left out and listed ({ src, kind: 'unbalanced', cents }) when it does not balance (sample())
 * Entries dated before the fund's books start (fund.start) are left out.
 *
 * sync posts what is missing; reverses (dated its own date) and posts again an entry whose record changed inside an
 * open period; reverses one whose record no longer calls for it. When the old or the new date is on or before the last
 * closed month-end nothing is changed for that record and fund.exceptions lists it once:
 *   { kind: 'closed', src, date, wasDate, was, now, found }   (was or now null when there is no entry on that side)
 * It also lists, once each: { src, kind: 'stray', investorId, cents } (a distribution line for an investor who does not
 * hold the fund, posted to 3100), { src, kind: 'overpaid', investorId, cents } (a redemption paid above the engine's
 * amount, which is what is posted), { src, kind: 'amount', account, value } and { src, kind: 'mismatch', investorId,
 * cents, recorded } (a record that cannot be posted as it stands; its live entry, if any, is left as it is). A return
 * whose ach.cents is not the amount paid is { src, kind: 'amount', account: '1000', value }; one whose date (ach.date or
 * ach.repaid.on) is not a real date is { src, kind: 'date', value }; neither is posted.
 *
 * Amounts are whole cents throughout. The books are written only through NS.books.post and NS.books.reverse (so a src
 * with a live entry is never posted twice, and a closed period is refused by the journal itself as well). Lines carry
 * investor ids only. Nothing here writes the change log; sync saves the workspace when something changed.
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
  /** Record prefixes this module owns; entries with any other prefix (mark:, bank:, open:, man:, rev:) are never touched. */
  const MANAGED = /^(call|pos|run|ret|repaid|req|reqpaid|reqret|reqrepaid|fee|gp|sim):/;
  /** The returned payments and their second payments (C-07). */
  const RETURNS = /^(ret|repaid|reqret|reqrepaid):/;
  /** [code, cents, partner, holding] with trailing empty ids left out (the stored form, as books.js compacts a line). */
  function compact(l) {
    const out = l.slice();
    while (out.length < 4) out.push('');
    if (out[2] == null) out[2] = '';
    if (out[3] == null) out[3] = '';
    while (out.length > 2 && out[out.length - 1] === '') out.pop();
    return out;
  }
  const same = (a, b) => JSON.stringify((a || []).map(compact)) === JSON.stringify((b || []).map(compact));
  /** The fund's live entries with a managed prefix, by src (none is reversed and none is a reversal). */
  function liveManaged(ws, id) {
    const out = new Map();
    const f = ws.books && ws.books.funds && ws.books.funds[id];
    const j = f && Array.isArray(f.journal) ? f.journal : [];
    const reversed = new Set();
    j.forEach((e) => e && e.rev && reversed.add(e.rev));
    j.forEach((e) => {
      if (e && !e.rev && !reversed.has(e.id) && typeof e.src === 'string' && MANAGED.test(e.src) && !out.has(e.src)) out.set(e.src, e);
    });
    return out;
  }
  /** Add a listed item to fund.exceptions once (the same item already there is not added again). */
  function note(f, item) {
    const key = JSON.stringify(Object.assign({}, item, { found: undefined }));
    if (f.exceptions.some((x) => JSON.stringify(Object.assign({}, x, { found: undefined })) === key)) return false;
    f.exceptions.push(item);
    return true;
  }

  /**
   * { entries, notes, hold } for one offering: notes are the items the books list for a person to look at; hold names
   * the records that cannot be posted as they stand (their live entry, if any, is left as it is).
   */
  function plan(ws, o, opts) {
    opts = opts || {};
    const today = NS.dates.today();
    if (opts.today != null && opts.today !== '' && opts.today !== today) throw new Error(`The books are posted as of the portal's day (${today}); ${opts.today} was given.`);
    if (!o) throw new Error('There is no such offering in this workspace.');
    const L = NS.audit.ledger(ws, o);
    const entries = [];
    const flagged = [];
    const flag = (date, item, held) => flagged.push({ date, item, held: !!held });
    const used = new Set();
    const add = (src, date, memo, lines) => {
      used.add(src);
      // A record holding an amount that is not whole cents is not posted; it is listed instead.
      const odd = lines.find((l) => !Number.isSafeInteger(l[1]));
      if (odd) return flag(date, { src, kind: 'amount', account: odd[0], value: String(odd[1]) }, true);
      const kept = lines.filter((l) => l[1] !== 0);
      if (kept.length < 2) return;
      entries.push({ src, date, memo, lines: kept });
    };
    // A returned payment or its second payment is posted only as recorded: the amount that was paid, in whole cents above
    // zero, and a real date. Otherwise nothing is posted for it and it is listed (fallback dates the listing).
    const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && NS.dates.isoOf(NS.dates.parse(s)) === s;
    const returnable = (a, paid, src, date, fallback) => {
      if (!Number.isSafeInteger(a.cents) || a.cents <= 0 || a.cents !== paid) return void flag(isDay(date) ? date : fallback, { src, kind: 'amount', account: '1000', value: String(a.cents) }, true);
      if (!isDay(date)) return void flag(fallback, { src, kind: 'date', value: String(date) }, true);
      return true;
    };

    // Contributions: call payments and funded positions, as the engine counts them (its event list, which runs no
    // allocation; fees, the GP's entries, distributions and redemptions below still come from the engine's ledger, whose
    // journal reads leave out 5000, 2100, 2600 and 3300, so what is posted here never feeds back into it).
    const calls = (ws.calls || []).filter((c) => c && c.offeringId === o.id);
    const nth = {};
    NS.audit.events(ws, o).contribs.forEach((c) => {
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
        // The engine's gross must be the stored line's (both read the same record); otherwise nothing is posted for the run.
        const off = rows.find((r) => g.gross.get(r.investor.id) !== r.withheldCents + r.netCents || r.withheldCents < 0 || r.netCents < 0);
        if (off) return flag(run.date, { src, kind: 'mismatch', investorId: off.investor.id, cents: g.gross.get(off.investor.id), recorded: off.withheldCents + off.netCents }, true);
        const lines = [];
        // Gross to each investor's capital; tax withheld owed until it is paid over; then the cash that left the fund.
        rows.forEach((r) => lines.push(ln('3100', g.gross.get(r.investor.id), r.investor.id)));
        rows.forEach((r) => lines.push(ln('2400', -r.withheldCents, r.investor.id)));
        let ach = 0;
        const other = [];
        rows.forEach((r) => {
          const inv = (ws.investors || []).find((i) => i.id === r.investor.id) || r.investor;
          if (paysByAch(inv)) ach += r.netCents;
          else other.push(ln('1000', -r.netCents, r.investor.id));
        });
        lines.push(ln('1000', -ach));
        other.forEach((l) => lines.push(l));
        // The general partner's share paid with the distribution (carried interest): its distribution in the month paid,
        // which the engine takes out of the investors' capital and accrued share (F-3).
        if (run.gp > 0) lines.push(ln('3300', run.gp), ln('1000', -run.gp));
        g.strays.forEach((s) => flag(run.date, { src, kind: 'stray', investorId: s.investorId, cents: s.cents }));
        add(src, run.date, `Distribution ${run.id}`, lines);
      });

    // Returned payments (C-07): a distribution line the bank sent back is cash back in and owed to that investor (2000)
    // until it is paid again. The run's own entry is never touched, so gross, tax withheld and net stay as recorded.
    (ws.runs || [])
      .filter((run) => run && run.offeringId === o.id && NS.data.runPaid(run, today))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .forEach((run) => {
        const lr = NS.data.runLines(ws, run);
        if (!lr.stored) return;
        lr.lines.forEach((line) => {
          const a = line && line.ach;
          if (!a || (a.status !== 'returned' && a.status !== 'repaid')) return;
          const id = line.investorId;
          const src = `ret:${run.id}:${id}`;
          if (!returnable(a, line.netCents, src, a.date, run.date)) return;
          add(src, a.date, `Returned distribution ${run.id}: ${id}`, [ln('1000', a.cents, id), ln('2000', -a.cents, id)]);
          // Paid again (a new file, a check or a wire): the amount owed is paid off and the cash leaves on the day paid.
          if (!a.repaid || typeof a.repaid !== 'object') return;
          const src2 = `repaid:${run.id}:${id}`;
          if (returnable(a, line.netCents, src2, a.repaid.on, a.date)) add(src2, a.repaid.on, `Distribution paid again ${run.id}: ${id}`, [ln('2000', a.cents, id), ln('1000', -a.cents, id)]);
        });
      });

    // Redemptions: capital out at the dealing date (owed), then the payment. The engine's cents are posted; a payment
    // recorded above them is listed for a person to look at.
    (L.redemptions || []).forEach((x) => {
      const q = x.req;
      const id = x.inv.id;
      add(`req:${q.id}`, x.date, `Redemption ${q.id}: ${id}`, [ln('3100', x.cents, id), ln('2200', -x.cents)]);
      if (q.status === 'paid' && q.paid) {
        add(`reqpaid:${q.id}`, q.paid, `Redemption paid ${q.id}: ${id}`, [ln('2200', x.cents), ln('1000', -x.cents, id)]);
        if (q.paidCents != null && q.paidCents > x.cents) flag(q.paid, { src: `reqpaid:${q.id}`, kind: 'overpaid', investorId: id, cents: q.paidCents - x.cents });
        // Its payment sent back by the bank: cash back in and the redemption owed again (2200, the account it was paid
        // from), until it is paid again.
        const a = q.ach;
        if (!a || (a.status !== 'returned' && a.status !== 'repaid')) return;
        const src = `reqret:${q.id}`;
        if (!returnable(a, q.paidCents, src, a.date, q.paid)) return;
        add(src, a.date, `Returned redemption payment ${q.id}: ${id}`, [ln('1000', a.cents, id), ln('2200', -a.cents)]);
        if (!a.repaid || typeof a.repaid !== 'object') return;
        const src2 = `reqrepaid:${q.id}`;
        if (returnable(a, q.paidCents, src2, a.repaid.on, a.date)) add(src2, a.repaid.on, `Redemption paid again ${q.id}: ${id}`, [ln('2200', a.cents), ln('1000', -a.cents, id)]);
      }
    });

    // Management fees and the general partner's crystallized share, month by month, as the engine works them out.
    const gpWord = L.S && L.S.open ? 'Incentive allocation' : 'Carried interest';
    L.keys.forEach((k) => {
      const F = L.byKey[k];
      if (!F) return;
      if (F.fee > 0) add(`fee:${o.id}:${k}`, endOf(k), `Management fee ${monthLabel(k)}`, [ln('5000', F.fee), ln('2100', -F.fee)]);
      // The share paid with a distribution that month (F.gpRun) is already in the run's entry; only the rest is owed.
      const owed = F.gpOut - (F.gpRun || 0);
      if (owed > 0) add(`gp:${o.id}:${k}`, endOf(k), `${gpWord} ${monthLabel(k)}`, [ln('3300', owed), ln('2600', -owed)]);
    });

    // Books started part-way: nothing dated before the start is posted from records.
    const start = startOf(ws, o.id);
    const after = (x) => !start || x.date >= start;
    const kept = entries.filter(after).sort(byDateSrc);
    const held = new Set(flagged.filter((x) => x.held && after(x)).map((x) => x.item.src));
    const unbalanced = NS.audit.generated(o) ? sample(ws, o, L, kept, flag, after, held) : [];
    kept.sort(byDateSrc);
    const fl = flagged.filter(after);
    return { entries: kept, unbalanced, notes: fl.map((x) => x.item), hold: new Set(fl.filter((x) => x.held).map((x) => x.item.src)) };
  }

  /**
   * What the fund's journal holds once sync has run, other than sample entries: every live entry a person or another
   * module made (mark:, bank:, man:, open:, any prefix this module does not own), and for each record this module posts
   * the entry sync leaves live (the one in list, or the live one when its period is closed or its record is held).
   */
  function projected(ws, o, list, hold) {
    const f = ws.books && ws.books.funds && ws.books.funds[o.id];
    const j = f && Array.isArray(f.journal) ? f.journal : [];
    const reversed = new Set();
    j.forEach((e) => e && e.rev && reversed.add(e.rev));
    const ct = B.closedThrough(ws, o.id);
    const closed = (date) => !!ct && date <= ct;
    const out = [];
    const mine = new Map();
    j.forEach((e) => {
      if (!e || e.rev || reversed.has(e.id) || !Array.isArray(e.lines) || typeof e.date !== 'string') return;
      const src = typeof e.src === 'string' ? e.src : '';
      if (!MANAGED.test(src)) out.push(e);
      else if (!/^sim:/.test(src) && !mine.has(src)) mine.set(src, e);
    });
    const want = new Set();
    list.forEach((d) => {
      want.add(d.src);
      const cur = mine.get(d.src);
      if (cur && cur.date === d.date && same(cur.lines, d.lines)) return out.push(cur);
      if ((cur && closed(cur.date)) || closed(d.date)) return cur && out.push(cur);
      out.push(d);
    });
    mine.forEach((cur, src) => !want.has(src) && (hold.has(src) || closed(cur.date)) && out.push(cur));
    return out.sort(byDateSrc);
  }

  /**
   * A sample fund (NS.audit.generated): one entry per month k of the engine's ledger, dated endOf(k), src
   * sim:<offeringId>:<k>. It credits the generator's income (4090) and gain (6100) and moves each balance-sheet account to
   * the balance the Audit page shows at that month-end (the holdings of NS.audit.period for the month): the line is the
   * target less the account's balance at endOf(k) over every live entry of the fund other than sample entries for month k
   * and later (11-CONTEXT W1: what sync leaves in the journal, so entries a person made count too), returned payments
   * and their second payments excepted (16-CONTEXT W2: they stay on top of the generator's figures). Zero lines are left
   * out. An entry whose lines do not sum to zero is not added: it is returned as { src, sum } and listed for a person to
   * look at. No line is ever added to make it balance. A month on or before the last closed month-end keeps its live
   * sample entry, which later months count. Adds to list (the fund's other entries); returns the unbalanced items.
   */
  function sample(ws, o, L, list, flag, after, hold) {
    const unbalanced = [];
    if (!L.keys.length) return unbalanced;
    const CODES = ['1000', '1100', '1150', '2300', '2100', '2200', '2500', '2600'];
    const bal = {};
    CODES.forEach((c) => (bal[c] = 0));
    const move = (lines) => lines.forEach((l) => bal[l[0]] !== undefined && (bal[l[0]] += l[1]));
    const base = projected(ws, o, list, hold);
    const ct = B.closedThrough(ws, o.id);
    const closed = (date) => !!ct && date <= ct;
    const liveSim = new Map();
    liveManaged(ws, o.id).forEach((e, src) => /^sim:/.test(src) && liveSim.set(src, e));
    let at = 0;
    L.keys.forEach((k) => {
      const end = endOf(k);
      // A returned payment and its second payment sit on top of the generator's figures (the engine pays every payment
      // once and knows no return), so they are left out of the balances the month is moved from: the sample entry is
      // what it would be without them, and the cash that came back and the amount owed again stay in the books.
      for (; at < base.length && base[at].date <= end; at++) if (!RETURNS.test(String(base[at].src || ''))) move(base[at].lines);
      const src = `sim:${o.id}:${k}`;
      const cur = liveSim.get(src);
      // A closed month: the journal keeps its live sample entry (sync lists any difference); later months count it.
      const keep = closed(end) || (cur && closed(cur.date));
      const F = L.byKey[k];
      const H = NS.audit.period(ws, o, k + '-01', end).hold;
      const target = { 1000: H.cash, 1100: H.longCost, 1150: H.longFV - H.longCost, 2300: -H.shortFV, 2100: -H.feePayable, 2200: -H.redemptionsPayable, 2500: -H.debt, 2600: 0 };
      const lines = [ln('4090', -F.income), ln('6100', -F.gain)];
      CODES.forEach((c) => lines.push(ln(c, target[c] - bal[c])));
      const kept = lines.filter((l) => l[1] !== 0);
      const e = { src, date: end, memo: `Sample fund: ${monthLabel(k)}`, lines: kept };
      let ok = false;
      if (kept.length && after(e)) {
        const sum = kept.reduce((a, l) => a + l[1], 0);
        if (sum !== 0 || kept.some((l) => !Number.isSafeInteger(l[1]))) {
          unbalanced.push({ src, sum });
          flag(end, { src, kind: 'unbalanced', cents: sum });
        } else {
          list.push(e);
          ok = true;
        }
      }
      if (keep) {
        if (cur) move(cur.lines);
      } else if (ok) move(kept);
    });
    return unbalanced;
  }

  /**
   * Every entry the records of offering o call for, by date then src. Reads only. The list's unbalanced property names
   * the sample entries left out because their lines do not sum to zero ({ src, sum }; empty for every other fund).
   */
  function desired(ws, o, opts) {
    const P = plan(ws, offeringOf(ws, o), opts);
    const out = P.entries;
    out.unbalanced = P.unbalanced;
    return out;
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
      const ct = B.closedThrough(ws, o.id);
      const closed = (date) => !!ct && date <= ct;
      const live = liveManaged(ws, o.id);
      const listClosed = (item) => note(B.fund(ws, o.id), Object.assign({ kind: 'closed' }, item, { found })) && out.exceptions++;
      const want = new Set();
      P.entries.forEach((d) => {
        want.add(d.src);
        const cur = live.get(d.src);
        if (cur && cur.date === d.date && same(cur.lines, d.lines)) return;
        // A closed period is never rewritten: the difference is listed with what was and what is now.
        if ((cur && closed(cur.date)) || closed(d.date)) return listClosed({ src: d.src, date: d.date, wasDate: cur ? cur.date : null, was: cur ? cur.lines.map(compact) : null, now: d.lines });
        if (cur) {
          B.reverse(ws, o.id, cur.id, { by: who.by, at: who.at, date: cur.date });
          out.reversed++;
        }
        B.post(ws, o.id, d, who);
        out.posted++;
      });
      // A record that no longer calls for its entry (cancelled, deleted, no longer counted): reversed, or listed if closed.
      live.forEach((cur, src) => {
        if (want.has(src) || P.hold.has(src)) return;
        if (closed(cur.date)) return listClosed({ src, date: cur.date, wasDate: cur.date, was: cur.lines.map(compact), now: null });
        B.reverse(ws, o.id, cur.id, { by: who.by, at: who.at, date: cur.date });
        out.reversed++;
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
