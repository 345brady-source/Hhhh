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

  const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const snapTo = (to) => A().snap(to, to).to;

  /* ---------- Who holds what ---------- */
  /** The offerings the investor holds a position in, by name. */
  function fundsOf(ws, investorId) {
    const inv = (ws.investors || []).find((i) => i.id === investorId);
    if (!inv) return [];
    return (ws.offerings || []).filter((o) => inv.positions.some((p) => p.offeringId === o.id)).sort(byName);
  }
  /** The investors with a position in the offering dated on or before `to`, by id. */
  function holders(ws, offeringId, to) {
    const t = snapTo(to);
    return (ws.investors || [])
      .filter((i) => i.positions.some((p) => p.offeringId === offeringId && p.date <= t))
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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

  /** One investor across funds: a statement per fund, and one total per currency (never a total across currencies). */
  const TOTAL = ['begin', 'contrib', 'dist', 'income', 'gain', 'fee', 'carry', 'end'];
  const HELD = ['commit', 'unfunded', 'distCum'];
  function consolidated(ws, investorId, from, to) {
    const funds = fundsOf(ws, investorId)
      .map((o) => statement(ws, investorId, o.id, from, to))
      .filter(Boolean);
    const totals = [];
    funds.forEach((s) => {
      let t = totals.find((x) => x.currency === s.currency);
      if (!t) {
        t = { currency: s.currency };
        TOTAL.concat(HELD).forEach((k) => (t[k] = 0));
        totals.push(t);
      }
      TOTAL.forEach((k) => (t[k] += s.period[k]));
      HELD.forEach((k) => (t[k] += s[k]));
    });
    return { funds, totals };
  }

  /* ---------- Distributions ---------- */
  /** The investor's line on a run, or null. */
  const lineOf = (ws, run, investorId) => NS.data.runRows(ws, run).find((x) => x.investor.id === investorId) || null;
  /** Every paid run of the offering, newest first (any paid run can produce a notice, past ones included). */
  function runs(ws, offeringId) {
    return paidRuns(ws, offeringId)
      .reverse()
      .map((r) => ({ id: r.id, date: r.date, type: r.type || '', gross: NS.data.runRows(ws, r).reduce((s, x) => s + x.cents, 0) }));
  }
  /** The investor's paid distributions from the offering in the period, with period, year-to-date and inception totals. */
  function distributions(ws, investorId, offeringId, from, to) {
    const p = A().snap(from, to);
    const mine = paidRuns(ws, offeringId)
      .filter((r) => r.date <= p.to)
      .map((r) => ({ r, x: lineOf(ws, r, investorId) }))
      .filter((z) => z.x)
      .map((z) => ({ runId: z.r.id, date: z.r.date, type: z.r.type || '', gross: z.x.cents, withheld: z.x.withheldCents, net: z.x.netCents }));
    const sum = (list) => ({ gross: list.reduce((s, x) => s + x.gross, 0), withheld: list.reduce((s, x) => s + x.withheld, 0), net: list.reduce((s, x) => s + x.net, 0) });
    const rows = mine.filter((x) => x.date >= p.from);
    return { rows, period: sum(rows), ytd: sum(mine.filter((x) => x.date >= p.to.slice(0, 4) + '-01-01')), itd: sum(mine) };
  }
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

  /* ---------- Holdings, property income, fees and the fund's statements ---------- */
  /** The schedule of investments at `to`, as the engine holds it (period().hold). */
  function holdings(ws, offeringId, to) {
    const o = offeringOf(ws, offeringId);
    if (!o) return null;
    const P = A().period(ws, o, to, to);
    const H = P.hold;
    return {
      asOf: P.to,
      nav: H.nav,
      rows: H.rows.map((r) => ({ id: (r.h && r.h.id) || '', name: r.name, security: r.security, level: r.level, fv: r.fv, cost: r.cost, debt: r.debt, equity: r.equity, pctNav: r.pctNav }))
    };
  }
  const inRange = (code, lo, hi) => code >= lo && code <= hi;
  /** A property's net operating income from the journal: income = minus the 4000-4090 lines, expenses = the 5300-5390 lines. */
  function noi(ws, offeringId, holdingId, from, to) {
    if (!NS.books || !holdingId) return null;
    const p = A().snap(from, to);
    const lines = NS.books.entries(ws, offeringId, { from: p.from, to: p.to, holding: holdingId });
    const inc = lines.filter((l) => inRange(l.code, '4000', '4090'));
    const exp = lines.filter((l) => inRange(l.code, '5300', '5390'));
    if (!inc.length && !exp.length) return null;
    const income = -inc.reduce((s, l) => s + l.cents, 0);
    const expenses = exp.reduce((s, l) => s + l.cents, 0);
    return { income, expenses, noi: income - expenses };
  }
  /** ILPA order of expense accounts: management fees, professional, administration, organizational, interest, property, other. */
  function feeRank(code) {
    const fixed = { 5000: 0, 5100: 1, 5110: 2, 5120: 3, 5200: 4, 5900: 6 };
    if (fixed[code] != null) return fixed[code];
    if (inRange(code, '5300', '5390')) return 5;
    return 7;
  }
  /** Fees and expenses for the period: the journal's expense accounts, or the engine's management fee for a fund without books. */
  function fees(ws, offeringId, from, to) {
    const o = offeringOf(ws, offeringId);
    if (!o) return null;
    const p = A().snap(from, to);
    if (!A().generated(o) && booksStatus(ws, o.id).entries > 0) {
      const rows = NS.books
        .trialBalance(ws, o.id, p.from, p.to)
        .filter((r) => r.type === 'expense' && r.debits - r.credits !== 0)
        .map((r) => ({ code: r.code, name: r.name, cents: r.debits - r.credits }))
        .sort((a, b) => feeRank(a.code) - feeRank(b.code) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
      return { source: 'books', rows, total: rows.reduce((s, r) => s + r.cents, 0) };
    }
    const fee = A().period(ws, o, from, to).fund.fee;
    return { source: 'engine', rows: [{ code: '5000', name: 'Management fees', cents: fee }], total: fee };
  }
  /**
   * The fund's statements of assets and liabilities, operations and changes in partners' capital, as the audit package
   * builds them. Built on a copy of the workspace, so nothing the build does can write to the caller's.
   */
  function statements(ws, offeringId, from, to) {
    const copy = JSON.parse(JSON.stringify(ws));
    const o = offeringOf(copy, offeringId);
    if (!o) return null;
    const list = A().build(copy, o, from, to).list;
    return ['al', 'ops', 'chg'].map((id) => list.find((s) => s.id === id)).filter(Boolean);
  }

  /* ---------- Activity and chart series ---------- */
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  /** The investor's contributions, distributions and redemptions in the period, as the engine records them, by date. */
  function activity(ws, investorId, offeringId, from, to) {
    const o = offeringOf(ws, offeringId);
    if (!o) return [];
    const P = A().period(ws, o, from, to);
    const L = P.L;
    const mine = (x) => x.inv.id === investorId && x.date >= P.from && x.date <= P.to;
    const out = [];
    L.contribs.filter(mine).forEach((c) => out.push({ date: c.date, kind: 'contribution', label: c.kind, cents: c.cents }));
    L.dists.filter(mine).forEach((d) => out.push({ date: d.date, kind: 'distribution', label: d.run.type || 'Distribution', cents: d.cents }));
    (L.redemptions || []).filter(mine).forEach((r) => out.push({ date: r.date, kind: 'redemption', label: `Redemption (${r.req && r.req.full ? 'full' : 'partial'})`, cents: r.cents }));
    return out.sort(byDate);
  }
  /**
   * Month-end capital (the investor's row end, or the fund's limited partners' capital when investorId is null) and
   * distributions per calendar quarter in the period, from the engine's monthly ledger.
   */
  function series(ws, offeringId, investorId, from, to) {
    const o = offeringOf(ws, offeringId);
    if (!o) return null;
    const P = A().period(ws, o, from, to);
    if (investorId && !rowOf(P, investorId)) return null;
    const capital = P.ms.map((m) => ({ key: m.key, cents: investorId ? m.rows[investorId].end : m.endCap }));
    const dist = [];
    const fy = Number(P.from.slice(0, 4));
    const fq = Math.ceil(Number(P.from.slice(5, 7)) / 3);
    const ty = Number(P.to.slice(0, 4));
    const tq = Math.ceil(Number(P.to.slice(5, 7)) / 3);
    for (let y = fy, q = fq; y < ty || (y === ty && q <= tq); q === 4 ? ((q = 1), y++) : q++) dist.push({ label: `Q${q} ${y}`, y, q, cents: 0 });
    P.ms.forEach((m) => {
      const y = Number(m.key.slice(0, 4));
      const q = Math.ceil(Number(m.key.slice(5, 7)) / 3);
      const slot = dist.find((d) => d.y === y && d.q === q);
      if (slot) slot.cents += investorId ? m.rows[investorId].dist : m.dist;
    });
    return { capital, dist: dist.map((d) => ({ label: d.label, cents: d.cents })) };
  }

  /* ---------- Tax year and tax documents (the investor's own; never a taxpayer number) ---------- */
  function taxYear(ws, investorId, year) {
    const y = String(year);
    const funds = fundsOf(ws, investorId)
      .map((o) => {
        const runsIn = paidRuns(ws, o.id)
          .filter((r) => r.date.slice(0, 4) === y)
          .map((r) => ({ r, x: lineOf(ws, r, investorId) }))
          .filter((z) => z.x)
          .map((z) => ({ runId: z.r.id, date: z.r.date, type: z.r.type || '', gross: z.x.cents, withheld: z.x.withheldCents, net: z.x.netCents }));
        if (!runsIn.length) return null;
        const sum = (k) => runsIn.reduce((s, r) => s + r[k], 0);
        return { offeringId: o.id, name: o.name, currency: curOf(o), gross: sum('gross'), withheld: sum('withheld'), net: sum('net'), runs: runsIn };
      })
      .filter(Boolean);
    return { year: Number(year), funds };
  }
  function taxDocs(ws, investorId, year) {
    const kinds = (NS.taxdocs && NS.taxdocs.KINDS) || {};
    return (ws.docs || [])
      .filter((d) => d && d.tax && Array.isArray(d.investors) && d.investors.length === 1 && d.investors[0] === investorId && String(d.tax.year) === String(year) && d.tax.state !== 'withdrawn')
      .map((d) => ({ docId: d.id, offeringId: d.offeringId || '', kind: d.tax.kind, label: (kinds[d.tax.kind] || {}).label || '', year: Number(d.tax.year), state: d.tax.state || '', availableUntil: d.tax.availableUntil || '' }));
  }

  /* ---------- Firm and investor blocks ---------- */
  function firm(ws) {
    const t = ws.tenant || {};
    return { name: t.name, shortName: t.shortName, legalName: t.legalName, portalName: t.portalName, colors: t.colors, logo: t.logo, support: t.support, disclaimer: t.disclaimer };
  }
  function investor(ws, investorId) {
    const i = (ws.investors || []).find((x) => x.id === investorId);
    if (!i) return null;
    return { id: i.id, title: i.title || '', contact: i.contact || '', firstName: String(i.contact || '').split(' ')[0] };
  }

  NS.reportsData = { fundsOf, holders, statement, consolidated, runs, distribution, distributions, activity, performance, holdings, noi, fees, statements, series, taxYear, taxDocs, firm, investor };
})(typeof window !== 'undefined' ? window : globalThis);
