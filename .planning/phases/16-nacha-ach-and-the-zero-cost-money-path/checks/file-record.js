// gate: node
// last "FILE RECORD: PASS (cases run: 6)"
// The record of every payment file the console lets out (plan 16-02, AC-02, AC-06; F-4, F-7, F-8; C-02, C-05), no
// browser. NS.achRecord (assets/js/achrecord.js) is loaded with the portal's own scripts (phase 11's load11.js through
// lib16, edition 'diy', today 2026-11-19; achrecord.js is in diy.html's range from its script line after nacha.js).
//   node file-record.js [--case record,modifier,draft,again,refuse,canpay]
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
  },

  // C-02: per immediate origin, immediate destination and creation date the files take A..Z then 0..9; the 37th is refused.
  async modifier({ check }) {
    const { NS, ws } = portal();
    const R = NS.achRecord;
    const seq = [];
    let refusedAt = '';
    for (let k = 0; k < 36; k++) {
      const m = R.modifierFor(ws, TENANT, TODAY);
      seq.push(m);
      if (!m) break;
      // pre-note files have no distribution target, so only the file ID rule applies to them
      try {
        R.recordFile(ws, twoEntryFile(NS, ws, { modifier: m }).f, meta({ for: 'prenote' }));
      } catch (e) {
        refusedAt = `${m}: ${e.message}`;
        break;
      }
    }
    check('one origin, destination and date take A..Z then 0..9 in order', seq.join('') === R.MODIFIERS && !refusedAt, { seq: seq.join(''), refusedAt });
    check('with 36 used modifierFor is null', R.modifierFor(ws, TENANT, TODAY) === null);
    const used = thrown(() => R.recordFile(ws, twoEntryFile(NS, ws, { modifier: 'Q' }).f, meta({ for: 'prenote' })));
    check('a file with a used letter is refused with its sentence', used === 'This file ID was used by another file today; build the file again.', used);
    const other = { ach: { immediateOrigin: '1990000002', destinationRouting: ODFI, odfiRouting: ODFI } };
    check('another origin starts at A', R.modifierFor(ws, other, TODAY) === 'A', R.modifierFor(ws, other, TODAY));
    const otherDest = { ach: { immediateOrigin: ORIGIN, destinationRouting: RDFI[0], odfiRouting: ODFI } };
    check('another destination starts at A', R.modifierFor(ws, otherDest, TODAY) === 'A', R.modifierFor(ws, otherDest, TODAY));
    check('another date starts at A', R.modifierFor(ws, TENANT, '2026-11-20') === 'A', R.modifierFor(ws, TENANT, '2026-11-20'));
    // a file of another day: its header date is that day, and its letter is counted there only
    const next = R.recordFile(ws, twoEntryFile(NS, ws, { modifier: 'A', now: new Date(2026, 10, 20, 9, 30) }).f, meta({ for: 'prenote' }));
    check('a file created on 2026-11-20 is recorded on that date', next.date === '2026-11-20' && next.time === '0930', { date: next.date, time: next.time });
    check('and 2026-11-20 then gives B', R.modifierFor(ws, TENANT, '2026-11-20') === 'B', R.modifierFor(ws, TENANT, '2026-11-20'));
    // an entry written before file records existed blocks its letter for every origin and destination of its date
    const fresh = portal().ws;
    fresh.achLog = [{ date: TODAY, modifier: 'A', filename: 'OLD_20261119_A.ach' }, { date: TODAY, modifier: 'B', filename: 'OLD_20261119_B.ach' }, { date: '2026-11-18', modifier: 'C', filename: 'OLD_20261118_C.ach' }];
    check('entries from before (no origin) block their letters for every origin of their date', R.modifierFor(fresh, TENANT, TODAY) === 'C' && R.modifierFor(fresh, other, TODAY) === 'C' && R.modifierFor(fresh, TENANT, '2026-11-18') === 'A', [R.modifierFor(fresh, TENANT, TODAY), R.modifierFor(fresh, other, TODAY), R.modifierFor(fresh, TENANT, '2026-11-18')]);
    const old = thrown(() => R.recordFile(fresh, twoEntryFile(NS, fresh, { modifier: 'B' }).f, meta({ for: 'prenote' })));
    check('a file using a letter an old entry holds is refused', old === 'This file ID was used by another file today; build the file again.', old);
    check('keyOf takes the origin and destination without spaces, the destination falling back to the originating bank', JSON.stringify(R.keyOf({ ach: { immediateOrigin: ' 1990000001', destinationRouting: '', odfiRouting: ODFI } })) === JSON.stringify({ origin: ORIGIN, destination: ODFI }));
  },

  // F-7 for a new distribution: a file sent before it is recorded is kept by offering and payment date and attached later.
  // 16-CONTEXT wave 1 B4: a recorded run with no file record (every sample run) is treated as paid.
  async draft({ check }) {
    const { NS, ws } = portal();
    const R = NS.achRecord;
    const first = R.recordFile(ws, twoEntryFile(NS, ws, { modifier: 'A' }).f, meta());
    check('targetOf gives the draft key of the offering and payment date', JSON.stringify(R.targetOf(meta())) === JSON.stringify({ draftKey: `kb-fund-ii|${EFFECTIVE}`, for: 'distribution' }), R.targetOf(meta()));
    check('targetOf gives no target for a pre-note, redemption or returned-line file, and the run for a run', ['prenote', 'redemption', 'repay'].every((x) => R.targetOf(meta({ for: x })) === null) && JSON.stringify(R.targetOf(meta({ runId: 'r-1' }))) === JSON.stringify({ runId: 'r-1' }));
    check('sentFor(draft key) finds the file with no run', R.sentFor(ws, R.targetOf(meta())) === first);
    const second = thrown(() => R.recordFile(ws, twoEntryFile(NS, ws, { modifier: 'B' }).f, meta()));
    check('a second file for the same offering and date without a reason is refused', second === `A file for this distribution was already sent on ${longDay(TODAY)} (${first.name}). Use "Build again" and give the reason.`, second);
    check('another payment date of the same offering is not blocked', R.sentFor(ws, R.targetOf(meta({ effective: '2026-11-23' }))) === null);
    const run = NS.data.recordRun(ws, { offeringId: 'kb-fund-ii', date: EFFECTIVE, type: 'Distribution', total: 223000 }, { by: 'Pat Admin', today: TODAY });
    R.attach(ws, first.id, run.id);
    check('attach sets the run', first.runId === run.id);
    check('sentFor({ runId }) then finds it, and the draft key still does', R.sentFor(ws, { runId: run.id }) === first && R.sentFor(ws, R.targetOf(meta())) === first);
    check('paidRun is null for a run with a file record', R.paidRun(ws, run.id) === null);
    const other = NS.data.recordRun(ws, { offeringId: 'kb-fund-ii', date: '2026-11-23', type: 'Distribution', total: 100000 }, { by: 'Pat Admin', today: TODAY });
    const twice = thrown(() => R.attach(ws, first.id, other.id));
    check('attach to a second run is refused', /another distribution/.test(twice) && first.runId === run.id, twice);
    check('attach of an unknown record is refused', /no record/.test(thrown(() => R.attach(ws, 'af-999', run.id))));
    // a cancelled run's file no longer blocks a new draft for its offering and date
    NS.data.cancelRun(ws, run.id, { by: 'Pat Admin', why: 'Recorded on the wrong fund' });
    check('once its run is cancelled the draft key finds no sent file', R.sentFor(ws, R.targetOf(meta())) === null);
    // B4: a seeded sample run (recorded before file records existed)
    const seeded = ws.runs.find((r) => r.id === 'kb-fund-ii-2026-09-24');
    check('the seeded sample run has no file record and is treated as paid', !!seeded && R.sentFor(ws, { runId: seeded.id }) === null && R.paidRun(ws, seeded.id) === seeded);
    const f = twoEntryFile(NS, ws, { modifier: 'C', effective: seeded.date }).f;
    const b4 = thrown(() => R.recordFile(ws, f, meta({ runId: seeded.id, effective: seeded.date })));
    check('B4: its file is refused without a reason, with the recorded-as-paid sentence', b4 === `This distribution is recorded as paid on ${longDay(seeded.date)}. Use "Build again" and give the reason.`, b4);
    const ok = R.recordFile(ws, f, meta({ runId: seeded.id, effective: seeded.date, again: { why: 'The bank lost the first file', of: null } }));
    check('B4: with a reason it is stored with again.of null', ok.runId === seeded.id && ok.again && ok.again.why === 'The bank lost the first file' && ok.again.of === null && ok.draftKey === '', ok.again);
  },

  // Build again: a second file with a reason is stored, names the first, and filesOf lists both, newest first.
  async again({ check }) {
    const { NS, ws } = portal();
    const R = NS.achRecord;
    const first = R.recordFile(ws, twoEntryFile(NS, ws, { modifier: 'A' }).f, meta());
    const blank = thrown(() => R.recordFile(ws, twoEntryFile(NS, ws, { modifier: 'B' }).f, meta({ again: { why: '   ', of: first.id } })));
    check('a reason of only spaces is no reason', /Build again/.test(blank), blank);
    const second = R.recordFile(ws, twoEntryFile(NS, ws, { modifier: 'B' }).f, meta({ how: 'copy', again: { why: 'The bank rejected the first file', of: first.id } }));
    check('the second file is stored with its reason and the first file', second.again && second.again.why === 'The bank rejected the first file' && second.again.of === first.id && second.modifier === 'B' && second.how === 'copy', second.again);
    const list = R.filesOf(ws, R.targetOf(meta()));
    check('filesOf lists both, newest first', list.length === 2 && list[0] === second && list[1] === first, list.map((x) => x.id));
    check('sentFor gives the newest', R.sentFor(ws, R.targetOf(meta())) === second);
    check('record ids follow each other', first.id === 'af-1' && second.id === 'af-2', [first.id, second.id]);
    check('the log holds no full fixture account number', noAccounts(JSON.stringify(ws.achLog)));
  },

  // Refusals store nothing.
  async refuse({ check }) {
    const { NS, ws } = portal();
    const R = NS.achRecord;
    const f = twoEntryFile(NS, ws).f;
    ['', '   ', null, undefined].forEach((by) => {
      const s = thrown(() => R.recordFile(ws, f, meta({ by })));
      check(`no person (${JSON.stringify(by)}) is refused with its sentence`, s === 'Sending a payment file needs the name of the person doing it.', s);
    });
    check('nothing is stored', R.ensure(ws).length === 0, ws.achLog.length);
    const bare = thrown(() => R.recordFile(ws, { filename: 'x.ach', lines: [] }, meta()));
    check('a file with no header is refused and nothing is stored', /no file header/.test(bare) && ws.achLog.length === 0, bare);
  },

  // Payment release (phase 15 C-10): self-serve admin may, team member may not; managed: every console role (fresh contexts).
  async canpay({ check }) {
    const as = (edition, role) => {
      const { NS } = portal(edition);
      NS.state.role = role;
      return NS.achRecord.canPay();
    };
    check('self-serve: the admin (owner role) may release a payment file', as('diy', 'admin') === true);
    check('self-serve: a team member may not', as('diy', 'team') === false);
    check('self-serve: an investor may not', as('diy', 'investor') === false);
    check('managed: Carrow & Vale staff may, as before', as('managed', 'staff') === true);
    check('managed: sponsor staff may, as before', as('managed', 'sponsor') === true);
    check('managed: an investor may not', as('managed', 'investor') === false);
  }
};

L.runParts(parts, { name: NAME, unit: 'cases', flag: '--case' });
