import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
S = Sheet('a060', T + '/set-a/a060/doc.pdf', T + '/truth/a060')
SX = 487.5 / 935; SY = 630.75 / 1210
S.how = ('Browser print (landscape) of an HTML exhibit made of seven scanned page pictures (935 x 1210 px). Each picture is drawn twice, split over two PDF pages: '
         'page CTM .24 0 0 -.24 0 612 and picture cm 2031.25 0 0 -2628.1248 628.125 2743.7498 (first page) or ... 424.99976 (second page), clipped to y 27.75-583.75. '
         'So x = 150.75 + col * 487.5/935 and y = 27.75 + row * 630.75/1210 on the first page (top -528.75 on the second); the page break falls at picture row 1066.6. '
         'Rules found in the picture pixels (rows darker than 170, runs with gaps of 4 px or less, 30 px or longer; handwriting crossing a rule checked row by row); '
         'all seven pictures looked at at full resolution; overlays looked at.')
def rule(id, page, top, c0, c1, row, kind, what, owner, label, must, pl=None, **kw):
    x0 = 150.75 + c0 * SX; x1 = 150.75 + (c1 + 1) * SX; y1 = top + (row + 1) * SY
    return S.add(id, page, kind, what, owner, label, must, [x0, y1 - 10, x1, y1],
                 'rule in picture 7 (px x %d-%d, row %d); box = its x extent and the 10 pt above its bottom' % (c0, c1, row), printed_label=pl, doubt='executed copy', **kw)
for p in range(1, 22): S.SURE[p] = 'sure (no place)'
P7 = 20; TOP = 27.75
rule('p20-signature', P7, TOP, 397, 601, 290, 'signature', 'signature', INV, 'Subscriber signature (already signed by hand on this copy)', True, pl='By:')
rule('p20-address-1', P7, TOP, 400, 601, 367, 'blank', 'address', INV, 'Subscriber address, first line (handwritten on this copy)', True, pl='Address:')
rule('p20-address-2', P7, TOP, 400, 601, 388, 'blank', 'address', INV, 'Subscriber address, second line', False)
rule('p20-email', P7, TOP, 400, 600, 431, 'blank', 'email', INV, 'Subscriber e-mail address (handwritten on this copy)', False, pl='Email address:')
rule('p20-accept-signature', P7, TOP, 426, 727, 669, 'signature', 'signature', FIRM, 'Signature for the company under "ACCEPTANCE" (already signed)', True, pl='By:')
S.NOT[20] = ['the typed "Dated:" date and the typed subscriber name beside "Name:" (twice): filled in before execution, no blank printed',
             'the typed acceptance date, officer name and title: filled in', 'the underlines of the labels "Name:", "By:", "Address:", "Email address:" and of "ACCEPTANCE": underlined words',
             'the handwriting and signatures themselves (personal data; not copied)']
S.SURE[20] = 'sure of the five printed rules; every other entry on the page was typed before signing'
S.NOT[2] = ['the double rule around the agreement title (picture 1)', 'the subscriber name, share count and price typed into the first paragraph: filled in, no blank']
S.NOT[11] = ['footnote rules on pictures 4 and 5 (pages 11 and 14)']
S.NOT[1] = ['page 1 holds only the EDGAR header line; pages 4, 7, 10, 13, 16 and 19 are blank leftovers of the split pictures']
S.signing = dict(investor_pages=[20], firm_pages=[20], co_investor=False, third_parties=[],
                 kind='Executed scanned copy of a single-subscriber agreement: name, amount and dates were typed in before signing; the subscriber signed and wrote address and e-mail on the last picture, and the company signed its acceptance under it (page 20).')
S.notes = ['Executed copy: every place carries doubt "executed copy"; no handwritten content is copied into this sheet.',
           'The pictures are split across PDF page pairs; no place falls on a page break (the signature picture\'s places are all above picture row 730, the break is at row 1066.6).']
S.write('doc.pdf', 'PDF points, origin top-left, y grows downward (landscape page 792 x 612). Rule in the picture: its x extent, y1 = bottom of the rule, y0 = y1 - 10.')
# redact the handwriting (address, e-mail) from the overlay picture, leaving the printed rules visible
S.overlays(redact=[(20, [356.0, 202.0, 485.0, 218.4]), (20, [356.0, 222.0, 485.0, 229.4]), (20, [356.0, 241.0, 500.0, 251.4])])
print(S.counts())
