/*
 * Made-up pages, one printed convention each, for the reader of text agreements. Every caption, heading, party and
 * fund name here is invented: a page shows the SHAPE of a convention (where the heading stands, what a label names,
 * how a line is captioned), never the words of any real agreement. Run by classes.js.
 *
 * A page is written like a fixture of fixtures.js (the same helpers, the same data-x keys) and may carry:
 *   read     { investorPages, firmPages, otherPages, left }: compared with the reading's own record when given
 *   summary  patterns the read summary must match
 *   saves    true: the agreement as read can be saved with nothing changed; false: something must hold it
 *   todo     a pattern the sentence that stops the save must match
 *   marks    exactly this many fields marked for review
 *   apart    no two fields that share a stretch of the page's width come closer than this many points
 *   guard    true: the page describes what the reader already does right; it is green before any change to the
 *            reader and must stay green
 *   walk     true: the page has an investor signature block or a block of the firm and can be taken through the
 *            real flow (classes.js --walk)
 *
 * Two keys of data-x beside those of fixtures.js (compared by harness.js only when a page gives them):
 *   other    the party a place for somebody else belongs to (one of the reader's own party names: Custodian,
 *            Broker-dealer, Representative, Adviser, Transfer agent, Third party), or true for whoever it is
 *   review   true: a review mark is the right outcome; false: the reader is sure and must not mark it
 * and three that classes.js compares itself:
 *   why      words the review reason must contain
 *   kinds    the reader's own kind words the field may carry (a plain text blank is 'other' or 'text')
 *   fill     on a drawn box: every edge of the field lies within this many points of the box's own edge
 * and two more page options, also compared by classes.js:
 *   notSaid  patterns the read summary must never match
 *   inert    true: the page is also opened in the editor through the upload dialog, where nothing printed on it may
 *            become an element or run (its captions are shown as characters only)
 *
 * A place for somebody else is nobody's required field: second, other, optional, never filled in from the investor's
 * onboarding, not marked. It is written with else_() below.
 *
 * Form pages (the conventions of a printed form) are set at exact places with at() and cellAt(): x and top in points
 * from the page's top-left corner. A ruled cell is four separate strokes with empty paper inside, as a word processor
 * draws a bordered table cell; the expected line of a cell is its bottom edge.
 */
const { CSS, blank, rule, box, U, attr } = require('./fixtures');

const CLASS_CSS = `${CSS}
.cap{font-size:9pt} .hd{margin-top:22pt} .gap{margin-top:34pt} .ind{margin-left:.35in} .small{font-size:10.5pt}
.t{border-collapse:collapse;width:100%;margin:8pt 0 14pt} .t td{border:.75pt solid #000;padding:3pt 5pt;height:16pt;font-size:10pt;vertical-align:top}
.t ul{margin:0;padding-left:12pt}`;

const U30 = U(30);
const U28 = U(28);
const inv = (type, more) => Object.assign({ type, role: 'investor' }, more || {});
const firm = (type, more) => Object.assign({ type, role: 'firm' }, more || {});
/** A place for somebody else: optional, nobody's, never filled in from onboarding, not marked. */
const else_ = (type, party, more) => Object.assign({ type, role: 'investor', second: true, other: party, required: false, key: '', review: false }, more || {});
/** A drawn line with its caption printed underneath. */
const under = (x, caption, width) => `<p class="gap">${rule(x, width || '3in')}<br><span class="cap">${caption}</span></p>`;
const pg = (inner) => `<div class="pg">${inner}</div>`;
const WITNESS = '<p>IN WITNESS WHEREOF, the undersigned has executed this Subscription Agreement as of the date set forth below.</p>';
/** The investor's own block: signature, printed name, date. */
const investorBlock = (more) => `<p><b>SUBSCRIBER:</b></p><p>Signature: ${blank(inv('signature', more), U30)}</p><p>Print Name: ${blank(inv('name', more), U28)}</p><p>Date: ${blank(inv('date', more), U28)}</p>`;
/** The other side's block of a partnership agreement: a blank line for the partner's name captioned underneath, "By", name and title lines. */
const partnerLines = (name, sig, who, title) => `<p class="gap">${rule(name, '3.5in')}<br><span class="cap">(Print name of Limited Partner)</span></p>
<p class="gap">By: ${rule(sig, '3.2in')}</p><p>Name: ${rule(who, '3in')}</p><p>Title: ${rule(title, '3in')}</p>`;
/** A block of the firm: its heading, an entity name printed in full, "By" and a drawn rule, the signatory's name and title printed under the rule. */
const firmBlock =(heading, entity, signatory, title, x) => `<p class="hd"><b>${heading}</b></p><p>${entity}</p><p class="gap">By: ${rule(x, '3.2in')}</p>${signatory ? `<p class="ind small">${signatory}, ${title}</p>` : ''}`;
const firmSig = () => firm('signature', { required: true, review: false });
const EXECUTED = '<p>IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.</p>';

/* ---------- form pages: words and ruled cells at exact places ---------- */
const LH = 1.15;
/** Words at an exact place (x, top in points; size in points). */
const at = (x, top, size, words, more) => `<div style="position:absolute;left:${x}pt;top:${top}pt;font-size:${size}pt;line-height:${LH};white-space:nowrap;${more || ''}">${words}</div>`;
const SW = 0.75;
const stroke = (l, t, w, h) => `<div style="position:absolute;left:${l}pt;top:${t}pt;width:${w}pt;height:${h}pt;background:#000"></div>`;
/** A ruled cell: four separate strokes around empty paper. exp: what belongs in it (left out: a cell no field may take). */
const cellAt = (x, top, w, h, exp, inner) => `<div${exp ? ` data-k="cell" data-x='${attr(exp)}'` : ''} style="position:absolute;left:${x}pt;top:${top}pt;width:${w}pt;height:${h}pt">${stroke(0, 0, w, SW)}${stroke(0, h - SW, w, SW)}${stroke(0, 0, SW, h)}${stroke(w - SW, 0, SW, h)}${inner || ''}</div>`;
/** The top of a caption of n lines in this size whose last line ends just above a cell's top edge. */
const capTop = (top, size, n) => top - n * size * LH - 1;
/** A ruled cell with its caption just above it (lines joined with <br>), in the given size. */
const capCell = (x, top, w, h, caption, size, exp, more) => at(x + 1.5, capTop(top, size, caption.split('<br>').length), size, caption, more) + cellAt(x, top, w, h, exp);
/** A full-width rule that divides sections. */
const sectionRule = (top) => stroke(72, top, 468, 1);
/** A text field named by a caption: optional unless the caption says required, never filled in from onboarding. */
const capText = (label, more) => inv('text', Object.assign({ fillIn: true, label, key: '', required: false, other: false, review: false }, more || {}));
/** A tick box drawn as a box character, with its own words after it. */
const glyph = (label, more) => `<span data-k="bracket" data-x='${attr(Object.assign({ type: 'checkbox', role: 'investor', fillIn: true, required: false, label, review: false }, more || {}))}'>&#9744;</span> `;

const CLASS_PAGES = {
  /* ---------- places for somebody else ---------- */
  // An investor block and, lower on the same page, a heading in capitals ending in a colon that names a custodian and
  // says it applies only in some cases, with six blanks under it: four labelled, two unlabelled lines under the address.
  otherHeading: {
    walk: true,
    read: { investorPages: [1], otherPages: [1] },
    html: pg(`<h3 style="text-align:center">SIGNATURE PAGE</h3>${WITNESS}${investorBlock()}
<p class="hd"><b>CUSTODIAN DETAILS (ONLY FOR ACCOUNTS HELD THROUGH A CUSTODIAN):</b></p>
<p>Name of custodian: ${blank(else_('text', 'Custodian', { label: 'Name of custodian' }), U(34))}</p>
<p>Telephone: ${blank(else_('text', 'Custodian', { label: 'Telephone' }), U(26))}</p>
<p>Account number: ${blank(else_('text', 'Custodian', { label: 'Account number' }), U(26))}</p>
<p>Mailing address: ${blank(else_('text', 'Custodian', { label: 'Mailing address' }), U(40))}<br>${blank(else_('text', 'Custodian'), U(40))}<br>${blank(else_('text', 'Custodian'), U(40))}</p>`)
  },
  // The heading stands on the page before: bold, underlined, in capitals, ending in a colon, naming an intermediary
  // firm, with running text only to the foot of its page. The next page opens with that firm's blanks and two signature
  // lines captioned underneath; then a new heading for the investor with one blank of the investor's own.
  otherHeadingCarried: {
    read: { investorPages: [], otherPages: [2] },
    html: `${pg(`<h3>SCHEDULE C</h3><p><b><u>TO BE COMPLETED BY THE INTRODUCING DEALER FIRM OR ADVISER:</u></b></p>
<p>The firm that introduced the Subscriber to the offering completes the following page. It confirms there that it has given the Subscriber the offering documents, that it has a reasonable basis to believe the investment is suitable for the Subscriber, and that it keeps the records the rules of its regulator require.</p>
<p>The firm sends the completed page to the administrator of the Fund together with the pages the Subscriber has completed. A page that is not complete delays the acceptance of the subscription.</p>
<p>Nothing on the following page changes what the Subscriber has agreed to in the body of this Agreement, and the firm is not a party to it.</p>`)}
${pg(`<p>Name of firm: ${blank(else_('text', true, { label: 'Name of firm' }), U(36))}</p>
<p>Branch office: ${blank(else_('text', true, { label: 'Branch office' }), U(30))}</p>
<p>Registration number: ${blank(else_('text', true, { label: 'Registration number' }), U(24))}</p>
${under(else_('signature', true), 'Signature of the registered representative')}
${under(else_('signature', true), 'Signature of the supervising principal')}
<p class="hd"><b>SUBSCRIBER INFORMATION:</b></p>
<p>Occupation of the Subscriber: ${blank(inv('text', { fillIn: true, key: '' }), U(30))}</p>`)}`
  },
  // No heading: each label, ending in a colon and standing directly before its blank, itself names a dealer firm or an
  // adviser, with no word of signing. Guards on the same page, each as the reader gives it today: a sentence that
  // mentions an adviser with a blank of the investor's inside it; a label for an entity's authorised representative;
  // a block of the firm headed by a managing member.
  otherLabel: {
    html: pg(`<h3>ACCOUNT INFORMATION</h3>
<p>Name of dealer firm: ${blank(else_('text', 'Broker-dealer', { label: 'Name of dealer firm' }), U(34))}</p>
<p>Dealer firm branch number: ${blank(else_('text', 'Broker-dealer', { label: 'Dealer firm branch number' }), U(22))}</p>
<p>Name of investment adviser: ${blank(else_('text', 'Adviser', { label: 'Name of investment adviser' }), U(30))}</p>
<p>Investment adviser's telephone: ${blank(else_('text', 'Adviser', { label: "Investment adviser's telephone" }), U(24))}</p>
<p class="hd">The Subscriber has spoken with its own tax adviser about this investment and files its returns in the county of ${blank(inv('text', { fillIn: true, label: 'in the county of', key: '', required: true, other: false }), U(18))}.</p>
<p>Name of authorized representative of the Subscriber (entities only): ${blank(inv('text', { fillIn: true, label: 'Name of authorized representative of the Subscriber', key: '', required: true, other: false, review: false }), U(26))}</p>
${firmBlock('MANAGING MEMBER:', 'ORCHARD LANE CAPITAL, LLC', '', '', firm('signature', { required: true, other: false, review: false }))}`)
  },
  // A signature line captioned underneath for a registered representative and, in the same column under it, a printed
  // name line, a date line and a phone line. All four follow the signature: somebody else's, optional, unmarked; the
  // date and the name never ask whether the investor or the firm fills them in.
  otherSignatureBlock: {
    read: { investorPages: [], otherPages: [1] },
    html: pg(`<h3>CONFIRMATION OF THE SELLING REPRESENTATIVE</h3><p>The representative named below confirms that the Subscriber was given the offering documents before subscribing.</p>
${under(else_('signature', 'Representative', { label: 'Signature of registered representative' }), 'Signature of registered representative')}
${under(else_('name', 'Representative', { label: 'Print name' }), 'Print name')}
${under(else_('date', 'Representative', { label: 'Date' }), 'Date', '1.6in')}
${under(else_('text', 'Representative', { label: 'Telephone' }), 'Telephone', '2.2in')}`)
  },
  // A one-page letter that speaks of the investor in the third person and of its writer in the first person singular:
  // two blanks inside a sentence (a licence number and a state), a closing word, a bare signature line, then printed
  // name, date and phone lines. All six are the letter writer's; the state blank is a plain text field.
  letterClosing: {
    read: { investorPages: [], otherPages: [1] },
    html: pg(`<p>To the General Partner of Halden Ridge Opportunity Fund, LP</p><p>Re: Confirmation of the Subscriber's status</p>
<p>I am a certified public accountant in good standing. I hold licence number ${blank(else_('text', 'Third party'), U(14))} issued by the state of ${blank(else_('text', 'Third party'), U(16))}. I have looked at the Subscriber's tax filings for the two most recent years, and I confirm that in each of them the Subscriber's income was above the amount the rules set for an accredited investor.</p>
<p>The Subscriber is my client and asked me to write this letter. I have no interest in the Fund.</p>
<p>Sincerely,</p>
<p class="gap">${rule(else_('signature', 'Third party'), '3in')}</p>
<p>Print name: ${blank(else_('name', 'Third party', { label: 'Print name' }), U28)}</p>
<p>Date: ${blank(else_('date', 'Third party', { label: 'Date' }), U(20))}</p>
<p>Telephone: ${blank(else_('text', 'Third party', { label: 'Telephone' }), U(24))}</p>`)
  },
  // A bare line under a closing word of a letter, with no other cue to whose it is: optional, marked with the reader's
  // own reason for a line it cannot attribute, and never counted as the investor's signature line.
  closingBare: {
    read: { investorPages: [] },
    marks: 1,
    html: pg(`<p>Thank you for your interest in Halden Ridge Opportunity Fund, LP. The offering documents are enclosed with this letter. Please keep this page with your records.</p>
<p>Very truly yours,</p>
<p class="gap">${rule(inv('signature', { required: false, review: true, why: 'could not tell what it is for', other: false }), '3in')}</p>`)
  },
  // An agreement whose only signature place is a bare line directly under words of execution. Guard: frozen as the
  // reader gave it before any change of this phase (the investor's signature line, required, marked with the reason
  // for a line it cannot attribute, held until the sponsor has looked).
  executionBare: {
    guard: true,
    read: { investorPages: [1], firmPages: [] },
    marks: 1,
    saves: false,
    todo: /Confirm or move the field marked for review/,
    html: pg(`<h3 style="text-align:center">ADOPTION AGREEMENT</h3><p>The undersigned agrees to be bound by the limited partnership agreement of the Fund as a limited partner from the date of its admission.</p>
<p>IN WITNESS WHEREOF, the undersigned has signed below.</p>
<p class="gap">${rule(inv('signature', { required: true, review: true, why: 'could not tell what it is for', other: false }), '3in')}</p>`)
  },

  /* ---------- labels, captions and kinds ---------- */
  // A label ending in a colon, an empty line, then an underscore line across the page starting at the label's left
  // edge, in a column that goes on with two signature lines captioned underneath. The blank gets a field with the
  // label's own words, clear of the signature field under it. Guard on the same page: a heading ending in a colon
  // directly above a rule across the page that sets off text is no place (a field there is a field on no place).
  colonLabelAbove: {
    apart: 1,
    read: { investorPages: [1] },
    html: pg(`<h3 style="margin-bottom:2pt">How notices are given:</h3><hr style="border:0;border-top:1px solid #000;margin:0 0 12pt">
<p>Notices under this Agreement are sent by e-mail and are treated as received on the next business day.</p>
<p>E-mail address for capital call notices:</p><p>&nbsp;</p>
<p>${blank(inv('text', { fillIn: true, label: 'E-mail address for capital call notices', key: '' }), U(74))}</p>
${under(inv('signature', { review: false }), 'Signature of Subscriber')}
${under(inv('signature', { review: false }), 'Signature of second authorized signatory of the Subscriber, if two must sign')}`)
  },
  // A signature line whose caption underneath runs on to a second printed line at the same left edge and size: the
  // label is both lines joined.
  captionTwoLines: {
    html: pg(`<h3 style="text-align:center">SIGNATURE PAGE</h3>${WITNESS}<p><b>SUBSCRIBER:</b></p>
<p class="gap">${rule(inv('signature', { label: 'Signature of the trustee or other authorized person signing for the Subscriber named above' }), '3.4in')}<br><span class="cap">Signature of the trustee or other authorized person</span><br><span class="cap">signing for the Subscriber named above</span></p>
${under(inv('date'), 'Date', '1.6in')}`)
  },
  // A blank inside a sentence after words for a jurisdiction is a plain text field. Guard on the same page: a label
  // that is the single word for a state, with its blank, keeps its kind and its filling in from onboarding.
  sentenceState: {
    html: pg(`<h3>SUBSCRIBER INFORMATION</h3>
<p>The Subscriber is organized under the laws of the state of ${blank(inv('text', { fillIn: true, key: '', kinds: ['other', 'text'] }), U(18))} and keeps its books and records there.</p>
<p>Address: ${blank(inv('text', { fillIn: true, label: 'Address', key: 'street', required: true }), U(46))}</p>
<p>City: ${blank(inv('text', { fillIn: true, label: 'City', key: 'city' }), U(18))} State: ${blank(inv('text', { fillIn: true, label: 'State', key: 'state' }), U(8))} Zip: ${blank(inv('text', { fillIn: true, label: 'ZIP code', key: 'zip' }), U(10))}</p>`)
  },

  /* ---------- whose block it is ---------- */
  // Two blocks of the firm one under the other, each with its heading in bold capitals, an entity name printed in
  // full, "By" and a drawn rule, and a printed name and title under the rule. The second heading is a word the reader's
  // lists do not know, and the title under the first rule is not one of its words for the firm.
  firmBlockByName: {
    read: { investorPages: [], firmPages: [1] },
    marks: 0,
    html: pg(`<h3 style="text-align:center">SIGNATURE PAGE</h3>${EXECUTED}
${firmBlock('GENERAL PARTNER:', 'HARROWGATE MILL PARTNERS GP, LLC', 'Odette Varga', 'President', firmSig())}
${firmBlock('CLASS B PARTNER:', 'HARROWGATE MILL CARRY VEHICLE, LLC', 'Odette Varga', 'President', firmSig())}`)
  },
  // The same with no printed name under the rules and a second heading that names a kind of limited partner.
  firmBlockBare: {
    read: { investorPages: [], firmPages: [1] },
    marks: 0,
    html: pg(`<h3 style="text-align:center">SIGNATURE PAGE</h3>${EXECUTED}
${firmBlock('GENERAL PARTNER:', 'HARROWGATE MILL PARTNERS GP, LLC', '', '', firmSig())}
${firmBlock('SPECIAL LIMITED PARTNER:', 'HARROWGATE MILL CARRY VEHICLE, LLC', '', '', firmSig())}`)
  },
  // A block of the firm, then a block for an investor under a heading the reader does not know and with no company
  // name of its own. Guard: frozen as the reader gave it before any change of this phase, its review marks included:
  // a block under a heading the reader does not know is real doubt, so those three marks are right and stay.
  investorAfterFirm: {
    guard: true,
    read: { investorPages: [1], firmPages: [1] },
    marks: 3,
    saves: false,
    todo: /Confirm or move the 3 fields marked for review/,
    html: pg(`<h3 style="text-align:center">SIGNATURE PAGE</h3>${EXECUTED}
${firmBlock('GENERAL PARTNER:', 'HARROWGATE MILL PARTNERS GP, LLC', 'Odette Varga', 'President', firmSig())}
<p class="hd"><b>COUNTERPART SIGNATURE PAGE:</b></p>
${partnerLines(inv('text', { label: 'Investor name', key: 'investorName', required: true, review: false }), inv('signature', { required: true, review: true, why: 'investor or your firm' }), inv('name', { review: true, why: 'investor or your firm' }), inv('text', { label: 'Title', required: false, review: true, why: 'investor or your firm' }))}`)
  },
  // A block of the firm and a limited partner's page: a blank name line, a "By" line and name and title lines. Guard:
  // one signature of the firm and four fields of the investor, none marked; the agreement can be saved as read. Its
  // walk takes the firm's countersigning through the screens as well.
  partnerPage: {
    guard: true,
    walk: true,
    read: { investorPages: [1], firmPages: [1] },
    marks: 0,
    saves: true,
    html: pg(`<h3 style="text-align:center">SIGNATURE PAGE</h3>${EXECUTED}
${firmBlock('GENERAL PARTNER:', 'HARROWGATE MILL PARTNERS GP, LLC', 'Odette Varga', 'President', firmSig())}
<p class="hd"><b>LIMITED PARTNER:</b></p>
${partnerLines(inv('text', { label: 'Investor name', key: 'investorName', required: true, review: false }), inv('signature', { required: true, review: false }), inv('name', { review: false }), inv('text', { label: 'Title', required: false, review: false }))}`)
  },
  // Two signature rules of the firm, laid out as in firmBlockByName, and no place of any kind for an investor. The
  // titles under the rules are a word the reader knows for the firm, so that this page measures only what a document
  // signed by the firm alone is told and offered. Its summary and what stops its saving are fixed by a later plan.
  firmOnly: {
    walk: true,
    read: { investorPages: [], firmPages: [1] },
    marks: 0,
    html: pg(`<h3 style="text-align:center">SIGNATURE PAGE</h3>${EXECUTED}
${firmBlock('GENERAL PARTNER:', 'HARROWGATE MILL PARTNERS GP, LLC', 'Odette Varga', 'Manager', firmSig())}
${firmBlock('CLASS B PARTNER:', 'HARROWGATE MILL CARRY VEHICLE, LLC', 'Odette Varga', 'Manager', firmSig())}`)
  },
  // An agreement page with nothing to complete but the investor's signature block under plain words of signing.
  // Guard: the three fields exactly as the reader gives them today; the walk on this page passes every stage.
  investorBlock: {
    guard: true,
    walk: true,
    saves: true,
    marks: 0,
    read: { investorPages: [1], firmPages: [] },
    html: pg(`<h3 style="text-align:center">SIGNATURE PAGE</h3>${WITNESS}${investorBlock({ review: false, other: false })}`)
  },

  /* ---------- the places of a printed form: ruled cells and their captions ---------- */
  // A row of four ruled cells 10 to 11 pt tall with a narrow gap between them, each with a caption in small capitals
  // just above it and no colon. Each gets a text field named by its caption, unmarked, inside its cell.
  cellShallow: {
    html: pg(`<h3>SECTION 2. EMPLOYMENT AND FUNDS</h3><p>Write in capital letters, one answer to a box.</p>
${capCell(72, 190, 144, 10.5, 'EMPLOYER', 7, capText('EMPLOYER', { kinds: ['other', 'text'] }))}
${capCell(222, 190, 120, 10.5, 'OCCUPATION', 7, capText('OCCUPATION', { kinds: ['other', 'text'] }))}
${capCell(348, 190, 110, 11, 'NATURE OF BUSINESS', 7, capText('NATURE OF BUSINESS', { kinds: ['other', 'text'] }))}
${capCell(464, 190, 76, 11, 'SOURCE OF FUNDS', 7, capText('SOURCE OF FUNDS', { kinds: ['other', 'text'] }))}`)
  },
  // Cells captioned with known kinds, and two whose captions are of no known kind: one says it applies only in some
  // cases, one prints the word for required. Every field carries its caption's own words (label rule 1), with its kind
  // in kind; optional unless the caption says required; filled in from onboarding only where the caption is the
  // kind's plain word for the investor (label rule 3).
  cellCaptionKinds: {
    html: pg(`<h3>SECTION 1. THE SUBSCRIBER</h3><p>Complete every box that applies to the Subscriber.</p>
${capCell(72, 180, 180, 18, 'City', 7.5, capText('City', { key: 'city', kinds: ['city'] }))}
${capCell(258, 180, 120, 18, 'State', 7.5, capText('State', { key: 'state', kinds: ['state'] }))}
${capCell(384, 180, 156, 18, 'Postal code', 7.5, capText('Postal code', { key: 'zip', kinds: ['zip'] }))}
${capCell(72, 222, 228, 18, 'Telephone', 7.5, capText('Telephone', { key: 'phone', kinds: ['phone'] }))}
${capCell(306, 222, 234, 18, 'Email', 7.5, capText('Email', { key: 'email', kinds: ['email'] }))}
${capCell(72, 264, 228, 18, 'Date of birth', 7.5, capText('Date of birth'))}
${capCell(306, 264, 234, 18, 'Tax identification number', 7.5, capText('Tax identification number', { kinds: ['taxId'] }))}
${capCell(72, 306, 228, 18, 'Employer, if applicable', 7.5, capText('Employer, if applicable', { kinds: ['other', 'text'] }))}
${capCell(306, 306, 234, 18, 'Country of citizenship (required)', 7.5, capText('Country of citizenship (required)', { required: true, kinds: ['other', 'text'] }))}`)
  },
  // A cell under a caption of two lines, a cell under a caption of three lines, one caption centred over two cells of
  // a row, and a section heading in a larger bold size directly above a caption. Each label is all the caption's lines
  // joined; the two cells under one caption both take it; the section heading is in no label.
  cellCaptionLines: {
    html: pg(`<h3>ACCOUNT DETAILS</h3><p>Please complete the boxes below.</p>
${at(72, 160, 11, '<b>SECTION 3. THE ACCOUNT</b>')}
${capCell(72, 184, 468, 18, 'Account nickname', 7.5, capText('Account nickname'))}
${capCell(72, 250, 220, 18, 'Bank or institution that<br>keeps the account', 7.5, capText('Bank or institution that keeps the account'))}
${capCell(310, 250, 100, 18, 'Reason for<br>opening the<br>account', 7.5, capText('Reason for opening the account'))}
${at(72, capTop(312, 7.5, 1), 7.5, 'Country and region of tax residence', 'width:322pt;text-align:center')}
${cellAt(72, 312, 158, 18, capText('Country and region of tax residence'))}${cellAt(236, 312, 158, 18, capText('Country and region of tax residence'))}`)
  },
  // Three rows of captioned cells stacked so tightly that the caption of the next row sits right under the cell above.
  // Every cell takes the caption over it, never the caption of the row below, and none becomes a signature.
  cellStackedRows: {
    html: pg(`<h3>SECTION 4. WORK AND INCOME</h3><p>One answer to a box.</p>
${[['Employer', 'Position held'], ['Years with employer', 'Nature of business'], ['Annual income band', 'Source of funds']]
      .map(([a, b], i) => {
        const top = 190 + i * 23.5;
        return capCell(72, top, 228, 14, a, 7.5, capText(a)) + capCell(306, top, 234, 14, b, 7.5, capText(b));
      })
      .join('\n')}`)
  },
  // A full-width cell whose caption stands 28 pt above it at the cell's left edge, with a block of tick boxes filling
  // the right column in between. The cell is named by that caption; each tick box has its own words.
  cellCaptionLeftColumn: {
    html: pg(`<h3>SECTION 5. INVESTMENT AIMS</h3><p>Describe the aims of the investment and tick each that applies.</p>
${at(73.5, 160, 7.5, 'Investment aims in your own words')}
${at(330, 164, 9, `${box({ label: 'Growth', review: false })}Growth`)}${at(430, 164, 9, `${box({ label: 'Income', review: false })}Income`)}
${at(330, 177, 9, `${box({ label: 'Capital preservation', review: false })}Capital preservation`)}${at(450, 177, 9, `${box({ label: 'Speculation', review: false })}Speculation`)}
${cellAt(72, 196, 468, 22, capText('Investment aims in your own words'))}`)
  },
  // The last body line of page 1 is a label ending in a colon with no blank after it; page 2 opens, under a running
  // header, with an empty cell that has no caption. The cell is named by the label of page 1; the running header is in
  // no label.
  cellAcrossPage: {
    html: `${pg(`<h3>SECTION 6. NOTICES</h3><p>The Fund sends notices to the address the Subscriber gives in Section 1. A Subscriber who wants notices sent in another way, or to another person, writes its instructions in the box that follows.</p>
<p>Instructions given here stay in force until the Subscriber changes them in writing.</p>
${at(72, 680, 12, 'Special instructions for the delivery of notices:')}`)}
${pg(`${at(72, 40, 8, 'Investor Questionnaire (continued)')}
${cellAt(72, 80, 468, 48, inv('text', { fillIn: true, label: 'Special instructions for the delivery of notices', key: '', required: false, other: false }))}
<p style="margin-top:80pt">The Subscriber confirms that the answers given in this questionnaire are complete and true.</p>`)}`
  },
  // A row of a signature cell with a small printed sign-here mark at its left edge, a date cell and a text cell, each
  // captioned above. The marked cell is a signature, the date cell a date, the text cell a text field; the mark names
  // no neighbour.
  cellSignHere: {
    read: { investorPages: [1] },
    html: pg(`<h3 style="text-align:center">SIGNATURE</h3>${WITNESS}
${at(73.5, capTop(240, 7.5, 1), 7.5, 'Signature of Subscriber')}${cellAt(72, 240, 228, 26, inv('signature', { label: 'Signature of Subscriber', required: true, other: false }), at(2.5, 14, 8, 'X'))}
${capCell(306, 240, 94, 26, 'Date', 7.5, inv('date', { label: 'Date', required: true, other: false }))}
${capCell(406, 240, 134, 26, 'Account number', 7.5, capText('Account number'))}`)
  },
  // A run of underscores ending a caption row, about 0.8 pt above the top edge of a wide cell below it; on the same
  // page a run of underscores with its own underline of the same extent. The blank and the cell each have a field;
  // the underlined run is one blank.
  underscoresOverRule: {
    html: pg(`<h3>SECTION 7. STATEMENTS</h3><p>Statements are sent by post unless the Subscriber gives other instructions.</p>
${at(72, 170, 9, 'Instructions for mailing statements')}${at(330, 170, 9, `Account reference ${blank(inv('text', { fillIn: true, label: 'Account reference', key: '', required: true, other: false }), U(30))}`)}
${cellAt(72, 180.1, 468, 30, capText('Instructions for mailing statements'))}
${at(72, 250, 11, `Bank reference: <u>${blank(inv('text', { fillIn: true, label: 'Bank reference', key: '', required: true, other: false }), U(20))}</u>`)}`)
  },
  // Guard: an ordinary table of figures with empty cells among cells with words, an empty cell under a price range, an
  // empty cell under a bulleted list, and a grid with a header row. No field anywhere on the page, and no page is named
  // as left without a field.
  tableGuard: {
    guard: true,
    read: { left: [] },
    html: pg(`<h3>SCHEDULE B. THE OFFERING IN FIGURES</h3><p>The tables below are for information only.</p>
<table class="t"><tr><td>Year</td><td>Units issued</td><td>Price per unit</td><td>Notes</td></tr><tr><td>2023</td><td>1,200</td><td>$10.00</td><td>First close</td></tr><tr><td>2024</td><td></td><td>$10.50</td><td>Second close</td></tr><tr><td></td><td>2,450</td><td>$11.00</td><td>Final close</td></tr><tr><td>2026</td><td>Not yet set</td><td></td><td>To be decided</td></tr></table>
<table class="t"><tr><td>$0 to $99,999</td><td>$100,000 to $499,999</td><td>$500,000 and above</td></tr><tr><td></td><td></td><td></td></tr></table>
<table class="t"><tr><td><ul><li>Quarterly reports</li><li>Annual audited statements</li></ul></td><td>Sent by e-mail</td></tr><tr><td></td><td></td></tr></table>
<table class="t"><tr><td>Date</td><td>Description</td><td>Amount</td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></table>`)
  },
  // A drawn square 36 pt high for initials beside a paragraph, and a box 58 pt high captioned for a seal. Each field
  // fills its box to within 1.5 pt on every side.
  tallBox: {
    html: pg(`<h3>SECTION 8. CONFIRMATIONS</h3>
${at(72, 150, 11, 'I confirm that I have read the section on risks in the<br>memorandum and kept a copy of it for my records.<br>I initial the box to the right to say so.', 'white-space:normal;width:360pt')}
${at(471.5, capTop(150, 7.5, 1), 7.5, 'Initials')}<div data-k="box" data-x='${attr({ type: 'initials', role: 'investor', fillIn: true, label: 'Initials', required: true, other: false, fill: 1.5 })}' style="position:absolute;left:470pt;top:150pt;width:36pt;height:36pt;border:.75pt solid #000;box-sizing:border-box"></div>
${at(73.5, capTop(262, 7.5, 1), 7.5, 'Seal of the Subscriber, if any')}<div data-k="box" data-x='${attr({ type: 'text', role: 'investor', fillIn: true, label: 'Seal of the Subscriber, if any', key: '', required: false, other: false, fill: 1.5 })}' style="position:absolute;left:72pt;top:262pt;width:160pt;height:58pt;border:.75pt solid #000;box-sizing:border-box"></div>`)
  },
  // A row of three captioned cells and a fourth cell of the same row with no caption. Three fields, none on the fourth
  // cell; the reading names the page as one with a printed place left without a field, and the summary says so.
  leftSaid: {
    read: { left: [1] },
    summary: [/Not every printed place got a field/],
    html: pg(`<h3>SECTION 9. BANK DETAILS</h3><p>Distributions are paid to the account given here.</p>
${capCell(72, 190, 108, 18, 'Bank', 7.5, capText('Bank'))}${capCell(186, 190, 114, 18, 'Branch', 7.5, capText('Branch'))}${capCell(306, 190, 114, 18, 'Account type', 7.5, capText('Account type'))}${cellAt(426, 190, 114, 18, null)}`)
  },
  // A cell whose caption contains an angle-bracket tag with an event attribute. One text field whose label is the
  // caption as plain characters; in the editor nothing printed on the page becomes an element or runs.
  cellCaptionMarkup: {
    inert: true,
    html: pg(`<h3>SECTION 10. REFERENCE</h3><p>Give the reference printed on your welcome letter.</p>
${capCell(72, 190, 300, 18, '&lt;img src=x onerror="window.__pwn=2"&gt; ref', 7.5, capText('<img src=x onerror="window.__pwn=2"> ref'))}`)
  },
  // Tick boxes in three columns whose rows do not share baselines (the middle column is set 4 pt higher in a smaller
  // size), and one box whose words are in another size. Every box is a tick box with its own words, none marked.
  boxColumns: {
    marks: 0,
    html: pg(`<h3>SECTION 11. SOURCE OF THE MONEY INVESTED</h3><p>Tick every source that applies.</p>
${['Savings', 'Salary', 'Gift'].map((l, i) => at(72, 170 + i * 16, 10, `${glyph(l)}${l}`)).join('')}
${['Inheritance', 'Sale of a business', 'Pension'].map((l, i) => at(230, 166 + i * 16, 8, `${glyph(l)}${l}`)).join('')}
${['Real estate', 'Investments'].map((l, i) => at(400, 170 + i * 16, 10, `${glyph(l)}${l}`)).join('')}${at(400, 202, 10, `${glyph('Other assets')}<span style="font-size:7.5pt">Other assets</span>`)}`)
  },
  // A blank after a currency sign with the words that name the amount right after it on the line; two blanks ending
  // an indented line directly after a colon; a short rule with a small caption centred under it and nothing else
  // under it. An amount field with no currency sign written again, two text fields named by the last clause before
  // the colon, a text field named by the caption under the rule; none marked.
  sureBlanks: {
    marks: 0,
    html: pg(`<h3>SECTION 12. THE SUBSCRIPTION</h3>
<p>The Subscriber will pay $${blank(inv('text', { fillIn: true, label: 'Commitment amount', key: 'amount', required: false, other: false, review: false }), U(16))} subscription amount by wire within five business days of acceptance.</p>
<p class="ind">If the account holds two classes, give the units in each: ${blank(capText('give the units in each'), U(8))} ${blank(capText('give the units in each'), U(8))}</p>
<div style="margin-top:40pt;width:1.8in;text-align:center">${rule(capText('Country of tax residence', { required: true }), '1.8in')}<br><span class="cap">Country of tax residence</span></div>`)
  },
  // Two sections divided by full-width rules: the first is headed as applying only in some cases and holds three
  // captioned cells, one of whose captions prints the word for required; the second is for every investor and holds a
  // captioned cell whose caption prints the word for required. Every cell of the first section is optional, the one
  // with the required caption included; the cell of the second section is required.
  requiredInSection: {
    html: pg(`${sectionRule(110)}${at(72, 118, 11, '<b>SECTION 13. ONLY FOR ACCOUNTS HELD IN A FOREIGN CURRENCY</b>')}
${capCell(72, 160, 150, 18, 'Currency of the account (required)', 7.5, capText('Currency of the account (required)'))}
${capCell(228, 160, 150, 18, 'Exchange rate source', 7.5, capText('Exchange rate source'))}
${capCell(384, 160, 156, 18, 'Settlement instructions', 7.5, capText('Settlement instructions'))}
${sectionRule(200)}${at(72, 208, 11, '<b>SECTION 14. EVERY INVESTOR</b>')}
${capCell(72, 250, 300, 18, 'Primary purpose of the investment (required)', 7.5, capText('Primary purpose of the investment (required)', { required: true }))}`)
  }
};

module.exports = { CLASS_PAGES, CLASS_CSS };
