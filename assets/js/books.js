/*
 * Fund accounting: one double-entry journal per fund, in whole cents.
 *
 * The books live in the workspace (ws.books), so they save, load and reset with
 * everything else. Each fund (one per offering) holds a journal of entries; an
 * entry is a date, a memo, the record it comes from (src) and two or more lines
 * [account code, cents, investor id, holding id]. Cents are integers: positive is
 * a debit, negative a credit, and every entry's lines add up to exactly zero. No
 * amount is ever held as a decimal.
 *
 * A posted entry is never edited. A correction is a new entry; an entry made in
 * error is reversed by an equal and opposite entry that names it. Closing a
 * month-end stores a SHA-256 of the trial balance through that day and the person
 * who closed it; nothing dated on or before it can be posted or reversed until an
 * owner reopens it with a reason.
 *
 * Income, expense and gain accounts start again at zero each 1 January: a trial
 * balance carries earlier years' results in 3900 without any closing entry being
 * stored.
 *
 * Pure functions. Nothing here saves, writes the change log or reads the audit
 * engine. trialBalance, entries, balance, series and status only read.
 */
(function (root) {
  'use strict';
  const NS = (root.CVPortal = root.CVPortal || {});

  /* ---------- Chart of accounts ---------- */
  const TYPES = ['asset', 'liability', 'equity', 'income', 'expense', 'gain'];
  /** Account types whose balance starts again each 1 January; earlier years go to 3900. */
  const RESULT = { income: true, expense: true, gain: true };
  const CARRY = '3900';
  /** [code, name, type, suggested Form 1065 Schedule L line, real estate funds only] in code order. */
  const TEMPLATE = [
    ['1000', 'Cash', 'asset', '1'],
    ['1100', 'Investments, at cost', 'asset', '8'],
    ['1150', 'Unrealized appreciation (depreciation) on investments', 'asset', '8'],
    ['1200', 'Interest, dividends and rents receivable', 'asset', '6'],
    ['1300', 'Prepaid expenses and other assets', 'asset', '13'],
    ['1400', 'Land', 'asset', '11', true],
    ['1410', 'Buildings and improvements', 'asset', '9a', true],
    ['1490', 'Accumulated depreciation', 'asset', '9b', true],
    ['2000', 'Accounts payable and accrued expenses', 'liability', '15'],
    ['2100', 'Management fees payable', 'liability', '17'],
    ['2200', 'Redemptions payable', 'liability', '17'],
    ['2250', 'Subscriptions received in advance', 'liability', '17'],
    ['2300', 'Securities sold short, at fair value', 'liability', '17'],
    ['2400', 'Tax withheld, payable', 'liability', '17'],
    ['2500', 'Mortgage and notes payable', 'liability', '19b'],
    ['2600', 'Due to general partner', 'liability', '19a'],
    ['3000', "Partners' capital: contributions", 'equity', '21'],
    ['3100', "Partners' capital: distributions and redemptions", 'equity', '21'],
    ['3300', "Partners' capital: distributions to the general partner", 'equity', '21'],
    ['3900', "Partners' capital: accumulated results of earlier years", 'equity', '21'],
    ['4000', 'Interest income', 'income', ''],
    ['4010', 'Dividend income', 'income', ''],
    ['4020', 'Rental income', 'income', ''],
    ['4030', 'Royalty income', 'income', ''],
    ['4090', 'Other income', 'income', ''],
    ['5000', 'Management fees', 'expense', ''],
    ['5100', 'Professional fees', 'expense', ''],
    ['5110', 'Administration', 'expense', ''],
    ['5120', 'Organizational costs', 'expense', ''],
    ['5200', 'Interest expense', 'expense', ''],
    ['5300', 'Insurance', 'expense', '', true],
    ['5310', 'Repairs and maintenance', 'expense', '', true],
    ['5320', 'Real estate taxes', 'expense', '', true],
    ['5330', 'Utilities', 'expense', '', true],
    ['5340', 'Property management', 'expense', '', true],
    ['5390', 'Other property expenses', 'expense', '', true],
    ['5900', 'Other expenses', 'expense', ''],
    ['6000', 'Net realized gain (loss) on investments', 'gain', ''],
    ['6100', 'Net change in unrealized appreciation (depreciation)', 'gain', '']
  ];
  const byCode = (a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

  function realEstate(o) {
    const types = NS.OFFERING_TYPES || {};
    const t = o && types[o.type];
    return !!(t && t.profile === 'realestate');
  }
  /** The template for the offering: 30 accounts, 39 for a real estate fund type. */
  function chart(o) {
    const re = realEstate(o);
    return TEMPLATE.filter((r) => re || !r[4]).map((r) => ({ code: r[0], name: r[1], type: r[2], line: r[3] }));
  }
  const offering = (ws, id) => ((ws && Array.isArray(ws.offerings) && ws.offerings) || []).find((o) => o && o.id === id) || null;

  /* ---------- The fund's books ---------- */
  function blank() {
    return { start: '', accounts: [], journal: [], holdings: [], marks: [], bank: { accounts: [], imports: [], lines: [], recs: [] }, closed: [], exceptions: [] };
  }
  /** The stored fund, or an empty one that is not attached to the workspace (for the read calls). */
  function peek(ws, id) {
    const f = ws && ws.books && ws.books.funds && ws.books.funds[id];
    return f && typeof f === 'object' ? f : blank();
  }
  const list = (f, k) => (f && Array.isArray(f[k]) ? f[k] : []);
  /** The fund's books, created with start '' and empty lists the first time they are needed. */
  function fund(ws, id) {
    if (!ws || typeof ws !== 'object') throw new Error('There is no workspace to keep the books in.');
    if (!offering(ws, id)) throw new Error(`There is no offering ${id} in this workspace.`);
    if (!ws.books || typeof ws.books !== 'object') ws.books = { v: 1, funds: {} };
    if (!ws.books.v) ws.books.v = 1;
    if (!ws.books.funds || typeof ws.books.funds !== 'object') ws.books.funds = {};
    if (!ws.books.funds[id] || typeof ws.books.funds[id] !== 'object') ws.books.funds[id] = {};
    const f = ws.books.funds[id];
    const b = blank();
    Object.keys(b).forEach((k) => {
      if (k === 'start') {
        if (typeof f.start !== 'string') f.start = '';
      } else if (k === 'bank') {
        if (!f.bank || typeof f.bank !== 'object') f.bank = b.bank;
        else Object.keys(b.bank).forEach((x) => Array.isArray(f.bank[x]) || (f.bank[x] = []));
      } else if (!Array.isArray(f[k])) f[k] = b[k];
    });
    return f;
  }
  /** The template plus the fund's added accounts, in code order. */
  function accounts(ws, offeringId) {
    const added = list(peek(ws, offeringId), 'accounts').map((a) =>
      Array.isArray(a) ? { code: String(a[0]), name: String(a[1] || ''), type: String(a[2] || ''), line: String(a[3] || '') } : { code: String(a.code), name: String(a.name || ''), type: String(a.type || ''), line: String(a.line || '') }
    );
    return chart(offering(ws, offeringId)).concat(added).sort(byCode);
  }

  /* ---------- Dates and money ---------- */
  function isDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const D = NS.dates;
    return D.isoOf(D.parse(s)) === s;
  }
  function endOf(k) {
    const [y, m] = k.split('-').map(Number);
    return NS.dates.isoOf(new Date(Date.UTC(y, m, 0)));
  }
  /** Cents as dollars for a sentence, by integer arithmetic only. */
  function dollars(c) {
    const a = Math.abs(c);
    const whole = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (c < 0 ? '-$' : '$') + whole + '.' + String(a % 100).padStart(2, '0');
  }

  /* ---------- Entries ---------- */
  /** '' when the entry may be stored, else one plain sentence saying what is wrong. */
  function check(entry, accts) {
    if (!entry || typeof entry !== 'object') return 'There is no entry.';
    if (!isDate(entry.date)) return 'The date is not a real calendar date written YYYY-MM-DD.';
    if (typeof entry.src !== 'string' || !entry.src.trim()) return 'The entry does not name the record it comes from.';
    if (entry.memo != null && typeof entry.memo !== 'string') return 'The memo must be text.';
    const lines = entry.lines;
    if (!Array.isArray(lines) || lines.length < 2) return 'An entry needs at least two lines.';
    const known = new Set((accts || []).map((a) => a.code));
    let total = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const n = i + 1;
      if (!Array.isArray(l) || l.length < 2) return `Line ${n} needs an account and an amount.`;
      if (l.length > 4) return `Line ${n} holds more than an account, an amount, an investor and an investment.`;
      const code = l[0];
      const cents = l[1];
      if (!known.has(code)) return `Line ${n}: account ${code} is not in this fund's chart of accounts.`;
      if (typeof cents !== 'number' || !Number.isFinite(cents)) return `Line ${n}: the amount is not a number.`;
      if (!Number.isInteger(cents)) return `Line ${n}: the amount is not a whole number of cents.`;
      if (!Number.isSafeInteger(cents)) return `Line ${n}: the amount is too large to be held exactly.`;
      if (cents === 0) return `Line ${n}: the amount is zero.`;
      if (l[2] != null && typeof l[2] !== 'string') return `Line ${n}: the investor must be given by id.`;
      if (l[3] != null && typeof l[3] !== 'string') return `Line ${n}: the investment must be given by id.`;
      total += cents;
      if (!Number.isSafeInteger(total)) return 'The amounts are too large to be added up exactly.';
    }
    if (total !== 0) return `The lines do not balance: they are off by ${dollars(total)}.`;
    return '';
  }
  /** [code, cents, partner, holding] with missing ids as '' and trailing empty ids left out. */
  function compact(l) {
    if (!Array.isArray(l)) return l;
    const out = l.slice();
    while (out.length < 4) out.push('');
    if (out[2] == null) out[2] = '';
    if (out[3] == null) out[3] = '';
    while (out.length > 2 && out[out.length - 1] === '') out.pop();
    return out;
  }
  /** The entry with that src that no reversal names, or null. */
  function live(f, src) {
    const j = list(f, 'journal');
    const reversed = new Set();
    j.forEach((e) => e && e.rev && reversed.add(e.rev));
    for (const e of j) if (e && e.src === src && !reversed.has(e.id)) return e;
    return null;
  }
  /** The last month-end closed and not reopened, or ''. */
  function closedThrough(ws, offeringId) {
    let t = '';
    list(peek(ws, offeringId), 'closed').forEach((r) => {
      if (r && !r.reopened && typeof r.through === 'string' && r.through > t) t = r.through;
    });
    return t;
  }
  function closedError(through) {
    const e = new Error('closed');
    e.code = 'closed';
    e.through = through;
    return e;
  }
  function nextId(f) {
    const used = new Set(f.journal.map((e) => e && e.id));
    let n = f.journal.length + 1;
    while (used.has('je-' + String(n).padStart(6, '0'))) n++;
    return 'je-' + String(n).padStart(6, '0');
  }
  /** Store an entry. Posting a src that already has a live entry returns that entry and adds nothing. */
  function post(ws, offeringId, e, who) {
    who = who || {};
    e = e || {};
    const src = typeof e.src === 'string' ? e.src : '';
    const same = src ? live(peek(ws, offeringId), src) : null;
    if (same) return clone(same);
    const entry = { date: e.date, memo: e.memo == null ? '' : e.memo, src, lines: Array.isArray(e.lines) ? e.lines.map(compact) : e.lines };
    const why = check(entry, accounts(ws, offeringId));
    if (why) throw new Error(why);
    const ct = closedThrough(ws, offeringId);
    if (ct && entry.date <= ct) throw closedError(ct);
    const f = fund(ws, offeringId);
    const stored = { id: nextId(f), date: entry.date, memo: entry.memo, src, lines: entry.lines, at: who.at || new Date().toISOString(), by: who.by || '' };
    f.journal.push(stored);
    return clone(stored);
  }

  /* ---------- Reads (the report builder's; none changes the workspace) ---------- */
  /**
   * One row per account with a line dated on or before `to`, or with a balance: { code, name, type, line, begin,
   * debits, credits, end } in cents, debits and credits positive, end = begin + debits - credits. Income, expense and
   * gain accounts begin from 1 January of from's year; their earlier totals are added to 3900's begin.
   */
  function trialBalance(ws, offeringId, from, to) {
    from = from || '';
    to = to || '9999-12-31';
    const yearStart = from ? from.slice(0, 4) + '-01-01' : '';
    const acc = {};
    accounts(ws, offeringId).forEach((a) => (acc[a.code] = a));
    const rows = {};
    const row = (c) => rows[c] || (rows[c] = { begin: 0, debits: 0, credits: 0, seen: false });
    list(peek(ws, offeringId), 'journal').forEach((e) => {
      if (!e || typeof e.date !== 'string' || e.date > to || !Array.isArray(e.lines)) return;
      e.lines.forEach((l) => {
        const code = String(l[0]);
        const c = l[1];
        const r = row(code);
        r.seen = true;
        if (e.date >= from) {
          if (c > 0) r.debits += c;
          else r.credits -= c;
        } else if (acc[code] && RESULT[acc[code].type] && e.date < yearStart) row(CARRY).begin += c;
        else r.begin += c;
      });
    });
    return Object.keys(rows)
      .filter((c) => rows[c].seen || rows[c].begin !== 0)
      .sort()
      .map((c) => {
        const a = acc[c] || { name: '', type: '', line: '' };
        const r = rows[c];
        return { code: c, name: a.name, type: a.type, line: a.line, begin: r.begin, debits: r.debits, credits: r.credits, end: r.begin + r.debits - r.credits };
      });
  }
  /** The sum of the lines on the account(s) dated on or before asOf, optionally for one investor or investment. */
  function balance(ws, offeringId, codes, asOf, opts) {
    const set = new Set([].concat(codes).map(String));
    const to = asOf || '9999-12-31';
    const p = opts && opts.partner ? String(opts.partner) : '';
    const h = opts && opts.holding ? String(opts.holding) : '';
    let total = 0;
    list(peek(ws, offeringId), 'journal').forEach((e) => {
      if (!e || typeof e.date !== 'string' || e.date > to || !Array.isArray(e.lines)) return;
      e.lines.forEach((l) => {
        if (!set.has(String(l[0]))) return;
        if (p && (l[2] || '') !== p) return;
        if (h && (l[3] || '') !== h) return;
        total += l[1];
      });
    });
    return total;
  }

  NS.books = { chart, accounts, fund, check, post, live, trialBalance, balance, closedThrough };
})(typeof window !== 'undefined' ? window : globalThis);
