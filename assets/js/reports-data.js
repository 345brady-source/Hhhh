/*
 * Investor report figures: read-only adapters that hand every report section its numbers.
 *
 * Every figure comes from the engine the audit and CPA packages already use (NS.audit, NS.ops, NS.data, NS.books), so
 * an investor report agrees with them to the cent; nothing here works a figure out a second way. Money is integer cents,
 * dates are 'YYYY-MM-DD'. A period's from and to go through NS.audit.snap (month-end valuations) and the snapped dates
 * are what each result carries. Performance is net of fees and carried interest only. Nothing here writes to the
 * workspace.
 */
(function (root) {
  'use strict';
  const NS = (root.CVPortal = root.CVPortal || {});

  const A = () => NS.audit;
  const today = () => NS.dates.today();
  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o.id === id) || null;
  const curOf = (o) => (NS.structures ? NS.structures.curOf(o) : 'USD');
  const rowOf = (P, investorId) => P.inv.find((a) => a.investor.id === investorId) || null;
  const ACCT = ['begin', 'contrib', 'dist', 'income', 'gain', 'fee', 'carry', 'end'];
  function acct(P, a) {
    const out = { from: P.from, to: P.to };
    ACCT.forEach((k) => (out[k] = a[k]));
    return out;
  }
  const perfRow = (r) => ({ paid: r.paid, dist: r.dist, nav: r.nav, dpi: r.dpi, rvpi: r.rvpi, tvpi: r.tvpi, irr: r.irr });
  /** The books' state, read as NS.books.status shapes it: { start, closedThrough, entries, exceptions }. */
  const booksStatus = (ws, oid) => (NS.books ? NS.books.status(ws, oid) : { start: '', closedThrough: '', entries: 0, exceptions: 0 });
  /** Every paid run of the offering, oldest first. */
  const paidRuns = (ws, oid) =>
    (ws.runs || [])
      .filter((r) => r.offeringId === oid && NS.data.runPaid(r, today()))
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  /** How the investor is paid, by the rule the payment files and the journal use: ACH needs a bank account on file. */
  function methodOf(ws, investorId) {
    const inv = (ws.investors || []).find((i) => i.id === investorId);
    if (!inv) return '';
    const p = inv.payment || {};
    if (p.method === 'ach' && p.bank) return 'ACH';
    if (p.method === 'wire') return 'Wire';
    return 'Check';
  }

  /* ---------- Capital account statement ---------- */
  function statement(ws, investorId, offeringId, from, to) {
    const o = offeringOf(ws, offeringId);
    if (!o) return null;
    const P = A().period(ws, o, from, to);
    const a = rowOf(P, investorId);
    if (!a) return null;
    const Y = A().period(ws, o, P.to.slice(0, 4) + '-01-01', P.to);
    const I = A().period(ws, o, P.L.inception || P.to, P.to);
    const open = !!P.S.open;
    const generated = A().generated(o);
    // The engine's own performance function, given this investor's row only (the fund row is unchanged).
    const perf = open ? null : perfRow(A().closedPerformance(Object.assign({}, P, { inv: [a] })).investors[0]);
    return {
      offeringId: o.id,
      name: o.name,
      currency: curOf(o),
      fundType: P.S.key,
      open,
      generated,
      preliminary: !generated && (booksStatus(ws, o.id).closedThrough || '') < P.to,
      period: acct(P, a),
      ytd: acct(Y, rowOf(Y, investorId)),
      itd: acct(I, rowOf(I, investorId)),
      commit: a.commit,
      contribCum: a.contribCum,
      unfunded: open ? 0 : Math.max(0, a.commit - a.contribCum),
      distCum: a.distCum,
      own: a.own,
      cls: a.cls,
      feeder: a.feeder,
      perf
    };
  }

  /* ---------- Distributions ---------- */
  function distribution(ws, runId, investorId) {
    const run = (ws.runs || []).find((r) => r.id === runId);
    if (!run || !NS.data.runPaid(run, today())) return null;
    const line = NS.data.runRows(ws, run).find((r) => r.investor.id === investorId);
    if (!line) return null;
    const o = offeringOf(ws, run.offeringId);
    const cumulative = paidRuns(ws, run.offeringId)
      .filter((r) => r.date <= run.date)
      .reduce((s, r) => s + NS.data.runRows(ws, r).filter((x) => x.investor.id === investorId).reduce((t, x) => t + x.cents, 0), 0);
    return { runId: run.id, offeringId: run.offeringId, currency: curOf(o), date: run.date, type: run.type || '', gross: line.cents, withheld: line.withheldCents, net: line.netCents, method: methodOf(ws, investorId), cumulative };
  }

  /* ---------- Performance (net only) ---------- */
  function performance(ws, offeringId, from, to) {
    const o = offeringOf(ws, offeringId);
    if (!o) return null;
    const P = A().period(ws, o, from, to);
    if (!P.S.open) return { kind: 'closed', asOf: P.to, fund: perfRow(A().closedPerformance(Object.assign({}, P, { inv: [] })).fund) };
    const X = A().openPerformance(P);
    return {
      kind: 'open',
      asOf: P.to,
      monthly: X.monthly.map((m) => ({ key: m.key, begin: m.begin, contrib: m.contrib, dist: m.dist, net: m.net })),
      period: X.period,
      ytd: X.ytd,
      itd: X.itd,
      itdAnnual: X.itdAnnual
    };
  }

  NS.reportsData = { statement, distribution, performance };
})(typeof window !== 'undefined' ? window : globalThis);
