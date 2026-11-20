// gate: node
// last "REPORTS RECORD: PASS (cases run: 10)"
// Pure checks for the report delivery record (plan 12-04, no browser): assets/js/reports-record.js (NS.reportRecord)
// loaded with the portal's own scripts through phase 11's loader (load11.js: today 2027-01-20, the self-serve edition,
// extra books.js, books-post.js and reports-record.js), a fresh portal per case, so a missing or broken module prints a
// FAIL line. The workspace is hand-worked fund A's records (phase 11 fixtures/fund-a.js: FA-1001 'Investor One' and
// FA-1002 'Investor Two'); file bytes are short stand-ins hashed with NS.audit.sha256; templates are plain objects of
// plan 12-02's template shape.
//   node reports-record.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "REPORTS RECORD: PASS (cases run: N)" or
// "REPORTS RECORD: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const { loadPortal, CHECKOUT } = require('../../11-fund-accounting-and-cpa-year-end-package/checks/load11.js');

const TODAY = '2027-01-20';
const BY = 'Pat Admin';
const AT = '2027-01-20T15:00:00.000Z';
const PERIOD = { from: '2026-10-01', to: '2026-12-31', label: 'Quarter ended December 31, 2026' };
const J = (x) => JSON.stringify(x);

/** The portal with the delivery record, inside the case. */
function load() {
  const NS = loadPortal(undefined, { today: TODAY, extra: ['books.js', 'books-post.js', 'reports-record.js'] });
  if (!NS.reportRecord || typeof NS.reportRecord.deliver !== 'function') throw new Error('assets/js/reports-record.js did not set NS.reportRecord');
  return NS;
}
/** A fresh copy of fund A's records as the workspace. */
function fundA() {
  const F = JSON.parse(JSON.stringify(require('../../11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-a.js')));
  const ws = F.records;
  if (!Array.isArray(ws.docs)) ws.docs = [];
  return ws;
}
/** A template of plan 12-02's shape. */
function template(type, name) {
  return {
    id: 'rt-1',
    name: name || 'Quarterly letter',
    title: '',
    type: type || 'quarterly',
    scope: { firm: true, offeringIds: [] },
    sections: [
      { key: 'cover', on: true },
      { key: 'letter', on: true, blocks: [{ t: 'p', c: [{ text: 'Dear {first_name},' }] }] },
      { key: 'disclosures', on: true }
    ],
    cover: { style: 'band', accent: '' },
    chart: 'none',
    disclosures: [{ t: 'p', c: [{ text: 'For investors only.' }] }],
    version: 3,
    updatedAt: '2027-01-10T10:00:00.000Z',
    updatedBy: BY
  };
}
/** Stand-in bytes for a file (a short Uint8Array) and its SHA-256. */
function bytesFor(NS, seed) {
  const b = new Uint8Array(32);
  for (let i = 0; i < b.length; i++) b[i] = (seed * 31 + i * 7) & 255;
  return { bytes: b, size: b.length, sha256: NS.audit.sha256(b) };
}
/** A generated run: one file per group of investor ids. */
function generated(NS, ws, groups, opts) {
  const R = NS.reportRecord;
  const o = opts || {};
  const tpl = o.template || template(o.type || 'quarterly');
  const run = R.newRun(ws, { template: tpl, title: o.title || 'Quarterly report', period: o.period || PERIOD, audience: o.audience || { kind: 'fund', offeringId: 'fund-a' }, spec: o.spec || { from: PERIOD.from, to: PERIOD.to }, by: BY, at: o.at || '2027-01-20T14:00:00.000Z' });
  const bytes = {};
  groups.forEach((ids, k) => {
    const s = bytesFor(NS, (o.seed || 1) + k);
    const f = R.addFile(ws, run.id, { investorIds: ids, offeringId: 'fund-a', name: `Quarterly report ${ids.join(' ')}.pdf`, size: s.size, sha256: s.sha256, pages: 2 });
    bytes[f.id] = s.bytes;
  });
  R.finish(ws, run.id, { by: BY, at: o.at || '2027-01-20T14:30:00.000Z' });
  return { run: R.runOf(ws, run.id), bytes, tpl };
}
/** What a call throws: its message, or '' when it does not throw. */
function thrown(fn) {
  try {
    fn();
    return '';
  } catch (e) {
    return String((e && e.message) || e || 'thrown');
  }
}
const inv = (ws, id) => ws.investors.find((i) => i.id === id);
const lastActions = (ws, n) => ws.audit.slice(-n).map((e) => e.action);
/** Every change-log entry this plan writes names no vendor and never the forbidden word. */
function cleanLog(ws) {
  return ws.audit.filter((e) => /^Report /.test(e.action)).filter((e) => L.VENDORS.test(e.action + ' ' + e.detail) || L.VENDOR_RE.test(e.action + ' ' + e.detail) || L.WORD_RE.test(e.action + ' ' + e.detail));
}

const cases = {
  deliver: ({ check }) => {
    const NS = load();
    const R = NS.reportRecord;
    const ws = fundA();
    const { run, bytes } = generated(NS, ws, [['FA-1001'], ['FA-1002']]);
    check('the run is generated with two files', run.state === 'generated' && run.files.length === 2, run);
    const before = ws.docs.length;
    const out = R.deliver(ws, run.id, { by: BY, at: AT });
    check('deliver returns the two docs', out && Array.isArray(out.docs) && out.docs.length === 2, out);
    check('two ws.docs entries are written', ws.docs.length === before + 2, ws.docs.length);
    run.files.forEach((f, k) => {
      const d = ws.docs.find((x) => x.id === f.id);
      const want = k === 0 ? 'FA-1001' : 'FA-1002';
      check(`file ${k + 1}: its doc has the file id`, !!d, f.id);
      if (!d) return;
      check(`file ${k + 1}: cat Reports, audience investors, its one investor, shown`, d.cat === 'Reports' && d.audience === 'investors' && J(d.investors) === J([want]) && d.hidden === false, d);
      check(`file ${k + 1}: published by the person at the time given`, d.publishedBy === BY && d.publishedAt === AT, d);
      check(`file ${k + 1}: size and SHA-256 are the file's`, d.size === f.size && d.sha256 === f.sha256 && d.sha256 === NS.audit.sha256(bytes[f.id]), { d: [d.size, d.sha256], f: [f.size, f.sha256] });
      check(`file ${k + 1}: the 10-06 record shape plus a report block`, d.type === 'application/pdf' && d.fileName === f.name && d.offeringId === 'fund-a' && d.date === PERIOD.to && d.title === 'Quarterly report, Quarter ended December 31, 2026' && d.report && d.report.run === run.id && d.report.state === 'delivered', d);
    });
    const own = NS.ops.docsFor(ws, inv(ws, 'FA-1001'));
    check("FA-1001's Documents list exactly its own doc", J(own.map((d) => d.id)) === J([run.files[0].id]), own.map((d) => d.id));
    const two = NS.ops.docsFor(ws, inv(ws, 'FA-1002'));
    check("FA-1002's Documents list exactly its own doc", J(two.map((d) => d.id)) === J([run.files[1].id]), two.map((d) => d.id));
    check("the change log's last two entries are 'Report generated' and 'Report delivered'", J(lastActions(ws, 2)) === J(['Report generated', 'Report delivered']), lastActions(ws, 2));
    const del = ws.audit[ws.audit.length - 1];
    check('the delivery entry names the person, the fund and the run', del.actor === BY && del.fund === 'fund-a' && del.record === run.id, del);
    check('the change log verifies', NS.audit.verify(ws).ok === true, NS.audit.verify(ws));
    const r2 = R.runOf(ws, run.id);
    check("the run's delivered block names the person and the docs", r2.delivered && r2.delivered.by === BY && r2.delivered.at === AT && J(r2.delivered.docs) === J(run.files.map((f) => f.id)), r2.delivered);
    check('no vendor name and never the forbidden word in the log', cleanLog(ws).length === 0, cleanLog(ws));
  }
};

L.runParts(cases, { name: 'REPORTS RECORD', unit: 'cases', flag: '--case' });
