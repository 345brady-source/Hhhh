/*
 * Returns and notifications of change: what the sponsor's bank sends back about the payment files the portal built,
 * read in the browser with no network into plain items (plan 16-06). Three ways in, in order of exactness: a NACHA
 * return or notification-of-change file (addenda 99 and 98), a CSV returns report read through a column map the
 * sponsor confirms (phase 11's NS.bankFiles.csvRows splits it), or one return entered by hand.
 *
 * Pure functions. Nothing here fetches, stores, logs, uses the browser's XML or DOM parser or evaluates any part of a
 * file. Matching items to investors and payments, and what they change, is achmatch.js (plan 16-08); the screen is
 * plan 16-11.
 *
 * Privacy: a return file carries full account numbers. An item keeps the last four digits of the account only. A
 * notification of change's corrected number is kept in the item's corrected block, in memory, for the sponsor to
 * confirm (16-08); nothing else holds a full number.
 *
 * Sources: record positions as the open-source reader the phase 16 checks pin parses them (16-RESEARCH 6.1;
 * Apache-2.0), which follow Nacha's return format: the original batch header and entry are copied back, the entry's
 * transaction code becomes 21 or 31 (26 or 36 for debits), addenda indicator 1, a new trace, then the addenda.
 * Code titles are Nacha's, as that project's tables give them. No bank's own returns export has been read yet: the
 * CSV header words are a guess the sponsor confirms (To be confirmed with the owner's bank, plan 16-14).
 */
(function (NS) {
  'use strict';

  /** Refusal limits, checked before anything is parsed (the statement reader's, when it is loaded). */
  const LIMITS = (NS.bankFiles && NS.bankFiles.LIMITS) || Object.freeze({ bytes: 2000000, lines: 20000 });

  const refuse = (sentence) => {
    throw new Error(sentence);
  };
  const plainNumber = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // ---- the code tables ---------------------------------------------------------------------------------------------

  /** Return codes (16-RESEARCH 3.4): Nacha's title, the plain sentence a sponsor reads, the action class 16-08 applies. */
  const R = (title, words, action) => Object.freeze({ title, words, action });
  const RETURN_CODES = Object.freeze({
    R01: R('Insufficient Funds', 'The account did not have enough money for a debit.', 'debit-only'),
    R02: R('Account Closed', 'The investor closed this bank account.', 'needs-details'),
    R03: R('No Account/Unable to Locate Account', 'The bank could not find an account with this number under this name.', 'needs-details'),
    R04: R('Invalid Account Number', 'The account number is not a valid number at this bank.', 'needs-details'),
    R05: R('Improper Debit to Consumer Account', 'A business debit was sent to a personal account without its owner\'s permission.', 'debit-only'),
    R06: R("Returned per ODFI's Request", 'Your own bank asked for this payment back.', 'no-change'),
    R07: R('Authorization Revoked by Customer', 'The account holder took back permission for debits.', 'debit-only'),
    R08: R('Payment Stopped', 'The account holder stopped this payment.', 'debit-only'),
    R09: R('Uncollected Funds', "The account's money was not yet available for a debit.", 'debit-only'),
    R10: R('Customer Advises Originator is Not Known to Receiver and/or Originator is Not Authorized by Receiver to Debit Receiver’s Account', 'The account holder says it did not allow this debit.', 'debit-only'),
    R11: R('Customer Advises Entry Not in Accordance with the Terms of the Authorization', 'The account holder says the debit did not match what was agreed.', 'debit-only'),
    R12: R('Branch Sold to Another DFI', 'The bank branch was sold to another bank, so new bank details are needed.', 'needs-details'),
    R13: R('RDFI not qualified to participate', 'The receiving bank does not take these payments.', 'needs-details'),
    R14: R('Representative payee deceased or unable to continue in that capacity', 'The person who received payments for the investor has died or can no longer act.', 'contact'),
    R15: R('Beneficiary or bank account holder (other than representative payee) deceased', 'The investor or the account holder has died.', 'contact'),
    R16: R('Bank account frozen', 'The bank has frozen this account.', 'frozen'),
    R17: R('File Record Edit Criteria/Entry with Invalid Account Number Initiated Under Questionable Circumstances', 'The bank flagged this payment as questionable.', 'flagged'),
    R18: R('Improper effective entry date', "The file's effective date was wrong for this payment.", 'format'),
    R19: R('Amount field error', 'The amount in the file was not written correctly.', 'format'),
    R20: R('Non-payment bank account', 'This account cannot receive payments.', 'needs-details'),
    R23: R('Credit entry refused by receiver', 'The investor refused this payment.', 'refused'),
    R24: R('Duplicate entry', 'The bank received this same payment twice.', 'no-change'),
    R25: R('Addenda error', 'An addenda record in the file was not written correctly.', 'format'),
    R26: R('Mandatory field error', 'A required field in the file was missing or wrong.', 'format'),
    R27: R('Trace number error', 'A trace number in the file was wrong.', 'format'),
    R28: R('Transit routing number check digit error', "The routing number's check digit is wrong.", 'needs-details'),
    R29: R('Corporate customer advises not authorized', 'The business says it did not allow this debit.', 'debit-only'),
    R61: R('Misrouted Return', 'A return between the banks went to the wrong bank.', 'text-only'),
    R62: R('Return of Erroneous or Reversing Debit', 'A reversal between the banks was returned.', 'text-only'),
    R67: R('Duplicate Return', 'The bank received this return twice.', 'text-only'),
    R68: R('Untimely Return', 'A return was sent too late.', 'text-only'),
    R69: R('Field Error(s)', 'A return had a field error.', 'text-only'),
    R70: R('Permissible Return Entry Not Accepted/Return Not Requested by ODFI', 'The bank did not accept a return it had not asked for.', 'text-only'),
    R71: R('Misrouted Dishonored Return', 'A refused return went to the wrong bank.', 'text-only'),
    R72: R('Untimely Dishonored Return', 'A refused return was sent too late.', 'text-only'),
    R73: R('Timely Original Return', 'The receiving bank says its return was on time.', 'text-only'),
    R74: R('Corrected Return', 'The receiving bank corrected an earlier return.', 'text-only'),
    R75: R('Return Not a Duplicate', 'The receiving bank says its return was not a repeat.', 'text-only'),
    R76: R('No Errors Found', 'The receiving bank found no error in its return.', 'text-only'),
    R77: R('Non-Acceptance of R62 Dishonored Return', 'The receiving bank did not accept a refused reversal.', 'text-only'),
    R80: R('IAT Entry Coding Error', 'An international payment was coded wrongly.', 'needs-details'),
    R81: R('Non-Participant in IAT Program', 'The bank does not take part in international payments.', 'needs-details'),
    R82: R('Invalid Foreign Receiving DFI Identification', "The foreign bank's identification is not valid.", 'needs-details'),
    R83: R('Foreign Receiving DFI Unable to Settle', 'The foreign bank could not settle the payment.', 'needs-details'),
    R84: R('Entry Not Processed by Gateway', 'The international payment was not processed.', 'needs-details'),
    R85: R('Incorrectly Coded Outbound International Payment', 'The payment was going abroad but was not coded as international.', 'needs-details')
  });

  /**
   * Change codes (16-RESEARCH 3.5): Nacha's title, the sponsor's sentence, the fields the change corrects and the
   * action: 'change' (the sponsor confirms the corrected details, 16-08), 'shown' (C09, C13: nothing changes), 'wire'
   * (C14: the account is abroad), 'ignored' (C61-C69: refused changes between the banks, never the sponsor's).
   */
  const C = (title, words, fields, action) => Object.freeze({ title, words, fields: Object.freeze(fields), action });
  const between = 'A notice between the banks; nothing changes.';
  const NOC_CODES = Object.freeze({
    C01: C('Incorrect bank account number', 'The bank gave a corrected account number.', ['account'], 'change'),
    C02: C('Incorrect transit/routing number', 'The bank gave a corrected routing number.', ['routing'], 'change'),
    C03: C('Incorrect transit/routing number and bank account number', 'The bank gave a corrected routing number and account number.', ['routing', 'account'], 'change'),
    C04: C('Bank account name change', "The bank gave a corrected account holder's name.", ['holder'], 'change'),
    C05: C('Incorrect transaction code', 'The bank says the account type (checking or savings) is wrong.', ['type'], 'change'),
    C06: C('Incorrect bank account number and transit code', 'The bank gave a corrected account number and account type.', ['account', 'type'], 'change'),
    C07: C('Incorrect transit/routing number, bank account number and transaction code', 'The bank gave a corrected routing number, account number and account type.', ['routing', 'account', 'type'], 'change'),
    C09: C('Incorrect individual ID number', 'The bank says the investor ID in the file is wrong; nothing changes.', ['id'], 'shown'),
    C13: C('Addenda Format Error', 'The bank found an error in an addenda record; the payment was made.', [], 'shown'),
    C14: C('Incorrect SEC Code for outbound IAT payment', 'The account is abroad, so pay this investor by international wire.', [], 'wire'),
    C61: C('Misrouted Notification of Change', between, [], 'ignored'),
    C62: C('Incorrect Trace Number', between, [], 'ignored'),
    C63: C('Incorrect Company Identification Number', between, [], 'ignored'),
    C64: C('Incorrect Individual Identification Number or Identification Number', between, [], 'ignored'),
    C65: C('Incorrectly Formatted Corrected Data', between, [], 'ignored'),
    C66: C('Incorrect Discretionary Data', between, [], 'ignored'),
    C67: C('Routing Number not from Original Entry Detail Record', between, [], 'ignored'),
    C68: C('DFI Account Number not from Original Entry Detail Record', between, [], 'ignored'),
    C69: C('Incorrect Transaction Code', between, [], 'ignored')
  });

  /** The words and action of a code; an unknown code is shown with its code and the class 'unknown'. */
  function codeInfo(code, kind) {
    const c = kind === 'noc' ? NOC_CODES[code] : RETURN_CODES[code];
    if (c) return { words: c.words, action: c.action };
    if (kind === 'noc') return { words: `The bank sent a change with code ${code}, which the portal does not know; ask your bank what it means.`, action: 'unknown' };
    return { words: `The bank returned this payment with code ${code}, which the portal does not know; ask your bank what it means.`, action: 'unknown' };
  }
  /** 'return' for an R code, 'noc' for a C code, null for anything else. */
  const kindOf = (code) => (/^R\d{2}$/.test(code) ? 'return' : /^C\d{2}$/.test(code) ? 'noc' : null);

  // ---- corrected data ----------------------------------------------------------------------------------------------

  /** The ABA check digit (weights 3, 7, 1): the builder's own (nacha.js) when it is loaded. */
  function abaValid(r) {
    if (NS.nacha && typeof NS.nacha.abaValid === 'function') return /^\d{9}$/.test(String(r || '')) && NS.nacha.abaValid(r);
    const s = String(r || '');
    if (!/^\d{9}$/.test(s) || /^0{9}$/.test(s)) return false;
    const d = s.split('').map(Number);
    return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
  }
  const FIELD_WORDS = { account: 'account number', routing: 'routing number', type: 'account type', holder: "account holder's name", id: 'ID number' };
  /** The account type a transaction code names: 2x checking, 3x savings. */
  const typeOf = (tx) => (/^2\d$/.test(tx) ? 'checking' : /^3\d$/.test(tx) ? 'savings' : undefined);

  /**
   * A change's corrected data as { account?, routing?, type?, holder?, id?, problem? }, split as the open-source reader
   * splits it (16-RESEARCH 3.5 and the phase 16 plan check): C07's routing is the first 9 characters (no space before the
   * account), then the account and the transaction code by whitespace; C03 and C06 by whitespace (C06 also as 17
   * characters of account and then the code when no space parts them). problem is one sentence when a routing number
   * fails the check digit, an account number is not one, or a field the code corrects is missing; such a change is
   * never offered as good.
   */
  function corrected(code, text) {
    const c = String(code || '').trim().toUpperCase();
    const t = String(text == null ? '' : text);
    const parts = t.trim().split(/\s+/).filter(Boolean);
    const out = {};
    const set = (k, v) => {
      if (v !== undefined && v !== '') out[k] = v;
    };
    if (c === 'C01') set('account', parts[0]);
    else if (c === 'C02') set('routing', parts[0]);
    else if (c === 'C03') {
      set('routing', parts[0]);
      set('account', parts[1]);
    } else if (c === 'C04') set('holder', t.trim().replace(/\s+/g, ' ').slice(0, 22).trim());
    else if (c === 'C05') set('type', typeOf(parts[0] || ''));
    else if (c === 'C06') {
      const p = parts.length === 1 && parts[0].length > 17 ? [parts[0].slice(0, 17), parts[0].slice(17)] : parts;
      set('account', p[0]);
      set('type', typeOf(p[1] || ''));
    } else if (c === 'C07') {
      const s = t.replace(/^\s+/, '');
      set('routing', s.slice(0, 9).trim());
      const rest = s.slice(9).trim().split(/\s+/).filter(Boolean);
      set('account', rest[0]);
      set('type', typeOf(rest[1] || ''));
    } else if (c === 'C09') set('id', t.trim().slice(0, 22).trim());
    const need = (NOC_CODES[c] && NOC_CODES[c].fields) || [];
    const lacking = need.filter((f) => out[f] === undefined);
    if (out.routing !== undefined && !abaValid(out.routing)) out.problem = 'The corrected routing number fails the check digit.';
    else if (out.account !== undefined && !/^[A-Za-z0-9-]{1,17}$/.test(out.account)) out.problem = 'The corrected account number is not a bank account number.';
    else if (lacking.length) out.problem = `The corrected data is missing the ${FIELD_WORDS[lacking[0]]}.`;
    return out;
  }

  // ---- input -------------------------------------------------------------------------------------------------------

  /** UTF-8 byte length of a string, counted without an encoder (as bankfiles.js counts it). */
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
  const isBytes = (x) => x != null && typeof x === 'object' && typeof x.length === 'number' && typeof x.BYTES_PER_ELEMENT === 'number' && x.BYTES_PER_ELEMENT === 1;
  const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

  /**
   * The input as { text } or { refusal }: a string as given, a Uint8Array decoded as UTF-8 (a byte that is not UTF-8
   * makes it not text); the byte-order mark dropped. Limits and the PDF check come first, before anything is decoded.
   */
  function textOf(input) {
    const pdfSentence = 'This is a PDF. Download the returns report from your bank as a CSV or a NACHA file, or enter the return by hand.';
    if (isBytes(input)) {
      if (PDF.every((b, i) => input[i] === b)) return { refusal: pdfSentence };
      if (input.length > LIMITS.bytes) return { refusal: `This file is larger than ${plainNumber(LIMITS.bytes)} bytes.` };
      let text;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(input);
      } catch (e) {
        return { refusal: 'This file is not text.' };
      }
      return checked(text.replace(/^﻿/, ''), pdfSentence);
    }
    if (typeof input !== 'string') return { refusal: 'This file is not text.' };
    const s = input.replace(/^﻿/, '');
    if (s.slice(0, 5) === '%PDF-') return { refusal: pdfSentence };
    if (utf8Bytes(s) > LIMITS.bytes) return { refusal: `This file is larger than ${plainNumber(LIMITS.bytes)} bytes.` };
    return checked(s, pdfSentence);
  }
  function checked(s, pdfSentence) {
    if (s.slice(0, 5) === '%PDF-') return { refusal: pdfSentence };
    if (lineCount(s) > LIMITS.lines) return { refusal: `This file has more than ${plainNumber(LIMITS.lines)} lines.` };
    if (!s.trim()) return { refusal: 'This file is empty.' };
    // A NUL or another control character (other than tab, line breaks and form feed) means a binary file.
    if (/[\u0000-\u0008\u000B\u000E-\u001F\u007F]/.test(s)) return { refusal: 'This file is not text.' };
    return { text: s };
  }

  /** 'nacha' | 'csv' | 'pdf' | null, from the content (never the file name). */
  function detect(input) {
    if (isBytes(input) && PDF.every((b, i) => input[i] === b)) return 'pdf';
    let s;
    if (isBytes(input)) {
      try {
        s = new TextDecoder('utf-8', { fatal: true }).decode(input);
      } catch (e) {
        return null;
      }
    } else if (typeof input === 'string') s = input;
    else return null;
    s = s.replace(/^﻿/, '');
    if (s.slice(0, 5) === '%PDF-') return 'pdf';
    if (/\u0000/.test(s)) return null;
    const first = (s.split(/\r\n|\r|\n/).find((l) => l.trim() !== '') || '').replace(/^\s+/, '');
    if (!first) return null;
    if (first.slice(0, 3) === '101') return 'nacha';
    if (/[,;\t]/.test(first) && s.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '').length >= 2) return 'csv';
    return null;
  }

  // ---- NACHA -------------------------------------------------------------------------------------------------------

  /** A YYMMDD field as 'YYYY-MM-DD' (years 20YY), or null when it is blank or not a day. */
  function yymmdd(f) {
    if (!/^\d{6}$/.test(f)) return null;
    const y = 2000 + Number(f.slice(0, 2));
    const m = Number(f.slice(2, 4));
    const d = Number(f.slice(4, 6));
    if (m < 1 || m > 12 || d < 1) return null;
    const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    if (d > days) return null;
    return `${y}-${f.slice(2, 4)}-${f.slice(4, 6)}`;
  }

  /**
   * A NACHA return or notification-of-change file as { kind: 'nacha', items, fileDate }. Positions are 1-based in the
   * comments and 0-based in the slices. Every record must be 94 characters; filler records of 9s are skipped.
   */
  function parseNacha(text) {
    const lines = text.split(/\r\n|\r|\n/);
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    let start = 0;
    while (start < lines.length && lines[start].trim() === '') start++;
    for (let i = start; i < lines.length; i++) {
      if (lines[i].length !== 94) refuse(`Line ${i + 1} has ${lines[i].length} characters; a NACHA file has 94 on every line.`);
    }
    let fileDate = null;
    let batch = null;
    let entry = null;
    const items = [];
    for (let i = start; i < lines.length; i++) {
      const l = lines[i];
      const n = i + 1;
      const type = l[0];
      if (/^9{94}$/.test(l)) continue;
      if (type === '1') {
        fileDate = yymmdd(l.slice(23, 29)); // 24-29 creation date
      } else if (type === '5') {
        // 41-50 company ID, 51-53 SEC code, 70-75 effective date
        batch = { companyId: l.slice(40, 50).trim(), sec: l.slice(50, 53).trim(), effective: yymmdd(l.slice(69, 75)) };
        entry = null;
      } else if (type === '6') {
        if (!batch) refuse(`Line ${n} is an entry with no batch header before it.`);
        const amount = l.slice(29, 39); // 30-39
        if (!/^\d{10}$/.test(amount)) refuse(`Line ${n} has an amount that is not a number.`);
        const account = l.slice(12, 29).trim(); // 13-29: only the last four are kept
        entry = {
          line: n,
          txCode: l.slice(1, 3), // 2-3
          rdfi8: l.slice(3, 11).trim(), // 4-11
          accountLast4: account.slice(-4),
          cents: Number(amount),
          individualId: l.slice(39, 54).trim(), // 40-54
          name: l.slice(54, 76).trim() // 55-76
        };
      } else if (type === '7') {
        const kind = l.slice(1, 3);
        if (kind !== '99' && kind !== '98') continue;
        if (!entry) refuse(`Line ${n} is an addenda record with no entry before it.`);
        if (kind === '99') items.push(itemOf('return', l, entry, batch, fileDate));
        else {
          const it = itemOf('noc', l, entry, batch, fileDate);
          it.corrected = corrected(it.code, l.slice(35, 64)); // 36-64 corrected data, in memory only (see the header)
          items.push(it);
        }
      } else if (type === '8') {
        entry = null;
        batch = null;
      } else if (type !== '9') {
        refuse(`Line ${n} is not a NACHA record.`);
      }
    }
    if (!items.length) refuse('This file holds no returns or notices of change.');
    return { kind: 'nacha', items, fileDate };
  }

  /** One item from an addenda record (99 or 98) and the entry and batch it belongs to. */
  function itemOf(kind, l, entry, batch, fileDate) {
    const code = l.slice(3, 6).trim().toUpperCase(); // 4-6
    const info = codeInfo(code, kind);
    const originalRdfi = l.slice(27, 35).trim(); // 28-35
    return {
      kind,
      code,
      action: info.action,
      originalTrace: l.slice(6, 21).trim(), // 7-21
      individualId: entry.individualId,
      name: entry.name,
      cents: entry.cents,
      effective: batch.effective,
      companyId: batch.companyId,
      sec: batch.sec,
      txCode: entry.txCode,
      accountLast4: entry.accountLast4,
      rdfi8: originalRdfi || entry.rdfi8,
      date: fileDate,
      words: info.words,
      source: 'nacha',
      line: entry.line
    };
  }

  // ---- CSV ---------------------------------------------------------------------------------------------------------

  const FIELDS = ['date', 'code', 'investorId', 'name', 'amount', 'trace', 'corrected'];
  /**
   * The header words of each field (case-insensitive, whole words). A column takes the first field, in this order,
   * whose words it holds and that no column before it took: corrected, trace, amount, code, investorId, date, name.
   */
  const WORDS = [
    ['corrected', /\bcorrected\b|\bnew data\b|\bchange data\b/],
    ['trace', /\btrace\b/],
    ['amount', /\bamount\b/],
    ['code', /\breason\b|\breturn code\b|\bchange code\b|\bcode\b/],
    ['investorId', /\bindividual id\b|\bid number\b|\breceiver id\b|\bidentification\b|^id$/],
    ['date', /\bdate\b|\breturned\b|\bsettle/],
    ['name', /\bname\b|\breceiver\b/]
  ];
  const REQUIRED_WORDS = { date: 'the date', code: 'the return or change code', amount: 'the amount', who: 'the investor ID or the original trace' };

  function rowsOf(text) {
    if (!NS.bankFiles || typeof NS.bankFiles.csvRows !== 'function') refuse('The returns reader needs the bank statement module, which is not loaded.');
    // A semicolon file (phase 11's rule: the first line has semicolons and no comma or tab): the splitter still parts
    // cells at commas, so '$1,250.00' would become two cells. Commas are held aside while it splits, then put back.
    const head = text.split(/\r?\n/, 1)[0] || '';
    const HOLD = '';
    if (/[,\t]/.test(head) || head.indexOf(';') < 0 || text.indexOf(HOLD) >= 0) return NS.bankFiles.csvRows(text);
    return NS.bankFiles.csvRows(text.split(',').join(HOLD)).map((r) => r.map((c) => c.split(HOLD).join(',')));
  }
  /** The index of the header row: the first row with a cell. */
  const headerAt = (rows) => rows.findIndex((r) => r.length && r.some((c) => c !== ''));

  /**
   * The column map a returns CSV most likely uses, from its header row, for the sponsor to confirm:
   * { header: [cells], map: { date, code, investorId, name, amount, trace, corrected } (column indexes or -1), rows }.
   */
  function guess(input) {
    const t = textOf(input);
    if (t.refusal) refuse(t.refusal);
    const rows = rowsOf(t.text);
    const h = headerAt(rows);
    const header = h >= 0 ? rows[h].slice() : [];
    const map = {};
    FIELDS.forEach((f) => (map[f] = -1));
    header.forEach((cell, i) => {
      const s = String(cell).toLowerCase().replace(/\s+/g, ' ').trim();
      const hit = WORDS.find(([f, re]) => map[f] === -1 && re.test(s));
      if (hit) map[hit[0]] = i;
    });
    const body = h >= 0 ? rows.slice(h + 1).filter((r) => r.length && r.some((c) => c !== '')) : [];
    return { header, map, rows: body.length };
  }

  const isCol = (v) => Number.isInteger(v) && v >= 0;
  /** The first required field the map lacks, in words, or ''. */
  function lacking(map) {
    const m = map || {};
    if (!isCol(m.date)) return REQUIRED_WORDS.date;
    if (!isCol(m.code)) return REQUIRED_WORDS.code;
    if (!isCol(m.amount)) return REQUIRED_WORDS.amount;
    if (!isCol(m.investorId) && !isCol(m.trace)) return REQUIRED_WORDS.who;
    return '';
  }

  /** 'YYYY-MM-DD' for a real day, or null. */
  function day(y, m, d) {
    y = Number(y);
    m = Number(m);
    d = Number(d);
    if (!Number.isInteger(y) || y < 1900 || y > 2199 || !(m >= 1 && m <= 12) || d < 1) return null;
    const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    if (d > days) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  /** A report's date: YYYY-MM-DD, MM/DD/YYYY or MM/DD/YY (20YY); a time after it is dropped. */
  function csvDay(cell) {
    const s = String(cell || '')
      .trim()
      .replace(/[ T]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(\s?[AaPp][Mm])?$/, '');
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return day(m[1], m[2], m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(s);
    if (m) return day(m[3].length === 2 ? 2000 + Number(m[3]) : m[3], m[1], m[2]);
    return null;
  }

  /**
   * A returns CSV read through a column map (the guess, confirmed by the sponsor) as { kind: 'csv', items, skipped }.
   * Amounts as '$1,250.00', '1250.00' or '1250' become whole cents (a report that shows a return as negative gives the
   * same amount); a row whose code is not R.. or C.. is skipped and counted. A row that cannot be read refuses the
   * whole file: nothing is half-read.
   */
  function parseCsv(input, map) {
    const t = textOf(input);
    if (t.refusal) refuse(t.refusal);
    const miss = lacking(map);
    if (miss) refuse(`Choose which column holds ${miss} first.`);
    if (!NS.bankFiles || typeof NS.bankFiles.cents !== 'function') refuse('The returns reader needs the bank statement module, which is not loaded.');
    const rows = rowsOf(t.text);
    const h = headerAt(rows);
    const cell = (r, i) => (isCol(i) && r[i] !== undefined ? String(r[i]).trim() : '');
    const items = [];
    let skipped = 0;
    rows.forEach((r, i) => {
      if (!r.length || !r.some((c) => c !== '')) return;
      const n = i + 1;
      const m = /^([RC]\d{2})\b/i.exec(cell(r, map.code));
      if (!m) {
        if (i !== h) skipped++;
        return;
      }
      const code = m[1].toUpperCase();
      const kind = kindOf(code);
      const date = csvDay(cell(r, map.date));
      if (!date) refuse(`Row ${n} has a date that cannot be read.`);
      const c = NS.bankFiles.cents(cell(r, map.amount));
      if (c === null) refuse(`Row ${n} has an amount that cannot be read.`);
      const traceCell = cell(r, map.trace).replace(/\s/g, '');
      if (traceCell && !/^\d{15}$/.test(traceCell)) refuse(`Row ${n} has an original trace that is not 15 digits.`);
      const individualId = cell(r, map.investorId);
      if (!individualId && !traceCell) refuse(`Row ${n} has neither an investor ID nor an original trace.`);
      const info = codeInfo(code, kind);
      const it = {
        kind,
        code,
        action: info.action,
        originalTrace: traceCell,
        individualId,
        name: cell(r, map.name),
        cents: Math.abs(c),
        effective: null,
        companyId: null,
        sec: null,
        txCode: null,
        accountLast4: null,
        rdfi8: null,
        date,
        words: info.words,
        source: 'csv',
        line: n
      };
      if (kind === 'noc') it.corrected = corrected(code, cell(r, map.corrected));
      items.push(it);
    });
    if (!items.length) refuse('This file holds no returns or notices of change.');
    return { kind: 'csv', items, skipped };
  }

  // ---- by hand -----------------------------------------------------------------------------------------------------

  /**
   * One return or change entered by hand on a payment: { code (from the tables), date (YYYY-MM-DD), investorId, cents
   * (a whole number, 0 or more), runId or requestId, trace (the original's 15 digits, optional), corrected (a change's
   * data, as the bank wrote it) } → one Item with source 'hand'. Throws one sentence for what it cannot be.
   */
  function byHand(o) {
    const x = o || {};
    const code = String(x.code || '').trim().toUpperCase();
    const kind = kindOf(code);
    if (!kind || !(kind === 'return' ? RETURN_CODES[code] : NOC_CODES[code])) refuse('Choose a return or change code from the list.');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')) ? day(x.date.slice(0, 4), x.date.slice(5, 7), x.date.slice(8, 10)) : null;
    if (!date) refuse('Enter the date as year-month-day, for example 2026-12-07.');
    if (!Number.isSafeInteger(x.cents) || x.cents < 0) refuse('Enter the amount as a whole number of cents, 0 or more.');
    const individualId = String(x.investorId || '').trim();
    if (!individualId) refuse('Choose the investor first.');
    const trace = String(x.trace || '').replace(/\s/g, '');
    if (trace && !/^\d{15}$/.test(trace)) refuse('The original trace number has 15 digits.');
    const info = codeInfo(code, kind);
    const it = {
      kind,
      code,
      action: info.action,
      originalTrace: trace,
      individualId,
      name: String(x.name || '').trim(),
      cents: x.cents,
      effective: null,
      companyId: null,
      sec: null,
      txCode: null,
      accountLast4: null,
      rdfi8: null,
      date,
      words: info.words,
      source: 'hand',
      line: null,
      runId: x.runId || null,
      requestId: x.requestId || null
    };
    if (kind === 'noc') it.corrected = corrected(code, x.corrected);
    return it;
  }

  // ---- the reader --------------------------------------------------------------------------------------------------

  /**
   * A returns file (a string, or a Uint8Array decoded as UTF-8) as { kind, items, fileDate } for NACHA or
   * { kind, items, skipped } for CSV (opts.map required: the guess, confirmed by the sponsor). Throws one plain
   * sentence for every refusal; a file that is refused returns nothing.
   */
  function parse(input, opts) {
    const t = textOf(input);
    if (t.refusal) refuse(t.refusal);
    const kind = detect(t.text);
    if (kind === 'nacha') return parseNacha(t.text);
    if (kind === 'csv') return parseCsv(t.text, (opts || {}).map);
    refuse('This file is not a returns file the portal can read; download it from your bank as a CSV or a NACHA file, or enter the return by hand.');
  }

  NS.achReturns = { LIMITS, detect, parse, guess, parseCsv, byHand, corrected, RETURN_CODES, NOC_CODES };
})((window.CVPortal = window.CVPortal || {}));
