// gate: node
// last "BUSINESS DAYS: PASS (cases run: 3)"
// NS.ops.businessDays(s, n) counts n Monday-to-Friday days from s: later for n > 0, earlier for n < 0, s itself for
// n = 0 (no holidays). Before plan 11-18 a negative n returned s unchanged, so every seeded sample capital call was
// noticed on the day it was due (11-CONTEXT "After 11-05, 11-06, 11-08" and the wave 4 note); this check is the RED of
// plan 11-18. No browser; the portal is loaded inside each case with load11.js (edition 'diy' unless the case says
// otherwise), today 2026-11-19.
//   node business-days.js [--case back,sweep,seeded]
// Cases: back (five hand-worked counts back), sweep (every day 2019 to 2027 against an oracle written here, for n 1 to
// 15, -1 to -15 and 0), seeded (the nine seeded sample calls of the two firms that have calls, in both editions: their
// notice dates, the open call, and the 'Capital call issued' rows of each firm's change log).
// One PASS or FAIL line per check; the last line is "BUSINESS DAYS: PASS (cases run: N)" or
// "BUSINESS DAYS: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal, sampleWorkspaces } = require('./load11.js');

const TODAY = '2026-11-19';

/** This check's own count (never the code under test): one UTC calendar day at a time toward n's sign. */
function oracle(s, n) {
  let t = Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  const step = n > 0 ? 1 : -1;
  for (let k = 0; k < Math.abs(n); ) {
    t += step * 864e5;
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) k++;
  }
  return new Date(t).toISOString().slice(0, 10);
}
/** Every ISO day from a to b, inclusive. */
function daysFrom(a, b) {
  const out = [];
  for (let t = Date.parse(a + 'T00:00:00Z'); t <= Date.parse(b + 'T00:00:00Z'); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
const tryRun = (fn) => {
  try {
    return fn();
  } catch (e) {
    return `threw ${String((e && e.message) || e)}`;
  }
};

// The seeded calls after the fix (11-18-PLAN interfaces block): id, due, notice ten business days before due.
const SEEDED = {
  'kestrel-bay': [
    ['kb-fund-ii-call-1', '2019-09-30', '2019-09-16'],
    ['kb-fund-ii-call-2', '2020-03-31', '2020-03-17'],
    ['kb-fund-ii-call-3', '2020-10-15', '2020-10-01'],
    ['kb-fund-ii-call-4', '2021-06-30', '2021-06-16'],
    ['kb-fund-ii-call-5', '2022-03-31', '2022-03-17']
  ],
  pellbrook: [
    ['pb-ventures-i-call-1', '2023-03-31', '2023-03-17'],
    ['pb-ventures-i-call-2', '2023-10-02', '2023-09-18'],
    ['pb-ventures-i-call-3', '2024-06-28', '2024-06-14'],
    ['pb-ventures-i-call-4', '2025-04-15', '2025-04-01']
  ]
};

const cases = {
  /** Five counts back worked by hand. */
  back: ({ check }) => {
    const NS = loadPortal(undefined, { today: TODAY, edition: 'diy' });
    const bd = NS.ops.businessDays;
    [
      ['2026-03-16', -10, '2026-03-02', 'two weeks back, across two weekends'],
      ['2026-03-16', -1, '2026-03-13', 'Monday to Friday, across a weekend'],
      ['2026-04-01', -3, '2026-03-27', 'across a month end and a weekend'],
      ['2026-01-05', -2, '2026-01-01', 'across a year end; no holidays, the same count as audit.js weekdayBack and books-bank.js businessBack'],
      ['2026-03-15', -1, '2026-03-13', 'from a Sunday']
    ].forEach(([s, n, want, why]) => {
      const got = tryRun(() => bd(s, n));
      check(`businessDays('${s}', ${n}) is '${want}' (${why})`, got === want, `got ${got}`);
    });
  },

  /** Every day of 2019 to 2027 against the oracle: forward (unchanged by the fix), back, zero. */
  sweep: ({ check }) => {
    const NS = loadPortal(undefined, { today: TODAY, edition: 'diy' });
    const bd = NS.ops.businessDays;
    const all = daysFrom('2019-01-01', '2027-12-31');
    const run = (ns) => {
      const bad = [];
      let n = 0;
      all.forEach((s) =>
        ns.forEach((k) => {
          n++;
          const got = tryRun(() => bd(s, k));
          const want = oracle(s, k);
          if (got !== want && bad.length < 5) bad.push(`(${s}, ${k}) gave ${got}, expected ${want}`);
          else if (got !== want) bad.push('');
        })
      );
      return { n, bad };
    };
    const range = (a, b) => Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => a + (b > a ? i : -i));
    const f = run(range(1, 15));
    check(`forward: n 1 to 15 gives the oracle's day (${all.length} days, ${f.n} counts)`, all.length === 3287 && !f.bad.length, `${f.bad.length} mismatches; first: ${f.bad.filter(Boolean).join('; ')}`);
    const b = run(range(-1, -15));
    check(`back: n -1 to -15 gives the oracle's day (${all.length} days, ${b.n} counts)`, all.length === 3287 && !b.bad.length, `${b.bad.length} mismatches; first: ${b.bad.filter(Boolean).join('; ')}`);
    const z = run([0]);
    check(`zero: n 0 gives the day itself (${all.length} days)`, all.length === 3287 && !z.bad.length && all.every((s) => oracle(s, 0) === s), `${z.bad.length} mismatches; first: ${z.bad.filter(Boolean).join('; ')}`);
  },

  /** The seeded sample calls and their change-log rows, both editions. */
  seeded: ({ check }) => {
    ['diy', 'managed'].forEach((ed) => {
      const NS = loadPortal(undefined, { today: TODAY, edition: ed });
      const wss = sampleWorkspaces(NS);
      check(`${ed}: the four sample firms are seeded (${wss.map((w) => w.tenant.id).join(', ')})`, wss.length === 4, wss.map((w) => w.tenant.id));
      wss.forEach((ws) => {
        const firm = ws.tenant.id;
        const want = SEEDED[firm] || [];
        const done = (ws.calls || []).filter((c) => c.status === 'complete');
        check(
          `${ed} ${firm}: the calls with status complete are ${want.length ? want.map((w) => w[0]).join(', ') : 'none'}, with their due dates`,
          JSON.stringify(done.map((c) => [c.id, c.due])) === JSON.stringify(want.map((w) => [w[0], w[1]])),
          done.map((c) => [c.id, c.due])
        );
        want.forEach(([id, due, notice]) => {
          const c = done.find((x) => x.id === id);
          const got = c ? c.noticeDate : '(no such call)';
          check(`${ed} ${firm}: ${id} (due ${due}) is noticed ${notice}, ten business days before it is due`, got === notice && notice === oracle(due, -10) && got < due, `notice ${got}`);
        });
        if (firm === 'pellbrook') {
          const c5 = (ws.calls || []).find((x) => x.id === 'pb-ventures-i-call-5');
          check(`${ed} ${firm}: pb-ventures-i-call-5 stays open, noticed 2026-10-28 and due 2026-11-12`, !!c5 && c5.status === 'open' && c5.noticeDate === '2026-10-28' && c5.due === '2026-11-12', c5 && [c5.status, c5.noticeDate, c5.due]);
        }
        const log = NS.audit.ensureLog(ws);
        want.forEach(([id, , notice]) => {
          const rows = log.filter((e) => e.action === 'Capital call issued' && e.record === id);
          check(`${ed} ${firm}: the change log's one 'Capital call issued' row for ${id} is dated ${notice}`, rows.length === 1 && rows[0].at.slice(0, 10) === notice, rows.map((e) => e.at));
        });
        const v = NS.audit.verify(ws);
        check(`${ed} ${firm}: NS.audit.verify of the change log is ok (${v.count} entries)`, v.ok === true, v);
      });
    });
  }
};

L.runParts(cases, { name: 'BUSINESS DAYS', unit: 'cases', flag: '--case' });
