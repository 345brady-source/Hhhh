/*
 * The record of every payment file the console lets out (both editions).
 *
 * A NACHA file can move money each time it is uploaded, so the portal remembers each file that leaves it (downloaded or
 * copied) in ws.achLog: who sent it and when, its file ID, and per investor entry the trace number, the amount, the
 * transaction code and the last four digits of the account. Never a full account number and never the file's text.
 *   - A file ID modifier (A-Z, then 0-9) is used only when a file leaves, counted per immediate origin, immediate
 *     destination and creation date; the 37th file of a day for one bank is refused.
 *   - A distribution keeps the record of the file sent for it. A second file for it needs a person and a reason
 *     ("Build again"), and its record names the reason and the first file. A file sent for a new distribution before
 *     it is recorded is kept by offering and payment date and attached to the run when the distribution is recorded.
 *   - A distribution recorded with no file record (every run recorded before file records existed) is treated as paid.
 * Entries written before file records existed are { date, modifier, filename }: they count as files of their date for
 * every origin and destination.
 */
(function (NS) {
  'use strict';

  const MODIFIERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const strip = (v) => String(v == null ? '' : v).replace(/\s/g, '');
  /* The immediate destination and origin fields hold 10 characters (a 9-digit routing number gets a leading space). */
  const field10 = (v) => strip(v).slice(0, 10);

  /** ws.achLog (created when missing). */
  function ensure(ws) {
    ws.achLog = Array.isArray(ws.achLog) ? ws.achLog : [];
    return ws.achLog;
  }

  /** The bank a file is counted against: { origin, destination } without spaces. tenant: a tenant or its ach settings. */
  function keyOf(tenant) {
    const a = (tenant && tenant.ach) || tenant || {};
    return { origin: field10(a.immediateOrigin), destination: field10(a.destinationRouting || a.odfiRouting) };
  }

  const files = (ws) => ensure(ws).filter((x) => x && x.kind === 'file');

  /** The modifiers used on `date` for that origin and destination (an entry with no origin counts for every one). */
  function usedOn(ws, key, date) {
    const used = new Set();
    ensure(ws).forEach((x) => {
      if (!x || x.date !== date || !x.modifier) return;
      if (!x.origin || (x.origin === key.origin && x.destination === key.destination)) used.add(String(x.modifier));
    });
    return used;
  }

  /** The first free file ID modifier for that tenant's bank on `date` (YYYY-MM-DD), or null when all 36 are used. */
  function modifierFor(ws, tenant, date) {
    const used = usedOn(ws, keyOf(tenant), date);
    const m = MODIFIERS.split('').find((c) => !used.has(c));
    return m || null;
  }

  /**
   * What a file pays for: { runId } for a recorded distribution; null for a pre-note, redemption or returned-line file
   * (one day may need two; their rule is per reference, kept through refs); otherwise the draft key of the offering and
   * payment date.
   */
  function targetOf(meta) {
    const m = meta || {};
    if (m.runId) return { runId: m.runId };
    if (m.for === 'prenote' || m.for === 'redemption' || m.for === 'repay') return null;
    return { draftKey: `${m.offeringId || ''}|${m.effective || ''}`, for: m.for || 'distribution' };
  }

  const runOf = (ws, id) => (ws.runs || []).find((r) => r.id === id) || null;

  /** Every file record for that target, newest first. */
  function filesOf(ws, target) {
    if (!target) return [];
    const list = files(ws).filter((x) => {
      if (target.runId) return x.runId === target.runId;
      if (x.draftKey !== target.draftKey) return false;
      if (!x.runId) return true;
      const r = runOf(ws, x.runId);
      return !!r && !r.cancelled;
    });
    return list.reverse();
  }

  /** The newest file record for that target, or null. */
  function sentFor(ws, target) {
    return filesOf(ws, target)[0] || null;
  }

  /** The run when it is recorded, not cancelled and has no file record: paid as far as the portal knows. */
  function paidRun(ws, runId) {
    const r = runId ? runOf(ws, runId) : null;
    return r && !r.cancelled && !files(ws).some((x) => x.runId === runId) ? r : null;
  }

  /** "Nov 19, 2026" for a YYYY-MM-DD day. */
  function longDay(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  /** The local day of a timestamp, or the fallback. */
  function dayOf(at, fallback) {
    const t = Date.parse(at || '');
    if (!isFinite(t)) return fallback;
    const d = new Date(t);
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** The header and investor entries of the file's own records (the offsetting debit is not an investor entry). */
  function readFile(file) {
    const lines = Array.isArray(file.lines) ? file.lines : String(file.text || '').split(/\r?\n/);
    const head = lines.find((l) => l[0] === '1') || '';
    if (head.length !== 94) throw new Error('This payment file has no file header; build the file again.');
    const entries = [];
    lines
      .filter((l) => l[0] === '6' && l.length === 94)
      .forEach((l) => {
        const code = l.slice(1, 3);
        const investorId = l.slice(39, 54).trim();
        if ((code === '27' || code === '37') && investorId === 'OFFSET') return;
        const account = l.slice(12, 29).trim();
        entries.push({ investorId, trace: l.slice(79, 94), cents: Number(l.slice(29, 39)), code, kind: code === '23' || code === '33' ? 'prenote' : 'credit', last4: account.slice(-4) });
      });
    return {
      destination: head.slice(3, 13).trim(),
      origin: head.slice(13, 23).trim(),
      date: `20${head.slice(23, 25)}-${head.slice(25, 27)}-${head.slice(27, 29)}`,
      time: head.slice(29, 33),
      modifier: head.slice(33, 34),
      entries
    };
  }

  /**
   * Store the record of a file that leaves the console and return it. file: the NS.nacha.build result with filename and
   * modifier set; meta: { for, runId, offeringId, effective, how, by, at, again: null | { why, of }, tenant, refs }.
   * Refused with one sentence (nothing stored): no person; the file ID already used for that bank and day; a file for
   * that distribution already sent (or the distribution recorded as paid) and no reason given.
   */
  function recordFile(ws, file, meta) {
    const m = meta || {};
    const by = String(m.by == null ? '' : m.by).trim();
    if (!by) throw new Error('Sending a payment file needs the name of the person doing it.');
    const r = readFile(file || {});
    const key = { origin: r.origin, destination: r.destination };
    if (!/^[A-Z0-9]$/.test(r.modifier) || usedOn(ws, key, r.date).has(r.modifier)) throw new Error('This file ID was used by another file today; build the file again.');
    const target = targetOf(m);
    const why = m.again && String(m.again.why == null ? '' : m.again.why).trim();
    if (target && !why) {
      const prev = sentFor(ws, target);
      if (prev) throw new Error(`A file for this distribution was already sent on ${longDay(sentOn(prev))} (${prev.name}). Use "Build again" and give the reason.`);
      const paid = target.runId ? paidRun(ws, target.runId) : null;
      if (paid) throw new Error(`This distribution is recorded as paid on ${longDay(paid.date)}. Use "Build again" and give the reason.`);
    }
    const log = ensure(ws);
    const n = files(ws).reduce((a, x) => Math.max(a, Number(String(x.id || '').replace(/^af-/, '')) || 0), 0) + 1;
    const rec = {
      id: `af-${n}`,
      kind: 'file',
      for: m.for || 'distribution',
      runId: m.runId || '',
      offeringId: m.offeringId || '',
      effective: m.effective || '',
      draftKey: target && target.draftKey ? target.draftKey : '',
      refs: Object.assign({}, m.refs || {}),
      date: r.date,
      time: r.time,
      modifier: r.modifier,
      origin: r.origin,
      destination: r.destination,
      name: String(file.filename || ''),
      entries: r.entries,
      credit: r.entries.filter((e) => e.kind === 'credit').reduce((a, e) => a + e.cents, 0),
      how: m.how === 'copy' ? 'copy' : 'download',
      by,
      at: m.at || new Date().toISOString(),
      again: why ? { why: why.slice(0, 300), of: (m.again && m.again.of) || null } : null
    };
    log.push(rec);
    return rec;
  }

  /** Put a draft's file record on the run recorded for it; refused for an unknown record or one on another run. */
  function attach(ws, recordId, runId) {
    const rec = files(ws).find((x) => x.id === recordId);
    if (!rec) throw new Error('There is no record of that payment file.');
    if (rec.runId && rec.runId !== runId) throw new Error('That payment file is already on record for another distribution.');
    rec.runId = runId;
    return rec;
  }

  /**
   * Who may let a payment file out (download, copy, build again) and see its full account numbers: in the managed edition
   * every console role, as before; in the self-serve edition the 'pay' permission (phase 15's roles), or until it is
   * mapped, the role that may configure (the admin).
   */
  function canPay() {
    const app = NS.app;
    if (!app) return false;
    const E = NS.EDITION || {};
    if (!E.diy) return !!app.can('console');
    return !!(app.can('pay') || app.can('configure'));
  }

  /** The day a record's file left the console (YYYY-MM-DD, local). */
  const sentOn = (rec) => dayOf(rec && rec.at, rec && rec.date);

  /* ---------- Who may be paid in a file (plan 16-07: C-03, C-15, AC-03, AC-07; the owner's D-04 hold) ----------
   * The state of an investor's bank account lives in investor.payment.bank.check (absent on accounts saved before this
   * phase): { state: 'new' | 'prenote-sent' | 'returned' | 'blocked' | 'unconfirmed', code, date, until, fileId, why, at,
   * by }. 'unconfirmed' is written for a change the investor made ({ state, at, by: 'investor' }, phase 15) and leaves
   * only through confirmChange. A change the bank sent (NOC) waits in bank.pending until an admin applies it (16-08).
   * Every sentence here names an account by its last four digits at most.
   */
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  const STORED = ['new', 'prenote-sent', 'returned', 'blocked'];
  const last4 = (v) => strip(v).slice(-4);
  /** Runs of 5 or more digits in free text cut to their last four (no full account number in a stored reason). */
  const maskDigits = (s) => String(s == null ? '' : s).replace(/\d{5,}/g, (m) => 'ending ' + m.slice(-4));
  /** "Nov 19" for a YYYY-MM-DD day. */
  function monthDay(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  const todayOf = (t) => (ISO_DAY.test(String(t || '')) ? String(t) : dayOf(new Date().toISOString(), ''));
  const person = (by, what) => {
    const s = String(by == null ? '' : by).trim();
    if (!s) throw new Error(`${what} needs the name of the person doing it.`);
    return s;
  };
  const paymentOf = (inv) => (inv && inv.payment) || {};
  /** The investor's ACH bank, or null (a check payee, or a foreign investor paid by wire). */
  function achBank(inv) {
    const p = paymentOf(inv);
    return p.method !== 'wire' && p.method !== 'check' && p.bank && typeof p.bank === 'object' ? p.bank : null;
  }
  const isWire = (inv) => paymentOf(inv).method === 'wire';

  const W = {
    wire: 'Paid by international wire: see "Wires".',
    none: 'No bank account on file: paid by check.',
    unconfirmed: 'The investor changed this account: an admin confirms it before it is paid.',
    newOn: 'A pre-note checks this account first: build it on the ACH origination page.',
    ready: 'Ready to be paid.',
    prenote: (until) => `Can be paid from ${longDay(until)}, three banking days after its pre-note.`,
    returned: (code, date) => `Returned by the bank (${code || 'no code'}, ${monthDay(date)}): waits for new bank details.`,
    pending: (since) => `A change from the bank waits for an admin since ${monthDay(since)}.`,
    pendingPaid: (since) => `A change from the bank waits for an admin since ${monthDay(since)}. The account on file is still paid for now.`
  };

  /** Pre-notes apply: the self-serve edition, unless the sponsor turned them off (tenant.ach.prenotes false). */
  function prenotesOn(ws) {
    const E = NS.EDITION || {};
    const ach = (ws && ws.tenant && ws.tenant.ach) || {};
    return !!E.diy && ach.prenotes !== false;
  }

  /** Per call: the investors a paid run line pays (worked out once, only when an account with no check needs it). */
  function context(ws, today) {
    let paid = null;
    return {
      today,
      paidIds() {
        if (!paid) {
          paid = new Set();
          const D = NS.data;
          if (D && D.paidLines) D.paidLines(ws, { today }).forEach((x) => x.line && paid.add(x.line.investorId));
        }
        return paid;
      }
    };
  }
  /** A sent file record holds a credit entry for this investor (to the account ending last4, when given). */
  function paidByFile(ws, investorId, l4, after) {
    return files(ws).some((rec) => (!after || sentOn(rec) > after) && (rec.entries || []).some((e) => e.investorId === investorId && e.kind === 'credit' && (!l4 || e.last4 === l4)));
  }

  function stateOf(ws, inv, ctx) {
    const today = ctx.today;
    if (isWire(inv)) return { state: 'wire', words: W.wire };
    const bank = achBank(inv);
    if (!bank) return { state: 'none', words: W.none };
    const c = bank.check && typeof bank.check === 'object' ? bank.check : null;
    if (c && c.state === 'unconfirmed') return { state: 'unconfirmed', at: c.at || '', by: c.by || '', words: W.unconfirmed };
    const p = bank.pending && typeof bank.pending === 'object' ? bank.pending : null;
    if (p && ISO_DAY.test(String(p.date || ''))) {
      // 16-CONTEXT choice (4), re-check B1: the old details are paid for 6 banking days or until the next payment,
      // whichever is later; after both, the account is held.
      const until = NS.nacha.nextBankingDay(p.date, 6);
      const held = today > until && paidByFile(ws, inv.id, '', p.date);
      return { state: 'pending', code: p.code || '', date: p.date, until, held, words: held ? W.pending(p.date) : W.pendingPaid(p.date) };
    }
    if (c && c.state === 'returned') return { state: 'returned', code: c.code || '', date: c.date || '', words: W.returned(c.code, c.date) };
    if (c && c.state === 'blocked') return { state: 'blocked', why: c.why || '', words: c.why || 'Held by the bank.' };
    if (c && c.state === 'prenote-sent') {
      if (c.until && today < c.until) return { state: 'prenote-sent', date: c.date || '', until: c.until, fileId: c.fileId || '', words: W.prenote(c.until) };
      return { state: 'ready', date: c.date || '', until: c.until || '', words: W.ready };
    }
    const fresh = c ? c.state === 'new' : !(paidByFile(ws, inv.id, last4(bank.account)) || ctx.paidIds().has(inv.id));
    if (fresh) return { state: 'new', at: (c && c.at) || '', words: prenotesOn(ws) ? W.newOn : W.ready };
    return { state: 'ready', words: W.ready };
  }

  /**
   * The state of an investor's account on `today`: { state, code, date, until, why, words } (state 'none', 'wire',
   * 'unconfirmed', 'pending' (with held), 'returned', 'blocked', 'prenote-sent', 'new' or 'ready'; words the console's
   * sentence). With pre-notes off a 'new' account is payable.
   */
  function checkOf(ws, inv, today) {
    const s = stateOf(ws, inv, context(ws, todayOf(today)));
    return Object.assign({ state: s.state, code: '', date: '', until: '', why: '', words: '' }, s);
  }

  /** Write bank.check (one of the four stored states); refused for an investor with no ACH bank. info: { code, date, until, fileId, why, by, at }. */
  function setCheck(ws, inv, state, info) {
    const bank = achBank(inv);
    if (!bank) throw new Error('This investor has no bank account on file for ACH.');
    if (STORED.indexOf(state) < 0) throw new Error('That is not a state an account can be given.');
    const i = info || {};
    if (state === 'returned' && (!i.code || !ISO_DAY.test(String(i.date || '')))) throw new Error('A returned account needs the return code and the day it was returned.');
    if (state === 'prenote-sent' && (!ISO_DAY.test(String(i.date || '')) || !ISO_DAY.test(String(i.until || '')))) throw new Error('A pre-noted account needs its pre-note date and the day it can be paid.');
    const why = maskDigits(i.why).trim().slice(0, 300);
    if (state === 'blocked' && !why) throw new Error('Holding an account needs the reason.');
    const out = { state };
    if (i.code) out.code = String(i.code).slice(0, 3);
    if (i.date) out.date = String(i.date);
    if (i.until) out.until = String(i.until);
    if (i.fileId) out.fileId = String(i.fileId);
    if (why) out.why = why;
    out.at = i.at || new Date().toISOString();
    if (i.by) out.by = String(i.by).trim();
    bank.check = out;
    return out;
  }

  /** New or changed bank details: the account is 'new' (the bank step and the console call it when details change). */
  function markNew(inv, at) {
    const bank = achBank(inv);
    if (!bank) throw new Error('This investor has no bank account on file for ACH.');
    bank.check = { state: 'new', at: at || new Date().toISOString() };
    return bank.check;
  }

  /**
   * D-04: an admin confirms an account the investor changed; it becomes 'new' (its pre-note follows, C-03). Refused with no
   * person or when no change waits. The calling screen checks canPay() (and phase 15's server route its own rights).
   */
  function confirmChange(ws, inv, opts) {
    const o = opts || {};
    const by = person(o.by, 'Confirming a bank account change');
    const bank = achBank(inv);
    const c = bank && bank.check;
    if (!c || c.state !== 'unconfirmed') throw new Error('This account has no change waiting for an admin.');
    bank.check = { state: 'new', at: o.at || new Date().toISOString(), by };
    return bank.check;
  }

  /** Investors whose account waits for a pre-note (pre-notes on), in register order. */
  function prenotesDue(ws, today) {
    if (!prenotesOn(ws)) return [];
    const ctx = context(ws, todayOf(today));
    return (ws.investors || []).filter((inv) => stateOf(ws, inv, ctx).state === 'new');
  }

  /** An entry to the investor's ACH bank for the builder (the investor id in the entry's id field, read back by recordFile). */
  function entryOf(inv, cents, ref, kind) {
    const bank = achBank(inv);
    const e = { name: bank.holder || inv.title, id: inv.id, routing: bank.routing, account: bank.account, accountType: bank.type, cents, sec: (NS.ENTITY_TYPES && NS.ENTITY_TYPES[inv.type] ? NS.ENTITY_TYPES[inv.type] : {}).sec, ref: ref || inv.id };
    if (kind) e.kind = kind;
    return e;
  }

  /** The pre-note entries ($0, kind prenote) for prenotesDue (C-15: pre-notes go in their own file). */
  function prenoteEntries(ws, today) {
    return prenotesDue(ws, today).map((inv) => entryOf(inv, 0, inv.id, 'prenote'));
  }

  /**
   * After a pre-note file leaves (its record, for 'prenote'): each of its entries' investors, still on the account the
   * entry names and not waiting for an admin, becomes 'prenote-sent' from the file's effective date, payable three banking
   * days after it by the holiday rule. Returns the investors marked. Refused for any other record.
   */
  function prenotesSent(ws, record, opts) {
    const o = opts || {};
    if (!record || record.kind !== 'file' || record.for !== 'prenote') throw new Error('Only a pre-note file marks accounts as pre-noted.');
    if (!ISO_DAY.test(String(record.effective || ''))) throw new Error('This pre-note file has no payment date.');
    const by = person(o.by, 'Recording a pre-note');
    const until = NS.nacha.nextBankingDay(record.effective, 3);
    const marked = [];
    (record.entries || []).forEach((e) => {
      if (e.kind !== 'prenote') return;
      const inv = (ws.investors || []).find((x) => x.id === e.investorId);
      const bank = achBank(inv);
      if (!bank || last4(bank.account) !== e.last4) return;
      if (bank.check && bank.check.state === 'unconfirmed') return;
      setCheck(ws, inv, 'prenote-sent', { date: record.effective, until, fileId: record.id, by, at: o.at });
      marked.push(inv);
    });
    return marked;
  }

  /**
   * AC-03: who a file of payments may pay on its effective date. rows: [ { investor, cents, ref?, request? } ] (the net to
   * pay). Returns { entries, held }: entries for the builder (an unknown investor type keeps sec undefined, so the builder
   * leaves it out with 'No SEC type'); held [ { investor, cents, kind, reason, until, ref?, request? } ] with one sentence
   * each. Check payees are neither (the console lists them as checks).
   */
  function fileEntries(ws, rows, opts) {
    const o = opts || {};
    const ctx = context(ws, todayOf(o.today));
    const effective = String(o.effective || ctx.today);
    const on = prenotesOn(ws);
    const entries = [];
    const held = [];
    (rows || []).forEach((row) => {
      const inv = row && row.investor;
      if (!inv) return;
      const s = stateOf(ws, inv, ctx);
      const hold = (kind, reason, until) => {
        const h = { investor: inv, cents: row.cents, kind, reason, until: until || '' };
        if (row.ref) h.ref = row.ref;
        if (row.request) h.request = row.request;
        held.push(h);
      };
      const pay = () => entries.push(entryOf(inv, row.cents, row.ref));
      const bank = achBank(inv);
      const c = (bank && bank.check) || {};
      switch (s.state) {
        case 'none':
          return;
        case 'wire':
          return hold('wire', W.wire);
        case 'unconfirmed':
          return hold('unconfirmed', W.unconfirmed);
        case 'pending':
          return s.held ? hold('pending', W.pending(s.date), s.until) : pay();
        case 'returned':
          return hold('returned', W.returned(s.code, s.date));
        case 'blocked':
          return hold('blocked', s.words);
        case 'prenote-sent':
          return effective >= s.until ? pay() : hold('prenote-sent', W.prenote(s.until), s.until);
        case 'new':
          return on ? hold('new', W.newOn) : pay();
        default:
          // 'ready'; a pre-noted account whose day has come
          return c.state === 'prenote-sent' && c.until && effective < c.until ? hold('prenote-sent', W.prenote(c.until), c.until) : pay();
      }
    });
    return { entries, held };
  }

  /* ---------- Redemption payment files (D-06, AC-16) ---------- */
  /**
   * The payees of a redemption payment file: approved redemptions whose dealing month is final (r.dealing on or before
   * NS.audit.lastMonthEnd(today), the console's rule) and whose NS.ops.redemptionAmount is a number. Returns
   * { entries, held, wires, checks }: entries and held as fileEntries gives them (each entry's ref the request id, each
   * held item's request); wires [ { request, investor, cents, details } ]; checks [ { request, investor, cents } ].
   */
  function redemptionPayees(ws, requests, opts) {
    const o = opts || {};
    const today = todayOf(o.today);
    const lastEnd = NS.audit && NS.audit.lastMonthEnd ? NS.audit.lastMonthEnd(today) : '';
    const rows = [];
    const wires = [];
    const checks = [];
    (requests || []).forEach((r) => {
      if (!r || r.type !== 'redemption' || r.status !== 'approved' || !r.dealing || !lastEnd || r.dealing > lastEnd) return;
      const cents = NS.ops && NS.ops.redemptionAmount ? NS.ops.redemptionAmount(ws, r) : null;
      if (typeof cents !== 'number' || !(cents > 0)) return;
      const investor = (ws.investors || []).find((x) => x.id === r.investorId);
      if (!investor) return;
      if (isWire(investor)) wires.push({ request: r, investor, cents, details: wireDetails(investor) });
      else if (!achBank(investor)) checks.push({ request: r, investor, cents });
      else rows.push({ investor, cents, ref: r.id, request: r });
    });
    const out = fileEntries(ws, rows, { today, effective: o.effective });
    return { entries: out.entries, held: out.held, wires, checks };
  }

  /* ---------- International wires (D-04, AC-12; no IAT file) ---------- */
  /*
   * investor.payment = { method: 'wire', bank: null, wire: { beneficiary, address, bankName, country, bic, iban, account,
   * intermediary: null | { name, bic }, at } } (iban or account). The shapes are checked, not the banks [ASSUMED,
   * 16-RESEARCH A10]: a BIC is 4 letters (bank), 2 letters (country), 2 letters or digits (place), optionally 3 more
   * (branch); an IBAN is 2 letters, 2 check digits and 11 to 30 letters or digits whose ISO 13616 mod 97 is 1.
   */
  const compact = (s) => String(s == null ? '' : s).replace(/\s/g, '').toUpperCase();
  function bicValid(s) {
    return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(compact(s));
  }
  function ibanValid(s) {
    const v = compact(s);
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v)) return false;
    const moved = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let mod = 0;
    for (let k = 0; k < moved.length; k++) mod = (mod * 10 + Number(moved[k])) % 97;
    return mod === 1;
  }
  /** The stored wire block of a wire payee, or null. */
  function wireDetails(inv) {
    const p = paymentOf(inv);
    return p.method === 'wire' && p.wire && typeof p.wire === 'object' ? p.wire : null;
  }
  /** What a screen may show of the wire details: { bankName, country, ending } (the last four of the IBAN or account). */
  function wireMasked(inv) {
    const w = wireDetails(inv) || {};
    return { bankName: w.bankName || '', country: w.country || '', ending: last4(w.iban || w.account) };
  }
  const runLinesOf = (ws, run) => (NS.data && NS.data.runLines ? NS.data.runLines(ws, run) : { stored: Array.isArray(run.lines), lines: run.lines || [] });
  /**
   * A wire payee's line is a wire to send when its run has stored lines and was recorded, or is dated, on or after the day
   * the wire details were saved: a payment made before the investor had wire details was not a wire.
   */
  function wireLine(run, inv) {
    const w = wireDetails(inv);
    if (!w || !Array.isArray(run.lines)) return false;
    if (!w.at) return true;
    return String(run.linesAt || '') >= String(w.at) || run.date >= dayOf(w.at, String(w.at).slice(0, 10));
  }
  /**
   * The Wires list: every line of a recorded, not cancelled distribution paid to a wire payee and not marked sent, oldest
   * first: [ { runId, offeringId, date, investorId, name, cents (net), reference, details } ].
   */
  function wiresDue(ws) {
    const out = [];
    (ws.runs || [])
      .filter((run) => run && !run.cancelled && Array.isArray(run.lines))
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .forEach((run) => {
        const o = (ws.offerings || []).find((x) => x.id === run.offeringId) || {};
        run.lines.forEach((line) => {
          const inv = (ws.investors || []).find((x) => x.id === line.investorId);
          if (!inv || line.wire || !wireLine(run, inv)) return;
          out.push({ runId: run.id, offeringId: run.offeringId, date: run.date, investorId: inv.id, name: inv.title, cents: line.netCents, reference: `${o.shortName || o.name || run.offeringId} ${run.date} ${inv.id}`, details: wireDetails(inv) });
        });
      });
    return out;
  }
  const realDay = (s) => {
    if (!ISO_DAY.test(String(s || ''))) return false;
    const [y, m, d] = s.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  };
  /** Mark sent: line.wire = { sentOn, by, at }. Refused: no person, a date not YYYY-MM-DD, not a wire payee's line, already marked. */
  function markWireSent(ws, runId, investorId, opts) {
    const o = opts || {};
    const by = person(o.by, 'Marking a wire sent');
    if (!realDay(o.sentOn)) throw new Error('The day the wire was sent must be a date written YYYY-MM-DD.');
    const run = runOf(ws, runId);
    if (!run) throw new Error('No distribution with this id is recorded.');
    if (run.cancelled) throw new Error('This distribution is cancelled.');
    const line = Array.isArray(run.lines) ? run.lines.find((l) => l.investorId === investorId) : null;
    const inv = (ws.investors || []).find((x) => x.id === investorId);
    if (!line || !inv || !wireLine(run, inv)) throw new Error('This investor is not paid by international wire.');
    if (line.wire) throw new Error(`This wire was already marked sent on ${longDay(line.wire.sentOn)} by ${line.wire.by}.`);
    line.wire = { sentOn: o.sentOn, by, at: o.at || new Date().toISOString() };
    return line.wire;
  }
  /** A spreadsheet cell: a value starting =, +, - or @ (or a tab or return) is prefixed with ' so it is never a formula. */
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  /** The Wires list as CSV text (what the sponsor copies into its bank's wire screen). */
  function wireCsv(rows) {
    const head = ['Investor', 'Investor ID', 'Amount', 'Beneficiary', 'Address', 'Bank', 'Country', 'BIC', 'IBAN or account', 'Intermediary', 'Reference'];
    const body = (rows || []).map((r) => {
      const d = r.details || {};
      const mid = d.intermediary ? [d.intermediary.name, d.intermediary.bic].filter(Boolean).join(' ') : '';
      return [r.name, r.investorId, (Number(r.cents || 0) / 100).toFixed(2), d.beneficiary, d.address, d.bankName, d.country, compact(d.bic), compact(d.iban) || strip(d.account), mid, r.reference];
    });
    return [head].concat(body).map((row) => row.map(csvCell).join(',')).join('\r\n');
  }

  /* ---------- What a payment line reads (AC-11) ---------- */
  /**
   * The one reading of a distribution line's payment state, for the console and the investor portal:
   * { status: 'scheduled' | 'paid' | 'held' | 'returned' | 'repaid' | 'cancelled', method: 'ach' | 'wire' | 'check' | '',
   * ending, code, date, words, wireSent }. run: the run or its id; null when the investor has no line on it. An ACH line
   * names the account the sent file paid (its last four), or the account on file for a run with no file record; an ACH
   * payee left out of the run's sent file is 'held' ('Not paid yet'); a wire not marked sent is 'scheduled'; a wire
   * payee's payment made before its wire details were saved reads 'Paid' with method '' (how it was paid is not on record).
   */
  function lineStatus(ws, run, investorId, today) {
    const r = typeof run === 'string' ? runOf(ws, run) : run;
    if (!r) return null;
    const line = runLinesOf(ws, r).lines.find((l) => l.investorId === investorId);
    if (!line) return null;
    const t = todayOf(today);
    const inv = (ws.investors || []).find((x) => x.id === investorId) || { id: investorId };
    const sent = r.id ? files(ws).filter((x) => x.runId === r.id).reverse() : [];
    const entry = sent.map((x) => (x.entries || []).find((e) => e.investorId === investorId && e.kind === 'credit')).find(Boolean);
    let method = 'check';
    let ending = '';
    let savings = false;
    let held = false;
    if (entry) {
      method = 'ach';
      ending = entry.last4 || '';
      savings = entry.code === '32';
    } else if (line.wire || wireLine(r, inv)) {
      method = 'wire';
      ending = wireMasked(inv).ending;
    } else if (isWire(inv)) {
      // paid before the investor's wire details were saved: how it was paid is not on record
      method = '';
    } else if (achBank(inv)) {
      method = 'ach';
      ending = last4(achBank(inv).account);
      savings = achBank(inv).type === 'savings';
      // the run's file was sent without this investor (held out of it: fileEntries' reason)
      held = sent.length > 0;
    }
    const out = { status: 'paid', method, ending, code: '', date: r.date, words: '', wireSent: line.wire || null };
    const a = line.ach && typeof line.ach === 'object' ? line.ach : null;
    if (r.cancelled) return Object.assign(out, { status: 'cancelled', words: 'Cancelled' });
    if (r.date > t) return Object.assign(out, { status: 'scheduled', words: `Scheduled for ${longDay(r.date)}` });
    if (a && a.status === 'repaid' && a.repaid && a.repaid.on) return Object.assign(out, { status: 'repaid', code: a.code || '', date: a.repaid.on, words: `Paid again on ${longDay(a.repaid.on)}` });
    if (a && (a.status === 'returned' || a.status === 'repaid')) return Object.assign(out, { status: 'returned', code: a.code || '', date: a.date || '', words: `Returned by your bank on ${longDay(a.date)}` });
    if (method === 'wire') {
      if (!line.wire) return Object.assign(out, { status: 'scheduled', words: `To be paid by wire to the account ending ${ending}` });
      return Object.assign(out, { date: line.wire.sentOn, words: `Paid by wire to the account ending ${ending}` });
    }
    if (held) return Object.assign(out, { status: 'held', words: 'Not paid yet' });
    if (method === 'ach') return Object.assign(out, { words: `Paid by ACH to the ${savings ? 'savings' : 'checking'} account ending ${ending}` });
    if (!method) return Object.assign(out, { words: 'Paid' });
    return Object.assign(out, { words: 'Paid by check' });
  }

  NS.achRecord = {
    ensure,
    keyOf,
    modifierFor,
    targetOf,
    sentFor,
    filesOf,
    paidRun,
    recordFile,
    attach,
    canPay,
    sentOn,
    longDay,
    MODIFIERS,
    prenotesOn,
    checkOf,
    setCheck,
    markNew,
    confirmChange,
    prenotesDue,
    prenoteEntries,
    prenotesSent,
    fileEntries,
    redemptionPayees,
    bicValid,
    ibanValid,
    wireDetails,
    wireMasked,
    wiresDue,
    markWireSent,
    wireCsv,
    lineStatus
  };
})(window.CVPortal);
