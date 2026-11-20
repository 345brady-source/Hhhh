/*
 * Bank reconciliation in the books: statement lines stored per bank account, matched to cash lines already posted,
 * decided once by account when no posted line matches (which posts the entry), and reconciled to a statement date.
 *
 * Stored in the fund's books (fund.bank):
 *   accounts  [ { id: 'ba-<n>', name, last4, code, map } ]   code is the account's cash account in the chart: 1000 for
 *             the first, then 1001, 1002, ... added as 'Cash: <name>'; only the last four digits of the number are kept
 *   imports   [ { id, account, name, sha256, from, to, added, fileId, at, by } ]   fileId names the bytes kept elsewhere
 *   lines     [ { id, account, date, cents, text, ref, imp, match: { entry, line } | null, entry: id | null } ]
 *             id is '<account id>:<the statement reader's id>', so the same statement in two accounts never collides
 *   recs      [ { account, asOf, statementCents, bookCents, outstanding: [ [entryId, lineIndex, cents] ], at, by } ]
 *
 * A match posts nothing: the bank line is the evidence for a cash line already in the journal. A decision posts one
 * entry, src 'bank:<lineId>', through NS.books.post (so the journal's balance and closed-period rules apply).
 *
 * Amounts are whole cents (money in positive). Pure functions over the workspace: nothing here saves or writes the
 * change log (the screen does, per action).
 */
(function (root) {
  'use strict';
  const NS = (root.CVPortal = root.CVPortal || {});
  const B = NS.books;
  if (!B) return;

  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const offering = (ws, id) => ((ws && ws.offerings) || []).find((o) => o && o.id === id) || null;
  /** The fund's bank store, created when needed (books.js's fund() fills every list). */
  const store = (ws, oid) => B.fund(ws, oid).bank;
  /** The stored fund for reads, or null. */
  const peek = (ws, oid) => (ws && ws.books && ws.books.funds && ws.books.funds[oid]) || null;
  const bankOf = (ws, oid) => {
    const f = peek(ws, oid);
    return f && f.bank ? f.bank : { accounts: [], imports: [], lines: [], recs: [] };
  };
  const journalOf = (ws, oid) => {
    const f = peek(ws, oid);
    return (f && Array.isArray(f.journal) && f.journal) || [];
  };
  function accountOf(ws, oid, accountId) {
    const a = (bankOf(ws, oid).accounts || []).find((x) => x && x.id === accountId);
    if (!a) throw new Error(`There is no bank account ${accountId} in this fund.`);
    return a;
  }
  function lineOf(ws, oid, lineId) {
    const l = (bankOf(ws, oid).lines || []).find((x) => x && x.id === lineId);
    if (!l) throw new Error(`There is no statement line ${lineId} in this fund.`);
    return l;
  }
  const decided = (l) => !!(l.match || l.entry);
  const days = (a, b) => Math.round((NS.dates.parse(b) - NS.dates.parse(a)) / 864e5);

  /* ---------- Accounts ---------- */
  /** Add a bank account: the first uses cash account 1000, each later one the next free code from 1001. */
  function addAccount(ws, offeringId, a) {
    a = a || {};
    if (!offering(ws, offeringId)) throw new Error(`There is no offering ${offeringId} in this workspace.`);
    const name = typeof a.name === 'string' ? a.name.trim() : '';
    if (!name) throw new Error('A bank account needs a name.');
    const last4 = a.last4 == null ? '' : String(a.last4).trim();
    if (last4 !== '' && !/^\d{4}$/.test(last4)) throw new Error('Give only the last four digits of the account number.');
    const bank = store(ws, offeringId);
    let code = '1000';
    if (bank.accounts.length) {
      const used = new Set(B.accounts(ws, offeringId).map((x) => x.code));
      code = '';
      for (let n = 1001; n < 1100 && !code; n++) if (!used.has(String(n))) code = String(n);
      if (!code) throw new Error('There is no free cash account code left for another bank account.');
      B.addAccount(ws, offeringId, { code, name: 'Cash: ' + name, type: 'asset', line: '1' });
    }
    const ids = new Set(bank.accounts.map((x) => x && x.id));
    let n = bank.accounts.length + 1;
    while (ids.has('ba-' + n)) n++;
    const acct = { id: 'ba-' + n, name, last4, code, map: null };
    bank.accounts.push(acct);
    return clone(acct);
  }
  /** Keep the CSV column map the sponsor confirmed for this account. */
  function setMap(ws, offeringId, accountId, map) {
    accountOf(ws, offeringId, accountId);
    if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('The column map must be a set of named columns.');
    const a = store(ws, offeringId).accounts.find((x) => x && x.id === accountId);
    a.map = clone(map);
    return clone(a);
  }

  /* ---------- Importing statement lines ---------- */
  /** Store a parsed statement's lines on the account. Returns { added, skipped, overlap }. */
  function importLines(ws, offeringId, accountId, parsed, opts) {
    opts = opts || {};
    const acct = accountOf(ws, offeringId, accountId);
    if (!parsed || !Array.isArray(parsed.lines)) throw new Error('There are no statement lines to import.');
    const bank = store(ws, offeringId);
    const out = { added: 0, skipped: 0, overlap: 0 };
    const imps = new Set(bank.imports.map((x) => x && x.id));
    let k = bank.imports.length + 1;
    while (imps.has('imp-' + k)) k++;
    const impId = 'imp-' + k;
    const fresh = [];
    parsed.lines.forEach((l) => {
      fresh.push({ id: `${acct.id}:${l.id}`, account: acct.id, date: l.date, cents: l.cents, text: String(l.text || ''), ref: String(l.ref || ''), imp: impId, match: null, entry: null });
    });
    fresh.forEach((l) => bank.lines.push(l));
    out.added = fresh.length;
    if (out.added > 0) {
      bank.imports.push({ id: impId, account: acct.id, name: String(opts.name || ''), sha256: String(opts.sha256 || ''), from: parsed.from || null, to: parsed.to || null, added: out.added, fileId: String(opts.fileId || ''), at: opts.at || new Date().toISOString(), by: String(opts.by || '') });
    }
    return out;
  }

  /** The account's lines with neither a match nor an entry, in stored order. */
  function undecided(ws, offeringId, accountId) {
    accountOf(ws, offeringId, accountId);
    return clone((bankOf(ws, offeringId).lines || []).filter((l) => l && l.account === accountId && !decided(l)));
  }

  /* ---------- Matching ---------- */
  /** 'entryId|lineIndex' of every journal line a stored statement line is matched to. */
  function matchedKeys(ws, oid, exceptLineId) {
    const s = new Set();
    (bankOf(ws, oid).lines || []).forEach((l) => l && l.match && l.id !== exceptLineId && s.add(l.match.entry + '|' + l.match.line));
    return s;
  }
  /** Journal lines a statement line could be: same account code, same cents, unmatched, dated near enough. */
  function candidates(ws, offeringId, lineId) {
    const bl = lineOf(ws, offeringId, lineId);
    const acct = accountOf(ws, offeringId, bl.account);
    const taken = matchedKeys(ws, offeringId, bl.id);
    const lo = NS.ops.businessDays(bl.date, -3);
    const hi = NS.ops.businessDays(bl.date, 3);
    const out = [];
    journalOf(ws, offeringId).forEach((e) => {
      if (!e || !Array.isArray(e.lines) || String(e.src || '').indexOf('bank:') === 0) return;
      e.lines.forEach((l, i) => {
        if (String(l[0]) !== acct.code || l[1] !== bl.cents || taken.has(e.id + '|' + i)) return;
        if (e.date < lo || e.date > hi) return;
        out.push({ entry: e.id, line: i, date: e.date, cents: l[1], memo: e.memo || '', partner: l[2] || '', rank: 1, gap: Math.abs(days(e.date, bl.date)) });
      });
    });
    out.sort((a, b) => a.rank - b.rank || a.gap - b.gap || (a.entry < b.entry ? -1 : a.entry > b.entry ? 1 : a.line - b.line));
    return out.map((c) => ({ entry: c.entry, line: c.line, date: c.date, cents: c.cents, memo: c.memo, partner: c.partner, rank: c.rank }));
  }
  /** Match a statement line to a journal line. Posts nothing. */
  function match(ws, offeringId, lineId, target) {
    lineOf(ws, offeringId, lineId);
    const l = store(ws, offeringId).lines.find((x) => x && x.id === lineId);
    l.match = { entry: target.entry, line: target.line };
    return clone(l);
  }
  /** Match every undecided line with exactly one candidate that no other undecided line shares. Returns the count. */
  function autoMatch(ws, offeringId, accountId) {
    const open = undecided(ws, offeringId, accountId);
    const cands = open.map((l) => candidates(ws, offeringId, l.id));
    const uses = new Map();
    cands.forEach((cs) => cs.forEach((c) => uses.set(c.entry + '|' + c.line, (uses.get(c.entry + '|' + c.line) || 0) + 1)));
    let n = 0;
    open.forEach((l, i) => {
      const cs = cands[i];
      if (cs.length !== 1 || uses.get(cs[0].entry + '|' + cs[0].line) !== 1) return;
      match(ws, offeringId, l.id, cs[0]);
      n++;
    });
    return n;
  }

  /* ---------- Deciding a line by account ---------- */
  const ln = (code, cents, partner, holding) => [code, cents, partner || '', holding || ''];
  /** Post the entry a decision calls for, src 'bank:<lineId>', dated the line's date. Returns the entry. */
  function categorize(ws, offeringId, lineId, d, who) {
    d = d || {};
    who = who || {};
    const bl = lineOf(ws, offeringId, lineId);
    const acct = accountOf(ws, offeringId, bl.account);
    const C = acct.code;
    const c = bl.cents;
    const a = Math.abs(c);
    let lines;
    if (d.kind === 'account') {
      lines = c > 0 ? [ln(C, c), ln(d.account, -c, d.partner, d.holding)] : [ln(d.account, a, d.partner, d.holding), ln(C, -a)];
    } else if (d.kind === 'purchase') {
      lines = [ln('1100', a, '', d.holding), ln(C, -a)];
    } else throw new Error('Choose how the line is decided: an account, a purchase, a split or a sale.');
    const e = B.post(ws, offeringId, { date: bl.date, memo: bl.text, src: 'bank:' + bl.id, lines }, { by: who.by, at: who.at });
    store(ws, offeringId).lines.find((x) => x && x.id === lineId).entry = e.id;
    return e;
  }

  /* ---------- Reconciling to a statement date ---------- */
  function reconcile(ws, offeringId, accountId, asOf, statementCents) {
    const acct = accountOf(ws, offeringId, accountId);
    const C = acct.code;
    const lines = (bankOf(ws, offeringId).lines || []).filter((l) => l && l.account === accountId && l.date <= asOf);
    const matched = new Set(lines.filter((l) => l.match).map((l) => l.match.entry + '|' + l.match.line));
    const posting = new Set(lines.filter((l) => l.entry).map((l) => l.entry));
    const outstanding = [];
    journalOf(ws, offeringId).forEach((e) => {
      if (!e || !Array.isArray(e.lines) || e.date > asOf || posting.has(e.id)) return;
      e.lines.forEach((l, i) => {
        if (String(l[0]) !== C || matched.has(e.id + '|' + i)) return;
        outstanding.push({ entry: e.id, line: i, date: e.date, cents: l[1], memo: e.memo || '' });
      });
    });
    const und = lines.filter((l) => !decided(l));
    const bookCents = B.balance(ws, offeringId, C, asOf);
    const sum = (xs) => xs.reduce((t, x) => t + x.cents, 0);
    return { statementCents, bookCents, outstanding, undecided: clone(und), differenceCents: statementCents - bookCents + sum(outstanding) - sum(und) };
  }
  /** Store the reconciliation. */
  function markReconciled(ws, offeringId, accountId, asOf, statementCents, who) {
    who = who || {};
    const r = reconcile(ws, offeringId, accountId, asOf, statementCents);
    const rec = { account: accountId, asOf, statementCents, bookCents: r.bookCents, outstanding: r.outstanding.map((o) => [o.entry, o.line, o.cents]), at: who.at || new Date().toISOString(), by: who.by };
    store(ws, offeringId).recs.push(rec);
    return clone(rec);
  }

  B.bank = { addAccount, setMap, importLines, undecided, candidates, match, autoMatch, categorize, reconcile, markReconciled };
})(typeof window !== 'undefined' ? window : globalThis);
