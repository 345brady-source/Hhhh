import sys; sys.path.insert(0, '.')
from tx import *
D = Doc('b105', '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b105/doc.pdf'); S = D.S
# ---- page 1
D.H('p01-amount', 1, 0, 'blank', 'amount', INV, 'Investment amount', True, 'Investment Amount $')
D.B('p01-initial', 1, 0, INV, 'Initial purchase', plabel='Initial Purchase', group='purchase')
D.B('p01-subsequent', 1, 1, INV, 'Subsequent purchase', plabel='Subsequent Purchase', group='purchase')
for i, s, l in ((2, 'by-mail', 'By mail'), (3, 'by-wire', 'By wire'), (4, 'by-bd', 'Broker-dealer/financial adviser')):
    D.B('p01-' + s, 1, i, INV, 'Investment method: ' + l, plabel=l, group='investment method')
for i, c in zip(range(5, 9), 'TSDI'):
    D.B('p01-class-' + c.lower(), 1, i, INV, 'Share class ' + c, plabel='Share Class ' + c, group='share class (required)')
for i, s, l in ((9, 'emp', 'Oaktree employee'), (10, 'officer', 'Oaktree officer or director'), (11, 'affiliate', 'Oaktree affiliate'), (12, 'na', 'Not applicable')):
    D.B('p01-oaktree-' + s, 1, i, INV, 'Oaktree relationship: ' + l, plabel=l, group='Oaktree relationship (required)')
D.H('p01-brokerage-account', 1, 2, 'blank', 'text', INV, 'Brokerage account number (non-custodial)', False, 'Brokerage Account Number')
D.H('p01-custodian-account', 1, 3, 'blank', 'text', INV, 'Custodian account number (third-party custodial)', False, 'Custodian Account Number')
for i, s, l in ((13, 'individual-jtwros', 'Individual or joint tenant with rights of survivorship'), (15, 'tod', 'Transfer on death (optional)'), (16, 'tic', 'Tenants in common'),
                (20, 'community', 'Community property'), (22, 'ugma', 'Uniform gift/transfer to minors'), (23, 'pension', 'Pension plan'), (24, 'trust', 'Trust'), (25, 'corp', 'Corporation / partnership / other'),
                (14, 'ira', 'IRA'), (17, 'roth', 'Roth IRA'), (18, 'sep', 'SEP IRA'), (19, 'simple', 'Simple IRA'), (21, 'other', 'Other (custodial)')):
    D.B('p01-own-' + s, 1, i, INV, 'Ownership type: ' + l, plabel=l, group='ownership type (select only one)' if s != 'tod' else 'TOD option')
D.H('p01-own-other-which', 1, 4, 'blank', 'text', INV, 'Other custodial account type, which', False, 'OTHER')
D.H('p01-ugma-state', 1, 5, 'blank', 'text', INV, 'Uniform gift/transfer to minors: state of', False, 'STATE OF')
D.H('p01-cust-name', 1, 6, 'blank', 'name', TP, 'Custodian name (custodian information, to be completed by custodian)', False, 'CUSTODIAN NAME')
D.H('p01-cust-tax-id', 1, 7, 'blank', 'tax number', TP, 'Custodian tax ID', False, 'CUSTODIAN TAX ID #')
D.H('p01-cust-phone', 1, 8, 'blank', 'phone', TP, 'Custodian phone', False, 'CUSTODIAN PHONE #')
S.NOT[1] = ['the printed bank wire details (already filled in)', 'the table frame of the ownership-type grid and the section heading bars', 'the logo picture']
S.SURE[1] = 'sure'
# ---- page 2
D.row(2, 68.5, 102.6, [('Entity Name', 'p02-entity-name', 'blank', 'name', ENT, 'Entity name', False), ('Tax ID Number', 'p02-entity-tax-id', 'blank', 'tax number', ENT, 'Entity tax ID number', False),
                       ('Date of Trust:', 'p02-trust-date', 'blank', 'date', ENT, 'Date of trust', False)], right=394.0)
for i, s in enumerate(['retirement-plan', 'trust', 's-corp', 'c-corp', 'llc', 'partnership', 'other']):
    D.B('p02-etype-' + s, 2, i, ENT, 'Entity type: ' + s.replace('-', ' '), plabel=s, group='entity type (select one, required)')
D.H('p02-etype-other-which', 2, 4, 'blank', 'text', ENT, 'Entity type other, which', False, 'Other')
D.H('p02-jurisdiction', 2, 3, 'blank', 'text', ENT, 'Jurisdiction (if non-U.S.)', False, 'Jurisdiction (if Non-U.S.)')
D.H('p02-exempt-payee', 2, 2, 'blank', 'text', ENT, 'Exempt payee code (if any)', False, 'Exempt payee code (if any)')
D.H('p02-fatca-code', 2, 5, 'blank', 'text', ENT, 'Exemption from FATCA reporting code (if any)', False, 'Exemption from FATCA reporting code (if any)')
def person(pref, own, rows, mustp):
    (r1, r2, r3, r4, r5) = rows
    D.row(2, r1, r2, [('First Name', pref + 'first-name', 'blank', 'name', own, 'First name', mustp), ('(MI)', pref + 'mi', 'blank', 'name', own, 'Middle initial', False),
                      ('Last Name', pref + 'last-name', 'blank', 'name', own, 'Last name', mustp), ('Gender', pref + 'gender', 'blank', 'text', own, 'Gender', False)], right=576.2)
    D.row(2, r2, r3, [('Social Security', pref + 'ssn', 'blank', 'tax number', own, 'Social security number / tax ID', mustp), ('Date of Birth', pref + 'dob', 'blank', 'date', own, 'Date of birth (MM/DD/YYYY)', mustp),
                      ('Daytime Phone Number', pref + 'phone', 'blank', 'phone', own, 'Daytime phone number', mustp)], right=576.2)
    D.row(2, r3, r4, [('Residential Street Address', pref + 'street', 'blank', 'address', own, 'Residential street address', mustp), ('City', pref + 'city', 'blank', 'text', own, 'City', mustp),
                      ('State', pref + 'state', 'blank', 'text', own, 'State', mustp), ('Zip Code', pref + 'zip', 'blank', 'text', own, 'Zip code', mustp)], right=576.2)
    D.row(2, r4, r5, [('Email Address', pref + 'email', 'blank', 'email', own, 'Email address', False)], right=576.2)
person('p02-inv-', INV, (227.2, 245.5, 269.5, 293.7, 317.7), True)
D.B('p02-inv-resident-alien', 2, 7, INV, 'Investor: resident alien', plabel='Resident Alien', group='investor non-U.S. status')
D.B('p02-inv-nonresident-alien', 2, 8, INV, 'Investor: non-resident alien', plabel='Non-Resident Alien', group='investor non-U.S. status')
D.H('p02-inv-citizenship', 2, 12, 'blank', 'text', INV, 'Investor: country of citizenship (if non-U.S.)', False, 'Country of Citizenship')
for i, s, l in ((9, 'emp', 'Oaktree employee'), (10, 'officer', 'Oaktree officer or director'), (11, 'affiliate', 'Oaktree affiliate')):
    D.B('p02-inv-oaktree-' + s, 2, i, INV, 'Investor: ' + l, plabel=l, group='investor Oaktree relationship')
person('p02-co-', CO, (393.6, 421.7, 445.9, 469.9, 494.2), False)
D.B('p02-co-resident-alien', 2, 12, CO, 'Co-investor: resident alien', plabel='Resident Alien', group='co-investor non-U.S. status')
D.B('p02-co-nonresident-alien', 2, 13, CO, 'Co-investor: non-resident alien', plabel='Non-Resident Alien', group='co-investor non-U.S. status')
c = D.find(2, 'Country of Citizenship', 510, 530, x0=400)
S.add('p02-co-citizenship', 2, 'blank', 'text', CO, 'Co-investor: country of citizenship (caption printed, no rule after it)', False, [c[2] + 3, c[3] - 10, 576.2, c[3]],
      'no printed rule: the space after the caption to the margin, 10 pt above its baseline', 'Country of Citizenship', 'the investor\'s copy of this caption has a rule; this one has none')
for i, s, l in ((14, 'emp', 'Oaktree employee'), (15, 'officer', 'Oaktree officer or director'), (16, 'affiliate', 'Oaktree affiliate')):
    D.B('p02-co-oaktree-' + s, 2, i, CO, 'Co-investor: ' + l, plabel=l, group='co-investor Oaktree relationship')
S.NOT[2] = ['the "Exemptions" heading cell (it only heads the two code blanks below it)', 'row rules between the investor rows (they frame the cells, not blanks of their own)', 'section heading bar']
S.SURE[2] = 'sure of every place; boxes of row cells run from caption to next caption (no vertical rules are printed); the co-investor citizenship place has no printed rule'
# ---- page 3
tops = [61.6, 91.1, 120.9, 150.4, 180.0]
for k in range(4):
    p = 'p03-ben%d-' % (k + 1)
    D.row(3, tops[k], tops[k + 1] if k < 3 else 180.0, [('First Name', p + 'first-name', 'blank', 'name', INV, 'TOD beneficiary %d: first name' % (k + 1), False), ('(MI)', p + 'mi', 'blank', 'name', INV, 'TOD beneficiary %d: middle initial' % (k + 1), False),
                      ('Last Name', p + 'last-name', 'blank', 'name', INV, 'TOD beneficiary %d: last name' % (k + 1), False), ('SSN', p + 'ssn', 'blank', 'tax number', INV, 'TOD beneficiary %d: SSN' % (k + 1), False),
                      ('Date of Birth', p + 'dob', 'blank', 'date', INV, 'TOD beneficiary %d: date of birth' % (k + 1), False)], right=482.0, ycap=(tops[k], tops[k] + 12))
    D.B(p + 'primary', 3, 2 * k, INV, 'TOD beneficiary %d: primary' % (k + 1), plabel='Primary', group='beneficiary %d primary/secondary' % (k + 1))
    D.B(p + 'secondary', 3, 2 * k + 1, INV, 'TOD beneficiary %d: secondary' % (k + 1), plabel='Secondary', group='beneficiary %d primary/secondary' % (k + 1))
    D.H(p + 'percent', 3, 2 * k + 1, 'blank', 'percentage', INV, 'TOD beneficiary %d: percentage (a 6 pt rule between "Secondary" and "%%")' % (k + 1), False, '%')
D.row(3, 201.1, 217.9, [('Email Address', 'p03-contact-email', 'blank', 'email', INV, 'Contact information (if different): email address', False)], right=576.2)
D.row(3, 217.9, 241.5, [('Mailing Address', 'p03-contact-address', 'blank', 'address', INV, 'Contact information: mailing address', False), ('City', 'p03-contact-city', 'blank', 'text', INV, 'Contact information: city', False),
                        ('State', 'p03-contact-state', 'blank', 'text', INV, 'Contact information: state', False), ('Zip', 'p03-contact-zip', 'blank', 'text', INV, 'Contact information: zip code', False)], right=576.2)
D.B('p03-drp-optout-initials', 3, 8, INV, 'Initial this box to NOT enrol in the distribution reinvestment plan (residents of states not listed)', False, 'Initials', kind='initials')
D.B('p03-drp-enrol-initials', 3, 9, INV, 'Initial this box to enrol in the distribution reinvestment plan (residents of the listed states)', False, 'Initials', kind='initials')
D.B('p03-dist-a', 3, 10, INV, 'Distributions: A. cash/check mailed to the address above', plabel='Cash/Check Mailed to the address set forth above', group='distributions (select only one)')
D.B('p03-dist-b', 3, 11, INV, 'Distributions: B. cash/check mailed to third party/custodian', plabel='Cash/Check Mailed to Third Party/Custodian', group='distributions (select only one)')
D.B('p03-dist-c', 3, 12, INV, 'Distributions: C. cash/direct deposit', plabel='Cash/Direct Deposit', group='distributions (select only one)')
D.row(3, 475.9, 493.0, [('Name/Entity Name/Financial Institution', 'p03-tp-name', 'blank', 'name', INV, 'Third party/custodian: name, entity name or financial institution', False),
                        ('Mailing Address', 'p03-tp-address', 'blank', 'address', INV, 'Third party/custodian: mailing address', False)], right=576.2)
D.row(3, 493.0, 510.1, [('City', 'p03-tp-city', 'blank', 'text', INV, 'Third party/custodian: city', False), ('State', 'p03-tp-state', 'blank', 'text', INV, 'Third party/custodian: state', False),
                        ('Zip Code', 'p03-tp-zip', 'blank', 'text', INV, 'Third party/custodian: zip code', False), ('Account Number', 'p03-tp-account', 'blank', 'text', INV, 'Third party/custodian: account number (required)', False)], right=576.2)
D.row(3, 569.8, 586.9, [('Financial Institution Name', 'p03-dd-bank', 'blank', 'name', INV, 'Direct deposit: financial institution name', False), ('Mailing Address', 'p03-dd-address', 'blank', 'address', INV, 'Direct deposit: mailing address', False),
                        ('City', 'p03-dd-city', 'blank', 'text', INV, 'Direct deposit: city', False), ('State', 'p03-dd-state', 'blank', 'text', INV, 'Direct deposit: state', False)], right=576.2)
D.row(3, 586.9, 604.0, [('Your Bank’s ABA Routing Number', 'p03-dd-aba', 'blank', 'text', INV, 'Direct deposit: ABA routing number', False), ('Your Bank Account Number', 'p03-dd-account', 'blank', 'text', INV, 'Direct deposit: bank account number', False)], right=576.2,
      )
S.NOT[3] = ['the underline under the word NOT and under ARE in the bold notices (underlined words)', 'the underline of "pre-printed voided check" (underlined words)', 'row rules framing the cells', 'section heading bars']
S.SURE[3] = 'sure; the last row (ABA/account) has no rule under it: its band is taken as 17 pt like the row above'
# ---- page 4
D.row(4, 87.7, 103.6, [('Broker-Dealer', 'p04-bd-name', 'blank', 'name', TP, 'Broker-dealer', False), ('Financial Advisor Name', 'p04-fa-name', 'blank', 'name', TP, 'Financial advisor name', False)], right=576.2)
D.row(4, 103.6, 124.2, [('Advisor Mailing Address', 'p04-fa-address', 'blank', 'address', TP, 'Advisor mailing address', False)], right=576.2)
D.row(4, 124.2, 144.4, [('City', 'p04-fa-city', 'blank', 'text', TP, 'City', False), ('State', 'p04-fa-state', 'blank', 'text', TP, 'State', False), ('Zip Code', 'p04-fa-zip', 'blank', 'text', TP, 'Zip code', False)], right=576.2)
D.row(4, 144.4, 161.7, [('Financial Advisor Number', 'p04-fa-number', 'blank', 'text', TP, 'Financial advisor number', False), ('Branch Number', 'p04-fa-branch', 'blank', 'text', TP, 'Branch number', False),
                        ('Telephone Number', 'p04-fa-phone', 'blank', 'phone', TP, 'Telephone number', False)], right=576.2)
D.row(4, 161.7, 178.7, [('E-mail Address', 'p04-fa-email', 'blank', 'email', TP, 'E-mail address', False), ('Fax Number', 'p04-fa-fax', 'blank', 'phone', TP, 'Fax number', False)], right=576.2)
for (x, y), s, k, l in (((100, 390), 'fa-signature', 'signature', 'Financial advisor signature'), ((280, 390), 'fa-date', 'date', 'Date beside the financial advisor signature'),
                        ((400, 390), 'bm-signature', 'signature', 'Branch manager signature (if required by broker-dealer)'), ((550, 390), 'bm-date', 'date', 'Date beside the branch manager signature')):
    D.cell('p04-' + s, 4, D.cellat(4, x, y), k, None, TP, l, False, l.split(' (')[0])
D.cell('p04-edelivery-initials', 4, D.cellat(4, 190, 590), 'initials', None, INV, 'Initials: I consent to electronic delivery (optional)', False, 'Initials')
D.H('p04-edelivery-email', 4, 15, 'blank', 'email', INV, 'Email for electronic delivery (caption under a full-width rule)', False, 'Email')
S.NOT[4] = ['the printed "X" before each signature box', 'prose paragraphs', 'Section 6 rows: the rules frame cells of the broker-dealer block']
S.SURE[4] = 'sure; the Section 6 cells have irregular rules (row 1 has a rule only under the right half): boxes taken between the nearest rules'
# ---- pages 5-7 initials
items5 = 'abcdefghijkl'; items6 = 'mnopqrstuvwxyz'
def initials(pg, letters, must_upto):
    c1 = sorted([c for c in D.cells(pg) if abs(c[0] - 481) < 1.5], key=lambda c: c[1])
    c2 = sorted([c for c in D.cells(pg) if abs(c[0] - 540) < 1.5], key=lambda c: c[1])
    assert len(c1) == len(letters), (pg, len(c1))
    for L, a in zip(letters, c1):
        b = [c for c in c2 if abs(c[1] - a[1]) < 1]
        must = L in must_upto
        D.cell('p%02d-init-%s-investor' % (pg, L), pg, a, 'initials', None, INV, 'Representation (%s): investor initials' % L, must, 'Initials', group='representation (%s)' % L)
        if b:
            D.cell('p%02d-init-%s-co' % (pg, L), pg, b[0], 'initials', None, CO, 'Representation (%s): second initials box (joint investor)' % L, False, 'Initials', 'the second box of each pair is read as the co-investor\'s; it is not captioned', group='representation (%s)' % L)
        else:
            D.cell('p%02d-init-%s-co' % (pg, L), pg, [a[0] + 58.6, a[1], a[2] + 58.6, a[3]], 'initials', None, CO, 'Representation (%s): second initials box (joint investor)' % L, False, 'Initials',
                   'the second box of this pair is printed without its left edge; box completed from its other three rules; read as the co-investor\'s', how='drawn box missing its left rule (top, right and bottom rules)', group='representation (%s)' % L)
initials(5, items5, 'abcdefgh')
initials(6, items6, '')
initials(7, ['aa'], '')
for (x, y), s, k, o, l, m, dbt in (((100, 405), 'inv-signature', 'signature', INV, 'Signature of investor', True, None), ((260, 405), 'inv-date', 'date', INV, 'Date beside the investor signature', True, None),
                                  ((400, 405), 'co-signature', 'signature', CO, 'Signature of co-investor or custodian (if applicable)', False, 'captioned for a co-investor OR a custodian; read as the co-investor\'s'),
                                  ((530, 405), 'co-date', 'date', CO, 'Date beside the co-investor/custodian signature', False, 'as the signature beside it')):
    D.cell('p07-' + s, 7, D.cellat(7, x, y), k, None, o, l, m, l.split(' (')[0], dbt)
S.NOT[5] = ['the "Initials" captions under the boxes', 'prose']
S.NOT[6] = ['the "Initials" captions', 'the New Jersey paragraphs (no box)']
S.NOT[7] = ['the printed "X" before each signature box', 'FIRPTA and W-9 certifications (no box)', 'return address']
S.NOT[8] = ['blank page']
for p in (5, 6): S.SURE[p] = 'sure; whose the second box of each pair is (co-investor) is a judgement'
S.SURE[7] = 'sure; the second signature is captioned "co-investor or custodian"'
signing = dict(investor_pages=[1, 2, 3, 4, 5, 6, 7], firm_pages=[], co_investor=True,
               third_parties=['custodian (page 1 custodian information)', 'broker-dealer, financial advisor and branch manager (page 4)'],
               kind='Subscription agreement form (Oaktree REIT, Appendix C). The investor completes sections 1-5 and 7-8 and signs page 7; a co-investor (or custodian) signs beside; the investor and co-investor each initial 27 representations; the broker-dealer section and its two signatures are on page 4. No issuer acceptance block.',
               note='Page 8 is blank.')
S.write(signing, 'pdfplumber characters, drawn rules and rectangles of the PDF (cand/b105.json); box characters measured as ink on a 400 dpi render; row cells measured between the row rules from caption to caption; every page looked at at 90 dpi; overlays looked at.')
