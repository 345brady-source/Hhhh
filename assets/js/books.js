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
  /**
   * Reverse an entry with an equal and opposite one that names it (src 'rev:<id>', rev <id>). The entry itself is never
   * changed; afterwards its src may be posted again. Dated who.date, else the entry's own date.
   */
  function reverse(ws, offeringId, entryId, who) {
    who = who || {};
    const j = list(peek(ws, offeringId), 'journal');
    const e = j.find((x) => x && x.id === entryId);
    if (!e) throw new Error(`There is no entry ${entryId} in this fund's journal.`);
    if (e.rev) throw new Error(`Entry ${entryId} is itself a reversal and cannot be reversed; post the original again instead.`);
    if (j.some((x) => x && x.rev === entryId)) throw new Error(`Entry ${entryId} has already been reversed.`);
    const date = who.date == null || who.date === '' ? e.date : who.date;
    if (!isDate(date)) throw new Error('The date is not a real calendar date written YYYY-MM-DD.');
    if (date < e.date) throw new Error('A reversal cannot be dated before the entry it reverses.');
    const ct = closedThrough(ws, offeringId);
    if (ct && (e.date <= ct || date <= ct)) throw closedError(ct);
    const entry = {
      date,
      memo: who.memo == null || who.memo === '' ? `Reversal of ${entryId}` : who.memo,
      src: 'rev:' + entryId,
      lines: (e.lines || []).map((l) => compact([l[0], -l[1]].concat(l.slice(2))))
    };
    const why = check(entry, accounts(ws, offeringId));
    if (why) throw new Error(why);
    const f = fund(ws, offeringId);
    const stored = { id: nextId(f), date, memo: entry.memo, src: entry.src, lines: entry.lines, at: who.at || new Date().toISOString(), by: who.by || '', rev: entryId };
    f.journal.push(stored);
    return clone(stored);
  }

  /* ---------- Closing a period ---------- */
  /** 'code|end' lines over the trial balance from the start of the books through the day. */
  function tbText(ws, offeringId, through) {
    return trialBalance(ws, offeringId, peek(ws, offeringId).start || '', through)
      .map((r) => `${r.code}|${r.end}`)
      .join('\n');
  }
  /** Close through a month-end after the last one closed: stores the SHA-256 of tbText, who and when. */
  function close(ws, offeringId, through, who) {
    who = who || {};
    if (!isDate(through) || endOf(through.slice(0, 7)) !== through) throw new Error('A period can be closed only through the last day of a month.');
    const ct = closedThrough(ws, offeringId);
    if (ct && through <= ct) throw new Error(`The books are already closed through ${ct}; choose a later month-end.`);
    if (typeof who.by !== 'string' || !who.by.trim()) throw new Error('Closing a period needs the name of the person closing it.');
    const f = fund(ws, offeringId);
    const rec = { through, tb: NS.audit.sha256(tbText(ws, offeringId, through)), at: who.at || new Date().toISOString(), by: who.by };
    f.closed.push(rec);
    return clone(rec);
  }
  /** Reopen the last close with a reason; closedThrough becomes the previous through or ''. */
  function reopen(ws, offeringId, who) {
    who = who || {};
    const why = typeof who.why === 'string' ? who.why.trim() : '';
    if (!why) throw new Error('Reopening the books needs a reason.');
    if (typeof who.by !== 'string' || !who.by.trim()) throw new Error('Reopening the books needs the name of the person reopening them.');
    let last = null;
    list(peek(ws, offeringId), 'closed').forEach((r) => {
      if (r && !r.reopened && typeof r.through === 'string' && (!last || r.through >= last.through)) last = r;
    });
    if (!last) throw new Error('The books are not closed for any period.');
    fund(ws, offeringId);
    last.reopened = { at: who.at || new Date().toISOString(), by: who.by, why };
    return clone(last);
  }

  /* ---------- Accounts and holdings ---------- */
  /** Add an account beyond the template: four digits, unused, a known type, a name. */
  function addAccount(ws, offeringId, a) {
    a = a || {};
    const code = a.code == null ? '' : String(a.code);
    if (!/^\d{4}$/.test(code)) throw new Error('An account code is four digits.');
    if (accounts(ws, offeringId).some((x) => x.code === code)) throw new Error(`Account ${code} is already in this fund's chart of accounts.`);
    if (TYPES.indexOf(a.type) < 0) throw new Error(`An account's type is one of: ${TYPES.join(', ')}.`);
    const name = typeof a.name === 'string' ? a.name.trim() : '';
    if (!name) throw new Error('An account needs a name.');
    const line = a.line == null ? '' : String(a.line);
    fund(ws, offeringId).accounts.push([code, name, a.type, line]);
    return { code, name, type: a.type, line };
  }
  const HOLDING_KEYS = ['name', 'kind', 'level', 'address', 'placed', 'landCents', 'buildingCents'];
  /** '' when the holding's fields are valid, else a sentence. */
  function holdingFault(h) {
    if (typeof h.name !== 'string' || !h.name.trim()) return 'An investment needs a name.';
    if (h.kind !== 'investment' && h.kind !== 'property') return "An investment's kind is investment or property.";
    if (h.level !== 1 && h.level !== 2 && h.level !== 3) return "An investment's fair value level is 1, 2 or 3.";
    if (typeof h.address !== 'string') return 'The address must be text.';
    if (h.placed !== '' && !isDate(h.placed)) return 'The placed-in-service date is not a real calendar date written YYYY-MM-DD.';
    for (const k of ['landCents', 'buildingCents']) if (!Number.isSafeInteger(h[k]) || h[k] < 0) return `The ${k === 'landCents' ? 'land' : 'building'} cost must be a whole number of cents, not below zero.`;
    return '';
  }
  /** Add an investment or property (id 'h-' + base-36 count). */
  function addHolding(ws, offeringId, fields) {
    fields = fields || {};
    const h = {
      id: '',
      name: typeof fields.name === 'string' ? fields.name.trim() : fields.name,
      kind: fields.kind == null ? 'investment' : fields.kind,
      level: fields.level == null ? 3 : fields.level,
      address: fields.address == null ? '' : fields.address,
      placed: fields.placed == null ? '' : fields.placed,
      landCents: fields.landCents == null ? 0 : fields.landCents,
      buildingCents: fields.buildingCents == null ? 0 : fields.buildingCents
    };
    const why = holdingFault(h);
    if (why) throw new Error(why);
    const f = fund(ws, offeringId);
    const used = new Set(f.holdings.map((x) => x && x.id));
    let n = f.holdings.length + 1;
    while (used.has('h-' + n.toString(36))) n++;
    h.id = 'h-' + n.toString(36);
    f.holdings.push(h);
    return clone(h);
  }
  /** Change a holding's fields (never its id). */
  function setHolding(ws, offeringId, id, fields) {
    const h = list(peek(ws, offeringId), 'holdings').find((x) => x && x.id === id);
    if (!h) throw new Error(`There is no investment ${id} in this fund.`);
    const next = Object.assign({ address: '', placed: '', landCents: 0, buildingCents: 0 }, h);
    HOLDING_KEYS.forEach((k) => {
      if (fields && Object.prototype.hasOwnProperty.call(fields, k)) next[k] = k === 'name' && typeof fields[k] === 'string' ? fields[k].trim() : fields[k];
    });
    const why = holdingFault(next);
    if (why) throw new Error(why);
    HOLDING_KEYS.forEach((k) => (h[k] = next[k]));
    return clone(h);
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
  const idNum = (id) => (/^je-\d+$/.test(id) ? Number(id.slice(3)) : Infinity);
  /**
   * One row per journal line { id, date, memo, src, code, cents, partner, holding }, by date then id. Filters: from, to
   * (dates, inclusive), account (a code or a list), partner, holding, src (a prefix).
   */
  function entries(ws, offeringId, q) {
    q = q || {};
    const from = q.from || '';
    const to = q.to || '9999-12-31';
    const accts = q.account == null || q.account === '' ? null : new Set([].concat(q.account).map(String));
    const p = q.partner ? String(q.partner) : '';
    const h = q.holding ? String(q.holding) : '';
    const src = q.src ? String(q.src) : '';
    const rows = [];
    list(peek(ws, offeringId), 'journal').forEach((e) => {
      if (!e || typeof e.date !== 'string' || e.date < from || e.date > to || !Array.isArray(e.lines)) return;
      if (src && String(e.src || '').indexOf(src) !== 0) return;
      e.lines.forEach((l) => {
        const code = String(l[0]);
        if (accts && !accts.has(code)) return;
        if (p && (l[2] || '') !== p) return;
        if (h && (l[3] || '') !== h) return;
        rows.push({ id: e.id, date: e.date, memo: e.memo || '', src: e.src || '', code, cents: l[1], partner: l[2] || '', holding: l[3] || '' });
      });
    });
    return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  }
  /** Net activity on the accounts per month from from's month to to's month, every month present. */
  function series(ws, offeringId, codes, from, to) {
    if (!isDate(from) || !isDate(to)) throw new Error('A series needs a first and a last date written YYYY-MM-DD.');
    const set = new Set([].concat(codes).map(String));
    const out = [];
    const at = {};
    let y = Number(from.slice(0, 4));
    let m = Number(from.slice(5, 7));
    const last = to.slice(0, 7);
    for (let guard = 0; guard < 12000; guard++) {
      const k = `${y}-${String(m).padStart(2, '0')}`;
      if (k > last) break;
      at[k] = out.length;
      out.push({ month: k, cents: 0 });
      m++;
      if (m > 12) (m = 1), y++;
    }
    list(peek(ws, offeringId), 'journal').forEach((e) => {
      if (!e || typeof e.date !== 'string' || e.date < from || e.date > to || !Array.isArray(e.lines)) return;
      const i = at[e.date.slice(0, 7)];
      if (i === undefined) return;
      e.lines.forEach((l) => {
        if (set.has(String(l[0]))) out[i].cents += l[1];
      });
    });
    return out;
  }
  /** { start, closedThrough, entries (count), exceptions (count) }. */
  function status(ws, offeringId) {
    const f = peek(ws, offeringId);
    return { start: typeof f.start === 'string' ? f.start : '', closedThrough: closedThrough(ws, offeringId), entries: list(f, 'journal').length, exceptions: list(f, 'exceptions').length };
  }

  NS.books = { chart, accounts, fund, check, post, reverse, live, trialBalance, entries, balance, series, tbText, close, reopen, closedThrough, status, addAccount, addHolding, setHolding };
})(typeof window !== 'undefined' ? window : globalThis);
