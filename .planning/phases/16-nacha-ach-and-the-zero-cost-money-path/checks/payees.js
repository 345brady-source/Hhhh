// gate: node
// last "PAYEES: PASS (cases run: 9)"
// Who may be paid in a payment file, and how (plan 16-07; AC-03, AC-07, AC-11, AC-12, AC-16; C-03, C-15, D-04, D-06),
// no browser. NS.achRecord (assets/js/achrecord.js) is loaded with the portal's own scripts (phase 11's load11.js
// through lib16, edition 'diy' unless a case says managed, today 2026-11-19; books.js and books-post.js added so a
// redemption amount can come from the books).
//   node payees.js [--case states,entries,prenotes,bic,iban,wires,status,redemptions,privacy]
// Fixtures: the Kestrel Bay sample workspace with the bank details of the investors a case uses replaced by never-issued
// ones (routing numbers 190000017, 190000020, 190000033; accounts '99' + 8 digits, lib16 account()); a small open-ended
// fund of the check's own for redemptions; IBANs made by the check from the country code 'ZZ' (no country has it) and
// made-up characters, and fictional BICs. No full account number, IBAN or file text is printed: only ids, states,
// sentences and last fours.
// One PASS or FAIL line per check; the last line is "PAYEES: PASS (cases run: N)" or
// "PAYEES: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('./lib16.js');

const NAME = 'PAYEES';
const TODAY = '2026-11-19';
const ODFI = '190000091';
const RDFI = ['190000017', '190000020', '190000033'];
const TENANT = { ach: { immediateOrigin: '1990000001', destinationRouting: ODFI, odfiRouting: ODFI } };
const ADMIN = 'Pat Admin';
const J = JSON.stringify;
const longDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** The portal in a fresh context with the Kestrel Bay sample workspace. */
function portal(edition) {
  const NS = L.loadPortal(undefined, { today: TODAY, edition: edition || 'diy', extra: ['books.js', 'books-post.js'] });
  const ws = L.sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
  if (!ws) throw new Error('the Kestrel Bay sample did not load');
  if (!NS.achRecord) throw new Error('NS.achRecord is not loaded');
  return { NS, ws, R: NS.achRecord };
}
/** The sample's investors paid by ACH, in register order. */
const achPayees = (ws) => ws.investors.filter((i) => i.payment && i.payment.method === 'ach' && i.payment.bank);
const checkPayee = (ws) => ws.investors.find((i) => i.payment && i.payment.method === 'check');
/** Never-issued bank details on an investor (account n). */
function neverBank(inv, n, type) {
  inv.payment = { method: 'ach', bank: { holder: inv.title, routing: RDFI[n % 3], account: L.account(n), type: type || 'checking' } };
  return inv;
}
/** An IBAN made by the check: 'ZZ', its ISO 13616 mod 97 check digits, then body (11 to 30 letters and digits). */
function makeIban(body) {
  const num = (s) => s.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  const mod = (s) => s.split('').reduce((a, d) => (a * 10 + Number(d)) % 97, 0);
  const check = 98 - mod(num(body + 'ZZ00'));
  return 'ZZ' + String(check).padStart(2, '0') + body;
}
const IBAN_BODY = 'CHKB9912345678901234';
/** International wire details (D-04) on an investor; its ACH bank removed. */
function wirePayee(inv, over) {
  inv.payment = {
    method: 'wire',
    bank: null,
    wire: Object.assign(
      { beneficiary: inv.title, address: '1 Check Street, Testville', bankName: 'Check Test Bank', country: 'Germany', bic: 'ZZBKZZ22', iban: makeIban(IBAN_BODY), account: '', intermediary: null, at: '2026-11-01T15:00:00.000Z' },
      over || {}
    )
  };
  return inv;
}
/** A new investor who holds nothing and was never paid, with never-issued bank details. */
function freshInvestor(ws, id, n) {
  const inv = { id, contact: 'Fresh Check', title: 'Fresh Check Investor', type: 'individual', email: `${id.toLowerCase()}@example.com`, taxForm: 'W-9', onboarding: { status: 'complete', step: 5 }, positions: [] };
  neverBank(inv, n);
  ws.investors.push(inv);
  return inv;
}
/**
 * Build a file of entries with the portal's own builder and store its record (recordFile), as the console does when it
 * leaves. o: { effective, now (Date), at, for, runId, offeringId }.
 */
function sendFile(NS, ws, entries, o) {
  const R = NS.achRecord;
  const created = o.now;
  const p = (x) => String(x).padStart(2, '0');
  const day = `${created.getFullYear()}-${p(created.getMonth() + 1)}-${p(created.getDate())}`;
  const modifier = R.modifierFor(ws, TENANT, day);
  const f = NS.nacha.build({
    origin: { destinationRouting: ODFI, destinationName: 'CHECK ORIGIN BANK', immediateOrigin: '1990000001', originName: 'CHECK FUND LLC', odfiRouting: ODFI },
    company: { name: 'CHECK FUND LLC', id: '1990000001' },
    entries,
    effectiveDate: o.effective,
    description: o.for === 'prenote' ? 'PRENOTE' : 'DISTRIB',
    modifier,
    now: created
  });
  f.filename = `CHECK_FUND_LLC_${o.effective.replace(/-/g, '')}_${modifier}.ach`;
  f.modifier = modifier;
  const rec = R.recordFile(ws, f, { for: o.for || 'distribution', runId: o.runId || '', offeringId: o.offeringId || 'kb-fund-ii', effective: o.effective, how: 'download', by: ADMIN, at: o.at, again: null, tenant: TENANT, refs: {} });
  return { f, rec };
}
/** The sentence an Error carries, or '' when fn does not throw. */
function thrown(fn) {
  try {
    fn();
    return '';
  } catch (e) {
    return String((e && e.message) || e);
  }
}
const heldOf = (list) => list.map((x) => ({ id: x.investor.id, kind: x.kind, reason: x.reason, until: x.until || '' }));
const R_WIRE = 'Paid by international wire: see "Wires".';
const R_NEW = 'A pre-note checks this account first: build it on the ACH origination page.';
const R_UNCONFIRMED = 'The investor changed this account: an admin confirms it before it is paid.';
const rPrenote = (until) => `Can be paid from ${longDay(until)}, three banking days after its pre-note.`;
const rReturned = (code, date) => `Returned by the bank (${code}, ${shortDay(date)}): waits for new bank details.`;
const rPending = (since) => `A change from the bank waits for an admin since ${shortDay(since)}.`;

const parts = {
  // AC-07 (C-03) and the stored states: an account saved before this phase and already paid is ready; one never paid is
  // new; markNew makes it new; its pre-note makes it 'prenote-sent' until three banking days after the pre-note's
  // effective date by the holiday rule (16-CONTEXT B3: 2029-07-02 is ready on 2029-07-06, not 07-05); returned, blocked
  // and the investor's own change ('unconfirmed', D-04) read back with their words; a change from the bank (pending) is
  // held only after 6 banking days and a later sent file holding this investor (re-check B1); wire and check payees.
  async states({ check }) {
    const { NS, ws, R } = portal();
    const names = ['checkOf', 'setCheck', 'markNew', 'confirmChange', 'prenotesOn', 'prenotesDue', 'prenoteEntries', 'prenotesSent', 'fileEntries'];
    check('NS.achRecord has the payee functions', names.every((k) => typeof R[k] === 'function'), names.filter((k) => typeof R[k] !== 'function'));
    const [a, b, c, d, e] = achPayees(ws);
    [a, b, c, d, e].forEach((x, k) => neverBank(x, k + 1));
    check('the sample investor (paid before this phase, no check on record) is ready', R.checkOf(ws, a, TODAY).state === 'ready', R.checkOf(ws, a, TODAY));
    const fresh = freshInvestor(ws, 'KBC-9001', 8);
    check('an investor never paid, with no check on record, is new', R.checkOf(ws, fresh, TODAY).state === 'new', R.checkOf(ws, fresh, TODAY).state);
    R.markNew(a, '2029-06-28T15:00:00.000Z');
    check('markNew writes bank.check { state: new, at }', J(a.payment.bank.check) === J({ state: 'new', at: '2029-06-28T15:00:00.000Z' }), a.payment.bank.check);
    check('markNew makes the paid investor new', R.checkOf(ws, a, '2029-06-28').state === 'new');
    // its pre-note: effective Monday 2029-07-02, Independence Day on Wednesday
    check('B3: nextBankingDay(2029-07-02, 3) is 2029-07-06 (July 4 is a Federal Reserve holiday)', NS.nacha.nextBankingDay('2029-07-02', 3) === '2029-07-06', NS.nacha.nextBankingDay('2029-07-02', 3));
    const pre = R.prenoteEntries(ws, '2029-06-28').filter((x) => x.id === a.id);
    check('its pre-note entry is offered: kind prenote, $0, ref the investor id', pre.length === 1 && pre[0].kind === 'prenote' && pre[0].cents === 0 && pre[0].ref === a.id && pre[0].account === L.account(1), pre.map((x) => ({ id: x.id, kind: x.kind, cents: x.cents, ref: x.ref })));
    const { f, rec } = sendFile(NS, ws, pre, { effective: '2029-07-02', now: new Date(2029, 5, 28, 10, 0), at: '2029-06-28T15:00:00.000Z', for: 'prenote' });
    check('the pre-note file builds with no red check and its record holds a prenote entry', f.blocked.length === 0 && rec.for === 'prenote' && rec.entries.length === 1 && rec.entries[0].kind === 'prenote', { blocked: f.blocked.map((x) => x.label), entries: rec.entries.map((x) => x.kind) });
    R.prenotesSent(ws, rec, { by: ADMIN, at: '2029-06-28T15:01:00.000Z' });
    const ck = a.payment.bank.check;
    check('prenotesSent: state prenote-sent, date the effective date, until 2029-07-06, fileId the record', ck.state === 'prenote-sent' && ck.date === '2029-07-02' && ck.until === '2029-07-06' && ck.fileId === rec.id, ck);
    const on5 = R.checkOf(ws, a, '2029-07-05');
    check("on 2029-07-05 it is 'prenote-sent' until 2029-07-06", on5.state === 'prenote-sent' && on5.until === '2029-07-06' && on5.words === rPrenote('2029-07-06'), on5);
    check("on 2029-07-06 it is 'ready'", R.checkOf(ws, a, '2029-07-06').state === 'ready', R.checkOf(ws, a, '2029-07-06'));
    // returned and blocked, as stored
    R.setCheck(ws, b, 'returned', { code: 'R03', date: '2026-11-10', by: ADMIN, at: '2026-11-10T15:00:00.000Z' });
    const rb = R.checkOf(ws, b, TODAY);
    check('a stored return reads back with its code, date and words', rb.state === 'returned' && rb.code === 'R03' && rb.date === '2026-11-10' && rb.words === rReturned('R03', '2026-11-10'), rb);
    R.setCheck(ws, c, 'blocked', { why: 'The bank asked us to stop paying this account.', by: ADMIN, at: '2026-11-12T15:00:00.000Z' });
    const rc = R.checkOf(ws, c, TODAY);
    check('a stored block reads back with its reason as its words', rc.state === 'blocked' && rc.why === 'The bank asked us to stop paying this account.' && rc.words === rc.why, rc);
    const chk = checkPayee(ws);
    check('setCheck is refused for an investor with no ACH bank', /no bank account/i.test(thrown(() => R.setCheck(ws, chk, 'new', { at: 'x' }))), thrown(() => R.setCheck(ws, chk, 'new', { at: 'x' })));
    check('setCheck is refused for a state that is not stored', !!thrown(() => R.setCheck(ws, c, 'ready', {})) && !!thrown(() => R.setCheck(ws, c, 'unconfirmed', {})) && c.payment.bank.check.state === 'blocked');
    // the investor's own change (D-04, written by 15-15) and its confirmation
    d.payment.bank.check = { state: 'unconfirmed', at: '2026-11-15T15:00:00.000Z', by: 'investor' };
    const rd = R.checkOf(ws, d, TODAY);
    check("an investor's own change reads 'unconfirmed' with its words", rd.state === 'unconfirmed' && rd.words === R_UNCONFIRMED, rd);
    const noPerson = thrown(() => R.confirmChange(ws, d, { by: '  ', at: '2026-11-16T15:00:00.000Z' }));
    check('confirmChange is refused with no person, and the state stays', /name of the person/.test(noPerson) && d.payment.bank.check.state === 'unconfirmed', noPerson);
    R.confirmChange(ws, d, { by: ADMIN, at: '2026-11-16T15:00:00.000Z' });
    check("confirmChange moves it to { state: 'new', at, by }", J(d.payment.bank.check) === J({ state: 'new', at: '2026-11-16T15:00:00.000Z', by: ADMIN }), d.payment.bank.check);
    check('confirmChange is refused when no change waits', !!thrown(() => R.confirmChange(ws, d, { by: ADMIN, at: '2026-11-16T15:00:00.000Z' })));
    // a change sent by the bank (NOC, written by 16-08), dated Monday 2026-11-02 (Veterans Day 11-11 is a holiday)
    const since = '2026-11-02';
    e.payment.bank.pending = { code: 'C01', account: L.account(7), date: since, at: '2026-11-02T15:00:00.000Z' };
    const d5 = NS.nacha.nextBankingDay(since, 5);
    const d7 = NS.nacha.nextBankingDay(since, 7);
    check('5 and 7 banking days after 2026-11-02 are 2026-11-09 and 2026-11-12', d5 === '2026-11-09' && d7 === '2026-11-12', [d5, d7]);
    const p5 = R.checkOf(ws, e, d5);
    check('pending 5 banking days with no file since: pending, not held, since its date', p5.state === 'pending' && p5.held === false && p5.date === since, p5);
    const p7 = R.checkOf(ws, e, d7);
    check('pending 7 banking days with no file since: not held (old details paid before the next payment)', p7.state === 'pending' && p7.held === false, p7);
    sendFile(NS, ws, [{ name: e.title, id: e.id, routing: e.payment.bank.routing, account: e.payment.bank.account, accountType: 'checking', cents: 1000, sec: 'PPD' }], { effective: '2026-11-06', now: new Date(2026, 10, 5, 10, 0), at: '2026-11-05T15:00:00.000Z' });
    const q7 = R.checkOf(ws, e, d7);
    check('pending 7 banking days with a sent file since holding this investor: held, with its words', q7.state === 'pending' && q7.held === true && q7.words === rPending(since), q7);
    check('and 5 banking days with that file: still not held', R.checkOf(ws, e, d5).held === false);
    // wire and check payees
    const w = wirePayee(achPayees(ws)[5]);
    check('a wire payee is wire', R.checkOf(ws, w, TODAY).state === 'wire', R.checkOf(ws, w, TODAY));
    check('a check payee is none', R.checkOf(ws, chk, TODAY).state === 'none', R.checkOf(ws, chk, TODAY));
    // W5 order: an investor change wins over a pending bank change
    const u = achPayees(ws)[6];
    neverBank(u, 6);
    u.payment.bank.check = { state: 'unconfirmed', at: '2026-11-15T15:00:00.000Z', by: 'investor' };
    u.payment.bank.pending = { code: 'C01', account: L.account(5), date: since, at: '2026-11-02T15:00:00.000Z' };
    check('W5: unconfirmed with a pending change reads unconfirmed', R.checkOf(ws, u, d7).state === 'unconfirmed');
  },

  // AC-03: a file's entries are only accounts that may be paid on its effective date; every other investor is held with
  // one reason (exact sentences); check payees are neither. B4: an investor's own change is held in both editions with
  // pre-notes on or off; W5: with a bank change waiting too, it is held with the unconfirmed reason.
  async entries({ check }) {
    const setup = (edition) => {
      const { NS, ws, R } = portal(edition);
      const p = achPayees(ws);
      const ready = neverBank(p[0], 1);
      const wire = wirePayee(p[1]);
      const fresh = neverBank(p[2], 2);
      R.markNew(fresh, '2026-11-18T15:00:00.000Z');
      const pre = neverBank(p[3], 3);
      const returned = neverBank(p[4], 4);
      const noSec = neverBank(p[5], 5);
      noSec.type = 'partnership-unknown';
      const unconf = neverBank(p[6], 6);
      unconf.payment.bank.check = { state: 'unconfirmed', at: '2026-11-15T15:00:00.000Z', by: 'investor' };
      const both = neverBank(p[7], 7);
      both.payment.bank.check = { state: 'unconfirmed', at: '2026-11-15T15:00:00.000Z', by: 'investor' };
      both.payment.bank.pending = { code: 'C01', account: L.account(17), date: '2026-11-02', at: '2026-11-02T15:00:00.000Z' };
      const chk = checkPayee(ws);
      return { NS, ws, R, ready, wire, fresh, pre, returned, noSec, unconf, both, chk };
    };
    const s = setup('diy');
    const { NS, ws, R } = s;
    check('pre-notes are on in the self-serve edition by default', R.prenotesOn(ws) === true);
    // the pre-note for one account, effective 2026-11-20: payable from 2026-11-25 (Thanksgiving is 11-26)
    R.markNew(s.pre, '2026-11-18T15:00:00.000Z');
    const preEntry = R.prenoteEntries(ws, TODAY).filter((x) => x.id === s.pre.id);
    const { rec } = sendFile(NS, ws, preEntry, { effective: '2026-11-20', now: new Date(2026, 10, 19, 9, 0), at: '2026-11-19T14:00:00.000Z', for: 'prenote' });
    R.prenotesSent(ws, rec, { by: ADMIN, at: '2026-11-19T14:01:00.000Z' });
    check('the pre-noted account can be paid from 2026-11-25', s.pre.payment.bank.check.until === '2026-11-25', s.pre.payment.bank.check);
    R.setCheck(ws, s.returned, 'returned', { code: 'R03', date: '2026-11-10', by: ADMIN, at: '2026-11-10T15:00:00.000Z' });
    const rows = [s.ready, s.wire, s.fresh, s.pre, s.returned, s.noSec, s.unconf, s.both, s.chk].map((investor, k) => ({ investor, cents: 10000 + k }));
    const out = R.fileEntries(ws, rows, { today: TODAY, effective: '2026-11-20' });
    const ids = out.entries.map((x) => x.id);
    check('entries: the ready account and the one with no SEC code', J(ids) === J([s.ready.id, s.noSec.id]), ids);
    const re = out.entries[0] || {};
    check("an entry carries the payee's name, id, bank details, cents, SEC and the investor id as ref", re.name === s.ready.payment.bank.holder && re.routing === RDFI[1] && re.account === L.account(1) && re.accountType === 'checking' && re.cents === 10000 && re.sec === (NS.ENTITY_TYPES[s.ready.type] || {}).sec && re.ref === s.ready.id, { name: re.name, cents: re.cents, sec: re.sec, ref: re.ref });
    check('the entry with an unknown investor type has sec undefined', (out.entries[1] || {}).sec === undefined && 'sec' in (out.entries[1] || {}), out.entries[1] && out.entries[1].sec);
    const want = [
      { id: s.wire.id, kind: 'wire', reason: R_WIRE, until: '' },
      { id: s.fresh.id, kind: 'new', reason: R_NEW, until: '' },
      { id: s.pre.id, kind: 'prenote-sent', reason: rPrenote('2026-11-25'), until: '2026-11-25' },
      { id: s.returned.id, kind: 'returned', reason: rReturned('R03', '2026-11-10'), until: '' },
      { id: s.unconf.id, kind: 'unconfirmed', reason: R_UNCONFIRMED, until: '' },
      { id: s.both.id, kind: 'unconfirmed', reason: R_UNCONFIRMED, until: '' }
    ];
    check('held: the other six with their exact reasons and dates, in row order', J(heldOf(out.held)) === J(want), heldOf(out.held));
    check('held keeps the cents to pay', out.held.map((x) => x.cents).join() === '10001,10002,10003,10004,10006,10007', out.held.map((x) => x.cents));
    check('the check payee is neither an entry nor held', !ids.includes(s.chk.id) && !out.held.some((x) => x.investor.id === s.chk.id));
    // the builder leaves the entry with no SEC out with its reason
    const built = NS.nacha.build({ origin: { destinationRouting: ODFI, destinationName: 'CHECK ORIGIN BANK', immediateOrigin: '1990000001', originName: 'CHECK FUND LLC', odfiRouting: ODFI }, company: { name: 'CHECK FUND LLC', id: '1990000001' }, entries: out.entries, effectiveDate: '2026-11-20', description: 'DISTRIB', now: new Date(2026, 10, 19, 10, 0) });
    check("the builder writes the ready entry and leaves the no-SEC one out with 'No SEC type'", built.entries.length === 1 && built.entries[0].id === s.ready.id && built.excluded.length === 1 && built.excluded[0].reason === 'No SEC type', { written: built.entries.map((x) => x.id), excluded: built.excluded.map((x) => x.reason) });
    // the effective date on the pre-note's until: an entry
    const on = R.fileEntries(ws, rows, { today: TODAY, effective: '2026-11-25' });
    check('with the effective date on until (2026-11-25) the pre-noted account is an entry', on.entries.some((x) => x.id === s.pre.id) && !on.held.some((x) => x.investor.id === s.pre.id), on.entries.map((x) => x.id));
    // pre-notes off: the new account is payable, the investor's own change still held
    ws.tenant.ach.prenotes = false;
    check('tenant.ach.prenotes false turns pre-notes off', R.prenotesOn(ws) === false);
    const off = R.fileEntries(ws, rows, { today: TODAY, effective: '2026-11-20' });
    check('pre-notes off: the new account is an entry', off.entries.some((x) => x.id === s.fresh.id), off.entries.map((x) => x.id));
    check('pre-notes off: both unconfirmed accounts are still held with their reason', J(heldOf(off.held).filter((x) => x.kind === 'unconfirmed')) === J(want.slice(4)), heldOf(off.held));
    // the managed edition: no pre-notes; the investor's own change held
    const m = setup('managed');
    check('managed edition: pre-notes are off', m.R.prenotesOn(m.ws) === false);
    const mo = m.R.fileEntries(m.ws, [m.fresh, m.unconf, m.both].map((investor) => ({ investor, cents: 5000 })), { today: TODAY, effective: '2026-11-20' });
    check('managed edition: a new account is paid, both unconfirmed accounts are held with their reason', J(mo.entries.map((x) => x.id)) === J([m.fresh.id]) && J(heldOf(mo.held)) === J([{ id: m.unconf.id, kind: 'unconfirmed', reason: R_UNCONFIRMED, until: '' }, { id: m.both.id, kind: 'unconfirmed', reason: R_UNCONFIRMED, until: '' }]), { entries: mo.entries.map((x) => x.id), held: heldOf(mo.held) });
  },

  // C-03, C-15: prenotesDue lists exactly the new accounts (register order; an investor's own change waits for an admin
  // first); prenoteEntries are $0 pre-notes in their own file; prenotesSent works only on a pre-note file's record;
  // the sponsor's setting and the managed edition turn pre-notes off.
  async prenotes({ check }) {
    const { NS, ws, R } = portal();
    check('the Kestrel Bay sample (every account paid before this phase) has no pre-note due', R.prenotesDue(ws, TODAY).length === 0, R.prenotesDue(ws, TODAY).map((i) => i.id));
    const p = achPayees(ws);
    const x = neverBank(p[3], 1);
    const y = neverBank(p[1], 2, 'savings');
    const u = neverBank(p[2], 3);
    R.markNew(x, '2026-11-18T15:00:00.000Z');
    R.markNew(y, '2026-11-18T15:00:00.000Z');
    u.payment.bank.check = { state: 'unconfirmed', at: '2026-11-15T15:00:00.000Z', by: 'investor' };
    const fresh = freshInvestor(ws, 'KBC-9002', 4);
    const due = R.prenotesDue(ws, TODAY).map((i) => i.id);
    check('prenotesDue lists exactly the new accounts, in register order (the unconfirmed one is not listed)', J(due) === J([y.id, x.id, fresh.id]), due);
    const pe = R.prenoteEntries(ws, TODAY);
    check('prenoteEntries: kind prenote, cents 0, ref the investor id, the account type and SEC of each', J(pe.map((e) => [e.id, e.kind, e.cents, e.ref, e.accountType, e.sec])) === J([[y.id, 'prenote', 0, y.id, 'savings', NS.ENTITY_TYPES[y.type].sec], [x.id, 'prenote', 0, x.id, 'checking', NS.ENTITY_TYPES[x.type].sec], [fresh.id, 'prenote', 0, fresh.id, 'checking', 'PPD']]), pe.map((e) => [e.id, e.kind, e.cents, e.ref, e.accountType, e.sec]));
    const { f, rec } = sendFile(NS, ws, pe, { effective: '2026-11-20', now: new Date(2026, 10, 19, 9, 0), at: '2026-11-19T14:00:00.000Z', for: 'prenote' });
    check('the builder writes them as pre-notes (codes 33 and 23) with no red check', f.blocked.length === 0 && J(f.entries.map((e) => e.code)) === J(['33', '23', '23']) && f.entries.every((e) => e.kind === 'prenote' && e.cents === 0), f.entries.map((e) => e.code));
    // a distribution file's record is refused, and nothing is marked
    const { rec: dist } = sendFile(NS, ws, [Object.assign({}, pe[0], { kind: 'credit', cents: 1000 })], { effective: '2026-11-23', now: new Date(2026, 10, 19, 9, 5), at: '2026-11-19T14:05:00.000Z', offeringId: 'kb-harlow' });
    const refused = thrown(() => R.prenotesSent(ws, dist, { by: ADMIN, at: '2026-11-19T14:06:00.000Z' }));
    check("prenotesSent refuses a record with for 'distribution'", refused === 'Only a pre-note file marks accounts as pre-noted.' && x.payment.bank.check.state === 'new', refused);
    check('prenotesSent refuses with no person', /name of the person/.test(thrown(() => R.prenotesSent(ws, rec, { by: '' }))) && x.payment.bank.check.state === 'new');
    // the account of one investor changes after its pre-note left: that one is not marked
    fresh.payment.bank.account = L.account(14);
    const marked = R.prenotesSent(ws, rec, { by: ADMIN, at: '2026-11-19T14:07:00.000Z' }).map((i) => i.id);
    check('prenotesSent marks the investors still on the account the pre-note checked', J(marked) === J([y.id, x.id]), marked);
    const ck = x.payment.bank.check;
    check("each is 'prenote-sent' from 2026-11-20 until 2026-11-25 with the file's id and the person", ck.state === 'prenote-sent' && ck.date === '2026-11-20' && ck.until === '2026-11-25' && ck.fileId === rec.id && ck.by === ADMIN && J(y.payment.bank.check) === J(Object.assign({}, ck)), ck);
    check('the changed account is still due a pre-note', J(R.prenotesDue(ws, TODAY).map((i) => i.id)) === J([fresh.id]), R.prenotesDue(ws, TODAY).map((i) => i.id));
    // the sponsor's setting
    ws.tenant.ach.prenotes = false;
    check('tenant.ach.prenotes false: prenotesDue is empty', R.prenotesOn(ws) === false && R.prenotesDue(ws, TODAY).length === 0 && R.prenoteEntries(ws, TODAY).length === 0);
    const off = R.fileEntries(ws, [{ investor: fresh, cents: 5000 }], { today: TODAY, effective: '2026-11-20' });
    check('tenant.ach.prenotes false: a new account is payable', off.entries.length === 1 && off.entries[0].id === fresh.id && off.held.length === 0, { entries: off.entries.map((e) => e.id), held: heldOf(off.held) });
    ws.tenant.ach.prenotes = true;
    check('any other value keeps them on', R.prenotesOn(ws) === true);
    // the managed edition (no pre-notes, C-12)
    const m = portal('managed');
    const mx = neverBank(achPayees(m.ws)[0], 1);
    m.R.markNew(mx, '2026-11-18T15:00:00.000Z');
    check('the managed edition: prenotesOn false and nothing due', m.NS.EDITION.diy === false && m.R.prenotesOn(m.ws) === false && m.R.prenotesDue(m.ws, TODAY).length === 0);
  },

  // AC-12: the shape of a BIC (SWIFT code), after removing spaces and upper-casing.
  async bic({ check }) {
    const { R } = portal();
    ['ZZBKZZ22', 'ZZBK ZZ22 XXX', 'zzbkzz22', 'ZZBKZZ2AXXX'].forEach((s) => check(`'${s}' is a valid BIC`, R.bicValid(s) === true));
    ['ZZBKZZ2', '1ZBKZZ22', 'ZZBKZZ22X', 'ZZBKZZ22XX', '', null, 'ZZ-BKZZ22'].forEach((s) => check(`${J(s)} is not a valid BIC`, R.bicValid(s) === false));
  },

  // AC-12: an IBAN's shape and its ISO 13616 mod 97 check digits (assumed rule, 16-RESEARCH A10: no country table).
  async iban({ check }) {
    const { R } = portal();
    const good = makeIban(IBAN_BODY);
    check("an IBAN the check makes ('ZZ', its mod 97 digits, made-up characters) is valid", R.ibanValid(good) === true);
    check('the same in groups of four with spaces, and in lower case, is valid', R.ibanValid(good.replace(/(.{4})/g, '$1 ').trim()) === true && R.ibanValid(good.toLowerCase()) === true);
    const changed = good.slice(0, 10) + (good[10] === '5' ? '6' : '5') + good.slice(11);
    check('the same with one character changed is not', R.ibanValid(changed) === false);
    const swapped = good.slice(0, 12) + good[13] + good[12] + good.slice(14);
    check('the same with two neighbouring digits swapped is not', good[12] !== good[13] && R.ibanValid(swapped) === false);
    check('a 9-character string is not', R.ibanValid('ZZ1234567') === false);
    check('wrong check digits (00) are not', R.ibanValid('ZZ00' + IBAN_BODY) === false);
    check('a body with a symbol, or nothing, is not', R.ibanValid(good.slice(0, 8) + '-' + good.slice(9)) === false && R.ibanValid('') === false && R.ibanValid(null) === false);
    const long = makeIban('A'.repeat(30));
    check('the longest body (30) is valid, 31 is not', R.ibanValid(long) === true && R.ibanValid(makeIban('A'.repeat(31))) === false);
  },

  // D-04, AC-12: the Wires list gives each unsent wire line of a recorded distribution (net amount, details, reference);
  // Mark sent records the day and the person, refused with no person, a bad date, a line not paid by wire or a second
  // time; the CSV guards spreadsheet formulas.
  async wires({ check }) {
    const { NS, ws, R } = portal();
    const date = '2026-11-20';
    const holders = NS.data.holdersAt(ws.investors, 'kb-fund-ii', date).map((h) => h.investor);
    const ach = holders.filter((i) => i.payment && i.payment.method === 'ach');
    const w1 = wirePayee(ach[0]);
    const w2 = wirePayee(ach[1], { iban: '', account: '99123456789', bic: 'ZZBKZZ22XXX', intermediary: { name: 'Check Middle Bank', bic: 'ZZMBZZ33' }, country: 'Canada' });
    const other = neverBank(ach[2], 3);
    check('wireDetails gives the stored block; null for an ACH payee', R.wireDetails(w1) === w1.payment.wire && R.wireDetails(other) === null);
    check('wireMasked gives the bank, country and the last four of the IBAN or account', J(R.wireMasked(w1)) === J({ bankName: 'Check Test Bank', country: 'Germany', ending: makeIban(IBAN_BODY).slice(-4) }) && R.wireMasked(w2).ending === '6789', [R.wireMasked(w1), R.wireMasked(w2)]);
    check('the sample has no wire due (no wire payee yet)', R.wiresDue(portal().ws, { today: TODAY }).length === 0);
    const gross = NS.data.buildLines(ws, { offeringId: 'kb-fund-ii', date, total: 5000000 }).find((l) => l.investorId === w1.id).grossCents;
    const out = Math.round(gross * 0.3);
    const run = NS.data.recordRun(ws, { offeringId: 'kb-fund-ii', date, type: 'Distribution', total: 5000000, withheld: { [w1.id]: [{ kind: 'foreign', cents: out, basisCents: gross, ratePct: 30, source: 'rule', why: 'Foreign person' }] } }, { by: ADMIN, today: TODAY, id: 'kb-fund-ii-2026-11-20-w' });
    const due = R.wiresDue(ws, { today: TODAY });
    check('wiresDue lists the two wire payees of the recorded distribution, in register order', J(due.map((x) => x.investorId)) === J([w1.id, w2.id].sort((a, b) => ws.investors.findIndex((i) => i.id === a) - ws.investors.findIndex((i) => i.id === b))), due.map((x) => x.investorId));
    const d1 = due.find((x) => x.investorId === w1.id) || {};
    check('each row: the run, offering, date, name and the net amount (tax withheld taken off)', d1.runId === run.id && d1.offeringId === 'kb-fund-ii' && d1.date === date && d1.name === w1.title && d1.cents === gross - out && out > 0, { runId: d1.runId, date: d1.date, cents: d1.cents, gross, out });
    check("its reference is '<offering short name> <run date> <investor id>'", d1.reference === `Fund II ${date} ${w1.id}`, d1.reference);
    check('its details are the stored wire block', d1.details === w1.payment.wire);
    // the older payments of a wire payee, made before its wire details existed, are not wires to send
    const sample = portal();
    const late = wirePayee(sample.NS.data.holdersAt(sample.ws.investors, 'kb-fund-ii', date).map((h) => h.investor).filter((i) => i.payment.method === 'ach')[0], { at: '2026-11-25T15:00:00.000Z' });
    sample.NS.data.recordRun(sample.ws, { offeringId: 'kb-fund-ii', date, type: 'Distribution', total: 5000000 }, { by: ADMIN, today: TODAY, id: 'kb-fund-ii-2026-11-20-x' });
    check('a distribution recorded and dated before the wire details were saved, and the seeded runs with no stored lines, are not listed', sample.R.wiresDue(sample.ws, { today: TODAY }).length === 0 && !!late);
    // a cancelled distribution is not listed
    const sec = NS.data.recordRun(ws, { offeringId: 'kb-fund-ii', date: '2026-11-23', type: 'Distribution', total: 1000000 }, { by: ADMIN, today: TODAY, id: 'kb-fund-ii-2026-11-23-c' });
    check('a second distribution adds its wire lines, oldest first', J(R.wiresDue(ws, { today: TODAY }).map((x) => x.runId)) === J([run.id, run.id, sec.id, sec.id]));
    NS.data.cancelRun(ws, sec.id, { by: ADMIN, why: 'Recorded twice' });
    check('once cancelled its lines leave the list', R.wiresDue(ws, { today: TODAY }).every((x) => x.runId === run.id));
    // Mark sent
    const m = (id, o) => thrown(() => R.markWireSent(ws, run.id, id, o));
    check('Mark sent is refused with no person', /name of the person/.test(m(w1.id, { sentOn: '2026-11-20', by: ' ' })), m(w1.id, { sentOn: '2026-11-20', by: ' ' }));
    check("Mark sent is refused for '12/01/2026'", /YYYY-MM-DD/.test(m(w1.id, { sentOn: '12/01/2026', by: ADMIN })) && /YYYY-MM-DD/.test(m(w1.id, { sentOn: '2026-02-30', by: ADMIN })), m(w1.id, { sentOn: '12/01/2026', by: ADMIN }));
    check("Mark sent is refused for a line not paid by wire", m(other.id, { sentOn: '2026-11-20', by: ADMIN }) === 'This investor is not paid by international wire.', m(other.id, { sentOn: '2026-11-20', by: ADMIN }));
    check('Mark sent is refused for an unknown distribution', !!thrown(() => R.markWireSent(ws, 'no-such-run', w1.id, { sentOn: '2026-11-20', by: ADMIN })));
    const lineOf = (id) => ws.runs.find((r) => r.id === run.id).lines.find((l) => l.investorId === id);
    check('and nothing is written', !lineOf(w1.id).wire && !lineOf(other.id).wire);
    const sent = R.markWireSent(ws, run.id, w1.id, { sentOn: '2026-11-20', by: ADMIN, at: '2026-11-20T16:00:00.000Z' });
    check('Mark sent writes line.wire { sentOn, by, at }', J(lineOf(w1.id).wire) === J({ sentOn: '2026-11-20', by: ADMIN, at: '2026-11-20T16:00:00.000Z' }) && sent === lineOf(w1.id).wire, lineOf(w1.id).wire);
    const twice = m(w1.id, { sentOn: '2026-11-21', by: 'Sam Other' });
    check('a second Mark sent is refused, naming the first', twice === `This wire was already marked sent on ${longDay('2026-11-20')} by ${ADMIN}.` && lineOf(w1.id).wire.by === ADMIN, twice);
    check('the line then leaves wiresDue', J(R.wiresDue(ws, { today: TODAY }).map((x) => x.investorId)) === J([w2.id]));
    // the CSV
    const rows = R.wiresDue(ws, { today: TODAY });
    rows.push(Object.assign({}, rows[0], { name: '+SUM(A1)', details: Object.assign({}, rows[0].details, { beneficiary: '=HYPERLINK(1)', address: '@cmd, "quoted"', bankName: '-2+3' }) }));
    const csv = R.wireCsv(rows);
    const lines = csv.split('\r\n');
    check('wireCsv: the header', lines[0] === 'Investor,Investor ID,Amount,Beneficiary,Address,Bank,Country,BIC,IBAN or account,Intermediary,Reference', lines[0]);
    check('wireCsv: one line per row with the amount in dollars and the intermediary bank', lines.length === 3 && lines[1].indexOf(`,${(rows[0].cents / 100).toFixed(2)},`) > 0 && lines[1].indexOf('Check Middle Bank ZZMBZZ33') > 0 && lines[1].indexOf('Canada') > 0, lines.length);
    check(`wireCsv: the cell '=HYPERLINK(1)' comes out as "'=HYPERLINK(1)", and +, -, @ are guarded too`, lines[2].indexOf(",'=HYPERLINK(1),") > 0 && lines[2].indexOf("'+SUM(A1),") === 0 && lines[2].indexOf('"\'@cmd, ""quoted"""') > 0 && lines[2].indexOf(",'-2+3,") > 0, lines[2].length);
  },

  // AC-11: one reading of a line's payment state for the console and the investor portal.
  async status({ check }) {
    const { NS, ws, R } = portal();
    const date = '2026-11-18';
    const holders = NS.data.holdersAt(ws.investors, 'kb-fund-ii', date).map((h) => h.investor);
    const ach = holders.filter((i) => i.payment && i.payment.method === 'ach');
    const a = neverBank(ach[0], 1);
    const s = neverBank(ach[1], 2, 'savings');
    const w = wirePayee(ach[2]);
    const r = neverBank(ach[3], 4);
    const chk = holders.find((i) => i.payment && i.payment.method === 'check') || Object.assign(ach[4], { payment: { method: 'check', bank: null } });
    check('the distribution has an ACH, a savings, a wire, a returned and a check payee', !!(a && s && w && r && chk) && new Set([a, s, w, r, chk]).size === 5);
    const rows = R.fileEntries(ws, holders.map((investor) => ({ investor, cents: 1000 })), { today: '2026-11-17', effective: date }).entries;
    const { rec } = sendFile(NS, ws, rows, { effective: date, now: new Date(2026, 10, 17, 10, 0), at: '2026-11-17T15:00:00.000Z' });
    const run = NS.data.recordRun(ws, { offeringId: 'kb-fund-ii', date, type: 'Distribution', total: 3000000 }, { by: ADMIN, today: '2026-11-17', id: 'kb-fund-ii-2026-11-18-s' });
    R.attach(ws, rec.id, run.id);
    const st = (id, t) => R.lineStatus(ws, run, id, t || TODAY) || {};
    const pa = st(a.id);
    check("a paid ACH line: 'Paid by ACH to the checking account ending NNNN'", pa.status === 'paid' && pa.method === 'ach' && pa.ending === L.account(1).slice(-4) && pa.words === `Paid by ACH to the checking account ending ${L.account(1).slice(-4)}`, pa);
    const ps = st(s.id);
    check('a paid ACH line to a savings account says savings', ps.words === `Paid by ACH to the savings account ending ${L.account(2).slice(-4)}`, ps.words);
    const pw = st(w.id);
    check('a wire line not sent: scheduled, to be paid by wire, wireSent null', pw.status === 'scheduled' && pw.method === 'wire' && pw.wireSent === null && pw.words === `To be paid by wire to the account ending ${makeIban(IBAN_BODY).slice(-4)}`, pw);
    R.markWireSent(ws, run.id, w.id, { sentOn: '2026-11-18', by: ADMIN, at: '2026-11-18T16:00:00.000Z' });
    const pw2 = st(w.id);
    check("a wire line sent: 'Paid by wire to the account ending NNNN' with wireSent", pw2.status === 'paid' && pw2.method === 'wire' && pw2.wireSent && pw2.wireSent.sentOn === '2026-11-18' && pw2.words === `Paid by wire to the account ending ${makeIban(IBAN_BODY).slice(-4)}`, pw2);
    const pc = st(chk.id);
    check("a check line: 'Paid by check'", pc.status === 'paid' && pc.method === 'check' && pc.words === 'Paid by check', pc);
    // the line the bank returned, and paid again (16-04's shape)
    const line = run.lines.find((l) => l.investorId === r.id);
    line.ach = { status: 'returned', code: 'R03', date: '2026-11-20', cents: line.netCents, trace: '190000010000001', by: ADMIN, at: '2026-11-20T15:00:00.000Z', source: 'nacha', repaid: null };
    const pr = st(r.id, '2026-11-24');
    check("a returned line: 'Returned by your bank on <Mon D, YYYY>' with its code and date", pr.status === 'returned' && pr.code === 'R03' && pr.date === '2026-11-20' && pr.method === 'ach' && pr.words === `Returned by your bank on ${longDay('2026-11-20')}`, pr);
    line.ach.status = 'repaid';
    line.ach.repaid = { how: 'check', on: '2026-11-27', by: ADMIN, at: '2026-11-27T15:00:00.000Z', fileId: '' };
    const pp = st(r.id, '2026-12-01');
    check("a line paid again: 'Paid again on <Mon D, YYYY>'", pp.status === 'repaid' && pp.date === '2026-11-27' && pp.words === `Paid again on ${longDay('2026-11-27')}`, pp);
    // a scheduled run and a cancelled run; a seeded run (no file record, no stored lines)
    const later = NS.data.recordRun(ws, { offeringId: 'kb-fund-ii', date: '2026-12-15', type: 'Distribution', total: 1000000 }, { by: ADMIN, today: TODAY, id: 'kb-fund-ii-2026-12-15-s' });
    const sc = R.lineStatus(ws, later, a.id, TODAY) || {};
    check("a scheduled run: 'scheduled', 'Scheduled for Dec 15, 2026'", sc.status === 'scheduled' && sc.words === `Scheduled for ${longDay('2026-12-15')}`, sc);
    NS.data.cancelRun(ws, later.id, { by: ADMIN, why: 'Recorded on the wrong date' });
    const cc = R.lineStatus(ws, later, a.id, TODAY) || {};
    check("a cancelled run: 'cancelled', 'Cancelled'", cc.status === 'cancelled' && cc.words === 'Cancelled', cc);
    const seeded = ws.runs.find((x) => x.id === 'kb-fund-ii-2026-09-24');
    const sInv = ws.investors.find((i) => NS.data.runLines(ws, seeded).lines.some((l) => l.investorId === i.id) && i.payment.method === 'ach' && i !== w);
    const sd = R.lineStatus(ws, seeded, sInv.id, TODAY) || {};
    check('a seeded paid run (no file record) reads paid by ACH to the account on file', sd.status === 'paid' && sd.method === 'ach' && sd.ending === String(sInv.payment.bank.account).slice(-4) && /^Paid by ACH to the (checking|savings) account ending \d{4}$/.test(sd.words), { status: sd.status, method: sd.method });
    check('lineStatus takes the run or its id, and is null for an investor with no line', J(R.lineStatus(ws, run.id, a.id, TODAY)) === J(pa) && R.lineStatus(ws, run, 'KBC-0000', TODAY) === null);
  },

  // D-06, AC-16: approved redemptions whose dealing month is final (r.dealing <= NS.audit.lastMonthEnd(today), the
  // console's rule) give the payees of a redemption file: entries with the amount and the request id as ref, the same
  // holds, wire payees and check payees.
  async redemptions({ check }) {
    const { NS, R } = portal();
    const ws = redemptionFund();
    const [r1, r2, r3, , r5] = ws.investors;
    R.setCheck(ws, r1, 'prenote-sent', { date: '2026-10-01', until: '2026-10-06', fileId: 'af-0', by: ADMIN, at: '2026-10-01T15:00:00.000Z' });
    wirePayee(r2);
    r3.payment = { method: 'check', bank: null };
    check('the dealing month 2026-10 is final on 2026-11-19 and 2026-11 is not', NS.audit.lastMonthEnd(TODAY) === '2026-10-31');
    const amount = (id) => NS.ops.redemptionAmount(ws, ws.requests.find((q) => q.id === id));
    check('the redemption amounts come from the capital accounts', amount('req-r-1') === 200000 && amount('req-r-2') === 150000 && amount('req-r-3') === 120000 && amount('req-r-4') === null, ['req-r-1', 'req-r-2', 'req-r-3', 'req-r-4'].map(amount));
    const out = R.redemptionPayees(ws, ws.requests, { today: TODAY, effective: '2026-11-23' });
    check('one entry: the ready ACH payee, the redemption amount, the request id as ref', out.entries.length === 1 && out.entries[0].id === r1.id && out.entries[0].cents === 200000 && out.entries[0].ref === 'req-r-1' && out.entries[0].account === L.account(1), out.entries.map((e) => ({ id: e.id, cents: e.cents, ref: e.ref })));
    check("the wire payee's redemption goes to wires with its details", out.wires.length === 1 && out.wires[0].request.id === 'req-r-2' && out.wires[0].investor === r2 && out.wires[0].cents === 150000 && out.wires[0].details === r2.payment.wire, out.wires.map((x) => ({ request: x.request.id, cents: x.cents })));
    check("the check payee's goes to checks", out.checks.length === 1 && out.checks[0].request.id === 'req-r-3' && out.checks[0].investor === r3 && out.checks[0].cents === 120000, out.checks.map((x) => ({ request: x.request.id, cents: x.cents })));
    check('a new account is held with the pre-note reason, its request kept', out.held.length === 1 && out.held[0].investor === r5 && out.held[0].kind === 'new' && out.held[0].reason === R_NEW && out.held[0].request.id === 'req-r-5' && out.held[0].cents === 250000, heldOf(out.held));
    const all = [].concat(out.entries.map((e) => e.ref), out.wires.map((x) => x.request.id), out.checks.map((x) => x.request.id), out.held.map((x) => x.request.id));
    check('the one whose dealing month is not final, the pending one and the paid one are not listed', !all.includes('req-r-4') && !all.includes('req-r-6') && !all.includes('req-r-7'), all);
    check('a redemption file builds from the entries with no red check', NS.nacha.build({ origin: { destinationRouting: ODFI, destinationName: 'CHECK ORIGIN BANK', immediateOrigin: '1990000001', originName: 'CHECK FUND LLC', odfiRouting: ODFI }, company: { name: 'CHECK FUND LLC', id: '1990000001' }, entries: out.entries, effectiveDate: '2026-11-23', description: 'REDEMPTION', now: new Date(2026, 10, 19, 10, 0) }).entries.map((e) => e.ref).join() === 'req-r-1');
  },

  // T-16-28: no state, reason, words or status text holds a full account number or IBAN: lib16.leaks finds nothing, no
  // run of 5 or more of an account's digits, no 5 consecutive characters of an IBAN's or wire account's body (all but
  // its last four, re-check W3); the account state lives in investor.payment.bank.check only.
  async privacy({ check }) {
    const { NS, ws, R } = portal();
    const before = JSON.parse(JSON.stringify(ws));
    const texts = [];
    const keep = (x) => texts.push(typeof x === 'string' ? x : J(x));
    const p = NS.data.holdersAt(ws.investors, 'kb-fund-ii', '2026-11-20').map((h) => h.investor).filter((i, k, list) => i.payment && i.payment.method === 'ach' && list.indexOf(i) === k);
    check('Fund II has ten ACH payees for the scenario', p.length >= 10, p.length);
    p.slice(0, 8).forEach((x, k) => neverBank(x, 20 + k));
    const [a, b, c, d, e, f, g] = p;
    const w = wirePayee(p[8]);
    const wa = wirePayee(p[9], { iban: '', account: '991234567890', intermediary: { name: 'Check Middle Bank', bic: 'ZZMBZZ33' } });
    R.markNew(a, '2026-11-18T15:00:00.000Z');
    R.setCheck(ws, b, 'returned', { code: 'R03', date: '2026-11-10', by: ADMIN, at: '2026-11-10T15:00:00.000Z' });
    R.setCheck(ws, c, 'blocked', { why: `The bank closed account ${L.account(22)} on our request.`, by: ADMIN, at: '2026-11-12T15:00:00.000Z' });
    check('a reason typed with a full account number is stored with its last four only', c.payment.bank.check.why === `The bank closed account ending ${L.account(22).slice(-4)} on our request.`, c.payment.bank.check.why);
    R.setCheck(ws, d, 'prenote-sent', { date: '2026-11-18', until: '2026-11-23', fileId: 'af-9', by: ADMIN, at: '2026-11-18T15:00:00.000Z' });
    e.payment.bank.check = { state: 'unconfirmed', at: '2026-11-15T15:00:00.000Z', by: 'investor' };
    f.payment.bank.pending = { code: 'C01', account: L.account(40), routing: RDFI[2], date: '2026-11-02', at: '2026-11-02T15:00:00.000Z' };
    sendFile(NS, ws, [{ name: f.title, id: f.id, routing: f.payment.bank.routing, account: f.payment.bank.account, accountType: 'checking', cents: 1000, sec: 'PPD' }], { effective: '2026-11-06', now: new Date(2026, 10, 5, 10, 0), at: '2026-11-05T15:00:00.000Z' });
    ws.investors.forEach((i) => keep(R.checkOf(ws, i, TODAY)));
    const fe = R.fileEntries(ws, ws.investors.map((investor) => ({ investor, cents: 1000 })), { today: TODAY, effective: '2026-11-20' });
    fe.held.forEach((h) => {
      keep(h.reason);
      keep({ kind: h.kind, until: h.until });
    });
    check('the scenario holds every state: new, returned, blocked, prenote-sent, unconfirmed, pending (held), wire, ready, none', ['new', 'returned', 'blocked', 'prenote-sent', 'unconfirmed', 'pending', 'wire'].every((k) => fe.held.some((h) => h.kind === k)) && fe.entries.some((x) => x.id === g.id) && R.checkOf(ws, checkPayee(ws), TODAY).state === 'none', fe.held.map((h) => h.kind));
    const run = NS.data.recordRun(ws, { offeringId: 'kb-fund-ii', date: '2026-11-20', type: 'Distribution', total: 2000000 }, { by: ADMIN, today: TODAY, id: 'kb-fund-ii-2026-11-20-p' });
    R.wiresDue(ws, { today: TODAY }).forEach((x) => keep({ reference: x.reference, name: x.name, cents: x.cents, date: x.date }));
    run.lines.forEach((l) => {
      keep(R.lineStatus(ws, run, l.investorId, TODAY));
      keep(R.lineStatus(ws, run, l.investorId, '2026-11-21'));
    });
    run.lines.filter((l) => [w.id, wa.id].includes(l.investorId)).forEach((l) => R.markWireSent(ws, run.id, l.investorId, { sentOn: '2026-11-20', by: ADMIN, at: '2026-11-20T16:00:00.000Z' }));
    const ra = run.lines.find((l) => l.investorId === g.id);
    ra.ach = { status: 'returned', code: 'R03', date: '2026-11-24', cents: ra.netCents, trace: '190000010000001', by: ADMIN, at: '2026-11-24T15:00:00.000Z', source: 'nacha', repaid: null };
    run.lines.forEach((l) => keep(R.lineStatus(ws, run, l.investorId, '2026-11-25')));
    ra.ach.status = 'repaid';
    ra.ach.repaid = { how: 'ach', on: '2026-11-30', by: ADMIN, at: '2026-11-30T15:00:00.000Z', fileId: '' };
    keep(R.lineStatus(ws, run, g.id, '2026-12-01'));
    keep(R.wireCsv([]));
    keep(R.wireMasked(w));
    keep(R.wireMasked(wa));
    keep(thrown(() => R.markWireSent(ws, run.id, w.id, { sentOn: '2026-11-21', by: ADMIN })));
    ws.investors.forEach((i) => keep(i.payment && i.payment.bank && i.payment.bank.check));
    const all = texts.join('\n');
    check('statuses and reasons were collected', texts.length > 40 && ['Paid by wire to', 'To be paid by wire', 'Paid by ACH to', 'Paid by check', 'Returned by your bank', 'Paid again on', 'Returned by the bank', 'waits for an admin', 'ending'].every((x) => all.indexOf(x) >= 0), ['Paid by wire to', 'To be paid by wire', 'Paid by ACH to', 'Paid by check', 'Returned by your bank', 'Paid again on', 'Returned by the bank', 'waits for an admin', 'ending'].filter((x) => all.indexOf(x) < 0));
    check('lib16.leaks finds nothing in them', L.leaks(all).length === 0, L.leaks(all).map((x) => x.slice(-4)));
    const windows = (s) => {
      const out = [];
      for (let k = 0; k + 5 <= s.length; k++) out.push(s.slice(k, k + 5));
      return out;
    };
    const accounts = ws.investors.map((i) => i.payment && i.payment.bank && i.payment.bank.account).filter(Boolean).concat([L.account(40), L.account(22)]);
    const digitHits = accounts.filter((acc) => windows(String(acc)).some((x) => all.indexOf(x) >= 0));
    check('no run of 5 or more of any account number’s digits', digitHits.length === 0, digitHits.map((x) => x.slice(-4)));
    const bodies = [w.payment.wire.iban, wa.payment.wire.account].map((x) => x.slice(0, -4));
    const bodyHits = bodies.filter((body) => windows(body).some((x) => all.indexOf(x) >= 0));
    check('W3: no 5 consecutive characters of an IBAN’s or wire account’s body', bodyHits.length === 0, bodyHits.length);
    // the state lives in investor.payment.bank.check only (and the file record of 16-02 in achLog, the wire mark on its line)
    const strip = (x) => {
      const y = JSON.parse(J(x));
      (y.investors || []).forEach((i) => i.payment && i.payment.bank && delete i.payment.bank.check);
      delete y.achLog;
      (y.runs || []).forEach((r) => (r.lines || []).forEach((l) => delete l.wire));
      y.runs = (y.runs || []).filter((r) => r.id !== run.id);
      (y.investors || []).forEach((i) => delete i.payment);
      return y;
    };
    const b0 = strip(before);
    const a0 = strip(ws);
    check('nothing else in the workspace changed: no new top-level key, no other investor field', J(Object.keys(ws).sort()) === J(Object.keys(before).concat(['achLog']).filter((k, i, s) => s.indexOf(k) === i).sort()) && J(a0) === J(b0));
  }
};

/**
 * The check's own open-ended fund for redemptions (the shape of phase 11's fund B, no bank number): R-1 to R-7 hold
 * 100,000 from 2026-01-31; approved redemptions at the 2026-10-31 dealing date (final on 2026-11-19), one at
 * 2026-11-30 (not final), one pending and one paid.
 */
function redemptionFund() {
  const inv = (id, n) => ({ id, contact: `Investor ${id}`, title: `Investor ${id}`, type: 'individual', email: `${id.toLowerCase()}@example.com`, taxForm: 'W-9', payment: { method: 'ach', bank: { holder: `Investor ${id}`, routing: RDFI[n % 3], account: L.account(n), type: 'checking' } }, positions: [{ offeringId: 'fund-r', amount: 100000, date: '2026-01-31' }] });
  const req = (id, investorId, cents, dealing, status, extra) => Object.assign({ id, type: 'redemption', offeringId: 'fund-r', investorId, cents, full: false, dealing, status, decided: '2026-10-01' }, extra || {});
  return {
    v: 2,
    tenant: { id: 'fund-r-sponsor', sample: false, name: 'Fund R Sponsor', shortName: 'Fund R Sponsor', legalName: 'Fund R Sponsor Management, LLC', ach: {} },
    offerings: [{ id: 'fund-r', name: 'Fund R, L.P.', shortName: 'Fund R', type: 'Hedge fund', status: 'Open', closeDate: '2026-01-31', exit: { basis: 'open', date: '', from: '', to: '', note: '' }, distribution: { frequency: 'None', type: 'Redemption proceeds', target: '' }, terms: [], accounting: { mgmtFee: '1.5', feeBasis: 'nav', carry: '0', pref: '0' } }],
    investors: ['R-1', 'R-2', 'R-3', 'R-4', 'R-5', 'R-6', 'R-7'].map((id, k) => inv(id, k + 1)),
    calls: [],
    runs: [],
    notices: [],
    requests: [
      req('req-r-1', 'R-1', 200000, '2026-10-31', 'approved'),
      req('req-r-2', 'R-2', 150000, '2026-10-31', 'approved'),
      req('req-r-3', 'R-3', 120000, '2026-10-31', 'approved'),
      req('req-r-4', 'R-4', 300000, '2026-11-30', 'approved'),
      req('req-r-5', 'R-5', 250000, '2026-10-31', 'approved'),
      req('req-r-6', 'R-6', 110000, '2026-10-31', 'pending'),
      req('req-r-7', 'R-7', 130000, '2026-09-30', 'paid', { paid: '2026-10-05', paidCents: 130000 })
    ],
    docs: []
  };
}

L.runParts(parts, { name: NAME, unit: 'cases', flag: '--case' });
