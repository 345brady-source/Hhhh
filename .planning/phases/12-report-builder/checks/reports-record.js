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
  },

  refuse: ({ check }) => {
    const NS = load();
    const R = NS.reportRecord;
    const ws = fundA();
    const docs0 = ws.docs.length;
    const { run } = generated(NS, ws, [['FA-1001'], ['FA-1002']]);
    check('deliver with no person is refused', thrown(() => R.deliver(ws, run.id, { at: AT })) === 'The person delivering must be named.', thrown(() => R.deliver(ws, run.id, { at: AT })));
    check('deliver with a blank person is refused', thrown(() => R.deliver(ws, run.id, { by: '   ', at: AT })) === 'The person delivering must be named.');
    const g = R.newRun(ws, { template: template(), title: 'Quarterly report', period: PERIOD, audience: { kind: 'fund', offeringId: 'fund-a' }, spec: {}, by: BY, at: '2027-01-20T14:00:00.000Z' });
    const s = bytesFor(NS, 9);
    R.addFile(ws, g.id, { investorIds: ['FA-1001'], offeringId: 'fund-a', name: 'a.pdf', size: s.size, sha256: s.sha256, pages: 1 });
    check("deliver of a run still 'generating' is refused", thrown(() => R.deliver(ws, g.id, { by: BY, at: AT })) === 'Only a generated report can be delivered.', thrown(() => R.deliver(ws, g.id, { by: BY, at: AT })));
    check('addFile with size 0 is refused', /size/i.test(thrown(() => R.addFile(ws, g.id, { investorIds: ['FA-1001'], offeringId: 'fund-a', name: 'b.pdf', size: 0, sha256: s.sha256, pages: 1 }))));
    check('addFile with a 63-character hash is refused', /SHA-256/.test(thrown(() => R.addFile(ws, g.id, { investorIds: ['FA-1001'], offeringId: 'fund-a', name: 'b.pdf', size: s.size, sha256: s.sha256.slice(1), pages: 1 }))));
    check('addFile with no investor is refused', /investor/i.test(thrown(() => R.addFile(ws, g.id, { investorIds: [], offeringId: 'fund-a', name: 'b.pdf', size: s.size, sha256: s.sha256, pages: 1 }))));
    check('the refused files were not added', R.runOf(ws, g.id).files.length === 1, R.runOf(ws, g.id).files.length);
    const x = R.newRun(ws, { template: template(), title: 'Quarterly report', period: PERIOD, audience: { kind: 'fund', offeringId: 'fund-a' }, spec: {}, by: BY, at: '2027-01-20T14:10:00.000Z' });
    R.addFile(ws, x.id, { investorIds: ['FA-1001'], offeringId: 'fund-a', name: 'c.pdf', size: s.size, sha256: s.sha256, pages: 1 });
    R.addFile(ws, x.id, { investorIds: ['FA-9999'], offeringId: 'fund-a', name: 'd.pdf', size: s.size, sha256: s.sha256, pages: 1 });
    R.finish(ws, x.id, { by: BY, at: '2027-01-20T14:20:00.000Z' });
    check('a file whose investor is not in the workspace is refused', /FA-9999.*not in this workspace/.test(thrown(() => R.deliver(ws, x.id, { by: BY, at: AT }))), thrown(() => R.deliver(ws, x.id, { by: BY, at: AT })));
    check('nothing was written to ws.docs by a refusal', ws.docs.length === docs0 && !R.runOf(ws, x.id).delivered && !R.runOf(ws, run.id).delivered, ws.docs.length);
    R.deliver(ws, run.id, { by: BY, at: AT });
    const n = ws.docs.length;
    check('a second deliver of the same run is refused', thrown(() => R.deliver(ws, run.id, { by: BY, at: AT })) === 'This report has already been delivered.', thrown(() => R.deliver(ws, run.id, { by: BY, at: AT })));
    check('the second deliver wrote nothing', ws.docs.length === n, ws.docs.length);
    const st = R.newRun(ws, { template: template(), title: 'Quarterly report', period: PERIOD, audience: { kind: 'fund', offeringId: 'fund-a' }, spec: {}, by: BY, at: '2027-01-20T16:00:00.000Z' });
    R.finish(ws, st.id, { by: BY, at: '2027-01-20T16:01:00.000Z', stopped: true });
    check("a stopped run is logged 'Report generation stopped' and cannot be delivered", lastActions(ws, 1)[0] === 'Report generation stopped' && R.runOf(ws, st.id).state === 'stopped' && thrown(() => R.deliver(ws, st.id, { by: BY, at: AT })) === 'Only a generated report can be delivered.');
    check('the change log verifies', NS.audit.verify(ws).ok === true, NS.audit.verify(ws));
  },

  paper: ({ check }) => {
    const NS = load();
    const R = NS.reportRecord;
    const ws = fundA();
    inv(ws, 'FA-1001').esignConsent = { at: '2026-01-05T10:00:00Z', scope: 'Electronic records and signatures (ESIGN Act, UETA) and electronic delivery' };
    const two = inv(ws, 'FA-1002');
    delete two.esignConsent;
    two.taxDelivery = { consented: true, at: '2026-01-05T10:00:00Z' }; // the tax documents consent never counts here
    two.address = '12 Elm Street, Springfield, IL 62701';
    check('edelivery: the general consent with electronic delivery counts', R.edelivery(inv(ws, 'FA-1001')) === true);
    check('edelivery: records and signatures only, or the tax consent alone, do not', R.edelivery({ esignConsent: { scope: 'Electronic records and signatures (ESIGN Act, UETA)' } }) === false && R.edelivery(two) === false);
    const { run } = generated(NS, ws, [['FA-1001'], ['FA-1002']]);
    const out = R.deliver(ws, run.id, { by: BY, at: AT });
    check("deliver returns paper ['FA-1002']", J(out.paper) === J(['FA-1002']), out.paper);
    const f2 = run.files[1];
    check("FA-1002's doc is in its Documents all the same (C-01)", J(NS.ops.docsFor(ws, two).map((d) => d.id)) === J([f2.id]));
    check("the delivery entry counts one listed for paper", /1 listed for paper/.test(ws.audit[ws.audit.length - 1].detail), ws.audit[ws.audit.length - 1].detail);
    const list = R.paperList(ws, run.id);
    check("paperList gives FA-1002's name, address and file id, not yet sent", J(list) === J([{ investorId: 'FA-1002', name: 'Investor Two', address: '12 Elm Street, Springfield, IL 62701', fileId: f2.id, sentOn: '', sentBy: '' }]), list);
    const n = ws.audit.length;
    check('markPaper with a date not YYYY-MM-DD is refused', /date/i.test(thrown(() => R.markPaper(ws, run.id, 'FA-1002', { sentOn: '01/21/2027', by: BY }))));
    check('markPaper with no person is refused', /named/i.test(thrown(() => R.markPaper(ws, run.id, 'FA-1002', { sentOn: '2027-01-21' }))));
    check('markPaper for FA-1001 (consent on record) is refused', /paper list/i.test(thrown(() => R.markPaper(ws, run.id, 'FA-1001', { sentOn: '2027-01-21', by: BY }))));
    check('the refusals logged nothing', ws.audit.length === n);
    const d = R.markPaper(ws, run.id, 'FA-1002', { sentOn: '2027-01-21', by: BY, at: '2027-01-21T09:00:00.000Z' });
    check('markPaper records the date and the person on the doc', d.id === f2.id && J(d.report.paper) === J({ 'FA-1002': { sentOn: '2027-01-21', by: BY } }), d.report);
    const last = ws.audit[ws.audit.length - 1];
    check("log 'Report sent on paper' by the person", last.action === 'Report sent on paper' && last.actor === BY && last.record === f2.id && /2027-01-21/.test(last.detail), last);
    check('paperList now shows it sent', R.paperList(ws, run.id)[0].sentOn === '2027-01-21' && R.paperList(ws, run.id)[0].sentBy === BY);
    check('the change log verifies', NS.audit.verify(ws).ok === true);
    check('no vendor name and never the forbidden word in the log', cleanLog(ws).length === 0, cleanLog(ws));
  },

  opens: ({ check }) => {
    const NS = load();
    const R = NS.reportRecord;
    const ws = fundA();
    const { run } = generated(NS, ws, [['FA-1001'], ['FA-1002']]);
    R.deliver(ws, run.id, { by: BY, at: AT });
    const id = run.files[0].id;
    R.opened(ws, id, 'FA-1001', '2027-01-21T08:00:00.000Z');
    const d = R.opened(ws, id, 'FA-1001', '2027-01-22T09:30:00.000Z');
    check('two opens by FA-1001: count 2 with first and last', J(d.report.opens['FA-1001']) === J({ first: '2027-01-21T08:00:00.000Z', last: '2027-01-22T09:30:00.000Z', count: 2 }), d.report.opens);
    const last = ws.audit[ws.audit.length - 1];
    check("log 'Report opened' with actor 'Investor One (investor)'", last.action === 'Report opened' && last.actor === 'Investor One (investor)' && last.record === id, last);
    const n = ws.audit.length;
    R.opened(ws, id, 'FA-1002', '2027-01-22T10:00:00.000Z');
    check("an open by FA-1002 on FA-1001's doc changes nothing", J(d.report.opens) === J({ 'FA-1001': { first: '2027-01-21T08:00:00.000Z', last: '2027-01-22T09:30:00.000Z', count: 2 } }) && ws.audit.length === n, d.report.opens);
    R.opened(ws, 'no-such-doc', 'FA-1001', '2027-01-22T10:00:00.000Z');
    check('an open of an unknown doc changes nothing', ws.audit.length === n);
    R.withdraw(ws, id, { by: BY, why: 'Figures corrected', at: '2027-01-23T10:00:00.000Z' });
    const m = ws.audit.length;
    R.opened(ws, id, 'FA-1001', '2027-01-24T10:00:00.000Z');
    check('an open of a withdrawn doc changes nothing', d.report.opens['FA-1001'].count === 2 && ws.audit.length === m, d.report.opens);
    check('opensOf counts one investor, two opens', J(R.opensOf(d)) === J({ investors: 1, count: 2 }), R.opensOf(d));
    check('the change log verifies', NS.audit.verify(ws).ok === true);
  },

  withdraw: ({ check }) => {
    const NS = load();
    const R = NS.reportRecord;
    const ws = fundA();
    const { run } = generated(NS, ws, [['FA-1001'], ['FA-1002']]);
    R.deliver(ws, run.id, { by: BY, at: AT });
    const id = run.files[0].id;
    R.opened(ws, id, 'FA-1001', '2027-01-21T08:00:00.000Z');
    const n = ws.audit.length;
    check('withdraw with no person is refused', /named/i.test(thrown(() => R.withdraw(ws, id, { why: 'Wrong figures' }))));
    check('withdraw with a blank reason is refused', /why/i.test(thrown(() => R.withdraw(ws, id, { by: BY, why: '   ' }))));
    check('the refusals changed nothing', ws.audit.length === n && R.opensOf(ws.docs.find((x) => x.id === id)).count === 1 && ws.docs.find((x) => x.id === id).hidden === false);
    const d = R.withdraw(ws, id, { by: BY, why: 'Wrong figures', at: '2027-01-22T10:00:00.000Z' });
    check("withdrawn: hidden, state 'withdrawn', with who, when and why", d.hidden === true && d.report.state === 'withdrawn' && J(d.report.withdrawn) === J({ at: '2027-01-22T10:00:00.000Z', by: BY, why: 'Wrong figures' }), d);
    check('its opens are kept', d.report.opens['FA-1001'] && d.report.opens['FA-1001'].count === 1, d.report.opens);
    const last = ws.audit[ws.audit.length - 1];
    check("log 'Report withdrawn' with the reason and the opens so far", last.action === 'Report withdrawn' && last.actor === BY && /Wrong figures/.test(last.detail) && /opened 1 time/.test(last.detail), last);
    check('NS.ops.docsFor no longer lists it', NS.ops.docsFor(ws, inv(ws, 'FA-1001')).length === 0);
    check("FA-1002's doc is untouched", NS.ops.docsFor(ws, inv(ws, 'FA-1002')).length === 1);
    check('a withdrawn doc cannot be withdrawn again', /cannot be withdrawn/i.test(thrown(() => R.withdraw(ws, id, { by: BY, why: 'Again' }))));
    ws.docs.push({ id: 'tax-1', title: 'K-1', cat: 'Tax', audience: 'investors', investors: ['FA-1002'], hidden: false, tax: { state: 'delivered' } });
    check('a document that is not a report cannot be withdrawn here', /cannot be withdrawn/i.test(thrown(() => R.withdraw(ws, 'tax-1', { by: BY, why: 'x' }))));
    check('the change log verifies', NS.audit.verify(ws).ok === true);
  },

  replace: ({ check }) => {
    const NS = load();
    const R = NS.reportRecord;
    const ws = fundA();
    const first = generated(NS, ws, [['FA-1001'], ['FA-1002']], { at: '2027-01-20T10:00:00.000Z' }).run;
    R.deliver(ws, first.id, { by: BY, at: '2027-01-20T11:00:00.000Z' });
    const old = first.files[0].id;
    const second = generated(NS, ws, [['FA-1001']], { at: '2027-01-21T10:00:00.000Z', seed: 5, title: 'Quarterly report (corrected)' }).run;
    const before = ws.audit.length;
    R.deliver(ws, second.id, { by: BY, at: '2027-01-21T11:00:00.000Z', replaces: { 'FA-1001': old } });
    const o = ws.docs.find((d) => d.id === old);
    const nw = ws.docs.find((d) => d.id === second.files[0].id);
    check("the first is marked 'replaced' with replacedBy", o.report.state === 'replaced' && o.report.replacedBy === nw.id, o.report);
    check('the new one names the one it replaces', nw.report.replaces === old && nw.report.state === 'delivered', nw.report);
    const own = NS.ops.docsFor(ws, inv(ws, 'FA-1001')).map((d) => d.id).sort();
    check("both stay in FA-1001's Documents", J(own) === J([old, nw.id].sort()), own);
    const added = ws.audit.slice(before).map((e) => e.action);
    check("one 'Report replaced' entry, then 'Report delivered'", J(added) === J(['Report replaced', 'Report delivered']), added);
    const third = generated(NS, ws, [['FA-1002']], { at: '2027-01-22T10:00:00.000Z', seed: 7 }).run;
    const docs = ws.docs.length;
    check("replacing a doc of another investor is refused", thrown(() => R.deliver(ws, third.id, { by: BY, at: AT, replaces: { 'FA-1002': nw.id } })) === 'The report it replaces must be one this investor has now.');
    check('replacing a doc already replaced is refused', thrown(() => R.deliver(ws, third.id, { by: BY, at: AT, replaces: { 'FA-1001': old } })) === 'The report it replaces must be one this investor has now.');
    check('the refusals wrote nothing', ws.docs.length === docs && !R.runOf(ws, third.id).delivered && nw.report.state === 'delivered');
    check('the change log verifies', NS.audit.verify(ws).ok === true);
  },

  letter: ({ check }) => {
    const NS = load();
    const R = NS.reportRecord;
    const ws = fundA();
    const { run } = generated(NS, ws, [['FA-1001', 'FA-1002']], { title: 'Letter to investors', audience: { kind: 'letter', offeringIds: ['fund-a'], statements: false } });
    const out = R.deliver(ws, run.id, { by: BY, at: AT });
    check('one doc listing both investors', out.docs.length === 1 && J(out.docs[0].investors) === J(['FA-1001', 'FA-1002']), out.docs);
    const id = out.docs[0].id;
    check("it is in both investors' Documents", NS.ops.docsFor(ws, inv(ws, 'FA-1001')).some((d) => d.id === id) && NS.ops.docsFor(ws, inv(ws, 'FA-1002')).some((d) => d.id === id));
    R.opened(ws, id, 'FA-1001', '2027-01-21T08:00:00.000Z');
    R.opened(ws, id, 'FA-1002', '2027-01-21T09:00:00.000Z');
    const d = R.opened(ws, id, 'FA-1001', '2027-01-21T10:00:00.000Z');
    check('opens are counted separately per investor', d.report.opens['FA-1001'].count === 2 && d.report.opens['FA-1002'].count === 1 && d.report.opens['FA-1002'].first === '2027-01-21T09:00:00.000Z', d.report.opens);
    check('opensOf gives { investors: 2, count: 3 }', J(R.opensOf(d)) === J({ investors: 2, count: 3 }), R.opensOf(d));
    check("the open entry names the investor who opened", ws.audit[ws.audit.length - 1].actor === 'Investor One (investor)' && ws.audit[ws.audit.length - 2].actor === 'Investor Two (investor)');
    check('the change log verifies', NS.audit.verify(ws).ok === true);
  },

  notice: ({ check }) => {
    const NS = load();
    const R = NS.reportRecord;
    const ws = fundA();
    const src = fs.readFileSync(path.join(CHECKOUT, 'assets/js/console.js'), 'utf8');
    const m = src.match(/ui\.notice = \{([^}]*)\}/);
    const keys = m ? m[1].split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean) : [];
    check("the Notices page's draft literal is found in console.js", keys.length >= 10, keys);
    const { run } = generated(NS, ws, [['FA-1001'], ['FA-1002']]);
    check('a run not delivered is refused', /not been delivered|delivered/i.test(thrown(() => R.noticeDraft(ws, run.id))), thrown(() => R.noticeDraft(ws, run.id)));
    R.deliver(ws, run.id, { by: BY, at: AT });
    const n = R.noticeDraft(ws, run.id);
    check("the draft has exactly the keys of console.js's noticeDraft", J(Object.keys(n).sort()) === J(keys.slice().sort()), { got: Object.keys(n), want: keys });
    check("kind 'quarterly', audience 'all', quarter 'Q4 2026', the delivered investors", n.kind === 'quarterly' && n.audience === 'all' && n.quarter === 'Q4 2026' && J(n.investors) === J(['FA-1001', 'FA-1002']), n);
    check('subject and body from the quarterly template; docName the title', n.subject === NS.NOTICE_TEMPLATES.quarterly.subject && n.body === NS.NOTICE_TEMPLATES.quarterly.body && n.docName === 'Quarterly report', n);
    check('nothing is sent: no confirm, nothing edited, no notice written', n.confirm === false && n.subjectEdited === false && n.bodyEdited === false && J(ws.notices) === J(fundA().notices));
    const p = generated(NS, ws, [['FA-1001']], { type: 'performance', title: 'Performance report', template: template('performance', 'Performance'), seed: 3 }).run;
    R.deliver(ws, p.id, { by: BY, at: AT });
    const q = R.noticeDraft(ws, p.id);
    check("a performance run gives kind 'documents' with docName its title", q.kind === 'documents' && q.docName === 'Performance report' && q.subject === NS.NOTICE_TEMPLATES.documents.subject && J(q.investors) === J(['FA-1001']), q);
    // every file of a run withdrawn: no draft at all, never one for every investor (quick task 2026-11-27-report-fixes)
    const w = generated(NS, ws, [['FA-1001'], ['FA-1002']], { seed: 7 }).run;
    R.deliver(ws, w.id, { by: BY, at: AT });
    R.withdraw(ws, w.files[0].id, { by: BY, why: 'Wrong period', at: AT });
    const one = R.noticeDraft(ws, w.id);
    check('one file of two withdrawn: the draft holds only the other investor', J(one.investors) === J(['FA-1002']), one.investors);
    R.withdraw(ws, w.files[1].id, { by: BY, why: 'Wrong period', at: AT });
    const notices = J(ws.notices);
    const all = thrown(() => R.noticeDraft(ws, w.id));
    check("every file withdrawn: refused with 'Every file of this report is withdrawn; there is no one to tell.'", all === 'Every file of this report is withdrawn; there is no one to tell.', all);
    check('and no notice is written', J(ws.notices) === notices);
  },

  archive: ({ check }) => {
    const NS = load();
    const R = NS.reportRecord;
    const ws = fundA();
    ws.reports = { v: 1, templates: [{ id: 'rt-9', name: 'Kept' }] };
    R.ensure(ws);
    check('ensure fills only missing keys', J(ws.reports) === J({ v: 1, templates: [{ id: 'rt-9', name: 'Kept' }], runs: [], splits: {} }), ws.reports);
    const tpl = template('quarterly', 'Before');
    const a = generated(NS, ws, [['FA-1001']], { template: tpl, at: '2027-01-19T10:00:00.000Z' });
    tpl.name = 'After';
    tpl.version = 4;
    tpl.sections.push({ key: 'photos', on: true });
    check('editing the template later never changes the run', a.run.template.name === 'Before' && a.run.template.version === 3 && a.run.template.sections.length === 3, a.run.template);
    check('the run keeps the period, the audience and the spec', J(a.run.period) === J(PERIOD) && a.run.audience.kind === 'fund' && a.run.spec.to === PERIOD.to && a.run.createdBy === BY);
    const b = generated(NS, ws, [['FA-1002']], { at: '2027-01-20T10:00:00.000Z', seed: 4 });
    check('runsOf is newest first', J(R.runsOf(ws).map((r) => r.id)) === J([b.run.id, a.run.id]), R.runsOf(ws).map((r) => r.id));
    const f = a.run.files[0];
    const bytes = a.bytes[f.id];
    check('verifyFile is true for the bytes given', R.verifyFile(ws, a.run.id, f.id, bytes) === true);
    const bad = bytes.slice();
    bad[5] ^= 1;
    check('verifyFile is false for one changed byte', R.verifyFile(ws, a.run.id, f.id, bad) === false);
    check('verifyFile is false for an unknown file', R.verifyFile(ws, a.run.id, 'rf-x', bytes) === false);
    // the browser's file store is shared by every portal in it: a file id names its firm (quick task 2026-11-27-report-fixes)
    check(`file ids carry the firm's id: rf-${ws.tenant.id}-<run>-<file>`, [a, b].every((x) => x.run.files.every((g, k) => g.id === `rf-${ws.tenant.id}-${String(x.run.id).replace(/^rr-/, '')}-${k + 1}`)), [a, b].map((x) => x.run.files.map((g) => g.id)));
    const gen = ws.audit.filter((e) => e.action === 'Report generated');
    check("each run is logged 'Report generated' with the template name and version", gen.length === 2 && /template Before, version 3/.test(gen[0].detail) && /1 file for 1 investor/.test(gen[0].detail), gen.map((e) => e.detail));
    check('the change log verifies', NS.audit.verify(ws).ok === true);
    check('no vendor name and never the forbidden word in the log', cleanLog(ws).length === 0, cleanLog(ws));
  },

  selfcheck: ({ check }) => {
    const me = __filename;
    const env = Object.assign({}, process.env);
    const a = spawnSync(process.execPath, [me, '--case', 'nosuchcase'], { encoding: 'utf8', env });
    check('an unknown --case name exits 1 with a FAIL line', a.status === 1 && /^FAIL /m.test(a.stdout) && /REPORTS RECORD: FAIL/.test(a.stdout), { status: a.status, out: a.stdout });
    const b = spawnSync(process.execPath, [me, '--case', ''], { encoding: 'utf8', env });
    check('an empty --case list exits 1 with a FAIL line', b.status === 1 && /^FAIL /m.test(b.stdout) && /REPORTS RECORD: FAIL/.test(b.stdout), { status: b.status, out: b.stdout });
  }
};

L.runParts(cases, { name: 'REPORTS RECORD', unit: 'cases', flag: '--case' });
