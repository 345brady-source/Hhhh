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

  const MERGE_FIELDS = Object.freeze(['first_name', 'account_name', 'investment', 'firm', 'team', 'phone', 'period', 'period_end', 'ending_capital', 'distributions_period', 'commitment', 'unfunded']);
  // fields that fill from the recipient's own figures, and those that exist only for a closed fund
  const INVESTOR_FIELDS = { first_name: 1, account_name: 1, ending_capital: 1, distributions_period: 1, commitment: 1, unfunded: 1 };
  const CLOSED_FIELDS = { commitment: 1, unfunded: 1 };
  const SPLIT_LABELS = Object.freeze(['Return of capital', 'Income', 'Interest', 'Capital gain', 'Other']);
  const CHARTS = ['none', 'dist', 'capital', 'allocation'];
  const COVER_STYLES = ['band', 'plain', 'photo'];
  const MAX_BLOCKS = 60;
  const MAX_CHARS = 5000;
  const MAX_PHOTOS = 12;

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

  /* ---------- Rich text (the block model; never HTML) ---------- */
  const CTRL = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g;
  /** Runs { s, b, i } only: control characters stripped, adjacent runs of the same style joined, at most `max` characters. */
  function cleanRuns(list, max) {
    const out = [];
    let left = max;
    (Array.isArray(list) ? list : []).forEach((r) => {
      if (!r || typeof r !== 'object' || left <= 0) return;
      let s = String(r.s == null ? '' : r.s)
        .replace(/[\t\n\r]+/g, ' ')
        .replace(CTRL, '');
      if (!s) return;
      if (s.length > left) s = s.slice(0, left).replace(/[\uD800-\uDBFF]$/, '');
      left -= s.length;
      const b = r.b === true;
      const i = r.i === true;
      const last = out[out.length - 1];
      if (last && last.b === b && last.i === i) last.s += s;
      else out.push({ s, b, i });
    });
    return out;
  }
  const runsText = (runs) => runs.map((r) => r.s).join('');
  /** Blocks [{ t: 'p' | 'h', runs }, { t: 'ul', items: [runs] }]: anything else dropped; at most 60 blocks, 5,000 characters each. */
  function sanitize(blocks) {
    const out = [];
    (Array.isArray(blocks) ? blocks : []).forEach((bk) => {
      if (out.length >= MAX_BLOCKS || !bk || typeof bk !== 'object') return;
      if (bk.t === 'p' || bk.t === 'h') {
        const runs = cleanRuns(bk.runs, MAX_CHARS);
        if (runsText(runs).trim()) out.push({ t: bk.t, runs });
      } else if (bk.t === 'ul') {
        let left = MAX_CHARS;
        const items = [];
        (Array.isArray(bk.items) ? bk.items : []).forEach((it) => {
          const runs = cleanRuns(it, left);
          if (runsText(runs).trim()) {
            items.push(runs);
            left -= runsText(runs).length;
          }
        });
        if (items.length) out.push({ t: 'ul', items });
      }
    });
    return out;
  }
  /**
   * The editor's plain tree [{ tag, children } | { text }] as blocks: p and div → p; h1-h6 → h; ul and ol with li → ul;
   * b and strong → bold; i and em → italic; br ends the paragraph; script and style dropped with their contents; any
   * other tag keeps only its text. Attributes are never read.
   */
  function fromTree(tree) {
    const out = [];
    let cur = null;
    let list = null;
    let item = null;
    const close = () => {
      if (cur && cur.runs.length) out.push(cur);
      cur = null;
    };
    const closeItem = () => {
      if (list && item && item.length) list.items.push(item);
      item = null;
    };
    const text = (s, st) => {
      if (!s) return;
      const r = { s: String(s), b: !!st.b, i: !!st.i };
      if (list) {
        if (!item) item = [];
        item.push(r);
        return;
      }
      if (!cur) cur = { t: 'p', runs: [] };
      cur.runs.push(r);
    };
    function walk(nodes, st) {
      (Array.isArray(nodes) ? nodes : []).forEach((n) => {
        if (!n || typeof n !== 'object') return;
        if (n.tag == null) {
          if (typeof n.text === 'string') text(n.text, st);
          return;
        }
        const tag = String(n.tag).toLowerCase();
        if (tag === 'script' || tag === 'style') return;
        if (tag === 'br') {
          if (list) text(' ', st);
          else close();
          return;
        }
        if (tag === 'b' || tag === 'strong') return walk(n.children, { b: true, i: st.i });
        if (tag === 'i' || tag === 'em') return walk(n.children, { b: st.b, i: true });
        if (list) {
          if (tag === 'li') {
            closeItem();
            item = [];
            walk(n.children, st);
            closeItem();
            return;
          }
          return walk(n.children, st);
        }
        if (tag === 'p' || tag === 'div' || /^h[1-6]$/.test(tag)) {
          close();
          cur = { t: tag.charAt(0) === 'h' ? 'h' : 'p', runs: [] };
          walk(n.children, st);
          close();
          return;
        }
        if (tag === 'ul' || tag === 'ol') {
          close();
          list = { t: 'ul', items: [] };
          walk(n.children, st);
          closeItem();
          if (list.items.length) out.push(list);
          list = null;
          return;
        }
        walk(n.children, st);
      });
    }
    walk(tree, { b: false, i: false });
    close();
    return sanitize(out);
  }
  /** The text of blocks, one line per paragraph, heading or list item. */
  function plain(blocks) {
    const lines = [];
    sanitize(blocks).forEach((b) => {
      if (b.t === 'ul') b.items.forEach((it) => lines.push(runsText(it)));
      else lines.push(runsText(b.runs));
    });
    return lines.join('\n');
  }
  const eachRun = (blocks, f) =>
    (Array.isArray(blocks) ? blocks : []).forEach((b) => {
      if (!b) return;
      if (Array.isArray(b.runs)) b.runs.forEach(f);
      if (Array.isArray(b.items)) b.items.forEach((it) => (Array.isArray(it) ? it.forEach(f) : null));
    });
  const FIELD_RE = /\{([a-z_]+)\}/g;
  /** The merge field names used in blocks, in order of first use. A field is { + [a-z_]+ + }; anything else is text. */
  function fields(blocks) {
    const seen = [];
    eachRun(blocks, (r) =>
      String((r && r.s) || '').replace(FIELD_RE, (m, k) => {
        if (seen.indexOf(k) < 0) seen.push(k);
        return m;
      })
    );
    return seen;
  }
  /** Blocks with every field that has a value filled; a field without one is left as typed. */
  function fill(blocks, values) {
    const v = values || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(v, k) && v[k] != null;
    const out = clone(Array.isArray(blocks) ? blocks : []);
    eachRun(out, (r) => {
      if (r && typeof r.s === 'string') r.s = r.s.replace(FIELD_RE, (m, k) => (has(k) ? String(v[k]) : m));
    });
    return out;
  }

  /* ---------- Templates ---------- */
  const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  function cleanScope(sc) {
    const ids = sc && Array.isArray(sc.offeringIds) ? Array.from(new Set(sc.offeringIds.map((x) => str(x, 80)).filter(Boolean))) : [];
    return ids.length && !(sc && sc.firm === true) ? { offeringIds: ids } : { firm: true };
  }
  function cleanOpts(key, o, photos) {
    o = o && typeof o === 'object' ? o : {};
    if (key === 'capital') return { second: o.second === 'itd' ? 'itd' : 'ytd' };
    if (key === 'commitment') return { activity: o.activity === true };
    if (key === 'taxdocs') return { expected: str(o.expected, 200) };
    if (key === 'assets') {
      const items = (Array.isArray(o.items) ? o.items : [])
        .slice(0, 50)
        .map((it) => {
          it = it && typeof it === 'object' ? it : {};
          const keep = [];
          (Array.isArray(it.photoIds) ? it.photoIds : [])
            .map((x) => str(x, 80))
            .filter(Boolean)
            .forEach((id) => {
              if (photos.n < MAX_PHOTOS) {
                keep.push(id);
                photos.n++;
              }
            });
          return {
            holdingId: str(it.holdingId, 80),
            photoIds: keep,
            text: sanitize(it.text),
            figures: (Array.isArray(it.figures) ? it.figures : [])
              .slice(0, 20)
              .map((f) => ({ label: str(f && f.label, 80), value: str(f && f.value, 80) }))
              .filter((f) => f.label || f.value)
          };
        })
        .filter((it) => it.holdingId);
      return { items };
    }
    return {};
  }
  /**
   * A template as it may be stored: unknown keys and sections dropped, duplicates removed, missing catalogue sections of
   * the type appended off, cover first, disclosures last and on, wording sanitized, accent '#RRGGBB' or '', chart in the
   * list, name at most 80 characters.
   */
  function normalise(template) {
    const x = template && typeof template === 'object' ? template : {};
    const type = TYPES.indexOf(x.type) >= 0 ? x.type : 'statement';
    const keys = CATALOGUE.filter((c) => c.types.indexOf(type) >= 0).map((c) => c.key);
    const seen = {};
    const photos = { n: 0 };
    let secs = [];
    (Array.isArray(x.sections) ? x.sections : []).forEach((sec) => {
      if (!sec || keys.indexOf(sec.key) < 0 || seen[sec.key]) return;
      seen[sec.key] = 1;
      secs.push({ key: sec.key, on: sec.on === true, opts: cleanOpts(sec.key, sec.opts, photos), text: sanitize(sec.text) });
    });
    keys.filter((k) => !seen[k]).forEach((k) => secs.push({ key: k, on: false, opts: cleanOpts(k, defaultOpts(k), photos), text: [] }));
    const cover = secs.filter((sec) => sec.key === 'cover');
    const disc = secs.filter((sec) => sec.key === 'disclosures');
    secs = cover.concat(
      secs.filter((sec) => sec.key !== 'cover' && sec.key !== 'disclosures'),
      disc
    );
    disc.forEach((sec) => (sec.on = true));
    const cv = x.cover && typeof x.cover === 'object' ? x.cover : {};
    const hex = NS.brand && NS.brand.normHex ? NS.brand.normHex(cv.accent) : null;
    return {
      id: str(x.id, 40),
      name: str(x.name, 80) || TITLES[type],
      title: str(x.title, 120),
      type,
      fundType: FUND_TYPES.indexOf(x.fundType) >= 0 ? x.fundType : 'any',
      starter: str(x.starter, 60),
      scope: cleanScope(x.scope),
      cover: { style: COVER_STYLES.indexOf(cv.style) >= 0 ? cv.style : 'band', accent: hex || '', photoId: str(cv.photoId, 80) },
      chart: CHARTS.indexOf(x.chart) >= 0 ? x.chart : 'none',
      sections: secs,
      disclosures: sanitize(x.disclosures),
      version: Number.isSafeInteger(x.version) && x.version > 0 ? x.version : 0,
      updatedAt: str(x.updatedAt, 40),
      updatedBy: str(x.updatedBy, 200)
    };
  }
  /** Moves a section one place up (-1) or down (+1); the cover stays first and the disclosures last. */
  function move(template, key, dir) {
    const s = (template && template.sections) || [];
    const i = s.findIndex((x) => x.key === key);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || key === 'cover' || key === 'disclosures' || j < 0 || j >= s.length) return template;
    if (s[j].key === 'cover' || s[j].key === 'disclosures') return template;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
    return template;
  }
  const REG = [];
  /** Registers a starter (plan 12-05): { id, name, type, fundType, blurb, template: partial template }. */
  function addStarter(spec) {
    if (!spec || !str(spec.id, 60) || TYPES.indexOf(spec.type) < 0 || TYPES.indexOf(spec.id) >= 0) throw new Error('A starter needs its own id and a report type');
    const s = { id: str(spec.id, 60), name: str(spec.name, 80) || TITLES[spec.type], type: spec.type, fundType: FUND_TYPES.indexOf(spec.fundType) >= 0 ? spec.fundType : 'any', blurb: str(spec.blurb, 200), template: clone(spec.template || {}) };
    const i = REG.findIndex((x) => x.id === s.id);
    if (i >= 0) REG[i] = s;
    else REG.push(s);
    return clone(s);
  }
  /** The starters for a type (or all types): the blank one first, always, then those registered. */
  function starters(type) {
    const out = [];
    (type ? [type] : TYPES).forEach((ty) => {
      if (TYPES.indexOf(ty) < 0) return;
      out.push({ id: ty, name: 'Blank', type: ty, fundType: 'any', blurb: '', blank: true });
      REG.filter((s) => s.type === ty).forEach((s) => out.push(Object.assign(clone(s), { blank: false })));
    });
    return out;
  }
  function nextId(ws) {
    let n = 0;
    ensure(ws).templates.forEach((t) => {
      const m = /^rt-(\d+)$/.exec(t.id || '');
      if (m) n = Math.max(n, Number(m[1]));
    });
    return `rt-${n + 1}`;
  }
  function scopeText(ws, sc) {
    if (!sc || sc.firm) return 'for the whole firm';
    return 'for ' + sc.offeringIds.map((id) => (offering(ws, id) || { name: id }).name).join(', ');
  }
  function logTemplate(ws, action, t, by, at) {
    if (!NS.audit || !NS.audit.log) return;
    NS.audit.log(ws, { action, fund: t.scope && t.scope.offeringIds ? t.scope.offeringIds.join(', ') : '', record: t.id, actor: by, at, detail: `${t.name}, version ${t.version}, ${scopeText(ws, t.scope)}` });
  }
  /** A stored copy of a starter (or the blank template of a type): version 1, logged 'Report template created'. */
  function startFrom(ws, starterIdOrType, opts) {
    const o = opts || {};
    let base;
    if (TYPES.indexOf(starterIdOrType) >= 0) base = blank(starterIdOrType, ws);
    else {
      const s = REG.find((x) => x.id === starterIdOrType);
      if (!s) throw new Error('No such starter');
      base = blank(s.type, ws);
      const tp = clone(s.template);
      Object.keys(tp).forEach((k) => {
        if (k !== 'id' && k !== 'type' && k !== 'version') base[k] = tp[k];
      });
      base.starter = s.id;
      base.fundType = s.fundType;
      if (!tp.name) base.name = s.name;
    }
    if (o.name) base.name = o.name;
    if (o.scope) base.scope = o.scope;
    const t = normalise(base);
    t.id = nextId(ws);
    t.version = 1;
    t.updatedAt = o.at || nowIso();
    t.updatedBy = o.by || '';
    ensure(ws).templates.push(t);
    logTemplate(ws, 'Report template created', t, t.updatedBy, t.updatedAt);
    return clone(t);
  }
  /** Normalises and stores a template: version + 1, logged 'Report template saved' with name, version and scope. */
  function save(ws, template, opts) {
    const o = opts || {};
    const r = ensure(ws);
    const t = normalise(template);
    const i = t.id ? r.templates.findIndex((x) => x.id === t.id) : -1;
    if (i < 0) t.id = nextId(ws);
    t.version = (i >= 0 ? r.templates[i].version || 0 : 0) + 1;
    t.updatedAt = o.at || nowIso();
    t.updatedBy = o.by || '';
    if (i >= 0) r.templates[i] = t;
    else r.templates.push(t);
    logTemplate(ws, 'Report template saved', t, t.updatedBy, t.updatedAt);
    return clone(t);
  }
  /** Deletes a stored template, logged 'Report template deleted'. */
  function remove(ws, id, opts) {
    const o = opts || {};
    const r = ensure(ws);
    const i = r.templates.findIndex((x) => x.id === id);
    if (i < 0) return false;
    const t = r.templates.splice(i, 1)[0];
    logTemplate(ws, 'Report template deleted', t, o.by || '', o.at || nowIso());
    return true;
  }
  /** The firm-wide templates plus those saved for the offering. */
  function templatesFor(ws, offeringId) {
    return ensure(ws)
      .templates.filter((t) => t.scope && (t.scope.firm || (t.scope.offeringIds || []).indexOf(offeringId) >= 0))
      .map(clone);
  }

  /* ---------- Distribution split (C-06): typed by the sponsor, kept in ws.reports, never in the run ---------- */
  function runGross(ws, run) {
    const rows = NS.data && NS.data.runRows ? NS.data.runRows(ws, run) : (run.lines || []).map((l) => ({ cents: l.grossCents }));
    return rows.reduce((a, r) => a + (r.cents || 0), 0);
  }
  /** Stores the run's split: labels from SPLIT_LABELS, each a positive whole number of cents, adding to the run's gross exactly. */
  function setSplit(ws, runId, parts, opts) {
    const o = opts || {};
    const run = (ws.runs || []).find((r) => r.id === runId);
    if (!run) return { ok: false, error: 'No such distribution' };
    if (NS.data && NS.data.runPaid && !NS.data.runPaid(run)) return { ok: false, error: 'Only a paid distribution can carry a split' };
    const cur = NS.structures.curOf(offering(ws, run.offeringId));
    const list = Array.isArray(parts) ? parts : [];
    const by = o.by || '';
    const at = o.at || nowIso();
    if (!list.length) {
      if (ws.reports && ws.reports.splits && ws.reports.splits[runId]) {
        delete ensure(ws).splits[runId];
        NS.audit.log(ws, { action: 'Distribution split removed', fund: run.offeringId, record: runId, actor: by, at, detail: '' });
      }
      return { ok: true };
    }
    const seen = {};
    for (const p of list) {
      const label = String((p && p.label) || '');
      if (SPLIT_LABELS.indexOf(label) < 0) return { ok: false, error: `Not a character a notice can show: ${str(label, 80)}` };
      if (seen[label]) return { ok: false, error: `${label} is listed twice` };
      seen[label] = 1;
      if (!Number.isSafeInteger(p.cents) || p.cents <= 0) return { ok: false, error: `${label}: enter an amount above zero, to the cent` };
    }
    const gross = runGross(ws, run);
    const sum = list.reduce((a, p) => a + p.cents, 0);
    if (sum !== gross) return { ok: false, error: `Off by ${fmt.money(Math.abs(sum - gross), cur)}` };
    const clean = list.map((p) => ({ label: p.label, cents: p.cents }));
    ensure(ws).splits[runId] = { parts: clean, by, at };
    NS.audit.log(ws, { action: 'Distribution split entered', fund: run.offeringId, record: runId, actor: by, at, detail: clean.map((p) => `${p.label} ${fmt.money(p.cents, cur)}`).join(', ') });
    return { ok: true };
  }
  /** One investor's split of the run: the stored parts shared over their gross by largest remainder (sums exactly). */
  function splitFor(ws, runId, investorGross) {
    const s = ws.reports && ws.reports.splits && ws.reports.splits[runId];
    if (!s || !Array.isArray(s.parts) || !s.parts.length) return null;
    return NS.data.split(investorGross, s.parts.map((p) => ({ label: p.label, amount: p.cents }))).map((r) => ({ label: r.label, cents: r.cents }));
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
  /**
   * Typed wording for one section, merge fields checked and filled: an unknown name, an investor field with no
   * recipient, or commitment / unfunded where no covered fund is closed, is an error naming the field and the section.
   */
  function wording(X, blocks, key) {
    const label = CAT[key].label;
    fields(blocks).forEach((k) => {
      let message = '';
      if (MERGE_FIELDS.indexOf(k) < 0) message = `Unknown field {${k}} in ${label}`;
      else if (INVESTOR_FIELDS[k] && !X.rid) message = `The field {${k}} in ${label} needs an investor, and this goes to everyone without a statement`;
      else if (CLOSED_FIELDS[k] && !X.funds.some((o) => X.st[o.id] && !X.st[o.id].open)) message = `The field {${k}} in ${label} does not apply to an open-ended fund`;
      if (message) X.errors.push({ section: key, field: k, message });
    });
    return toModel(fill(blocks, X.values));
  }
  const TOP_SECTIONS = {
    letter(X, sec) {
      wording(X, sec.text, 'letter').forEach((b) => X.B.push(b));
    },
    outlook(X, sec) {
      const blocks = wording(X, sec.text, 'outlook');
      if (!blocks.length) return;
      X.B.push({ k: 'h2', text: 'Outlook' });
      blocks.forEach((b) => X.B.push(b));
    },
    disclosures(X) {
      const blocks = wording(X, X.t.disclosures, 'disclosures');
      if (!blocks.length) return;
      X.B.push({ k: 'h2', text: 'Disclosures' });
      blocks.forEach((b) => X.B.push(b));
    }
  };
  /** 'A', 'A and B', 'A, B and C'. */
  const andList = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
  /** Amounts by currency, each formatted, in first-seen order, joined with ' and '. */
  function perCurrency(list) {
    const order = [];
    const sum = {};
    list.forEach(([cur, cents]) => {
      if (!(cur in sum)) {
        sum[cur] = 0;
        order.push(cur);
      }
      sum[cur] += cents;
    });
    return order.map((c) => fmt.money(sum[c], c)).join(' and ');
  }
  /** The merge values for one model (investor fields only with a recipient; commitment and unfunded only for closed funds). */
  function mergeValues(X) {
    const sup = X.firm.support || {};
    const v = {
      investment: andList(X.funds.map((o) => o.name)),
      firm: X.firm.name || '',
      team: sup.team || '',
      phone: sup.phone || sup.email || '',
      period: X.label.text,
      period_end: fmtDate(X.to)
    };
    if (!X.inv) return v;
    v.first_name = X.inv.firstName || '';
    v.account_name = X.inv.title || '';
    const sts = X.funds.map((o) => X.st[o.id]).filter(Boolean);
    v.ending_capital = perCurrency(sts.map((s) => [s.currency, s.period.end]));
    v.distributions_period = X.dist ? fmt.money(X.dist.gross, X.dist.currency) : perCurrency(sts.map((s) => [s.currency, s.period.dist]));
    const closed = sts.filter((s) => !s.open);
    if (closed.length) {
      v.commitment = perCurrency(closed.map((s) => [s.currency, s.commit]));
      v.unfunded = perCurrency(closed.map((s) => [s.currency, s.unfunded]));
    }
    return v;
  }

  /* ---------- Resolve ---------- */
  /**
   * One layout model for one recipient: { model, errors }. model is null while any error stands.
   * spec = { from, to } | { runId } | { year }, plus { audience, when }.
   */
  function resolve(ws, template, spec, recipientId, D) {
    D = D || NS.reportsData;
    if (!D) throw new Error('The report figures are not loaded');
    spec = spec || {};
    const t = normalise(template);
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

    const X = { ws, D, t, type, rid, inv, from, to, label, funds, st, multi, firm, errors, dist: null, B: [] };
    X.values = mergeValues(X);
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
    MERGE_FIELDS,
    SPLIT_LABELS,
    fmt,
    periodLabel,
    ensure,
    blank,
    addStarter,
    starters,
    startFrom,
    save,
    remove,
    normalise,
    move,
    templatesFor,
    sanitize,
    fromTree,
    plain,
    fields,
    fill,
    recipients,
    resolve,
    setSplit,
    splitFor
  };
})();
