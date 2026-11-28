// gate: node
// last "FILINGS MATH: PASS (cases run: 10)"
// Pure checks for phase 9 (no browser): assets/js/filings.js with data.js and eligibility.js in one sandbox, the way the
// browser loads them (window.CVPortal), on sample workspaces built here.
//   node filings-math.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "FILINGS MATH: PASS (cases run: N)" or
// "FILINGS MATH: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by gate9.sh.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const SRC = (f) => fs.readFileSync(path.join(L.ROOT, f), 'utf8');
/**
 * A fresh sandbox with data.js, eligibility.js and filings.js. Called inside each case, so a missing or broken module
 * prints a FAIL line for that case and never a bare stack trace. more: values placed on NS before filings.js loads.
 */
function load(more) {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window });
  ['assets/js/data.js', 'assets/js/eligibility.js'].forEach((f) => vm.runInContext(SRC(f), ctx, { filename: f }));
  Object.assign(window.CVPortal, more || {});
  vm.runInContext(SRC('assets/js/filings.js'), ctx, { filename: 'assets/js/filings.js' });
  if (!window.CVPortal.filings) throw new Error('assets/js/filings.js did not set NS.filings');
  return window.CVPortal;
}

/* ---------- Sample data ---------- */
const J = (x) => JSON.stringify(x);
const off = (id, exemption, more) => Object.assign({ id, name: `Fund ${id}`, minimum: 50000, structure: { exemption } }, more || {});
const inv = (id, address, more) => Object.assign({ id, title: `Investor ${id}`, address, positions: [] }, more || {});
const ABROAD = { address: '4 Rue de la Paix, Paris, 75002, France', country: 'France' };
const abroad = (id) => inv(id, ABROAD.address, { country: ABROAD.country });
const sub = (id, investorId, offeringId, status, cents, decided, more) => Object.assign({ id, type: 'subscription', investorId, offeringId, status, cents, decided, submitted: decided }, more || {});
/** Every workspace a case builds, so each case can end by proving its record holds no secret (T-09-01). */
const BUILT = [];
const WS = (offerings, investors, requests) => {
  const ws = { tenant: { id: 't1', shortName: 'Sample' }, offerings, investors, requests: requests || [] };
  BUILT.push(ws);
  return ws;
};
/** The path of every key, at any depth, whose name could carry a secret. */
function secretKeys(v, at) {
  if (!v || typeof v !== 'object') return [];
  return Object.keys(v).reduce((a, k) => a.concat(/ccc|token|secret/i.test(k) ? [`${at || ''}${k}`] : [], secretKeys(v[k], `${at || ''}${k}.`)), []);
}
/** A drawdown subscription countersigned: the request is accepted and the investor holds a position that refers to it. */
function accept(ws, r, date) {
  r.status = 'accepted';
  ws.investors.find((i) => i.id === r.investorId).positions.push({ offeringId: r.offeringId, amount: 0, commitment: r.cents / 100, date: date || r.decided, ref: r.id });
  return r;
}
/** One Rule 506(b) offering with three accepted subscriptions from investors abroad; the earliest is decided on `first`. */
function threeSales(first, second, third) {
  const ws = WS([off('o1', 'Rule 506(b)')], [abroad('a'), abroad('b'), abroad('c')], []);
  [['a', first, 25000000], ['b', second, 10000000], ['c', third, 5000000]].forEach(([i, d, c], k) => {
    ws.requests.push(accept(ws, sub(`r${k + 1}`, i, 'o1', 'approved', c, d)));
  });
  return ws;
}
const only = (list, kind) => list.filter((x) => x.kind === kind);

const cases = {
  first({ check }) {
    const NS = load();
    const F = NS.filings;
    // Monday 2 November 2026 is the earliest decision; the others follow.
    const ws = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    const before = J(ws);
    const f = F.facts(ws, ws.offerings[0]);
    check('facts gives the earliest accepted subscription as the first sale (2026-11-02)', f.firstSale === '2026-11-02', f);
    const d = F.due(ws, '2026-11-02');
    check('one reminder: the first Form D, for this offering', d.length === 1 && d[0].kind === 'formd-first' && d[0].offeringId === 'o1' && d[0].key === 'formd-first:o1', d);
    check('due 15 calendar days after the first sale (2026-11-17, a Tuesday)', d.length === 1 && d[0].due === '2026-11-17', d);
    check('no state reminder: no investor has an address in a U.S. state', only(d, 'state-first').length === 0 && J(Object.keys(f.byState || { x: 1 })) === '[]', { d, byState: f.byState });
    check('the level is due from the day of the first sale', d.length === 1 && d[0].level === 'due' && d[0].silenced === false, d);
    const on = F.due(ws, '2026-11-17');
    const after = F.due(ws, '2026-11-18');
    check('still due on the due date, overdue the day after', on.length === 1 && on[0].level === 'due' && after.length === 1 && after[0].level === 'overdue' && after[0].due === '2026-11-17', { on, after });
    check('count is 1 (on the first sale date and when overdue)', F.count(ws, '2026-11-02') === 1 && F.count(ws, '2026-11-18') === 1, [F.count(ws, '2026-11-02'), F.count(ws, '2026-11-18')]);
    check('facts, due and count write nothing to the workspace', J(ws) === before, J(ws).slice(0, 300));

    // The fifteenth day is a Saturday (first sale Friday 6 November 2026): due the Monday.
    const sat = threeSales('2026-11-06', '2026-11-09', '2026-11-10');
    const ds = F.due(sat, '2026-11-06');
    check('fifteenth day on Saturday 2026-11-21: due Monday 2026-11-23', ds.length === 1 && ds[0].due === '2026-11-23', ds);
    check('due from the first sale although the moved date is 17 days away; due through the weekend; overdue on the Tuesday', ds.length === 1 && ds[0].level === 'due' && F.due(sat, '2026-11-22')[0].level === 'due' && F.due(sat, '2026-11-23')[0].level === 'due' && F.due(sat, '2026-11-24')[0].level === 'overdue', [ds, F.due(sat, '2026-11-24')]);
    // The fifteenth day is Thanksgiving (first sale Wednesday 11 November 2026): due the Friday.
    const thx = threeSales('2026-11-11', '2026-11-12', '2026-11-13');
    const dt = F.due(thx, '2026-11-12');
    check('fifteenth day on Thanksgiving 2026-11-26: due Friday 2026-11-27', dt.length === 1 && dt[0].due === '2026-11-27', dt);

    // The sponsor's confirmed date wins over the suggestion.
    F.rec(ws, 'o1').firstSale = '2026-10-20';
    const dc = F.due(ws, '2026-11-02');
    check("the sponsor's confirmed first sale (2026-10-20) wins: due 2026-11-04, and facts gives the confirmed date", dc.length === 1 && dc[0].due === '2026-11-04' && F.facts(ws, ws.offerings[0]).firstSale === '2026-10-20', { dc, f: F.facts(ws, ws.offerings[0]).firstSale });
    check('overdue once the confirmed date has passed', F.due(ws, '2026-11-05')[0].level === 'overdue', F.due(ws, '2026-11-05'));

    // An accepted Form D removes the reminder.
    const n = F.recordFiled(ws, 'o1', { type: 'D', filedOn: '2026-11-10', accession: '0000000000-26-000001', source: 'portal' });
    const df = F.due(ws, '2026-11-12');
    check('recordFiled with an accepted D: no first Form D reminder, and nothing counted', !!n && n.status === 'accepted' && only(df, 'formd-first').length === 0 && F.count(ws, '2026-11-12') === 0, { n, df });
    const dr = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    F.rec(dr, 'o1').formD.push({ id: 'fd-x', type: 'D', status: 'submitted', filedOn: '', accession: '', snapshot: null, source: 'portal' });
    check('a notice sent but not yet accepted leaves the reminder in place', only(F.due(dr, '2026-11-10'), 'formd-first').length === 1, F.due(dr, '2026-11-10'));

    // Nothing for an offering under Regulation A, one marked as not filing, or one with no sale yet (Pitfall 12).
    const regA = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    regA.offerings[0].structure.exemption = 'Regulation A Tier 2';
    check('an offering under Regulation A produces nothing', F.applies(regA.offerings[0]) === false && J(F.due(regA, '2026-11-20')) === '[]' && F.count(regA, '2026-11-20') === 0, F.due(regA, '2026-11-20'));
    const none = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    F.rec(none, 'o1').mode = 'none';
    check('an offering with mode none produces nothing', J(F.due(none, '2026-11-20')) === '[]' && F.count(none, '2026-11-20') === 0, F.due(none, '2026-11-20'));
    const self = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    F.rec(self, 'o1').mode = 'self';
    check('a sponsor who files themselves (mode self) still gets the reminder', only(F.due(self, '2026-11-10'), 'formd-first').length === 1, F.due(self, '2026-11-10'));
    const noSale = WS([off('o1', 'Rule 506(c)')], [abroad('a')], [sub('r1', 'a', 'o1', 'pending', 5000000, undefined)]);
    check('an offering with no sale yet produces nothing (a pending subscription is not a sale)', F.applies(noSale.offerings[0]) === true && F.facts(noSale, noSale.offerings[0]).firstSale === '' && J(F.due(noSale, '2026-11-20')) === '[]', { f: F.facts(noSale, noSale.offerings[0]), d: F.due(noSale, '2026-11-20') });
  },

  record({ check }) {
    const F = load().filings;
    const ws = WS([off('o1', 'Rule 506(b)')], [abroad('a')], []);
    const f1 = F.ensure(ws);
    check('ensure creates the record once: { v: 1, offerings: {}, orders: [], silenced: {} }', J(f1) === '{"v":1,"offerings":{},"orders":[],"silenced":{}}', f1);
    f1.orders.push({ id: 'x' });
    check('ensure again returns the same record and changes nothing', F.ensure(ws) === f1 && J(ws.filings) === '{"v":1,"offerings":{},"orders":[{"id":"x"}],"silenced":{}}', ws.filings);
    f1.orders.pop();
    const r = F.rec(ws, 'o1');
    const keys = (o) => Object.keys(o).sort().join(',');
    check('rec has every key of the record', !!r && keys(r) === 'edgar,ended,firstSale,formD,issuer,mode,opened,states', r && keys(r));
    check('rec.issuer has every key', !!r && keys(r.issuer) === 'city,entityType,entityTypeOther,phone,previousNames,signerName,signerTitle,state,street1,street2,yearFormed,yearKind,zip', r && keys(r.issuer));
    check('rec.edgar has every key', !!r && keys(r.edgar) === 'cik,name,singleMember,steps' && r.edgar.singleMember === null && J(r.edgar.steps) === '{}', r && r.edgar);
    check('a new entry is blank: mode, firstSale and ended empty, not opened, no notices, no states', !!r && r.mode === '' && r.opened === false && r.firstSale === '' && r.ended === '' && J(r.formD) === '[]' && J(r.states) === '{}', r);
    check('rec again returns the same entry; an unknown offering gives null and creates nothing', F.rec(ws, 'o1') === r && F.rec(ws, 'nosuch') === null && keys(ws.filings.offerings) === 'o1', ws.filings.offerings);
    // Stored data from an earlier build keeps loading: missing keys are added, what is there stays.
    const old = WS([off('o1', 'Rule 506(b)')], [], []);
    old.filings = { v: 1, offerings: { o1: { mode: 'self', issuer: { city: 'Austin' }, edgar: { cik: '0001234567', singleMember: true } } } };
    const ro = F.rec(old, 'o1');
    check('an entry stored with fewer keys gains the missing ones and keeps its values', !!ro && ro.mode === 'self' && ro.issuer.city === 'Austin' && ro.issuer.street1 === '' && ro.edgar.cik === '0001234567' && ro.edgar.singleMember === true && J(ro.edgar.steps) === '{}' && Array.isArray(old.filings.orders) && J(old.filings.silenced) === '{}', old.filings);

    // The writers keep to the shape: there is no place for an access code or a token (T-09-01).
    const i1 = F.setIssuer(ws, 'o1', { street1: ' 1 Main St ', city: 'Austin', state: 'TX', zip: '78701', previousNames: [' Old Name LP ', ''], ccc: 'abcd1234', token: 't', nosuch: 1 });
    check('setIssuer keeps the known keys, trimmed, and drops every other key', !!i1 && i1.street1 === '1 Main St' && i1.city === 'Austin' && J(i1.previousNames) === '["Old Name LP"]' && !('ccc' in i1) && !('token' in i1) && !('nosuch' in i1), i1);
    const e1 = F.setEdgar(ws, 'o1', { cik: '0001234567', name: 'FUND ONE LP', singleMember: false, steps: { logingov: { done: true, at: '2026-11-19' } }, ccc: 'abcd1234', apiToken: 'x' });
    const e2 = F.setEdgar(ws, 'o1', { steps: { formid: { done: true, at: '2026-11-20' } } });
    check('setEdgar keeps cik, name, singleMember and the steps (a later call adds a step), and drops every other key', !!e2 && e1 === e2 && e2.cik === '0001234567' && e2.name === 'FUND ONE LP' && e2.singleMember === false && e2.steps.logingov.done === true && e2.steps.formid.at === '2026-11-20' && keys(e2) === 'cik,name,singleMember,steps', e2);
    const n = F.recordFiled(ws, 'o1', { type: 'D', filedOn: '2026-11-10', accession: '0000000000-26-000001', source: 'self', snapshot: { minimumInvestment: 50000, ccc: 'abcd1234' }, draft: { issuer: { name: 'x', secretAnswer: 'y' } } });
    check('recordFiled stores the notice with every key and drops a key that could hold a secret', !!n && keys(n) === 'accession,draft,filedOn,id,orderId,signoff,snapshot,source,status,type' && n.source === 'self' && J(n.snapshot) === '{"minimumInvestment":50000}' && J(n.draft) === '{"issuer":{"name":"x"}}', n);
    check('recordFiled refuses a notice without a type or a real filing date, and an unknown offering', F.recordFiled(ws, 'o1', { type: 'D', filedOn: '2026-02-30' }) === null && F.recordFiled(ws, 'o1', { type: 'X', filedOn: '2026-11-10' }) === null && F.recordFiled(ws, 'nosuch', { type: 'D', filedOn: '2026-11-10' }) === null && ws.filings.offerings.o1.formD.length === 1, ws.filings.offerings.o1.formD);
    const up = F.recordFiled(ws, 'o1', { id: n && n.id, type: 'D', filedOn: '2026-11-11' });
    check('recordFiled with the id of an entry updates that entry', up === n && ws.filings.offerings.o1.formD.length === 1 && n.filedOn === '2026-11-11' && n.accession === '0000000000-26-000001', ws.filings.offerings.o1.formD);
    const o = F.addOrder(ws, { kind: 'formd', offeringId: 'o1', by: 'Ann', package: { note: 'n', token: 't', states: [{ code: 'NY', ccc: 'x' }] } });
    check('an order keeps its package without any key that could hold a secret', !!o && J(o.package) === '{"note":"n","states":[{"code":"NY"}]}', o);
    check('this very check notices a secret: a record holding a key named ccc is reported', secretKeys({ a: [{ ccc: 1 }], apiToken: 2, clientSecret: 3 }).length === 3, secretKeys({ a: [{ ccc: 1 }], apiToken: 2, clientSecret: 3 }));
  },

  facts({ check }) {
    const F = load().filings;
    // A drawdown fund: commitments count, not the capital called so far (Pitfall 4).
    const ws = WS([off('o1', 'Rule 506(b)', { minimum: 100000, structure: { exemption: 'Rule 506(b)', hardCap: 50000000, targetSize: 40000000 } })], [inv('a', '1 Elm St, Albany, NY 12207'), inv('b', '2 Oak Ave, Buffalo, New York 14201-1234'), inv('c', '3 Pine Rd, Fresno, CA'), abroad('d'), inv('e', ''), inv('g', '5 Birch Ln, Springfield 62701'), inv('h', '6 Cedar Ct, Austin, TX 78701, USA')], []);
    ws.requests.push(accept(ws, sub('r1', 'a', 'o1', 'approved', 25000000, '2026-11-04')));
    ws.requests.push(accept(ws, sub('r2', 'a', 'o1', 'approved', 5000000, '2026-11-20')));
    ws.requests.push(accept(ws, sub('r3', 'b', 'o1', 'approved', 10000000, '2026-11-02')));
    ws.requests.push(accept(ws, sub('r4', 'c', 'o1', 'approved', 20000000, '2026-11-09')));
    ws.requests.push(accept(ws, sub('r5', 'd', 'o1', 'approved', 30000000, '2026-11-10')));
    // A holding brought in with no request: 300,000 committed, 120,000 called so far. And one with no commitment.
    ws.investors.find((i) => i.id === 'e').positions.push({ offeringId: 'o1', amount: 120000, commitment: 300000, date: '2026-10-28' });
    ws.investors.find((i) => i.id === 'g').positions.push({ offeringId: 'o1', amount: 50000, date: '2026-11-12' });
    ws.investors.find((i) => i.id === 'h').positions.push({ offeringId: 'o1', amount: 0, commitment: 75000, date: '2026-11-15', ref: 'gone', redeemed: '2027-01-31' });
    // Never sales: a declined and a pending subscription, a redemption, another offering's holding.
    ws.requests.push(sub('r6', 'c', 'o1', 'rejected', 99900000, '2026-10-01'));
    ws.requests.push(sub('r7', 'd', 'o1', 'pending', 88800000, undefined));
    ws.requests.push({ id: 'r8', type: 'redemption', investorId: 'a', offeringId: 'o1', status: 'approved', cents: 77700000, decided: '2026-10-02' });
    ws.investors.find((i) => i.id === 'a').positions.push({ offeringId: 'other', amount: 666000, date: '2026-01-01' });
    const before = J(ws);
    const f = F.facts(ws, ws.offerings[0]);
    check('sold counts commitments, each sale once: 250,000 + 50,000 + 100,000 + 200,000 + 300,000 + 300,000 + 50,000 + 75,000', f.sold === 1325000, f.sold);
    check('a holding and its request are never both counted; a redeemed holding still counts; declined, pending and redemption requests never', f.sold === 1325000 && f.investors === 7, { sold: f.sold, investors: f.investors });
    check('investors are counted once each (a has two subscriptions): 7', f.investors === 7, f.investors);
    check('the first sale is the earliest of the requests\' decided dates and the holdings\' dates (2026-10-28, a holding)', f.firstSale === '2026-10-28' && f.firstSaleSuggested === '2026-10-28', f);
    check('regime 506b, in U.S. dollars, total offering the hard cap, minimum the offering\'s', f.regime === '506b' && f.usd === true && f.total === 50000000 && f.minimum === 100000, f);
    check('byState groups by the state at the end of the address: NY (code, and name with ZIP+4) 2 investors, 400,000, first 2026-11-02', J(f.byState.NY) === '{"firstSale":"2026-11-02","sold":400000,"investors":2}', f.byState);
    check('byState: CA without a ZIP code, TX before a trailing "USA", and no other state', J(f.byState.CA) === '{"firstSale":"2026-11-09","sold":200000,"investors":1}' && J(f.byState.TX) === '{"firstSale":"2026-11-15","sold":75000,"investors":1}' && Object.keys(f.byState).sort().join() === 'CA,NY,TX', f.byState);
    check('an investor with a foreign address is in outsideUS', J(f.outsideUS) === '{"firstSale":"2026-11-10","sold":300000,"investors":1}', f.outsideUS);
    check('investors whose state cannot be told (no address; a ZIP code with no state) are in unplaced, never dropped', J(f.unplaced) === '{"firstSale":"2026-10-28","sold":350000,"investors":2}', f.unplaced);
    check('every sale is in exactly one group: the groups add up to the whole', f.byState.NY.sold + f.byState.CA.sold + f.byState.TX.sold + f.outsideUS.sold + f.unplaced.sold === f.sold && f.byState.NY.investors + 1 + 1 + f.outsideUS.investors + f.unplaced.investors === f.investors, f);
    check('facts writes nothing to the workspace', J(ws) === before);

    // Plan-check A1: an approved subscription not yet funded is a sale.
    const ap = WS([off('o1', 'Rule 506(c)')], [inv('a', '1 Elm St, Albany, NY 12207')], [sub('r1', 'a', 'o1', 'approved', 15000000, '2026-11-03')]);
    const fa = F.facts(ap, ap.offerings[0]);
    check('an approved, unfunded subscription gives sold equal to its amount (150,000), investors 1, and the first sale', fa.sold === 150000 && fa.investors === 1 && fa.firstSale === '2026-11-03' && fa.byState.NY.sold === 150000, fa);
    check('with neither a hard cap nor a target size the total offering is Indefinite', fa.total === 'Indefinite', fa.total);
    const tg = WS([off('o1', 'Rule 506(c)', { minimum: '', structure: { exemption: 'Rule 506(c)', targetSize: 8000000 } })], [], []);
    check('the target size is the total where there is no hard cap; a blank minimum is null', F.facts(tg, tg.offerings[0]).total === 8000000 && F.facts(tg, tg.offerings[0]).minimum === null && F.facts(tg, tg.offerings[0]).sold === 0 && F.facts(tg, tg.offerings[0]).firstSale === '', F.facts(tg, tg.offerings[0]));
    // An open-ended fund: a funded request with its holding, counted once at the request's amount.
    const op = WS([off('o1', 'Rule 506(c)')], [inv('a', '1 Elm St, Albany, NY 12207')], [sub('r1', 'a', 'o1', 'funded', 20000000, '2026-11-03')]);
    op.investors[0].positions.push({ offeringId: 'o1', amount: 200000, date: '2026-12-01', ref: 'r1' });
    check('a funded subscription and the holding it created count once (200,000), on the day it was decided', F.facts(op, op.offerings[0]).sold === 200000 && F.facts(op, op.offerings[0]).firstSale === '2026-11-03', F.facts(op, op.offerings[0]));

    // Plan-check A2: the non-accredited figure counts only investors who have invested.
    const na = { regime: '506b', accredited: false, sophisticated: true };
    const nw = WS([off('o1', 'Rule 506(b)')], [abroad('a'), abroad('b'), abroad('c'), abroad('d')], []);
    nw.requests.push(accept(nw, sub('r1', 'a', 'o1', 'approved', 5000000, '2026-11-02', { qual: na })));
    nw.requests.push(sub('r2', 'b', 'o1', 'pending', 5000000, undefined, { qual: na }));
    nw.requests.push(accept(nw, sub('r3', 'c', 'o1', 'approved', 5000000, '2026-11-03', { qual: { regime: '506b', accredited: true, basis: 'x' } })));
    nw.requests.push(accept(nw, sub('r4', 'd', 'o1', 'approved', 5000000, '2026-11-04')));
    const fn = F.facts(nw, nw.offerings[0]);
    check('one accepted and one pending non-accredited investor: count 1, pending 1 (and 1 unanswered)', J(fn.nonAccredited) === '{"count":1,"pending":1,"unanswered":1}', fn.nonAccredited);

    // Another currency: no dollar figure is made up.
    const eu = WS([off('o1', 'Rule 506(b)', { currency: 'EUR', structure: { exemption: 'Rule 506(b)', hardCap: 9000000 } })], [inv('a', '1 Elm St, Albany, NY 12207')], []);
    eu.requests.push(accept(eu, sub('r1', 'a', 'o1', 'approved', 5000000, '2026-11-02')));
    const fe = F.facts(eu, eu.offerings[0]);
    check('an offering in another currency has usd false and no dollar figures (sold, total, minimum and each state\'s sold are null)', fe.usd === false && fe.sold === null && fe.total === null && fe.minimum === null && fe.byState.NY.sold === null && fe.outsideUS.sold === null && fe.unplaced.sold === null, fe);
    check('and still its investors, its first sale and its states', fe.investors === 1 && fe.firstSale === '2026-11-02' && fe.byState.NY.investors === 1 && fe.byState.NY.firstSale === '2026-11-02', fe);
  },

  annual({ check }) {
    const F = load().filings;
    const make = () => threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    const ws = make();
    F.recordFiled(ws, 'o1', { type: 'D', filedOn: '2026-11-10', source: 'portal' });
    const a = only(F.due(ws, '2027-09-01'), 'formd-annual');
    check('one year after the accepted D (2026-11-10): due 2027-11-10, key formd-annual:o1', a.length === 1 && a[0].due === '2027-11-10' && a[0].key === 'formd-annual:o1' && a[0].basis && a[0].basis.filedOn === '2026-11-10', a);
    check('and no first Form D reminder beside it', only(F.due(ws, '2027-09-01'), 'formd-first').length === 0);
    const lv = (d) => only(F.due(ws, d), 'formd-annual')[0].level;
    check('levels: later 70 days before, soon 51 days before, due 30 days before and on the day, overdue the day after', lv('2027-09-01') === 'later' && lv('2027-09-20') === 'soon' && lv('2027-10-11') === 'due' && lv('2027-11-10') === 'due' && lv('2027-11-11') === 'overdue', [lv('2027-09-01'), lv('2027-09-20'), lv('2027-10-11'), lv('2027-11-10'), lv('2027-11-11')]);
    check('counted only once it is due: 0 at 70 and 51 days, 1 at 30 days and when overdue', F.count(ws, '2027-09-01') === 0 && F.count(ws, '2027-09-20') === 0 && F.count(ws, '2027-10-11') === 1 && F.count(ws, '2027-11-11') === 1, [F.count(ws, '2027-09-01'), F.count(ws, '2027-10-11')]);
    // A notice sent but not accepted does not move the date; an accepted amendment does (Pitfall 7).
    F.rec(ws, 'o1').formD.push({ id: 'fd-p', type: 'D/A', status: 'submitted', filedOn: '2027-02-01', accession: '', snapshot: null, source: 'portal' });
    check('an amendment sent but not yet accepted does not move the date', only(F.due(ws, '2027-09-01'), 'formd-annual')[0].due === '2027-11-10');
    F.recordFiled(ws, 'o1', { type: 'D/A', filedOn: '2027-03-05', source: 'portal' });
    const b = only(F.due(ws, '2027-09-01'), 'formd-annual');
    check('an amendment accepted on 2027-03-05 moves it: the anniversary 2028-03-05 is a Sunday, so due Monday 2028-03-06', b.length === 1 && b[0].due === '2028-03-06' && b[0].basis.filedOn === '2027-03-05', b);
    check('due through the weekend it was moved over, overdue on the Tuesday', only(F.due(ws, '2028-03-05'), 'formd-annual')[0].level === 'due' && only(F.due(ws, '2028-03-06'), 'formd-annual')[0].level === 'due' && only(F.due(ws, '2028-03-07'), 'formd-annual')[0].level === 'overdue');
    // A notice the sponsor filed themselves counts; the anniversary on a holiday moves on.
    const self = make();
    F.recordFiled(self, 'o1', { type: 'D', filedOn: '2026-07-05', source: 'self' });
    const s = only(F.due(self, '2027-06-20'), 'formd-annual');
    check("a notice the sponsor filed themselves counts: 2026-07-05 gives 2027-07-05, the observed Independence Day, so due 2027-07-06", s.length === 1 && s[0].due === '2027-07-06' && only(F.due(self, '2027-06-20'), 'formd-first').length === 0, s);
    const leap = make();
    F.recordFiled(leap, 'o1', { type: 'D', filedOn: '2028-02-29', source: 'portal' });
    check('a notice filed on 29 February 2028 is due again on 28 February 2029', only(F.due(leap, '2029-02-01'), 'formd-annual')[0].due === '2029-02-28', F.due(leap, '2029-02-01'));
    // The offering has ended: no annual amendment and no amendment for a change (plan-check A3).
    const end = make();
    end.offerings[0].minimum = 20000;
    F.recordFiled(end, 'o1', { type: 'D', filedOn: '2026-11-10', source: 'portal', snapshot: { minimumInvestment: 50000, totalOffering: 'Indefinite', nonAccredited: 0, commissions: 0, findersFees: 0, proceedsToInsiders: 0, relatedPersons: [], material: 'm' } });
    const kinds = (d) => F.due(end, d).map((x) => x.kind).sort().join();
    check('while it continues: the annual amendment and the amendment for a change are both there', kinds('2027-10-20') === 'formd-annual,formd-change', kinds('2027-10-20'));
    F.rec(end, 'o1').ended = '2027-06-30';
    check('ended on 2027-06-30: neither is there afterwards, nor on the day itself', kinds('2027-10-20') === '' && kinds('2027-06-30') === '' && F.count(end, '2027-11-20') === 0, [kinds('2027-10-20'), kinds('2027-06-30')]);
    check('an end date still ahead changes nothing yet', kinds('2027-06-29') === 'formd-annual,formd-change', kinds('2027-06-29'));
    const late = make();
    F.rec(late, 'o1').ended = '2026-11-12';
    check('an offering that ended with no notice filed still has its first Form D reminder', F.due(late, '2026-11-20').map((x) => x.kind).join() === 'formd-first', F.due(late, '2026-11-20'));
  },

  change({ check }) {
    const F = load().filings;
    const S = { minimumInvestment: 50000, totalOffering: 10000000, nonAccredited: 34, commissions: 100000, findersFees: 20000, proceedsToInsiders: 50000, relatedPersons: ['ann||lee', 'bo|q|park'], material: 'm1' };
    const items = (patch, base) => F.changeNeeded(Object.assign({}, base || S), Object.assign({}, base || S, patch)).map((x) => x.item).join();
    const no = (name, patch, base) => check(`${name}: no amendment`, items(patch, base) === '', items(patch, base));
    const yes = (name, patch, item, base) => check(`${name}: amendment (${item})`, items(patch, base) === item, items(patch, base));
    no('nothing changed', {});
    no('minimum investment down 8 percent', { minimumInvestment: 46000 });
    no('minimum investment down exactly 10 percent', { minimumInvestment: 45000 });
    yes('minimum investment down 12 percent', { minimumInvestment: 44000 }, 'minimumInvestment');
    no('minimum investment up by any amount', { minimumInvestment: 5000000 });
    no('offering amount up 10 percent', { totalOffering: 11000000 });
    yes('offering amount up 11 percent', { totalOffering: 11100000 }, 'totalOffering');
    no('offering amount down', { totalOffering: 1000000 });
    yes('offering amount from a number to Indefinite', { totalOffering: 'Indefinite' }, 'totalOffering');
    yes('offering amount from Indefinite to a number', { totalOffering: 10000000 }, 'totalOffering', Object.assign({}, S, { totalOffering: 'Indefinite' }));
    no('offering amount Indefinite before and now', { totalOffering: 'Indefinite' }, Object.assign({}, S, { totalOffering: 'Indefinite' }));
    no('non-accredited investors 34 to 35', { nonAccredited: 35 });
    yes('non-accredited investors 35 to 36', { nonAccredited: 36 }, 'nonAccredited', Object.assign({}, S, { nonAccredited: 35 }));
    no('non-accredited investors 36 to 36', { nonAccredited: 36 }, Object.assign({}, S, { nonAccredited: 36 }));
    yes('non-accredited investors 36 to 37', { nonAccredited: 37 }, 'nonAccredited', Object.assign({}, S, { nonAccredited: 36 }));
    no('non-accredited investors 36 to 35', { nonAccredited: 35 }, Object.assign({}, S, { nonAccredited: 36 }));
    [['commissions', 100000], ['findersFees', 20000], ['proceedsToInsiders', 50000]].forEach(([k, v]) => {
      no(`${k} up 10 percent`, { [k]: v + v / 10 });
      yes(`${k} up 11 percent`, { [k]: v + (v * 11) / 100 }, k);
      no(`${k} down`, { [k]: Math.round(v / 2) });
    });
    // A base of 0: nothing is divided by it.
    const Z = Object.assign({}, S, { minimumInvestment: 0, totalOffering: 0, commissions: 0, findersFees: 0, proceedsToInsiders: 0 });
    no('minimum investment 0 to any amount', { minimumInvestment: 250000 }, Z);
    no('every amount 0 before and now', {}, Z);
    ['totalOffering', 'commissions', 'findersFees', 'proceedsToInsiders'].forEach((k) => yes(`${k} 0 to a positive amount`, { [k]: 1 }, k, Z));
    const z = F.changeNeeded(Z, Object.assign({}, Z, { totalOffering: 5, commissions: 5 }));
    check('a base of 0 gives plain reasons (no division: nothing that is not a finite number)', z.length === 2 && !/null|NaN|Infinity/.test(J(z)), z);
    yes('a new related person', { relatedPersons: ['ann||lee', 'bo|q|park', 'cy||young'] }, 'relatedPersons');
    yes('a related person no longer named (the instructions exempt only an address or a relationship)', { relatedPersons: ['ann||lee'] }, 'relatedPersons');
    no('the same related persons in another order', { relatedPersons: ['bo|q|park', 'ann||lee'] });
    yes('a different material text', { material: 'm2' }, 'material');
    no('amount sold, total investors and a related person\'s address (never part of a snapshot)', { amountSold: 999, totalInvestors: 99, relatedPersonAddresses: ['x'], issuerSize: 'big', statesOfSolicitation: ['NY'] });
    const many = F.changeNeeded(S, Object.assign({}, S, { minimumInvestment: 100, totalOffering: 99000000, material: 'm2' }));
    check('the reasons come back by item, each with what it was and what it is', J(many.map((x) => x.item)) === '["minimumInvestment","totalOffering","material"]' && many[0].from === 50000 && many[0].to === 100 && many[1].from === 10000000 && many[1].to === 99000000, many);
    check('with no earlier snapshot there is nothing to compare', J(F.changeNeeded(null, S)) === '[]' && J(F.changeNeeded(S, null)) === '[]');

    // due: the offering's live figures laid over the last filed snapshot.
    const snap = (more) => Object.assign({ minimumInvestment: 50000, totalOffering: 10000000, nonAccredited: 0, commissions: 0, findersFees: 0, proceedsToInsiders: 0, relatedPersons: ['ann||lee'], material: 'm1' }, more || {});
    const make = (o, s) => {
      const ws = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
      Object.assign(ws.offerings[0], { minimum: 50000 }, o || {});
      ws.offerings[0].structure = Object.assign({ exemption: 'Rule 506(b)', hardCap: 10000000 }, (o && o.structure) || {});
      F.recordFiled(ws, 'o1', { type: 'D', filedOn: '2026-11-10', source: 'portal', snapshot: s === undefined ? snap() : s });
      return ws;
    };
    const ch = (ws) => only(F.due(ws, '2026-12-01'), 'formd-change');
    check('figures as filed: no reminder for a change', ch(make()).length === 0, ch(make()));
    const lowMin = make({ minimum: 40000 });
    const c1 = ch(lowMin);
    check('the minimum lowered 20 percent since the filed notice: one reminder, no date, level due, counted, with its reason', c1.length === 1 && c1[0].key === 'formd-change:o1' && c1[0].due === null && c1[0].level === 'due' && c1[0].basis.reasons.map((x) => x.item).join() === 'minimumInvestment' && F.count(lowMin, '2026-12-01') === 1, c1);
    check('the minimum lowered 8 percent: none', ch(make({ minimum: 46000 })).length === 0);
    check('the hard cap raised 11 percent: one; raised 10 percent: none', ch(make({ structure: { hardCap: 11100000 } })).length === 1 && ch(make({ structure: { hardCap: 11000000 } })).length === 0);
    check('an offering record with no cap and no minimum says nothing about the filed figures: none', ch(make({ minimum: '', structure: { hardCap: null } })).length === 0, ch(make({ minimum: '', structure: { hardCap: null } })));
    check('a filed notice with no snapshot (the sponsor\'s own filing) cannot be compared: none', ch(make({ minimum: 100 }, null)).length === 0);
    // 36 non-accredited investors accepted against 35 on the filed notice; a pending one never counts (A2).
    const crowd = (accepted, pending) => {
      const ws = make({}, snap({ nonAccredited: 35 }));
      const na = { regime: '506b', accredited: false };
      for (let k = 0; k < accepted + pending; k++) {
        ws.investors.push(abroad(`n${k}`));
        const r = sub(`q${k}`, `n${k}`, 'o1', k < accepted ? 'approved' : 'pending', 100000, k < accepted ? '2026-11-20' : undefined, { qual: na });
        ws.requests.push(k < accepted ? accept(ws, r) : r);
      }
      return ws;
    };
    check('36 non-accredited investors accepted against 35 on the filed notice: one reminder', ch(crowd(36, 0)).length === 1 && ch(crowd(36, 0))[0].basis.reasons[0].item === 'nonAccredited' && ch(crowd(36, 0))[0].basis.reasons[0].to === 36, ch(crowd(36, 0)));
    check('35 accepted and one still pending: none (only investors who have invested count)', ch(crowd(35, 1)).length === 0, ch(crowd(35, 1)));
    // An accepted amendment carrying the new figures clears it.
    F.recordFiled(lowMin, 'o1', { type: 'D/A', filedOn: '2026-12-02', source: 'portal', snapshot: snap({ minimumInvestment: 40000 }) });
    check('an accepted amendment with the new figures clears the reminder', only(F.due(lowMin, '2026-12-03'), 'formd-change').length === 0, F.due(lowMin, '2026-12-03'));
  },

  holidays({ check }) {
    const F = load().filings;
    // NOT read from the published schedule: www.opm.gov could not be reached from this session (the network host is
    // blocked, tried 2026-11-19). These dates were typed by hand from the rule of 5 U.S.C. 6103 (the eleven holidays;
    // one on a Saturday is observed the Friday before, one on a Sunday the Monday after), independently of filings.js.
    console.log('NOTE holidays: the published federal schedule (www.opm.gov) could not be reached on 2026-11-19; this case proves the rule of 5 U.S.C. 6103 only, against dates typed by hand');
    const TYPED = {
      2026: ['2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25'],
      2027: ['2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-10-11', '2027-11-11', '2027-11-25', '2027-12-24'],
      // New Year's Day 2028 is a Saturday: observed on Friday 31 December 2027.
      2028: ['2027-12-31', '2028-01-17', '2028-02-21', '2028-05-29', '2028-06-19', '2028-07-04', '2028-09-04', '2028-10-09', '2028-11-10', '2028-11-23', '2028-12-25']
    };
    [2026, 2027, 2028].forEach((y) => {
      check(`${y}: eleven holidays typed`, TYPED[y].length === 11);
      const missing = TYPED[y].filter((d) => F.holidays(Number(d.slice(0, 4))).indexOf(d) < 0);
      check(`${y}: each of the eleven observed days is a holiday`, missing.length === 0, missing);
    });
    const typedAll = [].concat(TYPED[2026], TYPED[2027], TYPED[2028]).sort();
    const got = [].concat(F.holidays(2026), F.holidays(2027), F.holidays(2028)).sort();
    check('2026 to 2028: the module lists those 33 days and no other', J(got) === J(typedAll), { extra: got.filter((d) => typedAll.indexOf(d) < 0), missing: typedAll.filter((d) => got.indexOf(d) < 0) });
    check('holidays(2027) includes 2027-12-31 (1 January 2028 is a Saturday) and has 12 days; holidays(2028) has 10', F.holidays(2027).indexOf('2027-12-31') >= 0 && F.holidays(2027).length === 12 && F.holidays(2028).length === 10 && F.holidays(2026).length === 11, [F.holidays(2026).length, F.holidays(2027).length, F.holidays(2028).length]);
    check('holidays come in order, and a caller cannot change the list', J(F.holidays(2026)) === J(F.holidays(2026).slice().sort()) && (F.holidays(2026).push('x'), F.holidays(2026).length === 11));
    const bd = (a, b) => check(`businessDay(${a}) is ${b}`, F.businessDay(a) === b, F.businessDay(a));
    bd('2027-12-31', '2028-01-03');
    bd('2026-11-17', '2026-11-17');
    bd('2026-11-21', '2026-11-23');
    bd('2026-11-22', '2026-11-23');
    bd('2026-11-26', '2026-11-27');
    bd('2026-07-03', '2026-07-06');
    bd('2026-12-25', '2026-12-28');
    bd('2027-06-18', '2027-06-21');
    bd('2027-12-24', '2027-12-27');
    check('businessDay of something that is not a date is empty', F.businessDay('') === '' && F.businessDay('2026-02-30') === '' && F.businessDay(null) === '');
    check('under Node the module gives the same holidays (the server reads them)', J(require(path.join(L.ROOT, 'assets/js/filings.js')).holidays(2027)) === J(F.holidays(2027)));
  },

  silence({ check }) {
    const F = load().filings;
    const ws = threeSales('2026-11-02', '2026-11-04', '2026-11-09');
    ws.offerings.push(off('o2', 'Rule 506(c)'));
    ws.investors.push(inv('n', '1 Elm St, Albany, NY 12207'), inv('m', '9 Bay St, Fresno, CA 93701'));
    ws.requests.push(accept(ws, sub('s1', 'n', 'o2', 'approved', 5000000, '2026-11-05')));
    ws.requests.push(accept(ws, sub('s2', 'm', 'o2', 'approved', 5000000, '2026-11-06')));
    const T = '2026-11-12';
    const keysOf = (list) => list.map((x) => x.key).join();
    const d0 = F.due(ws, T);
    check('before: four reminders, all counted', keysOf(d0) === 'formd-first:o1,formd-first:o2,state-first:o2:CA,state-first:o2:NY' && F.count(ws, T) === 4 && d0.every((x) => x.silenced === false), d0);
    check('silence returns true and stores when and by whom', F.silence(ws, 'formd-first:o1', 'Ann Lee') === true && ws.filings.silenced['formd-first:o1'].by === 'Ann Lee' && /^\d{4}-\d{2}-\d{2}T/.test(ws.filings.silenced['formd-first:o1'].at), ws.filings.silenced);
    const d1 = F.due(ws, T);
    check('the count drops by one', F.count(ws, T) === 3, F.count(ws, T));
    check('the reminder stays in the list, marked silenced, with its date and level unchanged', d1.length === 4 && d1[0].key === 'formd-first:o1' && d1[0].silenced === true && d1[0].due === d0[0].due && d1[0].level === d0[0].level && d1.slice(1).every((x) => x.silenced === false), d1);
    check('unsilence brings it back', F.unsilence(ws, 'formd-first:o1') === true && F.count(ws, T) === 4 && F.due(ws, T)[0].silenced === false && !('formd-first:o1' in ws.filings.silenced), ws.filings.silenced);
    F.silence(ws, 'state-first:o2:NY', 'Ann Lee');
    check('one state silenced: only that state', F.count(ws, T) === 3 && F.due(ws, T).filter((x) => x.silenced).map((x) => x.key).join() === 'state-first:o2:NY', F.due(ws, T));
    F.unsilence(ws, 'state-first:o2:NY');
    F.silence(ws, 'offering:o2', 'Ann Lee');
    check('offering:o2 silences every reminder of that offering and none of the other', F.count(ws, T) === 1 && F.due(ws, T).filter((x) => x.silenced).map((x) => x.key).join() === 'formd-first:o2,state-first:o2:CA,state-first:o2:NY', F.due(ws, T));
    F.unsilence(ws, 'offering:o2');
    check('and back', F.count(ws, T) === 4 && J(ws.filings.silenced) === '{}', ws.filings.silenced);
    // A key for a reminder that does not exist changes nothing.
    const was = J(ws);
    const r = [F.silence(ws, 'formd-first:nosuch', 'Ann'), F.silence(ws, 'bogus', 'Ann'), F.silence(ws, 'state-first:o1', 'Ann'), F.silence(ws, 'state-first:o1:ZZ', 'Ann'), F.silence(ws, '', 'Ann'), F.unsilence(ws, 'formd-first:o1')];
    check('a key that names no reminder (unknown offering, unknown kind, no state, unknown state, empty) is refused and nothing changes', r.every((x) => x === false) && J(ws) === was && F.count(ws, T) === 4, r);
    F.silence(ws, 'formd-annual:o1', 'Ann');
    check('silencing a reminder that is not there now leaves the count and every reminder as they were', F.count(ws, T) === 4 && F.due(ws, T).every((x) => x.silenced === false));
    check('due and count write nothing', (() => { const b = J(ws); F.due(ws, T); F.count(ws, T); return J(ws) === b; })());
  },

  states({ check }) {
    const F = load().filings;
    const make = () => {
      const ws = WS([off('o1', 'Rule 506(b)')], [inv('a', '1 Elm St, Albany, NY 12207'), inv('b', '2 Oak Ave, Buffalo, NY 14201'), inv('c', '9 Bay St, Fresno, CA 93701'), abroad('d')], []);
      ws.requests.push(accept(ws, sub('r1', 'a', 'o1', 'approved', 5000000, '2026-11-09')));
      ws.requests.push(accept(ws, sub('r2', 'b', 'o1', 'approved', 5000000, '2026-11-03')));
      ws.requests.push(accept(ws, sub('r3', 'c', 'o1', 'approved', 5000000, '2026-11-06')));
      ws.requests.push(accept(ws, sub('r4', 'd', 'o1', 'approved', 5000000, '2026-11-02')));
      return ws;
    };
    const st = (ws, today, opts) => F.due(ws, today, opts).filter((x) => x.kind === 'state-first' || x.kind === 'state-renewal');
    const ws = make();
    const s0 = st(ws, '2026-11-10');
    check('one reminder per state with an accepted investor (two in New York give one), none for the investor abroad', s0.map((x) => x.key).join() === 'state-first:o1:CA,state-first:o1:NY' && s0.every((x) => x.offeringId === 'o1') && s0[1].state === 'NY', s0);
    check('with no state table: no date, level due, and the basis gives the first sale in that state', s0.every((x) => x.due === null && x.level === 'due') && s0[1].basis.firstSale === '2026-11-03' && s0[0].basis.firstSale === '2026-11-06', s0);
    const table = { NY: { days: 15, noticeRequired: true, confirmed: true }, CA: { days: 15, noticeRequired: true, confirmed: true } };
    const s1 = st(ws, '2026-11-10', { states: table });
    check('a confirmed row of 15 days: New York due 2026-11-18 (first sale 2026-11-03); California 2026-11-21 is a Saturday, so 2026-11-23', s1[1].due === '2026-11-18' && s1[0].due === '2026-11-23' && s1[1].basis.days === 15, s1);
    check('levels follow the date: due now, overdue after it', s1[1].level === 'due' && st(ws, '2026-11-19', { states: table })[1].level === 'overdue' && st(ws, '2026-11-23', { states: table })[0].level === 'due' && st(ws, '2026-11-24', { states: table })[0].level === 'overdue');
    const s2 = st(ws, '2026-11-10', { states: { NY: { days: 15, noticeRequired: true, confirmed: false }, CA: { days: 30, noticeRequired: true, confirmed: true } } });
    check('an unconfirmed row gives no date (level due, first sale in the basis); another number of days is used as given', s2[1].due === null && s2[1].level === 'due' && s2[1].basis.firstSale === '2026-11-03' && s2[0].due === '2026-12-07', s2);
    const s3 = st(ws, '2026-11-10', { states: { NY: { noticeRequired: false, confirmed: true }, CA: { noticeRequired: false, confirmed: false } } });
    check('a confirmed row saying no notice is required produces none; an unconfirmed one is not relied on', s3.map((x) => x.key).join() === 'state-first:o1:CA' && s3[0].due === null, s3);
    check('the state reminders are there with no Form D on file, and with one', only(F.due(ws, '2026-11-10'), 'formd-first').length === 1 && (F.recordFiled(ws, 'o1', { type: 'D', filedOn: '2026-11-10', source: 'portal' }), st(ws, '2026-11-11').length === 2 && only(F.due(ws, '2026-11-11'), 'formd-first').length === 0), F.due(ws, '2026-11-11'));
    // A filed state: no first notice; a renewal on the date recorded.
    const rs = F.recordState(ws, 'NY', 'x');
    const ny = F.recordState(ws, 'o1', 'NY', { status: 'filed', filedOn: '2026-11-12', efdId: 'EFD-1', feeCents: 30000, quotedCents: 30000, renewsOn: '2027-11-12', source: 'portal', ccc: 'x', nosuch: 1 });
    check('recordState stores the known keys only, and refuses an unknown offering or state', rs === null && F.recordState(ws, 'o1', 'ZZ', { status: 'filed' }) === null && !!ny && Object.keys(ny).sort().join() === 'efdId,feeCents,filedOn,quotedCents,renewsOn,source,status' && ny.feeCents === 30000 && ws.filings.offerings.o1.states.NY === ny, ny);
    const s4 = st(ws, '2026-11-13', { states: table });
    check('a filed state has no first-notice reminder; its renewal is on the recorded date', s4.map((x) => x.key).join() === 'state-first:o1:CA,state-renewal:o1:NY' && s4[1].due === '2027-11-12' && s4[1].state === 'NY' && s4[1].level === 'later', s4);
    const lv = (d) => st(ws, d, { states: table }).filter((x) => x.kind === 'state-renewal')[0].level;
    check('renewal levels: soon within 60 days, due within 30, overdue after', lv('2027-09-20') === 'soon' && lv('2027-10-13') === 'due' && lv('2027-11-12') === 'due' && lv('2027-11-13') === 'overdue', [lv('2027-09-20'), lv('2027-10-13'), lv('2027-11-13')]);
    const p = F.recordState(ws, 'o1', 'CA', { status: 'ordered' });
    check('a state ordered but not yet filed keeps its reminder', !!p && p.filedOn === '' && st(ws, '2026-11-13').some((x) => x.key === 'state-first:o1:CA'), st(ws, '2026-11-13'));
    // F4 (3): once the offering has ended, no renewal is due; a first notice for a sale made before the end still shows.
    const ends = (d) => {
      F.rec(ws, 'o1').ended = d;
      const out = st(ws, '2027-09-20', { states: table }).map((x) => x.key).join();
      F.rec(ws, 'o1').ended = '';
      return out;
    };
    check('an offering ended before today, or today, has no renewal reminder; its first notice for a sale before the end still shows; an end date still ahead changes nothing', ends('2026-12-01') === 'state-first:o1:CA' && ends('2027-09-20') === 'state-first:o1:CA' && ends('2028-01-01') === 'state-first:o1:CA,state-renewal:o1:NY', [ends('2026-12-01'), ends('2027-09-20'), ends('2028-01-01')]);
    // Not for an offering outside Rule 506, nor for one marked as not filing.
    const regA = make();
    regA.offerings[0].structure.exemption = 'Regulation A Tier 1';
    const none = make();
    F.rec(none, 'o1').mode = 'none';
    check('no state reminder for a Regulation A offering or one with mode none', J(F.due(regA, '2026-11-10')) === '[]' && J(F.due(none, '2026-11-10')) === '[]');
  },

  orders({ check }) {
    const calls = [];
    const NS = load({ audit: { log: (w, e) => (calls.push(e), e) } });
    const F = NS.filings;
    check('prices in one place: Form D 10000, amendment 5000, state notices 10000, renewal 5000 (cents)', J(F.PRICES) === '{"formd":10000,"formd-amendment":5000,"bluesky":10000,"bluesky-renewal":5000}', F.PRICES);
    check('the prices cannot be changed by a caller', (() => { try { F.PRICES.formd = 1; } catch (e) { /* frozen */ } return F.PRICES.formd === 10000; })());
    const a = F.orderLines('formd');
    check('Form D: one service line of $100 saying EDGAR access setup is included; $100 due; no open fees', a.lines.length === 1 && a.lines[0].cents === 10000 && a.lines[0].passThrough === false && /EDGAR access setup/i.test(a.lines[0].label) && /included/i.test(a.lines[0].label) && a.dueCents === 10000 && a.openFees === false, a);
    check('amendment $50; renewal $50', F.orderLines('formd-amendment').dueCents === 5000 && F.orderLines('formd-amendment').lines.length === 1 && F.orderLines('bluesky-renewal').dueCents === 5000 && F.orderLines('bluesky-renewal').lines.length === 1);
    const three = [{ label: 'New York fee', cents: 30000, state: 'NY' }, { label: 'California fee', cents: 60000, state: 'CA' }, { label: 'Texas fee', cents: 50000, state: 'TX' }];
    const b1 = F.orderLines('bluesky', { passThrough: three.slice(0, 1) });
    const b3 = F.orderLines('bluesky', { passThrough: three });
    check('state notices: one service line of $100 whether for one state or three', b1.lines.filter((l) => !l.passThrough).length === 1 && b3.lines.filter((l) => !l.passThrough).length === 1 && b1.lines[0].cents === 10000 && b3.lines[0].cents === 10000, [b1, b3]);
    check('pass-through fees are their own lines, at cost: $100 + $300 + $600 + $500 = $1,500 due', b3.lines.length === 4 && b3.lines.slice(1).every((l) => l.passThrough === true) && b3.lines[1].cents === 30000 && b3.lines[1].state === 'NY' && b3.dueCents === 150000 && b3.openFees === false, b3);
    const open = F.orderLines('bluesky', { passThrough: [{ label: 'New York fee', cents: 30000 }, { label: 'California fee', cents: null }] });
    check('a fee not yet confirmed carries no number, adds nothing to the amount due, and the order says so', open.lines[2].cents === null && open.dueCents === 40000 && open.openFees === true, open);
    const bad = (fn) => { try { fn(); return false; } catch (e) { return true; } };
    check('an unknown kind and an amount that is not a whole number of cents (or is negative) are refused', bad(() => F.orderLines('nosuch')) && bad(() => F.orderLines('bluesky', { passThrough: [{ label: 'x', cents: 10.5 }] })) && bad(() => F.orderLines('bluesky', { passThrough: [{ label: 'x', cents: -1 }] })) && bad(() => F.orderLines('bluesky', { passThrough: [{ label: 'x', cents: '300' }] })));
    check('no line names a vendor or uses the forbidden word (white label)', L.leakCheck(['formd', 'formd-amendment', 'bluesky', 'bluesky-renewal'].map((k) => F.orderLines(k).lines[0].label).join('\n')).ok, ['formd', 'formd-amendment', 'bluesky', 'bluesky-renewal'].map((k) => F.orderLines(k).lines[0].label));

    const ws = WS([off('o1', 'Rule 506(b)')], [abroad('a')], []);
    const o1 = F.addOrder(ws, { kind: 'formd', offeringId: 'o1', by: 'Ann Lee' });
    check('addOrder records the order: status recorded, when, by whom, its lines and $100 due, no package', !!o1 && o1.status === 'recorded' && o1.kind === 'formd' && o1.offeringId === 'o1' && o1.by === 'Ann Lee' && /^\d{4}-\d{2}-\d{2}T[\d:]+Z$/.test(o1.at) && o1.dueCents === 10000 && o1.openFees === false && o1.lines.length === 1 && o1.package === null && ws.filings.orders.length === 1 && ws.filings.orders[0] === o1, o1);
    check('and writes one entry to the change log', calls.length === 1 && calls[0].record === o1.id && calls[0].fund === 'o1' && /\$100/.test(calls[0].detail) && !!calls[0].action, calls);
    const pack = { states: ['NY', 'CA'], issuer: { name: 'Fund o1' } };
    const o2 = F.addOrder(ws, { kind: 'bluesky', offeringId: 'o1', by: 'Ann Lee', passThrough: [{ label: 'New York fee', cents: 30000, state: 'NY' }, { label: 'California fee', cents: null, state: 'CA' }], package: pack });
    const o3 = F.addOrder(ws, { kind: 'formd-amendment', offeringId: 'o1', by: 'Ann Lee' });
    check('a state notice order keeps its package (a copy) and says fees are open; $400 due so far', !!o2 && J(o2.package) === J(pack) && o2.package !== pack && o2.openFees === true && o2.dueCents === 40000 && /confirm/i.test(calls[1].detail), o2);
    check('every order has its own id (three recorded in the same instant)', new Set([o1.id, o2.id, o3.id]).size === 3 && calls.length === 3, [o1.id, o2.id, o3.id]);
    check('an order for an unknown offering or of an unknown kind is not recorded', F.addOrder(ws, { kind: 'formd', offeringId: 'nosuch', by: 'Ann' }) === null && bad(() => F.addOrder(ws, { kind: 'nosuch', offeringId: 'o1', by: 'Ann' })) && ws.filings.orders.length === 3 && calls.length === 3);
    check('cancelOrder cancels a recorded order', F.cancelOrder(ws, o3.id) === true && o3.status === 'cancelled' && calls.length === 4 && calls[3].record === o3.id);
    o2.status = 'received';
    check('and only a recorded one: not a received order, not one already cancelled, not an unknown id', F.cancelOrder(ws, o2.id) === false && o2.status === 'received' && F.cancelOrder(ws, o3.id) === false && F.cancelOrder(ws, 'nosuch') === false && calls.length === 4);
    // With no change log loaded (the server, a check) the order is still recorded.
    const F2 = load().filings;
    const w2 = WS([off('o1', 'Rule 506(c)')], [], []);
    check('with no change log loaded the order is recorded all the same', !!F2.addOrder(w2, { kind: 'bluesky-renewal', offeringId: 'o1', by: 'Ann' }) && w2.filings.orders[0].dueCents === 5000);
    const N = require(path.join(L.ROOT, 'assets/js/filings.js'));
    check('under Node the module gives the same prices and lines (the server reads them)', J(N.PRICES) === J(F.PRICES) && J(N.orderLines('bluesky', { passThrough: three })) === J(b3));
  },

  selfcheck({ check }) {
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const u = run(['--case', 'nosuchcase']);
    check('an unknown --case name exits 1 with FAIL', u.status === 1 && /^FAIL /m.test(u.stdout) && /^FILINGS MATH: FAIL \(cases run: 0\)/m.test(u.stdout), { status: u.status, out: u.stdout.slice(-300) });
    const e = run(['--case', '']);
    check('an empty case list exits 1 with FAIL', e.status === 1 && /^FAIL /m.test(e.stdout) && /^FILINGS MATH: FAIL \(cases run: 0\)/m.test(e.stdout), { status: e.status, out: e.stdout.slice(-300) });
    const e2 = run(['--case', ' , ']);
    check('a case list of blanks exits 1 with FAIL', e2.status === 1, { status: e2.status, out: e2.stdout.slice(-300) });
    const src = fs.readFileSync(__filename, 'utf8').split('\n');
    check('the gate markers are the first two lines, and the second gives the last line of a full run', src[0] === '// gate: node' && src[1] === `// last "FILINGS MATH: PASS (cases run: ${Object.keys(cases).length})"`, src.slice(0, 2));
  }
};

// T-09-01: after every case, no workspace it built holds a key that could carry a secret.
Object.keys(cases).forEach((name) => {
  const fn = cases[name];
  cases[name] = async (ctx) => {
    BUILT.length = 0;
    await fn(ctx);
    const bad = BUILT.reduce((a, w) => a.concat(secretKeys(w.filings)), []);
    if (BUILT.length) ctx.check(`the record holds no key named ccc, token or secret (${BUILT.length} workspaces)`, bad.length === 0, bad);
  };
});

L.runParts(cases, { name: 'FILINGS MATH', unit: 'cases', flag: '--case', browser: false });
