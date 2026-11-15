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

  /** The kind of exemption an offering names: '506c', '506b', 'other' (any other text) or '' (not set). */
  function regime(o) {
    const ex = String(((o && o.structure) || {}).exemption || '').trim();
    if (!ex) return '';
    // The same test integrations.js uses for verified accreditation: any mention of Rule 506(c) makes it 506(c).
    if (/506\(c\)/.test(ex)) return '506c';
    if (/506\(b\)/.test(ex)) return '506b';
    return 'other';
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
   * Purchasers of an offering who are not accredited, one per investor however many subscriptions they made.
   * Declined subscriptions are left out. An investor with any subscription past pending (approved, funded, accepted,
   * paid) is accepted; otherwise pending. The latest answer an investor gave decides. count is accepted plus pending:
   * the figure measured against the limit if the pending ones are accepted. unanswered: investors who left the
   * question open (no answers on file, or accredited not given).
   */
  function nonAccredited(ws, o) {
    const by = new Map();
    ((ws && ws.requests) || []).forEach((r) => {
      if (!r || r.type !== 'subscription' || !o || r.offeringId !== o.id || r.status === 'rejected') return;
      const e = by.get(r.investorId) || { past: false, qual: null };
      if (r.status !== 'pending') e.past = true;
      const q = qualOf(r);
      if (q) e.qual = q;
      by.set(r.investorId, e);
    });
    const accepted = [];
    const pending = [];
    const unanswered = [];
    by.forEach((e, id) => {
      if (!e.qual || e.qual.accredited == null) unanswered.push(id);
      else if (e.qual.accredited === false) (e.past ? accepted : pending).push(id);
    });
    return { accepted, pending, count: accepted.length + pending.length, unanswered: unanswered.length };
  }

  NS.eligibility = { regime, LIMIT_506B, BASES, qualOf, nonAccredited };
})(window.CVPortal);
