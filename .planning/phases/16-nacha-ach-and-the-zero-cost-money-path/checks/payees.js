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
  }
};

L.runParts(parts, { name: NAME, unit: 'cases', flag: '--case' });
