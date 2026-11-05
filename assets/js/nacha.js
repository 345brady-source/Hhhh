/*
 * NACHA ACH file builder for distribution payments.
 *
 * Produces a standard 94-character, blocking-factor-10 file:
 *   1 File Header, then per batch 5 Batch Header / 6 Entry Detail ... / 8 Batch Control,
 *   9 File Control, padded with 9-filler records to a multiple of ten.
 * Investors are paid with credit entries (22 checking, 32 savings). Individuals,
 * joint accounts and trusts go in a PPD batch; entities and IRA custodians in a CCD
 * batch. An optional offsetting debit (27/37) balances each batch against the
 * paying entity's settlement account for banks that require balanced files.
 *
 * Always confirm field values against the originating bank's ACH implementation guide.
 */
(function (NS) {
  'use strict';

  /* Federal Reserve holidays on which ACH does not settle (2025–2028). */
  const FED_HOLIDAYS = new Set([
    '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01', '2025-10-13', '2025-11-11', '2025-11-27', '2025-12-25',
    '2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25',
    '2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-07-05', '2027-09-06', '2027-10-11', '2027-11-11', '2027-11-25',
    '2028-01-17', '2028-02-21', '2028-05-29', '2028-06-19', '2028-07-04', '2028-09-04', '2028-10-09', '2028-11-23', '2028-12-25'
  ]);
  const D = () => NS.dates;

  function isBankingDay(iso) {
    const d = D().parse(iso);
    const wd = d.getUTCDay();
    return wd !== 0 && wd !== 6 && !FED_HOLIDAYS.has(iso);
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
    if (FED_HOLIDAYS.has(iso)) return 'is a Federal Reserve holiday';
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

  /**
   * Build a file.
   * opts.origin: { destinationRouting, destinationName, immediateOrigin, originName, odfiRouting }
   * opts.company: { name (16), id (10), discretionary }
   * opts.entries: [{ name, id, routing, account, accountType: 'checking'|'savings', cents, sec: 'PPD'|'CCD' }]
   * opts.effectiveDate (YYYY-MM-DD), opts.description (10), opts.descriptiveDate (6), opts.modifier (A–Z, 0–9)
   * opts.balanced, opts.offset: { routing, account, type }
   */
  function build(opts) {
    const created = nowParts(opts.now || new Date());
    const origin = opts.origin;
    const company = opts.company;
    const odfi8 = String(origin.odfiRouting || '').replace(/\D/g, '').slice(0, 8);
    const svc = opts.balanced ? '200' : '220';
    const excluded = [];
    const valid = [];
    opts.entries.forEach((e) => {
      const acct = String(e.account || '').replace(/\s/g, '');
      if (!abaValid(e.routing)) excluded.push({ entry: e, reason: 'Routing number fails the ABA check digit' });
      else if (!acct || acct.length > 17) excluded.push({ entry: e, reason: 'Account number is missing or longer than 17 characters' });
      else if (!(e.cents > 0)) excluded.push({ entry: e, reason: 'Amount is zero' });
      else if (e.cents > 9999999999) excluded.push({ entry: e, reason: 'Amount exceeds the 10-digit entry limit' });
      else valid.push(Object.assign({}, e, { account: acct }));
    });

    const lines = [];
    lines.push(
      '1' + '01' + immediateField(origin.destinationRouting) + immediateField(origin.immediateOrigin) + yymmdd(created.iso) + created.hhmm +
        (opts.modifier || 'A') + '094' + '10' + '1' + alpha(origin.destinationName, 23) + alpha(origin.originName, 23) + alpha('', 8)
    );

    let trace = 0;
    let fileHash = 0;
    let fileDebit = 0;
    let fileCredit = 0;
    let fileEntries = 0;
    const batches = [];
    ['PPD', 'CCD'].forEach((sec) => {
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
        lines.push('6' + code + r.slice(0, 8) + r.slice(8, 9) + alpha(account, 17) + num(cents, 10) + alpha(id, 15) + alpha(name, 22) + '  ' + '0' + odfi8 + num(trace, 7));
        hash += Number(r.slice(0, 8));
        count += 1;
      };
      group.forEach((e) => {
        addEntry(e.accountType === 'savings' ? '32' : '22', e.routing, e.account, e.cents, e.id, e.name);
        credit += e.cents;
      });
      if (opts.balanced && opts.offset) {
        addEntry(opts.offset.type === 'savings' ? '37' : '27', opts.offset.routing, opts.offset.account, credit, 'OFFSET', company.name);
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
    const checks = [
      { label: 'Every record is 94 characters', ok: lines.every((l) => l.length === 94) },
      { label: `Routing numbers pass the ABA check digit (${valid.length} of ${opts.entries.length})`, ok: excluded.every((x) => x.reason.indexOf('Routing') < 0) },
      { label: 'Account numbers present and 17 characters or fewer', ok: excluded.every((x) => x.reason.indexOf('Account') < 0) },
      { label: reason ? `Effective date ${reason}` : opts.effectiveDate < created.iso ? 'Effective date is in the past' : opts.effectiveDate === created.iso ? 'Effective date is today (same-day ACH)' : 'Effective date is a future banking day', ok: !reason && opts.effectiveDate >= created.iso, warn: opts.effectiveDate === created.iso },
      { label: 'Batch and file totals equal the sum of entries', ok: fileCredit === valid.reduce((a, e) => a + e.cents, 0) && fileCredit + excluded.reduce((a, x) => a + (x.entry.cents || 0), 0) === expectedCredit },
      { label: `File padded to ${blocks} block${blocks === 1 ? '' : 's'} of 10 records`, ok: lines.length === blocks * 10 },
      { label: opts.balanced ? 'Balanced: offsetting debit equals credits' : 'Unbalanced file (credits only)', ok: !opts.balanced || fileDebit === fileCredit }
    ];

    return {
      lines,
      text: lines.join('\r\n') + '\r\n',
      batches,
      excluded,
      checks,
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

  NS.nacha = { build, abaValid, isBankingDay, nextBankingDay, bankingDayReason, clean, LAYOUT };
})(window.CVPortal);
