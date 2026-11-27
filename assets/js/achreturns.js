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
 * Sources: record positions as the open-source moov-io/ach v1.69.1 reader parses them (addenda99.go, addenda98.go;
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

  /** The words and action of a code; an unknown code is shown with its code and the class 'unknown'. */
  function codeInfo(code) {
    const c = RETURN_CODES[code];
    if (c) return { words: c.words, action: c.action };
    return { words: `The bank returned this payment with code ${code}, which the portal does not know; ask your bank what it means.`, action: 'unknown' };
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
    const info = codeInfo(code);
    const originalRdfi = l.slice(27, 35).trim(); // 28-35
    return {
      kind,
      code,
      words: info.words,
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
      source: 'nacha',
      line: entry.line
    };
  }

  // ---- the reader --------------------------------------------------------------------------------------------------

  /**
   * A returns file (a string, or a Uint8Array decoded as UTF-8) as { kind, items, fileDate }. Throws one plain sentence
   * for every refusal; a file that is refused returns nothing.
   */
  function parse(input) {
    const t = textOf(input);
    if (t.refusal) refuse(t.refusal);
    const kind = detect(t.text);
    if (kind === 'nacha') return parseNacha(t.text);
    refuse('This file is not a returns file the portal can read; download it from your bank as a CSV or a NACHA file, or enter the return by hand.');
  }

  NS.achReturns = { LIMITS, detect, parse, RETURN_CODES };
})((window.CVPortal = window.CVPortal || {}));
