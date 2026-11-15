import sys; sys.path.insert(0, '.')
from splitpic import *
PDF = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b030/doc.pdf'
S = Sheet('b030', PDF, 24, [792, 612])
def P(n, p1): return Split(S, 'b030img/im-%03d.jpg' % n, p1, 61.5, 27.75, -528.75, 0.75, 0.75, 27.75, 583.75)
A = P(0, 2)
A.sq('initial', 84, 208, INV, 'Initial investment ($5,000 minimum)', 'Initial Investment', group='investment')
A.sq('additional', 300, 208, INV, 'Additional investment ($500 minimum)', 'Additional Investment', group='investment')
A.sq('nav', 524, 208, INV, 'NAV or net of commission investment', 'NAV or Net of commission Investment')
A.put('amount', [224, 217, 469, 252], 'blank', 'amount', INV, 'Subscription amount', True, 'Subscription Amount $', None, 'drawn box in the picture')
G = 'ownership (select only one)'
for slug, x, y, l in (('own-individual', 71, 295, 'Individual'), ('own-jtwros', 222, 294, 'Joint tenants with right of survivorship'), ('own-pension', 449, 294, 'Pension plan'),
                      ('own-trust', 543, 294, 'Trust (complete Appendix A)'), ('own-nonprofit', 71, 310, 'Non-profit organization'), ('own-corp', 222, 309, 'Corporation or partnership (complete Appendix B)'),
                      ('own-ugma', 71, 327, 'UGMA'), ('own-utma', 222, 327, 'UTMA'), ('own-other', 376, 330, 'Other (specify and include title pages)'), ('own-custodial', 71, 343, 'Custodial account')):
    A.sq(slug, x, y, INV, 'Ownership: ' + l, l, group=G)
for slug, x, y, l in (('cust-ira', 187, 342, 'IRA'), ('cust-sep', 233, 344, 'SEP/IRA'), ('cust-roth', 302, 344, 'ROTH/IRA'), ('cust-other', 378, 345, 'Other qualified account')):
    A.sq(slug, x, y, INV, 'Custodial account: ' + l, l, group='custodial account type')
A.rule('ugma-state', [165, 330, 206, 331], 'blank', 'text', INV, 'UGMA: state of', False, 'UGMA: State of')
A.rule('utma-state', [310, 330, 351, 331], 'blank', 'text', INV, 'UTMA: state of', False, 'UTMA: State of')
A.rule('own-other-specify', [569, 330, 825, 331], 'blank', 'text', INV, 'Other ownership: specify', False, 'Other (Specify and include title pages)')
A.rule('cust-other-specify', [498, 348, 824, 349], 'blank', 'text', INV, 'Other qualified account: which', False, 'OTHER Qualified Acct:')
A.rule('cust-name', [170, 365, 589, 366], 'blank', 'name', INV, 'Custodian name', False, 'Custodian Name:')
A.rule('cust-account', [653, 365, 822, 366], 'blank', 'text', INV, 'Custodian account #', False, 'Account #:')
A.rule('cust-address', [224, 382, 822, 383], 'blank', 'address', INV, 'Custodian mailing address', False, 'Custodian Mailing Address:')
A.row(440, 467, 69, 823, [('entity-name', 'blank', 'name', ENT, 'Name of investing entity', False), ('entity-tax-id', 'blank', 'tax number', ENT, 'Entity tax ID number', False)])
def person(P, pref, own, r1, r2, mustp, ttl):
    P.row(r1[0], r1[1], 69, 823, [(pref + 'first-name', 'blank', 'name', own, ttl + 'first name', mustp), (pref + 'mi', 'blank', 'name', own, ttl + 'middle initial', False),
                                  (pref + 'last-name', 'blank', 'name', own, ttl + 'last name', mustp), (pref + 'gender', 'blank', 'text', own, ttl + 'gender (M/F)', False)])
    P.row(r2[0], r2[1], 69, 823, [(pref + 'ssn', 'blank', 'tax number', own, ttl + 'social security number', mustp), (pref + 'dob', 'blank', 'date', own, ttl + 'date of birth (MM/DD/YYYY)', mustp),
                                  (pref + 'phone', 'blank', 'phone', own, ttl + 'daytime phone number', mustp)])
person(A, 'inv-', INV, (470, 497), (501, 527), True, 'A. Individual/beneficial owner: ')
person(A, 'joint-', CO, (555, 582), (585, 611), False, 'B. Joint investor/minor: ')
for k, (t, b) in enumerate(((629, 656), (657, 684))):
    p = 'tod%d-' % (k + 1)
    A.row(t, b, 66, 676, [(p + 'first-name', 'blank', 'name', INV, 'TOD beneficiary %d: first name' % (k + 1), False, {'x': 72}), (p + 'mi', 'blank', 'name', INV, 'TOD beneficiary %d: middle initial' % (k + 1), False, {'x': 231}),
                          (p + 'last-name', 'blank', 'name', INV, 'TOD beneficiary %d: last name' % (k + 1), False, {'x': 308}), (p + 'ssn', 'blank', 'tax number', INV, 'TOD beneficiary %d: social security number' % (k + 1), False, {'x': 491})])
    y = 643 if k == 0 else 671
    A.rule(p + 'primary', [680 if k == 0 else 681, y, 688 if k == 0 else 689, y + 1], 'blank', 'text', INV, 'TOD beneficiary %d: "___Primary" (a short blank to mark primary)' % (k + 1), False, 'Primary',
           'a 6 pt underscore blank before "Primary": a mark or letter, read as a short blank')
    A.rule(p + 'percent', [766 if k == 0 else 767, y, 774 if k == 0 else 775, y + 1], 'blank', 'percentage', INV, 'TOD beneficiary %d: percentage' % (k + 1), False, '%')
A.row(723, 749, 69, 823, [('rec-street', 'blank', 'address', INV, 'A. Address of record: street address', True)])
A.row(752, 779, 69, 823, [('rec-city', 'blank', 'text', INV, 'A. Address of record: city', True), ('rec-state', 'blank', 'text', INV, 'A. Address of record: state', True),
                          ('rec-zip', 'blank', 'text', INV, 'A. Address of record: zip code', True), ('rec-country', 'blank', 'text', INV, 'A. Address of record: if non-U.S., specify country', False)])
A.row(801, 825, 69, 823, [('mail-street', 'blank', 'address', INV, 'B. Mailing address (if different): street address', False)])
A.row(828, 854, 69, 823, [('mail-city', 'blank', 'text', INV, 'B. Mailing address: city', False), ('mail-state', 'blank', 'text', INV, 'B. Mailing address: state', False),
                          ('mail-zip', 'blank', 'text', INV, 'B. Mailing address: zip code', False), ('mail-country', 'blank', 'text', INV, 'B. Mailing address: if non-U.S., specify country', False)], capy=(829, 843))
A.sq('dist-drip', 84, 892, INV, 'Distributions: participate in the DRIP', 'I choose to participate in the Company\'s DRIP', group='distributions')
A.sq('dist-deposit', 310, 894, INV, 'Distributions: deposited in an account or sent to the custodian', 'I choose to have distributions deposited', group='distributions')
A.sq('dist-mail', 583, 894, INV, 'Distributions: mailed to the address in section 4', 'I choose to have distributions mailed to me', group='distributions')
A.rule('dist-drip-pct', [96, 955, 142, 956], 'blank', 'percentage', INV, '% of distribution to the DRIP', False, '% of Distribution')
A.rule('dist-deposit-pct', [321, 955, 368, 956], 'blank', 'percentage', INV, '% of distribution deposited', False, '% of Distribution')
A.rule('dist-mail-pct', [594, 953, 641, 954], 'blank', 'percentage', INV, '% of distribution mailed', False, '% of Distribution')
B = P(2, 6)
B.row(81, 107, 70, 824, [('bank-name', 'blank', 'name', INV, 'Distribution account: name of financial institution', False), ('bank-account-type', 'blank', 'text', INV, 'Distribution account: account type', False)])
B.row(112, 138, 70, 824, [('bank-address', 'blank', 'address', INV, 'Distribution account: mailing address', False), ('bank-city-state', 'blank', 'text', INV, 'Distribution account: city/state', False),
                          ('bank-zip', 'blank', 'text', INV, 'Distribution account: zip code', False), ('bank-account', 'blank', 'text', INV, 'Distribution account: account number', False)])
B.put('bank-signature', [70, 145, 501, 197], 'signature', None, INV, 'Signature of individual/trustee/beneficial owner (MANDATORY), distribution account authorization', False, 'Signature of Individual/Trustee/Beneficial Owner (MANDATORY)',
      'printed "MANDATORY", but it sits in the distribution-account block that applies only to deposits', 'drawn box in the picture')
B.put('bank-aba', [506, 142, 824, 169], 'blank', 'text', INV, 'Distribution account: ABA routing number', False, 'ABA Routing Number', None, 'drawn box in the picture')
B.put('bank-joint-signature', [506, 173, 824, 197], 'signature', None, CO, 'Signature of joint owner (distribution account authorization)', False, 'Signature of Joint Owner', None, 'drawn box in the picture')
B.put('edelivery-email', [70, 340, 563, 364], 'blank', 'email', INV, 'Electronic delivery: e-mail address', False, 'E-mail address', None, 'drawn box in the picture')
B.put('edelivery-initials', [570, 340, 825, 364], 'initials', None, INV, 'Electronic delivery: initials', False, 'Initials', None, 'drawn box in the picture')
rows = [(467, 508), (510, 548), (549, 590), (591, 630), (631, 686), (687, 731), (732, 787), (789, 861), (862, 921), (923, 978), (979, 1017), (1019, 1108)]
st = [None] * 5 + ['Alabama', 'California', 'Iowa', 'Kansas', 'Kentucky', 'Maine', 'Massachusetts']
for k, (t, b) in enumerate(rows):
    L = 'abcdefghijkl'[k]; lab = 'Representation %s)' % L + (' (mandatory)' if k < 5 else ' (%s residents)' % st[k])
    B.put('init-%s-owner' % L, [622, t, 714, b], 'initials', None, INV, lab + ': owner initials', k < 5, 'Owner (initials)', None, 'table cell in the picture', group='representation ' + L)
    B.put('init-%s-joint' % L, [716, t, 828, b], 'initials', None, CO, lab + ': joint owner initials', False, 'Joint Owner (initials)', None, 'table cell in the picture', group='representation ' + L)
C = P(4, 10)
rows = [(113, 185), (186, 241), (243, 281), (283, 321), (322, 391), (393, 431), (432, 468), (469, 541)]
st = ['Nebraska', 'New Jersey', 'New Mexico', 'North Dakota', 'Ohio', 'Oregon', 'Oklahoma', 'Tennessee']
for k, (t, b) in enumerate(rows):
    L = 'mnopqrst'[k]; lab = 'Representation %s) (%s residents)' % (L, st[k])
    C.put('init-%s-owner' % L, [665, t, 762, b], 'initials', None, INV, lab + ': owner initials', False, 'Owner (initials)', None, 'table cell in the picture', group='representation ' + L)
    C.put('init-%s-joint' % L, [764, t, 840, b], 'initials', None, CO, lab + ': joint owner initials', False, 'Joint Owner (initials)', None, 'table cell in the picture', group='representation ' + L)
C.row(985, 1023, 53, 819, [('owner1-name', 'blank', 'name', INV, 'Owner or authorized person: print name', True), ('owner1-signature', 'signature', None, INV, 'Owner or authorized person: signature', True),
                           ('owner1-date', 'date', None, INV, 'Date beside the first owner signature', True)])
C.row(1025, 1062, 53, 819, [('owner2-name', 'blank', 'name', CO, 'Second owner or authorized person: print name', False, {'doubt': 'second identical row read as the joint owner\'s'}),
                            ('owner2-signature', 'signature', None, CO, 'Second owner or authorized person: signature', False, {'doubt': 'second identical row read as the joint owner\'s'}),
                            ('owner2-date', 'date', None, CO, 'Date beside the second owner signature', False)])
C.row(1064, 1102, 53, 819, [('cust-signature', 'signature', None, TP, 'Signature of custodian (if applicable)', False), ('cust-date', 'date', None, TP, 'Date beside the custodian signature', False)])
D = P(6, 14)
D.row(333, 383, 55, 817, [('bd-firm', 'blank', 'name', TP, 'Broker-dealer firm name', False), ('fa-name', 'blank', 'name', TP, 'Financial advisor name', False)])
D.row(386, 413, 55, 817, [('fa-address', 'blank', 'address', TP, 'Financial advisor mailing address', False)])
D.row(416, 443, 55, 816, [('fa-email', 'blank', 'email', TP, 'Financial advisor e-mail address', False), ('fa-phone', 'blank', 'phone', TP, 'Telephone', False), ('fa-rep', 'blank', 'text', TP, 'Rep #', False)])
D.row(447, 492, 55, 816, [('fa-signature', 'signature', None, TP, 'Financial advisor signature', False), ('fa-date', 'date', None, TP, 'Date beside the financial advisor signature', False)])
D.row(499, 548, 55, 816, [('bd-supervisor-signature', 'signature', None, TP, 'Broker dealer supervisor signature (mandatory)', False), ('bd-supervisor-date', 'date', None, TP, 'Date beside the supervisor signature', False)])
D.sq('pay-wire', 103, 583, INV, 'Investment instructions: by wire transfer', 'By Wire Transfer', group='investment instructions')
D.sq('pay-mail', 458, 583, INV, 'Investment instructions: by mail', 'By Mail', group='investment instructions')
D.sq('pay-custodial', 103, 720, INV, 'Investment instructions: custodial accounts', 'Custodial Accounts', group='investment instructions')
E = P(8, 18)
E.row(163, 189, 72, 828, [('trust-name', 'blank', 'name', ENT, 'Appendix A: complete name of the trust', False)])
E.put('trust-date', [72, 194, 236, 221], 'blank', 'date', ENT, 'Appendix A: date of the trust', False, 'Date of the Trust:', None, 'drawn box in the picture')
E.put('trust-amendment-date', [242, 195, 475, 221], 'blank', 'date', ENT, 'Appendix A: date of the latest amendment', False, 'Date of the Latest Amendment:', None, 'drawn box in the picture')
E.put('trust-revocable', [481, 195, 714, 221], 'blank', 'text', ENT, 'Appendix A: revocable/living trust (YES/NO)', False, 'Revocable/ Living Trust (YES/NO):', None, 'drawn box in the picture')
for slug, y, l in (('auth-majority', 319, 'trustees may act as a majority'), ('auth-independent', 338, 'trustees may act independently'), ('auth-collective', 358, 'trustees must act collectively')):
    E.sq(slug, 77, y, ENT, 'Authorized individuals: ' + l, l, group='authorized individuals (select one of three)')
for k, (t, b) in enumerate(((671, 698), (702, 728), (733, 759), (764, 790))):
    E.row(t, b, 63, 819, [('trustee%d-name' % (k + 1), 'blank', 'name', ENT, 'Trustee %d: name (please print)' % (k + 1), False), ('trustee%d-signature' % (k + 1), 'signature', None, ENT, 'Trustee %d: signature' % (k + 1), False),
                          ('trustee%d-date' % (k + 1), 'date', None, ENT, 'Trustee %d: date' % (k + 1), False)])
for k, (t, b) in enumerate(((831, 857), (862, 888), (893, 919), (925, 951))):
    E.row(t, b, 63, 819, [('successor%d' % (k + 1), 'blank', 'name', ENT, 'Successor trustee %d' % (k + 1), False)])
F = P(10, 22)
F.put('res-date', [61, 162, 251, 193], 'blank', 'date', ENT, 'Appendix B: date of the resolution certificate', False, 'Date:', None, 'drawn box in the picture')
F.put('res-entity', [484, 232, 818, 255], 'blank', 'name', ENT, 'Appendix B: name of the entity (board of directors/members/partners of)', False, 'a valid meeting of the board of directors/members/partners of', None, 'drawn box in the picture')
F.put('res-state', [564, 258, 771, 282], 'blank', 'text', ENT, 'Appendix B: state of organization', False, 'the laws of the State of', None, 'drawn box in the picture')
for k, (t, b) in enumerate(((577, 604), (608, 634), (639, 665))):
    F.row(t, b, 67, 821, [('officer%d-name' % (k + 1), 'blank', 'name', ENT, 'Officer/member/partner %d: name' % (k + 1), False), ('officer%d-title' % (k + 1), 'blank', 'title', ENT, 'Officer/member/partner %d: title' % (k + 1), False)])
F.put('witness-day', [281, 669, 591, 696], 'date', None, ENT, 'In witness whereof: day', False, 'this ___ day', 'the execution date is written in words across one row: day, month, year', 'space in a row cell after its caption', group='witness date')
F.put('witness-month', [627, 669, 750, 696], 'date', None, ENT, 'In witness whereof: month ("day of ___")', False, 'day of', 'as above', 'space in a row cell', group='witness date')
F.put('witness-year', [764, 669, 821, 696], 'date', None, ENT, 'In witness whereof: year ("20__")', False, '20', 'as above', 'space in a row cell', group='witness date')
F.put('secretary-signature', [67, 700, 522, 725], 'signature', None, ENT, 'Secretary signature (Appendix B)', False, 'Secretary', None, 'drawn box in the picture')
for p in (1, 4, 5, 8, 9, 12, 13, 16, 17, 20, 21, 24):
    S.NOT[p] = ['browser-print page: header text or a hidden 1 pt alt-text layer only; no place']
S.NOT[2] = ['the dark blue section bars', 'logo', 'frames around the section-3 rows (each row a set of cells)']
S.NOT[3] = ['the "Assign applicable percentage" note and footnotes']
S.NOT[6] = ['section bars', 'representation text column']
S.NOT[11] = ['the W-9 certification frame (a text box)', 'bullets']
S.NOT[15] = ['printed wire and mailing details', 'the notice to stockholder text']
S.NOT[14] = ['the underlined AML sentence (underlined words)']
for p in (2, 3, 6, 7, 10, 11, 14, 15, 18, 19, 22, 23): S.SURE[p] = 'sure (boxes measured from the picture pixels)'
S.SURE[2] = S.SURE[3] = 'sure; the street-address row of section 4A is cut by the page break (on both pages, marked); two "___Primary" blanks are judgements'
S.SURE[6] = 'sure; the bank-account signature is printed MANDATORY but applies only to deposits (marked)'
S.SURE[7] = 'sure; representation g) is cut by the page break (marked)'
S.SURE[18] = S.SURE[19] = 'sure; trustee row 3 is cut by the page break (marked)'
signing = dict(investor_pages=[2, 3, 6, 7, 10, 11, 15], firm_pages=[], co_investor=True,
               third_parties=['custodian (signature, page 11)', 'broker-dealer: financial advisor and supervisor (page 14)'],
               kind='Subscription agreement (VII Peaks Co-Optivist Income BDC II), printed from a browser in landscape: six form pages, each a picture split over two PDF pages. Owner and joint owner initial representations a-t and sign page A-3; the custodian signs if applicable; the broker-dealer signs A-4; trustees sign Appendix A; the entity secretary signs Appendix B. No issuer acceptance block.',
               note='Pictures are 893x1155 px at 0.75 pt/px drawn at x 61.5; the first PDF page shows picture rows 0-741, the second the rest. Places cut by the break are on both pages, marked.')
S.write(signing, 'Picture pages: rules, squares, row lines and caption clusters found in each embedded JPEG at its own resolution (b030-geom, picx.py); converted to PDF points through the drawing matrix; every picture looked at; overlays looked at.')
