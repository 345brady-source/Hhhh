// gate: node
// last "NO ONBOARDING: PASS (cases run: 3)"
// An investor record with no onboarding block (an import, an older save) must not stop the books (quick fix
// 2026-11-20, 12-01-deferred-items.md): NS.audit.build and NS.audit.exportPackage for fund A, whose fixture investors
// carry no onboarding block, must not throw, and the investor register shows such an investor as 'Invited', exactly as
// it shows any status other than complete or in progress. Investors that do carry the block keep their labels.
// No browser; the portal is loaded inside each case with load11.js, today 2027-01-20.
//   node no-onboarding.js [--case build,export,labels]
// One PASS or FAIL line per check; the last line is "NO ONBOARDING: PASS (cases run: N)" or
// "NO ONBOARDING: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal } = require('./load11.js');

const TODAY = '2027-01-20';
const ACTOR = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };

function load() {
  const NS = loadPortal(undefined, { today: TODAY, edition: 'diy', extra: ['books.js', 'books-post.js', 'bankfiles.js', 'books-bank.js'] });
  if (!NS.books || typeof NS.books.sync !== 'function') throw new Error('books.js and books-post.js did not load');
  return NS;
}
/** Fund A as the fixture gives it: no investor carries an onboarding block. `edit` may change the records first. */
function fundA(NS, edit) {
  const F = JSON.parse(JSON.stringify(require('./fixtures/fund-a.js')));
  const ws = F.records;
  const oid = F.expect.offeringId;
  if (edit) edit(ws);
  F.entries.forEach((e) => NS.books.post(ws, oid, e, ACTOR));
  return { ws, oid, o: ws.offerings.find((x) => x.id === oid) };
}
/** The register's 'Portal account' cell for each investor id. */
function portalAccounts(B) {
  const s = B.list.find((x) => x.id === 'register');
  if (!s) return null;
  const col = s.cols.findIndex((c) => (c.label || c.name || c.h || c) === 'Portal account');
  const out = {};
  s.rows.forEach((r) => (out[r[0]] = col >= 0 ? r[col] : '(no Portal account column)'));
  return out;
}
const tryRun = (fn) => {
  try {
    return { value: fn(), error: '' };
  } catch (e) {
    return { value: null, error: String((e && e.stack) || e) };
  }
};

const cases = {
  /** NS.audit.build for fund A, no investor with an onboarding block: no throw, both investors shown as 'Invited'. */
  build: ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    check('the fixture investors carry no onboarding block', A.ws.investors.length === 2 && A.ws.investors.every((i) => i.onboarding === undefined), A.ws.investors.map((i) => [i.id, i.onboarding]));
    const r = tryRun(() => NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31'));
    check('NS.audit.build does not throw for investors with no onboarding block', !r.error, r.error);
    const pa = r.value ? portalAccounts(r.value) : null;
    check("the investor register shows each of them as 'Invited' (the same as any status other than complete)", !!pa && Object.keys(pa).length === 2 && Object.values(pa).every((v) => v === 'Invited'), pa);
  },

  /** NS.audit.exportPackage (the zip the CPA receives) for the same fund: no throw, a package with the register. */
  export: ({ check }) => {
    const NS = load();
    const A = fundA(NS);
    const r = tryRun(() => NS.audit.exportPackage(A.ws, A.o, '2026-01-01', '2026-12-31'));
    check('NS.audit.exportPackage does not throw for investors with no onboarding block', !r.error, r.error);
    check('the package holds the investor register and a manifest', !!r.value && r.value.files.some((f) => f.name === '05_Investor_register.csv') && r.value.files.some((f) => f.name === 'MANIFEST.sha256'), r.value && r.value.files);
  },

  /** No other change: complete stays 'Active', in progress 'Onboarding', any other status 'Invited', a missing block 'Invited'. */
  labels: ({ check }) => {
    const NS = load();
    const A = fundA(NS, (ws) => {
      ws.investors[0].onboarding = { status: 'complete', step: 0, invited: '2026-01-05', completed: '2026-01-05', source: 'manual' };
      ws.investors[1].onboarding = { status: 'in_progress', step: 2, invited: '2026-01-05', source: 'manual' };
    });
    const ids = A.ws.investors.map((i) => i.id);
    const r1 = tryRun(() => portalAccounts(NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31')));
    check("complete is 'Active' and in progress is 'Onboarding'", !r1.error && r1.value[ids[0]] === 'Active' && r1.value[ids[1]] === 'Onboarding', r1.error || r1.value);
    A.ws.investors[0].onboarding = { status: 'invited', step: 0, invited: '2026-01-05', source: 'manual' };
    delete A.ws.investors[1].onboarding;
    const r2 = tryRun(() => portalAccounts(NS.audit.build(A.ws, A.o, '2026-01-01', '2026-12-31')));
    check("status 'invited' and a missing block are both 'Invited'", !r2.error && r2.value[ids[0]] === 'Invited' && r2.value[ids[1]] === 'Invited', r2.error || r2.value);
  }
};

L.runParts(cases, { name: 'NO ONBOARDING', unit: 'cases', flag: '--case' });
