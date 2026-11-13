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
 * clean (true: no field may be marked for review), css (extra styles), heldOut (not used to build the rules).
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
  // One page with no text at all: the stand-in for a scanned agreement.
  blank: { saves: false, html: `<div class="pg"></div>` }
};

/*
 * The held-out layout: written after the rules, on purpose unlike the fixtures above, and never used to shape them.
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
  heldOut: true,
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

module.exports = { CSS, FIXTURES, blank, rule, box, noline, block, attr, U };
