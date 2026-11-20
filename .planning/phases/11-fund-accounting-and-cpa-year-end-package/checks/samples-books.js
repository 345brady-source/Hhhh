// gate: node
// last "SAMPLES BOOKS: PASS (cases run: 7)"
// Sample funds through the same ledger (plan 11-09, FA-03, no browser): each month of a sample fund carries one sample
// entry (src sim:<offeringId>:<YYYY-MM>) holding the generator's income and gain, which moves the balance sheet to the
// one the Audit page already shows. Then the journal's net assets equal the limited partners' capital plus the general
// partner's accrued share at every month-end (T3), and the trial balance sums to zero. The portal is loaded inside each
// case with load11.js (the scripts diy.html lists, then books.js and books-post.js) and its sampleWorkspaces, today
// 2026-11-19, self-serve edition.
//   node samples-books.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "SAMPLES BOOKS: PASS (cases run: N)" or
// "SAMPLES BOOKS: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal, sampleWorkspaces } = require('./load11.js');

const DAY = '2026-11-19';
const AT = '2026-11-19T10:00:00.000Z';
const J = (x) => JSON.stringify(x);
const n = (c) => String(c).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** The portal with the journal and the posting module, loaded inside the case. */
function load(day) {
  const NS = loadPortal(undefined, { today: day || DAY, extra: ['books.js', 'books-post.js'] });
  if (!NS.books || typeof NS.books.desired !== 'function' || typeof NS.books.sync !== 'function') throw new Error('assets/js/books-post.js did not add NS.books.desired and NS.books.sync');
  return NS;
}
const sync = (NS, ws, day) => NS.books.sync(ws, { today: day || DAY, at: AT });
function endOf(k) {
  const [y, m] = k.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
/** Live entries of a fund (not reversed, not a reversal). */
function liveOf(ws, oid) {
  const f = ws.books && ws.books.funds && ws.books.funds[oid];
  const j = f && Array.isArray(f.journal) ? f.journal : [];
  const reversed = new Set(j.filter((e) => e.rev).map((e) => e.rev));
  return j.filter((e) => !e.rev && !reversed.has(e.id));
}

/**
 * T3 for one sample fund at every month-end of its ledger: one live sim entry per month (dated the month-end, balancing
 * by itself), journal net assets = LP capital + the GP's accrued share, 1000 = H.cash, 1100 + 1150 = H.longFV,
 * 2100 = -H.feePayable, the trial balance sums to zero; desired.unbalanced is empty. Returns { months, bad: [...] }.
 */
function tie(NS, ws, o, day) {
  const oid = o.id;
  const bad = [];
  const L = NS.audit.ledger(ws, o);
  const d = NS.books.desired(ws, o, { today: day || DAY });
  if (!Array.isArray(d.unbalanced)) bad.push(`${oid}: desired has no unbalanced list`);
  else if (d.unbalanced.length) bad.push(`${oid}: unbalanced ${J(d.unbalanced.slice(0, 3))}${d.unbalanced.length > 3 ? ` and ${d.unbalanced.length - 3} more` : ''}`);
  const live = liveOf(ws, oid);
  const sims = live.filter((e) => /^sim:/.test(e.src));
  const stray = sims.filter((e) => e.src.indexOf(`sim:${oid}:`) !== 0 || L.keys.indexOf(e.src.slice(oid.length + 5)) < 0);
  if (stray.length) bad.push(`${oid}: sim entries for no month of the fund: ${stray.slice(0, 3).map((e) => e.src).join(', ')}`);
  const al = NS.books
    .accounts(ws, oid)
    .filter((a) => a.type === 'asset' || a.type === 'liability')
    .map((a) => a.code);
  L.keys.forEach((k) => {
    const E = endOf(k);
    const mine = sims.filter((e) => e.src === `sim:${oid}:${k}`);
    if (mine.length !== 1) bad.push(`${oid} ${k}: ${mine.length} sim entries`);
    else if (mine[0].date !== E || mine[0].lines.reduce((a, l) => a + l[1], 0) !== 0) bad.push(`${oid} ${k}: the sim entry is dated ${mine[0].date} or does not balance`);
    const P = NS.audit.period(ws, o, k + '-01', E);
    const H = P.hold;
    const got = {
      na: NS.books.balance(ws, oid, al, E),
      cash: NS.books.balance(ws, oid, '1000', E),
      inv: NS.books.balance(ws, oid, ['1100', '1150'], E),
      fee: NS.books.balance(ws, oid, '2100', E),
      tb: NS.books.trialBalance(ws, oid, '', E).reduce((a, r) => a + r.end, 0)
    };
    const want = { na: P.fund.end + P.fund.gpEnd, cash: H.cash, inv: H.longFV, fee: -H.feePayable, tb: 0 };
    if (J(got) !== J(want)) bad.push(`${oid} ${k}: journal ${J(got)} engine ${J(want)}`);
  });
  return { months: L.keys.length, bad };
}
const show = (check, name, r, extra) => check(name, r.bad.length === 0, r.bad.length ? `${r.bad.length} problems; first: ${r.bad.slice(0, 4).join(' | ')}` : extra);

const cases = {
  /** Kestrel Bay's fund ii: a balancing sample entry every month; the journal ties to its capital accounts at every month-end. */
  kestrel: ({ check }) => {
    const NS = load();
    const ws = sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
    const o = ws && ws.offerings.find((x) => x.id === 'kb-fund-ii');
    check('Kestrel Bay and its fund ii are in the sample firms', !!o);
    if (!o) return;
    const r = sync(NS, ws);
    const L = NS.audit.ledger(ws, o);
    const first = liveOf(ws, o.id).find((e) => e.src === `sim:${o.id}:${L.keys[0]}`);
    if (first) {
      console.log(`  first sample entry of kb-fund-ii: ${first.src}, dated ${first.date}, memo "${first.memo}"`);
      first.lines.forEach((l) => console.log(`    ${l[0]} ${l[1] > 0 ? 'debit ' : 'credit'} ${n(Math.abs(l[1]))}`));
      console.log(`    sum ${first.lines.reduce((a, l) => a + l[1], 0)}`);
    }
    check('the first sync posted entries', r.posted > 0, r);
    show(check, `kb-fund-ii ties at all ${L.keys.length} month-ends (${L.keys[0]} to ${L.keys[L.keys.length - 1]}): T3, 1000, 1100 + 1150, 2100, the trial balance`, tie(NS, ws, o));
  },

  /** A second sync of every sample firm posts and reverses nothing and leaves the books identical (11-CONTEXT B1). */
  repeat: ({ check }) => {
    const NS = load();
    const wss = sampleWorkspaces(NS);
    let sims = 0;
    wss.forEach((ws) => {
      sync(NS, ws);
      const before = J(ws.books);
      ws.offerings.forEach((o) => (sims += liveOf(ws, o.id).filter((e) => /^sim:/.test(e.src)).length));
      const r = sync(NS, ws);
      check(`${ws.tenant.id}: a second sync posts and reverses nothing; the books are identical`, r.posted === 0 && r.reversed === 0 && J(ws.books) === before, r);
    });
    check('the books held sample entries when synced again', sims > 0, { sims });
  },

  /** The kestrel case's assertions for every one of the 15 sample funds, every month-end. */
  all: ({ check }) => {
    const NS = load();
    const wss = sampleWorkspaces(NS);
    const funds = wss.reduce((a, w) => a + w.offerings.length, 0);
    check('four sample firms with 15 funds, every one a sample fund', wss.length === 4 && funds === 15 && wss.every((w) => w.offerings.every((o) => NS.audit.generated(o))), { firms: wss.length, funds });
    let months = 0;
    wss.forEach((ws) => {
      sync(NS, ws);
      ws.offerings.forEach((o) => {
        const r = tie(NS, ws, o);
        months += r.months;
        show(check, `${o.id}: ties at all ${r.months} month-ends`, r);
      });
    });
    console.log(`  fund-months tied: ${months}`);
  },

  /** Books at most 300,000 bytes of JSON per sample firm and the four workspaces at most 2,500,000, measured. */
  storage: ({ check }) => {
    const NS = load();
    let total = 0;
    sampleWorkspaces(NS).forEach((ws) => {
      sync(NS, ws);
      const books = J(ws.books).length;
      const whole = J(ws).length;
      total += whole;
      const funds = Object.values(ws.books.funds);
      const entries = funds.reduce((a, f) => a + f.journal.length, 0);
      const sims = funds.reduce((a, f) => a + f.journal.filter((e) => /^sim:/.test(e.src)).length, 0);
      console.log(`  ${ws.tenant.id}: books ${n(books)} bytes, ${n(entries)} entries (${n(sims)} sample entries), workspace ${n(whole)} bytes`);
      check(`${ws.tenant.id}: books at most 300,000 bytes (${n(books)})`, books <= 300000);
    });
    console.log(`  four sample workspaces together: ${n(total)} bytes`);
    check(`the four sample workspaces together at most 2,500,000 bytes (${n(total)})`, total <= 2500000);
  },

  /** The milliseconds of a first and a second sync of the sample firm with the most fund-months (measured, no limit). */
  speed: ({ check }) => {
    const NS = load();
    const wss = sampleWorkspaces(NS);
    const size = (ws) => ws.offerings.reduce((a, o) => a + NS.audit.ledger(ws, o).keys.length, 0);
    const ws = wss.slice().sort((a, b) => size(b) - size(a))[0];
    const fm = size(ws);
    const ms = () => Number(process.hrtime.bigint()) / 1e6;
    let t = ms();
    const r1 = sync(NS, ws);
    const first = ms() - t;
    t = ms();
    const r2 = sync(NS, ws);
    const second = ms() - t;
    console.log(`  ${ws.tenant.id} (${fm} fund-months, the most): first sync ${first.toFixed(1)} ms (${r1.posted} entries posted), second sync ${second.toFixed(1)} ms (${r2.posted} posted)`);
    check(`measured on ${ws.tenant.id}: the first sync posted sample entries and the second posted nothing`, r1.posted > 0 && r2.posted === 0 && liveOf(ws, ws.offerings[0].id).some((e) => /^sim:/.test(e.src)), { r1, r2 });
  },

  /**
   * Edits a person makes in sample firms (11-CONTEXT W1). Kestrel Bay: an entry made by hand (man:, cash into
   * investments, June 2026). A capital call: Kestrel Bay's fund ii is fully called in the seed (five calls, 100% of
   * commitments), so NS.ops.issueCall refuses there; the call is issued in Pellbrook's pb-ventures-i (70% called) on
   * 2026-11-19 and one item is received on 2026-11-25, recorded on 2026-12-05 once November is complete (an open month).
   * After sync, T3 holds at every month-end of both funds, the call entry exists once and every sample entry once.
   * Then, on its own copy, an expense entered by hand, which the generated figures do not hold: the sample entries from
   * that month on cannot balance and are left out and reported, never forced.
   */
  edit: ({ check }) => {
    const NS = load();
    const wss = sampleWorkspaces(NS);
    const ws = wss.find((w) => w.tenant.id === 'kestrel-bay');
    const o = ws.offerings.find((x) => x.id === 'kb-fund-ii');
    sync(NS, ws);
    check('Kestrel Bay fund ii has no open call and no commitment left to call', !(ws.calls || []).some((c) => c.offeringId === o.id && c.items.some((it) => !it.received)) && NS.ops.issueCall(ws, o, { pct: 0.01, due: '2026-12-15' }) === null);
    const june0 = liveOf(ws, o.id).find((e) => e.src === `sim:${o.id}:2026-06`);
    NS.books.post(ws, o.id, { src: 'man:check-1', date: '2026-06-15', memo: 'Investment bought', lines: [['1100', 1234567], ['1000', -1234567]] }, { by: 'Check Runner', at: AT });
    const r = sync(NS, ws);
    // June's sample entry takes the entry made by hand back out of 1000 and 1100; later months count June's new entry, so
    // their own entries are unchanged.
    const june = liveOf(ws, o.id).find((e) => e.src === `sim:${o.id}:2026-06`);
    const amt = (e, code) => (e ? e.lines.filter((l) => l[0] === code).reduce((a, l) => a + l[1], 0) : NaN);
    const moved = !!june0 && !!june && june0.id !== june.id && amt(june, '1000') - amt(june0, '1000') === 1234567 && amt(june, '1100') - amt(june0, '1100') === -1234567;
    check("kb-fund-ii, an entry made by hand in June 2026: sync reversed and posted June's sample entry only, now 1000 +1,234,567 and 1100 -1,234,567 against before", r.reversed === 1 && r.posted === 1 && moved, { r, before: june0 && june0.lines, after: june && june.lines });
    show(check, 'kb-fund-ii ties at every month-end after the entry made by hand (T3, 1000, 1100 + 1150, 2100, the trial balance)', tie(NS, ws, o));
    const again = sync(NS, ws);
    check('kb-fund-ii: a further sync changes nothing', again.posted === 0 && again.reversed === 0, again);

    // The capital call in Pellbrook's pb-ventures-i.
    const DAY2 = '2026-12-05';
    const pw = wss.find((w) => w.tenant.id === 'pellbrook');
    const po = pw.offerings.find((x) => x.id === 'pb-ventures-i');
    sync(NS, pw);
    const call = NS.ops.issueCall(pw, po, { pct: 0.05, due: '2026-12-15' });
    check('pb-ventures-i: a call issued on 2026-11-19', !!call && call.noticeDate === DAY, call && { notice: call.noticeDate, total: call.total });
    if (!call) return;
    const NS2 = load(DAY2);
    sync(NS2, pw, DAY2);
    const it = call.items[0];
    const got = NS2.ops.receive(pw, call, it.investorId, '2026-11-25');
    const before = liveOf(pw, po.id).find((e) => e.src === `sim:${po.id}:2026-11`);
    const r2 = sync(NS2, pw, DAY2);
    const src = `call:${call.id}:${it.investorId}`;
    const calls = liveOf(pw, po.id).filter((e) => e.src === src);
    const after = liveOf(pw, po.id).find((e) => e.src === `sim:${po.id}:2026-11`);
    check(`pb-ventures-i: the payment was received (${n(it.cents)} cents from ${it.investorId}, 2026-11-25) and the call entry exists once`, got === true && calls.length === 1 && calls[0].date === '2026-11-25' && J(calls[0].lines) === J([['1000', it.cents], ['3000', -it.cents, it.investorId]]), calls);
    check("pb-ventures-i: November's sample entry was reversed and posted again with the payment", !!before && !!after && before.id !== after.id && r2.reversed >= 1, { r2, before: before && before.id, after: after && after.id });
    show(check, 'pb-ventures-i ties at every month-end through November 2026 after the payment', tie(NS2, pw, po, DAY2));
    const again2 = sync(NS2, pw, DAY2);
    check('pb-ventures-i: a further sync changes nothing', again2.posted === 0 && again2.reversed === 0, again2);

    // An expense entered by hand in a sample fund: never forced into a sample entry.
    const ws2 = sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
    sync(NS, ws2);
    NS.books.post(ws2, o.id, { src: 'man:check-2', date: '2026-09-10', memo: 'Legal fees', lines: [['5100', 50000], ['1000', -50000]] }, { by: 'Check Runner', at: AT });
    const d = NS.books.desired(ws2, o, { today: DAY });
    const u = d.unbalanced || [];
    sync(NS, ws2);
    const live2 = liveOf(ws2, o.id).filter((e) => e.src === `sim:${o.id}:2026-09` || e.src === `sim:${o.id}:2026-10`);
    const ex = ws2.books.funds[o.id].exceptions.filter((x) => x.kind === 'unbalanced');
    console.log(`  hand-entered expense: unbalanced ${J(u)}; listed ${J(ex.map((x) => [x.src, x.cents]))}`);
    check('an expense entered by hand: September and October 2026 are reported (September off by the 50,000) and not posted; no line is added', J(u.map((x) => x.src)) === J([`sim:${o.id}:2026-09`, `sim:${o.id}:2026-10`]) && u[0].sum === 50000 && live2.length === 0 && ex.length === 2, { u, live: live2.length, ex });
  },

  /** The check's own rules: an unknown case name and an empty list each exit 1 with a FAIL line; seven cases. */
  selfcheck: ({ check }) => {
    const { spawnSync } = require('child_process');
    const fs = require('fs');
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const a = run(['--case', 'no-such-case']);
    const b = run(['--case', '']);
    check('an unknown --case name exits 1 with a FAIL line', a.status === 1 && /^FAIL unknown case name: no-such-case/m.test(a.stdout) && /SAMPLES BOOKS: FAIL \(cases run: 0\)/.test(a.stdout), a.stdout);
    check('an empty list exits 1 with a FAIL line', b.status === 1 && /^FAIL no cases to run/m.test(b.stdout) && /SAMPLES BOOKS: FAIL \(cases run: 0\)/.test(b.stdout), b.stdout);
    check('the gate marker names seven cases, as many as the check has', /^\/\/ last "SAMPLES BOOKS: PASS \(cases run: 7\)"$/m.test(fs.readFileSync(__filename, 'utf8')) && Object.keys(cases).length === 7, Object.keys(cases));
  }
};

L.runParts(cases, { name: 'SAMPLES BOOKS', unit: 'cases', flag: '--case' });
