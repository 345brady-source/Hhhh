#!/usr/bin/env node
/*
 * The fields of a page read from its picture, checked in the portal's own page.
 *
 *   node picture-fields.js [--only shapes,owners,signing,twice,summary,refused,limit | all]
 *
 *   shapes    (needs no document) made-up picture pages, given as plain data to NS.placement.read in the shape
 *             NS.textread gives (found with bands and col, lines, heads, reader) with invented captions: one case for
 *             each kind rule (K1 to K6), each owner rule (O1 to O7), each trap, the deciding word lists, the
 *             same-size rule, two boxes that touch, and a page whose words could not be read
 *   owners    the owner's form uploaded as the upload form does and its text-less pages read (the offer's action):
 *             each field against its place of the answer sheet (centre inside the place grown by 3 pt): the investor's
 *             signer, the co-investor's, or somebody else's (NS.placement.isOther), optional, marked, named for the
 *             party, drawn with the class is-else and "for someone else" in its spoken name; a second investor's
 *             name begins "Co-investor: "; no reason holds a letters-only list word; nothing the portal says calls a
 *             second investor anything but Co-investor
 *   signing   every marked field confirmed, the agreement saved, and the agreement the portal makes for a sample
 *             investor with a co-investor and for one without: what NS.esign.fieldsOf hands each signer
 *   twice     the pages read a second time give the same fields in the same order; the list is sorted
 *   summary   NS.esign.readNote of the form's draft names each owner's signature pages from the answer sheet, in order
 *   refused   the text engine's file answered 404: every box still has a field named by its shape, marked, the
 *             investor's; no page is unread; the summary says the words could not be read
 *   limit     the form's pages read through NS.esign.autoFields with the time for words forced down to 2 seconds: the
 *             progress is called once for each page in page order; page 1 has its words, later pages only their boxes
 *             (reader 'limit'); every found empty box still has a field; on those pages each field is named by its
 *             shape and marked; the summary names exactly those pages with the limit's sentence; no page is unread
 *
 * The owner's documents live outside the repository (PICTURE_SCRATCH, or the session's folder under the system temp
 * folder). A part that needs a document it cannot find prints "NOT RUN: (what)" and the exit status is 2. Output holds
 * counts, pages and kinds only. Last line "PICTURE FIELDS: PASS" or "PICTURE FIELDS: FAIL - (what)"; exit 0 or 1.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const PDF = process.env.PRINTED_PDF || path.join(SCRATCH, 'xx/printed-no-text.pdf');
const SHEET = path.join(SCRATCH, 'build/ocr-truth/truth-printed.json');
const HARNESS = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/harness.js');
const ALL = ['shapes', 'owners', 'signing', 'twice', 'summary', 'refused', 'limit'];
const i = process.argv.indexOf('--only');
const want = i > 0 && process.argv[i + 1] ? process.argv[i + 1].split(',').map((s) => s.trim()) : ['all'];
const PARTS = want.includes('all') ? ALL : want;
const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
PARTS.forEach((p) => ALL.includes(p) || notRun(`--only ${p} is not a part (${ALL.join(', ')})`));
if (!fs.existsSync(HARNESS)) notRun('the check browser is missing (' + HARNESS + ')');
if (PARTS.some((p) => p !== 'shapes')) {
  if (!fs.existsSync(PDF)) notRun('the owner\'s form is missing (' + PDF + ')');
  if (!fs.existsSync(SHEET)) notRun('the answer sheet is missing (' + SHEET + ')');
}
try {
  require.resolve('playwright');
} catch (e) {
  process.env.NODE_PATH = [execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  require('module').Module._initPaths();
}
const H = require(HARNESS);

const fails = [];
const line = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) fails.push(text.split(':')[0]);
  return ok;
};

/* ---------------- shapes: made-up picture pages ---------------- */
const W_SLANT = 'This page is a picture';
const W_UNREAD = 'could not read the words by it, so it is named by its shape';
const W_NEAR = (m) => `took them to mean “${m}”`;
const W_OTHER = 'This place is for someone else to complete';
const W_SIZE = 'The boxes of the same size on this agreement are for';
/** A found box in points: bands { over, under, before, after, inside } as text. */
const bx = (x0, y0, x1, y1, bands, col) => {
  const b = {};
  ['over', 'under', 'before', 'after', 'inside'].forEach((k) => (b[k] = { s: (bands && bands[k]) || '', conf: bands && bands[k] ? 90 : 0 }));
  const w = x1 - x0;
  const h = y1 - y0;
  return { x0, y0, x1, y1, small: w <= 14 && h <= 14, ink: 0, shared: false, place: true, why: '', col: col == null ? -1 : col, inside: '', bands: b };
};
const tick = (x, y, after, col) => bx(x, y, x + 7.4, y + 7.4, { after }, col);
const head = (kind, s, x0, y0, x1, y1, col) => ({ kind, col: col == null ? -1 : col, x0, y0, x1, y1, s, conf: 90 });
const pageOf = (found, more) => Object.assign({ page: 1, w: 612, h: 792, items: [], rules: [], boxes: [], forms: [], pictured: 'picture', approx: true, found, words: [], lines: [], heads: [], reader: 'ok' }, more || {});
// Each case: a page, and what the field on each listed box must be (by the box's index in found; 'rule' for a rule's field).
const want1 = (k, owner, label, req, why) => ({ k, owner, label, req, why });
const CASES = [
  ['K1 a tick box named by the words after it', pageOf([tick(100, 100, 'Accredited by net worth')]), [want1(0, 'investor', 'Accredited by net worth', false, W_SLANT)], { type: 'checkbox' }],
  ['K1 a tick box with nothing read beside it', pageOf([tick(100, 100, '')]), [want1(0, 'investor', 'Tick box', false, W_UNREAD)], { type: 'checkbox' }],
  [
    'K2 the caption before, over, inside and under, in that order',
    pageOf([
      bx(150, 100, 300, 110, { before: 'Before words', over: 'Over words', inside: 'Inside words', under: 'Under words' }),
      bx(150, 140, 300, 150, { over: 'Over words', inside: 'Inside words', under: 'Under words' }),
      bx(150, 180, 300, 190, { inside: 'Inside words', under: 'Under words' }),
      bx(150, 220, 300, 230, { under: 'Under words' }),
      bx(100, 260, 145, 270, {}),
      bx(150, 260, 300, 270, { before: 'Before words', over: 'Over words' })
    ]),
    [want1(0, 'investor', 'Before words', false, W_SLANT), want1(1, 'investor', 'Over words', false, W_SLANT), want1(2, 'investor', 'Inside words', false, W_SLANT), want1(3, 'investor', 'Under words', false, W_SLANT), want1(5, 'investor', 'Over words', false, W_SLANT)],
    { type: 'text' }
  ],
  ['K2 a box wider than a tick box is never one', pageOf([bx(100, 100, 130, 108, { after: 'Yes', over: 'Reference' })]), [want1(0, 'investor', 'Reference', false, W_SLANT)], { type: 'text' }],
  ['K2 a sentence over a box is running text, not its caption', pageOf([bx(100, 100, 300, 110, { over: 'The answers below must be given in full by the person named.', under: 'Mailing address' })]), [want1(0, 'investor', 'Mailing address', false, W_SLANT)], { type: 'text' }],
  ['K3 initials by its own caption, read exactly', pageOf([bx(400, 100, 443, 108, { under: 'INITIALS' })]), [want1(0, 'investor', 'INITIALS', true, W_SLANT)], { type: 'initials' }],
  ['K3 initials by its own caption, read within the tolerance', pageOf([bx(400, 100, 443, 108, { under: 'INTALS' })]), [want1(0, 'investor', 'Initials', true, W_NEAR('Initials'))], { type: 'initials' }],
  ['K3 the verb in a sentence of its caption', pageOf([bx(250, 100, 273, 110, { before: 'Please initial to agree' })]), [want1(0, 'investor', 'Please initial to agree', true, W_SLANT)], { type: 'initials' }],
  ['K3 trap: "initial" before a noun is no initials', pageOf([bx(250, 100, 330, 110, { before: 'Initial investment amount' })]), [want1(0, 'investor', 'Initial investment amount', false, W_SLANT)], { type: 'text' }],
  [
    'K3 a column of three where two are read',
    pageOf([bx(400, 100, 443, 108, { under: 'INITIALS' }, 0), bx(400, 130, 443, 138, {}, 0), bx(400, 160, 443, 168, { under: 'INITIALS' }, 0)]),
    [want1(0, 'investor', 'INITIALS', true, W_SLANT), want1(1, 'investor', 'Initials', true, W_SLANT), want1(2, 'investor', 'INITIALS', true, W_SLANT)],
    { type: 'initials' }
  ],
  ['K4 a signature by its caption', pageOf([bx(130, 300, 290, 310, { over: 'SIGNATURE OF SUBSCRIBER' })]), [want1(0, 'investor', 'SIGNATURE OF SUBSCRIBER', true, W_SLANT)], { type: 'signature' }],
  ['K4 trap: a signatory named in a heading line is no signature', pageOf([bx(130, 300, 290, 310, { over: 'Details of the authorised signatory ENTITY NAME' })]), [want1(0, 'investor', 'Details of the authorised signatory ENTITY NAME', false, W_SLANT)], { type: 'text' }],
  [
    'K5 a date beside a signature, and a longer caption with the word date',
    pageOf([bx(130, 300, 290, 310, { over: 'SIGNATURE OF SUBSCRIBER' }), bx(295, 300, 330, 310, { over: 'DATE' }), bx(130, 340, 250, 350, { over: 'DATE OF BIRTH' })]),
    [want1(1, 'investor', 'DATE', false, W_SLANT), want1(2, 'investor', 'DATE OF BIRTH', false, W_SLANT)],
    { types: { 1: 'date', 2: 'text' } }
  ],
  ['K6 no caption read', pageOf([bx(100, 100, 250, 110, {})]), [want1(0, 'investor', 'Box', false, W_UNREAD)], { type: 'text' }],
  ['O1 a caption for a second investor', pageOf([bx(130, 100, 290, 110, { over: 'Co-subscriber first name' })]), [want1(0, 'co', 'Co-investor: Co-subscriber first name', false, W_SLANT)], { type: 'text' }],
  ['O1 a caption for a second investor read within the tolerance', pageOf([bx(130, 100, 290, 110, { over: 'CODINVESTOR SIGNATURE' })]), [want1(0, 'co', 'Co-investor: CODINVESTOR SIGNATURE', true, W_NEAR('Co-investor'))], { type: 'signature' }],
  ['O1 a caption for a third party (with what they do there)', pageOf([bx(130, 100, 290, 110, { over: 'Custodian signature' })]), [want1(0, 'other:Custodian', 'Custodian signature', false, W_OTHER)], { type: 'signature' }],
  ['O1 a caption naming a second investor and a third party together', pageOf([bx(130, 100, 290, 110, { over: 'SIGNATURE OF CO-INVESTOR OR CUSTODIAN' })]), [want1(0, 'co', 'Co-investor: SIGNATURE OF CO-INVESTOR OR CUSTODIAN', true, W_SLANT)], { type: 'signature' }],
  ['O1 trap: a third party named for what the investor gives about them', pageOf([bx(130, 100, 290, 110, { before: 'Custodian account number' })]), [want1(0, 'investor', 'Custodian account number', false, W_SLANT)], { type: 'text' }],
  ['O1 trap: a remark in brackets names nobody', pageOf([bx(130, 100, 290, 110, { over: 'Guardian name (not the same person as the co-investor)' })]), [want1(0, 'investor', 'Guardian name (not the same person as the co-investor)', false, W_SLANT)], { type: 'text' }],
  [
    'O2 a column head governs its column',
    pageOf([bx(400, 100, 443, 108, { over: 'JOINT', under: 'INITIALS' }, 0), bx(400, 130, 443, 138, { under: 'INITIALS' }, 0)], { heads: [head('column', 'JOINT', 400, 90, 443, 97, 0)] }),
    [want1(0, 'co', 'Co-investor: INITIALS', true, W_SLANT), want1(1, 'co', 'Co-investor: INITIALS', true, W_SLANT)],
    { type: 'initials' }
  ],
  [
    'O2 a box beside a column over the same rows is part of it',
    pageOf([bx(200, 100, 300, 110, { before: 'Name' }, 3), bx(200, 115, 300, 125, { before: 'Phone' }, 3), bx(320, 99, 480, 124, {})], { heads: [head('column', '(To be completed by the custodian)', 200, 90, 300, 97, 3)] }),
    [want1(0, 'other:Custodian', 'Custodian: Name', false, W_OTHER), want1(1, 'other:Custodian', 'Custodian: Phone', false, W_OTHER), want1(2, 'other:Custodian', 'Custodian: Box', false, W_OTHER)],
    { type: 'text' }
  ],
  [
    'O3 a lettered line governs to the next one',
    pageOf([bx(130, 120, 290, 130, { over: 'FIRST NAME' }), bx(130, 220, 290, 230, { over: 'FIRST NAME' })], { heads: [head('letter', 'B. Co-applicant details', 130, 100, 230, 107), head('letter', 'C. Beneficiary', 130, 200, 200, 207)] }),
    [want1(0, 'co', 'Co-investor: FIRST NAME', false, W_SLANT), want1(1, 'investor', 'FIRST NAME', false, W_SLANT)],
    { type: 'text' }
  ],
  [
    'O4 a margin heading for a third party, with its name',
    pageOf([bx(130, 120, 290, 130, { over: 'ACCOUNT NAME' }), bx(130, 140, 290, 150, { over: 'PHONE' })], { heads: [head('margin', '(5) CUSTODIAN INFORMATION', 20, 110, 120, 140)] }),
    [want1(0, 'other:Custodian', 'Custodian: ACCOUNT NAME', false, W_OTHER), want1(1, 'other:Custodian', 'Custodian: PHONE', false, W_OTHER)],
    { type: 'text' }
  ],
  ['O5 nothing names anyone: the investor', pageOf([bx(130, 120, 290, 130, { over: 'MAILING ADDRESS' })]), [want1(0, 'investor', 'MAILING ADDRESS', false, W_SLANT)], { type: 'text' }],
  [
    'O6 a date beside a second investor\'s signature',
    pageOf([bx(130, 300, 290, 310, { over: 'SIGNATURE OF CO-INVESTOR' }), bx(295, 300, 330, 310, { over: 'DATE' })]),
    [want1(1, 'co', 'Co-investor: DATE', false, W_SLANT)],
    { types: { 1: 'date' } }
  ],
  [
    'O7 a third party\'s signature and the date beside it',
    pageOf([bx(130, 300, 290, 310, { over: 'BROKER SIGNATURE' }), bx(295, 300, 330, 310, { over: 'DATE' })]),
    [want1(0, 'other:Broker-dealer', 'BROKER SIGNATURE', false, W_OTHER), want1(1, 'other:Broker-dealer', 'Broker-dealer: DATE', false, W_OTHER)],
    { types: { 0: 'signature', 1: 'date' } }
  ],
  [
    'one column, one person',
    pageOf([bx(400, 100, 443, 108, { under: 'CO-INVESTOR INITIALS' }, 0), bx(400, 130, 443, 138, { under: 'INITIALS' }, 0), bx(400, 160, 443, 168, { under: 'INITIALS' }, 0)]),
    [want1(0, 'co', 'Co-investor: CO-INVESTOR INITIALS', true, W_SLANT), want1(1, 'co', 'Co-investor: INITIALS', true, W_SLANT), want1(2, 'co', 'Co-investor: INITIALS', true, W_SLANT)],
    { type: 'initials' }
  ],
  ['trap: a tick box for a kind of account', pageOf([tick(100, 100, 'Joint account')]), [want1(0, 'investor', 'Joint account', false, W_SLANT)], { type: 'checkbox' }],
  ['trap: a blank captioned "Additional information"', pageOf([bx(130, 100, 290, 110, { over: 'Additional information' })]), [want1(0, 'investor', 'Additional information', false, W_SLANT)], { type: 'text' }],
  ['trap: a blank captioned "Second address line"', pageOf([bx(130, 100, 290, 110, { over: 'Second address line' })]), [want1(0, 'investor', 'Second address line', false, W_SLANT)], { type: 'text' }],
  ['trap: a blank captioned "Name of authorised representative"', pageOf([bx(130, 100, 290, 110, { over: 'Name of authorised representative' })]), [want1(0, 'investor', 'Name of authorised representative', false, W_SLANT)], { type: 'text' }],
  [
    'trap: a margin heading "Additional information" over three blanks',
    pageOf([bx(130, 120, 290, 130, { over: 'NOTES' }), bx(130, 140, 290, 150, {}), bx(130, 160, 290, 170, {})], { heads: [head('margin', '(6) Additional information', 20, 110, 120, 170)] }),
    [want1(0, 'investor', 'NOTES', false, W_SLANT), want1(1, 'investor', 'Box', false, W_UNREAD), want1(2, 'investor', 'Box', false, W_UNREAD)],
    { type: 'text' }
  ],
  [
    'same size: a lone box beside read initials boxes',
    pageOf([bx(400, 100, 443, 108, { under: 'INITIALS' }), bx(400, 140, 443, 148, { under: 'INITIALS' }), bx(200, 300, 243, 308, {})]),
    [want1(2, 'investor', 'Initials', true, W_SIZE)],
    { types: { 2: 'initials' } }
  ],
  ['same size: a lone box of a size no read box has', pageOf([bx(400, 100, 443, 108, { under: 'INITIALS' }), bx(200, 300, 260, 312, {})]), [want1(1, 'investor', 'Box', false, W_UNREAD)], { types: { 1: 'text' } }],
  [
    'same size: the read boxes of that size disagree',
    pageOf([bx(400, 100, 443, 108, { under: 'INITIALS' }), bx(100, 140, 143, 148, { over: 'SIGNATURE' }), bx(200, 300, 243, 308, {})]),
    [want1(2, 'investor', 'Box', false, W_UNREAD)],
    { types: { 2: 'text' } }
  ],
  [
    'a free rule in the main area keeps its field; one that begins in the margin column gets none',
    pageOf([], {
      items: [{ s: 'Percentage', x: 300, y: 200, w: 40, h: 7, conf: 90 }, { s: 'Note', x: 30, y: 400, w: 20, h: 7, conf: 90 }],
      rules: [{ x0: 345, x1: 400, y: 200, clear: 14, made: 'rule', cut: false, cell: false, table: false }, { x0: 55, x1: 150, y: 400, clear: 14, made: 'rule', cut: false, cell: false, table: false }],
      lines: [{ x0: 345, x1: 400, y: 200, t: 1, bands: {} }, { x0: 55, x1: 150, y: 400, t: 1, bands: {} }],
      heads: [head('margin', '(9) NOTES', 20, 300, 120, 700)]
    }),
    [],
    { rules: 1 }
  ]
];
const LIST_CASES = true;

async function shapes(page) {
  const got = await page.evaluate((cases) => {
    const NS = window.CVPortal;
    const P = NS.placement;
    const out = cases.map(([name, pg]) => {
      const r = P.read([pg], {});
      return {
        name,
        fields: r.fields.map((f) => ({ type: f.type, owner: P.isOther(f) ? 'other:' + f.other : f.role === 'co' ? 'co' : f.role, label: f.label, req: !!f.required, why: f.why || '', conf: f.conf, x: f.x, y: f.y, w: f.w, h: f.h, boxed: !!f.boxed }))
      };
    });
    const L = NS.pictureWords;
    const lists = L ? { co: L.PARTY_WORDS.co.map((w) => w.slice(0, 2) + '-' + w.slice(2)).filter((w) => !L.CO_INVESTOR.test(w)), coCount: L.PARTY_WORDS.co.length, other: L.PARTY_WORDS.other.filter((w) => !L.OTHER_PARTY.test(w)), otherCount: L.PARTY_WORDS.other.length } : null;
    return { out, lists };
  }, CASES);
  const inBox = (f, b) => {
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    return cx > b.x0 && cx < b.x1 && cy > b.y0 && cy < b.y1;
  };
  got.out.forEach((res, n) => {
    const [name, pg, wants, more] = CASES[n];
    const errs = [];
    wants.forEach((w) => {
      const b = pg.found[w.k];
      const f = res.fields.find((x) => x.boxed && inBox(x, b));
      if (!f) return errs.push(`box ${w.k}: no field`);
      const type = more.type || (more.types && more.types[w.k]);
      if (type && f.type !== type) errs.push(`box ${w.k}: kind ${f.type}, not ${type}`);
      if (f.owner !== w.owner) errs.push(`box ${w.k}: owner ${f.owner}, not ${w.owner}`);
      if (f.label !== w.label) errs.push(`box ${w.k}: name "${f.label}", not "${w.label}"`);
      if (f.req !== w.req) errs.push(`box ${w.k}: required ${f.req}`);
      if (f.why.indexOf(w.why) < 0) errs.push(`box ${w.k}: reason "${f.why.slice(0, 70)}"`);
      if (f.conf === 'high') errs.push(`box ${w.k}: not marked`);
    });
    if (more.rules != null && res.fields.filter((f) => !f.boxed).length !== more.rules) errs.push(`${res.fields.filter((f) => !f.boxed).length} fields on rules, not ${more.rules}`);
    if (res.fields.length !== pg.found.length + (more.rules || 0)) errs.push(`${res.fields.length} fields for ${pg.found.length} boxes`);
    line(!errs.length, `shapes ${name}${errs.length ? ': ' + errs.join('; ') : ''}`);
  });
  const L = got.lists;
  line(!!L && L.coCount > 0 && !L.co.length, `shapes every tolerant form for a second investor, written with its hyphen, is matched by the exact pattern (${L ? L.coCount : 0} forms${L && L.co.length ? '; not matched: ' + L.co.join(', ') : ''})`);
  line(!!L && L.otherCount > 0 && !L.other.length, `shapes every tolerant third-party word is one the shared list holds (${L ? L.otherCount : 0} words${L && L.other.length ? '; not held: ' + L.other.join(', ') : ''})`);
  // Two boxes that touch, and one pixel apart: each its own field, none shared; and the list in reading order.
  const edge = await page.evaluate(() => {
    const P = window.CVPortal.placement;
    const b = (x0, y0, x1, y1, s) => ({ x0, y0, x1, y1, small: x1 - x0 <= 14 && y1 - y0 <= 14, place: true, why: '', col: -1, bands: { over: { s: '', conf: 0 }, under: { s: '', conf: 0 }, before: { s: '', conf: 0 }, after: { s: s || '', conf: 90 }, inside: { s: '', conf: 0 } } });
    const found = [b(100, 100, 107.4, 107.4, 'One'), b(100, 107.4, 107.4, 114.8, 'Two'), b(100, 115.5, 107.4, 122.9, 'Three'), b(200, 100, 260, 110), b(260, 100, 320, 110), b(150, 50, 200, 60)];
    const pg = { page: 2, w: 612, h: 792, items: [], rules: [], boxes: [], forms: [], pictured: 'picture', approx: true, found, words: [], lines: [], heads: [], reader: 'ok' };
    const r = P.read([pg], {});
    const f = r.fields;
    let shared = 0;
    for (let i = 0; i < f.length; i++) for (let k = i + 1; k < f.length; k++) if (Math.min(f[i].x + f[i].w, f[k].x + f[k].w) - Math.max(f[i].x, f[k].x) > 0.5 && Math.min(f[i].y + f[i].h, f[k].y + f[k].h) - Math.max(f[i].y, f[k].y) > 0.5) shared++;
    const sorted = f.every((p, i) => !i || f[i - 1].page < p.page || (f[i - 1].page === p.page && (f[i - 1].y < p.y || (f[i - 1].y === p.y && f[i - 1].x <= p.x))));
    // A page whose words could not be read: every box keeps its field, named by its shape, marked, the investor's.
    const blind = found.map((o) => Object.assign({}, o, { bands: { over: { s: '', conf: 0 }, under: { s: '', conf: 0 }, before: { s: '', conf: 0 }, after: { s: '', conf: 0 }, inside: { s: '', conf: 0 } } }));
    const r2 = P.read([Object.assign({}, pg, { found: blind, reader: 'load', heads: [] })], {});
    return { n: f.length, shared, sorted, blind: r2.fields.length, blindOk: r2.fields.every((p) => /^(Tick box|Box)$/.test(p.label) && p.conf !== 'high' && p.role === 'investor' && !p.second && /could not read the words/.test(p.why)), wordless: r2.wordless };
  });
  line(edge.n === 6 && edge.shared === 0, `shapes two boxes that touch and two one pixel apart each have their own field (${edge.n} fields for 6 boxes, ${edge.shared} pairs sharing more than 0.5 pt)`);
  line(edge.sorted, 'shapes the fields are listed by page, then top edge, then left edge');
  line(edge.blind === 6 && edge.blindOk, `shapes words not read: every box keeps its field, named Tick box or Box, marked, the investor's (${edge.blind} of 6)`);
}

/* ---------------- the owner's form ---------------- */
async function openForm(h, opts) {
  // A second reading of the same file is made in the same workspace (the page given).
  const page = (opts && opts.page) || (await H.signUp(h));
  if (opts && opts.refuse) await page.route('**/assets/js/textengine.js*', (r) => r.fulfill({ status: 404, body: '' }));
  const bytes = fs.readFileSync(PDF);
  const res = await page.evaluate(
    async ({ arr }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const off = ws.offerings[ws.offerings.length - 1];
      const file = new File([new Uint8Array(arr)], 'Agreement.pdf', { type: 'application/pdf' });
      const env = await NS.esign.agreementDraft(ws, off.id, { file, title: 'Subscription Agreement' });
      const before = env.fields.length;
      const asked = !!(env.read && env.read.scanned && env.read.scanned.length);
      // The offer's action: the pages with no text read from their picture.
      await NS.esignKit.rereadAgreement(env, { pictures: true });
      NS.app.save(true);
      return { envId: env.id, before, asked, offId: off.id };
    },
    { arr: Array.from(bytes) }
  );
  return Object.assign({ page }, res);
}
/** The fields of the draft, in points, with whose they are and how the editor draws them. */
async function draftFields(page, envId) {
  await page.evaluate((id) => (location.hash = 'console-envelope-' + id), envId);
  await page.waitForSelector('.es-editor .es-fld', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  return page.evaluate((id) => {
    const NS = window.CVPortal;
    const env = NS.state.ws.envelopes.find((e) => e.id === id);
    const signer = (sid) => env.signers.find((s) => s.id === sid) || {};
    return {
      note: NS.esign.readNote ? NS.esign.readNote(env) : '',
      read: env.read,
      fields: env.fields.map((f) => {
        const ps = env.pageSizes[f.page - 1];
        const el = document.querySelector(`.es-editor .es-fld[data-fid="${f.id}"]`);
        const s = signer(f.signerId);
        return { id: f.id, type: f.type, page: f.page, x0: f.x * ps.w, x1: (f.x + f.w) * ps.w, y0: f.y * ps.h, y1: (f.y + f.h) * ps.h, owner: NS.placement.isOther(f) ? 'third party' : s.co ? 'co-investor' : s.role === 'countersigner' ? 'firm' : 'investor', other: f.other || '', label: f.label || '', why: f.reviewReason || '', review: !!f.review, required: !!f.required, prefill: f.prefill || '', cls: el ? String(el.className) : '', aria: el ? el.getAttribute('aria-label') || '' : '' };
      })
    };
  }, envId);
}
const sheet = () => JSON.parse(fs.readFileSync(SHEET, 'utf8')).fields;
const WHOSE = { investor: 'investor', 'co-investor/second signer': 'co-investor', unclear: 'third party' };
/** Each place of the sheet with the field whose centre is inside it grown by 3 pt (nearest first). */
function match(places, fields) {
  const used = new Set();
  return places.map((p) => {
    const f = fields
      .filter((x) => x.page === p.page && !used.has(x.id))
      .map((x) => ({ x, cx: (x.x0 + x.x1) / 2, cy: (x.y0 + x.y1) / 2 }))
      .filter((o) => o.cx >= p.x0 - 3 && o.cx <= p.x1 + 3 && o.cy >= p.y0 - 3 && o.cy <= p.y1 + 3)
      .sort((a, b) => Math.hypot(a.cx - (p.x0 + p.x1) / 2, a.cy - (p.y0 + p.y1) / 2) - Math.hypot(b.cx - (p.x0 + p.x1) / 2, b.cy - (p.y0 + p.y1) / 2))[0];
    if (f) used.add(f.x.id);
    return { p, f: f ? f.x : null };
  });
}
// The letters-only spellings of a second investor the deciding list holds ("coinvestor"): never in the portal's words.
const LETTERS_ONLY = /\bco(subscriber|investor|purchaser|signer|signatory|owner|applicant)s?\b/i;
// What a second investor may be called by the portal: Co-investor, and nothing else.
const SECOND_NAMES = /\b(co-? ?(subscriber|purchaser|signer|signatory|owner|applicant)|joint (subscriber|investor|owner|purchaser)|second (subscriber|investor|purchaser|signer)|additional (subscriber|investor|purchaser))\b/i;

function owners(d) {
  const pairs = match(sheet(), d.fields);
  const missing = pairs.filter((x) => !x.f);
  const wrong = pairs.filter((x) => x.f && x.f.owner !== WHOSE[x.p.whose]);
  const count = (o) => pairs.filter((x) => x.f && x.f.owner === o).length;
  const want = (o) => pairs.filter((x) => WHOSE[x.p.whose] === o).length;
  line(!missing.length && !wrong.length, `owners each place's field is for the person the answer sheet names (investor ${count('investor')} of ${want('investor')}, co-investor ${count('co-investor')} of ${want('co-investor')}, someone else ${count('third party')} of ${want('third party')}${wrong.length ? '; differ: ' + wrong.slice(0, 8).map((x) => `page ${x.p.page} ${x.p.kind}`).join(', ') : ''}${missing.length ? '; no field: ' + missing.length : ''})`);
  const else_ = d.fields.filter((f) => f.owner === 'third party');
  const badElse = else_.filter((f) => f.required || !f.review || !f.other || !/\bis-else\b/.test(f.cls) || !/for someone else/.test(f.aria) || f.prefill);
  line(else_.length > 0 && !badElse.length, `owners every place for someone else is optional, marked, named for its party, drawn with the class is-else and "for someone else" in its spoken name, never filled in from onboarding (${else_.length - badElse.length} of ${else_.length}${badElse.length ? '; not so: ' + badElse.slice(0, 5).map((f) => `page ${f.page} ${f.type}`).join(', ') : ''})`);
  const co = d.fields.filter((f) => f.owner === 'co-investor');
  const badCo = co.filter((f) => !/^Co-investor: /.test(f.label));
  line(co.length > 0 && !badCo.length, `owners every second investor's field is named "Co-investor: " and its caption (${co.length - badCo.length} of ${co.length})`);
  const listed = d.fields.filter((f) => LETTERS_ONLY.test(f.why));
  line(!listed.length, `owners reasons holding a list word: ${listed.length}`);
  const prefix = d.fields.filter((f) => f.label.indexOf(':') > 0 && SECOND_NAMES.test(f.label.slice(0, f.label.indexOf(':'))));
  const words = d.fields.filter((f) => SECOND_NAMES.test(f.why)).length + (SECOND_NAMES.test(d.note) || LETTERS_ONLY.test(d.note) ? 1 : 0);
  line(!prefix.length && !words, `owners a second investor is called Co-investor and nothing else (names ${prefix.length}, reasons and summary ${words})`);
  line(d.fields.every((f) => f.review), `owners every field read from the picture is marked (${d.fields.filter((f) => f.review).length} of ${d.fields.length})`);
}

async function signing(page, d, offId, envId) {
  const res = await page.evaluate(
    ({ envId, offId }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const env = ws.envelopes.find((e) => e.id === envId);
      env.fields.forEach((f) => f.review && NS.placement.confirm(f));
      const todo = NS.esign.agreementTodo(env);
      const tpl = NS.esign.saveAgreement(ws, env);
      if (!tpl) return { error: todo || 'the agreement could not be saved' };
      const person = (id, co) => Object.assign({ id, contact: 'Sample Investor', title: 'Sample Investor', type: 'individual', email: `${id}@investor-example.com`, phone: '', address: '', positions: [], onboarding: { status: 'complete' } }, co ? { coInvestor: { first: 'Sample', last: 'Partner', name: 'Sample Partner', email: `${id}-co@investor-example.com`, added: NS.dates.today() } } : {});
      const out = {};
      [['withCo', true], ['alone', false]].forEach(([k, co]) => {
        const inv = person('inv-check-' + k, co);
        ws.investors.push(inv);
        const e = NS.esign.createFromTemplate(ws, tpl.id, { investorId: inv.id, offeringId: offId, quiet: true });
        const take = (s) => (s ? NS.esign.fieldsOf(e, s).map((f) => { const ps = e.pageSizes[f.page - 1]; return { id: f.id, type: f.type, page: f.page, x0: f.x * ps.w, x1: (f.x + f.w) * ps.w, y0: f.y * ps.h, y1: (f.y + f.h) * ps.h, required: !!f.required, value: f.value || '', prefill: f.prefill || '' }; }) : []);
        out[k] = { investor: take(e.signers.find((s) => s.investorId === inv.id && !s.co)), co: take(e.signers.find((s) => s.co)), signers: e.signers.length };
      });
      return out;
    },
    { envId, offId }
  );
  if (res.error) return line(false, `signing the agreement could not be saved: ${res.error}`);
  const places = sheet();
  const whoseAt = (f) => {
    const p = places.find((q) => q.page === f.page && (f.x0 + f.x1) / 2 >= q.x0 - 3 && (f.x0 + f.x1) / 2 <= q.x1 + 3 && (f.y0 + f.y1) / 2 >= q.y0 - 3 && (f.y0 + f.y1) / 2 <= q.y1 + 3);
    return p ? WHOSE[p.whose] : 'none';
  };
  const tally = (list) => list.reduce((m, f) => ((m[whoseAt(f)] = (m[whoseAt(f)] || 0) + 1), m), {});
  const want = (o) => places.filter((p) => WHOSE[p.whose] === o).length;
  const a = tally(res.withCo.investor);
  const b = tally(res.withCo.co);
  line(a.investor === want('investor') && Object.keys(a).length === 1 && b['co-investor'] === want('co-investor') && Object.keys(b).length === 1, `signing with a co-investor: the investor is handed exactly the investor's places (${JSON.stringify(a)}), the co-investor exactly the second investor's (${JSON.stringify(b)})`);
  const c = tally(res.alone.investor);
  line(c.investor === want('investor') && Object.keys(c).length === 1 && !res.alone.co.length, `signing with no co-investor: nobody is handed a second investor's or a third party's place (${JSON.stringify(c)}, co-investor ${res.alone.co.length})`);
  const all = res.withCo.investor.concat(res.withCo.co, res.alone.investor);
  const onElse = all.filter((f) => whoseAt(f) === 'third party');
  line(!onElse.length && !all.some((f) => whoseAt(f) === 'third party' && (f.value || f.prefill)), `signing no field anyone is handed sits on a third party's place or is filled in there (${onElse.length})`);
}

function twice(d1, d2) {
  const key = (f) => `${f.page}|${f.type}|${f.label}`;
  const same = d1.fields.length === d2.fields.length && d1.fields.every((f, i) => key(f) === key(d2.fields[i]) && Math.abs(f.x0 - d2.fields[i].x0) <= 0.01 && Math.abs(f.y0 - d2.fields[i].y0) <= 0.01 && Math.abs(f.x1 - d2.fields[i].x1) <= 0.01 && Math.abs(f.y1 - d2.fields[i].y1) <= 0.01);
  const diff = d1.fields.findIndex((f, i) => !d2.fields[i] || key(f) !== key(d2.fields[i]));
  line(same, `twice the pages read a second time give the same fields in the same order (${d1.fields.length} and ${d2.fields.length}${same ? '' : `; first difference at field ${diff + 1}, page ${(d1.fields[diff] || {}).page}`})`);
  const f = d1.fields;
  const sorted = f.every((p, i) => !i || f[i - 1].page < p.page || (f[i - 1].page === p.page && (f[i - 1].y0 < p.y0 + 0.01)));
  line(sorted, 'twice the list is sorted by page, then top edge');
}

const pagesWord = (list) => {
  const l = list.slice().sort((a, b) => a - b);
  return l.length === 1 ? `page ${l[0]}` : `pages ${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
};
function summary(d) {
  const places = sheet();
  const sigPages = (o) => Array.from(new Set(places.filter((p) => p.kind === 'signature' && WHOSE[p.whose] === o).map((p) => p.page)));
  const inv = `The investor’s signature line was found on ${pagesWord(sigPages('investor'))}.`;
  const co = `The co-investor’s signature line was found on ${pagesWord(sigPages('co-investor'))}.`;
  const other = `Signature lines for other people (a custodian, a broker, a representative or the like) were found on ${pagesWord(sigPages('third party'))}. Nobody is asked to sign them.`;
  const at = [inv, co, other].map((s) => d.note.indexOf(s));
  line(at.every((n) => n >= 0) && at[0] < at[1] && at[1] < at[2], `summary names the investor's, the co-investor's and other people's signature lines with the answer sheet's pages, in that order (${at.map((n) => (n >= 0 ? 'found' : 'missing')).join(', ')})`);
  const r = d.read || {};
  const eq = (a, b) => JSON.stringify((a || []).slice().sort()) === JSON.stringify(b.slice().sort());
  line(eq(r.investorPages, sigPages('investor')) && eq(r.coSignaturePages, sigPages('co-investor')) && eq(r.otherSignaturePages, sigPages('third party')), `summary the reading gives the same pages (investor ${JSON.stringify(r.investorPages)}, co-investor ${JSON.stringify(r.coSignaturePages)}, other people ${JSON.stringify(r.otherSignaturePages)})`);
  // No word of the form: the summary is built from fixed words and page numbers only.
  // (a name's words as read, without the portal's own prefix and its names by shape or kind)
  const own = /^(tick box|box|initials|signature|date)$/;
  const labels = new Set(d.fields.map((f) => f.label.replace(/^[^:]{1,20}: /, '').toLowerCase()).filter((s) => s.length > 6 && !own.test(s)));
  const leaked = Array.from(labels).filter((s) => d.note.toLowerCase().indexOf(s) >= 0);
  line(!leaked.length, `summary holds no word of the form (${leaked.length} names found in it)`);
}

function refused(d) {
  const boxes = d.fields.filter((f) => f.type !== 'text' || /^(Box|Tick box)$/.test(f.label));
  const ok = d.fields.filter((f) => /^(Box|Tick box)$/.test(f.label) && f.review && f.owner === 'investor');
  line(ok.length === 237 && ok.length === d.fields.length, `refused every found box that is an empty place still has a field named by its shape, marked, the investor's (${ok.length} of ${d.fields.length} fields; ${boxes.length} on boxes)`);
  const r = d.read || {};
  const unread = Object.keys(r.unread || {}).reduce((n, k) => n + r.unread[k].length, 0);
  line(!unread && !(r.scanned || []).length, `refused no page is reported unread (${unread} unread, ${(r.scanned || []).length} scanned)`);
  const want = 'The portal could not start its text reader here, so the words on pages 1 to 8 were not read.';
  line(d.note.indexOf(want) >= 0 && d.note.indexOf('No signature line for the investor was found') >= 0, `refused the summary says the words on pages 1 to 8 could not be read and that no signature line for the investor was found`);
}

/* ---------------- limit: the time for words used up ---------------- */
const LIMIT_SAYS = (pages) => `Reading words from pictures takes time, and the portal stopped after three minutes. On ${pages} the boxes were found on the picture but the words by them were not read: each field there is named by its shape and marked. Upload those pages as a shorter PDF to have their words read.`;
/** Page numbers as the summary writes them ("page 4", "pages 2 and 5", "pages 2 to 8", "pages 1, 2 and 5 to 8"). */
function onPages(pages) {
  const runs = [];
  pages.forEach((p) => {
    const last = runs[runs.length - 1];
    if (last && p === last[1] + 1) last[1] = p;
    else runs.push([p, p]);
  });
  const list = runs.map((r) => (r[0] === r[1] ? `${r[0]}` : r[1] === r[0] + 1 ? `${r[0]}, ${r[1]}` : `${r[0]} to ${r[1]}`));
  return pages.length === 1 ? `page ${list[0]}` : list.length === 1 ? `pages ${list[0].replace(', ', ' and ')}` : `pages ${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
async function limit(h) {
  const page = await H.signUp(h);
  const bytes = fs.readFileSync(PDF);
  const r = await page.evaluate(
    async ({ arr }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const off = ws.offerings[ws.offerings.length - 1];
      const file = new File([new Uint8Array(arr)], 'Agreement.pdf', { type: 'application/pdf' });
      const env = await NS.esign.agreementDraft(ws, off.id, { file, title: 'Subscription Agreement' });
      const fresh = Object.assign({}, env, { fields: [] });
      delete fresh.read;
      const steps = [];
      const t0 = Date.now();
      await NS.esign.autoFields(fresh, { pictures: true, limitMs: 2000, step: (i, all, boxes) => steps.push({ i, all, boxes: !!boxes, at: Date.now() - t0 }) });
      const layout = await NS.esign.pageLayout(env.docId, { kept: true });
      const fields = fresh.fields.map((f) => {
        const ps = fresh.pageSizes[f.page - 1];
        return { page: f.page, x0: f.x * ps.w, x1: (f.x + f.w) * ps.w, y0: f.y * ps.h, y1: (f.y + f.h) * ps.h, label: f.label || '', review: !!f.review };
      });
      const pages = layout.map((pg) => ({ page: pg.page, reader: pg.reader || '', pictured: !!pg.pictured, boxes: (pg.found || []).filter((b) => b.place !== false).map((b) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })) }));
      return { steps, fields, pages, read: fresh.read, note: NS.esign.readNote(fresh), ms: Date.now() - t0 };
    },
    { arr: Array.from(bytes) }
  );
  await page.close();
  const n = r.pages.length;
  const inOrder = r.steps.length === n && r.steps.every((s, k) => s.i === k + 1 && s.all === n);
  line(inOrder, `limit the progress was called once for each of the ${n} pages, in page order (${r.steps.map((s) => s.i + (s.boxes ? 'b' : 'w')).join(' ')}; w words read, b boxes only; ${(r.ms / 1000).toFixed(1)} s)`);
  const late = r.pages.filter((pg) => pg.reader === 'limit').map((pg) => pg.page);
  line(r.pages[0] && r.pages[0].reader === 'ok' && late.length > 0 && late.every((p) => p > 1) && r.steps.every((s) => s.boxes === late.includes(s.i)), `limit page 1 had its words read (reader ${r.pages[0] ? r.pages[0].reader : 'none'}); pages with only their boxes found: ${late.join(', ') || 'none'}; the progress said which`);
  const inside = (f, b) => (f.x0 + f.x1) / 2 > b.x0 - 1 && (f.x0 + f.x1) / 2 < b.x1 + 1 && (f.y0 + f.y1) / 2 > b.y0 - 1 && (f.y0 + f.y1) / 2 < b.y1 + 1;
  let boxes = 0;
  let held = 0;
  r.pages.forEach((pg) => pg.boxes.forEach((b) => (boxes++, r.fields.some((f) => f.page === pg.page && inside(f, b)) && held++)));
  line(boxes === 237 && held === boxes, `limit every found box that is an empty place has a field (${held} of ${boxes}; 237 on boxes in all)`);
  const onLate = r.fields.filter((f) => late.includes(f.page));
  const badLate = onLate.filter((f) => !/^(Tick box|Box)$/.test(f.label) || !f.review);
  line(onLate.length > 0 && !badLate.length, `limit on the pages whose words were not read every field is named Tick box or Box and is marked (${onLate.length - badLate.length} of ${onLate.length})`);
  const wl = ((r.read && r.read.wordless) || {}).limit || [];
  const said = late.length ? LIMIT_SAYS(onPages(late)) : '';
  line(JSON.stringify(wl.slice().sort((a, b) => a - b)) === JSON.stringify(late) && !!said && r.note.indexOf(said) >= 0 && r.note.split('stopped after three minutes').length === 2, `limit the summary holds the limit's sentence naming exactly those pages (${late.length ? onPages(late) : 'none'}; wordless.limit ${JSON.stringify(wl)})`);
  const unread = Object.keys((r.read && r.read.unread) || {}).reduce((m, k) => m + r.read.unread[k].length, 0);
  line(!unread && !((r.read && r.read.scanned) || []).length && !/two and a half minutes|nothing was placed there/.test(r.note), `limit no page is reported unread (${unread} unread, ${((r.read && r.read.scanned) || []).length} scanned) and no sentence says nothing was placed`);
}

(async () => {
  const h = await H.start();
  try {
    if (PARTS.includes('shapes')) {
      const page = await h.context.newPage();
      await page.goto(h.base + '/diy.html');
      await page.waitForFunction(() => !!(window.CVPortal && window.CVPortal.placement && window.CVPortal.picturepage));
      await shapes(page);
      await page.close();
    }
    const doc = ['owners', 'signing', 'twice', 'summary'].filter((p) => PARTS.includes(p));
    if (doc.length) {
      const one = await openForm(h);
      line(one.asked, 'the form\'s pages have no text and nothing is placed before the offer is taken');
      const d = await draftFields(one.page, one.envId);
      if (PARTS.includes('owners')) owners(d);
      if (PARTS.includes('summary')) summary(d);
      if (PARTS.includes('twice')) {
        const two = await openForm(h, { page: one.page });
        twice(d, await draftFields(one.page, two.envId));
      }
      if (PARTS.includes('signing')) await signing(one.page, d, one.offId, one.envId);
      await one.page.close();
    }
  } catch (e) {
    line(false, `run: ${String((e && e.message) || e).slice(0, 300)}`);
  } finally {
    await h.stop();
  }
  // The time for words forced down: a browser of its own (a fresh workspace).
  if (PARTS.includes('limit')) {
    const h3 = await H.start();
    try {
      await limit(h3);
    } catch (e) {
      line(false, `limit run: ${String((e && e.message) || e).slice(0, 300)}`);
    } finally {
      await h3.stop();
    }
  }
  // The engine refused: a browser of its own, so that no engine is already loaded.
  if (PARTS.includes('refused')) {
    const h2 = await H.start();
    try {
      const r = await openForm(h2, { refuse: true });
      refused(await draftFields(r.page, r.envId));
    } catch (e) {
      line(false, `refused run: ${String((e && e.message) || e).slice(0, 300)}`);
    } finally {
      await h2.stop();
    }
  }
  console.log(fails.length ? `PICTURE FIELDS: FAIL - ${fails.join('; ')}` : 'PICTURE FIELDS: PASS');
  process.exit(fails.length ? 1 : 0);
})();
