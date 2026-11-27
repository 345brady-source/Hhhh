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

  NS.achRecord = { ensure, keyOf, modifierFor, targetOf, sentFor, filesOf, paidRun, recordFile, attach, canPay, sentOn, longDay, MODIFIERS };
})(window.CVPortal);
