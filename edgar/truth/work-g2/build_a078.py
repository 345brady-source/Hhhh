import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from strokes import strokes, to_pt
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
W = os.path.dirname(os.path.abspath(__file__))
S = Sheet('a078', T + '/set-a/a078/doc.pdf', T + '/truth/a078')
S.how = ('Each page is one scanned picture (623 px wide, 96 ppi) with no text layer. The drawing matrix flips the stored picture vertically '
         '(page 1: 467.04 0 0 -482.88 72 696.96 cm; pages 2-4: 467.52 0 0 -604.8 72 720; pages 5-6: 467.28 0 0 -604.32 72 720), so the picture was flipped back and mapped '
         'as x = 72 + col * w/623, y = top + row * h/H (page 1 top 95.04, h 482.88, H 644; page 5 top 72, h 604.32, H 806). Rules found in the pixels (rows darker than 200, 12 px or longer); '
         'every page looked at at 100 and 130 dpi; overlays looked at.')
PL = {1: [72, 95.04, 539.04, 577.92], 5: [72, 72, 539.28, 676.32]}
G = {}
for p in PL:
    gs, shp = strokes('%s/a078/img/u-%d.png' % (W, p), 12, thr=200)
    G[p] = (gs, shp)
def find(page, y, x):
    gs, shp = G[page]
    c = [g for g in gs if abs(g['y0'] - y) <= 2 and g['x0'] - 3 <= x <= g['x1'] + 3]
    assert len(c) == 1, (page, y, x, c)
    return c[0], shp
def R(id, page, y, x, kind, what, owner, label, must=False, pl=None, **kw):
    g, shp = find(page, y, x); p = to_pt(g, PL[page], shp)
    return S.add(id, page, kind, what, owner, label, must, [p[0], p[3] - 10, p[2], p[3]],
                 'rule in the picture (px x %d-%d, y %d-%d of the upright picture); box = its x extent and the 10 pt above its bottom' % (g['x0'], g['x1'], g['y0'], g['y1']), printed_label=pl, **kw)
for p in range(1, 7): S.SURE[p] = 'sure (no place)'
R('p01-shares', 1, 109, 100, 'blank', 'amount', INV, 'Number of shares subscribed for (blank at the start of the boxed sentence)', True)
R('p01-total', 1, 129, 300, 'blank', 'amount', INV, 'Total subscription price in US$', True, pl='total subscription price of US$')
for k, (y, lab, pl, what, must) in enumerate([(224, 'Registration: name to appear on certificate', 'Name to appear on certificate', 'name', True),
                                               (259, 'Registration: account reference, if applicable', 'Account reference, if applicable', 'text', False),
                                               (294, 'Registration: address', 'Address', 'address', True),
                                               (329, 'Registration: address, second line (no caption)', None, 'address', False)]):
    R('p01-reg-%d' % (k + 1), 1, y, 150, 'blank', what, INV, lab + ' (caption under the rule)', must, pl=pl)
for k, (y, lab, pl, what) in enumerate([(224, 'Delivery: name and account reference, if applicable', 'Name and account reference, if applicable', 'name'),
                                         (259, 'Delivery: contact name', 'Contact name', 'name'), (294, 'Delivery: address', 'Address', 'address'),
                                         (329, 'Delivery: telephone number', 'Telephone number', 'phone')]):
    R('p01-del-%d' % (k + 1), 1, y, 400, 'blank', what, INV, lab + ' (caption under the rule)', False, pl=pl)
R('p01-exec-day', 1, 359, 245, 'blank', 'date', INV, 'Executed by the purchaser: day', True, pl='EXECUTED by the Purchaser this ___ day')
R('p01-exec-month', 1, 359, 330, 'blank', 'date', INV, 'Executed by the purchaser: month', True, pl='day of')
R('p01-exec-year', 1, 359, 395, 'blank', 'date', INV, 'Executed by the purchaser: last digits of the year (after "200")', True, pl='200__')
R('p01-ind-signature', 1, 389, 150, 'signature', 'signature', IND, 'Signature of individual, if the purchaser is a natural person (a printed "X" starts the line)', True,
  pl='Signature of individual (if Purchaser is a natural person)', condition='purchaser is a natural person')
R('p01-address', 1, 389, 400, 'blank', 'address', INV, 'Address of purchaser (residence if a natural person)', True, pl='Address of Purchaser (residence if a natural person)')
R('p01-ent-signature', 1, 435, 150, 'signature', 'signature', ENT, 'Authorized signatory, if the purchaser is not a natural person (a printed "X" starts the line)', True,
  pl='Authorized signatory (if Purchaser is not a natural person)', condition='purchaser is not a natural person')
R('p01-address-2', 1, 435, 400, 'blank', 'address', INV, 'Address of purchaser, second line (no caption)', False)
R('p01-name', 1, 482, 150, 'blank', 'name', INV, 'Name of purchaser, printed', True, pl='Name of Purchaser (please print)')
R('p01-phone', 1, 482, 400, 'blank', 'phone', INV, 'Telephone number of purchaser', True, pl='Telephone Number of Purchaser')
R('p01-ent-signer-name', 1, 517, 150, 'blank', 'name', ENT, 'Name of authorized signatory, printed', False, pl='Name of authorized signatory (please print)', condition='purchaser is not a natural person')
R('p01-email', 1, 517, 400, 'blank', 'email', INV, 'E-mail address of purchaser', False, pl='E-mail Address of Purchaser')
R('p01-accept-day', 1, 556, 165, 'blank', 'date', FIRM, 'Accepted: day', True, pl='ACCEPTED this ______ day')
R('p01-accept-month', 1, 556, 235, 'blank', 'date', FIRM, 'Accepted: month', True, pl='day of')
R('p01-accept-year', 1, 556, 285, 'blank', 'date', FIRM, 'Accepted: last digits of the year (after "200")', True, pl='200__')
R('p01-accept-signature', 1, 614, 150, 'signature', 'signature', FIRM, 'Company: authorized signatory (caption under the rule)', True, pl='Per: / Authorized signatory')
S.NOT[1] = ['the frames: the thick box around the share sentence (y about 154 and 200), the box of the registration/delivery instructions and the box of the signature block (their edges at y about 228, 352, 370, 493)',
            '"EXHIBIT 99.1" (a real text line above the picture)']
S.SURE[1] = 'sure (the two caption-less rules are read as second lines of the address above them)'
R('p05-amount', 5, 274, 220, 'blank', 'amount', INV, 'Risk acknowledgement: amount the purchaser is investing (after "$")', True, pl='I am investing $')
R('p05-date', 5, 364, 150, 'date', 'date', INV, 'Risk acknowledgement: date (caption under the rule, left of the signature)', True, pl='Date')
R('p05-signature', 5, 364, 400, 'signature', 'signature', INV, 'Risk acknowledgement: signature of purchaser', True, pl='Signature of Purchaser')
R('p05-name', 5, 403, 400, 'blank', 'name', INV, 'Risk acknowledgement: printed name of purchaser', True, pl='Print Name of Purchaser')
S.NOT[5] = ['the frame of the form (top y about 147, bottom y about 421) and the rotated word "WARNING" beside it (its letters show as short strokes)', 'the underlined e-mail address of the issuer in the cancellation notice (a link, printed)']
S.SURE[5] = 'sure'
S.NOT[4] = ['"Offering Memorandum of the Issuer dated ●" on page 2 and similar bullet placeholders: the issuer\'s, completed before sending']
S.signing = dict(investor_pages=[1, 5], firm_pages=[1], co_investor=False, third_parties=[],
                 kind='Scanned subscription form: the purchaser completes and signs page 1 (individual or authorized signatory line), the company accepts at its foot; the purchaser also signs the risk acknowledgement form on page 5.')
S.notes = ['No text layer: every box measured from the pictures\' pixels; the stored pictures are upside down and the page matrix flips them, which the mapping accounts for.',
           'Individual and entity signature lines are separate on page 1 (investor-individual / investor-entity).']
S.write('doc.pdf', 'PDF points, origin top-left, y grows downward. Rule in the picture: its x extent, y1 = bottom of the rule, y0 = y1 - 10.')
S.overlays()
print(S.counts())
