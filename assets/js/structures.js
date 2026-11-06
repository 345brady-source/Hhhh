/*
 * Fund structures beyond one class in U.S. dollars: currencies, share
 * classes, master-feeder vehicles, side pockets, equalization and
 * distribution waterfalls. audit.js applies them when it keeps capital
 * accounts; the console and the offering-document intake set them on each
 * offering.
 */
(function (NS) {
  'use strict';
  const D = NS.dates;

  /* ---------- Currencies ---------- */
  const CURRENCIES = {
    USD: { symbol: '$', name: 'U.S. dollar' },
    EUR: { symbol: '€', name: 'Euro' },
    GBP: { symbol: '£', name: 'Pound sterling' },
    CHF: { symbol: 'CHF ', name: 'Swiss franc' },
    CAD: { symbol: 'C$', name: 'Canadian dollar' },
    AUD: { symbol: 'A$', name: 'Australian dollar' },
    JPY: { symbol: '¥', name: 'Japanese yen', dec: 0 },
    SGD: { symbol: 'S$', name: 'Singapore dollar' },
    HKD: { symbol: 'HK$', name: 'Hong Kong dollar' }
  };
  /**
   * Reference rates to U.S. dollars, used only to total holdings across
   * currencies on summary screens. In production these come from the
   * administrator's month-end rates.
   */
  const FX_USD = { USD: 1, EUR: 1.08, GBP: 1.27, CHF: 1.12, CAD: 0.73, AUD: 0.65, JPY: 0.0067, SGD: 0.74, HKD: 0.128 };
  const curOf = (o) => (o && o.currency && CURRENCIES[o.currency] ? o.currency : 'USD');
  /** Amount in minor units (cents) as money in the given currency. */
  function fmt(cents, cur) {
    const c = CURRENCIES[cur] || CURRENCIES.USD;
    const dec = c.dec == null ? 2 : c.dec;
    const s = (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return (cents < 0 ? '−' : '') + c.symbol + s;
  }
  /** Whole-unit amount (no cents), e.g. an amount invested. */
  function fmtWhole(amount, cur) {
    const c = CURRENCIES[cur] || CURRENCIES.USD;
    return (amount < 0 ? '−' : '') + c.symbol + Math.abs(Math.round(amount)).toLocaleString('en-US');
  }
  const toUSD = (cents, cur) => Math.round(cents * (FX_USD[cur] || 1));

  /* ---------- Share classes and feeder funds ---------- */
  const pct = (v, d) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v) / 100);
  /**
   * The class an investor's interest belongs to: the class recorded on the
   * position, else a class whose eligibility rule they meet (founders who
   * subscribed by a date), else the first class.
   */
  function classOf(o, inv, classes) {
    const list = classes || o.classes;
    if (!list || !list.length) return null;
    const ps = inv.positions.filter((p) => p.offeringId === o.id);
    const set = ps.find((p) => p.class);
    if (set) return list.find((c) => c.id === set.class) || list[0];
    const first = ps.map((p) => p.date).sort()[0] || '';
    const founders = list.find((c) => c.subscribedBy && first && first <= c.subscribedBy);
    return founders || list.find((c) => !c.subscribedBy) || list[0];
  }
  /** Fee terms for an investor: their class's terms, falling back to the offering's. */
  function termsFor(S, cls) {
    return {
      mgmtFee: pct(cls && cls.mgmtFee, S.mgmtFee),
      carry: pct(cls && cls.carry, S.carry),
      pref: pct(cls && cls.pref, S.pref),
      cls
    };
  }
  /** The feeder an investor invests through: as recorded, else by investor type (tax-exempt investors go offshore). */
  function feederOf(o, inv, feeders) {
    const list = feeders || o.feeders;
    if (!list || !list.length) return null;
    const set = inv.positions.find((p) => p.offeringId === o.id && p.feeder);
    if (set) return list.find((f) => f.id === set.feeder) || list[0];
    const exempt = inv.type === 'ira';
    return (exempt && list.find((f) => /exempt|offshore|non-u/i.test((f.for || '') + ' ' + (f.name || '')))) || list.find((f) => !/offshore|exempt/i.test((f.for || '') + ' ' + (f.name || ''))) || list[0];
  }

  /* ---------- Distribution waterfall ---------- */
  const years = (a, b) => Math.max(0, (D.parse(b) - D.parse(a)) / (365.25 * 864e5));
  /** What limited partners still need to reach `rate` a year by `date`, before this distribution. */
  function shortfall(flows, rate, date, simple) {
    return flows.reduce((a, f) => a - f.cents * (simple ? 1 + rate * years(f.date, date) : Math.pow(1 + rate, years(f.date, date))), 0);
  }
  /** The usual European structure when an offering states only carry and a preferred return. */
  function defaultTiers(carry, pref, catchUp) {
    if (!carry) return [{ kind: 'roc' }, { kind: 'split', lp: 100, gp: 0 }];
    const t = [{ kind: 'roc' }];
    if (pref) {
      t.push({ kind: 'pref', rate: +(pref * 100).toFixed(4) });
      if (catchUp !== 0) t.push({ kind: 'catchup', gp: catchUp == null ? 100 : catchUp });
    }
    t.push({ kind: 'split', lp: +(100 - carry * 100).toFixed(4), gp: +(carry * 100).toFixed(4) });
    return t;
  }
  function tierLabel(t) {
    if (t.kind === 'roc') return 'Return of contributed capital';
    if (t.kind === 'pref') return `Preferred return, ${t.rate}% a year${t.simple ? ' (simple)' : ''}`;
    if (t.kind === 'catchup') return `GP catch-up, ${t.gp == null ? 100 : t.gp}% to the GP`;
    return `${t.lp}% to investors / ${t.gp}% to the GP${t.upTo != null && t.upTo !== '' ? `, until investors reach a ${t.upTo}% IRR` : ' thereafter'}`;
  }
  /**
   * Split `amount` (minor units) paid at `date` between investors (LP) and the
   * GP, tier by tier. `flows` are the investors' cash flows to date
   * (contributions negative, distributions positive); `gpPrior` is carried
   * interest the GP has already received. Tiers run in order: return of
   * capital, preferred return (compounding unless `simple`), GP catch-up,
   * then splits, each split ending when investors reach its IRR (`upTo`).
   */
  function waterfall(tiers, flows, gpPrior, amount, date) {
    const contributed = -flows.filter((f) => f.cents < 0).reduce((a, f) => a + f.cents, 0);
    const distributed = flows.filter((f) => f.cents > 0).reduce((a, f) => a + f.cents, 0);
    const split = tiers.find((t) => t.kind === 'split' && Number(t.gp) > 0);
    const carryRate = split ? Number(split.gp) / 100 : 0;
    let left = Math.max(0, Math.round(amount));
    let lp = 0;
    let gp = 0;
    const out = [];
    tiers.forEach((t) => {
      let tl = 0;
      let tg = 0;
      if (left > 0) {
        if (t.kind === 'roc' || t.kind === 'pref') {
          const need = Math.max(0, Math.round(shortfall(flows, t.kind === 'roc' ? 0 : (Number(t.rate) || 0) / 100, date, !!t.simple)) - lp);
          tl = Math.min(left, need);
        } else if (t.kind === 'catchup') {
          const c = (t.gp == null ? 100 : Number(t.gp)) / 100;
          if (c > carryRate && carryRate > 0) {
            const lpProfit = distributed + lp - contributed;
            const gpSoFar = gpPrior + gp;
            const take = Math.min(left, Math.max(0, Math.round((carryRate * (lpProfit + gpSoFar) - gpSoFar) / (c - carryRate))));
            tg = Math.round(take * c);
            tl = take - tg;
          }
        } else {
          const a = (t.lp == null ? 100 : Number(t.lp)) / 100;
          let take = left;
          if (t.upTo != null && t.upTo !== '' && a > 0) take = Math.min(left, Math.round(Math.max(0, Math.round(shortfall(flows, Number(t.upTo) / 100, date, false)) - lp) / a));
          tl = Math.round(take * a);
          tg = take - tl;
        }
        left -= tl + tg;
        lp += tl;
        gp += tg;
      }
      out.push({ tier: t, label: tierLabel(t), lp: tl, gp: tg });
    });
    if (left > 0) lp += left;
    return { lp, gp, tiers: out };
  }

  /* ---------- Side pockets and equalization ---------- */
  const EQUALIZATION = {
    'capital accounts': 'Capital accounts: incentive is computed on each investor’s own gains above their high-water mark',
    equalization: 'Equalization: each investor bears incentive only on their own gains (computed per investor here, with the same result)',
    series: 'Series of shares: each subscription has its own high-water mark (computed per investor here, with the same result)'
  };

  NS.structures = { CURRENCIES, FX_USD, curOf, fmt, fmtWhole, toUSD, classOf, termsFor, feederOf, defaultTiers, tierLabel, waterfall, shortfall, EQUALIZATION, pct };
})(window.CVPortal);
