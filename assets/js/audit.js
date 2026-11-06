/*
 * Audit-ready fund data.
 *
 * For any fund and period this builds the schedules an auditor asks for (the
 * "provided by client" list), ties every schedule to the others, runs readiness
 * checks, and keeps a tamper-evident change log. Fund types are handled by
 * accounting profile:
 *
 *   closed-end drawdown (VC, PE, SPV, real estate, credit, real assets):
 *     contributions by capital call, carried interest over a preferred return
 *     accrued on a hypothetical-liquidation basis, quarterly valuations
 *   open-ended (hedge, digital asset, multi-strategy):
 *     subscriptions at month-end NAV, management fee on NAV, incentive
 *     allocation over a high-water mark crystallized each December
 *
 * Capital accounts run monthly and in whole cents. Income and gains are split
 * pro rata with a largest-remainder rule and fees are computed per investor, so
 * fund totals are always the exact sum of the investor rows.
 *
 * Sample firms: valuations and holdings are generated deterministically from
 * tenants.js. In production the valuation inputs come from the fund's books and
 * this engine produces the same package.
 */
(function (NS) {
  'use strict';
  const D = NS.dates;
  const { parse, isoOf } = D;
  const { rng, hashStr } = NS.data;

  /* ---------- Formatting ---------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  function money(c) {
    if (c == null) return '';
    const s = (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (c < 0 ? '−$' : '$') + s;
  }
  const dateShort = (s) => (s ? parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');
  const dateLong = (s) => (s ? parse(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');
  const monthName = (k) => parse(k + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

  /* ---------- Months ---------- */
  const keyOf = (s) => String(s).slice(0, 7);
  const nextKey = (k) => keyOf(D.addMonths(k + '-01', 1));
  const prevKey = (k) => keyOf(D.addMonths(k + '-01', -1));
  function endOf(k) {
    const [y, m] = k.split('-').map(Number);
    return isoOf(new Date(Date.UTC(y, m, 0)));
  }
  const monthsFrom = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
  /** Last completed month-end on or before a date. */
  function lastMonthEnd(s) {
    const k = keyOf(s);
    return endOf(k) === s ? s : endOf(prevKey(k));
  }

  /* ---------- Fund accounting profiles ---------- */
  const PROFILES = {
    vc: { label: 'Venture capital', structure: 'closed', mgmtFee: 0.025, feeBasis: 'commitment', carry: 0.2, pref: 0, mu: 0.17, vol: 0.06, marks: 3, yield: 0, cash: 0.04 },
    pe: { label: 'Private equity', structure: 'closed', mgmtFee: 0.02, feeBasis: 'commitment', carry: 0.2, pref: 0.08, mu: 0.14, vol: 0.035, marks: 3, yield: 0, cash: 0.03 },
    spv: { label: 'SPV / co-investment', structure: 'closed', mgmtFee: 0.01, feeBasis: 'contributed', carry: 0.2, pref: 0, mu: 0.12, vol: 0.04, marks: 3, yield: 0, cash: 0.01 },
    realestate: { label: 'Real estate', structure: 'closed', mgmtFee: 0.015, feeBasis: 'contributed', carry: 0.2, pref: 0.08, mu: 0.03, vol: 0.012, marks: 3, yield: 0, cash: 0.03 },
    credit: { label: 'Private credit', structure: 'closed', mgmtFee: 0.01, feeBasis: 'contributed', carry: 0, pref: 0, mu: 0, vol: 0.002, marks: 3, yield: 0, cash: 0.02 },
    realassets: { label: 'Real assets', structure: 'closed', mgmtFee: 0.015, feeBasis: 'contributed', carry: 0.15, pref: 0.08, mu: 0.015, vol: 0.012, marks: 3, yield: 0, cash: 0.03 },
    other: { label: 'Closed-end fund', structure: 'closed', mgmtFee: 0.01, feeBasis: 'contributed', carry: 0, pref: 0, mu: 0.06, vol: 0.01, marks: 3, yield: 0, cash: 0.03 },
    hedge: { label: 'Hedge fund', structure: 'open', mgmtFee: 0.015, feeBasis: 'nav', carry: 0.2, pref: 0, mu: 0.085, vol: 0.022, marks: 1, yield: 0.012, cash: 0.08 },
    digital: { label: 'Digital asset', structure: 'open', mgmtFee: 0.02, feeBasis: 'nav', carry: 0.2, pref: 0, mu: 0.3, vol: 0.13, marks: 1, yield: 0.008, cash: 0.02 },
    multistrat: { label: 'Multi-strategy', structure: 'open', mgmtFee: 0.015, feeBasis: 'nav', carry: 0.15, pref: 0, mu: 0.08, vol: 0.015, marks: 1, yield: 0.025, cash: 0.04 }
  };
  const FEE_BASIS = { commitment: 'Commitments (contributed capital after the 5-year investment period)', contributed: 'Contributed capital', nav: 'Net asset value' };

  /** Builtin configuration for an offering (workspaces saved before holdings existed fall back to it). */
  function seedConfig(o) {
    for (const t of NS.TENANTS) {
      const x = (t.offerings || []).find((y) => y.id === o.id);
      if (x) return x;
    }
    return null;
  }
  function settings(o) {
    const type = NS.OFFERING_TYPES[o.type] || NS.OFFERING_TYPES.Other;
    const key = PROFILES[type.profile] ? type.profile : 'other';
    const P = PROFILES[key];
    const a = o.accounting || {};
    const cfg = seedConfig(o) || {};
    const num = (v, d) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v) / 100);
    let yld = P.yield;
    if (cfg.seed && cfg.seed.rate) yld = cfg.seed.rate;
    else {
      const m = /([\d.]+)\s*%/.exec((o.distribution && o.distribution.target) || '');
      if (m && P.structure === 'closed') yld = Number(m[1]) / 100;
    }
    return {
      key,
      label: P.label,
      structure: P.structure,
      open: P.structure === 'open',
      mgmtFee: num(a.mgmtFee, P.mgmtFee),
      feeBasis: FEE_BASIS[a.feeBasis] ? a.feeBasis : P.feeBasis,
      carry: num(a.carry, P.carry),
      pref: num(a.pref, P.pref),
      mu: P.mu,
      vol: P.vol,
      marks: P.marks,
      cash: P.cash,
      yield: yld,
      holdings: o.holdings || cfg.holdings || [{ name: o.name, security: o.type, level: 3, method: 'Per the fund’s valuation policy', input: 'See valuation memo', weight: 100, cost: 0.9, support: { every: 3, doc: 'Quarterly valuation memo' } }],
      calls: o.calls || cfg.calls || null,
      sleeves: o.sleeves || cfg.sleeves || null,
      auditor: a.auditor || ''
    };
  }

  /* ---------- Exact splits ---------- */
  /** Split a whole number of cents across non-negative weights; largest remainder keeps the total exact. */
  function largest(total, weights) {
    const sum = weights.reduce((a, w) => a + w, 0);
    if (!sum || !total) return weights.map(() => 0);
    const sign = total < 0 ? -1 : 1;
    const T = Math.abs(total);
    const rows = weights.map((w, i) => {
      const exact = (T * w) / sum;
      return { i, base: Math.floor(exact), frac: exact - Math.floor(exact) };
    });
    let rem = T - rows.reduce((a, r) => a + r.base, 0);
    rows
      .slice()
      .sort((a, b) => b.frac - a.frac || a.i - b.i)
      .forEach((r) => {
        if (rem > 0) {
          r.base += 1;
          rem -= 1;
        }
      });
    return rows.map((r) => sign * r.base);
  }
  function gauss(R) {
    let u = 0;
    while (u === 0) u = R();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R());
  }

  /* ---------- The ledger: monthly capital accounts from inception ---------- */
  const cache = new Map();
  const prevClear = NS.clearCaches;
  NS.clearCaches = function () {
    if (prevClear) prevClear();
    cache.clear();
  };

  function commitmentOf(inv, o) {
    return inv.positions.filter((p) => p.offeringId === o.id).reduce((a, p) => a + Math.round((p.commitment != null ? p.commitment : p.amount) * 100), 0);
  }

  function ledger(ws, o) {
    const ckey = ws.tenant.id + ':' + o.id;
    if (cache.has(ckey)) return cache.get(ckey);
    const S = settings(o);
    const now = D.today();
    const invs = ws.investors.filter((i) => i.positions.some((p) => p.offeringId === o.id));

    // Contributions: recorded capital-call payments where the fund calls capital (operations.js),
    // otherwise each funded subscription or closing.
    const contribs = [];
    const calls = (ws.calls || []).filter((c) => c.offeringId === o.id);
    if (calls.length && !S.open) {
      calls.forEach((c) =>
        c.items.forEach((it) => {
          const inv = invs.find((i) => i.id === it.investorId);
          if (inv && it.received && it.received <= now && it.cents > 0) contribs.push({ date: it.received, inv, cents: it.cents, kind: `Capital call ${c.number}`, ref: `CALL-${c.number}`, call: c.number, pct: c.pct });
        })
      );
    } else {
      invs.forEach((inv) =>
        inv.positions
          .filter((p) => p.offeringId === o.id && p.amount > 0 && p.date <= now)
          .forEach((p) => contribs.push({ date: p.date, inv, cents: Math.round(p.amount * 100), kind: S.open ? 'Subscription' : 'Capital contribution at closing', ref: S.open ? `SUB-${p.date.replace(/-/g, '')}` : 'CLOSING' }))
      );
    }
    contribs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Distributions: each paid run, split exactly as investors were paid.
    const dists = [];
    ws.runs
      .filter((r) => r.offeringId === o.id && r.status === 'paid' && r.date <= now)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((run) => {
        NS.data.allocate(ws, run).forEach((row) => {
          if (row.cents > 0) dists.push({ date: run.date, inv: row.investor, cents: row.cents, run });
        });
      });

    const L = { o, S, invs, contribs, dists, redemptions: [], keys: [], months: [], byKey: {}, prices: {}, exitKey: null, inception: contribs.length ? contribs[0].date : null };
    cache.set(ckey, L);
    if (!contribs.length) return L;

    const lastDone = keyOf(lastMonthEnd(now));
    const exitKey = o.exit && o.exit.basis === 'exited' && o.exit.date ? keyOf(o.exit.date) : null;
    L.exitKey = exitKey;
    const endKey = exitKey && exitKey < lastDone ? exitKey : lastDone;
    for (let k = keyOf(L.inception); k <= endKey; k = nextKey(k)) L.keys.push(k);

    // Valuation returns: quarterly marks for private funds, monthly NAV for open-ended funds.
    const R = rng(hashStr(o.id + ':returns'));
    const ret = {};
    L.keys.forEach((k) => {
      const m = Number(k.slice(5, 7));
      const income = S.yield / 12;
      let gain = 0;
      let sleeves = null;
      if (S.sleeves) {
        sleeves = S.sleeves.map((sl) => ({ name: sl.name, w: sl.weight / 100, r: sl.mu / 12 + sl.vol * gauss(R) }));
        gain = sleeves.reduce((a, x) => a + x.w * x.r, 0) - income;
      } else if (S.marks === 3) {
        if (m % 3 === 0) gain = S.mu / 4 + S.vol * Math.sqrt(3) * gauss(R);
      } else gain = S.mu / 12 + S.vol * gauss(R);
      if (S.key === 'digital') gain = Math.max(-0.55, gain);
      ret[k] = { income, gain, sleeves };
    });
    L.returns = ret;

    // Token prices for priced holdings (digital assets): move with the fund, plus their own noise.
    const RP = rng(hashStr(o.id + ':prices'));
    S.holdings.forEach((h, j) => {
      if (!h.price) return;
      const path = {};
      let p = h.price;
      L.keys.forEach((k, idx) => {
        if (idx > 0 && h.beta) p = p * Math.max(0.25, 1 + h.beta * ret[k].gain + 0.025 * gauss(RP));
        path[k] = Math.round(p * 100) / 100;
      });
      L.prices[j] = path;
    });

    const cBy = {};
    contribs.forEach((c) => {
      const k = c.inv.id + '|' + keyOf(c.date);
      cBy[k] = (cBy[k] || 0) + c.cents;
    });
    const dBy = {};
    dists.forEach((d) => {
      const k = d.inv.id + '|' + keyOf(d.date);
      dBy[k] = (dBy[k] || 0) + d.cents;
    });
    const rBy = {};
    (ws.requests || []).forEach((q) => {
      if (q.type === 'redemption' && q.offeringId === o.id && (q.status === 'approved' || q.status === 'paid') && q.dealing && keyOf(q.dealing) <= endKey) rBy[q.investorId + '|' + keyOf(q.dealing)] = q;
    });
    const st = {};
    invs.forEach((i) => (st[i.id] = { cap: 0, carry: 0, hwm: 0, contrib: 0, dist: 0, commit: commitmentOf(i, o), firstKey: null }));
    const investEnd = D.addMonths(o.closeDate, 60);

    L.keys.forEach((k, idx) => {
      const mNum = Number(k.slice(5, 7));
      const end = endOf(k);
      const r = ret[k];
      const quarterEnd = mNum % 3 === 0;
      const last = idx === L.keys.length - 1;
      const exitNow = exitKey === k;
      const bases = invs.map((i) => st[i.id].cap + (cBy[i.id + '|' + k] || 0));
      const baseSum = bases.reduce((a, b) => a + b, 0);
      const incs = largest(Math.round(r.income * baseSum), bases);
      const gains = largest(Math.round(r.gain * baseSum), bases);
      const rows = {};
      const F = { key: k, end, begin: 0, contrib: 0, dist: 0, income: 0, gain: 0, fee: 0, carry: 0, gpOut: 0, endCap: 0, gpBegin: 0, gpEnd: 0, r };
      invs.forEach((i, n) => {
        const s = st[i.id];
        const c = cBy[i.id + '|' + k] || 0;
        const d = dBy[i.id + '|' + k] || 0;
        const begin = s.cap;
        if (c && !s.firstKey) s.firstKey = k;
        s.contrib += c;
        s.dist += d;
        let inc = incs[n];
        let gain = gains[n];
        let feeBase = 0;
        if (S.feeBasis === 'nav') feeBase = begin + c;
        else if (S.feeBasis === 'commitment' && end <= investEnd) feeBase = s.commit;
        else feeBase = s.contrib;
        const fee = s.firstKey ? Math.round((feeBase * S.mgmtFee) / 12) : 0;
        if (S.open) s.hwm += c - d;
        const prevA = s.carry;
        let pre = begin + c - d + inc + gain - fee + prevA;
        let A = prevA;
        let out = 0;
        let hurdle = null;
        let profit = null;
        if (exitNow) {
          // Sale: the realized gain trues the account up to the final distribution; accrued carry is paid to the GP.
          gain += A - pre;
          pre = A;
          out = A;
        } else if (S.carry > 0) {
          if (S.open) {
            A = Math.max(0, Math.min(pre, Math.round(S.carry * (pre - s.hwm))));
            if (mNum === 12) out = A;
          } else if (quarterEnd || last) {
            profit = s.dist + pre - s.contrib;
            const yrs = (monthsFrom(s.firstKey || k, k) + 1) / 12;
            hurdle = Math.round(s.contrib * (Math.pow(1 + S.pref, yrs) - 1));
            let x = 0;
            if (profit > hurdle) x = S.pref > 0 && profit <= hurdle / (1 - S.carry) ? profit - hurdle : Math.round(S.carry * profit);
            A = Math.max(0, Math.min(pre, x));
          }
        }
        let endCap = pre - A;
        if (endCap < 0) {
          gain -= endCap;
          endCap = 0;
        }
        const carryChg = A - prevA;
        s.carry = out ? 0 : A;
        if (S.open && mNum === 12 && out > 0) s.hwm = endCap;
        // Redemption at this month-end dealing date: capital out at net asset value after fees.
        let redeem = null;
        const q = rBy[i.id + '|' + k];
        if (q && endCap > 0) {
          redeem = q.paidCents != null ? Math.min(q.paidCents, endCap) : q.full ? endCap : Math.min(q.cents || 0, endCap);
          if (q.full && s.carry) {
            out += s.carry;
            s.carry = 0;
          }
          s.hwm = q.full ? 0 : Math.round(s.hwm * (1 - redeem / endCap));
          endCap -= redeem;
          s.dist += redeem;
          L.redemptions.push({ date: q.dealing, inv: i, cents: redeem, req: q });
        }
        s.cap = endCap;
        const dOut = d + (redeem || 0);
        rows[i.id] = { begin, contrib: c, dist: dOut, redeem, income: inc, gain, fee, feeBase, carry: carryChg, gpOut: out, end: endCap, carryBegin: prevA, carryEnd: s.carry, contribCum: s.contrib, distCum: s.dist, hwm: s.hwm, hurdle, profit, pre };
        F.begin += begin;
        F.contrib += c;
        F.dist += dOut;
        F.income += inc;
        F.gain += gain;
        F.fee += fee;
        F.carry += carryChg;
        F.gpOut += out;
        F.endCap += endCap;
        F.gpBegin += prevA;
        F.gpEnd += s.carry;
      });
      F.rows = rows;
      F.net = F.begin + F.contrib > 0 ? (F.endCap - F.begin - F.contrib + F.dist) / (F.begin + F.contrib) : 0;
      L.months.push(F);
      L.byKey[k] = F;
    });
    return L;
  }

  /* ---------- Holdings at a month-end: the schedule of investments and the balance sheet ---------- */
  function supportFor(h, pe) {
    const s = h.support;
    if (!s) return null;
    const every = s.every || 3;
    let d = null;
    if (every >= 12) {
      const anchor = s.anchor || '12-31';
      for (let y = Number(pe.slice(0, 4)); y > 1990 && !d; y--) {
        const c = `${y}-${anchor}`;
        if (c <= pe && (s.missing || []).indexOf(c) < 0) d = c;
      }
    } else {
      let k = keyOf(pe);
      for (let g = 0; g < 400 && !d; g++, k = prevKey(k)) {
        const c = endOf(k);
        if (c <= pe && Number(k.slice(5, 7)) % every === 0 && (s.missing || []).indexOf(c) < 0) d = c;
      }
    }
    if (d && s.staleSince && d > s.staleSince) d = s.staleSince;
    if (!d) return { date: '', doc: s.doc, age: 999, stale: true };
    const age = monthsFrom(keyOf(d), keyOf(pe));
    return { date: d, doc: s.doc, age, stale: age > every };
  }

  function holdingsAt(L, k) {
    const F = L.byKey[k];
    const S = L.S;
    const out = { key: k, date: k ? endOf(k) : '', rows: [], cash: 0, feePayable: 0, redemptionsPayable: 0, debt: 0, longFV: 0, longCost: 0, shortFV: 0, shortProceeds: 0, nav: 0, totalAssets: 0, totalLiabilities: 0 };
    if (!F) return out;
    const nav = F.endCap + F.gpEnd;
    out.nav = nav;
    if (nav <= 0) return out;
    out.feePayable = F.fee;
    out.redemptionsPayable = (L.redemptions || []).filter((x) => x.date <= endOf(k) && (!x.req.paid || x.req.paid > endOf(k))).reduce((a, x) => a + x.cents, 0);
    const base = nav + F.fee + out.redemptionsPayable;
    const netTarget = Math.round(base * (1 - S.cash));
    const H = S.holdings;
    const W = H.reduce((a, h) => a + h.weight, 0) || 1;
    const vals = H.map((h) => Math.round((netTarget * h.weight) / W));
    let big = 0;
    H.forEach((h, j) => {
      if (Math.abs(h.weight) > Math.abs(H[big].weight)) big = j;
    });
    vals[big] += netTarget - vals.reduce((a, v) => a + v, 0);
    let signed = 0;
    H.forEach((h, j) => {
      let v = vals[j];
      const row = { h, name: h.name, security: h.security || '', sleeve: h.sleeve || '', level: h.level || 3, method: h.method || '', input: h.input || '', qty: null, price: null, fv: v, cost: 0, debt: 0, equity: v };
      if (h.price && L.prices[j]) {
        const price = L.prices[j][k];
        const dec = h.decimals == null ? 8 : h.decimals;
        const qty = Math.floor(((v / 100) / price) * Math.pow(10, dec)) / Math.pow(10, dec);
        row.qty = qty;
        row.qtyText = qty.toFixed(dec);
        row.price = price;
        row.fv = Math.round(qty * price * 100);
        row.equity = row.fv;
      } else if (h.ltv) {
        row.fv = Math.round(v / (1 - h.ltv));
        row.debt = row.fv - v;
        row.equity = v;
        out.debt += row.debt;
      }
      row.cost = Math.round(row.fv * (h.cost == null ? 1 : h.cost));
      row.support = row.level === 3 ? supportFor(h, out.date) : null;
      signed += row.fv;
      if (row.fv >= 0) {
        out.longFV += row.fv;
        out.longCost += row.cost;
      } else {
        out.shortFV += -row.fv;
        out.shortProceeds += -row.cost;
      }
      out.rows.push(row);
    });
    out.cash = nav + out.feePayable + out.redemptionsPayable + out.debt - signed;
    out.totalAssets = out.longFV + out.cash;
    out.totalLiabilities = out.shortFV + out.debt + out.feePayable + out.redemptionsPayable;
    out.rows.forEach((r) => (r.pctNav = r.fv / nav));
    return out;
  }

  /* ---------- Periods ---------- */
  function presets(ws, o) {
    const now = D.today();
    const y = Number(now.slice(0, 4));
    const last = lastMonthEnd(now);
    const qEndMonth = Math.floor((Number(last.slice(5, 7))) / 3) * 3;
    const qEnd = qEndMonth ? endOf(`${last.slice(0, 4)}-${pad2(qEndMonth)}`) : `${y - 1}-12-31`;
    const qStart = D.addMonths(qEnd.slice(0, 8) + '01', -2);
    const q = Math.ceil(Number(qEnd.slice(5, 7)) / 3);
    const L = o ? ledger(ws, o) : null;
    const inception = L && L.inception ? L.inception.slice(0, 8) + '01' : `${y - 1}-01-01`;
    return [
      { id: 'fy', label: `Fiscal year ${y - 1}`, from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
      { id: 'ytd', label: `${y} to date (through ${dateShort(last)})`, from: `${y}-01-01`, to: last },
      { id: 'q', label: `Q${q} ${qEnd.slice(0, 4)}`, from: qStart, to: qEnd },
      { id: 'itd', label: `Inception to date (through ${dateShort(last)})`, from: inception, to: last }
    ];
  }
  /** Month-end valuations: periods start on the 1st and end on the last completed month-end. */
  function snap(from, to) {
    const now = D.today();
    let t = lastMonthEnd(to > now ? now : to);
    let f = String(from).slice(0, 8) + '01';
    if (f > t) f = t.slice(0, 8) + '01';
    return { from: f, to: t };
  }

  /* ---------- One fund, one period ---------- */
  function period(ws, o, fromIn, toIn) {
    const L = ledger(ws, o);
    const { from, to } = snap(fromIn, toIn);
    const fk = keyOf(from);
    const tk = keyOf(to);
    const ms = L.months.filter((m) => m.key >= fk && m.key <= tk);
    const before = L.months.filter((m) => m.key < fk).pop() || null;
    const lastM = ms.length ? ms[ms.length - 1] : before;
    const inv = L.invs.map((i) => {
      const b = ms.length ? ms[0].rows[i.id] : null;
      const e = lastM ? lastM.rows[i.id] : null;
      const a = { investor: i, begin: b ? b.begin : before ? before.rows[i.id].end : 0, contrib: 0, dist: 0, income: 0, gain: 0, fee: 0, carry: 0, gpOut: 0 };
      ms.forEach((m) => {
        const r = m.rows[i.id];
        a.contrib += r.contrib;
        a.dist += r.dist;
        a.income += r.income;
        a.gain += r.gain;
        a.fee += r.fee;
        a.carry += r.carry;
        a.gpOut += r.gpOut;
      });
      a.end = e ? e.end : 0;
      a.carryBegin = b ? b.carryBegin : before ? before.rows[i.id].carryEnd : 0;
      a.carryEnd = e ? e.carryEnd : 0;
      a.contribCum = e ? e.contribCum : 0;
      a.distCum = e ? e.distCum : 0;
      a.commit = commitmentOf(i, o);
      a.hwm = e ? e.hwm : 0;
      a.hurdle = e ? e.hurdle : null;
      a.profit = e ? e.profit : null;
      a.feeBase = e ? e.feeBase : 0;
      return a;
    });
    const sum = (f) => inv.reduce((s, a) => s + a[f], 0);
    const fund = { begin: sum('begin'), contrib: sum('contrib'), dist: sum('dist'), income: sum('income'), gain: sum('gain'), fee: sum('fee'), carry: sum('carry'), gpOut: sum('gpOut'), end: sum('end'), gpBegin: sum('carryBegin'), gpEnd: sum('carryEnd'), contribCum: sum('contribCum'), distCum: sum('distCum'), commit: sum('commit') };
    inv.forEach((a) => (a.own = fund.end > 0 ? a.end / fund.end : 0));
    const hold = holdingsAt(L, lastM && lastM.key >= fk ? lastM.key : lastM ? lastM.key : null);
    return { L, o, S: L.S, from, to, ms, inv, fund, hold, empty: !L.months.length, before };
  }

  /* ---------- Performance ---------- */
  function xirr(flows) {
    if (!flows.some((f) => f.amt < 0) || !flows.some((f) => f.amt > 0)) return null;
    const t0 = parse(flows[0].date);
    const yrs = flows.map((f) => (parse(f.date) - t0) / (365.25 * 864e5));
    const npv = (r) => flows.reduce((a, f, i) => a + f.amt / Math.pow(1 + r, yrs[i]), 0);
    let lo = -0.9999;
    let hi = 10;
    let flo = npv(lo);
    if (flo * npv(hi) > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const fm = npv(mid);
      if (Math.abs(fm) < 1e-7) return mid;
      if (flo * fm < 0) hi = mid;
      else {
        lo = mid;
        flo = fm;
      }
    }
    return (lo + hi) / 2;
  }
  function closedPerformance(P) {
    const L = P.L;
    const to = P.to;
    const row = (id) => {
      const fl = [];
      L.contribs.forEach((c) => {
        if ((!id || c.inv.id === id) && c.date <= to) fl.push({ date: c.date, amt: -c.cents / 100 });
      });
      L.dists.forEach((d) => {
        if ((!id || d.inv.id === id) && d.date <= to) fl.push({ date: d.date, amt: d.cents / 100 });
      });
      fl.sort((a, b) => (a.date < b.date ? -1 : 1));
      const paid = -fl.filter((f) => f.amt < 0).reduce((a, f) => a + f.amt, 0) * 100;
      const dist = fl.filter((f) => f.amt > 0).reduce((a, f) => a + f.amt, 0) * 100;
      const nav = id ? (P.inv.find((a) => a.investor.id === id) || { end: 0 }).end : P.fund.end;
      if (nav > 0) fl.push({ date: to, amt: nav / 100 });
      const pi = Math.round(paid);
      return { paid: pi, dist: Math.round(dist), nav, dpi: pi ? dist / pi : null, rvpi: pi ? nav / pi : null, tvpi: pi ? (dist + nav) / pi : null, irr: fl.length > 1 ? xirr(fl) : null };
    };
    return { fund: row(null), investors: P.inv.map((a) => ({ a, ...row(a.investor.id) })) };
  }
  function openPerformance(P) {
    const L = P.L;
    const compound = (ms) => ms.reduce((a, m) => a * (1 + m.net), 1) - 1;
    const ytdStart = P.to.slice(0, 4) + '-01';
    const ytd = compound(L.months.filter((m) => m.key >= ytdStart && m.key <= keyOf(P.to)));
    const itdMs = L.months.filter((m) => m.key <= keyOf(P.to));
    const itd = compound(itdMs);
    const years = itdMs.length / 12;
    return { monthly: P.ms, period: compound(P.ms), ytd, itd, itdAnnual: years > 0 ? Math.pow(1 + itd, 1 / years) - 1 : null };
  }

  /* ---------- Bank evidence for distributions ---------- */
  function companyName(ws, o) {
    return (o.achOverride && o.achOverride.companyName) || ws.tenant.ach.companyName || ws.tenant.shortName;
  }
  function runEvidence(ws, o, run) {
    const rows = NS.data.allocate(ws, run).filter((r) => r.cents > 0);
    const ach = rows.filter((r) => r.investor.payment && r.investor.payment.method === 'ach' && r.investor.payment.bank);
    const chk = rows.filter((r) => ach.indexOf(r) < 0);
    const slug = String(companyName(ws, o)).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    const file = run.source === 'console' ? run.file || '' : `${slug}_${run.date.replace(/-/g, '')}_A.ach`;
    const odfi8 = String(ws.tenant.ach.odfiRouting || '00000000').slice(0, 8);
    const traces = {};
    ach.forEach((r, n) => (traces[r.investor.id] = odfi8 + String(n + 1).padStart(7, '0')));
    const checks = {};
    chk.forEach((r) => (checks[r.investor.id] = String(10000 + (hashStr(run.id + r.investor.id) % 89999))));
    return {
      rows,
      ach,
      chk,
      file,
      traces,
      checks,
      achCents: ach.reduce((a, r) => a + r.cents, 0),
      chkCents: chk.reduce((a, r) => a + r.cents, 0),
      allocated: rows.reduce((a, r) => a + r.cents, 0),
      missingFile: ach.length > 0 && !file
    };
  }

  /* ---------- SHA-256 (synchronous, for the change log and package checksums) ---------- */
  const K256 = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  const utf8 = (s) => new TextEncoder().encode(s);
  function sha256(input) {
    const bytes = typeof input === 'string' ? utf8(input) : input;
    const l = bytes.length;
    const n = (((l + 9 + 63) >> 6) << 6);
    const m = new Uint8Array(n);
    m.set(bytes);
    m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(n - 4, (l * 8) >>> 0);
    dv.setUint32(n - 8, Math.floor((l * 8) / 4294967296));
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Uint32Array(64);
    for (let i = 0; i < n; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const x = w[t - 15];
        const y = w[t - 2];
        w[t] = (w[t - 16] + (ror(x, 7) ^ ror(x, 18) ^ (x >>> 3)) + w[t - 7] + (ror(y, 17) ^ ror(y, 19) ^ (y >>> 10))) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[t] + w[t]) | 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0;
      H[1] = (H[1] + b) | 0;
      H[2] = (H[2] + c) | 0;
      H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0;
      H[5] = (H[5] + f) | 0;
      H[6] = (H[6] + g) | 0;
      H[7] = (H[7] + h) | 0;
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /* ---------- ZIP (stored, no compression) ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zip(files, when) {
    const d = when || new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parts = [];
    const central = [];
    let offset = 0;
    files.forEach((f) => {
      const name = utf8(f.name);
      const data = typeof f.data === 'string' ? utf8(f.data) : f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true);
      lh.setUint16(12, date, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true);
      ch.setUint16(14, date, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((a, p) => a + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
    let pos = 0;
    all.forEach((p) => {
      out.set(p, pos);
      pos += p.length;
    });
    return out;
  }

  /* ---------- Change log: append-only, each entry hashed with the one before ---------- */
  const GENESIS = '0'.repeat(64);
  const entryText = (prev, e) => [prev, e.seq, e.at, e.actor, e.action, e.fund || '', e.record || '', e.detail || ''].join('|');
  function stamp(day, salt) {
    const h = hashStr(salt);
    return `${day}T${pad2(9 + (h % 8))}:${pad2((h >>> 3) % 60)}:${pad2((h >>> 9) % 60)}Z`;
  }
  function weekdayBack(s, n) {
    let d = s;
    for (let k = 0; k < n; ) {
      d = isoOf(new Date(parse(d).getTime() - 864e5));
      const wd = parse(d).getUTCDay();
      if (wd !== 0 && wd !== 6) k++;
    }
    return d;
  }
  function seedLog(ws) {
    const t = ws.tenant;
    const now = D.today();
    const staff = 'Carrow & Vale staff';
    const sponsor = `${t.shortName} staff`;
    const sys = 'Portal (automatic)';
    const ev = [];
    const add = (day, salt, actor, action, fund, record, detail) => {
      if (day && day <= now) ev.push({ at: stamp(day, salt), actor, action, fund: fund || '', record: record || '', detail: detail || '' });
    };
    const usd0 = (c) => money(c).replace(/\.\d\d$/, '');
    ws.offerings.forEach((o) => {
      const S = settings(o);
      add(D.addMonths(o.closeDate, -1), o.id + 'setup', staff, 'Offering set up', o.id, o.id, `${o.name} (${o.type}); ${S.label.toLowerCase()} accounting`);
      const calls = (ws.calls || []).filter((c) => c.offeringId === o.id);
      if (calls.length) {
        calls.forEach((c) => {
          add(c.noticeDate, c.id + 'issue', sponsor, 'Capital call issued', o.id, c.id, `Call ${c.number}: ${money(c.items.reduce((a, it) => a + it.cents, 0))} (${(c.pct * 100).toFixed(2)}% of commitments) from ${c.items.length} investors, due ${dateShort(c.due)}`);
          c.items.forEach((it) => {
            const inv = ws.investors.find((x) => x.id === it.investorId);
            if (it.received) add(it.received, c.id + it.investorId, sys, 'Capital call payment received', o.id, c.id, `${inv ? inv.title : it.investorId} (${it.investorId}): ${money(it.cents)} received ${dateShort(it.received)} for call ${c.number}`);
          });
        });
      } else if (S.calls && !S.open) {
        S.calls.forEach((c, n) => {
          add(weekdayBack(c[0], 10), o.id + 'call' + n, sponsor, 'Capital call issued', o.id, `CALL-${n + 1}`, `Call ${n + 1}: ${(c[1] * 100).toFixed(1)}% of commitments, due ${dateShort(c[0])}`);
          add(c[0], o.id + 'callfund' + n, sys, 'Capital call funded', o.id, `CALL-${n + 1}`, `All wires received for call ${n + 1}`);
        });
      }
      const L = ledger(ws, o);
      L.keys.forEach((k) => {
        const m = Number(k.slice(5, 7));
        if (S.open) add(D.addMonths(endOf(k), 0) < now ? isoOf(new Date(parse(endOf(k)).getTime() + 12 * 864e5)) : '', o.id + k, sponsor, 'Net asset value finalized', o.id, k, `${monthName(k)} NAV ${usd0(L.byKey[k].endCap + L.byKey[k].gpEnd)}`);
        else if (m % 3 === 0) add(isoOf(new Date(parse(endOf(k)).getTime() + 40 * 864e5)), o.id + k, sponsor, 'Quarterly valuation approved', o.id, `Q${m / 3}-${k.slice(0, 4)}`, `Q${m / 3} ${k.slice(0, 4)} valuations approved; net assets ${usd0(L.byKey[k].endCap + L.byKey[k].gpEnd)}`);
      });
    });
    ws.investors.forEach((i) => {
      const ob = i.onboarding || {};
      add(ob.invited, i.id + 'inv', sponsor, 'Investor invited', '', i.id, `${i.title} invited to the portal`);
      if (ob.status === 'complete') add(ob.completed, i.id + 'act', `${i.title} (investor)`, 'Account activated', '', i.id, 'Profile, tax form and distribution account confirmed');
      if (i.accreditation && i.accreditation.date && i.accreditation.basis) add(i.accreditation.date, i.id + 'acc', staff, 'Accreditation verified', '', i.id, 'Verified accredited investor');
      i.positions.forEach((p) => {
        const o = ws.offerings.find((x) => x.id === p.offeringId);
        if (o) add(p.date, i.id + p.offeringId + 'sub', sponsor, 'Subscription accepted', o.id, i.id, `${i.title}: ${usd0((p.commitment || p.amount) * 100)} ${p.commitment ? 'commitment' : 'subscription'}`);
      });
    });
    ws.runs.forEach((run) => {
      if (run.status !== 'paid' || run.date > now) return;
      const o = ws.offerings.find((x) => x.id === run.offeringId);
      if (!o) return;
      const E = runEvidence(ws, o, run);
      add(weekdayBack(run.date, 3), run.id + 'appr', sponsor, 'Distribution approved', o.id, run.id, `${run.type}: ${money(run.total)} to ${E.rows.length} investors`);
      if (E.file) add(weekdayBack(run.date, 2), run.id + 'file', sponsor, 'NACHA file generated', o.id, run.id, `${E.file}: ${E.ach.length} entries, ${money(E.achCents)}`);
      if (E.chk.length) add(weekdayBack(run.date, 2), run.id + 'chk', sponsor, 'Checks issued', o.id, run.id, `${E.chk.length} checks, ${money(E.chkCents)}`);
      add(run.date, run.id + 'paid', sys, 'Distribution paid', o.id, run.id, `Settlement confirmed for ${money(run.total)}`);
    });
    (ws.requests || []).forEach((q) => {
      const o = ws.offerings.find((x) => x.id === q.offeringId);
      const i = ws.investors.find((x) => x.id === q.investorId);
      if (!o || !i) return;
      const what = q.type === 'redemption' ? (q.full ? 'full redemption' : money(q.cents || 0)) : `${money(q.cents)} ${NS.ops && NS.ops.isOpen(o) ? 'subscription' : 'commitment'}`;
      add(q.submitted, q.id + 'sub', `${i.title} (investor)`, q.type === 'redemption' ? 'Redemption requested' : 'Subscription documents signed', o.id, q.id, `${i.title} (${i.id}): ${what}${q.dealing ? ` at the ${dateShort(q.dealing)} ${q.type === 'redemption' ? 'dealing date' : 'closing'}` : ''}; signed by ${q.signedBy}`);
      if (q.decided) add(q.decided, q.id + 'dec', sponsor, `${q.type === 'redemption' ? 'Redemption' : 'Subscription'} ${q.status === 'rejected' ? 'declined' : 'approved'}`, o.id, q.id, `${i.title} (${i.id})`);
      if (q.paid) add(q.paid, q.id + 'paid', sponsor, 'Redemption paid', o.id, q.id, `${i.title} (${i.id}): ${q.full ? 'full' : 'partial'} redemption at ${dateShort(q.dealing)}, paid by ACH`);
    });
    ws.investors.forEach((i) => {
      const k = i.kyc;
      if (!k) return;
      if (k.verifiedOn) add(k.verifiedOn, i.id + 'idv', sys, 'Identity verified', '', i.id, `${i.title}: ${k.method}`);
      if (k.screenedOn) add(k.screenedOn, i.id + 'scr', sys, 'Sanctions and PEP screening run', '', i.id, `${i.title}: ${k.screening === 'potential_match' ? `potential match on the ${k.match.list} (${Math.round(k.match.score * 100)}% name similarity) sent for review` : 'no matches'}`);
    });
    (ws.notices || []).forEach((n) => add(n.date, n.id, n.sentBy === 'staff' ? staff : sponsor, 'Notice sent', n.audience === 'all' ? '' : n.audience, n.id, `“${n.subject.replace(/\{[a-z_]+\}/g, '…')}” to ${n.recipients.length} investors`));
    ev.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    let prev = GENESIS;
    ev.forEach((e, n) => {
      e.seq = n + 1;
      e.hash = sha256(entryText(prev, e));
      prev = e.hash;
    });
    return ev;
  }
  function ensureLog(ws) {
    if (!Array.isArray(ws.audit)) {
      ws.audit = seedLog(ws);
      if (NS.workspace && NS.store) NS.workspace.save(ws);
    }
    return ws.audit;
  }
  function currentActor() {
    const st = NS.state || {};
    const t = st.ws ? st.ws.tenant : null;
    if (st.role === 'sponsor') return `${t ? t.shortName : 'Sponsor'} staff`;
    if (st.role === 'investor') {
      const inv = st.ws && st.ws.investors.find((i) => i.id === st.viewer);
      return inv ? `${inv.title} (investor)` : 'Investor';
    }
    return 'Carrow & Vale staff';
  }
  const pending = new Map();
  let flushTimer = 0;
  function append(ws, e) {
    const log = ensureLog(ws);
    const prev = log.length ? log[log.length - 1].hash : GENESIS;
    const entry = { seq: log.length + 1, at: e.at || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), actor: e.actor || currentActor(), action: e.action, fund: e.fund || '', record: e.record || '', detail: e.detail || '' };
    entry.hash = sha256(entryText(prev, entry));
    log.push(entry);
    return entry;
  }
  function flush() {
    clearTimeout(flushTimer);
    pending.forEach((e) => append(e.ws, e));
    const touched = new Set([...pending.values()].map((e) => e.ws));
    pending.clear();
    touched.forEach((w) => NS.workspace && NS.workspace.save(w));
  }
  /**
   * Record a change. `coalesce` merges rapid edits to one field (typing) into a
   * single entry written after a short pause, keeping the first "from" value.
   */
  function log(ws, e) {
    if (!ws) return null;
    if (e.coalesce) {
      const k = ws.tenant.id + '|' + e.coalesce;
      const was = pending.get(k);
      pending.set(k, Object.assign({}, e, { ws, actor: currentActor(), at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), from: was ? was.from : e.from }));
      const p = pending.get(k);
      p.detail = e.detailFor ? e.detailFor(p.from, e.to) : e.detail;
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 1500);
      return null;
    }
    flush();
    const entry = append(ws, e);
    if (NS.workspace) NS.workspace.save(ws);
    return entry;
  }
  function verify(ws) {
    flush();
    const log = ensureLog(ws);
    let prev = GENESIS;
    for (let n = 0; n < log.length; n++) {
      const e = log[n];
      if (e.seq !== n + 1 || sha256(entryText(prev, e)) !== e.hash) return { ok: false, count: log.length, brokenAt: n + 1 };
      prev = e.hash;
    }
    return { ok: true, count: log.length, head: prev };
  }

  /* ---------- Readiness checks ---------- */
  function checks(ws, P, extra) {
    const out = [];
    const add = (id, title, ok, detail, items, na) => out.push({ id, title, status: na ? 'na' : ok ? 'pass' : 'exception', detail, items: items || [] });
    const o = P.o;
    const S = P.S;
    const f = P.fund;
    const H = P.hold;
    const live = P.inv.filter((a) => a.end > 0 || a.contrib > 0 || a.dist > 0);

    const broken = P.inv.filter((a) => a.begin + a.contrib - a.dist + a.income + a.gain - a.fee - a.carry !== a.end);
    add('roll', 'Capital accounts roll forward', !broken.length, `Beginning capital, plus contributions, less distributions, plus income and gains, less fees and ${S.open ? 'incentive allocation' : 'carried interest'}, equals ending capital for each of ${P.inv.length} investors.`, broken.map((a) => `${a.investor.title}: does not roll forward`));

    const nav = f.end + f.gpEnd;
    const tie = H.nav === nav && H.totalAssets - H.totalLiabilities === nav;
    add('nav', 'Partners’ capital agrees to net assets', tie, `Limited partners ${money(f.end)} plus general partner ${money(f.gpEnd)} equals net assets of ${money(H.totalAssets - H.totalLiabilities)} on the statement of assets and liabilities.`, tie ? [] : ['Partners’ capital and net assets differ']);

    const soi = H.rows.reduce((a, r) => a + (r.fv > 0 ? r.fv : 0), 0) === H.longFV && H.cash >= 0;
    add('soi', 'Schedule of investments agrees to the balance sheet', soi, H.rows.length ? `${H.rows.length} positions, ${money(H.longFV)} at fair value${H.shortFV ? `, ${money(H.shortFV)} sold short` : ''}; cash ${money(H.cash)}.` : 'No investments held at period end.', soi ? [] : ['Schedule of investments does not agree, or cash is negative']);

    const ownSum = P.inv.reduce((a, x) => a + x.own, 0);
    add('own', 'Ownership totals 100%', f.end <= 0 || Math.abs(ownSum - 1) < 1e-9, f.end > 0 ? `Ending capital percentages total ${(ownSum * 100).toFixed(4)}%.` : 'No capital outstanding at period end.', [], f.end <= 0);

    const runs = ws.runs.filter((r) => r.offeringId === o.id && r.status === 'paid' && r.date >= P.from && r.date <= P.to);
    const runIssues = [];
    runs.forEach((r) => {
      const E = runEvidence(ws, o, r);
      if (E.allocated !== r.total) runIssues.push(`${dateShort(r.date)} ${r.type}: investor allocations differ from the total by ${money(E.allocated - r.total)}`);
      if (E.missingFile) runIssues.push(`${dateShort(r.date)} ${r.type} (${money(r.total)}): recorded without a NACHA file. Attach the bank’s ACH confirmation.`);
    });
    add('bank', 'Distributions agree to bank records', !runIssues.length, runs.length ? `${runs.length} distributions totaling ${money(runs.reduce((a, r) => a + r.total, 0))}; each split to the cent and matched to a NACHA file or check.` : 'No distributions in the period.', runIssues, !runs.length);

    const calls = P.L.contribs.filter((c) => c.date >= P.from && c.date <= P.to);
    // Calls due by period end that were not paid by then.
    const late = [];
    (ws.calls || [])
      .filter((c) => c.offeringId === o.id && c.due <= P.to)
      .forEach((c) =>
        c.items.forEach((it) => {
          if (!it.received || it.received > P.to) {
            const inv = ws.investors.find((x) => x.id === it.investorId);
            late.push(`${inv ? inv.title : it.investorId} (${it.investorId}): ${money(it.cents)} for call ${c.number}, due ${dateShort(c.due)}, ${it.received ? `paid late on ${dateShort(it.received)}` : 'not yet received'}.`);
          }
        })
      );
    add('contrib', S.open ? 'Subscriptions recorded at net asset value' : 'Capital calls fully funded', !late.length, calls.length || late.length ? `${calls.length} ${S.open ? 'subscriptions' : 'contributions'} totaling ${money(calls.reduce((a, c) => a + c.cents, 0))}${S.open ? '' : late.length ? `; ${late.length} payment${late.length === 1 ? '' : 's'} past due at period end` : '; every call due by period end was paid on time'}.` : `No ${S.open ? 'subscriptions' : 'contributions'} in the period.`, late, !calls.length && !late.length);

    if (S.open) {
      const reds = (P.L.redemptions || []).filter((x) => x.date >= P.from && x.date <= P.to);
      const slow = reds.filter((x) => (x.req.paid || '9999-12-31') > D.addMonths(x.date, 1) && D.addMonths(x.date, 1) <= P.to);
      add('redeem', 'Redemptions paid within terms', !slow.length, reds.length ? `${reds.length} redemption${reds.length === 1 ? '' : 's'} totaling ${money(reds.reduce((a, x) => a + x.cents, 0))} at net asset value on the dealing date; ${money(P.hold.redemptionsPayable || 0)} payable at period end.` : 'No redemptions in the period.', slow.map((x) => `${x.inv.title} (${x.inv.id}): ${money(x.cents)} redeemed ${dateShort(x.date)}, ${x.req.paid ? `paid ${dateShort(x.req.paid)}` : 'not yet paid'}; terms require payment within 30 days.`), !reds.length);
    }

    if (NS.ops) {
      const kycIssues = [];
      live.forEach((a) => {
        const k = NS.ops.kycOf(a.investor);
        const lab = NS.ops.kycLabel(k, P.to);
        if (lab.key === 'cleared') return;
        kycIssues.push(`${a.investor.title} (${a.investor.id}): ${lab.key === 'due' ? `re-screening was due ${dateShort(k.nextReview)}` : lab.key === 'review' ? `potential ${k.match ? k.match.list : 'screening'} match awaiting review` : lab.label.toLowerCase()}.`);
      });
      add('kyc', 'AML/KYC cleared and current', !kycIssues.length, `Identity verified and sanctions and PEP screening clear for ${live.length - kycIssues.length} of ${live.length} investors.`, kycIssues);
    }

    const noTax = live.filter((a) => !a.investor.taxForm);
    add('tax', 'Tax forms on file', !noTax.length, `W-9 or W-8 on file for ${live.length - noTax.length} of ${live.length} investors.`, noTax.map((a) => `${a.investor.title} (${a.investor.id}): no tax form. Request a W-9 before year-end tax reporting.`));

    const noAcc = live.filter((a) => !(a.investor.accreditation && a.investor.accreditation.basis));
    add('acc', 'Accreditation verified', !noAcc.length, `Verified accredited investor on file for ${live.length - noAcc.length} of ${live.length} investors.`, noAcc.map((a) => `${a.investor.title} (${a.investor.id}): accreditation not verified.`));

    const l3 = H.rows.filter((r) => r.level === 3);
    const stale = l3.filter((r) => r.support && r.support.stale);
    add('val', 'Level 3 valuations supported and current', !stale.length, l3.length ? `${l3.length} Level 3 positions, ${money(l3.reduce((a, r) => a + r.fv, 0))}; each needs support dated within its valuation cycle.` : 'No Level 3 positions at period end.', stale.map((r) => `${r.name}: latest support is ${r.support.date ? `${r.support.doc.toLowerCase()} as of ${dateShort(r.support.date)} (${r.support.age} months old)` : 'missing'}.`), !l3.length);

    if (S.key === 'digital') {
      const cust = custody(P);
      const diffs = cust.filter((c) => c.diff);
      add('custody', 'Custodian balances agree to the books', !diffs.length, `${cust.length} assets confirmed with custodians as of ${dateShort(P.hold.date)}.`, diffs.map((c) => `${c.name}: custodian shows ${c.custQty} against ${c.bookQty} in the books (${c.diffText}). ${c.note}.`));
    }

    const feeBad = [];
    P.ms.forEach((m) =>
      Object.keys(m.rows).forEach((id) => {
        const r = m.rows[id];
        if (r.fee !== Math.round((r.feeBase * S.mgmtFee) / 12) && r.fee !== 0) feeBad.push(`${id} ${m.key}`);
      })
    );
    add('fees', 'Management fees recalculate', !feeBad.length, `${(S.mgmtFee * 100).toFixed(2)}% a year on ${FEE_BASIS[S.feeBasis].toLowerCase()}, charged monthly: ${money(f.fee)} in the period.`, feeBad);

    const v = extra.verify;
    const logged = new Set(ensureLog(ws).filter((e) => e.action === 'Distribution paid' || e.action === 'Distribution recorded').map((e) => e.record));
    const unlogged = runs.filter((r) => !logged.has(r.id));
    add('log', 'Change log complete and unaltered', v.ok && !unlogged.length, v.ok ? `${v.count} entries; every entry’s hash chains to the one before.` : `Entry ${v.brokenAt} does not match its hash: the log was altered after it was written.`, (v.ok ? [] : [`Hash chain breaks at entry ${v.brokenAt}`]).concat(unlogged.map((r) => `${dateShort(r.date)} distribution ${r.id} has no change-log entry`)));
    return out;
  }

  /* ---------- Custody reconciliation (digital assets) ---------- */
  function custody(P) {
    return P.hold.rows
      .filter((r) => r.h.symbol || r.h.custodian)
      .map((r) => {
        const cd = r.h.custodyDiff;
        const applies = cd && P.hold.date >= cd.from;
        const dec = r.h.decimals == null ? 8 : r.h.decimals;
        const book = r.qty;
        const cust = book == null ? null : applies ? Math.round((book + cd.qty) * Math.pow(10, dec)) / Math.pow(10, dec) : book;
        return {
          row: r,
          name: r.name,
          custodian: r.h.custodian || '',
          wallet: r.h.wallet || '',
          bookQty: book == null ? 'n/a' : book.toFixed(dec),
          custQty: cust == null ? 'Confirmed by issuer' : cust.toFixed(dec),
          diff: applies ? cd.qty : 0,
          diffText: applies ? `${cd.qty.toFixed(dec)} ${r.h.symbol || ''} difference`.trim() : '',
          note: applies ? cd.note : '',
          price: r.price,
          fv: r.fv
        };
      });
  }

  /* ---------- Schedules ---------- */
  const COL = (h, t, k) => ({ h, t: t || 'text', k });
  function sched(id, file, title, desc, cols, rows, total) {
    return { id, file, title, desc, cols, rows, total: total || null };
  }
  function payLabel(inv) {
    const b = inv.payment && inv.payment.method === 'ach' && inv.payment.bank;
    return b ? `ACH, ${b.type === 'savings' ? 'savings' : 'checking'} ending ${String(b.account).slice(-4)}` : 'Check';
  }
  function schedules(ws, P, chk, ver) {
    const o = P.o;
    const S = P.S;
    const f = P.fund;
    const H = P.hold;
    const t = ws.tenant;
    const asOf = H.date || P.to;
    const gpWord = S.open ? 'Incentive allocation' : 'Carried interest';
    const out = [];

    // 1. Statement of assets and liabilities
    const al = [
      ['Investments, at fair value' + (H.longCost ? ` (cost ${money(H.longCost)})` : ''), H.longFV],
      ['Cash and cash equivalents', H.cash],
      ['Total assets', H.totalAssets],
      ...(H.shortFV ? [['Securities sold short, at fair value' + (H.shortProceeds ? ` (proceeds ${money(H.shortProceeds)})` : ''), H.shortFV]] : []),
      ...(H.debt ? [['Mortgage notes payable', H.debt]] : []),
      ...(H.redemptionsPayable ? [['Redemptions payable', H.redemptionsPayable]] : []),
      ['Management fees payable', H.feePayable],
      ['Total liabilities', H.totalLiabilities],
      ['Net assets (partners’ capital)', H.totalAssets - H.totalLiabilities],
      ['  Limited partners', f.end],
      ['  General partner (' + gpWord.toLowerCase() + ' accrued)', f.gpEnd]
    ];
    out.push(sched('al', '01_Statement_of_assets_and_liabilities.csv', 'Statement of assets and liabilities', `As of ${dateLong(asOf)}.`, [COL('Line item'), COL('Amount', 'money')], al));

    // 2. Statement of operations
    const ops = [
      ['Investment income', f.income],
      ['Management fees', -f.fee],
      ['Net investment income (loss)', f.income - f.fee],
      ['Net realized and unrealized gain (loss) on investments', f.gain],
      ['Net increase (decrease) in net assets from operations', f.income - f.fee + f.gain],
      [`Change in ${gpWord.toLowerCase()} allocated to the general partner`, -f.carry],
      ['Net increase (decrease) in limited partners’ capital from operations', f.income - f.fee + f.gain - f.carry]
    ];
    out.push(sched('ops', '02_Statement_of_operations.csv', 'Statement of operations', `${dateLong(P.from)} to ${dateLong(P.to)}.`, [COL('Line item'), COL('Amount', 'money')], ops));

    // 3. Statement of changes in partners' capital
    const chg = [
      ['Beginning of period', f.begin, f.gpBegin, f.begin + f.gpBegin],
      ['Contributions', f.contrib, 0, f.contrib],
      ['Distributions', -f.dist, -f.gpOut, -f.dist - f.gpOut],
      ['Net investment income (loss)', f.income - f.fee, 0, f.income - f.fee],
      ['Net realized and unrealized gain (loss)', f.gain, 0, f.gain],
      [`${gpWord} reallocation`, -f.carry, f.carry, 0],
      ['End of period', f.end, f.gpEnd, f.end + f.gpEnd]
    ];
    out.push(sched('chg', '03_Statement_of_changes_in_partners_capital.csv', 'Statement of changes in partners’ capital', `${dateLong(P.from)} to ${dateLong(P.to)}. General partner distributions are ${S.open ? 'incentive allocations crystallized and withdrawn' : 'carried interest paid'}.`, [COL('Line item'), COL('Limited partners', 'money'), COL('General partner', 'money'), COL('Total', 'money')], chg));

    // 4. Capital account rollforward by investor
    const sorted = P.inv.slice().sort((a, b) => b.end - a.end || (a.investor.id < b.investor.id ? -1 : 1));
    const rf = sorted.map((a) => [a.investor.id, a.investor.title, a.begin, a.contrib, -a.dist, a.income, a.gain, -a.fee, -a.carry, a.end, a.own]);
    out.push(
      sched(
        'rollforward',
        '04_Capital_account_rollforward.csv',
        'Capital account rollforward by investor',
        `Each investor’s capital account, ${dateShort(P.from)} to ${dateShort(P.to)}. Income and gains are allocated monthly in proportion to opening capital plus that month’s contributions.`,
        [COL('Investor ID'), COL('Investor'), COL('Beginning capital', 'money'), COL(S.open ? 'Subscriptions' : 'Contributions', 'money'), COL(S.open ? 'Redemptions' : 'Distributions', 'money'), COL('Investment income', 'money'), COL('Realized and unrealized gain (loss)', 'money'), COL('Management fees', 'money'), COL(gpWord, 'money'), COL('Ending capital', 'money'), COL('Ownership', 'pct')],
        rf,
        ['', 'Total', f.begin, f.contrib, -f.dist, f.income, f.gain, -f.fee, -f.carry, f.end, f.end > 0 ? 1 : 0]
      )
    );

    // 5. Investor register
    const hasCommit = P.inv.some((a) => a.investor.positions.some((p) => p.offeringId === o.id && p.commitment != null && p.commitment > 0));
    const unf = (a) => (hasCommit ? Math.max(0, a.commit - a.contribCum) : 0);
    const reg = sorted.map((a) => {
      const i = a.investor;
      const k = NS.ops ? NS.ops.kycOf(i) : null;
      const kl = k ? NS.ops.kycLabel(k, P.to) : null;
      const acc = i.accreditation && i.accreditation.basis ? `Verified accredited investor, ${dateShort(i.accreditation.date)}` : 'Not verified';
      const first = i.positions.filter((p) => p.offeringId === o.id).map((p) => p.date).sort()[0];
      return [i.id, i.title, i.contact, (NS.ENTITY_TYPES[i.type] || {}).label || i.type, first, a.commit, a.contribCum, unf(a), a.distCum, a.end, a.own, i.taxForm ? `${i.taxForm} on file` : 'Missing', i.tinLast4 ? `ending ${i.tinLast4}` : 'Not provided', acc, kl ? kl.label + (k.screenedOn ? `, screened ${dateShort(k.screenedOn)}` : '') : '', k && k.nextReview ? k.nextReview : '', i.onboarding.status === 'complete' ? 'Active' : i.onboarding.status === 'in_progress' ? 'Onboarding' : 'Invited', payLabel(i)];
    });
    out.push(
      sched(
        'register',
        '05_Investor_register.csv',
        'Investor register',
        `Commitments, capital and investor documentation as of ${dateLong(P.to)}. Bank account and taxpayer numbers are masked.`,
        [COL('Investor ID'), COL('Investor'), COL('Primary contact'), COL('Investing as'), COL('Subscription date', 'date'), COL(S.open ? 'Subscriptions' : 'Commitment', 'money'), COL('Contributed to date', 'money'), COL('Unfunded commitment', 'money'), COL('Distributed to date', 'money'), COL('Ending capital', 'money'), COL('Ownership', 'pct'), COL('Tax form'), COL('Taxpayer ID'), COL('Accreditation'), COL('AML/KYC'), COL('Next KYC review', 'date'), COL('Portal account'), COL('Distribution method')],
        reg,
        ['', 'Total', '', '', '', f.commit, f.contribCum, P.inv.reduce((s, a) => s + unf(a), 0), f.distCum, f.end, f.end > 0 ? 1 : 0, '', '', '', '', '', '', '']
      )
    );

    // 6. Capital activity ledger
    const act = [];
    P.L.contribs.filter((c) => c.date >= P.from && c.date <= P.to).forEach((c) => act.push([c.date, c.inv.id, c.inv.title, c.kind, c.cents, 0, c.ref, 'Wire', `Wire received ${dateShort(c.date)}`]));
    const evid = {};
    P.L.dists.filter((d) => d.date >= P.from && d.date <= P.to).forEach((d) => {
      const E = (evid[d.run.id] = evid[d.run.id] || runEvidence(ws, o, d.run));
      const ach = E.traces[d.inv.id];
      act.push([d.date, d.inv.id, d.inv.title, `Distribution: ${d.run.type}`, 0, -d.cents, d.run.id, ach ? 'ACH' : 'Check', ach ? `${E.file || 'No file'} · trace ${ach}` : `Check ${E.checks[d.inv.id] || ''}`]);
    });
    (P.L.redemptions || []).filter((x) => x.date >= P.from && x.date <= P.to).forEach((x) => act.push([x.date, x.inv.id, x.inv.title, `Redemption (${x.req.full ? 'full' : 'partial'})`, 0, -x.cents, x.req.id, 'ACH', x.req.paid ? `Paid ${dateShort(x.req.paid)}` : 'Payable']));
    act.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
    out.push(
      sched('activity', '06_Capital_activity_ledger.csv', 'Capital activity ledger', `Every contribution and distribution in the period, with its bank reference.`, [COL('Date', 'date'), COL('Investor ID'), COL('Investor'), COL('Activity'), COL('Contribution', 'money'), COL('Distribution', 'money'), COL('Reference'), COL('Method'), COL('Bank reference')], act, ['', '', 'Total', '', f.contrib, -f.dist, '', '', ''])
    );

    // 7. Distribution reconciliation to bank records
    const runs = ws.runs.filter((r) => r.offeringId === o.id && r.status === 'paid' && r.date >= P.from && r.date <= P.to).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const rec = runs.map((r) => {
      const E = evid[r.id] || runEvidence(ws, o, r);
      return [r.date, r.id, r.type, r.total, E.allocated, E.allocated - r.total, E.ach.length, E.achCents, E.chk.length, E.chkCents, E.file || 'Missing', E.missingFile ? 'Exception: no bank file' : 'Agrees'];
    });
    out.push(
      sched(
        'bank',
        '07_Distribution_bank_reconciliation.csv',
        'Distribution reconciliation to bank records',
        'Each distribution’s total, the sum of investor allocations, and the ACH file and checks that paid it.',
        [COL('Payment date', 'date'), COL('Distribution ID'), COL('Type'), COL('Total per records', 'money'), COL('Allocated to investors', 'money'), COL('Difference', 'money'), COL('ACH entries', 'int'), COL('ACH amount', 'money'), COL('Checks', 'int'), COL('Check amount', 'money'), COL('NACHA file'), COL('Result')],
        rec,
        ['', '', 'Total', runs.reduce((a, r) => a + r.total, 0), rec.reduce((a, r) => a + r[4], 0), rec.reduce((a, r) => a + r[5], 0), rec.reduce((a, r) => a + r[6], 0), rec.reduce((a, r) => a + r[7], 0), rec.reduce((a, r) => a + r[8], 0), rec.reduce((a, r) => a + r[9], 0), '', '']
      )
    );

    // 8. Schedule of investments
    const soi = H.rows.map((r) => [r.sleeve, r.name, r.security, r.qtyText || '', r.price, r.cost, r.fv, r.pctNav, `Level ${r.level}`, r.method, r.input, r.support ? (r.support.date ? `${r.support.doc}, ${dateShort(r.support.date)}` : 'Missing') : r.h.custodian ? 'Custodian statement' : r.level === 1 ? 'Quoted price' : 'Broker or counterparty statement', r.h.custodian || '']);
    out.push(
      sched(
        'soi',
        '08_Schedule_of_investments.csv',
        'Schedule of investments',
        `Positions at fair value as of ${dateLong(asOf)}; percentages are of net assets.`,
        [COL('Strategy'), COL('Investment'), COL('Security / description'), COL('Quantity', 'qty'), COL('Price', 'price'), COL('Cost (proceeds)', 'money'), COL('Fair value', 'money'), COL('% of net assets', 'pct'), COL('Fair value level'), COL('Valuation technique'), COL('Key input'), COL('Valuation support'), COL('Custodian')],
        soi,
        ['', 'Total investments, net', '', '', null, H.longCost - H.shortProceeds, H.longFV - H.shortFV, H.nav ? (H.longFV - H.shortFV) / H.nav : 0, '', '', '', '', '']
      )
    );

    // 9. Fair value hierarchy
    const lv = [1, 2, 3].map((n) => {
      const rows = H.rows.filter((r) => r.level === n);
      const long = rows.filter((r) => r.fv > 0).reduce((a, r) => a + r.fv, 0);
      const short = rows.filter((r) => r.fv < 0).reduce((a, r) => a + r.fv, 0);
      return [`Level ${n}`, long, short, long + short, H.nav ? (long + short) / H.nav : 0, rows.length];
    });
    const l3 = H.rows.filter((r) => r.level === 3).map((r) => [r.name, r.fv, r.method, r.input, r.support ? r.support.date : '']);
    out.push(sched('fvh', '09_Fair_value_hierarchy.csv', 'Fair value hierarchy (ASC 820)', `Investments by level as of ${dateLong(asOf)}.`, [COL('Level'), COL('Investments', 'money'), COL('Sold short', 'money'), COL('Net', 'money'), COL('% of net assets', 'pct'), COL('Positions', 'int')], lv, ['Total', H.longFV, -H.shortFV, H.longFV - H.shortFV, H.nav ? (H.longFV - H.shortFV) / H.nav : 0, H.rows.length]));
    out.push(sched('l3', '10_Level_3_valuation_inputs.csv', 'Level 3 valuation inputs', 'Significant unobservable inputs for each Level 3 position.', [COL('Investment'), COL('Fair value', 'money'), COL('Valuation technique'), COL('Unobservable input'), COL('Support as of', 'date')], l3));

    // 11. Management fees
    const fees = sorted.map((a) => [a.investor.id, a.investor.title, FEE_BASIS[S.feeBasis], a.feeBase, S.mgmtFee, P.ms.length, a.fee]);
    out.push(sched('fees', '11_Management_fee_calculation.csv', 'Management fee calculation', `${(S.mgmtFee * 100).toFixed(2)}% a year on ${FEE_BASIS[S.feeBasis].toLowerCase()}, charged monthly (one-twelfth of the annual rate on each month’s basis).`, [COL('Investor ID'), COL('Investor'), COL('Fee basis'), COL('Basis, final month', 'money'), COL('Annual rate', 'pct'), COL('Months', 'int'), COL('Fees for period', 'money')], fees, ['', 'Total', '', '', null, null, f.fee]));

    // 12. Carried interest or incentive allocation
    if (S.carry > 0) {
      const cr = sorted.map((a) =>
        S.open
          ? [a.investor.id, a.investor.title, a.hwm, a.end + a.carryEnd, a.carryBegin, a.carry, a.gpOut, a.carryEnd]
          : [a.investor.id, a.investor.title, a.contribCum, a.distCum, a.end + a.carryEnd, a.profit, a.hurdle, a.carryBegin, a.carry, a.gpOut, a.carryEnd]
      );
      out.push(
        S.open
          ? sched('carry', '12_Incentive_allocation.csv', 'Incentive allocation', `${(S.carry * 100).toFixed(0)}% of net profits above each investor’s high-water mark, accrued monthly and crystallized at December 31.`, [COL('Investor ID'), COL('Investor'), COL('High-water mark', 'money'), COL('Capital before incentive', 'money'), COL('Accrued, beginning', 'money'), COL('Allocated in period', 'money'), COL('Crystallized and paid', 'money'), COL('Accrued, ending', 'money')], cr, ['', 'Total', null, f.end + f.gpEnd, f.gpBegin, f.carry, f.gpOut, f.gpEnd])
          : sched('carry', '12_Carried_interest.csv', 'Carried interest', `${(S.carry * 100).toFixed(0)}% carried interest${S.pref ? ` over an ${(S.pref * 100).toFixed(0)}% preferred return with full catch-up` : ''}, accrued at each quarter-end as if the fund were liquidated at net asset value.`, [COL('Investor ID'), COL('Investor'), COL('Contributed', 'money'), COL('Distributed', 'money'), COL('Capital before carry', 'money'), COL('Profit', 'money'), COL('Preferred return', 'money'), COL('Accrued, beginning', 'money'), COL('Allocated in period', 'money'), COL('Paid', 'money'), COL('Accrued, ending', 'money')], cr, ['', 'Total', f.contribCum, f.distCum, f.end + f.gpEnd, null, null, f.gpBegin, f.carry, f.gpOut, f.gpEnd])
      );
    }

    // 13. Performance
    if (S.open) {
      const perf = openPerformance(P);
      const rows = P.ms.map((m) => [monthName(m.key), m.begin, m.contrib, -m.dist, m.income + m.gain - m.fee - m.carry, m.endCap, m.net]);
      rows.push(['Period', null, null, null, null, null, perf.period], ['Year to date', null, null, null, null, null, perf.ytd], ['Since inception, annualized', null, null, null, null, null, perf.itdAnnual]);
      out.push(sched('perf', '13_Performance.csv', 'Performance (net of fees and incentive)', 'Monthly net return to limited partners: change in capital, excluding subscriptions and redemptions, over opening capital plus subscriptions.', [COL('Month'), COL('Beginning capital', 'money'), COL('Subscriptions', 'money'), COL('Redemptions and distributions', 'money'), COL('Net income', 'money'), COL('Ending capital', 'money'), COL('Net return', 'pct')], rows));
    } else {
      const perf = closedPerformance(P);
      const rows = perf.investors.sort((a, b) => b.nav - a.nav).map((x) => [x.a.investor.id, x.a.investor.title, x.paid, x.dist, x.nav, x.dpi, x.rvpi, x.tvpi, x.irr]);
      out.push(sched('perf', '13_Performance.csv', 'Performance (net of fees and carried interest)', `Since inception through ${dateLong(P.to)}. Net IRR uses each investor’s actual contribution and distribution dates and ending capital as the terminal value.`, [COL('Investor ID'), COL('Investor'), COL('Paid-in capital', 'money'), COL('Distributions', 'money'), COL('Net asset value', 'money'), COL('DPI', 'ratio'), COL('RVPI', 'ratio'), COL('TVPI', 'ratio'), COL('Net IRR', 'pct')], rows, ['', 'Fund', perf.fund.paid, perf.fund.dist, perf.fund.nav, perf.fund.dpi, perf.fund.rvpi, perf.fund.tvpi, perf.fund.irr]));
    }

    // Fund-type schedules
    if (S.key === 'digital') {
      const cu = custody(P).map((c) => [c.name, c.custodian, c.wallet, c.bookQty, c.custQty, c.diffText || '0', c.price, c.fv, c.diff ? 'Difference' : 'Agrees', c.note]);
      out.push(sched('custody', '14_Custody_reconciliation.csv', 'Custody reconciliation', `Book quantities against custodian confirmations as of ${dateLong(asOf)}, 23:59:59 UTC.`, [COL('Asset'), COL('Custodian'), COL('Wallet or account'), COL('Book quantity', 'qty'), COL('Custodian quantity', 'qty'), COL('Difference'), COL('Price (USD)', 'price'), COL('Fair value', 'money'), COL('Result'), COL('Note')], cu));
    }
    if (S.key === 'realestate') {
      const pr = H.rows.map((r) => [r.name, r.h.location || '', r.security, r.h.acquired || o.closeDate, r.cost, r.fv, r.support && r.support.date ? r.support.date : '', r.support ? r.support.doc : '', r.debt, r.h.debtRate || '', r.h.debtMaturity || '', r.fv ? r.debt / r.fv : 0, r.input, r.equity]);
      out.push(sched('property', '14_Property_schedule.csv', 'Property schedule', `Appraised values, debt and equity as of ${dateLong(asOf)}.`, [COL('Property'), COL('Location'), COL('Description'), COL('Acquired', 'date'), COL('Cost basis', 'money'), COL('Appraised value', 'money'), COL('Appraisal date', 'date'), COL('Appraiser'), COL('Mortgage balance', 'money'), COL('Interest rate'), COL('Debt maturity', 'date'), COL('Loan to value', 'pct'), COL('Cap rate'), COL('Equity value', 'money')], pr, ['Total', '', '', '', H.rows.reduce((a, r) => a + r.cost, 0), H.longFV, '', '', H.debt, '', '', H.longFV ? H.debt / H.longFV : 0, '', H.rows.reduce((a, r) => a + r.equity, 0)]));
    }
    if (S.sleeves) {
      const sl = S.sleeves.map((sv) => {
        const fv = H.rows.filter((r) => r.sleeve === sv.name).reduce((a, r) => a + r.fv, 0);
        const rs = P.ms.map((m) => (m.r.sleeves || []).find((x) => x.name === sv.name) || { r: 0, w: 0 });
        const ret = rs.reduce((a, x) => a * (1 + x.r), 1) - 1;
        const contrib = rs.reduce((a, x) => a + x.w * x.r, 0);
        return [sv.name, sv.weight / 100, fv, H.nav ? fv / H.nav : 0, ret, contrib];
      });
      out.push(sched('sleeves', '14_Strategy_allocation.csv', 'Strategy allocation', `Target and actual allocation as of ${dateLong(asOf)}; returns are gross for the period.`, [COL('Strategy'), COL('Target allocation', 'pct'), COL('Fair value', 'money'), COL('% of net assets', 'pct'), COL('Gross return, period', 'pct'), COL('Contribution to gross return', 'pct')], sl));
    }

    // Change log and readiness
    const ev = ensureLog(ws).filter((e) => e.at.slice(0, 10) >= P.from && e.at.slice(0, 10) <= P.to && (!e.fund || e.fund === o.id) && (e.fund === o.id || !e.record || !/^[A-Z]{2,4}-\d{4}$/.test(e.record) || P.inv.some((a) => a.investor.id === e.record)));
    const all = ensureLog(ws);
    const prevOf = (e) => (e.seq > 1 ? all[e.seq - 2].hash : GENESIS);
    out.push(sched('log', '15_Change_log.csv', 'Change log', `Entries for this fund, its investors and firm-wide settings in the period (${ev.length} of ${all.length}). Each hash is SHA-256 of the previous hash and the entry, so any later edit breaks the chain. ${ver.ok ? 'Chain verified.' : `Chain broken at entry ${ver.brokenAt}.`}`, [COL('Seq', 'int'), COL('Timestamp (UTC)'), COL('User'), COL('Action'), COL('Record'), COL('Detail'), COL('Previous hash'), COL('Hash')], ev.map((e) => [e.seq, e.at, e.actor, e.action, e.record, e.detail, prevOf(e), e.hash])));
    out.push(sched('checks', '16_Readiness_checks.csv', 'Readiness checks', 'Tie-outs and documentation checks run when this package was built.', [COL('Check'), COL('Result'), COL('Detail'), COL('Exceptions')], chk.map((c) => [c.title, c.status === 'pass' ? 'Pass' : c.status === 'na' ? 'Not applicable' : `${c.items.length} exception${c.items.length === 1 ? '' : 's'}`, c.detail, c.items.join(' | ')])));
    return out;
  }

  /* ---------- CSV ---------- */
  function cellText(c, v) {
    if (v == null || v === '') return '';
    switch (c.t) {
      case 'money':
        return (v / 100).toFixed(2);
      case 'pct':
        return (v * 100).toFixed(4);
      case 'ratio':
        return Number(v).toFixed(2);
      case 'price':
        return Number(v).toFixed(2);
      case 'int':
        return String(v);
      default: {
        let s = String(v);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }
    }
  }
  function toCsv(s) {
    const head = s.cols.map((c) => cellText({ t: 'text' }, c.h + (c.t === 'pct' ? ' (%)' : c.t === 'money' ? ' (USD)' : ''))).join(',');
    const lines = [head].concat(s.rows.map((r) => s.cols.map((c, i) => cellText(c, r[i])).join(',')));
    if (s.total) lines.push(s.cols.map((c, i) => cellText(c, s.total[i])).join(','));
    return '﻿' + lines.join('\r\n') + '\r\n';
  }
  /** Display formatting for the console preview. */
  function display(c, v) {
    if (v == null || v === '') return '';
    switch (c.t) {
      case 'money':
        return money(v);
      case 'pct':
        return (v * 100).toFixed(2) + '%';
      case 'ratio':
        return Number(v).toFixed(2) + 'x';
      case 'price':
        return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'date':
        return dateShort(v);
      case 'int':
        return Number(v).toLocaleString('en-US');
      default:
        return String(v);
    }
  }

  /* ---------- The package ---------- */
  function readme(ws, P, list, chk, ver, built) {
    const o = P.o;
    const S = P.S;
    const f = P.fund;
    const t = ws.tenant;
    const ex = chk.filter((c) => c.status === 'exception');
    const lines = [
      `${o.name}`,
      `Audit package: ${dateLong(P.from)} to ${dateLong(P.to)}`,
      '',
      `Prepared for:   ${S.auditor || t.auditor || 'the fund’s independent auditor'}`,
      `Prepared by:    ${built.actor}, from the ${t.name} investor portal records`,
      `Generated:      ${built.at} UTC`,
      `Fund type:      ${o.type} (${S.label}, ${S.open ? 'open-ended' : 'closed-end'})`,
      `Fiscal year end: December 31`,
      '',
      'SUMMARY',
      `Net assets at ${dateShort(P.to)}:      ${money(f.end + f.gpEnd)}`,
      `  Limited partners:              ${money(f.end)}`,
      `  General partner:               ${money(f.gpEnd)}`,
      `Contributions in period:         ${money(f.contrib)}`,
      `Distributions in period:         ${money(f.dist)}`,
      `Net increase from operations:    ${money(f.income - f.fee + f.gain)}`,
      `Investors:                       ${P.inv.length}`,
      '',
      'READINESS',
      ...chk.map((c) => `[${c.status === 'pass' ? 'PASS' : c.status === 'na' ? ' N/A' : 'OPEN'}] ${c.title}${c.items.length ? ` (${c.items.length} exception${c.items.length === 1 ? '' : 's'})` : ''}`),
      ex.length ? '' : null,
      ...(ex.length ? ['Exceptions to resolve before fieldwork:'].concat(...ex.map((c) => c.items.map((x) => `  - ${x}`))) : []),
      '',
      'CONTENTS',
      ...list.map((s) => `${s.file.padEnd(48)} ${s.title} (${s.rows.length} row${s.rows.length === 1 ? '' : 's'})`),
      'MANIFEST.sha256                                  SHA-256 checksum of every file above',
      '',
      'HOW THE SCHEDULES TIE',
      '- 04 Capital account rollforward totals equal 03 Statement of changes in partners’ capital (limited partners).',
      '- 03 End of period equals 01 Net assets; 08 Schedule of investments totals equal 01 Investments.',
      '- 06 Capital activity ledger totals equal the contributions and distributions in 03 and 04.',
      '- 07 Each distribution’s investor allocations sum exactly to its total and to its ACH file and checks.',
      '- 11 and 12 recompute the fees and ' + (S.open ? 'incentive allocation' : 'carried interest') + ' charged in 02 and 04.',
      '',
      'BASIS OF PREPARATION',
      `- Capital accounts are maintained monthly in U.S. dollars to the cent. Income and gains are allocated in proportion to opening capital plus contributions in the month (largest-remainder rounding), so fund totals are the exact sum of investor amounts.`,
      `- Management fee: ${(S.mgmtFee * 100).toFixed(2)}% a year on ${FEE_BASIS[S.feeBasis].toLowerCase()}, charged monthly.`,
      S.carry > 0
        ? S.open
          ? `- Incentive allocation: ${(S.carry * 100).toFixed(0)}% of net profits above each investor’s high-water mark, accrued monthly and crystallized at December 31.`
          : `- Carried interest: ${(S.carry * 100).toFixed(0)}%${S.pref ? ` over an ${(S.pref * 100).toFixed(0)}% preferred return with full catch-up` : ''}, accrued at each quarter-end on a hypothetical liquidation at net asset value.`
        : '- No carried interest or incentive allocation applies.',
      `- Valuations: ${S.open ? 'monthly net asset value' : 'quarterly fair value marks'} under ASC 820; Level 3 positions list technique, key unobservable input and supporting document.`,
      '- Distributions are recorded on the payment date and split pro rata to the cent; ACH payments reference the NACHA file and trace number, checks reference the check number.',
      `- Change log: ${ver.count} entries, each SHA-256 hashed with the entry before it. ${ver.ok ? 'The chain verified when this package was built.' : `The chain breaks at entry ${ver.brokenAt}.`}`,
      '- Bank account and taxpayer numbers are masked. Amounts in CSV files are plain numbers in U.S. dollars; percentages are shown as percent values.',
      '',
      'VERIFYING THE FILES',
      'On macOS or Linux, run:  shasum -a 256 -c MANIFEST.sha256',
      'On Windows PowerShell:   Get-FileHash <file> -Algorithm SHA256',
      '',
      'These schedules are prepared from the portal’s records for the auditor’s use. They are unaudited.'
    ].filter((x) => x !== null);
    return lines.join('\r\n') + '\r\n';
  }
  function slugify(s) {
    return String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  function build(ws, o, from, to) {
    const P = period(ws, o, from, to);
    const ver = verify(ws);
    const chk = checks(ws, P, { verify: ver });
    const list = schedules(ws, P, chk, ver);
    return { P, ver, chk, list };
  }
  /** Assemble the zip: every schedule as CSV, a README and a SHA-256 manifest. Logs the export. */
  function exportPackage(ws, o, from, to) {
    const B = build(ws, o, from, to);
    const built = { actor: currentActor(), at: new Date().toISOString().replace(/\.\d{3}Z$/, '').replace('T', ' ') };
    const files = B.list.map((s) => ({ name: s.file, data: utf8(toCsv(s)) }));
    files.unshift({ name: '00_README.txt', data: utf8(readme(ws, B.P, B.list, B.chk, B.ver, built)) });
    const manifest = files.map((f) => `${sha256(f.data)}  ${f.name}`).join('\n') + '\n';
    files.push({ name: 'MANIFEST.sha256', data: utf8(manifest) });
    const bytes = zip(files, new Date());
    const hash = sha256(bytes);
    const name = `${slugify(ws.tenant.shortName)}_${slugify(o.shortName || o.name)}_audit_package_${B.P.from}_to_${B.P.to}.zip`;
    log(ws, { action: 'Audit package exported', fund: o.id, record: name, detail: `${files.length} files; ${B.chk.filter((c) => c.status === 'exception').reduce((a, c) => a + c.items.length, 0)} open exceptions; SHA-256 ${hash}` });
    return { name, bytes, hash, files: files.map((f) => ({ name: f.name, size: f.data.length })), build: B };
  }

  NS.audit = {
    PROFILES,
    FEE_BASIS,
    settings,
    ledger,
    period,
    presets,
    snap,
    checks,
    schedules,
    build,
    exportPackage,
    toCsv,
    display,
    money,
    ensureLog,
    log,
    verify,
    sha256,
    zip,
    crc32,
    xirr,
    custody,
    lastMonthEnd
  };
})(window.CVPortal);
