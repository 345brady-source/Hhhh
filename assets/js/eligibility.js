/*
 * Investor eligibility by securities exemption (self-serve edition).
 *
 * The invitation flow asks each investor about their status for the offering they were invited to: under Rule 506(b),
 * whether the account is an accredited investor (and on what ground), and if not, the questions a sponsor uses to judge
 * sophistication. The answers ride on the subscription request (request.qual). The console reads them back here: under
 * Rule 506(b) no more than 35 purchasers who are not accredited may buy, so the offering page shows the running count.
 * Figures are worked out on every render from the requests, never stored as counters.
 */
(function (NS) {
  'use strict';

  const LIMIT_506B = 35;

  /**
   * The kind of exemption an offering names: '506c', '506b', 'regA1' (Regulation A Tier 1), 'regA2listed' (Regulation A
   * Tier 2 with the securities listed on a national securities exchange), 'regA2' (Regulation A Tier 2, and any text naming
   * Regulation A without a tier, such as the value read from documents: C-04), 'other' (any other text) or '' (not set).
   */
  function regime(o) {
    const ex = String(((o && o.structure) || {}).exemption || '').trim();
    if (!ex) return '';
    // The same test integrations.js uses for verified accreditation: any mention of Rule 506(c) makes it 506(c).
    if (/506\(c\)/.test(ex)) return '506c';
    if (/506\(b\)/.test(ex)) return '506b';
    if (/\bRegulation A\b|\bReg\.? A\b/i.test(ex)) {
      if (/\bTier\s*(?:1|I|one)\b/i.test(ex)) return 'regA1';
      if (/exchange-listed|listed on a national securities exchange/i.test(ex)) return 'regA2listed';
      return 'regA2';
    }
    return 'other';
  }

  /** A figure the investor gave, in whole dollars: counted only when it is a finite number from 0 to one trillion. */
  function figure(x) {
    if (x == null || typeof x === 'boolean' || (typeof x === 'string' && !x.trim())) return null;
    const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x.trim()) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 1e12 ? n : null;
  }

  /**
   * Regulation A Tier 2's investment limit for an investor who is not accredited (Rule 251(d)(2)(i)(C)), in cents: 10 percent
   * of the greater of annual income and net worth for a person, or of revenue and net assets for the most recent fiscal year
   * for an organization. q: { kind: 'person' | 'entity', income, netWorth, revenue, netAssets } in whole dollars. null when
   * neither figure of the pair counts, so the limit is not known.
   */
  function regALimitCents(q) {
    if (!q || typeof q !== 'object') return null;
    const pair = q.kind === 'person' ? [q.income, q.netWorth] : q.kind === 'entity' ? [q.revenue, q.netAssets] : [];
    const got = pair.map(figure).filter((n) => n != null);
    return got.length ? Math.round(Math.max.apply(null, got) * 10) : null;
  }

  /** An amount in cents as US dollars: "$40,000", or "$1,234.50" when it has cents. */
  function usd(cents) {
    const c = Math.round(Number(cents) || 0);
    const whole = String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const rest = Math.abs(c) % 100;
    return `${c < 0 ? '-' : ''}$${whole}${rest ? '.' + String(rest).padStart(2, '0') : ''}`;
  }

  /** What an investor has committed to an offering: their subscriptions to it, declined ones left out, in cents. */
  function committedCents(ws, o, investorId) {
    return ((ws && ws.requests) || []).reduce((t, r) => (r && r.type === 'subscription' && o && r.offeringId === o.id && r.investorId === investorId && r.status !== 'rejected' ? t + (Math.round(Number(r.cents)) || 0) : t), 0);
  }

  /** The grounds for accredited status under Rule 501(a), as amended in 2020, in short wording of our own. */
  const BASES = [
    'Income over $200,000 (or $300,000 together with a spouse or spousal equivalent) in each of the last two years, expecting the same this year',
    'Net worth over $1 million, not counting the primary residence',
    'Holds a Series 7, 65 or 82 license in good standing',
    'Knowledgeable employee of the fund',
    'Director, executive officer or general partner of the issuer or of its general partner',
    'Bank, broker-dealer, investment adviser, insurance company, investment company or similar institution',
    'Entity with total assets over $5 million, not formed to make this investment',
    'Entity owning investments over $5 million, not formed to make this investment',
    'Trust with total assets over $5 million, directed by a sophisticated person',
    'Family office with assets over $5 million, or a family client of one',
    'Entity whose equity owners are all accredited investors',
    'Employee benefit plan meeting the rule’s asset or fiduciary test'
  ];

  /** The status answers kept on a subscription request, or null when it has none. */
  function qualOf(r) {
    const q = r && r.qual;
    return q && typeof q === 'object' && !Array.isArray(q) ? q : null;
  }

  /**
   * Each investor's subscriptions to an offering, declined ones left out: { past: any subscription beyond pending, qual:
   * the latest answer given, first: where the investor's first subscription stands in the list of requests }.
   */
  function tally(ws, o) {
    const by = new Map();
    ((ws && ws.requests) || []).forEach((r, k) => {
      if (!r || r.type !== 'subscription' || !o || r.offeringId !== o.id || r.status === 'rejected') return;
      const e = by.get(r.investorId) || { past: false, qual: null, first: k };
      if (r.status !== 'pending') e.past = true;
      const q = qualOf(r);
      if (q) e.qual = q;
      by.set(r.investorId, e);
    });
    return by;
  }

  /**
   * Purchasers of an offering who are not accredited, one per investor however many subscriptions they made.
   * Declined subscriptions are left out. An investor with any subscription past pending (approved, funded, accepted,
   * paid) is accepted; otherwise pending. The latest answer an investor gave decides. count is accepted plus pending:
   * the figure measured against the limit if the pending ones are accepted. unanswered: investors who left the
   * question open (no answers on file, or accredited not given), and holders of the offering with no subscription made
   * through the portal, whose status cannot be told (holders: how many of the unanswered these are). ranked: the counted
   * investors in the order they take places under the limit, accepted ones first, then pending ones, each in the order
   * they first subscribed. No Rule 501(e) exclusion is asked (relatives sharing a home), so the count errs on the high side.
   */
  function nonAccredited(ws, o) {
    const by = tally(ws, o);
    const accepted = [];
    const pending = [];
    const unanswered = [];
    by.forEach((e, id) => {
      if (!e.qual || e.qual.accredited == null) unanswered.push(id);
      else if (e.qual.accredited === false) (e.past ? accepted : pending).push(id);
    });
    let holders = 0;
    ((ws && ws.investors) || []).forEach((i) => {
      if (!i || !o || by.has(i.id) || !(i.positions || []).some((x) => x && x.offeringId === o.id)) return;
      unanswered.push(i.id);
      holders++;
    });
    const first = (id) => by.get(id).first;
    const inOrder = (list) => list.slice().sort((a, b) => first(a) - first(b));
    const ranked = inOrder(accepted).concat(inOrder(pending));
    return { accepted, pending, count: accepted.length + pending.length, unanswered: unanswered.length, holders, ranked };
  }

  /**
   * The place an investor takes among the offering's purchasers who are not accredited: their own place when already
   * counted, otherwise the next one. A place above LIMIT_506B means the offering would pass the limit with them.
   */
  function place(ws, o, investorId) {
    const n = nonAccredited(ws, o);
    const k = n.ranked.indexOf(investorId);
    return k >= 0 ? k + 1 : n.count + 1;
  }

  /**
   * Warnings for the sponsor on one subscription request (C-01: shown, never blocking). Under Rule 506(b), a request that
   * says the investor is not accredited, from an investor whose place under the limit comes after the 35th, is flagged.
   */
  function flags(ws, r) {
    if (!r || r.type !== 'subscription' || r.status === 'rejected') return [];
    const q = qualOf(r);
    if (!q || q.accredited !== false) return [];
    const o = ((ws && ws.offerings) || []).find((x) => x && x.id === r.offeringId);
    if (!o || regime(o) !== '506b') return [];
    const k = nonAccredited(ws, o).ranked.indexOf(r.investorId);
    if (k < LIMIT_506B) return [];
    return [`Would be non-accredited purchaser ${k + 1} of the ${LIMIT_506B} allowed under Rule 506(b)`];
  }

  /**
   * Regulation A Tier 2 (D-01, C-01): each investor with a subscription to the offering (declined ones left out) whose latest
   * answer says not accredited. rows: { investorId, totalCents (every such subscription of theirs to it), limitCents
   * (worked out again here from the figures they gave, never the over-limit flag their device set: T-06-06), over }.
   * over: how many rows are above their limit; noFigures: how many gave no figure that counts (limit not known). Empty
   * unless the offering is Tier 2 and not listed on an exchange.
   */
  function regAStatus(ws, o) {
    const out = { rows: [], over: 0, noFigures: 0 };
    if (regime(o) !== 'regA2') return out;
    tally(ws, o).forEach((e, id) => {
      if (!e.qual || e.qual.accredited !== false) return;
      const ra = e.qual.regA && typeof e.qual.regA === 'object' ? e.qual.regA : null;
      const limitCents = regALimitCents(ra);
      const totalCents = committedCents(ws, o, id);
      const over = limitCents != null && totalCents > limitCents;
      out.rows.push({ investorId: id, totalCents, limitCents, over });
      if (over) out.over++;
      if (limitCents == null) out.noFigures++;
    });
    return out;
  }

  NS.eligibility = { regime, LIMIT_506B, BASES, qualOf, nonAccredited, place, flags, figure, regALimitCents, usd, committedCents, regAStatus };
})(window.CVPortal);
