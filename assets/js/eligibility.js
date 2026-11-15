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
   * Under every exemption, a pending request that would bring benefit plan investors to 25 percent or more of its class.
   */
  function flags(ws, r) {
    if (!r || r.type !== 'subscription' || r.status === 'rejected') return [];
    const off = ((ws && ws.offerings) || []).find((x) => x && x.id === r.offeringId);
    return exemptionFlags(ws, r, off).concat(bpiFlags(ws, r, off));
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
  /** D-01: a pending request whose if-accepted share of benefit plan investors in its class is 25 percent or more. */
  function bpiFlags(ws, r, off) {
    if (!off || r.status !== 'pending') return [];
    for (const row of erisa(ws, off, { capital: false })) {
      const f = row.ifAccepted.find((x) => x.requestId === r.id);
      if (f && f.pct >= BPI_LIMIT) return [`If accepted, benefit plan investors would hold ${pctText(f.pct)}% of ${row.name} (25 percent or more)`];
    }
    return [];
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

  /* ---------- Benefit plan investors (ERISA), D-01 ---------- */

  /** At 25 percent or more of the value of any class held by benefit plan investors, a fund's assets can be plan assets. */
  const BPI_LIMIT = 25;
  /** A plan-asset entity's stated percentage, counted only when it is a finite number from 0 to 100; otherwise null. */
  function planPct(x) {
    if (x == null || typeof x === 'boolean' || (typeof x === 'string' && !x.trim())) return null;
    const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x.trim().replace(/%$/, '')) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  }
  /**
   * How much of a holder's interest counts as held by benefit plan investors, from their answers e = { plan, planPct }:
   * 1 for a plan under Title I of ERISA or under Code section 4975 (an IRA or Keogh plan), the stated percentage for an
   * entity whose assets include plan assets, 0 for a governmental, church or non-U.S. plan or none of these, and null
   * when the question was not answered (or a plan-asset entity gave no percentage that counts).
   */
  function bpiShare(e) {
    if (!e || typeof e !== 'object') return null;
    if (e.plan === 'title1' || e.plan === '4975') return 1;
    if (e.plan === 'planAssets') {
      const n = planPct(e.planPct);
      return n == null ? null : n / 100;
    }
    if (e.plan === 'other' || e.plan === 'none') return 0;
    return null;
  }
  /**
   * A percentage as shown, to one decimal place, rounded to the nearest tenth; a figure under 25 is never shown as 25 or
   * more (24.96 reads 24.9), so the red mark and the number always agree.
   */
  const pctText = (n) => {
    const v = Number(n) || 0;
    let t = Math.round(v * 10 + 1e-9) / 10;
    if (v < BPI_LIMIT && t >= BPI_LIMIT) t = Math.floor(v * 10) / 10;
    return String(t);
  };
  const erisaOf = (r) => {
    const q = qualOf(r);
    return q && q.erisa && typeof q.erisa === 'object' ? q.erisa : null;
  };
  /** The investor ids the sponsor marked as controlling persons or affiliates for the offering (offering.erisaControlling). */
  const controllingMarks = (o) => new Set(Array.isArray(o && o.erisaControlling) ? o.erisaControlling.filter((x) => typeof x === 'string' && x) : []);
  /**
   * The capital balance of each holder at the last month end, in cents (the same NS.ops.capital call the requests page
   * uses), or null when the capital accounts are not loaded. A holder with no balance there maps to 0.
   */
  function capitalAt(ws, o, ids) {
    const OPS = NS.ops;
    const AU = NS.audit;
    if (!OPS || typeof OPS.capital !== 'function' || !AU || typeof AU.lastMonthEnd !== 'function' || !NS.dates || typeof NS.dates.today !== 'function') return null;
    const end = AU.lastMonthEnd(NS.dates.today());
    const out = new Map();
    const byId = new Map((ws.investors || []).filter(Boolean).map((i) => [i.id, i]));
    ids.forEach((id) => {
      let c = null;
      try {
        c = OPS.capital(ws, byId.get(id), o, end.slice(0, 8) + '01', end);
      } catch (e) {
        c = null;
      }
      const v = c && c.a ? Math.round(Number(c.a.end)) : 0;
      out.set(id, Number.isFinite(v) ? v : 0);
    });
    return { end, cents: out };
  }
  /**
   * The share of each class of an offering held by benefit plan investors (D-01), for the sponsor only (T-06-09).
   *
   * Value basis, one for the whole offering: capital balances at the last month end when every holder has one above 0
   * (NS.ops.capital), otherwise what each holder has committed or subscribed (a position's commitment, or its amount where
   * it has none: the rule NS.ops.commitOf applies; fully redeemed positions left out), with subscriptions accepted but not
   * yet on a position (those have no capital balance yet, so they bring the commitments basis). Each row names its basis.
   *
   * A holder's share comes from their latest answers on a subscription to the offering, else from their investor record;
   * with neither (or a plan-asset percentage that does not count: T-06-12) the holder counts as 0 and is listed as not
   * answered, never guessed (D-30). A holder is controlling when the sponsor marked it (offering.erisaControlling) or its own
   * latest answer says it has control over the offering's assets or gives paid advice about them: the value of a controlling
   * holder that is not a benefit plan investor (share 0) is left out of the class total (disregarded); a controlling benefit
   * plan investor is counted. An offering without classes has one, "All interests".
   *
   * For each pending subscription: the class's percentage were it accepted at its amount and its own answers, on the
   * commitments basis (the basis once it is accepted, as it has no capital balance yet). opts.capital false skips the
   * capital lookup (the request flags need only the if-accepted figures).
   *
   * Rows: { classId, name, basis ('capital' | 'commitments'), asOf (the capital date, or ''), total, bpiValue, disregarded
   * (in cents, on the basis), pct, unanswered: [investorId], holders: [{ investorId, cents, share, answered, controlling,
   * marked, own }], ifAccepted: [{ requestId, investorId, cents, pct }] }.
   */
  function erisa(ws, o, opts) {
    if (!ws || !o) return [];
    opts = opts || {};
    const list = Array.isArray(o.classes) && o.classes.length ? o.classes : null;
    const rows = (list || [{ id: '', name: 'All interests' }]).map((c) => ({ classId: c.id, name: c.name || c.id || 'All interests', basis: 'commitments', asOf: '', total: 0, bpiValue: 0, disregarded: 0, pct: 0, unanswered: [], holders: [], ifAccepted: [] }));
    const rowById = (id) => rows.find((x) => x.classId === id) || rows[0];
    const SC = NS.structures;
    const invById = new Map((ws.investors || []).filter(Boolean).map((i) => [i.id, i]));
    const classOfInv = (inv) => {
      if (!list || !inv || !SC || !SC.classOf) return rows[0];
      const c = SC.classOf(o, { positions: inv.positions || [] }, list);
      return rowById(c ? c.id : '');
    };
    const subs = (ws.requests || []).filter((r) => r && r.type === 'subscription' && r.offeringId === o.id && r.status !== 'rejected');
    const answered = new Map();
    const saidCtrl = new Map();
    subs.forEach((r) => {
      const e = erisaOf(r);
      const s = bpiShare(e);
      if (s != null) answered.set(r.investorId, s);
      if (e && typeof e.controlling === 'boolean') saidCtrl.set(r.investorId, e.controlling);
    });
    /** The holder's share, or null when they have not answered. */
    const shareRaw = (id) => (answered.has(id) ? answered.get(id) : bpiShare((invById.get(id) || {}).erisa));
    const shareOf = (id) => {
      const s = shareRaw(id);
      return s == null ? 0 : s;
    };
    const marks = controllingMarks(o);
    const ownCtrl = (id) => (saidCtrl.has(id) ? saidCtrl.get(id) : !!((invById.get(id) || {}).erisa && invById.get(id).erisa.controlling === true));
    // One entry per holder and class, with what it has committed or subscribed; the figures are added up once all are in.
    const entries = new Map();
    const entry = (row, id) => {
      const k = row.classId + '|' + id;
      if (!entries.has(k)) entries.set(k, { row, investorId: id, commit: 0, onBooks: false, accepted: false });
      return entries.get(k);
    };
    const onPosition = new Set();
    invById.forEach((inv) => {
      const ps = (inv.positions || []).filter((p) => p && p.offeringId === o.id && !p.redeemed);
      if (!ps.length) return;
      ps.forEach((p) => p.ref && onPosition.add(p.ref));
      const x = entry(classOfInv(inv), inv.id);
      x.onBooks = true;
      x.commit += ps.reduce((a, p) => a + Math.round((Number(p.commitment != null ? p.commitment : p.amount) || 0) * 100), 0);
    });
    const centsOf = (r) => Math.max(0, Math.round(Number(r.cents)) || 0);
    const rowOfReq = (r) => (r.cls && list ? rowById(r.cls) : classOfInv(invById.get(r.investorId)));
    subs.forEach((r) => {
      if (r.status === 'pending' || onPosition.has(r.id)) return;
      const x = entry(rowOfReq(r), r.investorId);
      x.accepted = true;
      x.commit += centsOf(r);
    });
    // The basis: capital balances only when every holder is on the books with a balance above 0.
    const all = Array.from(entries.values());
    let cap = null;
    if (opts.capital !== false && all.length && all.every((x) => x.onBooks && !x.accepted)) {
      const c = capitalAt(ws, o, all.map((x) => x.investorId));
      if (c && all.every((x) => c.cents.get(x.investorId) > 0)) cap = c;
    }
    // The commitments figures, kept for the if-accepted lines whatever the basis.
    const comm = new Map(rows.map((r) => [r, { total: 0, bpi: 0, left: 0 }]));
    all.forEach((x) => {
      const raw = shareRaw(x.investorId);
      const share = raw == null ? 0 : raw;
      const marked = marks.has(x.investorId);
      const own = ownCtrl(x.investorId);
      const controlling = marked || own;
      const left = controlling && share === 0;
      const cents = cap ? cap.cents.get(x.investorId) : x.commit;
      const k = comm.get(x.row);
      k.total += x.commit;
      k.bpi += x.commit * share;
      if (left) k.left += x.commit;
      x.row.total += cents;
      x.row.bpiValue += cents * share;
      if (left) x.row.disregarded += cents;
      if (raw == null) x.row.unanswered.push(x.investorId);
      x.row.holders.push({ investorId: x.investorId, cents, share, answered: raw != null, controlling, marked, own });
    });
    const pctOf = (bpi, base) => (base > 0 ? Math.round((bpi * 100 * 1e6) / base) / 1e6 : 0);
    rows.forEach((row) => {
      row.basis = cap ? 'capital' : 'commitments';
      row.asOf = cap ? cap.end : '';
      row.pct = pctOf(row.bpiValue, row.total - row.disregarded);
    });
    subs.forEach((r) => {
      if (r.status !== 'pending') return;
      const row = rowOfReq(r);
      const k = comm.get(row);
      const e = erisaOf(r);
      const own = bpiShare(e);
      const share = own == null ? shareOf(r.investorId) : own;
      const ctrl = marks.has(r.investorId) || (e && typeof e.controlling === 'boolean' ? e.controlling : ownCtrl(r.investorId));
      const cents = centsOf(r);
      const left = ctrl && share === 0;
      row.ifAccepted.push({ requestId: r.id, investorId: r.investorId, cents, pct: pctOf(k.bpi + cents * share, k.total - k.left + (left ? 0 : cents)) });
    });
    return rows;
  }

  NS.eligibility = { regime, LIMIT_506B, BASES, qualOf, nonAccredited, place, flags, usd, RA_NOT_ATTESTED, regAStatus, BPI_LIMIT, planPct, bpiShare, pctText, controllingMarks, erisa };
})(window.CVPortal);
