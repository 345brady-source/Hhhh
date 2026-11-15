import sys; sys.path.insert(0, '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import *

D = Doc('a008')
for p in range(1, 16):
    D.SURE[p] = 'sure (no place: scanned agreement text, general instructions and wire details)'
    D.NOT[p] = ['scanned text; underlined headings', 'the OCR text layer (invisible) and its drawn lines, if any']
D.NOT[14] += ['the printed wire and mailing details (already filled in)', '"Acceptance of Delivery" heading at the foot (nothing to complete printed under it)']

LINE = 'picture (scan): drawn line located on the picture\'s pixels; box = the line and the 10 pt above it'
SQ = 'picture (scan): printed square located on the picture\'s pixels (ink)'

# ---------- page 16 ----------
P = Pic(D, 16)
def ln(id, x0, x1, y, kind, what, owner, label, must=False, plab=None, **kw):
    D.add(id, 16, kind, what, owner, label, must, P.line_box(x0, x1, y), LINE + ' [' + P.desc() + ']', plab, **kw)
def sq(id, b, label, group, owner=INV, plab=None, **kw):
    D.add(id, 16, 'tickbox', 'tickbox', owner, label, False, P.sq(*b), SQ, plab, group=group, **kw)
ln('p16-units', 745, 820, 352, 'blank', 'text', INV, '(a) number of units subscribed for at $100 a unit', True, 'The undersigned irrevocably subscribes for')
ln('p16-price', 568, 781, 382, 'blank', 'amount', INV, '(a) total purchase price (after a dollar sign)', True, 'a total Purchase Price of $')
ln('p16-inv-name', 227, 670, 488, 'blank', 'name', INV, 'Name of investor (print); caption under the line', True, 'Name of Investor (Print)')
ln('p16-joint-name', 227, 670, 557, 'blank', 'name', CO, 'Name of joint investor, if any (print)', False, 'Name of Joint Investor (if any) (Print)')
ln('p16-inv-signature', 227, 689, 640, 'signature', 'signature', INV, 'Signature of investor', True, 'Signature of Investor')
ln('p16-joint-signature', 227, 670, 709, 'signature', 'signature', CO, 'Signature of joint investor (if any)', False, 'Signature of Joint Investor (if any)')
ln('p16-capacity', 227, 690, 790, 'blank', 'title', INV, 'Capacity of signatory (if applicable)', False, 'Capacity of Signatory (if applicable)', owner_also_ok=[ENT])
ln('p16-tax-id', 227, 689, 864, 'blank', 'tax number', INV, 'Social security or taxpayer identification number', True, 'Social Security or Taxpayer Identification Number')
ln('p16-address', 227, 689, 972, 'blank', 'address', INV, 'Residence address', True, 'Residence Address')
SPLIT = 'one line with three captions under it (City, State, Zip Code): split between the captions'
ln('p16-city', 227, 420, 1055, 'blank', 'address', INV, 'City (left part of the line)', True, 'City', doubt=SPLIT)
ln('p16-state', 420, 590, 1055, 'blank', 'address', INV, 'State (middle part of the line)', True, 'State', doubt=SPLIT)
ln('p16-zip', 590, 670, 1055, 'blank', 'address', INV, 'Zip code (right part of the line)', True, 'Zip Code', doubt=SPLIT)
ln('p16-phone', 350, 692, 1131, 'blank', 'phone', INV, 'Telephone (after an empty area-code bracket)', False, 'Telephone ( )')
cap = ['trust', 'estate', 'Uniform Gifts to Minors Act', 'attorney-in-fact', 'corporation', 'other']
sqs = [(672, 474, 692, 493), (671, 499, 692, 518), (672, 522, 692, 542), (672, 546, 692, 566), (671, 571, 692, 590), (672, 594, 692, 614)]
NOTE = 'the boxes stand in a column between the signature lines and the choice words on the right; each belongs to the choice on its row'
for i, (l, b) in enumerate(zip(cap, sqs)):
    sq('p16-capacity-%d' % (i + 1), b, 'If other than an individual, capacity of signatory: ' + l, 'p16 capacity: check one', note=NOTE)
ln('p16-ugma-state', 1170, 1221, 557, 'blank', 'text', INV, 'Uniform Gifts to Minors Act of State of ___', False, 'Uniform Gifts to Minors Act of State of')
joint = ['joint tenants with right of survivorship', 'tenants in common', 'tenants by entirety', 'community property']
jsq = [(671, 661, 692, 680), (671, 684, 692, 703), (671, 708, 692, 727), (671, 733, 692, 752)]
for i, (l, b) in enumerate(zip(joint, jsq)):
    sq('p16-joint-%d' % (i + 1), b, 'If joint ownership, check one: ' + l, 'p16 joint ownership: check one', note=NOTE)
sq('p16-backup', (672, 843, 692, 862), 'Backup withholding statement: check only if the investor is subject to backup withholding', 'p16 backup withholding')
sq('p16-foreign', (672, 1038, 692, 1057), 'Foreign person: check only if the investor is a nonresident alien, foreign corporation, company, trust or estate', 'p16 foreign person')
D.NOT[16] = ['the heading and the certification paragraphs', 'the captions under the lines', 'the empty bracket "( )" of the telephone area code (part of the phone blank, not a box)']
D.SURE[16] = 'sure of the places; boxes measured on a 151 ppi scan (0.48 pt a pixel); judgement: City / State / Zip split from one line'

# ---------- page 17: acceptance ----------
Q = Pic(D, 17)
def ln17(id, x0, x1, y, kind, what, label, plab=None, **kw):
    D.add(id, 17, kind, what, FIRM, label, False, Q.line_box(x0, x1, y), LINE + ' [' + Q.desc() + ']', plab, **kw)
ln17('p17-firm-units', 522, 704, 238, 'blank', 'text', 'Acceptance: number of units accepted', 'THE SUBSCRIPTION FOR')
ln17('p17-firm-price', 688, 838, 270, 'blank', 'amount', 'Acceptance: total purchase price accepted (after a dollar sign)', 'FOR A TOTAL PURCHASE PRICE OF $')
b1 = Q.line_box(720, 944, 300); b2 = Q.line_box(994, 1007, 301)
D.add('p17-firm-accept-date', 17, 'date', 'date', FIRM, 'Acceptance: "accepted as of ____, 201_" (month and day, last digit of the year)', False,
      [b1[0], b1[1], b2[2], b2[3]], 'picture (scan): two drawn lines read as one date; parts give each [' + Q.desc() + ']', 'IS ACCEPTED AS OF',
      parts=[[r1(v) for v in b1], [r1(v) for v in b2]])
ln17('p17-firm-signature', 606, 1021, 497, 'signature', 'signature', 'Company acceptance: signature (By:)', 'By')
ln17('p17-firm-name', 634, 1015, 550, 'blank', 'name', 'Company acceptance: name of the signer', 'Name')
ln17('p17-firm-title', 628, 1020, 577, 'blank', 'title', 'Company acceptance: title of the signer', 'Title')
ln17('p17-firm-date', 623, 1026, 603, 'date', 'date', 'Company acceptance: date', 'Date',
     doubt='a second date in the same block, beside the signature (the acceptance sentence carries the first)')
D.NOT[17] = ['the company name in the acceptance block', 'the bold acceptance sentence (only its blanks are places)']
D.SURE[17] = 'sure'

D.finish(dict(investor_pages=[16], firm_pages=[17], co_investor=True, third_parties=[],
              kind='A scanned Regulation A subscription agreement: the investor fills and signs the one-page signature page (with a joint investor line, capacity choices, joint ownership choices, backup withholding and foreign person boxes); the company accepts on the last page.'),
         how_measured='Every page is a 1284 x 1662 px scan (151 ppi) drawn over the whole page; lines and squares located on the scan\'s pixels (plines.py, squares.py in work-g1) and converted through the drawing matrix; every page looked at; overlays drawn and looked at.')
