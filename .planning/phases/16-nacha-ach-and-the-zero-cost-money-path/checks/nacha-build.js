// gate: node
// last "NACHA BUILD: PASS (cases run: 11)"
// The NACHA builder's refusals, warnings and pre-notes (plan 16-05, no browser): every entry is in the file or left out
// with its reason, and every file the builder makes without a red check is read by the independent reader (lib16).
// Fixture files use only never-issued routing numbers (lib16 NEVER) and account numbers starting 99; a file's text is
// never printed, only labels, reasons and the reader's own scrubbed messages.
//   node nacha-build.js [--case sec,reader,modifier,sameday,offset,company,description,prenote,entries,levels,mobile]
// The check's dates are fixed through opts.now (the builder's clock): the file is created 2026-12-01 10:00 local time
// unless a scenario says otherwise.
// One PASS or FAIL line per check; the last line is "NACHA BUILD: PASS (cases run: N)" or
// "NACHA BUILD: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib16.js');

const NAME = 'NACHA BUILD';
const TODAY = '2026-12-01';
const NOW = new Date(2026, 11, 1, 10, 0);
const NEXT = '2026-12-02';
const MODIFIER_SENTENCE = 'The file ID modifier must be one capital letter A-Z or one digit 0-9.';
const OFFSET_ROUTING = 'Settlement account for the offsetting debit: the routing number fails the check digit';
const OFFSET_ACCOUNT = 'Settlement account for the offsetting debit: the account number is missing or longer than 17 characters';
const RESERVED = ['PAYROLL', 'PURCHASE', 'ACCTVERIFY', 'REVERSAL', 'RETURN FEE', 'RECLAIM', 'NONSETTLED', 'RETRY PYMT', 'AUTOENROLL', 'REDEPCHECK', 'HCCLAIMPMT'];
/** A routing number one digit off a never-issued one, so it fails the check digit. */
const BAD_ROUTING = '190000090';
const at = (y, m, d) => new Date(y, m - 1, d, 10, 0);
const sameDayLabel = (name, id, x, limit) => `${name} (${id}): ${x} is above the same-day limit of ${limit} for one payment, so it settles the next banking day`;

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
const OFFSET = () => ({ routing: L.NEVER.odfi, account: L.account(9), type: 'checking' });
/** A pre-note entry n: $0.00 to a never-issued bank. */
function prenote(n, over) {
  return credit(n, Object.assign({ kind: 'prenote', cents: 0 }, over || {}));
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
  ['A', 'Z', '0', '9'].forEach((m) => add(`modifier${m}`, opts({ entries: [credit(1)], modifier: m })));
  // same-day limits: $1,000,000.00 from 2022-03-18, $10,000,000.00 from 2027-09-17
  const big = [credit(1, { cents: 100000000 }), credit(2, { cents: 100000001 })];
  add('sameToday', opts({ entries: big, effectiveDate: TODAY }));
  add('sameNext', opts({ entries: big, effectiveDate: NEXT }));
  add('same20270916', opts({ entries: [credit(1, { cents: 150000000 })], effectiveDate: '2027-09-16', now: at(2027, 9, 16) }));
  add('same20270917', opts({ entries: [credit(1, { cents: 150000000 }), credit(2, { cents: 1000000000 }), credit(3, { cents: 1000000001 })], effectiveDate: '2027-09-17', now: at(2027, 9, 17) }));
  const three = () => [credit(1), credit(2, { accountType: 'savings' }), credit(3, { sec: 'CCD' })];
  add('offsetBadRouting', opts({ entries: three(), balanced: true, offset: { routing: '123', account: L.account(9), type: 'checking' } }));
  add('offsetNone', opts({ entries: three(), balanced: true }));
  add('offsetNoAccount', opts({ entries: three(), balanced: true, offset: { routing: L.NEVER.odfi, account: '', type: 'checking' } }));
  add('offsetValid', opts({ entries: three(), balanced: true, offset: OFFSET() }));
  add('companyId9', opts({ entries: [credit(1)], company: { name: 'CHECK FUND LLC', id: '199000000' } }));
  add('companyNoName', opts({ entries: [credit(1)], company: { name: '', id: '1990000001' } }));
  add('odfiBad', opts({ entries: [credit(1)], origin: Object.assign({}, opts().origin, { odfiRouting: BAD_ROUTING }) }));
  add('destinationBad', opts({ entries: [credit(1)], origin: Object.assign({}, opts().origin, { destinationRouting: BAD_ROUTING }) }));
  ['PAYROLL', 'purchase', 'ACCTVERIFY', 'DISTRIB'].forEach((d) => add(`desc${d}`, opts({ entries: [credit(1)], description: d })));
  add('prenotes', opts({ entries: [prenote(1, { accountType: 'checking' }), prenote(2, { accountType: 'savings' })] }));
  add('prenoteCents', opts({ entries: [prenote(1), prenote(2, { cents: 5 })] }));
  add('prenoteBalanced', opts({ entries: [prenote(1), prenote(2, { accountType: 'savings', sec: 'CCD' })], balanced: true, offset: OFFSET() }));
  add('mixed', opts({ entries: [credit(1), credit(2, { accountType: 'savings' }), credit(3, { sec: 'CCD' }), prenote(4), credit(5, { sec: '' })], balanced: true, offset: OFFSET() }));
  add('holidayToday', opts({ entries: [credit(1)], effectiveDate: '2026-12-25', now: at(2026, 12, 25) }));
  return S;
}

const isBlock = (c) => c.level === 'block' || !c.ok;
const sixes = (f) => f.lines.filter((l) => l[0] === '6');
const code = (l) => l.slice(1, 3);
const offsets = (f) => sixes(f).filter((l) => code(l) === '27' || code(l) === '37');
const labels = (f) => f.checks.map((c) => c.label);
const blocks = (f) => f.checks.filter((c) => c.level === 'block').map((c) => c.label);
const sameDay = (f) => f.checks.filter((c) => c.level === 'warn' && /same-day limit/.test(c.label)).map((c) => c.label);
const all94 = (f) => f.lines.every((l) => l.length === 94);

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

  // F-4 (AC-02): the file ID modifier is one capital letter or one digit; anything else is refused with one sentence.
  async modifier({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const S = scenarios(NS);
    ['A', 'Z', '0', '9'].forEach((m) => {
      const x = S[`modifier${m}`];
      check(`modifier '${m}' builds, at position 34 of the file header`, !!x && x.f.lines[0][33] === m, x ? x.f.lines[0][33] : 'build threw');
    });
    ['a', '', 'AA', '?'].forEach((m) => {
      let msg = '';
      try {
        NS.nacha.build(opts({ entries: [credit(1)], modifier: m }));
      } catch (e) {
        msg = String(e && e.message);
      }
      check(`modifier '${m}' is refused with "${MODIFIER_SENTENCE}"`, msg === MODIFIER_SENTENCE, msg || 'built');
    });
    const f = NS.nacha.build(opts({ entries: [credit(1)] }));
    check("no modifier given: 'A', as before", f.lines[0][33] === 'A', f.lines[0][33]);
  },

  // F-3 (AC-04): a same-day entry above that date's limit gets an amber warning; the limit is a dated table; nothing is split.
  async sameday({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const S = scenarios(NS);
    const T = NS.nacha.SAME_DAY_LIMITS;
    check('SAME_DAY_LIMITS is the frozen dated table (2022-03-18 $1,000,000.00; 2027-09-17 $10,000,000.00)', Array.isArray(T) && Object.isFrozen(T) && JSON.stringify(T) === JSON.stringify([{ from: '2022-03-18', cents: 100000000 }, { from: '2027-09-17', cents: 1000000000 }]), T);
    const a = S.sameToday.f;
    const want = sameDayLabel('Investor 2', 'INV-2', '$1,000,000.01', '$1,000,000.00');
    check('effective today: one warning, for the entry of $1,000,000.01 ($1,000,000.00 exactly does not warn)', JSON.stringify(sameDay(a)) === JSON.stringify([want]), sameDay(a));
    const ids = sixes(a).map((l) => l.slice(39, 54).trim());
    check('the file still holds that entry once, unsplit, at its full amount', ids.filter((x) => x === 'INV-2').length === 1 && ids.length === 2 && sixes(a).some((l) => l.slice(29, 39) === '0100000001'), ids);
    check('the warning is amber: ok true, warn true, level warn', a.checks.some((c) => c.label === want) && a.checks.filter((c) => c.label === want).every((c) => c.ok === true && c.warn === true && c.level === 'warn'));
    check('effective the next banking day: no same-day warning', sameDay(S.sameNext.f).length === 0, sameDay(S.sameNext.f));
    const b = S.same20270916.f;
    check('2027-09-16, effective that day: $1,500,000.00 warns (the limit is still $1,000,000.00)', JSON.stringify(sameDay(b)) === JSON.stringify([sameDayLabel('Investor 1', 'INV-1', '$1,500,000.00', '$1,000,000.00')]), sameDay(b));
    const c = S.same20270917.f;
    check('2027-09-17, effective that day: $1,500,000.00 and $10,000,000.00 exactly do not warn, $10,000,000.01 does', JSON.stringify(sameDay(c)) === JSON.stringify([sameDayLabel('Investor 3', 'INV-3', '$10,000,000.01', '$10,000,000.00')]), sameDay(c));
  },

  // F-5 (AC-05): a balanced file's settlement account is checked; a bad one is a red check and no offset record is written.
  async offset({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const S = scenarios(NS);
    [
      ['offsetBadRouting', "offset routing '123'", OFFSET_ROUTING],
      ['offsetNone', 'no settlement account given', OFFSET_ROUTING],
      ['offsetNoAccount', 'no settlement account number', OFFSET_ACCOUNT]
    ].forEach(([k, what, label]) => {
      const f = S[k].f;
      check(`balanced, ${what}: the red check "${label}"`, blocks(f).indexOf(label) >= 0 && (f.blocked || []).some((c) => c.label === label), labels(f));
      check(`balanced, ${what}: no offset entry, every record 94 characters`, offsets(f).length === 0 && all94(f), `${offsets(f).length} offsets; lengths ${[...new Set(f.lines.map((l) => l.length))].join(',')}`);
    });
    const v = S.offsetValid.f;
    check('balanced with a valid settlement account: one offset entry per batch (27), debit equals credit, no red check', offsets(v).length === 2 && offsets(v).every((l) => code(l) === '27') && v.totals.debit === v.totals.credit && blocks(v).length === 0, { offsets: offsets(v).length, red: blocks(v) });
    const r = L.validate(v.text);
    check('balanced with a valid settlement account: the independent reader passes it', r.ok, r.out);
  },

  // F-9 (AC-05) and the bank routing numbers: a company ID that is not 10 characters, an empty company name, a bad
  // originating or destination routing number are each a red check; records stay 94 characters.
  async company({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const S = scenarios(NS);
    [
      ['companyId9', 'a 9-character company ID', 'Company ID must be exactly 10 characters'],
      ['companyNoName', 'an empty company name', 'Company name is missing'],
      ['odfiBad', 'an originating bank routing number failing the check digit', 'Originating bank routing number fails the check digit'],
      ['destinationBad', 'an immediate destination failing the check digit', 'Immediate destination routing number fails the check digit']
    ].forEach(([k, what, label]) => {
      const f = S[k].f;
      check(`${what}: the red check "${label}"`, blocks(f).indexOf(label) >= 0, labels(f));
      check(`${what}: every record 94 characters`, all94(f));
    });
    const good = S.modifierA.f;
    check('a good company and bank: no red check', blocks(good).length === 0 && good.checks.every((c) => c.ok), labels(good));
  },

  // F-11 (AC-05): the entry descriptions the ACH rules reserve for other payments are refused, naming the word.
  async description({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const S = scenarios(NS);
    const R = NS.nacha.RESERVED_DESCRIPTIONS;
    check('RESERVED_DESCRIPTIONS holds the 11 words of 16-RESEARCH F-11, frozen', Array.isArray(R) && Object.isFrozen(R) && JSON.stringify(R) === JSON.stringify(RESERVED), R);
    [['PAYROLL', 'PAYROLL'], ['purchase', 'PURCHASE'], ['ACCTVERIFY', 'ACCTVERIFY']].forEach(([d, word]) => {
      const label = `Entry description "${word}" is reserved by the ACH rules for other payments; use another word`;
      check(`description '${d}': the red check naming ${word}`, blocks(S[`desc${d}`].f).indexOf(label) >= 0, labels(S[`desc${d}`].f));
    });
    check("description 'DISTRIB': no description check, no red check", !labels(S.descDISTRIB.f).some((l) => /^Entry description/.test(l)) && blocks(S.descDISTRIB.f).length === 0 && S.descDISTRIB.f.checks.every((c) => c.ok), labels(S.descDISTRIB.f));
  },

  // F-10 (AC-07): pre-notes at $0.00 with codes 23 and 33; a pre-note with an amount is left out; no offset for pre-notes only.
  async prenote({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const S = scenarios(NS);
    const p = S.prenotes.f;
    check('two pre-notes (checking, savings): codes 23 and 33, amount 0', sixes(p).map(code).join(',') === '23,33' && sixes(p).every((l) => l.slice(29, 39) === '0000000000'), sixes(p).map(code));
    check('result.entries marks them kind prenote', Array.isArray(p.entries) && p.entries.map((e) => e.kind).join(',') === 'prenote,prenote', p.entries && p.entries.map((e) => e.kind));
    check('the pre-note file has no red check', blocks(p).length === 0 && p.checks.every((c) => c.ok), labels(p));
    const v = L.validate(p.text);
    check('the pre-note file passes the independent reader', v.ok, v.out);
    const c = S.prenoteCents.f;
    const why = c.excluded.map((x) => `${x.entry.id}: ${x.reason}`);
    check("a pre-note of 5 cents is left out with 'A pre-note is for $0.00'; the other is in the file", why.join('|') === 'INV-2: A pre-note is for $0.00' && sixes(c).length === 1, why);
    const b = S.prenoteBalanced.f;
    check('a balanced pre-note-only file: no offset entry, debit 0, no red check', offsets(b).length === 0 && b.totals.debit === 0 && blocks(b).length === 0 && b.checks.every((x) => x.ok), { offsets: offsets(b).length, checks: labels(b) });
    const vb = L.validate(b.text);
    check('the balanced pre-note-only file passes the independent reader', vb.ok, vb.out);
    const z = NS.nacha.build(opts({ entries: [credit(1, { cents: 0 })] }));
    check("a credit of zero is still left out with 'Amount is zero'", z.excluded.map((x) => x.reason).join('|') === 'Amount is zero', z.excluded.map((x) => x.reason));
  },

  // result.entries: each entry in file order with its id, the caller's ref, trace, cents, code, kind, SEC and batch.
  async entries({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const f = scenarios(NS).mixed.f;
    const E = f.entries || [];
    const file = sixes(f).filter((l) => ['27', '37'].indexOf(code(l)) < 0);
    check("result.entries' traces equal the file's entry traces, in order", E.length === file.length && E.every((e, i) => e.trace === file[i].slice(79, 94)), E.map((e) => e.id));
    check('each ref is passed through (REQ-1, REQ-2, REQ-4, then the CCD batch REQ-3)', E.map((e) => e.ref).join(',') === 'REQ-1,REQ-2,REQ-4,REQ-3', E.map((e) => e.ref));
    check('codes, kinds, SEC and batch as written (22, 32, 23 in batch 1 PPD; 22 in batch 2 CCD)', E.map((e) => `${e.code}/${e.kind}/${e.sec}/${e.batch}`).join(',') === '22/credit/PPD/1,32/credit/PPD/1,23/prenote/PPD/1,22/credit/CCD/2', E.map((e) => `${e.code}/${e.kind}/${e.sec}/${e.batch}`));
    check('cents and ids as given', E.map((e) => `${e.id}:${e.cents}`).join(',') === 'INV-1:10000,INV-2:20000,INV-4:0,INV-3:30000', E.map((e) => `${e.id}:${e.cents}`));
    check('no offset entry listed, though the file has two', offsets(f).length === 2 && !E.some((e) => ['27', '37'].indexOf(e.code) >= 0 || e.id === 'OFFSET'), offsets(f).length);
    check('the entry with no SEC type is left out with its reason, not listed', f.excluded.map((x) => `${x.entry.id}: ${x.reason}`).join('|') === 'INV-5: No SEC type' && !E.some((e) => e.id === 'INV-5'), f.excluded.map((x) => x.reason));
  },

  // Every check carries a level; ok is false exactly for 'block', warn is true exactly for 'warn'; blocked lists the red ones.
  async levels({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const S = scenarios(NS);
    let n = 0;
    Object.keys(S).forEach((k) => {
      const f = S[k].f;
      const wrong = f.checks.filter((c) => ['block', 'warn', 'ok'].indexOf(c.level) < 0 || c.ok !== (c.level !== 'block') || c.warn !== (c.level === 'warn')).map((c) => `${c.label} [${c.level}/${c.ok}/${c.warn}]`);
      n += f.checks.length;
      check(`${k}: every check has level block, warn or ok; ok false exactly for block; warn true exactly for warn`, wrong.length === 0, wrong);
      check(`${k}: result.blocked is the block checks`, Array.isArray(f.blocked) && JSON.stringify(f.blocked.map((c) => c.label)) === JSON.stringify(blocks(f)), f.blocked && f.blocked.length);
    });
    const h = S.holidayToday.f.checks.find((c) => /^Effective date/.test(c.label));
    check('an effective date of today that is a holiday is red (block), not amber', !!h && h.level === 'block' && h.ok === false && h.warn === false, h);
    check(`checks judged: ${n}`, n > 0);
  },

  // F-18: the mobile copy is the generated copy of the web file.
  async mobile({ check }) {
    const src = fs.readFileSync(path.join(L.ROOT, 'mobile/scripts/sync-core.js'), 'utf8');
    const header = ((src.match(/const header = `([^`]*)`;/) || [])[1] || '').replace(/\$\{f\}/g, 'nacha.js').replace(/\\n/g, '\n');
    const want = header + fs.readFileSync(path.join(L.ROOT, 'assets/js/nacha.js'), 'utf8');
    const have = fs.readFileSync(path.join(L.ROOT, 'mobile/src/core/nacha.js'), 'utf8');
    check('sync-core.js names its header line', /^\/\* Generated by scripts\/sync-core\.js from assets\/js\/nacha\.js\./.test(header), header);
    check('mobile/src/core/nacha.js equals the sync-core header line plus assets/js/nacha.js', have === want, `${have.length} vs ${want.length} characters`);
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
