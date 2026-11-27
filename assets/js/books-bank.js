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
 * Never twice: a line whose id is already stored on the account is skipped; a line under another id with the same date,
 * amount and text as a stored one (the same statement in another format) is an overlap and is added only when the
 * sponsor says so (allowOverlap). Each stored line is the overlap of at most one new line.
 *
 * A match posts nothing: the bank line is the evidence for a cash line already in the journal. Two or more candidates
 * are never matched automatically. A decision posts one entry, src 'bank:<lineId>', through NS.books.post (so the
 * journal's balance and closed-period rules apply); undoing it reverses that entry through NS.books.reverse.
 *
 * Net paid is what is compared with the bank: a distribution's ACH file total, each check and the general partner's
 * payment are separate cash lines; tax withheld stays in 2400 until paid over.
 *
 * Amounts are whole cents (money in positive); the share of unrealized gain given up on a sale is worked in BigInt.
 * Pure functions over the workspace: nothing here saves or writes the change log (the screen does, per action).
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
  /** The stored line itself (callers that change it must have checked the fund exists, as this does). */
  function lineOf(ws, oid, lineId) {
    const l = (bankOf(ws, oid).lines || []).find((x) => x && x.id === lineId);
    if (!l) throw new Error(`There is no statement line ${lineId} in this fund.`);
    return l;
  }
  const decided = (l) => !!(l.match || l.entry);
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && NS.dates.isoOf(NS.dates.parse(s)) === s;
  const days = (a, b) => Math.round((NS.dates.parse(b) - NS.dates.parse(a)) / 864e5);
  const addDays = (s, n) => NS.dates.isoOf(new Date(NS.dates.parse(s).getTime() + n * 864e5));
  /** n business days before s (Monday to Friday); the same count as NS.ops.businessDays(s, -n). */
  function businessBack(s, n) {
    let d = s;
    for (let k = 0; k < n; ) {
      d = addDays(d, -1);
      const wd = NS.dates.parse(d).getUTCDay();
      if (wd !== 0 && wd !== 6) k++;
    }
    return d;
  }
  /** Cents as dollars for a sentence, by integer arithmetic only. */
  function dollars(c) {
    const a = Math.abs(c);
    const whole = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (c < 0 ? '-$' : '$') + whole + '.' + String(a % 100).padStart(2, '0');
  }
  const textKey = (l) => `${l.date}|${l.cents}|${String(l.text || '').replace(/\s+/g, ' ').trim().toUpperCase()}`;
  const lineKey = (entryId, i) => entryId + '|' + i;

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
    if (parsed.last4 && acct.last4 && parsed.last4 !== acct.last4) throw new Error(`This statement is for the account ending ${parsed.last4}, not the account ending ${acct.last4}.`);
    let given = parsed.lines;
    if (given.some((l) => l && l.last4)) {
      if (!acct.last4) throw new Error("This file holds several accounts; give this bank account's last four digits to choose one.");
      given = given.filter((l) => l && l.last4 === acct.last4);
      if (!given.length) throw new Error(`This file holds no account ending ${acct.last4}.`);
    }
    given.forEach((l, i) => {
      if (!l || typeof l.id !== 'string' || !l.id) throw new Error(`Line ${i + 1} of the statement has no id.`);
      if (!isDate(l.date)) throw new Error(`Line ${i + 1} of the statement has no real date.`);
      if (!Number.isSafeInteger(l.cents)) throw new Error(`Line ${i + 1} of the statement is not a whole number of cents.`);
    });
    const bank = store(ws, offeringId);
    const mine = bank.lines.filter((l) => l && l.account === acct.id);
    const ids = new Set(mine.map((l) => l.id));
    const same = new Map();
    mine.forEach((l) => same.set(textKey(l), (same.get(textKey(l)) || 0) + 1));
    const imps = new Set(bank.imports.map((x) => x && x.id));
    let k = bank.imports.length + 1;
    while (imps.has('imp-' + k)) k++;
    const impId = 'imp-' + k;
    const out = { added: 0, skipped: 0, overlap: 0 };
    const fresh = [];
    given.forEach((l) => {
      const line = { id: `${acct.id}:${l.id}`, account: acct.id, date: l.date, cents: l.cents, text: String(l.text || ''), ref: String(l.ref || ''), imp: impId, match: null, entry: null };
      if (ids.has(line.id)) return void out.skipped++;
      ids.add(line.id);
      const key = textKey(line);
      if (same.get(key) > 0) {
        same.set(key, same.get(key) - 1);
        out.overlap++;
        if (!opts.allowOverlap) return;
      }
      fresh.push(line);
    });
    out.added = fresh.length;
    if (out.added > 0) {
      fresh.forEach((l) => bank.lines.push(l));
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
  /** entry id -> the entry that reverses it. */
  function reversals(j) {
    const m = new Map();
    j.forEach((e) => e && e.rev && m.set(e.rev, e));
    return m;
  }
  /** 'entryId|lineIndex' -> the stored statement line matched to it (optionally only lines dated on or before asOf). */
  function matchedKeys(ws, oid, asOf) {
    const m = new Map();
    (bankOf(ws, oid).lines || []).forEach((l) => l && l.match && (!asOf || l.date <= asOf) && m.set(lineKey(l.match.entry, l.match.line), l));
    return m;
  }
  /** The investor a cash line is for: its own, else the entry's only 3000/3100 line's (a call payment names it there). */
  function partnerOf(e, i) {
    const own = (e.lines[i] && e.lines[i][2]) || '';
    if (own) return own;
    const cap = e.lines.filter((l) => l[0] === '3000' || l[0] === '3100');
    return cap.length === 1 ? cap[0][2] || '' : '';
  }
  const words = (s) => String(s || '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  /** The text names the id, written with or without its punctuation ('FA-1002', 'FA1002', 'FA 1002'). */
  function names(text, id) {
    const w = words(id);
    if (!w.length) return false;
    return new RegExp('(^|[^A-Z0-9])' + w.join('[^A-Z0-9]?') + '($|[^A-Z0-9])').test(String(text || '').toUpperCase());
  }
  /** Every word of the wire reference the portal gives an investor for the call this entry records, or null. */
  function referenceWords(ws, oid, e) {
    const m = /^call:([^:]+):([^:]+)/.exec(String(e.src || ''));
    if (!m || !NS.ops || typeof NS.ops.wire !== 'function') return null;
    const call = ((ws && ws.calls) || []).find((c) => c && c.id === m[1]);
    const inv = ((ws && ws.investors) || []).find((x) => x && x.id === m[2]);
    const o = offering(ws, oid);
    if (!call || !inv || !o || !ws.tenant) return null;
    try {
      return words(NS.ops.wire(ws, o, inv, call).reference);
    } catch (err) {
      return null;
    }
  }
  /** A journal entry a statement line may be matched to: not a bank decision, not reversed, not a reversal. */
  const matchable = (e, rv) => !!(e && Array.isArray(e.lines) && String(e.src || '').indexOf('bank:') !== 0 && !e.rev && !rv.has(e.id));
  /** A check: a distribution's cash line paid to one investor; it may clear up to 180 days after it was issued. */
  const isCheck = (e, i) => String(e.src || '').indexOf('run:') === 0 && !!(e.lines[i] && e.lines[i][2]);

  /**
   * Journal lines a statement line could be: on the account's cash code, the same cents (sign included), not matched by
   * another stored line, dated within 3 business days of the line, or for a check from its date to 180 days after.
   * Ranked first (rank 0) where the line's text names the investor or holds the call's wire reference, then by days apart.
   */
  function candidates(ws, offeringId, lineId) {
    const bl = lineOf(ws, offeringId, lineId);
    const acct = accountOf(ws, offeringId, bl.account);
    const taken = matchedKeys(ws, offeringId);
    const j = journalOf(ws, offeringId);
    const rv = reversals(j);
    const lo = businessBack(bl.date, 3);
    const hi = NS.ops.businessDays(bl.date, 3);
    const tokens = new Set(words(bl.text));
    const out = [];
    j.forEach((e) => {
      if (!matchable(e, rv)) return;
      e.lines.forEach((l, i) => {
        if (String(l[0]) !== acct.code || l[1] !== bl.cents) return;
        const owner = taken.get(lineKey(e.id, i));
        if (owner && owner.id !== bl.id) return;
        const near = e.date >= lo && e.date <= hi;
        const cleared = isCheck(e, i) && e.date <= bl.date && bl.date <= addDays(e.date, 180);
        if (!near && !cleared) return;
        const partner = partnerOf(e, i);
        const ref = referenceWords(ws, offeringId, e);
        const named = names(bl.text, partner) || !!(ref && ref.length && ref.every((w) => tokens.has(w)));
        out.push({ entry: e.id, line: i, date: e.date, cents: l[1], memo: e.memo || '', partner, rank: named ? 0 : 1, gap: Math.abs(days(e.date, bl.date)) });
      });
    });
    out.sort((a, b) => a.rank - b.rank || a.gap - b.gap || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || (a.entry < b.entry ? -1 : a.entry > b.entry ? 1 : a.line - b.line));
    return out.map((c) => ({ entry: c.entry, line: c.line, date: c.date, cents: c.cents, memo: c.memo, partner: c.partner, rank: c.rank }));
  }
  /** Match a statement line to a journal line on its cash account. Posts nothing. */
  function match(ws, offeringId, lineId, target) {
    const bl = lineOf(ws, offeringId, lineId);
    const acct = accountOf(ws, offeringId, bl.account);
    if (decided(bl)) throw new Error('This statement line is already matched or decided; undo that first.');
    target = target || {};
    const j = journalOf(ws, offeringId);
    const e = j.find((x) => x && x.id === target.entry);
    if (!e) throw new Error(`There is no entry ${target.entry} in this fund's journal.`);
    if (!matchable(e, reversals(j))) throw new Error(`Entry ${e.id} was posted from a statement line or has been reversed, so it cannot be matched.`);
    const l = Number.isInteger(target.line) ? e.lines[target.line] : null;
    if (!l || String(l[0]) !== acct.code) throw new Error(`That journal line is not on this bank account's cash account ${acct.code}.`);
    if (l[1] !== bl.cents) throw new Error(`The journal line is ${dollars(l[1])}, not the statement line's ${dollars(bl.cents)}.`);
    const owner = matchedKeys(ws, offeringId).get(lineKey(e.id, target.line));
    if (owner && owner.id !== bl.id) throw new Error('That journal line is already matched to another statement line.');
    bl.match = { entry: e.id, line: target.line };
    return clone(bl);
  }
  /** Undo a match (nothing was posted for it). */
  function unmatch(ws, offeringId, lineId) {
    const bl = lineOf(ws, offeringId, lineId);
    if (!bl.match) throw new Error('This statement line is not matched.');
    bl.match = null;
    return clone(bl);
  }
  /** Match every undecided line with exactly one candidate that no other undecided line shares. Returns the count. */
  function autoMatch(ws, offeringId, accountId) {
    const open = undecided(ws, offeringId, accountId);
    const cands = open.map((l) => candidates(ws, offeringId, l.id));
    const uses = new Map();
    cands.forEach((cs) => cs.forEach((c) => uses.set(lineKey(c.entry, c.line), (uses.get(lineKey(c.entry, c.line)) || 0) + 1)));
    let n = 0;
    open.forEach((l, i) => {
      const cs = cands[i];
      if (cs.length !== 1 || uses.get(lineKey(cs[0].entry, cs[0].line)) !== 1) return;
      match(ws, offeringId, l.id, cs[0]);
      n++;
    });
    return n;
  }

  /* ---------- Deciding a line by account ---------- */
  const ln = (code, cents, partner, holding) => [code, cents, partner || '', holding || ''];
  /** The u of a sale: round(b1150 x cost / b1100), half away from zero, in BigInt. */
  function unrealizedShare(b1150, cost, b1100) {
    const n = 2n * BigInt(Math.abs(b1150)) * BigInt(cost) + BigInt(b1100);
    const u = Number(n / (2n * BigInt(b1100)));
    return b1150 < 0 ? -u : u;
  }
  /** Post the entry a decision calls for, src 'bank:<lineId>', dated the line's date. Returns the entry. */
  function categorize(ws, offeringId, lineId, d, who) {
    d = d || {};
    who = who || {};
    const bl = lineOf(ws, offeringId, lineId);
    const acct = accountOf(ws, offeringId, bl.account);
    if (decided(bl)) throw new Error('This statement line is already matched or decided; undo that first.');
    const src = 'bank:' + bl.id;
    if (B.live(peek(ws, offeringId), src)) throw new Error('This statement line has already been posted.');
    const C = acct.code;
    const c = bl.cents;
    const a = Math.abs(c);
    if (!a) throw new Error('A statement line of $0.00 has nothing to post.');
    const chart = new Set(B.accounts(ws, offeringId).map((x) => x.code));
    const holdings = new Set((((peek(ws, offeringId) || {}).holdings) || []).map((h) => h && h.id));
    const investors = new Set(((ws && ws.investors) || []).map((x) => x && x.id));
    const target = (code, holding, partner) => {
      if (!chart.has(String(code))) throw new Error(`Account ${code} is not in this fund's chart of accounts.`);
      if (String(code) === C) throw new Error(`Account ${C} is this bank account's own cash account; choose the account the money came from or went to.`);
      if (holding && !holdings.has(holding)) throw new Error(`There is no investment ${holding} in this fund.`);
      if (partner && !investors.has(partner)) throw new Error(`There is no investor ${partner} in this workspace.`);
    };
    const needHolding = () => {
      if (!d.holding) throw new Error('Choose the investment.');
      if (!holdings.has(d.holding)) throw new Error(`There is no investment ${d.holding} in this fund.`);
    };
    let lines;
    if (d.kind === 'account') {
      target(d.account, d.holding, d.partner);
      lines = c > 0 ? [ln(C, c), ln(String(d.account), -c, d.partner, d.holding)] : [ln(String(d.account), a, d.partner, d.holding), ln(C, -a)];
    } else if (d.kind === 'purchase') {
      if (c > 0) throw new Error('A purchase is money paid out; this line is money in.');
      needHolding();
      lines = [ln('1100', a, '', d.holding), ln(C, -a)];
    } else if (d.kind === 'split') {
      const items = Array.isArray(d.lines) ? d.lines : [];
      if (!items.length) throw new Error('A split needs at least one part.');
      let sum = 0;
      items.forEach((it, i) => {
        it = it || {};
        target(it.account, it.holding, it.partner);
        if (!Number.isSafeInteger(it.cents) || it.cents <= 0) throw new Error(`Part ${i + 1} of the split must be a whole number of cents above zero.`);
        sum += it.cents;
      });
      if (sum !== a) throw new Error(`The parts add up to ${dollars(sum)}, not the line's ${dollars(a)}.`);
      const side = c < 0 ? 1 : -1;
      lines = items.map((it) => ln(String(it.account), side * it.cents, it.partner, it.holding)).concat([ln(C, c)]);
    } else if (d.kind === 'sale') {
      if (c < 0) throw new Error('A sale is money received; this line is money paid out.');
      needHolding();
      const cost = d.costCents;
      if (!Number.isSafeInteger(cost) || cost <= 0) throw new Error('The cost given up must be a whole number of cents above zero.');
      const b1100 = B.balance(ws, offeringId, '1100', bl.date, { holding: d.holding });
      if (cost > b1100) throw new Error(`The cost given up, ${dollars(cost)}, is more than the investment's cost of ${dollars(b1100)} on ${bl.date}.`);
      const b1150 = B.balance(ws, offeringId, '1150', bl.date, { holding: d.holding });
      const u = unrealizedShare(b1150, cost, b1100);
      lines = [ln(C, c), ln('1100', -cost, '', d.holding), ln('6000', -(c - cost), '', d.holding), ln('6100', u, '', d.holding), ln('1150', -u, '', d.holding)].filter((l) => l[1] !== 0);
    } else throw new Error('Choose how the line is decided: an account, a purchase, a split or a sale.');
    const e = B.post(ws, offeringId, { date: bl.date, memo: bl.text, src, lines }, { by: who.by, at: who.at });
    bl.entry = e.id;
    return e;
  }
  /** Undo a decision: its entry is reversed (refused in a closed period) and the line is undecided again. */
  function uncategorize(ws, offeringId, lineId, who) {
    who = who || {};
    const bl = lineOf(ws, offeringId, lineId);
    if (!bl.entry) throw new Error('This statement line has not been decided.');
    const r = B.reverse(ws, offeringId, bl.entry, { by: who.by, at: who.at });
    bl.entry = null;
    return r;
  }

  /* ---------- Reconciling to a statement date ---------- */
  /**
   * { statementCents, bookCents, outstanding, undecided, differenceCents } at asOf. Outstanding: cash lines dated on or
   * before asOf that no statement line dated on or before asOf is matched to and no statement line posted; an entry and
   * its reversal (both by asOf) are left out together when neither is in the bank, since they add up to nothing.
   */
  function reconcile(ws, offeringId, accountId, asOf, statementCents) {
    const acct = accountOf(ws, offeringId, accountId);
    if (!isDate(asOf)) throw new Error('The statement date is not a real calendar date written YYYY-MM-DD.');
    if (!Number.isSafeInteger(statementCents)) throw new Error('The statement balance must be a whole number of cents.');
    const C = acct.code;
    const all = (bankOf(ws, offeringId).lines || []).filter((l) => l && l.account === accountId);
    const lines = all.filter((l) => l.date <= asOf);
    const matched = matchedKeys(ws, offeringId, asOf);
    const posting = new Set(all.filter((l) => l.entry).map((l) => l.entry));
    const j = journalOf(ws, offeringId);
    const byId = new Map(j.map((e) => [e && e.id, e]));
    const rv = reversals(j);
    const outstanding = [];
    j.forEach((e) => {
      if (!e || !Array.isArray(e.lines) || e.date > asOf || posting.has(e.id)) return;
      e.lines.forEach((l, i) => {
        if (String(l[0]) !== C || matched.has(lineKey(e.id, i))) return;
        if (e.rev) {
          const o = byId.get(e.rev);
          if (o && !matched.has(lineKey(o.id, i))) return;
        } else {
          const r = rv.get(e.id);
          if (r && r.date <= asOf) return;
        }
        outstanding.push({ entry: e.id, line: i, date: e.date, cents: l[1], memo: e.memo || '' });
      });
    });
    const und = lines.filter((l) => !decided(l));
    const bookCents = B.balance(ws, offeringId, C, asOf);
    const sum = (xs) => xs.reduce((t, x) => t + x.cents, 0);
    return { statementCents, bookCents, outstanding, undecided: clone(und), differenceCents: statementCents - bookCents + sum(outstanding) - sum(und) };
  }
  /** Store the reconciliation; refused unless the difference is exactly zero. */
  function markReconciled(ws, offeringId, accountId, asOf, statementCents, who) {
    who = who || {};
    const r = reconcile(ws, offeringId, accountId, asOf, statementCents);
    if (r.differenceCents !== 0) throw new Error(`The reconciliation is off by ${dollars(r.differenceCents)}; it can be stored only when the difference is $0.00.`);
    if (typeof who.by !== 'string' || !who.by.trim()) throw new Error('Storing a reconciliation needs the name of the person storing it.');
    const rec = { account: accountId, asOf, statementCents, bookCents: r.bookCents, outstanding: r.outstanding.map((o) => [o.entry, o.line, o.cents]), at: who.at || new Date().toISOString(), by: who.by };
    store(ws, offeringId).recs.push(rec);
    return clone(rec);
  }

  B.bank = { addAccount, setMap, importLines, undecided, candidates, match, unmatch, autoMatch, categorize, uncategorize, reconcile, markReconciled };
})(typeof window !== 'undefined' ? window : globalThis);
