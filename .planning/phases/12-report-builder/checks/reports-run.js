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
const { sampleWorkspaces } = require(path.join(T.P11, 'checks/load11.js'));

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
/** The template with its letter's wording set to one paragraph, saved (a new version). */
function withLetter(NS, ws, t, s) {
  const x = JSON.parse(JSON.stringify(t));
  x.sections.find((sec) => sec.key === 'letter').text = [{ t: 'p', runs: [{ s, b: false, i: false }] }];
  return NS.reports.save(ws, x, { by: BY, at: '2027-01-19T10:00:00.000Z' });
}
/** Kestrel Bay Capital's sample workspace (23 investors, kb-fund-ii, kb-harlow, kb-note-24a). */
function kestrel(NS) {
  const ws = sampleWorkspaces(NS).find((w) => w.tenant && w.tenant.id === 'kestrel-bay');
  if (!ws) throw new Error('the Kestrel Bay sample firm is not in NS.TENANTS');
  return ws;
}
/** What a promise rejects with: its message, or '' when it resolves. */
async function rejected(p) {
  try {
    await p;
    return '';
  } catch (e) {
    return String((e && e.message) || e || 'rejected');
  }
}
/** Other investors' titles, leaving out any title contained in the recipient's own (Pitfall 12's exact rule is othersIn). */
const otherTitles = (ws, rid) => {
  const own = rid ? (ws.investors.find((i) => i.id === rid) || {}).title || '' : '';
  return ws.investors.filter((i) => i.id !== rid && i.title && own.indexOf(i.title) < 0).map((i) => i.title);
};
const titleOf = (ws, rid) => (ws.investors.find((i) => i.id === rid) || {}).title || '';

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
  },

  order: async ({ check }) => {
    const { NS, kit } = load();
    const ws = kestrel(NS);
    const store = makeStore();
    const t = blankTemplate(NS, ws, 'quarterly');
    const spec = { from: Q4.from, to: Q4.to, audience: { kind: 'fund', offeringId: 'kb-fund-ii' } };
    const holders = NS.reportsData.holders(ws, 'kb-fund-ii', Q4.to).map((i) => i.id);
    check('kb-fund-ii has more than two holders at the quarter end', holders.length > 2, holders);
    // the store's size at the start of each compose: every earlier file is already kept
    const atStart = [];
    const compose = NS.reportsPdf.compose;
    NS.reportsPdf.compose = function (m, o) {
      atStart.push(store.m.size);
      return compose.call(this, m, o);
    };
    const calls = [];
    const t0 = Date.now();
    const run = await NS.reportsRun.generate(ws, t, spec, {
      by: BY,
      at: AT,
      kit,
      store,
      onEach: (e) => calls.push({ done: e.done, total: e.total, id: e.file && e.file.id, ms: e.ms, kept: !!(e.file && store.m.has(e.file.id)) })
    });
    const wall = Date.now() - t0;
    NS.reportsPdf.compose = compose;
    check("the run is 'generated' with one file per holder, in id order", run.state === 'generated' && J(run.files.map((f) => f.investorIds[0])) === J(holders), run.files.map((f) => f.investorIds));
    check('onEach is called once per file, done 1..N, total N, with that file', calls.length === holders.length && calls.every((c, k) => c.done === k + 1 && c.total === holders.length && c.id === run.files[k].id), calls.slice(0, 3));
    check('each onEach comes after its file is kept', calls.every((c) => c.kept), calls.filter((c) => !c.kept));
    check('ms is measured: a whole number of milliseconds, never more than the run took in all', calls.every((c) => Number.isSafeInteger(c.ms) && c.ms >= 0) && calls.reduce((a, c) => a + c.ms, 0) <= wall, { ms: calls.map((c) => c.ms), wall });
    check('at the start of each compose the store already holds every earlier file', J(atStart) === J(holders.map((x, k) => k)), atStart);
  },

  stop: async ({ check }) => {
    const { NS, kit } = load();
    const ws = kestrel(NS);
    const store = makeStore();
    const t = blankTemplate(NS, ws, 'quarterly');
    const spec = { from: Q4.from, to: Q4.to, audience: { kind: 'fund', offeringId: 'kb-fund-ii' } };
    let done = 0;
    let total = 0;
    const run = await NS.reportsRun.generate(ws, t, spec, {
      by: BY,
      at: AT,
      kit,
      store,
      onEach: (e) => {
        done = e.done;
        total = e.total;
      },
      shouldStop: () => done >= 2
    });
    check("the run is 'stopped' with exactly two files", run.state === 'stopped' && run.files.length === 2, { state: run.state, files: run.files.length });
    check('it was stopped part-way (more than two holders)', total > 2, total);
    check('both files are kept and match their records', run.files.length === 2 && run.files.every((f) => store.m.has(f.id) && NS.audit.sha256(store.m.get(f.id).bytes) === f.sha256) && store.m.size === 2, store.m.size);
    check("the change log's last entry is 'Report generation stopped'", lastAction(ws) === 'Report generation stopped', lastAction(ws));
  },

  refuse: async ({ check }) => {
    const { NS, kit } = load();
    const { ws } = T.fundA(NS);
    const store = makeStore();
    const fundSpec = { from: Q4.from, to: Q4.to, audience: { kind: 'fund', offeringId: 'fund-a' } };
    const opts = { by: BY, at: AT, kit, store };
    const base = blankTemplate(NS, ws, 'quarterly');
    const typo = withLetter(NS, ws, base, 'Dear {frist_name}, thank you.');
    const other = withLetter(NS, ws, base, 'Dear {first_name}, FA-1002 joined us this quarter.');
    const photo = JSON.parse(JSON.stringify(base));
    photo.sections.find((s) => s.key === 'assets').opts = { items: [{ holdingId: 'fa-x', photoIds: ['ph-missing'], text: [], figures: [] }] };
    const photoT = NS.reports.save(ws, photo, { by: BY, at: '2027-01-19T11:00:00.000Z' });
    const kb = kestrel(NS);
    const kbFirst = withLetter(NS, kb, blankTemplate(NS, kb, 'quarterly'), 'Dear {first_name}, our news.');
    const same = (w) => J({ runs: (w.reports || {}).runs || [], audit: (w.audit || []).length });
    const before = same(ws);
    const kbBefore = same(kb);
    const m1 = await rejected(NS.reportsRun.generate(ws, typo, fundSpec, opts));
    check('a letter holding {frist_name} is refused, naming it, for both reports', /^2 reports cannot be made: /.test(m1) && m1.indexOf('{frist_name}') >= 0, m1);
    const m2 = await rejected(NS.reportsRun.generate(kb, kbFirst, { from: Q4.from, to: Q4.to, audience: { kind: 'letter', offeringIds: ['kb-fund-ii'], statements: false } }, opts));
    check('a letter to everyone without statements holding {first_name} is refused, naming it', /^1 report cannot be made: /.test(m2) && m2.indexOf('{first_name}') >= 0, m2);
    const m3 = await rejected(NS.reportsRun.generate(ws, base, { from: '2025-01-01', to: '2025-03-31', audience: { kind: 'fund', offeringId: 'fund-a' } }, opts));
    check("a fund and period with no holder: 'No investor gets this report for that choice.'", m3 === 'No investor gets this report for that choice.', m3);
    const m4 = await rejected(NS.reportsRun.generate(ws, photoT, fundSpec, opts));
    check('a photo id not in the store is refused with the photo sentence', m4 === 'A photo this template uses is not on this device. Remove it or add it again.', m4);
    const m5 = await rejected(NS.reportsRun.generate(ws, other, fundSpec, opts));
    check("a report naming another investor is refused: 'A report would show another investor's details. Nothing was generated.'", m5 === 'A report would show another investor’s details. Nothing was generated.' || m5 === "A report would show another investor's details. Nothing was generated.", m5);
    check('after each refusal no run is recorded and nothing is logged', same(ws) === before && same(kb) === kbBefore, { ws: same(ws), kb: same(kb) });
    check('after each refusal the store is exactly as before (empty)', store.m.size === 0, store.m.size);
    const all = [m1, m2, m3, m4, m5].join(' ');
    check('the refusals name no vendor and never the forbidden word', !L.WORD_RE.test(all) && T.leak(all).ok, T.leak(all).hits);
  },

  letter: async ({ check }) => {
    const { NS, kit } = load();
    const ws = kestrel(NS);
    const store = makeStore();
    const t = withLetter(NS, ws, blankTemplate(NS, ws, 'quarterly'), 'Dear investors, the quarter went to plan.');
    const holders = NS.reportsData.holders(ws, 'kb-fund-ii', Q4.to).map((i) => i.id);
    const one = await NS.reportsRun.generate(ws, t, { from: Q4.from, to: Q4.to, audience: { kind: 'letter', offeringIds: ['kb-fund-ii'], statements: false } }, { by: BY, at: AT, kit, store });
    check('without statements: one file', one.state === 'generated' && one.files.length === 1, one.files.length);
    const f = one.files[0] || { investorIds: [] };
    check('its investorIds are every holder of kb-fund-ii', J(f.investorIds) === J(holders), f.investorIds);
    check("its fund is kb-fund-ii and its name ends '_All.pdf'", f.offeringId === 'kb-fund-ii' && /_All\.pdf$/.test(f.name), f);
    const tx = store.m.has(f.id) ? textOf(store.m.get(f.id).bytes) : '';
    const named = ws.investors.filter((i) => holds(tx, i.title)).map((i) => i.title);
    check('its text holds the letter and no investor title', holds(tx, 'the quarter went to plan') && named.length === 0, named);
    const many = await NS.reportsRun.generate(ws, t, { from: Q4.from, to: Q4.to, audience: { kind: 'letter', offeringIds: ['kb-fund-ii'], statements: true } }, { by: BY, at: AT, kit, store });
    check('with statements: one file per holder', many.state === 'generated' && J(many.files.map((x) => x.investorIds)) === J(holders.map((id) => [id])), many.files.map((x) => x.investorIds));
    const bad = [];
    many.files.forEach((x) => {
      const rid = x.investorIds[0];
      const s = textOf(store.m.get(x.id).bytes);
      const others = otherTitles(ws, rid).filter((o) => holds(s, o));
      if (!holds(s, titleOf(ws, rid)) || others.length || !holds(s, 'the quarter went to plan')) bad.push({ rid, own: holds(s, titleOf(ws, rid)), others });
    });
    check('with statements: each file holds the letter and its own title only', bad.length === 0, bad.slice(0, 3));
  },

  archive: async ({ check }) => {
    const { NS, kit } = load();
    const { ws, oid } = T.fundA(NS);
    const store = makeStore();
    const t = blankTemplate(NS, ws, 'quarterly');
    const run = await NS.reportsRun.generate(ws, t, { from: Q4.from, to: Q4.to, audience: { kind: 'fund', offeringId: 'fund-a' } }, { by: BY, at: AT, kit, store });
    const [f1, f2] = run.files;
    const original = Buffer.from(store.m.get(f1.id).bytes);
    const a = await NS.reportsRun.fileBytes(ws, run.id, f1.id, { kit, store });
    check("a kept file: source 'kept' with the recorded hash", a && a.source === 'kept' && NS.audit.sha256(a.bytes) === f1.sha256, a && (a.error || a.source));
    await store.del(f1.id);
    const b = await NS.reportsRun.fileBytes(ws, run.id, f1.id, { kit, store });
    check("the store lost it: source 'remade' with the same hash", b && b.source === 'remade' && NS.audit.sha256(b.bytes) === f1.sha256, b && (b.error || b.source));
    check('the remade file is byte-identical to the one made', !!(b && b.bytes) && Buffer.compare(Buffer.from(b.bytes), original) === 0, b && b.bytes && b.bytes.length);
    check('remaking it recorded nothing and kept nothing', ws.reports.runs.length === 1 && !store.m.has(f1.id));
    const endOf = () => NS.reportsData.statement(ws, 'FA-1001', oid, Q4.from, Q4.to).period.end;
    const endBefore = endOf();
    NS.books.post(ws, oid, { date: '2026-11-30', memo: 'Legal fees', src: 'bank:fa-run-1', lines: [['5100', 100000], ['1000', -100000]] }, { by: BY, at: '2027-01-20T13:00:00.000Z' });
    NS.books.sync(ws, { today: NS.dates.today() });
    check("a balanced entry dated 2026-11-30 changes FA-1001's quarter-end capital", endOf() !== endBefore, { before: endBefore, after: endOf() });
    const c = await NS.reportsRun.fileBytes(ws, run.id, f1.id, { kit, store });
    check('after the figures changed: the plain sentence, no bytes', c && !c.bytes && c.error === 'The original file is not kept on this device, and the figures or the firm’s details have changed since it was made.', c && (c.error || c.source));
    store.m.get(f2.id).bytes[100] ^= 1;
    const d = await NS.reportsRun.fileBytes(ws, run.id, f2.id, { kit, store });
    check("one byte of a kept file changed: 'The kept file does not match its record.'", d && !d.bytes && d.error === 'The kept file does not match its record.', d && (d.error || d.source));
    const e = await NS.reportsRun.fileBytes(ws, run.id, 'rf-x-9', { kit, store });
    check('an unknown file gives a plain sentence, no bytes', e && !e.bytes && typeof e.error === 'string' && e.error.length > 0, e);
    const all = [c, d, e].map((x) => (x && x.error) || '').join(' ');
    check('the sentences name no vendor and never the forbidden word', !L.WORD_RE.test(all) && T.leak(all).ok, T.leak(all).hits);
  },

  batch: async ({ check }) => {
    const { NS, kit } = load();
    const ws = kestrel(NS);
    const store = makeStore();
    const t = blankTemplate(NS, ws, 'quarterly');
    const ids = ws.investors.map((i) => i.id);
    const t0 = Date.now();
    const run = await NS.reportsRun.generate(ws, t, { from: Q4.from, to: Q4.to, audience: { kind: 'all' } }, { by: BY, at: AT, kit, store });
    const total = Date.now() - t0;
    const n = run.files.length;
    console.log(`speed: ${n} reports, ${total} ms, ${n ? Math.round(total / n) : 0} ms per report`);
    const want = NS.reports.recipients(ws, t, { from: Q4.from, to: Q4.to, audience: { kind: 'all' } });
    check(`one file per investor of the firm (${want.length} of ${ids.length} investors hold a position at the quarter end)`, run.state === 'generated' && n === want.length && n > 2 && J(run.files.map((f) => f.investorIds)) === J(want.map((id) => [id])), { n, want: want.length });
    check('every file is kept and matches its record', run.files.every((f) => store.m.has(f.id) && NS.audit.sha256(store.m.get(f.id).bytes) === f.sha256));
    const bad = [];
    run.files.forEach((f) => {
      const rid = f.investorIds[0];
      const s = textOf(store.m.get(f.id).bytes);
      const others = otherTitles(ws, rid).filter((o) => holds(s, o));
      const otherIds = ids.filter((id) => id !== rid && s.indexOf(id) >= 0);
      if (!holds(s, titleOf(ws, rid)) || others.length || otherIds.length) bad.push({ rid, own: holds(s, titleOf(ws, rid)), others, otherIds });
    });
    check("every PDF holds its own investor's title and no other investor's title or id", bad.length === 0, bad.slice(0, 3));
    const multi = run.files.filter((f) => NS.reportsData.fundsOf(ws, f.investorIds[0]).length > 1);
    check("a file for an investor in several funds names no one fund; the others name theirs", multi.every((f) => f.offeringId === '') && run.files.filter((f) => multi.indexOf(f) < 0).every((f) => /^kb-/.test(f.offeringId)), run.files.map((f) => [f.investorIds[0], f.offeringId]));
  },

  selfcheck: async ({ check }) => {
    const { spawnSync } = require('child_process');
    const env = Object.assign({}, process.env, { GATE_FRESH: '1' });
    const a = spawnSync(process.execPath, [__filename, '--case', 'nosuchcase'], { encoding: 'utf8', env });
    check('an unknown --case name exits 1 with a FAIL line', a.status === 1 && /^FAIL /m.test(a.stdout) && /REPORTS RUN: FAIL/.test(a.stdout), { status: a.status, out: a.stdout });
    const b = spawnSync(process.execPath, [__filename, '--case', ''], { encoding: 'utf8', env });
    check('an empty --case list exits 1 with a FAIL line', b.status === 1 && /^FAIL /m.test(b.stdout) && /REPORTS RUN: FAIL/.test(b.stdout), { status: b.status, out: b.stdout });
  }
};

// Every run measures afresh: a case kept from an earlier run on the same tree would replay its PASS lines without the
// speed line, which is measured, never carried over. The whole check runs in well under a minute.
process.env.GATE_FRESH = '1';
L.runParts(cases, { name: 'REPORTS RUN', unit: 'cases', flag: '--case' });
