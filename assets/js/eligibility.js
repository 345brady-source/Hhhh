/*
 * Investor eligibility by securities exemption (self-serve edition).
 *
 * The invitation flow asks each investor about their status for the offering they were invited to: under Rule 506(b),
 * whether the account is an accredited investor (and on what ground), and if not, whether it has (alone or with a
 * purchaser representative) the knowledge and experience Rule 506(b)(2)(ii) asks about. The answers ride on the subscription request (request.qual). The console reads them back here: under
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

  /** An amount in cents as US dollars: "$40,000", or "$1,234.50" when it has cents. */
  function usd(cents) {
    const c = Math.round(Number(cents) || 0);
    const whole = String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const rest = Math.abs(c) % 100;
    return `${c < 0 ? '-' : ''}$${whole}${rest ? '.' + String(rest).padStart(2, '0') : ''}`;
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
   * D-08 (1) (plan 06-15): no flag comes from a benefit plan answer; the sponsor judges from the plain list (planInvestors).
   */
  function flags(ws, r) {
    if (!r || r.type !== 'subscription' || r.status === 'rejected') return [];
    const off = ((ws && ws.offerings) || []).find((x) => x && x.id === r.offeringId);
    return exemptionFlags(ws, r, off);
  }
  function exemptionFlags(ws, r, off) {
    // Regulation A Tier 2 (D-07): every subscription of an investor who is not accredited and whose latest answer does not
    // attest to the 10 percent limit.
    if (off && regime(off) === 'regA2') {
      const row = regAStatus(ws, off).rows.find((x) => x.investorId === r.investorId);
      return row && row.attested !== true ? [RA_NOT_ATTESTED] : [];
    }
    const q = qualOf(r);
    if (!q || q.accredited !== false) return [];
    if (!off || regime(off) !== '506b') return [];
    const k = nonAccredited(ws, off).ranked.indexOf(r.investorId);
    if (k < LIMIT_506B) return [];
    return [`Would be non-accredited purchaser ${k + 1} of the ${LIMIT_506B} allowed under Rule 506(b)`];
  }
  /** The sponsor's flag on a Tier 2 subscription without the investor's attestation (D-07, C-01: shown, never blocking). */
  const RA_NOT_ATTESTED = 'Not accredited and has not attested to the Regulation A Tier 2 limit (10 percent of income or net worth)';
  /**
   * Regulation A Tier 2 (D-07, C-01): each investor with a subscription to the offering (declined ones left out) whose latest
   * answer says not accredited, with whether that answer attests that the total they put into the offering is within 10
   * percent of the greater of their income or net worth (organizations: revenue or net assets). rows: { investorId,
   * attested (true; false when left unticked; null when the answer carries no attestation) }. notAttested: how many rows do
   * not attest. The portal takes no figures and works out no limit: the issuer relies on the investor's statement (Rule
   * 251(d)(2)(i)(C)). unanswered: [{ investorId }], the subscribers whose latest answer leaves the accredited question
   * open (or who have no answers on file): they were not asked about the limit, so the sponsor sees them apart. Empty
   * unless the offering is Tier 2 and not listed on an exchange.
   */
  function regAStatus(ws, o) {
    const out = { rows: [], notAttested: 0, unanswered: [] };
    if (regime(o) !== 'regA2') return out;
    tally(ws, o).forEach((e, id) => {
      if (!e.qual || typeof e.qual.accredited !== 'boolean') return void out.unanswered.push({ investorId: id });
      if (e.qual.accredited !== false) return;
      const ra = e.qual.regA && typeof e.qual.regA === 'object' ? e.qual.regA : null;
      const attested = ra && typeof ra.attested === 'boolean' ? ra.attested : null;
      out.rows.push({ investorId: id, attested });
      if (attested !== true) out.notAttested++;
    });
    return out;
  }

  /* ---------- Benefit plan investors (ERISA), D-01 and D-08 (1) ---------- */

  /** A plan-asset entity's stated percentage, counted only when it is a finite number from 0 to 100; otherwise null. */
  function planPct(x) {
    if (x == null || typeof x === 'boolean' || (typeof x === 'string' && !x.trim())) return null;
    const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x.trim().replace(/%$/, '')) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  }
  /** The answers that say the investor is a benefit plan investor (29 CFR 2510.3-101(f)(2)). */
  const PLAN_YES = ['title1', '4975', 'planAssets'];
  /**
   * D-08 (1) (owner, plan 06-15): the investors of an offering whose latest benefit plan answer is yes, for the sponsor's own
   * judgment of the 25 percent test (no percentages are worked out here). The latest answer is the one on their latest
   * subscription to the offering that carries one (declined ones left out), else the one on their investor record.
   * Rows, in the order the investors first appear: { investorId, plan, planPct (an entity holding plan assets: its stated
   * share, or null), cents (committed: positions on the books, and accepted subscriptions not yet on them), pendingCents
   * (subscriptions not yet decided) }.
   */
  function planInvestors(ws, o) {
    if (!ws || !o) return [];
    const order = [];
    const seen = (id) => order.indexOf(id) >= 0 || order.push(id);
    const invById = new Map((ws.investors || []).filter(Boolean).map((i) => [i.id, i]));
    const said = new Map();
    const cents = new Map();
    const pend = new Map();
    const add = (m, id, n) => m.set(id, (m.get(id) || 0) + n);
    const onBooks = new Set();
    invById.forEach((inv) => {
      const ps = (inv.positions || []).filter((p) => p && p.offeringId === o.id && !p.redeemed);
      if (!ps.length) return;
      seen(inv.id);
      ps.forEach((p) => p.ref && onBooks.add(p.ref));
      add(cents, inv.id, ps.reduce((a, p) => a + Math.round((Number(p.commitment != null ? p.commitment : p.amount) || 0) * 100), 0));
    });
    (ws.requests || []).filter((r) => r && r.type === 'subscription' && r.offeringId === o.id && r.status !== 'rejected').forEach((r) => {
      seen(r.investorId);
      const q = qualOf(r);
      if (q && q.erisa && typeof q.erisa === 'object' && q.erisa.plan) said.set(r.investorId, q.erisa);
      const c = Math.max(0, Math.round(Number(r.cents)) || 0);
      if (r.status === 'pending') add(pend, r.investorId, c);
      else if (!onBooks.has(r.id)) add(cents, r.investorId, c);
    });
    const out = [];
    order.forEach((id) => {
      const e = said.has(id) ? said.get(id) : (invById.get(id) || {}).erisa;
      if (!e || typeof e !== 'object' || PLAN_YES.indexOf(e.plan) < 0) return;
      out.push({ investorId: id, plan: e.plan, planPct: e.plan === 'planAssets' ? planPct(e.planPct) : null, cents: cents.get(id) || 0, pendingCents: pend.get(id) || 0 });
    });
    return out;
  }

  NS.eligibility = { regime, LIMIT_506B, BASES, qualOf, nonAccredited, place, flags, usd, RA_NOT_ATTESTED, regAStatus, planPct, PLAN_YES, planInvestors };
})(window.CVPortal);
