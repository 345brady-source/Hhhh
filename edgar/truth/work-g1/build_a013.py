import sys; sys.path.insert(0, '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import *

D = Doc('a013')
HF = 'the grey header and footer rules and the page number'
for p in range(1, 8):
    D.SURE[p] = 'sure (no place: agreement text)'
    D.NOT[p] = [HF, 'short black rules under headings and defined terms (underlined words)']

# ---------- page 8 ----------
D.run('p08-executed-day', 8, 0, 'blank', 'date', INV, 'Date of execution: the day ("this ___ OF")', False, 'IN WITNESS WHEREOF ... this',
      doubt='one date printed over two lines (day on the first, month and year on the second): recorded as two places')
D.runs_span('p08-executed-month-year', 8, [1, 2], 'blank', 'date', INV, 'Date of execution: month and year ("____, 20__")', False, how='month, year',
            doubt='one date printed over two lines (day on the first, month and year on the second): recorded as two places')
D.run('p08-ind-signature', 8, 3, 'signature', 'signature', IND, 'Purchaser (if an individual): signature (By:)', False, 'By', condition='purchaser is an individual')
D.run('p08-ind-name', 8, 5, 'blank', 'name', IND, 'Purchaser (if an individual): name', False, 'Name', condition='purchaser is an individual')
D.run('p08-joint-signature', 8, 8, 'signature', 'signature', CO, 'Joint title owner (if title will be joint): signature (By:)', False, 'By')
D.run('p08-joint-name', 8, 10, 'blank', 'name', CO, 'Joint title owner: name (please print)', False, 'Name (please print)')
D.run('p08-ent-name', 8, 4, 'blank', 'name', ENT, 'Purchaser (if an entity): legal name of entity (caption under the line)', False, 'Legal Name of Entity', condition='purchaser is an entity')
D.run('p08-ent-signature', 8, 6, 'signature', 'signature', ENT, 'Purchaser (if an entity): signature (By:)', False, 'By', condition='purchaser is an entity')
D.run('p08-ent-signer', 8, 7, 'blank', 'name', ENT, 'Purchaser (if an entity): name of the signer (please print)', False, 'Name (please print)', condition='purchaser is an entity')
D.run('p08-ent-title', 8, 9, 'blank', 'title', ENT, 'Purchaser (if an entity): title of the signer', False, 'Title', condition='purchaser is an entity')
D.run('p08-ind-tax-id', 8, 11, 'blank', 'tax number', IND, 'Social security or tax ID number of purchaser (individual column; caption under the line)', False, 'Social Security No. or Tax ID No. of Purchaser')
D.run('p08-ent-tax-id', 8, 12, 'blank', 'tax number', ENT, 'Social security or tax ID number of entity purchaser (caption under the line)', False, 'Social Security No. or Tax ID No. of entity Purchaser')
D.run('p08-joint-tax-id', 8, 13, 'blank', 'tax number', CO, 'Social security or tax ID number of purchaser and any joint subscribers (caption under the line)', False,
      'Social Security No. or Tax ID No. of Purchaser and any Joint Subscribers (if any)', owner_also_ok=[INV],
      doubt='the caption names the purchaser and any joint subscribers: taken as the joint subscribers\' tax numbers')
D.run('p08-domicile', 8, 14, 'blank', 'text', INV, 'State or country of domicile or formation', True, 'State/Country of Domicile or Formation')
D.run('p08-amount', 8, 15, 'blank', 'amount', INV, 'Aggregate subscription amount in US dollars', True, 'Aggregate Subscription Amount: US$')
D.run('p08-firm-shares', 8, 16, 'blank', 'text', FIRM, 'Company acceptance: number of shares accepted', False, 'confirmed and accepted by the Company as to')
D.run('p08-firm-signature', 8, 17, 'signature', 'signature', FIRM, 'Company acceptance: signature (By:)', False, 'By')
D.run('p08-firm-name', 8, 18, 'blank', 'name', FIRM, 'Company acceptance: name of the signer', False, 'Name')
D.run('p08-firm-title', 8, 19, 'blank', 'title', FIRM, 'Company acceptance: title of the signer', False, 'Title')
D.NOT[8] = [HF, 'the captions printed under lines', 'the company name "BIO FIL INC"']
D.SURE[8] = 'sure (judgements: the execution date over two lines is two places; the third tax number line is the joint subscribers\')'

# ---------- page 9 ----------
D.run('p09-shares', 9, 0, 'blank', 'text', INV, 'Appendix A: number of shares of common stock to be acquired ($10 per share)', True, 'Securities to Be Acquired')
D.run('p09-price', 9, 1, 'blank', 'amount', INV, 'Appendix A: aggregate purchase price to be paid (US$)', True, 'Aggregate Purchase Price to be Paid')
D.NOT[9] = [HF, 'the two underlined column headings (rules under words)']
D.SURE[9] = 'sure'

# ---------- page 10: IRS Form W-9 as a picture ----------
P = Pic(D, 10)
def pic(id, kind, what, owner, label, must, box, how, plab=None, **kw):
    D.add(id, 10, kind, what, owner, label, must, box, how + ' [' + P.desc() + ']', plab, **kw)
CELL = 'picture: drawn cell (its rules located on the picture\'s pixels; box = centre lines)'
pic('p10-w9-name', 'blank', 'name', INV, 'W-9 line 1: name as shown on the income tax return (caption at the top of the cell)', True, P.cell(57, 83, 576, 108), CELL, '1 Name (as shown on your income tax return)')
pic('p10-w9-business-name', 'blank', 'name', INV, 'W-9 line 2: business name / disregarded entity name, if different', False, P.cell(57, 108, 576, 132), CELL, '2 Business name/disregarded entity name, if different from above')
sq = [(65, 159, 73, 167, 'individual / sole proprietor or single-member LLC'), (180, 157, 188, 165, 'C corporation'), (252, 157, 260, 165, 'S corporation'),
      (324, 157, 332, 165, 'partnership'), (396, 157, 404, 165, 'trust / estate'), (65, 183, 73, 191, 'limited liability company'), (65, 230, 73, 238, 'other (see instructions)')]
for i, (a, b, c, d, l) in enumerate(sq):
    pic('p10-w9-class-%d' % (i + 1), 'tickbox', 'tickbox', INV, 'W-9 line 3 federal tax classification: ' + l, False, P.sq(a, b, c, d),
        'picture: printed square found on the picture\'s pixels (ink)', group='p10 W-9 tax classification: check one of seven')
pic('p10-w9-llc-class', 'blank', 'text', INV, 'W-9 line 3: tax classification of the LLC (C, S or P), after an arrow', False, P.line_box(412, 446, 191), 'picture: drawn line (pixels; box = line and 10 pt above)')
pic('p10-w9-exempt-payee', 'blank', 'text', INV, 'W-9 box 4: exempt payee code (if any)', False, P.line_box(541, 576, 179), 'picture: drawn line (pixels; box = line and 10 pt above)', 'Exempt payee code (if any)')
pic('p10-w9-fatca', 'blank', 'text', INV, 'W-9 box 4: exemption from FATCA reporting code (if any)', False, P.line_box(504, 576, 215), 'picture: drawn line (pixels; box = line and 10 pt above)', 'Exemption from FATCA reporting code (if any)')
pic('p10-w9-address', 'blank', 'address', INV, 'W-9 line 5: address (number, street, apt or suite)', True, P.cell(57, 240, 388, 264), CELL, '5 Address (number, street, and apt. or suite no.)')
pic('p10-w9-requester', 'blank', 'address', FIRM, "W-9: requester's name and address (optional; the requester is the company)", False, P.cell(388, 240, 576, 288), CELL, "Requester's name and address (optional)",
    owner_also_ok=[TP], doubt='the requester is the issuer collecting the form: taken as the firm\'s place')
pic('p10-w9-city', 'blank', 'address', INV, 'W-9 line 6: city, state and ZIP code', True, P.cell(57, 264, 388, 288), CELL, '6 City, state, and ZIP code')
pic('p10-w9-accounts', 'blank', 'text', INV, 'W-9 line 7: list account number(s) here (optional)', False, P.cell(57, 288, 576, 311), CELL, '7 List account number(s) here (optional)')
for i, (a, c, n) in enumerate([(417, 460, 3), (475, 504, 2), (518, 576, 4)]):
    pic('p10-w9-ssn-%d' % (i + 1), 'blank', 'tax number', INV, 'W-9 Part I: social security number, group %d of 3 (%d digit cells)' % (i + 1, n), False, P.cell(a, 336, c, 360),
        'picture: a row of %d drawn digit cells (pixels; box = outer rules)' % n, 'Social security number', group='p10 W-9 TIN: SSN or EIN')
for i, (a, c, n) in enumerate([(417, 446, 2), (460, 561, 7)]):
    pic('p10-w9-ein-%d' % (i + 1), 'blank', 'tax number', INV, 'W-9 Part I: employer identification number, group %d of 2 (%d digit cells)' % (i + 1, n), False, P.cell(a, 384, c, 408),
        'picture: a row of %d drawn digit cells (pixels; box = outer rules)' % n, 'Employer identification number', group='p10 W-9 TIN: SSN or EIN')
pic('p10-w9-signature', 'signature', 'signature', INV, 'W-9 Part II: signature of U.S. person ("Sign Here")', True, P.pt([124, 540.5, 386, 564.5]),
    'picture: the room between the caption arrow and "Date" in the drawn signature row (pixels)', 'Signature of U.S. person')
pic('p10-w9-date', 'date', 'date', INV, 'W-9 Part II: date beside the signature', True, P.pt([411, 540.5, 576.5, 564.5]), 'picture: the room after "Date" in the drawn signature row (pixels)', 'Date')
D.NOT[10] = [HF, 'the W-9 header boxes (form number, title, "Give form to the requester")', 'the heavy section bars "Part I" and "Part II"', 'the dashes between the digit groups',
             'the general instructions under the signature row (text)', 'the side caption "Print or type"']
D.SURE[10] = 'sure of the places; boxes measured on a 612 x 792 px picture (about 0.8 pt a pixel, so within 1 pixel = 0.8 pt); SSN and EIN taken as digit groups (3 + 2), not single cells'

D.finish(dict(investor_pages=[8, 9, 10], firm_pages=[8], co_investor=True, third_parties=[],
              kind='The purchaser signs page 8 as an individual (with a joint title owner if any) or as an entity, gives tax numbers, domicile and amount; Appendix A repeats shares and price; a blank IRS Form W-9 (a picture) is attached for the investor; the company accepts on page 8 with the number of shares and its signature.'))
