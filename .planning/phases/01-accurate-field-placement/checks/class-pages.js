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
 * and two that classes.js compares itself:
 *   why      words the review reason must contain
 *   kinds    the reader's own kind words the field may carry (a plain text blank is 'other' or 'text')
 *
 * A place for somebody else is nobody's required field: second, other, optional, never filled in from the investor's
 * onboarding, not marked. It is written with else_() below.
 */
const { CSS, blank, rule, U } = require('./fixtures');

const CLASS_CSS = `${CSS}
.cap{font-size:9pt} .hd{margin-top:22pt} .gap{margin-top:34pt} .ind{margin-left:.35in} .small{font-size:10.5pt}`;

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
  }
};

module.exports = { CLASS_PAGES, CLASS_CSS };
