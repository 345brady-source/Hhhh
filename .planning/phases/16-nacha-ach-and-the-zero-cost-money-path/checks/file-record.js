// gate: node
// last "FILE RECORD: PASS (cases run: 1)"
// The record of every payment file the console lets out (plan 16-02, AC-02, AC-06; F-4, F-7, F-8; C-02, C-05), no
// browser. NS.achRecord (assets/js/achrecord.js) is loaded with the portal's own scripts (phase 11's load11.js through
// lib16, edition 'diy', today 2026-11-19; achrecord.js is in diy.html's range from its script line after nacha.js).
//   node file-record.js [--case record]
// Fixture files are built by the portal's own builder and use only the never-issued routing numbers 190000017,
// 190000020 (receiving banks) and 190000091 (originating bank), with account numbers starting 99 (lib16 account()).
// No file's text, and no full account number, is printed: only labels, sentences, ids and last fours.
// One PASS or FAIL line per check; the last line is "FILE RECORD: PASS (cases run: N)" or
// "FILE RECORD: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('./lib16.js');

const NAME = 'FILE RECORD';
const TODAY = '2026-11-19';
const NOW = new Date(2026, 10, 19, 10, 0);
const EFFECTIVE = '2026-11-20';
const RDFI = ['190000017', '190000020'];
const ODFI = '190000091';
const ORIGIN = '1990000001';
/** The tenant fields the record is keyed on (immediate origin, immediate destination). */
const TENANT = { ach: { immediateOrigin: ORIGIN, destinationRouting: ODFI, odfiRouting: ODFI } };
const longDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** The portal in a fresh context with the Kestrel Bay sample workspace. */
function portal(edition) {
  const NS = L.loadPortal(undefined, { today: TODAY, edition: edition || 'diy' });
  const ws = L.sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
  if (!ws) throw new Error('the Kestrel Bay sample did not load');
  return { NS, ws };
}
/** A two-entry PPD file for two of the sample's investors, with the console's filename and modifier set on it. */
function twoEntryFile(NS, ws, opts) {
  const o = opts || {};
  const inv = ws.investors.slice(0, 2);
  const modifier = o.modifier || 'A';
  const f = NS.nacha.build({
    origin: { destinationRouting: ODFI, destinationName: 'CHECK ORIGIN BANK', immediateOrigin: o.origin || ORIGIN, originName: 'CHECK FUND LLC', odfiRouting: ODFI },
    company: { name: 'CHECK FUND LLC', id: '1990000001' },
    entries: [
      { name: 'Ada Check', id: inv[0].id, routing: RDFI[0], account: L.account(1), accountType: 'checking', cents: 125000, sec: 'PPD' },
      { name: 'Ben Check', id: inv[1].id, routing: RDFI[1], account: L.account(2), accountType: 'savings', cents: 98000, sec: 'PPD' }
    ],
    effectiveDate: o.effective || EFFECTIVE,
    description: 'DISTRIB',
    modifier,
    balanced: !!o.balanced,
    offset: o.balanced ? { routing: ODFI, account: L.account(9), type: 'checking' } : undefined,
    now: o.now || NOW
  });
  f.filename = `CHECK_FUND_LLC_${(o.effective || EFFECTIVE).replace(/-/g, '')}_${modifier}.ach`;
  f.modifier = modifier;
  return { f, inv };
}
/** What recordFile is given beside the file. */
function meta(over) {
  return Object.assign({ for: 'distribution', runId: '', offeringId: 'kb-fund-ii', effective: EFFECTIVE, how: 'download', by: 'Pat Admin', at: '2026-11-19T15:00:00.000Z', again: null, tenant: TENANT, refs: {} }, over || {});
}
/** The sentence an Error carries, or '' when fn does not throw. */
function thrown(fn) {
  try {
    fn();
    return '';
  } catch (e) {
    return String((e && e.message) || e);
  }
}
/** No full fixture account number in str (the last four may be there). */
const noAccounts = (str) => [1, 2, 9].every((n) => String(str).indexOf(L.account(n)) < 0);

const parts = {
  // A downloaded file's record: per entry the investor, trace, cents, code, kind and last four, never a full account
  // number or the file's text; sentFor finds it on its run; a second file for that run without a reason is refused.
  async record({ check }) {
    const { NS, ws } = portal();
    const R = NS.achRecord;
    check('NS.achRecord is loaded with the portal', !!R && ['ensure', 'keyOf', 'modifierFor', 'targetOf', 'sentFor', 'filesOf', 'recordFile', 'attach', 'canPay'].every((k) => typeof R[k] === 'function'), R && Object.keys(R));
    const { f, inv } = twoEntryFile(NS, ws, { balanced: true });
    check('the fixture file has no red check', f.blocked.length === 0, f.blocked.map((c) => c.label));
    const run = NS.data.recordRun(ws, { offeringId: 'kb-fund-ii', date: EFFECTIVE, type: 'Distribution', total: 223000 }, { by: 'Pat Admin', today: TODAY });
    // 16-CONTEXT wave 1 B4: a recorded run with no file record is treated as already paid; its first file needs a reason
    const b4 = thrown(() => R.recordFile(ws, f, meta({ runId: run.id })));
    check('B4: a recorded run with no file record is refused a file without a reason', /^This distribution is recorded as paid on /.test(b4) && /Build again/.test(b4), b4);
    check('B4: and nothing is stored', R.ensure(ws).length === 0, R.ensure(ws).length);
    // the file downloaded for the draft, then attached to the run when it is recorded
    const rec = R.recordFile(ws, f, meta());
    check('the record is kept in ws.achLog with kind file', ws.achLog.length === 1 && ws.achLog[0] === rec && rec.kind === 'file' && /^af-\d+$/.test(rec.id), rec && { id: rec.id, kind: rec.kind });
    check('the record names the file, its date, time and file ID from the header, how and by whom', rec.name === f.filename && rec.date === TODAY && rec.time === '1000' && rec.modifier === 'A' && rec.how === 'download' && rec.by === 'Pat Admin' && rec.at === '2026-11-19T15:00:00.000Z', { name: rec.name, date: rec.date, time: rec.time, modifier: rec.modifier, how: rec.how, by: rec.by });
    check('the record holds the origin and destination of the header', rec.origin === ORIGIN && rec.destination === ODFI, { origin: rec.origin && rec.origin.slice(-4), destination: rec.destination && rec.destination.slice(-4) });
    const want = [
      { investorId: inv[0].id, cents: 125000, code: '22', kind: 'credit', last4: L.account(1).slice(-4) },
      { investorId: inv[1].id, cents: 98000, code: '32', kind: 'credit', last4: L.account(2).slice(-4) }
    ];
    const got = (rec.entries || []).map((e) => ({ investorId: e.investorId, cents: e.cents, code: e.code, kind: e.kind, last4: e.last4 }));
    check('each investor entry is recorded with its investor id, cents, code, kind and last four; the offset entry is not', JSON.stringify(got) === JSON.stringify(want), got);
    check('each entry carries the 15-digit trace the file gave it', (rec.entries || []).length === 2 && rec.entries.every((e, i) => /^\d{15}$/.test(e.trace) && e.trace === f.entries[i].trace), (rec.entries || []).map((e) => e.trace));
    check('the record keeps exactly the keys of the interface for an entry', (rec.entries || []).every((e) => JSON.stringify(Object.keys(e).sort()) === JSON.stringify(['cents', 'code', 'investorId', 'kind', 'last4', 'trace'])), (rec.entries || []).map((e) => Object.keys(e)));
    check('the record credits 223,000 cents', rec.credit === 223000, rec.credit);
    const json = JSON.stringify(ws.achLog);
    check('ws.achLog holds neither fixture account number in full, nor the settlement account', noAccounts(json));
    check("ws.achLog does not hold the file's text (no 94-character record)", json.indexOf(f.lines[0]) < 0 && json.indexOf(f.lines[2]) < 0 && !/"text"/.test(json));
    check('the record is kept by offering and payment date with no run', rec.runId === '' && rec.draftKey === `kb-fund-ii|${EFFECTIVE}`, { runId: rec.runId, draftKey: rec.draftKey });
    R.attach(ws, rec.id, run.id);
    check('attach puts the record on the run', rec.runId === run.id, rec.runId);
    check('sentFor({ runId }) returns the record', R.sentFor(ws, { runId: run.id }) === rec);
    // a second file for the same run without a reason
    const g = twoEntryFile(NS, ws, { modifier: 'B' }).f;
    const n = ws.achLog.length;
    const again = thrown(() => R.recordFile(ws, g, meta({ runId: run.id })));
    check('a second file for that run without a reason is refused with the sentence', again === `A file for this distribution was already sent on ${longDay(TODAY)} (${f.filename}). Use "Build again" and give the reason.`, again);
    check('and nothing more is stored', ws.achLog.length === n, ws.achLog.length);
  }
};

L.runParts(parts, { name: NAME, unit: 'cases', flag: '--case' });
