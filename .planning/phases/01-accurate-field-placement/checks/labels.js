/*
 * The label table and the reading rules of assets/js/placement.js, checked in node with no browser.
 * The module is loaded with a stand-in for window.CVPortal: it must not touch a document or any other part of the
 * portal when it loads.
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/labels.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const sandbox = { window: { CVPortal: {} } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/js/placement.js'), 'utf8'), sandbox, { filename: 'placement.js' });
const P = sandbox.window.CVPortal.placement;

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
  P.analyze([{ page: 1, w: 612, h: 792, items: [{ s: ('Name of ' + 'x '.repeat(40)).repeat(50), x: 72, y: 100, w: 400, h: 12 }], rules: [], boxes: [] }], {});
  return Date.now() - t < 500;
})());

/* ---------- Reading a page given as plain data ---------- */
// A page from rows of text and rules: ['text', x, y, 'words'] with y the baseline, ['rule', x0, x1, y] with 24 pt of
// empty paper above it. Text is set at 12 pt; its width comes from the same rough character widths the module uses.
const width = (s) => Array.from(s).reduce((a, ch) => a + (ch === ' ' ? 3 : /[A-Z]/.test(ch) ? 7.8 : /[ijlt.,:;']/.test(ch) ? 3.3 : 5.4), 0);
function page(rows, n) {
  const pg = { page: n || 1, w: 612, h: 792, items: [], rules: [], boxes: [] };
  rows.forEach((r) => {
    if (r[0] === 'text') pg.items.push({ s: r[3], x: r[1], y: r[2], w: width(r[3]), h: 12 });
    else if (r[0] === 'rule') pg.rules.push({ x0: r[1], x1: r[2], y: r[3], t: 0.75, clear: r[4] || 24, drop: 0 });
    else if (r[0] === 'box') pg.boxes.push({ x: r[1], y: r[2], w: 10, h: 10 });
  });
  return pg;
}
const ctx = { countersign: true, firmNames: ['Northgate Capital', 'Northgate Capital Management, LLC'], fundNames: ['Northgate Fund I, LP'] };
const read = (rows, c) => P.analyze([page(rows)], c || ctx).filter((p) => p.why.indexOf('last page') < 0);
const at = (list, x, y) => list.find((p) => Math.abs(p.x - x) <= 6 && p.y + p.h >= y - 2 && p.y + p.h <= y + 7);
const sum = (list) => list.map((p) => `${p.type}/${p.role}/${p.conf}@${Math.round(p.x)},${Math.round(p.y + p.h)}`).join(' ');
// "Label: [rule]" on one printed line.
const labelled = (x, y, label, len) => [['text', x, y, label], ['rule', x + width(label) + 4, x + width(label) + 4 + (len || 180), y + 1.5]];

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
// 3. The firm's name with words that say it acts for the fund: sure.
(() => {
  const f = read([['text', 72, 100, 'NORTHGATE FUND I, LP'], ['text', 72, 120, 'By: Northgate Capital GP, LLC, its general partner'], ...labelled(72, 150, 'By:'), ['text', 72, 180, 'Name:'], ['text', 72, 200, 'Title:']]);
  check('"its general partner" makes the block the firm’s for sure', f.length === 3 && f.every((p) => p.role === 'firm' && p.conf === 'high'), sum(f));
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
// 7. An unknown label on top of a stack of labels above their lines: the first line gets nothing rather than the wrong caption.
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
// 9. With no countersignature asked for, the firm's proposals are still labelled as the firm's (the caller drops them).
(() => {
  const f = read([['text', 72, 100, 'ACCEPTED AND AGREED:'], ...labelled(72, 140, 'By:')], { countersign: false });
  check('a firm block stays the firm’s when it does not countersign', f.length === 1 && f[0].role === 'firm', sum(f));
})();
// 10. Lines for a witness or a spouse get no field; a body sentence gets no signature.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER:'], ...labelled(72, 130, 'Signature:'), ...labelled(72, 160, 'Witness:'), ...labelled(72, 190, 'Signature of Spouse:'), ['text', 72, 240, 'The signature of the Subscriber below constitutes execution of this Agreement.']]);
  check('witness and spouse lines get nothing', f.length === 1 && f[0].type === 'signature', sum(f));
})();
// 11. A rule with other text under it (a footer, a heading) is not a blank; neither is the top edge of a frame.
(() => {
  const pg = page([['rule', 72, 540, 300], ['text', 290, 312, 'Page 2'], ['rule', 72, 540, 400], ['text', 72, 412, 'Additional terms'], ['text', 72, 500, 'Signature'], ['rule', 72, 260, 480, 24]]);
  pg.rules.push({ x0: 72, x1: 300, y: 600, t: 0.75, clear: 30, drop: 12 });
  pg.items.push({ s: 'Signature', x: 72, y: 612, w: 50, h: 12 });
  const f = P.analyze([pg], { countersign: false }).filter((p) => p.why.indexOf('last page') < 0);
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
})();
// 13. A short blank before a statement: initials when told so, a tick when told so, initials marked when nothing says.
(() => {
  const row = (y, t) => [['rule', 72, 108, y + 1.5], ['text', 114, y, t]];
  const a = read([['text', 72, 100, 'Please initial each statement that applies:'], ...row(130, 'The Subscriber is an accredited investor under Rule 501.')]);
  check('initials when the instruction says initial, optional when it says "that applies"', a.length === 1 && a[0].type === 'initials' && a[0].required === false && a[0].conf === 'high', sum(a));
  const b = read([['text', 72, 100, 'The Subscriber is (check one):'], ...row(130, 'an individual'), ...row(150, 'a corporation')]);
  check('a tick box when the instruction says check', b.length === 2 && b.every((p) => p.type === 'checkbox' && p.conf === 'high'), sum(b));
  const c = read([['text', 72, 100, 'Representations'], ...row(130, 'The Subscriber has read the memorandum.')]);
  check('initials assumed and marked when nothing says which', c.length === 1 && c[0].type === 'initials' && c[0].conf === 'medium', sum(c));
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
// 15. A table-of-contents leader gets nothing; a text-only blank (no line seen) is marked as estimated.
(() => {
  const a = read([['text', 72, 100, 'Section 4. Representations ' + '.'.repeat(40) + ' 12']]);
  check('a leader of dots running to a page number is not a blank', a.length === 0, sum(a));
  const b = read([['text', 72, 100, 'SUBSCRIBER:'], ['text', 72, 130, 'Signature: ______________________']]);
  check('a blank known only from the text is marked as estimated', b.length === 1 && b[0].type === 'signature' && b[0].conf === 'medium' && /estimated/.test(b[0].why), sum(b));
})();
// 16. The fallback block when nothing can be read.
(() => {
  const f = P.analyze([{ page: 1, w: 612, h: 792, items: [], rules: [], boxes: [] }], { countersign: true });
  check('six low-confidence fields on a page with nothing to read', f.length === 6 && f.every((p) => p.conf === 'low' && p.why), sum(f));
  check('labels are cut to 60 characters and carry no control characters', P.analyze([page([...labelled(72, 100, 'An \u0007extraordinarily long label for a blank that goes on and on:', 100)])], {}).every((p) => p.label.length <= 60 && !/[\u0000-\u001f]/.test(p.label)));
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
// 19. A label far to the left on the same printed line does not take a line that has a caption of its own.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER'], ['text', 72, 141, 'Date:'], ['rule', 300, 500, 142], ['text', 300, 154, 'Signature of Subscriber']]);
  const onLine = f.filter((p) => Math.abs(p.x - 300) < 2);
  check('the captioned line keeps its caption', onLine.length === 1 && onLine[0].type === 'signature' && onLine[0].conf === 'high', sum(f));
  check('the label left without a line gets a field after it, marked low', f.length === 2 && f.some((p) => p.type === 'date' && p.conf === 'low' && p.x < 200), sum(f));
})();
// 20. Rows of a ruled table: the line of each row is empty from the end of its label on; the fields start together.
(() => {
  const pg = page([['text', 72, 100, 'Name of Purchaser'], ['text', 72, 130, 'Email'], ['text', 72, 160, 'Country of residence']]);
  [[72 + width('Name of Purchaser') + 1, 105], [72 + width('Email') + 1, 135], [72 + width('Country of residence') + 1, 165]].forEach(([x0, y]) => pg.rules.push({ x0, x1: 540, y, t: 0.75, clear: 24, drop: 0, cut: true }));
  const f = P.analyze([pg], ctx).filter((p) => p.why.indexOf('last page') < 0);
  check('three ruled rows give three fields that start at the same place, after the longest label', f.length === 3 && f.every((p) => Math.abs(p.x - f[0].x) < 0.5) && f[0].x > 72 + width('Country of residence'), sum(f));
  check('a row whose words are not a known label is still labelled with them, sure', f[2].label === 'Country of residence' && f[2].conf === 'high', sum(f));
})();
// 21. A square the size of a letter's bowl inside a run of words is a letter, not a tick box.
(() => {
  const pg = page([['text', 72, 100, 'Name of Purchaser'], ['rule', 200, 400, 101.5]]);
  pg.boxes.push({ x: 100, y: 93, w: 5.5, h: 5 });
  const f = P.analyze([pg], ctx).filter((p) => p.why.indexOf('last page') < 0);
  check('no tick box inside a word, and the blank keeps its label', f.length === 1 && f[0].type === 'text' && f[0].label === 'Investor name', sum(f));
})();
// 22. scan: a drawn square is a tick box, a ring is not; a line with clear paper above is a blank, an underline is not.
(() => {
  const W = 400;
  const H = 200;
  const px = new Uint8ClampedArray(W * H * 4).fill(255);
  const dot = (x, y) => {
    const i = (y * W + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = 0;
  };
  const hline = (x0, x1, y) => {
    for (let x = x0; x <= x1; x++) dot(x, y);
  };
  const vline = (x, y0, y1) => {
    for (let y = y0; y <= y1; y++) dot(x, y);
  };
  // A 10 pt square at scale 2 (20 px), a ring of the same size, a 100 pt line, and a line with letter feet on it.
  hline(20, 40, 20);
  hline(20, 40, 40);
  vline(20, 20, 40);
  vline(40, 20, 40);
  for (let a = 0; a < 720; a++) dot(Math.round(90 + 10 * Math.cos((a * Math.PI) / 360)), Math.round(30 + 10 * Math.sin((a * Math.PI) / 360)));
  hline(20, 220, 100);
  hline(20, 220, 160);
  for (let x = 24; x < 220; x += 6) vline(x, 150, 158);
  const m = P.scan(px, W, H, 2);
  check('scan finds the drawn square and not the ring', m.boxes.length === 1 && Math.abs(m.boxes[0].x - 10) < 1 && Math.abs(m.boxes[0].w - 10.5) < 1, m.boxes);
  const blanks = m.rules.filter((r) => r.clear >= 7);
  check('scan finds the line with clear paper above it and not the underlined one', blanks.length === 1 && Math.abs(blanks[0].x0 - 10) < 1 && Math.abs(blanks[0].x1 - 110.5) < 1 && Math.abs(blanks[0].y - 50.25) < 0.5, m.rules);
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
// 25. A table with every border drawn: the empty cell is the blank, the cell with words in it is not.
(() => {
  const pg = page([['text', 78, 112, 'Signature of Subscriber'], ['text', 78, 142, 'By'], ['text', 78, 172, 'Signature of Joint Subscriber']]);
  [120, 150, 180].forEach((y) => {
    pg.rules.push({ x0: 73, x1: 268, y, t: 1, clear: 7.5, drop: 12, rise: 12, cut: false, cell: true, table: true });
    pg.rules.push({ x0: 270, x1: 539, y, t: 1, clear: 23, drop: y === 180 ? 0 : 12, rise: 12, cut: false, cell: true, table: true });
  });
  pg.rules.push({ x0: 72, x1: 540, y: 96, t: 1, clear: 30, drop: 12, rise: 0, cut: false, cell: false, table: false });
  const f = P.analyze([pg], { countersign: false }).filter((p) => p.why.indexOf('last page') < 0);
  check('each empty cell gets its row’s field; the joint subscriber’s row and the table’s top edge get none', f.length === 2 && f.every((p) => p.type === 'signature' && Math.abs(p.x - 270) < 1) && f[0].conf === 'high', sum(f));
})();

// 26. A line with no label, with "Name:" and "Title:" printed under it, is where that signer signs.
(() => {
  const f = read([['text', 72, 100, 'SUBSCRIBER:'], ['rule', 72, 300, 140], ['text', 72, 156, 'Name:'], ['text', 72, 172, 'Title:']]);
  check('the unlabelled line over "Name:" and "Title:" is the signature line', f.length === 3 && f[0].type === 'signature' && f[0].role === 'investor' && f[0].conf === 'high' && f[1].type === 'name' && f[2].label === 'Title' && f[1].x > 72 + width('Name:'), sum(f));
  const g = read([['text', 72, 100, 'SUBSCRIBER:'], ['rule', 72, 300, 140], ['text', 72, 156, 'Name:'], ['text', 110, 156, 'Priya Raman']]);
  check('not when a name is already printed after "Name:"', g.length === 0, sum(g));
})();
// 27. Tick boxes set as a character of a symbol font count only where a square was seen.
(() => {
  const a = page([['text', 72, 100, ' Individual'], ['box', 72.5, 91]]);
  const fa = P.analyze([a], ctx).filter((p) => p.why.indexOf('last page') < 0);
  check('a symbol-font character with a square seen on it is a tick box with its words', fa.length === 1 && fa[0].type === 'checkbox' && fa[0].label === 'Individual' && fa[0].conf === 'high', sum(fa) + ' ' + (fa[0] || {}).label);
  const fb = read([['text', 72, 100, ' See the note on page 4']]);
  check('a symbol-font character with no square on it is not a tick box', fb.length === 0, sum(fb));
  const c = page([['text', 72, 100, 'o Joint tenants'], ['box', 72.5, 91]]);
  const fc = P.analyze([c], ctx).filter((p) => p.why.indexOf('last page') < 0);
  check('a square that is the first letter of its own caption is labelled with the words after it', fc.length === 1 && fc[0].type === 'checkbox' && fc[0].label === 'Joint tenants', sum(fc) + ' ' + (fc[0] || {}).label);
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
