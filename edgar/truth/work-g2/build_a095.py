import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
S = Sheet('a095', T + '/set-a/a095/doc.pdf', T + '/truth/a095')
S.how = 'pdfplumber characters and thin filled rectangles (Chromium draws table borders as rectangles); both pages looked at at 100 dpi; overlays looked at.'
# page 1
S.run('p01-shares', 1, 2, 'blank', 'amount', INV, 'Number of shares subscribed for', True, printed_label='subscribes for ___ Shares')
S.run('p01-total', 1, 3, 'blank', 'amount', INV, 'Total subscription price in dollars', True, printed_label='Total subscription price')
S.rect_rule('p01-name', 1, 0, 'blank', 'name', INV, 'Investor name (caption above the rule)', True, printed_label='Name (type or print)')
S.rect_rule('p01-tin', 1, 1, 'blank', 'tax number', INV, 'Investor SSN / EIN / taxpayer ID (caption above the rule)', True, printed_label='SSN/EIN/Taxpayer I.D.')
S.rect_rule('p01-email', 1, 2, 'blank', 'email', INV, 'Investor e-mail address', False, printed_label='E-mail address:')
S.rect_rule('p01-address', 1, 3, 'blank', 'address', INV, 'Investor address', True, printed_label='Address:')
S.rect_rule('p01-joint-name', 1, 4, 'blank', 'name', CO, 'Joint investor name (caption above the rule)', False, printed_label='Joint Name (type or print)')
S.rect_rule('p01-joint-tin', 1, 5, 'blank', 'tax number', CO, 'Joint investor SSN / EIN / taxpayer ID', False, printed_label='SSN/EIN/Taxpayer I.D.')
S.rect_rule('p01-joint-email', 1, 6, 'blank', 'email', CO, 'Joint investor e-mail address', False, printed_label='E-mail address:')
S.rect_rule('p01-joint-address', 1, 7, 'blank', 'address', CO, 'Joint investor address', False, printed_label='Address:')
S.rect_rule('p01-mail-street', 1, 8, 'blank', 'address', INV, 'Mailing address if different: street (caption under the rule segment)', False, printed_label='Street')
S.rect_rule('p01-mail-city', 1, 9, 'blank', 'text', INV, 'Mailing address if different: city / state', False, printed_label='City/State')
S.rect_rule('p01-mail-zip', 1, 10, 'blank', 'text', INV, 'Mailing address if different: zip', False, printed_label='Zip')
S.rect_rule('p01-business-phone', 1, 11, 'blank', 'phone', INV, 'Business phone (area code goes between the printed brackets before the rule)', False, printed_label='Business Phone: ( )')
S.rect_rule('p01-home-phone', 1, 12, 'blank', 'phone', INV, 'Home phone (area code between the printed brackets)', False, printed_label='Home Phone: ( )')
G = 'p1 type of ownership (you must check one box)'
for i, (k, l) in enumerate([('individual', 'Individual'), ('custodian', 'Custodian for'), ('tic', 'Tenants in Common'), ('ugma', 'Uniform Gifts to Minors Act'),
                            ('jtwros', 'Joint Tenants with rights of Survivorship'), ('partnership', 'Partnership'), ('trust', 'Trust'),
                            ('community', 'Community Property'), ('other', 'Other (please explain)')]):
    S.glyph('p01-own-' + k, 1, i, INV, 'Type of ownership: ' + l, printed_label=l, group=G)
S.run('p01-custodian-for', 1, 4, 'blank', 'name', INV, 'Custodian for: whom', False, printed_label='Custodian for:')
S.run('p01-ugma-state', 1, 5, 'blank', 'text', INV, 'Uniform Gifts to Minors Act: which state', False, printed_label='of the State of:')
S.run('p01-own-other-text', 1, 6, 'blank', 'text', INV, 'Other type of ownership, explained', False, printed_label='Other (please explain):')
S.NOT[1] = ['the title and section-heading underlines (y 64, 100, 196, 460, 640)', 'the "Corporation (Inc., LLC, LP) Please List all officers..." lines: no box and no blank is printed for them',
            'browser header and footer (date, file name, URL, page n/2), and the stray underscore in the browser header and in the EX-99.2 line']
S.SURE[1] = 'sure (the corporation choice has no printed box, so it gets none)'
# page 2
S.rect_rule('p02-signature', 2, 0, 'signature', 'signature', INV, 'Signature of buyer (caption "Signature of Buyer" above, 35 pt of room down to the rule)', True, printed_label='Signature of Buyer',
            doubt='caption side: the captions "Printed Name" and "Date:" print just UNDER the two rules; read here as captions above their rules (signature caption, room, rule; name caption, rule; date caption with no rule)')
S.rect_rule('p02-printed-name', 2, 1, 'blank', 'name', INV, 'Printed name of buyer', True, printed_label='Printed Name', doubt='could be read as the rule above the caption (y 406.5) instead; see p02-signature')
S.add('p02-date', 2, 'date', 'date', INV, 'Date beside the buyer signature (caption with a colon, no rule printed)', True, [58.0, 444.4, 279.0, 454.4],
      'no printed line: the room right of the caption "Date:" to the end of the column (x 279)', printed_label='Date:', doubt='no printed line; box is the room beside the caption')
S.run('p02-accept-day', 2, 1, 'blank', 'date', FIRM, 'Acceptance date: day', True, printed_label='Accepted this ___ day')
S.run('p02-accept-month', 2, 2, 'blank', 'date', FIRM, 'Acceptance date: month', True, printed_label='day of ________')
S.run('p02-accept-year', 2, 3, 'blank', 'date', FIRM, 'Acceptance date: last digit of the year', True, printed_label='201_')
S.rect_rule('p02-accept-signature', 2, [2, 3], 'signature', 'signature', FIRM, 'Signature accepting for the company (rule under "Accepted by:")', True, printed_label='Accepted by:')
S.rect_rule('p02-accept-title', 2, 4, 'blank', 'title', FIRM, 'Title of the person accepting for the company', True, printed_label='Title:')
S.NOT[2] = ['section-heading underlines (y 154, 274)', 'the company name and delivery address (printed)', 'browser header and footer']
S.SURE[2] = 'sure of every place; which side of the two left rules each caption belongs to is a judgement (see doubt)'
S.signing = dict(investor_pages=[2], firm_pages=[2], co_investor=True, third_parties=[],
                 kind='The buyer completes page 1 and signs on page 2; a joint buyer gives name, tax ID, e-mail and address on page 1 but has no signature line; the company accepts on page 2.')
S.notes = ['Tick boxes are Wingdings boxes that printed as "¨" (no Wingdings font in the print); each gets the character box.',
           'Page 2 left column: three captions and two rules; read as caption above rule. The date has no printed line.',
           'The joint buyer has no printed signature place.']
S.write('doc.pdf', 'PDF points, origin top-left, y grows downward. Underscore run: the character box. Drawn rule: x extent, y1 = bottom of the rule, y0 = y1 - 10. Box glyph: the character box.')
S.overlays()
print(S.counts())
