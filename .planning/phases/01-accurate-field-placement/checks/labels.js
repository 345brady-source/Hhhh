/*
 * The label table and the reading rules of assets/js/placement.js, and what assets/js/anchors.js makes of a page for
 * it, checked in node with no browser. Both modules are loaded with a stand-in for window.CVPortal: they must not
 * touch a document or any other part of the portal when they load.
 *
 * The rule the reading cases state: a field is proposed only for something the page prints (a line, a run of
 * underscores, a tick box, an empty ruled cell). No block is made up for a page with no place to sign, and no field
 * is put after a label with no line. A printed line for a second signer, a witness or a notary is a printed place:
 * it gets a field kept apart from the investor's own (optional, marked low).
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/labels.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const sandbox = { window: { CVPortal: {} } };
vm.createContext(sandbox);
['anchors.js', 'placement.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8'), sandbox, { filename: f }));
const P = sandbox.window.CVPortal.placement;
const A = sandbox.window.CVPortal.anchors;

let failed = 0;
let passed = 0;
const check = (name, ok, info) => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}${info !== undefined ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''}`);
  }
};
const kind = (s) => (P.labelOf(s) || {}).kind || '';

/* ---------- What a label asks for ---------- */
const TABLE = {
  signature: ['By:', 'By', 'Signature of Subscriber', 'Signature', 'Signature:', 'Authorized Signature', 'Signature of Authorized Signatory', 'Subscriber’s Signature', 'Investor Signature', '(Signature of Purchaser)', 'Authorized Signatory', 'Sign here', 'X'],
  name: ['Print Name', 'Name:', 'Name of Authorized Signatory', 'Printed Name', '(Print Name)', 'Name (please print)', 'Print Name of Signatory'],
  investorName: ['Name of Subscriber', 'Subscriber:', 'Investor Name', 'Exact name in which the interest is to be held', 'Name of Entity', 'Name of Purchaser (please print)', 'Print Name of Subscriber', 'Full legal name of investor'],
  date: ['Date', 'Dated:', 'Date of Signature', 'Date:', 'Date signed', 'Date of Execution'],
  title: ['Title:', 'Its:', 'Capacity', 'Title (if applicable)', 'Title of Authorized Signatory'],
  nameTitle: ['Name and Title:', 'Print Name and Title'],
  initials: ['Initials', 'Initial here', 'Subscriber’s Initials', "Subscriber's Initials:", 'Investor Initials', '(Initials)', 'Initial:'],
  amount: ['Subscription Amount', 'Capital Commitment', 'Amount of Investment', 'Subscription Amount: $', 'Commitment Amount:', 'Purchase Price: US$', 'Total Capital Commitment', 'Amount of Subscription'],
  address: ['Address', 'Mailing Address', 'Address:', 'Street Address', 'Residence Address', 'Principal Place of Business'],
  address2: ['Address line 2', 'Apt / Suite'],
  city: ['City', 'City:'],
  state: ['State', 'State:'],
  zip: ['Zip Code', 'Zip', 'ZIP:', 'Postal Code'],
  cityStateZip: ['City, State, Zip', 'City, State and Zip Code', 'City/State/Zip'],
  email: ['Email', 'E-mail Address', 'Email address:'],
  phone: ['Telephone', 'Phone', 'Telephone No.:', 'Daytime phone number', 'Tel.'],
  taxId: ['Social Security Number', 'Taxpayer Identification No.', 'EIN', 'SSN / EIN', 'Tax ID Number', 'Social Security or Taxpayer Identification Number']
};
Object.keys(TABLE).forEach((k) => TABLE[k].forEach((s) => check(`"${s}" is ${k}`, kind(s) === k, kind(s) || 'nothing')));
// Nothing: titles and sentences that merely use the word; lines for people the portal has no signer for; ordinary blanks.
[
  'Signature Page',
  'Signature Page to Subscription Agreement',
  'SIGNATURE PAGE FOLLOWS',
  'The signature of the Subscriber below constitutes execution of the limited partnership agreement.',
  'Signature guarantee required',
  'Witness',
  'Witness:',
  'Signature of Witness',
  'Notary Public',
  'Spouse',
  'Signature of Spouse (if applicable)',
  'Co-Subscriber',
  'Signature of Joint Subscriber, if any',
  'Signature of Custodian',
  'Date of birth',
  'State of organization',
  'State of organization (entities only):',
  'Number of Units:',
  'Name of Fund',
  'Fax',
  ''
].forEach((s) => check(`"${s}" is nothing`, kind(s) === '', kind(s)));
check('"Signature of Subscriber" says whose it is', (P.labelOf('Signature of Subscriber') || {}).who === 'investor');
check('"Signature of General Partner" says whose it is', (P.labelOf('Signature of General Partner') || {}).who === 'firm');
check('"By:" does not say whose it is', (P.labelOf('By:') || {}).who === '');
check('"Title (if signing for an entity)" is for entities', (P.labelOf('Title (if signing for an entity):') || {}).forType === 'entity');
check('"Title (if applicable)" is optional', (P.labelOf('Title (if applicable)') || {}).optional === true);
check('a label longer than 90 characters is nothing', kind('Signature of ' + 'the Subscriber '.repeat(8)) === '');
check('hostile input returns quickly', (() => {
  const t = Date.now();
  P.labelOf('name '.repeat(2000));
  P.labelOf('a'.repeat(89) + '!');
  P.analyze([{ page: 1, w: 612, h: 792, items: [{ s: ('Name of ' + 'x '.repeat(40)).repeat(50), x: 72, y: 100, w: 400, h: 12 }], rules: [], boxes: [], forms: [] }], {});
  return Date.now() - t < 500;
})());

/* ---------- Reading a page given as what the PDF draws ---------- */
// A page is built the way the reading gets it: the characters, strokes and rectangles the PDF draws (what
// NS.anchors.walk returns), turned into runs of text, lines and tick boxes by NS.anchors.page, then read by
// NS.placement. Nothing is handed to placement that anchors.js did not make from what is printed.
//   ['text', x, y, 'words', font]   characters set at 12 pt on the baseline y (font only matters for a symbol font);
//                                   a run of underscores in the words is a printed line, as in a real PDF
//   ['rule', x0, x1, y]             a drawn line
//   ['box', x, y]                   a drawn square of 10 pt with its top-left corner at x, y
//   ['frame', x0, y0, x1, y1]       a drawn rectangle (a table cell, a frame)
// A character's width comes from the same rough widths the check has always used.
const cw = (ch) => (ch === ' ' ? 3 : /[A-Z]/.test(ch) ? 7.8 : /[ijlt.,:;']/.test(ch) ? 3.3 : 5.4);
const width = (s) => Array.from(s).reduce((a, ch) => a + cw(ch), 0);
function raw(rows) {
  const out = { glyphs: [], segs: [], rects: [], picture: false };
  const rect = (x0, y0, x1, y1) => {
    out.rects.push({ x0, y0, x1, y1, t: 0.75 });
    out.segs.push({ o: 'h', a0: x0, a1: x1, c: y0, t: 0.75, frame: true }, { o: 'h', a0: x0, a1: x1, c: y1, t: 0.75, frame: true }, { o: 'v', a0: y0, a1: y1, c: x0, t: 0.75 }, { o: 'v', a0: y0, a1: y1, c: x1, t: 0.75 });
  };
  rows.forEach((r) => {
    if (r[0] === 'text') {
      let x = r[1];
      Array.from(r[3]).forEach((ch) => {
        out.glyphs.push({ u: ch, sp: !ch.trim(), x0: x, x1: x + cw(ch), y: r[2], h: 12, font: r[4] || 'TimesNewRoman', hidden: false });
        x += cw(ch);
      });
    } else if (r[0] === 'rule') out.segs.push({ o: 'h', a0: r[1], a1: r[2], c: r[3], t: 0.75 });
    else if (r[0] === 'box') rect(r[1], r[2], r[1] + 10, r[2] + 10);
    else if (r[0] === 'frame') rect(r[1], r[2], r[3], r[4]);
  });
  return out;
}
const page = (rows, n) => A.page(raw(rows), { page: n || 1, w: 612, h: 792 }, []);
const ctx = { firmNames: ['Northgate Capital', 'Northgate Capital Management, LLC'], fundNames: ['Northgate Fund I, LP'] };
const whole = (rows, c) => P.read([page(rows)], c || ctx);
const read = (rows, c) => whole(rows, c).fields;
const at = (list, x, y) => list.find((p) => Math.abs(p.x - x) <= 6 && p.y + p.h >= y - 2 && p.y + p.h <= y + 7);
const sum = (list) => list.map((p) => `${p.type}/${p.role}/${p.conf}${p.second ? '/second' : ''}@${Math.round(p.x)},${Math.round(p.y + p.h)}`).join(' ') || 'no field';
// "Label: [rule]" on one printed line.
const labelled = (x, y, label, len) => [['text', x, y, label], ['rule', x + width(label) + 4, x + width(label) + 4 + (len || 180), y + 1.5]];

// 0. The reading's own format: what anchors.js makes of a page, and that nothing draws or scans it.
(() => {
  check('the pixel scan is gone: placement has read and analyze and no scan', typeof P.read === 'function' && typeof P.analyze === 'function' && P.scan === undefined, Object.keys(P));
  const pg = page([['text', 72, 100, 'Signature: ____________________'], ['rule', 72, 260, 160], ['box', 72, 191], ['text', 88, 200, 'Trust']]);
  const us = pg.rules.find((r) => /underscores/.test(r.made));
  const dr = pg.rules.find((r) => r.made === 'rule');
  check('a run of underscores is read as a printed line with its exact extent', us && Math.abs(us.x0 - (72 + width('Signature: '))) < 0.01 && Math.abs(us.x1 - (72 + width('Signature: ____________________'))) < 0.01 && Math.abs(us.y - 101.44) < 0.01, pg.rules);
  check('a drawn line is read with the empty paper above it and how far a field may reach past it', dr && dr.x0 === 72 && dr.x1 === 260 && dr.y === 160 && dr.clear >= 7 && dr.pad && dr.pad.l > 0 && dr.pad.l <= 1 && dr.pad.r <= 1 && dr.pad.d >= 1 && dr.pad.d <= 2, pg.rules);
  check('a drawn square is read as a tick box of its size', pg.boxes.length === 1 && pg.boxes[0].made === 'square' && pg.boxes[0].x === 72 && pg.boxes[0].y === 191 && pg.boxes[0].w === 10, pg.boxes);
  check('the text keeps its words; the underscores are a run of their own', pg.items.some((it) => it.s === 'Signature:') && pg.items.some((it) => /^_+$/.test(it.s)) && pg.items.some((it) => it.s === 'Trust'), pg.items.map((it) => it.s));
  const f = P.read([pg], ctx).fields;
  const a = f.find((p) => p.type === 'signature');
  check('a field covers the ink of its line: about a point past each end and a point and a half under it', a && us.x0 - a.x > 0 && us.x0 - a.x <= 1.01 && a.x + a.w - us.x1 > 0 && a.x + a.w - us.x1 <= 1.01 && a.y + a.h - us.y >= 1 && a.y + a.h - us.y <= 2.5, a);
  check('every proposed field says what kind of answer it takes', f.length === 2 && f.every((p) => typeof p.kind === 'string' && p.kind) && a.kind === 'signature' && f.find((p) => p.type === 'checkbox').kind === 'checkbox', f.map((p) => p.type + ':' + p.kind));
  check('a page that is a picture is not read, and a page the reader failed on is counted as such', (() => {
    const r = P.read([{ page: 1, w: 612, h: 792, items: [], rules: [], boxes: [], forms: [], scan: true }, { page: 2, w: 612, h: 792, items: [], rules: [], boxes: [], forms: [], failed: true }], ctx);
    return r.fields.length === 0 && r.pages === 0 && r.scanned.join() === '1' && r.failed.join() === '2';
  })());
})();

// 1. A second block under a heading that says nothing (a company name the portal does not know) is not the investor's for sure.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER:'], ...labelled(72, 130, 'By:'), ...labelled(72, 160, 'Name:'), ['text', 72, 230, 'NGC PARTNERS GP, LLC'], ...labelled(72, 260, 'By:'), ...labelled(72, 290, 'Name:')]);
  const a = at(f, 72 + width('By:') + 4, 131.5);
  const b = at(f, 72 + width('By:') + 4, 261.5);
  check('first block under SUBSCRIBER is the investor’s, sure', a && a.type === 'signature' && a.role === 'investor' && a.conf === 'high', sum(f));
  check('a second block under an unknown company name is not placed at high confidence', b && b.type === 'signature' && b.conf !== 'high', sum(f));
})();
// 2. The firm's own name over a block, with no word saying which side it is: the firm's, but not sure.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER:'], ...labelled(72, 130, 'By:'), ['text', 72, 230, 'NORTHGATE CAPITAL MANAGEMENT, LLC'], ...labelled(72, 260, 'By:')]);
  const b = at(f, 72 + width('By:') + 4, 261.5);
  check('a block headed only by the firm’s name is given to the firm, marked', b && b.role === 'firm' && b.conf === 'medium', sum(f));
})();
// 3. The firm's name with words that say it acts for the fund: sure. Labels with no line get nothing.
(() => {
  const f = read([['text', 72, 100, 'NORTHGATE FUND I, LP'], ['text', 72, 120, 'By: Northgate Capital GP, LLC, its general partner'], ...labelled(72, 150, 'By:'), ['text', 72, 180, 'Name:'], ['text', 72, 200, 'Title:']]);
  check('"its general partner" makes the block the firm’s for sure', f.length >= 1 && f.every((p) => p.role === 'firm' && p.conf === 'high') && !!at(f, 72 + width('By:') + 4, 151.5), sum(f));
  check('"Name:" and "Title:" with no line get no field: only the printed line does', f.length === 1 && f[0].type === 'signature', sum(f));
  check('"By: <a name>" with no line gets no field', !f.some((p) => p.y + p.h < 140), sum(f));
})();
// 4. A page title naming the fund is not a heading for the firm.
(() => {
  const f = read([['text', 150, 60, 'NORTHGATE FUND I, LP SUBSCRIPTION AGREEMENT'], ['text', 72, 100, 'INVESTOR SIGNATURE PAGE'], ...labelled(72, 140, 'Signature:'), ...labelled(72, 170, 'Date:')]);
  check('fund name in the page title does not make the page the firm’s', f.length === 2 && f.every((p) => p.role === 'investor' && p.conf === 'high'), sum(f));
})();
// 5. Labels above their lines, stacked: read together, never as captions of the line before; marked.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER'], ['text', 72, 130, 'Signature'], ['rule', 72, 260, 148], ['text', 72, 166, 'Print Name'], ['rule', 72, 260, 184], ['text', 72, 202, 'Date'], ['rule', 72, 200, 220]]);
  const types = f.map((p) => p.type).join(',');
  check('a stack of labels above their lines keeps each label with its own line', types === 'signature,name,date', sum(f));
  check('and marks them for review', f.every((p) => p.conf === 'medium'), sum(f));
})();
// 6. Captions under their lines, stacked: sure.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER'], ['rule', 72, 260, 140], ['text', 72, 152, 'Signature'], ['rule', 72, 260, 190], ['text', 72, 202, 'Print Name'], ['rule', 72, 200, 240], ['text', 72, 252, 'Date']]);
  check('a stack of captions under their lines is read as captions, sure', f.map((p) => p.type + '/' + p.conf).join(',') === 'signature/high,name/high,date/high', sum(f));
})();
// 7. An unknown label on top of a stack of labels above their lines: the first line gets nothing confident rather than the wrong caption.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER'], ['text', 72, 130, 'Authorized Person'], ['rule', 72, 260, 148], ['text', 72, 166, 'Print Name'], ['rule', 72, 260, 184], ['text', 72, 202, 'Date'], ['rule', 72, 200, 220]]);
  check('no confident field when captions and labels above cannot be told apart', f.every((p) => p.conf !== 'high'), sum(f));
  check('the name goes on the line under "Print Name"', !!f.find((p) => p.type === 'name' && Math.abs(p.y + p.h - 187) < 4), sum(f));
})();
// 8. Two columns with a heading over each: left is the investor's, right the firm's.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER:'], ['text', 330, 100, 'GENERAL PARTNER:'], ...labelled(72, 140, 'By:', 150), ...labelled(330, 140, 'By:', 150), ...labelled(72, 170, 'Name:', 140), ...labelled(330, 170, 'Name:', 140)]);
  const left = f.filter((p) => p.x < 300);
  const right = f.filter((p) => p.x >= 300);
  check('left column is the investor’s', left.length === 2 && left.every((p) => p.role === 'investor' && p.conf === 'high'), sum(f));
  check('right column is the firm’s', right.length === 2 && right.every((p) => p.role === 'firm' && p.conf === 'high'), sum(f));
})();
// 9. Who signs is read, not chosen: a firm block is the firm's and its page is named when it has a signature line;
// a blank of the firm with no signature line for it is still labelled the firm's, and no page is named for the firm
// (the upload then leaves that blank without a field).
(() => {
  const r = whole([['text', 72, 100, 'ACCEPTED AND AGREED:'], ...labelled(72, 140, 'By:')]);
  check('a firm block is the firm’s, and the page of its signature line is named', r.fields.length === 1 && r.fields[0].role === 'firm' && r.fields[0].type === 'signature' && r.firmPages.join() === '1' && r.investorPages.length === 0, sum(r.fields));
  const q = whole([['text', 72, 100, 'ACCEPTED AND AGREED:'], ...labelled(72, 140, 'Name:')]);
  check('a firm blank with no signature line stays the firm’s, and no page is named for the firm to sign on', q.fields.length === 1 && q.fields[0].role === 'firm' && q.firmPages.length === 0, sum(q.fields));
  const s = whole([['text', 72, 100, 'SUBSCRIBER:'], ...labelled(72, 140, 'Signature:')]);
  check('the investor’s signature line names its page', s.investorPages.join() === '1' && s.firmPages.length === 0 && s.signatures === 1 && s.blanks === 0 && s.boxes === 0, s);
})();
// 10. Lines for a witness or a spouse are printed lines: each gets a field kept apart for a second signer (optional,
// marked low), never the investor's own signature; a body sentence gets nothing.
(() => {
  const r = whole([['text', 72, 100, 'SUBSCRIBER:'], ...labelled(72, 130, 'Signature:'), ...labelled(72, 160, 'Witness:'), ...labelled(72, 190, 'Signature of Spouse:'), ['text', 72, 240, 'The signature of the Subscriber below constitutes execution of this Agreement.']]);
  const f = r.fields;
  check('the investor’s own line is the one sure signature', f.filter((p) => p.type === 'signature' && !p.second).length === 1 && f[0].type === 'signature' && !f[0].second && f[0].conf === 'high' && f[0].required === true, sum(f));
  check('witness and spouse lines each get a second signer’s field: optional, marked low, and not where the investor signs', f.length === 3 && f.slice(1).every((p) => p.second === true && p.conf === 'low' && p.required === false && /second signer, a witness or a notary/.test(p.why)) && r.investorPages.join() === '1', sum(f));
})();
// 11. A rule with other text under it (a footer, a heading) is not a blank; neither is the top edge of a frame.
(() => {
  const f = read([['rule', 72, 540, 300], ['text', 290, 312, 'Page 2'], ['rule', 72, 540, 400], ['text', 72, 412, 'Additional terms'], ['text', 72, 500, 'Signature'], ['rule', 72, 260, 480], ['frame', 72, 600, 300, 640], ['text', 76, 612, 'Signature']]);
  check('only the captioned line gets a field', f.length === 1 && f[0].type === 'signature' && Math.abs(f[0].y + f[0].h - 484) < 3, sum(f));
})();
// 12. Tick boxes: words after the box, or before it when the line reads "Yes [ ]  No [ ]".
(() => {
  const f = read([['box', 72, 91], ['text', 88, 100, 'Individual'], ['box', 200, 91], ['text', 216, 100, 'Trust']]);
  check('words after their box', f.map((p) => p.type + ':' + p.label).join(',') === 'checkbox:Individual,checkbox:Trust', sum(f));
  const g = read([['text', 72, 100, 'Yes'], ['box', 96, 91], ['text', 140, 100, 'No'], ['box', 160, 91]]);
  check('words before their box', g.map((p) => p.label).join(',') === 'Yes,No', sum(g));
  const comb = read([['text', 72, 100, 'SSN:'], ['box', 110, 91], ['box', 120.5, 91], ['box', 131, 91], ['box', 141.5, 91]]);
  check('a comb of touching squares is not tick boxes', comb.length === 0, sum(comb));
  // A box written as brackets is read from its own characters: its place is exact, so it is sure.
  const br = read([['text', 72, 100, '[ ] I have read the offering documents']]);
  check('a box written as an empty bracket pair is a tick box with its words, sure', br.length === 1 && br[0].type === 'checkbox' && br[0].label === 'I have read the offering documents' && br[0].conf === 'high' && Math.abs(br[0].x + br[0].w / 2 - (72 + width('[ ]') / 2)) < 3, sum(br) + ' ' + (br[0] || {}).label);
})();
// 13. A short blank before a statement: initials when told so, a tick when told so, initials marked when nothing says.
(() => {
  const row = (y, t) => [['rule', 72, 108, y + 1.5], ['text', 114, y, t]];
  const a = read([['text', 72, 100, 'Please initial each statement that applies:'], ...row(130, 'The Subscriber is an accredited investor under Rule 501.')]);
  check('initials when the instruction says initial, optional when it says "that applies"', a.length === 1 && a[0].type === 'initials' && a[0].required === false && a[0].conf === 'high', sum(a));
  const b = read([['text', 72, 100, 'The Subscriber is (check one):'], ...row(130, 'an individual'), ...row(150, 'a corporation')]);
  check('a tick box when the instruction says check', b.length === 2 && b.every((p) => p.type === 'checkbox' && p.conf === 'high'), sum(b));
  const c = read([['text', 72, 100, 'Representations'], ...row(130, 'The Subscriber has read the memorandum.')]);
  check('a tick box, marked for review, when nothing says which', c.length === 1 && c[0].type === 'checkbox' && c[0].conf === 'medium', sum(c));
})();
// 14. A blank inside a sentence: the amount when a currency sign and a commitment word come before it, otherwise marked.
(() => {
  const s1 = 'The undersigned agrees to make a Capital Commitment of $';
  const a = read([['text', 72, 100, s1], ['rule', 72 + width(s1) + 2, 72 + width(s1) + 90, 101.5]]);
  check('the commitment amount inside a sentence', a.length === 1 && a[0].label === 'Commitment amount' && a[0].prefill === 'amount' && a[0].conf === 'high', sum(a));
  const s2 = 'This Agreement is governed by the laws of the State of';
  const b = read([['text', 72, 100, s2], ['rule', 72 + width(s2) + 2, 72 + width(s2) + 90, 101.5]]);
  check('another blank inside a sentence is a marked text field', b.length === 1 && b[0].type === 'text' && b[0].conf === 'medium', sum(b));
})();
// 15. A table-of-contents leader gets nothing; a run of underscores in the text is a printed line read exactly, so it is sure.
(() => {
  const a = read([['text', 72, 100, 'Section 4. Representations ' + '.'.repeat(40) + ' 12']]);
  check('a leader of dots running to a page number is not a blank', a.length === 0, sum(a));
  const b = read([['text', 72, 100, 'SUBSCRIBER:'], ['text', 72, 130, 'Signature: ______________________']]);
  check('a blank made of underscores is read from its own characters: sure, with no "estimated" reason, on the underscores', b.length === 1 && b[0].type === 'signature' && b[0].conf === 'high' && !b[0].why && Math.abs(b[0].x - (72 + width('Signature: '))) <= 1.01 && Math.abs(b[0].x + b[0].w - (72 + width('Signature: ______________________'))) <= 1.01, sum(b));
})();
// 16. Nothing is made up: a page with nothing printed on it gets no field at all, and neither does the last page of
// an agreement with no place to sign.
(() => {
  const r = P.read([{ page: 1, w: 612, h: 792, items: [], rules: [], boxes: [], forms: [] }], ctx);
  check('no field on a page with nothing to read (no block is invented), and no page named for anyone to sign on', r.fields.length === 0 && r.pages === 1 && r.investorPages.length === 0 && r.firmPages.length === 0 && r.signatures + r.blanks + r.boxes === 0, sum(r.fields));
  const t = P.read([page([['text', 72, 100, 'The parties agree to the terms of the offering documents.']]), page([['text', 72, 100, 'This document may be executed in counterparts.']], 2)], ctx);
  check('no field on pages of running text, the last page included', t.fields.length === 0 && t.pages === 2, sum(t.fields));
  check('labels are cut to 60 characters and carry no control characters', (() => {
    const f = P.analyze([page([...labelled(72, 100, 'An \u0007extraordinarily long label for a blank that goes on and on:', 100)])], {});
    return f.length === 1 && f.every((p) => p.label.length <= 60 && !/[\u0000-\u001f]/.test(p.label));
  })());
})();

// 17. A label that closes a line of running text is the label; the sentence before it is not part of it.
(() => {
  const s = '(b) The Investor has received the Operating Agreement.  Initials: ';
  const f = read([['text', 72, 100, s + '________']]).concat(read([['text', 72, 100, s], ['rule', 72 + width(s) + 2, 72 + width(s) + 50, 101.5]]));
  check('"...Agreement.  Initials: ____" is an initials field, not a text field named after the sentence', f.length === 2 && f.every((p) => p.type === 'initials' && p.label === ''), sum(f));
  check('a sentence and a label together are not one label', P.labelOf('The Investor has received the Agreement. Initials:') === null && read([['text', 72, 100, 'See the note above. Other details:'], ['rule', 260, 400, 101.5]]).every((p) => p.label === 'Other details'));
})();
// 18. A blank after a currency sign is the commitment only when the sentence is about what the investor commits.
(() => {
  const s = 'The minimum subscription accepted by the Fund is $';
  const f = read([['text', 72, 100, s], ['rule', 72 + width(s) + 2, 72 + width(s) + 90, 101.5]]);
  check('"the minimum subscription is $____" is not filled in with the investor’s commitment', f.length === 1 && !f[0].prefill && f[0].conf !== 'high', sum(f));
})();
// 19. A label far to the left on the same printed line does not take a line that has a caption of its own, and a
// label left without a line gets no field.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER'], ['text', 72, 141, 'Date:'], ['rule', 300, 500, 142], ['text', 300, 154, 'Signature of Subscriber']]);
  const onLine = f.filter((p) => Math.abs(p.x - 300) < 2);
  check('the captioned line keeps its caption', onLine.length === 1 && onLine[0].type === 'signature' && onLine[0].conf === 'high', sum(f));
  check('the label left without a line gets no field: nothing is placed where nothing is printed', f.length === 1 && !f.some((p) => p.type === 'date' || p.x < 200), sum(f));
})();
// 20. Rows of a ruled table: the line of each row is empty from the end of its label on; the fields start together.
(() => {
  const f = read([['text', 72, 100, 'Name of Purchaser'], ['rule', 72, 540, 105], ['text', 72, 130, 'Email'], ['rule', 72, 540, 135], ['text', 72, 160, 'Country of residence'], ['rule', 72, 540, 165]]);
  check('three ruled rows give three fields that start at the same place, after the longest label', f.length === 3 && f.every((p) => Math.abs(p.x - f[0].x) < 0.5) && f[0].x > 72 + width('Country of residence'), sum(f));
  check('a row whose words are not a known label is still labelled with them, sure', f.length === 3 && f[2].label === 'Country of residence' && f[2].conf === 'high', sum(f));
})();
// 21. A square drawn round a letter inside a run of words is not a tick box: a box with something in it is not empty.
(() => {
  const f = read([['text', 72, 100, 'Name of Purchaser'], ['rule', 200, 400, 101.5], ['frame', 72 + width('Name ') - 0.5, 91, 72 + width('Name o') + 0.5, 101]]);
  check('no tick box inside a word, and the blank keeps its label', f.length === 1 && f[0].type === 'text' && f[0].label === 'Investor name', sum(f));
})();
// 22. What the pixel scan used to tell apart is told apart from the drawing itself: a drawn square is a tick box, a
// square with a mark already in it is not; a line with clear paper above is a blank, an underline under words is not.
// (A ring is a curve: the reading takes no curve for a box. The prose fixture of accuracy.js prints ring bullets and round letters.)
(() => {
  const pg = page([['box', 10, 10], ['box', 40, 10], ['text', 42, 19, 'X'], ['rule', 10, 110, 50], ['text', 10, 79, 'Additional information'], ['rule', 10, 10 + width('Additional information'), 80.5]]);
  check('the empty drawn square is a tick box and the ticked one is not', pg.boxes.length === 1 && pg.boxes[0].x === 10 && pg.boxes[0].w === 10, pg.boxes);
  const blanks = pg.rules.filter((r) => r.clear >= 7);
  check('the line with clear paper above it is a blank to write on and the underline of the words is not', pg.rules.length === 1 && blanks.length === 1 && blanks[0].x0 === 10 && blanks[0].x1 === 110 && blanks[0].y === 50, pg.rules);
})();

// 23. The amount when its currency sign opens a printed line, and when the words after the blank name it.
(() => {
  const up = 'The undersigned hereby subscribes for an interest in the Fund in the amount of';
  const a = read([['text', 72, 100, up], ['text', 72, 116, '$'], ['rule', 80, 170, 117.5], ['text', 174, 116, '(the “Subscription Amount”), payable on demand.']]);
  check('"...in the amount of / $____ (the Subscription Amount)" is the commitment amount', a.length === 1 && a[0].label === 'Commitment amount' && a[0].prefill === 'amount' && a[0].conf === 'high', sum(a));
  const s = 'The Fund will return to the investor $';
  const b = read([['text', 72, 100, s], ['rule', 72 + width(s) + 2, 72 + width(s) + 90, 101.5], ['text', 72 + width(s) + 94, 100, '(the “Purchase Price”) on request.']]);
  check('the words after the blank can name it', b.length === 1 && b[0].prefill === 'amount', sum(b));
})();
// 24. A second blank in the same printed sentence is filled in by whoever fills in the first.
(() => {
  const f = read([['text', 72, 100, 'ACCEPTANCE'], ['text', 72, 130, 'Accepted this'], ['rule', 142, 170, 131.5], ['text', 174, 130, 'day of'], ['rule', 206, 280, 131.5]]);
  check('"Accepted this ____ day of ____": both blanks are the firm’s, both marked', f.length === 2 && f.every((p) => p.role === 'firm' && p.type === 'text' && p.conf !== 'high'), sum(f));
})();
// 25. A table with every border drawn: the empty cell is the blank, the cell with words in it is not. The joint
// subscriber's row is a printed place too: it gets a second signer's field, kept apart from the investor's own.
(() => {
  const rows = [['text', 78, 112, 'Signature of Subscriber'], ['text', 78, 142, 'By'], ['text', 78, 172, 'Signature of Joint Subscriber']];
  [[96, 120], [120, 150], [150, 180]].forEach(([y0, y1]) => rows.push(['frame', 72, y0, 269, y1], ['frame', 269, y0, 540, y1]));
  const f = read(rows);
  check('each empty cell gets its row’s field, inside the cell; the cells with words and the table’s top edge get none', f.length === 3 && f.every((p) => p.type === 'signature' && p.x >= 269 && p.x + p.w <= 540) && f[0].conf === 'high' && !f[0].second && !f[1].second, sum(f));
  check('the joint subscriber’s row gets a second signer’s field: optional and marked low', f.length === 3 && f[2].second === true && f[2].conf === 'low' && f[2].required === false, sum(f));
})();

// 26. A line with no label, with "Name:" and "Title:" printed under it, is where that signer signs. The two labels
// print no line of their own, so nothing is placed after them.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER:'], ['rule', 72, 300, 140], ['text', 72, 156, 'Name:'], ['text', 72, 172, 'Title:']]);
  check('the unlabelled line over "Name:" and "Title:" is the signature line', f.length >= 1 && f[0].type === 'signature' && f[0].role === 'investor' && f[0].conf === 'high' && Math.abs(f[0].y + f[0].h - 141.5) < 2, sum(f));
  check('and "Name:" and "Title:" with no line get no field', f.length === 1, sum(f));
  const g = read([['text', 72, 100, 'SUBSCRIBER:'], ['rule', 72, 300, 140], ['text', 72, 156, 'Name:'], ['text', 110, 156, 'Priya Raman']]);
  check('not when a name is already printed after "Name:"', g.length === 0, sum(g));
})();
// 27. Tick boxes set as a character of a symbol font: the character's code decides, whatever letter the reader reports.
(() => {
  const fa = read([['text', 72, 100, '', 'ABCDEF+Wingdings-Regular'], ['text', 72 + cw('o') + 4, 100, 'Individual']]);
  check('a box character of a symbol font is a tick box with its words', fa.length === 1 && fa[0].type === 'checkbox' && fa[0].label === 'Individual' && fa[0].conf === 'high', sum(fa) + ' ' + (fa[0] || {}).label);
  const fb = read([['text', 72, 100, '', 'Wingdings-Regular'], ['text', 72 + cw('o') + 4, 100, 'See the note on page 4']]);
  check('a symbol-font character that is not a box is not a tick box', fb.length === 0, sum(fb));
  const fc = read([['text', 72, 100, 'o', 'Wingdings-Regular'], ['text', 72 + cw('o') + 3, 100, 'Joint tenants']]);
  check('a box the reader reports as the letter "o" is still a box, labelled with the words after it', fc.length === 1 && fc[0].type === 'checkbox' && fc[0].label === 'Joint tenants', sum(fc) + ' ' + (fc[0] || {}).label);
  const fd = read([['text', 72, 100, 'o Joint tenants']]);
  check('the same letter in an ordinary font is a letter', fd.length === 0, sum(fd));
})();

/* ---------- Review marks and filling in (pure helpers) ---------- */
const old = { type: 'signature', page: 1, x: 0.1, y: 0.1 };
const marked = { type: 'text', page: 1, x: 0.1, y: 0.2, auto: true, confidence: 'medium', review: true, reviewReason: 'x' };
check('a field stored before placement existed never needs review', P.needsReview(old) === false && P.statusOf(old) === '');
check('a marked field needs review', P.needsReview(marked) === true && P.reviewCount({ fields: [old, marked] }) === 1 && P.needsReview({ fields: [old, marked] }) === true);
check('confirming clears the mark and keeps the confidence', P.confirm(marked) === true && !P.needsReview(marked) && marked.confidence === 'medium' && /confirmed/.test(P.statusOf(marked)));
check('investor kinds', P.groupOf('individual') === 'person' && P.groupOf('joint') === 'person' && P.groupOf('trust') === 'entity' && P.groupOf('entity') === 'entity' && P.groupOf('ira') === 'entity');
check('who gets a field', P.fits({ forType: 'person' }, 'joint') && !P.fits({ forType: 'person' }, 'trust') && P.fits({}, 'trust') && P.fits({ forType: 'entity' }, ''));
const v = P.values({ title: 'Harbor Light Trust', contact: 'Ana Reyes', address: '12 Harbor Road, Mystic, CT 06355', email: 'ana@example.org', phone: '' }, { name: 'Northgate Fund I, LP' }, { amount: '$250,000' });
check('values split a U.S. address', v.street === '12 Harbor Road' && v.city === 'Mystic' && v.state === 'CT' && v.zip === '06355' && v.cityStateZip === 'Mystic, CT 06355' && v.address === '12 Harbor Road, Mystic, CT 06355', v);
check('values leave out what onboarding does not have, and never a taxpayer ID', !('phone' in v) && !('taxId' in v) && v.investorName === 'Harbor Light Trust' && v.signerName === 'Ana Reyes' && v.amount === '$250,000' && v.offering === 'Northgate Fund I, LP', v);
const v2 = P.values({ title: 'A', contact: 'A', address: '4 Rue de la Paix, 75002 Paris, France' }, null, {});
check('an address that is not in the U.S. form fills the one-line blank only', v2.address && !v2.street && !v2.city, v2);
check('prefill keys offered to the editor all have values or are known gaps', P.PREFILL.every(([k]) => typeof k === 'string') && P.FOR_TYPES.length === 3);

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
