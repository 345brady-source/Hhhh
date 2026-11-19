// gate: node
// last "BLUESKY MATH: PASS (cases run: 4)"
// Pure checks for plan 09-07 (no browser): the state table (assets/js/bluesky-data.js) and NS.bluesky (assets/js/bluesky.js)
// with data.js, eligibility.js and filings.js in one sandbox, the way the browser loads them (window.CVPortal).
//   table    the table's codes are the 52 of the pinned SEC schema; every row has a name; the rule holds for every row
//            (a confirmed row has a source and the date it was read, and a fee or "no notice required"; an unconfirmed
//            row holds no fee, deadline or renewal); as shipped, every row is unconfirmed and holds no amount
//   pick     the states ticked are exactly the states of the offering's sales (09-01's one list: an approved, unfunded
//            subscription counts); an investor abroad or with no state on file adds none
//   fees     an amount only from a confirmed row with its source and date (fixed, tiered on the amount offered or sold in
//            the state, percent with its minimum and maximum); no line for a state needing no notice; the filing system's
//            fee as its own line; open while any line has no amount; the amount due through orderLines
//   package  the issuer, the latest accession number, each state's first sale, amount sold and investors, the admin's
//            contact, and no investor's name or address
//   node bluesky-math.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "BLUESKY MATH: PASS (cases run: N)" or
// "BLUESKY MATH: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by gate9.sh.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const SRC = (f) => fs.readFileSync(path.join(L.ROOT, f), 'utf8');
/** A fresh sandbox with the five scripts. Called inside each case, so a missing module prints a FAIL line, not a stack trace. */
function load(more) {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window });
  ['assets/js/data.js', 'assets/js/eligibility.js'].forEach((f) => vm.runInContext(SRC(f), ctx, { filename: f }));
  Object.assign(window.CVPortal, more || {});
  ['assets/js/filings.js', 'assets/js/bluesky-data.js', 'assets/js/bluesky.js'].forEach((f) => vm.runInContext(SRC(f), ctx, { filename: f }));
  const NS = window.CVPortal;
  if (!NS.blueskyData || !NS.bluesky) throw new Error('bluesky-data.js or bluesky.js did not set NS.blueskyData and NS.bluesky');
  return NS;
}
/** The 52 jurisdictions of the SEC schema's states-of-solicitation list (the pinned file of plan 09-02). */
const SCHEMA_CODES = () => (SRC('server/test/fixtures/formd/schema/statesOfSolicitationCodes.xsd.xml').match(/enumeration value="([A-Z0-9]{2})"/g) || []).map((x) => x.slice(-3, -1));

/* ---------- Sample data ---------- */
const J = (x) => JSON.stringify(x);
const copy = (x) => JSON.parse(J(x));
const off = (id, exemption, more) => Object.assign({ id, name: `Fund ${id}`, minimum: 50000, structure: { exemption } }, more || {});
const inv = (id, address, more) => Object.assign({ id, title: `Investor ${id}`, address, positions: [] }, more || {});
const sub = (id, investorId, offeringId, status, cents, decided) => ({ id, type: 'subscription', investorId, offeringId, status, cents, decided, submitted: decided });
/** A countersigned subscription: the request is accepted and the holding refers to it (counted once). */
function accept(ws, r) {
  r.status = 'accepted';
  ws.investors.find((i) => i.id === r.investorId).positions.push({ offeringId: r.offeringId, amount: 0, commitment: r.cents / 100, date: r.decided, ref: r.id });
  return r;
}
/**
 * One Rule 506(b) offering: two accepted investors in New York, one in California, an approved but unfunded subscription
 * in Texas, an investor abroad, an investor with no address on file, a declined subscription in Florida and a pending one
 * in Washington.
 */
function sample() {
  const ws = {
    tenant: { id: 't1', shortName: 'Sample', support: { email: 'admin@sample.test', phone: '555 0100' } },
    team: [{ id: 'tm1', name: 'Ann Admin', email: 'ann@sample.test', role: 'admin', current: true, status: 'active' }, { id: 'tm2', name: 'Tom Team', email: 'tom@sample.test', role: 'team', status: 'active' }],
    offerings: [off('o1', 'Rule 506(b)', { hardCap: 0, structure: { exemption: 'Rule 506(b)', hardCap: 2000000 } })],
    investors: [
      inv('a', '1 Elm St, Albany, NY 12207'),
      inv('b', '2 Oak Ave, Buffalo, NY 14201'),
      inv('c', '9 Bay St, Fresno, CA 93701'),
      inv('t', '5 Lamar Blvd, Austin, TX 78701'),
      inv('d', '4 Rue de la Paix, Paris, 75002, France', { country: 'France' }),
      inv('u', ''),
      inv('f', '7 Palm Way, Miami, FL 33101'),
      inv('w', '3 Pike St, Seattle, WA 98101')
    ],
    requests: []
  };
  ws.requests.push(accept(ws, sub('r1', 'a', 'o1', 'approved', 10000000, '2026-10-09')));
  ws.requests.push(accept(ws, sub('r2', 'b', 'o1', 'approved', 5000000, '2026-10-03')));
  ws.requests.push(accept(ws, sub('r3', 'c', 'o1', 'approved', 7500000, '2026-10-06')));
  ws.requests.push(sub('r4', 't', 'o1', 'approved', 2500000, '2026-10-12'));
  ws.requests.push(accept(ws, sub('r5', 'd', 'o1', 'approved', 5000000, '2026-10-02')));
  ws.requests.push(accept(ws, sub('r6', 'u', 'o1', 'approved', 5000000, '2026-10-04')));
  ws.requests.push(sub('r7', 'f', 'o1', 'declined', 5000000, '2026-10-05'));
  ws.requests.push(sub('r8', 'w', 'o1', 'pending', 5000000, ''));
  return ws;
}

const cases = {
  table({ check }) {
    const NS = load();
    const D = NS.blueskyData;
    const B = NS.bluesky;
    const codes = SCHEMA_CODES();
    const keys = Object.keys(D.table || {});
    check('the pinned schema file lists 52 jurisdictions', codes.length === 52 && new Set(codes).size === 52, codes.length);
    check('the table has one row for each of them, and no other', keys.length === 52 && J(keys.slice().sort()) === J(codes.slice().sort()), keys.filter((k) => codes.indexOf(k) < 0).concat(codes.filter((c) => keys.indexOf(c) < 0)));
    check('every row carries its own code and a name, the name the Filings tab uses', keys.every((k) => D.table[k].code === k && typeof D.table[k].name === 'string' && D.table[k].name.length > 1 && D.table[k].name === NS.filings.stateName(k)), keys.filter((k) => D.table[k].name !== NS.filings.stateName(k)));
    check('the rule holds for the shipped table (no problem reported)', typeof B.problems === 'function' && J(B.problems(D)) === '[]', typeof B.problems === 'function' ? B.problems(D) : 'no problems()');
    check('as shipped, every row is unconfirmed and holds no fee, deadline, renewal, source or date', keys.every((k) => { const r = D.table[k]; return r.confirmed === false && r.fee === null && r.days === null && r.renewal === null && r.noticeRequired === null && r.source === '' && r.readOn === ''; }), keys.filter((k) => D.table[k].confirmed !== false || D.table[k].fee !== null));
    check('as shipped, the filing system\'s fee is unconfirmed and has no amount; the table has no as-of date', D.systemFee && D.systemFee.confirmed === false && D.systemFee.cents === null && D.systemFee.source === '' && D.asOf === '', D.systemFee);
    // The rule, broken one way at a time on a copy.
    const broken = (fn) => {
      const d = copy(D);
      fn(d);
      return B.problems(d);
    };
    const fee = { kind: 'fixed', cents: 30000 };
    const p1 = broken((d) => Object.assign(d.table.NY, { confirmed: true, fee, readOn: '2026-11-01' }));
    const p2 = broken((d) => Object.assign(d.table.NY, { confirmed: true, fee, source: 'test row, invented' }));
    const p3 = broken((d) => Object.assign(d.table.NY, { confirmed: true, source: 'test row, invented', readOn: '2026-11-01' }));
    const p4 = broken((d) => Object.assign(d.table.NY, { fee }));
    const p5 = broken((d) => Object.assign(d.table.NY, { days: 15 }));
    const p6 = broken((d) => Object.assign(d.table.NY, { renewal: { months: 12 } }));
    const p7 = broken((d) => Object.assign(d.systemFee, { cents: 16000 }));
    const p8 = broken((d) => Object.assign(d.table.NY, { confirmed: true, fee: { kind: 'fixed', cents: 300.5 }, source: 'test row, invented', readOn: '2026-11-01' }));
    const p9 = broken((d) => Object.assign(d.table.NY, { confirmed: true, fee, source: 'test row, invented', readOn: 'last week' }));
    const named = (p) => p.length > 0 && p.every((x) => /NY|system/i.test(x));
    check('a row made confirmed with no source fails the rule', named(p1), p1);
    check('a row made confirmed with no date read fails it', named(p2), p2);
    check('a confirmed row with neither a fee nor "no notice required" fails it', named(p3), p3);
    check('an unconfirmed row holding a fee, a deadline or a renewal fails it', named(p4) && named(p5) && named(p6), [p4, p5, p6]);
    check('an unconfirmed filing system fee holding an amount fails it', named(p7), p7);
    check('a fee that is not whole cents, and a date read that is not a date, fail it', named(p8) && named(p9), [p8, p9]);
    const ok = broken((d) => Object.assign(d.table.NY, { confirmed: true, fee, source: 'test row, invented', readOn: '2026-11-01', days: 15 }));
    const none = broken((d) => Object.assign(d.table.FL, { confirmed: true, noticeRequired: false, source: 'test row, invented', readOn: '2026-11-01' }));
    check('a confirmed row with its source, date and fee passes; so does one saying no notice is required', J(ok) === '[]' && J(none) === '[]', [ok, none]);
    const text = SRC('assets/js/bluesky-data.js') + SRC('assets/js/bluesky.js');
    check('the table is a script: neither file fetches anything', !/\bfetch\s*\(|XMLHttpRequest|import\s*\(/.test(text));
    check('no vendor name or forbidden word in either file\'s text a sponsor could see', L.leakCheck(text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).ok, L.leakCheck(text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')));
  },

  pick({ check }) {
    const NS = load();
    const ws = sample();
    const f = NS.filings.facts(ws, ws.offerings[0]);
    const p = NS.bluesky.pick(f);
    check('the states ticked are New York, California and Texas (an approved, unfunded subscription counts)', J(p) === '["CA","NY","TX"]', p);
    check('pick is exactly the states of facts.byState, sorted', J(p) === J(Object.keys(f.byState).sort()), { pick: p, byState: Object.keys(f.byState) });
    check('the investor abroad, the investor with no address, the declined and the pending subscriptions add no state', p.indexOf('FL') < 0 && p.indexOf('WA') < 0 && f.outsideUS.investors === 1 && f.unplaced.investors === 1, { outsideUS: f.outsideUS, unplaced: f.unplaced });
    check('pick reads facts.byState and nothing else (a facts object with only byState)', J(NS.bluesky.pick({ byState: { WA: { firstSale: '2026-01-02', sold: 1, investors: 1 }, AZ: { firstSale: '2026-01-01', sold: 1, investors: 1 } } })) === '["AZ","WA"]');
    check('no sale, no state', J(NS.bluesky.pick({ byState: {} })) === '[]' && J(NS.bluesky.pick(null)) === '[]');
  },

  fees({ check }) {
    const NS = load();
    const B = NS.bluesky;
    const ws = sample();
    const f = NS.filings.facts(ws, ws.offerings[0]);
    const shipped = B.fees(NS.blueskyData, ['CA', 'NY'], f);
    check('with the shipped table every ticked state gives a line with no amount, the filing system\'s fee is its own line with none, and open is true', shipped.lines.length === 3 && shipped.lines.every((l) => l.cents === null && l.passThrough === true) && shipped.lines[0].state === 'CA' && /California/.test(shipped.lines[0].label) && shipped.lines[1].state === 'NY' && !shipped.lines[2].state && /Filing system fee/.test(shipped.lines[2].label) && shipped.open === true, shipped);
    // A table the check passes in: every row a test row with an invented source.
    const T = copy(NS.blueskyData);
    const mark = (code, more) => Object.assign(T.table[code], { confirmed: true, noticeRequired: true, source: 'test row, invented for this check', readOn: '2026-11-01' }, more);
    mark('NY', { fee: { kind: 'fixed', cents: 30000 } });
    mark('CA', { fee: { kind: 'tiered', basis: 'offered', tiers: [{ upTo: 1000000, cents: 30000 }, { upTo: null, cents: 120000 }] } });
    mark('TX', { fee: { kind: 'tiered', basis: 'soldInState', tiers: [{ upTo: 50000, cents: 10000 }, { upTo: null, cents: 50000 }] } });
    mark('IL', { fee: { kind: 'percent', basis: 'offered', rate: 0.001, minCents: 10000, maxCents: 100000 } });
    mark('FL', { noticeRequired: false });
    Object.assign(T.systemFee, { confirmed: true, cents: 16000, appliesTo: 'initial', source: 'test row, invented for this check', readOn: '2026-11-01' });
    check('the test table itself keeps the rule', J(B.problems(T)) === '[]', B.problems(T));
    const cents = (q, code) => (q.lines.find((l) => l.state === code) || {}).cents;
    const q = B.fees(T, ['CA', 'FL', 'IL', 'NY', 'TX'], f);
    check('a fixed fee gives its cents (New York $300)', cents(q, 'NY') === 30000, q.lines);
    check('a tiered fee on the amount offered picks its tier ($2,000,000 offered: $1,200)', cents(q, 'CA') === 120000, q.lines);
    check('a tiered fee on the amount sold in the state picks its tier ($25,000 sold in Texas: $100)', cents(q, 'TX') === 10000, q.lines);
    check('a percent fee applies its rate up to its maximum (0.1% of $2,000,000 is $2,000; the maximum is $1,000)', cents(q, 'IL') === 100000, q.lines);
    const at = (total) => B.fees(T, ['CA', 'IL'], Object.assign({}, f, { total }));
    check('the tier and the percentage follow the amount: $500,000 offered gives $300 and $500; $50,000 gives the $100 minimum', cents(at(500000), 'CA') === 30000 && cents(at(500000), 'IL') === 50000 && cents(at(50000), 'IL') === 10000, [at(500000).lines, at(50000).lines]);
    check('an Indefinite offering amount leaves a fee on the amount offered without an amount', cents(at('Indefinite'), 'CA') === null && cents(at('Indefinite'), 'IL') === null && at('Indefinite').open === true, at('Indefinite').lines);
    check('a state whose row says no notice is required gives no line and is listed as needing none', !q.lines.some((l) => l.state === 'FL') && J(q.none) === '["FL"]', q);
    check('the filing system\'s fee is one line of its own, at its confirmed amount', q.lines.filter((l) => /Filing system fee/.test(l.label)).length === 1 && q.lines[q.lines.length - 1].cents === 16000 && q.lines.length === 5, q.lines);
    check('open is false when every line has an amount', q.open === false, q);
    const withOpen = B.fees(T, ['NY', 'WA'], f);
    check('one state still unconfirmed makes open true, and its line has no amount', withOpen.open === true && cents(withOpen, 'WA') === null && cents(withOpen, 'NY') === 30000, withOpen);
    const noSource = copy(T);
    noSource.table.NY.source = '';
    check('a row marked confirmed with no source gives no amount', cents(B.fees(noSource, ['NY'], f), 'NY') === null);
    const lines = NS.filings.orderLines('bluesky', { passThrough: q.lines });
    check('through orderLines the amount due is the $100 service fee plus the amounts known ($100 + $1,200 + $1,000 + $300 + $100 + $160 = $2,860)', lines.dueCents === 286000 && lines.openFees === false && lines.lines[0].cents === 10000, lines);
    const open2 = NS.filings.orderLines('bluesky', { passThrough: withOpen.lines });
    check('with a fee open the amount due counts only what is known, and says fees are open', open2.dueCents === 10000 + 30000 + 16000 && open2.openFees === true, open2);
    check('nothing ticked, nothing to order', J(B.fees(T, [], f).lines) === '[]' && J(B.fees(T, ['FL'], f).lines) === '[]');
  },

  package({ check }) {
    const NS = load();
    const B = NS.bluesky;
    const ws = sample();
    NS.filings.recordFiled(ws, 'o1', { type: 'D', filedOn: '2026-10-20', accession: '0001234567-26-000111', source: 'self' });
    NS.filings.recordFiled(ws, 'o1', { type: 'D/A', filedOn: '2026-11-01', accession: '0001234567-26-000222', source: 'self' });
    NS.filings.setEdgar(ws, 'o1', { cik: '0001234567' });
    const before = J(ws);
    const p = B.pack(ws, ws.offerings[0], ['CA', 'NY', 'TX', 'WA']);
    check('the issuer\'s name and CIK', p.issuer && p.issuer.name === 'Fund o1' && p.issuer.cik === '0001234567', p.issuer);
    check('the accession number of the latest filed notice', p.accession === '0001234567-26-000222' && p.filedOn === '2026-11-01', p);
    const s = (c) => (p.states || []).find((x) => x.code === c) || {};
    check('each state with its first sale date, amount sold and number of investors', s('NY').firstSale === '2026-10-03' && s('NY').sold === 150000 && s('NY').investors === 2 && s('CA').sold === 75000 && s('CA').investors === 1 && s('TX').firstSale === '2026-10-12' && s('TX').sold === 25000 && s('NY').name === 'New York', p.states);
    check('a state ticked by hand with no sale in it is listed with none', s('WA').firstSale === '' && s('WA').sold === 0 && s('WA').investors === 0, s('WA'));
    check('the admin\'s contact', p.contact && p.contact.name === 'Ann Admin' && p.contact.email === 'ann@sample.test' && p.contact.phone === '555 0100', p.contact);
    const text = J(p);
    check('it holds no investor\'s name or address', !/Investor [a-z]|Elm St|Oak Ave|Bay St|Lamar|Albany|Buffalo|Fresno|Austin|Paris|1220|1420|9370|7870/.test(text), text);
    check('and the amount offered (a fee may depend on it)', p.offered === 2000000, p.offered);
    check('making it writes nothing to the workspace', J(ws) === before);
  }
};

L.runParts(cases, { name: 'BLUESKY MATH', unit: 'cases', flag: '--case', browser: false });
