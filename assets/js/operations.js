/*
 * Fund operations: capital calls, investor requests (redemptions and
 * subscriptions), AML/KYC records and published documents. These are the
 * workflows a fund administrator runs between a manager and its investors.
 * The investor portal, the console and the audit schedules all read them:
 * audit.js takes contributions from call payments and capital out from paid
 * redemptions, so every workflow lands in the capital accounts.
 *
 * Every action writes a change-log entry. Contributions are recorded as dated
 * position entries, so earlier distributions keep their original split.
 */
(function (NS) {
  'use strict';
  const D = NS.dates;
  const { parse, isoOf } = D;
  const pad2 = (n) => String(n).padStart(2, '0');
  const today = () => D.today();
  const money = (c) => (c < 0 ? '−$' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateShort = (s) => (s ? parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');
  const keyOf = (s) => String(s).slice(0, 7);
  const nextKey = (k) => keyOf(D.addMonths(k + '-01', 1));
  function endOf(k) {
    const [y, m] = k.split('-').map(Number);
    return isoOf(new Date(Date.UTC(y, m, 0)));
  }
  const days = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const addDays = (s, n) => isoOf(new Date(parse(s).getTime() + n * 864e5));
  function businessDays(s, n) {
    let d = s;
    for (let k = 0; k < n; ) {
      d = addDays(d, n > 0 ? 1 : -1);
      const wd = parse(d).getUTCDay();
      if (wd !== 0 && wd !== 6) k++;
    }
    return d;
  }
  function largest(total, weights) {
    const sum = weights.reduce((a, w) => a + w, 0);
    if (!sum || !total) return weights.map(() => 0);
    const rows = weights.map((w, i) => {
      const exact = (total * w) / sum;
      return { i, base: Math.floor(exact), frac: exact - Math.floor(exact) };
    });
    let rem = total - rows.reduce((a, r) => a + r.base, 0);
    rows
      .slice()
      .sort((a, b) => b.frac - a.frac || a.i - b.i)
      .forEach((r) => {
        if (rem > 0) {
          r.base += 1;
          rem -= 1;
        }
      });
    return rows.map((r) => r.base);
  }
  const log = (ws, e) => (NS.audit ? NS.audit.log(ws, e) : null);
  const save = (ws) => NS.workspace && NS.workspace.save(ws);
  function configOf(o) {
    for (const t of NS.TENANTS) {
      const x = (t.offerings || []).find((y) => y.id === o.id);
      if (x) return x;
    }
    return null;
  }
  const profileOf = (o) => (NS.OFFERING_TYPES[o.type] || NS.OFFERING_TYPES.Other).profile || 'other';
  const isOpen = (o) => ['hedge', 'digital', 'multistrat'].indexOf(profileOf(o)) >= 0;
  const holdersOf = (ws, o) => ws.investors.filter((i) => i.positions.some((p) => p.offeringId === o.id));
  const commitOf = (inv, o) => inv.positions.filter((p) => p.offeringId === o.id).reduce((a, p) => a + Math.round((p.commitment != null ? p.commitment : p.amount) * 100), 0);
  const paidInOf = (inv, o) => inv.positions.filter((p) => p.offeringId === o.id).reduce((a, p) => a + Math.round(p.amount * 100), 0);

  /* ---------- Liquidity (open-ended funds) ---------- */
  function liquidity(o) {
    if (!isOpen(o)) return null;
    const cfg = configOf(o) || {};
    return Object.assign({ frequency: 'Quarterly', notice: 60, lockup: 0 }, cfg.liquidity || {}, o.liquidity || {});
  }
  /** First dealing date (period end) that meets the notice period and any lock-up. */
  function dealingDate(o, submitted, firstInvested) {
    const L = liquidity(o);
    if (!L) return null;
    const step = L.frequency === 'Monthly' ? 1 : L.frequency === 'Annual' ? 12 : 3;
    const lockEnd = firstInvested && L.lockup ? D.addMonths(firstInvested, L.lockup) : '';
    let k = keyOf(submitted);
    for (let g = 0; g < 120; g++, k = nextKey(k)) {
      const end = endOf(k);
      if (Number(k.slice(5, 7)) % step === 0 && days(submitted, end) >= L.notice && end >= lockEnd) return end;
    }
    return null;
  }
  /** Subscriptions to open-ended funds are accepted on the first business day of a month. */
  function subscriptionDate(submitted) {
    const k = Number(submitted.slice(8, 10)) > 20 ? nextKey(nextKey(keyOf(submitted))) : nextKey(keyOf(submitted));
    return k + '-01';
  }

  /* ---------- Capital calls ---------- */
  function callsFor(ws, o) {
    return (ws.calls || []).filter((c) => c.offeringId === o.id).sort((a, b) => a.number - b.number);
  }
  function addContribution(inv, o, cents, date, ref) {
    inv.positions.push({ offeringId: o.id, amount: cents / 100, commitment: 0, date, ref });
  }
  /** Funds that can still call capital: closed-end, not exited, with unfunded commitments. */
  function callable(ws) {
    return ws.offerings.filter((o) => !isOpen(o) && !(o.exit && o.exit.basis === 'exited') && holdersOf(ws, o).some((i) => commitOf(i, o) > paidInOf(i, o)));
  }
  function unfunded(ws, o) {
    return holdersOf(ws, o).reduce((a, i) => a + Math.max(0, commitOf(i, o) - paidInOf(i, o) - pendingCalled(ws, o, i)), 0);
  }
  function pendingCalled(ws, o, inv) {
    return callsFor(ws, o).reduce((a, c) => a + c.items.filter((it) => it.investorId === inv.id && !it.received).reduce((s, it) => s + it.cents, 0), 0);
  }
  /** Split a call pro rata by commitment. Returns rows and any investor the call would over-draw. */
  function previewCall(ws, o, opts) {
    const holders = holdersOf(ws, o).filter((i) => commitOf(i, o) > 0);
    const commits = holders.map((i) => commitOf(i, o));
    const totalCommit = commits.reduce((a, b) => a + b, 0);
    const total = opts.cents != null ? Math.round(opts.cents) : Math.round(totalCommit * (opts.pct || 0));
    const parts = largest(total, commits);
    const rows = holders.map((inv, n) => {
      const before = Math.max(0, commits[n] - paidInOf(inv, o) - pendingCalled(ws, o, inv));
      return { inv, commit: commits[n], before, cents: parts[n], after: before - parts[n] };
    });
    return { rows, total, totalCommit, pct: totalCommit ? total / totalCommit : 0, over: rows.filter((r) => r.after < 0) };
  }
  function callNotice(ws, o, call, kind) {
    const outstanding = call.items.filter((it) => !it.received);
    const list = kind === 'reminder' ? outstanding : call.items;
    const amounts = {};
    list.forEach((it) => (amounts[it.investorId] = it.cents));
    const n = {
      id: `n-${call.id}-${kind}-${Date.now().toString(36)}`,
      date: today(),
      kind: kind === 'reminder' ? 'call-reminder' : 'call',
      audience: o.id,
      investors: [],
      includePending: true,
      quarter: '',
      docName: '',
      subject: kind === 'reminder' ? 'Reminder: capital call {call_number} for {investment} ({call_amount}) is due {due_date}' : 'Capital call {call_number} for {investment}: {call_amount} due {due_date}',
      body:
        kind === 'reminder'
          ? 'Dear {first_name},\n\nOur records show that your contribution of {call_amount} for capital call {call_number} of {investment} is due {due_date} and has not yet been received. Wire instructions are in your {portal_name}.\n\nIf you have already sent the wire, please disregard this reminder.\n\n{firm}'
          : 'Dear {first_name},\n\n{investment} is calling capital. Your contribution of {call_amount} is due {due_date}. Sign in to your {portal_name} for the wire instructions and the call notice.\n\nBefore sending a wire, call {team} at {phone} to confirm the instructions. We never change wire instructions by email.\n\n{firm}',
      recipients: list.map((it) => it.investorId),
      sentBy: NS.app && NS.app.can('configure') ? 'staff' : 'sponsor',
      amounts,
      due: call.due,
      callNumber: call.number,
      callId: call.id
    };
    ws.notices = ws.notices || [];
    ws.notices.push(n);
    return n;
  }
  function issueCall(ws, o, opts) {
    const pv = previewCall(ws, o, opts);
    if (!pv.total || pv.over.length) return null;
    const number = callsFor(ws, o).reduce((m, c) => Math.max(m, c.number), 0) + 1;
    const call = {
      id: `${o.id}-call-${number}-${Date.now().toString(36)}`,
      offeringId: o.id,
      number,
      noticeDate: today(),
      due: opts.due,
      pct: pv.pct,
      total: pv.total,
      purpose: opts.purpose || 'Portfolio investments and fund expenses',
      note: opts.note || '',
      status: 'open',
      items: pv.rows.filter((r) => r.cents > 0).map((r) => ({ investorId: r.inv.id, cents: r.cents, received: '', reminders: [] }))
    };
    ws.calls.push(call);
    callNotice(ws, o, call, 'call');
    log(ws, { action: 'Capital call issued', fund: o.id, record: call.id, detail: `Call ${number}: ${money(pv.total)} (${(pv.pct * 100).toFixed(2)}% of commitments) from ${call.items.length} investors, due ${dateShort(call.due)}` });
    save(ws);
    return call;
  }
  function receive(ws, call, investorId, date) {
    const o = ws.offerings.find((x) => x.id === call.offeringId);
    const it = call.items.find((x) => x.investorId === investorId);
    const inv = ws.investors.find((x) => x.id === investorId);
    if (!o || !it || !inv || it.received) return false;
    it.received = date || today();
    addContribution(inv, o, it.cents, it.received, call.id);
    if (call.items.every((x) => x.received)) call.status = 'complete';
    log(ws, { action: 'Capital call payment received', fund: o.id, record: call.id, detail: `${inv.title} (${inv.id}): ${money(it.cents)} received ${dateShort(it.received)} for call ${call.number}` });
    save(ws);
    return true;
  }
  function remind(ws, call) {
    const o = ws.offerings.find((x) => x.id === call.offeringId);
    const out = call.items.filter((it) => !it.received);
    if (!o || !out.length) return 0;
    out.forEach((it) => it.reminders.push(today()));
    callNotice(ws, o, call, 'reminder');
    log(ws, { action: 'Capital call reminder sent', fund: o.id, record: call.id, detail: `Call ${call.number}: reminder to ${out.length} investor${out.length === 1 ? '' : 's'} with ${money(out.reduce((a, it) => a + it.cents, 0))} outstanding` });
    save(ws);
    return out.length;
  }
  function callStatus(call, asOf) {
    const out = call.items.filter((it) => !it.received);
    if (!out.length) return { key: 'complete', label: 'Fully funded', out: 0, overdue: 0 };
    const late = (asOf || today()) > call.due;
    return { key: late ? 'overdue' : 'open', label: late ? 'Overdue' : 'Open', out: out.reduce((a, it) => a + it.cents, 0), overdue: late ? out.length : 0, count: out.length };
  }
  function wire(ws, o, inv, call) {
    const a = ws.tenant.ach || {};
    const acct = String((a.offset && a.offset.account) || '');
    return {
      bank: a.odfiName || 'Fund bank',
      aba: a.odfiRouting || '',
      account: acct ? `ending ${acct.slice(-4)}` : 'on file with investor relations',
      accountFull: acct || 'on file with investor relations',
      beneficiary: o.name,
      reference: `${o.shortName || o.name} call ${call.number}, ${inv.id}`
    };
  }

  /* ---------- Investor requests: redemptions and subscriptions ---------- */
  function firstInvested(inv, o) {
    return inv.positions.filter((p) => p.offeringId === o.id && p.amount > 0).map((p) => p.date).sort()[0] || '';
  }
  function requestsFor(ws, filter) {
    return (ws.requests || []).filter((r) => (!filter.offeringId || r.offeringId === filter.offeringId) && (!filter.investorId || r.investorId === filter.investorId));
  }
  function submitRedemption(ws, inv, o, opts) {
    const dealing = dealingDate(o, today(), firstInvested(inv, o));
    const r = { id: `req-${Date.now().toString(36)}`, type: 'redemption', offeringId: o.id, investorId: inv.id, submitted: today(), dealing, full: !!opts.full, cents: opts.full ? null : Math.round(opts.cents), status: 'pending', signedBy: opts.signature, signedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') };
    ws.requests.push(r);
    log(ws, { action: 'Redemption requested', fund: o.id, record: r.id, detail: `${inv.title} (${inv.id}): ${r.full ? 'full redemption' : money(r.cents)} at the ${dateShort(dealing)} dealing date; signed by ${opts.signature}`, actor: `${inv.title} (investor)` });
    save(ws);
    return r;
  }
  function submitSubscription(ws, inv, o, opts) {
    const open = isOpen(o);
    const r = { id: `req-${Date.now().toString(36)}`, type: 'subscription', offeringId: o.id, investorId: inv.id, cls: opts.cls || undefined, submitted: today(), dealing: open ? subscriptionDate(today()) : o.closeDate, cents: Math.round(opts.cents), additional: inv.positions.some((p) => p.offeringId === o.id), status: 'pending', signedBy: opts.signature, signedAt: opts.envelopeId ? '' : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') };
    // Signed through an e-signature envelope (the offering's subscription agreement template): signedAt is set when it completes.
    if (opts.envelopeId) r.envelopeId = opts.envelopeId;
    ws.requests.push(r);
    log(ws, { action: opts.envelopeId ? 'Subscription agreement sent for signature' : open ? 'Subscription requested' : 'Subscription documents signed', fund: o.id, record: r.id, detail: `${inv.title} (${inv.id}): ${money(r.cents)} ${open ? 'subscription' : 'commitment'}; ${opts.envelopeId ? `e-signature envelope ${opts.envelopeId}` : `signed by ${opts.signature}`}`, actor: `${inv.title} (investor)` });
    save(ws);
    return r;
  }
  function decide(ws, r, approve, note) {
    const o = ws.offerings.find((x) => x.id === r.offeringId);
    const inv = ws.investors.find((x) => x.id === r.investorId);
    if (!o || !inv || r.status !== 'pending') return false;
    r.status = approve ? 'approved' : 'rejected';
    r.decided = today();
    r.note = note || '';
    log(ws, { action: `${r.type === 'redemption' ? 'Redemption' : 'Subscription'} ${approve ? 'approved' : 'declined'}`, fund: o.id, record: r.id, detail: `${inv.title} (${inv.id})${note ? `: ${note}` : ''}` });
    save(ws);
    return true;
  }
  /** Capital redeemed at the dealing date, from the capital accounts (null until that month is closed). */
  function redemptionAmount(ws, r) {
    if (r.paidCents != null) return r.paidCents;
    const o = ws.offerings.find((x) => x.id === r.offeringId);
    if (!o || !NS.audit) return null;
    const L = NS.audit.ledger(ws, o);
    const m = L.byKey[keyOf(r.dealing)];
    return m && m.rows[r.investorId] && m.rows[r.investorId].redeem != null ? m.rows[r.investorId].redeem : null;
  }
  function markPaid(ws, r) {
    const amount = redemptionAmount(ws, r);
    const o = ws.offerings.find((x) => x.id === r.offeringId);
    const inv = ws.investors.find((x) => x.id === r.investorId);
    if (r.type !== 'redemption' || r.status !== 'approved' || amount == null || !o || !inv) return false;
    r.paidCents = amount;
    r.paid = today();
    r.status = 'paid';
    if (r.full) inv.positions.forEach((p) => p.offeringId === o.id && (p.redeemed = r.dealing));
    log(ws, { action: 'Redemption paid', fund: o.id, record: r.id, detail: `${inv.title} (${inv.id}): ${money(amount)} by ACH, ${r.full ? 'full' : 'partial'} redemption at ${dateShort(r.dealing)}` });
    save(ws);
    return true;
  }
  function markFunded(ws, r) {
    const o = ws.offerings.find((x) => x.id === r.offeringId);
    const inv = ws.investors.find((x) => x.id === r.investorId);
    if (r.type !== 'subscription' || r.status !== 'approved' || !o || !inv) return false;
    if (isOpen(o)) inv.positions.push(Object.assign({ offeringId: o.id, amount: r.cents / 100, date: r.dealing, ref: r.id }, r.cls ? { class: r.cls } : {}));
    else inv.positions.push(Object.assign({ offeringId: o.id, amount: 0, commitment: r.cents / 100, date: today(), ref: r.id }, r.cls ? { class: r.cls } : {}));
    r.status = isOpen(o) ? 'funded' : 'accepted';
    r.completed = today();
    log(ws, { action: isOpen(o) ? 'Subscription funded' : 'Subscription accepted', fund: o.id, record: r.id, detail: `${inv.title} (${inv.id}): ${money(r.cents)} ${isOpen(o) ? `subscription effective ${dateShort(r.dealing)}` : 'commitment countersigned'}` });
    save(ws);
    return true;
  }

  /* ---------- AML / KYC ---------- */
  const REVIEW_MONTHS = { Low: 24, Medium: 12, High: 6 };
  function kycOf(inv) {
    if (inv.kyc) return inv.kyc;
    const st = inv.onboarding && inv.onboarding.status;
    return { status: st === 'in_progress' ? 'pending' : 'not_started', risk: '', owners: [] };
  }
  function kycLabel(k, asOf) {
    if (k.status === 'cleared' && k.nextReview && k.nextReview < (asOf || today())) return { key: 'due', label: 'Re-screening due' };
    return { cleared: { key: 'cleared', label: 'Cleared' }, review: { key: 'review', label: 'Needs review' }, pending: { key: 'pending', label: 'Verification in progress' }, not_started: { key: 'not_started', label: 'Not started' }, rejected: { key: 'rejected', label: 'Not approved' } }[k.status] || { key: k.status, label: k.status };
  }
  function screen(ws, inv) {
    const k = Object.assign(kycOf(inv), {});
    const now = today();
    k.screenedOn = now;
    k.lists = 'OFAC SDN and consolidated lists, UN, EU, UK HMT, politically exposed persons, adverse media';
    if (k.status === 'cleared' || k.status === 'pending') {
      k.screening = 'clear';
      if (k.status === 'pending' && k.verifiedOn) k.status = 'cleared';
    }
    k.nextReview = D.addMonths(now, REVIEW_MONTHS[k.risk || 'Low'] || 12);
    inv.kyc = k;
    log(ws, { action: 'Sanctions and PEP screening run', record: inv.id, detail: `${inv.title}: ${k.screening === 'potential_match' ? 'potential match still open' : 'no matches'}; next review ${dateShort(k.nextReview)}` });
    save(ws);
    return k;
  }
  function clearMatch(ws, inv, note) {
    const k = kycOf(inv);
    if (k.status !== 'review') return false;
    k.status = 'cleared';
    k.screening = 'clear';
    k.reviewedOn = today();
    k.reviewer = NS.app && NS.app.actor ? NS.app.actor() : '';
    k.reviewNote = note;
    k.nextReview = D.addMonths(today(), REVIEW_MONTHS[k.risk || 'Low'] || 12);
    inv.kyc = k;
    log(ws, { action: 'Screening match cleared', record: inv.id, detail: `${inv.title}: ${k.match ? `${k.match.list} match on “${k.match.name}”` : 'potential match'} cleared as a false positive. ${note}` });
    save(ws);
    return true;
  }
  function escalate(ws, inv, note) {
    const k = kycOf(inv);
    k.escalated = today();
    k.reviewNote = note;
    inv.kyc = k;
    log(ws, { action: 'Screening match escalated', record: inv.id, detail: `${inv.title}: escalated to the AML compliance officer. ${note}` });
    save(ws);
    return true;
  }
  function approveIdentity(ws, inv) {
    const k = kycOf(inv);
    if (k.status !== 'pending' || !k.verifiedOn) return false;
    k.status = k.screening === 'potential_match' ? 'review' : 'cleared';
    inv.kyc = k;
    log(ws, { action: 'Identity verification approved', record: inv.id, detail: `${inv.title}: ${k.method || 'documents reviewed'}` });
    save(ws);
    return true;
  }

  /* ---------- Published documents (files kept in this browser's IndexedDB in the demo) ---------- */
  const files = (() => {
    let dbp = null;
    function db() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        try {
          const r = indexedDB.open('cvp-documents', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('files');
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        } catch (e) {
          rej(e);
        }
      });
      return dbp;
    }
    const tx = (mode, fn) => db().then((d) => new Promise((res, rej) => {
      const t = d.transaction('files', mode);
      const req = fn(t.objectStore('files'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    }));
    return {
      put: (id, blob) => tx('readwrite', (s) => s.put(blob, id)),
      get: (id) => tx('readonly', (s) => s.get(id)),
      del: (id) => tx('readwrite', (s) => s.delete(id))
    };
  })();
  function docsFor(ws, inv) {
    const held = (oid) => inv.positions.some((p) => p.offeringId === oid);
    return (ws.docs || []).filter((d) => !d.hidden && (d.audience === 'investors' ? (d.investors || []).indexOf(inv.id) >= 0 : d.offeringId ? held(d.offeringId) : true));
  }
  function recipientsOf(ws, d) {
    if (d.audience === 'investors') return ws.investors.filter((i) => (d.investors || []).indexOf(i.id) >= 0);
    return d.offeringId ? ws.investors.filter((i) => i.positions.some((p) => p.offeringId === d.offeringId)) : ws.investors.slice();
  }
  /** Investor IDs (e.g. PBP-1004) found in a file name. */
  function matchIds(ws, name) {
    const re = new RegExp(`${ws.tenant.idPrefix}-\\d{4}`, 'gi');
    const found = (String(name).match(re) || []).map((x) => x.toUpperCase());
    return ws.investors.filter((i) => found.indexOf(i.id.toUpperCase()) >= 0).map((i) => i.id);
  }

  /* ---------- Capital account for one investor (statements and the investment page) ---------- */
  function capital(ws, inv, o, from, to) {
    if (!NS.audit) return null;
    const P = NS.audit.period(ws, o, from, to);
    const a = P.inv.find((x) => x.investor.id === inv.id);
    if (!a) return null;
    const L = P.L;
    const flows = [];
    L.contribs.forEach((c) => c.inv.id === inv.id && c.date <= P.to && flows.push({ date: c.date, amt: -c.cents / 100 }));
    L.dists.forEach((d) => d.inv.id === inv.id && d.date <= P.to && flows.push({ date: d.date, amt: d.cents / 100 }));
    (L.redemptions || []).forEach((d) => d.inv.id === inv.id && d.date <= P.to && flows.push({ date: d.date, amt: d.cents / 100 }));
    flows.sort((x, y) => (x.date < y.date ? -1 : 1));
    if (a.end > 0) flows.push({ date: P.to, amt: a.end / 100 });
    const paid = -flows.filter((f) => f.amt < 0).reduce((s, f) => s + f.amt, 0);
    const out = flows.filter((f) => f.amt > 0).reduce((s, f) => s + f.amt, 0);
    return { a, P, irr: flows.length > 1 ? NS.audit.xirr(flows) : null, tvpi: paid ? out / paid : null, paid: Math.round(paid * 100), asOf: P.to };
  }

  /* ---------- Seeding sample activity (once per workspace) ---------- */
  function hash(s) {
    return NS.data.hashStr(s);
  }
  function seedCalls(ws) {
    ws.offerings.forEach((o) => {
      if (ws.calls.some((c) => c.offeringId === o.id)) return;
      const cfg = configOf(o) || {};
      const sched = o.calls || cfg.calls;
      if (!sched) return;
      const recs = sched.map((c, n) => ({
        id: `${o.id}-call-${n + 1}`,
        offeringId: o.id,
        number: n + 1,
        noticeDate: businessDays(c[0], -10),
        due: c[0],
        pct: c[1],
        total: 0,
        purpose: n === 0 ? 'Initial closing: investments and organizational expenses' : 'Portfolio investments and fund expenses',
        note: '',
        status: 'complete',
        items: []
      }));
      holdersOf(ws, o).forEach((inv) =>
        inv.positions
          .filter((p) => p.offeringId === o.id)
          .forEach((p) => {
            const parts = largest(Math.round(p.amount * 100), sched.map((c) => c[1]));
            recs.forEach((r, n) => {
              if (!parts[n]) return;
              const was = r.items.find((x) => x.investorId === inv.id);
              const when = sched[n][0] < p.date ? p.date : sched[n][0];
              if (was) was.cents += parts[n];
              else r.items.push({ investorId: inv.id, cents: parts[n], received: when, reminders: [] });
            });
          })
      );
      recs.forEach((r) => (r.total = r.items.reduce((a, x) => a + x.cents, 0)));
      ws.calls.push(...recs);
      // Sample: a call still being collected.
      const oc = cfg.openCall;
      if (oc && oc.notice <= today()) {
        const holders = holdersOf(ws, o).filter((i) => commitOf(i, o) > 0).sort((a, b) => (a.id < b.id ? -1 : 1));
        const commits = holders.map((i) => commitOf(i, o));
        const total = Math.round(commits.reduce((a, b) => a + b, 0) * oc.pct);
        const parts = largest(total, commits);
        const outstanding = new Set([holders[0] && holders[0].id, holders[holders.length - 1] && holders[holders.length - 1].id]);
        const call = { id: `${o.id}-call-${recs.length + 1}`, offeringId: o.id, number: recs.length + 1, noticeDate: oc.notice, due: oc.due, pct: oc.pct, total, purpose: oc.purpose, note: '', status: 'open', items: [] };
        holders.forEach((inv, n) => {
          if (!parts[n]) return;
          const rec = outstanding.has(inv.id) ? '' : addDays(oc.notice, 3 + (hash(inv.id + o.id) % 6));
          const received = rec && rec <= today() ? rec : '';
          call.items.push({ investorId: inv.id, cents: parts[n], received, reminders: [] });
          if (received) addContribution(inv, o, parts[n], received, call.id);
        });
        if (call.items.every((x) => x.received)) call.status = 'complete';
        ws.calls.push(call);
        const amounts = {};
        call.items.forEach((it) => (amounts[it.investorId] = it.cents));
        ws.notices = ws.notices || [];
        ws.notices.push({
          id: `n-${call.id}`,
          date: oc.notice,
          kind: 'call',
          audience: o.id,
          investors: [],
          includePending: true,
          quarter: '',
          docName: '',
          subject: 'Capital call {call_number} for {investment}: {call_amount} due {due_date}',
          body: 'Dear {first_name},\n\n{investment} is calling capital. Your contribution of {call_amount} is due {due_date}. Sign in to your {portal_name} for the wire instructions and the call notice.\n\nBefore sending a wire, call {team} at {phone} to confirm the instructions. We never change wire instructions by email.\n\n{firm}',
          recipients: call.items.map((it) => it.investorId),
          sentBy: 'sponsor',
          amounts,
          due: oc.due,
          callNumber: call.number,
          callId: call.id
        });
      }
    });
  }
  function seedKyc(ws) {
    const people = ws.investors.filter((i) => !i.kyc);
    const now = today();
    let n = 0;
    people.forEach((i) => {
      const ob = i.onboarding || {};
      const entity = i.type === 'entity' || i.type === 'trust' || i.type === 'ira';
      const owners = i.type === 'joint' ? String(i.title).replace(/,.*$/, '').split(/ and /).map((x, k, arr) => ({ name: arr.length > 1 && k === 0 && !/\s/.test(x.trim()) ? `${x.trim()} ${String(i.contact).split(' ').pop()}` : x.trim(), pct: 50 })) : entity ? [{ name: i.contact, pct: i.type === 'ira' ? 100 : 100, role: i.type === 'trust' ? 'Trustee' : i.type === 'ira' ? 'Account owner' : 'Controlling person' }] : [{ name: i.contact, pct: 100 }];
      const risk = entity ? 'Medium' : 'Low';
      if (ob.status !== 'complete') {
        i.kyc = { status: ob.status === 'in_progress' ? 'pending' : 'not_started', risk, owners, verifiedOn: '', method: '', screenedOn: '', screening: '', nextReview: '' };
        return;
      }
      n += 1;
      const verified = ob.completed || ob.invited || now;
      let screened = addDays(now, -(20 + (hash(i.id + 'scr') % 300)));
      if (screened < verified) screened = verified;
      const k = { status: 'cleared', risk, owners, verifiedOn: verified, method: entity ? 'Formation documents and beneficial owner IDs' : 'Government ID with selfie match', screenedOn: screened, screening: 'clear', lists: 'OFAC SDN and consolidated lists, UN, EU, UK HMT, politically exposed persons, adverse media', nextReview: D.addMonths(screened, REVIEW_MONTHS[risk]) };
      if (n === 3) {
        k.status = 'review';
        k.screening = 'potential_match';
        k.match = { list: 'OFAC SDN list', name: `${String(i.contact).split(' ').pop().toUpperCase()}, ${String(i.contact).split(' ')[0].toUpperCase().slice(0, 1)}.`, score: 0.82, detail: 'Name similarity only; date of birth and country do not match the listed party.' };
        k.screenedOn = addDays(now, -2);
      }
      if (n === 5) {
        k.screenedOn = D.addMonths(now, -(REVIEW_MONTHS[risk] + 1));
        k.nextReview = D.addMonths(k.screenedOn, REVIEW_MONTHS[risk]);
      }
      i.kyc = k;
    });
  }
  function seedRequests(ws) {
    if (ws.requests.length) return;
    ws.offerings.forEach((o) => {
      const cfg = configOf(o) || {};
      (cfg.requests || []).forEach((q, idx) => {
        const holders = holdersOf(ws, o).filter((i) => i.onboarding.status === 'complete').sort((a, b) => (a.id < b.id ? -1 : 1));
        let inv = null;
        if (q.who === 'jordan') inv = ws.investors.find((i) => /-1001$/.test(i.id));
        else if (q.who === 'holder') inv = holders.find((i) => !/-1001$/.test(i.id) && firstInvested(i, o) <= D.addMonths(q.submitted, -13));
        else inv = ws.investors.filter((i) => i.onboarding.status === 'complete' && !/-1001$/.test(i.id) && !i.positions.some((p) => p.offeringId === o.id)).sort((a, b) => (a.id < b.id ? -1 : 1))[1];
        if (!inv || q.submitted > today()) return;
        const base = { id: `req-${o.id}-${idx + 1}`, offeringId: o.id, investorId: inv.id, submitted: q.submitted, status: q.status, signedBy: inv.contact, signedAt: `${q.submitted}T15:12:00Z` };
        let r;
        if (q.type === 'redemption') {
          const cap = Math.round(paidInOf(inv, o) * 0.4);
          r = Object.assign(base, { type: 'redemption', dealing: dealingDate(o, q.submitted, firstInvested(inv, o)), full: !!q.full, cents: q.full ? null : Math.min(q.amount * 100, cap) });
          if (q.status !== 'pending') r.decided = businessDays(q.submitted, 3);
          if (q.status === 'paid') {
            r.paid = q.paid;
            if (r.full) inv.positions.forEach((p) => p.offeringId === o.id && (p.redeemed = r.dealing));
          }
        } else {
          r = Object.assign(base, { type: 'subscription', dealing: isOpen(o) ? subscriptionDate(q.submitted) : o.closeDate, cents: q.amount * 100, additional: false });
        }
        ws.requests.push(r);
      });
    });
  }
  /** Add operations records to a workspace once: past capital calls, KYC files and sample requests. */
  function ensure(ws) {
    if (!ws || ws.opsV === 1) return ws;
    ws.calls = ws.calls || [];
    ws.requests = ws.requests || [];
    ws.docs = ws.docs || [];
    seedCalls(ws);
    seedKyc(ws);
    seedRequests(ws);
    ws.opsV = 1;
    if (NS.clearCaches) NS.clearCaches();
    return ws;
  }

  NS.ops = {
    ensure,
    isOpen,
    liquidity,
    dealingDate,
    subscriptionDate,
    callsFor,
    callable,
    unfunded,
    previewCall,
    issueCall,
    receive,
    remind,
    callStatus,
    wire,
    commitOf,
    paidInOf,
    firstInvested,
    requestsFor,
    submitRedemption,
    submitSubscription,
    decide,
    redemptionAmount,
    markPaid,
    markFunded,
    kycOf,
    kycLabel,
    screen,
    clearMatch,
    escalate,
    approveIdentity,
    REVIEW_MONTHS,
    files,
    docsFor,
    recipientsOf,
    matchIds,
    capital,
    businessDays,
    money
  };
})(window.CVPortal);
