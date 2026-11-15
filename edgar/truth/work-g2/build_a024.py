import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
S = Sheet('a024', T + '/set-a/a024/doc.pdf', T + '/truth/a024')
S.how = 'pdfplumber characters and thin filled rectangles; every page looked at at 100 dpi (pages 1-12 and 14-16 are prose); overlays looked at.'
for p in list(range(1, 13)) + [14, 15, 16, 17]:
    S.SURE[p] = 'sure (no place)'
S.NOT[1] = ['the stray underscore in the EX1A-4 header line']
S.NOT[3] = ['"[DATE]" of the offering circular (bracketed text the company completes)', 'underlined headings']
S.NOT[2] = ['page rules above and below the page number on every page (full width)', 'underlined section headings on pages 3-11']
S.run('p13-shares', 13, 0, 'blank', 'amount', INV, 'Number of securities subscribed for (caption "(print number of Securities)" under the blank)', True, printed_label='print number of Securities')
S.run('p13-price', 13, 1, 'blank', 'amount', INV, 'Aggregate purchase price in dollars (caption "(print aggregate purchase price)" under it)', True, printed_label='print aggregate purchase price')
S.run('p13-owner-name', 13, 2, 'blank', 'name', INV, 'Name in which the securities are recorded (caption under the line)', True, printed_label='print name of owner')
S.run('p13-signature', 13, 3, 'signature', 'signature', INV, 'Subscriber signature (caption under the line)', True, printed_label='Signature')
S.run('p13-name', 13, 4, 'blank', 'name', INV, 'Subscriber name, printed', True, printed_label='Name (Please Print)')
S.run('p13-email', 13, 5, 'blank', 'email', INV, 'Subscriber e-mail address', True, printed_label='Email address')
S.run('p13-address', 13, 6, 'blank', 'address', INV, 'Subscriber address, first line', True, printed_label='Address')
S.run('p13-address-2', 13, 7, 'blank', 'address', INV, 'Subscriber address, second line (no caption of its own, under "Address")', False)
S.run('p13-phone', 13, 8, 'blank', 'phone', INV, 'Telephone number', True, printed_label='Telephone Number')
S.run('p13-tin', 13, 9, 'blank', 'tax number', INV, 'Social security number or EIN', True, printed_label='Social Security Number/EIN')
S.run('p13-date', 13, 10, 'date', 'date', INV, 'Date (last line of the subscriber block, caption under it)', True, printed_label='Date')
S.run('p13-accept-date', 13, 11, 'blank', 'date', FIRM, 'Date the company accepts (month and day; the year 2021 is printed)', True, printed_label='This Subscription is accepted on')
S.run('p13-accept-signature', 13, 12, 'signature', 'signature', FIRM, 'Signature for the company (name and title printed under)', True, printed_label='By:')
S.NOT[13] = ['the printed officer name and title under "By:"', 'the "[shares of Common Stock" bracket (an unclosed bracket in the printed text, not a blank)', 'the page rule (y 736)']
S.SURE[13] = 'sure (captions print UNDER each line)'
S.signing = dict(investor_pages=[13], firm_pages=[13], co_investor=False, third_parties=[],
                 kind='One subscriber signs the signature page (page 13) and gives the details under it; the company accepts at its foot. Pages 14-16 are an accredited-investor appendix with no places.')
S.write('doc.pdf', 'PDF points, origin top-left, y grows downward. Underscore run: the character box.')
S.overlays()
print(S.counts())
