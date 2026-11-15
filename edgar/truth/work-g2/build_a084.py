import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
S = Sheet('a084', T + '/set-a/a084/doc.pdf', T + '/truth/a084')
S.how = 'pdfplumber characters and thin filled rectangles; the HTML source read where a rule\'s purpose was unclear; every page looked at at 100 dpi; overlays looked at.'
for p in range(1, 12): S.SURE[p] = 'sure (no place)'
S.run('p01-shares', 1, 0, 'blank', 'amount', INV, 'Number of common shares subscribed for', True)
S.run('p01-price-per-share', 1, 1, 'blank', 'amount', INV, 'Price per share in US$ (4 underscores after "US$")', False, printed_label='at a price of US$',
      doubt='a form: the company may set the price before sending; kept as a place since nothing marks it as the company\'s')
S.run('p01-total', 1, 2, 'blank', 'amount', INV, 'Total purchase price in US$', True, printed_label='total purchase price of US$')
S.NOT[1] = ['the double rule under the browser header line (y 60) and the page-end frames on every page (white box with a black outline, about y 520-570)', 'underlined headings']
S.SURE[1] = 'sure (one judgement: the price-per-share blank is kept as the subscriber\'s)'
S.rect_rule('p07-delivery-1', 7, 0, 'blank', 'address', INV, 'Delivery of share certificates to: first line', False, printed_label='Delivery - please deliver the Share certificates to:')
S.rect_rule('p07-delivery-2', 7, 1, 'blank', 'address', INV, 'Delivery of share certificates to: second line', False)
S.rect_rule('p07-reg-name', 7, 2, 'blank', 'name', INV, 'Registration of certificates: name (caption under the rule)', True, printed_label='(name)')
S.rect_rule('p07-reg-address', 7, 3, 'blank', 'address', INV, 'Registration of certificates: address (caption under the rule)', True, printed_label='(address)')
S.rect_rule('p07-name', 7, 4, 'blank', 'name', INV, 'Name of subscriber, typed or printed (caption under the rule)', True, printed_label='(Name of Subscriber - Please type or print)')
S.rect_rule('p07-signature', 7, 5, 'signature', 'signature', INV, 'Subscriber signature and, if applicable, office', True, printed_label='(Signature and, if applicable, Office)')
S.NOT[7] = ['the underline of the heading "DELIVERY AND REGISTRATION INSTRUCTIONS" (y 294)', 'underlined section headings 15-17']
S.SURE[7] = 'sure'
S.rect_rule('p08-address', 8, 0, 'blank', 'address', INV, 'Address of subscriber', True, printed_label='(Address of Subscriber)')
S.rect_rule('p08-city', 8, 1, 'blank', 'address', INV, 'City, state and zip code of subscriber', True, printed_label='(City, State, and Zip Code of Subscriber)')
S.rect_rule('p08-fax', 8, 3, 'blank', 'phone', INV, 'Fax number', False, printed_label='(Fax Number)')
S.NOT[8] = ['the country rule (y 143): already filled in with "United States of America"']
S.SURE[8] = 'sure'
S.run('p09-accept-place', 9, 0, 'blank', 'text', FIRM, 'Acceptance: place where dated', True, printed_label='DATED at')
S.run('p09-accept-day', 9, 1, 'blank', 'date', FIRM, 'Acceptance: day', True, printed_label='the _____ day')
S.run('p09-accept-month', 9, 2, 'blank', 'date', FIRM, 'Acceptance: month (year 2006 printed)', True, printed_label='day of')
S.run('p09-accept-signature', 9, 3, 'signature', 'signature', FIRM, 'Company: authorized signatory', True, printed_label='Per: / Authorized Signatory')
S.SURE[9] = 'sure'
for i in range(4):
    S.run('p10-cat-%d' % (i + 1), 10, i, 'initials', 'initials', INV, 'Accredited investor category %d: initial if it applies' % (i + 1), False, printed_label='Category %d' % (i + 1),
          group='questionnaire: initial the categories that apply')
S.NOT[10] = ['the heading underline (y 68)']
S.SURE[10] = 'sure'
for i in range(4):
    S.run('p11-cat-%d' % (i + 5), 11, i, 'initials', 'initials', INV, 'Accredited investor category %d: initial if it applies' % (i + 5), False, printed_label='Category %d' % (i + 5),
          group='questionnaire: initial the categories that apply')
S.run('p11-q-day', 11, 4, 'blank', 'date', INV, 'Questionnaire executed: day', True, printed_label='as of the ___ day')
S.run('p11-q-month', 11, 5, 'blank', 'date', INV, 'Questionnaire executed: month (year 2006 printed)', True, printed_label='day of')
E = dict(condition='subscriber is a corporation, partnership or other entity')
I = dict(condition='subscriber is an individual')
S.rect_rule('p11-ent-name', 11, 4, 'blank', 'name', ENT, 'Entity: name of entity, typed or printed', True, printed_label='Print of Type Name of Entity', **E)
S.rect_rule('p11-ent-signature', 11, 6, 'signature', 'signature', ENT, 'Entity: signature of authorized signatory', True, printed_label='Signature of Authorized Signatory', **E)
S.rect_rule('p11-ent-type', 11, 8, 'blank', 'text', ENT, 'Entity: type of entity', True, printed_label='Type of Entity', **E)
S.rect_rule('p11-ind-signature', 11, 5, 'signature', 'signature', IND, 'Individual: signature', True, printed_label='Signature', **I)
S.rect_rule('p11-ind-name', 11, 7, 'blank', 'name', IND, 'Individual: name, printed or typed', True, printed_label='Print or Type Name', **I)
S.rect_rule('p11-ind-tin', 11, 9, 'blank', 'tax number', IND, 'Individual: social security / tax ID number', True, printed_label='Social Security/Tax I.D. No.', **I)
S.NOT[11] = ['the full-width rule under the request for equity owners\' details (y 268): an <hr> separator in the source, no room to write (the details go on a separate sheet)']
S.SURE[11] = 'sure'
S.signing = dict(investor_pages=[7, 11], firm_pages=[9], co_investor=False, third_parties=[],
                 kind='The subscriber signs the agreement (page 7) with its details running onto page 8, the company accepts on page 9, and the subscriber initials the accredited categories and signs the questionnaire (pages 10-11) in an entity block or an individual block.')
S.notes = ['Questionnaire signature blocks are separate for an entity and an individual (page 11): owners investor-entity / investor-individual.',
           'The country line on page 8 is already filled in ("United States of America"): not a place.',
           'Price per share on page 1 kept as the subscriber\'s place (doubt).']
S.write('doc.pdf', 'PDF points, origin top-left, y grows downward. Underscore run: the character box. Drawn rule: x extent, y1 = bottom of the rule, y0 = y1 - 10.')
S.overlays()
print(S.counts())
