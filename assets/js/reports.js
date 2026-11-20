/*
 * Investor reports: the report model (phase 12, plan 12-02).
 *
 * A report template (stored in ws.reports.templates; starters live in code) is turned, for one period and one recipient,
 * into one layout model: every figure carried twice, as whole cents (v) and as the one formatted string (s) the preview
 * and the PDF both draw. Pure functions over the workspace and the figures object D (default NS.reportsData, plan
 * 12-01; every D call takes ws first). No HTML is stored or produced: wording is the block model only.
 *
 * Nothing here writes to the workspace except ensure, startFrom, save, remove and setSplit (each logged).
 */
(function () {
  'use strict';
  const NS = (window.CVPortal = window.CVPortal || {});

  /* ---------- Catalogue ---------- */
  const TYPES = ['statement', 'distribution', 'quarterly', 'annual', 'performance', 'tax'];
  const FUND_TYPES = ['realestate', 'credit', 'pe', 'vc', 'spv', 'realassets', 'open', 'any'];
  const ALL = TYPES;
  const CAPITAL_TYPES = ['statement', 'quarterly', 'annual'];
  const FUND_LEVEL_TYPES = ['quarterly', 'annual', 'performance'];
  const entry = (key, label, level, types, opts) => Object.freeze({ key, label, level, types: Object.freeze(types.slice()), opts: Object.freeze(opts || {}) });
  // level: text = wording, investor = the recipient's own rows, fund = fund-level, cover = the cover page
  const CATALOGUE = Object.freeze([
    entry('cover', 'Cover', 'cover', ALL),
    entry('letter', 'Letter', 'text', ALL),
    entry('summary', 'Summary', 'investor', CAPITAL_TYPES),
    entry('capital', 'Capital account', 'investor', CAPITAL_TYPES, { second: 'ytd' }),
    entry('commitment', 'Commitment', 'investor', CAPITAL_TYPES, { activity: false }),
    entry('distributions', 'Distributions', 'investor', CAPITAL_TYPES),
    entry('notice', 'Distribution details', 'investor', ['distribution']),
    entry('performance', 'Performance', 'fund', ['quarterly', 'annual', 'performance', 'statement']),
    entry('holdings', 'Holdings', 'fund', FUND_LEVEL_TYPES),
    entry('assets', 'Asset updates', 'fund', FUND_LEVEL_TYPES, { items: [] }),
    entry('fees', 'Fees and expenses', 'fund', FUND_LEVEL_TYPES),
    entry('statements', 'Financial statements', 'fund', ['annual']),
    entry('chart', 'Chart', 'fund', ['quarterly', 'annual', 'statement', 'performance']),
    entry('outlook', 'Outlook', 'text', ['quarterly', 'annual']),
    entry('taxsummary', 'Tax summary', 'investor', ['tax']),
    entry('taxdocs', 'Tax documents', 'investor', ['tax'], { expected: '' }),
    entry('disclosures', 'Disclosures', 'text', ALL)
  ]);
  const CAT = {};
  CATALOGUE.forEach((c) => (CAT[c.key] = c));
  const TITLES = {
    statement: 'Capital account statement',
    distribution: 'Distribution notice',
    quarterly: 'Quarterly report',
    annual: 'Annual review',
    performance: 'Performance and holdings',
    tax: 'Tax-season summary'
  };

  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const str = (v, max) => {
    let s = String(v == null ? '' : v)
      .replace(/[\t\n\r]+/g, ' ')
      .replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g, '')
      .trim();
    if (max && s.length > max) s = s.slice(0, max).replace(/[\uD800-\uDBFF]$/, '');
    return s;
  };

  /* ---------- Formats (done once, here) ---------- */
  const MINUS = '−';
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
  };
  const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const isMonthEnd = (iso) => {
    const p = parts(iso);
    return !!p && p.d === lastDay(p.y, p.m);
  };
  function fmtDate(iso) {
    const p = parts(iso);
    return p ? `${MONTH_NAMES[p.m - 1]} ${p.d}, ${p.y}` : '';
  }
  const signed = (neg, s) => (neg ? MINUS : '') + s;
  const fmt = {
    /** Whole cents in the currency (minus sign U+2212). */
    money(cents, cur) {
      return NS.structures.fmt(cents === 0 ? 0 : cents, cur);
    },
    /** Ownership and shares: two decimals, '66.67%'. */
    own(x) {
      if (x == null || !Number.isFinite(x)) return '—';
      const r = Math.round(x * 10000) / 100;
      return signed(r < 0, Math.abs(r).toFixed(2) + '%');
    },
    /** Returns and IRR: one decimal, '12.3%'; none (Pitfall 9) 'Not meaningful yet'. */
    ret(x) {
      if (x == null || !Number.isFinite(x)) return 'Not meaningful yet';
      const r = Math.round(x * 1000) / 10;
      return signed(r < 0, Math.abs(r).toFixed(1) + '%');
    },
    /** Multiples: two decimals with x, '1.17x'; none '—'. */
    mult(x) {
      if (x == null || !Number.isFinite(x)) return '—';
      const r = Math.round(x * 100) / 100;
      return signed(r < 0, Math.abs(r).toFixed(2) + 'x');
    },
    date: fmtDate,
    month(key) {
      const p = parts(String(key || '') + '-01');
      return p ? `${MONTH_SHORT[p.m - 1]} ${p.y}` : String(key || '');
    }
  };

  /**
   * The words for a period: { text, short, months }. A calendar quarter 'Quarter ended December 31, 2026' / 'Q4 2026';
   * a calendar year 'Year ended December 31, 2026' / '2026'; six months ending June 30 or December 31
   * 'Six months ended June 30, 2026' / 'H1 2026'; otherwise 'October 1, 2026 to November 30, 2026' / 'This period'.
   */
  function periodLabel(from, to) {
    const f = parts(from);
    const t = parts(to);
    if (!f || !t) return { text: '', short: 'This period', months: 0 };
    const months = (t.y - f.y) * 12 + (t.m - f.m) + 1;
    if (f.d === 1 && isMonthEnd(to) && f.y === t.y) {
      if (months === 3 && (f.m - 1) % 3 === 0) return { text: `Quarter ended ${fmtDate(to)}`, short: `Q${(f.m + 2) / 3} ${t.y}`, months };
      if (months === 12 && f.m === 1) return { text: `Year ended ${fmtDate(to)}`, short: String(t.y), months };
      if (months === 6 && (f.m === 1 || f.m === 7)) return { text: `Six months ended ${fmtDate(to)}`, short: `H${f.m === 1 ? 1 : 2} ${t.y}`, months };
    }
    return { text: `${fmtDate(from)} to ${fmtDate(to)}`, short: 'This period', months };
  }

  /* ---------- Storage ---------- */
  /** ws.reports = { v: 1, templates: [], runs: [], splits: {} }: created, or only missing keys filled. */
  function ensure(ws) {
    if (!ws.reports || typeof ws.reports !== 'object') ws.reports = {};
    const r = ws.reports;
    if (r.v == null) r.v = 1;
    if (!Array.isArray(r.templates)) r.templates = [];
    if (!Array.isArray(r.runs)) r.runs = [];
    if (!r.splits || typeof r.splits !== 'object') r.splits = {};
    return r;
  }

  function defaultOpts(key) {
    return clone(CAT[key] ? CAT[key].opts : {});
  }
  /** Every catalogue section of the type, in catalogue order, on, with empty wording; disclosures = the tenant's disclaimer. */
  function blank(type, ws) {
    if (TYPES.indexOf(type) < 0) type = 'statement';
    const disclaimer = str(ws && ws.tenant && ws.tenant.disclaimer, 5000);
    return {
      id: '',
      name: TITLES[type],
      title: '',
      type,
      fundType: 'any',
      starter: '',
      scope: { firm: true },
      cover: { style: 'band', accent: '', photoId: '' },
      chart: 'none',
      sections: CATALOGUE.filter((c) => c.types.indexOf(type) >= 0).map((c) => ({ key: c.key, on: true, opts: defaultOpts(c.key), text: [] })),
      disclosures: disclaimer ? [{ t: 'p', runs: [{ s: disclaimer, b: false, i: false }] }] : [],
      version: 0,
      updatedAt: '',
      updatedBy: ''
    };
  }

  /* ---------- Recipients ---------- */
  const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const offering = (ws, id) => (ws.offerings || []).find((o) => o.id === id) || null;
  const snapped = (spec) => (NS.audit && NS.audit.snap ? NS.audit.snap(spec.from, spec.to) : { from: spec.from, to: spec.to });

  /** The investor ids a report goes to (a letter to everyone without statements: [null]). */
  function recipients(ws, template, spec, D) {
    D = D || NS.reportsData;
    spec = spec || {};
    const type = template && TYPES.indexOf(template.type) >= 0 ? template.type : 'statement';
    const aud = spec.audience || {};
    const only = (ids) => (aud.kind === 'investor' && aud.investorId ? ids.filter((id) => id === aud.investorId) : ids);
    if (type === 'distribution') {
      return only((ws.investors || []).map((i) => i.id).filter((id) => !!D.distribution(ws, spec.runId, id))).sort(byId);
    }
    if (type === 'tax') {
      const y = Number(spec.year);
      return only(
        (ws.investors || [])
          .map((i) => i.id)
          .filter((id) => {
            const T = D.taxYear(ws, id, y);
            return (T && T.funds.some((f) => (f.runs || []).length)) || D.taxDocs(ws, id, y).length > 0;
          })
      ).sort(byId);
    }
    const to = snapped(spec).to;
    const union = (oids) => {
      const set = new Set();
      oids.forEach((oid) => D.holders(ws, oid, to).forEach((i) => set.add(i.id)));
      return Array.from(set).sort(byId);
    };
    if (aud.kind === 'investor') return aud.investorId ? [aud.investorId] : [];
    if (aud.kind === 'fund') return union([aud.offeringId]);
    if (aud.kind === 'all') return union((ws.offerings || []).map((o) => o.id));
    if (aud.kind === 'letter') return aud.statements ? union(aud.offeringIds || []) : [null];
    return [];
  }

  /* ---------- Model pieces ---------- */
  const z = (n) => (n === 0 ? 0 : n); // no negative zero
  function whole(c, where) {
    if (!Number.isSafeInteger(c)) throw new Error(`${where}: money must be whole cents, got ${c}`);
    return z(c);
  }
  const col = (h, t) => ({ h, t: t || 'text' });
  const txt = (s) => ({ v: s == null ? '' : String(s), s: s == null ? '' : String(s) });
  const money = (c, cur, where) => {
    const v = whole(c, where || 'money');
    return { v, s: fmt.money(v, cur) };
  };
  const table = (title, currency, cols, rows, total) => ({ k: 'table', title, currency: currency || '', cols, rows, total: total || null });
  const note = (text) => ({ k: 'note', text });
  /** Template wording blocks as model blocks. */
  function toModel(blocks) {
    const out = [];
    (blocks || []).forEach((b) => {
      if (b.t === 'p') out.push({ k: 'p', runs: clone(b.runs) });
      else if (b.t === 'h') out.push({ k: 'h2', text: b.runs.map((r) => r.s).join('') });
      else if (b.t === 'ul') out.push({ k: 'ul', items: clone(b.items) });
    });
    return out;
  }

  /* ---------- Sections ---------- */
  // Each renderer: (X, section, fund) → pushes blocks onto X.B. X is the resolve context.
  const FUND_SECTIONS = {
    capital(X, sec, o) {
      const s = X.st[o.id];
      if (!s) return;
      const itd = sec.opts && sec.opts.second === 'itd';
      const a = s.period;
      const b = itd ? s.itd : s.ytd;
      const cur = s.currency;
      const lines = [
        ['Beginning capital', (x) => x.begin],
        [s.open ? 'Subscriptions' : 'Contributions', (x) => x.contrib],
        [s.open ? 'Distributions and redemptions' : 'Distributions', (x) => -x.dist],
        ['Investment income, net of fund expenses', (x) => x.income],
        ['Realized and unrealized gain (loss)', (x) => x.gain],
        ['Management fees', (x) => -x.fee],
        [s.open ? 'Incentive allocation' : 'Carried interest', (x) => -x.carry]
      ];
      X.B.push(
        table(
          'Your capital account',
          cur,
          [col('Line item'), col(X.label.short, 'money'), col(itd ? 'Since inception' : 'Year to date', 'money')],
          lines.map(([label, f]) => [txt(label), money(f(a), cur, label), money(f(b), cur, label)]),
          [txt('Ending capital'), money(a.end, cur, 'Ending capital'), money(b.end, cur, 'Ending capital')]
        )
      );
      X.B.push(note('Book capital, not tax capital.'));
      if (s.preliminary) X.B.push(note('Preliminary: the books are not closed for this period.'));
    }
  };
  const TOP_SECTIONS = {
    disclosures(X) {
      const blocks = toModel(X.t.disclosures);
      if (!blocks.length) return;
      X.B.push({ k: 'h2', text: 'Disclosures' });
      blocks.forEach((b) => X.B.push(b));
    }
  };

  /* ---------- Resolve ---------- */
  /**
   * One layout model for one recipient: { model, errors }. model is null while any error stands.
   * spec = { from, to } | { runId } | { year }, plus { audience, when }.
   */
  function resolve(ws, template, spec, recipientId, D) {
    D = D || NS.reportsData;
    if (!D) throw new Error('The report figures are not loaded');
    spec = spec || {};
    const t = clone(template);
    const type = TYPES.indexOf(t.type) >= 0 ? t.type : 'statement';
    const errors = [];
    const rid = recipientId || null;
    const aud = spec.audience || (rid ? { kind: 'investor', investorId: rid } : { kind: 'letter', offeringIds: [] });
    const firm = D.firm(ws) || {};
    const inv = rid ? D.investor(ws, rid) : null;

    let from;
    let to;
    let label;
    let funds = [];
    const st = {};
    const p = snapped(spec);
    from = p.from;
    to = p.to;
    label = periodLabel(from, to);
    if (aud.kind === 'investor' && aud.offeringId) funds = [offering(ws, aud.offeringId)];
    else if ((aud.kind === 'investor' || aud.kind === 'all') && rid) funds = D.fundsOf(ws, rid);
    else if (aud.kind === 'fund') funds = [offering(ws, aud.offeringId)];
    else if (aud.kind === 'letter') funds = (aud.offeringIds || []).map((id) => offering(ws, id));
    funds = funds.filter(Boolean);
    if (rid) funds.forEach((o) => (st[o.id] = D.statement(ws, rid, o.id, from, to)));
    const multi = funds.length > 1;

    let title = TITLES[type];
    if (type === 'statement' && multi) title = 'Consolidated statement';
    if (t.title) title = t.title;
    const subtitle = label.text;
    const author = firm.legalName || firm.name || '';
    const colors = firm.colors || {};
    const hex = (h) => (NS.brand && NS.brand.normHex ? NS.brand.normHex(h) : /^#[0-9A-F]{6}$/i.test(h || '') ? String(h).toUpperCase() : null);
    const accent = hex(t.cover && t.cover.accent) || hex(colors.accent) || hex(colors.primary) || '#1F2937';
    const sections = (t.sections || []).filter((s) => s.on && CAT[s.key] && CAT[s.key].types.indexOf(type) >= 0);
    const coverOn = sections.some((s) => s.key === 'cover');
    const fundLine = multi ? (aud.kind === 'letter' ? funds.map((o) => o.name).join(', ') : 'All investments') : funds[0] ? funds[0].name : '';

    const X = { ws, D, t, type, rid, inv, from, to, label, funds, st, multi, firm, errors, B: [] };
    const fundKeys = sections.filter((s) => FUND_SECTIONS[s.key]);
    let fundsDone = false;
    sections.forEach((s) => {
      if (FUND_SECTIONS[s.key]) {
        if (!multi) {
          if (funds[0]) FUND_SECTIONS[s.key](X, s, funds[0]);
          return;
        }
        if (fundsDone) return;
        fundsDone = true;
        funds.forEach((o) => {
          X.B.push({ k: 'break' });
          X.B.push({ k: 'h1', text: o.name });
          fundKeys.forEach((fs) => FUND_SECTIONS[fs.key](X, fs, o));
        });
        return;
      }
      if (TOP_SECTIONS[s.key]) TOP_SECTIONS[s.key](X, s);
    });

    if (errors.length) return { model: null, errors };
    const model = {
      v: 1,
      kind: type,
      title,
      subtitle,
      period: { from, to },
      recipient: inv ? { id: inv.id, name: inv.title } : null,
      firm: {
        name: firm.name || '',
        legalName: firm.legalName || '',
        colors: { primary: hex(colors.primary) || '', accent: hex(colors.accent) || '' },
        logo: firm.logo || '',
        support: { team: (firm.support && firm.support.team) || '', email: (firm.support && firm.support.email) || '', phone: (firm.support && firm.support.phone) || '' }
      },
      cover: {
        on: coverOn,
        style: (t.cover && t.cover.style) || 'band',
        accent,
        photoId: (t.cover && t.cover.photoId) || '',
        lines: [title, subtitle, fundLine, inv ? `Prepared for ${inv.title}` : '', firm.name || ''].filter(Boolean)
      },
      footer: author ? `${author} - Confidential` : 'Confidential',
      meta: { title: `${title} - ${subtitle}`, author },
      when: spec.when || '',
      blocks: X.B
    };
    return { model, errors };
  }

  NS.reports = {
    CATALOGUE,
    TYPES: Object.freeze(TYPES.slice()),
    FUND_TYPES: Object.freeze(FUND_TYPES.slice()),
    fmt,
    periodLabel,
    ensure,
    blank,
    recipients,
    resolve
  };
})();
