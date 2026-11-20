// gate: node
// last "REPORTS RUN: PASS (cases run: 8)"
// Plan 12-07: batch generation and the archive's file path (assets/js/reports-run.js, NS.reportsRun), no browser. Each
// case loads the portal with lib12.portal (phase 11's load11.js, today 2027-01-20, the self-serve edition, the shipped
// PDF writer and fonts) plus reports-data.js, reports.js, reports-pdf.js, reports-record.js and reports-run.js, so a
// missing or broken module prints a FAIL line. Templates are NS.reports.blank(type, ws) stored with NS.reports.startFrom.
// Files are kept in a stand-in store written here ({ put, get, del } over { type, bytes }, as NS.ops.files keeps them);
// every PDF read back is written into lib12.work('reports-run') (under P6_OUT, removed after it is read and when the
// run ends, pass or fail) and read with pdftotext.
//   node reports-run.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "REPORTS RUN: PASS (cases run: N)" or
// "REPORTS RUN: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('./lib12.js');
const L = require(path.join(T.P6, 'lib.js'));

const BY = 'Pat Admin';
const AT = '2027-01-20T12:00:00.000Z';
const Q4 = { from: '2026-10-01', to: '2026-12-31' };
const J = (x) => JSON.stringify(x);
const EXTRA = ['reports-data.js', 'reports.js', 'reports-pdf.js', 'reports-record.js', 'reports-run.js'];

/** The portal with the report modules: { NS, kit, G }. Node's Blob is given to the sandbox, as a browser has one. */
function load() {
  const P = T.portal({ today: '2027-01-20', extra: EXTRA });
  if (!P.G.Blob) P.G.Blob = Blob;
  if (!P.NS.reportsRun || typeof P.NS.reportsRun.generate !== 'function') throw new Error('assets/js/reports-run.js did not define NS.reportsRun.generate');
  return P;
}

/** A stand-in for NS.ops.files: put keeps { type, bytes } read from the Blob; get gives a Blob or undefined. */
function makeStore() {
  const m = new Map();
  return {
    m,
    put: async (id, blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      m.set(id, { type: blob.type, bytes });
    },
    get: async (id) => (m.has(id) ? new Blob([m.get(id).bytes], { type: m.get(id).type }) : undefined),
    del: async (id) => {
      m.delete(id);
    }
  };
}

let seq = 0;
/** pdftotext's text of the kept bytes; the PDF written for it is removed at once. */
function textOf(bytes) {
  const file = T.save(T.work('reports-run'), `run-${process.pid}-${++seq}.pdf`, bytes);
  try {
    return T.text(file);
  } finally {
    fs.rmSync(file, { force: true });
  }
}
const flat = (s) => String(s).replace(/\s+/g, ' ');
const holds = (text, s) => flat(text).indexOf(flat(s)) >= 0;
const lastAction = (ws) => (ws.audit && ws.audit.length ? ws.audit[ws.audit.length - 1].action : '');
/** A stored blank template of the type. */
const blankTemplate = (NS, ws, type) => NS.reports.startFrom(ws, type || 'quarterly', { by: BY, at: '2027-01-19T09:00:00.000Z' });

const cases = {
  'fund-a': async ({ check }) => {
    const { NS, kit } = load();
    const { ws } = T.fundA(NS);
    const store = makeStore();
    const t = blankTemplate(NS, ws, 'quarterly');
    const spec = { from: Q4.from, to: Q4.to, audience: { kind: 'fund', offeringId: 'fund-a' } };
    const run = await NS.reportsRun.generate(ws, t, spec, { by: BY, at: AT, kit, store });
    check("the run is 'generated' with two files", run && run.state === 'generated' && run.files.length === 2, run && { state: run.state, files: run.files.length });
    if (!run || !run.files || run.files.length !== 2) return;
    check('the run is the one recorded in the workspace', NS.reportRecord.runOf(ws, run.id) === run || J(NS.reportRecord.runOf(ws, run.id)) === J(run));
    check('the files are for FA-1001 then FA-1002, each in fund A', J(run.files.map((f) => f.investorIds)) === J([['FA-1001'], ['FA-1002']]) && run.files.every((f) => f.offeringId === 'fund-a'), run.files);
    run.files.forEach((f) => {
      const kept = store.m.get(f.id);
      check(`${f.investorIds[0]}: its bytes are kept in the store as a PDF`, !!kept && kept.type === 'application/pdf' && kept.bytes.length === f.size, kept && { type: kept.type, len: kept.bytes.length, size: f.size });
      if (kept) check(`${f.investorIds[0]}: SHA-256 of the kept bytes equals the record`, NS.audit.sha256(kept.bytes) === f.sha256, f.sha256);
      check(`${f.investorIds[0]}: a file name with the investor id ending .pdf, pages counted`, /\.pdf$/.test(f.name) && f.name.indexOf(f.investorIds[0]) >= 0 && f.pages > 0, f.name);
    });
    const one = store.m.get(run.files[0].id);
    const two = store.m.get(run.files[1].id);
    const t1 = one ? textOf(one.bytes) : '';
    const t2 = two ? textOf(two.bytes) : '';
    check("FA-1001's file holds $345,000.00 and 'Investor One' and not 'Investor Two'", holds(t1, '$345,000.00') && holds(t1, 'Investor One') && !holds(t1, 'Investor Two'), t1.slice(0, 400));
    check("FA-1002's file holds $172,500.00 and 'Investor Two' and not 'Investor One'", holds(t2, '$172,500.00') && holds(t2, 'Investor Two') && !holds(t2, 'Investor One'), t2.slice(0, 400));
    check("the change log's last entry is 'Report generated'", lastAction(ws) === 'Report generated', lastAction(ws));
    check('the change log verifies', NS.audit.verify(ws).ok === true);
    const words = run.files.map((f) => f.name).join(' ') + ' ' + t1 + ' ' + t2;
    check('no vendor name and never the forbidden word in the files or their names', !L.WORD_RE.test(words) && T.leak(words).ok, T.leak(words).hits);
  }
};

L.runParts(cases, { name: 'REPORTS RUN', unit: 'cases', flag: '--case' });
