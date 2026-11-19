// gate: node
// last "BOOKS CORE: PASS (cases run: 8)"
// Pure checks for the fund journal (plan 11-01, no browser): assets/js/books.js in a fresh sandbox per case, the way the
// browser loads it (window.CVPortal). The smallest set of scripts that loads it: assets/js/tenants.js (NS.OFFERING_TYPES,
// for the chart's fund type), assets/js/data.js (NS.dates), assets/js/audit.js (NS.audit.sha256), then assets/js/books.js;
// the sandbox is given TextEncoder (audit.js's sha256 needs it) and NS.dates.today is fixed to 2027-01-20.
// Every expected figure of hand-worked fund A is read from fixtures/fund-a.js, never typed here.
//   node books-core.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "BOOKS CORE: PASS (cases run: N)" or
// "BOOKS CORE: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const SRC = (f) => fs.readFileSync(path.join(L.ROOT, f), 'utf8');
const FILES = ['assets/js/tenants.js', 'assets/js/data.js', 'assets/js/audit.js', 'assets/js/books.js'];
const TODAY = '2027-01-20';
/** A fresh sandbox with the four scripts. Called inside each case, so a missing or broken module prints a FAIL line. */
function load() {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window, TextEncoder });
  FILES.forEach((f) => {
    vm.runInContext(SRC(f), ctx, { filename: f });
    if (f === 'assets/js/data.js') window.CVPortal.dates.today = () => TODAY;
  });
  if (!window.CVPortal.books) throw new Error('assets/js/books.js did not set NS.books');
  return window.CVPortal;
}
/** A fresh copy of the fixture (the require cache is not shared between cases' workspaces). */
function fixture() {
  return JSON.parse(JSON.stringify(require('./fixtures/fund-a.js')));
}
const J = (x) => JSON.stringify(x);
const sum = (a) => a.reduce((s, x) => s + x, 0);
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };

/** Fund A's workspace with every record entry and every other entry posted. */
function fundA(NS) {
  const F = fixture();
  const ws = F.records;
  const oid = F.expect.offeringId;
  F.recordEntries.concat(F.entries).forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  return { F, ws, oid };
}
/** Totals by type of a trial balance's ends, in the signs a reader uses (each positive when normal). */
function byType(rows) {
  const t = { asset: 0, liability: 0, equity: 0, income: 0, expense: 0, gain: 0, other: 0 };
  rows.forEach((r) => (t[r.type] !== undefined ? (t[r.type] += r.end) : (t.other += r.end)));
  return { assets: t.asset, liabilities: -t.liability, equity: -t.equity, income: -t.income, expenses: t.expense, gains: -t.gain, other: t.other };
}

/** The code of the first stored entry with this src. */
const idOf = (ws, oid, src) => (ws.books.funds[oid].journal.find((e) => e.src === src) || {}).id;
/** The fixture entry with this src. */
const fx = (F, src) => F.recordEntries.concat(F.entries).find((e) => e.src === src);
/** What a call throws: its message, or '' when it does not throw. */
function thrown(fn) {
  try {
    fn();
    return '';
  } catch (e) {
    return String((e && e.message) || e || 'thrown');
  }
}

/* The chart template of the interfaces block (11-01-PLAN.md), by type; the starred codes are real estate only. */
const TEMPLATE = {
  asset: ['1000', '1100', '1150', '1200', '1300', '1400*', '1410*', '1490*'],
  liability: ['2000', '2100', '2200', '2250', '2300', '2400', '2500', '2600'],
  equity: ['3000', '3100', '3300', '3900'],
  income: ['4000', '4010', '4020', '4030', '4090'],
  expense: ['5000', '5100', '5110', '5120', '5200', '5900', '5300*', '5310*', '5320*', '5330*', '5340*', '5390*'],
  gain: ['6000', '6100']
};
const LINES = { 1000: '1', 1100: '8', 1150: '8', 1200: '6', 1300: '13', 1400: '11', 1410: '9a', 1490: '9b', 2000: '15', 2100: '17', 2200: '17', 2250: '17', 2300: '17', 2400: '17', 2500: '19b', 2600: '19a', 3000: '21', 3100: '21', 3300: '21', 3900: '21' };

const cases = {
  /** The template for a fund type, and accounts added beyond it. */
  chart: ({ check }) => {
    const NS = load();
    const pe = NS.books.chart({ type: 'Private equity fund' });
    const re = NS.books.chart({ type: 'Real estate fund' });
    const all = [];
    const general = [];
    Object.keys(TEMPLATE).forEach((t) => TEMPLATE[t].forEach((c) => (all.push([c.replace('*', ''), t]), c.endsWith('*') || general.push([c, t]))));
    const pairs = (rows) => J(rows.map((r) => [r.code, r.type]).sort());
    check('a Private equity fund gets 30 accounts, each with its type', pe.length === 30 && pairs(pe) === J(general.slice().sort()), pe.map((r) => r.code));
    check('a Real estate fund gets 39 accounts, each with its type', re.length === 39 && pairs(re) === J(all.slice().sort()), re.map((r) => r.code));
    const nine = all.filter((p) => general.every((g) => g[0] !== p[0])).map((p) => p[0]);
    check('the nine real estate codes are absent from the Private equity chart', nine.length === 9 && nine.every((c) => !pe.some((r) => r.code === c)), nine);
    check('a Real estate syndication and a Delaware Statutory Trust also get 39 (profile realestate)', NS.books.chart({ type: 'Real estate syndication' }).length === 39 && NS.books.chart({ type: 'Delaware Statutory Trust' }).length === 39);
    check('an offering of an unknown type gets the 30', NS.books.chart({ type: 'Nothing like it' }).length === 30 && NS.books.chart(null).length === 30);
    check('every asset, liability and equity account has its Schedule L line', re.filter((r) => ['asset', 'liability', 'equity'].includes(r.type)).every((r) => r.line && r.line === LINES[r.code]), re.map((r) => [r.code, r.line]));
    check('no income, expense or gain account has one', re.filter((r) => ['income', 'expense', 'gain'].includes(r.type)).every((r) => r.line === ''));
    check('every account has a name and the chart is in code order', re.every((r) => typeof r.name === 'string' && r.name.length > 3) && J(re.map((r) => r.code)) === J(re.map((r) => r.code).slice().sort()));

    const F = fixture();
    const ws = F.records;
    const oid = F.expect.offeringId;
    check('accounts() of fund A is the 30 of the template before anything is added', NS.books.accounts(ws, oid).length === 30);
    const before = J(ws);
    const refused = [
      ['a used code', { code: '1000', name: 'Cash again', type: 'asset', line: '1' }],
      ['a code of three digits', { code: '101', name: 'Short', type: 'asset' }],
      ['a code of five digits', { code: '10100', name: 'Long', type: 'asset' }],
      ['a code that is not digits', { code: '10a0', name: 'Letters', type: 'asset' }],
      ['an unknown type', { code: '1010', name: 'Odd', type: 'revenue' }]
    ].map(([what, a]) => [what, thrown(() => NS.books.addAccount(ws, oid, a))]);
    check('addAccount refuses a used code, a code that is not four digits and an unknown type, each with a sentence', refused.every((r) => r[1].length > 10), refused);
    check('nothing is stored by a refused account', J(ws) === before);
    const added = NS.books.addAccount(ws, oid, { code: '1010', name: 'Cash, second bank account', type: 'asset', line: '1' });
    const acc = NS.books.accounts(ws, oid);
    check('a new account is returned, stored compactly and listed in code order', J(added) === J({ code: '1010', name: 'Cash, second bank account', type: 'asset', line: '1' }) && J(ws.books.funds[oid].accounts) === J([['1010', 'Cash, second bank account', 'asset', '1']]) && acc.length === 31 && acc[1].code === '1010', acc.slice(0, 3));
    check('the added account can then be posted to', NS.books.post(ws, oid, { date: '2026-02-01', memo: 'Move', src: 'man:1', lines: [['1010', 100], ['1000', -100]] }, ACTOR).lines[0][0] === '1010');
  },

  /** check() refuses each fault with its own sentence; nothing is stored (T-11-01). */
  check: ({ check }) => {
    const NS = load();
    const F = fixture();
    const ws = F.records;
    const oid = F.expect.offeringId;
    const accts = NS.books.accounts(ws, oid);
    const good = { date: '2026-03-10', memo: 'Legal fees', src: 'man:check', lines: [['5100', 750000], ['1000', -750000]] };
    check('a valid two-line entry gives the empty sentence', NS.books.check(good, accts) === '', NS.books.check(good, accts));
    const faults = [
      ['a line of 12.5 cents', { lines: [['5100', 12.5], ['1000', -12.5]] }],
      ['a line of 0', { lines: [['5100', 0], ['1000', 0]] }],
      ['one line only', { lines: [['5100', 750000]] }],
      ['an unknown code', { lines: [['9999', 750000], ['1000', -750000]] }],
      ['lines summing to 1 cent', { lines: [['5100', 750001], ['1000', -750000]] }],
      ['the date 2026-02-30', { date: '2026-02-30' }],
      ['a NaN amount', { lines: [['5100', NaN], ['1000', 750000]] }],
      ['an amount of 1e300 (not a safe integer)', { lines: [['5100', 1e300], ['1000', -1e300]] }]
    ];
    const said = [];
    faults.forEach(([what, over]) => {
      const e = Object.assign({}, good, over);
      const sentence = NS.books.check(e, accts);
      const len = ws.books.funds[oid].journal.length;
      const before = J(ws);
      const msg = thrown(() => NS.books.post(ws, oid, e, ACTOR));
      said.push(sentence);
      check(`${what}: refused with a sentence, post throws it and nothing is stored`, sentence.length > 10 && /[.]$/.test(sentence) && msg === sentence && ws.books.funds[oid].journal.length === len && J(ws) === before, { sentence, msg });
    });
    check('each fault has its own sentence', new Set(said).size === faults.length, said);
    check('the sentence for 1 cent says by how much', /\$0\.01/.test(said[4]), said[4]);
    // I4: the amount itself must be a safe integer (not only the running total); 2^53 is an integer but not a safe one.
    const big = NS.books.check(Object.assign({}, good, { lines: [['1000', -9007199254740992], ['5100', 9007199254740992]] }), accts);
    check('I4: 1e300 and 2^53 are refused on their own line as amounts too large to hold exactly', /^Line 1: .*too large/.test(said[7]) && /^Line 1: .*too large/.test(big), { e300: said[7], big });
    check('a valid entry posts after the refusals', NS.books.post(ws, oid, good, ACTOR).id === 'je-000001');
  },

  /** Ids, who and when, repeat by src, compact lines, holdings. */
  post: ({ check }) => {
    const NS = load();
    const F = fixture();
    const ws = F.records;
    const oid = F.expect.offeringId;
    const first = NS.books.post(ws, oid, fx(F, 'bank:fa-1'), ACTOR);
    const second = NS.books.post(ws, oid, fx(F, 'bank:fa-2'), { by: 'Second Person', at: '2027-01-21T09:00:00.000Z' });
    const third = NS.books.post(ws, oid, fx(F, 'mark:fa-m1'), ACTOR);
    check('ids run je-000001, je-000002, je-000003', [first.id, second.id, third.id].join(',') === 'je-000001,je-000002,je-000003', [first.id, second.id, third.id]);
    const j = ws.books.funds[oid].journal;
    check('at and by are stored', j[1].by === 'Second Person' && j[1].at === '2027-01-21T09:00:00.000Z' && j[0].by === ACTOR.by && j[0].at === ACTOR.at);
    check('the stored entry has exactly id, date, memo, src, lines, at, by', J(Object.keys(j[1])) === J(['id', 'date', 'memo', 'src', 'lines', 'at', 'by']), Object.keys(j[1]));
    const again = NS.books.post(ws, oid, fx(F, 'bank:fa-2'), ACTOR);
    check('posting bank:fa-2 a second time returns the first entry and adds nothing (T13)', again.id === second.id && again.by === 'Second Person' && j.length === 3, { again, n: j.length });
    check('lines are stored compactly: an empty investor kept before a holding, trailing empty ids left out', J(j[0].lines) === J([['1100', 40000000, '', 'fa-x'], ['1000', -40000000]]), j[0].lines);
    const c = NS.books.post(ws, oid, { date: '2026-01-15', memo: 'm', src: 'man:compact', lines: [['1000', 5, '', ''], ['3000', -5, 'FA-1001', ''], ['3000', 0 + 1, null, undefined], ['1000', -1, 'FA-1001', null]] }, ACTOR);
    check('trailing empty, null and missing ids are left out', J(c.lines) === J([['1000', 5], ['3000', -5, 'FA-1001'], ['3000', 1], ['1000', -1, 'FA-1001']]), c.lines);
    c.lines[0][1] = 999;
    check('the returned entry is a copy: changing it changes no stored entry (T-11-03)', j[3].lines[0][1] === 5);

    const fresh = { offerings: [{ id: 'o1', type: 'Private equity fund' }], investors: [] };
    NS.books.post(fresh, 'o1', { date: '2026-01-01', src: 'man:1', lines: [['1000', 1], ['3000', -1]] }, ACTOR);
    const f = fresh.books && fresh.books.funds && fresh.books.funds.o1;
    check('a workspace without books gets ws.books { v: 1, funds } and the fund with every list', fresh.books.v === 1 && f && f.start === '' && J(Object.keys(f).sort()) === J(['accounts', 'bank', 'closed', 'exceptions', 'holdings', 'journal', 'marks', 'start']) && J(f.bank) === J({ accounts: [], imports: [], lines: [], recs: [] }) && f.journal.length === 1, f);
    check('fund() for an offering the workspace does not hold throws', thrown(() => NS.books.fund(fresh, 'nope')).length > 0 && !fresh.books.funds.nope);

    // Holdings.
    const h = NS.books.addHolding(ws, oid, { name: 'Harbor Building', kind: 'property', level: 3, address: '1 Harbor Way', placed: '2026-02-01', landCents: 1000000, buildingCents: 4000000 });
    check("addHolding gives id 'h-' + base-36 count and stores every field", h.id === 'h-2' && J(ws.books.funds[oid].holdings[1]) === J(h) && h.landCents === 1000000 && h.placed === '2026-02-01', h);
    for (let n = 0; n < 9; n++) NS.books.addHolding(ws, oid, { name: 'H' + n, kind: 'investment', level: 2 });
    check('the eleventh holding is h-b', ws.books.funds[oid].holdings[10].id === 'h-b', ws.books.funds[oid].holdings.map((x) => x.id));
    const hb = J(ws);
    const bad = [
      thrown(() => NS.books.addHolding(ws, oid, { name: '', kind: 'investment', level: 3 })),
      thrown(() => NS.books.addHolding(ws, oid, { name: 'X', kind: 'boat', level: 3 })),
      thrown(() => NS.books.addHolding(ws, oid, { name: 'X', kind: 'investment', level: 4 })),
      thrown(() => NS.books.addHolding(ws, oid, { name: 'X', kind: 'property', level: 3, landCents: 10.5 })),
      thrown(() => NS.books.addHolding(ws, oid, { name: 'X', kind: 'property', level: 3, placed: '2026-13-01' })),
      thrown(() => NS.books.setHolding(ws, oid, 'h-zz', { name: 'Y' })),
      thrown(() => NS.books.setHolding(ws, oid, 'h-2', { buildingCents: -1 }))
    ];
    check('addHolding and setHolding refuse a missing name, unknown kind or level, fractional cents, a bad date and an unknown id; nothing changes', bad.every((m) => m.length > 10) && J(ws) === hb, bad);
    const s = NS.books.setHolding(ws, oid, 'h-2', { buildingCents: 4100000, id: 'h-9' });
    check('setHolding changes the fields given and never the id', s.id === 'h-2' && s.buildingCents === 4100000 && ws.books.funds[oid].holdings[1].buildingCents === 4100000 && s.name === 'Harbor Building');
  },

  'fund-a': ({ check }) => {
    const NS = load();
    const { F, ws, oid } = fundA(NS);
    const X = F.expect;
    // The fixture's own arithmetic, before anything is compared with the journal.
    check('fixture: the expected trial balance sums to 0', sum(X.tb.map((r) => r.end)) === 0, sum(X.tb.map((r) => r.end)));
    check('fixture: its debits and credits are the stated totals', sum(X.tb.filter((r) => r.end > 0).map((r) => r.end)) === X.tbDebits && -sum(X.tb.filter((r) => r.end < 0).map((r) => r.end)) === X.tbCredits && X.tbDebits === X.tbCredits);
    check('fixture: every amount is an integer number of cents', F.recordEntries.concat(F.entries).every((e) => e.lines.every((l) => Number.isSafeInteger(l[1]))));
    check('fixture: every entry it gives sums to 0', F.recordEntries.concat(F.entries).every((e) => sum(e.lines.map((l) => l[1])) === 0));
    check('fixture: the month-end capital adds up to the stated sum and average', sum(X.lpCapital) === X.lpCapitalSum && X.lpCapitalSum / 12 === X.lpCapitalAverage && X.lpCapital.length === 12);

    const fund = ws.books.funds[oid];
    check('every entry is stored (2 calls + 12 fees + 1 distribution + 8 others = 23)', fund.journal.length === F.recordEntries.length + F.entries.length && fund.journal.length === 23, fund.journal.length);
    check('every stored entry sums to 0 and holds only integer cents (T1)', fund.journal.every((e) => sum(e.lines.map((l) => l[1])) === 0 && e.lines.every((l) => Number.isSafeInteger(l[1]))));

    const tb = NS.books.trialBalance(ws, oid, '2026-01-01', '2026-12-31');
    check('the trial balance at 2026-12-31 has exactly the ten rows of expect.tb, in code order', J(tb.map((r) => r.code)) === J(X.tb.map((r) => r.code)), tb.map((r) => r.code));
    check('every row ends at the fixture figure, to the cent', J(tb.map((r) => [r.code, r.end])) === J(X.tb.map((r) => [r.code, r.end])), tb.map((r) => [r.code, r.end]));
    const deb = sum(tb.filter((r) => r.end > 0).map((r) => r.end));
    const cre = -sum(tb.filter((r) => r.end < 0).map((r) => r.end));
    check('debits total = credits total = expect.tbDebits (55,650,000)', deb === X.tbDebits && cre === X.tbCredits && deb === cre, { deb, cre });
    check('every row: end = begin + debits - credits, all integers, debits and credits not negative', tb.every((r) => r.end === r.begin + r.debits - r.credits && [r.begin, r.debits, r.credits, r.end].every(Number.isSafeInteger) && r.debits >= 0 && r.credits >= 0));
    check('the rows carry name, type and Schedule L line from the chart', tb.every((r) => r.name && r.type) && tb.find((r) => r.code === '1000').line === '1' && tb.find((r) => r.code === '4010').line === '');

    const eq = byType(tb);
    check('accounting equation at 2026-12-31 equals the fixture (assets, liabilities, equity, results)', eq.assets === X.equation.assets && eq.liabilities === X.equation.liabilities && eq.equity === X.equation.equity && eq.income - eq.expenses + eq.gains === X.equation.results && eq.assets - eq.liabilities === X.equation.netAssets, eq);

    const bad = [];
    X.monthEnds.forEach((d, i) => {
      const rows = NS.books.trialBalance(ws, oid, '2026-01-01', d);
      const t = byType(rows);
      const s = sum(rows.map((r) => r.end));
      const left = t.assets - t.liabilities;
      const right = t.equity + t.income - t.expenses + t.gains;
      if (s !== 0 || left !== right || t.other !== 0 || left !== X.lpCapital[i]) bad.push({ d, sum: s, left, right, want: X.lpCapital[i] });
    });
    check('at each of the twelve month-ends the trial balance sums to 0 (T1)', !bad.some((b) => b.sum !== 0), bad);
    check('at each of the twelve month-ends assets - liabilities = equity + income - expenses + gains (T2)', !bad.some((b) => b.left !== b.right), bad);
    check("at each month-end net assets equal the fixture's limited partners' capital", bad.length === 0, bad);
    check('balance(1000, 2026-12-31) is the cash of the fixture', NS.books.balance(ws, oid, '1000', '2026-12-31') === X.statements.cash);
  },

  /** A correction is an equal and opposite entry that names the one it reverses (T-11-03). */
  reverse: ({ check }) => {
    const NS = load();
    const { F, ws, oid } = fundA(NS);
    const X = F.expect;
    const fa2 = fx(F, 'bank:fa-2');
    const legal = fa2.lines[0][1];
    const id = idOf(ws, oid, 'bank:fa-2');
    const j = ws.books.funds[oid].journal;
    const original = J(j.find((e) => e.id === id));
    const r = NS.books.reverse(ws, oid, id, { by: 'Check Runner', at: '2027-01-20T11:00:00.000Z', date: '2026-03-12', memo: 'Entered twice' });
    check('the reversal is a new entry with the lines negated, rev naming the entry and src rev:<id>', J(r.lines) === J([['5100', -legal], ['1000', legal]]) && r.rev === id && r.src === 'rev:' + id && r.id === 'je-000024' && r.date === '2026-03-12' && r.memo === 'Entered twice' && r.by === 'Check Runner', r);
    check('the reversed entry is unchanged', J(j.find((e) => e.id === id)) === original);
    check('5100 at 2026-12-31 is 0', NS.books.balance(ws, oid, '5100', '2026-12-31') === 0, NS.books.balance(ws, oid, '5100', '2026-12-31'));
    check("cash at 2026-12-31 is the fixture's cash plus the legal fees (3,950,000)", NS.books.balance(ws, oid, '1000', '2026-12-31') === X.statements.cash + legal && X.statements.cash + legal === 3950000);
    check('the reversed entry is no longer live; the reversal is', NS.books.live(ws.books.funds[oid], 'bank:fa-2') === null && NS.books.live(ws.books.funds[oid], 'rev:' + id).id === r.id);
    const len = j.length;
    const again = NS.books.post(ws, oid, fa2, ACTOR);
    check('bank:fa-2 may then be posted again (a new entry; 5100 back to 750,000)', again.id !== id && j.length === len + 1 && NS.books.balance(ws, oid, '5100', '2026-12-31') === legal);
    const before = J(ws);
    const twice = thrown(() => NS.books.reverse(ws, oid, id, ACTOR));
    const ofRev = thrown(() => NS.books.reverse(ws, oid, r.id, ACTOR));
    const none = thrown(() => NS.books.reverse(ws, oid, 'je-999999', ACTOR));
    const early = thrown(() => NS.books.reverse(ws, oid, again.id, Object.assign({ date: '2026-03-01' }, ACTOR)));
    check('reversing the same entry twice throws', twice.length > 10, twice);
    check('a reversal cannot itself be reversed, an unknown entry cannot be reversed, and a reversal cannot predate its entry', ofRev.length > 10 && none.length > 10 && early.length > 10, { ofRev, none, early });
    check('nothing is stored by a refused reversal', J(ws) === before);
    const d = NS.books.reverse(ws, oid, again.id, ACTOR);
    check('without a date the reversal takes the date of the entry it reverses', d.date === fa2.date && /je-000025/.test(d.memo), d);
    check('the trial balance still sums to 0 and has no 5100 left', sum(NS.books.trialBalance(ws, oid, '2026-01-01', '2026-12-31').map((x) => x.end)) === 0 && NS.books.trialBalance(ws, oid, '2026-01-01', '2026-12-31').find((x) => x.code === '5100').end === 0);
  },

  /** FA-07: closing through a month-end stores the trial balance hash and the person; a closed period refuses posts (T-11-02). */
  closed: ({ check }) => {
    const NS = load();
    const { F, ws, oid } = fundA(NS);
    const fund = ws.books.funds[oid];
    const text = NS.books.trialBalance(ws, oid, fund.start, '2026-06-30').map((r) => `${r.code}|${r.end}`).join('\n');
    const rec = NS.books.close(ws, oid, '2026-06-30', { by: 'Owner Person', at: '2027-01-20T12:00:00.000Z' });
    check('tbText(through) is the code|end text of the trial balance from the start of the books', NS.books.tbText(ws, oid, '2026-06-30') === text, NS.books.tbText(ws, oid, '2026-06-30'));
    check('close stores tb = NS.audit.sha256 of that text, the person and the time', rec.through === '2026-06-30' && rec.tb === NS.audit.sha256(text) && /^[0-9a-f]{64}$/.test(rec.tb) && rec.by === 'Owner Person' && rec.at === '2027-01-20T12:00:00.000Z' && J(fund.closed[0]) === J(rec), rec);
    check('closedThrough is 2026-06-30 and status says so', NS.books.closedThrough(ws, oid) === '2026-06-30' && NS.books.status(ws, oid).closedThrough === '2026-06-30');
    const len = fund.journal.length;
    const before = J(fund.journal);
    const inJune = thrown(() => NS.books.post(ws, oid, { date: '2026-06-30', memo: 'late', src: 'man:late', lines: [['5100', 100], ['1000', -100]] }, ACTOR));
    check("a post dated 2026-06-30 throws 'closed' and the journal is unchanged", inJune === 'closed' && fund.journal.length === len && J(fund.journal) === before, inJune);
    const revOld = thrown(() => NS.books.reverse(ws, oid, idOf(ws, oid, 'bank:fa-2'), Object.assign({ date: '2026-07-15' }, ACTOR)));
    const julyEntry = NS.books.post(ws, oid, { date: '2026-07-01', memo: 'July', src: 'man:july', lines: [['5100', 100], ['1000', -100]] }, ACTOR);
    check('a post dated 2026-07-01 is stored', julyEntry.date === '2026-07-01' && fund.journal.length === len + 1);
    const revInto = thrown(() => NS.books.reverse(ws, oid, julyEntry.id, Object.assign({ date: '2026-06-30' }, ACTOR)));
    check('reversing an entry dated in the closed period throws, even dated later', revOld === 'closed', revOld);
    check('a reversal dated in the closed period throws', revInto.length > 0 && fund.journal.length === len + 1, revInto);
    const notEnd = thrown(() => NS.books.close(ws, oid, '2026-06-15', ACTOR));
    const earlier = thrown(() => NS.books.close(ws, oid, '2026-03-31', ACTOR));
    const same = thrown(() => NS.books.close(ws, oid, '2026-06-30', ACTOR));
    const nobody = thrown(() => NS.books.close(ws, oid, '2026-09-30', { at: ACTOR.at }));
    check('closing through 2026-06-15 (not a month-end) throws', notEnd.length > 10, notEnd);
    check('closing through 2026-03-31 (earlier) or 2026-06-30 again throws', earlier.length > 10 && same.length > 10, { earlier, same });
    check('closing without the person throws', nobody.length > 10 && fund.closed.length === 1, nobody);
    const noWhy = thrown(() => NS.books.reopen(ws, oid, { by: 'Owner Person', at: ACTOR.at }));
    const blankWhy = thrown(() => NS.books.reopen(ws, oid, { by: 'Owner Person', at: ACTOR.at, why: '   ' }));
    check('reopen without a reason throws and the period stays closed', noWhy.length > 10 && blankWhy.length > 10 && NS.books.closedThrough(ws, oid) === '2026-06-30' && !fund.closed[0].reopened, { noWhy, blankWhy });
    const back = NS.books.reopen(ws, oid, { by: 'Owner Person', at: '2027-01-20T13:00:00.000Z', why: 'A June invoice was missed' });
    check("reopen with a reason returns closedThrough to '' and keeps who, when and why", NS.books.closedThrough(ws, oid) === '' && back.through === '2026-06-30' && J(fund.closed[0].reopened) === J({ at: '2027-01-20T13:00:00.000Z', by: 'Owner Person', why: 'A June invoice was missed' }) && back.tb === rec.tb, fund.closed);
    check('after reopening a post dated 2026-06-30 is stored', NS.books.post(ws, oid, { date: '2026-06-30', memo: 'June invoice', src: 'man:late', lines: [['5100', 100], ['1000', -100]] }, ACTOR).date === '2026-06-30');
    const nothing = thrown(() => NS.books.reopen(ws, oid, { by: 'Owner Person', at: ACTOR.at, why: 'again' }));
    check('reopening books that are not closed throws', nothing.length > 10, nothing);
    // Two closings: reopening the later one returns closedThrough to the earlier.
    const q1 = NS.books.close(ws, oid, '2026-03-31', ACTOR);
    const q3 = NS.books.close(ws, oid, '2026-09-30', ACTOR);
    check('a later close is added after the earlier ones (newest last)', fund.closed.length === 3 && fund.closed[2].through === '2026-09-30' && q1.tb !== q3.tb);
    NS.books.reopen(ws, oid, { by: 'Owner Person', at: ACTOR.at, why: 'Q3 valuation revised' });
    check('reopening the later close returns closedThrough to the previous through', NS.books.closedThrough(ws, oid) === '2026-03-31' && !fund.closed[1].reopened && fund.closed[2].reopened.why === 'Q3 valuation revised');
    check('the June-30 hash now covers the June invoice: a different trial balance gives a different hash', NS.audit.sha256(NS.books.tbText(ws, oid, '2026-06-30')) !== rec.tb);
  },

  /** FA-11: the report builder's read calls; none of them changes the workspace. */
  reads: ({ check }) => {
    const NS = load();
    const { F, ws, oid } = fundA(NS);
    const X = F.expect;
    const before = J(ws);
    const inv = NS.books.entries(ws, oid, { account: '1100' });
    check('entries by account 1100: one row of 40,000,000 with holding fa-x', inv.length === 1 && inv[0].cents === X.statements.investmentsCost && inv[0].holding === 'fa-x' && inv[0].code === '1100' && inv[0].src === 'bank:fa-1' && inv[0].partner === '', inv);
    const b = NS.books.entries(ws, oid, { partner: 'FA-1002' });
    check("entries by partner FA-1002: the call line, the distribution line and the check's cash line", J(b.map((r) => [r.src, r.code, r.cents])) === J([['call:fa-call-1:FA-1002', '3000', -15000000], ['run:fa-run-1', '3100', 300000], ['run:fa-run-1', '1000', -300000]]), b);
    const fees = NS.books.entries(ws, oid, { src: 'fee:' });
    check("entries by src prefix 'fee:': twelve rows of 5000 and twelve of 2100", fees.length === 24 && fees.filter((r) => r.code === '5000').length === 12 && fees.filter((r) => r.code === '2100').length === 12);
    const all = NS.books.entries(ws, oid, {});
    const ordered = all.every((r, i) => i === 0 || all[i - 1].date < r.date || (all[i - 1].date === r.date && all[i - 1].id <= r.id));
    check('entries without a filter: one row per line (4 call + 24 fee + 4 distribution + 16 other = 48), by date then id, every row with id, date, memo, src, code, cents, partner, holding', all.length === 48 && ordered && J(Object.keys(all[0])) === J(['id', 'date', 'memo', 'src', 'code', 'cents', 'partner', 'holding']), all.length);
    const q2 = NS.books.entries(ws, oid, { from: '2026-04-01', to: '2026-06-30', account: ['1000', '4010'] });
    check('entries by period and a list of accounts', J(q2.map((r) => [r.date, r.code, r.cents])) === J([['2026-06-30', '1000', 1200000], ['2026-06-30', '4010', -1200000], ['2026-06-30', '1000', -450000]]), q2);
    check("balance(['1100','1150'], 2026-12-31, { holding: 'fa-x' }) is the investments at fair value (49,000,000)", NS.books.balance(ws, oid, ['1100', '1150'], '2026-12-31', { holding: 'fa-x' }) === X.statements.investmentsFV);
    check('balance of 3000 for FA-1001 at 2026-12-31 is its contribution', NS.books.balance(ws, oid, '3000', '2026-12-31', { partner: 'FA-1001' }) === -fx(F, 'call:fa-call-1:FA-1001').lines[0][1]);
    check('balance at 2026-09-29 leaves out the September valuation', NS.books.balance(ws, oid, '1150', '2026-09-29') === 0 && NS.books.balance(ws, oid, '1150', '2026-09-30') === fx(F, 'mark:fa-m1').lines[0][1]);
    const s = NS.books.series(ws, oid, ['4010'], '2026-01-01', '2026-12-31');
    check('series 4010 over 2026: twelve months, June -1,200,000, 0 elsewhere', s.length === 12 && J(s.map((x) => x.month)) === J(X.monthEnds.map((d) => d.slice(0, 7))) && s.every((x) => (x.month === '2026-06' ? x.cents === -X.statements.income : x.cents === 0)), s);
    const s5 = NS.books.series(ws, oid, ['5000', '5100'], '2026-02-15', '2026-04-10');
    check('series over part months: every month present, activity only inside the dates', J(s5) === J([{ month: '2026-02', cents: 150000 }, { month: '2026-03', cents: 900000 }, { month: '2026-04', cents: 0 }]), s5);
    const y = NS.books.trialBalance(ws, oid, '2027-01-01', '2027-12-31');
    const row = (c) => y.find((r) => r.code === c);
    check('2027: 4010, 5000, 5100 and 6100 are shown with begin 0', X.y2027.zeroBegin.every((c) => row(c) && row(c).begin === 0 && row(c).end === 0), y);
    check("2027: 3900 begins at 2026's results (-7,650,000)", row('3900') && row('3900').begin === X.y2027.begin3900 && X.y2027.begin3900 === -X.equation.results, row('3900'));
    check('2027: the ends sum to 0 and balance-sheet accounts carry their 2026 ends', sum(y.map((r) => r.end)) === 0 && row('1000').begin === X.statements.cash && row('1150').begin === X.tb.find((r) => r.code === '1150').end);
    check('no closing entry is stored for 2026', ws.books.funds[oid].journal.every((e) => e.lines.every((l) => l[0] !== '3900')));
    const st = NS.books.status(ws, oid);
    check('status: start, closedThrough, entries and exceptions', J(st) === J({ start: '', closedThrough: '', entries: 23, exceptions: 0 }), st);
    NS.books.tbText(ws, oid, '2026-12-31');
    NS.books.accounts(ws, oid);
    NS.books.closedThrough(ws, oid);
    check('none of the read calls changes JSON.stringify(ws)', J(ws) === before);
    const empty = { offerings: [{ id: 'o1', type: 'Private equity fund' }] };
    const e0 = J(empty);
    const reads = [NS.books.trialBalance(empty, 'o1', '2026-01-01', '2026-12-31').length, NS.books.entries(empty, 'o1', {}).length, NS.books.balance(empty, 'o1', '1000', '2026-12-31'), NS.books.series(empty, 'o1', ['1000'], '2026-01-01', '2026-03-31').length, NS.books.status(empty, 'o1').entries];
    check('on a workspace without books the reads give empty answers and create nothing', J(reads) === J([0, 0, 0, 3, 0]) && J(empty) === e0, reads);
  },

  /** The check's own rules: an unknown case name and an empty list each exit 1 with a FAIL line. */
  selfcheck: ({ check }) => {
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const a = run(['--case', 'no-such-case']);
    const b = run(['--case', '']);
    check('an unknown --case name exits 1 with a FAIL line', a.status === 1 && /^FAIL unknown case name: no-such-case/m.test(a.stdout) && /BOOKS CORE: FAIL \(cases run: 0\)/.test(a.stdout), a.stdout);
    check('an empty list exits 1 with a FAIL line', b.status === 1 && /^FAIL no cases to run/m.test(b.stdout) && /BOOKS CORE: FAIL \(cases run: 0\)/.test(b.stdout), b.stdout);
  }
};

L.runParts(cases, { name: 'BOOKS CORE', unit: 'cases', flag: '--case' });
