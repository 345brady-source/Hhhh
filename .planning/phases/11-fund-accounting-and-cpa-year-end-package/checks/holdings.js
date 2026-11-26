// gate: node
// last "HOLDINGS: PASS (cases run: 6)"
// Valuations, opening balances and closing as ledger operations (plan 11-10, no browser): a fair value entered for an
// investment posts the change since its last value to 1150 and 6100; a fund that existed before its books enters its
// opening balances once; finalizing a month brings the books up to date, locks it and writes the trial balance's SHA-256
// to the change log (owner only); a redemption's amount is fixed once its dealing month is finalized. The portal is
// loaded inside each case with load11.js (the scripts diy.html lists, then books.js, books-post.js and books-hold.js).
// Funds A, B and D come from fixtures/fund-a.js, fund-b.js and fund-d.js, each figure written once there.
//   node holdings.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "HOLDINGS: PASS (cases run: N)" or
// "HOLDINGS: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const { spawnSync } = require('child_process');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal } = require('./load11.js');

const ACTOR = { by: 'Check Runner', at: '2026-11-20T10:00:00.000Z' };
const J = (x) => JSON.stringify(x);

/** The portal with the journal, the posting module and the holdings module, inside the case. */
function load(today) {
  const NS = loadPortal(undefined, { today, extra: ['books.js', 'books-post.js', 'books-hold.js'] });
  if (!NS.books || typeof NS.books.sync !== 'function') throw new Error('books.js and books-post.js did not load');
  return NS;
}
const fixture = (name) => JSON.parse(JSON.stringify(require('./fixtures/' + name + '.js')));
/** Throws, or a string saying it did not. */
function throws(fn) {
  try {
    fn();
    return null;
  } catch (e) {
    return String((e && e.message) || e);
  }
}
const need = (NS, name) => {
  if (typeof NS.books[name] !== 'function') throw new Error(`NS.books.${name} is not defined (books-hold.js)`);
};

const cases = {
  /**
   * FA-05, fund A: every fixture entry except the two valuations, then the two values of the research entered through
   * value(): their entries equal mark:fa-m1's and mark:fa-m2's lines, the trial balance is the research's, and the same
   * value entered again stores a mark and posts nothing.
   */
  value: ({ check }) => {
    const NS = load('2027-01-20');
    const F = fixture('fund-a');
    const ws = F.records;
    const oid = F.expect.offeringId;
    F.entries.filter((e) => !/^mark:/.test(e.src)).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
    NS.books.sync(ws, { today: NS.dates.today() });
    need(NS, 'value');
    const want = (src) => F.entries.find((e) => e.src === src).lines;
    const f = ws.books.funds[oid];
    const m1 = NS.books.value(ws, oid, { holding: 'fa-x', date: '2026-09-30', fvCents: 46000000, doc: 'Q3 valuation memo' }, ACTOR);
    const e1 = NS.books.live(f, 'mark:' + m1.id);
    check("value(fa-x, 2026-09-30, 46,000,000): change +6,000,000 = mark:fa-m1's lines", e1 && J(e1.lines) === J(want('mark:fa-m1')) && e1.date === '2026-09-30', e1);
    check("the mark is stored { id 'm-1', holding, date, fvCents, doc, at, by }", J(f.marks[0]) === J({ id: 'm-1', holding: 'fa-x', date: '2026-09-30', fvCents: 46000000, doc: 'Q3 valuation memo', at: ACTOR.at, by: ACTOR.by }) && J(m1) === J(f.marks[0]), f.marks);
    const m2 = NS.books.value(ws, oid, { holding: 'fa-x', date: '2026-12-31', fvCents: 49000000 }, ACTOR);
    const e2 = NS.books.live(f, 'mark:' + m2.id);
    check("value(fa-x, 2026-12-31, 49,000,000): change +3,000,000 = mark:fa-m2's lines", e2 && J(e2.lines) === J(want('mark:fa-m2')) && e2.date === '2026-12-31', e2);
    const tb = NS.books.trialBalance(ws, oid, '', '2026-12-31').map((r) => ({ code: r.code, end: r.end }));
    check("fund A's trial balance at 2026-12-31 = the research's (ten accounts)", J(tb) === J(F.expect.tb), tb);
    const n = f.journal.length;
    const m3 = NS.books.value(ws, oid, { holding: 'fa-x', date: '2026-12-31', fvCents: 49000000 }, ACTOR);
    check('the same value again: a third mark is stored (change 0) and no entry is posted', f.marks.length === 3 && m3.id === 'm-3' && f.journal.length === n && !NS.books.live(f, 'mark:' + m3.id), { marks: f.marks.length, journal: [n, f.journal.length] });
  },

  /**
   * value() refuses, and stores nothing: an unknown investment, a value that is not whole cents at or above zero
   * (-1, 12.5), a date in a closed period (also when the value has not changed), and a date before the investment's
   * latest value (11-CONTEXT W6).
   */
  refusals: ({ check }) => {
    const NS = load('2027-01-20');
    need(NS, 'value');
    const F = fixture('fund-a');
    const ws = F.records;
    const oid = F.expect.offeringId;
    F.entries.filter((e) => !/^mark:/.test(e.src)).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
    NS.books.sync(ws, { today: NS.dates.today() });
    const refused = (label, v, re) => {
      const before = J(ws.books);
      const t = throws(() => NS.books.value(ws, oid, v, ACTOR));
      check(`${label}: throws and stores nothing`, t && (!re || re.test(t)) && J(ws.books) === before, t || 'did not throw');
    };
    refused('an unknown investment', { holding: 'fa-nope', date: '2026-09-30', fvCents: 46000000 }, /no investment fa-nope/);
    refused('fvCents -1', { holding: 'fa-x', date: '2026-09-30', fvCents: -1 }, /whole number of cents/);
    refused('fvCents 12.5', { holding: 'fa-x', date: '2026-09-30', fvCents: 12.5 }, /whole number of cents/);
    refused('fvCents as text', { holding: 'fa-x', date: '2026-09-30', fvCents: '46000000' }, /whole number of cents/);
    refused('a date that is not a calendar date', { holding: 'fa-x', date: '2026-02-30', fvCents: 46000000 }, /calendar date/);
    NS.books.close(ws, oid, '2026-06-30', ACTOR);
    refused('a date in a closed period (2026-06-30, closed through 2026-06-30)', { holding: 'fa-x', date: '2026-06-30', fvCents: 41000000 }, /closed through 2026-06-30/);
    refused('a date in a closed period with no change (cost 40,000,000)', { holding: 'fa-x', date: '2026-05-31', fvCents: 40000000 }, /closed through 2026-06-30/);
    NS.books.value(ws, oid, { holding: 'fa-x', date: '2026-12-31', fvCents: 49000000 }, ACTOR);
    refused('a date before the latest value (2026-12-31)', { holding: 'fa-x', date: '2026-09-30', fvCents: 46000000 }, /^A later value exists \(2026-12-31\); enter values in date order\.$/);
    const ok = NS.books.value(ws, oid, { holding: 'fa-x', date: '2026-12-31', fvCents: 50000000 }, ACTOR);
    const e = NS.books.live(ws.books.funds[oid], 'mark:' + ok.id);
    check('a second value on the same day as the latest is accepted and posts the change since it (+1,000,000)', e && J(e.lines) === J([['1150', 1000000, '', 'fa-x'], ['6100', -1000000]]), e);
  },

  /**
   * Opening balances, fund D: the example exactly (the entry, start 2026-01-01, December 2025 capital 70,000,000 and
   * 35,000,000); each refusal stores nothing; records already posted from 2023 are reversed by the next sync and the
   * trial balance at 2025-12-31 is the opening entry.
   */
  opening: ({ check }) => {
    const NS = load('2027-01-20');
    need(NS, 'opening');
    const fresh = () => {
      const F = fixture('fund-d');
      F.records.books.funds['fund-d'].start = '';
      return F;
    };
    const F = fresh();
    const ws = F.records;
    const oid = F.expect.offeringId;
    const want = F.entries.find((e) => e.src === 'open:' + oid);
    const got = NS.books.opening(ws, oid, { date: '2025-12-31', lines: want.lines }, ACTOR);
    const f = ws.books.funds[oid];
    check("opening({ date 2025-12-31, the fixture's lines }) is the fixture's open entry", got && got.src === 'open:' + oid && got.date === '2025-12-31' && J(got.lines) === J(want.lines) && J(NS.books.live(f, 'open:' + oid).lines) === J(want.lines), got);
    check('fund.start becomes 2026-01-01', f.start === '2026-01-01', f.start);
    F.entries.filter((e) => e.src !== 'open:' + oid).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
    NS.books.sync(ws, { today: NS.dates.today() });
    const Lg = NS.audit.ledger(ws, ws.offerings[0]);
    const dec = {};
    ['D-1001', 'D-1002'].forEach((id) => (dec[id] = Lg.byKey['2025-12'] && Lg.byKey['2025-12'].rows[id].end));
    check("the engine's December 2025 capital is 70,000,000 and 35,000,000", J(dec) === J(F.expect.dec2025.end), dec);
    const pre = f.journal.filter((e) => e.date < '2026-01-01').map((e) => e.src);
    check('nothing dated before 2026-01-01 is posted from records', J(pre) === J(['open:' + oid]), pre);

    // Refusals: each on a fresh copy, nothing stored.
    const refused = (label, prep, args, re) => {
      const G = fresh();
      const w = G.records;
      if (prep) prep(w, G);
      const before = J(w.books);
      const t = throws(() => NS.books.opening(w, oid, args(G), ACTOR));
      check(`${label}: throws and stores nothing`, t && (!re || re.test(t)) && J(w.books) === before, t || 'did not throw');
    };
    const lines = (G) => G.entries.find((e) => e.src === 'open:' + oid).lines;
    refused('a second opening', (w, G) => NS.books.opening(w, oid, { date: '2025-12-31', lines: lines(G) }, ACTOR), (G) => ({ date: '2025-12-31', lines: lines(G) }), /already/);
    refused('lines that do not balance (cash 5,000,001)', null, (G) => ({ date: '2025-12-31', lines: lines(G).map((l) => (l[0] === '1000' ? ['1000', 5000001] : l)) }), /do not balance/);
    refused('a 3900 line without a partner', null, (G) => ({ date: '2025-12-31', lines: lines(G).map((l) => (l[2] === 'D-1002' ? ['3900', l[1]] : l)) }), /3900/);
    refused(
      'a partner who does not hold the offering',
      (w) => w.investors.push({ id: 'X-1', contact: 'Other', title: 'Other', type: 'individual', email: 'x@example.com', positions: [{ offeringId: 'elsewhere', amount: 1000, date: '2023-03-01' }] }),
      (G) => ({ date: '2025-12-31', lines: lines(G).map((l) => (l[2] === 'D-1002' ? ['3900', l[1], 'X-1'] : l)) }),
      /X-1/
    );
    refused('a date in a closed period', (w) => NS.books.close(w, oid, '2026-01-31', ACTOR), (G) => ({ date: '2025-12-31', lines: lines(G) }), /closed through 2026-01-31/);
    refused('an income line on an opening balance sheet', null, (G) => ({ date: '2025-12-31', lines: lines(G).concat([['4010', -100], ['1000', 100]]) }), /4010/);

    // Records posted from 2023 before the opening: the next sync reverses them; the trial balance at 2025-12-31 is the opening.
    const H = fresh();
    const w = H.records;
    NS.books.sync(w, { today: NS.dates.today() });
    const posted = w.books.funds[oid].journal.filter((e) => /^pos:/.test(e.src)).map((e) => e.src);
    check('before the opening, sync posts the 2023 subscriptions', posted.length === 2 && posted.every((s) => /:2023-03-01:/.test(s)), posted);
    NS.books.opening(w, oid, { date: '2025-12-31', lines: lines(H) }, ACTOR);
    const r = NS.books.sync(w, { today: NS.dates.today() });
    const g = w.books.funds[oid];
    const stillLive = posted.filter((s) => NS.books.live(g, s));
    check('the next sync reverses both (none is live)', r.reversed === 2 && !stillLive.length, { r, stillLive });
    const tb = NS.books.trialBalance(w, oid, '', '2025-12-31').filter((x) => x.end !== 0).map((x) => ({ code: x.code, end: x.end }));
    const sum = {};
    lines(H).forEach((l) => (sum[l[0]] = (sum[l[0]] || 0) + l[1]));
    const wantTb = Object.keys(sum).sort().map((c) => ({ code: c, end: sum[c] }));
    check('the trial balance at 2025-12-31 equals the opening entry', J(tb) === J(wantTb), { tb, wantTb });
  },

  /**
   * FA-07, fund A: finalizing June 2026 brings the books up to date, locks them, and writes 'Books closed' with the trial
   * balance hash and the person to the hash-chained change log; reopening needs a reason and is logged; only an owner may
   * do either (a stubbed can('configure') and the team role are both refused, and nothing is logged or locked).
   */
  finalize: ({ check }) => {
    const NS = load('2027-01-20');
    need(NS, 'finalize');
    need(NS, 'reopenBooks');
    const F = fixture('fund-a');
    const ws = F.records;
    const oid = F.expect.offeringId;
    F.entries.forEach((e) => NS.books.post(ws, oid, e, ACTOR));
    const f = ws.books.funds[oid];
    check('before finalize the records are not posted (no fee entry)', !NS.books.live(f, 'fee:fund-a:2026-06'));
    const rec = NS.books.finalize(ws, oid, '2026-06-30', ACTOR);
    check('finalize brought the books up to date first (the June fee and the call are posted)', !!NS.books.live(f, 'fee:fund-a:2026-06') && !!NS.books.live(f, 'call:fa-call-1:FA-1001'));
    const tb = NS.audit.sha256(NS.books.tbText(ws, oid, '2026-06-30'));
    check("the closed record holds the trial balance's SHA-256 through 2026-06-30 and the person", rec && rec.through === '2026-06-30' && rec.tb === tb && rec.by === ACTOR.by && J(f.closed[f.closed.length - 1]) === J(rec), rec);
    const last = ws.audit[ws.audit.length - 1];
    check("the change log's last entry is 'Books closed', record 2026-06-30, detail 'Trial balance SHA-256 <hash>', by the person", last && last.action === 'Books closed' && last.fund === oid && last.record === '2026-06-30' && last.detail === 'Trial balance SHA-256 ' + tb && last.actor === ACTOR.by, last);
    const v = NS.audit.verify(ws);
    check('NS.audit.verify is ok', v && v.ok === true, v);
    const t = throws(() => NS.books.post(ws, oid, { date: '2026-06-30', src: 'man:late', lines: [['5900', 100], ['1000', -100]] }, ACTOR));
    check('a post dated 2026-06-30 throws', !!t && NS.books.closedThrough(ws, oid) === '2026-06-30', t);
    const n = ws.audit.length;
    const t2 = throws(() => NS.books.reopenBooks(ws, oid, { why: '  ', by: ACTOR.by, at: ACTOR.at }));
    check('reopenBooks without a reason throws; nothing is logged and the books stay closed', !!t2 && ws.audit.length === n && NS.books.closedThrough(ws, oid) === '2026-06-30', t2);
    const why = 'Late invoice for June legal fees';
    const re = NS.books.reopenBooks(ws, oid, { why, by: ACTOR.by, at: ACTOR.at });
    const last2 = ws.audit[ws.audit.length - 1];
    check("with a reason: 'Books reopened', record 2026-06-30, detail the reason; the books are open", re && ws.audit.length === n + 1 && last2.action === 'Books reopened' && last2.fund === oid && last2.record === '2026-06-30' && last2.detail === why && last2.actor === ACTOR.by && NS.books.closedThrough(ws, oid) === '' && NS.audit.verify(ws).ok === true, last2);

    // Only an owner: can('configure') stubbed to false, then the team role.
    NS.books.finalize(ws, oid, '2026-06-30', ACTOR);
    const realCan = NS.app.can;
    const refuse = (label) => {
      const logN = ws.audit.length;
      const closed = J(f.closed);
      const a = throws(() => NS.books.finalize(ws, oid, '2026-07-31', ACTOR));
      const b = throws(() => NS.books.reopenBooks(ws, oid, { why: 'Not allowed', by: ACTOR.by, at: ACTOR.at }));
      check(`${label}: finalize and reopenBooks throw; nothing is logged or locked`, !!a && !!b && ws.audit.length === logN && J(f.closed) === closed && NS.books.closedThrough(ws, oid) === '2026-06-30', { a, b });
    };
    NS.app.can = (what, role) => (what === 'configure' ? false : realCan(what, role));
    refuse("can('configure') answers false");
    NS.app.can = realCan;
    const role = NS.app.state.role;
    NS.app.state.role = 'team';
    refuse('a team member (role team)');
    NS.app.state.role = role;
    check('NS.audit.verify is still ok', NS.audit.verify(ws).ok === true);
  },

  /**
   * FA-05, fund B (today 2026-03-05): B-1002's full redemption at 2026-02-28 is 49,457,616; once February is finalized a
   * correction inside it moves the engine's figure but not the redemption's amount, and the books list the change.
   */
  redemption: ({ check }) => {
    const NS = load('2026-03-05');
    need(NS, 'finalize');
    const F = fixture('fund-b');
    const ws = F.records;
    const oid = F.expect.offeringId;
    const o = ws.offerings[0];
    F.entries.forEach((e) => NS.books.post(ws, oid, e, ACTOR));
    const r = { id: 'req-b-2', type: 'redemption', offeringId: oid, investorId: 'B-1002', cents: 0, full: true, dealing: '2026-02-28', status: 'approved', submitted: '2026-02-10', decided: '2026-02-12' };
    ws.requests.push(r);
    const before = NS.ops.redemptionAmount(ws, r);
    check("before finalize the engine's amount is B-1002's February ending capital 49,457,616", before === 49457616, before);
    NS.books.finalize(ws, oid, '2026-02-28', ACTOR);
    const e = NS.books.live(ws.books.funds[oid], 'req:' + r.id);
    check('the posted req entry is [3100 +49,457,616 B-1002][2200 -49,457,616]', e && J(e.lines) === J([['3100', 49457616, 'B-1002'], ['2200', -49457616]]), e);
    // The subscription is corrected from 500,000.00 to 501,000.00 after the month is final.
    ws.investors.find((i) => i.id === 'B-1002').positions[0].amount = 501000;
    NS.clearCaches();
    const L2 = NS.audit.ledger(ws, o);
    const row = L2.byKey['2026-02'] && L2.byKey['2026-02'].rows['B-1002'];
    check("the engine's February capital for B-1002 is no longer 49,457,616", row && row.redeem !== 49457616, row && row.redeem);
    NS.books.sync(ws, { today: NS.dates.today() });
    const after = NS.ops.redemptionAmount(ws, r);
    check('redemptionAmount still returns 49,457,616 (the amount posted when February was finalized)', after === 49457616, after);
    const ex = ws.books.funds[oid].exceptions.map((x) => x.src);
    check('fund.exceptions lists pos:B-1002:2026-02-01:0 and req:req-b-2', ex.indexOf('pos:B-1002:2026-02-01:0') >= 0 && ex.indexOf('req:req-b-2') >= 0, ex);
    const e2 = NS.books.live(ws.books.funds[oid], 'req:' + r.id);
    check('the req entry is unchanged (the change is reported, not applied)', e2 && e2.id === e.id && J(e2.lines) === J(e.lines), e2);
    // Not finalized: the amount follows the engine as before.
    NS.books.reopenBooks(ws, oid, { why: 'Correct B-1002 subscription', by: ACTOR.by, at: ACTOR.at });
    const open = NS.ops.redemptionAmount(ws, r);
    check("once February is reopened the amount is the engine's again", open === row.redeem, { open, engine: row.redeem });
    const paid = Object.assign({}, r, { paidCents: 12345 });
    check('a paid redemption still returns its paidCents', NS.ops.redemptionAmount(ws, paid) === 12345);
  },

  /** The check's own rules: an unknown case name and an empty list each exit 1 with a FAIL line (child processes). */
  selfcheck: ({ check }) => {
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const a = run(['--case', 'no-such-case']);
    const b = run(['--case', '']);
    check('an unknown --case name exits 1 with a FAIL line', a.status === 1 && /^FAIL unknown case name: no-such-case/m.test(a.stdout) && /HOLDINGS: FAIL \(cases run: 0\)/.test(a.stdout), a.stdout);
    check('an empty list exits 1 with a FAIL line', b.status === 1 && /^FAIL no cases to run/m.test(b.stdout) && /HOLDINGS: FAIL \(cases run: 0\)/.test(b.stdout), b.stdout);
  }
};

L.runParts(cases, { name: 'HOLDINGS', unit: 'cases', flag: '--case' });
