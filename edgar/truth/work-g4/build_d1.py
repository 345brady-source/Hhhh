import json, sys
sys.path.insert(0, '.')
from sheet import *
B = json.load(open('d1-boxes.json'))
PDF = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/d1/doc.pdf'
S = Sheet('d1', PDF, 15, [792, 612])
IMG = {0: (2, 2049, 2651), 2: (5, 1700, 2200), 4: (8, 1700, 2200), 6: (11, 1700, 2200), 8: (14, 1700, 2200)}
CLIP0, CLIP1 = 27.75, 583.75
def place(img, i, slug, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
    pg, W, H = IMG[img]
    b = B[str(img)][i]
    circle = b['fill'] < 0.85
    if circle:
        x0, y0, x1, y1 = b['raw'][0] - 1, b['raw'][1] - 1, b['raw'][2] + 1, b['raw'][3] + 1
        how = 'white disc of a printed round radio button (picture pixels %d-%d x %d-%d)' % (x0, x1, y0, y1)
    else:
        x0, y0, x1, y1 = b['x0'], b['y0'], b['x1'], b['y1']
        brd = max(b['border'].values())
        how = ('white box with a drawn %d px edge' % brd if brd else 'white box on grey, no drawn edge') + ' (picture pixels %d-%d x %d-%d)' % (x0, x1, y0, y1)
    sx, sy = 540.0 / W, 698.25 / H
    X0, X1 = 33.75 + x0 * sx, 33.75 + x1 * sx
    for k, top in ((0, 27.75), (1, -528.75)):
        Y0, Y1 = top + y0 * sy, top + y1 * sy
        if Y1 <= CLIP0 or Y0 >= CLIP1: continue
        d = doubt
        if Y0 < CLIP0 or Y1 > CLIP1:
            Y0, Y1 = max(Y0, CLIP0), min(Y1, CLIP1); d = 'split by page break' + ('; ' + doubt if doubt else '')
        S.add('p%02d-%s' % (pg + k, slug), pg + k, kind, what, owner, label, must, [X0, Y0, X1, Y1], how, plabel, d, **kw)

# ---- image X8: pages 2-3 (Sections 1 and 2, custodian information)
for i, s, l, pl in ((0, 'share-aa1', 'Share selection: AA1', 'AA1'), (1, 'share-aa1-nav', 'Share selection: AA1 (NAV), RIA/fee-based accounts', 'AA1(NAV)'), (2, 'share-mm1', 'Share selection: MM1', 'MM1')):
    place(0, i, s, 'tickbox', None, INV, l, False, pl, group='share selection (choose one)')
place(0, 3, 'shares', 'blank', 'amount', INV, 'Number of shares purchased', True, 'Number of shares purchased:')
place(0, 5, 'price', 'blank', 'amount', INV, 'Purchase price per unit (after a $ sign)', True, 'Purchase price per unit:')
place(0, 6, 'aggregate', 'blank', 'amount', INV, 'Aggregate purchase price (after a $ sign)', True, 'Aggregate purchase price:',
      doubt='the box shows a printed "0" left by the web form\'s calculation; not a real entry, so still a place')
place(0, 4, 'additional', 'tickbox', None, INV, 'Check here if this is an additional purchase', False, 'Check here if additional purchase')
place(0, 7, 'account', 'blank', 'text', INV, 'Account number (if applicable)', False, 'Account #:')
G = 'account type (check one box only)'
for i, s, l in ((9, 'acct-individual', 'Individual'), (10, 'acct-jtwros', 'Joint tenants WROS'), (11, 'acct-tic', 'Tenants in common'), (13, 'acct-community', 'Community property'),
                (14, 'acct-trust', 'Trust'), (15, 'acct-estate', 'Estate'), (18, 'acct-custodial', 'Custodial'), (21, 'acct-corp', 'Corporation'), (22, 'acct-ccorp', 'C Corp'), (23, 'acct-scorp', 'S Corp'),
                (24, 'acct-llc', 'LLC'), (25, 'acct-partnership', 'Partnership'), (26, 'acct-nonprofit', 'Non-profit organization'), (27, 'acct-profit-sharing', 'Profit sharing plan'),
                (28, 'acct-defined-benefit', 'Defined benefit plan'), (29, 'acct-keogh', 'KEOGH plan'), (30, 'acct-trad-ira', 'Traditional IRA'), (31, 'acct-sep-ira', 'SEP IRA'), (32, 'acct-roth-ira', 'ROTH IRA'),
                (34, 'acct-simple-ira', 'Simple IRA'), (35, 'acct-inherited-ira', 'Inherited/beneficial IRA'), (37, 'acct-other', 'Other (specify)')):
    place(0, i, s, 'tickbox', None, INV, 'Account type: ' + l + ' (round radio button)', False, l, group=G)
place(0, 8, 'tod-individual', 'tickbox', None, INV, 'TOD (transfer on death), individual account row', False, 'TOD')
place(0, 12, 'tod-joint', 'tickbox', None, INV, 'TOD (transfer on death), joint account row', False, 'TOD')
place(0, 19, 'ugma', 'tickbox', None, INV, 'Custodial: UGMA', False, 'UGMA')
place(0, 16, 'ugma-state', 'blank', 'text', INV, 'UGMA: state of', False, 'UGMA: State of')
place(0, 20, 'utma', 'tickbox', None, INV, 'Custodial: UTMA', False, 'UTMA')
place(0, 17, 'utma-state', 'blank', 'text', INV, 'UTMA: state of', False, 'UTMA: State of')
place(0, 33, 'decedent-name', 'blank', 'name', INV, "Inherited IRA: decedent's name (right column)", False, "For Inherited IRA indicate Decedent's name:")
place(0, 36, 'acct-other-specify', 'blank', 'text', INV, 'Other account type, specify', False, 'Other (Specify)')
for i, s, w, l, pl in ((38, 'cust-tax-id', 'tax number', 'Custodian tax ID', 'Custodian Tax ID#:'), (39, 'cust-name', 'name', 'Name of custodian', 'Name of Custodian:'),
                       (41, 'cust-account', 'text', 'Custodian account number', 'Custodian Account#:'), (40, 'cust-address', 'address', 'Custodian mailing address', 'Mailing Address:'),
                       (42, 'cust-phone', 'phone', 'Custodian phone', 'Custodian Phone#:'), (43, 'cust-city-state-zip', 'address', 'Custodian city, state, ZIP', 'City, State, ZIP:')):
    place(0, i, s, 'blank', w, TP, l + ' (custodian information, "to be completed by custodian")', False, pl)

# ---- image X16: pages 5-6 (Section 3)
rows = [('first-name', 'name', 'First name', 'First Name:', True), ('middle-name', 'name', 'Middle name', 'Middle Name:', False), ('last-name', 'name', 'Last name', 'Last Name:', True),
        ('tax-id', 'tax number', 'Tax ID or SSN', 'Tax ID or SS#:', True), ('street', 'address', 'Street address', 'Street Address:', True), ('city', 'text', 'City', 'City:', True),
        ('state', 'text', 'State', 'State:', True), ('zip', 'text', 'ZIP', 'ZIP:', True), ('phone', 'phone', 'Daytime phone', 'Daytime Phone#', True), ('email', 'email', 'Email address', 'Email address:', False)]
for j, (s, w, l, pl, m) in enumerate(rows):
    place(2, 2 * j, 'inv-' + s, 'blank', w, INV, 'A. Investor/trustee: ' + l, m, pl)
    place(2, 2 * j + 1, 'co-' + s, 'blank', w, CO, 'B. Co-investor/co-trustee: ' + l, False, pl)
for k, part in enumerate(('month', 'day', 'year')):
    place(2, 20 + k, 'inv-dob-' + part, 'blank', 'date', INV, 'A. Investor: date of birth, %s (three boxes split by slashes)' % part, True, 'Date of Birth:', group='investor date of birth')
    place(2, 23 + k, 'co-dob-' + part, 'blank', 'date', CO, 'B. Co-investor: date of birth, %s' % part, False, 'Date of Birth:', group='co-investor date of birth')
place(2, 26, 'inv-employer', 'blank', 'name', INV, 'A. Investor: employer', False, 'Employer:')
place(2, 27, 'co-employer', 'blank', 'name', CO, 'B. Co-investor: employer', False, 'Employer:')
RD = 'a small white box after "Retired:"; a tick box (could be read as a short blank)'
place(2, 28, 'inv-retired', 'tickbox', None, INV, 'A. Investor: retired', False, 'Retired:', doubt=RD)
place(2, 29, 'co-retired', 'tickbox', None, CO, 'B. Co-investor: retired', False, 'Retired:', doubt=RD)
place(2, 30, 'inv-citizenship', 'blank', 'text', INV, 'A. Investor: if non-US citizen, country of citizenship', False, 'If Non-U.S. Citizen, specify Country of Citizenship:')
place(2, 31, 'co-citizenship', 'blank', 'text', CO, 'B. Co-investor: if non-US citizen, country of citizenship', False, 'If Non-U.S. Citizen, specify Country of Citizenship:')
place(2, 32, 'entity-name', 'blank', 'name', ENT, 'C. Trust/corporation/partnership: entity name or title of trust', False, 'Entity Name/ Title of Trust')
for k, part in enumerate(('month', 'day', 'year')):
    place(2, 33 + k, 'trust-date-' + part, 'blank', 'date', ENT, 'C. Date of trust, %s' % part, False, 'Date of Trust:', group='date of trust')
place(2, 36, 'entity-tax-id', 'blank', 'tax number', ENT, 'C. Entity tax ID', False, 'Tax ID #:')
for i, s, l, pl in ((37, 'pob-city', 'Place of birth: city', 'City:'), (38, 'pob-state', 'Place of birth: state/province', 'State/Province:'), (39, 'pob-country', 'Place of birth: country', 'Country:')):
    place(2, i, s, 'blank', 'text', INV, 'D. Government ID (foreign citizens only): ' + l, False, pl)
for i, s, l in ((40, 'id-drivers-license', "U.S. driver's license"), (41, 'id-green-card', 'INS permanent resident alien card'), (42, 'id-foreign-national', 'Foreign national identity documents'),
                (43, 'id-employment-auth', 'Employee authorization document'), (44, 'id-passport-no-visa', 'Passport without U.S. visa'), (45, 'id-passport-visa', 'Passport with U.S. visa')):
    place(2, i, s, 'tickbox', None, INV, 'D. Immigration status: ' + l + ' (round radio button)', False, l, group='immigration status')
for i, s, w, l, pl in ((47, 'id-bank-name', 'name', 'Bank name', 'Bank Name:'), (48, 'id-bank-account', 'text', 'Account number', 'Account#:'), (46, 'id-bank-address', 'address', 'Bank address', 'Bank Address:'),
                       (49, 'id-bank-phone', 'phone', 'Bank phone', 'Bank Phone#:'), (50, 'id-doc-number', 'text', 'Number for the document checked above', 'Number for the document checked above:'),
                       (51, 'id-doc-country', 'text', 'Country of issuance', 'Country of Issuance:')):
    place(2, i, s, 'blank', w, INV, 'D. Government ID: ' + l, False, pl)

# ---- image X23: pages 8-9 (Section 4)
G4 = 'distributions (select only one)'
place(4, 0, 'dist-drip', 'tickbox', None, INV, 'Distributions: dividend reinvestment plan (round radio button)', False, 'Dividend Reinvestment Plan', group=G4)
place(4, 1, 'dist-mail-check', 'tickbox', None, INV, 'Distributions: mail check to the address of record', False, 'Mail Check', group=G4)
place(4, 2, 'dist-ach', 'tickbox', None, INV, 'Distributions: direct via ACH deposit', False, 'Direct via ACH Deposit', group=G4)
place(4, 3, 'dist-mail-firm', 'tickbox', None, INV, 'Distributions: mail check to clearing firm/financial institution listed below', False, 'Mail Check', group=G4)
for i, s, w, l, pl in ((4, 'bank-name', 'name', 'Name / entity name / financial institution', 'Name/Entity Name/ Financial Institution:'), (5, 'bank-address', 'address', 'Mailing address', 'Mailing Address:'),
                       (6, 'bank-city', 'text', 'City', 'City:'), (7, 'bank-state', 'text', 'State', 'State:'), (9, 'bank-zip', 'text', 'ZIP', 'ZIP:'), (8, 'bank-phone', 'phone', 'Phone', 'Phone #:')):
    place(4, i, s, 'blank', w, INV, 'Distribution account: ' + l, False, pl)
place(4, 13, 'acct-checking', 'tickbox', None, INV, 'Your account: checking (round radio button)', False, 'Checking Account', group='account kind')
place(4, 12, 'acct-savings', 'tickbox', None, INV, 'Your account: savings', False, 'Savings Account', group='account kind')
place(4, 15, 'acct-brokerage', 'tickbox', None, INV, 'Your account: brokerage', False, 'Brokerage Account', group='account kind')
place(4, 10, 'acct-number', 'blank', 'text', INV, 'Your account number (row of checking/savings)', False, 'Your Account#:')
place(4, 14, 'acct-brokerage-number', 'blank', 'text', INV, 'Brokerage account number', False)
place(4, 11, 'aba', 'blank', 'text', INV, 'ABA/routing number', False, 'ABA/Routing#:')
place(4, 16, 'dist-owner-signature', 'signature', None, INV, 'Owner signature (distribution authorization)', False, 'Owner Signature', doubt='needed only when distributions go to a bank account')
place(4, 17, 'dist-coowner-signature', 'signature', None, CO, 'Co-owner signature (if applicable)', False, 'Co-Owner Signature')
for k, part in enumerate(('month', 'day', 'year')):
    place(4, 18 + k, 'dist-owner-date-' + part, 'date', None, INV, 'Date beside the owner signature, %s (three boxes)' % part, False, 'Date:', group='owner date (distributions)')
    place(4, 21 + k, 'dist-coowner-date-' + part, 'date', None, CO, 'Date beside the co-owner signature, %s' % part, False, 'Date:', group='co-owner date (distributions)')

# ---- image X30: pages 11-12 (Section 5)
place(6, 0, 'owner-signature', 'signature', None, INV, 'Section 5: owner signature', True, 'Owner Signature')
place(6, 1, 'coowner-signature', 'signature', None, CO, 'Section 5: co-owner signature (if applicable)', False, 'Co-Owner Signature')
for k, part in enumerate(('month', 'day', 'year')):
    place(6, 2 + k, 'owner-date-' + part, 'date', None, INV, 'Date beside the owner signature, %s (three boxes)' % part, True, 'Date:', group='owner date')
    place(6, 5 + k, 'coowner-date-' + part, 'date', None, CO, 'Date beside the co-owner signature, %s' % part, False, 'Date:', group='co-owner date')
place(6, 8, 'custodian-signature', 'signature', None, TP, 'Authorized signature of custodian or trustee (if applicable; current custodian must sign for an IRA)', False, 'Authorized Signature (Custodian or Trustee)',
      doubt='captioned for a custodian or a trustee; a trustee may be the investor')
for k, part in enumerate(('month', 'day', 'year')):
    place(6, 9 + k, 'custodian-date-' + part, 'date', None, TP, 'Date beside the custodian/trustee signature, %s' % part, False, 'Date:', group='custodian date')

# ---- image X37: pages 14-15 (Section 6)
for i, s, w, l, pl in ((0, 'fa-bd-ria', 'name', 'Broker dealer/RIA', 'Broker Dealer/RIA:'), (1, 'fa-name', 'name', 'Financial advisor name', 'Financial Advisor Name:'),
                       (2, 'fa-address', 'address', 'Mailing address', 'Mailing Address:'), (3, 'fa-city', 'text', 'City', 'City:'), (4, 'fa-state', 'text', 'State', 'State:'), (5, 'fa-zip', 'text', 'Zip', 'Zip:'),
                       (6, 'fa-email', 'email', 'Email address', 'Email Address:'), (7, 'fa-phone', 'phone', 'Business phone', 'Business Phone#'), (8, 'fa-fax', 'phone', 'Fax', 'Fax#:'),
                       (9, 'fa-bd-crd', 'text', 'Broker-dealer CRD number', 'Broker-Dealer CRD#:'), (10, 'fa-advisor-number', 'text', 'Advisor number', 'Advisor#:'), (11, 'fa-crd', 'text', 'Financial advisor CRD', 'Financial Advisor CRD:')):
    place(8, i, s, 'blank', w, TP, 'Section 6 financial advisor: ' + l, False, pl)
place(8, 12, 'fa-ria-submission', 'tickbox', None, TP, 'AA1 (NAV), MM1 only: RIA submission (the advisor checks it)', False, 'RIA Submission')
place(8, 13, 'fa-signature', 'signature', None, TP, 'Financial advisor signature', False, 'Financial Advisor Signature:')
place(8, 14, 'bm-signature', 'signature', None, TP, 'Branch manager and/or RIA signature', False, 'Branch Manager and /or RIA Signature:')
for k, part in enumerate(('month', 'day', 'year')):
    place(8, 15 + k, 'fa-date-' + part, 'date', None, TP, 'Date beside the financial advisor signature, %s' % part, False, 'Date:', group='advisor date')
    place(8, 18 + k, 'bm-date-' + part, 'date', None, TP, 'Date beside the branch manager signature, %s' % part, False, 'Date:', group='branch manager date')

for p in (1, 4, 7, 10, 13): S.NOT[p] = ['browser-print header only ("Exhibit 4.1"); no place']
S.NOT[2] = ['the five letters O in the printed footer line are white specks, not boxes', 'the dark title bars and column heading bars', 'table rules of the account-type grid', 'the "ADDITIONAL REQUIRED DOCUMENTATION" column text']
S.NOT[3] = ['the help bar and the footer line', 'the printed letters O in the footer']
S.NOT[5] = ['the thin vertical rule between columns A and B', 'the horizontal rule under place of birth']
S.NOT[6] = ['grey panel, help bar and footer only']
S.NOT[8] = ['the sample voided check picture: its white face, its printed rules (Date, Pay to the order of, $, memo) and the red outlined routing/account/check number boxes are an illustration, not places', 'the horizontal section rules']
S.NOT[9] = ['the lower half of the sample check picture and its red callouts', 'help bar and footer']
S.NOT[11] = ['the outlined W-9 certification box (text frame)', 'items (a) to (g) have no box to tick']
S.NOT[12] = ['legal text, help bar and footer']
S.NOT[14] = ['nothing else']
S.NOT[15] = ['Section 7 payment instructions: printed bank details already filled in, including "[Investor Name]" in the wire reference (an instruction, not a blank)']
for p in (2, 5, 8, 11, 14): S.SURE[p] = 'sure (boxes measured from the picture pixels)'
S.SURE[3] = 'sure'
S.SURE[2] = 'sure of every place; the aggregate price box shows a printed 0 (kept as a place, marked)'
S.SURE[5] = 'sure; the two "Retired" boxes are read as tick boxes (marked)'
S.SURE[11] = 'sure; whose the custodian-or-trustee signature is, is a judgement (third party, marked)'
S.SURE[8] = 'sure; the sample check is not a place'
signing = dict(investor_pages=[2, 3, 5, 8, 11], firm_pages=[], co_investor=True,
               third_parties=['custodian (custodian information, page 3; authorized signature, page 11)', 'financial advisor and branch manager/RIA (Section 6, page 14)'],
               kind='Subscription agreement form (5 form pages, each a picture split over two landscape PDF pages). The investor and a co-owner complete and sign Section 5; Section 4 has its own owner/co-owner signatures for bank distributions; a custodian or trustee signs where applicable; the financial advisor and branch manager sign Section 6. No issuer acceptance block.',
               note='Each form page is one JPEG drawn across two PDF pages: the first shows picture rows down to y 583.75 pt, the second the rest (from y 27.75 pt). No place is cut by a page break. Dates are printed as three boxes (month / day / year), each a place.')
S.write(signing, 'Picture pages: white boxes found as connected white regions in each embedded JPEG at its own resolution (2049x2651 px for page 1 of the form, 1700x2200 px for the others), edges refined to the white/grey transition and over any drawn edge; converted to PDF points through the image drawing matrix read from each page (image drawn at x 33.75-573.75 pt, 698.25 pt tall; page clip y 27.75-583.75). Every picture looked at in full; overlays at 100 dpi looked at.')
