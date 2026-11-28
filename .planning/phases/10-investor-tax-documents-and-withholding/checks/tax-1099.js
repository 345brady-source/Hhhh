// gate: node
// last "TAX 1099: PASS (cases run: 14)"
// Form 1099-INT's core (plan 10-09) and Form 1099-DIV's (plan 10-11: cases div-split, div-rules, div-stops and div-rows,
// hand-worked example E below), assets/js/tax1099.js and tax1099-data.js, no browser: data.js, audit.js,
// withholding.js, taxmaps.js, taxforms.js, tax1099-data.js and tax1099.js run in one sandbox with window.CVPortal = {},
// on workspaces written out here. The sandbox clock stands at noon on 20 January 2027 and every function is given its
// own date. The PDF writer, the reader and the Unicode font are the copies shipped in the repository (plan 10-03).
//   node tax-1099.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "TAX 1099: PASS (cases run: N)" or
// "TAX 1099: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
//
// Taxpayer numbers (C-05): every number here is invented in a range the IRS never issues (social security numbers
// starting 000, employer numbers starting 00). Nothing filled is written to disk: every PDF is built and read in memory.
// What this check prints is passed through mask() first, so its output never holds a run of nine digits, a number in
// either dashed shape, or a hash.
//
// Hand-worked example D (the numbers of this check). Tax year 2026; the fund is set to notes; the payer has confirmed
// the notes are in registered form and interest was paid in money. Four interest payments of $10,000.00 (2026-03-16,
// 06-15, 09-15, 12-15), each stored as example A's lines: A-1001 500,000, A-1002 333,333, A-1003 166,667 cents. Backup
// withholding of 80,000 cents (24% of 333,333 = 79,999.92, rounded) is stored on A-1002's line of the September and
// December payments. A Principal payment of $60,000.00 on 2026-12-15. Looked at on 2027-01-20.
//   A-1001 (signed W-9): box 1 = 4 x 500,000 = 2,000,000 cents = $20,000.00; box 4 = $0.00, left empty.
//   A-1002 (signed W-9, item 2 crossed out): box 1 = 4 x 333,333 = 1,333,332 = $13,333.32; box 4 = 2 x 80,000 =
//          160,000 = $1,600.00.
//   A-1003 (foreign, W-8BEN valid until 2028-12-31): left out, Form 1042-S from the CPA; 4 x 166,667 = 666,668 cents.
//   2,000,000 + 1,333,332 + 666,668 = 4,000,000 = 4 x 1,000,000. The Principal payment adds nothing.
//   In the upload file A-1002's row has 13333.32 in the box 1 column (AN) and 1600.00 in the box 4 column (AQ);
//   A-1001's row has 20000.00 and an empty box 4.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const ROOT = L.ROOT;
const SRC = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CLOCK = '2027-01-20';
const TODAY = '2027-01-20';

/** What this check prints: hashes, runs of nine or more digits and both dashed number shapes are masked. */
function mask(s) {
  return String(s)
    .replace(/[0-9a-f]{32,}/gi, '[hex]')
    .replace(/\d{3}-\d{2}-\d{4}/g, '[ddd-dd-dddd]')
    .replace(/\d{2}-\d{7}/g, '[dd-ddddddd]')
    .replace(/\d{9,}/g, '[digits]');
}
/** The reporter's check, with every detail masked. */
const masked = (check) => (name, ok, info) => check(name, ok, info === undefined ? undefined : mask(typeof info === 'string' ? info : JSON.stringify(info)));

/** The text after "const taxOnFile =" on its own line in onboarding.js. */
function taxOnFileText() {
  const line = SRC('assets/js/onboarding.js')
    .split('\n')
    .find((l) => /^\s*const taxOnFile = /.test(l));
  if (!line) throw new Error('onboarding.js has no line "const taxOnFile = ..."');
  return line.replace(/^\s*const taxOnFile = /, '').replace(/;\s*$/, '');
}
const FILES = ['data.js', 'audit.js', 'withholding.js', 'taxmaps.js', 'taxforms.js', 'tax1099-data.js', 'tax1099.js'];
/** A fresh sandbox with the clock at noon on CLOCK, the portal's files loaded as the browser loads them. */
function load() {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window, console, setTimeout: () => 0, clearTimeout: () => {}, TextEncoder, TextDecoder });
  const [y, m, d] = CLOCK.split('-').map(Number);
  vm.runInContext(`(function () { const R = Date; const fixed = new R(${y}, ${m - 1}, ${d}, 12, 0, 0).getTime(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } } globalThis.Date = D; })();`, ctx);
  FILES.forEach((f) => vm.runInContext(SRC('assets/js/' + f), ctx, { filename: f }));
  vm.runInContext(`window.CVPortal.inviteFlow = Object.assign(window.CVPortal.inviteFlow || {}, { taxOnFile: ${taxOnFileText()} });`, ctx);
  return window.CVPortal;
}

/* ---------- the PDF libraries shipped in the repository ---------- */
const VIEW = path.join(ROOT, 'assets/vendor/pdfview/view.js');
const VIEW_WORKER = path.join(ROOT, 'assets/vendor/pdfview/view-worker.js');
const W = () => require(path.join(ROOT, 'assets/vendor/pdfwrite/write.js'));
const fillOpts = () => {
  const crypto = require('crypto');
  return {
    fontkit: require(path.join(ROOT, 'assets/vendor/pdfwrite/fonts.js')),
    fontBytes: fs.readFileSync(path.join(ROOT, 'assets/vendor/textfont/DejaVuSans.ttf')),
    sha256: (b) => crypto.createHash('sha256').update(Buffer.from(b)).digest('hex')
  };
};
/** Each page of a PDF as { height, items: [{ s, x, top, bottom }] } and the file's form field count, read in memory. */
async function readPdf(bytes, NS) {
  const V = require(VIEW);
  V.GlobalWorkerOptions.workerSrc = VIEW_WORKER;
  const doc = await V.getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false, useSystemFonts: false, disableFontFace: true }).promise;
  const pages = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const height = page.getViewport({ scale: 1 }).height;
      const items = NS.tax1099.textItems(height, (await page.getTextContent()).items);
      pages.push({ height, items, text: items.map((it) => it.s).join(' ') });
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  const pdf = await W().PDFDocument.load(bytes, { updateMetadata: false });
  return { pages, fields: pdf.getForm().getFields().length };
}

/* ---------- the records of example D ---------- */
const J = (x) => JSON.stringify(x);
const BY = 'Dana Reyes (Example admin)';
const AT = '2026-12-20T15:00:00.000Z';
const pos = (amount, offeringId) => [{ offeringId: offeringId || 'f1', amount, date: '2025-01-02' }];
const inv = (id, amount, more) => Object.assign({ id, title: `Investor ${id}`, contact: `Person ${id}`, type: 'individual', onboarding: { status: 'complete' }, payment: { method: 'check', bank: null }, positions: pos(amount) }, more || {});
/** A signed W-9 as the onboarding leaves it (onboarding.js taxSigned). */
const w9 = (last4, crossed) => ({ taxType: 'us-individual', taxForm: 'W-9', tinLast4: last4, taxCert: { form: 'W-9', revision: 'March 2024', envelopeId: 'env-w9', at: '2025-01-02T10:00:00.000Z', signed: true, signedBy: 'Signer', tinLast4: last4, backupWithholding: !!crossed } });
/** A signed W-8BEN as the onboarding leaves it. */
const w8ben = (more) => ({ taxType: 'foreign-individual', taxForm: 'W-8BEN', tinLast4: '', taxCert: Object.assign({ form: 'W-8BEN', revision: 'October 2021', envelopeId: 'env-w8', at: '2025-03-02T10:00:00.000Z', signed: true, signedBy: 'Signer', country: 'Canada', citizenship: 'Canada', ftinLast4: '5521', noFtin: false, treatyCountry: 'Canada', validUntil: '2028-12-31' }, more || {}) });
/** What the sponsor stores about the payer: never the full number, only its last four. */
const PAYER_STORED = { name: 'Fund One Notes LLC', name2: '', address1: '100 Main St', address2: '', city: 'Dallas', state: 'TX', zip: '75201', phone: '214-555-0100', tinLast4: '4321', registeredForm: true, paidInMoney: true };
/** Invented numbers, in ranges the IRS never issues. */
const PAYER_TIN = '00' + '7654321';
const TIN = { 'A-1001': '000' + '41' + '4821', 'A-1002': '000' + '55' + '7310' };
const dashedSsn = (d) => `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
const dashedEin = (d) => `${d.slice(0, 2)}-${d.slice(2)}`;
/** The payer as the caller builds it for one file or copy and drops afterwards. */
const payerObj = () => Object.assign({ tinType: 'EIN', tin: PAYER_TIN, nameType: 'B', country: 'US' }, PAYER_STORED);
/** The recipients as the caller builds them from the signed W-9 (the split of the name confirmed by the sponsor). */
const RECIPIENT = {
  'A-1001': { tinType: 'SSN', nameType: 'I', name: 'Jordan Sample', name2: '', first: 'Jordan', middle: '', last: 'Sample', suffix: '', country: 'US', address1: '9 Elm St', address2: '', city: 'Houston', state: 'TX', zip: '77002' },
  'A-1002': { tinType: 'SSN', nameType: 'I', name: 'Avery Example', name2: '', first: 'Avery', middle: '', last: 'Example', suffix: '', country: 'US', address1: '22 Oak Ave', address2: 'Apt 4', city: 'Austin', state: 'TX', zip: '78701' }
};
const recipientObj = (id) => Object.assign({ tin: TIN[id] }, RECIPIENT[id]);
/** A confirmed backup withholding entry of `cents` on A-1002's line. */
const backup = (cents) => ({ 'A-1002': [{ kind: 'backup', cents, basisCents: 333333, ratePct: 24, source: 'rule', why: 'Item 2 of the W-9 is crossed out.', confirmedBy: BY, confirmedAt: AT }] });
/** Record one distribution of fund f1 through plan 10-01's recordRun, paid on its own date. */
function rec(NS, ws, id, date, type, total, withheld) {
  return NS.data.recordRun(ws, Object.assign({ offeringId: 'f1', date, type, total }, withheld ? { withheld } : {}), { by: BY, today: date, id });
}
/** Example D's workspace (opts.payer false: no payer record; opts.reporting: another type or '' for none). */
function wsD(NS, opts) {
  opts = opts || {};
  const ws = {
    v: 2,
    tenant: { id: 'example', shortName: 'Example' },
    offerings: [{ id: 'f1', name: 'Fund One Notes', shortName: 'Fund One', type: 'Private credit', status: 'Active', closeDate: '2025-01-02', distribution: { frequency: 'Quarterly', type: 'Interest' } }],
    investors: [inv('A-1001', 300000, w9('4821', false)), inv('A-1002', 200000, w9('7310', true)), inv('A-1003', 100000, w8ben())],
    runs: [],
    requests: [],
    audit: []
  };
  const rep = opts.reporting === undefined ? 'notes' : opts.reporting;
  if (rep) NS.withholding.setReporting(ws, 'f1', rep, { by: BY, at: AT });
  if (opts.payer !== false) NS.tax1099.setPayer(ws, 'f1', Object.assign({}, PAYER_STORED, opts.payerPatch || {}), { by: BY, at: AT });
  rec(NS, ws, 'i-mar', '2026-03-16', 'Interest', 1000000);
  rec(NS, ws, 'i-jun', '2026-06-15', 'Interest', 1000000);
  rec(NS, ws, 'i-sep', '2026-09-15', 'Interest', 1000000, backup(80000));
  rec(NS, ws, 'i-dec', '2026-12-15', 'Interest', 1000000, backup(80000));
  rec(NS, ws, 'p-dec', '2026-12-15', 'Principal', 6000000);
  return ws;
}
/** A column's index from its letter (A = 0, AN = 39, BN = 65). */
const col = (letters) => letters.split('').reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0) - 1;
const letters = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
/** The box columns of Form 1099-INT in the upload file: AM (payer's RTN) to BN. */
const BOX_COLS = Array.from({ length: col('BN') - col('AM') + 1 }, (_, k) => letters(col('AM') + k));
/** fn must throw a refusal (not a missing function) and leave the workspace as it was. */
function refuses(ws, fn) {
  const before = J(ws);
  let msg = '';
  try {
    fn();
  } catch (e) {
    msg = String((e && e.message) || e) || 'threw';
  }
  return { threw: !!msg && !/is not a function|is not defined|Cannot read/.test(msg), msg, unchanged: J(ws) === before };
}
/** A block of checks that reports one FAIL line when the code it needs is missing, and lets the case go on. */
async function block(check, name, fn) {
  try {
    await fn();
  } catch (e) {
    check(`${name}: ran to the end`, false, String(e && e.stack ? e.stack : e).split('\n').slice(0, 3).join(' | '));
  }
}
/** No taxpayer number of any shape in a text: digits only, dashed, first five beside last four, and the shapes (D4). */
function numberHits(text, numbers) {
  const t = String(text)
    .replace(/"(sha256|sourceSha256)":"[^"]*"/g, '""')
    .replace(/[0-9a-f]{64}/gi, '');
  const hits = [];
  (numbers || []).forEach((d) => {
    const forms = [d, dashedSsn(d), dashedEin(d), `${d.slice(0, 5)} ${d.slice(5)}`, `${d.slice(0, 5)}${d.slice(5)}`];
    if (forms.some((f) => t.indexOf(f) >= 0)) hits.push('an invented number ending ' + d.slice(5));
  });
  if (/\d{3}-\d{2}-\d{4}/.test(t)) hits.push('the shape ddd-dd-dddd');
  if (/\d{2}-\d{7}/.test(t)) hits.push('the shape dd-ddddddd');
  if (/(?<![0-9a-f])[0-9]{9,}(?![0-9a-f])/.test(t)) hits.push('a run of nine or more digits');
  return hits;
}
/** A backup withholding entry of `cents` worked on `basis` (24%). */
const bk = (cents, basis) => ({ kind: 'backup', cents, basisCents: basis, ratePct: 24, source: 'rule', why: 'No signed W-9 is on file.', confirmedBy: BY, confirmedAt: AT });
/** An entered entry of another kind (foreign or state). */
const other = (kind, cents, basis) => ({ kind, cents, basisCents: basis, ratePct: kind === 'foreign' ? 30 : null, source: kind === 'foreign' ? 'rule' : 'entered', why: 'Entered by the sponsor.', confirmedBy: BY, confirmedAt: AT });
/**
 * A workspace whose fund (set to notes, the payer's confirmations given) has one paid Interest payment on 2026-09-15
 * with the lines given as stored ([ { investorId, grossCents, withheld } ]); the investors are seated here.
 */
function wsLines(NS, investors, lines) {
  const ws = {
    v: 2,
    tenant: { id: 'example', shortName: 'Example' },
    offerings: [{ id: 'f1', name: 'Fund One Notes', shortName: 'Fund One', type: 'Private credit', status: 'Active', closeDate: '2025-01-02', distribution: { frequency: 'Quarterly', type: 'Interest' } }],
    investors,
    runs: [],
    requests: [],
    audit: []
  };
  NS.withholding.setReporting(ws, 'f1', 'notes', { by: BY, at: AT });
  NS.tax1099.setPayer(ws, 'f1', PAYER_STORED, { by: BY, at: AT });
  const stored = lines.map((l) => ({ investorId: l.investorId, grossCents: l.grossCents, withheld: l.withheld || [], netCents: l.grossCents - (l.withheld || []).reduce((a, w) => a + w.cents, 0) }));
  ws.runs.push({ id: 'r-sep', offeringId: 'f1', date: '2026-09-15', type: 'Interest', total: stored.reduce((a, l) => a + l.grossCents, 0), status: 'paid', source: 'console', file: '', lines: stored, linesBasis: 'recorded', linesAt: AT, linesBy: BY });
  return ws;
}
const brief = (F) => (F.forms || []).map((f) => `${f.investorId}=${f.box1Cents}/${f.box4Cents}`).join(' ');
const codes = (F) => (F.stops || []).map((s) => s.code).sort().join(' ');
// Invented numbers for the W-9 reading (never-issued ranges).
const W9_SSN = '000' + '12' + '7730';
const W9_EIN = '00' + '1234567';

/* ---------- Form 1099-DIV (plan 10-11): hand-worked example E ---------- */
// A fund set to corporation or REIT, tax year 2026, looked at on 2027-01-20.
//   Distribution 1, 2026-04-15, 1,000,000 cents: stored lines S-2001 400,000 and S-2003 600,000. The CPA's split: 1a 70%,
//   2a 10%, 3 20%, box 5 the whole of 1a: 700,000 / 100,000 / 200,000, box 5 700,000.
//   Distribution 2, 2026-10-15, 600,000 cents: S-2001 240,000, S-2002 120,000 (joined in between), S-2003 240,000. The
//   split: 1a 50%, 3 50%, box 5 the whole of 1a: 300,000 / 0 / 300,000, box 5 300,000.
//   S-2001: 1a 280,000 + 120,000 = 400,000; 2a 40,000; 3 80,000 + 120,000 = 200,000; 5 400,000; cash 640,000.
//   S-2002: 1a 60,000; 3 60,000; 5 60,000; cash 120,000.
//   S-2003: 1a 420,000 + 120,000 = 540,000; 2a 60,000; 3 120,000 + 120,000 = 240,000; 5 540,000; cash 840,000.
//   Fund: 1a 1,000,000; 2a 100,000; 3 500,000; cash 1,600,000.
//   The odd line: a gross of 333,333 under 70 / 10 / 20 is 233,333.1 / 33,333.3 / 66,666.6; whole cents 233,333 + 33,333 +
//   66,666 = 333,332 and the odd cent goes to the largest remainder (box 3): 233,333 / 33,333 / 66,667. Box 5 as the whole
//   of 1a is 233,333; box 1b at 35% of the distribution is 116,666.55, so 116,667.
//   In the upload file S-2001's row has 4000.00 (AM, 1a), 400.00 (AO, 2a), 2000.00 (AU, 3), 4000.00 (AW, 5); AN (1b), AP to
//   AT (2b to 2f) and AV (4) empty.
const DIV_BOXES = ['1a', '1b', '2a', '2b', '2c', '2d', '2e', '2f', '3', '4', '5'];
const DIV_COL = { '1a': 'AM', '1b': 'AN', '2a': 'AO', '2b': 'AP', '2c': 'AQ', '2d': 'AR', '2e': 'AS', '2f': 'AT', '3': 'AU', '4': 'AV', '5': 'AW' };
/** The box columns of Form 1099-DIV in the upload file: AM (box 1a) to BQ. */
const DIV_BOX_COLS = Array.from({ length: col('BQ') - col('AM') + 1 }, (_, k) => letters(col('AM') + k));
const TIN_E = { 'S-2001': '000' + '33' + '6601', 'S-2002': '000' + '33' + '6602', 'S-2003': '000' + '33' + '6603' };
const RECIPIENT_E = {
  'S-2001': { tinType: 'SSN', nameType: 'I', name: 'Riley Example', name2: '', first: 'Riley', middle: '', last: 'Example', suffix: '', country: 'US', address1: '31 Birch Ln', address2: '', city: 'Plano', state: 'TX', zip: '75024' },
  'S-2002': { tinType: 'SSN', nameType: 'I', name: 'Casey Sample', name2: '', first: 'Casey', middle: '', last: 'Sample', suffix: '', country: 'US', address1: '8 Cedar Ct', address2: '', city: 'Austin', state: 'TX', zip: '78702' },
  'S-2003': { tinType: 'SSN', nameType: 'I', name: 'Quinn Testcase', name2: '', first: 'Quinn', middle: '', last: 'Testcase', suffix: '', country: 'US', address1: '400 Pecan St', address2: 'Unit 2', city: 'Dallas', state: 'TX', zip: '75204' }
};
const recipientE = (id) => Object.assign({ tin: TIN_E[id] }, RECIPIENT_E[id]);
const PAYER_E = { name: 'Example E Holdings Inc', name2: '', address1: '200 Main St', address2: '', city: 'Dallas', state: 'TX', zip: '75201', phone: '214-555-0199', tinLast4: '4321' };
const payerE = () => Object.assign({ tinType: 'EIN', tin: PAYER_TIN, nameType: 'B', country: 'US' }, PAYER_E);
/** A paid distribution of fund f1 with its lines as stored ([ [investorId, grossCents, withheld] ]). */
function runE(id, date, lines, more) {
  const stored = lines.map(([investorId, grossCents, withheld]) => ({ investorId, grossCents, withheld: withheld || [], netCents: grossCents - (withheld || []).reduce((a, w) => a + w.cents, 0) }));
  return Object.assign({ id, offeringId: 'f1', date, type: 'Distribution', total: stored.reduce((a, l) => a + l.grossCents, 0), status: 'paid', source: 'console', file: '', lines: stored, linesBasis: 'recorded', linesAt: AT, linesBy: BY }, more || {});
}
/** Example E's workspace without any split (opts.reporting: another type or '' for none; opts.investors: more seated). */
function wsE(NS, opts) {
  opts = opts || {};
  const ws = {
    v: 2,
    tenant: { id: 'example', shortName: 'Example' },
    offerings: [{ id: 'f1', name: 'Fund Five Equity', shortName: 'Fund Five', type: 'Real estate', status: 'Active', closeDate: '2025-01-02', distribution: { frequency: 'Semiannual', type: 'Distribution' } }],
    investors: [inv('S-2001', 400000, w9('6601')), inv('S-2002', 200000, w9('6602')), inv('S-2003', 600000, w9('6603'))].concat(opts.investors || []),
    runs: [runE('d-apr', '2026-04-15', [['S-2001', 400000], ['S-2003', 600000]]), runE('d-oct', '2026-10-15', [['S-2001', 240000], ['S-2002', 120000], ['S-2003', 240000]])],
    requests: [],
    audit: []
  };
  const rep = opts.reporting === undefined ? 'corp' : opts.reporting;
  if (rep) NS.withholding.setReporting(ws, 'f1', rep, { by: BY, at: AT });
  NS.tax1099.setPayer(ws, 'f1', PAYER_E, { by: BY, at: AT });
  return ws;
}
/** Example E's two splits, as the CPA gives them, entered as percents. */
function splitE(NS, ws) {
  NS.tax1099.setSplit(ws, 'd-apr', { pct: { '1a': 70, '2a': 10, '3': 20 }, partPct: { '5': 70 } }, { by: BY, at: AT });
  NS.tax1099.setSplit(ws, 'd-oct', { pct: { '1a': 50, '2a': 0, '3': 50 }, partPct: { '5': 50 } }, { by: BY, at: AT });
}
/** A form's boxes as one line: '1a/1b/2a/2b/2c/2d/2e/2f/3/4/5' in cents. */
const boxLine = (f) => (f && f.boxes ? DIV_BOXES.map((b) => f.boxes[b]).join('/') : String(f && f.boxes));
const briefDiv = (F) => (F.forms || []).map((f) => `${f.investorId}=${boxLine(f)}`).join(' ');

const cases = {
  async figures({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    check('NS.tax1099 and NS.tax1099data are loaded', !!T && !!NS.tax1099data);
    const ws = wsD(NS);
    const o = ws.offerings[0];
    let F = null;
    await block(check, 'figures', () => {
      F = T.figuresInt(ws, o, '2026', { today: TODAY });
      const brief = (F.forms || []).map((f) => `${f.investorId}=${f.box1Cents}/${f.box4Cents}`).join(' ');
      check('example D: two forms, A-1001 2,000,000 / 0 and A-1002 1,333,332 / 160,000 cents', brief === 'A-1001=2000000/0 A-1002=1333332/160000', brief);
      const a2 = (F.forms || []).find((f) => f.investorId === 'A-1002') || {};
      check("A-1002's form names its four interest payments and not the Principal payment", J((a2.runIds || []).slice().sort()) === J(['i-dec', 'i-jun', 'i-mar', 'i-sep']), a2.runIds);
      const lo = F.leftOut || [];
      check('A-1003 is left out, alone, with 666,668 cents', lo.length === 1 && lo[0].investorId === 'A-1003' && lo[0].cents === 666668, lo);
      check("A-1003's reason is Form 1042-S from the CPA", lo[0] && /1042-S/.test(lo[0].reason) && /CPA/.test(lo[0].reason) && lo[0].code === 'foreign', lo[0]);
      check('no stop', Array.isArray(F.stops) && F.stops.length === 0, F.stops);
      check('totalCents is 4,000,000 = 4 x 1,000,000, and the forms plus the left out add up to it', F.totalCents === 4000000 && (F.forms || []).reduce((a, f) => a + f.box1Cents, 0) + lo.reduce((a, x) => a + x.cents, 0) === 4000000, F.totalCents);
      check("box 4 is NS.withholding.withheldFor (kind backup) for A-1002, fund and year", a2.box4Cents === NS.withholding.withheldFor(ws, { investorId: 'A-1002', offeringId: 'f1', year: '2026', kind: 'backup', today: TODAY }));
      const ir = T.interestRuns(ws, o, '2026', TODAY).map((r) => `${r.run.id}:${r.counts}`).sort().join(' ');
      check('interestRuns: the four Interest payments count, the Principal payment does not', ir === 'i-dec:interest i-jun:interest i-mar:interest i-sep:interest p-dec:not-interest', ir);
    });
    if (!F) return;
    await block(check, 'rows', () => {
      const r2 = T.iris.row('1099-INT', '2026', F.forms.find((f) => f.investorId === 'A-1002'), payerObj(), recipientObj('A-1002'));
      const r1 = T.iris.row('1099-INT', '2026', F.forms.find((f) => f.investorId === 'A-1001'), payerObj(), recipientObj('A-1001'));
      check('a row has 66 cells', Array.isArray(r2) && r2.length === 66 && r1.length === 66, r2 && r2.length);
      check("A-1002's row: 13333.32 in box 1 (AN) and 1600.00 in box 4 (AQ)", r2[col('AN')] === '13333.32' && r2[col('AQ')] === '1600.00', [r2[col('AN')], r2[col('AQ')]]);
      const others = BOX_COLS.filter((c) => c !== 'AN' && c !== 'AQ' && r2[col(c)] !== '');
      check("every other box column of A-1002's row is empty", others.length === 0, others);
      check("A-1001's row: 20000.00 in box 1 and an empty box 4", r1[col('AN')] === '20000.00' && r1[col('AQ')] === '', [r1[col('AN')], r1[col('AQ')]]);
      check('form type 1099-INT, tax year 2026', r2[col('A')] === '1099-INT' && r2[col('B')] === '2026');
      check("the recipient's number is in full, dashed, in U (what goes to the IRS is never truncated)", r2[col('T')] === 'SSN' && r2[col('U')] === dashedSsn(TIN['A-1002']));
      check("the payer's number is in full, dashed, in D", r2[col('C')] === 'EIN' && r2[col('D')] === dashedEin(PAYER_TIN));
      const faults = T.iris.validate('1099-INT', [r1, r2]);
      check('iris.validate finds no fault in the two rows', Array.isArray(faults) && faults.length === 0, faults);
    });
    await block(check, 'copy B', async () => {
      const map = NS.tax1099data.MAPS['1099-INT 2024-01 Copy B'];
      const form = F.forms.find((f) => f.investorId === 'A-1002');
      const answers = T.copyBAnswers(form, payerObj(), recipientObj('A-1002'), '2026');
      const bytes = await T.recipientCopy(W(), fs.readFileSync(path.join(ROOT, map.file)), map, answers, fillOpts());
      const got = await readPdf(bytes, NS);
      check("the recipient's copy has three pages: Copy B and the recipient's instructions (page 5 and its continuation, page 7)", got.pages.length === 3, got.pages.length);
      const p1 = got.pages[0] ? got.pages[0].text : '';
      check('its first page is Copy B, For Recipient', /Copy B/.test(p1) && /For Recipient/.test(p1));
      check('its second and third pages are the instructions for the recipient', got.pages[1] && /Instructions for Recipient/.test(got.pages[1].text) && got.pages[2] && /Instructions for Recipient \(continued\)/.test(got.pages[2].text));
      check('it has no form field left', got.fields === 0, got.fields);
      check("the first page shows the recipient's number truncated to its last four", p1.indexOf('***-**-7310') >= 0);
      check('the first page shows box 1 ($13,333.32) and box 4 ($1,600.00)', p1.indexOf('13,333.32') >= 0 && p1.indexOf('1,600.00') >= 0);
      check("the first page shows the payer's number in full", p1.indexOf(dashedEin(PAYER_TIN)) >= 0);
      const all = got.pages.map((p) => p.text).join(' ');
      const squeezed = all.replace(/\s+/g, '');
      check("the recipient's nine digits appear nowhere on the copy, with or without dashes", squeezed.indexOf(TIN['A-1002']) < 0 && squeezed.indexOf(dashedSsn(TIN['A-1002'])) < 0 && all.replace(/\D/g, '').indexOf(TIN['A-1002']) < 0);
    });
    check('the workspace and its change log hold no taxpayer number', numberHits(J(ws), [PAYER_TIN, TIN['A-1001'], TIN['A-1002']]).length === 0, numberHits(J(ws), [PAYER_TIN, TIN['A-1001'], TIN['A-1002']]));
  },

  // Who is left out, each with its own reason and cents (TAX-10); investors seated here (D12).
  async leftout({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const seat = [
      inv('B-IRA', 1000, Object.assign(w9('1111'), { type: 'ira' })),
      inv('B-FOR', 1000, w8ben()),
      inv('B-EXM', 1000, w9('2222')),
      inv('B-SMALL', 1000, w9('3333')),
      inv('B-NOW9', 1000, { taxType: 'us-individual', taxForm: '', tinLast4: '' }),
      inv('B-TEN', 1000, w9('4444')),
      inv('B-SMALLBK', 1000, w9('5555', true)),
      inv('B-EXP', 1000, w8ben({ validUntil: '2025-12-31' }))
    ];
    const lines = [
      { investorId: 'B-IRA', grossCents: 50000 },
      { investorId: 'B-FOR', grossCents: 50000 },
      { investorId: 'B-EXM', grossCents: 50000 },
      { investorId: 'B-SMALL', grossCents: 999 },
      { investorId: 'B-NOW9', grossCents: 50000 },
      { investorId: 'B-TEN', grossCents: 1000 },
      { investorId: 'B-SMALLBK', grossCents: 999, withheld: [bk(240, 999)] },
      { investorId: 'B-EXP', grossCents: 50000 }
    ];
    const ws = wsLines(NS, seat, lines);
    await block(check, 'leftout', () => {
      NS.withholding.markExempt(ws, 'B-EXM', { by: BY, at: AT });
      const F = T.figuresInt(ws, ws.offerings[0], '2026', { today: TODAY });
      check('24% of 999 cents is 240 (239.76 rounded), the amount stored', NS.withholding.amount(999, 24) === 240);
      check('forms: B-SMALLBK $9.99 with $2.40 withheld, and B-TEN $10.00; nobody else', brief(F) === 'B-SMALLBK=999/240 B-TEN=1000/0', brief(F));
      const lo = {};
      (F.leftOut || []).forEach((x) => (lo[x.investorId] = x));
      const want = { 'B-IRA': ['ira', /IRA/, 50000], 'B-FOR': ['foreign', /1042-S/, 50000], 'B-EXM': ['exempt', /exempt/i, 50000], 'B-SMALL': ['under-10', /\$10/, 999], 'B-NOW9': ['no-w9', /signed W-9/, 50000], 'B-EXP': ['no-form', /expired/, 50000] };
      Object.keys(want).forEach((id) => {
        const [code, re, cents] = want[id];
        const x = lo[id] || {};
        check(`${id} is left out (${code}) with its own reason and its ${cents} cents`, x.code === code && re.test(x.reason || '') && x.cents === cents, x);
      });
      check('exactly six are left out', (F.leftOut || []).length === 6, (F.leftOut || []).map((x) => x.investorId));
      check('the expired W-8 is not left out as foreign: it is listed as having no valid form on file', lo['B-EXP'] && lo['B-EXP'].code !== 'foreign' && /no valid/i.test(lo['B-EXP'].reason));
      check('every reason is one sentence', (F.leftOut || []).every((x) => /^[^.]+(\.[^.]+)*\.$/.test(x.reason) && x.reason.length < 220), (F.leftOut || []).map((x) => x.reason));
      check('the forms and the left out add up to the whole interest paid: 5 x 50,000 + 999 + 1,000 + 999 = 252,998', F.totalCents === 252998 && (F.forms || []).reduce((a, f) => a + f.box1Cents, 0) + (F.leftOut || []).reduce((a, x) => a + x.cents, 0) === 252998, F.totalCents);
      // Copy B for $9.99 and $2.40
      const a = T.copyBAnswers(F.forms.find((f) => f.investorId === 'B-SMALLBK'), payerObj(), Object.assign({ tin: '000' + '66' + '5555' }, RECIPIENT['A-1002']), '2026');
      check("B-SMALLBK's Copy B answers show box 1 9.99 and box 4 2.40", a.box1 === '9.99' && a.box4 === '2.40', [a.box1, a.box4]);
    });
  },

  // Every stop: one sentence naming the CPA, no form for the fund; with the stop cleared the forms return.
  async stops({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const run = (ws) => T.figuresInt(ws, ws.offerings[0], '2026', { today: TODAY });
    const sentence = (s) => !!s && /CPA/.test(s.text) && /^[^\n]+\.$/.test(s.text) && s.text.length < 300;
    await block(check, 'reporting', () => {
      const ws = wsD(NS, { reporting: 'partnership' });
      let F = run(ws);
      check('a fund set to partnership: the stop reporting and no form', codes(F) === 'reporting' && F.forms.length === 0 && sentence(F.stops[0]), F.stops);
      F = run(wsD(NS, { reporting: '' }));
      check('a fund with no reporting type: the stop reporting and no form', codes(F) === 'reporting' && F.forms.length === 0);
      NS.withholding.setReporting(ws, 'f1', 'notes', { by: BY, at: AT });
      F = run(ws);
      check('set to notes, the forms return', !F.stops.length && brief(F) === 'A-1001=2000000/0 A-1002=1333332/160000', brief(F));
    });
    await block(check, 'registered', () => {
      const ws = wsD(NS, { payerPatch: { registeredForm: false } });
      let F = run(ws);
      check('registered form not confirmed: the stop registered and no form', codes(F) === 'registered' && F.forms.length === 0 && sentence(F.stops[0]), F.stops);
      T.setPayer(ws, 'f1', { registeredForm: true }, { by: BY, at: AT });
      F = run(ws);
      check('confirmed, the forms return', !F.stops.length && F.forms.length === 2);
    });
    await block(check, 'in-money', () => {
      const ws = wsD(NS, { payerPatch: { paidInMoney: false } });
      let F = run(ws);
      check('paid in money not confirmed: the stop in-money, naming Form 1099-OID, and no form', codes(F) === 'in-money' && F.forms.length === 0 && sentence(F.stops[0]) && /1099-OID/.test(F.stops[0].text), F.stops);
      T.setPayer(ws, 'f1', { paidInMoney: true }, { by: BY, at: AT });
      check('confirmed, the forms return', run(ws).forms.length === 2);
      const none = wsD(NS, { payer: false });
      check('no payer record at all: both confirmation stops', codes(run(none)) === 'in-money registered', codes(run(none)));
    });
    await block(check, 'other-withholding', () => {
      for (const kind of ['state', 'foreign']) {
        const ws = wsD(NS);
        rec(NS, ws, 'x-nov', '2026-11-16', 'Interest', 1000000, { 'A-1001': [other(kind, 5000, 500000)] });
        let F = run(ws);
        const s = (F.stops || [])[0];
        check(`a line of A-1001 (on a form) carrying ${kind} withholding: the stop other-withholding naming that payment, no form`, codes(F) === 'other-withholding' && s.runId === 'x-nov' && sentence(s) && F.forms.length === 0, F.stops);
        NS.data.cancelRun(ws, 'x-nov', { by: BY, at: AT, why: 'Recorded by mistake.' });
        F = run(ws);
        check(`with that payment cancelled (${kind}), the forms return as in example D`, !F.stops.length && brief(F) === 'A-1001=2000000/0 A-1002=1333332/160000', brief(F));
      }
      const ws = wsD(NS);
      rec(NS, ws, 'x-nov', '2026-11-16', 'Interest', 1000000, { 'A-1003': [other('foreign', 50000, 166667)] });
      check('foreign withholding on A-1003, who is left out (Form 1042-S), stops nothing', !run(ws).stops.length, run(ws).stops);
    });
    await block(check, 'backup-not-interest', () => {
      const ws = wsD(NS);
      rec(NS, ws, 'p-nov', '2026-11-16', 'Principal', 6000000, { 'A-1002': [bk(480000, 2000000)] });
      let F = run(ws);
      const s = (F.stops || [])[0];
      check('backup withholding stored on a Principal payment: the stop backup-not-interest naming it, no form', codes(F) === 'backup-not-interest' && s.runId === 'p-nov' && sentence(s) && F.forms.length === 0, F.stops);
      NS.data.cancelRun(ws, 'p-nov', { by: BY, at: AT, why: 'Recorded by mistake.' });
      F = run(ws);
      check('with it cancelled, box 4 is again 160,000 for A-1002', !F.stops.length && brief(F) === 'A-1001=2000000/0 A-1002=1333332/160000', brief(F));
    });
  },

  // Which payments count as interest; a person's answer; cancelled, later and unpaid payments.
  async kinds({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const run = (ws, today) => T.figuresInt(ws, ws.offerings[0], '2026', { today: today || TODAY });
    const counts = (ws, today) => T.interestRuns(ws, ws.offerings[0], '2026', today || TODAY).map((r) => `${r.run.id}:${r.counts}`).join(' ');
    await block(check, 'types', () => {
      const ws = wsD(NS);
      rec(NS, ws, 'roc', '2026-10-01', 'Return of capital', 600000);
      check('Return of capital does not count and is listed as not interest', / roc:not-interest/.test(' ' + counts(ws)) && !run(ws).stops.length, counts(ws));
      for (const type of ['Income', 'Distribution']) {
        const w2 = wsD(NS);
        rec(NS, w2, 'q', '2026-10-15', type, 600000);
        let F = run(w2);
        check(`a payment of type ${type} is ask and stops the fund's forms naming it`, / q:ask/.test(' ' + counts(w2)) && codes(F) === 'kind' && F.stops[0].runId === 'q' && /CPA/.test(F.stops[0].text) && F.forms.length === 0, F.stops);
        check('setInterest needs a named person', refuses(w2, () => T.setInterest(w2, 'q', true, { at: AT })).threw);
        T.setInterest(w2, 'q', true, { by: BY, at: AT });
        F = run(w2);
        check(`said to be interest (${type}): it counts (A-1001 2,000,000 + 300,000; A-1002 1,333,332 + 200,000)`, brief(F) === 'A-1001=2300000/0 A-1002=1533332/160000' && w2.runs.find((r) => r.id === 'q').tax.by === BY, brief(F));
        T.setInterest(w2, 'q', false, { by: BY, at: AT });
        F = run(w2);
        check(`said not to be interest (${type}): it counts for nothing`, brief(F) === 'A-1001=2000000/0 A-1002=1333332/160000' && / q:not-interest/.test(' ' + counts(w2)), brief(F));
      }
      check('a payment whose type settles it cannot be answered (Principal)', refuses(ws, () => T.setInterest(ws, 'p-dec', true, { by: BY, at: AT })).threw);
    });
    await block(check, 'not paid', () => {
      const ws = wsD(NS);
      rec(NS, ws, 'c-nov', '2026-11-16', 'Interest', 1000000);
      NS.data.cancelRun(ws, 'c-nov', { by: BY, at: AT, why: 'Recorded by mistake.' });
      rec(NS, ws, 'next-jan', '2027-01-15', 'Interest', 1000000);
      check('a cancelled payment and one dated in 2027 count for nothing in 2026', brief(run(ws)) === 'A-1001=2000000/0 A-1002=1333332/160000' && !/c-nov|next-jan/.test(counts(ws)), counts(ws));
      // looked at on 2026-12-01: the December payments are not yet paid
      check('looked at on 2026-12-01, the December payments are not yet paid and count for nothing', brief(run(ws, '2026-12-01')) === 'A-1001=1500000/0 A-1002=999999/80000', brief(run(ws, '2026-12-01')));
    });
  },

  // A payment saved before the record existed; confirming the totals.
  async legacy({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const ws = wsD(NS);
    const o = ws.offerings[0];
    const run = () => T.figuresInt(ws, o, '2026', { today: TODAY });
    await block(check, 'legacy', () => {
      ws.runs.push({ id: 'old-oct', offeringId: 'f1', date: '2026-10-15', type: 'Interest', total: 1000000, status: 'paid', source: 'console', file: '' });
      let F = run();
      check('an interest payment without stored lines: the stop stored naming it, no form', codes(F) === 'stored' && F.stops[0].runId === 'old-oct' && /CPA/.test(F.stops[0].text) && F.forms.length === 0, F.stops);
      check('while it stands, nothing worked out again from positions is counted: totalCents is the stored 4,000,000', F.totalCents === 4000000, F.totalCents);
      NS.data.confirmLines(ws, 'old-oct', { by: BY, at: AT });
      F = run();
      check('after confirmLines it counts with the confirmed amounts (A-1001 2,500,000; A-1002 1,666,665)', !F.stops.length && brief(F) === 'A-1001=2500000/0 A-1002=1666665/160000', brief(F));
    });
    await block(check, 'confirm', () => {
      let F = run();
      const form = () => F.forms.find((f) => f.investorId === 'A-1002');
      check('not confirmed before confirmTotals', T.confirmed(ws, o, '2026', form()) === false);
      check('confirmTotals needs a named person', refuses(ws, () => T.confirmTotals(ws, 'f1', '2026', 'A-1002', { at: AT, today: TODAY })).threw);
      check('confirmTotals refuses an investor with no form (A-1003)', refuses(ws, () => T.confirmTotals(ws, 'f1', '2026', 'A-1003', { by: BY, at: AT, today: TODAY })).threw);
      T.confirmTotals(ws, 'f1', '2026', 'A-1002', { by: BY, at: AT, today: TODAY });
      const c = ((((o.tax || {}).years || {})['2026'] || {}).confirmed || {})['A-1002'] || {};
      check('confirmTotals stores the two box amounts with who and when', c.box1Cents === 1666665 && c.box4Cents === 160000 && c.by === BY && c.at === AT, c);
      check('confirmed answers true', T.confirmed(ws, o, '2026', form()) === true);
      rec(NS, ws, 'late-dec', '2026-12-20', 'Interest', 1000000);
      F = run();
      check('after a later payment changes the figures, confirmed answers false again', T.confirmed(ws, o, '2026', form()) === false, form());
      rec(NS, ws, 'bad-q', '2026-12-21', 'Income', 1000000);
      check('confirmTotals refuses while a stop stands', refuses(ws, () => T.confirmTotals(ws, 'f1', '2026', 'A-1001', { by: BY, at: AT, today: TODAY })).threw);
    });
  },

  // The number read from a signed, flattened W-9 (C-05).
  async w9read({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const map = NS.taxmaps['W-9 2024-03'];
    const blank = fs.readFileSync(path.join(ROOT, map.file));
    const opts = fillOpts();
    let rects = null;
    await block(check, 'rects', async () => {
      rects = await T.w9Rects(W(), blank, map, { sha256: opts.sha256 });
      check('w9Rects gives the name, business, address and city lines, three SSN cells and two EIN cells', !!rects && ['name', 'business', 'address', 'cityStateZip'].every((k) => rects[k] && rects[k].w > 0) && rects.ssn.length === 3 && rects.ein.length === 2, rects && Object.keys(rects));
      const bad = Buffer.from(blank);
      bad[bad.length >> 1] ^= 0xff;
      let got = 'untouched';
      try {
        got = await T.w9Rects(W(), bad, map, { sha256: opts.sha256 });
      } catch (e) {
        got = e;
      }
      check('a blank W-9 with one byte changed is refused', !!got && typeof got.message === 'string' && got.pin === true, String(got && got.message));
    });
    if (!rects) return;
    const page1 = async (bytes) => (await readPdf(bytes, NS)).pages[0].items;
    await block(check, 'individual', async () => {
      const filled = await NS.taxforms.fill(W(), blank, map, { name: 'Morgan Testcase', address: '5 Pine Rd', cityStateZip: 'Denver, CO 80202', individual: true, ssn: W9_SSN }, opts);
      const r = T.readW9(await page1(filled), rects);
      check('an individual: the name line, the address lines', r.name === 'Morgan Testcase' && r.business === '' && r.address === '5 Pine Rd' && r.cityStateZip === 'Denver, CO 80202', r.name + ' | ' + r.address + ' | ' + r.cityStateZip);
      check('the nine digits from the SSN boxes, type SSN (last four 7730)', r.tin === W9_SSN && r.tinType === 'SSN', 'type ' + r.tinType + ', last four ' + String(r.tin).slice(-4));
      check('the number passes checkTin against 7730', T.checkTin(r.tin, '7730').ok === true);
    });
    await block(check, 'entity', async () => {
      const filled = await NS.taxforms.fill(W(), blank, map, { name: 'Example Holdings LLC', business: 'Example Lending', llc: true, llcLetter: 'P', address: '77 Market St Ste 5', cityStateZip: 'Boston, MA 02110', ein: W9_EIN }, opts);
      const r = T.readW9(await page1(filled), rects);
      check('an entity: name, business name, the nine digits from the EIN boxes, type EIN (last four 4567)', r.name === 'Example Holdings LLC' && r.business === 'Example Lending' && r.tin === W9_EIN && r.tinType === 'EIN', 'type ' + r.tinType + ', last four ' + String(r.tin).slice(-4));
    });
    await block(check, 'empty', () => {
      const r = T.readW9([], rects);
      check('a page with no text gives an empty number and type', r.tin === '' && r.tinType === '' && r.name === '');
    });
  },

  // The number check, truncation, the proposals, and no number stored anywhere (C-05, D4, D12).
  async tincheck({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    await block(check, 'checkTin', () => {
      const ok = T.checkTin(W9_SSN, '7730');
      check('nine digits ending in the four on record are accepted', ok.ok === true);
      check('the dashed form is accepted too', T.checkTin(`${W9_SSN.slice(0, 3)}-${W9_SSN.slice(3, 5)}-${W9_SSN.slice(5)}`, '7730').ok === true);
      const bad = [
        ['eight digits', W9_SSN.slice(0, 8)],
        ['ten digits', W9_SSN + '1'],
        ['letters', W9_SSN.slice(0, 8) + 'A'],
        ['nine digits ending in other digits', W9_SSN.slice(0, 8) + '1']
      ];
      bad.forEach(([what, v]) => {
        const r = T.checkTin(v, '7730');
        check(`${what} are refused with the reason`, r.ok === false && typeof r.why === 'string' && r.why.length > 10, r.why);
      });
      check('no last four on record: refused', T.checkTin(W9_SSN, '').ok === false);
      check('truncate gives ***-**-7730 for an SSN', T.truncate(W9_SSN, 'SSN') === '***-**-7730');
      check('truncate gives **-***4567 for an EIN', T.truncate(W9_EIN, 'EIN') === '**-***4567');
    });
    await block(check, 'last four (D12)', () => {
      const foreignOnly = inv('C-FTIN', 1000, { taxType: 'us-individual', taxForm: 'W-9', tinLast4: '', taxCert: { form: 'W-9', signed: true, signedBy: 'Signer', tinLast4: '', ftinLast4: '9911', backupWithholding: false } });
      check('last4Of: never a foreign number', T.last4Of(foreignOnly) === '');
      check('last4Of: taxCert first, then the record', T.last4Of(inv('x', 1, w9('7730'))) === '7730' && T.last4Of(inv('y', 1, { tinLast4: '1212' })) === '1212');
      const ws = wsLines(NS, [foreignOnly, inv('C-OK', 1000, w9('7730'))], [{ investorId: 'C-FTIN', grossCents: 50000 }, { investorId: 'C-OK', grossCents: 50000 }]);
      const F = T.figuresInt(ws, ws.offerings[0], '2026', { today: TODAY });
      const x = (F.leftOut || []).find((v) => v.investorId === 'C-FTIN') || {};
      check('an investor whose only four digits are a foreign number gets no form: reason no signed W-9', x.code === 'no-w9' && /signed W-9/.test(x.reason) && brief(F) === 'C-OK=50000/0', x);
    });
    await block(check, 'proposals', () => {
      const n = T.splitName('Jane Q. Public Jr.');
      check('splitName proposes first, middle, last and suffix without periods', n.first === 'Jane' && n.middle === 'Q' && n.last === 'Public' && n.suffix === 'Jr', n);
      const a = T.splitName('José Núñez');
      check('splitName proposes plain letters for accented ones', a.first === 'Jose' && a.last === 'Nunez', a);
      const c = T.splitCityStateZip('Austin, TX 78701-1234');
      check('splitCityStateZip proposes city, state and ZIP without the dash', c.city === 'Austin' && c.state === 'TX' && c.zip === '787011234', c);
    });
    await block(check, 'nothing stored', () => {
      const ws = wsD(NS);
      check('setPayer refuses a full number in any field', refuses(ws, () => T.setPayer(ws, 'f1', { tin: PAYER_TIN }, { by: BY, at: AT })).threw && refuses(ws, () => T.setPayer(ws, 'f1', { name: PAYER_TIN }, { by: BY, at: AT })).threw && refuses(ws, () => T.setPayer(ws, 'f1', { tinLast4: PAYER_TIN }, { by: BY, at: AT })).threw);
      // every function that writes, run once with numbers in hand
      rec(NS, ws, 'q', '2026-10-15', 'Income', 600000);
      T.setInterest(ws, 'q', true, { by: BY, at: AT });
      const F = T.figuresInt(ws, ws.offerings[0], '2026', { today: TODAY });
      T.confirmTotals(ws, 'f1', '2026', 'A-1002', { by: BY, at: AT, today: TODAY });
      T.copyBAnswers(F.forms[1], payerObj(), recipientObj('A-1002'), '2026');
      T.iris.row('1099-INT', '2026', F.forms[1], payerObj(), recipientObj('A-1002'));
      T.checkTin(TIN['A-1002'], '7310');
      const nums = [PAYER_TIN, TIN['A-1001'], TIN['A-1002'], W9_SSN, W9_EIN];
      const text = J(ws);
      check('the workspace and its change log hold no taxpayer number of any shape', numberHits(text, nums).length === 0 && Array.isArray(ws.audit) && ws.audit.length > 0, numberHits(text, nums));
      // the search can fail: an invented number put into a copy of the workspace is found in each of its forms
      const planted = (s) => numberHits(text.replace('"title":"Investor A-1001"', `"title":"Investor ${s}"`), nums).length > 0;
      const d = TIN['A-1001'];
      check('the search finds a planted number as digits, dashed, and first five beside last four', planted(d) && planted(dashedSsn(d)) && planted(`${d.slice(0, 5)} ${d.slice(5)}`) && planted(dashedEin(W9_EIN)));
    });
  },

  // The upload file's rows and files (TAX-12, C-01).
  async rows({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const cols = NS.tax1099data.IRIS.columns['1099-INT'];
    const head = T.iris.header('1099-INT');
    check('the header has 66 names in the IRS order, A to BN, Form Type first and State 2 - Special Data Entries last', head.length === 66 && head[0] === 'Form Type' && head[65] === 'State 2 - Special Data Entries' && cols.every((c, k) => c.col === letters(k)), head.length);
    check('every column carries its source and its rule', cols.every((c) => /1099-INT Template Formatting Guidelines/.test(c.source) && typeof c.rule === 'string' && c.rule.length > 5), cols.filter((c) => !c.rule).map((c) => c.col));
    check('headerPinned and centsConfirmed are false, the rules are for tax year 2025, read 2026-11-19', NS.tax1099data.IRIS.headerPinned === false && NS.tax1099data.IRIS.centsConfirmed === false && NS.tax1099data.IRIS.taxYearOfRules === '2025' && NS.tax1099data.IRIS.read === '2026-11-19');
    const ws = wsD(NS);
    const F = T.figuresInt(ws, ws.offerings[0], '2026', { today: TODAY });
    const f2 = F.forms.find((f) => f.investorId === 'A-1002');
    const r2 = T.iris.row('1099-INT', '2026', f2, payerObj(), recipientObj('A-1002'));
    const filled = (r) => r.map((v, k) => (v !== '' ? letters(k) : '')).filter(Boolean).join(' ');
    check("A-1002's row fills exactly the form type, year, payer, recipient (an individual) and the two amounts", filled(r2) === 'A B C D E F L M O P Q R S T U V Y AA AC AD AE AF AG AH AN AQ', filled(r2));
    check('an individual has name type I with first and last names and no business name', r2[col('V')] === 'I' && r2[col('Y')] === 'Avery' && r2[col('AA')] === 'Example' && r2[col('W')] === '');
    check('the payer: EIN, name type B, its name, US, its address and a domestic phone', r2[col('E')] === 'B' && r2[col('F')] === 'Fund One Notes LLC' && r2[col('L')] === 'US' && r2[col('P')] === 'TX' && r2[col('Q')] === '75201' && r2[col('R')] === 'D' && r2[col('S')] === '214-555-0100');
    const ent = { tinType: 'EIN', tin: W9_EIN, nameType: 'B', name: 'Example Holdings LLC', name2: 'Example Lending', country: 'US', address1: '77 Market St Ste 5', address2: '', city: 'Boston', state: 'MA', zip: '02110' };
    const re = T.iris.row('1099-INT', '2026', f2, payerObj(), ent);
    check('an entity has name type B with its business name lines and no first or last name', re[col('V')] === 'B' && re[col('W')] === 'Example Holdings LLC' && re[col('X')] === 'Example Lending' && re[col('Y')] === '' && re[col('AA')] === '' && re[col('T')] === 'EIN' && re[col('U')] === dashedEin(W9_EIN));
    check('both rows pass every rule', T.iris.validate('1099-INT', [r2, re]).length === 0, T.iris.validate('1099-INT', [r2, re]));
    let files = [];
    await block(check, 'files', () => {
      files = T.iris.files('1099-INT', [r2, re]);
      check('two rows: one file of 2 rows, the header line first', files.length === 1 && files[0].rows === 2 && files[0].text.split('\r\n')[0] === head.join(','), files.map((x) => x.rows));
      const many = Array.from({ length: 237 }, (_, k) => T.iris.row('1099-INT', '2026', f2, payerObj(), Object.assign({}, recipientObj('A-1002'), { tin: '000' + String(k + 1).padStart(6, '0') })));
      const big = T.iris.files('1099-INT', many);
      check('237 rows: three files of 100, 100 and 37 rows, each starting with the header line', big.length === 3 && big.map((x) => x.rows).join(',') === '100,100,37' && big.every((x) => x.text.split('\r\n')[0] === head.join(',')), big.map((x) => x.rows));
      check('each file has its header line and one line per row, every line 66 cells', big.every((x) => { const ls = x.text.split('\r\n').filter(Boolean); return ls.length === x.rows + 1 && ls.every((l) => l.split(',').length === 66); }));
      check('the files have distinct names naming the form, the year and the part', new Set(big.map((x) => x.name)).size === 3 && big.every((x) => /^1099-INT-2026-part-[1-3]-of-3\.csv$/.test(x.name)), big.map((x) => x.name));
      const all = big.map((x) => x.text).join('');
      check('no quotation mark and no asterisk anywhere in a file', !/["*]/.test(all));
      const tinCells = big.map((x) => x.text.split('\r\n').slice(1).filter(Boolean).map((l) => { const c = l.split(','); return [c[col('D')], c[col('U')]]; })).flat(2);
      check('every taxpayer number in the files is digits and dashes: no letter X or other mask standing in for a digit', tinCells.length === 474 && tinCells.every((v) => /^[0-9-]+$/.test(v) && /\d{4}$/.test(v)));
      const bad = r2.slice();
      bad[col('AH')] = '7870';
      check('iris.files refuses to build while a fault stands', refuses(ws, () => T.iris.files('1099-INT', [r2, bad])).threw);
    });
    await block(check, 'filed', () => {
      const h = 'ab'.repeat(32);
      check('markFiled needs a named person and a receipt id', refuses(ws, () => T.markFiled(ws, 'f1', '2026', { receiptId: 'Receipt-A1', date: '2027-02-10', sha256: h, rows: 2, at: AT })).threw && refuses(ws, () => T.markFiled(ws, 'f1', '2026', { date: '2027-02-10', sha256: h, rows: 2, by: BY, at: AT })).threw);
      T.markFiled(ws, 'f1', '2026', { receiptId: 'Receipt-A1', date: '2027-02-10', sha256: h, rows: 2, by: BY, at: AT });
      const got = (((ws.offerings[0].tax.years || {})['2026'] || {}).filed || [])[0] || {};
      check('markFiled stores the form, receipt id, date, the file fingerprint, the row count, who and when', got.form === '1099-int' && got.receiptId === 'Receipt-A1' && got.date === '2027-02-10' && got.sha256 === h && got.rows === 2 && got.by === BY && got.at === AT, Object.keys(got));
    });
  },

  // Each deliberate fault is caught and named by row and column; the files are refused while it stands.
  async faults({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const head = T.iris.header('1099-INT');
    const ws = wsD(NS);
    const F = T.figuresInt(ws, ws.offerings[0], '2026', { today: TODAY });
    const f2 = F.forms.find((f) => f.investorId === 'A-1002');
    const good = T.iris.row('1099-INT', '2026', f2, payerObj(), recipientObj('A-1002'));
    const ent = T.iris.row('1099-INT', '2026', f2, payerObj(), { tinType: 'EIN', tin: W9_EIN, nameType: 'B', name: 'Example Holdings LLC', name2: '', country: 'US', address1: '77 Market St Ste 5', address2: '', city: 'Boston', state: 'MA', zip: '02110' });
    check('the two good rows pass', T.iris.validate('1099-INT', [good, ent]).length === 0);
    const list = [
      ['an accented letter in a first name', good, 'Y', 'Avéry'],
      ['a period in a last name', good, 'AA', 'Ex.ample'],
      ['a comma in a business name', ent, 'W', 'Example, Holdings'],
      ['a business name of 41 characters', ent, 'W', 'A'.repeat(41)],
      ['a first name of 21 characters', good, 'Y', 'A'.repeat(21)],
      ['an address line of 36 characters', good, 'AD', 'A'.repeat(36)],
      ['an address line with a character the rule does not list', good, 'AD', '22 Oak Ave #4'],
      ['a digit in a city', good, 'AF', 'Austin2'],
      ['a state of three letters', good, 'AG', 'TXS'],
      ['a ZIP of four digits', good, 'AH', '7870'],
      ['a ZIP with a dash', good, 'AH', '78701-1234'],
      ['a doubled space', good, 'AD', '22  Oak Ave'],
      ['a leading space', good, 'Y', ' Avery'],
      ["a recipient number not in its type's pattern", good, 'U', TIN['A-1002']],
      ['a required cell left empty', good, 'AD', ''],
      ['a negative amount', good, 'AN', '-5.00'],
      ['an amount with three decimals', good, 'AN', '13333.321'],
      ['an amount in scientific notation', good, 'AN', '1.045E+5'],
      ['a cell that starts with an equals sign', good, 'AE', '=1+1'],
      ['a cell that starts with a plus sign', good, 'AE', '+1 Floor'],
      ['a cell that starts with a minus sign', good, 'AE', '-1 Floor'],
      ['a cell that starts with an at sign', good, 'AE', '@Floor']
    ];
    list.forEach(([what, base, c, v]) => {
      const bad = base.slice();
      bad[col(c)] = v;
      const rows = [base === good ? ent : good, bad];
      const faults = T.iris.validate('1099-INT', rows);
      const hit = faults.find((x) => x.row === 2 && x.col === c);
      check(`${what}: caught on row 2, column ${c} (${head[col(c)]}), with a plain reason`, !!hit && hit.name === head[col(c)] && typeof hit.why === 'string' && hit.why.length > 10 && faults.every((x) => x.row === 2 && x.col === c), faults);
      check(`${what}: iris.files refuses to build`, refuses(ws, () => T.iris.files('1099-INT', rows)).threw);
    });
  },

  // Both checks: an unknown name and an empty list exit 1 with FAIL.
  async selfcheck({ check: raw }) {
    const check = masked(raw);
    const { spawnSync } = require('child_process');
    const run = (file, args) => spawnSync(process.execPath, [path.join(__dirname, file)].concat(args), { encoding: 'utf8' });
    [['tax-1099.js', '--case'], ['tax-forms.js', '--only']].forEach(([file, flag]) => {
      const a = run(file, [flag, 'nosuch']);
      check(`${file}: an unknown name exits 1 with a FAIL line`, a.status === 1 && /^FAIL unknown/m.test(a.stdout) && /: FAIL \(\w+ run: 0\)/.test(a.stdout), a.stdout);
      const b = run(file, [flag, ',']);
      check(`${file}: an empty list exits 1 with a FAIL line`, b.status === 1 && /^FAIL no /m.test(b.stdout), b.stdout);
    });
  },

  // Form 1099-DIV (plan 10-11, D-02, C-07): example E to the cent, the odd line, S-2001's row and its recipient copy.
  async 'div-split'({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const ws = wsE(NS);
    const o = ws.offerings[0];
    let F = null;
    await block(check, 'div-split', () => {
      splitE(NS, ws);
      const s1 = (ws.runs.find((r) => r.id === 'd-apr').tax || {}).div || {};
      const s2 = (ws.runs.find((r) => r.id === 'd-oct').tax || {}).div || {};
      check('the April split is stored as amounts of the distribution: 700,000 / 100,000 / 200,000, box 5 700,000, entered by a named person', J(s1.cents) === J({ '1a': 700000, '2a': 100000, '3': 200000 }) && s1.part && s1.part['5'] === 700000 && s1.source === 'entered' && s1.by === BY && s1.at === AT, s1);
      check('the October split: 300,000 / 0 / 300,000, box 5 300,000', J(s2.cents) === J({ '1a': 300000, '2a': 0, '3': 300000 }) && s2.part && s2.part['5'] === 300000, s2);
      F = T.figuresDiv(ws, o, '2026', { today: TODAY });
      check('no stop and nobody left out', (F.stops || []).length === 0 && (F.leftOut || []).length === 0, { stops: F.stops, leftOut: F.leftOut });
      check(
        'example E: S-2001 400,000 / 40,000 / 200,000 with box 5 400,000; S-2002 60,000 / 0 / 60,000 with box 5 60,000; S-2003 540,000 / 60,000 / 240,000 with box 5 540,000 (boxes 1a/1b/2a/2b/2c/2d/2e/2f/3/4/5)',
        briefDiv(F) === 'S-2001=400000/0/40000/0/0/0/0/0/200000/0/400000 S-2002=60000/0/0/0/0/0/0/0/60000/0/60000 S-2003=540000/0/60000/0/0/0/0/0/240000/0/540000',
        briefDiv(F)
      );
      const cash = (F.forms || []).map((f) => `${f.investorId}=${f.cashCents}`).join(' ');
      check('cash paid: S-2001 640,000, S-2002 120,000, S-2003 840,000', cash === 'S-2001=640000 S-2002=120000 S-2003=840000', cash);
      check("each investor's 1a + 2a + 3 is exactly what they were paid", (F.forms || []).length === 3 && F.forms.every((f) => f.boxes['1a'] + f.boxes['2a'] + f.boxes['3'] === f.cashCents));
      const sum = (b) => (F.forms || []).reduce((a, f) => a + f.boxes[b], 0);
      check("the fund's totals: 1a 1,000,000 = 700,000 + 300,000, 2a 100,000, 3 500,000 = 200,000 + 300,000, cash 1,600,000", sum('1a') === 1000000 && sum('2a') === 100000 && sum('3') === 500000 && F.totalCents === 1600000, [sum('1a'), sum('2a'), sum('3'), F.totalCents]);
      const a1 = (F.forms || []).find((f) => f.investorId === 'S-2001') || {};
      check("S-2001's form names both distributions; S-2002's only October's", J((a1.runIds || []).slice().sort()) === J(['d-apr', 'd-oct']) && J(((F.forms || []).find((f) => f.investorId === 'S-2002') || {}).runIds) === J(['d-oct']), a1.runIds);
      check('figuresDiv reads nothing from the capital-account engine: the figures stand after every position is set to zero', (() => {
        const w2 = JSON.parse(J(ws));
        w2.investors.forEach((i) => i.positions.forEach((p) => (p.amount = 0)));
        return briefDiv(T.figuresDiv(w2, w2.offerings[0], '2026', { today: TODAY })) === briefDiv(F);
      })());
    });
    await block(check, 'odd line', () => {
      const w = wsE(NS);
      w.runs = [runE('d-odd', '2026-06-30', [['S-2001', 333333], ['S-2003', 666667]])];
      T.setSplit(w, 'd-odd', { pct: { '1a': 70, '2a': 10, '3': 20 }, partPct: { '5': 70, '1b': 35 } }, { by: BY, at: AT });
      const G = T.figuresDiv(w, w.offerings[0], '2026', { today: TODAY });
      const s = (G.forms || []).find((f) => f.investorId === 'S-2001') || {};
      const b = s.boxes || {};
      check('a gross of 333,333 under 70 / 10 / 20: 233,333 / 33,333 / 66,667 (the odd cent to the largest remainder, box 3)', b['1a'] === 233333 && b['2a'] === 33333 && b['3'] === 66667, b);
      check('box 5 as the whole of 1a is 233,333; box 1b at 35% of the distribution is 116,667 (116,666.55)', b['5'] === 233333 && b['1b'] === 116667, b);
      const t = (G.forms || []).find((f) => f.investorId === 'S-2003') || {};
      check("the other line, 666,667: its three boxes add up to it and box 5 equals its 1a", !!t.boxes && t.boxes['1a'] + t.boxes['2a'] + t.boxes['3'] === 666667 && t.boxes['5'] === t.boxes['1a'], t.boxes);
    });
    if (!F || !(F.forms || []).length) return;
    const f1 = F.forms.find((f) => f.investorId === 'S-2001');
    await block(check, 'row', () => {
      const r = T.iris.row('1099-DIV', '2026', f1, payerE(), recipientE('S-2001'));
      check('a Form 1099-DIV row has 69 cells, A to BQ', Array.isArray(r) && r.length === 69, r && r.length);
      check("S-2001's row: AM (1a) 4000.00, AO (2a) 400.00, AU (3) 2000.00, AW (5) 4000.00", r[col('AM')] === '4000.00' && r[col('AO')] === '400.00' && r[col('AU')] === '2000.00' && r[col('AW')] === '4000.00', ['AM', 'AO', 'AU', 'AW'].map((c) => `${c}=${r[col(c)]}`));
      check('AN (1b), AP to AT (2b to 2f) and AV (4) are empty', ['AN', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AV'].every((c) => r[col(c)] === ''), ['AN', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AV'].map((c) => `${c}=${r[col(c)]}`));
      const others = DIV_BOX_COLS.filter((c) => ['AM', 'AO', 'AU', 'AW'].indexOf(c) < 0 && r[col(c)] !== '');
      check('every other box column, AM to BQ, is empty', others.length === 0, others);
      check('form type 1099-DIV, tax year 2026, the payer and the recipient in full in D and U', r[col('A')] === '1099-DIV' && r[col('B')] === '2026' && r[col('D')] === dashedEin(PAYER_TIN) && r[col('U')] === dashedSsn(TIN_E['S-2001']) && r[col('Y')] === 'Riley' && r[col('AA')] === 'Example');
      const faults = T.iris.validate('1099-DIV', [r]);
      check('iris.validate finds no fault in the row', Array.isArray(faults) && faults.length === 0, faults);
    });
    await block(check, 'copy B', async () => {
      const map = NS.tax1099data.MAPS['1099-DIV 2024-01 Copy B'];
      check('the Copy B map of Form 1099-DIV exists and T.COPY_B_OF names it', !!map && T.COPY_B_OF && T.COPY_B_OF['1099-DIV'] === '1099-DIV 2024-01 Copy B');
      const answers = T.copyBAnswers(f1, payerE(), recipientE('S-2001'), '2026', '1099-DIV');
      check('the answers carry the four amounts and leave every other box empty', answers.box1a === '4,000.00' && answers.box2a === '400.00' && answers.box3 === '2,000.00' && answers.box5 === '4,000.00' && ['box1b', 'box2b', 'box2c', 'box2d', 'box2e', 'box2f', 'box4'].every((k) => answers[k] === ''), answers);
      const bytes = await T.recipientCopy(W(), fs.readFileSync(path.join(ROOT, map.file)), map, answers, fillOpts());
      const got = await readPdf(bytes, NS);
      check("the recipient's copy has two pages: Copy B and the recipient's instructions", got.pages.length === 2, got.pages.length);
      const p1 = got.pages[0] ? got.pages[0].text : '';
      check('its first page is Copy B, For Recipient, of Form 1099-DIV', /Copy B/.test(p1) && /For Recipient/.test(p1) && /1099-DIV/.test(p1));
      check('its second page is the instructions for the recipient', !!got.pages[1] && /Instructions for Recipient/.test(got.pages[1].text));
      check('it has no form field left', got.fields === 0, got.fields);
      check("the first page shows the recipient's number truncated to its last four", p1.indexOf('***-**-6601') >= 0);
      check('the first page shows 4,000.00, 400.00 and 2,000.00', p1.indexOf('4,000.00') >= 0 && p1.indexOf('400.00') >= 0 && p1.indexOf('2,000.00') >= 0);
      const all = got.pages.map((p) => p.text).join(' ');
      check("the recipient's nine digits appear nowhere on the copy, with or without dashes", all.replace(/\s+/g, '').indexOf(TIN_E['S-2001']) < 0 && all.replace(/\s+/g, '').indexOf(dashedSsn(TIN_E['S-2001'])) < 0 && all.replace(/\D/g, '').indexOf(TIN_E['S-2001']) < 0);
    });
    check('the workspace and its change log hold no taxpayer number', numberHits(J(ws), [PAYER_TIN].concat(Object.values(TIN_E))).length === 0, numberHits(J(ws), [PAYER_TIN].concat(Object.values(TIN_E))));
  },

  // Every arithmetic rule refused by name, nothing stored; percents and amounts; the year's split; the IRS's rule by choice.
  async 'div-rules'({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const R = T.DIV_RULES || {};
    const div = (ws, id) => ((ws.runs.find((r) => r.id === id) || {}).tax || {}).div;
    await block(check, 'refusals', () => {
      const ws = wsE(NS);
      const bad = [
        ['1a + 2a + 3 of 70 + 10 + 10 percent', 'sum', { pct: { '1a': 70, '2a': 10, '3': 10 } }],
        ['amounts that do not add up to the distribution', 'sum', { cents: { '1a': 700000, '2a': 100000, '3': 100000 } }],
        ['box 1b more than box 1a', '1b', { pct: { '1a': 70, '2a': 10, '3': 20 }, partPct: { '1b': 71 } }],
        ['box 5 more than box 1a', '5', { pct: { '1a': 70, '2a': 10, '3': 20 }, partPct: { '5': 80 } }],
        ['box 2e more than box 1a', '2e', { pct: { '1a': 70, '2a': 10, '3': 20 }, partPct: { '2e': 75 } }],
        ['2b + 2c + 2d more than 2a', '2bcd', { pct: { '1a': 70, '2a': 10, '3': 20 }, partPct: { '2b': 5, '2c': 4, '2d': 2 } }],
        ['box 2f more than box 2a', '2f', { pct: { '1a': 70, '2a': 10, '3': 20 }, partPct: { '2f': 11 } }],
        ['a negative percent', 'negative', { pct: { '1a': 110, '2a': -10, '3': 0 } }],
        ['a negative amount', 'negative', { cents: { '1a': 1100000, '2a': -100000, '3': 0 } }],
        ['a negative portion', 'negative', { pct: { '1a': 70, '2a': 10, '3': 20 }, partPct: { '1b': -1 } }],
        ['a percent with five decimals', 'decimals', { pct: { '1a': '33.33333', '2a': '33.33333', '3': '33.33334' } }],
        ['amounts in parts of a cent', 'whole', { cents: { '1a': 700000.5, '2a': 99999.5, '3': 200000 } }]
      ];
      bad.forEach(([what, rule, spec]) => {
        let err = null;
        const before = J(ws);
        try {
          T.setSplit(ws, 'd-apr', spec, { by: BY, at: AT });
        } catch (e) {
          err = e;
        }
        check(`${what}: refused, naming the rule (${rule}), and nothing stored`, !!err && err.rule === rule && !!R[rule] && String(err.message).indexOf(R[rule]) >= 0 && J(ws) === before && !div(ws, 'd-apr'), err ? { rule: err.rule, msg: err.message } : 'not refused');
      });
      let e2 = null;
      try {
        T.setSplit(ws, 'd-apr', { pct: { '1a': 70, '2a': 10, '3': 20 } }, { by: BY, at: AT, offeringId: 'f2' });
      } catch (e) {
        e2 = e;
      }
      check('a split given for a distribution that is not the fund\'s: refused (fund), nothing stored', !!e2 && e2.rule === 'fund' && !div(ws, 'd-apr'), e2 && e2.message);
      const wn = wsE(NS, { reporting: 'notes' });
      const r3 = refuses(wn, () => T.setSplit(wn, 'd-apr', { pct: { '1a': 70, '2a': 10, '3': 20 } }, { by: BY, at: AT }));
      check('a split for a fund not set to corporation or REIT: refused, nothing stored', r3.threw && r3.unchanged && /corporation or REIT/.test(r3.msg), r3.msg);
      check('setSplit needs a named person', refuses(ws, () => T.setSplit(ws, 'd-apr', { pct: { '1a': 70, '2a': 10, '3': 20 } }, { at: AT })).threw && !div(ws, 'd-apr'));
      check('setYearSplit needs a named person and refuses a broken split', refuses(ws, () => T.setYearSplit(ws, 'f1', '2026', { pct: { '1a': 70, '2a': 10, '3': 20 } }, { at: AT })).threw && refuses(ws, () => T.setYearSplit(ws, 'f1', '2026', { pct: { '1a': 70, '2a': 10, '3': 10 } }, { by: BY, at: AT })).threw);
      check('wholeDividend needs a named person', refuses(ws, () => T.wholeDividend(ws, 'd-apr', { at: AT })).threw && !div(ws, 'd-apr'));
    });
    await block(check, 'amounts', () => {
      const ws = wsE(NS);
      T.setSplit(ws, 'd-apr', { pct: { '1a': '33.3333', '2a': '33.3333', '3': '33.3334' } }, { by: BY, at: AT });
      check('33.3333 / 33.3333 / 33.3334 percent of 1,000,000 cents stores 333,333 / 333,333 / 333,334', J(div(ws, 'd-apr').cents) === J({ '1a': 333333, '2a': 333333, '3': 333334 }), div(ws, 'd-apr').cents);
      T.setSplit(ws, 'd-apr', { cents: { '1a': 700000, '2a': 100000, '3': 200000 }, part: { '5': 700000 } }, { by: BY, at: AT });
      const a = div(ws, 'd-apr');
      check('a split given as amounts is stored as given, with who and when', J(a.cents) === J({ '1a': 700000, '2a': 100000, '3': 200000 }) && a.part['5'] === 700000 && a.part['1b'] === 0 && a.by === BY && a.source === 'entered', a);
      check("the odd cent's tie goes by box order 1a, 2a, 3: 2 cents of a 1 / 1 / 1 split are 1 / 1 / 0", J(T.divShare(2, { cents: { '1a': 1, '2a': 1, '3': 1 }, part: {} })) === J({ '1a': 1, '2a': 1, '3': 0, '1b': 0, '2e': 0, '5': 0, '2b': 0, '2c': 0, '2d': 0, '2f': 0 }), T.divShare(2, { cents: { '1a': 1, '2a': 1, '3': 1 }, part: {} }));
      const s = T.divShare(333333, { cents: { '1a': 700000, '2a': 100000, '3': 200000 }, part: { '2b': 40000, '2c': 30000, '2d': 30000, '2f': 100000 } });
      check('2b + 2c + 2d equal to 2a in the split: the three add up to exactly the investor\'s 2a, and 2f equal to 2a is the investor\'s 2a', s['2b'] + s['2c'] + s['2d'] === s['2a'] && s['2f'] === s['2a'], s);
    });
    await block(check, 'year and IRS rule', () => {
      const ws = wsE(NS);
      const o = ws.offerings[0];
      const before = J(ws);
      const F0 = T.figuresDiv(ws, o, '2026', { today: TODAY });
      check('the portal never proposes a split: with none given, both distributions stop the forms and figuresDiv stores nothing', codes(F0) === 'split split' && F0.forms.length === 0 && J(ws) === before, codes(F0));
      T.setYearSplit(ws, 'f1', '2026', { pct: { '1a': 70, '2a': 10, '3': 20 }, partPct: { '5': 70 } }, { by: BY, at: AT });
      const src = ws.runs.map((r) => `${r.id}:${(T.splitOf(ws, o, r) || {}).source}`).join(' ');
      check('setYearSplit applies one split to every distribution of the year, each marked as from the year', src === 'd-apr:year d-oct:year' && !!((o.tax.years || {})['2026'] || {}).divYear && ((o.tax.years || {})['2026'] || {}).divYear.by === BY, src);
      let F = T.figuresDiv(ws, o, '2026', { today: TODAY });
      check('with the year\'s split, October\'s 600,000 is 420,000 / 60,000 / 120,000 (S-2002 84,000 / 12,000 / 24,000)', F.stops.length === 0 && boxLine(F.forms.find((f) => f.investorId === 'S-2002')) === '84000/0/12000/0/0/0/0/0/24000/0/84000', briefDiv(F));
      T.setSplit(ws, 'd-oct', { pct: { '1a': 50, '2a': 0, '3': 50 }, partPct: { '5': 50 } }, { by: BY, at: AT });
      F = T.figuresDiv(ws, o, '2026', { today: TODAY });
      check("a distribution's own split wins over the year's: example E's figures", (T.splitOf(ws, o, ws.runs[1]) || {}).source === 'entered' && briefDiv(F) === 'S-2001=400000/0/40000/0/0/0/0/0/200000/0/400000 S-2002=60000/0/0/0/0/0/0/0/60000/0/60000 S-2003=540000/0/60000/0/0/0/0/0/240000/0/540000', briefDiv(F));
      T.clearYearSplit(ws, 'f1', '2026', { by: BY, at: AT });
      check("with the year's split removed, April stops again", codes(T.figuresDiv(ws, o, '2026', { today: TODAY })) === 'split');
      const w2 = wsE(NS);
      const before2 = J(w2.runs);
      check('the IRS rule is never applied by the portal: figuresDiv leaves the runs as they were', T.figuresDiv(w2, w2.offerings[0], '2026', { today: TODAY }).forms.length === 0 && J(w2.runs) === before2);
      T.wholeDividend(w2, 'd-apr', { by: BY, at: AT });
      const d = div(w2, 'd-apr');
      check('wholeDividend stores 1a as the whole distribution, the source irs-default and the person', J(d.cents) === J({ '1a': 1000000, '2a': 0, '3': 0 }) && d.source === 'irs-default' && d.by === BY && d.at === AT, d);
      check('the change log names the IRS rule and the person who chose it', (w2.audit || []).some((e) => /whole payment/i.test(e.action + ' ' + e.detail) && e.actor === BY));
    });
  },

  // The stops and the leave-outs of Form 1099-DIV; box 4; other withholding; confirming every box.
  async 'div-stops'({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const run = (ws) => T.figuresDiv(ws, ws.offerings[0], '2026', { today: TODAY });
    const sentence = (s) => !!s && /CPA/.test(s.text) && /^[^\n]+\.$/.test(s.text) && s.text.length < 300;
    await block(check, 'reporting', () => {
      for (const rep of ['notes', 'partnership', '']) {
        const ws = wsE(NS, { reporting: rep });
        const F = run(ws);
        const s = (F.stops || []).find((x) => x.code === 'reporting');
        check(`a fund set to ${rep || 'nothing'}: the stop reporting, naming the CPA, and no form`, !!s && sentence(s) && /1099-DIV/.test(s.text) && F.forms.length === 0, F.stops);
      }
    });
    await block(check, 'split', () => {
      const ws = wsE(NS);
      T.setSplit(ws, 'd-apr', { pct: { '1a': 70, '2a': 10, '3': 20 }, partPct: { '5': 70 } }, { by: BY, at: AT });
      const F = run(ws);
      const s = (F.stops || [])[0];
      check('a paid distribution with no split: the stop split naming it (its date), and no form', codes(F) === 'split' && s.runId === 'd-oct' && /2026-10-15/.test(s.text) && sentence(s) && F.forms.length === 0, F.stops);
      ws.runs.push(runE('d-dec', '2026-12-28', [['S-2001', 1000]]));
      ws.runs[ws.runs.length - 1].cancelled = true;
      ws.runs.push(runE('d-next', '2027-02-15', [['S-2001', 1000]]));
      check('a cancelled distribution and one of another year stop nothing', codes(run(ws)) === 'split');
    });
    await block(check, 'stored', () => {
      const ws = wsE(NS);
      splitE(NS, ws);
      ws.runs.push({ id: 'd-old', offeringId: 'f1', date: '2026-07-15', type: 'Distribution', total: 100000, status: 'paid', source: 'history' });
      const F = run(ws);
      check('a distribution without stored lines: the stop stored naming it, and no form', codes(F) === 'stored' && F.stops[0].runId === 'd-old' && sentence(F.stops[0]) && F.forms.length === 0, F.stops);
    });
    await block(check, 'leftout', () => {
      const seat = [
        inv('B-IRA', 1000, Object.assign(w9('1111'), { type: 'ira' })),
        inv('B-FOR', 1000, w8ben()),
        inv('B-EXM', 1000, w9('2222')),
        inv('B-SMALL', 1000, w9('3333')),
        inv('B-NOW9', 1000, { taxType: 'us-individual', taxForm: '', tinLast4: '' }),
        inv('B-TEN', 1000, w9('4444')),
        inv('B-SMALLBK', 1000, w9('5555', true)),
        inv('B-EXP', 1000, w8ben({ validUntil: '2025-12-31' }))
      ];
      const ws = wsE(NS);
      ws.investors = ws.investors.concat(seat);
      ws.runs = [runE('d-b', '2026-09-15', [['B-IRA', 50000], ['B-FOR', 50000], ['B-EXM', 50000], ['B-SMALL', 999], ['B-NOW9', 50000], ['B-TEN', 1000], ['B-SMALLBK', 999, [bk(240, 999)]], ['B-EXP', 50000]])];
      NS.withholding.markExempt(ws, 'B-EXM', { by: BY, at: AT });
      T.setSplit(ws, 'd-b', { pct: { '1a': 70, '2a': 10, '3': 20 } }, { by: BY, at: AT });
      const F = run(ws);
      check('forms: B-SMALLBK ($9.99 paid, $2.40 withheld) and B-TEN ($10.00 paid); nobody else', (F.forms || []).map((f) => f.investorId).join() === 'B-SMALLBK,B-TEN', briefDiv(F));
      const lo = {};
      (F.leftOut || []).forEach((x) => (lo[x.investorId] = x));
      const want = { 'B-IRA': ['ira', /IRA.*1099-DIV/, 50000], 'B-FOR': ['foreign', /1042-S/, 50000], 'B-EXM': ['exempt', /exempt.*1099-DIV/i, 50000], 'B-SMALL': ['under-10', /\$10.*1099-DIV/, 999], 'B-NOW9': ['no-w9', /signed W-9.*1099-DIV/, 50000], 'B-EXP': ['no-form', /expired.*1099-DIV/, 50000] };
      Object.keys(want).forEach((id) => {
        const [code, re, cents] = want[id];
        const x = lo[id] || {};
        check(`${id} is left out (${code}) with its own reason naming Form 1099-DIV where it applies, and its ${cents} cents paid`, x.code === code && re.test(x.reason || '') && x.cents === cents, x);
      });
      check('exactly six are left out, and the forms and the left out add up to the whole paid (252,998)', (F.leftOut || []).length === 6 && F.totalCents === 252998 && (F.forms || []).reduce((a, f) => a + f.cashCents, 0) + (F.leftOut || []).reduce((a, x) => a + x.cents, 0) === 252998, F.totalCents);
      const b = (F.forms || []).find((f) => f.investorId === 'B-SMALLBK') || {};
      check("B-SMALLBK's box 4 is 240, equal to NS.withholding.withheldFor (kind backup), and its three boxes add up to 999", !!b.boxes && b.boxes['4'] === 240 && b.boxes['4'] === NS.withholding.withheldFor(ws, { investorId: 'B-SMALLBK', offeringId: 'f1', year: '2026', kind: 'backup', today: TODAY }) && b.boxes['1a'] + b.boxes['2a'] + b.boxes['3'] === 999, b.boxes);
      const t = (F.forms || []).find((f) => f.investorId === 'B-TEN') || {};
      check("B-TEN's box 4 is empty (0)", !!t.boxes && t.boxes['4'] === 0, t.boxes);
    });
    await block(check, 'other-withholding', () => {
      const ws = wsE(NS);
      splitE(NS, ws);
      ws.runs.push(runE('d-nov', '2026-11-16', [['S-2001', 500000, [other('foreign', 150000, 500000)]]]));
      T.setSplit(ws, 'd-nov', { pct: { '1a': 100, '2a': 0, '3': 0 } }, { by: BY, at: AT });
      let F = run(ws);
      const s = (F.stops || [])[0];
      check('a confirmed 30% line on S-2001 (on a form): the stop other-withholding naming that distribution, no form (box 4 holds backup only)', codes(F) === 'other-withholding' && s.runId === 'd-nov' && sentence(s) && F.forms.length === 0, F.stops);
      NS.data.cancelRun(ws, 'd-nov', { by: BY, at: AT, why: 'Recorded by mistake.' });
      F = run(ws);
      check('with it cancelled, example E returns', !F.stops.length && briefDiv(F) === 'S-2001=400000/0/40000/0/0/0/0/0/200000/0/400000 S-2002=60000/0/0/0/0/0/0/0/60000/0/60000 S-2003=540000/0/60000/0/0/0/0/0/240000/0/540000', briefDiv(F));
      const w2 = wsE(NS, { investors: [inv('S-2009', 1000, w8ben())] });
      splitE(NS, w2);
      w2.runs.push(runE('d-for', '2026-11-16', [['S-2009', 100000, [other('foreign', 30000, 100000)]]]));
      T.setSplit(w2, 'd-for', { pct: { '1a': 100, '2a': 0, '3': 0 } }, { by: BY, at: AT });
      const G = run(w2);
      check('a 30% line on a foreign investor, who is left out (Form 1042-S), stops nothing', !G.stops.length && (G.leftOut || []).some((x) => x.investorId === 'S-2009' && x.code === 'foreign'), G.stops);
    });
    await block(check, 'confirm', () => {
      const ws = wsE(NS);
      const o = ws.offerings[0];
      splitE(NS, ws);
      let F = run(ws);
      const form = () => F.forms.find((f) => f.investorId === 'S-2001');
      check('not confirmed before confirmTotals', T.confirmed(ws, o, '2026', form()) === false);
      check('confirmTotals needs a named person', refuses(ws, () => T.confirmTotals(ws, 'f1', '2026', 'S-2001', { at: AT, today: TODAY })).threw);
      T.confirmTotals(ws, 'f1', '2026', 'S-2001', { by: BY, at: AT, today: TODAY });
      const c = (((o.tax.years || {})['2026'] || {}).confirmed || {})['S-2001'] || {};
      check('confirmTotals stores every box of the form with who and when', c.form === '1099-DIV' && !!c.boxes && DIV_BOXES.every((b) => c.boxes[b] === form().boxes[b]) && c.by === BY && c.at === AT, c);
      check('confirmed answers true', T.confirmed(ws, o, '2026', form()) === true);
      check('the change log has "Form 1099-DIV totals confirmed"', (ws.audit || []).some((e) => e.action === 'Form 1099-DIV totals confirmed' && e.record === 'S-2001'));
      T.setSplit(ws, 'd-oct', { pct: { '1a': 40, '2a': 10, '3': 50 }, partPct: { '5': 40 } }, { by: BY, at: AT });
      F = run(ws);
      check('after the split of a distribution changes, confirmed answers false again', T.confirmed(ws, o, '2026', form()) === false, boxLine(form()));
    });
  },

  // The Form 1099-DIV rows and files (TAX-12): the header, example E's three rows, the faults of case faults, the files.
  async 'div-rows'({ check: raw }) {
    const check = masked(raw);
    const NS = load();
    const T = NS.tax1099;
    const cols = (NS.tax1099data.IRIS.columns || {})['1099-DIV'] || [];
    let head = [];
    await block(check, 'header', () => {
      head = T.iris.header('1099-DIV');
      check('the header has 69 names in the IRS order, A to BQ: Form Type first, Box 1a at AM, Box 5 at AW, State 2 - Special Data Entries last', head.length === 69 && head[0] === 'Form Type' && head[col('AM')] === 'Box 1a - Total ordinary dividends' && head[col('AW')] === 'Box 5 - Section 199A dividends' && head[68] === 'State 2 - Special Data Entries' && cols.every((c, k) => c.col === letters(k)), head.length);
      check('every column carries its source in the 1099-DIV guidelines and its rule', cols.length === 69 && cols.every((c) => /1099-DIV Template Formatting Guidelines/.test(c.source) && typeof c.rule === 'string' && c.rule.length > 5), cols.filter((c) => !c.rule || !/1099-DIV/.test(c.source)).map((c) => c.col));
      check('the box columns: 1a AM, 1b AN, 2a AO, 2b-2f AP-AT, 3 AU, 4 AV, 5 AW', J(NS.tax1099data.IRIS.boxes['1099-DIV']) === J(DIV_COL), NS.tax1099data.IRIS.boxes['1099-DIV']);
      check('column A takes only 1099-DIV, and headerPinned stays false (the header is not compared with the IRS\'s own template)', J(cols[0].values) === J(['1099-DIV']) && NS.tax1099data.IRIS.headerPinned === false);
    });
    const ws = wsE(NS);
    splitE(NS, ws);
    const F = T.figuresDiv(ws, ws.offerings[0], '2026', { today: TODAY });
    const rowOf = (id, rec) => T.iris.row('1099-DIV', '2026', F.forms.find((f) => f.investorId === id), payerE(), rec || recipientE(id));
    let rows = [];
    await block(check, 'rows', () => {
      rows = ['S-2001', 'S-2002', 'S-2003'].map((id) => rowOf(id));
      const v = (r) => ['AM', 'AO', 'AU', 'AW'].map((c) => r[col(c)]).join(' ');
      check("example E's three rows: S-2001 4000.00 400.00 2000.00 4000.00; S-2002 600.00, empty, 600.00, 600.00; S-2003 5400.00 600.00 2400.00 5400.00 (AM AO AU AW)", v(rows[0]) === '4000.00 400.00 2000.00 4000.00' && v(rows[1]) === '600.00  600.00 600.00' && v(rows[2]) === '5400.00 600.00 2400.00 5400.00', rows.map(v));
      const filled = (r) => r.map((x, k) => (x !== '' ? letters(k) : '')).filter(Boolean).join(' ');
      check("S-2001's row fills exactly the form type, year, payer, recipient and its four amounts", filled(rows[0]) === 'A B C D E F L M O P Q R S T U V Y AA AC AD AF AG AH AM AO AU AW', filled(rows[0]));
      check('the three rows pass every rule', T.iris.validate('1099-DIV', rows).length === 0, T.iris.validate('1099-DIV', rows));
      const withBk = T.iris.row('1099-DIV', '2026', Object.assign({}, F.forms[0], { boxes: Object.assign({}, F.forms[0].boxes, { '4': 240 }) }), payerE(), recipientE('S-2001'));
      check('box 4 is written in AV (2.40) and nowhere else', withBk[col('AV')] === '2.40' && withBk[col('AQ')] === '', [withBk[col('AV')], withBk[col('AQ')]]);
    });
    if (!rows.length) return;
    await block(check, 'faults', () => {
      const good = rows[0];
      const ent = rowOf('S-2003', { tinType: 'EIN', tin: W9_EIN, nameType: 'B', name: 'Example Holdings LLC', name2: '', country: 'US', address1: '77 Market St Ste 5', address2: '', city: 'Boston', state: 'MA', zip: '02110' });
      check('a business recipient row passes', T.iris.validate('1099-DIV', [good, ent]).length === 0);
      const list = [
        ['an accented letter in a first name', good, 'Y', 'Rílëy'],
        ['a period in a last name', good, 'AA', 'Ex.ample'],
        ['a comma in a business name', ent, 'W', 'Example, Holdings'],
        ['a business name of 41 characters', ent, 'W', 'A'.repeat(41)],
        ['an address line with a character the rule does not list', good, 'AD', '31 Birch Ln #4'],
        ['a digit in a city', good, 'AF', 'Plano2'],
        ['a ZIP of four digits', good, 'AH', '7502'],
        ['a doubled space', good, 'AD', '31  Birch Ln'],
        ["a recipient number not in its type's pattern", good, 'U', TIN_E['S-2001']],
        ['a required cell left empty', good, 'AD', ''],
        ['a negative box 1a', good, 'AM', '-5.00'],
        ['box 3 with three decimals', good, 'AU', '2000.001'],
        ['box 5 in scientific notation', good, 'AW', '4.0E+3'],
        ['a cell that starts with an equals sign', good, 'AE', '=1+1'],
        ['a cell that starts with an at sign', good, 'AE', '@Floor']
      ];
      list.forEach(([what, base, c, v]) => {
        const bad = base.slice();
        bad[col(c)] = v;
        const rs = [base === good ? ent : good, bad];
        const faults = T.iris.validate('1099-DIV', rs);
        const hit = faults.find((x) => x.row === 2 && x.col === c);
        check(`${what}: caught on row 2, column ${c} (${head[col(c)]}), with a plain reason, and no file`, !!hit && hit.name === head[col(c)] && hit.why.length > 10 && faults.every((x) => x.row === 2 && x.col === c) && refuses(ws, () => T.iris.files('1099-DIV', rs)).threw, faults);
      });
    });
    await block(check, 'files', () => {
      const many = Array.from({ length: 237 }, (_, k) => rowOf('S-2001', Object.assign({}, recipientE('S-2001'), { tin: '000' + String(k + 1).padStart(6, '0') })));
      const big = T.iris.files('1099-DIV', many);
      check('237 rows: three files of 100, 100 and 37 rows, each starting with the header line', big.length === 3 && big.map((x) => x.rows).join(',') === '100,100,37' && big.every((x) => x.text.split('\r\n')[0] === head.join(',')), big.map((x) => x.rows));
      check('every line of every file has 69 cells', big.every((x) => x.text.split('\r\n').filter(Boolean).every((l) => l.split(',').length === 69)));
      check('the files are named for Form 1099-DIV, the year and the part', big.every((x) => /^1099-DIV-2026-part-[1-3]-of-3\.csv$/.test(x.name)), big.map((x) => x.name));
    });
    await block(check, 'filed', () => {
      T.markFiled(ws, 'f1', '2026', { receiptId: 'Receipt-E1', date: '2027-02-10', sha256: 'cd'.repeat(32), rows: 3, by: BY, at: AT });
      const got = (((ws.offerings[0].tax.years || {})['2026'] || {}).filed || [])[0] || {};
      check('markFiled on a corporation fund records the form 1099-div, logged as Form 1099-DIV', got.form === '1099-div' && got.rows === 3 && (ws.audit || []).some((e) => e.action === 'Form 1099-DIV file recorded as filed'), got.form);
    });
    check('the workspace and its change log hold no taxpayer number', numberHits(J(ws), [PAYER_TIN, W9_EIN].concat(Object.values(TIN_E))).length === 0);
  }
};

L.runParts(cases, { name: 'TAX 1099', unit: 'cases', flag: '--case' });
