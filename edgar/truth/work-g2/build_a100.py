import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
S = Sheet('a100', T + '/set-a/a100/doc.pdf', T + '/truth/a100')
S.how = 'pdfplumber characters and thin filled rectangles; both pages looked at at 100 dpi; overlays looked at.'
S.NOT[1] = ['"120 days from ________, 201_" in the payment instructions: a date in the prose the company sets (the closing reference date), not a place for the subscriber',
            'heading underlines (A. Instructions, B. Communications, the underlined payee name) and the footer rule (y 664)', 'the stray underscore in the EX-3.3 header line']
S.SURE[1] = 'sure (no place for the subscriber; the one prose blank is the company\'s)'
S.run('p02-shares', 2, 2, 'blank', 'amount', INV, 'Total number of shares to be purchased', True, printed_label='Total Number of Shares to be Purchased:')
S.run('p02-amount', 2, 3, 'blank', 'amount', INV, 'Amount to be paid (at $0.05 per share)', True, printed_label='Amount to be Paid:')
S.run('p02-exec-day', 2, 4, 'blank', 'date', INV, 'Date of execution: day (in the witness clause)', True, printed_label='this ________ of')
S.run('p02-exec-month', 2, 5, 'blank', 'date', INV, 'Date of execution: month', True)
S.run('p02-exec-year', 2, 6, 'blank', 'date', INV, 'Date of execution: last digit of the year', True, printed_label='201_')
S.run('p02-name', 2, 7, 'blank', 'name', INV, 'Name as it should appear on the certificate', True, printed_label='NAME: (PRINT)')
S.run('p02-address', 2, 8, 'blank', 'address', INV, 'Address', True, printed_label='ADDRESS:')
for i, l in enumerate(['Joint Tenants with Right of Survivorship', 'Tenants in Common', 'Community Property']):
    S.glyph('p02-joint-%d' % (i + 1), 2, i, INV, 'If joint ownership: ' + l, printed_label=l, group='p2 if joint ownership, check one')
for i, l in enumerate(['Trust', 'Estate', 'Power of Attorney']):
    S.glyph('p02-fid-%d' % (i + 1), 2, 3 + i, INV, 'If fiduciary, business or organization: ' + l, printed_label=l, group='p2 if fiduciary or business, check one')
S.run('p02-org-name', 2, 9, 'blank', 'name', ENT, 'Name and type of business organization', False, printed_label='Name and Type of Business Organization:')
S.run('p02-id-other-type', 2, 10, 'blank', 'text', INV, 'Identification: the "Other" kind of document (blank after "Other", before "#")', False, printed_label='Other',
      doubt='may be read as the start of the ID number; the number itself is the next line')
S.run('p02-id-number', 2, 11, 'blank', 'tax number', INV, 'Identification number (social security, passport, licence, tax ID or other: the subscriber circles which)', True, printed_label='#')
S.run('p02-signature', 2, 12, 'signature', 'signature', INV, 'Subscriber signature', True, printed_label='SIGNATURE:')
S.run('p02-accept-day', 2, 13, 'blank', 'date', FIRM, 'Acceptance: day', True, printed_label='this _______ day of')
S.run('p02-accept-month', 2, 14, 'blank', 'date', FIRM, 'Acceptance: month', True)
S.run('p02-accept-year', 2, 15, 'blank', 'date', FIRM, 'Acceptance: last digit of the year', True, printed_label='201_')
S.run('p02-accept-signature', 2, 16, 'signature', 'signature', FIRM, 'Signature for the company (chief executive officer, name printed under)', True, printed_label='By:')
S.NOT[2] = ['"dated on or around _________________, 201_" in the opening sentence: the date of the prospectus, which the company completes, not the subscriber',
            '"(circle one) Social Security # - Passport # - Drivers\' License # - Tax ID #": printed words to circle, no box', 'heading underlines (y 74, 410, 494) and the footer rule (y 616)']
S.SURE[2] = 'sure; two judgements: the prospectus-date blank in the first sentence is the company\'s (not a place), and the "Other ____ #" blank is its own place'
S.signing = dict(investor_pages=[2], firm_pages=[2], co_investor=False, third_parties=[],
                 kind='The subscriber completes and signs the signature page (page 2); joint owners are told to sign "above" but only one signature line is printed; the company accepts at the foot of page 2.')
S.notes = ['Tick boxes are Wingdings boxes printed as "¨"; each gets the character box.',
           'No separate co-investor place: joint ownership is only a choice of three boxes, and only one signature line is printed.',
           'Prospectus-date blanks (page 1 closing reference, page 2 first sentence) are left out as the company\'s to complete.']
S.write('doc.pdf', 'PDF points, origin top-left, y grows downward. Underscore run: the character box. Box glyph: the character box.')
S.overlays()
print(S.counts())
