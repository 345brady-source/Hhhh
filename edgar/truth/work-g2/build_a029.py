import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
S = Sheet('a029', T + '/set-a/a029/doc.pdf', T + '/truth/a029')
S.how = 'pdfplumber characters and filled rectangles of the filed PDF; every page looked at at 100 dpi; overlays looked at.'
for p in range(1, 11): S.SURE[p] = 'sure (no place)'
S.NOT[1] = ['the title underline (y 117)']
S.NOT[2] = ['"February __, 2024", "August __, 2024", "October __, 2023" (twice): dates in the prose that the company completes (offering circular and termination dates)']
S.NOT[4] = ['"___________________." and "qualified by the SEC on ______________, 2023": the company\'s blanks for the offering circular link and qualification date', 'the yellow highlight of a paragraph (y 359-440): a drafting mark']
S.NOT[6] = ['the wire instructions block (highlighted yellow): ABA #, Account# and three bank lines are the company\'s own bank details to fill in, not the investor\'s']
S.NOT[10] = ['the Form 1-A signatures page of the offering statement: the company\'s officers, already signed /s/; "Date: September __, 2023" belongs to it; the rules under the /s/ names']
S.SURE[10] = 'sure (no place: the filing\'s own signatures, already made)'
S.run('p09-exec-day', 9, 0, 'blank', 'date', INV, 'Date of execution: day (witness clause)', True, printed_label='executed as of the ______ day')
S.run('p09-exec-month', 9, 1, 'blank', 'date', INV, 'Date of execution: month (the year 2023 is printed)', True, printed_label='day of _________')
for i, (k, kind, what, lab, pl) in enumerate([
        ('tokens', 'blank', 'amount', 'Number of tokens subscribed for', 'Number of Tokens Subscribed For:'),
        ('price', 'blank', 'amount', 'Total purchase price (a "$" prints at the start of the rule)', 'Total Purchase Price:'),
        ('signature', 'signature', 'signature', 'Investor signature', 'Signature of Investor:'),
        ('name', 'blank', 'name', 'Investor name', 'Name of Investor:'),
        ('address', 'blank', 'address', 'Investor address', 'Address of Investor:'),
        ('email', 'blank', 'email', 'Investor e-mail address', 'Electronic Mail Address:'),
        ('tin', 'blank', 'tax number', 'Investor social security or tax ID number', "Investor's SS# or Tax ID#:")]):
    S.rect_rule('p09-' + k, 9, i, kind, what, INV, lab + ' (caption left, rule in the right column)', True, printed_label=pl)
S.run('p09-accept-signature', 9, 2, 'signature', 'signature', FIRM, 'Signature of the company\'s authorized signatory (name printed on the next line)', True, printed_label='Signature of Authorized Signatory:')
S.run('p09-accept-date', 9, 3, 'blank', 'date', FIRM, 'Date of acceptance (the year 2023 is printed)', True, printed_label='Date of Acceptance:')
S.NOT[9] = ['"Name of Authorized Signatory: Turaj Belgameh, CEO" (printed)', 'the bracketed page caption']
S.SURE[9] = 'sure'
S.signing = dict(investor_pages=[9], firm_pages=[9], co_investor=False, third_parties=[],
                 kind='One investor completes and signs the signature page (page 9); the company accepts under it. Page 10 is the offering statement\'s own signatures page, already signed.')
S.notes = ['The underscore blanks on pages 2, 4 and 6 are the company\'s (offering dates, circular link, its own wire details highlighted yellow) and are left out.',
           'Page 10 belongs to the Form 1-A filing (officers\' /s/ signatures and a date blank), not to the investor.']
S.write('doc.pdf', 'PDF points, origin top-left, y grows downward. Underscore run: the character box. Drawn rule: x extent, y1 = bottom of the rule, y0 = y1 - 10.')
S.overlays()
print(S.counts())
