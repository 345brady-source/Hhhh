/*
 * Bank statement files: a statement the sponsor downloads from the bank, read in the browser with no network and no
 * outside library, into lines of { id, date, cents, text, ref } (money in positive, amounts in whole cents).
 *
 * Pure functions. Nothing here fetches, stores, uses the browser's XML parser or evaluates any part of a file: OFX is
 * read by a small tokenizer that decodes only the five named entities. Storing and matching lines is books-bank.js
 * (plan 11-08); the upload screen is plan 11-15.
 *
 * What is proven and what is assumed (the format specifications could not be opened when this was written):
 *  - The newer OFX layout (XML with closing tags) follows the structure of a real OFX file that was read.
 *  - UNCONFIRMED: the older OFX layout (a plain-text header, then the same tags where a value has no closing tag) is
 *    taken from general knowledge of the format; one tokenizer reads both, so a value is read the same either way.
 *  - BAI2 records, continuations and the trailer arithmetic are proven on two real BAI2 files (an open-source
 *    project's published test data): an account trailer (49) totals every amount of its 03 summaries (signed) and of
 *    its 16 transactions, and counts its records from the 03 to the 49 with every 88; a group trailer (98) totals its
 *    accounts and counts the accounts and its records from the 02 to the 98; the file trailer (99) totals its groups
 *    and counts the groups and every record. Item counts and funds-availability amounts are not totalled.
 *  - UNCONFIRMED (general knowledge, consistent with those files but not read in the specification): BAI2 type codes
 *    100 to 399 are money in and 400 to 699 money out (any other code in a 16 record refuses the file); summary code
 *    010 is the opening and 015 the closing ledger balance (040 and 045, available balances, are not used); a 16
 *    record with funds type V carries its own value date, used as the line's date (otherwise the group's as-of date);
 *    two-digit years are 20YY; a 16 record's text that runs on in an 88 record is joined with one space.
 *  - CSV has no standard: the column map is guessed from the header row and the values and confirmed by the sponsor.
 *  - No bank's own export has been read yet; a real export from the owner's bank (numbers masked) is still owed.
 */
(function (NS) {
  'use strict';

  /** Refusal limits, checked before anything is parsed. bytes counts UTF-8 bytes of the text, not characters. */
  const LIMITS = { bytes: 2000000, lines: 20000 };
  const KINDS = 'CSV, OFX, QFX, QBO or BAI2';

  const refuse = (sentence) => {
    throw new Error(sentence);
  };
  const plainNumber = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  /** UTF-8 byte length of a string, counted without an encoder (a lone surrogate counts as the 3 bytes U+FFFD takes). */
  function utf8Bytes(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff) {
        n += 4;
        i++;
      } else n += 3;
    }
    return n;
  }
  /** The number of lines in a text; a final line break does not start another line. */
  function lineCount(s) {
    if (!s) return 0;
    let n = 1;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 10) n++;
      else if (c === 13) {
        if (s.charCodeAt(i + 1) === 10) i++;
        n++;
      }
    }
    const last = s.charCodeAt(s.length - 1);
    return last === 10 || last === 13 ? n - 1 : n;
  }

  /**
   * An amount as whole cents, read digit by digit with no floating point: '$1,234.56', '1234.5', '-12.00', '(12.00)',
   * '12.00-', '+5' and '-200.0000' read exactly. null for: no digit, letters or other characters, two signs, commas
   * that are not thousands groups, a non-zero digit after the cents, or an amount too large to hold exactly.
   */
  function cents(text) {
    let s = String(text == null ? '' : text).trim();
    let neg = false;
    let signs = 0;
    if (s[0] === '(' && s[s.length - 1] === ')') {
      neg = true;
      signs++;
      s = s.slice(1, -1).trim();
    }
    if (s[s.length - 1] === '-' || s[s.length - 1] === '+') {
      neg = neg || s[s.length - 1] === '-';
      signs++;
      s = s.slice(0, -1).trim();
    }
    let dollar = 0;
    while (s && (s[0] === '-' || s[0] === '+' || s[0] === '$' || s[0] === ' ')) {
      if (s[0] === '$') dollar++;
      else if (s[0] !== ' ') {
        signs++;
        if (s[0] === '-') neg = true;
      }
      s = s.slice(1);
    }
    if (signs > 1 || dollar > 1) return null;
    const m = /^(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d*))?$/.exec(s);
    if (!m) return null;
    const whole = m[1].replace(/,/g, '');
    const frac = m[2] || '';
    if (!whole && !frac) return null;
    if (/[^0]/.test(frac.slice(2))) return null;
    const digits = (whole || '0') + (frac + '00').slice(0, 2);
    const v = Number(digits);
    if (!Number.isSafeInteger(v)) return null;
    return neg && v ? -v : v;
  }

  /** 'YYYY-MM-DD' when y, m, d name a day that exists, else null. */
  function ymd(y, m, d) {
    y = Number(y);
    m = Number(m);
    d = Number(d);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || y < 1900 || y > 2199 || m < 1 || m > 12 || d < 1) return null;
    const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    if (d > days) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  /** The kind of statement a text holds, from its content (never the file name): 'ofx', 'bai2', 'csv' or ''. */
  function detect(text) {
    const s = String(text == null ? '' : text).replace(/^﻿/, '');
    const head = s.replace(/^\s+/, '');
    if (!head || /^%PDF/.test(head) || s.indexOf('\u0000') >= 0) return '';
    if (/^OFXHEADER\s*:/i.test(head) || /<OFX>/i.test(s.slice(0, 4096))) return 'ofx';
    const first = head.split(/\r\n|\r|\n/, 1)[0];
    if (/^01,/.test(first) && /\/\s*$/.test(first)) return 'bai2';
    const rows = csvRows(head.slice(0, 8192)).filter((r) => r.length);
    if (rows.length >= 2 && rows[0].length >= 2 && rows[1].length >= 2) return 'csv';
    return '';
  }

  // ---- CSV -------------------------------------------------------------------------------------------------------

  /**
   * Rows of cells, split as assets/js/invitations.js csvRows splits a pasted list (copied here: that one is private):
   * commas or tabs, or semicolons when the first line has neither; quotes, with "" for a quote; a byte-order mark
   * dropped; cells trimmed; an empty line is an empty row.
   */
  function csvRows(text) {
    const s = String(text || '').replace(/^﻿/, '');
    const head = s.split(/\r?\n/, 1)[0] || '';
    const semi = !/[,\t]/.test(head) && head.indexOf(';') >= 0;
    const sep = (c) => c === ',' || c === '\t' || (semi && c === ';');
    const rows = [];
    let row = [];
    let cur = '';
    let q = false;
    const endRow = () => {
      row.push(cur.trim());
      rows.push(row.length === 1 && !row[0] ? [] : row);
      row = [];
      cur = '';
    };
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === '"' && s[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') q = false;
        else cur += c === '\r' || c === '\n' ? ' ' : c;
      } else if (c === '"') q = true;
      else if (sep(c)) {
        row.push(cur.trim());
        cur = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        endRow();
      } else cur += c;
    }
    if (cur || row.length) endRow();
    return rows;
  }

  const ORDERS = { mdy: 'month/day/year', dmy: 'day/month/year', ymd: 'year-month-day' };
  /** A date cell in the given order as 'YYYY-MM-DD', or null. YYYYMMDD and a leading four-digit year read in any order. */
  function csvDate(cell, order) {
    const s = String(cell || '')
      .trim()
      .replace(/[ T]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(\s?[AaPp][Mm])?$/, '');
    let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
    if (m) return ymd(m[1], m[2], m[3]);
    m = /^(\d{1,4})([/.-])(\d{1,2})\2(\d{1,4})$/.exec(s);
    if (!m) return null;
    const [a, b, c] = [m[1], m[3], m[4]];
    if (a.length === 4) return ymd(a, b, c);
    if (order === 'ymd' || a.length > 2 || (c.length !== 2 && c.length !== 4)) return null;
    const y = c.length === 2 ? 2000 + Number(c) : c;
    return order === 'dmy' ? ymd(y, b, a) : ymd(y, a, b);
  }
  const anyDate = (cell) => !!(csvDate(cell, 'mdy') || csvDate(cell, 'dmy'));

  /**
   * The column map a CSV most likely uses, guessed from the header row and the values, for the sponsor to confirm:
   * { date, text, amount | (in and out), balance, check, header, order, outNegative }; a column not found is null.
   * Takes the rows or the text.
   */
  function csvGuess(input) {
    const rows = (typeof input === 'string' ? csvRows(input) : input || []).filter((r) => r && r.length);
    const map = { date: null, text: null, amount: null, in: null, out: null, balance: null, check: null, header: false, order: 'mdy', outNegative: true };
    if (!rows.length) return map;
    const first = rows[0];
    map.header = !first.some((c) => anyDate(c) || (c !== '' && cents(c) !== null));
    const body = map.header ? rows.slice(1) : rows;
    const width = Math.max.apply(null, rows.map((r) => r.length));
    const col = (i) => body.map((r) => (r[i] === undefined ? '' : r[i]));
    const taken = new Set();
    const pick = (re, skip) => {
      if (!map.header) return null;
      for (let i = 0; i < first.length; i++) if (!taken.has(i) && re.test(first[i].toLowerCase()) && !(skip && skip.test(first[i].toLowerCase()))) return (taken.add(i), i);
      return null;
    };
    if (map.header) {
      map.date = pick(/date|posted/);
      map.balance = pick(/balance/);
      map.check = pick(/check|cheque|chq/);
      map.amount = pick(/amount/, /credit|debit/);
      if (map.amount === null) {
        map.in = pick(/credit|deposit|money in|paid in|^in$/);
        map.out = pick(/debit|withdraw|money out|paid out|^out$/);
        if (map.in === null || map.out === null) map.in = map.out = null;
      }
      map.text = pick(/desc|detail|memo|narrat|payee|particular|transaction|name/);
    }
    const filled = (i) => col(i).filter((c) => c !== '');
    if (map.date === null) {
      for (let i = 0; i < width && map.date === null; i++) if (!taken.has(i) && filled(i).length && filled(i).every(anyDate)) (map.date = i), taken.add(i);
    }
    if (map.amount === null && map.in === null) {
      const nums = [];
      for (let i = 0; i < width; i++) if (!taken.has(i) && filled(i).length && filled(i).every((c) => cents(c) !== null)) nums.push(i);
      if (nums.length) (map.amount = nums[0]), taken.add(nums[0]);
      if (nums.length > 1 && map.balance === null) (map.balance = nums[nums.length - 1]), taken.add(map.balance);
    }
    if (map.text === null) {
      let best = -1;
      for (let i = 0; i < width; i++) {
        if (taken.has(i)) continue;
        const len = col(i).reduce((a, c) => a + c.replace(/[^A-Za-z]/g, '').length, 0);
        if (len > best) (best = len), (map.text = i);
      }
      if (best <= 0) map.text = null;
    }
    if (map.date !== null) {
      const dates = col(map.date).filter((c) => c !== '');
      const parts = dates.map((c) => /^(\d{1,4})[/.-](\d{1,2})[/.-]\d{1,4}/.exec(c.trim())).filter(Boolean);
      if (dates.length && dates.every((c) => /^\d{4}/.test(c.trim()))) map.order = 'ymd';
      else if (parts.some((p) => Number(p[1]) > 12)) map.order = 'dmy';
      else map.order = 'mdy';
    }
    return map;
  }

  const isCol = (v) => Number.isInteger(v) && v >= 0;

  /** A CSV statement read with a column map (the sponsor's, or the guess when none is given). */
  function csvStatement(s, given) {
    const rows = csvRows(s);
    const guess = csvGuess(rows);
    const map = Object.assign({}, given || guess);
    ['header', 'order', 'outNegative'].forEach((k) => {
      if (map[k] === undefined) map[k] = guess[k];
    });
    const signed = isCol(map.amount);
    if (!isCol(map.date) || !isCol(map.text) || !(signed || (isCol(map.in) && isCol(map.out)))) refuse('Choose which columns hold the date, the description and the amount (or money in and money out) before the file is read.');
    if (!ORDERS[map.order]) refuse('Choose the order the dates are written in: month/day/year, day/month/year or year-month-day.');
    const hasBalance = isCol(map.balance);
    const lines = [];
    let skipped = !map.header;
    rows.forEach((r, i) => {
      if (!r.length) return;
      if (!skipped) return (skipped = true);
      const row = i + 1;
      const cell = (k) => (isCol(map[k]) && r[map[k]] !== undefined ? r[map[k]] : '');
      const date = csvDate(cell('date'), map.order);
      if (!date) refuse(`Row ${row}: '${cell('date')}' is not a date that exists, read as ${ORDERS[map.order]}.`);
      let v;
      if (signed) {
        v = cents(cell('amount'));
        if (v === null) refuse(`Row ${row}: the amount '${cell('amount')}' is not an amount in dollars and cents.`);
        if (!map.outNegative) v = v ? -v : 0;
      } else {
        const a = cell('in') === '' ? 0 : cents(cell('in'));
        const b = cell('out') === '' ? 0 : cents(cell('out'));
        if (a === null) refuse(`Row ${row}: the money in '${cell('in')}' is not an amount in dollars and cents.`);
        if (b === null) refuse(`Row ${row}: the money out '${cell('out')}' is not an amount in dollars and cents.`);
        if (cell('in') === '' && cell('out') === '') refuse(`Row ${row} has no amount in either money in or money out.`);
        if (a && b) refuse(`Row ${row} has an amount in both money in and money out.`);
        v = a - Math.abs(b);
      }
      let balance = null;
      if (hasBalance && cell('balance') !== '') {
        balance = cents(cell('balance'));
        if (balance === null) refuse(`Row ${row}: the balance '${cell('balance')}' is not an amount in dollars and cents.`);
      }
      lines.push({ date, cents: v, text: cell('text'), ref: cell('check'), balance });
    });
    if (!lines.length) refuse('This file holds no transactions.');
    // A file listed newest first is turned round, so lines run oldest first and the closing balance is the latest.
    if (lines.length > 1 && lines[0].date > lines[lines.length - 1].date) lines.reverse();
    const lastBal = lines[lines.length - 1].balance;
    return [{ acct: '', currency: '', openingCents: null, closingCents: hasBalance && lastBal !== null ? lastBal : null, lines: lines.map((l) => ({ date: l.date, cents: l.cents, text: l.text, ref: l.ref })) }];
  }

  // ---- BAI2 ------------------------------------------------------------------------------------------------------

  const baiDate = (s) => {
    const m = /^(\d{2})(\d{2})(\d{2})$/.exec(s || '');
    return m ? ymd(2000 + Number(m[1]), m[2], m[3]) : null;
  };
  const money = (v) => {
    const neg = v < 0;
    const a = String(Math.abs(v)).padStart(3, '0');
    return `${neg ? '-' : ''}${plainNumber(a.slice(0, -2))}.${a.slice(-2)}`;
  };
  /** A signed whole number field ('+000123', '-5', '' is 0); null when it is not one or too large. */
  function baiInt(f, unsigned) {
    const s = String(f === undefined ? '' : f).trim();
    if (s === '') return 0;
    if (!(unsigned ? /^\d+$/ : /^[+-]?\d+$/).test(s)) return null;
    const v = Number(s.replace(/^\+/, ''));
    return Number.isSafeInteger(v) ? (v === 0 ? 0 : v) : null;
  }
  /** A sum that stays exact; a file whose amounts would not is refused. */
  const add = (a, b) => {
    const v = a + b;
    if (!Number.isSafeInteger(v)) refuse('The amounts in this file are too large to add up exactly, so nothing was read.');
    return v;
  };
  const FUNDS = { '': 0, Z: 0, 0: 0, 1: 0, 2: 0, V: 2, S: 3 };

  /** Reads the funds type and the fields it brings; returns false when the funds type is not one BAI2 defines. */
  function skipFunds(next, ft) {
    if (ft === 'D') {
      const n = baiInt(next(), true);
      if (n === null) return false;
      for (let k = 0; k < 2 * n; k++) next();
      return true;
    }
    if (!(ft in FUNDS)) return false;
    for (let k = 0; k < FUNDS[ft]; k++) next();
    return true;
  }

  /**
   * A BAI2 file's accounts, every trailer checked. Records end with '/'; an 88 record continues the record before it
   * (its fields follow on); a 16 record's text runs to the end of its record. A file whose trailers do not agree with
   * what was read is refused: that is the format's own proof of a complete read.
   */
  function baiStatements(s) {
    const physical = s.split(/\r\n|\r|\n/);
    const recs = [];
    physical.forEach((raw, i) => {
      const line = raw.replace(/\s+$/, '');
      if (!line) return;
      const m = /^(\d{2}),?(.*)$/.exec(line);
      if (!m) refuse(`Line ${i + 1} of this BAI2 file is not a record.`);
      const code = m[1];
      if (code === '88') {
        const prev = recs[recs.length - 1];
        if (!prev) refuse('This BAI2 file starts with a continuation record.');
        prev.parts.push(prev.code === '16' ? m[2].replace(/\/$/, '') : m[2].split('/')[0]);
        prev.n++;
        return;
      }
      recs.push({ code, parts: [code === '16' ? m[2].replace(/\/$/, '') : m[2].split('/')[0]], n: 1, line: i + 1 });
    });
    if (!recs.length || recs[0].code !== '01') refuse('This file does not start with a BAI2 file header.');
    const fields = (r) => r.parts.join(',').split(',');
    const accounts = [];
    const trailers = { account: 0, group: 0, file: 0 };
    let group = null;
    let acct = null;
    let file = { total: 0, groups: 0, n: recs[0].n };
    let ended = false;
    for (let k = 1; k < recs.length; k++) {
      const r = recs[k];
      if (ended) refuse(`This BAI2 file has records after its file trailer (line ${r.line}).`);
      if (r.code === '02') {
        if (group) refuse(`The group that starts on line ${r.line} begins before the group trailer of the one before it.`);
        const f = fields(r);
        const asOf = baiDate(f[3]);
        if (!asOf) refuse(`The group header on line ${r.line} has the date '${f[3] || ''}', which is not a date that exists.`);
        group = { asOf, currency: f[5] || '', total: 0, accounts: 0, n: r.n };
      } else if (r.code === '03') {
        if (!group || acct) refuse(`The account record on line ${r.line} is outside a group, or before the account trailer of the account before it.`);
        const f = fields(r);
        let i = 2;
        const next = () => f[i++];
        acct = { number: f[0] || '', currency: f[1] || group.currency || 'USD', total: 0, n: r.n, opening: null, closing: null, lines: [] };
        while (i < f.length) {
          const type = next();
          const amt = next();
          const count = next();
          const ft = next() || '';
          if ((type === '' || type === undefined) && !amt && !count && !ft) continue;
          if (!/^\d{3}$/.test(type || '')) refuse(`The account record on line ${r.line} has the summary code '${type || ''}', which is not a BAI2 code.`);
          const v = baiInt(amt);
          if (v === null) refuse(`The account record on line ${r.line} has the amount '${amt}', which is not a whole number of cents.`);
          if (!skipFunds(next, ft)) refuse(`The account record on line ${r.line} has the funds type '${ft}', which BAI2 does not define.`);
          acct.total = add(acct.total, v);
          if (type === '010' && acct.opening === null && amt !== '' && amt !== undefined) acct.opening = v;
          if (type === '015' && amt !== '' && amt !== undefined) acct.closing = v;
        }
      } else if (r.code === '16') {
        if (!acct) refuse(`The transaction on line ${r.line} is outside an account.`);
        let pi = 0;
        let fl = r.parts[0].split(',');
        let fi = 0;
        const next = () => {
          while (fi >= fl.length) {
            if (++pi >= r.parts.length) return '';
            fl = r.parts[pi].split(',');
            fi = 0;
          }
          return fl[fi++];
        };
        const type = next();
        const amt = next();
        const ft = next() || '';
        const code = Number(type);
        if (!/^\d{3}$/.test(type)) refuse(`The transaction on line ${r.line} has the type code '${type}', which is not a BAI2 code.`);
        const v = baiInt(amt, true);
        if (v === null || amt === '') refuse(`The transaction on line ${r.line} has the amount '${amt}', which is not a whole number of cents.`);
        let valueDate = '';
        if (ft === 'V') {
          valueDate = next();
          next();
        } else if (!skipFunds(next, ft)) refuse(`The transaction on line ${r.line} has the funds type '${ft}', which BAI2 does not define.`);
        const bankRef = (next() || '').trim();
        const custRef = (next() || '').trim();
        let pieces;
        if (fi < fl.length) pieces = [fl.slice(fi).join(',')].concat(r.parts.slice(pi + 1));
        else pieces = r.parts.slice(pi + 1);
        const text = pieces.map((x) => x.trim()).filter(Boolean).join(' ');
        if (!(code >= 100 && code <= 699)) refuse(`The transaction on line ${r.line} has the type code ${type}, which this portal does not read as money in or money out.`);
        const date = valueDate ? baiDate(valueDate) : group.asOf;
        if (!date) refuse(`The transaction on line ${r.line} has the value date '${valueDate}', which is not a date that exists.`);
        acct.total = add(acct.total, v);
        acct.n += r.n;
        acct.lines.push({ date, cents: code < 400 ? v : -v, text, ref: custRef || bankRef, bankId: bankRef });
      } else if (r.code === '49') {
        if (!acct) refuse(`The account trailer on line ${r.line} closes no account.`);
        const f = fields(r);
        const total = baiInt(f[0]);
        const count = baiInt(f[1], true);
        acct.n += r.n;
        const who = `for the account ending ${last4Of(acct.number) || '(no number)'}`;
        if (total === null || count === null || f[0] === '' || f[1] === undefined || f[1] === '') refuse(`The account trailer ${who} on line ${r.line} cannot be read, so nothing was read.`);
        if (total !== acct.total) refuse(`The account trailer ${who} says its amounts add up to ${money(total)}, but they add up to ${money(acct.total)}: the file is damaged or incomplete, so nothing was read.`);
        if (count !== acct.n) refuse(`The account trailer ${who} says it has ${count} records, but ${acct.n} were read: the file is damaged or incomplete, so nothing was read.`);
        trailers.account++;
        group.total = add(group.total, acct.total);
        group.accounts++;
        group.n += acct.n;
        accounts.push({ acct: acct.number, currency: acct.currency, openingCents: acct.opening, closingCents: acct.closing, lines: acct.lines });
        acct = null;
      } else if (r.code === '98') {
        if (acct) refuse(`The account ending ${last4Of(acct.number) || '(no number)'} has no account trailer, so nothing was read.`);
        if (!group) refuse(`The group trailer on line ${r.line} closes no group.`);
        const f = fields(r);
        const total = baiInt(f[0]);
        const nAcc = baiInt(f[1], true);
        const count = baiInt(f[2], true);
        group.n += r.n;
        if (total === null || nAcc === null || count === null || f[0] === '' || !f[1] || !f[2]) refuse(`The group trailer on line ${r.line} cannot be read, so nothing was read.`);
        if (total !== group.total) refuse(`The group trailer on line ${r.line} says its amounts add up to ${money(total)}, but they add up to ${money(group.total)}: the file is damaged or incomplete, so nothing was read.`);
        if (nAcc !== group.accounts) refuse(`The group trailer on line ${r.line} says it has ${nAcc} accounts, but ${group.accounts} were read: the file is damaged or incomplete, so nothing was read.`);
        if (count !== group.n) refuse(`The group trailer on line ${r.line} says it has ${count} records, but ${group.n} were read: the file is damaged or incomplete, so nothing was read.`);
        trailers.group++;
        file.total = add(file.total, group.total);
        file.groups++;
        file.n += group.n;
        group = null;
      } else if (r.code === '99') {
        if (acct || group) refuse(`The file trailer on line ${r.line} comes before the account or group trailer it should follow, so nothing was read.`);
        const f = fields(r);
        const total = baiInt(f[0]);
        const nGr = baiInt(f[1], true);
        const count = baiInt(f[2], true);
        file.n += r.n;
        if (total === null || nGr === null || count === null || f[0] === '' || !f[1] || !f[2]) refuse(`The file trailer on line ${r.line} cannot be read, so nothing was read.`);
        if (total !== file.total) refuse(`The file trailer says its amounts add up to ${money(total)}, but they add up to ${money(file.total)}: the file is damaged or incomplete, so nothing was read.`);
        if (nGr !== file.groups) refuse(`The file trailer says it has ${nGr} groups, but ${file.groups} were read: the file is damaged or incomplete, so nothing was read.`);
        if (count !== file.n) refuse(`The file trailer says it has ${count} records, but ${file.n} were read: the file is damaged or incomplete, so nothing was read.`);
        trailers.file++;
        ended = true;
      } else if (r.code === '01') refuse(`This BAI2 file has a second file header on line ${r.line}.`);
      else refuse(`Line ${r.line} of this BAI2 file has the record code ${r.code}, which BAI2 does not define.`);
    }
    if (!ended) refuse('This BAI2 file has no file trailer: it may have been cut short, so nothing was read.');
    if (!accounts.length) refuse('This BAI2 file holds no account.');
    return { parts: accounts, trailers };
  }

  // ---- OFX -------------------------------------------------------------------------------------------------------

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const decode = (v) => v.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e]);

  /** OFX as a list of tokens: { open: TAG } | { close: TAG } | { text }. Processing instructions and comments are skipped. */
  function ofxTokens(s) {
    const out = [];
    let i = s.indexOf('<');
    if (i < 0) refuse('This OFX file holds no statement.');
    while (i < s.length) {
      if (s[i] !== '<') {
        const j = s.indexOf('<', i);
        const end = j < 0 ? s.length : j;
        out.push({ text: s.slice(i, end) });
        i = end;
        continue;
      }
      if (s.startsWith('<?', i) || s.startsWith('<!--', i) || s.startsWith('<!', i)) {
        const close = s.startsWith('<?', i) ? '?>' : s.startsWith('<!--', i) ? '-->' : '>';
        const j = s.indexOf(close, i);
        if (j < 0) refuse('This OFX file is damaged: it ends inside a tag.');
        i = j + close.length;
        continue;
      }
      if (s.indexOf('>', i) < 0) refuse('This OFX file ends inside a tag: it may have been cut short, so nothing was read.');
      const m = /^<(\/?)([A-Za-z0-9._]+)\s*>/.exec(s.slice(i, i + 80));
      if (!m) refuse('This OFX file is damaged: it has a tag that cannot be read.');
      out.push(m[1] ? { close: m[2].toUpperCase() } : { open: m[2].toUpperCase() });
      i += m[0].length;
    }
    return out;
  }

  /**
   * The statements in an OFX file, older layout or newer: [{ acct, currency, closingCents, txs: [{ date, cents, text,
   * ref, bankId }] }]. A value tag is an opening tag followed by text (its closing tag, when there is one, is skipped);
   * a container is an opening tag followed by another tag, and must be closed.
   */
  function ofxStatements(s) {
    const t = ofxTokens(s);
    const stack = [];
    const statements = [];
    let st = null;
    const top = () => stack[stack.length - 1];
    for (let k = 0; k < t.length; k++) {
      const tok = t[k];
      if (tok.text !== undefined) {
        if (tok.text.trim()) refuse('This OFX file is damaged: it has text outside any tag.');
        continue;
      }
      if (tok.open) {
        let v = null;
        let n = k + 1;
        if (t[n] && t[n].text !== undefined) {
          if (t[n].text.trim()) v = t[n].text;
          n++;
        }
        if (t[n] && t[n].close === tok.open) {
          if (v === null) v = (t[k + 1] && t[k + 1].text) || '';
          n++;
        } else if (v === null) {
          stack.push({ tag: tok.open, leaves: {} });
          if ((tok.open === 'STMTRS' || tok.open === 'CCSTMTRS') && !st) st = { acct: '', currency: '', closingCents: null, txs: [] };
          continue;
        }
        if (!stack.length) refuse('This OFX file is damaged: it has a value outside the statement.');
        top().leaves[tok.open] = decode(v.trim());
        k = n - 1;
        continue;
      }
      // A closing tag: it closes the innermost container, which must have the same name.
      const c = stack.pop();
      if (!c || c.tag !== tok.close) refuse(`This OFX file is damaged: <${tok.close}> is closed where <${c ? c.tag : 'nothing'}> is open.`);
      const L = c.leaves;
      const parent = top();
      if (c.tag === 'PAYEE' && parent && parent.tag === 'STMTTRN' && L.NAME && !parent.leaves.NAME) parent.leaves.NAME = L.NAME;
      if (!st) continue;
      if ((c.tag === 'BANKACCTFROM' || c.tag === 'CCACCTFROM') && L.ACCTID !== undefined && parent && (parent.tag === 'STMTRS' || parent.tag === 'CCSTMTRS')) st.acct = L.ACCTID;
      if (c.tag === 'LEDGERBAL' && parent && (parent.tag === 'STMTRS' || parent.tag === 'CCSTMTRS')) {
        const v = cents(L.BALAMT);
        if (v === null) refuse(`The ledger balance in this file, '${L.BALAMT || ''}', is not an amount in dollars and cents.`);
        st.closingCents = v;
      }
      if (c.tag === 'STMTTRN') {
        const v = cents(L.TRNAMT);
        if (v === null) refuse(`A transaction in this file has the amount '${L.TRNAMT || ''}', which is not an amount in dollars and cents.`);
        const d = /^(\d{4})(\d{2})(\d{2})/.exec(L.DTPOSTED || '');
        const date = d && ymd(d[1], d[2], d[3]);
        if (!date) refuse(`A transaction in this file has the date '${L.DTPOSTED || ''}', which is not a date that exists.`);
        st.txs.push({ date, cents: v, text: [L.NAME, L.MEMO].filter((x) => x && x.trim()).map((x) => x.trim()).join(' '), ref: L.CHECKNUM || L.REFNUM || '', bankId: L.FITID || '' });
      }
      if (c.tag === 'STMTRS' || c.tag === 'CCSTMTRS') {
        st.currency = L.CURDEF || '';
        statements.push(st);
        st = null;
      }
    }
    if (stack.length) refuse('This OFX file ends before its statement is complete: it may have been cut short, so nothing was read.');
    if (!statements.length) refuse('This OFX file holds no bank or card statement.');
    return statements.map((x) => ({ acct: x.acct, currency: x.currency, openingCents: null, closingCents: x.closingCents, lines: x.txs }));
  }

  // ---- One statement from a file's accounts ------------------------------------------------------------------------

  const last4Of = (acct) => String(acct || '').replace(/\D/g, '').slice(-4);

  /**
   * The statement parse returns. One account: its last four, currency and balances. Several accounts in one file (a
   * treasury BAI2 file often holds many): every line carries its account's last four, the top level has no account and
   * no balances, and accounts lists each; opts.account (last four digits) keeps one account only.
   */
  function statementOf(kind, parts, opts) {
    const byKey = new Map();
    parts.forEach((p) => {
      const key = String(p.acct || '');
      const a = byKey.get(key);
      if (!a) byKey.set(key, { last4: last4Of(key), currency: p.currency, openingCents: p.openingCents, closingCents: p.closingCents, lines: p.lines.slice() });
      else {
        if (a.openingCents === null) a.openingCents = p.openingCents;
        if (p.closingCents !== null) a.closingCents = p.closingCents;
        a.lines = a.lines.concat(p.lines);
      }
    });
    let accounts = Array.from(byKey.values());
    if (opts && opts.account) {
      accounts = accounts.filter((a) => a.last4 === String(opts.account));
      if (!accounts.length) refuse(`This file holds no account ending ${opts.account}.`);
    }
    const one = accounts.length === 1 ? accounts[0] : null;
    const lines = [];
    accounts.forEach((a) => a.lines.forEach((l) => lines.push(one ? l : Object.assign({}, l, { last4: a.last4 }))));
    if (lines.length > LIMITS.lines) refuse(`This file has more than ${plainNumber(LIMITS.lines)} transactions; download a shorter period from the bank.`);
    const dates = lines.map((l) => l.date).sort();
    const currencies = Array.from(new Set(accounts.map((a) => a.currency)));
    return {
      kind,
      last4: one ? one.last4 : '',
      currency: currencies.length === 1 ? currencies[0] : '',
      from: dates.length ? dates[0] : null,
      to: dates.length ? dates[dates.length - 1] : null,
      openingCents: one ? one.openingCents : null,
      closingCents: one ? one.closingCents : null,
      lines: lineIds(lines),
      accounts: accounts.map((a) => ({ last4: a.last4, currency: a.currency, openingCents: a.openingCents, closingCents: a.closingCents, lines: a.lines.length }))
    };
  }

  /**
   * The same lines with id set, the same every time the file is read: 'f:' + the bank's own id for the line (OFX
   * FITID, BAI2 bank reference) when it has one that no other line in the file shares; otherwise 'h:' + the first 16
   * hex digits of sha256(date|cents|text|n), n counting lines of identical date, cents and text from 0 in order.
   * Recognising a statement imported twice is books-bank.js's (plan 11-08); this gives the ids only.
   */
  function lineIds(lines) {
    if (!NS.audit || typeof NS.audit.sha256 !== 'function') refuse('The statement reader needs the audit module, which is not loaded.');
    const uses = new Map();
    lines.forEach((l) => {
      if (l.bankId) uses.set(l.bankId, (uses.get(l.bankId) || 0) + 1);
    });
    const seen = new Map();
    return lines.map((l) => {
      const key = `${l.date}|${l.cents}|${l.text}`;
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      const id = l.bankId && uses.get(l.bankId) === 1 ? 'f:' + l.bankId : 'h:' + NS.audit.sha256(`${key}|${n}`).slice(0, 16);
      return Object.assign({}, l, { id });
    });
  }

  /**
   * A statement file's text as { kind, last4, currency, from, to, openingCents, closingCents, lines, accounts }, and for
   * BAI2 trailers: { account, group, file }, the number of trailers checked. Each line is { id, date, cents, text, ref,
   * bankId } (plus last4 when the file holds several accounts). opts: { kind } to skip detection, { map } for a CSV
   * (the guess is used when none is given), { account } to keep one account of several. openingCents and closingCents
   * are null when the file does not carry them (a CSV carries a closing balance only in a balance column). Throws one
   * plain sentence on any refusal; a file that is refused returns nothing.
   */
  function parse(text, opts) {
    const o = opts || {};
    if (typeof text !== 'string') refuse('The statement could not be read as text.');
    if (utf8Bytes(text) > LIMITS.bytes) refuse(`This file is larger than ${LIMITS.bytes / 1000000} MB; download a shorter period from the bank.`);
    if (lineCount(text) > LIMITS.lines) refuse(`This file has more than ${plainNumber(LIMITS.lines)} lines; download a shorter period from the bank.`);
    const s = text.replace(/^﻿/, '');
    const kind = o.kind || detect(s);
    if (kind === 'ofx') return statementOf('ofx', ofxStatements(s), o);
    if (kind === 'csv') return statementOf('csv', csvStatement(s, o.map), o);
    if (kind === 'bai2') {
      const b = baiStatements(s);
      return Object.assign(statementOf('bai2', b.parts, o), { trailers: b.trailers });
    }
    refuse(`This file is not a bank statement the portal can read; download it from the bank as ${KINDS}.`);
  }

  NS.bankFiles = { LIMITS, detect, parse, csvGuess, csvRows, cents, lineIds };
})((window.CVPortal = window.CVPortal || {}));
