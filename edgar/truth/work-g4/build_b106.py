import sys; sys.path.insert(0, '.')
from tx import *
D = Doc('b106', '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b106/doc.pdf'); S = D.S
def Q(id, pg, i, owner, label, plabel=None, doubt=None, must=False, kind='tickbox', **kw):
    q = D.cand(pg, 'Q', i)
    return S.add(id, pg, kind, None, owner, label, must, q['box'], 'drawn square (stroked rectangle, %.1f pt)' % (q['box'][2] - q['box'][0]), plabel, doubt, **kw)
# p1
D.U('p01-amount', 1, 0, 'blank', 'amount', INV, 'Investment amount', True, 'Investment Amount $')
Q('p01-initial', 1, 0, INV, 'Initial purchase', 'Initial Purchase', group='purchase'); Q('p01-subsequent', 1, 1, INV, 'Subsequent purchase', 'Subsequent Purchase', group='purchase')
for i, s, l in ((2, 'by-mail', 'By mail'), (3, 'by-wire', 'By wire'), (4, 'by-bd', 'Broker-dealer/financial advisor')):
    Q('p01-' + s, 1, i, INV, 'Investment method: ' + l, l, group='investment method')
for i, c in zip(range(5, 10), ['t', 's', 'd', 'i', 'f-i']):
    Q('p01-class-' + c, 1, i, INV, 'Share class ' + c.upper(), 'Share Class ' + c.upper(), group='share class selection (required)')
for i, s, l in ((10, 'employee', 'Cohen & Steers employee'), (11, 'affiliate', 'Cohen & Steers affiliate'), (12, 'officer', 'CNSREIT officer or director'), (13, 'family', 'Immediate family member of a CNSREIT officer or director'), (14, 'na', 'Not applicable')):
    Q('p01-rel-' + s, 1, i, INV, 'Relationship: ' + l, l, group='relationship to Cohen & Steers (required)')
S.NOT[1] = ['the underlined wire details (payee name, bank name, ABA, DDA: printed, already filled in)', 'the footnote rule', 'logo picture and its strokes']
# p2
D.U('p02-brokerage-account', 2, 0, 'blank', 'text', INV, 'Brokerage account number (taxable account)', False, 'Brokerage Account Number')
D.U('p02-custodian-account', 2, 1, 'blank', 'text', INV, 'Custodian account number (non-taxable account)', False, 'Custodian Account Number')
G = 'ownership type (select only one)'
for i, s, l, g in ((0, 'individual-jtwros', 'Individual or joint tenant with rights of survivorship', G), (2, 'tod', 'Transfer on death (optional)', 'TOD option'), (5, 'tic', 'Tenants in common', G),
                   (7, 'community', 'Community property', G), (9, 'ugma', 'Uniform gift/transfer to minors', G), (11, 'trust', 'Trust', G), (12, 'corp', 'Corporation / partnership / other', G),
                   (1, 'ira', 'IRA', G), (3, 'roth', 'Roth IRA', G), (4, 'sep', 'SEP IRA', G), (6, 'simple', 'Simple IRA', G), (8, 'pension', 'Pension plan', G), (10, 'other', 'Other (non-taxable)', G)):
    Q('p02-own-' + s, 2, i, INV, 'Ownership type: ' + l, l, group=g)
D.U('p02-ugma-state', 2, 2, 'blank', 'text', INV, 'Uniform gift/transfer to minors: state of', False, 'State of')
D.U('p02-cust-name', 2, 3, 'blank', 'name', TP, 'Custodian information (to be completed by custodian): name', False, 'Name:')
D.U('p02-cust-tax-id', 2, 4, 'blank', 'tax number', TP, 'Custodian information: tax ID #', False, 'Tax ID #:')
D.U('p02-cust-phone', 2, 5, 'blank', 'phone', TP, 'Custodian information: phone #', False, 'Phone #:')
D.row(2, 507.1, 545.0, [('Entity Name', 'p02-entity-name', 'blank', 'name', ENT, 'Entity name', False, dict(doubt='no rule under this row: its bottom is taken at 545 pt, above the entity-type heading')),
                        ('Tax ID Number', 'p02-entity-tax-id', 'blank', 'tax number', ENT, 'Entity tax ID number', False, dict(doubt='no rule under this row')),
                        ('Date of Trust', 'p02-trust-date', 'blank', 'date', ENT, 'Date of trust', False, dict(doubt='no rule under this row'))], right=336.0, ycap=(507, 521))
D.U('p02-exempt-payee', 2, 6, 'blank', 'text', ENT, 'Exempt payee code (if any)', False, 'Exempt payee code (if any)')
D.U('p02-fatca', 2, 7, 'blank', 'text', ENT, 'Exemption from FATCA reporting code (if any)', False, 'Exemption from FATCA reporting code (if any)')
for i, s in zip(range(13, 20), ['retirement-plan', 'c-corp', 'trust', 'llc', 's-corp', 'partnership', 'other']):
    Q('p02-etype-' + s, 2, i, ENT, 'Entity type: ' + s.replace('-', ' '), s, group='entity type (select one, required)')
D.U('p02-jurisdiction', 2, 8, 'blank', 'text', ENT, 'Jurisdiction (if non-U.S.)', False, 'Jurisdiction (if Non-U.S.)')
S.NOT[2] = ['the underlined link www.irs.gov', 'the "Exemptions" heading', 'table frame of the ownership grid', 'section bar']
S.SURE[2] = 'sure; the entity name/tax ID/date row has no bottom rule (bottom taken at 545 pt, marked)'
# p3
def person(pg, pref, own, r, mustp):
    D.row(pg, r[0], r[1], [('First Name', pref + 'first-name', 'blank', 'name', own, 'First name', mustp), ('(MI)', pref + 'mi', 'blank', 'name', own, 'Middle initial', False),
                           ('Last Name', pref + 'last-name', 'blank', 'name', own, 'Last name', mustp), ('Gender', pref + 'gender', 'blank', 'text', own, 'Gender', False)], right=558.1)
    D.row(pg, r[1], r[2], [('Social Security', pref + 'ssn', 'blank', 'tax number', own, 'Social security number / tax ID', mustp), ('Date of Birth', pref + 'dob', 'blank', 'date', own, 'Date of birth (MM/DD/YYYY)', mustp),
                           ('Daytime Phone Number', pref + 'phone', 'blank', 'phone', own, 'Daytime phone number', mustp)], right=558.1)
    D.row(pg, r[2], r[3], [('Residential Street Address', pref + 'street', 'blank', 'address', own, 'Residential street address', mustp), ('City', pref + 'city', 'blank', 'text', own, 'City', mustp),
                           ('State', pref + 'state', 'blank', 'text', own, 'State', mustp), ('Zip', pref + 'zip', 'blank', 'text', own, 'Zip code', mustp)], right=558.1)
    D.row(pg, r[3], r[4], [('Email Address', pref + 'email', 'blank', 'email', own, 'Email address', False)], right=558.1)
person(3, 'p03-inv-', INV, (191.7, 223.5, 255.3, 287.1, 318.9), True)
Q('p03-inv-resident-alien', 3, 0, INV, 'Investor: resident alien', 'Resident Alien', group='investor non-U.S. status'); Q('p03-inv-nonresident-alien', 3, 1, INV, 'Investor: non-resident alien', 'Non-Resident Alien', group='investor non-U.S. status')
D.U('p03-inv-citizenship', 3, 0, 'blank', 'text', INV, 'Investor: country of citizenship (if non-U.S.)', False, 'Country of Citizenship')
person(3, 'p03-co-', CO, (429.2, 461.0, 492.8, 524.6, 556.4), False)
Q('p03-co-resident-alien', 3, 2, CO, 'Co-investor: resident alien', 'Resident Alien', group='co-investor non-U.S. status'); Q('p03-co-nonresident-alien', 3, 3, CO, 'Co-investor: non-resident alien', 'Non-Resident Alien', group='co-investor non-U.S. status')
D.U('p03-co-citizenship', 3, 1, 'blank', 'text', CO, 'Co-investor: country of citizenship (if non-U.S.)', False, 'Country of Citizenship')
for i, s, l in ((4, 'employee', 'Cohen & Steers employee'), (5, 'officer', 'Cohen & Steers officer or director'), (6, 'affiliate', 'Cohen & Steers affiliate')):
    Q('p03-rel-' + s, 3, i, INV, 'Relationship: ' + l, l, group='Cohen & Steers relationship (required)')
S.NOT[3] = ['row rules (frame the row cells)', 'section bar']
S.SURE[3] = 'sure; row cells run from caption to next caption (no vertical rules)'
# p4
tops = [151.8, 192.1, 232.6, 273.3, 313.5]
for k in range(4):
    p = 'p04-ben%d-' % (k + 1)
    D.row(4, tops[k], tops[k + 1], [('First Name', p + 'first-name', 'blank', 'name', INV, 'TOD beneficiary %d: first name' % (k + 1), False), ('(MI)', p + 'mi', 'blank', 'name', INV, 'TOD beneficiary %d: middle initial' % (k + 1), False),
                                    ('Last Name', p + 'last-name', 'blank', 'name', INV, 'TOD beneficiary %d: last name' % (k + 1), False), ('SSN', p + 'ssn', 'blank', 'tax number', INV, 'TOD beneficiary %d: SSN' % (k + 1), False),
                                    ('Date of Birth', p + 'dob', 'blank', 'date', INV, 'TOD beneficiary %d: date of birth (MM/DD/YYYY)' % (k + 1), False)], right=449.0, ycap=(tops[k], tops[k] + 14))
    Q(p + 'primary', 4, 2 * k, INV, 'TOD beneficiary %d: primary' % (k + 1), 'Primary', group='beneficiary %d' % (k + 1))
    Q(p + 'secondary', 4, 2 * k + 1, INV, 'TOD beneficiary %d: secondary' % (k + 1), 'Secondary', group='beneficiary %d' % (k + 1))
    D.U(p + 'percent', 4, k, 'blank', 'percentage', INV, 'TOD beneficiary %d: percentage' % (k + 1), False, 'Secondary ______%')
D.row(4, 358.4, 390.2, [('Email Address', 'p04-contact-email', 'blank', 'email', INV, 'Contact information (if different): email address', False)], right=558.1)
D.row(4, 390.2, 422.0, [('Mailing Address', 'p04-contact-address', 'blank', 'address', INV, 'Contact information: mailing address', False, dict(doubt='no rule under this row: bottom taken 32 pt below its top, like the row above')),
                        ('City', 'p04-contact-city', 'blank', 'text', INV, 'Contact information: city', False, dict(doubt='no rule under this row')), ('State', 'p04-contact-state', 'blank', 'text', INV, 'Contact information: state', False, dict(doubt='no rule under this row')),
                        ('Zip', 'p04-contact-zip', 'blank', 'text', INV, 'Contact information: zip code', False, dict(doubt='no rule under this row'))], right=558.1)
Q('p04-drp-optout', 4, 8, INV, 'Check here to NOT enrol in the distribution reinvestment plan (residents of states not listed)', 'please check here if you do not wish to be enrolled')
S.NOT[4] = ['the underline of "UNLESS YOU ARE" (underlined words)', 'section bars']
S.SURE[4] = 'sure; the contact mailing row has no bottom rule (marked)'
# p5
Q('p05-dist-a', 5, 0, INV, 'Cash distribution: A. cash/check mailed to the address above', 'Cash/Check Mailed to the address set forth above', group='cash distribution')
Q('p05-dist-b', 5, 1, INV, 'Cash distribution: B. cash/check mailed to third party/custodian', 'Cash/Check Mailed to Third Party/Custodian', group='cash distribution')
Q('p05-dist-c', 5, 2, INV, 'Cash distribution: C. cash/direct deposit', 'Cash/Direct Deposit', group='cash distribution')
D.row(5, 199.2, 231.0, [('Name/Entity Name/Financial Institution', 'p05-tp-name', 'blank', 'name', INV, 'Third party/custodian: name, entity name or financial institution', False), ('Mailing Address', 'p05-tp-address', 'blank', 'address', INV, 'Third party/custodian: mailing address', False)], right=558.1)
D.row(5, 231.0, 262.8, [('City', 'p05-tp-city', 'blank', 'text', INV, 'Third party/custodian: city', False), ('State', 'p05-tp-state', 'blank', 'text', INV, 'Third party/custodian: state', False),
                        ('Zip', 'p05-tp-zip', 'blank', 'text', INV, 'Third party/custodian: zip code', False), ('Account Number', 'p05-tp-account', 'blank', 'text', INV, 'Third party/custodian: account number (required)', False)], right=558.1)
D.row(5, 346.0, 386.5, [('Financial Institution Name', 'p05-dd-bank', 'blank', 'name', INV, 'Direct deposit: financial institution name', False), ('Mailing Address', 'p05-dd-address', 'blank', 'address', INV, 'Direct deposit: mailing address', False),
                        ('City', 'p05-dd-city', 'blank', 'text', INV, 'Direct deposit: city', False), ('State', 'p05-dd-state', 'blank', 'text', INV, 'Direct deposit: state', False), ('ZIP', 'p05-dd-zip', 'blank', 'text', INV, 'Direct deposit: ZIP', False)], right=558.1)
D.row(5, 386.5, 418.3, [('Your Bank’s ABA Routing Number', 'p05-dd-aba', 'blank', 'text', INV, 'Direct deposit: ABA routing number', False, dict(doubt='no rule under this row')), ('Your Bank Account Number', 'p05-dd-account', 'blank', 'text', INV, 'Direct deposit: bank account number', False, dict(doubt='no rule under this row'))], right=558.1)
Q('p05-drp-enrol', 5, 3, INV, 'Check here to enrol in the distribution reinvestment plan (residents of the listed states)', 'please check here if you wish to enroll')
S.NOT[5] = ['the underline of "pre-printed voided check" (underlined words)']
S.SURE[5] = 'sure; rows without a bottom rule are taken 32 pt deep (marked)'
# p6
D.row(6, 174.0, 205.8, [('Broker-Dealer', 'p06-bd-name', 'blank', 'name', TP, 'Broker-dealer', False), ('Financial Advisor Name', 'p06-fa-name', 'blank', 'name', TP, 'Financial advisor name', False)], right=558.1)
D.row(6, 205.8, 237.6, [('Advisor Mailing Address', 'p06-fa-address', 'blank', 'address', TP, 'Advisor mailing address', False)], right=558.1)
D.row(6, 237.6, 269.5, [('City', 'p06-fa-city', 'blank', 'text', TP, 'City', False), ('State', 'p06-fa-state', 'blank', 'text', TP, 'State', False), ('Zip', 'p06-fa-zip', 'blank', 'text', TP, 'Zip code', False)], right=558.1)
D.row(6, 269.5, 301.2, [('Financial Advisor Number', 'p06-fa-number', 'blank', 'text', TP, 'Financial advisor number', False), ('Branch Number', 'p06-fa-branch', 'blank', 'text', TP, 'Branch number', False), ('Telephone Number', 'p06-fa-phone', 'blank', 'phone', TP, 'Telephone number', False)], right=558.1)
D.row(6, 301.2, 333.0, [('E-mail Address', 'p06-fa-email', 'blank', 'email', TP, 'E-mail address', False, dict(doubt='no rule under this row')), ('Fax Number', 'p06-fa-fax', 'blank', 'phone', TP, 'Fax number', False, dict(doubt='no rule under this row'))], right=558.1)
S.NOT[6] = ['prose']
# p7
for (x, y), s, k, l in (((180, 256), 'fa-signature', 'signature', 'Financial advisor signature'), ((290, 256), 'fa-date', 'date', 'Date beside the financial advisor signature'),
                        ((400, 256), 'bm-signature', 'signature', 'Branch manager signature (if required by broker-dealer)'), ((520, 256), 'bm-date', 'date', 'Date beside the branch manager signature')):
    D.cell('p07-' + s, 7, D.cellat(7, x, y), k, None, TP, l, False, l.split(' (')[0])
D.cell('p07-edelivery-initials', 7, D.cellat(7, 80, 520), 'initials', None, INV, 'Initials: I consent to electronic delivery (optional)', False, 'Initials')
D.capcell('p07-edelivery-email', 7, D.hy(7, 584.9), 'Email', 'blank', 'email', INV, 'Email for electronic delivery (caption above the rule)', False)
S.NOT[7] = ['the printed "X" before each signature box', 'prose']
# p8-12 initials
STATES = ['Alabama', 'California', 'Idaho', 'Iowa', 'Kansas', 'Kentucky', 'Maine', 'Massachusetts', 'Missouri', 'Nebraska', 'New Jersey', 'New Mexico', 'Ohio', 'Oregon', 'Pennsylvania', 'Puerto Rico', 'Tennessee', 'Vermont', 'Washington', 'Minnesota', 'Michigan', 'Arkansas', 'North Carolina', 'North Dakota', 'Texas', 'Oklahoma', 'Maryland', 'Mississippi', 'Arizona', 'New York', 'Alaska', 'Nevada', 'Utah', 'Wisconsin']
n = 0
for pg in (8, 9, 10, 11, 12):
    cs = D.cells(pg)
    c1 = sorted([c for c in cs if abs(c[0] - 472) < 2], key=lambda c: c[1]); c2 = [c for c in cs if c[0] > 514 and c[0] < 520]
    prev = 60
    for a in c1:
        n += 1
        b = [c for c in c2 if abs(c[1] - a[1]) < 1.5]
        assert len(b) == 1, (pg, a)
        txt = ' '.join(w['text'] for w in D.words(pg) if prev < w['top'] < a[3] + 2 and w['x1'] < 465)
        st = next((s for s in STATES if ('am a ' + s) in txt or ('am an ' + s) in txt), None)
        general = st is None
        lab = ('Representation %d (general)' % n) if general else ('Representation %d (%s residents)' % (n, st))
        D.cell('p%02d-init-%02d-investor' % (pg, n), pg, a, 'initials', None, INV, lab + ': investor initials', general, 'Initials', group='representation %d' % n)
        D.cell('p%02d-init-%02d-co' % (pg, n), pg, b[0], 'initials', None, CO, lab + ': second initials box (joint investor)', False, 'Initials', 'the second box of each pair is read as the co-investor\'s; it is not captioned', group='representation %d' % n)
        prev = a[3] + 2
for pg in (8, 9, 10, 11, 12): S.NOT[pg] = ['the "Initials" captions', 'prose'] + (['invisible table-cell frames around the state list under 8.b (no ink)'] if pg == 9 else [])
# p13
for (x, y), s, k, o, l, m, dbt in (((150, 495), 'inv-signature', 'signature', INV, 'Signature of investor', True, None), ((280, 495), 'inv-date', 'date', INV, 'Date beside the investor signature', True, None),
                                  ((400, 495), 'co-signature', 'signature', CO, 'Signature of co-investor or custodian (if applicable)', False, 'captioned for a co-investor OR a custodian; read as the co-investor\'s'),
                                  ((520, 495), 'co-date', 'date', CO, 'Date beside the co-investor/custodian signature', False, 'as the signature beside it')):
    D.cell('p13-' + s, 13, D.cellat(13, x, y), k, None, o, l, m, l.split(' (')[0], dbt)
S.NOT[13] = ['the printed "X" before each signature box', 'certifications (no box)']
# p14
Q('p14-bpi-yes', 14, 0, INV, 'ERISA 1: benefit plan investor: yes', 'Yes', group='ERISA 1'); Q('p14-bpi-no', 14, 1, INV, 'ERISA 1: benefit plan investor: no', 'No', group='ERISA 1')
D.U('p14-bpi-percent', 14, 0, 'blank', 'percentage', INV, 'ERISA 2: percentage of assets that are benefit plan investor assets (if yes)', False, '%')
D.U('p14-insurance-percent', 14, 1, 'blank', 'percentage', INV, 'ERISA 3: percentage of insurance company general account assets', False, '%')
Q('p14-controlling-yes', 14, 2, INV, 'ERISA 4: controlling person: yes', 'Yes', group='ERISA 4'); Q('p14-controlling-no', 14, 3, INV, 'ERISA 4: controlling person: no', 'No', group='ERISA 4')
S.NOT[14] = ['footnote rule and footnotes']
S.NOT[15] = ['the framed mailing-address box (printed addresses)', 'prose']
for p in range(1, 16): S.SURE.setdefault(p, 'sure')
for p in (8, 9, 10, 11, 12): S.SURE[p] = 'sure; whose the second box of each pair is (co-investor) is a judgement'
S.SURE[13] = 'sure; the second signature is captioned "co-investor or custodian"'
signing = dict(investor_pages=[1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14], firm_pages=[], co_investor=True,
               third_parties=['custodian (page 2 custodian information)', 'broker-dealer, financial advisor and branch manager (pages 6-7)'],
               kind='Subscription agreement form (Cohen & Steers Income Opportunities REIT). The investor completes sections 1-5, 7-9, initials the representations with a second (joint) box beside each, and signs page A-13 with a co-investor/custodian beside; the broker-dealer section and signatures are on A-6/A-7. No issuer acceptance block.')
S.write(signing, 'pdfplumber characters, drawn rules, rectangles and cells (cand/b106.json); tick boxes are drawn squares; row cells measured between row rules from caption to caption; every page looked at at 80 dpi; overlays looked at.')
