import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import pdfplumber
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
S = Sheet('a083', T + '/set-a/a083/doc.pdf', T + '/truth/a083')
S.how = ('pdfplumber words, Wingdings box glyphs, and the drawn lines and thin filled shapes of the table borders (cell box = centre lines of its rules); '
         'tick squares measured on a 400 dpi render; every page looked at at 100 dpi, the stock order form pages (11-14) again at 130 dpi; overlays looked at.')
for p in range(1, 25): S.SURE[p] = 'sure (no place)'
pdf = S.pdf
def W(page, text, n=0):
    return [w for w in pdf.pages[page - 1].extract_words() if w['text'] == text][n]
def C(id, page, box, kind, what, owner, label, must=False, pl=None, src='drawn table cell (centre lines of its rules)', **kw):
    return S.add(id, page, kind, what, owner, label, must, box, src, printed_label=pl, **kw)
G11 = [c for c in pdf.pages[10].chars if 'ingding' in c['fontname']]
def tick(id, i, owner, label, **kw):
    return sheet_glyph_ink(S, id, 11, G11[i], owner, label, **kw)
# ---- page 11: stock order form, front
C('p11-shares', 11, [45.0, 200.0, 125.6, 215.0], 'blank', 'amount', INV, '(1) Number of shares', True, '(1) Number of Shares')
C('p11-total', 11, [179.9, 199.7, 317.5, 215.0], 'blank', 'amount', INV, '(2) Total payment due (after the printed "$")', True, '(2) Total Payment Due')
tick('p11-employee', 0, INV, '(3) Employee, officer or director of the association, or family in the same household')
C('p11-check-amount', 11, [409.2, 267.1, 546.1, 297.7], 'blank', 'amount', INV, '(4) Total check amount: dollars', False, 'Total Check Amount')
C('p11-check-cents', 11, [546.1, 267.1, 583.0, 297.7], 'blank', 'amount', INV, '(4) Total check amount: cents (cell after the printed decimal point)', False,
  doubt='the amount is split into a dollars cell and a cents cell; counted as two places')
for r, (y0, y1) in enumerate([(338.7, 354.6), (354.6, 370.6)], 1):
    C('p11-wd%d-bankuse' % r, 11, [35.6, y0, 195.1, y1], 'blank', 'text', TP, '(5) Withdrawal row %d: Bank Use column (for the association\'s staff)' % r, False, 'Bank Use')
    C('p11-wd%d-account' % r, 11, [195.1, y0, 373.8, y1], 'blank', 'text', INV, '(5) Withdrawal row %d: account number to withdraw from' % r, False, 'Account Number(s) To Withdraw')
    C('p11-wd%d-amount' % r, 11, [409.2, y0, 546.1, y1], 'blank', 'amount', INV, '(5) Withdrawal row %d: amount in dollars' % r, False, '$ Withdrawal Amount')
    C('p11-wd%d-cents' % r, 11, [546.1, y0, 583.0, y1], 'blank', 'amount', INV, '(5) Withdrawal row %d: cents' % r, False)
for i, (k, l) in enumerate([('a', 'eligible account holder'), ('b', 'supplemental eligible account holder'), ('c', 'voting member'), ('d', 'community member')]):
    tick('p11-purch-' + k, 1 + i, INV, '(6) Purchaser category %s: %s' % (k, l), group='p11 (6) purchaser information')
for r, (y0, y1) in enumerate([(487.4, 502.7), (502.7, 518.0), (518.0, 533.3)], 1):
    C('p11-acct%d-bankuse' % r, 11, [35.6, y0, 110.4, y1], 'blank', 'text', TP, '(6) Account row %d: Bank Use column' % r, False, 'Bank Use')
    C('p11-acct%d-number' % r, 11, [110.4, y0, 271.6, y1], 'blank', 'text', INV, '(6) Account row %d: account number' % r, False, 'Account Number(s)')
    C('p11-acct%d-title' % r, 11, [271.6, y0, 583.0, y1], 'blank', 'name', INV, '(6) Account row %d: account title (names on the account)' % r, False, 'Account Title (Name(s) on Account)')
for i, (k, l) in enumerate([('individual', 'Individual'), ('joint', 'Joint Tenants'), ('tic', 'Tenants in Common'), ('fiduciary', 'Fiduciary'),
                            ('utma', 'Uniform Transfers to Minors Act'), ('company', 'Company/Corporation/Partnership'), ('ira', 'IRA or other qualified plan')]):
    tick('p11-own-' + k, 5 + i, INV, '(7) Form of stock ownership: ' + l, printed_label=l, group='p11 (7) form of stock ownership')
C('p11-tin-1', 11, [398.8, 533.3, 583.0, 561.8], 'blank', 'tax number', INV, '(7) SS# / tax ID#, first', True, 'SS#/Tax ID#')
C('p11-tin-2', 11, [398.8, 561.8, 583.0, 594.4], 'blank', 'tax number', INV, '(7) SS# / tax ID#, second (joint owner, minor, or the plan\'s tax ID for an IRA)', False, 'SS#/Tax ID#',
  doubt='whose second number this is depends on the ownership chosen (joint owner, or plan and owner for an IRA)')
C('p11-reg-name', 11, [95.1, 618.7, 583.0, 629.2], 'blank', 'name', INV, '(8) Stock registration: name', True, 'Name:')
C('p11-reg-name-2', 11, [95.1, 629.2, 583.0, 647.9], 'blank', 'name', INV, '(8) Stock registration: name continued (other registered owners)', False, 'Name Continued:')
C('p11-street', 11, [95.1, 647.9, 583.0, 670.2], 'blank', 'address', INV, '(8) Mail to: street', True, 'Mail to- Street:')
C('p11-city', 11, [95.1, 670.2, 302.2, 685.5], 'blank', 'text', INV, '(8) City', True, 'City:')
C('p11-state', 11, [342.5, 670.2, 384.2, 685.5], 'blank', 'text', INV, '(8) State', True, 'State:')
C('p11-zip', 11, [419.6, 670.2, 583.0, 685.5], 'blank', 'text', INV, '(8) Zip code', True, 'Zip Code:')
C('p11-phone-day', 11, [95.1, 685.5, 233.4, 707.7], 'blank', 'phone', INV, '(9) Daytime telephone (brackets and dashes printed in the cell)', True, '(9) Telephone Daytime/Evening')
C('p11-phone-evening', 11, [233.4, 685.5, 430.1, 707.7], 'blank', 'phone', INV, '(9) Evening telephone (brackets and dashes printed in the cell)', False)
C('p11-county', 11, [466.9, 685.5, 583.0, 707.7], 'blank', 'text', INV, '(9) County of residence', True, 'County of Residence')
tick('p11-nasd', 12, INV, '(10) NASD affiliation')
tick('p11-associates', 13, INV, '(11) Associates / acting in concert')
S.NOT[11] = ['the expiration-date blanks in the header ("___day, ____ x. 2006") and in (6)c and (12) ("February __", "___day, ____ x, 2006"): the association\'s dates, completed before mailing',
             'the empty layout cells: the large top-left area and the top-right cell of the header, the small cell left of the shares cell, the two small cells right of the total payment cell, and the empty full-width row under (1)-(2)',
             'the "$" and "X 10.00 =" caption cells; caption cells "Total Check Amount", "Name:", "City:", "State:", "Zip Code:", "County of Residence", "SS#/Tax ID#"',
             'the header rows of the (5) and (6) tables']
S.SURE[11] = 'sure of the places; judgements: "Bank Use" cells are places of the association\'s staff (third-party), the dollars/cents split counts as two places, the stray empty layout cells are not places'
# ---- page 12: signatures of the order form
sg = [W(12, 'Signature', 0), W(12, 'Signature', 1)]; dt = [W(12, 'Date', 0), W(12, 'Date', 1)]
C('p12-signature', 12, [36.0, sg[0]['bottom'], dt[0]['x0'] - 4, 114.9], 'signature', 'signature', INV, 'Stock order form: first signature', True, 'Signature',
  src='drawn cell (36.0-256.3 x 87.1-114.9) holding "Signature" and "Date" captions; box = the room under the caption, left of "Date"')
C('p12-date', 12, [dt[0]['x0'], dt[0]['bottom'], 256.3, 114.9], 'date', 'date', INV, 'Date beside the first signature', True, 'Date',
  src='the same cell; box = the room under the "Date" caption to the cell\'s right rule')
C('p12-joint-signature', 12, [256.3, sg[1]['bottom'], dt[1]['x0'] - 4, 114.9], 'signature', 'signature', CO, 'Stock order form: second signature (needed only for a joint withdrawal account, per the instructions)', False, 'Signature',
  src='drawn cell (256.3-519.7 x 87.1-114.9); box = the room under the caption, left of "Date"')
C('p12-joint-date', 12, [dt[1]['x0'], dt[1]['bottom'], 519.7, 114.9], 'date', 'date', CO, 'Date beside the second signature', False, 'Date', src='the same cell, right of the "Date" caption')
C('p12-bankuse-1', 12, [519.7, 68.0, 572.5, 87.1], 'blank', 'text', TP, 'Bank Use box (for the association\'s staff)', False, 'Bank Use')
C('p12-bankuse-2', 12, [519.7, 87.1, 583.0, 114.9], 'blank', 'text', TP, 'Bank Use column, the cell beside the signatures', False, 'Bank Use',
  doubt='no caption of its own; read as the second cell of the Bank Use column')
S.NOT[12] = ['the 10 pt sliver cell right of the first Bank Use box (x 572.5-583)', 'the acknowledgement prose; "SIGNATURE REQUIRED ON REVERSE SIDE ALSO"']
S.SURE[12] = 'sure of the signature and date places; the two Bank Use cells are a judgement (third-party)'
# ---- page 13: reverse side
for r, (y0, y1) in enumerate([(80.1, 95.4), (95.4, 110.7), (110.7, 126.0)], 1):
    C('p13-acct%d-bankuse' % r, 13, [35.6, y0, 99.2, y1], 'blank', 'text', TP, 'Item (6) continued, row %d: Bank Use column' % r, False, 'Bank Use')
    C('p13-acct%d-number' % r, 13, [99.2, y0, 283.4, y1], 'blank', 'text', INV, 'Item (6) continued, row %d: account number' % r, False, 'Account Number(s)')
    C('p13-acct%d-title' % r, 13, [283.4, y0, 583.0, y1], 'blank', 'name', INV, 'Item (6) continued, row %d: account title' % r, False, 'Account Title (Name(s) on Account)')
for r, (y0, y1) in enumerate([(232.3, 244.1), (244.1, 256.0), (256.0, 267.8)], 1):
    C('p13-assoc%d-names' % r, 13, [35.6, y0, 457.2, y1], 'blank', 'name', INV, 'Item (11) continued, row %d: names on other stock order forms' % r, False, 'Name(s) listed on other stock order forms')
    C('p13-assoc%d-shares' % r, 13, [457.2, y0, 583.0, y1], 'blank', 'amount', INV, 'Item (11) continued, row %d: number of shares ordered' % r, False, 'Number of shares ordered')
S.NOT[13] = ['"dated _____, 2006" and "beginning on page __" in the certification: the prospectus date and page, completed by the association',
             'the numbered list 1-14 under the certification (the risk factors the association lists; no room for the investor)', 'table header rows; the NASD continued text box']
S.SURE[13] = 'sure'
sg = [W(14, 'Signature', 0), W(14, 'Signature', 1)]; dt = [W(14, 'Date', 0), W(14, 'Date', 1)]
pn = [w for w in pdf.pages[13].extract_words() if w['text'] == 'Name']
C('p14-cert-signature', 14, [36.0, sg[0]['bottom'], dt[0]['x0'] - 4, 116.3], 'signature', 'signature', INV, 'Certification form: first signature', True, 'Signature',
  src='drawn cell (36.0-298.0 x 88.5-116.3) holding "Signature" and "Date"; box = the room under the caption, left of "Date"')
C('p14-cert-date', 14, [dt[0]['x0'], dt[0]['bottom'], 298.0, 116.3], 'date', 'date', INV, 'Date beside the first certification signature', True, 'Date', src='the same cell, under "Date"')
C('p14-cert-joint-signature', 14, [298.0, sg[1]['bottom'], dt[1]['x0'] - 4, 116.3], 'signature', 'signature', CO, 'Certification form: second signature', False, 'Signature',
  src='drawn cell (298.0-583.0 x 88.5-116.3); box = the room under the caption, left of "Date"')
C('p14-cert-joint-date', 14, [dt[1]['x0'], dt[1]['bottom'], 583.0, 116.3], 'date', 'date', CO, 'Date beside the second certification signature', False, 'Date', src='the same cell, under "Date"')
C('p14-cert-name', 14, [pn[0]['x1'] + 2, 116.3, 298.0, 130.2], 'blank', 'name', INV, 'Certification form: printed name of the first signer', True, 'Print Name',
  src='drawn cell holding its caption; box = the room right of "Print Name"')
C('p14-cert-joint-name', 14, [pn[1]['x1'] + 2, 116.3, 583.0, 130.2], 'blank', 'name', CO, 'Certification form: printed name of the second signer', False, 'Print Name',
  src='drawn cell holding its caption; box = the room right of "Print Name"')
S.NOT[14] = ['the end of the numbered list (10-14)']
S.SURE[14] = 'sure'
S.NOT[3] = ['the blanks in the letters ("xx:xx", "___day, ____ x, 2006") on pages 3-8 and 18-24, and the date, salutation, meeting time and telephone blanks of the letters on pages 18-24: the association completes them before mailing',
            'every page carries off-page full-width rules from the HTML-to-PDF conversion (drawn far outside the page)']
S.NOT[7] = ['the four Wingdings boxes beside the priority list: bullets in a Q&A answer, not places']
S.NOT[16] = ['the four underlines at y 94.4: underlined words in the instructions ("Delivery Instructions", "stock order return envelope", ...)', 'the deadline blanks in the instructions (the association\'s)']
S.signing = dict(investor_pages=[12, 14], firm_pages=[], co_investor=True, third_parties=['the association\'s staff: "Bank Use" cells on pages 11-13'],
                 kind='A bank conversion mailing packet (letters, Q&A, guides). The investor places are on the stock order form (pages 11-12, its reverse side page 13) and the certification form (page 14); each has a first and a second signature with a date. No acceptance block for the company.')
S.notes = ['Only pages 11-14 carry places; all other pages are letters, Q&A and guides whose blanks are the association\'s own (dates, salutations, phone numbers).',
           'The second signatures (pages 12 and 14) are read as the co-investor\'s; the instructions say one signature is normally required.',
           '"Bank Use" cells are counted as third-party places (for the association\'s staff), like "for office use only".',
           'Signature-and-date cells are split: the signature room under the "Signature" caption left of "Date", the date room under "Date".']
S.write('doc.pdf', 'PDF points, origin top-left, y grows downward. Cell: the centre lines of its rules (or the stated room inside a captioned cell). Tick box: the printed square, measured.')
S.overlays()
print(S.counts())
for p in S.P:
    if p['kind'] == 'tickbox': print(p['id'], p['x0'], p['y0'], p['x1'], p['y1'], round(p['x1'] - p['x0'], 1), round(p['y1'] - p['y0'], 1))
