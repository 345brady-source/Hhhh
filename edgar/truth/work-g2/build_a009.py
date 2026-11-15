import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from strokes import strokes, to_pt
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
W = os.path.dirname(os.path.abspath(__file__))
S = Sheet('a009', T + '/set-a/a009/doc.pdf', T + '/truth/a009')
S.how = ('Each page is one scanned picture (1284 x 1662 px, 151 ppi) drawn over the whole page (0,0)-(612.2,792.5); an OCR text layer lies over it. '
         'Rules were found in the picture\'s own pixels (rows of dark pixels, 40 px or longer) and converted to points through the drawing matrix (x * 612.238/1284, y * 792.477/1662); '
         'caption words checked against both the pixels and the OCR words; every page looked at; overlays looked at.')
PLACE = [0, 0, 612.238, 792.477]
for p in range(1, 16): S.SURE[p] = 'sure (no place)'
def rules(page):
    gs, shp = strokes('%s/a009/img/i-%03d.png' % (W, page - 11), 40)
    return [(g, to_pt(g, PLACE, shp), shp) for g in gs]
def R(id, page, i, kind, what, owner, label, must=False, room=10, pl=None, **kw):
    g, p, shp = RR[page][i]
    return S.add(id, page, kind, what, owner, label, must, [p[0], p[3] - room, p[2], p[3]],
                 'rule in the picture (px x %d-%d, y %d-%d); box = the rule\'s x extent and the %d pt above its bottom' % (g['x0'], g['x1'], g['y0'], g['y1'], room), printed_label=pl, **kw)
RR = {11: rules(11), 12: rules(12)}
# page 11 strokes: 0 thick bar, 1 (a), 2 (b), 3 (c)(i), 4 (c)(ii), 5 (d)
R('p11-shares', 11, 1, 'blank', 'amount', INV, '(a) Number of common shares subscribed for (caption "(print number of Securities)" under it)', True, pl='print number of Securities')
R('p11-price', 11, 2, 'blank', 'amount', INV, '(b) Aggregate purchase price (a "$" prints one line above the rule)', True, pl='print aggregate purchase price')
R('p11-accredited-para', 11, 3, 'blank', 'text', INV, '(c)(i) Accredited investor: the applicable paragraph number(s) from Appendix A', False, pl='print applicable number from Appendix A',
  group='p11 (c): either (i) or (ii)')
R('p11-not-over-10pct', 11, 4, 'blank', 'text', INV, '(c)(ii) Mark that the purchase is within 10% of net worth or income (a rule beside the statement, no caption)', False,
  group='p11 (c): either (i) or (ii)', doubt='no caption says what goes on this rule; read as the place to mark (or initial) that (ii) applies')
R('p11-owner-name', 11, 5, 'blank', 'name', INV, '(d) Name of the owner or joint owners for the company\'s books (caption under the rule)', True, pl='print name of owner or joint owners')
S.NOT[3] = ['underlined headings found as short strokes on pages 3-9 (e.g. "1. Subscription.", "(d) No filings."): underlined words, not blanks', '"[DATE]" in (d) on page 3: bracketed text the company completes']
S.NOT[11] = ['the thick bar under the page number (y 105-109, the scan\'s page rule)']
S.SURE[11] = 'sure of the places; the rule beside (c)(ii) has no caption (doubt on what is written there)'
L = [('signature', 'signature', 'signature', 'Signature', True), ('name', 'blank', 'name', 'Name (Please Print)', True), ('email', 'blank', 'email', 'Email address', True),
     ('address', 'blank', 'address', 'Address', True), ('address-2', 'blank', 'address', None, False), ('phone', 'blank', 'phone', 'Telephone Number', True),
     ('tin', 'blank', 'tax number', 'Social Security Number/EIN', True), ('date', 'date', 'date', 'Date', True)]
# page 12 strokes: 0 bar, 1 joint box top, then pairs (left,right) 2..17, 18 joint box bottom, 19 accept date, 20 By
for k, (key, kind, what, cap, must) in enumerate(L):
    lab = cap or 'second address line (no caption)'
    R('p12-' + key, 12, 2 + 2 * k, kind, what, INV, 'Subscriber: ' + lab + ' (caption under the rule)', must, pl=cap)
    R('p12-joint-' + key, 12, 3 + 2 * k, kind, what, CO, 'Joint subscriber: ' + lab + (' (printed "Social Security Number")' if key == 'tin' else '') + ' (inside the joint box)', False,
      pl=('Social Security Number' if key == 'tin' else cap))
R('p12-accept-date', 12, 19, 'blank', 'date', FIRM, 'Date the company accepts (year 2016 printed)', True, pl='This Subscription is accepted on')
R('p12-accept-signature', 12, 20, 'signature', 'signature', FIRM, 'Signature for the company', True, pl='By:')
S.add('p12-accept-name', 12, 'blank', 'name', FIRM, 'Name of the person signing for the company (no rule printed)', True, [374.9, 465.8, 540.2, 476.2],
      'no printed line: the room right of "Name:" (OCR word and pixels agree) to the end of the By rule', printed_label='Name:', doubt='no printed line; box is the room beside the caption')
S.add('p12-accept-title', 12, 'blank', 'title', FIRM, 'Title of the person signing for the company (no rule printed)', True, [369.7, 491.1, 540.2, 501.5],
      'no printed line: the room right of "Title:" to the end of the By rule', printed_label='Title:', doubt='no printed line; box is the room beside the caption')
S.NOT[12] = ['the frame of the joint-subscriber box (top y 137, bottom y 359, and its sides)', 'the thick bar under the page number', 'the row of five asterisks']
S.SURE[12] = 'sure of the 16 subscriber rules and the acceptance date and signature; the company\'s name and title have no printed line (doubt)'
S.signing = dict(investor_pages=[12], firm_pages=[12], co_investor=True, third_parties=[],
                 kind='Scanned signature pages: the subscriber gives the amounts on page 11 and signs on page 12; a framed joint-subscriber column beside it ("both Subscribers must sign"); the company accepts at the foot of page 12.')
S.notes = ['Scanned pictures with an OCR text layer: every box comes from the picture\'s pixels, not from the OCR words.',
           'The rule beside (c)(ii) on page 11 has no caption; kept as the place to mark (ii).',
           'The company\'s "Name:" and "Title:" under "By:" have no printed line; kept as places beside the captions (doubt).']
S.write('doc.pdf', 'PDF points, origin top-left, y grows downward (page 612.2 x 792.5). Rule in the picture: its x extent, y1 = bottom of the rule, y0 = y1 - 10.')
S.overlays()
print(S.counts())
