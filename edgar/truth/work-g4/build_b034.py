import sys; sys.path.insert(0, '.')
from wbsheet import *
W = WB('b034', '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b034/doc.pdf', 'wb-b034.json'); S = W.S
B = 'blank'
W.p('amount', 0, 2, B, 'amount', INV, 'Subscription amount', True, 'Subscription Amount $')
W.t('additional', 0, 3, INV, 'Additional investment', 'Additional Investment')
W.t('type-pop', 0, 5, INV, 'Investment type: public offering price', 'Public Offering Price', group='investment type')
W.t('type-net', 0, 4, INV, 'Investment type: net of up-front commission', 'Net of Up-Front Commission', group='investment type')
G = 'form of ownership (select only one option)'
for i, s, l, o in ((8, 'individual', 'Individual', INV), (9, 'individual-tod', 'Individual with transfer on death', INV), (14, 'jtwros', 'Joint tenants with right of survivorship', INV),
                   (15, 'jt-tod', 'Joint tenants with transfer on death', INV), (16, 'community', 'Community property', INV), (21, 'taxable-trust', 'Taxable trust', ENT), (22, 'exempt-trust', 'Tax-exempt trust', ENT),
                   (29, 'ugma', 'Uniform Gift to Minors Act', INV), (30, 'utma', 'Uniform Transfers to Minors Act', INV), (6, 'traditional', 'Traditional (qualified plan)', INV), (7, 'sep', 'SEP/IRA rollover', INV),
                   (10, 'ira', 'IRA', INV), (11, 'beneficial-ira', 'Beneficial IRA', INV), (12, 'roth', 'ROTH IRA', INV), (17, 'c-corp', 'C corporation', ENT), (18, 's-corp', 'S corporation', ENT),
                   (19, 'nonprofit', 'Non-profit organization', ENT), (20, 'partnership', 'Partnership', ENT), (23, 'pension', 'Pension plan', ENT), (24, 'profit-sharing', 'Profit sharing plan', ENT), (27, 'other', 'Other', ENT)):
    W.t('own-' + s, 0, i, o, 'Form of ownership: ' + l, l, group=G)
W.p('decedent', 0, 13, B, 'name', INV, 'Beneficial IRA: name of decedent', False, '**Name of Decedent')
W.p('trust-name', 0, 25, B, 'name', ENT, 'Name of trust', False, 'Name of Trust')
W.p('trust-tax-id', 0, 26, B, 'tax number', ENT, 'Trust tax ID number', False, 'Tax ID Number')
W.p('minor-state', 0, 32, B, 'text', INV, 'Minor account: state of', False, 'State of')
W.p('minor-dob', 0, 33, B, 'date', INV, "Minor's date of birth", False, "Minor's Date of Birth")
W.p('entity-name', 0, 28, B, 'name', ENT, 'Other account: entity name', False, 'Entity Name')
W.p('entity-tax-id', 0, 31, B, 'tax number', ENT, 'Other account: entity tax ID number', False, 'Tax ID Number')
for i, s, w, l in ((34, 'cust-name', 'name', 'Name'), (35, 'cust-tax-id', 'tax number', 'Tax ID number'), (36, 'cust-address', 'address', 'Address'), (37, 'cust-account', 'text', 'Custodian/brokerage account number'),
                   (38, 'cust-city', 'text', 'City'), (39, 'cust-state', 'text', 'State'), (40, 'cust-zip', 'text', 'Zip code')):
    W.p(s, 0, i, B, w, INV, 'Custodian information (if applicable): ' + l, False, l, 'custodian details given by the investor; the custodian may complete them' if s == 'cust-account' else None)
W.used.update({(0, 0), (0, 1)})
I1 = 1
for i, s, w, o, l, m in ((0, 'inv-name', 'name', INV, 'Investor/trustee name', True), (1, 'inv-ssn', 'tax number', INV, 'Investor social security or tax ID number', True), (2, 'inv-dob', 'date', INV, 'Investor date of birth', True),
                         (3, 'co-name', 'name', CO, 'Co-investor/trustee name (if applicable)', False), (4, 'co-ssn', 'tax number', CO, 'Co-investor social security or tax ID number', False),
                         (5, 'street', 'address', INV, 'Street address', True), (6, 'city', 'text', INV, 'City', True), (7, 'state', 'text', INV, 'State', True), (8, 'zip', 'text', INV, 'Zip code', True),
                         (9, 'day-phone', 'phone', INV, 'Daytime phone number', True), (10, 'eve-phone', 'phone', INV, 'Evening phone number', False), (11, 'mail-address', 'address', INV, 'Mailing address (optional)', False),
                         (12, 'mail-city', 'text', INV, 'Mailing city', False), (13, 'mail-state', 'text', INV, 'Mailing state', False), (14, 'mail-zip', 'text', INV, 'Mailing zip code', False), (15, 'country', 'text', INV, 'Country (citizenship outside the U.S.)', False)):
    W.p(s, I1, i, B, w, o, l, m, l.split(' (')[0])
for i, s, l in ((16, 'us', 'U.S. citizen'), (17, 'resident-alien', 'Resident alien'), (18, 'us-abroad', 'U.S. citizen residing outside the United States')):
    W.t('cit-' + s, I1, i, INV, 'Citizenship: ' + l, l, group='citizenship (select one)')
W.t('dist-drp', I1, 19, INV, 'Distribution reinvestment plan', 'Distribution Reinvestment Plan (DRP)', group='distributions')
for i, s, l in ((21, 'cash-custodian', 'Cash: mail a check to custodian'), (23, 'cash-investor', 'Cash: mail a check to investor/trustee'), (25, 'cash-brokerage', 'Cash: send a check to brokerage account or other'), (27, 'cash-electronic', 'Cash: electronically deposit')):
    W.t('dist-' + s, I1, i, INV, 'Distributions: ' + l, l, group='distributions')
for i, s, w, l in ((20, 'fi-name', 'name', 'Financial institution/third party'), (22, 'fbo', 'name', 'For the benefit of'), (24, 'fi-account', 'text', 'Account number'), (26, 'fi-address', 'address', 'Address'),
                   (28, 'fi-city', 'text', 'City'), (29, 'fi-state', 'text', 'State'), (30, 'fi-zip', 'text', 'Zip code'), (31, 'aba', 'text', 'ABA routing number (direct deposit via ACH only)'), (32, 'dd-account', 'text', 'Account number (direct deposit)')):
    W.p(s, I1, i, B, w, INV, 'Distribution account: ' + l, False, l.split(' (')[0])
for i, s, l in ((33, 'checking', 'Checking'), (34, 'savings', 'Savings'), (35, 'brokerage', 'Brokerage/other')):
    W.t('acct-' + s, I1, i, INV, 'Account kind: ' + l, l, group='account kind')
for k, L in enumerate('abcd'):
    W.p('init-%s-investor' % L, 2, 2 * k, 'initials', None, INV, 'Representation %s): investor initials' % L, L != 'd', 'Initials', None if L != 'd' else 'item d) applies only "if applicable"', group='representation ' + L)
    W.p('init-%s-co' % L, 2, 2 * k + 1, 'initials', None, CO, 'Representation %s): co-investor initials' % L, False, 'Initials', group='representation ' + L)
W.used.add((2, 8))
W.p('inv-signature', 2, 9, 'signature', None, INV, 'Signature of investor/trustee', True, 'Signature of Investor/Trustee')
W.p('inv-date', 2, 10, 'date', None, INV, 'Date beside the investor signature', True, 'Date')
W.p('co-signature', 2, 12, 'signature', None, CO, 'Signature of co-investor/trustee or custodian (custodians must sign on a custodial account)', False, 'Signature of Co-Investor/Trustee or Custodian', 'captioned co-investor OR trustee OR custodian')
W.p('co-date', 2, 11, 'date', None, CO, 'Date beside the second signature', False, 'Date')
for i, s, w, l in ((0, 'rep-bd', 'name', 'Broker-dealer or financial institution'), (1, 'rep-name', 'name', 'Name of investor representative'), (2, 'rep-number', 'text', 'Advisor number'), (3, 'rep-address', 'address', 'Mailing address'),
                   (4, 'rep-city', 'text', 'City'), (5, 'rep-state', 'text', 'State'), (6, 'rep-zip', 'text', 'Zip code'), (7, 'rep-phone', 'phone', 'Telephone'), (8, 'rep-fax', 'phone', 'Fax'), (9, 'rep-email', 'email', 'Email address')):
    W.p(s, 3, i, B, w, TP, 'Investor representative: ' + l, False, l)
W.p('rep-signature', 3, 11, 'signature', None, TP, 'Signature of investor representative', False, 'Signature of Investor Representative')
W.p('rep-date', 3, 10, 'date', None, TP, 'Date beside the representative signature', False, 'Date')
W.p('principal-signature', 3, 12, 'signature', None, TP, 'Signature of principal (if applicable)', False, 'Signature of Principal (if applicable)')
W.p('principal-date', 3, 13, 'date', None, TP, 'Date beside the principal signature', False, 'Date')
W.p('edel-inv-signature', 4, 0, 'signature', None, INV, 'Go paperless (optional): signature of investor/trustee', False, 'Signature of Investor/Trustee')
W.p('edel-inv-email', 4, 1, B, 'email', INV, 'Go paperless: investor email address', False, 'Email Address')
W.p('edel-co-signature', 4, 2, 'signature', None, CO, 'Go paperless: signature of co-investor/trustee (if applicable)', False, 'Signature of Co-Investor/Trustee (if applicable)')
W.p('edel-co-email', 4, 3, B, 'email', CO, 'Go paperless: co-investor email address', False, 'Email Address')
print('unused', W.unused())
for p in range(1, 14):
    if p not in (2, 5, 8, 11, 13): S.NOT[p] = ['browser-print page with no picture: header text or an empty page']
S.NOT[2] = ['two holes in the title lettering', 'grey section bands']
S.NOT[5] = ['grey section bands']
S.NOT[8] = ['the W-9 certification frame (a white text box, not a place)']
S.NOT[13] = ['printed wire and mailing details']
for p in (2, 5, 8, 11, 13): S.SURE[p] = 'sure (boxes measured from the picture pixels)'
signing = dict(investor_pages=[2, 5, 8, 13], firm_pages=[], co_investor=True, third_parties=['investor representative and principal (page 11)'],
               kind='Corporate Capital Trust II subscription agreement printed from a browser: five form pages, each one picture (white fill-in boxes on grey). Investor and co-investor initial four representations and sign page 3 of the form; the investor representative and principal sign page 4; optional e-delivery consent on page 5. No issuer acceptance block.',
               note='Each picture sits whole on one PDF page (pages 2, 5, 8, 11, 13); the PDF pages between them carry only print headers.')
S.write(signing, 'Picture pages: white boxes found as connected white regions in each embedded image at its own resolution (807-821 x 1042 px), edges refined to the white/grey transition, converted through each image\'s placement; every picture looked at; overlays looked at.')
