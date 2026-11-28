/*
 * NACHA ACH file builder for distribution payments.
 *
 * Produces a standard 94-character, blocking-factor-10 file:
 *   1 File Header, then per batch 5 Batch Header / 6 Entry Detail ... / 8 Batch Control,
 *   9 File Control, padded with 9-filler records to a multiple of ten.
 * Investors are paid with credit entries (22 checking, 32 savings); a bank account is
 * proved first with a pre-note, a $0.00 entry (23 checking, 33 savings). Individuals,
 * joint accounts and trusts go in a PPD batch; entities and IRA custodians in a CCD
 * batch. An optional offsetting debit (27/37) balances each batch against the
 * paying entity's settlement account for banks that require balanced files. No debit
 * entries otherwise (capital calls go by wire) and no IAT (foreign investors are paid by wire).
 * Nothing is left out without a reason (result.excluded). Every check carries a level:
 * 'block' (a red check: the file must not go to the bank: a bad settlement account, a
 * company ID that is not 10 characters, no company name, an entry description the ACH
 * rules reserve for other payments, a bank routing number failing the check digit),
 * 'warn' (amber: a same-day file, an entry above the same-day limit for one payment,
 * a dated table) or 'ok'. A file ID modifier that is not A-Z or 0-9 is refused outright.
 * Banking days (effective dates, the distribution schedule) follow the Federal Reserve's holidays, worked out by rule
 * for any year, plus a dated list of one-off closures.
 *
 * Always confirm field values against the originating bank's ACH implementation guide.
 */
(function (NS) {
  'use strict';

  const D = () => NS.dates;
  /* The SEC types these payments use: PPD for individuals, joint accounts and trusts, CCD for entities and IRA custodians. */
  const SEC_TYPES = Object.freeze(['PPD', 'CCD']);

  /*
   * Federal Reserve holidays on which ACH does not settle, worked out by rule for any year: the eleven holidays the
   * Federal Reserve Banks observe. A fixed-date holiday that falls on a Sunday closes the Monday after it; one that falls
   * on a Saturday closes nothing (the Reserve Banks are open the Friday before). Kept per year after the first call.
   */
  const HOLIDAYS_BY_YEAR = new Map();
  function holidaysOf(year) {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 1 || y > 9999) return { list: [], set: new Set() };
    if (HOLIDAYS_BY_YEAR.has(y)) return HOLIDAYS_BY_YEAR.get(y);
    const at = (m, day) => new Date(Date.UTC(y, m, day));
    // The n-th weekday wd (0 Sunday .. 6 Saturday) of month m (0 January).
    const nth = (m, wd, n) => {
      const d = at(m, 1);
      while (d.getUTCDay() !== wd) d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCDate(d.getUTCDate() + 7 * (n - 1));
      return d;
    };
    const lastMonday = (m) => {
      const d = at(m + 1, 0);
      while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() - 1);
      return d;
    };
    const fixed = (m, day) => {
      const d = at(m, day);
      const wd = d.getUTCDay();
      if (wd === 6) return null;
      if (wd === 0) d.setUTCDate(d.getUTCDate() + 1);
      return d;
    };
    const list = [
      fixed(0, 1), // New Year's Day
      nth(0, 1, 3), // Birthday of Martin Luther King, Jr.: third Monday of January
      nth(1, 1, 3), // Washington's Birthday: third Monday of February
      lastMonday(4), // Memorial Day: last Monday of May
      fixed(5, 19), // Juneteenth National Independence Day
      fixed(6, 4), // Independence Day
      nth(8, 1, 1), // Labor Day: first Monday of September
      nth(9, 1, 2), // Columbus Day: second Monday of October
      fixed(10, 11), // Veterans Day
      nth(10, 4, 4), // Thanksgiving Day: fourth Thursday of November
      fixed(11, 25) // Christmas Day
    ]
      .filter(Boolean)
      .map((d) => D().isoOf(d))
      .sort();
    const entry = { list: Object.freeze(list), set: new Set(list) };
    HOLIDAYS_BY_YEAR.set(y, entry);
    return entry;
  }
  /** The year's Federal Reserve holidays that close a weekday, as 'YYYY-MM-DD', sorted. */
  function fedHolidays(year) {
    return holidaysOf(year).list.slice();
  }
  /*
   * One-off closures the Federal Reserve announces case by case (a national day of mourning, say): one dated line each,
   * { date: 'YYYY-MM-DD', why: '...' }. Empty at launch.
   */
  const EXTRA_CLOSED = Object.freeze([
  ].map((x) => Object.freeze(Object.assign({}, x))));

  function isFedHoliday(iso) {
    return holidaysOf(String(iso).slice(0, 4)).set.has(iso) || EXTRA_CLOSED.some((x) => x.date === iso);
  }
  function isBankingDay(iso) {
    const d = D().parse(iso);
    const wd = d.getUTCDay();
    return wd !== 0 && wd !== 6 && !isFedHoliday(iso);
  }
  function nextBankingDay(iso, n) {
    const d = D().parse(iso);
    let left = n == null ? 1 : n;
    do {
      d.setUTCDate(d.getUTCDate() + 1);
      if (isBankingDay(D().isoOf(d))) left -= 1;
    } while (left > 0);
    return D().isoOf(d);
  }
  function bankingDayReason(iso) {
    const wd = D().parse(iso).getUTCDay();
    if (wd === 0 || wd === 6) return 'falls on a weekend';
    if (isFedHoliday(iso)) return 'is a Federal Reserve holiday';
    return '';
  }

  /* ABA routing number check digit (weights 3, 7, 1). */
  function abaValid(r) {
    const s = String(r || '').replace(/\D/g, '');
    if (s.length !== 9 || /^0{9}$/.test(s)) return false;
    const d = s.split('').map(Number);
    return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
  }

  /* Field formatting. Alphanumeric fields: upper case, left-justified, space-filled. */
  function clean(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9 .,&'/()\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const alpha = (s, n) => clean(s).slice(0, n).padEnd(n, ' ');
  function num(v, n) {
    const s = String(Math.round(Number(v) || 0));
    if (s.length > n) throw new Error(`Value ${s} does not fit in ${n} digits`);
    return s.padStart(n, '0');
  }
  const yymmdd = (iso) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
  function nowParts(date) {
    const p = (x) => String(x).padStart(2, '0');
    return { iso: `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`, hhmm: p(date.getHours()) + p(date.getMinutes()) };
  }
  function immediateField(v) {
    const s = String(v || '').replace(/\s/g, '');
    return s.length === 9 ? ' ' + s : s.slice(0, 10).padStart(10, ' ');
  }

  /*
   * The same-day ACH limit for one payment, by the date it starts (the limit of a date is the last row whose from is on
   * or before it). An entry above it is not refused by the bank: it settles the next banking day instead.
   */
  const SAME_DAY_LIMITS = Object.freeze([
    { from: '2022-03-18', cents: 100000000 },
    { from: '2027-09-17', cents: 1000000000 }
  ].map((x) => Object.freeze(x)));
  function sameDayLimit(iso) {
    let cents = 0;
    SAME_DAY_LIMITS.forEach((x) => {
      if (x.from <= iso) cents = x.cents;
    });
    return cents;
  }
  /*
   * Company entry descriptions the ACH rules reserve for other payments. PAYROLL, PURCHASE and ACCTVERIFY are cited from
   * the rules; the others are assumed from the same rules (16-RESEARCH F-11, A3). Compared with the cleaned description.
   */
  const RESERVED_DESCRIPTIONS = Object.freeze(['PAYROLL', 'PURCHASE', 'ACCTVERIFY', 'REVERSAL', 'RETURN FEE', 'RECLAIM', 'NONSETTLED', 'RETRY PYMT', 'AUTOENROLL', 'REDEPCHECK', 'HCCLAIMPMT']);
  const MODIFIER_RE = /^[A-Z0-9]$/;

  /* Dollars for a check's sentence: $1,000,000.00. */
  function usd(cents) {
    const c = Math.round(Number(cents) || 0);
    const d = String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (c < 0 ? '-' : '') + '$' + d + '.' + String(Math.abs(c) % 100).padStart(2, '0');
  }
  const accountOk = (a) => {
    const s = String(a == null ? '' : a).replace(/\s/g, '');
    return s.length > 0 && s.length <= 17;
  };

  /**
   * Build a file.
   * opts.origin: { destinationRouting, destinationName, immediateOrigin, originName, odfiRouting }
   * opts.company: { name (16), id (10), discretionary }
   * opts.entries: [{ name, id, routing, account, accountType: 'checking'|'savings', cents, sec: 'PPD'|'CCD',
   *   kind: 'credit' (the default) | 'prenote' ($0.00, codes 23/33), ref (any string, passed through to result.entries) }]
   * opts.effectiveDate (YYYY-MM-DD), opts.description (10), opts.descriptiveDate (6)
   * opts.modifier: one capital letter A-Z or one digit 0-9 ('A' when not given); anything else throws
   * opts.balanced, opts.offset: { routing, account, type }
   * opts.now: the creation time (a Date; now when not given)
   * Every entry is in the file or in result.excluded with its reason. Every check is { label, ok, warn, level } with level
   * 'block' (ok false: the file must not go to the bank), 'warn' (amber) or 'ok'; result.blocked lists the 'block' ones.
   * result.entries lists each entry written, in file order: { id, ref, trace, cents, code, kind, sec, batch } (the
   * offsetting debits are not listed).
   */
  function build(opts) {
    if (opts.modifier != null && !MODIFIER_RE.test(String(opts.modifier))) throw new Error('The file ID modifier must be one capital letter A-Z or one digit 0-9.');
    const created = nowParts(opts.now || new Date());
    const origin = opts.origin;
    const company = opts.company;
    // An originating routing number that is not 9 digits is a red check below; the field keeps its 8 characters.
    const odfi8 = String(origin.odfiRouting || '').replace(/\D/g, '').slice(0, 8).padStart(8, '0');
    const svc = opts.balanced ? '200' : '220';
    const offset = opts.offset || {};
    const offsetRoutingOk = abaValid(offset.routing);
    const offsetOk = offsetRoutingOk && accountOk(offset.account);
    const excluded = [];
    const valid = [];
    opts.entries.forEach((e) => {
      const acct = String(e.account || '').replace(/\s/g, '');
      const sec = String(e.sec == null ? '' : e.sec).trim().toUpperCase();
      const kind = e.kind == null || e.kind === '' ? 'credit' : String(e.kind);
      const cents = Number(e.cents) || 0;
      if (!abaValid(e.routing)) excluded.push({ entry: e, reason: 'Routing number fails the ABA check digit' });
      else if (!acct || acct.length > 17) excluded.push({ entry: e, reason: 'Account number is missing or longer than 17 characters' });
      else if (!sec) excluded.push({ entry: e, reason: 'No SEC type' });
      else if (SEC_TYPES.indexOf(sec) < 0) excluded.push({ entry: e, reason: `SEC type ${sec} is not one these payments use` });
      else if (kind !== 'credit' && kind !== 'prenote') excluded.push({ entry: e, reason: `Entry kind ${kind} is not one these payments use` });
      else if (kind === 'credit' && !(e.cents > 0)) excluded.push({ entry: e, reason: 'Amount is zero' });
      else if (kind === 'prenote' && cents !== 0) excluded.push({ entry: e, reason: 'A pre-note is for $0.00' });
      else if (e.cents > 9999999999) excluded.push({ entry: e, reason: 'Amount exceeds the 10-digit entry limit' });
      else valid.push(Object.assign({}, e, { account: acct, sec, kind, cents: kind === 'prenote' ? 0 : e.cents }));
    });

    const lines = [];
    lines.push(
      '1' + '01' + immediateField(origin.destinationRouting) + immediateField(origin.immediateOrigin) + yymmdd(created.iso) + created.hhmm +
        (opts.modifier == null ? 'A' : String(opts.modifier)) + '094' + '10' + '1' + alpha(origin.destinationName, 23) + alpha(origin.originName, 23) + alpha('', 8)
    );

    const listed = [];
    let trace = 0;
    let fileHash = 0;
    let fileDebit = 0;
    let fileCredit = 0;
    let fileEntries = 0;
    const batches = [];
    SEC_TYPES.forEach((sec) => {
      const group = valid.filter((e) => e.sec === sec);
      if (!group.length) return;
      const batchNo = batches.length + 1;
      lines.push(
        '5' + svc + alpha(company.name, 16) + alpha(company.discretionary || '', 20) + alpha(company.id, 10) + sec + alpha(opts.description || 'DISTRIB', 10) +
          alpha(opts.descriptiveDate || '', 6) + yymmdd(opts.effectiveDate) + '   ' + '1' + odfi8 + num(batchNo, 7)
      );
      let hash = 0;
      let credit = 0;
      let debit = 0;
      let count = 0;
      const addEntry = (code, routing, account, cents, id, name) => {
        trace += 1;
        const r = String(routing).replace(/\D/g, '');
        const tr = odfi8 + num(trace, 7);
        lines.push('6' + code + r.slice(0, 8) + r.slice(8, 9) + alpha(account, 17) + num(cents, 10) + alpha(id, 15) + alpha(name, 22) + '  ' + '0' + tr);
        hash += Number(r.slice(0, 8));
        count += 1;
        return tr;
      };
      group.forEach((e) => {
        const savings = e.accountType === 'savings';
        const code = e.kind === 'prenote' ? (savings ? '33' : '23') : savings ? '32' : '22';
        const tr = addEntry(code, e.routing, e.account, e.cents, e.id, e.name);
        listed.push({ id: e.id, ref: e.ref, trace: tr, cents: e.cents, code, kind: e.kind, sec, batch: batchNo });
        credit += e.cents;
      });
      // The offsetting debit: only for a balanced file whose settlement account passes, and only when the batch credits
      // money (a batch of pre-notes alone has nothing to offset). A bad settlement account is a red check below.
      if (opts.balanced && offsetOk && credit > 0) {
        addEntry(offset.type === 'savings' ? '37' : '27', offset.routing, String(offset.account).replace(/\s/g, ''), credit, 'OFFSET', company.name);
        debit += credit;
      }
      lines.push('8' + svc + num(count, 6) + num(hash % 1e10, 10) + num(debit, 12) + num(credit, 12) + alpha(company.id, 10) + alpha('', 19) + alpha('', 6) + odfi8 + num(batchNo, 7));
      batches.push({ number: batchNo, sec, entries: count, credit, debit, hash: hash % 1e10 });
      fileHash += hash;
      fileDebit += debit;
      fileCredit += credit;
      fileEntries += count;
    });

    const recordsWithControl = lines.length + 1;
    const blocks = Math.ceil(recordsWithControl / 10);
    lines.push('9' + num(batches.length, 6) + num(blocks, 6) + num(fileEntries, 8) + num(fileHash % 1e10, 10) + num(fileDebit, 12) + num(fileCredit, 12) + alpha('', 39));
    while (lines.length % 10 !== 0) lines.push('9'.repeat(94));

    const expectedCredit = opts.entries.reduce((a, e) => a + (e.cents || 0), 0);
    const reason = bankingDayReason(opts.effectiveDate);
    const sameDay = opts.effectiveDate === created.iso;
    const limit = sameDayLimit(opts.effectiveDate);
    const description = clean(opts.description || 'DISTRIB');
    const reserved = [description, description.slice(0, 10).trim()].find((w) => RESERVED_DESCRIPTIONS.indexOf(w) >= 0);
    const raw = [
      { label: 'Every record is 94 characters', ok: lines.every((l) => l.length === 94) },
      { label: `Routing numbers pass the ABA check digit (${opts.entries.filter((e) => abaValid(e.routing)).length} of ${opts.entries.length})`, ok: excluded.every((x) => x.reason.indexOf('Routing') < 0) },
      { label: 'Account numbers present and 17 characters or fewer', ok: excluded.every((x) => x.reason.indexOf('Account') < 0) },
      { label: reason ? `Effective date ${reason}` : opts.effectiveDate < created.iso ? 'Effective date is in the past' : sameDay ? 'Effective date is today (same-day ACH)' : 'Effective date is a future banking day', ok: !reason && opts.effectiveDate >= created.iso, warn: sameDay },
      { label: 'Batch and file totals equal the sum of entries', ok: fileCredit === valid.reduce((a, e) => a + e.cents, 0) && fileCredit + excluded.reduce((a, x) => a + (x.entry.cents || 0), 0) === expectedCredit },
      { label: `File padded to ${blocks} block${blocks === 1 ? '' : 's'} of 10 records`, ok: lines.length === blocks * 10 },
      { label: opts.balanced ? 'Balanced: offsetting debit equals credits' : 'Unbalanced file (credits only)', ok: !opts.balanced || fileDebit === fileCredit }
    ];
    const block = (label) => raw.push({ label, ok: false });
    if (opts.balanced && !offsetRoutingOk) block('Settlement account for the offsetting debit: the routing number fails the check digit');
    else if (opts.balanced && !offsetOk) block('Settlement account for the offsetting debit: the account number is missing or longer than 17 characters');
    if (clean(company.id).length !== 10) block('Company ID must be exactly 10 characters');
    if (!clean(company.name)) block('Company name is missing');
    if (reserved) block(`Entry description "${reserved}" is reserved by the ACH rules for other payments; use another word`);
    if (!abaValid(origin.odfiRouting)) block('Originating bank routing number fails the check digit');
    if (!abaValid(origin.destinationRouting)) block('Immediate destination routing number fails the check digit');
    // Same-day: an entry above the limit for its date settles the next banking day (never split, never refused).
    if (sameDay) {
      SEC_TYPES.forEach((sec) =>
        valid
          .filter((e) => e.sec === sec && e.cents > limit)
          .forEach((e) => raw.push({ label: `${e.name} (${e.id}): ${usd(e.cents)} is above the same-day limit of ${usd(limit)} for one payment, so it settles the next banking day`, ok: true, warn: true }))
      );
    }
    // A red check outranks amber: ok false is 'block' whatever warn says.
    const checks = raw.map((c) => {
      const ok = !!c.ok;
      const warn = ok && !!c.warn;
      return { label: c.label, ok, warn, level: !ok ? 'block' : warn ? 'warn' : 'ok' };
    });

    return {
      lines,
      text: lines.join('\r\n') + '\r\n',
      batches,
      excluded,
      checks,
      blocked: checks.filter((c) => c.level === 'block'),
      entries: listed,
      totals: { batches: batches.length, blocks, entries: fileEntries, hash: fileHash % 1e10, credit: fileCredit, debit: fileDebit, records: lines.length },
      created
    };
  }

  /* Field map for the preview legend: [start, end, name] per record type (1-based, inclusive). */
  const LAYOUT = {
    1: [[1, 1, 'Record type'], [2, 3, 'Priority'], [4, 13, 'Immediate destination'], [14, 23, 'Immediate origin'], [24, 29, 'Creation date'], [30, 33, 'Creation time'], [34, 34, 'File ID modifier'], [35, 37, 'Record size'], [38, 39, 'Blocking factor'], [40, 40, 'Format code'], [41, 63, 'Destination name'], [64, 86, 'Origin name'], [87, 94, 'Reference']],
    5: [[1, 1, 'Record type'], [2, 4, 'Service class'], [5, 20, 'Company name'], [21, 40, 'Discretionary data'], [41, 50, 'Company ID'], [51, 53, 'SEC code'], [54, 63, 'Entry description'], [64, 69, 'Descriptive date'], [70, 75, 'Effective date'], [76, 78, 'Settlement date'], [79, 79, 'Originator status'], [80, 87, 'ODFI'], [88, 94, 'Batch number']],
    6: [[1, 1, 'Record type'], [2, 3, 'Transaction code'], [4, 11, 'Receiving DFI'], [12, 12, 'Check digit'], [13, 29, 'Account number'], [30, 39, 'Amount'], [40, 54, 'Individual ID'], [55, 76, 'Individual name'], [77, 78, 'Discretionary'], [79, 79, 'Addenda'], [80, 94, 'Trace number']],
    8: [[1, 1, 'Record type'], [2, 4, 'Service class'], [5, 10, 'Entry count'], [11, 20, 'Entry hash'], [21, 32, 'Total debits'], [33, 44, 'Total credits'], [45, 54, 'Company ID'], [55, 73, 'Authentication'], [74, 79, 'Reserved'], [80, 87, 'ODFI'], [88, 94, 'Batch number']],
    9: [[1, 1, 'Record type'], [2, 7, 'Batch count'], [8, 13, 'Block count'], [14, 21, 'Entry count'], [22, 31, 'Entry hash'], [32, 43, 'Total debits'], [44, 55, 'Total credits'], [56, 94, 'Reserved']]
  };

  NS.nacha = { build, abaValid, isBankingDay, nextBankingDay, bankingDayReason, clean, LAYOUT, fedHolidays, EXTRA_CLOSED, SAME_DAY_LIMITS, RESERVED_DESCRIPTIONS };
})(window.CVPortal);
