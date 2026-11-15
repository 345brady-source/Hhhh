import sys; sys.path.insert(0, '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import *

D = Doc('a054')
for p in range(1, 17):
    D.SURE[p] = 'sure (no place: agreement text)'
    D.NOT[p] = ['short rules under defined terms and headings in the running text (underlined words)', 'the full-width rule at the end of the printed page (a page-break rule from the web page)']
D.NOT[1].append('the underscore in the filing header line ("v434504_ex4-1.htm", y 35): part of a file name')

# ---------- page 17: the company ----------
r = [x for x in D.dark_rects(17) if x['w'] < 300][0]
D.rect_rule('p17-firm-signature', 17, r, 'signature', 'signature', FIRM, 'Company signature (By:), above the printed name and title of its officer', False, 'By')
D.NOT[17] = ['the officer\'s name and title, already printed under the rule', 'the full-width page-break rule (y 370.5)']
D.SURE[17] = 'sure'

# ---------- page 18: the holder ----------
D.run('p18-inv-signature', 18, 0, 'signature', 'signature', INV, 'Holder signature (By:, the line is on the line below the caption)', True, 'By')
NOLINE = 'no line printed: the box is the empty room after the caption, as wide as the signature line'
D.space('p18-inv-name', 18, 422.4, 166.92, 583.7, 176.91, 'name', INV, 'Holder: name of the signer (caption only)', True, 'Name', doubt=NOLINE)
D.space('p18-inv-title', 18, 417.1, 178.92, 583.7, 188.91, 'title', INV, 'Holder: title of the signer (caption only; for a holder that is an entity)', False, 'Title', doubt=NOLINE)
D.run('p18-notice-line1', 18, 1, 'blank', 'address', INV, 'Address for notice of the authorised signatory: first line (no caption of its own; under the heading)', False, 'Address for Notice of Authorized Signatory')
D.run('p18-notice-street', 18, 2, 'blank', 'address', INV, 'Address for notice: street', False, 'Street')
D.run('p18-notice-city', 18, 3, 'blank', 'address', INV, 'Address for notice: city, state and zip', False, 'City/State/Zip')
D.run('p18-notice-attention', 18, 4, 'blank', 'name', INV, 'Address for notice: attention (person to address)', False, 'Attention')
D.run('p18-notice-phone', 18, 5, 'blank', 'phone', INV, 'Telephone number', False, 'Telephone No.')
D.run('p18-notice-fax', 18, 6, 'blank', 'phone', INV, 'Facsimile number', False, 'Facsimile No.')
D.run('p18-notice-email', 18, 7, 'blank', 'email', INV, 'Email address', False, 'E-mail Address')
D.NOT[18] = ['the headings "HOLDER:" and "Address for Notice of Authorized Signatory:"', 'the footer "[Signature Page to Registration Rights Agreement]"']
D.SURE[18] = 'sure of the places; name and title have a caption and no line (boxes are the empty room after the caption)'
D.SURE[19] = 'sure (blank page: only the page-break rule)'
D.NOT[19] = ['the full-width rule at the top (page-break rule)']

D.finish(dict(investor_pages=[18], firm_pages=[17], co_investor=False, third_parties=[],
              kind='Not a subscription form but the registration rights agreement filed with it: the company signs its own page (officer name and title already printed); each holder signs its own page and gives a notice address. Nothing to tick or initial.'))
