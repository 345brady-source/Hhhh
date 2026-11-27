// gate: node
// last "NACHA BUILD: PASS (cases run: 2)"
// The NACHA builder's refusals, warnings and pre-notes (plan 16-05, no browser): every entry is in the file or left out
// with its reason, and every file the builder makes without a red check is read by the independent reader (lib16).
// Fixture files use only never-issued routing numbers (lib16 NEVER) and account numbers starting 99; a file's text is
// never printed, only labels, reasons and the reader's own scrubbed messages.
//   node nacha-build.js [--case sec,reader]
// One PASS or FAIL line per check; the last line is "NACHA BUILD: PASS (cases run: N)" or
// "NACHA BUILD: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('./lib16.js');

const NAME = 'NACHA BUILD';
const TODAY = '2026-12-01';
const NOW = new Date(2026, 11, 1, 10, 0);
const NEXT = '2026-12-02';

/** The builder's options for a small file; over replaces any field. */
function opts(over) {
  return Object.assign(
    {
      origin: { destinationRouting: L.NEVER.odfi, destinationName: 'CHECK ORIGIN BANK', immediateOrigin: '1990000001', originName: 'CHECK FUND LLC', odfiRouting: L.NEVER.odfi },
      company: { name: 'CHECK FUND LLC', id: '1990000001' },
      entries: [],
      effectiveDate: NEXT,
      description: 'DISTRIB',
      now: NOW
    },
    over || {}
  );
}
/** A credit entry n (1..) to a never-issued bank. */
function credit(n, over) {
  return Object.assign({ name: `Investor ${n}`, id: `INV-${n}`, routing: L.NEVER.rdfi[(n - 1) % 3], account: L.account(n), accountType: 'checking', cents: 10000 * n, sec: 'PPD', ref: `REQ-${n}` }, over || {});
}

/** Every scenario the cases build, by name: { o: the options, f: the result }. A scenario whose build throws is left out here. */
function scenarios(NS) {
  const S = {
    fixture: { o: null, f: L.achFile(NS, { effectiveDate: NEXT, now: NOW }) },
    fixtureBalanced: { o: null, f: L.achFile(NS, { effectiveDate: NEXT, now: NOW, balanced: true }) },
    fixtureSameDay: { o: null, f: L.achFile(NS, { effectiveDate: TODAY, now: NOW }) }
  };
  const add = (name, o) => {
    try {
      S[name] = { o, f: NS.nacha.build(o) };
    } catch (e) {
      // a scenario that throws is judged by its own case
    }
  };
  add('sec', opts({ entries: [credit(1), credit(2, { sec: undefined }), credit(3, { sec: 'WEB' }), credit(4, { sec: 'CCD' })] }));
  return S;
}

const isBlock = (c) => c.level === 'block' || !c.ok;
const sixes = (f) => f.lines.filter((l) => l[0] === '6');

const parts = {
  // F-2 (AC-03): an entry with no SEC type or one these payments do not use is left out with its reason; nothing vanishes.
  async sec({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const { o, f } = scenarios(NS).sec;
    const inFile = sixes(f).map((l) => l.slice(39, 54).trim());
    check('the two PPD/CCD entries are in the file (INV-1, INV-4)', inFile.join(',') === 'INV-1,INV-4', inFile);
    const why = f.excluded.map((x) => `${x.entry.id}: ${x.reason}`);
    check('the entry with no SEC type is left out with "No SEC type"', why.indexOf('INV-2: No SEC type') >= 0, why);
    check('the WEB entry is left out with "SEC type WEB is not one these payments use"', why.indexOf('INV-3: SEC type WEB is not one these payments use') >= 0, why);
    check('every entry given is either in the file or left out (4 = 2 + 2)', inFile.length + f.excluded.length === o.entries.length, `${inFile.length} + ${f.excluded.length}`);
    const tot = f.checks.find((c) => /^Batch and file totals/.test(c.label));
    check('the totals check is ok', !!tot && tot.ok === true, tot);
    check('result.entries lists the two entries with their refs (REQ-1, REQ-4)', Array.isArray(f.entries) && f.entries.map((e) => e.ref).join(',') === 'REQ-1,REQ-4', f.entries && f.entries.map((e) => e.ref));
  },

  // Every file built has 94-character records only; every file with no red check passes the independent reader.
  async reader({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const S = scenarios(NS);
    let read = 0;
    Object.keys(S).forEach((k) => {
      const f = S[k].f;
      const bad = f.lines.filter((l) => l.length !== 94).map((l) => l.length);
      check(`${k}: every record is 94 characters`, bad.length === 0, bad);
      const red = f.checks.filter(isBlock).map((c) => c.label);
      if (red.length) return;
      const v = L.validate(f.text);
      read += 1;
      check(`${k}: no red check, and the independent reader passes it`, v.ok, v.out);
    });
    check('at least one file was read by the independent reader', read > 0, read);
  }
};

L.runParts(parts, { name: NAME, unit: 'cases', flag: '--case' });
