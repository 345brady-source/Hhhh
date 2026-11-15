import sys; sys.path.insert(0, '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import *

D = Doc('a066')
for p in range(1, 44):
    if p % 2 == 0 or p == 43:
        D.SURE[p] = 'sure (blank page left by the printed web page)'
    elif p <= 33:
        D.SURE[p] = 'sure (no place: agreement text as a picture)'
        D.NOT[p] = ['rules under defined terms and headings in the picture (underlined words; checked on the pixels: every long rule sits on a text baseline)', 'the hidden OCR text layer']
D.NOT[1] = D.NOT[1] + ['the filing header line of the text layer']
LINE = 'picture: drawn line located on the picture\'s pixels; box = the line and the 10 pt above it'
SQ = 'picture: printed square located on the picture\'s pixels (ink)'

def line(P, id, x0, x1, y, kind, what, owner, label, must=False, plab=None, **kw):
    D.add(id, P.page, kind, what, owner, label, must, P.line_box(x0, x1, y), LINE + ' [' + P.desc() + ']', plab, **kw)
def sq(P, id, b, label, group, plab=None, **kw):
    D.add(id, P.page, 'tickbox', 'tickbox', INV, label, False, P.sq(*b), SQ + ' [' + P.desc() + ']', plab, group=group, **kw)

# ---------- page 35: company acceptance ----------
P = Pic(D, 35)
line(P, 'p35-firm-signature', 559, 899, 262, 'signature', 'signature', FIRM, 'Company acceptance: signature (By:)', False, 'By')
line(P, 'p35-firm-date', 170, 341, 364, 'date', 'date', FIRM, 'Company acceptance: date ("____, 2022")', False, 'Date')
D.NOT[35] = ['the officer\'s name and title, already printed', 'the company name', 'the page footer "1 of 4" and the document code']
D.SURE[35] = 'sure'

# ---------- page 37: investor signature page ----------
P = Pic(D, 37)
D.add('p37-inv-name', 37, 'blank', 'name', INV, 'Name of investor (caption only; nothing printed after it)', True, P.pt([252, 188, 504, 201]),
      'picture: the empty room after the caption up to the end of the column\'s lines (pixels) [' + P.desc() + ']', 'Name of Investor',
      doubt='caption only: no line is printed after "Name of Investor:"')
line(P, 'p37-domicile', 812, 922, 202, 'blank', 'text', INV, 'State or country of formation or domicile', True, 'State/Country of Formation or Domicile')
line(P, 'p37-inv-signature', 187, 503, 243, 'signature', 'signature', INV, 'Investor signature (By:)', True, 'By')
line(P, 'p37-inv-signer', 187, 503, 263, 'blank', 'name', INV, 'Name of the person signing', True, 'Name')
line(P, 'p37-inv-title', 187, 503, 282, 'blank', 'title', INV, 'Title of the person signing', False, 'Title')
line(P, 'p37-inv-date', 567, 736, 323, 'date', 'date', INV, 'Date (right column, beside the signature block)', True, 'Date')
line(P, 'p37-register-name', 126, 503, 383, 'blank', 'name', INV, 'Name in which shares are to be registered (if different); line under the caption', False, 'Name in which Shares are to be registered (if different)')
line(P, 'p37-ein', 242, 503, 424, 'blank', 'tax number', INV, "Investor's EIN", False, "Investor's EIN")
line(P, 'p37-bus-street', 306, 503, 464, 'blank', 'address', INV, 'Business address street', True, 'Business Address Street')
line(P, 'p37-mail-street', 785, 922, 464, 'blank', 'address', INV, 'Mailing address street (if different)', False, 'Mailing Address Street (if different)')
line(P, 'p37-bus-city', 245, 503, 505, 'blank', 'address', INV, 'Business address: city, state, zip', True, 'City, State, Zip')
line(P, 'p37-mail-city', 640, 922, 505, 'blank', 'address', INV, 'Mailing address: city, state, zip', False, 'City, State, Zip')
line(P, 'p37-bus-attn', 170, 503, 545, 'blank', 'name', INV, 'Business address: attention', False, 'Attn')
line(P, 'p37-mail-attn', 565, 922, 545, 'blank', 'name', INV, 'Mailing address: attention', False, 'Attn')
line(P, 'p37-bus-phone', 242, 503, 586, 'blank', 'phone', INV, 'Telephone number (business address column)', False, 'Telephone No.')
line(P, 'p37-mail-phone', 637, 922, 586, 'blank', 'phone', INV, 'Telephone number (mailing address column)', False, 'Telephone No.')
line(P, 'p37-bus-fax', 232, 503, 606, 'blank', 'phone', INV, 'Facsimile number (business address column)', False, 'Facsimile No')
line(P, 'p37-mail-fax', 627, 922, 606, 'blank', 'phone', INV, 'Facsimile number (mailing address column)', False, 'Facsimile No')
line(P, 'p37-shares', 368, 503, 646, 'blank', 'text', INV, 'Number of shares subscribed for', False, 'Number of Shares subscribed for')
PRICE = 'a price per share or unit fixed by the offering: may be completed by the company before sending'
line(P, 'p37-price-share', 637, 730, 647, 'blank', 'amount', INV, 'Price per share', False, 'Price Per Share', doubt=PRICE, owner_also_ok=[FIRM])
line(P, 'p37-warrants', 381, 500, 688, 'blank', 'text', INV, 'Number of warrants subscribed for', False, 'Number of Warrants subscribed for')
line(P, 'p37-units', 355, 500, 727, 'blank', 'text', INV, 'Number of units subscribed for', True, 'Number of Units subscribed for')
line(P, 'p37-price-unit', 632, 735, 727, 'blank', 'amount', INV, 'Price per unit', False, 'Price Per Unit', doubt=PRICE, owner_also_ok=[FIRM])
line(P, 'p37-amount', 373, 503, 767, 'blank', 'amount', INV, 'Aggregate subscription amount (after a dollar sign)', True, 'Aggregate Subscription Amount: $')
D.NOT[37] = ['"Price Per Warrant: $0.125" (already printed)', 'the wire-transfer paragraph', 'the page footer and document code']
D.SURE[37] = 'sure of every printed line; "Name of Investor" has no line (judgement: a place); price per share and per unit may be the company\'s'

# ---------- page 39-41: schedule A ----------
P = Pic(D, 39)
s39 = [((186, 268, 203, 284), 'A qualified institutional buyer', 'p39 A or B'), ((186, 308, 203, 324), 'A subscribing as fiduciary or agent for QIB accounts', 'p39 A or B'),
       ((217, 469, 234, 485), 'B.1 institutional accredited investor', 'p39 A or B'), ((217, 569, 234, 585), 'B.2 we are not a natural person', 'p39 A or B'),
       ((186, 730, 203, 746), 'institutional category: bank, broker-dealer, insurance or investment company, BDC or SBIC', 'p39 institutional accredited categories'),
       ((186, 790, 203, 806), 'institutional category: state plan over $5,000,000', 'p39 institutional accredited categories'),
       ((186, 870, 203, 886), 'institutional category: ERISA employee benefit plan', 'p39 institutional accredited categories'),
       ((186, 950, 203, 966), 'institutional category: 501(c)(3), corporation, business trust or partnership over $5,000,000', 'p39 institutional accredited categories'),
       ((186, 1030, 203, 1046), 'institutional category: trust over $5,000,000 directed by a sophisticated person', 'p39 institutional accredited categories'),
       ((186, 1091, 203, 1107), 'institutional category: entity whose equity owners are all accredited', 'p39 institutional accredited categories')]
for i, (b, l, g) in enumerate(s39):
    sq(P, 'p39-box-%02d' % (i + 1), b, 'Schedule A: ' + l, g)
D.NOT[39] = ['the text asks to mark AND initial the boxes, but no place for initials is printed', 'page footer']
D.SURE[39] = 'sure'
P = Pic(D, 41)
s41 = [((217, 187, 234, 203), 'C.1 I am an accredited investor', 'p41 C'), ((217, 267, 234, 283), 'C.2 I am a natural person', 'p41 C'),
       ((186, 427, 203, 443), 'natural person category: net worth over $1,000,000', 'p41 natural person categories'),
       ((186, 626, 203, 642), 'natural person category: income over $200,000 / $300,000', 'p41 natural person categories'),
       ((186, 767, 203, 783), 'D affiliate status: is', 'p41 D affiliate: one of two'), ((186, 807, 203, 823), 'D affiliate status: is not', 'p41 D affiliate: one of two')]
for i, (b, l, g) in enumerate(s41):
    sq(P, 'p41-box-%02d' % (i + 1), b, 'Schedule A: ' + l, g)
D.NOT[41] = ['the underline of "provided"', 'no initials place is printed', 'page footer']
D.SURE[41] = 'sure'

D.finish(dict(investor_pages=[37, 39, 41], firm_pages=[35], co_investor=False, third_parties=[],
              kind='A form of subscription agreement filed as page pictures: the company accepts on its own page (officer printed); the investor signs page 37 with registration, contact and amount details and ticks Schedule A. No joint investor block.'),
         how_measured='Each form page is a 1055 x 1365 px picture (140 ppi) drawn at x 40.1-584.3, y 53.5-757.5 pt; lines and squares located on the picture\'s pixels (plines.py, squares.py) and converted through the drawing matrix; every picture page looked at; overlays drawn and looked at.')
