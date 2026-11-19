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
    return '';
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
    if (stack.length) refuse('This OFX file ends before its statement is complete: it may have been cut short. Download it again.');
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
   * A statement file's text as { kind, last4, currency, from, to, openingCents, closingCents, lines, accounts }.
   * openingCents and closingCents are null when the file does not carry them. Throws one plain sentence on any refusal;
   * a file that is refused returns nothing.
   */
  function parse(text, opts) {
    const o = opts || {};
    if (typeof text !== 'string') refuse('The statement could not be read as text.');
    if (utf8Bytes(text) > LIMITS.bytes) refuse(`This file is larger than ${LIMITS.bytes / 1000000} MB; download a shorter period from the bank.`);
    if (lineCount(text) > LIMITS.lines) refuse(`This file has more than ${plainNumber(LIMITS.lines)} lines; download a shorter period from the bank.`);
    const s = text.replace(/^﻿/, '');
    const kind = o.kind || detect(s);
    if (kind === 'ofx') return statementOf('ofx', ofxStatements(s), o);
    refuse(`This file is not a bank statement the portal can read; download it from the bank as ${KINDS}.`);
  }

  NS.bankFiles = { LIMITS, detect, parse, cents, lineIds };
})((window.CVPortal = window.CVPortal || {}));
