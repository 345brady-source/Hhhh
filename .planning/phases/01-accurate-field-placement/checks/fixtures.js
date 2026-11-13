/*
 * Generated subscription agreements for the placement checks. A fixture is an HTML body (printed to PDF by the check
 * browser) plus options. Every blank carries data-x with what belongs there:
 *   type      the kind of field (signature, initials, name, date, text, checkbox)
 *   role      who fills it in (investor or firm)
 *   fillIn    true when it is a blank to complete in the body rather than part of a signature block
 *   label     the label the field should carry (compared when given)
 *   key       the onboarding answer it should be filled in from ('' for none; compared when given)
 *   required  whether the signer has to complete it (compared when given)
 *   forType   'person' or 'entity' when only that kind of investor gets it ('' for everyone; compared when given)
 *   flag      true where a review mark is the right outcome (the portal cannot be sure from the page alone)
 *   ref       for a label with no line of its own: the data-id of the signature blank its field lines up with
 * The printed position of each blank is read from the page before printing, never from the code under test.
 *
 * Fixture options: crop (a crop box applied after printing), countersign (false: the firm does not countersign),
 * from (reuse another fixture's pages), saves (true: must save at once; false: must be held for review),
 * clean (true: no field may be marked for review), css (extra styles), paper ([width, height] in inches),
 * draw (a function returning a drawn PDF's spec instead of html), heldOut (true: written after the rules and never
 * used to change them, so only a confident mistake fails it), first ({ right, blanks, mistakes, marks }: what a layout
 * written after the rules measured on its first run, before it was used to fix them).
 */
const CSS = `@page{size:8.5in 11in;margin:0} html,body{margin:0} body{font:12pt/1.4 "Times New Roman",serif}
.pg{width:8.5in;height:11in;box-sizing:border-box;padding:1in;position:relative;page-break-after:always;overflow:hidden}
.b{display:inline-block} .rule{display:inline-block;border-bottom:1px solid #000;height:1em;vertical-align:baseline}
.cols{display:flex;gap:.5in} .cols>div{flex:1} .cap{font-size:9pt}
.sq{display:inline-block;width:10pt;height:10pt;border:1px solid #000;box-sizing:border-box;vertical-align:-1pt;margin:0 4pt 0 0;font:bold 8pt/9pt Arial,sans-serif;text-align:center}
.nl{display:inline-block;width:0;height:1em}
.foot{position:absolute;left:1in;right:1in;bottom:.55in;font-size:9pt}
.pgno{position:absolute;left:1in;right:1in;bottom:.3in;border-top:1px solid #000;padding-top:3pt;font-size:9pt;text-align:center}`;
const attr = (x) => JSON.stringify(x).replace(/'/g, '&#39;');
const blank = (x, text, id) => `<span class="b"${id ? ` data-id="${id}"` : ''} data-x='${attr(x)}'>${text}</span>`;
const rule = (x, width) => `<span class="rule" style="width:${width}" data-x='${attr(x)}'></span>`;
const box = (x) => `<span class="sq" data-x='${attr(Object.assign({ type: 'checkbox', role: 'investor', fillIn: true, required: false }, x))}'></span>`;
// A label with no line of its own: its field starts after the label, or where the signature line it sits under starts.
const noline = (x, ref) => `<span class="nl" data-x='${attr(Object.assign({ ref }, x))}'></span>`;
const U = (n) => '_'.repeat(n);
const U30 = U(30);
const U28 = U(28);
const inv = (type, more) => Object.assign({ type, role: 'investor' }, more || {});
const firm = (type, more) => Object.assign({ type, role: 'firm' }, more || {});
const fill = (label, key, more) => Object.assign({ type: 'text', role: 'investor', fillIn: true, label, key: key || '' }, more || {});
const block = (role) => `<p>By: ${blank({ type: 'signature', role }, U30)}</p><p>Name: ${blank({ type: 'name', role }, U28)}</p><p>Title: ${blank({ type: 'text', role, label: 'Title', required: false }, U28)}</p><p>Date: ${blank({ type: 'date', role }, U28)}</p>`;
// An empty table cell that is the blank: its bottom edge is the line.
const gcell = (x) => `<td data-k="cell" data-x='${attr(x)}'></td>`;
const initialsFoot = () => `<div class="foot">Subscriber's Initials: ${blank({ type: 'initials', role: 'investor', fillIn: true, required: true }, U(10))}</div>`;

/* The pages several fixtures share. */
const SIGNATURE_PAGE = `<div class="pg"><h3 style="text-align:center"><u>SIGNATURE PAGE</u></h3><p>IN WITNESS WHEREOF, the undersigned has executed this Subscription Agreement to the Fund as of the date set forth below.</p>
<div style="border-top:1px solid #000;margin:14pt 0"></div><p>The undersigned has read this Agreement and the Fund's offering documents in full before signing.</p>
<p><b>SUBSCRIBER:</b></p>${block('investor')}<div class="pgno">Page 2</div></div>`;
const QUESTIONNAIRE = `<div class="pg"><h3>INVESTOR INFORMATION</h3>
<p>Name of Subscriber: ${blank(fill('Investor name', 'investorName', { required: true }), U(40))}</p>
<p>Type of Subscriber (check one): ${['Individual', 'Joint tenants', 'Corporation', 'Partnership', 'Trust', 'IRA'].map((c) => `${box({ label: c })}${c} &nbsp; `).join('')}</p>
<p>Address: ${blank(fill('Address', 'street', { required: true }), U(46))}<br>${blank(fill('Address line 2', '', { required: false, flag: true }), U(46))}</p>
<p>City: ${blank(fill('City', 'city'), U(18))} State: ${blank(fill('State', 'state'), U(8))} Zip: ${blank(fill('ZIP code', 'zip'), U(10))}</p>
<p>Email: ${blank(fill('Email', 'email'), U(36))}</p>
<p>Telephone: ${blank(fill('Phone', 'phone'), U(30))}</p>
<p>Taxpayer Identification No.: ${blank(fill('Taxpayer ID', ''), U(24))}</p>
<p>State of organization (entities only): ${blank(fill('State of organization', '', { forType: 'entity' }), U(20))}</p>
<p>Date of birth: ${blank(fill('Date of birth', ''), U(18))}</p>
<p>Subscription Amount: $${blank(fill('Commitment amount', 'amount', { required: false }), U(18))}</p>
<p><span data-k="bracket" data-x='${attr({ type: 'checkbox', role: 'investor', fillIn: true, required: false, flag: true, label: 'I have read the offering documents' })}'>[ ]</span> I have read the offering documents</p>
<p><span class="sq">X</span>The Subscriber received this questionnaire from the General Partner</p>
<p>Section 4. Representations and warranties of the Subscriber ${'.'.repeat(40)} 12</p>
<p><u>Additional information the General Partner may request</u></p>
${initialsFoot()}</div>
<div class="pg"><h3>ACCREDITED INVESTOR REPRESENTATIONS</h3>
<p>Please initial each statement that applies:</p>
${['The Subscriber is a natural person whose individual net worth, or joint net worth with a spouse, exceeds $1,000,000.', 'The Subscriber is a natural person whose individual income exceeded $200,000 in each of the two most recent years.', 'The Subscriber is an entity in which all of the equity owners are accredited investors.']
  .map((t) => `<p>${blank({ type: 'initials', role: 'investor', fillIn: true, required: false }, U(6))} ${t}</p>`)
  .join('')}
<p>The Subscriber has read the risk factors in the offering documents.</p>
<p>Initial here: ${blank({ type: 'initials', role: 'investor', fillIn: true, required: true }, U(10))}</p>
${initialsFoot()}</div>`;
const ENTITY_PAGES = `<div class="pg"><h3 style="text-align:center">SIGNATURE PAGE FOR INDIVIDUALS</h3><p>The undersigned has executed this Subscription Agreement as of the date set forth below.</p>
<p>Signature: ${blank(inv('signature', { forType: 'person' }), U30)}</p><p>Print Name: ${blank(inv('name', { forType: 'person' }), U28)}</p><p>Date: ${blank(inv('date', { forType: 'person' }), U28)}</p></div>
<div class="pg"><h3 style="text-align:center">SIGNATURE PAGE FOR ENTITIES</h3><p>The undersigned has executed this Subscription Agreement as of the date set forth below.</p>
<p>Name of Entity: ${blank(inv('text', { forType: 'entity', label: 'Investor name', key: 'investorName' }), U30)}</p><p>By: ${blank(inv('signature', { forType: 'entity' }), U30)}</p><p>Name: ${blank(inv('name', { forType: 'entity' }), U28)}</p><p>Title: ${blank(inv('text', { forType: 'entity', label: 'Title' }), U28)}</p><p>Date: ${blank(inv('date', { forType: 'entity' }), U28)}</p></div>
<div class="pg"><p>The foregoing subscription is hereby accepted.</p><p>NORTHGATE FUND I, LP</p><p>By: Northgate Capital GP, LLC, its general partner</p>
<p>By: ${blank(firm('signature'), U30, 'acc')}</p><p>Name:${noline(firm('name'), 'acc')}</p><p>Title:${noline(firm('text', { label: 'Title' }), 'acc')}</p></div>`;

const FIXTURES = {
  // The investor signs on one page and the firm accepts on the next; every blank is a run of underscores after its label.
  // Distractors: an underlined title, a full-width rule between paragraphs, a footer rule over the page number.
  classic: {
    saves: true,
    clean: true,
    html: `<div class="pg"><h2 style="text-align:center">SUBSCRIPTION AGREEMENT</h2>
<p>The undersigned (the "Subscriber") hereby subscribes for an interest in Northgate Fund I, LP (the "Fund") and agrees to make a Capital Commitment of $${blank(fill('Commitment amount', 'amount', { required: false }), U(14))} on the terms of this Agreement. The Manager may accept or reject this subscription.</p>
<p>Signature pages follow. The signature of the Subscriber below constitutes execution of the limited partnership agreement of the Fund by each member of the Subscriber.</p></div>
${SIGNATURE_PAGE}
<div class="pg"><p><b>ACCEPTED AND AGREED:</b></p><p>NORTHGATE FUND I GP, LLC, as General Partner</p>${block('firm')}</div>`
  },
  // The same agreement when the firm does not countersign: its acceptance page gets no field at all.
  classicSolo: { from: 'classic', countersign: false, saves: true, clean: true },
  // One page, two columns (investor left, firm right); every blank is a drawn line with its caption underneath.
  caption: {
    saves: true,
    clean: true,
    html: `<div class="pg"><h3>Signature Page to Subscription Agreement</h3><p>The Subscriber and the General Partner have signed below.</p>
<div class="cols">${[['investor', 'SUBSCRIBER', 'Signature of Subscriber'], ['firm', 'GENERAL PARTNER', 'Authorized Signature']]
      .map(([role, head, cap]) => `<div><p><b>${head}</b></p><p style="margin:36pt 0 0">${rule({ type: 'signature', role }, '2.6in')}<br><span class="cap">${cap}</span></p>
<p style="margin:24pt 0 0">${rule({ type: 'name', role }, '2.6in')}<br><span class="cap">Print Name</span></p>
<p style="margin:24pt 0 0">${rule({ type: 'date', role }, '1.4in')}<br><span class="cap">Date</span></p></div>`)
      .join('')}</div></div>`
  },
  // Two labels and two blanks on one printed line; then a block whose Name and Title have no line of their own.
  oneline: {
    saves: true,
    clean: true,
    html: `<div class="pg"><h3 style="text-align:center">SIGNATURE PAGE</h3><p><b>SUBSCRIBER:</b></p>
<p>By: ${blank(inv('signature'), U(22))} Name: ${blank(inv('name'), U(22))}</p>
<p>Title: ${blank(inv('text', { label: 'Title' }), U(22))} Date: ${blank(inv('date'), U(22))}</p>
<p style="margin-top:40pt"><b>ACCEPTED BY THE GENERAL PARTNER:</b></p>
<p>By: ${blank(firm('signature'), U30, 'gp')}</p><p>Name:${noline(firm('name'), 'gp')}</p><p>Title:${noline(firm('text', { label: 'Title' }), 'gp')}</p></div>`
  },
  // The signature page behind a crop box shifted in by half an inch on every side: fields follow the page as displayed.
  cropped: { saves: true, clean: true, countersign: false, crop: [36, 36, 540, 720], html: SIGNATURE_PAGE },
  // A page for individuals, a page for entities, and an acceptance block headed only by the fund's and the firm's own names.
  entity: { offering: 'Northgate Fund I, LP', html: ENTITY_PAGES },
  // A lone signature line with no heading anywhere near: the investor's at best guess, held for review.
  unsure: {
    saves: false,
    html: `<div class="pg"><h2 style="text-align:center">Agreement</h2><p>The parties agree to the terms set out in the offering documents, which are incorporated here by reference, and to the allocation of interests described in them.</p>
<p>This document may be executed in counterparts and delivered electronically.</p>
<p>Signature: ${blank(inv('signature', { flag: true }), U30)}</p><p>Date: ${blank(inv('date', { flag: true }), U28)}</p></div>`
  },
  // Blanks to complete, tick boxes and initials lines, with distractors: a ticked box, a table-of-contents line, an underlined sub-heading.
  questionnaire: { html: QUESTIONNAIRE },
  // The questionnaire followed by the pages for individuals, for entities and the acceptance: the agreement prefill.js signs.
  full: { offering: 'Northgate Fund I, LP', html: QUESTIONNAIRE + ENTITY_PAGES },
  // A label that is the text of an image tag with an error handler: it must only ever be shown as text.
  markup: {
    html: `<div class="pg"><p><b>SUBSCRIBER:</b></p><p>&lt;img src=x onerror="window.__pwn=1"&gt; code: ${blank(fill('<img src=x onerror="window.__pwn=1"> code', ''), U(20))}</p>
<p>By: ${blank(inv('signature'), U30)}</p><p>Name: ${blank(inv('name'), U28)}</p></div>`,
    countersign: false
  },
  // Signature blocks set as tables with every border drawn: the label in the left cell, standing in the middle of the
  // row's height, the empty cell to its right. The row for a joint subscriber gets nothing.
  grid: {
    saves: true,
    clean: true,
    css: `.grid{border-collapse:collapse;width:100%} .grid td{border:1px solid #000;padding:5pt 6pt;height:24pt} .grid td:first-child{width:42%}`,
    html: `<div class="pg"><h3 style="text-align:center">SIGNATURE PAGE</h3><p>The Subscriber has executed this Subscription Agreement on the date written below.</p><p><b>SUBSCRIBER</b></p>
<table class="grid"><tr><td>Signature of Subscriber</td>${gcell(inv('signature'))}</tr><tr><td>Signature of Joint Subscriber (if any)</td><td></td></tr><tr><td>Print name(s)</td>${gcell(inv('name'))}</tr>
<tr><td>Title (entities only)</td>${gcell(inv('text', { label: 'Title', forType: 'entity' }))}</tr><tr><td>Name of beneficial owner, if different from the Subscriber</td>${gcell(inv('text', { label: 'Name of beneficial owner', required: false }))}</tr><tr><td>Date</td>${gcell(inv('date'))}</tr></table>
<p style="margin-top:30pt"><b>ACCEPTED BY THE GENERAL PARTNER</b></p>
<table class="grid"><tr><td>By</td>${gcell(firm('signature'))}</tr><tr><td>Name and title</td>${gcell(firm('text', { label: 'Name and title' }))}</tr><tr><td>Date</td>${gcell(firm('date'))}</tr></table></div>`
  },
  // One page with no text at all: the stand-in for a scanned agreement.
  blank: { saves: false, html: `<div class="pg"></div>` }
};

/*
 * A layout written after the rules, on purpose unlike the fixtures above. Its first run (recorded in `first`) found
 * two confident mistakes and two blanks without a field; the rules were then fixed, so it now counts with the others.
 * A4 pages in a sans-serif face at 10 pt; the investor is the "Purchaser" and the firm the "Managing Member"; the
 * information section is a two-column table whose rows are ruled along the bottom (label in the left cell, the blank
 * is the empty right cell); tick boxes for the kind of purchaser; an initials line at the foot of each page; the
 * amount as "Purchase Price: US$ ____"; a signature block set in the right half of the page with captions under drawn
 * lines, followed by "Accepted and agreed to" for the firm.
 */
const cell = (x) => `<td data-k="cell" data-x='${attr(x)}'></td>`;
const row = (label, x) => `<tr><td><span data-lab>${label}</span></td>${cell(x)}</tr>`;
const tick = (label) => `<span class="tk" data-k="box" data-x='${attr({ type: 'checkbox', role: 'investor', fillIn: true, required: false, label })}'></span>${label}`;
const drawn = (x, caption) => `<div class="ln" data-k="rule" data-x='${attr(x)}'></div><div class="cp">${caption}</div>`;
const footInitials = () => `<div class="ft">Purchaser’s initials <span class="rule" style="width:70pt" data-x='${attr({ type: 'initials', role: 'investor', fillIn: true, required: true })}'></span></div>`;
FIXTURES.heldout = {
  first: { right: 20, blanks: 22, mistakes: 2, marks: 7 },
  offering: 'Northgate Fund I, LP',
  paper: [8.27, 11.69],
  css: `@page{size:210mm 297mm;margin:0} body{font:10pt/1.45 Arial,Helvetica,sans-serif}
.pg{width:210mm;height:297mm;padding:22mm 20mm}
h1{font-size:13pt;margin:0 0 4pt} h2{font-size:10pt;margin:14pt 0 4pt;text-transform:uppercase;letter-spacing:.04em}
table{border-collapse:collapse;width:100%} td{border-bottom:.75pt solid #222;padding:9pt 0 2pt;vertical-align:bottom} td:first-child{width:38%}
.tk{display:inline-block;width:8pt;height:8pt;border:.75pt solid #222;margin:0 4pt 0 14pt;vertical-align:-1pt} .tk:first-of-type{margin-left:0}
.ft{position:absolute;left:20mm;right:20mm;bottom:12mm;font-size:8pt;text-align:right}
.sig{margin-left:52%} .ln{border-bottom:.75pt solid #222;height:26pt} .cp{font-size:8pt;margin-top:2pt}`,
  html: `<div class="pg"><h1>Purchaser Questionnaire</h1><p>Northgate Fund I, LP (the “Company”). Please complete every section. The Managing Member relies on the information given here in deciding whether to accept a purchase of Units.</p>
<h2>1. The Purchaser</h2>
<table>${row('Name of Purchaser', fill('Investor name', 'investorName'))}${row('Address', fill('Address', 'street'))}${row('City, State, Zip', fill('City, state and ZIP', 'cityStateZip'))}${row('Country of residence', fill('Country of residence', ''))}${row('Email', fill('Email', 'email'))}${row('Telephone', fill('Phone', 'phone'))}${row('Taxpayer ID (SSN or EIN)', fill('Taxpayer ID', ''))}</table>
<h2>2. Kind of Purchaser</h2>
<p>The Purchaser is (tick one):</p><p>${['An individual', 'A company', 'A trust', 'A pension plan'].map(tick).join('')}</p>
<h2>3. Purchase</h2>
<p>Purchase Price: US$ ${blank(fill('Commitment amount', 'amount', { required: false }), U(20))}</p>
<p>Number of Units: ${blank(fill('Number of Units', ''), U(12))}</p>
${footInitials()}</div>
<div class="pg"><h2>4. Signature</h2><p>The Purchaser has read the Operating Agreement of the Company and agrees to be bound by it as a member from the date the Managing Member accepts this purchase.</p>
<div class="sig"><p><b>PURCHASER</b></p>${drawn(inv('signature'), 'Signature')}${drawn(inv('name'), 'Name (print)')}${drawn(inv('text', { label: 'Title', required: false }), 'Title, if signing for an entity')}${drawn(inv('date'), 'Date')}
<p style="margin-top:22pt">Accepted and agreed to:</p><p><b>NORTHGATE CAPITAL</b>, as Managing Member</p>${drawn(firm('signature'), 'Authorized signatory')}${drawn(firm('name'), 'Name')}${drawn(firm('date'), 'Date')}</div>
${footInitials()}</div>`
};


/*
 * A second layout written after the rules. Its first run (recorded in `first`) found one confident mistake and two
 * blanks with the wrong kind of field; the rule behind them was fixed, so it too now counts with the others. Unlike
 * all the others it is not printed by the
 * browser but drawn with the PDF writing library: text in the standard PDF fonts, lines and squares as vector strokes.
 * An investor profile with captions under drawn lines (several to a row), "Yes [ ] No [ ]" and "[ ] a natural person"
 * boxes, the amount with no colon before it, initials asked for at the end of each statement; then a signature page
 * with the individual's and the entity's blocks side by side, labels left of tab-aligned lines, and the firm's
 * acceptance below. The fund's name runs along the top of each page.
 */
function drawing() {
  const ops = [];
  const expect = [];
  let pg = 1;
  const d = {
    page: (n) => (pg = n),
    text: (x, y, s, size, font) => ops.push(['text', pg, x, y, size || 11, font || 'H', s]),
    // A drawn line with what belongs on it.
    line: (x0, x1, y, x) => {
      ops.push(['line', pg, x0, x1, y, 0.75]);
      if (x) expect.push(Object.assign({ page: pg, x0, x1, line: y, how: 'rule' }, x));
    },
    // A line with its caption underneath.
    captioned: (x0, x1, y, caption, x) => {
      d.line(x0, x1, y, x);
      d.text(x0, y + 10, caption, 8);
    },
    // A label and, tab-aligned to its right, the line it names.
    labelled: (x, y, label, x0, x1, e) => {
      d.text(x, y, label);
      d.line(x0, x1, y + 1.5, e);
    },
    square: (x, y, e) => {
      ops.push(['rect', pg, x, y - 8.5, 9, 9, 0.75]);
      expect.push(Object.assign({ type: 'checkbox', role: 'investor', fillIn: true, required: false, page: pg, how: 'box', box: { x0: x, x1: x + 9, y0: y - 8.5, y1: y + 0.5 } }, e));
    },
    // Text with a run of underscores in it; where the run comes out is measured when the PDF is drawn.
    blank: (x, y, before, n, e, size) => {
      const id = 'u' + expect.length;
      ops.push(['utext', pg, x, y, size || 11, 'H', before, n, '', id]);
      expect.push(Object.assign({ page: pg, id, how: 'text' }, e));
    }
  };
  return { d, done: (pages) => ({ size: [612, 792], pages, ops, expect }) };
}
FIXTURES.heldout2 = {
  first: { right: 24, blanks: 26, mistakes: 1, marks: 1 },
  offering: 'Northgate Fund I, LP',
  draw() {
    const { d, done } = drawing();
    d.text(72, 50, 'Northgate Fund I, LP', 9);
    d.text(72, 82, 'SUBSCRIPTION BOOKLET', 14, 'HB');
    d.text(72, 112, 'PART A. INVESTOR PROFILE', 12, 'HB');
    d.captioned(72, 400, 150, 'Name of Investor (print or type)', fill('Investor name', 'investorName'));
    d.captioned(72, 330, 190, 'Street address', fill('Address', 'street'));
    d.captioned(345, 420, 190, 'Apt / Suite', fill('Address line 2', '', { required: false }));
    d.captioned(72, 250, 230, 'City', fill('City', 'city'));
    d.captioned(265, 330, 230, 'State', fill('State', 'state'));
    d.captioned(345, 420, 230, 'ZIP', fill('ZIP code', 'zip'));
    d.captioned(72, 300, 270, 'E-mail address', fill('Email', 'email'));
    d.captioned(320, 500, 270, 'Daytime telephone', fill('Phone', 'phone'));
    d.captioned(72, 300, 310, 'Social Security No. or Tax ID No.', fill('Taxpayer ID', ''));
    d.text(72, 350, 'Is the Investor a registered broker-dealer?');
    d.text(330, 350, 'Yes');
    d.square(352, 350, { label: 'Yes' });
    d.text(380, 350, 'No');
    d.square(398, 350, { label: 'No' });
    d.text(72, 380, 'The Investor is:');
    d.square(160, 380, { label: 'a natural person' });
    d.text(174, 380, 'a natural person');
    d.square(280, 380, { label: 'an entity' });
    d.text(294, 380, 'an entity');
    d.blank(72, 420, 'Amount of Investment $ ', 16, fill('Commitment amount', 'amount', { required: false }));
    d.text(72, 452, 'PART B. REPRESENTATIONS', 12, 'HB');
    d.text(72, 472, 'Each statement below must be initialed by the Investor.', 10);
    d.blank(72, 494, '(a) The Investor is an accredited investor as defined in Rule 501.  Initials: ', 8, { type: 'initials', role: 'investor', fillIn: true, required: true }, 10);
    d.blank(72, 516, '(b) The Investor has received the Operating Agreement.  Initials: ', 8, { type: 'initials', role: 'investor', fillIn: true, required: true }, 10);
    d.page(2);
    d.text(72, 50, 'Northgate Fund I, LP', 9);
    d.text(72, 112, 'SIGNATURE PAGE', 12, 'HB');
    d.text(72, 142, 'INDIVIDUAL INVESTOR', 10, 'HB');
    d.labelled(72, 180, 'Signature:', 140, 290, inv('signature', { forType: 'person' }));
    d.labelled(72, 215, 'Print name:', 140, 290, inv('name', { forType: 'person' }));
    d.labelled(72, 250, 'Date:', 140, 290, inv('date', { forType: 'person' }));
    d.text(320, 142, 'ENTITY INVESTOR', 10, 'HB');
    d.labelled(320, 180, 'Name of entity:', 400, 545, inv('text', { forType: 'entity', label: 'Investor name', key: 'investorName' }));
    d.labelled(320, 215, 'By:', 400, 545, inv('signature', { forType: 'entity' }));
    d.labelled(320, 250, 'Title:', 400, 545, inv('text', { forType: 'entity', label: 'Title' }));
    d.labelled(320, 285, 'Date:', 400, 545, inv('date', { forType: 'entity' }));
    d.text(72, 362, 'AGREED TO AND ACCEPTED', 11, 'HB');
    d.text(72, 380, 'Northgate Capital, Manager');
    d.labelled(72, 415, 'By:', 140, 330, firm('signature'));
    d.labelled(72, 450, 'Its:', 140, 330, firm('text', { label: 'Title' }));
    d.labelled(72, 485, 'Dated:', 140, 330, firm('date'));
    return done(2);
  }
};
module.exports = { CSS, FIXTURES, blank, rule, box, noline, block, attr, U };
