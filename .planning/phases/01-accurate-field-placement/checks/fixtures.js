/*
 * Generated subscription agreements for the placement checks. A fixture is an HTML body (printed to PDF by the check
 * browser) plus options. Every blank carries data-x with what belongs there:
 *   type    the kind of field (signature, name, date, text)
 *   role    who fills it in (investor or firm)
 *   fillIn  true when it is a blank to complete in the body rather than part of a signature block
 *           (measured from Plan 02 Task 1 on; this plan's rules leave it out)
 * The printed position of each blank is read from the page before printing, never from the code under test.
 */
const CSS = `@page{size:8.5in 11in;margin:0} html,body{margin:0} body{font:12pt/1.4 "Times New Roman",serif}
.pg{width:8.5in;height:11in;box-sizing:border-box;padding:1in;position:relative;page-break-after:always;overflow:hidden}
.b{display:inline-block} .rule{display:inline-block;border-bottom:1px solid #000;height:1em;vertical-align:baseline}
.cols{display:flex;gap:.5in} .cols>div{flex:1} .cap{font-size:9pt}`;
const blank = (x, text) => `<span class="b" data-x='${JSON.stringify(x)}'>${text}</span>`;
const rule = (x, width) => `<span class="rule" style="width:${width}" data-x='${JSON.stringify(x)}'></span>`;
const U30 = '_'.repeat(30);
const U28 = '_'.repeat(28);
const block = (role) => `<p>By: ${blank({ type: 'signature', role }, U30)}</p><p>Name: ${blank({ type: 'name', role }, U28)}</p><p>Title: ${blank({ type: 'text', role }, U28)}</p><p>Date: ${blank({ type: 'date', role }, U28)}</p>`;

const FIXTURES = {
  // The investor signs on one page and the firm accepts on the next; every blank is a run of underscores after its label.
  classic: {
    html: `<div class="pg"><h2 style="text-align:center">SUBSCRIPTION AGREEMENT</h2>
<p>The undersigned (the "Subscriber") hereby subscribes for an interest in Northgate Fund I, LP (the "Fund") and agrees to make a Capital Commitment of $${blank({ type: 'text', role: 'investor', fillIn: true }, '_'.repeat(14))} on the terms of this Agreement. The Manager may accept or reject this subscription.</p>
<p>Signature pages follow. The signature of the Subscriber below constitutes execution of the limited partnership agreement of the Fund by each member of the Subscriber.</p></div>
<div class="pg"><h3 style="text-align:center"><u>SIGNATURE PAGE</u></h3><p>IN WITNESS WHEREOF, the undersigned has executed this Subscription Agreement to the Fund as of the date set forth below.</p>
<p><b>SUBSCRIBER:</b></p>${block('investor')}</div>
<div class="pg"><p><b>ACCEPTED AND AGREED:</b></p><p>NORTHGATE FUND I GP, LLC, as General Partner</p>${block('firm')}</div>`
  },
  // One page, two columns (investor left, firm right); every blank is a drawn line with its caption underneath.
  caption: {
    html: `<div class="pg"><h3>Signature Page to Subscription Agreement</h3><p>The Subscriber and the General Partner have signed below.</p>
<div class="cols">${[['investor', 'SUBSCRIBER', 'Signature of Subscriber'], ['firm', 'GENERAL PARTNER', 'Authorized Signature']]
      .map(([role, head, cap]) => `<div><p><b>${head}</b></p><p style="margin:36pt 0 0">${rule({ type: 'signature', role }, '2.6in')}<br><span class="cap">${cap}</span></p>
<p style="margin:24pt 0 0">${rule({ type: 'name', role }, '2.6in')}<br><span class="cap">Print Name</span></p>
<p style="margin:24pt 0 0">${rule({ type: 'date', role }, '1.4in')}<br><span class="cap">Date</span></p></div>`)
      .join('')}</div></div>`
  },
  // One page with no text at all: the stand-in for a scanned agreement.
  blank: {
    html: `<div class="pg"></div>`
  }
};

module.exports = { CSS, FIXTURES, blank, rule, block };
