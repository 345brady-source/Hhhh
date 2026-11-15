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
   * Under every exemption, a pending request that would bring benefit plan investors to 25 percent or more of its class.
   */
  function flags(ws, r) {
    if (!r || r.type !== 'subscription' || r.status === 'rejected') return [];
    const off = ((ws && ws.offerings) || []).find((x) => x && x.id === r.offeringId);
    return exemptionFlags(ws, r, off).concat(bpiFlags(ws, r, off));
  }
  function exemptionFlags(ws, r, off) {
    // Regulation A Tier 2: every subscription of an investor whose total in the offering is above their limit, as worked
    // out again from their figures (regAStatus), whatever the device said.
    if (off && regime(off) === 'regA2') {
      const row = regAStatus(ws, off).rows.find((x) => x.investorId === r.investorId);
      return row && row.over ? [`Over the Regulation A Tier 2 limit: ${usd(row.totalCents)} committed in this offering, limit ${usd(row.limitCents)}`] : [];
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
    for (const row of erisa(ws, off)) {
      const f = row.ifAccepted.find((x) => x.requestId === r.id);
      if (f && f.pct >= BPI_LIMIT) return [`If accepted, benefit plan investors would hold ${pctText(f.pct)}% of ${row.name} (25 percent or more)`];
    }
    return [];
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
   * The share of each class of an offering held by benefit plan investors (D-01), for the sponsor only (T-06-09). Value
   * is what each holder has committed or subscribed (a position's commitment, or its amount where it has none: the rule
   * NS.ops.commitOf applies; fully redeemed positions left out), plus subscriptions accepted but not yet on a position.
   * A holder's share comes from their latest answers on a subscription to the offering, else from their investor record,
   * else 0 (not answered). A holder is controlling when the sponsor marked it (offering.erisaControlling) or its own latest
   * answer says it has control over the offering's assets or gives paid advice about them: the value of a controlling
   * holder that is not a benefit plan investor (share 0) is left out of the class total (disregarded); a controlling
   * benefit plan investor is counted. An offering without classes has one, "All interests". For each pending
   * subscription: the class's percentage were it accepted at its amount and its own answers. Rows: { classId, name,
   * total, bpiValue, disregarded (all in cents), pct, holders: [{ investorId, cents, share, controlling, marked, own }],
   * ifAccepted: [{ requestId, investorId, cents, pct }] }.
   */
  function erisa(ws, o) {
    if (!ws || !o) return [];
    const list = Array.isArray(o.classes) && o.classes.length ? o.classes : null;
    const rows = (list || [{ id: '', name: 'All interests' }]).map((c) => ({ classId: c.id, name: c.name || c.id || 'All interests', total: 0, bpiValue: 0, disregarded: 0, pct: 0, holders: [], ifAccepted: [] }));
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
    const shareOf = (id) => {
      if (answered.has(id)) return answered.get(id);
      const s = bpiShare((invById.get(id) || {}).erisa);
      return s == null ? 0 : s;
    };
    const marks = controllingMarks(o);
    const ownCtrl = (id) => (saidCtrl.has(id) ? saidCtrl.get(id) : !!((invById.get(id) || {}).erisa && invById.get(id).erisa.controlling === true));
    // One entry per holder and class; the figures are added up once every holding is in.
    const entries = new Map();
    const entry = (row, id) => {
      const k = row.classId + '|' + id;
      if (!entries.has(k)) entries.set(k, { row, investorId: id, cents: 0 });
      return entries.get(k);
    };
    const onPosition = new Set();
    invById.forEach((inv) => {
      const ps = (inv.positions || []).filter((p) => p && p.offeringId === o.id && !p.redeemed);
      if (!ps.length) return;
      ps.forEach((p) => p.ref && onPosition.add(p.ref));
      entry(classOfInv(inv), inv.id).cents += ps.reduce((a, p) => a + Math.round((Number(p.commitment != null ? p.commitment : p.amount) || 0) * 100), 0);
    });
    const centsOf = (r) => Math.max(0, Math.round(Number(r.cents)) || 0);
    const rowOfReq = (r) => (r.cls && list ? rowById(r.cls) : classOfInv(invById.get(r.investorId)));
    subs.forEach((r) => {
      if (r.status === 'pending' || onPosition.has(r.id)) return;
      entry(rowOfReq(r), r.investorId).cents += centsOf(r);
    });
    entries.forEach((x) => {
      const share = shareOf(x.investorId);
      const marked = marks.has(x.investorId);
      const own = ownCtrl(x.investorId);
      const controlling = marked || own;
      x.row.total += x.cents;
      x.row.bpiValue += x.cents * share;
      if (controlling && share === 0) x.row.disregarded += x.cents;
      x.row.holders.push({ investorId: x.investorId, cents: x.cents, share, controlling, marked, own });
    });
    const pctOf = (bpi, base) => (base > 0 ? Math.round((bpi * 100 * 1e6) / base) / 1e6 : 0);
    rows.forEach((row) => (row.pct = pctOf(row.bpiValue, row.total - row.disregarded)));
    subs.forEach((r) => {
      if (r.status !== 'pending') return;
      const row = rowOfReq(r);
      const e = erisaOf(r);
      const own = bpiShare(e);
      const share = own == null ? shareOf(r.investorId) : own;
      const ctrl = marks.has(r.investorId) || (e && typeof e.controlling === 'boolean' ? e.controlling : ownCtrl(r.investorId));
      const cents = centsOf(r);
      const left = ctrl && share === 0;
      row.ifAccepted.push({ requestId: r.id, investorId: r.investorId, cents, pct: pctOf(row.bpiValue + cents * share, row.total - row.disregarded + (left ? 0 : cents)) });
    });
    return rows;
  }

  NS.eligibility = { regime, LIMIT_506B, BASES, qualOf, nonAccredited, place, flags, figure, regALimitCents, usd, committedCents, regAStatus, BPI_LIMIT, planPct, bpiShare, pctText, controllingMarks, erisa };
})(window.CVPortal);
