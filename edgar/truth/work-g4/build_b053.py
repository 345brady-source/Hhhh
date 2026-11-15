import sys, json; sys.path.insert(0, '.')
from sheet import *
from snap import snap
import pdfplumber
PDF = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b053/doc.pdf'
S = Sheet('b053', PDF, 18, [612, 792])
D = json.load(open('ink-b053.json'))
IMG = [(2, 1700, 2200), (5, 1700, 2200), (8, 1700, 2200), (11, 1700, 2200), (14, 1700, 2200), (17, 1700, 2200)]
X0, Y0, X1, Y1 = 32.17, 36.58, 584.25, 750.98
CLIP1 = 735.75
def put(id, n, b, kind, what, owner, label, must=False, plabel=None, doubt=None, how='', **kw):
    pg = IMG[n][0]; sx = (X1 - X0) / 1700; sy = (Y1 - Y0) / 2200
    bb = [X0 + b[0] * sx, Y0 + b[1] * sy, X0 + b[2] * sx, Y0 + b[3] * sy]
    if bb[1] >= CLIP1: raise ValueError('below clip %s' % id)
    if bb[3] > CLIP1: bb[3] = CLIP1; doubt = 'cut by the page clip' + ('; ' + doubt if doubt else '')
    return S.add('p%02d-%s' % (pg, id), pg, kind, what, owner, label, must, bb, how + ' (picture im-%03d pixels x %d-%d, y %d-%d)' % (n, b[0], b[2], b[1], b[3]), plabel, doubt, **kw)
def sq(id, n, i, owner, label, plabel=None, doubt=None, **kw):
    return put(id, n, D['im-%03d.png' % n]['squares'][i], 'tickbox', None, owner, label, False, plabel, doubt, 'square printed in the picture', **kw)
def sn(id, n, full, owner, label, plabel=None, doubt=None, kind='tickbox', what=None, must=False, **kw):
    b = full
    return put(id, n, b, kind, what, owner, label, must, plabel, doubt, 'printed box in the picture (edges measured as ink rows/columns)', **kw)
def cell(id, n, i, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
    return put(id, n, D['im-%03d.png' % n]['cells'][i], kind, what, owner, label, must, plabel, doubt, 'cell drawn in the picture (four rules)', **kw)
def rule(id, n, i, kind, what, owner, label, must=False, plabel=None, doubt=None, x0=None, **kw):
    r = D['im-%03d.png' % n]['rules'][i]; h = 10 / ((Y1 - Y0) / 2200)
    b = [x0 if x0 is not None else r[0], r[3] - h, r[2], r[3]]
    return put(id, n, b, kind, what, owner, label, must, plabel, doubt, 'rule printed in the picture; box = 10 pt above it', **kw)
B = 'blank'
# ---- page 2 (form page 1)
sq('inv-initial', 0, 10, INV, 'Investment type: initial investment', 'Initial Investment', group='investment type (select one)')
sq('inv-additional', 0, 14, INV, 'Investment type: additional purchase', 'Additional Purchase', group='investment type (select one)')
for i, s, l in ((11, 'brokerage', 'Brokerage account'), (15, 'ria', 'Registered investment adviser (unaffiliated)'), (12, 'advisory', 'Advisory account'), (16, 'other', 'Other (discuss with your B/D)')):
    sq('acct-' + s, 0, i, INV, 'Account type: ' + l, l, group='account type (select one)')
S.NOT[2] = ['"Prospectus dated (insert date)": the issuer completes it', '"FBO: Investor Name: ____" in the wire instructions: a reference to write on the wire, not a place on the form', 'letters O read as squares in the headings']
# ---- page 5 (form page 2)
sn('class-a', 1, [296, 165, 317, 188], INV, 'Your investment: share class A', 'SHARE CLASS A', group='share class')
sn('class-c', 1, [475, 165, 496, 188], INV, 'Your investment: share class C', 'SHARE CLASS C', group='share class')
sq('class-i', 1, 9, INV, 'Your investment: share class I', 'SHARE CLASS I', group='share class')
rule('amount', 1, 0, B, 'amount', INV, 'Total purchase amount (after "$")', True, '$ ___ total purchase amount')
for i, s, l in ((14, 'enclosed', 'Funds enclosed'), (11, 'wired', 'Funds wired'), (13, 'custodian', 'Issued by custodian'), (12, 'transfer', 'Asset transfer')):
    sq('pay-' + s, 1, i, INV, 'Method of payment: ' + l, l, group='method of payment')
sq('waiver-ria', 1, 17, INV, 'Waiver: registered investment advisors (RIA), waiver of commission only', 'Registered Investment Advisors (RIA)')
sq('waiver-ria-affiliated', 1, 18, INV, 'RIA waiver: RIA affiliated with a broker-dealer', 'If an RIA has introduced a sale and the RIA is affiliated', group='RIA (check one)')
sq('waiver-ria-unaffiliated', 1, 19, INV, 'RIA waiver: RIA not affiliated with a broker-dealer', 'If an RIA has introduced a sale and the RIA is not affiliated', group='RIA (check one)')
sq('waiver-rr', 1, 20, INV, 'Registered representative: waiver or reduction of commission', 'Registered Representative')
sq('waiver-dm', 1, 21, INV, 'Waiver of commission and dealer manager fee', 'Waiver of Commission and Dealer Manager Fee')
rule('relative', 1, 4, B, 'text', INV, 'Family member: relationship and name of relative', False, 'indicate relationship and name of relative:')
for i, s in ((24, 'mr'), (25, 'mrs'), (26, 'ms'), (27, 'other')): sq('title-' + s, 1, i, INV, 'Title: ' + s.capitalize(), s.capitalize(), group='title')
rule('title-other-which', 1, 7, B, 'text', INV, 'Title: other, which', False, 'Other')
C1 = [('name', 'name', INV, 'Name of investor, trustee or authorized signer (required)', True), ('joint-name', 'name', CO, 'Name of joint investor', False), ('entity-name', 'name', ENT, 'Name of trust, business or plan', False),
      ('street', 'address', INV, 'Street address (no P.O. box, required)', True), ('city', 'text', INV, 'City', True), ('state', 'text', INV, 'State', True), ('zip', 'text', INV, 'Zip code', True),
      ('home-phone', 'phone', INV, 'Home phone (required)', True), ('business-phone', 'phone', INV, 'Business phone', False), ('phone-ext', 'text', INV, 'Phone extension', False),
      ('alt-address', 'address', INV, 'Alternate mailing address or P.O. box', False), ('alt-city', 'text', INV, 'City (alternate)', False), ('alt-state', 'text', INV, 'State (alternate)', False), ('alt-zip', 'text', INV, 'Zip code (alternate)', False),
      ('dob', 'date', INV, 'Investor date of birth (or trust/entity date) (required)', True), ('joint-dob', 'date', CO, 'Joint investor / authorized signer date of birth', False), ('entity-tax-id', 'tax number', ENT, 'Entity tax ID # (if applicable)', False),
      ('ssn', 'tax number', INV, 'Investor SSN (required)', True), ('joint-ssn', 'tax number', CO, 'Joint investor / authorized signer SSN', False), ('email', 'email', INV, 'Email address', False)]
for i, (s, w, o, l, m) in enumerate(C1): cell(s, 1, i, B, w, o, l, m, l.split(' (')[0])
sq('cit-us', 1, 46, INV, 'Citizenship: U.S. citizen', 'U.S. Citizen', group='citizenship (required)')
sq('cit-resident', 1, 47, INV, 'Citizenship: resident alien', 'Resident Alien', group='citizenship (required)')
sq('cit-nonresident', 1, 48, INV, 'Citizenship: non-resident alien', 'Non-Resident Alien', group='citizenship (required)')
rule('country', 1, 9, B, 'text', INV, 'Non-resident alien: country of origin', False, 'Country of Origin')
sq('gov-id', 1, 49, INV, 'Please attach acceptable government-issued ID (a box before the instruction)', 'Please attach acceptable form of Government Issued ID', 'a box printed before an instruction; read as a tick box confirming the ID is attached')
S.NOT[5] = ['underlined words (check one, only if, and, indicate)', 'letters O and D read as squares', 'the section rule under the waiver block']
# ---- page 8 (form page 3)
cell('edelivery-initials', 2, 0, 'initials', None, INV, 'Electronic delivery consent: a box left of the paragraph (initial to consent)', False, None, 'an uncaptioned box beside the consent paragraph; read as an initials box')
r = D['im-002.png']['rules'][1]
put('edelivery-email', 2, [720, r[3] - 31, r[2], r[3]], B, 'email', INV, 'Electronic delivery: e-mail address (after the caption, on the section rule)', False, 'E-mail address:', 'the only rule after the caption is the full-width section rule', 'rule printed in the picture; box = 10 pt above it')
OWN = [((12,), 'individual', 'Individual', INV), ((16,), 'jtwros', 'Joint tenants with right of survivorship', INV), ((18,), 'tic', 'Tenants in common', INV), ((19,), 'community', 'Community property', INV),
       ((13,), 'pension', 'Pension, profit sharing plan or 401K', ENT), ((15,), 'trust', 'Trust', ENT), ((14,), 'ugma', 'Uniform Gift / Transfers to Minors Act', INV), ((17,), 'partnership', 'Partnership or LLC', ENT), ((20,), 'other', 'Other', INV)]
for (i,), s, l, o in OWN: sq('own-' + s, 2, i, o, 'Non-custodial ownership: ' + l, l, group='form of ownership')
sn('own-corporation', 2, [902, 513, 922, 532], ENT, 'Non-custodial ownership: corporation', 'Corporation', group='form of ownership')
sn('own-s-corp', 2, [930, 595, 951, 613], ENT, 'Corporation: S-Corp', 'S-Corp', group='corporation type')
sn('own-c-corp', 2, [930, 618, 951, 636], ENT, 'Corporation: C-Corp', 'C-Corp', group='corporation type')
sn('own-trust-revocable', 2, [499, 607, 519, 624], ENT, 'Trust: currently revocable', 'Currently Revocable', group='trust type')
sn('own-trust-irrevocable', 2, [499, 632, 519, 651], ENT, 'Trust: irrevocable', 'Irrevocable', group='trust type')
rule('own-other-specify', 2, 2, B, 'text', INV, 'Other ownership: specify', False, 'Other: (Specify)')
sq('cust-ira', 2, 22, INV, 'Custodial ownership: IRA', 'IRA', group='form of ownership')
rule('cust-ira-type', 2, 3, B, 'text', INV, 'IRA: type', False, '(Type)')
sq('cust-qualified', 2, 21, INV, 'Custodial ownership: qualified pension or profit sharing plan', 'Qualified Pension or Profit Sharing Plan', group='form of ownership')
sq('cust-nonqualified', 2, 23, INV, 'Custodial ownership: non-qualified custodian account', 'Non-Qualified Custodian Account', group='form of ownership')
sq('cust-other', 2, 24, INV, 'Custodial ownership: other', 'Other', group='form of ownership')
rule('cust-other-specify', 2, 4, B, 'text', INV, 'Custodial other: which', False, 'Other')
sn('cust-inherited', 2, [1114, 772, 1131, 786], INV, 'Inherited/beneficiary IRA', 'Inherited/Beneficiary IRA')
for i, s, w, o, l in ((1, 'cust-name', 'name', INV, 'Name of custodian or trustee'), (2, 'cust-deceased', 'name', INV, "Inherited IRA: deceased's name (required)"), (3, 'cust-address', 'address', INV, 'Custodian mailing address'),
                      (4, 'cust-city', 'text', INV, 'Custodian city'), (5, 'cust-state', 'text', INV, 'Custodian state'), (6, 'cust-zip', 'text', INV, 'Custodian zip code'), (7, 'cust-phone', 'phone', INV, 'Custodian business phone'),
                      (8, 'cust-tax-id', 'tax number', TP, 'Custodian tax ID'), (9, 'cust-account', 'text', TP, 'Custodian account #'), (10, 'cust-admin-name', 'name', TP, 'Name of custodian or other administrator')):
    cell(s, 2, i, B, w, o, l, False, l.split(' (')[0])
cell('cust-medallion', 2, 11, 'signature', None, TP, 'Custodian medallion signature guarantee (stamp box)', False, 'Custodian Medallion Signature Guarantee', 'a stamp place of the custodian')
cell('cust-signature', 2, 12, 'signature', None, TP, 'Signature of custodian (if applicable)', False, 'SIGNATURE OF CUSTODIAN (IF APPLICABLE)')
cell('cust-date', 2, 13, 'date', None, TP, 'Date beside the custodian signature (required)', False, 'DATE (REQUIRED)')
for i, s in ((31, 'checking'), (32, 'savings'), (33, 'brokerage')): sq('dd-' + s, 2, i, INV, 'Distribution account: ' + s, s.capitalize(), group='account kind')
sn('dist-ach', 2, [230, 1552, 251, 1575], INV, 'Cash distributions: via direct deposit (ACH)', 'Via Direct Deposit (ACH)', group='cash distributions (check one)')
sn('dist-ach-checking', 2, [280, 1582, 301, 1605], INV, 'Direct deposit: checking (enclose voided check)', 'Checking', group='ACH account')
sn('dist-ach-savings', 2, [280, 1614, 301, 1637], INV, 'Direct deposit: savings', 'Savings', group='ACH account')
sq('dist-alt-address', 2, 45, INV, 'Cash distributions: mail to alternate address (specify below)', 'Mail to Alternate Address', group='cash distributions (check one)')
sq('dist-street', 2, 46, INV, 'Cash distributions: mail to street address', 'Mail to Street Address', group='cash distributions (check one)')
for i, s, w, l in ((15, 'bank-name', 'name', 'Name of bank, brokerage firm or individual'), (16, 'bank-alt-address', 'address', 'Alternate address (optional)'), (17, 'bank-city', 'text', 'City'), (18, 'bank-state', 'text', 'State'),
                   (19, 'bank-zip', 'text', 'Zip code'), (20, 'bank-aba', 'text', 'Bank ABA# (for ACH only)'), (21, 'bank-account', 'text', 'Account #')):
    cell(s, 2, i, B, w, INV, 'Cash distributions directed to: ' + l, False, l)
S.NOT[8] = ['the sample check picture (a cell drawn around it, an illustration)', 'letters O and D read as squares', 'underlined ACH heading']
S.SURE[8] = 'sure; the bottom row (ABA/account) may be cut near the page clip (check)'
# ---- page 11 (form page 4)
for i, s, k, o, l, m in ((0, 'inv-signature', 'signature', INV, 'Signature of investor, trustee or authorized signer (required)', True), (1, 'inv-date', 'date', INV, 'Date (required)', True),
                         (2, 'joint-signature', 'signature', CO, 'Signature of joint investor, trustee, authorized signer or beneficial owner (required)', False), (3, 'joint-date', 'date', CO, 'Date beside the joint signature (required)', False),
                         (4, 'accept-signature', 'signature', FIRM, 'Subscription accepted: Oxford Park Income Fund signature', False), (5, 'accept-date', 'date', FIRM, 'Acceptance date', False),
                         (6, 'accept-name', B, FIRM, 'Acceptance: name', False), (7, 'accept-title', B, FIRM, 'Acceptance: title', False)):
    cell(s, 3, i, k, ('name' if 'name' in s else 'title') if k == B else None, o, l, m, l.split(' (')[0])
S.NOT[11] = ['certification prose', 'letters read as squares']
# ---- page 14 (form page 5)
C4 = [('bd-name', 'name', 'Broker-dealer or RIA firm name (required)'), ('bd-crd', 'text', 'CRD #'), ('bd-address', 'address', 'Broker-dealer or RIA firm address or P.O. box'), ('bd-city', 'text', 'City'),
      ('bd-state', 'text', 'State'), ('bd-zip', 'text', 'Zip code'), ('bd-phone', 'phone', 'Business phone (required)'), ('bd-fax', 'phone', 'Fax #'), ('rr-name', 'name', 'Registered representative(s) or advisor(s) name(s) (required)'),
      ('rr-number', 'text', 'Representative # / advisor # / team ID'), ('rr-address', 'address', 'Representative address or P.O. box'), ('rr-branch', 'text', 'Branch ID #'), ('rr-city', 'text', 'City'),
      ('rr-state', 'text', 'State'), ('rr-zip', 'text', 'Zip code'), ('rr-phone', 'phone', 'Business phone (required)'), ('rr-fax', 'phone', 'Fax #'), ('rr-email', 'email', 'Representative(s) or advisor(s) email address'),
      ('inv-state', 'text', 'Investor state of residence (required), on the representative signature row'), ('rr-date', None, 'Date beside the representative signatures (required)'),
      ('supervisor-name', 'name', 'Printed name of supervisor, broker-dealer or RIA (if required)'), ('supervisor-signature', None, 'Signature of supervisor, broker-dealer or RIA (if required)'), ('supervisor-date', None, 'Date beside the supervisor signature (required)'),
      ('comments', 'text', 'Additional comments')]
for i, (s, w, l) in enumerate(C4):
    k = 'date' if s.endswith('date') else ('signature' if s.endswith('signature') else B)
    cell(s, 4, i, k, w if k == B else None, TP, 'Broker-dealer / advisor section: ' + l, False, l.split(' (')[0])
put('rr-signature-1', 4, [70, 1093, 543, 1170], 'signature', None, TP, 'Signature of registered representative or advisor (first box, a printed X)', False, 'SIGNATURE(S) OF REGISTERED REPRESENTATIVE(S) OR ADVISORS', None, 'box edges measured as ink columns/rows in the picture')
put('rr-signature-2', 4, [566, 1093, 1040, 1170], 'signature', None, TP, 'Signature of registered representative or advisor (second box, a printed X)', False, 'SIGNATURE(S) OF REGISTERED REPRESENTATIVE(S) OR ADVISORS', None, 'box edges measured as ink columns/rows in the picture')
S.NOT[14] = ['the printed X in signature boxes', 'letters read as squares']
# ---- page 17 W-9
W9 = 5
put('w9-name', W9, [243, 368, 1518, 427], B, 'name', INV, 'W-9 line 1: name (as shown on your income tax return)', False, '1 Name', None, 'W-9 line between rules')
put('w9-business-name', W9, [243, 427, 1518, 486], B, 'name', INV, 'W-9 line 2: business name/disregarded entity name', False, '2 Business name')
for i, s, l in ((7, 'individual', 'Individual/sole proprietor or single-member LLC'), (3, 'c-corp', 'C Corporation'), (4, 's-corp', 'S Corporation'), (5, 'partnership', 'Partnership'), (6, 'trust', 'Trust/estate'),
                (8, 'llc', 'Limited liability company'), (9, 'other', 'Other (see instructions)')):
    sq('w9-' + s, W9, i, INV, 'W-9 tax classification: ' + l, l, group='W-9 federal tax classification (check only one)')
rule('w9-llc-class', W9, 1, B, 'text', INV, 'W-9: LLC tax classification (C, S or P)', False, 'Enter the tax classification')
sn('w9-other-text', W9, [300, 360, 520, 374], INV, 'W-9: other classification, which', 'Other (see instructions)', kind=B, what='text',
   doubt='the line after "Other (see instructions) ▶" has no rule of its own; box taken on the cell bottom') if False else None
rule('w9-exempt-payee', W9, 0, B, 'text', INV, 'W-9: exempt payee code (if any)', False, 'Exempt payee code (if any)')
rule('w9-fatca', W9, 2, B, 'text', INV, 'W-9: exemption from FATCA reporting code (if any)', False, 'Exemption from FATCA reporting code')
cell('w9-address', W9, 1, B, 'address', INV, 'W-9 line 5: address (number, street, apt. or suite)', False, '5 Address')
cell('w9-city', W9, 2, B, 'address', INV, 'W-9 line 6: city, state and ZIP code', False, '6 City, state, and ZIP code')
put('w9-account-numbers', W9, [243, 869, 1058, 928], B, 'text', INV, 'W-9 line 7: list account number(s) here (optional)', False, '7 List account number(s) here (optional)')
cs = D['im-005.png']['cells']
for g, idx in (('1', (3, 4, 5)), ('2', (6, 7)), ('3', (8, 9, 10, 11))):
    b = [min(cs[i][0] for i in idx), min(cs[i][1] for i in idx), max(cs[i][2] for i in idx), max(cs[i][3] for i in idx)]
    put('w9-ssn-' + g, W9, b, B, 'tax number', INV, 'W-9 Part I: social security number (group %s)' % g, False, 'Social security number', None, 'digit cells printed in the picture', group='W-9 SSN or EIN')
put('w9-ein-1', W9, [1127, 1104, 1199, 1163], B, 'tax number', ENT, 'W-9 Part I: employer identification number (group 1)', False, 'Employer identification number', None, 'digit cells printed in the picture', group='W-9 SSN or EIN')
put('w9-ein-2', W9, [1233, 1104, 1482, 1163], B, 'tax number', ENT, 'W-9 Part I: employer identification number (group 2)', False, 'Employer identification number', None, 'digit cells printed in the picture', group='W-9 SSN or EIN')
put('w9-signature', W9, [430, 1487, 1040, 1546], 'signature', None, INV, 'W-9: signature of U.S. person', False, 'Signature of U.S. person', 'the W-9 sign row has no rule: box taken in the row after the caption', 'sign row of the W-9 picture')
put('w9-date', W9, [1100, 1487, 1518, 1546], 'date', None, INV, 'W-9: date', False, 'Date', 'as above', 'sign row of the W-9 picture')
S.NOT[17] = ["W-9 requester's name and address (completed by the requester)", 'the general instructions', 'the Form W-9 title block']
for p in range(1, 19):
    if p not in (2, 5, 8, 11, 14, 17): S.NOT[p] = ['browser-print page with no picture']
for p in (2, 5, 8, 11, 14, 17): S.SURE.setdefault(p, 'sure (boxes measured from the picture pixels)')
S.SURE[17] = 'sure; W-9 rows measured from the picture\'s own rules; the sign row has no rule (signature and date boxes taken in the row, marked)'
signing = dict(investor_pages=[2, 5, 8, 11, 17], firm_pages=[11], co_investor=True, third_parties=['custodian (page 8)', 'broker-dealer / RIA representative and supervisor (page 14)'],
               kind='Oxford Park Income Fund investor application printed from a browser: six form pages, each one picture (1700x2200 px) on its own PDF page, plus a W-9. The investor and joint investor sign form page 4; the fund accepts beside it (firm); the custodian signs and guarantees on page 3; the broker-dealer/RIA completes and signs page 5.',
               note='Pictures drawn at x 32.17-584.25, y 36.58-750.98 with a page clip at y 735.75; nothing printed falls below the clip except footers.')
S.write(signing, 'Picture pages: cells, squares and rules found as ink in each embedded picture at its own resolution (inklist.py), thin boxes snapped to their printed edges (snap.py), converted through the drawing matrix; every picture looked at; overlays looked at.')
