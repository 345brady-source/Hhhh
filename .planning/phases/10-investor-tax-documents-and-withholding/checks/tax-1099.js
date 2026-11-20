// gate: node
// last "TAX 1099: PASS (cases run: 1)"
// Form 1099-INT's core (plan 10-09, assets/js/tax1099.js and tax1099-data.js), no browser: data.js, audit.js,
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
  }
};

L.runParts(cases, { name: 'TAX 1099', unit: 'cases', flag: '--case' });
